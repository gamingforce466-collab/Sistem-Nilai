# Sistem Nilai Zero Trust

Sistem Nilai adalah aplikasi demo tugas praktikum Keamanan Informasi yang mengimplementasikan prinsip zero trust: never trust, always verify, least privilege, dan assume breach. Aplikasi ini menempatkan API Gateway sebagai Policy Enforcement Point (PEP) sesuai pendekatan NIST SP 800-207, sehingga semua akses menuju service harus melalui pemeriksaan gatekeeper, bukan langsung dipercaya dari client.

Tujuan proyek ini adalah mencontohkan kontrol akses berbasis token, device, kepemilikan data, role, jam akses, dan audit log dalam arsitektur layanan aplikasi yang minimal namun representatif.

## 1. Arsitektur

```text
Client / Browser / curl
    │
    ▼
API Gateway :3000 (PEP + Policy Engine + Audit Log)
    ├── POST /auth/login
    ├── POST /auth/refresh
    ├── POST /auth/logout
    ├── POST /auth/service
    ├── GET /nilai
    ├── PUT /nilai/<id>
    ├── POST /kelas/<id>/finalisasi
    ├── GET /transkrip/<nim>
    └── GET /audit
    │
    ├──► Service Nilai :3001
    │       ├── melihat data nilai
    │       ├── ubah nilai
    │       └── finalisasi kelas
    │
    └──► Service Transkrip :3002
            └── sinkron transkrip

SQLite
    └── data/sistem_nilai.db
```

| Komponen                                       | Fungsi                                                                           |
| ---------------------------------------------- | -------------------------------------------------------------------------------- |
| Gateway (`gateway/app.py`)                     | Entry point, autentikasi, policy check, forwarding request, audit log            |
| Policy Engine (`gateway/policy.py`)            | Menentukan allow/deny berdasarkan role, device, kepemilikan, jam akses, dan path |
| Policy Administrator (`gateway/auth.py`)       | Login, refresh, logout, dan penerbitan token service                             |
| Service Nilai (`service_nilai/app.py`)         | Mengelola nilai, kelas, dan finalisasi                                           |
| Service Transkrip (`service_transkrip/app.py`) | Mengelola transkrip dan sinkronisasi antar-service                               |
| SQLite (`data/sistem_nilai.db`)                | Penyimpanan data pengguna, device, kelas, nilai, refresh token, audit log        |
| Frontend (`frontend/`)                         | Alat bantu uji akses dari browser                                                |

## 2. Fitur

Fitur utama yang diterapkan sesuai ketentuan tugas:

- Access token JWT berlaku 10 menit dengan claim `sub` dan `role`.
- Refresh token berlaku 1 hari dan dapat dicabut saat logout.
- Token service berlaku 5 menit dengan `role: service` untuk komunikasi antar-service.
- Gateway secret wajib ada pada request yang masuk ke service.
- Service melakukan verifikasi ulang token dan secret sebelum memproses request.
- Kebijakan akses berdasarkan role dan kepemilikan data sesuai Tabel 3.
- Device ID harus terdaftar pada akun user yang login dan untuk request biasa.
- Jam akses dapat diatur untuk operasi ubah/finalisasi nilai.
- Audit log mencatat hasil allow/deny dan alasan.

Catatan penting: frontend dan endpoint `/audit` hanya alat bantu uji untuk demonstrasi; keduanya bukan kebutuhan wajib dari tugas, tetapi sangat membantu saat presentasi dan debugging.

## 3. Struktur folder

```text
sistem-nilai/
├── README.md                      Dokumentasi proyek
├── requirements.txt               Daftar library yang dibutuhkan
├── config.py                      Konfigurasi port, secret, token, jam akses
├── db.py                          Koneksi SQLite dan helper database
├── common.py                      Helper verifikasi token, gateway secret, dan HTTP internal
├── seed.py                        Membuat skema database dan data awal; reset data
├── run_all.py                     Menjalankan gateway + service Nilai + service Transkrip
├── data/
│   └── sistem_nilai.db           Database SQLite hasil seeding
├── frontend/
│   ├── index.html                Halaman utama frontend demo
│   ├── app.js                    Logika login, refresh, logout, request manual, audit UI
│   └── style.css                 Styling UI demo
├── gateway/
│   ├── app.py                    API Gateway di port 3000
│   ├── auth.py                   Login, refresh, logout, dan token service
│   ├── policy.py                 Policy Engine untuk access control
│   └── audit.py                  Menyimpan log audit
├── service_nilai/
│   └── app.py                    Service Nilai di port 3001
├── service_transkrip/
│   └── app.py                    Service Transkrip di port 3002
├── .venv/                        Lingkungan virtual Python (jika sudah dibuat)
└── .gitignore                    Bawaan project (jika ada)
```

