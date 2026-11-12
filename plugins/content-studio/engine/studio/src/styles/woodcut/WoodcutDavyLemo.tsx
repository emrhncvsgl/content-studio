// EP014 Davy lambası açılışı, Lemo motoruyla (2026-11-12, ONAY 3 turu: "introda dramatiklik yok, woodcut Lemo motoru ile yapılmamış").
// 9:16 (1080×1920). Kılavuz: .studio/plugin/skills/remotion-styles/three-scenes.md "Lemo motoru" → "Dikey plaka + canlı alev".
// shot "flame" (s01): yakın plan; mum tutan yumruk + mum (Sculpt yontusu → woodcutFilter), oyma alevden dışa doğru VURUŞ VURUŞ açılır
//   (zaman basamaklı: her 0.34 sn'de 0.12 sn'lik bir oyma darbesi). Tavan kayası WC.shape (ışık aşağıdan), altında gaz katmanı = oyulmuş dalgalı
//   kesikler (kıpırdar, alev uzadıkça belirginleşir). ALEV tek renkli kahraman: her 2 karede yeniden çizilen çokgen + iç siyah dil çizgileri + hale
//   kesikleri + ışınlar; "begins"te kararsız titrer, "lengthen"de uzar, tavana değince tavan boyunca yayılır, gaz bandında MAVİ uç (ikinci baskı plakası).
//   Kamera: aleve doğru hızlanan itiş (zoom 1 → ~3.4, u⁴), son anda tepe/tavan temasında ekstrem yakın plan; "lengthen" bitince +5 kare SERT KESME:
//   oyulmamış kara kalıp + kâğıt payı (patlama yok).
// shot "grid" (s02): kara kalıpta daire çerçeve, sonra çapraz tel ızgarası vuruş vuruş oyulur (kaba 5+5, ince 5+5); "mesh" ile ardında 5 kor
//   (turuncu plaka, çizgilerin üstünde plaka silinir: tel krem okunur). Son 0.85 sn kâğıt yukarıdan iner (s03 "blur" geçişi kâğıttan açılır).
import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { wordFrame, type Word } from "./kit";
import { WC, Sculpt } from "./lemo";

type Shot = "flame" | "grid";
type P2 = [number, number];
const W = 1080, H = 1920, SW = 540, SH = 960;
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const vn = (x: number) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(i) + (hash(i + 1) - hash(i)) * u; };
const ss = (u: number) => { u = clamp(u); return u * u * (3 - 2 * u); };
const ORANGE = "#E07A2C", BLUE = "#4F86D6";
const WICK: P2 = [540, 1106];           // alev tabanı (çıktı koordinatı)
const CEIL = 372;                       // tavan alt kenarının ortalama y'si
const ceilY = (x: number) => CEIL + 26 * Math.sin(x * .011 + .7) + 14 * Math.sin(x * .037 + 2.1) + 8 * (vn(x * .06) - .5);
// v3 (kullanıcı 2026-11-12): TAM EKRAN plaka, kâğıt payı yok (kara kalıp kenardan kenara). Pay istenirse değerleri ver (ör. 48/40/64).
const M = { top: 0, side: 0, bottom: 0 };

