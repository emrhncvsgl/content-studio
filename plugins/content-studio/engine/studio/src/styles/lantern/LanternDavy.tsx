// EP014 Davy lambası, kâğıt fener sahneleri (9:16; storyboard s06, s08, s09). Kit: ./kit + ./paper (Lemo paper-lantern, MIT).
// Dünya birimi metre; kamera z 0.9, fov 30 → görünür yükseklik ≈ 0.48 m. Altyazı bandı (kare y 0.60-0.78) dünya y ≈ -0.05 … -0.13: orada ışık yok.
// shot "mesh" (s06, yandan kesit): solda kâğıt alev (kandil), ortada delikli tel duvarı (düşey), sağda soluk mavi-gri gaz bulutu.
//   "passed/holes": gaz pufları delikten içeri süzülür · "burned/inside": puflar içeride tutuşur, alev dili deliğe uzanır ·
//   "metal/drew/heat" (ANAHTAR AN): ince oklar alev dilinden tele akar, tel boyunca yukarı-aşağı yayılır, turuncudan soğuk maviye döner ve küçülür;
//   tel kısa süre turuncu ısınır (uGY bandı genişler, söner); alev dili küçülür · "outside": kamera dışarıya kayar, dış gaz sakin. Yazı yok.
// shot "grid" (s08, önden): yakın planda tek büyük açıklıkta alev ("one open flame") → "became…gaps" tel çubuklar kayarak girer, açıklık ince
//   ızgaraya bölünür (EŞLEŞME: s06 tel duvarı) → "Light got out" arka ışık ve bloom açılır, delikler parlar → "fire stayed in" alev kabarır ama
//   ızgaranın ardında kalır → "segmentation" kamera geri çekilir: arkadan aydınlanmış Davy lambası silueti (şapka, halka, dikmeler, kandil gövdesi).
// shot "out" (s09): grid son hâli; ışık yavaşça söner, kanal logosu ShortsVideo props.outro ile üstte.
import { useMemo } from "react";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { aim, cut, PAPER, tint, useLantern } from "./kit";
import { burst, sheet, skyPanel } from "./paper";
import { clamp, eio, eo, ei, lerp, seg, ss, TAU, vnoise } from "./lib";
import { wordFrame, type Word } from "../woodcut/kit";

type Ctx = CanvasRenderingContext2D;
type Shot = "mesh" | "grid" | "out";
type U = Record<string, { value: number & THREE.Vector4 }>;
const uu = (m: THREE.Mesh) => (m.material as THREE.Material & { userData: { u: U } }).userData.u;
const glowI = (m: THREE.Mesh, k: number) => { (m.material as THREE.MeshStandardMaterial).emissiveIntensity = k; };
const tintLerp = (m: THREE.Mesh, a: string, b: string, u: number) => tint(m, "#" + new THREE.Color(a).lerp(new THREE.Color(b), clamp(u)).getHexString());

/** kâğıt alev (damla): taban y 0, uç y h; dil dalgası ph */
const flamePath = (x: Ctx, w: number, h: number, lean = 0) => {
  x.beginPath(); x.moveTo(0, 0);
  x.bezierCurveTo(-w * 0.62, h * 0.05, -w * 0.5, h * 0.55, lean * h * 0.4, h);
  x.bezierCurveTo(w * 0.5, h * 0.55, w * 0.62, h * 0.05, 0, 0); x.closePath();
};
const blob = (x: Ctx, cx: number, cy: number, r: number, seed: number) => {
  x.beginPath();
  for (let i = 0; i <= 24; i++) { const a = (i / 24) * TAU; const rr = r * (0.82 + 0.22 * vnoise(seed + i * 0.9)); i ? x.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a)) : x.moveTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a)); }
  x.closePath(); x.fill();
};
const arrow = (x: Ctx) => { x.fillStyle = PAPER; x.fillRect(-0.012, -0.0007, 0.017, 0.0014); x.beginPath(); x.moveTo(0.012, 0); x.lineTo(0.004, 0.0032); x.lineTo(0.004, -0.0032); x.closePath(); x.fill(); };