## 4. Persyaratan

- Python 3.10+
- `pip`
- Sistem operasi yang telah diuji: Windows 10/11 (PowerShell dan cmd) dan Linux/macOS dengan shell aktif
- Library yang dipakai sesuai `requirements.txt`:
  - Flask >= 3.0, < 4.0
  - PyJWT >= 2.8, < 3.0
  - requests >= 2.31, < 3.0

## 5. Instalasi

### Windows PowerShell

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

Jika aktivasi venv diblokir oleh policy PowerShell, jalankan:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

### Windows Command Prompt (cmd.exe)

```cmd
python -m venv .venv
.venv\Scripts\activate.bat
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

### Linux/macOS

```bash
cd /path/ke/sistem-nilai
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

## 6. Menjalankan program

Setelah instalasi selesai:

```powershell
cd d:\sistem-nilai
.\.venv\Scripts\Activate.ps1
python run_all.py
```

URL yang tersedia setelah server aktif:

- Frontend: http://127.0.0.1:3000/ui
- Gateway: http://127.0.0.1:3000
- Service Nilai: http://127.0.0.1:3001
- Service Transkrip: http://127.0.0.1:3002

Untuk menghentikan aplikasi: tekan `Ctrl+C` pada terminal yang menjalankan `run_all.py`.

Untuk mereset data ke kondisi awal, jalankan:

```powershell
cd d:\sistem-nilai
.\.venv\Scripts\python seed.py
```

Peringatan: `seed.py` menghapus semua data yang ada di database dan membuat data awal kembali. Gunakan hanya saat demo atau sebelum pengujian baru.

## 7. Akun dan device ID data awal

Data akun default dibuat oleh `seed.py`.

| Username | Password | Role      | NIM     | Device ID     |
| -------- | -------- | --------- | ------- | ------------- |
| admin    | admin123 | admin     | -       | DEV-ADMIN-01  |
| dosen1   | dosen123 | dosen     | -       | DEV-DOSEN1-01 |
| dosen2   | dosen123 | dosen     | -       | DEV-DOSEN2-01 |
| mhs1     | mhs123   | mahasiswa | 2210001 | DEV-MHS1-01   |
| mhs2     | mhs123   | mahasiswa | 2210002 | DEV-MHS2-01   |
| mhs3     | mhs123   | mahasiswa | 2210003 | DEV-MHS3-01   |

Data kelas dan dosen pengampu:

| Kelas ID | Nama Kelas         | Dosen Pengampu |
| -------- | ------------------ | -------------- |
| 1        | Keamanan Informasi | dosen1         |
| 2        | Basis Data         | dosen2         |

Data nilai awal:

- Kelas 1: mhs1=85, mhs2=78, mhs3=90
- Kelas 2: mhs1=80, mhs2=88, mhs3=75

Client service:

| Client ID     | Client Secret                  |
| ------------- | ------------------------------ |
| service-nilai | service-nilai-secret-praktikum |

## 8. Konfigurasi

Environment variable yang didukung pada project ini:

| Nama variabel           | Nilai bawaan                           | Fungsi                                      |
| ----------------------- | -------------------------------------- | ------------------------------------------- |
| `JAM_MULAI`             | `00:00`                                | Batas mulai jam akses ubah/finalisasi nilai |
| `JAM_SELESAI`           | `23:59`                                | Batas akhir jam akses ubah/finalisasi nilai |
| `JWT_SECRET`            | `jwt-secret-praktikum-zero-trust-32b!` | Kunci tanda tangan JWT                      |
| `GATEWAY_SECRET`        | `gateway-secret-praktikum-zero-trust`  | Header `X-Gateway-Secret` untuk service     |
| `SERVICE_CLIENT_ID`     | `service-nilai`                        | Client ID untuk token service               |
| `SERVICE_CLIENT_SECRET` | `service-nilai-secret-praktikum`       | Client secret untuk token service           |
| `DB_PATH`               | `data/sistem_nilai.db`                 | Lokasi file database SQLite                 |

