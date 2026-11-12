"""Ses üretimini Colab (T4 GPU) ile yapmak için paketle / geri al (voice/colab/README.md).

Kullanım:
  voice/.venv-chatterbox/bin/python tools/colab_voice.py pack EP004 [--lang en] [-- --takes 3 --seed 2000]
      → content/episodes/<bölüm>/audio/_colab/bundle.<dil>.zip (Colab not defterine yüklenir)
  voice/.venv-chatterbox/bin/python tools/colab_voice.py unpack ~/Downloads/voice_<bölüm>.<dil>.zip [--force]
      → audio/<dil>/ altına açar, sonra synth.py --gate-only ile Whisper kapısı + seçim + anlatım (Mac)

Colab'da bölümün tamamı üretilir; tek sahne düzeltmeleri (--only) Mac'te yapılır (sahne başına ~1 dk).
"""
import argparse
import json
import subprocess
import sys
import zipfile
from pathlib import Path, PurePosixPath

import yaml

ROOT = Path(__file__).parent.parent
PY = ROOT / "voice" / ".venv-chatterbox" / "bin" / "python"


def episode_dir(ep: str) -> Path:
    hits = sorted((ROOT / "content" / "episodes").glob(f"{ep}*"))
    if len(hits) != 1:
        sys.exit(f"bölüm bulunamadı ya da birden fazla: {ep} → {[h.name for h in hits]}")
    return hits[0]


def out_name(args) -> str:
    """synth.py ile aynı kural: --run X → audio/_trials/X, yoksa audio/<dil>."""
    return "_trials/" + args.extra[args.extra.index("--run") + 1] if "--run" in args.extra else args.lang


def pack(args):
    ep = episode_dir(args.episode)
    script = ep / f"script.{args.lang}.json"
    voice = json.loads(script.read_text())["voice"]
    jobs = getattr(args, "jobs", None) or []
    voices = {voice}
    for ex in [args.extra] + jobs:   # deneme profilleri (synth.py --voice): o profiller ve referansları pakete girer
        if "--voice" in ex:
            voices.add(ex[ex.index("--voice") + 1])
    if "--voice" in args.extra:
        voice = args.extra[args.extra.index("--voice") + 1]
    profile = yaml.safe_load((ROOT / "voice" / "profiles" / f"{voice}.yaml").read_text())
    ref = profile["refs"].get(args.lang) or profile["refs"]["en"]
    runs = ([args.extra] if args.extra else []) + jobs
    named = {ex[ex.index("--voice") + 1] for ex in runs if "--voice" in ex}
    if runs and all("--voice" in ex for ex in runs):
        # her iş kendi profilini adlandırıyor: yalnız onlar pakete girer (Kaggle çekirdeği ≤ ~1 MB). Bir iş bölümün varsayılan sesini
        # adlandırsa da o ses dahil (IYH001 2026-11-09: k42 + v3 işinde k42 profili düşüyordu → FileNotFoundError)
        voices = named
    files = [script, ROOT / "voice" / "synth.py", ROOT / "voice" / "textnorm.py", ROOT / "catalog" / "emotions.yaml"]
    if voice in voices:
        files.append(ROOT / ref["wav"])
    for v in sorted(voices):
        pv = yaml.safe_load((ROOT / "voice" / "profiles" / f"{v}.yaml").read_text())
        files += [ROOT / "voice" / "profiles" / f"{v}.yaml", ROOT / (pv["refs"].get(args.lang) or pv["refs"]["en"])["wav"]]
    files = list(dict.fromkeys(files))
    pron = ROOT / "catalog" / f"pronunciation.{args.lang}.yaml"
    files += [pron] if pron.exists() else []
    manifest = {"episode": ep.name, "lang": args.lang, "script": str(script.relative_to(ROOT)),
                "out": str((ep / "audio" / out_name(args)).relative_to(ROOT)), "extra_args": args.extra}
    if jobs:
        manifest["jobs"] = [{"extra_args": ex, "out": str((ep / "audio" / ("_trials/" + ex[ex.index("--run") + 1])).relative_to(ROOT))}
                            for ex in jobs]
    dest = ep / "audio" / "_colab" / f"bundle.{args.lang}.zip"
    dest.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(dest, "w", zipfile.ZIP_DEFLATED) as z:
        for f in files:
            z.write(f, f.relative_to(ROOT))
        z.writestr("colab_manifest.json", json.dumps(manifest, indent=2))
    kb = dest.stat().st_size // 1024
    print(f"[pack] {dest.relative_to(ROOT)} ({kb} KB) voice={voice} extra={args.extra}")
    if kb > 700:
        print(f"[warn] paket {kb} KB: base64 ile Kaggle çekirdeği ~1 MB'ı aşabilir (push 400 verir); referansı küçült (16 kHz FLAC)")


def unpack(args):
    zp = Path(args.zip).expanduser()
    with zipfile.ZipFile(zp) as z:
        m = json.loads(z.read("colab_manifest.json"))
        jobs = m.get("jobs") or [{"extra_args": m["extra_args"], "out": m["out"]}]
        names = [n for n in z.namelist() if n != "colab_manifest.json"]
        for n in names:  # yalnızca bölümün audio/... klasörlerine yazılır
            p = PurePosixPath(n)
            if ".." in p.parts or not any(n.startswith(j["out"] + "/") for j in jobs):
                sys.exit(f"beklenmeyen yol: {n}")
        for j in jobs:
            if (ROOT / j["out"] / "report.json").exists() and not args.force and "--run" not in j["extra_args"]:
                sys.exit(f"{j['out']} zaten var (Mac'te üretilmiş ses üzerine yazılır); bilerek yapıyorsan --force")
        for n in names:
            z.extract(n, ROOT)
    print(f"[unpack] {len(names)} dosya → {[j['out'] for j in jobs]}")
    for j in jobs:   # Whisper kapısı sırayla (Mac'te tek ağır iş)
        ex = j["extra_args"]
        run = ["--run", ex[ex.index("--run") + 1]] if "--run" in ex else []
        if "--voice" in ex:   # ses kimliği o işin kendi profiline göre ölçülür (yoksa senaryonun anlatıcısına göre ölçer)
            run += ["--voice", ex[ex.index("--voice") + 1]]
        if not (ROOT / j["out"] / "report.json").exists():
            print(f"[warn] {j['out']}: report.json yok (iş düşmüş olabilir)"); continue
        subprocess.run([str(PY), "-W", "ignore", str(ROOT / "voice" / "synth.py"), str(ROOT / m["script"]), "--gate-only", *run],
                       check=True)


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("pack")
    p.add_argument("episode", help="EP004 ya da klasör adının başı")
    p.add_argument("--lang", default="en")
    p.add_argument("extra", nargs=argparse.REMAINDER, help="-- sonrası Colab'da synth.py'ye geçer (ör. --takes 3)")
    u = sub.add_parser("unpack")
    u.add_argument("zip")
    u.add_argument("--force", action="store_true")
    args = ap.parse_args()
    if args.cmd == "pack":
        args.extra = [a for a in args.extra if a != "--"]
        pack(args)
    else:
        unpack(args)


if __name__ == "__main__":
    main()
