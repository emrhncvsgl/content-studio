"""Ses efekti işleme (Pixabay ham mp3 → kullanıma hazır wav): pencere, highpass, fade, stereo, ortak oda yankısı, tepe −3 dBFS.

Kalite kuralları (2026-10-27, EP003 ses turu):
- Hepsi stereo 48 kHz. Hava/whoosh sesleri soldan sağa kayar (autopan) ve Haas ile genişler; nokta sesler (tık, pop) ortada kalır.
- Hepsine aynı kısa oda yankısı (sentetik IR, ~0.35 sn, %10 ıslak): farklı kaynaklardan gelen sesler aynı odada duyulsun.
- Ortam katmanları (room tone, projektör, tünel) yankısız, uzun fade ile; döngü olarak değil, sahne boyu kırpılarak kullanılır.
Kullanım: voice/.venv-chatterbox/bin/python tools/sfx_process.py [ad ...]   (ad yoksa hepsi)
"""
import sys
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf
from scipy.signal import butter, fftconvolve, sosfilt

D = Path(__file__).parent.parent / "content" / "sfx" / "pixabay"
SR = 48000
# ad: (pencere sn | None = tamamı | ("peak", sn) = doruğa kadar olan kısım, highpass Hz, fade_in, fade_out, tip)
# tip: air = autopan + geniş · point = orta, yankılı · bed = ortam, yankısız · wide = geniş, sabit
SPEC = {
    "match_strike": (None, 120, 0.002, 0.35, "point"), "match_strike_b": (None, 120, 0.002, 0.35, "point"),
    "match_burn": (None, 80, 0.25, 1.2, "bed"),   # EP009 s01 (kullanıcı indirdi 2026-11-08)
    "switch_on": (None, 150, 0.001, 0.12, "point"), "switch_off": (None, 150, 0.001, 0.12, "point"),   # EP009 eski elektrik anahtarı
    "plane_flyby": (None, 60, 0.8, 2.0, "air"), "gull_far": (None, 450, 0.3, 1.0, "wide"),          # EP009 s09-s10 Hazar
    "waves_calm": (None, 60, 1.5, 2.5, "bed"), "bulb_hum": (None, 70, 1.0, 1.5, "bed"),            # EP009 sahil yatağı, ampul vızıltısı
    "mine_bed": (None, 25, 2.0, 3.0, "bed"),                                                       # EP009 Perde 3 Vorkuta maden (endüstriyel uğultu)
    "paper_slide_short": (None, 120, 0.005, 0.12, "point"), "paper_slide_table": (1.2, 120, 0.03, 0.3, "wide"),
    "tape": (0.9, 150, 0.005, 0.15, "point"), "train_pass": (3.0, 40, 0.5, 1.0, "air"), "train_rush": (4.5, 40, 0.6, 1.2, "air"),
    "distant_bang": (None, 30, 0.003, 0.4, "wide"), "splash_big": (None, 60, 0.003, 0.3, "wide"),
    "splash_tiny": (None, 80, 0.003, 0.25, "point"), "pencil": (1.8, 200, 0.05, 0.3, "point"),
    "swoosh_thin": (None, 60, 0.01, 0.15, "air"), "window_rattle": (None, 80, 0.005, 0.6, "wide"),
    "swoosh_slow": (2.6, 60, 0.05, 0.4, "air"), "boom_swoosh": (2.5, 30, 0.01, 0.4, "air"),
    "air_whoosh": (None, 80, 0.01, 0.25, "air"), "air_swish": (1.5, 80, 0.01, 0.3, "air"),
    "thump_deep": (None, 25, 0.002, 0.2, "point"), "thud_small": (0.6, 60, 0.002, 0.15, "point"),
    "sub_drop": (2.0, 20, 0.002, 0.5, "wide"), "riser": (("peak", 2.6), 60, 0.4, 0.03, "air"),
    "paper_drop": (None, 100, 0.002, 0.1, "point"), "paper_rip": (None, 120, 0.002, 0.1, "wide"),
    "paper_rustle": (None, 120, 0.01, 0.15, "wide"), "paper_grab": (1.2, 120, 0.01, 0.2, "wide"),
    "crumple": (None, 120, 0.005, 0.1, "point"), "tape_rip": (1.0, 150, 0.005, 0.15, "point"),
    "thumb_tack": (0.5, 100, 0.002, 0.1, "point"), "stamp": (0.6, 60, 0.002, 0.15, "point"),
    "chalk": (2.0, 200, 0.03, 0.2, "point"), "marker": (1.5, 200, 0.03, 0.2, "point"),
    "click_soft": (None, 200, 0.001, 0.08, "point"), "pen_click": (0.4, 200, 0.001, 0.08, "point"),
    "pop_soft": (None, 150, 0.001, 0.08, "point"), "pop_clean": (0.6, 150, 0.001, 0.1, "point"),
    "tunnel_amb": (12.0, 30, 1.5, 1.5, "bed"), "wing_flap": (1.0, 150, 0.005, 0.15, "wide"),
    "air_hiss": (None, 100, 0.05, 0.3, "wide"), "room_tone": (12.0, 30, 1.0, 1.0, "bed"),
    "projector": (8.0, 60, 0.5, 0.5, "bed"), "vinyl": (8.0, 60, 0.5, 0.5, "bed"),
    # 2026-11-01 kullanıcının bulduğu "tok" sesler (EP004): vuruş, derin bas, sinematik hava
    "impact_boom3": (2.0, 25, 0.002, 0.5, "wide"), "impact_boom5": (1.8, 25, 0.002, 0.5, "wide"),
    "sub_drop_short": (2.2, 18, 0.002, 0.6, "wide"), "sub_bass_boom": (2.4, 18, 0.002, 0.6, "wide"),
    "thud_deep_loud": (1.4, 25, 0.002, 0.35, "point"), "huge_thump": (1.6, 25, 0.002, 0.4, "point"),
    "whoosh_cinematic": (None, 60, 0.01, 0.3, "air"), "whoosh_epic": (None, 50, 0.01, 0.3, "air"),
    "whoosh_hit": (2.4, 40, 0.01, 0.5, "air"), "riser_swoosh": (("peak", 2.4), 50, 0.3, 0.05, "air"),
    "riser_cinematic": (("peak", 2.4), 50, 0.3, 0.05, "air"), "book_drop": (0.9, 60, 0.002, 0.2, "point"),
    "page_flip": (1.0, 120, 0.005, 0.2, "wide"), "trailer_boom": (3.0, 20, 0.002, 0.8, "wide"),
    "cinematic_hit": (2.2, 25, 0.002, 0.6, "wide"),
}


