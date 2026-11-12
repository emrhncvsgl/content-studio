// Görsel dilin 7 katmanı (kullanıcı 2026-11-11: "stil ne teknik ne ayırt edemiyorum, görsel dilim zayıf"). Bir sahneyi bu katmanlara ayırır:
//  1 Görünüş (stil): kare neye benziyor · 2 Malzeme: görüntü nereden geliyor · 3 Teknik: nasıl üretiliyor · 4 Kamera: nereden bakıyoruz, nasıl hareket
//  5 Işık ve renk: ruh hâli · 6 Kurgu: nasıl bağlanıyor, hangi tempoda · 7 Doku: yüzey nasıl hissettiriyor  (+ Ses)
// Ayırt etme testi: DURDUR → 1, 5, 7 görünür · OYNAT → 4, 6 hareketle gelir · "NASIL YAPILMIŞ?" → 2, 3.
// Yeni stil eklenince TECHNIQUE'e bir satır eklenir (görünüş ile teknik ayrı eksenlerdir: ağaç baskı görünüşü 3D teknikle yapılabilir).
import type { Timeline } from "../src/schema/timeline";
import { CAMERA_HINT, TRANSITIONS } from "./glossary";

type Scene = Timeline["scenes"][number];
export type Layer = { key: string; title: string; question: string; lines: string[] };

export const LAYER_INFO: { key: string; title: string; question: string; test: "durdur" | "oynat" | "nasıl" | "dinle" }[] = [
  { key: "look", title: "1 · Görünüş (stil)", question: "Kare neye benziyor?", test: "durdur" },
  { key: "material", title: "2 · Malzeme", question: "Görüntü nereden geliyor?", test: "nasıl" },
  { key: "technique", title: "3 · Teknik", question: "Nasıl üretiliyor?", test: "nasıl" },
  { key: "camera", title: "4 · Kamera", question: "Nereden bakıyoruz, nasıl hareket ediyor?", test: "oynat" },
  { key: "light", title: "5 · Işık ve renk", question: "Hangi ruh hâli?", test: "durdur" },
  { key: "edit", title: "6 · Kurgu", question: "Nasıl bağlanıyor, hangi tempoda?", test: "oynat" },
  { key: "texture", title: "7 · Doku", question: "Yüzey nasıl hissettiriyor?", test: "durdur" },
  { key: "sound", title: "+ Ses", question: "Ne duyuyoruz?", test: "dinle" },
];

// stil → üretim tekniği (görünüşten bağımsız)
const TECHNIQUE: Record<string, string> = {
  "vox-explainer": "2D katmanlı kolaj: kesilmiş kâğıt ve fotoğraf parçaları sanal bir masada, derinlik düzlemleri ve sanal kamera",
  "ken-burns-photo": "2D fotoğraf hareketi (yakınlaşma/kayma)",
  "archival-film": "2D fotoğraf hareketi + eski film taklidi (titreme, çizik, tane)",
  "photo": "2D fotoğraf hareketi",
  "object3d": "gerçek 3D: müze taramasının üç boyutlu modeli, sanal ışık ve kamera (three.js)",
  "depth-photo": "2.5D çok katmanlı: derinlik haritasıyla resim katmanlara bölünür, kamera aralarında gezer",
  "woodcut": "3D sahne + baskı shader'ı: ışık, kodla oyulmuş ağaç baskı çizgilerine çevrilir",
  "lantern": "kodla çizilmiş kâğıt fener ışığı ve gölge",
  "manim": "kodla matematik/fizik animasyonu (Manim)",
  "blueprint-diagram": "kodla vektör teknik çizim, çizgiler kendini çizer",
  "kinetic-type": "hareketli tipografi: kelimeler animasyonla",
  "footage": "gerçek video görüntüsü (arşiv filmi)",
};

