#!/usr/bin/env python3
"""Kapanış logosu: kâğıt topağı atılır, sekip durur, açılır; iç yüzünde kanal logosu vardır.
Kodla 3B: kâğıt ızgarası küreye sarılır (kenarlar kameraya doğru kapanır, logo içeride kalır), buruşma üç ölçekli
Delaunay üçgen yüzeyi (keskin kırışık), z-tamponlu nokta boyama + 2x örnekleme. Paket gerekmez (numpy, scipy, PIL).
Çalıştır: voice/.venv-chatterbox/bin/python tools/make_outro.py --still 4,12,20,26,32,45   (kare numaraları, deneme tabakası)
          voice/.venv-chatterbox/bin/python tools/make_outro.py                     (kareler + mp4, content/brand/outro/)"""
import argparse
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from scipy.interpolate import LinearNDInterpolator

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "content/brand/outro"
W, H, FPS, FRAMES = 1080, 1920, 30, 60
CX, CY, HALF = 540, 860, 455            # logonun duracağı yer, kâğıdın yarı genişliği (px)
K0 = 6.0                                # kapalı topağın bükülmesi
YEL = np.array([249, 213, 9], np.float32) / 255
LIGHT = np.array([-.45, -.55, .70], np.float32)
LIGHT /= np.linalg.norm(LIGHT)


def fractal(n, seed, base=4, octaves=4):
    """Düzgün gürültü, yaklaşık -1..1."""
    r = np.random.default_rng(seed)
    a = np.zeros((n, n), np.float32)
    for o in range(octaves):
        g = base * 2 ** o
        a += ndi.zoom(r.standard_normal((g + 3, g + 3)).astype(np.float32), n / g, order=3)[:n, :n] / 2 ** o
    return a / a.std() / 2


def facets(n, count, seed):
    """Rastgele noktalı üçgen yüzey: düz yüzler + keskin kırışıklar."""
    r = np.random.default_rng(seed)
    pts = r.uniform(-1.25, 1.25, (count, 2))
    f = LinearNDInterpolator(pts, r.standard_normal(count))
    u = np.linspace(-1, 1, n, dtype=np.float32)
    uu, vv = np.meshgrid(u, u)
    return np.nan_to_num(f(uu, vv)).astype(np.float32)


