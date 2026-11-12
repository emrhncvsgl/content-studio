"""İzleme turu notları (cinecode context-protocol'den, 2026-11-09): kullanıcının notları kelimesi kelimesine kalıcı dosyaya, sahneye bölünmüş.

Neden: EP009'da 10 tur not sohbette kaldı; sıkıştırmada kayboluyor, "neyi değiştirmedik" bilinmiyor. Her tur bir dosya:
  <bölüm>/notes/round-N.md  =  ham not (kelimesi kelimesine) · sahne tablosu (zaman → sahne, not, durum) · KEPT listesi (dokunulmayacaklar).
Durum: CHANGED (bu turda düzeltildi) · NEW (yeni eklendi) · KEPT (kullanıcı beğendi, kilitli: sonraki turlarda değişmez) · OPEN (bekliyor).

Kullanım:
  voice/.venv-chatterbox/bin/python tools/notes.py where EP009 7:59 9:34          # zaman → sahne (+ sahne içi saniye, metin başı)
  voice/.venv-chatterbox/bin/python tools/notes.py new EP009 --video render/EP009-v10.mp4 --text "7:59 Otis s'si ... | 9:34 hızlı geçiş"
      → notes/round-N.md (N otomatik); "|" ile ayrılmış her not, içindeki m:ss zamanıyla sahneye bağlanır
  voice/.venv-chatterbox/bin/python tools/notes.py set EP009 3 s48 CHANGED "kart sesleri tek iniş sesine indi"
  voice/.venv-chatterbox/bin/python tools/notes.py kept EP009                       # tüm turlarda KEPT işaretli sahneler (dokunma listesi)
"""
import argparse
import json
import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TS = re.compile(r"\b(\d{1,2}):(\d{2})(?:\s*-\s*(\d{1,2}):(\d{2}))?")


def episode(ep: str) -> Path:
    return next((ROOT / "content" / "episodes").glob(f"{ep}*"))


def scene_at(tl: dict, sec: float):
    fps = tl.get("fps", 30)
    for sc in tl["scenes"]:
        a, b = sc["startFrame"] / fps, (sc["startFrame"] + sc["durationFrames"]) / fps
        if a <= sec < b:
            return sc, sec - a
    return tl["scenes"][-1], 0.0


def text_of(sc: dict, lang: str) -> str:
    ws = sc.get("words", {}).get(lang, [])
    return " ".join(w["text"] for w in ws)[:70]


def fmt(sec: float) -> str:
    return f"{int(sec // 60)}:{int(sec % 60):02d}"


def cmd_where(a):
    ep = episode(a.episode)
    tl = json.loads((ep / "timeline.json").read_text())
    lang = tl["captions"]["lang"]
    for t in a.times:
        m, s = t.split(":")
        sc, off = scene_at(tl, int(m) * 60 + int(s))
        print(f"{t}  →  {sc['id']} (+{off:.1f} sn, {sc.get('style')})  {text_of(sc, lang)!r}")


def rounds(ep: Path):
    return sorted((ep / "notes").glob("round-*.md"), key=lambda p: int(p.stem.split("-")[1]))


def cmd_new(a):
    ep = episode(a.episode)
    tl = json.loads((ep / "timeline.json").read_text())
    lang = tl["captions"]["lang"]
    (ep / "notes").mkdir(exist_ok=True)
    n = len(rounds(ep)) + 1
    rows = []
    for note in [x.strip() for x in a.text.split("|") if x.strip()]:
        m = TS.search(note)
        if m:
            sc, off = scene_at(tl, int(m.group(1)) * 60 + int(m.group(2)))
            ids = [sc["id"]]
            if m.group(3):   # aralık: bitişteki sahneye kadar hepsi
                end, _ = scene_at(tl, int(m.group(3)) * 60 + int(m.group(4)))
                order = [s["id"] for s in tl["scenes"]]
                ids = order[order.index(sc["id"]):order.index(end["id"]) + 1]
            rows.append((m.group(0), ", ".join(ids), note))
        else:
            rows.append(("—", "genel", note))
    out = ep / "notes" / f"round-{n}.md"
    lines = [f"# {a.episode} · tur {n} · {date.today().isoformat()}", "",
             f"Video: `{a.video or '?'}`", "", "## Ham not (kelimesi kelimesine)", "", "> " + a.text.replace("\n", "\n> "), "",
             "## Sahne tablosu", "", "| zaman | sahne | not | durum | ne yapıldı |", "|---|---|---|---|---|"]
    lines += [f"| {t} | {ids} | {note.replace('|', '/')} | OPEN | |" for t, ids, note in rows]
    kept = cmd_kept(a, quiet=True)
    lines += ["", "## Dokunulmayacaklar (önceki turlarda KEPT)", "", ", ".join(kept) if kept else "(yok)", ""]
    out.write_text("\n".join(lines))
    print(f"[notes] {out.relative_to(ROOT)} · {len(rows)} not")
    for t, ids, note in rows:
        print(f"  {t:>11}  {ids:<12} {note[:80]}")


def cmd_set(a):
    ep = episode(a.episode)
    p = ep / "notes" / f"round-{a.round}.md"
    txt = p.read_text().split("\n")
    hit = False
    for k, ln in enumerate(txt):
        cells = ln.split("|")
        if len(cells) > 5 and a.scene in [c.strip() for c in cells[2].split(",")]:
            cells[4], cells[5] = f" {a.status} ", f" {a.what} "
            txt[k] = "|".join(cells); hit = True
    if not hit:   # tabloda yoksa (ör. kullanıcı bir sahneyi beğendi dedi) yeni satır
        i = max(k for k, ln in enumerate(txt) if ln.startswith("|")) + 1
        txt.insert(i, f"| — | {a.scene} | | {a.status} | {a.what} |")
    p.write_text("\n".join(txt))
    print(f"[notes] tur {a.round} {a.scene} → {a.status}")


def cmd_kept(a, quiet=False):
    ep = episode(a.episode)
    kept = []
    for p in rounds(ep):
        for ln in p.read_text().split("\n"):
            cells = [c.strip() for c in ln.split("|")]
            if len(cells) > 5 and cells[4] == "KEPT":
                kept += [s.strip() for s in cells[2].split(",") if s.strip() not in kept]
    if not quiet:
        print("KEPT (dokunma):", ", ".join(kept) if kept else "(yok)")
    return kept


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    w = sub.add_parser("where"); w.add_argument("episode"); w.add_argument("times", nargs="+")
    n = sub.add_parser("new"); n.add_argument("episode"); n.add_argument("--text", required=True); n.add_argument("--video")
    s = sub.add_parser("set"); s.add_argument("episode"); s.add_argument("round", type=int); s.add_argument("scene")
    s.add_argument("status", choices=["CHANGED", "NEW", "KEPT", "OPEN"]); s.add_argument("what", nargs="?", default="")
    k = sub.add_parser("kept"); k.add_argument("episode")
    a = ap.parse_args()
    {"where": cmd_where, "new": cmd_new, "set": cmd_set, "kept": cmd_kept}[a.cmd](a)


if __name__ == "__main__":
    sys.exit(main())
