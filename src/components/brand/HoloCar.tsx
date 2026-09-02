import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Kendaraan hologram sungguhan: mesh 3D nyata, bukan rangka kawat tulis tangan.
 *
 * Pendahulunya (`ScanTurntable`) menggambar 86 bidang dan 230 rusuk yang
 * koordinatnya diketik satu per satu. Itu cukup untuk terbaca sebagai mobil,
 * tapi tidak akan pernah mendekati kerapatan hologram sungguhan — jaraknya
 * seribu kali, bukan dua kali. Di sini modelnya ~109 ribu segitiga.
 *
 * Warnanya TIDAK datang dari tekstur. Model bawaannya sudah dilucuti (lihat
 * `scripts/strip-glb.mjs`) dan seluruh permukaannya dicat ulang oleh shader di
 * bawah: yang menyala adalah bagian yang menyerempet pandangan. Itu sebabnya
 * berkasnya cuma 376 KB padahal aslinya 5,2 MB.
 */

/*
 * Warna hologram — hijau merek DRIVE, bukan biru seperti rujukan umum.
 *
 * Yang menentukan seberapa "terang" hologramnya terasa BUKAN kecerahan, tapi
 * warna paling terangnya. Sebelumnya tepi memakai #eaffb0 — nyaris putih — dan
 * karena blending-nya aditif, tiap lapisan permukaan mendorong hasilnya makin
 * dekat ke putih murni. Sekali menyentuh putih, warna mereknya hilang dan yang
 * tersisa cuma silau.
 *
 * Sekarang keduanya diturunkan satu tingkat: badan memakai hijau tua merek, dan
 * titik paling terang berhenti di hijau terang merek. Menumpuk berapa lapis pun
 * hasilnya tidak akan pernah lebih putih daripada #aded1f.
 */
const HOLO_COLOR = new THREE.Color('#83bd04');
const HOLO_RIM = new THREE.Color('#aded1f');

/*
 * Kecerahan hologram — SATU tombol untuk seluruh tampilannya.
 *
 * Blending-nya aditif: tiap permukaan MENAMBAH cahaya ke yang di belakangnya.
 * Itu memang yang bikin siluetnya menumpuk dan terbaca sebagai benda, tapi
 * artinya kecerahan ikut tumbuh bersama kerapatan model. Mobil mainan 91 ribu
 * segitiga tanpa interior terlihat pas; Aventador 134 ribu segitiga LENGKAP
 * DENGAN kabin dan jok punya jauh lebih banyak lapisan yang saling menimpa,
 * dan tumpukannya menjenuh jadi putih.
 *
 * Kalau perlu disetel lagi, ubah angka ini saja.
 */
/*
 * Kecerahan hologram — SATU tombol untuk seluruh tampilannya.
 *
 * Blending-nya aditif: tiap permukaan MENAMBAH cahaya ke yang di belakangnya.
 * Itu yang bikin siluetnya menumpuk dan terbaca sebagai benda, tapi artinya
 * kecerahan ikut tumbuh bersama kerapatan model. Aventador ini 134 ribu
 * segitiga LENGKAP DENGAN kabin dan jok — jauh lebih banyak lapisan saling
 * menimpa daripada mobil mainan tanpa interior yang dipakai sebelumnya.
 *
 * Riwayat penyetelannya, supaya tidak diulang dari nol:
 *   1,00  menjenuh jadi putih
 *   0,38  masih menyilaukan
 *   0,05  terlalu pudar, kendaraannya nyaris hilang
 *   0,20  di antaranya
 */
const HOLO_INTENSITY = 0.2;

/*
 * Ketajaman pendar tepi.
 *
 * Dinaikkan dari 2,4: pangkat yang lebih tinggi memusatkan cahaya ke siluet dan
 * meredupkan bidang yang menghadap kamera. Ini meredupkan keseluruhan TANPA
 * mengaburkan bentuk — beda dengan sekadar menurunkan kecerahan, yang meredupkan
 * siluetnya juga.
 */
const RIM_POWER = 3.1;

/**
 * Shader hologram: fresnel + pita pindai.
 *
 * `rim` = seberapa menyerempet permukaannya terhadap kamera. Bidang yang tegak
 * lurus nyaris tak terlihat, bidang di siluet menyala penuh — itu yang membuat
 * benda tembus pandang terbaca sebagai benda, bukan gumpalan cahaya.
 *
 * `uScanY` adalah ketinggian pita pindai dalam satuan model. Permukaan yang
 * sedang dilewatinya ikut terang, jadi sapuannya terlihat MENYENTUH kendaraan,
 * bukan lewat di depannya.
 */