// ---------- s01 yontusu: mum + yumruk + ön kol + sol arkada dikme ----------
function buildHand() {
  const S = new Sculpt(SW, SH);
  // arkadaki ahşap dikme (sol), hafif ışık alır
  // (v4: sol kenardaki ahşap dikme kaldırıldı; halesi tam ekranda kenarda dikey beyaz çizgi gibi okunuyordu)
  // mum: dikey kapsül, üst ağız, damlalar, fitil
  S.capsule([270, 560], [270, 712], 30, 32, { mat: 5, zs: .55, z0: 30, smooth: 4 });
  S.blob(270, 562, 30, 9, 0, { mat: 5, zs: .5, z0: 44 });
  for (const [x, y0, y1, r] of [[244, 566, 610, 5], [292, 568, 640, 6], [258, 570, 596, 4]] as number[][])
    S.capsule([x, y0], [x + 1, y1], r, r * .8, { mat: 5, zs: .7, z0: 40, smooth: 3 });
  S.capsule([270, 540], [272, 560], 2.6, 2.2, { mat: 2, zs: .8, z0: 52, smooth: 2 });
  // ön kol + kol yeni (sağ alttan girer)
  S.capsule([560, 960], [430, 850], 120, 100, { mat: 3, zs: .5, z0: 10, smooth: 12 });
  for (let i = 0; i < 4; i++) S.creases(470 + i * 22, 880 + i * 18, -2.4, 70, 2, 3.4, 14);
  S.capsule([440, 855], [320, 765], 78, 66, { mat: 1, zs: .6, z0: 18 });
  // yumruk: avuç + mumu öne saran dört parmak (yatay), başparmak üstte
  S.blob(318, 750, 92, 72, -.35, { mat: 0, zs: .55, z0: 26, smooth: 16 });
  [692, 722, 752, 782].forEach((y, j) => {
    const x0 = 226 + j * 4, x1 = 330 + j * 2, r = 19 - j * .8;
    S.capsule([x1, y + 4], [x0 + 18, y], r, r * .95, { mat: 0, zs: .8, z0: 48, smooth: 7 });
    S.blob(x0 + 14, y + 2, r * 1.05, r * .95, 0, { mat: 0, zs: .8, z0: 49, smooth: 6 });     // parmak ucu boğumu
    S.creases(x0 + 52, y + 1, 0, r * 1.2, 2, 2.2, 5);
  });
  S.capsule([352, 722], [300, 692], 20, 16, { mat: 0, zs: .8, z0: 58, smooth: 7 });
  S.capsule([300, 692], [262, 684], 16, 13, { mat: 0, zs: .8, z0: 60, smooth: 6 });
  S.noise(.25, 7);
  const img = S.shade(WC.light(-.12, -.8, .45), { mats: { 0: { alb: 1, spec: .22, shin: 14 }, 1: { alb: .9, spec: .12 }, 2: { alb: .5, spec: .08, amb: .03 },
    3: { alb: .8, spec: 0, amb: .04, k: .95 }, 5: { alb: 1.25, spec: .3, shin: 10, amb: .3 }, 6: { alb: .5, spec: .04, amb: .03 } } });
  // dikme sol arka: ışıktan uzak, soluk (alb .55 ile)
  const reg = new WC.Region((q: CanvasRenderingContext2D) => q.drawImage(img, 0, 0, W, H), { res: 2, bbox: [0, 0, W, H] });
  const F = WC.woodcutFilter(img, { rect: [0, 0, W, H], region: reg, sp: 5, black: .07, white: .82, gamma: 1.05, res: 2, seed: 14,
    reveal: { t0: .12, t1: 2.5, mode: "radial", cx: WICK[0], cy: WICK[1] - 40, jit: .05 } });
  const [sil, q] = WC.canvas(W, H);
  q.drawImage(img, 0, 0, W, H); q.globalCompositeOperation = "source-in"; q.fillStyle = "#000"; q.fillRect(0, 0, W, H);
  const [halo, h] = WC.canvas(W, H);
  for (let a = 0; a < 12; a++) h.drawImage(sil, Math.cos(a / 12 * 6.2832) * 6, Math.sin(a / 12 * 6.2832) * 6);
  h.globalCompositeOperation = "source-in"; h.fillStyle = "#fff"; h.fillRect(0, 0, W, H);
  return { strokes: F.strokes, sil, halo };
}

// tavan kayası: ışık aşağıdan (alevden), parlaklık basamağı k (0..3) ile genişleyen kesikler
function buildCeiling(k: number) {
  const P: P2[] = [[-60, -60], [W + 60, -60]];
  for (let x = W + 60; x >= -60; x -= 12) P.push([x, ceilY(x)]);
  return WC.shape([P], { light: WC.light(0, .85, .4), sp: 9, R: 90, amb: .02, k: .5 + .12 * k, lo: .34, hi: 1.05, dir: .08, jit: .35, halo: 0, seed: 21,
    reveal: { t0: .9, t1: 2.9, key: (x: number, y: number) => clamp(Math.hypot(x - WICK[0], (y - CEIL) * 2) / 900), speed: 1100 } });
}

