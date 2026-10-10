[CmdletBinding()]
param([Parameter(Mandatory)][string]$CsvPath,[Parameter(Mandatory)][string]$OutputPath)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
Import-Module (Join-Path $PSScriptRoot 'StreamingLab.psm1') -Force
$summary=ConvertTo-StreamingSummary -Rows @(Import-Csv -LiteralPath $CsvPath)
$label=if($summary.data_kind -eq 'sample'){'SAMPLE DATA - NOT A DEVICE TEST'}else{'USER-RECORDED MEASUREMENTS'}
$lines=New-Object System.Collections.Generic.List[string]
$lines.Add('# Streaming session report')
$lines.Add('')
$lines.Add("**$label**")
$lines.Add('')
$lines.Add('These are manually recorded per-run observations. The generator cannot verify their provenance.')
$lines.Add('Network and decode latency are separate metrics; neither proves controller-to-display latency.')
$lines.Add('')
$lines.Add('| Run | Codec | Resolution | Target FPS | Mbps | Seconds | Average FPS | Network ms | Decode ms | Dropped % | Controller |')
$lines.Add('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')
foreach($run in $summary.runs){
    $values=@($run.test_id,$run.codec,("$($run.width)x$($run.height)"),$run.target_fps,$run.bitrate_mbps,$run.duration_seconds,$run.average_fps,$run.network_latency_ms,$run.decode_latency_ms,$run.dropped_frames_percent,$run.controller_check)
    $display=@($values|ForEach-Object{if($null -eq $_){'not recorded'}elseif($_ -is [double]){$_.ToString('0.###',[Globalization.CultureInfo]::InvariantCulture)}else{[string]$_}})
    $lines.Add('| '+($display -join ' | ')+' |')
}
$lines.Add('')
$lines.Add('## Median of recorded run values')
$lines.Add('')
foreach($metric in $summary.statistics.PSObject.Properties){
    $stat=$metric.Value
    $value=if($null -eq $stat.median){'not recorded'}else{$stat.median.ToString('0.###',[Globalization.CultureInfo]::InvariantCulture)}
    $lines.Add("- $($metric.Name): $value ($($stat.available_runs) runs)")
}
$lines.Add('')
$lines.Add('Medians summarize per-run values, not individual frames or packets. Missing data stays missing. No automatic pass/fail score is inferred.')
$lines | Set-Content -LiteralPath $OutputPath -Encoding UTF8
Get-Item -LiteralPath $OutputPath | Select-Object Name,Length