Jam akses default disetel agar demo berjalan normal: `00:00` sampai `23:59`. Jika Anda ingin membatasi jam akses, override variabel environment sebelum menjalankan server. Backend harus di-restart agar perubahan tersebut terbaca; variabel environment menimpa nilai default di `config.py`.

### PowerShell

```powershell
$env:JAM_MULAI = "00:00"
$env:JAM_SELESAI = "23:59"
python run_all.py
```

### Command Prompt

```cmd
set JAM_MULAI=00:00
set JAM_SELESAI=23:59
python run_all.py
```

### Linux/macOS

```bash
export JAM_MULAI=00:00
export JAM_SELESAI=23:59
python run_all.py
```

Contoh jam buka (semua akses diperbolehkan sesuai demo):

```powershell
$env:JAM_MULAI = "00:00"
$env:JAM_SELESAI = "23:59"
python run_all.py
```

Contoh jam ditutup (menolak semua perubahan/pengubahan nilai):

```powershell
$env:JAM_MULAI = "00:00"
$env:JAM_SELESAI = "00:01"
python run_all.py
```

Hasil yang diharapkan: saat request ubah/finalisasi masuk ke jam yang ditutup, server akan menolak dengan status `403` dan alasan `di luar jam akses`.

## 9. Pengujian lewat frontend

Frontend tersedia di `http://127.0.0.1:3000/ui` dan berisi panel login, sesi aktif, request manual, audit, token service, serta tombol uji akses. Langkah demo yang direkomendasikan:

1. Buka browser ke `http://127.0.0.1:3000/ui`.
2. Login sebagai `dosen1` dengan device `DEV-DOSEN1-01`.
   - Hasil yang diharapkan: status `200`, access token dan refresh token muncul.
   - Komponen: `frontend/app.js` menangani login dan render token.
3. Tampilkan payload JWT dari token aktif. Perhatikan `sub`, `role`, dan `exp`.
4. Login menggunakan device tidak terdaftar, misalnya `DEV-UNKNOWN-99`.
   - Hasil yang diharapkan: `403` dengan alasan `device tidak terdaftar`.
   - Komponen: `gateway/auth.py` dan `gateway/policy.py`.
5. Kembali ke sesi valid `dosen1`, lalu klik `Refresh`.
   - Hasil yang diharapkan: access token baru diterbitkan tanpa login ulang.
   - Komponen: `gateway/auth.py`, fungsi `refresh()`.
6. Klik `Logout`.
   - Hasil yang diharapkan: sesi aktif hilang dan refresh token dicabut.
   - Komponen: `gateway/auth.py`, fungsi `logout()`.
7. Setelah logout, coba refresh kembali dengan token lama.
   - Hasil yang diharapkan: `401` karena token sudah dicabut atau tidak valid.
   - Komponen: `gateway/auth.py` dan tabel `refresh_tokens`.
8. Login sebagai `mhs1` dengan device `DEV-MHS1-01`.
9. Pada panel Mahasiswa, pilih daftar nilai saya.
   - Hasil yang diharapkan: data milik mhs1 tampil.
10. Coba lihat transkrip NIM `2210002`.
    - Hasil yang diharapkan: `403`.
    - Penjelasan: mahasiswa hanya boleh melihat data miliknya sendiri.
11. Logout lalu login sebagai `admin`.
12. Coba lihat transkrip NIM `2210002`.
    - Hasil yang diharapkan: `200`, admin dapat melihat seluruh transkrip.
13. Logout admin lalu login kembali sebagai `dosen1`.
14. Pada panel Dosen, isi `kelas_id = 2` lalu klik lihat kelas.
    - Hasil yang diharapkan: `403` karena `dosen1` bukan pengampu kelas 2.
15. Isi `kelas_id = 1`, lalu ubah salah satu nilai dan klik simpan.
    - Hasil yang diharapkan: `200` dan nilai berubah.
16. Klik `Finalisasi`.
    - Hasil yang diharapkan: kelas difinalisasi.
17. Coba ubah nilai lagi setelah finalisasi.
    - Hasil yang diharapkan: `403` dan alasan `nilai sudah final`.
18. Pada panel Request Manual, kirim request `GET /nilai` dengan token valid dari `dosen1` tetapi `X-Device-ID` lain.
    - Hasil yang diharapkan: `403` karena device tidak valid untuk request biasa.
