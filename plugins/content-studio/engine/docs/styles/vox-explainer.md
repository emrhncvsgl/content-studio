# vox-explainer — kâğıt kolaj belgesel anlatım stili

Bu dosya **öğretici anlatımdır** (kullanıcı için: terimler, nedenler). Ajanın uyguladığı kısa talimat ayrı dosyadadır:
`.studio/plugin/skills/remotion-styles/vox-explainer.md`. Stile yeni bir özellik eklendiğinde ikisi de güncellenir.
Kod: `studio/src/styles/vox-explainer/index.tsx` (props başvurusu dosyanın başında). İlk kullanım: EP002 (s02, s04, s06, s07).

## 1. Adı ne, aslında ne?

"Vox stili" bir lakaptır. Vox Media bu görünümü çok kullandığı için böyle anılır. Aslında üç ayrı eksenin birleşimidir.
Her eksen ayrı ayrı değiştirilebildiği için stil doğal olarak **karıştırılabilir (mixable)**.

| Eksen | Bizdeki karşılığı | Terim (aramak için) |
|---|---|---|
| **Tür** (ne anlatılıyor, nasıl) | Anlatıcı + kanıt: belge, patent, fotoğraf ekranda gösterilir | *documentary explainer*, *video essay* |
| **Görsel dil** (neye benziyor) | Renkli düz zemin, yırtık kâğıt, bantlı kesik fotoğraf, el çizimi işaretler | *paper collage*, *mixed-media collage*, *cut-out animation* |
| **Sahneleme / kamera** (nasıl çekilmiş gibi) | Masaya yatırılmış kâğıtlar, üstten ışık, hafif eğik 2.5D kamera | *tabletop*, *flat lay*, *2.5D parallax* |

- **Tabletop** bir kamera ve sahne düzenidir, stil değildir. Kâğıtlar masada durur, kamera yukarıdan bakar ve hafifçe eğilir (`camera.tilt/turn`).
  Işık bir masa lambası gibi tek yönden gelir. Bizde şu an "dijital tabletop" var. Gerçek masa yüzeyi (ahşap, kumaş) ve masa
  objeleri (kalem, ataş, büyüteç) henüz yok (bkz. §9).
- **Kâğıt kolaj** görsel dildir. Aynı kolaj tabletop olmadan düz ekranda da çalışır (`tilt: 0, turn: 0`).
- **Belgesel anlatım** türdür. Aynı içerik `archival-film` ya da `ken-burns-photo` ile de anlatılabilir. O yüzden sahne sahne değiştirilebilir.

## 2. Yapı taşları (katmanlar)

Sahne = **zemin** + **katmanlar** (sırayla çizilir, sonraki üstte) + **sahne geneli** (kamera, ışık, doku, stop-motion).

