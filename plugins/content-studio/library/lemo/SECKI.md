# Lemo-Opuscar stil promptları (seçki)

Kaynak: [github.com/lemomo-ai/lemo-opuscar](https://github.com/lemomo-ai/lemo-opuscar), commit `bebbbe1` (2026-11-01). Lisans MIT,
`LICENSE` bu klasörde (telif bildirimi korunur). 66 stilden kanala uyan 20'si alındı. Her klasörde şunlar var:

- `STYLE.md`: stilin kalıcı kuralları, 11 sabit bölüm (öz, malzeme, renk, yazı, hareket, kamera, ses, özgün hamleler, tuzaklar, motor, çeşitlilik)
- `DEMO.md`: onların demo filminin hikâyesi, planları ve müziği (yalnızca örnek)
- `style.json`: tek satır özet, kullanım alanları
- `poster.jpg`: demodan bir kare

Bu dosyalar **ham referanstır**. Lemo, stilleri canvas/WebGL/three.js ile ve kendi ajan hattıyla çiziyor; biz hattını değil
**kurallarını** alıyoruz. Bir stil bizde kurulurken `STYLE.md`, referans videolarla (`tools/ref_study.py`) birlikte okunur ve
`docs/styles/<id>.md` + `.claude/skills/remotion-styles/<id>.md` çiftine çevrilir. Çeviri sırasında kendi kurallarımız geçerli
(kamu malı varlık, `assets.csv`, efekt içeriğe hizmet eder, kanal paleti ve sesi). Akış: `.claude/skills/style-study/SKILL.md`.
Demo kodlarını (`styles/<id>/demo/`) almadık. Gerekirse repodan okunur.

## Seçki ve bizdeki karşılığı

**A: önce bunlar** (TRIZ, buluş, tarih ve bilim anlatısına doğrudan oturuyor)

| Lemo | Bizde | Ne alınır |
|---|---|---|
| [blueprint](styles/blueprint/STYLE.md) | `blueprint-diagram` (var, yükseltilecek) | Koyu masada tek mavi kopya kâğıdı; çizim sırası, canlı ölçü çizgileri, numaralı balonlar, "FIG. 1 → FIG. 2" geçişi, başlık kutusu ve revizyon satırları hikâye taşır. Vox videosunun ortasında 1-3 sahnelik ara bölüm olarak. |
| [engraving](styles/engraving/STYLE.md) | yeni: `engraving` | Kalemin bakıra kazıdığı çizgi çizgi tablo, sonra suluboya yıkaması. Kamu malı gravürlerle (EP004'teki gibi) birleşir. |
| [archive-lighttable](styles/archive-lighttable/STYLE.md) | `archival-film` + vox kanıt sahnesi | Işık masası, cam negatif, büyüteç, belgeyle doğrulama ("telgraf 57 dedi, arşiv 59 diyor"). |
| [teardown](styles/teardown/STYLE.md) | yeni: `teardown` | Buluşun tek yörüngede parçalarına ayrılıp geri kapanması (exploded view). "Nasıl çalışır" sahneleri için. |
| [briefing-board](styles/briefing-board/STYLE.md) | yeni ya da blueprint varyantı | Bir duvarda seçenekler yan yana denenir, bir kısıt kazananı seçer. TRIZ çelişkisi ve çözüm karşılaştırması için birebir. |
| [printed-long-take](styles/printed-long-take/STYLE.md) | vox "uzun tuval" (bkz. `docs/styles/vox-explainer.md §9`) | Kesmesiz tek kamera yolculuğu ve her karede en az 3 katman kuralı. Onların 3B (three.js) motoru yerine bizde 2.5D kolaj tuvali. |

**B: konuya göre**

| Lemo | Bizde | Ne alınır |
|---|---|---|
| [visual-investigation](styles/visual-investigation/STYLE.md) | `visual-investigation` (katalogda) | Tüm kaynakları tek saate dizip aynı ana kilitlemek. Uzun formda tarih olayları. |
| [halftone-dossier](styles/halftone-dossier/STYLE.md) | vox halftone | Dosya/dava grameri: damga, ataş, ek numaraları. |
| [satellite-briefing](styles/satellite-briefing/STYLE.md), [transit-map](styles/transit-map/STYLE.md) | vox harita sahnesi | Harita, rota, zaman içinde büyüyen ağ. |
| [dataviz](styles/dataviz/STYLE.md) | `data-viz` | Grafiğin kendisi hikâyeyi anlatır. |
| [microscope](styles/microscope/STYLE.md) | yeni | Tek kesintisiz yakınlaşmayla ölçeğe inmek (biyomimikri bölümleri). |
| [kino-montage](styles/kino-montage/STYLE.md) | `constructivist-montage` | Resmî iddiaya karşı belge ve fotoğrafla cevap. |

**C: deneme**: [woodcut](styles/woodcut/STYLE.md), [newsreel](styles/newsreel/STYLE.md), [silent-film](styles/silent-film/STYLE.md),
[data-physical](styles/data-physical/STYLE.md), [whiteboard](styles/whiteboard/STYLE.md), [urban-sketch](styles/urban-sketch/STYLE.md), [paper-popup](styles/paper-popup/STYLE.md).

## Uyarılar
- Onların demoları 16:9 ve 40-60 saniyelik tek film. Biz 9:16 Shorts ve karışık stil kullanıyoruz: `STYLE.md §6` kadraj kurallarını dikey ekrana göre yeniden yaz.
- `§7` ses kısmı bizde kanal sesine (Satie çizgisi piyano, katmanlı efekt) uyarlanır. Her stile ayrı müzik dünyası kurulmaz.
- `printed-long-take`, `teardown` ve `microscope` gerçek 3B istiyor (`@remotion/three`, paket kurulumu onayla). 2.5D ile taklit önce denenir.
