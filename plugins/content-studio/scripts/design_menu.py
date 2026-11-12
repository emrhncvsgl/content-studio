#!/usr/bin/env python3
"""Tasarım dili menüsü: kanalın görsel/işitsel kimliği seçilirken sunulacak seçenekleri tek, kısa listede toplar.

Kullanım (proje kökünden; düz python3, yalnızca standart kütüphane + varsa PyYAML):
  python3 .studio/plugin/scripts/design_menu.py                 # tüm bölümler (özet)
  python3 .studio/plugin/scripts/design_menu.py looks camera    # yalnızca bu bölümler
  python3 .studio/plugin/scripts/design_menu.py --json          # makine okunur
  python3 .studio/plugin/scripts/design_menu.py looks --q "charity hope hands craft" --pick 4
        # kanalın/fikrin kelimeleriyle ara (cinecode yöntemi); --pick N: birbirinden farklı (aile/malzeme) N aday, en az biri hazır
        # İngilizce kelimeler daha iyi eşleşir (tarifler İngilizce); "vox gibi", "ghibli" gibi adlar aliases.json'la eşlenir
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
                        "built": bool(s.get("implemented")), "what": s.get("does", ""), "use": s.get("use_when", ""),
                        "kind": s.get("kind"), "guide": s.get("guide")})
    else:  # PyYAML yok (düz python3): kayıtları satır bloklarından oku
        txt = (ENGINE / "catalog" / "styles.yaml").read_text()
        heads = list(re.finditer(r"^  ([a-z0-9-]+):\s+\{ name:", txt, re.M))
        for i, m in enumerate(heads):
            block = txt[m.start(): heads[i + 1].start() if i + 1 < len(heads) else len(txt)]
            g = lambda k: (re.search(k + r':\s*"([^"]*)"', block) or re.search(k + r":\s*([^,}\n]+)", block))  # noqa: E731
            tr = re.search(r'tr:\s*"?([^",}]+)', block)
            out.append({"id": m.group(1), "name": tr.group(1).strip() if tr else m.group(1), "src": "studio",
                        "built": bool(re.search(r"implemented:\s*true", block)),
                        "what": g("does").group(1).strip() if g("does") else "", "use": g("use_when").group(1).strip() if g("use_when") else "",
                        "kind": g("kind").group(1).strip() if g("kind") else None})
    have = {o["id"] for o in out}
    for f in sorted(LEMO.glob("*/style.json")):
        j = json.loads(f.read_text())
        out.append({"id": f"lemo:{j['slug']}", "name": j.get("en"), "src": "lemo", "built": False,
                    "what": j.get("line", ""), "use": ", ".join(j.get("uses", [])), "category": j.get("category_en"),
                    "recipe": f".studio/plugin/library/lemo/styles/{j['slug']}/STYLE.md",
                    "also_in_studio": j["slug"] in have})
    idx = CINE / "styles" / "index.json"
    if idx.exists():
        cin = json.loads(idx.read_text()).get("styles", [])
        extra = {c["id"]: c for c in cin}
        for o in out:                              # Lemo kayıtlarını cinecode'un özetiyle zenginleştir (arama için)
            c = extra.get(o["id"].removeprefix("lemo:"))
            if o["src"] == "lemo" and c:
                o["essence"] = c.get("essence", "")
                o["family"] = c.get("base")
        for c in cin:
            if c.get("source") == "cinecode":
                out.append({"id": f"cinecode:{c['id']}", "name": c.get("name") or c["id"], "src": "cinecode", "built": False,
                            "what": (c.get("essence") or "")[:160], "essence": c.get("essence", ""), "family": c.get("base"),
                            "category": c.get("category"), "recipe": f".studio/plugin/library/cinecode/styles/{c['id']}.md"})
    return out


def group_of(o: dict) -> str:
    """Çeşitlilik için grup: Lemo/cinecode kategorisi (malzeme/aile), bizim stiller için tür."""
    return o.get("category") or f"studio:{o.get('kind', o['id'])}"


def search(items: list[dict], q: str) -> list[dict]:
    """Basit kelime eşleştirme + cinecode takma adları (ör. 'vox', 'ghibli')."""
    words = [w for w in re.findall(r"[a-z0-9çğıöşü-]+", q.lower()) if len(w) > 2]
    alias_hits = {}
    al = CINE / "styles" / "aliases.json"
    if al.exists():
        for a in json.loads(al.read_text()).get("aliases", []):
            if any(n in q.lower() for n in a.get("names", [])):
                for rank, sid in enumerate(a.get("styles", [])):
                    alias_hits[sid] = max(alias_hits.get(sid, 0), 6 - rank)
    built_ids = {o["id"] for o in items if o["src"] == "studio" and o.get("built")}
    scored = []
    for o in items:
        if o["src"] != "studio" and o["id"].split(":")[-1] in built_ids:
            continue                              # aynı stil bizde hazır: tarif yerine hazır olanı öner
        if o["src"] == "studio" and not o.get("built"):
            continue                              # tarifi olmayan katalog fikri: Lemo/cinecode karşılığı zaten listede
        hay = " ".join(str(o.get(k, "")) for k in ("id", "name", "what", "use", "category", "essence", "family")).lower()
        sc = sum(hay.count(w) for w in words) + alias_hits.get(o["id"].split(":")[-1], 0)
        if sc:
            scored.append({**o, "score": sc})
    return sorted(scored, key=lambda o: -o["score"])


def pick_diverse(ranked: list[dict], n: int, all_items: list[dict]) -> list[dict]:
    """En yüksek puandan başlayarak her gruptan en fazla bir aday; en az bir hazır (built) aday garanti."""
    out, seen = [], set()
    for o in ranked:
        g = group_of(o)
        if g in seen:
            continue
        out.append(o); seen.add(g)
        if len(out) == n:
            break
    if not any(o.get("built") for o in out):
        # eşleşen hazır stil yoksa genel amaçlı hazır stillerden biri (konuya özel olanlar değil: manim, object3d…)
        general = ["ken-burns-photo", "vox-explainer", "archival-film", "kinetic-type"]
        built = [o for o in ranked if o.get("built")] or \
            sorted([o for o in all_items if o.get("built") and o["id"] in general], key=lambda o: general.index(o["id"]))
        if built:
            out = out[: max(0, n - 1)] + [built[0]]
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


def opt(name: str):
    if name in sys.argv:
        i = sys.argv.index(name)
        return sys.argv[i + 1] if i + 1 < len(sys.argv) else None
    return None


def main():
    q, pick = opt("--q"), opt("--pick")
    skip = {q, pick}
    want = [a for a in sys.argv[1:] if not a.startswith("--") and a not in skip] or list(SECTIONS)
    data = {k: SECTIONS[k]() for k in want if k in SECTIONS}
    if q and "looks" in data:
        ranked = search(data["looks"], q)
        data["looks"] = pick_diverse(ranked, int(pick), data["looks"]) if pick else ranked[:25]
    if "--json" in sys.argv:
        print(json.dumps(data, ensure_ascii=False, indent=1))
        return
    for k, items in data.items():
        print(f"\n## {k} ({len(items)})")
        for it in items:
            flag = "✓" if it.get("built") else ("·" if it.get("built") is False else " ")
            what = (it.get("what") or it.get("feel") or "")[:90]
            extra = f" [{it['display']} + {it['text']}]" if "display" in it else ""
            grp = f" [{group_of(it)}]" if k == "looks" and (q or pick) else ""
            print(f" {flag} {it['id']}{(' — ' + it['name']) if it.get('name') and it['name'] != it['id'] else ''}{extra}{grp}"
                  f"{(': ' + what) if what else ''}")


if __name__ == "__main__":
    main()
