"""Policy Engine: memutuskan allow/deny berdasarkan Tabel 3, konteks (4.3), dan atribut di database.

Prinsip: default deny. Request yang tidak cocok dengan rute mana pun ditolak.
"""
import os
import re
import sys
from datetime import datetime

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

import config
from db import koneksi


def _to_minutes(value):
    try:
        jam, menit = value.split(":", 1)
        return int(jam) * 60 + int(menit)
    except (ValueError, TypeError):
        return 0


def _dalam_jam_akses():
    now = _to_minutes(datetime.now().strftime("%H:%M"))
    mulai = _to_minutes(config.JAM_MULAI)
    selesai = _to_minutes(config.JAM_SELESAI)

    if mulai == selesai:
        return True
    if mulai < selesai:
        return mulai <= now < selesai
    return now >= mulai or now < selesai


def _device_terdaftar(username, device):
    with koneksi() as c:
        return c.execute(
            "SELECT 1 FROM devices WHERE username=? AND device_id=?", (username, device)
        ).fetchone() is not None


def _mengampu(dosen, kelas_id):
    """True jika kelas_id (string angka) diampu oleh dosen tersebut."""
    if not re.fullmatch(r"[0-9]+", str(kelas_id)):
        return False
    with koneksi() as c:
        return c.execute(
            "SELECT 1 FROM kelas WHERE id=? AND dosen=?", (kelas_id, dosen)
        ).fetchone() is not None


def _role_ditolak(role):
    return False, f"role {role} tidak berhak mengakses endpoint ini"


def _lihat_nilai(sub, role, query):
    if role == "mahasiswa":
        return True, "mahasiswa melihat nilai miliknya"
    if role == "dosen":
        kelas_id = query.get("kelas_id")
        if kelas_id is not None and not _mengampu(sub, kelas_id):
            return False, "kelas bukan yang diampu dosen"
        return True, "dosen melihat nilai kelas yang diampu"
    return _role_ditolak(role)


def _ubah_nilai(sub, role, query, nilai_id):
    if role != "dosen":
        return _role_ditolak(role)
    with koneksi() as c:
        row = c.execute(
            "SELECT n.final, k.dosen FROM nilai n JOIN kelas k ON k.id = n.kelas_id WHERE n.id=?",
            (nilai_id,),
        ).fetchone()
    if not row:
        return False, "data nilai tidak ditemukan"
    if row["dosen"] != sub:
        return False, "kelas bukan yang diampu dosen"
    if row["final"]:
        return False, "nilai sudah final"
    if not _dalam_jam_akses():
        return False, f"di luar jam akses ({config.JAM_MULAI}-{config.JAM_SELESAI})"
    return True, "dosen mengubah nilai kelas yang diampu"


def _finalisasi(sub, role, query, kelas_id):
    if role != "dosen":
        return _role_ditolak(role)
    if not _mengampu(sub, kelas_id):
        return False, "kelas bukan yang diampu dosen"
    if not _dalam_jam_akses():
        return False, f"di luar jam akses ({config.JAM_MULAI}-{config.JAM_SELESAI})"
    return True, "dosen memfinalisasi kelas yang diampu"


def _lihat_transkrip(sub, role, query, nim):
    if role == "admin":
        return True, "admin melihat transkrip"
    if role == "mahasiswa":
        with koneksi() as c:
            row = c.execute("SELECT nim FROM users WHERE username=?", (sub,)).fetchone()
        if row and row["nim"] == nim:
            return True, "mahasiswa melihat transkrip sendiri"
        return False, "mahasiswa hanya boleh melihat NIM sendiri"
    return _role_ditolak(role)


def _lihat_audit(sub, role, query):
    if role == "admin":
        return True, "admin melihat audit log"
    return _role_ditolak(role)


def _sinkron(sub, role, query):
    if role == "service":
        return True, "service nilai menyinkronkan transkrip"
    return False, "hanya token service yang boleh menyinkronkan transkrip"


# (metode, pola path, fungsi kebijakan) 
RUTE = [
    ("GET", r"/nilai", _lihat_nilai),
    ("PUT", r"/nilai/([0-9]+)", _ubah_nilai),
    ("POST", r"/kelas/([0-9]+)/finalisasi", _finalisasi),
    ("GET", r"/transkrip/([A-Za-z0-9]+)", _lihat_transkrip),
    ("GET", r"/audit", _lihat_audit),
    ("POST", r"/transkrip/sinkron", _sinkron),
]


def putuskan(sub, role, device, metode, path, query):
    """Kembalikan (allow: bool, alasan: str)."""
    if role != "service" and not _device_terdaftar(sub, device):
        return False, "device tidak terdaftar untuk user ini"
    for metode_rute, pola, fungsi in RUTE:
        if metode_rute == metode:
            cocok = re.fullmatch(pola, path)
            if cocok:
                return fungsi(sub, role, query, *cocok.groups())
    return False, "endpoint tidak dikenal"
