// EP010 (Apollo 13) woodcut plakaları, Lemo motoru + lemoKit. Her sahne bir PlateDef; kelime ipuçları timeline props.cue'dan gelir.
// Sahneler: s12/s51 WoodcutLMGauge · s20 WoodcutLMHeadset · s27 WoodcutArmRuler · s29 WoodcutLemoHands · s46 WoodcutLMWait · s48 WoodcutSecondBox · s61 WoodcutStillLife
// (s07 WoodcutLMCabin ayrı dosyada: three.js + Lemo karışımı.) Tek kare: npx remotion still src/index.ts <Comp> out/trials/x.png --frame=N
import React, { useMemo } from "react";
import { canister, ellipse, hand, LemoPlate, ring, steps, strip, type P2, type PlateDef, type PlateProps } from "./lemoKit";

const D = Math.PI / 180;
const BOX: P2[] = [[338, 168], [628, 150], [648, 404], [352, 424]];
const TOP_FAN = { cx: 480, cy: -20, a0: .35, a1: 2.8, n: 34 };            // üstten aşağı yelpaze
const LAMP_TL = { cx: 105, cy: 35, a0: .02, a1: 1.45 };                   // sol üst lamba

// ---- s29: bandı geren iki el (onaylanan deneme; bant plakası artık ellerle birlikte uzar, germe daha belirgin)
const handsDef = (): PlateDef => ({
  light: [-.5, -.58, .42], rays: LAMP_TL, zoom: .05, focus: [480, 280],
  pose: (t, c) => { const tp = c("pull", 4.5); return [t < tp - .3 ? 0 : t < tp ? -Math.round(3 * (t - tp + .3) / .3) : t < tp + .1 ? 20 : 20 - steps(t, tp + .1, .5, 3)]; },
  sculpt: (S, [pull]) => {
    canister(S, BOX);
    S.plank([[296 - pull, 262], [664 + pull, 244], [666 + pull, 288], [298 - pull, 308]], 53, 5, 5);
    hand(S, { ang: -1.0, sc: .9, zoff: 46, ox: 86 - pull, oy: 392 });
    hand(S, { ang: -1.0, sc: .9, zoff: 46, ox: 86 - pull, oy: 372, mirror: true });
  },
  plate: ([pull]) => [[[362 - pull, 259], [600 + pull, 247], [602 + pull, 291], [364 - pull, 304]]],
});

// ---- s12 / s51: CO2 kadranı. Ölçek 0..20 mmHg, sol alttan (150°) üstten geçip sağ alta (390°).
const GA = (v: number) => (150 + v / 20 * 240) * D, GC: P2 = [470, 255];
const gp = (v: number, r: number): P2 => [GC[0] + Math.cos(GA(v)) * r, GC[1] + Math.sin(GA(v)) * r];
const gaugeDef = (props: PlateProps): PlateDef => {
  const high = props.variant === "needle-high", val = props.value ?? (high ? 12.5 : 6);
  return {
    light: [.05, -.75, .42], rays: TOP_FAN, zoom: .06, focus: [470, 260], seed: 5,
    // tap-mark: [vuruş 0/1, işaret basamağı 0..5] · needle-high: [vuruş 0/1, ibre titremesi -1..1]
    pose: (t, c) => {
      if (high) { const a = c("tap1", 1.4), b = c("tap2", 3.0); const tap = (t >= a && t < a + .14) || (t >= b && t < b + .14) ? 1 : 0;
        const q = (t0: number) => (t >= t0 + .14 && t < t0 + .5 ? (Math.round((t - t0) * 12) % 2 ? 1 : -1) : 0); return [tap, q(a) || q(b)]; }
      const a = c("tap", 1.2); return [t >= a && t < a + .14 ? 1 : 0, steps(t, c("markSlide", 2.6), .7, 5)];
    },
    sculpt: (S, [tap, k]) => {
      S.plank(ellipse(GC[0], GC[1], 172, 172), 22, 10, 6);
      ring(S, GC[0], GC[1], 181, 13, { z0: 24, n: 56 });
      for (let i = 0; i <= 20; i++) S.capsule(gp(i, i % 5 ? 146 : 130), gp(i, 160), 2.4, 2.4, { mat: 5, zs: .8, z0: 26, smooth: 2 });
      const v = high ? val + .35 * k : val;
      S.capsule(GC, gp(v, 136), 5, 2, { mat: 5, zs: .8, z0: 31, smooth: 3 }); S.blob(GC[0], GC[1], 14, 14, 0, { mat: 7, zs: .7, z0: 32 });
      if (!high) { const m = 7.6 + (15 - 7.6) * k / 5; S.capsule(gp(m, 150), gp(m, 172), 7, 5, { mat: 5, zs: .8, z0: 34, smooth: 3 }); }
      hand(S, { ang: -1.27, sc: .8, zoff: 40, ox: 204 + 6 * tap, oy: 495 - 6 * tap, mirror: true });      // sağ alttan, parmak uçları cama
    },
    plate: ([, k]) => high ? [strip(GC[0], GC[1], ...gp(val + .35 * k, 138), 12)] : [strip(...gp(7.6 + 7.4 * k / 5, 146), ...gp(7.6 + 7.4 * k / 5, 176), 18)],
    plateAt: (c) => (high ? 1.0 : c("tap", 1.2)),
  };
};

