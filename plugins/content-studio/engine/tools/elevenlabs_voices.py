"""ElevenLabs sesleri: listele ve aynı cümleyle dinleme adayları üret (kanal sesi seçimi, /new-channel).

Anahtar: ELEVENLABS_API_KEY (ortam ya da proje kökündeki .env; değer yazdırılmaz). Yalnızca standart kütüphane.
Kullanım:
  voice/.venv-chatterbox/bin/python tools/elevenlabs_voices.py list [--search documentary]
  voice/.venv-chatterbox/bin/python tools/elevenlabs_voices.py audition --voices <id> <id> <id> --text "Kanalın konusundan bir cümle." \\
      --out content/channels/<kanal>/voice_auditions [--model eleven_multilingual_v2]
Seçilen sesten profil: voice/profiles/elevenlabs_en.yaml'ı kopyala, voice_id'yi yaz (ör. voice/profiles/<kanal>_narrator.yaml).
Kural: yalnızca kütüphane/tasarım sesleri ya da kullanıcının kendi/izinli sesi; gerçek kişi sesi klonlanmaz.
"""
import argparse
import json
import sys
import urllib.error
import urllib.request
import wave
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "voice"))
from synth import env_key  # noqa: E402

API = "https://api.elevenlabs.io"


def call(path: str, key: str, body: dict | None = None) -> bytes:
    req = urllib.request.Request(API + path, data=json.dumps(body).encode() if body else None,
                                 headers={"xi-api-key": key, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        sys.exit(f"ElevenLabs hata {e.code}: {e.read().decode(errors='replace')[:300]}")


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    ls = sub.add_parser("list")
    ls.add_argument("--search", default="")
    au = sub.add_parser("audition")
    au.add_argument("--voices", nargs="+", required=True)
    au.add_argument("--text", required=True)
    au.add_argument("--out", required=True)
    au.add_argument("--model", default="eleven_multilingual_v2")
    a = ap.parse_args()
    key = env_key("ELEVENLABS_API_KEY")
    if not key:
        sys.exit("ELEVENLABS_API_KEY yok: proje kökündeki .env dosyasına ELEVENLABS_API_KEY=... satırını ekle")

    if a.cmd == "list":
        voices = json.loads(call("/v1/voices", key))["voices"]
        for v in voices:
            lab = v.get("labels") or {}
            line = f"{v['voice_id']}  {v['name']:<22} {v.get('category', ''):<12} " + ", ".join(f"{k}={x}" for k, x in lab.items())
            if a.search.lower() in line.lower():
                print(line)
        return

    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    for vid in a.voices:
        pcm = call(f"/v1/text-to-speech/{vid}?output_format=pcm_24000", key,
                   {"text": a.text, "model_id": a.model, "voice_settings": {"stability": 0.5, "similarity_boost": 0.75}})
        p = out / f"{vid}.wav"
        with wave.open(str(p), "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000); w.writeframes(pcm)
        print(f"{p}  {len(pcm) / 2 / 24000:.1f} sn")


if __name__ == "__main__":
    main()
