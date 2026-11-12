import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, Easing, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { StyleProps, Word } from "../../schema/timeline";
import { Credit, handheldAt, loadImage } from "../photo/PhotoMotion";
import { INTER, MONO } from "../../fonts";
import { EASE, clamp01, ease, focusBlur, lerpScale } from "../../components/ease";
import { useBaseFrame } from "../../components/BaseFrame";
import { drawClock, drawClouds, drawDim, drawGraticule, drawRuler, drawShip, drawWedge } from "./map";
import { drawChartAxes, drawChartBand, drawChartBaseline, drawChartBracket, drawChartCurve, drawChartDot, drawDial, drawIconBar, layerMotion } from "./chart";

// vox-explainer (catalog/styles.yaml): renkli düz zemin + siyah-beyaz kesik görseller, belge yakınlaştırma + fosforlu kalem,
// elle çizilen daire/alt çizgi/ok, kâğıt dokusu. lang_neutral: true (ekrana dil yazısı basmaz).
// props:
//   bg: zemin rengi (varsayılan theme.accent) · paper: doku opaklığı (0-1, varsayılan 0.22)
//   layers: sırayla çizilir
//     { type: "doc", image, size: [w,h], from: {x,y,zoom}, to: {x,y,zoom}, moveAt, moveMs?,
//       highlight?: { x, y, w, h } (görsel pikseli), highlightAt?, dim? }        belge yakınlaştırma + fosforlu kalem
//     { type: "cutout", image, size: [w,h], x, y (merkez, kare 0-1), height (kare oranı), enterAt?, enter?: "pop"|"left"|"right"|"drop",
//       bw?: true, shadow?: true, drift?: 0.04 }                                    renkli zeminde kesik
//     { type: "annotate", shape: "circle"|"underline"|"arrow", x, y, w, h (kare 0-1), at, drawMs?, color?, width? }   elle işaretleme
//     { type: "piece", x, y, w, h (kare 0-1, merkez), rot? (derece), color?, enterAt?, seed? }   kolaj: yırtık kenarlı kâğıt parçası
//   cutout ek: rot? (derece, sabit eğim), tape?: true (üstte yarı saydam bant). Kâğıt arkalık için tools/make_sticker.py çıktısını kullan.
//   piece/cutout giriş: from?: "left"|"right"|"top"|"bottom" → ekran dışından dönerek gelir, yayla hafif sekip oturur
//   piece ek: texture? (taranmış kâğıt dokusu, ör. "textures/paper003.jpg"; color üstüne basılır), tint? (çarpma rengi),
//     grid? (px: mühendislik kâğıdı kareleri), stack? (altta kaç yaprak daha; her biri hafif kayık ve dönük, kendi gölgesiyle), stackSpread? (derece, 2.4)
//   { type: "print", image, size: [w,h], x, y, w (kare genişliği oranı), rot?, border? (0.045), texture?, tape?: "corners"|"top"|"none",
//     bw?: false, from?, enterAt?, seed? }   kâğıda basılmış fotoğraf/harita: beyaz kenar, gölge, köşelerinde bant
//   surface?: { image, tint?, depth? (0.7), span? (dokunun kapladığı kare genişliği, 1.4) }: düz bg yerine gerçek masa yüzeyi (karton, ahşap)
//   depth?: kamera paralaksı (piece 0.85, diğerleri 1; küçük = uzak, az hareket eder)
//   print/cutout ek: planes?: [{ image, k }] derinlik kartları (tools/depth_layers.py; image = L0 ya da L1, planes = üstteki alfalı dilimler, aynı piksel
//     ızgarası), planeDrift? (0.05): giriş anından 6 sn boyunca kart başına (k−1)·drift·genişlik yatay kayma + hafif büyüme → fotoğrafın içinde 2.5D
//     (EP014 v5). Kartlar t=0'da hizalı; baskıda kâğıda çarpma ile basılır (gölge ve kenar sabit kalır).
//   light?: { x, y (ışık kaynağı, kare 0-1; varsayılan sol üst 0.25, -0.05), strength (0-1, 0.6), color (sıcak), vignette (0-1, 0.55),
//            sweepAt? (kelime/ms: kâğıdın üstünden geçen ışık bandı), sweepMs?, sweepAngle? (derece, 115), sweepDir? (1 | -1),
//            to?: { x, y } (ışık kaynağı sahne boyunca buraya kayar), breathe? (genlik, 0.03), breatheS? (periyot sn, 4.2),
//            pulseAt? (kelime/ms: ışık kısa süre güçlenir) } · light: false = ışık yok. Gölgeler ışığın tersine düşer.
//     { type: "title", lines: [{ text, size?, color?, flipAt? }], x, y, w (kâğıt genişliği), rot?, paper?: renk, noShadow?: true (paper "transparent" ve altta hazır kâğıt kesiği için) }   büyük başlık kartı;
//        flipAt'te o satır 180° döner (ör. "The Other Way Round")
//     { type: "tag", text, icon?: "lock"|"drop", x, y, rot?, at, from?, color?, bg? }   etiket (kâğıt şerit üstünde kalın yazı)
//   Her katmanda showAt? / hideAt? (kelime/ms): katman o anda belirir / kaybolur (350 ms).
//   Stop-motion hissi: stepFps? (ör. 12: hareket 12 fps'e basamaklanır, "posterize time"), boil? (px: her yeni basamakta
//   kâğıtlar bu kadar titrer, ±0.4·boil derece döner), wobble? (derece: kâğıt ve kesiklerin yavaş sallanması).
//   { type: "dust", count?, color?, size? }: havada süzülen toz zerrecikleri (mikro animasyon)
//   halftone?: true | { opacity (0.35), size (nokta aralığı px, 8), dot (yarıçap/aralık, 0.32), angle (derece, 45), blend ("overlay") }:
//     baskı tramı dokusu, ekrana sabit; overlay'de koyu/orta tonlarda görünür, beyazda kaybolur. Görseller farklı kaynaklardan olsa da birleştirir.
//   camera?: { from: Cam, to: Cam } sahne boyunca; Cam = { x, y (kayma, kare oranı), zoom, rot (derece), tilt (öne eğim°), turn (yana dönüş°) }
//   camera ek: ease ("sin" | "heavy" | "expoOut" | "cubic"), moveAt/moveMs (hareket penceresi), push { zoom (0.05), ms (700) }
//   doc ek: ease (varsayılan heavy), sweepMs (fosfor süpürme, 600) · title ek: write: "typewriter", lines[].markAt (satır arkası fosfor)
//   { type: "route", points: [[u,v]…] (önceki doc görselinin 0-1'i), at, ms?, bend?, dash?, march?, color?, width? }   kesik çizgili rota
//   { type: "pin", x, y, label, sub?, at, dir?: "r"|"l"|"u"|"d", big? }   iğne + etiket kartı (doc koordinatı)
//   { type: "counter", from, to, at, x, y, ms?, roll?, size?, box?, label? }   sayaç (roll: slot makinesi)
//   { type: "stamp", text, x, y, at, rot?, color?, shake? (px) }   damga: çarpma + toz + tek seferlik sarsıntı
//   film?: true | { grain, vignette, flicker, weave, tint } · motionBlur (ShortsVideo'da CameraMotionBlur) · geçişler: components/Transitions.tsx
//   Zamanlar (at, moveAt, highlightAt, enterAt): sahne başından ms ya da kelime ("patent", nth için "patent#2").
//   EP006: graticule, wedge, ship, ruler, dim, clock, clouds → ./map.tsx (alanlar orada) · tag from: "wipe" (soldan maske silmesi)
//   cutout/print osc?: { hz, amp (derece), pivot: [x, y] (görselin 0-1'i, 0.5,0.5), irregular? (0-1: düzensiz sarkaç), at? }
//   camera.rock?: { deg (1.5), periodS (2.4), y? (kare oranı, 0.004) } periyodik yalpa (gemi güvertesi)
//   EP010 (./chart.ts): dial, iconBar, chartBaseline, chartAxes, chartDot, chartCurve, chartBand, chartBracket katmanları ·
//   cutout/print/piece keys: [{ at, x, y, rot?, ms? }] (nesne kendi hareket eder), spin: { rpm, untilAt? }, shrink: { to, at, ms }, opacity ·
//   camera.kick?: { at, px (9), ms (260) } tek sarsıntı · light.fadeTo / fadeAt / fadeMs (ışık gücü zamanla) · route.fadeOut (ms: çizildikten sonra söner)
// Görsel yerleşimi: altyazı bandı karenin %60-78'i; ana öğeler %8-58 aralığına konur.
type Focus = { x: number; y: number; zoom: number };
type Cam = { x: number; y: number; zoom: number; rot: number; tilt: number; turn: number };
const CAM0: Cam = { x: 0, y: 0, zoom: 1, rot: 0, tilt: 0, turn: 0 };

