# Modul 2 — Form Builder, Konversi Gambar Drive, Live Preview

## Struktur file

```
lib/
  driveImageConverter.js       # Tugas 2: utility convert link Drive
components/
  shared/
    DriveImage.js               # <img> pintar + fallback placeholder (edge case 5.3)
  admin/
    FormFieldEditor.js          # Editor 1 field kustom (teks/pilihan ganda/dropdown)
    VariantManager.js           # Tugas 1: manajemen varian S/M/L
    FormBuilder.js              # Tugas 1: form builder utama (menggabungkan semua)
    LivePreview.js               # Tugas 3: preview etalase dalam frame ponsel
app/
  admin/produk/baru/page.js     # Contoh komposisi: FormBuilder + LivePreview berdampingan
```

## Dependensi

```bash
npm install lucide-react
```

Tailwind CSS diasumsikan sudah terpasang (standar `create-next-app`). Semua warna memakai Tailwind *arbitrary value* yang merujuk ke CSS variable (`bg-[var(--ink)]`), jadi **tidak perlu** mengubah `tailwind.config.js` — cukup tambahkan variable & font di `globals.css`:

```css
/* app/globals.css atau styles/globals.css */
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');

:root {
  --ink: #14213D;      /* teks utama, tombol primer, frame ponsel */
  --paper: #FFFFFF;    /* background kartu */
  --canvas: #F4F5F4;   /* background halaman */
  --marigold: #F2A93B; /* aksen/CTA utama */
  --pine: #2F6D5D;     /* aksi positif (tambah, terapkan) */
  --brick: #C1443C;    /* peringatan/hapus */
  --line: #E4E4E0;     /* border */
  --muted: #6B7280;    /* teks sekunder */
}

body { font-family: 'Inter', sans-serif; color: var(--ink); }
.font-display { font-family: 'Space Grotesk', sans-serif; }
.font-mono { font-family: 'IBM Plex Mono', monospace; }
```

Path alias `@/...` diasumsikan sudah dikonfigurasi di `jsconfig.json`/`tsconfig.json` (bawaan `create-next-app`).

## Arsitektur data mengalir

`FormBuilder` adalah **controlled component** — state `product` & `fields` hidup di halaman induk (`app/admin/produk/baru/page.js`), bukan di dalam `FormBuilder` sendiri. Ini sengaja: begitu Admin mengetik, state di induk berubah, dan `LivePreview` yang menerima props yang sama langsung ikut ter-render ulang — tanpa perlu event/callback tambahan untuk "sinkronisasi preview".

```
page.js (useState: product, fields)
   ├── <FormBuilder product fields onProductChange onFieldsChange onSave />
   └── <LivePreview product fields />       // baca state yang sama, real-time
```

## Titik integrasi ke Modul 1

- `FormBuilder.onSave(product, fields)` adalah tempat memanggil write ke Firestore: `stores/{storeId}/products/{productId}` dan `stores/{storeId}.custom_form_fields`. Berdasarkan Security Rules Modul 1, Admin/staff toko **boleh langsung menulis** ke `products` (beda dengan `orders`, yang wajib lewat Cloud Function).
- Field `product`/`variant` sudah mengikuti nama field persis seperti skema Firestore Modul 1 (`has_variants`, `sku`, `image_url`, `field_id`, `is_required`, dst.) supaya tidak perlu mapping tambahan saat menulis ke database.

## Catatan desain

Elemen varian sengaja dibuat menyerupai *label harga* fisik toko (garis putus-putus + "lubang perforasi", SKU dalam font mono) — detail kecil yang menegaskan konteks produk: alat bantu jualan UMKM, bukan dashboard SaaS generik. Palet warna (ink navy + marigold + pine) dipilih untuk menghindari kombinasi krem-terracotta yang sudah terlalu umum dipakai desain bergaya AI.

my-order-form/                           <-- Folder Utama Proyek kamu
│
├── app/                                 <-- Folder Utama Halaman (Next.js App Router)
│   ├── globals.css                      <-- Tempat masukan warna & font (:root var)
│   ├── layout.js                        <-- Template kerangka web dasar
│   ├── page.js                          <-- Halaman Depan / Toko Pembeli (Etalase & Checkout)
│   └── admin/
│       ├── dashboard/
│       │   └── page.js                  <-- Halaman Dashboard Admin (Ringkasan Analytics & Order)
│       └── produk/
│           └── baru/
│               └── page.js              <-- Halaman Tambah Produk Baru (FormBuilder + LivePreview)[cite: 5, 6]
│
├── components/                          <-- Folder Komponen UI (React)[cite: 6]
│   ├── shared/
│   │   └── DriveImage.js                <-- Komponen pembaca gambar Google Drive[cite: 6, 8]
│   └── admin/
│       ├── FormBuilder.js               <-- Komponen utama pembuat form[cite: 6, 10]
│       ├── FormFieldEditor.js           <-- Editor input custom pembeli[cite: 6, 11]
│       ├── VariantManager.js            <-- Pengelola ukuran / varian S, M, L[cite: 6, 7]
│       └── LivePreview.js               <-- Frame HP simulasi pratinjau[cite: 6, 12]
│
├── lib/                                 <-- Folder Logika / Utilitas Fungsi[cite: 6]
│   ├── driveImageConverter.js           <-- Fungsi konversi link Google Drive[cite: 6, 9]
│   └── mockData.js                      <-- Data contoh/dummy (produk, pesanan, analitik)
│
├── .env.local                           <-- Tempat simpan API Key & Password rahasia
└── package.json                         <-- Daftar pustaka/library (lucide-react, dll)[cite: 6]