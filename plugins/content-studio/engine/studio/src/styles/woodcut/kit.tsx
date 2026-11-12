// Ağaç baskı ortak kiti (EP009 woodcut sahneleri: hücre, sorgu, dönüş, baraka). WoodcutMatch'in shader'larının kopyası + yeni nesne bantları:
// id 0.2 masa/zemin (ışıktan halkalar) · 0.45 duvar (dikey kesik) · 0.6 kâğıt · 0.75 figür (siyah siluet + kenar ışığı + beyaz bıçak halesi) ·
// 0.9 kibrit/nesne · 1.0 alev/ampul (tek renk plakası). WoodcutMatch dokunulmadan kalır (kullanıcı onaylı görünüm).
import { useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

export const clamp = (x: number) => Math.min(1, Math.max(0, x));
export const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// ---------- sahne malzemesi: yalnızca ışık bilgisi yazar ----------
export const litVert = /* glsl */ `
varying vec3 vW; varying vec3 vN; varying vec2 vUv;
void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * w; }`;
export const litFrag = /* glsl */ `
uniform vec3 uLight; uniform float uI; uniform float uAlbedo; uniform float uGrain; uniform vec2 uPupilA; uniform vec2 uPupilB;
uniform float uPupils; uniform float uId; varying vec3 vW; varying vec3 vN; varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
void main(){
  vec3 L = uLight - vW; float d = length(L); vec3 l = L / d;
  float lam = max(dot(normalize(vN), l), 0.0);
  float lit = uI * lam / (1.0 + 3.0 * d * d);
  float alb = uAlbedo;
  if (uGrain > 0.0) { alb *= 0.78 + 0.22 * n2(vec2(vW.x * 1.6, vW.z * 26.0)) + 0.1 * n2(vec2(vW.x * 0.4, vW.z * 3.0)); }
  float ink = 0.0;
  if (uPupils > 0.0) {   // göz bebekleri: kibritle çizilmiş, düzensiz kenarlı siyah daireler (ilerleme = yarıçap)
    vec2 p = vUv - vec2(0.5);
    float rA = 0.17 * uPupilA.x * (0.9 + 0.2 * n2(p * 18.0)); float rB = 0.17 * uPupilB.x * (0.9 + 0.2 * n2(p * 18.0 + 7.0));
    vec2 cA = vec2(-0.02, 0.01); vec2 cB = vec2(0.03, -0.02);
    if (uPupilA.y > 0.5 && length(p - cA) < rA) ink = 1.0;
    if (uPupilB.y > 0.5 && length(p - cB) < rB) ink = 1.0;
  }
  gl_FragColor = vec4(clamp(lit * alb, 0.0, 1.0), 0.0, ink, uId);
}`;
export const flameFrag = /* glsl */ `
uniform float uFlame; uniform float uT; uniform float uFlare; varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ return 0.5*n2(p) + 0.3*n2(p*2.03+1.7) + 0.2*n2(p*4.1+5.3); }
void main(){
  // alev: damla biçimi (taban yuvarlak, uç sivri), kafadan küçük bir boşlukla başlar; uç türbülansla yalpalar (dil atar);
  // gerçek alev ~8-12 Hz titrer, parlamada (uFlare) büyür ve genişler
  vec2 p = vUv - vec2(0.5, 0.16);
  float tall = 0.66 * (0.9 + 0.1 * sin(uT * 2.0 * 3.14159 * 9.0)) * (1.0 + 0.5 * uFlare);
  float y01 = p.y / tall;
  float turb = fbm(vec2(p.x * 5.0, p.y * 3.5 - uT * 8.0)) - 0.5;
  p.x -= (turb * 0.18 + 0.035 * sin(uT * 7.0 + 1.3)) * y01 * y01 * (1.0 + uFlare);   // uca doğru artan yalpalama
  float maxW = 0.2 * (1.0 + 1.2 * uFlare);
  float w = maxW * pow(clamp(y01 * 3.0, 0.0, 1.0), 0.5) * pow(clamp(1.0 - y01, 0.0, 1.0), 1.15);
  float shape = (y01 > 0.0 && y01 < 1.0) ? 1.0 - smoothstep(w * 0.55, w, abs(p.x)) : 0.0;
  shape *= 1.0 - smoothstep(0.7, 1.0, y01 + turb * 0.25);                         // uç kopup söner
  float core = 1.0 - smoothstep(0.0, w * 0.8 + 1e-4, abs(p.x)) * 0.6 - y01 * 0.35;
  float heat = clamp(shape * uFlame * core * (0.8 + 0.4 * fbm(vec2(p.x * 9.0, p.y * 6.0 - uT * 10.0))), 0.0, 1.0);
  if (heat < 0.06) discard;
  gl_FragColor = vec4(1.0, heat, 0.0, 1.0);
}`;
export const flameVert = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;

// ---------- baskı geçişi ----------
export const printFrag = /* glsl */ `
uniform sampler2D tScene; uniform vec2 uRes; uniform float uSeed; uniform vec3 uInk; uniform vec3 uPaper; uniform vec3 uPlate;
uniform float uMargin; uniform float uDebug; uniform vec2 uLightPx; uniform float uReveal; uniform float uHalo; uniform float uRing; uniform vec2 uRingC; varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ return 0.55*n2(p) + 0.3*n2(p*2.1+3.1) + 0.15*n2(p*4.3+7.7); }
void main(){
  vec2 px = vUv * uRes;
  // kâğıt payı: görüntü kalıbın kenarında biter, kenar düzensiz (yırtık mürekkep), alt pay geniş
  vec2 m = vec2(uMargin * uRes.y / uRes.x, uMargin);
  float edgeN = (fbm(px * 0.035 + uSeed) - 0.5) * 0.012;
  bool inPlate = vUv.x > m.x + edgeN && vUv.x < 1.0 - m.x - edgeN && vUv.y > m.y * 1.25 + edgeN && vUv.y < 1.0 - m.y - edgeN;
  float paperTex = 0.94 + 0.06 * fbm(px * 0.8) - 0.03 * step(0.5, fract(px.y * 0.09)) * 0.4;   // dökme kâğıt çizgileri
  vec3 paper = uPaper * paperTex;
  if (!inPlate) { gl_FragColor = vec4(paper, 1.0); return; }
  // kalıp içi koordinat (pay dışarıda)
  vec2 uv = (vUv - vec2(m.x, m.y * 1.25)) / (vec2(1.0) - vec2(2.0 * m.x, m.y * 2.25));
  vec4 s = texture2D(tScene, uv);
  if (uDebug > 0.5) { gl_FragColor = vec4(s.r, s.g, s.b, 1.0); return; }
  float Lr = s.r; float flame = s.g; float ink = s.b; float id = s.a;
  float T = pow(Lr, 0.55);
  vec2 kp = uv * uRes;                                              // kalıp içi piksel
  // oyuk yönü nesneye göre (biçimi takip eder): masa = alevden yayılan eşit aralıklı halkalar · kâğıt/kibrit = yatay paralel kesik
  // figür (id ≈ 0.75): siyah siluet; yalnız aydınlık kenarda ince yalayan kesikler. Figürün çevresinde beyaz bıçak halesi (komşu figür, kendisi değil)
  bool isFig = id > 0.7 && id < 0.8;
  float halo = 0.0;
  if (!isFig) {
    for (int k = 0; k < 8; k++) {
      float an = float(k) * 0.7854; vec2 o = vec2(cos(an), sin(an)) * uHalo / uRes;
      float nid = texture2D(tScene, uv + o).a;
      if (nid > 0.7 && nid < 0.8) halo = 1.0;
    }
  }
  float coord; float spacing;
  if (id < 0.4) { coord = length(kp - uLightPx); spacing = 15.0; }
  else if (id > 0.4 && id < 0.5) { coord = kp.x + 0.04 * kp.y; spacing = 11.0; }   // duvar: dikey kesikler
  else if (isFig) { coord = kp.y - 0.35 * kp.x; spacing = 5.0; }                  // figür: sık, eğik, yalnız ışıkta
  else { coord = kp.y + 0.05 * kp.x; spacing = 8.0; }
  float wob = (fbm(kp * 0.004 + uSeed) - 0.5) * 0.9 + (n2(kp * 0.03) - 0.5) * 0.18;
  float stripe = abs(fract(coord / spacing + wob) - 0.5) * 2.0;    // 0 = oyuk ekseni
  float width = smoothstep(0.06, 0.92, T);                          // parlak = geniş oyuk
  float cut = 1.0 - smoothstep(width - 0.1, width + 0.1, stripe);
  // el oyması: her oyuk 30-160 px'lik ayrı kesiklerden oluşur; araları kesik, uçları künt
  float along = (id < 0.4) ? atan(kp.y - uLightPx.y, kp.x - uLightPx.x) * coord / 60.0 : kp.x / 90.0;
  float seg = n2(vec2(along, floor(coord / spacing + wob) * 1.7));
  cut *= smoothstep(0.18, 0.32, seg + 0.25 * T);
  cut = max(cut, smoothstep(0.8, 0.9, T));                          // en parlak = tamamen oyulmuş
  cut *= step(0.05, T);                                             // karanlık = oyulmamış ahşap
  if (isFig) cut *= smoothstep(0.5, 0.78, T);                       // figür: karanlık kalır, ışık yalnız kenarı yalar
  cut *= 1.0 - ink;                                                 // göz bebekleri mürekkep
  cut = max(cut, halo * step(0.02, uReveal) * 0.92);                // bıçak halesi
  // oyma açılışı (radial): ışık alevden dışarı yayıldıkça oyuklar sırayla açılır; kenar düzensiz
  float rr = length(kp - uLightPx) + (fbm(kp * 0.01) - 0.5) * 80.0;
  cut *= 1.0 - smoothstep(uReveal - 60.0, uReveal, rr);
  // mürekkep düzensizliği, mürekkebin tutmadığı benekler, ahşap lifi
  float inkUneven = 0.9 + 0.1 * fbm(px * 0.05 + 11.0) - 0.06 * smoothstep(0.75, 0.95, n2(vec2(px.x * 0.004, px.y * 0.25)));
  vec3 inkC = uInk * inkUneven + vec3(0.05) * step(0.985, h(floor(px * 0.5) + uSeed));
  vec3 col = mix(inkC, paper, cut);
  // tek renk plakası: yalnızca oyulmuş beyazın içine, küçük sabit kayıklıkla (misregistration)
  vec4 s2 = texture2D(tScene, uv + vec2(1.5, -1.0) / uRes);
  float heat = s2.g;
  vec3 plateC = mix(uPlate * 0.8, vec3(0.97, 0.72, 0.28), smoothstep(0.25, 0.7, heat));
  plateC = mix(plateC, uPaper * 1.02, smoothstep(0.78, 0.95, heat));          // en sıcak çekirdek: kâğıt beyazı (oyulmuş, renksiz)
  float plate = smoothstep(0.04, 0.2, heat) + 0.25 * smoothstep(0.6, 1.0, s2.r) * smoothstep(0.0, 0.3, heat);
  col = mix(col, plateC * (0.9 + 0.1 * fbm(px * 0.03)), clamp(plate, 0.0, 1.0) * max(cut, step(0.04, heat)));
  if (uRing > 0.0) {   // gözetleme deliği: halkanın dışı oyulmamış kalıp; kenarda ışınsal oyuklu pirinç bilezik
    float rd = length(kp - uRingC) + (fbm(kp * 0.02) - 0.5) * 6.0;
    float rim = 22.0;
    if (rd > uRing + rim) col = inkC;
    else if (rd > uRing) {
      float ang = atan(kp.y - uRingC.y, kp.x - uRingC.x);
      float rays = step(0.45, fract(ang * 34.0 / 6.2832 + 0.15 * n2(kp * 0.1)));
      float band = step(0.3, (rd - uRing) / rim) * step((rd - uRing) / rim, 0.85);
      col = mix(inkC, paper, rays * band);
    }
  }
  gl_FragColor = vec4(col, 1.0);
}`;
export const quadVert = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export function tornPaper(w: number, h: number, seed: number) {
  const shape = new THREE.Shape(); const pts: [number, number][] = []; const n = 28;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2; const r = 1 + (hash(seed + i) - 0.5) * 0.16;
    pts.push([Math.cos(a) * w * 0.5 * r * (Math.abs(Math.cos(a)) > 0.7 ? 1 : 1.06), Math.sin(a) * h * 0.5 * r]);
  }
  // köşeli yırtık: daireyi dikdörtgene yaklaştır
  const sq = pts.map(([x, y]) => [Math.sign(x) * Math.min(Math.abs(x) * 1.25, w * 0.5 * (0.94 + hash(seed + x) * 0.08)),
    Math.sign(y) * Math.min(Math.abs(y) * 1.25, h * 0.5 * (0.92 + hash(seed + y) * 0.1))] as [number, number]);
  shape.moveTo(sq[0][0], sq[0][1]); sq.slice(1).forEach(([x, y]) => shape.lineTo(x, y)); shape.closePath();
  const g = new THREE.ShapeGeometry(shape, 1);
  const pos = g.attributes.position; const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
  return g;
}


