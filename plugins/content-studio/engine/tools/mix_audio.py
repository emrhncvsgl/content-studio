"""timeline.json'dan videonun sesini doğrudan karıştırır (Remotion'suz): anlatım + efektler + müzik (MusicBed ducking'iyle birebir).

Neden: Remotion yalnız ses render'ında bile her kareyi işler; 10 dk video ≈ 25 dk (EP009, 2026-11-09, kullanıcı "20 dk oldu yuh").
Bu araç aynı karışımı saniyeler içinde üretir; müzik/efekt/seviye değişikliğinde görüntü render'ı gerekmez.
Kurallar studio/src/compositions/ShortsVideo.tsx (anlatım: sahne başı + audioStartFrame; sfx: frame, gainDb, durationFrames (vars. 2 sn),
fadeOutFrames) ve components/audio/MusicBed.tsx (loop; fadeIn/Out; ducking: kelimeden 150 ms önce, 300 ms sonra, 8 kare rampa;
steadyUntilFrame) ile aynı. Kurallar orada değişirse burası da değişir (karşılaştırma: --compare <remotion.wav>).

Kullanım:
  voice/.venv-chatterbox/bin/python tools/mix_audio.py EP009 render/EP009.audio.wav [--video render/EP009-v4.mp4 --out render/EP009-v5.mp4]
"""
import argparse
import json
import math
import subprocess
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent
SR = 48000
_cache: dict = {}


def load(rel: str) -> np.ndarray:
    if rel not in _cache:
        y, _ = librosa.load(str(ROOT / "content" / rel), sr=SR, mono=False)
        y = np.atleast_2d(y)
        # mono kaynak iki kanala −3 dB (pan yasası; Remotion ile ölçülerek eşlendi, EP009 medyan fark 2.95 dB idi)
        _cache[rel] = np.vstack([y, y]) / np.sqrt(2) if y.shape[0] == 1 else y[:2]
    return _cache[rel]


def place(mix, y, at, gain=1.0, dur=None, env=None):
    a = int(round(at))
    if dur is not None:
        y = y[:, :int(round(dur))]
    if a < 0:
        y, a = y[:, -a:], 0
    n = min(y.shape[1], mix.shape[1] - a)
    if n <= 0:
        return
    seg = y[:, :n] * gain
    if env is not None:
        seg = seg * env[:n]
    mix[:, a:a + n] += seg


def speech_mask(tl, fps, lang, total):
    m = np.zeros(total)
    for sc in tl["scenes"]:
        for w in sc["words"].get(lang, []):
            a = sc["startFrame"] + math.floor((w["startMs"] - 150) / 1000 * fps)
            b = sc["startFrame"] + math.ceil((w["endMs"] + 300) / 1000 * fps)
            m[max(0, a):min(total, b)] = 1
    out = m.copy()
    for f in range(1, total):
        out[f] = max(out[f], out[f - 1] - 1 / 8)
    for f in range(total - 2, -1, -1):
        out[f] = max(out[f], out[f + 1] - 1 / 8)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("episode")
    ap.add_argument("wav", help="bölüm klasörüne göre çıktı WAV")
    ap.add_argument("--video", help="görüntüsü kullanılacak video (bölüm klasörüne göre)")
    ap.add_argument("--out", help="ses + görüntü birleşik çıktı (bölüm klasörüne göre)")
    ap.add_argument("--compare", help="Remotion'un ürettiği WAV ile fark (doğrulama)")
    ap.add_argument("--only", choices=["narration", "sfx", "music"], help="tek kanal (stem): ses sorununu kanala ayırmak için (EP010 çıt araması)")
    a = ap.parse_args()
    ep = next((ROOT / "content" / "episodes").glob(f"{a.episode}*"))
    tl = json.loads((ep / "timeline.json").read_text())
    fps = tl.get("fps", 30)
    lang = tl["captions"]["lang"]
    total = tl.get("durationInFrames") or sum(s["durationFrames"] for s in tl["scenes"])
    spf = SR / fps
    mix = np.zeros((2, int(total * spf)))
    use = lambda k: a.only in (None, k)
    for sc in tl["scenes"]:                                   # anlatım
        if use("narration") and sc["audio"].get(lang):
            place(mix, load(sc["audio"][lang]), (sc["startFrame"] + sc.get("audioStartFrame", 0)) * spf,
                  dur=(sc["durationFrames"] - sc.get("audioStartFrame", 0)) * spf)
    for e in (tl["sfx"] if use("sfx") else []):              # efektler
        dur = e.get("durationFrames") or round(fps * 2)
        fade = e.get("fadeOutFrames") or 0
        n = int(dur * spf)
        env = np.ones(n)
        if fade > 0:
            k = int(fade * spf)
            env[n - k:] = np.linspace(1, 0, k)
        place(mix, load(e["file"]), e["frame"] * spf, gain=10 ** (e["gainDb"] / 20), dur=n, env=env)
    m = tl.get("music") if use("music") else None
    if m:                                                     # müzik (loop + ducking, kare başına kazanç)
        y = load(m["file"])
        start = m.get("startFrame", 0)
        need = int((total - start) * spf)
        reps = int(np.ceil(need / y.shape[1]))
        y = np.tile(y, (1, reps))[:, :need]
        duck = speech_mask(tl, fps, lang, total)
        f = np.arange(start, total)
        fi, fo = m.get("fadeInFrames", 0), m.get("fadeOutFrames", 0)
        fade = np.interp(f, [start, start + fi, total - fo, total], [0, 1, 1, 0])
        s = m.get("steadyUntilFrame")
        d = np.interp(f, [s, s + 2 * fps], [1, 0]) if s is not None else duck[f]
        g = 10 ** ((m["gainDb"] + d * m["duckDb"]) / 20) * fade
        # kare başına kazanç örnek düzeyinde doğrusal ara değerlenir (np.repeat basamakları kısma rampasında "zipper" tık yapabilir)
        gs = np.interp(np.arange(need) / spf, np.arange(len(g)) + 0.5, g)
        place(mix, y[:, :len(gs)] * gs, start * spf)
    out = ep / a.wav
    out.parent.mkdir(parents=True, exist_ok=True)   # ilk çıktıda render/ yok (EP010 animatic)
    peak = np.abs(mix).max()
    sf.write(out, mix.T, SR, subtype="PCM_24")
    print(f"[mix] {out.relative_to(ROOT)} {total / fps:.1f} sn · tepe {20 * np.log10(peak + 1e-9):.1f} dBFS")
    if a.compare:
        r, _ = librosa.load(str(ep / a.compare), sr=SR, mono=True)
        x = mix.mean(0)[:len(r)]
        r = r[:len(x)]
        err = 10 * np.log10(np.mean((x - r) ** 2) / (np.mean(r ** 2) + 1e-12) + 1e-12)
        print(f"[karşılaştırma] fark enerjisi / sinyal = {err:.1f} dB (≤ −30 dB iyi)")
    if a.video and a.out:
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(ep / a.video), "-i", str(out), "-map", "0:v", "-map", "1:a",
                        "-c:v", "copy", "-c:a", "aac", "-b:a", "320k", "-shortest", str(ep / a.out)], check=True)
        print(f"[done] {(ep / a.out).relative_to(ROOT)}")


if __name__ == "__main__":
    main()
