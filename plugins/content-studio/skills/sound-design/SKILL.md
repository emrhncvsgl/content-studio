---
name: sound-design
description: >
  Ses tasarımı başvurusu: anlatım/müzik/efekt seviyeleri, vurgu bütçesi, katmanlı darbe, görüntü-olay denetimi, sessizlik,
  mekân yatakları, uzun videoda ses, sahne başına ölçüm (package.py sound_qc) ve CC0 ses havuzu (tools/sounds.py, Kenney).
  Storyboard'da ses planlanırken, timeline'a sfx/müzik yazılırken, bir ses notu düzeltilirken ya da uzun video miksinde kullan.
---

# Ses tasarımı

Kaynak: cinecode `references/sound.md` (MIT, sarpstar), bizim hattımıza ve kullanıcı ayarlarımıza uyarlandı (2026-11-08,
`docs/research/cinecode-inceleme.md`). Kodun yeri: `tools/build_timeline.py` (yerleşim), `components/audio/MusicBed.tsx` (duck),
`tools/package.py` (ölçüm), stil tabloları `remotion-styles/vox-explainer.md §8`.

## 1. Seviyeler (ölçülür, tahmin edilmez)
| Kural | Bizde |
|---|---|
| Anlatım her şeyin üstünde; konuşurken müzik ve yatak altta | `MUSIC_UNDER_VOICE_DB = 24`, aralarda `MUSIC_GAP_DB = 14` (kullanıcı ayarı, hafıza: music-level; cinecode 8-10 dB der, **bizim kulağımız daha alçak istiyor**, sayıları düşürme) |
| Vuruşlar o bölümün en yüksek yatağının 6-8 dB üstünde, 15 değil | `visual.sfx[].gainDb`, `sfx_gain_db`; geçiş "tok" ama patlamasın |
| Küçük sesler (tık, tıp, UI) müziğin tepesinin 10-15 dB altında, kısa ve yumuşak | sayaç/çizim tıkları |
| Sahne başına sapma ≤ 3 LU, 2-5 kHz payı medyandan ≤ 3 dB (ya da bilerek) | `package.py` çıktısı `sound_qc` (aşağıda §6) |

## 2. Senkron
- **Sesin başı değil tepesi** olayın karesine oturur: darbe tepesi temas karesinde, whoosh tepesi kesimden 2-3 kare önce, riser kesimde biter.
  Bizde `tools/sfx_process.py` SPEC'te doruk ölçülür, `lead` = doruk karesi (vox-explainer §8). Yeni ses eklerken bunu atlama.
- **Sahne efektleri vuruşa göre yerleşir** (2026-11-12, EP010: "bant sesi, kâğıt yırtma sesi geç geliyor"). `build_timeline.sfx_hit_ms` dosyanın
  vuruşunu ölçer (RMS tepeden −12 dB'yi ilk geçtiği an; tape_rip 365 ms, paper_rustle 345 ms, thud_small 325 ms içeride) ve efekti o kadar
  erken başlatır: vuruş kelimeye / görüntüdeki olaya denk gelir. `offsetMs` artık vuruşa göredir. Kapatmak: olaya `align: "start"`.
  Yataklar (`room_tone`, ambience, static, hum, drone) kaydırılmaz. Timeline notunda "(vuruş −N ms)" yazar.
- Müzikle kesim: kare ile hizalı tempo seç (30 fps: 90, 100, 120 BPM; vuruş tam kareye düşer). Kendi bestemizde (60 bpm) zaten öyle.
- Anlatım kesimden 0,6 sn içinde başlıyorsa duck kesimden önce başlar.
- **Müzik seviyesi parçaya göre, tek sabit sayı değil** (kullanıcı 2026-11-10, EP010 dinleme kesitleri: "müzik hiç duyulmuyor"). LUFS'a göre eşitlemek
  koyu/alçak tınılı, vurmalısız parçaları (spektral ağırlık merkezi < ~600 Hz, ör. Kevin MacLeod "Stay the Course") anlatımın altında duyulmaz bırakır:
  −19.5 LUFS'a çekilip −14 dB verilince kayboldu. Başlangıç: parlak/vurmalı parça −11 … −13 dB, koyu drone/pad −7 … −9 dB; telefonda duyulurluk
  kullanıcıya 30-35 sn'lik kesitle sorulur (anlatım + müzik, `ffmpeg amix`), sayı ondan sonra sabitlenir. "Müzik çok yüksek" notu (hafıza: music-level) parlak parçalar içindi.

- **Yarıda kesilen ses** (kullanıcının duyduğu "kesilme sesi", EP007 2026-11-08): bir ses tepesinin yalnızca 10-15 dB altındayken bitiyorsa
  kesik duyulur. İki kaynak: (1) timeline'da kısa `durMs` (metal/balta 900 ms'de kesiliyordu): darbelerde `durMs` verme ya da
  fade ≥ 600 ms; (2) dosyanın kendisi: `tools/sfx_process.py` pencere sonunda kuru sesi sert kesiyordu (fade yalnız yankıya; düzeltildi,
  11 ses yeniden üretildi). Yeni ses eklerken son 30 ms'yi ölç (tepeden ≥ 30 dB aşağıda olmalı; yataklar hariç).

