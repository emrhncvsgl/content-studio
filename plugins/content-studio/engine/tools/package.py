"""Yayın paketi (PLAN 11): altyazı dosyaları, yayın miksi, yalnızca-ses parçası, kapak karesi, meta veri iskeleti.

Kullanım: voice/.venv-chatterbox/bin/python tools/package.py <bölüm_klasörü> [--cover 1.5] [--no-outro]
Kapanış logosu: channel.yaml brand.outro doluysa render sonuna eklenir (video ve yalnızca-ses aynı süre, seviye birlikte ölçülür); render/<EP>.mp4 değişmez.
Girdi:  <bölüm>/timeline.json, <bölüm>/render/<EP>.mp4 (editor çıktısı)
Çıktı:
  captions/<dil>.srt, captions/<dil>.json   altyazı (metin senaryodan, zaman Whisper'dan; timeline ile aynı)
  render/<EP>.final.mp4                      yayın miksi: −14 LUFS, tepe ≤ −1 dBTP (iki geçişli loudnorm), video kopyalanır
  render/<EP>.<dil>.wav                      yalnızca-ses parçası (çoklu dil ses/MLA için), aynı seviye
  render/cover.png                           kapak: clips/thumb/cover.json varsa Thumbnail kompozisyonu, yoksa video karesi (--cover sn)
  render/cover.jpg                           (uzun video) YouTube'a yüklenecek kapak, ≤ 2 MB; elle konmuş cover.png ezilmez
  publish chapters / chapters_text           (uzun video, brief format: long) props.chapter sahnelerinden bölüm zaman damgaları
  publish.<dil>.yaml                         meta veri iskeleti: otomatik alanlar dolu; başlık/açıklama orkestratör tarafından yazılır
  render/qc/<EP>.spectrogram.png             sahne başına ses ölçümü publish yaml loudness.scenes'te (sound-design skill §6)
--qc-only: paketlemeden yalnızca var olan final.mp4'ü ölçer.
"""
import argparse
import csv
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import yaml

ROOT = Path(__file__).parent.parent
# Tepe hedefi −1.5: AAC kodlaması tepeyi ~0.2-0.5 dB yükseltiyor; yayın dosyasında ≤ −1 dBTP kalsın (EP001: −1.0 hedefi −0.8 verdi)
TARGET_LUFS, TARGET_TP, TARGET_LRA = -14.0, -1.5, 11.0
MAX_CHARS = 42  # altyazı satırı (YouTube önerisine yakın)


