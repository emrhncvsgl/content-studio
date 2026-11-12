"""Fotoğrafı 2.5D katmanlara ayırır (Joe Fellows yöntemi): ön plan kesiği (RGBA, aynı piksel ızgarası) + deliği doldurulmuş arka plan.

Kullanım (tools/.venv-matte):
  tools/.venv-matte/bin/python tools/photo_planes.py <girdi.jpg> [--out-dir <klasör>] [--model isnet-general-use] [--dilate 18]
      [--box x0,y0,x1,y1]   ön planı bu kutuyla sınırla (görselin 0-1'i; rembg bazen arka plandan parça alır)
Çıktı: <ad>.fg.png (ön plan, kenarı 1.5 px yumuşak) · <ad>.bg.jpg (ön plan alanı + dilate px OpenCV Telea ile doldurulur)
Sahne props: { "image": "<ad>.bg.jpg", "planes": [{ "image": "<ad>.fg.png", "k": 1.5 }], "dof": { "amount": 6 } }
Doldurma kaba bir tahmindir: kamera az kayarsa (k ≤ 1.8, zoom farkı ≤ 0.15) görünmez; büyük harekette delik kenarı seçilebilir.
"""
import argparse
from pathlib import Path

import cv2
import numpy as np
from PIL import Image


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("image")
    ap.add_argument("--out-dir", default=None)
    ap.add_argument("--model", default="isnet-general-use")
    ap.add_argument("--dilate", type=int, default=18, help="doldurma maskesi genişletme (px): ön planın hale bırakmaması için")
    ap.add_argument("--box", default=None, help="x0,y0,x1,y1 (0-1): ön plan bu kutunun dışında sayılmaz")
    a = ap.parse_args()

    from rembg import new_session, remove
    src = Path(a.image)
    out = Path(a.out_dir) if a.out_dir else src.parent
    out.mkdir(parents=True, exist_ok=True)
    im = Image.open(src).convert("RGB")
    W, H = im.size
    cut = remove(im, session=new_session(a.model))           # RGBA
    alpha = np.array(cut)[:, :, 3].astype(np.float32) / 255.0
    if a.box:
        x0, y0, x1, y1 = (float(v) for v in a.box.split(","))
        keep = np.zeros_like(alpha)
        keep[int(y0 * H):int(y1 * H), int(x0 * W):int(x1 * W)] = 1
        alpha *= keep
    alpha = cv2.GaussianBlur(alpha, (0, 0), 1.5)              # kenar yumuşatma (hale yerine yumuşak geçiş)
    rgb = np.array(im)
    fg = np.dstack([rgb, (alpha * 255).astype(np.uint8)])
    stem = src.stem
    Image.fromarray(fg, "RGBA").save(out / f"{stem}.fg.png")

    mask = (alpha > 0.08).astype(np.uint8) * 255
    mask = cv2.dilate(mask, np.ones((3, 3), np.uint8), iterations=max(1, a.dilate))
    # büyük delikte Telea bulanık şerit bırakır: önce küçültülmüş görüntüde doldur, sonra büyütüp yalnızca delik içine koy
    s = 0.25 if max(W, H) > 2000 else 0.5
    small = cv2.resize(rgb, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
    msmall = cv2.resize(mask, (small.shape[1], small.shape[0]), interpolation=cv2.INTER_NEAREST)
    filled_small = cv2.inpaint(small, msmall, 7, cv2.INPAINT_TELEA)
    filled = cv2.resize(filled_small, (W, H), interpolation=cv2.INTER_CUBIC)
    m = cv2.GaussianBlur(mask.astype(np.float32) / 255.0, (0, 0), 6)[..., None]
    bg = (rgb * (1 - m) + filled * m).astype(np.uint8)
    noise = np.random.default_rng(3).normal(0, 4, bg.shape)  # doldurulan alanda tane: düz leke gibi durmasın
    bg = np.clip(bg + noise * m, 0, 255).astype(np.uint8)
    Image.fromarray(bg).save(out / f"{stem}.bg.jpg", quality=92)
    cov = float((alpha > 0.5).mean())
    print(f"[planes] {out / (stem + '.fg.png')} · {out / (stem + '.bg.jpg')} · ön plan kapsamı %{cov * 100:.1f} · {W}x{H}")
    if cov < 0.03 or cov > 0.7:
        print("[warn] ön plan kapsamı olağandışı; --box ile sınırla ya da SAM ile kes")


if __name__ == "__main__":
    main()
