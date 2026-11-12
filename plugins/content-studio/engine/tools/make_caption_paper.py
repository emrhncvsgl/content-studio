"""cap-paper altyazısı için hazır kâğıt şeritler: logodaki yırtık kâğıtla aynı üretim (brand_k.piece). Genişlik basamağı × renk × varyant.
Çıktı: content/assets/caption-paper/<cream|yellow>_<genişlik>_<varyant>.png (40 px saydam kenar payı). Çalıştır:
voice/.venv-chatterbox/bin/python tools/make_caption_paper.py"""
import random, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import brand_k as k
OUT = k.ROOT / "content/assets/caption-paper"; OUT.mkdir(parents=True, exist_ok=True)
H = 104; WIDTHS = range(120, 901, 60); VARIANTS = 3
COLORS = {"cream": (244, 236, 216), "yellow": (249, 213, 9)}
for name, col in COLORS.items():
    for w in WIDTHS:
        for v in range(VARIANTS):
            seed = w * 7 + v * 131 + (0 if name == "cream" else 57); r = random.Random(seed); j = lambda a: r.uniform(-a, a)
            top = [(x, j(4)) for x in range(0, w + 1, 90)]; bot = [(x, H + j(4)) for x in range(w, -1, -90)]
            poly = [(j(5), j(4))] + top[1:] + [(w + j(5), j(4)), (w + j(5), H + j(4))] + bot[1:] + [(j(5), H + j(4))]
            im, _ = k.piece(poly, col, seed, rough=.05, rim=7, contrast=1.35, crease=2)
            im.save(OUT / f"{name}_{w}_{v}.png", optimize=True)
print(len(list(OUT.glob("*.png"))))
