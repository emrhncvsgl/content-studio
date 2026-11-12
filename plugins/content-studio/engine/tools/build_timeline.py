"""Senaryo + ses raporu + kanal teması → timeline.json (PLAN 4.3, studio/src/schema/timeline.ts ile aynı sözleşme).

Altyazı metni SENARYODAN gelir, Whisper yalnızca zamanlamayı verir: senaryo kelimeleri Whisper kelimelerine hizalanır
(difflib). Böylece "TRIZ" (Whisper: "trees") ve noktalama doğru görünür (DECISIONS 2026-10-20 bulgusu).

Kullanım: voice/.venv-chatterbox/bin/python tools/build_timeline.py <bölüm_klasörü> [--lang en]
Girdi:  <bölüm>/script.<dil>.json, <bölüm>/audio/<dil>/report.json + sNN.wav
Çıktı:  <bölüm>/timeline.json (yollar content/ köküne göre; Remotion public dizini content/)
"""
import argparse
import difflib
import json
import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "voice"))
import asr  # noqa: E402

FPS = 30
SCENE_GAP_S = 0.35   # synth.py anlatım boşluğuyla aynı
TAIL_S = 0.8          # son sahneden sonra nefes payı (CTA / döngü)


def norm_token(tok: str, lang: str) -> str:
    n = asr.norm(tok, lang)
    return " ".join(n)


def align(script_text: str, wwords: list[dict], lang: str) -> list[dict]:
    """Senaryo kelimelerine Whisper zamanlarını atar. Eşleşmeyen kelimeler komşu zamanlardan pay alır."""
    toks = script_text.split()
    a = [norm_token(t, lang) for t in toks]
    b = [norm_token(w["text"], lang) for w in wwords]
    out = [None] * len(toks)
    sm = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == "equal":
            for k in range(i2 - i1):
                w = wwords[j1 + k]
                out[i1 + k] = (w["startMs"], w["endMs"])
        elif op == "replace" and j2 > j1:   # ör. TRIZ ↔ trees: Whisper aralığı senaryo kelimelerine bölünür
            s, e = wwords[j1]["startMs"], wwords[j2 - 1]["endMs"]
            n = i2 - i1
            for k in range(n):
                out[i1 + k] = (s + (e - s) * k / n, s + (e - s) * (k + 1) / n)
    # Whisper'da hiç karşılığı olmayanlar (delete): komşular arasına yerleştir
    for i, v in enumerate(out):
        if v is None:
            prev = next((out[j][1] for j in range(i - 1, -1, -1) if out[j]), 0)
            nxt = next((out[j][0] for j in range(i + 1, len(out)) if out[j]), prev + 300)
            out[i] = (prev, max(prev + 120, nxt))
    words = []
    for t, (s, e) in zip(toks, out):
        words.append({"text": t, "startMs": int(round(s)), "endMs": int(round(max(e, s + 60)))})
    for x, y in zip(words, words[1:]):   # zaman sırası ve çakışma düzeltmesi
        if y["startMs"] < x["startMs"]:
            y["startMs"] = x["startMs"]
        x["endMs"] = min(x["endMs"], max(y["startMs"], x["startMs"] + 60))
    return words, sm.ratio()


_HIT: dict[str, int] = {}
BED_LIKE = ("room_tone", "ambience", "ambient", "bed", "static", "hum", "drone")   # yatak/ortam: vuruşu yok, kaydırılmaz


def sfx_hit_ms(file: str, rel_db: float = -12.0) -> int:
    """Efekt dosyasının içindeki duyulur vuruş anı (ms): RMS (5 ms) tepeye göre rel_db'yi ilk geçtiği an.

    2026-11-12 (EP010, kullanıcı: "bant sesi, kâğıt yırtma sesi geç geliyor"): tape_rip.wav'ın vuruşu 445 ms, paper_rustle 344 ms
    içeride; efekt kelime anında BAŞLATILINCA görüntüdeki olaydan o kadar geç duyuluyordu. Sahne efektleri artık vuruş kelimeye
    denk gelecek şekilde erkene alınır (align: "start" ile kapatılır). Ölçüm dosya başına bir kez."""
    if file in _HIT:
        return _HIT[file]
    import numpy as np
    import soundfile as sf
    try:
        x, sr = sf.read(str(ROOT / "content" / file), dtype="float32", always_2d=True)
    except Exception:
        _HIT[file] = 0
        return 0
    x = x.mean(axis=1)
    hop = max(1, int(sr * 0.005))
    n = len(x) // hop
    if n == 0:
        _HIT[file] = 0
        return 0
    rms = np.sqrt(np.mean(x[: n * hop].reshape(n, hop) ** 2, axis=1) + 1e-12)
    db = 20 * np.log10(rms / rms.max())
    _HIT[file] = int(np.argmax(db > rel_db) * 5)
    return _HIT[file]


def speech_onset_ms(wav_path: Path, thr_db: float = -30.0) -> int:
    """Sahne sesinde konuşmanın gerçekten başladığı an (10 ms çerçeve, tepeye göre eşik).

    QA (EP001): Whisper sahne başındaki ~0.2 sn nefesi ilk kelimeye katıyor; altyazı sesten 190-300 ms önce başlıyordu.
    Nefes −30 dB eşiğinin altında kalır; ilk kelime bu ana kaydırılır.
    """
    import wave
    import numpy as np
    with wave.open(str(wav_path)) as w:
        sr = w.getframerate()
        x = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float32) / 32767
    hop = int(sr * 0.01)
    n = len(x) // hop
    db = 20 * np.log10(np.sqrt(np.mean(x[: n * hop].reshape(n, hop) ** 2, axis=1) + 1e-9) / (np.abs(x).max() + 1e-9))
    idx = np.flatnonzero(db > thr_db)
    return int(idx[0] * 10) if len(idx) else 0


def fix_first_word(words: list[dict], onset: int) -> int:
    """İlk kelime gerçek ses başlangıcından önce başlıyorsa kaydırır; kaydırma miktarını (ms) döndürür."""
    if not words or onset - words[0]["startMs"] <= 60:
        return 0
    shift = onset - words[0]["startMs"]
    nxt = words[1]["startMs"] if len(words) > 1 else onset + 400
    words[0]["startMs"] = onset
    words[0]["endMs"] = max(words[0]["endMs"], min(nxt, onset + 180))
    if len(words) > 1 and words[1]["startMs"] < words[0]["endMs"]:
        words[1]["startMs"] = words[0]["endMs"]
    return shift


def default_transition(prev_scenes: list[dict], style: str) -> str:
    """Sahne girişi (PLAN 8.4: çoğunlukla sert kesme, az ve bilinçli efekt). İlk sahne: cut.
    Stil değişiyorsa: kinetic-type'a wipe, diğerlerine zoom. Aynı stil devam ediyorsa: cut (ritim figür değişiminden gelir)."""
    if not prev_scenes:
        return "cut"
    if prev_scenes[-1]["style"] == style:
        return "cut"
    return "wipe" if style == "kinetic-type" else "zoom"


