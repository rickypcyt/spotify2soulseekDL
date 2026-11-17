import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

import requests

from backend.audio_conversion import AudioConversionError, _ffmpeg_executable
from backend.paths import app_root, exe_dir


class YouTubeServiceError(RuntimeError):
    """Raised when a YouTube download fails."""

YTDLP_DOWNLOAD_URL = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"


def _is_youtube_url(url: str) -> bool:
    return bool(re.match(r"^(https?://)?(www\.)?(youtube\.com/watch\?|youtu\.be/)", url, re.IGNORECASE))


def _ytdlp_dir() -> Path:
    """Dónde vive el yt-dlp auto-descargado: junto al .exe (actualizable con
    ``yt-dlp -U``) o en vendor/ durante el desarrollo."""
    if getattr(sys, "frozen", False):
        return exe_dir()
    return app_root() / "vendor" / "yt-dlp"


def _find_ytdlp() -> str:
    candidates = [str(_ytdlp_dir() / "yt-dlp.exe")]
    if not getattr(sys, "frozen", False):
        candidates.extend([
            str(Path(sys.executable).parent / "yt-dlp.exe"),
            str(Path(sys.executable).parent / "yt-dlp"),
        ])
    candidates.extend(["yt-dlp", "yt-dlp.exe"])
    for candidate in candidates:
        resolved = shutil.which(candidate) or candidate
        try:
            result = subprocess.run([resolved, "--version"], capture_output=True, check=False, timeout=5)
            if result.returncode == 0:
                return resolved
        except (FileNotFoundError, OSError):
            continue
    raise YouTubeServiceError("No se encontró yt-dlp. Instalalo con: python -m pip install -U yt-dlp")


def _download_ytdlp() -> str | None:
    """Descarga el binario oficial de yt-dlp (mismo patrón que slskd)."""
    if sys.platform != "win32":
        return None
    target = _ytdlp_dir() / "yt-dlp.exe"
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        response = requests.get(YTDLP_DOWNLOAD_URL, stream=True, timeout=120)
        response.raise_for_status()
        with target.open("wb") as handle:
            for chunk in response.iter_content(chunk_size=1024 * 256):
                if chunk:
                    handle.write(chunk)
        result = subprocess.run([str(target), "--version"], capture_output=True, check=False, timeout=15)
        if result.returncode == 0:
            return str(target)
    except (OSError, requests.RequestException):
        pass
    target.unlink(missing_ok=True)
    return None


def ensure_ytdlp() -> str:
    """Localiza yt-dlp y, si no está, descarga el binario oficial una sola vez."""
    try:
        return _find_ytdlp()
    except YouTubeServiceError:
        pass
    downloaded = _download_ytdlp()
    if downloaded:
        return downloaded
    raise YouTubeServiceError(
        "No se encontró yt-dlp y no se pudo descargar automáticamente. "
        "Instalalo con: python -m pip install -U yt-dlp"
    )


def _ffmpeg_location() -> str | None:
    try:
        return _ffmpeg_executable()
    except AudioConversionError:
        return None


DENO_DOWNLOAD_URL = "https://github.com/denoland/deno/releases/latest/download/deno-x86_64-pc-windows-msvc.zip"


def _download_deno() -> str | None:
    """YouTube exige un runtime de JavaScript para resolver los desafíos de
    firma; sin él yt-dlp termina en 403. Se baja deno una sola vez."""
    if sys.platform != "win32":
        return None
    import io
    import zipfile

    target = _ytdlp_dir() / "deno.exe"
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        response = requests.get(DENO_DOWNLOAD_URL, timeout=180)
        response.raise_for_status()
        with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
            target.write_bytes(archive.read("deno.exe"))
        return str(target)
    except (OSError, KeyError, zipfile.BadZipFile, requests.RequestException):
        target.unlink(missing_ok=True)
        return None


