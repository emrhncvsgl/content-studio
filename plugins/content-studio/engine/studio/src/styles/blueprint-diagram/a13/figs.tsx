import React from "react";
import { EASE } from "../../../components/ease";
import { Arrow, Balloon, DASH, Dim, HATCH, Head, PL, S, Sweep, bez, circD, dOf, lerp, lineD, offsetPoly, pointAt, polyLen, rectD, seg, slice, usePen, type Pt } from "./kit";

// FIG. 0-7 çizimleri: hepsi 960×540'lık "figür uzayında" (sol üst 0,0). Ana çizimde ölçek 1 ile, sol kenardaki küçük kutuda
// küçültülerek aynı bileşen kullanılır. Bütün girdiler ilerleme (0-1); varsayılanlar bitmiş hâli verir (küçük kutu = bitmiş adım).
// Adaptörün yapısı (Apollo 13 Mission Report): kare CM LiOH kutusu · yapışkan yüzü dışa iki bant kemeri · üstte karton kemer ·
// taban ortasındaki bypass deliğinde tıkaç · kemerin üstünden geçirilip bantlanan torba · torbanın kesik köşesinden giren giysi hortumu.
export const FIG_W = 960, FIG_H = 540;
const io = EASE.sin;

/* ---------- ortak parçalar ---------- */
// Oluklu hortum: iki duvar + oluk çizgileri; nötr (çizgi rengi)
export const Hose: React.FC<{ pts: Pt[]; p?: number; r?: number }> = ({ pts, p = 1, r = 11 }) => {
  const pen = usePen();
  if (p <= 0) return null;
  const a = offsetPoly(pts, r), b = offsetPoly(pts, -r);
  const n = Math.max(2, Math.floor(polyLen(pts) / 11)), shown = Math.floor(n * seg(p, 0.1, 1));
  const as = slice(a, p), bs = slice(b, p);
  return (
    <g>
      {as.length > 1 && <path d={dOf([...as, ...[...bs].reverse()], true)} fill={pen.paper} />}
      {Array.from({ length: shown }, (_, i) => {
        const t = (i + 0.5) / n, u = pointAt(a, t), v = pointAt(b, t);
        return <S key={i} d={lineD(u.x, u.y, v.x, v.y)} w="h" />;
      })}
      <PL pts={a} p={p} w="d" />
      <PL pts={b} p={p} w="d" />
    </g>
  );
};

const wavy = (x: number, y: number, n: number) => `M${x} ${y}q18 -9 36 0` + " t36 0".repeat(n - 1);

