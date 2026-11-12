# Üçüncü taraf bileşenler

## Lemo-Opuscar (`plugins/content-studio/library/lemo/`)
- Kaynak: https://github.com/lemomo-ai/lemo-opuscar, commit `8814b84` (2026-11-12), 2.0.0 öncesi son sürüm.
- Lisans: **MIT** (bu sürümün kendi `LICENSE` dosyası klasörde). Lemo-Opuscar'ın lisans dosyası, 2.0.0'dan önce yayımlanan
  sürümlerin yayımlandıkları lisansı koruduğunu belirtir.
- Alınanlar: stil tarifleri (STYLE.md, DEMO.md, style.json), demo kodu, CREDITS. **Alınmayanlar:** filmler, posterler, müzik,
  ses, fontlar, 300 KB üstü veri dosyaları, demoların içindeki üçüncü taraf kütüphaneler (`*.min.js`, `vendor/`) ve
  `living-screencast` stili (Anthropic'in Clawd karakterini içerir; Lemo lisansı onu kapsam dışı tutar).
- Lemo-Opuscar 2.0.0 ve sonrası (stil tarifleri CC BY-NC 4.0) bu repoda **yoktur**. İsteyen kişi Lemo'nun kendi plugin'ini kurar
  (`/plugin marketplace add lemomo-ai/lemo-opuscar`); o tarifler yalnızca kendi filmleri için kullanılabilir.
- Değiştirildi: `SECKI.md` bu stüdyonun seçki notudur (Türkçe).

## cinecode (`plugins/content-studio/library/cinecode/`)
- Kaynak: https://github.com/sarpstar/cinecode, commit `COMMIT` dosyasında. Telif: Sarp Yıldız. Lisans: **MIT** (`LICENSE`).
- Alınanlar: `references/`, `starter/`, `templates/`, `scripts/`, stil dizini (`styles/index.json`, `aliases.json`) ve cinecode'un
  kendi 7 stil tarifi. `SKILL.cinecode.md` ve `README.cinecode.md` başvuru için özgün hâliyle durur.

## Bu stüdyonun motoru içindekiler
- Ses profilleri: `tok_anlatici` (VoxCPM2 tasarım sesi, alexturkey/voxcpm2-turkce-ses-tasarimi, Apache-2.0), `narrator_v3`
  (Qwen3-TTS VoiceDesign ile tasarlanmış sentetik ses). İkisi de gerçek bir kişinin kaydından üretilmedi.
- Remotion (remotion.dev): kendi lisansı; bireyler ve ≤3 kişilik şirketler ücretsiz.
- Fontlar, dokular, ses efektleri ve müzik repoya konmaz; kurulumda açık lisanslı kaynaklardan indirilir
  (`tools/fetch_fonts.py`, `tools/sounds.py`).