const VERTEX_SHADER = /* glsl */ `
  varying vec3 vNormalView;
  varying vec3 vPositionView;
  varying float vWorldY;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldY = worldPosition.y;
    vec4 viewPosition = viewMatrix * worldPosition;
    vPositionView = viewPosition.xyz;
    vNormalView = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uRimColor;
  uniform float uIntensity;
  uniform float uRimPower;
  uniform float uScanY;
  uniform float uScanWidth;
  uniform float uScanStrength;

  varying vec3 vNormalView;
  varying vec3 vPositionView;
  varying float vWorldY;

  void main() {
    vec3 viewDir = normalize(-vPositionView);
    // gl_FrontFacing: sisi dalam kendaraan ikut tergambar (memang tembus
    // pandang), tapi normalnya harus dibalik agar fresnel-nya tidak terbalik.
    vec3 normal = normalize(vNormalView) * (gl_FrontFacing ? 1.0 : -1.0);

    float facing = clamp(dot(normal, viewDir), 0.0, 1.0);
    float rim = pow(1.0 - facing, uRimPower);

    float scan = 1.0 - smoothstep(0.0, uScanWidth, abs(vWorldY - uScanY));

    vec3 color = mix(uColor, uRimColor, rim);
    // Aditif menambahkan color * alpha ke apa yang sudah ada, jadi kecerahan
    // yang terlihat adalah HASIL KALI keduanya — dua-duanya ikut ditahan.
    float alpha = (0.05 + rim * 0.8 + scan * uScanStrength) * uIntensity;
    gl_FragColor = vec4(color * (0.42 + rim * 0.75 + scan * 0.8), alpha);
  }
`;

/**
 * Penyempit tipe untuk mesh.
 *
 * `instanceof THREE.Mesh` menyempitkan ke `Mesh<any, any>` karena generiknya
 * tidak terisi, sehingga `.geometry` dan `.material` jatuh jadi `any` — dan
 * seluruh pembersihan sumber daya jadi tak terperiksa tipenya.
 */
function isMesh(
  object: THREE.Object3D,
): object is THREE.Mesh<THREE.BufferGeometry, THREE.Material> {
  return (object as Partial<THREE.Mesh>).isMesh === true;
}

/**
 * Geometri milik sebuah objek, apa pun jenisnya.
 *
 * Dipakai saat membersihkan: mesh dan garis sama-sama memegang geometri, tapi
 * `instanceof` pada keduanya menyempitkan ke generik yang tak terisi sehingga
 * `.geometry` jatuh jadi `any` — dan pembersihan sumber daya justru bagian yang
 * paling tidak boleh lolos dari pemeriksaan tipe.
 */
function geometryOf(object: THREE.Object3D): THREE.BufferGeometry | null {
  const holder = object as Partial<THREE.Mesh>;
  return holder.geometry instanceof THREE.BufferGeometry ? holder.geometry : null;
}

interface HoloCarProps {
  /** Sudut putar dalam radian; dikendalikan pemanggil agar satu loop saja. */
  angle: number;
  /** Posisi pita pindai di panel: 0 = tepi atas, 1 = tepi bawah. */
  sweep?: number;
  /** Saat mati, pita pindai tidak digambar. */
  scanning?: boolean;
  className?: string;
  /** Dipanggil bila model gagal dimuat, supaya pemanggil bisa mundur ke SVG. */
  onUnavailable?: () => void;
}

const MODEL_URL = '/assets/3d/car.glb';
/** Decoder Draco milik three, disalin ke public/ saat pemasangan. */
const DRACO_PATH = '/assets/3d/draco/';