// ---------- ampul: yanınca tek renk plakası (G = ısı), cam çekirdeği kâğıt beyazı ----------
export const bulbVert = /* glsl */ `varying vec3 vN; varying vec3 vV; void main(){ vec4 w = modelMatrix * vec4(position,1.0);
  vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`;
export const bulbFrag = /* glsl */ `uniform float uOn; varying vec3 vN; varying vec3 vV;
void main(){ float f = max(dot(normalize(vN), normalize(vV)), 0.0);
  float heat = uOn * (0.45 + 0.55 * f);
  if (heat < 0.04) { gl_FragColor = vec4(0.0, 0.0, 0.0, 0.9); return; }   // sönük ampul: siyah nesne
  gl_FragColor = vec4(1.0, heat, 0.0, 1.0); }`;

export type Word = { text: string; startMs: number; endMs: number };
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9']/g, "");
/** Bir sözcüğün (ya da sözcük öbeğinin ilk sözcüğünün) başlangıç karesi; bulunamazsa fallback saniye. */
export const wordFrame = (words: Word[] | undefined, phrase: string, fps: number, fallbackS: number, edge: "start" | "end" = "start") => {
  const toks = phrase.split(/\s+/).map(norm);
  const ws = words ?? [];
  for (let i = 0; i + toks.length <= ws.length; i++) {
    if (toks.every((t, k) => norm(ws[i + k].text) === t)) {
      const w = edge === "start" ? ws[i] : ws[i + toks.length - 1];
      return Math.round(((edge === "start" ? w.startMs : w.endMs) / 1000) * fps);
    }
  }
  return Math.round(fallbackS * fps);
};
/** Karakterler ikişer karede (12 fps, woodcut grameri): kare sayısını 2'ye yuvarla. */
export const onTwos = (frame: number) => frame - (frame % 2);
export const inertia = (k: number) => 0.35 * k + 0.65 * (k * k * (3 - 2 * k));

