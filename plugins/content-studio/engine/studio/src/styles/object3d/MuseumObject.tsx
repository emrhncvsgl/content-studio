// object3d: gerçek bir müze nesnesinin CC0 3D taraması (Smithsonian GLB), gerçek ışıkla, kahraman çekim olarak (2026-11-11, EP013 ilk deneme).
// Ayrı kompozisyon olarak sahnenin kendi süresinde render edilir (tools/woodcut_render.py, style: object3d), ana videoda klip olarak oynar.
// props: model (content/ köküne göre .glb, Draco sıkıştırmalı olabilir), shot: reveal | macro | lift, durationInFrames, words.
// Kurallar: kare = zamanın saf fonksiyonu (kamera/ışık useCurrentFrame'den); tek gerekçeli anahtar ışık + kenar ışığı; ACES ton eşleme; tane ve vinyet CSS'te.
import { useEffect, useMemo, useState } from "react";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, Img, cancelRender, continueRender, delayRender, Easing, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { useThree } from "@react-three/fiber";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

type Word = { text: string; startMs: number; endMs: number };
export type MuseumObjectProps = { model: string; up?: number[]; shot?: "reveal" | "bellows" | "rest" | "turntable"; insert?: { image: string; at: string; fadeMs?: number; from?: { x: number; y: number; zoom: number }; to?: { x: number; y: number; zoom: number }; outBlackMs?: number }; durationInFrames?: number; words?: Word[]; debug?: boolean };

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const inertia = (t: number) => 0.35 * t + 0.65 * t * t * (3 - 2 * t);
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// model yükleme: delayRender ile; normalize edilmiş (uzun eksen = 2 birim, tabanı y=0'da, merkez x/z=0) bir kök grup döner
const useModel = (src: string, up?: number[]) => {
  const [root, setRoot] = useState<THREE.Group | null>(null);
  const [handle] = useState(() => delayRender(`glb ${src}`, { timeoutInMilliseconds: 120000 }));
  useEffect(() => {
    const draco = new DRACOLoader().setDecoderPath(staticFile("vendor/draco/"));
    const loader = new GLTFLoader().setDRACOLoader(draco);
    loader.load(staticFile(src), (g) => {
      const inner = g.scene;
      inner.rotation.set(...((up ?? [0, 0, 0]) as [number, number, number]));   // taramanın yukarı ekseni +y değilse (Lincoln modeli: x −90°)
      const obj = new THREE.Group(); obj.add(inner); obj.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
      const k = 2 / Math.max(size.x, size.y, size.z);
      obj.position.set(-c.x * k, -box.min.y * k, -c.z * k); obj.scale.setScalar(k);
      obj.traverse((m) => {
        const mesh = m as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.castShadow = true; mesh.receiveShadow = true;
          const mat = mesh.material as THREE.MeshStandardMaterial;
          if (mat && mat.isMeshStandardMaterial) { mat.envMapIntensity = 0.4; mat.roughness = Math.max(mat.roughness ?? 1, 0.55); }
        }
      });
      const grp = new THREE.Group(); grp.add(obj);
      const dims = size.multiplyScalar(k);
      grp.userData.dims = dims;
      setRoot(grp); continueRender(handle);
    }, undefined, (e) => cancelRender(e));
  }, [src, handle, up]);
  return root;
};

