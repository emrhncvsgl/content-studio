import { Audio, Sequence, interpolate, staticFile, useVideoConfig } from "remotion";
import type { Timeline } from "../../schema/timeline";

// Müzik altlığı + ducking (PLAN 8.5: müzik anlatıcının ~14 dB altında). Konuşma aralıkları sahne kelime zamanlarından;
// kelimeden 150 ms önce kısılmaya başlar, 300 ms sonra açılır; geçişler ~8 kare yumuşatılır.
const db = (x: number) => Math.pow(10, x / 20);

export function speechMask(tl: Timeline, fps: number): Float32Array {
  const mask = new Float32Array(tl.durationInFrames);
  for (const sc of tl.scenes) {
    for (const w of sc.words[tl.captions.lang] ?? []) {
      const a = sc.startFrame + Math.floor(((w.startMs - 150) / 1000) * fps);
      const b = sc.startFrame + Math.ceil(((w.endMs + 300) / 1000) * fps);
      for (let f = Math.max(0, a); f < Math.min(mask.length, b); f++) mask[f] = 1;
    }
  }
  // yumuşatma: ileri-geri doğrusal rampalar (8 kare)
  const out = new Float32Array(mask);
  for (let f = 1; f < out.length; f++) out[f] = Math.max(out[f], out[f - 1] - 1 / 8);
  for (let f = out.length - 2; f >= 0; f--) out[f] = Math.max(out[f], out[f + 1] - 1 / 8);
  return out;
}

export const MusicBed: React.FC<{ tl: Timeline }> = ({ tl }) => {
  const { fps } = useVideoConfig();
  const m = tl.music;
  if (!m) return null;
  const duck = speechMask(tl, fps);
  const total = tl.durationInFrames, start = m.startFrame ?? 0;
  return (
    <Sequence from={start} name="müzik">
    <Audio
      src={staticFile(m.file)}
      loop
      volume={(rel) => {
        const f = rel + start;
        // fade 0 olabilir (bölüm müziği build_music.py'de eğrili, EP010): interpolate kesin artan aralık ister → en az 1 kare
        const fade = interpolate(f, [start, start + Math.max(1, m.fadeInFrames), total - Math.max(1, m.fadeOutFrames), total], [0, 1, 1, 0], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp",
        });
        const s = m.steadyUntilFrame;
        const d = s !== undefined
          ? interpolate(f, [s, s + 2 * fps], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
          : duck[Math.min(Math.max(0, f), duck.length - 1)] ?? 0;
        return db(m.gainDb + d * m.duckDb) * fade;
      }}
    />
    </Sequence>
  );
};
