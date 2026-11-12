// EP010 denemesi: Lemo-Opuscar woodcut motoruyla el yakın planı (s29 "make the belt real taut").
// Yükseklik alanı (Sculpt) → ışıklandırılmış gri görüntü → woodcutFilter (biçimi izleyen tek tek kesikler) → baskı (WebGL2).
// Kare = zamanın saf fonksiyonu: bütün rastgelelik tohumlu; pozlar "ikişer karede" ve önbellekte.
// Render: npx remotion render src/index.ts WoodcutLemoHands out/x.mp4   ·  tek kare: npx remotion still ... --frame=120
import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { WC, Sculpt } from "./lemo";

const SW = 960, SH = 540;           // yontu çözünürlüğü (baskı 1920×1080, ×2)
const PLATE = "#E0A030";            // tek renk: bant

type P2 = [number, number];
type HandOpts = { ox: number; oy: number; ang: number; sc: number; mirror?: boolean; zoff: number };

// Lemo demo elinin (founderHands sağ el) yerel ölçüleri; bilek (420,150). Dönüş/ölçek/ayna ile yerleştirilir.
function hand(S: any, o: HandOpts) {
  const c = Math.cos(o.ang), s = Math.sin(o.ang), k = o.sc;
  const T = (lx: number, ly: number): P2 => {
    const dx = (lx - 420) * k, dy = (ly - 150) * k;
    const x = o.ox + dx * c - dy * s, y = o.oy + dx * s + dy * c;
    return [o.mirror ? SW - x : x, y];
  };
  const rot = (r: number) => (o.mirror ? -(r + o.ang) : r + o.ang);
  const z = (v: number) => v * k + o.zoff;
  // kol yeni (kumaş) + ön kol
  S.capsule(T(190, -80), T(330, 60), 92 * k, 85 * k, { mat: 3, zs: .6, z0: z(30), smooth: 10 * k });
  S.capsule(T(250, -60), T(420, 150), 70 * k, 50 * k, { mat: 1, zs: .75, z0: z(18) });
  // el sırtı
  { const [x, y] = T(505, 200); S.blob(x, y, 92 * k, 60 * k, rot(.42), { mat: 0, zs: .55, z0: z(22), smooth: 18 * k }); }
  const fingers: P2[][] = [
    [[540, 150], [600, 190], [640, 250], [650, 292]], [[560, 178], [626, 222], [660, 276], [664, 314]],
    [[560, 210], [620, 256], [648, 304], [650, 336]], [[544, 238], [592, 282], [612, 322], [614, 350]]];
  const fr = [[27, 23, 19, 16], [28, 24, 20, 17], [26, 22, 18, 15], [22, 19, 16, 13]].map(r => r.map(v => v * .8));   // daha ince parmak
  fingers.forEach((F0, j) => {
    const F = F0.map(([x, y]) => [F0[0][0] + (x - F0[0][0]) * 1.2, F0[0][1] + (y - F0[0][1]) * 1.2] as P2);              // daha uzun parmak

    for (let i = 0; i < 3; i++) S.capsule(T(...F[i]), T(...F[i + 1]), fr[j][i] * k, fr[j][i + 1] * k, { mat: 0, zs: .8, z0: z(26 - i * 4), smooth: 7 * k });
    for (let i = 0; i < 3; i++) { const [x, y] = T(...F[i]); S.blob(x, y, fr[j][i] * 1.08 * k, fr[j][i] * .95 * k, 0, { mat: 0, zs: .8, z0: z(27 - i * 4), smooth: 6 * k }); }
    for (let i = 1; i < 3; i++) { const [x, y] = T(...F[i]), [x2, y2] = T(...F[i + 1]); S.creases(x, y, Math.atan2(y2 - y, x2 - x), fr[j][i] * 1.3 * k, 4, 2.2 * k, 3.6 * k); }
  });
  // başparmak
  S.capsule(T(430, 215), T(470, 280), 25 * k, 20 * k, { mat: 0, zs: .75, z0: z(20) });
  S.capsule(T(470, 280), T(528, 326), 20 * k, 14 * k, { mat: 0, zs: .75, z0: z(20) });
  { const [x, y] = T(470, 280), [x2, y2] = T(520, 318); S.creases(x, y, Math.atan2(y2 - y, x2 - x), 30 * k, 4, 2.4 * k, 4 * k); }
  // el sırtında tendonlar
  for (const [a, b] of [[[430, 170], [540, 170]], [[440, 198], [556, 206]], [[450, 224], [548, 232]]] as P2[][])
    S.capsule(T(...a), T(...b), 4.5 * k, 3 * k, { mat: 0, zs: .7, z0: z(40), smooth: 5 * k });
  // kol yeni kıvrımları
  for (let i = 0; i < 4; i++) { const [x, y] = T(250 + i * 14, -10 + i * 16); S.creases(x, y, .9 + (o.mirror ? Math.PI - 2 * .9 : 0) + o.ang * (o.mirror ? -1 : 1), 80 * k, 2, 5 * k, 14 * k); }
}

