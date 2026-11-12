"""Derinlik haritasından çok katmanlı 2.5D (AE multiplane gibi): görüntüyü N derinlik dilimine böler, her dilim ayrı düz kart olur.
Tek esnek yüzeydeki (DepthPhoto düz modu) kenar gerilmesi/hayalet izi olmaz, çünkü figür ile arkası ayrı kartlardadır.

Girdi: görüntü + tools/depth_map.py çıktısı (<ad>.depth.png, yakın = beyaz). Çıktı <out-dir>/<ad>.L0.jpg (en uzak, tam opak, öndekilerin yeri
doldurulmuş) ve <ad>.L1..N-1.png (alfalı dilimler, kenar yumuşatılmış, 3 px taşma), <ad>.layers.json (DepthPhoto `layers` props'u: image, z).
Dilim sınırları derinlik histogramından k-means (1B) ile; --cuts 0.3,0.55,0.75 ile elle verilebilir.

Kullanım (OpenCV matte ortamında):
  tools/.venv-matte/bin/python tools/depth_layers.py <foto> <ad>.depth.png --out-dir <bölüm>/assets/depth [--n 4] [--cuts ...] [--preview]
"""
import argparse
import json
from pathlib import Path

import cv2
import numpy as np


def kmeans1d(v, k, iters=30):
    c = np.quantile(v, np.linspace(0.1, 0.9, k))
    for _ in range(iters):
        lab = np.argmin(np.abs(v[:, None] - c[None, :]), axis=1)
        c = np.array([v[lab == i].mean() if np.any(lab == i) else c[i] for i in range(k)])
    c.sort()
    return [(c[i] + c[i + 1]) / 2 for i in range(k - 1)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("image"); ap.add_argument("depth")
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--n", type=int, default=4)
    ap.add_argument("--cuts", help="virgülle dilim sınırları (0-1, uzak→yakın)")
    ap.add_argument("--max", type=int, default=3000, help="katman görüntüsü en uzun kenar")
    ap.add_argument("--feather", type=float, default=2.0)
    ap.add_argument("--spill", type=int, default=3, help="dilim maskesini px taşır (kart aralarında çatlak olmasın)")
    ap.add_argument("--preview", action="store_true")
    a = ap.parse_args()
    img = cv2.imread(a.image, cv2.IMREAD_COLOR)
    h, w = img.shape[:2]
    k = min(1.0, a.max / max(w, h))
    if k < 1:
        img = cv2.resize(img, (round(w * k), round(h * k)), interpolation=cv2.INTER_AREA); h, w = img.shape[:2]
    d = cv2.imread(a.depth, cv2.IMREAD_UNCHANGED).astype(np.float32)
    d = d / (65535.0 if d.max() > 255 else 255.0)
    d = cv2.resize(d, (w, h), interpolation=cv2.INTER_LINEAR)
    cuts = [float(x) for x in a.cuts.split(",")] if a.cuts else [float(c) for c in kmeans1d(d[::4, ::4].ravel(), a.n)]
    edges = [0.0, *cuts, 1.01]
    out = Path(a.out_dir); out.mkdir(parents=True, exist_ok=True)
    stem = Path(a.image).stem
    layers = []
    ker = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * a.spill + 1, 2 * a.spill + 1))
    for i in range(len(edges) - 1):
        lo, hi = edges[i], edges[i + 1]
        z = float(np.median(d[(d >= lo) & (d < hi)])) if np.any((d >= lo) & (d < hi)) else (lo + hi) / 2
        if i == 0:
            # en uzak kart: tam görüntü, daha yakın her şeyin yeri doldurulur (küçük ölçekte inpaint, sonra büyüt)
            near = (d >= hi).astype(np.uint8) * 255
            near = cv2.dilate(near, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))
            s = 0.25
            sm = cv2.resize(img, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
            mm = cv2.resize(near, (sm.shape[1], sm.shape[0]), interpolation=cv2.INTER_NEAREST)
            fill = cv2.resize(cv2.inpaint(sm, mm, 7, cv2.INPAINT_TELEA), (w, h), interpolation=cv2.INTER_CUBIC)
            m = (near > 0)[..., None]
            base = np.where(m, fill, img)
            p = out / f"{stem}.L0.jpg"; cv2.imwrite(str(p), base, [cv2.IMWRITE_JPEG_QUALITY, 92])
        else:
            mask = ((d >= lo) & (d < hi)).astype(np.uint8) * 255
            mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))   # kırıntıları at
            mask = cv2.dilate(mask, ker)
            if a.feather > 0:
                mask = cv2.GaussianBlur(mask, (0, 0), a.feather)
            rgba = np.dstack([img, mask])
            p = out / f"{stem}.L{i}.png"; cv2.imwrite(str(p), rgba)
        layers.append({"image": str(p).split("content/", 1)[-1], "z": round(float(z), 4)})
        print(f"[layer] L{i} depth {lo:.2f}-{min(hi, 1):.2f} z={z:.3f} → {p.name}")
    (out / f"{stem}.layers.json").write_text(json.dumps({"cuts": [round(c, 4) for c in cuts], "layers": layers}, indent=1))
    if a.preview:
        tiles = []
        for L in layers:
            im = cv2.imread(str(Path(a.out_dir) / Path(L["image"]).name), cv2.IMREAD_UNCHANGED)
            if im.shape[2] == 4:
                al = im[..., 3:4] / 255.0; chk = np.full_like(im[..., :3], 60); im = (im[..., :3] * al + chk * (1 - al)).astype(np.uint8)
            tiles.append(cv2.resize(im, (480, round(480 * h / w))))
        cv2.imwrite(str(out / f"{stem}.layers-preview.jpg"), np.hstack(tiles))


if __name__ == "__main__":
    main()