/* ---------- FIG. 0: malzemeler (torba, kart, kutu, bant, hortum; A-E) ---------- */
export const Fig0: React.FC<{ bag?: number; card?: number; parts?: number }> = ({ bag = 1, card = 1, parts = 1 }) => {
  const pen = usePen();
  const away = 1 - seg(parts, 0, 0.4);                       // patlatılmış düzende kaynak nesneler (giysi, halkalar) çekilir
  // torba katlı giysiden sıyrılıp aşağıya düz serilir
  const slide = EASE.cubic(seg(bag, 0.4, 0.85)), by = lerp(28, 215, slide) - 215, gO = (1 - 0.65 * slide) * away;
  // kart halkalarından çıkar
  const drop = EASE.cubic(seg(card, 0.35, 0.9)), cy = lerp(46, 105, drop), rO = (1 - 0.55 * drop) * away;
  const bal = (i: number) => seg(parts, 0.5 + i * 0.07, 0.78 + i * 0.055);
  const hose = bez([690, 318], [745, 258], [800, 372], [900, 336], 26);
  return (
    <g>
      {/* katlı soğutma giysisi (kaynak nesne, ince) */}
      <g opacity={gO}>
        <S d={rectD(78, 42, 204, 163, 10)} p={io(seg(bag, 0, 0.3))} w="t" />
        {[72, 104, 136, 168].map((y, i) => <S key={y} d={wavy(92, y, 5)} p={io(seg(bag, 0.08 + i * 0.04, 0.32 + i * 0.04))} w="h" />)}
        <S d={lineD(180, 46, 180, 201)} p={seg(bag, 0.2, 0.35)} w="h" dash={DASH.hidden} len={155} />
      </g>
      {/* C: torba */}
      <g transform={`translate(0 ${by})`}>
        <S d={rectD(60, 215, 240, 255, 12)} p={io(seg(bag, 0.15, 0.45))} w="o" fill={pen.line} fillO={0.06} />
        <S d={lineD(64, 229, 296, 229)} p={seg(bag, 0.8, 0.95)} w="t" />
        <S d="M92 300q30 -14 58 6M196 352q34 10 70 -8M110 420q40 -10 82 4" p={seg(bag, 0.85, 1)} w="h" />
      </g>
      {/* halkalar ve arkadaki sayfalar */}
      <g opacity={rO}>
        <S d={rectD(693, 40, 174, 112, 4)} p={seg(card, 0, 0.3)} w="h" dash={DASH.hidden} len={572} />
        {[742, 818].map((x) => <S key={x} d={circD(x, 52, 14)} p={io(seg(card, 0, 0.28))} w="d" />)}
      </g>
      {/* D: karton cue card (yazı yok: yalnız satır çizgileri) */}
      <g transform={`translate(0 ${cy - 105})`}>
        <S d={rectD(685, 105, 190, 120, 5)} p={io(seg(card, 0.08, 0.4))} w="o" fill="paper" />
        {[742, 818].map((x) => <S key={x} d={circD(x, 118, 5)} p={seg(card, 0.3, 0.45)} w="t" />)}
        {[146, 164, 182, 200].map((y, i) => <S key={y} d={lineD(703, y, i === 3 ? 800 : 857, y)} p={seg(card, 0.5 + i * 0.08, 0.7 + i * 0.08)} w="h" />)}
      </g>
      {/* A: kare LiOH kutusu */}
      <S d={rectD(385, 170, 190, 190, 14)} p={io(seg(parts, 0, 0.35))} w="o" fill="paper" />
      <S d={lineD(388, 186, 572, 186) + lineD(388, 344, 572, 344)} p={seg(parts, 0.25, 0.45)} w="t" />
      {[432, 480, 528].map((x) => <S key={x} d={lineD(x, 190, x, 340)} p={seg(parts, 0.3, 0.55)} w="h" />)}
      <Dim a={[385, 388]} b={[575, 388]} p={seg(parts, 0.5, 0.85)} tick={9} />
      {/* B: bant rulosu ve çekilmiş şerit */}
      <S d={circD(455, 462, 42)} p={io(seg(parts, 0.1, 0.45))} w="o" fill="paper" />
      <S d={circD(455, 462, 19)} p={seg(parts, 0.3, 0.5)} w="d" />
      <S d="M455 420H604V431H470" p={seg(parts, 0.35, 0.6)} w="d" />
      {/* E: giysi hortumu */}
      <Hose pts={hose} p={io(seg(parts, 0.15, 0.6))} />
      <Balloon at={[562, 196]} to={[622, 146]} label="A" p={bal(0)} />
      <Balloon at={[590, 425]} to={[648, 472]} label="B" p={bal(1)} />
      <Balloon at={[288, 300]} to={[340, 258]} label="C" p={bal(2) * (bag >= 1 ? 1 : 0)} />
      <Balloon at={[712, 222]} to={[672, 272]} label="D" p={bal(3) * (card >= 1 ? 1 : 0)} />
      <Balloon at={[886, 330]} to={[918, 282]} label="E" p={bal(4)} />
    </g>
  );
};

