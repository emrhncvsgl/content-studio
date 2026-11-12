import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { Word } from "../schema/timeline";
import { MONO } from "../fonts";
import { EASE, clamp01 } from "./ease";
import { atMs } from "../styles/vox-explainer";

// Görev saati çipi (EP010, visual-investigation motifi): sahne `props.clock` taşıyorsa stil ne olursa olsun aynı köşede küçük kâğıt çip.
// Geçişlerin ve stil bileşenlerinin ÜSTÜNDE çizilir (ShortsVideo): geçiş penceresinde yerinde ve net kalır (transition.hold: "clock" bununla sağlanır).
// clock = { get: "hhh:mm[:ss]", x (0.86), y (0.10), from?, at? (ms | kelime), rollMs?, running?, speed?, enter?, big?, pair?, fadeAt?, fadeMs?,
//           dialChip?: { value, marks?, max? } }
//   from + at : `at` anında from → get sarar (geri de sarar), rollMs (1400), heavyOut
//   from yok, önceki sahnede de saat varsa (prevGet): sahne başında 600 ms'de önceki değerden sarar (çip kesmede sıçramaz)
//   running   : get'ten itibaren sayar (speed: gerçek zamanın katı) · enter: sağdan girer (ilk tanıtım) · big: 1.6×
//   pair      : yanında ikinci çip (iki zaman damgası) · fadeAt/fadeMs: söner · dialChip: çipin altında küçük kadran (0-max, varsayılan 20)
export type Clock = { get: string; x?: number; y?: number; from?: string; at?: unknown; rollMs?: number; running?: boolean; speed?: number; enter?: boolean;
  big?: boolean; pair?: string; fadeAt?: unknown; fadeMs?: number; dialChip?: { value: number; marks?: number[]; max?: number } };

const parse = (t: string) => { const p = t.split(":").map(Number); return { s: (p[0] || 0) * 3600 + (p[1] || 0) * 60 + (p[2] || 0), sec: p.length > 2 }; };
const fmt = (s: number, sec: boolean) => {
  const t = Math.max(0, Math.round(s)), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), q = t % 60, z = (n: number, k: number) => String(n).padStart(k, "0");
  return `${z(h, 3)}:${z(m, 2)}${sec ? `:${z(q, 2)}` : ""}`;
};
const torn = (seed: number) => {
  const pts: string[] = [], n = 12, r = (i: number) => { const x = Math.sin((i + seed) * 91.7) * 43758.5; return x - Math.floor(x); };
  for (let i = 0; i <= n; i++) pts.push(`${(i / n) * 100}% ${r(i) * 8}%`);
  for (let i = n; i >= 0; i--) pts.push(`${(i / n) * 100}% ${92 + r(i + 40) * 8}%`);
  return `polygon(${pts.join(",")})`;
};

export const MissionClock: React.FC<{ clock: Clock; words: Word[]; prevGet?: string; delayMs?: number }> = ({ clock, words, prevGet, delayMs = 0 }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const ms = (frame / fps) * 1000, s = (width / 1920) * (clock.big ? 1.6 : 1);
  const tgt = parse(clock.get), start = clock.from ? parse(clock.from) : prevGet && prevGet !== clock.get ? parse(prevGet) : null;
  const t0 = clock.from ? atMs(clock.at ?? 0, words) : 0, dur = clock.rollMs ?? (clock.from ? 1400 : 600);
  const k = start ? EASE.heavyOut(clamp01((ms - t0) / dur)) : 1;
  let val = start ? start.s + (tgt.s - start.s) * k : tgt.s;
  if (clock.running) val += (Math.max(0, ms - (start ? t0 + dur : 0)) / 1000) * (clock.speed ?? 1);
  const sec = tgt.sec || !!clock.running || (!!start && start.sec && k < 1);
  const inK = clock.enter ? EASE.heavyOut(clamp01((ms - Math.max(0, t0 - 700)) / 600)) : 1;
  const fade = clock.fadeAt !== undefined ? 1 - EASE.cubic(clamp01((ms - atMs(clock.fadeAt, words)) / (clock.fadeMs ?? 1500))) : 1;
  const show = interpolate(ms, [delayMs, delayMs + 500], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const chip = (txt: string, seed: number) => (
    <div style={{ background: "#e8dcc1", clipPath: torn(seed), padding: `${9 * s}px ${20 * s}px ${8 * s}px`, fontFamily: MONO, fontWeight: 500, fontSize: 38 * s,
      letterSpacing: 1.5 * s, color: "#14100b", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{txt}</div>
  );
  const d = clock.dialChip, R = 46 * s, ang = (v: number) => ((135 + (clamp01(v / (d?.max ?? 20))) * 270) * Math.PI) / 180;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: show * fade * (clock.enter ? Math.min(1, inK * 1.5) : 1) }}>
      <div style={{ position: "absolute", left: (clock.x ?? 0.86) * width, top: (clock.y ?? 0.1) * height, transform: `translate(-50%, -50%) translateX(${(1 - inK) * 260 * s}px) rotate(-1.2deg)`,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 10 * s, filter: `drop-shadow(0 ${3 * s}px ${6 * s}px rgba(0,0,0,0.45))` }}>
        <div style={{ display: "flex", gap: 26 * s }}>
          {chip(fmt(val, sec), 3)}
          {clock.pair ? chip(clock.pair, 9) : null}
        </div>
        {d ? (
          <svg width={R * 2.3} height={R * 2.3} viewBox={`${-R * 1.15} ${-R * 1.15} ${R * 2.3} ${R * 2.3}`}>
            <circle r={R * 1.1} fill="#2B2A28" /><circle r={R} fill="#EFE6D2" />
            {(d.marks ?? []).map((m) => <line key={m} x1={Math.cos(ang(m)) * R * 0.62} y1={Math.sin(ang(m)) * R * 0.62} x2={Math.cos(ang(m)) * R * 0.96} y2={Math.sin(ang(m)) * R * 0.96} stroke="#C8372D" strokeWidth={6 * s} strokeLinecap="round" />)}
            <line x1={0} y1={0} x2={Math.cos(ang(d.value)) * R * 0.8} y2={Math.sin(ang(d.value)) * R * 0.8} stroke="#2B2A28" strokeWidth={4 * s} strokeLinecap="round" />
            <circle r={R * 0.1} fill="#2B2A28" />
          </svg>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