// ---- s20: arkadan baş, kulaklık; sağ el kabı kulağa bastırır, sol el açık ve boş
const headsetDef = (): PlateDef => ({
  light: [-.35, -.5, .4], rays: { cx: 480, cy: 240, a0: 3.25, a1: 6.17, n: 36 }, zoom: .06, focus: [480, 300], seed: 6,
  pose: (t, c) => [steps(t, c("press", 1.0), .35, 2), steps(t, c("palmOpen", 4.2), .5, 2)],
  sculpt: (S, [press, palm]) => {
    S.capsule([250, 580], [710, 580], 120, 120, { mat: 3, zs: .5, z0: 6, smooth: 14 });                   // omuzlar (tulum)
    S.capsule([480, 410], [480, 470], 56, 62, { mat: 1, zs: .6, z0: 14 });                                 // boyun
    S.blob(480, 305, 112, 138, 0, { mat: 1, zs: .6, z0: 18, smooth: 14 });                                 // baş
    S.blob(480, 262, 118, 104, 0, { mat: 3, zs: .6, z0: 26, smooth: 12 });                                 // kumaş başlık (üst)
    S.creases(480, 250, 1.57, 110, 3, 2.5, 30);
    for (const sx of [-1, 1]) S.blob(480 + sx * 112, 318, 30, 42, 0, { mat: 2, zs: .8, z0: 30, smooth: 6 }); // kulak kapları
    const cab: P2[] = [[598, 356], [640, 420 + 3 * press], [700, 452 + 5 * press], [772, 462 + 8 * press]];
    for (let i = 0; i < 3; i++) S.capsule(cab[i], cab[i + 1], 5, 5, { mat: 2, zs: .8, z0: 20, smooth: 3 });
    hand(S, { ang: -1.27, sc: .7, zoff: 44, ox: 174 + 5 * press, oy: 464 - 3 * press, mirror: true, curl: .25 });   // sağ el kapta
    hand(S, { ang: -1.0, sc: .75, zoff: 40, ox: 60, oy: 528 - 9 * palm });                                           // sol el, avuç açık
  },
});