export type Lit = THREE.ShaderMaterial;
export const litMat = (albedo: number, grain: number, id: number, pupils = 0) => new THREE.ShaderMaterial({
  vertexShader: litVert, fragmentShader: litFrag, side: THREE.DoubleSide,
  uniforms: { uLight: { value: new THREE.Vector3() }, uI: { value: 0 }, uAlbedo: { value: albedo }, uGrain: { value: grain },
    uPupilA: { value: new THREE.Vector2() }, uPupilB: { value: new THREE.Vector2() }, uPupils: { value: pupils }, uId: { value: id } } });

/** İki geçişli baskı: sahne → render hedefi (kanallar) → tam ekran baskı shader'ı. Her karede çağır; lightWorld = oyma halkalarının merkezi. */
export const usePrint = (width: number, height: number, opts: { plate?: string; seed?: number; halo?: number } = {}) => {
  const { gl, scene, camera } = useThree();
  const rt = useMemo(() => new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType, samples: 4 }), [width, height]);
  const quad = useMemo(() => {
    const m = new THREE.ShaderMaterial({ vertexShader: quadVert, fragmentShader: printFrag, depthTest: false,
      uniforms: { tScene: { value: rt.texture }, uRes: { value: new THREE.Vector2(width, height) }, uSeed: { value: opts.seed ?? 3.0 },
        uInk: { value: new THREE.Color("#100d0a") }, uPaper: { value: new THREE.Color("#e8dcc1") }, uPlate: { value: new THREE.Color(opts.plate ?? "#d9692a") },
        uMargin: { value: 0.045 }, uLightPx: { value: new THREE.Vector2() }, uReveal: { value: 0 }, uHalo: { value: opts.halo ?? 4.0 },
        uRing: { value: 0 }, uRingC: { value: new THREE.Vector2() },
        uDebug: { value: Number(process.env.REMOTION_WOOD_DEBUG ?? 0) } } });
    const s = new THREE.Scene(); s.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m));
    return { scene: s, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), mat: m };
  }, [rt, width, height, opts.plate, opts.seed, opts.halo]);
  useFrame(() => {
    gl.setRenderTarget(rt); gl.setClearColor(0x000000, 1); gl.clear(); gl.render(scene, camera);
    gl.setRenderTarget(null); gl.render(quad.scene, quad.cam);
  }, 1);
  /** her karede: ışığın dünya konumu (halka merkezi) ve oyma açılışı yarıçapı (piksel) */
  const update = (lightWorld: THREE.Vector3, revealPx: number, ring?: { radiusPx: number; cx?: number; cy?: number }) => {
    camera.updateMatrixWorld();   // kamera bu karede taşındı: project() eski matrisle yanlış merkeze düşüyordu (s25 kamera kayması)
    const lp = lightWorld.clone().project(camera);
    // baskı shader'ında kp = kalıp içi uv × uRes (tam genişlik): merkezler de aynı birimde (2026-11-09: plateW ile ~%9 kayıyordu)
    quad.mat.uniforms.uLightPx.value.set((lp.x * 0.5 + 0.5) * width, (lp.y * 0.5 + 0.5) * height);
    quad.mat.uniforms.uReveal.value = revealPx;
    quad.mat.uniforms.uRing.value = ring ? Math.max(0.001, ring.radiusPx) : 0;
    quad.mat.uniforms.uRingC.value.set((ring?.cx ?? 0.5) * width, (ring?.cy ?? 0.5) * height);
  };
  return { update, camera: camera as THREE.PerspectiveCamera, plate: { w: width * (1 - 2 * 0.045 * height / width), h: height * (1 - 0.045 * 2.25) } };
};