// gaz katmanı: tavanın altında dalgalı kesik dizileri (faz basamağı ph, yoğunluk g 0..4)
function gasStrokes(ph: number, g: number) {
  const out: any[] = [];
  const n = 3 + g * 2;
  for (let i = 0; i < n; i++) {
    const y0 = CEIL + 40 + i * 30, pts: P2[] = [];
    for (let x = -40; x <= W + 40; x += 10)
      pts.push([x, y0 + 10 * Math.sin(x * .012 + ph * .9 + i * 1.7) + 5 * Math.sin(x * .031 - ph * 1.3 + i) + (ceilY(x) - CEIL) * (1 - i / 9)]);
    const w = (1.4 + .7 * g) * (1 - i / (n + 2));
    out.push(...WC.cutAlong(pts, { w, seg: [40, 150], gap: [14, 60 - 8 * g], seed: 300 + i * 13 + (ph % 3), jw: .4 }));
  }
  return out.sort((a, b) => b.h - a.h);
}

// alev çokgeni: kararsız titreme + uzama; tepe tavana değince tavan boyunca yayılır
function flamePoly(f2: number, grow: number) {
  const k = Math.floor(f2 / 2), n1 = vn(k * .9) - .5, n2 = vn(k * .7 + 40) - .5, n3 = vn(k * 1.3 + 90) - .5;
  const unsteady = .35 + .65 * grow;
  const h = (150 + 120 * n1 * unsteady) * (1 - grow) + grow * (1150 + 80 * n1);
  const hw = 30 * (1 + 1.1 * grow) * (1 + .18 * n3);
  const lean = 26 * n2 * (1 + 3 * grow), wob = 10 + 46 * grow;
  const L: P2[] = [], R: P2[] = [], spread: boolean[] = [];
  const N = 48, thick = 14 + 46 * grow;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const prof = u < .18 ? Math.sqrt(u / .18) : Math.pow(1 - (u - .18) / .82, 1.0);
    const cx = WICK[0] + lean * u * u + wob * Math.sin(u * 7 + k * .8) * u;
    const rag = 1 + (.22 + .25 * grow) * Math.sin(u * 19 - k * 1.3) * u;
    const y = WICK[1] + 6 - h * u, w = hw * prof * rag;
    // tavana değdi: tavan boyunca yayılan dil. Alt kenarı (yl) dışa doğru incelir ve sivri dillerle dalgalanır; eşik = alt kenar (süreklilik)
    const yl = (x: number, d: number) => ceilY(x) + 6 + thick * Math.pow(clamp(1 - d / 600), 1.4) * (.55 + .45 * Math.abs(Math.sin(x * .03 + k * .9)));
    if (y < yl(cx, 0)) {
      const d = (yl(cx, 0) - y) * 1.3, xl = cx - w - d, xr = cx + w + d * (1 + .25 * n2);
      L.push([xl, yl(xl, d)]); R.push([xr, yl(xr, d)]); spread.push(true);
    } else { L.push([cx - w, y]); R.push([cx + w, y]); spread.push(false); }
  }
  const top: P2[] = [];
  const a = L[N][0], b = R[N][0];
  if (b - a > 4 * hw) for (let x = a; x <= b; x += 14) top.push([x, ceilY(x) + 6]);
  const Ls = L.slice(), Rs = R.slice();
  return { poly: [...L, ...top, ...R.reverse()] as P2[], L: Ls, R: Rs, spread, thick, tipY: Math.max(ceilY(WICK[0]), WICK[1] - h), h, k };
}

const ease3 = (u: number) => clamp(u) ** 3;

/** Alev içi oyma: çokgen beyaz oyulur, içine biçimi izleyen KESİK siyah çizgiler (düz renk bant yerine oyma dokusu; kullanıcı v3 notu).
 *  Gövde: L/R kenarları arasında n çizgi (uca doğru birleşir). Tavan dili: tavan eğrisine paralel dalgalı yatay çizgiler. sp = çizgi aralığı. */
