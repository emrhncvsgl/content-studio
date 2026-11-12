import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AbsoluteFill, Img, continueRender, delayRender, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { MONO } from "../../fonts";
import { ease, lerpScale } from "../../components/ease";
import { lightWrap } from "../vox-explainer";

// Fotoğraf stillerinin ortak katmanı: Ken Burns hareketi (yakınlaşma + odak kayması) + altyazı okunurluğu için alt karartma + atıf.
// props.image: content/ köküne göre yol (tools/find_images.py get çıktısı) · from/to: { x, y (0-1 odak), zoom } · credit: ekran atfı
// props.cuts (isteğe bağlı): sahne içi görsel değişimi. [{ atMs, image?, from?, to?, fadeMs?, credit? }]
//   atMs: sahne başından ms (kelime zamanı, report.json / timeline words) · image yoksa önceki görsel kalır (yalnızca kadraj değişir)
//   fadeMs: yeni görselin belirme süresi (varsayılan 250 ms; 0 = sert kesme). Her parçanın from→to hareketi kendi süresine yayılır.
// to.ease: "sin" (varsayılan) | "heavyOut" | "snapOut" … (components/ease.ts) · to.at/to.ms: hareket yalnızca bu pencerede (çekim başından ms);
// öncesinde from'da durur. "Ağır yakınlaşma" (punch-in): { zoom: 1.6-2.2, ease: "heavyOut", at: <vurgulu kelime ms>, ms: 1400-2000 }
export type Focus = { x: number; y: number; zoom: number; ease?: string; at?: number; ms?: number };
const DEFAULT_FROM: Focus = { x: 0.5, y: 0.5, zoom: 1.0 };
const DEFAULT_TO: Focus = { x: 0.5, y: 0.45, zoom: 1.18 };
const DEFAULT_FADE_MS = 250;

// size: görselin piksel boyutu (build_timeline props.imageSizes'a yazar). Varsa hareket piksel altı hassas transform ile çizilir;
// yoksa eski object-position yolu (object-position tam piksele yuvarlanır → yavaş kaymada ~8 karede bir 1 px sıçrama, EP002 s07).
export type PhotoShot = { image: string; from: Focus; to: Focus; credit: string; atMs: number; fadeMs: number; size?: [number, number]; planes?: Plane[] };
// 2.5D katmanlar (tools/photo_planes.py): fotoğrafla aynı piksel ızgarasında RGBA kesik(ler); image arka plan (deliği doldurulmuş) olur.
// k: hareket çarpanı (1 = arka plan gibi, >1 = kameraya yakın, daha çok kayar/büyür; tipik 1.3-1.8). blur: odak dışı px (alan derinliği).
export type Plane = { image: string; k: number; blur?: number; wrap?: boolean; under?: boolean }; // under: ana görselin ALTINA çizilir (k < 1 zemin, ör. masa) // wrap: false → bu katmana light wrap yok (çerçeve/duvar)
// props.dof: { focus (k değeri, varsayılan en yakın katman), amount (px / k farkı, 6) } · props.handheld: genlik (0.5 = çok hafif)
// props.lightWrap: true | { color ("#FFD9A0"), size (22), strength (0.5) }: planes katmanlarının kenarından arka planın ışığı sızar (vox ile aynı yöntem)
export type Wrap = { color: string; size: number; strength: number };
export const readWrap = (v: unknown): Wrap | undefined => (v ? { color: "#FFD9A0", size: 22, strength: 0.5, ...(v === true ? {} : (v as object)) } : undefined);

export function readPhotoProps(props: Record<string, unknown>) {
  return {
    image: String(props.image ?? ""),
    from: { ...DEFAULT_FROM, ...(props.from as Partial<Focus> | undefined) },
    to: { ...DEFAULT_TO, ...(props.to as Partial<Focus> | undefined) },
    credit: typeof props.credit === "string" ? props.credit : "",
  };
}

