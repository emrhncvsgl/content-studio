# Kodla 3D sahne (three.js, Remotion içinde)

2026-11-08. Kaynak: cinecode `references/camera-moves.md`, `motion.md`, `finish.md`, `styles/woodcut.md` ve Lemo-Opuscar `woodcut` (MIT; sarpstar, lemomo-ai),
bizim hattımıza uyarlandı. İlk uygulama: `studio/src/styles/woodcut/WoodcutMatch.tsx` (EP009 s01 denemesi, `WoodcutMatch` kompozisyonu).

## Nasıl çalışır (Remotion ile birlikte, ayrı değil)
- `@remotion/three` 4.0.533 + `three` 0.178.0 + `@react-three/fiber` 9.3.0 (sabit sürüm). `<ThreeCanvas>` bir Remotion bileşeni: timeline, altyazı, ses,
  geçişler, render aynı. Mevcut stiller ve Shorts etkilenmez; 3D yalnızca bir sahne onu seçince devreye girer.
- **Kare = zamanın saf fonksiyonu:** her şey `useCurrentFrame()`'den hesaplanır (animasyon, kamera, ışık); `Math.random` yok, tohumlu `hash(n)`.
  `useFrame(..., 1)` ile kendi render sırası (önce sahne → render hedefi, sonra baskı/post geçişi); öncelik > 0 varsayılan render'ı kapatır.
- **Render hızı:** GPU'da çok hızlı (7 sn 1080p ağaç baskı ≈ 22 sn). Ağır plaka/PIL pişirmelerinden (s01_plate.py ~4 dk) hızlı.
- Sahne malzemesi ışık bilgisini kanallara yazar (R parlaklık, G tek renk/alev, B mürekkep zorlaması, A nesne kimliği); stil tek bir tam ekran
  shader'da "basılır". Yeni stil = yeni baskı shader'ı, aynı sahne.

## Kamera satırı (her plan bir satır: ad, süre, hız/yumuşatma, hedef)
`dolly in, 3 sn, slow, inertia, toward the paper eyes`. Hız sözcükleri ölçülü:

| Sözcük | Boyut değiştiren (dolly, zoom, push) | Süpüren (pan, truck, orbit) |
|---|---|---|
| slow | konu boyutu saniyede ≤ %10 | bir nesne kadrajı ≥ 6 sn'de geçer |
| medium | saniyede %10-25 | 3-6 sn |
| fast | > %25 | 1.5-3 sn (daha hızlı = whip) |

- Yumuşatma: `linear` (makine) · `ease-in` (güç toplama, sonlar) · `ease-out` (kanca: ilk karede en hızlı) · `ease-in-out` (kendi içinde kapalı) ·
  **`inertia`** = 0.35·doğrusal + 0.65·smoothstep: ilk karede hareket hâlinde, kesmede hâlâ hareketli (varsayılan).
- Plan başına bir ana hareket + en çok bir ikincil (handheld, küçük tilt). Her hareketin sebebi: takip, açığa çıkarma, gerilim (push), rahatlama (pull).
- Adlar: pan, tilt, dolly in/out, zoom (paralaks yok, gözetim hissi), truck, orbit (5-30°), crane up/down, dolly zoom (filmde en çok bir kez),
  push-in on detail, pull-back reveal, handheld (düşük frekans, tohumlu; kare başı titreşim asla), freeze frame, speed ramp.
- Odak: focus pull (açığa çıkarma, dikkat değişimi); dof yakın planda, geniş planda ve yazıda yok.
- Mevcut 2D kamera dilimiz (`camera.md`: heavy ease-out, log zoom, lens odağı) ile aynı aile; 3D'de paralaks gerçek.

## Hareket kuralları (motion)
- **Bir an, bir lider:** her vuruşta tek kahraman en büyük/ilk hareketi yapar, diğerleri daha az. **Önce sebep, sonra sonuç**: el bardaktan,
  kibrit ışıktan 2-4 kare önce. **Bir tetik, bir başlangıç**: aynı olaya tepkiler bir kare içinde başlar.
