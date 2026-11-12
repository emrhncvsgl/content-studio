# Derinlik ve elementler — nasıl çalışıyor

Bu dosya senin için: düz görsellerden nasıl "gerçek derinlik" hissi yarattığımızı ve element kütüphanesinin mantığını anlatır.
Ajanın uyguladığı kurallar ayrı dosyada: `.studio/plugin/skills/remotion-styles/depth-elements.md`. Herhangi bir stilde kullanılabilir
(vox kolajı, fotoğraf, arşiv, kapak).

## 1. Derinliği ne yaratır?
Ekran düz; derinlik hissini beyne birkaç ipucu verir. Hepsini birlikte kullandığımızda (EP004) etki belirgin oldu:

| İpucu | Terim | Bizde |
|---|---|---|
| Yakın şey uzaktakinin önünden geçer | *occlusion / overlap* | kapakta büyüteç sapı merceğin önünde; elementler kesiklerin üstünde |
| Kamera hareket edince yakın şey daha çok kayar | *parallax (2.5D)* | her katmanın `depth` değeri; fotoğraflarda ayrılmış ön plan |
| Odak dışı şey bulanıktır | *depth of field* | arkadaki kâğıt ve zemin bulanık, anlatılan nesne net |
| Işık nesnenin kenarına sarılır | *light wrap* | kesiklerin kenarına zeminin ışığı sızar |
| Nesne yüzeye gölge düşürür | *contact / drop shadow* | iki katmanlı gölge (dar koyu + geniş yumuşak) |
| Masa bize doğru eğiktir | *perspective / tilt* | kamera `tilt` ve `turn` |

Kural: her sahnede üç düzlem düşün: arka (zemin, bulanık), orta (ana nesne, net), ön (kameraya yakın bir nesne).

## 2. Tek fotoğraftan derinlik (2.5D parallax)
Joe Fellows'un klasik yöntemi: fotoğraftaki ana nesne kesilir, arkada kalan boşluk doldurulur (*inpainting*), ikisi ayrı katman olur.
Kamera yaklaşırken öndeki katman arkadakinden hızlı büyür. EP004'te fener kulesi ve mercek böyle yapıldı.
- İyi çalıştığı yer: tek, belirgin nesne (kule, heykel, mercek, kişi).
- Çalışmadığı yer: camın ya da ağın içinden bakılan sahneler; ön planı olmayan manzaralar.
- Kamera içeri itmeli: geri çekilirse doldurulmuş alan görünür.

## 3. Element kütüphanesi
**Element**, arka planı kaldırılmış yüksek kaliteli bir nesne fotoğrafı: çerçeve, büyüteç, mercek, pencere, kapı, kart. İki işe yarar:
1. **Derinlik:** Sahnede ön düzlemde durur, kesiklerin üstünden geçer.
2. **Geçiş kapısı:** Her elementin bir "deliği" (cam, pencere, çerçeve içi) ölçülüp kaydedilir. Geçişte kamera bu delikten dalar
   (*portal*) ya da yeni sahne bu deliğin içinden geri çekilerek açılır (*pullback*). Delik bilinçli olduğu için hedefi elle ölçmeye gerek yok.

Kütüphane bölümden bölüme büyür. Liste: `content/assets/elements/README.md`. Önce kamu malı ya da CC0 nesneler (müze koleksiyonları,
Commons). Sonraki adım: gerçek fotoğraflanmış oyun/tarot kartı (kart çevirme için), pencere, kapı, anahtar deliği, polaroid.

### Çerçevede kalma (dolgu)
Pullback ile bir görüntü çerçevenin içine küçülüyorsa, çerçevenin içine aynı görsel kalıcı olarak da konur (*fill*). Hareketli görüntü
geçişin sonunda bu kalıcı görüntüye yumuşakça karışır. Dolgu olmazsa görüntü bir an kalıp kaybolur (EP004'te ilk denemede olan buydu).

## 3.5 Hangi araç ne yapıyor?
Derinliğin temeli **arka plan kaldırma** (*background removal / matting*): fotoğraftaki nesneyi zemininden ayırmak. Bunu yapay zekâ modeli
**rembg** yapıyor; içinde birkaç model var (nesne için *IS-Net*, ince kenar için *BiRefNet*, kişi için *U²-Net human*). Bizim araçlarımız
bu modeli farklı işler için sarıyor:

- **`tools/cutout.py`**: Nesneyi keser, boş kenarları kırpar. `--sticker` ile etrafına yırtık kenarlı kâğıt ekler; vox kolajındaki
  "kâğıttan kesilmiş" fotoğraflar böyle yapılıyor. Kapaktaki yakıcı mercek bununla kesildi.
- **`tools/photo_planes.py`**: Fotoğrafı ikiye ayırır: kesilmiş ön plan ve ön planın boşalttığı yeri doldurulmuş arka plan.
  Doldurmayı OpenCV'nin *Telea inpainting* yöntemi yapıyor (çevredeki pikselleri boşluğa doğru yayıyor). Fener kulesi ve mercek böyle
  katmanlandı.
- **`tools/make_sticker.py`**: Yalnızca kâğıt arkalığı ekler (zaten kesilmiş görsele).
- **`tools/matte_video.py`** (*SAM 2*, Meta'nın modeli): Videoda bir nesneyi kare kare takip edip keser; saç gibi zor kenarlarda da
  kullanılır. Ona nesnenin üstüne birkaç nokta tıklayarak "bu" diyorsun (*point prompt*).

Elementler (büyüteç, çerçeveler) de rembg ile kesildi; sonra deliklerinin yeri ölçülüp kaydedildi.

## 4. Terimler
- **2.5D parallax**: düz katmanların farklı hızda kayarak 3B hissi vermesi.
- **occlusion / overlap**: bir nesnenin diğerini kısmen örtmesi.
- **depth of field**: alan derinliği; **rack focus**: odağın bir katmandan diğerine kayması.
- **inpainting**: kesilen nesnenin arkasındaki boşluğu doldurma.
- **background removal / matting**: nesneyi zemininden ayırma; **alpha / mask**: şeffaflık katmanı.
- **light wrap**: arka plan ışığının kesik kenarına sızması.
- **element / hole**: geçiş nesnesi / içinden geçilen delik.
- **fill / handoff**: çerçevenin kalıcı içeriği / hareketli görüntünün kalıcı görüntüye devri.
