import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { FELL_SC } from "../fonts";

// Bölüm başlığı (uzun video, sound-design §7): kart geçişi DEĞİL; bölümün sessiz payında (sahne `lead`) yeni bölümün ilk görüntüsü üstünde.
// Akış (kullanıcı 2026-11-09, "Netflix dizisi / Veritasium belgeseli gibi, eğrilerle"): siyah → görüntü S-eğrisiyle karanlıktan açılır →
// nesneler gelir (build_timeline lead.layerShiftMs) → başlık ortada mürekkep gibi oturur → söner → anlatıcı başlar.
// props.chapter = { kicker?, title, atMs (başlık), holdMs, center?: true, fromBlackMs?: siyahın sürdüğü ms, revealMs?: açılma süresi }
export type Chapter = { kicker?: string; title: string; atMs?: number; holdMs?: number; center?: boolean; fromBlackMs?: number; revealMs?: number };

const torn = (seed: number) => {   // kâğıt şeridi kenarı: tohumlu düzensiz çokgen (clip-path)
  const pts: string[] = []; const n = 18;
  const r = (i: number) => { const x = Math.sin((i + seed) * 91.7) * 43758.5; return x - Math.floor(x); };
  for (let i = 0; i <= n; i++) pts.push(`${(i / n) * 100}% ${2 + r(i) * 9}%`);
  for (let i = n; i >= 0; i--) pts.push(`${(i / n) * 100}% ${89 + r(i + 40) * 9}%`);
  return `polygon(${pts.join(",")})`;
};
const S = Easing.bezier(0.45, 0, 0.25, 1);   // yumuşak S-eğrisi (giriş ve çıkış)

export const ChapterTitle: React.FC<{ chapter: Chapter }> = ({ chapter }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const ms = (x: number) => Math.round((x / 1000) * fps);
  const at = ms(chapter.atMs ?? 300), hold = ms(chapter.holdMs ?? 2800);
  const black = ms(chapter.fromBlackMs ?? 0), reveal = ms(chapter.revealMs ?? 1200);
  const s = width / 1920;
  // karanlıktan açılış örtüsü: YALNIZ fromBlackMs verilince (EP010 s02, 2026-11-10: varsayılan reveal yüzünden fromBlack'siz başlık da
  // siyahtan açılıyordu; disk geçişi makaraya oturduktan sonra ekran kararıp yeniden aydınlanıyordu)
  const cover = chapter.fromBlackMs ? interpolate(frame, [black, black + reveal], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: S }) : 0;
  const f = frame - at;
  const inK = S(Math.min(1, Math.max(0, f / 18)));
  const outK = interpolate(f, [hold, hold + 24], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: S });
  const show = f >= 0 && f <= hold + 24;
  const blur = (1 - inK) * 8 * s;
  const strip = (
    <div style={{ background: "#e8dcc1", clipPath: torn(7), padding: `${(chapter.center ? 30 : 22) * s}px ${(chapter.center ? 70 : 44) * s}px ${(chapter.center ? 26 : 20) * s}px`,
      filter: `drop-shadow(0 ${4 * s}px ${10 * s}px rgba(0,0,0,0.45))`, textAlign: chapter.center ? "center" : "left" }}>
      {chapter.kicker ? <div style={{ fontFamily: FELL_SC, fontSize: (chapter.center ? 36 : 30) * s, letterSpacing: 7 * s, color: "#5a2e14", filter: `blur(${blur}px)` }}>{chapter.kicker}</div> : null}
      <div style={{ fontFamily: FELL_SC, fontSize: (chapter.center ? 110 : 78) * s, lineHeight: 1.0, color: "#14100b", letterSpacing: 2 * s, filter: `blur(${blur}px)`,
        textShadow: `${1.5 * s}px ${-1 * s}px 0 rgba(217,105,42,0.55)` }}>{chapter.title}</div>
    </div>
  );
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {cover > 0 ? <AbsoluteFill style={{ backgroundColor: "#000", opacity: cover }} /> : null}
      {show ? (chapter.center ? (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: inK * outK,
          transform: `translateY(${(1 - inK) * 10 * s}px) scale(${1 + 0.015 * (1 - outK)})` }}>{strip}</AbsoluteFill>
      ) : (
        <div style={{ position: "absolute", left: 120 * s, top: height * 0.1, opacity: inK * outK, transform: `translateY(${(1 - inK) * 8 * s}px)` }}>{strip}</div>
      )) : null}
    </AbsoluteFill>
  );
};
