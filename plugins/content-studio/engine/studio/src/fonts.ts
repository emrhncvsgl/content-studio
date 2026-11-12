import { continueRender, delayRender, staticFile } from "remotion";
import manifest from "../../content/fonts/manifest.json";

// Fontlar YERELDEN (content/fonts, tools/fetch_fonts.py indirir; hepsi SIL OFL 1.1). Eskiden @remotion/google-fonts render sırasında
// Google'dan çekiyordu; headless Chrome indiremeyince delayRender zaman aşımı (EP010, 2026-11-10). Yeni font: fetch_fonts.py FONTS'a ekle,
// betiği çalıştır, aşağıya aile adını yaz.
// Marka fontu channel.yaml brand.font (Inter); teknik etiketler için mono.
export const INTER = "Inter";
export const MONO = "IBM Plex Mono";
export const ALFA = "Alfa Slab One";
// Bölüm başlığı (uzun video): baskı harfi, küçük büyük harf (IM Fell English SC; ağaç baskı grameri: kâğıt payında baskı harfi)
export const FELL_SC = "IM Fell English SC";
// paper-lantern altyazısı (cap-serif): Lemo STYLE.md §4 "OFL serif (Cormorant)"
export const CORMORANT = "Cormorant Garamond";

type Face = { family: string; weight: string; unicodeRange: string; file: string };

if (typeof document !== "undefined") {
  const handle = delayRender("Yerel fontlar (content/fonts)");
  Promise.all(
    (manifest as Face[]).map((f) =>
      new FontFace(f.family, `url(${staticFile(f.file)}) format("woff2")`, { weight: f.weight, style: "normal", unicodeRange: f.unicodeRange, display: "block" })
        .load()
        .then((face) => (document.fonts as unknown as { add: (f: FontFace) => void }).add(face)),
    ),
  )
    .catch((e) => console.error("font yüklenemedi", e))
    .finally(() => continueRender(handle));
}
