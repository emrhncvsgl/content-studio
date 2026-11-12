import { AbsoluteFill, random, useCurrentFrame, useVideoConfig } from "remotion";
import type { StyleProps } from "../../schema/timeline";
import { CaptionScrim, Credit, PhotoShots, activeCredit, readPhotoShots, readWrap } from "../photo/PhotoMotion";
import { Lightning, Mist, lightningAt } from "../photo/Atmos";

// archival-film (catalog/styles.yaml): sepya ton, kontrast, vinyet, ince tane. lang_neutral: true.
// Tarihî vaka sahneleri için; aynı props (image, from/to, credit, cuts). Etkiler deterministik (remotion random(seed)), render tekrarlanabilir.
// props.film: "calm" (varsayılan) | "strong"
//   calm   (EP002 kullanıcı geri bildirimi "ekran çok titriyor"): "eski fotoğraf" hissi. Film kayması yok, yalnızca alt-piksel yavaş
//          sürüklenme; parlaklık ~1 sn'lik yumuşak dalga (±%1); çizik yok; tane düşük opaklıkta ve 4 karede bir değişir.
//   strong eski görünüm ("titreyen film"): kare başı ±%5 titreme, 2 karede bir ±1.5/2 px kayma, ara sıra çizik, her kare yeni tane.
export const ArchivalFilm: React.FC<StyleProps> = ({ scene, props }) => {
  const f = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const shots = readPhotoShots(props);
  const strong = props.film === "strong";
  const t = f / fps;

  const flicker = strong
    ? 0.93 + random(`fl${f}`) * 0.1
    : 1 + 0.006 * Math.sin(2 * Math.PI * t / 1.1) + 0.004 * Math.sin(2 * Math.PI * t / 2.3 + 1.3);
  const weave = strong
    ? { x: (random(`wx${Math.floor(f / 2)}`) - 0.5) * 3, y: (random(`wy${Math.floor(f / 2)}`) - 0.5) * 4 }
    : { x: 0.4 * Math.sin(2 * Math.PI * t / 7), y: 0.3 * Math.sin(2 * Math.PI * t / 9 + 0.7) };
  const scratches = strong
    ? [0, 1].filter((k) => random(`sc${k}${Math.floor(f / 3)}`) > 0.72).map((k) => random(`sx${k}${Math.floor(f / 3)}`) * width)
    : [];
  const seed = strong ? f % 12 : Math.floor(f / 4) % 12;
  const grainOpacity = strong ? 0.35 : 0.14;
  // atmosfer (photo/Atmos.tsx): props.mist (ön sis/serpinti), props.lightning (şimşek; görüntü de aydınlanır)
  const lt = lightningAt(props.lightning as { at?: number[]; strength?: number } | undefined, (f / fps) * 1000);

  return (
    <AbsoluteFill>
      <PhotoShots shots={shots} dof={props.dof as { focus?: number; amount?: number } | undefined} handheld={props.handheld as number | undefined} wrap={readWrap(props.lightWrap)} dur={scene.durationFrames} offset={weave}
        filter={`sepia(0.85) grayscale(0.25) contrast(1.18) brightness(${(flicker * (1 + 0.9 * lt)).toFixed(4)})`} />
      {!!props.mist && <Mist o={props.mist as object} t={t} W={width} H={height} />}
      <Lightning o={(props.lightning as object) ?? {}} v={lt} />
      {/* film tanesi: calm'da 4 karede bir, strong'da her kare değişen gürültü */}
      <svg width={width} height={height} style={{ position: "absolute", mixBlendMode: "overlay", opacity: grainOpacity }}>
        <filter id={`grain${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={seed} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width={width} height={height} filter={`url(#grain${seed})`} />
      </svg>
      {scratches.map((x, k) => (
        <div key={k} style={{ position: "absolute", left: x, top: 0, bottom: 0, width: 2, backgroundColor: "rgba(255,250,235,0.45)" }} />
      ))}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 45%, rgba(20,10,0,0.75) 100%)" }} />
      {(() => {
        // props.reveal (EP010 s42): fotoğraf önce yalnız bir nesnenin çevresinde (yumuşak kenarlı iris) görünür, sonra kalan kısım açılır.
        //   { box: { x, y, w, h } (fotoğrafın 0-1'i), holdMs (1500), fadeMs (1300) }; iris ilk kadraja (from) göre ekrana yerleşir.
        const rv = props.reveal as { box?: { x: number; y: number; w: number; h: number }; holdMs?: number; fadeMs?: number } | undefined;
        if (!rv?.box) return null;
        const ms = (f / fps) * 1000, hold = rv.holdMs ?? 1500, k = Math.min(1, Math.max(0, (ms - hold) / (rv.fadeMs ?? 1300)));
        if (k >= 1) return null;
        const fr = (props.from as { x?: number; y?: number; zoom?: number } | undefined) ?? {}, ox = fr.x ?? 0.5, oy = fr.y ?? 0.5, z = fr.zoom ?? 1;
        const cx = ox + (rv.box.x + rv.box.w / 2 - ox) * z, cy = oy + (rv.box.y + rv.box.h / 2 - oy) * z;
        const e = k * k * (3 - 2 * k), rx = (rv.box.w * z * 0.62 + e * 1.6) * width, ry = (rv.box.h * z * 0.62 + e * 1.6) * height;
        const inK = Math.min(1, ms / 500);
        return <AbsoluteFill style={{ background: `radial-gradient(ellipse ${rx.toFixed(0)}px ${ry.toFixed(0)}px at ${(cx * 100).toFixed(2)}% ${(cy * 100).toFixed(2)}%, rgba(0,0,0,${(1 - inK).toFixed(3)}) 0%, rgba(0,0,0,${(1 - inK).toFixed(3)}) 62%, rgba(4,3,2,${(1 - e * 0.6).toFixed(3)}) 100%)`, opacity: 1 - Math.max(0, (k - 0.75) / 0.25) }} />;
      })()}
      <CaptionScrim />
      <Credit text={activeCredit(shots, f, fps)} />
    </AbsoluteFill>
  );
};
