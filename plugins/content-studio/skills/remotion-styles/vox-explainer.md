# vox-explainer — uygulama talimatı (ajan için)

Bir sahneye `vox-explainer` atandığında bu dosyayı uygula. Burada açıklama yok; terimlerin öğretici anlatımı kullanıcı için ayrı
dosyadadır: `docs/styles/vox-explainer.md`. Stile özellik eklendiğinde bu dosya ve o dosya aynı turda güncellenir.
Kod ve tam props listesi: `studio/src/styles/vox-explainer/index.tsx` (dosya başı); geçişler `studio/src/components/Transitions.tsx`,
easing haritası `studio/src/components/ease.ts`, otomatik sesler `tools/build_timeline.py` (`ADV_SFX`, `AUTO_SFX`).

## 0. Sert kurallar (ihlal = yeniden yap)
1. Bir videoda en çok 3-4 vox sahnesi olur. Ardışık iki vox sahnesi arasına en az bir `archival-film` ya da `ken-burns-photo` sahnesi koy.
   İstisna: kullanıcı aksini söylerse.
2. `bg` hiçbir zaman altyazı vurgu rengi olamaz (`channel.yaml theme.colors.accent`, şu an `#F2A93B`). İki vox sahnesi aynı `bg`'yi kullanamaz.
3. `piece`, `cutout`, `tag` ve `title` katmanlarının hepsi `from` ile ekran dışından girer. Ortada `pop` ile belirmez.
4. `annotate` yalnızca kalabalık detayda yer göstermek için kullanılır (belge satırı, diyagram parçası). Yüze, kişiye ya da tek nesneye daire çizme.
5. Her vox sahnesinde `light` olur: varsayılan genel, yumuşak, hareketsiz ışık (renk + konum, gerekirse hafif `breathe`). **`sweepAt` (geçen ışık bandı) kullanılmaz:** EP002-EP007'de hep aynı kalıp oldu (kullanıcı 2026-11-05), yalnızca kullanıcı isterse. Işık rengi, konumu ve kamera `turn` işareti önceki vox sahnesinden farklı olur (§3).
6. Ana öğeler karenin y = 0.08-0.58 aralığında durur. 0.60-0.78 altyazı bandıdır.
7. Kamerada aynı anda iki büyük hareket olmaz. Zoom ve dikey kayma birlikte büyük olmaz: `|to.y - from.y| ≤ 0.06` iken `zoom` farkı ≤ 0.15 (istisna: ağır yakınlaşma, `camera.md §3`).
8. Stop-motion açıksa yalnızca `stepFps: 12, boil: 1.2, wobble: 0.4` değerlerini kullan. Daha yüksek değerler "her şey titriyor" geri bildirimi aldı.
9. Kullanıcı istemedikçe kavram kartı (tarif D) ekleme.
10. Efekti bitmiş kareye uygulama. Tüm kareyi döndürmek, eğmek ya da kart gibi uçurmak "CapCut geçişi" geri bildirimi aldı (EP003).
    Kamera katmanların arasında hareket eder; geçiş sahnenin içindeki bir nesneden geçer (§6).
11. Hareket eden hiçbir şey lineer olmaz. Geçişler ve `moveAt` pencereli kamera: `heavy`. Girişler yayla oturur (≈ %10 taşma).
    Lineer yalnızca kesik çizgi kayması, gren, toz.
12. Durağan kare yok: her vox sahnesinde `camera.push` olur (§7). Uzun (> 8 sn) sahnede ayrıca `moveAt` ile ikinci bir kamera vuruşu kur.
13. Bir videoda en çok 1 gürültülü geçiş (`rgb`, `halftoneWipe`, `whip`, `stamp` sarsıntısı) olur. Ağırbaşlı konularda hiç olmaz (§6 ton tablosu).
14. Ses efektleri sentetik üretilmez; gerçek kayıt kullanılır (§8).
15. Efektler içeriğe hizmet eder: hedef kamera, derinlik, geçiş ve ses kalitesini AE seviyesine çıkarmak. Senaryo gerektirmedikçe ek yazı
    kartı, damga, sayaç, daktilo başlığı EKLEME (EP004 test klibi geri bildirimi: "SAME SHAPE kısmına gerek yok").
16. Her sahnede arka/orta/ön düzlem (`depth-elements.md`); geçişlerde çeşitlilik: en çok 3 zoom (portal/zoomblur), en az 1-2 slide, uygun konuda fog.
17. Özgünlük = farklı gerçek nesneler (kullanıcı 2026-11-03: "AI slop gibi görünmesin"). İki kaynak:
    a) konuya özgü yeni nesne (dönem belgesi, kitap kapağı, alet; PD/CC0 fotoğraftan kesik),
    b) genel element kütüphanesi `content/assets/elements/` (çerçeve, büyüteç, bulut, zarf, anahtar deliği…): konuyla ilgili olması yeter,
       bölümler arası tekrar kullanılabilir; ama ardışık iki bölümde aynı element aynı rolde olmaz. Kütüphaneyi her bölümde 1-2 elementle büyüt.
    Hem sahne içi (derinlik katmanı) hem geçiş nesnesi (`objectWipe`, portal hedefi) olarak kullan.

## 1. Adımlar
1. **Vuruş → tarif:** Sahnenin anlatım cümlesine bak, §2'den bir tarif seç:
   - Kişi tanıtımı → A
   - Belge, patent ya da yazı kanıtı → B
   - Nesne ya da buluş → C
   - Kavram adı + mekanizma → D
   - Yer, yol, yayılma → E
   - Tarih, sayı, karar anı → F
2. **Görsel hazırla:**
   - Kesik: `rembg` isnet-general-use. Saç ya da ince kenar varsa SAM 2 (`tools/.venv-matte`, nokta istemi üst) ile isnet (alt) birleştir.
   - Sticker: `tools/make_sticker.py <girdi.png> <çıktı.png>` (kâğıt kenarı).
   - `size` = çıktının gerçek piksel boyutu.
   - Her görseli kaynağı ve lisansıyla `assets.csv`'ye yaz. Kaynak yalnızca `channel.yaml assets.allowed_sources`.
3. **Props kur:** Tarifin JSON'unu kopyala. Görsel yollarını, `enterAt` / `moveAt` kelimelerini (sahnenin kendi kelimeleri, tekrar
   ediyorsa `"kelime#2"`) ve `highlight` piksel kutusunu değiştir.