// Ana görsel + cuts → zamana göre sıralı çekim listesi (ilk çekim atMs 0)
export function readPhotoShots(props: Record<string, unknown>): PhotoShot[] {
  const base = readPhotoProps(props);
  const sizes = (props.imageSizes ?? {}) as Record<string, [number, number]>;
  const shots: PhotoShot[] = [{ ...base, atMs: 0, fadeMs: 0 }];
  const raw = Array.isArray(props.cuts) ? (props.cuts as Record<string, unknown>[]) : [];
  if (Array.isArray(props.planes) && props.planes.length) shots[0].planes = props.planes as Plane[];
  const cuts = raw
    .filter((c) => c && typeof c.atMs === "number" && (c.atMs as number) > 0)
    .sort((a, b) => (a.atMs as number) - (b.atMs as number));
  for (const c of cuts) {
    const prev = shots[shots.length - 1];
    shots.push({
      image: typeof c.image === "string" && c.image ? c.image : prev.image,
      from: { ...DEFAULT_FROM, ...(c.from as Partial<Focus> | undefined) },
      to: { ...DEFAULT_TO, ...(c.to as Partial<Focus> | undefined) },
      credit: typeof c.credit === "string" ? c.credit : prev.credit,
      atMs: c.atMs as number,
      fadeMs: typeof c.fadeMs === "number" ? Math.max(0, c.fadeMs) : DEFAULT_FADE_MS,
      // katmanlar: cut kendi planes'ini verebilir; görsel değişmiyorsa öncekinin katmanları sürer (EP006 s04 masa + sayfa)
      planes: Array.isArray(c.planes) ? (c.planes as Plane[]) : !(typeof c.image === "string" && c.image && c.image !== prev.image) ? prev.planes : undefined,
    });
  }
  return shots.map((s) => (sizes[s.image] ? { ...s, size: sizes[s.image] } : s));
}

export const PhotoMotion: React.FC<{
  image: string; from: Focus; to: Focus; dur: number; start?: number; filter?: string; offset?: { x: number; y: number };
  size?: [number, number]; planes?: Plane[]; dof?: { focus?: number; amount?: number }; handheld?: number; wrap?: Wrap;
}> = ({ image, from, to, dur, start = 0, filter, offset, size, planes, dof, handheld, wrap }) => {
  const f = useCurrentFrame();
  const { width: W, height: H, fps } = useVideoConfig();
  const w0 = to.at !== undefined ? start + Math.round((to.at / 1000) * fps) : start;
  const w1 = to.at !== undefined || to.ms !== undefined ? w0 + Math.max(1, Math.round(((to.ms ?? 1600) / 1000) * fps)) : start + Math.max(1, dur);
  const p = interpolate(f, [w0, w1], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease(to.ease, "sin"),
  });
  const zoom = lerpScale(from.zoom, to.zoom, p); // ölçek log uzayında (bkz. ease.ts lerpScale)
  const ox = from.x + (to.x - from.x) * p;
  const oy = from.y + (to.y - from.y) * p;
  if (!image) {
    return <AbsoluteFill style={{ backgroundColor: "#300", color: "#fff", fontSize: 50, justifyContent: "center", alignItems: "center" }}>props.image yok</AbsoluteFill>;
  }
  if (size) {
    const hh = handheld ? handheldAt(f, handheld) : null;
    const off = hh ? { x: (offset?.x ?? 0) + hh.x, y: (offset?.y ?? 0) + hh.y } : offset;
    return <CanvasPhoto image={image} size={size} ox={ox} oy={oy} zoom={zoom} from={from} offset={off} rot={hh?.rot ?? 0} filter={filter} W={W} H={H}
      planes={planes} dof={dof} wrap={wrap} />;
  }
  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#000" }}>
      <Img
        src={staticFile(image)}
        style={{
          width: "100%", height: "100%", objectFit: "cover", objectPosition: `${ox * 100}% ${oy * 100}%`,
          transform: `translate(${offset?.x ?? 0}px, ${offset?.y ?? 0}px) scale(${zoom})`, transformOrigin: `${ox * 100}% ${oy * 100}%`, filter,
        }}
      />
    </AbsoluteFill>
  );
};