// sahne kamerası: zaman (0-1) → değerler; katman derinliğine göre 2D kısım canvas'ta, eğim/dönüş CSS perspektifinde
// camera.ease: "sin" (varsayılan, sahne boyunca) | "heavyOut" (atılım + uzun oturma; moveAt/moveMs ile) | "snapOut" | "heavy" | "expoOut" | "cubic" · camera.moveAt/moveMs: hareket yalnızca bu pencerede
// camera.push: { zoom (0.05), ms (700) } sahne başında from'a eklenen küçük itme, expoOut ile söner ("durağan kare yok")
function camAt(props: Record<string, unknown>, p: number, ms: number, words: Word[]): Cam {
  const c = props.camera as { from?: Partial<Cam>; to?: Partial<Cam>; ease?: string; moveAt?: unknown; moveMs?: number; push?: { zoom?: number; ms?: number } } | undefined;
  const a = { ...CAM0, ...(c?.from ?? {}) }, b = { ...CAM0, ...(c?.to ?? c?.from ?? {}) };
  if (c?.moveAt !== undefined) { const t0 = atMs(c.moveAt, words); p = clamp01((ms - t0) / (c.moveMs ?? 1200)); }
  const k = ease(c?.ease, "sin")(p);
  const m = (u: number, v: number) => u + (v - u) * k;
  const push = c?.push ? (c.push.zoom ?? 0.05) * (1 - EASE.expoOut(clamp01(ms / (c.push.ms ?? 700)))) : 0;
  const hh = props.handheld ? handheldAt((ms / 1000) * 30, props.handheld as number) : { x: 0, y: 0, rot: 0 }; // el kamerası (px → kare oranı)
  const rk = (c as { rock?: { deg?: number; periodS?: number; y?: number } } | undefined)?.rock;
  const kick = (c as { kick?: { at?: unknown; px?: number; ms?: number } } | undefined)?.kick;
  if (kick) { const t = ms - atMs(kick.at ?? 0, words), d = kick.ms ?? 260; if (t >= 0 && t < d) { const a = (kick.px ?? 9) * Math.pow(1 - t / d, 2); hh.x += a * Math.sin(t * 0.11); hh.y += a * 0.7 * Math.cos(t * 0.15); } }
  if (rk) { const ph = (2 * Math.PI * ms) / 1000 / (rk.periodS ?? 2.4); hh.rot += (rk.deg ?? 1.5) * Math.sin(ph); hh.y += (rk.y ?? 0.004) * 1920 * Math.sin(2 * ph + 0.6); }
  return { x: m(a.x, b.x) + hh.x / 1080, y: m(a.y, b.y) + hh.y / 1920, zoom: lerpScale(a.zoom, b.zoom, k) - push, rot: m(a.rot, b.rot) + hh.rot,
    tilt: m(a.tilt, b.tilt), turn: m(a.turn, b.turn) };
}
// Alan derinliği zamanla (rack focus): props.dof = { focus, amount (14), to?, at? (ms|kelime), ms? (900), ease? ("heavyOut"),
//   hunt? (0-0.5: odak hedefi bir kez geçip geri gelir), settle? (px: sahne başında tüm kare bulanıktan netliğe oturur), settleMs? (700) }
type Dof = { focus: number; amount: number; settle: number };
function dofAt(props: Record<string, unknown>, ms: number, words: Word[]): Dof | undefined {
  const d = props.dof as { focus?: number; amount?: number; to?: number; at?: unknown; ms?: number; ease?: string; hunt?: number; settle?: number; settleMs?: number } | undefined;
  if (!d) return undefined;
  let focus = d.focus ?? 1;
  if (d.to !== undefined) {
    const p = clamp01((ms - atMs(d.at ?? 0, words)) / (d.ms ?? 900));
    focus += (d.to - focus) * ease(d.ease, "heavyOut")(p);
    const q = clamp01((p - 0.5) / 0.5);
    if (d.hunt) focus += d.hunt * (d.to - (d.focus ?? 1)) * Math.sin(Math.PI * q) * Math.sqrt(1 - q);
  }
  return { focus, amount: d.amount ?? 14, settle: d.settle ? focusBlur(ms / (d.settleMs ?? 700), d.settle, d.hunt ?? 0) : 0 };
}
function applyCam(ctx: CanvasRenderingContext2D, cam: Cam, depth: number, W: number, H: number) {
  ctx.translate(W / 2, H / 2);
  ctx.scale(1 + (cam.zoom - 1) * depth, 1 + (cam.zoom - 1) * depth);
  ctx.rotate((cam.rot * Math.PI) / 180);
  ctx.translate(-W / 2 - cam.x * W * depth, -H / 2 - cam.y * H * depth);
}
// ekran dışından giriş: yön + başlangıç dönüşü (yay ile oturur, hafif seker)
function entry(from: unknown, s: number, W: number, H: number, seed: number) {
  const q = 1 - s, spin = (seed % 2 ? 1 : -1) * (14 + (seed % 5) * 3);
  if (from === "left") return { dx: -q * W * 0.95, dy: q * H * 0.05, rot: q * spin };
  if (from === "right") return { dx: q * W * 0.95, dy: -q * H * 0.04, rot: q * spin };
  if (from === "top") return { dx: q * W * 0.08, dy: -q * H * 0.75, rot: q * spin };
  if (from === "bottom") return { dx: -q * W * 0.06, dy: q * H * 0.75, rot: q * spin };
  return null;
}
type Layer = Record<string, any>;

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
export function atMs(at: unknown, words: Word[]): number {
  if (typeof at === "number") return at;
  if (typeof at !== "string") return 0;
  // "kelime", "kelime#2", "kelime+300" / "kelime#2-150" (ms ofset; 2026-11-09 IYH001: önceden ofset sessizce 0'a düşüyordu)
  const m = at.match(/^(.*?)([+-]\d+)$/);
  const [w, n] = (m ? m[1] : at).split("#");
  const hits = words.filter((x) => norm(x.text) === norm(w));
  const hit = hits[(Number(n) || 1) - 1];
  if (!hit) return 0;
  return hit.startMs + (m ? Number(m[2]) : 0);
}

const INK = "#E8322B";
const FILLS: Record<string, HTMLImageElement> = {}; // yüklenen görseller (cutout.fill için)
// görünürlük: showAt'ten önce 0, hideAt'ten sonra 0, aralarda 350 ms yumuşak geçiş
function vis(l: Layer, ms: number, words: Word[]) {
  let v = 1;
  if (l.showAt !== undefined) { const t = atMs(l.showAt, words); v *= interpolate(ms, [t, t + 350], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }); }
  if (l.hideAt !== undefined) { const t = atMs(l.hideAt, words); v *= interpolate(ms, [t, t + 350], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }); }
  return v;
}
// gölge yönü: ışık kaynağından uzağa (her karede bileşen ayarlar; çizim eşzamanlı olduğu için güvenli)
let SH = { x: 0.45, y: 0.9 };
const shadow = (dist: number, blur: number, alpha: number) => `drop-shadow(${(SH.x * dist).toFixed(1)}px ${(SH.y * dist).toFixed(1)}px ${blur}px rgba(0,0,0,${alpha}))`;
const HILITE = "rgba(255, 221, 51, 0.85)";

export const VoxExplainer: React.FC<StyleProps> = ({ props, words, theme }) => {
  const fRaw = useCurrentFrame();
  const fBase = useBaseFrame() ?? fRaw; // motion blur alt örneklerinde basamak tabanı (components/BaseFrame)
  const stepEvery = props.stepFps ? Math.max(1, Math.round(30 / (props.stepFps as number))) : 1;
  const f = props.stepFps ? Math.floor(fBase / stepEvery) * stepEvery : fRaw; // basamaklı zaman: bütün hareket buna göre
  const boil = (props.boil as number) ?? 0;
  const wobble = (props.wobble as number) ?? 0;
  const stepId = Math.floor(fBase / stepEvery);
  const { width: W, height: H, fps } = useVideoConfig();
  const ms = (f / fps) * 1000;
  const layers = (props.layers as Layer[] | undefined) ?? [];
  const bg = (props.bg as string) ?? theme.accent;
  const paper = (props.paper as number) ?? 0.22;
  const ref = useRef<HTMLCanvasElement>(null);
  const [imgs, setImgs] = useState<Record<string, HTMLImageElement> | null>(null);
  const [handle] = useState(() => delayRender("vox görselleri"));
  const surface = props.surface as { image: string; tint?: string; depth?: number; span?: number } | undefined;
  const srcs = [...new Set([...layers.flatMap((l) => [l.image, l.texture, l.faceImage, l.needleImage, (l.fill as { image?: string } | undefined)?.image,
    ...(((l.planes as { image: string }[] | undefined) ?? []).map((p) => p.image)),
    ...(((l.items as Layer[] | undefined) ?? []).map((it) => it.image))].filter(Boolean) as string[]), ...(surface ? [surface.image] : [])])];
  const key = srcs.join("|");
  useEffect(() => {
    Promise.all(srcs.map((s) => loadImage(staticFile(s)).then((im) => [s, im] as const)))
      .then((pairs) => { const m = Object.fromEntries(pairs); Object.assign(FILLS, m); setImgs(m); continueRender(handle); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, handle]);

  const { durationInFrames } = useVideoConfig();
  const msRaw = (fRaw / fps) * 1000;
  const cam = camAt(props, fRaw / Math.max(1, durationInFrames - 1), msRaw, words); // kamera akıcı (basamaklanmaz)
  const shake = stampShake(layers, msRaw, words);
  const dof = dofAt(props, msRaw, words);
  const light = props.light === false ? null : { x: 0.25, y: -0.05, strength: 0.6, color: "#FFE2AE", vignette: 0.55, ...((props.light as object) ?? {}) } as
    { x: number; y: number; strength: number; color: string; vignette: number; sweepAt?: unknown; sweepMs?: number; sweepAngle?: number; sweepDir?: number;
      to?: { x: number; y: number }; breathe?: number; breatheS?: number; pulseAt?: unknown };
  { const lf = props.light as { fadeTo?: number; fadeAt?: unknown; fadeMs?: number } | undefined;   // ışık gücü zamanla (EP010 s05: lambalar söner)
    if (light && lf && lf.fadeTo !== undefined) light.strength += (lf.fadeTo - light.strength) * EASE.cubic(clamp01((msRaw - atMs(lf.fadeAt ?? 0, words)) / (lf.fadeMs ?? 1200))); }
  if (light?.to) { // ışık kaynağı sahne boyunca kayar
    const k = Easing.inOut(Easing.sin)(fRaw / Math.max(1, durationInFrames - 1));
    light.x = light.x + (light.to.x - light.x) * k; light.y = light.y + (light.to.y - light.y) * k;
  }
  { const vx = 0.5 - (light?.x ?? 0.3), vy = 0.45 - (light?.y ?? -0.2), n = Math.hypot(vx, vy) || 1; SH = { x: vx / n, y: vy / n }; }
  // props.lightWrap: true | { color (ışık rengi), size (px, 18), strength (0.55) }
  WRAP = props.lightWrap ? { color: light?.color ?? bg, size: 18, strength: 0.55, ...(props.lightWrap === true ? {} : (props.lightWrap as object)) } : null;
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx || !imgs) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.filter = "none";
    ctx.globalAlpha = 1;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    DOCMAP = { x: (u) => u * W, y: (v) => v * H, zoom: 1 }; // route/pin: doc yoksa kare koordinatı
    if (surface && imgs[surface.image]) { // gerçek masa yüzeyi: doku kareyi taşacak kadar büyük çizilir (kamera kayınca kenar görünmesin)
      const im = imgs[surface.image], span = (surface.span ?? 1.4) * W;
      ctx.save();
      applyCam(ctx, cam, surface.depth ?? 0.7, W, H);
      if (dof) ctx.filter = `blur(${(dof.amount * Math.abs((surface.depth ?? 0.7) - dof.focus)).toFixed(1)}px)`; // alan derinliği zemine de (en uzak düzlem)
      const sh = span * (im.height / im.width);
      ctx.drawImage(im, W / 2 - span / 2, H / 2 - Math.max(sh, H * 1.3) / 2, span, Math.max(sh, H * 1.3));
      if (surface.tint) { ctx.globalCompositeOperation = "multiply"; ctx.fillStyle = surface.tint; ctx.fillRect(-W, -H, 3 * W, 3 * H); }
      ctx.restore();
    }
    const main = ctx;
    for (const l of layers) {
      const im = l.image ? imgs[l.image] : undefined;
      const v = vis(l, ms, words);
      if (v <= 0) continue;
      // alan derinliği: odak derinliğinden uzak katman bulanık (ayrı tuvale çizilip blur ile basılır)
      const depth = (l.depth as number) ?? (l.type === "piece" ? 0.85 : 1);
      const blurPx = dof && !["dust", "clouds", "dim", "ruler"].includes(l.type) ? ((l.blur as number) ?? dof.amount * Math.abs(depth - dof.focus)) : 0;
      // eslint-disable-next-line no-param-reassign
      const ctx = blurPx > 0.3 ? offCtx(W, H) : main;
      ctx.save();
      ctx.globalAlpha = v;
      applyCam(ctx, cam, (l.depth as number) ?? (l.type === "piece" ? 0.85 : 1), W, H);
      if ((boil || wobble) && (l.type === "piece" || l.type === "cutout" || l.type === "print")) { // stop-motion titremesi + yavaş sallanma
        const li = layers.indexOf(l), j = (k: number) => rnd(stepId * 7.13 + li * 31.7 + k) - 0.5;
        // seçici titreme: ana kesik az, kâğıt parçaları çok; yerine oturduktan sonra %35'e iner
        const b = ((l.boil as number) ?? (l.type === "cutout" ? boil * 0.3 : boil)) * settle(l, f, fps, words);
        const cx = l.x * W, cy = l.y * H;
        const wob = wobble * Math.sin((f / fps) * 2 * Math.PI / (3.2 + li * 0.7) + li);
        ctx.translate(cx + j(1) * 2 * b, cy + j(2) * 2 * b);
        ctx.rotate(((j(3) * 0.8 * b + wob) * Math.PI) / 180);
        ctx.translate(-cx, -cy);
      }
      if (l.type === "cutout" || l.type === "print" || l.type === "piece") layerMotion(ctx, l, ms, words, W, H, atMs); // keys / spin / shrink / opacity (EP010)
      if (l.osc && (l.type === "cutout" || l.type === "print") && im) { // salınım: pivot etrafında Hz'li dönme (irregular: düzensiz)
        const o = l.osc as { hz?: number; amp?: number; pivot?: [number, number]; irregular?: number; at?: unknown };
        const t = Math.max(0, msRaw - atMs(o.at ?? 0, words)) / 1000, hz = o.hz ?? 1, irr = o.irregular ?? 0;
        const [iw, ih] = l.size as [number, number];
        const hgt = l.type === "cutout" ? (l.height as number) * H : ((l.w as number) * W) * (ih / iw), wid = l.type === "cutout" ? hgt * (iw / ih) : (l.w as number) * W;
        const [px, py] = o.pivot ?? [0.5, 0.5], cx = (l.x as number) * W + (px - 0.5) * wid, cy = (l.y as number) * H + (py - 0.5) * hgt;
        const ang = (o.amp ?? 10) * Math.sin(2 * Math.PI * hz * t + irr * 2.2 * Math.sin(2 * Math.PI * 0.37 * t)) * (1 + irr * 0.45 * Math.sin(2 * Math.PI * 0.23 * t + 1));
        ctx.translate(cx, cy); ctx.rotate((ang * Math.PI) / 180); ctx.translate(-cx, -cy);
      }
      if (l.type === "doc" && im) DOCMAP = drawDoc(ctx, l, im, ms, words, W, H);
      if (l.type === "graticule") drawGraticule(ctx, l, msRaw, words, DOCMAP, theme.accent);
      if (l.type === "wedge") drawWedge(ctx, l, ms, words, DOCMAP, theme.accent);
      if (l.type === "ship") drawShip(ctx, l, ms, fps, words, DOCMAP, SH, stepId, im);
      if (l.type === "ruler") drawRuler(ctx, l, ms, words, DOCMAP, W, H);
      if (l.type === "clock") drawClock(ctx, l, ms, fps, words, W, H, SH, entry);
      if (l.type === "clouds") drawClouds(ctx, l, ms, words, W, H, imgs, SH);
      if (l.type === "dim") drawDim(ctx, l, ms, words, W, H, offCtx(W, H));
      if (l.type === "route") drawRoute(ctx, l, msRaw, words);
      if (l.type === "pin") drawPin(ctx, l, ms, words, theme.accent);
      if (l.type === "cutout" && im) drawCutout(ctx, l, im, f, fps, words, W, H);
      if (l.type === "piece") drawPiece(ctx, l, f, fps, words, W, H, l.texture ? imgs[l.texture] : undefined);
      if (l.type === "print" && im) drawPrint(ctx, l, im, f, fps, words, W, H, l.texture ? imgs[l.texture] : undefined);
      if (l.type === "dust") drawDust(ctx, l, f, fps, W, H);
      if (l.type === "dial") drawDial(ctx, l, ms, words, W, H, imgs, atMs);
      if (l.type === "iconBar") drawIconBar(ctx, l, im, ms, words, W, H, atMs);
      if (l.type === "chartBaseline") drawChartBaseline(ctx, l, W, H);
      if (l.type === "chartAxes") drawChartAxes(ctx, l, W, H);
      if (l.type === "chartDot") drawChartDot(ctx, l, ms, words, W, atMs);
      if (l.type === "chartCurve") drawChartCurve(ctx, l, ms, words, W, atMs);
      if (l.type === "chartBand") drawChartBand(ctx, l, ms, words, W, atMs);
      if (l.type === "chartBracket") drawChartBracket(ctx, l, im, ms, words, W, atMs);
      ctx.restore();
      if (ctx !== main) { main.save(); main.filter = `blur(${blurPx.toFixed(1)}px)`; main.drawImage(ctx.canvas, 0, 0); main.restore(); }
    }
  });

  return (
    <AbsoluteFill style={{ backgroundColor: bg }}>
      <AbsoluteFill style={{ transform: `translate(${shake.x}px, ${shake.y}px) perspective(1800px) rotateX(${cam.tilt}deg) rotateY(${cam.turn}deg) scale(${(cam.tilt || cam.turn ? 1.06 : 1) * (shake.x || shake.y ? 1.02 : 1)})`, transformOrigin: "50% 45%" }}>
        <canvas ref={ref} width={W} height={H} style={{ position: "absolute", width: W, height: H, filter: dof?.settle ? `blur(${dof.settle.toFixed(1)}px)` : undefined }} />
        <Annotations layers={layers} words={words} ms={ms} W={W} H={H} />
        <Titles layers={layers} words={words} ms={ms} f={f} fps={fps} W={W} H={H} boil={boil} stepId={stepId} accent={theme.accent} msRaw={msRaw} />
        <Counters layers={layers} words={words} ms={msRaw} W={W} H={H} />
        <Stamps layers={layers} words={words} ms={msRaw} W={W} H={H} />
      </AbsoluteFill>
      {light && <Lighting {...light} ms={msRaw} words={words} W={W} H={H} />}
      {!!props.halftone && <Halftone {...(props.halftone === true ? {} : (props.halftone as object))} W={W} H={H} />}
      <Paper opacity={paper} frame={f} W={W} H={H} />
      {typeof props.credit === "string" && <Credit text={props.credit} />}
      {!!props.film && <Film {...(props.film === true ? {} : (props.film as object))} frame={fRaw} fps={fps} W={W} H={H} />}
    </AbsoluteFill>
  );
};