// toz zerrecikleri ışık hüzmesinde (tohumlu, yavaş süzülür)
const Dust: React.FC<{ frame: number; n?: number; center: THREE.Vector3; spread: number; opacity: number }> = ({ frame, n = 160, center, spread, opacity }) => {
  const geo = useMemo(() => new THREE.BufferGeometry(), []);
  const pos = useMemo(() => new Float32Array(n * 3), [n]);
  for (let i = 0; i < n; i++) {
    const t = frame / 30;
    pos[i * 3] = center.x + (hash(i) - 0.5) * spread + 0.04 * Math.sin(t * 0.3 + i);
    pos[i * 3 + 1] = center.y + (((hash(i + 7) + t * 0.012 * (0.5 + hash(i + 3))) % 1) - 0.2) * spread * 0.9;
    pos[i * 3 + 2] = center.z + (hash(i + 13) - 0.5) * spread + 0.04 * Math.cos(t * 0.25 + i * 1.7);
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.attributes.position.needsUpdate = true;
  return <points geometry={geo}><pointsMaterial color="#fff4dc" size={0.012} transparent opacity={opacity} depthWrite={false} sizeAttenuation /></points>;
};

const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, "");
/** kelime → kare (sahneye göre; props.words konuşulan yazım). Bulunamazsa yedek saniye. */
export const wordAt = (words: Word[] | undefined, word: string, fps: number, fallbackS: number, offsetMs = 0) => {
  const w = (words ?? []).find((x) => norm(x.text) === norm(word));
  return Math.round((((w ? w.startMs : fallbackS * 1000) + offsetMs) / 1000) * fps);
};
const heavyOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3.2);
const ease = (t: number) => Easing.inOut(Easing.cubic)(clamp(t));
type Pose = { p: THREE.Vector3; t: THREE.Vector3; fov: number };
const lerpPose = (a: Pose, b: Pose, k: number): Pose => ({ p: a.p.clone().lerp(b.p, k), t: a.t.clone().lerp(b.t, k), fov: THREE.MathUtils.lerp(a.fov, b.fov, k) });
// reveal yörüngesi (k 0..1); u=1 pozu s05 bellows'un başlangıcı (görünmez köprü)
const revealPose = (k: number): Pose => {
  const a = THREE.MathUtils.degToRad(-72 + 34 * k), r = 6.6 - 1.0 * k;
  return { p: new THREE.Vector3(Math.sin(a) * r, 1.75 - 0.45 * k, Math.cos(a) * r), t: new THREE.Vector3(0, 0.02, 0), fov: 30 };
};

// prosedürel dalgacık normal haritası (tohumlu sinüs toplamı → yükseklik → normal); karo olur, kare ile kaydırılır
const rippleNormals = (n = 256) => {
  const hgt = new Float32Array(n * n);
  const waves = Array.from({ length: 9 }, (_, i) => ({ kx: Math.round((hash(i) - 0.5) * 14), ky: Math.round((hash(i + 20) - 0.5) * 14) || 3, a: 0.4 + hash(i + 40), ph: hash(i + 60) * 6.28 }));
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    let v = 0; for (const w of waves) v += w.a * Math.sin(((w.kx * x + w.ky * y) / n) * 2 * Math.PI + w.ph);
    hgt[y * n + x] = v;
  }
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dx = hgt[y * n + ((x + 1) % n)] - hgt[y * n + ((x - 1 + n) % n)], dy = hgt[((y + 1) % n) * n + x] - hgt[((y - 1 + n) % n) * n + x];
    const v = new THREE.Vector3(-dx * 0.6, -dy * 0.6, 1).normalize(), i = (y * n + x) * 4;
    data[i] = (v.x * 0.5 + 0.5) * 255; data[i + 1] = (v.y * 0.5 + 0.5) * 255; data[i + 2] = (v.z * 0.5 + 0.5) * 255; data[i + 3] = 255;
  }
  const t = new THREE.DataTexture(data, n, n); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(14, 14); t.needsUpdate = true; return t;
};

