import React, { useEffect, useState } from "react";
import {
  AbsoluteFill, Easing, Img, OffthreadVideo, Sequence, continueRender, delayRender, interpolate, spring, staticFile,
  useCurrentFrame, useVideoConfig,
} from "remotion";
import { z } from "zod";

// MANA001 reklam klibi v3 (anlatımlı; v3 tarifleri docs/styles/ads/transitions.md kodlarıyla, storyboard.md "v3"). v2: clips/v2/ManaPromo.v2.tsx.txt.
// v2 notu: reklam klibi v2 (anlatımlı; ses ayrı ffmpeg ile bağlanır: promo_mix.py). Seslendirmeye bağlı ShortsVideo'dan bağımsız.
// Props: content/episodes/MANA001-*/clips/promo.json (kesme saniyeleri `cuts`, kelime/olay zamanları `cues`, yazılar).
// Varlıklar promo_prep.py ile clips/promo/ altında. v1: clips/v1/ManaPromo.v1.tsx.txt.
// Render: cd studio && node render_promo.mjs ../content/episodes/MANA001-gokceada-kuzu-tandir --out=...
// Geçiş dili (Lemo dark-keynote / glass-product / printed-long-take): erime/kararma yok; kamera hareketi, öğe büyüyüp kadrajı doldurur,
// ışık noktası eşleşmesi, duman içinden geçiş. Kamera hiç tamamen durmaz.

export const manaPromoSchema = z.object({ config: z.string() });

type Scene = { id: string; text?: string; lines?: string[]; brand?: string; event?: string[]; badge?: string; cta?: string | string[] };
export type PromoData = { dir: string; font: string; fps: number; cuts: number[]; cues: Record<string, number>; scenes: Scene[] };

export async function loadPromo(path: string): Promise<PromoData> {
  const res = await fetch(staticFile(path));
  if (!res.ok) throw new Error(`promo.json okunamadı: ${path}`);
  return (await res.json()) as PromoData;
}

const W = 1080, H = 1920;
const NAVY = "#0F2747", NAVY2 = "#14325C", CREAM = "#F6E9C9", ORANGE = "#F07A1A";
const FAM = "ManaFredoka";
const C = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const OUT = Easing.bezier(0.16, 1, 0.3, 1);
const HO = Easing.bezier(0.2, 0.9, 0.1, 1);       // kamera v2 heavyOut
const IO = Easing.bezier(0.65, 0, 0.35, 1);
const WHIP = Easing.bezier(0.7, 0, 0.3, 1);
const INC = Easing.in(Easing.cubic);
const SIN = Easing.inOut(Easing.sin);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpS = (a: number, b: number, k: number) => Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * k);   // log zoom
const prog = (f: number, a: number, b: number, e: (t: number) => number = (t) => t) => e(Math.max(0, Math.min(1, (f - a) / (b - a))));
const PLATE_AR = 1288 / 2275;                     // onarılmış tabak h/w (plate_fix.py)
// T05 whip pan: tek sürekli hız eğrisi (2.5 kare sin² yükselme, sonra üstel fren τ=2.0; tepe ≈ 307 px/kare), konum = hızın integrali (normalize)
const WP_N = 21;
const WP_CUM = (() => {
  const v: number[] = []; for (let t = 0; t <= WP_N * 4; t++) { const x = t / 4; v.push(x < 2.5 ? Math.sin((Math.PI / 2) * (x / 2.5)) ** 2 : Math.exp(-(x - 2.5) / 2.0)); }
  const c = [0]; for (let k = 1; k < v.length; k++) c.push(c[k - 1] + (v[k] + v[k - 1]) / 2); return c.map((x) => x / c[c.length - 1]);
})();
const wpP = (t: number) => { if (t <= 0) return 0; if (t >= WP_N) return 1; const i = t * 4, a = Math.floor(i); return lerp(WP_CUM[a], WP_CUM[a + 1], i - a); };
const rnd = (i: number, k: number) => { const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return s - Math.floor(s); };

// ekran = t + z * p (px). Kamera dönüşümleri bileşik kurulur, sonra kadrajı örtecek şekilde sınırlanır.
type Aff = { z: number; tx: number; ty: number };
const about = (z: number, ox: number, oy: number): Aff => ({ z, tx: ox * (1 - z), ty: oy * (1 - z) });
const scaleAt = (A: Aff, z: number, qx: number, qy: number): Aff => ({ z: A.z * z, tx: qx + z * (A.tx - qx), ty: qy + z * (A.ty - qy) });
const cover = (A: Aff): Aff => ({ z: A.z, tx: Math.min(0, Math.max(W - A.z * W, A.tx)), ty: Math.min(0, Math.max(H - A.z * H, A.ty)) });
const pt = (A: Aff, x: number, y: number): [number, number] => [A.tx + A.z * x, A.ty + A.z * y];

