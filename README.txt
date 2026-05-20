# AquaControl Pro — WTP Dashboard
## Cara Menjalankan di Jaringan Lokal (WiFi)

### Prasyarat
Pastikan **Node.js** sudah terinstall di laptop Anda.
Cek dengan perintah: `node -v`
Download Node.js di: https://nodejs.org (pilih versi LTS)

---

### Langkah-langkah

**1. Ekstrak folder ini** ke lokasi mana saja di laptop Anda.
   Contoh: `C:\Users\NamaAnda\Desktop\wtp-dashboard\`

**2. Buka Terminal / Command Prompt**
   - Windows : tekan `Win+R` → ketik `cmd` → Enter
   - macOS   : buka aplikasi Terminal
   - Linux   : buka Terminal

**3. Masuk ke folder project**
   ```
   cd C:\Users\NamaAnda\Desktop\wtp-dashboard
   ```
   (sesuaikan dengan lokasi folder Anda)

**4. Jalankan server**
   ```
   node server.js
   ```

**5. Lihat output di terminal**, contoh:
   ```
   ╔══════════════════════════════════════════════╗
   ║   AquaControl Pro — WTP Dashboard Server     ║
   ╠══════════════════════════════════════════════╣
   ║  Lokal (laptop ini)  : http://localhost:3000  ║
   ║  Jaringan WiFi       : http://192.168.1.12:3000 ║
   ╚══════════════════════════════════════════════╝
   ```

**6. Akses dashboard**
   - Dari laptop ini      → buka browser, ketik `http://localhost:3000`
   - Dari HP/laptop teman → buka browser, ketik alamat WiFi di atas
     (contoh: `http://192.168.1.12:3000`)

---

### Catatan Penting

- Laptop Anda dan teman **harus terhubung ke WiFi yang sama**
- Jangan tutup jendela terminal selama ingin dashboard bisa diakses
- Untuk menghentikan server: tekan **Ctrl+C** di terminal
- Jika teman tidak bisa akses, coba matikan Windows Firewall sementara
  atau tambahkan izin untuk Node.js di firewall

---

### Troubleshooting Windows Firewall

Jika teman tidak bisa membuka dashboard:

1. Buka **Windows Defender Firewall**
2. Klik **Allow an app or feature through Windows Defender Firewall**
3. Klik **Change Settings** → **Allow another app**
4. Browse ke lokasi `node.exe` (biasanya `C:\Program Files\nodejs\node.exe`)
5. Centang **Private** → OK

Atau cara cepat via Command Prompt (jalankan sebagai Administrator):
```
netsh advfirewall firewall add rule name="WTP Dashboard" dir=in action=allow protocol=TCP localport=3000
```

---

### Struktur File
```
wtp-dashboard/
├── index.html    ← File dashboard utama
├── server.js     ← Server Node.js
├── package.json  ← Info project
└── README.txt    ← Panduan ini
```
