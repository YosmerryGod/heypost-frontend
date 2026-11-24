# HeyPost Frontend

Repository untuk source frontend aplikasi kasir dan operasional HeyPost.

Frontend terhubung ke backend terpisah melalui endpoint same-origin `/api/trpc`. Tidak ada seed/mock data bisnis, identitas toko contoh, atau QRIS palsu.

## Source

Unduh arsip frontend dari lampiran percakapan, lalu ekstrak seluruh isinya ke root repository ini.

## Menjalankan lokal

```bash
npm install
cp .env.example .env
npm run dev
```

Atur `VITE_API_PROXY_TARGET` di `.env` jika backend lokal tidak berjalan pada origin yang sama.

## Build

```bash
npm run lint
npm run build
```
