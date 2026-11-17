"""Network diagnostics: tells a blocked network apart from other Soulseek failures."""

from __future__ import annotations

import socket
import time
from concurrent.futures import ThreadPoolExecutor
from typing import TYPE_CHECKING

from flask import Blueprint, jsonify

if TYPE_CHECKING:
    from backend.runtime import RuntimeState

SOULSEEK_HOST = "server.slsknet.org"
SOULSEEK_PORT = 2271
# Un destino web cualquiera: si éste conecta, hay internet aunque el 2271 no.
CONTROL_HOST = "1.1.1.1"
CONTROL_PORT = 443
TIMEOUT = 5.0


def _resolve(host: str) -> dict:
    started = time.monotonic()
    try:
        address = socket.gethostbyname(host)
        return {"ok": True, "detail": address, "ms": round((time.monotonic() - started) * 1000)}
    except OSError as exc:
        return {"ok": False, "detail": str(exc), "ms": round((time.monotonic() - started) * 1000)}


def _connect(host: str, port: int) -> dict:
    started = time.monotonic()
    try:
        with socket.create_connection((host, port), timeout=TIMEOUT):
            pass
        return {"ok": True, "detail": "conexión establecida", "ms": round((time.monotonic() - started) * 1000)}
    except socket.timeout:
        return {"ok": False, "detail": "sin respuesta (timeout)", "ms": round((time.monotonic() - started) * 1000)}
    except OSError as exc:
        return {"ok": False, "detail": str(exc), "ms": round((time.monotonic() - started) * 1000)}


def check_soulseek_network() -> dict:
    with ThreadPoolExecutor(max_workers=3) as pool:
        dns_future = pool.submit(_resolve, SOULSEEK_HOST)
        control_future = pool.submit(_connect, CONTROL_HOST, CONTROL_PORT)
        server_future = pool.submit(_connect, SOULSEEK_HOST, SOULSEEK_PORT)
        dns, control, server = dns_future.result(), control_future.result(), server_future.result()

    if server["ok"]:
        verdict = "ok"
        message = (
            "Tu red llega al servidor de Soulseek (puerto 2271). Si slskd sigue sin conectar, "
            "el problema no es la red: revisa usuario y contraseña de Soulseek en Configuración."
        )
    elif not control["ok"]:
        verdict = "no_internet"
        message = "No hay conexión a internet (ni siquiera a un sitio web normal). Revisa tu wifi o cable."
    elif not dns["ok"]:
        verdict = "dns"
        message = "Tu red no resuelve el nombre del servidor de Soulseek. Prueba con otra red o cambia el DNS."
    else:
        verdict = "port_blocked"
        message = (
            "Hay internet y el servidor existe, pero tu red bloquea el puerto 2271. "
            "Es típico de eduroam, wifis de universidad o trabajo y firewalls. "
            "Prueba con otra red (hotspot del celular) o una VPN."
        )
    return {
        "verdict": verdict,
        "message": message,
        "checks": {
            "dns": {"label": f"DNS · {SOULSEEK_HOST}", **dns},
            "internet": {"label": f"Internet · {CONTROL_HOST}:{CONTROL_PORT}", **control},
            "soulseek": {"label": f"Soulseek · {SOULSEEK_HOST}:{SOULSEEK_PORT}", **server},
        },
    }


def create_blueprint(state: RuntimeState) -> Blueprint:
    bp = Blueprint("network", __name__)

    @bp.route("/api/network/soulseek-check", methods=["POST"])
    def api_soulseek_check():
        return jsonify(check_soulseek_network())

    return bp
