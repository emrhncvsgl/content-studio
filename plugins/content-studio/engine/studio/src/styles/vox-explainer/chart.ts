import type { Word } from "../../schema/timeline";
import { EASE, clamp01 } from "../../components/ease";
import { MONO } from "../../fonts";

// vox ek katmanları (EP010, 2026-11-10): kadran + "tarif F" (ikon çubuk, şematik eğri) + nesne hareketi (keys / spin / shrink).
// Hepsi isteğe bağlı; bu alanları kullanmayan sahnelerde hiçbir şey değişmez. Yazı yok: yalnız rakam ve ikon (lang_neutral).
//   { type: "dial", x, y, r (kare yüksekliği oranı), min, max, value, to?, at?, ms?, marks?: [v…], markLabel?, valueLabel?,
//     faceImage?, needleImage? }                       kâğıt kadran, 270° yay; ibre `at` anında value → to (hafif taşar)
//   { type: "iconBar", image, size, x, y, value, per, group?, scale, iconH, at, stepMs, label?, sub?, labelAt?, approx? }
//       value / per ikon, toplam uzunluk value × scale × W (iki çubuk aynı scale → gerçek oran); ikonlar sırayla konur
//   { type: "chartBaseline", x, y, w }
//   { type: "chartAxes", x, y, w, h, vmin, vmax, lines: [{ v, label }] }     sonraki chart* katmanları bu alanı kullanır (t 0-1, v değer)
//   { type: "chartDot", t, v, label, at, pin? }        kaynaklı değer: dolu iğne nokta + rakam
//   { type: "chartCurve", points: [[t, v]…], dashed?, approx?, at, ms | untilAt }   kesik kurşun kalem çizgisi (şematik), hafif kaynar
//   { type: "chartBand", above, t0, t1, points?, hatch?, at, ms }             çizginin üstünde kalan alan taranır (points verilirse eğrinin altı)
//   { type: "chartBracket", t0, t1, v | t, v0, v1, label, image?, at }        köşeli ayraç + rakam (+ ikon)
//   cutout / print / piece: keys: [{ at, x, y, rot?, ms? }] · spin: { rpm, untilAt? } · shrink: { to, at, ms } · opacity
type Layer = Record<string, any>;
type At = (at: unknown, words: Word[]) => number;
type Ctx = CanvasRenderingContext2D;
const rnd = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const INK = "#2B2A28", PAPER = "#EFE6D2", RED = "#C8372D";
const font = (px: number, w = 500) => `${w} ${Math.round(px)}px ${MONO}`;

// ---- nesne hareketi: katman dönüşümü (çizimden önce ctx'e uygulanır). Zaman basamaklı (stop-motion) gelir.
export function layerMotion(ctx: Ctx, l: Layer, ms: number, words: Word[], W: number, H: number, atMs: At) {
  if (l.opacity !== undefined) ctx.globalAlpha *= l.opacity as number;
  if (!l.keys && !l.spin && !l.shrink) return;
  let x = l.x as number, y = l.y as number, rot = (l.rot as number) ?? 0;
  const x0 = x, y0 = y, r0 = rot;
  for (const k of ((l.keys as Layer[] | undefined) ?? [])) {
    const p = EASE.heavyOut(clamp01((ms - atMs(k.at ?? 0, words)) / ((k.ms as number) ?? 600)));
    if (p <= 0) break;
    x += ((k.x ?? x) - x) * p; y += ((k.y ?? y) - y) * p; rot += ((k.rot ?? rot) - rot) * p;
  }
  if (l.spin) {
    const s = l.spin as { rpm?: number; untilAt?: unknown };
    const t = Math.max(0, s.untilAt !== undefined ? Math.min(ms, atMs(s.untilAt, words)) : ms) / 1000;
    rot += (s.rpm ?? 6) * 6 * t;
  }
  ctx.translate((x - x0) * W, (y - y0) * H);
  const cx = x0 * W, cy = y0 * H;
  let sc = 1;
  if (l.shrink) { const s = l.shrink as { to?: number; at?: unknown; ms?: number }; sc = 1 + ((s.to ?? 0.5) - 1) * EASE.cubic(clamp01((ms - atMs(s.at ?? 0, words)) / (s.ms ?? 2000))); }
  if (rot !== r0 || sc !== 1) { ctx.translate(cx, cy); ctx.rotate(((rot - r0) * Math.PI) / 180); ctx.scale(sc, sc); ctx.translate(-cx, -cy); }
}

