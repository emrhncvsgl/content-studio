#!/usr/bin/env python3
"""Tasarım dili menüsü: kanalın görsel/işitsel kimliği seçilirken sunulacak seçenekleri tek, kısa listede toplar.

Kullanım (proje kökünden; düz python3, yalnızca standart kütüphane + varsa PyYAML):
  python3 .studio/plugin/scripts/design_menu.py                 # tüm bölümler (özet)
  python3 .studio/plugin/scripts/design_menu.py looks camera    # yalnızca bu bölümler
  python3 .studio/plugin/scripts/design_menu.py --json          # makine okunur
Bölümler: looks (görünüş/stil) · families (görünüm aileleri) · camera · focus · transitions · captions · type (font eşleşmeleri) · sound
Her seçenekte `built` = bizde Remotion'da hazır (hemen kullanılır) / `recipe` = tarifi var, ilk kullanımda bileşeni yazılır.
Kaynaklar: catalog/styles.yaml, studio/src/components/Transitions.tsx (bizim), library/lemo (Lemo-Opuscar MIT sürümü),
library/cinecode (references/camera-moves.md, looks.md, type-library.json; MIT).
"""
import json
import re
import sys
from pathlib import Path

PLUGIN = Path(__file__).resolve().parent.parent
PROJECT = Path.cwd()
ENGINE = PROJECT if (PROJECT / "catalog" / "styles.yaml").exists() else PLUGIN / "engine"
LEMO = PLUGIN / "library" / "lemo" / "styles"
CINE = PLUGIN / "library" / "cinecode"


def md_table(path: Path, section: str) -> list[list[str]]:
    """'## section' altındaki ilk tablonun satırları (başlık hariç)."""
    if not path.exists():
        return []
    rows, on, seen = [], False, False
    for line in path.read_text().splitlines():
        if line.startswith("## "):
            if on and seen:
                break
            on = line[3:].strip().lower().startswith(section.lower())
            continue
        if on and line.startswith("|"):
            cells = [c.strip() for c in line.strip("|").split("|")]
            if set("".join(cells)) <= set("-: "):
                continue
            if not seen:
                seen = True          # başlık satırı
                continue
            rows.append(cells)
    return rows


def clean(s: str) -> str:
    return re.sub(r"[*`]", "", s).strip()


def load_yaml(p: Path):
    try:
        import yaml
        return yaml.safe_load(p.read_text())
    except ImportError:
        return None


def looks():
    out = []
    cat = load_yaml(ENGINE / "catalog" / "styles.yaml") if (ENGINE / "catalog" / "styles.yaml").exists() else None
    if cat:
        for sid, s in (cat.get("styles") or {}).items():
            name = s.get("name", {})
            out.append({"id": sid, "name": name.get("tr") if isinstance(name, dict) else name, "src": "studio",
                        "built": bool(s.get("implemented")), "what": s.get("does", ""), "use": s.get("use_when", "")})
    else:  # PyYAML yoksa yalnızca id'ler
        for m in re.finditer(r"^  ([a-z0-9-]+):\s+\{ name:", (ENGINE / "catalog" / "styles.yaml").read_text(), re.M):
            out.append({"id": m.group(1), "src": "studio", "built": None})
    have = {o["id"] for o in out}
    for f in sorted(LEMO.glob("*/style.json")):
        j = json.loads(f.read_text())
        out.append({"id": f"lemo:{j['slug']}", "name": j.get("en"), "src": "lemo", "built": False,
                    "what": j.get("line", ""), "use": ", ".join(j.get("uses", [])), "category": j.get("category_en"),
                    "recipe": f".studio/plugin/library/lemo/styles/{j['slug']}/STYLE.md",
                    "also_in_studio": j["slug"] in have})
    idx = CINE / "styles" / "index.json"
    if idx.exists():
        for s in json.loads(idx.read_text()):
            if isinstance(s, dict) and s.get("source") == "cinecode":
                sid = s.get("id") or s.get("slug")
                out.append({"id": f"cinecode:{sid}", "name": s.get("name") or sid, "src": "cinecode", "built": False,
                            "what": s.get("line") or s.get("summary") or "", "recipe": f".studio/plugin/library/cinecode/styles/{sid}.md"})
    return out


