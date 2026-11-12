"""Sözleşme doğrulayıcı (PLAN 4): brief.yaml ve script.<dil>.json.

Ajanlar dosya yazdıktan sonra çalıştırır; hata varsa düzeltir. Çıkış kodu: 0 = geçti, 1 = hata.
Kullanım:
  voice/.venv-chatterbox/bin/python tools/validate.py brief  content/episodes/EP001-segmentation/brief.yaml
  voice/.venv-chatterbox/bin/python tools/validate.py script content/episodes/EP001-segmentation/script.en.json
  voice/.venv-chatterbox/bin/python tools/validate.py timeline content/episodes/EP008-bohlin-seat-belt/timeline.json  (ses vurgu bütçesi)
"""
import json
import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).parent.parent

# Ölçülen konuşma hızları (DECISIONS.md): narrator_v2 EN ≈ 2.9 kelime/sn; TR Multilingual ≈ 2.2 (daha uzun kelimeler)
WORDS_PER_SEC = {"en": 2.8, "tr": 2.2}
SCENE_GAP_S = 0.35
TURBO_TAGS = {"[laugh]", "[chuckle]", "[cough]", "[sigh]", "[gasp]", "[groan]", "[sniff]", "[shush]", "[clear throat]", "[yawn]"}


def load_yaml(p):
    return yaml.safe_load(Path(p).read_text())


class Report:
    def __init__(self):
        self.errors, self.warnings = [], []

    def err(self, m): self.errors.append(m)
    def warn(self, m): self.warnings.append(m)

    def done(self, what):
        for w in self.warnings:
            print(f"  UYARI: {w}")
        for e in self.errors:
            print(f"  HATA:  {e}")
        print(f"[{'GEÇTİ' if not self.errors else 'KALDI'}] {what} ({len(self.errors)} hata, {len(self.warnings)} uyarı)")
        return 0 if not self.errors else 1


def check_brief(path: Path) -> int:
    r, b = Report(), load_yaml(path)
    sys.path.insert(0, str(ROOT / "tools"))
    from channel import load_channel
    channel = load_channel(Path(path).parent)
    styles = load_yaml(ROOT / "catalog" / "styles.yaml")["styles"]
    for k in ["episode", "lang", "format", "target_seconds", "style", "voice"]:
        if k not in b:
            r.err(f"eksik alan: {k}")
    sid = b.get("source_id") or b.get("principle_id")   # principle_id: eski ad (TRIZ kanalı)
    if not (sid or b.get("topic")):
        r.err("konu yok: source_id ya da topic gerekli")
    if sid:
        sources = channel.get("content_sources") or {}
        ser = next((s for s in channel.get("series") or [] if s.get("id") == b.get("series")), {})
        key = ser.get("source") or next(iter(sources), None)
        src = ROOT / sources[key] if key else None
        if not src or not list(src.glob(f"{sid}-*.yaml")):
            r.err(f"kaynak kaydı yok: {src}/{sid}-*.yaml")
    if b.get("lang") not in {"tr", "en", "both"}:
        r.err("lang: tr | en | both")
    else:
        active = channel["languages"].get("active", [])
        need = [l for l in (["tr", "en"] if b["lang"] == "both" else [b["lang"]]) if l not in active]
        if need:
            r.warn(f"{', '.join(need)} kanal ayarında aktif değil (channel.yaml languages.active)")
    fmt = channel["formats"].get(b.get("format"))
    if not fmt:
        r.err(f"format bilinmiyor: {b.get('format')} ({', '.join(channel['formats'])})")
    elif not fmt.get("min_seconds", 0) <= b.get("target_seconds", 0) <= fmt.get("max_seconds", 10**6):
        r.err(f"target_seconds {b.get('target_seconds')} format sınırları dışında ({fmt.get('min_seconds')}-{fmt.get('max_seconds')})")
    if b.get("style") != "auto" and b.get("style") not in styles:
        r.err(f"style bilinmiyor: {b.get('style')} (auto ya da catalog/styles.yaml)")
    if b.get("style_mode", "lang_neutral") not in {"lang_neutral", "lang_specific"}:
        r.err("style_mode: lang_neutral | lang_specific")
    v = str(b.get("voice", "")).split("#")[0].strip()
    if v and not (ROOT / "voice" / "profiles" / f"{v}.yaml").exists():
        r.err(f"ses profili yok: voice/profiles/{v}.yaml")
    return r.done(f"brief {path}")


