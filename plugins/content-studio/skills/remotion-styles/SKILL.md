---
name: remotion-styles
description: >
  Görsel stil sistemi başvurusu: catalog/styles.yaml kataloğu, stil seçimi (auto kuralları, lang_neutral),
  timeline.json üretimi, Remotion'da stil bileşenleri (studio/src/styles), yeni stil ekleme ve render. Sahnelere stil atanırken,
  storyboard/timeline hazırlanırken, render alınırken ya da yeni stil yazılırken kullan.
---

# Görsel stiller ve render

Stil talimatları: önce projede `docs/styles/guides/<id>.md` (kullanıcının kendi kurduğu ya da uyarladığı stiller; varsa bu geçerlidir),
yoksa plugin'deki `.studio/plugin/skills/remotion-styles/<id>.md`. **Plugin klasörüne asla yazma** (`.studio/plugin/` salt okunur,
her güncellemede yeniden kurulur): plugin'deki bir talimatı kanal için değiştirmek gerekirse önce `docs/styles/guides/<id>.md`'ye
kopyala, orada düzenle — o stil bir sahneye atanınca okunur ve adım adım uygulanır (sert kurallar, tarif JSON'ları, çeşitlilik tablosu). Öğretici anlatım kullanıcı için `docs/styles/<id>.md`. Stile özellik eklenince ikisi de aynı turda güncellenir. Karışım: `catalog/styles.yaml → mix_with`.
Stilden bağımsız **kamera dili**: `.studio/plugin/skills/remotion-styles/camera.md` (eğriler, log zoom, ağır yakınlaşma, odak, geçiş süreleri;
öğretici `docs/styles/camera.md`). Her sahnede kamera ve geçiş değerleri buradan.
Stilden bağımsız teknik talimatı: **derinlik ve elementler** `.studio/plugin/skills/remotion-styles/depth-elements.md` (her sahnede arka/orta/ön
düzlem, foto katmanları `tools/photo_planes.py`, element kütüphanesi `content/assets/elements/`, `elem:` geçiş hedefleri, kapakta derinlik).
Storyboard ve timeline'da vox, foto ve arşiv sahneleri için okunur. Öğretici: `docs/styles/depth-elements.md`.
Görsel referans: `docs/style-atlas.html` (118 giriş). Makine kataloğu: `catalog/styles.yaml` (`implemented: true` olanlar render edilebilir).

## Görünüş ve teknik ayrı eksenler (2026-11-11, `catalog/visual-axes.yaml`)
`styles.yaml` tek liste ama kayıtlar üç türdür: **görünüş** (kare neye benziyor: vox, ağaç baskı, ukiyo-e…; `made_with`: hangi tekniklerle yapılabilir),
**teknik** (üretim yolu: object3d = gerçek 3D tarama, depth-photo = derinlik 2.5D, ken-burns = foto hareketi, manim…), **kurgu kalıbı** (split-screen…).
Bir görünüş birden çok teknikle yapılabilir (ağaç baskı görünüşü 3D sahne + baskı shader'ıyla, EP009). Kullanıcıya stil sunarken ikisini ayrı söyle:
"görünüş: X, teknik: Y". Görsel dilin 7 katmanı (görünüş, malzeme, teknik, kamera, ışık-renk, kurgu, doku + ses): `studio/editor/layers.ts`.
Yeni stil eklenince `visual-axes.yaml`'a (looks / technique_styles) ve `layers.ts` TECHNIQUE'e de yazılır. Editör kütüphanesi bu dosyadan okur.

## Şu an kullanılabilir
| id | bileşen | props | not |
|---|---|---|---|
| `blueprint-diagram` | `studio/src/styles/blueprint-diagram` | `figure`: split · steps · modules · cells · flow · monolith · wing (EP015 `wing.tsx`: eğik izdüşümde kanat, "stiff" çaprazlar, "carry" pilot, "twist" uç burulur) · `bare: true` köşe yazılarını (FIG. n, sahne kimliği) gizler | dilden bağımsız; hareketler kelime zamanlarına bağlı. Yeni figür: ayrı dosya + `FIGS` satırı |
| `kinetic-type` | `studio/src/styles/kinetic-type` | `kicker`, `hero` (dev son kelime), `badge` (köşe numarası) | metni kendisi gösterir, altyazı o sahnede kapanır |
| `ken-burns-photo` | `studio/src/styles/ken-burns-photo` | `image` (zorunlu), `from`/`to` `{x, y, zoom}` (0-1 odak), `credit`, `cuts` (isteğe bağlı), `compare` (önce/sonra sürgüsü) | lisanslı fotoğraf; alt karartma + ekran atfı |
| `archival-film` | `studio/src/styles/archival-film` | ken-burns ile aynı (`cuts` dahil) + `film`: `calm` (varsayılan) · `strong` | tarihî vakalar. `calm`: sepya, kontrast, vinyet, ince tane (4 karede bir), ~1 sn'lik ±%1 parlaklık dalgası, alt-piksel sürüklenme; titreme/kayma/çizik yok (EP002: "ekran çok titriyor"). `strong`: eski titreyen film (kare başı ±%5 titreme, kayma, çizik) |
| `food-promo` (talimat: `food-promo.md`) | ortak bileşen yok; bölüme özel `studio/src/compositions/ManaPromo.tsx` + `clips/promo.json` (`cuts`, `cues`, `scenes`) | — | 9:16 yemek reklamı (Mana); geçiş/plan tarifleri `docs/styles/ads/transitions.md`; katalogda `implemented: false` |
| altyazı `cap-karaoke` | `studio/src/components/captions/Karaoke.tsx` | — | metin senaryodan, zaman Whisper'dan; sayfa ≤ 22 karakter, cümle sonu kelimesi tek kalmaz (28'e kadar eklenir ya da önceki kelime yanına geçer); kısa kelimeye en az 120 ms vurgu; ince koyu kontur |

### Sahne içi görsel değişimi (`cuts`, foto stilleri)
Sahne kimliği bölünmeden (sesler sNN'e bağlı) bir sahnede birden çok çekim: `props.cuts: [{ atMs, image?, from?, to?, fadeMs?, credit? }]`.
- `atMs`: sahne başından ms. Kelime zamanından alınır (`audio/<dil>/report.json` seçilen take, ya da timeline `words`). Cümle sınırına koy.
  Kelimeyle de yazılabilir (2026-11-08, EP009): `"atMs": "Genrikh"`, `"kelime#2"`, `"kelime+300"`; aynısı `to.at` (çekim başından), `compare.at` için.
  `build_timeline.resolve_word_times` cümle duraklarından sonraki kelime zamanına çevirir; ses yeniden üretilince elle güncelleme gerekmez.
- `image` verilmezse önceki görsel kalır, yalnızca kadraj değişir. `fadeMs` varsayılan 250 (kısa crossfade); 0 = sert kesme.
- Her çekimin `from→to` hareketi kendi süresine yayılır (çekim başı → sonraki kesmenin bitişi). Atıf (`credit`) etkin çekime göre değişir.
- Ritim: görsel değişen tek çekim 3 sn'den kısa kalmasın (`build_timeline.py` uyarır; EP005 s08'deki 0.6 sn'lik sert kesme dizisi "geçiş gibi bile değil" bulundu, stop-motion dizisi yapma); ses yeniden üretilirse `atMs` yeni take'e göre güncellenmeli.
- Kod: `studio/src/styles/photo/PhotoMotion.tsx` (`readPhotoShots`, `PhotoShots`).

### Önce/sonra sürgüsü (`compare`, ken-burns-photo; ilk kullanım EP005 s11)
`props.compare: {image, at, ms (1400), ease ("heavy"), dir ("right" = soldan sağa açılır | "left"), line (true)}`: `image` (sonra) aynı kamerayla
(`from`/`to`; `cuts` ve `planes` yok sayılır) ana görselin üstüne çizilir, `at` ms'de clip-path ile açılır; ince beyaz sürgü çizgisi + gölge.
`split-screen` stili katalogda yok; önce/sonra karşılaştırması bununla yapılır. build_timeline `compare.image`'ı `imageSizes`'a ekler.
- **İki görsel aynı boyutta ve hizada olmalı.** Yan yana basılmış yayın görselini (NASA GPN-2002-000064 gibi) iki panele kırp, sonra OpenCV ECC
  ile hizala (`tools/.venv-matte`, cv2): iki paneli gri + Gauss 12 px bulanıklaştır (bulanık "önce" ile keskin "sonra" ancak böyle eşleşir),
  `cv2.findTransformECC(..., cv2.MOTION_AFFINE)` 0.25 → 0.5 → 1 ölçek piramidi, `warpAffine(..., WARP_INVERSE_MAP)`, kenar boşluğu için
  iki görseli de %6 içeriden aynı kareye kırp. EP005'te korelasyon 0.92 (ölçek farkı %4, dönüş 0.8°). Kontrol: iki yarıyı yan yana koyup çekirdek
  sürekliliğine bak (`assets/preview/s11-m100-aligned-split.jpg`).
- Tuzak: kare (1:1) görsel dikey karede `cover` ile genişliğin yalnızca %56'sını gösterir; sürgü ekranın tamamında gezer, görüntüde değil.

### NASA/arşiv video klibi (dikey kırpım + bindirme, EP005 s01)
Hazır video stili yok; klip ffmpeg + PIL ile 1080x1920 mp4'e pişirilir ve `manim` stilinin video oynatıcısıyla oynatılır
(`{"style": "manim", "props": {"video": "episodes/<EP>/assets/video/<ad>.mp4", "bg": "#05080F"}}`, scrim/paper verme).
- Örnek betik: `content/episodes/EP005-hubble-costar/s01_orbit.py` (`voice/.venv-chatterbox/bin/python -I <betik> [--preview 20,168]`):
  ffmpeg 4K kaynağı `fps=30` rawvideo olarak boruya verir → PIL `Image.transform(EXTENT)` ile alt pikselli izleyen 9:16 kırpım + heavyOut
  punch-in → element PNG'si (gözlük) 12 fps basamaklı düşüş + gölge → hafif ton/gren → ffmpeg libx264 crf 16. 208 kare 4K → ~45 sn.
- Tuzaklar: ffmpeg `crop` filtresinin w/h'si kare başına değişmez (zoom ifadesi yazılamaz) ve x/y tam piksele yuvarlanır → zoom/kırpımı
  PIL'de yap. Takip edilen nesnenin konumunu 4-5 anahtar karede elle ölç (ızgaralı kareler), arayı doğrusal karıştır. Süre = ses + 0.35 sn;
  kaynak yetmezse başlangıcı erkene al (son kareyi tekrarlama).
- Kaynak: NASA SVS (svs.gsfc.nasa.gov) kamu malı; CGI modelinin dönemine dikkat (SVS 20314 2009 sonrası donanım). ESA/Hubble videoları CC BY 4.0.

### Fotoğraf bulma (`tools/find_images.py`, Wikimedia Commons)
```
voice/.venv-chatterbox/bin/python tools/find_images.py search "container ship port" [--limit 8] [--allow-sa]
voice/.venv-chatterbox/bin/python tools/find_images.py get <bölüm> <sahne> "File:Adı.jpg"
```
- Lisans dosya sayfasından okunur: PD/CC0/CC BY izinli, CC BY-SA yalnızca `--allow-sa`, NC/ND/belirsiz elenir.
- `get` görseli `<bölüm>/assets/` altına, dikey kare + zoom için yeterli çözünürlükte (yükseklik ≥ 2500 px) indirir, `assets.csv`'ye yazar;
  çıktıdaki `file` → `props.image`, `credit` → `props.credit`.
- **Lisans yetmez, içeriğe de bak:** fotoğrafta görünen marka logosu/yazısı (ör. gemi gövdesinde "MSC"), tanınır kişi, film karesi varsa kullanma
  ya da `from/to` odağıyla kadraj dışında bırak (`channel.yaml assets.forbidden`).

## Seçim kuralları
1. `brief.style` belirli bir id ise tüm sahneler onu kullanır (sahne bazında istisna kullanıcı onayıyla).
2. `auto` ise: `catalog/styles.yaml → auto_rules`, `channel.yaml styles.preferred` öncelikli, `styles.avoid` hariç, **yalnızca implemented: true**.
3. `style_mode: lang_neutral` → yalnızca `lang_neutral: true | partial` stiller.
4. Ritim (PLAN 8): 2-5 sn sahne, her 3-4 sn görsel değişim; ardışık sahnelerde kompozisyon değişmeli.
5. `kind: photo` stiller lisanslı görsel ister (`channel.yaml assets.allowed_sources`); bulunamazsa `kind: code` stile düş.

Sahne ayarları senaryoda durur: `scenes[].visual = { style, props, emphasis: [vurgulu kelimeler, senaryodaki yazımıyla] }`.

## Timeline ve render
```
voice/.venv-chatterbox/bin/python tools/build_timeline.py <bölüm>        # → <bölüm>/timeline.json
cd studio && npx remotion render src/index.ts ShortsVideo ../<bölüm>/render/<EP>.mp4 \
  --props='{"timeline":"episodes/<bölüm_adı>/timeline.json"}'
```
- build_timeline: sahne süresi = seçilen ses süresi + 0.35 sn (son sahne + 0.8 sn); altyazı kelimeleri senaryodan,
  Whisper'a hizalanır (`align_ratio` < 0.8 ise uyarı); her sahnenin ilk kelimesi gerçek ses başlangıcına kaydırılır (`[fix]` satırları;
  Whisper nefesi ilk kelimeye katıyor). Yollar `content/` köküne göre (Remotion public dizini).
- Render ayarları (`remotion.config.ts`): PNG ara kare + `yuv420p` (JPEG tam aralıklı `yuvj420p` veriyordu), concurrency 2, GPU (`angle`).
  Vox ağırlıklı 80 sn ≈ 7-8 dk (GPU'suz 23 dk). Çökme olursa `--frames=a-b` ile parçalara böl, ffmpeg concat ile birleştir.
- **Uzun video (≈ 1 dk üstü): `tools/render_chunked.py <EP> render/<EP>.mp4 [--frames a-b] [--chunk 1500]`.** PNG ara kareler 1080p'de kare
  başı ~3 MB; 10 dk ≈ 50 GB geçici dosya. EP009 (2026-11-08) tek parça render 15 dk sonra `ENOSPC` (disk dolu) ile düştü. Araç sessiz görüntü
  parçalarını sırayla render eder (yarıda kalırsa biteni atlar), sesi tek WAV olarak ayrı render eder, kayıpsız birleştirir. Başlamadan
  `df -h /System/Volumes/Data` ≥ 8 GB boş olsun. Arka plan render'ında `| tail` çıkış kodunu yutar: sonucu dosyayla doğrula.
- Woodcut ve Manim sahneleri önceden klip olarak render edilmiş olmalı (`tools/woodcut_render.py`, `manim/render.sh`).
- **Geçiş hızı:** portal/pullback varsayılanları (900/900 ms) uzun videoda yer değişiminde hızlı kalır; `dim` (hedef dışı karartma, ms) + `pre`/`post` ile yavaşlat (shorts §9 kuralı).
- **Bölüm başlığı (uzun video):** sahne `visual.props.chapter = {kicker, title, atMs, holdMs}` → `components/ChapterTitle.tsx` (yırtık kâğıt şeridi,
  IM Fell English SC, mürekkep oturma + bakır kayık baskı). Anlatıcı susarken çıksın: aynı sahneye `lead: {ms, sfx}` (build_timeline, her sahnede;
  ilk sahnede `intro` ile aynı alan). Kart geçişi değil.
- **Altyazıda sayılar (EN):** build_timeline `numberize_caption` (yıllar 1948/1850s, 25, 1.3, 200,000; tek "one/two" yazıyla). Senaryoda
  `caption_numbers: false` kapatır. Kelimeye bağlı ipuçları (Manim `cue`, woodcut `wordFrame`, **stil bileşenlerinin `enterAt`/`hideAt`'i**: ShortsVideo `words` olarak `cueWords` verir) konuşulan yazımı kullanır; altyazı (PaperStrips) `words`'ü. EP009'da bu ayrım yokken s48 kartları "forty" ipucunu "40"ta bulamadı, hiç görünmedi.

## Kodla 3D sahne (three.js) ve ağaç baskı
Remotion içinde `@remotion/three` ile; mevcut stiller değişmez. Kamera satırı, hareket kuralları, bitiş araç kutusu ve woodcut grameri:
`.studio/plugin/skills/remotion-styles/three-scenes.md` (cinecode + Lemo, MIT). İlk örnek `studio/src/styles/woodcut/WoodcutMatch.tsx`.

## Geçiş, müzik, efekt (build_timeline otomatik yerleştirir; senaryoda `visual.transition` ile elle seçilebilir)
Ses kuralları (seviye, vurgu bütçesi, katmanlı darbe, olay denetimi, uzun video, ölçüm) ve CC0 havuz: `.studio/plugin/skills/sound-design/SKILL.md`.
- Sahne girişi `transition`: `cut` (varsayılan; aynı stil devam ediyorsa) · `zoom` (stil değişimi) · `wipe` (kinetic-type'a geçiş, vurgu renkli kenar) ·
  `flash` (nadiren). Süreyi değiştirmez; senkron bozulmaz (`studio/src/components/SceneIn.tsx`).
- Müzik: `content/music/music.yaml` (kanalın kendi kayıtları: PD nota + Salamander piyano, CC BY 3.0 atıf). `--music auto|none|<id>`.
  Seviye ölçülerek ayarlanır: konuşurken anlatımın **24 dB**, aralarda **14 dB** altında (2026-11-01, kullanıcı iki kez "kıs" dedi; değişikliği
  ≥ 6 dB adımla yap, 3 dB duyulmadı). Kod: `tools/build_timeline.py MUSIC_UNDER_VOICE_DB / MUSIC_GAP_DB`, ducking `components/audio/MusicBed.tsx`.
  - **Bölüme özel kurgu (Gnossienne, EP003/EP004):** dramatik B bölümü çıkar, son nota son sözden ~0.8 sn sonra çınlasın:
    ```
    voice/.venv-chatterbox/bin/python tools/music/gnossienne1.py --video --end-at <son söz bitişi + 0.8> \
      --sf2 tools/music/soundfonts/SalamanderGrandPiano-V3+20200602.sf2 --out content/music/own-satie-gnossienne1-<ep>
    ```
    Son söz bitişi: timeline son sahne `startFrame/30 + words[-1].endMs/1000`. Çıktı fluidsynth'ten ~−45 LUFS gelir: **sabit kazançla
    −19.5 LUFS'e getir** (ffmpeg `ebur128` ile ölç, `volume=<−19.5 − ölçüm>dB`, `-t 85`; `loudnorm` KULLANMA, piyanonun dinamiğini sıkıştırır).
    Kısık dosya bırakılırsa büyük kazanç Remotion ses ifadesini ffmpeg sınırının üstüne taşır, render ses miksajında durur (EP004).
    `music.yaml`'a `test_only: true`, `steady: true`, atıf satırıyla ekle; `build_timeline --music <id>`.
  - **Yeni klasik ekleme** (2026-11-03): Mutopia'da lisansı **Public Domain** olan MIDI'yi bul (CC BY-SA olanı alma; arama
    `mutopiaproject.org/cgibin/make-table.cgi?Composer=SchumannR&Instrument=Piano` ya da `?searchingfor=<ad>`) →
    `voice/.venv-chatterbox/bin/python tools/music/render_pd.py <mid_url> <id> [--instr organ] [--tempo 0.9]` → `content/music/own-<id>.wav`
    (−19.5 LUFS sabit kazanç) → `music.yaml` satırı. Org: VSCO-2 örnekleri (`sampler.py`), Bach koral prelüdleri iyi oturur.
    Mutopia MIDI'leri çoğu zaman tekrarsızdır (kısa çıkar); EP kurgusunda döngü/bölüm seçimi gerekir.
  - **Kendi bestemiz, resme göre** (2026-11-03, `tools/music/theme_longitude.py` örnek): notalar saniye cinsinden (60 bpm, 1 vuruş = 1 sn), her
    bölüm sahne kesmesine oturur. Kullanıcının beğendiği kalıp: konudan gelen ritim (saat → tik-tak) + yükselen arpej + kesmede çözülme.
    Ani yüksek tek notalardan ve 6. oktav piyano ezgisinden kaçın ("alakasız" geri bildirimi). Yaylı/org katmanı: `--layers strings|organ`
    (`tools/music/sampler.py`, VSCO-2 CE örnekleri, CC0; org: Ivy Audio, yeniden dağıtım izinli, atıf önerilir). Örnekler git dışı
    `tools/music/soundfonts/vsco2/`; yoksa indir: GitHub `sgossner/VSCO-2-CE` → `Strings/Violin Section/susVib`, `Strings/Cello Section/susvib`,
    `Keys/Organ/Quiet` (~180 MB, raw.githubusercontent.com dosya dosya). Katman hızı 40-60, piyanonun ~6-8 dB altı ("hafif dokunuş").
    Seviye: seyrek besteyi sabit kazançla bırakma, kullanıcı "kısık" dedi → `acompressor=threshold=-30dB:ratio=3:attack=5:release=600:makeup=1,
    alimiter=limit=0.7` → −19.5 LUFS, LRA ≤ ~6 LU; `music.yaml` `gain_db_offset: 2.7`, `under_voice_db: 19` (konuşurken ek −5 dB).
    Dinleme denemesi: timeline kopyasında `music.file` değiştir, `remotion render ... --codec=wav --frames=0-989`, ffmpeg ile videoya bağla.
  - Pixabay müziği: Content ID riski var; sayfadaki notu kontrol etmeden kataloğa ekleme.
- Efektler (gerçek kayıt; sentetik `tools/sfx.py` sesleri geçişlerde kullanılmaz): `content/sfx/pixabay/*.wav` (Pixabay Content License,
  `sources.csv`) ve `content/sfx/natural/` (Commons PD/CC0). Senaryo üst düzey `transition_sfx: "layered"` (kanal varsayılanı olmalı).
  - Geçiş ve katman sesleri otomatik: tablo `vox-explainer.md §8`, kod `build_timeline.py ADV_SFX / LAYERED / AUTO_SFX`.
  - **Yeni ses ekleme:** ham mp3 `content/sfx/pixabay/originals/<kısa_ad>.mp3` → `tools/sfx_process.py` `SPEC`'e satır (pencere sn ya da
    `("peak", sn)` riser için, highpass, fade, tip air/point/wide/bed) → `voice/.venv-chatterbox/bin/python tools/sfx_process.py <ad>` →
    doruk karesini ölç (soundfile + 16 ms RMS zarfı argmax) → geçiş tablosunda `lead` = doruk karesi → `sources.csv` satırı (sayfa URL,
    yazar, lisans). `validate.py` sources.csv'de olmayan dosyayı reddeder.
  - Sahne olayı sesi: `visual.sfx: [{ word | atMs, file, gainDb, durMs?, nth?, offsetMs? }]` (ör. EP004 s03 kaza: splash_big + huge_thump).
  - Seviye: anlatımın ~20 dB altı; konuşmayı maskelememeli. `sfx_gain_db` bölüm geneli ofset.
- Ekran metni eşlemesi: `scenes[].caption_overrides: {"eighteen eighty six": "1886"}` → altyazı ve SRT'de tek kelime, konuşulan kelimelerin
  zaman aralığını kaplar; ses metni (`text`) değişmez (`build_timeline.apply_caption_overrides`, `validate.py` denetler).
- Önizleme: `cd studio && npm run studio` (tarayıcıda sahne sahne gezilebilir).
- Render ağır iştir: TTS çalışırken başlatma. `remotion.config.ts`: concurrency 2, GPU `angle` (80 sn vox bölümü ≈ 6 dk).
- Hızlı kontrol: `--frames=0-90` ya da `npx remotion still src/index.ts ShortsVideo out.png --frame=120 --props=...`.

## Manim sahnesi (fizik/mekanizma animasyonu, `style: "manim"`)
1. Sahne betiği: `content/episodes/<EP>/manim/<sid>_<ad>.py` (Manim CE). Kelime zamanlarını `audio/<dil>/report.json`'dan okuyup
   animasyonları sözlere bağla (örnek: EP004 `manim/s08_steps.py`, EP003 `manim/*.py` + `common.py` renk/formül ayarları).
   Formül LaTeX yerine STIX Two fontuyla (BasicTeX'te standalone/dvisvgm yok). Yazısız tut (lang_neutral); zemin rengi bölüm paletine uysun.
2. Render: `tools/.venv-manim/bin/manim -r 1080,1920 --fps 30 --media_dir <geçici> <betik>.py <SahneSınıfı>` → çıktıyı
   `content/episodes/<EP>/assets/manim/<sid>.mp4`'e kopyala. Süre = sahne sesi süresi + 0.35 sn.
3. Props: `{"video": "episodes/<EP>/assets/manim/<sid>.mp4", "bg": "<zemin>", "scrim": 0.55, "paper": {"opacity": 0.5}}`; `scrim` açık zeminde altyazı
   okunurluğu için; `paper` taranmış kâğıt dokusu (varsayılan `textures/paper003.jpg` multiply; koyu zeminde `"blend": "soft-light"`).
   Tek zaman izleyicisi deseni (bütün nesneler `always_redraw`, `tt` 0 → T lineer): EP006 `manim/s06_pendulum.py`, `s10_bimetal.py`.
4. İlk karede, portal ile girilecekse hedef nesne hazır olsun (EP004 s08: mercek kesiti ilk karede var).
5. Fotoğrafla açılış (EP005 s09): `ImageMobject` ilk 1.5 sn, sonra diyagram altından belirir. Amblemli/bayraklı fotoğrafı önce kırp.
   `from common import *` alt çizgiyle başlayan adları (`_np`) aktarmaz: ortak modülde `np`, `math` kullan.
   Optik ışın şeması: EP005 `manim/common.py` (kenarı düzleşmiş ayna `mirror_y`, `reflect_hit`, `axis_cross`), `s05_aberration.py`, `s09_costar.py`.

## Yeni stil ekleme
1. `catalog/styles.yaml` kaydı (zaten varsa `implemented: true` yap).
2. `studio/src/styles/<id>/index.tsx`: `React.FC<StyleProps>` (`studio/src/schema/timeline.ts`): `{ scene, words, props, lang, theme, index }`.
   Zaman: `useCurrentFrame()` sahne başından; kelime anı = `words[i].startMs`. Renkler `theme`'den; sabit renk yalnızca stilin özünde.
3. `studio/src/styles/registry.ts`'e satır (`ownsText` stil metni kendisi gösteriyorsa true).
4. Bir sahnede dene (`npx remotion still`), sonra bu tabloyu güncelle.
Güvenli bölge: alt %20 ve sağ ~150 px boş (platform arayüzü); altyazı %60-78 yüksekliğinde. Foto stillerinde `CaptionScrim` bu bandı 0.74 karartır (beyaz zeminde turuncu ≈ 5:1).

### Müzik başlangıcı ve sert ses kesmesi (EP007)
Senaryo üst düzeyinde `"music_after": "sNN"`: müzik o sahnenin son sözünde başlar. Sahne efektinde `"fadeMs": 0` + `durMs`: efekt sert kesilir. `build_timeline.py` müzik seviyesini kendi hesaplar; yeniden kurulunca `timeline.json` `music.gainDb` tekrar −13'e çekilir.

## Node render betikleri (2026-11-09)
`@remotion/bundler` `bundle()` public klasörünü (content/, GB'larca) geçici klasöre KOPYALAR → disk doldu (EP009 ENOSPC). Her Node betiğinde
`bundle({ entryPoint, publicDir: "../content", symlinkPublicDir: true })`. Çok kare için tek paketleme + `openBrowser` + `renderStill` döngüsü
(`studio/scripts/stills.mjs`; `remotion still` her çağrıda yeniden paketler, ~20 sn).

## Kanal kimliği ve stile bağlı kamera (kullanıcı, 2026-11-10, IYH001)
Bir stilin efekt ve kamera dili (vox: toz, halftone, kâğıt tanesi, el kamerası, stop-motion) o stile aittir; başka kanala varsayılan olarak taşınmaz.
Her kanal `channel.yaml styles` ile kendi görsel kimliğini seçer; storyboard'da kamera hareketleri (itme hızı, el kamerası, whip, odak) stilin rehberinden
gelir, genel kamera skill'inden değil. Yeni kanalın ilk videosunda başka bir kanalın vox kolajını kopyalama; kanalın `design` bölümüne bak (`/design-language`): önce kanal için stil yönü sor (2-3 seçenek), 6-8 sn deneme klibi.

## Görünmez köprü: kamera yürürken dünya değişir (kullanıcı beğendi, IYH001 v2 s04, 2026-11-10: "çok güzel smooth olmuş")
Zaman/çağ değişimini kesmeden anlatmanın tarifi; stilden bağımsız (vox'ta harita katmanları, paper-lantern'de iki ışıklı yığın, footage'da iki kare).
1. **Tek sürekli kamera hareketi** bir anlam yolu boyunca (rota, nehir, yol): ~2-2.5 sn, `ease: "heavy"` (ağır ease-out: hızlı kalkış, uzun yumuşak oturuş),
   anahtar kelimeden ~200 ms ÖNCE başlar (`"later,-200"`). Kamera durmadan dönüşüm olur; dönüşüm bitince kamera da oturur.
2. **Aynı kayıtta 3-4 ara görüntü**, aynı kamera anahtarlarıyla birlikte hareket eder ve sırayla açılır (eski → %33 → %66 → yeni; kelimeden +300/+650/+1000 ms).
   Ara görüntüler aynı kırpım ve izdüşümden üretilir (`assets/make_assets.py` blend), pin/rota koordinatları hepsinde aynı yere düşer.
3. **Öğe devri ortada:** eski çağın öğesi (mürekkep rota) dönüşümün ortasında söner, yenisi (yeşil rota) aynı anda belirir (+650): göz yolu kaybetmez.
4. **Görünmez kesme:** sonraki sahne, bir önceki hareketin son kadrajıyla birebir başlar (`from` = önceki `to`), geçiş `cut`; arada el kamerası kapalı
   (`handheld: 0`), ışık rengi sabit, ses yatağı kesmeden akar (çöl rüzgârı kuyruğu → oda tonu).
5. Sonrasındaki tur da aynı eğri: her durak `ease: "heavy"`, ≥ 0.6 sn oturuş; yakın duraklar tek kadrajda toplanır (whip yok).
Örnek kurulum: `content/episodes/IYH001-the-road-continues/visuals.py` s04-s05 (`TRAVEL`, `MAPS`, `NY_FOCUS`).

## Altyazı stili bölüm bazında (2026-11-12, EP014 v4)
Kanal varsayılanı `channel.yaml styles.captions` (cap-paper). Bölüm kendi stilini `script.<dil>.json` (ya da `brief.yaml`) üst alanı `"captions"` ile seçer;
`build_timeline.py` önce onu okur. Seçenekler: `cap-paper` (Alfa Slab yırtık şerit), `cap-serif` (Cormorant, sessiz, vurgusuz), `cap-karaoke`,
**`cap-print`** (`PrintCaption.tsx`: IM Fell English SC dönem matbaa harfi, kemik rengi + koyu kontur `paint-order: stroke`, konuşulan kelime #F9D509,
arkasında yumuşak koyu leke; 9:16'da 104 px, güvenli bölge 0.60-0.78 H). direction.yaml `captions: serif` + tarih/ağaç baskı/arşiv bölümü → `cap-print`.
Parlak sahnede (fener ışığı) sarı vurgu konturla okunur; daha parlaksa leke opaklığını artır. Sahne bazında `props.captionSolid` yalnız cap-paper içindir.
