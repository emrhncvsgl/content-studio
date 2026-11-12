"""Kamu malı (Public Domain) bir Mutopia MIDI'sinden kanalın kendi kaydını üretir: piyano (Salamander, fluidsynth) ya da org (VSCO-2, sampler.py).

Yalnızca lisansı "Public Domain" olan Mutopia notalarını kullan (CC BY-SA kaydı da paylaşımlı lisansa bağlar). Lisans: parça sayfası (piece-info).
Kullanım:
  voice/.venv-chatterbox/bin/python tools/music/render_pd.py <mid_url|dosya> <id> [--instr piano|organ] [--tempo 0.9] [--max 240]
Çıktı: tools/music/src/<id>.mid (kaynak) + content/music/own-<id>.wav (48 kHz, sabit kazançla −19.5 LUFS; loudnorm yok).
Sonra music.yaml'a satır ekle (source: nota URL'si, moods, attribution).
"""
import argparse
import struct
import subprocess
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
SALAMANDER = HERE / "soundfonts" / "SalamanderGrandPiano-V3+20200602.sf2"


def _vlq(d, i):
    v = 0
    while True:
        b = d[i]; i += 1
        v = (v << 7) | (b & 0x7F)
        if not b & 0x80:
            return v, i


def read_timed(path: Path):
    """→ [(başlangıç_sn, süre_sn, perde, hız)]; tempo haritası tüm izlerden toplanır."""
    d = path.read_bytes()
    _, ntrk, ppq = struct.unpack(">HHH", d[8:14])
    i, raw, tempos = 14, [], [(0, 500000)]
    for _ in range(ntrk):
        ln = struct.unpack(">I", d[i + 4:i + 8])[0]
        j, end, t, st, on = i + 8, i + 8 + ln, 0, 0, {}
        while j < end:
            dt, j = _vlq(d, j); t += dt
            if d[j] & 0x80:
                st = d[j]; j += 1
            if st == 0xFF:
                typ = d[j]; j += 1; l2, j = _vlq(d, j)
                if typ == 0x51:
                    tempos.append((t, int.from_bytes(d[j:j + 3], "big")))
                j += l2
            elif st in (0xF0, 0xF7):
                l2, j = _vlq(d, j); j += l2
            else:
                k, a = st & 0xF0, d[j]
                b = d[j + 1] if k not in (0xC0, 0xD0) else 0
                j += 1 if k in (0xC0, 0xD0) else 2
                if k == 0x90 and b > 0:
                    on.setdefault(a, []).append((t, b))
                elif k in (0x80, 0x90) and on.get(a):
                    s, v = on[a].pop(0); raw.append((s, t, a, v))
        i = end
    tempos.sort()

    def sec(tick):
        s, last_t, us = 0.0, 0, tempos[0][1]
        for tt, u in tempos[1:]:
            if tt >= tick:
                break
            s += (tt - last_t) * us / ppq / 1e6; last_t, us = tt, u
        return s + (tick - last_t) * us / ppq / 1e6

    return sorted((sec(s), sec(e) - sec(s), p, v) for s, e, p, v in raw)


def lufs(wav: Path) -> float:
    out = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(wav), "-af", "ebur128", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    return float([l for l in out.splitlines() if l.strip().startswith("I:")][-1].split()[1])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src"); ap.add_argument("id")
    ap.add_argument("--instr", default="piano", choices=["piano", "organ", "organ-loud"])
    ap.add_argument("--tempo", type=float, default=1.0, help="hız çarpanı (0.9 = %10 yavaş)")
    ap.add_argument("--max", type=float, default=300, help="en çok kaç sn")
    a = ap.parse_args()
    mid = HERE / "src" / f"{a.id}.mid"
    if a.src.startswith("http"):
        urllib.request.urlretrieve(a.src, mid)
    else:
        mid.write_bytes(Path(a.src).read_bytes())
    out = ROOT / "content" / "music" / f"own-{a.id}.wav"
    tmp = out.with_suffix(".raw.wav")
    if a.instr == "piano" and a.tempo == 1.0:
        subprocess.run(["fluidsynth", "-ni", "-q", "-r", "48000", "-g", "0.5", "-F", str(tmp), str(SALAMANDER), str(mid)], check=True)
    else:
        import numpy as np
        import soundfile as sf
        notes = [(s / a.tempo, d / a.tempo, p, v) for s, d, p, v in read_timed(mid) if s / a.tempo < a.max]
        if a.instr.startswith("organ"):
            from sampler import SR, render
            y = render([(s, max(d, .15), p, 60) for s, d, p, _ in notes], a.instr)
        else:  # yavaşlatılmış piyano: yeniden yazılmış MIDI fluidsynth'e
            from arrange import note, write_mid
            ev = [e for s, d, p, v in notes for e in note(0, int(s * 480), int(d * 480), p, v)]
            write_mid(tmp.with_suffix(".mid"), 480, 60, ev)
            subprocess.run(["fluidsynth", "-ni", "-q", "-r", "48000", "-g", "0.5", "-F", str(tmp), str(SALAMANDER),
                            str(tmp.with_suffix(".mid"))], check=True)
            tmp.with_suffix(".mid").unlink()
            y = None
        if y is not None:
            sf.write(tmp, (y / max(1e-6, np.abs(y).max()) * 0.5).T, SR)
    g = -19.5 - lufs(tmp)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-t", str(a.max), "-i", str(tmp), "-af",
                    f"volume={g:.2f}dB,alimiter=limit=0.8:level=false", "-ar", "48000", str(out)], check=True)
    tmp.unlink()
    print(f"[done] {out.relative_to(ROOT)} ({g:+.1f} dB)")


if __name__ == "__main__":
    main()
