import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { StyleProps, Word } from "../../schema/timeline";
import { MONO } from "../../fonts";
import { A13 } from "./a13";
import { Wing } from "./wing";

// blueprint-diagram (catalog/styles.yaml): mavi zemin, ince çizgi, ölçü okları, patent çizimi estetiği. lang_neutral: yazı yok,
// yalnızca FIG. numarası ve rakam etiketleri. Hareketler anlatımdaki kelime zamanlarına bağlanır (PLAN 8.3).
// props.figure: split | steps | modules | cells | flow | monolith | wing (EP015, wing.tsx)
// props.bare: true → köşe yazıları (FIG. n, sahne kimliği) gizlenir (gereksiz yazı katmanı istenmeyen sahnelerde)

const W = 1080;
const LINE = "#EAF2FF";
const SW = 5;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

type Ctx = { f: number; fps: number; dur: number; accent: string; at: (match: RegExp | number, fallback?: number) => number };

function makeCtx(words: Word[], f: number, fps: number, dur: number, accent: string): Ctx {
  // at(/word/) → o kelimenin başladığı kare; at(n) → n. cümlenin başladığı kare
  const sentenceStarts = [0];
  words.forEach((w, i) => { if (/[.!?]$/.test(w.text) && i + 1 < words.length) sentenceStarts.push(i + 1); });
  const at = (m: RegExp | number, fallback = 0.3) => {
    const w = typeof m === "number" ? words[sentenceStarts[m] ?? -1] : words.find((x) => m.test(x.text));
    return w ? Math.round((w.startMs / 1000) * fps) : Math.round(dur * fallback);
  };
  return { f, fps, dur, accent, at };
}

const draw = (f: number, start: number, len = 18) => interpolate(f, [start, start + len], [1, 0], clamp);
const pop = (c: Ctx, start: number) => spring({ frame: c.f - start, fps: c.fps, config: { damping: 13, mass: 0.7 } });

const Grid: React.FC<{ bg: string }> = ({ bg }) => (
  <svg width={W} height={1920} style={{ position: "absolute" }}>
    <defs>
      <radialGradient id="vig" cx="50%" cy="40%" r="75%">
        <stop offset="0%" stopColor={bg} />
        <stop offset="100%" stopColor="#081A33" />
      </radialGradient>
      <pattern id="g" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M40 0H0V40" fill="none" stroke="rgba(234,242,255,0.07)" strokeWidth="2" />
      </pattern>
      <pattern id="G" width="200" height="200" patternUnits="userSpaceOnUse">
        <path d="M200 0H0V200" fill="none" stroke="rgba(234,242,255,0.13)" strokeWidth="2" />
      </pattern>
    </defs>
    <rect width={W} height={1920} fill="url(#vig)" />
    <rect width={W} height={1920} fill="url(#g)" />
    <rect width={W} height={1920} fill="url(#G)" />
  </svg>
);

// Ölçü oku: |<----->|
const Dim: React.FC<{ x1: number; x2: number; y: number; o: number; label?: string }> = ({ x1, x2, y, o, label }) => (
  <g opacity={o} stroke={LINE} strokeWidth={2.5} fill={LINE}>
    <line x1={x1} y1={y} x2={x2} y2={y} />
    <line x1={x1} y1={y - 18} x2={x1} y2={y + 18} />
    <line x1={x2} y1={y - 18} x2={x2} y2={y + 18} />
    <path d={`M${x1} ${y} l18 -8 v16z M${x2} ${y} l-18 -8 v16z`} stroke="none" />
    {label && <text x={(x1 + x2) / 2} y={y + 52} textAnchor="middle" fontFamily={MONO} fontSize={34} stroke="none">{label}</text>}
  </g>
);

const Leader: React.FC<{ x: number; y: number; n: number; o: number }> = ({ x, y, n, o }) => (
  <g opacity={o} stroke={LINE} strokeWidth={2.5} fill="none">
    <line x1={x} y1={y} x2={x + 70} y2={y - 50} />
    <circle cx={x + 96} cy={y - 66} r={26} />
    <text x={x + 96} y={y - 54} textAnchor="middle" fontFamily={MONO} fontSize={30} fill={LINE} stroke="none">{n}</text>
  </g>
);