// ---------------- s06 kesit ----------------
const MeshScene: React.FC<{ t: number; fr: (p: string, s: number, e?: "start" | "end") => number; width: number; height: number }> = ({ t, fr, width, height }) => {
  const FX = -0.065, FY = 0.0;   // kandil alevi tabanı
  const { S, camera, setPost } = useLantern(width, height, {
    light: [FX, FY + 0.03, -0.12], lightR: 0.12, lightCol: "#ffc77a", floor: 0.12, key: 1.1, keyCol: "#ffe6c8",
    keyPos: [-0.05, 0.42, 0.42], keyTarget: [0, 0.0, -0.08], amb: 0.18, ambCol: "#7f8fb0", bg: "#050404",
  });
  const L = useMemo(() => {
    const U = S.U;
    const back = S.add(skyPanel({ w: 0.9, h: 1.2, z: -0.16, stops: [[0, "#060505"], [0.5, "#1a120d"], [1, "#0b0807"]], gain: 1 }));
    // uzak kaya: tavan ve taban kenarı (düzensiz), ortası açık
    const rock = S.add(sheet({ U, w: 0.7, h: 0.9, z: -0.135, trans: 0.85, draw: (x: Ctx) => {
      x.fillStyle = PAPER; x.beginPath(); x.moveTo(-0.35, 0.45);
      for (let u = -0.35; u <= 0.351; u += 0.01) x.lineTo(u, 0.2 + 0.02 * Math.sin(u * 23) + 0.012 * Math.sin(u * 61));
      x.lineTo(0.35, 0.45); x.closePath(); x.fill();
      x.beginPath(); x.moveTo(-0.35, -0.45);
      for (let u = -0.35; u <= 0.351; u += 0.01) x.lineTo(u, -0.16 + 0.015 * Math.sin(u * 19 + 1) + 0.01 * Math.sin(u * 47));
      x.lineTo(0.35, -0.45); x.closePath(); x.fill(); } }));
    tint(rock, "#3b2a1f");
    // dış gaz bulutu (sağ), sakin
    const gas = S.add(sheet({ U, w: 0.24, h: 0.3, x: 0.1, y: 0.03, z: -0.105, trans: 0.7, draw: (x: Ctx) => {
      x.fillStyle = PAPER; [[0.0, 0.05, 0.05], [0.045, 0.0, 0.055], [-0.03, -0.04, 0.045], [0.03, 0.08, 0.04], [0.07, -0.06, 0.04], [-0.05, 0.03, 0.035]]
        .forEach(([cx, cy, r], i) => blob(x, cx, cy, r, i * 7.3)); } }));
    tint(gas, "#8b9db3");
    // içeri süzülen gaz pufları (3): tutuşunca turuncu parlar
    const puffs = [0, 1, 2].map((i) => S.add(sheet({ U, w: 0.03, h: 0.03, z: -0.088, trans: 0.6,
      draw: (x: Ctx) => { x.fillStyle = PAPER; blob(x, 0, 0, 0.011, i * 3.1 + 1); },
      glowDraw: (x: Ctx) => { x.fillStyle = "#fff"; blob(x, 0, 0, 0.011, i * 3.1 + 1); }, glow: 0, glowCol: "#ff9a3c" })));
    // kandil gövdesi (koyu), fitil
    const burner = S.add(sheet({ U, w: 0.06, h: 0.05, x: FX, y: FY - 0.026, z: -0.066, trans: 0.05, draw: (x: Ctx) => {
      x.fillStyle = PAPER; x.fillRect(-0.022, -0.02, 0.044, 0.026); x.fillRect(-0.004, 0.006, 0.008, 0.012); } }));
    tint(burner, "#1d150f");
    const flame = S.add(sheet({ U, w: 0.05, h: 0.1, ax: 0, ay: -0.04, x: FX, y: FY, z: -0.07, trans: 0.4,
      draw: (x: Ctx) => { x.fillStyle = PAPER; x.save(); x.translate(0, -0.04); flamePath(x, 0.03, 0.075); x.fill(); x.restore(); },
      glowDraw: (x: Ctx) => { x.fillStyle = "#fff"; x.save(); x.translate(0, -0.04); flamePath(x, 0.03, 0.075); x.fill(); x.restore(); }, glow: 2.2, glowCol: "#ffb347" }));
    tint(flame, "#f2a040");
    // alev dili: kandilden tele doğru uzanan yatay dil (pim: sol uç)
    const tongue = S.add(sheet({ U, w: 0.08, h: 0.02, ax: -0.04, ay: 0, x: FX + 0.005, y: FY + 0.035, z: -0.069, trans: 0.4,
      draw: (x: Ctx) => { x.fillStyle = PAPER; x.beginPath(); x.moveTo(-0.04, -0.006); x.quadraticCurveTo(0.0, -0.007, 0.04, 0); x.quadraticCurveTo(0.0, 0.008, -0.04, 0.006); x.closePath(); x.fill(); },
      glowDraw: (x: Ctx) => { x.fillStyle = "#fff"; x.beginPath(); x.moveTo(-0.04, -0.006); x.quadraticCurveTo(0.0, -0.007, 0.04, 0); x.quadraticCurveTo(0.0, 0.008, -0.04, 0.006); x.closePath(); x.fill(); }, glow: 2.0, glowCol: "#ffa040" }));
    tint(tongue, "#f29a3a");
    // tel duvarı: düşey şerit, iki sıra küçük delik; telin kendisi ısınınca parlar (glowDraw = tel, uGY bandı ile)
    const wire = (x: Ctx, holes: boolean) => {
      x.fillStyle = holes ? PAPER : "#fff"; x.fillRect(-0.006, -0.19, 0.012, 0.38);
      const fn = () => { for (let y = -0.185; y < 0.185; y += 0.005) for (const cx of [-0.0028, 0.0028]) { x.beginPath(); x.arc(cx, y + (cx > 0 ? 0.0025 : 0), 0.0012, 0, TAU); x.fill(); } };
      if (holes) cut(x, fn); else { x.globalCompositeOperation = "destination-out"; fn(); x.globalCompositeOperation = "source-over"; }
    };
    const mesh = S.add(sheet({ U, w: 0.014, h: 0.38, x: 0.0, y: 0.02, z: -0.06, trans: 0.1, draw: (x: Ctx) => wire(x, true), glowDraw: (x: Ctx) => wire(x, false), glowRes: 1, glow: 0, glowCol: "#ff6a20" }));
    tint(mesh, "#77736d");
    // ısı okları: 2 yatay (dilden tele), 4 düşey (tel boyunca)
    const arrows = [0, 1, 2, 3, 4, 5].map(() => S.add(sheet({ U, w: 0.03, h: 0.008, z: -0.053, trans: 0.3, draw: arrow,
      glowDraw: (x: Ctx) => { x.fillStyle = "#fff"; x.fillRect(-0.012, -0.0007, 0.017, 0.0014); x.beginPath(); x.moveTo(0.012, 0); x.lineTo(0.004, 0.0032); x.lineTo(0.004, -0.0032); x.closePath(); x.fill(); }, glow: 1.6, glowCol: "#ffffff" })));
    // ön plan: lamba şapkasının alt kenarı (üst) ve kandil gövdesi (alt), koyu, neredeyse opak
    const front = S.add(sheet({ U, w: 0.5, h: 0.9, z: -0.02, trans: 0.04, recv: false, draw: (x: Ctx) => {
      x.fillStyle = PAPER; x.fillRect(-0.25, 0.235, 0.5, 0.25);
      x.beginPath(); x.moveTo(-0.25, 0.235); for (let u = -0.25; u <= 0.251; u += 0.01) x.lineTo(u, 0.225 + 0.004 * Math.sin(u * 80)); x.lineTo(0.25, 0.235); x.fill();
      x.fillRect(-0.25, -0.45, 0.5, 0.27); } }));
    tint(front, "#120c08");
    void back;
    return { gas, puffs, flame, tongue, mesh, arrows, front };
  }, [S]);

  const tPass = fr("passed", 0.22), tHoles = fr("holes", 1.48), tBurn = fr("burned", 2.0), tMetal = fr("metal", 3.16), tHeat = fr("heat", 4.0), tOut = fr("outside", 4.8);
  // ışık açılışı: kaynak → katmanlar → kandil
  S.U.uLit.value = ss(seg(t, 0, 1.0)) * (1 + 0.05 * Math.sin(9.1 * t) * Math.sin(3.7 * t));
  const flick = 1 + 0.06 * Math.sin(t * 11.3) + 0.04 * Math.sin(t * 17.1 + 1);
  L.flame.scale.set(1 + 0.04 * Math.sin(t * 7), flick, 1);
  glowI(L.flame, 2.2 * ss(seg(t, 0.2, 0.8)));
  // gaz pufları: sağdan tele (tPass→tHoles), delikten geçer, içeride (x<0) tutuşur (tBurn), söner
  L.puffs.forEach((p, i) => {
    const a = tPass - 0.1 + i * 0.25, b = tHoles + 0.35 + i * 0.2;
    const k = eio(seg(t, a, b));
    p.position.set(lerp(0.075, -0.028 - 0.008 * i, k), 0.035 + 0.025 * (i - 1) + 0.004 * Math.sin(t * 2 + i), -0.088);
    const ign = ss(seg(t, tBurn - 0.1 + i * 0.12, tBurn + 0.3 + i * 0.12));
    tintLerp(p, "#8b9db3", "#f39a3c", ign);
    glowI(p, 2.2 * ign * (1 - ss(seg(t, tBurn + 0.6 + i * 0.1, tBurn + 1.3 + i * 0.1))));
    p.scale.setScalar(Math.max(0.001, 1 - ss(seg(t, tBurn + 0.7 + i * 0.1, tBurn + 1.4 + i * 0.1))));
  });
  // alev dili: "burned/inside" ile tele uzanır, "metal…heat" ile delikte küçülür
  const reach = eo(seg(t, tBurn, tBurn + 0.8)) * (1 - 0.6 * eio(seg(t, tMetal + 0.3, tHeat + 0.8)));
  L.tongue.scale.set(Math.max(0.001, reach), 0.85 + 0.15 * flick, 1);
  glowI(L.tongue, 2.0 * Math.min(1, reach * 1.5));
  // tel ısınır (dilin ucunda), bant tel boyunca genişler ve söner
  const heat = ss(seg(t, tMetal, tMetal + 0.5)) * (1 - ss(seg(t, tHeat + 0.6, tOut + 0.9)));
  const band = lerp(0.008, 0.12, eo(seg(t, tMetal + 0.1, tHeat + 0.6)));
  const um = uu(L.mesh); (um.uGY.value as unknown as THREE.Vector4).set(FY + 0.035 - 0.02, band, 0.0, 1);
  glowI(L.mesh, 1.6 * heat * (1.1 - 0.6 * eo(seg(t, tMetal, tHeat + 0.6))));
  // ısı okları: 0-1 yatay (dil → tel), 2-5 düşey (tel boyunca, ±y); turuncu → soğuk mavi, küçülerek kaybolur
  L.arrows.forEach((m, i) => {
    const t0 = tMetal + (i < 2 ? i * 0.18 : 0.45 + (i - 2) * 0.16), d = i < 2 ? 0.7 : 1.3;
    const u = seg(t, t0, t0 + d), k = eo(u);
    if (i < 2) { m.position.set(lerp(-0.03, -0.004, k), FY + 0.035 + (i ? -0.006 : 0.006) - 0.02, -0.053); m.rotation.z = 0; }
    else { const up = i % 2 === 0 ? 1 : -1, lane = i < 4 ? -0.0025 : 0.0025;
      m.position.set(lane, FY + 0.015 + up * lerp(0.0, up > 0 ? 0.13 : 0.045, k), -0.053); m.rotation.z = up * Math.PI / 2; }
    const vis = u > 0 && u < 1 ? 1 : 0;
    m.scale.setScalar(Math.max(0.001, vis * (1 - ss(seg(u, 0.65, 1))) * (0.8 + 0.2 * ss(seg(u, 0, 0.15)))));
    tintLerp(m, "#ff8a2a", "#7fb4ff", ss(seg(u, 0.2, 0.9)));
    glowI(m, 1.8 * (1 - ss(seg(u, 0.3, 1))));
  });
  // dış gaz: sakin salınım
  L.gas.position.x = 0.1 + 0.003 * Math.sin(t * 0.7); L.gas.position.y = 0.03 + 0.002 * Math.sin(t * 0.9 + 1);
  // kamera: observer, yavaş yanal itiş; "outside" ile dışarıya (sağa) kayar
  const cx = lerp(-0.02, 0.0, eio(seg(t, 0, tOut))) + 0.045 * eio(seg(t, tOut - 0.2, tOut + 1.8));
  const cz = lerp(0.88, 0.8, eio(seg(t, 0, 8)));
  aim(camera, [cx, 0.035, cz, cx, 0.035, -0.08], t, { fov: 30 });
  setPost({ strength: 0.38 + 0.2 * heat, radius: 0.55, threshold: 1.0 }, { vig: 0.45, warm: 0.04, fade: ss(seg(t, 0, 0.35)) });
  return null;
};

