# Model 3D layar analisis

`car.glb` dipakai hologram di `/check-condition/analyzing`.

## Asal & lisensi

Lamborghini Aventador, dari arsip `3D/8hd2hnno0ayo-aventador_sport.zip` yang
disediakan pemilik proyek. Sumber aslinya OBJ tahun 2014 (382.610 muka segi
empat) beserta tekstur TGA dan berkas logo Lamborghini.

**Lisensi model ini belum diverifikasi.** Bentuk Aventador adalah desain yang
dilindungi Lamborghini, dan model kendaraan bermerek yang beredar bebas hampir
selalu buatan penggemar — pengunggahnya tidak memegang hak yang bisa mereka
berikan. Ini dicatat di sini supaya keputusannya tetap terlihat, bukan sebagai
penilaian; pemakaiannya keputusan pemilik proyek.

Model sebelumnya, Toy Car dari Khronos glTF-Sample-Assets (CC0, domain publik),
bisa dipasang kembali kapan saja lewat perintah di bawah.

## Bagaimana 43 MB jadi 547 KB

| tahap | hasil |
| --- | --- |
| OBJ asli | 43 MB |
| → GLB (`obj2gltf`) | 19 MB |
| buang tekstur & material | — |
| satukan 435 mesh jadi 2 | — |
| sederhanakan 646.240 → 133.863 segitiga | — |
| mampatkan Draco | **547 KB** |

Shader hologram menghitung warna dari sudut permukaan terhadap kamera, jadi
tidak pernah membaca tekstur — seluruh peta PBR murni beban unduhan. Menyatukan
mesh-nya memberi penghematan terbesar: 435 bagian terpisah masing-masing membawa
buffer Draco sendiri, dan penyederhana tidak berani menyentuh apa pun di dekat
batas antar-bagian. Setelah disatukan, 1,2 MB turun jadi 547 KB.

## Mengganti modelnya

Berkas ini sudah dibersihkan — tekstur, material, animasi, dan kamera dibuang,
geometrinya dimampatkan Draco. Dari 5,2 MB jadi 376 KB tanpa kehilangan satu
segitiga pun, karena shader hologram menghitung warna dari sudut permukaan dan
tidak pernah membaca tekstur.

Kalau mengganti dengan model lain, jalankan pembersihannya:

```
node scripts/strip-glb.mjs model-baru.glb public/assets/3d/car.glb
node scripts/strip-glb.mjs model-baru.glb public/assets/3d/car.glb --tris 130000
node scripts/strip-glb.mjs model-baru.glb public/assets/3d/car.glb --drop Ground,Base
```

OBJ/FBX dikonversi dulu: `npx obj2gltf -i model.obj -o /tmp/model.glb`.

`--tris` memangkas ke anggaran segitiga; `--drop` membuang properti panggung.

Perintah kedua untuk model yang datang bersama properti panggung. Cek dulu nama
mesh-nya; hampir semua model mobil gratis punya lantai atau alas.

Yang perlu diperiksa sebelum memakai model lain:

- **Lisensinya** memperbolehkan pemakaian komersial.
- **Bukan desain mobil bermerek** yang bisa dikenali.
- Jumlah segitiganya wajar. Yang sekarang ~91 ribu; jauh di atas itu akan
  memberatkan ponsel kelas bawah.
- Punya atribut **NORMAL**. Shader hologram menghitung warna dari sudut
  permukaan; tanpa normal, seluruh kendaraan tergambar rata tanpa bentuk.

Kamera membingkai sendiri dari kotak batas model, jadi skala dan titik pusat
model baru tidak perlu disetel manual.

## Decoder Draco

`draco/` berisi decoder WASM bawaan three (disalin dari
`node_modules/three/examples/jsm/libs/draco/`). Cadangan JS murni sebesar 703 KB
sengaja TIDAK disalin: ia hanya dipakai peramban tanpa WebAssembly, dan di
peramban seperti itu hologramnya toh mundur ke animasi SVG.

Kalau versi three dinaikkan, salin ulang berkas decoder-nya.