/* ---------- FIG. 1: makas torbanın kapalı kenarını açar; gemi-yer-gemi yankı oku ---------- */
export const Fig1: React.FC<{ cut?: number; echo1?: number; echo2?: number; ms?: number }> = ({ cut = 1, echo1 = 1, echo2 = 1, ms = 0 }) => {
  const x0 = 60, x1 = 560, y = 190;
  const c = seg(cut, 0.08, 1), xc = lerp(x0, x1, c), h = Math.min(38, (xc - x0) * 0.14), mid = (x0 + xc) / 2;
  const cutting = cut > 0.08 && cut < 1;
  const a = cutting ? 4 + 11 * Math.abs(Math.sin((ms / 1000) * Math.PI * 4.4)) : 12;   // makas ağzı (saniyede ≈ 4 kesim)
  return (
    <g>
      <S d={`M${x0} ${y}V418Q${x0} 430 72 430H548Q${x1} 430 ${x1} 418V${y}`} w="o" fill="none" />
      <S d="M110 300q44 -16 84 8M300 372q50 12 104 -10M420 262q40 -12 86 6" w="h" />
      {/* açılan ağız */}
      {c > 0 && (
        <g>
          <path d={`M${x0} ${y}Q${mid} ${y - h} ${xc} ${y}Q${mid} ${y + h * 0.7} ${x0} ${y}Z`} fill="rgba(4,12,28,0.35)" />
          <S d={`M${x0} ${y}Q${mid} ${y - h} ${xc} ${y}`} w="o" />
          <S d={`M${x0} ${y}Q${mid} ${y + h * 0.7} ${xc} ${y}`} w="d" />
        </g>
      )}
      {/* kesilmemiş kapalı kenar: çift çizgi + ince tarama */}
      {c < 1 && (
        <g>
          <rect x={xc} y={y} width={x1 - xc} height={13} fill={HATCH.fine} />
          <S d={lineD(xc, y, x1, y)} w="o" />
          <S d={lineD(xc, y + 13, x1, y + 13)} w="t" />
        </g>
      )}
      {/* canlı ölçü: kesilen boy */}
      <Dim a={[x0, y - 58]} b={[Math.max(x0 + 3, xc), y - 58]} p={cut > 0.08 ? 1 : 0} tick={9} o={seg(cut, 0.08, 0.2)} />
      {/* makas */}
      <g transform={`translate(${xc} ${y})`} opacity={seg(cut, 0, 0.08)}>
        <S d={lineD(-40, 0, 12, -a)} w="d" />
        <S d={lineD(-40, 0, 12, a)} w="d" />
        <S d={lineD(-40, 0, -80, a * 0.9 + 8) + lineD(-40, 0, -80, -(a * 0.9 + 8))} w="d" />
        <S d={`M-80 ${a * 0.9 + 8}a17 11 0 1 0 -34 6a17 11 0 1 0 34 -6ZM-80 ${-(a * 0.9 + 8)}a17 11 0 1 1 -34 -6a17 11 0 1 1 34 6Z`} w="d" />
        <S d={circD(-40, 0, 3.5)} w="t" fill="paper" />
      </g>
      {/* yankı: gemi (koni) → yer (çanak) → gemi */}
      <S d="M626 134L640 104L654 134Q640 140 626 134Z" p={io(seg(echo1, 0, 0.35))} w="d" />
      <S d="M802 112Q820 136 838 112M820 124V140M806 140H834" p={io(seg(echo1, 0.1, 0.4))} w="d" />
      <Arrow pts={bez([658, 108], [700, 58], [766, 56], [804, 100], 20)} p={io(seg(echo1, 0.2, 1))} w="t" size={12} />
      <Arrow pts={bez([806, 148], [770, 190], [704, 192], [656, 142], 20)} p={io(echo2)} w="t" size={12} />
    </g>
  );
};

