// Editör ↔ Claude Code köprüsü (docs/editor/DESIGN.md §0b; fikir cinecode-studio, MIT). Claude Code CLI ekransız çalışır (kullanıcının planı, API anahtarı yok).
// 2026-11-11 v2 (kullanıcı: "Kaggle için izin istedi ama çalıştığı için izin verdim diyemedim; model/çaba seçimi lazım"):
//  - Bölüm başına KALICI süreç: claude -p --input-format stream-json --output-format stream-json --verbose --permission-prompt-tool stdio
//    (+ --model, --effort, --resume). stdin açık kalır → çalışırken yazılan mesaj sıraya girer (tur bitince işlenir).
//  - İzin soruları: CLI stdout'a {type:"control_request", request:{subtype:"can_use_tool", tool_name, input, permission_suggestions}} yazar;
//    panel kartı gösterir, cevap stdin'e {type:"control_response", response:{subtype:"success", request_id, response:{behavior:"allow"|"deny", …}}}.
//    "Bu oturumda hep izin ver" = permission_suggestions → updatedPermissions. bypassPermissions YOK; temel izin listesi projenin .claude/settings.json'u.
//  - Model/çaba editor.session.json'da; değişince süreç tur bitince kapanır, sonraki mesaj yeni ayarla --resume eder.
//  - Sorular: claude -p --model sonnet --output-format json --tools "" --json-schema (tek seferlik, araçsız).
// Her mesaj kullanıcının planından kullanım düşer (token-budget).
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const SYS = [
  "Bu oturum Stüdyo Editörü panelinden ekransız çalışıyor; kullanıcı yalnız senin metin mesajlarını görür, yanıtlar Türkçe ve kısa.",
  "Soru sorman gerekirse AskUserQuestion yerine düz metinle sor ve dur; kullanıcı panelden cevap yazar. İzin gereken komutlarda panel kullanıcıya sorar; reddedilirse nedenini söyle, ısrar etme.",
  "Proje kuralları (CLAUDE.md) aynen geçerli: aynı anda tek ağır iş, onaysız paket kurma ve dosya silme yok; Mac'te TTS yok (Kaggle), render kullanıcı onayıyla.",
  "Bölüm klasöründe direction.yaml varsa kullanıcının görsel yön seçimleri ve notları oradadır; storyboard'u ona göre kur, sapacaksan nedenini söyle.",
  "editor.changes.jsonl kullanıcının elle yaptığı ayarlardır; ezme.",
].join(" ");
export const MODELS = ["opus", "sonnet", "haiku"];
export const EFFORTS = ["low", "medium", "high", "xhigh", "max"];
// izin modları (terminaldeki gibi). bypassPermissions panelde sunulmaz: proje kuralları (onaysız silme/kurulum yok) korunur.
// manual = her şeyi sorar · acceptEdits = dosya düzenlemelerine izin, komutları sorar · auto = Claude Code sınıflandırıcısı güvenli işleri kendisi onaylar, riskliyi sorar · plan = yalnız plan
export const MODES = ["manual", "acceptEdits", "auto", "plan"];

