# Adım adım: sıfırdan ilk videoya

Claude masaüstü uygulamasının **Code** sekmesinde (Mac). Toplam: kurulum ~1 saat (çoğu indirme), kanal kurulumu ~30-45 dk,
ilk bölüm birkaç oturum.

## 0. Hazırlık (bir kez, ~15 dk)
1. **Claude masaüstü uygulaması**nı indir (claude.ai/download), Claude hesabınla gir. Code sekmesi ücretli plan ister
   (Pro ya da Max). Bir video bölümü çok iş yapar; Pro'da kullanım limitine takılırsan bölümü ertesi oturumda sürdürürsün
   (stüdyo kaldığı yeri `state.json`'da tutar).
2. **Kaggle hesabı** (ücretsiz ses üretimi için önerilen): kaggle.com → kayıt → Settings → **Phone verification** (GPU için şart) →
   Settings → API → **Create New Token**. İnen dosyayı kurulumda Claude sana nereye koyacağını söyleyecek. Anahtarı sohbete yapıştırma.
3. Videoların duracağı **boş bir klasör** oluştur (ör. `Belgeler/Kanalim`). En az ~20 GB boş disk.

## 1. Plugin'i ekle (~2 dk)
Code sekmesinde yeni oturum aç, klasör olarak az önce oluşturduğun klasörü seç. Mesaj kutusuna sırayla:
```
/plugin marketplace add emrhncvsgl/content-studio
/plugin install content-studio@content-studio
```
Uygulama bu komutları açmazsa Terminal'de aynısı (Claude Code komut satırı kuruluysa):
```
claude plugin marketplace add emrhncvsgl/content-studio
claude plugin install content-studio@content-studio
```
Sonra Code sekmesinde **yeni bir oturum** aç (plugin yeni oturumda yüklenir). Mesaj kutusuna `/content` yazınca
`content-studio:...` komutları listelenmeli.

## 2. `/content-studio:studio-setup` (~30-60 dk, çoğu indirme)
Ne olur:
1. Claude sistemini okur ve kısa bir tablo gösterir: çip, bellek, disk, eksik araçlar (Homebrew, Python 3.11, Node, ffmpeg,
   whisper.cpp), önerilen ses motoru.
2. Motoru klasöre kopyalar (`tools/`, `voice/`, `studio/`, `catalog/`, `CLAUDE.md`).
3. Kurulacakların listesini gösterir ve **onay ister**. Onay verince arka planda kurar: Python ortamı (~2 GB, torch dahil),
   Remotion (`npm ci`, ~1.5 GB), Whisper modeli (~550 MB), fontlar. Bu sırada bilgisayarı kullanabilirsin.
   Homebrew şifre isterse onu **sen** Terminal'de girersin; Claude şifre girmez.
4. Ses motorunu sorar: Kaggle (önerilen) / yerel / Gemini / ElevenLabs. Kaggle seçersen anahtar dosyasını nereye koyacağını söyler.
5. Kısa test: Python, Whisper, Remotion. Deneme render'ından önce sorar (birkaç dakika sürer).

## 3. `/content-studio:new-channel` (~30-45 dk)
1. "Kanal ne anlatacak, kim izleyecek, beğendiğin bir kanal/video var mı?" Serbestçe anlat; link verebilirsin.
2. Birkaç kısa seçim: kanal adı, dil, format (Shorts / uzun), ton.
3. **Anlatıcı sesi**: hazır bir ses, kanala özel tasarlanmış ses (3-4 aday dinlersin) ya da Gemini/ElevenLabs. Adayları dinleyip seçersin.
4. **Tasarım dili** (kendiliğinden başlar), dört kısa tur:
   - Görünüş: ana stil + karışabilen stiller + görünüm ailesi
   - Kamera ve kurgu: sakin / ölçülü / enerjik, imza hareketler, geçiş dili, yasaklar
   - Yazı ve renk: altyazı stili, font eşleşmesi, palet, doku
   - Ses: müzik ruh hali, seviye, efekt karakteri
   Her seçeneğin yanında ne hissettirdiği yazar. Sonunda **6-8 saniyelik deneme klibi** çıkar. Beğenmediğin kısmı söylersin,
   yalnızca o değişir.
5. Özet tablo → onay → `channel.yaml` yazılır.

## 4. İlk video: `/content-studio:shorts`
Konu varsa yaz (`/content-studio:shorts fermuarın icadı`), yoksa boş bırak; Claude 5-6 konu önerir.
| Adım | Ne yaparsın | Süre |
|---|---|---|
| Röportaj | Konu, görsel tarz, süre | 5 dk |
| Senaryo → **ONAY 1** | Sahne tablosunu ve Türkçe özeti okursun; düzeltme istersin ya da onaylarsın | 10-20 dk |
| Görsel avı | Claude bulabileceklerini bulur; sana kısa bir "şunları bulursan iyi olur" listesi verir. Bulduklarını `content/assets/inbox`'a atarsın, lisansını Claude kontrol eder | isteğe bağlı |
| Ses | Kaggle'da arka planda (~10-15 dk). Mac'te yalnızca kontrol | bekleme |
| Storyboard → **ONAY 2** | Sahne sahne görsel planı ve küçük önizlemeleri görürsün | 10-20 dk |
| Render | Remotion videoyu üretir (Mac'i 10-30 dk meşgul eder; önce sorar) | bekleme |
| Yayın paketi | MP4, altyazı (.srt), başlık, açıklama, etiketler, kapak | otomatik |
| **ONAY 3** | Videoyu izlersin: "s04'te geçiş hızlı", "müzik yüksek" gibi notlar → yalnızca o sahneler düzeltilir | |

Yarıda bırakırsan: `/content-studio:shorts EP001` kaldığı yerden sürdürür.
Editörde açmak için: Claude'a "editörü aç" de (`localhost:3100`; sahne ayarlarını elle değiştirebilirsin).

## Sık sorulanlar
- **Tasarımı sonradan değiştirmek:** `/content-studio:design-language` (ya da yalnızca bir kısmı: "geçişleri sakinleştir").
- **Güncelleme:** `/plugin marketplace update content-studio`, sonra klasörde `/content-studio:studio-setup --update`.
  Elle değiştirdiğin dosyalar ezilmez.
- **Ne yüklenmez:** gerçek kişi sesi klonlanmaz; lisansı belirsiz görsel kullanılmaz; her varlık `assets.csv`'ye yazılır.