// Belge: kapak (cover) + odak/zoom kamerası; moveAt'te from → to geçişi; fosforlu kalem görsel koordinatında (kamerayla birlikte hareket eder)
// ease: "heavy" (varsayılan) | "cubic" | … · highlight soldan sağa fosfor gibi süpürülür (sweepMs 600, expoOut, eğik kenar)
// dönüş: görsel 0-1 koordinatı → ekran (route/pin aynı haritaya çizilir)
function drawDoc(ctx: CanvasRenderingContext2D, l: Layer, im: HTMLImageElement, ms: number, words: Word[], W: number, H: number): DocMap {
  const [iw, ih] = l.size as [number, number];
  const t0 = atMs(l.moveAt ?? 0, words), dur = (l.moveMs as number) ?? 900;
  const p = interpolate(ms, [t0, t0 + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease(l.ease, "heavy") });
  // drift: hiç durmayan hafif yaklaşma (8 sn'de +%3); false = yok (aynı tuvalde devam eden sahneler: s02→s03, s14→s15)
  const drift = l.drift === false ? 0 : interpolate(ms, [0, 8000], [0, (l.drift as number) ?? 0.03]);
  const A = l.from as Focus, B = (l.to as Focus) ?? A;
  let ox = A.x + (B.x - A.x) * p, oy = A.y + (B.y - A.y) * p, zb = A.zoom + (B.zoom - A.zoom) * p;
  // keys: [{ at, ms, x, y, zoom, ease? ("sin") }] → to'dan sonra sırayla ek kamera durakları (rota boyunca takip, varışta punch-in)
  // anchor: [sx, sy] odak noktasının ekrandaki yeri (varsayılan odakla aynı: [x, y]); keys[].anchor ile durakta değişir.
  // Tuzak: zoom 1'de doc yüksekliği = kare yüksekliği → anchor.y odak v'sinden farklıysa üstte/altta boş bant; zoom × v ≥ anchor.y ≥ 1 − zoom × (1 − v) tut.
  let an = (l.anchor as [number, number] | undefined) ?? null;
  for (const k of ((l.keys as (Focus & { at: unknown; ms?: number; ease?: string; anchor?: [number, number] })[]) ?? [])) {
    const q = ease(k.ease, "sin")(clamp01((ms - atMs(k.at, words)) / (k.ms ?? 1200)));
    const b0 = an ?? [ox, oy];
    if (k.anchor) an = [b0[0] + (k.anchor[0] - b0[0]) * q, b0[1] + (k.anchor[1] - b0[1]) * q];
    ox += (k.x - ox) * q; oy += (k.y - oy) * q; zb = lerpScale(zb, k.zoom, q);
  }
  const zoom = zb * (1 + drift);
  if (!an) an = [ox, oy];
  const c = Math.max(W / iw, H / ih), dw = iw * c, dh = ih * c;
  // görsel pikseli → ekran
  const sx = (x: number) => an[0] * W + zoom * (x * c - ox * dw);
  const sy = (y: number) => an[1] * H + zoom * (y * c - oy * dh);
  ctx.save();
  ctx.translate(an[0] * W, an[1] * H);
  ctx.scale(zoom, zoom);
  ctx.translate(-ox * dw, -oy * dh);
  ctx.drawImage(im, 0, 0, dw, dh);
  ctx.restore();
  const map: DocMap = { x: (u) => sx(u * iw), y: (v) => sy(v * ih), zoom: zoom * c * Math.max(iw / W, ih / H) };
  const hl = l.highlight as { x: number; y: number; w: number; h: number } | undefined;
  if (!hl) return map;
  const h0 = atMs(l.highlightAt ?? t0 + dur, words);
  const q = EASE.expoOut(clamp01((ms - h0) / ((l.sweepMs as number) ?? 600)));
  if (q <= 0) return map;
  const x1 = sx(hl.x), y1 = sy(hl.y), x2 = sx(hl.x + hl.w), y2 = sy(hl.y + hl.h);
  if (l.dim) { // vurgulanan satır dışını karart
    ctx.save();
    ctx.fillStyle = `rgba(10, 12, 20, ${0.45 * q})`;
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.rect(x1 - 18, y1 - 14, x2 - x1 + 36, y2 - y1 + 28);
    ctx.fill("evenodd");
    ctx.restore();
  }
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = HILITE;
  const pad = (y2 - y1) * 0.12, sk = (y2 - y1) * 0.22, xa = x1 - 8, xb = xa + (x2 - x1 + 16) * q;
  ctx.beginPath(); // eğik kenarlı fosfor şeridi
  ctx.moveTo(xa + sk, y1 - pad); ctx.lineTo(xb + sk, y1 - pad); ctx.lineTo(xb, y2 + pad); ctx.lineTo(xa, y2 + pad); ctx.closePath();
  ctx.fill();
  ctx.restore();
  return map;
}

type DocMap = { x: (u: number) => number; y: (v: number) => number; zoom: number };
let DOCMAP: DocMap = { x: (u) => u, y: (v) => v, zoom: 1 };

// Rota: doc görselinin 0-1 noktaları, kenar başına bend kadar kavisli; easeInOutCubic ile çizilir, kesik çizgi march px/sn kayar,
// altında 2 kat kalın krem kontur
function drawRoute(ctx: CanvasRenderingContext2D, l: Layer, ms: number, words: Word[]) {
  const t0 = atMs(l.at ?? 0, words), p = EASE.cubic(clamp01((ms - t0) / ((l.ms as number) ?? 1800)));
  if (p <= 0) return;
  const fo = l.fadeOut as number | undefined, fk = fo ? 1 - clamp01((ms - t0 - ((l.ms as number) ?? 1800)) / fo) : 1;   // fadeOut: çizildikten sonra söner
  if (fk <= 0) return;
  const P = (l.points as [number, number][]).map(([u, v]) => [DOCMAP.x(u), DOCMAP.y(v)] as const), bend = (l.bend as number) ?? 0.18;
  const pts: [number, number][] = [];
  for (let i = 0; i + 1 < P.length; i++) {
    const [ax, ay] = P[i], [bx, by] = P[i + 1], L = Math.hypot(bx - ax, by - ay) || 1;
    const cx = (ax + bx) / 2 + ((by - ay) / L) * L * bend * (i % 2 ? -1 : 1), cy = (ay + by) / 2 - ((bx - ax) / L) * L * bend * (i % 2 ? -1 : 1);
    for (let k = i ? 1 : 0; k <= 32; k++) { const t = k / 32; pts.push([(1 - t) ** 2 * ax + 2 * (1 - t) * t * cx + t * t * bx, (1 - t) ** 2 * ay + 2 * (1 - t) * t * cy + t * t * by]); }
  }
  const seg = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1])), total = seg.reduce((s, x) => s + x, 0);
  let left = total * p;
  ctx.save();
  ctx.globalAlpha *= fk;
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < seg.length && left > 0; i++) {
    const r = Math.min(1, left / (seg[i] || 1));
    ctx.lineTo(pts[i][0] + (pts[i + 1][0] - pts[i][0]) * r, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * r); left -= seg[i];
  }
  const w = (l.width as number) ?? 9;
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(246, 240, 226, 0.9)"; ctx.lineWidth = w * 2; ctx.filter = shadow(3, 4, 0.25); ctx.stroke();
  ctx.filter = "none";
  const dash = Array.isArray(l.dash) ? (l.dash as number[]) : [14, 9];
  ctx.setLineDash(dash); ctx.lineDashOffset = -(((l.march as number) ?? 40) * ms) / 1000;
  ctx.strokeStyle = (l.color as string) ?? "#B8322A"; ctx.lineWidth = w; ctx.stroke();
  ctx.restore();
}

