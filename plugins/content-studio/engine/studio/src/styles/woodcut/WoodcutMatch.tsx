// Ağaç baskı (woodcut) deneme sahnesi, three.js (EP009 s01, 2026-11-08).
// Gramer: Lemo-Opuscar styles/woodcut (MIT) + cinecode references/finish, camera-moves, motion (MIT); bizim uygulamamız.
// İki geçiş: (1) sahne ışık geçişi: R = ışıklı parlaklık, G = alev, B = mürekkep zorlaması (göz bebekleri) ·
// (2) baskı geçişi: R'nin eş-parlaklık çizgileri boyunca oyuklar (biçimi takip eder), genişlik parlaklıkla büyür;
//     tek renk (yanık bakır) yalnızca oyulmuş beyazın içine basılır; kâğıt payı, mürekkep düzensizliği, kâğıt dokusu.
import { useMemo } from "react";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const clamp = (x: number) => Math.min(1, Math.max(0, x));
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// ---------- sahne malzemesi: yalnızca ışık bilgisi yazar ----------
const litVert = /* glsl */ `
varying vec3 vW; varying vec3 vN; varying vec2 vUv;
void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * w; }`;
const litFrag = /* glsl */ `
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
const flameFrag = /* glsl */ `
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
const flameVert = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;

// ---------- baskı geçişi ----------
const printFrag = /* glsl */ `
uniform sampler2D tScene; uniform vec2 uRes; uniform float uSeed; uniform vec3 uInk; uniform vec3 uPaper; uniform vec3 uPlate;
uniform float uMargin; uniform float uDebug; uniform vec2 uLightPx; uniform float uReveal; varying vec2 vUv;
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
  float coord; float spacing;
  if (id < 0.4) { coord = length(kp - uLightPx); spacing = 15.0; }
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
  cut *= 1.0 - ink;                                                 // göz bebekleri mürekkep
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
  gl_FragColor = vec4(col, 1.0);
}`;
const quadVert = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

