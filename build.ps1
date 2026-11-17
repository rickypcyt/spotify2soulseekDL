# Build final: genera dist\spotify2soulseek\ (carpeta con el exe) y
# dist\spotify2soulseek-windows.zip, listo para enviar o publicar.
# No abre la aplicación; usa dev.ps1 para trabajar.
[CmdletBinding()]
param([switch]$Force)

. (Join-Path $PSScriptRoot "_common.ps1")

Initialize-Python -Force:$Force
Update-Frontend -Force:$Force
Stop-SoulseekProcesses
Initialize-AppData

$vendorSlskd = Join-Path $Root "vendor\slskd"
function Find-Slskd { Get-ChildItem -Path $vendorSlskd -Filter "slskd.exe" -Recurse -File -ErrorAction SilentlyContinue | Select-Object -First 1 }
if (-not (Find-Slskd)) {
    Write-Host "Descargando slskd para empaquetar..."
    & $Python -c "from backend.bootstrap import download_slskd; download_slskd()"
    if ($LASTEXITCODE -ne 0 -or -not (Find-Slskd)) { throw "Falló la descarga de slskd." }
}

# yt-dlp y deno van junto al exe: así no se descargan en el primer uso del PC de destino.
$vendorYtdlp = Join-Path $Root "vendor\yt-dlp"
if (-not (Test-Path (Join-Path $vendorYtdlp "yt-dlp.exe")) -or -not (Test-Path (Join-Path $vendorYtdlp "deno.exe"))) {
    Write-Host "Descargando yt-dlp y deno para empaquetar..."
    & $Python -c "from backend.youtube_service import _download_ytdlp, _download_deno; _download_ytdlp(); _download_deno()"
}
foreach ($tool in @("yt-dlp.exe", "deno.exe")) {
    if (-not (Test-Path (Join-Path $vendorYtdlp $tool))) { throw "No se pudo obtener $tool." }
}

# PyInstaller borra dist\spotify2soulseek entero: se apartan los datos del usuario y se restauran.
$backup = Join-Path $Root "dist\_data_backup"
# Un respaldo previo significa que un build anterior se interrumpió con los datos apartados:
# se devuelven a su sitio; nunca se borran.
if (Test-Path $backup) {
    if (-not (Get-ChildItem $backup -Force -ErrorAction SilentlyContinue)) {
        Remove-Item -Force $backup
    } elseif (-not (Test-Path $AppDataDir)) {
        New-Item -ItemType Directory -Force -Path $AppDir | Out-Null
        Move-Item -Path $backup -Destination $AppDataDir
        Write-Host "Datos recuperados de un build interrumpido."
    } else {
        throw "Hay datos de un build interrumpido en $backup y también en $AppDataDir. Revísalos a mano antes de compilar."
    }
}
if (Test-Path $AppDataDir) { Move-Item -Path $AppDataDir -Destination $backup }

Write-Host "Empaquetando aplicación..."
Push-Location $Root
try {
    & $Python -m PyInstaller $SpecPath --noconfirm --clean
    if ($LASTEXITCODE -ne 0) { throw "Falló PyInstaller." }
} finally {
    Pop-Location
    if (Test-Path $backup) {
        New-Item -ItemType Directory -Force -Path $AppDir | Out-Null
        if (Test-Path $AppDataDir) { Remove-Item -Recurse -Force $AppDataDir }
        Move-Item -Path $backup -Destination $AppDataDir
    }
}

if (-not (Test-Path $ExePath)) { throw "No se encontró $ExePath tras el build." }
foreach ($tool in @("yt-dlp.exe", "deno.exe")) {
    Copy-Item -Force (Join-Path $vendorYtdlp $tool) (Join-Path $AppDir $tool)
}

# Zip para enviar/publicar SIN datos personales (token de Spotify, configuración,
# historial) ni archivos que la app genera al usarla.
$stage = Join-Path $Root "dist\_zip_stage"
$zipPath = Join-Path $Root "dist\spotify2soulseek-windows.zip"
if (Test-Path $stage) { Remove-Item -Recurse -Force $stage }
$stageApp = Join-Path $stage "spotify2soulseek"
& robocopy $AppDir $stageApp /E /NFL /NDL /NJH /NJS | Out-Null
if ($LASTEXITCODE -ge 8) { throw "Falló la copia para el zip (robocopy $LASTEXITCODE)." }
# Solo se quita lo de la RAÍZ de la app: los filtros de robocopy (/XD, /XF) actúan en todas
# las subcarpetas y se llevarían, por ejemplo, el slskd incluido en _internal.
foreach ($item in @("data", "wwwroot", "slskd.exe", "_update_new", "_update.zip", "_update.cmd")) {
    $path = Join-Path $stageApp $item
    if (Test-Path $path) { Remove-Item -Recurse -Force $path }
}
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }
Compress-Archive -Path (Join-Path $stage "spotify2soulseek") -DestinationPath $zipPath
Remove-Item -Recurse -Force $stage

Write-Host "Listo:"
Write-Host "  App:  $ExePath"
Write-Host "  Zip:  $zipPath  (esto es lo que se envía)"
exit 0  # robocopy deja $LASTEXITCODE=1 cuando copia bien; no es un error
