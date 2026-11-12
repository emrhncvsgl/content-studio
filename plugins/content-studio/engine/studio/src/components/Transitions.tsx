import { AbsoluteFill, Freeze, Img, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { EASE, clamp01, ease, focusBlur, lerpScale } from "./ease";

// Nesne üzerinden geçişler (vox talimatı §6). Sahne süreleri ve ses senkronu değişmez: giden sahnenin son `pre` karesinde TransOut,
// gelen sahnenin ilk `post` karesinde TransIn çalışır; karşı sahne Freeze ile tek kare olarak çizilir (gelenin ilk, gidenin son karesi).
// Pencere içinde hareket 12 fps'e basamaklanır, hız bulanıklığı alt örneklerle (smear) verilir. Bitmiş kareye efekt yok: dönüşüm sahnenin
// içindeki hedefe (pencere, tünel ağzı, çerçeve) göre kurulur.
export const ADVANCED = ["portal", "pullback", "cardflip", "zoomblur", "whip", "leak", "rgb", "halftoneWipe", "fog", "slide", "objectWipe", "matte", "surfaceTilt", "disc", "door", "window"] as const;
export type AdvKind = (typeof ADVANCED)[number];
export const isAdvanced = (t: string): t is AdvKind => (ADVANCED as readonly string[]).includes(t);

type Box = { x: number; y: number; w: number; h: number };
export type TransOpts = { target?: Box; frame?: Box; shape?: "arch" | "rect" | "circle"; elem?: boolean; pre?: number; post?: number; fps?: number; blurSamples?: number;
  dir?: "left" | "right" | "up" | "down"; color?: string;
  // Zoom'lu geçişler (portal, pullback, zoomblur, cardflip): ease = gelen sahnenin oturma eğrisi ("heavyOut" varsayılan: hızlı atılım,
  // uzun süzülme) · lens = odak bulanıklığı tepe px'i (0 kapalı): kesmeye doğru artar, gelen sahnede netliğe oturur · hunt = 0-0.5
  // odak bir kez geçip geri gelir. Ölçek her zaman log uzayında.
  ease?: string; lens?: number; hunt?: number;
  // objectWipe: kadrajı yana silerek kaplayan nesne görseli (gelen sahnedeki bir nesne: kapak, yelken, kâğıt). image (content/ köküne göre),
  // size [w, h], rot (derece, -4), scale (nesne yüksekliği / kare yüksekliği, 1.15), dir (left = soldan sağa geçer; right tersi)
  image?: string; size?: [number, number]; rot?: number; scale?: number; alpha?: boolean; // alpha: saydam kenarlı PNG (drop-shadow); dir up/down dikey
  // objectWipe derinlik (EP015 2026-11-12, akbaba kanadı): spin = geçiş boyunca toplam dönüş (derece, rot etrafında ±spin/2) ·
  // depthScale = başta 1+d kat büyük (kameraya yakın) → sonda 1−d (uzaklaşır); yandan düz silmeyle aynı görünmesin diye
  depthScale?: number; keepAspect?: boolean;
  // seam (EP015 2026-11-12): nesne kareyi tümüyle örtmek zorunda değil; gelen sahne nesnenin arkasında (geldiği yanda) açılır, ek yeri
  // nesnenin orta çizgisi (rot ile eğik) altında kalır. Küçük kaynak PNG'yi (kuş kanadı) ~4 kat büyütme gereği kalkar (≤1.8× kaynak).
  seam?: boolean;
  // ghostBlur (px, objectWipe): hız bulanıklığı kopyalarına (k > 0) yumuşatma; yoksa hızlı geçişte kopyalar basamaklı tüy kenarı yapar
  ghostBlur?: number;
  // Nesneden geçişler (EP007; bkz. Through): roll (derece; slide, matte, disc) · fg (matte: alfası kapı olan PNG) · at {x, y} (disc başlangıç noktası) ·
  // teeth (disc, 0 = daire) · spin (disc, derece) · mode "match" + to kutusu (disc: giden sahne gelen sahnedeki nesneye küçülerek oturur) ·
  // box + leaf (door: kapı boşluğu, kanat görseli) · points + hold (window: çokgen, pencerenin kaç ms önceden yanacağı)
  roll?: number; fg?: string; at?: { x: number; y: number }; teeth?: number; spin?: number; mode?: "grow" | "match"; to?: Box;
  box?: Box; leaf?: string; points?: [number, number][]; hold?: number;
  // dim (ms, portal/pullback/zoomblur): geçişten önce hedefin dışı S-eğrisiyle kararır, yalnız hedef (gözlük camı, kapı) aydınlık kalır; karartma
  // giden sahnenin parçası olduğu için dalışta onunla büyür (EP009 s59→s60, kullanıcı: "etraf karanlık olup gözlükten o sahneye geçsin")
  dim?: number };

const DEFAULTS: Record<AdvKind, [number, number]> = { // pre / post ms (portal/pullback 2026-11-02: heavyOut oturması fark edilsin diye uzun)
  portal: [900, 900], pullback: [450, 1500], cardflip: [900, 400], zoomblur: [300, 500], whip: [250, 250], leak: [300, 300], rgb: [300, 300], halftoneWipe: [300, 300], fog: [800, 900], slide: [380, 420], objectWipe: [450, 550],
  matte: [280, 300], surfaceTilt: [280, 300], disc: [280, 320], door: [300, 300], window: [280, 300],
};
export function windowFrames(kind: AdvKind, o: TransOpts | undefined, fps: number) {
  const [pre, post] = DEFAULTS[kind];
  return { pre: Math.round(((o?.pre ?? pre) / 1000) * fps), post: Math.round(((o?.post ?? post) / 1000) * fps) };
}

const LENS: Partial<Record<AdvKind, number>> = { portal: 5, pullback: 3, zoomblur: 6, cardflip: 6, matte: 6, surfaceTilt: 12, disc: 4, door: 3, window: 4 }; // varsayılan odak bulanıklığı (px)
const lensOf = (kind: AdvKind, o?: TransOpts) => o?.lens ?? LENS[kind] ?? 0;
// Lens: tüm kareye odak bulanıklığı (hız bulanıklığından ayrı; ikisi birlikte "derinlik" hissi verir)
const Lens: React.FC<{ px: number; children: React.ReactNode }> = ({ px, children }) =>
  px > 0.3 ? <AbsoluteFill style={{ filter: `blur(${px.toFixed(1)}px)` }}>{children}</AbsoluteFill> : <>{children}</>;

const TBOX: Box = { x: 0.5, y: 0.4, w: 0.4, h: 0.3 };
const PBOX: Box = { x: 0.5, y: 0.4, w: 0.42, h: 0.42 };
const smaxOf = (b: Box) => Math.max(1 / b.w, 1 / b.h) * 1.15;
// delikteki gelen sahnenin ölçeği: deliği kaplar (cover) ve kesmede ekranda ≈ 1.25 olur; kesme sonrası başlangıç ölçeği = smax × inner
const innerOf = (b: Box) => Math.max(1.25 / smaxOf(b), b.w, b.h);
// pencere içi zaman basamağı: varsayılan tam fps (2026-11-12: 12 fps basamak 2-3 karede bir hareket = "salise salise duruyor"); whip 8 fps, o.fps ile açılır
function stepped(f: number, fps: number, tfps: number) { const k = fps / tfps; return Math.floor(f / k) * k; }

// Kare ve hedef: hedef merkezini (c) ölçek S ile büyütürken ekran merkezine doğru k kadar kaydır
function focusXform(b: Box, S: number, k: number, W: number, H: number) {
  const cx = b.x * W, cy = b.y * H, tx = cx + (W / 2 - cx) * k, ty = cy + (H / 2 - cy) * k;
  return `translate(${tx}px, ${ty}px) scale(${S}) translate(${-cx}px, ${-cy}px)`;
}
const focus = (b: Box, S: number, k: number, W: number, H: number): React.CSSProperties => ({ transform: focusXform(b, S, k, W, H), transformOrigin: "0 0" });

// Hız bulanıklığı: aynı içeriği geçmiş alt zamanlarda tekrar çizip eşit ağırlıkla üst üste koyar (i. kopya opaklığı 1/(i+1))
const Smear: React.FC<{ n: number; at: (k: number) => React.CSSProperties; children: React.ReactNode }> = ({ n, at, children }) => (
  <>
    {Array.from({ length: Math.max(1, n) }, (_, i) => (
      <AbsoluteFill key={i} style={{ transformOrigin: "50% 50%", ...at(i / Math.max(1, n)), opacity: 1 / (i + 1) }}>{children}</AbsoluteFill>
    ))}
  </>
);

// Portal dalışı (2026-11-05; "sahne bir anda belirip sonra içine dalma olmasın"): pre + post tek bir hareket, g 0 → 1 kesmeyi fark ettirmez.
// Kamera önce hedefe yavaşça yaklaşır; delik sıfırdan, yumuşak kenarlı büyür ve aynı anda açılır. Gelen sahne delikte 0.95 → 1 büyür (kamerayla
// aynı yönde) ve g = 0.7'de zaten tam oturmuştur, ayrı bir oturma yok. Giden sahne kesmeden sonra da (prev) sönerek biter.
const PortalDive: React.FC<{ b: Box; g: number; dg: number; n: number; W: number; H: number; out: React.ReactNode; inn: React.ReactNode }> = ({ b, g, dg, n, W, H, out, inn }) => {
  const cam = (t: number) => { const q = clamp01(t / 0.75); return focus(b, lerpScale(1, smaxOf(b) * 1.4, Math.pow(q, 2.2)), EASE.cubic(q), W, H); };
  const iris = 2.4 * EASE.cubic(clamp01((g - 0.04) / 0.68));
  const rx = Math.max(1, b.w * W * 0.6 * iris), ry = Math.max(1, b.h * H * 0.6 * iris);
  const mask = `radial-gradient(ellipse ${rx}px ${ry}px at ${b.x * W}px ${b.y * H}px, transparent 55%, #000 100%)`;
  const sIn = lerpScale(0.95, 1, 1 - Math.pow(1 - clamp01(g / 0.7), 3));
  const fade = 1 - EASE.cubic(clamp01((g - 0.55) / 0.2));
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ transform: `scale(${sIn})` }}>{inn}</AbsoluteFill>
      {fade > 0 && (
        <AbsoluteFill style={{ opacity: fade }}>
          <Smear n={Math.min(n, 4)} at={(k) => cam(g - k * dg * 0.6)}>
            <AbsoluteFill style={iris > 0.01 ? { WebkitMaskImage: mask, maskImage: mask } : undefined}>{out}</AbsoluteFill>
          </Smear>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

// Pullback dalışı (2026-11-12, EP010 geri bildirimi: "önceki sahne smooth kaybolmuyor, salise salise duruyor"): pre + post TEK hareket, tam fps.
// Eski sürüm: kesmeden önce heavy itme (hız kesmede sıfır), kesmeden sonra 12 fps basamaklı heavyOut küçülme (2-3 karede bir hareket) ve çerçevenin
// hedefe park edip DONMUŞ kareyle durup sonra sönmesi. Yeni: kamera g 0 → 1 boyunca tek sin eğrisiyle geri çekilir (kesmede hız tepeye yakın),
// giden sahne çerçeve/delik içinde hareket sürerken söner (g 0.5 → 0.8; g 0.8'de hız tepenin ~%60'ı) → hiçbir an duran bir parça kalmaz.
// Donmuş son kare çerçeve içinde hafifçe itilmeye devam eder (canlı görünür).
const PullDive: React.FC<{ b: Box; o?: TransOpts; g: number; dg: number; n: number; W: number; H: number; out: React.ReactNode; inn: React.ReactNode }> = ({ b, o, g, dg, n, W, H, out, inn }) => {
  const smax = smaxOf(b), E = ease(o?.ease, "sin");
  const cam = (t: number) => { const m = E(clamp01(t)); return focus(b, lerpScale(smax, 1, m), 1 - m, W, H); };
  const fade = 1 - EASE.sin(clamp01((g - 0.5) / 0.3));
  const drift = 1 + 0.06 * clamp01(g);
  const inner = Math.max(1 / smax, b.w, b.h) * drift;
  const prevPic = <AbsoluteFill style={{ transform: `scale(${drift})` }}>{out}</AbsoluteFill>;
  const content = (
    <AbsoluteFill>
      {inn}
      {fade > 0.001 ? (o?.elem
        ? <HoleFill b={b} shape={o.shape} W={W} H={H} inner={inner} opacity={fade}>{out}</HoleFill>
        : <AbsoluteFill style={{ opacity: fade }}><FrameBox b={b} W={W} H={H} inner={1 / smax}>{prevPic}</FrameBox></AbsoluteFill>) : null}
    </AbsoluteFill>
  );
  return <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}><Smear n={Math.min(n, 4)} at={(k) => cam(g - k * dg * 0.8)}>{content}</Smear></AbsoluteFill>;
};

// Nesneden geçişler (2026-11-05, earn.edits referansı): kapı sahnenin anlamlı bir nesnesi, kenar keskin, süre 0.4-0.6 sn. pre + post tek hareket (g 0 → 1),
// kesme görünmez; tam fps. Ortak: gelen sahne kamerayla aynı yönde oturur, giden sahne kesmeden sonra (prev) biter.
const THROUGH: AdvKind[] = ["matte", "surfaceTilt", "disc", "door", "window"];
const isThrough = (k: AdvKind) => THROUGH.includes(k);
const rollXf = (deg: number, s = 1) => `rotate(${deg}deg) scale(${s * (1 + 0.03 * Math.abs(deg))})`; // 9:16 kare 15°'de köşe açmasın
const boxOf = (pts: [number, number][]): Box => {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
};
const camTo = (b: Box, t: number, W: number, H: number, k = 1.4) => { const q = clamp01(t / 0.72); return focus(b, lerpScale(1, smaxOf(b) * k, Math.pow(q, 2.2)), EASE.cubic(q), W, H); };
const sInOf = (g: number) => lerpScale(0.95, 1, 1 - Math.pow(1 - clamp01(g / 0.7), 3));
const fadeOf = (g: number) => 1 - EASE.cubic(clamp01((g - 0.55) / 0.2));
// Dişli ya da düz disk kenarı (px): teeth 0 = daire
function discPts(cx: number, cy: number, r: number, teeth: number, rot: number) {
  const n = teeth > 0 ? teeth * 4 : 72, pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * Math.PI + rot, rr = teeth > 0 && i % 4 >= 2 ? r * 0.9 : r;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)}px ${(cy + rr * Math.sin(a)).toFixed(1)}px`);
  }
  return pts;
}
const DiscRim: React.FC<{ pts: string[]; W: number; H: number; glow: number }> = ({ pts, W, H, glow }) => (
  <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
    <polygon points={pts.map((p) => p.replace(/px/g, "").replace(" ", ",")).join(" ")} fill="none" stroke={`rgba(255,244,222,${0.9 * glow})`} strokeWidth={5}
      style={{ filter: `drop-shadow(0 0 ${18 * glow}px rgba(255,236,200,${glow}))` }} />
  </svg>
);

const Through: React.FC<{ kind: AdvKind; o?: TransOpts; g: number; dg: number; lit?: number; W: number; H: number; out: React.ReactNode; inn: React.ReactNode }> = ({ kind, o, g, lit, W, H, out, inn }) => {
  const fade = fadeOf(g), sIn = sInOf(g);
  const Inn = <AbsoluteFill style={{ transform: `scale(${sIn})` }}>{inn}</AbsoluteFill>;
  if (kind === "surfaceTilt") { // tek masa: iki yüzey aynı düzlemde kayar, kamera hafif eğilir
    const a = Math.sin(Math.PI * clamp01(g));
    return (
      <AbsoluteFill style={{ background: "#000", perspective: 1600, overflow: "hidden" }}>
        <AbsoluteFill style={{ transform: `rotateX(${(6 * a).toFixed(2)}deg) scale(${1 + 0.08 * a})` }}>
          <Slide g={() => clamp01(g)} dir={o?.dir ?? "up"} W={W} H={H} n={1} a={out} b={inn} />
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }
  if (kind === "disc" && o?.mode === "match") { // giden sahne küçülen diskin içinde kalır ve gelen sahnedeki nesneye oturur
    const at = o.at ?? { x: 0.5, y: 0.5 }, to = o.to ?? { x: 0.5, y: 0.3, w: 0.2, h: 0.12 };
    // 2026-11-12 (EP010 s02): heavy eğri g 0.72'de durup disk küçük hâlde donmuş kareyle bekliyordu. Şimdi sin eğrisi g 0 → 1, disk hedefin %85'ine
    // kadar küçülmeye devam ederken söner; sönme bitince (g 0.8) hız hâlâ tepenin ~%60'ı.
    const R0 = Math.hypot(W, H) * 0.62, R1 = (Math.max(to.w * W, to.h * H) / 2) * 0.85, q = EASE.sin(clamp01(g));
    const r = lerpScale(R0, R1, q), cx = (at.x + (to.x - at.x) * q) * W, cy = (at.y + (to.y - at.y) * q) * H;
    // giden sahne nesneye OTURURKEN erir (g 0.5 → 0.8), oturduktan sonra beklemez (kullanıcı 2026-11-10: "o parça yeni sahnede 1-2 sn duruyor")
    const pts = discPts(cx, cy, r, 0, 0), end = 1 - EASE.sin(clamp01((g - 0.45) / 0.35));
    return (
      <AbsoluteFill style={{ background: "#000" }}>
        <AbsoluteFill>{inn}</AbsoluteFill>
        <AbsoluteFill style={{ opacity: end, clipPath: `polygon(${pts.join(",")})` }}>
          <AbsoluteFill style={{ transform: `translate(${cx - W / 2}px, ${cy - H / 2}px) scale(${Math.min(1, (r / (W / 2)) * 1.02)})` }}>{out}</AbsoluteFill>
        </AbsoluteFill>
        <AbsoluteFill style={{ opacity: end }}><DiscRim pts={pts} W={W} H={H} glow={0.4 + 0.6 * q} /></AbsoluteFill>
      </AbsoluteFill>
    );
  }
  if (kind === "disc") { // ışık noktası dönen keskin diske açılır, kare yatar; gelen sahne yatık başlar ve düzelir
    const at = o?.at ?? { x: 0.5, y: 0.5 }, cx = at.x * W, cy = at.y * H, roll = o?.roll ?? 15, q = clamp01(g / 0.66);
    const R = Math.hypot(Math.max(at.x, 1 - at.x) * W, Math.max(at.y, 1 - at.y) * H) * 1.2, r = R * Math.pow(q, 2.6);
    const pts = discPts(cx, cy, Math.max(1, r), o?.teeth ?? 0, ((o?.spin ?? 200) * EASE.cubic(clamp01(g)) * Math.PI) / 180);
    const degOut = roll * Math.pow(clamp01(g / 0.6), 2), degIn = -roll * (1 - EASE.heavyOut(clamp01((g - 0.1) / 0.9)));
    const flare = Math.sin(Math.PI * clamp01(g / 0.3));
    return (
      <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
        <AbsoluteFill style={{ transform: rollXf(degOut), transformOrigin: `${cx}px ${cy}px` }}>{out}</AbsoluteFill>
        <div style={{ position: "absolute", left: cx - 150, top: cy - 150, width: 300, height: 300, opacity: flare, background: "radial-gradient(circle, #FFF6E0 0%, rgba(255,226,174,0.55) 18%, rgba(255,226,174,0) 62%)" }} />
        {r > 1 && <AbsoluteFill style={{ clipPath: `polygon(${pts.join(",")})` }}><AbsoluteFill style={{ transform: rollXf(degIn) }}>{inn}</AbsoluteFill></AbsoluteFill>}
        {r > 1 && r < R && <DiscRim pts={pts} W={W} H={H} glow={1 - q * 0.6} />}
      </AbsoluteFill>
    );
  }
  if (kind === "matte") { // fg'nin saydam yeri kapı: giden sahne o maskeyle delinir, kamera aralıktan geçer
    const url = `url("${staticFile(o?.fg ?? "")}")`, b = o?.target ?? { x: 0.5, y: 0.5, w: 0.3, h: 0.5 }, deg = (o?.roll ?? 6) * clamp01(g / 0.72);
    const open = EASE.cubic(clamp01(g / 0.22));
    return (
      <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
        {Inn}
        <Img src={staticFile(o?.fg ?? "")} style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} />
        {fade > 0 && (
          <AbsoluteFill style={{ opacity: fade }}>
            <AbsoluteFill style={{ ...camTo(b, g, W, H, 1.6) }}>
              <AbsoluteFill style={{ transform: `rotate(${deg}deg)` }}>
                <AbsoluteFill style={{ WebkitMaskImage: url, maskImage: url, WebkitMaskSize: "100% 100%", maskSize: "100% 100%" }}>{out}</AbsoluteFill>
                {open < 1 && <AbsoluteFill style={{ opacity: 1 - open }}>{out}</AbsoluteFill>}
              </AbsoluteFill>
            </AbsoluteFill>
          </AbsoluteFill>
        )}
      </AbsoluteFill>
    );
  }
  if (kind === "door") { // iki kanat menteşeden açılır, ardında gelen sahne; kamera boşluktan geçer
    const b = o?.box ?? TBOX, x = (b.x - b.w / 2) * W, y = (b.y - b.h / 2) * H, w = b.w * W, h = b.h * H;
    const open = EASE.cubic(clamp01(g / 0.42)), hole = `path(evenodd, "M0,0 H${W} V${H} H0 Z M${x},${y} H${x + w} V${y + h} H${x} Z")`;
    const leaf = (side: "l" | "r"): React.CSSProperties => ({ position: "absolute", top: y, height: h, width: w / 2, left: side === "l" ? x : x + w / 2,
      transformOrigin: side === "l" ? "0 50%" : "100% 50%", transform: `rotateY(${(side === "l" ? 1 : -1) * 105 * open}deg)`,
      boxShadow: "inset 0 0 40px rgba(0,0,0,0.55)", background: o?.color ?? "#4A3B2A" });
    return (
      <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
        {Inn}
        {fade > 0 && (
          <AbsoluteFill style={{ opacity: fade }}>
            <AbsoluteFill style={{ ...camTo(b, clamp01((g - 0.14) / 0.86), W, H) }}>
              <AbsoluteFill style={{ clipPath: hole }}>{out}</AbsoluteFill>
              <AbsoluteFill style={{ perspective: 1400, perspectiveOrigin: `${b.x * 100}% ${b.y * 100}%` }}>
                {(["l", "r"] as const).map((sd) => (
                  <div key={sd} style={leaf(sd)}>{o?.leaf && <Img src={staticFile(o.leaf)} style={{ width: "100%", height: "100%", objectFit: "fill", transform: sd === "r" ? "scaleX(-1)" : undefined }} />}</div>
                ))}
              </AbsoluteFill>
            </AbsoluteFill>
          </AbsoluteFill>
        )}
      </AbsoluteFill>
    );
  }
  // window: çokgen keskin kalır, delik açılmaz; yalnızca kamera geçer
  const pts = o?.points ?? [[0.4, 0.3], [0.6, 0.3], [0.6, 0.5], [0.4, 0.5]], b = boxOf(pts);
  const hole = `path(evenodd, "M0,0 H${W} V${H} H0 Z M${pts.map((p) => `${p[0] * W},${p[1] * H}`).join(" L")} Z")`;
  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      {Inn}
      {fade > 0 && (
        <AbsoluteFill style={{ opacity: fade }}>
          <AbsoluteFill style={{ ...camTo(b, g, W, H) }}>
            <AbsoluteFill style={{ clipPath: hole }}>{out}</AbsoluteFill>
            {lit !== undefined && lit < 1 && <AbsoluteFill style={{ opacity: 1 - lit }}>{out}</AbsoluteFill>}
          </AbsoluteFill>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

// Gelen/giden sahneyi tek kare olarak çiz (kendi süresiyle: kamera ilerlemesi doğru hesaplanır)
export const Frozen: React.FC<{ at: number; dur: number; children: React.ReactNode }> = ({ at, dur, children }) => (
  <Freeze frame={at}><Sequence durationInFrames={dur}>{children}</Sequence></Freeze>
);


// Giden sahne: penceresinin içindeki kare için (f: sahne içi kare, D: sahne süresi)
export const TransOut: React.FC<{ kind: AdvKind; o?: TransOpts; D: number; next: React.ReactNode; children: React.ReactNode }> = (props) => {
  const fRaw = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { pre } = windowFrames(props.kind, props.o, fps);
  const u = clamp01((fRaw - (props.D - pre)) / Math.max(1, pre));
  // giden sahne kesmeye doğru odaktan çıkar (gelen sahnenin tepe bulanıklığının %60'ına kadar, hızlanarak; portalda kesme görünmesin diye tepeye kadar)
  const dimF = props.o?.dim ? Math.round((props.o.dim / 1000) * fps) : 0;
  let body = props.children;
  if (dimF > 0 && fRaw >= props.D - pre - dimF) {
    const k = EASE.cubic(clamp01((fRaw - (props.D - pre - dimF)) / dimF));
    const b = props.o?.target ?? TBOX;
    const r = Math.max(b.w, b.h) * 55;   // % (iç yarıçap ≈ hedefin yarısı)
    body = (
      <AbsoluteFill>
        {props.children}
        <AbsoluteFill style={{ pointerEvents: "none", opacity: 0.94 * k,
          background: `radial-gradient(circle at ${b.x * 100}% ${b.y * 100}%, rgba(0,0,0,0) ${r * 0.55}%, rgba(0,0,0,0.6) ${r * 0.9}%, rgba(0,0,0,1) ${r * 1.6}%)` }} />
      </AbsoluteFill>
    );
  }
  return <Lens px={fRaw < props.D - pre ? 0 : (isThrough(props.kind) ? 1 : 0.6) * lensOf(props.kind, props.o) * Math.pow(u, 3)}><TransOutBody {...props}>{body}</TransOutBody></Lens>;
};
const TransOutBody: React.FC<{ kind: AdvKind; o?: TransOpts; D: number; next: React.ReactNode; children: React.ReactNode }> = ({ kind, o, D, next, children }) => {
  const fRaw = useCurrentFrame();
  const { width: W, height: H, fps } = useVideoConfig();
  const { pre } = windowFrames(kind, o, fps);
  const start = D - pre;
  if (kind === "window" && o?.points) { // pencere geçişten önce yanar: dünyanın parçası gibi durur
    const lit = Math.round(((o.hold ?? 1400) / 1000) * fps);
    if (fRaw >= start - lit && fRaw < start) {
      return <Through kind={kind} o={o} g={0} dg={0} lit={clamp01((fRaw - start + lit) / (0.3 * fps))} W={W} H={H} out={children} inn={next} />;
    }
  }
  if (fRaw < start || pre <= 0) return <>{children}</>;
  if (isThrough(kind)) {
    const { post } = windowFrames(kind, o, fps);
    return <Through kind={kind} o={o} g={(fRaw - start) / (pre + post)} dg={1 / (pre + post)} W={W} H={H} out={children} inn={next} />;
  }
  const f = stepped(fRaw - start, fps, o?.fps ?? (kind === "whip" ? 8 : fps));
  const u = clamp01(f / pre), dt = 1 / pre, n = Math.min(8, o?.blurSamples ?? 6);
  const b = o?.target ?? TBOX;
  if (kind === "portal") { // tam fps: basamaklı zaman dalışta titriyordu
    const { post } = windowFrames(kind, o, fps);
    return <PortalDive b={b} g={(fRaw - start) / (pre + post)} dg={1 / (pre + post)} n={n} W={W} H={H} out={children} inn={next} />;
  }
  if (kind === "cardflip") {
    const flipEnd = 0.6;
    const zu = clamp01((u - flipEnd) / (1 - flipEnd));
    const smax = smaxOf(b);
    const S = (t: number) => Math.exp(Math.log(smax) * Math.pow(clamp01(t), 2.6));
    const fl = EASE.heavy(clamp01(u / flipEnd));
    const content = (
      <AbsoluteFill>
        {children}
        <Card b={b} p={fl} W={W} H={H} front={children} back={next} inner={innerOf(b)} />
      </AbsoluteFill>
    );
    if (zu <= 0) return content;
    return <Smear n={n} at={(k) => focus(b, S(zu - k * dt * 0.6), EASE.cubic(clamp01(zu - k * dt * 0.6)), W, H)}>{content}</Smear>;
  }
  if (kind === "pullback") { // tam fps, kesmeyi aşan tek hareket (PullDive)
    const { post } = windowFrames(kind, o, fps);
    return <PullDive b={o?.frame ?? PBOX} o={o} g={(fRaw - start) / (pre + post)} dg={1 / (pre + post)} n={n} W={W} H={H} out={children} inn={next} />;
  }
  if (kind === "zoomblur") {
    const S = (t: number) => 1 + 2.6 * Math.pow(clamp01(t), 3);
    return <Smear n={Math.max(n, 6)} at={(k) => ({ transform: `scale(${S(u - k * dt * 2)})` })}>{children}</Smear>;
  }
  if (kind === "whip") {
    const v = vec(o?.dir), X = (t: number) => -EASE.expoIn(clamp01(t));
    return <Smear n={n} at={(k) => ({ transform: `translate(${X(u - k * dt) * v.x * W}px, ${X(u - k * dt) * v.y * H}px)` })}>{children}</Smear>;
  }
  if (kind === "rgb") return <RGB amount={26 * EASE.expoIn(u)} punch={1 + 0.08 * EASE.expoIn(u)}>{children}</RGB>;
  if (kind === "leak") return <AbsoluteFill>{children}<Leak p={0.5 * u} color={o?.color} /></AbsoluteFill>;
  if (kind === "halftoneWipe") return <AbsoluteFill>{children}<Dots p={EASE.cubic(u)} color={o?.color ?? "#14213D"} W={W} H={H} /></AbsoluteFill>;
  if (kind === "slide") { // iki sahne birlikte kayar (push): heavy ease, kesme hareketin ortasında
    const { post } = windowFrames(kind, o, fps);
    return <Slide g={(t) => clamp01((f - t * dt * pre * 0.6) / (pre + post))} dir={o?.dir} W={W} H={H} n={n} a={children} b={next} roll={o?.roll} />;
  }
  if (kind === "fog") return <AbsoluteFill>{children}<Fog cover={EASE.cubic(u)} drift={u * 0.5} color={o?.color} dir={o?.dir} W={W} H={H} f={fRaw} /></AbsoluteFill>;
  if (kind === "objectWipe") return <AbsoluteFill>{children}<ObjWipe pos={(t) => clamp01(u - t * dt * 0.8)} phase="in" o={o} W={W} H={H} n={n} other={o?.seam ? next : undefined} /></AbsoluteFill>;
  return <>{children}</>;
};

// Gelen sahne: penceresinin içindeki kare için (prev: giden sahnenin son karesi, pullback çerçevesinin içinde)
export const TransIn: React.FC<{ kind: AdvKind; o?: TransOpts; prev: React.ReactNode; children: React.ReactNode }> = (props) => {
  const fRaw = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { post } = windowFrames(props.kind, props.o, fps);
  const lens = fRaw >= post ? 0 : focusBlur(fRaw / Math.max(1, post), lensOf(props.kind, props.o), props.o?.hunt ?? 0, 0.55);
  return <Lens px={lens}><TransInBody {...props} /></Lens>;
};
const TransInBody: React.FC<{ kind: AdvKind; o?: TransOpts; prev: React.ReactNode; children: React.ReactNode }> = ({ kind, o, prev, children }) => {
  const fRaw = useCurrentFrame();
  const { width: W, height: H, fps } = useVideoConfig();
  const { post } = windowFrames(kind, o, fps);
  if (fRaw >= post || post <= 0) return <>{children}</>;
  if (isThrough(kind)) {
    const { pre } = windowFrames(kind, o, fps);
    return <Through kind={kind} o={o} g={(pre + fRaw) / (pre + post)} dg={1 / (pre + post)} W={W} H={H} out={prev} inn={children} />;
  }
  // atılım 12 fps basamaklı (stop-motion hissi); uzun oturma kuyruğu tam fps (yavaş süzülmede basamak titrer)
  const st = stepped(fRaw, fps, o?.fps ?? (kind === "whip" ? 8 : fps));
  const f = st / post < 0.4 ? st : fRaw;
  const v = clamp01(f / post), dt = 1 / post, n = Math.min(8, o?.blurSamples ?? 6);
  const E = ease(o?.ease, "heavyOut");
  if (kind === "portal") {
    const { pre } = windowFrames(kind, o, fps);
    return <PortalDive b={o?.target ?? TBOX} g={(pre + fRaw) / (pre + post)} dg={1 / (pre + post)} n={n} W={W} H={H} out={prev} inn={children} />;
  }
  if (kind === "cardflip") { // maskenin içinden çıkan sahne oturur
    const b = o?.target ?? TBOX, s0 = smaxOf(b) * innerOf(b);
    const s = (t: number) => lerpScale(s0, 1, E(clamp01(t)));
    return <Smear n={Math.ceil(n / 2)} at={(k) => ({ transform: `scale(${s(v - k * dt * 0.4)})` })}>{children}</Smear>;
  }
  if (kind === "pullback") {
    const { pre } = windowFrames(kind, o, fps);
    return <PullDive b={o?.frame ?? PBOX} o={o} g={(pre + fRaw) / (pre + post)} dg={1 / (pre + post)} n={n} W={W} H={H} out={prev} inn={children} />;
  }
  if (kind === "zoomblur") {
    const S = (t: number) => lerpScale(1.8, 1, E(clamp01(t)));
    return <Smear n={Math.max(n, 6)} at={(k) => ({ transform: `scale(${S(v - k * dt * 2)})` })}>{children}</Smear>;
  }
  if (kind === "whip") {
    const d = vec(o?.dir), X = (t: number) => 1 - EASE.expoOut(clamp01(t));
    return <Smear n={n} at={(k) => ({ transform: `translate(${X(v - k * dt) * d.x * W}px, ${X(v - k * dt) * d.y * H}px)` })}>{children}</Smear>;
  }
  if (kind === "rgb") return <RGB amount={26 * (1 - EASE.expoOut(v))} punch={1 + 0.08 * (1 - EASE.expoOut(v))}>{children}</RGB>;
  if (kind === "leak") return <AbsoluteFill>{children}<Leak p={0.5 + 0.5 * v} color={o?.color} /></AbsoluteFill>;
  if (kind === "halftoneWipe") return <AbsoluteFill>{children}<Dots p={1 - EASE.cubic(v)} color={o?.color ?? "#14213D"} W={W} H={H} /></AbsoluteFill>;
  if (kind === "slide") {
    const { pre } = windowFrames(kind, o, fps);
    return <Slide g={(t) => clamp01((pre + f - t * dt * post * 0.6) / (pre + post))} dir={o?.dir} W={W} H={H} n={n} a={prev} b={children} roll={o?.roll} />;
  }
  if (kind === "fog") return <AbsoluteFill>{children}<Fog cover={1 - EASE.cubic(v)} drift={0.5 + v * 0.5} color={o?.color} dir={o?.dir} W={W} H={H} f={fRaw + 1000} /></AbsoluteFill>;
  if (kind === "objectWipe") return <AbsoluteFill>{children}<ObjWipe pos={(t) => clamp01(v - t * dt * 0.8)} phase="out" o={o} W={W} H={H} n={n} other={o?.seam ? prev : undefined} /></AbsoluteFill>;
  return <>{children}</>;
};

// Kaydırma (push): giden ve gelen sahne yan yana, birlikte kayar; heavy ease (ağır kalkış, hızlı orta, uzun duruş). Aralarında ince gölge.
// dir: hareket yönü (left varsayılan: yeni sahne sağdan gelir; up: alttan gelir, referanstaki dikey push). g(t): alt örnek için geçmiş zaman
const Slide: React.FC<{ g: (t: number) => number; dir?: TransOpts["dir"]; W: number; H: number; n: number; a: React.ReactNode; b: React.ReactNode; roll?: number }> = ({ g, dir, W, H, n, a, b, roll = 0 }) => {
  const v = dir === "right" ? { x: 1, y: 0 } : dir === "up" ? { x: 0, y: -1 } : dir === "down" ? { x: 0, y: 1 } : { x: -1, y: 0 };
  const pos = (t: number) => EASE.heavy(g(t));
  const tr = (k: number, t: number) => `translate(${(v.x * pos(t) + k * -v.x) * W}px, ${(v.y * pos(t) + k * -v.y) * H}px)`;
  const edge: React.CSSProperties = { position: "absolute", inset: 0, boxShadow: "0 0 50px 10px rgba(0,0,0,0.45)" };
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#000" }}>
      <AbsoluteFill style={roll ? { transform: rollXf(roll * Math.sin(Math.PI * g(0))) } : undefined}>
        <Smear n={n} at={(k) => ({ transform: tr(0, k) })}>{a}</Smear>
        <Smear n={n} at={(k) => ({ transform: tr(1, k) })}><AbsoluteFill>{b}<div style={edge} /></AbsoluteFill></Smear>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Sis silmesi: kameranın önünden yoğun bir sis bankası geçer (ön plan silmesi). cover 0 → 1 → 0; drift 0 → 1 sisin yatay geçişi.
// Üç katman farklı hızda (yakın sis hızlı, uzak yavaş) → derinlik. Sis altındaki sahne hafif açılır ve bulanıklaşır (backdrop).
const Fog: React.FC<{ cover: number; drift: number; color?: string; dir?: TransOpts["dir"]; W: number; H: number; f: number }> = ({ cover, drift, color = "#DCE2E6", dir, W, H, f }) => {
  const sgn = dir === "right" ? -1 : 1;
  const layer = (speed: number, freq: string, seed: number, op: number, k: number) => {
    const x = sgn * (0.6 - drift * speed) * W;   // sağdan sola geçer
    const edge = Math.max(0, Math.min(100, (cover * 1.4 - 0.2 + k * 0.08) * 100));
    return (
      <svg key={seed} width={W * 2.2} height={H} style={{ position: "absolute", left: x - W * 0.6, top: 0, opacity: op }}>
        <defs>
          <filter id={`fog${seed}`} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency={freq} numOctaves={4} seed={seed} />
            <feColorMatrix type="matrix" values={`0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1.7 -0.35`} />
            <feGaussianBlur stdDeviation={6} />
          </filter>
          <linearGradient id={`fogm${seed}`} x1={sgn > 0 ? "1" : "0"} x2={sgn > 0 ? "0" : "1"} y1="0" y2="0">
            <stop offset={`${Math.max(0, edge - 25)}%`} stopColor="#fff" stopOpacity={1} />
            <stop offset={`${edge}%`} stopColor="#fff" stopOpacity={0} />
          </linearGradient>
          <mask id={`fogk${seed}`}><rect width="100%" height="100%" fill={`url(#fogm${seed})`} /></mask>
        </defs>
        <g mask={`url(#fogk${seed})`}>
          <rect width="100%" height="100%" fill={color} opacity={Math.min(1, cover * 1.5)} />
          <rect width="100%" height="100%" filter={`url(#fog${seed})`} style={{ mixBlendMode: "screen" }} />
        </g>
      </svg>
    );
  };
  void f;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      <AbsoluteFill style={{ backdropFilter: `blur(${(cover * 10).toFixed(1)}px) brightness(${1 + cover * 0.25})` }} />
      {layer(0.5, "0.0018 0.004", 3, 0.85, 0)}
      {layer(0.9, "0.003 0.007", 7, 0.9, 1)}
      {layer(1.5, "0.0045 0.01", 11, 1, 2)}
    </AbsoluteFill>
  );
};

