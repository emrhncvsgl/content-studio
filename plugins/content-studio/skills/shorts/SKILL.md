---
name: shorts
description: >
  Video bölümü üretim hattının orkestratörü (/shorts). Kullanıcı yeni bir Short/video bölümü üretmek,
  yarım kalan bir bölüme devam etmek ya da bir bölümün sahnesini/sesini/görselini yeniden yapmak istediğinde kullan
  ("yeni bölüm", "serinin 3. bölümü", "EP002'ye devam et", "/shorts"). Kısa bir röportajla brief'i kurar,
  ajanları (script-writer, localizer, voice-producer, visual-director, editor; qa-reviewer yalnızca istenirse) sırayla çağırır,
  üç onay noktasında durur ve state.json ile kaldığı yerden devam eder.
argument-hint: "[kaynak no | konu | bölüm kodu] [ek istekler]"
---

# /shorts: bölüm üretim orkestratörü

Sen orkestratörsün: işi kendin yapmazsın, doğru ajana devreder, sözleşme dosyalarını doğrular, durumu tutar ve
kullanıcıyı onay noktalarında bilgilendirirsin. Kanala özgü her şey `channel.yaml`'dadır; bu skill kanaldan bağımsızdır.

## 0. Başlarken (her seferinde)
1. **Kanal:** varsayılan kökteki `channel.yaml`; diğerleri `channels/<id>/channel.yaml` (`tools/channel.py` listeler). Bölümün kanalı
   `brief.yaml channel:`; yeni bölüm `new_episode.py --channel <id>` (klasör öneki kanalın `episode_prefix`'i, ör. IYH001). Kanalın
   `religious_guidelines`/`forbidden` gibi kuralları senaryo ve storyboard ajanlarına AYNEN verilir. Sonra oku: kanal dosyası, `CLAUDE.md`. Gerekirse `docs/DECISIONS.md`'nin en üst kayıtları.
2. Argüman bir bölüm (`EP002`) ya da var olan bir klasörse → **devam modu**:
   `voice/.venv-chatterbox/bin/python tools/state.py show <bölüm>` ve `... next <bölüm>` çalıştır, sıradaki adımdan sürdür.
3. Değilse → **yeni bölüm**, adım 1'e geç.

Python araçları her zaman `voice/.venv-chatterbox/bin/python` ile çalışır (yaml, numpy orada).

## 1. Röportaj (brief)
Bu bir sohbettir, form değil: kullanıcı istediği an konuyu değiştirebilir, soru sorabilir, "bilmiyorum" diyebilir. Ona göre uyum sağla.

### 1a. Konu belli değilse: konu keşfi (birlikte tartış)
Kullanıcı "bilmiyorum", "bir buluş hikâyesi olsun ama ne bilmiyorum" gibi bir şey derse **soru formuna geçme, öneri sun**:
1. `content/ideas.yaml`'ı oku (önceki öneriler, beğenilenler, reddedilenler); daha önce reddedilenleri tekrar önerme.
2. 5-6 aday öner, her biri tek satır özet + şu sütunlar: **hook** (ilk cümle önerisi) · **kanal bağı** (kanalın konusuna nasıl bağlanıyor;
   `channel.yaml about`, seri varsa hangi kaynak kaydı) · **doğrulanabilirlik** (güvenilir kaynak var mı, WebSearch ile hızlı kontrol) · **görsel** (Commons'ta fotoğraf
   var mı → `tools/find_images.py search`, yoksa kodla çizim) · **format** (fotoğraflı hikâye / çizim / karma).
   Adayları çeşitlendir: ünlü + az bilinen, eski + modern, gündelik ürün + mühendislik.
3. Kullanıcının tepkisine göre daralt ("daha az bilinen", "gündelik bir ürün", "şu ikisini karşılaştır"), gerekirse yeni tur öner.
4. Seçilen konuyu, ilginç bulunup ertelenenleri ve reddedilenleri (kısa nedenle) `content/ideas.yaml`'a yaz:
   `{id, title, status: chosen|later|rejected, why, source_id, hook, sources, date}`. Böylece fikir havuzu birikir.
Serbest konu bölümü (`new_episode.py --topic`) seri dışıdır (`series: standalone`); konu bir seri kaydını örnekliyorsa bunu senaryoda söyle.

### 1b. Eksik ayarlar
Argümanlardan ve sohbetten çıkarabildiğini sorma. Eksikleri **tek seferde** AskUserQuestion ile sor (en fazla 4 soru):
- **Konu**: seri bölümüyse kaynak kaydı no (`channel.yaml series[].source`); serbest konu da olabilir.
- **Görsel tarz** (her bölümde sor; bir önceki bölümün tarzı varsayılan değildir): seçenekler
  `belgesel kolaj karışımı` (önerilen: vox-explainer sahneleri + arasında archival-film / ken-burns-photo; EP002 düzeni) /
  `fotoğraflı hikâye` (ken-burns-photo, archival-film) / `kodla çizim` (blueprint-diagram, kinetic-type…) / katalogdan belirli bir id ya da
  "şu videodaki gibi" referansı. Seçenek açıklamasında karışabilen stilleri `catalog/styles.yaml → mix_with`'ten kısaca yaz.
  Seçilen stilin `.studio/plugin/skills/remotion-styles/<id>.md` talimatında isteğe bağlı efektler varsa (vox: stop-motion, halftone) aynı soruda
  "ekstralar" olarak sor (multiSelect).
- **Dil**: channel.yaml `languages.active` dışında bir dil istenirse durumu açıkla (ör. o dilin anlatıcı sesi henüz yok).
- **Süre/format**: varsayılan `formats.short.target_seconds`.
Ses, ton, CTA kanal varsayılanlarından gelir; kullanıcı açıkça istemedikçe sorma.

Sonra:
```
voice/.venv-chatterbox/bin/python tools/new_episode.py --source 02 [--series <id>] [--style ...] [--notes "kullanıcı istekleri"]
voice/.venv-chatterbox/bin/python tools/validate.py brief <bölüm>/brief.yaml
voice/.venv-chatterbox/bin/python tools/state.py set <bölüm> brief done
```
Kaynak kaydı (`channel.yaml content_sources` klasöründe `<id>-*.yaml`) yoksa: script-writer'a önce onu hazırlat (tanım + doğrulanmış örnekler),
kullanıcıya göster, sonra devam et.

## 2. Senaryo → ONAY 1
- **script-writer** ajanını çağır (girdi: bölüm klasörü). Ajan `script.<ana_dil>.json` yazar ve doğrular.
- Kullanıcıya sahne tablosu göster: id · metin · duygu · tahmini süre · görsel ipucu. Kaynak/doğrulama notlarını da ekle.
- **Her zaman Türkçe özet de yaz** (kullanıcı isteği 2026-10-27): (1) olayın/hikâyenin genel özeti (kim, ne zaman, sorun, çözüm),
  (2) senaryonun sahne sahne Türkçe karşılığı (birebir çeviri değil, ne anlattığı). Senaryo her değiştiğinde özeti de güncelle.
- `state.py set <bölüm> approve_script waiting_approval`. Onay → `done`. Değişiklik isteği → script-writer'a geri ver.
- `channel.yaml approval.script: false` ise bu onayı atla (`skipped`).

## 3. Yerelleştirme (yalnızca lang: both)
- **localizer** ajanı → `script.<diğer_dil>.json`. Aksi halde `localize skipped`.

## 4. Ses
Motor `channel.yaml voice.backend`'den gelir (`/studio-setup` seçer): `kaggle` (aşağıdaki akış) · `local` (`voice/synth.py` yerelde,
CUDA varsa `device: cuda`; Mac'te önce sor) · `gemini` (`tools/gemini_tts.py`, kanalın `gemini_voice`/`gemini_style` ayarı, sonra
`synth.py --choose`/Whisper kapısı) · `elevenlabs`/dış ses (kullanıcı sahne seslerini `audio/<dil>/` altına koyar; sen yalnızca
Whisper kapısı ve anlatım birleştirmesini yaparsın). Alan yoksa `kaggle`.
- **Kaggle T4, tarayıcısız** (Remote Control ile telefondan da çalışır; `voice/kaggle/README.md`).
  Yalnızca chatterbox motorları. Kullanıcıdan hiçbir elle adım istenmez.
  1. Arka planda: `voice/.venv-chatterbox/bin/python -u tools/kaggle_voice.py run <bölüm>` (~10 dk: kurulum ~3 dk, model ~1 dk, üretim ~5 dk;
     sonra Mac'te Whisper kapısı + seçim + anlatım otomatik). Yarıda kalırsa `status` / `fetch <bölüm>`.
  2. `audio/<dil>` zaten varsa unpack reddeder; bilerek üzerine yazılacaksa `--force`, deneme için `-- --run <ad>` (→ `audio/_trials/<ad>`).
  3. **voice-producer** ajanı `report.json`'u okur, eşik dışı sahneleri Mac'te `--only sNN` ile yeniden üretir.
- **Mac'te ağır iş kullanıcıya sorulmadan başlatılmaz** (kullanıcı 2026-11-10, EP010: 10 karakter repliği sormadan Mac'te üretildi, o sırada başka işle
  meşguldü). TTS'in tamamı Kaggle'da: anlatıcı da, birkaç cümlelik karakter replikleri ve yeniden üretimler de; "kısa iş, Mac'te daha hızlı" gerekçe değil.
  Mac'te TTS, toplu Whisper, Remotion render (deneme klibi dahil) ya da uzun bir yerel iş gerekiyorsa önce sor: ne, ne kadar sürer, Kaggle seçeneği var mı.
  Ajanlara verilen görevde de bu yazılır.
