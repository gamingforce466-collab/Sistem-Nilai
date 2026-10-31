"""Koneksi SQLite. Satu koneksi pendek per operasi agar tidak ada lock yang tertahan."""
import sqlite3
from contextlib import contextmanager

import config


@contextmanager
def koneksi():
    conn = sqlite3.connect(config.DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()