/* ---------- figürler ---------- */

const Split: React.FC<{ c: Ctx; n?: number }> = ({ c, n = 3 }) => {
  const crack = c.at(/break/, 0.55) - 10;
  const s = pop(c, c.at(/pieces/, 0.75));
  const w = 420, h = 520, x0 = W / 2 - w / 2, y0 = 560;
  const pw = w / n;
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const dx = (i - (n - 1) / 2) * 70 * s;
        const rot = (i - (n - 1) / 2) * 6 * s;
        return (
          <g key={i} transform={`translate(${dx} ${-Math.abs(i - (n - 1) / 2) * 30 * s}) rotate(${rot} ${x0 + pw * (i + 0.5)} ${y0 + h / 2})`}>
            <rect x={x0 + pw * i} y={y0} width={pw} height={h} fill="rgba(234,242,255,0.05)" stroke={LINE} strokeWidth={SW}
              pathLength={1} strokeDasharray={1} strokeDashoffset={draw(c.f, 2 + i * 3, 22)} />
          </g>
        );
      })}
      <polyline points={`${x0 + pw},${y0} ${x0 + pw + 22},${y0 + 140} ${x0 + pw - 16},${y0 + 300} ${x0 + pw + 10},${y0 + h}`}
        fill="none" stroke={c.accent} strokeWidth={SW + 1} pathLength={1} strokeDasharray={1} strokeDashoffset={draw(c.f, crack, 10)} opacity={1 - s} />
      <polyline points={`${x0 + 2 * pw},${y0} ${x0 + 2 * pw - 18},${y0 + 200} ${x0 + 2 * pw + 14},${y0 + 360} ${x0 + 2 * pw},${y0 + h}`}
        fill="none" stroke={c.accent} strokeWidth={SW + 1} pathLength={1} strokeDasharray={1} strokeDashoffset={draw(c.f, crack + 4, 10)} opacity={1 - s} />
      <Dim x1={x0 - 40 * s} x2={x0 + w + 40 * s} y={y0 + h + 90} o={interpolate(c.f, [20, 32], [0, 1], clamp)} label={s > 0.5 ? `${n} × ${Math.round(100 / n)}%` : "100%"} />
    </g>
  );
};

const Steps: React.FC<{ c: Ctx }> = ({ c }) => {
  const t = [c.at(0, 0), c.at(1, 0.33), c.at(2, 0.66)];
  const rowY = [470, 800, 1130];
  const o = (k: number) => interpolate(c.f, [t[k], t[k] + 8], [0, 1], clamp);
  return (
    <g>
      {rowY.map((y, k) => (
        <g key={k} opacity={o(k)}>
          <circle cx={150} cy={y + 80} r={42} fill="none" stroke={c.accent} strokeWidth={4} />
          <text x={150} y={y + 96} textAnchor="middle" fontFamily={MONO} fontSize={46} fill={c.accent}>{k + 1}</text>
        </g>
      ))}
      {/* 1: bağımsız parçalara böl */}
      <g opacity={o(0)}>
        {[0, 1].map((i) => <rect key={i} x={300 + i * (300 + 40 * pop(c, t[0] + 6))} y={rowY[0]} width={280} height={160} fill="none" stroke={LINE} strokeWidth={SW} />)}
      </g>
      {/* 2: kolay sökülsün: bağlantı pimleri */}
      <g opacity={o(1)}>
        <rect x={300} y={rowY[1]} width={280} height={160} fill="none" stroke={LINE} strokeWidth={SW} />
        <rect x={620 + 30 * Math.sin(Math.max(0, c.f - t[1]) / 6)} y={rowY[1]} width={280} height={160} fill="none" stroke={LINE} strokeWidth={SW} />
        {[40, 120].map((dy) => <circle key={dy} cx={600} cy={rowY[1] + dy} r={14} fill={c.accent} />)}
      </g>
      {/* 3: daha da böl */}
      <g opacity={o(2)}>
        {Array.from({ length: 6 }, (_, i) => {
          const s = pop(c, t[2] + 4 + i * 2);
          return <rect key={i} x={300 + i * 100 + (i % 2) * 6} y={rowY[2] + (1 - s) * 40} width={86} height={160} fill="rgba(234,242,255,0.05)" stroke={LINE} strokeWidth={4} opacity={s} />;
        })}
      </g>
    </g>
  );
};

