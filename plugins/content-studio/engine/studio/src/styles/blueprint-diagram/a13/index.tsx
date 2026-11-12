import React from "react";
import { AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { StyleProps } from "../../../schema/timeline";
import { EASE, clamp01 } from "../../../components/ease";
import { camAt, viewBoxOf } from "./camera";
import { BaseView, Elevation, FIG_COUNT, FIG_H, FIG_W, Fig0, Fig1, FigFinal } from "./figs";
import {
  Arrow, CH, CW, DASH, Dim, HATCH, HatchDefs, Head, PL, PenProvider, S, Sweep, Txt, bez, circD, lerp, lineD, makeTimes, rectD, rng, seg,
  usePen, type Pen, type Pt, type Times,
} from "./kit";

// EP010 blueprint plakaları (new_code_specs.md §8): props {figure: "a13", plate, steps, camera, fig?, inked?, inkIn?, frameFill?, timebar?}.
// Tek 1920×1080 tuval, kamera viewBox ile. Plakalar: stack-cutaway (s06) · cartridge-section (s09) · square-round (s17) ·
// fig-sheet (s23-s45: ortada o adımın büyük çizimi, sol kenarda biten adımların küçük FIG. kutuları; fig "all" = hepsi + zaman çubuğu).
// Yazı yalnız FIG. numarası, A-E harfleri ve saat rakamları. 2026-11-10: önceden bu plakalar bağlı değildi, "split" yer tutucusu çiziliyordu.

const io = EASE.sin;

/* ---------- kâğıt ---------- */
const Paper: React.FC<{ bg: string }> = ({ bg }) => (
  <>
    <defs>
      <radialGradient id="a13-vig" cx="50%" cy="45%" r="75%">
        <stop offset="0%" stopColor={bg} />
        <stop offset="100%" stopColor="#0A2246" />
      </radialGradient>
      <pattern id="a13-g" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="rgba(234,242,255,0.06)" strokeWidth="1.6" /></pattern>
      <pattern id="a13-G" width="200" height="200" patternUnits="userSpaceOnUse"><path d="M200 0H0V200" fill="none" stroke="rgba(234,242,255,0.11)" strokeWidth="2" /></pattern>
    </defs>
    <rect x={-CW} y={-CH} width={CW * 3} height={CH * 3} fill="url(#a13-vig)" />
    <rect x={-CW} y={-CH} width={CW * 3} height={CH * 3} fill="url(#a13-g)" />
    <rect x={-CW} y={-CH} width={CW * 3} height={CH * 3} fill="url(#a13-G)" />
  </>
);

// figür uzayını (960×540) tuvalde bir kutuya yerleştir; çizgi kalınlığı `screenK` ile ekranda sabit kalır
const Place: React.FC<{ x: number; y: number; s: number; k: number; children: React.ReactNode }> = ({ x, y, s, k, children }) => {
  const pen = usePen();
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <PenProvider value={{ ...pen, k: k / s }}>{children}</PenProvider>
    </g>
  );
};

/* ---------- fig-sheet ---------- */
const MAIN = { x: 400, y: 120, s: 1.45 };                 // büyük çizim: 1392×783
const SMALL = { x: 56, s: 0.25, w: FIG_W * 0.25, h: FIG_H * 0.25, top: 70, gap: 124 };
const smallY = (i: number) => SMALL.top + i * SMALL.gap;

const FigLive: React.FC<{ n: number; t: Times }> = ({ n, t }) => {
  const q = (id: string, i: number) => t.q(id, i);
  if (n === 0) return <Fig0 bag={q("bag-peeled-and-laid-flat", 0)} card={q("card-off-rings", 1)} parts={q("five-parts-exploded-A-E", 2)} />;
  if (n === 1) {
    const e1 = t.p("echo-arrow-ship-ground-ship", 0), e2 = t.p("echo-arrow-ship-ground-ship", 1);
    return <Fig1 cut={q("scissors-open-sealed-edge", 0)} echo1={e1} echo2={e2} ms={t.ms} />;
  }
  if (n === 2) {
    const bot = q("belt-bottom-wraps", 2);
    return <Elevation beltTop={q("belt-top-wraps", 0)} sticky={q("sticky-out-arrows", 1)} beltBot={bot} beltDim={seg(bot, 0.7, 1)} />;
  }
  if (n === 4) return <BaseView ink={q("canister-flips-to-base", 0)} arrows={q("bypass-arrows-through-hole", 1)} plugOutline={q("empty-plug-outline", 2)} />;
  if (n === 5) {
    const bag = q("bag-slides-over-arch", 0);
    return <Elevation beltTop={1} beltBot={1} arch={1} plug={1} bag={seg(bag, 0, 0.5)} bagDrop={EASE.heavyOut(seg(bag, 0.15, 1))}
      press={q("sides-press-on-belts", 1)} wrap={q("outer-tape-wrap", 2)} />;
  }
  if (n === 7) {
    const fl = q("airflow-base-granules-arch-corner-hose-port", 0);
    return <Elevation beltTop={1} beltBot={1} arch={1} plug={1} bag={1} wrap={1} corner={1} hose={1} socket={seg(fl, 0, 0.35)} flow={fl}
      hl={q("square-and-round-joined-highlight", 1)} />;
  }
  return <FigFinal n={n} />;
};

