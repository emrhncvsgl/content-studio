"""Studio fontlarını Google Fonts'tan bir kez indirir → content/fonts/*.woff2 + manifest.json (studio/src/fonts.ts yerelden yükler).

Neden: render sırasında headless Chrome Google Fonts'u indiremeyip delayRender zaman aşımına düşebiliyor (EP010, 2026-11-10:
curl 1 sn'de alırken Chrome 58 sn'de alamadı; woodcut, animatic ve tam render durdu). Yerel dosya ağdan bağımsız.
Fontların hepsi SIL OFL 1.1 (atıf gerekmez). Yeni font eklerken FONTS'a ekle, bu betiği yeniden çalıştır.

  voice/.venv-chatterbox/bin/python tools/fetch_fonts.py
"""
import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "content" / "fonts"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"  # woff2 için
FONTS = {  # aile → (ağırlıklar, alt kümeler); fonts.ts ile aynı
    "Inter": (["500", "800", "900"], ["latin", "latin-ext"]),
    "IBM Plex Mono": (["400", "500"], ["latin"]),
    "Alfa Slab One": (["400"], ["latin", "latin-ext"]),
    "IM Fell English SC": (["400"], ["latin"]),
    "Cormorant Garamond": (["500", "600"], ["latin", "latin-ext"]),
}


def get(url, tries=8):
    """Bağlantı kesik kesik olabiliyor (2026-11-10): kısa zaman aşımı + yeniden deneme."""
    for i in range(tries):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=20).read()
        except OSError as e:
            print(f"[retry {i + 1}/{tries}] {url[:60]}… {e}")
    raise SystemExit(f"indirilemedi: {url}")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = []
    for fam, (weights, subsets) in FONTS.items():
        css = get(f"https://fonts.googleapis.com/css2?family={fam.replace(' ', '+')}:wght@{';'.join(weights)}&display=block").decode()
        # her blok: /* subset */ @font-face { ... font-weight: N; src: url(...) format('woff2'); unicode-range: ...; }
        for sub, body in re.findall(r"/\*\s*([\w-]+)\s*\*/\s*@font-face\s*{([^}]*)}", css):
            if sub not in subsets:
                continue
            w = re.search(r"font-weight:\s*(\d+)", body).group(1)
            url = re.search(r"url\((https://[^)]+\.woff2)\)", body).group(1)
            rng = re.search(r"unicode-range:\s*([^;]+);", body).group(1).strip()
            name = f"{fam.replace(' ', '')}-{w}-{sub}.woff2"
            if not (OUT / name).exists():   # yarıda kalırsa kaldığı yerden
                (OUT / name).write_bytes(get(url))
            manifest.append({"family": fam, "weight": w, "subset": sub, "unicodeRange": rng, "file": f"fonts/{name}"})
            print(f"[font] {name}")
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=1))
    print(f"[done] {len(manifest)} dosya → {OUT.relative_to(ROOT)}/manifest.json")


if __name__ == "__main__":
    main()
