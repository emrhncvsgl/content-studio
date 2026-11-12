# paper-lantern: arkadan aydınlatılmış kâğıt kesik (In Your Hand uyarlaması)

Kaynak: Lemo-Opuscar `paper-lantern` (MIT, commit `143f387`), ham kurallar ve demo motoru `.studio/plugin/library/lemo/styles/paper-lantern/` (STYLE.md, DEMO.md,
demo-src/). Kullanıcı 2026-11-10'da In Your Hand kanalının stili olarak seçti ("onu bu kanala uyarlayabilirsin"). Bu dosya öğretici anlatım;
ajan talimatı `.studio/plugin/skills/remotion-styles/paper-lantern.md`.

## 1. Özü
Her plan TEK fiziksel nesnedir: sığ bir kutuda üst üste dizilmiş 6-9 kesik kâğıt katmanı, arkadan sıcak bir ışık. Işık kâğıttan süzülür
(hamur dokusu bulut gibi görünür), pencereler/ay/kandiller kesik deliklerden yanar, tepedeki küçük spot her katmanın gölgesini arkadakine düşürür.
İki çerçeve: **kutu** (lambanın kenarı görünür, "bu anlatılan bir hikâye") ve **tam kadraj** (lens kutunun içinde, kâğıt manzara ekranı doldurur).
- Ekrandaki her şey: kâğıt katman (tek düz renk, lif dokusu, üst kenarda ince ışık, alt kenarda koyu bant) · kâğıttan geçen ışık · gölge.
- **Derinlik = değer merdiveni:** arka katmanlar açık ve soğuk-yarı saydam, ön katmanlar koyu ve opak. Merdiveni bozma (açık ön katman kutuyu düzleştirir).
- Vox ile farkı: toz, halftone, kâğıt tanesi kaplaması, fotoğraf kesiği, el kamerası sallantısı, stop-motion YOK. Gerçek fotoğraf yok (saha bölümü ayrı: `footage`).

## 2. In Your Hand uyarlaması (kanalın kimliği)
- **Motif dili:** Lemo örneklerindeki Çin kâğıt kesik motifleri yerine İslam sanatının geometrisi: kemer ve mihrap çerçeveleri, maşrabiye/kafes pencereler,
  sekiz kollu yıldız ve girih kesik desenleri (ışık bunların deliklerinden yanar), fener (fanus) ve kandil, kubbe ve minare silüetleri, hurma ağaçları, kumullar,
  yelkenli (lateen yelken), kervan. Hilali her sahneye koyma; motif hikâyeye hizmet eder. Kemer çerçevesi sade kalır: kenarına yıldız kesiği dizilmez
  (kullanıcı 2026-11-10, LanternSea denemesi: "kenardaki yıldızlar olmasına gerek yok"); desen yalnız hikâyede işlevi varsa (ışığın geçtiği pencere).
- **Renk:** her yığının tek bir sıcaklığı var; ışık sıcak altın (#FFC670 civarı); vurgu rengi kanalın yeşili **#0C9066** (yalnız hikâyenin öznesi:
  yol çizgisi, varılan yer, logo). Merdiven örnekleri:
  - gece denizi: `#0a1430` gök → `#2c4a7a` uzak su → `#1d3560` orta dalga → `#0a1226` ön dalga; ay ve kandil `#ffd58a`
  - çöl alacakaranlık: `#f2c98e` gök → `#d08a58` uzak kumul → `#8a4a2a` orta → `#2a140a` ön; kervan ateşi/fener `#ffd080`
  - mescit içi: `#f3e2b8` arka pencere ışığı → `#b9925a` kemerler → `#5a3a1e` sütunlar → `#1c1008` ön kemer; vurgu yeşil halı/kapı
  - bugün (dünya): koyu yeşil yığın `#0E1A16` zemin → `#1f5a44` → `#0C9066` rota ışığı
- **Dini kurallar:** kanal profilindeki kurallar geçerli: Peygamber ﷺ hiç tasvir edilmez; sahabe yalnız KÜÇÜK, uzak, yüzsüz silüet (bu stilde zaten doğal:
  figür kesik siyah kâğıttır, eklemli, yüz çizgisi yok). Kitap/Kur'an sayfası kâğıt nesne olarak, yere konmaz.
