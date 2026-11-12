// paper-lantern deneme: gece denizi (IYH001 s01 adayı). Kemer pencereden bakılan kâğıt kutu: gök + yıldız, kâğıt ay, ay yolu (kâğıttan yanan
// yansıma), dört dalga katmanı, kandilli yelkenli (lateen yelken), en önde girih yıldız kesikli sivri kemer. Işık açılışı: kaynak → uzak katmanlar → kandil.
// Render: npx remotion render src/index.ts LanternSea out/lantern-sea.mp4
import { useMemo } from "react";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { aim, cut, PAPER, tint, useLantern } from "./kit";
import { moon, setMoon, sheet, skyPanel } from "./paper";
import { clamp, eio, lerp, seg, ss, TAU } from "./lib";

type Ctx = CanvasRenderingContext2D;

/** dalga şeridi: üst kenar dalgalı, altında köpük yarıkları (kesik) */
export const waves = (x: Ctx, o: { w: number; top: number; amp: number; f: number; ph: number; slits?: number }) => {
  const { w, top, amp, f, ph } = o;
  const y = (u: number) => top + amp * Math.sin(u * f + ph) + amp * 0.35 * Math.sin(u * f * 2.3 + ph * 1.7);
  x.fillStyle = PAPER; x.beginPath(); x.moveTo(-w / 2, -0.6);
  for (let u = -w / 2; u <= w / 2 + 0.001; u += 0.002) x.lineTo(u, y(u));
  x.lineTo(w / 2, -0.6); x.closePath(); x.fill();
  cut(x, () => {
    x.lineWidth = 0.0011; x.lineCap = "round";
    for (let k = 0; k < (o.slits ?? 6); k++) {
      const c = -w / 2 + (k + 0.5) * (w / (o.slits ?? 6)) + 0.01 * Math.sin(k * 3.1);
      const L = 0.02 + 0.012 * Math.abs(Math.sin(k * 1.7));
      x.beginPath();
      for (let u = c - L; u <= c + L; u += 0.002) { const yy = y(u) - 0.009 - 0.002 * Math.sin(k); u === c - L ? x.moveTo(u, yy) : x.lineTo(u, yy); }
      x.stroke();
    }
  });
};

/** sekiz kollu yıldız (iki üst üste kare) */
const star8 = (x: Ctx, cx: number, cy: number, r: number) => {
  for (const a0 of [0, Math.PI / 4]) {
    x.beginPath();
    for (let i = 0; i < 4; i++) { const a = a0 + i * Math.PI / 2; x.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a)); }
    x.closePath(); x.fill();
  }
};

/** sivri (İslam) kemer yolu: genişlik w, ayak yBase→ySpring, tepe yApex (iki bezier, tepede sivri) */
export const archPath = (x: Ctx, w: number, yBase: number, ySpring: number, yApex: number) => {
  const hw = w / 2, rise = yApex - ySpring;
  x.beginPath(); x.moveTo(-hw, yBase); x.lineTo(-hw, ySpring);
  x.bezierCurveTo(-hw, ySpring + rise * 0.62, -hw * 0.38, yApex - rise * 0.12, 0, yApex);
  x.bezierCurveTo(hw * 0.38, yApex - rise * 0.12, hw, ySpring + rise * 0.62, hw, ySpring);
  x.lineTo(hw, yBase); x.closePath();
  return yApex;
};