function tornPaper(w: number, h: number, seed: number) {
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

const Scene: React.FC<{ frame: number; fps: number; width: number; height: number }> = ({ frame, fps, width, height }) => {
  const { gl, scene, camera } = useThree();
  const t = frame / fps;
  // zaman çizelgesi (kare, 30 fps, 10 sn): 0-29 karanlık · 30 çakma: kıvılcımlar, kükürt parlaması (30-44) · alev oturur (~60) ·
  // ışık/oyma açılışı alevden dışarı ~3 sn (32-125) · göz bebeği A 150-195, B 215-260 · 260-300 bekleyiş
  const strike = 30;
  const since = frame - strike;
  const flare = since >= 0 ? Math.exp(-since / 6) * clamp(since / 2) : 0;        // kükürtün ilk büyük parlaması
  const grow = clamp((since - 3) / 30);
  const flick = 1 + 0.06 * Math.sin(t * 2 * Math.PI * 9.3) + 0.04 * Math.sin(t * 2 * Math.PI * 13.7 + 1.3) + 0.04 * (hash(Math.floor(frame / 2)) - 0.5);
  const lightI = since < 0 ? 0 : (0.6 * flare + 1.6 * Easing.out(Easing.cubic)(grow)) * flick;
  const reveal = since < 0 ? 0 : 40 + 2000 * Easing.inOut(Easing.cubic)(clamp((since - 2) / 95));   // piksel yarıçap
  const pupilA = Easing.inOut(Easing.quad)(clamp((frame - 150) / 45)), pupilB = Easing.inOut(Easing.quad)(clamp((frame - 215) / 45));
  const flamePos = useMemo(() => new THREE.Vector3(0.3, 0.3, 0.02), []);
  const rt = useMemo(() => new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType, samples: 4 }), [width, height]);
  const mats = useMemo(() => {
    const mk = (albedo: number, grain: number, pupils = 0, id = 0.2) => new THREE.ShaderMaterial({
      vertexShader: litVert, fragmentShader: litFrag, side: THREE.DoubleSide,
      uniforms: { uLight: { value: new THREE.Vector3() }, uI: { value: 0 }, uAlbedo: { value: albedo }, uGrain: { value: grain },
        uPupilA: { value: new THREE.Vector2() }, uPupilB: { value: new THREE.Vector2() }, uPupils: { value: pupils }, uId: { value: id } } });
    return { table: mk(0.4, 1), paperA: mk(1.0, 0, 1, 0.6), paperB: mk(1.0, 0, 1, 0.6), stick: mk(0.8, 0, 0, 0.9), head: mk(0.25, 0, 0, 0.9) };
  }, []);
  const flameMat = useMemo(() => new THREE.ShaderMaterial({ vertexShader: flameVert, fragmentShader: flameFrag, transparent: false,
    uniforms: { uFlame: { value: 0 }, uT: { value: 0 }, uFlare: { value: 0 } } }), []);
  const sparkMat = useMemo(() => new THREE.ShaderMaterial({ vertexShader: flameVert,
    fragmentShader: "void main(){ gl_FragColor = vec4(1.0, 0.85, 0.0, 1.0); }" }), []);
  const quad = useMemo(() => {
    const m = new THREE.ShaderMaterial({ vertexShader: quadVert, fragmentShader: printFrag, depthTest: false,
      uniforms: { tScene: { value: rt.texture }, uRes: { value: new THREE.Vector2(width, height) }, uSeed: { value: 3.0 },
        uInk: { value: new THREE.Color("#100d0a") }, uPaper: { value: new THREE.Color("#e8dcc1") }, uPlate: { value: new THREE.Color("#d9692a") },
        uMargin: { value: 0.045 }, uLightPx: { value: new THREE.Vector2() }, uReveal: { value: 0 }, uDebug: { value: Number(process.env.REMOTION_WOOD_DEBUG ?? 0) } } });
    const s = new THREE.Scene(); s.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m));
    return { scene: s, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), mat: m };
  }, [rt, width, height]);
  const paperA = useMemo(() => tornPaper(0.34, 0.26, 11), []);
  const paperB = useMemo(() => tornPaper(0.32, 0.25, 29), []);

  Object.values(mats).forEach((m) => { m.uniforms.uLight.value.copy(flamePos); m.uniforms.uI.value = lightI; });
  mats.paperA.uniforms.uPupilA.value.set(pupilA, 1); mats.paperA.uniforms.uPupilB.value.set(0, 0);
  mats.paperB.uniforms.uPupilA.value.set(0, 0); mats.paperB.uniforms.uPupilB.value.set(pupilB, 1);
  flameMat.uniforms.uFlame.value = since < 0 ? 0 : Math.min(1.15, 0.4 + 0.9 * grow + 0.6 * flare) * flick; flameMat.uniforms.uT.value = t;
  flameMat.uniforms.uFlare.value = flare; quad.mat.uniforms.uReveal.value = reveal;

  // kamera satırı: "slow macro push, 7 s, inertia, toward the paper eyes" + çok hafif el kamerası (tohumlu, düşük frekans)
  const k = interpolate(frame, [0, 300], [0, 1], { extrapolateRight: "clamp" });
  const inertia = 0.35 * k + 0.65 * (k * k * (3 - 2 * k));
  const cam = camera as THREE.PerspectiveCamera;
  cam.position.set(0.06 + 0.01 * Math.sin(t * 0.7), 1.32 - 0.2 * inertia + 0.006 * Math.sin(t * 1.1 + 2), 1.5 - 0.3 * inertia);
  cam.lookAt(0.02, 0.0, 0.08); cam.fov = 34; cam.updateProjectionMatrix();

  const lp = flamePos.clone().project(cam);
  const plateW = width * (1 - 2 * 0.045 * height / width), plateH = height * (1 - 0.045 * 2.25);
  quad.mat.uniforms.uLightPx.value.set((lp.x * 0.5 + 0.5) * plateW, (lp.y * 0.5 + 0.5) * plateH);
  useFrame(() => {
    gl.setRenderTarget(rt); gl.setClearColor(0x000000, 1); gl.clear(); gl.render(scene, camera);
    gl.setRenderTarget(null); gl.render(quad.scene, quad.cam);
  }, 1);

  const stickDir = new THREE.Vector3(-0.32, 0.55, -0.2).normalize();
  const headPos = flamePos.clone().add(new THREE.Vector3(0, -0.07, 0));
  const stickCenter = headPos.clone().add(stickDir.clone().multiplyScalar(-0.2));
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), stickDir);
  const sparks = Array.from({ length: 22 }, (_, i) => {
    const life = 8 + hash(i * 7.1) * 12; const a = since - hash(i * 3.3) * 3;
    if (a < 0 || a > life) return null;
    const ang = hash(i * 1.7) * Math.PI * 2, sp = 0.6 + hash(i * 9.2) * 1.0, tt = a / 30;
    const pos = headPos.clone().add(new THREE.Vector3(Math.cos(ang) * sp * tt, 0.25 * sp * tt - 1.4 * tt * tt + 0.02, Math.sin(ang) * sp * tt * 0.6));
    return { pos, s: 0.0045 * (1 - a / life) + 0.0015 };
  }).filter(Boolean) as { pos: THREE.Vector3; s: number }[];
  return (
    <>
      {sparks.map((sp, i) => <mesh key={i} material={sparkMat} position={sp.pos}><sphereGeometry args={[sp.s, 6, 4]} /></mesh>)}
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={mats.table}><planeGeometry args={[6, 4, 1, 1]} /></mesh>
      <mesh geometry={paperA} material={mats.paperA} position={[-0.2, 0.003, 0.1]} rotation={[-Math.PI / 2, 0, 0.12]} />
      <mesh geometry={paperB} material={mats.paperB} position={[0.16, 0.003, 0.16]} rotation={[-Math.PI / 2, 0, -0.08]} />
      <mesh material={mats.stick} position={stickCenter} quaternion={q}><cylinderGeometry args={[0.009, 0.009, 0.4, 10]} /></mesh>
      <mesh material={mats.head} position={headPos}><sphereGeometry args={[0.016, 16, 12]} /></mesh>
      <mesh material={flameMat} position={flamePos.clone().add(new THREE.Vector3(0, 0.03, 0))}><planeGeometry args={[0.12, 0.22]} /></mesh>
    </>
  );
};

export const WoodcutMatch: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "#e8dcc1" }}>
      <ThreeCanvas width={width} height={height} camera={{ fov: 34, near: 0.05, far: 20, position: [0, 1.3, 1.5] }} gl={{ antialias: true }}>
        <Scene frame={frame} fps={fps} width={width} height={height} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