// İğne: back-out ile büyüyen nokta + gölgeli etiket kartı (solunda vurgu şeridi); dir kartın yönü
function drawPin(ctx: CanvasRenderingContext2D, l: Layer, ms: number, words: Word[], accent: string) {
  const t0 = atMs(l.at ?? 0, words), q = clamp01((ms - t0) / 450);
  if (q <= 0) return;
  const s = EASE.backOut(q), big = !!l.big, x = DOCMAP.x(l.x), y = DOCMAP.y(l.y), r = (big ? 20 : 14) * s;
  ctx.save();
  ctx.globalAlpha *= (l.opacity as number) ?? 1;   // opacity: soluk iğne (IYH001 "and beyond")
  ctx.filter = shadow(4, 6, 0.35);
  ctx.fillStyle = "#F6F0E2"; ctx.beginPath(); ctx.arc(x, y, r + 6 * s, 0, Math.PI * 2); ctx.fill();
  ctx.filter = "none"; ctx.fillStyle = (l.color as string) ?? "#B8322A"; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  if (!l.label && !l.tag) { ctx.restore(); return; }   // etiketsiz iğne: yalnız nokta
  if (l.tag) { // E2 ad kutusu: sarı (vurgu) zemin, siyah kalın yazı, ±2° eğik, soldan maske silmesi; nokta + kısa lider çizgi
    const txt = String(l.label ?? ""), fs2 = (l.size as number) ?? 54, dir = (l.dir as string) ?? "r";
    ctx.font = `900 ${fs2}px ${INTER}`;
    const tw = ctx.measureText(txt).width, bw = tw + 52, bh = fs2 + 30, gap = r + 26;
    const bx = dir === "l" ? x - gap - bw : dir === "r" ? x + gap : x - bw / 2, by = dir === "u" ? y - gap - bh : dir === "d" ? y + gap : y - bh / 2;
    const wq = EASE.expoOut(clamp01((ms - t0 - 120) / 420));
    ctx.strokeStyle = "#14213D"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y);
    ctx.lineTo(dir === "l" ? bx + bw : dir === "r" ? bx : bx + bw / 2, dir === "u" ? by + bh : dir === "d" ? by : by + bh / 2); ctx.stroke();
    ctx.translate(bx + bw / 2, by + bh / 2); ctx.rotate((((l.rot as number) ?? -2) * Math.PI) / 180);
    ctx.beginPath(); ctx.rect(-bw / 2 - 4, -bh / 2 - 4, (bw + 8) * wq, bh + 8); ctx.clip();
    ctx.filter = shadow(6, 10, 0.35); ctx.fillStyle = (l.bg as string) ?? accent; ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
    ctx.filter = "none"; ctx.fillStyle = "#14213D"; ctx.textBaseline = "middle"; ctx.fillText(txt, -bw / 2 + 26, 2);
    ctx.restore();
    return;
  }
  const label = String(l.label ?? ""), sub = l.sub ? String(l.sub) : "";
  const fs = big ? 52 : 40, ss = big ? 30 : 26;
  ctx.font = `900 ${fs}px ${INTER}`; const tw = ctx.measureText(label).width;
  ctx.font = `500 ${ss}px ${INTER}`; const sw = sub ? ctx.measureText(sub).width : 0;
  const cw = Math.max(tw, sw) + 56, ch = fs + (sub ? ss + 14 : 0) + 34, gap = r + 22;
  const dir = (l.dir as string) ?? "r";
  const bx = dir === "l" ? x - gap - cw : dir === "r" ? x + gap : x - cw / 2, by = dir === "u" ? y - gap - ch : dir === "d" ? y + gap : y - ch / 2;
  ctx.globalAlpha *= clamp01(q * 2);
  ctx.translate(bx + cw / 2, by + ch / 2); ctx.scale(0.85 + 0.15 * s, 0.85 + 0.15 * s); ctx.translate(-cw / 2, -ch / 2);
  ctx.filter = shadow(8, 12, 0.3); ctx.fillStyle = "#F4EFE4"; ctx.fillRect(0, 0, cw, ch);
  ctx.filter = "none"; ctx.fillStyle = (l.accent as string) ?? accent; ctx.fillRect(0, 0, 5, ch);
  ctx.fillStyle = "#14213D"; ctx.textBaseline = "top";
  ctx.font = `900 ${fs}px ${INTER}`; ctx.fillText(label, 30, 17);
  if (sub) { ctx.font = `500 ${ss}px ${INTER}`; ctx.fillStyle = "#4A5468"; ctx.fillText(sub, 30, 17 + fs + 10); }
  ctx.restore();
}

// Damga sarsıntısı: çarpma anında 0.5 sn sönen tek seferlik kamera sarsıntısı (shake px; ağırbaşlı konuda 0)
function stampShake(layers: Layer[], ms: number, words: Word[]) {
  let x = 0, y = 0;
  for (const l of layers) {
    if (l.type !== "stamp" || !l.shake) continue;
    const t = ms - atMs(l.at ?? 0, words) - 200;
    if (t < 0 || t > 500) continue;
    const a = (l.shake as number) * Math.pow(1 - t / 500, 2);
    x += a * Math.sin(t * 0.09); y += a * 0.7 * Math.cos(t * 0.13);
  }
  return { x, y };
}

// Kesik: siyah-beyaz, gölgeli, yay (spring) ile giriş, sonra çok hafif büyüme
function drawCutout(ctx: CanvasRenderingContext2D, l: Layer, im: HTMLImageElement, f: number, fps: number, words: Word[], W: number, H: number) {
  const [iw, ih] = l.size as [number, number];
  const startF = Math.round((atMs(l.enterAt ?? 0, words) / 1000) * fps);
  const directional = ["left", "right", "top", "bottom"].includes(String(l.from ?? l.enter));
  const s = spring({ frame: f - startF, fps, config: directional ? { damping: 12, stiffness: 70, mass: 1.1 } : { damping: 15, stiffness: 120, mass: 0.9 } });
  if (f < startF) return;
  const drift = 1 + ((l.drift as number) ?? 0.04) * interpolate(f - startF, [0, fps * 8], [0, 1], { extrapolateRight: "clamp" });
  const enter = (l.from as string) ?? (l.enter as string) ?? "pop";
  let dx = 0, dy = 0, sc = 1, rot = 0;
  const e = entry(enter, s, W, H, (l.seed as number) ?? 3);
  if (e) { dx = e.dx; dy = e.dy; rot = (e.rot * Math.PI) / 180; }
  if (enter === "pop") sc = 0.6 + 0.4 * s;
  if (enter === "left") dx = -(1 - s) * W * 0.9;
  if (enter === "right") dx = (1 - s) * W * 0.9;
  if (enter === "drop") { dy = -(1 - s) * H * 0.6; rot = (1 - s) * -0.12; }
  const h = (l.height as number) * H * sc * drift, w = h * (iw / ih);
  const cx = (l.x as number) * W + dx, cy = (l.y as number) * H + dy;
  ctx.save();
  ctx.globalAlpha *= Math.min(1, s * 1.6);
  ctx.translate(cx, cy);
  ctx.rotate(rot + (((l.rot as number) ?? 0) * Math.PI) / 180);
  ctx.filter = `${l.bw === false ? "" : "grayscale(1) contrast(1.18) brightness(1.04)"} ${shadow(26, 26, l.shadow === false ? 0 : 0.4)}`;
  ctx.drawImage(im, -w / 2, -h / 2, w, h);
  const planes = l.planes as { image: string; k: number }[] | undefined;
  if (planes?.length) { // derinlik kartları (image = L1 arka dilim, planes = yakın dilimler): yakın dilim giriş anından itibaren hafif kayar
    const u = Math.min(1, Math.max(0, (f - startF) / (fps * 6))), drift = (l.planeDrift as number) ?? 0.05;
    ctx.filter = `${l.bw === false ? "" : "grayscale(1) contrast(1.18) brightness(1.04)"}`.trim() || "none";
    for (const p of planes) {
      const pim = FILLS[p.image]; if (!pim) continue;
      const sc = 1 + (p.k - 1) * 0.035 * u;
      ctx.drawImage(pim, -w * sc / 2 + (p.k - 1) * drift * w * u, -h * sc / 2 + h * (sc - 1) * 0.5, w * sc, h * sc);
    }
  }
  // element deliğine dolgu (fill: { image, size, x?, y? (odak 0-1), zoom?, filter? }): ör. çerçevenin içinde portre; hole/holeShape build_timeline'dan
  const fill = l.fill as { image: string; size: [number, number]; x?: number; y?: number; zoom?: number; filter?: string; hideAt?: unknown; hideMs?: number } | undefined;
  // fill.hideAt: dolgu bu anda söner (hideMs, 600) → elementin kendi deliği (ör. H4 kadranı) geri gelir
  const hole = l.hole as { x: number; y: number; w: number; h: number } | undefined;
  if (fill && hole && FILLS[fill.image]) {
    const fim = FILLS[fill.image], hw = hole.w * w, hh = hole.h * h, hx = (hole.x - 0.5) * w, hy = (hole.y - 0.5) * h;
    ctx.save();
    if (fill.hideAt !== undefined) ctx.globalAlpha *= 1 - EASE.cubic(clamp01(((f / fps) * 1000 - atMs(fill.hideAt, words)) / (fill.hideMs ?? 600)));
    ctx.filter = fill.filter ?? "sepia(0.55) contrast(1.05)";
    ctx.beginPath();
    if (l.holeShape === "circle") ctx.ellipse(hx, hy, hw / 2, hh / 2, 0, 0, Math.PI * 2); else ctx.rect(hx - hw / 2, hy - hh / 2, hw, hh);
    ctx.clip();
    const [fw, fh] = fill.size, c = Math.max(hw / fw, hh / fh) * (fill.zoom ?? 1);
    ctx.drawImage(fim, hx - (fill.x ?? 0.5) * fw * c, hy - (fill.y ?? 0.35) * fh * c, fw * c, fh * c);
    ctx.restore();
  }
  if (WRAP) { ctx.filter = "none"; lightWrap(ctx, im, w, h, WRAP); }
  if (l.tape) { // yarı saydam kâğıt bant, üst kenarda hafif eğik
    ctx.filter = shadow(4, 4, 0.18);
    ctx.rotate(-0.06);
    ctx.fillStyle = "rgba(236, 224, 196, 0.82)";
    tornPath(ctx, -w * 0.13, -h / 2 - h * 0.035, w * 0.26, h * 0.07, 11, 3);
    ctx.fill();
  }
  ctx.restore();
}