const Scene: React.FC<{ t: number; width: number; height: number }> = ({ t, width, height }) => {
  const { S, camera, setPost } = useLantern(width, height, {
    light: [0.05, 0.1, -0.13], lightR: 0.16, lightCol: "#cfdcff", floor: 0.28, key: 1.4, keyCol: "#dfe6ff",
    keyPos: [0, 0.5, 0.45], keyTarget: [0, -0.05, -0.08], amb: 0.22, ambCol: "#8ea4d8", bg: "#03050c",
  });
  const L = useMemo(() => {
    const U = S.U;
    const sky = S.add(skyPanel({ w: 0.9, h: 1.3, z: -0.145, y: 0.05, stops: [[0, "#02040f"], [0.55, "#0b1636"], [1, "#1d3466"]], stars: 420, seed: 4, starMinY: -0.05 }));
    const mn = S.add(moon({ x: 0.045, y: 0.115, z: -0.135, r: 0.017, gain: 1.5, halo: 7, haloGain: 0.22 }));
    // uzak deniz + ay yolu (parlayan kırık şeritler)
    const far = S.add(sheet({ U, w: 0.7, h: 0.6, z: -0.115, y: -0.27, trans: 0.85,
      draw: (x: Ctx) => waves(x, { w: 0.7, top: 0.27, amp: 0.002, f: 60, ph: 0.3, slits: 0 }),
      glowDraw: (x: Ctx) => { x.fillStyle = "#fff";
        for (let k = 0; k < 16; k++) { const yy = 0.262 - k * 0.012; const ww = 0.004 + k * 0.0011 + 0.002 * Math.sin(k * 2.3);
          x.beginPath(); x.ellipse(0.045 + 0.003 * Math.sin(k * 1.9), yy, ww / 2, 0.0009, 0, 0, TAU); x.fill(); } },
      glow: 0.9, glowCol: "#ffd890" }));
    tint(far, "#2b4777");
    const mid = S.add(sheet({ U, w: 0.7, h: 0.6, z: -0.09, y: -0.31, trans: 0.55, draw: (x: Ctx) => waves(x, { w: 0.7, top: 0.25, amp: 0.006, f: 38, ph: 1.1, slits: 7 }) }));
    tint(mid, "#1c3563");
    // yelkenli: gövde + direk + lateen yelken (iki kat), kıçta kandil penceresi
    const ship = S.add(sheet({ U, w: 0.16, h: 0.16, z: -0.075, ax: 0, ay: -0.05, trans: 0.12,
      draw: (x: Ctx) => {
        x.fillStyle = PAPER;
        x.beginPath(); x.moveTo(-0.06, -0.035); x.quadraticCurveTo(-0.045, -0.058, 0.0, -0.058); x.quadraticCurveTo(0.045, -0.058, 0.07, -0.026);
        x.lineTo(0.05, -0.03); x.lineTo(-0.05, -0.03); x.closePath(); x.fill();   // gövde (kıç yüksek, pruva sivri)
        x.fillRect(-0.004, -0.032, 0.0035, 0.1);                                    // direk
        x.beginPath(); x.moveTo(-0.055, 0.0); x.lineTo(0.05, 0.075); x.lineTo(0.046, 0.079); x.lineTo(-0.058, 0.004); x.closePath(); x.fill();   // seren
        x.beginPath(); x.moveTo(-0.05, 0.004); x.quadraticCurveTo(0.0, 0.0, 0.045, 0.072); x.quadraticCurveTo(0.03, 0.02, -0.002, -0.026);
        x.quadraticCurveTo(-0.03, -0.012, -0.05, 0.004); x.closePath(); x.fill();   // yelken
        cut(x, () => { x.lineWidth = 0.0008; for (const k of [0.25, 0.5, 0.75]) { x.beginPath(); x.moveTo(lerp(-0.045, 0.0, k), lerp(0.004, -0.02, k)); x.lineTo(lerp(-0.002, 0.04, k), lerp(0.03, 0.068, k)); x.stroke(); } });
        x.lineWidth = 0.0007; x.strokeStyle = PAPER; x.beginPath(); x.moveTo(-0.002, 0.07); x.lineTo(0.068, -0.026); x.stroke();   // halat
        // güvertede iki küçük, yüzsüz silüet
        x.beginPath(); x.arc(0.022, -0.023, 0.0028, 0, TAU); x.fill(); x.fillRect(0.0195, -0.032, 0.005, 0.008);
        x.beginPath(); x.arc(-0.03, -0.024, 0.0026, 0, TAU); x.fill(); x.fillRect(-0.0325, -0.032, 0.005, 0.0075);
      },
      glowDraw: (x: Ctx) => { x.fillStyle = "#fff"; x.fillRect(-0.052, -0.043, 0.006, 0.005); }, glow: 2.4, glowCol: "#ffc670" }));
    tint(ship, "#0b1226");
    const near = S.add(sheet({ U, w: 0.7, h: 0.6, z: -0.06, y: -0.37, trans: 0.3, draw: (x: Ctx) => waves(x, { w: 0.7, top: 0.25, amp: 0.009, f: 26, ph: 2.2, slits: 6 }) }));
    tint(near, "#12244a");
    const front = S.add(sheet({ U, w: 0.7, h: 0.6, z: -0.035, y: -0.42, trans: 0.12, draw: (x: Ctx) => waves(x, { w: 0.7, top: 0.24, amp: 0.012, f: 18, ph: 0.4, slits: 5 }) }));
    tint(front, "#0a1430");
    // ön kemer: koyu levha, sivri kemer penceresi + kenar bandında sekiz kollu yıldız kesikleri
    const arch = S.add(sheet({ U, w: 0.62, h: 1.0, z: -0.005, trans: 0.04, shadow: true, recv: false,
      draw: (x: Ctx) => {
        x.fillStyle = PAPER; x.fillRect(-0.31, -0.5, 0.62, 1.0);
        cut(x, () => { archPath(x, 0.2, -0.2, 0.06, 0.18); x.fill(); });
      },
      glow: 0.0 }));   // kenar yıldızları kaldırıldı (kullanıcı 2026-11-10: "olmasına gerek yok")
    tint(arch, "#06080f");
    return { sky, mn, far, mid, ship, near, front, arch };
  }, [S]);

  // ışık açılışı: kaynak 0-1.2 sn, katmanlar 0.4 sn aralıkla, kandil 2.4 sn, kemer yıldızları 3.0 sn; titreşim
  const lit = ss(seg(t, 0.2, 1.6));
  S.U.uLit.value = lit * (1 + 0.04 * Math.sin(7.3 * t) * Math.sin(3.1 * t));
  setMoon(L.mn, ss(seg(t, 0.0, 1.0)));
  const layerOn = (m: THREE.Mesh, a: number) => { const u = (m.material as THREE.Material & { userData: { u: Record<string, { value: number }> } }).userData.u; u.uGlowLit.value = ss(seg(t, a, a + 0.5)); };
  layerOn(L.far, 0.8); layerOn(L.ship, 2.4);
  // dalgalar: her katman kendi hızında yana kayar + hafif yükselip alçalır (çubuktaki kâğıt)
  const sway = (m: THREE.Mesh, y0: number, ax: number, sp: number, ph: number) => { m.position.x = ax * Math.sin(t * sp + ph); m.position.y = y0 + 0.002 * Math.sin(t * sp * 1.3 + ph); };
  sway(L.mid, -0.31, 0.006, 0.6, 0.2); sway(L.near, -0.37, 0.009, 0.8, 1.4); sway(L.front, -0.42, 0.012, 1.0, 2.5);
  // gemi: sağdan süzülür, dalgada sallanır
  const sx = lerp(0.075, -0.035, eio(seg(t, 0.3, 7.5)));
  L.ship.scale.setScalar(0.42);
  L.ship.position.set(sx, -0.046 + 0.0015 * Math.sin(t * 1.1), -0.075);
  L.ship.rotation.z = 0.035 * Math.sin(t * 1.1 + 0.6);
  // kamera: yavaş itme, neredeyse önden
  const cz = lerp(0.98, 0.88, eio(seg(t, 0, 8)));
  aim(camera, [0, 0.0, cz, 0, -0.02, -0.08], t, { fov: 30 });
  setPost({ strength: 0.32, radius: 0.5, threshold: 1.05 }, { vig: 0.4, warm: 0.02, fade: ss(seg(t, 0, 0.5)) });
  return null;
};

export const LanternSea: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "#03050c" }}>
      <ThreeCanvas width={width} height={height} camera={{ fov: 30, near: 0.01, far: 30, position: [0, 0, 1] }} gl={{ antialias: true }}>
        <Scene t={frame / fps} width={width} height={height} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