# Stil değişen kesmede geçiş sesi (kanal varsayılanı: whoosh). Bölüm bazında script üst düzey `transition_sfx`, sahne bazında
# `visual.transition_sfx` ile seçilir: whoosh (sentetik, tools/sfx.py) · paper (doğal sayfa çevirme, content/sfx/natural) ·
# swoosh (Pixabay, content/sfx/pixabay) · none.
# lead: efektin kesmeden kaç kare önce başladığı (sesin en yoğun anı kesmeye denk gelsin).
TRANSITION_SFX = {
    "whoosh": {"file": "sfx/whoosh.wav", "gainDb": -18, "lead": 7},
    "paper": {"file": "sfx/natural/page_turn.wav", "gainDb": -16, "lead": 12},  # EP002 geri bildirimi: −24 duyulmuyordu
    "swoosh": {"file": "sfx/pixabay/swoosh_thin.wav", "gainDb": -20, "lead": 9},  # Pixabay (EP003), sentetik whoosh'tan yumuşak
    "layered": "layered",   # LAYERED: hedef stile göre katmanlı geçiş (hava + doku + alçak vuruş)
    "none": None,
}
# Katmanlı geçiş (EP003 ses turu): tek whoosh yerine 2-3 katman. lead: kesmeden kaç kare önce başlar; "end" = dosyanın sonu kesmeye
# denk gelir (riser). lead değerleri dosyanın doruk anına göre ölçüldü (sesin en yoğun anı kesmede). Anahtar hedef sahnenin stil grubudur; aynı stil içindeki düz kesmeler (cut) "cut" setini alır.
LAYERED = {
    "manim": [("sfx/pixabay/riser_cinematic.wav", -25, 74), ("sfx/pixabay/whoosh_cinematic.wav", -24, 27), ("sfx/pixabay/impact_boom3.wav", -20, 1)],
    "paper": [("sfx/pixabay/swoosh_slow.wav", -25, 30), ("sfx/pixabay/book_drop.wav", -20, 7), ("sfx/pixabay/thud_small.wav", -24, 8)],
    "photo": [("sfx/pixabay/whoosh_cinematic.wav", -22, 27), ("sfx/pixabay/sub_drop_short.wav", -25, 0)],
    "cut": [("sfx/pixabay/swoosh_slow.wav", -27, 30), ("sfx/pixabay/click_soft.wav", -30, 0)],
}
LAYER_GROUP = {"manim": "manim", "vox-explainer": "paper"}

# Nesne üzerinden geçişler (vox talimatı §6, studio/src/components/Transitions.tsx). visual.transition string ya da
# { type, target?, frame?, shape?, pre?, post?, fps?, blurSamples?, dir?, color?, ease?, lens?, hunt? }. Sesleri (§8): (dosya, dB, lead kare | "pre" = pencere başı)
TRANSITIONS = {"cut", "zoom", "wipe", "flash", "blur", "portal", "pullback", "cardflip", "zoomblur", "whip", "leak", "rgb", "halftoneWipe", "fog", "slide", "objectWipe", "matte", "surfaceTilt", "disc", "door", "window"}
# air_hiss / air_swish geçişte kullanılmaz (2026-11-03): EP003 tren basınç dalgası sesi, 200 Hz altı enerjisi yok, tok değil.
ADV_SFX = {   # 2026-11-01: kullanıcının "tok" sesleri (vuruş + derin bas + sinematik hava); lead = dosyanın doruğu kesmeye denk gelsin
    "portal": [("sfx/pixabay/whoosh_cinematic.wav", -21, 27), ("sfx/pixabay/impact_boom3.wav", -19, 1), ("sfx/pixabay/sub_drop_short.wav", -23, 0)],
    "pullback": [("sfx/pixabay/whoosh_epic.wav", -22, 9), ("sfx/pixabay/thud_deep_loud.wav", -22, -14)],
    "cardflip": [("sfx/pixabay/page_flip.wav", -17, 30), ("sfx/pixabay/whoosh_cinematic.wav", -24, 27), ("sfx/pixabay/impact_boom5.wav", -21, 11)],
    "zoomblur": [("sfx/pixabay/whoosh_hit.wav", -20, 7), ("sfx/pixabay/sub_drop_short.wav", -24, 0)],
    "whip": [("sfx/pixabay/swoosh_thin.wav", -20, 9)],
    "leak": [("sfx/pixabay/riser_swoosh.wav", -24, 57), ("sfx/pixabay/whoosh_cinematic.wav", -23, 27)],
    "rgb": [("sfx/pixabay/swoosh_thin.wav", -22, 9), ("sfx/pixabay/click_soft.wav", -24, 0)],
    "halftoneWipe": [("sfx/pixabay/paper_slide_short.wav", -22, 9)],
    "fog": [("sfx/pixabay/boom_swoosh.wav", -23, 19), ("sfx/pixabay/whoosh_epic.wav", -25, 19), ("sfx/pixabay/sub_bass_boom.wav", -28, 13)],
    "slide": [("sfx/pixabay/whoosh_epic.wav", -21, 19), ("sfx/pixabay/thud_deep_loud.wav", -24, 0)],
    "objectWipe": [("sfx/pixabay/whoosh_epic.wav", -21, 19), ("sfx/pixabay/paper_slide_table.wav", -24, 6), ("sfx/pixabay/thud_deep_loud.wav", -25, 0)],
    "matte": [("sfx/pixabay/whoosh_cinematic.wav", -23, 27)],
    "surfaceTilt": [("sfx/pixabay/whoosh_epic.wav", -23, 19), ("sfx/pixabay/paper_slide_table.wav", -26, 6)],
    "disc": [("sfx/pixabay/whoosh_hit.wav", -21, 7), ("sfx/pixabay/sub_drop_short.wav", -25, 0)],
    "door": [("sfx/pixabay/thud_small.wav", -24, 0)],
    "window": [("sfx/pixabay/whoosh_cinematic.wav", -23, 27)],
}

# Katman olaylarına otomatik ses (vox §8; kapatmak için senaryo üst düzey "auto_sfx": false). Türler kütüphaneden sırayla seçilir,
# aynı türden iki ses 120 ms'den yakınsa ikincisi atlanır.
AUTO_SFX = {
    "slide": (["sfx/pixabay/paper_slide_short.wav", "sfx/pixabay/paper_slide_table.wav", "sfx/pixabay/paper_drop.wav"], -24),
    "pop": (["sfx/pixabay/pop_soft.wav", "sfx/pixabay/thumb_tack.wav", "sfx/pixabay/pop_clean.wav"], -26),
    "marker": (["sfx/pixabay/marker.wav"], -25),
    "key": (["sfx/pixabay/click_soft.wav", "sfx/pixabay/pen_click.wav"], -30),
    "tick": (["sfx/tick.wav"], -26),
    "stamp": (["sfx/pixabay/stamp.wav"], -16),
    "tape": (["sfx/pixabay/tape.wav"], -28),
}
BED_SFX = ("sfx/pixabay/room_tone.wav", -40)   # altta oda tonu yatağı (senaryo "sfx_bed": "none" ile kapanır)