TRANSITION_SFX = {"whoosh", "paper", "swoosh", "layered", "none"}   # tools/build_timeline.py TRANSITION_SFX ile aynı


def _tok(t: str) -> str:
    return re.sub(r"[^\w']+", "", t.lower())


def _has_seq(text: str, phrase: str) -> int:
    toks, k = [_tok(t) for t in text.split()], [_tok(t) for t in phrase.split()]
    return sum(toks[i:i + len(k)] == k for i in range(len(toks) - len(k) + 1)) if k else 0


def check_caption_overrides(r, sid: str, text: str, ov):
    """scenes[].caption_overrides: {"konuşulan kelimeler": "ekran metni"} (ör. yıllar rakamla). Ses metni (text) değişmez."""
    if ov is None:
        return
    if not isinstance(ov, dict):
        return r.err(f"{sid}: caption_overrides bir sözlük olmalı ({{\"eighteen eighty six\": \"1886\"}})")
    for k, v in ov.items():
        if not isinstance(v, str) or not v.strip():
            r.err(f"{sid}: caption_overrides[{k!r}] boş")
        elif not _has_seq(text, k):
            r.err(f"{sid}: caption_overrides anahtarı metinde yok: {k!r}")
        elif " " in v.strip():
            r.warn(f"{sid}: caption_overrides[{k!r}] = {v!r} birden çok kelime; karaoke vurgusu tek parça olur")


TRANSITIONS = {"cut", "zoom", "wipe", "flash", "blur", "portal", "pullback", "cardflip", "zoomblur", "whip", "leak", "rgb", "halftoneWipe", "fog", "slide", "objectWipe", "matte", "surfaceTilt", "disc", "door", "window"}


def check_scene_sfx(r, sid: str, text: str, visual: dict):
    """visual.sfx: [{ word | atMs, file (content/ köküne göre), gainDb, durMs?, nth?, offsetMs? }] · visual.transition_sfx · visual.transition."""
    tr = visual.get("transition")
    tt = tr.get("type") if isinstance(tr, dict) else tr
    if tt is not None and tt not in TRANSITIONS:
        r.err(f"{sid}: visual.transition '{tt}' ({' | '.join(sorted(TRANSITIONS))})")
    if isinstance(tr, dict):
        for k in ("target", "frame"):
            b = tr.get(k)
            if isinstance(b, str) and b.startswith("elem:"):
                if not (ROOT / "content" / "assets" / "elements" / f"{b[5:]}.yaml").exists():
                    r.err(f"{sid}: visual.transition.{k} {b}: content/assets/elements/{b[5:]}.yaml yok")
            elif b is not None and not (isinstance(b, dict) and all(isinstance(b.get(c), (int, float)) for c in "xywh")):
                r.err(f"{sid}: visual.transition.{k} {{x, y, w, h}} (kare 0-1) ya da \"elem:<id>\" olmalı")
        if tt == "portal" and not tr.get("target"):
            r.warn(f"{sid}: portal için target yok; varsayılan kutu (ekran ortası) kullanılır")
        if tt == "pullback" and not tr.get("frame"):
            r.warn(f"{sid}: pullback için frame yok; varsayılan çerçeve kullanılır")
    ts = visual.get("transition_sfx")
    if ts is not None and ts not in TRANSITION_SFX:
        r.err(f"{sid}: visual.transition_sfx '{ts}' ({' | '.join(sorted(TRANSITION_SFX))})")
    for e in visual.get("sfx") or []:
        if not isinstance(e, dict) or not e.get("file"):
            r.err(f"{sid}: visual.sfx olayında file yok: {e}")
            continue
        if not (ROOT / "content" / e["file"]).exists():
            r.err(f"{sid}: sfx dosyası yok: content/{e['file']}")
        if "word" in e:
            if _has_seq(text, str(e["word"])) < int(e.get("nth", 1)):
                r.err(f"{sid}: sfx kelimesi metinde yok: {e['word']!r}")
        elif not isinstance(e.get("atMs"), (int, float)):
            r.err(f"{sid}: sfx olayı word ya da atMs ister")
        g = e.get("gainDb", -22)
        if not isinstance(g, (int, float)) or not -40 <= g <= -6:
            r.err(f"{sid}: sfx gainDb {g} (-40…-6 dB)")
        elif g > -8:  # EP002 geri bildirimi (2026-10-25): -18…-26 duyulmuyordu; -10…-12 iyi
            r.warn(f"{sid}: sfx gainDb {g} yüksek; anlatımın altında kalmalı (doğal foley ≈ -10…-16)")
        if "durMs" in e and not (isinstance(e["durMs"], (int, float)) and e["durMs"] > 0):
            r.err(f"{sid}: sfx durMs pozitif sayı olmalı")
        f = e["file"]
        if f.startswith(("sfx/natural/", "sfx/pixabay/")):
            src = ROOT / "content" / Path(f).parent / "sources.csv"
            if not src.exists() or Path(f).name not in src.read_text():
                r.err(f"{sid}: doğal efekt sources.csv'de kayıtlı değil: {f}")


