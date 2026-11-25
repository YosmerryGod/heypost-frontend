# heypost Frontend

Frontend aplikasi kasir heypost untuk owner, manager, dan kasir. Mencakup autentikasi, multi-outlet, katalog dan stok per cabang, keranjang, pembayaran, struk, riwayat transaksi, laporan, serta pengelolaan karyawan. Dibangun dengan React, TypeScript, Vite, Tailwind CSS, React Query, dan tRPC.

Repository ini hanya berisi frontend. Backend tersedia terpisah di repository `heypost-backend` dan memakai kontrak tipe pada `src/contracts/appRouter.ts`.

## Fitur dan hak akses

- **Owner:** seluruh fitur, pindah outlet, rekap seluruh outlet, tambah/edit outlet, serta kelola karyawan dan barcode.
- **Manager:** kasir, transaksi, produk, dan laporan untuk outlet tempatnya ditugaskan.
- **Kasir:** kasir dan riwayat transaksi outletnya.
- Login owner melalui email/password atau Google OAuth.
- Login karyawan melalui barcode + PIN 6 digit.
- Pembayaran frontend saat ini tunai dan kartu. QRIS tidak ditampilkan sebagai simulasi pembayaran.

## Menjalankan lokal

Backend lokal harus berjalan pada port `3111`.

```bash
npm install
cp .env.example .env
npm run dev
```

Frontend berjalan pada `http://localhost:5173`. Selama `VITE_API_URL` kosong, request `/api` diteruskan ke `VITE_API_PROXY_TARGET` (default `http://localhost:3111`). Cookie sesi dikirim dengan `credentials: include`.

## Menghubungkan API produksi

`.env.production` sudah menunjuk ke:

```env
VITE_API_URL=https://apihey.doodweb.tech
```

Origin frontend produksi juga harus dicantumkan pada `FRONTEND_URL` di backend agar CORS credentials dan cookie sesi diizinkan. Redirect Google OAuth backend (`GOOGLE_SUCCESS_URL`) harus menuju `https://origin-frontend/auth/callback`.

Jika frontend dan backend memakai origin yang sama, kosongkan `VITE_API_URL` dan teruskan `/api` melalui reverse proxy.

## Pemeriksaan

```bash
npm run check
npm run lint
npm run build
```

## Struktur

- `src/pages` — autentikasi, Kasir, Transaksi, Produk, Laporan, dan Pengaturan.
- `src/components` — shell aplikasi, pengelolaan outlet/karyawan, state, dan dialog.
- `src/hooks` — sesi dan tipe role.
- `src/contracts` — kontrak tipe API; bukan implementasi backend.
- `src/providers` — koneksi tRPC dan React Query.
- `public` — manifest, service worker, dan ikon PWA.
- `DESIGN.md` — kontrak visual dan aturan komponen.

Tampilan mendukung desktop dan mobile 375–430 px, navigasi keyboard, target sentuh minimal 44 px, serta safe-area. Backend tetap menjadi sumber otorisasi; penyembunyian menu berdasarkan role di frontend bukan pengganti pemeriksaan izin API.
