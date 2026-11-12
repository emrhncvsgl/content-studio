"""Kesik görsele (şeffaf PNG) yırtık kenarlı kâğıt arkalık ekler: kolaj / "kâğıttan kesilmiş" görünümü.

Kullanım: tools/.venv-matte/bin/python tools/make_sticker.py <girdi.png> <çıktı.png> [--border 16] [--rough 7] [--seed 1]
  border: kâğıdın görselin dışına taşma payı (px) · rough: kenar pürüzü (px)
Çıktı girdiden 2×(border+rough) büyük olur; kâğıt rengi kırık beyaz, hafif lif dokulu.
"""
import argparse

import numpy as np
from PIL import Image, ImageFilter


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--border", type=int, default=16)
    ap.add_argument("--rough", type=int, default=7)
    ap.add_argument("--seed", type=int, default=1)
    a = ap.parse_args()
    rng = np.random.default_rng(a.seed)
    im = Image.open(a.src).convert("RGBA")
    pad = a.border + a.rough * 2
    canvas = Image.new("RGBA", (im.width + 2 * pad, im.height + 2 * pad), (0, 0, 0, 0))
    canvas.paste(im, (pad, pad))
    alpha = canvas.getchannel("A").point(lambda v: 255 if v > 110 else 0)
    # kenarı dışarı büyüt, yuvarla, sonra düşük frekanslı gürültüyle yırtık kenar
    grown = alpha.filter(ImageFilter.MaxFilter(3))
    for _ in range(max(1, a.border // 2)):
        grown = grown.filter(ImageFilter.MaxFilter(3))
    soft = np.asarray(grown.filter(ImageFilter.GaussianBlur(a.border * 0.6))).astype(np.float32) / 255
    noise = rng.random(soft.shape).astype(np.float32)
    noise = np.asarray(Image.fromarray((noise * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(a.rough * 0.8))).astype(np.float32) / 255
    fine = np.asarray(Image.fromarray((rng.random(soft.shape) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))).astype(np.float32) / 255
    paper = (soft + (noise - 0.5) * 0.9 + (fine - 0.5) * 0.25) > 0.42
    paper_a = Image.fromarray((paper * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))
    # kâğıt rengi + lif
    fiber = np.asarray(Image.fromarray((rng.random(soft.shape) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5))).astype(np.float32) / 255
    base = np.array([244, 239, 228], np.float32)
    rgb = np.clip(base[None, None, :] * (0.96 + 0.06 * fiber[..., None]), 0, 255).astype(np.uint8)
    sheet = Image.fromarray(np.dstack([rgb, np.asarray(paper_a)]))
    sheet.alpha_composite(canvas)
    sheet.save(a.dst)
    print(f"[done] {a.dst} {sheet.size}")


if __name__ == "__main__":
    main()
