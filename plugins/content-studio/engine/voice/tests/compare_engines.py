"""İki motorun aynı referans + aynı metinle ürettiği sesleri nesnel ölçütlerle karşılaştırır.

Ölçütler (sahne başına, sonra ortalama):
  hız         : kelime/sn (Whisper kelimeleri), duraklama oranı
  tonlama     : F0 ortalaması, F0 aralığı (5-95 yüzdelik, yarım ton), F0 oynaklığı
  parlaklık   : spektral merkez (Hz), 4-8 kHz enerji payı (boğukluk ↔ parlaklık)
  kararlılık  : perde titremesi (ardışık F0 farkı, cent), harmonik/gürültü oranı (HNR, dB),
                sesli bölümde spektral akı (dalgalanma göstergesi)
  kimlik      : referansa konuşmacı benzerliği (Chatterbox ses kodlayıcısı)

Kullanım: .venv-chatterbox/bin/python tests/compare_engines.py <klasör1> <klasör2> [--ref voice/refs/x.wav] [--orig x.wav]
"""
import argparse
import json
import sys
from pathlib import Path

import librosa
import numpy as np

sys.path.insert(0, str(Path(__file__).parent.parent))
import asr  # noqa: E402

ROOT = Path(__file__).parent.parent.parent


def voice_encoder():
    from huggingface_hub import hf_hub_download
    from safetensors.torch import load_file
    from chatterbox.models.voice_encoder import VoiceEncoder
    ve = VoiceEncoder()
    ve.load_state_dict(load_file(hf_hub_download("ResembleAI/chatterbox", "ve.safetensors")))
    return ve.eval()


def features(path: Path, ve, ref_emb, lang="en") -> dict:
    y, sr = librosa.load(str(path), sr=24000)
    dur = len(y) / sr
    # hız
    _, words = asr.transcribe(path, lang)
    rms = librosa.feature.rms(y=y, frame_length=1024, hop_length=240)[0]
    pause_ratio = float(np.mean(20 * np.log10(rms / rms.max() + 1e-9) < -35))
    # tonlama (pYIN)
    f0, voiced, _ = librosa.pyin(y, fmin=60, fmax=300, sr=sr, frame_length=1024, hop_length=240)
    f0v = f0[voiced & ~np.isnan(f0)]
    st = 12 * np.log2(f0v / 100.0)  # yarım ton (100 Hz'e göre)
    # kararlılık: ardışık sesli karelerde perde sıçraması (cent)
    pair = voiced[1:] & voiced[:-1] & ~np.isnan(f0[1:]) & ~np.isnan(f0[:-1])
    jitter_cent = np.abs(1200 * np.log2(f0[1:][pair] / f0[:-1][pair]))
    # HNR: sesli karelerde harmonik (HPSS) / perküsif-gürültü
    S = np.abs(librosa.stft(y, n_fft=1024, hop_length=240))
    H, P = librosa.decompose.hpss(S)
    n = min(S.shape[1], len(voiced))
    v = voiced[:n]
    hnr = 10 * np.log10((H[:, :n][:, v] ** 2).sum() / ((P[:, :n][:, v] ** 2).sum() + 1e-12))
    # spektral akı (sesli bölüm): kareden kareye normalize spektrum değişimi
    Sn = S[:, :n] / (S[:, :n].sum(0, keepdims=True) + 1e-12)
    flux = np.sqrt((np.diff(Sn, axis=1) ** 2).sum(0))
    vflux = flux[(v[1:] & v[:-1])]
    # parlaklık
    centroid = librosa.feature.spectral_centroid(S=S, sr=sr)[0][:n][v]
    f = librosa.fft_frequencies(sr=sr, n_fft=1024)
    hf_share = (S[(f > 4000) & (f < 8000)] ** 2).sum() / ((S ** 2).sum() + 1e-12)
    # kimlik
    emb = ve.embeds_from_wavs([librosa.resample(y, orig_sr=sr, target_sr=16000)], sample_rate=16000)[0]
    return {
        "dur_s": dur, "words_per_s": len(words) / dur, "pause_ratio": pause_ratio,
        "f0_mean_hz": float(np.mean(f0v)), "f0_range_st": float(np.percentile(st, 95) - np.percentile(st, 5)),
        "f0_std_st": float(np.std(st)),
        "jitter_cent_median": float(np.median(jitter_cent)), "jitter_cent_p95": float(np.percentile(jitter_cent, 95)),
        "hnr_db": float(hnr), "voiced_flux": float(np.mean(vflux)),
        "centroid_hz": float(np.mean(centroid)), "hf_share_pct": float(100 * hf_share),
        "speaker_sim": float(emb @ ref_emb),
    }


LABELS = [
    ("words_per_s", "Konuşma hızı (kelime/sn)", "{:.2f}"),
    ("pause_ratio", "Sessizlik oranı", "{:.0%}"),
    ("f0_mean_hz", "Ortalama ses perdesi (Hz)", "{:.0f}"),
    ("f0_range_st", "Perde aralığı (yarım ton) ↑ = daha canlı tonlama", "{:.1f}"),
    ("f0_std_st", "Perde oynaklığı (yarım ton)", "{:.2f}"),
    ("jitter_cent_median", "Perde titremesi, medyan (cent) ↓ = daha kararlı", "{:.1f}"),
    ("jitter_cent_p95", "Perde titremesi, en kötü %5 (cent)", "{:.0f}"),
    ("hnr_db", "Harmonik/gürültü (dB) ↑ = daha temiz ses", "{:.1f}"),
    ("voiced_flux", "Sesli bölüm spektral akı ↓ = daha az dalgalanma", "{:.4f}"),
    ("centroid_hz", "Spektral merkez (Hz) ↑ = daha parlak", "{:.0f}"),
    ("hf_share_pct", "4-8 kHz enerji payı (%) ↓ = daha boğuk", "{:.2f}"),
    ("speaker_sim", "Referansa ses benzerliği", "{:.3f}"),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("dirs", nargs="+")
    ap.add_argument("--ref", default="voice/refs/cand_A1.en.wav")
    ap.add_argument("--orig", default="voice/tests/out/design/A_deep_nature.wav")
    args = ap.parse_args()

    ve = voice_encoder()
    y, _ = librosa.load(str(ROOT / args.ref), sr=16000)
    ref_emb = ve.embeds_from_wavs([y], sample_rate=16000)[0]

    cols = {}
    for d in args.dirs:
        files = sorted(Path(d).glob("s0*.wav"))
        rows = [features(p, ve, ref_emb) for p in files]
        cols[Path(d).name] = {k: float(np.mean([r[k] for r in rows])) for k in rows[0]}
    cols["orijinal (Qwen tasarım)"] = features(ROOT / args.orig, ve, ref_emb)

    names = list(cols)
    print(f"{'ölçüt':52}" + "".join(f"{n[:24]:>26}" for n in names))
    for key, label, fmt in LABELS:
        print(f"{label:52}" + "".join(f"{fmt.format(cols[n][key]):>26}" for n in names))
    out = Path(args.dirs[0]).parent / "compare_engines.json"
    out.write_text(json.dumps(cols, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
