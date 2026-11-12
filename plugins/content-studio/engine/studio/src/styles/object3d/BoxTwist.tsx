// object3d tekniği, kodla kurulmuş kahraman nesne (2026-11-12, EP015): iki ucu açık, uzun kraft iç lastik kutusu, uzun ekseni etrafında burulur.
// Gerçek taraması olmayan nesneler için MuseumObject'in prosedürel kardeşi: aynı ışık dili (tek sıcak spot, soğuk kenar, ACES, toz, vinyet, tane).
// Burulma CPU'da: her kesit x konumuna göre θ(x) = twist · x/(L/2) döner (uzun kenarlar düz kalır, "kutu şeklini korur").
// props: shot "hero" (karanlıktan spot, yavaş yörünge, `twistAt` kelimesinde bir kez burulup dinlenir) | "still" (saydam zemin, tek kare,
// `twist` sabit açı, kesik/objectWipe PNG'si için). Malzeme: content/textures/cardboard002/ (ambientCG Cardboard002, CC0). Yazı/logo yok.
// Render: tools/woodcut_render.py <EP> --only sNN (style object3d, props.comp "BoxTwist"); still: remotion still … BoxTwist x.png --props='{"shot":"still"}'
import { useEffect, useMemo, useState } from "react";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, Easing, cancelRender, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useThree } from "@react-three/fiber";
import { wordAt } from "./MuseumObject";

type Word = { text: string; startMs: number; endMs: number };
export type BoxTwistProps = {
  shot?: "hero" | "still"; twist?: number; twistAt?: string; twistDeg?: number; azimuth?: number; durationInFrames?: number; words?: Word[];
};

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const inertia = (t: number) => 0.35 * t + 0.65 * t * t * (3 - 2 * t);
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const L = 2.6, W = 0.5, H = 0.42, T = 0.014;   // uzunluk (x), en (z), yükseklik (y), duvar kalınlığı

// dört duvar + iki uçta açık üst kapakçık; tek geometri, dünya koordinatından UV (yüz normaline göre düzlemsel)
const buildBox = () => {
  const parts: THREE.BufferGeometry[] = [];
  const top = new THREE.BoxGeometry(L, T, W, 64, 1, 2); top.translate(0, H / 2, 0); parts.push(top);
  const bot = new THREE.BoxGeometry(L, T, W, 64, 1, 2); bot.translate(0, -H / 2, 0); parts.push(bot);
  const fr = new THREE.BoxGeometry(L, H, T, 64, 2, 1); fr.translate(0, 0, W / 2); parts.push(fr);
  const bk = new THREE.BoxGeometry(L, H, T, 64, 2, 1); bk.translate(0, 0, -W / 2); parts.push(bk);
  for (const s of [-1, 1]) {   // kapakçık: üst kenardan menteşeli, dışa ~118° açık, hafif sarkık (iki uçta farklı açı: el değmiş kutu)
    const fl = new THREE.BoxGeometry(0.17, T * 0.8, W * 0.98, 4, 1, 2);
    fl.translate(s * 0.085, 0, 0);
    fl.rotateZ(s * THREE.MathUtils.degToRad(s > 0 ? 118 : 104));
    fl.translate(s * L / 2, H / 2, 0);
    parts.push(fl);
  }
  const g = mergeGeometries(parts.map((p) => p.toNonIndexed()), false)!;
  const pos = g.attributes.position as THREE.BufferAttribute, nor = g.attributes.normal as THREE.BufferAttribute;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i));
    const [u, v] = ay > 0.5 ? [x, z] : ax > 0.5 ? [z, y] : [x, y];
    uv[i * 2] = u / 1.1; uv[i * 2 + 1] = v / 1.1;
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.userData.rest = Float32Array.from(pos.array as Float32Array);
  return g;
};

