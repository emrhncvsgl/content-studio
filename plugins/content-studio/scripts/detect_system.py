#!/usr/bin/env python3
"""Sistemi algılar ve stüdyo kurulumu için öneri çıkarır (yalnızca okur, hiçbir şey kurmaz).

Kullanım:  python3 detect_system.py [--json]
Çıktı: işletim sistemi, çip, bellek, GPU, boş disk, kurulu araçlar (python3.11, uv, node, ffmpeg, whisper-cli, brew, kaggle…)
ve önerilen kurulum: ses motoru, cihaz, Whisper kurulum yolu, hangi venv'ler mantıklı.
Yalnızca standart kütüphane kullanır; düz `python3` ile çalışır.
"""
import json
import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path


def run(cmd: list[str]) -> str:
    try:
        return subprocess.run(cmd, capture_output=True, text=True, timeout=10).stdout.strip()
    except Exception:
        return ""


def ram_gb() -> float:
    sysname = platform.system()
    if sysname == "Darwin":
        v = run(["sysctl", "-n", "hw.memsize"])
        return round(int(v) / 2**30, 1) if v.isdigit() else 0
    if sysname == "Linux":
        for line in Path("/proc/meminfo").read_text().splitlines():
            if line.startswith("MemTotal"):
                return round(int(line.split()[1]) / 2**20, 1)
    if sysname == "Windows":
        v = run(["powershell", "-NoProfile", "-Command", "(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory"])
        return round(int(v) / 2**30, 1) if v.isdigit() else 0
    return 0


def tool(name: str, ver_args=("--version",)) -> dict:
    p = shutil.which(name)
    if not p:
        return {"found": False}
    out = run([p, *ver_args]).splitlines()
    return {"found": True, "path": p, "version": out[0][:80] if out else ""}


