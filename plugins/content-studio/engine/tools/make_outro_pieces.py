#!/usr/bin/env python3
"""Kapanış logosu, parça sürümü: logonun dört yırtık parçası (gövde, sol, sağ, sarı kare) farklı yönlerden stop-motion ile gelip T'yi kurar.
Parçalar brand_k ile logodaki aynı tohumlarla üretilir. Gerçek stop-motion gibi: 7,5 poz/sn (her poz dört kare), parçalar sırayla ve küçülen adımlarla masada itilir, her adımda elle konmuş gibi sapar; adım başına kısa kâğıt sesi.
Çalıştır: voice/.venv-chatterbox/bin/python tools/make_outro_pieces.py  → content/brand/outro/outro-pieces.mp4
16:9 (uzun video, EP009 2026-11-09): ... make_outro_pieces.py --landscape [--hold 2.5]  → outro/outro-pieces-16x9.mp4 (T küçülür, sona bekleyiş eklenir)"""
import math
import random
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, str(Path(__file__).parent))
import brand_k as k

OUT = k.ROOT / "content/brand/outro"
W, H, POSE_FPS, POSES = 1080, 1920, 7.5, 19
STEPS = [.20, .46, .68, .85, .96]     # konmadan önceki duraklar: gittikçe kısalan itişler
TW, TOP, SEED = 780, 480, 50            # T genişliği, üst kenarı, logonun t_seed'i
# ad, renk, tohum, doku, başlangıç (x, y kaydırma), başlangıç dönüşü, ilk poz, konma pozu
PLAN = [("S", k.CREAM, SEED + 1, "paper005", (70, 1000), 16, 0),
        ("L", k.CREAM, SEED + 2, "paper005", (-720, 110), -20, 3),
        ("R", k.CREAM, SEED + 3, "paper005", (720, -170), 18, 6),
        ("C", k.YEL, SEED + 4, "paper006", (-90, -760), -28, 9)]
LAND = {n[0]: n[6] + len(STEPS) for n in PLAN}
# ad, poz, dB, kırpma (sn)
SFX = [("paper_grab", n[6] + i, -19, .09) for n in PLAN for i in range(len(STEPS))]
SFX += [("thud_small", LAND[n], -10, 0) for n in "SLR"] + [("paper_drop", LAND["C"], -12, 0), ("thud_deep_loud", LAND["C"], -13, 0)]


def pieces():
    polys = dict(zip("LRSC", k.T_polys(W / 2, TOP, TW, SEED)))
    out = {}
    for name, col, seed, t, *_ in PLAN:
        im, xy = k.piece(polys[name], col, seed, t=t, rough=.05, rim=TW / 60)
        out[name] = (im, xy)
    return out


def stamp(base, im, xy, dx, dy, rot, lift):
    """Parçayı döndürüp koyar; yükseldikçe gölge açılır ve yumuşar."""
    if rot:
        im2 = im.rotate(rot, Image.BICUBIC, expand=True)
    else:
        im2 = im
    x = int(round(xy[0] + dx + (im.width - im2.width) / 2))
    y = int(round(xy[1] + dy + (im.height - im2.height) / 2))
    blur = 9 + lift * 22
    off = (9 + lift * 34, 13 + lift * 46)
    a = im2.getchannel("A").point(lambda v: int(v * (.62 - .2 * lift)))
    pad = int(blur * 3)
    sh = Image.new("L", (a.width + 2 * pad, a.height + 2 * pad), 0)
    sh.paste(a, (pad, pad))
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    base.paste((0, 0, 0, 255), (int(x + off[0] - pad), int(y + off[1] - pad)), sh)
    base.paste(im2, (x, y), im2)