# Yapay ton (script-writer "Yapay ton"; cinecode writing.md §6 + words_check.py, MIT). Uyarıdır: alıntı/isim bilinçli kalabilir.
# TR kalıpları kökle yazılır ("fısıld" → fısıldıyor/fısıldayan).
TELLS = {
    "tr": [r"\bbir dünyada\b", r"\byolculu[ğk]", r"\bhabersizdi", r"\bya .{1,40} olsaydı\b", r"\bsadece bir .{1,30} değil",
           r"\bher an değerli", r"\btüm zorluklara rağmen", r"\bgerisi tarih", r"\bhiçbir şey eskisi gibi olmayacaktı",
           r"\bve sonra her şey değişti", r"\bkesin olan bir şey var", r"\bzamanın ötesinde", r"\bzamansız", r"\bunutulmaz",
           r"\basıl mesele", r"\bözünde\b", r"\bişte tam da bu noktada", r"\bgelin birlikte", r"\bpeki ya\b", r"\bhayal edin",
           r"\badeta\b", r"\bbüyüleyici", r"\beşsiz", r"\bnefes kesici", r"\bfısıld", r"\bdans ed", r"\bkalbinde\b",
           r"\bmeydan okuyan", r"\bkaçırma\b", r"\bhemen keşfet", r"\bfark yarat"],
    "en": [r"\bin a world where", r"\bjourney\b", r"\blittle did (they|he|she|we) know", r"\bwhat if\b", r"\bmore than just\b",
           r"\bevery moment counts", r"\bagainst all odds", r"\bthe rest is history", r"\bnothing would ever be the same",
           r"\band then everything changed", r"\bone thing is certain", r"\btimeless\b", r"\bbeyond time\b", r"\bunforgettable\b",
           r"\bat its core\b", r"\bhere'?s the thing", r"\bimagine\b", r"\blet'?s\b", r"\bembark", r"\bunlock", r"\bdive into",
           r"\btestament to", r"\btapestry", r"\bvibrant", r"\bpivotal", r"\bseamless", r"\bwhispers?\b", r"\bbreathtaking"],
}
NOT_X_BUT_Y = {"tr": r"\b\w+ değil(?:,| ama| fakat)? (?:bir |o )?\w+", "en": r"\b(?:it'?s |is |was )?not (?:just |only )?\w+,? but\b"}


def check_words(r, sid: str, text: str, lang: str):
    low = text.replace("I", "ı").replace("İ", "i").lower() if lang == "tr" else text.lower()
    hits = [m.group(0) for p in TELLS.get(lang, []) for m in [re.search(p, low)] if m]
    if hits:
        r.warn(f"{sid}: yapay ton/klişe: {', '.join(repr(h) for h in hits)} (script-writer 'Yapay ton')")
    if lang == "en" and re.search(NOT_X_BUT_Y["en"], low):
        r.warn(f"{sid}: 'not X but Y' kalıbı; ikinci yarıyı tek başına söyle")
    if lang == "tr" and re.search(r"\b\w+ değil, \w+", low):
        r.warn(f"{sid}: 'X değil, Y' kalıbı; ikinci yarıyı tek başına söyle")
    if "—" in text or re.search(r"(?<!\d)–(?!\d)|--", text):
        r.warn(f"{sid}: uzun tire; virgül, nokta ya da iki nokta kullan")
    if re.search(r"^\s*\w+, \w+ (?:and|ve) \w+\.\s*$", text.strip(), re.M):
        r.warn(f"{sid}: üçlü liste cümlesi (ör. 'Umut, cesaret ve sevgi.')")