type Rect = { x: number; y: number; w: number };
const mix = (a: Rect, b: Rect, t: number): Rect => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), w: lerp(a.w, b.w, t) });

const useFont = (url: string) => {
  const [h] = useState(() => delayRender("font"));
  useEffect(() => {
    const f = new FontFace(FAM, `url(${url})`, { weight: "300 700", stretch: "75% 125%" });
    f.load().then((ff) => { (document.fonts as unknown as { add: (x: FontFace) => void }).add(ff); continueRender(h); }).catch((e) => { console.error(e); continueRender(h); });
  }, [url, h]);
};

const font = (size: number, wght = 700, wdth = 100): React.CSSProperties => ({
  fontFamily: FAM, fontSize: size, fontVariationSettings: `'wght' ${wght}, 'wdth' ${wdth}`, color: CREAM, lineHeight: 1, whiteSpace: "nowrap",
});

const TopText: React.FC<{ text: string; inAt: number; outAt: number }> = ({ text, inAt, outAt }) => {
  const f = useCurrentFrame();
  const op = interpolate(f, [inAt, inAt + 12], [0, 1], C) * interpolate(f, [outAt - 8, outAt], [1, 0], C);
  const y = interpolate(f, [inAt, inAt + 15], [12, 0], { ...C, easing: OUT }) - interpolate(f, [outAt - 8, outAt], [0, 18], C);
  if (op <= 0) return null;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 520, transform: `translateY(calc(-50% + ${y}px))`, textAlign: "center", opacity: op,
      ...font(124), textShadow: "0 4px 22px rgba(0,0,0,0.45), 0 2px 4px rgba(0,0,0,0.35)" }}>{text}</div>
  );
};

const Vid: React.FC<{ src: string; from: number; len: number; A: Aff; dy?: number; filter?: string; opacity?: number; startFrom?: number }> =
  ({ src, from, len, A, dy = 0, filter, opacity = 1, startFrom }) => (
    <Sequence from={from} durationInFrames={len} layout="none">
      <AbsoluteFill style={{ overflow: "hidden", opacity }}>
        <OffthreadVideo src={staticFile(src)} muted startFrom={startFrom} style={{ position: "absolute", left: 0, top: 0, width: W, height: H,
          transformOrigin: "0 0", transform: `translate(${A.tx}px, ${A.ty + dy}px) scale(${A.z})`, filter }} />
      </AbsoluteFill>
    </Sequence>
  );

// buhar videosu (6.1 sn) sahne boyunca: üst üste binen kopyalar (kesik görünmesin)
const SteamLoop: React.FC<{ src: string; from: number; to: number; style: React.CSSProperties; seed: number; mirror?: boolean }> =
  ({ src, from, to, style, seed, mirror }) => {
    const f = useCurrentFrame();
    const seg = 160, fade = 24, out: React.ReactNode[] = [];
    for (let k = 0, s = from - (seed % 40); s < to; k++, s += seg - fade) {
      const op = interpolate(f, [s, s + fade, s + seg - fade, s + seg], [k === 0 ? 1 : 0, 1, 1, 0], C);
      out.push(
        <Sequence key={k} from={s} durationInFrames={seg} layout="none">
          <AbsoluteFill style={{ opacity: op }}>
            <OffthreadVideo src={staticFile(src)} startFrom={(seed * 7 + k * 13) % 20} muted
              style={{ width: "100%", height: "100%", objectFit: "cover", transform: mirror ? "scaleX(-1)" : undefined, ...style }} />
          </AbsoluteFill>
        </Sequence>,
      );
    }
    return <>{out}</>;
  };

