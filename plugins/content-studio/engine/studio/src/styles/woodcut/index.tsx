import { AbsoluteFill, OffthreadVideo, staticFile } from "remotion";
import type { StyleProps } from "../../schema/timeline";

// woodcut (catalog/styles.yaml): three.js ağaç baskı sahnesi ayrı bir kompozisyon olarak (ör. WoodcutMatch) sahnenin kendi süresinde render
// edilir (tools/woodcut_render.py <EP> → episodes/<EP>/assets/woodcut/<sid>.mp4), burada yalnızca oynatılır (Manim ile aynı yol: uzun
// ana render'da WebGL yok). props: { comp: "WoodcutMatch", video: "episodes/<EP>/assets/woodcut/<sid>.mp4" }. Kâğıt payı klibin içinde.
export const WoodcutClip: React.FC<StyleProps> = ({ props }) => (
  <AbsoluteFill style={{ backgroundColor: "#e8dcc1" }}>
    {props.video ? <OffthreadVideo src={staticFile(props.video as string)} muted style={{ width: "100%", height: "100%" }} /> : null}
  </AbsoluteFill>
);
