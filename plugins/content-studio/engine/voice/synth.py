"""Sahne sahne ses üretimi (PLAN 6.2, voice-producer ajanının aracı).

Her sahne için:
  1. Metin hazırlanır (rakam → yazı, telaffuz sözlüğü)          textnorm.py
  2. N deneme üretilir (seed = profil seed + k)                 motor: chatterbox_std | chatterbox_mtl | qwen_base
  3. Profildeki son işlem zinciri uygulanır (gürültü temizleme, ton eşleştirme EQ), sonra temizlik:
     sondaki kopuk ses patlaması kesilir, fade-out, tepe −1 dBFS
  4. Whisper ile okunur (WER), ses kimliği referansla karşılaştırılır (konuşmacı benzerliği);
     kimlik eşiğini geçen denemeler arasından en düşük WER'li seçilir
Sonunda sahneler boşlukla birleştirilip −16 LUFS anlatım dosyası ve rapor yazılır.

Colab (GPU) akışı: orada `--no-asr` ile yalnızca üretilir (ham take'ler), Mac'te `--gate-only` aynı klasördeki ham
take'leri 3-4. adımdan geçirip seçer ve anlatımı yazar (voice/colab/README.md).

Model bir kez yüklenir. Motor hangi venv'deyse o python ile çalıştırılır:
  chatterbox_*: voice/.venv-chatterbox/bin/python voice/synth.py <script.json> --engine chatterbox_std
  qwen_base:    voice/.venv-mlx/bin/python        voice/synth.py <script.json> --engine qwen_base
  voxcpm2_torch: Kaggle T4'te (tools/kaggle_voice.py run <bölüm> --lang tr); Mac'te yalnızca --gate-only
  elevenlabs:   voice/.venv-chatterbox/bin/python voice/synth.py <script.json>   (bulut API; hafif kurulum yeter, .env → ELEVENLABS_API_KEY)
"""
import argparse
import json
import os
import shutil
import subprocess
import time
import wave
from pathlib import Path

import numpy as np
import yaml

import textnorm

ROOT = Path(__file__).parent.parent