function carveFlame(m: CanvasRenderingContext2D, fl: ReturnType<typeof flamePoly>, sp: number, lw: number) {
  WC.fillPoly(m, [fl.poly], "#fff");
  const lines: any[] = [];
  let maxW = 0; fl.L.forEach((a, i) => { if (!fl.spread[i]) maxW = Math.max(maxW, fl.R[i][0] - a[0]); });
  const n = Math.max(3, Math.round(maxW / sp));
  for (let j = 0; j < n; j++) {
    const f = (j + .5) / n, pts: P2[] = [];
    for (let i = 1; i < fl.L.length; i++) {
      if (fl.spread[i]) break;
      const a = fl.L[i], b = fl.R[i];
      pts.push([a[0] + (b[0] - a[0]) * f + 1.5 * Math.sin(i * .9 + j * 2.3 + fl.k * .7), a[1]]);
    }
    if (pts.length > 3) lines.push(...WC.cutAlong(pts, { w: (u: number) => lw * (.45 + .9 * Math.sin(Math.PI * Math.min(1, u * 1.15))), seg: [40, 140], gap: [6, 18], seed: 500 + j * 7 + (fl.k % 3), jw: .3 }));
  }
  if (fl.spread.some(Boolean)) {
    const xs = fl.L.filter((_, i) => fl.spread[i]).map((p) => p[0]), xe = fl.R.filter((_, i) => fl.spread[i]).map((p) => p[0]);
    const x0 = Math.min(...xs) - 20, x1 = Math.max(...xe) + 20;
    for (let r = 0; r < Math.ceil((fl.thick + 30) / (sp * .6)); r++) {
      const pts: P2[] = [];
      for (let x = x0; x <= x1; x += 8) pts.push([x, ceilY(x) + 8 + r * sp * .6 + 3 * Math.sin(x * .04 + r * 1.7 + fl.k * .8)]);
      lines.push(...WC.cutAlong(pts, { w: lw * .85, seg: [30, 110], gap: [6, 20], seed: 700 + r * 5 + (fl.k % 3), jw: .3 }));
    }
  }
  m.save(); m.beginPath(); WC.pathOf(m, fl.poly); m.clip();
  WC.drawStrokes(m, lines, { t: 1e9, color: "#000" });
  m.restore();
}

/** Ekranı dolduran alev dilleri (ekran koordinatı): s01 sonu ↔ s02 başı aynı fonksiyon = alevle eşleşen geçiş. u 0..1 boy, spread genişlik, baseY taban. */
function flameField(u: number, k: number, spread: number, baseY: number, cx = 540) {
  const n: number = 9, out: { poly: P2[]; L: P2[]; R: P2[]; spread: boolean[]; thick: number; k: number; tipY: number; h: number }[] = [];
  for (let i = 0; i < n; i++) {
    const c = n === 1 ? 0 : i / (n - 1) - .5, nz = vn(k * .6 + i * 7.3) - .5;
    const bx = cx + c * spread, hw = spread / n * (1.05 + .45 * vn(i * 3.1 + k * .4)), h = u * (baseY + 760) * (.58 + .5 * (vn(i * 5.7 + k * .45)));
    const L: P2[] = [], R: P2[] = [], N = 24;
    for (let j = 0; j <= N; j++) {
      const v = j / N, prof = v < .15 ? Math.sqrt(v / .15) : Math.pow(1 - (v - .15) / .85, .9);
      const x = bx + (40 * nz + c * 120) * v * v + 22 * Math.sin(v * 6 + k * .9 + i) * v, y = baseY + 220 - h * v, w = hw * prof * (1 + .2 * Math.sin(v * 15 - k + i));
      L.push([x - w, y]); R.push([x + w, y]);
    }
    out.push({ poly: [...L, ...R.slice().reverse()], L, R, spread: L.map(() => false), thick: 0, k: k + i, tipY: baseY - h, h });
  }
  return out;
}


