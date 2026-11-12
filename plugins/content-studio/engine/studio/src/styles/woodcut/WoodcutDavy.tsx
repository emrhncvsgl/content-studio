// EP014 Davy lambası, ağaç baskı açılışı (9:16, 1080x1920; storyboard s01-s02). Kit: ./kit (three.js sahne → baskı shader'ı).
// shot "flame" (s01): alçak kömür galerisi, eğik madenci silueti çubuğun ucunda çıplak mumu tavana uzatır. Tek renk plaka yalnız alev (#d9692a).
//   Alev "lengthen" ile uzar ve tavanı yalar (ölçek + parlama, 2 karede bir yeniden oyulur); kamera alevde yavaş itiş (inertia, ≤ %10/sn).
//   "lengthen" bitince sert kesme: alev ve ışık yok, yalnız oyulmamış kara kalıp + kâğıt payı (1.8 sn sessiz karanlık; patlama YOK).
// shot "grid" (s02): aynı kara kalıp; karanlığa çapraz tel ızgarası oyulur (kaba → ince), "mesh" ile ızgaranın ardında 4 kor yanar.
//   Son 0.8 sn: kâğıt yukarıdan iner ve kalıbı örter (baskı grameri: kâğıt iner → s03 planı kâğıttan açılır, timeline geçişi "blur").
import { useMemo } from "react";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, Easing, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { carveMat, clamp, flameFrag, flameVert, hash, inertia, litMat, onTwos, StandingFigure, Stroke, usePrint, wordFrame, type Word } from "./kit";

type Shot = "flame" | "grid";
const flameGeo = () => { const g = new THREE.PlaneGeometry(0.1, 0.22); g.translate(0, 0.0748, 0); return g; };   // taban (uv y 0.16) orijinde
const flameMatNew = () => new THREE.ShaderMaterial({ vertexShader: flameVert, fragmentShader: flameFrag, transparent: false, side: THREE.DoubleSide,
  uniforms: { uFlame: { value: 1 }, uT: { value: 0 }, uFlare: { value: 0 } } });

const Gallery: React.FC<{ mats: Record<string, THREE.Material> }> = ({ mats }) => (
  <>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, 0]} material={mats.floor}><planeGeometry args={[4, 4]} /></mesh>
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.8, 0]} material={mats.roof}><planeGeometry args={[4, 4]} /></mesh>
    <mesh position={[0, 0.1, -0.7]} material={mats.wall}><planeGeometry args={[4, 2]} /></mesh>
    {/* ahşap destekler: iki dikme + başlık kirişi (önde ve arkada), kömür kesiti duvarı */}
    {[-0.55, 0.62].map((x) => <mesh key={x} position={[x, 0.1, -0.15]} material={mats.timber}><boxGeometry args={[0.09, 1.4, 0.09]} /></mesh>)}
    <mesh position={[0.03, 0.74, -0.15]} material={mats.timber}><boxGeometry args={[1.35, 0.09, 0.1]} /></mesh>
    {[-0.5, 0.58].map((x) => <mesh key={`b${x}`} position={[x, 0.1, -0.62]} material={mats.timber}><boxGeometry args={[0.08, 1.4, 0.08]} /></mesh>)}
    <mesh position={[0.04, 0.74, -0.62]} material={mats.timber}><boxGeometry args={[1.2, 0.08, 0.08]} /></mesh>
    {/* yerde birkaç kömür parçası ve kazma sapı */}
    {[0, 1, 2, 3, 4].map((i) => <mesh key={`c${i}`} position={[-0.35 + 0.17 * i + 0.05 * hash(i), -0.57, 0.25 - 0.2 * hash(i + 4)]} rotation={[hash(i) * 3, hash(i + 1) * 3, 0]} material={mats.coal}>
      <dodecahedronGeometry args={[0.035 + 0.02 * hash(i + 9), 0]} /></mesh>)}
    <mesh position={[0.42, -0.42, 0.05]} rotation={[0, 0, 0.5]} material={mats.timber}><cylinderGeometry args={[0.012, 0.012, 0.42, 8]} /></mesh>
  </>
);