- Yedek: Colab (`tools/colab_voice.py pack/unpack`, `voice/colab/README.md`): kullanıcı T4 seçer, zip seçer, runtime'ı elle kapatır
  (colab-mcp `runtime.unassign()` çalışmıyor). Yalnızca Kaggle kotası biterse ya da Kaggle erişilemezse.
- GPU verilmezse ya da motor chatterbox değilse: eski yol, **voice-producer** tüm bölümü Mac CPU'da üretir (~1 dk/sahne/deneme, arka planda);
  bu sırada başka ağır iş (render, ikinci TTS, Whisper toplu) başlatma (PLAN ilke 2).
- Sonuç: `audio/<dil>/sNN.wav`, `audio/<dil>/narration.wav`, `audio/<dil>/report.json`. Kullanıcıya anlatım dosyasını göster;
  sorunlu sahne bildirilirse yalnızca o sahneyi yeniden ürettir (`--only sNN`).

## 4b. Görsel av listesi (kullanıcı akışı, 2026-11-05)
Senaryo onaylanınca, storyboard ajanını çağırmadan önce orkestratör kendisi kısa bir liste yazar: sahne · aranan nesne/görsel · arama kelimeleri (EN) ·
bakılacak site · ne için kullanılacağı (sahne, geçiş nesnesi, kapak). En çok 10-12 satır, önce en önemliler. Kullanıcı bulduklarını `<bölüm>/assets/inbox/` klasörüne
koyar, sayfa bağlantılarını `inbox/links.txt`'ye ya da sohbete yazar. Sonra **visual-director** önce inbox'ı kullanır, lisansı doğrular, yalnızca eksikleri kendisi arar.
İsteğe bağlıdır: kullanıcı her videoda arayamayabilir, keyfine bağlı. Senaryo onayında tek satırla sor ("görselleri sen mi arayacaksın, ben mi?"); "sen bul" derse ya da yanıt yoksa bu adım atlanır, **visual-director** her zamanki gibi kendisi bulur. Bunun için ısrar etme.

