"""Chatterbox çıktısına son işlem varyantları: ton eşleştirme EQ ve hafif gürültü temizleme.

EQ: hedef sesin (Qwen VoiceDesign orijinali) uzun süreli ortalama spektrumu (LTAS) ile kaynak klasörün LTAS'ı
1/3 oktav bantlarda karşılaştırılır; fark 500 Hz-2 kHz ortalamasına göre sıfırlanır, 3 bantla yumuşatılır, ±6 dB ile
sınırlanır ve ffmpeg `firequalizer` ile uygulanır. Böylece klon, orijinalin parlaklığına yaklaşır (boğukluk).
Gürültü: ffmpeg `afftdn` (hafif, nr=10 dB), EQ'dan ÖNCE (EQ tiz gürültüyü de yükseltmesin diye).

Kullanım: .venv-chatterbox/bin/python tests/post_variants.py tests/out/vsteps/steps25 [--target tests/out/design/A_deep_nature.wav]
Çıktı: <kaynak>_eq/ ve <kaynak>_dn_eq/
"""
import argparse
import subprocess
from pathlib import Path

import librosa
import numpy as np

ROOT = Path(__file__).parent.parent.parent


def ltas(paths, sr=24000, n_fft=4096):
    acc, n = 0, 0
    for p in paths:
        y, _ = librosa.load(str(p), sr=sr)
        S = np.abs(librosa.stft(y, n_fft=n_fft, hop_length=1024)) ** 2
        e = S.sum(0)
        S = S[:, e > np.percentile(e, 40)]  # konuşma kareleri
        acc = acc + S.sum(1); n += S.shape[1]
    return librosa.fft_frequencies(sr=sr, n_fft=n_fft), acc / n


def eq_curve(target, source):
    f, T = ltas(target)
    _, S = ltas(source)
    centers = 1000 * 2 ** (np.arange(-11, 11) / 3)  # ~80 Hz - 10 kHz, 1/3 oktav
    centers = centers[(centers > 80) & (centers < 10500)]
    gains = []
    for c in centers:
        band = (f > c / 2 ** (1 / 6)) & (f < c * 2 ** (1 / 6))
        gains.append(10 * np.log10(T[band].mean() / S[band].mean()))
    g = np.array(gains)
    g -= g[(centers >= 500) & (centers <= 2000)].mean()
    g = np.convolve(np.pad(g, 1, mode="edge"), np.ones(3) / 3, mode="valid")
    g[centers < 150] = np.minimum(g[centers < 150], 0)  # bası yükseltme (uğultu riski)
    return centers, np.clip(g, -6, 6)


def run(src: Path, dst: Path, af: str):
    dst.mkdir(exist_ok=True)
    for p in sorted(src.glob("s0*.wav")):
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(p), "-af", af + ",alimiter=limit=0.89:level=false",
                        "-ar", "24000", str(dst / p.name)], check=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("--target", default=str(ROOT / "voice/tests/out/design/A_deep_nature.wav"))
    args = ap.parse_args()
    src = Path(args.src)
    centers, g = eq_curve([args.target], sorted(src.glob("s0*.wav")))
    print("EQ eğrisi (Hz: dB):", ", ".join(f"{c:.0f}:{v:+.1f}" for c, v in zip(centers, g)))
    eq = "firequalizer=gain_entry='" + ";".join(f"entry({c:.0f},{v:.2f})" for c, v in zip(centers, g)) + "'"
    dn = "afftdn=nr=10:nf=-55:tn=1"
    run(src, src.parent / f"{src.name}_eq", eq)
    run(src, src.parent / f"{src.name}_dn_eq", dn + "," + eq)
    (src.parent / f"{src.name}_eq_curve.txt").write_text(eq + "\n")
    print("[done]", src.parent / f"{src.name}_eq", src.parent / f"{src.name}_dn_eq")


if __name__ == "__main__":
    main()
