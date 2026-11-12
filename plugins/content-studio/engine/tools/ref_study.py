"""Referans video incelemesi: indir, plan (shot) kesimlerini bul, her plandan bir kare, temas sayfası, ölçümler.

Bir stil rehberi (docs/styles/<id>.md) yazmadan önce referans videoyu ölçülebilir hale getirir. Çıktı:
  content/_refs/<slug>/
    source.mp4        (≤720p; telifli, git dışı)
    info.json         başlık, kanal, URL, süre
    shots.csv         plan no, başlangıç, bitiş, süre
    frames/sNNN.jpg   her planın ortasından bir kare
    sheet-N.jpg       temas sayfaları (6x5 = 30 plan / sayfa, plan no ve zaman yazılı)
    palette.png       videonun 16 renklik paleti
    analysis.md       ölçümler + doldurulacak inceleme iskeleti (docs/styles/_TEMPLATE.md bölümleriyle)

Kullanım:
  python tools/ref_study.py <URL|dosya> --slug kurzgesagt-ants [--from 0:30 --to 2:10] [--threshold 0.3]
Not: yalnızca stdlib + yt-dlp + ffmpeg. Ağır iş değil ama uzun videoda --from/--to ile bölüm seç.
"""
import argparse, csv, json, re, shutil, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REFS = ROOT / "content" / "_refs"
FONT = "/System/Library/Fonts/Supplemental/Arial.ttf"


def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


def to_sec(t):
    if t is None:
        return None
    parts = [float(p) for p in str(t).split(":")]
    s = 0.0
    for p in parts:
        s = s * 60 + p
    return s


def cut(src, dst, start, end):
    cmd = ["ffmpeg", "-y", "-loglevel", "error"]
    if start is not None:
        cmd += ["-ss", str(start)]
    if end is not None:
        cmd += ["-to", str(end)]
    cmd += ["-i", str(src), "-vf", "scale=-2:'min(720,ih)'", "-c:v", "libx264", "-crf", "20", "-c:a", "aac", str(dst)]
    r = run(cmd)
    if r.returncode:
        sys.exit(r.stderr)


def fetch(src, out, start, end):
    dst = out / "source.mp4"
    if Path(src).exists():
        cut(src, dst, start, end)
        (out / "info.json").write_text(json.dumps({"title": Path(src).stem, "source": str(src)}, ensure_ascii=False, indent=1))
        return dst
    # Bölüm (--download-sections) yt-dlp'nin ffmpeg çağrısında hata veriyor (kod 8): tamamını indir, yerelde kes
    cmd = ["yt-dlp", "-q", "--no-update", "--js-runtimes", "node", "--no-playlist", "-f", "bv*[height<=720]+ba/b[height<=720]/b", "--merge-output-format", "mp4",
           "--write-info-json", "-o", str(out / "raw.%(ext)s")]
    r = run(cmd + [src])
    if r.returncode:
        sys.exit(r.stderr)
    cut(out / "raw.mp4", dst, start, end)
    (out / "raw.mp4").unlink()
    meta = json.loads((out / "raw.info.json").read_text())
    (out / "raw.info.json").unlink()
    keep = {k: meta.get(k) for k in ("title", "channel", "uploader", "webpage_url", "duration", "upload_date", "license")}
    keep["section"] = [start, end]
    (out / "info.json").write_text(json.dumps(keep, ensure_ascii=False, indent=1))
    return dst


def duration(path):
    r = run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)])
    return float(r.stdout.strip())


def cuts(path, thr):
    r = run(["ffmpeg", "-i", str(path), "-vf", f"select='gt(scene,{thr})',showinfo", "-an", "-f", "null", "-"])
    return [float(m) for m in re.findall(r"pts_time:([\d.]+)", r.stderr)]


