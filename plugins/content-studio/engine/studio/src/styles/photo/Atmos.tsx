import { AbsoluteFill } from "remotion";

// Fotoğraf stillerinde atmosfer katmanları (EP006 s01 fırtına gecesi; planes olmayan fotoğrafa derinlik):
// props.mist: { opacity (0.55), color ("#C9D2DA"), speed (1), low (0.55: sis bandının dikey merkezi, kare oranı), spread (0.35) }
//   kameranın önünde iki hızda sürüklenen sis/serpinti bandı (yakın katman hızlı ve bulanık, uzak katman yavaş) → ön düzlem.
// props.lightning: { at: [ms, …], strength (0.85), color ("#DCE6FF"), x (0.7), y (0.05) }: şimşek; her çakış ~0.45 sn'de iki kez yanıp
//   söner (ikinci zayıf), ekran (screen) karışımı, kaynağa yakın daha parlak. Ağırbaşlı konuda kullanma.
export const Mist: React.FC<{ o: { opacity?: number; color?: string; speed?: number; low?: number; spread?: number }; t: number; W: number; H: number }> = ({ o, t, W, H }) => {
  const hex = (o.color ?? "#C9D2DA").replace("#", ""), rgb = [0, 2, 4].map((k) => (parseInt(hex.slice(k, k + 2), 16) / 255).toFixed(3));
  const low = o.low ?? 0.55, spread = o.spread ?? 0.35, sp = o.speed ?? 1;
  const layer = (speed: number, freq: string, seed: number, op: number, blur: number) => {
    const x = -((t * 60 * speed * sp) % (W * 1.2));
    return (
      <svg key={seed} width={W * 2.4} height={H} style={{ position: "absolute", left: x, top: 0, opacity: op, filter: blur ? `blur(${blur}px)` : undefined }}>
        <defs>
          <filter id={`mist${seed}`} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency={freq} numOctaves={4} seed={seed} />
            <feColorMatrix type="matrix" values={`0 0 0 0 ${rgb[0]}  0 0 0 0 ${rgb[1]}  0 0 0 0 ${rgb[2]}  0 0 0 1.9 -0.6`} />
          </filter>
          <linearGradient id={`mistg${seed}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset={`${Math.max(0, (low - spread) * 100)}%`} stopColor="#fff" stopOpacity={0} />
            <stop offset={`${low * 100}%`} stopColor="#fff" stopOpacity={1} />
            <stop offset={`${Math.min(100, (low + spread) * 100)}%`} stopColor="#fff" stopOpacity={0.6} />
          </linearGradient>
          <mask id={`mistk${seed}`}><rect width="100%" height="100%" fill={`url(#mistg${seed})`} /></mask>
        </defs>
        <g mask={`url(#mistk${seed})`}>
          <rect width="100%" height="100%" filter={`url(#mist${seed})`} />
        </g>
      </svg>
    );
  };
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden", opacity: o.opacity ?? 0.55 }}>
      {layer(0.5, "0.0025 0.008", 21, 0.7, 2)}
      {layer(1.6, "0.0016 0.005", 29, 0.9, 10)}
    </AbsoluteFill>
  );
};

export function lightningAt(o: { at?: number[]; strength?: number } | undefined, ms: number) {
  if (!o?.at) return 0;
  let v = 0;
  for (const a of o.at) {
    const d = ms - a;
    if (d < 0 || d > 700) continue;
    const f1 = d < 60 ? d / 60 : Math.exp(-(d - 60) / 70);           // ilk çakış
    const f2 = d > 180 ? 0.6 * Math.exp(-Math.abs(d - 230) / 60) : 0;  // ikinci, zayıf
    v = Math.max(v, f1, f2);
  }
  return v * (o.strength ?? 0.85);
}
export const Lightning: React.FC<{ o: { color?: string; x?: number; y?: number }; v: number }> = ({ o, v }) =>
  v > 0.01 ? (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "screen", opacity: v,
      background: `radial-gradient(ellipse 90% 70% at ${(o.x ?? 0.7) * 100}% ${(o.y ?? 0.05) * 100}%, ${o.color ?? "#DCE6FF"} 0%, ${o.color ?? "#DCE6FF"}99 35%, rgba(0,0,0,0) 85%)` }} />
  ) : null;
