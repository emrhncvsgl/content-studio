import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { Word } from "../../schema/timeline";
import { ALFA } from "../../fonts";
import { activeStarts, paginate } from "./Karaoke";

// cap-paper: her kelime kesilmiş bir kâğıt şerit; konuşulan kelimenin şeridi marka sarısına döner. Sayfalama ve zamanlar Karaoke ile aynı.
const INK = "#14213D";
const rnd = (s: number) => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
// tools/make_caption_paper.py çıktıları: genişlik 120-900 (60 px basamak), 3 varyant, 40 px saydam pay
const paper = (color: string, chars: number, v: number) => {
  const w = Math.min(900, Math.max(120, Math.round((chars * 45 + 52) / 60) * 60));
  return staticFile(`assets/caption-paper/${color}_${w}_${v}.png`);
};

// solid (EP014 v3, kullanıcı: Lemo sahnelerinde altyazı soluk): giriş solması yok + koyu ince kontur (krem şerit krem nesne üstünde de okunur).
export const PaperStrips: React.FC<{ words: Word[]; solid?: boolean }> = ({ words, solid }) => {
  const frame = useCurrentFrame();
  const { fps, height, width } = useVideoConfig();
  const land = width > height;   // 16:9 uzun video (2026-11-08): alt bantta, daha küçük, daha geniş satır
  const ms = (frame / fps) * 1000;
  const pages = paginate(words);
  const page = [...pages].reverse().find((p) => ms >= p[0].startMs - 80 && ms < p[p.length - 1].endMs + 250);
  if (!page) return null;
  const starts = activeStarts(page);
  let active = -1;
  starts.forEach((s, k) => { if (ms >= s) active = k; });
  const enter = solid ? 1 : interpolate(ms - page[0].startMs, [-80, 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const seed = Math.round(page[0].startMs);
  return (
    <AbsoluteFill style={{ top: height * (land ? 0.77 : 0.6), height: height * (land ? 0.17 : 0.18), justifyContent: "center", alignItems: "center",
      paddingLeft: land ? 160 : 70, paddingRight: land ? 160 : 130 }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: land ? "12px 12px" : "16px 14px", maxWidth: land ? 1500 : 880,
        opacity: enter, transform: `translateY(${(1 - enter) * 12}px)`, filter: solid ? "drop-shadow(0 0 1.5px #0d0d0d) drop-shadow(0 0 1.5px #0d0d0d) drop-shadow(5px 8px 7px rgba(0,0,0,0.6))" : "drop-shadow(5px 8px 7px rgba(0,0,0,0.42))" }}>
        {page.map((w, k) => (
          <div key={k} style={{ transform: `rotate(${((rnd(seed + k * 9) - 0.5) * 4.4).toFixed(2)}deg) translateY(${((rnd(seed + k * 5) - 0.5) * 7).toFixed(1)}px)` }}>
            <div style={{ position: "relative", padding: "14px 26px 16px", fontFamily: ALFA, fontSize: land ? 54 : 72, lineHeight: 1, letterSpacing: 0.5, color: INK }}>
              <Img src={paper(k === active ? "yellow" : "cream", w.text.length, Math.floor(rnd(seed + k * 3) * 3))}
                style={{ position: "absolute", left: -40, right: -40, top: -40, bottom: -40, width: "calc(100% + 80px)", height: "calc(100% + 80px)" }} />
              <span style={{ position: "relative" }}>{w.text}</span>
            </div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
