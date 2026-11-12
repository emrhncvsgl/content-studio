"""Kamu malı bir MIDI eserden kendi kaydımızı üretir: düzenleme (çalgılar, tempo, dinamik) + fluidsynth ile ses.

Kullanım: python tools/music/arrange.py <girdi.mid> <çıktı_klasörü> [--bpm 60] [--bars 16] [--versions piano,pizz,cello]
Çıktı:  <klasör>/<ad>.<versiyon>.mid ve .wav (48 kHz stereo). Ses dosyası: tools/music/soundfonts/FluidR3_GM.sf2 (MIT).
Paket gerektirmez: küçük bir MIDI okuyucu/yazıcı içerir (format 0/1, nota ve tempo olayları yeterli).
"""
import argparse
import struct
import subprocess
from pathlib import Path

SF2 = Path(__file__).resolve().parent / "soundfonts" / "FluidR3_GM.sf2"


def _vlq(data: bytes, i: int) -> tuple[int, int]:
    v = 0
    while True:
        b = data[i]; i += 1
        v = (v << 7) | (b & 0x7F)
        if not b & 0x80:
            return v, i


def read_notes(path: Path) -> tuple[int, list[tuple[int, int, int]]]:
    """→ (ppq, [(başlangıç_tick, süre_tick, perde)]); bütün izler birleşir."""
    d = path.read_bytes()
    assert d[:4] == b"MThd"
    _, ntrk, ppq = struct.unpack(">HHH", d[8:14])
    i, notes = 14, []
    for _ in range(ntrk):
        assert d[i:i + 4] == b"MTrk"
        ln = struct.unpack(">I", d[i + 4:i + 8])[0]
        j, end, t, status, on = i + 8, i + 8 + ln, 0, 0, {}
        while j < end:
            dt, j = _vlq(d, j); t += dt
            if d[j] & 0x80:
                status = d[j]; j += 1
            if status == 0xFF:
                j += 1; ln2, j = _vlq(d, j); j += ln2
            elif status in (0xF0, 0xF7):
                ln2, j = _vlq(d, j); j += ln2
            else:
                kind, a = status & 0xF0, d[j]
                b = d[j + 1] if kind not in (0xC0, 0xD0) else 0
                j += 1 if kind in (0xC0, 0xD0) else 2
                if kind == 0x90 and b > 0:
                    on.setdefault(a, []).append(t)
                elif kind in (0x80, 0x90) and on.get(a):
                    s = on[a].pop(0); notes.append((s, t - s, a))
        i = end
    return ppq, sorted(notes)


def write_mid(path: Path, ppq: int, bpm: float, events: list[tuple[int, bytes]]):
    """events: (tick, ham MIDI mesajı). Tek iz (format 0)."""
    tempo = int(60_000_000 / bpm)
    evs = [(0, b"\xff\x51\x03" + tempo.to_bytes(3, "big"))] + sorted(events, key=lambda e: (e[0], e[1][0] & 0xF0 != 0x80))
    out, last = bytearray(), 0
    for t, m in evs:
        dt = t - last; last = t
        buf = [dt & 0x7F]
        while dt > 0x7F:
            dt >>= 7; buf.insert(0, (dt & 0x7F) | 0x80)
        out += bytes(buf) + m
    out += b"\x00\xff\x2f\x00"
    path.write_bytes(b"MThd" + struct.pack(">IHHH", 6, 0, 1, ppq) + b"MTrk" + struct.pack(">I", len(out)) + out)


def note(ch: int, t: int, dur: int, pitch: int, vel: int) -> list[tuple[int, bytes]]:
    return [(t, bytes([0x90 | ch, pitch, max(1, min(127, vel))])), (t + dur, bytes([0x80 | ch, pitch, 0]))]


def program(ch: int, prog: int) -> tuple[int, bytes]:
    return (0, bytes([0xC0 | ch, prog]))


def cc(ch: int, t: int, num: int, val: int) -> tuple[int, bytes]:
    return (t, bytes([0xB0 | ch, num, val]))


def arrange(ppq: int, notes, bars: int, version: str):
    bar = 4 * ppq
    notes = [n for n in notes if n[0] < bars * bar]
    ev = [program(0, 0), cc(0, 0, 7, 100), cc(0, 0, 91, 70)]  # piyano + oda yankısı
    piano_vel = {"piano": 58, "pizz": 46, "cello": 40}[version]
    for b in range(bars):  # ölçü başına pedal: arpejler birbirine karışarak çınlar
        ev += [cc(0, b * bar + 4, 64, 127), cc(0, (b + 1) * bar - 8, 64, 0)]
    for s, dur, p in notes:
        pos = (s % bar) / ppq  # ölçü içindeki vuruş
        accent = 8 if pos in (0.0, 2.0) else 0  # yarım ölçü başları hafif vurgulu
        breath = int(6 * ((s // bar) % 4 == 3))  # dört ölçüde bir hafif nefes
        ev += note(0, s, dur, p, piano_vel + accent - breath)
    by_bar = {}
    for s, dur, p in notes:
        by_bar.setdefault(s // bar, []).append((s, p))
    if version == "pizz":  # pizzicato yaylılar: bas notası 1. ve 3. vuruşta, tepe notası 2. ve 4. vuruşun arkasında
        ev += [program(1, 45), cc(1, 0, 7, 92), cc(1, 0, 91, 50)]
        for b, ns in by_bar.items():
            low, high = min(p for _, p in ns), max(p for _, p in ns)
            for beat in (0, 2):
                ev += note(1, b * bar + beat * ppq, ppq // 2, low - 12 if low >= 48 else low, 78)
            for beat in (1.5, 3.5):
                ev += note(1, b * bar + int(beat * ppq), ppq // 3, high, 52)
    if version == "cello":  # çello: ölçünün bas notasını legato uzatır, piyano geride
        ev += [program(1, 42), cc(1, 0, 7, 96), cc(1, 0, 91, 60)]
        for b, ns in by_bar.items():
            low = min(p for _, p in ns)
            while low > 55:
                low -= 12
            ev += note(1, b * bar, bar - ppq // 8, low, 70)
            ev += [cc(1, b * bar, 11, 70), cc(1, b * bar + ppq, 11, 110), cc(1, b * bar + 3 * ppq, 11, 85)]  # yay basıncı: şişip söner
    return ev


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("mid"); ap.add_argument("out")
    ap.add_argument("--bpm", type=float, default=60); ap.add_argument("--bars", type=int, default=16)
    ap.add_argument("--versions", default="piano,pizz,cello")
    a = ap.parse_args()
    src, out = Path(a.mid), Path(a.out); out.mkdir(parents=True, exist_ok=True)
    ppq, notes = read_notes(src)
    for v in a.versions.split(","):
        mid = out / f"{src.stem}.{v}.mid"
        write_mid(mid, ppq, a.bpm, arrange(ppq, notes, a.bars, v))
        wav = mid.with_suffix(".wav")
        subprocess.run(["fluidsynth", "-ni", "-q", "-r", "48000", "-g", "0.5", "-F", str(wav), str(SF2), str(mid)], check=True)
        print("[done]", wav)


if __name__ == "__main__":
    main()