def main():
    sysname = platform.system()            # Darwin | Linux | Windows
    arch = platform.machine()              # arm64 | x86_64 | AMD64
    chip = ""
    if sysname == "Darwin":
        chip = run(["sysctl", "-n", "machdep.cpu.brand_string"])
    elif sysname == "Linux":
        chip = next((l.split(":", 1)[1].strip() for l in Path("/proc/cpuinfo").read_text().splitlines()
                     if l.startswith("model name")), "") if Path("/proc/cpuinfo").exists() else ""
    else:
        chip = platform.processor()
    apple_silicon = sysname == "Darwin" and arch == "arm64"
    nvidia = run(["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader"]) if shutil.which("nvidia-smi") else ""
    disk_free = round(shutil.disk_usage(Path.cwd()).free / 2**30, 1)
    ram = ram_gb()

    py311 = tool("python3.11")
    tools = {
        "python3": {"found": True, "path": sys.executable, "version": platform.python_version()},
        "python3.11": py311,
        "uv": tool("uv"),
        "node": tool("node"),
        "npm": tool("npm"),
        "ffmpeg": tool("ffmpeg", ("-version",)),
        "whisper-cli": tool("whisper-cli", ("--help",)),
        "git": tool("git"),
        "brew": tool("brew"),
        "winget": tool("winget"),
        "kaggle": tool("kaggle"),
    }
    tools["whisper-cli"].pop("version", None)
    kdir = Path.home() / ".kaggle"
    kaggle_key = (kdir / "kaggle.json").exists() or (kdir / "access_token").exists() or bool(
        os.environ.get("KAGGLE_KEY") or os.environ.get("KAGGLE_API_TOKEN"))

    # Öneriler
    rec = {}
    if nvidia:
        rec["tts"] = "local_cuda"
        rec["tts_why"] = f"NVIDIA GPU var ({nvidia}); Chatterbox/VoxCPM2 yerelde CUDA ile hızlı çalışır."
    else:
        rec["tts"] = "kaggle"
        rec["tts_why"] = ("Ücretsiz Kaggle T4 (haftada ~30 saat GPU): Mac'i yormaz, tarayıcısız. Kaggle hesabı + API anahtarı gerekir. "
                          "Alternatif: Gemini TTS (ücretsiz kota, API anahtarı) ya da ElevenLabs (ücretli). "
                          + ("Yerel Chatterbox da olur (CPU, ~1 dk/sahne, tepe ~4 GB)." if ram >= 16 else
                             "Bellek 16 GB altında: yerel TTS önerilmez."))
    rec["device"] = "cuda" if nvidia else "cpu"  # MPS tepe bellek ~19 GB (Chatterbox); CPU daha güvenli
    rec["voice_design"] = ("mlx (Qwen3-TTS VoiceDesign, voice/.venv-mlx)" if apple_silicon and ram >= 16
                           else "Kaggle'da VoxCPM2 tasarım ya da hazır profil (mlx yalnızca Apple Silicon)")
    if sysname == "Darwin":
        rec["install_whisper"] = "brew install whisper-cpp ffmpeg"
        rec["install_node"] = "brew install node (ya da nvm)"
        rec["install_python"] = "uv python install 3.11 (uv: curl -LsSf https://astral.sh/uv/install.sh | sh)"
    elif sysname == "Linux":
        rec["install_whisper"] = "whisper.cpp kaynaktan derle (cmake) ya da dağıtım paketi; ffmpeg: apt install ffmpeg"
        rec["install_node"] = "nvm ya da dağıtım paketi (Node ≥ 20)"
        rec["install_python"] = "uv python install 3.11"
    else:
        rec["install_whisper"] = "whisper.cpp Windows sürümü (GitHub releases, whisper-cli.exe PATH'e) + winget install ffmpeg"
        rec["install_node"] = "winget install OpenJS.NodeJS.LTS"
        rec["install_python"] = "winget install astral-sh.uv, sonra uv python install 3.11"
        rec["windows_note"] = ("Araçlar macOS'ta geliştirildi; Windows'ta venv yolları voice\\.venv-chatterbox\\Scripts\\python.exe olur. "
                               "WSL2 (Ubuntu) daha az sürprizle çalışır.")
    rec["venvs"] = ["core (zorunlu)"] + (["mlx (ses tasarımı)"] if apple_silicon else []) + ["matte (isteğe bağlı: nesne kesme)",
                                                                                        "manim (isteğe bağlı: bilim animasyonu)",
                                                                                        "sam2 (isteğe bağlı, ağır: video maskesi)"]
    warn = []
    if ram and ram < 16:
        warn.append(f"Bellek {ram} GB: Remotion render'ı --concurrency=1 ile al; ağır işleri buluta ver.")
    if disk_free < 15:
        warn.append(f"Boş disk {disk_free} GB: modeller + node_modules + bölümler için en az ~15 GB önerilir.")
    if not shutil.which("ffmpeg"):
        warn.append("ffmpeg yok: ses/görüntü araçlarının hepsi buna dayanır.")

    info = {"os": sysname, "os_version": platform.release(), "arch": arch, "chip": chip, "apple_silicon": apple_silicon,
            "ram_gb": ram, "nvidia_gpu": nvidia or None, "disk_free_gb": disk_free, "kaggle_key": kaggle_key,
            "tools": tools, "recommend": rec, "warnings": warn}
    if "--json" in sys.argv:
        print(json.dumps(info, ensure_ascii=False, indent=2))
        return
    print(f"Sistem: {sysname} {platform.release()} · {arch} · {chip or '?'} · {ram} GB RAM · boş disk {disk_free} GB"
          + (f" · GPU {nvidia}" if nvidia else ""))
    print("Araçlar: " + ", ".join(f"{k}{'' if v['found'] else ' (YOK)'}" for k, v in tools.items()))
    print(f"Kaggle anahtarı: {'var' if kaggle_key else 'yok'}")
    for k, v in rec.items():
        print(f"  {k}: {v}")
    for w in warn:
        print(f"  ⚠️ {w}")


if __name__ == "__main__":
    main()
