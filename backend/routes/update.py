"""Update endpoints: check GitHub releases and apply a new exe."""

from __future__ import annotations

import os
import threading
import time
from typing import TYPE_CHECKING

from flask import Blueprint, jsonify

from backend.paths import is_frozen
from backend.updater import (
    check_latest_release,
    launch_update_script,
    prepare_update,
    stop_other_instances,
)
from backend.version import APP_VERSION

if TYPE_CHECKING:
    from backend.runtime import RuntimeState


def create_blueprint(state: RuntimeState) -> Blueprint:
    bp = Blueprint("update", __name__)

    @bp.get("/api/update/check")
    def api_update_check():
        info = check_latest_release()
        if info is None:
            return jsonify({
                "current": APP_VERSION,
                "latest": None,
                "update_available": False,
                "error": "No se pudo consultar GitHub (sin releases o sin conexión).",
            })
        return jsonify(info)

    @bp.post("/api/update")
    def api_update_apply():
        if not is_frozen():
            return jsonify({"error": "Solo disponible en el ejecutable empaquetado."}), 400
        info = check_latest_release()
        if info is None:
            return jsonify({"error": "No se pudo consultar GitHub."}), 502
        if not info["update_available"]:
            return jsonify({"ok": True, "updated": False, "message": "Ya estás en la última versión."})
        if not info["download_url"]:
            return jsonify({"error": "El release no incluye el zip de la aplicación."}), 502

        script = prepare_update(info)
        if script is None:
            return jsonify({"error": "Falló la descarga de la actualización."}), 502

        def _restart() -> None:
            time.sleep(1.5)  # dar tiempo a que la respuesta llegue al cliente
            try:
                state.slskd.stop()
            except Exception:
                pass
            stop_other_instances("spotify2soulseek.exe")
            launch_update_script(script)
            os._exit(0)

        threading.Thread(target=_restart, daemon=True).start()
        return jsonify({"ok": True, "updated": True, "version": info["latest"], "restarting": True})

    return bp
