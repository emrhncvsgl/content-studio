"""Bulut anahtarlama: mavi gökyüzü önündeki bulut fotoğrafı → yumuşak kenarlı, yarı saydam PNG (element kütüphanesi için).

Yöntem (rembg değil; bulut kenarı yarı saydam olduğu için renk anahtarı daha doğru):
  1. Gökyüzü rengi: kırpımdaki "en mavi" piksellerin (B−R üst %3) ortancası.
  2. Alfa: maviliğe göre. b_r = B − R; gökyüzünde b_r ≈ sky_br, bulutta ≈ 0-cloud_br. alfa = 1 − (b_r − cloud_br) / (sky_br − cloud_br),
     sonra --gamma ile (büyük = ince kenar daha saydam) ve parlaklıkla hafif güçlendirme (gölgeli bulut altı mavimsi ama koyu → alfa korunur).
  3. Renk temizleme (despill): renk = (piksel − (1 − alfa) × gökyüzü) / alfa → kenarda mavi saçak kalmaz.
  4. Kenar yumuşatma: --feather "sol,üst,sağ,alt" (kırpım boyunun oranı) kenara doğru alfa sıfıra iner; bulutun kırpımda kesildiği
     kenarlar (ör. fotoğrafın altı) için. Alfa 1.2 px bulanıklaştırılır.
  5. Alfa kutusuna kırpılır, uzun kenar --max (1800) px.
Kullanım (voice/.venv-chatterbox):
  voice/.venv-chatterbox/bin/python tools/cloud_key.py <foto> <çıktı.png> [--box x0,y0,x1,y1 (0-1)] [--feather 0,0,0,0.3]
      [--gamma 1.3] [--cloud-br 8] [--max 1800] [--preview <önizleme.jpg>]
Tuzaklar: gökyüzü olmayan (kapalı hava) fotoğrafta çalışmaz (her şey bulut sayılır); ev/ağaç kırpım dışında kalmalı (--box).
Koyu fırtına bulutu gereken sahnede koyulaştırma/doygunluk düşürme render'da yapılır (vox `clouds` katmanı `tone`), PNG nötr kalır.
"""
import argparse

import numpy as np
from PIL import Image, ImageFilter

Image.MAX_IMAGE_PIXELS = None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src"); ap.add_argument("out")
    ap.add_argument("--box", default="0,0,1,1")
    ap.add_argument("--feather", default="0,0,0,0", help="sol,üst,sağ,alt kenar yumuşatma (kırpım oranı)")
    ap.add_argument("--gamma", type=float, default=1.3)
    ap.add_argument("--cloud-br", type=float, default=8, help="bulutun B−R değeri (bunun altı tam opak)")
    ap.add_argument("--max", type=int, default=1800)
    ap.add_argument("--preview", default=None)
    a = ap.parse_args()
    im = Image.open(a.src).convert("RGB")
    W, H = im.size
    x0, y0, x1, y1 = (float(v) for v in a.box.split(","))
    im = im.crop((int(x0 * W), int(y0 * H), int(x1 * W), int(y1 * H)))
    s = a.max / max(im.size)
    if s < 1:
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    px = np.asarray(im).astype(np.float32)
    r, g, b = px[..., 0], px[..., 1], px[..., 2]
    br = b - r
    thr = np.percentile(br, 97)
    sky_mask = br >= thr
    sky = np.median(px[sky_mask], axis=0)
    sky_br = float(sky[2] - sky[0])
    alpha = 1 - np.clip((br - a.cloud_br) / max(1.0, sky_br - a.cloud_br), 0, 1)
    alpha = alpha ** a.gamma
    # parlak piksel (beyaz bulut) gökyüzünden açıksa biraz daha opak
    lum = px.mean(axis=2)
    alpha = np.clip(alpha + 0.25 * np.clip((lum - sky.mean()) / 80, 0, 1) * (alpha > 0.05), 0, 1)
    # kenar yumuşatma
    fl, ft, fr, fb = (float(v) for v in a.feather.split(","))
    h, w = alpha.shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    ramp = np.ones_like(alpha)
    for f, d in ((fl, xx / w), (ft, yy / h), (fr, 1 - xx / w), (fb, 1 - yy / h)):
        if f > 0:
            t = np.clip(d / f, 0, 1)
            ramp *= t * t * (3 - 2 * t)
    alpha *= ramp
    am = Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))
    alpha = np.asarray(am).astype(np.float32) / 255
    # despill
    a3 = np.maximum(alpha[..., None], 1e-3)
    col = np.clip((px - (1 - a3) * sky) / a3, 0, 255)
    gray = col.mean(axis=2, keepdims=True)   # yarı saydam kenarda despill renk kaydırır (pembe/yeşil saçak) → kenara doğru gri
    col = col + (gray - col) * (0.3 + 0.7 * (1 - alpha[..., None]))
    col = np.where(alpha[..., None] < 0.02, 255, col)
    rgba = np.dstack([col, alpha * 255]).astype(np.uint8)
    out = Image.fromarray(rgba, "RGBA")
    bbox = Image.fromarray((alpha > 0.03).astype(np.uint8) * 255).getbbox()
    if bbox:
        out = out.crop(bbox)
    out.save(a.out)
    print(a.out, out.size, "gökyüzü", sky.round().tolist(), "sky_br", round(sky_br, 1))
    if a.preview:
        bg = Image.new("RGBA", out.size, (30, 40, 52, 255))
        bg.alpha_composite(out)
        bg.convert("RGB").thumbnail((600, 600))
        p = bg.convert("RGB"); p.thumbnail((600, 600)); p.save(a.preview, quality=85)


if __name__ == "__main__":
    main()
