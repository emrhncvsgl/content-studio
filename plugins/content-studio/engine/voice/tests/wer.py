"""Bir test çıktı klasöründeki her wav'ı whisper.cpp ile çözümler, WER/CER hesaplar.

Kullanım: python tests/wer.py tests/out/r1/mps [--lang tr]
results.json'daki metinler referans alınır, sonuç wer.json olarak yazılır.
"""
import argparse
import json
import re
import subprocess
import tempfile
from pathlib import Path

MODEL = Path(__file__).parent.parent / "models" / "ggml-large-v3-turbo-q5_0.bin"


def norm(s: str, lang: str) -> list[str]:
    if lang == "tr":
        s = s.replace("I", "ı").replace("İ", "i")
    s = s.lower()
    s = re.sub(r"[^\w\s]", " ", s)
    return s.split()


def edit_distance(a, b) -> int:
    prev = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        cur = [i]
        for j, y in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x != y)))
        prev = cur
    return prev[-1]


def transcribe(wav: Path, lang: str) -> str:
    with tempfile.TemporaryDirectory() as td:
        w16 = Path(td) / "a.wav"
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(wav), "-ar", "16000", "-ac", "1", str(w16)], check=True)
        p = subprocess.run(["whisper-cli", "-m", str(MODEL), "-l", lang, "-nt", "-np", "-f", str(w16)],
                           capture_output=True, text=True, check=True)
    return " ".join(p.stdout.split())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("dir")
    ap.add_argument("--lang", default="tr")
    args = ap.parse_args()
    d = Path(args.dir)
    res = json.loads((d / "results.json").read_text())

    rows = []
    for r in res["results"]:
        hyp = transcribe(d / r["file"], args.lang)
        ref_w, hyp_w = norm(r["text"], args.lang), norm(hyp, args.lang)
        wer = edit_distance(ref_w, hyp_w) / max(len(ref_w), 1)
        ref_c, hyp_c = "".join(ref_w), "".join(hyp_w)
        cer = edit_distance(list(ref_c), list(hyp_c)) / max(len(ref_c), 1)
        rows.append({"file": r["file"], "wer": round(wer, 3), "cer": round(cer, 3), "ref": r["text"], "hyp": hyp})
        print(f"{r['file']:20} WER={wer:.2f} CER={cer:.2f} | {hyp}")

    (d / "wer.json").write_text(json.dumps(rows, ensure_ascii=False, indent=2))
    n = len(rows)
    print(f"[ortalama] WER={sum(x['wer'] for x in rows)/n:.3f} CER={sum(x['cer'] for x in rows)/n:.3f}")


if __name__ == "__main__":
    main()
