// Düzenleme sekmesi: seçili sahnenin geçişi, kamerası, efekt seviyeleri ve altyazısı tipli kontrollerle. Değişiklik önizlemeye anında yansır,
// "Kaydet" ile editor.overrides.json + editor.changes.jsonl'a yazılır (Claude bu günlüğü geri bildirim olarak okur). Stil değiştirme burada yok:
// yeni stil yeni görsel hazırlığı ister, sohbette istenir.
import { useState } from "react";
import type { Timeline } from "../src/schema/timeline";
import { TRANSITIONS } from "./glossary";
import { CLIP_STYLES, fmt, getPath, type Edit } from "./util";

type Scene = Timeline["scenes"][number];
type Change = { ts: string; scene: string; path: string; from?: unknown; to?: unknown; reverted?: boolean };

const Slider: React.FC<{ label: string; value: number | undefined; min: number; max: number; step: number; dirty?: boolean; hint?: string; onChange: (v: number) => void }> = ({ label, value, min, max, step, dirty, hint, onChange }) => (
  <label style={{ display: "grid", gridTemplateColumns: "minmax(90px, 130px) 1fr 64px", gap: 8, alignItems: "center", margin: "4px 0" }} title={hint}>
    <span style={{ color: dirty ? "var(--accent)" : undefined }}>{label}</span>
    <input type="range" min={min} max={max} step={step} value={value ?? min} onChange={(e) => onChange(Number(e.target.value))} />
    <input type="number" min={min} max={max} step={step} value={value ?? ""} onChange={(e) => e.target.value !== "" && onChange(Number(e.target.value))} style={{ width: 64, background: "#222", color: "inherit", border: "1px solid var(--line)", borderRadius: 4 }} />
  </label>
);

const Section: React.FC<{ title: string; children: React.ReactNode; note?: string }> = ({ title, children, note }) => (
  <div style={{ borderTop: "1px solid var(--line)", paddingTop: 6, marginTop: 10 }}><h3 style={{ marginTop: 4 }}>{title}</h3>{note ? <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{note}</div> : null}{children}</div>
);

// kamera ayarı yapılabilen yollar, stile göre
const cameraFields = (sc: Scene): { path: string; label: string; min: number; max: number; step: number; hint?: string }[] => {
  const p = sc.props as Record<string, unknown>;
  if (sc.style === "depth-photo") return [
    { path: "props.compProps.strength", label: "derinlik gücü", min: 0, max: 1, step: 0.01, hint: "katmanlar arası uzaklık; yüksek = güçlü paralaks" },
    { path: "props.compProps.orbit", label: "yörünge (°)", min: 0, max: 30, step: 1, hint: "kameranın odak etrafında döndüğü toplam açı" },
    { path: "props.compProps.from.x", label: "başlangıç yana", min: -0.5, max: 0.5, step: 0.01 },
    { path: "props.compProps.to.x", label: "bitiş yana", min: -0.5, max: 0.5, step: 0.01 },
    { path: "props.compProps.from.dist", label: "başlangıç uzaklık", min: 1.5, max: 4.5, step: 0.05, hint: "küçük = yakın" },
    { path: "props.compProps.to.dist", label: "bitiş uzaklık", min: 1.5, max: 4.5, step: 0.05 },
    { path: "props.compProps.dof.amount", label: "arka bulanıklık", min: 0, max: 12, step: 0.5 },
  ];
  if (p.from && typeof (p.from as Record<string, unknown>).zoom === "number") return [
    { path: "props.from.zoom", label: "başlangıç zoom", min: 0.8, max: 3, step: 0.01 },
    { path: "props.to.zoom", label: "bitiş zoom", min: 0.8, max: 3, step: 0.01, hint: "başlangıçtan büyükse push in, küçükse pull out" },
    { path: "props.from.x", label: "başlangıç x", min: 0, max: 1, step: 0.005 },
    { path: "props.to.x", label: "bitiş x", min: 0, max: 1, step: 0.005 },
    { path: "props.from.y", label: "başlangıç y", min: 0, max: 1, step: 0.005 },
    { path: "props.to.y", label: "bitiş y", min: 0, max: 1, step: 0.005 },
    ...(typeof p.handheld === "number" ? [{ path: "props.handheld", label: "el kamerası", min: 0, max: 2, step: 0.05, hint: "hafif titreşim; 0 = sabit" }] : []),
  ];
  return [];
};

