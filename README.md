# Galeri 3D (viewer + joystick mobile)

## 1. Siapkan file
Salin 4 file dari folder `gallery/assets/` zip export lama ke `public/gallery/assets/`:
`model.gltf`, `character.glb`, `video-0.mp4`, `area-2.jpeg`.
(`public/gallery/gallery.json` sudah ada.)

## 2. Jalankan di komputer
Perlu Node.js LTS (https://nodejs.org). Di terminal VS Code, di folder yang ada `package.json`:

    npm install
    npm run dev

Buka http://localhost:5173

## 3. Coba di HP (satu Wi-Fi dengan komputer)
`npm run dev` menampilkan alamat "Network", misalnya http://192.168.1.10:5173.
Buka alamat itu di browser HP. Joystick muncul otomatis di layar sentuh.

## Kontrol
- Komputer: W A S D jalan, Shift lari, V ganti orang pertama/ketiga, tahan klik lalu geser untuk melihat sekeliling.
- HP: joystick kiri untuk jalan, geser jari di layar untuk melihat sekeliling,
  tombol "Lari" (aktif/nonaktif), tombol "Orang 1/Orang 3" untuk ganti kamera, "Layar penuh".
- Ketuk hotspot untuk membuka popup.

## Opsi
- `<GalleryViewer joystick="auto" />` : `'auto'` (default, hanya layar sentuh), `true` (selalu tampil), `false` (sembunyikan).
- `gallery.json`: `"characterMaxTex": 1024` untuk membatasi ukuran tekstur karakter (default 1024 di HP, 2048 di komputer).

## Catatan penting untuk HP
File karakter 93 MB (848 ribu vertex, tekstur 4096 px) berat untuk HP dan bisa membuat browser crash.
Sebaiknya perkecil karakter (tekstur 1024-2048 px, di bawah 100 ribu segitiga) di Blender atau gltf-transform.
Viewer sudah memperkecil tekstur otomatis, tetapi jumlah segitiga tidak bisa dikurangi otomatis.
