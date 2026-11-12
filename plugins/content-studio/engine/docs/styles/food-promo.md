# food-promo — yemek tanıtım / reklam klibi (9:16, 15-30 sn)

Kod: şimdilik bölüme özel `studio/src/compositions/ManaPromo.tsx` (MANA001), ortak bileşen yok (`studio/src/styles/food-promo/` yapılacak, §10) ·
İlk kullanım: MANA001 (Mana, Gökçeada Kuzu Tandır) · Lemo karşılığı: yok · Tarif kataloğu: [ads/transitions.md](ads/transitions.md) ·
Kaynaklar ve lisans: [ads/README.md](ads/README.md) · Ajan talimatı: `.studio/plugin/skills/remotion-styles/food-promo.md`

Kaynak kısaltmaları: **SC** video-shotcraft, **RA** remotion-ads, **PF** product-promo-film, **CS** cinematic-shot, **M1** MANA001 v2.

## 0. Stil promptu (tek paragraf)
Vertical 9:16 food commercial, 15-30 seconds, real footage and real photographs only. Warm, sunlit grade (golden highlights, soft lifted
shadows, light bloom and fine grain), shallow depth of field, macro close-ups of texture: glistening fat, crisp crust, rising steam backlit
against a dark background, embers and sparks. The camera never fully stops: slow push-ins of 2-6%, gentle parallax, one decisive punch-in on
the hero moment. Story in five beats: a 1-2 second hook on the most appetising frame or a striking origin shot, the origin (land, sea, farm),
the cooking (fire, oven, pan), a hero reveal of the plate landing on a table with steam and a single specular glint, and a clean brand card
with date badge and call to action. Transitions travel through the world: light points that bloom into flames, foreground foliage or steam
that wipes the frame, an iris opening from the plate. Sound: real foley (sizzle, crackle, plate on wood) on picture events, one warm
instrumental track ducked under any narration, loudness -14 LUFS.

