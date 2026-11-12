"""Videoda bir kişiyi/nesneyi arka plandan ayırır (SAM 2 ile takip) ve şeffaf video üretir.

Kullanım:
  tools/.venv-sam2/bin/python tools/matte_video.py <kare_klasörü> <çıktı_öneki> --pos 230,170 165,80 [--neg 400,120] [--fps 30]
    kare_klasörü: 00000.jpg, 00001.jpg … (ffmpeg -vf fps=30 -q:v 2 -start_number 0 %05d.jpg)
    --pos / --neg: ilk karede nesneye ait (pos) ve ait olmayan (neg) noktalar, piksel x,y
Çıktı: <önek>_alpha.mov (ProRes 4444), <önek>_alpha.webm (VP9 alfa), <önek>_green.mp4 (yeşil ekran), <önek>_masks/ (maske PNG'leri)
Model: facebook/sam2.1-hiera-small (Apache-2.0), cihaz MPS (yoksa CPU).
"""
import argparse
import os
import subprocess
from pathlib import Path

os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")  # MPS'te olmayan işlemler CPU'ya düşer

import numpy as np
import torch
from PIL import Image, ImageFilter


def pts(vals):
    return [tuple(float(v) for v in p.split(",")) for p in vals or []]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("frames")
    ap.add_argument("out")
    ap.add_argument("--pos", nargs="+", required=True)
    ap.add_argument("--neg", nargs="*", default=[])
    ap.add_argument("--fps", type=float, default=30)
    ap.add_argument("--model", default="facebook/sam2.1-hiera-small")
    ap.add_argument("--feather", type=float, default=1.0, help="maske kenarı yumuşatma (px)")
    a = ap.parse_args()

    from sam2.sam2_video_predictor import SAM2VideoPredictor
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    pred = SAM2VideoPredictor.from_pretrained(a.model, device=device)
    frames = sorted(Path(a.frames).glob("*.jpg"))
    pos, neg = pts(a.pos), pts(a.neg)
    with torch.inference_mode():
        state = pred.init_state(video_path=a.frames)
        pred.add_new_points_or_box(state, frame_idx=0, obj_id=1, points=np.array(pos + neg, dtype=np.float32),
                                   labels=np.array([1] * len(pos) + [0] * len(neg), dtype=np.int32))
        masks = {}
        for idx, _, logits in pred.propagate_in_video(state):
            # yumuşak kenar: logit → olasılık (sert eşik yerine), kenarda hafif bulanıklık
            masks[idx] = torch.sigmoid(logits[0, 0]).float().cpu().numpy()

    out = Path(a.out)
    mdir = out.parent / f"{out.name}_masks"
    rgba = out.parent / f"{out.name}_rgba"
    mdir.mkdir(parents=True, exist_ok=True)
    rgba.mkdir(parents=True, exist_ok=True)
    for i, fp in enumerate(frames):
        im = Image.open(fp).convert("RGB")
        m = Image.fromarray((np.clip((masks[i] - 0.3) / 0.4, 0, 1) * 255).astype(np.uint8))
        if a.feather > 0:
            m = m.filter(ImageFilter.GaussianBlur(a.feather))
        m.save(mdir / f"{i:05d}.png")
        im.putalpha(m)
        im.save(rgba / f"{i:05d}.png")
    src = str(rgba / "%05d.png")
    enc = lambda *args: subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", str(a.fps), "-i", src, *args], check=True)  # noqa: E731
    enc("-c:v", "prores_ks", "-profile:v", "4444", "-pix_fmt", "yuva444p10le", f"{out}_alpha.mov")
    enc("-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "0", "-crf", "24", f"{out}_alpha.webm")
    enc("-filter_complex", "color=c=0x00ff00:s=16x16[g];[g][0:v]scale2ref[g][v];[g][v]overlay=format=auto:shortest=1,format=yuv420p",
        "-frames:v", str(len(frames)), "-c:v", "libx264", "-crf", "18", f"{out}_green.mp4")  # color kaynağı sonsuz: kare sınırı şart
    print(f"[done] {len(frames)} kare · {device} · {out}_alpha.mov / _alpha.webm / _green.mp4")


if __name__ == "__main__":
    main()
