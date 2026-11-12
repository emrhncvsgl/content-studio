"""Lisanslı görsel arama ve indirme (visual-director'ın aracı; channel.yaml assets.allowed_sources).

Kaynak: Wikimedia Commons API. Lisans dosya sayfasının meta verisinden okunur (extmetadata), tahmin edilmez.
Politika (PLAN 7.3):
  izinli:   kamu malı (PD), CC0, CC BY (atıf zorunlu)
  dikkat:   CC BY-SA → yalnızca --allow-sa ile (video bir uyarlama sayılabilir; paylaşım şartı riski)
  elenir:   NC (ticari olmayan), ND (türev yok), lisansı belirsiz/bilinmeyen

Kullanım:
  voice/.venv-chatterbox/bin/python tools/find_images.py search "container ship port" [--limit 8] [--allow-sa]
  voice/.venv-chatterbox/bin/python tools/find_images.py get <bölüm> <sahne_id> "File:Adı.jpg" [--width 1600]
search: aday listesi (başlık, lisans, yazar, atıf, boyut, sayfa). get: <bölüm>/assets/<sahne>-<ad>.jpg + assets.csv satırı;
çıktıda timeline/senaryo props için yol (content/ köküne göre) ve ekran atıf metni.
"""
import argparse
import csv
import html
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).parent.parent
API = "https://commons.wikimedia.org/w/api.php"
UA = "content-studio/0.1 (local video pipeline; https://commons.wikimedia.org/wiki/Commons:API)"


def api(params: dict) -> dict:
    url = API + "?" + urllib.parse.urlencode({**params, "format": "json"})
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def clean(s: str | None) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", s or ""))).strip()


def classify(meta: dict) -> tuple[str, str]:
    """(durum, lisans adı): ok | sa | reject."""
    name = clean(meta.get("LicenseShortName", {}).get("value"))
    low = name.lower()
    if not name:
        return "reject", "lisans yok"
    if "nc" in re.split(r"[\s\-]", low) or "non-commercial" in low or "-nd" in low or " nd" in low:
        return "reject", name
    if low.startswith("public domain") or low.startswith("pd") or "cc0" in low or "no restrictions" in low:
        return "ok", name
    if "by-sa" in low or "cc by-sa" in low:
        return "sa", name
    if low.startswith("cc by") or low.startswith("cc-by"):
        return "ok", name
    return "reject", name


def info(titles: list[str], width: int) -> list[dict]:
    d = api({"action": "query", "titles": "|".join(titles), "prop": "imageinfo",
             "iiprop": "url|extmetadata|size|mime", "iiurlwidth": width})
    out = []
    for p in d.get("query", {}).get("pages", {}).values():
        ii = (p.get("imageinfo") or [{}])[0]
        m = ii.get("extmetadata", {})
        status, lic = classify(m)
        out.append({
            "title": p.get("title"), "status": status, "license": lic,
            "license_url": clean(m.get("LicenseUrl", {}).get("value")),
            "artist": clean(m.get("Artist", {}).get("value")) or "bilinmiyor",
            "credit": clean(m.get("Credit", {}).get("value")),
            "attribution_required": clean(m.get("AttributionRequired", {}).get("value")).lower() == "true" or status == "sa"
                                    or lic.lower().startswith("cc by"),
            "width": ii.get("width"), "height": ii.get("height"), "mime": ii.get("mime"),
            "page": ii.get("descriptionurl"), "url": ii.get("thumburl") or ii.get("url"),
        })
    return out


def search(q: str, limit: int, allow_sa: bool, width: int) -> list[dict]:
    d = api({"action": "query", "list": "search", "srsearch": f"{q} filetype:bitmap", "srnamespace": 6, "srlimit": limit * 3})
    titles = [x["title"] for x in d.get("query", {}).get("search", [])]
    res = []
    for i in range(0, len(titles), 20):
        res += info(titles[i:i + 20], width)
    keep = [r for r in res if r["status"] == "ok" or (allow_sa and r["status"] == "sa")]
    keep = [r for r in keep if r["mime"] in ("image/jpeg", "image/png") and (r["height"] or 0) >= 800]
    # dikey video için yükseklik/kalite öncelikli
    keep.sort(key=lambda r: -(min(r["width"] or 0, 4000) * min(r["height"] or 0, 4000)))
    return keep[:limit]