export function HoloCar({
  angle,
  sweep = 0,
  scanning = true,
  className,
  onUnavailable,
}: HoloCarProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);

  /*
   * Nilai animasi dititipkan lewat ref, BUKAN dependensi efek.
   *
   * `angle` berubah tiap frame. Kalau ia jadi dependensi, seluruh scene three.js
   * akan dibongkar-pasang enam puluh kali sedetik — konteks WebGL baru, model
   * dimuat ulang, semuanya. Efeknya berjalan sekali; loop render membaca ref.
   */
  const frameRef = useRef({ angle, sweep, scanning });
  frameRef.current = { angle, sweep, scanning };

  const unavailableRef = useRef(onUnavailable);
  unavailableRef.current = onUnavailable;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let raf = 0;

    /*
     * Membuat konteks WebGL bisa GAGAL — peramban lama, akselerasi perangkat
     * keras dimatikan, atau terlalu banyak kanvas hidup sekaligus. Saat gagal,
     * konstruktornya melempar. Tanpa penangkap ini lemparan itu naik sampai ke
     * akar dan mengosongkan seluruh halaman, padahal yang gagal cuma hiasannya.
     */
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch (error) {
      console.error('HoloCar: konteks WebGL tidak tersedia', error);
      unavailableRef.current?.();
      return;
    }
    renderer.setClearColor(0x000000, 0);
    // Dibatasi 2: di layar 3x, jumlah piksel yang harus digambar naik 2,25 kali
    // lipat untuk selisih yang praktis tak terlihat pada garis setipis ini.
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    host.appendChild(renderer.domElement);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    const pivot = new THREE.Group();
    scene.add(pivot);

    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uColor: { value: HOLO_COLOR },
        uRimColor: { value: HOLO_RIM },
        uIntensity: { value: HOLO_INTENSITY },
        uRimPower: { value: RIM_POWER },
        uScanY: { value: -10 },
        uScanWidth: { value: 0.06 },
        uScanStrength: { value: 0.55 },
      },
      transparent: true,
      side: THREE.DoubleSide,
      // Additive + depthWrite mati: itulah yang membuat cahaya MENUMPUK di
      // tempat permukaan saling menimpa. Dengan depth test biasa, sisi jauh
      // akan terpotong dan hologramnya berubah jadi benda padat.
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    /*
     * Kotak batas model setelah dinormalkan. Dipakai dua hal: menempatkan pita
     * pindai pada ketinggian yang benar, dan membingkai kamera.
     */
    const bounds = { max: 1, height: 1, halfLength: 1 };

    /*
     * Bingkai kamera dihitung dari ukuran model dan rasio panel, BUKAN angka
     * tetap.
     *
     * Panel ini 16:9 — lebar. Membingkai memakai bola pembatas (cara biasa)
     * terlalu longgar untuk benda panjang-pipih seperti mobil: tingginya cuma
     * seperempat panjangnya, jadi jaraknya ditentukan sisi yang salah dan
     * kendaraan tampak kecil di tengah ruang kosong. Yang dipakai di sini
     * bentangan MENDATAR-nya, karena itu yang lebih dulu menyentuh tepi.
     */
    const frameCamera = () => {
      const halfFov = (camera.fov * Math.PI) / 360;
      const spread = bounds.halfLength * 1.22;
      const distance = Math.max(
        spread / (Math.tan(halfFov) * Math.max(0.5, camera.aspect)),
        bounds.height * 0.9,
      );
      camera.position.set(0, bounds.height * 1.15, distance);
      camera.lookAt(0, bounds.height * 0.45, 0);
    };

    const draco = new DRACOLoader();
    draco.setDecoderPath(DRACO_PATH);
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);

    loader.load(
      MODEL_URL,
      (gltf) => {
        if (disposed) return;
        const model = gltf.scene;

        model.traverse((child) => {
          if (isMesh(child)) child.material = material;
        });

        // Model apa pun bisa datang dengan skala dan titik pusat sembarang.
        // Dinormalkan supaya tinggi kendaraan selalu memenuhi bingkai yang sama
        // — mengganti model tidak perlu menyetel ulang kamera.
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);

        /*
         * Betulkan model yang datang dalam konvensi Z-up.
         *
         * glTF memakai Y-up, tapi banyak model diekspor dari Blender (Z-up)
         * tanpa konversi — panjang kendaraannya jadi berdiri di sumbu Y dan
         * mobilnya tergambar menungging. Sebagiannya sudah membawa rotasi itu
         * di node-nya, sebagian tidak, dan dari luar keduanya tidak terbedakan.
         *
         * Penandanya sederhana dan tidak pernah keliru untuk kendaraan: mobil
         * tidak pernah lebih tinggi daripada panjang atau lebarnya. Kalau
         * bentangan Y yang terbesar, model itu pasti belum diputar.
         */
        if (size.y > size.x && size.y > size.z) {
          model.rotation.x = -Math.PI / 2;
          model.updateMatrixWorld(true);
          box.setFromObject(model);
          box.getSize(size);
        }
        box.getCenter(center);
        const scale = 2.6 / Math.max(size.x, size.y, size.z);
        model.scale.setScalar(scale);
        model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);

        bounds.max = size.y * scale;
        bounds.height = bounds.max || 1;
        // Setengah bentangan terpanjang di bidang mendatar: itu yang menyapu
        // paling lebar saat kendaraan berputar.
        bounds.halfLength = (Math.max(size.x, size.z) * scale) / 2 || 1;
        material.uniforms.uScanWidth!.value = bounds.height * 0.07;

        pivot.add(model);
        frameCamera();
        setReady(true);
      },
      undefined,
      () => {
        if (!disposed) unavailableRef.current?.();
      },
    );

    const resize = () => {
      const { clientWidth, clientHeight } = host;
      if (!clientWidth || !clientHeight) return;
      renderer.setSize(clientWidth, clientHeight, false);
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      frameCamera();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    const tick = () => {
      const { angle: a, sweep: s, scanning: on } = frameRef.current;
      pivot.rotation.y = a;
      material.uniforms.uScanStrength!.value = on ? 0.55 : 0;
      // sweep 0 = tepi ATAS panel, jadi dibalik terhadap tinggi kendaraan.
      const scanY = bounds.max - s * bounds.height;
      material.uniforms.uScanY!.value = scanY;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      draco.dispose();
      material.dispose();
      scene.traverse((child) => geometryOf(child)?.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className={className}
      // Konteks WebGL butuh sesaat untuk memuat model; memunculkannya dengan
      // pudar lebih halus daripada kanvas kosong yang tiba-tiba berisi.
      style={{ opacity: ready ? 1 : 0, transition: 'opacity 600ms ease' }}
      aria-label="Kendaraan sedang dipindai dari segala sudut"
      role="img"
    />
  );
}