// ---- kadran
export function drawDial(ctx: Ctx, l: Layer, ms: number, words: Word[], W: number, H: number, imgs: Record<string, HTMLImageElement>, atMs: At) {
  const cx = l.x * W, cy = l.y * H, R = l.r * H, min = (l.min as number) ?? 0, max = (l.max as number) ?? 20, s = W / 1920;
  let v = l.value as number;
  if (l.to !== undefined) v += ((l.to as number) - v) * EASE.backOut(clamp01((ms - atMs(l.at ?? 0, words)) / ((l.ms as number) ?? 1600)));
  const ang = (x: number) => ((135 + ((Math.max(min, Math.min(max, x)) - min) / (max - min)) * 270) * Math.PI) / 180;
  ctx.save();
  ctx.translate(cx, cy);
  const face = l.faceImage ? imgs[l.faceImage as string] : undefined;
  ctx.filter = "drop-shadow(6px 14px 16px rgba(0,0,0,0.42))";
  if (face) ctx.drawImage(face, -R, -R, 2 * R, 2 * R);
  else {
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(0, 0, R, 0, 2 * Math.PI); ctx.fill();
    ctx.filter = "none";
    ctx.fillStyle = PAPER; ctx.beginPath(); ctx.arc(0, 0, R * 0.9, 0, 2 * Math.PI); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineCap = "butt";
    const step = (max - min) / 20, major = (max - min) / 4;
    for (let x = min; x <= max + 1e-6; x += step) {
      const big = Math.abs(x / major - Math.round(x / major)) < 1e-6, a = ang(x);
      ctx.lineWidth = (big ? 5 : 2.5) * s;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * R * 0.84, Math.sin(a) * R * 0.84); ctx.lineTo(Math.cos(a) * R * (big ? 0.7 : 0.76), Math.sin(a) * R * (big ? 0.7 : 0.76)); ctx.stroke();
      if (big) {
        ctx.fillStyle = INK; ctx.font = font(R * 0.13); ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(String(Math.round(x)), Math.cos(a) * R * 0.56, Math.sin(a) * R * 0.56);
      }
    }
  }
  ctx.filter = "none";
  for (const m of ((l.marks as number[] | undefined) ?? [])) {   // boyalı sınır işareti
    const a = ang(m);
    ctx.strokeStyle = RED; ctx.lineWidth = 11 * s; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * R * 0.88, Math.sin(a) * R * 0.88); ctx.lineTo(Math.cos(a) * R * 0.66, Math.sin(a) * R * 0.66); ctx.stroke();
    if (l.markLabel) {
      ctx.fillStyle = RED; ctx.font = font(R * 0.12, 500); ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(String(m), Math.cos(a) * R * 1.13, Math.sin(a) * R * 1.13);
    }
  }
  const a = ang(v);
  ctx.filter = "drop-shadow(2px 4px 3px rgba(0,0,0,0.35))";
  ctx.strokeStyle = INK; ctx.lineWidth = 7 * s; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-Math.cos(a) * R * 0.14, -Math.sin(a) * R * 0.14); ctx.lineTo(Math.cos(a) * R * 0.78, Math.sin(a) * R * 0.78); ctx.stroke();
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(0, 0, R * 0.07, 0, 2 * Math.PI); ctx.fill();
  ctx.filter = "none";
  if (l.valueLabel) {   // konsol görünümü: altında rakam kutusu
    const bw = R * 0.62, bh = R * 0.24;
    ctx.fillStyle = PAPER; ctx.strokeStyle = INK; ctx.lineWidth = 3 * s;
    ctx.beginPath(); ctx.rect(-bw / 2, R * 0.36, bw, bh); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.font = font(bh * 0.72); ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(v.toFixed(1), 0, R * 0.36 + bh / 2 + 1);
  }
  ctx.restore();
}