def env_key(name: str) -> str | None:
    """API anahtarı: önce ortam değişkeni, sonra proje kökündeki .env (git dışı). Değer hiçbir yere yazdırılmaz."""
    if os.environ.get(name):
        return os.environ[name]
    env = ROOT / ".env"
    if env.exists():
        for line in env.read_text().splitlines():
            if line.strip().startswith(f"{name}="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None


# ---------- motorlar: generate(text, params, seed) -> float32 mono np.ndarray ----------

class ChatterboxEngine:
    def __init__(self, kind: str, device: str, ref: str, lang: str, vocoder_steps: int | None = None):
        import torch
        self.torch = torch
        if kind == "chatterbox_std":
            from chatterbox.tts import ChatterboxTTS
            self.model = ChatterboxTTS.from_pretrained(device=device)
            self.extra = {}
        else:
            from chatterbox.mtl_tts import ChatterboxMultilingualTTS
            self.model = ChatterboxMultilingualTTS.from_pretrained(device=device)
            self.extra = {"language_id": lang}
        self.model.prepare_conditionals(ref, exaggeration=0.5)  # referans bir kez işlenir
        if vocoder_steps:  # S3Gen flow-matching adım sayısı (varsayılan 10); generate() bunu dışarı açmıyor
            orig = self.model.s3gen.inference
            self.model.s3gen.inference = lambda *a, **kw: orig(*a, **{**kw, "n_cfm_timesteps": vocoder_steps})
        self.sr = self.model.sr
        self.device = device

    def generate(self, text, params, seed):
        self.torch.manual_seed(seed)
        wav = self.model.generate(text, exaggeration=params["exaggeration"], cfg_weight=params["cfg_weight"], **self.extra)
        if self.device == "mps":
            self.torch.mps.empty_cache()
        return wav.squeeze(0).cpu().numpy().astype(np.float32)


class QwenBaseEngine:
    MODEL = "mlx-community/Qwen3-TTS-12Hz-1.7B-Base-bf16"
    LANG = {"en": "english"}

    def __init__(self, ref: str, ref_text: str, lang: str):
        import mlx.core as mx
        from mlx_audio.tts.utils import load_model
        self.mx = mx
        self.model = load_model(self.MODEL)
        self.ref, self.ref_text, self.lang = ref, ref_text, self.LANG[lang]
        self.sr = self.model.sample_rate

    def generate(self, text, params, seed):
        self.mx.random.seed(seed)
        res = list(self.model.generate(text=text, ref_audio=self.ref, ref_text=self.ref_text, lang_code=self.lang))
        audio = np.concatenate([np.array(r.audio) for r in res]).astype(np.float32)
        self.mx.clear_cache()
        return audio


class VoxCPM2Engine:
    """VoxCPM2 Controllable Cloning: referans ses + duyguya göre parantez içi stil talimatı (emotions.yaml 'instruct')."""
    MODEL = "mlx-community/VoxCPM2-8bit"

    def __init__(self, ref: str, lang: str):
        import mlx.core as mx
        from mlx_audio.tts.utils import load_model
        self.mx = mx
        self.model = load_model(self.MODEL)
        self.ref = ref
        self.sr = self.model.sample_rate

    def generate(self, text, params, seed):
        self.mx.random.seed(seed)
        res = list(self.model.generate(text=text, ref_audio=self.ref, instruct=params.get("instruct")))
        audio = np.concatenate([np.array(r.audio) for r in res]).astype(np.float32)
        self.mx.clear_cache()
        return audio


class VoxCPM2TorchEngine:
    """VoxCPM2 PyTorch (CUDA; Kaggle T4): hazır tasarım sesi, referans + metniyle "ultimate cloning" (prompt + reference aynı klip).
    voxcpm @ git+https://github.com/OpenBMB/VoxCPM@f0c787f (voice/kaggle/kernel.py kurar). Ayarlar profil engine_options."""

    def __init__(self, ref: str, ref_text: str, opts: dict):
        opts = dict(opts)
        dtype = opts.pop("dtype", None)       # "float32": T4'te bf16 öykünmesi yerine (erken bitiş denemesi, 2026-11-08)
        self.mode = opts.pop("mode", "ultimate")   # ultimate: referans + metni (devam) · reference: yalnız referans sesi
        self.instruct = opts.pop("instruct", False)   # yalnız reference modunda: "(emotions.yaml instruct)metin" (Controllable Cloning)
        self.intensify = opts.pop("instruct_prefix", "")  # talimatın önüne eklenecek ek (ör. "more expressive, ")
        if dtype:
            import voxcpm.model.voxcpm2 as vm
            vm.pick_runtime_dtype = lambda device, configured: dtype
        from voxcpm import VoxCPM
        self.model = VoxCPM.from_pretrained("openbmb/VoxCPM2", load_denoiser=False, optimize=False)
        self.ref, self.ref_text = ref, ref_text
        self.opts = {"inference_timesteps": 16, "cfg_value": 2.0, **opts}
        self.sr = self.model.tts_model.sample_rate
        print(f"[voxcpm2_torch] mode={self.mode} instruct={self.instruct} dtype={self.model.tts_model.config.dtype} opts={self.opts}", flush=True)

    def generate(self, text, params, seed):
        prompt = {"prompt_wav_path": self.ref, "prompt_text": self.ref_text} if self.mode == "ultimate" else {}
        if self.instruct and self.mode == "reference" and params.get("instruct"):
            text = f"({self.intensify}{params['instruct']}){text}"
        wav = self.model.generate(text=text, reference_wav_path=self.ref, seed=seed, **prompt, **self.opts)
        return np.asarray(wav, dtype=np.float32)


class ElevenLabsEngine:
    """ElevenLabs bulut TTS (https://elevenlabs.io/docs/api-reference/text-to-speech/convert). Anahtar: ELEVENLABS_API_KEY
    (ortam ya da .env). Ses: ElevenLabs kütüphane/tasarım sesi ya da kullanıcının kendi/izinli sesi; gerçek kişi sesi klonlanmaz.
    Profil engine_options.elevenlabs: voice_id (zorunlu), model_id (vars. eleven_multilingual_v2), stability, similarity_boost,
    style, speed, use_speaker_boost. Duygu: senaryonun exaggeration değeri stability'yi aşağı çeker (daha canlı okuma).
    Ücret karakter başınadır: profil defaults.takes 1 önerilir; kapıyı geçemeyen sahne `--only sNN --takes 2` ile yeniden üretilir.
    Çıktı pcm_24000 (16 bit mono)."""
    SR = 24000

    def __init__(self, opts: dict, lang: str):
        self.key = env_key("ELEVENLABS_API_KEY")
        if not self.key:
            raise SystemExit("ELEVENLABS_API_KEY yok: proje kökündeki .env dosyasına ELEVENLABS_API_KEY=... satırını kullanıcı eklemeli")
        if not opts.get("voice_id"):
            raise SystemExit("profil engine_options.elevenlabs.voice_id yok (tools/elevenlabs_voices.py list)")
        self.voice = opts["voice_id"]
        self.model = opts.get("model_id", "eleven_multilingual_v2")
        self.base = {"stability": opts.get("stability", 0.5), "similarity_boost": opts.get("similarity_boost", 0.75),
                     "style": opts.get("style", 0.0), "use_speaker_boost": opts.get("use_speaker_boost", True)}
        if opts.get("speed"):
            self.base["speed"] = opts["speed"]
        self.lang = lang if opts.get("language_code") else None
        self.sr = self.SR

    def generate(self, text, params, seed):
        import urllib.error
        import urllib.request
        vs = dict(self.base)
        exag = params.get("exaggeration")
        if exag is not None:   # emotions.yaml: 0.5 nötr; daha yüksek = daha az kararlı, daha duygulu okuma
            vs["stability"] = round(min(0.95, max(0.15, vs["stability"] - (exag - 0.5) * 0.5)), 2)
        body = {"text": text, "model_id": self.model, "seed": int(seed) % 4294967295, "voice_settings": vs}
        if self.lang:
            body["language_code"] = self.lang
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{self.voice}?output_format=pcm_24000"
        for i in range(4):
            req = urllib.request.Request(url, data=json.dumps(body).encode(),
                                         headers={"xi-api-key": self.key, "Content-Type": "application/json"})
            try:
                with urllib.request.urlopen(req, timeout=180) as r:
                    pcm = r.read()
                return (np.frombuffer(pcm, dtype="<i2").astype(np.float32) / 32768.0)
            except urllib.error.HTTPError as e:
                msg = e.read().decode(errors="replace")[:300]
                if e.code in (429, 500, 502, 503) and i < 3:
                    time.sleep(6 * (i + 1))
                    continue
                raise SystemExit(f"ElevenLabs hata {e.code}: {msg}")


# ---------- ses işleme ----------

def apply_filters(x: np.ndarray, sr: int, filters: list[str]) -> np.ndarray:
    """Profildeki ffmpeg filtre zincirini (gürültü temizleme, EQ) ham sese uygular; float32 boru hattı, dosya yok."""
    if not filters:
        return x
    p = subprocess.run(["ffmpeg", "-loglevel", "error", "-f", "f32le", "-ar", str(sr), "-ac", "1", "-i", "pipe:0",
                        "-af", ",".join(filters), "-f", "f32le", "-ar", str(sr), "-ac", "1", "pipe:1"],
                       input=x.astype("<f4").tobytes(), capture_output=True, check=True)
    return np.frombuffer(p.stdout, dtype="<f4").copy()


class SpeakerCheck:
    """Chatterbox ses kodlayıcısıyla denemenin referansa konuşmacı benzerliği (kosinüs). Yalnızca chatterbox venv'inde."""

    def __init__(self, ref_wav: str):
        import librosa
        from huggingface_hub import hf_hub_download
        from safetensors.torch import load_file
        from chatterbox.models.voice_encoder import VoiceEncoder
        self.librosa = librosa
        self.ve = VoiceEncoder()
        self.ve.load_state_dict(load_file(hf_hub_download("ResembleAI/chatterbox", "ve.safetensors")))
        self.ve.eval()
        self.ref = self._emb(librosa.load(ref_wav, sr=16000)[0])

    def _emb(self, y16):
        return self.ve.embeds_from_wavs([y16], sample_rate=16000)[0]

    def similarity(self, x: np.ndarray, sr: int) -> float:
        return float(self._emb(self.librosa.resample(x, orig_sr=sr, target_sr=16000)) @ self.ref)


def read_wav(path: Path) -> tuple[np.ndarray, int]:
    with wave.open(str(path)) as w:
        return np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float32) / 32767, w.getframerate()


