// Stüdyo editörü arayüzü (2. aşama: analiz + düzenleme + iş kuyruğu): bölüm seç → önizleme (Remotion Player + ShortsVideo) · timeline şeridi · sahne analiz paneli.
// Düzen videonun yönüne göre kendini ayarlar (dikey: önizleme solda; yatay: üstte). Tasarım: docs/editor/DESIGN.md.
import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Player, type PlayerRef } from "@remotion/player";
import "../src/fonts";
import { ShortsVideo } from "../src/compositions/ShortsVideo";
import { timelineSchema, type Timeline } from "../src/schema/timeline";
import { CAMERA_HINT, TERMS, TRANSITIONS } from "./glossary";
import { EditPanel, History } from "./edit";
import { LAYER_INFO, sceneLayers } from "./layers";
import { Library, type Axes } from "./library";
import { Home, Prep, Wizard, go } from "./newvideo";
import { Chat } from "./chat";
import { Media } from "./media";
import { fmt, setPath, type Edit } from "./util";

type Change = { ts: string; scene: string; path: string; from?: unknown; to?: unknown; reverted?: boolean };
type Summary = { id: string; timeline: string; render: string | null; brief: Record<string, unknown>; state: Record<string, unknown>;
  storyboard: Record<string, { section: string; cells: string[] }[]>; fps: number; width: number; height: number; durationInFrames: number;
  renderMtime: number; stale: string[]; audioStale: boolean; changes: Change[] };
type Style = { name?: { tr?: string; en?: string }; does?: string; use_when?: string; implemented?: boolean; mix_with?: string[]; kind?: string };
type Scene = Timeline["scenes"][number];
type Job = { id: number; episode: string; kind: string; sids?: string[]; status: string; log: string[]; left: number };

const getJSON = async <T,>(u: string): Promise<T> => { const r = await fetch(u); if (!r.ok) throw new Error(`${u}: ${r.status}`); return r.json(); };
const post = async (u: string, body: unknown) => { const r = await fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json(); if (!r.ok) throw new Error(j.error ?? r.status); return j; };

