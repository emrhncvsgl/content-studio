import { AbsoluteFill, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { StyleProps } from "../../schema/timeline";
import { INTER } from "../../fonts";

// footage (catalog/styles.yaml, 2026-11-09 IYH001): gerçek saha videosu (kanalın kendi çekimleri). Bir sahnede 1-n klip art arda, yumuşak
// geçişle (xf kare). props:
//   clips: [{ video: "channels/<id>/refs/yt/<id>.mp4", from: sn, dur?: sn (yoksa sahneyi eşit böler), focus?: {x,y} (0-1, kadraj odağı),
//             zoom?: [başlangıç, bitiş] (vars. [1.04, 1.12] ağır itme) }]
//   grade: { saturate, contrast, brightness, warmth (0-1 sıcak ton) }   · volume: klibin kendi sesi (dB, vars. sessiz; ortam sesi için ≈ −20)
//   xf: klipler arası çapraz geçiş karesi (vars. 10) · vignette: 0-1 (vars. 0.35)
// Kaynak kliplerde gömülü yazı (altyazı, etiket) varsa o aralığı seçme ya da focus/zoom ile kadraj dışına it (storyboard'da not).
//   clips[].band: { y, h, title?, sub? }: kaynak klipteki gömülü yazı bandını örten bulanık arkalıklı şerit (0-1, kadraja göre); title/sub
//   varsa kanal tarzı konum etiketi (yer adı büyük aralıklı harf + alt satır). Örtülen yazı kanalın kendi altyazısıdır, bizim altyazımız alttadır.
type Band = { y: number; h: number; title?: string; sub?: string };
type Clip = { video: string; from?: number; dur?: number; focus?: { x: number; y: number }; zoom?: [number, number]; band?: Band };

export const Footage: React.FC<StyleProps> = ({ scene, props }) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const clips = (props.clips as Clip[]) ?? [];
  const xf = (props.xf as number) ?? 10;
  const g = { saturate: 1, contrast: 1.04, brightness: 1, warmth: 0.15, ...(props.grade as object) } as Record<string, number>;
  const vol = props.volume === undefined ? 0 : Math.pow(10, (props.volume as number) / 20);
  const total = scene.durationFrames;
  const fixed = clips.reduce((s, c) => s + (c.dur ? Math.round(c.dur * fps) : 0), 0);
  const free = clips.filter((c) => !c.dur).length;
  const each = free ? Math.max(1, Math.round((total - fixed) / free)) : 0;
  let at = 0;
  const filter = `saturate(${g.saturate}) contrast(${g.contrast}) brightness(${g.brightness}) sepia(${g.warmth * 0.35})`;
  return (
    <AbsoluteFill style={{ backgroundColor: "#0E1A16" }}>
      {clips.map((c, k) => {
        const len = c.dur ? Math.round(c.dur * fps) : each;
        const start = at;
        at += len;
        const dur = len + (k < clips.length - 1 ? xf : 0);
        const local = frame - start;
        const op = k === 0 ? 1 : interpolate(local, [0, xf], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const [z0, z1] = c.zoom ?? [1.04, 1.12];
        const z = interpolate(local, [0, dur], [z0, z1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const f = c.focus ?? { x: 0.5, y: 0.5 };
        return (
          <Sequence key={k} from={start} durationInFrames={dur} layout="none">
            <AbsoluteFill style={{ opacity: op, overflow: "hidden" }}>
              <OffthreadVideo src={staticFile(c.video)} startFrom={Math.round((c.from ?? 0) * fps)} volume={vol} muted={vol === 0}
                style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${z})`, transformOrigin: `${f.x * 100}% ${f.y * 100}%`, filter }} />
              {c.band && (
                <div style={{ position: "absolute", left: 0, right: 0, top: `${c.band.y * 100}%`, height: `${c.band.h * 100}%`,
                  backdropFilter: "blur(26px) saturate(0.9)", background: "rgba(10,40,30,0.38)", display: "flex", flexDirection: "column",
                  justifyContent: "center", alignItems: "center", gap: 10, color: "#fff", fontFamily: INTER,
                  maskImage: "linear-gradient(180deg, transparent 0%, #000 18%, #000 82%, transparent 100%)" }}>
                  {c.band.title && <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: 14, textShadow: "0 3px 12px rgba(0,0,0,0.5)" }}>{c.band.title}</div>}
                  {c.band.sub && <div style={{ fontSize: 34, fontWeight: 500, letterSpacing: 2, opacity: 0.92 }}>{c.band.sub}</div>}
                </div>
              )}
            </AbsoluteFill>
          </Sequence>
        );
      })}
      <AbsoluteFill style={{ boxShadow: `inset 0 0 260px rgba(0,0,0,${(props.vignette as number) ?? 0.35})`, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
