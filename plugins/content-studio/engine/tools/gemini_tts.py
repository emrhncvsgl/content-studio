"""Gemini TTS ile senaryodan sahne sesleri ve anlatım (bulutta üretim; Mac'te yalnız birleştirme). 2026-11-12, kullanıcı isteği (kör karşılaştırma).

Anahtar: proje kökündeki .env → GEMINI_API_KEY (git dışı; değer yazdırılmaz). Ücretsiz katman: veri Google ürünlerini geliştirmek için kullanılabilir
(aistudio.google.com/docs/pricing); ücretli: ~9 $/1M ses token'ı (3.8 Flash TTS, 2026 sonuna kadar), 50 sn Short ≈ birkaç sent.
Hazır (tasarım) sesler; gerçek kişi sesi klonlanmaz. Tonlama düz yazıyla yönetilir (--style).

Ücretsiz katman sınırı: model başına günde 10 istek (2026-11-12 ölçüldü, 429 GenerateRequestsPerDayPerProjectPerModel-FreeTier) → --whole kullan.
Kullanım:
  voice/.venv-chatterbox/bin/python tools/gemini_tts.py <script.en.json> --out <klasör> --voices Charon Sadaltager Algieba \\
      [--model gemini-3.8-flash-tts] [--style "Read as a calm, curious documentary narrator..."] [--gap 0.35] [--only s01 s07]
Çıktı: <out>/<ses>/sNN.wav (24 kHz mono) + <out>/<ses>/narration.wav (sahneler arası --gap sn sessizlik).
Metin: sahnenin `spoken` alanı varsa o (sayılar yazıyla), yoksa `text`.
"""
import argparse
import base64
import json
import subprocess
import sys
import time
import urllib.error
import urllib.request
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STYLE = "Say in a calm, curious documentary narrator tone with a dry, understated humor"


def key():
    for line in (ROOT / ".env").read_text().splitlines():
        if line.startswith("GEMINI_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit("GEMINI_API_KEY .env'de yok")


def tts(text, voice, model, style, k, tries=4):
    # ton: style boşsa yalnız metin. 3.8 Flash TTS metne yazılan talimatı (uzun, başlıklı, "Say ...:") sesli okudu, systemInstruction desteklemiyor
    # ("Developer instruction is not enabled", 2026-11-12) → varsayılan: talimatsız. 2.5 TTS "Say ...:" kalıbını tanır (--style ile).
    prompt = f"{style}: {text}" if style else text
    body = {"contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"responseModalities": ["AUDIO"],
                                 "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}}}}
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    for i in range(tries):
        req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={"Content-Type": "application/json", "x-goog-api-key": k})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                d = json.load(r)
            part = d["candidates"][0]["content"]["parts"][0]["inlineData"]
            return base64.b64decode(part["data"]), part.get("mimeType", "")
        except urllib.error.HTTPError as e:
            msg = e.read().decode()[:300]
            if e.code in (429, 500, 503) and i < tries - 1:
                time.sleep(8 * (i + 1)); continue
            sys.exit(f"Gemini hata {e.code}: {msg}")
        except (KeyError, IndexError):
            if i < tries - 1:
                time.sleep(3); continue
            sys.exit(f"beklenmedik yanıt: {json.dumps(d)[:300]}")


def write_wav(path, pcm, rate=24000):
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate); w.writeframes(pcm)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("script")
    ap.add_argument("--out", required=True)
    ap.add_argument("--voices", nargs="+", default=["Charon"])
    ap.add_argument("--model", default="gemini-3.8-flash-tts")
    ap.add_argument("--style", default="", help=f"tonlama yönlendirmesi; 2.5 TTS için ör. \"{STYLE}\" (3.8 bunu sesli okur)")
    ap.add_argument("--gap", type=float, default=0.35)
    ap.add_argument("--only", nargs="*")
    ap.add_argument("--whole", action="store_true", help="tüm anlatımı TEK istekte üret (ücretsiz katman: model başına GÜNDE 10 istek; sahne başına istek 1 videoyu bile bitirmez)")
    a = ap.parse_args()
    k = key()
    sc = json.loads(Path(a.script).read_text())["scenes"]
    if a.only:
        sc = [s for s in sc if s["id"] in a.only]
    out = Path(a.out)
    for v in a.voices:
        vd = out / v; vd.mkdir(parents=True, exist_ok=True)
        if a.whole:   # sahneler paragraf olarak, tek istek → narration.wav (sahne sınırları Whisper ile sonradan çıkarılabilir)
            t0 = time.time()
            pcm, mime = tts("\n\n".join(s.get("spoken") or s["text"] for s in sc), v, a.model, a.style, k)
            rate = int(mime.split("rate=")[1].split(";")[0]) if "rate=" in mime else 24000
            write_wav(vd / "narration.24k.wav", pcm, rate)
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(vd / "narration.24k.wav"), "-ar", "48000", str(vd / "narration.wav")], check=True)
            print(f"[{v}] tek istek: {len(pcm) / 2 / rate:.1f} sn ({time.time() - t0:.1f} sn) → {vd / 'narration.wav'}", flush=True)
            continue
        files = []
        for s in sc:
            t0 = time.time()
            pcm, mime = tts(s.get("spoken") or s["text"], v, a.model, a.style, k)
            rate = int(mime.split("rate=")[1].split(";")[0]) if "rate=" in mime else 24000
            p = vd / f"{s['id']}.wav"; write_wav(p, pcm, rate); files.append(p)
            print(f"[{v}] {s['id']} {len(pcm) / 2 / rate:.1f} sn ({time.time() - t0:.1f} sn)", flush=True)
        # anlatım: sahneler + aralarında sessizlik (ffmpeg, hafif)
        lst = vd / "_concat.txt"
        sil = vd / "_gap.wav"; write_wav(sil, b"\x00\x00" * int(24000 * a.gap))
        lst.write_text("".join(f"file '{f.name}'\nfile '{sil.name}'\n" for f in files))
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-ar", "48000", str(vd / "narration.wav")], check=True)
        print(f"[done] {vd / 'narration.wav'}")


if __name__ == "__main__":
    main()