// Nesne silmesi: büyük nesne (gelen sahneden; ör. kırmızı deri kapak) ekran dışından girer, kesmede kareyi tamamen kaplar, sonra öbür
// yandan çıkar ve gelen sahne arkasında kalır. Giriş hızlanarak (kesmeye doğru en hızlı), çıkış heavyOut (hızlı başlar, süzülür).
// Kenarda gölge (nesne kâğıt/deri kalınlığı), hareket bulanıklığı alt örneklerle. phase in: pos 0 → 1 = ekran dışı → kaplama merkezi; out: merkez → dışarı.
const ObjWipe: React.FC<{ pos: (t: number) => number; phase: "in" | "out"; o?: TransOpts; W: number; H: number; n: number; other?: React.ReactNode }> = ({ pos, phase, o, W, H, n, other }) => {
  if (!o?.image) return null;
  const [iw, ih] = o.size ?? [1600, 1200];
  // dir up/down (IYH001 2026-11-09): dikey geçiş (up = alttan yukarı); scale o zaman genişlik / kare genişliği
  const vert = o.dir === "up" || o.dir === "down";
  // keepAspect (EP015): saydam PNG oranını korur (dikey geçişte kuş kesiği H×1.25'e uzayıp basıklaşıyordu); kaplama scale ile sağlanır.
  // Eski bölümler (alpha, keepAspect yok) aynı kalır.
  const ka = !!o.keepAspect;
  const w = vert ? W * (o.scale ?? 1.15) : ka ? H * (o.scale ?? 1.15) * (iw / ih) : Math.max(H * (o.scale ?? 1.15) * (iw / ih), W * 1.25);
  const h = vert ? (ka ? w * (ih / iw) : Math.max(w * (ih / iw), H * 1.25)) : H * (o.scale ?? 1.15);
  const sgn = o.dir === "right" || o.dir === "up" ? -1 : 1;
  const L = vert ? H / 2 + h / 2 + 40 : W / 2 + w / 2 + 40;
  const start = -L, mid = 0, end = L; // nesne merkezinin ekran merkezine göre konumu (yatayda x, dikeyde y)
  const X = (t: number) => {
    const q = pos(t);
    return phase === "in" ? start + (mid - start) * Math.pow(q, 2.2) : mid + (end - mid) * EASE.heavyOut(q);
  };
  // alpha: true → saydam kenarlı PNG (dalga sırtı gibi düzensiz kenar); kutu gölgesi yerine alfayı izleyen drop-shadow
  const shadowCss = o.alpha ? { filter: "drop-shadow(0 0 40px rgba(0,0,0,0.5))" } : { boxShadow: "0 0 60px 20px rgba(0,0,0,0.5)" };
  // seam: öbür sahne (in: gelen, nesnenin arkasında · out: giden, nesnenin önünde) nesne orta çizgisiyle kırpılır
  let seamEl: React.ReactNode = null;
  if (o.seam && other) {
    const x0 = sgn * X(0), r0 = (o.rot ?? -4) + (o.spin ?? 0) * ((X(0) - start) / (end - start) - 0.5);
    const tn = Math.tan((r0 * Math.PI) / 180), cx = W / 2 + (vert ? 0 : x0), cy = H / 2 + (vert ? x0 : 0);
    // behind = nesnenin geldiği yan (hareketin tersi); in fazında gelen sahne orada, out fazında giden sahne öbür yanda
    const back = phase === "in";
    let poly: string;
    if (vert) {
      const yl = cy + (0 - cx) * tn, yr = cy + (W - cx) * tn, top = (sgn === 1) === back;  // down (sgn 1): arkası üst
      poly = top ? `0px 0px, ${W}px 0px, ${W}px ${yr}px, 0px ${yl}px` : `0px ${yl}px, ${W}px ${yr}px, ${W}px ${H}px, 0px ${H}px`;
    } else {
      const xt = cx - (0 - cy) * tn, xb = cx - (H - cy) * tn, left = (sgn === 1) === back;
      poly = left ? `0px 0px, ${xt}px 0px, ${xb}px ${H}px, 0px ${H}px` : `${xt}px 0px, ${W}px 0px, ${W}px ${H}px, ${xb}px ${H}px`;
    }
    seamEl = <AbsoluteFill style={{ clipPath: `polygon(${poly})` }}>{other}</AbsoluteFill>;
  }
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      {seamEl}
      {Array.from({ length: Math.max(1, Math.ceil(n / 2)) }, (_, k) => {
        const xr = X(k / Math.max(1, Math.ceil(n / 2))), x = sgn * xr;
        const prog = (xr - start) / (end - start);   // 0 giriş … 1 çıkış (spin/depthScale için)
        const rr = (o.rot ?? -4) + (o.spin ?? 0) * (prog - 0.5), zs = 1 + (o.depthScale ?? 0) * (1 - 2 * prog);
        return (
          <div key={k} style={{ position: "absolute", left: W / 2 - w / 2 + (vert ? 0 : x), top: H / 2 - h / 2 + (vert ? x : 0), width: w, height: h, opacity: 1 / (k + 1),
            transform: `rotate(${rr}deg) scale(${zs})`, ...(k ? (o.ghostBlur ? { filter: `blur(${o.ghostBlur}px)` } : {}) : shadowCss) }}>
            <Img src={staticFile(o.image!)} style={{ width: "100%", height: "100%", objectFit: o.alpha ? "fill" : "cover" }} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const vec = (dir: TransOpts["dir"]) => (dir === "right" ? { x: -1, y: 0 } : dir === "up" ? { x: 0, y: 1 } : dir === "down" ? { x: 0, y: -1 } : { x: 1, y: 0 });

// Kart çevirme (AE kalitesi): kart masadan kalkar (Z + ölçek), Y ekseninde döner, hafif taşıp oturur. Kalınlık (arka arkaya kenar
// katmanları), yüz başına ışık (açıya göre kararma + geçen parlama), masada kalan gölge (kalktıkça büyür, yumuşar, açıyla daralır),
// dönüş hızına göre bulanıklık. p: 0 → 1 (heavy ease dışarıda uygulanır)
const Card: React.FC<{ b: Box; p: number; W: number; H: number; front: React.ReactNode; back: React.ReactNode; inner: number }> = ({ b, p, W, H, front, back, inner }) => {
  const w = b.w * W, h = b.h * H;
  const lift = Math.sin(Math.min(1, p) * Math.PI);                 // 0 → 1 → 0
  const over = p > 0.82 ? 7 * Math.sin(((p - 0.82) / 0.18) * Math.PI) : 0;   // son kısımda hafif taşma
  const ang = 180 * Math.min(1, p) + over;
  const rad = (ang * Math.PI) / 180, cos = Math.cos(rad);
  const speed = Math.abs(Math.cos(Math.min(1, p) * Math.PI - Math.PI / 2)); // ortada en hızlı
  const face: React.CSSProperties = { position: "absolute", inset: 0, overflow: "hidden", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
    borderRadius: 6, filter: speed > 0.35 ? `blur(${((speed - 0.35) * 3 * lift).toFixed(2)}px)` : undefined };
  const shade = (o: number) => <div style={{ position: "absolute", inset: 0, background: "#000", opacity: o }} />;
  const gloss = (x: number) => (
    <div style={{ position: "absolute", inset: 0, mixBlendMode: "screen", opacity: 0.55 * lift,
      background: `linear-gradient(105deg, rgba(255,255,255,0) ${x - 18}%, rgba(255,250,235,0.9) ${x}%, rgba(255,255,255,0) ${x + 18}%)` }} />
  );
  const thick = 6;
  return (
    <div style={{ position: "absolute", left: b.x * W - w / 2, top: b.y * H - h / 2, width: w, height: h }}>
      {/* masadaki gölge: dönmez; kalktıkça büyür, kayar ve yumuşar; kartın görünen genişliğiyle daralır */}
      <div style={{ position: "absolute", left: "50%", top: "50%", width: w * Math.max(0.08, Math.abs(cos)), height: h * 0.98,
        transform: `translate(-50%, -50%) translate(${18 + 40 * lift}px, ${22 + 60 * lift}px) scale(${1 + 0.1 * lift})`,
        background: "rgba(0,0,0,0.55)", filter: `blur(${6 + 30 * lift}px)`, opacity: 0.65 - 0.25 * lift, borderRadius: 8 }} />
      {/* filter 3B kapta kullanılmaz (preserve-3d düzleşir, yüzler kaybolur); dönüş bulanıklığı yüzlerde */}
      <div style={{ position: "absolute", inset: 0, perspective: 1400 }}>
        <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d",
          transform: `translateZ(${160 * lift}px) rotateX(${-6 * lift}deg) rotateY(${ang}deg)` }}>
          {/* kalınlık: arka arkaya kâğıt kenarı katmanları */}
          {Array.from({ length: thick }, (_, i) => (
            <div key={i} style={{ position: "absolute", inset: 1, borderRadius: 6, background: i % 2 ? "#E9E1CF" : "#D9CFB8",
              transform: `translateZ(${-(i + 1) * 1.1}px)` }} />
          ))}
          <div style={face}>
            <div style={{ position: "absolute", left: -(b.x * W - w / 2), top: -(b.y * H - h / 2), width: W, height: H }}>{front}</div>
            {shade(Math.max(0, 1 - Math.abs(cos)) * 0.55 * (cos > 0 ? 1 : 0))}
            {gloss(20 + 80 * Math.min(1, p))}
          </div>
          <div style={{ ...face, transform: `rotateY(180deg) translateZ(${(thick + 1) * 1.1}px)` /* döndürülmüş eksende +z = kartın arkası */, background: "#F4EFE4" }}>
            <div style={{ position: "absolute", left: w / 2 - W / 2, top: h / 2 - H / 2, width: W, height: H, transform: `scale(${inner})` }}>{back}</div>
            {shade(Math.max(0, 1 - Math.abs(cos)) * 0.55 * (cos < 0 ? 1 : 0))}
            {gloss(100 - 80 * Math.min(1, p))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Element deliğine kırpılmış içerik (çerçeve kenarı elementin kendisi)
const HoleFill: React.FC<{ b: Box; shape: TransOpts["shape"]; W: number; H: number; inner: number; opacity: number; children: React.ReactNode }> = ({ b, shape, W, H, inner, opacity, children }) => {
  const w = b.w * W, h = b.h * H;
  const cp = shape === "circle" ? "ellipse(50% 50% at 50% 50%)" : shape === "arch" ? "inset(0 round 50% 50% 3% 3% / 38% 38% 3% 3%)" : "inset(0)";
  return (
    <div style={{ position: "absolute", left: b.x * W - w / 2, top: b.y * H - h / 2, width: w, height: h, overflow: "hidden", clipPath: cp, opacity }}>
      <div style={{ position: "absolute", left: w / 2 - W / 2, top: h / 2 - H / 2, width: W, height: H, transform: `scale(${inner})` }}>{children}</div>
    </div>
  );
};

// Pullback çerçevesi: krem kenarlı, gölgeli baskı; içinde giden sahnenin son karesi
const FrameBox: React.FC<{ b: Box; W: number; H: number; inner: number; children: React.ReactNode }> = ({ b, W, H, inner, children }) => {
  const w = b.w * W, h = b.h * H, bw = Math.max(10, w * 0.035);
  return (
    <div style={{ position: "absolute", left: b.x * W - w / 2 - bw, top: b.y * H - h / 2 - bw, width: w + 2 * bw, height: h + 2 * bw, background: "#F6F1E4",
      boxShadow: "0 3px 4px rgba(0,0,0,0.35), 10px 22px 40px rgba(0,0,0,0.3)" }}>
      <div style={{ position: "absolute", left: bw, top: bw, width: w, height: h, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: w / 2 - W / 2, top: h / 2 - H / 2, width: W, height: H, transform: `scale(${Math.max(inner, w / W, h / H)})` }}>{children}</div>
      </div>
    </div>
  );
};

const RGB: React.FC<{ amount: number; punch: number; children: React.ReactNode }> = ({ amount, punch, children }) => {
  const ch = (m: string, dx: number) => (
    <AbsoluteFill style={{ transform: `translateX(${dx}px) scale(${punch})`, mixBlendMode: "screen", filter: `url(#rgb-${m})` }}>{children}</AbsoluteFill>
  );
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <svg width={0} height={0} style={{ position: "absolute" }}>
        <filter id="rgb-r"><feColorMatrix values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" /></filter>
        <filter id="rgb-g"><feColorMatrix values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" /></filter>
        <filter id="rgb-b"><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" /></filter>
      </svg>
      {ch("r", -amount)}{ch("g", 0)}{ch("b", amount)}
    </AbsoluteFill>
  );
};

// Işık sızması: ekran (screen) karışımıyla turuncu-kırmızı bant soldan sağa geçer, ortada hafif aşırı pozlama
const Leak: React.FC<{ p: number; color?: string }> = ({ p, color = "#FF7A2E" }) => {
  const peak = Math.sin(clamp01(p) * Math.PI), x = -40 + 180 * p;
  return (
    <AbsoluteFill style={{ mixBlendMode: "screen", pointerEvents: "none", opacity: 0.95 * peak,
      background: `radial-gradient(ellipse 60% 90% at ${x}% 45%, ${color} 0%, #D8322A88 35%, rgba(0,0,0,0) 70%)`, filter: `brightness(${1 + 0.4 * peak})` }} />
  );
};

// Baskı noktaları silmesi: merkezden büyüyen noktalar ekranı kaplar (p 0 → 1)
const Dots: React.FC<{ p: number; color: string; W: number; H: number }> = ({ p, color, W, H }) => {
  const g = 44, maxD = Math.hypot(W / 2, H / 2), cols = Math.ceil(W / g) + 1, rows = Math.ceil(H / g) + 1;
  const dots: React.ReactNode[] = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const x = i * g + (j % 2 ? g / 2 : 0), y = j * g, d = Math.hypot(x - W / 2, y - H / 2) / maxD;
    const r = clamp01((p * 1.6 - d) / 0.6) * g * 0.75;
    if (r > 0.3) dots.push(<circle key={`${i}-${j}`} cx={x} cy={y} r={r} />);
  }
  return <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }} fill={color}>{dots}</svg>;
};
