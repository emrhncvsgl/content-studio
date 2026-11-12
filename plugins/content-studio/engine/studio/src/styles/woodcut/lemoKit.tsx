// Lemo motoruyla woodcut plakası kurmak için ortak kit (EP010). Bir sahne = bir `PlateDef`:
// yontu (Sculpt yükseklik alanı) → ışık → woodcutFilter kesikleri → baskı. Pozlar tamsayı parametre dizisiyle anahtarlanır ve önbelleğe alınır:
// aynı poz aynı kesikleri verir (kaynama yok), poz değişimi "yeni baskı" gibi okunur. Kılavuz: .studio/plugin/skills/remotion-styles/three-scenes.md.
import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { wordFrame, type Word } from "./kit";
import { WC, Sculpt } from "./lemo";

export const SW = 960, SH = 540;                 // yontu çözünürlüğü; baskı 1920×1080 (×2)
export type P2 = [number, number];
export type Cue = (name: string, fallbackS: number) => number;      // ipucu kelimesinin saniyesi ("word", "word.+900")
export type PlateProps = { durationInFrames?: number; words?: Word[]; cue?: Record<string, string>; variant?: string; value?: number };

export type PlateDef = {
  seed?: number;
  light: [number, number, number];               // WC.light(x,y,z): x<0 soldan, y<0 üstten, z≈.4 yalayan
  mats?: Record<number, Record<string, number>>;
  /** t (sn, ikişer karede) → tamsayı poz parametreleri. Az basamak kullan: her yeni değer bir filtre koşusu. */
  pose: (t: number, c: Cue) => number[];
  sculpt: (S: any, p: number[]) => void;
  plate?: (p: number[]) => P2[][];               // tek renk plakası (yontu koordinatı); yalnız oyulmuş beyazda görünür
  plateColor?: string; plateAt?: (c: Cue) => number;
  rays?: { cx: number; cy: number; a0: number; a1: number; n?: number; r1?: [number, number]; w?: number };
  reveal?: { t0: number; t1: number };           // oyma açılışı (parlaktan karanlığa)
  filter?: { sp?: number; black?: number; white?: number; gamma?: number };
  zoom?: number; focus?: P2;                     // 2D yavaş yaklaşma (kâğıt payı sabit)
};

export const ease = (u: number) => { u = Math.min(1, Math.max(0, u)); return u * u * (3 - 2 * u); };
/** 0..n basamaklı ilerleme: t0'dan itibaren dur sn'de n basamak (poz parametresi için) */
export const steps = (t: number, t0: number, dur: number, n: number) => Math.round(Math.min(1, Math.max(0, (t - t0) / dur)) * n);

const DEFAULT_MATS = { 0: { alb: 1, spec: .22, shin: 14 }, 1: { alb: .9, spec: .12 }, 2: { alb: .5, spec: .08, amb: .03 }, 3: { alb: .8, spec: 0, amb: .04, k: .95 },
  5: { alb: 1.25, spec: .3, shin: 10, amb: .3 }, 6: { alb: .5, spec: .04, amb: .03 }, 7: { alb: .7, spec: .5, shin: 30 } };
// malzemeler: 0 ten · 1 ön kol · 2 koyu nesne (kutu) · 3 kumaş · 5 en parlak (bant, kâğıt, ibre) · 6 gölge yüz · 7 metal

export type HandOpts = { ox: number; oy: number; ang: number; sc: number; mirror?: boolean; zoff: number; sleeve?: boolean; curl?: number };
/** Lemo demo elinin (sağ el, parmaklar öne kıvrık) yerel ölçüleri; bilek (420,150). ang: dönüş (rad), mirror: düşey eksende ayna (x → SW−x).
 *  curl 0..1: parmak uçlarını avuca doğru büker (yumruk/kavrama). Bilekten parmak ucuna yön ≈ ang + 0.58 rad, uzunluk ≈ 320·sc. */
