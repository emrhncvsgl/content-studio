// Yeni video akışı (docs/editor/DESIGN.md §0, §11): ana sayfa → fikir → konuya özel sorular → görsel yön panosu (katman katman, notlarla) → bölüm oluşur
// → hazırlık ekranı (senaryo panosu + yön özeti + Claude sohbeti). Kullanıcı 2026-11-11: "baştan yapma sebebim bu: sohbette 4 seçenek var, normalde 10 tane".
import { useEffect, useMemo, useState } from "react";
import type { Axes, Style } from "./library";
import { Chat } from "./chat";
import { Media } from "./media";

const getJSON = async <T,>(u: string): Promise<T> => { const r = await fetch(u); if (!r.ok) throw new Error(`${u}: ${r.status}`); return r.json(); };
const post = async <T,>(u: string, body: unknown): Promise<T> => { const r = await fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json(); if (!r.ok || j.error) throw new Error(j.error ?? String(r.status)); return j; };
export const go = (q: string) => { location.search = q; };

type Opt = { id: string; label: string; detail: string };
// görsel yön panosunun sabit katmanları (görünüş ve teknik kütüphaneden gelir)
export const BOARD: { key: string; title: string; question: string; multi: boolean; options: Opt[] }[] = [
  { key: "camera", title: "Kamera dili", question: "Nereden bakıyoruz, nasıl hareket ediyor?", multi: true, options: [
    { id: "calm-doc", label: "Sakin belgesel", detail: "yavaş itme, uzun planlar, ağır yumuşatma" },
    { id: "dynamic", label: "Dinamik", detail: "hızlı itme, savurma (whip), kısa planlar" },
    { id: "one-take", label: "Tek plan uzun çekim", detail: "kamera tek bir dünyada kesintisiz gezer" },
    { id: "observer", label: "Gözlemci el kamerası", detail: "hafif titreşim, belgesel hissi" },
    { id: "tabletop", label: "Masa üstü", detail: "kuşbakışı kolaj, kâğıtlar masaya düşer" },
    { id: "hero", label: "Kahraman çekim", detail: "nesne etrafında yörünge, alçak açı, tek spot" },
    { id: "macro", label: "Makro ayrıntı", detail: "çok yakın, yalayan ışık, doku öne çıkar" } ] },
  { key: "light", title: "Işık ve renk", question: "Hangi ruh hâli?", multi: true, options: [
    { id: "dark-key", label: "Karanlık + tek sıcak ışık", detail: "müze, gece, gizem" },
    { id: "sepia", label: "Sepya arşiv", detail: "eski fotoğraf, nostalji" },
    { id: "bw-accent", label: "Siyah-beyaz + tek renk vurgu", detail: "dikkat tek bir şeye" },
    { id: "flat-bold", label: "Canlı düz renkler", detail: "vox açıklayıcı, net ve modern" },
    { id: "night-blue", label: "Gece mavisi", detail: "soğuk, sessiz, deniz" },
    { id: "daylight", label: "Doğal gün ışığı", detail: "sıcak, açık, gerçekçi" },
    { id: "blueprint", label: "Teknik mavi", detail: "çizim, mühendislik" } ] },
  { key: "tempo", title: "Tempo ve ritim", question: "Kısa vuruşlar mı, uzun bekleyişler mi?", multi: false, options: [
    { id: "slow", label: "Sakin", detail: "6-8 sn sahneler, nefes alan" },
    { id: "medium", label: "Orta", detail: "4-6 sn" },
    { id: "fast", label: "Hızlı vuruşlar", detail: "2-4 sn, enerjik" },
    { id: "mixed", label: "Karışık", detail: "hızlı açılış, ağır orta, sakin son" } ] },
  { key: "transitions", title: "Geçiş ailesi", question: "Sahneler nasıl bağlansın?", multi: true, options: [
    { id: "object", label: "Nesneli geçişler", detail: "portal, nesneyle silme (güçlü yanımız)" },
    { id: "invisible", label: "Görünmez / düz kesme", detail: "temiz, hızlı" },
    { id: "fog", label: "Sis ve kararma", detail: "zaman/yer atlaması" },
    { id: "match", label: "Şekil eşleşmeli kesme", detail: "iki görüntü arasında şekil kafiyesi" },
    { id: "camera-move", label: "Kamera hareketiyle", detail: "whip, geri çekilme" } ] },
  { key: "texture", title: "Doku", question: "Yüzey nasıl hissettirsin?", multi: true, options: [
    { id: "film", label: "Film tanesi + toz", detail: "eski, sıcak" },
    { id: "paper", label: "Kâğıt / baskı", detail: "el yapımı, kolaj" },
    { id: "clean", label: "Temiz dijital", detail: "net, modern" },
    { id: "halftone", label: "Gazete noktaları", detail: "basın, arşiv" } ] },
  { key: "music", title: "Müzik ruhu", question: "Ne duyuyoruz?", multi: false, options: [
    { id: "piano", label: "Sade piyano", detail: "Satie benzeri, seyrek" },
    { id: "strings", label: "Sinematik yaylılar", detail: "geniş, duygusal (abartmadan)" },
    { id: "light", label: "Hafif / esprili", detail: "merak, gülümseme" },
    { id: "tense", label: "Gerilimli", detail: "kriz, tehlike" },
    { id: "none", label: "Müzik yok", detail: "ortam sesi ve sessizlik" } ] },
  { key: "captions", title: "Altyazı", question: "Yazı ekranda nasıl dursun?", multi: false, options: [
    { id: "cap-paper", label: "Kâğıt şeritler", detail: "kanalın imzası" },
    { id: "serif", label: "Sade serif", detail: "belgesel, ağırbaşlı" },
    { id: "karaoke", label: "Kelime kelime vurgu", detail: "hızlı, sosyal medya" } ] },
];