def pose(p, ground, ps, r):
    base = ground.copy()
    for name, _, _, _, start, rot0, p0 in PLAN:
        if p < p0:
            continue
        im, xy = ps[name]
        if p >= LAND[name]:
            dx, dy, rot = r.uniform(-.8, .8), r.uniform(-.8, .8), r.uniform(-.12, .12)
            lift = .10 if p == LAND[name] else 0
        else:
            t = STEPS[p - p0]
            dx = start[0] * (1 - t) + r.uniform(-7, 7)
            dy = start[1] * (1 - t) + r.uniform(-7, 7)
            rot = rot0 * (1 - t) + r.uniform(-2.2, 2.2)
            lift = .22
        stamp(base, im, xy, dx, dy, rot, lift)
    a = np.asarray(k.light(base, .25).convert("RGB"), np.float32) * (1 + r.uniform(-.012, .012))
    return Image.fromarray(a.clip(0, 255).astype(np.uint8))


def mux(video, dst):
    sfx = k.ROOT / "content/sfx/pixabay"
    cmd = ["ffmpeg", "-y", "-v", "error", "-i", str(video)]
    chain = []
    for i, (name, p, db, trim, *rest) in enumerate(SFX):
        cmd += ["-i", str(sfx / f"{name}.wav")]
        ms = int(p / POSE_FPS * 1000)
        cut = f"atrim=0:{trim},afade=t=out:st={trim * .6:.3f}:d={trim * .4:.3f}," if trim else ""
        if rest:  # yumuşak giriş (sn): ani başlangıç tık/"pat" gibi duyulmasın
            cut = f"afade=t=in:st=0:d={rest[0]}," + cut
        chain.append(f"[{i + 1}:a]{cut}aformat=sample_rates=48000:channel_layouts=stereo,volume={db}dB,adelay={ms}|{ms}[a{i}]")
    mix = "".join(f"[a{i}]" for i in range(len(SFX)))
    dur = POSES / POSE_FPS
    chain.append(f"{mix}amix=inputs={len(SFX)}:normalize=0,afade=t=out:st={dur - .25}:d=0.25,atrim=0:{dur},alimiter=limit=.8[a]")
    subprocess.run(cmd + ["-filter_complex", ";".join(chain), "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac",
                          "-b:a", "256k", str(dst)], check=True)


def main():
    global W, H, TW, TOP, PLAN, POSES
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--landscape", action="store_true", help="1920x1080 (uzun video)")
    ap.add_argument("--hold", type=float, default=0.0, help="konmadan sonra ek bekleyiş (sn)")
    ap.add_argument("--soft", action="store_true", help="yalnız hafif kâğıt kayma sesleri (parça başına bir, yumuşak girişli); tok vuruş ve adım tıkı yok (kullanıcı 2026-11-09: logoda 'pat pat' gelmesin, müzik devam etsin)")
    a = ap.parse_args()
    name = "outro-pieces"
    if a.landscape:
        W, H, TW, TOP, name = 1920, 1080, 520, 250, "outro-pieces-16x9"
        PLAN = [(n, c, sd, t, (int(st[0] * .8), int(st[1] * .55)), r0, p0) for n, c, sd, t, st, r0, p0 in PLAN]
    POSES += int(round(a.hold * POSE_FPS))
    if a.soft:
        global SFX
        # 2026-11-11: adım başına paper_grab (0.09 sn, sert giriş) hâlâ "pat pat" duyuluyordu → kaldırıldı.
        # Parça başına tek kayma sesi, hareketle birlikte başlar, 120 ms yumuşak giriş, konmada söner.
        SFX = [("paper_slide_short", n[6], -27, .6, .12) for n in PLAN]
    OUT.mkdir(parents=True, exist_ok=True)
    ps = pieces()
    ground = k.ground((W, H), (22, 22, 22), 21, contrast=1.2)
    r = random.Random(7)
    with tempfile.TemporaryDirectory() as td:
        for p in range(POSES):
            pose(p, ground, ps, r).save(f"{td}/{p:03d}.png", compress_level=1)
        silent = OUT / f"{name}.silent.mp4"
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-framerate", str(POSE_FPS), "-i", f"{td}/%03d.png", "-vf", "fps=30", "-c:v", "libx264",
                        "-crf", "15", "-preset", "slow", "-pix_fmt", "yuv420p", str(silent)], check=True)
    mux(silent, OUT / f"{name}.mp4")


if __name__ == "__main__":
    main()
