"""Service Transkrip (port 3002): data transkrip mahasiswa. Hanya dapat diakses lewat gateway."""
import os
import sys

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from flask import Flask, g, jsonify

import config
from common import badan_json, pasang_verifikasi
from db import koneksi

app = Flask(__name__)
pasang_verifikasi(app)


@app.get("/transkrip/<nim>")
def lihat_transkrip(nim):
    with koneksi() as c:
        baris = c.execute(
            "SELECT kelas_id, mata_kuliah, nilai FROM transkrip WHERE nim=? ORDER BY kelas_id", (nim,)
        ).fetchall()
    return jsonify(nim=nim, transkrip=[dict(b) for b in baris])


@app.post("/transkrip/sinkron")
def sinkron():
    if g.token["role"] != "service":  # token user mana pun ditolak
        return jsonify(error="hanya token service yang diizinkan"), 403
    data = badan_json()
    try:
        baris = [(i["nim"], data["kelas_id"], data["mata_kuliah"], float(i["nilai"]))
                 for i in data["nilai"]]
    except (KeyError, TypeError, ValueError):
        return jsonify(error="payload tidak valid"), 400
    with koneksi() as c:
        c.executemany(
            "INSERT INTO transkrip(nim, kelas_id, mata_kuliah, nilai) VALUES (?,?,?,?) "
            "ON CONFLICT(nim, kelas_id) DO UPDATE SET mata_kuliah=excluded.mata_kuliah, nilai=excluded.nilai",
            baris)
    return jsonify(pesan="transkrip disinkronkan", jumlah=len(baris))


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=config.PORT_TRANSKRIP, threaded=True)
