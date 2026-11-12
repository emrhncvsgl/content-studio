import { AbsoluteFill } from "remotion";
import { z } from "zod";
import { VoxExplainer } from "../styles/vox-explainer";

// Kapak görseli: vox-explainer stilini tek kare olarak çizer (props = stilin props'u; zamanlar ms, render --frame ile sonraki bir kare seçilir).
// Render: npx remotion still src/index.ts Cover out.png --frame=60 --props=<cover.json>
export const coverSchema = z.object({
  style: z.record(z.string(), z.unknown()),
  theme: z.object({ primary: z.string(), accent: z.string(), background: z.string(), text: z.string(), font: z.string() }).optional(),
});

const THEME = { primary: "#1F4E8C", accent: "#F2A93B", background: "#0B1726", text: "#F5F7FA", font: "Inter" };

export const Cover: React.FC<z.infer<typeof coverSchema>> = ({ style, theme }) => (
  <AbsoluteFill>
    <VoxExplainer
      scene={{ id: "s00", startFrame: 0, durationFrames: 90, audio: {}, words: {}, text: {}, emotion: "calm", style: "vox-explainer", props: style, transition: "cut" }}
      words={[]} props={style} lang="en" theme={theme ?? THEME} index={0}
    />
  </AbsoluteFill>
);
