# object3d: gerçek müze nesnesi, CC0 3D tarama (kahraman çekim)

2026-11-11, EP013 (Lincoln patent modeli) ile kuruldu. Görsel kalite planı: her videoda bir kahraman çekim; nesnenin kendisi hikâyenin merkezindeyse
ve CC0 taraması varsa gerçek taramayı gerçek ışıkla göster. Kompozisyon: `studio/src/styles/object3d/MuseumObject.tsx` (`MuseumObject`, 1080×1920).

## Kaynak bulma (Smithsonian, CC0)
- 3d.si.edu sayfaları Cloudflare bot denetimi arkasında (curl ve yerleşik tarayıcı geçemiyor). **API'ler açık:**
  - Dosyalar: `curl "https://3d-api.si.edu/api/v1.0/content/file/search?q=<ad>&rows=20"` → her kalite için `uri` (GLB, Draco sıkıştırmalı).
    `150k-4096-high` (~6 MB) ana render, `150k-2048-medium` deneme.
  - Lisans ve kayıt: `curl "https://api.si.edu/openaccess/api/v1.0/search?q=<ad>&api_key=DEMO_KEY"` → `descriptiveNonRepeating.metadata_usage.access`
    = `CC0`; `online_media` içinde `3d_voyager` varsa taramalı kayıt odur. Aynı kayıttaki stüdyo fotoğrafları da CC0:
    `https://ids.si.edu/ids/deliveryService?id=<idsId>&max=3000`.
  - **Asıl mı kopya mı:** aynı nesnenin replika kaydı olabilir (Lincoln: 1978 replika ayrı kayıt). Taramalı kaydın `freetext.notes`'unu oku (ör. "Transfer from the U.S. Patent Office, 1922").
- assets.csv: kaynak "Smithsonian Open Access (NMAH), CC0", kayıt kimliği ve 3D paket kimliği.

## Kullanım
- timeline: `style: object3d`, `props: {comp: "MuseumObject", video: "episodes/<EP>/assets/object3d/<sid>.mp4", model: "episodes/<EP>/assets/3d/<ad>.glb",
  up: [-1.5708, 0, 0], shot: "reveal" | "macro" | "lift" | "turntable"}` → `tools/woodcut_render.py <EP> [--only sNN] [--force]` (sahne süresiyle klip), ana video oynatır.
- Tek kare: `npx remotion still src/index.ts MuseumObject out/trials/x.png --frame=75 --props='{"model":"…","up":[-1.5708,0,0],"shot":"macro"}'` (~20 sn).
- Çekimler: `reveal` karanlıktan tek spot yanar + 34° yavaş yörünge + dolly in · `macro` yalayan ışıkta gövde boyunca alçak truck (fov 24) ·
  `lift` su + kum sığlığı, nesne yükselir ve ileri süzülür · `turntable` 360°.
- Işık (three-scenes.md bitiş kutusu): sıcak spot anahtar (gölgeli, 2048 harita), soğuk arka kenar ışığı, çok az ortam; ACES; toz hüzmede; CSS vinyet + tane.

## Tuzaklar (bu oturumda yaşandı)
- **Tuval model yüklenince açılmalı** (`root ? <ThreeCanvas> : null`): tuval önce açılıp sahne sonradan eklenirse tek kare render'da hiçbir şey çizilmez
  (simsiyah kare; Remotion yeni kareyi yalnız kare değişince ister).
- Yükleme `delayRender` + `GLTFLoader` + `DRACOLoader`; çözücü `content/vendor/draco/` (node_modules'tan kopya, `staticFile("vendor/draco/")`).
- **Yukarı ekseni kontrol et:** Lincoln taraması yan yatık geldi (direkler yatay). `up: [-π/2, 0, 0]`. Stüdyo fotoğrafıyla karşılaştır.
- Kamera: tuvalin varsayılan kamerasını `useThree(s => s.camera)` ile her karede kur (ayrı kamera + `set({camera})` çalışmadı).
- Dikey kadraj: yatay görüş açısı dar (fov 30 → ~17°). Uzun nesneyi yan görünüşte değil 3/4 açıdan, 5-7 birim uzaktan çek (nesne uzun ekseni = 2 birim).
- **Su siyah görünüyordu** (EP013 s05 v1, kullanıcı "su belli olmuyor"): yalnızca koyu, parlak bir düzlem karanlık sahnede hiçbir şey yansıtmıyor.
  Düzeltme: `Reflector` (three/examples/jsm/objects; tekne ve spot suda yansır) + üstünde yarı saydam (0.55) dalgacıklı fiziksel yüzey
  (prosedürel normal haritası `rippleNormals`, kare ile kaydırılır; `RoomEnvironment` PMREM ortamı yalnız bu malzemede). Karanlık sahnede su = yansıma.

## Kodla kurulmuş nesne: `BoxTwist` (2026-11-12, EP015)
Taraması olmayan kahraman nesne için prosedürel kardeş: `studio/src/styles/object3d/BoxTwist.tsx` (kompozisyon `BoxTwist`, 1080×1920). İki ucu açık uzun
kraft kutu (4 duvar + uçlarda açık kapakçık, tek geometri, yüz normaline göre düzlemsel UV), CPU'da burulma: kesit x'e göre θ(x) = twist·x/(L/2)
döner, `computeVertexNormals` her karede. Malzeme `content/textures/cardboard002/` (ambientCG Cardboard002 renk/normal/pürüz, CC0); zemin `wood-table-large` koyu tint.
- timeline: `style: object3d`, `props: {comp: "BoxTwist", video: "episodes/<EP>/assets/object3d/<sid>.mp4", shot: "hero", compProps: {twistAt: "<kelime>", twistDeg: 16}}`
  → `tools/woodcut_render.py <EP> --only sNN [--force]` (302 kare ≈ 30 sn). `hero`: karanlıktan spot (0.25 sn gecikme, 1.3 sn inOut; önceki sahne `dim` ile
  kararıp düz kesmeyle gelir), 60° → 46° yörünge + dolly; `twistAt` kelimesinden 200 ms önce 2.8 sn'lik sin yayı (yükselir, döner).
- Saydam still (kesik / objectWipe PNG'si): `npx remotion still src/index.ts BoxTwist out.png --frame=0 --image-format=png --scale=2 --props='{"shot":"still","twist":0,"azimuth":28}'`
  (`gl.alpha`, zemin/sis/vinyet yok); sonra saydam kenara kırp (EP015 `visuals.py trim`). Bu kompozisyonda bitiş katmanı yok, `--scale=2` güvenli.
- Tuzaklar: dikey kadrajda kutu ilk denemede üst %10-30'a sıkıştı ve alt 2/3 boş zemindi → `lookAt` y −0.22, r 7.6; soğuk kenar ışığı zemini maviye boyuyordu
  (zemin `#4a3a2e`, rim 2.2). Cardboard001 yırtık oluklu karton dokusudur, temiz kraft için Cardboard002.
- Yeni prosedürel nesne = aynı iskelet (ışık, toz, vinyet, tane, `wordAt`) + kendi geometrisi; deformasyonu `userData.rest` kopyasından her karede yeniden hesapla.
