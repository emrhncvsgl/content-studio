---
name: voice-pipeline
description: >
  Ses üretim prosedürü ve parametre başvurusu: voice/synth.py ile senaryodan sahne sesleri ve anlatım üretmek,
  tek sahneyi yeniden üretmek, ses profili (voice/profiles) ve duygu haritası (catalog/emotions.yaml) ayarları,
  kalite eşikleri ve bellek kuralları. Ses üretilirken, ses sorunu incelenirken ya da yeni ses profili eklenirken kullan.
---

# Ses hattı

Ayrıntılı gerekçeler: `docs/DECISIONS.md` (2026-10-19/20 kayıtları).

## Üretim
```
voice/.venv-chatterbox/bin/python voice/synth.py <bölüm>/script.<dil>.json            # → <bölüm>/audio/<dil>/
voice/.venv-chatterbox/bin/python voice/synth.py <bölüm>/script.<dil>.json --only s03 s05   # yalnızca bu sahneler
voice/.venv-chatterbox/bin/python voice/synth.py <bölüm>/script.<dil>.json --choose s08=0   # kapının seçimini elle değiştir (TTS/Whisper yok), anlatımı yeniden yazar
```
- Motor ve ayarlar senaryodaki `voice` profilinden gelir (`voice/profiles/<id>.yaml`). Profil `engines.<dil>` yoksa o dil üretilemez; kullanıcıya söyle.
- Qwen motoru (`qwen_base`) yalnızca `voice/.venv-mlx/bin/python` ile çalışır.
- `--run <ad>` deneme klasörüne (`audio/_trials/<ad>`) yazar; gerçek bölüm için kullanma.
- Çıktılar: `sNN.wav` (seçilen deneme), `narration.wav` (−16 LUFS, sahneler arası 0.35 sn), `report.json`
  (her deneme: WER, Whisper metni, kelime zamanları, konuşmacı benzerliği, kesilen kuyruk), `takes/` (ham + işlenmiş denemeler).

## Colab (T4 GPU) ile üretim — Mac boşta kalsın
Bölümün tamamı (yalnızca chatterbox motorları) Colab'da ~8 kat hızlı üretilir; kalite aynı (DECISIONS 2026-11-01). Ayrıntı: `voice/colab/README.md`.
```
voice/.venv-chatterbox/bin/python tools/colab_voice.py pack EP004            # → audio/_colab/bundle.en.zip
# kullanıcı: voice/colab/voice_colab.ipynb'i Colab'da aç (T4), hücreyi çalıştır, zip'i seç; sonuç ~/Downloads'a iner
voice/.venv-chatterbox/bin/python tools/colab_voice.py unpack ~/Downloads/voice_<bölüm>.en.zip   # Whisper kapısı + seçim + anlatım
```
- Colab'da `--no-asr` ile yalnızca üretilir; seçim Mac'te `synth.py --gate-only` ile (unpack bunu çağırır, ~10 sn/deneme).
- Tek sahne düzeltmesi (`--only`) Mac'te yapılır: unpack mevcut `audio/<dil>`'in üzerine yazmayı reddeder (`--force` bilerek).

## Her sahnede ne olur
1. `voice/textnorm.py`: rakam → yazı, `catalog/pronunciation.<dil>.yaml` telaffuz sözlüğü.
2. Profildeki `defaults.takes` kadar deneme (seed = `defaults.seed` + k).
3. Son işlem (`post_filters`, ör. afftdn + ton eşleştirme EQ) → kuyruk artefaktı kesme → −1 dBFS.
4. Whisper (WER) + ses kimliği (referansa benzerlik, `identity.min_similarity`).
5. Seçim: kimlik eşiği → WER → süre aşımı (`max_seconds`) → benzerlik.

## Kalite eşikleri (report.json'u oku)
| durum | eylem |
|---|---|
| seçilen denemenin `wer` > 0.15 | `hyp` ile metni karşılaştır. Telaffuz sorunuysa sözlüğe ekle; değilse `--only sNN` ile yeniden üret (gerekirse `--takes 3`) |
| `[warn] tüm denemeler ses kimliği eşiğinin altında` | yeniden üret; tekrarlarsa kullanıcıya bildir |
| `over_max_s` > 0.5 | script-writer'a sahneyi kısaltma notu |
| Whisper'ın terimi farklı yazması (ör. Treez → "trees") | sözlük okunuşu; hata sayma |
Bilinen sınır: konuşmaya bitişik kuyruk sesi kesilemez (t5_emo örneği). Kullanıcı duyarsa sahneyi yeniden üret.

