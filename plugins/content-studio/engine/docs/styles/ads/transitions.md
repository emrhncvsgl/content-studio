# Geçiş ve plan tarif kataloğu (reklam / yemek tanıtımı)

Kaynaklar ve lisanslar: [README.md](README.md), [LICENSES.md](LICENSES.md). Tarifler kural düzeyinde alındı, kod kopyalanmadı.
Kaynak kodları: **SC** = video-shotcraft (Apache-2.0), **RA** = remotion-ads (MIT), **PF** = product-promo-film (MIT),
**CS** = cinematic-shot (MIT), **M1** = bizim MANA001 v2 (`studio/src/compositions/ManaPromo.tsx`, burada denendi).

Okuma: süreler 30 fps'te (1 kare ≈ 33 ms). Eğri adları `studio/src/components/ease.ts` (`heavyOut`, `snapOut`, `heavy`, `expoOut`,
`expoIn`, `sin`, `cubic`, `backOut`); kaynakta başka bezier varsa yazıldı. Ölçek her yerde log uzayında karışır (`lerpScale`).
Kaynak değerleri çoğunlukla gri/yer tutucu görsellerle ayarlanmış (SC her kartta uyarıyor): **ilk gerçek kullanımda kare çıkarıp yeniden doğrula**.

## Seçim kuralları (her videoda)
1. Bir dikişe **tek** geçiş (SC). Flaş + whip, iris + flaş gibi üst üste koyma yok.
2. Bir videoda aynı tarif **en çok 1-2 kez**; tam kare vurgu (flaş, sarsıntı, punch, negatif) **toplam ≤ 3** ve aralarında ≥ 16 vuruş (SC R4).
   15-20 sn'lik klipte pratikte: 1 tam kare vurgu + 1 punch.
3. Işık efekti (parıltı, sızma, spotlight) videoda **≤ 2**; bir kahraman nesneye bir kez (SC Q4, light-play).
4. Çapraz erime ve karartma yalnız **bilerek** (zaman atlaması, nefes): her geçişin bir nedeni olur (bkz. T19).
5. Geçiş kareleri komşu sahnelerin bütçesinden gelir; storyboard'da her dikişe tarif adı yazılır (SC "R3"). Sonradan eklenmez.
6. Geçişten sonra okuma payı: yeni plan en az 0.5-1 sn okunur (SC: maske geçişinden sonra ≥ 30 kare durgunluk).
7. Ses: her tam kare vurgu bir sesle aynı kareye oturur. Sessiz flaş "kare düştü" gibi okunur (SC white-flash, impact-feedback).

Hızlı seçim tablosu:

| Değişim | Önce bak |
|---|---|
| Doğa/köken → pişirme | T01 ışık noktası, T02 ön plan örtüsü, T05 whip |
| Pişirme → masa/tabak | T03 buhar, T04 dalış, T07 ışık sızması |
| Yemek → marka kartı | T08 iris, T10 kadraj nesneye çöker, T18 düzen dönüşümü |
| Aynı mekânda ölçek değişimi | T06 netlik kayması, T09 nesne kadrajı doldurur, T12 punch |
| Müzikli hızlı montaj | T13 vuruş montajı, T14 sıcak flaş |
| Kapanış | T10, P07 rozet, P08 CTA |

---

## A. Geçişler

### T01 · Işık noktasından eşleşmeli kesme (light-point match cut)
- **Ne zaman:** giden planda parlak bir nokta (güneş yaprak arasında, su parıltısı, mum) ve gelen planda aynı yerde/yakında bir ışık kaynağı
  (alev, kor, ızgara). Köken → ateş geçişinin en doğal yolu.
- **Süre:** 600-1000 ms (M1: kesmeden önce 16 kare büyüme + sonra 14 kare sönme ≈ 1000 ms).
- **Eğri:** nokta yarıçapı log uzayında 9 → ~2100 px, `easeIn(quad)` (kesmeye doğru hızlanır); kesmeden sonra `easeOut(quad)` ile söner,
  renk sıcak beyazdan turuncuya döner. Gelen plan ışık noktasının ekran konumundan `heavyOut` ile asıl kadrajına çekilir (18 kare).
- **Katmanlar:** (1) giden video, nokta etrafında `scaleAt` ile itme (log 1 → 2.6, `expoIn`); (2) gelen video; (3) `screen` karışımlı
  radyal disk (sert çekirdek + uzun yumuşak kenar); (4) yatay anamorfik çizgi (elips, 320 → 1600 px); (5) iki sönük hayalet disk
  (merkeze göre aynalı; lens yansıması). Kıvılcım patlaması isteğe bağlı (T01 sonrası, P05).
