// Panel içinden Claude ile sohbet (claude.mjs v2: kalıcı stream-json süreç). Çalışırken de yazılır (mesaj sıraya girer), izin soruları kart olarak gelir,
// model ve çaba seçilir. Akış 1,5 sn'de bir okunur.
import { useEffect, useRef, useState } from "react";

type Entry = { ts: string; role: "user" | "claude" | "tool" | "done" | "permission"; text: string; cost?: number; ms?: number; queued?: boolean };
type Pending = { request_id: string; tool: string; summary: string; detail: string; canAlways: boolean };
type Data = { other?: number | null; running: boolean; alive: boolean; session: string | null; model: string | null; effort: string | null; mode: string | null; lastModel: string | null; pending: Pending[]; entries: Entry[] };

const post = (u: string, b: unknown) => fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }).then((x) => x.json());

export const Chat: React.FC<{ ep: string; onActivity?: () => void; seed?: string }> = ({ ep, onActivity, seed }) => {
  const [data, setData] = useState<Data>({ running: false, alive: false, session: null, model: null, effort: null, mode: null, lastModel: null, pending: [], entries: [] });
  const [text, setText] = useState(seed ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [showTools, setShowTools] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const lastN = useRef(0);
  useEffect(() => { if (seed) setText(seed); }, [seed]);
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      const r = await fetch(`/api/episode/${ep}/chat`).then((x) => x.json()).catch(() => null);
      if (!stop && r) { setData(r); if (r.entries.length !== lastN.current) { lastN.current = r.entries.length; onActivity?.(); setTimeout(() => box.current?.scrollTo(0, 1e9), 30); } }
    };
    tick(); const t = setInterval(tick, 1500);
    return () => { stop = true; clearInterval(t); };
  }, [ep]);
  const send = async () => {
    if (!text.trim()) return;
    setErr(null);
    const r = await post(`/api/episode/${ep}/chat`, { text });
    if (r.error) setErr(r.error); else setText("");
  };
  const answer = async (p: Pending, behavior: "allow" | "deny", always = false) => {
    const r = await post(`/api/episode/${ep}/chat/permission`, { request_id: p.request_id, behavior, always });
    if (r.error) setErr(r.error);
  };
  const setOpt = (k: "model" | "effort" | "mode", v: string) => post(`/api/episode/${ep}/chat/settings`, { model: k === "model" ? v : data.model, effort: k === "effort" ? v : data.effort, mode: k === "mode" ? v : data.mode });
  const shown = data.entries.filter((e) => showTools || e.role !== "tool");
  const done = data.entries.filter((e) => e.role === "done" && e.cost);
  const cost = done.reduce((a, e) => a + (e.cost ?? 0), 0), ms = done.reduce((a, e) => a + (e.ms ?? 0), 0);
  const sel = { background: "#1b1b1d", color: "inherit", border: "1px solid var(--line)", borderRadius: 6, padding: "2px 4px", fontSize: 12 } as const;
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 0", flexWrap: "wrap" }}>
        <b>Claude</b>
        <select value={data.model ?? ""} onChange={(e) => setOpt("model", e.target.value)} style={sel} title="Model (değişiklik sonraki mesajda geçerli)">
          <option value="">model: varsayılan{data.lastModel ? ` (${data.lastModel})` : ""}</option><option value="opus">Opus</option><option value="sonnet">Sonnet</option><option value="haiku">Haiku</option></select>
        <select value={data.effort ?? ""} onChange={(e) => setOpt("effort", e.target.value)} style={sel} title="Çaba (düşük = hızlı ve az kullanım; yüksek = daha dikkatli)">
          <option value="">çaba: varsayılan</option>{["low", "medium", "high", "xhigh", "max"].map((x) => <option key={x} value={x}>{x}</option>)}</select>
        <select value={data.mode ?? "acceptEdits"} onChange={(e) => setOpt("mode", e.target.value)} style={sel} title="İzin modu (terminaldeki gibi). Değişiklik sonraki mesajda geçerli.">
          <option value="manual">izin: her şeyi sor</option><option value="acceptEdits">izin: düzenlemeler serbest</option><option value="auto">izin: otomatik</option><option value="plan">izin: yalnız plan</option></select>
        <span className="muted" style={{ fontSize: 12 }}>{data.running ? "çalışıyor…" : data.session ? "hazır" : "yeni oturum"}</span>
        <span style={{ flex: 1 }} />
        {data.running || data.alive ? <button onClick={() => post(`/api/episode/${ep}/chat/stop`, {})} title="Çalışan işi durdurur">Durdur</button> : null}
      </div>
      <div className="muted" style={{ fontSize: 11, display: "flex", gap: 8 }}>
        {done.length ? <span title="Claude Code'un bildirdiği API karşılığı tahmini maliyet; abonelikte bu tutar ödenmez, plan kotasından düşer (claude.ai → Ayarlar → Kullanım)">{done.length} tur · {Math.round(ms / 1000)} sn · ≈${cost.toFixed(2)} API karşılığı</span> : null}
        <span style={{ flex: 1 }} /><label><input type="checkbox" checked={showTools} onChange={(e) => setShowTools(e.target.checked)} /> adımları göster</label>
      </div>
      <div ref={box} style={{ flex: 1, overflow: "auto", minHeight: 120, border: "1px solid var(--line)", borderRadius: 8, padding: 8, background: "#151517", marginTop: 4 }}>
        {shown.length ? shown.map((e, i) => (
          <div key={i} style={{ margin: "6px 0", display: "flex", justifyContent: e.role === "user" ? "flex-end" : "flex-start" }}>
            {e.role === "tool" ? <div className="muted" style={{ fontSize: 11 }}>· {e.text}</div>
              : e.role === "permission" ? <div style={{ fontSize: 11, color: "#e8b86a" }}>🔒 {e.text}</div>
              : e.role === "done" ? <div className="muted" style={{ fontSize: 11 }}>— {e.text || "tur bitti"}{e.ms ? ` (${Math.round(e.ms / 1000)} sn)` : ""}</div>
              : <div style={{ maxWidth: "88%", whiteSpace: "pre-wrap", fontSize: 13, padding: "6px 10px", borderRadius: 10, background: e.role === "user" ? "#3a3420" : "#222226" }}>{e.text}{e.queued ? <span className="muted" style={{ fontSize: 10 }}> · sıraya alındı</span> : null}</div>}
          </div>)) : <div className="muted" style={{ fontSize: 12 }}>Henüz mesaj yok. Yazdığın her şey bu bölümün Claude oturumuna gider (aboneliğinden kullanım düşer).</div>}
        {data.running && !data.pending.length ? <div className="muted" style={{ fontSize: 12 }}>Claude çalışıyor… (çalışırken de yazabilirsin, mesajın sıraya girer)</div> : null}
      </div>
      {data.other ? <div style={{ marginTop: 6, border: "1px solid #a33", background: "#2a1414", borderRadius: 8, padding: 8, fontSize: 12 }}>
        Bu bölümde başka bir Claude süreci çalışıyor (pid {data.other}); mesaj gönderilemez. İki oturum aynı dosyaları ezer.</div> : null}
      {data.pending.map((p) => (
        <div key={p.request_id} style={{ marginTop: 6, border: "1px solid #8a6a2a", background: "#2a2214", borderRadius: 8, padding: 8 }}>
          <div style={{ fontSize: 13 }}><b>İzin istiyor:</b> {p.summary}</div>
          {p.detail ? <pre style={{ whiteSpace: "pre-wrap", fontSize: 11, margin: "4px 0", maxHeight: 90, overflow: "auto", background: "#1a1610", padding: 6, borderRadius: 4 }}>{p.detail}</pre> : null}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button onClick={() => answer(p, "allow")} style={{ background: "var(--accent)", color: "#111", border: "none", fontWeight: 700 }}>İzin ver</button>
            {p.canAlways ? <button onClick={() => answer(p, "allow", true)}>Bu oturumda hep izin ver</button> : null}
            <button onClick={() => answer(p, "deny")}>Reddet</button>
          </div>
        </div>))}
      {err ? <div style={{ color: "#ff8a80", fontSize: 12 }}>{err}</div> : null}
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={data.running ? "Çalışırken yazabilirsin; mesajın sıraya girer" : "Claude'a yaz (ör. s03'ün kamerası daha yavaş olsun; seçtiğim görünüşü uygula)"}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(); }}
          style={{ flex: 1, height: 64, background: "#1b1b1d", color: "inherit", border: "1px solid var(--line)", borderRadius: 8, padding: 8, font: "inherit" }} />
        <button onClick={send} disabled={!text.trim()}>Gönder<br /><span className="muted" style={{ fontSize: 10 }}>⌘↵</span></button>
      </div>
    </div>
  );
};