// Kolaj kâğıt parçası: yırtık kenarlı dörtgen, gölgeli, hafif dönerek gelir
function drawPiece(ctx: CanvasRenderingContext2D, l: Layer, f: number, fps: number, words: Word[], W: number, H: number, tex?: HTMLImageElement) {
  const startF = Math.round((atMs(l.enterAt ?? 0, words) / 1000) * fps);
  if (f < startF) return;
  const e0 = entry(l.from, 0, W, H, 1);
  const s = spring({ frame: f - startF, fps, config: e0 ? { damping: 12, stiffness: 70, mass: 1.1 } : { damping: 16, stiffness: 110 } });
  const w = l.w * W, h = l.h * H;
  const e = entry(l.from, s, W, H, (l.seed as number) ?? 1);
  ctx.save();
  ctx.globalAlpha *= e ? 1 : Math.min(1, s * 1.5);
  ctx.translate(l.x * W + (e?.dx ?? 0), l.y * H + (e ? e.dy : (1 - s) * 60));
  ctx.rotate(((((l.rot as number) ?? 0) * (e ? 1 : 0.6 + 0.4 * s)) + (e?.rot ?? 0)) * Math.PI / 180);
  const seed = (l.seed as number) ?? 1;
  // yığın: alttaki yapraklar önce, her biri biraz kayık/dönük, kendi gölgesiyle (kâğıt katmanları)
  const n = (l.stack as number) ?? 0, spread = (l.stackSpread as number) ?? 2.4;
  for (let k = n; k >= 1; k--) {
    ctx.save();
    ctx.translate(k * w * 0.012 * (k % 2 ? 1 : -1.4), k * h * 0.018);
    ctx.rotate(((k % 2 ? 1 : -1) * spread * (0.6 + 0.4 * k) * Math.PI) / 180);
    paperSheet(ctx, w, h, seed + k * 13, (l.stackColor as string) ?? (l.color as string) ?? "#EDE6D6", tex, l.tint as string, 0.9 - 0.06 * k, 0);
    ctx.restore();
  }
  paperSheet(ctx, w, h, seed, (l.color as string) ?? "#F4EFE4", tex, l.tint as string, 1, (l.grid as number) ?? 0);
  ctx.restore();
}

// Tek kâğıt yaprağı (merkez orijinde): yırtık kenar, gölge, isteğe bağlı taranmış doku + renk tonu
// Önbellek: yaprak hiç değişmez (yırtık kenar, lif, tane, doku, gölge) → bir kez ayrı tuvale çizilir, sonra her karede drawImage.
// Anahtar gölge yönünü de içerir (ışık kayarsa 0.1 adımlarla yenilenir). Render ~2-4 kat hızlanır (2026-11-01 ölçümü DECISIONS'ta).
const SHEETS = new Map<string, HTMLCanvasElement>();
function paperSheet(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number, color: string, tex: HTMLImageElement | undefined,
  tint: string | undefined, light: number, grid: number) {
  const key = [Math.round(w), Math.round(h), seed, color, tex?.src ?? "", tint ?? "", light.toFixed(2), grid, SH.x.toFixed(1), SH.y.toFixed(1)].join("|");
  let c = SHEETS.get(key);
  const pad = 60;
  if (!c) {
    c = document.createElement("canvas");
    c.width = Math.ceil(w) + 2 * pad; c.height = Math.ceil(h) + 2 * pad;
    const g = c.getContext("2d")!;
    g.translate(c.width / 2, c.height / 2);
    paperSheetDraw(g, w, h, seed, color, tex, tint, light, grid);
    if (SHEETS.size > 200) SHEETS.clear();
    SHEETS.set(key, c);
  }
  const fl = ctx.filter; ctx.filter = "none";
  ctx.drawImage(c, -c.width / 2, -c.height / 2);
  ctx.filter = fl;
}
function paperSheetDraw(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number, color: string, tex: HTMLImageElement | undefined,
  tint: string | undefined, light: number, grid: number) {
  // 1) lif çekirdeği: yırtık dış kenar, beyazımsı, gölgeli  2) renkli üst yüz: içeri çekilmiş, kendi pürüzüyle  3) taşan lifler
  const outer = tornPts(-w / 2, -h / 2, w, h, seed, 16), top = tornPts(-w / 2, -h / 2, w, h, seed, 16, 5);
  dropPath(ctx, outer, 9, "#F6F3EC");
  ctx.save(); tracePts(ctx, outer); ctx.clip(); grainOver(ctx, -w / 2 - 12, -h / 2 - 12, w + 24, h + 24, seed + 50, 0.5); ctx.restore();
  fibers(ctx, outer, seed);
  ctx.save();
  tracePts(ctx, top);
  ctx.clip();
  ctx.fillStyle = color; ctx.fillRect(-w / 2 - 20, -h / 2 - 20, w + 40, h + 40);
  if (tex) {
    texFill(ctx, tex, -w / 2, -h / 2, w, h, seed);
    if (tint) { ctx.globalCompositeOperation = "multiply"; ctx.fillStyle = tint; ctx.fillRect(-w / 2 - 20, -h / 2 - 20, w + 40, h + 40); }
  }
  ctx.globalCompositeOperation = "source-over";
  grainOver(ctx, -w / 2, -h / 2, w, h, seed, tex ? 0.35 : 0.7);
  sheetShade(ctx, w, h);
  ctx.restore();
  if (grid > 0) { // mühendislik kâğıdı: ince mavi kareler, her 5'te bir koyu
    ctx.save();
    tracePts(ctx, top);
    ctx.clip();
    for (let i = 0, x = -w / 2; x < w / 2; x += grid, i++) {
      ctx.strokeStyle = i % 5 ? "rgba(60,120,190,0.16)" : "rgba(60,120,190,0.32)"; ctx.lineWidth = i % 5 ? 1.2 : 2;
      ctx.beginPath(); ctx.moveTo(x, -h / 2); ctx.lineTo(x, h / 2); ctx.stroke();
    }
    for (let i = 0, y = -h / 2; y < h / 2; y += grid, i++) {
      ctx.strokeStyle = i % 5 ? "rgba(60,120,190,0.16)" : "rgba(60,120,190,0.32)"; ctx.lineWidth = i % 5 ? 1.2 : 2;
      ctx.beginPath(); ctx.moveTo(-w / 2, y); ctx.lineTo(w / 2, y); ctx.stroke();
    }
    ctx.restore();
  }
  if (light < 1) { ctx.save(); tracePts(ctx, outer); ctx.fillStyle = `rgba(30,20,10,${(1 - light).toFixed(2)})`; ctx.fill(); ctx.restore(); }
}

// Doku: kâğıdın boyutuna göre dokudan bir bölge (tohuma göre farklı yer) — doku ~1.6 kare genişliğini kaplar, ölçek tutarlı
function texFill(ctx: CanvasRenderingContext2D, tex: HTMLImageElement, x: number, y: number, w: number, h: number, seed: number) {
  const k = tex.width / (ctx.canvas.width * 1.6);
  const sw = Math.min(tex.width, w * k), sh = Math.min(tex.height, h * k);
  const sx = rnd(seed * 3.7) * (tex.width - sw), sy = rnd(seed * 5.3) * (tex.height - sh);
  ctx.drawImage(tex, sx, sy, sw, sh, x, y, w, h);
}

// Baskı: kâğıda basılmış fotoğraf/harita — beyaz kenar (dokulu), gölge, köşe bantları; ekran dışından gelebilir
function drawPrint(ctx: CanvasRenderingContext2D, l: Layer, im: HTMLImageElement, f: number, fps: number, words: Word[], W: number, H: number,
  tex?: HTMLImageElement) {
  const startF = Math.round((atMs(l.enterAt ?? 0, words) / 1000) * fps);
  if (f < startF) return;
  const e0 = entry(l.from, 0, W, H, 1);
  const s = spring({ frame: f - startF, fps, config: e0 ? { damping: 12, stiffness: 70, mass: 1.1 } : { damping: 15, stiffness: 120, mass: 0.9 } });
  const [iw, ih] = l.size as [number, number];
  const w = (l.w as number) * W, b = w * ((l.border as number) ?? 0.045), h = (w - 2 * b) * (ih / iw) + 2 * b;
  const e = entry(l.from, s, W, H, (l.seed as number) ?? 2);
  const seed = (l.seed as number) ?? 2;
  ctx.save();
  ctx.globalAlpha *= e ? 1 : Math.min(1, s * 1.6);
  ctx.translate(l.x * W + (e?.dx ?? 0), l.y * H + (e?.dy ?? 0));
  ctx.rotate(((((l.rot as number) ?? 0) + (e?.rot ?? 0)) * Math.PI) / 180);
  if (!e) ctx.scale(0.7 + 0.3 * s, 0.7 + 0.3 * s);
  // baskının kendisi zamana bağlı değil → önbellekten (giriş hareketi yukarıdaki dönüşümde)
  const key = [l.image, Math.round(w), Math.round(h), seed, l.bw ? 1 : 0, l.tape ?? "corners", tex?.src ?? "", SH.x.toFixed(1), SH.y.toFixed(1)].join("|");
  let c = PRINTS.get(key);
  if (!c) {
    const pad = 80;
    c = document.createElement("canvas"); c.width = Math.ceil(w) + 2 * pad; c.height = Math.ceil(h) + 2 * pad;
    const g = c.getContext("2d")!;
    g.translate(c.width / 2, c.height / 2);
    printBody(g, l, im, w, h, b, seed, tex);
    if (PRINTS.size > 100) PRINTS.clear();
    PRINTS.set(key, c);
  }
  ctx.drawImage(c, -c.width / 2, -c.height / 2);
  const planes = l.planes as { image: string; k: number }[] | undefined;
  if (planes?.length) { // derinlik kartları: fotoğraf alanında kendi hızlarında kayar (kâğıt, kenar, bant sabit)
    const u = Math.min(1, Math.max(0, (f - startF) / (fps * 6))), drift = (l.planeDrift as number) ?? 0.05;
    const iw2 = w - 2 * b, ih2 = h - 2 * b, flt = l.bw ? "grayscale(1) contrast(1.15)" : "saturate(0.9) contrast(1.04)";
    ctx.save(); ctx.beginPath(); ctx.rect(-w / 2 + b, -h / 2 + b, iw2, ih2); ctx.clip();
    for (const p of planes) {
      const pim = FILLS[p.image]; if (!pim) continue;
      const sc = 1 + (p.k - 1) * 0.035 * u, dx = (p.k - 1) * drift * iw2 * u, pw = iw2 * sc, ph = ih2 * sc;
      const x = -pw / 2 + dx, y = -ph / 2;
      const sil = planeSil(pim);                               // kâğıt rengi siluet (altındaki kartı örter), sonra çarpma + %35 normal (printBody ile aynı)
      ctx.drawImage(sil, x, y, pw, ph);
      ctx.globalCompositeOperation = "multiply"; ctx.filter = `${flt} blur(0.6px)`; ctx.drawImage(pim, x, y, pw, ph);
      ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha *= 0.35; ctx.filter = flt; ctx.drawImage(pim, x, y, pw, ph);
      ctx.globalAlpha /= 0.35; ctx.filter = "none";
    }
    ctx.restore();
  }
  ctx.restore();
}
const PRINTS = new Map<string, HTMLCanvasElement>();
const SILS = new Map<HTMLImageElement, HTMLCanvasElement>();
function planeSil(im: HTMLImageElement) {
  let c = SILS.get(im);
  if (!c) {
    c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight;
    const g = c.getContext("2d")!; g.drawImage(im, 0, 0); g.globalCompositeOperation = "source-in"; g.fillStyle = "#F7F4EC"; g.fillRect(0, 0, c.width, c.height);
    SILS.set(im, c);
  }
  return c;
}
function printBody(ctx: CanvasRenderingContext2D, l: Layer, im: HTMLImageElement, w: number, h: number, b: number, seed: number, tex?: HTMLImageElement) {
  // kâğıt: makasla kesik (çok az pürüz), iki katmanlı gölge
  const edge = tornPts(-w / 2, -h / 2, w, h, seed, 1.6);
  dropPath(ctx, edge, 15, "#F7F4EC");
  ctx.save();
  tracePts(ctx, edge); ctx.clip();
  if (tex) texFill(ctx, tex, -w / 2, -h / 2, w, h, seed);
  // baskı: mürekkep kâğıda emilir — çarpma ile basılır (kâğıdın tanesi açık tonlarda görünür), çok hafif yayılma
  ctx.globalCompositeOperation = "multiply";
  ctx.filter = `${l.bw ? "grayscale(1) contrast(1.15)" : "saturate(0.9) contrast(1.04)"} blur(0.6px)`;
  ctx.drawImage(im, -w / 2 + b, -h / 2 + b, w - 2 * b, h - 2 * b);
  ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha *= 0.35; ctx.filter = l.bw ? "grayscale(1) contrast(1.15)" : "saturate(0.9) contrast(1.04)";
  ctx.drawImage(im, -w / 2 + b, -h / 2 + b, w - 2 * b, h - 2 * b); // renk/kontrast geri gelsin; doku %65 görünür
  ctx.globalAlpha /= 0.35; ctx.globalCompositeOperation = "multiply";
  ctx.filter = "none";
  if (tex) { // doku zaten baskının altında; üstten yalnızca hafif kırışık gölgesi
    ctx.globalAlpha *= 0.18;
    ctx.beginPath(); ctx.rect(-w / 2 + b, -h / 2 + b, w - 2 * b, h - 2 * b); ctx.clip(); texFill(ctx, tex, -w / 2, -h / 2, w, h, seed);
    ctx.globalAlpha /= 0.18;
  }
  ctx.globalCompositeOperation = "source-over";
  grainOver(ctx, -w / 2, -h / 2, w, h, seed + 3, 0.45);
  sheetShade(ctx, w, h, 0.8);
  ctx.restore();
  // bant
  const tape = (l.tape as string) ?? "corners";
  ctx.fillStyle = "rgba(236, 224, 196, 0.8)";
  ctx.filter = shadow(4, 4, 0.16);
  const strip = (cx: number, cy: number, a: number) => {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
    tornPath(ctx, -w * 0.11, -w * 0.028, w * 0.22, w * 0.056, seed * 7 + cx, 3); ctx.fill(); ctx.restore();
  };
  if (tape === "corners") { strip(-w / 2 + w * 0.04, -h / 2 + w * 0.02, -0.75); strip(w / 2 - w * 0.04, h / 2 - w * 0.02, -0.75); }
  if (tape === "top") strip(0, -h / 2, -0.05);
}