/* ---------- yandan görünüş (FIG. 2, 3, 5, 6, 7): kutu + sırayla eklenen parçalar ---------- */
export type ElevProps = {
  beltTop?: number; beltBot?: number;   // bant kemerleri (yapışkan yüz dışa)
  sticky?: number;                      // yapışkan yüzün dışa baktığını gösteren oklar
  beltDim?: number;                     // iki kemer arası ölçü çizgisi (rakamsız)
  arch?: number;                        // karton kemer
  plug?: number;                        // tabandaki tıkaç (yandan: taban ortasında taralı çıkıntı + bant)
  bag?: number; bagDrop?: number;       // torba: çizilme, yukarıdan inme (1 = oturmuş)
  press?: number;                       // torba yanlarının kemerlere bastırılması (1 = yapışık)
  wrap?: number;                        // dıştan bant
  corner?: number; hose?: number;       // kesik köşe, hortum
  socket?: number;                      // LM'in yuvarlak yuvası
  flow?: number;                        // hava yolu okları: taban → granül → kemer altı → köşe → hortum → yuva
  hl?: number;                          // kare ve yuvarlak vurgusu
};
const HOSE: Pt[] = [...bez([608, 116], [680, 36], [792, 56], [810, 176], 28), [810, 270]];
const ARCH_OUT = bez([360, 218], [372, 118], [588, 118], [600, 218], 28), ARCH_IN = bez([373, 218], [385, 133], [575, 133], [587, 218], 28);
const FLOW_MAIN: Pt[] = [[430, 532], [430, 235], ...bez([430, 235], [430, 152], [540, 130], [604, 118], 16).slice(1), ...HOSE.slice(1), [810, 322]];
const FLOW_SIDE: Pt[] = [[540, 532], [540, 240], ...bez([540, 240], [540, 176], [574, 144], [600, 124], 12).slice(1)];

const Belt: React.FC<{ y: number; p: number }> = ({ y, p }) => {
  const pen = usePen();
  if (p <= 0) return null;
  const n = 13, shown = Math.floor(n * seg(p, 0.5, 1));
  return (
    <g>
      <S d={`M343 ${y}H617V${y + 30}H343Z`} p={io(seg(p, 0, 0.8))} w="d" fill="paper" />
      {Array.from({ length: shown }, (_, i) => <circle key={i} cx={358 + i * 20.3} cy={y + 15 + (i % 2 ? 4 : -4)} r={1.9 * pen.k} fill={pen.line} />)}
    </g>
  );
};
const Sticky: React.FC<{ y: number; p: number }> = ({ y, p }) => (
  <g>
    <Arrow pts={[[624, y + 15], [668, y + 15]]} p={seg(p, 0, 0.7)} w="t" size={11} />
    <Arrow pts={[[336, y + 15], [292, y + 15]]} p={seg(p, 0.3, 1)} w="t" size={11} />
  </g>
);

