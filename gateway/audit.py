"""Audit log: setiap keputusan akses dicatat oleh gateway."""
from datetime import datetime

from db import koneksi


def catat(subjek, endpoint, device, hasil, alasan):
    waktu = datetime.now().astimezone().isoformat(timespec="seconds")
    with koneksi() as c:
        c.execute(
            "INSERT INTO audit_log(waktu, subjek, endpoint, device, hasil, alasan) VALUES (?,?,?,?,?,?)",
            (waktu, subjek, endpoint, device, hasil, alasan),
        )