export function hand(S: any, o: HandOpts) {
  const c = Math.cos(o.ang), s = Math.sin(o.ang), k = o.sc, curl = o.curl ?? 0;
  const T = (lx: number, ly: number): P2 => {
    const dx = (lx - 420) * k, dy = (ly - 150) * k;
    const x = o.ox + dx * c - dy * s, y = o.oy + dx * s + dy * c;
    return [o.mirror ? SW - x : x, y];
  };
  const rot = (r: number) => (o.mirror ? -(r + o.ang) : r + o.ang);
  const z = (v: number) => v * k + o.zoff;
  if (o.sleeve !== false) S.capsule(T(190, -80), T(330, 60), 92 * k, 85 * k, { mat: 3, zs: .6, z0: z(30), smooth: 10 * k });
  S.capsule(T(250, -60), T(420, 150), 70 * k, 50 * k, { mat: 1, zs: .75, z0: z(18) });
  { const [x, y] = T(505, 200); S.blob(x, y, 92 * k, 60 * k, rot(.42), { mat: 0, zs: .55, z0: z(22), smooth: 18 * k }); }
  const fingers: P2[][] = [
    [[540, 150], [600, 190], [640, 250], [650, 292]], [[560, 178], [626, 222], [660, 276], [664, 314]],
    [[560, 210], [620, 256], [648, 304], [650, 336]], [[544, 238], [592, 282], [612, 322], [614, 350]]];
  const fr = [[27, 23, 19, 16], [28, 24, 20, 17], [26, 22, 18, 15], [22, 19, 16, 13]].map((r) => r.map((v) => v * .8));
  fingers.forEach((F0, j) => {
    const F = F0.map(([x, y], i) => {
      const L = 1.2 - .45 * curl * (i / 3);                                   // kıvrıkken uçlar kısalır
      return [F0[0][0] + (x - F0[0][0]) * L - 30 * curl * (i / 3), F0[0][1] + (y - F0[0][1]) * L + 26 * curl * (i / 3)] as P2;
    });
    for (let i = 0; i < 3; i++) S.capsule(T(...F[i]), T(...F[i + 1]), fr[j][i] * k, fr[j][i + 1] * k, { mat: 0, zs: .8, z0: z(26 - i * 4), smooth: 7 * k });
    for (let i = 0; i < 3; i++) { const [x, y] = T(...F[i]); S.blob(x, y, fr[j][i] * 1.08 * k, fr[j][i] * .95 * k, 0, { mat: 0, zs: .8, z0: z(27 - i * 4), smooth: 6 * k }); }
    for (let i = 1; i < 3; i++) { const [x, y] = T(...F[i]), [x2, y2] = T(...F[i + 1]); S.creases(x, y, Math.atan2(y2 - y, x2 - x), fr[j][i] * 1.3 * k, 4, 2.2 * k, 3.6 * k); }
  });
  S.capsule(T(430, 215), T(470, 280), 25 * k, 20 * k, { mat: 0, zs: .75, z0: z(20) });
  S.capsule(T(470, 280), T(528 - 20 * curl, 326), 20 * k, 14 * k, { mat: 0, zs: .75, z0: z(20) });
  { const [x, y] = T(470, 280), [x2, y2] = T(520, 318); S.creases(x, y, Math.atan2(y2 - y, x2 - x), 30 * k, 4, 2.4 * k, 4 * k); }
  for (const [a, b] of [[[430, 170], [540, 170]], [[440, 198], [556, 206]], [[450, 224], [548, 232]]] as P2[][])
    S.capsule(T(...a), T(...b), 4.5 * k, 3 * k, { mat: 0, zs: .7, z0: z(40), smooth: 5 * k });
  return { tip: T(650 * 1.0 + 20, 300), wrist: T(420, 150) };
}

/** Halka (bant rulosu, kadran çerçevesi, makas sapı): çember boyunca kapsüller. sy: düşey basıklık. */
export function ring(S: any, cx: number, cy: number, R: number, r: number, o: { mat?: number; z0?: number; n?: number; sy?: number; a0?: number; a1?: number } = {}) {
  const n = o.n ?? 40, a0 = o.a0 ?? 0, a1 = o.a1 ?? Math.PI * 2, sy = o.sy ?? 1;
  for (let i = 0; i < n; i++) {
    const a = a0 + (a1 - a0) * i / n, b = a0 + (a1 - a0) * (i + 1) / n;
    S.capsule([cx + Math.cos(a) * R, cy + Math.sin(a) * R * sy], [cx + Math.cos(b) * R, cy + Math.sin(b) * R * sy], r, r, { mat: o.mat ?? 7, zs: .8, z0: o.z0 ?? 20, smooth: 4 });
  }
}
export const ellipse = (cx: number, cy: number, rx: number, ry: number, n = 48): P2[] => Array.from({ length: n }, (_, i) => [cx + Math.cos(i / n * 6.2832) * rx, cy + Math.sin(i / n * 6.2832) * ry] as P2);
/** Dönmüş dikdörtgen (bant şeridi, karton, kutu yüzü) */
export const strip = (x0: number, y0: number, x1: number, y1: number, w: number): P2[] => {
  const d = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / d * w / 2, ny = (x1 - x0) / d * w / 2;
  return [[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]];
};
/** Kare LiOH kutusu: süzgeçli üst yüz + alçak ön yüz. poly: üst yüzün 4 köşesi (saat yönünde, sol üstten). */
export function canister(S: any, poly: P2[], z = 44, front = 46) {
  const [, , br, bl] = poly;
  S.plank([bl, br, [br[0] - 5, br[1] + front], [bl[0] + 9, bl[1] + front]], z * .5, 6, 6);
  S.plank(poly, z, 12, 2);
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) { const i = y * SW + x; if (S.id[i] === 2 && S.H[i] > z - .5) S.H[i] += 1.3 * Math.sin((x * .97 + y * .1) * .42); }
}

