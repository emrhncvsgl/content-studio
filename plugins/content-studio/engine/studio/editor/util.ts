// Editör ortak yardımcıları (app.tsx ve edit.tsx).
export type Edit = (sid: string, path: string, value: unknown) => void;
export const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
export const getPath = (o: unknown, p: string): unknown =>
  p.split(".").reduce<unknown>((a, k) => (a == null ? undefined : Array.isArray(a) ? a[Number(k)] : (a as Record<string, unknown>)[k]), o);
export const setPath = (o: Record<string, unknown>, p: string, v: unknown) => {
  const ks = p.split(".");
  let a: any = o;
  ks.slice(0, -1).forEach((k, i) => { const key = Array.isArray(a) ? Number(k) : k; if (a[key] == null) a[key] = /^\d+$/.test(ks[i + 1]) ? [] : {}; a = a[key]; });
  const last = ks[ks.length - 1];
  if (Array.isArray(a)) a[Number(last)] = v; else if (v === null) delete a[last]; else a[last] = v;
};
// hazır klip olarak oynayan stiller (tools/woodcut_render.py): ayar değişince önizlemede görmek için klip yeniden üretilmeli
export const CLIP_STYLES = new Set(["object3d", "depth-photo", "woodcut", "lantern", "lantern-text"]);
