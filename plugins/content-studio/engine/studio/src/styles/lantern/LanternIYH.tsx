// IYH001 paper-lantern sahneleri (docs/styles/paper-lantern.md). Tek kompozisyon, props.shot ile: sea (s01) · crossing (s02) · desert (s03) · hand (s09).
// tools/woodcut_render.py sahne süresiyle render eder (props: durationInFrames, words). Sahneler arası geçiş klibin içinde (stilin kendi dili):
//   sea → crossing: ışık söner / yanar · crossing → desert: kapıdan taşan ışık beyaza açılır, çöl o ışıktan iner · hand: lamba yanar.
// Dini kural: sahabe yalnız küçük, uzak, yüzsüz silüet; Necaşi gösterilmez (yanan kapı); Peygamber ﷺ hiç.
import { useEffect, useMemo, useState } from "react";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { aim, cut, PAPER, tint, useLantern } from "./kit";
import { moon, setMoon, sheet, skyPanel } from "./paper";
import { eio, eo, lerp, seg, ss, TAU } from "./lib";
import { archPath, waves } from "./LanternSea";
import { INTER } from "../../fonts";

type Ctx = CanvasRenderingContext2D;
type Word = { text: string; startMs: number; endMs: number };
type Shot = "sea" | "crossing" | "desert" | "hand";
type U = { u: Record<string, { value: number }> };

/** kelimenin başlangıcı (sn); yoksa yedek */
const at = (words: Word[] | undefined, w: string, fb: number) => {
  const k = (words ?? []).find((x) => x.text.toLowerCase().replace(/[^a-z0-9]/g, "").startsWith(w.toLowerCase()));
  return k ? k.startMs / 1000 : fb;
};
const glowOn = (m: THREE.Mesh, k: number) => { ((m.material as THREE.Material).userData as U).u.uGlowLit.value = k; };
const flick = (t: number, a = 0.05) => 1 + a * Math.sin(7.3 * t) * Math.sin(3.1 * t);

/** lateen yelkenli (yüzsüz iki küçük silüet; kıçta kandil) — merkez gövde ortası */
const drawShip = (x: Ctx) => {
  x.fillStyle = PAPER;
  x.beginPath(); x.moveTo(-0.06, -0.035); x.quadraticCurveTo(-0.045, -0.058, 0.0, -0.058); x.quadraticCurveTo(0.045, -0.058, 0.07, -0.026);
  x.lineTo(0.05, -0.03); x.lineTo(-0.05, -0.03); x.closePath(); x.fill();
  x.fillRect(-0.004, -0.032, 0.0035, 0.1);
  x.beginPath(); x.moveTo(-0.055, 0.0); x.lineTo(0.05, 0.075); x.lineTo(0.046, 0.079); x.lineTo(-0.058, 0.004); x.closePath(); x.fill();
  x.beginPath(); x.moveTo(-0.05, 0.004); x.quadraticCurveTo(0.0, 0.0, 0.045, 0.072); x.quadraticCurveTo(0.03, 0.02, -0.002, -0.026);
  x.quadraticCurveTo(-0.03, -0.012, -0.05, 0.004); x.closePath(); x.fill();
  cut(x, () => { x.lineWidth = 0.0008; for (const k of [0.25, 0.5, 0.75]) { x.beginPath(); x.moveTo(lerp(-0.045, 0.0, k), lerp(0.004, -0.02, k)); x.lineTo(lerp(-0.002, 0.04, k), lerp(0.03, 0.068, k)); x.stroke(); } });
  x.lineWidth = 0.0007; x.strokeStyle = PAPER; x.beginPath(); x.moveTo(-0.002, 0.07); x.lineTo(0.068, -0.026); x.stroke();
  x.beginPath(); x.arc(0.022, -0.023, 0.0028, 0, TAU); x.fill(); x.fillRect(0.0195, -0.032, 0.005, 0.008);
  x.beginPath(); x.arc(-0.03, -0.024, 0.0026, 0, TAU); x.fill(); x.fillRect(-0.0325, -0.032, 0.005, 0.0075);
};
const shipGlow = (x: Ctx) => { x.fillStyle = "#fff"; x.fillRect(-0.052, -0.043, 0.006, 0.005); };

/** palmiye (gövde eğri, 6 yaprak) */
const palm = (x: Ctx, px: number, py: number, h: number, lean: number) => {
  x.lineWidth = h * 0.06; x.lineCap = "round"; x.strokeStyle = PAPER;
  x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + lean * 0.5, py + h * 0.5, px + lean, py + h); x.stroke();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI * (0.1 + 0.8 * i / 5), L = h * 0.45;
    x.beginPath(); x.moveTo(px + lean, py + h);
    x.quadraticCurveTo(px + lean + Math.cos(a) * L * 0.6, py + h + Math.sin(a) * L * 0.5 + L * 0.15, px + lean + Math.cos(a) * L, py + h + Math.sin(a) * L * 0.35 - L * 0.25);
    x.lineWidth = h * 0.05; x.stroke();
  }
};

