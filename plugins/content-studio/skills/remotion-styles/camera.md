# Kamera dili — ortak talimat (ajan için, her stil)

Öğretici anlatım: `docs/styles/camera.md`. Kod: `studio/src/components/ease.ts` (eğriler, `lerpScale`, `focusBlur`),
`components/Transitions.tsx` (geçişler), `styles/photo/PhotoMotion.tsx` (fotoğraf kamerası), `styles/vox-explainer/index.tsx` (`camAt`, `dofAt`).
Stil talimatları (ör. `vox-explainer.md`) kendi kadraj kurallarını ekler. Kamera değerleri burada; çelişkide bu dosya geçerli.

## 1. Eğriler (`ease`)
| Ad | Eğri | Nerede |
|---|---|---|
| `heavyOut` | bezier(0.2, 0.9, 0.1, 1): hızlı atılım + uzun süzülerek oturma (AE heavy ease-out, varış %90-100) | ağır yakınlaşma, zoom'lu geçişlerin oturması (varsayılan) |
| `snapOut` | bezier(0.05, 0.85, 0.06, 1): daha sert atılım, daha uzun kuyruk | sert vurgu |
| `heavy` | bezier(0.9, 0, 0.1, 1): ağır kalkış + ağır duruş | slide, `doc.moveMs`, kart çevirme |
| `expoOut` | 1 - 2^(-10t) | açılış itmesi (`push`), fosfor, sayaç |
| `sin` | easeInOutSine | sahne boyu yavaş kamera (varsayılan) |
| `cubic` | easeInOutCubic | rota çizimi, uzun harita kamerası |
| `backOut` | %10 taşma | `pin` |
Lineer yalnızca doku, toz, kesik çizgi.

## 2. Zoom
- Ölçek her yerde log uzayında karışır (`lerpScale`). 1→2 ile 2→4 aynı hızda algılanır. Yeni kodda ölçeği doğrusal karıştırma.
- Sahne boyu yavaş itme: zoom farkı 0.04-0.15 (Ken Burns). İstisna yalnızca §3 ağır yakınlaşma.
- `camera.push: {"zoom": 0.05, "ms": 700}` (vox): sahne başında `from`'dan biraz geride başlar, `expoOut` ile iter.

## 3. Ağır yakınlaşma (punch-in), sahne içi
Görsel gelir, bir an durur (ya da çok hafif kayar). Anlatımın vurgulu kelimesinde kamera ayrıntıya atılır, uzun süre süzülerek oturur.
- Bölümde 2-4 kez, bir sahnede en çok bir kez. Storyboard'da kelimesiyle planlanır.
- Zoom oranı 1.6-2.2 (küçük oranda heavyOut görünmez). Süre 1400-2000 ms. Hedef: anlatılan ayrıntı (yüz, parça, yazı).
- Fotoğraf (`ken-burns-photo`, `archival-film`):
  `"from": {"x":0.5,"y":0.5,"zoom":1.05}, "to": {"x":<ayrıntı>,"y":<ayrıntı>,"zoom":1.9,"ease":"heavyOut","at":<kelime ms>,"ms":1800}`.
  `at` = sahne başından ms (kelime zamanı `words[]`). `to.at` yoksa hareket bütün sahneye yayılır (eski davranış).
  Foto katmanı (`planes`) varsa `k ≤ 1.2` tut ya da katmansız kullan: büyük zoom'da yakın katman aşırı büyür, doldurma görünür.
- Vox: `"camera": {"from":{"zoom":1},"to":{"zoom":1.8,"x":..,"y":..},"ease":"heavyOut","moveAt":"<kelime>","moveMs":1800}`.
  Aynı anda büyük dikey kayma yok (vox §0.7).
- Deneme klibi: `content/_test/camv2/punch-in.mp4` (sin · heavyOut · snapOut).

## 4. Odak (lens)
- Hız bulanıklığı (motion blur: `Smear`, `CameraMotionBlur`) ile lens bulanıklığı ayrı şeyler. İkisi birlikte derinlik hissi verir.
- Vox `dof`: `{focus, amount (14), to, at, ms (900), ease ("heavyOut"), hunt, settle, settleMs (700)}`.
  - Statik: `focus` = anlatılan nesnenin `depth`'i (`depth-elements.md §1`).
  - Rack focus: `to` + `at`. Odak bir derinlikten diğerine kayar (arka plandaki portreden öndeki merceğe).
  - `settle` 6-12 px: sahne başında tüm kare bulanıktan netliğe oturur. Kesmelerde lens hissi verir.
  - `hunt` 0.15-0.35: odak hedefi bir kez geçip geri gelir. Bölümde 1-2 kez.
- Fotoğraf sahnesi: yalnızca katman bazlı `dof` var. Zamanlı odak (`settle`, `hunt`) henüz yok (§7).

## 5. Geçişler (zoom'lu: portal, pullback, zoomblur, cardflip)
- Gelen sahne `ease` ile oturur (varsayılan `heavyOut`). Ölçek log uzayında.
- `lens`: odak bulanıklığının tepe px'i. Varsayılanlar portal 5, pullback 8, zoomblur 6, cardflip 6; `0` kapatır. Giden sahne kesmeye doğru
  odaktan çıkar, gelen sahne netliğe oturur. `hunt` 0.15-0.35, en önemli kesimde.
- Varsayılan pencereler (ms, pre/post): portal 900/900, pullback 450/1500, zoomblur 300/500, cardflip 900/400. Kısaltma: oturma görünmez
  (2026-11-02, kullanıcı: "geçişler çok hızlı").
- Atılımın ilk %40'ı `fps` ile basamaklı (stop-motion hissi). Oturma kuyruğu tam fps, çünkü yavaş süzülmede basamak titrer.
- Hedef seçimi ve diğer geçişler: stil talimatı (vox §6), elementler `depth-elements.md`.

## 6. Kontrol
- Önce/sonra karşılaştırması için ilgili kare aralığını render et (`--frames=a-b`), ffmpeg `hstack` ile yan yana koy.
  Araç örneği: scratchpad `camv2/render.sh` deseni (HEAD dosyalarıyla eski sürüm, sonra yeni).
- Yavaş izleme: `setpts=3*PTS`.

## 7. Yapılacaklar
- Fotoğraf sahnesine zamanlı odak: yakınlaşma varışında `settle` / `hunt` (punch-in demosunda eksikti; ilk kullanımda eklenecek).
- Uzun tuval (vox §9): ardışık sahneler tek panoda, kamera hedefleri bu dosyadaki eğrilerle.
