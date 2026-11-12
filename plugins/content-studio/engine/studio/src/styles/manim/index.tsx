import { AbsoluteFill, Img, OffthreadVideo, staticFile } from "remotion";
import type { StyleProps } from "../../schema/timeline";

// manim (catalog/styles.yaml): Manim CE ile ayrıca render edilmiş fizik animasyonu (episodes/<EP>/manim/*.py → assets/manim/<sid>.mp4).
// Kelime zamanları Manim tarafında report.json'dan okunur; burada yalnızca oynatılır (sessiz). props: { video, bg?, scrim? }
// scrim: açık (krem/beyaz) zeminli klipte altyazı bandının arkasını yumuşak karartır (beyaz metin krem zeminde okunmuyor; EP004 s08).
//   true = varsayılan 0.55 · sayı = en koyu opaklık. Geçiş üstte yumuşak başlar, ana öğeler (y < 0.5) etkilenmez.
// paper: { image ("textures/paper003.jpg", nötr gri), opacity (0.5), blend ("multiply") }: taranmış kâğıt dokusu klibin üstüne basılır ("kâğıt dokulu" Manim,
//   EP006). Manim zemini açık krem olmalı (multiply koyu zeminde görünmez); çizgiler kâğıda emilmiş gibi durur.
export const ManimClip: React.FC<StyleProps> = ({ props }) => {
  const s = props.scrim === true ? 0.55 : typeof props.scrim === "number" ? props.scrim : 0;
  return (
    <AbsoluteFill style={{ backgroundColor: (props.bg as string) ?? "#0B1726" }}>
      <OffthreadVideo src={staticFile(props.video as string)} muted style={{ width: "100%", height: "100%" }} />
      {!!props.paper && (() => {
        const p = { image: "textures/paper003.jpg", opacity: 0.5, blend: "multiply", ...(props.paper === true ? {} : (props.paper as object)) } as { image: string; opacity: number; blend: string };
        return <Img src={staticFile(p.image)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: p.opacity,
          mixBlendMode: p.blend as React.CSSProperties["mixBlendMode"] }} />;
      })()}
      {s > 0 ? (
        <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(40,32,24,0) 50%, rgba(40,32,24,${s * 0.8}) 60%, rgba(40,32,24,${s}) 68%, rgba(40,32,24,${s}) 77%, rgba(40,32,24,0) 90%)` }} />
      ) : null}
    </AbsoluteFill>
  );
};
