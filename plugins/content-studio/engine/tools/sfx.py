"""Kodla üretilen ses efektleri (kullanıcı kararı 2026-10-20: lisans derdi yok, kanalın minimal tarzına uygun).

Kullanım: voice/.venv-chatterbox/bin/python tools/sfx.py        → content/sfx/*.wav (48 kHz, mono, tepe −3 dBFS)
Efektler deterministik (sabit seed); aynı komut aynı dosyaları üretir.
  whoosh   0.45 sn  bant geçiren gürültü süpürmesi (sahne geçişi)
  impact   0.9 sn   alçak vuruş + kısa gürültü (vurgu anı, hero kelime)
  pop      0.12 sn  kısa ton pıtırtısı (kelime/ikon belirmesi)
  tick     0.05 sn  çok kısa tık (sayaç, çizim)
  riser    1.6 sn   yükselen gürültü + ton (açıklamadan önce gerilim)
  test_bed 30 sn    GEÇİCİ müzik altlığı (yalnızca ducking testi; yayında kullanılmaz)
"""
from pathlib import Path
import wave

import numpy as np

SR = 48000
OUT = Path(__file__).parent.parent / "content" / "sfx"
rng = np.random.default_rng(7)


def t(d):
    return np.arange(int(SR * d)) / SR


def env(n, a=0.01, r=0.2, curve=3.0):
    """Atak-salınım zarfı (saniye)."""
    x = np.ones(n)
    na, nr = int(SR * a), int(SR * r)
    x[:na] = np.linspace(0, 1, na) if na else 1
    if nr:
        x[-nr:] *= np.linspace(1, 0, nr) ** curve
    return x


def bandsweep(noise, f0, f1, q=4.0):
    """Zamanla kayan basit iki kutuplu bant geçiren (durum değişkenli filtre)."""
    out = np.zeros_like(noise)
    lp = bp = 0.0
    fs = np.geomspace(f0, f1, len(noise))
    for i, x in enumerate(noise):
        f = 2 * np.sin(np.pi * fs[i] / SR)
        lp += f * bp
        hp = x - lp - bp / q
        bp += f * hp
        out[i] = bp
    return out


def norm(x, peak_db=-3.0):
    return x / (np.abs(x).max() + 1e-9) * 10 ** (peak_db / 20)


def write(name, x):
    OUT.mkdir(parents=True, exist_ok=True)
    pcm = (np.clip(x, -1, 1) * 32767).astype("<i2")
    with wave.open(str(OUT / f"{name}.wav"), "wb") as w:
        w.setnchannels(1), w.setsampwidth(2), w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f"  {name:9} {len(x) / SR:5.2f} sn")


def whoosh():
    n = int(SR * 0.45)
    x = bandsweep(rng.standard_normal(n), 300, 4000, q=2.5)
    e = np.sin(np.linspace(0, np.pi, n)) ** 2
    return norm(x * e)


def impact():
    tt = t(0.9)
    body = np.sin(2 * np.pi * (55 + 60 * np.exp(-tt * 18)) * tt) * np.exp(-tt * 5)
    click = rng.standard_normal(len(tt)) * np.exp(-tt * 60) * 0.5
    return norm(np.tanh((body + click) * 2.2))


def pop():
    tt = t(0.12)
    return norm(np.sin(2 * np.pi * (900 - 500 * tt / 0.12) * tt) * np.exp(-tt * 45))


def tick():
    tt = t(0.05)
    return norm(rng.standard_normal(len(tt)) * np.exp(-tt * 180) + np.sin(2 * np.pi * 2400 * tt) * np.exp(-tt * 120) * 0.6, -6)


def riser():
    tt = t(1.6)
    noise = bandsweep(rng.standard_normal(len(tt)), 200, 6000, q=3)
    tone = np.sin(2 * np.pi * np.cumsum(np.geomspace(110, 440, len(tt))) / SR) * 0.4
    e = (tt / tt[-1]) ** 2.2
    e[-int(SR * 0.03):] *= np.linspace(1, 0, int(SR * 0.03))
    return norm((noise + tone) * e)


def test_bed():
    """Yalnızca ducking testi için sakin bir ped: akorlar yavaşça değişir. Yayın müziği değil."""
    tt = t(30)
    chords = [(220.0, 277.18, 329.63), (196.0, 246.94, 293.66), (174.61, 220.0, 261.63), (196.0, 246.94, 329.63)]
    x = np.zeros_like(tt)
    for i, ch in enumerate(chords):
        seg = (tt >= i * 7.5) & (tt < (i + 1) * 7.5 + 0.5)
        for f in ch:
            x[seg] += np.sin(2 * np.pi * f * tt[seg]) * 0.3 + np.sin(2 * np.pi * f * 2.001 * tt[seg]) * 0.08
    x *= 0.6 + 0.4 * np.sin(2 * np.pi * 0.1 * tt)
    return norm(x * env(len(tt), 2.0, 2.0, 1.0), -6)


if __name__ == "__main__":
    print(f"[sfx] → {OUT}")
    for name, fn in [("whoosh", whoosh), ("impact", impact), ("pop", pop), ("tick", tick), ("riser", riser), ("test_bed", test_bed)]:
        write(name, fn())
