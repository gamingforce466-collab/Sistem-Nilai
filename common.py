"""Fungsi bersama gateway dan service: verifikasi token, gateway secret, HTTP client internal."""
import hmac

import jwt
import requests
from flask import g, jsonify, request

import config

# Panggilan antar-komponen tidak boleh lewat proxy dari environment.
http = requests.Session()
http.trust_env = False


def badan_json():
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


def ambil_bearer():
    skema, _, token = request.headers.get("Authorization", "").partition(" ")
    return token if skema == "Bearer" else ""


def decode_token(token):
    """Verifikasi tanda tangan dan masa berlaku. Melempar jwt.PyJWTError jika tidak valid."""
    return jwt.decode(
        token, config.JWT_SECRET, algorithms=["HS256"],
        options={"require": ["exp", "sub", "role"]},
    )


def pasang_verifikasi(app):
    """Dipakai kedua service: tolak request tanpa gateway secret atau tanpa token valid."""
    @app.before_request
    def verifikasi():
        rahasia = request.headers.get("X-Gateway-Secret", "")
        if not hmac.compare_digest(rahasia.encode(), config.GATEWAY_SECRET.encode()):
            return jsonify(error="ditolak: gateway secret tidak valid"), 403
        try:
            g.token = decode_token(ambil_bearer())
        except jwt.PyJWTError:
            return jsonify(error="ditolak: token tidak valid atau kedaluwarsa"), 401
