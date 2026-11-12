"""Fotoğraf/gravür için derinlik haritası (Depth Anything V2 Small, Apache 2.0; 2026-11-11 kullanıcı onayı).

Çıktı: <out-dir>/<ad>.depth.png — 16 bit gri, yakın = beyaz, uzak = siyah; görüntüyle aynı en-boy (en uzun kenar --size).
Remotion `DepthPhoto` bu haritayla görüntüyü alt bölümlü bir düzleme yükseklik olarak giydirir, kamera hareketi gerçek paralaks verir.

Kullanım:
  voice/.venv-chatterbox/bin/python tools/depth_map.py <foto> --out-dir <bölüm>/assets/depth [--size 1536] [--blur 2] [--preview]
Model ~100 MB, ilk çalıştırmada Hugging Face'ten iner; fotoğraf başına CPU'da birkaç saniye. Base/Large CC BY-NC (ticari değil) → KULLANMA.
"""
import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

MODEL = "depth-anything/Depth-Anything-V2-Small-hf"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("image")
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--size", type=int, default=1536, help="harita en uzun kenarı (px)")
    ap.add_argument("--blur", type=float, default=2.0, help="kenar yumuşatma (px); düzlemde yırtılmayı azaltır")
    ap.add_argument("--preview", action="store_true", help="yan yana önizleme jpg")
    a = ap.parse_args()
    from transformers import pipeline
    src = Image.open(a.image).convert("RGB")
    w, h = src.size
    k = a.size / max(w, h)
    small = src.resize((round(w * k), round(h * k)), Image.LANCZOS)
    pipe = pipeline("depth-estimation", model=MODEL, device="cpu")
    pred = pipe(small)["predicted_depth"]
    d = pred.squeeze().numpy().astype(np.float32)   # göreli ters derinlik: büyük = yakın
    lo, hi = np.percentile(d, 1), np.percentile(d, 99)
    d = np.clip((d - lo) / max(1e-6, hi - lo), 0, 1)
    img = Image.fromarray((d * 65535).astype(np.uint16)).resize(small.size, Image.BICUBIC)
    if a.blur > 0:
        img8 = Image.fromarray((np.asarray(img, dtype=np.float32) / 257).astype(np.uint8)).filter(ImageFilter.GaussianBlur(a.blur))
        img = Image.fromarray((np.asarray(img8, dtype=np.float32) * 257).astype(np.uint16))
    out = Path(a.out_dir); out.mkdir(parents=True, exist_ok=True)
    stem = Path(a.image).stem
    p = out / f"{stem}.depth.png"
    img.save(p)
    print(f"[depth] {p} {img.size}")
    if a.preview:
        g = Image.fromarray((np.asarray(img, dtype=np.float32) / 257).astype(np.uint8)).convert("RGB")
        pv = Image.new("RGB", (small.width * 2, small.height)); pv.paste(small, (0, 0)); pv.paste(g, (small.width, 0))
        pv.thumbnail((1600, 1600)); pv.save(out / f"{stem}.depth-preview.jpg", quality=85)


if __name__ == "__main__":
    main()
