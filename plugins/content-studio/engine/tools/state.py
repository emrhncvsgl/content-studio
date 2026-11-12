"""Bölüm durumu (PLAN 9): episodes/<EP>/state.json. Orkestratör her adımda günceller; kesilirse kaldığı yerden devam eder.

Kullanım:
  python tools/state.py show <bölüm_klasörü>
  python tools/state.py set  <bölüm_klasörü> <adım> <pending|running|done|failed|skipped|waiting_approval> [not]
  python tools/state.py next <bölüm_klasörü>      # sıradaki tamamlanmamış adımı yazar
"""
import json
import sys
from datetime import datetime
from pathlib import Path

STEPS = [
    ("brief", "Brief hazır ve doğrulandı"),
    ("script", "Senaryo (ana dil) — script-writer"),
    ("approve_script", "ONAY 1: senaryo"),
    ("localize", "Diğer dil senaryosu — localizer (lang: both)"),
    ("voice", "Ses + kelime zamanları — voice-producer"),
    ("storyboard", "Sahne görselleri + assets.csv — visual-director"),
    ("approve_storyboard", "ONAY 2: storyboard"),
    ("timeline", "timeline.json — visual-director / editor"),
    ("render", "MP4 + dil başına ses — editor"),
    ("qa", "qa_report.md — qa-reviewer"),
    ("approve_final", "ONAY 3: final video"),
    ("package", "Yayın paketi: başlık/açıklama, .srt, kapak notu"),
]
STATUSES = {"pending", "running", "done", "failed", "skipped", "waiting_approval"}


def load(ep: Path) -> dict:
    p = ep / "state.json"
    if p.exists():
        return json.loads(p.read_text())
    return {"episode": ep.name, "steps": {k: {"status": "pending"} for k, _ in STEPS}, "history": []}


def save(ep: Path, st: dict):
    (ep / "state.json").write_text(json.dumps(st, ensure_ascii=False, indent=2))


def show(st):
    icons = {"pending": "·", "running": "▶", "done": "✓", "failed": "✗", "skipped": "–", "waiting_approval": "?"}
    for k, label in STEPS:
        s = st["steps"].get(k, {"status": "pending"})
        note = f"  ({s['note']})" if s.get("note") else ""
        print(f"  {icons[s['status']]} {k:20} {label}{note}")


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    cmd, ep = sys.argv[1], Path(sys.argv[2])
    st = load(ep)
    if cmd == "show":
        show(st)
    elif cmd == "next":
        nxt = next((k for k, _ in STEPS if st["steps"].get(k, {}).get("status") not in {"done", "skipped"}), None)
        print(nxt or "bitti")
    elif cmd == "set":
        step, status = sys.argv[3], sys.argv[4]
        if step not in dict(STEPS) or status not in STATUSES:
            sys.exit(f"adım: {', '.join(dict(STEPS))}\ndurum: {', '.join(sorted(STATUSES))}")
        note = " ".join(sys.argv[5:]) or None
        st["steps"][step] = {"status": status, "at": datetime.now().isoformat(timespec="seconds"), **({"note": note} if note else {})}
        st["history"].append({"step": step, "status": status, "at": st["steps"][step]["at"], "note": note})
        save(ep, st)
        show(st)
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
