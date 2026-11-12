"""CC0 ses havuzu: Kenney paketleri (darbe ahşap/cam/metal/tabak, 5 zeminde ayak sesi, tık, düğme, sayfa, kapı, kumaş, kart, zar).
Kelimeyle arar (Türkçe malzeme kelimeleri de olur), önceki bölümlerde kullanılanları sona dizer (hafıza: varied-real-elements).
cinecode scripts/sounds.py'den uyarlandı (MIT, sarpstar). Ses kuralları: .studio/plugin/skills/sound-design/SKILL.md.

Kullanım (voice/.venv-chatterbox/bin/python tools/sounds.py ...):
  packs                                  paketler ve içerikleri (ilk aramada OpenGameArt'tan bir kez indirilir, CC0)
  add <zip> impact                       kenney.nl'den tarayıcıyla indirilen paketi ekle (Impact yalnızca böyle)
  search "glass light" [--n 12]          id, süre, doruk (ms), son bölümlerde kullanıldıysa hangisi
  search "cam kırılma"                   Türkçe kelimeler eşlenir
  get impact/impactGlass_light_002 --ep EP009 [--name cam_hafif]
        → content/sfx/kenney/<ad>.wav (48 kHz mono, highpass 60 Hz, tepe −3 dBFS) + sources.csv satırı + used.json'a bölüm
Paketler: content/sfx/kenney/packs/ (git dışı, yeniden indirilebilir). Seçilen sesler: content/sfx/kenney/*.wav (git'te).
Timeline'da: visual.sfx [{word|atMs, file: "sfx/kenney/<ad>.wav", gainDb, offsetMs}]; offsetMs = −doruk (sesin tepesi kelimeye otursun).
"""
import argparse
import csv
import datetime
import io
import json
import re
import subprocess
import sys
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).parent.parent
BASE = ROOT / "content" / "sfx" / "kenney"
PACKDIR = BASE / "packs"
USED = BASE / "used.json"
SOURCES = BASE / "sources.csv"
UA = "content-studio/0.1 (local video pipeline; CC0 sound packs)"
PACKS = {  # id öneki: (klasör, OpenGameArt dosyası ya da None, içerik). Hepsi Kenney, CC0. Lazer/bilim kurgu alınmadı.
    # kenney.nl indirmesi 2026-11'de tarayıcı oturumu istiyor (download-link 403); aynı paketleri Kenney OpenGameArt'a da yüklemiş.
    # Impact orada yok: kenney.nl/assets/impact-sounds → Download (tarayıcıda) → `sounds.py add <zip> impact`.
    "impact": ("impact-sounds", None, "darbe: ahşap, cam, metal, tabak, teneke, zil, yumuşak, yumruk; ayak: halı, beton, çim, kar, ahşap"),
    "interface": ("interface-sounds", "https://opengameart.org/sites/default/files/kenney_interfaceSounds.zip",
                  "tık, tik, anahtar, düğme, seçim, onay, hata, aç-kapa, düşme, cam, pluck, kazıma, kaydırma"),
    "ui": ("ui-audio", "https://opengameart.org/sites/default/files/UI_SFX_Set.zip", "anahtar, tık, fare tıkı ve bırakma, üzerinden geçme"),
    "rpg": ("rpg-audio", "https://opengameart.org/sites/default/files/RPGsounds_Kenney.zip",
            "kitap aç/çevir/kapa, kumaş, kemer, kapı aç/kapa, gıcırtı, ayak sesi, bıçak, bozuk para, metal mandal, tencere"),
    "casino": ("casino-audio", "https://opengameart.org/sites/default/files/kenney_casino-audio.zip",
               "kart dağıtma, kaydırma, karıştırma; fiş dizme ve çarpma; zar sallama ve atma"),
}
FIELDS = ["file", "original", "page", "author", "license", "attribution_required", "processing"]
WORDS = {  # Türkçe → dosya adlarındaki İngilizce kelimeler (cinecode listesi + bizimkiler)
    "cam": "glass", "kırılma": "glass", "bardak": "glass", "ahşap": "wood", "tahta": "wood plank", "odun": "wood",
    "metal": "metal", "demir": "metal", "teneke": "tin", "tabak": "plate", "zil": "bell", "çan": "bell",
    "adım": "footstep", "ayak": "footstep", "halı": "carpet", "beton": "concrete", "çimen": "grass", "kar": "snow",
    "yumuşak": "soft", "ağır": "heavy", "hafif": "light", "orta": "medium", "yumruk": "punch", "darbe": "impact",
    "vuruş": "impact", "çarpma": "impact", "tık": "click tick", "tıklama": "click", "düğme": "click switch toggle",
    "anahtar": "switch", "onay": "confirmation", "hata": "error", "aç": "open", "açılma": "open", "kapa": "close",
    "kapanma": "close", "bırak": "drop", "düşme": "drop", "kaydır": "scroll", "seç": "select", "kazı": "scratch",
    "kitap": "book", "sayfa": "book flip", "kâğıt": "book flip", "kagit": "book flip", "kumaş": "cloth", "kemer": "belt",
    "kapı": "door", "gıcırtı": "creak", "bıçak": "knife", "para": "coins", "bozuk": "coins", "kart": "card",
    "fiş": "chip chips", "zar": "dice die", "mandal": "latch metal", "tencere": "pot metal",
    "page": "book flip", "paper": "book flip", "footsteps": "footstep", "step": "footstep",
    "button": "click switch toggle", "hit": "impact", "knock": "wood impact",
}