/** kubbe + minare silüeti (uzak şehir), pencereler glowDraw'da */
const domes = (x: Ctx, x0: number, base: number, s: number) => {
  x.fillStyle = PAPER;
  x.fillRect(x0 - 0.02 * s, base, 0.04 * s, 0.018 * s);
  x.beginPath(); x.arc(x0, base + 0.018 * s, 0.017 * s, Math.PI, 0, true); x.fill();
  x.beginPath(); x.moveTo(x0 - 0.002 * s, base + 0.035 * s); x.lineTo(x0, base + 0.042 * s); x.lineTo(x0 + 0.002 * s, base + 0.035 * s); x.fill();
  x.fillRect(x0 + 0.03 * s, base, 0.005 * s, 0.05 * s);
  x.beginPath(); x.moveTo(x0 + 0.0295 * s, base + 0.05 * s); x.lineTo(x0 + 0.0325 * s, base + 0.06 * s); x.lineTo(x0 + 0.0355 * s, base + 0.05 * s); x.fill();
};
const domeWindows = (x: Ctx, x0: number, base: number, s: number) => {
  x.fillStyle = "#fff";
  for (const dx of [-0.012, -0.004, 0.004, 0.012]) { x.beginPath(); x.roundRect(x0 + dx * s - 0.0016 * s, base + 0.004 * s, 0.0032 * s, 0.008 * s, [0.0016 * s, 0.0016 * s, 0, 0]); x.fill(); }
  x.fillRect(x0 + 0.0315 * s, base + 0.035 * s, 0.002 * s, 0.004 * s);
};

/** kumul şeridi (yumuşak tepeler) */
const dune = (x: Ctx, w: number, top: number, list: [number, number, number][]) => {
  const y = (u: number) => top + list.reduce((m, [c, h, ww]) => Math.max(m, h * Math.exp(-((u - c) * (u - c)) / (ww * ww))), 0);
  x.fillStyle = PAPER; x.beginPath(); x.moveTo(-w / 2, -0.6);
  for (let u = -w / 2; u <= w / 2 + 0.001; u += 0.002) x.lineTo(u, y(u));
  x.lineTo(w / 2, -0.6); x.closePath(); x.fill();
  return y;
};

/** deve + binici (yüzsüz), sağa yürür; kandil binicinin önünde (glow) */
const camel = (x: Ctx, s: number) => {
  x.fillStyle = PAPER;
  x.beginPath(); x.ellipse(0, 0.012 * s, 0.016 * s, 0.008 * s, 0, 0, TAU); x.fill();         // gövde
  x.beginPath(); x.ellipse(-0.002 * s, 0.019 * s, 0.007 * s, 0.006 * s, 0, 0, TAU); x.fill(); // hörgüç
  x.lineWidth = 0.0035 * s; x.lineCap = "round"; x.strokeStyle = PAPER;
  x.beginPath(); x.moveTo(0.013 * s, 0.014 * s); x.quadraticCurveTo(0.02 * s, 0.012 * s, 0.022 * s, 0.026 * s); x.stroke();  // boyun
  x.beginPath(); x.ellipse(0.025 * s, 0.027 * s, 0.0045 * s, 0.0025 * s, 0.2, 0, TAU); x.fill();                             // baş
  x.lineWidth = 0.0022 * s;
  for (const lx of [-0.011, -0.006, 0.007, 0.012]) { x.beginPath(); x.moveTo(lx * s, 0.008 * s); x.lineTo(lx * s, -0.012 * s); x.stroke(); }
  x.beginPath(); x.moveTo(-0.004 * s, 0.024 * s); x.lineTo(-0.001 * s, 0.036 * s); x.lineTo(0.003 * s, 0.024 * s); x.closePath(); x.fill();  // binici gövdesi
  x.beginPath(); x.arc(-0.0005 * s, 0.039 * s, 0.0028 * s, 0, TAU); x.fill();                                                                // baş (yüzsüz)
  x.lineWidth = 0.0009 * s; x.beginPath(); x.moveTo(0.002 * s, 0.031 * s); x.lineTo(0.008 * s, 0.033 * s); x.lineTo(0.009 * s, 0.028 * s); x.stroke();  // kandil sapı
};
const camelLamp = (x: Ctx, s: number) => { x.fillStyle = "#fff"; x.beginPath(); x.arc(0.009 * s, 0.026 * s, 0.0022 * s, 0, TAU); x.fill(); };

