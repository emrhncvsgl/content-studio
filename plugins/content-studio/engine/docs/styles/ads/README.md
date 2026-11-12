# Reklam / tanıtım video skill'leri (seçki)

2026-11-10'da GitHub'daki reklam/tanıtım videosu skill'leri yemek tanıtımı (`food-promo`, Mana kanalı) için incelendi. Dosyalar WebFetch ile okundu:
**repo klonlanmadı, paket kurulmadı, kod kopyalanmadı.** Yalnız kurallar ve tarifler (süre, eğri, katman, ses eşlemesi) kendi sözlerimizle
çevrildi. Telif ve lisans bildirimleri: [LICENSES.md](LICENSES.md).

Çıktılar:
- [transitions.md](transitions.md): geçiş ve plan tarif kataloğu (18 geçiş + 8 plan/vurgu tarifi; kaynak kodlu).
- [../food-promo.md](../food-promo.md): stil rehberi (`_TEMPLATE.md` düzeninde).
- `.studio/plugin/skills/remotion-styles/food-promo.md`: ajan talimatı.

Lemo seçkisiyle aynı ilke (`.studio/plugin/library/lemo/README.md`): **hattını değil kurallarını** alıyoruz. Bu skill'lerin hepsi kendi uçtan uca hattını
(tarayıcı yakalama, ElevenLabs/Kokoro ses, Suno müzik, Freesound indirme, kendi Remotion şablonları) kuruyor; bizim hattımız (`/shorts`, `ManaPromo`,
`sound-design`, `camera.md`) zaten var. Çoğunun ana konusu yazılım ürünü/arayüz tanıtımı; arayüze özgü tarifler (imleç, panel girişi, HUD, sayaç,
glitch, ekran kaydı) alınmadı.

## Kaynaklar

