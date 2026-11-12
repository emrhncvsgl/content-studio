"""Fotoğraf sahneleri için ek 2.5D katman pişirme (photo_planes.py'nin tamamlayıcısı; PhotoMotion `planes`).

İki iş:
  frame  Fotoğrafın önüne element çerçevesi (content/assets/elements/<id>) + çevresinde duvar: fotoğrafla AYNI piksel ızgarasında RGBA
         katman. Çerçevenin deliği saydam (yaml hole, shape circle/rect; --inset ile deliğin kenarı çerçevede kalır), dışı duvar dokusu.
         Props: planes: [{image: <çıktı>, k: 1.5-1.7, wrap: false}] (en yakın katman: çerçeve kameraya portreden hızlı yaklaşır).
         dof.focus'u portrenin katmanına (ör. kişi fg k) ver, yoksa odak çerçeveye kayar ve portre bulanıklaşır.
  page   Belge sayfası masada: <out>.page.png (saydam tuval üstünde hafif dönük sayfa + iki katmanlı gölge) ve <out>.table.jpg (aynı
         boyutta masa dokusu). Props: image: <page.png>, planes: [{image: <table.jpg>, k: 0.6, under: true, wrap: false}] → masa
         sayfanın altında, kameraya daha az tepki verir (surface depth 0.6). Sayfanın kutusu (tuval 0-1) çıktıda yazılır: odak ve
         cardflip hedefi için.
Kullanım (voice/.venv-chatterbox):
  voice/.venv-chatterbox/bin/python tools/plane_bake.py frame <foto> <element_id> <çıktı.png> --hole x,y,w (foto 0-1: delik merkezi + genişliği)
      [--wall textures/wood-table-large.jpg] [--wall-tint #4A3A30] [--inset 0.97]
  voice/.venv-chatterbox/bin/python tools/plane_bake.py page <sayfa.jpg> <çıktı_kökü> [--size 2160,3840] [--box x,y,w (tuval 0-1)] [--rot -1.5]
      [--table textures/wood-table-large.jpg] [--table-tint #B89B80]
Tuzak: frame katmanı duvarı fotoğrafın tamamına yayar; kamera fotoğrafın kenarını gösterirse kenar da duvardır (sorun değil). Çerçeve
deliğinin içi kaynakta saydam değilse (frame-oval) delik burada kesilir.
"""
import argparse
from pathlib import Path

import numpy as np
import yaml
from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
Image.MAX_IMAGE_PIXELS = None


def cover(tex: Image.Image, size) -> Image.Image:
    W, H = size
    s = max(W / tex.width, H / tex.height)
    t = tex.resize((round(tex.width * s) + 1, round(tex.height * s) + 1), Image.LANCZOS)
    x, y = (t.width - W) // 2, (t.height - H) // 2
    return t.crop((x, y, x + W, y + H))


def tinted(path: str, size, tint: str) -> Image.Image:
    tex = cover(Image.open(ROOT / "content" / path if not Path(path).exists() else path).convert("RGB"), size)
    return ImageChops.multiply(tex, Image.new("RGB", size, tint))


def frame(a):
    photo = Image.open(a.photo)
    PW, PH = photo.size
    el = yaml.safe_load((ROOT / "content/assets/elements" / f"{a.element}.yaml").read_text())
    im = Image.open(ROOT / "content/assets/elements" / f"{a.element}.png").convert("RGBA")
    hx, hy, hw = (float(v) for v in a.hole.split(","))
    hole = el["hole"]
    s = hw * PW / (hole["w"] * im.width)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    ox, oy = hx * PW - hole["x"] * im.width, hy * PH - hole["y"] * im.height
    wall = tinted(a.wall, (PW, PH), a.wall_tint).convert("RGBA")
    # çerçevenin duvara düşen gölgesi
    sh = Image.new("RGBA", (PW, PH), (0, 0, 0, 0))
    alpha = Image.new("L", (PW, PH), 0)
    alpha.paste(im.getchannel("A"), (round(ox + PW * 0.012), round(oy + PH * 0.018)))
    sh.putalpha(alpha.filter(ImageFilter.GaussianBlur(PW * 0.02)).point(lambda v: int(v * 0.7)))
    wall.alpha_composite(sh)
    wall.alpha_composite(im, (round(ox), round(oy)))
    # delik
    m = Image.new("L", (PW, PH), 255)
    w, h = hole["w"] * im.width * a.inset, hole["h"] * im.height * a.inset
    cx, cy = hx * PW, ox * 0 + oy + hole["y"] * im.height
    box = (cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2)
    d = ImageDraw.Draw(m)
    (d.ellipse if el.get("shape") == "circle" else d.rectangle)(box, fill=0)
    m = m.filter(ImageFilter.GaussianBlur(2))
    wall.putalpha(ImageChops.multiply(wall.getchannel("A"), m))
    wall.save(a.out)
    print(a.out, wall.size, "delik (foto 0-1):", [round(v, 3) for v in (cx / PW, cy / PH, w / PW, h / PH)])


def page(a):
    W, H = (int(v) for v in a.size.split(","))
    pg = Image.open(a.page).convert("RGB")
    bx, by, bw = (float(v) for v in a.box.split(","))
    pw = round(bw * W); ph = round(pw * pg.height / pg.width)
    pg = pg.resize((pw, ph), Image.LANCZOS).convert("RGBA")
    pg = pg.rotate(a.rot, resample=Image.BICUBIC, expand=True)
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ox, oy = round(bx * W - pg.width / 2), round(by * H - pg.height / 2)
    for off, blur, op in ((0.004, 0.004, 0.55), (0.018, 0.03, 0.45)):   # temas gölgesi + yumuşak gölge
        al = Image.new("L", (W, H), 0)
        al.paste(pg.getchannel("A"), (ox + round(W * off), oy + round(W * off * 1.6)))
        s = Image.new("RGBA", (W, H), (10, 6, 2, 0))
        s.putalpha(al.filter(ImageFilter.GaussianBlur(W * blur)).point(lambda v, op=op: int(v * op)))
        canvas.alpha_composite(s)
    canvas.alpha_composite(pg, (ox, oy))
    out = Path(a.out)
    canvas.save(out.with_suffix(".page.png"))
    tinted(a.table, (W, H), a.table_tint).save(out.with_suffix(".table.jpg"), quality=90)
    print(out.with_suffix(".page.png"), out.with_suffix(".table.jpg"), (W, H),
          "sayfa kutusu (tuval 0-1):", [round(v, 3) for v in (bx, by, pg.width / W, pg.height / H)])


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    f = sub.add_parser("frame"); f.add_argument("photo"); f.add_argument("element"); f.add_argument("out")
    f.add_argument("--hole", required=True); f.add_argument("--wall", default="textures/wood-table-large.jpg")
    f.add_argument("--wall-tint", default="#4A3A30"); f.add_argument("--inset", type=float, default=0.97)
    p = sub.add_parser("page"); p.add_argument("page"); p.add_argument("out")
    p.add_argument("--size", default="2160,3840"); p.add_argument("--box", default="0.5,0.42,0.86"); p.add_argument("--rot", type=float, default=-1.5)
    p.add_argument("--table", default="textures/wood-table-large.jpg"); p.add_argument("--table-tint", default="#B89B80")
    a = ap.parse_args()
    frame(a) if a.cmd == "frame" else page(a)


if __name__ == "__main__":
    main()
