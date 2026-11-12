# Content Studio (Claude Code plugin)

Kendi bilgisayarında çalışan, çok ajanlı Shorts/video üretim stüdyosu. Konu röportajı → senaryo → anlatıcı sesi → storyboard →
Remotion render → yayın paketi. Her adımda onay senden; ajanlar işi yapar.

## Kurulum (bir kez)

1. **Claude Code** kurulu olsun (masaüstü uygulaması ya da terminal).
2. Plugin'i terminalden ekle (masaüstü uygulamasında: oturumun **Terminal** düğmesi; `claude` yoksa önce
   `curl -fsSL https://claude.ai/install.sh | bash`):
   ```
   claude plugin install content-studio --marketplace emrhncvsgl/content-studio
   ```
   Masaüstü uygulamasının eklenti menüsü kendi eklenen katalogları göstermiyor; ayrıntı [KURULUM.md](KURULUM.md).
   Repo özelse GitHub'da erişim izni verilmiş olmalı (git kimlik bilgilerin çalışıyor olmalı).
3. Videoların duracağı **boş bir klasör** aç ve Claude Code'u orada başlat.
4. Sırayla:
   - `/content-studio:studio-setup`: sistemini algılar (Mac/Windows/Linux, çip, bellek, GPU), motoru klasöre kopyalar,
     gerekenleri **onayınla** kurar (Python 3.11 ortamları, Remotion, Whisper modeli), ses motorunu seçtirir, kısa bir test yapar.
   - `/content-studio:new-channel`: kanalını kurar: ad, konu, kitle, dil, ton, anlatıcı sesi ve **tasarım dili**
     (stil, kamera, geçişler, altyazı, renk, font, ses kimliği; sonunda 6-8 sn deneme klibi).
   - `/content-studio:shorts`: ilk bölümü üretir.

Tasarım dilini sonradan değiştirmek için: `/content-studio:design-language`.

## Gerekenler

- **Önerilen:** Apple Silicon Mac ya da Windows 10/11, 16 GB bellek, ~20 GB boş disk. Linux da olur; `studio-setup` sistemi
  algılayıp farkları söyler. Windows'ta önce Git for Windows, Geliştirici Modu ve uzun yol desteği gerekir
  ([KURULUM.md](KURULUM.md) 0b). Ses tasarımı (mlx) yalnızca Apple Silicon'da; diğer sistemlerde ses bulutta ya da hazır seslerle.
- **Ses için** biri: ücretsiz **Kaggle** hesabı (T4 GPU, önerilen) · yerel (NVIDIA GPU ya da yavaş CPU) · **Gemini** API anahtarı ·
  **ElevenLabs** (API anahtarıyla otomatik; anahtar yoksa sesi kendin üretip klasöre koyarsın).
- Remotion lisansı: bireyler ve en fazla 3 kişilik şirketler için ücretsiz; daha büyük şirketler şirket lisansı alır (remotion.dev/license).

## Güncelleme

Terminalde (masaüstü uygulamasında oturumun **Terminal** düğmesi):
```
claude plugin marketplace update content-studio
claude plugin update content-studio@content-studio
```
Sonra proje klasöründe `/content-studio:studio-setup --update`: motoru yeniler; senin elle değiştirdiğin dosyaları ezmez,
yeni sürümü yanına `.yeni` olarak koyar ve birleştirmeyi önerir.

## İçinde ne var

| Klasör | Ne |
|---|---|
| `plugins/content-studio/skills/` | shorts (orkestratör), studio-setup, new-channel, design-language, voice-pipeline, remotion-styles, sound-design, style-study, qa-checklist |
| `plugins/content-studio/agents/` | script-writer, localizer, voice-producer, visual-director, editor, qa-reviewer |
| `plugins/content-studio/engine/` | Projeye kopyalanan motor: `tools/` (Python araçları), `voice/` (ses hattı, Kaggle/Colab), `studio/` (Remotion, 13 stil, geçişler, altyazılar, editör), `catalog/` |
| `plugins/content-studio/library/lemo/` | Lemo-Opuscar stil tarifleri ve demo kodu (~67 stil, MIT sürümü) |
| `plugins/content-studio/library/cinecode/` | cinecode kamera/geçiş sözlüğü, görünüm aileleri, Türkçe denenmiş font eşleşmeleri, ses ve yazım referansları (MIT) |
| `plugins/content-studio/scripts/` | `detect_system.py`, `install_engine.py`, `design_menu.py` (stil arama), `style_board.py` (aday panosu), venv gereksinimleri |

Adım adım rehber (sıfırdan ilk videoya): [KURULUM.md](KURULUM.md).
Lisans: MIT ([LICENSE](LICENSE)). Üçüncü taraf lisansları: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Kurallar (stüdyo bunlara uyar)

- Gerçek kişi sesi klonlanmaz; yalnızca sentetik tasarım ses ya da izinli kendi ses.
- Her görsel/ses varlığı lisansıyla `assets.csv`'ye yazılır; yalnızca kanalın izin verdiği kaynaklar.
- Paket kurulumu ve dosya silme onaysız yapılmaz. Aynı anda tek ağır iş (TTS, render).