type Built = { strokes: any[]; sil: HTMLCanvasElement; halo: HTMLCanvasElement };
function build(def: PlateDef, p: number[]): Built {
  const S = new Sculpt(SW, SH);
  def.sculpt(S, p);
  S.noise(.25, 7);
  const img = S.shade(WC.light(...def.light), { mats: { ...DEFAULT_MATS, ...(def.mats ?? {}) } });
  const reg = new WC.Region((q: CanvasRenderingContext2D) => q.drawImage(img, 0, 0, 1920, 1080), { res: 2, bbox: [0, 0, 1920, 1080] });
  const f = def.filter ?? {}, rv = def.reveal ?? { t0: .5, t1: 2.9 };
  const F = WC.woodcutFilter(img, { rect: [0, 0, 1920, 1080], region: reg, sp: f.sp ?? 5, black: f.black ?? .06, white: f.white ?? .82, gamma: f.gamma ?? 1.05,
    res: 2, seed: def.seed ?? 3, reveal: { t0: rv.t0, t1: rv.t1, mode: "light" } });
  const [sil, q] = WC.canvas(1920, 1080);
  q.drawImage(img, 0, 0, 1920, 1080); q.globalCompositeOperation = "source-in"; q.fillStyle = "#000"; q.fillRect(0, 0, 1920, 1080);
  const [halo, h] = WC.canvas(1920, 1080);
  for (let a = 0; a < 12; a++) h.drawImage(sil, Math.cos(a / 12 * 6.2832) * 6, Math.sin(a / 12 * 6.2832) * 6);
  h.globalCompositeOperation = "source-in"; h.fillStyle = "#fff"; h.fillRect(0, 0, 1920, 1080);
  return { strokes: F.strokes, sil, halo };
}

/** Plaka bileşeni: sahne dosyası yalnız PlateDef üretir. Kare = zamanın saf fonksiyonu. */
export const LemoPlate: React.FC<{ def: PlateDef; props: PlateProps }> = ({ def, props }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const eng = useMemo(() => {
    const [mask, m] = WC.canvas(1920, 1080), [plate, c] = WC.canvas(1920, 1080);
    const r = def.rays;
    const rays = r ? WC.rays(r.cx * 2, r.cy * 2, { n: r.n ?? 30, r0: 70, r1: r.r1 ?? [420, 1500], w: r.w ?? 13, seed: 2, a0: r.a0, a1: r.a1, jit: .7, reveal: { t0: 0, t1: 1.3 } }) : [];
    return { mask, m, plate, c, P: WC.makePrinter(1920, 1080), rays, poses: new Map<string, Built>() };
  }, [def]);
  const cue: Cue = (name, fb) => {
    const raw = props.cue?.[name]; if (!raw) return fb;
    const mm = /^(.*?)(?:\+(\d+))?$/.exec(raw)!;
    return wordFrame(props.words, mm[1], fps, fb) / fps + (mm[2] ? Number(mm[2]) / 1000 : 0);
  };

  useLayoutEffect(() => {
    const cv = ref.current; if (!cv) return;
    const t = frame / fps, t2 = (frame - (frame % 2)) / fps;
    const p = def.pose(t2, cue), key = p.join(",");
    let pose = eng.poses.get(key);
    if (!pose) { pose = build(def, p); eng.poses.set(key, pose); }
    const { m, c, mask, plate, P } = eng;
    const zoom = 1 + (def.zoom ?? .05) * ease(frame / durationInFrames), [fx, fy] = def.focus ?? [480, 280];
    for (const g of [m, c]) g.setTransform(1, 0, 0, 1, 0, 0);
    m.fillStyle = "#000"; m.fillRect(0, 0, 1920, 1080); c.clearRect(0, 0, 1920, 1080);
    for (const g of [m, c]) g.setTransform(zoom, 0, 0, zoom, fx * 2 - fx * 2 * zoom, fy * 2 - fy * 2 * zoom);
    WC.drawStrokes(m, eng.rays, { t });
    const rv = def.reveal ?? { t0: .5, t1: 2.9 };
    m.globalAlpha = ease((t - rv.t0 + .2) / .9); m.drawImage(pose.halo, 0, 0); m.drawImage(pose.sil, 0, 0); m.globalAlpha = 1;
    WC.drawStrokes(m, pose.strokes, { t });
    if (def.plate) WC.plate(c, def.plate(p).map((poly) => poly.map(([x, y]) => [x * 2, y * 2])), ease((t - (def.plateAt ? def.plateAt(cue) : rv.t1 - .3)) / .6));
    m.setTransform(1, 0, 0, 1, 0, 0); m.fillStyle = "#fff";
    m.fillRect(0, 0, 1920, 44); m.fillRect(0, 0, 60, 1080); m.fillRect(1860, 0, 60, 1080); m.fillRect(0, 960, 1920, 120);
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 1920, 44); c.clearRect(0, 0, 60, 1080); c.clearRect(1860, 0, 60, 1080); c.clearRect(0, 960, 1920, 120);
    const out = P.render(mask, plate, { seed: def.seed ?? 4, inkSeed: (def.seed ?? 4) + (key.length % 3), plate: def.plateColor ?? "#E0A030" });
    cv.getContext("2d")!.drawImage(out, 0, 0, width, height);
  });

  return <AbsoluteFill style={{ background: "#EFE8D8" }}><canvas ref={ref} width={width} height={height} /></AbsoluteFill>;
};
