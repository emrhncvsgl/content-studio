// EP009 s02b: hücrede fısıltı (ağaç baskı, diyalog; anlatıcı susar). Storyboard: iki siluet sırada, yaşlı hücre arkadaşı gence eğilmiş,
// tavanda tek çıplak ampul (tek renk). "Sit facing the door" genç kapıya (kameraya) döner (ikişer kare) · "new ones" yaşlının elinde iki küçük
// kâğıt daire belirir. Açılış: s02'nin ampulü söner, hücre ampulün halkalarından oyularak açılır. Kamera: dolly in, slow, inertia, iki başa doğru.
import { useMemo } from "react";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, Easing, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { bulbFrag, bulbVert, clamp, hash, inertia, litMat, onTwos, SeatedFigure, usePrint, wordFrame, type Word } from "./kit";

const Scene: React.FC<{ frame: number; fps: number; width: number; height: number; dur: number; words?: Word[] }> = ({ frame, fps, width, height, dur, words }) => {
  const { update, camera } = usePrint(width, height, { seed: 5.0, halo: 4 });
  const fSit = wordFrame(words, "sit", fps, 0.1), fClose = wordFrame(words, "close", fps, 1.8), fNew = wordFrame(words, "new", fps, 3.6);
  const mats = useMemo(() => ({
    floor: litMat(0.45, 1, 0.2), wall: litMat(0.55, 0, 0.45), bench: litMat(0.6, 1, 0.9),
    fig: litMat(0.45, 0, 0.75), paper: litMat(1.0, 0, 0.6),
    bulb: new THREE.ShaderMaterial({ vertexShader: bulbVert, fragmentShader: bulbFrag, uniforms: { uOn: { value: 1 } } }),
  }), []);
  const bulbPos = useMemo(() => new THREE.Vector3(0.04, 0.98, -0.22), []);
  // ampul: hafif titreşen sabit ışık (cereyan), açılışta oyma halkaları ampulden dışarı ~1.2 sn
  const flick = 1 + 0.03 * Math.sin(frame * 0.9) + 0.03 * (hash(Math.floor(frame / 3)) - 0.5);
  const lightI = 3.2 * flick * Easing.out(Easing.cubic)(clamp(frame / 8));
  const reveal = 40 + 2100 * Easing.inOut(Easing.cubic)(clamp(frame / 36));
  Object.values(mats).forEach((m) => { if (m.uniforms.uLight) { m.uniforms.uLight.value.copy(bulbPos); m.uniforms.uI.value = lightI; } });
  mats.bulb.uniforms.uOn.value = clamp(frame / 4) * flick;

  // genç: yaşlıya dönükken "sit facing the door" ile kameraya (kapıya) döner; ikişer kare, ease-out, ~0.5 sn
  const f2 = onTwos(frame);
  const turn = Easing.out(Easing.cubic)(clamp((f2 - fSit - 4) / 14));
  const youngRot = THREE.MathUtils.lerp(0.95, 0.05, turn);
  const youngLean = 0.06 * Easing.inOut(Easing.quad)(clamp((f2 - fClose) / 12));     // "close your eyes": baş hafifçe düşer
  // yaşlı: gence eğik, eli "close" ile öne uzanır; "new ones"ta parmaklarında iki kâğıt daire
  const reach = Easing.inOut(Easing.cubic)(clamp((f2 - fClose) / 30));
  const discs = Easing.out(Easing.back(1.4))(clamp((f2 - fNew) / 8));

  // kamera satırı: "dolly in, whole scene, slow, inertia, toward the two heads"
  const k = inertia(clamp(frame / dur));
  camera.position.set(0.22 - 0.08 * k + 0.008 * Math.sin(frame / 37), 0.62 - 0.03 * k, 1.95 - 0.45 * k);
  camera.lookAt(0.0, 0.5, 0.0); camera.fov = 40; camera.updateProjectionMatrix();
  update(bulbPos, reveal);

  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.47, 0]} material={mats.floor}><planeGeometry args={[6, 4]} /></mesh>
      <mesh position={[0, 0.6, -0.42]} material={mats.wall}><planeGeometry args={[6, 3]} /></mesh>
      {/* tahta sıra: oturak + iki ayak */}
      <mesh position={[0, -0.09, 0.05]} material={mats.bench}><boxGeometry args={[1.3, 0.06, 0.32]} /></mesh>
      <mesh position={[-0.5, -0.28, 0.05]} material={mats.bench}><boxGeometry args={[0.06, 0.38, 0.28]} /></mesh>
      <mesh position={[0.5, -0.28, 0.05]} material={mats.bench}><boxGeometry args={[0.06, 0.38, 0.28]} /></mesh>
      <SeatedFigure mat={mats.fig} position={[-0.24, 0.0, 0.03]} rotY={youngRot} lean={youngLean} />
      <SeatedFigure mat={mats.fig} position={[0.25, 0.0, 0.0]} rotY={-0.95} lean={0.32} turn={-0.1} armReach={reach} scale={1.03} />
      {/* iki kâğıt daire yaşlının parmaklarında (oyulmuş beyaz) */}
      {[0, 1].map((i) => (
        <mesh key={i} material={mats.paper} position={[0.06 + 0.035 * i, 0.38 + 0.01 * i, 0.27]} rotation={[0.3, -0.6, 0]} scale={discs}>
          <circleGeometry args={[0.022, 20]} />
        </mesh>
      ))}
      {/* tavandan sarkan kablo ve çıplak ampul */}
      <mesh position={[bulbPos.x, bulbPos.y + 0.35, bulbPos.z]} material={mats.bench}><cylinderGeometry args={[0.004, 0.004, 0.7, 6]} /></mesh>
      <mesh position={bulbPos} material={mats.bulb}><sphereGeometry args={[0.045, 20, 16]} /></mesh>
    </>
  );
};

export const WoodcutCell: React.FC<{ durationInFrames?: number; words?: Word[] }> = ({ words }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "#e8dcc1" }}>
      <ThreeCanvas width={width} height={height} camera={{ fov: 36, near: 0.05, far: 20, position: [0.2, 0.6, 1.9] }} gl={{ antialias: true }}>
        <Scene frame={frame} fps={fps} width={width} height={height} dur={durationInFrames} words={words} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
