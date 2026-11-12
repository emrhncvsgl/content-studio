"""Fotoğraftan nesne kesiği (arka plan kaldırma) → kırpılmış şeffaf PNG, isteğe bağlı kâğıt arkalık (sticker).

rembg komut satırı tools/.venv-matte'de çalışmıyor (click eksik); bu araç rembg'yi Python API'siyle çağırır.
Kullanım (tools/.venv-matte):
  tools/.venv-matte/bin/python tools/cutout.py <girdi> <çıktı.png> [--model isnet-general-use] [--box x0,y0,x1,y1]
      [--max 1400] [--sticker] [--border 14] [--rough 6] [--seed 1]
  --model : isnet-general-use (varsayılan, nesne) · birefnet-general (daha ince kenar, yavaş) · u2net_human_seg (kişi)
  --box   : nesne bu kutuda (görselin 0-1'i); rembg arka plandan parça alırsa sınırla
  --max   : kırpılan kesiğin uzun kenarı (px)
  --sticker : tools/make_sticker.py ile yırtık kenarlı kâğıt arkalık ekler (vox kolaj kesiği)
Çıktı boyutu ekrana yazılır → props.size. Saç/ince tel gibi zor kenarlarda SAM 2 (tools/matte_video.py, tools/.venv-sam2) kullan.
Örnek (EP004 kapağı): cutout.py assets/s05-double-lens-burning-apparatus-ehrenfried.jpg assets/cutout/cover_burning_lens_sticker.png --sticker --seed 4
"""
import argparse
import subprocess
import sys
from pathlib import Path

from PIL import Image


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("out")
    ap.add_argument("--model", default="isnet-general-use")
    ap.add_argument("--box", default=None)
    ap.add_argument("--max", type=int, default=1400)
    ap.add_argument("--sticker", action="store_true")
    ap.add_argument("--border", type=int, default=14)
    ap.add_argument("--rough", type=int, default=6)
    ap.add_argument("--seed", type=int, default=1)
    a = ap.parse_args()

    from rembg import new_session, remove
    im = Image.open(a.src).convert("RGB")
    W, H = im.size
    cut = remove(im, session=new_session(a.model))
    if a.box:
        x0, y0, x1, y1 = (float(v) for v in a.box.split(","))
        mask = Image.new("L", (W, H), 0)
        mask.paste(255, (int(x0 * W), int(y0 * H), int(x1 * W), int(y1 * H)))
        alpha = Image.composite(cut.split()[3], Image.new("L", (W, H), 0), mask)
        cut.putalpha(alpha)
    bbox = cut.split()[3].point(lambda v: 255 if v > 40 else 0).getbbox()
    if not bbox:
        sys.exit("[hata] nesne bulunamadı (--box ya da başka --model dene)")
    cut = cut.crop(bbox)
    cut.thumbnail((a.max, a.max))
    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    if a.sticker:
        tmp = out.with_suffix(".raw.png")
        cut.save(tmp)
        subprocess.run([sys.executable, str(Path(__file__).parent / "make_sticker.py"), str(tmp), str(out),
                        "--border", str(a.border), "--rough", str(a.rough), "--seed", str(a.seed)], check=True)
        tmp.unlink()
    else:
        cut.save(out)
    w, h = Image.open(out).size
    cov = (bbox[2] - bbox[0]) * (bbox[3] - bbox[1]) / (W * H)
    print(f"[cutout] {out} · size [{w}, {h}] · kesik kutusu görselin %{cov * 100:.0f}'i · model {a.model}")


if __name__ == "__main__":
    main()