const BOX: P2[] = [[338, 168], [628, 150], [648, 404], [352, 424]];        // kare LiOH kutusunun üst yüzü
const tape = (pull: number): P2[] => [[296 - pull, 262], [664 + pull, 244], [666 + pull, 288], [298 - pull, 308]];

// bir poz: yontu → ışık → oyuklar. pull: ellerin bandı germe miktarı (px)
function buildPose(pull: number, reveal: boolean) {
  const S = new Sculpt(SW, SH);
  // ön yüz (daha alçak, daha koyu): kutuya derinlik
  S.plank([[352, 424], [648, 404], [643, 450], [361, 470]], 22, 6, 6);
  S.plank(BOX, 44, 12, 2);
  // kutunun süzgeç yüzü: ince paralel oluklar (oyuklara yön verir)
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) { const i = y * SW + x; if (S.id[i] === 2 && S.H[i] > 43.5) S.H[i] += 1.3 * Math.sin((x * .97 + y * .1) * .42); }
  S.plank(tape(pull), 53, 5, 5);
  const HO = { ang: -1.0, sc: .9, zoff: 46 };
  hand(S, { ...HO, ox: 86 - pull, oy: 392 });
  hand(S, { ...HO, ox: 86 - pull, oy: 372, mirror: true });
  S.noise(.25, 7);
  const L = WC.light(-.5, -.58, .42);     // tek lamba: sol üstten, yalayan
  const img = S.shade(L, { mats: { 0: { alb: 1, spec: .22, shin: 14 }, 1: { alb: .9, spec: .12 }, 2: { alb: .5, spec: .08, amb: .03 }, 3: { alb: .8, spec: 0, amb: .04, k: .95 }, 6: { alb: .5, spec: .04, amb: .03 }, 5: { alb: 1.25, spec: .3, shin: 10, amb: .3 } } });
  const reg = new WC.Region((q: CanvasRenderingContext2D) => q.drawImage(img, 0, 0, 1920, 1080), { res: 2, bbox: [0, 0, 1920, 1080] });
  const F = WC.woodcutFilter(img, { rect: [0, 0, 1920, 1080], region: reg, sp: 5, black: .06, white: .82, gamma: 1.05, res: 2, seed: 3,
    reveal: reveal ? { t0: .5, t1: 2.9, mode: "light" } : undefined });
  // siyah siluet (arkadaki ışınları örter) + beyaz bıçak halesi için
  const [sil, q] = WC.canvas(1920, 1080);
  q.drawImage(img, 0, 0, 1920, 1080); q.globalCompositeOperation = "source-in"; q.fillStyle = "#000"; q.fillRect(0, 0, 1920, 1080);
  const [halo, h] = WC.canvas(1920, 1080);
  for (let a = 0; a < 12; a++) h.drawImage(sil, Math.cos(a / 12 * 6.2832) * 6, Math.sin(a / 12 * 6.2832) * 6);
  h.globalCompositeOperation = "source-in"; h.fillStyle = "#fff"; h.fillRect(0, 0, 1920, 1080);
  return { strokes: F.strokes, sil, halo };
}