/** Oturan insan silueti (yüzsüz, paltolu, omuzlar düşük). lean: öne eğilme (rad), turn: baş/omuz dönüşü (rad), armReach 0..1: sağ el öne uzanır. */
const Arm: React.FC<{ mat: THREE.Material; side: 1 | -1; reach: number }> = ({ mat, side, reach }) => {
  // üst kol omuzdan aşağı-öne, ön kol dizlere doğru; reach ile ön kol yukarı-öne açılır (hücre arkadaşının eli)
  const up = 0.35 + 0.5 * reach, fore = 1.25 - 0.75 * reach;
  return (
    <group position={[0.17 * side, 0.42, 0.0]} rotation={[-up, 0, 0.12 * side]}>
      <mesh material={mat} position={[0, -0.12, 0]}><capsuleGeometry args={[0.042, 0.2, 6, 10]} /></mesh>
      <group position={[0, -0.24, 0]} rotation={[-fore, 0, 0]}>
        <mesh material={mat} position={[0, -0.11, 0]}><capsuleGeometry args={[0.036, 0.18, 6, 10]} /></mesh>
        <mesh material={mat} position={[0, -0.23, 0.0]} scale={[0.8, 1.1, 0.6]}><sphereGeometry args={[0.04, 10, 8]} /></mesh>
      </group>
    </group>
  );
};
export const SeatedFigure: React.FC<{ mat: THREE.Material; position: [number, number, number]; rotY?: number; lean?: number; turn?: number;
  scale?: number; armReach?: number }> = ({ mat, position, rotY = 0, lean = 0, turn = 0, scale = 1, armReach = 0 }) => (
  <group position={position} rotation={[0, rotY, 0]} scale={scale}>
    {/* uyluklar (oturakta, öne) ve baldırlar (aşağı), iki bacak */}
    {[-1, 1].map((sd) => (
      <group key={sd}>
        <mesh material={mat} position={[0.075 * sd, 0.0, 0.12]} rotation={[Math.PI / 2, 0, 0]}><capsuleGeometry args={[0.058, 0.2, 6, 12]} /></mesh>
        <mesh material={mat} position={[0.075 * sd, -0.22, 0.25]}><capsuleGeometry args={[0.048, 0.3, 6, 12]} /></mesh>
      </group>
    ))}
    <group rotation={[lean, 0, 0]}>
      <group rotation={[0, turn, 0]}>
        {/* palto gövdesi: omuzda geniş, belde dar; düşük omuz çizgisi; kısa boyun; baş biraz öne */}
        <mesh material={mat} position={[0, 0.24, 0]}><cylinderGeometry args={[0.165, 0.13, 0.4, 20]} /></mesh>
        <mesh material={mat} position={[0, 0.43, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 0.75]}><capsuleGeometry args={[0.07, 0.24, 6, 14]} /></mesh>
        <mesh material={mat} position={[0, 0.5, 0.02]}><cylinderGeometry args={[0.045, 0.055, 0.08, 12]} /></mesh>
        <mesh material={mat} position={[0, 0.59, 0.04]} scale={[0.86, 1.08, 0.95]}><sphereGeometry args={[0.082, 24, 18]} /></mesh>
        <Arm mat={mat} side={1} reach={armReach} />
        <Arm mat={mat} side={-1} reach={0} />
      </group>
    </group>
  </group>
);

