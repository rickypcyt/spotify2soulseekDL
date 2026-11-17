# Funciones compartidas por dev.ps1 y build.ps1 (no se ejecuta directamente).
$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$FrontendDir = Join-Path $Root "frontend"
$DistDir = Join-Path $FrontendDir "dist"
# La app se empaqueta como carpeta (onedir): dist\spotify2soulseek\spotify2soulseek.exe
$AppDir = Join-Path $Root "dist\spotify2soulseek"
$ExePath = Join-Path $AppDir "spotify2soulseek.exe"
# Datos del usuario junto al exe (igual que en el PC de quien lo use).
$AppDataDir = Join-Path $AppDir "data"
$RequirementsPath = Join-Path $Root "config\requirements.txt"
$SpecPath = Join-Path $Root "packaging\soulseek.spec"
$VenvDir = Join-Path $Root ".venv"
$Python = Join-Path $VenvDir "Scripts\python.exe"

foreach ($f in @($RequirementsPath, $SpecPath)) {
    if (-not (Test-Path $f)) { throw "No se encontró $f." }
}

function Stop-SoulseekProcesses {
    $processes = @(Get-Process -Name "spotify2soulseek" -ErrorAction SilentlyContinue)
    if ($processes.Count -eq 0) { return }
    Write-Host "Cerrando instancias anteriores de spotify2soulseek..."
    $processes | Stop-Process -Force -ErrorAction SilentlyContinue
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        if (-not (Get-Process -Name "spotify2soulseek" -ErrorAction SilentlyContinue)) { return }
        Start-Sleep -Milliseconds 250
    }
    throw "No se pudo liberar $ExePath. Cierra spotify2soulseek.exe y vuelve a intentarlo."
}

function Update-SessionPath {
    $machine = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $user    = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $merged  = @()
    foreach ($entry in (@($machine, $user, $env:Path) -join ';') -split ';') {
        $entry = $entry.Trim()
        if ($entry -and $merged -notcontains $entry) { $merged += $entry }
    }
    $env:Path = $merged -join ';'
}

function Install-WithWinget([string]$PackageId, [string]$Label) {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        throw "winget no está disponible. Instala 'App Installer' desde la Microsoft Store y vuelve a ejecutar."
    }
    $answer = Read-Host "¿Instalar $Label automáticamente con winget? (s/N)"
    if ($answer -notmatch '^[sS]') { throw "$Label es requerido y no se instaló." }
    winget install --id $PackageId --exact --silent --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) { throw "winget no pudo instalar $Label (código $LASTEXITCODE)." }
    Update-SessionPath
}

function Initialize-Python([switch]$Force) {
    $ok = $false
    try { py -3.13 -c "" 2>$null; $ok = ($LASTEXITCODE -eq 0) } catch {}
    if (-not $ok) {
        Install-WithWinget "Python.Python.3.13" "Python 3.13"
    }
    if (-not (Test-Path $Python)) {
        Write-Host "Creando entorno virtual (.venv)..."
        py -3.13 -m venv $VenvDir
        if ($LASTEXITCODE -ne 0 -or -not (Test-Path $Python)) { throw "Falló la creación del venv." }
    }
    $hashPath = Join-Path $VenvDir ".requirements.sha256"
    $hash = (Get-FileHash $RequirementsPath -Algorithm SHA256).Hash
    $saved = if (Test-Path $hashPath) { (Get-Content $hashPath -Raw).Trim() } else { "" }
    if ($Force -or $hash -ne $saved) {
        Write-Host "Instalando dependencias de Python..."
        & $Python -m pip install -r $RequirementsPath
        if ($LASTEXITCODE -ne 0) { throw "Falló pip install." }
        Set-Content -Path $hashPath -Value $hash -NoNewline
    }
}

# Compila el frontend solo si falta dist o hay fuentes más nuevas.
function Update-Frontend([switch]$Force) {
    $distIndex = Join-Path $DistDir "index.html"
    $inputs = @(
        Get-ChildItem (Join-Path $FrontendDir "src") -Recurse -File -ErrorAction SilentlyContinue
        Get-ChildItem $FrontendDir -File -ErrorAction SilentlyContinue
    )
    $newest = ($inputs | Measure-Object LastWriteTime -Maximum).Maximum
    $stale = $Force -or -not (Test-Path $distIndex) -or -not $newest -or
             ($newest -gt (Get-Item $distIndex).LastWriteTime)
    if (-not $stale) { return }

    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        Install-WithWinget "OpenJS.NodeJS.LTS" "Node.js"
    }
    Push-Location $FrontendDir
    try {
        if ($Force -or -not (Test-Path "node_modules")) {
            Write-Host "Instalando dependencias del frontend..."
            npm install
            if ($LASTEXITCODE -ne 0) { throw "Falló npm install." }
        }
        Write-Host "Compilando frontend..."
        npm run build
        if ($LASTEXITCODE -ne 0) { throw "Falló el build del frontend." }
    } finally { Pop-Location }
    if (-not (Test-Path $distIndex)) { throw "No se encontró frontend/dist tras el build." }
}

# Versiones anteriores (un solo .exe) guardaban los datos en dist\data: se mueven
# una vez a la carpeta de la app para que dev.ps1 y el exe compartan la misma base.
function Initialize-AppData {
    $legacy = Join-Path $Root "dist\data"
    if ((Test-Path $legacy) -and -not (Test-Path $AppDataDir)) {
        New-Item -ItemType Directory -Force -Path $AppDir | Out-Null
        try {
            Move-Item -Path $legacy -Destination $AppDataDir -ErrorAction Stop
            Write-Host "Datos movidos de dist\data a $AppDataDir"
        } catch {
            # Suele pasar si dev.ps1 o la app están abiertos (la base de datos está en uso).
            Write-Warning "No se pudo mover dist\data (¿está abierta la app o dev.ps1?). Se reintentará la próxima vez."
        }
    }
}