def check_script(path: Path) -> int:
    r, s = Report(), json.loads(Path(path).read_text())
    emotions = load_yaml(ROOT / "catalog" / "emotions.yaml")
    styles = load_yaml(ROOT / "catalog" / "styles.yaml")["styles"]
    lang = s.get("lang")
    for k in ["episode", "lang", "target_seconds", "voice", "scenes"]:
        if k not in s:
            r.err(f"eksik alan: {k}")
    if lang not in WORDS_PER_SEC:
        return r.done(f"script {path} (lang geçersiz)")
    if not (ROOT / "voice" / "profiles" / f"{s.get('voice')}.yaml").exists():
        r.err(f"ses profili yok: {s.get('voice')}")
    ids, total_words = [], 0
    for i, sc in enumerate(s.get("scenes", [])):
        sid = sc.get("id", f"#{i}")
        ids.append(sid)
        if not re.fullmatch(r"s\d{2}[a-z]?", sid):
            r.err(f"{sid}: id biçimi sNN (araya eklenen sahne sNNb) olmalı")
        if sc.get("speaker"):   # diyalog/alıntı sahnesi: anlatıcı susar, karakter sesi konuşur (sound-design §7b)
            if not (ROOT / "voice" / "profiles" / f"{sc['speaker']}.yaml").exists():
                r.err(f"{sid}: speaker profili yok: voice/profiles/{sc['speaker']}.yaml")
            media = load_yaml(ROOT / "catalog" / "voice_media.yaml") or {}
            if sc.get("medium") and sc["medium"] not in media:
                r.err(f"{sid}: medium '{sc['medium']}' catalog/voice_media.yaml'da yok")
            if not sc.get("reenactment_of"):
                r.err(f"{sid}: speaker sahnesi reenactment_of ister (canlandırdığı belgeli olay + kaynak; uydurma olay yok)")
            if len(sc.get("text", "").split()) / WORDS_PER_SEC.get(lang, 2.5) > 6:
                r.warn(f"{sid}: diyalog > 6 sn; 2-5 sn hedef")
        text = sc.get("text", "")
        if not text.strip():
            r.err(f"{sid}: metin boş")
        if sc.get("emotion") not in emotions:
            r.err(f"{sid}: emotion '{sc.get('emotion')}' catalog/emotions.yaml'da yok")
        if not 0 <= sc.get("intensity", 0.5) <= 1:
            r.err(f"{sid}: intensity 0-1 arası olmalı")
        for t in sc.get("tags", []):
            if t not in TURBO_TAGS:
                r.err(f"{sid}: bilinmeyen etiket {t}")
        if sc.get("tags"):
            r.warn(f"{sid}: etiketler yalnızca Chatterbox Turbo'da çalışır; narrator_v2 (Std) yok sayar")
        if re.search(r"\d", text):
            (r.err if lang == "tr" else r.warn)(f"{sid}: metinde rakam var; yazıyla yaz (TR'de zorunlu, R1)")
        sentences = [x for x in re.split(r"(?<=[.!?])\s+", text.strip()) if x]
        if len(sentences) > 3:
            r.warn(f"{sid}: {len(sentences)} cümle; sahne başına ~2 cümle, tek fikir")
        if lang == "tr" and any(len(x.split()) == 1 for x in sentences):
            r.warn(f"{sid}: tek kelimelik cümle var; TR'de yutuluyor (DECISIONS: 'Bölümleme.')")
        words = len(text.split())
        total_words += words
        est = words / WORDS_PER_SEC[lang]
        if sc.get("max_seconds") and est > sc["max_seconds"] * 1.15:
            r.warn(f"{sid}: tahmini {est:.1f} sn > max_seconds {sc['max_seconds']}")
        vstyle = (sc.get("visual") or {}).get("style")
        if vstyle and vstyle != "auto" and vstyle not in styles:
            r.err(f"{sid}: visual.style '{vstyle}' katalogda yok")
        check_words(r, sid, text, lang)
        check_caption_overrides(r, sid, text, sc.get("caption_overrides"))
        check_scene_sfx(r, sid, text, sc.get("visual") or {})
    if len(set(ids)) != len(ids):
        r.err("sahne id'leri tekrar ediyor")
    if s.get("transition_sfx", "whoosh") not in TRANSITION_SFX:
        r.err(f"transition_sfx: {' | '.join(sorted(TRANSITION_SFX))} (build_timeline.TRANSITION_SFX)")
    # QA (EP001): script-writer sözleşmesi üst düzey `sources` ister; doğrulayıcı denetlemiyordu
    srcs = s.get("sources") or []
    if not srcs:
        r.err("sources yok: her olgu için {claim, url, note} (script-writer sözleşmesi)")
    elif any(not (x.get("claim") and (x.get("url") or x.get("note"))) for x in srcs if isinstance(x, dict)):
        r.warn("sources: bazı kayıtlarda claim ya da url/note eksik")
    if ids and ids[0] != "s01":
        r.warn("ilk sahne s01 değil")
    n = len(ids)
    est_total = total_words / WORDS_PER_SEC[lang] + SCENE_GAP_S * max(n - 1, 0)
    tgt = s.get("target_seconds", 0)
    msg = f"tahmini süre {est_total:.1f} sn, hedef {tgt} sn"
    if tgt and abs(est_total - tgt) / tgt > 0.10:
        r.warn(msg + " (±%10 dışında)")
    else:
        print(f"  bilgi: {msg}")
    exclam = sum(sc.get("text", "").count("!") for sc in s.get("scenes", []))
    if exclam > 2:
        r.warn(f"{exclam} ünlem; filmde en çok 2")
    if s.get("target_seconds", 0) >= 300:  # uzun video sözleşmesi (script-writer "Uzun video")
        if not s.get("acts"):
            r.warn("uzun video: üst düzey acts [{id, title, scenes, tempo}] yok")
        else:
            tempos = [a.get("tempo") for a in s["acts"]]
            if any(t not in {"fast", "breath", "hold"} for t in tempos):
                r.warn("acts[].tempo: fast | breath | hold")
            if any(tempos[i] == tempos[i + 1] == tempos[i + 2] for i in range(len(tempos) - 2)):
                r.warn("acts: art arda üç aynı tempo")
        if not s.get("curiosity"):
            r.warn("uzun video: curiosity [{q, opens, pays}] (merak haritası) yok")
        # konuşma yoğunluğu (cinecode writing.md §5, §14): 110-140 kelime/dk (sessizlikler dahil), cümle ≤ 9 kelime, ses de görüntü de dinlenir
        sc_all = s.get("scenes", [])
        words = sum(len(sc.get("text", "").split()) for sc in sc_all)
        total = words / WORDS_PER_SEC[lang] + sum(sc.get("tail_ms", 0) for sc in sc_all) / 1000 \
            + s.get("scene_gap_s", 0.35) * len(sc_all) + (s.get("intro") or {}).get("ms", 0) / 1000 \
            + s.get("sentence_pause_ms", 0) / 1000 * sum(max(0, len(re.findall(r"[.!?](\s|$)", sc.get("text", "").strip())) - 1)
                                                         for sc in sc_all if not sc.get("speaker"))
        wpm = words / (total / 60) if total else 0
        if wpm > 140:
            r.warn(f"uzun video: ~{wpm:.0f} kelime/dk (sessizlikler dahil) > 140; tail_ms/scene_gap_s ile nefes ver ya da metni kıs")
        sents = [x for sc in sc_all for x in re.split(r"(?<=[.!?])\s+", sc.get("text", "").strip()) if x]
        long_share = sum(len(x.split()) > 9 for x in sents) / max(1, len(sents))
        if long_share > 0.5:
            r.warn(f"uzun video: cümlelerin %{long_share * 100:.0f}'i 9 kelimeden uzun; en güçlü cümle çoğu zaman en kısası")
        keys = sum(1 for sc in s.get("scenes", []) if sc.get("key_moment"))
        if not 2 <= keys <= 4:
            r.warn(f"uzun video: key_moment {keys} sahne (2-4 olmalı)")
    return r.done(f"script {path}")


