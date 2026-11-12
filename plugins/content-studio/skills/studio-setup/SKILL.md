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

## 1. Sistemi algıla (her zaman ilk adım)
```
python3 "$PLUGIN/scripts/detect_system.py"          # insan okur
python3 "$PLUGIN/scripts/detect_system.py" --json   # sen okursun
```
Kullanıcıya kısa tablo göster: sistem, bellek, disk, eksik araçlar, öneri. Sistem beklenmedikse (Windows, 8 GB, GPU'lu Linux)
bunu açıkça söyle ve önerileri ona göre uyarla:
- **macOS Apple Silicon** (geliştirildiği ortam): her şey çalışır; ses tasarımı mlx ile yerelde.
- **macOS Intel**: mlx yok → ses tasarımı Kaggle'da ya da hazır profil; render yavaş (`--concurrency=2`).
- **Linux + NVIDIA**: yerel CUDA TTS en hızlısı (`device: cuda`); Kaggle gereksiz.
- **Windows**: WSL2 (Ubuntu) öner; yerel Windows'ta venv yolu `voice\.venv-chatterbox\Scripts\python.exe`, araçların
  komutlarında `voice/.venv-chatterbox/bin/python` yerine bunu kullan ve CLAUDE.md "Ortam" bölümüne yaz.
- **< 16 GB bellek**: yerel TTS yok, render `--concurrency=1`, ağır işler buluta.

## 2. Motoru kopyala
Klasör boş değilse önce içeriğine bak; başka bir projenin içine kurma (kullanıcıya sor).
```
python3 "$PLUGIN/scripts/install_engine.py" . --dry-run     # ne yazılacak
python3 "$PLUGIN/scripts/install_engine.py" .               # ilk kurulum
python3 "$PLUGIN/scripts/install_engine.py" . --update      # plugin güncellemesinden sonra
```
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
   | `elevenlabs` | Kullanıcının kendi hesabı | Ses dışarıda üretilir, `audio/<dil>/` altına konur (`voice/profiles/external_*.yaml`) |
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
| Homebrew / uv / Python 3.11 / Node | Diğer her şeyi kuran ve çalıştıran temel araçlar |
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

Komutlar (uv yoksa `python3.11 -m venv` + pip; adı her durumda `.venv-chatterbox`, araçlar bu yolu bekler):
```
uv venv --python 3.11 voice/.venv-chatterbox
uv pip install --python voice/.venv-chatterbox/bin/python -r "$PLUGIN/scripts/requirements/core-light.txt"   # ya da core.txt
uv venv --python 3.11 voice/.venv-mlx && uv pip install --python voice/.venv-mlx/bin/python -r "$PLUGIN/scripts/requirements/mlx.txt"
# isteğe bağlı: matte.txt → tools/.venv-matte, manim.txt → tools/.venv-manim, sam2.txt → tools/.venv-sam2
cd studio && npm ci
mkdir -p voice/models && curl -L -o voice/models/ggml-large-v3-turbo-q5_0.bin \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin
```
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
whisper-cli --help > /dev/null && echo whisper ok
```
Render'dan önce kullanıcıya sor (bilgisayarı birkaç dakika meşgul eder). Hata olursa düzelt ve DECISIONS.md'ye yaz.

## 6. Bitir
CLAUDE.md "Ortam" bölümünü sisteme göre doldur (python yolu, ses motoru, cihaz, whisper yolu). Sonra öner:
"Kanalını kuralım mı? → `/content-studio:new-channel`". Kanal zaten varsa (`channel.yaml`) `/content-studio:shorts`.

## İsteğe bağlı: Lemo-Opuscar 2.0 stilleri
Plugin, Lemo-Opuscar'ın MIT lisanslı son sürümünü (`.studio/plugin/library/lemo/`, ~67 stil) içerir. 2.0 ve sonrası
(99+ stil) CC BY-NC 4.0 + "kendi filmlerin için" iznidir; plugin'le dağıtılamaz. İsteyen kullanıcı kendisi kurar:
`/plugin marketplace add lemomo-ai/lemo-opuscar` → `/plugin install lemo-opuscar@lemolab`. O tarifler yalnızca onun kendi
filmleri içindir; bizim kütüphanemize kopyalanmaz.
