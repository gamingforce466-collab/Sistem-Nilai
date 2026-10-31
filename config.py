"""Konfigurasi terpusat. Semua nilai dapat diubah lewat environment variable."""
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("DB_PATH", os.path.join(BASE_DIR, "data", "sistem_nilai.db"))

# Port dan alamat komponen
PORT_GATEWAY = 3000
PORT_NILAI = 3001
PORT_TRANSKRIP = 3002
GATEWAY_URL = f"http://127.0.0.1:{PORT_GATEWAY}"
NILAI_URL = f"http://127.0.0.1:{PORT_NILAI}"
TRANSKRIP_URL = f"http://127.0.0.1:{PORT_TRANSKRIP}"

# Rahasia (nilai bawaan hanya untuk demo praktikum)
JWT_SECRET = os.environ.get("JWT_SECRET", "jwt-secret-praktikum-zero-trust-32b!")
GATEWAY_SECRET = os.environ.get("GATEWAY_SECRET", "gateway-secret-praktikum-zero-trust")
SERVICE_CLIENT_ID = os.environ.get("SERVICE_CLIENT_ID", "service-nilai")
SERVICE_CLIENT_SECRET = os.environ.get("SERVICE_CLIENT_SECRET", "service-nilai-secret-praktikum")

# Masa berlaku token
ACCESS_TOKEN_MENIT = 10
REFRESH_TOKEN_HARI = 1
SERVICE_TOKEN_MENIT = 5

# Jam akses (format HH:MM) untuk mengubah dan memfinalisasi nilai.
# Kembali ke default 00:00-23:59 supaya semua request user diizinkan sesuai demo,
# kecuali app dijalankan dengan override environment variable.
JAM_MULAI = (os.environ.get("JAM_MULAI") or "00:00").strip()
JAM_SELESAI = (os.environ.get("JAM_SELESAI") or "23:59").strip()