- **Ses:** kesmede yumuşak "whoosh" + ateşin ilk çıtırtısı (kesmeden 2-3 kare sonra). Darbe yok.
- **Remotion:** nokta konumu tek sabit (`PF = [0.80W, 0.15H]` gibi) ve hem itme merkezi hem disk merkezi hem gelen planın başlangıç
  ofseti ondan türer (SC circle-match: "tüm öğeler aynı koordinat sabitini kullanır"). Konumu render edilmiş kareden ölç, kesmede
  diskin kadrajı tamamen örttüğünü tek kare render ile doğrula.
- **Kaynak:** SC circle-match-iris (ortak çapa, çapa etrafında itme), SC hidden-cut C (ışık zirvesinde kesme); M1 s02→s03.

### T02 · Ön plan örtüsüyle gizli kesme (occluder wipe / invisible cut)
- **Ne zaman:** kesmeyi "tek plan" gibi göstermek. Gerçek görüntüde örtü: ot, yaprak, el, geçen tabak, kumaş, kapı pervazı, buhar perdesi.
- **Süre:** örtünün kadrajı tam kapladığı an **1-2 kare**; süpürme 14 kare (≈ 470 ms) içinde (SC A: süpürme 14f, kesme tam örtü karesinde).
- **Eğri:** örtü `bezier(0.3, 0, 0.7, 1)`; kamera kesme boyunca kesintisiz kayar (+40 → −40 px), giden plan kesmeden önce 28 px `easeIn`
  ile sürüklenir, gelen plan 28 px `easeOut` ile girer (14 kare). M1'de dalışla birlikte: ot `easeIn(quad)` ile alttan gelir, `easeOut` ile çıkar.
- **Katmanlar:** (1) giden plan; (2) örtü: **katı çekirdek kadrajdan geniş** (SC: 2600 px katı + her yanda 340 px yumuşak kenar) ve
  hareket yönünde dikey/yönlü bulanıklık (M1: ot için SVG `feGaussianBlur stdDeviation="0 34"`); (3) örtünün yumuşak gölgesi (0 → 0.38 → 0.5);
  (4) gelen plan. Örtü kenarına sıcak bir kenar ışığı inandırıcılık katar (SC: terracotta rim).
- **Ses:** örtünün kendi sesi (ot hışırtısı, kumaş, hava) ya da kısa "whoosh"; kesme karesine değil örtünün tepe hızına.
- **Remotion:** örtü PNG (alfa kenarlı, `rembg`/SAM ile kesilmiş) `Img` + `transform: translateY`; tam örtü karesini hesapla ve görüntü
  değişimini **o kareye** koy. Orta hızda (~500 px/kare) bir karelik boşluk bile arka planı gösterir: genişlik/süre değişince yeniden kontrol.
  Bizdeki hazır benzer: `Transitions.tsx` `objectWipe` (yan silme), `matte` (alfası kapı olan PNG).
- **Kaynak:** SC transition-hidden-cut A; M1 s01→s02 (ot).

### T03 · Buhar / duman içinden geçiş
- **Ne zaman:** pişirme (tandır, ocak, fırın, ızgara) → servis/masa. Yemek dilinin en "iştahlı" geçişi; aynı buhar gelen planda tabaktan
  yükselmeye devam ederse süreklilik kurulur.
- **Süre:** 600-900 ms, tam örtü ≈ 4-6 kare (M1: 30 karelik buhar videosu, tam örtü kesmeden 2 kare önce; storyboard v1 800 ms).
- **Eğri:** buhar katmanı opaklığı `[0, 1, 1, 0]` (−18, −8, +2, +11 kare), dikeyde aşağıdan yukarı kayar (0.7H → −0.6H, doğrusal);
  sıcak krem perde (`rgba(240,222,198,0.8)`) aşağıdan yukarı açılan bant olarak; giden plan son 10 karede `brightness 1 → 1.25`.
- **Katmanlar:** (1) giden plan (ağza doğru hızlanan itme, `expoIn`); (2) buhar videosu `mixBlendMode: screen`, `scale(1.8)`, `sepia(0.3-0.4)`
  ile ısıtılmış; (3) krem gradyan perde (tam örtüyü garanti eder); (4) gelen plan + aynı buhar döngüsü tabakta.
- **Ses:** buhar/şişme "fsss" (−20 dB civarı, kısa), arkasından gelen planın ilk olayı (tabak oturması) ayrı.
- **Remotion:** buhar videosu karanlık zeminde beyaz buhar olmalı (screen için); tek klip kısa ise üst üste binen kopyalarla döngü
  (`SteamLoop`, M1). Tam örtü karesinde görüntü değişimi. Bizdeki hazır benzer: `Transitions.tsx` `fog` (kod üretimli sis).
- **Kaynak:** SC hidden-cut A (örtü karesinde kesme) + PF `light`/`dip` (ışık ya da zeminden geçerek nefes); M1 s03→s04.