// Pürüz gürültüsü: yumuşak değer gürültüsü (1B) + fraktal toplam. Gerçek yırtık birçok ölçekte titrer: uzun dalga + kısa diş + lif.
function vnoise(t: number, seed: number) {
  const i = Math.floor(t), fr = t - i, u = fr * fr * (3 - 2 * fr);
  const hsh = (k: number) => { const v = Math.sin(k * 12.9898 + seed * 78.233) * 43758.5453; return v - Math.floor(v) - 0.5; };
  return hsh(i) * (1 - u) + hsh(i + 1) * u;
}
const fbm = (t: number, seed: number) =>
  vnoise(t / 110, seed) * 1.0 + vnoise(t / 34, seed + 1.3) * 0.55 + vnoise(t / 11, seed + 2.7) * 0.3 + vnoise(t / 3.5, seed + 4.1) * 0.16;

type EdgePt = [number, number, number, number]; // x, y, dışa normal (nx, ny)
// Yırtık kenarlı dörtgen noktaları: çevre boyunca ~3 px adım; kenar başına farklı genlik (bazı kenarlar neredeyse makasla kesik).
// inset > 0: kâğıdın renkli üst yüzü — lif çekirdeği (beyaz saçak) değişken genişlikte görünsün diye içeri çekilir.
function tornPts(x: number, y: number, w: number, h: number, seed: number, amp: number, inset = 0): EdgePt[] {
  const pts: EdgePt[] = [];
  const corners = [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]];
  let s = 0;
  for (let k = 0; k < 4; k++) {
    const [x0, y0] = corners[k], [x1, y1] = corners[k + 1];
    const L = Math.hypot(x1 - x0, y1 - y0) || 1, nx = (y1 - y0) / L, ny = -(x1 - x0) / L;
    const ka = 0.45 + 0.9 * (vnoise(k * 3.1 + 0.5, seed + 11) + 0.5);   // kenar genliği
    const n = Math.max(4, Math.round(L / 3));
    for (let i = 0; i < n; i++) {
      const t = i / n, d = s + t * L;
      const taper = Math.min(1, (t * L) / 24, ((1 - t) * L) / 24);     // köşeler yuvarlanmasın, dikiş görünmesin
      let o = amp * ka * fbm(d, seed) * 1.15 * (0.35 + 0.65 * taper);
      if (inset) o -= inset * Math.max(0.05, 0.55 + 1.5 * vnoise(d / 48, seed + 7) + 0.6 * vnoise(d / 9, seed + 8));
      pts.push([x0 + (x1 - x0) * t + nx * o, y0 + (y1 - y0) * t + ny * o, nx, ny]);
    }
    s += L;
  }
  return pts;
}
function tracePts(ctx: CanvasRenderingContext2D, pts: EdgePt[]) {
  ctx.beginPath();
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.closePath();
}
function tornPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number, amp: number, inset = 0) {
  tracePts(ctx, tornPts(x, y, w, h, seed, amp, inset));
}

// Kâğıt tanesi: bir kez üretilen gri gürültü + yatay lif çizgileri; çarpma (multiply) ile her yaprağın üstüne basılır
let GRAIN: CanvasPattern | null = null;
function grainPattern(ctx: CanvasRenderingContext2D) {
  if (GRAIN) return GRAIN;
  const c = document.createElement("canvas"); c.width = c.height = 512;
  const g = c.getContext("2d")!, img = g.createImageData(512, 512);
  for (let i = 0; i < 512 * 512; i++) {
    const px = i % 512, py = (i / 512) | 0;
    const fib = vnoise(px / 40 + py * 0.37, 3) * 0.6 + vnoise(px / 7 + py * 1.9, 5) * 0.4;   // uzun lifler (yatay eğilimli)
    const v = 244 + 18 * fib + 12 * (Math.random() - 0.5);
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = Math.max(0, Math.min(255, v)); img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  for (let k = 0; k < 220; k++) {   // tek tük koyu lif ve kırıntı
    g.strokeStyle = `rgba(90,70,50,${0.08 + Math.random() * 0.12})`; g.lineWidth = 0.6 + Math.random() * 0.8;
    const x0 = Math.random() * 512, y0 = Math.random() * 512, a = Math.random() * Math.PI, l = 4 + Math.random() * 18;
    g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x0 + Math.cos(a) * l * 0.5 + 3, y0 + Math.sin(a) * l * 0.5 - 2, x0 + Math.cos(a) * l, y0 + Math.sin(a) * l); g.stroke();
  }
  GRAIN = ctx.createPattern(c, "repeat");
  return GRAIN;
}
function grainOver(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number, alpha: number) {
  const p = grainPattern(ctx);
  if (!p) return;
  ctx.save();
  ctx.globalCompositeOperation = "multiply"; ctx.globalAlpha *= alpha;
  ctx.translate(rnd(seed) * -512, rnd(seed + 1) * -512);
  ctx.fillStyle = p; ctx.fillRect(x + rnd(seed) * 512, y + rnd(seed + 1) * 512, w, h);
  ctx.restore();
}

// Yırtık kenardan dışarı taşan ince lifler (beyaz, yarı saydam)
function fibers(ctx: CanvasRenderingContext2D, pts: EdgePt[], seed: number, color = "rgba(250,248,242,0.55)") {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 0.9; ctx.beginPath();
  for (let i = 0; i < pts.length; i += 2) {
    if (rnd(i * 0.37 + seed) > 0.22) continue;
    const [px, py, nx, ny] = pts[i], l = 1 + 3.2 * rnd(i + seed * 2) ** 2, a = (rnd(i * 1.7 + seed) - 0.5) * 1.4;
    const dx = nx * Math.cos(a) - ny * Math.sin(a), dy = nx * Math.sin(a) + ny * Math.cos(a);
    ctx.moveTo(px - nx, py - ny); ctx.quadraticCurveTo(px + dx * l * 0.6 + ny * 1.2, py + dy * l * 0.6 - nx * 1.2, px + dx * l, py + dy * l);
  }
  ctx.stroke(); ctx.restore();
}

// Işık yönüne göre yaprak üstünde çok hafif eğim (kâğıt düz değil: ışığa bakan taraf açık, öbür taraf koyu)
function sheetShade(ctx: CanvasRenderingContext2D, w: number, h: number, k = 1) {
  const g = ctx.createLinearGradient(-SH.x * w / 2, -SH.y * h / 2, SH.x * w / 2, SH.y * h / 2);
  g.addColorStop(0, `rgba(255,250,235,${0.10 * k})`); g.addColorStop(0.55, "rgba(0,0,0,0)"); g.addColorStop(1, `rgba(40,25,10,${0.13 * k})`);
  ctx.fillStyle = g; ctx.fillRect(-w / 2 - 20, -h / 2 - 20, w + 40, h + 40);
}

// İki katmanlı gölge: dar ve koyu temas gölgesi + geniş, yumuşak ortam gölgesi (tek tip drop-shadow "yapıştırılmış" görünür)
function dropPath(ctx: CanvasRenderingContext2D, pts: EdgePt[], lift: number, fill: string) {
  ctx.save();
  ctx.fillStyle = fill;
  ctx.filter = shadow(lift * 1.4, lift * 1.8, 0.2); tracePts(ctx, pts); ctx.fill();
  ctx.filter = shadow(1.5, 2, 0.38); tracePts(ctx, pts); ctx.fill();
  ctx.restore();
}

// Elle işaretleme: SVG çizgisi stroke-dashoffset ile çizilir (vektör, her zaman pürüzsüz)
const Annotations: React.FC<{ layers: Layer[]; words: Word[]; ms: number; W: number; H: number }> = ({ layers, words, ms, W, H }) => (
  <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
    {layers.filter((l) => l.type === "annotate").map((l, i) => {
      const t = atMs(l.at, words), dur = (l.drawMs as number) ?? 650;
      const p = interpolate(ms, [t, t + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) });
      if (p <= 0) return null;
      const x = l.x * W, y = l.y * H, w = l.w * W, h = l.h * H;
      const d = l.shape === "underline" ? scribbleLine(x, y + h, w, i)
        : l.shape === "arrow" ? arrowPath(x, y, w, h)
        : scribbleEllipse(x + w / 2, y + h / 2, w / 2, h / 2, i);
      return (
        <path key={i} d={d} fill="none" stroke={(l.color as string) ?? INK} strokeWidth={(l.width as number) ?? 11}
          strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} opacity={vis(l, ms, words)} />
      );
    })}
  </svg>
);