// ---------------- s08/s09 ızgara + lamba ----------------
const GW = 0.09, GH = 0.17, GY = 0.045, PITCH = 0.0075, BAR = 0.0017;
const GridScene: React.FC<{ t: number; fr: (p: string, s: number, e?: "start" | "end") => number; width: number; height: number; out: boolean }> = ({ t, fr, width, height, out }) => {
  const { S, camera, setPost } = useLantern(width, height, {
    light: [0, GY, -0.1], lightR: 0.16, lightCol: "#ffcf86", floor: 0.08, key: 0.7, keyCol: "#ffe2b8",
    keyPos: [0, 0.4, 0.5], keyTarget: [0, GY, -0.05], amb: 0.1, ambCol: "#6d7aa0", bg: "#040303",
  });
  const L = useMemo(() => {
    const U = S.U;
    S.add(skyPanel({ w: 1.2, h: 1.6, z: -0.2, stops: [[0, "#030202"], [0.45, "#120b07"], [0.55, "#170e08"], [1, "#030202"]], gain: 1 }));
    // gazlı bezin ardında sıcak ışık paneli (delikten görünen ışık)
    const inner = S.add(sheet({ U, w: GW + 0.006, h: GH + 0.006, y: GY, z: -0.08, trans: 0.85, draw: (x: Ctx) => { x.fillStyle = PAPER; x.fillRect(-0.05, -0.09, 0.1, 0.18); },
      glowDraw: (x: Ctx) => { const g = x.createRadialGradient(0, -0.02, 0, 0, -0.02, 0.1); g.addColorStop(0, "#fff"); g.addColorStop(1, "#555"); x.fillStyle = g; x.fillRect(-0.05, -0.09, 0.1, 0.18); }, glow: 0.5, glowCol: "#ffb860" }));
    tint(inner, "#6a4022");
    const flame = S.add(sheet({ U, w: 0.05, h: 0.1, ax: 0, ay: -0.045, x: 0, y: GY - 0.045, z: -0.06, trans: 0.4,
      draw: (x: Ctx) => { x.fillStyle = PAPER; x.save(); x.translate(0, -0.045); flamePath(x, 0.034, 0.085); x.fill(); x.restore(); },
      glowDraw: (x: Ctx) => { x.fillStyle = "#fff"; x.save(); x.translate(0, -0.045); flamePath(x, 0.034, 0.085); x.fill(); x.restore(); }, glow: 2.4, glowCol: "#ffb347" }));
    tint(flame, "#f2a640");
    const wick = S.add(sheet({ U, w: 0.03, h: 0.02, y: GY - 0.055, z: -0.058, trans: 0.05, draw: (x: Ctx) => { x.fillStyle = PAPER; x.fillRect(-0.012, -0.01, 0.024, 0.01); x.fillRect(-0.002, 0, 0.004, 0.008); } }));
    tint(wick, "#22170f");
    // tel çubuklar: düşey (üstten kayar) ve yatay (yanlardan kayar)
    const nv = Math.round(GW / PITCH) - 1, nh = Math.round(GH / PITCH) - 1;
    const bar = (w: number, h: number) => sheet({ U, w, h, z: -0.03, trans: 0.06, draw: (x: Ctx) => { x.fillStyle = PAPER; x.fillRect(-w / 2, -h / 2, w, h); } });
    const vbars = Array.from({ length: nv }, (_, i) => { const m = S.add(bar(BAR, GH)); tint(m, "#2a2017"); m.userData.x = -GW / 2 + (i + 1) * PITCH; return m; });
    const hbars = Array.from({ length: nh }, (_, i) => { const m = S.add(bar(GW, BAR)); tint(m, "#2a2017"); m.userData.y = GY - GH / 2 + (i + 1) * PITCH; return m; });
    // lamba silueti: şapka + halka, iki dikme, gazlı bez çerçevesi (üst/alt bilezik), kandil gövdesi
    const lamp = S.add(sheet({ U, w: 0.3, h: 0.5, z: -0.012, trans: 0.04, recv: false, draw: (x: Ctx) => {
      x.fillStyle = PAPER;
      const top = GY + GH / 2, bot = GY - GH / 2;
      x.fillRect(-0.053, top - 0.002, 0.106, 0.012);                       // üst bilezik
      x.beginPath(); x.moveTo(-0.05, top + 0.01); x.lineTo(-0.028, top + 0.03); x.lineTo(0.028, top + 0.03); x.lineTo(0.05, top + 0.01); x.closePath(); x.fill();   // şapka
      x.lineWidth = 0.004; x.strokeStyle = PAPER; x.beginPath(); x.arc(0, top + 0.05, 0.018, 0, TAU); x.stroke();   // taşıma halkası
      x.fillRect(-0.002, top + 0.028, 0.004, 0.006);
      for (const sx of [-1, 1]) x.fillRect(sx * 0.052 - 0.0022, bot - 0.004, 0.0044, GH + 0.012);   // dikmeler
      x.fillRect(-0.053, bot - 0.012, 0.106, 0.012);                       // alt bilezik
      x.beginPath(); x.moveTo(-0.058, bot - 0.012); x.lineTo(0.058, bot - 0.012); x.lineTo(0.062, bot - 0.06); x.quadraticCurveTo(0, bot - 0.072, -0.062, bot - 0.06); x.closePath(); x.fill();   // kandil
    } }));
    tint(lamp, "#140d08");
    const halo = burst(0.5, 0.5, "#ffc178"); halo.position.set(0, GY - 0.11, -0.005); S.add(halo);
    return { inner, flame, vbars, hbars, lamp, halo };
  }, [S]);

  const tBec = out ? -9 : fr("became", 0.89), tGaps = out ? -9 : fr("gaps", 1.94), tLight = out ? -9 : fr("light", 3.12), tFire = out ? -9 : fr("fire", 3.89),
    tSeg = out ? -9 : fr("in.", 4.73, "end") + 0.35;   // v6: metin "fire stayed in." ile biter (segmentasyon cümlesi çıktı)
  const T = out ? 99 : t;
  // çubuklar: düşeyler üstten (kademe 2 kare), yataylar sırayla soldan/sağdan kayar; ağır kalkış, uzun oturuş
  L.vbars.forEach((m, i) => { const k = eo(seg(T, tBec + i * 0.05, tBec + i * 0.05 + 0.55)); m.position.set(m.userData.x, GY + lerp(0.26, 0, k), -0.03); });
  L.hbars.forEach((m, i) => { const a = tBec + 0.25 + i * 0.035; const k = eo(seg(T, a, a + 0.55)); const sd = i % 2 ? 1 : -1;
    m.position.set(lerp(sd * 0.2, 0, k), m.userData.y, -0.031); });
  // ışık: tek açıklıkta alev parlak; ızgara oturunca "light got out" ile arka ışık + bloom + hale açılır
  const lightOut = ss(seg(T, tLight - 0.2, tLight + 0.9));
  const fireUp = eo(seg(T, tFire, tFire + 0.35)) * (1 - eio(seg(T, tFire + 0.35, tFire + 1.4)));
  const dim = out ? 1 - ss(seg(t, 0.25, 1.9)) : 1;
  const flick = 1 + 0.05 * Math.sin(t * 10.7) + 0.03 * Math.sin(t * 16.3 + 2);
  S.U.uLit.value = (0.7 + 0.6 * lightOut) * dim * ss(seg(t, 0, out ? 0 : 0.6)) * flick;
  L.flame.scale.set(1 + 0.25 * fireUp, (1 + 0.35 * fireUp) * flick * Math.max(0.05, dim), 1);
  glowI(L.flame, 2.4 * dim);
  glowI(L.inner, (0.35 + 1.1 * lightOut) * dim);
  (L.halo.userData.set as (k: number) => void)(0.18 * lightOut * dim);
  // kamera: yakın planda tek açıklık → "segmentation" ile geri çekilip lambayı gösterir (pull-back reveal, ağır ease-out)
  const back = out ? 1 : eo(seg(T, tSeg - 0.3, tSeg + 2.6));
  const cz = lerp(0.24, 0.92, back), cy = lerp(GY + 0.005, 0.07, back);
  aim(camera, [0, cy, cz, 0, cy, -0.05], t, { fov: 30 });
  setPost({ strength: (0.3 + 0.35 * lightOut) * dim, radius: 0.6, threshold: 0.95 }, { vig: 0.5, warm: 0.04, fade: (out ? 1 : ss(seg(t, 0, 0.3))) * (0.15 + 0.85 * dim) });
  return null;
};

export const LanternDavy: React.FC<{ durationInFrames?: number; words?: Word[]; shot?: Shot }> = ({ words, shot = "mesh" }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const fr = (p: string, s: number, e: "start" | "end" = "start") => wordFrame(words, p, fps, s, e) / fps;
  return (
    <AbsoluteFill style={{ backgroundColor: "#040303" }}>
      <ThreeCanvas width={width} height={height} camera={{ fov: 30, near: 0.01, far: 30, position: [0, 0, 0.9] }} gl={{ antialias: true }}>
        {shot === "mesh" ? <MeshScene t={frame / fps} fr={fr} width={width} height={height} />
          : <GridScene t={frame / fps} fr={fr} width={width} height={height} out={shot === "out"} />}
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
void ei;
