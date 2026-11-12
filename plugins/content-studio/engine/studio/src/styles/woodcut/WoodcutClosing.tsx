// EP009 kapanış (ağaç baskı; storyboard s60/s62/s63). WoodcutMatch'e dokunulmadan, aynı görünüm kit ile yeniden kurulur.
//  shot "eyes"  (s60): gözetleme deliği halkasının içinden: sırada oturan genç, kapaklarında kâğıt göz bebekleri kameraya bakar. "look open" soldan,
//                "sleep" sağdan oyuk ok; iki ok alında dayanır (s17 oklarının ağaç baskı hâli). Kamera: dolly in, slow, inertia.
//  shot "ember" (s62, anahtar an): karanlıktan s01'in masası yeniden oyulur: iki kâğıt göz bebeği ve yanık kibrit, ucunda son kor (tek renk).
//                "burnt match"ta kamera tam durur · "same kind of move"da kor söner, oyuklar parlaktan karanlığa geri kapanır.
//  shot "ring"  (s63): kor sönmüş; sönük ampulün halkalarıyla sıra ve göz bebekleri. "stories" ile gözetleme deliği halkası kenardan içe kapanır,
//                "problems" ile daralır; kuyrukta göz bebeklerinin çevresinde durur, sonra tam karanlık; kâğıt payı en son söner.
import { useMemo } from "react";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, Easing, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { bulbFrag, bulbVert, carveMat, clamp, flameFrag, flameVert, hash, inertia, litMat, SeatedFigure, Stroke, tornPaper, usePrint, wordFrame, type Word } from "./kit";

type Shot = "eyes" | "ember" | "ring";