// ---- s27: kol cetvel. Bant rulosu yumruktan omuza yürür, makas keser, şerit serbest kalır; ikincisi +900 ms
const armDef = (): PlateDef => {
  const A: P2 = [760, 238], B: P2 = [112, 264], at = (u: number): P2 => [A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u];
  return {
    light: [.1, -.75, .4], rays: { cx: 900, cy: -30, a0: 1.7, a1: 3.0, n: 22 }, zoom: .06, focus: [480, 290], seed: 7,
    // [uzunluk 0..6, makas 0 yok/1 açık/2 kapalı, serbest 0..3, ikinci şerit 0/1]
    pose: (t, c) => { const p0 = c("pull", 1.0), sn = c("snip", 3.6), s2 = c("second", sn + .9);
      return [steps(t, p0, Math.max(.6, sn - .45 - p0), 6), t < sn - .35 ? 0 : t < sn ? 1 : t < sn + .5 ? 2 : 0, steps(t, sn + .05, .6, 3), t >= s2 ? 1 : 0]; },
    sculpt: (S, [len, sc, free, second]) => {
      S.capsule([40, 345], [400, 312], 74, 60, { mat: 3, zs: .6, z0: 10, smooth: 12 });                     // üst kol (kol yeni)
      for (let i = 0; i < 4; i++) S.creases(120 + i * 70, 330 - i * 5, 1.45, 70, 2, 4, 16);
      S.capsule([400, 312], [700, 296], 56, 40, { mat: 1, zs: .7, z0: 14, smooth: 10 });                     // ön kol
      S.blob(760, 290, 54, 46, .1, { mat: 0, zs: .6, z0: 20, smooth: 12 });                                  // yumruk
      for (let i = 0; i < 4; i++) S.blob(790 + i * 4, 258 + i * 21, 15, 13, 0, { mat: 0, zs: .8, z0: 26, smooth: 5 });
      const u = len / 6, e = at(u), dy = -12 * free, dr = 4 * free;
      if (len > 0) S.plank(strip(A[0] + (free ? 6 : 0), A[1] + dy, e[0], e[1] + dy - dr, 20), 72, 4, 5);    // bant şeridi (kolun üstünde)
      if (second) S.plank(strip(A[0] - 10, A[1] + 30, B[0] + 30, B[1] + 34, 18), 66, 4, 5);
      if (!free) ring(S, e[0] - 4, e[1] - 4, 26, 9, { z0: 74, n: 28, mat: 7 });                              // rulo (kesilince düşer)
      if (sc) { const a = (sc === 1 ? 20 : 3) * D, p: P2 = [e[0] + 40, e[1] - 6];                            // makas: omuz ucunda, yukarıdan
        for (const sg of [-1, 1]) { const th = -100 * D + sg * a, bk = th + Math.PI;
          S.capsule(p, [p[0] + Math.cos(th) * -70, p[1] + Math.sin(th) * -70], 6, 2.5, { mat: 7, zs: .8, z0: 80, smooth: 3 });
          S.capsule(p, [p[0] + Math.cos(bk) * -46, p[1] + Math.sin(bk) * -46], 5, 5, { mat: 7, zs: .8, z0: 80, smooth: 3 });
          ring(S, p[0] + Math.cos(bk) * -66, p[1] + Math.sin(bk) * -66, 20, 5, { z0: 80, n: 20 }); } }
    },
  };
};

// ---- s46: bekleyiş. Sol kenarda hortumuna asılı kutu; ortada iki el kavuşur ve durur. Işık soldan (pencere).
const waitDef = (): PlateDef => ({
  light: [-.7, -.2, .45], rays: { cx: -20, cy: 200, a0: -.55, a1: .6, n: 24 }, reveal: { t0: 1.2, t1: 4.6 }, zoom: .05, focus: [470, 300], seed: 8,
  pose: (t, c) => [steps(t, c("handsFold", 6.0), .9, 3)],
  sculpt: (S, [fold]) => {
    const hs: P2[] = [[150, -10], [156, 60], [172, 110], [176, 150]];
    for (let i = 0; i < 3; i++) S.capsule(hs[i], hs[i + 1], 13, 13, { mat: 3, zs: .7, z0: 14, smooth: 4 });
    for (let i = 0; i < 9; i++) S.creases(152 + i * 2.6, 6 + i * 15, 1.5, 16, 1, 2.5, 8);                   // körüklü hortum
    canister(S, [[100, 150], [250, 140], [262, 270], [110, 282]], 38, 26);
    S.plank(strip(96, 196, 266, 184, 16), 44, 3, 5);                                                       // kutudaki bant kemeri
    hand(S, { ang: -1.0, sc: .8, zoff: 30, ox: 150 + 40 * fold, oy: 430, curl: .12 * fold });
    hand(S, { ang: -1.0, sc: .8, zoff: 36, ox: 150 + 40 * fold, oy: 444, mirror: true, curl: .12 * fold });
  },
});

