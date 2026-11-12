// ManaPromo için ayrı giriş: Root.tsx'teki google-fonts (Inter vb.) ağ yüklemesini atlar (render_promo.mjs kullanır).
import React from "react";
import { Composition, registerRoot } from "remotion";
import { ManaPromo, manaPromoSchema, loadPromo } from "./compositions/ManaPromo";

const PromoRoot: React.FC = () =>
  React.createElement(Composition, {
    id: "ManaPromo", component: ManaPromo, schema: manaPromoSchema, fps: 30, width: 1080, height: 1920, durationInFrames: 30,
    defaultProps: { config: "episodes/MANA001-gokceada-kuzu-tandir/clips/promo.json" },
    calculateMetadata: async ({ props }: { props: { config: string } }) => {
      const data = await loadPromo(props.config);
      const frames = Math.round(data.cuts[data.cuts.length - 1] * data.fps);
      return { durationInFrames: frames, fps: data.fps, props: { ...props, data } };
    },
  } as never);

registerRoot(PromoRoot);
