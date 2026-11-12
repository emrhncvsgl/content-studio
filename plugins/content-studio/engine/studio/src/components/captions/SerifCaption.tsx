import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { Word } from "../../schema/timeline";
import { CORMORANT } from "../../fonts";
import { paginate } from "./Karaoke";

// cap-serif (paper-lantern; Lemo STYLE.md §4): sessiz, yanık altyazı. Sıcak kırık beyaz serif, yumuşak gölge, satırın kendisi hafifçe belirir
// (kelime vurgusu yok: hikâye anlatıcısı sakinliği). Alt koyu bantta, kenardan ~8% yukarıda; arkada çok hafif koyu bant (ışıklı bir şey oraya gelirse okunsun).
const LEAD_MS = 120, HOLD_MS = 350, FADE_MS = 220;

export const SerifCaption: React.FC<{ words: Word[] }> = ({ words }) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const ms = (frame / fps) * 1000;
  const pages = paginate(words);
  const idx = pages.findIndex((p, i) => {
    const s = p[0].startMs - LEAD_MS, e = Math.min(p[p.length - 1].endMs + HOLD_MS, pages[i + 1] ? pages[i + 1][0].startMs - LEAD_MS : Infinity);
    return ms >= s && ms < e;
  });
  if (idx < 0) return null;
  const p = pages[idx];
  const s = p[0].startMs - LEAD_MS, e = p[p.length - 1].endMs + HOLD_MS;
  const op = Math.min(interpolate(ms, [s, s + FADE_MS], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    interpolate(ms, [e - FADE_MS, e], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const y = interpolate(ms, [s, s + FADE_MS * 2], [6, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: height * 0.13 }}>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: height * 0.095, height: height * 0.11, opacity: op * 0.55,
        background: "radial-gradient(ellipse 60% 50% at 50% 55%, rgba(4,6,10,0.75), rgba(4,6,10,0))" }} />
      <div style={{ opacity: op, transform: `translateY(${y}px)`, fontFamily: CORMORANT, fontWeight: 600, fontSize: 64, lineHeight: 1.15,
        color: "#F4E9D4", letterSpacing: 0.5, textAlign: "center", maxWidth: "82%",
        textShadow: "0 2px 10px rgba(0,0,0,0.65), 0 0 2px rgba(0,0,0,0.5)" }}>
        {p.map((w) => w.text).join(" ")}
      </div>
    </AbsoluteFill>
  );
};
