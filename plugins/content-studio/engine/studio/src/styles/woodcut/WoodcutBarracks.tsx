// EP009 Vorkuta barakası (ağaç baskı; tek 3D set, üç kamera satırı; storyboard s29/s30/s30b).
//  shot "wide"  (s29): gaz lambası alevi oyulur, ışık ranzalara yayılır; ortada genç, çevresinde dört yaşlı. "keep learning" genç başını
//                kaldırır (ikişer kare) · "teachers" yaşlılar ona döner (3 kare kademe). Kamera: dolly in, slow, inertia, gence doğru.
//  shot "board" (s30): crane up ranzaların üstüne; arka duvardaki tahta levhada çizimler sözcüklerde oyulur (sarkaç, sinüs, el yazısı, harfler);
//                "one student university" pull-back reveal: altta tek genç, çevresinde yaşlılar.
//  shot "slate" (s30b, diyalog): soba ağzının ışığında yaşlı el arduvaza tebeşirle sinüs çizer. "Again." siler (tebeşir tozu) ·
//                "From the beginning." yeniden başlar · "Slowly, this time." çizgi yavaş ve düzgün uzar. Yüz yok.
import { useMemo } from "react";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, Easing, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { carveMat, clamp, flameFrag, flameVert, hash, inertia, litMat, onTwos, SeatedFigure, Stroke, usePrint, wordFrame, type Word } from "./kit";

type Shot = "wide" | "board" | "slate";
const sine = (x0: number, x1: number, y: number, z: number, amp: number, cycles: number, n = 40): [number, number, number][] =>
  Array.from({ length: n }, (_, i) => { const u = i / (n - 1); return [x0 + (x1 - x0) * u, y + amp * Math.sin(u * cycles * Math.PI * 2), z]; });