## Bellek ve süre (16 GB Mac)
- Aynı anda tek ağır iş: TTS, toplu Whisper ve Remotion render birlikte çalışmaz.
- narrator_v2 (Chatterbox Std, CPU, 25 vokoder adımı): tepe ~4 GB, ~1 dk/sahne/deneme → 8 sahne × 2 deneme ≈ 16 dk.
- MPS (Apple GPU) kullanma: 19 GB tepe, swap. CPU varsayılan.
- Uzun işleri arka planda çalıştır; boş bellek %10'un altına inerse işi durdur (`memory_pressure`).

## Metin kuralları (senaryo için geri bildirim)
- Rakam yok, yazıyla (TR'de zorunlu).
- TR: tek kelimelik cümle ve cümle sonunda tek başına kalan terim kullanma; cümleye terimle başlama.
- Sahne başına ~2 cümle. Ölçülen hız: EN ~2.9 kelime/sn, TR ~2.2 kelime/sn.

## Yeni ses profili
Yöntem DECISIONS.md'de: Qwen VoiceDesign tarifi → aday → baş parça (ilk 8-10 sn en temsil edici kısım) referans
→ Chatterbox kalite zinciri (25 adım + `voice/tests/post_variants.py` ile ton eşleştirme EQ) → kör dinleme → `voice/profiles/<id>.yaml`.

## Karakter sesi adayları (diyalog/alıntı sahneleri; `speaker` + `medium`, sound-design §7b)
Gerçek kişi repliği canlandırılsa bile ses yalnız metin tarifiyle tasarlanır; gerçek kayıt referans alınmaz, tarifte kişi adı geçmez.
```
# 1) tarif dosyası: voice/tests/design_<EP>_chars.json (id'ler <rol>_a, <rol>_b; ortak nötr test cümlesi ~9 sn)
cd voice && .venv-mlx/bin/python design_voice.py --candidates tests/design_ep010_chars.json --out tests/out/design_ep010   # ~15 sn/aday, tepe 7.7 GB
# 2) referans + aud_char_<aday>.yaml + repliğiyle üretim + kuru/ortamlı dinleme dosyası + ölçüm (sırayla, bellek bekçili; ~2-3 dk/aday)
voice/.venv-chatterbox/bin/python tools/char_auditions.py EP010 --design voice/tests/design_ep010_chars.json \
    --wavs voice/tests/out/design_ep010 --map capcom=s25 cmp=s42 cdr=s12 lmp=s51
```
- Çıktı: `<bölüm>/audio/_trials/chars/<aday>_dry.wav`, `<aday>_<medium>.wav`, `measure.json` (kaynağa göre tepe/LUFS/kırpılma; yeniden örnekleme yok).
- Tasarım çıktısında F0 medyanı ve parlaklığı anlatıcı referansıyla karşılaştır (librosa pyin); adaylar birbirinden ve anlatıcıdan ayrışmalı.
- Nihai `voice/profiles/char_<rol>.yaml` + `voice/refs/char_<rol>.en.flac` kullanıcı seçiminden sonra yazılır (EP009 kalıbı, takes 3).
- Anlatıcı koşusu karakter profilleri olmadan da çalışır (`kaggle_voice.py run <EP>`: speaker sahnelerini atlar, pack doğrulayıcı çağırmaz).

## Sahne içi sessizlik (`pauses`, `tail_ms`)
Senaryo sahnesine `"pauses": [{"afterWord": "cut", "ms": 1000}]` (kelimeden sonra sessizlik) ve `"tail_ms": 1000` (sahne sonunda sessizlik) yazılır.
`tools/build_timeline.py` boşluğu kelime arasına ekleyip `audio/<dil>/_paced/<id>.wav` üretir, sonraki kelimeleri ve kelimeye bağlı efektleri kaydırır, sahneyi uzatır; TTS yeniden çalışmaz.
`afterWord` sahnedeki ilk eşleşen kelimedir, son kelime olamaz. `narration.wav` bu boşlukları içermez (yalnızca dinleme kopyası). İlk kullanım EP007 s01, s07.