def ts(ms: float) -> str:
    ms = int(round(ms))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def split_balanced(ws: list[dict], max_chars: int = MAX_CHARS) -> list[list[dict]]:
    """Bir cümleyi ≤ max_chars parçalara dengeli böler (en az parça; parça uzunlukları birbirine yakın, virgülden sonra bölmek tercih).

    QA (EP002): açgözlü bölme cümlenin sonunu tek bırakıyordu ("a plate.", "debt.", "them.", "Way Round.")."""
    n = len(ws)
    lens = [len(w["text"]) for w in ws]
    def width(i, j):  # ws[i:j] karakter sayısı
        return sum(lens[i:j]) + (j - i - 1)
    total = width(0, n)
    if total <= max_chars:
        return [ws]
    k = -(-total // max_chars)  # en az parça sayısı
    while True:
        target = total / k
        # dp[j] = (maliyet, bölme noktaları) ilk j kelime için, tam olarak m parçada
        best = {0: (0.0, [])}
        for m in range(1, k + 1):
            nb = {}
            for j in range(1, n + 1):
                for i, (c, cuts) in best.items():
                    if i >= j:
                        continue
                    wd = width(i, j)
                    if wd > max_chars and j - i > 1:
                        continue
                    pen = (wd - target) ** 2
                    if j < n and not re.search(r"[,;:]$", ws[j - 1]["text"]):
                        pen += 40.0  # virgülsüz bölme cezalı (virgülde bölmek tercih)
                    if j - i == 1 and n > 1:
                        pen += 400.0  # tek kelimelik parça olmasın
                    cand = (c + pen, cuts + [j])
                    if j not in nb or cand[0] < nb[j][0]:
                        nb[j] = cand
            best = nb
        if n in best:
            cuts = [0] + best[n][1]
            return [ws[a:b] for a, b in zip(cuts, cuts[1:])]
        k += 1


def caption_cues(tl: dict, lang: str) -> list[dict]:
    """Kelimeler mutlak zamana çevrilir; her cümle ≤ MAX_CHARS parçalara dengeli bölünür (cümle sonu kelimesi tek kalmaz)."""
    cues = []
    for sc in tl["scenes"]:
        base = sc["startFrame"] / tl["fps"] * 1000
        sent = []
        for w in sc["words"].get(lang, []):
            sent.append({"text": w["text"], "start": base + w["startMs"], "end": base + w["endMs"]})
            if re.search(r"[.!?]$", w["text"]):
                cues += split_balanced(sent); sent = []
        if sent:
            cues += split_balanced(sent)
    out = []
    for c in cues:
        out.append({"start": c[0]["start"], "end": c[-1]["end"] + 150, "text": " ".join(x["text"] for x in c)})
    for a, b in zip(out, out[1:]):  # çakışma olmasın
        a["end"] = min(a["end"], b["start"] - 10)
    return out


def _ln_measure(src: Path, pre: str = "") -> dict:
    af = (pre + "," if pre else "") + f"loudnorm=I={TARGET_LUFS}:TP={TARGET_TP}:LRA={TARGET_LRA}:print_format=json"
    p = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(src), "-af", af, "-f", "null", "-"], capture_output=True, text=True, check=True)
    return json.loads(p.stderr[p.stderr.rindex("{"):p.stderr.rindex("}") + 1])


def loudnorm(src: Path, dst: Path, video: bool):
    """İki geçişli EBU R128 normalizasyonu; ilk geçiş ölçer, ikinci geçiş doğrusal uygular.
    Doğrusal kazanç tepeleri tavanın üstüne itecekse (keskin darbeler; EP007 v2: −0.8 dBTP) önce o kazanç + bakışlı limiter
    (tavanın 1 dB altı) uygulanır, sonra doğrusal normalize edilir (cinecode master_audio.py --limit fikri, MIT)."""
    af = f"loudnorm=I={TARGET_LUFS}:TP={TARGET_TP}:LRA={TARGET_LRA}"
    m = _ln_measure(src)
    src_i = m["input_i"]
    pre = ""
    gain = TARGET_LUFS - float(m["input_i"])
    if float(m["input_tp"]) + gain > TARGET_TP:
        lim = 10 ** ((TARGET_TP - 1.0) / 20)
        pre = f"volume={gain:.2f}dB,alimiter=limit={lim:.4f}:attack=5:release=60:level=false"
        m = _ln_measure(src, pre)
        print(f"[ses] tepe tavanı aşacaktı ({float(m['input_tp']):.1f} dBTP ölçüldü limiterden sonra): kazanç {gain:+.1f} dB + limiter")
    af2 = ((pre + ",") if pre else "") + (f"{af}:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
                                          f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
    if video:
        # -shortest: ses video süresini aşmasın (QA EP001: ses 67 ms uzundu)
        cmd = ["ffmpeg", "-loglevel", "error", "-y", "-i", str(src), "-c:v", "copy", "-af", af2, "-ar", "48000", "-c:a", "aac", "-b:a", "192k",
               "-shortest", str(dst)]
    else:
        cmd = ["ffmpeg", "-loglevel", "error", "-y", "-i", str(src), "-vn", "-af", af2, "-ar", "48000", "-c:a", "pcm_s16le", str(dst)]
    subprocess.run(cmd, check=True)
    return {**m, "input_i": src_i, "limited": bool(pre)}


def duration(path: Path) -> float:
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                                capture_output=True, text=True, check=True).stdout)


