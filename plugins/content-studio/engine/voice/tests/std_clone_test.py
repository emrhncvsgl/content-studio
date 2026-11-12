"""Qwen aday seslerini Chatterbox Standart (veya Multilingual-EN) ile klonlayıp ton/ritim ayarlarını dener.

Turbo'nun aksine bu modellerde exaggeration (ton) ve cfg_weight (ritim) çalışır.
Model bir kez yüklenir; her aday × ayar × cümle üretilir.

Kullanım:
  /usr/bin/time -l .venv-chatterbox/bin/python tests/std_clone_test.py --refs A_deep_nature D_cinematic_old [--model std|mtl]
"""
import argparse
import json
import time
from pathlib import Path

import torch
import torchaudio

HERE = Path(__file__).parent

SENTENCES = [
    ("c1", "Every great invention starts with a contradiction. Make it stronger, but lighter. Faster, but safer."),
    ("c2", "For centuries, engineers solved these problems by trial and error. Then someone found the pattern."),
]

SETTINGS = [
    ("s1_default", {"exaggeration": 0.5, "cfg_weight": 0.5}),
    ("s2_slow",    {"exaggeration": 0.4, "cfg_weight": 0.3}),
    ("s3_drama",   {"exaggeration": 0.7, "cfg_weight": 0.3}),
]


def load(name, device):
    if name == "std":
        from chatterbox.tts import ChatterboxTTS
        return ChatterboxTTS.from_pretrained(device=device)
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS
    return ChatterboxMultilingualTTS.from_pretrained(device=device)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--refs", nargs="+", required=True, help="tests/out/design altındaki aday adları")
    ap.add_argument("--model", choices=["std", "mtl"], default="std")
    ap.add_argument("--device", default="mps" if torch.backends.mps.is_available() else "cpu")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    design = HERE / "out" / "design"
    out = HERE / "out" / f"clone_{args.model}"
    out.mkdir(parents=True, exist_ok=True)

    t0 = time.time()
    model = load(args.model, args.device)
    print(f"[load] {args.model} {time.time() - t0:.1f}s")
    extra = {"language_id": "en"} if args.model == "mtl" else {}

    results = []
    for ref_id in args.refs:
        ref = design / f"{ref_id}.wav"
        for set_id, params in SETTINGS:
            for sid, text in SENTENCES:
                torch.manual_seed(args.seed)
                t = time.time()
                wav = model.generate(text, audio_prompt_path=str(ref), **params, **extra)
                gen_s = time.time() - t
                dur = wav.shape[-1] / model.sr
                path = out / f"{ref_id}__{set_id}__{sid}.wav"
                torchaudio.save(str(path), wav.cpu(), model.sr)
                if args.device == "mps":
                    torch.mps.empty_cache()
                results.append({"ref": ref.name, "setting": set_id, **params, "id": sid, "file": path.name,
                                "audio_s": round(dur, 2), "gen_s": round(gen_s, 1), "text": text})
                print(f"[gen] {ref_id:16} {set_id:10} {sid} audio={dur:5.2f}s gen={gen_s:5.1f}s")

    (out / "results.json").write_text(json.dumps({"model": args.model, "results": results}, ensure_ascii=False, indent=2))
    print(f"[done] {out}")


if __name__ == "__main__":
    main()
