import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { fitText } from "@remotion/layout-utils";
import type { StyleProps, Word } from "../../schema/timeline";
import { INTER, MONO } from "../../fonts";

// kinetic-type (catalog/styles.yaml): kelimeler anlatıcı söyledikçe düşer; ana görsel yazıdır. lang_neutral: false.
// Metni kendisi gösterdiği için altyazı katmanı bu sahnede kapanır (registry.ownsText).
// props: kicker (üst küçük etiket), hero (tek başına dev gösterilecek son kelime, ör. "Segmentation."), badge (köşe numarası)

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

function sentences(words: Word[]): Word[][] {
  const out: Word[][] = [[]];
  words.forEach((w, i) => { out[out.length - 1].push(w); if (/[.!?]$/.test(w.text) && i < words.length - 1) out.push([]); });
  return out;
}

export const KineticType: React.FC<StyleProps> = ({ scene, words, props, theme }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (f / fps) * 1000;
  const hero = typeof props.hero === "string" ? props.hero.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "") : null;
  const isHero = (w: Word) => hero && w.text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "") === hero;
  const heroWord = words.find(isHero);
  const heroOn = heroWord && ms >= heroWord.startMs - 40;
  const sents = sentences(words.filter((w) => !isHero(w)));
  const cur = [...sents].reverse().find((s) => s.length && ms >= s[0].startMs - 60) ?? sents[0];
  const kick = interpolate(f, [0, 10], [0, 1], clamp);

  return (
    <AbsoluteFill style={{ backgroundColor: theme.background }}>
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 38%, ${theme.primary}55 0%, transparent 60%)` }} />
      {typeof props.kicker === "string" && (
        <div style={{ position: "absolute", top: 300, width: "100%", textAlign: "center", fontFamily: MONO, fontSize: 40, letterSpacing: 10, color: theme.accent, opacity: kick }}>
          {props.kicker}
        </div>
      )}
      {typeof props.badge === "string" && (
        <div style={{ position: "absolute", top: 140, right: 170, width: 150, height: 210, borderRadius: 18, border: `5px solid ${theme.accent}`, display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: INTER, fontWeight: 900, fontSize: 96, color: theme.accent, transform: `rotate(${interpolate(f, [0, 20], [-14, 6], clamp)}deg)`, opacity: kick }}>
          {props.badge}
        </div>
      )}
      {!heroOn && (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingInline: 90, paddingRight: 150, top: -120 }}>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "baseline", gap: "6px 26px" }}>
            {cur.map((w, k) => {
              const s = spring({ frame: f - Math.round((w.startMs / 1000) * fps), fps, config: { damping: 12, mass: 0.6 } });
              const emph = w.emphasis;
              return (
                <span key={k} style={{
                  fontFamily: INTER, fontWeight: 900, letterSpacing: -2, lineHeight: 1.02,
                  fontSize: emph ? 150 : 104, color: emph ? theme.accent : theme.text,
                  opacity: s, transform: `translateY(${(1 - s) * 60}px) scale(${0.8 + 0.2 * s})`, display: "inline-block",
                }}>{w.text}</span>
              );
            })}
          </div>
        </AbsoluteFill>
      )}
      {heroOn && heroWord && (() => {
        const s = spring({ frame: f - Math.round((heroWord.startMs / 1000) * fps), fps, config: { damping: 10, mass: 0.8 } });
        const label = heroWord.text.replace(/[.!?]$/, "");
        // güvenli genişlik: sol 90 + sağ 150 px boşluk → 840 px; kelime uzunluğuna göre font küçülür
        const { fontSize } = fitText({ text: label, withinWidth: 840, fontFamily: INTER, fontWeight: 900, letterSpacing: "-6px" });
        return (
          <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", top: -100, paddingLeft: 90, paddingRight: 150 }}>
            <div style={{ fontFamily: INTER, fontWeight: 900, fontSize: Math.min(200, fontSize), letterSpacing: -6, color: theme.accent, transform: `scale(${0.6 + 0.4 * s})`, opacity: s,
              textShadow: `0 0 60px ${theme.accent}55`, whiteSpace: "nowrap" }}>{label}</div>
            <div style={{ marginTop: 30, height: 10, width: 520 * s, background: theme.text, borderRadius: 5 }} />
          </AbsoluteFill>
        );
      })()}
    </AbsoluteFill>
  );
};
