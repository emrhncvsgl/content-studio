// Stil kütüphanesi: kataloğun TÜMÜ (yapılmış ve yapılmamış), görünüş / teknik / kurgu kalıbı eksenlerine ayrılmış (catalog/visual-axes.yaml).
// Kullanıcı 2026-11-11: "bilmediğim stilleri de görmek isterim; seçenekler kanalın stiline göre sınırlı kalıyor".
// Yapılmamış bir görünüş seçilirse Claude style-study ile kurar (6-8 sn deneme klibi); burada istek olarak görünür.
import { useMemo, useState } from "react";

export type Style = { name?: { tr?: string; en?: string }; does?: string; use_when?: string; implemented?: boolean; mix_with?: string[]; kind?: string; ref?: string; status?: string };
export type Axes = {
  techniques: Record<string, { tr: string; what: string; built: boolean; via?: string }>;
  looks: Record<string, { made_with: string[] }>;
  technique_styles: Record<string, { technique: string | null; note: string }>;
  edit_patterns: Record<string, { note: string }>;
} | null;

const Card: React.FC<{ id: string; s: Style; extra?: React.ReactNode; current?: boolean }> = ({ id, s, extra, current }) => (
  <div style={{ border: `1px solid ${current ? "var(--accent)" : "var(--line)"}`, borderRadius: 8, padding: 8, background: "#19191b" }}>
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <b style={{ fontSize: 13 }}>{s.name?.tr ?? id}</b>
      <span className={`tag ${s.implemented ? "y" : ""}`} style={{ fontSize: 10 }}>{s.implemented ? "hazır" : "yapılmadı"}</span>
      {current ? <span className="tag" style={{ fontSize: 10 }}>bu sahnede</span> : null}
    </div>
    <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>{s.does}</div>
    {s.use_when ? <div style={{ fontSize: 12, marginTop: 3 }}><span className="muted">Ne zaman:</span> {s.use_when}</div> : null}
    {extra}
    <div style={{ fontSize: 10, color: "#6f6c66", marginTop: 4 }}><code>{id}</code>{s.ref ? ` · ${s.ref}` : ""}</div>
  </div>
);

export const Library: React.FC<{ cat: Record<string, Style>; axes: Axes; currentStyle?: string }> = ({ cat, axes, currentStyle }) => {
  const [axis, setAxis] = useState<"look" | "technique" | "edit">("look");
  const [only, setOnly] = useState<"all" | "built" | "unbuilt">("all");
  const [q, setQ] = useState("");
  const [tech, setTech] = useState<string>("");
  const looks = useMemo(() => Object.entries(axes?.looks ?? {}).filter(([id]) => cat[id])
    .filter(([id]) => only === "all" || (only === "built") === !!cat[id].implemented)
    .filter(([id, l]) => !tech || l.made_with.includes(tech))
    .filter(([id]) => !q || JSON.stringify(cat[id]).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => Number(!!cat[b[0]].implemented) - Number(!!cat[a[0]].implemented)), [axes, cat, only, q, tech]);
  if (!axes) return <div className="muted">catalog/visual-axes.yaml yok</div>;
  const nBuilt = Object.keys(axes.looks).filter((id) => cat[id]?.implemented).length;
  return (
    <div>
      <h3>Stil kütüphanesi</h3>
      <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
        {Object.keys(axes.looks).length} görünüş ({nBuilt} hazır) · {Object.keys(axes.techniques).length} teknik · {Object.keys(axes.edit_patterns).length} kurgu kalıbı.
        Görünüş ile teknik ayrı eksen: bir görünüş birden çok teknikle yapılabilir. Yapılmamış bir görünüşü istersen sohbette söyle (“EP013 s02 için ukiyo-e dene”);
        önce 6-8 sn deneme klibi kurulur.
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {(["look", "technique", "edit"] as const).map((a) => <button key={a} onClick={() => setAxis(a)} style={{ background: axis === a ? "var(--sel)" : undefined, borderColor: axis === a ? "var(--accent)" : undefined }}>
          {{ look: "Görünüşler", technique: "Teknikler", edit: "Kurgu kalıpları" }[a]}</button>)}
      </div>
      {axis === "look" ? <>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          <select value={only} onChange={(e) => setOnly(e.target.value as typeof only)}><option value="all">hepsi</option><option value="built">yalnız hazır</option><option value="unbuilt">yalnız yapılmamış</option></select>
          <select value={tech} onChange={(e) => setTech(e.target.value)}><option value="">her teknik</option>{Object.entries(axes.techniques).map(([id, t]) => <option key={id} value={id}>{t.tr}</option>)}</select>
          <input placeholder="ara (ör. baskı, harita, 3D)" value={q} onChange={(e) => setQ(e.target.value)} style={{ background: "#222", color: "inherit", border: "1px solid var(--line)", borderRadius: 6, padding: "3px 8px" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 8 }}>
          {looks.map(([id, l]) => <Card key={id} id={id} s={cat[id]} current={id === currentStyle}
            extra={<div style={{ fontSize: 11, marginTop: 4 }}><span className="muted">Yapılabileceği teknikler:</span> {l.made_with.map((t) => axes.techniques[t]?.tr ?? t).join(" · ")}</div>} />)}
        </div>
      </> : null}
      {axis === "technique" ? <div style={{ display: "grid", gap: 8 }}>
        {Object.entries(axes.techniques).map(([id, t]) => {
          const n = Object.values(axes.looks).filter((l) => l.made_with.includes(id)).length;
          return <div key={id} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 8, background: "#19191b" }}>
            <b>{t.tr}</b> <span className={`tag ${t.built ? "y" : ""}`} style={{ fontSize: 10 }}>{t.built ? "elimizde" : "yok"}</span>
            <div className="muted" style={{ fontSize: 12 }}>{t.what}</div>
            <div style={{ fontSize: 11, marginTop: 3 }}><span className="muted">Kodda:</span> {t.via ?? "—"} · <a href="#" onClick={(e) => { e.preventDefault(); setTech(id); setAxis("look"); }} style={{ color: "var(--accent)" }}>bu teknikle yapılabilecek {n} görünüş</a></div>
          </div>;
        })}
        <h3>Aslında teknik olan katalog kayıtları</h3>
        {Object.entries(axes.technique_styles).map(([id, t]) => <div key={id} style={{ fontSize: 12 }}><code>{id}</code> → {t.technique ? axes.techniques[t.technique]?.tr : "—"} <span className="muted">· {t.note}</span></div>)}
      </div> : null}
      {axis === "edit" ? <div style={{ display: "grid", gap: 8 }}>
        {Object.entries(axes.edit_patterns).map(([id, e]) => <Card key={id} id={id} s={cat[id] ?? {}} extra={<div className="muted" style={{ fontSize: 11 }}>{e.note}</div>} />)}
      </div> : null}
    </div>
  );
};
