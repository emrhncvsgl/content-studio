import { AbsoluteFill, Audio, Easing, Freeze, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { z } from "zod";
import { timelineSchema, type Timeline } from "../schema/timeline";
import { STYLES } from "../styles/registry";
import { ChapterTitle, type Chapter } from "../components/ChapterTitle";
import { MissionClock, type Clock } from "../components/MissionClock";

const FadeToBlack: React.FC<{ frames: number }> = ({ frames }) => {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ backgroundColor: "#000", pointerEvents: "none",
    opacity: interpolate(f, [0, frames - 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.45, 0, 0.25, 1) }) }} />;
};
import { Karaoke } from "../components/captions/Karaoke";
import { PaperStrips } from "../components/captions/PaperStrips";
import { PrintCaption } from "../components/captions/PrintCaption";
import { SerifCaption } from "../components/captions/SerifCaption";
import { BLUR_OUT, SceneIn } from "../components/SceneIn";
import { MusicBed } from "../components/audio/MusicBed";
import { Finish } from "../components/Finish";
import { CameraMotionBlur } from "@remotion/motion-blur";
import { BaseFrame } from "../components/BaseFrame";
import { Frozen, TransIn, TransOut, isAdvanced, windowFrames, type TransOpts } from "../components/Transitions";

// Ana şablon: timeline.json → sahneler (giriş + stil + ses) + altyazı + müzik (ducking) + efektler. Her bölüm buradan geçer.
// props.timeline: content/ köküne göre yol (ör. "episodes/EP001-segmentation/timeline.json"); calculateMetadata okur ve doğrular.
export const shortsSchema = z.object({ timeline: z.string(), data: timelineSchema.optional() });
type Props = z.infer<typeof shortsSchema>;

export async function loadTimeline(path: string): Promise<Timeline> {
  const res = await fetch(staticFile(path));
  if (!res.ok) throw new Error(`timeline okunamadı: ${path} (${res.status})`);
  return timelineSchema.parse(await res.json());
}

const Missing: React.FC<{ style: string }> = ({ style }) => (
  <AbsoluteFill style={{ backgroundColor: "#300", color: "#fff", fontSize: 60, justifyContent: "center", alignItems: "center", textAlign: "center", padding: 80 }}>
    Stil henüz yok: {style}
  </AbsoluteFill>
);

const db = (x: number) => Math.pow(10, x / 20);

// Bölüm geneli basamaklı animasyon (earn.edits referansı 15 fps): sahne içi kare step'in katına yuvarlanır
const Posterize: React.FC<{ step: number; children: React.ReactNode }> = ({ step, children }) => {
  const f = useCurrentFrame();
  return <Freeze frame={Math.floor(f / step) * step}>{children}</Freeze>;
};