const FlameShot: React.FC<{ words?: Word[] }> = ({ words }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const eng = useMemo(() => {
    const [mask, m] = WC.canvas(W, H), [pa, ca] = WC.canvas(W, H), [pb, cb] = WC.canvas(W, H), [tmp, ct] = WC.canvas(W, H);
    return { mask, m, pa, ca, pb, cb, tmp, ct, P1: WC.makePrinter(W, H), P2: WC.makePrinter(W, H), hand: buildHand(), ceil: new Map<number, any>(), gas: new Map<string, any[]>() };
  }, []);
  const fBeg = wordFrame(words, "begins", fps, 3.2), fLen = wordFrame(words, "lengthen", fps, 3.8);
  const fCut = wordFrame(words, "lengthen", fps, 4.76, "end") + 5;     // eski sert kesme karesi: büyüme ve kamera burada doruğa varır
  const { durationInFrames: D } = useVideoConfig();
  const fF0 = fCut - 12;                                                      // v3: alev büyüyerek kareyi doldurur (patlama yok), s02 aynı alevden açılır

  useLayoutEffect(() => {
    const cv = ref.current; if (!cv) return;
    const out = cv.getContext("2d")!;
    const { m, ca, cb, mask, pa, pb, tmp, ct, P1, P2 } = eng;
    const t = frame / fps, f2 = frame - (frame % 2);
    const reset = () => { for (const g of [m, ca, cb]) g.setTransform(1, 0, 0, 1, 0, 0); };
    reset();
    m.fillStyle = "#000"; m.fillRect(0, 0, W, H); ca.clearRect(0, 0, W, H); cb.clearRect(0, 0, W, H);
    const lit = true;
    let blueOn = false;
    if (lit) {
      // büyüme: "begins"ten itibaren yavaş, "lengthen"de hızlanır (kesmede en uzun, hâlâ büyüyor)
      const grow = clamp(.12 * ss((f2 - fBeg) / Math.max(6, fLen - fBeg)) + .88 * ease3((f2 - fLen + 2) / Math.max(8, fCut - fLen - 2)) ** .75);
      // kamera: hızlanan itiş, odak aleve sonra alevin tavana değdiği yere
      const u = clamp(frame / fCut);
      const zoom = 1 + .14 * u + 2.3 * u ** 4;
      const fl = flamePoly(f2, grow);
      const fy = WICK[1] - 60 + (fl.tipY + 70 - (WICK[1] - 60)) * ss((frame - fLen) / (fCut - fLen)) - 40 * ss(frame / fLen);
      const fx = WICK[0];
      const ox = 540 - fx * zoom, oy = 980 - fy * zoom;
      const T = (g: CanvasRenderingContext2D) => g.setTransform(zoom, 0, 0, zoom, ox + fx - fx, oy);
      for (const g of [m, ca, cb]) T(g);
      // karşı dengede: zoom 1'de çerçeve = dünya (oy ≈ 0)
      // ışınlar (alevden; uzunluk alevle)
      const inten = .35 + .65 * grow;
      const rays = WC.rays(WICK[0], WICK[1] - fl.h * .45, { n: 26, r0: 90 + fl.h * .2, r1: [260 * inten + 120, 700 * inten + 200], w: 9 + 6 * grow, seed: 5, jit: .8, a0: -Math.PI, a1: Math.PI });
      const rv = clamp((t - .05) / .5);
      if (rv > 0) WC.drawStrokes(m, rays, { t: 1e9 });
      // tavan + gaz katmanı
      const ck = Math.min(3, Math.round(grow * 3));
      let ceil = eng.ceil.get(ck); if (!ceil) { ceil = buildCeiling(ck); eng.ceil.set(ck, ceil); }
      ceil.draw(m, t);
      const ph = Math.floor(f2 / 4), gk = Math.min(4, Math.round(clamp((t - 2.6) / 2.2 + grow * .6) * 4));
      const gkey = `${ph},${gk}`;
      let gas = eng.gas.get(gkey); if (!gas) { gas = gasStrokes(ph, gk); eng.gas.set(gkey, gas); }
      WC.drawStrokes(m, gas, { t: 1e9 });
      // el + mum: vuruş vuruş oyma (zaman basamaklı)
      const P = .34, B = .12, n = Math.floor(t / P), tc = n * P + clamp((t - n * P) / B) * P;
      const hd = eng.hand, ha = ss((t - .1) / .5);
      m.save(); m.globalAlpha = ha; m.drawImage(hd.halo, 0, 0); m.drawImage(hd.sil, 0, 0); m.restore();
      WC.drawStrokes(m, hd.strokes, { t: tc });
      // ALEV: hale kesikleri, gövde (oyulmuş beyaz), iç siyah dil çizgileri
      const halo1 = WC.cutAlong(WC.offsetPoly(fl.poly, 16 + 6 * grow), { closed: true, w: 5 + 3 * grow, seg: [30, 90], gap: [10, 26], seed: 40 + (fl.k % 4) });
      const halo2 = WC.cutAlong(WC.offsetPoly(fl.poly, 40 + 14 * grow), { closed: true, w: 3 + 2 * grow, seg: [18, 50], gap: [20, 50], seed: 60 + (fl.k % 3) });
      WC.drawStrokes(m, [...halo1, ...halo2], { t: 1e9 });
      carveFlame(m, fl, 11, 3.2);
      const tongues: any[] = [];
      for (let j = 0; j < 4; j++) {
        const pts: P2[] = [], ws: number[] = [], off = (j - 1.5) * 9 * (1 + .4 * grow);
        for (let i = 2; i <= 30; i++) {
          const v = i / 40, idx = Math.round(v * 48), a = fl.poly[idx], b = fl.poly[fl.poly.length - 1 - idx];
          const cx = (a[0] + b[0]) / 2 + off * (1 - v) + 4 * Math.sin(v * 9 + j + fl.k * .6), y = a[1];
          pts.push([cx, y]); ws.push(3.2 * Math.sin(Math.PI * (i - 2) / 28) * (j % 3 ? 1 : .7));
        }
        if (false) tongues.push(WC.mkStroke(pts, ws, { kind: "v", seed: 7 + j, chip: 0 }));
      }
      WC.drawStrokes(m, tongues, { t: 1e9, color: "#000" });
      // plakalar: turuncu gövde; gaz bandında mavi uç (dikey geçiş)
      const blueY0 = CEIL + 300, blueY1 = CEIL + 120, bAmt = ss((frame - fLen) / 10) * (1 - ss((frame - fF0) / 8));   // v4: dolmada mavi söner (leke kalmasın)
      blueOn = bAmt > 0;
      const grad = (g: CanvasRenderingContext2D, blue: boolean) => {
        const lg = g.createLinearGradient(0, blueY0, 0, blueY1);
        const a = blue ? bAmt : 0;
        lg.addColorStop(0, `rgba(0,0,0,${blue ? 0 : 1})`); lg.addColorStop(1, `rgba(0,0,0,${blue ? a : 1 - a})`);
        return lg;
      };
      const big = WC.offsetPoly(fl.poly, 4);
      ca.fillStyle = grad(ca, false); ca.beginPath(); WC.pathOf(ca, big); ca.fill();
      if (blueOn) { cb.fillStyle = grad(cb, true); cb.beginPath(); WC.pathOf(cb, big); cb.fill(); }
      reset();
      // dolma: ekran koordinatında alttan yükselen oyma alev dilleri, tek renk (mavi plaka dillerin altında silinir)
      const fu = ss((frame - fF0) / Math.max(4, D - 1 - fF0));
      if (fu > 0) {
        const field = flameField(.15 + .95 * fu, Math.floor(f2 / 2), 1250, H);
        for (const fl2 of field) carveFlame(m, fl2, 15, 4.2);
        WC.fillPoly(ca, field.map((f) => WC.offsetPoly(f.poly, 3)), "#000");
        cb.globalCompositeOperation = "destination-out"; WC.fillPoly(cb, field.map((f) => WC.offsetPoly(f.poly, 3)), "#000"); cb.globalCompositeOperation = "source-over";
      }
    }
    // kâğıt payı (dönüşümden sonra, sabit)
    m.fillStyle = "#fff";
    m.fillRect(0, 0, W, M.top); m.fillRect(0, 0, M.side, H); m.fillRect(W - M.side, 0, M.side, H); m.fillRect(0, H - M.bottom, W, M.bottom);
    for (const c of [ca, cb]) { c.clearRect(0, 0, W, M.top); c.clearRect(0, 0, M.side, H); c.clearRect(W - M.side, 0, M.side, H); c.clearRect(0, H - M.bottom, W, M.bottom); }
    const o1 = P1.render(mask, pa, { seed: 14, inkSeed: 14, plate: ORANGE });
    out.drawImage(o1, 0, 0, width, height);
    if (blueOn) {
      const o2 = P2.render(mask, pb, { seed: 14, inkSeed: 14, plate: BLUE });
      ct.globalCompositeOperation = "copy"; ct.drawImage(o2, 0, 0);
      ct.globalCompositeOperation = "destination-in"; ct.drawImage(pb, 0, 0);       // yalnız mavi plakanın bulunduğu yer
      ct.globalCompositeOperation = "source-over";
      out.drawImage(tmp, 0, 0, width, height);
    }
  });
  return <AbsoluteFill style={{ background: "#EFE8D8" }}><canvas ref={ref} width={width} height={height} /></AbsoluteFill>;
};

