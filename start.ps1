$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$taskNodeCommand = Get-Command node -ErrorAction SilentlyContinue
$taskNodeInstall = (Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\Node.js' -ErrorAction SilentlyContinue).InstallPath
$taskNodePath = if ($taskNodeInstall -and (Test-Path -LiteralPath (Join-Path $taskNodeInstall 'node.exe'))) { Join-Path $taskNodeInstall 'node.exe' } elseif ($taskNodeCommand) { $taskNodeCommand.Source } else { Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' }
if (-not (Test-Path -LiteralPath $taskNodePath)) { throw 'Install Node.js LTS (version 24 or newer), then run this script again.' }
$taskNodeMajor = & $taskNodePath -p 'Number(process.versions.node.split(".")[0])'
if ([int]$taskNodeMajor -lt 24) { throw 'This project needs Node.js 24 or newer.' }
try {
    $taskExistingApp = Invoke-WebRequest -Uri 'http://127.0.0.1:3000' -TimeoutSec 2 -UseBasicParsing
    if ($taskExistingApp.Content -match 'Shimmery Central System') { Write-Host 'Shimmery Central is already running. Open http://127.0.0.1:3000'; exit 0 }
} catch { }
Write-Host 'Keep this window open while using the app. Press Ctrl+C to stop.'
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot '.env'))) { throw 'Run setup-postgres.cmd first to configure the local project database.' }
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'node_modules\pg\package.json'))) {
    $taskNpmPath = Join-Path (Split-Path $taskNodePath) 'node_modules\npm\bin\npm-cli.js'
    if (-not (Test-Path -LiteralPath $taskNpmPath)) { throw 'Run npm install in this folder using your installed Node.js, then start again.' }
    Write-Host 'Installing the project dependencies from npm...'
    & $taskNodePath $taskNpmPath ci --omit=dev --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed. Check your internet connection and run npm install.' }
}
& $taskNodePath server.js