/** Ayakta duran paltolu silueti (yüzsüz). cap: kasket (üniformalı), coat: palto etek boyu. */
export const StandingFigure: React.FC<{ mat: THREE.Material; position: [number, number, number]; rotY?: number; scale?: number; cap?: boolean }> =
  ({ mat, position, rotY = 0, scale = 1, cap = false }) => (
  <group position={position} rotation={[0, rotY, 0]} scale={scale}>
    {[-1, 1].map((sd) => <mesh key={sd} material={mat} position={[0.07 * sd, 0.32, 0]}><capsuleGeometry args={[0.05, 0.5, 6, 12]} /></mesh>)}
    <mesh material={mat} position={[0, 0.78, 0]}><cylinderGeometry args={[0.17, 0.2, 0.62, 20]} /></mesh>
    <mesh material={mat} position={[0, 1.1, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 0.75]}><capsuleGeometry args={[0.075, 0.25, 6, 14]} /></mesh>
    {[-1, 1].map((sd) => <mesh key={sd} material={mat} position={[0.2 * sd, 0.86, 0]} rotation={[0, 0, 0.06 * sd]}><capsuleGeometry args={[0.042, 0.42, 6, 10]} /></mesh>)}
    <mesh material={mat} position={[0, 1.18, 0]}><cylinderGeometry args={[0.045, 0.055, 0.08, 12]} /></mesh>
    <mesh material={mat} position={[0, 1.27, 0.01]} scale={[0.86, 1.08, 0.95]}><sphereGeometry args={[0.082, 24, 18]} /></mesh>
    {cap ? (<>
      <mesh material={mat} position={[0, 1.34, 0.0]}><cylinderGeometry args={[0.1, 0.09, 0.06, 20]} /></mesh>
      <mesh material={mat} position={[0, 1.315, 0.07]} rotation={[0.25, 0, 0]}><boxGeometry args={[0.13, 0.01, 0.07]} /></mesh>
    </>) : null}
  </group>
);

/** Oyulmuş çizgi (tebeşir, levhadaki çizim, ok): her zaman tam oyuk beyaz (id 0.6, R = 1). */
export const carveMat = () => new THREE.ShaderMaterial({ vertexShader: flameVert, side: THREE.DoubleSide,
  fragmentShader: "void main(){ gl_FragColor = vec4(1.0, 0.0, 0.0, 0.6); }" });
/** Noktalardan tüp çizgi; progress 0..1 çizginin ne kadarı oyulmuş (baştan sona). */
export const Stroke: React.FC<{ points: [number, number, number][]; progress: number; radius?: number; mat: THREE.Material }> =
  ({ points, progress, radius = 0.006, mat }) => {
  const geo = useMemo(() => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), Math.max(16, points.length * 8), radius, 6, false),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(points), radius]);
  const total = geo.index ? geo.index.count : 0;
  geo.setDrawRange(0, Math.floor(clamp(progress) * total / 36) * 36);
  return progress > 0.001 ? <mesh geometry={geo} material={mat} /> : null;
};