// ---- ikon çubuk
export function drawIconBar(ctx: Ctx, l: Layer, im: HTMLImageElement | undefined, ms: number, words: Word[], W: number, H: number, atMs: At) {
  if (!im) return;
  const t0 = atMs(l.at ?? 0, words), n = Math.max(1, Math.round((l.value as number) / (l.per as number))), len = (l.value as number) * (l.scale as number) * W;
  const [iw, ih] = l.size as [number, number], h = ((l.iconH as number) ?? 0.1) * H, w0 = h * (iw / ih), pitch = len / n, w = Math.min(w0, pitch * 0.92), hh = w * (ih / iw);
  const x0 = l.x * W, y = l.y * H, stepMs = (l.stepMs as number) ?? 200, g = (l.group as number) ?? 0;
  ctx.save();
  ctx.filter = "drop-shadow(3px 6px 5px rgba(0,0,0,0.3))";
  for (let i = 0; i < n; i++) {
    const p = clamp01((ms - t0 - i * stepMs) / 160);
    if (p <= 0) break;
    const k = EASE.backOut(p), gx = g ? Math.floor(i / g) * pitch * 0.0 : 0;
    ctx.save();
    ctx.translate(x0 + gx + pitch * (i + 0.5), y - hh / 2 + (1 - k) * -18);
    ctx.rotate(((rnd(i * 3.1 + 7) - 0.5) * 7 * Math.PI) / 180);
    ctx.globalAlpha *= Math.min(1, p * 2);
    ctx.drawImage(im, -w / 2, -hh / 2, w, hh);
    ctx.restore();
  }
  ctx.filter = "none";
  if (l.label !== undefined) {
    const p = clamp01((ms - atMs(l.labelAt ?? l.at ?? 0, words)) / 300);
    if (p > 0) {
      const s = W / 1920;
      ctx.globalAlpha *= p; ctx.fillStyle = INK; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.font = font(64 * s);
      const txt = `${l.approx ? "≈ " : ""}${l.label}`;
      ctx.fillText(txt, x0 + len + 26 * s, y - hh / 2);
      if (l.sub) { ctx.font = font(30 * s, 400); ctx.fillText(String(l.sub), x0 + len + 26 * s, y - hh / 2 + 52 * s); }
    }
  }
  ctx.restore();
}
export function drawChartBaseline(ctx: Ctx, l: Layer, W: number, H: number) {
  ctx.save(); ctx.strokeStyle = INK; ctx.lineWidth = 5 * (W / 1920); ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(l.x * W, l.y * H); ctx.lineTo((l.x + l.w) * W, l.y * H); ctx.stroke(); ctx.restore();
}

