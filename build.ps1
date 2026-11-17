# Build final: genera dist\spotify2soulseek.exe con PyInstaller.
# No abre la aplicación; usa dev.ps1 para trabajar.
[CmdletBinding()]
param([switch]$Force)

. (Join-Path $PSScriptRoot "_common.ps1")

Initialize-Python -Force:$Force
Update-Frontend -Force:$Force
Stop-SoulseekProcesses

$vendorSlskd = Join-Path $Root "vendor\slskd"
function Find-Slskd { Get-ChildItem -Path $vendorSlskd -Filter "slskd.exe" -Recurse -File -ErrorAction SilentlyContinue | Select-Object -First 1 }
if (-not (Find-Slskd)) {
    Write-Host "Descargando slskd para empaquetar..."
    & $Python -c "from backend.bootstrap import download_slskd; download_slskd()"
    if ($LASTEXITCODE -ne 0 -or -not (Find-Slskd)) { throw "Falló la descarga de slskd." }
}

Write-Host "Empaquetando ejecutable..."
Push-Location $Root
try {
    & $Python -m PyInstaller $SpecPath --noconfirm --clean
    if ($LASTEXITCODE -ne 0) { throw "Falló PyInstaller." }
} finally { Pop-Location }

if (-not (Test-Path $ExePath)) { throw "No se encontró $ExePath tras el build." }
Write-Host "Listo: $ExePath"