const walk = (o: unknown, f: (k: string, v: unknown) => void, k = "") => {
  if (o && typeof o === "object") Object.entries(o as Record<string, unknown>).forEach(([kk, v]) => (f(kk, v), walk(v, f, kk)));
};
const media = (props: unknown) => {
  const out = new Set<string>();
  walk(props, (_k, v) => { if (typeof v === "string" && /\.(png|jpe?g|webp|glb|mp4|svg)$/i.test(v) && !/assets\/(object3d|depth)\/s\d+\.mp4$/.test(v)) out.add(v); });
  return [...out];
};
const sourceKind = (p: string) =>
  /\.glb$/i.test(p) ? "3D tarama" : /\/photos\/|nmah|photo/i.test(p) ? "müze/arşiv fotoğrafı" : /cutout|sticker/i.test(p) ? "kesilmiş nesne (cutout)"
  : /textures?\//i.test(p) ? "yüzey dokusu" : /depth\/.*\.L\d/i.test(p) ? "derinlik katmanı" : /engraving|print|litho|drawing|patent/i.test(p) ? "gravür/baskı/çizim" : "görsel";

export const sceneLayers = (sc: Scene, tl: Timeline, k: number, styleName?: string, styleDoes?: string): Record<string, string[]> => {
  const p = sc.props as Record<string, any>;
  const cp = (p.compProps ?? {}) as Record<string, any>;
  const L: Record<string, string[]> = { look: [], material: [], technique: [], camera: [], light: [], edit: [], texture: [], sound: [] };
  // 1 görünüş
  // klip bileşeni stilden farklı bir görünüş veriyorsa (ör. lantern altında MeshHeat) görünüşü klipten yaz
  if (p.comp === "MeshHeat") L.look.push("mekanizma animasyonu: ışıklı 2D kesit (tel örgü, ısı renkleri, gaz akışı); kâğıt fener dokusu yok");
  else L.look.push(`${styleName ?? sc.style}${styleDoes ? ": " + styleDoes : ""}`);
  if (sc.style === "object3d") L.look.push("müze belgeseli: karanlık boşlukta tek nesne");
  // 2 malzeme
  const m = media(p);
  const byKind: Record<string, string[]> = {};
  m.forEach((x) => (byKind[sourceKind(x)] ??= []).push(x.split("/").pop()!));
  Object.entries(byKind).forEach(([kind, files]) => L.material.push(`${kind}: ${files.slice(0, 3).join(", ")}${files.length > 3 ? ` +${files.length - 3}` : ""}`));
  if (!m.length) L.material.push("kodla üretilmiş (dış görsel yok)");
  // 3 teknik
  L.technique.push(p.comp === "MeshHeat" ? "Remotion 2D canvas, kodla çizilmiş mekanizma; önceden render edilmiş klip (MeshHeat.tsx)" : TECHNIQUE[sc.style] ?? sc.style);
  if (p.planes) L.technique.push("2 katmanlı 2.5D: ön nesne arka plandan ayrılmış, farklı hızda kayar (photo_planes)");
  if (p.cuts) L.technique.push(`sahne içinde ${(p.cuts as unknown[]).length + 1} çekim (kesmeyle görsel değişir)`);
  if (p.motionBlur) L.technique.push("hareket bulanıklığı (motion blur)");
  if (p.stepFps) L.technique.push(`stop-motion hissi: hareket saniyede ${p.stepFps} kare`);
  // 4 kamera
  const cam = CAMERA_HINT(p); if (cam) L.camera.push(cam);
  if (p.camera?.push) L.camera.push(`yavaş itme (push): ${p.camera.push.zoom > 0 ? "+" : ""}${p.camera.push.zoom} zoom, ${(p.camera.push.ms ?? 0) / 1000} sn`);
  if (typeof p.handheld === "number" && p.handheld > 0) L.camera.push(`el kamerası titreşimi ${p.handheld}`);
  if (p.dof || cp.dof) L.camera.push("alan derinliği: bir derinlik net, gerisi bulanık");
  if (sc.style === "object3d") L.camera.push({ reveal: "karanlıktan yavaş yörünge + dolly in", bellows: "yakın plana iniş, sonra yan görünüşe geri çekilme", rest: "karşı taraftan yavaş geri çekilme", turntable: "360° tur" }[String(p.shot)] ?? "");
  // 5 ışık ve renk
  if (p.bg) L.light.push(`zemin rengi ${p.bg}`);
  if (p.light && typeof p.light === "object") {
    const lx = Number(p.light.x ?? 0.5), ly = Number(p.light.y ?? 0.5);
    const where = `${ly < 0.33 ? "üst" : ly > 0.66 ? "alt" : "orta"} ${lx < 0.33 ? "sol" : lx > 0.66 ? "sağ" : "orta"}`.replace("orta orta", "orta");
    L.light.push(`ışık kaynağı ${where}, renk ${p.light.color ?? "beyaz"}, güç ${p.light.strength ?? "?"}${p.light.breathe ? ", hafif nefes alır (titreşir)" : ""}`);
  } else if (p.light) L.light.push(`ışık: ${p.light}`);
  if (sc.style === "object3d") L.light.push("tek sıcak spot (anahtar ışık) + soğuk arka kenar ışığı, siyah zemin");
  if (sc.style === "depth-photo") L.light.push("sepya gravür; uzak katmanlar hafif koyulaşır (hava perspektifi)");
  if (p.film) L.light.push(`eski film renk tonu${typeof p.film === "string" ? ` (${p.film})` : ""}`);
  if (sc.emotion) L.light.push(`duygu: ${sc.emotion}`);
  // 6 kurgu
  L.edit.push(`süre ${(sc.durationFrames / tl.fps).toFixed(1)} sn (videonun ortalaması ${(tl.durationInFrames / tl.fps / tl.scenes.length).toFixed(1)} sn)`);
  if (k > 0) L.edit.push(`giriş: ${TRANSITIONS[sc.transition]?.name ?? sc.transition}`);
  const next = tl.scenes[k + 1]; if (next) L.edit.push(`çıkış: ${TRANSITIONS[next.transition]?.name ?? next.transition}`);
  const words = sc.words[tl.captions.lang] ?? [];
  if (words.length) L.edit.push(`anlatım temposu ${(words.length / Math.max(0.5, sc.durationFrames / tl.fps)).toFixed(1)} kelime/sn`);
  // 7 doku
  const f = (tl as unknown as { finish?: Record<string, number> }).finish;
  if (f) L.texture.push(`bütün videoda: ${Object.entries(f).map(([a, v]) => `${{ fringe: "kenar renk saçağı", dust: "toz", vignette: "vinyet", grain: "tane" }[a] ?? a} ${v}`).join(", ")}`);
  if (p.paper) L.texture.push("kâğıt dokusu");
  if (p.halftone) L.texture.push("baskı noktaları (halftone)");
  if (p.lightWrap) L.texture.push("ışık sarması (light wrap): arka plan ışığı nesne kenarına taşar");
  if (p.surface) L.texture.push("masa yüzeyi dokusu");
  if (["object3d", "depth-photo"].includes(sc.style)) L.texture.push("film tanesi + vinyet");
  // ses
  const sfx = ((tl.sfx ?? []) as (Timeline["sfx"][number] & { note?: string })[]).filter((x) => x.frame >= sc.startFrame && x.frame < sc.startFrame + sc.durationFrames && x.note !== "bed");
  if (sfx.length) L.sound.push(`efekt: ${sfx.map((x) => x.file.split("/").pop()!.replace(/\.(wav|mp3|ogg)$/, "")).join(", ")}`);
  if (tl.music) L.sound.push("müzik altta (anlatım konuşurken kısılır: ducking)");
  Object.keys(L).forEach((key) => (L[key] = L[key].filter(Boolean)));
  return L;
};