def loudness(path):
    r = run(["ffmpeg", "-i", str(path), "-vn", "-af", "ebur128", "-f", "null", "-"])
    m = re.findall(r"I:\s+(-?[\d.]+) LUFS", r.stderr)
    return float(m[-1]) if m else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("--slug", required=True)
    ap.add_argument("--from", dest="start")
    ap.add_argument("--to", dest="end")
    ap.add_argument("--threshold", type=float, default=0.3, help="sahne değişimi eşiği; kolaj/yumuşak geçişlerde 0.2")
    a = ap.parse_args()

    out = REFS / a.slug
    frames = out / "frames"
    if frames.exists():
        shutil.rmtree(frames)
    frames.mkdir(parents=True)
    src = out / "source.mp4"
    if not src.exists():
        src = fetch(a.src, out, to_sec(a.start), to_sec(a.end))
    dur = duration(src)

    # Planlar: kesim noktaları arası; çok kısa (<0.15 s) parçalar bir önceki plana katılır (flaş, geçiş karesi)
    bounds = [0.0] + [t for t in cuts(src, a.threshold)] + [dur]
    shots = []
    for s, e in zip(bounds, bounds[1:]):
        if shots and e - s < 0.15:
            shots[-1][1] = e
        elif e > s:
            shots.append([s, e])
    with open(out / "shots.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["shot", "start", "end", "dur"])
        for i, (s, e) in enumerate(shots, 1):
            w.writerow([i, f"{s:.2f}", f"{e:.2f}", f"{e - s:.2f}"])
            run(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{(s + e) / 2:.3f}", "-i", str(src), "-frames:v", "1",
                 "-vf", "scale=-2:240", str(frames / f"s{i:03d}.jpg")])

    # Temas sayfası PIL ile (Homebrew ffmpeg'de drawtext yok): plan no + başlangıç zamanı
    from PIL import Image, ImageDraw, ImageFont
    for old in out.glob("sheet-*.jpg"):
        old.unlink()
    font = ImageFont.truetype(FONT, 16)
    per, cols = 30, 6
    for p in range((len(shots) + per - 1) // per):
        page = list(range(p * per, min(len(shots), (p + 1) * per)))
        imgs = [Image.open(frames / f"s{i + 1:03d}.jpg") for i in page]
        cw, ch = max(im.width for im in imgs), max(im.height for im in imgs)
        rows = (len(imgs) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * (cw + 4) + 4, rows * (ch + 4) + 4), "gray")
        for k, (i, im) in enumerate(zip(page, imgs)):
            x, y = 4 + (k % cols) * (cw + 4), 4 + (k // cols) * (ch + 4)
            sheet.paste(im, (x, y))
            s, e = shots[i]
            label = f"{i + 1}  {int(s // 60)}:{s % 60:04.1f}  ({e - s:.1f}s)"
            d = ImageDraw.Draw(sheet)
            d.rectangle(d.textbbox((x + 4, y + 4), label, font=font), fill="black")
            d.text((x + 4, y + 4), label, fill="white", font=font)
        sheet.save(out / f"sheet-{p + 1}.jpg", quality=85)
    run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-vf", "fps=1,scale=160:-2,palettegen=max_colors=16", str(out / "palette.png")])

    lens = sorted(e - s for s, e in shots)
    med = lens[len(lens) // 2]
    lufs = loudness(src)
    info = json.loads((out / "info.json").read_text())
    long_shots = sorted(range(len(shots)), key=lambda i: shots[i][0] - shots[i][1])[:5]
    md = f"""# Referans: {info.get('title')}

- Kaynak: {info.get('webpage_url') or info.get('source')} · kanal: {info.get('channel') or info.get('uploader') or '?'} · bölüm: {info.get('section')}
- Süre {dur:.1f} s · plan sayısı {len(shots)} · ortalama plan {dur / len(shots):.2f} s · medyan {med:.2f} s · kesim/dk {60 * (len(shots) - 1) / dur:.1f}
- En uzun planlar: {', '.join(f'#{i + 1} ({shots[i][1] - shots[i][0]:.1f} s)' for i in long_shots)}
- Ses yüksekliği {lufs} LUFS · palet: `palette.png` · temas sayfaları: `sheet-*.jpg` · planlar: `shots.csv`
- Eşik {a.threshold}: yumuşak geçişler (dissolve, kamera yolculuğu) kesim sayılmaz; "uzun plan" aslında tek tuvalde kamera yolculuğu olabilir, karelere bak.

<!-- Aşağıyı temas sayfalarına ve gerekirse tek karelere bakarak doldur. Bölüm numaraları docs/styles/_TEMPLATE.md ile aynı. -->

## 1. Özü (tek bakışta bu stili ne belli ediyor)
## 2. Malzeme ve işleme (yüzey, doku, katman, kenar, ışık)
## 3. Renk mantığı (kaç ton, zemin, vurgu neye ayrılmış)
## 4. Yazı ve altyazı
## 5. Hareket niteliği (ease, adım, titreşim, giriş/çıkış)
## 6. Kamera dili ve geçişler (plan no ile örnek)
## 7. Ses (müzik, efekt, sessizlik, anlatıcı)
## 8. Bu stile özgü hamleler (plan no + bizde nasıl yapılır)
## 9. Bizim kanala uyan / uymayan
## 10. Bizde yapmak için gerekenler (bileşen, araç, paket, varlık)
"""
    am = out / "analysis.md"
    if am.exists():  # doldurulmuş incelemeyi ezme; yeni ölçümler yanına
        am = out / "analysis.new.md"
    am.write_text(md)
    print(md.split("<!--")[0])
    print(f"çıktı: {out}")


if __name__ == "__main__":
    main()