## 3. Vurgu bütçesi (tasarım sesi süs değildir)
- **30 sn'de en çok 2 whoosh, 1 riser.** Riser → 0,1-0,5 sn durma → vuruş: filmde 1-2 kez, en büyük anda.
- Tasarım sesi kesimlerin **en çok %70'inde**; kalan kesimleri müzik ve görüntünün kendi sesi taşır.
- **Aynı geçiş sesi art arda iki kez yok.** Tam darbe (vuruş + gürültü kuyruğu) filmde ~5 yapısal anda; diğerleri yumuşak.
- `validate.py timeline` bunları uyarı olarak sayar (`sfx_budget`).
- Hafıza ile uyum: transition-sfx-punch (tam whoosh, hava tıslaması yok), smooth-transitions.

## 4. Görüntü ne yapıyorsa ses de yapar
- **Görüntü-olay denetimi** (storyboard'dan sonra, timeline'dan önce): ekrandaki her fiziksel olay (kâğıt düşer, kapı, metal, düğme, kemer tıkı)
  satır olur: `zaman · olay · ses dosyası · katman`. Sessiz kalan olay bilerek bırakılır ve yazılır. Rapor satırı: "olay 18 · sesli 17 · bilerek sessiz 1".
- **Katmanlı darbe:** transient (0-20 ms) · gövde (gerçek kayıt) · oda · kuyruk (0,5-3 sn) · sub (40-80 Hz, yalnızca en ağırda). Demir kapı beşi;
  masaya bırakılan bardak transient + gövde + küçük oda. Her katman ayrı `visual.sfx` satırı, tepeler aynı karede.
- **Önce gerçek kayıt:** fiziksel olay (su, taş, metal, kâğıt, motor) kayıttan; kod yalnızca hareketi izleyen sesler (yükselen ton, süpürme) için.
- Hafıza ile uyum: varied-real-elements (her videoda yeni gerçek ses; `tools/sounds.py` önceki bölümlerde kullanılanları sona atar).