def append_outro(src: Path, outro: Path, dst: Path, fps: int):
    """Kapanışı sona ekler. Kodlayıcı ayarları farklı olduğundan kopyalamak yerine yeniden kodlar (crf 16)."""
    norm = f"fps={fps},format=yuv420p,setsar=1"
    aud = "aformat=sample_rates=48000:channel_layouts=stereo"
    fc = f"[0:v]{norm}[v0];[1:v]{norm}[v1];[0:a]{aud}[a0];[1:a]{aud}[a1];[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]"
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(src), "-i", str(outro), "-filter_complex", fc, "-map", "[v]", "-map", "[a]",
                    "-c:v", "libx264", "-crf", "16", "-preset", "medium", "-c:a", "pcm_s16le", str(dst)], check=True)


def measure(path: Path) -> dict:
    p = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(path), "-af", "ebur128=peak=true", "-f", "null", "-"],
                       capture_output=True, text=True, check=True)
    tail = p.stderr[p.stderr.rindex("Summary:"):]
    get = lambda k: float(re.search(rf"{k}:\s+(-?[\d.]+)", tail).group(1))  # noqa: E731
    return {"integrated_lufs": get("I"), "true_peak_dbtp": get("Peak"), "lra": get("LRA")}


def _lufs(path: Path, start: float, dur: float, band: str = "") -> float:
    """Bir pencerenin integrated LUFS'i (band: ffmpeg süzgeç zinciri, ör. 2-5 kHz). Sessiz pencere −70."""
    af = (band + "," if band else "") + "ebur128"
    p = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-ss", f"{start:.3f}", "-t", f"{max(dur, 0.5):.3f}", "-i", str(path),
                        "-vn", "-af", af, "-f", "null", "-"], capture_output=True, text=True)
    m = re.findall(r"I:\s+(-?[\d.]+) LUFS", p.stderr)
    return float(m[-1]) if m else -70.0


def sound_qc(final: Path, tl: dict, out_dir: Path) -> dict:
    """Sahne başına ses ölçümü (sound-design skill §6; cinecode qc.py sceneloud fikri): sahne LUFS'i ve 2-5 kHz sertlik payı
    (bant LUFS − tam LUFS), medyandan > 3 LU ya da > 3 dB sapan sahne işaretlenir. Bir de log-frekans spektrogram yazar."""
    import statistics
    fps = tl["fps"]
    rows = []
    for sc in tl["scenes"]:
        start, dur = sc["startFrame"] / fps, sc["durationFrames"] / fps
        full = _lufs(final, start, dur)
        band = _lufs(final, start, dur, "highpass=f=2000:p=2,lowpass=f=5000:p=2")
        rows.append({"id": sc["id"], "start_s": round(start, 2), "lufs": round(full, 1),
                     "harsh_db": round(band - full, 1) if full > -60 else None})
    live = [r for r in rows if r["lufs"] > -60]
    med_l = statistics.median(r["lufs"] for r in live) if live else -70
    med_h = statistics.median(r["harsh_db"] for r in live) if live else 0
    flags = []
    for r in rows:
        if r["lufs"] <= -60:
            flags.append(f"{r['id']}: neredeyse sessiz ({r['lufs']} LUFS); bilerek mi?")
            continue
        if abs(r["lufs"] - med_l) > 3:
            flags.append(f"{r['id']}: {r['lufs']:+.1f} LUFS, medyandan {r['lufs'] - med_l:+.1f} LU")
        if r["harsh_db"] is not None and r["harsh_db"] - med_h > 3:
            flags.append(f"{r['id']}: 2-5 kHz payı medyandan {r['harsh_db'] - med_h:+.1f} dB (sert)")
    out_dir.mkdir(parents=True, exist_ok=True)
    spec = out_dir / f"{tl['episode']}.spectrogram.png"
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(final), "-lavfi",
                    "aformat=channel_layouts=mono,showspectrumpic=s=1600x600:fscale=log:legend=1", str(spec)], check=False)
    return {"median_lufs": round(med_l, 1), "median_harsh_db": round(med_h, 1), "flags": flags, "scenes": rows,
            "spectrogram": (str(spec.relative_to(final.parent.parent)) if spec.is_relative_to(final.parent.parent) else str(spec)) if spec.exists() else None}


