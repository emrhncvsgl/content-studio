"""Uzun videoyu parça parça render eder (disk ve Chrome bellek sızıntısı için), sesi tek parça render edip birleştirir.

Neden: remotion.config.ts PNG ara kare kullanır (renk aralığı, QA EP001); 1080p'de kare başı ~3 MB → 10 dk video ≈ 50 GB geçici
dosya. EP009'da (2026-11-08) 7008 karelik render 15 dk sonra ENOSPC ile düştü. Parça başı ~1500 kare ≈ 4-5 GB.
Görüntü parçaları sessiz (--muted) render edilir, ffmpeg concat ile kayıpsız birleşir; ses ayrı tek WAV (parça sınırında tık olmaz).

Kullanım:
  voice/.venv-chatterbox/bin/python tools/render_chunked.py EP009 render/EP009.mp4 [--frames 0-7007] [--chunk 1500] [--keep]
Hızlı yol (2026-11-12): ... --video-only, ardından mix_audio.py <EP> render/X.audio.wav --video render/X.silent.mp4 --out render/X.mp4.
Yalnız ses değiştiyse (müzik, efekt, seviye): ... render_chunked.py EP009 render/EP009-v5.mp4 --audio-from render/EP009-v4.mp4 (~3 dk).
Çıktı yolu bölüm klasörüne göredir. Ağır iştir: başka render/TTS ile aynı anda çalıştırma. Yarıda kalırsa tekrar çalıştır:
bitmiş parçalar (render/_chunks/) atlanır.
"""
import argparse
import json
import shutil
import subprocess
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from platform_util import remotion  # noqa: E402  (Windows: npx.cmd yerine node + remotion-cli.js)

ROOT = Path(__file__).resolve().parent.parent
STUDIO = ROOT / "studio"


def remotion(args: list[str]):
    subprocess.run([*remotion(), "render", "src/index.ts", "ShortsVideo", *args, "--timeout=180000", "--log=error"],
                   cwd=STUDIO, check=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("episode")
    ap.add_argument("out", help="bölüm klasörüne göre, ör. render/EP009.mp4")
    ap.add_argument("--frames", help="a-b (dahil); yoksa tüm timeline")
    ap.add_argument("--chunk", type=int, default=1500)
    ap.add_argument("--keep", action="store_true", help="parçaları silme")
    ap.add_argument("--video-only", action="store_true", help="sessiz görüntü; ses sonra tools/mix_audio.py ile (Remotion ses render'ı ~25 dk, mix_audio saniyeler)")
    ap.add_argument("--audio-from", help="yalnız ses değişti (müzik/sfx): bu videonun görüntüsü korunur, yalnız ses render edilip birleşir (~3 dk)")
    a = ap.parse_args()
    ep = next((ROOT / "content" / "episodes").glob(f"{a.episode}*"))
    tl_rel = (ep / "timeline.json").relative_to(ROOT / "content").as_posix()
    tl = json.loads((ep / "timeline.json").read_text())
    total = sum(s["durationFrames"] for s in tl["scenes"])
    lo, hi = (map(int, a.frames.split("-")) if a.frames else (0, total - 1))
    props = f"--props={json.dumps({'timeline': tl_rel})}"
    out = ep / a.out
    cdir = ep / "render" / "_chunks"
    cdir.mkdir(parents=True, exist_ok=True)
    if a.audio_from:   # görüntü aynı: yalnız ses
        wav = cdir / f"{out.stem}.audio.wav"
        print(f"[audio] kare {lo}-{hi} → {wav.name}", flush=True)
        remotion([str(wav), props, f"--frames={lo}-{hi}", "--codec=wav"])
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(ep / a.audio_from), "-i", str(wav), "-map", "0:v", "-map", "1:a",
                        "-c:v", "copy", "-c:a", "aac", "-b:a", "320k", "-shortest", str(out)], check=True)
        if not a.keep:
            shutil.rmtree(cdir)
        print(f"[done] {out.relative_to(ROOT)} (yalnız ses yenilendi)"); return
    parts = []
    for i, s in enumerate(range(lo, hi + 1, a.chunk)):
        e = min(hi, s + a.chunk - 1)
        p = cdir / f"{out.stem}.{i:03d}.{s}-{e}.mp4"
        parts.append(p)
        if p.exists():
            print(f"[skip] {p.name}"); continue
        print(f"[video] kare {s}-{e} → {p.name}", flush=True)
        tmp = p.with_suffix(".part.mp4")
        remotion([str(tmp), props, f"--frames={s}-{e}", "--muted"])
        tmp.rename(p)
    lst = cdir / f"{out.stem}.concat.txt"
    if a.video_only:
        lst.write_text("".join(f"file '{p.name}'\n" for p in parts))
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(out)], check=True)
        if not a.keep:
            shutil.rmtree(cdir)
        print(f"[done] {out.relative_to(ROOT)} (sessiz; ses: tools/mix_audio.py)"); return
    wav = cdir / f"{out.stem}.audio.wav"
    print(f"[audio] kare {lo}-{hi} → {wav.name}", flush=True)
    remotion([str(wav), props, f"--frames={lo}-{hi}", "--codec=wav"])
    lst.write_text("".join(f"file '{p.name}'\n" for p in parts))
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-i", str(wav),
                    "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "320k", "-shortest", str(out)], check=True)
    if not a.keep:
        shutil.rmtree(cdir)   # yalnızca bu aracın kendi ara dosyaları
    print(f"[done] {out.relative_to(ROOT)} ({(hi - lo + 1) / tl.get('fps', 30):.1f} sn)")


if __name__ == "__main__":
    main()
