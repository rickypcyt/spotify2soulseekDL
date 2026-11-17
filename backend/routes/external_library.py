"""Solo lectura: explorar otra carpeta como si fuera una biblioteca.

Nada de lo que hay aquí escribe en la base de datos, en la configuración ni
en la carpeta principal de descargas. Solo lista, reproduce y lee portadas.
"""

from __future__ import annotations

import mimetypes
import os
from typing import TYPE_CHECKING

from flask import Blueprint, Response, abort, jsonify, request

from backend.fs_utils import safe_join, serve_file_range
from backend.library_service import extract_embedded_cover

if TYPE_CHECKING:
    from backend.runtime import RuntimeState

AUDIO_EXTENSIONS = {".mp3", ".flac", ".wav", ".aiff", ".aif", ".m4a", ".mp4", ".aac", ".ogg", ".opus", ".wma", ".webm"}
MAX_FILES = 20000


def _resolve_root(raw: str) -> str:
    candidate = os.path.abspath(os.path.expanduser(str(raw or "").strip().strip('"')))
    if not raw or not os.path.isdir(candidate):
        raise ValueError("La carpeta no existe o no es un directorio")
    return candidate


def _is_audio(path: str) -> bool:
    return os.path.splitext(path)[1].lower() in AUDIO_EXTENSIONS


def create_blueprint(state: RuntimeState) -> Blueprint:
    bp = Blueprint("external_library", __name__)

    @bp.route("/api/library/external/scan", methods=["POST"])
    def api_external_scan():
        data = request.get_json() or {}
        try:
            root = _resolve_root(data.get("root", ""))
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

        folders: list[str] = []
        files: list[dict] = []
        truncated = False
        for current, dirnames, filenames in os.walk(root):
            dirnames[:] = sorted(name for name in dirnames if not name.startswith("."))
            rel_dir = os.path.relpath(current, root).replace("\\", "/")
            if rel_dir != ".":
                folders.append(rel_dir)
            for name in sorted(filenames):
                if not _is_audio(name):
                    continue
                full = os.path.join(current, name)
                try:
                    size = os.path.getsize(full)
                except OSError:
                    continue
                rel = name if rel_dir == "." else f"{rel_dir}/{name}"
                files.append({"path": rel, "name": name, "size": size})
                if len(files) >= MAX_FILES:
                    truncated = True
                    break
            if truncated:
                break

        same_as_base = os.path.normcase(root) == os.path.normcase(os.path.abspath(state.current_downloads_dir))
        return jsonify({
            "ok": True,
            "root": root,
            "folders": folders,
            "files": files,
            "truncated": truncated,
            "is_base": same_as_base,
        })

    def _audio_file(root_raw: str, rel_raw: str) -> str:
        try:
            root = _resolve_root(root_raw)
            full = safe_join(root, str(rel_raw or "").strip())
        except ValueError:
            abort(403)
        if not os.path.isfile(full) or not _is_audio(full):
            abort(404)
        return full

    @bp.route("/api/library/external/stream")
    def api_external_stream():
        full = _audio_file(request.args.get("root", ""), request.args.get("path", ""))
        mimetype = mimetypes.guess_type(full)[0] or "application/octet-stream"
        return serve_file_range(full, mimetype)

    @bp.route("/api/library/external/cover")
    def api_external_cover():
        full = _audio_file(request.args.get("root", ""), request.args.get("path", ""))
        cover = extract_embedded_cover(full)
        if not cover:
            return jsonify({"error": "El archivo no contiene portada embebida"}), 404
        data, mime = cover
        return Response(data, mimetype=mime, headers={"Cache-Control": "public, max-age=3600"})

    return bp