19. Masuk ke panel Token Service, buat token service.
    - Hasil yang diharapkan: token service muncul dengan `role: service` dan masa berlaku 5 menit.
20. Gunakan token service untuk request `POST /transkrip/sinkron` di panel request manual.
    - Hasil yang diharapkan: token user ditolak dengan `403`, token service diterima dengan `200`.
21. Login sebagai admin lagi lalu buka panel Audit Log.
    - Hasil yang diharapkan: log tampil berisi waktu, subjek, endpoint, device, hasil, dan alasan.

## 10. Pengujian lewat terminal

Aturan penting untuk PowerShell/cmd:

- Diuji berhasil di Windows PowerShell 5.1 dan cmd.
- Gunakan `curl.exe`, bukan `curl`, saat menjalankan di Windows.
- Gunakan `-s -w "\nHTTP %{http_code}\n"` agar status HTTP muncul dengan jelas.
- Hindari pola `-d "{\"a\":\"b\"}"` di PowerShell 5.1 karena dapat merusak kutip dan membuat server menerima JSON tidak valid. Gunakan salah satu cara berikut yang sudah diuji:
  - `Invoke-RestMethod -Method Post -Uri ... -ContentType "application/json" -Body '{...}'`
  - `'{...}' | curl.exe -s -w "\nHTTP %{http_code}\n" -X POST <url> -H "Content-Type: application/json" --data-binary "@-"`
- Dalam cmd, JSON bisa memakai tanda kutip ganda di dalam string seperti `"`.
- Siapkan token di variabel PowerShell sebelum menjalankan pengujian (`$u` untuk access token user, `$s` untuk token service).
- Token service tidak memakai `X-Device-ID` karena device tidak diperlukan untuk role service.
- Perintah sinkron menulis ke tabel transkrip; reset dengan `seed.py` bila ingin memulai ulang.

### Tabel hasil yang diharapkan

| No  | Skenario                                   | Status | Pesan yang diharapkan                         |
| --- | ------------------------------------------ | ------ | --------------------------------------------- |
| 1   | Token service valid                        | 200    | `access_token` dan `expires_in: 300`          |
| 2   | Akses langsung ke service tanpa header     | 403    | `ditolak: gateway secret tidak valid`         |
| 3   | `X-Gateway-Secret` benar tanpa token valid | 401    | `ditolak: token tidak valid atau kedaluwarsa` |
| 4   | Token valid tanpa gateway secret           | 403    | `ditolak: gateway secret tidak valid`         |
| 5   | Token user ke `/transkrip/sinkron`         | 403    | `hanya token service yang diizinkan`          |
| 6   | Token service ke `/transkrip/sinkron`      | 200    | `transkrip disinkronkan`                      |
| 7a  | Request tanpa token                        | 401    | `token tidak ada atau tidak valid`            |
| 7b  | Token kedaluwarsa                          | 401    | `token kedaluwarsa`                           |

### Persiapan token untuk pengujian terminal

```powershell
# login user (contoh dosen1)
$body = '{"username":"dosen1","password":"dosen123"}'
$login = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:3000/auth/login" -ContentType "application/json" -Headers @{ "X-Device-ID" = "DEV-DOSEN1-01" } -Body $body
$u = $login.access_token

# token service
$sbody = '{"client_id":"service-nilai","client_secret":"service-nilai-secret-praktikum"}'
$slogin = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:3000/auth/service" -ContentType "application/json" -Body $sbody
$s = $slogin.access_token
```

### 1) Token service valid -> 200

```powershell
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:3000/auth/service" -ContentType "application/json" -Body '{"client_id":"service-nilai","client_secret":"service-nilai-secret-praktikum"}'
```

### 2) Akses langsung ke service tanpa header -> 403

```powershell
curl.exe -s -w "\nHTTP %{http_code}\n" -X GET "http://127.0.0.1:3001/nilai"
```

### 3) X-Gateway-Secret benar tanpa token valid -> 401

```powershell
curl.exe -s -w "\nHTTP %{http_code}\n" -X GET "http://127.0.0.1:3001/nilai" -H "X-Gateway-Secret: gateway-secret-praktikum-zero-trust"
```

### 4) Token valid tanpa gateway secret -> 403

```powershell
curl.exe -s -w "\nHTTP %{http_code}\n" -X GET "http://127.0.0.1:3001/nilai" -H "Authorization: Bearer $u"
```

