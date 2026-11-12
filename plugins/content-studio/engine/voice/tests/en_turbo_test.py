"""EN: Chatterbox Turbo kalite ve bellek testi (tr_r1_test.py'nin İngilizce karşılığı).

Referans klip vermeden yerleşik sesle okutur. 'tagged' alanı olan cümleler etiketli olarak da üretilir.
Her üretimden sonra MPS önbelleği boşaltılır.

Kullanım:
  /usr/bin/time -l .venv-chatterbox/bin/python tests/en_turbo_test.py [--device mps|cpu] [--ref x.wav]
"""
import argparse
import json
import time
from pathlib import Path

import torch
import torchaudio

from chatterbox.tts_turbo import ChatterboxTurboTTS

HERE = Path(__file__).parent


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--device", default="mps" if torch.backends.mps.is_available() else "cpu")
    ap.add_argument("--ref", default=None, help="referans klip (yoksa yerleşik ses)")
    ap.add_argument("--out", default=str(HERE / "out" / "en_turbo"))
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    testset = json.loads((HERE / "en_testset.json").read_text())
    out = Path(args.out) / args.device
    out.mkdir(parents=True, exist_ok=True)

    t0 = time.time()
    model = ChatterboxTurboTTS.from_pretrained(device=args.device)
    load_s = time.time() - t0
    print(f"[load] {args.device} {load_s:.1f}s")

    results = []
    for s in testset["sentences"]:
        variants = [("plain", s["text"])]
        if "tagged" in s:
            variants.append(("tag", s["tagged"]))
        for vname, spoken in variants:
            torch.manual_seed(args.seed)
            t = time.time()
            wav = model.generate(spoken, audio_prompt_path=args.ref)
            gen_s = time.time() - t
            dur = wav.shape[-1] / model.sr
            path = out / f"{s['id']}_{vname}.wav"
            torchaudio.save(str(path), wav.cpu(), model.sr)
            peak = wav.abs().max().item()
            mps_mb = torch.mps.driver_allocated_memory() / 2**20 if args.device == "mps" else None
            if args.device == "mps":
                torch.mps.empty_cache()
            r = {"id": s["id"], "variant": vname, "audio_s": round(dur, 2), "gen_s": round(gen_s, 2),
                 "rtf": round(gen_s / dur, 2), "peak": round(peak, 3),
                 "mps_mb": round(mps_mb) if mps_mb else None, "file": path.name,
                 "text": s["text"], "spoken": spoken}
            results.append(r)
            print(f"[gen] {s['id']:4} {vname:5} audio={dur:5.2f}s gen={gen_s:5.1f}s rtf={r['rtf']} peak={peak:.2f} mps={r['mps_mb']}MB")

    (out / "results.json").write_text(json.dumps(
        {"device": args.device, "model": "turbo", "ref": args.ref, "load_s": round(load_s, 1),
         "sr": model.sr, "results": results}, ensure_ascii=False, indent=2))
    print(f"[done] {out}")


if __name__ == "__main__":
    main()