### T04 · Log-zoom dalış (karanlık/aydınlık boşluğa)
- **Ne zaman:** gelen sahne giden planın içinde bir "delik" olarak zaten var: tandır ağzı, fırın kapağı, tencere içi, kase, pencere.
- **Süre:** ana itme 52 kare (≈ 1.7 sn) kaynakta; kısa reklamda 18-26 kare (600-870 ms) yeterli (M1 s01 sonu: 26 kare).
- **Eğri:** `scale = 30^u`, `u` için `bezier(0.6, 0, 0.85, 0.5)` (yavaş başlar, dik biter); öncesinde 26-34 karelik kurulma ve %2 geri çekilme.
  Bulanıklık u > 0.35'ten sonra 0 → 20 px, **ölçeğe bölünerek** yazılır. Arka plan sahnesi 1 → 1.08 iter, devralmada `quint-out` ile hız sürekli kalır.
- **Katmanlar:** (1) gelen sahne (arka, hafif iter); (2) delikten görünen içerik: kesmeye kadar yalnız ışık/renk lekeleri, 64-90. karelerde
  18 px bulanıktan netleşir; (3) giden plan (ölçek 14-26 arasında opaklık 1 → 0); (4) delik kenarında sıcak parıltı + 1.5 px açık kesim kenarı;
  (5) dört yarı saydam hayalet kopya (0.8-3.2 kare geriden), radyal hız bulanıklığı.
- **Ses:** yükselen hava/riser kısa (≤ 600 ms), varışta yumuşak darbe ya da hiçbiri. Flaş/sarsıntı **ekleme** (zaten yüksek enerji).
- **Remotion:** `transform-origin` deliğin ortasına (render edilmiş kareden ölç). Delik içi karanlık blok olmasın, ışıklı olsun.
  Bizdeki hazır benzer: `Transitions.tsx` `portal` (pencere/tünel ağzına dalış), `camera.md §5`.
- **Kaynak:** SC transition-travel (letterform zoom); PF `push`; M1 s01 dalışı.

### T05 · Whip pan / whip tilt + hareket bulanıklığı
- **Ne zaman:** aynı yatay (whip pan) ya da dikey (whip tilt) çizgide iki plan: alevden aşağıdaki tandıra, tezgâhtan tabağa. Enerjiyi yükseltir.
- **Süre:** kaynak (fren varyantı): başta ≥ 20 kare bekleme; mesafenin %70'i sürenin %30'unda (bulanık bölüm), tepe hız ~300 px/kare;
  kalan %30 ≈ 48 karelik uzun `ease-out` kuyruk (≤ 60 kare). Kısa reklamda: 14 karelik tepe (M1: `WH ± 7`), kuyruk 12-20 kare.
- **Eğri:** tek sürekli hız eğrisi (parça parça `ease-out` birleştirme hız sıçraması yapar); hız 3. karede başlar, üstel söner; konum hızın integrali.
- **Katmanlar:** iki plan aynı tuvalde üst üste (dikey için `dy = −pw·H` / `(1−pw)·H`), tepe hızda yönlü bulanıklık:
  `sd ≈ 0.085 × hız`, en çok 64 px (SC); M1'de `46 · sin(π·pw)` px dikey SVG gauss.
- **Ses:** "whoosh" (kısa saldırı, uzun kuyruksuz), tepe hız karesine.
- **Remotion:** tepe hız 300 px/kare altında kalırsa bulanıklık kesmeyi saklamaz, geçiş bozuk görünür. Parlak görüntüde alt-kare birikimli
  `CameraMotionBlur` sarıya çalar ve basamaklı yankı bırakır (SC uyarısı): yönlü gauss tercih. Bizdeki hazır benzer: `Transitions.tsx` `whip` (8 fps basamaklı).
- **Kaynak:** SC shot-transitions B; PF `whip`; M1 s03a→s03b (whip-tilt).

### T06 · Netlik kayması ile geçiş (rack focus)
- **Ne zaman:** dikkat aynı kadrajda ön plandan arkaya kayar (ön planda kıvılcım → arkada kor; ön planda bardak → arkada tabak) ya da iki plan
  arası "bulanıktan gir, netleş" bağı.
- **Süre:** 400-800 ms (CS: "dikkat kayınca 0.4-0.8 sn"); M1: 18 kare `heavyOut`.
- **Eğri:** `heavyOut`; ön katman bulanıklığı 0.5 → 9 px ve bokeh büyümesi ×0.5 → ×2.2, arka katman 4 → 0 px; aynı `p` ile (iki eğri ayrılırsa sallanır).
- **Katmanlar:** en az iki derinlik: ön (kıvılcım/bokeh öğeleri, ayrı çizilir) + arka (video). Videonun kendi alanı yoksa ön planı kodla ekle.
- **Ses:** yok ya da çok hafif; netliğin oturduğu an olayın sesi (çıtırtı).
- **Remotion:** bulanıklığı tam kare kapsayıcıya değil küçük öğelere ver (SC depth-layer: tam kare `filter: blur` her karede render süresini 3x uzatır).
  Bizdeki hazır benzer: vox `dof` (`camera.md §4`), `Transitions.tsx` `lens`.