const SmallBox: React.FC<{ n: number; y: number; x?: number; s?: number; ink: number; current?: boolean; fill?: string }> = ({ n, y, x = SMALL.x, s = SMALL.s, ink, current, fill }) => {
  const pen = usePen();
  const w = FIG_W * s, h = FIG_H * s;
  return (
    <g>
      <Txt x={x} y={y - 15} size={15} anchor="start" spacing={2} o={current ? 0.95 : 0.7 * Math.max(ink, 0.35)}>{`FIG. ${n}`}</Txt>
      {current
        ? <S d={rectD(x, y, w, h, 3)} w="t" dash={DASH.hidden} len={2 * (w + h)} color={pen.accent} />
        : <S d={rectD(x, y, w, h, 3)} p={Math.max(ink, 0)} w="t" o={0.55 + 0.45 * ink} />}
      {!current && ink > 0 && (
        <Sweep x={x} y={y} w={w} h={h} p={io(ink)}>
          {fill
            ? <image href={staticFile(fill)} x={x} y={y} width={w} height={h} preserveAspectRatio="xMidYMid slice" opacity={0.92} />
            : <Place x={x} y={y} s={s} k={0.75}><FigFinal n={n} /></Place>}
        </Sweep>
      )}
    </g>
  );
};

const FigSheet: React.FC<{ props: Record<string, unknown>; t: Times }> = ({ props, t }) => {
  const fig = props.fig, inked = (props.inked as number[] | undefined) ?? [], inkIn = (props.inkIn as number[] | undefined) ?? [];
  const ff = props.frameFill as { fig: number; image: string } | undefined;
  const inkP = (n: number) => (inkIn.includes(n) ? clamp01(t.ms / 500) : 1);
  if (fig === "all") {
    const cols = 4, s = 0.42, w = FIG_W * s, h = FIG_H * s, gx = 34, x0 = (CW - cols * w - (cols - 1) * gx) / 2;
    const tb = props.timebar as { from: string; to: string } | undefined;
    const bp = io(t.q("time-bar", 0));
    const y0 = 150, y1 = y0 + h + 70, by = y1 + h + 110;
    return (
      <g>
        {Array.from({ length: FIG_COUNT }, (_, n) => (
          <SmallBox key={n} n={n} x={x0 + (n % cols) * (w + gx)} y={n < cols ? y0 : y1} s={s} ink={1} fill={ff && ff.fig === n ? ff.image : undefined} />
        ))}
        {tb && (
          <g>
            <Dim a={[x0, by]} b={[lerp(x0 + 2, CW - x0, bp), by]} p={bp > 0 ? 1 : 0} tick={16} />
            <Txt x={x0} y={by + 48} size={30} anchor="start" o={seg(bp, 0, 0.2)}>{tb.from}</Txt>
            <Txt x={CW - x0} y={by + 48} size={30} anchor="end" o={seg(bp, 0.85, 1)}>{tb.to}</Txt>
          </g>
        )}
      </g>
    );
  }
  const n = Number(fig ?? 0);
  return (
    <g>
      {Array.from({ length: FIG_COUNT }, (_, i) => {
        if (i === n) return <SmallBox key={i} n={i} y={smallY(i)} ink={0} current />;
        if (!inked.includes(i)) return null;
        return <SmallBox key={i} n={i} y={smallY(i)} ink={inkP(i)} fill={ff && ff.fig === i ? ff.image : undefined} />;
      })}
      <Txt x={MAIN.x + 8} y={MAIN.y - 26} size={34} anchor="start" spacing={4} o={0.9}>{`FIG. ${n}`}</Txt>
      <Place x={MAIN.x} y={MAIN.y} s={MAIN.s} k={1}><FigLive n={n} t={t} /></Place>
    </g>
  );
};

