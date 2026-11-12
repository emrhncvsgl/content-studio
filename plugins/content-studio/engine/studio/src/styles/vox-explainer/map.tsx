import { spring } from "remotion";
import type { Word } from "../../schema/timeline";
import { EASE, clamp01, ease, lerpScale } from "../../components/ease";
import { INTER } from "../../fonts";
import { atMs } from "./index";

// vox E2 (kabartma harita) katmanları ve diğer EP006 eklemeleri. Hepsi ana tuvale (canvas) çizilir; doc koordinatı = DocMap (önceki doc
// görselinin 0-1'i → ekran). geo: { lon: [batı, doğu], lat: [güney, kuzey] } eşdikdörtgen kırpımın sınırları (NE kırpımları).
//   { type: "graticule", geo, step? (15), lon?: true, lat?: true, at, ms? (çizim, 900), stagger? (70 ms), color?, width?, highlight?: [boylam…],
//     hiColor?, flicker?: { at, amp (px), lines: "lon"|"lat" } (konum belirsizliği titremesi), pulseAt?, turn?: { at, everyMs, steps } (meridyenler
//     her adımda step° kayar: "Dünya saatte 15° döner") }
//   { type: "wedge", geo, lon: [a, b] (a'dan b'ye taranır), lat?: [g, k], at, ms? (1100), color?, opacity? (0.42), hatch?: true }
//   { type: "ship", x, y (doc 0-1) | path: [[u,v]…] + at + ms + ease? ("cubic": route ile eş; bend 0 rota), size? (px, 70), enterAt? (yukarıdan düşer), wake?: true,
//     sink?: { at, ms (1400) } (titreyerek batar), sway?: { amp (doc u), hz (0.6) } (doğu-batı belirsiz salınım), flip?,
//     image?: sağa bakan saydam PNG (+ size: [w,h] gerekmez; layer.size px yükseklik) → vektör gemi yerine bu çizilir (IYH001: dhow, kervan); wake: false karada,
//     rock?: { deg (2), hz (0.35), bob (px) } yavaş yalpa + kalkış (her zaman) · reflect?: { alpha (0.22), blur (3), squash (0.55) } su yansıması ·
//     shadow?: false (gölge yok: kum savrulması gibi) · opacity? (1) }
//   { type: "ruler", x, y (ekran, sol uç), u0, len (doc u cinsinden uzunluk → ekrandaki boy zoom'la değişir), label, at, segments? (4) }
//   { type: "dim", at, amount? (0.55), blur? (8), ms? (450) }: o ana kadar çizilen tuvali karartıp bulanıklaştırır; üstündeki katmanlar net
//   { type: "clock", x, y (ekran), r (px), start: {h, m}, to: {h, m}, at, ms? (1200), enterAt?, from?: giriş yönü, rot?, seed?, hand? (yelkovan rengi) }   kâğıt kadran
//   { type: "clouds", items: [{ element|image, size, x, y (ekran merkezi), w (ekran genişliği oranı), depth, blur?, opacity?, flip? }], at, ms,
//     grow? (2.4), ease? ("heavyOut"), tone? (CSS filter, ör. "brightness(0.55) saturate(0.35)"), shadow? (harita üstü bulut gölgesi, 0-1),
//     fade? (0.75: bu ilerlemeden sonra söner) }  gerçek bulut fotoğrafı (tools/cloud_key.py); görsel yoksa gürültü bulut yedeği
export type DocMap = { x: (u: number) => number; y: (v: number) => number; zoom: number };
type Layer = Record<string, any>;
type Geo = { lon: [number, number]; lat: [number, number] };
const gu = (g: Geo, lon: number) => (lon - g.lon[0]) / (g.lon[1] - g.lon[0]);
const gv = (g: Geo, lat: number) => (g.lat[1] - lat) / (g.lat[1] - g.lat[0]);
const rnd = (i: number) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

