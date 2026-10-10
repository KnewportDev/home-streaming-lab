Set-StrictMode -Version Latest
function Get-Percentile {
    param([Parameter(Mandatory)][double[]]$Values, [ValidateRange(0,100)][double]$Percentile)
    if ($Values.Count -eq 0) { throw 'At least one value is required.' }
    foreach ($value in $Values) { if ([double]::IsNaN($value) -or [double]::IsInfinity($value)) { throw 'Values must be finite.' } }
    $sorted = @($Values | Sort-Object)
    $index = ($sorted.Count - 1) * $Percentile / 100
    $lower = [int][Math]::Floor($index)
    $upper = [int][Math]::Ceiling($index)
    return $sorted[$lower] + ($sorted[$upper] - $sorted[$lower]) * ($index - $lower)
}
function ConvertTo-StreamingSummary {
    param([Parameter(Mandatory)][object[]]$Rows)
    if ($Rows.Count -eq 0) { throw 'CSV must contain at least one data row.' }
    $columns = @('data_kind','test_id','codec','width','height','target_fps','bitrate_mbps','duration_seconds','average_fps','network_latency_ms','decode_latency_ms','dropped_frames_percent','controller_check')
    $actual = @($Rows[0].PSObject.Properties.Name)
    if (@(Compare-Object $columns $actual).Count -gt 0) { throw 'CSV columns must match the documented schema exactly.' }
    $kinds = @($Rows | ForEach-Object { $_.data_kind } | Select-Object -Unique)
    if ($kinds.Count -ne 1 -or $kinds[0] -notin @('sample','measured')) { throw 'Use one data_kind: sample or measured. Never mix them.' }
    $numeric = @('width','height','target_fps','bitrate_mbps','duration_seconds','average_fps','network_latency_ms','decode_latency_ms','dropped_frames_percent')
    $clean = @()
    $seen = @{}
    foreach ($row in $Rows) {
        if ([string]$row.test_id -notmatch '^[A-Za-z0-9_-]{1,40}$') { throw 'test_id must be a short anonymous label.' }
        if ($seen.ContainsKey([string]$row.test_id)) { throw 'Duplicate test_id.' }
        $seen[[string]$row.test_id] = $true
        if ($row.codec -notin @('H264','HEVC','AV1')) { throw 'Unknown codec.' }
        if ($row.controller_check -notin @('pass','fail','pending')) { throw 'Invalid controller_check.' }
        $record = [ordered]@{ test_id=[string]$row.test_id; codec=[string]$row.codec }
        foreach ($field in $numeric) {
            $raw = [string]$row.$field
            if ([string]::IsNullOrWhiteSpace($raw)) {
                if ($field -in @('width','height','target_fps','bitrate_mbps','duration_seconds')) { throw "Missing required value: $field" }
                $record[$field] = $null
                continue
            }
            $value = 0.0
            $valid = [double]::TryParse($raw,[Globalization.NumberStyles]::Float,[Globalization.CultureInfo]::InvariantCulture,[ref]$value)
            if (-not $valid -or [double]::IsNaN($value) -or [double]::IsInfinity($value) -or $value -lt 0) { throw "Invalid finite nonnegative number: $field" }
            if ($field -in @('width','height','target_fps','bitrate_mbps','duration_seconds') -and $value -le 0) { throw "$field must be positive." }
            if ($field -in @('width','height') -and $value -ne [Math]::Floor($value)) { throw "$field must be an integer." }
            if ($field -eq 'dropped_frames_percent' -and $value -gt 100) { throw 'Dropped-frame percentage cannot exceed 100.' }
            $record[$field] = $value
        }
        $record['controller_check'] = [string]$row.controller_check
        $clean += [pscustomobject]$record
    }
    $stats = [ordered]@{}
    foreach ($metric in @('average_fps','network_latency_ms','decode_latency_ms','dropped_frames_percent')) {
        $values = @($clean | Where-Object { $null -ne $_.$metric } | ForEach-Object { [double]$_.$metric })
        $stats[$metric] = [pscustomobject]@{
            available_runs=$values.Count
            median=if ($values.Count) { Get-Percentile -Values $values -Percentile 50 } else { $null }
        }
    }
    [pscustomobject]@{ data_kind=$kinds[0]; run_count=$clean.Count; runs=$clean; statistics=[pscustomobject]$stats }
}
Export-ModuleMember -Function Get-Percentile,ConvertTo-StreamingSummary
