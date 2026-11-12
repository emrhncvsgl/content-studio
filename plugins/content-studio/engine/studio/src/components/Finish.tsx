import { AbsoluteFill, random, useCurrentFrame } from "remotion";

// Bitiş katmanı (bütün sahnelerin üstünde, altyazının altında): kenar bulanıklığı (fringe blur: mercek kenar yumuşaması + hafif renk
// saçağı), film tozu (toz zerreleri, kıl, ara sıra çizik) ve vinyet. Kaynak: script.finish → timeline.finish.
// finish: { fringe?: 0-1 (0.6), dust?: 0-1 (0.5), vignette?: 0-1 (0.45), fps?: toz değişim hızı (animFps ya da 12) }
export type FinishOpts = { fringe?: number; dust?: number; vignette?: number; fps?: number };

export const Finish: React.FC<{ o: FinishOpts; W: number; H: number; fps: number }> = ({ o, W, H, fps }) => {
  const f = useCurrentFrame();
  const fringe = o.fringe ?? 0.6, dust = o.dust ?? 0.5, vig = o.vignette ?? 0.45;
  const st = Math.floor((f / fps) * (o.fps ?? 12));   // toz bu hızda yenilenir
  const edgeMask = "radial-gradient(ellipse 62% 58% at 50% 46%, transparent 55%, black 100%)";
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {fringe > 0 && (
        <>
          {/* kenar yumuşaması: yalnızca kenarlarda bulanık (merkez net) */}
          <AbsoluteFill style={{ backdropFilter: `blur(${(5 * fringe).toFixed(1)}px)`, WebkitMaskImage: edgeMask, maskImage: edgeMask }} />
          {/* renk saçağı: kenarda kırmızı dışa, camgöbeği içe çok hafif (lateral chromatic aberration hissi) */}
          <AbsoluteFill style={{ mixBlendMode: "screen", opacity: 0.18 * fringe, WebkitMaskImage: edgeMask, maskImage: edgeMask,
            background: "radial-gradient(ellipse 70% 66% at 50% 46%, transparent 70%, rgba(255,40,30,0.9) 92%, rgba(255,60,40,0) 100%)" }} />
          <AbsoluteFill style={{ mixBlendMode: "screen", opacity: 0.14 * fringe, WebkitMaskImage: edgeMask, maskImage: edgeMask,
            background: "radial-gradient(ellipse 66% 62% at 50% 46%, transparent 66%, rgba(30,200,255,0.9) 86%, rgba(30,200,255,0) 96%)" }} />
        </>
      )}
      {vig > 0 && (
        <AbsoluteFill style={{ mixBlendMode: "multiply", background: `radial-gradient(ellipse 78% 72% at 50% 45%, rgba(0,0,0,0) 48%, rgba(0,0,0,${vig}) 100%)` }} />
      )}
      {dust > 0 && <Dust st={st} amount={dust} W={W} H={H} />}
    </AbsoluteFill>
  );
};

// Film tozu: her basamakta yeni zerreler (koyu ve açık, düzensiz), ara sıra kıl (ince kıvrık çizgi), seyrek dikey çizik
const Dust: React.FC<{ st: number; amount: number; W: number; H: number }> = ({ st, amount, W, H }) => {
  const r = (k: string) => random(`dust-${st}-${k}`);
  const n = Math.round(4 + 10 * amount * r("n"));
  const specks = Array.from({ length: n }, (_, i) => {
    const x = r(`x${i}`) * W, y = r(`y${i}`) * H, s = 1.2 + 4.5 * Math.pow(r(`s${i}`), 2.2);
    const dark = r(`d${i}`) < 0.7;
    const pts = Array.from({ length: 6 }, (_, k) => {
      const a = (k / 6) * Math.PI * 2, rr = s * (0.6 + 0.6 * r(`p${i}${k}`));
      return `${(x + Math.cos(a) * rr).toFixed(1)},${(y + Math.sin(a) * rr).toFixed(1)}`;
    }).join(" ");
    return <polygon key={i} points={pts} fill={dark ? "#14100c" : "#fbf6ea"} opacity={(0.35 + 0.45 * r(`o${i}`)) * amount + 0.1} />;
  });
  const hair = r("h") < 0.12 * amount * 2;   // seyrek kıl
  const hx = r("hx") * W, hy = r("hy") * H, hl = 30 + 70 * r("hl"), ha = r("ha") * Math.PI;
  const scratch = r("sc") < 0.05 * amount * 2;
  const sx = r("sx") * W;
  return (
    <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
      {specks}
      {hair && (
        <path d={`M${hx},${hy} q${Math.cos(ha) * hl * 0.5 + 12},${Math.sin(ha) * hl * 0.5 - 10} ${Math.cos(ha) * hl},${Math.sin(ha) * hl}`}
          stroke="#120e0a" strokeWidth={1.4} fill="none" opacity={0.55 * amount + 0.2} />
      )}
      {scratch && <rect x={sx} y={0} width={1.6} height={H} fill="#f6f1e2" opacity={0.25 * amount + 0.1} />}
    </svg>
  );
};
