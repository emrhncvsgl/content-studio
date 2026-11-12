// Stüdyo editörü sunucusu (docs/editor/DESIGN.md; 1. aşama: salt okuma). Yerel: http://localhost:3100
// Çalıştır: cd studio && node editor/server.mjs   (ilk açılışta arayüzü esbuild ile paketler; --watch ile değişince yeniden paketler)
// Sunar: /            → editör arayüzü
//        /api/...     → bölüm listesi, bölüm özeti (timeline + storyboard gerekçeleri + katalog), küçük resimler
//        diğer her yol → content/ klasörü (Remotion staticFile kökü; video/ses için Range desteği)
// 2. aşama: POST /api/episode/<id>/edit (ayar kaydı → editor.overrides.json + editor.changes.jsonl + timeline.json), /revert,
//   POST /api/episode/<id>/job (clip | patch | audio) → TEK iş kuyruğu (aynı anda bir ağır iş; bellek bekçisi kuralı), GET /api/jobs.
// Küçük resimler ffmpeg ile bir kez çıkarılır, render/editor/ altında önbelleklenir (video değişince yenilenir).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import yaml from "js-yaml";
import { makeClaude } from "./claude.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const CONTENT = path.join(ROOT, "content");
const PORT = Number(process.env.EDITOR_PORT || 3100);
const WATCH = process.argv.includes("--watch");

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".mp4": "video/mp4", ".webm": "video/webm", ".wav": "audio/wav", ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".glb": "model/gltf-binary", ".wasm": "application/wasm", ".md": "text/markdown; charset=utf-8" };

// ---------- arayüz paketi ----------
const buildOpts = {
  entryPoints: [path.join(HERE, "app.tsx")], bundle: true, format: "esm", outfile: path.join(HERE, "dist/app.js"), jsx: "automatic",
  loader: { ".json": "json" }, define: { "process.env.NODE_ENV": '"development"' }, sourcemap: "inline", logLevel: "warning", target: "es2022",
};
if (WATCH) { const ctx = await esbuild.context(buildOpts); await ctx.watch(); } else { await esbuild.build(buildOpts); }

// ---------- veri ----------
const readJSON = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const epDir = (id) => {
  const d = fs.readdirSync(path.join(CONTENT, "episodes")).find((n) => n === id || n.startsWith(id + "-"));
  return d ? path.join(CONTENT, "episodes", d) : null;
};
let catalogCache = null;
const catalog = () => (catalogCache ??= { ...yaml.load(fs.readFileSync(path.join(ROOT, "catalog/styles.yaml"), "utf8")),
  axes: fs.existsSync(path.join(ROOT, "catalog/visual-axes.yaml")) ? yaml.load(fs.readFileSync(path.join(ROOT, "catalog/visual-axes.yaml"), "utf8")) : null });

// storyboard.md tablosundan sahne satırları: | sNN | süre | stil | tarif | varlık |  → {sNN: {cells: [...]}} (biçim bölümden bölüme değişebilir; ham hücreler döner)
const storyboardRows = (dir) => {
  const p = path.join(dir, "storyboard.md");
  if (!fs.existsSync(p)) return {};
  const out = {};
  let section = "";
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    if (line.startsWith("## ")) section = line.slice(3).trim();
    const m = line.match(/^\|\s*(s\d{2}[a-z]?)\s*\|(.*)\|\s*$/);
    if (m) (out[m[1]] ??= []).push({ section, cells: m[2].split("|").map((c) => c.trim()) });
  }
  return out;
};

