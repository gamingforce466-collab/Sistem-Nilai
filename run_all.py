"""Menjalankan Gateway, Service Nilai, dan Service Transkrip sekaligus."""
import os
import subprocess
import sys
import time

import config
from seed import seed

MODUL = ["service_transkrip.app", "service_nilai.app", "gateway.app"]


def main():
    os.chdir(config.BASE_DIR)
    if not os.path.exists(config.DB_PATH):
        seed()
    print(f"Jam akses aktif: {config.JAM_MULAI}-{config.JAM_SELESAI} (override env: {os.environ.get('JAM_MULAI', '<unset>')} / {os.environ.get('JAM_SELESAI', '<unset>')})")
    proses = [subprocess.Popen([sys.executable, "-m", m]) for m in MODUL]
    print("Sistem Nilai berjalan. Gateway: " + config.GATEWAY_URL + "  (Ctrl+C untuk berhenti)")
    try:
        while all(p.poll() is None for p in proses):
            time.sleep(0.5)
        print("Salah satu komponen berhenti (periksa pesan error / port yang bentrok).")
    except KeyboardInterrupt:
        pass
    finally:
        for p in proses:
            p.terminate()
        for p in proses:
            p.wait()


if __name__ == "__main__":
    main()
