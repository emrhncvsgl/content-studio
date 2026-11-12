# food-promo — uygulama talimatı (ajan için)

Öğretici anlatım: `docs/styles/food-promo.md`. Tarif kataloğu: `docs/styles/ads/transitions.md` (T01-T18 geçiş, P01-P08 plan/vurgu).
Kaynaklar/lisans: `docs/styles/ads/README.md`. Kamera eğrileri: `camera.md` (çelişkide camera.md). Ses: `sound-design` skill'i.
Durum (2026-11-10): ortak bileşen yok; tek uygulama bölüme özel `studio/src/compositions/ManaPromo.tsx` (MANA001 v2).

## 0. Sert kurallar (ihlal = yeniden yap)
1. Yalnız gerçek video/fotoğraf. AI üretimi yemek görüntüsü yok. Yemek bükülmez, orantısız ölçeklenmez, rengi maviye/griye kaymaz, doygunluk ≤ +%10.
2. Önemli yazı, logo, rozet ve CTA güvenli dikdörtgende: **x 80-960, y 285-1520** (Reels: üst 285, alt 400, sol 80, sağ 120 px). Logo ve ürün adı
   mümkünse y 420-1500 (1:1 ızgara önizlemesi).
3. Dikiş başına tek geçiş. Aynı tarif videoda en çok 1-2 kez. Tam kare vurgu (flaş, sarsıntı, punch) toplam ≤ 3. Işık efekti (sızma, spotlight, parıltı) ≤ 2.
4. Erime (T16) ve kararma yalnız bilerek: storyboard'da nedeni yazılı (zaman atlaması, nefes). Varsayılan geçiş dünyanın içinden (ışık, buhar, nesne, kamera).
5. Kamera hiç tamamen durmaz (son 1 sn CTA kuyruğu hariç); el kamerası sarsıntısı yok.
6. Tek kahraman yemek, tek hero an (iniş + buhar + bir parıltı). Hero plan ≥ 2.5 sn; marka adı ≥ 1 sn durgun; kapanış kuyruğu ≥ 1 sn.
7. Ana yazı ≥ 96 px, ikincil ≥ 48 px; CTA en küçük satır değil. Sahne başına 1-3 kelime.
8. Her görüntü olayının foley'i var ya da storyboard'da "bilerek sessiz" yazılı; tam kare vurgu sessiz kalmaz. Ses görüntü kilitlendikten sonra yerleşir.
9. Her görsel/video/ses `assets.csv`'ye lisansıyla; filigran ve başka marka logosu yok.

## 1. Adımlar
1. **Brief:** kanal `channel.yaml` (`brand.colors`, `font`, `cta`, `formats.short`), süre 15-30 sn, anlatım var mı, müzik var mı.
2. **Yapı seç** (§3 çeşitlilik): kanca 1-2 sn → köken → pişirme → hero → marka kartı + CTA. RA 4 sahne: kanca 2-4 / merak 3-5 / yemek 3-5 / CTA 2-4 sn.
3. **Plan listesi** (CS alanları, storyboard tablosuna): `# · kesme anı · süre · odaktaki konu · ölçek (geniş/orta/makro) · kamera (P01-P02) · eylem · ses`.
   Eylem kesmeden 0.3-0.8 sn sonra başlar, sonuç 0.5-1 sn tutulur, kamera hareket ederken kes. Ölçeği editör gibi değiştir (geniş → makro → hero geniş).
4. **Dikişlere tarif yaz** (§2 seçim kuralı): her kesme için transitions.md'den tarif kodu + süre + ses. Tablo örneği MANA001 `storyboard.md` "Geçişler".
5. **Varlıklar:** stok video 4K dikey öncelikli (punch/dalış için kırpım payı), buhar videosu siyah zeminde, tabak kesiği iki ışık sürümü + yemek maskesi
   (`rembg`/SAM), renk ayarı `promo_prep.py` deseniyle (sıcak, doğal). `assets.csv`.
6. **promo.json:** `cuts` (kesme saniyeleri), `cues` (anlatım kelimesi ya da olay saniyeleri: `land`, `whip`, `buhar`, `cta` …), `scenes` (yazılar).
   Anlatım varsa kelime zamanları Whisper'dan (video saniyesi = ses + gecikme). Müzikli hızlı montajda kesmeler vuruş ızgarasından (food-promo.md §7).
7. **Render:** önce tek kareler (`node render_promo.mjs <bölüm> --stills=...`): her dikişin tam örtü karesi, hero, kart, CTA. Sonra tam render (tek ağır iş).
8. **Ses:** foley + müzik + (varsa) anlatım miksi, −14 LUFS / −1 dBTP; efekt tablosu `cue + ofset` ile.
9. **Kontrol listesi** (§4), kullanıcı izler (ONAY 3).

## 2. Tarif seçimi
- Değişim türüne göre aday (transitions.md "Hızlı seçim"): köken → pişirme T01/T02/T05; pişirme → masa T03/T04/T07; yemek → kart T08/T10/T18;
  ölçek değişimi T06/T09/T12; müzikli montaj T13/T14.
- Aday arasından: (a) giden ve gelen planda **gerçekten var olan** bir köprü (ışık noktası, örtü nesnesi, delik, yuvarlak nesne) olanı seç; köprü yoksa
  kamera hareketi (whip, dalış) ya da düz kesme. (b) Enerji eğrisine uy: kancada ve hero öncesinde yüksek, kartta sakin. (c) Bir önceki dikişle aynı aile
  (ışık/örtü/kamera/iris) art arda gelmesin.
