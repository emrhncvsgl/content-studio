# Kaggle'da ses üretimi (ücretsiz T4, tarayıcısız)

Colab yolunun (voice/colab/README.md) elle adımsız karşılığı: paket, çalıştırma ve indirme tamamen `kaggle` CLI ile.
Remote Control'de telefondan tetiklenebilir (Mac açık ve uyanık olmalı; iş Kaggle'da, Mac yalnızca Whisper kapısı).
Kota: haftada ~30 saat GPU (bölüm başına ~15 dk).

## Bir kez kurulum
1. CLI: `pipx install kaggle && pipx inject kaggle six` (kaggle 2.2.5 `six`'i bağımlılık olarak çekmiyor → ModuleNotFoundError).
2. Kaggle hesabı → Settings → **Phone verification** (GPU ve internet erişimi için şart).
3. Settings → API → **Create New Token** → inen `kaggle.json`'u `~/.kaggle/kaggle.json`'a koy, `chmod 600 ~/.kaggle/kaggle.json`.
   Kontrol: `kaggle config view` kullanıcı adını göstermeli.

## Kullanım
```
voice/.venv-chatterbox/bin/python tools/kaggle_voice.py run EP005            # pack → push → bekle → indir → unpack (Whisper kapısı)
voice/.venv-chatterbox/bin/python tools/kaggle_voice.py run EP005 -- --run kaggle_test   # deneme: audio/_trials/kaggle_test
voice/.venv-chatterbox/bin/python tools/kaggle_voice.py status               # yarıda kalırsa
voice/.venv-chatterbox/bin/python tools/kaggle_voice.py fetch EP005          # biten koşunun çıktısını indir + unpack
```
- Tek özel çekirdek (`<kullanıcı>/cs-voice`), her koşu yeni sürüm. Paket base64 olarak `voice/kaggle/kernel.py`'ye gömülür (veri seti yok).
- Hızlandırıcı `--accelerator NvidiaTeslaT4`, süre sınırı 3600 sn. Çalışma klasörü `audio/_kaggle/` (kernel/, output/ + günlük).
- Uzun sürer (~15 dk): arka planda çalıştır. Bitince runtime kendiliğinden kapanır (Colab'daki gibi elle kapatma yok).

## Karakter sesleri (birden çok profil) — paket sınırı
- Her `--job "--voice char_x --run <ad>"` kendi profilini ve referansını pakete koyar. 24 kHz FLAC referans ~250 KB: **dört karakter tek pakette
  999 KB → push 400** (EP010, 2026-11-10). Çekirdek başına en fazla 2 karakter sesi; ikinci çift için `--slug cs-voice-b`
  (`run --slug cs-voice-b --job ... --job ... <bölüm>`, kopunca `fetch --slug cs-voice-b <bölüm>`). İki çekirdek aynı anda kuyruğa girer.
- Aynı anda iki `run` başlatılırsa ikisi de `audio/_colab/bundle.<dil>.zip`'i yazar ve Mac'teki Whisper kapıları çakışabilir: push'ları sırayla yap,
  kapıları sırayla çalıştır (EP010'da `kaggle_voice.push/wait/fetch` sırayla çağrıldı).
- Mac'te yarım kalmış bir `_trials/char_x` varsa Kaggle işine başka `--run` adı ver (ör. `kg_char_x`); unpack aynı adlı klasörün üzerine yazar.
  `synth.py --merge` koşu adına değil rapordaki `voice`'a bakar.
