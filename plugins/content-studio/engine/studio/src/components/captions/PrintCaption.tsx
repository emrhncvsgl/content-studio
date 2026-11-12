import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { Word } from "../../schema/timeline";
import { FELL_SC } from "../../fonts";
import { activeStarts, paginate } from "./Karaoke";

// cap-print (EP014 v4, 2026-11-12; direction.yaml captions: serif): dönem matbaa harfi. IM Fell English SC (1800'ler baskı harfi, ağaç baskı/arşivle
// uyumlu), kemik rengi harf + koyu kontur (paint-order: stroke) + yumuşak gölge; konuşulan kelime marka sarısı. Şerit/kâğıt yok.
// Bölüm bazında seçilir: script.<dil>.json "captions": "cap-print" (build_timeline); kanal varsayılanı değişmez.
const BONE = "#F2E8D5", INK = "#0E0C0A", HI = "#F9D509";

export const PrintCaption: React.FC<{ words: Word[] }> = ({ words }) => {
  const frame = useCurrentFrame();
  const { fps, height, width } = useVideoConfig();
  const land = width > height;
  const ms = (frame / fps) * 1000;
  const pages = paginate(words);
  const page = [...pages].reverse().find((p) => ms >= p[0].startMs - 80 && ms < p[p.length - 1].endMs + 250);
  if (!page) return null;
  const starts = activeStarts(page);
  let active = -1;
  starts.forEach((s, k) => { if (ms >= s) active = k; });
  const enter = interpolate(ms - page[0].startMs, [-80, 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const size = land ? 72 : 104;
  return (
    <AbsoluteFill style={{ top: height * (land ? 0.77 : 0.6), height: height * (land ? 0.17 : 0.18), justifyContent: "center", alignItems: "center",
      paddingLeft: land ? 160 : 80, paddingRight: land ? 160 : 120 }}>
      {/* parlak sahnede (fener ışığı) okunurluk: metnin arkasında yumuşak koyu mürekkep lekesi */}
      <div style={{ position: "absolute", left: "4%", right: "4%", top: "8%", bottom: "8%", opacity: 0.35 + 0.65 * enter,
        background: "radial-gradient(ellipse 50% 50% at 50% 50%, rgba(10,8,6,0.8), rgba(10,8,6,0.5) 55%, rgba(10,8,6,0) 100%)" }} />
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "baseline", columnGap: size * 0.3, rowGap: size * 0.05,
        maxWidth: land ? 1500 : 880, opacity: 0.35 + 0.65 * enter, transform: `translateY(${(1 - enter) * 8}px)` }}>
        {page.map((w, k) => (
          <span key={k} style={{ fontFamily: FELL_SC, fontSize: size, lineHeight: 1.08, letterSpacing: 1, color: k === active ? HI : BONE,
            WebkitTextStroke: `${Math.round(size * 0.14)}px ${INK}`, paintOrder: "stroke fill",
            textShadow: `0 ${Math.round(size * 0.06)}px ${Math.round(size * 0.16)}px rgba(0,0,0,0.75)` }}>{w.text}</span>
        ))}
      </div>
    </AbsoluteFill>
  );
};
