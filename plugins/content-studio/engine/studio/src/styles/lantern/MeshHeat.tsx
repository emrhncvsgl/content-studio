// EP014 v6: tel örgü ısı mekanizması (s06, videonun kalbi) ve lirik kapanış (s09). 2D canvas, 1080×1920, kare = zamanın saf fonksiyonu.
// Kullanıcı notu (v5 s06): "gri lekeler, tek çubuk, küçük alev; ısı telden geçemiyor okunmuyor" → gerçek mekanizma animasyonu.
// Görünüm: dokuma tel örgünün KESİTİ (atkı telleri yuvarlak kesit, çözgü teli aralarından dalgalanarak geçer), arkada ikinci sıra bulanık (ölçek/derinlik).
// Sol = lambanın içi (sıcak), sağ = maden (soğuk). Gaz: soğuk mavi akış çizgileri sağdan sola, tellerin arasındaki boşluklardan geçer.
// shot "mech" (s06):
//   "Gas passed through the holes" → gaz akışı boşluklardan geçer · "burned inside" → içerideki gaz tutuşur, alev cephesi soldan tele ilerler,
//   dilleri boşluklara girer · "metal drew off the heat" (DORUK) → teller tele değen yerden kızarır (beyaz-sarı → turuncu → kırmızı → koyu), ısı
//   telin boyunca yukarı-aşağı yayılır, ısı okları alevden tele girip tel boyunca uzağa akar, boşluktan sızan alev uçları küçülüp söner ·
//   "Outside … never got hot enough" → kamera dış tarafa kayar; dış gaz mavi ve sakin, teller dengede koyu kırmızı.
// shot "calm" (s09): geniş plan, tel önde: solda kararlı alev, sağda mavi gaz; sonda her şey yavaşça söner (logo ShortsVideo outro'sunda).
import { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { wordFrame, type Word } from "../woodcut/kit";

type Shot = "mech" | "calm";
const W = 1080, H = 1920;
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ss = (u: number) => { u = clamp(u); return u * u * (3 - 2 * u); };
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const vn = (x: number) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(i) + (hash(i + 1) - hash(i)) * u; };
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

