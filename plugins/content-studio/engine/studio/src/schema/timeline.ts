import { z } from "zod";

// timeline.json sözleşmesi (PLAN 4.3). Üreten: tools/build_timeline.py. Yollar content/ köküne göre (Remotion public dizini).
export const wordSchema = z.object({
  text: z.string(),
  startMs: z.number(),
  endMs: z.number(),
  emphasis: z.boolean().optional(),
});

export const sceneSchema = z.object({
  id: z.string().regex(/^s\d{2}[a-z]?$/),
  startFrame: z.number().int().nonnegative(),
  durationFrames: z.number().int().positive(),
  audio: z.record(z.string(), z.string()),
  // intro: sahne sesi sahne başından bu kadar kare sonra başlar (kelime zamanları buna göre kaydırılmış gelir)
  audioStartFrame: z.number().int().nonnegative().optional(),
  words: z.record(z.string(), z.array(wordSchema)),
  cueWords: z.record(z.string(), z.array(wordSchema)).optional(),   // konuşulan yazım (görsel ipuçları); words = altyazı yazımı
  text: z.record(z.string(), z.string()),
  emotion: z.string(),
  style: z.string(),
  props: z.record(z.string(), z.unknown()).default({}),
  // sahne girişi (süreyi değiştirmez, senkron korunur): cut | zoom | wipe | flash | blur
  // blur: önceki sahne son karelerinde bulanıklaşıp büyür, bu sahne bulanıktan netleşir (örtüşme olmadan bulanık geçiş)
  // nesne üzerinden (vox §6, components/Transitions.tsx): portal | pullback | cardflip | zoomblur | whip | leak | rgb | halftoneWipe
  transition: z.enum(["cut", "zoom", "wipe", "flash", "blur", "portal", "pullback", "cardflip", "zoomblur", "whip", "leak", "rgb", "halftoneWipe", "fog", "slide", "objectWipe", "matte", "surfaceTilt", "disc", "door", "window"]).default("cut"),
  // geçiş ayarları: target {x,y,w,h} (giden sahnede, kare 0-1) · frame (pullback, gelen sahnede) · shape arch|rect|circle · pre/post ms · fps · blurSamples · dir · color
  transitionOpts: z.record(z.string(), z.unknown()).optional(),
});

// Efekt olayı: kodla üretilmiş (tools/sfx.py → content/sfx) ya da doğal foley (content/sfx/natural, sources.csv). frame mutlak.
// durationFrames: Sequence süresi (build_timeline dosya süresinden yazar; yoksa 2 sn) · fadeOutFrames: kısaltılmış efektin son kısılması
export const sfxSchema = z.object({
  frame: z.number().int(),
  file: z.string(),
  gainDb: z.number(),
  durationFrames: z.number().int().positive().optional(),
  fadeOutFrames: z.number().int().nonnegative().optional(),
});

// Müzik altlığı: anlatıcı konuşurken otomatik kısılır (ducking); null = müzik yok
export const musicSchema = z.object({
  file: z.string(),
  gainDb: z.number(),          // anlatıcı yokken seviye
  duckDb: z.number(),          // konuşurken ek kısma
  fadeInFrames: z.number().int(),
  fadeOutFrames: z.number().int(),
  steadyUntilFrame: z.number().int().optional(),  // bu kareye kadar hep "konuşurken" seviyesi (aralarda yükselmez), sonra 2 sn'de açılır
  startFrame: z.number().int().optional(),  // müzik bu karede başlar (senaryo "music_after": "sNN")
}).nullable();

export const themeSchema = z.object({
  primary: z.string(),
  accent: z.string(),
  background: z.string(),
  text: z.string(),
  font: z.string(),
});

export const timelineSchema = z.object({
  episode: z.string(),
  lang: z.string(),
  fps: z.number().int().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  durationInFrames: z.number().int().positive(),
  theme: themeSchema,
  captions: z.object({ style: z.string(), lang: z.string() }),
  scenes: z.array(sceneSchema).min(1),
  music: musicSchema.default(null),
  sfx: z.array(sfxSchema).default([]),
  // bölüm geneli animasyon kare hızı (ör. 15): sahne görüntüsü bu hızda basamaklanır (kamera dahil), altyazı ve ses akıcı kalır
  animFps: z.number().int().positive().optional(),
  // bitiş katmanı (components/Finish.tsx): kenar bulanıklığı, film tozu, vinyet; altyazının altında
  finish: z.object({ fringe: z.number().optional(), dust: z.number().optional(), vignette: z.number().optional(), fps: z.number().optional() }).optional(),
  outro: z.object({ fadeFromFrame: z.number().int(), fadeFrames: z.number().int().positive() }).optional(),  // sonda siyaha kararma
});

export type Word = z.infer<typeof wordSchema>;
export type Scene = z.infer<typeof sceneSchema>;
export type Theme = z.infer<typeof themeSchema>;
export type Timeline = z.infer<typeof timelineSchema>;

// Her stil bileşeninin ortak arayüzü (PLAN 7.1): ({ scene, words, props, lang, theme }) => JSX
export type StyleProps = {
  scene: Scene;
  words: Word[];          // sahne içi ms
  props: Record<string, unknown>;
  lang: string;
  theme: Theme;
  index: number;          // sahne sırası (FIG. numarası vb.)
};
