$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$python = "C:\Users\means\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if (-not (Test-Path $python)) {
  $python = "python"
}

Write-Host "Serving Linea at http://localhost:4173"
& $python -m http.server 4173 --bind 127.0.0.1