// kara cisim paleti: 0 soğuk metal → koyu kırmızı → kırmızı → turuncu → sarı → beyaz-sarı
const HEAT: [number, [number, number, number]][] = [[0, [60, 20, 10]], [0.25, [120, 22, 8]], [0.45, [200, 50, 18]], [0.65, [255, 130, 30]], [0.82, [255, 205, 90]], [1, [255, 246, 220]]];
const heatRGB = (t: number) => {
  t = clamp(t);
  for (let i = 1; i < HEAT.length; i++) if (t <= HEAT[i][0]) {
    const [a, ca] = HEAT[i - 1], [b, cb] = HEAT[i], u = (t - a) / (b - a);
    return ca.map((v, k) => Math.round(lerp(v, cb[k], u))) as [number, number, number];
  }
  return HEAT[HEAT.length - 1][1];
};
const rgba = (c: [number, number, number], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;

// örgü geometrisi (dünya = 1080×1920 kare koordinatı, kamera ayrıca)
const WX = 560, R = 44, GAP = 64;                        // atkı teli kesit yarıçapı, teller arası boşluk
const PITCH = 2 * R + GAP;
const WIRES = Array.from({ length: 15 }, (_, i) => 960 + (i - 7) * PITCH);     // y merkezleri
const GAPS = WIRES.slice(0, -1).map((y) => y + PITCH / 2);
const nearestGap = (y: number) => GAPS.reduce((b, g) => (Math.abs(g - y) < Math.abs(b - y) ? g : b), GAPS[0]);

type Cue = { burn: number; inside: number; metal: number; heat: number; out: number; end: number; dur: number };

/** ateş cephesi x (satır y'de): soldan tele ilerler, tele değince tel yüzünde durur; boşluk hizasında dil biraz içeri girer */
function frontAt(y: number, t: number, reach: number, poke: number) {
  const base = lerp(120, WX - R - 6, reach);
  const n = 46 * (vn(y * 0.011 + t * 2.1) - 0.5) + 22 * (vn(y * 0.031 - t * 3.3 + 7) - 0.5);
  let x = base + n * (0.4 + 0.6 * reach);
  if (reach > 0.9) {                                    // tel yüzüne yaslan; boşluk hizasında dil boşluğa uzanır (poke)
    const yw = WIRES.reduce((b, w) => (Math.abs(w - y) < Math.abs(b - y) ? w : b), WIRES[0]), dy = Math.abs(y - yw);
    if (dy < R) x = Math.min(x, WX - Math.sqrt(R * R - dy * dy) - 5);
    else { const gx = WX - R + (2 * R + 50) * poke * (1 - ((dy - R) / (GAP / 2) - 1) ** 2); x = Math.min(Math.max(x, WX - R - 10), Math.max(WX - R - 10, gx)); }
  }
  return x;
}

function drawScene(g: CanvasRenderingContext2D, t: number, c: Cue, shot: Shot, noise: HTMLCanvasElement) {
  const calm = shot === "calm";
  // ---- zaman eğrileri ----
  const reach = calm ? 1 : ss((t - c.burn + 0.2) / (c.inside - c.burn + 0.7));                 // ateş cephesi tele ilerler
  const fireOn = calm ? 1 : 0.35 + 0.65 * ss((t - c.burn + 0.3) / 0.6);
  const heatUp = calm ? 0.55 : ss((t - c.metal + 0.3) / Math.max(0.6, c.heat - c.metal));              // ısınma
  const spread = calm ? 1 : ss((t - c.metal) / 2.2);                                              // ısının tel boyunca yayılması
  const cool = calm ? 0 : ss((t - c.out) / 1.6) * 0.35;                                            // dışarı bakarken denge (biraz soğur)
  const poke = calm ? 0.12 : clamp(ss((t - c.inside + 0.1) / 0.5) * (1 - ss((t - c.metal - 0.2) / 1.1)) + 0.1);   // boşluktan sızan dil: ısı çekilince söner
  const fade = calm ? 1 - ss((t - (c.dur - 2.9)) / 1.4) : 1;                                       // s09: söz bitince söner, sonra logo (son 76 kare)                                       // s09 sonu: söner
  // ---- kamera ----
  const pan = calm ? 0 : ss((t - c.out + 0.2) / 1.6);
  const zoom = calm ? lerp(0.86, 0.8, ss(t / c.dur)) : lerp(1.1, 1.0, ss(t / 1.6)) + 0.04 * ss((t - c.metal) / 1.4) - 0.06 * pan;
  const camX = calm ? 0 : lerp(-30, 210, pan), camY = 0;
  g.setTransform(1, 0, 0, 1, 0, 0);
  // ---- zemin: içeri sıcak, dışarı soğuk ----
  const bg = g.createLinearGradient(0, 0, W, 0);
  bg.addColorStop(0, `rgb(${Math.round(34 * fade)},${Math.round(14 * fade)},${Math.round(6 * fade)})`);
  bg.addColorStop(0.48, "rgb(14,10,9)"); bg.addColorStop(1, "rgb(6,13,20)");
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.setTransform(zoom, 0, 0, zoom, W / 2 - (W / 2 + camX) * zoom, H / 2 - (H / 2 + camY) * zoom);

  // ---- arka sıra (dokumanın derinliği): küçük, bulanık, koyu ----
  g.save(); g.filter = "blur(6px)"; g.globalAlpha = 0.55 * fade;
  for (const y of WIRES) { g.fillStyle = "#1b1d20"; g.beginPath(); g.arc(WX + 120, y + PITCH / 2, R * 0.8, 0, 6.2832); g.fill(); }
  g.restore();

  // ---- gaz akışı (sağdan sola, boşluklardan geçer) ----
  const N = 520;
  g.save(); g.lineCap = "round";
  for (let i = 0; i < N; i++) {
    const y0 = 160 + hash(i * 3.1) * 1600, sp = 150 + 90 * hash(i * 7.7), ph = hash(i * 1.3) * (W + 600);
    const x = W + 260 - ((t * sp + ph) % (W + 600));
    const bump = Math.exp(-(((x - WX) / (R * 1.9)) ** 2));
    const y = lerp(y0, nearestGap(y0), bump) + 6 * Math.sin(t * 1.3 + i);
    if (x < -40) continue;
    const front = frontAt(y, t, reach, poke);
    let col = "rgba(150,205,255,", a = 0.5 + 0.35 * hash(i * 9.1), len = 30 + 26 * hash(i * 4.4), w = 3 + 3 * hash(i * 2.2);
    if (x < front + 30) {                                   // ateşe girdi: içeride yanar (turuncu kıvılcım, söner)
      if (fireOn < 0.4 || x < front - 50) continue;
      col = "rgba(255,180,90,"; a *= clamp((x - (front - 50)) / 80); len *= 0.6;
    } else if (x < WX + R && !calm) {                       // boşluktan içeri geçerken hafif ısınır
      a *= 0.9;
    }
    g.strokeStyle = col + (a * fade).toFixed(3) + ")"; g.lineWidth = w;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y + (lerp(y0, nearestGap(y0), Math.exp(-(((x + len - WX) / (R * 1.9)) ** 2))) - lerp(y0, nearestGap(y0), bump))); g.stroke();
  }
  g.restore();

  // ---- ateş (içerisi): üç katman, eklemeli, cephede ince mavi tepkime bandı ----
  if (fireOn > 0) {
    // taban kor ışığı (bulanık, koyu turuncu) + ayrı ayrı alev dilleri (kökte koyu kırmızı → cephede sarı-beyaz), aralarında karanlık kalır
    g.save(); g.globalCompositeOperation = "lighter"; g.filter = "blur(34px)"; g.globalAlpha = 0.5 * fireOn * fade;
    g.fillStyle = "rgba(150,40,10,0.8)"; g.beginPath(); g.moveTo(-200, 40);
    for (let y = 40; y <= 1880; y += 20) g.lineTo(frontAt(y, t, reach, poke) - 90, y);
    g.lineTo(-200, 1880); g.closePath(); g.fill(); g.restore();
    g.save(); g.globalCompositeOperation = "lighter"; g.filter = "blur(3px)";
    for (let k = 0; k < 58; k++) {
      const yk = 40 + k * 32 + 30 * (hash(k * 9.7) - 0.5) + 16 * (vn(k * 1.7 + t * 0.9) - 0.5), hw = (18 + 22 * hash(k * 3.7)) * (0.8 + 0.3 * vn(t * 2.4 + k));
      const tip = frontAt(yk, t, reach, poke) - (20 + 110 * hash(k * 5.1)) * (0.3 + 0.7 * vn(t * 2.6 + k * 1.3)), root = tip - (220 + 420 * hash(k * 2.3));
      const wob = 26 * (vn(t * 2.2 + k * 0.7) - 0.5);
      const fg = g.createLinearGradient(root, 0, tip, 0);
      fg.addColorStop(0, "rgba(110,16,4,0)"); fg.addColorStop(0.45, "rgba(200,52,12,0.42)"); fg.addColorStop(0.8, "rgba(255,140,36,0.55)"); fg.addColorStop(1, "rgba(255,226,150,0.7)");
      g.fillStyle = fg; g.globalAlpha = fireOn * fade;
      g.beginPath(); g.moveTo(root, yk - hw);
      g.bezierCurveTo(lerp(root, tip, 0.5), yk - hw * 1.2 + wob, lerp(root, tip, 0.85), yk - hw * 0.5 + wob, tip, yk + wob * 0.6);
      g.bezierCurveTo(lerp(root, tip, 0.85), yk + hw * 0.5 + wob, lerp(root, tip, 0.5), yk + hw * 1.2 + wob, root, yk + hw);
      g.closePath(); g.fill();
    }
    g.restore();
    // dil şeritleri (turbülans): parlak ince damarlar cepheye doğru
    g.save(); g.globalCompositeOperation = "lighter"; g.lineCap = "round";
    for (let k = 0; k < 70; k++) {
      const y = 80 + hash(k * 5.3) * 1760, len = 120 + 260 * hash(k * 2.9), sp = 0.8 + hash(k) * 1.6;
      const fx = frontAt(y, t, reach, poke), u = (t * sp + hash(k * 8.1)) % 1;
      const x1 = fx - 10 - u * len * 0.3, x0 = x1 - len;
      g.strokeStyle = `rgba(255,${Math.round(190 + 50 * hash(k))},120,${(0.1 * (1 - u) * fireOn * fade).toFixed(3)})`; g.lineWidth = 6 + 10 * hash(k * 1.7);
      g.beginPath(); g.moveTo(x0, y + 10 * Math.sin(t * 3 + k)); g.quadraticCurveTo((x0 + x1) / 2, y - 18 * vn(t * 2 + k), x1, y); g.stroke();
    }
    g.restore();
    // tepkime bandı: cephenin hemen önünde soluk mavi (metan alevi)
    g.save(); g.globalCompositeOperation = "lighter"; g.filter = "blur(3px)"; g.strokeStyle = `rgba(110,160,255,${(0.55 * fireOn * fade).toFixed(3)})`; g.lineWidth = 5;
    g.beginPath(); for (let y = 60; y <= 1860; y += 10) { const x = frontAt(y, t, reach, poke) + 4; y === 60 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke(); g.restore();
    // kıvılcımlar
    g.save(); g.globalCompositeOperation = "lighter";
    for (let k = 0; k < 60; k++) {
      const life = (t * (0.5 + hash(k * 3.3)) + hash(k)) % 1, y = 1800 - life * 1700 + 30 * Math.sin(k + t), x = frontAt(y, t, reach, poke) - 30 - 260 * hash(k * 6.6);
      g.fillStyle = `rgba(255,${Math.round(150 + 80 * hash(k * 2))},80,${((1 - life) * 0.8 * fireOn * fade).toFixed(3)})`;
      g.beginPath(); g.arc(x, y, 2 + 2.5 * hash(k * 4), 0, 6.2832); g.fill();
    }
    g.restore();
  }

  // ---- teller: sıcaklık alanı. Temas eden teller (ateşin değdiği) önce, yayılma ile komşular; tel içinde sol (ateş tarafı) daha sıcak ----
  const temp = (y: number) => {
    const w = lerp(160, 900, spread);
    return clamp(heatUp * (1 - cool) * (0.55 + 0.45 * Math.exp(-(((y - 960) / w) ** 2))) * (0.92 + 0.08 * Math.sin(t * 7 + y * 0.01)));
  };
  // çözgü teli: atkı tellerinin arasından dalgalanarak geçer (önce arkadan, sonra önden)
  const warp = (front: boolean) => {
    g.save(); g.lineCap = "round"; g.lineWidth = 15;
    for (let i = 0; i < WIRES.length - 1; i++) {
      const ya = WIRES[i], yb = WIRES[i + 1], side = i % 2 ? 1 : -1;
      if ((side > 0) !== front) continue;
      const tm = temp((ya + yb) / 2) * 0.85;
      const metal = g.createLinearGradient(WX - 30, 0, WX + 30, 0);
      metal.addColorStop(0, "#33373b"); metal.addColorStop(0.5, "#7d848b"); metal.addColorStop(1, "#2a2d31");
      g.strokeStyle = metal; g.globalAlpha = fade;
      g.beginPath(); g.moveTo(WX + side * (R + 8), ya); g.bezierCurveTo(WX + side * (R + 30), ya + PITCH * 0.35, WX - side * (R + 30), yb - PITCH * 0.35, WX - side * (R + 8), yb); g.stroke();
      if (tm > 0.02) { g.strokeStyle = rgba(heatRGB(tm), 0.85 * Math.min(1, tm * 2.2) * fade); g.stroke(); }
    }
    g.restore();
  };
  warp(false);
  for (const y of WIRES) {
    const tm = temp(y);
    // metal gövde (yuvarlak tel kesiti): koyu kenar, ışıklı üst-sol, ince parlama
    const mg = g.createRadialGradient(WX - R * 0.35, y - R * 0.4, R * 0.1, WX, y, R * 1.05);
    mg.addColorStop(0, "#d9dee3"); mg.addColorStop(0.35, "#8b9299"); mg.addColorStop(0.8, "#40454b"); mg.addColorStop(1, "#1d2023");
    g.save(); g.globalAlpha = fade; g.fillStyle = mg; g.beginPath(); g.arc(WX, y, R, 0, 6.2832); g.fill();
    // ısı: ateş tarafından (sol) yayılan renk; sıcaklık yüksekse tüm kesit kızarır
    if (tm > 0.01) {
      const hg = g.createRadialGradient(WX - R * 0.9, y, 2, WX - R * 0.4, y, R * (1.2 + 1.2 * tm));
      hg.addColorStop(0, rgba(heatRGB(Math.min(1, tm * 1.1)), Math.min(1, tm * 1.6)));
      hg.addColorStop(0.55, rgba(heatRGB(tm * 0.75), Math.min(1, tm * 1.3)));
      hg.addColorStop(1, rgba(heatRGB(tm * 0.45), tm * 0.6));
      g.fillStyle = hg; g.beginPath(); g.arc(WX, y, R, 0, 6.2832); g.fill();
      // kızıllık halesi
      g.globalCompositeOperation = "lighter"; g.filter = "blur(14px)"; g.fillStyle = rgba(heatRGB(tm), 0.45 * tm);
      g.beginPath(); g.arc(WX - 6, y, R * 1.25, 0, 6.2832); g.fill();
      g.filter = "none"; g.globalCompositeOperation = "source-over";
    }
    // speküler çizgi
    g.strokeStyle = "rgba(255,255,255,0.35)"; g.lineWidth = 3; g.beginPath(); g.arc(WX, y, R * 0.78, 3.6, 4.5); g.stroke();
    g.restore();
  }
  warp(true);

  // ---- ısı okları: ateşten tele girer, tel boyunca yukarı/aşağı uzağa akar ----
  const arrowsOn = calm ? 0 : ss((t - c.metal + 0.1) / 0.5) * (1 - 0.6 * ss((t - c.out - 0.6) / 1.2));
  if (arrowsOn > 0) {
    const arrow = (x: number, y: number, ang: number, s: number, col: string) => {
      g.save(); g.translate(x, y); g.rotate(ang); g.fillStyle = col; g.strokeStyle = col; g.lineWidth = 7 * s; g.lineCap = "round";
      g.beginPath(); g.moveTo(-26 * s, 0); g.lineTo(10 * s, 0); g.stroke();
      g.beginPath(); g.moveTo(24 * s, 0); g.lineTo(6 * s, -12 * s); g.lineTo(6 * s, 12 * s); g.closePath(); g.fill(); g.restore();
    };
    g.save(); g.shadowColor = "rgba(0,0,0,0.6)"; g.shadowBlur = 8;
    // giriş: alevden tele (sağa)
    for (let k = 0; k < 7; k++) {
      const y = 960 + (k - 3) * PITCH, u = (t * 1.4 + k * 0.37) % 1;
      arrow(WX - R - 150 + u * 90, y, 0, 1.7, rgba(heatRGB(0.9), (0.9 * Math.sin(Math.PI * u)) * arrowsOn * fade));
    }
    // yayılma: tel boyunca (sol yüzün hemen sağında, merkezden uzağa)
    for (let k = 0; k < 14; k++) {
      const dir = k % 2 ? 1 : -1, u = (t * 0.55 + Math.floor(k / 2) * 0.143) % 1, y = 960 + dir * (40 + u * 820);
      const tm = temp(y);
      arrow(WX + R + 46, y, dir * Math.PI / 2, 1.5, rgba(heatRGB(Math.max(0.35, tm)), Math.sin(Math.PI * u) * 0.95 * arrowsOn * fade));
    }
    g.restore();
  }
  // ---- boşluktan sızan alev uçları (dış tarafta küçülüp söner) ----
  if (!calm && poke > 0.12) {
    g.save(); g.globalCompositeOperation = "lighter";
    for (const gy of GAPS) {
      if (Math.abs(gy - 960) > 620) continue;
      const len = (2 * R + 40) * poke * (0.7 + 0.3 * vn(gy * 0.01 + t * 4));
      const fg = g.createLinearGradient(WX - R, 0, WX - R + len, 0);
      fg.addColorStop(0, "rgba(255,190,80,0.9)"); fg.addColorStop(1, "rgba(255,90,20,0)");
      g.fillStyle = fg; g.beginPath(); g.moveTo(WX - R, gy - GAP * 0.42); g.quadraticCurveTo(WX - R + len, gy, WX - R, gy + GAP * 0.42); g.closePath(); g.fill();
    }
    g.restore();
  }
  // ---- dış taraf: soğuk kalır (gazın etrafında soluk mavi serinlik) ----
  const coldGlow = calm ? 0.5 : ss((t - c.out) / 1.2);
  if (coldGlow > 0) {
    const cg = g.createRadialGradient(WX + 380, 960, 50, WX + 380, 960, 700);
    cg.addColorStop(0, `rgba(80,140,210,${(0.16 * coldGlow * fade).toFixed(3)})`); cg.addColorStop(1, "rgba(80,140,210,0)");
    g.fillStyle = cg; g.fillRect(WX + R, 0, 1400, H);
  }
  // ---- kâğıt fener dokusu + vinyet ----
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 0.09; g.globalCompositeOperation = "overlay"; g.drawImage(noise, 0, 0, W, H); g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
  const vg = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.72);
  vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.7)");
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
}