const Sofa: React.FC<{ x: number; y: number; w: number; o?: number }> = ({ x, y, w, o = 1 }) => (
  <g opacity={o} fill="rgba(234,242,255,0.05)" stroke={LINE} strokeWidth={SW}>
    <rect x={x} y={y} width={w} height={90} rx={14} />
    <rect x={x} y={y + 90} width={w} height={90} rx={10} />
    <line x1={x + 16} y1={y + 180} x2={x + 16} y2={y + 210} />
    <line x1={x + w - 16} y1={y + 180} x2={x + w - 16} y2={y + 210} />
  </g>
);

const Modules: React.FC<{ c: Ctx }> = ({ c }) => {
  const t2 = c.at(1, 0.35), t3 = c.at(2, 0.7);
  const doorX = 760, doorTop = 600, doorBot = 1050;
  const push = interpolate(c.f, [t2, t2 + 24], [0, 1], clamp);
  const bump = c.f > t2 + 24 && c.f < t2 + 34 ? Math.sin((c.f - t2) * 2.2) * 8 : 0;
  const split = pop(c, t3);
  const bigX = 140 + push * 120 + bump;
  return (
    <g>
      {/* kapı kasası + ölçü */}
      <rect x={doorX} y={doorTop} width={200} height={doorBot - doorTop} fill="none" stroke={LINE} strokeWidth={SW} strokeDasharray="18 12" />
      <Dim x1={doorX} x2={doorX + 200} y={doorTop - 60} o={1} label="80 cm" />
      {split < 0.05 ? (
        <>
          <Sofa x={bigX} y={820} w={560} />
          <Dim x1={bigX} x2={bigX + 560} y={1090} o={interpolate(c.f, [6, 16], [0, 1], clamp)} label="240 cm" />
          {c.f > t2 + 24 && <text x={doorX - 20} y={800} fontFamily={MONO} fontSize={90} fill={c.accent} textAnchor="end">×</text>}
        </>
      ) : (
        [0, 1, 2].map((i) => {
          const go = interpolate(c.f, [t3 + 8 + i * 9, t3 + 30 + i * 9], [0, 1], clamp);
          const x = 140 + i * 190 + go * (doorX + 20 - (140 + i * 190));
          return <Sofa key={i} x={x} y={820 - go * i * 0} w={170} o={1 - interpolate(go, [0.85, 1], [0, 0.7], clamp)} />;
        })
      )}
    </g>
  );
};