export function drawGraticule(ctx: CanvasRenderingContext2D, l: Layer, ms: number, words: Word[], dm: DocMap, accent: string) {
  const g = l.geo as Geo, step = (l.step as number) ?? 15, t0 = atMs(l.at ?? 0, words), dur = (l.ms as number) ?? 900, stag = (l.stagger as number) ?? 70;
  if (ms < t0) return;
  const hi = new Set(((l.highlight as number[]) ?? []).map(Number));
  const fl = l.flicker as { at?: unknown; amp?: number; lines?: string } | undefined;
  const flOn = fl ? ms >= atMs(fl.at ?? 0, words) : false;
  const p0 = l.pulseAt !== undefined ? atMs(l.pulseAt, words) : null;
  const pulse = p0 === null ? 0 : Math.max(0, Math.sin(Math.PI * clamp01((ms - p0) / 1100)));
  let shift = 0;
  const tr = l.turn as { at?: unknown; everyMs?: number; steps?: number } | undefined;
  if (tr) {
    const a = atMs(tr.at ?? 0, words), ev = tr.everyMs ?? 600, n = tr.steps ?? 3;
    for (let k = 0; k < n; k++) shift += step * EASE.heavyOut(clamp01((ms - a - k * ev) / (ev * 0.8)));
  }
  ctx.save();
  ctx.lineCap = "round";
  const line = (pts: [number, number][], i: number, isHi: boolean, jitter: number) => {
    const q = EASE.cubic(clamp01((ms - t0 - i * stag) / dur));
    if (q <= 0) return;
    ctx.beginPath();
    const n = Math.max(2, Math.ceil(pts.length * q));
    pts.slice(0, n).forEach(([x, y], k) => (k ? ctx.lineTo(x + jitter, y) : ctx.moveTo(x + jitter, y)));
    ctx.strokeStyle = isHi ? ((l.hiColor as string) ?? accent) : ((l.color as string) ?? "rgba(246,240,226,0.75)");
    ctx.lineWidth = ((l.width as number) ?? 3) * (isHi ? 2 : 1) * (1 + 0.6 * pulse * (isHi ? 1 : 0.4));
    ctx.shadowColor = isHi ? ((l.hiColor as string) ?? accent) : "rgba(0,0,0,0.35)";
    ctx.shadowBlur = isHi ? 10 + 30 * pulse : 3;
    ctx.stroke();
  };
  let i = 0;
  if (l.lat !== false) {
    const a = Math.ceil(g.lat[0] / step) * step;
    for (let la = a; la <= g.lat[1]; la += step, i++) {
      const pts: [number, number][] = Array.from({ length: 24 }, (_, k) => [dm.x(k / 23), dm.y(gv(g, la))]);
      const j = flOn && fl?.lines === "lat" ? ((rnd(Math.floor(ms / 66) + i) - 0.5) * 2 * (fl.amp ?? 6)) : 0;
      line(pts, i, hi.has(la) && l.hiLat === true, j);
    }
  }
  if (l.lon !== false) {
    const a = Math.ceil((g.lon[0] - 360) / step) * step;
    for (let lo = a; lo <= g.lon[1] + 360; lo += step) {
      const x = lo + shift;
      if (x < g.lon[0] - 0.01 || x > g.lon[1] + 0.01) continue;
      const pts: [number, number][] = Array.from({ length: 24 }, (_, k) => [dm.x(gu(g, x)), dm.y(k / 23)]);
      const j = flOn && (fl?.lines ?? "lon") === "lon" ? ((rnd(Math.floor(ms / 66) * 3.1 + lo) - 0.5) * 2 * (fl?.amp ?? 6)) : 0;
      line(pts, i++, hi.has(((Math.round(x) % 360) + 540) % 360 - 180), j);
    }
  }
  ctx.restore();
}