MIN_HEIGHT = 2500  # 1920 px dikey kare + Ken Burns yakınlaşma payı (~1.3×); yatay fotoğraf genişliği buna göre istenir


def get(ep: Path, scene: str, title: str, width: int, allow_sa: bool) -> dict:
    r = info([title], width)[0]
    if r["status"] == "reject" or (r["status"] == "sa" and not allow_sa):
        raise SystemExit(f"lisans uygun değil: {r['license']} ({r['title']})")
    if r["width"] and r["height"]:
        need = min(r["width"], int(MIN_HEIGHT * r["width"] / r["height"]) + 1)
        if need > width:
            r = info([title], need)[0]
        if r["height"] < 1920:
            print(f"[warn] özgün yükseklik {r['height']} px < 1920: dikey karede büyütülecek, bulanık olabilir", file=sys.stderr)
    slug = re.sub(r"[^a-z0-9]+", "-", Path(title.split(":", 1)[-1]).stem.lower()).strip("-")[:40]
    ext = ".png" if r["mime"] == "image/png" else ".jpg"
    dst = ep / "assets" / f"{scene}-{slug}{ext}"
    dst.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(r["url"], headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = resp.read()
    if not data[:4] in (b"\xff\xd8\xff\xe0", b"\xff\xd8\xff\xe1", b"\xff\xd8\xff\xdb", b"\x89PNG") and not data[:3] == b"\xff\xd8\xff":
        raise SystemExit("indirilen dosya beklenen görsel türünde değil")
    dst.write_bytes(data)
    csv_path = ep / "assets.csv"
    new = not csv_path.exists()
    with csv_path.open("a", newline="") as f:
        w = csv.writer(f)
        if new:
            w.writerow(["file", "source_url", "license", "attribution_required", "author", "notes"])
        w.writerow([str(dst.relative_to(ep)), r["page"], r["license"], "yes" if r["attribution_required"] else "no", r["artist"],
                    f"{scene}; Wikimedia Commons; {r['license_url']}"])
    credit = f"{r['artist']} / {r['license']}" if r["attribution_required"] else ""
    return {"file": str(dst.relative_to(ROOT / "content")), "license": r["license"], "author": r["artist"], "credit": credit,
            "bytes": len(data), "page": r["page"]}


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("search"); s.add_argument("query"); s.add_argument("--limit", type=int, default=8)
    s.add_argument("--allow-sa", action="store_true"); s.add_argument("--width", type=int, default=1600)
    g = sub.add_parser("get"); g.add_argument("episode"); g.add_argument("scene"); g.add_argument("title")
    g.add_argument("--allow-sa", action="store_true"); g.add_argument("--width", type=int, default=1600)
    a = ap.parse_args()
    if a.cmd == "search":
        for r in search(a.query, a.limit, a.allow_sa, a.width):
            print(f"{r['title']}\n   {r['license']} · {r['artist'][:60]} · {r['width']}x{r['height']} · atıf: {'evet' if r['attribution_required'] else 'hayır'}\n   {r['page']}")
    else:
        # bölüm kimliği (EP014) ya da klasör yolu; kimlik verilince proje köküne "EP014/" açılıyordu (EP013, EP014'te iki kez) → content/episodes'tan bul
        ep = Path(a.episode)
        if not ep.is_dir():
            hits = sorted((Path(__file__).resolve().parent.parent / "content" / "episodes").glob(f"{a.episode.rstrip('/')}*"))
            if not hits:
                sys.exit(f"bölüm bulunamadı: {a.episode} (kimlik ya da content/episodes/<klasör> ver)")
            ep = hits[0]
        print(json.dumps(get(ep.resolve(), a.scene, a.title, a.width, a.allow_sa), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    sys.exit(main())
