import { useEffect, useState } from "react";
import {
  AbsoluteFill, Audio, continueRender, delayRender, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig,
} from "remotion";
import { z } from "zod";

// Kurulum duman testi: ses + kelime zamanlı altyazı + basit blueprint çizimi.
// Kelime zamanları voice/synth.py report.json'dan gelir (sahne içi ms); anlatımda sahneler 0.35 sn boşlukla dizilir.
export const smokeSchema = z.object({ audio: z.string(), report: z.string() });

type Word = { text: string; startMs: number; endMs: number };
type Take = { take: number; audio_s: number; words: Word[] };
type Scene = { id: string; chosen: number; takes: Take[] };
const GAP_S = 0.35;

function useWords(reportPath: string) {
  const [words, setWords] = useState<Word[] | null>(null);
  const [handle] = useState(() => delayRender("report.json"));
  useEffect(() => {
    fetch(staticFile(reportPath))
      .then((r) => r.json())
      .then((rep: { scenes: Scene[] }) => {
        let offset = 0;
        const all: Word[] = [];
        for (const sc of rep.scenes) {
          const t = sc.takes.find((x) => x.take === sc.chosen)!;
          for (const w of t.words) all.push({ text: w.text, startMs: w.startMs + offset * 1000, endMs: w.endMs + offset * 1000 });
          offset += t.audio_s + GAP_S;
        }
        setWords(all);
        continueRender(handle);
      });
  }, [reportPath, handle]);
  return words;
}

const Blueprint: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const split = spring({ frame: frame % (fps * 4), fps, config: { damping: 14 } }) * 60;
  return (
    <AbsoluteFill style={{ backgroundColor: "#16437E" }}>
      <svg width="1080" height="1920" viewBox="0 0 1080 1920">
        {Array.from({ length: 46 }, (_, i) => (
          <line key={`v${i}`} x1={i * 24} y1={0} x2={i * 24} y2={1920} stroke="rgba(255,255,255,0.08)" />
        ))}
        {Array.from({ length: 80 }, (_, i) => (
          <line key={`h${i}`} x1={0} y1={i * 24} x2={1080} y2={i * 24} stroke="rgba(255,255,255,0.08)" />
        ))}
        {[-1, 0, 1].map((k) => (
          <rect key={k} x={540 - 110 + k * (230 + split)} y={620} width={220} height={320} fill="none" stroke="#EAF2FF" strokeWidth={6} />
        ))}
        <text x={120} y={200} fill="#EAF2FF" fontFamily="Menlo, monospace" fontSize={44}>FIG. 1</text>
      </svg>
    </AbsoluteFill>
  );
};

const Captions: React.FC<{ words: Word[] }> = ({ words }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (frame / fps) * 1000;
  const i = words.findIndex((w) => ms >= w.startMs && ms < w.endMs);
  if (i < 0) return null;
  const start = Math.floor(i / 4) * 4; // 4 kelimelik sayfalar
  const page = words.slice(start, start + 4);
  const pop = interpolate(ms - words[i].startMs, [0, 120], [0.85, 1], { extrapolateRight: "clamp" });
  return (
    // güvenli bölge: alt %20 ve sağ kenar boş
    <AbsoluteFill style={{ top: 1220, height: 260, paddingInline: 90, paddingRight: 160, justifyContent: "center", alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 18 }}>
      {page.map((w, k) => (
        <span key={k} style={{
          fontFamily: "Avenir Next, Helvetica, sans-serif", fontWeight: 800, fontSize: 76,
          color: start + k === i ? "#F2B544" : "#FFFFFF", transform: start + k === i ? `scale(${pop})` : undefined,
          textShadow: "0 4px 18px rgba(0,0,0,0.45)",
        }}>{w.text}</span>
      ))}
    </AbsoluteFill>
  );
};

export const Smoke: React.FC<z.infer<typeof smokeSchema>> = ({ audio, report }) => {
  const words = useWords(report);
  return (
    <AbsoluteFill>
      <Blueprint />
      {words && <Captions words={words} />}
      <Audio src={staticFile(audio)} />
    </AbsoluteFill>
  );
};