/* ---------- s06: yığın kesiti (yandan): SM + CM | tünel | LM; üç figür tünelden LM'ye geçer, koni söner, LM dolar ---------- */
const Person: React.FC<{ x: number; y: number; o?: number; color?: string }> = ({ x, y, o = 1, color }) => (
  <g opacity={o}>
    <S d={circD(x, y - 30, 11)} w="d" color={color} fill="paper" />
    <S d={`M${x} ${y - 18}V${y + 14}M${x - 15} ${y - 6}H${x + 15}M${x} ${y + 14}L${x - 11} ${y + 38}M${x} ${y + 14}L${x + 11} ${y + 38}`} w="d" color={color} />
  </g>
);
const StackCutaway: React.FC<{ t: Times }> = ({ t }) => {
  const pen = usePen();
  const mv = t.q("figures-through-tunnel", 0), dim = io(t.q("cone-dims", 1)), fill = io(t.q("lander-fills", 2));
  const draw = (a: number, b: number) => io(clamp01((t.ms - a) / (b - a)));   // açılış çizimi (ilk 1.4 sn)
  const cy = 540, coneO = 1 - 0.7 * dim;
  // figürler: CM içinden (x≈800) tünelden (x≈925) LM kabinine (x≈1080), sırayla
  const path: Pt[] = [[800, 0], [870, 0], [925, 0], [990, 0], [1080, 0]];
  const pAt = (u: number) => { const k = clamp01(u) * (path.length - 1), i = Math.min(path.length - 2, Math.floor(k)); return lerp(path[i][0], path[i + 1][0], k - i); };
  return (
    <g>
      {/* eksen */}
      <S d={lineD(150, cy, 1560, cy)} w="h" dash={DASH.center} len={1410} o={0.6} />
      {/* SM: silindir + motor çanı */}
      <S d={rectD(300, cy - 150, 420, 300, 6)} p={draw(0, 900)} w="o" fill="paper" />
      {[380, 470, 560, 650].map((x, i) => <S key={x} d={lineD(x, cy - 147, x, cy + 147)} p={draw(300 + i * 80, 900 + i * 80)} w="h" />)}
      <S d={`M300 ${cy - 70}L210 ${cy - 120}L210 ${cy + 120}L300 ${cy + 70}`} p={draw(200, 1000)} w="d" fill="paper" />
      {/* CM konisi (söner) */}
      <g opacity={coneO}>
        <S d={`M720 ${cy - 150}L885 ${cy - 34}L885 ${cy + 34}L720 ${cy + 150}Z`} p={draw(300, 1100)} w="o" fill="paper" dash={dim > 0.05 ? DASH.hidden : undefined} len={dim > 0.05 ? 760 : 100} />
      </g>
      {/* tünel */}
      <S d={rectD(885, cy - 30, 80, 60, 3)} p={draw(500, 1200)} w="d" fill="paper" />
      {/* LM: tırmanış kabini + iniş katı + bacaklar */}
      <S d={`M965 ${cy - 120}H1150L1190 ${cy - 70}V${cy + 70}L1150 ${cy + 120}H965Z`} p={draw(500, 1300)} w="o" fill="paper" />
      <rect x={968} y={cy - 117} width={218} height={234} fill={pen.accent} opacity={0.18 * fill} />
      <rect x={968} y={cy - 117} width={218} height={234} fill={HATCH.accent} opacity={0.55 * fill} />
      <S d={`M1190 ${cy - 140}H1390V${cy + 140}H1190Z`} p={draw(600, 1400)} w="o" fill="paper" />
      {[[1390, -110, 1500, -190], [1390, 110, 1500, 190]].map(([x, dy, x2, dy2], i) => (
        <g key={i}>
          <S d={lineD(x, cy + dy, x2, cy + dy2)} p={draw(900, 1400)} w="d" />
          <S d={circD(x2, cy + dy2, 14)} p={draw(1100, 1400)} w="d" fill="paper" />
        </g>
      ))}
      {/* üç kişi: biri biri ardınca */}
      {[0, 1, 2].map((i) => {
        const u = seg(mv, i * 0.18, 0.64 + i * 0.18), x = pAt(EASE.cubic(u)), y = cy + [-40, 10, 60][i] * (1 - 0.3 * u);
        return <Person key={i} x={x} y={y} o={seg(t.ms, 600, 1300) * (u >= 1 ? 1 : 1)} color={u >= 1 ? pen.accent : undefined} />;
      })}
      {/* "cankurtaran": LM çevresine vurgu */}
      <S d={rectD(948, cy - 168, 460, 336, 18)} p={fill} w={5} color={pen.accent} />
    </g>
  );
};