export const Elevation: React.FC<ElevProps> = ({
  beltTop = 0, beltBot = 0, sticky = 0, beltDim = 0, arch = 0, plug = 0, bag = 0, bagDrop = 1, press = 1, wrap = 0, corner = 0, hose = 0, socket = 0, flow = 0, hl = 0,
}) => {
  const pen = usePen();
  const flare = 16 * (1 - press), lift = (bagDrop - 1) * 270;
  const fm = io(flow);
  return (
    <g>
      {/* eksen */}
      <S d={lineD(480, 84, 480, 506)} w="h" dash={DASH.center} len={422} o={0.7} />
      {/* yuvarlak yuva (karşıdan) */}
      {socket > 0 && (
        <g>
          <S d={circD(810, 334, 62)} p={io(seg(socket, 0, 0.7))} w="o" fill="paper" />
          <S d={circD(810, 334, 47)} p={io(seg(socket, 0.3, 1))} w="d" />
          <S d={lineD(732, 334, 888, 334) + lineD(810, 256, 810, 412)} w="h" dash={DASH.center} len={156} o={0.7 * seg(socket, 0.6, 1)} />
        </g>
      )}
      {/* A: kutu */}
      <S d={rectD(350, 215, 260, 250, 14)} w="o" fill="paper" />
      <S d={lineD(353, 231, 607, 231) + lineD(353, 449, 607, 449)} w="t" />
      <S d={lineD(456, 465, 456, 438) + lineD(504, 465, 504, 438)} w="h" dash={DASH.hidden} len={27} />
      {/* tıkaç + bant */}
      {plug > 0 && (
        <g>
          <S d={rectD(452, 456, 56, 18, 4)} p={io(seg(plug, 0, 0.7))} w="d" fill="paper" />
          <rect x={452} y={456} width={56} height={18} rx={4} fill={HATCH.cross} opacity={seg(plug, 0.4, 0.9)} />
          <S d="M434 478H526" p={seg(plug, 0.6, 1)} w="o" />
        </g>
      )}
      <Belt y={255} p={beltTop} />
      <Belt y={395} p={beltBot} />
      <Sticky y={255} p={Math.min(sticky, seg(beltTop, 0.8, 1))} />
      <Sticky y={395} p={Math.min(sticky, seg(beltBot, 0.7, 1))} />
      <Dim a={[306, 270]} b={[306, 410]} p={beltDim} tick={9} />
      {/* karton kemer */}
      {arch > 0 && (
        <g>
          <PL pts={ARCH_OUT} p={io(seg(arch, 0, 0.75))} w="o" />
          <PL pts={ARCH_IN} p={io(seg(arch, 0.2, 0.95))} w="t" />
          <S d={lineD(360, 218, 373, 218) + lineD(587, 218, 600, 218)} p={seg(arch, 0.85, 1)} w="d" />
        </g>
      )}
      {/* torba: kemerin üstünden, yanları iki kemere */}
      {bag > 0 && (
        <g transform={`translate(0 ${lift})`}>
          <S d={`M${336 - flare} 432L332 182Q330 110 394 103L566 103Q632 110 628 182L${624 + flare} 432`} p={io(bag)} w="o" fill={pen.line} fillO={0.06} />
          <S d="M352 150q16 -22 44 -26M606 196q6 40 -2 78M348 300q-4 40 2 84" p={seg(bag, 0.7, 1)} w="h" />
        </g>
      )}
      {bag > 0 && press > 0 && press < 1 && [270, 410].map((y) => (
        <g key={y} opacity={Math.sin(Math.PI * press)}>
          <Arrow pts={[[286, y], [322, y]]} w="t" size={11} />
          <Arrow pts={[[674, y], [638, y]]} w="t" size={11} />
        </g>
      ))}
      {/* dıştan bant */}
      {wrap > 0 && [250, 390].map((y, i) => {
        const p = seg(wrap, i * 0.35, 0.65 + i * 0.35);
        return (
          <Sweep key={y} x={324} y={y - 4} w={312} h={48} p={io(p)}>
            <rect x={327} y={y} width={306} height={40} rx={3} fill={pen.paper} />
            <rect x={327} y={y} width={306} height={40} rx={3} fill={HATCH.fine} />
            <S d={rectD(327, y, 306, 40, 3)} w="d" />
          </Sweep>
        );
      })}
      {/* kesik köşe + hortum + ek yerinde bant */}
      <S d={lineD(592, 96, 634, 140)} p={seg(corner, 0, 1)} w="d" dash={[7, 5]} len={60} />
      <Hose pts={HOSE} p={io(hose)} />
      {hose > 0.8 && [0.035, 0.06, 0.085].map((t) => {
        const c = pointAt(HOSE, t), nx = -Math.sin(c.ang) * 15, ny = Math.cos(c.ang) * 15;
        return <S key={t} d={lineD(c.x - nx, c.y - ny, c.x + nx, c.y + ny)} w="o" o={seg(hose, 0.8, 1)} />;
      })}
      {/* hava yolu */}
      {flow > 0 && (
        <g>
          <Arrow pts={FLOW_SIDE} p={io(seg(flow, 0, 0.5))} w="t" dash={DASH.flow} size={12} />
          <PL pts={FLOW_MAIN} p={fm} w="d" dash={DASH.flow} />
          {[0.07, 0.2, 0.34, 0.5, 0.66, 0.82].map((t) => {
            if (fm < t) return null;
            const c = pointAt(FLOW_MAIN, t);
            return <Head key={t} x={c.x} y={c.y} ang={c.ang} size={14} o={seg(fm, t, t + 0.05)} />;
          })}
          {(() => { const c = pointAt(FLOW_MAIN, fm); return <Head x={c.x} y={c.y} ang={c.ang} size={16} />; })()}
        </g>
      )}
      {/* vurgu: kare kutu ve yuvarlak yuva, hortumla birleşmiş */}
      {hl > 0 && (
        <g>
          <S d={rectD(350, 215, 260, 250, 14)} p={io(seg(hl, 0, 0.7))} w={6.5} color={pen.accent} />
          <S d={circD(810, 334, 62)} p={io(seg(hl, 0.3, 1))} w={6.5} color={pen.accent} />
        </g>
      )}
    </g>
  );
};