const Cells: React.FC<{ c: Ctx }> = ({ c }) => {
  const tSwap = c.at(/hundreds|thousands/, 0.5);
  const cols = 9, rows = 12, r = 22, gx = 56, x0 = W / 2 - ((cols - 1) * gx) / 2, y0 = 560;
  const big = 1 - interpolate(c.f, [tSwap - 6, tSwap + 4], [0, 1], clamp);
  return (
    <g>
      <rect x={x0 - 60} y={y0 - 70} width={(cols - 1) * gx + 120} height={(rows - 1) * gx + 140} rx={18} fill="none" stroke={LINE} strokeWidth={SW} />
      <rect x={W / 2 - 50} y={y0 - 100} width={100} height={30} fill="none" stroke={LINE} strokeWidth={SW} />
      <g opacity={big}>
        <rect x={W / 2 - 150} y={y0 + 40} width={300} height={520} rx={60} fill="rgba(234,242,255,0.06)" stroke={LINE} strokeWidth={SW} />
        <text x={W / 2} y={y0 + 330} textAnchor="middle" fontFamily={MONO} fontSize={60} fill={LINE}>1</text>
      </g>
      {Array.from({ length: cols * rows }, (_, k) => {
        const i = k % cols, j = Math.floor(k / cols);
        const s = spring({ frame: c.f - tSwap - (i + j) * 1.2, fps: c.fps, config: { damping: 15 } });
        return <circle key={k} cx={x0 + i * gx} cy={y0 + j * gx} r={r * s} fill={(i + j) % 7 === 0 ? c.accent : "rgba(234,242,255,0.12)"} stroke={LINE} strokeWidth={2.5} />;
      })}
      <text x={x0 + (cols - 1) * gx + 40} y={y0 + rows * gx + 50} textAnchor="end" fontFamily={MONO} fontSize={38} fill={LINE}
        opacity={interpolate(c.f, [tSwap + 20, tSwap + 30], [0, 1], clamp)}>× 1000+</text>
    </g>
  );
};

const Flow: React.FC<{ c: Ctx }> = ({ c }) => {
  const st = [c.at(/ship/, 0.4), c.at(/train/, 0.6), c.at(/truck/, 0.8)];
  const ys = [560, 860, 1160];
  const stage = st.filter((t) => c.f >= t).length - 1;
  const from = Math.max(0, stage);
  const hop = stage < 0 ? 0 : interpolate(c.f, [st[from], st[from] + 14], [0, 1], clamp);
  const prevY = ys[Math.max(0, from - 1)] - 120, curY = ys[from] - 120;
  const cy = stage <= 0 ? ys[0] - 120 : prevY + (curY - prevY) * hop - Math.sin(hop * Math.PI) * 60;
  const o = (k: number) => interpolate(c.f, [st[k] - 12, st[k]], [0.25, 1], clamp);
  return (
    <g fill="none" stroke={LINE} strokeWidth={SW}>
      {/* gemi */}
      <g opacity={o(0)}><path d={`M250 ${ys[0]} H830 L770 ${ys[0] + 90} H310 Z`} /><path d={`M200 ${ys[0] + 130} q40 -20 80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0`} strokeWidth={3} /></g>
      {/* tren */}
      <g opacity={o(1)}><rect x={300} y={ys[1] - 20} width={480} height={90} /><circle cx={360} cy={ys[1] + 100} r={30} /><circle cx={720} cy={ys[1] + 100} r={30} /><line x1={200} y1={ys[1] + 132} x2={880} y2={ys[1] + 132} /></g>
      {/* kamyon */}
      <g opacity={o(2)}><rect x={300} y={ys[2] - 20} width={360} height={110} /><path d={`M660 ${ys[2] + 90} V${ys[2] + 10} H750 L800 ${ys[2] + 50} V${ys[2] + 90} Z`} /><circle cx={360} cy={ys[2] + 120} r={30} /><circle cx={720} cy={ys[2] + 120} r={30} /></g>
      {/* konteyner */}
      <g transform={`translate(${W / 2 - 110} ${cy})`}>
        <rect width={220} height={100} fill="rgba(242,169,59,0.18)" stroke={c.accent} />
        {[1, 2, 3, 4, 5, 6].map((k) => <line key={k} x1={k * 31} y1={10} x2={k * 31} y2={90} stroke={c.accent} strokeWidth={3} />)}
      </g>
    </g>
  );
};