const Scene: React.FC<{ frame: number; fps: number; width: number; height: number; dur: number; words?: Word[]; shot: Shot }> = ({ frame, fps, width, height, dur, words, shot }) => {
  const { update, camera } = usePrint(width, height, { seed: shot === "flame" ? 14.0 : 15.0, halo: 5 });
  const mats = useMemo(() => ({
    floor: litMat(0.5, 1, 0.2), roof: litMat(0.55, 1, 0.2), wall: litMat(0.5, 0, 0.45), timber: litMat(0.62, 1, 0.9), coal: litMat(0.5, 0, 0.9),
    fig: litMat(0.42, 0, 0.75), candle: litMat(1.0, 0, 0.6), carve: carveMat(),
  }), []);
  const flame = useMemo(() => ({ geo: flameGeo(), mat: flameMatNew() }), []);
  const embers = useMemo(() => [0, 1, 2, 3].map(() => flameMatNew()), []);
  const tip = useMemo(() => new THREE.Vector3(0.2, 0.6, 0.16), []);   // mumun ucu (alev tabanı)
  const f2 = onTwos(frame);

  if (shot === "flame") {
    const fLen = wordFrame(words, "lengthen", fps, 3.8);
    const fCut = wordFrame(words, "lengthen", fps, 4.6, "end") + 5;   // sert kesme: söz bitince ~0.17 sn
    const lit = frame < fCut;
    // alev: başta sakin; "begins" ile kıpırdar, "lengthen" ile uzar ve tavanı yalar (ağır kalkış, ease-in: kesmede en uzun, hâlâ büyüyor)
    const fBeg = wordFrame(words, "begins", fps, 3.2);
    const grow = Easing.in(Easing.quad)(clamp((f2 - fBeg) / Math.max(8, fCut - fBeg)));
    const sy = 1 + 2.3 * grow, sx = 1 + 0.35 * grow;
    flame.mat.uniforms.uT.value = f2 / fps;
    flame.mat.uniforms.uFlare.value = 0.75 * grow;
    flame.mat.uniforms.uFlame.value = lit ? 1 : 0;
    const flick = 1 + 0.05 * Math.sin(f2 * 1.9) + 0.05 * (hash(Math.floor(f2 / 2)) - 0.5);
    const lightI = lit ? (2.2 + 2.4 * grow) * flick * Easing.out(Easing.cubic)(clamp(frame / 10)) : 0;
    const lp = tip.clone().add(new THREE.Vector3(0, 0.08 + 0.14 * grow, 0));
    Object.values(mats).forEach((m) => { const u = (m as THREE.ShaderMaterial).uniforms; if (u?.uLight) { u.uLight.value.copy(lp); u.uI.value = lightI; } });
    // kamera: "dolly in on the flame, slow, inertia" (kesmeye kadar; kesmeden sonra aynı yerde durur)
    const k = inertia(clamp(frame / Math.max(1, fCut)));
    camera.position.set(-0.05 + 0.16 * k + 0.006 * Math.sin(frame / 41), 0.12 + 0.24 * k, 2.25 - 0.62 * k);
    camera.lookAt(0.06 + 0.1 * k, 0.28 + 0.22 * k, 0); camera.fov = 44; camera.updateProjectionMatrix();
    update(lp, lit ? 60 + 2600 * Easing.inOut(Easing.cubic)(clamp(frame / 34)) : 0);
    const faceY = Math.atan2(camera.position.x - tip.x, camera.position.z - tip.z);
    return (
      <>
        <Gallery mats={mats} />
        {/* madenci: tavan alçak, eğik duruyor; sağ kol yukarı-öne, elinde çubuk, çubuğun ucunda çıplak mum */}
        <group position={[-0.2, -0.6, 0.1]} rotation={[0.18, 0.55, 0]}><StandingFigure mat={mats.fig} position={[0, 0, 0]} scale={0.86} cap /></group>
        <Stroke points={[[-0.06, 0.3, 0.16], [0.03, 0.4, 0.2], [0.09, 0.44, 0.2]]} progress={1} radius={0.032} mat={mats.fig} />
        <Stroke points={[[0.08, 0.43, 0.2], [0.14, 0.52, 0.18], [0.2, 0.585, 0.16]]} progress={1} radius={0.007} mat={mats.timber} />
        <mesh position={[tip.x, tip.y - 0.012, tip.z]} material={mats.candle}><cylinderGeometry args={[0.011, 0.012, 0.03, 10]} /></mesh>
        {lit ? <mesh geometry={flame.geo} material={flame.mat} position={tip} rotation={[0, faceY, 0]} scale={[sx * 0.55, sy * 0.55, 1]} /> : null}
      </>
    );
  }

  // grid: ışık neredeyse yok; çapraz tel ızgarası oyulur (önce 4+4 kaba, sonra 6+6 ince), "mesh" ile ardında korlar
  const fMesh = wordFrame(words, "mesh", fps, 1.5);
  const glow = clamp((f2 - fMesh) / 10);
  embers.forEach((m, i) => { m.uniforms.uT.value = f2 / fps + i; m.uniforms.uFlame.value = glow * (0.55 + 0.25 * Math.sin(f2 * 0.21 + i * 2.1)); m.uniforms.uFlare.value = 0.2; });
  const ep = new THREE.Vector3(0.0, 0.42, -0.25);
  Object.values(mats).forEach((m) => { const u = (m as THREE.ShaderMaterial).uniforms; if (u?.uLight) { u.uLight.value.copy(ep); u.uI.value = 0.55 * glow; } });
  const k = inertia(clamp(frame / dur));
  camera.position.set(0.05, 0.42, 1.45 - 0.2 * k); camera.lookAt(0.05, 0.42, 0); camera.fov = 44; camera.updateProjectionMatrix();
  update(ep, 6000);
  const lines: { p: [number, number, number][]; a: number; r: number }[] = [];
  const C = [0.05, 0.42, 0.0], S = 0.5;
  const mk = (n: number, a0: number, r: number, off: number) => {
    for (let i = 0; i < n; i++) {
      const s = (i - (n - 1) / 2) / ((n - 1) / 2) * S * 0.62 + off;
      for (const dir of [1, -1]) {
        const ang = dir * Math.PI / 4, ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
        const ox = C[0] + nx * s, oy = C[1] + ny * s;
        lines.push({ p: [[ox - ux * S, oy - uy * S, 0.02], [ox, oy, 0.02], [ox + ux * S, oy + uy * S, 0.02]], a: a0 + i * 4 + (dir > 0 ? 0 : 2), r });
      }
    }
  };
  mk(4, 3, 0.006, 0); mk(6, 30, 0.0028, 0.105);
  return (
    <>
      <mesh position={[0, 0.3, -0.7]} material={mats.wall}><planeGeometry args={[4, 3]} /></mesh>
      {embers.map((m, i) => <mesh key={i} geometry={flame.geo} material={m} position={[-0.16 + 0.12 * i + 0.03 * hash(i), 0.3 + 0.18 * hash(i + 3), -0.25]} scale={[0.32, 0.26, 1]} />)}
      {lines.map((l, i) => <Stroke key={i} points={l.p} progress={Easing.out(Easing.cubic)(clamp((f2 - l.a) / 14))} radius={l.r} mat={mats.carve} />)}
    </>
  );
};

