---
version: alpha
name: heypost
description: Antarmuka kasir untuk pekerja toko yang perlu membaca menu, memeriksa pesanan, dan menyelesaikan pembayaran dengan cepat dan tenang.
colors:
  ground: "#f4f7f5"
  surface: "#ffffff"
  ink: "#111827"
  muted: "#566273"
  signal: "#16785b"
  line: "#dfe8e2"
typography:
  display:
    fontFamily: Archivo Variable
    fontSize: 32px
    fontWeight: 720
    letterSpacing: -0.035em
  body:
    fontFamily: Figtree Variable
    fontSize: 14px
    lineHeight: 1.45
rounded:
  sm: 8px
  md: 12px
spacing:
  sm: 8px
  md: 16px
  lg: 24px
components:
  button-primary:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: 0 16px
---

## Overview

heypost adalah alat kerja kasir, bukan halaman pemasaran. Arah visualnya mengambil kejelasan struk dan label inventori: angka mudah dipindai, batas informasi tegas, dan aksi selalu terlihat. Palet hijau pinus memberi identitas yang tenang dan mudah dikenali tanpa mengurangi fokus kerja.

## Colors

- **Ground (#f4f7f5):** bidang kerja netral yang membedakan katalog dari panel pesanan.
- **Surface (#ffffff):** formulir, panel pesanan, tabel, dan dialog.
- **Ink (#111827):** judul, harga, total, dan angka operasional.
- **Muted (#566273):** informasi sekunder dengan kontras yang tetap terbaca.
- **Signal (#16785b):** aksi utama, pilihan aktif, fokus, dan status positif yang membutuhkan perhatian.
- **Line (#dfe8e2):** pemisah struktural; tidak digunakan sebagai dekorasi.

## Typography

Archivo Variable dipakai untuk judul halaman dan angka utama. Figtree Variable dipakai untuk kontrol, isi, dan label. Harga, total, stok, serta metrik memakai angka tabular. Ukuran label kecil tidak boleh mengorbankan keterbacaan.

## Layout

Desktop memakai navigasi kiri, katalog yang mengalir, dan panel pesanan tetap. Mobile memakai dua kolom produk, navigasi bawah, serta keranjang sebagai panel bawah. Tidak ada aksi yang hanya tersedia melalui hover. Semua halaman memakai heading, toolbar, dan ritme spasi yang sama.

## Elevation & Depth

Permukaan umumnya datar. Bayangan hanya untuk elemen yang benar-benar melayang di atas pekerjaan, seperti dialog. Navigasi bawah memakai permukaan solid agar tetap jelas di atas konten.

## Shapes

Radius 8 px untuk kontrol dan gambar produk; 12 px untuk panel besar. Hindari radius dan bayangan baru pada setiap kartu.

## Components

Gunakan kembali navigasi, tombol, kolom pencarian, tabel, dialog, dan token di halaman ini. Target interaktif minimal 44 px. State aktif harus terlihat melalui lebih dari sekadar perubahan warna halus.

## Do's and Don'ts

- Do utamakan total, harga, stok, dan aksi pembayaran dalam hierarki visual.
- Do sediakan state fokus, sentuh, kosong, muat, dan galat yang jelas.
- Don't change: identitas hijau pinus heypost, Archivo Variable, dan Figtree Variable.
- Don't use: gradien dekoratif, glassmorphism tanpa kebutuhan, kartu bersarang, label mono serba kapital, atau glassmorphism dekoratif dan gradien yang tidak memiliki fungsi.
