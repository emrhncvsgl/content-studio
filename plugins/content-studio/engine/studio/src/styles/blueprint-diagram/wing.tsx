// blueprint-diagram figure "wing" (EP015 s04, 2026-11-12): tek kanat, eğik izdüşüm. Orta bölmeler çaprazlarla rijit ("stiff"), altında yüzüstü
// pilot asılı ("carry"), dış uç bölmesi uzun eksen (ana kiriş) etrafında burulur ("twist"). Yazısız. Kelimeler: props.cues {stiff, carry, twist}.
// Koordinatlar figür alanında (x 0-1080, y 400-1320; index.tsx `fit` ile 300-1060'a sığar).
import { interpolate, spring } from "remotion";

type Ctx = { f: number; fps: number; dur: number; accent: string; at: (match: RegExp | number, fallback?: number) => number };
const LINE = "#EAF2FF";
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const sstep = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

// kanat: açıklık s (0 kök sol … 1 uç sağ), veter c (0 hücum kenarı … 1 firar kenarı). Burulma ekseni c = 0.3 (ön kiriş arkası).
const X0 = 60, SPAN = 880, Y0 = 880, TILT = -90, CX = 150, CY = -330, V = 420, AX = 0.3, ST = 0.66;
const P = (s: number, c: number, th: number) => {
  const a = th * sstep((s - ST) / (1 - ST)), q = c - AX;
  const depth = AX + q * Math.cos(a), up = q * Math.sin(a);
  return [X0 + s * SPAN + depth * CX, Y0 + (s - 0.5) * TILT + depth * CY - up * V] as const;
};
const pl = (pts: (readonly [number, number])[]) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

export const Wing: React.FC<{ c: Ctx }> = ({ c }) => {
  const fStiff = c.at(/stiff/, 0.2), fCarry = c.at(/carry/, 0.45), fTwist = c.at(/twist/, 0.7) - 4;
  const g = (c.f - fTwist) / (2.4 * c.fps);
  const th = g <= 0 ? 0 : THETA * Math.sin(2 * Math.PI * 1.25 * Math.min(1, g)) * sstep(g / 0.25);
  const ribs = Array.from({ length: 11 }, (_, i) => i / 10);
  const edge = (cc: number) => pl(Array.from({ length: 49 }, (_, i) => P(i / 48, cc, th)));
  const rib = (s: number) => pl(Array.from({ length: 9 }, (_, i) => P(s, i / 8, th)));
  // pilot: yukarıdan iner ve asılı kalır; kanat yükte eğilmez (2 px titreşim söner)
  const hang = spring({ frame: c.f - fCarry, fps: c.fps, config: { damping: 14, mass: 0.8 } });
  const quiver = c.f > fCarry ? 2.2 * Math.exp(-(c.f - fCarry - 8) / 6) * Math.sin((c.f - fCarry) * 1.6) * (c.f > fCarry + 8 ? 1 : 0) : 0;
  const [hx, hy] = P(0.48, 0, 0);   // hücum kenarının altına asılır (eğik görünüşte kanadın önünde/altında)
  return (
    <g transform={`translate(0 ${quiver.toFixed(2)})`}>
      <defs>
        <pattern id="wh" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <line x1="0" y1="0" x2="0" y2="16" stroke="rgba(234,242,255,0.22)" strokeWidth="3" />
        </pattern>
      </defs>
      {/* rijit orta bölmeler: tarama + X çaprazlar ("stiff"te sırayla çizilir) */}
      {ribs.slice(2, 8).map((s, i) => {
        const t0 = fStiff + i * 4, o = interpolate(c.f, [t0, t0 + 10], [0, 1], clamp);
        const a = P(s, 0, th), b = P(s + 0.1, 0, th), d = P(s + 0.1, 1, th), e = P(s, 1, th);
        return (
          <g key={i}>
            <polygon points={pl([a, b, d, e])} fill="url(#wh)" opacity={o} />
            <polyline points={pl([a, d])} stroke={LINE} strokeWidth={3} fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - o} />
            <polyline points={pl([b, e])} stroke={LINE} strokeWidth={3} fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - o} />
          </g>
        );
      })}
      {/* kaburgalar, kirişler, kenarlar; burulan uç bölmesi vurgu renginde */}
      {ribs.map((s, i) => <polyline key={i} points={rib(s)} stroke={s > ST + 0.01 ? c.accent : LINE} strokeWidth={s === 0 || s === 1 ? 5 : 3} fill="none" />)}
      <polyline points={edge(0)} stroke={LINE} strokeWidth={5} fill="none" />
      <polyline points={edge(1)} stroke={LINE} strokeWidth={5} fill="none" />
      <polyline points={edge(0.3)} stroke={LINE} strokeWidth={2.5} strokeDasharray="14 10" fill="none" opacity={0.7} />
      <polyline points={pl(Array.from({ length: 13 }, (_, i) => P(ST + (i / 12) * (1 - ST), 0, th)))} stroke={c.accent} strokeWidth={6} fill="none" />
      <polyline points={pl(Array.from({ length: 13 }, (_, i) => P(ST + (i / 12) * (1 - ST), 1, th)))} stroke={c.accent} strokeWidth={6} fill="none" />
      {/* yüzüstü pilot, iki askı çizgisiyle */}
      <g opacity={hang} transform={`translate(${hx} ${hy + 150 + (1 - hang) * -160}) scale(1.6)`} stroke={LINE} strokeWidth={4} fill="rgba(234,242,255,0.10)">
        <line x1={-40} y1={-94} x2={-30} y2={30} /><line x1={50} y1={-94} x2={40} y2={30} />
        <circle cx={-78} cy={40} r={20} />
        <ellipse cx={0} cy={48} rx={62} ry={18} />
        <line x1={58} y1={44} x2={120} y2={38} /><line x1={58} y1={54} x2={122} y2={58} />
      </g>
    </g>
  );
};
const THETA = (14 * Math.PI) / 180;
