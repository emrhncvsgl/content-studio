// MANA001 ManaPromo render (Node API; public = ../content, symlinkPublicDir: kopyalama yok).
// Kullanım: node render_promo.mjs <bölüm dizini> [--frames=a-b] [--out=x.mp4] [--stills=10,100,...]
import path from "node:path";
import fs from "node:fs";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";

const ep = path.resolve(process.argv[2]);
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
const content = path.resolve("../content");
const config = path.relative(content, path.join(ep, "clips/promo.json"));
const serveUrl = await bundle({ entryPoint: path.resolve("src/promo-index.ts"), publicDir: content, symlinkPublicDir: true });
const chromiumOptions = { gl: "angle" };
const inputProps = { config };
const composition = await selectComposition({ serveUrl, id: "ManaPromo", inputProps, chromiumOptions, timeoutInMilliseconds: 180000 });
const stills = arg("stills");
if (stills) {
  const dir = arg("dir") ?? path.join(ep, "render/stills"); fs.mkdirSync(dir, { recursive: true });
  for (const fr of stills.split(",").map(Number)) {
    await renderStill({ serveUrl, composition, inputProps, frame: fr, output: path.join(dir, `f${String(fr).padStart(4, "0")}.jpg`),
      imageFormat: "jpeg", jpegQuality: 90, chromiumOptions, timeoutInMilliseconds: 180000 });
    console.log("still", fr);
  }
  process.exit(0);
}
const out = arg("out") ?? path.join(ep, "render/MANA001.video.mp4");
fs.mkdirSync(path.dirname(out), { recursive: true });
const fr = arg("frames")?.split("-").map(Number);
await renderMedia({ serveUrl, composition, inputProps, codec: "h264", crf: 15, outputLocation: out, muted: true,
  imageFormat: "png", pixelFormat: "yuv420p", concurrency: 2, chromiumOptions, timeoutInMilliseconds: 180000,
  frameRange: fr ? [fr[0], fr[1]] : undefined,
  onProgress: ({ progress }) => { const p = Math.round(progress * 100); if (p % 10 === 0) process.stdout.write(`${p}% `); } });
console.log("\n" + out);
