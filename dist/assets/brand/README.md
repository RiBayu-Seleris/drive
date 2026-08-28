# Aset merek DRIVE

Berkas asli dari pembuat merek ada di **`/LOGO`** pada akar repo — itu sumber
kebenarannya, jangan dihapus. Folder ini hanya salinan yang dipakai aplikasi,
plus beberapa turunan.

## Mana yang dipakai kapan

| Berkas                      | Latar                                          |
| --------------------------- | ---------------------------------------------- |
| `Drive-Compact.svg`         | terang — `bg-neutral-100/200`, kartu putih     |
| `Drive-Compact-on-dark.svg` | gelap — `drive-header`, `#131c24`, `#0a1218`   |
| `Drive-Compact-white.svg`   | berwarna pekat — hijau merek, teal, atau foto  |
| `Drive-Tab-*.svg`           | ikon saja: favicon dan tempat sempit           |
| `Drive-Horizontal*.svg`     | lockup penuh dengan tagline, untuk ukuran besar |
| `Drive-Vertical*.svg`       | lockup tegak, untuk ukuran besar                |

Di kode, jangan tunjuk berkasnya langsung — pakai `<Logo tone="…" />` dari
`src/components/brand/Logo.tsx`.

## Turunan — jangan diedit tangan

`Drive-Compact*`, `*-on-dark`, dan `Drive-Tab-on-dark` dibangun dari
`Drive-Horizontal.svg` dan `Drive-Tab-Logo.svg`. Dua hal yang diperbaiki:

1. **Tagline dibuang** pada varian `Compact`. Lockup resmi memuat tagline dua
   baris; pada tinggi header 36 px tagline itu jadi sekitar 4 px — tidak
   terbaca, cuma jadi kotoran visual. Wordmark lalu digeser turun 36 satuan
   supaya sejajar tengah dengan ikon.
2. **Bidang putih di belakang ikon.** Mobil dan partikel di dalam huruf D itu
   lubang tembus, bukan isian putih. Tanpa bidang itu mereka mengambil warna
   latar dan berubah jadi hitam pekat di tema gelap. Varian `white` sengaja
   tidak memakainya — logo satu warna memang mengandalkan lubang.

Kalau logo aslinya diperbarui, ganti isi `/LOGO`, salin ulang ke sini, lalu
bangun ulang turunannya. Jangan menambal berkas turunan.