4. **Çeşitlendir:** §3 tablosundan önceki vox sahnelerinde kullanılmamış bir satır seç ve uygula.
5. **Sahne ayarları:**
   - `dust` katmanı `{ "type": "dust", "count": 22 }` her zaman eklenir.
   - `"camera": { …, "push": { "zoom": 0.05, "ms": 700 } }` her zaman.
   - `"motionBlur": { "samples": 6, "shutter": 0.5 }` her vox sahnesinde (render süresini ~samples kat uzatır; acele render'da 4).
   - Karanlık ya da orta tonlu sahnede ve kullanıcı baskı dokusu istediyse `"halftone": true` ekle. Retro/arşiv havası için `"film": true`.
6. **Geçiş seç (§6):** `scenes[].visual.transition` gelen sahnede yazılır. Giden sahnede hedef nesne varsa `portal` / `cardflip`, gelen sahnede
   çerçeve varsa `pullback`; yoksa `zoomblur` ya da `blur`. Hedef kutusunu §6.1'e göre ölç.
7. **Doğrula ve kontrol et:**
   ```
   voice/.venv-chatterbox/bin/python tools/validate.py script <bölüm>/script.<dil>.json
   voice/.venv-chatterbox/bin/python tools/build_timeline.py <bölüm>
   cd studio && npx remotion still src/index.ts ShortsVideo /tmp/x.png --frame=<sahne başı + 45> --timeout=180000  # --scale kullanma: bitiş katmanının backdrop blur'u küçük ölçekte kenarda ayna kopya üretir --props='{"timeline":"episodes/<EP>/timeline.json"}'
   ```
   Tek karede kontrol edilecekler: altyazı ana öğeyi örtmüyor, vurgulu kelime zeminde okunuyor, kesik kenarında hale yok.
   Geçiş varsa ek olarak 3 kare al: kesme − 8, kesme, kesme + 6. Kontrol: hedef nesne kesmeden önce net, kesme karesinde gelen sahne
   maskenin içinde görünüyor, siyah ya da boş kenar yok. Tam QA'yı kullanıcı yapar; uzun QA çalıştırma.

## 2. Tarifler (A-D EP002'de onaylı; değerleri koru, yalnızca §1.3 ve §3 alanlarını değiştir)

**A. Kişi tanıtımı** (EP002 s02)
```json
{"bg":"#2A8C82","layers":[
 {"type":"piece","x":0.47,"y":0.33,"w":0.66,"h":0.44,"rot":-5,"color":"#F4EFE4","seed":3,"enterAt":0,"from":"left"},
 {"type":"piece","x":0.66,"y":0.47,"w":0.3,"h":0.12,"rot":7,"color":"#F2A93B","seed":7,"enterAt":350,"from":"right"},
 {"type":"cutout","image":"episodes/<EP>/assets/cutout/<kişi>_sticker.png","size":[456,689],"x":0.5,"y":0.32,"height":0.47,"rot":-2,"tape":true,"enterAt":150,"from":"bottom","seed":4},
 {"type":"dust","count":22}],
 "camera":{"from":{"x":0,"y":0.03,"zoom":1.0,"rot":-1.5,"tilt":9,"turn":-7},"to":{"x":0.02,"y":-0.03,"zoom":1.13,"rot":1,"tilt":3,"turn":4},"push":{"zoom":0.05,"ms":700}},
 "motionBlur":{"samples":6,"shutter":0.5},
 "light":{"x":0.15,"y":-0.05,"to":{"x":0.45,"y":-0.08},"color":"#FFC978","strength":0.65,"sweepDir":1}}
```

**B. Belge kanıtı** (EP002 s04). `bg` gerekmez; belge kareyi doldurur.
```json
{"layers":[{"type":"doc","image":"episodes/<EP>/assets/<belge>.jpg","size":[1920,2855],
  "from":{"x":0.62,"y":0.45,"zoom":1.5},"to":{"x":0.79,"y":0.01,"zoom":2.3},"moveAt":"<belgeyi adlandıran kelime>","moveMs":1000,
  "highlight":{"x":1027,"y":393,"w":578,"h":54},"highlightAt":"<vurgulanan ifadedeki kelime>","dim":true}],
 "camera":{"from":{"x":0,"y":0,"zoom":1,"rot":0,"tilt":6,"turn":-4},"to":{"x":0,"y":0,"zoom":1,"rot":0,"tilt":2,"turn":3},"push":{"zoom":0.05,"ms":700}},
 "light":{"x":0.85,"y":0.0,"to":{"x":0.55,"y":0.06},"color":"#BFD9FF","strength":0.55,"vignette":0.6,"pulseAt":"<highlightAt ile aynı>","breathe":0.02,"breatheS":6}}
```
- `from` / `to` odak noktaları: belgenin 0-1 koordinatı. Belge hareketi varsayılan `heavy` (`ease` ile değişir).
- `highlight`: belge görselinin piksel kutusu. Görseli açıp satırın kutusunu ölç. Fosfor soldan sağa süpürülür (`sweepMs` 600, expoOut, eğik kenar).

**C. Nesne ya da buluş** (EP002 s06): A'nın iskeleti. Farkları: `bg` `#1F4E8C`, büyük piece `from: "right"`, rot 4, renkli şerit `#E25B45` soldan,
kesik `from: "top"`, kamera `turn 6 → -3`, ışık `{"x":0.8,"y":-0.05,"to":{"x":0.6,"y":0.1},"color":"#FF9E80","strength":0.7,"sweepDir":-1,"breathe":0.05,"breatheS":2.8}`.

**D. Kavram kartı → diyagram** (EP002 s07). Tam JSON için EP002 `script.en.json` s07 `visual.props`'u kopyala. İskelet:
- `title` (`lines`, son satır `flipAt`, `from: "bottom"`, `hideAt: "<geçiş kelimesi>"`)
- `doc` (`showAt` aynı kelime, zoom 1.45 → 1.6)
- `tag` × 2 (`icon: "lock"` ya da `"drop"`, farklı `from`)
- Akış oklarını `annotate arrow` ile çiz, 150 ms arayla.
- Işıkta `pulseAt` kullan, çevirme kelimesiyle aynı olsun.

**E. Yer, yol, yayılma** (henüz videoda denenmedi; ilk kullanımda kullanıcıya göster)
Harita `doc` katmanı + `route` + `pin`. Kamera ilk noktaya yakın başlar (zoom 1.35-1.45), rota çizilirken geniş plana çekilir (zoom 0.55-0.66).
```json
{"layers":[
 {"type":"doc","image":"episodes/<EP>/assets/<harita>.png","size":[2000,2800],"from":{"x":0.58,"y":0.82,"zoom":1.4},"to":{"x":0.45,"y":0.55,"zoom":0.6},"moveAt":"<rotanın başladığı kelime>","moveMs":2400},
 {"type":"route","points":[[0.58,0.82],[0.52,0.65],[0.44,0.48]],"at":"<kelime>","ms":1800,"bend":0.18,"dash":[14,9],"march":40,"color":"#B8322A"},
 {"type":"pin","x":0.58,"y":0.82,"label":"YEMEN","sub":"1400s","at":"<kelime>","dir":"r"},
 {"type":"pin","x":0.44,"y":0.48,"label":"ISTANBUL","sub":"1554","at":"<kelime>","dir":"r","big":true},
 {"type":"counter","from":1450,"to":1554,"at":"<kelime>","ms":1100,"x":0.08,"y":0.06,"size":46,"box":true},
 {"type":"dust","count":22}],
 "camera":{"push":{"zoom":0.05,"ms":700}},
 "light":{"...":"§3'ten"}}
```
- `route` / `pin` noktaları: kendinden önceki `doc` görselinin 0-1 koordinatı (doc yoksa kare 0-1). Doc kamerasıyla birlikte hareket eder.
- `pin.dir`: `r` / `l` / `u` / `d`, kartın taşmayacağı yön. Etiket metni ekrana basılır: dil nötr değildir, kısa ad ya da yıl kullan.

**E2. Kabartma harita + bulut dalışı** (referans: `content/_refs/vox-otsan-map/analysis.md`, 2026-11-02; ilk kullanım EP006)
E'nin üstüne. Harita **düz kâğıt değil, gölgeli kabartma**: turkuaz deniz, yeşil/bej kara, kenarda koyu vinyet. Tarihî konuda anakronik uydu
dokusu yerine kabartma + üstüne kamu malı dönem deniz haritası `blend: multiply` (opaklık 0.35-0.5).
1. **Açılış dalışı** (ilk harita sahnesi, 2-3 sn): `doc` zoom 1 → 2.2 `heavy` ease-out; önde 2-3 bulut `piece`'i farklı `dof` derinliğinde,
   kamera ilerledikçe kenarlara açılır (ön bulut en hızlı). Fırtına/gece konusunda bulutlar koyu, doygunluk düşük. Tek plan gibi aksın: kesme yok.
2. **Ad kutuları**: `tag` sarı zemin (kanal vurgusu `#F2A93B`), siyah kalın yazı, `rot` ±2, `from: "left"` silmeyle; 2-3 ülke/yer adı 0.3 sn arayla.
   Tuzak (EP006 s11): sahnenin son ~1 sn'sinde giren `tag`/stat kutusu `from: "bottom"` ile hâlâ yolda kalır, yazılan `y`'ye varmadan
   sahne biter ve alttaki etiketin üstüne düşer → geç girenlerde `from: "wipe"` (yerinde açılır); yerini kesmeden 5 kare önceki still ile kontrol et.
3. **Rota + HUD**: kesik `route` (`dash [14,9]`, beyaz ya da sarı), altta ölçek çubuğu + `counter` (mesafe/gün) `box: true`.
4. **Ölçek değişimi**: daha yakın plana geçerken aynı haritanın yüksek çözünürlüklü kırpımına zoom-in kesimi (harita "değişmiyor", yakınlaşıyor).
5. **Hareketli nesne**: kesilmiş gemi gravürü `piece` sabit hızla kayar, arkasında beyaz iz; pin'ler sarı nokta + lider çizgi.
6. **Çıkış**: nesne silmesi (gemi gövdesi/yelken kadrajı kaplar, sonraki sahne arkasından açılır) ya da pullback.
- Kaynaklar (kamu malı): Natural Earth kabartma raster (NE1/NE2 `HR_LC_SR_W`, 1:10m) geniş plan; yakın plan NASA SRTM / Blue Marble;
  dönem haritaları Commons (18. yy). `assets.csv`'ye yaz.
- Pişirme (doc'ta blend yok): `voice/.venv-chatterbox/bin/python tools/map_bake.py <NE kırpımı> <eski harita> <çıktı> --box <rumb bölgesi 0-1> --opacity 0.35-0.42`.
  Deniz varsayılan turkuaz `--sea #2E8C8F` (okyanus maskesi B−R > 45, kıyıda açık sığlık `--shelf`; `--sea none` = NE mavisi). Kara değişmez.
  **Kırpım oranı:** zoom 1'de doc yüksekliği = kare yüksekliği; yatay kırpımda (ör. 2700x1500) zoom < 1 üst/alt boş bant verir ve kenara
  yakın yerler (Jamaika) altyazı bandına düşer. Rotalı haritayı dikeye yakın kırp (EP006 s11: boylam -88..8, enlem -14..66 = 2880x2400).
  NE 1:50m `NE1_50M_SR_W` (88 MB, 30 px/derece; x = (boylam+180)×30, y = (90−enlem)×30). 1:10m 323 MB: indirmeden önce sor.
  1:50m yakın planda yumuşak: ~5° altına inme, oradan dönem haritasına ölçek değişimi kesimi yap (EP006 s02: Scilly 1680).
  Gravürden gemi kesiği ve müze vitrini fotoğrafından (H1-H3) rembg kesiği başarısız (EP006): gemi işaretini kodla çiz, vitrin fotoğrafını `print` kullan.
- E2 katmanları (EP006'te yazıldı, `studio/src/styles/vox-explainer/map.tsx`; alanlar §4):
  - Bulut dalışı: `clouds` (gerçek bulut PNG'leri `content/assets/elements/clouds-*`, `tools/cloud_key.py`; 3 düzlem: uzak 0.8, orta 1.0, ön 1.25-1.3
    kareyi kaplayıp açılır; `tone` ile gece/fırtına koyulaştırma, `shadow` harita üstü bulut gölgesi). Doc dalışı `ease: "cubic"`, bulut `heavyOut`
    (ikisi de heavyOut olunca dalış bulut perdesinin arkasında biter; ikisi de cubic olunca ilk 1.3 sn yalnızca bulut görünür. EP006 s02 testi).
    Gelen `fog` geçişinin `post`'unu 600'e indir, yoksa açılış sisin altında kalır.
  - Ad kutusu doc'a bağlı olmalıysa (kamera kayıyorsa) `pin` + `tag: true` (sarı kutu, ±2°, soldan silme, nokta + lider çizgi); sabit kamera
    sahnesinde `tag` + `from: "wipe"`.
  - Rota takibi: doc `keys` (duraklar) + `anchor` (odak noktasının ekrandaki yeri). `ship.path` = `route.points`, `route.bend: 0`, ikisi aynı
    `at`/`ms` (ikisi de cubic) → gemi çizginin ucunda. Varışta son key `heavyOut` punch-in.
  - HUD: `ruler` (doc ölçeğinde boy, zoom'la değişir) + `counter box`. Stat anı: `dim` (karart + blur) + büyük `tag` (`from: "bottom"`).
    `dim` yalnızca tuvali karartır; DOM katmanları (tag, counter) etkilenmez → onlara `hideAt` ver.
  - Çıkış nesne silmesi: geçiş `objectWipe` (§6), nesne görseli kenarsız kırpılmış olmalı (EP006: kitap kapağının beyaz fonu şerit gibi göründü → deri kırpıldı).

**F. Tarih, sayı, karar anı** (henüz videoda denenmedi)
Koyu `bg` (`#24324A` ya da `#2A2019`), solda dev `counter` (`roll: true`, rakamlar soldan sağa 0.15 sn arayla durur), sağda iki isim piece'i
`from: "right"` 0.35 sn arayla, altta cümle şeridi ve fosfor. Karar anı varsa `stamp` (2.6 ölçekten 0.2 sn'de çarpar, toz patlaması;
`shake` px ile tek seferlik 0.5 sn sarsıntı).
```json
{"type":"counter","from":0,"to":1554,"roll":true,"at":"<kelime>","ms":1000,"x":0.08,"y":0.3,"size":200}
{"type":"stamp","text":"LİSTEYE ALINDI","x":0.72,"y":0.5,"rot":-9,"at":"<karar kelimesi>","color":"#C8392B","shake":16}
```
`shake > 0` gürültülü sayılır (§0.13); ağırbaşlı konuda `shake: 0`.

## 3. Çeşitlilik tablosu (her vox sahnesinde önceki sahnelerde kullanılmamış bir satır)

| # | bg | ışık rengi | ışık olayı | kamera turn | büyük piece girişi |
|---|---|---|---|---|---|
| 1 | `#2A8C82` teal | `#FFC978` amber | sweep, dir 1, 115° | -7 → 4 | left |
| 2 | `#1F4E8C` lacivert | `#FF9E80` mercan | sweep, dir -1, 60° + breathe 0.05 | 6 → -3 | right |
| 3 | `#24324A` koyu lacivert | `#FFE2AE` sıcak beyaz | pulse + breathe 0.025 | -5 → 4 | bottom |
| 4 | `#8C3B2A` kiremit | `#BFD9FF` soğuk mavi | breathe 0.04, `to` ile uzun kayma | 5 → -5 | top |
| 5 | `#3D5A3C` zeytin | `#FFD39A` gün batımı | sweep, dir 1, 150° | -4 → 6 | left |
| 6 | `#5B4A7A` mor | `#FFE2AE` sıcak beyaz | pulse, `strength` 0.75 | 7 → -2 | right |

- Işık rengi duyguya göre seçilir: geçmiş ve insan → amber / sıcak; belge ve akıl → soğuk mavi; başarı ve heyecan → mercan.
- Satır 4-6 henüz videoda denenmedi. İlk kullanımda kullanıcıya göster.

## 4. Katman alanları (kısa)

| Katman | Zorunlu | İsteğe bağlı |
|---|---|---|
| piece | x, y, w, h | rot, color, seed, enterAt, from, depth (0.85), texture, stack, grid |
| cutout | image, size, x, y, height | rot, tape, bw, drift, enterAt, from, seed, boil, depth |
| print | image, size, x, y, w | rot, border, texture, tape, bw, from, enterAt, seed |
| doc | image, size, from{x,y,zoom} | to, moveAt, moveMs, ease (heavy), highlight{x,y,w,h}, highlightAt, sweepMs (600), dim |
| annotate | shape (circle / underline / arrow), x, y, w, h, at | drawMs, color, width |
| title | lines[{text, size?, color?, flipAt?, markAt?}], x, y, w | rot, paper, at, from, write ("typewriter") |
| tag | text, x, y, at | icon (lock / drop), rot, from, color, bg, size |
| route | points, at | ms (1800), bend (0.18), dash, march (40), color, width |
| pin | x, y, label, at | sub, dir, big, color, accent, opacity (label "" = yalnız nokta) |
| counter | from, to, at, x, y | ms (1100), roll, size, box, label, color |
| stamp | text, x, y, at | rot, color, shake, size |
| dust | — | count, color, size |
| graticule | geo{lon,lat}, at | step (15), lon/lat (false = çizme), ms, stagger, color, width, highlight[boylam], flicker{at, amp, lines}, pulseAt, turn{at, everyMs, steps} |
| wedge | geo, lon[a,b], at | lat[g,k], ms (1100), color (accent), opacity (0.42), hatch |
| ship | x, y ya da path[[u,v]], at, ms | size (70), enterAt (düşer), wake (true), sink{at, ms}, sway{amp, hz}, flip, ease (cubic), seed, image (sağa bakan saydam PNG; vektör üç direkli gemi yerine çizilir, size = yükseklik px; IYH001 dhow ve kervan; karada `wake: false`), rock{deg, hz, bob} (her zaman yavaş yalpa/kalkış), reflect{alpha, blur, squash} (su yansıması), shadow: false, opacity; doc yoksa path kare 0-1 (kum savrulması gibi kayan herhangi bir görsel) |
| ruler | x, y (ekran), len (doc u), label, at | u0, segments (4) |
| dim | at | amount (0.55), blur (8), ms (450) |
| clock | x, y, r, start{h,m}, to{h,m}, at | ms, enterAt, from (yön), rot, seed, face, hand |
| clouds | items[{element/image, x, y, w, depth}], at, ms | ease (heavyOut), grow (2.4), fade (0.75), tone (CSS filter), shadow, items[].blur/opacity/flip/drift |

- Her katman `showAt` ve `hideAt` alabilir (counter dahil). Bütün vox zamanları `"kelime"`, `"kelime#2"`, `"kelime+300"` / `"kelime-200"` yazılabilir (ofset 2026-11-09'a kadar sessizce 0'a düşüyordu). Vox kelimeleri `cueWords` (konuşulan yazım: "Fourteen"), altyazı rakamla ("14").
- Koordinat: graticule/wedge/ship/route/pin doc'un 0-1'i (`geo` = eşdikdörtgen kırpımın sınırları; NE kırpımları için kesin). ship, clouds,
  dim, ruler alan derinliği bulanıklığına girmez (kendi `blur`'ları var).
- `cutout`/`print` `osc: {hz, amp°, pivot[x,y] (görsel 0-1), irregular 0-1, at}`: pivot çevresinde salınım (EP006 s09: denge çarkı 2.5 Hz ±55°,
  sarkaç 0.8 Hz irregular 0.9). Tuzak: 15 fps basamakta 5 Hz örneklenince takılır gibi görünür; 2.5 Hz (saniyede 5 vuruş) yeterli.
- `camera.rock: {deg (1.5), periodS (2.4), y}`: periyodik yalpa (gemi). `tag.from: "wipe"`: soldan maske silmesi (420 ms expoOut).
- `doc`: `drift: false` (aynı tuvalde devam eden sahnelerde zoom sıçramasın: EP006 s02→s03, s14→s15), `keys[{at, ms, x, y, zoom, ease, anchor}]`,
  `anchor[sx, sy]`. Bant olmaması için zoom × v ≥ anchor.y ≥ 1 − zoom × (1 − v) (yatayda da aynısı u ile).
- `cutout.fill.hideAt` / `hideMs` (600): dolgu söner, elementin kendi deliği geri gelir (EP006 s14: H4 kadranında bimetal → kadran).
- Sahne `credit`: CC BY görsel vox sahnesindeyse ekran atfı (foto stilleriyle aynı yer).
- Sahne geneli: `bg`, `paper` (0.22), `surface`, `halftone`, `camera`, `light` (`false` = ışıksız), `stepFps`, `boil`, `wobble`,
  `motionBlur{samples, shutter}`, `film` (`true` ya da `{grain 0.24, vignette 0.58, flicker 0.025, weave 0.8, tint}`).
- Bölüm geneli `script.anim_fps` (ör. 15, earn.edits referansı): bütün sahne görüntüsü (kamera dahil) bu hızda basamaklanır, altyazı ve
  ses akıcı kalır. `build_timeline` vox `stepFps`'ini ve geçiş penceresi `fps`'ini aynı değere eşitler. Bu durumda `motionBlur` kullanma
  (basamaklı kamerada etkisi yok, render'ı uzatır).
- `camera`: `from`, `to`, `ease` (`sin` varsayılan, sahne boyunca; `heavy` / `expoOut` / `cubic`), `moveAt` + `moveMs` (hareket yalnızca bu
  pencerede), `push{zoom, ms}`.
- `depth`: katmanın kamerayı ne kadar izlediği. 1 = tam (varsayılan; yakın), küçük = uzak, az hareket eder. Kâğıt zemin 0.85, `surface` 0.7.
  Ön katmanı öne çıkarmak için ana öğe 1, arka parçalar 0.6-0.85.
- `dof: {focus, amount}` (alan derinliği): `|depth - focus| × amount` px bulanıklık (amount 14; focus varsayılan 1 = ana öğe net).
  Tanınması gereken arka plan nesnesi (uzayda Dünya, Ay, şehir silueti) dof'tan muaf tutulur: katmana `blur` (px) yaz, 0-2 px. EP010 uzay
  sahnelerinde `amount` 18 ile derinlik 0.45'teki Dünya ~10 px bulanıktı (kullanıcı 2026-11-12: "dünya kendini belli etsin") → `blur: 1.2`, Ay 2.
  Arka kâğıtlar (depth 0.6-0.85) yumuşar, ana kesik net kalır. Kâğıt zemin `depth` 0.7 ile belirgin derinlik verir.
- `lightWrap: true | {color, size 18, strength 0.55}`: ışık/zemin rengi kesik kenarından içeri sızar ("yapıştırılmış" durmaz). Her vox sahnesinde açık.
- `handheld: 0.6`: çok hafif el kamerası (yavaş sinüs toplamı, ±~4 px, ±0.15°). 15 fps ile el yapımı his; 1 üstü kullanma.
- `title.write: "typewriter"`: 30 karakter/sn, mono yazı, imleç yarım saniyede bir yanıp söner; her 2 harfte bir tuş sesi (§8).
- `lines[].markAt`: satırın arkasına fosfor süpürme (accent rengi, %92 opak, 600 ms expoOut, eğik kenar). annotate kuralına takılmaz;
  yalnızca başlık satırında kullanılır.

## 5. Karışım
`catalog/styles.yaml → vox-explainer.mix_with`.
- Varsayılan dizilim: arşiv/foto sahnesi → vox (A) → foto → vox (B) → arşiv → vox (C ya da D).
- `glass-ui`, `hologram-hud`, `pixel-art`, `neo-brutalism` ile aynı videoda kullanma.

## 6. Geçişler
Gelen sahnenin `visual.transition` alanı string ya da nesne: `{"type": "portal", "target": {...}, "shape": "arch"}` (pre/post varsayılanları §6.2).
Her geçiş üç parçadan oluşur: hedef (sahnedeki bir nesne), hareket (eğriler `camera.md`) ve doku (alt örnekli hız bulanıklığı; pencere **tam fps**).

**Akıcılık kuralları (2026-11-12, EP010; kullanıcı: "önceki sahne smooth kaybolmuyor, salise salise duruyor", her videoda tekrar ediyordu):**
1. Pencere zamanı basamaklanmaz. Eski 12 fps varsayılanı görüntüyü 2-3 karede bir oynatıyordu (kare farkı 41, 0.2, 40, 0.1 …) ve
   hareket her basamakta duruyordu. Varsayılan artık tam fps; yalnızca `whip` 8 fps. Basamak yalnızca bölüm `anim_fps` ile ya da `o.fps` ile açılır.
2. Hız kesmede sıfıra inmez. `heavy` (iki ucu %90) kesmeye doğru durur, ardından gelen sahne hızlı atılır: hareket durur ve yeniden başlar.
   Kesmeyi aşan geçişler pre + post TEK eğridir (portal, pullback, Through ailesi). Hız tepesi kesme civarında olur (AE: kesmede "continuous" anahtar).
3. Giden parça hareket ederken söner. Opaklık sıfıra indiğinde hız hâlâ tepenin ≥ %50'si olmalı. Küçülen kare ya da disk hedefe park edip
   donmuş kareyle durmaz, sonra sönmez. Donmuş son kare çerçeve içinde hafifçe itilmeye devam eder (`PullDive` drift %6).
4. Gelen sahnede giden sahnenin kopya baskısını (`Pr("sNN_last")`, `photo_print`) geçiş çerçevesiyle aynı yere koyma: iki fotoğraf üst üste
   görünür (EP010 s62). Çerçeve kendisi söner; kalıcı baskı isteniyorsa çerçeveyle aynı kutu ve dönüşte olmalı.
5. Ölç: render sonrası `voice/.venv-chatterbox/bin/python tools/transition_qc.py <bölüm>` (STUTTER = basamak, PARK = sürünüp duran parça).
Pencere: kesmeden önce `pre`, sonra `post` ms. Sahne süreleri ve ses senkronu değişmez; karşı sahne tek kare (Freeze) olarak çizilir.

| Geçiş | ne yapar | pre / post (ms) | ton |
|---|---|---|---|
| portal | **Tek hareketli dalış (2026-11-05):** pre + post tek eğri, kesme fark edilmez. Kamera hedefe tam fps yavaşça yaklaşır; hedefin merkezinden yumuşak kenarlı (elips) delik sıfırdan büyür, gelen sahne delikte 0.95 → 1 kamerayla aynı yönde büyür ve ayrı oturma yapmaz; giden sahne kesmeden sonra söner. Keskin kenarlı delik, `shape` ve 12 fps basamak yok ("sahne bir anda belirip sonra içine dalma", EP005). | 900 / 900 | hepsi |
| matte | **Kullanma** (kullanıcı 2026-11-05: "kötü"). Kod duruyor. | 280 / 300 | yok |
| surfaceTilt | Üstten kamera kayması (kullanıcı beğendi): iki yüzey aynı düzlemde, hafif eğilme + lens (`dir`). | 280 / 300 | hepsi |
| disc | Işık noktası (`at`) dönen keskin diske açılır (`teeth`, `spin`), kare `roll` kadar yatar, gelen sahne yatık başlayıp düzelir. `mode: "match"` (kullanıcı: "fena değil") + `to`: giden sahne küçülen diskte kalır, gelen sahnedeki nesneye oturur; sin eğrisiyle (g 0→1) hedefin %85'ine kadar küçülmeye devam ederken erir (g 0.45→0.8), hiç park etmez (2026-11-10: parça 1-2 sn duruyordu; 2026-11-12: heavy eğri g 0.72'de durduğu için küçük disk hâlâ donmuş bekliyordu). Gelen sahne bölüm başlığıysa `fromBlackMs` VERME (karanlıktan açılma diskin üstüne biner). | 280 / 320 | hepsi |
| door | **Kullanma** (kullanıcı 2026-11-05: "hazır CapCut geçişi gibi"). Kod duruyor. | 300 / 300 | yok |
| window | **Yalnızca fotoğrafta gerçekten pencere varsa** ve sonraki sahne o pencerede baştan görünüyorsa. Ortada beliren geçit garip duruyor (kullanıcı 2026-11-05). Delik ekranda sabit: giden sahnenin kamerası son ~1.7 sn durmalı. | 280 / 300 | gerçek pencere |
| pullback | **Tek hareket (2026-11-12, `PullDive`):** pre + post tek sin eğrisi, tam fps. Kamera gelen sahnede `frame` kutusundan geri çekilir; giden sahne krem kenarlı baskıda (ya da `elem` deliğinde) g 0.5→0.8 boyunca sönerken çerçeve küçülmeye devam eder. Lens 3 px. Eski sürüm (kesmede duran heavy itme + 12 fps heavyOut küçülme + park edip donmuş kare) "salise salise duruyor" geri bildirimi aldı. | 450 / 1500 | hepsi |
| cardflip | `target` kutusu masadan kalkar (Z), Y ekseninde döner ve hafif taşıp oturur; kâğıt kalınlığı, yüz başına ışık + geçen parlama, masada kalan gölge, dönüş bulanıklığı. Arka yüz gelen sahnenin penceresi; ardından portal. | 900 / 400 | hepsi |
| zoomblur | Giden sahne 1 → 3.6 büyür (ease-in), gelen 1.8 → 1 oturur (heavyOut, log); alt örnekli radyal bulanıklık + lens. | 300 / 500 | hepsi |
| whip | Yatay ya da dikey hızlı kaydırma (`dir`), expo in-out, 8 fps. | 250 / 250 | enerjik |
| leak | Ekranı screen modunda turuncu-kırmızı ışık süpürür (`color`), ortada hafif aşırı pozlama. | 300 / 300 | sıcak, nostaljik |
| rgb | Renk kanalları ±26 px ayrılır, %8 punch zoom. | 300 / 300 | yalnızca enerjik, videoda en çok 1 |
| halftoneWipe | Merkezden büyüyen baskı noktaları (`color`) ekranı kaplar, sonra çekilir. | 300 / 300 | yalnızca enerjik, videoda en çok 1 |
| slide | Giden ve gelen sahne yan yana birlikte kayar (push), heavy ease: ağır kalkış, hızlı orta (hız bulanıklığı), uzun duruş; aralarında ince gölge. `dir`: left (varsayılan) / right / up (referanstaki dikey push) / down. | 380 / 420 | hepsi; zoom dışı çeşitlilik |
| objectWipe | **Kullanıcının en doğal bulduğu geçiş** (EP006 kırmızı kitap): kaydırmalı geçişi çıplak yapma, bir nesneyle yap. Gelen sahneden büyük bir nesne görseli (`image`, `size`, `rot` -4, `scale` 1.15, `dir`) ekran dışından girer, kesmede kareyi tamamen kaplar, öbür yandan heavyOut ile çıkar; gelen sahne arkasında kalır. Kenarda gölge, alt örnekli hız bulanıklığı. Görsel kenarsız kırpılmış olmalı. `dir: up/down` dikey geçer (scale = genişlik oranı); `alpha: true` saydam kenarlı PNG (dalga sırtı gibi düzensiz kenar, gölge alfayı izler; IYH001 s01→s02 dalga duvarı). **Derinlikli süzülme (EP015 s03→s04 akbaba kanadı):** `keepAspect: true` (saydam PNG oranını korur; yoksa dikeyde H×1.25'e uzar), `spin` (geçiş boyunca toplam dönüş °), `depthScale` (başta 1+d büyük → sonda 1−d); ağır sürüm pre 1100 / post 1300, kesik kareyi ≈ %90 kaplasın diye scale ≈ 1/(oran)·0.95. Aynı videoda iki objectWipe varsa biri yandan düz, öbürü dikey + spin + depthScale. **Küçük kesik (kuş, ~1200 px) için `seam: true`:** kareyi örtmesi gerekmez, gelen sahne nesnenin arkasında açılır, ek yeri nesnenin (rot ile eğik) orta çizgisinde; scale'i en büyük ekran boyu (W·scale·(1+depthScale)) ≤ 1.8× kaynak genişliği olacak şekilde seç (EP015: 4.3 → 1.68; 4.3'te tüyler bulanık/tırtıklıydı). Hızlı geçişte hız kopyaları basamak yapar: `blurSamples: 8, ghostBlur: 4`. | 450 / 550 | hepsi; nesneli çıkış |
| fog | Kameranın önünden üç katmanlı sis bankası geçer (yakın hızlı, uzak yavaş), altındaki sahne açılıp bulanıklaşır; ön plan silmesi. `dir`, `color`. | 800 / 900 | hepsi; deniz, gece, gizem |
| (karanlığa iniş) | `fog` + koyu `color` KULLANMA: sis dokusu kararmıyor, kareyi gri bulut lekesiyle kaplıyor (EP015 s07→s08). Yerine giden vox sahnesine `{"type": "dim", "at": "<son kelime>+900", "amount": 0.94, "blur": 6, "ms": 1100}` + düz kesme; gelen sahne karanlıktan açılır (object3d spot, `fromBlackMs`). Son fotoğraf ≥ 3 sn görünsün diye giden sahneye `tail_ms`. | — | belgesel, kapanış |

Ton tablosu:
- Enerjik / eğlence → tüm geçişler, pre/post tablodaki gibi.
- Belgesel / bilim → portal, pullback, cardflip, slide, fog, zoomblur, leak.
- Çeşitlilik (kullanıcı, EP004): "yalnızca zoom in/out olmasın". Videoda en çok 3 portal/zoomblur; en az 1-2 `slide` ve uygun konuda 1 `fog`.
  Kullanıcının beğendikleri: sis geçişi, heavy ease kaydırma, pencere portal, katmanlı foto derinliği.
- Ağırbaşlı (dini, anma, yas, bağış) → yalnızca portal, pullback, zoomblur; pre/post × 1.4; `shake` 0; rgb, halftoneWipe, whip yok.

### 6.1 Hedef seçimi
(Derinlik düzlemleri, element kütüphanesi, `elem:` hedefleri ve pullback dolgusunun tamamı: `depth-elements.md`. Aşağısı vox'a özel özet.)
- **Portal hedefi sahnedeki gerçek açıklıktır** (2026-11-12, EP010 s33→s34: tabanda ortada delik varken portal ekran ortasından açıldı).
  Varsayılan `TBOX` (0.5, 0.4) ile portal yazma: deliği son karede ölç (kesme − pre karesi; kamera `moveAt` ile kayıyorsa onun bitişi).
- portal / cardflip hedefi: giden sahnenin son karesinde net, çerçeveli ya da kapalı bir şekil (pencere, kapı, tünel ağzı, fotoğraf, ekran,
  kesik). Yüz hedef olmaz. Hedef karenin y 0.08-0.58 bandında olmalı; değilse kamera `to` ile önce oraya getir.
- Hedef kutusu: görseli aç, nesnenin son karedeki ekran kutusunu ölç (`remotion still`, kesme − 1), merkez + genişlik/yükseklik olarak
  0-1'e çevir: `{"x","y","w","h"}` (x, y merkez). Kemer ya da yuvarlak ağız için `shape: "arch"` / `"circle"`, düz çerçeve için `"rect"`.
- **Element kütüphanesi** (`content/assets/elements/<id>.png` + `<id>.yaml`: size, hole {x,y,w,h} görselin 0-1'inde, shape): sahnede
  `{"type": "cutout"|"print", "element": "<id>", "x", "y", "height"|"w", …}` yaz (image/size kütüphaneden gelir); geçişte
  `"target": "elem:<id>"` (portal/cardflip, giden sahnedeki element) ya da `"frame": "elem:<id>"` (pullback, gelen sahnedeki element).
  `build_timeline` deliği ekran kutusuna çevirir ve shape'i alır; elle ölçüm gerekmez. Kamera/dönüş yok sayılır: element büyük
  dönüşlü ya da kamera hedeften çok uzaktaysa kesme − 1 karesinde kontrol et.
- Dalış hedefe "akar": zoom hedef merkezine yapılırken hedef merkezi ekran merkezine kayar (easeInOutCubic).
  Gereken ölçek `smax = max(1 / w, 1 / h) × 1.15`; çok küçük hedef (w < 0.15) bulanık büyür, kaçın.
- pullback `frame`: gelen sahnede giden sahnenin oranına yakın bir dikdörtgen, ana öğelerin üstüne gelmeyen bir yer.
- `frame: "elem:<id>"` pullback'te giden sahne elementin deliği şeklinde kırpılır ve son %30'da söner. Elemente aynı görseli kalıcı
  dolgu olarak MUTLAKA ver: `"fill": {"image", "size", "x", "y", "zoom"}` (zoom ≈ giden sahnenin son kadrajı; ör. s06 zoom 1.2 → fill 1.7).
  Dolgu yoksa geçişten sonra delik boş kalır ve görüntü bir an kalıp kaybolur (EP004 s06→s07 kullanıcı geri bildirimi).
- Aynı videoda iki portal art arda gelmez; portal → pullback sırası en doğal okunan çifttir.

### 6.2 Değerler
```json
{"type":"portal","target":{"x":0.56,"y":0.47,"w":0.29,"h":0.14},"pre":900,"post":900,"blurSamples":4,"lens":5}
{"type":"pullback","frame":{"x":0.5,"y":0.4,"w":0.42,"h":0.42},"pre":450,"post":1500,"fps":12,"lens":8}
```
- Varsayılan pencereler, `ease`, `lens`, `hunt`: `camera.md §5`. Değerleri burada tekrar yazma.
- `fps` yalnızca geçiş penceresinde uygulanır; sahnenin geri kalanı kendi `stepFps`'iyle oynar.
- `blurSamples`: 4-8 (her örnek sahneyi bir kez daha çizer; 8 üstü kırpılır).

### 6.3 Fotoğraf sahneleri (ken-burns-photo / archival-film) için 2.5D (ayrıntı: `depth-elements.md §2`)
- `tools/.venv-matte/bin/python tools/photo_planes.py <foto> --out-dir <bölüm>/assets/planes` → `<ad>.fg.png` (ön plan, aynı piksel ızgarası)
  + `<ad>.bg.jpg` (delik doldurulmuş). Props: `{"image": "<ad>.bg.jpg", "planes": [{"image": "<ad>.fg.png", "k": 1.4}], "dof": {"amount": 5}, "handheld": 0.6}`.
- `k`: yakın katmanın hareket çarpanı (1.3-1.5). Doldurma kabadır: zoom farkı ≤ 0.15 ve k ≤ 1.5 tut, delik kenarı görünmesin.
- Ön plan kapsamı %3-70 dışındaysa `--box` ile sınırla. Tek, belirgin nesneli fotoğraflarda en iyi (kule, mercek, kişi).

## 7. Hareket ve ease
- Eğriler, log zoom, ağır yakınlaşma (punch-in), odak (`dof`: rack focus, settle, hunt) ve itme (`camera.push`): `camera.md`. Vox'a özgü olanlar:
- Girişler (piece / cutout / print / tag / title): yay (spring), ekran dışından gelir, son kısımda hafif taşıp oturur. `pin`: backOut.
- Motion blur yalnızca akıcı (basamaklanmayan) kamerayı bulanıklaştırır; `stepFps` ile basamaklanan kâğıtlar net kalır ("posterize'dan önce blur").

## 7.1 Bitiş katmanı (bölüm geneli)
`script.finish: {"fringe": 0.6, "dust": 0.5, "vignette": 0.45}` → bütün sahnelerin üstünde, altyazının altında: kenar bulanıklığı + hafif renk
saçağı (fringe blur), film tozu (zerre, seyrek kıl ve çizik; `anim_fps` ritminde), vinyet. Vox içeren her bölümde açık.

## 8. Ses
`tools/build_timeline.py` olaylardan sesleri kendisi yerleştirir; dosyalar `content/sfx/pixabay/` (Pixabay, `sources.csv`). Senaryo üst
düzey `"auto_sfx": false` katman seslerini, `"sfx_bed": "none"` oda tonu yatağını kapatır. Seviyeler mevcut katmanlı geçiş seslerine göre ayarlı.

| Olay | ses | zamanlama |
|---|---|---|
| portal | whoosh_cinematic + impact_boom3 + sub_drop_short | whoosh tepesi kesmede, vuruş ve sub kesme karesinde |
| pullback | whoosh_epic + thud_deep_loud | iniş pencerenin içinde |
| cardflip | page_flip + whoosh_cinematic + impact_boom5 | dönüşün ortası, vuruş kesmede |
| slide | whoosh_epic + thud_deep_loud | kesme / oturma |
| objectWipe | **Kullanıcının en doğal bulduğu geçiş** (EP006 kırmızı kitap): kaydırmalı geçişi çıplak yapma, bir nesneyle yap. whoosh_epic + paper_slide_table + thud_deep_loud | kesme |
| fog | boom_swoosh + whoosh_epic + sub_bass_boom (kısık) | sisin yoğunlaştığı an |
| zoomblur | whoosh_hit + sub_drop_short | kesme |
| stil değişen düz kesme (`transition_sfx: "layered"`) | manim: riser_cinematic + whoosh_cinematic + impact_boom3 · kâğıt: swoosh_slow + book_drop + thud_small · foto: whoosh_cinematic + sub_drop_short | kesme |
| whip / rgb / halftoneWipe | swoosh_thin / paper_slide | kesme |
| leak | riser_swoosh + whoosh_cinematic | kesme |
| tag / pin | pop_soft, thumb_tack, pop_clean | at |
| annotate, highlight, markAt | marker | çizimin başı |
| title `write: typewriter` | click_soft / pen_click, ±%20 kazanç | her 2 karakterde bir |
| counter | tick | 90 ms (roll) / 140 ms arayla |
| stamp | stamp | çarpma |
| yatak | room_tone, −40 dB | video boyunca (yalnızca vox içeren bölümlerde) |

air_hiss / air_swish geçiş sesi değildir (EP003 tren basınç dalgası; 200 Hz altı enerji yok). Geçişte tok whoosh kullan: whoosh_epic, boom_swoosh, whoosh_hit, whoosh_cinematic + alçak vuruş. Tokluk ölçümü: 200 Hz altı enerji payı (librosa STFT) > %50.

- "Tok" ses = kısa hava (whoosh) + kesmede vuruş (impact/thud) + altında derin bas (sub). Yeni ses eklerken `tools/sfx_process.py` SPEC'e yaz,
  doruk karesini ölç ve `lead` = doruk karesi (doruk kesmeye denk gelsin). Senaryoda `transition_sfx: "layered"` olmalı (sentetik whoosh yasak).
- Olay sesi senaryoda: `visual.sfx: [{"word", "file", "gainDb", "offsetMs"}]` (ör. EP004 s03 kaza: splash_big + huge_thump).
- Aynı türden iki ses 120 ms'den yakınsa ikincisi atlanır. Birden çok dosyası olan türler sırayla döner (aynı dosya art arda çalmaz).
- Müzik varsa: kesmeleri bas vuruşlarına ±1 kare oturt (elle, sahne sürelerini değiştirmeden `pre` ile). Ağırbaşlı videolarda müzik
  kullanıcıya sorulur; varsayılan müziksiz, yalnızca SFX + yatak.
- Master: `tools/package.py` (−14 LUFS, tepe ≤ −1 dBTP).

## 9. Kapak (Cover kompozisyonu, tek kare)
`clips/cover.json` = vox props; render: `cd studio && npx remotion still src/index.ts Cover <out.png> --frame=60 --props=../content/episodes/<EP>/clips/cover.json`.
`tools/package.py` kapağı videodan yeniden üretir: paketten SONRA `render/cover.png`'yi bu kapakla değiştir.
Derinlikli kapak tarifi (EP004, kullanıcı beğendi): üç düzlem + alan derinliği.
```json
{"style":{"bg":"#24303C","surface":{"image":"textures/<konu dokusu>.jpg","tint":"#8EA3B5","span":1.6,"depth":0.55},
 "paper":0.12,"halftone":{"opacity":0.18},"dof":{"focus":1,"amount":22},"lightWrap":true,
 "camera":{"from":{"zoom":1.03,"tilt":7,"turn":-5},"to":{"zoom":1.03,"tilt":7,"turn":-5}},
 "light":{"x":0.2,"y":-0.05,"color":"#FFD39A","strength":0.7,"breathe":0},
 "layers":[{"type":"piece","x":0.58,"y":0.5,"w":0.8,"h":0.42,"rot":4,"depth":0.75,"stack":2},
  {"type":"cutout","image":"<ana nesne sticker>","x":0.34,"y":0.52,"height":0.47,"rot":-5,"bw":false,"drift":0,"tape":true,"depth":1},
  {"type":"cutout","element":"<element>","x":0.6,"y":0.63,"height":0.17,"rot":-24,"bw":false,"drift":0,"depth":1.05},
  {"type":"title","lines":[{"text":"<2-3 KELİME>","size":112},{"text":"<2-3 KELİME>","size":112}],"x":0.5,"y":0.15,"w":0.9,"rot":-2,"at":0},
  {"type":"tag","text":"<yıl>","x":0.74,"y":0.8,"rot":4,"at":0,"bg":"#F2A93B","color":"#16202B","size":68}]}}
```
- Arka (zemin 0.55, kâğıt 0.75) bulanık, ana nesne net, ön nesne (element) ana nesnenin ÜSTÜNDEN geçer: üst üste biniş derinliği verir.
- Ana nesne başlık kartının altında kalmasın (üst kenarı y ≥ 0.26).

### 9b. Uzun video kapağı (16:9, Thumbnail kompozisyonu; EP009 2026-11-09)
`studio/src/compositions/Thumbnail.tsx`, 1920×1080. Props `clips/thumb/<harf>.json`: `image` (content/'e göre), `zoom/fx/fy` (odak; fx=0 sol kenar sabit
→ nesne sağa kayar, fx=1 tersi), `dim/dimSide` (yazı tarafına karartma), `lines[{text,size,paper:cream|yellow|none,font:alfa|fell,rot,dx}]`, `x/y/align`, `tag`.
Render: `cd studio && npx remotion still src/index.ts Thumbnail ../content/episodes/<EP>/clips/thumb/A.png --props=../content/episodes/<EP>/clips/thumb/A.json`.
- Arka plan videodan ALTYAZISIZ kare: woodcut/three klipleri `npx remotion still src/index.ts <Woodcut…> x.png --frame=N`; vox/foto sahnede altyazısız an
  (konuşma arası) `ffmpeg -i render/<v>.mp4 -vf "select=eq(n\,F)"`. Woodcut karesinde kâğıt payı görünmesin: zoom ≥ 1.1.
- Belgesel kanal kapak dili: tek odak nesnesi (göz/yüz/silüet), 2-4 kelime, yazı başlığı TEKRARLAMAZ (merak boşluğu: başlık hikâyeyi, kapak soruyu verir),
  yüksek kontrast, küçük boyda okunur. Özel tasarım (videodan kare değil, kullanıcı EP009'da bunu istedi): `layers[{src|color, x,y,w,h, rot, shadow,
  glow (silüet arka ışığı), filter, clip:"circle", ring, inset, children}]`; ör. gözetleme deliği = kapı fotoğrafı + circle pencere (içinde karartılmış hücre +
  silüet + kâğıt göz). Kolajda CC BY görsel varsa açıklamada atıf. EP009 örnekleri: `clips/thumb/P1-P3.json`. Üç aile: (1) Veritasium/Vox: kolaj nesne + kısa iddia şeridi; (2) Netflix/LEMMiNO: sinematik kare + küçük serif
  başlık (`font: fell`), yazı neredeyse yok; (3) soru kapağı: tek kelime + "?" ("ASLEEP?"). Kullanıcıya 4'lü ızgara (`_grid.jpg`) ile seçtir; yazı yüzü/başı örtmesin.

## 10. Render ve kontrol notları
- GPU (`angle`) `remotion.config.ts`'te varsayılan: 80 sn vox bölümü ≈ 6 dk (GPU'suz 23 dk). Görüntü farkı yok.
- Kontrol karesi `remotion still` ile `--scale` KULLANMADAN al (bitiş katmanının backdrop blur'u küçük ölçekte kenarda ayna kopya yapar);
  küçültmeyi ffmpeg ile yap. Google Fonts zaman aşımına düşerse aynı kareyi bir kez daha dene.
- Müzik dosyası çok kısıksa (ör. fluidsynth çıktısı −45 LUFS) önce dosyayı −19.5 LUFS'e sabit kazançla getir; aksi hâlde büyük kazanç
  Remotion'ın ses ifadesini ffmpeg sınırının üstüne taşır ve render ses miksajında durur.
