import { Composition, staticFile } from "remotion";
import { getAudioDurationInSeconds } from "@remotion/media-utils";
import { z } from "zod";
import { Smoke, smokeSchema } from "./compositions/Smoke";
import { ShortsVideo, shortsSchema, loadTimeline } from "./compositions/ShortsVideo";
import { CutoutClip, cutoutSchema } from "./compositions/CutoutClip";
import { Cover, coverSchema } from "./compositions/Cover";
import { Thumbnail, thumbSchema } from "./compositions/Thumbnail";
import { ManaPromo, manaPromoSchema, loadPromo } from "./compositions/ManaPromo";
import { WoodcutMatch } from "./styles/woodcut/WoodcutMatch";
import { WoodcutCell } from "./styles/woodcut/WoodcutCell";
import { WoodcutInterrogation } from "./styles/woodcut/WoodcutInterrogation";
import { WoodcutReturn } from "./styles/woodcut/WoodcutReturn";
import { WoodcutBarracks } from "./styles/woodcut/WoodcutBarracks";
import { WoodcutClosing } from "./styles/woodcut/WoodcutClosing";
import { A13_WOODCUTS } from "./styles/woodcut/WoodcutA13";
import { WoodcutLMCabin } from "./styles/woodcut/WoodcutLMCabin";
import { LanternSea } from "./styles/lantern/LanternSea";
import { LanternIYH } from "./styles/lantern/LanternIYH";
import { LanternDavy } from "./styles/lantern/LanternDavy";
import { WoodcutDavy } from "./styles/woodcut/WoodcutDavy";
import { WoodcutDavyLemo } from "./styles/woodcut/WoodcutDavyLemo";
import { MeshHeat } from "./styles/lantern/MeshHeat";
import { LanternMesh } from "./styles/lantern/LanternMesh";
import { MuseumObject } from "./styles/object3d/MuseumObject";
import { BoxTwist } from "./styles/object3d/BoxTwist";
import { DepthPhoto } from "./styles/depth/DepthPhoto";

const FPS = 30;

