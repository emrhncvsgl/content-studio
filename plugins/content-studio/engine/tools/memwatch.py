"""Bellek bekçisi (macOS · Linux · Windows): boş belleği ölçer, eşik altına inince uyarır ya da izlenen işi durdurur.

Yalnızca standart kütüphane; düz `python3`/`python` ile de çalışır.
  voice/.venv-chatterbox/bin/python tools/memwatch.py                    # boş bellek yüzdesi (ör. "free 42.0%")
  voice/.venv-chatterbox/bin/python tools/memwatch.py --min 10           # eşik altındaysa çıkış kodu 1 (ağır iş başlatmadan önce)
  voice/.venv-chatterbox/bin/python tools/memwatch.py --guard <PID> --min 10 [--interval 5]
      # arka plandaki ağır işi (TTS, render) izler; boş bellek %10'un altına inerse işi ve alt süreçlerini durdurur
Kural: aynı anda tek ağır iş; uzun işler arka planda ve bekçiyle.
"""
import argparse
import os
import signal
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from platform_util import IS_WIN, free_memory_pct  # noqa: E402


def alive(pid: int) -> bool:
    if IS_WIN:
        out = subprocess.run(["tasklist", "/FI", f"PID eq {pid}", "/NH"], capture_output=True, text=True).stdout
        return str(pid) in out
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def stop(pid: int):
    if IS_WIN:
        subprocess.run(["taskkill", "/PID", str(pid), "/T", "/F"], capture_output=True)
    else:
        try:
            os.killpg(os.getpgid(pid), signal.SIGTERM)
        except OSError:
            os.kill(pid, signal.SIGTERM)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--min", type=float, default=None, help="boş bellek alt sınırı (%%)")
    ap.add_argument("--guard", type=int, help="izlenecek süreç kimliği (PID)")
    ap.add_argument("--interval", type=float, default=5.0)
    a = ap.parse_args()
    free = free_memory_pct()
    if not a.guard:
        print(f"free {free}%" if free is not None else "free ? (ölçülemedi)")
        sys.exit(1 if (a.min is not None and free is not None and free < a.min) else 0)
    lim = a.min if a.min is not None else 10.0
    while alive(a.guard):
        free = free_memory_pct()
        if free is not None and free < lim:
            print(f"[memwatch] boş bellek {free}% < {lim}%: süreç {a.guard} durduruluyor", flush=True)
            stop(a.guard)
            sys.exit(2)
        time.sleep(a.interval)
    print(f"[memwatch] süreç {a.guard} bitti", flush=True)


if __name__ == "__main__":
    main()