| Kod | Repo | Commit (okuma tarihi) | Lisans | Okunan dosyalar |
|---|---|---|---|---|
| SC | [Vincentwei1021/video-shotcraft](https://github.com/Vincentwei1021/video-shotcraft) | `3ac67b7` (2026-11-09) | Apache-2.0, © 2026 Wei Yihao | README, `references/aesthetic-rules.md`, `sound-design.md`, `music-beat-sync.md`, `references/shots/`: transition (shot-transitions, transition-hidden-cut, circle-match-iris, transition-travel, wipe-transitions, white-flash-logo-simplify-cut), camera (crash-zoom-punch, depth-layer-moves), effects (spotlight-sweep-moves, light-play-moves, impact-feedback), rhythm (beat-cut-moves, speed-ramp-freeze), typography (blur-slide, type-entrance-moves), outro (logo-shrink-wordmark-lockup, grain-dissolve), `ATTRIBUTION.md` |
| RA | [Maartenlouis/remotion-ads](https://github.com/Maartenlouis/remotion-ads) | `8c77946` (2026-05-06) | MIT, © 2025 Maarten van Onoesen | README, SKILL.md, `references/formats.md`, `ohneis-style.md`, `animations.md`, `natural-transitions.md`, `ad-copywriting.md`, `sound-effects.md`, `music.md` |
| PF | [merx666/product-promo-film](https://github.com/merx666/product-promo-film) | `dd4798d` (2026-10-23) | MIT, © 2026 Liangliang Chen | README, `references/styles.md`, `motion.md`, `director.md`, `audio.md` |
| CS | [1weiho/cinematic-shot](https://github.com/1weiho/cinematic-shot) | `32d5067` (2026-10-29) | MIT, © 2026 Yiwei Ho | README, `skills/cinematic-shot/SKILL.md` |
| — | [cliprise/awesome-ai-video-generator-prompts](https://github.com/cliprise/awesome-ai-video-generator-prompts) | — | lisans belirtilmemiş | README "Restaurant food video" örneği; **yalnız fikir**, metin alınmadı |

Notlar:
- SC'nin tarif kartlarının bir kısmı başkalarının yayımladığı hareket işlerinden "yalnız referans, sıfırdan yeniden yazılmış" (SC `references/shots/ATTRIBUTION.md`;
  soyut hareket yöntemi alınır, görsel/marka/metin alınmaz). Biz de yalnız yöntemi (zamanlama, eğri, katman) aldık.
- SC'de NOTICE dosyası yok (2026-11-10'da 404). SC değerleri çoğunlukla gri/yer tutucu görsellerle ayarlanmış; ilk gerçek kullanımda doğrulanmalı.
- PF README "12 kesme, 15 kamera hareketi" diyor; `director.md` 11 kesme türü ve 8 + 4 kamera hareketi listeliyor, süre vermiyor. Biz listedekileri aldık.
- RA'nın `natural-transitions.md` dosyası görsel geçiş değil, metin bağlaçları; geçiş tarifi oradan çıkmadı.
- Commit/tarih okuma anındaki `main` başı; değerler o sürüme göre.

## Her kaynaktan ne alındı

| Kaynak | Alındı | Nereye | Alınmadı (neden) |
|---|---|---|---|
| SC | Gizli kesme üç biçimi (ön plan örtüsü, ışık sızması; çarpışma değil), çapa ortak iris, harf deliğinden dalış (`30^u`), whip fren eğrisi + hız bulanıklığı formülü, maske penceresi (içerik ve pencere aynı `t`), crash zoom (6 kare, iki son), spotlight sweep, parıltı bandı, vuruş montajı, hız rampası/donma, blur-slide, logo kilidine çöküş, beyaz flaş; estetik kurallar R1-R4, Q3-Q5, Q9, Q11, S1-S5; vuruş ızgarası yöntemi ve kabul eşikleri; efekt gecikme telafisi (AAC ≈ 1.28 kare) | `transitions.md` T01-T15, P02, P06, P08; `food-promo.md` §5-§9 | UI giriş/etkileşim/veri kartları, HUD, combo sayacı, anime negatif kare, glitch, harf düşmesi (yemekte çocuksu), Freesound indirme hattı, JianYing dışa aktarma, Workbench |
| RA | Instagram Reels güvenli alanları (üst 285, alt 400, sol 80, sağ 120; 4:5 ve 1:1 önizleme bantları), 4 sahneli 15 sn yapı ve sahne süreleri, Ohneis vuruş şablonu (sert kesme, kare türü dönüşümü, giriş vuruşu 4 kare 0.92 → 1, popIn yayı), yay presetleri, Ken Burns oranları, vinyet, müzik/efekt/anlatım seviyeleri ve ducking eğrisi, efekt-an tablosu, kanca ve CTA kalıpları, yazı ≥ 48 px | `food-promo.md` §4-§7, §11; `transitions.md` T13, T16, P01, P07, P08 | ElevenLabs/Suno/Gemini betikleri, URL'den sahne çıkarma, carousel, ücretli reklam metinleri, AI görsel üretimi (yemekte gerçek görüntü kuralı) |
| PF | natural-fresh (yemek/içecek için önerilen stil: sıcak "sunlit" ton, bloom 0.06, gren 0.14, LUT %50 karışım), gentle-story hareket dili (1.6 sn yükselme, bulanıktan yazı, 2 sn Ken Burns, yavaş dolly, ≤ 95 BPM), kesme türleri ve kullanım kuralı (bölüm başı tasarlanmış kesme, ifade için dip/blur/light), kamera hareket değerleri (push %5, pan 70 px), ses yoğunluğu (~10/dk, 2 sn'de bir), ducking −11 dB 80/450 ms, −14 LUFS / −1 dBTP | `food-promo.md` §2-§3, §5, §7; `transitions.md` T03, T06-T09, T16, T17 | Playwright yakalama, Kokoro ses, sentez efekt motoru, kendi HTML/JS motoru, 16:9 film şablonu |
| CS | Çekim planı alanları (#, kesme anı, süre, odaktaki konu, ölçek, açı, hareket, eylem), eylem kesmeden 0.3-0.8 sn sonra başlar, sonuç 0.5-1 sn tutulur, kamera hareket ederken kes; kamera hiç durmaz/sarsılmaz; netlik kayması 0.4-0.8 sn; kapanış kopyası (16 px bulanıktan, 3-5 sn) ve durağan logo | `food-promo.md` §5-§6, §11; ajan talimatı §1 plan listesi | Arayüz eğik yakın planları ve ışık havuzu kuralları (UI'a özgü) |
| cliprise | Restoran yemeği istem şablonundaki kısıt fikri (yazı yok, doğal olmayan yemek hareketi yok, eğri tabak yok; sıcak restoran ışığı, makro yakın plan) | `food-promo.md` §9 (stok arama/brief kısıtı) | Metnin kendisi (lisans yok); AI video üretimi |

## Uyarılar
- Bu kaynaklar 16:9 ve ürün/UI odaklı; değerleri 9:16 ve gerçek yemek görüntüsüne çevirirken ölçek (px) kare yüksekliğine göre yeniden hesaplandı
  (ör. SC 1080p yazı eşiği %5.2 → 1920'de ≈ 100 px).
- Kanal kuralları kazanır: gerçek görüntü (AI yemek videosu yok), `assets.csv` lisans kaydı, kanal müziği ve CC0 efekt havuzu (`sound-design`),
  tek ağır iş kuralı.
