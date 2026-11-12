import { AbsoluteFill, Img, staticFile } from "remotion";
import { z } from "zod";
import { ALFA, FELL_SC } from "../fonts";

// Uzun video kapağı (16:9, YouTube thumbnail; EP009 2026-11-09). Arka plan: videodan temiz kare (altyazısız; woodcut klibi `remotion still`
// ya da ffmpeg ile altyazısız bir kare). Yazı: kanalın cap-paper şeritleri (Alfa Slab One, yırtık krem/sarı kâğıt), satır başına tek şerit.
// Render: npx remotion still src/index.ts Thumbnail out.png --props=../content/episodes/<EP>/clips/thumb/<ad>.json
const INK = "#14213D";
const line = z.object({ text: z.string(), size: z.number().default(120), paper: z.enum(["yellow", "cream", "none"]).default("cream"),
  color: z.string().optional(), rot: z.number().default(0), dx: z.number().default(0),
  font: z.enum(["alfa", "fell"]).default("alfa"), spacing: z.number().optional() });   // fell: belgesel/sinema başlığı (bölüm başlığı yazısı)
// Katman (özel tasarım kapak, 2026-11-09): kesik nesne / renk / dairesel pencere; x,y merkez, w genişlik (ebeveyn kutusuna göre 0-1), h yoksa görüntü oranı.
// clip "circle" + children: gözetleme deliği gibi pencere; ring: pencere çerçevesi rengi; glow: arka ışık (silüet kenarı); filter: CSS filtresi.
type Layer = { src?: string; color?: string; x: number; y: number; w: number; h?: number; rot?: number; clip?: "circle"; ring?: string; ringW?: number;
  shadow?: boolean; glow?: string; filter?: string; opacity?: number; inset?: boolean; children?: Layer[] };
const layer: z.ZodType<Layer> = z.lazy(() => z.object({ src: z.string().optional(), color: z.string().optional(), x: z.number(), y: z.number(), w: z.number(),
  h: z.number().optional(), rot: z.number().optional(), clip: z.literal("circle").optional(), ring: z.string().optional(), ringW: z.number().optional(),
  shadow: z.boolean().optional(), glow: z.string().optional(), filter: z.string().optional(), opacity: z.number().optional(), inset: z.boolean().optional(),
  children: z.array(layer).optional() }));
export const thumbSchema = z.object({
  layers: z.array(layer).default([]),
  image: z.string().optional(),            // content/ altına göre
  zoom: z.number().default(1), fx: z.number().default(0.5), fy: z.number().default(0.5),   // odak noktası (0-1)
  dim: z.number().default(0.35),           // yazı tarafına karartma
  dimSide: z.enum(["left", "right", "top", "bottom", "none"]).default("left"),
  lines: z.array(line).default([]),
  x: z.number().default(0.06), y: z.number().default(0.5), align: z.enum(["left", "center", "right"]).default("left"),
  tag: z.object({ text: z.string(), x: z.number(), y: z.number(), rot: z.number().default(4), size: z.number().default(60) }).optional(),
});

