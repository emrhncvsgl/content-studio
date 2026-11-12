---
name: design-language
description: >
  Kanalın tasarım dilini kurar ya da değiştirir: görünüş/stil, kamera dili, geçişler, altyazı, renk paleti, font eşleşmesi, doku,
  ses kimliği, motifler ve yasaklar. Menüden seçtirir, 6-8 sn deneme klibiyle gösterir, sonucu channel.yaml `design` bölümüne yazar.
  /new-channel bunu adım olarak çağırır; kullanıcı "tasarım dilini değiştirelim", "kanalın görünüşü", "kamera dilini seçelim",
  "geçişleri sakinleştir", "yeni stil ekle" dediğinde tek başına da kullan.
argument-hint: "[kanal id] [yalnızca: looks | camera | transitions | captions | palette | type | sound]"
---

# /design-language: kanalın görsel ve işitsel kimliği

Amaç: kanalı kuran kişi (çoğu zaman tasarımcı değil) **adını bilmediği seçenekleri görerek** seçsin; seçimler ajanlar için
uygulanabilir kurallara dönüşsün. Her seçim `channel.yaml design` alanına yazılır; visual-director, editor ve sound-design her
bölümde bunu okur. Bölüm bazında sapma `brief.yaml` / storyboard'da açıkça yazılır.

Kanal: argümandaki id, yoksa kökteki `channel.yaml` (diğerleri `channels/<id>/channel.yaml`). Kısmi çağrıda (ör. yalnızca
`transitions`) yalnızca o bölümü yürüt, diğerlerine dokunma.

## 0. Menüyü al (tek komut, kısa çıktı)
```
python3 .studio/plugin/scripts/design_menu.py                  # tüm bölümler
python3 .studio/plugin/scripts/design_menu.py looks --json     # tek bölüm, ayrıntılı
```
`✓` = bizde Remotion'da hazır (hemen kullanılır) · `·` = tarifi var, ilk kullanımda bileşen yazılır (zaman alır; söyle).
Kaynak dosyaları **yalnızca seçilen seçenek için** aç (token bütçesi): stil tarifi `recipe` yolu, kamera/geçiş ayrıntısı
`.studio/plugin/library/cinecode/references/camera-moves.md`, görünüm parametreleri `.../cinecode/references/looks.md`,
font eşleşmesi `.../cinecode/references/type-library.json`, bizim kamera kurallarımız `.studio/plugin/skills/remotion-styles/camera.md`.

## 1. Önce kanalı anla (sorma, çıkar)
`channel.yaml` `about`, `audience`, `tone`, varsa örnek videolar/referans linkleri. Tonun **gerçek** karakteri tasarımı belirler:
meraklı bir hikâye her zaman dramatik değildir; yardım kuruluşu sıcak ve sakin ister; çocuk kanalı renkli ve yavaş okunur.
Kullanıcının beğendiği bir video varsa `/content-studio:style-study` ile ölç (kesim temposu, palet, LUFS) ve seçeneklere kat.

## 2. Seçim turları (her tur tek AskUserQuestion, en fazla 4 soru; önerdiğin ilk sırada, "(Önerilen)")
Her seçeneğin açıklamasına **ne hissettirdiğini** bir cümleyle yaz (camera-moves.md "What the viewer feels" sütunu). Teknik ad +
Türkçe karşılık birlikte (kullanıcı terimleri öğrenmek istiyor olabilir).

**Tur A: Görünüş** (cinecode yöntemi: aramayla bul, birbirine benzemeyen adaylar, gözle seç)
1. *Adayları bul*: kanalın `about`/`tone`/`audience` ve kullanıcının referanslarından 4-8 **İngilizce** anahtar kelime çıkar
   (konu, duygu, malzeme, dönem; ör. "charity hands community warm craft"). Kullanıcı bir ad verdiyse ("Vox gibi", "Ghibli")
   onu da kat (takma adlar eşlenir). Sonra:
   ```
   python3 .studio/plugin/scripts/design_menu.py looks --q "<kelimeler>" --pick 4
   ```
   Çıkan 4 aday farklı ailelerden gelir ve en az biri hazırdır (`✓`). Yalnızca hazır stillerle yetinme: tarifler (`·`) kanala daha
   özgün bir görünüş verebilir; maliyeti dürüstçe söyle (ilk kullanımda bileşeni yazılır, ~1-2 saat). Uymayan adayı
   `--q`'yu değiştirerek ya da `design_menu.py looks --q ...` (25 sonuç) listesinden elle değiştir; aynı aileden iki aday koyma.