## 5. Storyboard → ONAY 2   *(yalnızca catalog'da implemented: true stiller)*
- **visual-director**: 1b'deki tarz ve ekstralara göre sahne başına stil + görsel (lisanslı fotoğraf ya da kodla çizim planı), `assets.csv`, `storyboard.md`.
  Stil talimatı varsa (`.studio/plugin/skills/remotion-styles/<id>.md`) onu uygular.
- Kullanıcıya storyboard'u göster: sahne · stil · tarif (ör. vox A/B/C/D) · zemin/ışık satırı · görsel küçük resmi + kaynak + lisans.
  Denenmemiş bir seçenek (ör. çeşitlilik tablosunun yeni satırı) kullanıldıysa işaretle. Onay / sahne bazında stil değişikliği.

## 6. Timeline + render
- **visual-director** → senaryoya görsel ayarlar + `tools/build_timeline.py` → `timeline.json`; **editor** → `render/<EP>.mp4`.
- Render ağır iştir; ses üretimiyle aynı anda yapılmaz. 45 sn ≈ birkaç dakika (CPU, concurrency 2).

## 7. Kullanıcı izler → ONAY 3
- **Varsayılan: qa-reviewer çalıştırılmaz** (kullanıcı kararı 2026-10-25: QA çok token harcıyor, videoyu kendisi izleyip karar veriyor).
  Videoyu (`render/<EP>.final.mp4`) kullanıcıya ver; yalnızca bu turda değişen şeyleri tek kare ya da kırpıntıyla kendin kontrol et.