// object-fit: cover + object-position (ox, oy) + odak noktasında zoom, canvas'a ondalıklı koordinatla çizilir.
// CSS transform/object-position tam render'da tam piksele oturuyor (EP002 s07: yavaş kaymada ~6 karede bir sıçrama); canvas oturtmuyor.
const imageCache = new Map<string, Promise<HTMLImageElement>>();
export function loadImage(src: string) {
  if (!imageCache.has(src)) {
    imageCache.set(src, new Promise((ok, fail) => {
      const im = new Image();
      im.onload = () => ok(im);
      im.onerror = () => fail(new Error(`görsel yüklenemedi: ${src}`));
      im.src = src;
    }));
  }
  return imageCache.get(src)!;
}

const CanvasPhoto: React.FC<{
  image: string; size: [number, number]; ox: number; oy: number; zoom: number; from: Focus; rot: number;
  offset?: { x: number; y: number }; filter?: string; W: number; H: number; planes?: Plane[]; dof?: { focus?: number; amount?: number }; wrap?: Wrap;
}> = ({ image, size, ox, oy, zoom, from, rot, offset, filter, W, H, planes = [], dof, wrap }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const [imgs, setImgs] = useState<HTMLImageElement[] | null>(null);
  const [handle] = useState(() => delayRender(`photo ${image}`));
  const key = [image, ...planes.map((p) => p.image)].join("|");
  useEffect(() => {
    Promise.all([image, ...planes.map((p) => p.image)].map((s) => loadImage(staticFile(s)))).then((ims) => { setImgs(ims); continueRender(handle); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, handle]);
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx || !imgs) return;
    const c = Math.max(W / size[0], H / size[1]);
    const dw = size[0] * c, dh = size[1] * c;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.filter = "none";
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    const focusK = dof?.focus ?? Math.max(1, ...planes.map((p) => p.k));
    // k katmanı: yakınlaşma z0·(z/z0)^k, odak kayması k kat → yakın katman daha çok büyür ve kayar; t=0'da hepsi hizalı
    const draw = (im: HTMLImageElement, k: number, blur: number, lw = false) => {
      const zk = from.zoom * Math.pow(zoom / from.zoom, k), xk = from.x + (ox - from.x) * k, yk = from.y + (oy - from.y) * k;
      ctx.save();
      ctx.filter = blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : "none";
      ctx.translate((offset?.x ?? 0) * k + W / 2, (offset?.y ?? 0) * k + H / 2);
      ctx.rotate((rot * k * Math.PI) / 180);
      ctx.translate(-W / 2 + xk * W, -H / 2 + yk * H);
      ctx.scale(zk, zk);
      ctx.translate(-xk * dw, -yk * dh);
      ctx.drawImage(im, 0, 0, dw, dh);
      if (lw && wrap) { ctx.filter = "none"; ctx.translate(dw / 2, dh / 2); lightWrap(ctx, im, dw, dh, wrap); }
      ctx.restore();
    };
    const amt = dof?.amount ?? (dof ? 6 : 0);
    planes.forEach((p, i) => p.under && draw(imgs[i + 1], p.k, p.blur ?? amt * Math.abs(p.k - focusK)));
    draw(imgs[0], 1, amt * Math.abs(1 - focusK));
    planes.forEach((p, i) => !p.under && draw(imgs[i + 1], p.k, p.blur ?? amt * Math.abs(p.k - focusK), p.wrap !== false));
  });
  return <canvas ref={ref} width={W} height={H} style={{ position: "absolute", left: 0, top: 0, width: W, height: H, filter }} />;
};