export const EditPanel: React.FC<{ sc: Scene; k: number; tl: Timeline; next?: Scene; edit: Edit; dirty: Record<string, unknown>; sum: { stale: string[] }; busy: boolean;
  onRevert: (paths?: string[]) => void; onClip: () => void }> = ({ sc, k, tl, next, edit, dirty, sum, busy, onRevert, onClip }) => {
  const lang = tl.captions.lang;
  const clip = CLIP_STYLES.has(sc.style);
  const opts = (sc.transitionOpts ?? {}) as Record<string, unknown>;
  const optKeys = [...new Set(["pre", "post", ...Object.keys(opts).filter((x) => typeof opts[x] === "number")])];
  const cam = cameraFields(sc);
  const sfx = ((tl.sfx ?? []) as (Timeline["sfx"][number] & { note?: string })[]).map((x, i) => ({ ...x, i })).filter((x) => x.frame >= sc.startFrame && x.frame < sc.startFrame + sc.durationFrames && x.note !== "bed");
  const words = sc.words[lang] ?? [];
  const [raw, setRaw] = useState<string | null>(null);
  const v = (p: string) => getPath(sc, p) as number | undefined;
  return (
    <div>
      <h3>{sc.id} · {sc.style} · {(sc.durationFrames / tl.fps).toFixed(1)} sn</h3>
      {clip ? <div style={{ background: "#2a2416", border: "1px solid #5a4a20", borderRadius: 6, padding: 8, fontSize: 13 }}>
        Bu stil hazır klip olarak oynuyor. Kamera ayarını değiştirince önizlemede görmek için klibi yeniden üret (~20 sn – 2 dk).
        <div style={{ marginTop: 6 }}><button disabled={busy} onClick={onClip}>Klibi yeniden üret ({sc.id})</button></div></div> : null}
      {sum.stale.includes(sc.id) ? <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Bu sahnede kaydedilmiş ama son videoya uygulanmamış değişiklik var (üstte “Videoya uygula”).</div> : null}

      {k > 0 ? <Section title="Giriş geçişi" note={TRANSITIONS[sc.transition]?.what}>
        <select value={sc.transition} onChange={(e) => edit(sc.id, "transition", e.target.value)} style={{ borderColor: "transition" in dirty ? "var(--accent)" : undefined }}>
          {Object.entries(TRANSITIONS).map(([id, t]) => <option key={id} value={id}>{t.name}</option>)}
        </select>
        {sc.transition !== "cut" ? optKeys.map((o) => <Slider key={o} label={{ pre: "hazırlık (ms)", post: "oturma (ms)", dim: "kararma (ms)", ms: "süre (ms)" }[o] ?? o}
          value={opts[o] as number | undefined} min={0} max={3000} step={50} dirty={`transitionOpts.${o}` in dirty} onChange={(x) => edit(sc.id, `transitionOpts.${o}`, x)}
          hint={o === "pre" ? "geçişten önce eski sahnenin hazırlanma süresi" : o === "post" ? "yeni sahnenin oturma süresi" : undefined} />) : null}
      </Section> : null}

      {cam.length && next && ["portal", "pullback", "objectWipe", "matte"].includes(next.transition) ? <div style={{ background: "#2a1d16", border: "1px solid #6a3a20", borderRadius: 6, padding: 8, fontSize: 13, marginTop: 8 }}>
        Dikkat: sonraki sahneye <b>{TRANSITIONS[next.transition]?.name}</b> var; hedef kutusu bu sahnenin son kadrajına göre hesaplanmış. Kamerayı değiştirirsen
        geçiş yanlış yere dalabilir. Değiştirdikten sonra geçişe bak, gerekirse sohbette “{next.id} portal hedefini düzelt” de.</div> : null}
      {cam.length ? <Section title="Kamera">{cam.map((f) => <Slider key={f.path} label={f.label} value={v(f.path)} min={f.min} max={f.max} step={f.step} hint={f.hint} dirty={f.path in dirty} onChange={(x) => edit(sc.id, f.path, x)} />)}</Section> : null}
      {sc.style === "object3d" ? <Section title="3D çekim" note="reveal: karanlıktan açılış · bellows: hava odalarına yakın + su · rest: müze planı · turntable: 360°">
        <select value={String((sc.props as Record<string, unknown>).shot ?? "reveal")} onChange={(e) => edit(sc.id, "props.shot", e.target.value)}>
          {["reveal", "bellows", "rest", "turntable"].map((s) => <option key={s}>{s}</option>)}</select></Section> : null}

      <Section title="Ses efektleri" note="seviye dB (−60 sessiz, −20 belirgin); kaydedince üstte “Sesi yeniden karıştır” çıkar">
        {sfx.length ? sfx.map((x) => <Slider key={x.i} label={`${fmt(x.frame / tl.fps)} ${x.file.split("/").pop()?.replace(/\.(wav|mp3|ogg)$/, "")}`} value={x.gainDb} min={-60} max={-10} step={1}
          dirty={false} onChange={(g) => edit("_", `sfx.${x.i}.gainDb`, g)} />) : <div className="muted">bu sahnede efekt yok</div>}
      </Section>

      <Section title="Altyazı" note="yalnızca ekrandaki yazı; ses değişmez. Zaman sahne başına göre ms.">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {words.map((w, i) => <span key={i} style={{ display: "inline-flex", flexDirection: "column", gap: 2 }}>
            <input value={w.text} onChange={(e) => edit(sc.id, `words.${lang}.${i}.text`, e.target.value)} size={Math.max(3, w.text.length)}
              style={{ background: "#222", color: `words.${lang}.${i}.text` in dirty ? "var(--accent)" : "inherit", border: "1px solid var(--line)", borderRadius: 4, padding: "2px 4px" }} />
            <input type="number" step={10} value={w.startMs} onChange={(e) => edit(sc.id, `words.${lang}.${i}.startMs`, Number(e.target.value))}
              style={{ width: 64, background: "#1a1a1a", color: "var(--dim)", border: "1px solid var(--line)", borderRadius: 4, fontSize: 11 }} title="başlangıç (ms)" />
          </span>)}
        </div>
      </Section>

      <Section title="Gelişmiş: sahne props (JSON)" note="her ayar burada; dikkatli kullan">
        {raw === null ? <button onClick={() => setRaw(JSON.stringify(sc.props, null, 1))}>Aç</button> : <>
          <textarea value={raw} onChange={(e) => setRaw(e.target.value)} spellCheck={false} style={{ width: "100%", height: 220, background: "#161616", color: "inherit", fontFamily: "ui-monospace, monospace", fontSize: 12 }} />
          <button onClick={() => { try { edit(sc.id, "props", JSON.parse(raw)); setRaw(null); } catch (e) { alert("JSON hatalı: " + e); } }}>Uygula</button> <button onClick={() => setRaw(null)}>Kapat</button></>}
      </Section>

      <Section title="Geri al"><button onClick={() => { if (confirm(`${sc.id} sahnesindeki kaydedilmiş tüm editör ayarları ilk hâline dönsün mü?`)) onRevert(); }}>Bu sahnedeki kaydedilmiş ayarları geri al</button></Section>
    </div>
  );
};

export const History: React.FC<{ sum: { changes: Change[] }; onPick: (sid: string) => void }> = ({ sum, onPick }) => (
  <div>
    <h3>Son değişiklikler (editor.changes.jsonl)</h3>
    <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Bu günlük Claude'a geri bildirimdir: tekrar eden tercihlerin stil kurallarına işlenir.</div>
    {sum.changes.length ? [...sum.changes].reverse().map((c, i) => (
      <div key={i} onClick={() => c.scene !== "_" && onPick(c.scene)} style={{ fontSize: 12, padding: "3px 0", borderBottom: "1px solid #222", cursor: c.scene !== "_" ? "pointer" : "default" }}>
        <span className="muted">{new Date(c.ts).toLocaleString("tr-TR")}</span> · <b>{c.scene === "_" ? "genel" : c.scene}</b> · <code>{c.path}</code>{" "}
        {c.reverted ? <span className="tag">geri alındı</span> : <>{JSON.stringify(c.from)?.slice(0, 40)} → <span style={{ color: "var(--accent)" }}>{JSON.stringify(c.to)?.slice(0, 40)}</span></>}
      </div>)) : <div className="muted">henüz değişiklik yok</div>}
  </div>
);