/* ---------- FIG. 4: taban (alttan görünüş), ortada bypass deliği ---------- */
export const BaseView: React.FC<{ ink?: number; arrows?: number; plugOutline?: number; plug?: number }> = ({ ink = 1, arrows = 0, plugOutline = 0, plug = 0 }) => {
  const pen = usePen();
  const cx = 480, cy = 235;
  const dots: Pt[] = [];
  for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) if (Math.hypot(i, j) * 27 > 60) dots.push([cx + i * 27, cy + j * 27]);
  return (
    <g>
      <S d={rectD(323, 78, 314, 314, 30)} p={seg(ink, 0.2, 0.7)} w="t" />
      <S d={rectD(330, 85, 300, 300, 26)} p={io(seg(ink, 0, 0.6))} w="o" fill="paper" />
      <S d={rectD(348, 103, 264, 264, 16)} p={seg(ink, 0.3, 0.8)} w="t" />
      <g opacity={seg(ink, 0.5, 1)}>
        {dots.map((d, i) => <circle key={i} cx={d[0]} cy={d[1]} r={4.4} fill="none" stroke={pen.line} strokeWidth={1.3 * pen.k} />)}
      </g>
      <S d={lineD(296, cy, 664, cy) + lineD(cx, 52, cx, 418)} w="h" dash={DASH.center} len={368} o={0.7 * seg(ink, 0.6, 1)} />
      {/* bypass deliği */}
      <path d={circD(cx, cy, 40)} fill="rgba(4,12,28,0.45)" opacity={seg(ink, 0.5, 0.9)} />
      <S d={circD(cx, cy, 40)} p={io(seg(ink, 0.4, 0.9))} w="o" />
      {/* hava kolay yolu seçer: granülleri atlayıp delikten kaçar */}
      {arrows > 0 && ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as Pt[]).map(([sx, sy], i) => (
        <Arrow key={i} pts={bez([cx + sx * 132, cy + sy * 132], [cx + sx * 132, cy + sy * 44], [cx + sx * 78, cy + sy * 14], [cx + sx * 22, cy + sy * 10], 18)}
          p={io(seg(arrows, i * 0.12, 0.64 + i * 0.12))} w="d" color={pen.accent} size={15} />
      ))}
      {/* boş tıkaç çerçevesi */}
      <S d={circD(cx, cy, 55)} p={plugOutline} w="d" dash={DASH.hidden} len={346} />
      {/* tıkaç yerinde: taralı tomar + üstünde bant şeridi */}
      {plug > 0 && (
        <g>
          <S d={circD(cx, cy, 47)} p={io(seg(plug, 0, 0.6))} w="o" fill="paper" />
          <path d={circD(cx, cy, 47)} fill={HATCH.cross} opacity={seg(plug, 0.3, 0.8)} />
          <Sweep x={396} y={216} w={168} h={38} p={seg(plug, 0.6, 1)}>
            <rect x={398} y={218} width={164} height={34} fill={pen.paper} />
            <rect x={398} y={218} width={164} height={34} fill={HATCH.fine} />
            <S d={rectD(398, 218, 164, 34)} w="d" />
          </Sweep>
        </g>
      )}
    </g>
  );
};

/* ---------- bitmiş adımlar (küçük FIG. kutuları) ---------- */
export const FIG_COUNT = 8;
export const FigFinal: React.FC<{ n: number }> = ({ n }) => {
  if (n === 0) return <Fig0 />;
  if (n === 1) return <Fig1 />;
  if (n === 4) return <BaseView plug={1} />;
  const belts = { beltTop: 1, beltBot: 1 };
  if (n === 2) return <Elevation {...belts} sticky={1} beltDim={1} />;
  if (n === 3) return <Elevation {...belts} arch={1} />;
  const bagged = { ...belts, arch: 1, plug: 1, bag: 1, wrap: 1 };
  if (n === 5) return <Elevation {...bagged} />;
  if (n === 6) return <Elevation {...bagged} corner={1} hose={1} />;
  return <Elevation {...bagged} corner={1} hose={1} socket={1} flow={1} hl={1} />;
};