- Kullanıcının sahne bazındaki notlarını ilgili ajana ver, yeniden render al, tekrar göster.
- **qa-reviewer yalnızca kullanıcı isterse** çalışır → `qa_report.md` (geç/kal). Kal ise ilgili ajana düzeltme notuyla geri ver; en fazla 2 tur.

## 8. Yayın paketi
```
voice/.venv-chatterbox/bin/python tools/package.py <bölüm> --cover <sn>
```
- Üretir: `captions/<dil>.srt` (+ .json), `render/<EP>.final.mp4` (−14 LUFS, tepe ≤ −1 dBTP), `render/<EP>.<dil>.wav`
  (yalnızca-ses, MLA), `render/cover.png`, `publish.<dil>.yaml` iskeleti (süre, ses ölçümleri, dosyalar, atıflar, sentetik ses notu).
- Sahne başına ses ölçümü de basılır (`[ses] … işaret`, spektrogram `render/qc/`): işaretli sahneleri kullanıcıya videoyla birlikte
  "şu saniyeleri dinle" diye söyle (sound-design skill §6).
- Kapanış logosu: `channel.yaml brand.outro` doluysa `package.py` `.final.mp4` ve yalnızca-ses parçasının sonuna otomatik ekler (~2,5 sn); istisna için `--no-outro`.
- Kapak: varsayılan **derinlikli kolaj kapağı** (Cover kompozisyonu; tarif `remotion-styles/vox-explainer.md §9`, araçlar
  `depth-elements.md`): `clips/cover.json` → `npx remotion still src/index.ts Cover <png> --frame=60 --props=../content/episodes/<EP>/clips/cover.json`.
  `package.py` `render/cover.png`'yi videodan yeniden üretir → **paketten sonra** kendi kapağını `render/cover.png`'ye kopyala
  (her yeniden paketlemede tekrar). Ana nesne kesiği: `tools/cutout.py <foto> <png> --sticker`.
- Sonra `publish.<dil>.yaml` içinde **sen yaz** (kullanıcı tercihi, hafıza: asset-licensing-preference): `title` (≤ 70 karakter, hook ile uyumlu),
  `description` = hook + 2-3 cümle hikâye/fizik özeti + yalnızca ZORUNLU atıflar (CC BY görseller, müzik: "Satie, Gnossienne No. 1 (own
  recording); piano samples: Salamander Grand Piano by Alexander Holm (CC BY 3.0)") + hashtag satırı. Kaynak listesi ve "AI-generated"
  satırı YOK; sentetik içerik bildirimi YouTube Studio onay kutusundan (kullanıcıya hatırlat). `hashtags` ≤ 5, #Shorts dahil. Kullanıcıya göster.
- Paket ONAY 3'ten önce üretilir; kullanıcı yayın miksini (`.final.mp4`) izler (sıra: render → paket → kullanıcı izler → ONAY 3).

## 9. Uzun video (≥ 5 dk, 16:9; EP009 ile kuruldu, 2026-11-08/09)
Aynı hat, ek kurallar ve araçlarla. Kurallar kullanıcı notlarından; ayrıntılar başvurdukları skill'lerde.
- **Senaryo:** script-writer "Uzun video" (perde/bölüm `acts`, merak haritası, 2-4 anahtar an, **110-130 kelime/dk**, cümle ≤ 9 kelime,
  duraklamalar sayıyla: `scene_gap_s 0.6`, `sentence_pause_ms 400`, `tail_ms`, soğuk açılış `intro.ms`). Alıntı/diyalog sahnesi `speaker` +
  `medium` + `reenactment_of` (sound-design §7b; karakter sesi tasarımı voice-pipeline). Uzun gelen bölüm kesilir, metindeki sayımlar düzeltilir.
- **Ses:** anlatıcı ve karakter koşuları ayrı (`synth.py` speaker sahnelerini ayırır), `synth.py --merge RUN...` ortam işlemesiyle birleştirir.
  Kaggle'da paralel iş: `tools/kaggle_voice.py run --job "--voice X --run Y" ...`; bağlantı koparsa `fetch --slug`.
- **Storyboard:** perde perde (önce 1-2, sonra 3-5); geçiş türlerini karıştır: nesneli geçiş (en güçlü yanımız, yer/zaman/konu değişiminde), sis/karanlığa iniş, şekil eşleşmeli kesme, kamera hareketiyle geçiş (whip, pull-back), görünmez/düz kesme; hiçbiri her yerde değil (kullanıcı 2026-11-09: "nesne geçişini çok iyi yapıyorsun, diğerlerini de geliştirince çoğu videoda mixlenir"). Diğer türleri de nesneli geçiş kadar özenli yap, perde başına portal/zoomblur ≤ 2;
  tek kaynaklı gece/hapis/diyalog anları `woodcut` (three.js, `remotion-styles/three-scenes.md`). Görsel yönetmen perde başına bir
  `visuals_pNN.py` betiği yazar (yeniden çalıştırılabilir).
