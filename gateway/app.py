"""API Gateway (port 3000) = Policy Enforcement Point. Satu-satunya pintu masuk sistem."""
import os
import sys

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

import jwt
import requests
from flask import Flask, Response, jsonify, request, send_from_directory

import config
from common import badan_json, decode_token, ambil_bearer, http
from db import koneksi
from gateway import audit, auth, policy

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

METODE = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]
AUTH = {
    ("POST", "/auth/login"): auth.login,
    ("POST", "/auth/refresh"): auth.refresh,
    ("POST", "/auth/logout"): auth.logout,
    ("POST", "/auth/service"): auth.service,
}
SERVICE = {"nilai": config.NILAI_URL, "kelas": config.NILAI_URL, "transkrip": config.TRANSKRIP_URL}


@app.before_request
def preflight_options():
    if request.method == "OPTIONS":
        response = app.make_response("")
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Device-ID, X-Gateway-Secret"
        response.headers["Access-Control-Max-Age"] = "600"
        return response


@app.route("/ui", defaults={"path": "index.html"}, methods=METODE, provide_automatic_options=False)
@app.route("/ui/<path:path>", methods=METODE, provide_automatic_options=False)
def serve_ui(path):
    if request.method == "OPTIONS":
        return preflight_options()
    try:
        return send_from_directory(FRONTEND_DIR, path)
    except Exception:
        return send_from_directory(FRONTEND_DIR, "index.html")


def tolak(subjek, endpoint, device, status, alasan):
    audit.catat(subjek, endpoint, device, "deny", alasan)
    return jsonify(error=alasan), status


def teruskan(path):
    """Teruskan request ke service dengan X-Gateway-Secret dan token asli."""
    url = SERVICE[path.split("/")[1]] + path
    headers = {
        "Authorization": request.headers["Authorization"],
        "Content-Type": request.headers.get("Content-Type", "application/json"),
        "X-Gateway-Secret": config.GATEWAY_SECRET,
    }
    try:
        r = http.request(request.method, url, params=request.args, data=request.get_data(),
                         headers=headers, timeout=10)
    except requests.RequestException:
        return jsonify(error="service tidak dapat dihubungi"), 502
    return Response(r.content, r.status_code, content_type=r.headers.get("Content-Type"))


@app.route("/", defaults={"path": ""}, methods=METODE, provide_automatic_options=False)
@app.route("/<path:path>", methods=METODE, provide_automatic_options=False)
def gateway(path):
    path = "/" + path
    endpoint = f"{request.method} {path}"
    device = request.headers.get("X-Device-ID")

    if path.startswith("/auth/"):
        handler = AUTH.get((request.method, path))
        if not handler:
            return tolak("-", endpoint, device, 404, "endpoint tidak dikenal")
        status, body, subjek, alasan = handler(badan_json(), device)
        audit.catat(subjek, endpoint, device, "allow" if status < 400 else "deny", alasan)
        return jsonify(body), status

    if path == "/audit" and request.method == "GET":
        try:
            payload = decode_token(ambil_bearer())
        except jwt.ExpiredSignatureError:
            return tolak("-", endpoint, device, 401, "token kedaluwarsa")
        except jwt.PyJWTError:
            return tolak("-", endpoint, device, 401, "token tidak ada atau tidak valid")
        sub, role = payload["sub"], payload["role"]
        boleh, alasan = policy.putuskan(sub, role, device, request.method, path, request.args)
        if not boleh:
            return tolak(sub, endpoint, device, 403, alasan)
        with koneksi() as c:
            sql = "SELECT waktu, subjek, endpoint, device, hasil, alasan FROM audit_log"
            params = []
            if request.args.get("result"):
                sql += " WHERE hasil=?"
                params.append(request.args.get("result"))
            if request.args.get("subject"):
                if params:
                    sql += " AND subjek LIKE ?"
                else:
                    sql += " WHERE subjek LIKE ?"
                params.append(f"%{request.args.get('subject')}%")
            sql += " ORDER BY id DESC LIMIT 200"
            rows = c.execute(sql, params).fetchall()
        body = {"audit": [dict(r) for r in rows]}
        audit.catat(sub, endpoint, device, "allow", alasan)
        return jsonify(body)

    try:
        payload = decode_token(ambil_bearer())
    except jwt.ExpiredSignatureError:
        return tolak("-", endpoint, device, 401, "token kedaluwarsa")
    except jwt.PyJWTError:
        return tolak("-", endpoint, device, 401, "token tidak ada atau tidak valid")

    sub, role = payload["sub"], payload["role"]
    boleh, alasan = policy.putuskan(sub, role, device, request.method, path, request.args)
    if not boleh:
        return tolak(sub, endpoint, device, 403, alasan)
    audit.catat(sub, endpoint, device, "allow", alasan)
    return teruskan(path)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=config.PORT_GATEWAY, threaded=True)