// ---- s48: ikinci kutu. İki el ikinci kare kutuya bant sarar; arkada ilk kutu asılı. Işık arkadan/üstten.
const secondBoxDef = (): PlateDef => ({
  light: [0, -.6, .4], rays: TOP_FAN, zoom: .05, focus: [490, 300], seed: 9,
  pose: (t, c) => { const w = c("wrap", .8), st = c("stop", 3.2); return [steps(t, w, Math.max(.6, st - w - .2), 4)]; },
  sculpt: (S, [wrap]) => {
    for (let i = 0; i < 2; i++) S.capsule([150 + i * 6, -10 + i * 40], [156 + i * 6, 30 + i * 30], 10, 10, { mat: 3, zs: .7, z0: 8, smooth: 4 });
    canister(S, [[92, 62], [212, 54], [222, 162], [100, 172]], 30, 20);                                     // ilk kutu (arkada, küçük)
    canister(S, [[338, 188], [628, 170], [648, 424], [352, 444]]);
    S.plank([[296, 282], [664, 264], [666, 308], [298, 328]], 53, 5, 5);                                    // ilk kemer (hazır)
    if (wrap) S.plank(strip(666, 372, 666 - 92 * wrap, 372 + 4.6 * wrap, 40), 53, 5, 5);                    // ikinci kemer sarılıyor
    hand(S, { ang: -1.0, sc: .9, zoff: 46, ox: 80, oy: 412, curl: .2 });                                    // sol el kutuyu tutar
    hand(S, { ang: -1.0, sc: .9, zoff: 46, ox: 86 + 23 * wrap, oy: 470, mirror: true, curl: .15 });         // sağ el bandı çeker
  },
});

// ---- s61: natürmort. Makas, bant rulosu, karton kırpıntısı asılı; el makası kapatır ve bırakır, makas süzülür.
const stillDef = (): PlateDef => ({
  light: [-.4, -.5, .55], rays: { cx: -10, cy: -10, a0: .12, a1: 1.3, n: 26 }, zoom: .05, focus: [480, 280], seed: 10,
  // [makas açısı 0 açık..2 kapalı, bırakma 0..4, süzülme 0..8]
  pose: (t, c) => { const cl = c("closeScissors", 2.4), lg = c("letGo", 3.8); return [steps(t, cl, .14, 2), steps(t, lg, .6, 4), steps(t, lg + .2, 4, 8)]; },
  sculpt: (S, [cl, lg, dr]) => {
    S.plank([[566, 132], [706, 152], [686, 214], [590, 198]], 12, 4, 3);                                    // karton kırpıntısı
    ring(S, 664, 338, 62, 20, { mat: 5, z0: 22, n: 44, sy: .82 });                                          // bant rulosu
    S.plank(strip(718, 372, 800, 420, 34), 20, 4, 5);                                                      // rulonun serbest ucu
    const p: P2 = [400 + 3 * dr, 270 - 4 * dr], th0 = (-20 + 2 * dr) * D, al = (34 - 15 * cl) * D / 2;
    for (const sg of [-1, 1]) { const th = th0 + sg * al, bk = th0 - sg * al + Math.PI;
      S.capsule(p, [p[0] + Math.cos(th) * 172, p[1] + Math.sin(th) * 172], 9, 3, { mat: 7, zs: .8, z0: 34, smooth: 3 });
      S.capsule(p, [p[0] + Math.cos(bk) * 62, p[1] + Math.sin(bk) * 62], 7, 7, { mat: 7, zs: .8, z0: 34, smooth: 3 });
      ring(S, p[0] + Math.cos(bk) * 92, p[1] + Math.sin(bk) * 92, 30, 7, { z0: 34, n: 26 }); }
    S.blob(p[0], p[1], 9, 9, 0, { mat: 7, zs: .8, z0: 38 });
    if (lg < 4) hand(S, { ang: -1.1, sc: .75, zoff: 40, ox: 118 - 24 * lg, oy: 424 + 18 * lg, curl: .5 - .1 * lg });
  },
});

const mk = (factory: (p: PlateProps) => PlateDef): React.FC<PlateProps> => (props) => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const def = useMemo(() => factory(props), [props.variant, props.value]);
  return <LemoPlate def={def} props={props} />;
};
export const WoodcutLemoHands = mk(handsDef);
export const WoodcutLMGauge = mk(gaugeDef);
export const WoodcutLMHeadset = mk(headsetDef);
export const WoodcutArmRuler = mk(armDef);
export const WoodcutLMWait = mk(waitDef);
export const WoodcutSecondBox = mk(secondBoxDef);
export const WoodcutStillLife = mk(stillDef);
export const A13_WOODCUTS = { WoodcutLemoHands, WoodcutLMGauge, WoodcutLMHeadset, WoodcutArmRuler, WoodcutLMWait, WoodcutSecondBox, WoodcutStillLife };
