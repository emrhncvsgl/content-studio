import React, { createContext, useContext, useId } from "react";
import type { Word } from "../../../schema/timeline";
import { clamp01 } from "../../../components/ease";
import { MONO } from "../../../fonts";

// Blueprint çizim takımı (a13 figürü için yazıldı, başka blueprint figürleri de kullanabilir).
// Her şey zamanın saf fonksiyonu: bileşenler ilerleme (0-1) alır, kare/saat okumaz. Rastgelelik yalnız `rng(seed)`.
// Tuval 1920×1080 "kâğıt birimi"; kamera SVG viewBox'ıyla verilir (Sheet.tsx), çizgi kalınlığı kalemle (Pen.k) ölçeklenir.

export const CW = 1920, CH = 1080;
export type Pt = [number, number];

/* ---------- kalem: çizgi ağırlığı zoom'la ölçeklenir (STYLE.md §2: ekran kalınlığı = kâğıt kalınlığı × zoom^0.65) ---------- */
export type Pen = { k: number; line: string; paper: string; accent: string };
const PenCtx = createContext<Pen>({ k: 1, line: "#EAF2FF", paper: "#1F4E8C", accent: "#F2A93B" });
export const PenProvider = PenCtx.Provider;
export const usePen = () => useContext(PenCtx);
// o: dış kontur · d: ayrıntı · t: ince (ölçü, kılavuz) · h: kıl (eksen, tarama)
export const WEIGHT = { o: 4, d: 2.6, t: 1.6, h: 1.1 } as const;
export type Weight = keyof typeof WEIGHT | number;
const sw = (w: Weight, pen: Pen) => (typeof w === "number" ? w : WEIGHT[w]) * pen.k;

/* ---------- zaman ---------- */
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
// vox kuralı: ms | "kelime" | "kelime#2" | "kelime+300" | "kelime#2-150" (vox-explainer/index.tsx atMs ile aynı; ortak dosya başka
// ajanın elinde olduğu için kopya). Kelime bulunamazsa 0.
export function atMs(at: unknown, words: Word[]): number {
  if (typeof at === "number") return at;
  if (typeof at !== "string") return 0;
  const m = at.match(/^(.*?)([+-]\d+)$/);
  const [w, n] = (m ? m[1] : at).split("#");
  const hit = words.filter((x) => norm(x.text) === norm(w))[(Number(n) || 1) - 1];
  return hit ? hit.startMs + (m ? Number(m[2]) : 0) : 0;
}

export type Step = { id: string; at: number; ms: number };
type Fb = [atMs: number, ms: number];
export type Times = {
  ms: number;
  steps: Step[];
  has: (id: string) => boolean;
  p: (id: string, nth?: number, fb?: Fb) => number;   // kimlikle (aynı kimlik yinelenirse nth); yoksa fb penceresi, o da yoksa 0
  pi: (i: number, fb?: Fb) => number;                 // sırayla
  q: (id: string, i: number, fb?: Fb) => number;      // kimlik, bulunmazsa i. adım (kimlik yeniden adlandırılırsa çizim kaybolmasın)
};
// props.steps [{id, at, ms}] → doğrusal ilerleme 0-1 (yumuşatmayı çizen taraf uygular)
export function makeTimes(raw: unknown, words: Word[], ms: number): Times {
  const steps: Step[] = (Array.isArray(raw) ? raw : []).map((s) => {
    const o = (s ?? {}) as { id?: unknown; at?: unknown; ms?: unknown };
    return { id: String(o.id ?? ""), at: atMs(o.at ?? 0, words), ms: typeof o.ms === "number" && o.ms > 0 ? o.ms : 800 };
  });
  const find = (id: string, nth = 0) => steps.filter((s) => s.id === id)[nth];
  const prog = (s: Step | undefined, fb?: Fb) => {
    const a = s ? s.at : fb?.[0], d = s ? s.ms : fb?.[1];
    return a === undefined || d === undefined ? 0 : clamp01((ms - a) / d);
  };
  return {
    ms, steps,
    has: (id) => !!find(id),
    p: (id, nth = 0, fb) => prog(find(id, nth), fb),
    pi: (i, fb) => prog(steps[i], fb),
    q: (id, i, fb) => prog(find(id) ?? steps[i], fb),
  };
}
// adım içi alt pencere: kaba kontur 0-0.5, ayrıntı 0.4-0.8, ölçü/ok 0.75-1 gibi
export const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