- **Ağırlık = zamanlama:** ağır yavaş başlar sert durur (metal 1.2× süre, sekme yok); hafif hızlı başlar süzülür. Çift mesafe ≈ 1.3× süre.
  Çıkışlar girişlerin %65-75'i. İnişten sonra 4-6 kare dur.
- **Canlı/atılan/düşen şey asla doğrusal hareket etmez**; doğrusal yalnızca makine. Girişler ease-out, çıkışlar ease-in. Pop yok.
- Kademe (stagger): sıkı 1 kare, standart 2-3, dramatik 3-5; okuma sırası, patlamada merkezden dışa.
- Gözden geçirme durağan kareyle değil şeritle (her vuruşta saniyede 12 kare + iniş +0.3 sn).

## Bitiş araç kutusu (sahne başına gerekenler, gerekçesiyle)
- **Işık:** tek gerekçeli anahtar ışık (güneş, lamba, pencere, alev) şart; yalnız ortam ışığı maket gibi görünür. Yumuşak gölge, temas gölgesi/AO,
  arka ışık (siluet), pratik ışıklar (lamba, ateş), hacim/toz (iç mekânda havasız sahne değilse).
- **Lens:** dof (yakın plan), bloom (alev, lamba; gündüz beyaz duvarda değil), vinyet, hafif kromatik sapma yalnız kenarda; lens flare tek bilinçli an.
- **Hava:** sis/uzaklık soluklaşması, toz parçacıkları (durağan planda canlılık). **Malzeme:** değişen pürüzlülük, aşınma, kir, renk çeşitliliği.
- **Geometri:** pah/yuvarlatılmış kenar ışığı yakalar; nesnenin gerçek parçaları adlarıyla (yarım detay asla); örneklerde çeşitlilik.
- **Hareket:** ikincil hareket (duman, kumaş, toz), hızlı harekette motion blur, belgeselde hafif handheld.
- **Post:** ton eşleme (ACES/filmic), kenar yumuşatma, renk derecelendirme, tane. Taslakta her GPU sahnesinin anahtar ışığı, ton eşlemesi ve AA'sı olur.

## Ağaç baskı (woodcut) stili
Gramer (Lemo/cinecode, MIT): her kare **siyah bir ahşap kalıp**; ışık yalnızca bıçağın oyduğu yerde. **En çok tek renk, o da yanan şey için**
(EP009: kibrit alevi, yanık bakır `#d9692a`). Kâğıt payı sabit kalır, kalıp kenarı düzensiz mürekkep.
- **Oyuklar biçimi takip eder:** yuvarlak şey yaylarla sarılır, ışık ve ateş ışınsal yayılır; parlak = geniş oyuk, orta = ince, karanlık = oyulmamış.
  Uzak = sık ve ince, yakın = seyrek ve kalın. Her oyuk ayrı bir kesik (30-160 px, künt uç). Fotoğrafı eşikten geçirmek değil.
- **Figürler:** siyah siluet + beyaz bıçak halesi + yalnız aydınlık kenarda yalayan ışık tarama; ten beyaz oyulur, yüz hatları siyah kalır.
- **Hareket:** karakterler ikişer karede (12 fps), kamera/ateş/ışık her karede; tarama nesnenin yerel uzayında (kaynamaz), yalnız ateş 2 karede bir yeniden oyulur.
  **Oyma açılışı**: resimler belirmez, oyulur (parlaktan karanlığa, kabadan inceye). **Sert kesme = yeni baskı** (2 kare kayık baskı).
  Geçiş grameri: merdane mürekkep → kâğıt iner → baren → kâğıt soyulur; ağır geçiş (dissolve) yok.
