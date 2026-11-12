// DepthPhoto: derinlik haritalı 2.5D (2026-11-11, EP013 s02 denemesi). Görüntü alt bölümlü bir düzleme giydirilir, tools/depth_map.py haritası
// (yakın = beyaz) köşeleri kameraya doğru iter; perspektif kamera hareket edince gerçek paralaks olur (iki katmanlı photo_planes'ten farkı:
// her piksel kendi derinliğinde, tek ana nesnesi olmayan manzara/kalabalık/gravürlerde de çalışır).
// props: image, depth, strength (derinlik birim, görüntü yüksekliği = 2), focus {x, y} (görüntü 0-1, kadraj merkezi), from/to {dist, x, y} (kamera),
// durationInFrames. Kare = zamanın saf fonksiyonu.
import { useEffect, useMemo, useState } from "react";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, cancelRender, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

type Cam = { dist: number; x: number; y: number };
export type DepthPhotoProps = { image: string; depth: string; strength?: number; focus?: { x: number; y: number }; from?: Cam; to?: Cam; fov?: number; segments?: number; dof?: { focus: number; amount: number }; orbit?: number; layers?: { image: string; z: number }[]; durationInFrames?: number };

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const inertia = (t: number) => 0.35 * t + 0.65 * t * t * (3 - 2 * t);

const vert = /* glsl */ `
uniform sampler2D uDepth; uniform float uStrength; varying vec2 vUv; varying float vD;
void main() {
  vUv = uv; float d = texture2D(uDepth, uv).r; vD = d;
  vec3 p = position + vec3(0.0, 0.0, d * uStrength);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const frag = /* glsl */ `