2. *Panoyu göster* (yazıyla değil, gözle seçilir):
   ```
   voice/.venv-chatterbox/bin/python .studio/plugin/scripts/style_board.py <id1> <id2> <id3> <id4> \
       --out content/channels/<id>/design/board.jpg --title "<kanal>: görünüş adayları"
   ```
   Görseli kullanıcıya göster (Read ile kendin de bak; telefondaysa SendUserFile). Her aday için bir cümle: neye benzer, bu kanala
   neden uyar, hazır mı tarif mi. Sonra AskUserQuestion: A/B/C/D (+ "hiçbiri, başka yön"). Posterler yalnızca görüntüleme içindir
   (Lemo'nun deposundan, MIT sürümü), videoda kullanılmaz.
3. *Seçilen tarifi oku* (yalnızca o): `recipe` yolu (`STYLE.md`); hazır stilse `.studio/plugin/skills/remotion-styles/<id>.md`.
   Renk mantığı, malzeme, hareket kalitesi ve kamera buradan Tur B-C'ye taşınır.
4. *Karışabilenler (mix)*: hazır stilde `catalog/styles.yaml mix_with`; tarifte STYLE.md'nin önerdiği eşlikler. multiSelect.
5. *Görünüm ailesi*: cinecode 8 aileden (`families`) biri; tarifin `family` alanı varsa onu öner. Işık/ton/tane kararını verir.

**Tur B: Kamera ve kurgu**
1. *Kamera enerjisi*: `calm` (yavaş dolly, uzun plan, ease-in-out) · `measured` (karışık, nedenli hareket) · `energetic` (whip, hızlı
   push, kısa plan). Kanal tonuna göre öner.
2. *İmza hareketleri* (multiSelect, 2-4): `camera` menüsünden; büyük hamleler (dolly zoom, freeze frame, speed ramp) "nadiren" etiketiyle.
3. *Geçiş dili*: varsayılan bağ (düz kesme önerilir) + imza geçişler (multiSelect; `studio` kaynaklılar hazır: objectWipe, fog, portal…)
   + dakikada en fazla kaç tasarlanmış geçiş. Kural: aynı tasarlanmış geçiş art arda iki kez yok; her geçişin bir nedeni var
   (dissolve = zaman, whip = enerji, match = bağ).
4. *Yasak hareketler/geçişler* (multiSelect): ör. hızlı ardışık kesme patlamaları, pop-in, oyunsu efekt sesleri.

**Tur C: Yazı ve renk**
1. *Altyazı stili*: `captions` menüsü; telefonda okunurluk (≥ max(1.8 sn, konuşma + 0.6 sn)).
2. *Font eşleşmesi*: ana stile ve görünüm ailesine uyan 3 `type` eşleşmesi; dil Türkçeyse yalnızca `turkish: verified`.
   Seçilen fontu `tools/fetch_fonts.py` listesine ekle ve çalıştır (yalnızca OFL/açık lisans).
3. *Palet*: 3 aday palet (taban 2-3 renk + tek vurgu rengi + kural, ör. "vurgu yalnızca konuşulan kelime ve ana nesne").
   Marka rengi varsa onu vurgu yap.
4. *Doku*: kâğıt, ahşap, karton, film tanesi, temiz (multiSelect). Kaynak CC0 (ambientCG, Poly Haven).

**Tur D: Ses kimliği** (`.studio/plugin/skills/sound-design/SKILL.md` kurallarıyla)
1. *Müzik ruh hali* (multiSelect) · 2. *Müzik seviyesi* (varsayılan −19.5 LUFS dosya, anlatım altında; "müzik yok" seçeneği) ·
3. *Efekt karakteri* (gerçek kayıt önerilir; oyunsu "pickup" sesleri yok) · 4. *Sessizlik kullanımı* (vurgu öncesi kısa boşluk vb.).

Son olarak serbest metinle sor: **motifler** (kanala özgü tekrar eden öğe: bir nesne, bir renk şeridi, açılış hareketi) ve
**asla yapmadıklarımız** (klişeler: `looks.md §8 Visual clichés` listesinden öner).

## 3. Deneme klibi (6-8 sn, onayla)
Seçimlerle tek sahnelik bir deneme kur: ana stil + bir imza kamera hareketi + bir imza geçiş + altyazı + palet + font.
- Ana stil `✓` ise mevcut bileşenle `content/channels/<id>/design/` altında küçük bir timeline/kompozisyon yaz, render et
  (`npx remotion render ... --frames=0-239`); ağır iş, önce kullanıcıya sor.
- Ana stil yalnızca tarifse: önce `.studio/plugin/skills/style-study/SKILL.md` akışıyla tarifi `studio/src/styles/<id>/`
  bileşenine çevir (öğretici `docs/styles/<id>.md` + ajan talimatı `docs/styles/guides/<id>.md`, ikisi de projede; plugin
  klasörüne yazma), sonra klibi al. Bu uzun bir iştir; kullanıcıya süreyi söyle ve onay al.
Örnek kompozisyonları (`studio/src/Root.tsx`) varsayılan prop'larıyla render etme: varsayılanlar başka bir kanalın bölümlerini
gösterir, yeni kurulumda yoktur. Deneme klibi kendi `content/channels/<id>/design/` dosyalarıyla, `--props` ile alınır.
Klibi kullanıcıya göster (telefonda izleyecekse SendUserFile). Beğenmediği eksene geri dön, yalnızca onu değiştir.

## 4. Yaz
`channel.yaml design` alanını doldur (şema: `.studio/plugin/templates/channel.yaml`). Ayrıca:
- `styles.preferred` / `styles.avoid` / `styles.captions` ve `brand.colors` / `brand.font` alanlarını seçimlerle eşle.
- `design.summary`: tek cümle, ajanların her bölümde ilk okuduğu satır.
- `design.sample_clip`: deneme klibinin yolu.
- Uzun gerekçe ve reddedilen seçenekler `docs/DECISIONS.md` en üstüne (tarihli). Sonra `tools/validate.py` yoksa bile YAML'ı
  `python3 -c "import yaml,sys;yaml.safe_load(open('channel.yaml'))"` ile doğrula.

## Kurallar
- Efekt içeriğe hizmet eder: süs katmanı, gereksiz yazı/damga, her kesimde tasarlanmış geçiş yok.
- Çeşitlilik tek dil içinde: ardışık sahneler hareket, plan boyu ya da yönle ayrışır; dil sabit kalır.
- Başka bir kanalın imza görünüşünü (ör. bu stüdyonun TRIZ Academy kolajı) kopyalama; her kanal kendi tasarımını kurar.
- Lemo-Opuscar 2.0+ tarifleri kullanıcı kendisi kurduysa yalnızca onun kendi filmleri içindir; kütüphanemize kopyalanmaz.