const Monolith: React.FC<{ c: Ctx }> = ({ c }) => {
  const tags = [c.at(/big/, 0.2), c.at(/rigid/, 0.35), c.at(/fragile/, 0.5)];
  const cut = pop(c, c.at(/cutting/, 0.7));
  const x0 = 340, y0 = 480, w = 400, h = 700;
  return (
    <g>
      {cut < 0.05 ? (
        <rect x={x0} y={y0} width={w} height={h} fill="rgba(234,242,255,0.06)" stroke={LINE} strokeWidth={SW} />
      ) : (
        Array.from({ length: 8 }, (_, k) => {
          const i = k % 2, j = Math.floor(k / 2);
          const gap = 26 * cut;
          return <rect key={k} x={x0 + i * (w / 2 + gap) - gap / 2} y={y0 + j * (h / 4 + gap) - gap * 1.5} width={w / 2} height={h / 4} fill="rgba(234,242,255,0.06)" stroke={LINE} strokeWidth={4} />;
        })
      )}
      {/* çok büyük: ölçü okları · çok katı: kilit · çok kırılgan: çatlak */}
      <g opacity={interpolate(c.f, [tags[0], tags[0] + 6], [0, 1], clamp) * (1 - cut)}><Dim x1={x0} x2={x0 + w} y={y0 - 70} o={1} /></g>
      <g opacity={interpolate(c.f, [tags[1], tags[1] + 6], [0, 1], clamp) * (1 - cut)} stroke={c.accent} strokeWidth={5} fill="none">
        <rect x={830} y={760} width={110} height={90} rx={10} /><path d="M855 760 v-40 a30 30 0 0 1 60 0 v40" />
      </g>
      <polyline opacity={1 - cut} points={`${x0 + 120},${y0} ${x0 + 160},${y0 + 200} ${x0 + 110},${y0 + 360} ${x0 + 170},${y0 + 520}`} fill="none" stroke={c.accent} strokeWidth={SW}
        pathLength={1} strokeDasharray={1} strokeDashoffset={draw(c.f, tags[2], 10)} />
    </g>
  );
};

const FIG_FROM = 920;   // çizim alanı yüksekliği (400 → 1320)
const FIG_TO = 760;     // ekrandaki yükseklik (300 → 1060)
const FIG_TOP = 300;

const FIGS: Record<string, React.FC<{ c: Ctx }>> ={ split: Split, steps: Steps, modules: Modules, cells: Cells, flow: Flow, monolith: Monolith, wing: Wing };

export const BlueprintDiagram: React.FC<StyleProps> = ({ scene, words, props, theme, index }) => {
  if (props.figure === "a13") return <A13 scene={scene} words={words} props={props} theme={theme} index={index} lang="" />;   // EP010 16:9 plakaları (a13/index.tsx)
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c = makeCtx(words, f, fps, scene.durationFrames, theme.accent);
  const Fig = FIGS[String(props.figure ?? "split")] ?? Split;
  const leaders = (props.leaders as number | undefined) ?? 0;
  // Hafif itme (push-in): her sahne yavaşça yaklaşır; ritim için görsel değişim (PLAN 8.2)
  const zoom = interpolate(f, [0, scene.durationFrames], [1, 1.05]);
  // Figürler y ≈ 400-1320 aralığında çizilir; altyazı bandı (%60-78) boş kalsın diye 300-1060'a sığdırılır.
  const k = FIG_TO / FIG_FROM;
  const fit = `translate(${(W / 2) * (1 - k)} ${FIG_TOP - 400 * k}) scale(${k})`;
  return (
    <AbsoluteFill>
      <Grid bg={theme.primary} />
      <svg width={W} height={1920} style={{ position: "absolute", transform: `scale(${zoom})`, transformOrigin: "50% 35%" }}>
        <g transform={fit}>
          <Fig c={c} />
          {Array.from({ length: leaders }, (_, i) => <Leader key={i} x={780} y={620 + i * 160} n={i + 1} o={interpolate(f, [30 + i * 8, 40 + i * 8], [0, 1], clamp)} />)}
        </g>
      </svg>
      {props.bare ? null : <>
        <div style={{ position: "absolute", left: 90, top: 150, fontFamily: MONO, fontSize: 40, color: LINE, letterSpacing: 4, opacity: 0.85 }}>
          FIG. {index + 1}
        </div>
        <div style={{ position: "absolute", right: 170, top: 150, fontFamily: MONO, fontSize: 30, color: LINE, opacity: 0.5 }}>
          {scene.id.toUpperCase()}
        </div>
      </>}
    </AbsoluteFill>
  );
};
