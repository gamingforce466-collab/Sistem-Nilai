"""Membuat skema database dan data awal. Menjalankan file ini mereset seluruh data."""
import os

from werkzeug.security import generate_password_hash

import config
from db import koneksi

SKEMA = """
CREATE TABLE users (
    username TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    nama TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('mahasiswa', 'dosen', 'admin')),
    nim TEXT UNIQUE
);
CREATE TABLE devices (
    username TEXT NOT NULL REFERENCES users(username),
    device_id TEXT NOT NULL,
    PRIMARY KEY (username, device_id)
);
CREATE TABLE kelas (
    id INTEGER PRIMARY KEY,
    nama TEXT NOT NULL,
    dosen TEXT NOT NULL REFERENCES users(username)
);
CREATE TABLE nilai (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kelas_id INTEGER NOT NULL REFERENCES kelas(id),
    mahasiswa TEXT NOT NULL REFERENCES users(username),
    nilai REAL NOT NULL,
    final INTEGER NOT NULL DEFAULT 0,
    UNIQUE (kelas_id, mahasiswa)
);
CREATE TABLE transkrip (
    nim TEXT NOT NULL,
    kelas_id INTEGER NOT NULL,
    mata_kuliah TEXT NOT NULL,
    nilai REAL NOT NULL,
    PRIMARY KEY (nim, kelas_id)
);
CREATE TABLE refresh_tokens (
    token TEXT PRIMARY KEY,
    username TEXT NOT NULL REFERENCES users(username),
    expires_at TEXT NOT NULL,
    revoked INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    waktu TEXT NOT NULL,
    subjek TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    device TEXT,
    hasil TEXT NOT NULL,
    alasan TEXT NOT NULL
);
"""

# username, password, nama, role, nim
USERS = [
    ("admin", "admin123", "Administrator Prodi", "admin", None),
    ("dosen1", "dosen123", "Dr. Budi Santoso", "dosen", None),
    ("dosen2", "dosen123", "Dr. Siti Rahma", "dosen", None),
    ("mhs1", "mhs123", "Andi Pratama", "mahasiswa", "2210001"),
    ("mhs2", "mhs123", "Rina Wulandari", "mahasiswa", "2210002"),
    ("mhs3", "mhs123", "Dewi Lestari", "mahasiswa", "2210003"),
]
DEVICES = [
    ("admin", "DEV-ADMIN-01"),
    ("dosen1", "DEV-DOSEN1-01"),
    ("dosen2", "DEV-DOSEN2-01"),
    ("mhs1", "DEV-MHS1-01"),
    ("mhs2", "DEV-MHS2-01"),
    ("mhs3", "DEV-MHS3-01"),
]
KELAS = [(1, "Keamanan Informasi", "dosen1"), (2, "Basis Data", "dosen2")]
# kelas_id, mahasiswa, nilai  -> id nilai 1..6 sesuai urutan
NILAI = [
    (1, "mhs1", 85), (1, "mhs2", 78), (1, "mhs3", 90),
    (2, "mhs1", 80), (2, "mhs2", 88), (2, "mhs3", 75),
]


def seed():
    os.makedirs(os.path.dirname(config.DB_PATH), exist_ok=True)
    for akhiran in ("", "-wal", "-shm"):
        if os.path.exists(config.DB_PATH + akhiran):
            os.remove(config.DB_PATH + akhiran)
    with koneksi() as c:
        c.execute("PRAGMA journal_mode=WAL")  # tiga proses berbagi satu database
        c.executescript(SKEMA)
        c.executemany(
            "INSERT INTO users VALUES (?,?,?,?,?)",
            [(u, generate_password_hash(p), n, r, nim) for u, p, n, r, nim in USERS],
        )
        c.executemany("INSERT INTO devices VALUES (?,?)", DEVICES)
        c.executemany("INSERT INTO kelas VALUES (?,?,?)", KELAS)
        c.executemany("INSERT INTO nilai(kelas_id, mahasiswa, nilai) VALUES (?,?,?)", NILAI)
    print(f"Database dibuat: {config.DB_PATH}")


if __name__ == "__main__":
    seed()
