"""Platformlar arası yardımcılar (macOS · Linux · Windows). Araçlar dış program çağırırken bunları kullanır.

Neden: Windows'ta `npx`/`npm` birer `.cmd` dosyasıdır; Python'un liste biçimli subprocess çağrısı onları bulamaz, cmd.exe üzerinden
çağrılınca da JSON içeren argümanlar (`--props={...}`) bozulur. Bu yüzden Remotion doğrudan `node <remotion-cli.js>` ile çağrılır.
ffmpeg/ffprobe/whisper-cli Windows'ta da `.exe` olarak PATH'te bulunur; whisper için ayrıca `voice/bin/` ve WHISPER_CLI desteklenir.

  from platform_util import remotion, venv_python, whisper_cli, IS_WIN
  subprocess.run([*remotion(), "render", "src/index.ts", "ShortsVideo", out, f"--props={json.dumps(p)}"], cwd=ROOT / "studio")
"""
import os
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IS_WIN = sys.platform == "win32"
IS_MAC = sys.platform == "darwin"


def venv_python(venv: str | Path) -> Path:
    """voice/.venv-chatterbox → .../bin/python (macOS/Linux) ya da .../Scripts/python.exe (Windows)."""
    v = ROOT / venv if not Path(venv).is_absolute() else Path(venv)
    return v / ("Scripts/python.exe" if IS_WIN else "bin/python")


def node() -> str:
    n = shutil.which("node")
    if not n:
        sys.exit("node bulunamadı: Node.js 20+ kurulu olmalı (/content-studio:studio-setup)")
    return n


def remotion() -> list[str]:
    """Remotion CLI'yi .cmd/.sh sarmalayıcısı olmadan çağırır: [node, studio/node_modules/@remotion/cli/remotion-cli.js]."""
    cli = ROOT / "studio" / "node_modules" / "@remotion" / "cli" / "remotion-cli.js"
    if not cli.exists():
        sys.exit(f"Remotion kurulu değil: {cli} yok (studio klasöründe `npm ci`)")
    return [node(), str(cli)]


def whisper_cli() -> str:
    """whisper.cpp ikilisi: WHISPER_CLI ortam değişkeni → PATH (whisper-cli, eski adı main) → voice/bin/."""
    if os.environ.get("WHISPER_CLI"):
        return os.environ["WHISPER_CLI"]
    for name in ("whisper-cli", "whisper-cpp"):
        p = shutil.which(name)
        if p:
            return p
    for name in ("whisper-cli.exe", "whisper-cli", "main.exe"):
        p = ROOT / "voice" / "bin" / name
        if p.exists():
            return str(p)
    sys.exit("whisper-cli bulunamadı: macOS `brew install whisper-cpp`; Windows: whisper.cpp sürümündeki whisper-cli.exe'yi "
             "voice/bin/ altına koy ya da PATH'e ekle; Linux: kaynaktan derle (/content-studio:studio-setup)")


def free_memory_pct() -> float | None:
    """Boş (kullanılabilir) bellek yüzdesi; ölçülemezse None. tools/memwatch.py kullanır."""
    try:
        if IS_MAC:
            import subprocess
            out = subprocess.run(["memory_pressure", "-Q"], capture_output=True, text=True, timeout=10).stdout
            for line in out.splitlines():
                if "free percentage" in line:
                    return float(line.rsplit(":", 1)[1].strip().rstrip("%"))
        elif IS_WIN:
            import ctypes

            class MEMSTAT(ctypes.Structure):
                _fields_ = [("dwLength", ctypes.c_ulong), ("dwMemoryLoad", ctypes.c_ulong),
                            ("ullTotalPhys", ctypes.c_ulonglong), ("ullAvailPhys", ctypes.c_ulonglong),
                            ("ullTotalPageFile", ctypes.c_ulonglong), ("ullAvailPageFile", ctypes.c_ulonglong),
                            ("ullTotalVirtual", ctypes.c_ulonglong), ("ullAvailVirtual", ctypes.c_ulonglong),
                            ("ullAvailExtendedVirtual", ctypes.c_ulonglong)]
            m = MEMSTAT()
            m.dwLength = ctypes.sizeof(MEMSTAT)
            ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(m))
            return round(100.0 * m.ullAvailPhys / m.ullTotalPhys, 1)
        else:
            info = {}
            for line in Path("/proc/meminfo").read_text().splitlines():
                k, v = line.split(":", 1)
                info[k] = int(v.split()[0])
            return round(100.0 * info["MemAvailable"] / info["MemTotal"], 1)
    except Exception:
        return None
    return None