/* ---------- s09: kartuş kesiti; hava girer, CO2 noktaları granüllere takılır, temiz hava çıkar, yatak dolar ---------- */
const CartridgeSection: React.FC<{ t: Times }> = ({ t }) => {
  const pen = usePen();
  const out = io(t.q("outline", 0)), ain = t.q("air-arrows-in", 1), caught = t.q("dots-caught", 2), cl = t.q("clean-arrows-out", 3), bed = io(t.q("bed-fills", 4));
  const X0 = 560, X1 = 1360, Y0 = 330, Y1 = 750, B0 = 720, B1 = 1200;
  const grains = React.useMemo(() => {
    const r = rng(13), g: Pt[] = [];
    for (let x = B0 + 18; x < B1 - 10; x += 26) for (let y = Y0 + 26; y < Y1 - 14; y += 26) g.push([x + (r() - 0.5) * 9, y + (r() - 0.5) * 9]);
    return g;
  }, []);
  const dots = React.useMemo(() => { const r = rng(7); return Array.from({ length: 14 }, () => [Y0 + 40 + r() * (Y1 - Y0 - 80), r()] as [number, number]); }, []);
  return (
    <g>
      <S d={rectD(X0, Y0, X1 - X0, Y1 - Y0, 18)} p={out} w="o" fill="paper" />
      <S d={lineD(B0, Y0 + 4, B0, Y1 - 4) + lineD(B1, Y0 + 4, B1, Y1 - 4)} p={seg(out, 0.4, 0.9)} w="d" dash={[6, 6]} len={420} />
      {/* granül yatağı */}
      <g opacity={seg(out, 0.5, 1)}>
        {grains.map((g, i) => <circle key={i} cx={g[0]} cy={g[1]} r={7} fill="none" stroke={pen.line} strokeWidth={1.3 * pen.k} />)}
      </g>
      {/* dolma: soldan sağa turuncu tarama */}
      <Sweep x={B0} y={Y0} w={B1 - B0} h={Y1 - Y0} p={bed}>
        <rect x={B0 + 3} y={Y0 + 3} width={B1 - B0 - 6} height={Y1 - Y0 - 6} fill={HATCH.accent} opacity={0.5} />
      </Sweep>
      {/* giriş/çıkış ağızları */}
      <S d={`M${X0} ${Y0 + 120}H${X0 - 160}M${X0} ${Y1 - 120}H${X0 - 160}`} p={seg(out, 0.6, 1)} w="d" />
      <S d={`M${X1} ${Y0 + 120}H${X1 + 160}M${X1} ${Y1 - 120}H${X1 + 160}`} p={seg(out, 0.6, 1)} w="d" />
      {/* kirli hava okları */}
      {[0, 1, 2].map((i) => <Arrow key={i} pts={[[X0 - 300, 450 + i * 60], [B0 - 30, 450 + i * 60]]} p={io(seg(ain, i * 0.15, 0.7 + i * 0.15))} w="d" dash={DASH.flow} />)}
      {/* CO2 noktaları: girer, yatağın ilk santimlerinde takılır */}
      {dots.map(([y, r], i) => {
        const go = clamp01((t.ms - (t.steps[1]?.at ?? 0) - i * 90) / 1400);
        if (go <= 0) return null;
        const stop = B0 + 20 + r * 160 * (0.4 + 0.6 * caught);
        const x = lerp(X0 - 280, stop, EASE.heavyOut(go));
        return <circle key={i} cx={x} cy={y} r={8} fill={pen.accent} opacity={seg(go, 0, 0.15)} />;
      })}
      {/* temiz hava çıkışı */}
      {[0, 1, 2].map((i) => <Arrow key={i} pts={[[B1 + 30, 450 + i * 60], [X1 + 300, 450 + i * 60]]} p={io(seg(cl, i * 0.15, 0.7 + i * 0.15))} w="d" />)}
    </g>
  );
};