export const MeshHeat: React.FC<{ durationInFrames?: number; words?: Word[]; shot?: Shot }> = ({ words, shot = "mech" }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const noise = useMemo(() => {
    const c = document.createElement("canvas"); c.width = 540; c.height = 960; const q = c.getContext("2d")!;
    const im = q.createImageData(540, 960);
    for (let i = 0; i < 540 * 960; i++) { const v = 128 + 120 * (hash(i * 0.731) - 0.5) + 40 * (vn(i % 540 * 0.05 + Math.floor(i / 540) * 0.002) - 0.5); im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
    q.putImageData(im, 0, 0); return c;
  }, []);
  const fr = (p: string, s: number) => wordFrame(words, p, fps, s) / fps;
  const cue: Cue = { burn: fr("burned", 2.01), inside: fr("inside.", 2.39), metal: fr("metal", 3.16), heat: fr("heat.", 4.0), out: fr("outside,", 4.8),
    end: durationInFrames / fps, dur: durationInFrames / fps };
  useLayoutEffect(() => {
    const g = ref.current?.getContext("2d"); if (!g) return;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
    drawScene(g, frame / fps, cue, shot, noise);
  });
  return <AbsoluteFill style={{ background: "#050404" }}><canvas ref={ref} width={W} height={H} style={{ width, height }} /></AbsoluteFill>;
};
