// EP014 v7: tel örgü ısı mekanizması, KÂĞIT FENER gramerinde (kullanıcı: "aynı stilde daha ayrıntılı anlatacaksın zannetmiştim"; v6 MeshHeat'in
// parlak 2D görünümü istenmedi). v6'nın mekanizma ayrıntısı ve anlatım senkronu korunur, her şey kesik kâğıt katman + arkadan ışıktır:
//   tel kesitleri = kâğıttan kesilmiş yuvarlaklar (15), çözgü = dalgalı kâğıt şerit (arka/ön iki yaprak), alev = üç derinlikte kesik kâğıt diller
//   (koyu kırmızı arka → turuncu → sarı ön; arkadan aydınlık, eksende uzayıp kısalarak titrer, morph yok), ısı = telin arkasındaki ışığın rengi/
//   yoğunluğu telden tele yayılır (beyaz-sarı → turuncu → kırmızı), ısı okları kesik kâğıt oklar, gaz = soğuk mavi ince kâğıt şeritler sağdan sola,
//   dış taraf soğuk mavi kâğıt katmanı. Kamera "outside" ile dışa kayar. shot "calm" (s09): geniş plan, solda alev / tel önde / sağda gaz, söner.
// Kit: ./kit (useLantern, aim, tint, PAPER) + ./paper (sheet, skyPanel). Kılavuz: .studio/plugin/skills/remotion-styles/paper-lantern.md.
import { useMemo } from "react";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { aim, PAPER, tint, useLantern } from "./kit";
import { sheet, skyPanel } from "./paper";
import { clamp, eio, eo, lerp, seg, ss, TAU, vnoise } from "./lib";
import { wordFrame, type Word } from "../woodcut/kit";

type Ctx = CanvasRenderingContext2D;
type Shot = "mech" | "calm";
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const glowI = (m: THREE.Mesh, k: number) => { (m.material as THREE.MeshStandardMaterial).emissiveIntensity = k; };
const glowC = (m: THREE.Mesh, c: THREE.Color) => { (m.material as THREE.MeshStandardMaterial).emissive.copy(c); };

// örgü (metre): tel kesiti yarıçapı, adım, x konumu
const WX = 0.004, R = 0.0105, PITCH = 0.037, GAP = PITCH - 2 * R;
const WIRES = Array.from({ length: 15 }, (_, i) => (i - 7) * PITCH);
const GAPS = WIRES.slice(0, -1).map((y) => y + PITCH / 2);
const nearestGap = (y: number) => GAPS.reduce((b, g) => (Math.abs(g - y) < Math.abs(b - y) ? g : b), GAPS[0]);
const HEAT: [number, string][] = [[0, "#3a1408"], [0.3, "#8a1c08"], [0.5, "#d0421a"], [0.7, "#ff8a26"], [0.86, "#ffd060"], [1, "#fff2d0"]];
const heatCol = (t: number) => {
  t = clamp(t);
  for (let i = 1; i < HEAT.length; i++) if (t <= HEAT[i][0]) return new THREE.Color(HEAT[i - 1][1]).lerp(new THREE.Color(HEAT[i][1]), (t - HEAT[i - 1][0]) / (HEAT[i][0] - HEAT[i - 1][0]));
  return new THREE.Color(HEAT[HEAT.length - 1][1]);
};
/** el kesimi düzensiz kenar: çember */
const roughCircle = (x: Ctx, r: number, seed: number) => {
  x.beginPath();
  for (let i = 0; i <= 40; i++) { const a = (i / 40) * TAU, rr = r * (1 + 0.035 * (vnoise(seed + i * 0.7) - 0.5)); i ? x.lineTo(rr * Math.cos(a), rr * Math.sin(a)) : x.moveTo(rr * Math.cos(a), rr * Math.sin(a)); }
  x.closePath(); x.fill();
};
/** alev dili (+x yönüne uzanır, kök x=0): el kesimi, iki yan dalga */
const tongue = (x: Ctx, len: number, w: number, seed: number) => {
  const j = (k: number) => (vnoise(seed + k) - 0.5) * w * 0.5;
  x.beginPath(); x.moveTo(0, -w / 2);
  x.bezierCurveTo(len * 0.35, -w * 0.62 + j(1), len * 0.7, -w * 0.3 + j(2), len, j(3) * 0.4);
  x.bezierCurveTo(len * 0.72, w * 0.28 + j(4), len * 0.38, w * 0.6 + j(5), 0, w / 2);
  x.closePath(); x.fill();
};
const arrowPath = (x: Ctx) => { x.beginPath(); x.moveTo(-0.014, -0.0016); x.lineTo(0.004, -0.0016); x.lineTo(0.004, -0.0042); x.lineTo(0.014, 0); x.lineTo(0.004, 0.0042); x.lineTo(0.004, 0.0016); x.lineTo(-0.014, 0.0016); x.closePath(); x.fill(); };