/* ---------- s17: üstten görünüş: kare kutu yuvarlak yuvaya iner, köşeler taşar, kalkar ---------- */
const SquareRound: React.FC<{ t: Times }> = ({ t }) => {
  const pen = usePen();
  const low = t.q("square-lowers", 0), ov = io(t.q("corners-overhang", 1)), lift = t.q("square-lifts", 2);
  const cx = 960, cy = 520, R = 210, h = 175;                 // kare yarı kenarı 175: köşe 247 > R → taşar
  const yOff = -360 * (1 - EASE.heavyOut(low)) - 150 * EASE.cubic(lift), sc = 1 + 0.25 * (1 - EASE.heavyOut(low)) + 0.08 * EASE.cubic(lift);
  const draw = io(clamp01(t.ms / 900));
  return (
    <g>
      <defs>
        <clipPath id="a13-sq"><rect x={cx - h} y={cy - h} width={2 * h} height={2 * h} rx={10} /></clipPath>
        <mask id="a13-outside"><rect x={0} y={0} width={CW} height={CH} fill="#fff" /><circle cx={cx} cy={cy} r={R} fill="#000" /></mask>
      </defs>
      {/* yuva: halka + iç çember + eksenler */}
      <S d={circD(cx, cy, R + 34)} p={draw} w="t" />
      <S d={circD(cx, cy, R)} p={draw} w="o" fill="paper" />
      <S d={lineD(cx - R - 80, cy, cx + R + 80, cy) + lineD(cx, cy - R - 80, cx, cy + R + 80)} w="h" dash={DASH.center} len={2 * R + 160} o={0.6 * draw} />
      {/* gölge: kare inerken büyür */}
      <rect x={cx - h} y={cy - h} width={2 * h} height={2 * h} rx={10} fill="#04101F" opacity={0.25 * seg(low, 0.3, 1) * (1 - 0.6 * EASE.cubic(lift))} />
      {/* kare */}
      <g transform={`translate(${cx} ${cy + yOff}) scale(${sc}) translate(${-cx} ${-cy})`} opacity={seg(low, 0, 0.15) || (low > 0 ? 1 : 0)}>
        <S d={rectD(cx - h, cy - h, 2 * h, 2 * h, 10)} w="o" fill="paper" />
        <S d={rectD(cx - h + 18, cy - h + 18, 2 * h - 36, 2 * h - 36, 6)} w="t" />
        {[-1, 0, 1].map((k) => <S key={k} d={lineD(cx + k * 70, cy - h + 22, cx + k * 70, cy + h - 22)} w="h" />)}
        {/* taşan köşeler: karenin içinde, çemberin dışında kalan bölge */}
        <g clipPath="url(#a13-sq)" mask="url(#a13-outside)" opacity={ov}>
          <rect x={cx - h} y={cy - h} width={2 * h} height={2 * h} fill={pen.accent} opacity={0.25} />
          <rect x={cx - h} y={cy - h} width={2 * h} height={2 * h} fill={HATCH.accent} />
        </g>
      </g>
      {/* çember kenarı karenin üstünde, kesik: oturmuyor */}
      <S d={circD(cx, cy, R)} w="d" dash={DASH.hidden} len={1320} color={pen.accent} o={ov * (1 - EASE.cubic(lift))} />
      {/* taşma okları köşelerde */}
      {([[-1, -1], [1, -1], [1, 1], [-1, 1]] as Pt[]).map(([sx, sy], i) => {
        const a: Pt = [cx + sx * (h + 70), cy + sy * (h + 70)], b: Pt = [cx + sx * (h + 8), cy + sy * (h + 8)];
        return <Arrow key={i} pts={[a, b]} p={io(seg(ov, i * 0.12, 0.6 + i * 0.12)) * (1 - EASE.cubic(lift))} w="t" color={pen.accent} size={13} />;
      })}
    </g>
  );
};

/* ---------- kök ---------- */
export const A13: React.FC<StyleProps> = ({ scene, words, props, theme }) => {
  const f = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const ms = (f / fps) * 1000, durMs = (scene.durationFrames / fps) * 1000;
  const t = makeTimes(props.steps, words, ms);
  const cam = camAt(props.camera, ms, durMs, words);
  const pen: Pen = { k: Math.pow(cam.zoom, -0.35), line: "#EAF2FF", paper: theme.primary || "#1F4E8C", accent: theme.accent || "#F2A93B" };
  const plate = String(props.plate ?? "fig-sheet");
  const Body = plate === "stack-cutaway" ? <StackCutaway t={t} /> : plate === "cartridge-section" ? <CartridgeSection t={t} />
    : plate === "square-round" ? <SquareRound t={t} /> : <FigSheet props={props} t={t} />;
  return (
    <AbsoluteFill>
      <svg width={W} height={H} viewBox={viewBoxOf(cam)} preserveAspectRatio="xMidYMid slice" style={{ position: "absolute" }}>
        <defs><HatchDefs line={pen.line} accent={pen.accent} /></defs>
        <Paper bg={pen.paper} />
        <PenProvider value={pen}>{Body}</PenProvider>
      </svg>
    </AbsoluteFill>
  );
};