class Sheet:
    def __init__(self, n):
        self.n = n
        u = np.linspace(-1, 1, n, dtype=np.float32)
        self.u, self.v = np.meshgrid(u, u)
        self.r = np.hypot(self.u, self.v) + 1e-6
        self.du, self.dv = self.u / self.r, self.v / self.r
        self.big = facets(n, 70, 1)
        self.mid = facets(n, 420, 2)
        self.fine = facets(n, 2600, 3)
        self.kvar = np.clip(1 + .34 * fractal(n, 4, base=2, octaves=2), .78, 1.35)      # kâğıt her yerde aynı açılmaz
        # yırtık kenar: iç bölge + kenardaki beyaz kâğıt özü
        e = np.maximum(np.abs(self.u), np.abs(self.v))
        wob = .022 * fractal(n, 5, base=6, octaves=5)
        self.keep = e + wob < .985
        core = e + wob * 1.5 > .955
        logo = Image.open(ROOT / "content/brand/final/profile.png").convert("RGB").resize((n, n), Image.LANCZOS)
        self.front = np.asarray(logo, np.float32) / 255
        self.front = self.front * 1.0 + .035          # siyah zemin kırışıkları görünsün
        grain = 1 + .05 * fractal(n, 6, base=64, octaves=3)[..., None]
        self.back = np.array([.93, .90, .83], np.float32) * grain
        self.front[core] = np.array([.95, .93, .88], np.float32)

    def shape(self, kappa, amp):
        """kappa: bükülme (0 düz, 4.2 kapalı topak); amp: buruşma. Konum (x, y, z), z kameraya doğru."""
        k = np.maximum(kappa * self.kvar, 1e-3)
        t0 = k * self.r
        th = np.where(t0 < 2.4, t0, 2.4 + .68 * np.tanh((t0 - 2.4) / .68))
        s, c = np.sin(th), np.cos(th)
        rad = s / k
        x, y, z = rad * self.du, rad * self.dv, (1 - c) / k
        h = amp * (self.big * .50 + self.mid * .20 + self.fine * .04)
        # yüzey normali boyunca itme (ön yüz, çukurun içine bakar)
        return x - s * self.du * h, y - s * self.dv * h, z + c * h

    def render(self, kappa, amp, rot, scale, cx, cy, ss=2):
        x, y, z = self.shape(kappa, amp)
        # topak merkezini (0, 0, z0) kameraya göre ortala
        z = z - z.mean() * min(kappa / K0, 1)
        ca, sa = np.cos(rot[2]), np.sin(rot[2])
        x, y = x * ca - y * sa, x * sa + y * ca
        cb, sb = np.cos(rot[0]), np.sin(rot[0])
        y, z = y * cb - z * sb, y * sb + z * cb
        cg, sg = np.cos(rot[1]), np.sin(rot[1])
        x, z = x * cg + z * sg, -x * sg + z * cg
        # normal: ızgara türevlerinin çarpımı
        P = np.stack([x, y, z], -1)
        tu = np.gradient(P, axis=1)
        tv = np.gradient(P, axis=0)
        N = np.cross(tu, tv)
        N /= np.linalg.norm(N, axis=-1, keepdims=True) + 1e-9
        del tu, tv
        return self._splat(x, y, z, N * self.orient, scale, cx, cy, ss)

    orient = 1.0

    def _splat(self, x, y, z, N, scale, cx, cy, ss):
        w, h = W * ss, H * ss
        px = ((x * scale + cx) * ss).astype(np.int32)
        py = ((y * scale + cy) * ss).astype(np.int32)
        ok = self.keep & (px >= 0) & (px < w) & (py >= 0) & (py < h)
        if not ok.any():                        # kâğıt henüz kadraja girmedi
            return np.zeros((h, w, 3), np.float32), np.zeros((h, w), np.float32)
        isfront = N[..., 2] >= 0
        Ns = np.where(isfront[..., None], N, -N)
        lam = np.clip(Ns @ LIGHT, 0, 1)
        half = (LIGHT + np.array([0, 0, 1], np.float32))
        half /= np.linalg.norm(half)
        spec = np.clip(Ns @ half, 0, 1) ** 12
        col = np.where(isfront[..., None], self.front, self.back)
        shade = (.50 + .72 * lam)[..., None]
        col = col * shade + (spec * .04)[..., None]
        idx = (py * w + px)[ok]
        zz = z[ok]
        o = np.argsort(zz, kind="stable")
        rgb = np.zeros((h * w, 3), np.float32)
        dep = np.full(h * w, np.nan, np.float32)
        al = np.zeros(h * w, np.float32)
        # her nokta 2x2 piksel: ön katmanda delik kalmasın, arka katman görünmesin; sıra derinliğe göre korunur
        i4 = (idx[o][:, None] + np.array([0, 1, w, w + 1], np.int32)).ravel().clip(0, h * w - 1)
        rgb[i4] = np.repeat(col[ok][o], 4, axis=0)
        dep[i4] = np.repeat(zz[o], 4)
        al[i4] = 1
        rgb = rgb.reshape(h, w, 3)
        al = al.reshape(h, w)
        dep = dep.reshape(h, w)
        # delikleri kapat
        cnt = ndi.uniform_filter(al, 3)
        hole = (al == 0) & (cnt > .45)
        if hole.any():
            for c in range(3):
                avg = ndi.uniform_filter(rgb[..., c], 3) / np.maximum(cnt, 1e-3)
                rgb[..., c][hole] = avg[hole]
            al[hole] = 1
        # ekran uzayında kuytu gölgesi
        d0 = np.nan_to_num(dep, nan=float(np.nanmin(dep)))
        ao = np.clip((ndi.gaussian_filter(d0, 7 * ss) - d0) * scale / (11 * ss), 0, 1)
        ao2 = np.clip((ndi.gaussian_filter(d0, 26 * ss) - d0) * scale / (55 * ss), 0, 1)
        rgb *= (1 - .38 * ao - .42 * ao2)[..., None]
        return rgb, al


