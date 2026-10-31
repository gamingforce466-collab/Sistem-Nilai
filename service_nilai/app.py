"""Service Nilai (port 3001): data nilai dan kelas. Hanya dapat diakses lewat gateway."""
import os
import sys

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from flask import Flask, g, jsonify, request
from requests import RequestException

import config
from common import badan_json, http, pasang_verifikasi
from db import koneksi

app = Flask(__name__)
pasang_verifikasi(app)


@app.get("/nilai")
def lihat_nilai():
    sub, role = g.token["sub"], g.token["role"]
    sql = ("SELECT n.id, n.kelas_id, k.nama AS kelas, u.nim, u.nama AS mahasiswa, n.nilai, n.final "
           "FROM nilai n JOIN kelas k ON k.id = n.kelas_id JOIN users u ON u.username = n.mahasiswa WHERE ")
    if role == "mahasiswa":
        sql, args = sql + "n.mahasiswa = ?", [sub]
    elif role == "dosen":
        sql, args = sql + "k.dosen = ?", [sub]
        if request.args.get("kelas_id") is not None:
            sql, args = sql + " AND k.id = ?", args + [request.args["kelas_id"]]
    else:
        return jsonify(error="role tidak berhak melihat nilai"), 403
    with koneksi() as c:
        baris = [dict(r, final=bool(r["final"])) for r in c.execute(sql + " ORDER BY n.id", args)]
    return jsonify(nilai=baris)


@app.put("/nilai/<int:nilai_id>")
def ubah_nilai(nilai_id):
    nilai = badan_json().get("nilai")
    if isinstance(nilai, bool) or not isinstance(nilai, (int, float)) or not 0 <= nilai <= 100:
        return jsonify(error="nilai harus berupa angka 0-100"), 400
    with koneksi() as c:
        diubah = c.execute("UPDATE nilai SET nilai=? WHERE id=? AND final=0", (nilai, nilai_id)).rowcount
    if not diubah:
        return jsonify(error="nilai tidak ditemukan atau sudah final"), 409
    return jsonify(pesan="nilai diperbarui", id=nilai_id, nilai=nilai)


def _token_service():
    """Ambil token service dari gateway (POST /auth/service)."""
    r = http.post(f"{config.GATEWAY_URL}/auth/service", timeout=10, json={
        "client_id": config.SERVICE_CLIENT_ID, "client_secret": config.SERVICE_CLIENT_SECRET})
    r.raise_for_status()
    return r.json()["access_token"]


@app.post("/kelas/<int:kelas_id>/finalisasi")
def finalisasi(kelas_id):
    with koneksi() as c:
        kelas = c.execute("SELECT nama FROM kelas WHERE id=?", (kelas_id,)).fetchone()
        if not kelas:
            return jsonify(error="kelas tidak ditemukan"), 404
        c.execute("UPDATE nilai SET final=1 WHERE kelas_id=?", (kelas_id,))
        baris = c.execute(
            "SELECT u.nim, n.nilai FROM nilai n JOIN users u ON u.username = n.mahasiswa "
            "WHERE n.kelas_id=?", (kelas_id,)).fetchall()
    # Transaksi sudah selesai sebelum memanggil gateway (menghindari lock database).
    payload = {"kelas_id": kelas_id, "mata_kuliah": kelas["nama"],
               "nilai": [{"nim": b["nim"], "nilai": b["nilai"]} for b in baris]}
    try:
        token = _token_service()
        r = http.post(
            f"{config.GATEWAY_URL}/transkrip/sinkron",
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        r.raise_for_status()
    except RequestException as e:
        return jsonify(error="nilai sudah final tetapi sinkron transkrip gagal, ulangi finalisasi",
                       detail=str(e)), 502
    return jsonify(pesan="kelas difinalisasi dan transkrip disinkronkan", kelas_id=kelas_id,
                   sinkron=r.json())

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=config.PORT_NILAI, threaded=True)