// tohumlu rastgele (mulberry32)
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- geometri ---------- */
const r1 = (v: number) => Math.round(v * 10) / 10;
export const rectD = (x: number, y: number, w: number, h: number, r = 0) =>
  r > 0
    ? `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`
    : `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
export const circD = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 1 ${2 * r} 0a${r} ${r} 0 1 1 ${-2 * r} 0Z`;
export const lineD = (x1: number, y1: number, x2: number, y2: number) => `M${x1} ${y1}L${x2} ${y2}`;
export const dOf = (pts: Pt[], close = false) => (pts.length ? "M" + pts.map((p) => `${r1(p[0])} ${r1(p[1])}`).join("L") + (close ? "Z" : "") : "");
export function bez(a: Pt, b: Pt, c: Pt, d: Pt, n = 24): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0], u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]]);
  }
  return out;
}
export function polyLen(pts: Pt[]) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return L;
}
// çoklu çizgi üzerinde t (0-1) noktasında konum ve yön (radyan)
export function pointAt(pts: Pt[], t: number): { x: number; y: number; ang: number } {
  if (pts.length < 2) return { x: pts[0]?.[0] ?? 0, y: pts[0]?.[1] ?? 0, ang: 0 };
  let left = polyLen(pts) * clamp01(t);
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1], d = Math.hypot(dx, dy);
    if (left <= d || i === pts.length - 1) {
      const k = d > 0 ? Math.min(1, left / d) : 0;
      return { x: pts[i - 1][0] + dx * k, y: pts[i - 1][1] + dy * k, ang: Math.atan2(dy, dx) };
    }
    left -= d;
  }
  return { x: pts[0][0], y: pts[0][1], ang: 0 };
}
// çoklu çizginin baştan t oranına kadar olan kısmı (çizilerek gelen kesik çizgiler için)
export function slice(pts: Pt[], t: number): Pt[] {
  if (t >= 1) return pts;
  if (t <= 0 || pts.length < 2) return [];
  let left = polyLen(pts) * t;
  const out: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1], d = Math.hypot(dx, dy);
    if (left <= d) { const k = d > 0 ? left / d : 0; out.push([pts[i - 1][0] + dx * k, pts[i - 1][1] + dy * k]); return out; }
    out.push(pts[i]);
    left -= d;
  }
  return out;
}
// çoklu çizgiyi normali boyunca d kadar kaydır (hortum duvarları)
export function offsetPoly(pts: Pt[], d: number): Pt[] {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    return [p[0] - (dy / L) * d, p[1] + (dx / L) * d] as Pt;
  });
}

