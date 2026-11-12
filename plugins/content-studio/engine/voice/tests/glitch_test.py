"""Anlık 'elektriklenme' glitch'inin kaynağını ayırır.

- seed ve cihaz (MPS vs CPU): rastgelelik mi, Apple GPU mu?
- referans parçası (--refs): sorun referans klibin belli bir kısmında mı?
Aynı ayar ve aynı cümle; yalnızca seçilen değişken değişir.

Kullanım:
  .venv-chatterbox/bin/python tests/glitch_test.py --device mps --seeds 42 1 2 3
  .venv-chatterbox/bin/python tests/glitch_test.py --device cpu --seeds 42 \
      --refs tests/out/slices/A_w1.wav tests/out/slices/A_w2.wav --exag 0.5 --cfg 0.5
"""
import argparse
import time
from pathlib import Path

import torch
import torchaudio

from chatterbox.tts import ChatterboxTTS

HERE = Path(__file__).parent
TEXT = "For centuries, engineers solved these problems by trial and error. Then someone found the pattern."


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--device", required=True)
    ap.add_argument("--seeds", nargs="+", type=int, required=True)
    ap.add_argument("--refs", nargs="+", default=[str(HERE / "out" / "design" / "A_deep_nature.wav")])
    ap.add_argument("--exag", type=float, default=0.5)
    ap.add_argument("--cfg", type=float, default=0.5)
    args = ap.parse_args()

    out = HERE / "out" / "glitch"
    out.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    model = ChatterboxTTS.from_pretrained(device=args.device)
    print(f"[load] {args.device} {time.time() - t0:.1f}s")

    multi = len(args.refs) > 1
    for ref in args.refs:
        for seed in args.seeds:
            torch.manual_seed(seed)
            t = time.time()
            wav = model.generate(TEXT, audio_prompt_path=ref, exaggeration=args.exag, cfg_weight=args.cfg)
            gen_s = time.time() - t
            tag = f"{Path(ref).stem}_e{args.exag}_c{args.cfg}_" if multi else ""
            path = out / f"{args.device}_{tag}seed{seed}.wav"
            torchaudio.save(str(path), wav.cpu(), model.sr)
            if args.device == "mps":
                torch.mps.empty_cache()
            print(f"[gen] {path.name} audio={wav.shape[-1] / model.sr:.2f}s gen={gen_s:.1f}s")


if __name__ == "__main__":
    main()