ELEMENTS = ROOT / "content" / "assets" / "elements"


def load_element(eid: str) -> dict:
    p = ELEMENTS / f"{eid}.yaml"
    if not p.exists():
        raise SystemExit(f"element yok: {p}")
    return yaml.safe_load(p.read_text())


def expand_elements(props: dict) -> dict:
    """Element katmanı: { type: "cutout"|"print", element: "<id>", x, y, height|w, … } → image/size kütüphaneden (content/assets/elements)."""
    layers = []
    for l in props.get("layers") or []:
        if isinstance(l, dict) and l.get("element"):
            e = load_element(l["element"])
            l = {"type": "cutout", "image": f"assets/elements/{l['element']}.png", "size": e["size"], "hole": e["hole"], "holeShape": e.get("shape", "rect"), **l}
        if isinstance(l, dict) and l.get("type") == "clouds":   # bulut katmanı: items[].element → image/size (tools/cloud_key.py çıktıları)
            l = {**l, "items": [({"image": f"assets/elements/{it['element']}.png", "size": load_element(it["element"])["size"], **it}
                                 if it.get("element") else it) for it in l.get("items", [])]}
        layers.append(l)
    return {**props, "layers": layers} if props.get("layers") else props


def element_target(props: dict, eid: str, W: int, H: int) -> dict:
    """elem:<id> hedefi: giden sahnedeki element katmanının deliği → ekran kutusu (kare 0-1; kamera ve dönüş yok sayılır)."""
    e = load_element(eid)
    for l in props.get("layers") or []:
        if l.get("element") == eid:
            iw, ih = e["size"]
            if l.get("type") == "print":
                w = float(l["w"]); h = w * W * ih / iw / H
            else:
                h = float(l["height"]); w = h * H * iw / ih / W
            hole = e["hole"]
            return {"x": l["x"] + (hole["x"] - 0.5) * w, "y": l["y"] + (hole["y"] - 0.5) * h, "w": hole["w"] * w, "h": hole["h"] * h}
    raise SystemExit(f"elem:{eid} hedefi giden sahnede bulunamadı")


def split_transition(v) -> tuple[str | None, dict | None]:
    if isinstance(v, dict):
        return v.get("type"), {k: x for k, x in v.items() if k != "type"} or None
    return v, None


def layer_ms(at, words: list[dict]) -> float | None:
    """vox atMs ile aynı: sayı ya da kelime ("patent", "patent#2")."""
    if isinstance(at, (int, float)):
        return float(at)
    if not isinstance(at, str):
        return None
    w, _, n = at.partition("#")
    nk = lambda t: re.sub(r"[\W_]+", "", t.lower())   # vox atMs norm ile aynı
    hits = [x for x in words if nk(x["text"]) == nk(w)]
    k = (int(n) if n.isdigit() else 1) - 1
    return float(hits[k]["startMs"]) if 0 <= k < len(hits) else None


def auto_layer_sfx(sc: dict, lang: str) -> list[tuple[float, str]]:
    """vox katmanlarından (ms, tür) olayları: giriş → kâğıt kayması, tag/pin → pop, fosfor/annotate → marker, daktilo → tuş, sayaç → tık, damga."""
    if sc["style"] != "vox-explainer" or sc["props"].get("autoSfx") is False:   # sahne kendi seslerini elle veriyorsa (çift ses olmasın)
        return []
    words, out = sc["words"][lang], []
    for l in sc["props"].get("layers") or []:
        t = l.get("type")
        if t in ("piece", "cutout", "print") and l.get("from"):
            ms = layer_ms(l.get("enterAt", 0), words)
            if ms is not None:
                out.append((ms + 120, "slide"))
                if l.get("tape"):
                    out.append((ms + 520, "tape"))
        elif t in ("tag", "pin"):
            ms = layer_ms(l.get("at", l.get("showAt", 0)), words)
            if ms is not None:
                out.append((ms + 60, "pop"))
        elif t == "annotate":
            ms = layer_ms(l.get("at"), words)
            if ms is not None:
                out.append((ms, "marker"))
        elif t == "doc" and l.get("highlight"):
            ms = layer_ms(l.get("highlightAt", l.get("moveAt", 0)), words)
            if ms is not None:
                out.append((ms, "marker"))
        elif t == "counter":
            ms = layer_ms(l.get("at"), words)
            if ms is not None:
                dur = l.get("ms", 1100)
                out += [(ms + k, "tick") for k in range(0, int(dur), 90 if l.get("roll") else 140)]
        elif t == "stamp":
            ms = layer_ms(l.get("at"), words)
            if ms is not None:
                out.append((ms + 170, "stamp"))
        elif t == "title":
            base = layer_ms(l.get("at", l.get("showAt", 0)), words)
            if base is None:
                continue
            if l.get("write") == "typewriter":
                n = sum(len(x.get("text", "")) for x in l.get("lines", []))
                out += [(base + 250 + k * 1000 / 30, "key") for k in range(0, n, 2)]
            elif l.get("from"):
                out.append((base + 120, "slide"))
            for ln in l.get("lines", []):
                ms = layer_ms(ln.get("markAt"), words)
                if ms is not None:
                    out.append((ms, "marker"))
    return out


def image_size(rel_path: str) -> list[int]:
    """content/ köküne göre görselin piksel boyutu [genişlik, yükseklik]."""
    from PIL import Image
    with Image.open(ROOT / "content" / rel_path) as im:
        return list(im.size)


def wav_frames(rel_path: str) -> int:
    """content/ köküne göre wav dosyasının süresi (kare, yukarı yuvarlanır)."""
    import math
    import wave
    p = ROOT / "content" / rel_path
    if not p.exists():
        raise SystemExit(f"efekt dosyası yok: {p}")
    with wave.open(str(p)) as w:
        return max(1, math.ceil(w.getnframes() / w.getframerate() * FPS))