const Scene: React.FC<{ frame: number; dur: number; fps: number; shot: string; root: THREE.Group; width: number; height: number; words?: Word[] }> = ({ frame, dur, fps, shot, root, width, height, words }) => {
  const u = clamp(frame / Math.max(1, dur - 1));
  const at = (w: string, fb: number, off = 0) => wordAt(words, w, fps, fb, off);
  let fogFar = 10, key = 1, rim = 1, cone = 26, hi = 0, waterY = -0.3, lift = 0, showPlinth = true, bob = 0;
  let pose: Pose;
  if (shot === "reveal") {
    const fRim = at("built", 0.5, -200), fKey = at("model", 1.6, -250);
    rim = 0.5 * Easing.out(Easing.cubic)(clamp((frame - fRim) / (0.6 * fps)));
    key = Easing.out(Easing.cubic)(clamp((frame - fKey) / (0.9 * fps)));
    pose = revealPose(inertia(clamp(frame / Math.max(1, dur - 0.7 * fps))));
  } else if (shot === "bellows") {
    const fCh = at("chambers", 0.5), fPush = at("pushed", 3.3, -200), fRise = at("rises", 5.2);
    const A1: Pose = revealPose(1);
    const A2: Pose = { p: new THREE.Vector3(0.6, 0.42, 1.7), t: new THREE.Vector3(0.1, 0.24, 0), fov: 26 };
    const kA = heavyOut(frame / (1.6 * fps));
    const truck = inertia(clamp((frame - 1.2 * fps) / Math.max(1, fPush - 1.2 * fps))) * 0.65;
    const poseA = lerpPose(A1, A2, kA); poseA.p.x -= truck * kA; poseA.t.x -= truck * kA;
    const B: Pose = { p: new THREE.Vector3(0, 1.1, 9.6), t: new THREE.Vector3(0, 0.30, 0), fov: 24 };   // dikey kadrajda tüm boy (~%88) ancak ~9.6 birimden sığar
    pose = frame < fPush ? poseA : lerpPose(poseA, B, heavyOut((frame - fPush) / (1.8 * fps)));
    hi = Easing.out(Easing.cubic)(clamp((frame - fCh) / (0.6 * fps))) * (1 - clamp((frame - fPush) / (0.8 * fps)));
    waterY = THREE.MathUtils.lerp(-0.3, 0.2, ease((frame - fPush) / (0.8 * fps)));
    lift = 0.10 * ease((frame - fRise) / (1.6 * fps));
    bob = 0.004 * Math.sin(frame / 14) * clamp((frame - fRise) / fps);
    showPlinth = frame < fPush + 0.8 * fps;
    fogFar = THREE.MathUtils.lerp(10, 22, heavyOut((frame - fPush) / (1.8 * fps)));
  } else if (shot === "rest") {
    const k = inertia(u);
    const a = THREE.MathUtils.degToRad(40 - 10 * k), r = 5.0 + 1.4 * k;
    pose = { p: new THREE.Vector3(Math.sin(a) * r, 1.2 + 0.4 * k, Math.cos(a) * r), t: new THREE.Vector3(0, 0.05, 0), fov: 30 };
    cone = 26 - 4 * k;
  } else {
    const a = THREE.MathUtils.degToRad(360 * u);
    pose = { p: new THREE.Vector3(Math.sin(a) * 6, 1.5, Math.cos(a) * 6), t: new THREE.Vector3(0, 0.05, 0), fov: 30 };
  }
  const cam = useThree((st) => st.camera) as THREE.PerspectiveCamera;
  cam.fov = pose.fov; cam.aspect = width / height; cam.near = 0.05; cam.far = 50;
  cam.position.copy(pose.p); cam.lookAt(pose.t); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  root.position.set(0, lift + bob, 0);

  const keyL = useMemo(() => { const l = new THREE.SpotLight("#ffe7c4", 0, 14, THREE.MathUtils.degToRad(26), 0.55, 1.4); l.castShadow = true; l.shadow.mapSize.set(2048, 2048); l.shadow.bias = -0.0004; l.shadow.radius = 6; return l; }, []);
  keyL.position.set(1.6, 4.2, 1.8); keyL.target.position.set(0, 0.2, 0); keyL.target.updateMatrixWorld();
  keyL.intensity = 85 * key; keyL.angle = THREE.MathUtils.degToRad(cone);
  const rimL = useMemo(() => new THREE.DirectionalLight("#9fc4ff", 0), []);
  rimL.position.set(-2.5, 1.6, -3.2); rimL.intensity = 3.2 * rim;
  // körük vurgusu: dar sıcak yalayıcı spot (çizgi/daire yok)
  const hiL = useMemo(() => new THREE.SpotLight("#ffd9a8", 0, 4, THREE.MathUtils.degToRad(8), 0.6, 1.2), []);
  hiL.position.set(-0.6, 0.35, 1.4); hiL.target.position.set(0.1, 0.23, 0.18); hiL.target.updateMatrixWorld();
  hiL.intensity = 14 * hi;
  // su: gerçek ayna yansıması (Reflector; tekne ve spot suda görünür) + üstünde dalgacıklı yarı saydam yüzey (oda ortamı yansıması, ışık parlaması)
  const gl = useThree((st) => st.gl);
  const mirror = useMemo(() => new Reflector(new THREE.PlaneGeometry(40, 40), { textureWidth: width, textureHeight: height, color: new THREE.Color("#7f98a1"), clipBias: 0.003 }), [width, height]);
  const water = useMemo(() => {
    const env = new THREE.PMREMGenerator(gl).fromScene(new RoomEnvironment(), 0.04).texture;
    return new THREE.MeshPhysicalMaterial({ color: "#16323b", roughness: 0.16, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.1, transparent: true, opacity: 0.55,
      normalMap: rippleNormals(), normalScale: new THREE.Vector2(0.35, 0.35), envMap: env, envMapIntensity: 0.35 });
  }, [gl]);
  water.normalMap!.offset.set(frame * 0.0009, frame * 0.0005);

  return (
    <>
      <fog attach="fog" args={["#060607", fogFar * 0.55, fogFar]} />
      <ambientLight intensity={0.03 + 0.04 * key} color="#c9d4e6" />
      <primitive object={keyL} /><primitive object={keyL.target} />
      <primitive object={rimL} />
      <primitive object={hiL} /><primitive object={hiL.target} />
      <primitive object={root} />
      {showPlinth ? (
        <mesh position={[0, -0.04, 0]} receiveShadow castShadow>
          <boxGeometry args={[root.userData.dims.x * 1.08, 0.08, root.userData.dims.z * 1.5]} />
          <meshStandardMaterial color="#0b0a09" roughness={0.45} />
        </mesh>
      ) : null}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]} receiveShadow><planeGeometry args={[40, 40]} /><meshStandardMaterial color="#050506" roughness={0.9} /></mesh>
      {waterY > -0.25 ? <>
        <primitive object={mirror} rotation={[-Math.PI / 2, 0, 0]} position={[0, waterY - 0.002, 0]} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, waterY, 0]} material={water}><planeGeometry args={[40, 40]} /></mesh>
      </> : null}
      <Dust frame={frame} center={new THREE.Vector3(0.5, 1.4, 0.5)} spread={1.5} opacity={0.32 * key} />
    </>
  );
};