- **Kaynak:** PF `rack`; CS odak düzlemi kuralı; M1 s03a.

### T07 · Işık sızması yanması (light-leak burn)
- **Ne zaman:** sıcak, film tonlu bölüm geçişi (gün batımı → köz, dış → iç). Beyaz flaştan yumuşak ve yönlü.
- **Süre:** toplam 71 kare kaynakta (yükselme 28, sönme 43); kısa reklamda 24-36 kare (800-1200 ms), kesme tepe karede.
- **Eğri:** yoğunluk `t²` ile yükselir, tepe kesmede, `ease-out` söner; sıcak çekirdek opaklığı = yoğunluk³; kesme karesinde 2 kare ek parlama.
- **Katmanlar:** köşegen boyunca üç radyal elips, 1.35:1 uzatılmış, −34° döndürülmüş, renkler `#c2311a / #ff5a1f / #ffb347`, büyük eksen
  3000 / 2300 / 1700 px, `screen`, **blur filtresi yok** (elipsler süpürme yönünde kaydırılır, iç içe el feneri gibi durmasın); film kapısı kenar
  ışık bandı sağ üstten sol alta; tepede %40 tam kare sıcak örtü + beyaza yakın çekirdek; giden kareye tepe filtresi
  `brightness +85%, contrast −50%, saturate −25%`.
- **Ses:** sıcak "swell" ya da hafif riser; darbe yok.
- **Remotion:** videoda **1 kez** (ışık efekti sayılır). Bizdeki hazır benzer: `Transitions.tsx` `leak` (renk parametreli), değerleri bu tarife çekilebilir.
- **Kaynak:** SC transition-hidden-cut C; PF `light` (ışık sızması değişimi taşır).

### T08 · İris (nesneden açılan daire)
- **Ne zaman:** yuvarlak bir nesneden (tabak, kase, tava, ışık) yeni sahne açılır; yemek → marka kartı için birebir (tabak kalır, zemin değişir).
- **Süre:** 600-1000 ms (M1: 34 kare; SC: açılma 30 kare).
- **Eğri:** yarıçap log uzayında (M1: 30 → 2600 px) `bezier(0.45, 0, 0.2, 1)`; SC: `bezier(.62, 0, .32, 1)`, ardından `easeIn` ivmeli genişleme.
  Giden plan iris merkezinde 1.03 → 1.22 itilir, parlaklık 1 → 0.45 (34 kare, `easeIn`).
- **Katmanlar:** (1) giden plan (iter, kararır); (2) yeni zemin `mask-image: radial-gradient(circle at cx cy, #000 R−160, transparent R)`
  (yumuşak kenar 160 px); (3) iris kenarında hafif gölge; (4) nesne (tabak) **maskenin üstünde**, sürekliliği taşır.
- **Ses:** hafif "whoosh" ya da hiç; nesnenin yeni yerine oturması ayrı tok ses.
- **Remotion:** merkez tek sabit (nesnenin içerik merkezi, kutu merkezi değil). Gerçek daire değilse önce maskeyle yuvarla (SC).
  Bizdeki hazır benzer: `Transitions.tsx` `disc`.
- **Kaynak:** SC circle-match-iris; PF `iris`; M1 s04→s05 (lacivert iris tabağın arkasından).

### T09 · Nesne kadrajı doldurur (push-through / object fill)
- **Ne zaman:** giden plandaki bir nesne (kaşık, tabak kenarı, ekmek, sos) kameraya doğru büyür, kadrajı kaplar ve gelen planın zemini olur.
- **Süre:** 500-800 ms.
- **Eğri:** nesne ölçeği log uzayında 1 → kadrajı örten değer (`expoIn`), gelen plan `heavyOut` ile oturur; ölçekle birlikte 6-10 px odak bulanıklığı.
- **Katmanlar:** kesilmiş nesne PNG (giden planla hizalı), giden video, gelen video. Nesne kadrajı tamamen örttüğü karede görüntü değişir.
- **Ses:** kısa "whoosh" ya da nesnenin sesi (kaşık şıngırtısı).
- **Remotion:** kesik nesnenin çözünürlüğü son ölçeğe yetmeli (SC Q2: 2-4x raster). Bizdeki hazır benzer: `Transitions.tsx` `objectWipe`, `portal`.
- **Kaynak:** PF `push` ("çerçevenin içinden geçer"), SC crash-zoom (hedef %60-75 → tam kare); kanal kuralı: nesne hep gerçek görüntüden kesilir.

