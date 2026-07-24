<#
  prove.ps1 - Person D's proof-by-construction.

  Checks out each tagged state of the target repo, runs the deterministic
  validator against it, and asserts the verdict matches what we claim:

     base-green      -> FAIL  (feature absent: pagination + edge fail)
     naive-red       -> FAIL  (fails EXACTLY the edge-cases criterion)
     solution-green  -> PASS  (all four criteria green)

  This is the demo's backbone: it proves a naive fix fails exactly one
  criterion and a correct fix passes all four. Run it before the demo.

  Usage (from repo root):
     .\demo\prove.ps1
#>

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

# --- locate git ---
$git = (Get-Command git.exe -ErrorAction SilentlyContinue).Source
if (-not $git) { $git = "C:\Program Files\Git\cmd\git.exe" }
if (-not (Test-Path $git)) { throw "git not found" }

# --- locate venv python ---
$py = Join-Path $repoRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $py)) { throw "venv python not found at $py; create it first" }
$env:Path = (Split-Path $py) + ";" + $env:Path

$startBranch = (& $git rev-parse --abbrev-ref HEAD).Trim()

$expectations = @(
    @{ tag = "base-green";     verdict = "fail"; failing = @("pagination", "edge-cases") },
    @{ tag = "naive-red";      verdict = "fail"; failing = @("edge-cases") },
    @{ tag = "solution-green"; verdict = "pass"; failing = @() }
)

$allOk = $true
try {
    foreach ($e in $expectations) {
        Write-Host "`n=== $($e.tag) ===" -ForegroundColor Cyan
        & $git checkout -q $e.tag

        $out = & $py validation\validator.py --repo target-repo --criteria validation\criteria.json --json
        $report = $out | ConvertFrom-Json

        $failing = @($report.criteria | Where-Object { $_.status -ne "pass" } | ForEach-Object { $_.id })

        $verdictOk = ($report.verdict -eq $e.verdict)
        $failingOk = (@(Compare-Object $failing $e.failing).Count -eq 0)

        $mark = if ($verdictOk -and $failingOk) { "OK  " } else { "BAD "; $allOk = $false }
        Write-Host "  [$mark] verdict=$($report.verdict) (expected $($e.verdict)); failing=[$($failing -join ', ')] (expected [$($e.failing -join ', ')])"
    }
}
finally {
    & $git checkout -q $startBranch
}

Write-Host ""
if ($allOk) {
    Write-Host "PROOF PASSED: naive fails exactly one criterion; solution passes all four." -ForegroundColor Green
    exit 0
} else {
    Write-Host "PROOF FAILED: an expectation did not hold." -ForegroundColor Red
    exit 1
}
