#!/usr/bin/env python3
"""Stüdyonun Python ortamlarını her işletim sisteminde aynı yolla kurar (uv ile; uv yoksa python -m venv + pip).

Kullanım (proje kökünden):
  <sistem-python> "$PLUGIN/scripts/make_venv.py" voice/.venv-chatterbox core-light   # ya da: core | mlx | matte | manim | sam2
  <sistem-python> "$PLUGIN/scripts/make_venv.py" voice/.venv-chatterbox --shim-only  # yalnızca Windows yönlendiricisini yaz

Windows: venv yürütücüsü `Scripts/python.exe`'dir; stüdyonun bütün komutları ise `<venv>/bin/python` yolunu kullanır. Bu betik
Windows'ta `<venv>/bin/python` adında bir yönlendirici yazar (Git Bash betiği: UTF-8 modunu açar, Scripts/python.exe'yi çalıştırır;
Claude Code Windows'ta komutları Git Bash'te çalıştırır). Ayrıca `<venv>/bin/python.cmd` (cmd/PowerShell için) yazılır.
macOS/Linux'ta yönlendirici gerekmez. Yalnızca standart kütüphane.
"""
import shutil
import subprocess
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):  # Windows konsolu (cp1252) Türkçe çıktıda hata vermesin
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

PLUGIN = Path(__file__).resolve().parent.parent
REQ = PLUGIN / "scripts" / "requirements"
IS_WIN = sys.platform == "win32"


def py_in(venv: Path) -> Path:
    return venv / ("Scripts/python.exe" if IS_WIN else "bin/python")


def write_shims(venv: Path):
    if not IS_WIN:
        return
    b = venv / "bin"
    b.mkdir(exist_ok=True)
    sh = b / "python"
    sh.write_text('#!/usr/bin/env bash\n# content-studio: Windows yönlendiricisi (make_venv.py yazdı)\nexport PYTHONUTF8=1\n'
                  'exec "$(dirname "$0")/../Scripts/python.exe" "$@"\n', encoding="utf-8", newline="\n")
    (b / "python.cmd").write_text('@echo off\r\nset PYTHONUTF8=1\r\n"%~dp0..\\Scripts\\python.exe" %*\r\n', encoding="utf-8", newline="")
    print(f"[shim] {sh} → Scripts/python.exe (UTF-8)")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        sys.exit(__doc__)
    venv = Path(args[0]).resolve()
    if "--shim-only" in sys.argv:
        write_shims(venv)
        return
    req = REQ / f"{args[1] if len(args) > 1 else 'core-light'}.txt"
    if not req.exists():
        sys.exit(f"gereksinim dosyası yok: {req.name} (mevcut: {', '.join(p.stem for p in REQ.glob('*.txt'))})")
    uv = shutil.which("uv")
    if uv:
        if not py_in(venv).exists():
            subprocess.run([uv, "venv", "--python", "3.11", str(venv)], check=True)
        subprocess.run([uv, "pip", "install", "--python", str(py_in(venv)), "-r", str(req)], check=True)
    else:
        if not py_in(venv).exists():
            subprocess.run([sys.executable, "-m", "venv", str(venv)], check=True)
        subprocess.run([str(py_in(venv)), "-m", "pip", "install", "-r", str(req)], check=True)
    write_shims(venv)
    print(f"[ok] {venv} ← {req.name}")


if __name__ == "__main__":
    main()
