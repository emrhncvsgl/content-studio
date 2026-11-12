# paper-lantern (ajan talimatı)

Öğretici anlatım ve kanal uyarlaması: `docs/styles/paper-lantern.md`. Ham kurallar: `.studio/plugin/library/lemo/styles/paper-lantern/STYLE.md` (Lemo-Opuscar, MIT).
İlk kullanıcı: In Your Hand kanalı (2026-11-10). Durum: kit + bir deneme sahnesi (`LanternSea`); ana videoya bağlama yolu woodcut ile aynı olacak (aşağıda).

## Kit (`studio/src/styles/lantern/`)
- `paper.ts`, `lib.ts`: Lemo `paper.js`/`lib.js` (değiştirilmeden): `sheet({U,w,h,draw,glowDraw,glow,glowCol,glowRes,trans,z,x,y,ax,ay,shadow,recv})`,
  `skyPanel`, `moon`/`setMoon`, `burst`, `finish`, `paint`, `text`. Birimler metre, y yukarı; `draw(x)` metrik canvas (merkez orijin).
- `kit.tsx`: `useLantern(w,h,{light,lightR,lightCol,floor,key,keyPos,keyTarget,amb,ambCol,bg})` → `{S (U, add, key, amb), camera, setPost(bloom, grade)}`;
  `aim(cam,[px,py,pz,tx,ty,tz],t,{hand,fov})`; `tint(mesh,hex)`; `cut(x,fn)`.
- Katman `useMemo` içinde bir kez kurulur (`S.add(sheet(...))`); kare başına yalnız konum/döndürme/uniform değişir (`t = frame/fps`).
- Işık: `S.U.uLit.value` (genel), katman başına `material.userData.u.uGlowLit.value` (pencere/kandil açılışı), `emissiveIntensity` (yanma gücü).

## Kurallar (stilden; vox kuralları burada GEÇMEZ)
1. Her planda 6-9 katman, değer merdiveni: arka açık-soğuk-saydam (`trans` .85) → ön koyu-opak (`trans` .05). Tek sıcaklık; ışık sıcak altın; vurgu kanal rengi.
2. Kâğıt hareketi: kayma, pim etrafında dönme, eksende büyüme, ışık. Morph/esneme yok. El kamerası ≤ 0.6 mm. Whip pan, dijital zoom, toz, halftone, gren kaplaması YOK.
3. Işık açılışı sırayla: kaynak → katmanlar (0.4 sn aralık) → pencereler/kandil → titreşim. Büyük olay ışıktır.
4. Geçiş: çözülme 0.5-1.2 sn, iris, ışık söner/yanar, ön katman perdesi (yarılar ön kenarda tam buluşur).
5. Kanal (In Your Hand): İslami geometri (sivri kemer, sekiz kollu yıldız/girih kesikleri, maşrabiye, fener), dini tasvir kuralları (kanal profili), enstrüman yok.
6. Yazı kâğıttır (şerit kenarından büyür); kâğıtta görünen kelime altyazıda tekrarlanmaz. Altyazı bandı (alt koyu bölge) karanlık kalır; ışık noktası yazının üstüne gelmez.

## Tuzaklar
- Katmanı `useEffect`'te sahneye eklemek ilk kareyi boş çıkarır (Remotion kareyi o anda çeker): kit kökü `useMemo` içinde `scene.add` yapar (2026-11-10).
- Delik kesmeden önce opak dolgu; gölgeye katılmayan katman `shadow:false` + `recv:false`; renk ayarı her karede `setPost` ile baştan verilir.
- 9:16'da `fov` dikeydir: 30° ve kamera z ≈ 0.9 → görünür yükseklik ≈ 0.48 m (katman genişlikleri buna göre).

## Ana videoya bağlama (yapılacak)
woodcut ile aynı: her sahne ayrı kompozisyon (`Lantern<Ad>`), `tools/woodcut_render.py` kalıbıyla sahne süresinde render → `assets/lantern/<sid>.mp4`,
timeline'da `style: woodcut` benzeri bir `lantern` klip stili (sessiz video) + üstte altyazı. Kelime zamanları `cueWords` ile kompozisyona props olarak.

## İlk kullanım örneği (TRIZ Academy EP014): `LanternDavy.tsx` (2026-11-12)
- Bilim kesiti (alev, tel, ısı akışı) ve önden ızgara + lamba silueti; aynı dosyada `shot: mesh | grid | out`. Bağlama woodcut ile aynı (`props.comp/video/compProps`).
- Isı akışı: telin `glowDraw`'ı = tel (delikler hariç), `userData.u.uGY = (merkez y, bant genişliği, dış katsayı, 1)` ile parlama tel boyunca yayılır;
  `emissiveIntensity` her karede (`glowI`). Renk geçişi `tint(m, Color.lerp(...).getHexString())` (turuncu → soğuk mavi).
- "Bir açıklık → çok delik": çubuklar ayrı ince kâğıt şeritler, kayarak girer (morph yok); pull-back reveal kamera z 0.24 → 0.92.
- Altyazı bandı dünya koordinatında: kamera z 0.9, fov 30, bakış y 0 → kare y 0.60-0.78 = dünya y −0.05 … −0.13.

## Mekanizma sahnesi: soyut kâğıt şekil yetmez (EP014 v6, 2026-11-12)
Kullanıcı EP014 s06 (kâğıt fener kesiti: gri gaz lekeleri, tek çubuk tel, küçük alev) için "soyut ve kaba, ısı telden geçemiyor okunmuyor" dedi.
Videonun kalbi olan "nasıl çalışır" anında fener stili yerine detaylı 2D mekanizma: `studio/src/styles/lantern/MeshHeat.tsx` (kompozisyon `MeshHeat`,
`shot: mech|calm`, klip `tools/woodcut_render.py` ile). Okunurluğu sağlayan öğeler:
- **Ölçek ve gerçek geometri:** dokuma örgü kesiti (15 yuvarlak atkı teli, metal radyal gradyan + speküler; çözgü teli aralarından sinüsle geçer, arka/ön
  sırayla çizilir), arkada bulanık ikinci sıra.
- **İki taraf iki renk dünyası:** zemin solda sıcak kahve, sağda soğuk lacivert; gaz = 500 soğuk mavi akış çizgisi sağdan sola, tel yakınında en yakın
  boşluğa sapar (`lerp(y0, nearestGap, exp(-((x-WX)/1.9R)²))`), ateş cephesine girince turuncu kıvılcım olup söner.
- **Ateş = ayrı diller:** 58 bezier dil (kökte saydam koyu kırmızı → cephede sarı-beyaz, `lighter`, blur 3) + bulanık kor tabanı + cephede ince mavi
  tepkime çizgisi. Tek dolu blok "sarı duvar" gibi okunur (ilk deneme), kullanma.
- **Isı = kara cisim paleti** tel kesitinde soldan (ateş tarafı) radyal; sıcaklık alanı zamanla tel boyunca genişler; ısı okları alevden tele girer,
  tel boyunca yukarı/aşağı uzağa akar. Boşluktan sızan alev uçları ısı çekilince küçülüp söner. Kelime ipuçları: burned / inside. / metal / heat. / outside,.
- Lirik kapanış (`calm`): aynı kesit geniş planda, sonda her şey söner (logo ShortsVideo `outro` katmanında).