// ---------- s02: karanlığa tel ızgara, ardında kor ----------
const GC: P2 = [540, 940], GR = 400;
function gridStrokes(words: Word[] | undefined, fps: number) {
  const fMesh = wordFrame(words, "mesh", fps, 1.48) / fps;
  const out: any[] = [];
  const ring: P2[] = Array.from({ length: 120 }, (_, i) => [GC[0] + Math.cos(i / 120 * 6.2832 - 1.6) * GR, GC[1] + Math.sin(i / 120 * 6.2832 - 1.6) * GR]);
  out.push(...WC.cutAlong(ring, { closed: false, w: 11, seg: [160, 320], gap: [2, 6], seed: 3, reveal: { t0: .12, t1: .6, speed: 3200 } }));
  const line = (s: number, dir: number, w: number, t0: number, seed: number) => {
    // dir ±1: 45° çapraz; s: dik ofset. Daireyle kırp.
    const ux = Math.SQRT1_2, uy = dir * Math.SQRT1_2, nx = -uy, ny = ux;
    const half = Math.sqrt(Math.max(0, (GR - 14) ** 2 - s * s));
    if (half < 30) return;
    const ox = GC[0] + nx * s, oy = GC[1] + ny * s, pts: P2[] = [];
    for (let k = -half; k <= half; k += 12) pts.push([ox + ux * k + 1.5 * Math.sin(k * .05 + seed), oy + uy * k + 1.5 * Math.cos(k * .04 + seed)]);
    const st = WC.mkStroke(pts, pts.map((_, i) => w * (.75 + .25 * Math.sin(Math.PI * i / (pts.length - 1)))), { kind: "v", seed: 100 + seed, chip: .1 });
    st.t0 = t0; st.dur = .14; out.push(st);
  };
  const coarse = [-2, -1, 0, 1, 2], fine = [-1.5, -.5, .5, 1.5, 2.5];
  let i = 0;
  for (const s of coarse) for (const d of [1, -1]) { line(s * 150, d, 8, .55 + i * .1, i); i++; }
  let j = 0;
  for (const s of fine) for (const d of [-1, 1]) { line(s * 150 - 75 + 75, d, 4.5, Math.max(fMesh - .1, 1.45) + j * .06, 50 + j); j++; }
  return { strokes: out, fMesh };
}
const EMBERS: [number, number, number][] = [[470, 1000, 70], [620, 950, 58], [545, 1105, 50], [390, 890, 36], [690, 1080, 40], [560, 860, 30]];
const emberPoly = (x: number, y: number, r: number, k: number, i: number): P2[] =>
  Array.from({ length: 18 }, (_, a) => { const th = a / 18 * 6.2832, rr = r * (.75 + .35 * vn(a * .7 + i * 9 + k * .5)); return [x + Math.cos(th) * rr, y + Math.sin(th) * rr * .8] as P2; });

