// paper-lantern kiti (docs/styles/paper-lantern.md; Lemo-Opuscar paper-lantern, MIT). Lemo'nun stage.js'i @react-three/fiber sahnesine taşındı:
// tepe spot (VSM yumuşak gölge, kâğıt katmanlar arkadakine gölge düşürür) + ortam ışığı + arka ışık uniform'ları (paperMat shader'ı) + kamera.
// Sonra: render hedefi (MSAA, HalfFloat) → bloom → renk/vinyet → OutputPass (ton eşleme + sRGB). Remotion kareleri rastgele sırada render eder:
// her şey kare zamanından türetilir; renk ayarının her anahtarı her karede yeniden yazılır (Lemo STYLE.md §9 "grade state").
import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { vnoise } from "./lib";

export type StageOpts = {
  light?: [number, number, number]; lightR?: number; lightCol?: string; floor?: number;
  key?: number; keyCol?: string; keyPos?: [number, number, number]; keyTarget?: [number, number, number]; keyAngle?: number; shadowR?: number;
  amb?: number; ambCol?: string; bg?: string;
};
export type Grade = { expo?: number; vig?: number; sat?: number; contrast?: number; fade?: number; warm?: number };
export type Bloom = { strength?: number; radius?: number; threshold?: number };

const gradeShader = {
  uniforms: { tDiffuse: { value: null }, expo: { value: 1 }, vig: { value: 0.35 }, sat: { value: 1 }, contrast: { value: 0.08 }, fade: { value: 1 },
    warm: { value: 0.03 }, aspect: { value: 9 / 16 } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }",
  fragmentShader: `varying vec2 vUv; uniform sampler2D tDiffuse; uniform float expo, vig, sat, contrast, fade, warm, aspect;
    void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb * expo;
      float l = dot(c, vec3(.2126,.7152,.0722)); c = mix(vec3(l), c, sat);
      c = mix(c, c * c * (3. - 2. * clamp(c, 0., 1.)), contrast);
      c *= vec3(1. + warm, 1., 1. - warm);
      vec2 d = (vUv - .5) * vec2(aspect, 1.); c *= 1. - vig * smoothstep(.25, .85, length(d));
      gl_FragColor = vec4(c * fade, 1.); }`,
};