- **Altyazı:** kâğıt payında, baskı harfi (IM Fell English, OFL); görüntünün üstüne binmez. (Kanal altyazısı cap-paper ile çelişirse sahne bazında karar.)
- **Ses:** alçak yaylılar, tahta ve deri vurmalılar, tek tam-tam; foley malzemeyi izler (bıçağın ahşaba girişi, talaş, kâğıt); sessizlik bir araç.
- **Tuzaklar:** beyaz üstüne beyaz oyuk görünmez; her yüzeyi taramak kürk/yağmur gibi durur (yalayan ışık, yalnız aydınlık kenarda 3-6 kesik);
  kısa titrek tarama zikzak olur (uzun kesikler); duman konunun üstüne binmesin.
- **Bizim uygulama:** `WoodcutMatch.tsx`: sahne geçişi (lambert + mesafe sönümü, nesne kimliği) → baskı shader'ı (masa: alevden yayılan halkalar 15 px;
  kâğıt/kibrit: yatay paralel 8 px; titreklik fbm; kesikler gürültüyle bölünür; en parlak tam oyuk; mürekkep düzensizliği, benek; tek renk plakası
  yalnız oyulmuş beyaza, 1.5 px kayık). Hata ayıklama: `REMOTION_WOOD_DEBUG=1` ham kanalları gösterir.
- Ne zaman: anlatılan ama tek kaynaklı anlar, hafıza/efsane, gece/hapis/kamp, insan yüzü gerekip fotoğrafı olmayan kişiler (siluet).
  Belgeli olgular gerçek fotoğrafla kalır: izleyici görsel dilden neyin belge, neyin anlatı olduğunu sezer.

## Ortak kit ve videoya bağlama (2026-11-08)
- **Kit:** `studio/src/styles/woodcut/kit.tsx`: shader'lar (WoodcutMatch kopyası + yeni bantlar), `usePrint(w, h, {plate, seed, halo})` (iki geçiş;
  her karede `update(ışıkDünyaKonumu, oymaYarıçapıPx)`), `litMat(albedo, grain, id, pupils)`, `SeatedFigure`, `StandingFigure`, ampul shader'ı,
  `wordFrame(words, "söz öbeği", fps, yedekSn)`, `onTwos`, `inertia`. Nesne kimlikleri (A kanalı): 0.2 zemin/masa (ışıktan halkalar) · 0.45 duvar
  (dikey kesik) · 0.6 kâğıt · 0.75 figür (siyah + yalnız kenar ışığı + beyaz bıçak halesi) · 0.9 nesne · 1.0 alev/ampul (tek renk).
  **WoodcutMatch kite taşınmadı** (kullanıcı onaylı görünüm birebir kalsın diye); yeni sahneler kiti kullanır.
- **Sahneler:** `WoodcutMatch` (s01), `WoodcutCell` (s02b), `WoodcutInterrogation` (s24b), `WoodcutReturn` (s25); hepsi `durationInFrames` ve
  `words` props'u alır (Root'ta calculateMetadata).
- **Videoya bağlama (Manim yolu):** timeline'da `style: woodcut`, `props: {comp, video: "episodes/<EP>/assets/woodcut/<sid>.mp4"}` →
  `voice/.venv-chatterbox/bin/python tools/woodcut_render.py <EP> [--only sNN] [--force]` her sahneyi kendi süresi ve kelime zamanlarıyla render eder;
  ana video klibi oynatır (`styles/woodcut/index.tsx`), uzun ana render'da WebGL yok.