export const ManaPromo: React.FC<{ config: string; data?: PromoData }> = ({ data }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  useFont(staticFile(data!.font));
  const d = data!;
  const D = d.dir;
  const sc = d.scenes;
  const fr = (sec: number) => Math.round(sec * fps);
  const [, c1, c2, c3, c4, c5, END] = d.cuts.map(fr);
  const q = (k: string) => fr(d.cues[k]);
  const WH = q("whip"), LAND = q("land"), PARLAR = q("parlar"), BUHAR = q("buhar");
  const T_G = q("t_gokceada"), T_K = q("t_kuzu"), T_T = q("t_tandir"), KASIM = q("kasim"), MANA = q("mana"), CTA = q("cta");

  // ---------------- s01 → s02: dalış (log zoom hızlanır) + ön plan otu kadrajı süpürür
  const z1 = f < c1 - 26 ? lerpS(1.04, 1.09, prog(f, 0, c1 - 26, SIN)) : lerpS(1.09, 2.8, prog(f, c1 - 26, c1, INC));
  const A1 = cover(about(z1, 0.6 * W, 0.46 * H));
  const grassTop = f < c1 ? interpolate(f, [c1 - 13, c1], [1950, -740], { ...C, easing: Easing.in(Easing.quad) })
    : interpolate(f, [c1, c1 + 10], [-740, -2780], { ...C, easing: Easing.out(Easing.quad) });
  const grassVb = interpolate(f, [c1 - 13, c1 - 4, c1 + 4, c1 + 10], [10, 34, 34, 10], C);

  // ---------------- s02: iniş (heavyOut), süzülme, sonra ışık noktasına itme
  const zl = lerpS(1.7, 1.08, prog(f, c1, c1 + 22, HO)) * lerpS(1, 1.04, prog(f, c1 + 22, c2 - 20, SIN));
  // s02 → s03 T05 whip pan sağa (kuzu sağa yürüyor): kamera kayması x = wp·W; kesme tepe hızın ortasında (c2-1 son kuzu, c2 ilk kor).
  // Her plan kaydırma payını kendi zoom'uyla örter (kadraj dışı boşluk yok): kuzu sol-orta çapada, kor alev çapasında.
  const WP0 = c2 - 3;
  const wp = wpP(f - WP0);
  const s2 = f < c2 ? wp * W : 0, r3 = f >= c2 ? (1 - wp) * W : 0;
  const A2 = cover(scaleAt(about(zl, 0.5 * W, 0.6 * H), 1 + s2 / (0.7 * W) + (s2 > 0 ? 0.01 : 0), 0.3 * W, 0.6 * H));
  const wpSpeed = W * (wpP(f - WP0 + 0.5) - wpP(f - WP0 - 0.5));     // px/kare
  const wpVb = Math.min(60, 0.16 * wpSpeed);

  // ---------------- s03a kor: ışık noktası alevin üstüne oturur ve geri çekilir; netlik kayması; whip-tilt aşağı (tandır)
  const P3: [number, number] = [0.80 * W, 0.60 * H];                // alev
  const z3 = Math.max(lerpS(1.17, 1.12, prog(f, c2, WP0 + WP_N, HO)) * lerpS(1, 1.04, prog(f, WP0 + WP_N, WH, SIN)), 1 + r3 / P3[0] + (r3 > 0 ? 0.02 : 0));
  const A3 = cover(about(z3, P3[0], P3[1]));
  const pw = prog(f, WH - 7, WH + 7, WHIP);
  const whipVb = 46 * Math.sin(Math.PI * pw);
  const rack = prog(f, c2 + 12, c2 + 30, HO);                        // odak: öndeki kıvılcımlar → kor
  // s03b tandır: iner, yavaş itme, sonra ağzına hızlanan itme (duman)
  const z3b = lerpS(1.12, 1.3, prog(f, WH + 7, c3 - 16, SIN)) * lerpS(1, 1.3, prog(f, c3 - 16, c3 - 5, INC));
  const A3b = cover(about(z3b, 0.47 * W, 0.52 * H));

  // ---------------- s03 → s04 T03 duman: tam örtü c3-7..c3-3 (krem çekirdek alt %0-%100), değişim c3-5; tabak bölgesi (alt %20-46) c3+1'de açık
  const u = prog(f, c3 - 14, c3 + 5, (t) => t);
  const Te = lerp(-10, 290, u), Be = Te - 160;
  const SWAP = c3 - 5;
  const smokeOp = interpolate(f, [c3 - 20, c3 - 10, c3 - 3, c3 + 5], [0, 1, 1, 0], C);
  // video kendi üst/alt kenarında söner (kaydırılırken kenar çizgisi görünmesin); maske videoyla birlikte hareket eder
  const SMOKE_M = "linear-gradient(180deg, rgba(0,0,0,0) 0%, #000 22%, #000 80%, rgba(0,0,0,0) 100%)";

  // ---------------- s04 tabak (hero)
  const x45 = [c4 - 15, c4 + 15];
  const camZ = f < x45[0] ? lerpS(1.0, 1.045, prog(f, LAND, x45[0], SIN)) : lerpS(1.045, 0.97, prog(f, x45[0], x45[1], IO));
  const FX = 0.48 * W, FY = 0.66 * H;
  const cam = (r: Rect, k = 1): Rect => { const zz = 1 + (camZ - 1) * k; return { x: FX + (r.x - FX) * zz, y: FY + (r.y - FY) * zz, w: r.w * zz }; };
  // tabak sağ alttan masaya sürülür (P03 düşüş v3'te yok): 22 kare bezier(0.3,0.75,0.25,1), %96 = LAND ("tak"), gölgeler tabakla
  const SL0 = LAND - 14, SL1 = SL0 + 22;
  const SLE = Easing.bezier(0.3, 0.75, 0.25, 1);
  const sl = prog(f, SL0, SL1, SLE);
  const slSpeed = 1000 * (prog(f + 0.5, SL0, SL1, SLE) - prog(f - 0.5, SL0, SL1, SLE));
  const slVb = Math.min(14, 0.09 * slSpeed);
  const slRot = 2.2 * (1 - sl);
  const r4base: Rect = { x: 100, y: 1030, w: 900 };
  const r4drop: Rect = { x: r4base.x + 1000 * (1 - sl), y: r4base.y + 70 * (1 - sl), w: r4base.w };
  const r5: Rect = { x: 40, y: 1150, w: 1000 };
  const r6: Rect = { x: 170, y: 800, w: 720 };                       // v3: güvenli alan (CTA ≤ 1460)
  const breathe5 = interpolate(f, [c4, c5], [1, 1.02], C);
  const r5b: Rect = { x: r5.x - (r5.w * (breathe5 - 1)) / 2, y: r5.y - (r5.w * PLATE_AR * (breathe5 - 1)) / 2, w: r5.w * breathe5 };
  const p45 = prog(f, x45[0], x45[1], IO);
  const p56 = prog(f, c5 - 1, c5 + 20, IO);
  const breathe6 = lerpS(1, 1.02, prog(f, c5 + 20, END, SIN));
  const r6b: Rect = { x: r6.x - (r6.w * (breathe6 - 1)) / 2, y: r6.y - (r6.w * PLATE_AR * (breathe6 - 1)) / 2, w: r6.w * breathe6 };
  let plate: Rect;
  if (f < x45[0]) plate = cam(r4drop);
  else if (f < x45[1]) plate = mix(cam(r4drop), r5b, p45);
  else if (f < c5 + 20) plate = mix(r5b, r6, p56);
  else plate = r6b;
  const plateOp = f < SWAP ? 0 : 1;
  const ph = plate.w * PLATE_AR;
  const pcx = plate.x + plate.w / 2, pcy = plate.y + ph / 2;

  const shadowBase = f < x45[0] ? cam(r4base) : plate;
  const land = 1;
  const shOp = lerp(lerp(0.3, 0.86, land), 0.66, p45) * plateOp;
  const shBlur = lerp(lerp(60, 30, land), 26, p45) * (shadowBase.w / 900);
  const sw = shadowBase.w, sh = sw * PLATE_AR;
  const shadowRect = { left: shadowBase.x + 0.04 * sw, top: shadowBase.y + sh - 0.17 * sw, width: sw * 0.93, height: 0.215 * sw };
  const contact = { left: shadowBase.x + 0.10 * sw, top: shadowBase.y + sh - 0.085 * sw, width: sw * 0.80, height: 0.09 * sw };

  // buhar: inişle belirir, "Buharıyla" ile kabarır, kartlarda incelir
  const steamOp = interpolate(f, [c3, LAND, LAND + 20, BUHAR, BUHAR + 15, x45[0] - 10, x45[0] + 4, x45[1]], [0.1, 0.5, 0.62, 0.62, 0.9, 0.75, 0.38, 0.34], C);
  const steamFront = 1 - prog(f, x45[0] - 12, x45[0] + 2, SIN);       // ön iri buhar irisin başında söner (v2: 15.6-16.0 büyük sis)
  const steamBoxW = W * 1.3 * (plate.w / 900), steamBoxH = H * 0.9 * (plate.w / 900);
  // buhar katmanı kenar maskesi: her yöne yumuşak sönme (v2: kutu kenarı solda dikdörtgen kesik olarak görünüyordu)
  const EDGE = "radial-gradient(ellipse 50% 60% at 50% 60%, #000 0%, #000 55%, rgba(0,0,0,0.5) 78%, rgba(0,0,0,0) 100%)";   // yan ve üst kenarda 0, alt (tabak) dikey maskeyle
  const steamTop = plate.y + ph * 0.55 - steamBoxH;

  // ışık bantları (yalnız yemek maskesi), tepe opaklık ≤ 0.2
  const band = (a: number, b: number) => ({ pos: interpolate(f, [a, b], [-30, 130], C), op: interpolate(f, [a, a + 8, b - 8, b], [0, 0.2, 0.2, 0], C) });
  const heroBand = band(PARLAR - 6, PARLAR + 33);
  const G0 = T_T + 2, G1 = T_T + 19;                                  // başlık parıltısı + tabak bandı eş zamanlı
  const cardBand = band(G0, G1);
  const sweep = f < x45[0] + 5 ? heroBand : cardBand;

  // s04 → s05 lacivert iris (tabağın arkasından büyür)
  const irisR = lerpS(30, 2600, prog(f, x45[0] - 2, x45[1] + 6, Easing.bezier(0.45, 0, 0.2, 1)));
  const tableDim = interpolate(f, [x45[0], x45[1]], [1, 0.55], C);
  const cardP = prog(f, c4, END, (t) => t);

  // s05 satırları (kelimeyle aynı kare)
  const lines = sc[4].lines ?? [];
  const lineY = [420, 640, 900];
  const lineIn = [T_G - 1, T_K - 1, T_T - 1];
  const lineFont = [font(118, 700, 100), font(250, 700, 75), font(250, 700, 75)];
  const exitAt = c5 - 6;

  // s06
  const s6d = sc[5];
  const headP = prog(f, MANA - 2, MANA + 12, OUT);
  const badgeSp = spring({ frame: f - KASIM, fps, config: { damping: 8, stiffness: 210, mass: 0.6 } });
  const ring = prog(f, KASIM, KASIM + 14, Easing.out(Easing.quad));
  const ctaP = prog(f, CTA - 2, CTA + 14, OUT);

  const grainOp = f < c4 ? 0.09 : 0.06;
  const vig = (f < x45[1] ? 0.5 : 0.28) * (1 - 0.8 * smokeOp);     // dumanda vinyet çekilir (perde oval görünmesin)

  // T06 netlik kayması: öndeki kor bokehleri (kıvılcım patlaması ve ışık diski v3'te kaldırıldı: yapay ışık yok)
  const sparks: React.ReactNode[] = [];
  if (f >= c2 && f < WH + 10) {
    const vy = -pw * H * 1.35, vx = r3;
    for (let i = 0; i < 14; i++) {
      const r = 8 + rnd(i, 8) * 22, x = rnd(i, 9) * W + vx, y0 = H * (0.35 + rnd(i, 10) * 0.75);
      const y = y0 - (f - c2) * (2 + rnd(i, 11) * 4) + vy;
      const op = interpolate(f, [c2, c2 + 8], [0, 0.55 + rnd(i, 12) * 0.35], C);
      sparks.push(<div key={`k${i}`} style={{ position: "absolute", left: x, top: y, width: r * lerp(0.5, 2.2, rack), height: r * lerp(0.5, 2.2, rack),
        borderRadius: "50%", transform: "translate(-50%, -50%)", opacity: op * lerp(1, 0.55, rack),
        background: "radial-gradient(circle, rgba(255,200,120,1) 0%, rgba(255,140,50,0.8) 45%, rgba(255,120,40,0) 70%)",
        filter: `blur(${lerp(0.5, 9, rack)}px)`, mixBlendMode: "screen" }} />);
    }
  }

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <svg width={0} height={0} style={{ position: "absolute" }}>
        <defs>
          <filter id="vbG" x="-5%" y="-30%" width="110%" height="160%"><feGaussianBlur stdDeviation={`0 ${grassVb}`} /></filter>
          <filter id="vbP" x="-30%" y="-5%" width="160%" height="110%"><feGaussianBlur stdDeviation={`${Math.max(0.01, wpVb)} 0`} /></filter>
          <filter id="vbS" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation={`${Math.max(0.01, slVb)} 0`} /></filter>
          <filter id="vbW" x="-5%" y="-30%" width="110%" height="160%"><feGaussianBlur stdDeviation={`0 ${Math.max(0.01, whipVb)}`} /></filter>
        </defs>
      </svg>

      {/* s01 kıyı (dalış) */}
      <Vid src={`${D}/s01.mp4`} from={0} len={c1 + 1} A={A1} filter={`blur(${interpolate(f, [c1 - 9, c1], [0, 5], C)}px)`} />
      {f < c1 && (
        <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "screen", opacity: 0.8 }}>
          <AbsoluteFill style={{ background: "radial-gradient(ellipse 80% 50% at 0% 0%, rgba(255,170,80,0.30), rgba(255,170,80,0) 70%)" }} />
        </AbsoluteFill>
      )}
      {/* s02 kuzu → T05 whip pan sağa → s03a kor (yatay yönlü bulanıklık, tepe hızda) */}
      <AbsoluteFill style={{ filter: wpVb > 0.5 ? "url(#vbP)" : undefined }}>
      <Vid src={`${D}/s02.mp4`} from={c1} len={c2 - c1} A={{ ...A2, tx: A2.tx - s2 }} filter={`blur(${interpolate(f, [c1, c1 + 8], [5, 0], C)}px)`} />
      {/* s03a kor */}
      <AbsoluteFill style={{ filter: whipVb > 0.5 ? "url(#vbW)" : undefined }}>
      <Vid src={`${D}/s03a.mp4`} from={c2} len={WH + 8 - c2} A={{ ...A3, tx: A3.tx + r3 }} dy={-pw * H}
        filter={`blur(${lerp(4, 0, rack)}px)`} />
      {/* s03b tandır */}
      <Vid src={`${D}/s03b.mp4`} from={WH - 8} len={SWAP - (WH - 8)} A={A3b} dy={(1 - pw) * H}
        filter={`brightness(${interpolate(f, [c3 - 12, SWAP], [1, 1.25], C)})`} />
      </AbsoluteFill>
      </AbsoluteFill>

      {/* s04 masa */}
      {f >= SWAP && (
        <AbsoluteFill style={{ overflow: "hidden", filter: `brightness(${tableDim})` }}>
          {(() => {
            const t = cam({ x: -136, y: 0, w: 1272 }, 0.85);
            return <Img src={staticFile(`${D}/table.jpg`)} style={{ position: "absolute", left: t.x, top: t.y, width: t.w, height: t.w * (2400 / 1590), filter: "blur(2.5px)" }} />;
          })()}
        </AbsoluteFill>
      )}
      {/* s05-s06 lacivert: tabağın arkasından iris; arkada yumuşak ışık, yay (paralaks) */}
      {f >= x45[0] - 2 && (
        <AbsoluteFill style={{ WebkitMaskImage: f < x45[1] + 6 ? `radial-gradient(circle at ${pcx}px ${pcy}px, #000 ${Math.max(0, irisR - 160)}px, rgba(0,0,0,0) ${irisR}px)` : undefined,
          maskImage: f < x45[1] + 6 ? `radial-gradient(circle at ${pcx}px ${pcy}px, #000 ${Math.max(0, irisR - 160)}px, rgba(0,0,0,0) ${irisR}px)` : undefined }}>
          <AbsoluteFill style={{ backgroundColor: NAVY }} />
          <AbsoluteFill style={{ transform: `translateY(${-14 * cardP}px)`,
            background: "radial-gradient(ellipse 70% 38% at 50% 34%, rgba(84,126,196,0.30), rgba(84,126,196,0) 100%)" }} />
          <div style={{ position: "absolute", left: -260, top: 560, width: W + 520, height: 1540, borderRadius: "50%", backgroundColor: NAVY2,
            filter: "blur(4px)", transform: `translateY(${18 * cardP}px) scale(${lerpS(1, 1.035, cardP)})`, transformOrigin: "50% 100%" }} />
          <div style={{ position: "absolute", left: plate.x - 0.2 * plate.w, top: plate.y - 0.45 * ph, width: plate.w * 1.4, height: ph * 1.9,
            background: "radial-gradient(ellipse at center, rgba(240,140,60,0.18), rgba(240,140,60,0) 65%)" }} />
        </AbsoluteFill>
      )}

      {/* tabak gölgesi, tabak, ışık bandı, buhar */}
      {f >= c3 - 2 && (
        <>
          <div style={{ position: "absolute", ...shadowRect, borderRadius: "50%", backgroundColor: `rgba(8,5,2,${shOp})`, filter: `blur(${shBlur}px)` }} />
          <div style={{ position: "absolute", ...contact, borderRadius: "50%", backgroundColor: `rgba(4,2,1,${0.6 * land * plateOp * (1 - 0.3 * p45)})`,
            filter: `blur(${10 * (sw / 900)}px)` }} />
          <div style={{ position: "absolute", left: plate.x, top: plate.y, width: plate.w, height: ph, opacity: plateOp,
            transform: slRot > 0.01 ? `rotate(${slRot}deg)` : undefined, filter: slVb > 0.3 ? "url(#vbS)" : undefined }}>
            <Img src={staticFile(`${D}/plate_table.png`)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%",
              filter: "drop-shadow(0 0 10px rgba(255,176,96,0.30))" }} />
            {p45 > 0 && <Img src={staticFile(`${D}/plate_card.png`)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: p45 }} />}
            {sweep.op > 0 && (
              <div style={{ position: "absolute", inset: 0, opacity: sweep.op, mixBlendMode: "screen",
                background: `linear-gradient(105deg, rgba(255,222,176,0) ${sweep.pos - 24}%, rgba(255,230,192,0.5) ${sweep.pos - 11}%, rgba(255,242,220,1) ${sweep.pos}%, rgba(255,230,192,0.5) ${sweep.pos + 11}%, rgba(255,222,176,0) ${sweep.pos + 24}%)`,
                WebkitMaskImage: `url(${staticFile(`${D}/plate_food_mask.png`)})`, WebkitMaskSize: "100% 100%",
                maskImage: `url(${staticFile(`${D}/plate_food_mask.png`)})`, maskSize: "100% 100%" }} />
            )}
          </div>
          {/* buhar: iki katman (arka net, ön iri ve hafif bulanık) */}
          <div style={{ position: "absolute", left: pcx - steamBoxW / 2, top: steamTop, width: steamBoxW, height: steamBoxH, opacity: steamOp, mixBlendMode: "screen",
            WebkitMaskImage: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.7) 22%, #000 50%, #000 80%, rgba(0,0,0,0) 100%)",
            maskImage: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.7) 22%, #000 50%, #000 80%, rgba(0,0,0,0) 100%)" }}>
            <AbsoluteFill style={{ WebkitMaskImage: EDGE, maskImage: EDGE }}>
              <SteamLoop src={`${D}/steam.mp4`} from={c3} to={END} seed={1} style={{ filter: "brightness(2.0) sepia(0.25)" }} />
            </AbsoluteFill>
          </div>
          <div style={{ position: "absolute", left: pcx - steamBoxW * 0.7, top: steamTop - steamBoxH * 0.15, width: steamBoxW * 1.4, height: steamBoxH * 1.15,
            opacity: steamOp * 0.45 * steamFront, mixBlendMode: "screen",
            WebkitMaskImage: "linear-gradient(180deg, rgba(0,0,0,0) 0%, #000 45%, #000 75%, rgba(0,0,0,0) 100%)",
            maskImage: "linear-gradient(180deg, rgba(0,0,0,0) 0%, #000 45%, #000 75%, rgba(0,0,0,0) 100%)" }}>
            <AbsoluteFill style={{ WebkitMaskImage: EDGE, maskImage: EDGE }}>
              <SteamLoop src={`${D}/steam.mp4`} from={c3} to={END} seed={23} mirror style={{ filter: "brightness(1.7) sepia(0.3) blur(4px)" }} />
            </AbsoluteFill>
          </div>
        </>
      )}

      {/* s03 → s04 duman: tandırdan yükselir, kadrajı ~0.5 sn kaplar, yukarı açılır */}
      {f >= c3 - 20 && f < c3 + 6 && (
        <>
          <AbsoluteFill style={{ background: `linear-gradient(0deg, rgba(240,222,198,0) ${Be - 18}%, rgba(240,222,198,0.98) ${Be}%, rgba(240,222,198,0.98) ${Te}%, rgba(240,222,198,0) ${Te + 18}%)` }} />
          <Sequence from={c3 - 20} durationInFrames={26} layout="none">
            <AbsoluteFill style={{ mixBlendMode: "screen", opacity: smokeOp }}>
              <OffthreadVideo src={staticFile(`${D}/steam.mp4`)} startFrom={100} muted style={{ width: "100%", height: "100%", objectFit: "cover",
                transform: `translateY(${interpolate(f, [c3 - 20, c3 + 6], [0.7 * H, -0.6 * H], C)}px) scale(2.2)`, filter: "brightness(2.3) contrast(1.1) sepia(0.4)",
                WebkitMaskImage: SMOKE_M, maskImage: SMOKE_M }} />
            </AbsoluteFill>
          </Sequence>
        </>
      )}

      {sparks.length > 0 && <AbsoluteFill style={{ pointerEvents: "none" }}>{sparks}</AbsoluteFill>}

      {/* ön plan otu (dalış) */}
      {f >= c1 - 14 && f <= c1 + 11 && (
        <Img src={staticFile(`${D}/grass_fg.png`)} style={{ position: "absolute", left: -135, top: grassTop, width: 1350, height: 2720, filter: "url(#vbG)" }} />
      )}

      {/* üst yazılar */}
      <TopText text={sc[0].text!} inAt={q("gokceada_word") - 4} outAt={c1 - 12} />
      <TopText text={sc[1].text!} inAt={c1 + 16} outAt={c2 - 14} />
      <TopText text={sc[2].text!} inAt={c2 + 18} outAt={c3 - 14} />

      {/* s05 başlık satırları + parıltı */}
      {f >= T_G - 2 && f < exitAt + 16 && lines.map((t, k) => {
        const sp = spring({ frame: f - lineIn[k], fps, config: { damping: 12, stiffness: 190, mass: 0.6 } });
        // v3: çıkış 5 kare, opaklık hızlı düşer + yukarı bulanıklık (v2'de 8 karelik yarı saydam gri hayalet iz kalıyordu)
        const outP = prog(f, exitAt, exitAt + 3, Easing.in(Easing.quad));   // üç satır birlikte, 2 ara kare
        const op = interpolate(f, [lineIn[k], lineIn[k] + 3], [0, 1], C) * (1 - outP) ** 2;
        if (op <= 0) return null;
        const gp = interpolate(f, [G0, G1], [-30, 130], C);
        const gop = k > 0 ? interpolate(f, [G0, G0 + 5, G1 - 5, G1], [0, 1, 1, 0], C) : 0;
        const base: React.CSSProperties = { position: "absolute", left: 0, right: 0, top: lineY[k], textAlign: "center", opacity: op,
          transform: `translateY(calc(-50% + ${18 * (1 - sp) - 200 * outP}px)) scale(${0.94 + 0.06 * sp})`, ...lineFont[k],
          filter: outP > 0 ? `blur(${14 * outP}px)` : undefined };
        return (
          <React.Fragment key={k}>
            <div style={{ ...base, textShadow: outP > 0 ? undefined : "0 6px 24px rgba(0,0,0,0.25)" }}>{t}</div>
            {gop > 0 && (
              <div style={{ ...base, opacity: op * gop, color: "transparent",
                backgroundImage: `linear-gradient(115deg, rgba(255,255,255,0) ${gp - 10}%, rgba(255,255,250,1) ${gp}%, rgba(255,255,255,0) ${gp + 10}%)`,
                WebkitBackgroundClip: "text", backgroundClip: "text", filter: "drop-shadow(0 0 10px rgba(255,236,190,0.9)) drop-shadow(0 0 26px rgba(255,214,150,0.6))" }}>{t}</div>
            )}
          </React.Fragment>
        );
      })}

      {/* s06 kilit, rozet, CTA */}
      {f >= c5 - 2 && (
        <>
          {headP > 0 && (
            <div style={{ position: "absolute", left: 0, top: 0, width: W, height: 520, opacity: headP, transform: `translateY(${-40 * (1 - headP)}px)` }}>
              {/* v3 Reels güvenli alanı: şerit y ≈ 325-440 (v2: 195-305) */}
              <div style={{ position: "absolute", right: W / 2 + 10, top: 385, transform: "translateY(-50%)", ...font(120, 700, 100) }}>{s6d.brand}</div>
              <div style={{ position: "absolute", left: W / 2 + 13, top: 330, width: 5, height: 110, backgroundColor: CREAM, borderRadius: 3 }} />
              {(s6d.event ?? []).map((t, k) => (
                <div key={k} style={{ position: "absolute", left: W / 2 + 42, top: 357 + k * 60, transform: "translateY(-50%)", ...font(46, 600, 90) }}>{t}</div>
              ))}
            </div>
          )}
          {f >= KASIM && (
            <div style={{ position: "absolute", left: 0, right: 0, top: 628, display: "flex", justifyContent: "center" }}>
              <div style={{ position: "relative", transform: `translateY(-50%) scale(${0.45 + 0.55 * badgeSp})`, opacity: interpolate(f, [KASIM, KASIM + 3], [0, 1], C) }}>
                {ring < 1 && (
                  <div style={{ position: "absolute", inset: 0, borderRadius: 105, border: `6px solid ${ORANGE}`,
                    opacity: 0.7 * (1 - ring), transform: `scale(${1 + 0.3 * ring}, ${1 + 0.6 * ring})` }} />
                )}
                <div style={{ height: 210, padding: "0 62px", borderRadius: 105, backgroundColor: ORANGE, display: "flex", alignItems: "center",
                  boxShadow: "0 14px 40px rgba(0,0,0,0.30)", ...font(130, 700, 100), paddingTop: 6 }}>{s6d.badge}</div>
              </div>
            </div>
          )}
          {ctaP > 0 && (
            <div style={{ position: "absolute", left: 80, width: 880, top: Array.isArray(s6d.cta) ? 1368 : 1400, textAlign: "center", opacity: Math.min(1, ctaP * 1.6),
              transform: `translateY(calc(-50% + ${30 * (1 - ctaP)}px))`, ...font(124, 700, 95), lineHeight: 1.06, textShadow: "0 6px 24px rgba(0,0,0,0.25)" }}>
              {/* v4: iki satır "Kuzu tandır / Mana'da yenir." (merkez 1368, ≈1236-1500; güvenli alan ≤ 1520) */}
              {Array.isArray(s6d.cta) ? s6d.cta.map((t, k) => <div key={k}>{t}</div>) : s6d.cta}
            </div>
          )}
        </>
      )}

      {/* kart ön planı: çok hafif toz/ışık zerreleri (paralaks) */}
      {f >= c4 && (
        <AbsoluteFill style={{ pointerEvents: "none", opacity: prog(f, c4, c4 + 20) }}>
          {Array.from({ length: 9 }, (_, i) => {
            const r = 18 + rnd(i, 20) * 40, x = rnd(i, 21) * W, y = H * (0.1 + rnd(i, 22) * 0.85) - (f - c4) * (0.25 + rnd(i, 23) * 0.4);
            return <div key={i} style={{ position: "absolute", left: x, top: y, width: r, height: r, borderRadius: "50%", transform: "translate(-50%,-50%)",
              background: "radial-gradient(circle, rgba(246,233,201,0.5), rgba(246,233,201,0) 70%)", opacity: 0.12 + rnd(i, 24) * 0.12, filter: "blur(6px)" }} />;
          })}
        </AbsoluteFill>
      )}

      {/* vinyet + gren */}
      <AbsoluteFill style={{ pointerEvents: "none", background: `radial-gradient(ellipse 75% 62% at 50% 48%, rgba(0,0,0,0) 55%, rgba(0,0,0,${vig}) 100%)` }} />
      <Img src={staticFile(`${D}/grain${f % 6}.png`)} style={{ position: "absolute", inset: 0, width: W, height: H, mixBlendMode: "overlay", opacity: grainOp }} />
    </AbsoluteFill>
  );
};