const Scene: React.FC<{ frame: number; fps: number; width: number; height: number; dur: number; words?: Word[]; shot: Shot }> =
  ({ frame, fps, width, height, dur, words, shot }) => {
  const { update, camera } = usePrint(width, height, { seed: shot === "slate" ? 21 : 17, halo: 4 });
  const mats = useMemo(() => ({
    floor: litMat(0.45, 1, 0.2), wall: litMat(0.5, 0, 0.45), bunk: litMat(0.55, 1, 0.9), fig: litMat(0.42, 0, 0.75),
    young: litMat(0.6, 0, 0.75), figBack: litMat(0.18, 0, 0.75), board: litMat(0.25, 0, 0.9), slate: litMat(0.18, 0, 0.9), stove: litMat(0.4, 0, 0.9),
    carve: carveMat(),
    flame: new THREE.ShaderMaterial({ vertexShader: flameVert, fragmentShader: flameFrag, uniforms: { uFlame: { value: 0 }, uT: { value: 0 }, uFlare: { value: 0 } } }),
  }), []);
  const t = frame / fps;
  const f2 = onTwos(frame);
  // ışık: s29/s30 gaz lambası (masa sandığında), s30b soba ağzı
  const lampPos = useMemo(() => new THREE.Vector3(0.3, 0.12, -0.32), []);   // grubun arkasında: figürler siluet
  const stovePos = useMemo(() => new THREE.Vector3(-1.62, 0.2, -0.32), []);   // arduvazın sol arkasında: ışığı levhaya düşer, levhayı örtmez
  const light = shot === "slate" ? stovePos : lampPos;
  const flick = 1 + 0.07 * Math.sin(t * 2 * Math.PI * 7.3) + 0.05 * (hash(Math.floor(frame / 2)) - 0.5);
  const ignite = shot === "wide" ? Easing.out(Easing.cubic)(clamp((frame - 8) / 22)) : 1;
  const lightI = (shot === "slate" ? 1.6 : 2.6) * ignite * flick;
  const reveal = shot === "wide" ? 40 + 2200 * Easing.inOut(Easing.cubic)(clamp((frame - 8) / 60)) : 2600;
  Object.values(mats).forEach((m) => { if (m.uniforms.uLight) { m.uniforms.uLight.value.copy(light); m.uniforms.uI.value = lightI; } });
  mats.flame.uniforms.uFlame.value = 0.95 * ignite * flick; mats.flame.uniforms.uT.value = t;

  // s29 vuruşları
  const fLearn = wordFrame(words, "keep learning", fps, 2.6), fTeach = wordFrame(words, "teachers", fps, 6.2);
  const youngLift = Easing.out(Easing.cubic)(clamp((f2 - fLearn) / 10));
  const elderTurn = (i: number) => Easing.inOut(Easing.cubic)(clamp((f2 - fTeach - 3 * i) / 12));
  // s30 vuruşları (levha çizimleri)
  const fPhys = wordFrame(words, "physics", fps, 2.0), fMath = wordFrame(words, "mathematics", fps, 2.4);
  const fLit = wordFrame(words, "literature", fps, 3.1), fLang = wordFrame(words, "languages", fps, 3.9);
  const fUni = wordFrame(words, "one student university", fps, 7.1);
  const draw = (f0: number, len = 14) => Easing.out(Easing.quad)(clamp((frame - f0) / len));
  // s30b vuruşları (tebeşir)
  const fAgain = wordFrame(words, "again", fps, 0.1), fBegin = wordFrame(words, "from", fps, 1.5), fSlow = wordFrame(words, "slowly", fps, 2.1);
  const before = 0.55 * clamp(1 - (frame - fAgain) / 9);                         // yarım kalmış çizgi, "Again" ile silinir
  const chalk = frame < fBegin ? before : 0.22 * Easing.out(Easing.quad)(clamp((frame - fBegin) / 10))
    + 0.78 * Easing.inOut(Easing.sin)(clamp((frame - fSlow) / Math.max(30, dur - fSlow - 30)));

  // kamera satırları
  if (shot === "wide") {
    const k = inertia(clamp(frame / dur));
    camera.position.set(0.08 - 0.05 * k, 0.75 - 0.08 * k, 2.6 - 0.75 * k); camera.lookAt(0, 0.35, 0); camera.fov = 42;
  } else if (shot === "board") {
    const up = Easing.inOut(Easing.cubic)(clamp(frame / Math.max(60, fLang + 20)));       // crane up: levhaya
    const back = Easing.inOut(Easing.cubic)(clamp((frame - fUni + 8) / 50));               // pull-back reveal
    camera.position.set(0.0, 0.7 + 0.75 * up - 0.55 * back, 2.3 - 0.7 * up + 1.05 * back);
    camera.lookAt(0, 0.4 + 0.85 * up - 0.75 * back, -0.6); camera.fov = 42;
  } else {
    const k = inertia(clamp(frame / dur));
    camera.position.set(-0.98 + 0.04 * k, 0.5, 1.05 - 0.22 * k); camera.lookAt(-1.18, 0.42, 0.05); camera.fov = 36;
  }
  camera.updateProjectionMatrix();
  update(light, reveal);
  const q = camera.quaternion;

  const bunk = (x: number, z: number, key: string) => (
    <group key={key} position={[x, 0, z]}>
      {[-0.42, 0.42].flatMap((dx) => [-0.3, 0.3].map((dz) => (
        <mesh key={`${dx}${dz}`} material={mats.bunk} position={[dx, 0.45, dz]}><boxGeometry args={[0.05, 1.9, 0.05]} /></mesh>)))}
      {[0.05, 0.85].map((y) => <mesh key={y} material={mats.bunk} position={[0, y, 0]}><boxGeometry args={[0.92, 0.05, 0.64]} /></mesh>)}
    </group>
  );
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.47, 0]} material={mats.floor}><planeGeometry args={[8, 5]} /></mesh>
      <mesh position={[0, 0.9, -0.9]} material={mats.wall}><planeGeometry args={[8, 3.6]} /></mesh>
      {bunk(-1.0, -0.45, "a")}{bunk(1.05, -0.45, "b")}{bunk(-1.9, 0.45, "c")}{bunk(1.95, 0.45, "d")}
      {/* buzlu pencere: duvarda çerçeve */}
      <mesh material={mats.bunk} position={[0.55, 1.35, -0.88]}><boxGeometry args={[0.5, 0.04, 0.03]} /></mesh>
      <mesh material={mats.bunk} position={[0.55, 1.0, -0.88]}><boxGeometry args={[0.5, 0.04, 0.03]} /></mesh>
      <mesh material={mats.bunk} position={[0.55, 1.18, -0.88]}><boxGeometry args={[0.03, 0.38, 0.03]} /></mesh>
      {/* sandık + gaz lambası alevi (tek renk) */}
      <mesh material={mats.bunk} position={[lampPos.x, -0.2, lampPos.z]}><boxGeometry args={[0.3, 0.5, 0.25]} /></mesh>
      <mesh material={mats.bunk} position={[lampPos.x, 0.08, lampPos.z]}><cylinderGeometry args={[0.035, 0.05, 0.1, 14]} /></mesh>
      <mesh material={mats.flame} position={[lampPos.x, 0.17, lampPos.z]} quaternion={q}><planeGeometry args={[0.085, 0.17]} /></mesh>
      {/* genç (ortada) ve dört yaşlı */}
      {shot !== "slate" ? <SeatedFigure mat={mats.young} position={[0.0, 0.0, 0.2]} rotY={0.05} lean={0.28 * (1 - youngLift)} /> : null}
      {(shot === "slate" ? [] : [[-0.78, 0.0, 1.1], [0.8, 0.05, -1.1], [-0.5, -0.62, 0.55], [0.55, -0.66, -0.5]] as const).map(([x, z, r], i) => (
        <SeatedFigure key={i} mat={z < -0.3 ? mats.figBack : mats.fig} position={[x, -0.02, z]} rotY={THREE.MathUtils.lerp(r * 0.4, r, shot === "wide" ? elderTurn(i) : 1)}
          lean={0.12 + 0.05 * i} scale={1.02 + 0.03 * (i % 2)} />
      ))}
      {/* arka duvarda tahta levha ve oyulan çizimler (s30) */}
      <mesh material={mats.board} position={[0, 1.42, -0.87]}><boxGeometry args={[1.5, 0.62, 0.02]} /></mesh>
      {shot === "board" ? (<>
        {/* sarkaç: askı çizgisi + top */}
        <Stroke mat={mats.carve} points={[[-0.6, 1.66, -0.85], [-0.52, 1.34, -0.85]]} progress={draw(fPhys, 8)} />
        <mesh material={mats.carve} position={[-0.515, 1.32, -0.85]} scale={draw(fPhys + 6, 6)}><circleGeometry args={[0.03, 18]} /></mesh>
        <Stroke mat={mats.carve} points={sine(-0.38, 0.05, 1.5, -0.85, 0.07, 2)} progress={draw(fMath, 16)} />
        <Stroke mat={mats.carve} points={sine(0.12, 0.62, 1.58, -0.85, 0.015, 7, 60)} progress={draw(fLit, 18)} radius={0.004} />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Stroke key={i} mat={mats.carve} radius={0.004} progress={draw(fLang + 3 * i, 6)}
            points={[[0.14 + 0.08 * i, 1.3, -0.85], [0.17 + 0.08 * i, 1.4 - 0.03 * (i % 2), -0.85], [0.2 + 0.08 * i, 1.3, -0.85]]} />
        ))}
      </>) : null}
      {/* soba köşesi (s30b): soba, ağzı, arduvaz levha, el, tebeşir çizgisi ve tozu */}
      <mesh material={mats.stove} position={[stovePos.x, 0.0, stovePos.z - 0.12]}><cylinderGeometry args={[0.2, 0.22, 0.95, 20]} /></mesh>
      <mesh material={mats.flame} position={[stovePos.x + 0.08, 0.2, stovePos.z + 0.14]} quaternion={q}><planeGeometry args={[0.13, 0.11]} /></mesh>
      {shot === "slate" ? (<>
        <mesh material={mats.slate} position={[-1.18, 0.42, 0.05]} rotation={[0, 0.35, 0]}><boxGeometry args={[0.42, 0.3, 0.015]} /></mesh>
        <group rotation={[0, 0.35, 0]} position={[-1.18, 0.42, 0.06]}>
          <Stroke mat={mats.carve} points={sine(-0.16, 0.16, 0.0, 0.0, 0.05, 1.5)} progress={chalk} radius={0.004} />
          {/* el: tebeşir ucunu izler */}
          {(() => {
            const u = clamp(chalk); const x = -0.16 + 0.32 * u, y = 0.05 * Math.sin(u * 1.5 * Math.PI * 2);
            const wipe = frame >= fAgain && frame < fAgain + 10 ? 0.12 * Math.sin(((frame - fAgain) / 10) * Math.PI) : 0;
            return (<group position={[x + wipe, y - 0.02, 0.02]} scale={0.55}>
              <mesh material={mats.fig} position={[0.03, -0.03, 0.01]} scale={[1, 0.8, 0.6]}><sphereGeometry args={[0.035, 14, 10]} /></mesh>
              <mesh material={mats.fig} position={[0.16, -0.09, 0.05]} rotation={[0, 0, 1.2]}><capsuleGeometry args={[0.03, 0.22, 6, 10]} /></mesh>
            </group>);
          })()}
          {/* "Again": silinen tebeşirin tozu */}
          {Array.from({ length: 14 }, (_, i) => {
            const a = frame - fAgain - i * 0.4; if (a < 0 || a > 22) return null;
            return <mesh key={i} material={mats.carve} position={[-0.12 + 0.025 * i, 0.03 - 0.004 * a * (0.5 + hash(i)), 0.012]}>
              <circleGeometry args={[0.003 + 0.002 * hash(i * 3), 6]} /></mesh>;
          })}
        </group>
      </>) : null}
    </>
  );
};

export const WoodcutBarracks: React.FC<{ durationInFrames?: number; words?: Word[]; shot?: Shot }> = ({ words, shot = "wide" }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "#e8dcc1" }}>
      <ThreeCanvas width={width} height={height} camera={{ fov: 42, near: 0.05, far: 20, position: [0, 0.75, 2.6] }} gl={{ antialias: true }}>
        <Scene frame={frame} fps={fps} width={width} height={height} dur={durationInFrames} words={words} shot={shot} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