// El kamerası: çok yavaş, düşük genlikli sallantı (birkaç sinüs toplamı; deterministik). a = 1 → ±~6 px, ±0.25°
export function handheldAt(f: number, a: number) {
  const t = f / 30;
  return {
    x: a * (3.4 * Math.sin(t * 0.83 + 0.4) + 2.1 * Math.sin(t * 1.91 + 2.2) + 0.8 * Math.sin(t * 3.7 + 1.1)),
    y: a * (2.8 * Math.sin(t * 0.71 + 1.7) + 1.9 * Math.sin(t * 1.53 + 0.3) + 0.7 * Math.sin(t * 4.1 + 2.9)),
    rot: a * (0.15 * Math.sin(t * 0.57 + 0.9) + 0.08 * Math.sin(t * 1.37 + 2.4)),
  };
}

// Sahnenin tüm çekimleri: her çekim kendi başlangıç anında (crossfade ile) belirir; hareket o çekimin süresine yayılır.
// Bir sonraki çekim tamamen belirdikten sonra önceki çekim çizilmez (bellek/performans).
export const PhotoShots: React.FC<{
  shots: PhotoShot[]; dur: number; filter?: string; offset?: { x: number; y: number }; dof?: { focus?: number; amount?: number }; handheld?: number; wrap?: Wrap;
}> = ({ shots, dur, filter, offset, dof, handheld, wrap }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fr = (ms: number) => Math.round((ms / 1000) * fps);
  return (
    <AbsoluteFill>
      {shots.map((s, i) => {
        const start = fr(s.atMs);
        const fade = fr(s.fadeMs);
        const next = shots[i + 1];
        const end = next ? Math.min(dur, fr(next.atMs) + fr(next.fadeMs)) : dur;
        if (f < start || (next && f >= end && end < dur)) return null;
        const opacity = fade > 0 ? interpolate(f, [start, start + fade], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
        return (
          <AbsoluteFill key={i} style={{ opacity }}>
            <PhotoMotion image={s.image} from={s.from} to={s.to} start={start} dur={end - start} filter={filter} offset={offset} size={s.size}
              planes={s.planes} dof={dof} handheld={handheld} wrap={wrap} />
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
};

// Şu anki çekimin atfı (cuts varsa çekime göre değişir)
export function activeCredit(shots: PhotoShot[], frame: number, fps: number): string {
  let credit = shots[0]?.credit ?? "";
  for (const s of shots) if (frame >= Math.round((s.atMs / 1000) * fps)) credit = s.credit;
  return credit;
}

// Alt karartma: altyazı bandı (%60-78) fotoğraf üstünde okunur kalsın.
// QA (EP002): beyaz patent sayfasında turuncu aktif kelime 2.6:1 kalıyordu (bant ~0.55-0.65). Bant 0.74'e çıkarıldı: beyaz zeminde
// bile arka plan ≈ rgb(66) → turuncu #F2A93B ≈ 5:1, beyaz metin ≈ 10:1. Geçiş yukarıda yumuşak başlar (görselin üst %40'ı etkilenmez).
export const CaptionScrim: React.FC = () => {
  const { width, height } = useVideoConfig();
  // 16:9 (2026-11-08): altyazı alt bantta (PaperStrips land), karartma da oraya iner
  const bg = width > height
    ? "linear-gradient(180deg, rgba(0,0,0,0) 62%, rgba(0,0,0,0.45) 76%, rgba(0,0,0,0.7) 88%, rgba(0,0,0,0.7) 100%)"
    : "linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.5) 52%, rgba(0,0,0,0.74) 61%, rgba(0,0,0,0.74) 79%, rgba(0,0,0,0.25) 100%)";
  return <AbsoluteFill style={{ background: bg }} />;
};

// Ekran atfı (CC BY vb.): sol üst, güvenli bölgede, küçük
export const Credit: React.FC<{ text: string }> = ({ text }) =>
  text ? (
    <div style={{ position: "absolute", left: 60, top: 120, maxWidth: 760, fontFamily: MONO, fontSize: 26, color: "rgba(255,255,255,0.8)",
      textShadow: "0 2px 8px rgba(0,0,0,0.7)" }}>
      Photo: {text}
    </div>
  ) : null;