const App: React.FC = () => {
  const [eps, setEps] = useState<{ id: string; channel: string; title: string }[]>([]);
  const [ep, setEp] = useState<string>(() => new URLSearchParams(location.search).get("ep") ?? "");
  const [sum, setSum] = useState<Summary | null>(null);
  const [tl, setTl] = useState<Timeline | null>(null);
  const [cat, setCat] = useState<Record<string, Style>>({});
  const [axes, setAxes] = useState<Axes>(null);
  const [frame, setFrame] = useState(0);
  const [sel, setSel] = useState(0);
  const [tab, setTab] = useState<"analiz" | "duzenle" | "gecmis" | "kutuphane" | "medya">("analiz");
  const [dirty, setDirty] = useState<Record<string, Record<string, unknown>>>({});
  const [jobs, setJobs] = useState<{ running: number | null; jobs: Job[] }>({ running: null, jobs: [] });
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const player = useRef<PlayerRef>(null);
  // izleme modu: "akici" = son render'ın hafif kopyası (render/editor/proxy.mp4, akıcı); "canli" = Remotion Player her kareyi çizer (ağır, kekeleyebilir;
  // kaydedilmemiş değişiklik varken zorunlu). Kullanıcı 2026-11-11: "önizlemede kekeliyor".
  const [mode, setMode] = useState<"akici" | "canli">("akici");
  const [proxy, setProxy] = useState<{ ready: boolean; url?: string; v?: number }>({ ready: false });
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  const load = async (id: string) => {
    const s = await getJSON<Summary>(`/api/episode/${id}`);
    if (!s.timeline) { setSum(s); setTl(null); return; }   // hazırlık aşaması (timeline yok): Prep ekranı
    const raw = await getJSON<{ sfx?: { note?: string }[] }>(`/${s.timeline}`);
    const parsed = timelineSchema.parse(raw) as Timeline;
    // şema bilinmeyen alanları atar; efekt notlarını (bed, sahne) analiz için geri koy (dizi sırası aynı)
    (parsed.sfx ?? []).forEach((x, i) => ((x as { note?: string }).note = raw.sfx?.[i]?.note));
    setSum(s); setTl(parsed); setDirty({});
    setProxy(await getJSON(`/api/episode/${id}/proxy`));
  };
  useEffect(() => { getJSON<typeof eps>("/api/episodes").then((l) => { setEps(l); if (!ep && l[0]) setEp(l[0].id); }); getJSON<{ styles: Record<string, Style>; axes: Axes }>("/api/catalog").then((c) => { setCat(c.styles); setAxes(c.axes); }); }, []);
  useEffect(() => { if (!ep) return; setErr(null); setTl(null); history.replaceState(null, "", `?ep=${ep}`); load(ep).catch((e) => setErr(String(e))); }, [ep]);
  useEffect(() => {
    const p = player.current; if (!p) return;
    const on = (e: { detail: { frame: number } }) => setFrame(e.detail.frame);
    p.addEventListener("frameupdate", on);
    return () => p.removeEventListener("frameupdate", on);
  }, [tl !== null]);
  useEffect(() => { if (!tl) return; const k = tl.scenes.findIndex((s) => frame >= s.startFrame && frame < s.startFrame + s.durationFrames); if (k >= 0) setSel(k); }, [frame]);
  // iş kuyruğu: 2 sn'de bir; iş bitince bölümü yeniden yükle (yeni klip/video/küçük resim). İş sürerken canlı önizleme durur (aynı GPU).
  const lastRunning = useRef<number | null>(null);
  useEffect(() => {
    const t = setInterval(async () => {
      const j = await getJSON<typeof jobs>("/api/jobs").catch(() => null); if (!j) return;
      setJobs(j);
      if (j.running && !j.jobs.find((x) => x.id === j.running)?.quiet) { player.current?.pause(); video.current?.pause(); }
      if (ep) setProxy((p) => { if (!p.ready) getJSON<typeof p>(`/api/episode/${ep}/proxy`).then(setProxy); return p; });
      if (lastRunning.current && !j.running && ep) { load(ep); setMsg("İş bitti, önizleme yenilendi."); }
      lastRunning.current = j.running;
    }, 2000);
    return () => clearInterval(t);
  }, [ep]);

  // canlı düzenleme: önizleme hemen değişir, Kaydet'e kadar diske yazılmaz
  const edit: Edit = (sid, p, v) => {
    setDirty((d) => ({ ...d, [sid]: { ...(d[sid] ?? {}), [p]: v } }));
    setTl((t) => { if (!t) return t; const c = structuredClone(t) as unknown as Record<string, unknown> & Timeline; const target = sid === "_" ? c : c.scenes.find((s) => s.id === sid); if (target) setPath(target as unknown as Record<string, unknown>, p, v); return c; });
  };
  const nDirty = Object.values(dirty).reduce((n, d) => n + Object.keys(d).length, 0);
  const smooth = mode === "akici" && proxy.ready && nDirty === 0;
  const fps = tl?.fps ?? 30;
  const seekTo = (f: number) => { if (smooth && video.current) { video.current.currentTime = f / fps; setFrame(f); } else player.current?.seekTo(f); };
  // akıcı modda kare sayacı videodan (requestAnimationFrame)
  useEffect(() => {
    if (!smooth) return;
    let raf = 0;
    const tick = () => { const v = video.current; if (v) setFrame(Math.round(v.currentTime * fps)); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [smooth, fps]);
  // mod değişince oynatma başını taşı
  const prevSmooth = useRef(smooth);
  useEffect(() => { if (prevSmooth.current !== smooth) { setTimeout(() => seekTo(frame), 50); prevSmooth.current = smooth; } }, [smooth]);
  const save = async () => {
    for (const [sid, ch] of Object.entries(dirty)) await post(`/api/episode/${ep}/edit`, { sid, changes: Object.entries(ch).map(([path, value]) => ({ path, value })) });
    await load(ep); setMsg(`${nDirty} ayar kaydedildi. Klip stillerinde "Klibi yeniden üret", son videoya işlemek için "Videoya uygula".`);
  };
  const discard = () => { load(ep); setMsg("Kaydedilmemiş değişiklikler atıldı."); };
  const revert = async (sid: string, paths?: string[]) => { await post(`/api/episode/${ep}/revert`, { sid, paths }); await load(ep); setMsg("Geri alındı."); };
  const job = async (kind: string, sids?: string[]) => { await post(`/api/episode/${ep}/job`, { kind, sids }); setMsg(`İş sıraya alındı: ${kind}${sids?.length ? " " + sids.join(" ") : ""}`); };

  const [chatOpen, setChatOpen] = useState(false);
  if (err) return <div style={{ padding: 20 }}>Hata: {err}</div>;
  if (sum && !sum.timeline) return <Prep sum={sum as any} cat={cat as any} axes={axes} reload={() => load(ep)} />;
  const vertical = (tl?.height ?? 1920) > (tl?.width ?? 1080);
  const sc = tl?.scenes[sel];
  const runningJob = jobs.jobs.find((j) => j.id === jobs.running);
  const busy = jobs.running !== null && !(runningJob as { quiet?: boolean } | undefined)?.quiet;

  return (
    <div style={{ display: "grid", gridTemplateRows: "auto auto 1fr 190px", height: "100%" }}>
      <header style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: "6px 14px", minHeight: 44, borderBottom: "1px solid var(--line)", background: "var(--panel)" }}>
        <button onClick={() => go("")} title="Ana sayfa">←</button><b>Stüdyo</b>
        <select value={ep} onChange={(e) => { if (!nDirty || confirm("Kaydedilmemiş değişiklikler var, atılsın mı?")) setEp(e.target.value); }}>{eps.map((e) => <option key={e.id} value={e.id}>{e.id}</option>)}</select>
        {tl ? <span className="muted">{tl.scenes.length} sahne · {fmt(tl.durationInFrames / tl.fps)} · {fmt(frame / (tl.fps || 30))}</span> : <span className="muted">yükleniyor…</span>}
        <span style={{ display: "inline-flex", border: "1px solid var(--line)", borderRadius: 6, overflow: "hidden" }} title="Akıcı: son render'ın hafif kopyası. Canlı: değişiklikleri anında gösterir ama ağırdır.">
          {(["akici", "canli"] as const).map((m) => <button key={m} disabled={m === "akici" && (!proxy.ready || nDirty > 0)} onClick={() => setMode(m)}
            style={{ border: "none", borderRadius: 0, background: (m === "akici" ? smooth : !smooth) ? "var(--sel)" : "transparent", color: (m === "akici" ? smooth : !smooth) ? "var(--accent)" : undefined }}>
            {m === "akici" ? (proxy.ready ? "Akıcı izleme" : "Akıcı (hazırlanıyor…)") : "Canlı önizleme"}</button>)}
        </span>
        <span style={{ flex: 1 }} />
        <button onClick={() => setChatOpen(!chatOpen)} style={{ borderColor: chatOpen ? "var(--accent)" : undefined }}>Claude</button>
        {nDirty ? <><span className="tag y">{nDirty} kaydedilmemiş</span><button onClick={save}>Kaydet</button><button onClick={discard}>At</button></> : null}
        {sum && sum.stale.length ? <button disabled={busy} onClick={() => job("patch", sum.stale)} title="Değişen sahneleri yeniden render edip son videoya yerleştirir (render_patch)">Videoya uygula ({sum.stale.join(", ")})</button> : null}
        {sum && sum.audioStale ? <button disabled={busy} onClick={() => job("audio")} title="Sesi timeline'dan yeniden karıştırır (mix_audio), görüntüye dokunmaz">Sesi yeniden karıştır</button> : null}
      </header>
      <div style={{ padding: busy || msg ? "6px 14px" : 0, background: busy ? "#3a2a10" : "#1e2a1e", fontSize: 13, display: "flex", gap: 10, alignItems: "center" }}>
        {busy && runningJob ? <><b>İş sürüyor:</b> {runningJob.kind} {runningJob.sids?.join(" ")} <span className="muted">· canlı önizleme duraklatıldı · {runningJob.log.slice(-1)[0]?.slice(0, 120)}</span></> : msg ? <><span>{msg}</span><button onClick={() => setMsg(null)}>×</button></> : null}
      </div>

      <main style={{ display: "grid", gridTemplateColumns: (vertical ? "auto 1fr" : "1fr") + (chatOpen ? " 380px" : ""), gridTemplateRows: vertical ? "1fr" : "auto 1fr", minHeight: 0 }}>
        <div style={{ padding: 12, display: "flex", justifyContent: "center", alignItems: "flex-start", minHeight: 0 }}>
          {tl && smooth ? (
            <div style={{ position: "relative", height: vertical ? "calc(100vh - 56px - 190px - 40px)" : undefined, width: vertical ? undefined : "min(100%, 960px)", aspectRatio: `${tl.width} / ${tl.height}` }}>
              <video ref={video} src={`${proxy.url}?v=${proxy.v}`} preload="auto" playsInline onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onClick={() => (video.current!.paused ? video.current!.play() : video.current!.pause())}
                style={{ width: "100%", height: "100%", background: "#000", display: "block", cursor: "pointer" }} />
              <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 8, display: "flex", gap: 8, alignItems: "center", background: "linear-gradient(transparent, rgba(0,0,0,.6))" }}>
                <button onClick={() => (video.current!.paused ? video.current!.play() : video.current!.pause())}>{playing ? "❚❚" : "▶"}</button>
                <span style={{ fontSize: 12 }}>{fmt(frame / fps)} / {fmt(tl.durationInFrames / fps)}</span>
              </div>
            </div>
          ) : tl ? (
            <Player ref={player} component={ShortsVideo as unknown as React.FC<Record<string, unknown>>} inputProps={{ timeline: sum!.timeline, data: tl }}
              durationInFrames={tl.durationInFrames} fps={tl.fps} compositionWidth={tl.width} compositionHeight={tl.height}
              style={vertical ? { height: "calc(100vh - 56px - 190px - 40px)", aspectRatio: `${tl.width} / ${tl.height}` } : { width: "min(100%, 960px)", aspectRatio: `${tl.width} / ${tl.height}` }}
              controls clickToPlay acknowledgeRemotionLicense numberOfSharedAudioTags={32} />
          ) : null}
        </div>
        <aside style={{ overflow: "auto", padding: "6px 18px 18px", borderLeft: vertical ? "1px solid var(--line)" : "none" }}>
          <div style={{ display: "flex", gap: 6, margin: "6px 0" }}>
            {(["analiz", "duzenle", "medya", "gecmis", "kutuphane"] as const).map((t) => <button key={t} onClick={() => setTab(t)} style={{ background: tab === t ? "var(--sel)" : undefined, borderColor: tab === t ? "var(--accent)" : undefined }}>{{ analiz: "Analiz", duzenle: "Düzenle", medya: "Medya", gecmis: "Geçmiş", kutuphane: "Kütüphane" }[t]}</button>)}
          </div>
          {sc && sum && tab === "analiz" ? <Analysis sc={sc} k={sel} tl={tl!} sum={sum} cat={cat} axes={axes} onLibrary={() => setTab("kutuphane")} /> : null}
          {sc && sum && tab === "duzenle" ? <EditPanel sc={sc} k={sel} tl={tl!} next={tl!.scenes[sel + 1]} edit={edit} dirty={dirty[sc.id] ?? {}} sum={sum} busy={busy}
            onRevert={(paths) => revert(sc.id, paths)} onClip={() => job("clip", [sc.id])} /> : null}
          {tab === "medya" && sum ? <Media ep={sum.id} /> : null}
          {tab === "kutuphane" ? <Library cat={cat} axes={axes} currentStyle={sc?.style} /> : null}
          {sum && tab === "gecmis" ? <History sum={sum} onPick={(sid) => { const k = tl!.scenes.findIndex((s) => s.id === sid); if (k >= 0) { setSel(k); seekTo(tl!.scenes[k].startFrame); } }} /> : null}
        </aside>
        {chatOpen && sum ? <div style={{ borderLeft: "1px solid var(--line)", padding: "6px 10px", minHeight: 0, display: "flex", flexDirection: "column", gridRow: vertical ? undefined : "1 / span 2", gridColumn: vertical ? undefined : 2 }}>
          <Chat ep={sum.id} seed={tl && sc ? `${sc.id}: ` : ""} /></div> : null}
      </main>

      {tl && sum ? <Strip tl={tl} ep={sum.id} ver={sum.renderMtime} stale={sum.stale} dirty={dirty} frame={frame} sel={sel} onPick={(k) => { setSel(k); seekTo(tl.scenes[k].startFrame); }} onSeek={seekTo} /> : <div />}
    </div>
  );
};

