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
import subprocess
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):  # Windows konsolu (cp1252) Türkçe çıktıda hata vermesin
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

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
    manifest = json.loads(mf_path.read_text(encoding="utf-8")) if mf_path.exists() else {}
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
    tpl = {"CLAUDE.md": "CLAUDE.md", "gitignore": ".gitignore", "gitattributes": ".gitattributes",
           "channel.yaml": "channel.yaml.example"}
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
            fm.write_text("[]\n", encoding="utf-8")
        ideas = target / "content" / "ideas.yaml"
        if not ideas.exists():
            ideas.write_text("# Konu fikir havuzu (/shorts konu keşfi yazar): {id, title, status, why, source_id, hook, sources, date}\n[]\n", encoding="utf-8")
        dec = target / "docs" / "DECISIONS.md"
        if not dec.exists():
            dec.parent.mkdir(parents=True, exist_ok=True)
            dec.write_text("# Kararlar ve test sonuçları (en yenisi üstte)\n\n", encoding="utf-8")
        # .studio/plugin → plugin kökü (skill'ler alt dosyalarını ve library/'yi bu yoldan okur)
        link = target / ".studio" / "plugin"
        link.parent.mkdir(parents=True, exist_ok=True)
        # Eski bağı kaldır. DİKKAT: bağın hedefi plugin'in kendisidir; rmtree asla bir bağın içine girmemeli.
        if link.is_symlink():
            link.unlink()
        elif hasattr(os.path, "isjunction") and os.path.isjunction(link):
            os.rmdir(link)                         # junction: yalnızca bağ kalkar, hedef durur
        elif link.exists():
            try:
                os.rmdir(link)                     # Python 3.11'de junction boş dizin gibi kalkar (hedef silinmez)
            except OSError:
                shutil.rmtree(link)                # gerçek kopya (son çare yolundan kalmış)
        try:
            link.symlink_to(PLUGIN, target_is_directory=True)
        except OSError:
            # Windows: sembolik bağ için Geliştirici Modu ya da yönetici gerekir. Dizin bağlantısı (junction) izinsiz çalışır.
            r = subprocess.run(["cmd", "/c", "mklink", "/J", str(link), str(PLUGIN)], capture_output=True) \
                if sys.platform == "win32" else None
            if not r or r.returncode != 0:      # son çare: kopya (--update her seferinde yeniler)
                shutil.copytree(PLUGIN, link, ignore=shutil.ignore_patterns("engine"))
        (target / ".studio" / "plugin-version").write_text(
            json.loads((PLUGIN / ".claude-plugin" / "plugin.json").read_text(encoding="utf-8"))["version"] + "\n")
        mf_path.write_text(json.dumps(new_manifest, indent=1, sort_keys=True), encoding="utf-8")

    tag = "(deneme, hiçbir şey yazılmadı) " if dry else ""
    print(f"{tag}Hedef: {target}")
    print(f"  yeni: {len(created)} · güncellenen: {len(updated)} · korunan (kullanıcının): {len(kept)} · çakışma: {len(conflicts)}")
    for c in conflicts:
        print(f"  ÇAKIŞMA: {c} elle değiştirilmiş → yeni sürüm {c}.yeni (birleştir, sonra .yeni'yi sil)")
    if not update:
        print("Sonraki adım: /content-studio:studio-setup ortamı kurmaya devam eder (venv, npm, Whisper modeli).")


if __name__ == "__main__":
    main()