/* ---------- çizilen yol ---------- */
// kesik desen + çizilme: desen `len` birimlik yolda p'ye kadar tekrarlanır, sonrası tek büyük boşluk
function dashArr(pattern: number[], len: number, p: number) {
  if (p >= 1) return pattern.join(" ");
  const L = len * p, out: number[] = [];
  let acc = 0, i = 0;
  while (out.length < 600) {
    const d = pattern[i % pattern.length], on = out.length % 2 === 0;
    if (acc + d >= L) { if (on) out.push(Math.max(0.01, L - acc), len * 2); else out.push(len * 2); break; }
    out.push(d); acc += d; i++;
  }
  return out.join(" ");
}
// S: çizilerek gelen yol. p 0 → 1 (stroke-dashoffset). dash verilirse desen `len` (yolun yaklaşık boyu, px) üzerinden ölçülür.
// fill "paper": kâğıt rengiyle doldur (ressam sırası: arkadaki çizgileri örter).
export const S: React.FC<{ d: string; p?: number; w?: Weight; color?: string; fill?: string; fillO?: number; dash?: number[]; len?: number; o?: number }> = ({
  d, p = 1, w = "d", color, fill = "none", fillO = 1, dash, len = 100, o = 1,
}) => {
  const pen = usePen();
  if (p <= 0 || o <= 0 || !d) return null;
  const q = Math.min(1, p);
  const extra = dash
    ? { pathLength: len, strokeDasharray: dashArr(dash, len, q) }
    : q < 1 ? { pathLength: 1, strokeDasharray: "1 1", strokeDashoffset: 1 - q } : {};
  return (
    <path d={d} fill={fill === "paper" ? pen.paper : fill} fillOpacity={fill === "none" ? undefined : fillO * Math.min(1, q * 3)} stroke={color ?? pen.line}
      strokeWidth={sw(w, pen)} strokeLinecap="round" strokeLinejoin="round" opacity={o} {...extra} />
  );
};
// PL: çoklu çizgi, baştan p oranına kadar (kesik desenle birlikte de çizilerek gelir)
export const PL: React.FC<{ pts: Pt[]; p?: number; w?: Weight; color?: string; dash?: number[]; o?: number; close?: boolean; fill?: string }> = ({
  pts, p = 1, w = "d", color, dash, o = 1, close = false, fill = "none",
}) => {
  const pen = usePen();
  if (p <= 0 || o <= 0) return null;
  const s = slice(pts, p);
  if (s.length < 2) return null;
  return <path d={dOf(s, close && p >= 1)} fill={fill === "paper" ? pen.paper : fill} stroke={color ?? pen.line} strokeWidth={sw(w, pen)} strokeLinecap="round"
    strokeLinejoin="round" strokeDasharray={dash ? dash.join(" ") : undefined} opacity={o} />;
};
// teknik resim kesik desenleri
export const DASH = { hidden: [9, 7], center: [26, 7, 5, 7], flow: [12, 9], phantom: [22, 6, 4, 6, 4, 6] };

export const Head: React.FC<{ x: number; y: number; ang: number; size?: number; color?: string; o?: number }> = ({ x, y, ang, size = 15, color, o = 1 }) => {
  const pen = usePen();
  if (o <= 0) return null;
  const s = size * Math.pow(pen.k, 0.8);
  return <path d={`M0 0L${-s} ${-s * 0.42}L${-s * 0.78} 0L${-s} ${s * 0.42}Z`} transform={`translate(${r1(x)} ${r1(y)}) rotate(${r1((ang * 180) / Math.PI)})`} fill={color ?? pen.line} opacity={o} />;
};
// Ok: gövde çizilir, uç gövdenin ucunda yürür
export const Arrow: React.FC<{ pts: Pt[]; p?: number; w?: Weight; color?: string; dash?: number[]; size?: number; o?: number }> = ({ pts, p = 1, w = "d", color, dash, size, o = 1 }) => {
  if (p <= 0) return null;
  const tip = pointAt(pts, p);
  return (
    <g opacity={o}>
      <PL pts={pts} p={p} w={w} color={color} dash={dash} />
      <Head x={tip.x} y={tip.y} ang={tip.ang} size={size} color={color} o={seg(p, 0.05, 0.3)} />
    </g>
  );
};

// Ölçü çizgisi |<----->| : a ve b her karede değişebilir (canlı ölçü). Rakam yalnız `label` verilirse.
export const Dim: React.FC<{ a: Pt; b: Pt; p?: number; tick?: number; label?: string; color?: string; o?: number }> = ({ a, b, p = 1, tick = 14, label, color, o = 1 }) => {
  const pen = usePen();
  if (p <= 0 || o <= 0) return null;
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
  if (L < 2) return null;
  const nx = -dy / L, ny = dx / L, ang = Math.atan2(dy, dx), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const h = (L / 2) * Math.min(1, p / 0.7), ux = dx / L, uy = dy / L;   // ortadan iki uca çizilir
  const e = seg(p, 0.6, 1), col = color ?? pen.line;
  return (
    <g opacity={o}>
      <S d={lineD(mx - ux * h, my - uy * h, mx + ux * h, my + uy * h)} w="t" color={col} />
      <S d={lineD(a[0] - nx * tick, a[1] - ny * tick, a[0] + nx * tick, a[1] + ny * tick)} w="t" color={col} o={e} />
      <S d={lineD(b[0] - nx * tick, b[1] - ny * tick, b[0] + nx * tick, b[1] + ny * tick)} w="t" color={col} o={e} />
      <Head x={a[0]} y={a[1]} ang={ang + Math.PI} size={12} color={col} o={e} />
      <Head x={b[0]} y={b[1]} ang={ang} size={12} color={col} o={e} />
      {label && <Txt x={mx + nx * 30} y={my + ny * 30} size={24} o={e} color={col}>{label}</Txt>}
    </g>
  );
};