def check_timeline(path: Path) -> int:
    """Ses vurgu bütçesi (sound-design skill §3). Uyarıdır; kanalın tok geçiş tercihi bilinçli aşılabilir."""
    r, t = Report(), json.loads(Path(path).read_text())
    fps, sfx = t["fps"], t.get("sfx", [])
    name = lambda e: e["file"].rsplit("/", 1)[-1].lower()  # noqa: E731
    whoosh = sorted(e["frame"] / fps for e in sfx if re.search(r"whoosh|swoosh|swish", name(e)))
    riser = sorted(e["frame"] / fps for e in sfx if "riser" in name(e))
    for label, times, cap in (("whoosh", whoosh, 2), ("riser", riser, 1)):
        worst = max((sum(1 for x in times if s0 <= x < s0 + 30) for s0 in times), default=0)
        if worst > cap:
            r.warn(f"{label}: bir 30 sn penceresinde {worst} (bütçe {cap}); toplam {len(times)}")
    # geçiş setleri (build_timeline notu "sNN geçiş (tip)")
    sets = {}
    for e in sfx:
        m = re.match(r"(s\d{2}[a-z]?) geçiş", e.get("note") or "")
        if m:
            sets.setdefault(m.group(1), set()).add(name(e))
    order = [sc["id"] for sc in t["scenes"]]
    seq = [(sid, frozenset(sets[sid])) for sid in order if sid in sets]
    for (a, fa), (b, fb) in zip(seq, seq[1:]):
        if fa == fb and order.index(b) == order.index(a) + 1:
            r.warn(f"{a} ve {b}: aynı geçiş sesi seti art arda ({', '.join(sorted(fa))})")
    cuts = max(len(order) - 1, 1)
    share = len(sets) / cuts
    if share > 0.7:
        r.warn(f"tasarım geçiş sesi kesimlerin %{share * 100:.0f}'inde (bütçe %70)")
    print(f"  bilgi: {len(whoosh)} whoosh, {len(riser)} riser, {len(sets)}/{cuts} kesimde geçiş sesi, {t['durationInFrames'] / fps:.0f} sn")
    check_rhythm(r, t)
    return r.done(f"timeline {path}")


