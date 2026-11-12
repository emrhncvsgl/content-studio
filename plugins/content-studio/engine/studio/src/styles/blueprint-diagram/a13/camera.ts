import type { Word } from "../../../schema/timeline";
import { clamp01, ease, lerpScale, type EaseName } from "../../../components/ease";
import { atMs, CW, CH } from "./kit";

// Tuval kamerası (docs/styles/camera.md): x, y = bakılan noktanın tuvaldeki yeri (0-1), zoom 1 = bütün tuval.
// camera {from, to, moveAt?, moveMs?, ease?}: moveAt yoksa hareket sahne boyunca; varsa yalnız o pencerede (öncesinde from'da durur).
// Varsayılan eğri: moveAt yok → "sin" · moveAt var ve yaklaşma (zoom ≥ %15 artıyor) → "heavyOut" (punch-in) · moveAt var, geri çekilme/kaydırma → "cubic".
// Zoom log uzayında karışır. Görüş tuvalin dışına taşmaz (merkez kenara kıstırılır, zoom ≥ 1).
export type CamPt = { x: number; y: number; zoom: number };
export type CamProps = { from?: Partial<CamPt>; to?: Partial<CamPt>; moveAt?: unknown; moveMs?: number; ease?: string };
const C0: CamPt = { x: 0.5, y: 0.5, zoom: 1 };

export function camEnds(camera: unknown): { a: CamPt; b: CamPt } {
  const c = (camera ?? {}) as CamProps;
  const a = { ...C0, ...(c.from ?? {}) }, b = { ...C0, ...(c.to ?? c.from ?? {}) };
  return { a, b };
}
export function clampCam(c: CamPt): CamPt {
  const zoom = Math.max(1, c.zoom), hv = 0.5 / zoom;
  return { zoom, x: Math.min(1 - hv, Math.max(hv, c.x)), y: Math.min(1 - hv, Math.max(hv, c.y)) };
}
export function camAt(camera: unknown, ms: number, durMs: number, words: Word[]): CamPt {
  const c = (camera ?? {}) as CamProps;
  const { a, b } = camEnds(camera);
  const windowed = c.moveAt !== undefined;
  const p = windowed ? clamp01((ms - atMs(c.moveAt, words)) / (c.moveMs ?? 1600)) : clamp01(ms / Math.max(1, durMs));
  const fallback: EaseName = !windowed ? "sin" : b.zoom > a.zoom * 1.15 ? "heavyOut" : "cubic";
  const k = ease(c.ease, fallback)(p);
  return clampCam({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, zoom: lerpScale(a.zoom, b.zoom, k) });
}
export const viewBoxOf = (c: CamPt) => `${(c.x - 0.5 / c.zoom) * CW} ${(c.y - 0.5 / c.zoom) * CH} ${CW / c.zoom} ${CH / c.zoom}`;
// ekran kutusu (kare oranı, x/y merkez; Transitions.tsx Box) → o kameradaki tuval dikdörtgeni (sol üst köşe + boyut, px)
export function screenBoxToCanvas(b: { x: number; y: number; w: number; h: number }, cam: CamPt) {
  const w = (b.w / cam.zoom) * CW, h = (b.h / cam.zoom) * CH;
  return { x: (cam.x + (b.x - 0.5) / cam.zoom) * CW - w / 2, y: (cam.y + (b.y - 0.5) / cam.zoom) * CH - h / 2, w, h };
}
