Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
Import-Module (Join-Path $PSScriptRoot '..\scripts\StreamingLab.psm1') -Force
$script:passed=0
function Assert($condition,$name){if(-not $condition){throw "FAIL: $name"};$script:passed++;"PASS: $name"}
function Reject($action,$name){$rejected=$false;try{& $action|Out-Null}catch{$rejected=$true};Assert $rejected $name}
$fixture=Join-Path $PSScriptRoot '..\examples\sample-sessions.csv'
function Rows { @(Import-Csv -LiteralPath $fixture) }
Assert ((Get-Percentile @(1,2,3,4) 50) -eq 2.5) 'Interpolated median'
Assert ((Get-Percentile @(9) 95) -eq 9) 'Single observation percentile'
Assert ((Get-Percentile @(1,2,3,4) 100) -eq 4) 'Percentile upper boundary'
Reject {Get-Percentile @([double]::NaN) 50} 'Reject nonfinite statistics'
$summary=ConvertTo-StreamingSummary (Rows)
Assert ($summary.data_kind -eq 'sample') 'Sample provenance retained'
Assert ($summary.statistics.decode_latency_ms.available_runs -eq 1) 'Missing metric excluded'
Assert ($summary.statistics.decode_latency_ms.median -eq 7.2) 'Missing metric is not zero'
Reject {$r=Rows;$r[1].data_kind='measured';ConvertTo-StreamingSummary $r} 'Reject mixed provenance'
Reject {$r=Rows;$r[0].network_latency_ms='NaN';ConvertTo-StreamingSummary $r} 'Reject NaN metric'
Reject {$r=Rows;$r[0].duration_seconds='0';ConvertTo-StreamingSummary $r} 'Reject zero duration'
Reject {$r=Rows;$r[0].dropped_frames_percent='101';ConvertTo-StreamingSummary $r} 'Reject impossible percentage'
Reject {$r=Rows;$r[0].test_id='unsafe|table';ConvertTo-StreamingSummary $r} 'Reject Markdown injection'
Reject {$r=Rows;$r[1].test_id=$r[0].test_id;ConvertTo-StreamingSummary $r} 'Reject duplicate run ID'
Reject {$r=Rows;$r[0]|Add-Member NoteProperty private_ip 'example';ConvertTo-StreamingSummary $r} 'Reject extra potentially private columns'
Reject {$r=Rows;$r[0].codec='unknown';ConvertTo-StreamingSummary $r} 'Reject unknown codec'
Reject {$r=Rows;$r[0].width='1920.5';ConvertTo-StreamingSummary $r} 'Reject fractional dimensions'
Reject {ConvertTo-StreamingSummary @()} 'Reject empty dataset'
$reportPath=Join-Path $PSScriptRoot 'test-output.md'
try {
    & (Join-Path $PSScriptRoot '..\scripts\New-StreamingReport.ps1') -CsvPath $fixture -OutputPath $reportPath|Out-Null
    $text=Get-Content -LiteralPath $reportPath -Raw
    Assert ($text.Contains('SAMPLE DATA - NOT A DEVICE TEST')) 'Report sample watermark'
    Assert ($text.Contains('not recorded')) 'Report missing-value display'
    Assert (-not $text.Contains('example')) 'Report excludes unexpected data'
} finally {if(Test-Path -LiteralPath $reportPath){Remove-Item -LiteralPath $reportPath}}
"All $script:passed tests passed."