/** Fener sahnesi: Lemo stage() + post. build(S) bir kez çağrılır (katmanları S.add ile ekle), sonra her karede update. */
export const useLantern = (width: number, height: number, o: StageOpts = {}) => {
  const { gl, scene, camera, size } = useThree();
  const S = useMemo(() => {
    gl.shadowMap.enabled = true; gl.shadowMap.type = THREE.VSMShadowMap;
    gl.toneMapping = THREE.NoToneMapping;
    scene.background = new THREE.Color(o.bg ?? "#000");
    const U = {
      uLight: { value: new THREE.Vector3(...(o.light ?? [0, 0.05, -0.12])) }, uLightR: { value: o.lightR ?? 0.14 },
      uLightCol: { value: new THREE.Color(o.lightCol ?? "#ffe0a8") }, uLit: { value: 1 }, uFloor: { value: o.floor ?? 0.22 },
      uBeamO: { value: new THREE.Vector3(0, 0, 0) }, uBeamD: { value: new THREE.Vector3(0, 0.05, 0.3) }, uBeamCol: { value: new THREE.Color("#ffcf86") },
    };
    const key = new THREE.SpotLight(o.keyCol ?? "#ffeedd", o.key ?? 2.2, 0, o.keyAngle ?? 0.75, 1, 0);
    key.position.set(...(o.keyPos ?? [0, 0.34, 0.3])); key.target.position.set(...(o.keyTarget ?? [0, -0.04, -0.08]));
    key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0008; key.shadow.radius = o.shadowR ?? 10;
    (key.shadow as THREE.SpotLightShadow & { blurSamples: number }).blurSamples = 20; key.shadow.camera.near = 0.05; key.shadow.camera.far = 3;
    const amb = new THREE.AmbientLight(o.ambCol ?? "#9fb0d8", o.amb ?? 0.5);
    const root = new THREE.Group();
    root.add(key, key.target, amb);
    scene.add(root);   // ilk karede hazır olmalı: useEffect ilk render'dan sonra çalışır, Remotion kareyi o zaman çekmiş olur (boş kare)
    return { U, key, amb, root, base: { key: o.key ?? 2.2, amb: o.amb ?? 0.5 },
      add<T extends THREE.Object3D>(...ms: T[]) { for (const m of ms) root.add(m); return ms[0]; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => () => { scene.remove(S.root); }, [scene, S]);
  const post = useMemo(() => {
    const rt = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType, samples: 4 });
    const comp = new EffectComposer(gl, rt);
    comp.setSize(width, height);
    comp.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.3, 0.5, 1.1);
    comp.addPass(bloom);
    const grade = new ShaderPass(gradeShader);
    grade.uniforms.aspect.value = width / height;
    comp.addPass(grade);
    comp.addPass(new OutputPass());
    return { comp, bloom, grade };
  }, [gl, scene, camera, width, height]);
  const state = useMemo(() => ({ bloom: {} as Bloom, grade: {} as Grade }), []);
  useFrame(() => {
    const b = state.bloom, g = state.grade;   // varsayılana dönen anahtarlar (Lemo: "grade state must not carry over")
    post.bloom.strength = b.strength ?? 0.3; post.bloom.radius = b.radius ?? 0.5; post.bloom.threshold = b.threshold ?? 1.1;
    const u = post.grade.uniforms;
    u.expo.value = g.expo ?? 1; u.vig.value = g.vig ?? 0.35; u.sat.value = g.sat ?? 1; u.contrast.value = g.contrast ?? 0.08;
    u.fade.value = g.fade ?? 1; u.warm.value = g.warm ?? 0.03;
    post.comp.render();
  }, 1);
  void size;
  /** her karede çağır: post ayarları (verilmeyen anahtar varsayılana döner) */
  const setPost = (bloom: Bloom = {}, grade: Grade = {}) => { state.bloom = bloom; state.grade = grade; };
  return { S, camera: camera as THREE.PerspectiveCamera, setPost };
};

/** Kamera: konum + bakış noktası; el kamerası mikro kayması (vars. 0.6 mm; Lemo stage.js aim) */
export const aim = (cam: THREE.PerspectiveCamera, p: number[], t: number, o: { hand?: number; handF?: number; fov?: number } = {}) => {
  const h = o.hand ?? 0.0006, f = o.handF ?? 0.35;
  cam.position.set(p[0] + (vnoise(t * f + 3) - 0.5) * h, p[1] + (vnoise(t * f + 17) - 0.5) * h, p[2]);
  cam.lookAt(p[3] + (vnoise(t * f * 0.8 + 40) - 0.5) * h * 0.6, p[4] + (vnoise(t * f * 0.8 + 55) - 0.5) * h * 0.6, p[5]);
  if (o.fov && cam.fov !== o.fov) { cam.fov = o.fov; cam.updateProjectionMatrix(); }
  cam.updateMatrixWorld();
};

export const PAPER = "#9a9a9a";
const BASE = new THREE.Color(PAPER).r;
/** Katmanlar nötr gri kesilir, rengi tint ile verilir (Lemo world.js) */
export const tint = (m: THREE.Mesh, hex: string, k = 1) => (m.material as THREE.MeshStandardMaterial).color.set(hex).multiplyScalar(k / BASE);
/** delik kes (destination-out; önce opak dolgu olmalı) */
export const cut = (x: CanvasRenderingContext2D, fn: () => void) => { x.save(); x.globalCompositeOperation = "destination-out"; x.fillStyle = "#000"; x.strokeStyle = "#000"; fn(); x.restore(); };