def unpack(data: bytes, prefix: str, origin: str):
    dest = PACKDIR / PACKS[prefix][0]
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        for name in z.namelist():
            base = Path(name).name
            low = base.lower()
            if (low.endswith((".ogg", ".wav")) and not low.startswith("preview")) or low == "license.txt":
                dest.mkdir(parents=True, exist_ok=True)
                (dest / base).write_bytes(z.read(name))
    (dest / "_source.txt").write_text(f"{origin}\nKenney (kenney.nl), CC0 1.0\nindirildi {datetime.date.today()}\n")


def download(prefix: str):
    url = PACKS[prefix][1]
    if not url:
        raise RuntimeError(f"otomatik kaynak yok: kenney.nl/assets/{PACKS[prefix][0]} → Download, sonra `sounds.py add <zip> {prefix}`")
    unpack(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=120).read(), prefix, url)


def library() -> dict:
    missing = [p for p, (slug, url, _) in PACKS.items() if url and not (PACKDIR / slug).is_dir()]
    if missing:
        print(f"Kenney paketleri bir kez indiriliyor ({len(missing)} paket, CC0) → {PACKDIR.relative_to(ROOT)}")
        for p in missing:
            try:
                download(p)
            except Exception as e:  # biri inmezse diğerleri kullanılsın
                print(f"  {p}: inmedi ({str(e)[:100]})")
    lib = {}
    for prefix, (slug, _, _) in PACKS.items():
        for f in sorted((PACKDIR / slug).glob("*")) if (PACKDIR / slug).is_dir() else []:
            if f.suffix.lower() in (".ogg", ".wav"):
                lib[f"{prefix}/{f.stem}"] = f
    return lib


def words_of(sid: str) -> list[str]:
    prefix, stem = sid.split("/", 1)
    parts = re.sub(r"([a-z])([A-Z])", r"\1 \2", stem).replace("_", " ").replace("-", " ").lower().split()
    return [w for w in parts if not w.isdigit()] + [prefix]


def query_words(q: str) -> list[str]:
    out = []
    for w in q.lower().split():
        out += (WORDS.get(w) or w).split()
    return out


def used() -> dict:
    try:
        return json.loads(USED.read_text())
    except (OSError, ValueError):
        return {}


def probe(path: Path) -> tuple[float, int]:
    """(süre sn, doruk ms): sesin tepesi nerede (timeline'da offsetMs = −doruk)."""
    import numpy as np
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(path), "-ac", "1", "-ar", "48000", "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    a = np.frombuffer(raw, dtype=np.float32)
    return len(a) / 48000, int(np.argmax(np.abs(a)) / 48)