| Katman | Ne yapar | Ne zaman |
|---|---|---|
| `bg` | Düz renkli zemin. Varsayılan `theme.accent`. | Her sahnede **farklı renk** olsun. Zemin altyazının vurgu rengiyle aynı olmasın, yoksa vurgulu kelime kaybolur. |
| `piece` | Yırtık kenarlı kâğıt parçası (`seed` yırtığın şeklini belirler) | Kesiğin arkasına arkalık yapar, renk vurgusu verir. Bir sahnede 1-2 tane yeter. |
| `cutout` | Arka planı ayrılmış fotoğraf (sticker). `bw`, `tape`, `rot`, `drift` | Kişi ya da nesne tanıtımı. Kâğıt kenarlı PNG `tools/make_sticker.py` ile hazırlanır. |
| `doc` | Belge ya da patent görseli, odak ve zoom kamerası (`from` → `to`, `moveAt`). `highlight` fosforlu kalem, `dim` geri kalanı karartır. | Kanıt anı: "patentte şöyle yazıyor". |
| `annotate` | El çizimi daire, alt çizgi ya da ok (`drawMs` ile çizilerek belirir) | **Yalnızca kalabalık detayda** yer göstermek için. Yüze ya da tek nesneye daire çizilmez. |
| `title` | Büyük başlık kartı. `flipAt` ile bir satır 180° döner. | Kavram adı (ör. TRIZ #13). Kelime oyunu içeren başlıklar. |
| `tag` | Kâğıt şerit üstünde kalın etiket, isteğe bağlı simge (`lock`, `drop`) | Diyagram üstüne tek kelimelik açıklama ("FIXED", "MOVES"). |
| `dust` | Havada süzülen toz zerrecikleri | Sahneye ölü görünmesin diye ince bir hareket ekler. Neredeyse her sahnede `count: 22`. |

Bütün katmanlar `showAt` ve `hideAt` alır (350 ms solma). Zamanlar ms ya da kelime ile verilir: `"patent"`, ikinci geçiş için `"patent#2"`.

Girişler: `from: "left" | "right" | "top" | "bottom"` verilirse parça **ekran dışından dönerek gelir**, yayla hafifçe sekip oturur
(terimler: *overshoot*, *spring*). Parçalar birkaç yüz ms arayla gelir (*stagger*): `enterAt` 0, 120-150, 350-380 gibi.

## 3. Sahne geneli

### Kamera (`camera: { from, to }`)
Değerler: `x`, `y` (kayma), `zoom`, `rot` (derece), `tilt` (öne eğim°), `turn` (yana dönüş°). Kamera sahne boyunca yumuşak ilerler.
Katman derinliği (`depth`) **paralaks** üretir: `piece` 0.85 ile uzakta durur ve kesikten az kayar.
- **Tipik tabletop hareketi:** `tilt 7-9 → 2-3`, `turn -7 → +4`, `zoom 1.0 → 1.12`, `rot ±1.5`. Eğik başlar, düzelirken hafifçe yaklaşır.
- Her sahnede **yönü değiştir.** Turn işareti, rot yönü ve kayma hep aynı olursa "şablon" gibi durur.
- Odak dağıtacak iki hareket aynı anda yapılmaz. Hem yaklaşıp hem yukarı bakmak kötü durdu, bu yüzden biri seçilir.
- **Açılış itmesi** (`push`, 2026-11-01): her sahne 0.05 geriden başlayıp 0.7 sn'de hızlıca ileri iter, sonra yumuşar (*expo ease-out*).
  earn.edits referansında her sahne böyle açılıyor; "slayt gibi duran kare" hissini kırar.
- **Ağır ease** (`ease: "heavy"`, *heavy ease*): ağır kalkıp hızlanan, sonra uzun uzun yavaşlayan eğri (AE'deki "Easy Ease"in sert hâli).
  `moveAt` ile kamera yalnızca bir kelime anında hareket eder; uzun sahnelerde ikinci bir "vuruş" olarak kullanılır.
- **Motion blur** (`motionBlur`): hızlı kamera hareketinde gerçek kameradaki gibi iz bırakır (*shutter angle* 180°). Render'ı yavaşlatır.

### Işık (`light`)
`x`, `y` ışık kaynağının konumudur (karenin 0-1 aralığı, üstte). Diğer ayarlar: `color`, `strength`, `vignette`.
Gölgeler otomatik olarak ışığın tersine düşer.
- `to`: kaynak sahne boyunca kayar. Hareket eden masa lambası hissi verir.
- `sweepAt`, `sweepMs`, `sweepAngle`, `sweepDir`: ışık bandı kâğıdın üstünden geçer (*light sweep*). Önemli bir kelimede kullanılır.
- `pulseAt`: ışık kısa süre güçlenir (*light pulse*). Vurgu kelimesinde kullanılır.
- `breathe`, `breatheS`: yavaş nefes alan ışık (alev ya da lamba titreşimi). Genlik 0.02-0.05.
- **Renk sıcaklığı (*color temperature*) duyguyu taşır:** sıcak amber `#FFC978` / `#FFE2AE` (geçmiş, insan), soğuk mavi `#BFD9FF` (belge, akıl),
  mercan `#FF9E80` (heyecan, başarı). Her sahnede renk ve hareket türü farklı olsun.

### Dokular
- `paper` (varsayılan 0.22): kâğıt lifi ve 3 karede bir değişen ince tane. Her zaman açıktır.
- `halftone` (2026-10-26): baskı tramı, 45° çapraz nokta ızgarası, ekrana sabit. `true` ya da `{ opacity 0.35, size 8, dot 0.32, angle 45, blend "overlay" }`.
  Overlay modunda koyu ve orta tonlarda görünür, beyazda kaybolur. Farklı kaynaklardan gelen görselleri tek bir "basılı" dünyada birleştirir.
  Referans: earn.edits (Semmelweis) ve aymaned1ts (Kahire) videolarında aynı desen var. Açık zeminli sahnede etkisi zayıftır. Belirgin istenirse `opacity: 0.5`.

### Stop-motion hissi
`stepFps: 12` hareketi 12 fps'e basamaklandırır (*posterize time*, *animating on twos/threes*).
`boil: 1.2` her basamakta kâğıtları titretir (*boil*). `wobble: 0.4` yavaş sallanmadır.
- **Seçici:** ana kesik 0.3×, başlıklar 0.4× titrer. Parça oturduktan yaklaşık 1.2 sn sonra titreme %35'e iner. Kamera ve ışık akıcı kalır.
  Her şey titrerse ("herşey titriyor") göz yorulur. Kural: kâğıt titrer, kamera titremez.
- Durum: test edildi ve beğenildi (EP002_stopmotion_test.mp4), ama yayınlanan EP002'de yok. Yeni videolarda isteğe bağlı açılır.

### Geçiş
Eskiden yalnızca `blur` vardı: önceki sahne 8 karede bulanıklaşır, yeni sahne 10 karede netleşir. EP003 analizinde altı geçişin altısı da
blur çıktı ve "tekdüze" bulundu. 2026-11-01'den beri **nesne üzerinden geçişler** var (referans: earn.edits Joker/Batman):
- **portal**: kamera sahnedeki bir pencereye, tünel ağzına ya da fotoğrafa dalar; yeni sahne o deliğin içinden görünür.
- **pullback**: tersi. Yeni sahne, eski sahneyi duvardaki bir çerçevede taşıyarak başlar, kamera geri çekilir (*pull-out reveal*).
- **cardflip**: bir kart döner, arka yüzü yeni sahnenin penceresidir.
- **zoomblur**, **whip** (hızlı kaydırma), **leak** (ışık sızması), **rgb** (renk kanalı kayması), **halftoneWipe** (baskı noktalarıyla silme).
  Son ikisi gürültülü; videoda en çok bir kez.
Geçiş penceresinde hareket 12 fps oynar ve hız bulanıklığı alır; bu, "pahalı" AE geçişlerinin dokusudur. Geçiş sesi kendiliğinden gelir.
Asıl fark: efekt bitmiş kareye uygulanmaz, sahnenin içindeki bir nesneyi hedef alır. MP4 üzerinde denenen sürüm bu yüzden "CapCut geçişi" gibi durmuştu.

### Yeni katmanlar (2026-11-01)
- **route / pin**: harita üstünde kendini çizen kesik çizgili rota ve etiketli iğne. Göç, ticaret yolu, yayılma hikâyeleri için.
- **counter**: sayaç; `roll` ile slot makinesi gibi döner, rakamlar sırayla durur. Tarih ve büyük sayılar için.
- **stamp**: damga, büyük ölçekten çarpar, toz kalkar, kamera bir kez sarsılır. Karar anı için (ağırbaşlı konuda sarsıntısız).
- **typewriter**: başlık harf harf yazılır, imleç yanıp söner. **markAt**: başlık satırının arkasından fosfor kalem geçer.
- **film**: gren, vinyet, hafif titreme ve görüntü kayması (*gate weave*); eski film havası.

### Ses
Katman olaylarına ses kendiliğinden eklenir: kâğıt girerken sürtünme, etikette pop, fosforda kalem, daktiloda tuş, damgada vuruş, altta
çok kısık oda tonu. Hepsi gerçek kayıt (Pixabay). İstenmezse senaryoda `auto_sfx: false`.

### Kamera: eğriler, zoom, odak, ağır yakınlaşma
Bütün stillerde ortak; `docs/styles/camera.md`. Vox'ta sahne kamerası (`camera`) ve odak (`dof`) o kurallarla çalışır.

## 4. Yönetmen kuralları (kullanıcı geri bildirimlerinden)
1. **Her sahne aynı şablon olmasın.** Stil bütün videoda değil, seçili sahnelerde kullanılır. Arada `archival-film` ya da `ken-burns-photo` sahneleri olur.
   Bir videoda 3-4 vox sahnesi yeterli.
2. **İşaretleme yalnızca kalabalık detayda.** Yüze ya da makineye kırmızı-sarı daire çizmek "absürt" durdu.
3. **Parçalar ortada belirmez, ekran dışından gelir** (`from`).
4. **Ayrıntıdan başla, bağlamı sonra aç** (*pull-out reveal*). İntroda tabağa yakın başlayıp uzaklaşmak merak uyandırdı.
5. **Işık şarttır.** Işıksız kolaj düz ve dijital görünüyor. Her sahnede ışık rengi ve hareketi farklı olur.
6. **Ortam değişimi** (*environment switching*, *pattern interrupt*): referans videolarda 40 sn'de yaklaşık 12 farklı ortam var.
   Kısa videoda bile 3-4 sahnede bir zemin, doku ve ışık ailesi değişmeli.
7. Her videoya TRIZ bağlantısı gerekmez. Kavram kartı tarifi (§5 D) yalnızca gerektiğinde kullanılır.
8. Kesik saçlarda hale kalmamalı. Saç ve örgü için SAM 2 nokta istemi (üst kısım) ile isnet (alt kısım) birleştirilir (§7).

## 5. Sahne tarifleri (EP002'den, kopyalanıp uyarlanır)

Tam props: `content/episodes/EP002-cochrane-dishwasher/script.en.json` → `visual.props`.

**A. Portre tanıtımı** (s02: "Josephine ... was widowed and in debt")
Zemin teal `#2A8C82`. Krem büyük `piece` soldan, turuncu küçük `piece` sağdan, bantlı siyah-beyaz portre `cutout` alttan (`enterAt` 0 / 150 / 350).
Üstüne `dust`. Kamera `tilt 9 → 3`, `turn -7 → 4`, `zoom 1 → 1.13`. Işık sıcak amber, soldan sağa kayar ve kişinin
durumunu anlatan kelimede `sweepAt` ile ışık bandı geçer.

**B. Belge kanıtı** (s04: patent çizimi)
Tek `doc` katmanı: `from` genel bakış (zoom 1.5) → `moveAt: "patent"` ile ayrıntıya (zoom 2.3, 1000 ms). `highlight` ilgili satırı fosforlu kalemle boyar,
`dim` geri kalanı karartır. Işık soğuk mavi, sağdan gelir ve vurgu kelimesinde `pulseAt` ile güçlenir. Zemin görünmediği için `bg` gerekmez.

**C. Nesne / buluş** (s06: makine)
Zemin lacivert `#1F4E8C`. Krem `piece` sağdan, kırmızı küçük şerit soldan, bantlı makine `cutout` yukarıdan düşer.
Işık mercan rengi ve **ters yönde süpürür** (`sweepDir: -1`, `sweepAngle: 60`). Nefesi daha hızlıdır (`breatheS: 2.8`). Bu sahne A ile aynı iskelette ama farklı hissettirir.

**D. Kavram kartı → diyagram** (s07: TRIZ #13)
Zemin koyu lacivert. `title` kartı (3 satır, son satır `flipAt` ile ters döner) belirli bir kelimede `hideAt` ile çekilir.
Aynı anda `doc` (patent sayfası) `showAt` ile belirir. Üstüne `tag` ("FIXED" kilit simgeli, "MOVES" damla simgeli) ve sırayla çizilen mavi `annotate` okları gelir.
Işık kelime üstünde `pulseAt` yapar.

**Kapak** (`Cover` kompozisyonu): aynı props'lar tek kare olarak render edilir (`clips/cover_a.json`).

## 6. Hızlı kontrol listesi (bir vox sahnesi kurarken)
- [ ] Zemin rengi önceki vox sahnesinden ve altyazı vurgu renginden farklı mı?
- [ ] Ana öğe karenin %8-58 aralığında mı? (Altyazı bandı %60-78 arasında.)
- [ ] Bütün parçalar ekran dışından ve kademeli (`stagger`) mi geliyor?
- [ ] Kamera yönü, ışık rengi ve ışık olayı (`sweep`, `pulse` ya da `breathe`) önceki sahneden farklı mı?
- [ ] İşaretleme yalnızca kalabalık detayda mı?
- [ ] `dust` var mı, `transition: "blur"` verildi mi?
- [ ] Stop-motion istendiyse `stepFps 12`, `boil 1.2`, `wobble 0.4` (seçici titreme otomatik).
- [ ] Halftone istendiyse `halftone: true` (koyu ve orta tonlu sahnelerde etkili).
- [ ] Yeni görsel `assets.csv`'ye lisansıyla yazıldı mı?

## 7. Görsel hazırlama
- Fotoğraf yalnızca `channel.yaml assets.allowed_sources` listesindeki kaynaklardan alınır: Wikimedia, kamu malı patentler ve arşivler.
- Arka plan kaldırma: `rembg` isnet-general-use (genel kullanım). Saç ya da ince detay varsa SAM 2 (`tools/.venv-matte`, nokta istemi) ile isnet birleştirilir.
  Video için `tools/matte_video.py` kullanılır.
- Kâğıt kenarlı sticker: `tools/make_sticker.py giriş.png çıkış.png`. Çıkış `cutout.image` olur, `size` gerçek piksel boyutudur.
- Belge: yüksek çözünürlüklü tarama kullanılır. `highlight` koordinatları **görsel pikselidir**.

## 8. Karıştırma (mix)
Tam liste: `catalog/styles.yaml → mix_with`. Pratikte iki yol var:
- **Sahneler arası** (en kolay): vox → `archival-film` → vox → `ken-burns-photo`. EP002'nin yapısı böyle. Görsel bütünlüğü
  ortak doku (`paper` ve `halftone`), sıcak renk ve blur geçişi sağlar.
- **Sahne içi**: vox katmanlarının içine başka stilin öğesi konur. Örnekler:
  - `doc` olarak patent çizimi kullanılır, okları `annotate` çizer (blueprint havası).
  - `halftone` ile `halftone-dossier` ya da `risograph` baskı hissi verilir.
  - `title` ile kinetik tipografi yapılır.
  - `layered-collage` ile çok katmanlı paralaks ve ön plan silmesi eklenir (`CutoutClip`).

Uyumlu stiller ve neden uyumlu oldukları:

| Stil | Neden uyumlu |
|---|---|
| `archival-film`, `ken-burns-photo` | Aynı belgesel türü, farklı görsel dil. Nefes aldırır. |
| `layered-collage` | Aynı kolaj dili, daha derin 2.5D. Açılış ve dönem anlatımı için. |
| `blueprint-diagram`, `engineering-board` | Mekanizma anlatımında `doc` + `annotate` + `tag`'ın devamı. |
| `halftone-dossier`, `risograph`, `visual-investigation`, `archive-light-table` | Aynı "basılı kâğıt, dosya, kanıt" dünyası. |
| `data-viz` | Sayı anı: kâğıt üstüne çizilen grafik. |
| `kinetic-type` | Hook ya da kavram cümlesi. |

Uyumsuz olanlar (aynı videoda dikkatli kullanılmalı): `glass-ui`, `hologram-hud`, `pixel-art`, `neo-brutalism`. Bunlar dijital ve parlak; kâğıt dünyasını bozar.

## 8.5 EP004'te (Fresnel) öğrendiklerimiz

**Geçişler: "zoom'dan zoom'a" değil, nesneden nesneye**
- **Pencere portalı** (*portal / window reveal*): Yeni sahne arkada tam ekran durur; eski sahnede hedef nesnenin yerinde bir delik açılır,
  kamera delikten geçer. İlk denemede yeni sahne deliğin içinde küçük bir resim olarak duruyordu ve ortada "pop" ediyordu. AE'deki doğru
  yöntem delik + arka plan. Delik bir anda değil, yumuşakça açılır; kenarına içe düşen hafif gölge pencerenin kalınlığını hissettirir.
- **Kaydırma** (*push / slide*): İki sahne yan yana birlikte kayar. *Heavy ease* ile ağır kalkar, ortada hızlanıp hafif bulanıklaşır,
  uzun uzun yavaşlayıp durur. Referanstaki dikey push bunun yukarı yönlü hâli. Zoom geçişleri arasına çeşitlilik katar.
- **Sis silmesi** (*foreground wipe*): Kameranın önünden sis geçer, kesmeyi saklar. Üç sis katmanı farklı hızda kayar (yakın hızlı, uzak
  yavaş), bu da kendi içinde bir derinlik verir. Fener ve deniz konusuna birebir oturdu.
- **Kart çevirme (AE kalitesi):** Kart önce masadan kalkar, döner, hafif taşıp oturur. Kâğıt kalınlığı, dönerken kararan/aydınlanan yüzler,
  yüzeyden geçen parlama ve masada kalan (kartla birlikte dönmeyen) gölge "CapCut efekti" hissini kırar. Gerçek fotoğraflanmış kartla
  deneme sonraya kaldı.
- **Geri çekilip çerçevede kalmak** (*pullback into frame*): Eski sahne bir çerçevenin deliği şeklinde kırpılarak küçülür ve çerçevenin
  içinde kalır. İlk denemede görüntü bir an dikdörtgen olarak kalıp kayboluyordu; çözüm, çerçevenin içine aynı görseli kalıcı **dolgu**
  (*fill*) olarak koymak. Hareketli görüntü yumuşakça bu dolguya karışır (*crossfade / handoff*).

**Derinlik: düz resmi 2.5D yapmak** (ayrı ve daha ayrıntılı anlatım: `docs/styles/depth-elements.md`)
- **Fotoğrafı katmanlara ayırma** (*2.5D parallax, Joe Fellows yöntemi*): Ana nesne kesilir, arkada kalan delik doldurulur (*inpainting*),
  kamera yaklaşırken öndeki katman arkadan daha hızlı büyür. Fener kulesi ve mercekte "gerçekten derinlik var" dedirten buydu.
  Sınırı: cam gibi içinden bakılan sahnelerde ayrılacak ön plan yok (s13).
- **Alan derinliği** (*depth of field*): Kameraya uzak katmanlar mesafeleri oranında bulanıklaşır, odaktaki nesne net kalır.
- **Işık sarması** (*light wrap*): Zeminin ışığı kesik görselin kenarından içeri hafifçe sızar; kesik "yapıştırılmış" gibi durmaz.
- **El kamerası** (*handheld*): Çok küçük, yavaş bir sallantı. 15 fps ile birlikte el yapımı his verir.
- **Üst üste biniş** (*overlap*): Kapakta büyütecin sapı merceğin önünden geçiyor. Bir nesnenin diğerinin önüne geçmesi derinliğin
  en güçlü ipucu.

**Doku ve ritim**
- **15 fps** (*animating on twos*): Kamera dahil bütün görüntü 15 fps basamaklı oynar (earn.edits referansı). Altyazı ve ses akıcı kalır.
- **Bitiş katmanı** (*finishing pass*): Üç ince katman: kenar bulanıklığı ve hafif renk saçağı (*fringe blur / lens softness*), film tozu
  (*film dust*: zerre, arada kıl ve çizik) ve vinyet (*vignetting*). Altyazının altında kalır.
- **Element kütüphanesi:** İçinden geçilebilen nesneler (büyüteç, çerçeveler, mercek halkaları) delik bilgileriyle saklanır; sonraki
  bölümlerde hazır kullanılır.

**Ses**
- **"Tok" geçiş sesi** = kısa hava (*whoosh*) + kesmede vuruş (*impact / thud*) + altında derin bas (*sub drop*). Üç katman, doruk
  noktaları kesmeye denk gelecek şekilde yerleştirilir.
- **Müzik bir yatak:** Konuşurken anlatımın 24 dB altında. Bölüme özel kurgu: dramatik bölüm çıkarılır, son nota anlatımın bitişine
  denk gelir (Gnossienne EP003/EP004).

**Render:** GPU açılınca 23 dk → 6 dk. Editörler (CapCut, Premiere) her şeyi GPU'da yapar; Remotion'da da GPU'yu açmak gerekiyor.

## 8.6 EP006'te (Harrison H4) eklenenler
- **Harita (E2):** turkuaz deniz (`map_bake.py --sea`), bulut dalışı gerçek bulut fotoğraflarıyla (`clouds`, üç düzlem: uzak yavaş, ön bulut
  kareyi kaplayıp açılır), boylam/enlem ağı (`graticule`: çizilerek giriş, titreme = "konum belirsiz", `turn` = Dünya'nın dönüşü), taranmış
  kama (`wedge`: saat farkı = boylam farkı), gemi işareti (`ship`: düşer, batar, salınır, rotada iz bırakır; `image` ile vektör gemi yerine sağa bakan bir kesik yürür, ör. IYH001 dhow ve kervan), HUD (`ruler` + sayaç),
  `dim` (arka plan kararır, öne "5 s" kutusu).
- **Kamera:** doc `keys` + `anchor` ile rota takibi (Portsmouth → Madeira → Jamaika, varışta ağır yakınlaşma); `camera.rock` (güverte yalpası).
- **Nesneler:** kâğıt saat kadranı (`clock`), salınım (`osc`: denge çarkı sabit ritim, sarkaç düzensiz).
- **Geçiş:** `objectWipe` — kırmızı deri kapak kareyi soldan kaplar, Maskelyne arkasından açılır.
  Kullanıcı beğendi (2026-11-03): nesne gelen sahnenin kendi içeriği olduğu için geçiş anlatıya hizmet ediyor. Her vox bölümünde
  bir nesneli çıkış planla; görsel güçlü renkli, kenarsız kırpılmış, sahnenin konusu olan bir nesne olsun (kitap, harita rulosu, mektup).
- **Foto derinliği:** çerçeve + duvar ön katmanı (`plane_bake.py frame`), masada belge (`plane_bake.py page`), gravüre sis + şimşek.
- Element: `h4-dial` (kadran deliğine bimetal dolgu, sonra kadran geri gelir), `clouds-*`.

## 9. Henüz olmayanlar (yapılacaklar)
- **Uzun tuval** (*infinite canvas*, *one-take*; 2026-11-02 kullanıcı onayladı). Ardışık 2-5 sahne kesilmeden tek büyük
  kolaj panosunda durur, sanal kamera aralarında kayar, döner, yaklaşır. Sahne sınırı kesme değil, kamera hedefi olur.
  Kural kaynağı `.studio/plugin/library/lemo/styles/printed-long-take/STYLE.md` (her karede en az 3 katman, kesme nadir ve tasarlanmış).
  Önce referans videolarla ölçülecek (`style-study` skill'i).
- **Arka plan kütüphanesi** (`content/textures/`, 2026-11-03 kullanıcı: arka planlar çok önemli): masa yüzeyleri (ahşap, keçe, deri, kesme matı),
  eski haritalar, defter sayfaları, blueprint; PD/CC0 (Commons, ambientCG, Polyhaven). Şu an 7 doku var; düz `bg` rengi yerine sahnelerin çoğu gerçek yüzeyde dursun.
- Gerçek **tabletop** yüzeyi (ahşap, kumaş, kesme matı) ve masa objeleri (kalem, ataş, büyüteç). Gerçek bir masa çekimi hissi verir.
- Gerçek fotoğraflanmış kartla kart çevirme; tek fotoğraftan derinlik haritasıyla 3B (Depth Anything).
- Halftone'un yalnızca fotoğraf katmanlarına uygulanması; nokta boyutunun parlaklığa göre değiştiği gerçek tram.
- Düşen fotoğraf, yırtılarak açılan kâğıt (*paper tear reveal*).
- **Kabartma harita + bulut dalışı** (2026-11-02, kullanıcının verdiği kısa vox referansı; ölçüm `content/_refs/vox-otsan-map/`).
  Haritayı düz kâğıt değil gölgeli kabartma (*shaded relief*) olarak göstermek, bulutların arasından inen kamerayla açmak, yer adlarını sarı
  kutuda yazmak, kesik rota + ölçek çubuğu (*HUD ruler*), izi olan gemiler ve gemi gövdesinin kadrajı kaplamasıyla geçiş (*object wipe*).
  Tarif: ajan talimatı §2 E2. Eksik bileşenler: `ruler`, `wake`, `objectWipe`, `dim`. EP006 harita sahnelerinde denenecek.

## 10. Terimler sözlüğü
- **paper / mixed-media collage**: kâğıt ve karışık malzeme kolajı.
- **cut-out**: arka planı ayrılmış görsel.
- **tabletop / flat lay**: masaya yatırılmış, üstten çekim.
- **2.5D parallax**: katmanlar farklı hızda kayar, derinlik hissi verir.
- **overshoot / spring**: hedefi biraz geçip geri oturma.
- **stagger**: kademeli giriş.
- **document callout / highlighter / spotlight dim**: belge vurgusu, fosforlu kalem, gerisini karartma.
- **key light / falloff**: ana ışık ve ışığın azalarak sönmesi.
- **light sweep / pulse**: geçen ışık bandı / kısa güçlenme.
- **color temperature**: sıcak ya da soğuk ışık.
- **vignette**: köşe kararması.
- **posterize time / on twos**: basamaklı hareket.
- **boil**: her karede hafif titreme.
- **wobble**: yavaş sallanma.
- **halftone / dot screen**: baskı tramı.
- **grain**: tane.
- **blur transition**: bulanıklaşarak geçiş.
- **match cut**: benzer şekille kesme.
- **pull-out reveal**: yakından başlayıp uzaklaşarak bağlamı açma.
- **environment switching / pattern interrupt**: ortam değiştirerek dikkati tazeleme.
- **portal / window reveal**: nesnedeki delikten yeni sahneye geçiş.
- **push / slide**: iki sahnenin yan yana birlikte kayması.
- **foreground wipe**: kameranın önünden geçen bir şeyle (sis, perde) kesmeyi saklama.
- **pullback into frame / handoff**: geri çekilip çerçevede kalma, hareketli görüntünün kalıcı görüntüye devri.
- **inpainting**: kesilen nesnenin arkasını doldurma.
- **depth of field / rack focus**: alan derinliği / odak kaydırma.
- **light wrap**: arka plan ışığının kesik kenarına sızması.
- **handheld**: el kamerası sallantısı.
- **animating on twos (15 fps)**: her pozun iki kare sürmesi.
- **fringe blur / chromatic aberration**: mercek kenar yumuşaması / renk saçağı.
- **film dust, vignetting**: film tozu, köşe kararması.
- **impact, sub drop, riser**: vuruş, derin bas düşüşü, yükselen gerilim sesi.


## Derinlikli nesne silmesi (EP015, 2026-11-12)
Kullanıcı notu: "nesneli geçişlerden birini kuşun kanadıyla yapabilirsin, biraz ağır da geçebilir". `objectWipe` artık nesneyi yalnızca kaydırmıyor: `spin` ile süzülürken döner, `depthScale` ile kameraya yakından geçip uzaklaşır, `keepAspect` ile saydam kesik basıklaşmaz. Akbaba kesiği yukarıdan aşağı, 16° dönerek, 2.4 sn'de geçer; aynı videodaki kutu silmesi yandan düz kaldığı için ikisi birbirine benzemez. Karanlığa iniş için koyu sis yerine `dim` katmanı + düz kesme.
