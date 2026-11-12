---
name: qa-checklist
description: >
  Bölüm kalite kontrol listesi (PLAN 12): teknik, içerik, ses, hukuki ve çok dil kontrolleri ile bunları ölçen komutlar.
  Bir bölümün yayına hazır olup olmadığı değerlendirilirken ya da qa_report.md yazılırken kullan.
---

# Kalite kontrol listesi

Her madde için: **GEÇTİ / KALDI / ATLANDI (neden)** ve KALDI ise hangi ajana ne düzeltme notu gideceği.
Rapor: `<bölüm>/qa_report.md`. Ölçebildiğini ölç, tahmin etme.

## Teknik
- [ ] Çözünürlük ve kare hızı: `channel.yaml formats.<format>` (short: 1080x1920, 30 fps)
      `ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate -of csv=p=0 <mp4>`
- [ ] Süre `formats.<format>` min/max içinde, hedefe ±%10
- [ ] Ses boş/kırpık değil; tepe < −1 dBTP; bütünleşik ≈ −14 LUFS (yayın miksi)
      `ffmpeg -i <mp4> -af ebur128=peak=true -f null - 2>&1 | tail -12`
- [ ] Altyazı güvenli bölgede (alt %20 ve sağ kenar boş), okunur
- [ ] Ses-altyazı senkronu: kelime zamanı sapması < ~150 ms (captions/<dil>.json ↔ audio report.json)

## İçerik
- [ ] Konu kaynakla tutarlı (`channel.yaml content_sources`; ör. serinin kaynak kaydı)
- [ ] Örnekler gerçek ve doğrulanabilir; senaryodaki doğrulama notları var
- [ ] Hook ilk 2 sn'de (ilk sahne soru/çelişki)
- [ ] Terimler tutarlı, CTA kanalınki

## Ses
- [ ] `audio/<dil>/report.json`: seçilen denemelerde WER ≤ 0.15 (telaffuz sözlüğü farkları hariç)
- [ ] Konuşmacı benzerliği ≥ profil eşiği; bölümler arası aynı ses profili
- [ ] Tuhaf okunan sayı/terim yok (Whisper metni ↔ senaryo)

## Hukuki
- [ ] Her görsel `assets.csv`'de: dosya, kaynak URL, lisans, atıf gereksinimi; `channel.yaml assets.forbidden` yok
- [ ] Müzik lisanslı / kendi üretim
- [ ] Sentetik ses/içerik notu yayın paketinde

## Dil (lang: both)
- [ ] Dillerin ses parçaları eşit uzunlukta (MLA)
- [ ] Çeviri anlam kaybı yok
- [ ] `style_mode: lang_neutral` ise ekranda dile bağlı gömülü yazı yok
