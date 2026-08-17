$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $projectRoot

npm ci

if (-not (Test-Path -LiteralPath "node_modules\electron\dist\electron.exe")) {
    node "node_modules\electron\install.js"
}

npm run package

$outputPath = Join-Path $projectRoot "..\..\outputs"
if (-not (Test-Path -LiteralPath $outputPath)) {
    New-Item -ItemType Directory -Path $outputPath | Out-Null
}
$outputRoot = Resolve-Path $outputPath
Copy-Item -LiteralPath "release-electron\Tallypine-Setup-1.0.0.exe" -Destination $outputRoot -Force
Copy-Item -LiteralPath "release-electron\Tallypine-Portable-1.0.0.exe" -Destination $outputRoot -Force

Write-Host "Tallypine 1.0 is ready in $outputRoot"