const summary = (id) => {
  const dir = epDir(id);
  if (!dir) return null;
  const tlPath = path.join(dir, "timeline.json");
  const name0 = path.basename(dir);
  const lang0 = "en";
  const prep = { direction: fs.existsSync(path.join(dir, "direction.yaml")) ? yaml.load(fs.readFileSync(path.join(dir, "direction.yaml"), "utf8")) : null,
    script: fs.existsSync(path.join(dir, `script.${lang0}.json`)) ? `episodes/${name0}/script.${lang0}.json` : null,
    hasStoryboard: fs.existsSync(path.join(dir, "storyboard.md")) };
  if (!fs.existsSync(tlPath)) {
    const brief = fs.existsSync(path.join(dir, "brief.yaml")) ? yaml.load(fs.readFileSync(path.join(dir, "brief.yaml"), "utf8")) : {};
    const state = fs.existsSync(path.join(dir, "state.json")) ? readJSON(path.join(dir, "state.json")) : {};
    return { id: name0, dir: `episodes/${name0}`, timeline: null, brief, state, ...prep, storyboard: storyboardRows(dir), stale: [], audioStale: false, changes: [] };
  }
  const tl = readJSON(tlPath);
  const brief = fs.existsSync(path.join(dir, "brief.yaml")) ? yaml.load(fs.readFileSync(path.join(dir, "brief.yaml"), "utf8")) : {};
  const state = fs.existsSync(path.join(dir, "state.json")) ? readJSON(path.join(dir, "state.json")) : {};
  const name = path.basename(dir);
  // çalışma videosu (render_patch hedefi) önce, yoksa .final paket kopyası
  const render = ["", "final"].map((s) => `render/${name.split("-")[0]}${s ? "." + s : ""}.mp4`).find((r) => fs.existsSync(path.join(dir, r)));
  // yeniden üretilmesi gereken sahneler: son render'dan sonra editörde değişen ayarlar (editor.changes.jsonl)
  const renderM = render ? fs.statSync(path.join(dir, render)).mtimeMs : 0;
  const chg = fs.existsSync(path.join(dir, "editor.changes.jsonl")) ? fs.readFileSync(path.join(dir, "editor.changes.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
  const fresh = chg.filter((c) => Date.parse(c.ts) > renderM);
  const stale = [...new Set(fresh.filter((c) => c.scene !== "_" && !AUDIO_PATH.test(c.path)).map((c) => c.scene))];
  const audioStale = fresh.some((c) => c.scene === "_" || AUDIO_PATH.test(c.path));
  return { ...prep, id: name, dir: `episodes/${name}`, renderMtime: Math.round(renderM), stale, audioStale, changes: chg.slice(-30), timeline: `episodes/${name}/timeline.json`, brief, state, render: render ? `episodes/${name}/${render}` : null,
    storyboard: storyboardRows(dir), fps: tl.fps, width: tl.width, height: tl.height, durationInFrames: tl.durationInFrames, music: tl.music ?? null };
};

// küçük resim: son render'dan (yoksa boş) sahne ortası kare, 270 px; önbellek render/editor/thumbs
const thumb = (id, sid) => {
  const dir = epDir(id); if (!dir) return null;
  const tl = readJSON(path.join(dir, "timeline.json"));
  const sc = tl.scenes.find((s) => s.id === sid); if (!sc) return null;
  const s = summary(id); if (!s.render) return null;
  const out = path.join(dir, "render/editor/thumbs", `${sid}.jpg`);
  const src = path.join(CONTENT, s.render);
  if (!fs.existsSync(out) || fs.statSync(out).mtimeMs < fs.statSync(src).mtimeMs) {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const t = (sc.startFrame + sc.durationFrames * 0.55) / tl.fps;
    spawnSync("ffmpeg", ["-v", "error", "-y", "-ss", t.toFixed(2), "-i", src, "-frames:v", "1", "-vf", "scale=270:-2", "-q:v", "4", out]);
  }
  return fs.existsSync(out) ? out : null;
};


// ---------- düzenleme: editor.overrides.json (+ orig: ilk değerler, geri alma için) · editor.changes.jsonl (Claude'a geri bildirim) ----------
// Windows: venv yürütücüsü Scripts/python.exe (bin/python bir Git Bash yönlendiricisidir, Node onu çalıştıramaz).
const PY = path.join(ROOT, process.platform === "win32" ? "voice/.venv-chatterbox/Scripts/python.exe" : "voice/.venv-chatterbox/bin/python");
// Python araçları Türkçe metin okur/yazar: Windows'ta varsayılan kodlama cp1252 olduğundan UTF-8 modu her çağrıda açılır.
const PYENV = { ...process.env, PYTHONUTF8: "1" };
const CLIP_STYLES = new Set(["object3d", "depth-photo", "woodcut", "lantern", "lantern-text"]);
const AUDIO_PATH = /^(sfx|music|audio)\b|(^|\.)gainDb$|duckDb/;   // altyazı (words) görüntüye basılır → video yaması, ses değil
const getPath = (o, p) => p.split(".").reduce((a, k) => (a == null ? undefined : Array.isArray(a) ? a[Number(k)] : a[k]), o);
const setPath = (o, p, v) => {
  const ks = p.split(".");
  let a = o;
  ks.slice(0, -1).forEach((k, i) => { const key = Array.isArray(a) ? Number(k) : k; if (a[key] == null) a[key] = /^\d+$/.test(ks[i + 1]) ? [] : {}; a = a[key]; });
  const last = ks[ks.length - 1];
  if (Array.isArray(a)) a[Number(last)] = v; else if (v === null || v === undefined) delete a[last]; else a[last] = v;
};
const overridesFile = (dir) => path.join(dir, "editor.overrides.json");
const loadOverrides = (dir) => (fs.existsSync(overridesFile(dir)) ? readJSON(overridesFile(dir)) : { version: 1, edits: {}, orig: {} });
const target = (tl, sid) => (sid === "_" ? tl : tl.scenes.find((s) => s.id === sid));

const applyEdit = (id, { sid, changes, note }) => {
  const dir = epDir(id); if (!dir) throw new Error("bölüm yok");
  const tlPath = path.join(dir, "timeline.json"), tl = readJSON(tlPath), ov = loadOverrides(dir);
  const t = target(tl, sid); if (!t) throw new Error(`sahne yok: ${sid}`);
  const log = [];
  for (const { path: p, value } of changes) {
    const before = getPath(t, p);
    ((ov.orig[sid] ??= {}), p in ov.orig[sid] ? 0 : (ov.orig[sid][p] = before ?? null));
    (ov.edits[sid] ??= {})[p] = value;
    setPath(t, p, value);
    log.push({ ts: new Date().toISOString(), episode: path.basename(dir), scene: sid, style: sid === "_" ? null : t.style, path: p, from: before ?? null, to: value, note: note ?? null });
  }
  fs.writeFileSync(overridesFile(dir), JSON.stringify(ov, null, 1));
  fs.writeFileSync(tlPath, JSON.stringify(tl, null, 2));
  fs.appendFileSync(path.join(dir, "editor.changes.jsonl"), log.map((l) => JSON.stringify(l)).join("\n") + "\n");
  return { ok: true, n: log.length };
};

const revertEdit = (id, { sid, paths }) => {
  const dir = epDir(id), tlPath = path.join(dir, "timeline.json"), tl = readJSON(tlPath), ov = loadOverrides(dir), t = target(tl, sid);
  const ps = paths ?? Object.keys(ov.edits[sid] ?? {});
  for (const p of ps) {
    if (ov.orig[sid] && p in ov.orig[sid]) setPath(t, p, ov.orig[sid][p]);
    delete ov.edits[sid]?.[p]; delete ov.orig[sid]?.[p];
    fs.appendFileSync(path.join(dir, "editor.changes.jsonl"), JSON.stringify({ ts: new Date().toISOString(), episode: path.basename(dir), scene: sid, path: p, reverted: true }) + "\n");
  }
  fs.writeFileSync(overridesFile(dir), JSON.stringify(ov, null, 1));
  fs.writeFileSync(tlPath, JSON.stringify(tl, null, 2));
  return { ok: true, n: ps.length };
};

// ---------- tek iş kuyruğu ----------
const jobs = [];
let running = null;
const epShort = (dir) => path.basename(dir).split("-")[0];
const steps = (id, kind, sids) => {
  const dir = epDir(id), ep = epShort(dir), tl = readJSON(path.join(dir, "timeline.json"));
  const clipSids = sids.filter((sid) => CLIP_STYLES.has(tl.scenes.find((s) => s.id === sid)?.style));
  const run = (args, cwd = ROOT) => ({ cmd: args[0], args: args.slice(1), cwd });
  if (kind === "proxy") {   // akıcı izleme kopyası: 540 px, sık anahtar kare (hızlı sarma), sesli
    const src = path.join(dir, `render/${ep}.mp4`), out = path.join(dir, "render/editor/proxy.mp4");
    fs.mkdirSync(path.dirname(out), { recursive: true });
    return [run(["ffmpeg", "-v", "error", "-y", "-i", src, "-vf", "scale=540:-2", "-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-g", "15", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", out + ".tmp.mp4"]),
      run(["@move", out + ".tmp.mp4", out])];
  }
  if (kind === "clip") return clipSids.length ? [run([PY, "tools/woodcut_render.py", ep, "--only", ...clipSids, "--force"])] : [];
  const base = `render/${ep}.mp4`, backup = `render/${ep}.pre-edit-${Date.now()}.mp4`;
  if (kind === "patch") return [
    ...(clipSids.length ? [run([PY, "tools/woodcut_render.py", ep, "--only", ...clipSids, "--force"])] : []),
    run(["@copy", path.join(dir, base), path.join(dir, backup)]),
    run([PY, "tools/render_patch.py", ep, "--scenes", ...sids, "--base", backup, "--out", base]),
  ];
  if (kind === "audio") return [
    run(["@copy", path.join(dir, base), path.join(dir, backup)]),
    run([PY, "tools/mix_audio.py", ep, `render/${ep}.audio.wav`, "--video", backup, "--out", base]),
  ];
  throw new Error(`bilinmeyen iş: ${kind}`);
};
const pump = () => {
  if (running) return;
  const j = jobs.find((x) => x.status === "queued"); if (!j) return;
  running = j; j.status = "running"; j.started = Date.now();
  const next = () => {
    const st = j.steps.shift();
    if (!st) { j.status = "done"; j.ended = Date.now(); running = null; return pump(); }
    j.log.push(`$ ${path.basename(st.cmd)} ${st.args.join(" ")}`);
    if (st.cmd === "@copy" || st.cmd === "@move") {   // cp/mv yerine Node (Windows'ta bu komutlar yok)
      try { st.cmd === "@copy" ? fs.copyFileSync(st.args[0], st.args[1]) : fs.renameSync(st.args[0], st.args[1]); }
      catch (e) { j.status = "failed"; j.ended = Date.now(); running = null; j.log.push(`[hata] ${e.message}`); return pump(); }
      return next();
    }
    const ch = spawn(st.cmd, st.args, { cwd: st.cwd, env: PYENV });
    const cap = (b) => { j.log.push(...String(b).split("\n").filter(Boolean).slice(-20)); j.log = j.log.slice(-60); };
    ch.stdout.on("data", cap); ch.stderr.on("data", cap);
    ch.on("close", (code) => { if (code !== 0) { j.status = "failed"; j.ended = Date.now(); running = null; j.log.push(`[çıkış ${code}]`); return pump(); } next(); });
  };
  next();
};
const enqueue = (id, { kind, sids }) => {
  const j = { id: jobs.length + 1, episode: id, kind, sids, status: "queued", log: [], steps: steps(id, kind, sids ?? []), created: Date.now() };
  if (!j.steps.length) { j.status = "done"; j.log.push("yapılacak bir şey yok (klip stili değil)"); }
  j.quiet = kind === "proxy";   // hafif iş: önizlemeyi duraklatmaz
  jobs.push(j); pump(); return { id: j.id, status: j.status };
};
const readBody = (req) => new Promise((ok, no) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => { try { ok(b ? JSON.parse(b) : {}); } catch (e) { no(e); } }); });

// ---------- medya: bölümün sesleri, görselleri, videoları (kullanıcı: "Finder'dan mı bulacağım") ----------
const media = (id) => {
  const d = epDir(id); if (!d) return null;
  const name = path.basename(d), rel = (p) => `episodes/${name}/${path.relative(d, p).split(path.sep).join("/")}`;   // URL yolu: Windows'ta da "/"
  const walk = (dir, out = [], depth = 0) => {
    if (!fs.existsSync(dir) || depth > 4) return out;
    for (const f of fs.readdirSync(dir)) {
      if (f.startsWith(".") || f === "editor" || f === "_patch") continue;
      const p = path.join(dir, f), st = fs.statSync(p);
      if (st.isDirectory()) walk(p, out, depth + 1); else out.push({ p, size: st.size, mtime: st.mtimeMs });
    }
    return out;
  };
  const all = walk(d);
  const lang = "en";
  let report = null;
  const rp = path.join(d, `audio/${lang}/report.json`);
  if (fs.existsSync(rp)) {
    const r = readJSON(rp);
    report = (r.scenes ?? []).map((s) => ({ id: s.id, text: s.text, chosen: Number(s.chosen ?? 0),
      takes: (s.takes ?? []).map((t) => ({ take: Number(t.take), file: `episodes/${name}/${t.file}`, wer: Number(t.wer), audio_s: Number(t.audio_s), hyp: t.hyp, sim: Number(t.speaker_sim) })) }));
  }
  const pick = (re, ex) => all.filter((f) => re.test(f.p) && !(ex && ex.test(f.p))).sort((a, b) => b.mtime - a.mtime).map((f) => ({ path: rel(f.p), size: f.size, mtime: Math.round(f.mtime) }));
  return {
    narration: fs.existsSync(path.join(d, `audio/${lang}/narration.wav`)) ? `episodes/${name}/audio/${lang}/narration.wav` : null,
    scenesAudio: pick(new RegExp(`audio/${lang}/s\\d+[a-z]?\\.wav$`)),
    report,
    images: pick(/\.(png|jpe?g|webp)$/i, /\/(takes|thumbs|stills_cache)\//),
    videos: pick(/\.mp4$/i),
    audioOther: pick(/\.(wav|mp3)$/i, new RegExp(`audio/${lang}/|takes/`)),
  };
};

// ---------- yeni video, senaryo, stil örnekleri ----------
const claude = makeClaude({ ROOT, epDir });
const slugify = (t) => t.toLowerCase().replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").split("-").slice(0, 5).join("-").slice(0, 40) || "video";
const newEpisode = ({ idea, title, format, channel, answers, direction }) => {
  const args = ["tools/new_episode.py", "--topic", idea.slice(0, 400), "--slug", slugify(title || idea), "--format", format === "long" ? "long" : "short",
    "--notes", `Editörden (Yeni video akışı). Sorular: ${(answers ?? []).map((a) => `${a.q} → ${a.a}`).join(" | ")}. Görsel yön: direction.yaml.`];
  if (channel && channel !== "triz") args.push("--channel", channel); else args.push("--voice", "narrator_v3");
  const r = spawnSync(PY, args, { cwd: ROOT, encoding: "utf8", env: PYENV });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout).slice(-400));
  const rel = r.stdout.trim().split("\n").pop().trim();
  const dir = path.join(ROOT, rel);
  fs.writeFileSync(path.join(dir, "direction.yaml"), yaml.dump({ idea, title, format, channel, answers, ...direction }, { lineWidth: 160 }));
  spawnSync(PY, ["tools/validate.py", "brief", path.join(rel, "brief.yaml")], { cwd: ROOT, env: PYENV });
  spawnSync(PY, ["tools/state.py", "set", rel, "brief", "done"], { cwd: ROOT, env: PYENV });
  return { ok: true, id: path.basename(dir) };
};
const saveScript = (id, { scenes }) => {
  const d = epDir(id), p = path.join(d, "script.en.json"), sc = readJSON(p);
  for (const e of scenes ?? []) { const s = sc.scenes.find((x) => x.id === e.id); if (s && typeof e.text === "string") s.text = e.text; }
  fs.writeFileSync(p, JSON.stringify(sc, null, 2));
  fs.appendFileSync(path.join(d, "editor.changes.jsonl"), (scenes ?? []).map((e) => JSON.stringify({ ts: new Date().toISOString(), episode: path.basename(d), scene: e.id, path: "script.text", to: e.text })).join("\n") + "\n");
  const r = spawnSync(PY, ["tools/validate.py", "script", path.relative(ROOT, p)], { cwd: ROOT, encoding: "utf8", env: PYENV });
  return { ok: r.status === 0, out: (r.stdout + r.stderr).trim().split("\n").slice(-4).join("\n") };
};
// stil örneği: o stili kullanan en yeni bölümün o sahnesinden küçük resim
const styleExample = (style) => {
  for (const n of fs.readdirSync(path.join(CONTENT, "episodes")).sort().reverse()) {
    const d = path.join(CONTENT, "episodes", n), t = path.join(d, "timeline.json");
    if (!fs.existsSync(t)) continue;
    const sc = readJSON(t).scenes.find((s) => s.style === style);
    if (sc) { const f = thumb(n, sc.id); if (f) return f; }
  }
  return null;
};

// ---------- http ----------
const send = (res, code, body, type = "application/json") => { res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store" }); res.end(body); };
const json = (res, obj) => send(res, obj ? 200 : 404, JSON.stringify(obj ?? { error: "bulunamadı" }));

const serveFile = (req, res, file) => {
  if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(res, 404, "yok", "text/plain");
  const type = MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream";
  const size = fs.statSync(file).size;
  const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
  if (range) {
    const start = range[1] ? Number(range[1]) : 0, end = range[2] ? Number(range[2]) : size - 1;
    res.writeHead(206, { "Content-Type": type, "Content-Range": `bytes ${start}-${end}/${size}`, "Accept-Ranges": "bytes", "Content-Length": end - start + 1 });
    return fs.createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { "Content-Type": type, "Content-Length": size, "Accept-Ranges": "bytes" });
  fs.createReadStream(file).pipe(res);
};

const safe = (base, rel) => { const p = path.resolve(base, "." + path.sep + rel); return p.startsWith(base) ? p : null; };

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const p = decodeURIComponent(url.pathname);
  try {
    if (p === "/" || p === "/index.html") return serveFile(req, res, path.join(HERE, "index.html"));
    if (p === "/__app.js") return serveFile(req, res, path.join(HERE, "dist/app.js"));
    if (p === "/api/episodes") {
      const eps = fs.readdirSync(path.join(CONTENT, "episodes")).filter((n) => fs.existsSync(path.join(CONTENT, "episodes", n, "brief.yaml"))).sort().reverse();
      return json(res, eps.map((n) => {
        const d = path.join(CONTENT, "episodes", n), b = yaml.load(fs.readFileSync(path.join(d, "brief.yaml"), "utf8")) ?? {};
        const st = fs.existsSync(path.join(d, "state.json")) ? readJSON(path.join(d, "state.json")) : {};
        const steps = st.steps ?? st;
        const next = Object.entries(steps).find(([, v]) => v && typeof v === "object" && !["done", "skipped"].includes(v.status))?.[0] ?? null;
        const ep = n.split("-")[0];
        const thumb = fs.existsSync(path.join(d, "render/cover.png")) ? `/episodes/${n}/render/cover.png` : null;
        return { id: n, channel: b?.channel ?? "triz", title: b?.topic ?? b?.title ?? n, hasTimeline: fs.existsSync(path.join(d, "timeline.json")), next, thumb, ep };
      }));
    }
    let m;
    if ((m = p.match(/^\/api\/episode\/([^/]+)$/))) return json(res, summary(m[1]));
    if ((m = p.match(/^\/api\/episode\/([^/]+)\/thumb\/(s\d+[a-z]?)$/))) return serveFile(req, res, thumb(m[1], m[2]));
    if (p === "/api/catalog") return json(res, catalog());
    if ((m = p.match(/^\/api\/episode\/([^/]+)\/overrides$/))) { const d = epDir(m[1]); return json(res, d ? loadOverrides(d) : null); }
    if (req.method === "POST" && (m = p.match(/^\/api\/episode\/([^/]+)\/edit$/))) return json(res, applyEdit(m[1], await readBody(req)));
    if (req.method === "POST" && (m = p.match(/^\/api\/episode\/([^/]+)\/revert$/))) return json(res, revertEdit(m[1], await readBody(req)));
    if (req.method === "POST" && (m = p.match(/^\/api\/episode\/([^/]+)\/job$/))) return json(res, enqueue(m[1], await readBody(req)));
    if ((m = p.match(/^\/api\/episode\/([^/]+)\/proxy$/))) {
      const d = epDir(m[1]), ep = epShort(d), src = path.join(d, `render/${ep}.mp4`), out = path.join(d, "render/editor/proxy.mp4");
      if (!fs.existsSync(src)) return json(res, { ready: false, reason: "render yok" });
      const fresh = fs.existsSync(out) && fs.statSync(out).mtimeMs >= fs.statSync(src).mtimeMs;
      if (!fresh && !jobs.some((j) => j.kind === "proxy" && j.episode === m[1] && ["queued", "running"].includes(j.status))) enqueue(m[1], { kind: "proxy", sids: [] });
      return json(res, { ready: fresh, url: `/episodes/${path.basename(d)}/render/editor/proxy.mp4`, v: fresh ? Math.round(fs.statSync(out).mtimeMs) : 0 });
    }
    if (p === "/api/questions" && req.method === "POST") {
      const b = await readBody(req);
      const st = catalog().styles, ax = catalog().axes;
      const built = Object.keys(ax?.looks ?? {}).filter((id) => st[id]?.implemented).map((id) => st[id].name?.tr ?? id).join(", ");
      return json(res, await claude.questions({ ...b, catalogSummary: built }));
    }
    if (p === "/api/new" && req.method === "POST") return json(res, newEpisode(await readBody(req)));
    if ((m = p.match(/^\/api\/episode\/([^/]+)\/direction$/))) {
      const d = epDir(m[1]);
      if (req.method === "POST") { fs.writeFileSync(path.join(d, "direction.yaml"), yaml.dump(await readBody(req), { lineWidth: 160 })); return json(res, { ok: true }); }
      return json(res, fs.existsSync(path.join(d, "direction.yaml")) ? yaml.load(fs.readFileSync(path.join(d, "direction.yaml"), "utf8")) : {});
    }
    if ((m = p.match(/^\/api\/episode\/([^/]+)\/chat$/))) return json(res, req.method === "POST" ? claude.send(m[1], (await readBody(req)).text) : claude.chat(m[1]));
    if ((m = p.match(/^\/api\/episode\/([^/]+)\/chat\/stop$/))) return json(res, claude.stop(m[1]));
    if (req.method === "POST" && (m = p.match(/^\/api\/episode\/([^/]+)\/chat\/permission$/))) return json(res, claude.answer(m[1], await readBody(req)));
    if (req.method === "POST" && (m = p.match(/^\/api\/episode\/([^/]+)\/chat\/settings$/))) return json(res, claude.settings(m[1], await readBody(req)));
    if (req.method === "POST" && (m = p.match(/^\/api\/episode\/([^/]+)\/script$/))) return json(res, saveScript(m[1], await readBody(req)));
    if (req.method === "POST" && (m = p.match(/^\/api\/episode\/([^/]+)\/state$/))) {
      const b = await readBody(req), d = epDir(m[1]);
      const r = spawnSync(PY, ["tools/state.py", "set", path.relative(ROOT, d), b.step, b.status], { cwd: ROOT, encoding: "utf8", env: PYENV });
      return json(res, { ok: r.status === 0, out: (r.stdout + r.stderr).slice(-400) });
    }
    if ((m = p.match(/^\/api\/episode\/([^/]+)\/media$/))) return json(res, media(m[1]));
    if ((m = p.match(/^\/api\/style-example\/([a-z0-9-]+)$/))) return serveFile(req, res, styleExample(m[1]));
    if (p === "/api/jobs") return json(res, { running: running ? running.id : null, jobs: jobs.slice(-10).map(({ steps, ...j }) => ({ ...j, left: steps.length })) });
    return serveFile(req, res, safe(CONTENT, p));
  } catch (e) {
    console.error(e); send(res, 500, JSON.stringify({ error: String(e.message ?? e) }));
  }
}).listen(PORT, "127.0.0.1", () => console.log(`[editor] http://localhost:${PORT}`));
for (const sig of ["SIGTERM", "SIGINT", "SIGHUP"]) process.on(sig, () => { claude.shutdown(); setTimeout(() => process.exit(0), 500); });
