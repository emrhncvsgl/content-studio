"""Geçiş akıcılık ölçümü: render'da her gelişmiş geçişin penceresinde kare kare hareket (ardışık kare farkı) ölçülür.

2026-11-12 (EP010, kullanıcı: "önceki sahne smooth kaybolmuyor, salise salise duruyor"): pullback 12 fps basamaklıydı (fark 41, 0.2, 40, 0.1 …)
ve hareket kesmede sıfıra iniyordu; disc match küçük diskte donmuş kareyle bekliyordu. Bu araç iki kalıbı yakalar:
  STUTTER: pencerede hareketli kareler arasında ≥ 3 "donuk" kare (fark < tepenin %3'ü) → basamaklı zaman.
  PARK: tepeden sonra, pencere bitmeden ≥ 8 kare boyunca hareket tepenin %2-8'inde sürünüyor (bir parça durup sönüyor).
Kullanım: voice/.venv-chatterbox/bin/python tools/transition_qc.py <bölüm klasörü> [--video render/X.mp4] [--only s13 s40]
Hafif (ffmpeg 128×72 gri çözme); yine de uzun videoda tek seferde çalıştır.
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

DEF = {"portal": (900, 900), "pullback": (450, 1500), "cardflip": (900, 400), "zoomblur": (300, 500), "whip": (250, 250), "slide": (380, 420),
       "objectWipe": (450, 550), "fog": (800, 900), "surfaceTilt": (280, 300), "disc": (280, 320), "matte": (280, 300), "door": (300, 300), "window": (280, 300)}


def motion(video: Path, a: float, d: float) -> np.ndarray:
    w, h = 128, 72
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{max(0, a):.3f}", "-t", f"{d:.3f}", "-i", str(video), "-vf", f"scale={w}:{h},format=gray",
                          "-f", "rawvideo", "-"], capture_output=True, check=True).stdout
    f = np.frombuffer(raw, np.uint8).reshape(-1, h, w).astype(np.int16)
    return np.abs(np.diff(f, axis=0)).mean(axis=(1, 2))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("episode")
    ap.add_argument("--video")
    ap.add_argument("--only", nargs="*")
    a = ap.parse_args()
    ep = Path(a.episode)
    tl = json.loads((ep / "timeline.json").read_text())
    fps = tl["fps"]
    video = Path(a.video) if a.video else ep / "render" / f"{ep.name.split('-')[0]}.mp4"
    bad = 0
    for sc in tl["scenes"]:
        k = sc.get("transition")
        if k not in DEF or (a.only and sc["id"] not in a.only):
            continue
        o = sc.get("transitionOpts") or {}
        pre, post = o.get("pre", DEF[k][0]) / 1000, o.get("post", DEF[k][1]) / 1000
        cut = sc["startFrame"] / fps
        m = motion(video, cut - pre, pre + post + 0.2)
        if len(m) < 4:
            continue
        pk = float(m.max())
        # donuk kare: iki yanında (±2 kare) hızlı hareket varken farkı ~0 olan kare (basamaklı zaman; yavaş yaklaşma sayılmaz)
        frozen = sum(1 for i in range(2, len(m) - 2) if m[i] < 0.03 * pk and m[i - 2:i].max() > 0.15 * pk and m[i + 1:i + 3].max() > 0.15 * pk)
        tail = m[int(np.argmax(m)):]
        crawl, run = 0, 0
        for x in tail:
            run = run + 1 if 0.02 * pk <= x <= 0.08 * pk else 0
            crawl = max(crawl, run)
        flags = (["STUTTER"] if frozen >= 3 else []) + (["PARK"] if crawl >= 8 else [])
        bad += bool(flags)
        print(f"{sc['id']} {k:11s} {cut:7.2f}s  tepe {pk:5.1f}  donuk {frozen:2d}  sürünme {crawl:2d} kare  {' '.join(flags) or 'ok'}")
    print(f"[{'KALDI' if bad else 'GEÇTİ'}] {bad} sorunlu geçiş ({video.name})")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
