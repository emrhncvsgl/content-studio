"""Yalnız değişen sahneleri yeniden render edip var olan videoya yerleştirir (tam render ~1 saat yerine ~15 dk).

Sahne aralığı ±PAD kare genişletilir (komşu sahnenin geçiş penceresi bu sahnenin dondurulmuş karesini gösterebilir). Yamalar sessiz render
edilir; temel videonun geri kalanı kare doğruluğuyla kesilip birleştirilir ve bir kez yeniden kodlanır (yuv420p, crf 15). Ses ayrı verilir
(tools/mix_audio.py çıktısı) ya da temel videodan alınır.

Kullanım:
  voice/.venv-chatterbox/bin/python tools/render_patch.py EP009 --scenes s33 s48 s59 --base render/EP009-v6.mp4 --out render/EP009-v7.mp4 \\
      [--audio render/EP009.audio.wav]
Timeline sahne süreleri temel videoyla aynı olmalı (süre değiştiyse tam render: tools/render_chunked.py).
"""
import argparse
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAD = 30


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("episode", help="bölüm kimliği (EP012), klasör yolu değil")
    ap.add_argument("--scenes", nargs="+", required=True)
    ap.add_argument("--base", required=True, help="bölüm klasörüne göre (ör. render/EP012.mp4)")
    ap.add_argument("--out", required=True, help="bölüm klasörüne göre (ör. render/EP012.v2.mp4)")
    ap.add_argument("--audio")
    a = ap.parse_args()
    ep = next((ROOT / "content" / "episodes").glob(f"{a.episode}*"))
    tl = json.loads((ep / "timeline.json").read_text())
    fps = tl.get("fps", 30)
    total = sum(s["durationFrames"] for s in tl["scenes"])
    rngs = []
    for s in tl["scenes"]:
        if s["id"] in a.scenes:
            rngs.append([max(0, s["startFrame"] - PAD), min(total - 1, s["startFrame"] + s["durationFrames"] - 1 + PAD)])
    rngs.sort()
    merged = []
    for r in rngs:   # çakışan aralıkları birleştir
        if merged and r[0] <= merged[-1][1] + 1:
            merged[-1][1] = max(merged[-1][1], r[1])
        else:
            merged.append(r)
    tl_rel = str((ep / "timeline.json").relative_to(ROOT / "content"))
    pdir = ep / "render" / "_patch"
    pdir.mkdir(parents=True, exist_ok=True)
    patches = []
    for lo, hi in merged:
        p = pdir / f"p_{lo}-{hi}.mp4"
        print(f"[yama] kare {lo}-{hi} ({(hi - lo + 1) / fps:.1f} sn)", flush=True)
        subprocess.run(["npx", "remotion", "render", "src/index.ts", "ShortsVideo", str(p), f"--props={json.dumps({'timeline': tl_rel})}",
                        f"--frames={lo}-{hi}", "--muted", "--timeout=180000", "--log=error"], cwd=ROOT / "studio", check=True)
        patches.append((lo, hi, p))
    # filtre: temel videonun aralıkları + yamalar, kare numarasıyla
    inputs, parts, cur, k = ["-i", str(ep / a.base)], [], 0, 0
    for i, (lo, hi, p) in enumerate(patches):
        inputs += ["-i", str(p)]
        if lo > cur:
            parts.append(f"[0:v]trim=start_frame={cur}:end_frame={lo},setpts=PTS-STARTPTS[v{k}]"); k += 1
        parts.append(f"[{i + 1}:v]setpts=PTS-STARTPTS[v{k}]"); k += 1
        cur = hi + 1
    if cur < total:
        parts.append(f"[0:v]trim=start_frame={cur}:end_frame={total},setpts=PTS-STARTPTS[v{k}]"); k += 1
    fc = ";".join(parts) + ";" + "".join(f"[v{j}]" for j in range(k)) + f"concat=n={k}:v=1:a=0[v]"
    audio = ["-i", str(ep / a.audio)] if a.audio else []
    amap = ["-map", f"{len(patches) + 1}:a"] if a.audio else ["-map", "0:a"]
    subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, *audio, "-filter_complex", fc, "-map", "[v]", *amap,
                    "-c:v", "libx264", "-crf", "15", "-preset", "medium", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "320k",
                    "-shortest", str(ep / a.out)], check=True)
    for _, _, p in patches:
        p.unlink()
    print(f"[done] {(ep / a.out).relative_to(ROOT)}")


if __name__ == "__main__":
    main()