const Scene: React.FC<{ frame: number; fps: number; width: number; height: number; dur: number; words?: Word[]; shot: Shot }> =
  ({ frame, fps, width, height, dur, words, shot }) => {
  const { update, camera, plate } = usePrint(width, height, { seed: shot === "eyes" ? 27 : 3.0, halo: 4 });
  const mats = useMemo(() => {
    const eyes = () => { const m = litMat(1.0, 0, 0.6, 1); m.uniforms.uPupilA.value.set(1, 1); m.uniforms.uPupilB.value.set(1, 1); return m; };
    return {
      table: litMat(0.4, 1, 0.2), wall: litMat(0.5, 0, 0.45), bench: litMat(0.6, 1, 0.9), fig: litMat(0.4, 0, 0.75),
      paperA: eyes(), paperB: eyes(), stick: litMat(0.35, 0, 0.9), carve: carveMat(),
      ember: new THREE.ShaderMaterial({ vertexShader: bulbVert, fragmentShader: bulbFrag, uniforms: { uOn: { value: 1 } } }),
      flame: new THREE.ShaderMaterial({ vertexShader: flameVert, fragmentShader: flameFrag, uniforms: { uFlame: { value: 0 }, uT: { value: 0 }, uFlare: { value: 0 } } }),
      bulb: new THREE.ShaderMaterial({ vertexShader: bulbVert, fragmentShader: bulbFrag, uniforms: { uOn: { value: 0.3 } } }),
    };
  }, []);
  const paperA = useMemo(() => tornPaper(0.34, 0.26, 11), []);
  const paperB = useMemo(() => tornPaper(0.32, 0.25, 29), []);
  const flick = 1 + 0.05 * Math.sin(frame * 0.7) + 0.05 * (hash(Math.floor(frame / 2)) - 0.5);

  let light = new THREE.Vector3(), lightI = 0, reveal = 2600, ring: { radiusPx: number; cx?: number; cy?: number } | undefined;
  const emberPos = new THREE.Vector3(0.28, 0.02, 0.06);
  const fOpen = wordFrame(words, "look open", fps, 2.8), fSleep = wordFrame(words, "sleep", fps, 3.7);
  if (shot === "eyes") {
    light = new THREE.Vector3(0.05, 1.15, 0.7); lightI = 2.2 * flick;
    ring = { radiusPx: plate.h * 0.46, cx: 0.5, cy: 0.55 };
    const k = inertia(clamp(frame / dur));
    camera.position.set(0.0, 0.62, 1.9 - 0.55 * k); camera.lookAt(0, 0.56, 0); camera.fov = 34;
    mats.bulb.uniforms.uOn.value = 0.35;
  } else {
    const fMatch = wordFrame(words, "burnt match", fps, 1.9), fMove = wordFrame(words, "same kind of move", fps, 3.6);
    const fStories = wordFrame(words, "stories", fps, 1.4), fProb = wordFrame(words, "problems", fps, 3.7);
    // kamera: s01'in son kadrajına yakın; "burnt match"a kadar yavaş itme, sonra tam durur
    const k = shot === "ember" ? inertia(clamp(frame / Math.max(20, fMatch))) : 1;
    camera.position.set(0.06, 1.12 - 0.06 * k, 1.2 - 0.08 * k); camera.lookAt(0.02, 0.0, 0.08); camera.fov = 34;
    // 2026-11-09 (kullanıcı: "kibrit alevi gözükmüyor; kapanışı yavaş yavaş kibritin alevine doğru kapatıp en son tıss diye sönerek yapalım"):
    // s62'de yanık kibritin ucunda küçük gerçek alev yanar (sönmez); s63'te halka alevin ekrandaki yerine doğru daralır, en dar anda alev
    // "tıss" diye söner (FLAME_OUT kare), kare kararır, logo gelir.
    let flame = 0.95 * flick;
    if (shot === "ember") {
      void fMove;
      light = emberPos.clone().add(new THREE.Vector3(0, 0.04, 0)); lightI = 2.4 * flick;
      reveal = 40 + 2100 * Easing.inOut(Easing.cubic)(clamp(frame / 40));   // karanlıktan yeniden oyulur
    } else {
      const outAt = dur - OUTRO_FRAMES - FLAME_OUT;
      const out = Easing.in(Easing.quad)(clamp((frame - outAt) / 8));       // tıss: 8 karede söner
      flame = 0.95 * flick * (1 - out);
      light = emberPos.clone().add(new THREE.Vector3(0, 0.04, 0)); lightI = (0.12 + 2.3 * (1 - out)) * flick;
      const full = Math.hypot(plate.w, plate.h) * 0.62, tight = plate.h * 0.17;
      const u = clamp((frame - fStories) / Math.max(30, outAt - fStories));
      const k2 = 0.5 - 0.5 * Math.cos(Math.PI * Math.pow(u, 0.9));           // tek sürekli S-eğrisi, alevin çevresinde yavaşlar
      // kamera aynı eğriyle alevin üstüne iner (dolly in, slow): alev kadrajda büyür
      const tip = emberPos.clone().add(new THREE.Vector3(0, 0.03, 0));
      camera.position.set(THREE.MathUtils.lerp(0.06, tip.x + 0.03, k2), THREE.MathUtils.lerp(1.06, tip.y + 0.5, k2), THREE.MathUtils.lerp(1.12, tip.z + 0.62, k2));
      camera.lookAt(THREE.MathUtils.lerp(0.02, tip.x, k2), THREE.MathUtils.lerp(0.0, tip.y, k2), THREE.MathUtils.lerp(0.08, tip.z, k2));
      camera.updateProjectionMatrix(); camera.updateMatrixWorld();   // project() bu karenin kamerasıyla (önce kamera taşınır)
      const lp = emberPos.clone().add(new THREE.Vector3(0, 0.035, 0)).project(camera);
      const shut = Easing.in(Easing.cubic)(clamp((frame - outAt - 4) / 10)); // alev sönünce halka da kapanır
      ring = { radiusPx: THREE.MathUtils.lerp(full, tight, k2) * (1 - shut) + 0.001, cx: lp.x * 0.5 + 0.5, cy: lp.y * 0.5 + 0.5 };
      void fProb;
    }
    mats.ember.uniforms.uOn.value = 0.7 * (flame / 0.95);
    mats.flame.uniforms.uFlame.value = flame; mats.flame.uniforms.uT.value = frame / fps;
  }
  Object.values(mats).forEach((m) => { if (m.uniforms.uLight) { m.uniforms.uLight.value.copy(light); m.uniforms.uI.value = lightI; } });
  camera.updateProjectionMatrix();
  update(light, reveal, ring);

  if (shot === "eyes") {
    const aL = Easing.out(Easing.cubic)(clamp((frame - fOpen) / 12)), aR = Easing.out(Easing.cubic)(clamp((frame - fSleep) / 12));
    return (
      <>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.47, 0]} material={mats.table}><planeGeometry args={[6, 4]} /></mesh>
        <mesh position={[0, 0.8, -0.45]} material={mats.wall}><planeGeometry args={[6, 3]} /></mesh>
        <mesh position={[0, -0.09, 0.0]} material={mats.bench}><boxGeometry args={[1.3, 0.06, 0.32]} /></mesh>
        <SeatedFigure mat={mats.fig} position={[0, 0.0, -0.02]} rotY={0} lean={0.02} />
        {/* kapaklardaki kâğıt göz bebekleri (kameraya bakar) */}
        <mesh material={mats.paperA} position={[-0.032, 0.6, 0.128]}><circleGeometry args={[0.019, 18]} /></mesh>
        <mesh material={mats.paperB} position={[0.032, 0.6, 0.128]}><circleGeometry args={[0.019, 18]} /></mesh>
        {/* karşıt oklar: "look open" soldan, "sleep" sağdan; alında dayanır */}
        <Stroke mat={mats.carve} progress={aL} radius={0.005} points={[[-0.42, 0.66, 0.1], [-0.1, 0.66, 0.1]]} />
        {aL > 0.95 ? <><Stroke mat={mats.carve} progress={1} radius={0.005} points={[[-0.1, 0.66, 0.1], [-0.14, 0.69, 0.1]]} />
          <Stroke mat={mats.carve} progress={1} radius={0.005} points={[[-0.1, 0.66, 0.1], [-0.14, 0.63, 0.1]]} /></> : null}
        <Stroke mat={mats.carve} progress={aR} radius={0.005} points={[[0.42, 0.66, 0.1], [0.1, 0.66, 0.1]]} />
        {aR > 0.95 ? <><Stroke mat={mats.carve} progress={1} radius={0.005} points={[[0.1, 0.66, 0.1], [0.14, 0.69, 0.1]]} />
          <Stroke mat={mats.carve} progress={1} radius={0.005} points={[[0.1, 0.66, 0.1], [0.14, 0.63, 0.1]]} /></> : null}
        <mesh material={mats.bulb} position={[0.05, 1.15, 0.2]}><sphereGeometry args={[0.04, 16, 12]} /></mesh>
      </>
    );
  }
  // masa sahnesi (s62/s63): s01'in kâğıtları, göz bebekleri çizilmiş; yanık kibrit masada yatar, ucunda kor
  const stickDir = new THREE.Vector3(-1, 0.02, 0.35).normalize();
  const stickC = emberPos.clone().add(stickDir.clone().multiplyScalar(0.2));
  const qStick = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), stickDir);
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={mats.table}><planeGeometry args={[6, 4]} /></mesh>
      <mesh geometry={paperA} material={mats.paperA} position={[-0.2, 0.003, 0.1]} rotation={[-Math.PI / 2, 0, 0.12]} />
      <mesh geometry={paperB} material={mats.paperB} position={[0.16, 0.003, 0.16]} rotation={[-Math.PI / 2, 0, -0.08]} />
      <mesh material={mats.stick} position={stickC} quaternion={qStick}><cylinderGeometry args={[0.009, 0.009, 0.4, 10]} /></mesh>
      <mesh material={mats.ember} position={emberPos}><sphereGeometry args={[0.011, 14, 10]} /></mesh>
      <mesh material={mats.flame} position={emberPos.clone().add(new THREE.Vector3(0, 0.028, 0))} quaternion={camera.quaternion}><planeGeometry args={[0.06, 0.115]} /></mesh>
    </>
  );
};