def print_qc(qc: dict):
    print(f"[ses] sahne medyanı {qc['median_lufs']} LUFS, 2-5 kHz payı {qc['median_harsh_db']} dB · "
          f"{len(qc['flags'])} işaret · spektrogram {qc['spectrogram']}")
    for f in qc["flags"]:
        print(f"       ⚠ {f}")


def chapters(tl: dict, old: list | None) -> list[dict]:
    """props.chapter taşıyan sahnelerden (uzun video bölüm başlığı, remotion-styles 'Bölüm başlığı'). 0:00 girişin adı elle verilir
    (publish yaml'da chapters[0].title düzeltilirse yeniden paketlemede korunur)."""
    fps = tl.get("fps", 30)
    out = [{"at": "0:00", "title": (old or [{}])[0].get("title", "Cold open")}]
    for sc in tl["scenes"]:
        ch = (sc.get("props") or {}).get("chapter")
        if ch:
            sec = int(sc["startFrame"] / fps)
            title = f"{ch['kicker']}: {ch['title']}" if ch.get("kicker") else ch["title"]
            if sec < 10:
                out[0]["title"] = title
            else:
                out.append({"at": f"{sec // 60}:{sec % 60:02d}", "title": title})
    return out


def make_cover(ep: Path, final: Path, at: float, long: bool) -> str:
    """Kapak. clips/thumb/cover.json varsa Thumbnail kompozisyonundan (özel tasarım, remotion-styles vox-explainer §9b) üretilir;
    uzun videoda (16:9) seçilmiş kapak yoksa videodan kare render/cover.frame.png'ye düşer: elle konmuş render/cover.png EZİLMEZ.
    Uzun videoda ayrıca render/cover.jpg (YouTube sınırı 2 MB)."""
    r = ep / "render"
    spec = ep / "clips" / "thumb" / "cover.json"
    if spec.exists():
        subprocess.run(["npx", "remotion", "still", "src/index.ts", "Thumbnail", str(r / "cover.png"), f"--props={spec}", "--log=error"],
                       cwd=ROOT / "studio", check=True)
    else:
        grab = r / ("cover.frame.png" if long and (r / "cover.png").exists() else "cover.png")
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-ss", str(at), "-i", str(final), "-frames:v", "1", str(grab)], check=True)
    if not long:
        return "render/cover.png"
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(r / "cover.png"), "-q:v", "2", str(r / "cover.jpg")], check=True)
    if (r / "cover.jpg").stat().st_size > 2_000_000:
        print("  UYARI: cover.jpg > 2 MB (YouTube sınırı); -q:v değerini büyüt")
    return "render/cover.jpg"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("episode")
    ap.add_argument("--cover", type=float, default=1.5, help="kapak karesi zamanı (sn)")
    ap.add_argument("--no-outro", action="store_true", help="kapanış logosunu ekleme")
    ap.add_argument("--qc-only", action="store_true", help="yalnızca var olan final.mp4'ün sahne başına ses ölçümü (publish yaml güncellenir)")
    a = ap.parse_args()
    ep = Path(a.episode).resolve()
    tl = json.loads((ep / "timeline.json").read_text())
    lang, epi = tl["lang"], tl["episode"]
    if a.qc_only:
        final = ep / "render" / f"{epi}.final.mp4"
        qc = sound_qc(final, tl, ep / "render" / "qc")
        meta_path = ep / f"publish.{lang}.yaml"
        if meta_path.exists():
            meta = yaml.safe_load(meta_path.read_text())
            meta.setdefault("loudness", {})["scenes"] = qc
            meta_path.write_text(yaml.safe_dump(meta, allow_unicode=True, sort_keys=False, width=120))
        print_qc(qc)
        return
    src = ep / "render" / f"{epi}.mp4"
    if not src.exists():
        raise SystemExit(f"render yok: {src}")

    (ep / "captions").mkdir(exist_ok=True)
    cues = caption_cues(tl, lang)
    srt = "\n".join(f"{i}\n{ts(c['start'])} --> {ts(c['end'])}\n{c['text']}\n" for i, c in enumerate(cues, 1))
    (ep / "captions" / f"{lang}.srt").write_text(srt)
    (ep / "captions" / f"{lang}.json").write_text(json.dumps(cues, ensure_ascii=False, indent=2))

    final = ep / "render" / f"{epi}.final.mp4"
    sys.path.insert(0, str(ROOT / "tools"))
    from channel import load_channel
    channel = load_channel(ep)
    outro = channel.get("brand", {}).get("outro")
    with tempfile.TemporaryDirectory() as td:
        mix = src
        if outro and not a.no_outro:
            mix = Path(td) / "with-outro.mkv"
            append_outro(src, ROOT / "content" / outro, mix, tl["fps"])
        before = loudnorm(mix, final, video=True)
        loudnorm(mix, ep / "render" / f"{epi}.{lang}.wav", video=False)
    after = measure(final)
    qc = sound_qc(final, tl, ep / "render" / "qc")
    brief = yaml.safe_load((ep / "brief.yaml").read_text())
    long = brief.get("format") == "long"
    cover = make_cover(ep, final, a.cover, long)

    brief = yaml.safe_load((ep / "brief.yaml").read_text())
    script = json.loads((ep / f"script.{lang}.json").read_text())
    assets = ep / "assets.csv"
    meta_path = ep / f"publish.{lang}.yaml"
    old = yaml.safe_load(meta_path.read_text()) if meta_path.exists() else {}
    meta = {
        "episode": epi, "lang": lang,
        "title": old.get("title", "TODO (orkestratör yazar: ≤ 70 karakter, hook ile uyumlu)"),
        "description": old.get("description", "TODO (orkestratör yazar: 2-3 cümle + kaynaklar + atıflar + sentetik ses notu)"),
        "hashtags": old.get("hashtags", []),
        "files": {"video": str(final.relative_to(ep)), "audio_only": f"render/{epi}.{lang}.wav", "captions": f"captions/{lang}.srt",
                  "cover": cover},
        "duration_s": round(duration(final), 2),
        "loudness": {"source_lufs": float(before["input_i"]), **after, "scenes": qc},
        "sources": script.get("sources", []),
        # yalnızca atıf gerektiren varlıklar açıklamaya girer (ör. CC BY fotoğraf); fontlar (OFL) gerektirmez
        "attributions": [f"{r['file']}: {r['author']} ({r['license']}) {r['source_url']}".strip()
                         for r in csv.DictReader(assets.open()) if r.get("attribution_required", "").lower() in {"yes", "evet", "true"}]
                        if assets.exists() else [],
        "synthetic_content": "Anlatıcı sesi yapay zekâ ile üretilmiştir (gerçek bir kişinin sesi değildir). YouTube Studio'da 'değiştirilmiş veya sentetik içerik' bildirimi değerlendirilmeli.",
        "source_id": brief.get("source_id") or brief.get("principle_id") or old.get("source_id") or old.get("principle_id"),  # brief serbest konuysa elle yazılan değer korunur
    }
    if long:   # bölüm zaman damgaları: açıklamaya olduğu gibi yapıştırılır (YouTube: ilki 0:00, en az 3, her biri ≥ 10 sn)
        meta["chapters"] = chapters(tl, old.get("chapters"))
        meta["chapters_text"] = "\n".join(f"{c['at']} {c['title']}" for c in meta["chapters"])
    meta_path.write_text(yaml.safe_dump(meta, allow_unicode=True, sort_keys=False, width=120))
    print(f"[done] {len(cues)} altyazı · {after['integrated_lufs']} LUFS, tepe {after['true_peak_dbtp']} dBTP (kaynak {before['input_i']} LUFS)")
    print(f"       {final.relative_to(ROOT)} · {meta_path.relative_to(ROOT)}")
    print_qc(qc)


if __name__ == "__main__":
    main()