def sfx_event(frame: int, file: str, gain_db: float, dur_ms: float | None = None, note: str = "", fade_ms: float | None = None) -> dict:
    """Efekt olayı: süre dosyadan okunur; durMs verilirse kısaltılır (son 6 kare yumuşak kısılır; fadeMs ile değişir, 0 = sert kesme)."""
    full = wav_frames(file)
    ev = {"frame": max(0, frame), "file": file, "gainDb": gain_db, "durationFrames": full}
    if dur_ms:
        ev["durationFrames"] = max(1, min(full, round(dur_ms / 1000 * FPS)))
        if ev["durationFrames"] < full:
            ev["fadeOutFrames"] = min(6 if fade_ms is None else round(fade_ms / 1000 * FPS), ev["durationFrames"] // 2)
    if note:
        ev["note"] = note
    return ev


def intro_props(props: dict, intro: dict, lead_ms: int) -> dict:
    """Intro kadrajı: ilk lead_ms boyunca intro.from → intro.to (ör. tabağa yakın plan), sonra kesintisiz olarak sahnenin
    kendi 'to' kadrajına açılır. Sahnenin mevcut cuts'ı lead_ms kadar kayar."""
    if not (intro.get("from") or intro.get("to")):   # sahne lead'i (bölüm başlığı boşluğu): kadraj aynı, cuts lead kadar kayar
        out = {**props, "cuts": [{**c, "atMs": c["atMs"] + lead_ms} for c in props["cuts"]]} if props.get("cuts") else dict(props)
        sh = int(intro.get("layerShiftMs", 0))   # sayıyla verilen katman girişleri (enterAt ms) karanlıktan açılıştan sonraya kayar
        if sh and out.get("layers"):
            out["layers"] = [{**l, "enterAt": l["enterAt"] + sh} if isinstance(l.get("enterAt"), (int, float)) else l for l in out["layers"]]
        return out
    out = dict(props)
    out["from"], out["to"] = intro.get("from", props.get("from")), intro.get("to", intro.get("from"))
    cuts = [{"atMs": lead_ms, "from": out["to"], "to": props.get("to"), "fadeMs": 0}]
    cuts += [{**c, "atMs": c["atMs"] + lead_ms} for c in props.get("cuts", [])]
    out["cuts"] = cuts
    return out


def quietest(path: Path, mid_ms: float, lo: float, hi: float, win_ms: float = 200) -> float:
    """mid_ms çevresinde (lo..hi ve ±win_ms içinde) en düşük enerjili 20 ms pencerenin ortası (ms)."""
    import numpy as np
    import soundfile as sf
    y, sr = sf.read(str(path))
    y = y if y.ndim == 1 else y.mean(1)
    a, b = max(lo, mid_ms - win_ms, 0), min(hi, mid_ms + win_ms, len(y) / sr * 1000)
    if b - a < 25:
        return mid_ms
    hop, w = int(0.005 * sr), int(0.02 * sr)
    best, at = 1e9, mid_ms
    for k in range(int(a / 1000 * sr), int(b / 1000 * sr) - w, hop):
        e = float(np.mean(y[k:k + w] ** 2))
        if e < best:
            best, at = e, (k + w / 2) / sr * 1000
    return at


def apply_pauses(ep: Path, lang: str, sid: str, words: list[dict], pauses: list[dict]) -> tuple[Path, int]:
    """Sahne içi sessizlik: pauses = [{"afterWord": "cut", "ms": 1000}]. Sözcükten sonraki boşluğa sessizlik eklenmiş
    audio/<dil>/_paced/<id>.wav yazar, sonraki kelimeleri kaydırır. Döner: ses yolu, eklenen toplam ms."""
    import subprocess
    src = ep / "audio" / lang / f"{sid}.wav"
    cuts = []  # (kesme ms, sessizlik ms)
    for p in pauses:
        i = p["index"] if "index" in p else \
            next((k for k, w in enumerate(words) if norm_token(w["text"], lang) == norm_token(p["afterWord"], lang)), None)
        if i is None or i == len(words) - 1:
            sys.exit(f"[hata] {sid}: pauses.afterWord bulunamadı ya da son kelime: {p['afterWord']}")
        # atMs: sesten ölçülmüş gerçek boşluk (ASR sınırı kaçabilir, EP007 s07 "cut"un ucunu kırpıyordu). Verilmezse ASR orta noktasının
        # ±200 ms çevresindeki en sessiz 20 ms'ye kesilir (EP009 2026-11-09: orta nokta 5/49 cümle durağında kelimenin içine düşüp "takılma" yapıyordu)
        at = p.get("atMs") or quietest(src, (words[i]["endMs"] + words[i + 1]["startMs"]) / 2,
                                       lo=words[i]["endMs"] - 120, hi=words[i + 1]["startMs"] + 60)
        cuts.append((at, int(p["ms"]), i + 1))
    cuts.sort()
    for _, ms, first in cuts:
        for w in words[first:]:
            w["startMs"] += ms
            w["endMs"] += ms
    out = src.parent / "_paced" / src.name
    out.parent.mkdir(exist_ok=True)
    edges = [0.0] + [c[0] / 1000 for c in cuts]
    parts, labels = [], []
    # kesim kenarlarında 40 ms yumuşatma: kesim her zaman sessiz yere düşmüyor (EP010 2026-11-10: 39 kesimin 8'i −40..−58 dB nefes/taban
    # sesinde; araya giren dijital sessizlik kulaklıkta "kesilme + çıt" yapıyordu, s07 0:46 ve s46 4:46)
    F = 0.04
    for k, a in enumerate(edges):
        end = f":end={edges[k + 1]:.3f}" if k + 1 < len(edges) else ""
        fades = (f",afade=t=in:d={F}" if k > 0 else "") + \
                (f",afade=t=out:st={edges[k + 1] - a - F:.3f}:d={F}" if k + 1 < len(edges) else "")
        parts.append(f"[0:a]atrim=start={a:.3f}{end},asetpts=PTS-STARTPTS{fades}[p{k}]")
        labels.append(f"[p{k}]")
        if k < len(cuts):
            parts.append(f"anullsrc=r=48000:cl=mono,atrim=end={cuts[k][1] / 1000:.3f},asetpts=PTS-STARTPTS[z{k}]")
            labels.append(f"[z{k}]")
    fc = ";".join(parts) + ";" + "".join(labels) + f"concat=n={len(labels)}:v=0:a=1[o]"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-filter_complex", fc, "-map", "[o]", "-ar", "48000", str(out)], check=True)
    return out, sum(c[1] for c in cuts)


def resolve_word_times(props: dict, words: list[dict], lang: str, sid: str, lead_ms: int = 0) -> dict:
    """Foto stilleri (PhotoMotion sayı ister): props.to.at, props.cuts[].atMs, props.cuts[].to.at, props.compare.at kelime olarak
    yazılabilir (2026-11-08, EP009): "kelime", "kelime#2" (n. geçiş), sonuna "+150" / "-200" ms ofset. Ses yeniden üretilince
    elle ms güncellemek gerekmez. Cümle duraklarından sonra, altyazı eşlemesinden önce çözülür; intro lead_ms düşülür."""
    def ms(v):
        if not isinstance(v, str):
            return v
        m = re.match(r"^(.*?)(?:#(\d+))?([+-]\d+)?$", v.strip())
        key, nth, off = norm_token(m.group(1), lang), int(m.group(2) or 1), float(m.group(3) or 0)
        hits = [w for w in words if norm_token(w["text"], lang) == key]
        if len(hits) < nth:
            raise SystemExit(f"[hata] {sid}: kelime zamanı bulunamadı: {v!r}")
        return round(hits[nth - 1]["startMs"] + off - lead_ms)
    if not props:
        return props
    out = dict(props)
    if isinstance(out.get("to"), dict) and "at" in out["to"]:
        out["to"] = {**out["to"], "at": ms(out["to"]["at"])}
    if isinstance(out.get("compare"), dict) and "at" in out["compare"]:
        out["compare"] = {**out["compare"], "at": ms(out["compare"]["at"])}
    if out.get("cuts"):
        cuts = []
        for c in out["cuts"]:
            c = {**c, "atMs": ms(c.get("atMs"))}
            if isinstance(c.get("to"), dict) and isinstance(c["to"].get("at"), str):   # çekimin to.at'i çekim başından ms
                c["to"] = {**c["to"], "at": max(0, ms(c["to"]["at"]) - c["atMs"])}
            cuts.append(c)
        out["cuts"] = cuts
    return out


def resolve_scene_sfx(sc_script: dict, words: list[dict], lang: str) -> list[dict]:
    """Senaryodaki sahne efektleri: visual.sfx = [{ word | atMs, file, gainDb, durMs?, nth?, offsetMs?, untilWord?, untilNth?,
    untilOffsetMs?, wordEdge?, untilEdge? }] (edge: "start" | "end": kelimenin başı ya da sonu). word: o kelimenin (senaryo yazımıyla, nth. geçişi; varsayılan 1) startMs'i; atMs: sahne başından ms.
    untilWord (2026-11-08, sound-design §5): efekt o kelimenin başında + untilOffsetMs'te biter (durMs hesaplanır); dil sürümleri
    arasında kelime zamanı değişse de "baltadan 0,3 sn önce sus" gibi kurallar korunur. Sahne içi ms döndürür."""
    def word_ms(word, nth, edge="start"):
        key = norm_token(str(word), lang)
        hits = [w for w in words if norm_token(w["text"], lang) == key]
        if len(hits) < nth:
            raise SystemExit(f"{sc_script['id']}: sfx kelimesi bulunamadı: {word!r} (nth={nth})")
        return hits[nth - 1]["endMs" if edge == "end" else "startMs"]

    out = []
    for e in (sc_script.get("visual") or {}).get("sfx") or []:
        if "word" in e:
            at = word_ms(e["word"], int(e.get("nth", 1)), e.get("wordEdge", "start"))
            label = f"{sc_script['id']} '{e['word']}'"
        elif "atMs" in e:
            at = float(e["atMs"])
            label = f"{sc_script['id']} @{at:.0f} ms"
        else:
            raise SystemExit(f"{sc_script['id']}: sfx olayında word ya da atMs yok: {e}")
        hit = 0 if e.get("align") == "start" or any(k in e["file"] for k in BED_LIKE) else sfx_hit_ms(e["file"])   # vuruş kelimeye denk gelsin (offsetMs vuruşa göre)
        start = at + float(e.get("offsetMs", 0)) - hit
        dur = e.get("durMs")
        if "untilWord" in e:
            end = word_ms(e["untilWord"], int(e.get("untilNth", 1)), e.get("untilEdge", "start")) + float(e.get("untilOffsetMs", 0))
            dur = max(60.0, end - start)
            label += f" → '{e['untilWord']}'"
        if hit and dur and "untilWord" not in e:
            dur = float(dur) + hit   # süre vuruştan sonra aynı kalsın
        if hit >= 60:
            label += f" (vuruş −{hit} ms)"
        out.append({"ms": start, "file": e["file"], "gainDb": float(e.get("gainDb", -22)),
                    "durMs": dur, "fadeMs": e.get("fadeMs"), "note": label})
    return out


def place_sfx(scenes: list[dict], lang: str, scene_sfx: dict[str, list[dict]], transition_default: str, gain_offset: float = 0,
              auto: bool = True, bed: bool = True, total_frames: int = 0) -> list[dict]:
    """Efekt yerleşimi (ölçülü): stil değişen kesmede geçiş sesi (TRANSITION_SFX; bölüm/sahne bazında seçilir),
    kinetic-type'ta vurgulu kelimelerde pop, hero kelimede impact (tools/sfx.py), senaryodaki sahne efektleri (doğal foley)."""
    ev = []
    for i, sc in enumerate(scenes):
        kind = sc.get("_transition_sfx") or transition_default
        if kind not in TRANSITION_SFX:
            raise SystemExit(f"{sc['id']}: transition_sfx bilinmiyor: {kind} ({', '.join(TRANSITION_SFX)})")
        if i and sc.get("_transition_layers") is not None:   # sahne bazında kendi seti (sound-design §3: art arda aynı set yok)
            for file, gain, lead in sc["_transition_layers"]:
                ev.append(sfx_event(sc["startFrame"] - lead, file, gain, note=f"{sc['id']} geçiş (özel)"))
        elif i and sc["transition"] in ADV_SFX and kind != "none":   # nesne geçişi: kendi katmanlı sesi (whoosh tepe kesmede, iniş vuruşu)
            for file, gain, lead in ADV_SFX[sc["transition"]]:
                ev.append(sfx_event(sc["startFrame"] - lead, file, gain, note=f"{sc['id']} geçiş ({sc['transition']})"))
        elif i and kind == "layered":
            grp = "cut" if sc["transition"] == "cut" else LAYER_GROUP.get(sc["style"], "photo")
            for file, gain, lead in LAYERED[grp]:
                lead_f = wav_frames(file) if lead == "end" else lead
                ev.append(sfx_event(sc["startFrame"] - lead_f, file, gain, note=f"{sc['id']} geçiş ({grp})"))
        elif i and sc["transition"] != "cut":
            t = TRANSITION_SFX[kind]
            if t:
                ev.append(sfx_event(sc["startFrame"] - t["lead"], t["file"], t["gainDb"], note=f"{sc['id']} geçiş ({kind})"))
        if sc["style"] == "kinetic-type":
            hero = str(sc["props"].get("hero", "")).lower()
            for w in sc["words"][lang]:
                f = sc["startFrame"] + round(w["startMs"] / 1000 * FPS)
                if hero and w["text"].lower() == hero:
                    ev.append(sfx_event(f, "sfx/impact.wav", -12))
                elif w.get("emphasis"):
                    ev.append(sfx_event(f, "sfx/pop.wav", -20))
        for e in scene_sfx.get(sc["id"], []):
            f = sc["startFrame"] + round(e["ms"] / 1000 * FPS)
            ev.append(sfx_event(f, e["file"], e["gainDb"], e.get("durMs"), e["note"], e.get("fadeMs")))
        if auto:
            last: dict[str, float] = {}
            for ms, kind_ in sorted(auto_layer_sfx(sc, lang)):
                if ms - last.get(kind_, -1e9) < 120:
                    continue
                last[kind_] = ms
                files, gain = AUTO_SFX[kind_]
                n = sum(1 for e in ev if e.get("note", "").startswith(f"auto {kind_}"))
                file = files[n % len(files)]   # sırayla: aynı dosya art arda çalmaz (birden çok dosya varsa)
                dur = 260 if kind_ in ("key", "tick") else None
                ev.append(sfx_event(sc["startFrame"] + round(ms / 1000 * FPS), file,
                                    gain + (round(((n * 37) % 9 - 4) * 0.4, 1) if kind_ == "key" else 0), dur, f"auto {kind_} {sc['id']}"))
    if bed and total_frames:   # oda tonu yatağı: dosya kareyi kaplayana kadar arka arkaya
        file, gain = BED_SFX
        L = wav_frames(file)
        for f0 in range(0, total_frames, L):
            ev.append(sfx_event(f0, file, gain, (min(L, total_frames - f0)) / FPS * 1000, "bed"))
    for e in ev:  # senaryo üst düzey sfx_gain_db: bütün efektlere ortak ofset (efektler müziğe göre öne çıksın)
        e["gainDb"] = round(e["gainDb"] + gain_offset, 1)
    return sorted(ev, key=lambda e: e["frame"])


# ---------- EN altyazıda sayılar rakamla (kullanıcı isteği 2026-11-09: "tarihleri sayıyla yaz") ----------
# Ses yazıyla okunur (TTS); yalnız altyazı rakama çevrilir. Birleşen kelimeler ilk kelimenin başından son kelimenin sonuna sürer.
_ONES = {"zero": 0, "oh": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9}
_TEENS = {"ten": 10, "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15, "sixteen": 16, "seventeen": 17,
          "eighteen": 18, "nineteen": 19}
_TENS = {"twenty": 20, "thirty": 30, "forty": 40, "fifty": 50, "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90}
_TENS_PL = {"twenties": 20, "thirties": 30, "forties": 40, "fifties": 50, "sixties": 60, "seventies": 70, "eighties": 80, "nineties": 90}


def _num_tokens(words, i):
    """i'den başlayan sayı öbeğini çözer → (değer metni, son indeks) ya da None. Tek başına küçük sayı (one..nine, ten) dokunulmaz."""
    def tok(k):
        return re.sub(r"[^a-z]", "", words[k]["text"].lower()) if k < len(words) else ""
    def two(k):   # 0-99: "forty six", "fifteen", "nine"
        a = tok(k)
        if a in _TENS:
            b = tok(k + 1)
            return (_TENS[a] + _ONES[b], k + 1) if b in _ONES and b not in ("zero", "oh") else (_TENS[a], k)
        if a in _TEENS: return (_TEENS[a], k)
        if a in _ONES: return (_ONES[a], k)
        return None
    a = tok(i)
    # yıl: on yüzyıl (seventeen..nineteen / "twenty" + iki basamak) + iki basamak ya da "hundreds" / on yıl çoğulu
    if a in ("seventeen", "eighteen", "nineteen") or (a == "twenty" and tok(i + 1) in _TENS | _TEENS):
        c = _TEENS.get(a) or 20
        b = tok(i + 1)
        if b == "hundreds": return f"{c}00s", i + 1
        if b in _TENS_PL: return f"{c}{_TENS_PL[b]}s", i + 1
        if b in _TENS:
            d = tok(i + 2)
            if d in _TENS_PL: pass
            if d in _ONES and d not in ("zero", "oh"): return f"{c}{_TENS[b] + _ONES[d]:02d}", i + 2
            return f"{c}{_TENS[b]:02d}", i + 1
        if b in _TEENS: return f"{c}{_TEENS[b]}", i + 1
        if b == "oh" and tok(i + 2) in _ONES: return f"{c}0{_ONES[tok(i + 2)]}", i + 2
    r = two(i)
    if not r: return None
    v, j = r
    if tok(j + 1) == "point" and tok(j + 2) in _ONES:          # one point three → 1.3
        return f"{v}.{_ONES[tok(j + 2)]}", j + 2
    if tok(j + 1) == "hundred":
        v, j = v * 100, j + 1
        r2 = two(j + 1) if tok(j + 1) not in ("thousand",) else None
        if r2 and tok(j + 1) != "and": v, j = v + r2[0], r2[1]
    if tok(j + 1) == "thousand":
        v, j = v * 1000, j + 1
    if v < 10 and j == i: return None                          # "one", "two": metin olarak kalır
    if v == 10 and j == i: return None
    return (f"{v:,}" if v >= 10000 else str(v)), j


def numberize_caption(words: list[dict]) -> list[dict]:
    out, i = [], 0
    while i < len(words):
        r = _num_tokens(words, i)
        if r:
            txt, j = r
            tail = re.sub(r"^.*?([^A-Za-z']*)$", r"\1", words[j]["text"])     # son kelimenin noktalaması (",", ".")
            lead = re.match(r"^([^A-Za-z']*)", words[i]["text"]).group(1)
            out.append({**words[i], "text": lead + txt + tail, "endMs": words[j]["endMs"]})
            i = j + 1
        else:
            out.append(words[i]); i += 1
    return out


def apply_caption_overrides(words: list[dict], overrides: dict[str, str], lang: str) -> tuple[list[dict], list[str]]:
    """Ekran/SRT metni eşlemesi: konuşulan kelime dizisi tek bir görüntü kelimesiyle değiştirilir; ses metni değişmez.
    ör. {"eighteen eighty six": "1886"} → "1886." tek kelime, üç kelimenin zaman aralığını kaplar (QA EP002 P1).
    Noktalama kaynaktan korunur (ilk kelimenin baş, son kelimenin son noktalaması)."""
    import re
    applied = []
    for key, shown in (overrides or {}).items():
        ktoks = [norm_token(t, lang) for t in key.split()]
        n = len(ktoks)
        i, hit = 0, False
        while i + n <= len(words):
            if [norm_token(w["text"], lang) for w in words[i:i + n]] == ktoks:
                seg = words[i:i + n]
                lead = re.match(r"^\W*", seg[0]["text"]).group(0)
                trail = re.search(r"\W*$", seg[-1]["text"]).group(0)
                merged = {"text": f"{lead}{shown}{trail}", "startMs": seg[0]["startMs"], "endMs": seg[-1]["endMs"]}
                if any(w.get("emphasis") for w in seg):
                    merged["emphasis"] = True
                words = words[:i] + [merged] + words[i + n:]
                hit = True
            i += 1
        if not hit:
            raise SystemExit(f"caption_overrides: {key!r} sahne metninde bulunamadı")
        applied.append(f"{key} → {shown}")
    return words, applied


def pick_music(choice: str, emotions: list[str], total_frames: int, narration_lufs: float) -> dict | None:
    """content/music/music.yaml'dan parça seçer. auto: baskın duyguyla eşleşen ilk yayınlanabilir parça (test_only hariç)."""
    if choice == "none":
        return None
    cat = yaml.safe_load((ROOT / "content" / "music" / "music.yaml").read_text()) or {}
    tracks = cat.get("tracks") or []
    if choice == "auto":
        dominant = max(set(emotions), key=emotions.count)
        cands = [t for t in tracks if not t.get("test_only") and dominant in (t.get("moods") or [])]
        cands = cands or [t for t in tracks if not t.get("test_only")]
        if not cands:
            return None
        t = cands[0]
    else:
        t = next((t for t in tracks if t["id"] == choice), None)
        if not t:
            raise SystemExit(f"müzik bulunamadı: {choice} (content/music/music.yaml)")
    path = (ROOT / "content" / "music" / t["file"]).resolve()
    if not path.exists():
        raise SystemExit(f"müzik dosyası yok: {path}")
    # Seviye ölçülerek ayarlanır (PLAN 8.5): konuşurken müzik anlatımın 24 dB altında, aralarda 14 dB altında.
    # music.yaml gain_db isteğe bağlı ek ofset (varsayılan 0).
    music_lufs = lufs(path)
    base = (narration_lufs - MUSIC_GAP_DB) - music_lufs + t.get("gain_db_offset", 0)
    # under_voice_db (music.yaml, isteğe bağlı): konuşurken anlatımın kaç dB altında (varsayılan 14). Hüzünlü/yavaş parça öne çıkmasın diye artırılır.
    under = t.get("under_voice_db", MUSIC_UNDER_VOICE_DB)
    return {"file": str(path.relative_to(ROOT / "content")), "gainDb": round(base, 1), "duckDb": -(under - MUSIC_GAP_DB),
            "fadeInFrames": FPS, "fadeOutFrames": round(1.5 * FPS), "measured": {"music_lufs": music_lufs, "narration_lufs": narration_lufs},
            "_steady": bool(t.get("steady"))}


MUSIC_UNDER_VOICE_DB = 24.0   # 2026-11-01 kullanıcı: "müziği kısman lazım" (EP003, EP004 iki kez; 3 dB yetmedi) → 14 → 24
MUSIC_GAP_DB = 14.0           # aralarda anlatımın 14 dB altında (8 → 14)


def lufs(path: Path) -> float:
    import re
    import subprocess
    p = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(path), "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True, check=True)
    return float(re.search(r"I:\s+(-?[\d.]+) LUFS", p.stderr[p.stderr.rindex("Summary:"):]).group(1))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("episode")
    ap.add_argument("--lang", default=None)
    ap.add_argument("--music", default="auto", help="auto | none | music.yaml'daki id (test için: test_bed)")
    args = ap.parse_args()
    ep = Path(args.episode).resolve()
    brief = yaml.safe_load((ep / "brief.yaml").read_text())
    from channel import load_channel
    channel = load_channel(ep)
    lang = args.lang or (brief["lang"] if brief["lang"] != "both" else channel["languages"]["primary"])
    script = json.loads((ep / f"script.{lang}.json").read_text())
    report = json.loads((ep / "audio" / lang / "report.json").read_text())
    rep_by_id = {s["id"]: s for s in report["scenes"]}
    fmt = channel["formats"][brief.get("format", "short")]
    rel = lambda p: str(p.relative_to(ROOT / "content"))  # noqa: E731

    scenes, frame, scene_sfx = [], 0, {}
    transition_sfx = script.get("transition_sfx", "whoosh")
    intro = script.get("intro")
    for i, sc in enumerate(script["scenes"]):
        r = rep_by_id[sc["id"]]
        take = next(t for t in r["takes"] if t["take"] == r["chosen"])
        words, match = align(sc["text"], take["words"], lang)
        shift = fix_first_word(words, speech_onset_ms(ep / "audio" / lang / f"{sc['id']}.wav"))
        if shift:
            print(f"[fix] {sc['id']}: ilk kelime gerçek ses başlangıcına kaydırıldı (+{shift} ms)")
        audio_path, pause_ms = ep / "audio" / lang / f"{sc['id']}.wav", 0
        pauses = list(sc.get("pauses") or [])
        spm = sc.get("sentence_pause_ms", script.get("sentence_pause_ms"))   # sahne düzeyinde 0 = kapalı (anlatıcı neredeyse durmuyorsa
        if spm and not sc.get("speaker"):   # kesim sözcüğün kuyruğuna düşer, "s" tekrar ediyor gibi duyulur: EP009 s49 "Take Otis.")
            have = {p.get("afterWord") for p in pauses}
            pauses += [{"index": k, "afterWord": w["text"], "ms": int(spm)}
                       for k, w in enumerate(words[:-1]) if re.search(r"[.!?]$", w["text"]) and w["text"] not in have]
        if pauses:
            audio_path, pause_ms = apply_pauses(ep, lang, sc["id"], words, pauses)
        # lead: anlatımdan önce sessiz pay. İlk sahnede script.intro (soğuk açılış), diğerlerinde sahnenin `lead`'i
        # ({ms, sfx}; bölüm başlığı anlatıcı susarken: kullanıcı 2026-11-09 "anlatıcı susup part yazısı çıkıp sonra o parta geçilsin")
        lead_cfg = intro if (i == 0 and intro) else sc.get("lead")
        lead_ms = int(lead_cfg["ms"]) if lead_cfg else 0
        if lead_ms:  # intro: anlatım lead_ms sonra başlar, kelimeler ve kelimeye bağlı efektler de kayar
            for w in words:
                w["startMs"] += lead_ms
                w["endMs"] += lead_ms
        emph = {norm_token(e, lang) for e in sc.get("visual", {}).get("emphasis", [])}
        for w in words:
            if norm_token(w["text"], lang) in emph:
                w["emphasis"] = True
        scene_sfx[sc["id"]] = resolve_scene_sfx(sc, words, lang)   # kelime anları konuşulan metne göre
        props_w = resolve_word_times(sc.get("visual", {}).get("props", {}), words, lang, sc["id"], lead_ms)
        if lead_ms:
            scene_sfx[sc["id"]] += [{"ms": float(e["atMs"]), "file": e["file"], "gainDb": float(e.get("gainDb", -12)),
                                     "durMs": e.get("durMs"), "note": f"lead @{e['atMs']} ms"} for e in lead_cfg.get("sfx", [])]
        cue_words = [dict(w) for w in words]   # konuşulan yazım (sayılar yazıyla): Manim/woodcut ipuçları bunu kullanır
        if lang == "en" and script.get("caption_numbers", True):
            words = numberize_caption(words)
        words, applied = apply_caption_overrides(words, sc.get("caption_overrides") or {}, lang)
        for a in applied:
            print(f"[caption] {sc['id']}: {a}")
        last = i == len(script["scenes"]) - 1
        lead_frames = round(lead_ms / 1000 * FPS)
        gap = script.get("scene_gap_s", SCENE_GAP_S)   # uzun video: 0.6 (cinecode writing.md §5 "0.6 s between lines")
        dur = round((take["audio_s"] + (TAIL_S if last else gap) + (pause_ms + sc.get("tail_ms", 0)) / 1000) * FPS) + lead_frames
        if last and script.get("outro"):  # outro: son sözden sonra görüntü (ve müzik) hold_ms daha sürer, sonra siyaha kararır
            dur += round(script["outro"]["hold_ms"] / 1000 * FPS)
        v = sc.get("visual", {})
        props = intro_props(props_w, lead_cfg, lead_ms) if lead_ms else props_w
        props = expand_elements(props)
        scenes.append({
            "id": sc["id"], "startFrame": frame, "durationFrames": dur,
            "audio": {lang: rel(audio_path)},
            "words": {lang: words}, "cueWords": {lang: cue_words}, "text": {lang: sc["text"]},
            "emotion": sc["emotion"], "style": v.get("style", "blueprint-diagram"), "props": props,
            "transition": split_transition(v.get("transition"))[0] or default_transition(scenes, v.get("style", "blueprint-diagram")),
            **({"transitionOpts": split_transition(v.get("transition"))[1]} if split_transition(v.get("transition"))[1] else {}),
            "align_ratio": round(match, 3),
            **({"audioStartFrame": lead_frames} if lead_frames else {}),
            "_transition_sfx": v.get("transition_sfx"),
            "_transition_layers": v.get("transition_layers"),   # [[dosya, dB, lead kare], ...]; [] = geçiş sesi yok
        })
        frame += dur
        if match < 0.8:
            print(f"[warn] {sc['id']}: senaryo↔Whisper hizalama oranı düşük ({match:.2f}); altyazı zamanlarını kontrol et")

    for sc in scenes:  # fotoğraf stilleri: görsel boyutları (PhotoMotion piksel altı hareket için)
        imgs = [sc["props"].get("image")] + [c.get("image") for c in sc["props"].get("cuts", [])] + [(sc["props"].get("compare") or {}).get("image")]
        sizes = {im: image_size(im) for im in imgs if isinstance(im, str) and im}
        if sizes:
            sc["props"] = {**sc["props"], "imageSizes": sizes}

    for sc in scenes:  # sahne içi kesme ritmi (EP005 s08: 0.6 sn'de bir 4 sert kesme "geçiş gibi bile değil")
        ats = [c["atMs"] for c in sc["props"].get("cuts", []) if c.get("image")]
        if any(b - a < 3000 for a, b in zip(ats, ats[1:])):
            print(f"[warn] {sc['id']}: görsel değişen kesmeler 3 sn'den sık ({ats}); çekim sayısını azalt")

    music = pick_music(args.music, [s["emotion"] for s in scenes], frame, lufs(ep / "audio" / lang / "narration.wav"))
    if music and script.get("music_after"):  # müzik bu sahnenin son sözünden sonra başlar (EP007: "All safe" sonrası)
        sc = next(s for s in scenes if s["id"] == script["music_after"])
        music["startFrame"] = sc["startFrame"] + round(sc["words"][lang][-1]["endMs"] / 1000 * FPS)

    timeline = {
        "episode": script["episode"], "lang": lang, "fps": FPS, "width": fmt["width"], "height": fmt["height"],
        "durationInFrames": frame,
        "theme": {**channel["brand"]["colors"], "font": channel["brand"]["font"]},
        "captions": {"style": script.get("captions") or brief.get("captions") or channel["styles"].get("captions", "cap-karaoke"), "lang": lang},   # bölüm bazında: script/brief "captions" (ör. cap-print), yoksa kanal varsayılanı
        "scenes": scenes,
        "music": music,
        "sfx": place_sfx(scenes, lang, scene_sfx, transition_sfx, float(script.get("sfx_gain_db", 0)),
                         auto=script.get("auto_sfx", True), bed=script.get("sfx_bed", "room") != "none" and any(s["style"] == "vox-explainer" for s in scenes),
                         total_frames=frame),
    }
    for i, sc in enumerate(scenes):   # elem:<id> hedefleri (portal/cardflip: giden sahne · pullback frame: gelen sahne)
        o = sc.get("transitionOpts") or {}
        for key, src in (("target", scenes[i - 1] if i else None), ("frame", sc)):
            if isinstance(o.get(key), str) and o[key].startswith("elem:") and src:
                eid = o[key][5:]
                o[key] = element_target(src["props"], eid, fmt["width"], fmt["height"])
                o.setdefault("shape", load_element(eid).get("shape", "rect"))
                o["elem"] = True
    if script.get("finish"):   # bitiş katmanı: kenar bulanıklığı, film tozu, vinyet (toz ritmi anim_fps'e uyar)
        timeline["finish"] = {**({"fps": int(script["anim_fps"])} if script.get("anim_fps") else {}), **script["finish"]}
    anim = script.get("anim_fps")
    if anim:   # bölüm geneli basamak: vox stop-motion ve geçiş pencereleri aynı ritme (iki ritim çakışmasın)
        timeline["animFps"] = int(anim)
        for sc in scenes:
            if sc["props"].get("stepFps"):
                sc["props"] = {**sc["props"], "stepFps": int(anim)}
            if sc["transition"] in ADV_SFX:
                sc["transitionOpts"] = {"fps": int(anim), **(sc.get("transitionOpts") or {})}
    if script.get("outro"):
        fade = round(script["outro"].get("fade_ms", 2500) / 1000 * FPS)
        timeline["outro"] = {"fadeFromFrame": frame - fade - round(script["outro"].get("black_ms", 500) / 1000 * FPS), "fadeFrames": fade}
    if timeline["music"] and timeline["music"].pop("_steady", False):  # müzik konuşma bitene kadar sabit (aralarda yükselmez)
        last_end = max(sc["startFrame"] + round((sc["words"][lang][-1]["endMs"] + 300) / 1000 * FPS) for sc in scenes)
        timeline["music"]["steadyUntilFrame"] = last_end
    for sc in scenes:
        sc.pop("_transition_sfx", None)
        sc.pop("_transition_layers", None)
    if timeline["music"]:
        m = timeline["music"]; print(f"[music] {m['file']}: kazanç {m['gainDb']} dB, konuşurken ek {m['duckDb']} dB (müzik {m['measured']['music_lufs']} / anlatım {m['measured']['narration_lufs']} LUFS)")
    else:
        print("[music] yok (content/music/music.yaml'da uygun parça yok ya da --music none)")
    print(f"[sfx] {len(timeline['sfx'])} olay (geçiş sesi: {transition_sfx})")
    for e in timeline["sfx"]:
        if e.get("note", "").startswith(("auto key", "auto tick")):
            continue
        print(f"      kare {e['frame']:>5} · {e['file']} · {e['gainDb']} dB · {e['durationFrames']} kare" + (f" · {e['note']}" if e.get("note") else ""))
    # stüdyo editörü ayarları (editor.overrides.json) en son uygulanır: yeniden kurulumda kaybolmasın (docs/editor/DESIGN.md §4)
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from editor_overrides import apply as apply_editor
    for b in apply_editor(ep, timeline):
        print(f"[uyarı] editör ayarı uygulanamadı: {b}")
    (ep / "timeline.json").write_text(json.dumps(timeline, ensure_ascii=False, indent=2))
    print(f"[done] {ep / 'timeline.json'}: {len(scenes)} sahne, {frame} kare ({frame / FPS:.1f} sn)")


if __name__ == "__main__":
    main()