/** açık el (avuç içi), merkez avuç ortası, yükseklik ~0.17 m */
const handPath = (x: Ctx, k = 1) => {
  x.save(); x.scale(k, k);
  x.beginPath(); x.roundRect(-0.034, -0.05, 0.068, 0.07, 0.02); x.fill();
  x.lineCap = "round";
  const fingers: [number, number, number][] = [[-0.024, 0.048, 0.1], [-0.008, 0.058, 0.03], [0.008, 0.055, -0.03], [0.023, 0.044, -0.1]];
  for (const [fx, L, a] of fingers) { x.lineWidth = 0.0175; x.beginPath(); x.moveTo(fx, 0.012); x.lineTo(fx + Math.sin(-a) * L, 0.012 + Math.cos(a) * L); x.stroke(); }
  x.lineWidth = 0.02; x.beginPath(); x.moveTo(-0.028, -0.028); x.lineTo(-0.058, 0.008); x.stroke();      // başparmak
  x.beginPath(); x.roundRect(-0.026, -0.085, 0.052, 0.045, 0.008); x.fill();                             // bilek
  x.restore();
};

// ======================================================================== s01 · gece denizi (kemer pencereden)
const Sea: React.FC<{ t: number; dur: number; w: number; h: number; words?: Word[] }> = ({ t, dur, w, h }) => {
  const { S, camera, setPost } = useLantern(w, h, { light: [0.05, 0.1, -0.13], lightR: 0.16, lightCol: "#cfdcff", floor: 0.28, key: 1.4, keyCol: "#dfe6ff",
    keyPos: [0, 0.5, 0.45], keyTarget: [0, -0.05, -0.08], amb: 0.22, ambCol: "#8ea4d8", bg: "#03050c" });
  const L = useMemo(() => {
    const U = S.U;
    S.add(skyPanel({ w: 0.9, h: 1.3, z: -0.145, y: 0.05, stops: [[0, "#02040f"], [0.55, "#0b1636"], [1, "#1d3466"]], stars: 420, seed: 4, starMinY: -0.05 }));
    const mn = S.add(moon({ x: 0.045, y: 0.115, z: -0.135, r: 0.017, gain: 1.5, halo: 7, haloGain: 0.22 }));
    const far = S.add(sheet({ U, w: 0.7, h: 0.6, z: -0.115, y: -0.27, trans: 0.85, draw: (x: Ctx) => waves(x, { w: 0.7, top: 0.27, amp: 0.002, f: 60, ph: 0.3, slits: 0 }),
      glowDraw: (x: Ctx) => { x.fillStyle = "#fff"; for (let k = 0; k < 16; k++) { const yy = 0.262 - k * 0.012, ww = 0.004 + k * 0.0011 + 0.002 * Math.sin(k * 2.3);
        x.beginPath(); x.ellipse(0.045 + 0.003 * Math.sin(k * 1.9), yy, ww / 2, 0.0009, 0, 0, TAU); x.fill(); } }, glow: 0.9, glowCol: "#ffd890" }));
    tint(far, "#2b4777");
    const mid = S.add(sheet({ U, w: 0.7, h: 0.6, z: -0.09, y: -0.31, trans: 0.55, draw: (x: Ctx) => waves(x, { w: 0.7, top: 0.25, amp: 0.006, f: 38, ph: 1.1, slits: 7 }) }));
    tint(mid, "#1c3563");
    const ship = S.add(sheet({ U, w: 0.16, h: 0.16, z: -0.075, trans: 0.12, draw: drawShip, glowDraw: shipGlow, glow: 2.4, glowCol: "#ffc670" }));
    tint(ship, "#0b1226");
    const near = S.add(sheet({ U, w: 0.7, h: 0.6, z: -0.06, y: -0.37, trans: 0.3, draw: (x: Ctx) => waves(x, { w: 0.7, top: 0.25, amp: 0.009, f: 26, ph: 2.2, slits: 6 }) }));
    tint(near, "#12244a");
    const front = S.add(sheet({ U, w: 0.7, h: 0.6, z: -0.035, y: -0.42, trans: 0.12, draw: (x: Ctx) => waves(x, { w: 0.7, top: 0.24, amp: 0.012, f: 18, ph: 0.4, slits: 5 }) }));
    tint(front, "#0a1430");
    const arch = S.add(sheet({ U, w: 0.62, h: 1.0, z: -0.005, trans: 0.04, recv: false,
      draw: (x: Ctx) => { x.fillStyle = PAPER; x.fillRect(-0.31, -0.5, 0.62, 1.0); cut(x, () => { archPath(x, 0.2, -0.2, 0.06, 0.18); x.fill(); }); } }));
    tint(arch, "#06080f");
    return { mn, far, mid, ship, near, front };
  }, [S]);
  // açılış: karanlıkta tek ışık noktası aya açılır (0-0.8 sn), deniz katmanları yanar, kandil; son 0.45 sn lamba söner (sonraki planın ışığı yanar)
  const off = 1 - ss(seg(t, dur - 0.45, dur));
  const lit = ss(seg(t, 0.15, 1.1)) * off;
  S.U.uLit.value = lit * flick(t, 0.04);
  setMoon(L.mn, ss(seg(t, 0.0, 0.8)) * off);
  glowOn(L.far, ss(seg(t, 0.6, 1.3)) * off); glowOn(L.ship, ss(seg(t, 1.6, 2.1)) * off);
  const sway = (m: THREE.Mesh, y0: number, ax: number, sp: number, ph: number) => { m.position.x = ax * Math.sin(t * sp + ph); m.position.y = y0 + 0.002 * Math.sin(t * sp * 1.3 + ph); };
  sway(L.mid, -0.31, 0.006, 0.6, 0.2); sway(L.near, -0.37, 0.009, 0.8, 1.4); sway(L.front, -0.42, 0.012, 1.0, 2.5);
  L.ship.scale.setScalar(0.42);
  L.ship.position.set(lerp(0.075, 0.0, eio(seg(t, 0.2, dur))), -0.046 + 0.0015 * Math.sin(t * 1.1), -0.075);
  L.ship.rotation.z = 0.035 * Math.sin(t * 1.1 + 0.6);
  aim(camera, [0, 0.0, lerp(0.98, 0.9, eio(seg(t, 0, dur))), 0, -0.02, -0.08], t, { fov: 30 });
  setPost({ strength: 0.32, radius: 0.5, threshold: 1.05 }, { vig: 0.4, warm: 0.02, fade: Math.max(0.0, off * 0.85 + 0.15 * off) });
  return null;
};