// kanal kapanışı: logonun dört kâğıt parçası birleşir (tools/make_outro_pieces.py --landscape --hold 2.0; sesi timeline'da, post_timeline.py)
export const OUTRO_FRAMES = 136;
export const FLAME_OUT = 22;   // alev logodan bu kadar kare önce söner (post_timeline tıss sesi)
const OUTRO_SRC = "brand/outro/outro-pieces-16x9.silent.mp4";

export const WoodcutClosing: React.FC<{ durationInFrames?: number; words?: Word[]; shot?: Shot }> = ({ words, shot = "ember" }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  // s63: halka kapanınca kâğıt payı da kararır (0.3 sn), ardından logo parçaları karanlıkta birleşir
  const outroAt = durationInFrames - OUTRO_FRAMES;
  const fadeAll = shot === "ring" ? interpolate(frame, [outroAt - 10, outroAt], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
  return (
    <AbsoluteFill style={{ backgroundColor: "#e8dcc1" }}>
      <ThreeCanvas width={width} height={height} camera={{ fov: 34, near: 0.05, far: 20, position: [0.06, 1.1, 1.2] }} gl={{ antialias: true }}>
        <Scene frame={frame} fps={fps} width={width} height={height} dur={durationInFrames} words={words} shot={shot} />
      </ThreeCanvas>
      {fadeAll > 0 ? <AbsoluteFill style={{ backgroundColor: "#000", opacity: fadeAll }} /> : null}
      {shot === "ring" ? (
        <Sequence from={outroAt} durationInFrames={OUTRO_FRAMES}>
          <OffthreadVideo src={staticFile(OUTRO_SRC)} muted style={{ width: "100%", height: "100%" }} />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
};