- **Ses:** stilin "kâğıt ve ışık" foley'si (ışık yanınca hafif tık + yükselen parıltı, kâğıt hışırtısı/kayması, kart vuruşu) + sahne yatağı (okyanus, çöl rüzgârı,
  kum). Lemo'nun müzik önerisi (piyano, arp) bu kanalda YOK: enstrüman kullanılmaz; yalnız ortam + sözsüz insan sesi.
- **Altyazı:** stil sessiz, yanık serif altyazı ister (kâğıt kesik dünyada sarı kâğıt şeritler fazla "vox"). Bu kanalda `cap-serif` (sıcak kırık beyaz serif,
  yumuşak gölge, alt koyu bantta) — kurulacak. Kâğıt olarak görünen kelime altyazıda tekrar edilmez.

## 3. Hareket ve kamera (stile ait; genel kamera kuralları burada geçmez)
- Her şey "çubuktaki kâğıt" gibi: kayar, bir pimin etrafında döner, bir eksende büyüyerek "yazılır", ya da ışığı yanar. Esneme, morph, bükülme yok.
- Büyük hareket ışıktır: kaynak → katmanların saydamlığı 0.4 sn aralıkla → pencereler → titreşim (`1 + .06·sin(7.3t)·sin(3.1t)`).
- Kamera kısa hareket eder (kutu sığ): yavaş itme/çekme, katmanlar arası odak kaydırma, paralaksla yan yolculuk, katman yığınına tepeden bakış, kutudan
  çıkma/kutuya girme, ışık değişirken kilitli kadraj, yığında yukarı/aşağı tilt, ön katman perdesiyle silme, yanında seyahat (gemi/kervan).
  El kamerası titremesi en fazla ~0.6 mm (neredeyse yok); whip pan ve dijital zoom YOK.
- Geçişler: çözülme (0.5-1.2 sn), iris, ışık söner/yanar, yarıları tam buluşan ön katman perdesi.

## 4. Bu kanal için özgün hamleler
- **Kandil yanar:** bir mescit/ev penceresi karanlıkta tek tek yanar (bağış ulaştığında).
- **Aynı ışık, iki pencere:** tarihteki yol ile bugünkü proje aynı ay ışığını paylaşır (Habeşistan kıyısı ↔ Zanzibar sınıfı).
- **Derinlik = mesafe:** yol uzadıkça katmanlar derinlik oranında kayar (deniz ve çöl yolculuğu).
- **Kendini yazan kâğıt:** kelime sözlendiğinde kâğıt şerit kenarından büyür (ör. "Abyssinia", "inyourhand.org").
- **Açılan şeyden ışık:** bir kapı/kitap açılır, ışık taşar (Necaşi'nin sığınağı).
- **Kutudan gerçeğe:** son bölümde kamera kutudan çıkar, masadaki lambanın ışığı gerçek saha görüntüsüne açılır (`footage` köprüsü).

## 5. Tuzaklar (motor)
Lemo STYLE.md §9 aynen geçerli: delik kesmeden önce opak dolgu; gölgeye katılmayacak katmanda `shadow:false` VE `recv:false`; saydam radyal doku kare kenar
verir → analitik ışık (burst); perde yarıları ön kenarda buluşmalı; renk ayarı her karede varsayılana dönmeli (Remotion kareleri rastgele sırada render eder:
EP009 woodcut'ta aynı ders, `three-scenes.md`); ışık noktası kâğıt yazının üstüne gelmesin; altyazı bandı karanlık kalsın.

## 6. Motor (bizde)
`studio/src/styles/lantern/` (kurulacak): Lemo `paper.js` (sheet, paperMat, skyPanel, moon, burst, finish) ve `stage.js` (stage, aim) three.js + @remotion/three
üzerine taşınır; woodcut kitindeki gibi sahne ayrı kompozisyon olarak sahne süresinde render edilip ana videoda klip olarak oynar (`tools/woodcut_render.py`
kalıbı). DoF + bloom: `post.js` (kendi CoC/gather shader'ı + UnrealBloomPass).
