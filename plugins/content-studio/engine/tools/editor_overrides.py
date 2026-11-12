"""Stüdyo editöründe yapılan ayarları timeline.json'a uygular (docs/editor/DESIGN.md §4).

Bölüm klasöründe `editor.overrides.json`:
  {"version": 1, "edits": {"s02": {"props.compProps.orbit": 14, "transitionOpts.post": 1200, "words.en.3.text": "1849,"},
                           "_": {"sfx.4.gainDb": -30, "music.gainDb": -14}}}
Anahtar sahne kimliği (ya da "_" = timeline'ın kendisi); yol noktalı, sayısal parça dizi indeksi. Değer null → o anahtarı sil.
build_timeline.py yazmadan hemen önce `apply()`'ı çağırır, böylece yeniden kurulumda editör ayarları kaybolmaz. post_timeline gibi sonradan
timeline'ı değiştiren bölüm betiklerinden SONRA bir kez daha çalıştırılmalı (ör. müzik kazancını ezer):
  voice/.venv-chatterbox/bin/python tools/editor_overrides.py <EP>        # uygula ve yaz
  voice/.venv-chatterbox/bin/python tools/editor_overrides.py <EP> --check  # yalnız uygulanamayan yolları raporla
"""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FILE = "editor.overrides.json"


def _set(obj, path, value):
    parts = path.split(".")
    for i, p in enumerate(parts[:-1]):
        nxt = parts[i + 1]
        if isinstance(obj, list):
            obj = obj[int(p)]
        else:
            if p not in obj or obj[p] is None:
                obj[p] = [] if nxt.isdigit() else {}
            obj = obj[p]
    last = parts[-1]
    if isinstance(obj, list):
        obj[int(last)] = value
    elif value is None:
        obj.pop(last, None)
    else:
        obj[last] = value


def load(ep_dir: Path) -> dict:
    p = Path(ep_dir) / FILE
    return json.loads(p.read_text()) if p.exists() else {"version": 1, "edits": {}}


def apply(ep_dir: Path, timeline: dict) -> list[str]:
    """Ayarları yerinde uygular; uygulanamayan (sahne yok, indeks dışı) yolları döndürür."""
    bad = []
    by_id = {s["id"]: s for s in timeline.get("scenes", [])}
    for key, edits in load(ep_dir).get("edits", {}).items():
        target = timeline if key == "_" else by_id.get(key)
        if target is None:
            bad += [f"{key}.{p}" for p in edits]; continue
        for path, value in edits.items():
            try:
                _set(target, path, value)
            except (IndexError, KeyError, ValueError, TypeError):
                bad.append(f"{key}.{path}")
    return bad


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("episode")
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args()
    ep = next((ROOT / "content" / "episodes").glob(f"{a.episode}*"))
    tl_path = ep / "timeline.json"
    tl = json.loads(tl_path.read_text())
    bad = apply(ep, tl)
    n = sum(len(v) for v in load(ep).get("edits", {}).values())
    for b in bad:
        print(f"[uyarı] uygulanamadı: {b}", file=sys.stderr)
    if not a.check:
        tl_path.write_text(json.dumps(tl, ensure_ascii=False, indent=2))
    print(f"[editor] {ep.name}: {n} ayar, {len(bad)} uygulanamadı{' (yazılmadı)' if a.check else ''}")


if __name__ == "__main__":
    main()
