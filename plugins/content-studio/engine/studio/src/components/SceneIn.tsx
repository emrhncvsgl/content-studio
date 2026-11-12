import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

// Sahne girişi: süreyi değiştirmez (Sequence sınırları ve ses senkronu aynı kalır). PLAN 8.4: çoğunlukla sert kesme.
// zoom: hızlı yakınlaşma (zoom punch) · wipe: soldan maskeyle açılış · flash: kısa beyaz parlama · cut: yok
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// blur çıkışı: sonraki sahne "blur" ile giriyorsa bu sahnenin son BLUR_OUT karesi bulanıklaşır (outFrom = sahne süresi − BLUR_OUT)
export const BLUR_OUT = 8;
const BLUR_IN = 10;

export const SceneIn: React.FC<{ type: string; accent: string; children: React.ReactNode; outFrom?: number }> = ({ type, accent, children, outFrom }) => {
  const f = useCurrentFrame();
  if (outFrom !== undefined && f >= outFrom) {
    const q = interpolate(f, [outFrom, outFrom + BLUR_OUT], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
    return <AbsoluteFill style={{ transform: `scale(${1 + 0.07 * q})`, filter: `blur(${28 * q}px) brightness(${1 + 0.12 * q})` }}>{inner(type, accent, children, f)}</AbsoluteFill>;
  }
  return inner(type, accent, children, f);
};

function inner(type: string, accent: string, children: React.ReactNode, f: number) {
  if (type === "blur") {
    const q = interpolate(f, [0, BLUR_IN], [1, 0], { ...clamp, easing: Easing.out(Easing.cubic) });
    return <AbsoluteFill style={{ transform: `scale(${1 + 0.07 * q})`, filter: q > 0.01 ? `blur(${28 * q}px) brightness(${1 + 0.12 * q})` : undefined }}>{children}</AbsoluteFill>;
  }
  if (type === "zoom") {
    const s = interpolate(f, [0, 8], [1.14, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
    const blur = interpolate(f, [0, 6], [6, 0], clamp);
    return <AbsoluteFill style={{ transform: `scale(${s})`, filter: blur > 0.1 ? `blur(${blur}px)` : undefined }}>{children}</AbsoluteFill>;
  }
  if (type === "wipe") {
    const p = interpolate(f, [0, 9], [100, 0], { ...clamp, easing: Easing.inOut(Easing.cubic) });
    // koyu sahneler arasında maske kenarı görünmüyordu (EP001 kare kontrolü) → kenarda vurgu çizgisi
    return (
      <AbsoluteFill>
        <AbsoluteFill style={{ clipPath: `inset(0 ${p}% 0 0)` }}>{children}</AbsoluteFill>
        {p > 0.5 && <div style={{ position: "absolute", top: 0, bottom: 0, left: `${100 - p}%`, width: 10, marginLeft: -5, backgroundColor: accent, boxShadow: `0 0 30px ${accent}` }} />}
      </AbsoluteFill>
    );
  }
  if (type === "flash") {
    const o = interpolate(f, [0, 4], [0.75, 0], clamp);
    return (
      <AbsoluteFill>
        {children}
        <AbsoluteFill style={{ backgroundColor: "#FFFFFF", opacity: o }} />
      </AbsoluteFill>
    );
  }
  return <AbsoluteFill>{children}</AbsoluteFill>;
}
