/*
 * Menyiapkan model 3D untuk hologram di layar analisis.
 *
 * Layar itu memakai shader hologram: warnanya dihitung dari sudut permukaan
 * terhadap kamera, BUKAN dari tekstur. Jadi seluruh peta PBR di model bawaan
 * (albedo, normal, roughness, clearcoat) tidak pernah dipakai satu piksel pun —
 * murni beban unduhan di layar yang justru muncul saat orang sedang menunggu.
 *
 * Skrip ini membuang tekstur, material, animasi, dan kamera; menyatukan titik
 * yang kembar; lalu memampatkan geometrinya dengan Draco.
 *
 * Kebanyakan model mobil yang bisa diunduh datang bersama properti panggung —
 * lantai, alas kain, kotak pajangan. Benda-benda itu ikut terhitung ke kotak
 * batas dan membuat kendaraannya menyusut jadi titik di tengah panggung. Buang
 * lewat `--drop`.
 *
 * Model mobil "siap render" sering datang dengan ratusan ribu segitiga — bagus
 * untuk gambar diam, terlalu berat untuk animasi 60 fps di ponsel. `--tris`
 * memangkasnya ke anggaran yang wajar. Yang dipangkas duluan bagian datar yang
 * rapat tanpa alasan; siluet dijaga, dan siluet itulah yang dibaca mata pada
 * hologram.
 *
 * Pakai saat mengganti modelnya:
 *   node scripts/strip-glb.mjs masukan.glb public/assets/3d/car.glb
 *   node scripts/strip-glb.mjs masukan.glb keluaran.glb --drop Fabric,Ground
 *   node scripts/strip-glb.mjs masukan.glb keluaran.glb --tris 130000
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, draco, flatten, join, prune, simplify, weld } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { MeshoptSimplifier } from 'meshoptimizer';

const [input, output, ...rest] = process.argv.slice(2);
if (!input || !output) {
  console.error('Pakai: node scripts/strip-glb.mjs <masukan.glb> <keluaran.glb> [--drop A,B]');
  process.exit(1);
}
const trisIndex = rest.indexOf('--tris');
const triangleBudget = trisIndex >= 0 ? Number(rest[trisIndex + 1]) : 0;
/*
 * Batas pergeseran bentuk yang boleh diterima penyederhana, sebagai pecahan
 * dari ukuran model.
 *
 * Perlu diketahui batasnya: pada model kendaraan, `--tris` maupun `--error`
 * sama-sama berhenti di sekitar 75 ribu segitiga. Yang menahan bukan keduanya,
 * melainkan BATAS TOPOLOGI — meshopt tidak akan menyatukan rusuk di tepi
 * cangkang yang terpisah, dan mobil terdiri dari ratusan bagian tertutup
 * sendiri-sendiri (bodi, kaca, jok, pelek). Meminta 20 ribu tetap menghasilkan
 * 75 ribu. Jangan buang waktu menyetel angka ini untuk menembusnya.
 */
const errorIndex = rest.indexOf('--error');
const simplifyError = errorIndex >= 0 ? Number(rest[errorIndex + 1]) : 0.01;
const dropIndex = rest.indexOf('--drop');
const dropNames = new Set(
  dropIndex >= 0 ? (rest[dropIndex + 1] ?? '').split(',').map((n) => n.trim()).filter(Boolean) : [],
);

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.encoder': await draco3d.createEncoderModule(),
  'draco3d.decoder': await draco3d.createDecoderModule(),
});

const doc = await io.read(input);
const root = doc.getRoot();
const textureCount = root.listTextures().length;

// Node dibuang lebih dulu, baru mesh-nya — node yatim tetap ikut terbaca
// three sebagai objek kosong dan mengacaukan kotak batas.
for (const node of root.listNodes()) {
  const mesh = node.getMesh();
  if (mesh && dropNames.has(mesh.getName())) node.dispose();
}
for (const mesh of root.listMeshes()) {
  if (dropNames.has(mesh.getName())) mesh.dispose();
}

for (const texture of root.listTextures()) texture.dispose();
for (const material of root.listMaterials()) material.dispose();
for (const animation of root.listAnimations()) animation.dispose();
for (const camera of root.listCameras()) camera.dispose();

function countTriangles() {
  let total = 0;
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const indices = prim.getIndices();
      total += (indices?.getCount() ?? prim.getAttribute('POSITION')?.getCount() ?? 0) / 3;
    }
  }
  return Math.round(total);
}

/*
 * Satukan dulu, baru sederhanakan.
 *
 * Model mobil "siap render" biasanya terpecah jadi ratusan bagian — tiap panel,
 * baut, dan jahitan jok jadi mesh sendiri. Setelah materialnya dibuang, pecahan
 * itu tidak lagi ada gunanya, dan justru mahal: tiap bagian membawa buffer
 * Draco sendiri beserta ongkos tetapnya, dan penyederhana bekerja per bagian
 * sehingga tidak berani menyentuh apa pun di dekat batas antar-bagian.
 *
 * flatten() memanggang transform node supaya bagian-bagiannya boleh disatukan;
 * join() menyatukannya; weld() menutup jahitan bekas batas tadi. Baru setelah
 * itu penyederhana melihat kendaraan sebagai satu permukaan utuh.
 */
await doc.transform(dedup(), flatten(), join(), weld());
const rawTriangles = countTriangles();

if (triangleBudget > 0 && rawTriangles > triangleBudget) {
  await MeshoptSimplifier.ready;
  await doc.transform(
    /*
     * Toleransi galat 1% dari ukuran model, bukan 0,2% seperti bawaannya.
     *
     * Angka ketat masuk akal untuk model yang akan dilihat dari dekat. Di sini
     * kendaraannya tergambar setinggi beberapa ratus piksel dan diselimuti
     * pendar; pergeseran satu persen tidak akan pernah terlihat, sementara
     * bedanya di ukuran berkas besar. Yang dijaga penyederhana tetap siluet —
     * dan siluet itu justru yang dibaca mata pada hologram.
     */
    simplify({
      simplifier: MeshoptSimplifier,
      ratio: triangleBudget / rawTriangles,
      error: simplifyError,
    }),
  );
}

await doc.transform(prune(), draco());
await io.write(output, doc);

const dropped = dropNames.size ? ` · mesh dibuang: ${[...dropNames].join(', ')}` : '';
const trimmed = triangleBudget > 0 ? ` · segitiga: ${rawTriangles} → ${countTriangles()}` : ` · segitiga: ${countTriangles()}`;
console.log(`tekstur dibuang: ${textureCount}${dropped}${trimmed}`);