def room_ir(seed=7, length=0.35, pre=0.008):
    rng = np.random.default_rng(seed)
    t = np.arange(int(length * SR)) / SR
    env = np.exp(-t / 0.075)
    ir = rng.standard_normal((2, len(t))) * env
    ir = sosfilt(butter(2, 5500, "lowpass", fs=SR, output="sos"), ir)   # koyu oda: yüksekler çabuk söner
    return np.concatenate([np.zeros((2, int(pre * SR))), ir], axis=1) / np.abs(ir).sum(axis=1, keepdims=True) * 18


IR = room_ir()


def window(y, win):
    if win is None:
        return y
    if isinstance(win, tuple):   # ("peak", sn): en yüksek ana kadar olan kısım (riser kesmede doruğa ulaşsın)
        env = np.convolve(np.abs(y).mean(axis=0)[::48], np.ones(20) / 20, "same")
        pk = int(env.argmax()) * 48
        return y[:, max(0, pk - int(win[1] * SR)):pk + int(0.12 * SR)]
    w = int(win * SR)
    if y.shape[-1] <= w:
        return y
    c = np.concatenate([[0], np.cumsum((y ** 2).mean(axis=0))])
    e = c[w:] - c[:-w]   # kayan pencere enerjisi
    i = int(np.argmax(e[::480])) * 480
    return y[:, i:i + w]


def process(name):
    win, hp, fi, fo, kind = SPEC[name]
    y, _ = librosa.load(D / "originals" / f"{name}.mp3", sr=SR, mono=False)
    y = np.atleast_2d(y)
    if y.shape[0] == 1:
        y = np.vstack([y, y])
    y = window(y, win)
    y = sosfilt(butter(2, hp, "highpass", fs=SR, output="sos"), y)
    n = y.shape[1]
    if kind == "air":      # soldan sağa kayan hava + Haas genişliği
        pan = np.linspace(-0.55, 0.55, n)
        y = np.vstack([y[0] * np.sqrt((1 - pan) / 2) * 1.41, y[1] * np.sqrt((1 + pan) / 2) * 1.41])
        y[1] = np.concatenate([np.zeros(int(0.006 * SR)), y[1][:-int(0.006 * SR)]])
    elif kind == "wide":
        y[1] = np.concatenate([np.zeros(int(0.004 * SR)), y[1][:-int(0.004 * SR)]])
    elif kind == "point":
        y = np.vstack([y.mean(axis=0)] * 2)
    ni, no = int(fi * SR), min(int(fo * SR), n)
    y[:, :ni] *= np.linspace(0, 1, ni)
    if not isinstance(win, tuple):   # 2026-11-08: fade-out kuru sese, yankıdan ÖNCE (önceden yalnız yankı kuyruğu sönüyor,
        y[:, n - no:] *= np.linspace(1, 0, no) ** 2   # kuru ses pencere sonunda sert kesiliyordu: thud_deep_loud 1.39 sn −32 dB/10 ms)
    if kind != "bed":      # ortak oda
        wet = np.vstack([fftconvolve(y[c], IR[c]) for c in range(2)])
        y = np.pad(y, ((0, 0), (0, wet.shape[1] - n)))
        y = y + 0.10 * wet
        n = y.shape[1]
    tail = min(int(0.05 * SR), n)    # yankı kuyruğunun ucu
    if isinstance(win, tuple):       # riser: doruğa kadar bilerek (kesmede vuruşla birleşir); eski davranış
        no = min(int(fo * SR), n); y[:, n - no:] *= np.linspace(1, 0, no) ** 2
    else:
        y[:, n - tail:] *= np.linspace(1, 0, tail)
    y = y / (np.abs(y).max() + 1e-9) * 10 ** (-3 / 20)
    sf.write(D / f"{name}.wav", y.T, SR, subtype="PCM_16")
    return round(n / SR, 2), kind


if __name__ == "__main__":
    for nm in sys.argv[1:] or SPEC:
        print(nm, *process(nm))