// ======================================================================== s02 · yolculuk ve sığınak (yanında seyahat → yanan kapıya itme)
const Crossing: React.FC<{ t: number; dur: number; w: number; h: number; words?: Word[] }> = ({ t, dur, w, h, words }) => {
  const { S, camera, setPost } = useLantern(w, h, { light: [0.2, 0.09, -0.13], lightR: 0.25, lightCol: "#cfdcff", floor: 0.3, key: 1.3, keyCol: "#dfe6ff",
    keyPos: [0.2, 0.5, 0.45], keyTarget: [0.2, -0.05, -0.08], amb: 0.22, ambCol: "#8ea4d8", bg: "#03050c" });
  const tAby = at(words, "abyssinia", 2.3), tNeg = at(words, "negus", 4.4), tShel = at(words, "shelter", 5.6);
  const L = useMemo(() => {
    const U = S.U;
    S.add(skyPanel({ w: 1.4, h: 1.3, z: -0.145, x: 0.25, y: 0.05, stops: [[0, "#02040f"], [0.55, "#0b1636"], [1, "#1d3466"]], stars: 700, seed: 9, starMinY: -0.05 }));
    const mn = S.add(moon({ x: 0.33, y: 0.13, z: -0.135, r: 0.013, gain: 1.4, halo: 6, haloGain: 0.2 }));
    const W = 1.4;
    const far = S.add(sheet({ U, w: W, h: 0.6, z: -0.115, x: 0.25, y: -0.28, trans: 0.85, draw: (x: Ctx) => waves(x, { w: W, top: 0.27, amp: 0.002, f: 60, ph: 0.3, slits: 0 }) }));
    tint(far, "#2b4777");
    // uzak kıyı (Habeşistan): yeşil tepe katmanı + palmiyeler + taş kemerli kapı (kandil ışığı glow)
    const DX = 0.52;
    const coast = S.add(sheet({ U, w: 0.5, h: 0.4, z: -0.1, x: DX, y: -0.16, trans: 0.6,
      draw: (x: Ctx) => { dune(x, 0.5, 0.11, [[-0.05, 0.05, 0.12], [0.12, 0.035, 0.08]]); palm(x, -0.12, 0.13, 0.055, 0.012); palm(x, -0.09, 0.14, 0.045, -0.01); palm(x, 0.17, 0.13, 0.05, 0.01); } }));
    tint(coast, "#1d3d4a");
    const door = S.add(sheet({ U, w: 0.12, h: 0.12, z: -0.095, x: DX + 0.02, y: -0.02, trans: 0.1,
      draw: (x: Ctx) => { x.fillStyle = PAPER; x.fillRect(-0.045, -0.06, 0.09, 0.085); x.beginPath(); x.arc(0, 0.025, 0.045, Math.PI, 0, true); x.fill();
        cut(x, () => { archPath(x, 0.034, -0.06, -0.012, 0.035); x.fill(); });
        cut(x, () => { x.lineWidth = 0.0009; for (let r = 0; r < 5; r++) { x.beginPath(); x.moveTo(-0.045, -0.045 + r * 0.017); x.lineTo(-0.024, -0.045 + r * 0.017); x.stroke(); x.beginPath(); x.moveTo(0.024, -0.045 + r * 0.017); x.lineTo(0.045, -0.045 + r * 0.017); x.stroke(); } }); },
      glowDraw: (x: Ctx) => { x.fillStyle = "#fff"; archPath(x, 0.034, -0.06, -0.012, 0.035); x.fill(); }, glow: 2.2, glowCol: "#ffc670", glowRes: 1 }));
    tint(door, "#2a2620");
    // kapının ardındaki sıcak ışık (sığınak): delikten görünen yanan kâğıt
    const doorLight = S.add(sheet({ U, w: 0.05, h: 0.1, z: -0.0965, x: DX + 0.02, y: -0.02, trans: 0.9, shadow: false,
      draw: (x: Ctx) => { x.fillStyle = PAPER; archPath(x, 0.036, -0.062, -0.012, 0.037); x.fill(); },
      glowDraw: (x: Ctx) => { x.fillStyle = "#fff"; archPath(x, 0.036, -0.062, -0.012, 0.037); x.fill(); }, glow: 2.6, glowCol: "#ffcf86", glowRes: 1 }));
    tint(doorLight, "#3a2a18");
    const mid = S.add(sheet({ U, w: W, h: 0.6, z: -0.085, x: 0.25, y: -0.31, trans: 0.55, draw: (x: Ctx) => waves(x, { w: W, top: 0.25, amp: 0.006, f: 38, ph: 1.1, slits: 14 }) }));
    tint(mid, "#1c3563");
    const ship = S.add(sheet({ U, w: 0.16, h: 0.16, z: -0.072, trans: 0.12, draw: drawShip, glowDraw: shipGlow, glow: 2.4, glowCol: "#ffc670" }));
    tint(ship, "#0b1226");
    const near = S.add(sheet({ U, w: W, h: 0.6, z: -0.055, x: 0.25, y: -0.37, trans: 0.3, draw: (x: Ctx) => waves(x, { w: W, top: 0.25, amp: 0.009, f: 26, ph: 2.2, slits: 12 }) }));
    tint(near, "#12244a");
    const front = S.add(sheet({ U, w: W, h: 0.6, z: -0.03, x: 0.25, y: -0.43, trans: 0.12, draw: (x: Ctx) => waves(x, { w: W, top: 0.24, amp: 0.012, f: 18, ph: 0.4, slits: 10 }) }));
    tint(front, "#0a1430");
    return { mn, far, coast, door, doorLight, mid, ship, near, front, DX };
  }, [S]);
  // ışık yanar (önceki plan söndü); gemi kıyıya yol alır; "Negus" ile kapı yanar, "shelter" ile kamera kapıya iter ve ışık kadrajı doldurur
  const lit = ss(seg(t, 0.0, 0.6));
  S.U.uLit.value = lit * flick(t, 0.04);
  setMoon(L.mn, lit);
  glowOn(L.ship, ss(seg(t, 0.3, 0.8)));
  const doorK = ss(seg(t, tNeg - 0.1, tNeg + 0.7));
  glowOn(L.door, doorK); glowOn(L.doorLight, doorK * flick(t, 0.07));
  (L.doorLight.material as THREE.MeshStandardMaterial).emissiveIntensity = 2.6 * (1 + 3 * ss(seg(t, tShel, dur)));
  (L.door.material as THREE.MeshStandardMaterial).emissiveIntensity = 2.2 * (1 + 2.5 * ss(seg(t, tShel, dur))) * flick(t, 0.06);
  const travel = eio(seg(t, 0.0, tAby + 1.2));
  const camX = lerp(0.0, L.DX - 0.06, travel);
  const shipX = lerp(0.0, L.DX - 0.12, eio(seg(t, 0.0, tNeg + 0.6)));
  L.ship.scale.setScalar(0.7);
  L.ship.position.set(shipX, -0.05 + 0.002 * Math.sin(t * 1.3), -0.072);
  L.ship.rotation.z = 0.04 * Math.sin(t * 1.3 + 0.5);
  // derinlik = mesafe: katmanlar kamerayla paralaks (ön katman ters akar)
  L.front.position.x = 0.25 - camX * 0.25 + 0.012 * Math.sin(t * 1.0);
  L.near.position.x = 0.25 - camX * 0.12 + 0.009 * Math.sin(t * 0.8 + 1.4);
  L.mid.position.x = 0.25 + 0.006 * Math.sin(t * 0.6);
  const push = eio(seg(t, tShel - 0.3, dur));
  const cx = lerp(camX, L.DX + 0.02, push), cy = lerp(0.0, -0.025, push), cz = lerp(0.92, 0.28, push);
  aim(camera, [cx, cy, cz, lerp(camX, L.DX + 0.02, push), lerp(-0.02, -0.03, push), -0.095], t, { fov: 30 });
  const white = ss(seg(t, dur - 0.7, dur));
  setPost({ strength: 0.32 + 0.9 * white, radius: 0.55, threshold: lerp(1.05, 0.4, white) }, { vig: 0.4 - 0.25 * white, warm: 0.02 + 0.1 * white, expo: 1 + 2.2 * white });
  return null;
};