## 1. Özü ve ne olmadığı
- **İştah önce gelir.** Her planın işi yemeği (ya da yemeğin geleceği yeri) daha lezzetli göstermek; efekt bunu artırmıyorsa çıkar.
- **Gerçek görüntü + ölçülü canlandırma.** Video ve fotoğraf; üstüne yalnız ışık, buhar, parçacık, kamera ve yazı katmanı (PF: "gerçek malzeme
  ölçülü canlandırılır, vuruşta kesilir").
- **Dünyanın içinden geçiş.** Kesmeler ışık, buhar, ön plan nesnesi, kamera hareketiyle saklanır; düz erime ve kararma istisnadır.
- **Tek kahraman.** Bir videoda bir yemek, bir hero an (iniş + buhar + parıltı), bir marka kartı (SC Q5: açılışta tek kahraman, tam bir hareket yayı).
- **Ne değil:** `kinetic-type` (yazı ana görsel değildir), `ken-burns-photo` (tek fotoğrafta hareketten ibaret değil), `footage` (IYH saha görüntüsü,
  yumuşak çapraz geçişli belgesel akış; reklam ritmi ve marka kartı yok), vox (kolaj ve kanıt dili yok). Ürün/UI tanıtım videolarının ekran
  kaydı dili (imleç, panel, HUD, sayaç, glitch) alınmadı.

## 2. Malzeme ve işleme
- **Katman sırası (alttan):** video/foto planı → zemin (masa, kart) → nesne gölgesi (geniş + temas) → kesilmiş kahraman nesne (tabak PNG) →
  yemek maskeli parıltı → buhar (screen, iki katman) → parçacık/bokeh → ışık (flare, sızma) → yazı → vinyet → gren.
- **Kesilmiş nesne:** tabak/yemek fotoğrafı `rembg`/SAM ile kesilir, iki ışık sürümü (masa ışığı ve kart ışığı) hazırlanır; yemek alanı için ayrı
  maske (`plate_food_mask.png`, parıltı yalnız orada). Yüksek çözünürlük: son ölçeğin 2x'i (SC Q2).
- **Buhar, duman, kıvılcım:** gerçek video (siyah zeminde beyaz buhar, `screen`) ya da kodla parçacık. Kodla buhar şimdilik yok (§10).
- **Bitiş katmanı:** sıcak ton, hafif bloom (PF natural-fresh: bloom 0.06, gren 0.14; LUT %50 karışım, gerçek renkleri bozmasın), vinyet
  (M1: video planlarında 0.5, kartta 0.28; RA: %50'de saydam → kenarda `rgba(0,0,0,0.5)`, yalnız foto/video karelerinde), gren (M1: 6 kareli döngü,
  `overlay` 0.06-0.09).
- Tam kare `filter: blur()` her karede pahalı (SC: render 3x); bulanıklığı küçük öğelere ya da kısa pencerelere ver.

## 3. Renk mantığı
- **Yemek sahneleri sıcak:** gün ışığı amber, köz turuncu; gölgeler hafif kaldırılmış (PF "sunlit": sıcak gün ışığı, yumuşak açılmış gölgeler).
  Köken sahnesi (yayla, deniz) doğal yeşil/mavi ama sıcağa çekilmiş (MANA001: warmth 0.2-0.25).
- **Yemeğin rengi değiştirilmez.** Ton ayarı yemeğin kendisini maviye/griye kaydırmaz; doygunluk +%10'u geçmez (pişmiş et plastik görünür).
  Kesik tabak sahneye uydurulur (MANA001: R +%8, B −%18, ışık yönüne göre gradyan, sıcak kenar ışığı).
- **Marka kartı marka renginde:** kanal `brand.colors` (Mana: lacivert `#0F2747`/`#14325C` zemin, krem `#F6E9C9` yazı, turuncu `#F07A1A` yalnız
  rozet/vurgu). Zeminde 4-5 renkten fazlası yok; renk zenginliğini görüntü taşır (RA).
- **Vurgu rengi tek yere:** turuncu rozet (tarih/fiyat). Yazıyı da turuncu yapma.

## 4. Yazı ve altyazı
- **Font:** kanalın marka fontu (Mana: Fredoka Variable, `wght 600-700`, başlıkta `wdth 75` dar). Lisanssız font yok.
- **Boyut (1080x1920):** okunacak ana yazı ≥ 96 px (kare yüksekliğinin ≥ %5; SC Q11 1080p için 56 px = %5.2'den), ikincil ≥ 48 px (RA ≥ 48 px,
  SC ≥ %3 ≈ 58 px), süs yazısı belirgin sönük. CTA en küçük satır olmaz. MANA001: üst yazı 124, başlık 118/250, etkinlik 46 (sınırda), rozet 130, CTA 132.
- **Yer:** ekran yazısı üst-orta üçte birde (y ≈ 420-640), çünkü yemek alt yarıda; tüm yazı güvenli alanda (§6).
- **Az kelime:** sahne başına 1-3 kelime; marka kartında ürün adı + etkinlik + tarih + CTA. Kanca 1-2 sn'de okunur.
- **Okuma süresi:** ≥ max(1.8 sn, konuşma + 0.6 sn); marka adı/logo ≥ 1 sn tam durgun (SC R1), kapanış ≥ 1 sn kuyruk.
- **Giriş:** varsayılan blur-slide ya da satır yayı; hızlı Reel'de 4 kare ölçek girişi; tarifler `ads/transitions.md` P08.
- **Altyazı:** sessiz izleme yaygın (Instagram/WhatsApp); anlatım varsa ekran yazısı anlatımın anahtar kelimesini tekrar eder, tam altyazı gerekmez
  (Mana `captions: none`). Altyazı kullanılırsa Reels alt bandının üstünde biter.

## 5. Hareket niteliği
- **Tam fps, akıcı.** Stop-motion basamağı yok (vox'tan farklı). Hareket bulanıklığı yalnız hızlı anlarda (whip, punch, dalış).
- **Eğriler:** kamera `sin` (yavaş) ve `heavyOut` (iniş/oturma); dalış `expoIn`/`30^u`; yazı ve rozet yay. Ayrıntı `.studio/plugin/skills/remotion-styles/camera.md`.
- **Yaylar (RA presetleri):** yumuşak `damping 200`; nazik `20/80`; hızlı `15/100`; zıplak `8/200`; ağır `30/50 mass 2`. Yemekte zıplak yalnız rozet,
  elastik (`5/150 mass 0.5`) yok.
- **Ağırlık:** tabak gerçekten düşer ve bir kez sekip oturur; yazılar sırayla, hızlanarak girer, oturduktan sonra 0.5 sn durur (SC R2).
- **Hareket dili** (PF gentle-story, yemek ve aile için önerilen): giriş 1.6 sn yumuşak yükselme, yazı bulanıktan, vurgu yumuşak sönme,
  2 sn yavaş Ken Burns, yavaş dolly, müzik ≤ 95 BPM. Hızlı Reel istenirse RA Ohneis vuruş şablonu (§11).
- **Ne asla hareket etmez:** marka kartında logo/işaret dönmez; CTA son 1 sn'de tam durgun; yemeğin kendisi bükülmez, uzamaz, morph olmaz.

## 6. Kamera dili (9:16)
| Hareket | Ne anlatır | Ne için |
|---|---|---|
| Ağır itme %2-6 (`sin`) | "yaklaş, bak" | her plan, varsayılan |
| Dalış (log zoom, `30^u`) | "içine gir" | köken → pişirme, tandır/fırın ağzı |
| Whip tilt/pan | enerji, "sonra" | alevden ocağa, tezgâhtan tabağa |
| Netlik kayması | dikkatin yer değiştirmesi | ön kıvılcım → kor, bardak → tabak |
| Punch-in (≤ 2) | "işte bu" | kesit, peynir uzaması, sos |
| Geri çekilme | "ve sonuç" | hero → marka kartı |
| Paralaks kaydırma | derinlik | durağan fotoğraf |

**Güvenli alanlar (Instagram Reels, 1080x1920; RA formats):**
- Üst 0-285 px: kullanıcı adı ve sistem arayüzü. Önemli yazı yok.
- Alt 1520-1920 px (400 px): butonlar, açıklama, ses bilgisi. Önemli yazı/CTA yok. Arayüz örtüsü pratikte alt %10-15 (y > 1630-1725).
- Sol 80 px, sağ 120 px (sağda beğeni/yorum/paylaş sütunu).
- **Güvenli dikdörtgen:** x 80-960, y 285-1520 (880x1235). Kapak/ızgara önizlemesi 4:5 için y 285-1635, profil ızgarası 1:1 için y 420-1500
  (logo ve başlık bu bantta kalırsa ızgarada da okunur).
- WhatsApp durumu: üstte ince ilerleme çubuğu + ad (~0-200), altta yanıt alanı (~1700-1920); Reels alanı ikisini de karşılar.
- MANA001 v2 ölçümü (2026-11-10): CTA merkezi y = 1600 (132 px yazı → ~1534-1666) **alt bölgede**; başlık şeridi y ≈ 195-305 üst sınırı aşıyor. Sonraki
  render'da CTA ≤ 1460, başlık ≥ 300'e alınmalı.

**İzinli/yasak geçişler:** tarif kataloğu `ads/transitions.md`; dikiş başına tek geçiş, aynı tarif en çok 1-2 kez, tam kare vurgu ≤ 3,
ışık efekti ≤ 2, erime/kararma yalnız bilerek.

## 7. Ses
- **Foley her görüntü olayında** (SC S4: tanınabilir her eylemin gerçek sesi): cızırtı (et tavada, yağ), çıtırtı (kor, kabuk), tok seramik-ahşap
  (tabak masaya), kaşık-tabak şıngırtısı, buhar "fsss", dökülme. Uzun örnekler eylem süresine kırpılır, kuyruğu eylemden sonra kesin biter.
- **Ortam yatağı:** köken sahnesinde rüzgâr/deniz/çan, pişirmede ateş ambiyansı −22 dB civarı. Hayvan sesi (meleme) yemekle çatışır, kullanma.
- **Müzik:** tek enstrümantal parça, kesmelerde değişmez; sıcak akustik (yemek/seyahat), gentle-story için ≤ 95 BPM. Müzik videodan 3-5 sn uzun
  seçilir/kesilir, sonda 1-1.5 sn sönüm (RA). Kanal müzik kuralları ve CC0 havuzu: `sound-design` skill'i.
- **Seviyeler** (kaynak değerler; bizim ölçümümüz `package.py sound_qc`):
  - Anlatımsız: müzik 0.35-0.50 (RA); anlatımlı: 0.10-0.20, efekt 0.3-0.6, ses 1.0.
  - Ducking: anlatımdan 0.5 sn önce müzik 0.35 → 0.12, anlatım boyunca 0.12, bitince 0.5 sn'de geri (RA). PF: konuşma altında −11 dB,
    atak 80 ms, bırakma 450 ms; konuşma RMS ≈ −17 dBFS, müzik üstünde medyan +10 dB.
  - Son ses: −14 LUFS, true peak −1 dB (PF; kanal kuralıyla aynı).
- **Yoğunluk:** 15 sn reklamda 2-3 belirgin efekt, aynı anda iki efekt yok (RA); dakikada ~10 işaret, hero dışında 2 sn'de en çok bir (PF);
  hero an: bir darbe + bir riser; logo: yumuşak chime. Konuşma başlangıcına darbe koyma (PF).
- **Tekrarlayan ses:** iki farklı örnek dönüşümlü, seviye basamaklı (0.40 → 0.25), aralık hareketle hızlanır; ses yığılırsa swoosh'a dönüştür (SC S2).
- **Senkron:** efekt `from = hedef tepe karesi − kaynağın tepe gecikmesi − çıkış gecikmesi` (SC S5). AAC kodlama gecikmesi 48 kHz'de ≈ 2048 örnek
  ≈ 1.28 kare; ilk 2 karede vurgu yok. Görüntüyle müzik vuruşu: render sonrası sapma ≤ 3 kare kabul, ≤ 1.5 ideal (SC music-beat-sync).
- **Vuruş ızgarası** (müzikli hızlı montaj için): librosa `beat_track` (`tightness=400`), çıkan vuruşlara doğru uydurma `t_i = t0 + i·T`
  (tempo skaleri ±%2 hatalı olabilir), kalıntı ≤ ±15 ms; yarım/çift tempo denemesi; kesmeler tam vuruşta, plan uzunluğu 4 ya da 8 vuruş.
  Tam kare vurgular en güçlü 2-3 davul vuruşuna, aralarında ≥ 16 vuruş. Sessiz/anlatımlı klipte kesmeler anlatıma ve olaya göre (CS: "eylemde kes").

## 8. Özgün hamleler
- **Işık noktasından ateşe.** Kökendeki güneş parıltısı büyür, kadrajı doldurur ve köz/alev olarak söner (T01). *Uyduğu içerik:* yayladan tandıra,
  denizden ızgaraya (gün batımı → kömür), bağdan fırına (öğle güneşi → fırın ağzı).
- **Ön planın süpürdüğü dalış.** Yayla ya da bahçeye dalarken ön plandaki ot/yaprak kadrajı süpürür, kesme onun içinde saklanır (T02 + T04).
  *Uyduğu içerik:* zeytinlik → zeytinyağı, sebze bahçesi → salata, buğday tarlası → ekmek.
- **Buharın içinden masaya.** Pişirmenin dumanı kadrajı kaplar, içinden masa ve iniş anındaki tabak çıkar; aynı buhar tabaktan yükselmeye devam eder
  (T03 + P03 + P04). *Uyduğu içerik:* tandır, kazan, fırın tepsisi, çorba.
- **Tabak kalır, dünya değişir.** Hero tabak geri çekilmede marka kartının içine iris ile taşınır (T08 + T10). *Uyduğu içerik:* her yemek kapanışı,
  tatlı (kase), içecek (bardak).
- **Tek parıltı.** Yağın üstünde ve başlık harflerinde aynı karede tek ışık bandı (P06). *Uyduğu içerik:* et, glazürlü tatlı, zeytinyağlı.

## 9. Tuzaklar
- **Yemek bozulması:** kesik tabağı orantısız ölçekleme, `warp`, AI ile üretilmiş yemek videosu (eğri tabak, doğal olmayan hareket; cliprise istem
  şablonundaki kısıtlar: yazı yok, fazla parmak yok, doğal olmayan yemek hareketi yok, eğri tabak yok). Yalnız gerçek çekim/fotoğraf.
- **Soğuk görünen buhar:** açık zeminde buhar kaybolur ya da gri leke olur; arkası koyu, arkadan ışıklı yerde kullan; `sepia` ile ısıt.
- **Plastik parıltı:** bant yemek maskesinin dışına taşarsa tabak/masa da parlar; opaklık > 0.35 yağlı değil ıslak plastik gibi.
- **Fazla efekt:** her dikişte gösterişli geçiş yorucudur; tam kare vurgu ≤ 3, ışık efekti ≤ 2 (SC R4, Q4). İlk kesim hep hızlı çıkar: ana hareket yayı
  ≥ 3 sn (SC R3), kısa reklamda hero plan ≥ 2.5 sn.
- **Güvenli alan:** CTA ve logo Reels arayüzünün altında kalır (MANA001 v2 CTA y=1600). Render sonrası güvenli alan kılavuzlu bir kare kontrol et.
- **Ses sonra:** görüntü kilitlenmeden efekt yerleştirme; plan süresi değişince bütün efekt tablosu yeniden sabitlenir (SC S3). Efektler `cue + ofset` ile
  yazılır, çıplak mutlak kareyle değil.
- **Vuruşa yarım kesme:** güçlü davullu parçada vurgular neredeyse hep tam vuruşta; yarım vuruşa sabitlenen darbe 5-6 kare kayar (SC örneği +5.75 kare).
- **Parlak karede alt-kare hareket bulanıklığı** (`CameraMotionBlur`) sarıya çalar ve basamaklı yankı bırakır; yönlü gauss kullan (SC).
- **Stok klip filigranı / başka marka:** `channel.yaml assets.forbidden`; tabakta başka restoranın logosu, arka planda marka etiketi yok.

## 10. Motor
- **Şimdi:** `studio/src/compositions/ManaPromo.tsx` + `content/episodes/<MANA>/clips/promo.json` (`cuts` kesme saniyeleri, `cues` kelime/olay zamanları,
  `scenes` yazılar), `promo_prep.py` (renk ayarlı vekil klipler, tabak/masa/gren), `render_promo.mjs`, `promo_mix.py` (ses). Bölüme özel: 6 sahne ve tarifler
  kodda sabit. Ayrıntı ve komutlar: MANA001 `storyboard.md` "Render".
- **Hazır ortak parçalar:** `components/ease.ts` (eğriler, `lerpScale`), `components/Transitions.tsx` (`whip`, `leak`, `fog`, `objectWipe`, `matte`, `disc`,
  `door`, `portal`, `zoomblur`), `styles/footage`, `styles/photo/PhotoMotion.tsx`, `tools/photo_planes.py`.
- **Yapılacak** (öncelik sırası, ajan talimatı §5): ortak `food-promo` bileşen kiti + tarif kataloğu adlarıyla `promo.json`; güvenli alan kılavuzu ve
  denetimi; vuruş ızgarası aracı; footage üzerinde zamanlı odak ve gerçek hareket bulanıklığı; LUT/ışık sızması bitiş katmanı.
- Örnek `promo.json` (MANA001 v2 biçimi, kısaltılmış):
  ```json
  {"version": 2, "dir": "episodes/MANA001-gokceada-kuzu-tandir/clips/promo", "fps": 30,
   "cuts": [0, 3.967, 7.033, 10.3, 15.7, 18.5, 24.3],
   "cues": {"whip": 8.13, "land": 10.7, "parlar": 12.6, "buhar": 14.16, "kasim": 18.74, "cta": 22.24},
   "scenes": [{"id": "s01", "text": "Gökçeada"}, {"id": "s06", "brand": "MANA", "badge": "24 KASIM", "cta": "Mana’da yenir."}]}
  ```

## 11. Çeşitlilik alanı
Ajan her klipte karar verir; aynı kanalda art arda iki klip aynı açılış + aynı kapanışı kullanmaz.
- **Açılış (kanca, ilk 1-2 sn):** (a) yemeğin en iştahlı makrosu (cızırtı + buhar), sonra kökene dön; (b) köken manzarası + yer adı (MANA001);
  (c) eylem ortası (bıçak kabuğa girer, sos dökülür), sesle başlar.
- **Yapı:** (a) köken → pişirme → hero → kart (anlatı, 18-24 sn); (b) RA dört sahne: kanca 2-4 sn / sorun-merak 3-5 / çözüm (yemek) 3-5 / CTA 2-4 (15 sn);
  (c) Ohneis vuruş şablonu: sert kesmeler, foto 0.5-2 sn, yazı kartı ↔ görüntü dönüşümlü, aynı tür kare 3 kez art arda yok (15-30 sn, müzik şart).
- **Bitiş:** (a) tabak karta çöker + rozet + CTA (MANA001); (b) hero planda kalır, üstüne marka kilidi ve CTA (kart yok); (c) kapanış kopyası
  16 px bulanıktan netleşir, logo 0.3 sn erir, durağan 2-3 sn (CS).

## 12. Referanslar (incelenen kaynaklar)
Video referansı ölçülmedi (bu çalışma GitHub reklam skill'lerinin kurallarından). İlk Mana klibinden sonra 2-3 yemek reklamı `tools/ref_study.py` ile
ölçülüp buraya eklenmeli (ortalama plan, kesim/dk, LUFS).

| Kaynak | Ne | Aldığımız |
|---|---|---|
| SC video-shotcraft (`3ac67b7`) | 124 tarif kartı, estetik kurallar, ses ve vuruş senkronu | geçiş ve vurgu tarifleri, R/Q/S kuralları, vuruş ızgarası, efekt gecikme telafisi |
| RA remotion-ads (`8c77946`) | Reels biçimi, Ohneis vuruş şablonu, yaylar, ses seviyeleri | güvenli alanlar, 4 sahne süreleri, yay presetleri, müzik/ducking seviyeleri, kanca kalıpları |
| PF product-promo-film (`dd4798d`) | natural-fresh + gentle-story, kesme türleri, sinema katmanı | sıcak "sunlit" bitiş, hareket dili, kesme seçimi, ses yoğunluğu ve LUFS |
| CS cinematic-shot (`32d5067`) | çekim planı yöntemi | plan listesi alanları, eylemde kesme, kamera hiç durmaz, kapanış kopyası |
| cliprise awesome-ai-video-generator-prompts | restoran yemeği istem şablonu | yalnız fikir: stok arama/brief kısıtları (§9) |

## 13. Karışım
- `mix_with`: `footage` (köken ve pişirme planları), `ken-burns-photo` (durağan fotoğraf, paralaks), `kinetic-type` (yalnız kart yazısı değil, tek kelimelik
  kanca kartı), `cinematic-dark` (koyu zeminde spotlight hero).
- Bir klipte en çok iki stil dili: görüntü sahneleri + marka kartı. Vox/kolaj/arşiv dili bu stille karışmaz (Mana `avoid`).
- Uzun (30 sn+) tanıtımda 2-3 yemek: her yemek kendi mini yayı (köken kısa, hero tam), aralarda T13 vuruş montajı, tek kapanış kartı.

## 14. Yönetmen kuralları (kullanıcı geri bildirimleri, tarihli)
- 2026-11-10 (MANA001): gerçekçi, tam reklam havası, derinlik efekti serbest, "gerçekten acıktırıcı". v2: erime/kararma yok; kamera hareketi, öğe büyüyüp
  kadrajı doldurur, ışık noktası eşleşmesi, duman içinden geçiş; kamera hiç tamamen durmaz.
