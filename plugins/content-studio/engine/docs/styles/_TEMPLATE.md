# <id> — <kısa tanım>

<!--
Yeni stil rehberi şablonu. Akış: .studio/plugin/skills/style-study/SKILL.md. Bölüm numaraları sabit (Lemo STYLE.md ile aynı 1-11,
artı bizim 12-14), çünkü ajan talimatı ve analysis.md bunlara atıf yapar.
Bu dosya ÖĞRETİCİ anlatım (kullanıcı terimleri öğrenir). Ajanın uyguladığı kısa sürüm: .studio/plugin/skills/remotion-styles/<id>.md
(sert kurallar + tarif JSON'ları + çeşitlilik tablosu, vox-explainer.md düzeninde). İkisi aynı turda güncellenir.
Yalnızca HER bölümde geçerli olanı yaz; tek bir videonun hikâyesi, müziği, planları burada değil.
Ölçülen her sayı kural olur ("ana nesne kadrajın en az 1/3'ü"), kaynağı (ref slug + plan no) parantezde.
-->

Kod: `studio/src/styles/<id>/` · İlk kullanım: EPxxx · Lemo karşılığı: `.studio/plugin/library/lemo/<id>/STYLE.md` (varsa)

## 0. Stil promptu (tek paragraf)
Ajan ya da başka bir araç için kendi başına yeterli tarif: ortam, malzeme, renk, hareket, kamera, ses. 80-150 kelime, İngilizce.

## 1. Özü ve ne olmadığı
Tek bakışta stili belli eden 3-5 özellik. Karıştırıldığı stiller ve aradaki çizgi.

## 2. Malzeme ve işleme
Yüzey, iz, katman, kenar, doku, ışık. Remotion'da nasıl taklit edilir (katman sırası, blend, gürültü, hangi efekt dünyaya bağlı, hangisi ekran uzayında).

## 3. Renk mantığı
Kural olarak yaz: kaç ton, zemin, vurgu neye ayrılmış, neyin renklenmesi yasak. Kanal vurgusuyla (`channel.yaml theme`) ilişkisi. En fazla bir örnek palet.

## 4. Yazı ve altyazı
Fontlar (lisanssız), roller, boyut aralıkları, altyazının stilin dünyasına nasıl ait olduğu. Okuma süresi ≥ max(1.8 s, konuşma + 0.6 s).

## 5. Hareket niteliği
Kare hızı ve adımlama (ones/twos, stop-motion), ease aileleri, ağırlık, titreşim, giriş ve çıkış. Ne asla hareket etmez.

## 6. Kamera dili (9:16)
| Hareket | Ne anlatır | Ne için |
|---|---|---|
Dikey kadraj kuralları (güvenli alan, altyazı bandı, nesne boyutu). İzinli ve yasak geçişler; vox ile karışınca geçiş (bkz. `vox-explainer.md §6`).

## 7. Ses
Bu stilin malzemesinin sesi (foley), ortam, sessizlik. Müzik kanal çizgisinde kalır. Yalnızca stile özgü ekleri yaz.

## 8. Özgün hamleler
- **Hamle adı.** Ekranda ne olur, nasıl kurulur. *Uyduğu içerik:* …; …; … (en az üç, TRIZ/buluş/tarih örnekleri).

## 9. Tuzaklar
Ortamdan gelen hatalar ve düzeltmeleri.

## 10. Motor
Bileşen dosyaları, ana props, en küçük örnek timeline sahnesi (JSON).

## 11. Çeşitlilik alanı
Bölüm başına ajanın karar verdiği şeyler. Birbirinden uzak üç açılış, üç yapı, üç bitiş.

## 12. Referanslar (incelenen videolar)
| Slug (`content/_refs/<slug>`) | Video / kanal | Ölçüm (ort. plan, kesim/dk, LUFS) | Aldığımız (plan no ile) |
|---|---|---|---|

## 13. Karışım
Hangi stillerle aynı videoda kullanılır (`catalog/styles.yaml → mix_with`), giriş/çıkış geçişi, en fazla kaç sahne.

## 14. Yönetmen kuralları (kullanıcı geri bildirimleri, tarihli)