export const ShortsVideo: React.FC<Props> = ({ data }) => {
  const frame = useCurrentFrame();
  if (!data) return null;
  const lang = data.captions.lang;
  // sahne görüntüsü (ses/altyazı yok); props.motionBlur: { samples (6), shutter (0.5) } → CameraMotionBlur. blur: false karşı sahne kopyaları için (maliyet)
  const render = (k: number, blur = true) => {
    const sc = data.scenes[k], Comp = STYLES[sc.style]?.component;
    // görsel ipuçları konuşulan yazımla (cueWords: "forty"); altyazı sayıları rakamla (words: "40") — EP009 s48 kartları ipucu bulamıyordu
    const el = Comp ? <Comp scene={sc} words={sc.cueWords?.[lang] ?? sc.words[lang] ?? []} props={sc.props} lang={lang} theme={data.theme} index={k} /> : <Missing style={sc.style} />;
    const mb = sc.props.motionBlur as { samples?: number; shutter?: number } | undefined;
    return blur && mb ? <BaseFrame><CameraMotionBlur samples={mb.samples ?? 6} shutterAngle={(mb.shutter ?? 0.5) * 360}>{el}</CameraMotionBlur></BaseFrame> : el;
  };
  return (
    <AbsoluteFill style={{ backgroundColor: data.theme.background }}>
      {data.scenes.map((sc, i) => {
        const next = data.scenes[i + 1], prev = data.scenes[i - 1];
        // geçiş penceresinde CameraMotionBlur kapalı: Smear zaten bulanıklaştırır (ikisi birlikte kare başına ~36 çizim → render çok yavaş)
        const local = frame - sc.startFrame;
        const inWin = (isAdvanced(sc.transition) && local < windowFrames(sc.transition, sc.transitionOpts as TransOpts, data.fps).post)
          || (!!next && isAdvanced(next.transition) && local >= sc.durationFrames - windowFrames(next.transition, next.transitionOpts as TransOpts, data.fps).pre);
        let body = render(i, !inWin);
        if (prev && isAdvanced(sc.transition)) {
          body = <TransIn kind={sc.transition} o={sc.transitionOpts as TransOpts}
            prev={<Frozen at={prev.durationFrames - 1} dur={prev.durationFrames}>{render(i - 1, false)}</Frozen>}>{body}</TransIn>;
        }
        if (next && isAdvanced(next.transition)) {
          body = <TransOut kind={next.transition} o={next.transitionOpts as TransOpts} D={sc.durationFrames}
            next={<Frozen at={0} dur={next.durationFrames}>{render(i + 1, false)}</Frozen>}>{body}</TransOut>;
        }
        return (
          <Sequence key={sc.id} from={sc.startFrame} durationInFrames={sc.durationFrames} name={`${sc.id} · ${sc.style} · ${sc.transition}`}>
            <SceneIn type={sc.transition} accent={data.theme.accent} outFrom={next?.transition === "blur" ? sc.durationFrames - BLUR_OUT : undefined}>
              {data.animFps && data.animFps < data.fps ? <Posterize step={data.fps / data.animFps}>{body}</Posterize> : body}
            </SceneIn>
            {sc.audio[lang] && (
              <Sequence from={sc.audioStartFrame ?? 0} name="anlatım">
                <Audio src={staticFile(sc.audio[lang])} />
              </Sequence>
            )}
          </Sequence>
        );
      })}
      {data.finish && <Finish o={data.finish} W={data.width} H={data.height} fps={data.fps} />}
      {/* altyazı bitiş katmanının üstünde (toz/vinyet/kenar bulanıklığı yazıyı etkilemez) */}
      {data.captions.style !== "cap-none" && data.scenes.map((sc) => (STYLES[sc.style]?.ownsText ? null : (
        <Sequence key={`cap-${sc.id}`} from={sc.startFrame} durationInFrames={sc.durationFrames} name={`${sc.id} · altyazı`}>
          {data.captions.style === "cap-paper" ? <PaperStrips words={sc.words[lang] ?? []} solid={Boolean((sc.props as Record<string, unknown> | undefined)?.captionSolid)} /> : data.captions.style === "cap-print" ? <PrintCaption words={sc.words[lang] ?? []} /> : data.captions.style === "cap-serif" ? <SerifCaption words={sc.words[lang] ?? []} /> : <Karaoke words={sc.words[lang] ?? []} theme={data.theme} />}
        </Sequence>
      )))}
      {/* bölüm sonu: sonraki sahne karanlıktan açılan bir bölüm başlığıysa bu sahnenin son 0.8 sn'si S-eğrisiyle karanlığa iner */}
      {data.scenes.map((sc, i) => {
        const ch = data.scenes[i + 1]?.props.chapter as Chapter | undefined;
        if (!ch?.fromBlackMs) return null;
        const n = Math.round(0.8 * data.fps);
        return (
          <Sequence key={`chout-${sc.id}`} from={sc.startFrame + sc.durationFrames - n} durationInFrames={n} name={`${sc.id} · karanlığa iniş`}>
            <FadeToBlack frames={n} />
          </Sequence>
        );
      })}
      {/* bölüm başlıkları: perdenin ilk sahnesinin props.chapter'ı (altyazı ile aynı üst katman) */}
      {data.scenes.map((sc) => (sc.props.chapter ? (
        <Sequence key={`ch-${sc.id}`} from={sc.startFrame} durationInFrames={sc.durationFrames} name={`${sc.id} · bölüm başlığı`}>
          <ChapterTitle chapter={sc.props.chapter as Chapter} />
        </Sequence>
      ) : null))}
      {/* görev saati çipi (EP010): props.clock olan sahnelerde, geçişlerin üstünde sabit; ardışık sahnelerde değer önceki sahneden sarar */}
      {data.scenes.map((sc, i) => (sc.props.clock ? (
        <Sequence key={`clk-${sc.id}`} from={sc.startFrame} durationInFrames={sc.durationFrames} name={`${sc.id} · görev saati`}>
          <MissionClock clock={sc.props.clock as Clock} words={sc.cueWords?.[lang] ?? sc.words[lang] ?? []}
            prevGet={(data.scenes[i - 1]?.props.clock as Clock | undefined)?.get}
            delayMs={(() => { const ch = sc.props.chapter as Chapter | undefined; return ch?.fromBlackMs ? ch.fromBlackMs + (ch.revealMs ?? 1200) : 0; })()} />
        </Sequence>
      ) : null))}
      {/* kapanış logosu (uzun video): props.outro = { video, frames (136), fadeFrames (14) } → sahnenin son `frames` karesinde üstte oynar; sesi timeline.sfx'te */}
      {data.scenes.map((sc) => {
        const o = sc.props.outro as { video: string; frames?: number; fadeFrames?: number } | undefined;
        if (!o?.video) return null;
        const n = Math.min(o.frames ?? 136, sc.durationFrames), fd = o.fadeFrames ?? 14, from = sc.startFrame + sc.durationFrames - n;
        return (
          <Sequence key={`outro-${sc.id}`} from={from} durationInFrames={n} name={`${sc.id} · kapanış logosu`}>
            <AbsoluteFill style={{ opacity: interpolate(frame - from, [0, fd], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.sin) }) }}>
              <OffthreadVideo src={staticFile(o.video)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </AbsoluteFill>
          </Sequence>
        );
      })}
      <MusicBed tl={data} />
      {data.outro && (
        <AbsoluteFill style={{ backgroundColor: "#000", pointerEvents: "none",
          opacity: interpolate(frame, [data.outro.fadeFromFrame, data.outro.fadeFromFrame + data.outro.fadeFrames], [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.sin) }) }} />
      )}
      {data.sfx.map((e, k) => {
        const dur = e.durationFrames ?? Math.round(data.fps * 2);
        const fade = e.fadeOutFrames ?? 0;
        return (
          <Sequence key={`sfx${k}`} from={e.frame} durationInFrames={dur} name={`sfx · ${e.file}`}>
            <Audio src={staticFile(e.file)}
              volume={fade > 0 ? (f) => db(e.gainDb) * interpolate(f, [dur - fade, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : db(e.gainDb)} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