### 5) Token user ke /transkrip/sinkron -> 403

```powershell
curl.exe -s -w "\nHTTP %{http_code}\n" -X POST "http://127.0.0.1:3000/transkrip/sinkron" -H "Content-Type: application/json" -H "Authorization: Bearer $u" -H "X-Device-ID: DEV-DOSEN1-01" --data-binary '{"kelas_id":1,"mata_kuliah":"Keamanan Informasi","nilai":[{"nim":"2210001","nilai":85}]}'
```

### 6) Token service ke /transkrip/sinkron -> 200

```powershell
curl.exe -s -w "\nHTTP %{http_code}\n" -X POST "http://127.0.0.1:3000/transkrip/sinkron" -H "Content-Type: application/json" -H "Authorization: Bearer $s" --data-binary '{"kelas_id":1,"mata_kuliah":"Keamanan Informasi","nilai":[{"nim":"2210001","nilai":85}]}'
```

### 7a) Request tanpa token -> 401

```powershell
curl.exe -s -w "\nHTTP %{http_code}\n" -X GET "http://127.0.0.1:3000/nilai"
```

### 7b) Token kedaluwarsa -> 401

```powershell
curl.exe -s -w "\nHTTP %{http_code}\n" -X GET "http://127.0.0.1:3000/nilai" -H "Authorization: Bearer <expired-token>"
```

## 11. Referensi kode kebijakan

| Kebutuhan PDF                                    | File                | Fungsi / penanganan                                                                                  |
| ------------------------------------------------ | ------------------- | ---------------------------------------------------------------------------------------------------- |
| 4.1 Autentikasi dan token                        | `gateway/auth.py`   | `login()`, `refresh()`, `logout()`, `service()`                                                      |
| 4.2 Kebijakan akses                              | `gateway/policy.py` | `putuskan()`, `_lihat_nilai()`, `_ubah_nilai()`, `_finalisasi()`, `_lihat_transkrip()`, `_sinkron()` |
| 4.3 Verifikasi konteks                           | `gateway/policy.py` | `_device_terdaftar()`, `_dalam_jam_akses()`                                                          |
| 4.4 Audit log                                    | `gateway/audit.py`  | `catat()`                                                                                            |
| Gateway secret dan token verification di service | `common.py`         | `pasang_verifikasi()`, `decode_token()`, `ambil_bearer()`                                            |
| Forwarding ke service                            | `gateway/app.py`    | `teruskan()`                                                                                         |
| Frontend demo                                    | `frontend/app.js`   | login, session, refresh, request manual, token service, audit UI                                     |

## 12. Kode status dan catatan penting

- `200`: request berhasil dan diizinkan.
- `401`: token tidak ada, tidak valid, atau kedaluwarsa.
- `403`: gateway secret tidak valid, device tidak terdaftar, role tidak berhak, atau di luar jam akses.
- Urutan pengecekan di service: gateway secret dulu, lalu token. Jika secret salah, request ditolak dengan `403` sebelum token diperiksa.
- Token access memiliki masa berlaku 10 menit; token service 5 menit; refresh token 1 hari.
- Nilai default pada secret dan JWT hanya untuk demo praktikum. Jangan dipakai untuk lingkungan produksi.
- Frontend dan `/audit` adalah alat bantu presentasi/debugging, bukan satu-satunya bukti validasi.
- Pastikan server dimulai dari folder proyek yang benar dan database sudah dibuat, terutama saat menguji ulang setelah `seed.py`.

## 13. Ringkasan cepat

Jika ingin demo singkat, jalankan aplikasi, buka `http://127.0.0.1:3000/ui`, lalu uji alur berikut:

1. Login sebagai `dosen1`.
2. Refresh token.
3. Logout dan coba refresh dengan token lama -> `401`.
4. Login sebagai `mhs1`, akses NIM lain -> `403`.
5. Login sebagai `admin`, akses NIM lain -> `200`.
6. Login sebagai `dosen1`, ubah nilai kelas 1, finalisasi, lalu ubah lagi -> `403`.
7. Uji request manual untuk device lain, secret salah, token user di sinkron, token service di sinkron, dan audit log.

Semua alur tersebut diharapkan mencerminkan prinsip zero trust: tidak ada kepercayaan sebelum verifikasi, semua keputusan harus dibuat berdasarkan context, device, role, dan data yang valid.