export function drawWedge(ctx: CanvasRenderingContext2D, l: Layer, ms: number, words: Word[], dm: DocMap, accent: string) {
  const g = l.geo as Geo, t0 = atMs(l.at ?? 0, words), q = EASE.heavyOut(clamp01((ms - t0) / ((l.ms as number) ?? 1100)));
  if (q <= 0) return;
  const [a, b] = l.lon as [number, number], lat = (l.lat as [number, number]) ?? g.lat;
  const lo = a + (b - a) * q;
  const x0 = dm.x(gu(g, a)), x1 = dm.x(gu(g, lo)), y0 = dm.y(gv(g, lat[1])), y1 = dm.y(gv(g, lat[0]));
  const color = (l.color as string) ?? accent;
  ctx.save();
  ctx.globalAlpha *= (l.opacity as number) ?? 0.42;
  ctx.fillStyle = color;
  ctx.fillRect(Math.min(x0, x1), y0, Math.abs(x1 - x0), y1 - y0);
  ctx.restore();
  ctx.save();
  ctx.beginPath(); ctx.rect(Math.min(x0, x1), y0, Math.abs(x1 - x0), y1 - y0); ctx.clip();
  if (l.hatch !== false) { // elle taranmış çizgiler (45°)
    ctx.strokeStyle = color; ctx.globalAlpha *= 0.55; ctx.lineWidth = 3;
    for (let x = Math.min(x0, x1) - (y1 - y0); x < Math.max(x0, x1); x += 26) { ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x + (y1 - y0), y0); ctx.stroke(); }
  }
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 6; ctx.shadowColor = color; ctx.shadowBlur = 14;
  for (const x of [x0, x1]) { ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke(); }
  ctx.restore();
}