const applyTwist = (g: THREE.BufferGeometry, tw: number) => {
  const rest = g.userData.rest as Float32Array, pos = g.attributes.position as THREE.BufferAttribute, a = pos.array as Float32Array;
  for (let i = 0; i < pos.count; i++) {
    const x = rest[i * 3], y = rest[i * 3 + 1], z = rest[i * 3 + 2];
    const th = tw * clamp(x / (L / 2), -1.08, 1.08), c = Math.cos(th), s = Math.sin(th);
    a[i * 3] = x; a[i * 3 + 1] = y * c - z * s; a[i * 3 + 2] = y * s + z * c;
  }
  pos.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingSphere();
};

const useTextures = () => {
  const [tex, setTex] = useState<{ map: THREE.Texture; nrm: THREE.Texture; rgh: THREE.Texture; wood: THREE.Texture } | null>(null);
  const [handle] = useState(() => delayRender("boxtwist textures", { timeoutInMilliseconds: 60000 }));
  useEffect(() => {
    const ld = new THREE.TextureLoader();
    const get = (p: string) => new Promise<THREE.Texture>((res, rej) => ld.load(staticFile(p), res, undefined, rej));
    Promise.all([get("textures/cardboard002/color.jpg"), get("textures/cardboard002/normal.jpg"), get("textures/cardboard002/roughness.jpg"), get("textures/wood-table-large.jpg")])
      .then(([map, nrm, rgh, wood]) => {
        for (const t of [map, nrm, rgh]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; }
        map.colorSpace = THREE.SRGBColorSpace; wood.colorSpace = THREE.SRGBColorSpace;
        wood.wrapS = wood.wrapT = THREE.RepeatWrapping; wood.repeat.set(3, 3);
        setTex({ map, nrm, rgh, wood }); continueRender(handle);
      }).catch((e) => cancelRender(e));
  }, [handle]);
  return tex;
};