// ---------- ana sayfa ----------
export const Home: React.FC = () => {
  const [eps, setEps] = useState<{ id: string; title: string; channel: string; hasTimeline: boolean; next: string | null; thumb: string | null }[]>([]);
  useEffect(() => { getJSON<typeof eps>("/api/episodes").then(setEps); }, []);
  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Stüdyo</h1><span style={{ flex: 1 }} />
        <button onClick={() => go("new=1")} style={{ background: "var(--accent)", color: "#111", border: "none", fontWeight: 700, padding: "8px 16px" }}>+ Yeni video</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 14, marginTop: 18 }}>
        {eps.map((e) => (
          <div key={e.id} onClick={() => go(`ep=${e.id}`)} style={{ cursor: "pointer", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden", background: "#19191b" }}>
            <div style={{ aspectRatio: "9 / 12", background: "#222", display: "grid", placeItems: "center" }}>
              {e.thumb ? <img src={e.thumb} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span className="muted" style={{ fontSize: 12 }}>{e.hasTimeline ? "" : "hazırlıkta"}</span>}</div>
            <div style={{ padding: 8 }}><div style={{ fontSize: 12, fontWeight: 600 }}>{e.id.split("-")[0]}</div>
              <div className="muted" style={{ fontSize: 11, lineHeight: 1.3, maxHeight: 44, overflow: "hidden" }}>{e.title}</div>
              <div style={{ fontSize: 10, marginTop: 4 }}><span className="tag" style={{ fontSize: 10 }}>{e.channel}</span>{e.next ? <span className="tag y" style={{ fontSize: 10 }}>{e.next}</span> : null}</div></div>
          </div>))}
      </div>
    </div>
  );
};