export const WoodcutDavy: React.FC<{ durationInFrames?: number; words?: Word[]; shot?: Shot }> = ({ words, shot = "flame" }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  // s02 sonu: kâğıt yukarıdan iner (heavy ease-out), alt kenarı yırtık; s03'e "blur" geçişi kâğıttan açılır
  const peel = shot === "grid" ? Easing.bezier(0.16, 1, 0.3, 1)(clamp((frame - (durationInFrames - 26)) / 22)) : 0;
  const torn = Array.from({ length: 25 }, (_, i) => `${i * 100 / 24}% ${96 + 4 * hash(i + 7)}%`).join(", ");
  return (
    <AbsoluteFill style={{ backgroundColor: "#e8dcc1" }}>
      <ThreeCanvas width={width} height={height} camera={{ fov: 44, near: 0.05, far: 20, position: [0, 0.2, 2.2] }} gl={{ antialias: true }}>
        <Scene frame={frame} fps={fps} width={width} height={height} dur={durationInFrames} words={words} shot={shot} />
      </ThreeCanvas>
      {peel > 0 ? <AbsoluteFill style={{ backgroundColor: "#e8dcc1", transform: `translateY(${(-104 + 104 * peel).toFixed(2)}%)`,
        clipPath: `polygon(0% 0%, 100% 0%, ${torn.split(", ").reverse().join(", ")})`, boxShadow: "0 18px 40px rgba(0,0,0,0.45)" }} /> : null}
    </AbsoluteFill>
  );
};