def background():
    """Kapaktaki sarı kâğıt zemin: paper003 dokusu, marka sarısı."""
    im = Image.open(ROOT / "content/textures/paper003.jpg").convert("L")
    sc = max(W / im.width, H / im.height) * 1.0
    im = im.resize((int(im.width * sc) + 1, int(im.height * sc) + 1), Image.BICUBIC).crop((0, 0, W, H))
    g = np.asarray(im, np.float32)
    g = g - ndi.gaussian_filter(g, 24)
    g = ndi.gaussian_filter(g, .8) / (g.std() + 1e-3)
    bg = YEL * (1 + .022 * g[..., None])
    yy, xx = np.mgrid[:H, :W].astype(np.float32)
    vig = 1 - .30 * (((xx - W / 2) / W) ** 2 + ((yy - H / 2) / H) ** 2)
    return (bg * vig[..., None]).astype(np.float32)


def compose(bg, rgb, al, ss, height):
    """2x örneklemeyi indirger, masaya düşen gölgeyi ekler. height: kâğıdın masadan yüksekliği (px)."""
    if ss > 1:
        rgb = rgb.reshape(H, ss, W, ss, 3).mean((1, 3))
        al = al.reshape(H, ss, W, ss).mean((1, 3))
    off = 10 + height
    sh = ndi.shift(al, (off * .85, off * .65), order=1)
    sh = ndi.gaussian_filter(sh, 9 + height * .35) * .50 + ndi.gaussian_filter(al, 3) * .16
    out = bg * (1 - np.clip(sh, 0, 1)[..., None] * .82)
    out = out * (1 - al[..., None]) + rgb * al[..., None]
    return (out.clip(0, 1) ** (1 / 1.0) * 255).astype(np.uint8)