// ---------- yön panosu: kart seçimi + katman notu ----------
type Dir = Record<string, { pick: string[]; note: string }>;
const Cards: React.FC<{ options: (Opt & { img?: string | null; tag?: string })[]; picked: string[]; multi: boolean; onPick: (ids: string[]) => void; min?: number }> = ({ options, picked, multi, onPick, min = 180 }) => (
  <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))`, gap: 8 }}>
    {options.map((o) => { const on = picked.includes(o.id); return (
      <div key={o.id} onClick={() => onPick(multi ? (on ? picked.filter((x) => x !== o.id) : [...picked, o.id]) : [o.id])}
        style={{ cursor: "pointer", border: `2px solid ${on ? "var(--accent)" : "var(--line)"}`, borderRadius: 8, overflow: "hidden", background: on ? "#2a2616" : "#19191b" }}>
        {o.img !== undefined ? <div style={{ height: 90, background: "#111", display: "grid", placeItems: "center", overflow: "hidden" }}>{o.img ? <img src={o.img} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span className="muted" style={{ fontSize: 10 }}>örnek yok</span>}</div> : null}
        <div style={{ padding: 7 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{o.label} {o.tag ? <span className="tag" style={{ fontSize: 9 }}>{o.tag}</span> : null}</div><div className="muted" style={{ fontSize: 11 }}>{o.detail}</div></div>
      </div>); })}
  </div>
);
const Note: React.FC<{ value: string; onChange: (v: string) => void; ph: string }> = ({ value, onChange, ph }) => (
  <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={ph}
    style={{ width: "100%", height: 46, marginTop: 6, background: "#161618", color: "inherit", border: "1px solid var(--line)", borderRadius: 6, padding: 6, font: "inherit", fontSize: 13 }} />
);

// katman bölümü (bileşen dışarıda: içeride tanımlanırsa her tuşta yeniden kurulur, not kutusu odağı kaybeder)
const Section: React.FC<{ title: string; q: string; note: string; onNote: (v: string) => void; children: React.ReactNode; ph?: string }> = ({ title, q, note, onNote, children, ph }) => (
  <section style={{ borderTop: "1px solid var(--line)", padding: "14px 0" }}>
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}><b style={{ fontSize: 15 }}>{title}</b><span className="muted" style={{ fontSize: 12 }}>{q}</span></div>
    {children}<Note value={note} onChange={onNote} ph={ph ?? "Kendi notun (ör. renkler daha soluk olsun, açılış çok yavaş başlasın)"} />
  </section>);

export const DirectionBoard: React.FC<{ cat: Record<string, Style>; axes: Axes; dir: Dir; setDir: (d: Dir) => void }> = ({ cat, axes, dir, setDir }) => {
  const [allLooks, setAllLooks] = useState(false);
  const get = (k: string) => dir[k] ?? { pick: [], note: "" };
  const set = (k: string, v: Partial<{ pick: string[]; note: string }>) => setDir({ ...dir, [k]: { ...get(k), ...v } });
  const looks = useMemo(() => Object.keys(axes?.looks ?? {}).filter((id) => cat[id]).sort((a, b) => Number(!!cat[b].implemented) - Number(!!cat[a].implemented))
    .filter((id) => allLooks || cat[id].implemented).map((id) => ({ id, label: cat[id].name?.tr ?? id, detail: cat[id].use_when ?? "", img: cat[id].implemented ? `/api/style-example/${id}` : null, tag: cat[id].implemented ? undefined : "yapılmadı" })), [cat, axes, allLooks]);
  const techs = Object.entries(axes?.techniques ?? {}).map(([id, t]) => ({ id, label: t.tr, detail: t.what }));
  return (
    <div>
      <Section note={get("look").note} onNote={(v) => set("look", { note: v })} title="1 · Görünüş" q="Kare neye benzesin? Birden fazla seçebilirsin; ilk seçtiğin ana görünüş olur.">
        <div style={{ marginBottom: 6 }}><label className="muted" style={{ fontSize: 12 }}><input type="checkbox" checked={allLooks} onChange={(e) => setAllLooks(e.target.checked)} /> yapılmamış görünüşleri de göster ({Object.keys(axes?.looks ?? {}).length})</label></div>
        <Cards options={looks} picked={get("look").pick} multi onPick={(p) => set("look", { pick: p })} />
      </Section>
      <Section note={get("technique").note} onNote={(v) => set("technique", { note: v })} title="2 · Teknik" q="Nasıl üretilsin? Boş bırakırsan görünüşe en uygun tekniği Claude seçer.">
        <Cards options={techs} picked={get("technique").pick} multi onPick={(p) => set("technique", { pick: p })} min={210} />
      </Section>
      {BOARD.map((b) => <Section key={b.key} note={get(b.key).note} onNote={(v) => set(b.key, { note: v })} title={b.title} q={b.question}><Cards options={b.options} picked={get(b.key).pick} multi={b.multi} onPick={(p) => set(b.key, { pick: p })} /></Section>)}
      <section style={{ borderTop: "1px solid var(--line)", padding: "14px 0" }}>
        <b style={{ fontSize: 15 }}>Genel not</b> <span className="muted" style={{ fontSize: 12 }}>Videonun bütünü için: his, referans, olmasın dediğin şeyler</span>
        <Note value={get("overall").note} onChange={(v) => set("overall", { note: v })} ph="Ör. eski bir belgesel izliyormuş gibi hissettirsin ama sıkıcı olmasın; çok dramatik müzik olmasın." />
      </section>
    </div>
  );
};

// ---------- sihirbaz ----------
type Q = { id: string; q: string; why?: string; options: { label: string; detail?: string }[]; recommended: number };
export const Wizard: React.FC<{ cat: Record<string, Style>; axes: Axes }> = ({ cat, axes }) => {
  const [step, setStep] = useState(0);
  const [idea, setIdea] = useState("");
  const [format, setFormat] = useState<"short" | "long">("short");
  const [channel, setChannel] = useState("triz");
  const [qs, setQs] = useState<{ title: string; questions: Q[] } | null>(null);
  const [ans, setAns] = useState<Record<string, { i: number; own: string }>>({});
  const [dir, setDir] = useState<Dir>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const ask = async () => {
    setBusy("Claude bu fikre özel sorular yazıyor (~20-60 sn)…"); setErr(null);
    try { const r = await post<{ title: string; questions: Q[] }>("/api/questions", { idea, format, channel }); setQs(r); setAns(Object.fromEntries(r.questions.map((q) => [q.id, { i: q.recommended, own: "" }]))); setStep(1); }
    catch (e) { setErr(String(e)); } finally { setBusy(null); }
  };
  const create = async () => {
    setBusy("Bölüm oluşturuluyor…"); setErr(null);
    try {
      const answers = (qs?.questions ?? []).map((q) => ({ q: q.q, a: ans[q.id]?.own?.trim() || q.options[ans[q.id]?.i ?? q.recommended]?.label }));
      const r = await post<{ id: string }>("/api/new", { idea, title: qs?.title ?? idea, format, channel, answers, direction: { layers: dir } });
      go(`ep=${r.id}&start=1`);
    } catch (e) { setErr(String(e)); } finally { setBusy(null); }
  };
  const steps = ["Fikir", "Sorular", "Görsel yön"];
  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={() => go("")}>← Stüdyo</button><h1 style={{ margin: 0, fontSize: 20 }}>Yeni video</h1>
        <span style={{ flex: 1 }} />{steps.map((s, i) => <span key={s} className={`tag ${i === step ? "y" : ""}`}>{i + 1}. {s}</span>)}
      </div>
      {err ? <div style={{ color: "#ff8a80", margin: "10px 0" }}>{err}</div> : null}
      {busy ? <div style={{ margin: "10px 0", background: "#3a2a10", padding: 8, borderRadius: 6 }}>{busy}</div> : null}
      {step === 0 ? <div style={{ marginTop: 16 }}>
        <textarea value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="Video ne hakkında? Ör. Lincoln'ün patentini aldığı tekne kaldırma icadı; ya da bir soru: kediler neden hep ayaklarının üstüne düşer?"
          style={{ width: "100%", height: 110, background: "#1b1b1d", color: "inherit", border: "1px solid var(--line)", borderRadius: 8, padding: 10, font: "inherit", fontSize: 15 }} />
        <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center" }}>
          <select value={format} onChange={(e) => setFormat(e.target.value as "short")}><option value="short">Short (~45 sn, dikey)</option><option value="long">Uzun video (yatay)</option></select>
          <select value={channel} onChange={(e) => setChannel(e.target.value)}><option value="triz">TRIZ Academy</option><option value="inyourhand">In Your Hand</option><option value="mana">Mana</option></select>
          <span style={{ flex: 1 }} /><button disabled={!idea.trim() || !!busy} onClick={ask}>Devam → sorular</button>
        </div></div> : null}
      {step === 1 && qs ? <div style={{ marginTop: 16 }}>
        <div className="muted">Çalışma adı: <b style={{ color: "var(--text)" }}>{qs.title}</b> · önerilen cevaplar seçili geldi; istersen değiştir ya da kendi cevabını yaz.</div>
        {qs.questions.map((q) => (
          <div key={q.id} style={{ borderTop: "1px solid var(--line)", padding: "12px 0" }}>
            <b>{q.q}</b>{q.why ? <div className="muted" style={{ fontSize: 12 }}>{q.why}</div> : null}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
              {q.options.map((o, i) => <button key={i} onClick={() => setAns({ ...ans, [q.id]: { i, own: "" } })} title={o.detail}
                style={{ background: ans[q.id]?.i === i && !ans[q.id]?.own ? "var(--sel)" : undefined, borderColor: ans[q.id]?.i === i && !ans[q.id]?.own ? "var(--accent)" : undefined }}>
                {o.label}{i === q.recommended ? " ★" : ""}</button>)}
            </div>
            <input value={ans[q.id]?.own ?? ""} onChange={(e) => setAns({ ...ans, [q.id]: { i: ans[q.id]?.i ?? q.recommended, own: e.target.value } })} placeholder="Kendi cevabım"
              style={{ marginTop: 6, width: "100%", background: "#161618", color: "inherit", border: "1px solid var(--line)", borderRadius: 6, padding: 6 }} />
          </div>))}
        <div style={{ display: "flex", gap: 10, marginTop: 10 }}><button onClick={() => setStep(0)}>← Geri</button><span style={{ flex: 1 }} /><button onClick={() => setStep(2)}>Devam → görsel yön</button></div>
      </div> : null}
      {step === 2 ? <div style={{ marginTop: 8 }}>
        <div className="muted" style={{ fontSize: 13, margin: "8px 0" }}>Her katmandan istediğini seç, istersen not yaz. Seçmediğin katmanları Claude kanal tarzına ve konuya göre doldurur. Seçimlerin ve notların <code>direction.yaml</code>'a yazılır; Claude storyboard'u buna göre kurar.</div>
        <DirectionBoard cat={cat} axes={axes} dir={dir} setDir={setDir} />
        <div style={{ display: "flex", gap: 10, marginTop: 10, position: "sticky", bottom: 0, background: "var(--bg)", padding: "10px 0" }}><button onClick={() => setStep(1)}>← Geri</button><span style={{ flex: 1 }} />
          <button disabled={!!busy} onClick={create} style={{ background: "var(--accent)", color: "#111", border: "none", fontWeight: 700 }}>Bölümü oluştur ve Claude'a gönder</button></div>
      </div> : null}
    </div>
  );
};

// ---------- hazırlık ekranı (timeline öncesi): yön özeti + senaryo panosu + sohbet ----------
type ScriptScene = { id: string; text: string; emotion?: string; max_seconds?: number; visual?: { style?: string; asset_hints?: string[] } };
export const Prep: React.FC<{ sum: { id: string; brief: Record<string, unknown>; state: { steps?: Record<string, { status: string }> }; direction: Record<string, unknown> | null; script: string | null }; cat: Record<string, Style>; axes: Axes; reload: () => void }> = ({ sum, cat, axes, reload }) => {
  const [tab, setTab] = useState<"senaryo" | "yon" | "medya">(sum.script ? "senaryo" : "yon");
  const [script, setScript] = useState<{ scenes: ScriptScene[] } | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [dir, setDir] = useState<Dir>(((sum.direction?.layers as Dir) ?? {}));
  const [audioVer] = useState(() => Date.now());   // sabit: yeniden çizimde değişirse oynatıcı sıfırlanır
  const started = new URLSearchParams(location.search).get("start") === "1";
  const loadScript = () => sum.script && getJSON<{ scenes: ScriptScene[] }>(`/${sum.script}?t=${Date.now()}`).then(setScript).catch(() => setScript(null));
  useEffect(() => { loadScript(); }, [sum.script]);
  const steps = sum.state?.steps ?? {};
  const WPS = 2.6;   // anlatım hızı (kelime/sn), narrator_v3 ölçüsüne yakın
  const seed = started && steps.script?.status !== "done" ? `/shorts ${sum.id.split("-")[0]} — bu bölümü editörden başlattım. direction.yaml'daki cevaplarımı ve görsel yön seçimlerimi/notlarımı oku. Senaryoyu yaz, ONAY 1'de dur; Türkçe özetle ve sahne tablosunu kısaca ver.` : "";
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 420px", height: "100%", minHeight: 0 }}>
      <div style={{ overflow: "auto", padding: "10px 18px" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={() => go("")}>← Stüdyo</button><b>{sum.id}</b><span className="muted" style={{ fontSize: 12 }}>{String(sum.brief?.topic ?? "")}</span>
          <span style={{ flex: 1 }} />
          {Object.entries(steps).map(([k, v]) => <span key={k} className={`tag ${v.status === "done" ? "" : "y"}`} style={{ fontSize: 10 }}>{k}: {v.status}</span>)}
        </div>
        <div style={{ display: "flex", gap: 6, margin: "10px 0" }}>
          <button onClick={() => setTab("senaryo")} style={{ borderColor: tab === "senaryo" ? "var(--accent)" : undefined }}>Senaryo</button>
          <button onClick={() => setTab("yon")} style={{ borderColor: tab === "yon" ? "var(--accent)" : undefined }}>Görsel yön</button>
          <button onClick={() => setTab("medya")} style={{ borderColor: tab === "medya" ? "var(--accent)" : undefined }}>Medya (ses, görsel)</button>
          <button onClick={() => { reload(); loadScript(); }}>Yenile</button>
        </div>
        {msg ? <div style={{ background: "#1e2a1e", padding: 8, borderRadius: 6, fontSize: 13, whiteSpace: "pre-wrap" }}>{msg}</div> : null}
        {tab === "senaryo" ? (script ? <div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Her sahne bir kart. Sözlerin süresi yaklaşık {WPS} kelime/sn ile hesaplanır; kırmızı = sahnenin üst sınırını aşıyor. Metni düzeltip kaydedebilirsin.</div>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8 }}>
            {script.scenes.map((s) => { const t = edits[s.id] ?? s.text, sec = t.split(/\s+/).filter(Boolean).length / WPS, over = s.max_seconds && sec > s.max_seconds; return (
              <div key={s.id} style={{ flex: `0 0 ${Math.max(120, sec * 26)}px`, border: `1px solid ${over ? "#a33" : "var(--line)"}`, borderRadius: 8, padding: 6, background: "#19191b" }}>
                <div style={{ fontSize: 11, display: "flex", gap: 4 }}><b>{s.id}</b><span className="muted">{s.emotion}</span><span style={{ flex: 1 }} /><span style={{ color: over ? "#ff8a80" : "var(--dim)" }}>{sec.toFixed(1)}{s.max_seconds ? `/${s.max_seconds}` : ""} sn</span></div>
                <textarea value={t} onChange={(e) => setEdits({ ...edits, [s.id]: e.target.value })} style={{ width: "100%", height: 96, marginTop: 4, background: edits[s.id] !== undefined ? "#2a2616" : "#161618", color: "inherit", border: "1px solid var(--line)", borderRadius: 6, padding: 5, font: "inherit", fontSize: 12 }} />
                <audio controls preload="none" src={`/episodes/${sum.id}/audio/en/${s.id}.wav?v=${audioVer}`} style={{ width: "100%", height: 26, marginTop: 3 }} onError={(e) => ((e.target as HTMLAudioElement).style.display = "none")} />
                {s.visual?.style ? <div className="muted" style={{ fontSize: 10, marginTop: 3 }}>görsel: {s.visual.style}</div> : null}
              </div>); })}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button disabled={!Object.keys(edits).length} onClick={async () => { const r = await post<{ ok: boolean; out: string }>(`/api/episode/${sum.id}/script`, { scenes: Object.entries(edits).map(([id, text]) => ({ id, text })) }); setMsg(`${r.ok ? "Kaydedildi" : "Doğrulama sorunu"}:\n${r.out}`); setEdits({}); loadScript(); }}>Metni kaydet</button>
            <span style={{ flex: 1 }} />
            <span className="muted" style={{ fontSize: 12, alignSelf: "center" }}>Onay ve devamı sohbetten: “Senaryoyu onaylıyorum, devam et”.</span>
          </div>
        </div> : <div className="muted">Henüz senaryo yok. Sağdaki sohbetten Claude'a başlat de; senaryo yazılınca burada kartlar olarak görünür.</div>) : null}
        {tab === "medya" ? <Media ep={sum.id} /> : null}
        {tab === "yon" ? <div>
          <DirectionBoard cat={cat} axes={axes} dir={dir} setDir={setDir} />
          <button onClick={async () => { await post(`/api/episode/${sum.id}/direction`, { ...(sum.direction ?? {}), layers: dir }); setMsg("Görsel yön kaydedildi (direction.yaml). Claude'a “görsel yönü güncelledim” de."); }}
            style={{ position: "sticky", bottom: 8, background: "var(--accent)", color: "#111", border: "none", fontWeight: 700 }}>Görsel yönü kaydet</button>
        </div> : null}
      </div>
      <div style={{ borderLeft: "1px solid var(--line)", padding: "8px 12px", minHeight: 0, display: "flex", flexDirection: "column" }}>
        <Chat ep={sum.id} seed={seed} onActivity={() => { loadScript(); }} />
      </div>
    </div>
  );
};
