---
name: studio-setup
description: >
  Content Studio kurulumu: sistemi algılar (işletim sistemi, çip, bellek, GPU, disk, kurulu araçlar), motoru (tools, voice, studio,
  catalog) bu proje klasörüne kopyalar, ortamı adım adım ve onayla kurar (Python venv'leri, npm, Whisper modeli, ses motoru),
  sonunda duman testi yapar. Kullanıcı "kur", "kurulum", "studio-setup", "plugin'i güncelledim" dediğinde ya da `.studio/plugin`
  bağlantısı kırıksa kullan. --update: plugin güncellemesinden sonra motoru yeniler.
argument-hint: "[--update]"
---

# /studio-setup: stüdyoyu bu klasöre kur

Kural: **hiçbir paket onaysız kurulmaz.** Her kurulum komutunu önce göster, toplu onay al (AskUserQuestion), sonra çalıştır.
Uzun indirmeler (torch, node_modules, Whisper modeli) arka planda; aynı anda tek ağır iş.
Kullanıcı çoğu zaman yazılımcı değildir: her paketi **ne işe yaradığıyla** sade Türkçe anlat (aşağıdaki "Onay ekranı").

**Kaldığı yerden devam:** `.studio/engine-manifest.json` varsa motor zaten kopyalanmıştır: adım 2'yi atla (plugin sürümü
`.studio/plugin-version`'dan yeniyse `--update` öner), adım 3'te yalnızca eksik parçaları bul (venv var mı, `studio/node_modules`
var mı, Whisper modeli var mı) ve yalnızca onları sor. Daha önce "şimdi değil" denmiş kurulum böyle tamamlanır.

Plugin kökü (kurulu sürümün önbellek klasörü; `scripts/install_engine.py` içerir). Her Bash çağrısında yeniden tanımla:
```
PLUGIN="${CLAUDE_PLUGIN_ROOT}"
[ -f "$PLUGIN/scripts/install_engine.py" ] || PLUGIN=$(dirname "$(dirname "$(find ~/.claude/plugins/cache -path '*/content-studio/*/scripts/install_engine.py' | sort -V | tail -1)")")
echo "$PLUGIN"
```
(Kurulum yapılmışsa `.studio/plugin` zaten oraya bağlıdır.)

Sistem Python'u (venv kurulmadan önceki betikler için; Windows'ta `python3` çoğu zaman Microsoft Store kısayoludur ve çalışmaz):
```
SYSPY=""; for c in python3 python "py -3"; do $c -c "import sys; assert sys.version_info >= (3, 9)" 2>/dev/null && { SYSPY="$c"; break; }; done
[ -n "$SYSPY" ] || SYSPY="uv run --no-project --python 3.11 python"   # Python yoksa önce uv kurulur (adım 3, sistem araçları)
echo "$SYSPY"
```
Venv kurulduktan sonra plugin betikleri de stüdyonun Python'uyla çalışır: `voice/.venv-chatterbox/bin/python .studio/plugin/scripts/...`
(Windows'ta da aynı yol: `make_venv.py` oraya bir yönlendirici yazar).

## 1. Sistemi algıla (her zaman ilk adım)
```
$SYSPY "$PLUGIN/scripts/detect_system.py"          # insan okur
$SYSPY "$PLUGIN/scripts/detect_system.py" --json   # sen okursun
```
Kullanıcıya kısa tablo göster: sistem, bellek, disk, eksik araçlar, öneri. Sistem beklenmedikse (Windows, 8 GB, GPU'lu Linux)
bunu açıkça söyle ve önerileri ona göre uyarla:
- **macOS Apple Silicon** (geliştirildiği ortam): her şey çalışır; ses tasarımı mlx ile yerelde.
- **macOS Intel**: mlx yok → ses tasarımı Kaggle'da ya da hazır profil; render yavaş (`--concurrency=2`).
- **Linux + NVIDIA**: yerel CUDA TTS en hızlısı (`device: cuda`); Kaggle gereksiz.
- **Windows** (yerelde desteklenir): Claude Code komutları Git Bash'te çalıştırır, bu yüzden bütün komutlar macOS'takiyle aynıdır.
  Farklar ve ön koşullar (detect çıktısındaki `windows_setup` listesi; eksik olanları kullanıcıya adım adım yaptır, yönetici
  gerektirenleri **kullanıcı kendisi** yapar):
  1. Git for Windows (Git Bash) · 2. Geliştirici Modu (sembolik bağlar) · 3. Uzun yol desteği · 4. Claude Code yerel kurulum (claude.exe).
  - Araç kurulumu `winget` ile (`install_*` satırları). Homebrew yoktur.
  - whisper.cpp: hazır Windows paketi (`whisper-bin-x64.zip`, NVIDIA varsa cublas sürümü) indirilir, `whisper-cli.exe` ve
    `.dll`'leri `voice/bin/` altına çıkarılır (`tools/platform_util.py` orada arar; PATH'e eklemek gerekmez).
  - Venv'ler yalnızca `make_venv.py` ile kurulur (Windows'ta `<venv>/bin/python` yönlendiricisini yazar ve UTF-8 modunu açar;
    elle `uv venv` kurulursa yönlendirici için: `$SYSPY "$PLUGIN/scripts/make_venv.py" <venv> --shim-only`).
  - mlx yok: ses tasarımı Kaggle/Gemini/ElevenLabs ya da hazır profil. NVIDIA varsa yerel CUDA TTS hızlıdır (`core.txt`, cihaz `cuda`).
  - Bellek bekçisi `tools/memwatch.py` (Windows'ta da çalışır). Render GPU'su ANGLE/Direct3D.
  - Sorun çıkarsa WSL2 (Ubuntu) alternatiftir; orada Linux yolu izlenir.
- **< 16 GB bellek**: yerel TTS yok, render `--concurrency=1`, ağır işler buluta.

## 2. Motoru kopyala
Klasör boş değilse önce içeriğine bak; başka bir projenin içine kurma (kullanıcıya sor).
```
$SYSPY "$PLUGIN/scripts/install_engine.py" . --dry-run     # ne yazılacak
$SYSPY "$PLUGIN/scripts/install_engine.py" .               # ilk kurulum
$SYSPY "$PLUGIN/scripts/install_engine.py" . --update      # plugin güncellemesinden sonra
```
`--update` sonrası ayar birleştirme: `.claude/settings.json` kullanıcınındır ve ezilmez; plugin'deki sürümle
(`"$PLUGIN/engine/.claude/settings.json"`) karşılaştır, eksik `env` anahtarlarını (ör. `PYTHONUTF8`) ve eksik `permissions.allow`
satırlarını ekle, kullanıcının eklediklerine dokunma. Windows'ta venv'lerde `bin/python` yönlendiricisi yoksa
`make_venv.py <venv> --shim-only` ile yaz.
`--update` çakışma bildirirse (`<dosya>.yeni`): iki sürümü karşılaştır, kullanıcının değişikliğini koruyarak birleştir, `.yeni`'yi
kullanıcı onayıyla sil. `git init` yoksa öner (bölümler büyük; `.gitignore` render/ses çıktılarını dışarıda tutar).

## 3. Önce seçimler, sonra kurulum (gereksiz indirme yok)
Kurulumdan ÖNCE tek AskUserQuestion turunda sor (detect önerisi ilk seçenek); kurulacaklar bu cevaplara göre çıkar:
1. **Ses motoru** (`voice.backend`):
   | Motor | Ne gerekir | Not |
   |---|---|---|
   | `kaggle` | Kaggle hesabı + telefon doğrulama + API anahtarı (`~/.kaggle/`), `kaggle` CLI (`uv tool install kaggle`) | Ücretsiz T4, Mac boşta; `voice/kaggle/README.md` |
   | `local` | Chatterbox (torch, ~1.2 GB + model) | 16 GB Mac'te CPU ~1 dk/sahne; NVIDIA'da hızlı |
   | `gemini` | `.env` → `GEMINI_API_KEY` (değeri asla yazdırma) | Hazır sesler; ücretsiz katman günde ~10 istek; `tools/gemini_tts.py` |
   | `elevenlabs` | ElevenLabs hesabı + `.env` → `ELEVENLABS_API_KEY` (kullanıcı kendisi yazar; değeri asla yazdırma) | Sesler otomatik üretilir ve Whisper kontrolünden geçer (`voice/synth.py`, profil `elevenlabs_<dil>.yaml`); karakter başına ücretli. Anahtar yoksa: kullanıcı sesi web arayüzünden üretip `audio/<dil>/` altına koyar (`external_<dil>.yaml`) |
2. **Kanala özel ses tasarımı** yerelde mi? (yalnızca Apple Silicon; mlx ortamı + Qwen VoiceDesign modeli ilk kullanımda iner, birkaç GB)
   Hayırsa: hazır profil, Gemini hazır sesleri ya da Kaggle'da tasarım.
3. **İsteğe bağlı araçlar** (multiSelect, hepsi sonradan eklenebilir): fotoğraftan nesne kesme (matte, ~600 MB) ·
   bilim animasyonu (manim, ~350 MB + sistem kütüphaneleri) · videodan nesne maskesi (sam2, ~600 MB + model).

**Kurulum matrisi** (yalnızca seçilenler; toplam boyutu kullanıcıya önceden söyle):
| Parça | Ne zaman | Boyut |
|---|---|---|
| Sistem: Python 3.11 (uv), Node ≥ 20, ffmpeg, whisper.cpp | her zaman (eksikse) | ~300 MB |
| `voice/.venv-chatterbox` + `core.txt` (torch + Chatterbox) | `local` motor | ~1.2 GB + model ilk kullanımda iner |
| `voice/.venv-chatterbox` + `core-light.txt` (yaml, numpy, librosa, soundfile, scipy, pillow) | `kaggle`, `gemini`, `elevenlabs` | ~250 MB |
| `voice/.venv-mlx` + `mlx.txt` | yerel ses tasarımı (Apple Silicon) | ~400 MB + model ilk kullanımda |
| `tools/.venv-matte` / `.venv-manim` / `.venv-sam2` | isteğe bağlı araç seçildiyse | yukarıda |
| `studio/node_modules` (`npm ci`) | her zaman (render) | ~1.5 GB |
| Whisper modeli `ggml-large-v3-turbo-q5_0.bin` | her zaman (altyazı zamanlaması ve ses kapısı her motorda gerekir) | ~550 MB |
| `kaggle` CLI | `kaggle` motor | küçük |
Hafif kurulumda (`core-light`) eksik olan tek şey ses kimliği benzerlik ölçümüdür (synth.py uyarı verip atlar; WER, kesik
cümle ve süre kontrolleri sürer). Sonradan yerel TTS istenirse aynı venv'e `core.txt` kurulur.

**Onay ekranı** (kurulumdan hemen önce; önce kısa bir tablo yaz, sonra tek AskUserQuestion). Tablo: her satır bir parça,
sütunlar *ne işe yarar · boyut · zorunlu mu*. Sade açıklamalar (yalnızca kurulacak olanları göster):
| Parça | Ne işe yarar (kullanıcıya böyle anlat) |
|---|---|
| Homebrew (macOS) / winget + Git for Windows (Windows) / uv / Python 3.11 / Node | Diğer her şeyi kuran ve çalıştıran temel araçlar |
| ffmpeg | Ses ve videoyu kesip birleştirir, dönüştürür; neredeyse her adım kullanır |
| whisper.cpp + Whisper modeli | Anlatımı dinleyip yazıya döker: altyazıların kelime kelime zamanlaması ve sesin doğru okunup okunmadığının kontrolü |
| Python ortamı (hafif) | Stüdyonun araçları: senaryo/storyboard doğrulama, ses kontrolü, miks, yayın paketi |
| Python ortamı (tam, torch + Chatterbox) | Yukarıdakiler + anlatıcı sesini bu bilgisayarda üretmek |
| Ses tasarımı ortamı (mlx) | Kanala özel yeni bir anlatıcı sesini yazılı tariften tasarlamak |
| Remotion (npm) | Videoyu kodla çizen ve MP4 olarak çıkaran motor; render için şart |
| Fontlar | Altyazı ve başlık yazı tipleri (açık lisanslı), internetsiz render için |
| Kaggle CLI | Sesi ücretsiz bulut GPU'sunda üretmek için |
| matte / manim / sam2 | İsteğe bağlı: fotoğraftan nesne kesme / bilim animasyonu / videodan nesne maskesi |
Tablonun altında toplam indirme ve tahmini süre. Sonra seçenekler:
1. **Hepsini kur (Önerilen)**: listedeki her şey; arka planda, bu sırada bilgisayar kullanılabilir.
2. **Yalnızca zorunlular**: isteğe bağlı araçlar ve ses tasarımı ortamı hariç.
3. **Şimdi değil**: hiçbir şey kurulmaz; kanal kurulumu ve video üretimi bunlar olmadan çalışmaz. Sonra
   `/content-studio:studio-setup` kaldığı yerden devam eder.

Komutlar (her işletim sisteminde aynı; venv adları sabit, araçlar bu yolları bekler):
```
$SYSPY "$PLUGIN/scripts/make_venv.py" voice/.venv-chatterbox core-light    # ya da core (yerel TTS)
$SYSPY "$PLUGIN/scripts/make_venv.py" voice/.venv-mlx mlx                  # yalnızca Apple Silicon, ses tasarımı
# isteğe bağlı: make_venv.py tools/.venv-matte matte · tools/.venv-manim manim · tools/.venv-sam2 sam2
(cd studio && npm ci)
mkdir -p voice/models && curl -L -o voice/models/ggml-large-v3-turbo-q5_0.bin \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin
uv tool install kaggle                                                      # yalnızca kaggle motoru
```
Windows whisper.cpp (Homebrew yerine): kullanıcıya github.com/ggml-org/whisper.cpp/releases sayfasından `whisper-bin-x64.zip`'i
indirmesini söyle (dosya indirmeyi sen yapma; onaylı olarak `curl -L -o` ile de olur), sonra `mkdir -p voice/bin` ve zip içindeki
`whisper-cli.exe` + `*.dll` dosyalarını oraya çıkar (`unzip -j <zip> '*/whisper-cli.exe' '*.dll' -d voice/bin` ya da Explorer).
Remotion lisansı: bireyler ve ≤3 kişilik şirketler ücretsiz; daha büyük şirketler şirket lisansı alır (remotion.dev/license).
Kullanıcıya bir cümleyle söyle.
Fontlar (OFL, ağsız render için): `voice/.venv-chatterbox/bin/python tools/fetch_fonts.py`.
CC0 ses havuzu: `voice/.venv-chatterbox/bin/python tools/sounds.py --help` (Kenney paketleri; sound-design skill'i).

## 4. Seçimleri kaydet
`channel.yaml voice.backend` (kanal varsa; yoksa new-channel yazar) ve CLAUDE.md "Ortam" bölümü: motor, kurulan venv'ler
(hafif/tam), isteğe bağlı araçlar. Anahtar/şifreyi sen girme; kullanıcı dosyaya kendisi koyar.
Motor sonradan değişirse (ör. elevenlabs → local) yalnızca eksik parçayı kur (`core.txt`), gerisine dokunma.

## 5. Duman testi (proportional: kısa ve tek tek)
```
voice/.venv-chatterbox/bin/python -c "import yaml, numpy, librosa, soundfile; print('python ok')"
voice/.venv-chatterbox/bin/python voice/textnorm.py        # metin normalleştirme örneği
cd studio && npx tsc --noEmit && npx remotion render src/index.ts Smoke out/smoke.mp4 --concurrency=2   # render (onayla; ağır iş)
voice/.venv-chatterbox/bin/python -c "import sys; sys.path.insert(0, 'tools'); from platform_util import whisper_cli; print('whisper', whisper_cli())"
voice/.venv-chatterbox/bin/python tools/memwatch.py          # bellek bekçisi (boş bellek yüzdesi)
```
Render'dan önce kullanıcıya sor (bilgisayarı birkaç dakika meşgul eder). `Smoke` hiçbir dış dosya gerektirmez (sessiz, yerleşik altyazı); başka kompozisyonla test etme. Hata olursa düzelt ve DECISIONS.md'ye yaz.

## 6. Bitir
CLAUDE.md "Ortam" bölümünü sisteme göre doldur (işletim sistemi, ses motoru, cihaz, whisper yolu; Windows'ta Geliştirici Modu
ve uzun yol durumu). Python yolu her sistemde `voice/.venv-chatterbox/bin/python`'dur. Sonra öner:
"Kanalını kuralım mı? → `/content-studio:new-channel`". Kanal zaten varsa (`channel.yaml`) `/content-studio:shorts`.

## İsteğe bağlı: Lemo-Opuscar 2.0 stilleri
Plugin, Lemo-Opuscar'ın MIT lisanslı son sürümünü (`.studio/plugin/library/lemo/`, ~67 stil) içerir. 2.0 ve sonrası
(99+ stil) CC BY-NC 4.0 + "kendi filmlerin için" iznidir; plugin'le dağıtılamaz. İsteyen kullanıcı kendisi kurar:
`/plugin marketplace add lemomo-ai/lemo-opuscar` → `/plugin install lemo-opuscar@lemolab`. O tarifler yalnızca onun kendi
filmleri içindir; bizim kütüphanemize kopyalanmaz.
