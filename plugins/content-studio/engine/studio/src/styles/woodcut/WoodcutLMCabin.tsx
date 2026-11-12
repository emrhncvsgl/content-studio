// EP010 s07 denemesi: KARIŞIM. Mekân, figürler, ışık ve kamera bizim three.js kitimizden (litMat: R = parlaklık);
// o kare küçük bir hedefe çizilip okunur → Lemo `woodcutFilter` (biçimi izleyen tek tek kesikler) → Lemo baskı katmanı →
// sonuç aynı three tuvaline tam ekran dörtgenle basılır. İki kişilik ay modülü kabininde üç adam; tek ışık: tavan lambası + iki üçgen pencere.
// 3D sahne ikişer karede (f2) değerlendirilir: aynı çift karede aynı kesikler. Tek kare: npx remotion still src/index.ts WoodcutLMCabin x.png --frame=80
import { useMemo } from "react";
import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { clamp, hash, inertia, litMat, onTwos, SeatedFigure, StandingFigure } from "./kit";
import { WC } from "./lemo";

const AW = 960, AH = 540;                       // analiz çözünürlüğü (three → filtre)
const MX = 60, MT = 44, MB = 120;               // kâğıt payı (px, 1920×1080)

const tri = (flip: 1 | -1) => { const s = new THREE.Shape(); s.moveTo(-0.3 * flip, 0.24); s.lineTo(0.3 * flip, 0.24); s.lineTo(0.12 * flip, -0.28); s.closePath(); return s; };

