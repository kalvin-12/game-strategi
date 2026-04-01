# 🌍 Hex Conquer - Strategy Game (Offline PWA)

Game strategi berbasis grid hexagon yang ringan, menantang, dan bisa dimainkan di mana saja (Web & Android). Dirancang untuk dimainkan secara offline dengan pengalaman bermain yang seru melawan AI.

## 🎮 Tentang Game
Hex Conquer adalah game strategi minimalis di mana tujuan Anda adalah menguasai wilayah sebanyak mungkin. Anda harus mengelola sumber daya emas untuk melakukan ekspansi (menyerang) atau memperkuat pertahanan wilayah yang sudah Anda miliki.

### Fitur Utama:
- **Offline Ready**: Menggunakan Service Worker (PWA) sehingga bisa dimainkan tanpa internet.
- **Mobile Friendly**: Kontrol sentuh yang responsif untuk Android dan iOS.
- **Smart AI**: Lawan komputer yang akan mencoba mengalahkan Anda dengan strategi ekspansi.
- **Resource Management**: Sistem ekonomi sederhana berbasis wilayah dan tambang emas.

## 📂 Struktur Proyek
```text
game/
├── index.html       # Struktur UI & Entry Point
├── style.css        # Desain Visual & Responsivitas
├── game.js          # Logika Game, AI, & Sistem Grid
├── sw.js            # Service Worker untuk Mode Offline
├── manifest.json    # Konfigurasi PWA (Web App)
├── vercel.json      # Konfigurasi Deployment Vercel
├── server.js        # Simple Node.js Server (untuk testing lokal)
└── README.md        # Dokumentasi Proyek
```

## 🚀 Cara Menjalankan

### 1. Lokal (PC)
Gunakan Node.js untuk menjalankan server sederhana:
```bash
node server.js
```
Buka `http://localhost:8080` di browser Anda.

### 2. Android (PWA)
- Deploy kode ini ke hosting (misal: Vercel atau GitHub Pages).
- Buka URL di Chrome Android.
- Klik menu (titik tiga) -> **"Tambahkan ke Layar Utama"**.
- Game sekarang terinstall seperti aplikasi native!

### 3. Deployment ke Vercel
Cukup hubungkan repositori ini ke Vercel, dan gunakan konfigurasi default. File `vercel.json` sudah tersedia untuk menangani caching dan routing.

## 🕹️ Panduan Bermain
1. **Mulai**: Klik petak mana saja untuk melihat info.
2. **Serang**: Klik petak netral/musuh di sebelah wilayah Anda (Biaya: 10 💰).
3. **Bertahan**: Klik petak Anda sendiri untuk menambah kekuatan (Biaya: 5 💰).
4. **Tambang**: Petak dengan simbol 💰 memberikan bonus emas ekstra setiap giliran.
5. **Menang**: Kuasai seluruh peta atau jadilah yang terkuat saat peta penuh!

---
Dibuat dengan ❤️ menggunakan Vanilla JavaScript.
