"""Doğa ambiyansı sentezi (2026-11-09, IYH001): rüzgâr, kum fırtınası, okyanus dalgası, yelken. Çıktı content/sfx/synth/ (kanalın kendi
ürettiği ses, CC0; sources.csv'ye yazılır). Neden: kütüphanede yalnız waves_calm vardı; Commons'ta işe yarar rüzgâr/kum kaydı yok.
Filtrelenmiş gürültü + yavaş rastgele zarf gerçek rüzgârın fiziğine yakındır (türbülans = bant geçiren gürültü, esinti = düşük frekanslı
genlik ve merkez frekans oynaması). Gerçek kayıt bulunursa o tercih edilir (hafıza: no-game-sfx); bu dosyalar ambiyans yatağı içindir,
fiziksel olay sesi (darbe, kapı) için değil.

Kullanım: voice/.venv-chatterbox/bin/python tools/ambience.py [--seconds 20]
  → content/sfx/synth/{wind_desert, wind_gusts, sandstorm, ocean_swell}.wav (48 kHz stereo, −20 LUFS civarı, döngüye uygun uçlar)
"""
import argparse
import csv
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy import signal

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "content" / "sfx" / "synth"
SR = 48000
rng = np.random.default_rng(7)


def slow(n, rate_hz, lo=0.0, hi=1.0, smooth=4):
    """Yumuşak rastgele zarf (esinti): rate_hz'de rastgele noktalar, kübik ara değer."""
    k = max(4, int(n / SR * rate_hz) + 4)
    pts = rng.random(k)
    for _ in range(smooth):
        pts = np.convolve(pts, [0.25, 0.5, 0.25], mode="same")
    pts = (pts - pts.min()) / (np.ptp(pts) + 1e-9)
    x = np.interp(np.linspace(0, k - 1, n), np.arange(k), pts)
    return lo + (hi - lo) * x


def bandnoise(n, f_center, q, color="pink"):
    """Değişken merkez frekanslı bant gürültü: blok blok biquad (merkez dizisi f_center)."""
    w = rng.standard_normal(n)
    if color == "pink":
        b, a = [0.049922, -0.095993, 0.050613, -0.004408], [1, -2.494956, 2.017265, -0.522189]
        w = signal.lfilter(b, a, w)
    elif color == "brown":
        w = np.cumsum(w); w -= signal.savgol_filter(w, 4001, 1)
    out = np.zeros(n)
    blk = 2048
    zi = None
    for i in range(0, n, blk):
        fc = float(np.mean(f_center[i:i + blk])) if hasattr(f_center, "__len__") else f_center
        b, a = signal.iirpeak(min(fc, SR / 2 - 100) / (SR / 2), q)
        if zi is None:
            zi = signal.lfilter_zi(b, a) * 0
        out[i:i + blk], zi = signal.lfilter(b, a, w[i:i + blk], zi=zi)
    return out


def stereo(x, width=0.35):
    d = int(0.011 * SR)
    l, r = x, np.concatenate([x[d:], x[:d]])
    m = (l + r) / 2
    return np.stack([m + width * (l - m), m + width * (r - m)], 1)


def fade_loop(x, sec=1.5):
    k = int(sec * SR)
    e = np.linspace(0, 1, k)
    x[:k] *= e[:, None] if x.ndim == 2 else e
    x[-k:] *= e[::-1][:, None] if x.ndim == 2 else e[::-1]
    return x


def level(x, db=-20.0):
    rms = np.sqrt(np.mean(x ** 2)) + 1e-12
    x = x * (10 ** (db / 20) / rms)
    return np.clip(x, -0.98, 0.98)


def wind(n, base=380, spread=260, gust_rate=0.35, q=1.2):
    g = slow(n, gust_rate, 0.25, 1.0)
    fc = base + spread * slow(n, gust_rate * 1.3)
    low = bandnoise(n, fc, q)
    whistle = bandnoise(n, fc * 2.4, 12) * (g ** 2) * 0.35       # esintide hafif ıslık
    rumble = signal.lfilter(*signal.butter(2, 120 / (SR / 2)), rng.standard_normal(n)) * 0.6
    return (low * g + whistle + rumble * g * 0.5)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seconds", type=float, default=20)
    a = ap.parse_args()
    n = int(a.seconds * SR)
    OUT.mkdir(parents=True, exist_ok=True)
    files = {}
    files["wind_desert"] = level(fade_loop(stereo(wind(n, 320, 180, 0.22))), -21)
    files["wind_gusts"] = level(fade_loop(stereo(wind(n, 520, 420, 0.6, 0.9), 0.5)), -19)
    # kum fırtınası: güçlü rüzgâr + yüksek bant kum hışırtısı + taneli çıtırtı (seyrek darbeler)
    s_wind = wind(n, 600, 500, 0.5, 0.8)
    hiss = bandnoise(n, 4200 + 1800 * slow(n, 0.4), 0.8) * slow(n, 0.5, 0.3, 1.0)
    grains = (rng.random(n) < 0.00025) * rng.standard_normal(n)   # seyrek: yoğun olunca cızırtı/statik gibi (v1 spektrogramı)
    grains = signal.lfilter(*signal.butter(2, [2500 / (SR / 2), 9000 / (SR / 2)], "band"), grains) * 6
    hiss = signal.lfilter(*signal.butter(2, 7000 / (SR / 2)), hiss)   # 7 kHz üstü kesilir (cızırtı yok)
    files["sandstorm"] = level(fade_loop(stereo(s_wind + hiss * 0.35 + grains * slow(n, 0.5, 0.2, 1) * 0.6, 0.6)), -20)
    # okyanus: kahverengi gürültü, 7-10 sn'lik dalga zarfı (kabarma + çekilme köpüğü)
    t = np.arange(n) / SR
    swell = (0.5 + 0.5 * np.sin(2 * np.pi * t / 8.5 + 0.7 * np.sin(2 * np.pi * t / 23))) ** 2.2
    body = signal.lfilter(*signal.butter(2, 700 / (SR / 2)), rng.standard_normal(n))
    foam = bandnoise(n, 2500 + 1500 * swell, 0.7) * np.roll(swell, int(1.2 * SR)) * 0.5
    files["ocean_swell"] = level(fade_loop(stereo(body * (0.25 + swell) + foam, 0.5)), -20)
    # yelken çırpınması sentezi denendi, fazla düzenli/makine gibi (IYH001 v1): gemi için gerçek ip/ahşap gıcırtısı kayıtları kullanılır
    rows = []
    for name, x in files.items():
        p = OUT / f"{name}.wav"
        sf.write(p, x.astype(np.float32), SR, subtype="PCM_16")
        rows.append({"file": f"sfx/synth/{name}.wav", "source": "tools/ambience.py (kanalın kendi sentezi)", "license": "CC0 (kanal)",
                     "note": f"{a.seconds:.0f} sn, döngüye uygun; IYH001"})
        print(f"[ambience] {p.relative_to(ROOT)}")
    with (OUT / "sources.csv").open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader(); w.writerows(rows)


if __name__ == "__main__":
    main()