// Üç direkli gemi silueti (mürekkep gövde, krem yelken), merkez orijinde, pruva +x yönünde, boy s
function shipShape(ctx: CanvasRenderingContext2D, s: number) {
  const k = s / 100;
  ctx.save(); ctx.scale(k, k);
  ctx.lineJoin = "round";
  // gövde
  ctx.fillStyle = "#1E1A16";
  ctx.beginPath(); ctx.moveTo(-50, 8); ctx.lineTo(48, 8); ctx.quadraticCurveTo(44, 26, 30, 30); ctx.lineTo(-40, 30); ctx.quadraticCurveTo(-50, 22, -50, 8); ctx.fill();
  ctx.fillStyle = "#B8322A"; ctx.fillRect(-46, 12, 90, 4);
  // direkler + yelkenler
  for (const [mx, hgt] of [[-26, 56], [2, 70], [28, 52]] as const) {
    ctx.strokeStyle = "#1E1A16"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(mx, 8); ctx.lineTo(mx, 8 - hgt); ctx.stroke();
    for (let r = 0; r < 3; r++) {
      const top = 8 - hgt + 4 + r * (hgt / 3.2), h = hgt / 3.6, w = 30 - r * 2 - (mx === 2 ? 0 : 4);
      ctx.fillStyle = "#F4EFE4"; ctx.strokeStyle = "#1E1A16"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(mx - w / 2, top); ctx.lineTo(mx + w / 2, top); ctx.quadraticCurveTo(mx + w / 2 + 3, top + h / 2, mx + w / 2 - 1, top + h);
      ctx.lineTo(mx - w / 2 + 1, top + h); ctx.quadraticCurveTo(mx - w / 2 - 3, top + h / 2, mx - w / 2, top); ctx.fill(); ctx.stroke();
    }
  }
  // flok yelkeni + bayrak
  ctx.fillStyle = "#F4EFE4"; ctx.beginPath(); ctx.moveTo(30, -40); ctx.lineTo(62, 6); ctx.lineTo(32, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#B8322A"; ctx.beginPath(); ctx.moveTo(2, -62); ctx.lineTo(16, -58); ctx.lineTo(2, -54); ctx.fill();
  ctx.restore();
}
function pathAt(P: [number, number][], q: number) {
  const seg = P.slice(1).map((p, i) => Math.hypot(p[0] - P[i][0], p[1] - P[i][1])), tot = seg.reduce((s, x) => s + x, 0) || 1;
  let d = tot * q;
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i] || i === seg.length - 1) { const r = clamp01(d / (seg[i] || 1)); return { x: P[i][0] + (P[i + 1][0] - P[i][0]) * r, y: P[i][1] + (P[i + 1][1] - P[i][1]) * r, a: Math.atan2(P[i + 1][1] - P[i][1], P[i + 1][0] - P[i][0]) }; }
    d -= seg[i];
  }
  return { x: P[0][0], y: P[0][1], a: 0 };
}
export function drawShip(ctx: CanvasRenderingContext2D, l: Layer, ms: number, fps: number, words: Word[], dm: DocMap, sh: { x: number; y: number }, stepId: number, im?: HTMLImageElement) {
  const size = (l.size as number) ?? 70;
  let x: number, y: number, dir = l.flip ? -1 : 1, moving = false;
  if (Array.isArray(l.path)) {
    const P = (l.path as [number, number][]).map(([u, v]) => [dm.x(u), dm.y(v)] as [number, number]);
    const t0 = atMs(l.at ?? 0, words), q = ease(l.ease, "cubic")(clamp01((ms - t0) / ((l.ms as number) ?? 3000))); // route ile aynı eğri (cubic)
    const p = pathAt(P, q);
    x = p.x; y = p.y; dir = Math.cos(p.a) >= 0 ? 1 : -1; moving = q > 0 && q < 1;
    if (l.wake !== false && q > 0) { // iz: geçilen yol boyunca incelen beyaz şerit + kıç arkasında açılan üçgen
      const n = 40;
      ctx.save(); ctx.lineCap = "round";
      for (let k = n; k >= 1; k--) {
        const a = pathAt(P, Math.max(0, q - (k / n) * 0.35)), b = pathAt(P, Math.max(0, q - ((k - 1) / n) * 0.35));
        ctx.strokeStyle = `rgba(250,250,245,${(0.75 * (1 - k / n)).toFixed(3)})`; ctx.lineWidth = size * 0.16 * (1 - k / n) + 2;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      ctx.restore();
    }
  } else {
    x = dm.x(l.x as number); y = dm.y(l.y as number);
    const sw = l.sway as { amp?: number; hz?: number } | undefined;
    if (sw) { x = dm.x((l.x as number) + (sw.amp ?? 0.02) * Math.sin((ms / 1000) * 2 * Math.PI * (sw.hz ?? 0.6))); moving = true; }
  }
  // giriş: yukarıdan düşer (backOut)
  let a = 1, dy = 0, rot = 0;
  if (l.enterAt !== undefined) {
    const sf = Math.round((atMs(l.enterAt, words) / 1000) * fps), fNow = Math.round((ms / 1000) * fps);
    if (fNow < sf) return;
    const s = spring({ frame: fNow - sf, fps, config: { damping: 11, stiffness: 120, mass: 0.8 } });
    dy = -(1 - s) * 140; a = Math.min(1, s * 2);
  }
  const sk = l.sink as { at?: unknown; ms?: number } | undefined;
  if (sk) { // batış: önce yana yatar, sonra titreyerek aşağı kayar ve söner (stop-motion)
    const q = clamp01((ms - atMs(sk.at ?? 0, words)) / (sk.ms ?? 1400));
    if (q >= 1) return;
    if (q > 0) {
      rot = dir * 0.5 * EASE.cubic(clamp01(q / 0.5));
      dy += size * 0.6 * Math.pow(clamp01((q - 0.25) / 0.75), 1.6);
      x += (rnd(stepId * 1.7 + (l.seed ?? 1)) - 0.5) * 6 * q; dy += (rnd(stepId * 2.9 + (l.seed ?? 1)) - 0.5) * 5 * q;
      a *= 1 - EASE.cubic(clamp01((q - 0.45) / 0.55));
    }
  }
  // rock: { deg, hz, bob (px) }: hareketten bağımsız yavaş yalpa + dikey kalkış (dalgada gemi, yürüyen kervan); yoksa yalnız hareket ederken 1.3 Hz
  const rk = l.rock as { deg?: number; hz?: number; bob?: number } | undefined;
  const tS = ms / 1000;
  const bob = rk ? Math.sin(tS * 2 * Math.PI * (rk.hz ?? 0.35)) * (((rk.deg ?? 2) * Math.PI) / 180) : moving ? Math.sin(tS * 2 * Math.PI * 1.3) * 0.05 : 0;
  const lift = rk?.bob ? Math.sin(tS * 2 * Math.PI * (rk.hz ?? 0.35) * 2 + 1.1) * rk.bob : 0;
  ctx.save();
  ctx.globalAlpha *= a * ((l.opacity as number) ?? 1);
  ctx.translate(x, y + dy + lift);
  const rf = l.reflect as { alpha?: number; blur?: number; squash?: number } | undefined;
  if (rf && im) { // su yansıması: aynalanmış, basık, bulanık, düşük opaklık (yalpayı ters izler)
    const w = size * (im.width / im.height), sq = rf.squash ?? 0.55;
    ctx.save(); ctx.rotate(-(rot + bob)); ctx.scale(dir, -sq); ctx.translate(0, -size * 0.2);
    ctx.globalAlpha *= rf.alpha ?? 0.22; ctx.filter = `blur(${rf.blur ?? 3}px)`;
    ctx.drawImage(im, -w / 2, size * 0.3 - size, w, size); ctx.restore();
  }
  ctx.rotate(rot + bob);
  ctx.scale(dir, 1);
  if (l.shadow !== false) {
    ctx.save(); // gölge: haritaya düşen yumuşak leke
    ctx.filter = "blur(5px)"; ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath(); ctx.ellipse(sh.x * 8, size * 0.32 + sh.y * 6, size * 0.48, size * 0.07, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.translate(0, -size * 0.2);
  if (l.shadow !== false) ctx.filter = `drop-shadow(${(sh.x * 4).toFixed(1)}px ${(sh.y * 4).toFixed(1)}px 3px rgba(0,0,0,0.4))`;
  if (im) { const w = size * (im.width / im.height); ctx.drawImage(im, -w / 2, size * 0.3 - size, w, size); } // image: sağa bakan kesik (dhow, kervan); size = yükseklik px
  else shipShape(ctx, size);
  ctx.restore();
}

export function drawRuler(ctx: CanvasRenderingContext2D, l: Layer, ms: number, words: Word[], dm: DocMap, W: number, H: number) {
  const t0 = atMs(l.at ?? 0, words), q = EASE.heavyOut(clamp01((ms - t0) / 700));
  if (q <= 0) return;
  const len = Math.abs(dm.x((l.u0 as number ?? 0) + (l.len as number)) - dm.x((l.u0 as number) ?? 0)) * q;
  const n = (l.segments as number) ?? 4, x = (l.x as number) * W, y = (l.y as number) * H, h = 14;
  ctx.save();
  ctx.filter = "drop-shadow(2px 3px 4px rgba(0,0,0,0.45))";
  for (let k = 0; k < n; k++) { ctx.fillStyle = k % 2 ? "#F6F0E2" : "#14213D"; ctx.fillRect(x + (len / n) * k, y, len / n, h); }
  ctx.filter = "none";
  ctx.strokeStyle = "#F6F0E2"; ctx.lineWidth = 2; ctx.strokeRect(x, y, len, h);
  ctx.fillStyle = "#F6F0E2"; ctx.font = `800 30px ${INTER}`; ctx.textBaseline = "bottom";
  ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = 6;
  ctx.globalAlpha *= clamp01((q - 0.5) * 2);
  ctx.fillText("0", x - 8, y - 6);
  const lab = String(l.label ?? ""), tw = ctx.measureText(lab).width;
  ctx.fillText(lab, x + len - tw / 2, y - 6);
  ctx.restore();
}

// Karartma: o ana kadar çizilen tuvali bulanıklaştırıp karartır (stat kutusu DOM'da, üstte net)
export function drawDim(ctx: CanvasRenderingContext2D, l: Layer, ms: number, words: Word[], W: number, H: number, scratch: CanvasRenderingContext2D) {
  const q = EASE.cubic(clamp01((ms - atMs(l.at ?? 0, words)) / ((l.ms as number) ?? 450)));
  if (q <= 0) return;
  scratch.drawImage(ctx.canvas, 0, 0);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.filter = `blur(${(((l.blur as number) ?? 8) * q).toFixed(1)}px) brightness(${(1 - ((l.amount as number) ?? 0.55) * q).toFixed(3)})`;
  ctx.drawImage(scratch.canvas, 0, 0, W, H);
  ctx.restore();
}

// Kâğıt saat kadranı: krem disk, pürüzlü kenar, 12 çentik, mürekkep ibreler (heavyOut ile hedef saate döner)
export function drawClock(ctx: CanvasRenderingContext2D, l: Layer, ms: number, fps: number, words: Word[], W: number, H: number,
  sh: { x: number; y: number }, entry: (from: unknown, s: number, W: number, H: number, seed: number) => { dx: number; dy: number; rot: number } | null) {
  const f = Math.round((ms / 1000) * fps), sf = Math.round((atMs(l.enterAt ?? 0, words) / 1000) * fps);
  if (f < sf) return;
  const s = spring({ frame: f - sf, fps, config: { damping: 12, stiffness: 70, mass: 1.1 } });
  const e = entry(l.from, s, W, H, (l.seed as number) ?? 3);
  const r = (l.r as number) ?? 150, seed = (l.seed as number) ?? 3;
  const A = (l.start as { h: number; m: number }) ?? { h: 12, m: 0 }, B = (l.to as { h: number; m: number }) ?? A;
  const q = EASE.heavyOut(clamp01((ms - atMs(l.at ?? 0, words)) / ((l.ms as number) ?? 1200)));
  const tot = (A.h * 60 + A.m) + ((B.h * 60 + B.m) - (A.h * 60 + A.m)) * q;
  ctx.save();
  ctx.translate((l.x as number) * W + (e?.dx ?? 0), (l.y as number) * H + (e?.dy ?? 0));
  ctx.rotate((((l.rot as number) ?? 0) + (e?.rot ?? 0)) * Math.PI / 180);
  ctx.save();
  ctx.filter = `drop-shadow(${(sh.x * 14).toFixed(1)}px ${(sh.y * 14).toFixed(1)}px 12px rgba(0,0,0,0.38))`;
  ctx.beginPath();
  for (let k = 0; k <= 120; k++) { const a = (k / 120) * Math.PI * 2, rr = r * (1 + 0.012 * Math.sin(a * 7 + seed) + 0.008 * Math.sin(a * 23 + seed * 2)); k ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.closePath(); ctx.fillStyle = (l.face as string) ?? "#F4EFE4"; ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "#1E1A16";
  ctx.lineWidth = r * 0.03; ctx.beginPath(); ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2); ctx.stroke();
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2, big = k % 3 === 0;
    ctx.lineWidth = big ? r * 0.05 : r * 0.025;
    ctx.beginPath(); ctx.moveTo(Math.sin(a) * r * (big ? 0.66 : 0.74), -Math.cos(a) * r * (big ? 0.66 : 0.74)); ctx.lineTo(Math.sin(a) * r * 0.84, -Math.cos(a) * r * 0.84); ctx.stroke();
  }
  const hand = (ang: number, len: number, wdt: number, col: string) => {
    ctx.save(); ctx.rotate(ang); ctx.strokeStyle = col; ctx.lineWidth = wdt; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(0, len * 0.15); ctx.lineTo(0, -len); ctx.stroke(); ctx.restore();
  };
  hand(((tot / 60) % 12) / 12 * Math.PI * 2, r * 0.5, r * 0.07, "#1E1A16");
  hand(((tot % 60) / 60) * Math.PI * 2, r * 0.75, r * 0.045, (l.hand as string) ?? "#B8322A");
  ctx.fillStyle = "#1E1A16"; ctx.beginPath(); ctx.arc(0, 0, r * 0.06, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// Bulut dalışı: her bulut ekran merkezinden kendi derinliğiyle büyür (S = grow^(p·depth²)) → ön bulut en hızlı büyüyüp kenara açılır.
export function drawClouds(ctx: CanvasRenderingContext2D, l: Layer, ms: number, words: Word[], W: number, H: number, imgs: Record<string, HTMLImageElement>,
  sh: { x: number; y: number }) {
  const t0 = atMs(l.at ?? 0, words), p = ease(l.ease, "heavyOut")(clamp01((ms - t0) / ((l.ms as number) ?? 2200)));
  const G = (l.grow as number) ?? 2.4, fadeFrom = (l.fade as number) ?? 0.75;
  const items = (l.items as Layer[]) ?? [];
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const place = (it: Layer) => {
    const d = (it.depth as number) ?? 1, S = lerpScale(1, Math.pow(G, d * d), p);
    const drift = (it.drift as number ?? 0.01) * (ms / 1000);
    const cx = W / 2 + ((it.x as number) + drift - 0.5) * W * S, cy = H * 0.45 + ((it.y as number) - 0.45) * H * S;
    const im = it.image ? imgs[it.image as string] : undefined;
    const w = (it.w as number) * W * S, h = im ? w * (im.height / im.width) : w * 0.5;
    const op = ((it.opacity as number) ?? 1) * (1 - EASE.cubic(clamp01((p - fadeFrom * (2 - d)) / Math.max(0.05, 1 - fadeFrom * (2 - d)))));
    return { cx, cy, w, h, im, op, d };
  };
  if (l.shadow) { // harita üstüne düşen bulut gölgesi (multiply), en uzak bulutlarla
    for (const it of items) {
      const c = place(it);
      if (!c.im || c.op <= 0.01) continue;
      ctx.save();
      ctx.globalCompositeOperation = "multiply"; ctx.globalAlpha = (l.shadow as number) * c.op;
      ctx.filter = "brightness(0) blur(24px)";
      ctx.drawImage(c.im, c.cx - c.w / 2 + sh.x * 60 * c.d, c.cy - c.h / 2 + sh.y * 90 * c.d, c.w, c.h);
      ctx.restore();
    }
  }
  for (const it of [...items].sort((a, b) => ((a.depth as number) ?? 1) - ((b.depth as number) ?? 1))) {
    const c = place(it);
    if (c.op <= 0.01) continue;
    ctx.save();
    ctx.globalAlpha = c.op;
    const blur = (it.blur as number) ?? Math.max(0, (c.d - 0.9) * 22);
    ctx.filter = `${(l.tone as string) ?? ""} ${blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : ""}`.trim() || "none";
    if (c.im) {
      ctx.translate(c.cx, c.cy); if (it.flip) ctx.scale(-1, 1);
      ctx.drawImage(c.im, -c.w / 2, -c.h / 2, c.w, c.h);
    } else { // yedek: yumuşak radyal lekelerden gürültü bulut
      for (let k = 0; k < 14; k++) {
        const rx = c.cx + (rnd(k * 3.1 + c.d) - 0.5) * c.w * 0.8, ry = c.cy + (rnd(k * 5.7 + c.d) - 0.5) * c.h * 0.6, rr = c.w * (0.12 + 0.12 * rnd(k * 1.3));
        const g = ctx.createRadialGradient(rx, ry, 0, rx, ry, rr);
        g.addColorStop(0, "rgba(235,238,242,0.55)"); g.addColorStop(1, "rgba(235,238,242,0)");
        ctx.fillStyle = g; ctx.fillRect(rx - rr, ry - rr, 2 * rr, 2 * rr);
      }
    }
    ctx.restore();
  }
  ctx.restore();
}
