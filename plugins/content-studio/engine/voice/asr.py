"""whisper.cpp ile transkript, kelime zamanları ve WER (ses kalite kapısı, PLAN 6.4)."""
import json
import re
import subprocess
import tempfile
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent / ".." / "tools"))
from platform_util import whisper_cli  # noqa: E402

MODEL = Path(__file__).parent / "models" / "ggml-large-v3-turbo-q5_0.bin"


def transcribe(wav: Path, lang: str) -> tuple[str, list[dict]]:
    """Metin ve kelime listesi döndürür: [{"text", "startMs", "endMs"}] (@remotion/captions biçimine yakın)."""
    with tempfile.TemporaryDirectory() as td:
        w16 = Path(td) / "a.wav"
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(wav), "-ar", "16000", "-ac", "1", str(w16)], check=True)
        subprocess.run([whisper_cli(), "-m", str(MODEL), "-l", lang, "-ml", "1", "-sow", "-oj", "-of", str(Path(td) / "o"),
                        "-np", "-f", str(w16)], capture_output=True, check=True)
        data = json.loads((Path(td) / "o.json").read_text())
    words = [{"text": t["text"].strip(), "startMs": t["offsets"]["from"], "endMs": t["offsets"]["to"]}
             for t in data["transcription"] if t["text"].strip()]
    return " ".join(w["text"] for w in words), words


def norm(s: str, lang: str) -> list[str]:
    """Karşılaştırma için normalize: Whisper'ın rakam yazımı ("40") ve şapka (hâle/hale) sahte hata sayılmasın."""
    import textnorm
    s = textnorm.numbers_to_words(s, lang)
    if lang == "tr":
        s = s.replace("I", "ı").replace("İ", "i")
    s = s.lower().translate(str.maketrans("âîû", "aiu"))
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


def wer(ref: str, hyp: str, lang: str) -> float:
    r, h = norm(ref, lang), norm(hyp, lang)
    return edit_distance(r, h) / max(len(r), 1)
