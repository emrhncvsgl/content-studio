---
name: style-study
description: >
  Referans videolardan yeni görsel stil kurma ya da var olan stili geliştirme akışı: referans bulma, tools/ref_study.py ile
  ölçme (plan kesimleri, temas sayfası, palet, LUFS), analysis.md doldurma, Lemo-Opuscar stil promptlarıyla birleştirme,
  docs/styles/<id>.md + ajan talimatı + katalog kaydı yazma, 6-8 sn deneme klibi. Kullanıcı "şu stile bakalım", "bu videoyu
  analiz et", "yeni stil ekle", "stilimizi geliştir" dediğinde kullan.
---

# style-study

Hedef: her stil için kendi kuralları ve ayrıntılı promptu olan bir rehber çifti (vox-explainer gibi). Sıra:

## 1. Referans topla (3-5 video)
- Kullanıcının verdiği linkler önce gelir. Yoksa WebSearch ile ara: "<stil terimi> motion design", "<stil> explainer animation",
  Vimeo Staff Picks, Motionographer, bilinen kanallar. Listeyi kullanıcıya göster (başlık, kanal, süre, neden), **indirmeden önce seçtir**.
- Farklı kaynaklardan seç: bir usta örnek, bir dikey/kısa örnek, bir bizim konuya (bilim, tarih, buluş) yakın örnek.
- Lemo'da karşılığı varsa (`.studio/plugin/library/lemo/README.md`) onun `STYLE.md`'si de referans sayılır.

## 2. Ölç
```
voice/.venv-chatterbox/bin/python tools/ref_study.py <URL|dosya> --slug <stil>-<kısa-ad> [--from 1:20 --to 2:40] [--threshold 0.2]
```
- Çıktı `content/_refs/<slug>/`: `sheet-N.jpg`, `frames/sNNN.jpg`, `shots.csv`, `palette.png`, `analysis.md` iskeleti. `source.mp4` git dışı (telifli).
- Uzun videoda yalnızca stilin göründüğü 1-2 dakikayı al. Kolaj veya yumuşak geçişli videolarda `--threshold 0.2`.
- Homebrew ffmpeg'de `drawtext` yok, etiketler PIL ile basılıyor. Yeni bir ölçüm gerekirse araca ekle, elle tekrarlama.

## 3. İncele (`analysis.md`)
- Önce temas sayfalarını oku (Read ile görüntü). Tek karelere yalnızca belirsiz planlar için in. Token için en fazla 2 sayfa + 6 kare.
- Her gözlemi plan numarasıyla yaz ("#12: 13 s tek plan, kamera tuval üstünde soldan sağa kayıyor").
- §9 ve §10 en önemlisi: kanala uyan ve uymayan ne, bizde ne gerekir (bileşen, paket, varlık türü ve kamu malı kaynağı).

## 4. Rehberi yaz
- `docs/styles/_TEMPLATE.md`'yi `docs/styles/<id>.md` olarak doldur. Lemo `STYLE.md` + 2-5 analysis.md birleşir. Çelişkide
  kanal kuralları (`CLAUDE.md`, memory: efektler içeriğe hizmet eder, kamu malı tercih, kanal müziği) kazanır.
- §0 stil promptu İngilizce ve kendi başına yeterli olsun. Plugin'e taşınınca stil tek dosyadan çağrılacak.
- Ajan talimatı **projede** `docs/styles/guides/<id>.md` (plugin klasörü `.studio/plugin/` salt okunurdur, güncellemede silinir):
  `.studio/plugin/skills/remotion-styles/vox-explainer.md` düzeninde (0 sert kurallar, 1 adımlar, 2 tarifler, 3 çeşitlilik tablosu…).
  Katalog kaydında `guide: docs/styles/guides/<id>.md`.
- `catalog/styles.yaml`: kayıt ya da güncelleme (`implemented`, `mix_with`). Sonra `tools/validate.py`.

## 5. Dene
- 6-8 sn tek sahne, `content/_test/<id>/` altında. Remotion bileşeni yoksa önce en küçük sürümü yaz (`remotion-styles` skill'i).
- Render tek ağır iş kuralıyla (bellek bekçisi). Kullanıcı izler ve karar verir. Geri bildirimi tarihli olarak §14'e yaz.

## Kurallar
- Paket kurulumu (ör. `@remotion/three`, PySceneDetect) onaysız yapılmaz.
- Referans karelerini videoya koyma; yalnızca grameri al. Karakter, düzen, font ve müzik kopyalanmaz.
- Rehbere kaynak videonun adı yazılabilir (öğrenme için). Videoda ve açıklamada adı geçmez.