export const RemotionRoot: React.FC = () => (
  <>
    {/* Ana şablon. Render: npx remotion render src/index.ts ShortsVideo out.mp4 --props='{"timeline":"episodes/<EP>/timeline.json"}' */}
    <Composition
      id="ShortsVideo"
      component={ShortsVideo}
      schema={shortsSchema}
      fps={FPS}
      width={1080}
      height={1920}
      durationInFrames={FPS}
      defaultProps={{ timeline: "episodes/EP001-segmentation/timeline.json" } satisfies z.infer<typeof shortsSchema>}
      calculateMetadata={async ({ props }) => {
        const data = await loadTimeline(props.timeline);
        return { durationInFrames: data.durationInFrames, fps: data.fps, width: data.width, height: data.height, props: { ...props, data } };
      }}
    />
    {/* MANA001 sessiz reklam klibi (anlatımsız). Render: node render_promo.mjs ../content/episodes/MANA001-gokceada-kuzu-tandir */}
    <Composition id="ManaPromo" component={ManaPromo} schema={manaPromoSchema} fps={FPS} width={1080} height={1920} durationInFrames={FPS}
      defaultProps={{ config: "episodes/MANA001-gokceada-kuzu-tandir/clips/promo.json" }}
      calculateMetadata={async ({ props }) => {
        const data = await loadPromo(props.config);
        const frames = Math.max(1, Math.round((data.cuts[data.cuts.length - 1] ?? 1) * data.fps));   // cuts: sahne sınırları (sn), son değer toplam süre
        return { durationInFrames: frames, fps: data.fps, props: { ...props, data } };
      }}
    />
    {/* Arka planı ayrılmış kişi/nesne klibi. Render: npx remotion render src/index.ts CutoutClip out.mp4 --props=<props.json> */}
    <Composition
      id="CutoutClip"
      component={CutoutClip}
      schema={cutoutSchema}
      fps={FPS}
      width={1080}
      height={1920}
      durationInFrames={FPS * 5}
      defaultProps={{
        fg: { image: "episodes/EP002-cochrane-dishwasher/assets/cutout/s06_machine_cut.png", size: [375, 410], height: 0.55,
              from: { x: 0.5, y: 0.5, scale: 1 }, to: { x: 0.5, y: 0.48, scale: 1.08 }, shadow: true, fadeInS: 0 },
        seconds: 5,
      } satisfies z.input<typeof cutoutSchema>}
      calculateMetadata={({ props }) => ({ durationInFrames: Math.round((props.seconds ?? 5) * FPS) })}
    />
    {/* Kapak görseli (vox-explainer tek kare). Render: npx remotion still src/index.ts Cover out.png --frame=60 --props=<cover.json> */}
    {/* Uzun video kapağı 16:9. Render: npx remotion still src/index.ts Thumbnail out.png --props=../content/episodes/<EP>/clips/thumb/<ad>.json */}
    {/* paper-lantern deneme (IYH001 s01 adayı; docs/styles/paper-lantern.md). Render: npx remotion render src/index.ts LanternSea out/lantern-sea.mp4 */}
    <Composition id="LanternSea" component={LanternSea} fps={FPS} width={1080} height={1920} durationInFrames={240} />
    {/* IYH001 paper-lantern sahneleri (props.shot: sea|crossing|desert|hand); tools/woodcut_render.py sahne süresiyle render eder */}
    <Composition id="LanternIYH" component={LanternIYH} fps={FPS} width={1080} height={1920} durationInFrames={200}
      defaultProps={{ shot: "sea" as const }}
      calculateMetadata={({ props }) => ({ durationInFrames: (props as { durationInFrames?: number }).durationInFrames ?? 200 })} />
    {/* EP014 Davy lambası: ağaç baskı açılışı (shot flame|grid) ve kâğıt fener (shot mesh|grid|out), 9:16; tools/woodcut_render.py sahne süresiyle render eder */}
    <Composition id="WoodcutDavy" component={WoodcutDavy} fps={FPS} width={1080} height={1920} durationInFrames={200}
      defaultProps={{ shot: "flame" as const }}
      calculateMetadata={({ props }) => ({ durationInFrames: (props as { durationInFrames?: number }).durationInFrames ?? 200 })} />
    {/* EP014 s01-s02 v2: Lemo motoruyla (yakın plan oyma, canlı alev, mavi uç plakası); shot flame|grid */}
    <Composition id="WoodcutDavyLemo" component={WoodcutDavyLemo} fps={FPS} width={1080} height={1920} durationInFrames={206}
      defaultProps={{ shot: "flame" as const }}
      calculateMetadata={({ props }) => ({ durationInFrames: (props as { durationInFrames?: number }).durationInFrames ?? 206 })} />
    {/* EP014 v6: tel örgü ısı mekanizması (s06 shot mech) ve lirik kapanış (s09 shot calm); 2D canvas */}
    <Composition id="MeshHeat" component={MeshHeat} fps={FPS} width={1080} height={1920} durationInFrames={238}
      defaultProps={{ shot: "mech" as const }}
      calculateMetadata={({ props }) => ({ durationInFrames: (props as { durationInFrames?: number }).durationInFrames ?? 238 })} />
    {/* EP014 v7: aynı mekanizma kâğıt fener gramerinde (s06 shot mech, s09 shot calm) */}
    <Composition id="LanternMesh" component={LanternMesh} fps={FPS} width={1080} height={1920} durationInFrames={238}
      defaultProps={{ shot: "mech" as const }}
      calculateMetadata={({ props }) => ({ durationInFrames: (props as { durationInFrames?: number }).durationInFrames ?? 238 })} />
    <Composition id="LanternDavy" component={LanternDavy} fps={FPS} width={1080} height={1920} durationInFrames={240}
      defaultProps={{ shot: "mesh" as const }}
      calculateMetadata={({ props }) => ({ durationInFrames: (props as { durationInFrames?: number }).durationInFrames ?? 240 })} />
    <Composition id="Thumbnail" component={Thumbnail} schema={thumbSchema} fps={FPS} width={1920} height={1080} durationInFrames={1}
      defaultProps={{ image: "brand/outro/outro-pieces-16x9.png" } as unknown as z.infer<typeof thumbSchema>} />
    <Composition id="Cover" component={Cover} schema={coverSchema} fps={FPS} width={1080} height={1920} durationInFrames={90}
      defaultProps={{ style: { layers: [] } } satisfies z.input<typeof coverSchema>} />
    {/* EP010 denemesi: Lemo woodcut motoruyla el yakın planı (2D canvas + WebGL2 baskı) */}
    {/* EP010 s07 denemesi: three.js kabin sahnesi → Lemo kesik filtresi + baskı (karışım) */}
    <Composition id="WoodcutLMCabin" component={WoodcutLMCabin} fps={FPS} width={1920} height={1080} durationInFrames={150}
      calculateMetadata={({ props }) => ({ durationInFrames: (props as { durationInFrames?: number }).durationInFrames ?? 150 })} />
    {Object.entries(A13_WOODCUTS).map(([id, C]) => (
      <Composition key={id} id={id} component={C as React.FC<Record<string, unknown>>} fps={FPS} width={1920} height={1080} durationInFrames={240}
        calculateMetadata={({ props }) => ({ durationInFrames: (props as { durationInFrames?: number }).durationInFrames ?? 240 })} />))}
    {/* DepthPhoto: derinlik haritalı 2.5D (tools/depth_map.py). props: image, depth, strength, focus, from/to {dist,x,y} */}
    <Composition id="DepthPhoto" component={DepthPhoto as unknown as React.FC<Record<string, unknown>>} fps={FPS} width={1080} height={1920} durationInFrames={170}
      defaultProps={{ image: "episodes/EP013-lincoln-patent-boat/assets/s02-traveling-by-flatboat-engraving-by-alfre.png", depth: "episodes/EP013-lincoln-patent-boat/assets/depth/s02-traveling-by-flatboat-engraving-by-alfre.depth.png",
        strength: 0.35, focus: { x: 0.55, y: 0.66 }, from: { dist: 2.3, x: -0.08, y: 0.02 }, to: { dist: 1.75, x: 0.08, y: 0 } }}
      calculateMetadata={({ props }) => ({ durationInFrames: (props as { durationInFrames?: number }).durationInFrames ?? 170 })} />
    {/* object3d: CC0 müze taraması kahraman çekim (EP013). props: model, shot (reveal|macro|lift|turntable); tools/woodcut_render.py sahne süresiyle render eder */}
    <Composition id="MuseumObject" component={MuseumObject as unknown as React.FC<Record<string, unknown>>} fps={FPS} width={1080} height={1920} durationInFrames={150}
      defaultProps={{ model: "episodes/EP013-lincoln-patent-boat/assets/3d/lincoln_patent_model-150k-4096-high.glb", up: [-Math.PI / 2, 0, 0], shot: "reveal" }}
      calculateMetadata={({ props }) => ({ durationInFrames: (props as { durationInFrames?: number }).durationInFrames ?? 150 })} />
    {/* object3d kodla nesne: iki ucu açık kraft kutu burulur (EP015). props: shot hero|still, twistAt, twist (still açısı, derece) */}
    <Composition id="BoxTwist" component={BoxTwist as unknown as React.FC<Record<string, unknown>>} fps={FPS} width={1080} height={1920} durationInFrames={240}
      defaultProps={{ shot: "hero", twistAt: "made" }}
      calculateMetadata={({ props }) => ({ durationInFrames: (props as { durationInFrames?: number }).durationInFrames ?? 240 })} />
    {/* Ağaç baskı deneme (EP009 s01, three.js). Render: npx remotion render src/index.ts WoodcutMatch out.mp4 */}
    <Composition id="WoodcutMatch" component={WoodcutMatch} fps={FPS} width={1920} height={1080} durationInFrames={300}
      calculateMetadata={({ props }) => ({ durationInFrames: (props as { durationInFrames?: number }).durationInFrames ?? 300 })} />
    <Composition id="WoodcutBarracks" component={WoodcutBarracks} fps={FPS} width={1920} height={1080} durationInFrames={240}
      defaultProps={{ shot: "wide" as const }}
      calculateMetadata={({ props }) => ({ durationInFrames: (props as { durationInFrames?: number }).durationInFrames ?? 240 })} />
    <Composition id="WoodcutClosing" component={WoodcutClosing} fps={FPS} width={1920} height={1080} durationInFrames={300}
      defaultProps={{ shot: "ember" as const }}
      calculateMetadata={({ props }) => ({ durationInFrames: (props as { durationInFrames?: number }).durationInFrames ?? 300 })} />
    <Composition id="WoodcutCell" component={WoodcutCell} fps={FPS} width={1920} height={1080} durationInFrames={180}
      calculateMetadata={({ props }) => ({ durationInFrames: (props as { durationInFrames?: number }).durationInFrames ?? 180 })} />
    <Composition id="WoodcutInterrogation" component={WoodcutInterrogation} fps={FPS} width={1920} height={1080} durationInFrames={180}
      calculateMetadata={({ props }) => ({ durationInFrames: (props as { durationInFrames?: number }).durationInFrames ?? 180 })} />
    <Composition id="WoodcutReturn" component={WoodcutReturn} fps={FPS} width={1920} height={1080} durationInFrames={300}
      calculateMetadata={({ props }) => ({ durationInFrames: (props as { durationInFrames?: number }).durationInFrames ?? 300 })} />
    {/* Kurulum duman testi (DECISIONS 2026-10-20) */}
    <Composition
      id="Smoke"
      component={Smoke}
      schema={smokeSchema}
      fps={FPS}
      width={1080}
      height={1920}
      durationInFrames={FPS * 10}
      defaultProps={{
        audio: "episodes/EP001-segmentation/audio/_trials/blind_cb_A1/narration.wav",
        report: "episodes/EP001-segmentation/audio/_trials/blind_cb_A1/report.json",
      } satisfies z.infer<typeof smokeSchema>}
      calculateMetadata={async ({ props }) => ({
        durationInFrames: Math.ceil((await getAudioDurationInSeconds(staticFile(props.audio))) * FPS),
      })}
    />
  </>
);
