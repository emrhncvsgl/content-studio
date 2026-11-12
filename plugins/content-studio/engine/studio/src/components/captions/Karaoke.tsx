import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { Theme, Word } from "../../schema/timeline";
import { INTER } from "../../fonts";

// cap-karaoke: konuşulan kelime vurgu rengine döner. Kelimeler senaryodan (build_timeline hizalaması), zamanlar Whisper'dan.
// Sayfalama: en fazla MAX_CHARS karakter ya da cümle sonu. Güvenli bölge: alt %20 ve sağ kenar boş (PLAN 8.6).
// QA (EP001) düzeltmeleri: tek aktif kelime (vurgular çakışmaz), kelime büyümez (aralık sabit), satırlar dengeli (tek kelime kalmaz).
// QA (EP002) düzeltmeleri: cümle sonu kelimesi tek başına sayfa olmaz (MAX_TAIL_CHARS'a kadar mevcut sayfaya eklenir);
// çok kısa kelimeler en az MIN_ACTIVE_MS vurgulanır; açık zeminde okunurluk için ince koyu kontur.
const MAX_CHARS = 22;
const MAX_TAIL_CHARS = 28;
const MIN_ACTIVE_MS = 120;
const MAX_ACTIVE_SHIFT_MS = 120;   // en kısa vurgu yüzünden bir sonraki kelimenin vurgusu en fazla bu kadar gecikir

const isSentenceEnd = (t: string) => /[.!?]$/.test(t);

export function paginate(words: Word[]): Word[][] {
  const pages: Word[][] = [];
  let cur: Word[] = [];
  let len = 0;   // sayfadaki karakter sayısı (kelimeler + aradaki boşluklar)
  const chars = (p: Word[]) => p.reduce((n, x, i) => n + x.text.length + (i ? 1 : 0), 0);
  for (const w of words) {
    const next = len + (cur.length ? 1 : 0) + w.text.length;
    const end = isSentenceEnd(w.text);
    // cümlenin son kelimesi tek başına sayfa olmasın: MAX_TAIL_CHARS'a kadar mevcut sayfaya sığdır
    const tailFits = end && next <= MAX_TAIL_CHARS;
    if (cur.length && next + 1 > MAX_CHARS && !tailFits) {   // +1: önceki sürümle aynı sınır (21 karakter + boşluk payı)
      // sığmıyorsa önceki kelimeyi yanına al ("Follow for the | next principle.")
      const carry = end && cur.length > 1 ? cur.splice(cur.length - 1, 1) : [];
      pages.push(cur); cur = carry; len = chars(carry);
    }
    len += (cur.length ? 1 : 0) + w.text.length;
    cur.push(w);
    if (isSentenceEnd(w.text)) { pages.push(cur); cur = []; len = 0; }
  }
  if (cur.length) pages.push(cur);
  return pages;
}

// Vurgu başlangıçları: kelime başlangıcı, ama önceki kelime en az MIN_ACTIVE_MS aktif kalsın (en fazla MAX_ACTIVE_SHIFT_MS gecikme).
// QA (EP002): "Hold" (60 ms) ve "At" sonraki kelimeyle aynı anda başladığı için hiç vurgulanmıyordu.
export function activeStarts(page: Word[]): number[] {
  const out: number[] = [];
  page.forEach((w, k) => {
    const prev = k ? out[k - 1] : -Infinity;
    out.push(Math.min(Math.max(w.startMs, prev + MIN_ACTIVE_MS), w.startMs + MAX_ACTIVE_SHIFT_MS));
  });
  return out;
}

// İnce koyu kontur (8 yön, bulanıksız) + yumuşak gölge: aktif turuncu kelime açık zeminde de ≥ 4.5:1 kenar kontrastı verir
const OUTLINE = [[-3, 0], [3, 0], [0, -3], [0, 3], [-2, -2], [2, -2], [-2, 2], [2, 2]]
  .map(([x, y]) => `${x}px ${y}px 0 rgba(0,0,0,0.78)`).join(", ");

export const Karaoke: React.FC<{ words: Word[]; theme: Theme }> = ({ words, theme }) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const ms = (frame / fps) * 1000;
  const pages = paginate(words);
  // sayfa bitişinden sonra 250 ms kalır, ama bir sonraki sayfa başladıysa yeni sayfa öncelikli (EP002 still: eski sayfa ~250 ms takılı kalıyordu)
  const page = [...pages].reverse().find((p) => ms >= p[0].startMs - 80 && ms < p[p.length - 1].endMs + 250);
  if (!page) return null;
  // aktif kelime: vurgusu başlamış olan son kelime (bir sonrakinin vurgusu başladığı anda biter → iki kelime aynı anda vurgulanmaz)
  const starts = activeStarts(page);
  let active = -1;
  starts.forEach((s, k) => { if (ms >= s) active = k; });
  const enter = interpolate(ms - page[0].startMs, [-80, 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ top: height * 0.6, height: height * 0.18, justifyContent: "center", alignItems: "center", paddingLeft: 80, paddingRight: 150 }}>
      <div style={{
        fontFamily: INTER, fontWeight: 900, fontSize: 84, lineHeight: 1.1, letterSpacing: -1, textAlign: "center",
        textWrap: "balance", wordSpacing: 6, maxWidth: 850, opacity: enter, transform: `translateY(${(1 - enter) * 12}px)`,
        textShadow: `${OUTLINE}, 0 6px 24px rgba(0,0,0,0.55)`,
      }}>
        {page.map((w, k) => (
          <span key={k} style={{ color: k === active ? theme.accent : theme.text }}>
            {w.text}{k < page.length - 1 ? " " : ""}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};
