# heypost Frontend

Frontend aplikasi kasir heypost: katalog produk, keranjang, pembayaran, struk, riwayat transaksi, inventori, dan laporan penjualan. Dibangun dengan React, TypeScript, Vite, Tailwind CSS, dan tRPC.

Repository ini hanya berisi frontend. Backend harus dijalankan terpisah dan menyediakan endpoint tRPC yang sesuai dengan kontrak di `src/contracts/appRouter.ts`.

## Menjalankan lokal

```bash
npm install
cp .env.example .env
npm run dev
```

Frontend berjalan pada `http://localhost:5173`. Request `/api` diteruskan ke origin pada `VITE_API_PROXY_TARGET` (default `http://localhost:3000`).

## Pemeriksaan

```bash
npm run check
npm run lint
npm run build
```

## Struktur

- `src/pages` — Kasir, Transaksi, Produk, dan Laporan.
- `src/components` — shell aplikasi, state, dan dialog.
- `src/contracts` — kontrak tipe API; bukan implementasi backend.
- `src/providers` — koneksi tRPC dan React Query.
- `public` — manifest, service worker, dan ikon PWA.
- `DESIGN.md` — kontrak visual dan aturan komponen.

Tampilan mendukung desktop dan mobile, navigasi keyboard, target sentuh minimal 44 px, serta safe-area. QRIS pada alur pembayaran adalah simulasi dan tidak terhubung ke penyedia pembayaran atau rekening bank.