// Elle çizilmiş gibi: biraz eğik, uçları üst üste binen elips (1.15 tur)
function scribbleEllipse(cx: number, cy: number, rx: number, ry: number, seed: number) {
  const pts: string[] = [];
  const n = 64, turns = 1.15, tilt = -0.08 + 0.05 * Math.sin(seed * 2.1);
  for (let k = 0; k <= n; k++) {
    const a = -Math.PI * 0.6 + (k / n) * Math.PI * 2 * turns;
    const wob = 1 + 0.035 * Math.sin(a * 3 + seed) + (k / n) * 0.06;
    const px = rx * wob * Math.cos(a), py = ry * wob * Math.sin(a);
    pts.push(`${(cx + px * Math.cos(tilt) - py * Math.sin(tilt)).toFixed(1)},${(cy + px * Math.sin(tilt) + py * Math.cos(tilt)).toFixed(1)}`);
  }
  return "M" + pts.join(" L");
}
function scribbleLine(x: number, y: number, w: number, seed: number) {
  const pts: string[] = [];
  for (let k = 0; k <= 24; k++) { const t = k / 24; pts.push(`${(x + w * t).toFixed(1)},${(y + 6 * Math.sin(t * 5 + seed) - 4 * t).toFixed(1)}`); }
  return "M" + pts.join(" L");
}
function arrowPath(x: number, y: number, w: number, h: number) {
  const ex = x + w, ey = y + h, a = Math.atan2(h, w), L = 46;
  return `M${x},${y} Q${x + w * 0.55},${y - h * 0.15} ${ex},${ey} M${ex - L * Math.cos(a - 0.5)},${ey - L * Math.sin(a - 0.5)} L${ex},${ey} L${ex - L * Math.cos(a + 0.5)},${ey - L * Math.sin(a + 0.5)}`;
}

// Yarım ton (halftone) tramı: çapraz dizili siyah noktalar, karışım moduyla bütün kareye
const Halftone: React.FC<{ opacity?: number; size?: number; dot?: number; angle?: number; blend?: string; W: number; H: number }> =
  ({ opacity = 0.35, size = 8, dot = 0.32, angle = 45, blend = "overlay", W, H }) => (
  <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, mixBlendMode: blend as React.CSSProperties["mixBlendMode"], opacity }}>
    <pattern id="vox-halftone" width={size} height={size} patternUnits="userSpaceOnUse" patternTransform={`rotate(${angle})`}>
      <circle cx={size / 2} cy={size / 2} r={size * dot} fill="#000" />
    </pattern>
    <rect width={W} height={H} fill="url(#vox-halftone)" />
  </svg>
);

// Kâğıt dokusu: sabit lif + 3 karede bir değişen ince tane
const Paper: React.FC<{ opacity: number; frame: number; W: number; H: number }> = ({ opacity, frame, W, H }) => {
  const seed = Math.floor(frame / 3) % 8;
  return (
    <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, mixBlendMode: "multiply", opacity }}>
      <filter id="vox-fiber"><feTurbulence type="fractalNoise" baseFrequency="0.012 0.04" numOctaves="3" seed="3" /><feColorMatrix type="saturate" values="0" /></filter>
      <filter id={`vox-grain${seed}`}><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed={seed} /><feColorMatrix type="saturate" values="0" /></filter>
      <rect width={W} height={H} filter="url(#vox-fiber)" opacity={0.8} />
      <rect width={W} height={H} filter={`url(#vox-grain${seed})`} opacity={0.5} />
    </svg>
  );
};

// Işık: ana ışıktan uzaklaştıkça kararma (falloff) + sıcak parıltı + vinyet + isteğe bağlı ışık süzülmesi. Hafif "nefes alma" (±%3).
const Lighting: React.FC<{ x: number; y: number; strength: number; color: string; vignette: number; sweepAt?: unknown; sweepMs?: number;
  sweepAngle?: number; sweepDir?: number; breathe?: number; breatheS?: number; pulseAt?: unknown;
  ms: number; words: Word[]; W: number; H: number }> = ({ x, y, strength, color, vignette, sweepAt, sweepMs, sweepAngle, sweepDir, breathe: bAmp, breatheS, pulseAt, ms, words }) => {
  const p0 = pulseAt !== undefined ? atMs(pulseAt, words) : null;
  const pulse = p0 === null ? 0 : interpolate(ms, [p0, p0 + 250, p0 + 1100], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const breathe = 1 + (bAmp ?? 0.03) * Math.sin((ms / 1000) * 2 * Math.PI / (breatheS ?? 4.2)) + 0.35 * pulse;
  const lx = `${x * 100}%`, ly = `${y * 100}%`;
  const t0 = sweepAt !== undefined ? atMs(sweepAt, words) : null;
  const dir = sweepDir ?? 1;
  const sp0 = t0 === null ? -1 : interpolate(ms, [t0, t0 + (sweepMs ?? 1400)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.sin) });
  const sp = sp0 < 0 ? -1 : dir > 0 ? sp0 : 1 - sp0;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ mixBlendMode: "multiply", opacity: strength * breathe,
        background: `radial-gradient(circle at ${lx} ${ly}, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 28%, rgba(20,14,8,0.55) 95%)` }} />
      <AbsoluteFill style={{ mixBlendMode: "soft-light", opacity: strength * 0.9 * breathe,
        background: `radial-gradient(circle at ${lx} ${ly}, ${color} 0%, rgba(255,255,255,0) 60%)` }} />
      {/* renkli ışık: ekran (screen) karışımıyla gölgeler de hafifçe ışığın rengine boyanır */}
      <AbsoluteFill style={{ mixBlendMode: "screen", opacity: strength * 0.42 * breathe,
        background: `radial-gradient(circle at ${lx} ${ly}, ${color} 0%, ${color}55 35%, rgba(0,0,0,0) 75%)` }} />
      <AbsoluteFill style={{ mixBlendMode: "multiply", opacity: vignette,
        background: "radial-gradient(ellipse 75% 70% at 50% 42%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)" }} />
      {sp > 0 && sp < 1 && (
        <AbsoluteFill style={{ mixBlendMode: "soft-light", opacity: 0.9 * Math.sin(sp * Math.PI),
          background: `linear-gradient(${sweepAngle ?? 115}deg, rgba(255,255,255,0) ${sp * 160 - 50}%, ${color} ${sp * 160 - 30}%, rgba(255,255,255,0) ${sp * 160 - 10}%)` }} />
      )}
    </AbsoluteFill>
  );
};

// Başlık kartları ve etiketler (DOM yazı; kamera eğimiyle birlikte hareket eder)
const TORN = "polygon(0% 4%, 6% 1%, 14% 3%, 22% 0%, 31% 2%, 40% 0%, 49% 3%, 58% 1%, 67% 3%, 76% 0%, 85% 2%, 93% 0%, 100% 3%, 99% 22%, 100% 45%, 98% 70%, 100% 96%, 92% 99%, 83% 97%, 74% 100%, 64% 98%, 55% 100%, 45% 97%, 35% 100%, 26% 98%, 16% 100%, 8% 97%, 0% 100%, 1% 74%, 0% 50%, 2% 26%)";
// title.type "typewriter": 30 karakter/sn harf harf, imleç yarım saniyede bir yanıp söner · lines[].markAt: satır arkasına fosfor (accent, %92, 600 ms expoOut, eğik)
const Titles: React.FC<{ layers: Layer[]; words: Word[]; ms: number; f: number; fps: number; W: number; H: number; boil?: number; stepId?: number;
  accent: string; msRaw: number }> = ({ layers, words, ms, f, fps, W, H, boil = 0, stepId = 0, accent, msRaw }) => (
  <>
    {layers.map((l, i) => {
      if (l.type !== "title" && l.type !== "tag") return null;
      const v = vis(l, ms, words);
      if (v <= 0) return null;
      const startF = Math.round((atMs(l.at ?? l.showAt ?? 0, words) / 1000) * fps);
      if (f < startF) return null;
      const s = spring({ frame: f - startF, fps, config: { damping: 12, stiffness: 80, mass: 1 } });
      const wipe = l.from === "wipe";
      const e = wipe ? null : entry(l.from, s, W, H, (l.seed as number) ?? 2);
      const hideT = l.hideAt !== undefined ? atMs(l.hideAt, words) : null;
      const out = hideT === null ? 0 : interpolate(ms, [hideT, hideT + 350], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) });
      const pop = e || wipe ? 1 : 0.7 + 0.3 * s;
      const wq = wipe ? EASE.expoOut(clamp01((msRaw - atMs(l.at ?? l.showAt ?? 0, words)) / 420)) : 1; // soldan maske silmesi
      const bb = ((l.boil as number) ?? boil * 0.4) * settle(l, f, fps, words);
      const base: React.CSSProperties = {
        position: "absolute", left: l.x * W, top: l.y * H, transformOrigin: "50% 50%",
        transform: `translate(-50%, -50%) translate(${(e?.dx ?? 0) + (rnd(stepId * 7.13 + i * 31.7 + 1) - 0.5) * 2 * bb}px, ${(e?.dy ?? 0) - out * H * 0.25 + (rnd(stepId * 7.13 + i * 31.7 + 2) - 0.5) * 2 * bb}px) rotate(${((l.rot as number) ?? 0) + (e?.rot ?? 0) + (rnd(stepId * 7.13 + i * 31.7 + 3) - 0.5) * 0.8 * bb}deg) scale(${pop})`,
        opacity: v * (e || wipe ? 1 : Math.min(1, s * 1.5)), filter: `drop-shadow(${SH.x * 14}px ${SH.y * 14}px 16px rgba(0,0,0,0.3))`,
      };
      if (l.type === "tag") {
        return (
          <div key={i} style={{ ...base, transform: `${base.transform} translateX(${(-(1 - wq) * 40).toFixed(1)}px)` }}><div style={{ background: (l.bg as string) ?? "#F4EFE4",
            clipPath: wq < 1 ? `inset(0 ${((1 - wq) * 100).toFixed(1)}% 0 0)` : TORN, padding: "22px 40px 20px",
            fontFamily: INTER, fontWeight: 900, fontSize: (l.size as number) ?? 64, letterSpacing: 2, color: (l.color as string) ?? "#14213D",
            display: "flex", alignItems: "center", gap: 18, whiteSpace: "nowrap" }}>
            {l.icon === "lock" && <LockIcon color={(l.color as string) ?? "#14213D"} />}
            {l.icon === "drop" && <DropIcon color={(l.color as string) ?? "#14213D"} />}
            {l.text as string}
          </div></div>
        );
      }
      const lines = (l.lines as { text: string; size?: number; color?: string; flipAt?: unknown; markAt?: unknown }[]) ?? [];
      const tw = l.write === "typewriter";
      const typeStart = atMs(l.at ?? l.showAt ?? 0, words) + 250;
      let budget = tw ? Math.max(0, Math.floor(((msRaw - typeStart) / 1000) * 30)) : Infinity;
      const totalChars = lines.reduce((s, ln) => s + ln.text.length, 0);
      const cursorOn = tw && Math.floor(msRaw / 500) % 2 === 0;
      return (
        <div key={i} style={{ ...base, ...(l.noShadow ? { filter: "none" } : {}), width: ((l.w as number) ?? 0.8) * W, background: (l.paper as string) ?? "#F4EFE4", clipPath: TORN,
          padding: "60px 40px 64px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          {lines.map((ln, k) => {
            const ft = ln.flipAt !== undefined ? Math.round((atMs(ln.flipAt, words) / 1000) * fps) : null;
            const fl = ft === null ? 0 : spring({ frame: f - ft, fps, config: { damping: 11, stiffness: 70, mass: 1.2 } });
            const shown = tw ? ln.text.slice(0, Math.max(0, budget)) : ln.text;
            const cursorHere = tw && budget >= 0 && budget <= ln.text.length && budget < totalChars;
            budget -= ln.text.length;
            const mk = ln.markAt !== undefined ? EASE.expoOut(clamp01((msRaw - atMs(ln.markAt, words)) / 600)) : 0;
            return (
              <div key={k} style={{ position: "relative", fontFamily: tw ? MONO : INTER, fontWeight: tw ? 500 : 900, fontSize: ln.size ?? 96,
                lineHeight: 1, letterSpacing: tw ? 0 : -1, textAlign: "center", color: ln.color ?? "#14213D", transform: `rotate(${180 * fl}deg)`, transformOrigin: "50% 50%" }}>
                {mk > 0 && <div style={{ position: "absolute", left: "-4%", right: "-4%", top: "8%", bottom: "4%", background: accent, opacity: 0.92, zIndex: 0,
                  transform: `skewX(-14deg) scaleX(${mk})`, transformOrigin: "0% 50%" }} />}
                <span style={{ position: "relative", visibility: "hidden" }}>{ln.text}</span>
                <span style={{ position: "absolute", left: 0, right: 0, top: 0, textAlign: "center" }}>
                  {shown}{cursorHere && cursorOn && <span style={{ position: "absolute", opacity: 0.85 }}>▍</span>}
                  <span style={{ visibility: "hidden" }}>{ln.text.slice(shown.length)}</span>
                </span>
              </div>
            );
          })}
        </div>
      );
    })}
  </>
);
// Sayaç: from → to (expoOut) ya da roll: slot makinesi gibi döner, rakamlar soldan sağa 0.15 sn arayla durur. box: kâğıt kutu
const Counters: React.FC<{ layers: Layer[]; words: Word[]; ms: number; W: number; H: number }> = ({ layers, words, ms, W, H }) => (
  <>
    {layers.map((l, i) => {
      if (l.type !== "counter") return null;
      const t0 = atMs(l.at ?? 0, words), dur = (l.ms as number) ?? 1100;
      if (ms < t0) return null;
      const size = (l.size as number) ?? 120, target = String(Math.round(l.to as number));
      const q = clamp01((ms - t0) / dur);
      let digits: { ch: string; off: number }[];
      if (l.roll) {
        const n = target.length;
        digits = target.split("").map((ch, k) => {
          const stop = t0 + dur - (n - 1 - k) * 150; // en sağdaki en son durur
          if (ms >= stop) return { ch, off: 0 };
          const spin = (stop - ms) / 55; // dönen silindir: kesirli kısım dikey kayma
          return { ch: String((Number(ch) + Math.floor(spin)) % 10), off: spin % 1 };
        });
      } else {
        const v = Math.round((l.from as number ?? 0) + ((l.to as number) - ((l.from as number) ?? 0)) * EASE.expoOut(q));
        digits = String(v).split("").map((ch) => ({ ch, off: 0 }));
      }
      return (
        <div key={i} style={{ position: "absolute", left: l.x * W, top: l.y * H, opacity: clamp01((ms - t0) / 200) * vis(l, ms, words),
          padding: l.box ? "18px 30px" : 0, background: l.box ? "#F4EFE4" : undefined, clipPath: l.box ? TORN : undefined,
          filter: `drop-shadow(${SH.x * 12}px ${SH.y * 12}px 14px rgba(0,0,0,0.3))` }}>
          <div style={{ display: "flex", fontFamily: INTER, fontWeight: 900, fontSize: size, lineHeight: 1, color: (l.color as string) ?? (l.box ? "#14213D" : "#F4EFE4"),
            fontVariantNumeric: "tabular-nums", overflow: "hidden", height: size * 1.05 }}>
            {digits.map((d, k) => (
              <span key={k} style={{ display: "inline-block", transform: `translateY(${-d.off * size * 0.9}px)`, filter: d.off ? "blur(1.5px)" : undefined }}>{d.ch}</span>
            ))}
          </div>
          {!!l.label && <div style={{ fontFamily: INTER, fontWeight: 800, fontSize: size * 0.22, color: "#4A5468", marginTop: 6 }}>{l.label as string}</div>}
        </div>
      );
    })}
  </>
);