const Dust: React.FC<{ frame: number; opacity: number }> = ({ frame, opacity }) => {
  const n = 170;
  const geo = useMemo(() => new THREE.BufferGeometry(), []);
  const pos = useMemo(() => new Float32Array(n * 3), []);
  const t = frame / 30;
  for (let i = 0; i < n; i++) {
    pos[i * 3] = 0.6 + (hash(i) - 0.5) * 2.2 + 0.04 * Math.sin(t * 0.3 + i);
    pos[i * 3 + 1] = 0.2 + (((hash(i + 7) + t * 0.012 * (0.5 + hash(i + 3))) % 1)) * 2.4;
    pos[i * 3 + 2] = 0.6 + (hash(i + 13) - 0.5) * 2.2 + 0.04 * Math.cos(t * 0.25 + i * 1.7);
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.attributes.position.needsUpdate = true;
  return <points geometry={geo}><pointsMaterial color="#fff4dc" size={0.011} transparent opacity={opacity} depthWrite={false} sizeAttenuation /></points>;
};

const Scene: React.FC<{ frame: number; dur: number; fps: number; p: BoxTwistProps; width: number; height: number; tex: NonNullable<ReturnType<typeof useTextures>> }> = ({ frame, dur, fps, p, width, height, tex }) => {
  const still = p.shot === "still";
  const geo = useMemo(buildBox, []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ map: tex.map, normalMap: tex.nrm, normalScale: new THREE.Vector2(0.6, 0.6), roughnessMap: tex.rgh, roughness: 0.92, metalness: 0, side: THREE.DoubleSide, color: "#cdbfa8" }), [tex]);
  const floorMat = useMemo(() => new THREE.MeshStandardMaterial({ map: tex.wood, color: "#4a3a2e", roughness: 0.82 }), [tex]);

  // burulma: hero'da twistAt kelimesinden 200 ms önce başlar, sin yayı (yükselir, ~0.3 sn durur, döner), toplam 2.8 sn
  let tw = THREE.MathUtils.degToRad(p.twist ?? 0);
  let key = 1, rim = 1, k = 0;
  if (!still) {
    const f0 = wordAt(p.words, p.twistAt ?? "made", fps, dur / fps * 0.5, -200), span = 2.8 * fps;
    const g = clamp((frame - f0) / span);
    tw = THREE.MathUtils.degToRad(p.twistDeg ?? 16) * Math.sin(Math.PI * Easing.inOut(Easing.cubic)(g));
    key = Easing.inOut(Easing.cubic)(clamp((frame - 0.25 * fps) / (1.3 * fps))) * (1 - 0.3 * clamp((frame - (dur - 2.2 * fps)) / (2.2 * fps)));
    rim = 0.4 + 0.6 * Easing.out(Easing.cubic)(clamp((frame - 0.4 * fps) / (1.0 * fps)));
    k = inertia(clamp(frame / Math.max(1, dur - 0.5 * fps)));
  }
  applyTwist(geo, tw);

  const az = THREE.MathUtils.degToRad(still ? (p.azimuth ?? 28) : 60 - 14 * k);
  const r = still ? 11 : 7.6 - 1.0 * k;
  const camY = still ? 2.6 : 2.3 - 0.35 * k;
  const cam = useThree((st) => st.camera) as THREE.PerspectiveCamera;
  cam.fov = still ? 26 : 34; cam.aspect = width / height; cam.near = 0.05; cam.far = 60;
  cam.position.set(Math.sin(az) * r, camY, Math.cos(az) * r);
  cam.lookAt(still ? 0.05 : 0.3, still ? H / 2 : -0.22 - 0.04 * k, 0); cam.updateProjectionMatrix(); cam.updateMatrixWorld();

  const keyL = useMemo(() => { const l = new THREE.SpotLight("#ffe7c4", 0, 16, THREE.MathUtils.degToRad(24), 0.55, 1.4); l.castShadow = true; l.shadow.mapSize.set(2048, 2048); l.shadow.bias = -0.0004; l.shadow.radius = 6; return l; }, []);
  keyL.position.set(1.9, 4.6, 2.4); keyL.target.position.set(0, 0.2, 0); keyL.target.updateMatrixWorld();
  keyL.intensity = (still ? 70 : 90) * key;
  const rimL = useMemo(() => new THREE.DirectionalLight("#9fc4ff", 0), []);
  rimL.position.set(-2.8, 1.8, -3.0); rimL.intensity = (still ? 2.4 : 2.2) * rim;
  const fillL = useMemo(() => new THREE.HemisphereLight("#d9c9b0", "#1a1410", 0), []);
  fillL.intensity = still ? 0.9 : 0.12 * key;

  return (
    <>
      {still ? null : <fog attach="fog" args={["#060607", 6, 13]} />}
      <ambientLight intensity={still ? 0.25 : 0.02 + 0.02 * key} color="#d8d2c8" />
      <primitive object={fillL} />
      <primitive object={keyL} /><primitive object={keyL.target} />
      <primitive object={rimL} />
      <mesh geometry={geo} material={mat} position={[0, H / 2 + T, 0]} castShadow receiveShadow />
      {still ? null : <>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow material={floorMat}><planeGeometry args={[30, 30]} /></mesh>
        <Dust frame={frame} opacity={0.3 * key} />
      </>}
    </>
  );
};

export const BoxTwist: React.FC<BoxTwistProps> = (props) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames, fps } = useVideoConfig();
  const tex = useTextures();
  const still = props.shot === "still";
  return (
    <AbsoluteFill style={{ backgroundColor: still ? "transparent" : "#060607" }}>
      {tex ? <ThreeCanvas width={width} height={height} shadows gl={{ antialias: true, alpha: still, premultipliedAlpha: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05, outputColorSpace: THREE.SRGBColorSpace }}>
        <Scene frame={frame} dur={durationInFrames} fps={fps} p={props} width={width} height={height} tex={tex} />
      </ThreeCanvas> : null}
      {still ? null : <>
        <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 44%, rgba(0,0,0,0) 36%, rgba(0,0,0,0.74) 100%)" }} />
        <AbsoluteFill style={{ opacity: 0.07, mixBlendMode: "overlay", backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='${frame % 24}'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")` }} />
      </>}
    </AbsoluteFill>
  );
};
