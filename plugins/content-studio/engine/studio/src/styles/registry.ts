import type React from "react";
import type { StyleProps } from "../schema/timeline";
import { BlueprintDiagram } from "./blueprint-diagram";
import { KineticType } from "./kinetic-type";
import { KenBurnsPhoto } from "./ken-burns-photo";
import { ArchivalFilm } from "./archival-film";
import { VoxExplainer } from "./vox-explainer";
import { ManimClip } from "./manim";
import { WoodcutClip } from "./woodcut";
import { Footage } from "./footage";

// Stil kaydı: catalog/styles.yaml id → bileşen. Yeni stil = buraya bir satır + studio/src/styles/<id>/ (PLAN ilke 4).
// ownsText: stil metni kendisi gösteriyorsa altyazı katmanı o sahnede kapanır.
export const STYLES: Record<string, { component: React.FC<StyleProps>; ownsText: boolean }> = {
  "blueprint-diagram": { component: BlueprintDiagram, ownsText: false },
  "kinetic-type": { component: KineticType, ownsText: true },
  "ken-burns-photo": { component: KenBurnsPhoto, ownsText: false },
  "archival-film": { component: ArchivalFilm, ownsText: false },
  "vox-explainer": { component: VoxExplainer, ownsText: false },
  manim: { component: ManimClip, ownsText: false },
  woodcut: { component: WoodcutClip, ownsText: false },
  object3d: { component: WoodcutClip, ownsText: false },
  "depth-photo": { component: WoodcutClip, ownsText: false },   // DepthPhoto klibi (çok katmanlı derinlik 2.5D)   // MuseumObject klibi (tools/woodcut_render.py), aynı oynatıcı
  footage: { component: Footage, ownsText: false },
  lantern: { component: WoodcutClip, ownsText: false },
  "lantern-text": { component: WoodcutClip, ownsText: true },   // klipte kâğıt yazı var: altyazı aynı kelimeleri tekrarlamaz (Lemo §4)   // paper-lantern: sahne ayrı kompozisyonda render edilir (tools/scene_render.py), burada klip oynar
};