def check_rhythm(r, t):
    """Ritim denetimi (cinecode film-mode'dan, 2026-11-09): sahne süreleri çok eşitse film düz akar.
    Uyarı: yayılım (std/ort.) < 0.30 · art arda 5 sahne birbirinin ±%15'inde · uzun videoda her perdenin ortalama sahne süresi birbirine ±%10 yakın.
    Perde sınırı: props.chapter taşıyan sahne (uzun video bölüm başlığı)."""
    fps = t["fps"]
    durs = [(sc["id"], sc["durationFrames"] / fps) for sc in t["scenes"]]
    if len(durs) < 6:
        return
    vals = [d for _, d in durs]
    mean = sum(vals) / len(vals)
    spread = (sum((v - mean) ** 2 for v in vals) / len(vals)) ** 0.5 / mean
    if spread < 0.30:
        r.warn(f"ritim: sahne süresi yayılımı {spread:.2f} (< 0.30); kısa vuruşlar ve uzun bekleyişler karıştır")
    run = 1
    for k in range(1, len(vals)):
        run = run + 1 if abs(vals[k] - vals[k - 1]) <= 0.15 * max(vals[k], vals[k - 1]) else 1
        if run == 5:
            r.warn(f"ritim: {durs[k - 4][0]}-{durs[k][0]} art arda 5 benzer süre (~{vals[k]:.1f} sn)")
    parts, cur = [], []
    for sc in t["scenes"]:
        if (sc.get("props") or {}).get("chapter") and cur:
            parts.append(cur); cur = []
        cur.append(sc["durationFrames"] / fps)
    parts.append(cur)
    if len(parts) >= 3:
        avgs = [sum(p) / len(p) for p in parts]
        if max(avgs) <= 1.1 * min(avgs):
            r.warn(f"ritim: her perdede aynı tempo (ort. sahne {', '.join(f'{a:.1f}' for a in avgs)} sn); bir perde hızlı, biri ağır olsun")
    print(f"  bilgi: ritim yayılımı {spread:.2f}, ort. sahne {mean:.1f} sn" + (f", perde ortalamaları {', '.join(f'{sum(p) / len(p):.1f}' for p in parts)} sn" if len(parts) > 1 else ""))


if __name__ == "__main__":
    kinds = {"brief": check_brief, "script": check_script, "timeline": check_timeline}
    if len(sys.argv) != 3 or sys.argv[1] not in kinds:
        sys.exit(__doc__)
    sys.exit(kinds[sys.argv[1]](Path(sys.argv[2])))