const GridShot: React.FC<{ words?: Word[] }> = ({ words }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const eng = useMemo(() => {
    const [mask, m] = WC.canvas(W, H), [pa, ca] = WC.canvas(W, H);
    return { mask, m, pa, ca, P: WC.makePrinter(W, H), grid: gridStrokes(words, fps) };
  }, [words, fps]);
  useLayoutEffect(() => {
    const cv = ref.current; if (!cv) return;
    const { m, ca, mask, pa, P, grid } = eng;
    const t = frame / fps, f2 = frame - (frame % 2), k = Math.floor(f2 / 2);
    for (const g of [m, ca]) g.setTransform(1, 0, 0, 1, 0, 0);
    m.fillStyle = "#000"; m.fillRect(0, 0, W, H); ca.clearRect(0, 0, W, H);
    const zoom = 1 + .07 * ss(frame / durationInFrames);
    for (const g of [m, ca]) g.setTransform(zoom, 0, 0, zoom, GC[0] - GC[0] * zoom, GC[1] - GC[1] * zoom);
    // korlar: "mesh" ile yanar, nabız gibi
    const glow = ss((t - grid.fMesh) / .5);
    // açılış: s01'in son karesindeki alev alanı (aynı fonksiyon, ekran koordinatı) çekilip korlara iner; ızgara alevin önünde siyah siluet
    const back = 1 - ss((t - .05) / 1.25);
    const field = back > 0 ? flameField(.15 + .95 * back, k + 80, 1250 - 700 * (1 - back), H - (H - (GC[1] + GR * .45)) * (1 - back)) : [];
    if (glow > 0) {
      const polys = EMBERS.map(([x, y, r], i) => emberPoly(x, y, r * (.4 + .6 * glow) * (1 + .12 * Math.sin(k * .5 + i * 2)), k, i));
      const sparks = EMBERS.flatMap(([x, y, r], i) => WC.rays(x, y, { n: 12, r0: r * 1.15, r1: [r * 1.8, r * (1.9 + 1.6 * glow)], w: 5, seed: 9 + i + (k % 3), jit: .9 }));
      WC.drawStrokes(m, sparks, { t: 1e9 });
      WC.fillPoly(m, polys, "#fff");
      WC.fillPoly(ca, polys.map((p) => WC.offsetPoly(p, 3)), `rgba(0,0,0,${glow})`);
    }
    // ızgara kesikleri (korların üstünde): plakayı tel boyunca sil, tel krem okunsun
    WC.drawStrokes(m, grid.strokes, { t });
    ca.globalCompositeOperation = "destination-out"; WC.drawStrokes(ca, grid.strokes, { t, color: "#000" }); ca.globalCompositeOperation = "source-over";
    if (field.length) {
      for (const g of [m, ca]) g.setTransform(1, 0, 0, 1, 0, 0);
      for (const fl2 of field) carveFlame(m, fl2, 15, 4.2);
      WC.fillPoly(ca, field.map((f) => WC.offsetPoly(f.poly, 3)), "#000");
      for (const g of [m, ca]) g.setTransform(zoom, 0, 0, zoom, GC[0] - GC[0] * zoom, GC[1] - GC[1] * zoom);
      // alevin içinde tel: siyah siluet (alevle eşleşme), plakada da tel boyunca boşluk
      m.save(); m.setTransform(1, 0, 0, 1, 0, 0); m.beginPath(); for (const f of field) WC.pathOf(m, f.poly); m.clip();
      m.setTransform(zoom, 0, 0, zoom, GC[0] - GC[0] * zoom, GC[1] - GC[1] * zoom);
      WC.drawStrokes(m, grid.strokes.map((s: any) => ({ ...s, w: s.w.map((v: number) => v * 1.25) })), { t, color: "#000" });
      m.restore();
    }
    for (const g of [m, ca]) g.setTransform(1, 0, 0, 1, 0, 0);
    m.fillStyle = "#fff";
    m.fillRect(0, 0, W, M.top); m.fillRect(0, 0, M.side, H); m.fillRect(W - M.side, 0, M.side, H); m.fillRect(0, H - M.bottom, W, M.bottom);
    const o = P.render(mask, pa, { seed: 15, inkSeed: 15, plate: ORANGE });
    cv.getContext("2d")!.drawImage(o, 0, 0, width, height);
  });
  // son 0.85 sn: kâğıt yukarıdan iner (heavy ease-out), alt kenarı yırtık
  const u = clamp((frame - (durationInFrames - 26)) / 22), peel = 1 - Math.pow(1 - u, 4);
  const torn = Array.from({ length: 25 }, (_, i) => `${i * 100 / 24}% ${96 + 4 * hash(i + 7)}%`);
  return (
    <AbsoluteFill style={{ background: "#EFE8D8" }}>
      <canvas ref={ref} width={width} height={height} />
      {peel > 0 ? <AbsoluteFill style={{ backgroundColor: "#e8dcc1", transform: `translateY(${(-104 + 104 * peel).toFixed(2)}%)`,
        clipPath: `polygon(0% 0%, 100% 0%, ${torn.reverse().join(", ")})`, boxShadow: "0 18px 40px rgba(0,0,0,0.45)" }} /> : null}
    </AbsoluteFill>
  );
};

export const WoodcutDavyLemo: React.FC<{ durationInFrames?: number; words?: Word[]; shot?: Shot }> = ({ words, shot = "flame" }) =>
  shot === "grid" ? <GridShot words={words} /> : <FlameShot words={words} />;