- **Aşırı hızlı geçiş ve ani müzik değişimi yok** (kullanıcı 2026-11-09, EP009 s59→s60 gözlük portalı): bir sahneden ötekine, özellikle yer/zaman
  değişen nesneli geçişlerde (portal, pullback) seyirciye hazırlık payı ver: önce `dim` ile hedefin dışı kararır (≈1.5-2 sn), dalış ≥ 1.3 sn,
  oturma ≥ 1.2 sn (`transition: {type: portal, target, dim: 1800, pre: 1500, post: 1400}`). Müzik hiçbir kesmede aniden değişmez: parça
  değişimi yalnız bölüm başlığının sessiz payında ya da ≥ 4 sn eşit güçlü çapraz geçişle (sound-design §7). Storyboard'da her geçişin süresini yaz;
  1 sn'den kısa portal/zoomblur yalnız bilerek (enerjik montaj) ve art arda değil.
- **Bölüm geçişi:** anlatıcı susar, başlık yeni bölümün ilk görüntüsünde (`lead` + `props.chapter`, ChapterTitle), kendi sesiyle (sound-design §7).
- **Müzik:** bölüm başına parça, tek dosya olarak kurulur (`build_music.py` kalıbı), bazı bölümler hareketli.
- **Kapanış:** bekleyişsiz yumuşak son + 16:9 kanal logosu (`tools/make_outro_pieces.py --landscape`).
- **Altyazı:** sayılar/yıllar rakamla (build_timeline `numberize_caption`, EN); ipuçları konuşulan yazımla (`cueWords`).
- **Build sırası:** `visuals_p*.py` → (bölüm lead betiği) → `tools/build_timeline.py <bölüm klasörü>` → Manim render betikleri →
  build_timeline (yeniden) → müzik betiği → `post_timeline.py` → `tools/validate.py timeline` → `tools/woodcut_render.py <EP> [--force]`.
- **Render:** `tools/render_chunked.py <EP> render/<EP>.mp4` (PNG ara kare ~3 MB/kare; tek parça 10 dk ≈ 50 GB → disk doldu). Başlamadan disk ≥ 8 GB boş.
  Arka plan işinde sonucu dosyayla doğrula (`| tail` çıkış kodunu yutar). Taslak sesi paketten önce −21 LUFS: dinleme kopyası loudnorm −14;
  telefona gönderim ≤ 30 MB (854 px, ~300 kb/s).
