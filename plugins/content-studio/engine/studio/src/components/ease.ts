import { Easing } from "remotion";

// Tek easing haritası (vox talimatı §7): bütün stiller ve geçişler buradan okur.
// heavy: ağır başlayıp ağır duran (AE "heavy ease", iki uç %90) · heavyOut: hızlı atılım + uzun süzülerek oturma (AE: çıkış anahtarı
// hafif, varış anahtarı %90-100 etki); zoom'larda varsayılan · snapOut: daha sert atılım, daha uzun kuyruk ·
// expoOut: açılış, fosfor, push · backOut: ≈ %10 taşma · lineer yalnızca doku/toz/kesik çizgi.
export const EASE = {
  heavy: Easing.bezier(0.9, 0, 0.1, 1),
  heavyOut: Easing.bezier(0.2, 0.9, 0.1, 1),
  snapOut: Easing.bezier(0.05, 0.85, 0.06, 1),
  expoOut: (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  expoIn: (t: number) => (t <= 0 ? 0 : Math.pow(2, 10 * (t - 1))),
  backOut: Easing.out(Easing.back(1.70158)),
  cubic: Easing.inOut(Easing.cubic),
  sin: Easing.inOut(Easing.sin),
  linear: (t: number) => t,
} as const;
export type EaseName = keyof typeof EASE;
export const ease = (name: unknown, fallback: EaseName = "sin") => EASE[(typeof name === "string" && name in EASE ? name : fallback) as EaseName];
export const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

// Zoom (ölçek) oranla algılanır: 1→2 ile 2→4 aynı "mesafe". Ölçek her zaman log uzayında karıştırılır, yoksa eğri ne olursa olsun
// büyük zoom'un sonu sürünür ya da kesik biter.
export const lerpScale = (a: number, b: number, k: number) => (a > 0 && b > 0 ? Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * k) : a + (b - a) * k);

// Lens odağı (rack focus / focus hunt): p 0 → 1 boyunca bulanıklık (px). Netlik p ≈ land'de oturur; hunt > 0 ise ardından
// odak bir kez hedefi geçip geri gelir (otomatik odağın "araması"), tepe = hunt × peak. Geçişlerde ve dof odak kaydırmada ortak.
export function focusBlur(p: number, peak: number, hunt = 0, land = 0.6) {
  const q = clamp01(p);
  const main = peak * (1 - EASE.heavyOut(clamp01(q / land)));
  const bump = hunt > 0 && q > land ? hunt * peak * Math.sin(Math.PI * clamp01((q - land) / (1 - land))) * (1 - (q - land) / (1 - land)) ** 0.5 : 0;
  return Math.max(0, main + bump);
}
