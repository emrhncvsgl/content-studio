"""Ağaç baskı (woodcut) ve paper-lantern (lantern) sahnelerini kendi süreleriyle render eder (Manim ile aynı yol: ana videoda klip olarak oynar).

timeline.json'da style: woodcut olan her sahne için props.comp kompozisyonunu durationInFrames = sahne süresi ile render eder,
props.video yoluna (content/ köküne göre) yazar. Kompozisyon ek props'u props.compProps'tan alır (kelime zamanları için words da geçer);
props.variant / props.value / props.cue da kompozisyona geçer (EP010: kelime ipuçları).

Kullanım:
  voice/.venv-chatterbox/bin/python tools/woodcut_render.py EP009 [--only s01 s25] [--force]
Ağır iştir (GPU render); başka render/TTS ile aynı anda çalıştırma.
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("episode")
    ap.add_argument("--only", nargs="*")
    ap.add_argument("--force", action="store_true", help="var olan klibi yeniden render et")
    a = ap.parse_args()
    ep = next((ROOT / "content" / "episodes").glob(f"{a.episode}*"))
    tl = json.loads((ep / "timeline.json").read_text())
    lang = tl.get("lang") or next(iter(tl["scenes"][0]["words"]))
    for sc in tl["scenes"]:
        if sc["style"] not in ("woodcut", "lantern", "lantern-text", "object3d", "depth-photo") or (a.only and sc["id"] not in a.only):   # lantern: paper-lantern (2026-11-10), aynı yol
            continue
        p = sc["props"]
        if not p.get("comp") or not p.get("video"):
            print(f"[warn] {sc['id']}: woodcut props.comp/props.video yok (sahne henüz kurulmadı), atlandı"); continue
        out = ROOT / "content" / p["video"]
        if out.exists() and not a.force:
            print(f"[skip] {sc['id']} {out.relative_to(ROOT)} var (--force ile yeniden)"); continue
        out.parent.mkdir(parents=True, exist_ok=True)
        props = {**{k: p[k] for k in ("variant", "value", "cue", "model", "shot", "up") if k in p}, **p.get("compProps", {}), "durationInFrames": sc["durationFrames"], "words": sc.get("cueWords", sc["words"]).get(lang, [])}
        print(f"[render] {sc['id']} {p['comp']} {sc['durationFrames']} kare → {out.relative_to(ROOT)}")
        subprocess.run(["npx", "remotion", "render", "src/index.ts", p["comp"], str(out), f"--props={json.dumps(props)}", "--log=error",
                        "--timeout=120000"],   # Google Fonts indirmesi 30 sn'yi aşabiliyor (EP010, 2026-11-10: s12/s48 zaman aşımı)
                       cwd=ROOT / "studio", check=True)


if __name__ == "__main__":
    main()