- **Düzeltme turu (izleme notlarından sonra) tam render etmeden:**
  - yalnız ses değişti (müzik, efekt, seviye) → `tools/mix_audio.py <EP> render/<x>.audio.wav --video <eski.mp4> --out <yeni.mp4>`
    (Remotion'suz, ~30 sn; Remotion sesi 10 dk'da ~25 dk sürüyordu; MusicBed ducking'iyle ölçülerek eşlendi, medyan fark 0.0 dB).
  - birkaç sahnenin görüntüsü değişti, süreler aynı → `tools/render_patch.py <EP> --scenes sNN ... --base <eski.mp4> --out <yeni.mp4> --audio <wav>`
    (sahne ±1 sn yeniden render, kalan video kare doğruluğuyla korunur, ~15 dk).
  - süreler değişti → tam render (`render_chunked.py`). Kullanıcıya süre tahmini verirken bu üç yoldan hangisi olduğunu söyle.
- **Kendi zincirini önce kontrol et:** dinleme/karşılaştırma dosyası teslimden önce kaynağıyla ölçülür (sound-design §6).
- **Animatic (tam render'dan önce; cinecode film-mode, 2026-11-09):** `tools/animatic.py <EP> [--per-scene 1|2|3] [--scenes sNN ...]` →
  `render/<EP>.animatic.mp4`: sahne başına 1-3 durağan kare (altyazılı) + gerçek karışım (mix_audio). 7 sahne/64 sn ≈ 15 sn, tüm film birkaç dk.
  Kullanıcıya önce bunu ver: tempo, sıra, sessizlikler, müzik geçişleri burada onaylanır; hareket/geçiş kalitesi tam render'da. Kareler
  `studio/scripts/stills.mjs` (tek paketleme + tek tarayıcı). ⚠ `bundle()` public klasörü (content/, GB'larca) kopyalar → `symlinkPublicDir: true`
  şart (EP009 ENOSPC); yeni bir Node render betiğinde de aynı.
- **İzleme turu notları:** her tur `tools/notes.py new <EP> --video <v> --text "m:ss not | m:ss-m:ss not | genel not"` → `notes/round-N.md`
  (ham not kelimesi kelimesine + zaman→sahne tablosu); tek zaman sorgusu `notes.py where <EP> 7:59`. Düzeltince `notes.py set <EP> N sNN CHANGED "ne yapıldı"`;
  kullanıcı bir şeyi beğendiyse `KEPT` (kilitli: sonraki turlarda dokunulmaz, `notes.py kept <EP>`). Sohbet sıkıştırılsa da notlar dosyada kalır.
- **Ritim:** `validate.py timeline` sahne süresi yayılımını (< 0.30 uyarı), art arda 5 benzer süreyi ve perde ortalamalarının eşitliğini bildirir;
  sahne içi kamera yolculuğu olan stillerde uyarıdır, storyboard'da bir perdeyi hızlı (kısa vuruşlar), birini ağır kur.
- **Paket (uzun):** `brief.format: long` iken `package.py` publish yaml'a `chapters` + `chapters_text` (props.chapter sahnelerinden; 0:00 adı
  `chapters[0].title`'da elle, yeniden paketlemede korunur) yazar, açıklamaya `chapters_text` yapıştırılır. Kapak `clips/thumb/cover.json` varsa
  Thumbnail kompozisyonundan (`remotion-styles/vox-explainer.md §9b`; 4'lü taslak ızgarası, sonra özel tasarım) → `render/cover.jpg` (≤ 2 MB);
  yoksa video karesi `cover.frame.png`'ye düşer, elle konmuş kapak ezilmez. Logo uzun videoda klibin içinde: `--no-outro`.
  Müzik atıfı otomatik değil (bölüm müziği birleşik dosya): `music.yaml attribution_required` olan parçaları açıklamaya elle ekle.
- **Yayın sırası (kullanıcı, 2026-11-09):** uzun video, ilgili Shorts'tan 2-4 gün sonra; telif testi için hemen liste dışı yüklenir, Shorts'un
  "İlgili video" alanı uzun videoya bağlanır.

## Stüdyo editörü (docs/editor/README.md)
- Kullanıcı bölümü editörde açıp ayar değiştirebilir (`node studio/editor/server.mjs --watch`, Claude masaüstünde `.claude/launch.json` → `editor`).
- **Editörden başlatılan bölüm:** `<bölüm>/direction.yaml` vardır: `answers` (konuya özel soruların cevapları: açı, açılış, ton, mekanizma, kapanış) senaryoya,
  `layers.<katman>.pick/note` (görünüş, teknik, kamera, light, tempo, transitions, texture, music, captions, overall) storyboard'a uyulur; script-writer ve
  visual-director'a AYNEN verilir. Seçilmeyen katmanı kanal tarzı ve konu belirler; seçimden sapılırsa storyboard'da nedeni yazılır. Notlardaki belirsiz ifade
  ("daha sıcak") storyboard'da nasıl yorumlandığıyla yazılır. Sohbet editör panelinden gelebilir (ekransız oturum): soruları düz metinle sor.
- Bir bölüme devam ederken önce `<bölüm>/editor.changes.jsonl` okunur: elle yapılan ayarlar korunur (`editor.overrides.json`, build_timeline en son uygular),
  ezilmez; bölüm betiği timeline'ı build'den sonra değiştiriyorsa ardından `tools/editor_overrides.py <EP>`. Tekrar eden tercihler ilgili skill'e kural olarak yazılır.

## Durum ve hata kuralları
- Her adım başında `running`, bitince `done`, hata olursa `failed` + kısa neden (`tools/state.py set`).
- Sözleşme dosyası her yazıldığında `tools/validate.py` çalıştır; hata varsa üreten ajana geri ver.
- Henüz kurulmamış bir aşamaya (studio/, Remotion) gelince dur, ne yapıldığını ve neyin eksik olduğunu söyle; adımı `pending` bırak.
- Kullanıcıya her onay noktasında kısa özet ver: ne üretildi, nerede, ne kadar sürdü, neye karar vermesi gerekiyor.
