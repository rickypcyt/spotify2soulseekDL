"""Duración y bitrate de un archivo de audio, con caché por (ruta, tamaño, mtime).

Leer las cabeceras es barato, pero diagnostics se pide cada pocos segundos: sin caché
la biblioteca entera se reanalizaría en cada sondeo.
"""

from __future__ import annotations

import os
import threading

from mutagen import File as MutagenFile

_cache: dict[tuple[str, int, float], dict[str, float | int | None]] = {}
_lock = threading.Lock()
_EMPTY: dict[str, float | int | None] = {"duration": None, "bitrate": None}


def audio_info(path: str) -> dict[str, float | int | None]:
    try:
        stat = os.stat(path)
    except OSError:
        return dict(_EMPTY)
    key = (path, stat.st_size, stat.st_mtime)
    with _lock:
        cached = _cache.get(key)
    if cached is not None:
        return dict(cached)
    result = dict(_EMPTY)
    try:
        audio = MutagenFile(path)
        info = getattr(audio, "info", None)
        duration = float(getattr(info, "length", 0) or 0)
        if duration > 0:
            bitrate = getattr(info, "bitrate", None) or int(stat.st_size * 8 / duration)
            result = {"duration": round(duration, 2), "bitrate": int(bitrate)}
    except Exception:
        pass
    with _lock:
        _cache[key] = result
    return dict(result)
