"""Harita zemini pişirme: gölgeli kabartma (Natural Earth) × dönem deniz haritası (multiply) → tek doc görseli.

vox E2 tarifi (`.studio/plugin/skills/remotion-styles/vox-explainer.md` §2 E2). Vox `doc` katmanında blend yok; karışım burada
önceden yapılır. Eski harita coğrafi olarak hizalanmaz: yalnızca rumb çizgili açık deniz bölgesi doku olarak kullanılır
(`--box` ile yazı/kartuş/kıyı içermeyen bölgeyi seç).

Kullanım (voice/.venv-chatterbox):
  voice/.venv-chatterbox/bin/python tools/map_bake.py <kabartma.jpg> <eski_harita.jpg> <çıktı.jpg>
      [--box 0.36,0.12,0.58,0.45] [--opacity 0.42] [--vignette 0.35]
Natural Earth kırpımı (eşdikdörtgen, 1:50m = 30 px/derece): x = (boylam + 180) × 30, y = (90 − enlem) × 30.
Örnek (EP006 s11): map_bake.py assets/maps/ne-atlantic-route.jpg assets/s11-bellin-ocean-occidental.jpg assets/maps/s11-route-baked.jpg

Deniz tonu (--sea, varsayılan #2E8C8F turkuaz; "none" = NE'nin açık mavisi kalır): NE okyanusu (B − R > --sea-thr, 45) maskelenir,
kendi parlaklık dokusu korunarak hedef renge boyanır; kıyıya yakın sığlık --shelf (0.35) gücünde açık turkuaza (#6FC7BC) çekilir
(kara maskesinin bulanığı, --shelf-px 14). Kara (yeşil/bej) değişmez. Göller de denizle aynı boyanır.
Tuzak: maske multiply'dan ÖNCE alınır (eski harita dokusu maviliği bozar); kar/buz (beyaz) maskeye girmez.
"""
import argparse

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

Image.MAX_IMAGE_PIXELS = None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("base"); ap.add_argument("texture"); ap.add_argument("out")
    ap.add_argument("--box", default="0.36,0.12,0.58,0.45", help="eski haritada doku bölgesi (0-1)")
    ap.add_argument("--opacity", type=float, default=0.42)
    ap.add_argument("--vignette", type=float, default=0.35, help="kenar karartma gücü (0 = yok)")
    ap.add_argument("--sea", default="#2E8C8F", help="deniz rengi (hex) ya da none")
    ap.add_argument("--sea-thr", type=float, default=45)
    ap.add_argument("--shelf", type=float, default=0.35)
    ap.add_argument("--shelf-px", type=float, default=14)
    a = ap.parse_args()
    base = Image.open(a.base).convert("RGB")
    if a.sea != "none":
        base = tint_sea(base, a.sea, a.sea_thr, a.shelf, a.shelf_px)
    tex = Image.open(a.texture).convert("RGB")
    x0, y0, x1, y1 = (float(v) for v in a.box.split(","))
    W, H = tex.size
    tex = tex.crop((int(x0 * W), int(y0 * H), int(x1 * W), int(y1 * H))).resize(base.size, Image.LANCZOS)
    out = Image.blend(base, ImageChops.multiply(base, tex), a.opacity)
    if a.vignette > 0:
        w, h = out.size
        m = Image.new("L", (w, h), 0)
        ImageDraw.Draw(m).ellipse((-w * 0.15, -h * 0.15, w * 1.15, h * 1.15), fill=255)
        m = m.filter(ImageFilter.GaussianBlur(min(w, h) * 0.12))
        dark = Image.blend(out, Image.new("RGB", out.size, (12, 20, 28)), a.vignette)
        out = Image.composite(out, dark, m)
    out.save(a.out, quality=92)
    print(a.out, out.size)


def tint_sea(base: Image.Image, sea: str, thr: float, shelf: float, shelf_px: float) -> Image.Image:
    px = np.asarray(base).astype(np.float32)
    m = ((px[..., 2] - px[..., 0]) > thr).astype(np.float32)
    mask = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.0))).astype(np.float32) / 255
    lum = px.mean(axis=2)
    ref = float(np.median(lum[m > 0.5])) if (m > 0.5).any() else 170.0
    rgb = np.array([int(sea.lstrip("#")[k:k + 2], 16) for k in (0, 2, 4)], np.float32)
    deep = rgb[None, None, :] * (lum / ref)[..., None]
    land = Image.fromarray(((1 - m) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(shelf_px))
    near = np.asarray(land).astype(np.float32)[..., None] / 255
    light = np.array([0x6F, 0xC7, 0xBC], np.float32)[None, None, :]
    water = deep + (light * (lum / ref)[..., None] - deep) * np.clip(near * 2, 0, 1) * shelf
    out = px * (1 - mask[..., None]) + water * mask[..., None]
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


if __name__ == "__main__":
    main()