### T10 · Kadraj nesneye çöker (collapse to lockup)
- **Ne zaman:** kapanış: büyük görüntü (tabak/yemek) küçülerek marka düzenindeki yerine oturur; ya da tam kare ışık/halka logo kilidine çöker.
- **Süre:** 900-1300 ms çöküş + yazıların sırayla girişi (SC: 0.1-1.2 sn çöküş, toplam 4.4 sn kapanış).
- **Eğri:** ölçek 5.4 → 1 `inOutCubic` (SC; 3'ün altı etkisiz, 7'nin üstü ilk kare kadraj dışı); oturmada `sin(π)·0.06` zarflı %6 taşma
  (> %10 jöle gibi). M1: tabak `mix(r4, r5, p)` `bezier(0.65,0,0.35,1)` 30 kare, sonra kartta 1 → 1.02 nefes.
- **Katmanlar:** nesne (aynı görsel, iki ışık sürümü arasında çapraz geçiş: masa ışığı → kart ışığı), gölgesi nesneye bağlı (inişte koyulaşır),
  zemin (masa kararır `brightness 1 → 0.55`, kart zemini iris ya da düz geçişle gelir), yazılar.
- **Ses:** oturma anında yumuşak "tok" (seramik-ahşap) ya da kart için hafif chime; darbe yok.
- **Remotion:** nesnenin yeri `Rect {x, y, w}` olarak tutulup `mix` ile karışır; gölge dikdörtgeni nesne dikdörtgeninden türetilir (M1).
  Logo kilidinde dönen halka içindeki işaret **dönmez**, yalnız ölçeklenir (SC).
- **Kaynak:** SC logo-shrink-wordmark-lockup; M1 s04→s05→s06 (tabak sürekliliği).

### T11 · Spotlight sweep ile kahraman açılışı (hero reveal)
- **Ne zaman:** karanlık zeminde tabağın ışıkla "uyanması"; yemek kartı ya da hero planı (yalnız koyu zeminde).
- **Süre:** 3.5-4.5 sn kaynakta; reklamda 1.5-2.5 sn yeterli. Köşeden açılış: yarıçap 0 → 1300 px (1080p, 100 kare) **doğrusal**, son karede
  kadraj tam aydınlık; parlaklık örnekleri düzgün artmalı (8 / 46 / 101 / … / 238).
- **Eğri:** hareket ve genişleme doğrusal (kaynak: sıfır ease). Sarkaç takip varyantı: `x = 960 + 600·sinθ·env`, periyot 50 kare, 2.25 tur,
  `env` ilk salınımdan sonra 0'a yumuşar (saf sinüs en hızlı yerde frenler); sonra iris 360 → 1080 px `out-cubic`.
- **Katmanlar:** iki kopya: sönük kopya %7 opaklıkta hep görünür, parlak kopya ışığı izleyen radyal maskeyle açılır (kenar yumuşaklığı ~%15;
  sert kenar daire gibi okunur). Bekleme sırasında toz zerreleri ve nefes alan üst ışık.
- **Ses:** ışığın yanışı: hafif "fırrr" + sıcak pad; filament titremesi (4-10. karede iki kez) varsa ona tık.
- **Remotion:** iki `Img`/`OffthreadVideo` kopyası, üsttekine `mask-image: radial-gradient(ellipse at x y, …)`. Videoda en çok 1 spotlight (light-play A ile birlikte değil).
- **Kaynak:** SC spotlight-sweep-moves C, light-play-moves A.

### T12 · Punch-in vurgusu (crash zoom)
- **Ne zaman:** "işte bu" anı: et kesildiğinde içi, peynirin uzaması, sos döküldüğü an. Videoda ≤ 2.
- **Süre:** öncesinde ≥ 30 kare geniş plan (çok hafif %2-3 kayma), 6-8 kare %3-4 geri çekilme, **6 karelik** itme (4-8; > 10 sıradan itme olur),
  sonrasında ≥ 45 kare okuma.
