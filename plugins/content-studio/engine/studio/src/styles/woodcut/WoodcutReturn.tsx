// EP009 s25: hücreye dönüş (ağaç baskı; s01'e kafiye). Tek sürekli kamera kayması (truck): peron silueti → hücre kapısı → sırada kâğıt göz
// bebekleri. "paper eyes"te çıplak ampul yanar, ışık s01'deki gibi halka halka oyularak yayılır. Söz bittikten sonra bölüm boşluğu (tail 4.5 sn):
// ampul söner, tam karanlık (s26 "Vorkuta" karanlıktan açılır).
import { useMemo } from "react";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, Easing, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { bulbFrag, bulbVert, clamp, hash, inertia, litMat, StandingFigure, usePrint, wordFrame, type Word } from "./kit";

const Scene: React.FC<{ frame: number; fps: number; width: number; height: number; dur: number; words?: Word[] }> = ({ frame, fps, width, height, dur, words }) => {
  const { update, camera } = usePrint(width, height, { seed: 13.0, halo: 4 });
  const fEyes = wordFrame(words, "paper eyes", fps, 4.0), fEnd = wordFrame(words, "eyes", fps, 4.6, "end");
  const mats = useMemo(() => ({
    floor: litMat(0.45, 1, 0.2), wall: litMat(0.5, 0, 0.45), fig: litMat(0.4, 0, 0.75), door: litMat(0.55, 0, 0.9), bench: litMat(0.6, 1, 0.9),
    eyes: (() => { const m = litMat(1.0, 0, 0.6, 1); m.uniforms.uPupilA.value.set(1, 1); m.uniforms.uPupilB.value.set(1, 1); return m; })(),
    bulb: new THREE.ShaderMaterial({ vertexShader: bulbVert, fragmentShader: bulbFrag, uniforms: { uOn: { value: 0 } } }),
  }), []);
  // kamera: peron (x −2.3) → kapı (0) → sıra (2.1), tek hareket, inertia; "paper eyes"ten hemen önce varır ve durur
  const arrive = Math.max(30, fEyes - 6);
  const k = inertia(clamp(frame / arrive));
  const camX = THREE.MathUtils.lerp(-2.3, 2.1, k);
  camera.position.set(camX, 0.62 + 0.05 * Math.sin(k * Math.PI), 1.7 - 0.35 * inertia(clamp((frame - arrive) / 90)));
  camera.lookAt(camX + 0.15 * (1 - k), 0.45 - 0.2 * k, -0.3); camera.fov = 40; camera.updateProjectionMatrix();

  // ışık: önce kamerayla ilerleyen soluk gece ışığı (peron lambası/koridor), sıraya varınca söner; "paper eyes"te ampul yanar; söz bitince ~2.2 sn yanık kalır, sonra 1 sn'de söner (bölüm boşluğunun geri kalanı karanlık)
  const bulbPos = useMemo(() => new THREE.Vector3(2.12, 1.0, -0.2), []);
  const flick = 1 + 0.03 * (hash(Math.floor(frame / 3)) - 0.5);
  const night = 0.9 * (1 - Easing.in(Easing.quad)(clamp((frame - (fEyes - 14)) / 12)));
  const on = Easing.out(Easing.cubic)(clamp((frame - fEyes) / 6)) * (1 - Easing.inOut(Easing.quad)(clamp((frame - Math.min(fEnd + 66, dur - 36)) / 30)));
  const useBulb = frame >= fEyes;
  const light = useBulb ? bulbPos : new THREE.Vector3(camX + 0.4, 1.3, 0.5);
  const lightI = useBulb ? 3.0 * on * flick : night;
  const reveal = useBulb ? 40 + 2100 * Easing.inOut(Easing.cubic)(clamp((frame - fEyes) / 40)) : 2600;
  Object.values(mats).forEach((m) => { if (m.uniforms.uLight) { m.uniforms.uLight.value.copy(light); m.uniforms.uI.value = lightI; } });
  mats.bulb.uniforms.uOn.value = useBulb ? on * flick : 0;
  update(light, reveal);
  const eyeGeo = useMemo(() => new THREE.CircleGeometry(0.06, 24), []);

  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.47, 0]} material={mats.floor}><planeGeometry args={[9, 4]} /></mesh>
      <mesh position={[0, 0.8, -0.55]} material={mats.wall}><planeGeometry args={[9, 3.2]} /></mesh>
      {/* peron: demir direk ve paltolu iki adam, kasketli iki üniformalı */}
      <mesh material={mats.door} position={[-2.75, 0.6, -0.2]}><cylinderGeometry args={[0.05, 0.06, 2.2, 12]} /></mesh>
      <StandingFigure mat={mats.fig} position={[-2.45, -0.47, -0.15]} rotY={0.3} scale={0.78} />
      <StandingFigure mat={mats.fig} position={[-2.2, -0.47, -0.25]} rotY={-0.2} scale={0.8} />
      <StandingFigure mat={mats.fig} position={[-1.85, -0.47, -0.1]} rotY={-0.6} scale={0.8} cap />
      <StandingFigure mat={mats.fig} position={[-1.6, -0.47, -0.3]} rotY={-0.4} scale={0.79} cap />
      {/* hücre kapısı: duvardan çıkıntılı levha, gözetleme deliği, yemek kapağı */}
      <mesh material={mats.door} position={[0, 0.35, -0.5]}><boxGeometry args={[0.7, 1.65, 0.05]} /></mesh>
      <mesh material={mats.fig} position={[0, 0.72, -0.47]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.025, 0.025, 0.02, 16]} /></mesh>
      <mesh material={mats.wall} position={[0, 0.18, -0.47]}><boxGeometry args={[0.3, 0.12, 0.01]} /></mesh>
      {/* sıra ve üstünde iki kâğıt göz bebeği */}
      <mesh position={[2.1, -0.09, 0.0]} material={mats.bench}><boxGeometry args={[1.2, 0.06, 0.32]} /></mesh>
      <mesh position={[1.62, -0.28, 0.0]} material={mats.bench}><boxGeometry args={[0.06, 0.38, 0.28]} /></mesh>
      <mesh position={[2.58, -0.28, 0.0]} material={mats.bench}><boxGeometry args={[0.06, 0.38, 0.28]} /></mesh>
      <mesh material={mats.eyes} geometry={eyeGeo} position={[2.02, -0.055, 0.04]} rotation={[-Math.PI / 2, 0, 0.2]} />
      <mesh material={mats.eyes} geometry={eyeGeo} position={[2.2, -0.055, 0.06]} rotation={[-Math.PI / 2, 0, -0.15]} />
      <mesh position={[bulbPos.x, bulbPos.y + 0.4, bulbPos.z]} material={mats.bench}><cylinderGeometry args={[0.004, 0.004, 0.8, 6]} /></mesh>
      <mesh position={bulbPos} material={mats.bulb}><sphereGeometry args={[0.045, 20, 16]} /></mesh>
    </>
  );
};

export const WoodcutReturn: React.FC<{ durationInFrames?: number; words?: Word[] }> = ({ words }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "#e8dcc1" }}>
      <ThreeCanvas width={width} height={height} camera={{ fov: 40, near: 0.05, far: 20, position: [-2.3, 0.62, 1.7] }} gl={{ antialias: true }}>
        <Scene frame={frame} fps={fps} width={width} height={height} dur={durationInFrames} words={words} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
