// Medya sekmesi: bölümün ürettiği her şeyi Finder'a gitmeden dinle/izle (kullanıcı 2026-11-11: "önizlemeleri stüdyodan yapabilmem lazım").
// Anlatım, sahne sesleri (seçilen deneme + diğer denemeler, Whisper'ın duyduğu metin, WER), görseller, videolar. Liste /api/episode/<id>/media.
import { useEffect, useState } from "react";

type Take = { take: number; file: string; wer: number; audio_s: number; hyp?: string; sim?: number };
type M = { narration: string | null; scenesAudio: { path: string }[]; report: { id: string; text: string; chosen: number; takes: Take[] }[] | null;
  images: { path: string; size: number }[]; videos: { path: string; size: number; mtime: number }[]; audioOther: { path: string }[] };

const name = (p: string) => p.split("/").pop()!;
const kb = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1e3)} KB`);

export const Media: React.FC<{ ep: string }> = ({ ep }) => {
  const [m, setM] = useState<M | null>(null);
  const [big, setBig] = useState<string | null>(null);
  const [showTakes, setShowTakes] = useState<Record<string, boolean>>({});
  // önbellek kırıcı yalnız "Yenile"de değişir: her yeniden çizimde değişirse oynatıcı sesi baştan yükler ve çalarken kesilir (kullanıcı 2026-11-11)
  const [ver, setVer] = useState(() => Date.now());
  const load = () => fetch(`/api/episode/${ep}/media`).then((r) => r.json()).then((x) => { setM(x); setVer(Date.now()); });
  useEffect(() => { load(); }, [ep]);
  if (!m) return <div className="muted">yükleniyor…</div>;
  const v = (p: string) => `/${p}?v=${ver}`;
  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}><h3 style={{ margin: 0 }}>Medya</h3><button onClick={load} style={{ fontSize: 12 }}>Yenile</button></div>
      <h3>Anlatım</h3>
      {m.narration ? <audio controls src={v(m.narration)} style={{ width: "100%" }} /> : <div className="muted">henüz ses yok</div>}

      {m.report ? <><h3>Sahne sesleri</h3>
        {m.report.map((s) => { const ch = s.takes.find((t) => t.take === s.chosen) ?? s.takes[0]; const warn = ch && ch.wer > 0.05; return (
          <div key={s.id} style={{ borderBottom: "1px solid #232326", padding: "6px 0" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <b style={{ width: 34 }}>{s.id}</b>
              <audio controls preload="none" src={v(`${m.scenesAudio.find((a) => a.path.endsWith(`/${s.id}.wav`))?.path ?? ch?.file}`)} style={{ height: 30, flex: "1 1 220px" }} />
              {ch ? <span className="tag" style={{ background: warn ? "#5a2a20" : undefined }} title="Whisper'ın yanlış duyduğu kelime oranı (0 = birebir)">WER {ch.wer.toFixed(2)}</span> : null}
              {ch ? <span className="muted" style={{ fontSize: 11 }}>{ch.audio_s.toFixed(1)} sn</span> : null}
              {s.takes.length > 1 ? <button style={{ fontSize: 11 }} onClick={() => setShowTakes({ ...showTakes, [s.id]: !showTakes[s.id] })}>{s.takes.length} deneme</button> : null}
            </div>
            <div style={{ fontSize: 12, marginTop: 2 }}>{s.text}</div>
            {warn && ch?.hyp ? <div style={{ fontSize: 11, color: "#e8b86a" }}>Whisper şunu duydu: “{ch.hyp}”</div> : null}
            {showTakes[s.id] ? s.takes.map((t) => <div key={t.take} style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 3, fontSize: 11 }}>
              <span style={{ width: 70 }}>deneme {t.take}{t.take === s.chosen ? " ✓" : ""}</span>
              <audio controls preload="none" src={v(t.file)} style={{ height: 26, flex: 1 }} />
              <span className="muted">WER {t.wer.toFixed(2)} · {t.audio_s.toFixed(1)} sn</span></div>) : null}
          </div>); })}
        <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Başka bir denemeyi seçmek ya da sahneyi yeniden ürettirmek için sohbette söyle (ör. “s05'te 1. denemeyi kullan”).</div>
      </> : null}

      {m.videos.length ? <><h3>Videolar</h3>
        {m.videos.map((x) => <details key={x.path} style={{ marginBottom: 6 }}><summary style={{ cursor: "pointer", fontSize: 13 }}>{x.path.split("/").slice(2).join("/")} <span className="muted">· {kb(x.size)} · {new Date(x.mtime).toLocaleString("tr-TR")}</span></summary>
          <video controls preload="none" src={v(x.path)} style={{ width: "100%", maxHeight: 420, background: "#000", marginTop: 4 }} /></details>)}</> : null}

      {m.images.length ? <><h3>Görseller ({m.images.length})</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 6 }}>
          {m.images.map((x) => <div key={x.path} onClick={() => setBig(x.path)} title={x.path.split("/").slice(2).join("/")} style={{ cursor: "zoom-in", background: "#111", borderRadius: 6, overflow: "hidden" }}>
            <img loading="lazy" src={`/${x.path}`} style={{ width: "100%", height: 90, objectFit: "cover", display: "block" }} />
            <div className="muted" style={{ fontSize: 9, padding: "2px 4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name(x.path)}</div></div>)}
        </div></> : null}

      {m.audioOther.length ? <><h3>Diğer sesler</h3>{m.audioOther.map((x) => <div key={x.path} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}><span style={{ width: 200, overflow: "hidden", textOverflow: "ellipsis" }}>{name(x.path)}</span><audio controls preload="none" src={v(x.path)} style={{ height: 28, flex: 1 }} /></div>)}</> : null}

      {big ? <div onClick={() => setBig(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", display: "grid", placeItems: "center", zIndex: 50, cursor: "zoom-out" }}>
        <img src={`/${big}`} style={{ maxWidth: "92vw", maxHeight: "86vh" }} /><div style={{ color: "#ccc", fontSize: 12, marginTop: 6 }}>{big.split("/").slice(2).join("/")}</div></div> : null}
    </div>
  );
};