// ======================================================================== s03 · çöl, kandilli kervan (ışıktan iner)
const Desert: React.FC<{ t: number; dur: number; w: number; h: number; words?: Word[] }> = ({ t, dur, w, h, words }) => {
  const { S, camera, setPost } = useLantern(w, h, { light: [0.0, 0.03, -0.13], lightR: 0.2, lightCol: "#ffd9a0", floor: 0.35, key: 1.6, keyCol: "#ffe6c8",
    keyPos: [0, 0.5, 0.45], keyTarget: [0, -0.05, -0.08], amb: 0.3, ambCol: "#d8a888", bg: "#140805" });
  const tDes = at(words, "deserts", 0.86), tCar = at(words, "carrying", 2.7), tFai = at(words, "islam", 3.17), tDis = at(words, "distant", 3.7);
  const L = useMemo(() => {
    const U = S.U, W = 1.2;
    S.add(skyPanel({ w: 1.4, h: 1.3, z: -0.145, y: 0.0, stops: [[0, "#e9a76c"], [0.45, "#f2c98e"], [0.75, "#c9806a"], [1, "#5a3550"]], stars: 30, seed: 3, starMinY: 0.22 }));
    const sun = S.add(moon({ x: -0.02, y: 0.02, z: -0.138, r: 0.03, core: "#fff2d6", mid: "#ffd79a", edge: "#ffb870", gain: 1.6, halo: 6, haloCol: "#ffb070", haloGain: 0.35 }));
    // uzak şehir (kubbe + minare), pencereleri "distant" ile yanar
    const city = S.add(sheet({ U, w: W, h: 0.4, z: -0.125, y: -0.2, trans: 0.85,
      draw: (x: Ctx) => { dune(x, W, 0.17, [[0, 0.005, 0.4]]); domes(x, 0.1, 0.17, 0.7); domes(x, -0.16, 0.172, 0.55); domes(x, 0.24, 0.17, 0.5); },
      glowDraw: (x: Ctx) => { domeWindows(x, 0.1, 0.17, 0.7); domeWindows(x, -0.16, 0.172, 0.55); domeWindows(x, 0.24, 0.17, 0.5); }, glow: 1.8, glowCol: "#ffc670", glowRes: 1 }));
    tint(city, "#d79a74");
    const d1 = S.add(sheet({ U, w: W, h: 0.6, z: -0.11, y: -0.33, trans: 0.75, draw: (x: Ctx) => { dune(x, W, 0.29, [[-0.2, 0.03, 0.12], [0.15, 0.025, 0.15], [0.42, 0.03, 0.1]]); } }));
    tint(d1, "#c88a5a");
    // kervanın sırtı (orta kumul) + 6 deve ayrı katman (yürürken her biri kendi adımında sallanır)
    const ridgeY = (u: number) => 0.255 + 0.02 * Math.exp(-((u + 0.02) * (u + 0.02)) / (0.16 * 0.16));
    const d2 = S.add(sheet({ U, w: W, h: 0.6, z: -0.09, y: -0.3, trans: 0.45, draw: (x: Ctx) => { x.fillStyle = PAPER; x.beginPath(); x.moveTo(-W / 2, -0.6);
      for (let u = -W / 2; u <= W / 2 + 0.001; u += 0.002) x.lineTo(u, ridgeY(u)); x.lineTo(W / 2, -0.6); x.closePath(); x.fill(); } }));
    tint(d2, "#9a5a34");
    const camels = Array.from({ length: 6 }, (_, i) => {
      const m = S.add(sheet({ U, w: 0.08, h: 0.08, z: -0.091 + 0.0001 * i, trans: 0.08, ax: 0, ay: -0.02, draw: (x: Ctx) => camel(x, 0.9), glowDraw: (x: Ctx) => camelLamp(x, 0.9), glow: 2.6, glowCol: "#ffcf7a", glowRes: 1 }));
      tint(m, "#2a140a"); return m;
    });
    const d3 = S.add(sheet({ U, w: W, h: 0.6, z: -0.065, y: -0.38, trans: 0.25, draw: (x: Ctx) => { dune(x, W, 0.25, [[-0.25, 0.04, 0.14], [0.1, 0.03, 0.12], [0.38, 0.045, 0.13]]); } }));
    tint(d3, "#6a3420");
    // savrulan kum: ince yarı saydam kâğıt şeritler (kumdan açık), söylenen kelimede yatay kayar
    const streaks = [0, 1, 2].map((i) => { const m = S.add(sheet({ U, w: 0.5, h: 0.05, z: -0.06 + 0.004 * i, trans: 0.6, shadow: false, recv: false,
      draw: (x: Ctx) => { x.fillStyle = PAPER; for (let k = 0; k < 7; k++) { x.beginPath(); x.ellipse(-0.2 + k * 0.065, 0.008 * Math.sin(k * 2.1 + i), 0.04, 0.0016, 0.04, 0, TAU); x.fill(); } } }));
      tint(m, "#f0c890"); m.position.y = -0.03 - 0.025 * i; return m; });
    const d4 = S.add(sheet({ U, w: W, h: 0.6, z: -0.035, y: -0.43, trans: 0.06, draw: (x: Ctx) => { dune(x, W, 0.22, [[-0.15, 0.05, 0.16], [0.3, 0.04, 0.14]]); } }));
    tint(d4, "#24100a");
    return { sun, city, d1, d2, d3, d4, camels, streaks, ridgeY };
  }, [S]);
  // önceki planın beyaz ışığından iner (expo 3.2 → 1)
  const fromWhite = 1 - ss(seg(t, 0.0, 0.9));
  S.U.uLit.value = flick(t, 0.03);
  setMoon(L.sun, 1);
  glowOn(L.city, ss(seg(t, tDis, tDis + 0.9)));
  // kervan sırt boyunca sağa yürür; kandiller "carrying" ile sırayla yanar
  L.camels.forEach((m, i) => {
    const u = -0.2 + i * 0.045 + 0.05 * t / dur * 2;
    const ph = t * 4.2 + i * 1.3;
    m.position.set(u, -0.3 + L.ridgeY(u) - 0.001 + 0.0012 * Math.abs(Math.sin(ph)), -0.091 + 0.0001 * i);
    m.rotation.z = 0.03 * Math.sin(ph);
    m.scale.setScalar(0.6);
    glowOn(m, ss(seg(t, tCar + i * 0.12, tCar + i * 0.12 + 0.4)) * flick(t + i, 0.08));
  });
  // kum şeritleri: "deserts" ve "distant"ta soldan sağa savrulur
  L.streaks.forEach((m, i) => {
    const g1 = seg(t, tDes - 0.3 + i * 0.12, tDes + 1.4 + i * 0.12), g2 = seg(t, tDis - 0.4 + i * 0.1, tDis + 1.3 + i * 0.1);
    const g = g1 > 0 && g1 < 1 ? g1 : g2;
    m.position.x = lerp(-0.6, 0.6, eo(g));
    ((m.material as THREE.MeshStandardMaterial).opacity) = 1;
    m.visible = g > 0 && g < 1;
  });
  // derinlik paralaksı: kamera yavaşça sağa, katmanlar derinlikle orantılı
  const camX = lerp(-0.02, 0.05, eio(seg(t, 0, dur)));
  L.d4.position.x = -camX * 0.3; L.d3.position.x = -camX * 0.15;
  aim(camera, [camX, lerp(0.01, -0.005, eio(seg(t, 0, dur))), 0.9, camX, -0.02, -0.08], t, { fov: 30 });
  setPost({ strength: 0.3 + 1.0 * fromWhite, radius: 0.55, threshold: lerp(1.05, 0.4, fromWhite) }, { vig: 0.38, warm: 0.04, expo: 1 + 2.2 * fromWhite });
  return null;
};