def cmd_search(q: str, n: int):
    lib, u = library(), used()
    qw = query_words(q)
    scored = []
    for sid in lib:
        ws = words_of(sid)
        score = sum(1 for w in qw if any(x.startswith(w) or w.startswith(x) for x in ws))
        if score:
            scored.append((score, sid))
    if not scored:
        print(f"'{q}' için ses yok; `packs` ile içeriğe bak")
        return
    scored.sort(key=lambda x: (-x[0], bool(u.get(x[1])), x[1]))  # aynı puanda kullanılmamış önce
    for score, sid in scored[:n]:
        dur, peak = probe(lib[sid])
        eps = u.get(sid, {}).get("episodes", [])
        tag = f"  ({', '.join(eps)}'te kullanıldı)" if eps else ""
        print(f"{sid:42s} {dur:5.2f} sn  doruk {peak:4d} ms{tag}")


def cmd_get(sid: str, ep: str, name: str | None):
    lib = library()
    if sid not in lib:
        sys.exit(f"{sid} yok; önce search")
    src = lib[sid]
    name = name or re.sub(r"[^a-z0-9_]+", "_", f"k_{sid.split('/', 1)[1]}".lower()).strip("_")
    dst = BASE / f"{name}.wav"
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(src), "-ac", "1", "-ar", "48000",
                    "-af", "highpass=f=60,dynaudnorm=f=500:p=0.71:m=1,alimiter=limit=0.708", "-c:a", "pcm_s16le", str(dst)],
                   check=True)
    dur, peak = probe(dst)
    rows = list(csv.DictReader(SOURCES.open())) if SOURCES.exists() else []
    rows = [r for r in rows if r["file"] != dst.name] + [{
        "file": dst.name, "original": str(src.relative_to(PACKDIR.parent)), "page": PACKS[sid.split('/')[0]][1] or f"https://kenney.nl/assets/{PACKS[sid.split('/')[0]][0]}",
        "author": "Kenney (kenney.nl)", "license": "CC0 1.0", "attribution_required": "no",
        "processing": f"mono 48k, highpass 60 Hz, tepe -3 dBFS; tools/sounds.py {datetime.date.today()}"}]
    with SOURCES.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(rows)
    u = used()
    entry = u.setdefault(sid, {"file": dst.name, "episodes": []})
    if ep and ep not in entry["episodes"]:
        entry["episodes"].append(ep)
    USED.write_text(json.dumps(u, ensure_ascii=False, indent=1))
    print(f"{dst.relative_to(ROOT)}  {dur:.2f} sn, doruk {peak} ms → timeline: "
          f'{{"file": "sfx/kenney/{dst.name}", "offsetMs": {-peak}}}')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("packs")
    ad = sub.add_parser("add", help="tarayıcıda indirilen Kenney zip'ini ekle")
    ad.add_argument("zip")
    ad.add_argument("pack", choices=list(PACKS))
    s = sub.add_parser("search")
    s.add_argument("q")
    s.add_argument("--n", type=int, default=12)
    g = sub.add_parser("get")
    g.add_argument("id")
    g.add_argument("--ep", default="", help="kullanan bölüm (used.json; sonraki aramalarda sona dizilir)")
    g.add_argument("--name", help="çıktı adı (varsayılan k_<kenney adı>)")
    a = ap.parse_args()
    if a.cmd == "add":
        unpack(Path(a.zip).read_bytes(), a.pack, f"https://kenney.nl/assets/{PACKS[a.pack][0]} (elle indirildi)")
        print(f"{a.pack} eklendi → {(PACKDIR / PACKS[a.pack][0]).relative_to(ROOT)}")
    elif a.cmd == "packs":
        lib = library()
        for p, (slug, url, what) in PACKS.items():
            if not url and not (PACKDIR / slug).is_dir():
                print(f"{p:10s}    - elle: kenney.nl/assets/{slug} → Download → tools/sounds.py add <zip> {p}")
                continue
            print(f"{p:10s} {sum(1 for k in lib if k.startswith(p + '/')):4d} ses  {what}")
    elif a.cmd == "search":
        cmd_search(a.q, a.n)
    else:
        cmd_get(a.id, a.ep, a.name)


if __name__ == "__main__":
    main()
