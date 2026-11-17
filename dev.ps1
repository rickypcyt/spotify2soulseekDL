# Desarrollo: backend desde fuente + servidor de Vite con hot reload.
# - Cambios de UI (frontend/src): se ven al instante, sin reiniciar nada.
# - Cambios de Python: Ctrl+C y volver a ejecutar.
# La app se abre en http://localhost:5173 (Vite hace proxy de /api al backend).
. (Join-Path $PSScriptRoot "_common.ps1")

Initialize-Python

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Install-WithWinget "OpenJS.NodeJS.LTS" "Node.js"
}
if (-not (Test-Path (Join-Path $FrontendDir "node_modules"))) {
    Write-Host "Instalando dependencias del frontend..."
    Push-Location $FrontendDir
    try {
        npm install
        if ($LASTEXITCODE -ne 0) { throw "Falló npm install." }
    } finally { Pop-Location }
}

# Misma base de datos que el exe empaquetado.
Initialize-AppData
$env:SOULSEEK_DATA_DIR = $AppDataDir
# El navegador lo abre Vite (puerto 5173), no el backend (que serviría un build viejo).
$env:SOULSEEK_NO_BROWSER = "1"
Stop-SoulseekProcesses

Write-Host "Iniciando Vite (hot reload)..."
$vite = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npm run dev -- --open" `
    -WorkingDirectory $FrontendDir -PassThru -NoNewWindow

Write-Host "Iniciando backend desde fuente (dev)..."
Push-Location $Root
try {
    & $Python -m backend.spotify_web
} finally {
    Pop-Location
    if ($vite -and -not $vite.HasExited) {
        & taskkill /PID $vite.Id /T /F | Out-Null
    }
}
