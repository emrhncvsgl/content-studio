# Kamera dili — bütün stiller için ortak

Bu dosya **öğretici anlatımdır** (terimler ve nedenler). Ajanın uyguladığı kısa sürüm `.studio/plugin/skills/remotion-styles/camera.md`.
Kamera kuralları stile bağlı değildir: vox, fotoğraf, arşiv ve manim sahneleri, geçişler ve ileride uzun tuval aynı dili konuşur.
Yeni bir kamera özelliği eklenince ikisi de aynı turda güncellenir.

## 1. Eğri (ease) nedir, neden önemli
Bir hareketin hızının zaman içinde nasıl değiştiğini eğri belirler. After Effects'te bunu anahtar karelerin **etkisi** (*influence*) ve
**hız grafiği** (*speed graph*) ayarlar.

- **Heavy ease-out** (bizde `heavyOut`): kamera bir an hızla atılır, sonra uzun süre süzülerek durur. Hız grafiği başta tepe yapar,
  uzun bir kuyrukla sıfıra iner. AE'de varış anahtarına %90-100 etki verilir. Editlerde "o tatlı zoom" dediğimiz şey budur.
- **Heavy ease in-out** (bizde `heavy`): ağır kalkış, hızlı orta, ağır duruş. Kaydırma ve kart çevirme için iyidir ama "atılım" hissi
  vermez. Kamera v2'ye kadar (2026-11-02) geçişlerde bu kullanılıyordu, o yüzden heavy ease-out zoom tam oturmuyordu.
- **snapOut**: heavy ease-out'un daha sert hali.

## 2. Log zoom
Göz ölçeği oranla algılar: 1→2 ile 2→4 aynı "mesafe" gibi gelir. Ölçek doğrusal karışırsa büyük bir zoom'un sonu sürünür ya da kesik biter.
Bu yüzden bütün zoom'lar log uzayında hesaplanır (*exponential zoom*). Powers of Ten'deki sabit hız hissi buradan gelir.

## 3. Ağır yakınlaşma (punch-in)
Bir geçiş değil, sahne içi bir anlatım hamlesi: görsel gelir, bir an durur. Anlatım vurgulu kelimeye gelince kamera görselin ayrıntısına
atılır ve uzun süre süzülerek yaklaşır. İzleyiciye "şuraya bak" der. Geçişler kısa sürdüğü için orada fark edilmiyordu, asıl yeri burası
(kullanıcı, 2026-11-02). Az kullanılınca etkilidir: bölümde 2-4 kez.

## 4. Odak: lens bulanıklığı
- **Alan derinliği** (*depth of field*): odak düzleminden uzak katmanlar bulanık. Sahnenin önünü, ortasını ve arkasını ayırır.
- **Rack focus / focus pull**: odak bir derinlikten diğerine kayar. Dikkat de onunla birlikte kayar.
- **Focus hunting**: otomatik odak hedefi bir kez geçip geri gelir. Gerçek kamera hissi verir; az kullanılır.
- **Defocus geçişi**: giden kare odaktan çıkar, gelen kare netliğe oturur.
- **Hareket bulanıklığı** (*motion blur*) bundan ayrıdır. Hareket bulanıklığı hızdan, lens bulanıklığı odaktan gelir. İkisi birlikte
  derinlik hissini verir.

## 5. Geçiş süreleri
Heavy ease-out oturmasının görünmesi için zaman gerekir. 2026-11-02'de portal ve pullback'in pencereleri uzatıldı (kullanıcı: "geçişler
çok hızlı"). Sahne süresi ve sesle senkron değişmez; uzayan kısım gelen sahnenin başıdır, kamera o sırada süzülmeye devam eder.

## 6. Yönetmen kuralları (kullanıcı geri bildirimleri)
- 2026-11-02: Heavy ease-out zoom sahne içinde, anlatım sırasında kullanılır. Bulanıklık (lens) ile birlikte sonraki videolarda denenecek.
- 2026-11-02: Geçişler hızlıydı; uzun pencere "biraz anlaşılıyor". Varsayılan oldu.

## 7. Terimler
*ease / easing*, *influence*, *speed graph / value graph*, *heavy ease-out*, *punch-in*, *exponential zoom*, *depth of field*,
*rack focus*, *focus pull*, *focus hunting*, *defocus transition*, *motion blur*.