## 5. Mekân, sessizlik, saygı
- **Her mekâna kendi yatağı** (oda tonu, sokak, atölye); mekân değişince yatak değişir, kesimde ≤ 4 LU sıçrar (bilerek değilse).
  Yeni mekân 0,3-1,5 sn önce başlar (J-cut), kuyruk sonrasına taşar (L-cut). Bizde tek yatak `BED_SFX` (room_tone); uzun videoda sahne başına
  `visual.bed` ihtiyacı doğar (henüz kodda yok: gerekince build_timeline'a eklenir).
- **Sessizlik bir olaydır:** bir şey bitirir (son vuruş, kuyruk), ardından hafif oda tonu; dijital sıfır arıza gibi okunur. 9:16'da en büyük andan önce
  0,3-0,5 sn çekilme (yatay uzun videoda 0,3-1,5 sn).
- **Saygı:** kurban, yas, sivil, kaza mağduru görüntüsünde patlama/riser/whoosh yok; oda tonu ya da sessizlik taşır.
- **Anahtar anlar** (2-4/film): yatak çekilir, tek alçak vuruş ya da tek uzun nota, sonra kuyruk; etrafta yeni ses yok.

## 6. Ölçüm
- `tools/package.py` paketten sonra `sound_qc` yazar (`publish.<dil>.yaml` → `audio.scenes`, `render/qc/<EP>.spectrogram.png`):
  sahne başına LUFS (kısa sahnede momentary tepe), 2-5 kHz payı, medyandan sapanlar `flags`. Tek başına da çalışır:
  `voice/.venv-chatterbox/bin/python tools/package.py <EP> --qc-only`.
- Spektrogramda süren yatay çizgi = istenmeyen perdeli katman (uğultu, kalan nota).
- Ses notu ("şurada kısık") → saniye + katman + ölçülebilir hedef ("0:12-0:18 yatağa göre +4 dB"). Yalnızca ses düzeltmesinde görüntüyü yeniden
  render etme: `remotion render ... --codec=wav` + ffmpeg ile videoya bağla (remotion-styles §müzik dinleme denemesi).
- **Dinleme dosyası (aday karşılaştırma) birleştirirken:** sahneleri kendi örnekleme hızında `concat` et (boşluk `anullsrc=r=<aynı hız>`), sonra
  `loudnorm`, en sonda `-ar 48000`. Her girişe ayrı `aresample=48000` + 48 kHz boşlukla birleştirmek 14-24 kHz'e geniş bantlı hışırtı ekledi
  (2026-11-08, kullanıcı "TV cızırtısı" duydu; 24 kHz kaynakta 14-20 kHz payı −41 dB, doğru zincirde −90 dB). Kontrol: 24 kHz kaynaktan gelen
  dosyada 14-20 kHz payı ≤ −80 dB olmalı. zsh'de `$2:c...` değişken değiştiricisidir: `${2}` yaz.
- Ses ölçülür ama duyulmaz: her teslimde kullanıcıya dinlenecek saniyeleri söyle (geçişler, en yüksek sahne, işaretlenen sahne).

- **Çıt / "kesilme" araması (EP010, 2026-11-10):** kulaklıkta "durdurup başlatınca gelen pat" gibi tık → önce kanallara ayır:
  `tools/mix_audio.py <EP> render/_stem_X.wav --only narration|sfx|music`, kullanıcı hangisinde duyduğunu söyler. Ölçüm tek başına yanıltır
  (ünsüzler ve müzik vuruşları da "tık" sayılır). EP010 nedeni: `build_timeline.apply_pauses` duraklamayı nefes/taban sesi olan yerde
  (−40 dB) kesip yumuşatmasız dijital sessizlik ekliyordu → artık kesim kenarlarında 40 ms afade. Remotion sesi kanalların toplamından
  ayrışabiliyor (EP010 fark −3 dB); şüphede son sesi `mix_audio.py --video --out` ile kur (kazanç artık örnek düzeyinde ara değerli).

## 7. Uzun video (5 dk+)
- Konuşma yoğun uzun bölümde müzik sürekli alçak kalır (bizim 24 dB); hareket **nefes** bölümlerinde gelir (aralarda 14 dB). Müzik bölüm başına bir
  parça, ani durmaz: kısa çapraz geçiş, görüntü geçişine bağlı sönme. Perde değişiminde parça değişebilir (10-12 dk'da 3-4 parça).
- Motif her dönüşte değişir (seyrek, alçalan, yükselen); uzun konuşma bölümüne büyüyen bir ostinato.
- Bölüm imzası: perde girişleri aynı dilde ama aynı dosya tekrarı olmadan (aşağıda kullanıcı kuralları).
- Sahne başına ölçüm (§6) uzun videoda şart: toplam −14 LUFS bir perdenin çok yüksek olmasını gizler.
- **Kullanıcı kuralları (EP009 tam taslak notları, 2026-11-09):**
  - **Bölüm arası = anlatıcı susar:** başlık yeni bölümün ilk görüntüsü üstünde, sessiz payda çıkar; sonra anlatım başlar (belgesel film).
    Ses: görüntü karanlıktan açılırken alçak sub, başlık şeridi otururken kâğıt kayması + tok vuruş; tiz yok. Kurulum: sahne `lead: {ms, sfx}`
    + `visual.props.chapter`; önceki bölümün kuyruğu ~1.2 sn nefes. Örnek betik: `episodes/EP009-*/chapter_leads.py`.
  - **Bölüm girişi acele değil** (v3, "Netflix dizisi / Veritasium belgeseli gibi"): önceki bölüm son 0.8 sn S-eğrisiyle karanlığa iner →
    0.7 sn siyah → görüntü 1.3 sn'de karanlıktan açılır (riser yükselir) → nesneler gelir → başlık **ortada** (doruk + alçak vuruş + şerit) →
    söner → anlatıcı (lead ≈ 5.4 sn; `chapter: {center, fromBlackMs, revealMs}`, `lead.layerShiftMs`). Riser bütçesi (§3) uzun videoda bölüm
    girişlerinde bilerek aşılır (kullanıcı isteği), alçak tutulur (≈ −24 dB).
  - **Müzik eğrilerle:** hiçbir müzik "bir anda" başlamaz/bitmez. İlk giriş ≥ 5 sn S-eğrisi, parçalar arası ~4 sn eşit güçlü çapraz geçiş
    (sin/cos; ortada ses düşmez), son ≥ 5 sn S-eğrisiyle söner; anahtar anda sessiz aralık (PLAN'da `None`). İlk 30-40 sn müziksiz kalmaz.
  - **Çift ses olmasın:** vox sahnesinde katmanlara elle ses konduysa build_timeline'ın otomatik kayma seslerini kapat (`props.autoSfx: false`);
    EP009 s48'de 6 sn'de 17 kâğıt sesi üst üste bindi. Düşen/kayan nesnenin sesi **inişte** (giriş + ~330 ms − dosya doruğu), girişte değil.
  - **Cümle arası duraklama kelime kuyruğunu kesmesin:** anlatıcı iki cümle arasında durmuyorsa (kelimeler bitişik) o sahnede `sentence_pause_ms: 0`;
    yoksa kesim "s" gibi bir kuyruğu böler, tekrar ediyormuş gibi duyulur (EP009 s49 "Take Otis.").
  - **Kapanış kibriti gibi kapanış nesnesi** sonuna kadar görünür kalır, halka/iris ona doğru kapanır, nesne en dar anda kendi sesiyle söner (tıss),
    sonra logo; "önce söner, sonra halka tekrar çıkar" sırası kopuk durur.
  - **Aynı "imza" sesi her arada çalma:** 5-6 kez tekrar eden kâğıt yırtığı ucuz duruldu. Bölüm başlarında farklı, görüntüye bağlı sesler.
  - **Doruğu ölç, kaydır:** dosyanın tepesi geç geliyorsa (`paper_rip` 490 ms) `offsetMs = −doruk`; ölçmeden konan ses "gecikmeli" duyulur.
  - **Müzik bölüm başına parça,** bazı bölümler hareketli (montaj, gerilim) olabilir; tek sakin yatak 10 dakika boyunca düz gelir. Parçalar bölüm
    başlığının sessiz payında 2 sn çapraz geçişle değişir; tek dosya olarak kurulur (`episodes/EP009-*/build_music.py` kalıbı: PLAN = sahne →
    parça, başlangıç sn, dB; kısa parça çapraz geçişli döngü; −19.5 LUFS), timeline'da `startFrame 0`.
  - **Kapanış:** bekleyişsiz, tek yumuşak hareket; lirik bir kapanış kanal logosuna akar (16:9: `tools/make_outro_pieces.py --landscape --hold 2`;
    logo sesi kapanış sahnesinin sonundan geriye konur).

## 7b. Alıntı ve diyalog sesi (referans: cinecode Bermuda belgeseli, `content/_refs/cinecode-bermuda/analysis.md`)
- Kayıttan cümle (telsiz, seyir defteri, mektup, rapor) **başka bir sesle**, anlatıcı o sırada susar; 2-5 sn, sonra anlatıcı aynı sahnede sürer.
- Ortam işlemesiyle ayrışır: telsiz/telefon bandı (HP ~300 Hz, LP ~3.4 kHz, hafif bozulma + hışırtı; referansta alıntılarda 250 Hz altı %26-38,
  anlatıcıda %55-88), mektup = yakın ve kuru, kalabalık = salon yankısı. Yalnız kaynaklı alıntı; canlandırma diyaloğu belgeli olayı anlatır, gerçek
  kişiye söylemediği fikri söyletmez, "as the story is told" çerçevesi korunur.
- **Soğuk açılış:** sahnenin kendi sesi (motor, rüzgâr, telsiz) + bir alıntı → tek hamlede sessizlik → tek alçak vuruş → anlatıcı (10-12. sn).
- **Bölüm geçişi:** 3-8 sn konuşmasız; ses yükselir (konuşmaya göre ~+2.5 dB), bas ağırlıklı nabız/vuruş, tiz yok; ardından yeni bölüm kartı.
- Dar dinamik (LRA ~4 LU) uzun videoda dinleyiciyi yormaz; anahtar anda yatak çekilir.

## 8. Ses havuzu
| Kaynak | Lisans | Araç |
|---|---|---|
| Pixabay kayıtları (`content/sfx/pixabay/`) | Pixabay Content License | `tools/sfx_process.py` |
| Commons PD/CC0 (`content/sfx/natural/`) | PD/CC0 | elle, `sources.csv` |
| **Kenney paketleri** (`content/sfx/kenney/`, 256 ses: RPG (kitap, kemer, kapı, metal mandal, kumaş, ayak), UI/Interface (tık, düğme), Casino (kart, zar, fiş); Impact paketi elle eklenir) | **CC0** | `tools/sounds.py search "metal mandal"` → `get <id> --ep EPxxx` |
| VSCO-2 CE / VCSL çalgı örnekleri | CC0 | `tools/music/sampler.py` |

`tools/sounds.py get` dosyayı `content/sfx/kenney/` altına 48 kHz WAV olarak koyar, `sources.csv`'ye yazar ve bölümü `used.json`'a kaydeder;
arama, son bölümlerde kullanılanları "(EP00x'te kullanıldı)" diye sona dizer. Çıktıdaki `offsetMs` = −doruk (sesin tepesi kelimeye oturur).
Paketler OpenGameArt'tan (Kenney'nin kendi yüklemesi) otomatik iner; kenney.nl indirmesi tarayıcı oturumu istiyor (2026-11, otomatik denenmez).
Impact (ahşap/cam/metal darbe, ayak sesleri) yalnızca kenney.nl'de: kullanıcı tarayıcıda indirir → `tools/sounds.py add <zip> impact`.

**Kendi müzik düzenlemesinde katman denetimi (EP014, 2026-11-12):** kullanıcı "piyano çıkmıyor" dedi; neden piyano katmanının darbe/yaylı
katmanlarından 8-12 dB alçak kalmasıydı (fluidsynth Salamander çıktısı düşük seviyeli, hızlar 50-60) + kısaltılmış uzun yay örneklerinin perdesiz çıkması.
`music_build.py`'de katmanları ayrı stem yaz (`STEMS=1` → `render/qc/stems/*.wav`), bölüm bölüm RMS ölç; öncü çalgı diğerlerinden ≥ 6 dB üstte olmalı;
şüpheli katmanda `librosa.pyin` ile perde kontrolü.

## Pixabay'den ses indirme (2026-11-09, IYH001)
pixabay.com komut satırı isteğini 403 ile reddeder (Cloudflare); cdn.pixabay.com reddetmez. Yol: yerleşik tarayıcıda
`https://pixabay.com/sound-effects/search/<terim>/` aç → sayfa içinde `fetch()` ile arama ve ses sayfalarının HTML'ini al, `cdn.pixabay.com/download/audio/…mp3`
adresini çıkar → `curl -A "Mozilla/5.0"` ile indir → `ffmpeg -nostdin -i x.mp3 -ar 48000 -ac 2 <ad>.wav` (döngüde `-nostdin` şart: yoksa ffmpeg heredoc
girdisinden karakter yer, dosya adları bozulur) → uzun ambiyansı 45 sn'ye kırp → `content/sfx/pixabay/sources.csv` satırı (sayfa URL'si, yazar, Pixabay Content License).
WebFetch (2026-11-12, EP015): arama sayfasının sonuç listesini (başlık, sayfa URL'si, yazar) okur ama markdown'a çevirdiği için `cdn.pixabay.com/download/audio` adresi görünmez; indirme için yine yerleşik tarayıcı gerekir. Tarayıcı yoksa havuzdaki seslerle kur, aday sayfa URL'lerini rapora yaz. Taklit User-Agent ile curl denemesi izin denetiminde reddedilir, deneme.
Elenecekler: müzik aleti içeren "music" sonuçları (kanal kuralına göre), ezan/dua kayıtları ambiyans olarak kullanılmaz. Gerçek kayıt yoksa yedek: `tools/ambience.py`
(rüzgâr/kum/okyanus sentezi; yelken çırpınması sentezi makine gibi düzenli çıktı, kullanılmaz).

