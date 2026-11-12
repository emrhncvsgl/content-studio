"""Chatterbox vokoder (S3Gen flow-matching) adım sayısı testi.

Konuşma token'ları (okuyuş) bir kez üretilir; aynı token'lar farklı `n_cfm_timesteps` ile sese çevrilir.
Böylece fark yalnızca ses kalitesinden gelir (varsayılan: 10 adım, s3gen.py).
Çıktı: tests/out/vsteps/steps<N>/s0X.wav (kuyruk kesme + −1 dBFS, synth.py ile aynı).

Kullanım: .venv-chatterbox/bin/python tests/vocoder_steps_test.py --steps 10 25 50 [--voice cand_A1]
"""
import argparse
import json
import sys
import time
from pathlib import Path

import numpy as np
import torch
import yaml

sys.path.insert(0, str(Path(__file__).parent.parent))
import synth  # noqa: E402
import textnorm  # noqa: E402
from chatterbox.tts import ChatterboxTTS  # noqa: E402

ROOT = Path(__file__).parent.parent.parent


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--steps", nargs="+", type=int, default=[10, 25, 50])
    ap.add_argument("--voice", default="cand_A1")
    ap.add_argument("--script", default="content/episodes/EP001-segmentation/script.en.json")
    ap.add_argument("--scenes", nargs="+", default=["s01", "s02", "s03", "s04"])
    ap.add_argument("--seed", type=int, default=1000)
    args = ap.parse_args()

    script = json.loads((ROOT / args.script).read_text())
    profile = yaml.safe_load((ROOT / "voice" / "profiles" / f"{args.voice}.yaml").read_text())
    emotions = yaml.safe_load((ROOT / "catalog" / "emotions.yaml").read_text())
    pron = textnorm.load_pronunciation("en")
    out = ROOT / "voice" / "tests" / "out" / "vsteps"

    model = ChatterboxTTS.from_pretrained(device="cpu")
    model.prepare_conditionals(str(ROOT / profile["refs"]["en"]["wav"]), exaggeration=0.5)

    # s3gen.inference'ı sarar: token'ları yakalar, adım sayısını dışarıdan verir
    orig_inference = model.s3gen.inference
    state = {"steps": 10, "tokens": None}

    def patched(speech_tokens, ref_dict, **kw):
        state["tokens"] = speech_tokens.clone()
        return orig_inference(speech_tokens=speech_tokens, ref_dict=ref_dict, n_cfm_timesteps=state["steps"], **kw)
    model.s3gen.inference = patched

    log = []
    for sc in script["scenes"]:
        if sc["id"] not in args.scenes:
            continue
        spoken = textnorm.prepare(sc["text"], "en", pron)
        emo = emotions[sc["emotion"]]
        params = {"exaggeration": emo["exaggeration"] * (0.6 + 0.8 * sc.get("intensity", 0.5)), "cfg_weight": emo["cfg_weight"]}
        for i, steps in enumerate(args.steps):
            torch.manual_seed(args.seed)
            t = time.time()
            if i == 0:  # okuyuş burada üretilir
                state["steps"] = steps
                wav = model.generate(spoken, **params).squeeze(0).numpy()
            else:       # aynı token'lar, farklı adım sayısı
                with torch.inference_mode():
                    w, _ = orig_inference(speech_tokens=state["tokens"], ref_dict=model.conds.gen, n_cfm_timesteps=steps)
                wav = model.watermarker.apply_watermark(w.squeeze(0).cpu().numpy(), sample_rate=model.sr)
            gen_s = time.time() - t
            d = out / f"steps{steps}"
            (d / "takes").mkdir(parents=True, exist_ok=True)
            y, info = synth.clean_and_check(np.asarray(wav, dtype=np.float32), model.sr, d / f"{sc['id']}.wav", "en", [sc["text"], spoken])
            log.append({"scene": sc["id"], "steps": steps, "gen_s": round(gen_s, 1), "wer": round(info["wer"], 3), "audio_s": round(len(y) / model.sr, 2)})
            print(f"[gen] {sc['id']} steps={steps:3} gen={gen_s:5.1f}s wer={info['wer']:.2f} audio={len(y)/model.sr:.2f}s")
    (out / "log.json").write_text(json.dumps(log, indent=2))


if __name__ == "__main__":
    main()
