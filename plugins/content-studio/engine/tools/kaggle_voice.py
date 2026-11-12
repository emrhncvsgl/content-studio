"""Bölüm sesini Kaggle'da (ücretsiz T4 GPU) tarayıcısız üret: pack → push → bekle → indir → unpack (voice/kaggle/README.md).

Kullanım:
  voice/.venv-chatterbox/bin/python tools/kaggle_voice.py run EP005 [--lang en] [--force] [-- --takes 3]
  voice/.venv-chatterbox/bin/python tools/kaggle_voice.py status | fetch EP005   (yarıda kalan bir koşuyu izle / indir)

Paket (colab_voice.py pack ile aynı zip) base64 olarak çekirdek betiğinin içine gömülür; veri seti gerekmez.
Kaggle tarafı: voice/kaggle/kernel.py. Mac tarafı yalnızca Whisper kapısı (unpack). Tek sahne düzeltmeleri Mac'te (--only sNN).
"""
import argparse
import base64
import json
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import colab_voice  # noqa: E402  (pack/unpack aynı)

ROOT = Path(__file__).parent.parent
KERNEL_SRC = ROOT / "voice" / "kaggle" / "kernel.py"
SLUG = "cs-voice"
KAGGLE = shutil.which("kaggle") or str(Path.home() / ".local" / "bin" / "kaggle")


def kaggle(*a, capture=True) -> str:
    r = subprocess.run([KAGGLE, *a], capture_output=capture, text=True)
    if r.returncode != 0:
        sys.exit(f"kaggle {' '.join(a)} başarısız:\n{(r.stdout or '') + (r.stderr or '')}")
    return r.stdout or ""


def username() -> str:
    m = re.search(r"username:\s*(\S+)", kaggle("config", "view"))
    if not m or m.group(1) == "None":
        sys.exit("Kaggle kullanıcı adı yok: ~/.kaggle/kaggle.json (ya da KAGGLE_USERNAME) gerekli, voice/kaggle/README.md")
    return m.group(1)


def work_dir(ep: Path) -> Path:
    d = ep / "audio" / "_kaggle" / (SLUG if SLUG != "cs-voice" else "")   # --slug: aynı anda ikinci koşu kendi klasöründe
    d.mkdir(parents=True, exist_ok=True)
    return d


def push(args, ep: Path) -> str:
    colab_voice.pack(args)
    bundle = ep / "audio" / "_colab" / f"bundle.{args.lang}.zip"
    kid = f"{username()}/{SLUG}"
    kdir = work_dir(ep) / "kernel"
    shutil.rmtree(kdir, ignore_errors=True)
    kdir.mkdir()
    code = KERNEL_SRC.read_text().replace("__BUNDLE_B64__", base64.b64encode(bundle.read_bytes()).decode())
    (kdir / "kernel.py").write_text(code)
    (kdir / "kernel-metadata.json").write_text(json.dumps({
        "id": kid, "title": SLUG, "code_file": "kernel.py", "language": "python", "kernel_type": "script",
        "is_private": True, "enable_gpu": True, "enable_internet": True,
        "dataset_sources": [], "competition_sources": [], "kernel_sources": []}, indent=2))
    print(kaggle("kernels", "push", "-p", str(kdir), "--accelerator", "NvidiaTeslaT4", "-t", "3600").strip())
    return kid


def wait(kid: str) -> str:
    t0 = time.time()
    while True:
        out = kaggle("kernels", "status", kid).strip()
        state = out.rsplit("status", 1)[-1].strip(' "').lower()
        print(f"[kaggle] {time.time() - t0:5.0f}s {state}", flush=True)
        if any(s in state for s in ("complete", "error", "cancel")):
            return state
        time.sleep(30)


def fetch(args, ep: Path, kid: str) -> None:
    odir = work_dir(ep) / "output"
    shutil.rmtree(odir, ignore_errors=True)
    kaggle("kernels", "output", kid, "-p", str(odir), "-o", "-q")
    zips = sorted(odir.glob("voice_*.zip"))
    if not zips:
        log = next(odir.glob("*.log"), None)
        sys.exit(f"çıktıda voice_*.zip yok; günlük: {log.relative_to(ROOT) if log else '(yok)'}")
    args.zip = str(zips[0])
    colab_voice.unpack(args)


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run")
    r.add_argument("episode")
    r.add_argument("--lang", default="en")
    r.add_argument("--force", action="store_true", help="var olan audio/<dil> üzerine yaz (unpack)")
    r.add_argument("--slug", default="cs-voice", help="Kaggle çekirdek adı (aynı anda iki koşu için farklı ad)")
    r.add_argument("--job", action="append", default=[], help='paralel iş (T4 × 2): synth.py argümanları tek dizgide, --run zorunlu; '
                   'ör. run --job "--voice tok_anlatici_ref --run a" --job "--voice tok_anlatici_ref_emo --run b" <bölüm> (seçenekler bölüm adından ÖNCE)')
    r.add_argument("extra", nargs=argparse.REMAINDER, help="-- sonrası Kaggle'da synth.py'ye geçer")
    st = sub.add_parser("status")
    st.add_argument("--slug", default="cs-voice")
    f = sub.add_parser("fetch")
    f.add_argument("episode")
    f.add_argument("--force", action="store_true")
    f.add_argument("--slug", default="cs-voice", help="run'da verilen çekirdek adı (bağlantı kopunca sonucu almak için)")
    args = ap.parse_args()

    global SLUG
    SLUG = getattr(args, "slug", SLUG)
    if args.cmd == "status":
        print(kaggle("kernels", "status", f"{username()}/{SLUG}").strip())
        return
    ep = colab_voice.episode_dir(args.episode)
    kid = f"{username()}/{SLUG}"
    if args.cmd == "run":
        args.extra = [a for a in args.extra if a != "--"]
        if "--job" in args.extra or "--slug" in args.extra or "--force" in args.extra:
            # argparse REMAINDER: bölüm adından sonraki her şey Kaggle'daki synth.py'ye gider (IYH001'de 11 dk boşa koştu, 2026-11-09)
            sys.exit("--job/--slug/--force bölüm adından ÖNCE yazılmalı: kaggle_voice.py run --job \"...\" --job \"...\" <bölüm>")
        args.jobs = [j.split() for j in args.job]
        if any("--run" not in j for j in args.jobs):
            sys.exit("--job içinde --run zorunlu (her iş kendi _trials klasörüne)")
        push(args, ep)
        state = wait(kid)
        if "complete" not in state:
            fetch_log = work_dir(ep) / "output"
            kaggle("kernels", "output", kid, "-p", str(fetch_log), "-o", "-q")
            sys.exit(f"Kaggle koşusu bitmedi ({state}); günlük: {fetch_log.relative_to(ROOT)}")
    fetch(args, ep, kid)


if __name__ == "__main__":
    main()