def write_wav(path: Path, x: np.ndarray, sr: int):
    pcm = (np.clip(x, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1), w.setsampwidth(2), w.setframerate(sr)
        w.writeframes(pcm.tobytes())


HOP_S = 0.02


def segments(x: np.ndarray, sr: int, thr_db=-35.0, merge_gap_s=0.12) -> list[list[int]]:
    """Ses bölgeleri, 20 ms'lik çerçeve indeksleriyle [başlangıç, bitiş]. Kısa boşluklar birleştirilir."""
    hop = int(sr * HOP_S)
    n = len(x) // hop
    rms = np.sqrt(np.mean(x[: n * hop].reshape(n, hop) ** 2, axis=1) + 1e-12)
    voiced = 20 * np.log10(rms / (rms.max() + 1e-12)) > thr_db
    segs, start, gap, end = [], None, 0, 0
    for i, v in enumerate(voiced):
        if v:
            start = i if start is None else start
            gap, end = 0, i
        elif start is not None:
            gap += 1
            if gap * HOP_S > merge_gap_s:
                segs.append([start, end]); start = None
    if start is not None:
        segs.append([start, end])
    return segs


def tail_cut_candidates(x: np.ndarray, sr: int) -> list[tuple[int, int]]:
    """(son_örnek, atılan_bölge_sayısı) adayları: hiç atmadan başlayıp sondaki kopuk bölgeleri sırayla atar.

    R1 bulgusu: Chatterbox konuşma bittikten 0.3-0.6 sn sonra kısa bir ses patlaması üretebiliyor.
    Aday: son bölge < 1.0 sn ve öncesinde ≥ 0.2 sn boşluk. Hangisinin artefakt olduğuna Whisper karar verir.
    """
    hop = int(sr * HOP_S)
    pad = int(0.15 * sr)
    segs = segments(x, sr)
    if not segs:
        return [(len(x), 0)]
    cands = [(min(len(x), (segs[-1][1] + 1) * hop + pad), 0)]
    for k in range(1, 3):
        if len(segs) <= k:
            break
        s, e = segs[-k]
        if (e - s + 1) * HOP_S >= 1.0 or (s - segs[-k - 1][1]) * HOP_S < 0.2:
            break
        cands.append((min(len(x), (segs[-k - 1][1] + 1) * hop + pad), k))
    return cands


def finish(x: np.ndarray, sr: int, end: int) -> np.ndarray:
    """Baştaki sessizliği 0.1 sn'ye indirir, `end`'de keser, 40 ms fade-out, tepe −1 dBFS."""
    segs = segments(x, sr)
    a = max(0, segs[0][0] * int(sr * HOP_S) - int(0.10 * sr)) if segs else 0
    y = x[a:end].copy()
    fade = min(len(y), int(0.04 * sr))
    y[-fade:] *= np.linspace(1, 0, fade, dtype=np.float32)
    peak = np.abs(y).max()
    if peak > 0:
        y *= 10 ** (-1 / 20) / peak
    return y


def clean_and_check(raw: np.ndarray, sr: int, path: Path, lang: str, refs: list[str], use_asr: bool = True) -> tuple[np.ndarray, dict]:
    """Kuyruk adaylarını Whisper'la dener: WER'i artırmayan ve kelime kaybettirmeyen en kısa kesim seçilir.

    Kelime sayısı koruması: EP001 pilotunda bozuk telaffuz edilen gerçek bir kelime ("Bölümleme") WER eşitliği
    yüzünden kesildi. Artefakt kelime üretmez; kesince Whisper'ın duyduğu kelime sayısı azalıyorsa kesilen şey konuşmadır.
    """
    if not use_asr:  # whisper-cli olmayan ortam (Colab): kesim yok, WER/kuyruk kontrolü Mac'te yapılır
        y = finish(raw, sr, len(raw))
        write_wav(path, y, sr)
        return y, {"wer": 0.0, "hyp": None, "words": [], "dropped_bursts": 0, "trimmed_tail_s": 0.0,
                   "raw_peak": round(float(np.abs(raw).max()), 3)}
    import asr
    best, base_n = None, None
    for end, dropped in tail_cut_candidates(raw, sr):
        y = finish(raw, sr, end)
        write_wav(path, y, sr)
        hyp, words = asr.transcribe(path, lang)
        w = min(asr.wer(r, hyp, lang) for r in refs)
        n_words = len(asr.norm(hyp, lang))
        base_n = n_words if base_n is None else base_n  # ilk aday = hiç kesilmemiş
        if best is None or (w <= best["wer"] and n_words >= base_n):
            best = {"y": y, "wer": w, "hyp": hyp, "words": words, "dropped_bursts": dropped,
                    "trimmed_tail_s": round((len(raw) - end) / sr, 2)}
    write_wav(path, best["y"], sr)  # son yazılan aday seçilen olmayabilir
    y = best.pop("y")
    return y, {**best, "raw_peak": round(float(np.abs(raw).max()), 3)}


def check_take(raw, sr, sc, row, path, lang, post_filters, speaker, use_asr=True) -> dict:
    """Ham take'e son işlem + kalite kapısı; satırı (row) günceller."""
    y, info = clean_and_check(apply_filters(raw, sr, post_filters), sr, path, lang, [sc["text"], sc["spoken"]], use_asr)
    w = info.pop("wer")
    info["speaker_sim"] = round(speaker.similarity(y, sr), 3) if speaker else None
    dur = len(y) / sr
    row.update({"wer": round(w, 3), "audio_s": round(dur, 2), "over_max_s": round(max(0.0, dur - sc.get("max_seconds", 99)), 2),
                **info})
    return row


def pick(sid, rows, speaker, min_sim, out, ep_dir) -> int:
    """Önce ses kimliği eşiği, sonra WER, sonra süre aşımı, eşitlikte benzerliği yüksek olan."""
    below = lambda r: speaker is not None and r["speaker_sim"] < min_sim  # noqa: E731
    best = min(rows, key=lambda r: (below(r), r["wer"], r["over_max_s"], -(r["speaker_sim"] or 0)))
    if below(best):
        print(f"[warn] {sid}: tüm denemeler ses kimliği eşiğinin altında (en iyi {best['speaker_sim']} < {min_sim})")
    (out / f"{sid}.wav").write_bytes((ep_dir / best["file"]).read_bytes())
    print(f"[pick] {sid} → take{best['take']} (wer={best['wer']}, sim={best['speaker_sim']})")
    return best["take"]


def write_narration(out, report, gap) -> float:
    """Senaryo sırasıyla sahneler, aralarında boşluk, −16 LUFS."""
    parts, sr = [], None
    for sc in report["scenes"]:
        x, sr = read_wav(out / f"{sc['id']}.wav")
        parts += [x, np.zeros(int(gap * sr), dtype=np.float32)]
    raw_narr = out / "narration.raw.wav"
    write_wav(raw_narr, np.concatenate(parts), sr)
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(raw_narr), "-af", "loudnorm=I=-16:TP=-1.5",
                    "-ar", str(sr), str(out / "narration.wav")], check=True)
    raw_narr.unlink()
    total = sum(len(p) for p in parts) / sr
    report["narration_s"] = round(total, 2)
    report["mean_wer"] = round(float(np.mean([s["takes"][s["chosen"]]["wer"] for s in report["scenes"]])), 3)
    return total


