[CmdletBinding()]
param([string]$OutputPath)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
# Read-only hardware queries. Only an explicitly requested report file is written.
$checks = New-Object System.Collections.Generic.List[object]
function Add-Check($Name,$Status,$Detail) { $checks.Add([pscustomobject]@{name=$Name;status=$Status;detail=$Detail}) }
$hardware = [ordered]@{}
try {
    $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
    $system = Get-CimInstance Win32_ComputerSystem
    $os = Get-CimInstance Win32_OperatingSystem
    $hardware.cpu = $cpu.Name.Trim()
    $hardware.cores = $cpu.NumberOfCores
    $hardware.logical_processors = $cpu.NumberOfLogicalProcessors
    $hardware.memory_gib = [Math]::Round($system.TotalPhysicalMemory / 1GB,1)
    $hardware.os = $os.Caption
    $hardware.os_build = $os.BuildNumber
    $hardware.gpus = @(Get-CimInstance Win32_VideoController | ForEach-Object {
        [pscustomobject]@{name=$_.Name;driver_version=$_.DriverVersion}
    })
    Add-Check 'Hardware inventory' 'observed' 'Detected hardware is not an encoder or streaming benchmark.'
} catch { Add-Check 'Hardware inventory' 'unknown' 'Hardware query unavailable; retry in Windows PowerShell.' }
try {
    $hardware.adapters = @(Get-NetAdapter -Physical | ForEach-Object {
        [pscustomobject]@{type=if ($_.InterfaceDescription -match 'Wireless|Wi-Fi|802.11') {'wireless'} else {'other physical'};model=$_.InterfaceDescription;status=[string]$_.Status;link_rate=[string]$_.LinkSpeed}
    })
    Add-Check 'Network adapters' 'observed' 'Link rate is negotiated speed, not measured usable throughput. Prefer host Ethernet when available.'
} catch { Add-Check 'Network adapters' 'unknown' 'Adapter inventory unavailable.' }
try {
    $profiles = @(Get-NetConnectionProfile | ForEach-Object { [string]$_.NetworkCategory } | Sort-Object -Unique)
    $hardware.network_profile_categories = $profiles
    Add-Check 'Network profile' 'observed' 'Categories only; network names and addresses are omitted. No category is changed.'
} catch { Add-Check 'Network profile' 'unknown' 'Network category unavailable.' }
try {
    $service = Get-Service -Name SunshineService -ErrorAction SilentlyContinue
    if ($service) { Add-Check 'Sunshine service' 'observed' ([string]$service.Status) }
    else { Add-Check 'Sunshine service' 'pending' 'SunshineService is not installed.' }
} catch { Add-Check 'Sunshine service' 'unknown' 'Service query unavailable.' }
try {
    $rules = @(Get-NetFirewallRule -DisplayName '*Sunshine*' -ErrorAction SilentlyContinue)
    $hardware.sunshine_firewall_rules = @($rules | ForEach-Object {
        [pscustomobject]@{enabled=[string]$_.Enabled;direction=[string]$_.Direction;action=[string]$_.Action;profile=[string]$_.Profile}
    })
    Add-Check 'Firewall inventory' 'observed' 'Name-matched rule summary only; absence does not prove Sunshine is blocked. No firewall settings changed.'
} catch { Add-Check 'Firewall inventory' 'unknown' 'Rule query unavailable; no firewall settings changed.' }
Add-Check 'Client, display and controller' 'pending' 'Test the actual onn Google TV, Vizio display and DualSense. No client measurement has been taken.'
Add-Check 'Streaming performance' 'pending' 'Run an actual H.264 1920x1080 60 fps SDR session before judging readiness.'
$report = [pscustomobject]@{
    schema_version=1
    collected_utc=[DateTime]::UtcNow.ToString('o')
    report_type='read_only_host_inventory'
    overall='unvalidated_until_client_test'
    hardware=[pscustomobject]$hardware
    checks=@($checks.ToArray())
}
$json = $report | ConvertTo-Json -Depth 8
if ($OutputPath) { $json | Set-Content -LiteralPath $OutputPath -Encoding UTF8 }
$json
