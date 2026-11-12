#!/usr/bin/env python3
"""Stüdyo motorunu (tools/, voice/, studio/, catalog/, docs/styles) plugin'den proje klasörüne kopyalar.

Kullanım:
  python3 install_engine.py [hedef_klasör] [--update] [--dry-run]

- İlk kurulum: motoru kopyalar, `content/` iskeletini, şablonlardan `CLAUDE.md`, `.gitignore`, `.claude/settings.json`,
  `.claude/launch.json` dosyalarını (yoksa) yazar ve `.studio/plugin` → plugin kökü bağlantısını kurar.
- --update: plugin güncellenince motoru yeniler. Kullanıcının elle değiştirdiği motor dosyaları EZİLMEZ: yeni sürüm
  `<dosya>.yeni` olarak yanına yazılır ve listelenir (birleştirme ajanla yapılır). Bağlantı yeni plugin sürümüne çevrilir.
- Kanala ait dosyalar (channel.yaml, channels/, content/, voice/profiles/ altında kullanıcının eklediği profiller,
  catalog/pronunciation.*.yaml) hiçbir zaman ezilmez.
Kayıt: `.studio/engine-manifest.json` (dosya → kopyalandığı andaki sha256). Yalnızca standart kütüphane.
"""
import hashlib
import json
import os
import shutil
import sys
from pathlib import Path

PLUGIN = Path(__file__).resolve().parent.parent
ENGINE = PLUGIN / "engine"
TEMPLATES = PLUGIN / "templates"
SKIP_DIRS = {"node_modules", "__pycache__", "out", "dist", ".remotion"}
# Bir kez yazılır, sonra kullanıcınındır (güncellemede dokunulmaz).
USER_OWNED_PREFIXES = ("catalog/pronunciation.", "voice/profiles/", "voice/refs/", ".claude/settings.json")
CONTENT_DIRS = ["episodes", "channels", "brand", "fonts", "sfx", "music", "textures", "assets", "sources", "_refs"]


def sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def engine_files():
    for root, dirs, files in os.walk(ENGINE):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for f in files:
            if f == ".DS_Store":
                continue
            src = Path(root) / f
            yield src, src.relative_to(ENGINE).as_posix()


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    update = "--update" in sys.argv
    dry = "--dry-run" in sys.argv
    target = Path(args[0] if args else ".").resolve()
    target.mkdir(parents=True, exist_ok=True)
    mf_path = target / ".studio" / "engine-manifest.json"
    manifest = json.loads(mf_path.read_text()) if mf_path.exists() else {}
    if manifest and not update:
        sys.exit(f"Bu klasörde motor zaten kurulu ({mf_path}). Yenilemek için --update.")

    created, updated, kept, conflicts = [], [], [], []
    new_manifest = {}
    for src, rel in engine_files():
        dst = target / rel
        h_new = sha(src)
        user_owned = rel.startswith(USER_OWNED_PREFIXES)
        if not dst.exists():
            created.append(rel)
            if not dry:
                dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src, dst)
            new_manifest[rel] = h_new
            continue
        h_dst = sha(dst)
        if h_dst == h_new:
            new_manifest[rel] = h_new
            continue
        if user_owned:
            kept.append(rel)
            new_manifest[rel] = manifest.get(rel, h_dst)
            continue
        if manifest.get(rel) == h_dst:          # kullanıcı değiştirmemiş → güvenle yenile
            updated.append(rel)
            if not dry:
                shutil.copy2(src, dst)
            new_manifest[rel] = h_new
        else:                                   # kullanıcı değiştirmiş (ya da kayıtsız) → ezme, yanına yaz
            conflicts.append(rel)
            if not dry:
                shutil.copy2(src, dst.with_name(dst.name + ".yeni"))
            new_manifest[rel] = manifest.get(rel, h_dst)

    # Şablonlar: yalnızca yoksa
    tpl = {"CLAUDE.md": "CLAUDE.md", "gitignore": ".gitignore", "channel.yaml": "channel.yaml.example"}
    for name, out in tpl.items():
        s, d = TEMPLATES / name, target / out
        if s.exists() and not d.exists():
            created.append(out)
            if not dry:
                shutil.copy2(s, d)

    if not dry:
        for d in CONTENT_DIRS:
            (target / "content" / d).mkdir(parents=True, exist_ok=True)
        fm = target / "content" / "fonts" / "manifest.json"   # studio/src/fonts.ts okur; tools/fetch_fonts.py doldurur
        if not fm.exists():
            fm.write_text("[]\n")
        ideas = target / "content" / "ideas.yaml"
        if not ideas.exists():
            ideas.write_text("# Konu fikir havuzu (/shorts konu keşfi yazar): {id, title, status, why, source_id, hook, sources, date}\n[]\n")
        dec = target / "docs" / "DECISIONS.md"
        if not dec.exists():
            dec.parent.mkdir(parents=True, exist_ok=True)
            dec.write_text("# Kararlar ve test sonuçları (en yenisi üstte)\n\n")
        # .studio/plugin → plugin kökü (skill'ler alt dosyalarını ve library/'yi bu yoldan okur)
        link = target / ".studio" / "plugin"
        link.parent.mkdir(parents=True, exist_ok=True)
        if link.is_symlink() or link.exists():
            if link.is_symlink():
                link.unlink()
            else:
                shutil.rmtree(link)
        try:
            link.symlink_to(PLUGIN, target_is_directory=True)
        except OSError:                          # Windows: sembolik bağ izni yoksa kopya
            shutil.copytree(PLUGIN, link, ignore=shutil.ignore_patterns("engine"))
        (target / ".studio" / "plugin-version").write_text(
            json.loads((PLUGIN / ".claude-plugin" / "plugin.json").read_text())["version"] + "\n")
        mf_path.write_text(json.dumps(new_manifest, indent=1, sort_keys=True))

    tag = "(deneme, hiçbir şey yazılmadı) " if dry else ""
    print(f"{tag}Hedef: {target}")
    print(f"  yeni: {len(created)} · güncellenen: {len(updated)} · korunan (kullanıcının): {len(kept)} · çakışma: {len(conflicts)}")
    for c in conflicts:
        print(f"  ÇAKIŞMA: {c} elle değiştirilmiş → yeni sürüm {c}.yeni (birleştir, sonra .yeni'yi sil)")
    if not update:
        print("Sonraki adım: /content-studio:studio-setup ortamı kurmaya devam eder (venv, npm, Whisper modeli).")


if __name__ == "__main__":
    main()