type Cue = { burn: number; inside: number; metal: number; heat: number; out: number; dur: number };

const Scene: React.FC<{ t: number; c: Cue; shot: Shot; width: number; height: number }> = ({ t, c, shot, width, height }) => {
  const calm = shot === "calm";
  const { S, camera, setPost } = useLantern(width, height, {
    light: [-0.08, 0.0, -0.13], lightR: 0.16, lightCol: "#ffbf72", floor: 0.1, key: 0.9, keyCol: "#ffe6c8",
    keyPos: [-0.04, 0.42, 0.45], keyTarget: [0, 0, -0.08], amb: 0.16, ambCol: "#7f8fb0", bg: "#040303",
  });
  const L = useMemo(() => {
    const U = S.U;
    // arka: sıcak içerisi (sol) ve soğuk dışarısı (sağ) iki ayrı kâğıt panel, düzensiz birleşme
    S.add(skyPanel({ w: 1.4, h: 1.6, z: -0.2, stops: [[0, "#040303"], [0.5, "#100b08"], [1, "#040303"]], gain: 1 }));
    const warm = S.add(sheet({ U, w: 0.4, h: 0.8, x: -0.2, z: -0.16, trans: 0.85, shadow: false, draw: (x: Ctx) => { x.fillStyle = PAPER; x.fillRect(-0.2, -0.4, 0.4, 0.8); } }));
    tint(warm, "#4a2412");
    const cold = S.add(sheet({ U, w: 0.42, h: 0.8, x: 0.2, z: -0.15, trans: 0.7, draw: (x: Ctx) => {
      x.fillStyle = PAPER; x.beginPath(); x.moveTo(0.21, -0.4); x.lineTo(0.21, 0.4);
      for (let y = 0.4; y >= -0.4; y -= 0.008) x.lineTo(-0.19 + 0.006 * Math.sin(y * 70) + 0.004 * (vnoise(y * 90) - 0.5), y);
      x.closePath(); x.fill(); },
      glowDraw: (x: Ctx) => { const g = x.createLinearGradient(-0.2, 0, 0.2, 0); g.addColorStop(0, "#666"); g.addColorStop(1, "#222"); x.fillStyle = g; x.fillRect(-0.21, -0.4, 0.42, 0.8); }, glow: 0.35, glowCol: "#6fa6e0" }));
    tint(cold, "#1c3552");
    // gaz: soğuk mavi ince kâğıt şeritler (el kesimi uçlar), sağdan sola
    const gas = Array.from({ length: 90 }, (_, i) => {
      const len = 0.026 + 0.03 * hash(i * 3.3), w = 0.0022 + 0.0016 * hash(i * 5.1);
      const m = S.add(sheet({ U, w: len + 0.002, h: w * 2.5, z: -0.115 + 0.01 * hash(i * 7.7), trans: 0.6, shadow: false, recv: false,
        draw: (x: Ctx) => { x.fillStyle = PAPER; x.beginPath(); x.moveTo(-len / 2, 0); x.quadraticCurveTo(0, -w * 0.9, len / 2, -w * 0.2); x.lineTo(len / 2, w * 0.3); x.quadraticCurveTo(0, w * 0.8, -len / 2, 0); x.fill(); },
        glowDraw: (x: Ctx) => { x.fillStyle = "#fff"; x.fillRect(-len / 2, -w, len, 2 * w); }, glow: 0.6, glowCol: "#9cc8ff" }));
      tint(m, "#9cc4ea"); m.userData = { ...m.userData, y0: (hash(i * 1.9) - 0.5) * 0.5, sp: 0.03 + 0.018 * hash(i * 2.7), ph: hash(i * 4.1) };
      return m;
    });
    // alev: üç derinlik katmanı, her katmanda ayrı diller (kök solda, uç cephede)
    const LAY: { z: number; col: string; glow: string; g: number; n: number; w: number }[] = [
      { z: -0.105, col: "#7a1e0c", glow: "#ff5a1e", g: 1.2, n: 13, w: 0.028 },
      { z: -0.095, col: "#c85a1c", glow: "#ff9a3a", g: 1.8, n: 15, w: 0.022 },
      { z: -0.085, col: "#f2b04a", glow: "#ffd27a", g: 2.4, n: 16, w: 0.016 }];
    const fire = LAY.flatMap((ly, li) => Array.from({ length: ly.n }, (_, k) => {
      const len = 0.09 + 0.06 * hash(k * 3.7 + li), seed = k * 9.1 + li * 31;
      const m = S.add(sheet({ U, w: len, h: ly.w * 1.6, ax: -len / 2, ay: 0, z: ly.z, trans: 0.45, shadow: li === 2, recv: false,
        draw: (x: Ctx) => { x.fillStyle = PAPER; x.save(); x.translate(-len / 2, 0); tongue(x, len, ly.w, seed); x.restore(); },
        glowDraw: (x: Ctx) => { const g = x.createLinearGradient(-len / 2, 0, len / 2, 0); g.addColorStop(0, "#333"); g.addColorStop(1, "#fff"); x.fillStyle = g; x.save(); x.translate(-len / 2, 0); tongue(x, len, ly.w, seed); x.restore(); },
        glow: ly.g, glowCol: ly.glow }));
      tint(m, ly.col);
      m.userData = { ...m.userData, li, len, y: (k / (ly.n - 1) - 0.5) * 0.52 + (hash(k * 5.3 + li) - 0.5) * 0.018, back: 0.001 + 0.012 * hash(k * 2.2 + li) * (2.4 - li) };   // ön katmanın uçları tele değer
      return m;
    }));
    // boşluktan sızan diller (gap hizasında, kök tel solunda)
    const pokes = GAPS.filter((g) => Math.abs(g) < 0.13).map((g, i) => {
      const len = 0.03;
      const m = S.add(sheet({ U, w: len, h: GAP * 0.8, ax: -len / 2, ay: 0, x: WX - R - 0.006, y: g, z: -0.075, trans: 0.45, shadow: false, recv: false,
        draw: (x: Ctx) => { x.fillStyle = PAPER; x.save(); x.translate(-len / 2, 0); tongue(x, len, GAP * 0.7, i * 3.1); x.restore(); },
        glowDraw: (x: Ctx) => { x.fillStyle = "#fff"; x.save(); x.translate(-len / 2, 0); tongue(x, len, GAP * 0.7, i * 3.1); x.restore(); }, glow: 2.2, glowCol: "#ffb24a" }));
      tint(m, "#f2a040"); return m;
    });
    // çözgü teli: dalgalı kâğıt şerit; arka yaprak (tellerin arkasından geçen kısımlar) ve ön yaprak
    const warpDraw = (front: boolean, glow: boolean) => (x: Ctx) => {
      x.strokeStyle = glow ? "#fff" : PAPER; x.lineWidth = 0.0042; x.lineCap = "round";
      for (let i = 0; i < WIRES.length - 1; i++) {
        const ya = WIRES[i], yb = WIRES[i + 1], side = i % 2 ? 1 : -1;
        if ((side > 0) !== front) continue;
        x.beginPath(); x.moveTo(side * (R + 0.002), ya);
        x.bezierCurveTo(side * (R + 0.008), ya + PITCH * 0.35, -side * (R + 0.008), yb - PITCH * 0.35, -side * (R + 0.002), yb); x.stroke();
      }
    };
    const warpB = S.add(sheet({ U, w: 0.05, h: 0.6, x: WX, z: -0.068, trans: 0.12, draw: warpDraw(false, false), glowDraw: warpDraw(false, true), glowRes: 1, glow: 0, glowCol: "#ff7a2a" }));
    const wires = WIRES.map((y, i) => {
      const m = S.add(sheet({ U, w: 2 * R + 0.003, h: 2 * R + 0.003, x: WX, y, z: -0.062, trans: 0.12,
        draw: (x: Ctx) => { x.fillStyle = PAPER; roughCircle(x, R, i * 4.7); },
        glowDraw: (x: Ctx) => { const g = x.createRadialGradient(-R * 0.6, 0, 0, -R * 0.2, 0, R * 1.4); g.addColorStop(0, "#fff"); g.addColorStop(1, "#555"); x.fillStyle = g; roughCircle(x, R, i * 4.7); },
        glowRes: 1, glow: 0, glowCol: "#ff7a2a" }));
      tint(m, "#6e6a64"); return m;
    });
    const warpF = S.add(sheet({ U, w: 0.05, h: 0.6, x: WX, z: -0.056, trans: 0.12, draw: warpDraw(true, false), glowDraw: warpDraw(true, true), glowRes: 1, glow: 0, glowCol: "#ff7a2a" }));
    tint(warpB, "#57534e"); tint(warpF, "#625e58");
    // ısı okları: kesik kâğıt; 6 giriş (alevden tele, sağa), 10 yayılma (tel boyunca, ±y)
    const arrows = Array.from({ length: 16 }, () => {
      const m = S.add(sheet({ U, w: 0.032, h: 0.011, z: -0.05, trans: 0.3, recv: false, draw: (x: Ctx) => { x.fillStyle = PAPER; arrowPath(x); },
        glowDraw: (x: Ctx) => { x.fillStyle = "#fff"; arrowPath(x); }, glow: 0, glowCol: "#ffb060" }));
      tint(m, "#e08a3a"); return m;
    });
    // ön plan: üstte lamba şapkasının kenarı, altta kandil gövdesi (koyu, neredeyse opak) — fener çerçevesi
    const front = S.add(sheet({ U, w: 0.6, h: 0.9, z: -0.02, trans: 0.04, recv: false, draw: (x: Ctx) => {
      x.fillStyle = PAPER; x.beginPath(); x.moveTo(-0.3, 0.45); x.lineTo(-0.3, 0.212);
      for (let u = -0.3; u <= 0.301; u += 0.01) x.lineTo(u, 0.205 + 0.004 * Math.sin(u * 80)); x.lineTo(0.3, 0.45); x.closePath(); x.fill();
      x.beginPath(); x.moveTo(-0.3, -0.45); x.lineTo(-0.3, -0.215);
      for (let u = -0.3; u <= 0.301; u += 0.01) x.lineTo(u, -0.212 + 0.004 * Math.sin(u * 63 + 1)); x.lineTo(0.3, -0.45); x.closePath(); x.fill(); } }));
    tint(front, "#120c08");
    return { gas, fire, pokes, warpB, warpF, wires, arrows, cold };
  }, [S]);

  // ---- zaman eğrileri (v6 MeshHeat ile aynı senkron) ----
  const fade = calm ? 1 - ss(seg(t, c.dur - 2.9, c.dur - 1.5)) : 1;
  const reach = calm ? 1 : ss(seg(t, c.burn - 0.2, c.inside + 0.5));
  const fireOn = calm ? 1 : 0.4 + 0.6 * ss(seg(t, c.burn - 0.3, c.burn + 0.3));
  const heatUp = calm ? 0.5 : ss(seg(t, c.metal - 0.3, Math.max(c.metal + 0.3, c.heat)));
  const spread = calm ? 1 : ss(seg(t, c.metal, c.metal + 2.2));
  const cool = calm ? 0 : 0.35 * ss(seg(t, c.out, c.out + 1.6));
  const poke = calm ? 0 : ss(seg(t, c.inside - 0.1, c.inside + 0.4)) * (1 - ss(seg(t, c.metal + 0.2, c.metal + 1.3)));
  const frontX = lerp(-0.095, WX - R - 0.003, reach);
  const flick = (k: number) => 1 + 0.07 * Math.sin(t * (9 + k % 5) + k) + 0.05 * (vnoise(t * 3 + k * 1.3) - 0.5);
  // arka ışık: alevle birlikte
  S.U.uLight.value.set(frontX - 0.04, 0, -0.13);
  S.U.uLit.value = ss(seg(t, 0, 0.8)) * (0.45 + 0.4 * fireOn) * fade * flick(0);
  // alev dilleri: uç cepheye, kök geride; eksende uzayıp kısalarak titrer
  for (const m of L.fire) {
    const { li, len, y, back } = m.userData as { li: number; len: number; y: number; back: number };
    const fx = frontX - back - 0.004 * li * (1 - reach) + 0.004 * (vnoise(t * 1.7 + y * 40) - 0.5);
    const sx = Math.max(0.05, (0.75 + 0.25 * fireOn) * flick(y * 100 + li));
    m.position.set(fx - len * sx, y + 0.002 * Math.sin(t * 2 + y * 50), m.position.z);
    m.scale.set(sx, 1, 1);
    glowI(m, [0.45, 0.7, 0.95][li] * fireOn * fade * (0.9 + 0.1 * flick(y * 77)));
  }
  L.pokes.forEach((m, i) => { const s = Math.max(0.001, poke * (0.8 + 0.25 * flick(i * 13))); m.scale.set(s, 1, 1); glowI(m, 1.0 * poke * fade); });
  // gaz şeritleri: sağdan sola, telde en yakın boşluğa sapar; ateşe girince turuncu olup küçülür
  for (const [i, m] of L.gas.entries()) {
    const { y0, sp, ph } = m.userData as { y0: number; sp: number; ph: number };
    const span = 0.5, x = 0.24 - (((t * sp + ph * span) % span) + span) % span;
    const bump = Math.exp(-(((x - WX) / (R * 2.4)) ** 2));
    const y = lerp(y0, nearestGap(y0), bump);
    m.position.set(x, y, m.position.z);
    const burnK = x < frontX + 0.006 ? ss(seg(frontX + 0.006 - x, 0, 0.02)) * (fireOn > 0.5 ? 1 : 0) : 0;
    tint(m, "#" + new THREE.Color("#8fb6dc").lerp(new THREE.Color("#f29a3a"), burnK).getHexString());
    m.scale.setScalar(Math.max(0.001, 1 - burnK));
    glowI(m, (0.9 + 0.8 * burnK) * fade);
    void i;
  }
  // teller: sıcaklık alanı, telden tele yayılır; kâğıdın arkasındaki ışığın rengi + yoğunluğu
  const temp = (y: number) => clamp(heatUp * (1 - cool) * (0.5 + 0.5 * Math.exp(-((y / lerp(0.035, 0.24, spread)) ** 2))) * (0.94 + 0.06 * Math.sin(t * 6 + y * 90)));
  L.wires.forEach((m, i) => { const tm = temp(WIRES[i]); glowC(m, heatCol(tm)); glowI(m, (0.1 + 1.6 * tm ** 0.9) * fade * (tm > 0.02 ? 1 : 0)); tint(m, "#" + new THREE.Color("#6e6a64").lerp(new THREE.Color("#7a2a12"), tm).getHexString()); });
  for (const w of [L.warpB, L.warpF]) { glowC(w, heatCol(temp(0) * 0.85)); glowI(w, 1.0 * heatUp * (1 - cool) * fade);
    const u = (w.material as unknown as { userData: { u: Record<string, { value: THREE.Vector4 }> } }).userData.u; u.uGY.value.set(0, lerp(0.03, 0.22, spread), 0, 1); }
  // ısı okları
  const arrowsOn = calm ? 0 : ss(seg(t, c.metal - 0.1, c.metal + 0.4)) * (1 - 0.6 * ss(seg(t, c.out + 0.6, c.out + 1.8)));
  L.arrows.forEach((m, i) => {
    let x: number, y: number, rot: number, u: number;
    if (i < 6) { u = (t * 1.3 + i * 0.37) % 1; y = (i - 2.5) * PITCH; x = frontX - 0.03 + u * 0.02; rot = 0; }
    else { const k = i - 6, dir = k % 2 ? 1 : -1; u = (t * 0.5 + Math.floor(k / 2) * 0.2) % 1; y = dir * (0.012 + u * 0.21); x = WX + R + 0.009; rot = dir * Math.PI / 2; }
    m.position.set(x, y, -0.05); m.rotation.z = rot;
    const vis = Math.sin(Math.PI * u) * arrowsOn * fade;
    m.scale.setScalar(Math.max(0.001, vis > 0.02 ? 0.85 + 0.15 * vis : 0.001));
    glowC(m, heatCol(i < 6 ? 0.9 : Math.max(0.4, temp(y))));
    glowI(m, 1.3 * vis);
  });
  glowI(L.cold, (calm ? 0.35 : 0.25 + 0.3 * ss(seg(t, c.out, c.out + 1.2))) * fade);
  // kamera: mech: hafif itiş, "outside" ile dışa (sağa) kayar · calm: geniş, yavaş geri
  const cx = calm ? 0.0 : lerp(-0.01, 0.0, eio(seg(t, 0, 1.5))) + 0.055 * eio(seg(t, c.out - 0.2, c.out + 1.8));
  const cz = calm ? lerp(1.0, 1.06, ss(t / c.dur)) : lerp(0.86, 0.8, eio(seg(t, 0, 8))) + 0.03 * eo(seg(t, c.out, c.out + 1.8));
  aim(camera, [cx, 0, cz, cx, 0, -0.08], t, { fov: 30 });
  setPost({ strength: 0.28 + 0.15 * heatUp * (1 - cool), radius: 0.5, threshold: 1.05 }, { vig: 0.48, warm: 0.04, fade: (calm ? 1 : ss(seg(t, 0, 0.35))) * (0.1 + 0.9 * fade) });
  return null;
};

export const LanternMesh: React.FC<{ durationInFrames?: number; words?: Word[]; shot?: Shot }> = ({ words, shot = "mech" }) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const fr = (p: string, s: number) => wordFrame(words, p, fps, s) / fps;
  const c: Cue = { burn: fr("burned", 2.01), inside: fr("inside.", 2.39), metal: fr("metal", 3.16), heat: fr("heat.", 4.0), out: fr("outside,", 4.8), dur: durationInFrames / fps };
  return (
    <AbsoluteFill style={{ backgroundColor: "#040303" }}>
      <ThreeCanvas width={width} height={height} camera={{ fov: 30, near: 0.01, far: 30, position: [0, 0, 0.86] }} gl={{ antialias: true }}>
        <Scene t={frame / fps} c={c} shot={shot} width={width} height={height} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