// ---------- timeline şeridi: sahne kutuları + altyazı kelimeleri + efektler + müzik ----------
const Strip: React.FC<{ tl: Timeline; ep: string; ver: number; stale: string[]; dirty: Record<string, Record<string, unknown>>; frame: number; sel: number; onPick: (k: number) => void; onSeek: (f: number) => void }> = ({ tl, ep, ver, stale, dirty, frame, sel, onPick, onSeek }) => {
  const total = tl.durationInFrames, pct = (f: number) => `${(f / total) * 100}%`;
  const lang = tl.captions.lang;
  const ref = useRef<HTMLDivElement>(null);
  // sürükleyerek sarma: cetvel, kelime ve efekt izlerinde basılı tutup kaydır (pointer capture); sahne kutusuna tıklamak sahneyi seçer
  const at = (x: number) => { const r = ref.current!.getBoundingClientRect(); return Math.max(0, Math.min(total - 1, Math.round(((x - r.left) / r.width) * total))); };
  const scrub = {
    onPointerDown: (e: React.PointerEvent) => { (e.target as Element).setPointerCapture(e.pointerId); onSeek(at(e.clientX)); },
    onPointerMove: (e: React.PointerEvent) => { if (e.buttons & 1) onSeek(at(e.clientX)); },
    style: { cursor: "ew-resize", touchAction: "none" } as React.CSSProperties,
  };
  const secs = Math.floor(total / tl.fps);
  return (
    <div style={{ borderTop: "1px solid var(--line)", background: "var(--panel)", padding: "8px 14px", overflowX: "auto" }}>
      <div ref={ref} style={{ position: "relative", minWidth: 900 }}>
        {/* zaman cetveli: tut ve sürükle */}
        <div {...scrub} style={{ ...scrub.style, position: "relative", height: 16, borderBottom: "1px solid var(--line)", marginBottom: 2 }}>
          {Array.from({ length: secs + 1 }, (_, i) => <div key={i} style={{ position: "absolute", left: pct(i * tl.fps), bottom: 0, width: 1, height: i % 5 === 0 ? 10 : 5, background: "#666" }}>
            {i % 5 === 0 ? <span style={{ position: "absolute", left: 3, top: -4, fontSize: 9, color: "var(--dim)" }}>{i}s</span> : null}</div>)}
        </div>
        <div style={{ position: "relative", height: 82 }}>
          {tl.scenes.map((s, k) => (
            <div key={s.id} onClick={() => onPick(k)} title={`${s.id} · ${s.style} · ${(s.durationFrames / tl.fps).toFixed(1)} sn`}
              style={{ position: "absolute", left: pct(s.startFrame), width: pct(s.durationFrames), top: 0, bottom: 0, padding: 2, cursor: "pointer" }}>
              <div style={{ height: "100%", borderRadius: 6, overflow: "hidden", border: `2px solid ${k === sel ? "var(--accent)" : "var(--line)"}`, background: "#222", position: "relative" }}>
                <img src={`/api/episode/${ep}/thumb/${s.id}?v=${ver}`} style={{ height: "100%", width: "100%", objectFit: "cover", opacity: 0.75 }} onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
                <div style={{ position: "absolute", left: 4, top: 3, fontSize: 11, textShadow: "0 1px 2px #000" }}><b>{s.id}</b> {s.style}</div>
                <div style={{ position: "absolute", left: 4, bottom: 3, fontSize: 11, textShadow: "0 1px 2px #000" }}>{(s.durationFrames / tl.fps).toFixed(1)} sn</div>
                {dirty[s.id] ? <div title="kaydedilmemiş değişiklik" style={{ position: "absolute", right: 4, top: 4, width: 9, height: 9, borderRadius: 5, background: "var(--accent)" }} /> : stale.includes(s.id) ? <div title="kaydedildi, videoya henüz uygulanmadı" style={{ position: "absolute", right: 4, top: 4, width: 9, height: 9, borderRadius: 5, background: "#ff9a3c" }} /> : null}
              </div>
              {k > 0 && s.transition !== "cut" ? <div title={TRANSITIONS[s.transition]?.name ?? s.transition}
                style={{ position: "absolute", left: -9, top: 28, width: 18, height: 18, borderRadius: 9, background: "var(--accent)", color: "#111", fontSize: 10, display: "grid", placeItems: "center", fontWeight: 700 }}>⇢</div> : null}
            </div>
          ))}
        </div>
        {/* altyazı kelimeleri */}
        <div {...scrub} style={{ ...scrub.style, position: "relative", height: 18, marginTop: 4 }}>
          {tl.scenes.flatMap((s) => (s.words[lang] ?? []).map((w, i) => (
            <span key={s.id + i} title={w.text} style={{ position: "absolute", left: pct(s.startFrame + (w.startMs / 1000) * tl.fps), top: 4, width: 2, height: 10, background: "#8d8a80", opacity: 0.7 }} />)))}
        </div>
        {/* efektler + müzik */}
        <div {...scrub} style={{ ...scrub.style, position: "relative", height: 14, marginTop: 4 }}>
          {((tl.sfx ?? []) as (Timeline["sfx"][number] & { note?: string })[]).map((x, i) => <div key={i} title={`${x.file} · ${x.gainDb} dB${x.note ? " · " + x.note : ""}`}
            style={{ position: "absolute", left: pct(x.frame), width: pct(Math.max(3, x.durationFrames ?? 6)), height: 6, top: 4, borderRadius: 3, background: x.note === "bed" ? "#3b4a3b" : "#6b8fb0", opacity: 0.8 }} />)}
        </div>
        {tl.music ? <div title={`${tl.music.file} · ${tl.music.gainDb} dB, duck ${tl.music.duckDb} dB`} style={{ height: 8, marginTop: 2, borderRadius: 4, background: "#5a4a6a" }} /> : null}
        <div style={{ position: "absolute", top: 0, bottom: 0, left: pct(frame), width: 2, marginLeft: -1, background: "#ff5252", pointerEvents: "none" }}>
          <div style={{ position: "absolute", top: 0, left: -6, width: 0, height: 0, borderLeft: "7px solid transparent", borderRight: "7px solid transparent", borderTop: "10px solid #ff5252" }} />
        </div>
      </div>
    </div>
  );
};