// ======================================================================== s09 · avuç: elin biçiminde pencereden dünya, lamba yanar, kâğıt yazı
const Hand: React.FC<{ t: number; dur: number; w: number; h: number; words?: Word[] }> = ({ t, dur, w, h, words }) => {
  const { S, camera, setPost } = useLantern(w, h, { light: [0.0, 0.06, -0.13], lightR: 0.12, lightCol: "#ffd9a0", floor: 0.18, key: 1.2, keyCol: "#fff0dc",
    keyPos: [0, 0.5, 0.45], keyTarget: [0, -0.05, -0.08], amb: 0.25, ambCol: "#9fc8b8", bg: "#020806" });
  const tHand = at(words, "hand", 0.4), tLife = at(words, "life", 1.65), tGive = at(words, "give", 2.62), tUrl = at(words, "inyourhand", 2.87);
  const L = useMemo(() => {
    const U = S.U;
    S.add(skyPanel({ w: 0.9, h: 1.3, z: -0.145, y: 0.05, stops: [[0, "#0b2a20"], [0.42, "#2f7a5c"], [0.52, "#4f9a78"], [1, "#0e3a2c"]], stars: 260, seed: 12, starMinY: 0.06 }));
    const hm = S.add(moon({ x: 0.012, y: 0.085, z: -0.14, r: 0.011, gain: 1.4, halo: 7, haloGain: 0.25 }));
    const far = S.add(sheet({ U, w: 0.7, h: 0.5, z: -0.12, y: -0.18, trans: 0.85,
      draw: (x: Ctx) => { dune(x, 0.7, 0.2, [[-0.1, 0.015, 0.1], [0.1, 0.012, 0.12]]); domes(x, -0.03, 0.205, 0.55); domes(x, 0.06, 0.2, 0.45); domes(x, -0.1, 0.2, 0.4); },
      glowDraw: (x: Ctx) => { domeWindows(x, -0.03, 0.205, 0.55); domeWindows(x, 0.06, 0.2, 0.45); domeWindows(x, -0.1, 0.2, 0.4); }, glow: 2.0, glowCol: "#ffc670", glowRes: 1 }));
    tint(far, "#2c7a5c");
    const mid = S.add(sheet({ U, w: 0.7, h: 0.5, z: -0.1, y: -0.24, trans: 0.5,
      draw: (x: Ctx) => { dune(x, 0.7, 0.2, [[-0.06, 0.02, 0.12], [0.12, 0.016, 0.1]]); palm(x, -0.07, 0.205, 0.035, 0.008); palm(x, 0.1, 0.205, 0.03, -0.006); } }));
    tint(mid, "#16503c");
    // ön levha: koyu yeşil, açık el biçiminde pencere; kenarında ince yanan çizgi
    const front = S.add(sheet({ U, w: 0.62, h: 1.0, z: -0.02, trans: 0.04, recv: false,
      draw: (x: Ctx) => { x.fillStyle = PAPER; x.fillRect(-0.31, -0.5, 0.62, 1.0); cut(x, () => { x.save(); x.translate(0, 0.05); x.fillStyle = "#000"; x.strokeStyle = "#000"; handPath(x, 1.0); x.restore(); }); },
      glowDraw: (x: Ctx) => { x.save(); x.translate(0, 0.05); x.fillStyle = "#fff"; x.strokeStyle = "#fff"; handPath(x, 1.06); x.restore();
        x.save(); x.translate(0, 0.05); x.globalCompositeOperation = "destination-out"; handPath(x, 1.0); x.restore(); }, glow: 2.4, glowCol: "#ffc670", glowRes: 1 }));
    tint(front, "#03120c");
    // kâğıt yazılar (sol kenardan büyür): logo yeşil, slogan krem, site krem
    const strip = (txt: string, size: number, color: string, weight: string, ww: number, y: number) => {
      const m = S.add(sheet({ U, w: ww, h: size * 1.6, z: -0.012, x: -ww / 2, y, ax: 0, ay: 0, trans: 0.1, shadow: false, recv: false,
        draw: (x: Ctx) => { x.save(); x.translate(-ww / 2 + 0.004, 0); x.scale(0.001, -0.001); x.font = `${weight} ${size * 1000}px ${INTER}`;
          x.textAlign = "left"; x.textBaseline = "middle"; x.fillStyle = color; x.fillText(txt, 0, 0); x.restore(); }, finish: { rim: 0, under: 0 } }));
      (m.material as THREE.MeshStandardMaterial).color.set("#ffffff"); m.geometry.translate(ww / 2, 0, 0); m.position.x = -ww / 2; return m;
    };
    const logo = strip("in your hand", 0.024, "#2fbf8a", "800", 0.2, -0.085);
    const tag = strip("Be the hand that changes a life.", 0.0105, "#f4e9d4", "500", 0.22, -0.118);
    const url = strip("inyourhand.org", 0.012, "#f4e9d4", "800", 0.12, -0.143);
    return { far, mid, front, logo, tag, url, hm };
  }, [S]);
  // lamba yanar: kaynak → katmanlar → el kenarı ışığı ("hand") → köy pencereleri ("life") → yazılar sırayla yazılır
  const lit = ss(seg(t, 0.0, 0.7));
  S.U.uLit.value = lit * flick(t, 0.04);
  glowOn(L.front, ss(seg(t, tHand - 0.1, tHand + 0.6)));
  setMoon(L.hm, lit);
  glowOn(L.far, ss(seg(t, tLife - 0.3, tLife + 0.9)));
  const grow = (m: THREE.Mesh, a: number) => { const k = ss(seg(t, a, a + 0.55)); m.scale.set(Math.max(0.0001, k), 1, 1); m.visible = k > 0.001; };
  grow(L.logo, tHand + 0.1); grow(L.tag, tLife + 0.15); grow(L.url, tUrl - 0.05);
  void tGive;
  aim(camera, [0, lerp(0.0, -0.01, eio(seg(t, 0, dur))), lerp(0.95, 0.85, eio(seg(t, 0, dur))), 0, -0.02, -0.08], t, { fov: 30 });
  setPost({ strength: 0.35, radius: 0.55, threshold: 1.0 }, { vig: 0.42, warm: 0.02, fade: ss(seg(t, 0, 0.35)) });
  return null;
};

const SHOTS: Record<Shot, React.FC<{ t: number; dur: number; w: number; h: number; words?: Word[] }>> = { sea: Sea, crossing: Crossing, desert: Desert, hand: Hand };

export const LanternIYH: React.FC<{ shot?: Shot; words?: Word[]; durationInFrames?: number }> = ({ shot = "sea", words }) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const [handle] = useState(() => delayRender("lantern fonts"));
  const [ready, setReady] = useState(false);
  useEffect(() => { Promise.all([document.fonts.load(`800 40px ${INTER}`), document.fonts.load(`500 40px ${INTER}`)]).then(() => { setReady(true); continueRender(handle); }); }, [handle]);
  const Comp = SHOTS[shot];
  return (
    <AbsoluteFill style={{ backgroundColor: "#03050c" }}>
      {ready && (
        <ThreeCanvas width={width} height={height} camera={{ fov: 30, near: 0.01, far: 30, position: [0, 0, 1] }} gl={{ antialias: true }}>
          <Comp t={frame / fps} dur={durationInFrames / fps} w={width} h={height} words={words} />
        </ThreeCanvas>
      )}
    </AbsoluteFill>
  );
};
