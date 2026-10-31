"""Policy Administrator: login, refresh, logout, dan penerbitan token.

Setiap fungsi menerima (data, device) dan mengembalikan (status, body, subjek, alasan).
"""
import hmac
import os
import secrets
import sys
from datetime import datetime, timedelta, timezone

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

import jwt
from werkzeug.security import check_password_hash

import config
from db import koneksi


def _buat_token(sub, role, menit):
    sekarang = datetime.now(timezone.utc)
    payload = {"sub": sub, "role": role, "iat": sekarang, "exp": sekarang + timedelta(minutes=menit)}
    return jwt.encode(payload, config.JWT_SECRET, algorithm="HS256")


def _sama(a, b):
    return isinstance(a, str) and hmac.compare_digest(a.encode(), b.encode())


def login(data, device):
    username, password = data.get("username"), data.get("password")
    subjek = username if isinstance(username, str) else "-"
    if not isinstance(username, str) or not isinstance(password, str):
        return 400, {"error": "username dan password wajib diisi"}, subjek, "body tidak lengkap"
    with koneksi() as c:
        user = c.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()
        if not user or not check_password_hash(user["password_hash"], password):
            return 401, {"error": "kredensial tidak valid"}, subjek, "kredensial tidak valid"
        terdaftar = c.execute(
            "SELECT 1 FROM devices WHERE username=? AND device_id=?", (username, device)
        ).fetchone()
        if not terdaftar:
            return 403, {"error": "device tidak terdaftar"}, subjek, "device tidak terdaftar"
        refresh = secrets.token_urlsafe(32)
        kedaluwarsa = datetime.now(timezone.utc) + timedelta(days=config.REFRESH_TOKEN_HARI)
        c.execute(
            "INSERT INTO refresh_tokens(token, username, expires_at) VALUES (?,?,?)",
            (refresh, username, kedaluwarsa.isoformat()),
        )
    body = {
        "access_token": _buat_token(username, user["role"], config.ACCESS_TOKEN_MENIT),
        "refresh_token": refresh,
        "token_type": "Bearer",
        "expires_in": config.ACCESS_TOKEN_MENIT * 60,
    }
    return 200, body, subjek, "login berhasil"


def _refresh_valid(data):
    """Kembalikan (baris refresh token + role, alasan_gagal)."""
    token = data.get("refresh_token")
    if not isinstance(token, str):
        return None, "refresh token tidak ada"
    with koneksi() as c:
        row = c.execute(
            "SELECT r.token, r.username, r.expires_at, r.revoked, u.role "
            "FROM refresh_tokens r JOIN users u ON u.username = r.username WHERE r.token=?",
            (token,),
        ).fetchone()
    if not row:
        return None, "refresh token tidak dikenal"
    if row["revoked"]:
        return None, "refresh token sudah dicabut"
    if datetime.fromisoformat(row["expires_at"]) < datetime.now(timezone.utc):
        return None, "refresh token kedaluwarsa"
    return row, None


def refresh(data, device):
    row, gagal = _refresh_valid(data)
    if gagal:
        return 401, {"error": gagal}, "-", gagal
    body = {
        "access_token": _buat_token(row["username"], row["role"], config.ACCESS_TOKEN_MENIT),
        "token_type": "Bearer",
        "expires_in": config.ACCESS_TOKEN_MENIT * 60,
    }
    return 200, body, row["username"], "access token baru diterbitkan"


def logout(data, device):
    row, gagal = _refresh_valid(data)
    if gagal:
        return 401, {"error": gagal}, "-", gagal
    with koneksi() as c:
        c.execute("UPDATE refresh_tokens SET revoked=1 WHERE token=?", (row["token"],))
    return 200, {"pesan": "logout berhasil, refresh token dicabut"}, row["username"], "refresh token dicabut"


def service(data, device):
    client_id, secret = data.get("client_id"), data.get("client_secret")
    subjek = client_id if isinstance(client_id, str) else "-"
    if not (_sama(client_id, config.SERVICE_CLIENT_ID) and _sama(secret, config.SERVICE_CLIENT_SECRET)):
        return 401, {"error": "client ID atau secret tidak valid"}, subjek, "client service tidak valid"
    body = {
        "access_token": _buat_token(client_id, "service", config.SERVICE_TOKEN_MENIT),
        "token_type": "Bearer",
        "expires_in": config.SERVICE_TOKEN_MENIT * 60,
    }
    return 200, body, subjek, "token service diterbitkan"