def gate_only(script, out, ep_dir, profile, ref_wav, gap):
    """Başka makinede (--no-asr) üretilmiş ham take'leri bu makinede kalite kapısından geçirip seçer."""
    t0 = time.time()
    report = json.loads((out / "report.json").read_text())
    min_sim = profile.get("identity", {}).get("min_similarity")
    speaker = None
    if min_sim is not None and ref_wav:
        try:
            speaker = SpeakerCheck(ref_wav)
        except ImportError:  # hafif kurulum (chatterbox/torch yok): kimlik kontrolü atlanır, WER/kesik kontrolleri sürer
            print("[warn] ses kimliği kontrolü bu ortamda yok (chatterbox kurulu değil), atlandı")
    by_id = {s["id"]: s for s in script["scenes"]}
    for sc in report["scenes"]:
        if sc.get("voice") and sc["voice"] != report["voice"]:
            continue   # --merge ile eklenmiş karakter sahnesi: kendi koşusunda kapıdan geçti, ortamı işlendi
        sc_full = {**by_id.get(sc["id"], {}), **sc}  # max_seconds senaryodan
        for row in sc["takes"]:
            path = ep_dir / row["file"]
            raw, sr = read_wav(path.with_name(path.stem + ".raw.wav"))
            check_take(raw, sr, sc_full, row, path, report["lang"], report["post_filters"], speaker)
            print(f"[gate] {sc['id']} take{row['take']} audio={row['audio_s']:5.2f}s wer={row['wer']:.2f} "
                  f"tail_cut={row['trimmed_tail_s']}s sim={row['speaker_sim']} | {row['hyp']}")
        sc["chosen"] = pick(sc["id"], sc["takes"], speaker, min_sim, out, ep_dir)
    total = write_narration(out, report, gap)
    report.update({"asr": True, "min_similarity": min_sim if speaker else None, "gate_s": round(time.time() - t0, 1)})
    (out / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(f"[done] gate {out} narration={total:.1f}s mean_wer={report['mean_wer']} gate={report['gate_s']}s")


def choose_takes(out, ep_dir, picks, gap):
    """Üretme/Whisper yok: kapının seçimini elle değiştir (ör. s08=0), sNN.wav'ı o take'le değiştir, anlatımı yeniden yaz.
    Take'in wer/hyp/words bilgisi report.json'da zaten var (kapı tüm take'leri işler)."""
    report = json.loads((out / "report.json").read_text())
    by_id = {s["id"]: s for s in report["scenes"]}
    for p in picks:
        sid, k = p.split("=")
        sc, k = by_id[sid], int(k)
        row = next(r for r in sc["takes"] if r["take"] == k)
        shutil.copy(ep_dir / row["file"], out / f"{sid}.wav")
        print(f"[choose] {sid}: take{sc['chosen']} → take{k} (wer={row['wer']}, tail_cut={row.get('trimmed_tail_s')}s) | {row.get('hyp')}")
        sc["chosen"] = k
    total = write_narration(out, report, gap)
    (out / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(f"[done] choose {out} narration={total:.1f}s mean_wer={report['mean_wer']}")


def speakers_of(script) -> set:
    return {sc["speaker"] for sc in script["scenes"] if sc.get("speaker")}


def wants(sc, voice, script) -> bool:
    """Diyalog sahnesi (speaker) yalnız o karakterin koşusunda, anlatım sahneleri yalnız anlatıcı koşusunda üretilir."""
    if sc.get("speaker"):
        return voice == sc["speaker"]
    return voice not in speakers_of(script)


def merge_speakers(script, out, ep_dir, runs, gap):
    """Karakter koşularının (audio/_trials/<run>) seçilen sahnelerini anlatım klasörüne ekler, ortam işlemesini uygular,
    anlatımı senaryo sırasıyla yeniden yazar."""
    media = yaml.safe_load((ROOT / "catalog" / "voice_media.yaml").read_text())
    report = json.loads((out / "report.json").read_text())
    have = {s["id"]: s for s in report["scenes"]}
    by_id = {s["id"]: s for s in script["scenes"]}
    for run in runs:
        src = ep_dir / "audio" / "_trials" / run
        rep = json.loads((src / "report.json").read_text())
        for sc in rep["scenes"]:
            full = by_id.get(sc["id"])
            if not full:
                continue
            if not full.get("speaker") and rep["voice"] == report["voice"]:   # anlatıcı sahnesi yeniden üretimi (kısmi koşu)
                shutil.copy(src / f"{sc['id']}.wav", out / f"{sc['id']}.wav")
                have[sc["id"]] = sc
                print(f"[merge] {sc['id']} ← {run} (anlatıcı)")
                continue
            if full.get("speaker") != rep["voice"]:
                continue
            dry = out / f"{sc['id']}.dry.wav"
            shutil.copy(src / f"{sc['id']}.wav", dry)
            af = media[full["medium"]]["af"] if full.get("medium") else "anull"
            sr = read_wav(dry)[1]
            subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(dry), "-af", af, "-ar", str(sr),
                            str(out / f"{sc['id']}.wav")], check=True)
            have[sc["id"]] = {**sc, "voice": rep["voice"], "engine": rep["engine"], "medium": full.get("medium")}
            print(f"[merge] {sc['id']} ← {run} ({rep['voice']}, {full.get('medium') or 'kuru'})")
    report["scenes"] = [have[s["id"]] for s in script["scenes"] if s["id"] in have]
    missing = [s["id"] for s in script["scenes"] if s["id"] not in have]
    if missing:
        print(f"[warn] anlatımda eksik sahne: {missing}")
    total = write_narration(out, report, gap)
    (out / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(f"[done] merge {out} narration={total:.1f}s")


# ---------- ana akış ----------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("script", help="script.<dil>.json")
    ap.add_argument("--engine", choices=["chatterbox_std", "chatterbox_mtl", "qwen_base", "voxcpm2", "voxcpm2_torch", "elevenlabs"])
    ap.add_argument("--run", default=None, help="çıktı klasörü adı (audio/_trials/<run>); yoksa audio/<dil>")
    ap.add_argument("--takes", type=int, default=None)
    ap.add_argument("--seed", type=int, default=None, help="taban seed (profil defaults.seed yerine; yeni denemeler için)")
    ap.add_argument("--device", default=None)
    ap.add_argument("--cfg-override", type=float, default=None, help="tüm sahnelerde cfg_weight (ör. 0: aksan azaltma)")
    ap.add_argument("--exag-override", type=float, default=None, help="tüm sahnelerde exaggeration (ayar testi)")
    ap.add_argument("--only", nargs="*", help="yalnızca bu sahne id'leri (hızlı deneme)")
    ap.add_argument("--voice", default=None, help="ses profili (senaryodaki 'voice' yerine, ör. karşılaştırma)")
    ap.add_argument("--no-asr", action="store_true", help="Whisper kalite kapısını atla (Colab; kontrol sonra Mac'te --gate-only)")
    ap.add_argument("--gate-only", action="store_true", help="üretme; klasördeki ham take'leri kapıdan geçir, seç, anlatımı yaz")
    ap.add_argument("--merge", nargs="+", metavar="RUN", help="üretme; karakter koşularının (_trials/RUN) diyalog sahnelerini "
                    "anlatım klasörüne ekle (ortam işlemesiyle) ve anlatımı yeniden yaz")
    ap.add_argument("--choose", nargs="+", metavar="sNN=K", help="üretme; kapının seçtiği take'i elle değiştir "
                    "(ör. s08=0) ve anlatımı yeniden yaz (Whisper yok)")
    args = ap.parse_args()

    script_path = Path(args.script).resolve()
    script = json.loads(script_path.read_text())
    lang = script["lang"]
    voice = args.voice or script["voice"]
    profile = yaml.safe_load((ROOT / "voice" / "profiles" / f"{voice}.yaml").read_text())
    emotions = yaml.safe_load((ROOT / "catalog" / "emotions.yaml").read_text())
    d = profile["defaults"]
    takes = args.takes or d["takes"]
    device = args.device or d["device"]
    engine_name = args.engine or profile["engines"][lang]
    refs = profile.get("refs") or {}
    ref = refs.get(lang) or refs.get("en") or {}  # TR referansı yoksa EN (R2); bulut motorlarında (elevenlabs) referans yok
    ref_wav = str(ROOT / ref["wav"]) if ref.get("wav") else None

    ep_dir = script_path.parent
    out = ep_dir / "audio" / ("_trials/" + args.run if args.run else lang)
    (out / "takes").mkdir(parents=True, exist_ok=True)
    if args.gate_only:
        return gate_only(script, out, ep_dir, profile, ref_wav, d["scene_gap_s"])
    if args.choose:
        return choose_takes(out, ep_dir, args.choose, d["scene_gap_s"])
    if args.merge:
        return merge_speakers(script, out, ep_dir, args.merge, d["scene_gap_s"])

    t0 = time.time()
    if engine_name == "qwen_base":
        engine = QwenBaseEngine(ref_wav, ref["text"], lang)
    elif engine_name == "voxcpm2":
        engine = VoxCPM2Engine(ref_wav, lang)
    elif engine_name == "voxcpm2_torch":
        engine = VoxCPM2TorchEngine(ref_wav, ref["text"], profile.get("engine_options", {}).get("voxcpm2_torch", {}))
    elif engine_name == "elevenlabs":
        engine = ElevenLabsEngine(profile.get("engine_options", {}).get("elevenlabs", {}), lang)
    else:
        steps = profile.get("engine_options", {}).get("chatterbox", {}).get("vocoder_steps")
        engine = ChatterboxEngine(engine_name, device, ref_wav, lang, vocoder_steps=steps)
    post_filters = profile.get("post_filters", [])
    min_sim = profile.get("identity", {}).get("min_similarity")
    speaker = None
    if min_sim is not None and ref_wav:
        try:
            speaker = SpeakerCheck(ref_wav)
        except ImportError:  # qwen (mlx) venv'inde chatterbox yok: kimlik kontrolü atlanır
            print("[warn] ses kimliği kontrolü bu venv'de yok, atlandı")
    load_s = time.time() - t0
    if engine_name == "elevenlabs":
        device = "cloud"
    if engine_name in ("qwen_base", "voxcpm2"):
        device = "mlx"  # MLX motorları Apple GPU'da çalışır, --device yok sayılır
    print(f"[load] {engine_name} {device} {load_s:.1f}s ref={ref.get('wav')}")

    pron = textnorm.load_pronunciation(lang)
    report = {"episode": script["episode"], "lang": lang, "voice": voice, "engine": engine_name, "device": device,
              "ref": ref.get("wav"), "takes": takes, "cfg_override": args.cfg_override, "load_s": round(load_s, 1),
              "vocoder_steps": None if engine_name in ("qwen_base", "voxcpm2", "voxcpm2_torch", "elevenlabs") else (steps or 10),
              "post_filters": post_filters, "min_similarity": min_sim if speaker else None, "asr": not args.no_asr, "scenes": []}
    prev = {}
    if args.only and (out / "report.json").exists():  # kısmi yeniden üretim: diğer sahneler korunur
        prev = {s["id"]: s for s in json.loads((out / "report.json").read_text())["scenes"]}
    for sc in script["scenes"]:
        if args.only and sc["id"] not in args.only:
            continue
        if not args.only and not wants(sc, voice, script):   # --only ile açıkça istenen sahne her sesle üretilir (deneme)
            continue
        spoken = textnorm.prepare(sc["text"], lang, pron)
        emo = emotions[sc["emotion"]]
        exag = emo["exaggeration"] * (0.6 + 0.8 * sc.get("intensity", 0.5)) if args.exag_override is None else args.exag_override
        params = {"exaggeration": round(exag, 3),
                  "cfg_weight": emo["cfg_weight"] if args.cfg_override is None else args.cfg_override}
        if engine_name == "voxcpm2":
            params = {"instruct": emo.get("instruct")}
        elif engine_name == "voxcpm2_torch":
            params = {"instruct": emo.get("instruct")}  # yalnız profil instruct: true + mode: reference iken kullanılır
        rows = []
        for k in range(takes):
            seed = (args.seed if args.seed is not None else d["seed"]) + k
            t = time.time()
            raw = engine.generate(spoken, params, seed)
            gen_s = time.time() - t
            write_wav(out / "takes" / f"{sc['id']}.take{k}.raw.wav", raw, engine.sr)  # yeniden işleme için ham çıktı
            path = out / "takes" / f"{sc['id']}.take{k}.wav"
            row = {"take": k, "seed": seed, "gen_s": round(gen_s, 1), "file": str(path.relative_to(ep_dir))}
            info = check_take(raw, engine.sr, {**sc, "spoken": spoken}, row, path, lang, post_filters, speaker,
                              use_asr=not args.no_asr)
            rows.append(info)
            print(f"[gen] {sc['id']} take{k} seed={seed} audio={info['audio_s']:5.2f}s gen={gen_s:5.1f}s wer={info['wer']:.2f} "
                  f"tail_cut={info['trimmed_tail_s']}s bursts={info['dropped_bursts']} sim={info['speaker_sim']} | {info['hyp']}")
        chosen = pick(sc["id"], rows, speaker, min_sim, out, ep_dir)
        prev[sc["id"]] = {"id": sc["id"], "text": sc["text"], "spoken": spoken, "emotion": sc["emotion"],
                          "params": params, "chosen": chosen, "takes": rows}

    report["scenes"] = [prev[s["id"]] for s in script["scenes"] if s["id"] in prev]
    total = write_narration(out, report, d["scene_gap_s"])
    report["wall_s"] = round(time.time() - t0, 1)
    (out / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(f"[done] {out} narration={total:.1f}s mean_wer={report['mean_wer']} wall={report['wall_s']}s")


if __name__ == "__main__":
    main()