def families():
    return [{"id": clean(r[0]), "name": r[1], "what": r[2], "formats": r[3]} for r in md_table(CINE / "references" / "looks.md", "1.")]


def camera(section="Camera moves"):
    return [{"id": clean(r[0]), "what": r[1], "feel": r[2], "default": r[3]} for r in md_table(CINE / "references" / "camera-moves.md", section)]


def transitions():
    out = [{"id": clean(r[0]), "what": r[1], "feel": r[2], "default": r[3], "src": "cinecode"}
           for r in md_table(CINE / "references" / "camera-moves.md", "Transitions")]
    t = ENGINE / "studio" / "src" / "components" / "Transitions.tsx"
    if t.exists():
        m = re.search(r"ADVANCED = \[([^\]]+)\]", t.read_text())
        if m:
            for k in re.findall(r'"([a-zA-Z]+)"', m.group(1)):
                out.append({"id": k, "src": "studio", "built": True})
    return out


def captions():
    cat = load_yaml(ENGINE / "catalog" / "styles.yaml") or {}
    caps = cat.get("captions") or {k: v for k, v in (cat.get("styles") or {}).items() if k.startswith("cap-")}
    if not caps:
        txt = (ENGINE / "catalog" / "styles.yaml").read_text()
        return [{"id": m.group(1), "name": m.group(2), "what": m.group(3)}
                for m in re.finditer(r"^\s+(cap-[a-z-]+):\s*\{ name: \"([^\"]+)\", does: \"([^\"]+)\"", txt, re.M)]
    return [{"id": k, "name": v.get("name"), "what": v.get("does"), "built": bool(v.get("implemented"))} for k, v in caps.items()]


def type_pairs():
    p = CINE / "references" / "type-library.json"
    if not p.exists():
        return []
    d = json.loads(p.read_text())
    fam = {f["id"]: f["family"] for f in d.get("fonts", [])}
    return [{"id": x["id"], "display": fam.get(x["display"], x["display"]), "text": fam.get(x.get("text"), x.get("text")),
             "looks": x.get("looks", []), "purposes": x.get("purposes", []), "turkish": x.get("turkish")} for x in d.get("pairings", [])]


def sound():
    p = CINE / "references" / "sound.md"
    heads = [l[3:].strip() for l in p.read_text().splitlines() if l.startswith("## ")] if p.exists() else []
    return [{"id": "music_mood", "options": ["sparse piano", "cinematic strings", "ambient bed", "warm acoustic", "pulse/electronic",
                                             "no music (ambience + vocal hum)", "silence-led"]},
            {"id": "sfx_character", "options": ["real foley recordings", "paper/handled objects", "mechanical", "minimal"]},
            {"id": "reference", "sections": heads, "see": ".studio/plugin/skills/sound-design/SKILL.md"}]


SECTIONS = {"looks": looks, "families": families, "camera": camera, "focus": lambda: camera("Focus"),
            "transitions": transitions, "captions": captions, "type": type_pairs, "sound": sound}


def main():
    want = [a for a in sys.argv[1:] if not a.startswith("--")] or list(SECTIONS)
    data = {k: SECTIONS[k]() for k in want if k in SECTIONS}
    if "--json" in sys.argv:
        print(json.dumps(data, ensure_ascii=False, indent=1))
        return
    for k, items in data.items():
        print(f"\n## {k} ({len(items)})")
        for it in items:
            flag = "✓" if it.get("built") else ("·" if it.get("built") is False else " ")
            what = (it.get("what") or it.get("feel") or "")[:90]
            extra = f" [{it['display']} + {it['text']}]" if "display" in it else ""
            print(f" {flag} {it['id']}{(' — ' + it['name']) if it.get('name') and it['name'] != it['id'] else ''}{extra}"
                  f"{(': ' + what) if what else ''}")


if __name__ == "__main__":
    main()
