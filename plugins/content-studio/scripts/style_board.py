#!/usr/bin/env python3
"""Stil adayları panosu: seçilen 3-4 adayı tek görselde yan yana gösterir (cinecode "direction board" fikri, sade hâli).

Kullanım (proje kökünden; Pillow gerekir → stüdyonun python'u):
  voice/.venv-chatterbox/bin/python .studio/plugin/scripts/style_board.py vox-explainer lemo:watercolor lemo:archive-lighttable \\
      lemo:caption-news --out content/channels/<kanal>/design/board.jpg [--title "In Your Hand: görünüş adayları"]
Kimlikler design_menu.py çıktısındaki gibi (bizim stil: id · Lemo: lemo:<slug> · cinecode: cinecode:<id>).

Görseller: Lemo tariflerinin demo posteri, Lemo'nun kendi GitHub deposundan, plugin'in kullandığı MIT sürümünden (commit
8814b84) yalnızca görüntülemek için indirilir ve `.studio/cache/posters/` altında tutulur; plugin'le dağıtılmaz, videoda
kullanılmaz (posterlerde üçüncü taraf malzeme olabilir). Bizim hazır stilimiz Lemo kökenliyse (catalog ref) o poster
"Lemo örneği" etiketiyle gösterilir; posteri olmayan aday için yazılı kart çizilir.
"""
import json
import re
import sys
import textwrap
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

PLUGIN = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PLUGIN / "scripts"))
import design_menu  # noqa: E402

if hasattr(sys.stdout, "reconfigure"):  # Windows konsolu (cp1252) Türkçe çıktıda hata vermesin
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

COMMIT = "8814b84c4e0f2c02884ea815eb43b67334aedeb1"
RAW = f"https://raw.githubusercontent.com/lemomo-ai/lemo-opuscar/{COMMIT}/styles/{{slug}}/poster.jpg"
CACHE = Path.cwd() / ".studio" / "cache" / "posters"
TW, TH, LH = 800, 450, 170          # karo: görsel 800x450 + 170 px yazı şeridi
BG, FG, MUTED, OK, TODO = (18, 18, 20), (240, 240, 236), (160, 160, 156), (120, 200, 120), (230, 180, 80)


def font(size: int):
    for p in ("/System/Library/Fonts/Helvetica.ttc", "/System/Library/Fonts/Supplemental/Arial.ttf",
              "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "C:/Windows/Fonts/arial.ttf"):
        if Path(p).exists():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default(size=size)


def poster(slug: str) -> Image.Image | None:
    CACHE.mkdir(parents=True, exist_ok=True)
    p = CACHE / f"{slug}.jpg"
    if not p.exists():
        try:
            with urllib.request.urlopen(RAW.format(slug=slug), timeout=30) as r:
                p.write_bytes(r.read())
        except Exception as e:  # ağ yok / poster yok: yazılı karta düş
            print(f"[poster] {slug}: indirilemedi ({e.__class__.__name__}), yazılı kart", file=sys.stderr)
            return None
    im = Image.open(p).convert("RGB")
    im.thumbnail((TW * 2, TH * 2))
    # 800x450'ye kırp-sığdır
    r = max(TW / im.width, TH / im.height)
    im = im.resize((int(im.width * r) + 1, int(im.height * r) + 1))
    x, y = (im.width - TW) // 2, (im.height - TH) // 2
    return im.crop((x, y, x + TW, y + TH))


def lemo_slug_for(item: dict, lemo_by_name: dict) -> str | None:
    if item["src"] == "lemo":
        return item["id"].split(":", 1)[1]
    if item["src"] == "studio":
        cat = (design_menu.ENGINE / "catalog" / "styles.yaml").read_text(encoding="utf-8")
        head = re.search(rf"^  {re.escape(item['id'])}:", cat, re.M)
        if not head:
            return None
        nxt = re.search(r"^  [a-z0-9-]+:", cat[head.end():], re.M)
        block = cat[head.start(): head.end() + (nxt.start() if nxt else len(cat))]   # yalnızca bu kaydın satırları
        m = re.search(r"ref: \"?lemo-opuscar: ([^\",}]+)", block)
        if m:
            return lemo_by_name.get(m.group(1).strip().lower())
    return None


def main():
    args = sys.argv[1:]
    out = Path(args[args.index("--out") + 1]) if "--out" in args else Path("style_board.jpg")
    title = args[args.index("--title") + 1] if "--title" in args else "Görünüş adayları"
    ids = [a for i, a in enumerate(args) if not a.startswith("--") and (i == 0 or args[i - 1] not in ("--out", "--title"))]
    if not ids:
        sys.exit(__doc__)
    looks = {o["id"]: o for o in design_menu.looks()}
    lemo_by_name = {(o.get("name") or "").lower(): o["id"].split(":", 1)[1] for o in looks.values() if o["src"] == "lemo"}
    cols = 2 if len(ids) > 1 else 1
    rows = (len(ids) + cols - 1) // cols
    W, H = cols * TW + (cols + 1) * 30, 110 + rows * (TH + LH + 30)
    board = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(board)
    d.text((30, 34), title, fill=FG, font=font(44))
    for n, sid in enumerate(ids):
        it = looks.get(sid)
        if not it:
            sys.exit(f"bilinmeyen stil: {sid} (design_menu.py looks)")
        x, y = 30 + (n % cols) * (TW + 30), 110 + (n // cols) * (TH + LH + 30)
        slug = lemo_slug_for(it, lemo_by_name)
        im = poster(slug) if slug else None
        if im:
            board.paste(im, (x, y))
            if it["src"] == "studio":
                d.rectangle((x, y, x + 210, y + 40), fill=(0, 0, 0))
                d.text((x + 10, y + 8), "Lemo örneği", fill=MUTED, font=font(22))
        else:
            d.rectangle((x, y, x + TW, y + TH), fill=(34, 34, 38))
            for k, line in enumerate(textwrap.wrap(it.get("what") or it.get("essence") or "", 52)[:9]):
                d.text((x + 28, y + 28 + k * 42), line, fill=MUTED, font=font(28))
        letter = chr(65 + n)
        state = ("HAZIR: hemen kullanılır", OK) if it.get("built") else ("TARİF: ilk kullanımda kurulur (~1-2 saat)", TODO)
        d.text((x, y + TH + 16), f"{letter}  {it.get('name') or sid}", fill=FG, font=font(38))
        d.text((x, y + TH + 66), f"{sid}  ·  {design_menu.group_of(it)}", fill=MUTED, font=font(24))
        d.ellipse((x, y + TH + 110, x + 18, y + TH + 128), fill=state[1])
        d.text((x + 30, y + TH + 104), state[0], fill=state[1], font=font(26))
    out.parent.mkdir(parents=True, exist_ok=True)
    board.save(out, quality=88)
    print(out)


if __name__ == "__main__":
    main()
