// Editör terim sözlüğü: sahne analiz panelinde geçiş/kamera/stil terimlerinin kısa Türkçe açıklaması (kullanıcı kurgu dilini öğreniyor).
// Yeni geçiş türü ya da kamera terimi eklenince buraya da bir satır eklenir.
export const TRANSITIONS: Record<string, { name: string; what: string; when: string }> = {
  cut: { name: "Düz kesme (cut)", what: "Bir plandan ötekine hiçbir efekt olmadan geçiş.", when: "En yaygın ve en görünmez geçiş; tempo ve netlik için." },
  blur: { name: "Bulanık geçiş (blur dissolve)", what: "Eski plan bulanıklaşarak yenisine karışır.", when: "Benzer iki görüntü arasında yumuşak bağ; aynı konu, farklı kaynak." },
  fog: { name: "Sis geçişi (fog)", what: "Kadrajı sis/duman kaplar, açılınca yeni sahne gelir.", when: "Zaman ya da yer atlaması (1831 → 1848 gibi)." },
  portal: { name: "Portal (nesneye dalış)", what: "Kamera sahnedeki bir nesnenin içine dalar, yeni sahne onun içinden açılır.", when: "Yer/zaman değişimi, nesne iki sahneyi bağlıyorsa. Bizim güçlü yanımız; videoda en çok 2." },
  pullback: { name: "Geri çekilme (pull-back reveal)", what: "Kamera geri çekilir, yeni sahne çevreden açılır.", when: "Büyük resmi göstermek, ölçek değişimi." },
  zoomblur: { name: "Zoom bulanıklığı", what: "Hızlı yakınlaşma + hareket bulanıklığı ile geçiş.", when: "Enerjik anlar; az ve bilerek." },
  whip: { name: "Savurma (whip pan)", what: "Kamera hızla yana savrulur, bulanık iz yeni plana bağlanır.", when: "Hızlı yön değişimi, enerji." },
  slide: { name: "Kaydırma (slide)", what: "Yeni plan yandan iterek gelir.", when: "İki şeyi yan yana koymak (Lincoln çıkar, ortağı girer)." },
  wipe: { name: "Silme (wipe)", what: "Bir çizgi kadrajı süpürür, arkasında yeni plan kalır.", when: "Bölüm/liste geçişleri." },
  objectWipe: { name: "Nesneyle silme", what: "Kadrajdan geçen bir nesne eski planı siler.", when: "Gerçek bir nesne iki sahneyi bağlıyorsa." },
  flash: { name: "Parlama (flash)", what: "Kısa beyaz parlama ile kesme.", when: "Fotoğraf çekimi, şok anı." },
  zoom: { name: "Yakınlaşma geçişi", what: "Yeni plan yakınlaşarak açılır.", when: "Ayrıntıya girerken." },
  cardflip: { name: "Kart çevirme", what: "Görüntü bir kart gibi dönüp arka yüzünü gösterir.", when: "Önce/sonra, iki yüzlü bilgi." },
  leak: { name: "Işık sızması (light leak)", what: "Film ışık sızıntısı ile geçiş.", when: "Nostalji, arşiv havası." },
  rgb: { name: "RGB kayması", what: "Renk kanalları kayarak geçiş.", when: "Dijital/glitch hissi; nadiren." },
  halftoneWipe: { name: "Baskı noktalı silme", what: "Gazete baskı noktalarıyla silme.", when: "Gazete/basın sahneleri." },
  matte: { name: "Maske geçişi (matte)", what: "Yeni plan bir şeklin içinden açılır.", when: "Şekil eşleşmesi (match cut) ile." },
  surfaceTilt: { name: "Yüzey eğme", what: "Masa yüzeyi eğilerek yeni plana geçer.", when: "Vox kolaj masası sahneleri." },
  disc: { name: "Disk", what: "Dairesel açılma.", when: "Saat, mercek, yuvarlak nesneler." },
  door: { name: "Kapı", what: "İki kanat açılır gibi.", when: "İçeri girme, açılış." },
  window: { name: "Pencere", what: "Bir pencere çerçevesinden yeni plana.", when: "Bakış, dış dünya." },
};

export const TERMS: Record<string, string> = {
  "dolly in": "Kamera öne doğru gerçekten ilerler (zoom değil); nesneler arasındaki derinlik değişir.",
  "dolly out": "Kamera geriye çekilir.",
  zoom: "Merceğin odak uzaklığı değişir; kamera yerinde durur, derinlik değişmez (gözetim hissi).",
  push: "Konuya doğru yavaş ilerleme; gerilim ya da dikkat.",
  truck: "Kamera yana doğru kayar (pan değil: dönmez, yer değiştirir).",
  pan: "Kamera yerinde sağa/sola döner.",
  orbit: "Kamera nesnenin etrafında yay çizer.",
  parallax: "Kamera hareket edince yakındaki şeylerin uzaktakilerden hızlı kayması; derinlik hissini verir.",
  "match cut": "İki plan arasında şekil ya da hareket eşleşmesiyle kesme (s05 gövde yan görünüşü → s06 patent çizimi).",
  inertia: "Yumuşatma türü: hareket ilk karede zaten akar, kesmede hâlâ hareketlidir; mekanik değil, elle çekilmiş hissi.",
  "heavy ease-out": "Hızlı başlar, uzun ve yavaş durur; ağır bir şeyin oturması gibi.",
  dof: "Alan derinliği: bir derinlik net, önü/arkası bulanık.",
  "ken burns": "Durağan fotoğrafta yavaş yakınlaşma/kayma.",
  "j-cut": "Sonraki sahnenin sesi, görüntüsünden önce başlar.",
};

export const CAMERA_HINT = (props: Record<string, unknown>) => {
  const f = props.from as { zoom?: number; x?: number; y?: number } | undefined, t = props.to as { zoom?: number; x?: number; y?: number; ease?: string } | undefined;
  if (props.shot) return `3D çekim: ${String(props.shot)}`;
  const cp = props.compProps as Record<string, unknown> | undefined;
  if (cp?.orbit !== undefined) return `derinlik kamerası: yana kayma + ${cp.orbit}° yörünge, dolly in`;
  if (!f || !t) return null;
  const dz = (t.zoom ?? 1) - (f.zoom ?? 1), dx = (t.x ?? 0.5) - (f.x ?? 0.5), dy = (t.y ?? 0.5) - (f.y ?? 0.5);
  const parts = [];
  if (Math.abs(dz) > 0.02) parts.push(dz > 0 ? `push in (zoom ${f.zoom ?? 1} → ${t.zoom ?? 1})` : `pull out (zoom ${f.zoom ?? 1} → ${t.zoom ?? 1})`);
  if (Math.abs(dx) > 0.02) parts.push(dx > 0 ? "sağa kayma" : "sola kayma");
  if (Math.abs(dy) > 0.02) parts.push(dy > 0 ? "aşağı kayma" : "yukarı kayma");
  if (t.ease) parts.push(`yumuşatma: ${t.ease}`);
  return parts.join(" · ") || "sabit kadraj";
};
