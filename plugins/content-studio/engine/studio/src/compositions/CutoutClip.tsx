import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { continueRender, delayRender, Easing, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";

// Arka planı ayrılmış (tools/.venv-matte, rembg) bir kişiyi/nesneyi hareketlendiren kısa klip (4-5 sn).
// bg varsa: arka plan yavaş Ken Burns, ön plan daha hızlı kayar → 2.5D paralaks. bg yoksa: şeffaf arka plan
// (render: --codec=prores --prores-profile=4444 --pixel-format=yuva444p10le --image-format=png, ya da --codec=vp9 webm).
// Çizim canvas'ta ondalıklı koordinatla yapılır (CSS transform tam render'da tam piksele oturuyor, bkz. PhotoMotion).
const focus = z.object({ x: z.number(), y: z.number(), zoom: z.number() });
const place = z.object({ x: z.number(), y: z.number(), scale: z.number() }); // x, y: ön plan merkezinin kare içindeki yeri (0-1)

export const cutoutSchema = z.object({
  seconds: z.number().positive().default(5),
  bg: z.object({ image: z.string(), size: z.tuple([z.number(), z.number()]), from: focus, to: focus, filter: z.string().optional() }).optional(),
  fg: z.object({
    image: z.string(), size: z.tuple([z.number(), z.number()]),
    height: z.number().default(0.55), // ön planın kare yüksekliğine oranı (scale 1'de)
    from: place, to: place, filter: z.string().optional(), shadow: z.boolean().default(true), fadeInS: z.number().default(0),
  }),
  chroma: z.string().optional(), // ör. "#00ff00": şeffaflık yerine düz renk (alfa okumayan editörler için)
});

const cache = new Map<string, Promise<HTMLImageElement>>();
const load = (src: string) => {
  if (!cache.has(src)) {
    cache.set(src, new Promise((ok, fail) => {
      const im = new Image();
      im.onload = () => ok(im);
      im.onerror = () => fail(new Error(`görsel yüklenemedi: ${src}`));
      im.src = src;
    }));
  }
  return cache.get(src)!;
};

export const CutoutClip: React.FC<z.infer<typeof cutoutSchema>> = ({ bg, fg, chroma }) => {
  const f = useCurrentFrame();
  const { width: W, height: H, fps, durationInFrames } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const [imgs, setImgs] = useState<{ bg?: HTMLImageElement; fg: HTMLImageElement } | null>(null);
  const [handle] = useState(() => delayRender("cutout görselleri"));
  useEffect(() => {
    Promise.all([bg ? load(staticFile(bg.image)) : Promise.resolve(undefined), load(staticFile(fg.image))])
      .then(([b, g]) => { setImgs({ bg: b, fg: g }); continueRender(handle); });
  }, [bg, fg.image, handle]);

  const p = interpolate(f, [0, durationInFrames - 1], [0, 1], { easing: Easing.inOut(Easing.sin) });
  const lerp = (a: number, b: number) => a + (b - a) * p;

  useLayoutEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx || !imgs) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.filter = "none";
    ctx.shadowColor = "transparent";
    ctx.clearRect(0, 0, W, H);
    if (chroma) { ctx.fillStyle = chroma; ctx.fillRect(0, 0, W, H); }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    if (bg && imgs.bg) {
      const ox = lerp(bg.from.x, bg.to.x), oy = lerp(bg.from.y, bg.to.y), z = lerp(bg.from.zoom, bg.to.zoom);
      const c = Math.max(W / bg.size[0], H / bg.size[1]);
      const dw = bg.size[0] * c, dh = bg.size[1] * c;
      ctx.save();
      ctx.filter = bg.filter ?? "none";
      ctx.translate(ox * W, oy * H);
      ctx.scale(z, z);
      ctx.translate(-ox * dw, -oy * dh);
      ctx.drawImage(imgs.bg, 0, 0, dw, dh);
      ctx.restore();
    }
    const s = lerp(fg.from.scale, fg.to.scale);
    const h = fg.height * H * s, w = h * (fg.size[0] / fg.size[1]);
    const cx = lerp(fg.from.x, fg.to.x) * W, cy = lerp(fg.from.y, fg.to.y) * H;
    ctx.save();
    ctx.globalAlpha = fg.fadeInS > 0 ? Math.min(1, f / (fg.fadeInS * fps)) : 1;
    ctx.filter = fg.filter ?? "none";
    if (fg.shadow) { ctx.shadowColor = "rgba(0,0,0,0.55)"; ctx.shadowBlur = 40; ctx.shadowOffsetY = 18; }
    ctx.drawImage(imgs.fg, cx - w / 2, cy - h / 2, w, h);
    ctx.restore();
  });

  return <canvas ref={ref} width={W} height={H} style={{ width: W, height: H }} />;
};