const Lay: React.FC<{ l: Layer }> = ({ l }) => {
  const filt = [l.filter, l.shadow ? "drop-shadow(10px 16px 14px rgba(0,0,0,0.6))" : "", l.glow ? `drop-shadow(0 0 6px ${l.glow}) drop-shadow(0 0 28px ${l.glow})` : ""].join(" ").trim();
  const box: React.CSSProperties = { position: "absolute", left: `${(l.x - l.w / 2) * 100}%`, width: `${l.w * 100}%`, transform: `rotate(${l.rot ?? 0}deg)`,
    opacity: l.opacity ?? 1, filter: filt || undefined };
  if (l.clip === "circle" || l.color || l.children) {
    const h = l.h ?? l.w;   // h: ebeveyn yüksekliğine göre; daire için en-boy oranını aspectRatio sağlar
    return (
      <div style={{ ...box, top: `${(l.y - (l.clip === "circle" ? 0 : h / 2)) * 100}%`, aspectRatio: l.clip === "circle" ? "1" : undefined,
        height: l.clip === "circle" ? undefined : `${h * 100}%`, translate: l.clip === "circle" ? "0 -50%" : undefined }}>
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: l.clip === "circle" ? "50%" : 0, background: l.color,
          boxShadow: l.inset ? "inset 0 0 90px 30px rgba(0,0,0,0.85)" : undefined }}>
          {l.src && <Img src={staticFile(l.src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
          {l.children?.map((c, k) => <Lay key={k} l={c} />)}
          {l.inset && <div style={{ position: "absolute", inset: 0, borderRadius: "inherit", boxShadow: "inset 0 0 90px 30px rgba(0,0,0,0.85)" }} />}
        </div>
        {l.ring && <div style={{ position: "absolute", inset: -(l.ringW ?? 26), borderRadius: "50%", border: `${l.ringW ?? 26}px solid ${l.ring}`,
          boxShadow: "inset 0 0 18px rgba(0,0,0,0.7), 0 10px 30px rgba(0,0,0,0.7)", background: "transparent" }} />}
      </div>
    );
  }
  return <Img src={staticFile(l.src!)} style={{ ...box, top: `${l.y * 100}%`, translate: "0 -50%" }} />;
};

const paper = (color: string, chars: number, size: number, v: number) => {
  const w = Math.min(900, Math.max(120, Math.round((chars * size * 0.62 + 52) / 60) * 60));
  return staticFile(`assets/caption-paper/${color}_${w}_${v}.png`);
};

export const Thumbnail: React.FC<z.infer<typeof thumbSchema>> = (p) => {
  const grad = p.dimSide === "none" ? "none" : `linear-gradient(to ${({ left: "right", right: "left", top: "bottom", bottom: "top" } as const)[p.dimSide]},`
    + ` rgba(0,0,0,${p.dim}) 0%, rgba(0,0,0,${p.dim * 0.6}) 40%, rgba(0,0,0,0) 75%)`;
  const items = p.align === "left" ? "flex-start" : p.align === "right" ? "flex-end" : "center";
  return (
    <AbsoluteFill style={{ background: "#0B0B0B", overflow: "hidden" }}>
      {p.image && <Img src={staticFile(p.image)} style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover",
        transform: `scale(${p.zoom})`, transformOrigin: `${p.fx * 100}% ${p.fy * 100}%` }} />}
      {p.layers.map((l, k) => <Lay key={k} l={l} />)}
      <AbsoluteFill style={{ background: grad }} />
      <AbsoluteFill style={{ boxShadow: "inset 0 0 220px rgba(0,0,0,0.55)" }} />
      <div style={{ position: "absolute", left: `${p.x * 100}%`, top: `${p.y * 100}%`, transform: `translate(${p.align === "center" ? "-50%" : p.align === "right" ? "-100%" : "0"}, -50%)`,
        display: "flex", flexDirection: "column", alignItems: items, gap: 18, filter: "drop-shadow(8px 12px 10px rgba(0,0,0,0.55))" }}>
        {p.lines.map((l, k) => (
          <div key={k} style={{ transform: `translateX(${l.dx}px) rotate(${l.rot}deg)` }}>
            <div style={{ position: "relative", padding: `${l.size * 0.16}px ${l.size * 0.3}px ${l.size * 0.2}px`, fontFamily: l.font === "fell" ? FELL_SC : ALFA, fontSize: l.size,
              lineHeight: 1, letterSpacing: l.spacing ?? 1, color: l.color ?? (l.paper === "none" ? "#F9D509" : INK), whiteSpace: "nowrap" }}>
              {l.paper !== "none" && <Img src={paper(l.paper, l.text.length, l.size, k % 3)} style={{ position: "absolute", left: -40, top: -40,
                width: "calc(100% + 80px)", height: "calc(100% + 80px)" }} />}
              <span style={{ position: "relative" }}>{l.text}</span>
            </div>
          </div>
        ))}
      </div>
      {p.tag && (
        <div style={{ position: "absolute", left: `${p.tag.x * 100}%`, top: `${p.tag.y * 100}%`, transform: `translate(-50%,-50%) rotate(${p.tag.rot}deg)`,
          padding: `${p.tag.size * 0.18}px ${p.tag.size * 0.34}px`, background: "#F9D509", color: INK, fontFamily: ALFA, fontSize: p.tag.size, lineHeight: 1, whiteSpace: "nowrap",
          boxShadow: "6px 9px 10px rgba(0,0,0,0.5)" }}>{p.tag.text}</div>
      )}
    </AbsoluteFill>
  );
};