// ---- şematik grafik (tarif F): chartAxes alanı kurar, sonrakiler kullanır (çizim eşzamanlı olduğu için modül değişkeni güvenli)
let CH = { x: 0, y: 0, w: 1, h: 1, vmin: 0, vmax: 1 };
const px = (t: number) => CH.x + t * CH.w, py = (v: number) => CH.y + CH.h - ((v - CH.vmin) / (CH.vmax - CH.vmin)) * CH.h;
export function drawChartAxes(ctx: Ctx, l: Layer, W: number, H: number) {
  CH = { x: l.x * W, y: l.y * H, w: l.w * W, h: l.h * H, vmin: (l.vmin as number) ?? 0, vmax: (l.vmax as number) ?? 1 };
  const s = W / 1920;
  ctx.save();
  ctx.strokeStyle = INK; ctx.lineWidth = 5 * s; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath(); ctx.moveTo(CH.x, CH.y); ctx.lineTo(CH.x, CH.y + CH.h); ctx.lineTo(CH.x + CH.w, CH.y + CH.h); ctx.stroke();
  for (const ln of ((l.lines as { v: number; label?: string }[] | undefined) ?? [])) {
    ctx.strokeStyle = RED; ctx.lineWidth = 3 * s; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(CH.x, py(ln.v)); ctx.lineTo(CH.x + CH.w, py(ln.v)); ctx.stroke();
    if (ln.label) { ctx.fillStyle = RED; ctx.font = font(34 * s); ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(ln.label, CH.x - 16 * s, py(ln.v)); }
  }
  ctx.restore();
}
export function drawChartDot(ctx: Ctx, l: Layer, ms: number, words: Word[], W: number, atMs: At) {
  const p = clamp01((ms - atMs(l.at ?? 0, words)) / 260);
  if (p <= 0) return;
  const s = W / 1920, k = EASE.backOut(p), x = px(l.t), y = py(l.v);
  ctx.save();
  ctx.filter = "drop-shadow(3px 6px 4px rgba(0,0,0,0.35))";
  ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(x, y, 15 * s * k, 0, 2 * Math.PI); ctx.fill();
  ctx.filter = "none";
  ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.beginPath(); ctx.arc(x - 4 * s, y - 5 * s, 4 * s * k, 0, 2 * Math.PI); ctx.fill();
  if (l.label !== undefined) { ctx.globalAlpha *= p; ctx.fillStyle = INK; ctx.font = font(46 * s); ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(String(l.label), x + 28 * s, y - 4 * s); }
  ctx.restore();
}
function curvePts(P: [number, number][], n = 20): [number, number][] {   // Catmull-Rom, ekran koordinatı
  const q = P.map(([t, v]) => [px(t), py(v)] as [number, number]), out: [number, number][] = [];
  for (let i = 0; i + 1 < q.length; i++) {
    const a = q[Math.max(0, i - 1)], b = q[i], c = q[i + 1], d = q[Math.min(q.length - 1, i + 2)];
    for (let k = i ? 1 : 0; k <= n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0.5 * (2 * b[0] + (c[0] - a[0]) * t + (2 * a[0] - 5 * b[0] + 4 * c[0] - d[0]) * t2 + (3 * b[0] - a[0] - 3 * c[0] + d[0]) * t3),
        0.5 * (2 * b[1] + (c[1] - a[1]) * t + (2 * a[1] - 5 * b[1] + 4 * c[1] - d[1]) * t2 + (3 * b[1] - a[1] - 3 * c[1] + d[1]) * t3)]);
    }
  }
  return out;
}
export function drawChartCurve(ctx: Ctx, l: Layer, ms: number, words: Word[], W: number, atMs: At) {
  const t0 = atMs(l.at ?? 0, words), dur = l.untilAt !== undefined ? Math.max(200, atMs(l.untilAt, words) - t0) : ((l.ms as number) ?? 1500);
  const p = clamp01((ms - t0) / dur);
  if (p <= 0) return;
  const s = W / 1920, step = Math.floor(ms / 166), pts = curvePts(l.points as [number, number][]), n = Math.max(2, Math.ceil(pts.length * p));
  ctx.save();
  ctx.strokeStyle = "#3A3936"; ctx.lineWidth = 6 * s; ctx.lineCap = "round"; ctx.lineJoin = "round";
  if (l.dashed !== false) ctx.setLineDash([20 * s, 15 * s]);
  ctx.beginPath();
  for (let i = 0; i < n; i++) {   // elle çizilmiş: her basamakta ±1.2 px kaynar
    const x = pts[i][0] + (rnd(step * 3.7 + i * 0.61) - 0.5) * 2.4 * s, y = pts[i][1] + (rnd(step * 5.3 + i * 0.83) - 0.5) * 2.4 * s;
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.stroke();
  if (l.approx) { ctx.setLineDash([]); ctx.fillStyle = "#3A3936"; ctx.font = font(54 * s); ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText("≈", pts[0][0] - 14 * s, pts[0][1] - 30 * s); }
  ctx.restore();
}
export function drawChartBand(ctx: Ctx, l: Layer, ms: number, words: Word[], W: number, atMs: At) {
  const p = EASE.cubic(clamp01((ms - atMs(l.at ?? 0, words)) / ((l.ms as number) ?? 1200)));
  if (p <= 0) return;
  const s = W / 1920, xa = px(l.t0), xb = px(l.t1), yb = py(l.above), yt = py((l.top as number) ?? CH.vmax);
  ctx.save();
  ctx.beginPath();
  if (Array.isArray(l.points)) {   // eğrinin altı, `above` çizgisinin üstü
    const pts = curvePts(l.points as [number, number][]).filter(([x]) => x >= xa && x <= xb);
    ctx.moveTo(xa, yb); pts.forEach(([x, y]) => ctx.lineTo(x, Math.min(y, yb))); ctx.lineTo(xb, yb); ctx.closePath();
  } else ctx.rect(xa, yt, xb - xa, yb - yt);
  ctx.clip();
  ctx.fillStyle = "rgba(200, 55, 45, 0.14)"; ctx.fillRect(xa, yt - 40, (xb - xa) * p, yb - yt + 80);
  if (l.hatch !== false) {
    ctx.strokeStyle = RED; ctx.lineWidth = 3 * s; ctx.globalAlpha *= 0.8;
    const span = xb - xa + (yb - yt) + 80;
    for (let d = 0; d < span * p; d += 22 * s) { ctx.beginPath(); ctx.moveTo(xa + d, yb + 20); ctx.lineTo(xa + d - (yb - yt) - 60, yt - 40); ctx.stroke(); }
  }
  ctx.restore();
}
export function drawChartBracket(ctx: Ctx, l: Layer, im: HTMLImageElement | undefined, ms: number, words: Word[], W: number, atMs: At) {
  const p = EASE.cubic(clamp01((ms - atMs(l.at ?? 0, words)) / 500));
  if (p <= 0) return;
  const s = W / 1920, tick = 16 * s;
  ctx.save();
  ctx.globalAlpha *= p; ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = 4 * s; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.font = font(52 * s); ctx.textBaseline = "middle";
  let lx: number, ly: number;
  ctx.beginPath();
  if (l.t0 !== undefined) {   // yatay ayraç (süre)
    const xa = px(l.t0), xb = px(l.t1), y = py(l.v);
    ctx.moveTo(xa, y + tick); ctx.lineTo(xa, y); ctx.lineTo(xa + (xb - xa) * p, y); if (p >= 1) ctx.lineTo(xb, y + tick);
    lx = (xa + xb) / 2; ly = y - 40 * s; ctx.textAlign = "center";
  } else {   // dikey ayraç (iki değer arası)
    const x = px(l.t), ya = py(l.v0), yb = py(l.v1);
    ctx.moveTo(x - tick, ya); ctx.lineTo(x, ya); ctx.lineTo(x, ya + (yb - ya) * p); if (p >= 1) ctx.lineTo(x - tick, yb);
    lx = x + 30 * s; ly = (ya + yb) / 2; ctx.textAlign = "left";
  }
  ctx.stroke();
  if (l.label !== undefined) {
    const txt = String(l.label), tw = ctx.measureText(txt).width;
    ctx.fillText(txt, lx, ly);
    if (im) { const h = 56 * s, w = h * (im.width / im.height); ctx.drawImage(im, lx + (ctx.textAlign === "center" ? tw / 2 : tw) + 14 * s, ly - h / 2, w, h); }
  }
  ctx.restore();
}