// ---------- sahne analiz paneli: görsel dilin 7 katmanı (layers.ts) ----------
const TEST_LABEL = { durdur: "durdurunca görülür", oynat: "oynatınca görülür", nasıl: "“nasıl yapılmış?” sorusu", dinle: "dinleyince" } as const;
const Analysis: React.FC<{ sc: Scene; k: number; tl: Timeline; sum: Summary; cat: Record<string, Style>; axes: Axes; onLibrary: () => void }> = ({ sc, k, tl, sum, cat, axes, onLibrary }) => {
  const st = cat[sc.style];
  const rows = sum.storyboard[sc.id] ?? [];
  const lang = tl.captions.lang;
  const [help, setHelp] = useState(false);
  const L = useMemo(() => sceneLayers(sc, tl, k, st?.name?.tr, st?.does), [sc, tl, k, st]);
  const cam = CAMERA_HINT(sc.props as Record<string, unknown>);
  // görünüş alternatifleri: TÜM görünüşler (yapılmamışlar dahil); önce bu stille iyi karışanlar, sonra aynı teknikle yapılabilenler, hazırlar önde
  const techStyle = axes?.technique_styles[sc.style];
  const myTech = techStyle?.technique ? [techStyle.technique] : axes?.looks[sc.style]?.made_with ?? [];
  const alts = useMemo(() => {
    const mix = st?.mix_with ?? [];
    const score = (id: string) => (mix.includes(id) ? 4 : 0) + ((axes?.looks[id]?.made_with ?? []).some((t) => myTech.includes(t)) ? 2 : 0) + (cat[id]?.implemented ? 1 : 0);
    return Object.keys(axes?.looks ?? {}).filter((id) => cat[id] && id !== sc.style).sort((a, b) => score(b) - score(a)).slice(0, 10).map((id) => [id, cat[id]] as const);
  }, [cat, axes, sc.style, st]);
  const termsUsed = Object.keys(TERMS).filter((t) => [cam ?? "", ...Object.values(L).flat()].join(" ").toLowerCase().includes(t.split(" ")[0]) || rows.some((r) => r.cells.join(" ").toLowerCase().includes(t)));
  const tr = TRANSITIONS[sc.transition];
  return (
    <div>
      <h3>Sahne {k + 1} / {tl.scenes.length} · {sc.id} · {fmt(sc.startFrame / tl.fps)} – {fmt((sc.startFrame + sc.durationFrames) / tl.fps)}</h3>
      <div style={{ fontSize: 15, marginBottom: 6 }}>“{typeof sc.text === "string" ? sc.text : (sc.text as Record<string, string>)?.[lang] ?? ""}”</div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
        <b>Görsel dilin katmanları</b>
        <button onClick={() => setHelp(!help)} style={{ fontSize: 12, padding: "1px 8px" }}>{help ? "gizle" : "bu ne?"}</button>
      </div>
      {help ? <div style={{ background: "#1f1f22", border: "1px solid var(--line)", borderRadius: 6, padding: 10, margin: "6px 0", fontSize: 13 }}>
        Bir sahnenin görsel dili ayrı katmanlardan oluşur; her katman ayrı seçilebilir. <b>Görünüş</b> ile <b>teknik</b> farklı eksenlerdir:
        ağaç baskı görünüşü 3D teknikle yapılabilir (EP009), çizgi roman görünüşü de 3D ile (Spider-Verse).
        <div style={{ marginTop: 6 }}>Ayırt etme testi: <b>videoyu durdur</b> → görünüş, ışık-renk, doku · <b>oynat</b> → kamera, kurgu · <b>“nasıl yapılmış?”</b> → malzeme, teknik.</div>
        <div style={{ marginTop: 6 }}>Bir stili anlatırken bu satırlardan 2-3 tanesi yeter: “görünüş eski gazete, kamera hızlı, renk siyah-beyaz ve tek kırmızı”.</div>
      </div> : null}

      {LAYER_INFO.map((li) => (
        <div key={li.key} style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 10, padding: "8px 0", borderBottom: "1px solid #232326" }}>
          <div><div style={{ fontWeight: 600, color: li.key === "look" ? "var(--accent)" : undefined }}>{li.title}</div>
            <div className="muted" style={{ fontSize: 11 }}>{li.question}</div>
            <div style={{ fontSize: 10, color: "#6f6c66", marginTop: 2 }}>{TEST_LABEL[li.test]}</div></div>
          <div style={{ fontSize: 13 }}>{L[li.key]?.length ? L[li.key].map((x, i) => <div key={i} style={{ marginBottom: 3 }}>{x}</div>) : <span className="muted">—</span>}
            {li.key === "edit" && k > 0 && tr ? <div className="muted" style={{ fontSize: 12 }}>{tr.name}: {tr.what} ({tr.when})</div> : null}
            {li.key === "look" && st?.use_when ? <div className="muted" style={{ fontSize: 12 }}>Ne zaman: {st.use_when}</div> : null}</div>
        </div>))}

      {rows.length ? <><h3>Storyboard (neden böyle)</h3>{rows.map((r, i) => (
        <div key={i} style={{ marginBottom: 8, fontSize: 13 }}>{r.section ? <div className="muted" style={{ fontSize: 11 }}>{r.section}</div> : null}
          {r.cells.filter(Boolean).map((c, j) => <div key={j} style={{ marginTop: 2 }} dangerouslySetInnerHTML={{ __html: c.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`(.+?)`/g, "<code>$1</code>") }} />)}</div>))}</> : null}

      {termsUsed.length ? <><h3>Terimler</h3>{termsUsed.map((t) => <div key={t} style={{ marginBottom: 4, fontSize: 13 }}><b>{t}</b>: <span className="muted">{TERMS[t]}</span></div>)}</> : null}

      {techStyle ? <div style={{ background: "#1f1f22", border: "1px solid var(--line)", borderRadius: 6, padding: 8, fontSize: 12, marginTop: 10 }}>
        Not: <code>{sc.style}</code> aslında bir <b>teknik</b> ({axes?.techniques[techStyle.technique ?? ""]?.tr ?? techStyle.note}); görünüşü malzemeden geliyor. Aynı teknikle başka görünüşler de yapılabilir.</div> : null}
      <h3>Görünüşü başka ne olabilirdi?</h3>
      {alts.map(([id, s]) => <div key={id} style={{ marginBottom: 6 }}><span className={`tag ${s.implemented ? "y" : ""}`}>{s.name?.tr ?? id}</span>
        {!s.implemented ? <span className="tag" style={{ fontSize: 10 }}>yapılmadı</span> : null}{(st?.mix_with ?? []).includes(id) ? <span className="tag" style={{ fontSize: 10 }}>iyi karışır</span> : null}
        <span className="muted" style={{ fontSize: 12 }}>{s.use_when}</span></div>)}
      <button onClick={onLibrary} style={{ marginTop: 4 }}>Tüm kütüphane ({Object.keys(axes?.looks ?? {}).length} görünüş)</button>
      {myTech.length ? <><h3>Tekniği başka ne olabilirdi?</h3>
        {Object.entries(axes?.techniques ?? {}).filter(([id]) => !myTech.includes(id)).slice(0, 6).map(([id, t]) => <div key={id} style={{ fontSize: 12, marginBottom: 3 }}><b>{t.tr}</b> <span className="muted">— {t.what}</span></div>)}</> : null}
      <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Stil değişikliği yeni görsel hazırlığı ister: sohbette söyle (ör. “{sc.id}'yi {alts[0]?.[0]} yap”). Kamera, geçiş, efekt ve altyazı ayarları “Düzenle” sekmesinde.</div>
    </div>
  );
};

// yönlendirme: ?new=1 → yeni video sihirbazı · ?ep=… → bölüm (timeline yoksa hazırlık) · boş → ana sayfa
const Root: React.FC = () => {
  const q = new URLSearchParams(location.search);
  const [cat, setCat] = useState<Record<string, Style>>({});
  const [axes, setAxes] = useState<Axes>(null);
  useEffect(() => { getJSON<{ styles: Record<string, Style>; axes: Axes }>("/api/catalog").then((c) => { setCat(c.styles); setAxes(c.axes); }); }, []);
  if (q.get("new")) return <Wizard cat={cat as any} axes={axes} />;
  if (q.get("ep")) return <App />;
  return <Home />;
};
createRoot(document.getElementById("root")!).render(<Root />);