// ThreeCanvas'ın varsayılan kamerasını bizim kameramızla değiştir
const DefaultCam: React.FC<{ cam: THREE.PerspectiveCamera }> = ({ cam }) => {
  const set = useThree((s) => s.set);
  useEffect(() => { set({ camera: cam }); }, [cam, set]);
  return null;
};

export const MuseumObject: React.FC<MuseumObjectProps> = ({ model, up, shot = "reveal", words, insert }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames, fps } = useVideoConfig();
  // insert: tuvalin üstünde HTML fotoğraf katmanı (s08: çağdaş kurtarma balonları), aynı vinyet/tane; son outBlackMs siyaha iner
  let ins: React.ReactNode = null, black = 0;
  if (insert) {
    const f0 = wordAt(words, insert.at, fps, durationInFrames / fps * 0.45, -100);
    const op = clamp((frame - f0) / ((insert.fadeMs ?? 900) / 1000 * fps));
    const a = insert.from ?? { x: 0.5, y: 0.5, zoom: 1.04 }, b = insert.to ?? { x: 0.5, y: 0.5, zoom: 1.14 };
    const k = clamp((frame - f0) / Math.max(1, durationInFrames - f0));
    const z = a.zoom + (b.zoom - a.zoom) * k, x = a.x + (b.x - a.x) * k, y = a.y + (b.y - a.y) * k;
    ins = op > 0 ? <AbsoluteFill style={{ opacity: op }}><Img src={staticFile(insert.image)} style={{ width: "100%", height: "100%", objectFit: "cover", transformOrigin: `${x * 100}% ${y * 100}%`, transform: `scale(${z})`, filter: "saturate(0.85)" }} /></AbsoluteFill> : null;
  }
  const outMs = insert?.outBlackMs ?? 0;
  if (outMs) black = Easing.inOut(Easing.quad)(clamp((frame - (durationInFrames - outMs / 1000 * fps)) / (outMs / 1000 * fps)));
  const root = useModel(model, up);
  return (
    <AbsoluteFill style={{ backgroundColor: "#060607" }}>
      {root ? <ThreeCanvas width={width} height={height} shadows gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05, outputColorSpace: THREE.SRGBColorSpace }}>
        <Scene frame={frame} dur={durationInFrames} fps={fps} shot={shot} root={root} width={width} height={height} words={words} />
      </ThreeCanvas> : null}
      {ins}
      {/* vinyet + tane (film dokusu) */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 46%, rgba(0,0,0,0) 38%, rgba(0,0,0,0.72) 100%)" }} />
      <AbsoluteFill style={{ opacity: 0.07, mixBlendMode: "overlay", backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='${frame % 24}'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")` }} />
      {black > 0 ? <AbsoluteFill style={{ backgroundColor: "#000", opacity: black }} /> : null}
    </AbsoluteFill>
  );
};