export const makeClaude = ({ ROOT, epDir }) => {
  const procs = new Map();   // ep → { ch, busy, pending: Map<request_id, req>, closing }
  const chatFile = (dir) => path.join(dir, "editor.chat.jsonl");
  const sessFile = (dir) => path.join(dir, "editor.session.json");
  const append = (dir, e) => fs.appendFileSync(chatFile(dir), JSON.stringify({ ts: new Date().toISOString(), ...e }) + "\n");
  const session = (dir) => (fs.existsSync(sessFile(dir)) ? JSON.parse(fs.readFileSync(sessFile(dir), "utf8")) : {});
  const saveSession = (dir, patch) => fs.writeFileSync(sessFile(dir), JSON.stringify({ ...session(dir), ...patch }, null, 1));

  const short = (name, input) => {
    if (name === "Bash") return `Bash: ${String(input?.description || input?.command || "").slice(0, 140)}`;
    if (["Read", "Write", "Edit"].includes(name)) return `${name}: ${String(input?.file_path || "").replace(ROOT + "/", "")}`;
    if (name === "Agent" || name === "Task") return `Ajan: ${input?.description || input?.subagent_type || ""}`;
    if (name === "Skill") return `Skill: ${input?.skill || ""}`;
    if (name === "WebFetch") return `WebFetch: ${String(input?.url || "").slice(0, 100)}`;
    if (name === "WebSearch") return `WebSearch: ${String(input?.query || "").slice(0, 100)}`;
    return name;
  };

  // kilit: bölümde zaten çalışan bir claude süreci varsa (önceki sunucudan kalan, başka bir editör) ikincisi başlamaz.
  // 2026-11-12: sunucu yeniden başlatılınca eski süreç sahipsiz kaldı, yeni süreç aynı oturumu --resume etti → iki oturum aynı dosyaları ezdi (EP014).
  const lockFile = (dir) => path.join(dir, "editor.claude.pid");
  const alivePid = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
  const lockedBy = (dir) => {
    if (!fs.existsSync(lockFile(dir))) return null;
    const pid = Number(fs.readFileSync(lockFile(dir), "utf8")); if (!pid || !alivePid(pid)) return null;
    for (const P of procs.values()) if (P.ch.pid === pid) return null;   // bizim sürecimiz
    return pid;
  };
  const spawnFor = (id, dir) => {
    const other = lockedBy(dir);
    if (other) throw new Error(`Bu bölümde başka bir Claude süreci çalışıyor (pid ${other}). İkisi aynı dosyaları ezer; önce onu bitir ya da durdur.`);
    const s = session(dir);
    const args = ["-p", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose", "--permission-prompt-tool", "stdio",
      "--disallowedTools", "AskUserQuestion", "--append-system-prompt", SYS];
    if (s.model && MODELS.includes(s.model)) args.push("--model", s.model);
    if (s.effort && EFFORTS.includes(s.effort)) args.push("--effort", s.effort);
    args.push("--permission-mode", MODES.includes(s.mode) ? s.mode : "acceptEdits");
    if (s.sessionId) args.push("--resume", s.sessionId);
    const ch = spawn("claude", args, { cwd: ROOT, stdio: ["pipe", "pipe", "pipe"], env: { ...process.env } });
    const P = { ch, busy: 0, pending: new Map(), closing: false, model: s.model ?? null, effort: s.effort ?? null, mode: s.mode ?? null };
    procs.set(id, P);
    fs.writeFileSync(lockFile(dir), String(ch.pid));
    let buf = "", err = "";
    ch.stdout.on("data", (d) => {
      buf += d; let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 1);
        let m; try { m = JSON.parse(line); } catch { continue; }
        if (m.type === "system" && m.subtype === "init" && m.session_id) saveSession(dir, { sessionId: m.session_id, lastModel: m.model ?? null });
        if (m.type === "assistant") for (const c of m.message?.content ?? []) {
          if (c.type === "text" && c.text.trim()) append(dir, { role: "claude", text: c.text });
          if (c.type === "tool_use") append(dir, { role: "tool", text: short(c.name, c.input) });
        }
        if (m.type === "control_request") {
          const r = m.request ?? {};
          if (r.subtype === "can_use_tool") {
            P.pending.set(m.request_id, { request_id: m.request_id, tool: r.tool_name, input: r.input, suggestions: r.permission_suggestions ?? [], summary: short(r.tool_name, r.input),
              detail: r.tool_name === "Bash" ? String(r.input?.command ?? "") : JSON.stringify(r.input ?? {}).slice(0, 400), ts: Date.now() });
            append(dir, { role: "permission", text: `İzin istiyor: ${short(r.tool_name, r.input)}` });
          } else {   // bilinmeyen denetim isteği: hata dön, süreç takılmasın
            ch.stdin.write(JSON.stringify({ type: "control_response", response: { subtype: "error", request_id: m.request_id, error: "editör bu isteği desteklemiyor" } }) + "\n");
          }
        }
        if (m.type === "result") {
          P.busy = Math.max(0, P.busy - 1);
          append(dir, { role: "done", text: m.is_error ? `hata: ${String(m.result).slice(0, 300)}` : "", cost: m.total_cost_usd, ms: m.duration_ms });
          if (P.closing && P.busy === 0) ch.stdin.end();
        }
      }
    });
    ch.stderr.on("data", (d) => (err = (err + d).slice(-2000)));
    ch.on("close", (code) => {
      if (procs.get(id) === P) procs.delete(id);
      try { if (Number(fs.readFileSync(lockFile(dir), "utf8")) === ch.pid) fs.rmSync(lockFile(dir)); } catch {}
      if (code && code !== 0 && !P.closing) append(dir, { role: "done", text: `Claude ${code} koduyla çıktı: ${err.trim().split("\n").pop() ?? ""}` });
    });
    // boşta 30 dk sonra kapat (oturum dosyada; sonraki mesaj --resume eder)
    const idle = setInterval(() => { if (P.busy === 0 && !P.pending.size && Date.now() - (P.last ?? Date.now()) > 30 * 60000) { clearInterval(idle); P.closing = true; ch.stdin.end(); } }, 60000);
    ch.on("close", () => clearInterval(idle));
    return P;
  };

  const send = (id, text) => {
    const dir = epDir(id); if (!dir) throw new Error("bölüm yok");
    let P = procs.get(id);
    const s = session(dir);
    if (P && (P.model !== (s.model ?? null) || P.effort !== (s.effort ?? null) || P.mode !== (s.mode ?? null))) { if (P.busy === 0) { P.closing = true; P.ch.stdin.end(); P = null; } }
    if (!P || P.closing) P = spawnFor(id, dir);
    append(dir, { role: "user", text, queued: P.busy > 0 || undefined });
    P.busy += 1; P.last = Date.now();
    P.ch.stdin.write(JSON.stringify({ type: "user", message: { role: "user", content: text } }) + "\n");
    return { ok: true, queued: P.busy > 1 };
  };

  const answer = (id, { request_id, behavior, always, message }) => {
    const P = procs.get(id); const req = P?.pending.get(request_id);
    if (!req) throw new Error("bu izin isteği artık geçerli değil");
    P.pending.delete(request_id);
    const response = behavior === "allow"
      ? { behavior: "allow", updatedInput: req.input, ...(always && req.suggestions.length ? { updatedPermissions: req.suggestions } : {}) }
      : { behavior: "deny", message: message || "Kullanıcı panelden reddetti." };
    P.ch.stdin.write(JSON.stringify({ type: "control_response", response: { subtype: "success", request_id, response } }) + "\n");
    append(epDir(id), { role: "permission", text: `${behavior === "allow" ? (always ? "Bu oturumda hep izin verildi" : "İzin verildi") : "Reddedildi"}: ${req.summary}` });
    return { ok: true };
  };

  const stop = (id) => {
    const P = procs.get(id);
    if (P) { P.closing = true; P.ch.kill("SIGINT"); setTimeout(() => P.ch.kill("SIGTERM"), 3000); procs.delete(id); append(epDir(id), { role: "done", text: "durduruldu" }); }
    return { ok: true };
  };

  const settings = (id, { model, effort, mode }) => {
    const dir = epDir(id);
    saveSession(dir, { model: MODELS.includes(model) ? model : null, effort: EFFORTS.includes(effort) ? effort : null, mode: MODES.includes(mode) ? mode : null });
    const P = procs.get(id); if (P && P.busy === 0) { P.closing = true; P.ch.stdin.end(); }   // yeni ayar sonraki mesajda
    return { ok: true };
  };

  const chat = (id) => {
    const dir = epDir(id); if (!dir) return null;
    const entries = fs.existsSync(chatFile(dir)) ? fs.readFileSync(chatFile(dir), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
    const P = procs.get(id), s = session(dir);
    return { other: lockedBy(dir), running: !!P && P.busy > 0, alive: !!P, session: s.sessionId ?? null, model: s.model ?? null, effort: s.effort ?? null, mode: s.mode ?? null, lastModel: s.lastModel ?? null,
      pending: P ? [...P.pending.values()].map(({ input, suggestions, ...r }) => ({ ...r, canAlways: suggestions.length > 0 })) : [], entries: entries.slice(-300) };
  };

  // konuya özel sorular: yapılandırılmış çıktı (araç yok, hızlı model)
  const questions = ({ idea, format, channel, catalogSummary }) => new Promise((ok, no) => {
    const schema = { type: "object", required: ["title", "questions"], properties: {
      title: { type: "string" },
      questions: { type: "array", minItems: 3, maxItems: 5, items: { type: "object", required: ["id", "q", "options", "recommended"], properties: {
        id: { type: "string" }, q: { type: "string" }, why: { type: "string" },
        options: { type: "array", minItems: 2, maxItems: 6, items: { type: "object", required: ["label"], properties: { label: { type: "string" }, detail: { type: "string" } } } },
        recommended: { type: "integer" } } } } } };
    const prompt = [
      `Bir YouTube videosu hazırlanıyor. Kanal: ${channel}. Biçim: ${format}.`,
      `Kullanıcının fikri: """${idea}"""`,
      "Bu fikre ÖZEL 3-5 soru yaz (Türkçe): hikâyenin açısı, açılış anı (cesur, beklenmedik), ton (dramatik mi, meraklı mı, esprili mi; fazla dramatize etme),",
      "anlatılacak mekanizmanın nasıl gösterileceği, kapanış. Görsel stil sorma (ayrı panoda seçiliyor). Her soruya 2-6 somut seçenek, önerdiğin seçeneğin indeksi `recommended`,",
      "kısa `why` (neden soruyorum). title: videoya çalışma adı.",
      catalogSummary ? `Bilgi için elimizdeki stiller: ${catalogSummary}` : "",
    ].join("\n");
    const ch = spawn("claude", ["-p", "--model", "sonnet", "--output-format", "json", "--tools", "", "--json-schema", JSON.stringify(schema)], { cwd: ROOT, stdio: ["pipe", "pipe", "pipe"] });
    let out = "", err = "";
    ch.stdout.on("data", (d) => (out += d)); ch.stderr.on("data", (d) => (err += d));
    ch.stdin.end(prompt);
    const t = setTimeout(() => ch.kill("SIGTERM"), 180000);
    ch.on("close", () => { clearTimeout(t); try { const d = JSON.parse(out); if (d.structured_output) return ok(d.structured_output); no(new Error(d.result || "boş yanıt")); } catch (e) { no(new Error((err.trim().split("\n").pop() || String(e)).slice(0, 300))); } });
  });

  // sunucu kapanırken çocuk süreçleri kapat (sahipsiz kalıp çalışmaya devam etmesinler)
  const shutdown = () => { for (const P of procs.values()) { P.closing = true; try { P.ch.stdin.end(); P.ch.kill("SIGTERM"); } catch {} } };
  return { shutdown, other: (id) => { const d = epDir(id); return d ? lockedBy(d) : null; }, send, answer, stop, settings, chat, questions, busy: (id) => (procs.get(id)?.busy ?? 0) > 0 };
};
