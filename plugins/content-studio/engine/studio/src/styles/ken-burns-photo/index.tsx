import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { StyleProps } from "../../schema/timeline";
import { CaptionScrim, Credit, PhotoShots, activeCredit, readPhotoShots, readWrap } from "../photo/PhotoMotion";
import { Lightning, Mist, lightningAt } from "../photo/Atmos";
import { ease } from "../../components/ease";

// ken-burns-photo (catalog/styles.yaml): lisanslı fotoğrafta yavaş yakınlaşma ve odak kayması. lang_neutral: true.
// props: image (zorunlu), from/to { x, y, zoom }, credit (atıf gerekiyorsa find_images.py çıktısındaki metin),
//        cuts (isteğe bağlı sahne içi görsel değişimi: [{ atMs, image?, from?, to?, fadeMs?, credit? }], bkz. photo/PhotoMotion)
// compare (önce/sonra sürgüsü, EP005 s11): { image (sonra görseli; image ile AYNI boyut ve hizada olmalı), at (sahne başından ms),
//          ms (1400), ease ("heavy"), dir ("right" = soldan sağa açılır | "left"), line (true: ince beyaz sürgü çizgisi + gölge) }.
//   Sonra görseli aynı kamera (from/to, planes yok, cuts yok sayılır) ile ana görselin üstüne çizilir ve clip-path ile açılır.
//   Hizalama build öncesi yapılır (OpenCV ECC, bkz. remotion-styles SKILL.md "Önce/sonra sürgüsü"). imageSizes'a build_timeline ekler.
type Compare = { image: string; at: number; ms?: number; ease?: string; dir?: "right" | "left"; line?: boolean };

export const KenBurnsPhoto: React.FC<StyleProps> = ({ scene, props }) => {
  const f = useCurrentFrame();
  const { fps, width: W, height } = useVideoConfig();
  const width = W;
  const shots = readPhotoShots(props);
  const cmp = props.compare as Compare | undefined;
  let after: React.ReactNode = null;
  if (cmp?.image) {
    const a0 = Math.round((cmp.at / 1000) * fps), a1 = a0 + Math.max(1, Math.round(((cmp.ms ?? 1400) / 1000) * fps));
    const p = interpolate(f, [a0, a1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease(cmp.ease, "heavy") });
    const afterShots = readPhotoShots({ ...props, image: cmp.image, cuts: [], planes: [] });
    const right = (cmp.dir ?? "right") === "right";
    const clip = right ? `inset(0 ${(1 - p) * 100}% 0 0)` : `inset(0 0 0 ${(1 - p) * 100}%)`;
    const lx = (right ? p : 1 - p) * W;
    const lineO = cmp.line === false ? 0 : Math.min(1, p * 12) * Math.min(1, (1 - p) * 12 + 0.0);
    after = p > 0 ? (
      <>
        <AbsoluteFill style={{ clipPath: clip }}>
          <PhotoShots shots={afterShots} dof={props.dof as { focus?: number; amount?: number } | undefined} handheld={props.handheld as number | undefined} dur={scene.durationFrames} />
        </AbsoluteFill>
        {lineO > 0.01 && (
          <div style={{ position: "absolute", top: 0, bottom: 0, left: lx - 3, width: 6, background: "rgba(255,255,255,0.92)", opacity: lineO,
            boxShadow: "0 0 18px rgba(0,0,0,0.55), 0 0 4px rgba(255,255,255,0.8)" }} />
        )}
      </>
    ) : null;
  }
  return (
    <AbsoluteFill>
      <PhotoShots shots={shots} dof={props.dof as { focus?: number; amount?: number } | undefined} handheld={props.handheld as number | undefined} wrap={readWrap(props.lightWrap)} dur={scene.durationFrames} />
      {after}
      {!!props.mist && <Mist o={props.mist as object} t={f / fps} W={width} H={height} />}
      <Lightning o={(props.lightning as object) ?? {}} v={lightningAt(props.lightning as { at?: number[]; strength?: number } | undefined, (f / fps) * 1000)} />
      <CaptionScrim />
      <Credit text={activeCredit(shots, f, fps)} />
    </AbsoluteFill>
  );
};
