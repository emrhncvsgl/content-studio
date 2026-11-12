// Tek paketleme + tek tarayıcı ile çok kare (tools/animatic.py çağırır). Her `remotion still` çağrısı yeniden paketler (~20 sn);
// burada bir kez paketlenir, sahne başına kare yalnızca renderStill.
// node scripts/stills.mjs <timeline (content/'e göre)> <outDir> <scale> <frame1,frame2,...>
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";

const [tl, outDir, scale, frames] = process.argv.slice(2);
const root = path.resolve(import.meta.dirname, "..");
const serveUrl = await bundle({ entryPoint: path.join(root, "src/index.ts"), publicDir: path.join(root, "../content"),
  symlinkPublicDir: true });   // content/ ~GB: kopyalanırsa disk dolar (2026-11-09 ENOSPC)
const inputProps = { timeline: tl };
const browser = await openBrowser("chrome", { chromiumOptions: { gl: "angle" } });
const composition = await selectComposition({ serveUrl, id: "ShortsVideo", inputProps, puppeteerInstance: browser, timeoutInMilliseconds: 180000 });   // font indirmesi 30 sn aşabiliyor (EP010)
const list = frames.split(",").map(Number);
for (const [i, f] of list.entries()) {
  await renderStill({ serveUrl, composition, inputProps, frame: f, output: path.join(outDir, `f${String(i).padStart(4, "0")}.jpg`),
    imageFormat: "jpeg", jpegQuality: 85, scale: Number(scale), puppeteerInstance: browser, timeoutInMilliseconds: 180000 });
  process.stdout.write(`\r[still] ${i + 1}/${list.length}`);
}
await browser.close({ silent: true });
console.log("");
