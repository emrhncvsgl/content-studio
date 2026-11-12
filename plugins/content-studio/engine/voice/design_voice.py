"""Qwen3-TTS VoiceDesign ile metin tarifinden aday sesler üretir (PLAN 6.1).

Model bir kez yüklenir, her aday aynı test metnini okur.

Kullanım:
  /usr/bin/time -l .venv-mlx/bin/python design_voice.py [--candidates tests/design_candidates.json] [--seed 42]
"""
import argparse
import json
import time
from pathlib import Path

import mlx.core as mx
import numpy as np
from mlx_audio.audio_io import write
from mlx_audio.tts.utils import load_model

HERE = Path(__file__).parent
MODEL = "mlx-community/Qwen3-TTS-12Hz-1.7B-VoiceDesign-bf16"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--candidates", default=str(HERE / "tests" / "design_candidates.json"))
    ap.add_argument("--out", default=str(HERE / "tests" / "out" / "design"))
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    spec = json.loads(Path(args.candidates).read_text())
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    t0 = time.time()
    model = load_model(MODEL)
    load_s = time.time() - t0
    print(f"[load] {MODEL} {load_s:.1f}s")

    results = []
    for c in spec["candidates"]:
        mx.random.seed(args.seed)
        t = time.time()
        res = list(model.generate_voice_design(text=spec["text"], instruct=c["instruct"], language=spec["language"]))
        audio = np.concatenate([np.array(r.audio) for r in res])
        gen_s = time.time() - t
        dur = len(audio) / model.sample_rate
        path = out / f"{c['id']}.wav"
        write(str(path), audio, model.sample_rate)
        peak = float(np.abs(audio).max())
        mem_gb = mx.get_peak_memory() / 2**30
        mx.clear_cache()
        r = {**c, "audio_s": round(dur, 2), "gen_s": round(gen_s, 1), "rtf": round(gen_s / dur, 2),
             "peak": round(peak, 3), "mlx_peak_gb": round(mem_gb, 2), "file": path.name, "text": spec["text"]}
        results.append(r)
        print(f"[gen] {c['id']:16} audio={dur:5.1f}s gen={gen_s:5.1f}s rtf={r['rtf']} peak={peak:.2f} mlx_peak={mem_gb:.1f}GB")

    (out / "results.json").write_text(json.dumps(
        {"model": MODEL, "seed": args.seed, "sr": model.sample_rate, "load_s": round(load_s, 1), "results": results},
        ensure_ascii=False, indent=2))
    print(f"[done] {out}")


if __name__ == "__main__":
    main()