def _find_js_runtime() -> tuple[str, str] | None:
    local_deno = _ytdlp_dir() / "deno.exe"
    if local_deno.is_file():
        return "deno", str(local_deno)
    for runtime, executable in (("deno", "deno"), ("node", "node"), ("bun", "bun"), ("quickjs", "qjs")):
        path = shutil.which(executable)
        if path:
            return runtime, path
    downloaded = _download_deno()
    return ("deno", downloaded) if downloaded else None


def _youtube_options(ytdlp: str) -> list[str]:
    help_result = subprocess.run([ytdlp, "--help"], capture_output=True, text=True, timeout=15, check=False)
    help_text = f"{help_result.stdout}\n{help_result.stderr}"
    options = ["--no-update"]
    found = _find_js_runtime()
    if found:
        runtime, path = found
        if "--js-runtimes" in help_text:
            options.extend(["--js-runtimes", f"{runtime}:{path}"])
    if "--remote-components" in help_text:
        options.extend(["--remote-components", "ejs:github"])
    return options


def _update_ytdlp(ytdlp: str) -> bool:
    """Actualiza yt-dlp: pip cuando corre dentro del venv, self-update si es
    un binario suelto. Devuelve True si alguna vía salió bien."""
    commands = []
    if not getattr(sys, "frozen", False):
        commands.append([sys.executable, "-m", "pip", "install", "-U", "yt-dlp"])
    commands.append([ytdlp, "-U"])
    for command in commands:
        try:
            result = subprocess.run(command, capture_output=True, text=True, timeout=300, check=False)
        except (OSError, subprocess.TimeoutExpired):
            continue
        if result.returncode == 0:
            return True
    return False


def _download_error(result: subprocess.CompletedProcess[str]) -> str:
    details = (result.stderr or result.stdout).strip()
    if "HTTP Error 403" in details:
        details += "\nActualizá yt-dlp con: python -m pip install -U yt-dlp"
    return details or "Error desconocido al descargar YouTube"


def download_youtube_audio(url: str, output_dir: Path, audio_format: str = "flac") -> Path:
    if not _is_youtube_url(url):
        raise YouTubeServiceError("La URL no parece ser de YouTube.")

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    start_time = time.time()
    ytdlp = ensure_ytdlp()
    template = str(output_dir / f"%(title)s.{audio_format}")
    ffmpeg = _ffmpeg_location()

    def build_command(binary: str) -> list[str]:
        command = [
            binary,
            *_youtube_options(binary),
        ]
        if ffmpeg:
            command.extend(["--ffmpeg-location", ffmpeg])
        command.extend([
            "--no-playlist",
            "--no-progress",
            "--print",
            "after_move:filepath",
            "-x",
            "--audio-format",
            audio_format,
            "--audio-quality",
            "0",
            "-o",
            template,
            url,
        ])
        return command

    def run(command: list[str]) -> subprocess.CompletedProcess[str]:
        try:
            return subprocess.run(command, capture_output=True, text=True, timeout=600, check=False)
        except subprocess.TimeoutExpired as exc:
            raise YouTubeServiceError("La descarga de YouTube tardó demasiado.") from exc

    result = run(build_command(ytdlp))
    # YouTube cambia seguido y un yt-dlp viejo falla con 403: actualizar
    # y reintentar una vez antes de rendirse.
    if result.returncode != 0 and _update_ytdlp(ytdlp):
        ytdlp = _find_ytdlp()
        result = run(build_command(ytdlp))
    if result.returncode != 0:
        raise YouTubeServiceError(_download_error(result))

    printed_paths = [Path(line.strip()) for line in result.stdout.splitlines() if line.strip()]
    for target_path in reversed(printed_paths):
        if target_path.is_file():
            return target_path

    files = [p for p in output_dir.iterdir() if p.is_file() and p.stat().st_mtime > start_time]
    if not files:
        raise YouTubeServiceError("No se encontró el archivo descargado")
    return max(files, key=lambda p: p.stat().st_mtime)
