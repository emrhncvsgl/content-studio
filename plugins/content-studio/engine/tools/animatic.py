"""Animatic (cinecode film-mode'dan, 2026-11-09): tam render'dan önce sahne başına 1-3 durağan kare + gerçek ses (anlatım, efekt, müzik).

Neden: 10 dk tam render ~1 saat; tempo, sahne sırası, müzik geçişleri ve sessizlikler bu taslakta ~5-10 dk'da görülür. Kullanıcı
"tempo doğru mu, müzik doğru yerde mi" kararını burada verir; hareket ve geçiş kalitesi tam render'da (ya da render_patch ile) bakılır.
Kare: sahnenin %55'i (giriş animasyonu bitmiş); --per-scene 2 → %30 ve %75, 3 → %20/%50/%80. Altyazılar karelerde görünür.
Ses: tools/mix_audio.py (Remotion'suz, saniyeler). Ağır iş sayılır (tarayıcı); render/TTS ile aynı anda çalıştırma.

Kullanım:
  voice/.venv-chatterbox/bin/python tools/animatic.py EP009 [--scale 0.5] [--per-scene 1] [--scenes s20 s21 ...]
  → render/<EP>.animatic.mp4 (--scenes ile yalnız o sahneler ve o aralığın sesi: render/<EP>.animatic.<ilk>-<son>.mp4)
"""
import argparse
import json
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PY = ROOT / "voice" / ".venv-chatterbox" / "bin" / "python"
POS = {1: [0.55], 2: [0.3, 0.75], 3: [0.2, 0.5, 0.8]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("episode")
    ap.add_argument("--scale", type=float, default=0.5)
    ap.add_argument("--per-scene", type=int, default=1, choices=[1, 2, 3])
    ap.add_argument("--scenes", nargs="+")
    a = ap.parse_args()
    ep = next((ROOT / "content" / "episodes").glob(f"{a.episode}*"))
    tl = json.loads((ep / "timeline.json").read_text())
    fps = tl.get("fps", 30)
    scenes = [s for s in tl["scenes"] if not a.scenes or s["id"] in a.scenes]
    frames, durs = [], []
    for s in scenes:
        pos = POS[a.per_scene]
        cuts = [0] + [round((pos[k] + pos[k + 1]) / 2 * s["durationFrames"]) for k in range(len(pos) - 1)] + [s["durationFrames"]]
        for k, p in enumerate(pos):
            frames.append(s["startFrame"] + int(p * s["durationFrames"]))
            durs.append((cuts[k + 1] - cuts[k]) / fps)
    lo, hi = scenes[0]["startFrame"], scenes[-1]["startFrame"] + scenes[-1]["durationFrames"]
    tag = f".{scenes[0]['id']}-{scenes[-1]['id']}" if a.scenes else ""
    out = ep / "render" / f"{tl['episode']}.animatic{tag}.mp4"
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        tl_rel = str((ep / "timeline.json").relative_to(ROOT / "content"))
        print(f"[animatic] {len(frames)} kare ({len(scenes)} sahne), ölçek {a.scale}", flush=True)
        subprocess.run(["node", "scripts/stills.mjs", tl_rel, str(td), str(a.scale), ",".join(map(str, frames))], cwd=ROOT / "studio", check=True)
        wav = td / "mix.wav"
        subprocess.run([str(PY), str(ROOT / "tools" / "mix_audio.py"), a.episode, "render/_animatic.wav"],
                       check=True, stdout=subprocess.DEVNULL)
        shutil.move(ep / "render" / "_animatic.wav", wav)
        lst = td / "list.txt"
        lst.write_text("".join(f"file 'f{i:04d}.jpg'\nduration {d:.4f}\n" for i, d in enumerate(durs)) + f"file 'f{len(durs) - 1:04d}.jpg'\n")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lst),
                        "-ss", f"{lo / fps:.3f}", "-t", f"{(hi - lo) / fps:.3f}", "-i", str(wav),
                        "-map", "0:v", "-map", "1:a", "-vf", f"fps={fps},format=yuv420p", "-c:v", "libx264", "-crf", "23", "-preset", "veryfast",
                        "-c:a", "aac", "-b:a", "192k", "-shortest", str(out)], check=True)
    print(f"[done] {out.relative_to(ROOT)} ({(hi - lo) / fps:.0f} sn)")


if __name__ == "__main__":
    main()