- **Tuzaklar (bu oturumda yaşandı):**
  - Kamera taşınan karede ışığı ekrana yansıtmadan önce `camera.updateMatrixWorld()`: yoksa `project()` önceki karenin (tek karede ilk) kamerasını
    kullanır, oyma açılışı yanlış merkezden açılır (s25'te kare ortasında keskin çapraz kenar). Kit `update` bunu yapar.
  - Figür siluet okunsun diye ışık figürün **arkasında/üstünde** olmalı (duvar aydınlık, figür siyah); önden ışıkta tahta manken gibi durur.
    Figür albedo ≈ 0.4 (sorgucu gibi tamamen siyah biçim için 0.16), baskıda figür kesiği yalnız T > 0.5.
  - `rotation` x ekseni pozitif açı kolu **geriye** atar (-y → -z); öne uzanan kol için negatif.
  - Render sırasında yazı tipleri Google'dan iner: internet yoksa `remotion still/render` delayRender zaman aşımı verir (yerel font: ayrı iş).
  - zsh döngüsünde `set -- $c` kelimelere bölmez (`${=c}`), `$r:c...` değiştiricidir (`${r}`).

## Lemo motoru (2D kesik motoru, 2026-11-10; EP010 denemesi)
Lemo-Opuscar woodcut motoru stüdyoda: `studio/src/styles/woodcut/lemo/` (MIT, commit `bebbbe1`; `README.md` neyin alındığını yazar). TS'den
`import { WC, Sculpt, TR } from "./lemo"`. Bizim kit (three.js sahne → bant shader'ı) ile farkı: **her oyuk ayrı bir el kesiği**, biçimi izler,
kendi oyulma zamanı vardır. İlk sahne: `WoodcutLemoHands.tsx` (bandı geren iki el + kare kutu).
- **Ne zaman hangisi:** gerçek kamera/paralaks/figür gereken mekân planı → kit (three.js). El, nesne, yüzsüz yakın plan; fotoğraf ya da 3D kareden
  oymaya geçiş; vuruş vuruş oyulma → Lemo motoru. Karışım: three.js karesi (ya da fotoğraf) `WC.woodcutFilter`'a girdi olur (ışık/kamera bizden, kesik onlardan).
- **Boru hattı:** `Sculpt(w,h)` (capsule / blob / plank / creases / noise) → `shade(light, {mats})` gri görüntü (alfa = içerisi) →
  `new WC.Region(q => q.drawImage(img,…), {res:2, bbox})` → `WC.woodcutFilter(img, {rect, region, sp:5, black:.06, white:.82, res:2, seed, reveal})` →
  maske tuvali siyah doldur, `WC.drawStrokes(m, strokes, {t})` → `WC.plate(c, polys, a)` tek renk → `WC.makePrinter().render(mask, plate, {seed, plate:'#hex'})`.
  Işık yönü: `WC.light(x,y,z)`; x negatif = soldan, y negatif = üstten; z ≈ 0.4 yalayan ışık (düz alan siyah kalır).
- **Remotion kuralları:** motor ve yazıcı `useMemo` içinde bir kez; çizim `useLayoutEffect`'te `useCurrentFrame()`'den (kare = zamanın saf fonksiyonu).
  Pozlar ikişer karede ve **tamsayı anahtarla önbellekte** (aynı poz aynı kesikleri verir, kaynama olmaz); oyma açılışı yalnız ilk pozda `reveal` ile,
  sonraki pozlar `t: 1e9`. Rastgelelik tohumlu (`mulberry`); `mkStroke`'a her zaman `seed` ver (vermezsen `Math.random` → işçiler arası fark).
  Kamera: maske ve plaka bağlamına aynı `setTransform`; kâğıt payı dönüşümden SONRA beyaz doldurulur (pay sabit kalır).
- **Tuzaklar:** `plank` yalnız yükseltir (sert yazma), sonradan eklenen `capsule/blob` altında kalmasın diye ellerin `z0`'ına ofset ver (bant 53, eller +46).
  Siluetin arkadaki ışınları örtmesi için gri görüntüden `source-in` ile siyah siluet + 6 px kaydırmalı beyaz hale çiz, sonra kesikleri.
  Koyu malzemede (`alb` < 0.6, `amb` 0) kesik çıkmaz, boş siyah leke kalır → kumaşa `alb .8`. Plaka yalnız oyulmuş beyazda görünür: renkli nesne parlak olmalı.
  Tek kare denemesi: `npx remotion still src/index.ts WoodcutLemoHands out/trials/x.png --frame=110` (~20 sn).
- **Karışım (three.js → Lemo), denendi 2026-11-10, `WoodcutLMCabin.tsx` (EP010 s07):** sahne `litMat` ile 960×540 `WebGLRenderTarget`'a çizilir
  (`UnsignedByteType`, R = parlaklık, A = nesne kimliği), `gl.readRenderTargetPixels` → Y çevrilerek 2D tuvale → `WC.woodcutFilter` → maske →
  `makePrinter` → `CanvasTexture(P.canvas)` (`colorSpace` sRGB, `toneMapped: false`) tam ekran dörtgenle aynı three tuvaline. Hepsi `useFrame(…, 1)` içinde, eşzamanlı.
  - **3D kamerayı OYNATMA:** kamera ilerleyince filtre her pozda bütün kesikleri yeniden dağıtır (iki ardışık poz arası ortalama fark 14.8/255 = kaynama).
    Kamera 3D'de sabit, yaklaşma maskeye 2D `setTransform` ile (fark 2.9'a indi, kalan yalnız ölçek kayması). Gerçek paralaks gereken plan kitin bant shader'ında kalır.
  - Figür hareketi az sayıda basamakta (`Math.round(u*4)/4`): her basamak yeni baskı gibi okunur, arada kesikler sabit.
  - **Işık figürlerin arkasında ve üstünde** (duvar aydınlık, omuz ve baş üstü kenar ışığı alır); önce ışık öndeyken alt yarı tamamen siyah, figürler görünmezdi.
  - Figür halesi: A kanalından (kimlik 0.75 → 181-201) siluet tuvali, 7 px kaydırmalı beyaz hale + siyah dolgu, **kesiklerden önce** çizilir (kenar ışığı kesikleri kalsın).
  - Düz duvar tamamen taranmasın diye `black: .1`, `white: .92`, duvar albedosu 0.42; pencere `MeshBasicMaterial` R = 1.
- **Sahne kiti (`lemoKit.tsx`, 2026-11-10):** yeni bir Lemo plakası = bir `PlateDef` (`light`, `pose(t, cue) → tamsayı dizisi`, `sculpt(S, p)`, isteğe bağlı
  `plate`, `rays`, `reveal`, `filter`, `zoom/focus`); `LemoPlate` gerisini yapar (poz önbelleği, hale, oyma açılışı, kâğıt payı, baskı). Yardımcılar: `hand`
  (aç/ayna/ölçek/`curl`; bilekten parmak ucuna yön ≈ `ang` + 0.58 rad, uzunluk ≈ 320·sc; aynada x → 960−x), `ring`, `strip`, `ellipse`, `canister`, `steps`.
  Kelime ipuçları `props.cue` (`"word"` ya da `"word.+900"`) → `c(ad, yedekSn)`; `tools/woodcut_render.py` `variant`/`value`/`cue` alanlarını kompozisyona geçirir.
  EP010 sahneleri tek dosyada: `WoodcutA13.tsx` (kayıt Root'ta `A13_WOODCUTS` döngüsü). Eski `WoodcutLemoHands.tsx` yalnız ilk denemenin referansı, kayıtlı değil.
  Poz parametresi sayısını az tut: her yeni değer bir yontu + filtre koşusu (~0.3-0.5 sn).
- **Dikey plaka + canlı alev (EP014 s01-s02, 2026-11-12, `WoodcutDavyLemo.tsx`; kullanıcı: three.js kit sürümünde "dramatiklik yok"):** `LemoPlate`
  1920×1080'e sabit, 9:16 için bileşen kendi tuvallerini kurar: `WC.canvas(1080,1920)`, `WC.makePrinter(1080,1920)`, yontu 540×960 (×2).
  - **Vuruş vuruş oyma:** `drawStrokes`'a zaman basamaklı `tc` ver (`n=floor(t/P)`, `tc = n·P + clamp((t−n·P)/B)·P`, P .34, B .12): kesikler
    darbelerle ilerler, aralarda durur. Açılış `reveal: {mode:'radial', cx, cy}` ile alevden dışa (ışık oyulur gibi).
  - **Canlı nesne (alev) filtreye girmez:** her 2 karede çokgen + `WC.fillPoly(m,[poly],'#fff')` + iç dil çizgileri `drawStrokes(..., {color:'#000'})`
    + `cutAlong(offsetPoly(poly, d))` hale kesikleri + `WC.rays`; yontu (el, mum) tek pozda kalır → kaynama yok. Tavana değince çokgen tavan çizgisi
    boyunca yayılır; yayılma eşiğini dilin ALT kenarına koy (yoksa birleşimde çentik çıkar).
  - **İki renk plaka:** yazıcı tek `plate` rengi alır. İkinci yazıcıyı AYNI `seed/inkSeed` ile ikinci plaka tuvaliyle çalıştır, çıktıyı geçici tuvale
    `copy`, sonra `destination-in` ile ikinci plaka tuvalini (alfa = yoğunluk) uygula ve üstüne çiz: kâğıt/mürekkep birebir aynı, yalnız mavi bölge değişir.
    Turuncu/mavi geçişi iki plakada tümleyen `createLinearGradient` alfalarıyla (mavi uç = gaz bandı).
  - **Kamera:** maske ve plakalara aynı `setTransform(z,0,0,z, cx−fx·z, cy−fy·z)`; hızlanan itiş `z = 1 + .14u + 2.3u⁴` (u = kare/kesme), odak
    son 1 sn'de alevden tavan temasına. Vektör kesikler büyütmede keskin kalır (1080p'de 3.4× sorunsuz). Kâğıt payı dönüşüm sıfırlanınca çizilir.
  - **Sert kesme = oyulmamış kalıp:** kesme karesinden sonra maske tam siyah + kâğıt payı. Müzik (`music_build.py` sayısal sıfır) ve tüm sfx
    (`untilWord … untilOffsetMs 170`) aynı kareye bağlı: `fCut = round(lengthen.endMs·fps/1000) + 5`.
  - Tek kare: `npx remotion still src/index.ts WoodcutDavyLemo out/x.png --props=<{shot, durationInFrames, words}>.json --frame=N` (~20 sn, words
    timeline `cueWords`'ten; vermezsen yedek saniyeler kullanılır). 206 kare dikey klip render ≈ 1-2 dk.
- **v3 dersleri (EP014, 2026-11-12, kullanıcı notları):**
  - **Tam ekran plaka:** kâğıt payı (krem çerçeve) isteğe bağlı; `WoodcutDavyLemo` `M = {top:0, side:0, bottom:0}` ile kenardan kenara kara kalıp
    (kullanıcı: "bütünlük"). `LemoPlate` varsayılanı (44/60/120 pay) değişmedi; tam ekran gereken sahnede payı çizme. s03'e geçişteki "kâğıt iner"
    katmanı paydan bağımsız (CSS katman), tam ekranda da çalışır.
  - **Düz renk bant = oyma değil:** canlı alevin içi `fillPoly` beyaz + plaka renginde kalınca "düz mavi/turuncu bant" okunur. `carveFlame`: çokgeni
    beyaz oy, içine biçimi izleyen kesik siyah çizgiler (`cutAlong` + `clip`): gövdede L/R kenarları arası `n = genişlik/11` çizgi, tavan dilinde
    tavana paralel dalgalı çizgiler (aralık ×0.6).
  - **Kesmeye karanlık bekleme koyma:** 1.8 sn sessiz karanlık "kopuk ve uzun" bulundu. Yerine **alevle eşleşen geçiş**: `flameField(u, k, spread, baseY)`
    ekran koordinatında alttan yükselen 9 oyma alev dili (yüksekten alçağa sıralı çiz, tabanı ekran dışına it: `baseY+220`); s01 sonunda u 0→1
    kareyi doldurur, s02 AYNI fonksiyonla dolu başlar, dil alanı daralıp korlara iner; ızgara alevin içinde siyah siluet (`clip` + siyah kesik), karanlıkta beyaz oyma.
  - **Altyazı:** krem şerit krem nesne (mum) üstünde soluk okundu. Sahne props `captionSolid: true` → `PaperStrips solid`: giriş solması yok + koyu ince kontur.
- **Henüz denenmedi:** `TR.curl/peelState` (kâğıt soyma geçişi), fotoğrafı filtreye vermek, `mode:'block'`.