- Sayım: her tarif ≤ 2; T07+P06+T11 toplamı ≤ 2; T12+T14+sarsıntı toplamı ≤ 3 (aralarında ≥ 16 vuruş ya da ≥ 5 sn).
- Değerler kaynak değerleridir; 6-8 sn deneme ya da tek kare ile doğrula, değişeni storyboard'a yaz.

## 3. Çeşitlilik tablosu (aynı kanalda art arda iki klip aynı satırı kullanmaz)
| # | Kanca | Köken → pişirme | Pişirme → hero | Bitiş |
|---|---|---|---|---|
| 1 | köken manzarası + yer adı (MANA001) | T02 ön plan + T04 dalış | T03 buhar | T08 iris + T10 çöküş + P07 rozet |
| 2 | yemeğin makrosu, cızırtı | T01 ışık noktası | T07 ışık sızması | hero planda kalır, marka kilidi + CTA |
| 3 | eylem ortası (bıçak, döküm) | T05 whip | T09 nesne kadrajı doldurur | kapanış kopyası (P08 sinematik) + logo |
| 4 | Ohneis vuruş: yazı kartı ↔ görüntü | T13 vuruş montajı | T14 sıcak flaş | T18 düzen dönüşümü + CTA |

## 4. Kontrol listesi
- [ ] 1080x1920, 30 fps, H.264; süre 15-30 sn (`formats.short`).
- [ ] Güvenli alan: kılavuzlu tek kare (üst 285, alt 1520, sol 80, sağ 960 çizgileri) her yazılı sahnede; CTA ve logo içeride.
- [ ] Kanca ilk 1-2 sn'de: yemek ya da kökenin en güçlü karesi, yer/ürün adı okunur.
- [ ] Her dikişte tek tarif; sayımlar (tarif ≤ 2, tam kare vurgu ≤ 3, ışık efekti ≤ 2); erime/kararma varsa nedeni yazılı.
- [ ] Gizli kesmelerde tam örtü karesi render edilip bakıldı (arka plan kenarı görünmüyor).
- [ ] Yemek: renk doğal ve sıcak, bükülme yok, parıltı yemek maskesinin dışına taşmıyor, buhar koyu zeminde görünür.
- [ ] Hero ≥ 2.5 sn, marka adı ≥ 1 sn durgun, kapanış ≥ 1 sn kuyruk; kamera son kuyruk dışında akıyor.
- [ ] Yazı boyları (≥ 96 / ≥ 48 px), sahne başına ≤ 3 kelime, marka fontu ve renkleri.
- [ ] Ses: olay–ses tablosu tam; tam kare vurgular sesli; anlatım altında ducking; −14 LUFS, −1 dBTP; ilk 2 karede vurgu yok.
- [ ] Müzikli montajda kesme–vuruş sapması ≤ 3 kare (render edilmiş sesten ölç).
- [ ] `assets.csv` eksiksiz; filigran, başka marka, tanınmış kişi yok.

## 5. ManaPromo ile kullanım (MANA001) ve eksikler
- **Kullanım:** `content/episodes/MANA001-gokceada-kuzu-tandir/clips/promo.json` + `studio/src/compositions/ManaPromo.tsx`; hazırlık/render/miks komutları
  MANA001 `storyboard.md` sonu ("Render"). Kompozisyon 6 sahneye ve MANA001 tariflerine sabit: `cuts` 7 eleman, `cues` adları (`whip`, `land`,
  `parlar`, `buhar`, `t_gokceada`, `t_kuzu`, `t_tandir`, `kasim`, `mana`, `cta`, `gokceada_word`). Yeni bölüm için kopyalayıp sahneye uyarlamak gerekir.
- **v2'de kurulu tarifler:** T02 (ot örtüsü) + T04 (log dalış), T01 (ışık noktası → kor, P05 kıvılcım), T06 (kıvılcım bokeh → kor), T05 (whip tilt),
  T03 (duman), P03 (tabak inişi), P04 (iki katman buhar), P06 (yemek maskeli parıltı + başlık parıltısı), T08 (lacivert iris) + T10 (tabak karta),
  T18 (kart düzeni), P07 (rozet + halka), P08 (satır yayı, CTA).
- **Bilinen sorun (v2):** CTA merkezi y=1600 ve başlık şeridi y≈195-305 Reels arayüz bölgesinde (kural 2). Düzeltme bu dosyanın işi değil; sonraki
  render'da ele alınmalı.
- **Sonraki bölümde kurulacaklar (öncelik):**
  1. Ortak kit `studio/src/styles/food-promo/`: tarifleri bileşen yap (`LightMatch`, `OccluderWipe`, `SmokePass`, `PlateDrop`, `SteamLoop`, `Sheen`,
     `IrisFromObject`, `Badge`, `Cta`) ve `promo.json`'a sahne listesi + dikiş başına tarif kodu (`"seam": {"kind": "T03", "ms": 800}`) koy; sahne sayısı serbest.
  2. Güvenli alan kılavuzu (`--guides` render seçeneği) ve yazı kutularını x 80-960 / y 285-1520'ye karşı denetleyen kontrol.
  3. Vuruş ızgarası aracı (`tools/beat_grid.py`, librosa zaten venv'de): BPM/t0/T uydurma, kalıntı, `beatF(n)`; render sonrası sapma raporu.
  4. Footage üzerinde zamanlı odak (`settle`/`hunt`, `camera.md §7`) ve gerçek hareket bulanıklığı (alt-kare, `@remotion/motion-blur` kurulu; parlak karede
     renk kaymasını test et).
  5. Bitiş katmanı: LUT benzeri sıcak ton (%50 karışım) + T07 ışık sızması bileşeni (`Transitions.tsx` `leak` değerlerini tarife çek).
