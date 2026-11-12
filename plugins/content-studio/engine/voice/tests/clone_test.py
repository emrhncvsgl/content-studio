"""Qwen aday seslerini Chatterbox Turbo'ya referans verip yeni cümleler okutur.

Hatta gerçekte kullanılacak ses Chatterbox klonudur. Bu test, Qwen sesinin klonda ne kadar korunduğunu gösterir (R4).
Model bir kez yüklenir; her aday için aynı cümleler okutulur.

Kullanım:
  /usr/bin/time -l .venv-chatterbox/bin/python tests/clone_test.py [--refs tests/out/design]
"""
import argparse
import json
import time
from pathlib import Path

import torch
import torchaudio

from chatterbox.tts_turbo import ChatterboxTurboTTS

HERE = Path(__file__).parent

SENTENCES = [
    ("c1", "Every great invention starts with a contradiction. Make it stronger, but lighter. Faster, but safer."),
    ("c2", "[sigh] For centuries, engineers solved these problems by trial and error. Then someone found the pattern."),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--refs", default=str(HERE / "out" / "design"))
    ap.add_argument("--out", default=str(HERE / "out" / "clone"))
    ap.add_argument("--device", default="mps" if torch.backends.mps.is_available() else "cpu")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    refs = sorted(Path(args.refs).glob("*.wav"))
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    model = ChatterboxTurboTTS.from_pretrained(device=args.device)
    results = []
    for ref in refs:
        for sid, text in SENTENCES:
            torch.manual_seed(args.seed)
            t = time.time()
            wav = model.generate(text, audio_prompt_path=str(ref))
            gen_s = time.time() - t
            dur = wav.shape[-1] / model.sr
            path = out / f"{ref.stem}__{sid}.wav"
            torchaudio.save(str(path), wav.cpu(), model.sr)
            if args.device == "mps":
                torch.mps.empty_cache()
            results.append({"ref": ref.name, "id": sid, "file": path.name, "audio_s": round(dur, 2),
                            "gen_s": round(gen_s, 1), "text": text.replace("[sigh] ", "")})
            print(f"[gen] {ref.stem:16} {sid} audio={dur:5.2f}s gen={gen_s:5.1f}s")

    (out / "results.json").write_text(json.dumps({"model": "turbo", "results": results}, ensure_ascii=False, indent=2))
    print(f"[done] {out}")


if __name__ == "__main__":
    main()