const Scene: React.FC<{ frame: number; fps: number; dur: number }> = ({ frame, fps, dur }) => {
  const { gl, scene, camera } = useThree();
  const cam = camera as THREE.PerspectiveCamera;
  const mats = useMemo(() => ({
    floor: litMat(0.85, 1, 0.2), wall: litMat(0.42, 0, 0.45), ceil: litMat(0.15, 0, 0.45), panel: litMat(0.5, 0, 0.9), cover: litMat(0.62, 1, 0.9), fig: litMat(0.75, 0, 0.75),
    glow: new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0, 0) }), dial: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0, 0) }),
  }), []);
  const eng = useMemo(() => {
    const rt = new THREE.WebGLRenderTarget(AW, AH, { type: THREE.UnsignedByteType });
    const [src, sq] = WC.canvas(AW, AH), [mask, m] = WC.canvas(1920, 1080), [fig, fq] = WC.canvas(AW, AH), [hal, hq] = WC.canvas(1920, 1080);
    const P = WC.makePrinter(1920, 1080);
    const tex = new THREE.CanvasTexture(P.canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter;
    const qs = new THREE.Scene(); qs.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, depthTest: false })));
    return { rt, buf: new Uint8Array(AW * AH * 4), src, sq, img: sq.createImageData(AW, AH), fig, fq, fimg: fq.createImageData(AW, AH), hal, hq, mask, m, P, tex, qs, qc: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1) };
  }, []);

  const f2 = onTwos(frame), t = frame / fps;
  const lamp = useMemo(() => new THREE.Vector3(0, 1.9, -0.55), []);
  const flick = 1 + 0.025 * (hash(Math.floor(f2 / 4)) - 0.5);
  for (const k of ["floor", "wall", "ceil", "panel", "cover", "fig"] as const) { mats[k].uniforms.uLight.value.copy(lamp); mats[k].uniforms.uI.value = 5.5 * flick; }
  // kamera satırı: "dolly in, whole scene, slow, inertia, toward the three backs"
  // 3D kamera SABİT: kamera 3D'de ilerleyince filtre her pozda bütün kesikleri yeniden dağıtıyor (ölçüm: iki poz arası ort. fark 14.8/255 = kaynama).
  // Yaklaşma 2D'de, maske üstünde yapılır (kesikler sabit kalır); 3D'de yalnız figür pozu değişir, o da 4 basamakta.
  const k = inertia(clamp(frame / dur)), zoom = 1 + 0.07 * k;
  cam.position.set(0.085, 1.185, 1.88); cam.lookAt(0, 0.98, -0.3); cam.fov = 46; cam.updateProjectionMatrix();
  // üçüncü adam (ortada, motor kapağında oturan) hafifçe öne eğilir; ikişer kare
  const lean = 0.2 + 0.1 * Math.round(clamp((f2 / fps - 2.2) / 1.2) * 4) / 4;

  useFrame(() => {
    const { rt, buf, src, sq, img, mask, m, P, tex, qs, qc, fig, fq, fimg, hal, hq } = eng;
    gl.setRenderTarget(rt); gl.setClearColor(0x000000, 1); gl.clear(); gl.render(scene, camera);
    gl.readRenderTargetPixels(rt, 0, 0, AW, AH, buf); gl.setRenderTarget(null);
    const d = img.data, fd = fimg.data;
    for (let y = 0; y < AH; y++) { const sy = (AH - 1 - y) * AW * 4, dy = y * AW * 4; for (let x = 0; x < AW; x++) { const v = buf[sy + x * 4]; d[dy + x * 4] = d[dy + x * 4 + 1] = d[dy + x * 4 + 2] = v; d[dy + x * 4 + 3] = 255;
      const a = buf[sy + x * 4 + 3]; fd[dy + x * 4] = fd[dy + x * 4 + 1] = fd[dy + x * 4 + 2] = 0; fd[dy + x * 4 + 3] = a > 180 && a < 202 ? 255 : 0; } }
    sq.putImageData(img, 0, 0); fq.putImageData(fimg, 0, 0);
    hq.globalCompositeOperation = "source-over"; hq.clearRect(0, 0, 1920, 1080);
    for (let i = 0; i < 12; i++) hq.drawImage(fig, Math.cos(i / 12 * 6.2832) * 7, Math.sin(i / 12 * 6.2832) * 7, 1920, 1080);
    hq.globalCompositeOperation = "source-in"; hq.fillStyle = "#fff"; hq.fillRect(0, 0, 1920, 1080);
    // lambanın ekrandaki yeri: oyma açılışı oradan yayılır
    const lp = lamp.clone().project(camera), cx = (lp.x * .5 + .5) * 1920, cy = (1 - (lp.y * .5 + .5)) * 1080;
    const F = WC.woodcutFilter(src, { rect: [0, 0, 1920, 1080], sp: 6, black: .1, white: .92, gamma: 1.15, res: 3, seed: 5,
      reveal: { t0: .1, t1: 1.9, mode: "radial", cx, cy } });
    m.setTransform(1, 0, 0, 1, 0, 0); m.fillStyle = "#000"; m.fillRect(0, 0, 1920, 1080);
    m.setTransform(zoom, 0, 0, zoom, 960 - 960 * zoom, 470 - 470 * zoom);
    // önce hale + siyah siluet, sonra kesikler: figürün içindeki kenar ışığı kesikleri kalır (kâğıt bebek gibi düz durmasın)
    m.globalAlpha = clamp((t - .2) / .7); m.drawImage(hal, 0, 0); m.drawImage(fig, 0, 0, 1920, 1080); m.globalAlpha = 1;
    WC.drawStrokes(m, F.strokes, { t });
    m.setTransform(1, 0, 0, 1, 0, 0);
    m.fillStyle = "#fff"; m.fillRect(0, 0, 1920, MT); m.fillRect(0, 0, MX, 1080); m.fillRect(1920 - MX, 0, MX, 1080); m.fillRect(0, 1080 - MB, 1920, MB);
    P.render(mask, null, { seed: 6, inkSeed: 6 });
    tex.needsUpdate = true; gl.render(qs, qc);
  }, 1);

  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={mats.floor}><planeGeometry args={[5, 5]} /></mesh>
      <mesh position={[0, 1.2, -0.95]} material={mats.wall}><planeGeometry args={[5, 3]} /></mesh>
      <mesh position={[-1.25, 1.2, 0]} rotation={[0, 1.15, 0]} material={mats.wall}><planeGeometry args={[3, 3]} /></mesh>
      <mesh position={[1.25, 1.2, 0]} rotation={[0, -1.15, 0]} material={mats.wall}><planeGeometry args={[3, 3]} /></mesh>
      <mesh position={[0, 2.05, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.ceil}><planeGeometry args={[5, 5]} /></mesh>
      {/* iki üçgen pencere (tek gerçek parlaklık) */}
      <mesh position={[-0.6, 1.52, -0.94]} material={mats.glow}><shapeGeometry args={[tri(1)]} /></mesh>
      <mesh position={[0.6, 1.52, -0.94]} material={mats.glow}><shapeGeometry args={[tri(-1)]} /></mesh>
      {/* pencereler arasında gösterge paneli ve alt konsol */}
      <mesh position={[0, 1.34, -0.9]} material={mats.panel}><boxGeometry args={[0.46, 0.62, 0.08]} /></mesh>
      {[[-0.11, 1.5], [0.11, 1.5], [-0.11, 1.3], [0.11, 1.3], [0, 1.12]].map(([x, y], i) => (
        <mesh key={i} position={[x, y, -0.855]} material={mats.dial}><circleGeometry args={[0.06, 20]} /></mesh>))}
      <mesh position={[0, 0.72, -0.78]} material={mats.panel}><boxGeometry args={[1.0, 0.5, 0.3]} /></mesh>
      {/* motor kapağı (ortadaki silindir) ve üç adam: ikisi pencerelerde ayakta, üçüncüsü kapakta oturur; hepsi sırtı kameraya */}
      <mesh position={[0, 0.22, 0.42]} material={mats.cover}><cylinderGeometry args={[0.4, 0.42, 0.44, 32]} /></mesh>
      <StandingFigure mat={mats.fig} position={[-0.55, 0, -0.38]} rotY={Math.PI + 0.12} />
      <StandingFigure mat={mats.fig} position={[0.55, 0, -0.42]} rotY={Math.PI - 0.1} scale={1.03} />
      <SeatedFigure mat={mats.fig} position={[0.02, 0.53, 0.44]} rotY={Math.PI} lean={lean} />
    </>
  );
};

export const WoodcutLMCabin: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "#EFE8D8" }}>
      <ThreeCanvas width={width} height={height} camera={{ fov: 44, near: 0.05, far: 20, position: [0.1, 1.32, 2.25] }} gl={{ antialias: true }}>
        <Scene frame={frame} fps={fps} dur={durationInFrames} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