- **Eğri:** itme `easeIn` 1 → 2.4-2.8 (hedef kadrajın %60-75'i); iki son: geri yaylanma (2.6 → 2.45, 5 kare, toparlanma %3-6) **ya da**
  çarpıp durma + sarsıntı `14 px·e^(−t/1.8)` (6 karede söner; > 20 px glitch gibi). İkisi bir arada değil.
- **Katmanlar:** video (yüksek çözünürlüklü kaynak, 4K'dan kırp), itme süresince hareket bulanıklığı (≈ 200° deklanşör, alt kare yankı aralığı ≤ glif yüksekliği,
  en çok 36-40 alt kare), varışta ~8 karede sönen sıcak pozlama parlaması, %86 vinyet.
- **Ses:** varış karesine darbe (katmanlı: alçak "thump" + yüksek "tık"); geri yaylanmada tek, sarsıntıda tek.
- **Remotion:** kamerayı `about(z, hedef)` ile kur, bulanıklık yalnız itme karelerinde. Bizdeki: `camera.md §3` ağır yakınlaşma (punch-in, 1.6-2.2, heavyOut) daha
  yumuşak sürümüdür; yemekte çoğunlukla o yeterli, sert crash zoom yalnız müzik vuruşunda.
- **Kaynak:** SC crash-zoom-punch; `docs/styles/camera.md`.

### T13 · Vuruş montajı (beat-cut, sert kesme dizisi)
- **Ne zaman:** müzikli hızlı bölüm: malzeme dizisi (et, soğan, biber, ateş), aynı nesneye üç adımda yaklaşma (geniş → orta → makro).
- **Süre:** SC: kesmeler 30 / 52 / 70. karede (aralık 22 → 18 kare daralır), sonra ≥ 70 kare bekleme; RA (Ohneis): durağan foto vuruş başına 0.5-2 sn.
  Bizim kural: dizideki her plan ≥ 0.5 sn, dizi bir kez, ardından ≥ 2 sn sakin plan.
- **Eğri:** kesmeler **sert** (2 karelik erime bile vuruşu öldürür). Gelen plan 1.03 → 1 ölçek, 6 kare `ease-out`, −16 px çökme; isteğe bağlı 4 karelik beyaz/sıcak flaş (0.95 → 0).
  Üç kırpım: zoom 1.0 / 1.6 / 2.8.
- **Katmanlar:** planlar, flaş katmanı (isteğe bağlı), odak çerçevesi (yemekte kullanma; UI dili).
- **Ses:** kesmeler müzik vuruşuna (`beatF(n)`), her kesmede aynı ses değil: iki örnek dönüşümlü, seviye basamaklı (0.40 → 0.25).
  Sessiz sürümde "görüntü zıplıyor" gibi okunur: müzik şart.
- **Remotion:** kesme kareleri vuruş ızgarasından (bkz. food-promo.md §7). Aynı tür kare üç kez art arda gelmez (RA); hareket türü ardışık vuruşlarda tekrarlanmaz.
- **Kaynak:** SC beat-cut-moves + music-beat-sync; RA ohneis-style; PF "gerçek görüntü ölçülü canlandırılır, vuruşta kesilir".

### T14 · Sıcak flaş kesme (flash-cut)
- **Ne zaman:** aynı enerjide iki plan arasında sert kesmeyi yumuşatmak; bölüm başı. Yemekte beyaz yerine sıcak krem (`#FFF1DC`).
- **Süre:** kesme ±5 kare (toplam 10 kare); logo sürümünde: 12 kare şarj (parlaklık 1 → 1.7) + 6 kare radyal flaş (80 → 1580 px, `t²`) +
  4 kare tam beyaz (kesme bu arada) + 22 kare `quint-out` toparlanma.
- **Eğri:** flaş opaklığı `easeOut` söner; toparlanırken gelen plan 1.03 → 1 (> 1.06 "pop" gibi).
- **Katmanlar:** iki plan + flaş katmanı. Başka geçişle birleştirme yok. Flaş yalnız sert kesmeleri örter, süs ışığı değildir.
- **Ses:** **zorunlu** darbe ya da parlak whoosh, flaş tepe karesine.
- **Remotion:** `AbsoluteFill` + opaklık; tam kare vurgu sayılır (≤ 3 kuralı).
- **Kaynak:** SC shot-transitions A (flash-cut), white-flash-logo-simplify-cut.

### T15 · Hız rampası ve donma (speed ramp / freeze)
- **Ne zaman:** dökülen sos, kırılan kabuk, kaşığın kaldırdığı uzayan peynir: an yavaşlar ya da donar, yazı/ok girer, sonra akış hızla telafi eder.
- **Süre:** donma ≥ 45 kare (SC 67), çözülme 22 kare `smootherstep` (ortalama eğim > 1 ile zamanı geri kazanır). Videoda ≤ 1.
- **Eğri:** akış eğimi 1, donma eğimi 0 (yumuşatmasız anlık), çözülme `smootherstep`.
- **Katmanlar:** kaynak video (yeniden zamanlanmış), donma karesinde 3 karelik deklanşör flaşı, isteğe bağlı el çizimi daire/ok (10 kare çizim).
- **Ses:** donmada sesin de kesilmesi (müzik filtre/duraklama) ya da tek vurgu; efekt çıkış zaman çizgisine yerleşir, kaynak kareye değil.
- **Remotion:** `OffthreadVideo` değişken hız desteklemez: kaynak klibi önce ffmpeg ile (`setpts`/`minterpolate` yok, yüksek fps kaynak tercih)
  rampalı pişir, ya da `startFrom` yerine kare başına `<Freeze frame={remap(f)}>` ile çiz. 60 fps+ kaynak yoksa yavaşlatma yapma (takılır).
- **Kaynak:** SC speed-ramp-freeze; impact-feedback (iki yeniden zamanlama sistemi aynı planda çakışmaz).

### T16 · Çapraz erime ve zemine karartma (dissolve / dip) — yalnız bilerek
- **Ne zaman:** zaman atlaması (sabah → akşam, çiğ → pişmiş), nefes (PF: "ifadeler dip, blur ya da light ile"). Yemek reklamında varsayılan **değil**.
- **Süre:** erime 15 kare (RA `Crossfade`); karartma 300 ms in + 400 ms açılış (MANA001 v1, kor parıltısından açılış).
- **Eğri:** opaklık doğrusal ya da `sin`; bulanık erimede giden plan 0 → 6 px, gelen 6 → 0 px.
- **Ses:** müziğin bir cümle sonuna denk getir; efekt yok.
- **Kural:** videoda en çok 1; storyboard'da nedeni yazılır. MANA001 v2 bunu bilerek kaldırdı (kamera hareketiyle geçiş).
- **Kaynak:** RA animations (crossfade 15f); PF `blur`, `dip`; PF gentle-story "style (dissolve)".

### T17 · Kapı / panel açılması (doors)
- **Ne zaman:** fırın kapağı, dolap, perde, ekmek ikiye ayrılır: kadraj ortadan iki yana açılır, arkasında yeni sahne.
- **Süre:** 500-800 ms, `heavy` ya da `bezier(0.7, 0, 0.3, 1)` (yavaş başlar, hızlı biter).
- **Katmanlar:** giden planın iki yarısı (clip-path), arkada gelen plan 0.42 → 1 ölçekle aynı `t` ile (pencere geometrisi ve içerik **aynı anda**
  sürülür; ayrışırsa dikiş glitch gibi okunur), açılma çizgisinde ince parlak kenar (yoksa PowerPoint geçişi gibi durur).
- **Ses:** gerçek nesne sesi (kapak gıcırtısı, ekmek çıtırtısı).
- **Remotion:** iki `AbsoluteFill` + `clipPath: inset(...)`; bizdeki `Transitions.tsx` `door` (menteşeli kanat) yakın.
- **Kaynak:** PF `doors`; SC shot-transitions C (maske penceresi: içerik ve pencere aynı `t`), wipe-transitions (sınırda parlak çizgi).

### T18 · Düzen dönüşümü (aynı zeminde görünmez kesme)
- **Ne zaman:** iki marka kartı arası (ürün adı → etkinlik + tarih + CTA). Zemin değişmez; öğeler yer değiştirir.
- **Süre:** 600 ms (M1: satırlar çıkış `easeIn(quad)` 8 kare, satır başına 1 kare kaydırmalı; tabak 21 kare `bezier(0.65,0,0.35,1)` ile yeni yerine).
- **Katmanlar:** sabit zemin (yay/ışık çok yavaş nefes), kalan nesne (tabak), çıkan yazılar (yukarı 70 px + sönme), giren yazılar.
- **Ses:** yok ya da sonraki rozet sesine bırak.
- **Kaynak:** M1 s05→s06; SC R2 (ivmeli, kaydırmalı giriş-çıkış).

---

## B. Plan ve vurgu tarifleri (sahne içi)

### P01 · Ağır itme (slow push) — yemekte varsayılan kamera
- Sahne boyu ölçek farkı 0.02-0.06 (RA Ken Burns: yavaş 1.0 → 1.03, normal 1.02 → 1.06; PF `push/pull` %5), `sin`; hızlı plan 1.0 → 1.10.
- Kamera hiç tamamen durmaz (CS: sabit hız ya da ilk üçte birde ease-out, sonra yavaş sabit sürüklenme; asla sarsılmaz). Ürün reklamında el kamerası yok (SC Q3).
- Ardışık planlarda yön değişir (RA: zoom yönünü vuruşlar arasında değiştir; CS: köşegen yönünü değiştir).

### P02 · 2.5D paralaks kaydırma (fotoğraf için)
- Üç katman katsayısı 0.35 / 0.7 / 1.4, yazı 0 (SC depth-layer); katmanlar arası fark ≥ 2x, en çok 4 katman.
- Arka katman bir kademe büyük, 5 px bulanık, doygunluk 0.7, üstte yoğun sis; orta (okunan, yemek) **bulanıksız ve yüksek çözünürlüklü**; ön 7 px bulanık.
- Eğri `bezier(0.45, 0, 0.18, 1)`, 130 kare; konum oturduktan ~8 kare sonra kahraman nesne 6 → 26 yükselir, 1.035 ölçek.
- Bizde: `tools/photo_planes.py` + `depth-elements.md §2` (`planes`). Bulanıklığı tam kareye değil küçük öğelere ver.

### P03 · Tabak inişi (drop + bounce + temas gölgesi)
- 17 kare düşüş `easeIn(quad)` (−420 px → 0), ölçek 1.07 → 1; 9 karelik tek sekme −6 px (`sin`); ikinci sekme yok (SC letter-drop: 3+ sekme jöle).
- İki gölge: geniş yumuşak gölge (inişte 0.3 → 0.86 opaklık, 60 → 30 px bulanıklık) + dar temas gölgesi (iniş ilerledikçe koyulaşır).
- İnişten sonra kamera log 1.0 → 1.045 `sin`. Ses: tok seramik-ahşap, iniş karesine (M1 `land` cue).
- Kaynak: M1 s04; SC Q9 (öğe gerçek yerine oturur, havada süzülmez).

### P04 · Buhar katmanı (sürekli)
- Siyah zeminli gerçek buhar videosu, `screen`, `brightness 1.7-2.0`, `sepia 0.25-0.3`; iki katman: arka net, ön iri + 4 px bulanık + aynalı.
- Dikey maske: alt %0 → %22 açılır, %80'den sonra söner (tabağın içinden doğar, kadraj üstünde kaybolur).
- Opaklık hikâyeye bağlı: inişte belirir (0.5), "buhar" kelimesinde kabarır (0.9), kartta incelir (0.26). Kısa klip üst üste binen kopyalarla döngü.
- Arka ışıkta (koyu zemin önünde) buhar görünür; açık zeminde kaybolur.

### P05 · Kıvılcım / kor parçacıkları
- Işık noktasından patlama: 34 kıvılcım, 16-38 kare ömür, hız `v·e^(−t/9)`, hafif yerçekimi, uzunluk hıza bağlı (hareket izi), `hsl(30-48, 100%, 62-80%)`.
- Ön planda 14 iri bokeh disk (netlik kaymasında büyür/bulanıklaşır, T06). Yalnız ateş sahnesinde; yemek tabağında yok.

### P06 · Yağ parıltısı / başlık parıltısı (sheen sweep)
- Yemekte: dar, sıcak beyaz bant (`linear-gradient(105°)`), `screen`, **yalnız yemek maskesinin içinde** (`mask-image: plate_food_mask.png`),
  tepe opaklık ≤ 0.2-0.35, 39 kare boyunca −30% → 130%. Bir planda bir kez.
- Başlıkta: aynı bant `background-clip: text` ile harflere kırpılır (radyal örtü koyu zemine taşar); başlık parıltısı ile tabak bandı aynı karede
  (M1 `G0..G1`, 17 kare). Kaynak: bant genişliği kartın 2x'i, 115° gradyan, geniş yumuşak bileşen 0.14 + dar sıcak çekirdek 0.5 (SC light-play B).
- Videoda ışık efekti ≤ 2 sayımına girer.

### P07 · Rozet pop (tarih/fiyat/etiket)
- Yay: RA `popIn` `damping 8, stiffness 150, mass 0.6`, ölçek 0.5 → 1, opaklık yayın ilk %30'unda 0 → 1; RA `ScalePop` `damping 8, stiffness 200`.
  M1: `damping 8, stiffness 210, mass 0.6`, ölçek 0.45 → 1, opaklık 3 kare.
- Ek: rozet kenarından dışa genişleyen halka (14 kare, ölçek 1 → 1.3 / 1.6, opaklık 0.7 → 0). Taşma %8-10'u geçmez.
- Ses: kısa "pop" ya da tahta "tık", yayın ilk tepe karesine. Rozet, hemen ardından giren CTA'dan ≥ 0.5 sn önce.

### P08 · Yazı girişleri (başlık, CTA)
- **Blur-slide** (varsayılan sakin giriş): kelime başına `p = ramp(f, start, dur, quint-out)`, `opacity = p`, `translateY = (1−p)·dy`,
  `blur = (1−p)·B` (üçü aynı `p`). Ana başlık: kaydırma 4 kare, kelime penceresi 22 kare (kahraman kelime 30), dy 64 px, B 18 px;
  alt yazı: 2.4 kare, 20 kare, dy 26, B 9. Bulanıklık yazı boyunun %12'sini geçmez. (SC blur-slide)
- **Satır yayı** (kelimeyle aynı karede, anlatımlı): `spring damping 12, stiffness 190, mass 0.6`, 18 px aşağıdan, ölçek 0.94 → 1 (M1).
- **Giriş kartı vuruşu** (hızlı Reel): 4 kare (≈ 130 ms) sönme + ölçek 0.92 → 1.0; küçük yazı büyükten 2-3 kare geride (RA Ohneis).
- **CTA**: 14 kare `heavy ease-out`, 30 px aşağıdan; ≥ 1 sn tam durgun bekler (SC R1), en küçük satır olmaz (SC Q11).
- **Kapanış kopyası** (sinematik): tek satır, 16 px bulanıktan 0.6-1 sn'de netleşir, 3-5 sn kalır; logo 0.3 sn erimeyle, durağan (CS).