const ease = (u: number) => { u = Math.min(1, Math.max(0, u)); return u * u * (3 - 2 * u); };

export const WoodcutLemoHands: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const eng = useMemo(() => {
    const [mask, m] = WC.canvas(1920, 1080), [plate, c] = WC.canvas(1920, 1080);
    const rays = WC.rays(210, 70, { n: 30, r0: 70, r1: [420, 1500], w: 13, seed: 2, a0: .02, a1: 1.45, jit: .7, reveal: { t0: 0, t1: 1.3 } });
    return { mask, m, plate, c, P: WC.makePrinter(1920, 1080), rays, poses: new Map<number, ReturnType<typeof buildPose>>() };
  }, []);

  useLayoutEffect(() => {
    const cv = ref.current; if (!cv) return;
    const t = frame / fps, t2 = (frame - (frame % 2)) / fps;      // eller ikişer karede
    // hazırlık (geri) → çekiş (2 kare) → oturma
    const pull = t2 < 4.2 ? 0 : t2 < 4.5 ? -3 * ease((t2 - 4.2) / .3) : t2 < 4.6 ? -3 + 17 * ((t2 - 4.5) / .1) : 14 - 3 * ease((t2 - 4.6) / .5);
    const key = Math.round(pull);
    let pose = eng.poses.get(key);
    if (!pose) { pose = buildPose(key, key === 0); eng.poses.set(key, pose); }
    const { m, c, mask, plate, P } = eng;
    const zoom = 1 + .05 * ease(t / 8), cx = 960, cy = 560;       // yavaş push; kâğıt payı sabit
    for (const g of [m, c]) { g.setTransform(1, 0, 0, 1, 0, 0); }
    m.fillStyle = "#000"; m.fillRect(0, 0, 1920, 1080); c.clearRect(0, 0, 1920, 1080);
    for (const g of [m, c]) g.setTransform(zoom, 0, 0, zoom, cx - cx * zoom, cy - cy * zoom);
    WC.drawStrokes(m, eng.rays, { t });
    const a = ease((t - .3) / .9);                                // siluet ışınların önüne oturur
    m.globalAlpha = a; m.drawImage(pose.halo, 0, 0); m.drawImage(pose.sil, 0, 0); m.globalAlpha = 1;
    WC.drawStrokes(m, pose.strokes, { t: key === 0 ? t : 1e9 });
    // renk yalnız parmakların arasında kalan bantta (parmakların üstüne taşmasın)
    WC.plate(c, [[[362, 259], [600, 247], [602, 291], [364, 304]].map(([x, y]) => [x * 2, y * 2])], ease((t - 2.6) / .6));
    // kâğıt payı: baskı alanı dışı kesilmiş sayılır (beyaz)
    m.setTransform(1, 0, 0, 1, 0, 0); m.fillStyle = "#fff";
    m.fillRect(0, 0, 1920, 44); m.fillRect(0, 0, 60, 1080); m.fillRect(1860, 0, 60, 1080); m.fillRect(0, 960, 1920, 120);
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 1920, 44); c.clearRect(0, 0, 60, 1080); c.clearRect(1860, 0, 60, 1080); c.clearRect(0, 960, 1920, 120);
    const out = P.render(mask, plate, { seed: 4, inkSeed: 4 + Math.floor(pull), plate: PLATE });
    const g = cv.getContext("2d")!; g.drawImage(out, 0, 0, width, height);
  }, [frame, fps, width, height, eng]);

  return <AbsoluteFill style={{ background: "#EFE8D8" }}><canvas ref={ref} width={width} height={height} /></AbsoluteFill>;
};
