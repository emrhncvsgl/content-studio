"""Küçük örnekleyici: VSCO-2 CE (CC0) keman/çello bölümü ve org örneklerini nota listesinden çalar. sfizz gerektirmez.

Örnekler: tools/music/soundfonts/vsco2/ (git dışı; indirme: docs/music.md "VSCO-2"). Perde eşlemesi ölçüldü (librosa pyin, 2026-11-03):
  keman/çello dosya adındaki oktav bir eksik (VlnEns_susVib_A2 = A3), org Man3/Pedal numarası 3'er yarım ses (122 = C2, 064 = C2), güçlü org Rode_*_NN: midi = 23 + NN.
En yakın örnek seçilir, ±2 yarım ses içinde yeniden örneklemeyle kaydırılır; yaylıya yavaş giriş (swell), org'a kısa giriş verilir.
Örnekler 9-13 sn, daha uzun nota istenmez.
UYARI (EP014, 2026-11-12): susVib örneklerini kısaltarak spiccato/staccato TAKLİDİ yapma: yavaş yay girişi kesilince 0.1 sn'lik nota perdesiz hışırtı
olarak çıkıyor (librosa.pyin perde bulamadı; kullanıcı "diğer kısım sıkıntılı"). Kısa yaylı gerekiyorsa gerçek spiccato/pizz örneği ekle; yoksa
ritmi piyano (oktav tremolo) taşısın, yaylı yalnız uzun nota.

Kullanım (kütüphane): render([(t_sn, süre_sn, midi, hız), ...], "violins"|"cellos"|"organ") → stereo float32 (48 kHz)
"""
import re
from functools import lru_cache
from pathlib import Path

import librosa
import numpy as np

SR = 48000
ROOT = Path(__file__).resolve().parent / "soundfonts" / "vsco2"
NAMES = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}
# ad → (klasör, perde çıkarıcı, (giriş sn, bırakma sn))
INSTR = {
    "violins": ("Strings/Violin Section/susVib", "name", (0.35, 0.6)),
    "cellos": ("Strings/Cello Section/susvib", "name", (0.30, 0.7)),
    "organ": ("Keys/Organ/Quiet", "organ", (0.04, 0.35)),
    "organ-loud": ("Keys/Organ/Loud", "rode", (0.03, 0.45)),   # Rode_Man3Open/Pedal_NN: midi = 23 + NN (01 = C1)
}


def _pitch(path: Path, kind: str) -> int:
    s = path.stem
    if kind == "rode":
        return 23 + int(re.search(r"_(\d{2})$", s).group(1))
    if kind == "organ":
        n = int(re.search(r"_(\d{3})_", s).group(1))
        return 36 + (n - (122 if "Man3" in s else 64))
    m = re.search(r"_([A-G]#?)(\d)_", s)
    return 12 * (int(m.group(2)) + 2) + NAMES[m.group(1)]   # adın oktavı + 1


@lru_cache(None)
def _load(name: str):
    folder, kind, env = INSTR[name]
    out = []
    for f in sorted((ROOT / folder).glob("*.wav")):
        y, _ = librosa.load(f, sr=SR, mono=False)
        y = np.atleast_2d(y)
        if y.shape[0] == 1:
            y = np.vstack([y, y])
        rms = float(np.sqrt((y ** 2).mean()))
        out.append((_pitch(f, kind), rms, y.astype(np.float32)))
    return out, env


def render(notes, name: str, length: float | None = None) -> np.ndarray:
    smp, (att, rel) = _load(name)
    end = length or max(t + d for t, d, _, _ in notes) + rel + 1.0
    buf = np.zeros((2, int(end * SR)), np.float32)
    for t, d, midi, vel in notes:
        near = sorted(smp, key=lambda s: abs(s[0] - midi))
        cands = [s for s in near if s[0] == near[0][0]]
        cands.sort(key=lambda s: s[1])                      # sessizden yükseğe katmanlar
        base, _, y = cands[-1] if vel >= 70 and len(cands) > 1 else cands[0]
        shift = midi - base
        if shift:
            y = librosa.resample(y, orig_sr=SR * 2 ** (shift / 12), target_sr=SR)
        n = min(y.shape[1], int((d + rel) * SR))
        seg = y[:, :n].copy()
        env = np.ones(n, np.float32)
        a, r = int(att * SR), int(rel * SR)
        env[:a] = np.linspace(0, 1, a) ** 1.5
        hold = int(d * SR)
        if n > hold:
            env[hold:] *= np.linspace(1, 0, n - hold) ** 2
        seg *= env * (vel / 127) ** 1.6
        i = int(t * SR)
        k = min(n, buf.shape[1] - i)
        buf[:, i:i + k] += seg[:, :k]
    return buf