uniform sampler2D uImage; uniform sampler2D uDepth; uniform float uFocus; uniform float uBlur; uniform vec2 uTexel; varying vec2 vUv; varying float vD;
void main() {
  // derinliğe bağlı alan derinliği: netlik uFocus derinliğinde, uzaklaştıkça 16 örnekli disk bulanıklığı (yarıçap uBlur px)
  float r = uBlur * smoothstep(0.08, 0.45, uFocus - vD);   // yalnız odaktan uzak (arka) bulanır; ön ve odak net
  vec3 c = vec3(0.0); float wsum = 0.0;
  for (int i = 0; i < 16; i++) {
    float a = float(i) * 2.39996; float rr = sqrt((float(i) + 0.5) / 16.0) * r;
    vec2 o = vec2(cos(a), sin(a)) * rr * uTexel;
    c += texture2D(uImage, vUv + o).rgb; wsum += 1.0;
  }
  c /= wsum;
  c *= mix(0.82, 1.04, vD);            // uzak hafif soluk/koyu: hava perspektifi
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

const useTextures = (image: string, depth: string) => {
  const [tex, setTex] = useState<{ img: THREE.Texture; dep: THREE.Texture; aspect: number } | null>(null);
  const [h] = useState(() => delayRender(`depth ${image}`, { timeoutInMilliseconds: 60000 }));
  useEffect(() => {
    const L = new THREE.TextureLoader();
    Promise.all([L.loadAsync(staticFile(image)), L.loadAsync(staticFile(depth))]).then(([img, dep]) => {
      img.colorSpace = THREE.SRGBColorSpace; img.anisotropy = 8; img.generateMipmaps = true;
      dep.colorSpace = THREE.NoColorSpace;
      const im = img.image as HTMLImageElement;
      setTex({ img, dep, aspect: im.width / im.height }); continueRender(h);
    }).catch((e) => cancelRender(e));
  }, [image, depth, h]);
  return tex;
};

// çok katmanlı mod (tools/depth_layers.py): her dilim ayrı düz kart, z = dilim derinliği × strength; kartlar başlangıç kamerasından bakınca
// orijinal görüntüyle birebir hizalansın diye uzaklıkla ölçeklenir (multiplane). Bulanıklık kart başına (odaktan uzaklığa göre).
const cardFrag = /* glsl */ `
uniform sampler2D uImage; uniform float uBlur; uniform vec2 uTexel; uniform float uShade; varying vec2 vUv;
void main() {
  vec4 c = vec4(0.0);
  for (int i = 0; i < 16; i++) {
    float a = float(i) * 2.39996; float rr = sqrt((float(i) + 0.5) / 16.0) * uBlur;
    c += texture2D(uImage, vUv + vec2(cos(a), sin(a)) * rr * uTexel);
  }
  c /= 16.0;
  gl_FragColor = vec4(c.rgb * uShade, c.a);
  #include <colorspace_fragment>
}`;
const cardVert = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const useLayerTex = (layers: { image: string; z: number }[] | undefined) => {
  const [tex, setTex] = useState<THREE.Texture[] | null>(null);
  const [h] = useState(() => delayRender("depth layers", { timeoutInMilliseconds: 60000 }));
  useEffect(() => {
    if (!layers) { continueRender(h); return; }
    const L = new THREE.TextureLoader();
    Promise.all(layers.map((l) => L.loadAsync(staticFile(l.image)))).then((ts) => {
      ts.forEach((t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; });
      setTex(ts); continueRender(h);
    }).catch((e) => cancelRender(e));
  }, [layers, h]);
  return tex;
};

const Cards: React.FC<{ layers: { image: string; z: number }[]; texs: THREE.Texture[]; aspect: number; S: number; camZ0: number; cx: number; cy: number; dof?: { focus: number; amount: number } }> = ({ layers, texs, aspect, S, camZ0, cx, cy, dof }) => {
  const W = 2 * aspect;
  const mats = useMemo(() => layers.map((l, i) => {
    const im = texs[i].image as HTMLImageElement;
    const blur = dof ? dof.amount * Math.min(1, Math.max(0, (dof.focus - l.z - 0.08) / 0.37)) : 0;
    return new THREE.ShaderMaterial({ vertexShader: cardVert, fragmentShader: cardFrag, transparent: i > 0, depthWrite: false,
      uniforms: { uImage: { value: texs[i] }, uBlur: { value: blur }, uTexel: { value: new THREE.Vector2(1 / im.width, 1 / im.height) }, uShade: { value: 0.82 + 0.22 * l.z } } });
  }), [layers, texs, dof]);
  return <>{layers.map((l, i) => {
    const z = l.z * S, f = ((camZ0 - z) / camZ0) * 1.1;   // 1.1 = taşma payı: yan kaymada kart kenarı kadraja girmesin (hepsi odak etrafında, hiza korunur)
    return <mesh key={i} renderOrder={i} material={mats[i]} position={[cx * (1 - f), cy * (1 - f), z]} scale={[f, f, 1]}><planeGeometry args={[W, 2]} /></mesh>;
  })}</>;
};

const Scene: React.FC<{ tex: { img: THREE.Texture; dep: THREE.Texture; aspect: number }; texs: THREE.Texture[] | null; p: DepthPhotoProps; frame: number; dur: number; width: number; height: number }> = ({ tex, texs, p, frame, dur, width, height }) => {
  const W = 2 * tex.aspect, seg = p.segments ?? 400;
  const geo = useMemo(() => new THREE.PlaneGeometry(W, 2, seg, Math.round(seg / tex.aspect)), [W, seg, tex.aspect]);
  const mat = useMemo(() => new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag,
    uniforms: { uImage: { value: tex.img }, uDepth: { value: tex.dep }, uStrength: { value: p.strength ?? 0.35 }, uFocus: { value: p.dof?.focus ?? 0.6 }, uBlur: { value: p.dof?.amount ?? 0 },
      uTexel: { value: new THREE.Vector2(1 / (tex.img.image as HTMLImageElement).width, 1 / (tex.img.image as HTMLImageElement).height) } } }), [tex, p.strength, p.dof?.focus, p.dof?.amount]);
  const f = p.focus ?? { x: 0.5, y: 0.5 };
  const cx = (f.x - 0.5) * W, cy = (0.5 - f.y) * 2;
  const a = p.from ?? { dist: 2.3, x: -0.05, y: 0 }, b = p.to ?? { dist: 1.8, x: 0.05, y: 0 };
  const k = inertia(clamp(frame / Math.max(1, dur - 1)));
  const cam = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  cam.fov = p.fov ?? 30; cam.aspect = width / height; cam.near = 0.01; cam.far = 20;
  const x = cx + THREE.MathUtils.lerp(a.x, b.x, k), y = cy + THREE.MathUtils.lerp(a.y, b.y, k), z = THREE.MathUtils.lerp(a.dist, b.dist, k) + (p.strength ?? 0.35) * 0.5;
  const yaw = THREE.MathUtils.degToRad((p.orbit ?? 0) * (k - 0.5));   // odak noktası etrafında yay (derece, çekim boyunca toplam)
  const fz = (p.strength ?? 0.35) * 0.35, rz = z - fz;
  cam.position.set(x + Math.sin(yaw) * rz, y, fz + Math.cos(yaw) * rz);
  cam.lookAt(cx, cy, (p.strength ?? 0.35) * 0.35);   // bakış noktası orta derinlikte: önü ve arkası zıt yönde kayar
  cam.updateProjectionMatrix();
  if (p.layers && texs) {
    const camZ0 = a.dist + (p.strength ?? 0.35) * 0.5;
    return <Cards layers={p.layers} texs={texs} aspect={tex.aspect} S={p.strength ?? 0.35} camZ0={camZ0} cx={cx} cy={cy} dof={p.dof} />;
  }
  return <mesh geometry={geo} material={mat} />;
};

export const DepthPhoto: React.FC<DepthPhotoProps> = (p) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const tex = useTextures(p.image, p.depth);
  const texs = useLayerTex(p.layers);
  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0a08" }}>
      {tex && (!p.layers || texs) ? <ThreeCanvas width={width} height={height} gl={{ antialias: true }}>
        <Scene tex={tex} texs={texs} p={p} frame={frame} dur={durationInFrames} width={width} height={height} />
      </ThreeCanvas> : null}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 46%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.55) 100%)" }} />
      <AbsoluteFill style={{ opacity: 0.07, mixBlendMode: "overlay", backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='${frame % 24}'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")` }} />
    </AbsoluteFill>
  );
};