export const Txt: React.FC<{ x: number; y: number; size?: number; o?: number; color?: string; anchor?: "start" | "middle" | "end"; spacing?: number; children: React.ReactNode }> = ({
  x, y, size = 26, o = 1, color, anchor = "middle", spacing = 0, children,
}) => {
  const pen = usePen();
  if (o <= 0) return null;
  return <text x={x} y={y} textAnchor={anchor} dominantBaseline="central" fontFamily={MONO} fontWeight={500} fontSize={size * pen.k} letterSpacing={spacing * pen.k}
    fill={color ?? pen.line} opacity={o}>{children}</text>;
};

// Harf balonu: parçadan (at) balona (to) kılavuz çizgi + daire + harf
export const Balloon: React.FC<{ at: Pt; to: Pt; label: string; p?: number; r?: number }> = ({ at, to, label, p = 1, r = 19 }) => {
  const pen = usePen();
  if (p <= 0) return null;
  const R = r * pen.k, dx = to[0] - at[0], dy = to[1] - at[1], L = Math.hypot(dx, dy) || 1;
  const end: Pt = [to[0] - (dx / L) * R, to[1] - (dy / L) * R];
  return (
    <g>
      <circle cx={at[0]} cy={at[1]} r={3.2 * pen.k} fill={pen.line} opacity={seg(p, 0, 0.15)} />
      <PL pts={[at, end]} p={seg(p, 0, 0.45)} w="t" />
      <S d={circD(to[0], to[1], R)} p={seg(p, 0.4, 0.8)} w="t" fill="paper" />
      <Txt x={to[0]} y={to[1] + 1 * pen.k} size={r * 1.15} o={seg(p, 0.7, 1)}>{label}</Txt>
    </g>
  );
};

/* ---------- tarama ve maske ---------- */
export const HATCH = { line: "url(#a13-hatch)", fine: "url(#a13-hatch-fine)", accent: "url(#a13-hatch-accent)", cross: "url(#a13-hatch-cross)" };
export const HatchDefs: React.FC<{ line: string; accent: string }> = ({ line, accent }) => (
  <>
    <pattern id="a13-hatch" width="11" height="11" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="11" stroke={line} strokeWidth="2.2" opacity="0.75" /></pattern>
    <pattern id="a13-hatch-fine" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" stroke={line} strokeWidth="1.4" opacity="0.6" /></pattern>
    <pattern id="a13-hatch-accent" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="12" stroke={accent} strokeWidth="3.4" /></pattern>
    <pattern id="a13-hatch-cross" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V9M0 0H9" stroke={line} strokeWidth="1.5" opacity="0.7" fill="none" /></pattern>
  </>
);
// Süpürme maskesi: içerik p ile soldan sağa (ya da yukarıdan aşağı) açılır; mürekkeplenme ve tarama dolguları için
export const Sweep: React.FC<{ x: number; y: number; w: number; h: number; p: number; dir?: "x" | "y"; children: React.ReactNode }> = ({ x, y, w, h, p, dir = "x", children }) => {
  const id = "a13c" + useId().replace(/[^a-zA-Z0-9]/g, "");
  if (p <= 0) return null;
  if (p >= 1) return <>{children}</>;
  return (
    <g>
      <clipPath id={id}><rect x={x} y={y} width={dir === "x" ? w * p : w} height={dir === "y" ? h * p : h} /></clipPath>
      <g clipPath={`url(#${id})`}>{children}</g>
    </g>
  );
};
export const useSvgId = (prefix: string) => prefix + useId().replace(/[^a-zA-Z0-9]/g, "");
