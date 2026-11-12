# Derinlik ve elementler — teknik talimatı (ajan için)

Stilden bağımsız teknik: vox-explainer, ken-burns-photo, archival-film sahnelerinde ve kapakta kullanılır. Bir sahneye derinlik kurarken,
bir geçiş nesnesi seçerken ya da kütüphaneye element eklerken bu dosyayı uygula. Öğretici anlatım: `docs/styles/depth-elements.md`.
Kod: `studio/src/styles/vox-explainer/index.tsx` (depth, dof, lightWrap, handheld, fill), `studio/src/styles/photo/PhotoMotion.tsx`
(planes), `studio/src/components/Transitions.tsx` (elem hedefleri), `tools/build_timeline.py` (`expand_elements`, `element_target`).
Kullanıcı geri bildirimi (EP004): "bu sefer derinlik baya var" — katmanlı foto + üst üste biniş + alan derinliği birlikte çalıştı.

## 0. Kurallar
1. Her sahnede en az üç düzlem düşün: **arka** (zemin/doku, bulanık) · **orta** (ana nesne, net, odak) · **ön** (kameraya yakın nesne ya da
   element, ana nesnenin bir kısmının ÖNÜNDEN geçer). Üst üste biniş derinliğin en güçlü ipucudur.
2. Odak her zaman anlatılan nesnede (`dof.focus` = onun `depth`'i). Yüz/kişi varsa odak odur.
3. Derinlik efekti içeriğe hizmet eder: sırf derinlik için ekstra yazı/damga/sayaç katmanı ekleme.
4. Kamera hareketi küçük kalır (zoom farkı ≤ 0.15; istisna ağır yakınlaşma, `camera.md §3`). Derinliği büyük kamera hareketi değil, katmanların farklı hızı verir.

## 0.5 Araçlar (hangisi, ne zaman, nasıl)
Hepsi `tools/.venv-matte/bin/python` ile çalışır. Modeller `~/.u2net/` altında hazır: isnet-general-use, birefnet-general, birefnet-portrait,
u2net_human_seg. `rembg` komut satırı bu ortamda ÇALIŞMAZ (click eksik); doğrudan rembg çağırma, aşağıdaki araçları kullan.

| İş | Araç | Ne yapar | EP004'te |
|---|---|---|---|
| Nesne kesiği (arka plan kaldırma) | `tools/cutout.py <girdi> <çıktı.png> [--box] [--model] [--sticker]` | rembg (isnet) ile kesip alfa kutusuna kırpar, uzun kenarı 1400 px; `--sticker` ile yırtık kâğıt arkalık | kapaktaki yakıcı mercek (`--sticker --seed 4`) |
| Element kesiği | `tools/cutout.py <foto> content/assets/elements/<id>.png` (sticker yok) | aynı; sonra delik ölçülür, yaml yazılır (§3.1) | büyüteç, iki çerçeve, kovan mercek |
| Kâğıt arkalık (ayrı) | `tools/make_sticker.py <kesik.png> <çıktı.png> --border 14 --rough 6 --seed N` | kesiğin çevresine yırtık kenarlı kırık beyaz kâğıt | EP002-004 kolaj kesikleri |
| Fotoğrafı 2.5D katmana ayırma | `tools/photo_planes.py <foto> --out-dir <bölüm>/assets/planes [--box] [--dilate 18]` | rembg ile ön plan (aynı piksel ızgarası, kenar 1.5 px yumuşak) + arka planda deliği OpenCV Telea ile doldurma (küçültülmüş görüntüde, sonra büyütüp tane ekleme) | s01 mercek, s10 Cordouan, s14 |
| Bulut kesiği (gökyüzü anahtarı) | `voice/.venv-chatterbox/bin/python tools/cloud_key.py <foto> <çıktı.png> [--box] [--feather sol,üst,sağ,alt] [--gamma 1.3] [--preview]` | mavi gökyüzü → alfa (B−R'ye göre), despill + kenarda gri, kırpım kenarı yumuşatma; yarı saydam kenar korunur. rembg buluta uygun değil (sert kenar). Kapalı hava/gökyüzüsüz fotoğrafta çalışmaz | EP006 `clouds-*` (4 element) |
| Çerçeve + duvar katmanı (foto önünde) | `voice/.venv-chatterbox/bin/python tools/plane_bake.py frame <foto> <element> <çıktı.png> --hole x,y,w [--wall] [--wall-tint]` | elementi fotoğrafla aynı ızgarada, deliği verilen kutuya oturtur, dışını tonlanmış ahşap duvarla doldurur, deliği keser | EP006 s07 (frame-oval), s12 (frame-carved) |
| Belge sayfası masada | `voice/.venv-chatterbox/bin/python tools/plane_bake.py page <sayfa> <çıktı_kökü> [--size 2160,3840] [--box x,y,w] [--rot]` | saydam tuvalde gölgeli sayfa (`.page.png`, ana görsel) + aynı boy masa (`.table.jpg`, `under: true, k 0.6`) | EP006 s04 (Boylam Yasası) |
| Zor kenar (saç, ince tel, hareketli video) | `tools/matte_video.py` (`tools/.venv-sam2`, SAM 2, nokta istemi) | videoda nesne takibi + şeffaf video; fotoğrafta isnet yetmezse SAM 2 maskesi | EP002 |

Model seçimi: nesne → `isnet-general-use` (varsayılan); ince kenar / dantel / cam kenarı → `birefnet-general` (yavaş, daha temiz);
kişi → `u2net_human_seg` ya da `birefnet-portrait`. rembg arka plandan parça alırsa `--box` ile nesnenin kutusunu ver.

**EP004'te derinlik nasıl yapıldı (adım adım):**
1. Mercek (s01) ve Cordouan (s10): `photo_planes.py` → `fg.png` + `bg.jpg`; ken-burns props'una `planes: [{k: 1.4}]`, kamera içeri itiyor.
2. Büyüteç ve çerçeveler: Commons/müze PD-CC0 görsel → rembg kesik → delik ölçümü → `content/assets/elements/<id>.{png,yaml}`.
3. Vox sahneleri (s04, s07, s12): zemin `surface` (deniz haritası, teknik çizim, ahşap; depth 0.55-0.7), kâğıt 0.8, kesikler 1, element önde;
   `dof {focus 1, amount 14}`, `lightWrap`, `handheld 0.6`.
4. Kapak: `cutout.py ... --sticker` ile yakıcı mercek kesiği + büyüteç elementi önde, `dof.amount 22`.
5. s13 (Yaquina, camın içinden bakış) katmanlanamadı: ön plan yok, doldurma camın içinde lapa gibi göründü → düz ken-burns.

**EP005'te eklenenler:**
- Elementler `hubble-mirror` (eğik ayna; rembg alttaki takozları aldı → kutu kırpımı + elle çizilen elips maskesi, PIL `ImageDraw.ellipse` +
  Gauss 1.5 px; uzaktaki teknisyen kolları koyu/ten rengi piksel eşiğiyle silindi) ve `spectacles-wire` (ince tel: `birefnet-general`
  `--box`; kesiğe giren kılıf yeşil kanal eşiği `G − R > 14` ile silindi). Delik ölçümü: yaml'ı tahminle yaz, vox still'de dolgunun cama
  oturup oturmadığına bak, düzelt (spectacles: 0.16/0.52/0.21/0.22 → 0.135/0.545/0.24/0.29).
- Belge sahnesi foto stilinde: her sayfa `plane_bake.py page` ile ayrı (`--table-tint "#8A7360"`), `cuts[].planes` ile kendi masası; sayfa kutusu
  çıktısı cardflip hedefini verir (EP005 s06 → s07).

**EP006'te eklenenler (foto stilleri):**
- `planes[].under: true` ana görselin ALTINA çizilir (k < 1 zemin: masa), `planes[].wrap: false` light wrap almaz (çerçeve/duvar).
  `cuts` aynı görseli sürdürüyorsa katmanları devralır (s04 sayfa + masa punch-in, sonra geri çekilme).
- Çerçeve katmanı en yakın düzlem (k 1.5-1.6): `dof.focus`'u kişinin katmanına ver (s07: 1.35), yoksa odak çerçeveye kayar.
- `lightWrap` foto stillerinde de var (planes kenarına arka plan ışığı; s07, s08, s13).
- Planes olmayan fotoğrafa derinlik: `mist` (ön sis/serpinti bandı, iki hızda) + `lightning` (şimşek) — `studio/src/styles/photo/Atmos.tsx` (s01 gravür).
- Manim sahnesine kâğıt dokusu: props `paper: {image, opacity, blend}` (açık zeminde multiply, koyu zeminde `soft-light`).

**EP008'de eklenenler:**
- Araba ve müze nesnesi kesiği: `birefnet-general` + kutu kırpımı temiz çıktı; SAM 2 yalnızca noktayla (1600 px'e küçültülmüş) benekli maske verdi. İnce nesnede (kol, kemer) SAM 2 tam çözünürlük, kutu + nokta, iki nesne ayrı, `mask_input` ile ikinci geçiş, sonra cv2 close/open + en büyük bileşen (`EP008/manim/sam_hand.py`). `sam2` yalnızca `tools/.venv-sam2`'de; o ortamda scipy yok.
- `ImageOps.autocontrast` kâğıt dokusunda kabartmayı abartıyor; gri kâğıtta düz renkle %90 harmanla (`visuals.py gpaper`).
- Manim `always_redraw` içinde `ImageMobject` çalışmaz (`Group.become` hatası): görseli dışarıda ekle, opaklığı updater ile sür.

## 1. Derinlik değerleri (vox)
| Düzlem | `depth` | Not |
|---|---|---|
| zemin (`surface.depth`) | 0.55-0.7 | gerçek doku: kâğıt, karton, ahşap, deniz haritası, teknik çizim (`content/textures/`) |
| büyük kâğıt parçası | 0.7-0.85 | |
| ana nesne / kesik | 1 | odak (net) |
| ön nesne / element | 1.0-1.1 | ana nesnenin önünden geçer; 1'in biraz üstü hafif bulanıklık + daha çok kayma |

- `depth`: katmanın kamerayı ne kadar izlediği (1 = tam; küçük = uzak, az kayar).
- `dof: {focus: 1, amount: 14-22}`: bulanıklık = `amount × |depth − focus|` px; zemine de uygulanır. Kapakta 22, videoda 14.
- `lightWrap: true`: ışığın rengi kesik kenarından içeri sızar. Her vox sahnesinde açık.
- `handheld: 0.6`: çok hafif el kamerası. 1 üstü kullanma.
- Kamera eğimi (`tilt` 6-9, `turn` ±4-7) masa üstü perspektifi verir; derinliği güçlendirir.
- **Zemin dokusu bulma** (`content/textures/`, konuya göre seç: deniz → eski deniz haritası, mühendislik → teknik çizim, atölye → ahşap):
  - Yüzey dokusu: Poly Haven (polyhaven.com, CC0) ya da ambientCG (CC0) → "diffuse/albedo" haritasının **2K** JPG'si (8K orijinaller
    `tools/textures/src/`, git dışı). Örn. EP004 `wood-table-large.jpg` = Poly Haven "Wood Table Large" diffuse 2K.
  - Belge/harita/çizim: Commons PD (`tools/find_images.py search "admiralty chart 1850"`), başlık bloğu, imza, yazı kadraj dışında kalacak
    şekilde kırp (ekranda okunur dil yazısı kalmasın), uzun kenar ≥ 2500 px.
  - Props: `surface: {image, tint (koyu/soğuk ton, ör. #8EA3B5), span 1.5-1.6, depth 0.55-0.7}`; assets.csv'ye lisansla yaz.

## 2. Fotoğrafı 2.5D yapmak (ken-burns-photo, archival-film)
```
tools/.venv-matte/bin/python tools/photo_planes.py <foto> --out-dir <bölüm>/assets/planes [--box x0,y0,x1,y1]
```
→ `<ad>.fg.png` (ön plan, aynı piksel ızgarası) + `<ad>.bg.jpg` (deliği doldurulmuş). Props:
`{"image": "<ad>.bg.jpg", "planes": [{"image": "<ad>.fg.png", "k": 1.4}], "dof": {"amount": 5}, "handheld": 0.6, "from": {...}, "to": {...}}`
- `k` 1.3-1.45. Kamera **içeri** itsin (from.zoom < to.zoom): yakın katman büyüyerek doldurulmuş alanı örter. Geri çekilmede doldurma görünür.
- İyi aday: tek, belirgin, kenarı net nesne (kule, mercek, heykel, kişi). Kötü aday: cam/ağ içinden bakılan sahne, ön planı olmayan manzara (EP004 s13).
- Ön plan kapsamı %3-70 dışındaysa `--box`. Sonucu tek karede kontrol et (delik kenarı, hale).

## 3. Element kütüphanesi (`content/assets/elements/`)
Element = içinden geçilebilen ya da sahneye derinlik katan, arka planı kaldırılmış yüksek kaliteli nesne (çerçeve, büyüteç, pencere,
mercek, kapı, kart). Katalog: `content/assets/elements/README.md` (her bölümden sonra güncelle).

### 3.1 Yeni element ekleme
1. Kaynak: PD / CC0 öncelikli (Commons, Cooper Hewitt, MET Open Access, Smithsonian). Yüksek çözünürlük (uzun kenar ≥ 1500 px).
2. Kesik: `tools/cutout.py <foto> content/assets/elements/<id>.png [--box …] [--model birefnet-general]` (§0.5). PNG, şeffaf arka plan.
3. Delik ölçümü: önizlemede deliğin/camın kutusunu görselin 0-1'inde ölç (x, y merkez). `shape`: `circle` (oval dahil) · `arch` · `rect`.
4. `<id>.yaml`:
```yaml
id: frame-oval
source: "<dosya sayfası URL>"
license: Public domain
author: "<sanatçı / kurum>"
size: [2401, 2996]
hole: {x: 0.4875, y: 0.475, w: 0.4875, h: 0.533}
shape: circle
notes: "<ne olduğu, deliğin saydam olup olmadığı, perspektif>"
```
5. Önizleme `episodes/<EP>/assets/preview/el-<id>.jpg`, bölümün `assets.csv`'sine satır, README kataloğuna satır.

### 3.2 Sahnede kullanım
```json
{"type": "cutout", "element": "magnifier", "x": 0.6, "y": 0.63, "height": 0.17, "rot": -24, "bw": false, "drift": 0, "depth": 1.05}
```
`build_timeline` image/size/hole/holeShape'i kütüphaneden ekler. `print` tipi de olur (`w` ile).

### 3.3 Geçişte hedef
- Portal / cardflip: gelen sahnenin `visual.transition`: `{"type": "portal", "target": "elem:<id>"}` (giden sahnedeki element).
- Pullback: `{"type": "pullback", "frame": "elem:<id>"}` (gelen sahnedeki element). Giden sahne deliğin şeklinde kırpılır, son %30'da söner.
- Düz çerçeve pullback (`frame: {x,y,w,h}`): çerçeveli baskı da pencerenin son %35'inde söner (2026-11-03, EP005 s04: baskı 1.5 sn kalıp bir anda kayboluyordu, "foto hemen kaybolmuyor"). Pencere varsayılan 1500 ms; sahne başında baskı uzun kalmasın diye `"post": 1000` ver.
- **Pullback'te dolgu zorunlu:** elemente aynı görseli kalıcı dolgu ver; yoksa delik boş kalır, görüntü bir an kalıp kaybolur (EP004 s07):
  `"fill": {"image": "<giden sahne görseli>", "size": [w, h], "x": 0.52, "y": 0.32, "zoom": 1.7}` — zoom ≈ giden sahnenin son kadrajı
  (giden zoom 1.2 → fill ~1.7); dolgu varsayılan `sepia(0.55)` (filter ile değişir). Pullback hedefinde elementin `rot`'u 0 olsun.
- Hedef kutusu kamera/dönüşü yok sayar: element büyük dönüşlü ya da kamera hareketliyse kesme − 1 ve kesme + 3 karesini kontrol et.
- Delik çok küçükse (w < 0.15) dalış bulanık büyür; elementi büyüt.
- **Basık delik de olmaz** (EP005): pullback ölçeği `max(1/w, 1/h)`; dikey karede h küçük kalır. Gözlük camı (ekranın %18 × %9'u) ve eğik ayna
  yüzü (%70 × %8) ≈ 11× ister → kullanılamadı. Çözüm: (a) düz `frame` kutusu (`{x, y, w: 0.42, h: 0.42}`, giden sahnenin 9:16 oranı) ya da
  (b) eşleşen düz kesme + sahne içi kamera geri çekilmesi: vox `camera.from` = deliğin merkezine `{x: hx − 0.5, y: hy − 0.5, zoom: 3.6}`,
  `to` zoom 1, `ease: heavyOut`, `moveAt 150`, `moveMs 2400`; deliğe gelen sahnenin son görüntüsünü `fill` olarak ver (EP005 s12, EP006 s14).
- Vox kamera formülü (hedef kutusu hesabı): ekran = 0.5 + zoom·(p − 0.5 − cam.x) (y için aynısı). Bir noktayı ekranda s'ye getirmek için
  cam = p − 0.5 − (s − 0.5)/zoom. Foto stilleri (PhotoMotion): ekran_px = odak·W + zoom·(u − odak)·dw (dw = cover ölçekli görsel genişliği).

### 3.4 Bulut elementleri (delik yok)
`clouds-bank`, `clouds-tower`, `clouds-wall`, `clouds-puffs`: vox `clouds` katmanında `items[].element`. build_timeline `image/size`'ı ekler.
Ön düzlem için `clouds-wall` (dikey, kareyi kaplar), orta `bank`/`tower`, uzak `puffs`. Önden geçen ince bulut (paralaks): `puffs`,
depth 1.15, `drift` 0.05, `blur` 6, opacity 0.5, `grow` ~1.2 (EP006 s11).

## 4. Kapakta derinlik
Tarif: `vox-explainer.md §9`. Zemin 0.55 + kâğıt 0.75 bulanık, ana nesne 1 net, element 1.05 ana nesnenin önünden geçer; `dof.amount` 22.

## 5. Kontrol
- Tek kare: `remotion still` `--scale` OLMADAN (bitiş katmanının backdrop blur'u küçük ölçekte bozulur), sonra ffmpeg ile küçült.
- Bakılacaklar: odak nesnesi net, arka bulanık ama okunur, ön nesne ana nesneyi tamamen örtmüyor, doldurulmuş alan görünmüyor, ışık sarması
  hale gibi durmuyor.


## 3. Derinlik haritalı 2.5D (DepthPhoto, 2026-11-11)
İki katmanlı `photo_planes.py` tek ana nesnesi olan fotoğrafta iyi; manzara, kalabalık, nehir gravürü gibi kesilecek tek nesnesi olmayan görüntüde
derinlik haritası kullan: her piksel kendi derinliğinde kayar.
- Harita: `voice/.venv-chatterbox/bin/python tools/depth_map.py <foto> --out-dir <bölüm>/assets/depth --preview` → `<ad>.depth.png` (16 bit, yakın = beyaz),
  ~7 sn/foto (CPU). Model **Depth Anything V2 Small** (Apache 2.0, ~100 MB, HF önbelleği). **Base/Large CC BY-NC 4.0 → ticari kanalda kullanma.**
- Kompozisyon `DepthPhoto` (`studio/src/styles/depth/DepthPhoto.tsx`, 1080×1920): görüntü 400 bölümlü düzleme giydirilir, harita köşeleri kameraya iter
  (`strength`, görüntü yüksekliği = 2 birim), perspektif kamera `from` → `to` (`dist`, `x`, `y`; inertia), bakış noktası orta derinlikte (ön ve arka zıt kayar).
  `focus {x, y}` kadraj merkezi (görüntü 0-1). Uzak kısım hafif koyulaşır (hava perspektifi), vinyet + tane.
- Deneme (EP013 s02 Waud gravürü): `strength 0.4, focus {0.5, 0.6}, from {dist 3.0, x −0.12}, to {dist 2.35, x 0.12}`, 170 kare.
- Tuzaklar: kamera fazla yakın/geniş başlarsa düzlemin kenarı kadraja girer (ilk denemede alt kenarda koyu şerit) → `dist`/`focus` ile kontrol et, ilk ve son kareye bak.
  Derinlik kırılmalarında (at başı/duvar) hafif esneme olur; `--blur` ve küçük `strength` (≤ 0.45) bunu sınırlar, yanal kaymayı ±0.15'te tut.
- **Güçlü deneme (strength 0.55, yanal ±0.26, orbit 10°, arka bulanıklık `dof {focus 0.5, amount 6}`):** paralaks belirgin ama çatıdaki figürlerin ve
  bayrağın kenarında esneme/hayalet izler oluşuyor (tek düzlem derinlik kırılmasında üçgenleri gerer). Hafif hâli (0.4, ±0.12, orbit 0) temiz ama kullanıcı
  "pek fark göremedim" dedi.
- **Çok katmanlı mod (önerilen, kullanıcı "derinlik olmuş" dedi):** `tools/.venv-matte/bin/python tools/depth_layers.py <foto> <ad>.depth.png --out-dir <bölüm>/assets/depth --cuts 0.2,0.8 --preview`
  → `L0.jpg` (en uzak, öndekilerin yeri Telea ile doldurulur), `L1..png` (alfalı dilimler, 3 px taşma, yumuşak kenar), `<ad>.layers.json`. DepthPhoto props'una
  `layers` (json'daki liste) verilince düz kartlar dizilir, başlangıç kamerasından hizalı (uzaklıkla ölçek, 1.1 taşma payı), bulanıklık kart başına.
  EP013 s02: `strength 0.6, from {dist 3.0, x −0.26}, to {dist 2.35, x 0.26}, orbit 10, dof {focus 0.49, amount 5}`.
  **Sınırları elle seç:** ana nesne (tekne + çatıdaki insanlar) tek dilimde kalmalı. Otomatik k-means sınırı (0.30/0.64) insanları gövdeden ayırdı;
  önizlemeye bak, gerekirse `depth.png`'den örnek değer ölç (insanlar ~0.27, gövde ~0.42, atlar ~0.52 → kesim 0.2 ve 0.8).
  Kalan kusur: dolgu (L0) bulanık bir leke olarak arkada hafif görünebilir; arka bulanıklık bunu örter.
- **Videoya bağlama (EP013 s02, 2026-11-11):** sahne `style: depth-photo`, `props: {comp: "DepthPhoto", video: "episodes/<EP>/assets/depth/<sid>.mp4",
  compProps: {image, depth, layers, strength, focus, from, to, orbit, dof}}` → `tools/woodcut_render.py <EP> --only <sid>` (sahne süresiyle klip), ana video oynatır
  (registry `depth-photo` → WoodcutClip). Düzeltmede `tools/render_patch.py <EP> --scenes <sid> --base render/<eski>.mp4 --out render/<EP>.mp4`.
- **Mevcut stil içinde derinlik kartları (EP014 v5, 2026-11-12; kurgu ve süre aynı kalsın diye sahne DepthPhoto'ya çevrilmedi):** `depth_map.py` →
  `depth_layers.py --n 3` (gerekirse `--max 2400`, varsayılan boyut korunur) → **L0 + L1/L2 kartları mevcut stile verilir**:
  - archival-film / ken-burns-photo (PhotoMotion): `image` (ya da `cuts[].image`) = `L0.jpg`, `planes: [{image: L1.png, k: 1.25}, {image: L2.png, k: 1.55}]`.
    Paralaks yalnız kamera `from→to` farkından doğar: yatay kayma ekle (s03: x 0.49→0.55). Büyük kamera hareketinde k küçük (s07 zoom 1→1.4: k 1.12/1.28).
  - Renk/ton kopyalı cut (s07 sepya → mavi kepli kopya): aynı derinlik haritası ve **aynı `--cuts`** ile kopyaya da `depth_layers` çalıştır → maskeler birebir.
  - vox-explainer `print`: `image = L0`, `planes: [{image, k}]`, `planeDrift` (0.05) → kartlar fotoğraf alanında girişten 6 sn boyunca kayar; kâğıt rengi siluet + çarpma
    ile basılır (kenar, bant, gölge sabit). s04 Isabella gravürü, s05 Davy portresi.
  - **Kesik (cutout) çıkartmada çalışmadı:** saydam çıkartmanın beyaz kenarı ve bir kısmı uzak dilime (L0, opak jpg) düştü → kara delik/kopuk kenar. Çıkartma tek
    düzlem kalır (vox `depth` paralaksı yeter). Gerekirse `photo_planes.py` ile önce kesik, sonra kendi içinde katman denenebilir (denenmedi).
- (eski not) İlk deneme sırasında ana videoya bağlanmamıştı: object3d gibi klip yolu (`woodcut_render.py`'ye `style` eklemek) ya da ken-burns-photo'ya `depth` prop'u, kullanıcı onayından sonra.