def calibrate(s):
    """Düz halde ön yüz kameraya baksın."""
    x, y, z = s.shape(0.0, 0.0)
    P = np.stack([x, y, z], -1)[:: s.n // 8, :: s.n // 8]
    N = np.cross(np.gradient(P, axis=1), np.gradient(P, axis=0))
    s.orient = 1.0 if N[4, 4, 2] > 0 else -1.0


def ease(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def pose(open_t):
    """Açılma oranından bükülme ve buruşma."""
    kappa = K0 * (1 - open_t) ** 1.7
    amp = .018 + .17 * (1 - open_t) ** 1.3
    return float(kappa), float(amp)


LAND, BOUNCE, OPEN0, OPEN1 = 9, 17, 15, 41      # kare: ilk temas, ikinci temas, açılma başı/sonu
TUMBLE = np.array([1.35, .8, 2.6])              # topağın düğüm noktası kameradan uzakta dursun
BALL = 1.75                                     # topak ölçeği (kâğıt birimine göre)


def state(f):
    """Kare (kesirli olabilir) -> açılma, dönüş, ölçek, konum, masadan yükseklik."""
    x = float(np.clip((f - OPEN0) / (OPEN1 - OPEN0), 0, 1))
    open_t = 1 - (1 - x) ** 1.8
    settle = ease(0, .62, x)
    rot = TUMBLE * (1 - settle) + np.array([0, 0, -.03]) * settle
    if f < LAND:                                # atış: yukarıdan gelir, yere doğru alçalır
        p = max(f, 0) / LAND
        y = -340 + (CY + 340) * p ** .9
        height = 260 * (1 - p) ** 1.1 + 12
        spin = (1 - p) * 3.4
        rot = rot + np.array([spin, spin * .6, -spin * .8])
    elif f < BOUNCE:                            # küçük sekme
        p = (f - LAND) / (BOUNCE - LAND)
        y, height = CY - 6 * (1 - p), 12 + 62 * 4 * p * (1 - p)
        rot = rot + np.array([(1 - p) * .35, 0, (1 - p) * -.3])
    else:
        y, height = CY, 12 * (1 - x) + 5
    scale = HALF * (BALL * (1 - open_t) + open_t) * (1 + height / 900)
    scale *= 1 + .018 * ease(OPEN1 - 6, FRAMES, f)      # logoya hafif yaklaşma
    return open_t, rot, scale, CX, y, height


def frame(s, bg, f):
    """Hızlı karelerde üç alt kare: hareket bulanıklığı."""
    subs = [f - .33, f, f + .33] if f <= BOUNCE else [f]
    acc = None
    for g in subs:
        open_t, rot, scale, cx, cy, height = state(g)
        k, amp = pose(open_t)
        rgb, al = s.render(k, amp, rot, scale, cx, cy)
        im = compose(bg, rgb, al, 2, height).astype(np.float32)
        acc = im if acc is None else acc + im
    return (acc / len(subs)).astype(np.uint8)


def mux():
    """Sesler kareye bağlı: ilk temas, sekme, açılma hışırtısı, logonun oturması. Çıktı: outro.mp4."""
    sfx = ROOT / "content/sfx/pixabay"
    parts = [("thud_small", LAND, -4), ("thud_small", BOUNCE, -13), ("crumple", OPEN0, -5), ("paper_drop", OPEN1 - 5, -9),
             ("thud_deep_loud", OPEN1 - 1, -14)]
    cmd = ["ffmpeg", "-y", "-v", "error", "-i", str(OUT / "outro.silent.mp4")]
    chain = []
    for i, (name, f, db) in enumerate(parts):
        cmd += ["-i", str(sfx / f"{name}.wav")]
        ms = int(f / FPS * 1000)
        chain.append(f"[{i + 1}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume={db}dB,adelay={ms}|{ms}[a{i}]")
    mix = "".join(f"[a{i}]" for i in range(len(parts)))
    fade = FRAMES / FPS - .25
    chain.append(f"{mix}amix=inputs={len(parts)}:normalize=0,afade=t=out:st={fade}:d=0.25,atrim=0:{FRAMES / FPS},alimiter=limit=.8[a]")
    subprocess.run(cmd + ["-filter_complex", ";".join(chain), "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac",
                          "-b:a", "256k", str(OUT / "outro.mp4")], check=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--still", help="virgülle kare numaraları, deneme tabakası")
    ap.add_argument("--n", type=int, default=2100)
    ap.add_argument("--audio", action="store_true", help="yalnızca sesi yeniden kur")
    a = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    if a.audio:
        return mux()
    s = Sheet(a.n)
    calibrate(s)
    bg = background()
    if a.still:
        tiles = [Image.fromarray(frame(s, bg, float(t))).resize((W // 3, H // 3)) for t in a.still.split(",")]
        sheet = Image.new("RGB", (W // 3 * len(tiles), H // 3))
        for i, t in enumerate(tiles):
            sheet.paste(t, (i * (W // 3), 0))
        sheet.save(OUT / "_test.jpg", quality=88)
        return
    with tempfile.TemporaryDirectory() as td:
        for f in range(FRAMES):
            Image.fromarray(frame(s, bg, f)).save(f"{td}/{f:03d}.png", compress_level=1)
            print(f, flush=True)
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-framerate", str(FPS), "-i", f"{td}/%03d.png", "-c:v", "libx264",
                        "-crf", "15", "-preset", "slow", "-pix_fmt", "yuv420p", str(OUT / "outro.silent.mp4")], check=True)
    mux()


if __name__ == "__main__":
    main()
