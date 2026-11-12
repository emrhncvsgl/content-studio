// EP009 s24b: gece sorgusu (ağaç baskı, diyalog; anlatıcı susar; sorgucu adsız, gerçek görevli seslendirilmez). Çıplak oda: masa lambası (tek renk),
// ışığın ardında siyah biçim sorgucu; önde genç siluetin omzu. "Inventor's sabotage" kâğıt masada kameraya doğru itilir · "Sign here" kalem
// kâğıdın yanına bırakılır · "again" lamba başı gence doğru hafifçe döner (yüz aranmaz, siyah kalır). Açılış: oda lambadan oyularak açılır.
// Kamera: push-in, slow, ease-in, kâğıda doğru.
import { useMemo } from "react";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, Easing, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { bulbFrag, bulbVert, clamp, hash, litMat, SeatedFigure, usePrint, wordFrame, type Word } from "./kit";

const Scene: React.FC<{ frame: number; fps: number; width: number; height: number; dur: number; words?: Word[] }> = ({ frame, fps, width, height, dur, words }) => {
  const { update, camera } = usePrint(width, height, { seed: 9.0, halo: 4 });
  const fPush = wordFrame(words, "inventor's", fps, 0.1), fSign = wordFrame(words, "sign", fps, 1.8), fAgain = wordFrame(words, "again", fps, 2.7);
  const mats = useMemo(() => ({
    table: litMat(0.5, 1, 0.2), wall: litMat(0.35, 0, 0.45), fig: litMat(0.4, 0, 0.75), boss: litMat(0.16, 0, 0.75), paper: litMat(1.0, 0, 0.6),
    lamp: litMat(0.5, 0, 0.9), pen: litMat(0.7, 0, 0.9),
    bulb: new THREE.ShaderMaterial({ vertexShader: bulbVert, fragmentShader: bulbFrag, uniforms: { uOn: { value: 1 } } }),
  }), []);
  // lamba başı "again"de gence (kameraya) doğru ~14° döner; ışık noktası onunla kayar
  const swing = 0.25 * Easing.inOut(Easing.cubic)(clamp((frame - fAgain) / 24));
  const lampBase = new THREE.Vector3(0.38, -0.0, -0.05);
  const head = lampBase.clone().add(new THREE.Vector3(-0.12 - 0.05 * swing, 0.34, 0.06 + 0.12 * swing));
  const bulbPos = head.clone().add(new THREE.Vector3(0, -0.06, 0.0));
  const flick = 1 + 0.02 * (hash(Math.floor(frame / 3)) - 0.5);
  const lightI = 2.4 * flick * Easing.out(Easing.cubic)(clamp(frame / 6));
  const reveal = 40 + 2100 * Easing.inOut(Easing.cubic)(clamp(frame / 30));
  Object.values(mats).forEach((m) => { if (m.uniforms.uLight) { m.uniforms.uLight.value.copy(bulbPos); m.uniforms.uI.value = lightI; } });
  mats.bulb.uniforms.uOn.value = clamp(frame / 3) * flick;

  // kâğıt: sorgucunun tarafından kameraya doğru itilir (ease-out, ~0.6 sn, durur); kalem yukarıdan bırakılır (ağır: ease-in, sekme yok)
  const push = Easing.out(Easing.cubic)(clamp((frame - fPush) / 18));
  const paperZ = THREE.MathUtils.lerp(-0.28, 0.12, push);
  const drop = Easing.in(Easing.quad)(clamp((frame - fSign - 4) / 7));
  const penY = THREE.MathUtils.lerp(0.22, 0.006, drop);
  const penOn = frame >= fSign;

  // kamera satırı: "push-in, whole scene, slow, ease-in, toward the paper"
  const k = Easing.in(Easing.quad)(clamp(frame / dur));
  camera.position.set(-0.12 + 0.03 * k, 0.6 - 0.12 * k, 1.35 - 0.38 * k);
  camera.lookAt(0.05, 0.22, -0.2); camera.fov = 40; camera.updateProjectionMatrix();
  update(bulbPos, reveal);
  const shade = useMemo(() => new THREE.ConeGeometry(0.09, 0.12, 24, 1, true), []);

  return (
    <>
      {/* masa ve arka duvar */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} material={mats.table}><planeGeometry args={[1.6, 1.0]} /></mesh>
      <mesh position={[0, 0.6, -0.9]} material={mats.wall}><planeGeometry args={[5, 3]} /></mesh>
      {/* sorgucu: masanın ardında, ışığın arkasında siyah biçim */}
      <SeatedFigure mat={mats.boss} position={[0.0, -0.12, -0.78]} rotY={0} lean={0.12} scale={1.05} />
      {/* masa lambası: ayak, boyun, açık koni başlık, ampul */}
      <mesh material={mats.lamp} position={[lampBase.x, 0.01, lampBase.z]}><cylinderGeometry args={[0.07, 0.08, 0.02, 20]} /></mesh>
      <mesh material={mats.lamp} position={[lampBase.x - 0.06, 0.18, lampBase.z + 0.03]} rotation={[0.2, 0, 0.45]}><cylinderGeometry args={[0.008, 0.008, 0.38, 8]} /></mesh>
      <mesh material={mats.lamp} geometry={shade} position={head} rotation={[0.35 + swing, 0, 0.5]} />
      <mesh material={mats.bulb} position={bulbPos}><sphereGeometry args={[0.03, 16, 12]} /></mesh>
      {/* kâğıt ve kalem */}
      <mesh material={mats.paper} rotation={[-Math.PI / 2, 0, 0.08]} position={[0.02, 0.003, paperZ]}><planeGeometry args={[0.21, 0.29]} /></mesh>
      {penOn ? <mesh material={mats.pen} position={[0.17, penY, paperZ + 0.02]} rotation={[0, 0.5, Math.PI / 2]}><cylinderGeometry args={[0.006, 0.006, 0.15, 10]} /></mesh> : null}
      {/* önde genç siluetin omzu (yakın, kadraj altı solda) */}
      <mesh material={mats.fig} position={[-0.42, 0.05, 0.55]} rotation={[0, 0, Math.PI / 2 - 0.2]} scale={[1, 1, 0.7]}><capsuleGeometry args={[0.13, 0.32, 8, 16]} /></mesh>
      <mesh material={mats.fig} position={[-0.3, 0.28, 0.62]} scale={[0.86, 1.08, 0.95]}><sphereGeometry args={[0.1, 24, 18]} /></mesh>
    </>
  );
};

export const WoodcutInterrogation: React.FC<{ durationInFrames?: number; words?: Word[] }> = ({ words }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "#e8dcc1" }}>
      <ThreeCanvas width={width} height={height} camera={{ fov: 40, near: 0.05, far: 20, position: [-0.12, 0.6, 1.35] }} gl={{ antialias: true }}>
        <Scene frame={frame} fps={fps} width={width} height={height} dur={durationInFrames} words={words} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