// Damga: büyük ölçekten (2.6) 0.2 sn'de ease-in ile 1'e çarpar; çarpmada toz patlaması (sarsıntı stampShake'te)
const Stamps: React.FC<{ layers: Layer[]; words: Word[]; ms: number; W: number; H: number }> = ({ layers, words, ms, W, H }) => (
  <>
    {layers.map((l, i) => {
      if (l.type !== "stamp") return null;
      const t0 = atMs(l.at ?? 0, words);
      if (ms < t0) return null;
      const q = clamp01((ms - t0) / 200), s = 2.6 - 1.6 * q * q * q, hit = ms - t0 - 200;
      const color = (l.color as string) ?? "#C8392B";
      return (
        <div key={i} style={{ position: "absolute", left: l.x * W, top: l.y * H }}>
          {hit > 0 && hit < 700 && Array.from({ length: 14 }, (_, k) => {
            const a = (k / 14) * Math.PI * 2 + rnd(k) * 0.4, d = (60 + 160 * rnd(k + 9)) * EASE.expoOut(hit / 700);
            return <div key={k} style={{ position: "absolute", width: 6 + 6 * rnd(k + 3), height: 6 + 6 * rnd(k + 3), borderRadius: "50%",
              background: "rgba(240,230,210,0.8)", left: Math.cos(a) * d * 1.6, top: Math.sin(a) * d, opacity: 1 - hit / 700 }} />;
          })}
          <div style={{ transform: `translate(-50%, -50%) rotate(${(l.rot as number) ?? -9}deg) scale(${s})`, opacity: Math.min(1, q * 3) * 0.9,
            border: `10px solid ${color}`, borderRadius: 14, padding: "14px 34px", color, fontFamily: INTER, fontWeight: 900,
            fontSize: (l.size as number) ?? 78, letterSpacing: 3, whiteSpace: "nowrap", mixBlendMode: "multiply" }}>{l.text as string}</div>
        </div>
      );
    })}
  </>
);

// Film dokusu: 12 Hz dönen gren, vinyet, ±%2.5 titreme, ±0.8 px gate weave, isteğe bağlı renk tonu (multiply)
const Film: React.FC<{ grain?: number; vignette?: number; flicker?: number; weave?: number; tint?: string; frame: number; fps: number; W: number; H: number }> =
  ({ grain = 0.24, vignette = 0.58, flicker = 0.025, weave = 0.8, tint, frame, fps, W, H }) => {
  const st = Math.floor((frame / fps) * 12), seed = st % 6;
  const fl = (rnd(st * 1.3) - 0.5) * 2 * flicker, wx = (rnd(st * 2.1) - 0.5) * 2 * weave, wy = (rnd(st * 3.7) - 0.5) * 2 * weave;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", transform: `translate(${wx}px, ${wy}px)` }}>
      {tint && <AbsoluteFill style={{ background: tint, mixBlendMode: "multiply" }} />}
      <svg width={W} height={H} style={{ position: "absolute", mixBlendMode: "overlay", opacity: grain }}>
        <filter id={`film-g${seed}`}><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={seed + 11} /><feColorMatrix type="saturate" values="0" /></filter>
        <rect width={W} height={H} filter={`url(#film-g${seed})`} />
      </svg>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 72% 66% at 50% 45%, rgba(0,0,0,0) 50%, rgba(0,0,0,${vignette}) 100%)` }} />
      <AbsoluteFill style={{ background: fl > 0 ? "#fff" : "#000", opacity: Math.abs(fl) }} />
    </AbsoluteFill>
  );
};

const LockIcon: React.FC<{ color: string }> = ({ color }) => (
  <svg width="54" height="62" viewBox="0 0 54 62"><rect x="4" y="26" width="46" height="34" rx="6" fill={color} />
    <path d="M14 27 V18 a13 13 0 0 1 26 0 V27" fill="none" stroke={color} strokeWidth="7" /></svg>
);
const DropIcon: React.FC<{ color: string }> = ({ color }) => (
  <svg width="46" height="62" viewBox="0 0 46 62"><path d="M23 2 C23 2 4 26 4 40 a19 19 0 0 0 38 0 C42 26 23 2 23 2 Z" fill={color} /></svg>
);

const rnd = (i: number) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

// Toz zerrecikleri: yavaş yükselip yana süzülen yumuşak noktalar (basamaklı zamanla birlikte stop-motion hissine uyar)
function drawDust(ctx: CanvasRenderingContext2D, l: Layer, f: number, fps: number, W: number, H: number) {
  const n = (l.count as number) ?? 26, t = f / fps;
  ctx.save();
  ctx.fillStyle = (l.color as string) ?? "rgba(255, 244, 220, 0.55)";
  for (let k = 0; k < n; k++) {
    const sp = 0.012 + rnd(k * 3.1) * 0.02;
    const x = ((rnd(k * 1.7) + Math.sin(t * 0.4 + k) * 0.02) % 1) * W;
    const y = (1 - ((rnd(k * 2.3) + t * sp) % 1)) * H;
    const r = ((l.size as number) ?? 3) * (0.5 + rnd(k * 4.9));
    ctx.globalAlpha = 0.25 + 0.5 * rnd(k * 5.3);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// hareket ederken tam titreme, giriş bitince (~1.2 sn) %35'e iner
function settle(l: Layer, f: number, fps: number, words: Word[]) {
  const st = Math.round((atMs(l.enterAt ?? l.at ?? 0, words) / 1000) * fps);
  return interpolate(f - st, [0, fps * 1.0, fps * 1.6], [1, 1, 0.35], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
}

// Ayrı tuval (alan derinliği için katman başına): her kullanımda temizlenir
let OFF: HTMLCanvasElement | null = null;
function offCtx(W: number, H: number) {
  if (!OFF) { OFF = document.createElement("canvas"); }
  if (OFF.width !== W || OFF.height !== H) { OFF.width = W; OFF.height = H; }
  const c = OFF.getContext("2d")!;
  c.setTransform(1, 0, 0, 1, 0, 0); c.filter = "none"; c.globalAlpha = 1; c.globalCompositeOperation = "source-over";
  c.clearRect(0, 0, W, H);
  return c;
}

// Işık sarması (light wrap): zeminin/ışığın rengi kesiğin kenarından içeri sızar → "yapıştırılmış" durmaz.
// Yöntem: kesiğin alfa maskesinin tersi, gölge bulanıklığıyla kenardan içeri taşar; source-atop ile yalnızca kesiğin üstüne basılır.
let WRAP: { color: string; size: number; strength: number } | null = null;
let WRAPC: HTMLCanvasElement | null = null;
export function lightWrap(ctx: CanvasRenderingContext2D, im: HTMLImageElement | HTMLCanvasElement, w: number, h: number, o: { color: string; size: number; strength: number }) {
  const pad = Math.ceil(o.size * 3), cw = Math.ceil(w) + 2 * pad, ch = Math.ceil(h) + 2 * pad;
  if (!WRAPC) WRAPC = document.createElement("canvas");
  WRAPC.width = cw; WRAPC.height = ch;
  const g = WRAPC.getContext("2d")!;
  // 1) kesik şekli siyah (screen'de etkisiz)  2) ters maskenin gölgesi kenardan içeri ışık renginde düşer  3) screen ile basılır
  g.drawImage(im, pad, pad, w, h);
  g.globalCompositeOperation = "source-in"; g.fillStyle = "#000"; g.fillRect(0, 0, cw, ch);
  const inv = document.createElement("canvas"); inv.width = cw; inv.height = ch;
  const q = inv.getContext("2d")!;
  q.fillStyle = "#000"; q.fillRect(0, 0, cw, ch);
  q.globalCompositeOperation = "destination-out"; q.drawImage(im, pad, pad, w, h);
  g.globalCompositeOperation = "source-atop";
  g.shadowColor = o.color; g.shadowBlur = o.size; g.shadowOffsetX = 10000;
  g.drawImage(inv, -10000, 0);
  ctx.save();
  ctx.globalAlpha *= o.strength; ctx.globalCompositeOperation = "screen";
  ctx.drawImage(WRAPC, -w / 2 - pad, -h / 2 - pad);
  ctx.restore();
}
