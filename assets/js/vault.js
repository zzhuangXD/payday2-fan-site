// THE VAULT —— 可开枪交互的 3D 金库场景（three.js，全部程序化建模，无外部模型）
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const stage = document.getElementById('vault-stage');
const hud = {
  ammo: document.getElementById('v-ammo'),
  cash: document.getElementById('v-cash'),
  hint: document.getElementById('v-hint'),
  status: document.getElementById('v-status'),
  cross: document.getElementById('v-cross'),
};
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isSmall = matchMedia('(max-width: 760px)').matches;

/* ---------- 渲染器 ---------- */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: !isSmall, powerPreference: 'high-performance' });
} catch (e) {
  stage.classList.add('nogl');
  hud.hint.textContent = '你的浏览器没有开启 WebGL，3D 金库无法显示。';
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, isSmall ? 1.5 : 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070a);
scene.fog = new THREE.FogExp2(0x05070a, 0.055);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;

const camera = new THREE.PerspectiveCamera(58, 16 / 9, 0.05, 60);
const CAM_BASE = new THREE.Vector3(0, 1.65, 6.2);
camera.position.copy(CAM_BASE);
scene.add(camera);

/* ---------- 程序化贴图 ---------- */
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
const noise = (ctx, w, h, base, spread, n) => {
  ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) {
    const v = Math.random() * spread | 0, a = Math.random() * 0.25;
    ctx.fillStyle = `rgba(${v},${v},${v},${a})`;
    const s = Math.random() * 3 + 0.5;
    ctx.fillRect(Math.random() * w, Math.random() * h, s, s);
  }
};
const concreteTex = canvasTex(512, 512, (c, w, h) => {
  noise(c, w, h, '#3a3c3e', 255, 26000);
  c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 2;
  for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(i * w / 4, 0); c.lineTo(i * w / 4, h); c.stroke(); c.beginPath(); c.moveTo(0, i * h / 4); c.lineTo(w, i * h / 4); c.stroke(); }
}, [6, 6]);
const wallTex = canvasTex(512, 512, (c, w, h) => noise(c, w, h, '#2b2e31', 200, 18000), [4, 2]);
const steelTex = canvasTex(256, 256, (c, w, h) => {
  c.fillStyle = '#8a9096'; c.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y++) { const v = 120 + Math.random() * 40 | 0; c.fillStyle = `rgba(${v},${v + 4},${v + 8},.35)`; c.fillRect(0, y, w, 1); }
});
const billTex = canvasTex(256, 110, (c, w, h) => {
  c.fillStyle = '#c9d3bf'; c.fillRect(0, 0, w, h);
  c.strokeStyle = '#3f5a3a'; c.lineWidth = 6; c.strokeRect(6, 6, w - 12, h - 12);
  c.fillStyle = '#4c6a45'; c.beginPath(); c.ellipse(w / 2, h / 2, 26, 34, 0, 0, Math.PI * 2); c.fill();
  c.font = 'bold 30px Arial'; c.fillStyle = '#2f4a2b'; c.fillText('100', 16, 42); c.fillText('100', w - 70, h - 18);
});
const stackTex = canvasTex(256, 128, (c, w, h) => {
  c.fillStyle = '#b9c4ad'; c.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 3) { c.fillStyle = y % 6 ? 'rgba(60,80,55,.25)' : 'rgba(255,255,255,.15)'; c.fillRect(0, y, w, 1); }
  c.fillStyle = '#d8b25a'; c.fillRect(w * 0.42, 0, w * 0.16, h);
});

/* ---------- 材质 ---------- */
const M = {
  floor: new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.9, metalness: 0.05 }),
  wall: new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.95 }),
  steel: new THREE.MeshStandardMaterial({ map: steelTex, color: 0xb8c0c8, roughness: 0.38, metalness: 0.9 }),
  darkSteel: new THREE.MeshStandardMaterial({ color: 0x2a2f35, roughness: 0.5, metalness: 0.85 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.3, metalness: 1 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xffc94a, roughness: 0.22, metalness: 1, emissive: 0x2a1a00, emissiveIntensity: 0.4 }),
  cash: new THREE.MeshStandardMaterial({ map: stackTex, roughness: 0.8 }),
  bill: new THREE.MeshStandardMaterial({ map: billTex, roughness: 0.9, side: THREE.DoubleSide }),
  wood: new THREE.MeshStandardMaterial({ color: 0x3b2a1e, roughness: 0.75 }),
  glass: new THREE.MeshStandardMaterial({ color: 0xbfe6ff, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.18, depthWrite: false }),
  shard: new THREE.MeshStandardMaterial({ color: 0xd8f1ff, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
  gem: new THREE.MeshStandardMaterial({ color: 0x9fe3ff, roughness: 0.05, metalness: 0.3, emissive: 0x0d4a66, emissiveIntensity: 0.6 }),
  black: new THREE.MeshStandardMaterial({ color: 0x0b0c0d, roughness: 0.6 }),
  hole: new THREE.MeshBasicMaterial({ color: 0x050505, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }),
};

/* ---------- 交互登记 ---------- */
const hittables = [];   // 参与射线检测的网格
const bodies = [];      // 简易物理刚体
const ROOM = { x: 4.6, z0: -7.6, z1: 7.5, h: 4.2 };
function hittable(mesh, kind, data = {}) { mesh.userData.kind = kind; Object.assign(mesh.userData, data); hittables.push(mesh); return mesh; }
function shadowy(o) { o.castShadow = true; o.receiveShadow = true; return o; }

/* ---------- 房间 ---------- */
const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.x * 2, ROOM.z1 - ROOM.z0), M.floor);
floor.rotation.x = -Math.PI / 2; floor.position.z = (ROOM.z0 + ROOM.z1) / 2; floor.receiveShadow = true;
scene.add(hittable(floor, 'surface'));
const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.x * 2, ROOM.z1 - ROOM.z0), M.wall);
ceil.rotation.x = Math.PI / 2; ceil.position.set(0, ROOM.h, (ROOM.z0 + ROOM.z1) / 2);
scene.add(hittable(ceil, 'surface'));
[-1, 1].forEach(s => {
  const w = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.z1 - ROOM.z0, ROOM.h), M.wall);
  w.rotation.y = -s * Math.PI / 2; w.position.set(s * ROOM.x, ROOM.h / 2, (ROOM.z0 + ROOM.z1) / 2); w.receiveShadow = true;
  scene.add(hittable(w, 'surface'));
});
// 后墙（金库门所在）
const back = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.x * 2, ROOM.h), M.wall);
back.position.set(0, ROOM.h / 2, ROOM.z0); back.receiveShadow = true;
scene.add(hittable(back, 'surface'));

// 两侧保险柜墙（实例化）
const boxGeo = new THREE.BoxGeometry(0.46, 0.3, 0.08);
const knobGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.04, 10);
[-1, 1].forEach(s => {
  const cols = 9, rows = 9, count = cols * rows;
  const boxes = new THREE.InstancedMesh(boxGeo, M.steel, count);
  const knobs = new THREE.InstancedMesh(knobGeo, M.brass, count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -s * Math.PI / 2, 0));
  const qk = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2));
  let i = 0;
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
    const z = -6.6 + c * 0.5, y = 0.45 + r * 0.33;
    m.compose(new THREE.Vector3(s * (ROOM.x - 0.05), y, z), q, new THREE.Vector3(1, 1, 1)); boxes.setMatrixAt(i, m);
    m.compose(new THREE.Vector3(s * (ROOM.x - 0.1), y, z + 0.12), qk, new THREE.Vector3(1, 1, 1)); knobs.setMatrixAt(i, m);
    i++;
  }
  boxes.receiveShadow = true;
  scene.add(hittable(boxes, 'metal'), knobs);
});

// 金库大门（半开）
const door = new THREE.Group();
const ring = shadowy(new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.18, 18, 64), M.darkSteel));
ring.position.set(0, 1.95, ROOM.z0 + 0.12);
scene.add(hittable(ring, 'metal'));
const slab = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.55, 64), M.steel));
slab.rotation.x = Math.PI / 2;
door.add(hittable(slab, 'metal'));
for (let k = 0; k < 3; k++) {
  const r = new THREE.Mesh(new THREE.TorusGeometry(0.5 + k * 0.3, 0.035, 8, 48), M.darkSteel);
  r.position.z = 0.29; door.add(r);
}
for (let k = 0; k < 12; k++) {
  const a = k / 12 * Math.PI * 2, bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.6, 12), M.brass);
  bolt.rotation.z = a; bolt.position.set(Math.cos(a) * 1.5, Math.sin(a) * 1.5, 0); bolt.rotation.set(0, 0, a + Math.PI / 2); door.add(bolt);
}
const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.2, 24), M.brass); hub.rotation.x = Math.PI / 2; hub.position.z = 0.36; door.add(hub);
for (let k = 0; k < 3; k++) {
  const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 8), M.brass);
  spoke.rotation.z = k * Math.PI / 3; spoke.position.z = 0.42; door.add(spoke);
}
const doorPivot = new THREE.Group();
doorPivot.position.set(-1.55, 1.95, ROOM.z0 + 0.5);
door.position.set(1.55, 0, 0);
doorPivot.add(door); doorPivot.rotation.y = -0.95;
scene.add(doorPivot);
// 门后的金光
const vaultGlow = new THREE.PointLight(0xffb347, 18, 9, 1.6);
vaultGlow.position.set(0.2, 1.8, ROOM.z0 + 0.1); scene.add(vaultGlow);
const glowDisc = new THREE.Mesh(new THREE.CircleGeometry(1.35, 48), new THREE.MeshBasicMaterial({ color: 0xffb04a, toneMapped: false }));
glowDisc.position.set(0, 1.95, ROOM.z0 + 0.02); scene.add(glowDisc);

/* ---------- 中央：钱堆与金条 ---------- */
const pallet = shadowy(new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.16, 1.4), M.wood));
pallet.position.set(0, 0.08, -1.2); scene.add(hittable(pallet, 'wood'));
const stackGeo = new THREE.BoxGeometry(0.34, 0.14, 0.16);
for (let x = 0; x < 6; x++) for (let z = 0; z < 4; z++) for (let y = 0; y < 3 + (x + z) % 3; y++) {
  const st = shadowy(new THREE.Mesh(stackGeo, M.cash));
  st.position.set(-0.95 + x * 0.38, 0.23 + y * 0.145, -1.68 + z * 0.3);
  st.rotation.y = (Math.random() - 0.5) * 0.08;
  scene.add(hittable(st, 'cash', { value: 10000 }));
}
const barGeo = new THREE.BoxGeometry(0.28, 0.08, 0.12);
const table = shadowy(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.8), M.darkSteel));
table.position.set(2.3, 0.85, 1.1); scene.add(hittable(table, 'metal'));
[[-0.6, -0.3], [0.6, -0.3], [-0.6, 0.3], [0.6, 0.3]].forEach(([dx, dz]) => {
  const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.82, 0.05), M.darkSteel);
  leg.position.set(2.3 + dx, 0.41, 1.1 + dz); scene.add(leg);
});
for (let l = 0; l < 3; l++) for (let i = 0; i < 4 - l; i++) for (let j = 0; j < 2; j++) {
  const bar = shadowy(new THREE.Mesh(barGeo, M.gold));
  bar.position.set(2.3 - 0.45 + l * 0.15 + i * 0.3, 0.92 + l * 0.08, 1.0 + j * 0.16);
  scene.add(hittable(bar, 'gold', { value: 50000 }));
}

/* ---------- 展柜（可击碎） ---------- */
function showcase(x, z) {
  const base = shadowy(new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 0.7), M.black));
  base.position.set(x, 0.45, z); scene.add(hittable(base, 'wood'));
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.6, 0.66), M.glass);
  glass.position.set(x, 1.2, z); glass.renderOrder = 2;
  scene.add(hittable(glass, 'glass'));
  for (let k = 0; k < 3; k++) {
    const g = shadowy(new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), M.gem));
    g.position.set(x - 0.3 + k * 0.3, 1.0, z); g.userData.spin = 0.6 + Math.random();
    scene.add(hittable(g, 'gem', { value: 25000 }));
  }
}
showcase(-2.6, 1.4); showcase(-2.6, -1.6);

/* ---------- 吊灯（可打灭） ---------- */
const lamps = [];
function lamp(x, z, color = 0xfff1d6) {
  const pivot = new THREE.Group(); pivot.position.set(x, ROOM.h, z); scene.add(pivot);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.9, 6), M.black); cord.position.y = -0.45; pivot.add(cord);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.26, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0x1c2024, metalness: 0.7, roughness: 0.4, side: THREE.DoubleSide }));
  shade.position.y = -1.0; pivot.add(shade);
  const bulbMat = new THREE.MeshBasicMaterial({ color, toneMapped: false });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 12), bulbMat); bulb.position.y = -1.08; pivot.add(bulb);
  const light = new THREE.SpotLight(color, 26, 9, 0.85, 0.55, 1.4);
  light.position.y = -1.1; light.target.position.set(0, -5, 0); pivot.add(light, light.target);
  const L = { pivot, light, bulb, bulbMat, swing: 0, vel: 0, on: true, base: 26 };
  hittable(shade, 'lamp', { lamp: L }); hittable(bulb, 'lamp', { lamp: L });
  lamps.push(L); return L;
}
const mainLamp = lamp(0, -1.2); mainLamp.light.castShadow = true; mainLamp.light.shadow.mapSize.set(1024, 1024); mainLamp.light.shadow.bias = -0.0008;
lamp(-2.6, 0); lamp(2.4, 1.6, 0xd6ecff); lamp(0, 3.6, 0xd6ecff);
scene.add(new THREE.HemisphereLight(0x4a6a8a, 0x0b0b0b, 0.35));

/* ---------- 监控摄像头（可打掉） ---------- */
const camRig = new THREE.Group(); camRig.position.set(ROOM.x - 0.25, 3.5, -5.2); scene.add(camRig);
const arm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.06), M.darkSteel); arm.position.x = 0.1; camRig.add(arm);
const camHead = new THREE.Group(); camHead.position.set(-0.15, -0.08, 0); camRig.add(camHead);
const camBody = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.2), new THREE.MeshStandardMaterial({ color: 0xd9dcdf, roughness: 0.45, metalness: 0.2 })));
camHead.add(camBody);
const camLens = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.06, 16), M.black); camLens.rotation.z = Math.PI / 2; camLens.position.x = -0.23; camHead.add(camLens);
const ledMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a, toneMapped: false });
const led = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), ledMat); led.position.set(-0.18, 0.07, 0.08); camHead.add(led);
camHead.rotation.set(0, 0.35, -0.35);
const camState = { alive: true, t: 0 };
[camBody, camLens].forEach(m => hittable(m, 'camera'));

/* ---------- 警灯（警报时旋转） ---------- */
const sirens = [];
[[-ROOM.x + 0.3, 0x2a5bff], [ROOM.x - 0.3, 0xff2020]].forEach(([x, c], i) => {
  const l = new THREE.SpotLight(c, 0, 14, 0.5, 0.4, 1.2);
  l.position.set(x, 3.9, -3 + i * 4); l.target.position.set(0, 1, 0); scene.add(l, l.target);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), new THREE.MeshBasicMaterial({ color: c, toneMapped: false }));
  beacon.position.copy(l.position); beacon.visible = false; scene.add(beacon);
  sirens.push({ l, beacon, phase: i * Math.PI });
});

/* ---------- 枪（第一人称视角模型） ---------- */
const gun = new THREE.Group();
const gunMat = new THREE.MeshStandardMaterial({ color: 0x1a1c1f, roughness: 0.42, metalness: 0.75 });
const slide = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.055, 0.3), gunMat); slide.position.set(0, 0.03, -0.12); gun.add(slide);
const frame = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.035, 0.25), gunMat); frame.position.set(0, -0.012, -0.1); gun.add(frame);
const grip = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.14, 0.06), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 }));
grip.position.set(0, -0.08, 0.0); grip.rotation.x = 0.28; gun.add(grip);
const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.04, 10), M.black); barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.03, -0.29); gun.add(barrel);
const sight = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.012, 0.012), gunMat); sight.position.set(0, 0.064, -0.25); gun.add(sight);
const handMat = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.9 }); // 战术手套
const hand = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.09, 0.1), handMat); hand.position.set(0.004, -0.07, 0.02); hand.rotation.x = 0.28; gun.add(hand);
const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.4, 12), new THREE.MeshStandardMaterial({ color: 0x14161b, roughness: 0.95 }));
sleeve.rotation.x = Math.PI / 2 - 0.3; sleeve.position.set(0.02, -0.14, 0.22); gun.add(sleeve);
const flashMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, toneMapped: false, depthWrite: false });
const flash = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), flashMat); flash.position.set(0, 0.03, -0.34); gun.add(flash);
const flashLight = new THREE.PointLight(0xffb060, 0, 6, 2); flashLight.position.set(0, 0.03, -0.4); gun.add(flashLight);
const GUN_REST = new THREE.Vector3(0.2, -0.19, -0.42);
gun.position.copy(GUN_REST);
gun.traverse(o => { if (o.isMesh) o.renderOrder = 10; });
camera.add(gun);

/* ---------- 后期：Bloom ---------- */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.75, 0.55, 0.82);
composer.addPass(bloom);
composer.addPass(new OutputPass());

/* ---------- 粒子：火花 / 钞票 / 碎玻璃 ---------- */
const SPARKS = 220;
const sparkGeo = new THREE.BufferGeometry();
const sparkPos = new Float32Array(SPARKS * 3), sparkVel = new Float32Array(SPARKS * 3), sparkLife = new Float32Array(SPARKS);
sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
const sparkPts = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: 0xffc070, size: 0.035, transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
sparkPts.frustumCulled = false; scene.add(sparkPts);
let sparkHead = 0;
for (let i = 0; i < SPARKS; i++) sparkPos[i * 3 + 1] = -99;
function sparks(p, n, normal, speed = 3) {
  for (let k = 0; k < n; k++) {
    const i = sparkHead++ % SPARKS;
    sparkPos.set([p.x, p.y, p.z], i * 3);
    const d = new THREE.Vector3().randomDirection().add(normal.clone().multiplyScalar(1.4)).normalize().multiplyScalar(speed * (0.4 + Math.random()));
    sparkVel.set([d.x, d.y, d.z], i * 3); sparkLife[i] = 0.25 + Math.random() * 0.35;
  }
}
const flying = []; // 钞票、碎玻璃、金条等短暂飞行物
const billGeo = new THREE.PlaneGeometry(0.16, 0.07);
function spawnBills(p, n) {
  for (let k = 0; k < n; k++) {
    const b = new THREE.Mesh(billGeo, M.bill); b.position.copy(p);
    b.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    scene.add(b);
    flying.push({ m: b, v: new THREE.Vector3((Math.random() - 0.5) * 2.4, 1.5 + Math.random() * 2.2, (Math.random() - 0.5) * 2.4), w: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8), drag: 2.6, life: 6 + Math.random() * 3, flat: true });
  }
}
function shatter(glass) {
  const p = glass.position, s = glass.geometry.parameters;
  scene.remove(glass); hittables.splice(hittables.indexOf(glass), 1);
  for (let k = 0; k < 46; k++) {
    const g = new THREE.BufferGeometry();
    const a = new THREE.Vector3((Math.random() - 0.5) * 0.18, (Math.random() - 0.5) * 0.18, 0);
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, a.x, a.y, 0, a.y, -a.x, 0]), 3)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, M.shard);
    m.position.set(p.x + (Math.random() - 0.5) * s.width, p.y + (Math.random() - 0.3) * s.height, p.z + (Math.random() - 0.5) * s.depth);
    scene.add(m);
    flying.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2.5, (Math.random() - 0.5) * 3 + 1), w: new THREE.Vector3(Math.random() * 12, Math.random() * 12, Math.random() * 12), drag: 0.3, life: 5, flat: true });
  }
}

/* ---------- 弹孔 ---------- */
const holeGeo = new THREE.CircleGeometry(0.022, 10);
const holes = [];
function bulletHole(hit) {
  if (!hit.face) return;
  const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
  const h = new THREE.Mesh(holeGeo, M.hole);
  h.position.copy(hit.point).addScaledVector(n, 0.004);
  h.lookAt(hit.point.clone().add(n));
  scene.add(h); holes.push(h);
  if (holes.length > 80) scene.remove(holes.shift());
}

/* ---------- 声音（WebAudio 合成，不使用外部音频） ---------- */
let actx = null;
function audio() { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); return actx; }
function noiseBurst(dur, freq, q, gain, type = 'lowpass') {
  const a = audio(), len = a.sampleRate * dur | 0, buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const src = a.createBufferSource(); src.buffer = buf;
  const f = a.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = a.createGain(); g.gain.value = gain;
  src.connect(f).connect(g).connect(a.destination); src.start();
}
function sfxShot() {
  noiseBurst(0.32, 2200, 0.7, 0.9);
  const a = audio(), o = a.createOscillator(), g = a.createGain();
  o.type = 'triangle'; o.frequency.setValueAtTime(140, a.currentTime); o.frequency.exponentialRampToValueAtTime(40, a.currentTime + 0.15);
  g.gain.setValueAtTime(0.7, a.currentTime); g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.18);
  o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + 0.2);
}
const sfxGlass = () => { noiseBurst(0.6, 5200, 2, 0.5, 'highpass'); noiseBurst(0.25, 9000, 6, 0.25, 'bandpass'); };
const sfxPing = () => { const a = audio(), o = a.createOscillator(), g = a.createGain(); o.frequency.value = 1800 + Math.random() * 900; g.gain.setValueAtTime(0.12, a.currentTime); g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.25); o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + 0.3); };
const sfxClick = () => noiseBurst(0.05, 3000, 4, 0.25, 'bandpass');
const sfxReload = () => { sfxClick(); setTimeout(sfxClick, 380); setTimeout(() => noiseBurst(0.08, 1500, 3, 0.35, 'bandpass'), 760); };
let sirenOsc = null;
function sirenOn(on) {
  if (on && !sirenOsc && actx) {
    const o = actx.createOscillator(), lfo = actx.createOscillator(), lg = actx.createGain(), g = actx.createGain();
    o.type = 'sawtooth'; o.frequency.value = 720; lfo.frequency.value = 0.55; lg.gain.value = 240;
    lfo.connect(lg).connect(o.frequency); g.gain.value = 0.025;
    const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800;
    o.connect(f).connect(g).connect(actx.destination); o.start(); lfo.start();
    sirenOsc = { o, lfo, g };
  } else if (!on && sirenOsc) {
    sirenOsc.g.gain.setTargetAtTime(0, actx.currentTime, 0.2);
    const s = sirenOsc; setTimeout(() => { s.o.stop(); s.lfo.stop(); }, 800); sirenOsc = null;
  }
}

/* ---------- 状态 ---------- */
const MAG = 12;
let ammo = MAG, reloading = false, loot = 0, recoil = 0, flashT = 0, shake = 0;
const fmt = n => '$' + n.toLocaleString('en-US');
function updateHud() { hud.ammo.textContent = reloading ? 'RELOAD' : `${ammo} / ${MAG}`; hud.cash.textContent = fmt(loot); }
function say(t) { hud.status.textContent = t; hud.status.classList.remove('pop'); void hud.status.offsetWidth; hud.status.classList.add('pop'); }
function addLoot(v, label) { loot += v; updateHud(); say(`${label} +${fmt(v)}`); }
const isLoud = () => document.documentElement.dataset.mode === 'loud';
function goLoud(reason) { if (!isLoud() && typeof window.setMode === 'function') { window.setMode(true); say(reason); } }
function reload() {
  if (reloading || ammo === MAG) return;
  reloading = true; updateHud(); try { sfxReload(); } catch (e) {}
  setTimeout(() => { ammo = MAG; reloading = false; updateHud(); }, 1100);
}

/* ---------- 瞄准与射击 ---------- */
const mouse = new THREE.Vector2(0, 0), look = new THREE.Vector2(0, 0);
const ray = new THREE.Raycaster();
let pointerInside = false;
function setPointer(e) {
  const r = renderer.domElement.getBoundingClientRect();
  mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  hud.cross.style.transform = `translate(${e.clientX - r.left}px, ${e.clientY - r.top}px)`;
}
stage.addEventListener('pointermove', e => { pointerInside = true; stage.classList.add('aiming'); setPointer(e); });
stage.addEventListener('pointerleave', () => { pointerInside = false; stage.classList.remove('aiming'); });
stage.addEventListener('pointerdown', e => {
  if (e.target.closest('.v-ui')) return;
  setPointer(e); shoot();
});
stage.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('keydown', e => { if ((e.key === 'r' || e.key === 'R') && stageVisible) reload(); });
document.getElementById('v-reload').addEventListener('click', reload);

function shoot() {
  if (reloading) return;
  if (ammo <= 0) { try { sfxClick(); } catch (e) {} say('弹匣空了，按 R 换弹'); return; }
  ammo--; updateHud();
  recoil = 1; flashT = 1; shake = Math.min(shake + 0.6, 1);
  flash.rotation.z = Math.random() * Math.PI;
  try { sfxShot(); } catch (e) {}
  if (ammo === 0) setTimeout(reload, 350);

  ray.setFromCamera(mouse, camera);
  const hit = ray.intersectObjects(hittables, false)[0];
  if (!hit) return;
  const o = hit.object, kind = o.userData.kind;
  const n = hit.face ? hit.face.normal.clone().transformDirection(o.matrixWorld) : ray.ray.direction.clone().negate();
  const dir = ray.ray.direction.clone();

  switch (kind) {
    case 'glass':
      shatter(o); try { sfxGlass(); } catch (e) {} sparks(hit.point, 10, n, 2);
      goLoud('展柜被打碎，警报响了！');
      break;
    case 'gem':
      pushBody(o, dir, 2.2); addLoot(o.userData.value, '珠宝'); o.userData.kind = 'loose';
      goLoud('警报响了！');
      break;
    case 'cash': {
      spawnBills(hit.point, 14);
      const v = o.userData.value; o.userData.hits = (o.userData.hits || 0) + 1;
      o.scale.y = Math.max(0.25, 1 - o.userData.hits * 0.3);
      if (o.userData.hits >= 3) { scene.remove(o); hittables.splice(hittables.indexOf(o), 1); }
      addLoot(v, '现金'); goLoud('警报响了！');
      break; }
    case 'gold':
      pushBody(o, dir, 3.2); sparks(hit.point, 14, n, 3); try { sfxPing(); } catch (e) {}
      addLoot(o.userData.value, '金条'); o.userData.kind = 'loose'; goLoud('警报响了！');
      break;
    case 'loose':
      if (o.userData.body) { o.userData.body.v.addScaledVector(dir, 2.4); o.userData.body.v.y += 1.5; o.userData.body.sleep = false; }
      sparks(hit.point, 8, n, 2.5);
      break;
    case 'lamp': {
      const L = o.userData.lamp;
      L.vel += (Math.random() < 0.5 ? -1 : 1) * 2.2;
      if (L.on) { L.on = false; L.light.intensity = 0; L.bulbMat.color.setHex(0x222222); sparks(hit.point, 30, n, 3.5); try { sfxGlass(); } catch (e) {} say('灯被打灭了'); }
      goLoud('警报响了！');
      break; }
    case 'camera':
      if (camState.alive) {
        camState.alive = false; ledMat.color.setHex(0x220000);
        sparks(hit.point, 40, n, 4);
        const body = pushBody(camHead, dir, 1.2, true);
        say(isLoud() ? '摄像头被打掉了' : '摄像头被打掉了…但枪声已经惊动了保安');
      }
      goLoud('警报响了！');
      break;
    default:
      bulletHole(hit); sparks(hit.point, kind === 'metal' ? 16 : 8, n, kind === 'metal' ? 3.2 : 2);
      if (kind === 'metal') try { sfxPing(); } catch (e) {}
      goLoud('枪声惊动了保安，警报响了！');
  }
}

/* ---------- 简易刚体 ---------- */
function pushBody(obj, dir, strength, detach) {
  if (detach || obj.parent !== scene) { scene.attach(obj); }
  let b = obj.userData.body;
  if (!b) {
    const box = new THREE.Box3().setFromObject(obj); const half = (box.max.y - box.min.y) / 2;
    b = { m: obj, v: new THREE.Vector3(), w: new THREE.Vector3(), half: Math.max(half, 0.03), sleep: false };
    obj.userData.body = b; bodies.push(b);
  }
  b.v.addScaledVector(dir, strength); b.v.y += strength * 0.6;
  b.w.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12);
  b.sleep = false; return b;
}
const G = -9.8;
function stepBodies(dt) {
  for (const b of bodies) {
    if (b.sleep) continue;
    b.v.y += G * dt;
    b.m.position.addScaledVector(b.v, dt);
    b.m.rotation.x += b.w.x * dt; b.m.rotation.y += b.w.y * dt; b.m.rotation.z += b.w.z * dt;
    const floorY = b.half;
    if (b.m.position.y < floorY) {
      b.m.position.y = floorY; b.v.y *= -0.35; b.v.x *= 0.7; b.v.z *= 0.7; b.w.multiplyScalar(0.6);
      if (Math.abs(b.v.y) < 0.4 && b.v.lengthSq() < 0.05) { b.sleep = true; b.v.set(0, 0, 0); b.m.rotation.x = Math.round(b.m.rotation.x / (Math.PI / 2)) * (Math.PI / 2); b.m.rotation.z = Math.round(b.m.rotation.z / (Math.PI / 2)) * (Math.PI / 2); }
    }
    const p = b.m.position;
    if (Math.abs(p.x) > ROOM.x - 0.1) { p.x = Math.sign(p.x) * (ROOM.x - 0.1); b.v.x *= -0.4; }
    if (p.z < ROOM.z0 + 0.2) { p.z = ROOM.z0 + 0.2; b.v.z *= -0.4; }
    if (p.z > ROOM.z1 - 0.2) { p.z = ROOM.z1 - 0.2; b.v.z *= -0.4; }
  }
  for (let i = flying.length - 1; i >= 0; i--) {
    const f = flying[i];
    f.life -= dt;
    f.v.y += G * dt * (f.drag > 1 ? 0.18 : 1);
    f.v.multiplyScalar(1 - Math.min(f.drag * dt, 0.5) * (f.drag > 1 ? 0.6 : 0.1));
    f.m.position.addScaledVector(f.v, dt);
    if (f.m.position.y <= 0.01) { f.m.position.y = 0.01; f.v.set(0, 0, 0); f.w.set(0, 0, 0); f.m.rotation.x = -Math.PI / 2; }
    else { f.m.rotation.x += f.w.x * dt; f.m.rotation.y += f.w.y * dt; f.m.rotation.z += f.w.z * dt; }
    if (f.life <= 0) { scene.remove(f.m); if (f.m.geometry !== billGeo) f.m.geometry.dispose(); flying.splice(i, 1); }
  }
  if (flying.length > 420) { const old = flying.splice(0, flying.length - 420); old.forEach(f => scene.remove(f.m)); }
}

/* ---------- 尺寸与可见性 ---------- */
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false); composer.setSize(w, h);
  camera.aspect = w / h; camera.fov = w / h < 1 ? 72 : 58; camera.updateProjectionMatrix();
  bloom.resolution.set(w / 2, h / 2);
}
new ResizeObserver(resize).observe(stage); resize();
let stageVisible = false;
new IntersectionObserver(es => { stageVisible = es[0].isIntersecting; if (stageVisible) clock.getDelta(); }, { threshold: 0.05 }).observe(stage);
new MutationObserver(() => { const loud = isLoud(); sirens.forEach(s => s.beacon.visible = loud); sirenOn(loud && stageVisible); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-mode'] });

/* ---------- 主循环 ---------- */
const clock = new THREE.Clock();
let t = 0;
updateHud();
function frame() {
  requestAnimationFrame(frame);
  if (!stageVisible) { if (sirenOsc) sirenOn(false); return; }
  const dt = Math.min(clock.getDelta(), 0.05); t += dt;
  const loud = isLoud();
  if (loud && actx && !sirenOsc) sirenOn(true);

  // 视角：跟随鼠标轻微转头，加呼吸晃动
  const tx = pointerInside ? mouse.x : Math.sin(t * 0.25) * 0.25, ty = pointerInside ? mouse.y : 0;
  look.x += (tx - look.x) * Math.min(dt * 3, 1); look.y += (ty - look.y) * Math.min(dt * 3, 1);
  const sway = reduceMotion ? 0 : 1;
  camera.position.set(CAM_BASE.x + look.x * 0.35 + Math.sin(t * 1.3) * 0.01 * sway, CAM_BASE.y + Math.sin(t * 2.1) * 0.008 * sway, CAM_BASE.z);
  camera.rotation.set(look.y * 0.22 + (Math.random() - 0.5) * shake * 0.02, -look.x * 0.42 + (Math.random() - 0.5) * shake * 0.02, 0, 'YXZ');
  shake = Math.max(0, shake - dt * 4);

  // 枪：指向准星，后坐力回弹
  ray.setFromCamera(mouse, camera);
  const aim = ray.ray.direction.clone().applyQuaternion(camera.quaternion.clone().invert());
  gun.rotation.y = Math.atan2(-aim.x, -aim.z) * 0.9;
  gun.rotation.x = Math.atan2(aim.y, Math.hypot(aim.x, aim.z)) * 0.9 + recoil * 0.35;
  gun.position.set(GUN_REST.x, GUN_REST.y + (reloading ? -0.12 : 0), GUN_REST.z + recoil * 0.06);
  recoil = Math.max(0, recoil - dt * 9);
  flashT = Math.max(0, flashT - dt * 22);
  flashMat.opacity = flashT; flashLight.intensity = flashT * 30;

  // 吊灯摆动
  for (const L of lamps) {
    L.vel += -L.swing * 9 * dt; L.vel *= 1 - dt * 0.6; L.swing += L.vel * dt;
    L.pivot.rotation.z = L.swing * 0.35;
    if (L.on && loud) L.light.intensity = L.base * (0.75 + Math.random() * 0.25 * (Math.random() < 0.04 ? 0 : 1));
  }
  // 摄像头扫视
  if (camState.alive) { camState.t += dt; camHead.rotation.y = 0.35 + Math.sin(camState.t * 0.6) * 0.45; ledMat.color.setHex(Math.sin(t * 6) > 0 ? 0xff2a2a : 0x550000); }
  // 警灯旋转
  sirens.forEach(s => {
    if (loud) { const a = t * 5 + s.phase; s.l.intensity = 60 * Math.max(0, Math.sin(a)) ; s.l.target.position.set(Math.cos(a) * 3, 1, Math.sin(a) * 3 - 1); }
    else s.l.intensity = 0;
  });
  scene.fog.color.setHex(loud ? 0x0d0507 : 0x05070a); scene.background.copy(scene.fog.color);
  vaultGlow.intensity = 16 + Math.sin(t * 2) * 2;

  // 宝石旋转
  for (const o of hittables) if (o.userData.spin && o.userData.kind === 'gem') o.rotation.y += dt * o.userData.spin;

  // 火花
  for (let i = 0; i < SPARKS; i++) {
    if (sparkLife[i] <= 0) continue;
    sparkLife[i] -= dt;
    sparkVel[i * 3 + 1] += G * dt * 0.6;
    sparkPos[i * 3] += sparkVel[i * 3] * dt; sparkPos[i * 3 + 1] += sparkVel[i * 3 + 1] * dt; sparkPos[i * 3 + 2] += sparkVel[i * 3 + 2] * dt;
    if (sparkLife[i] <= 0) sparkPos[i * 3 + 1] = -99;
  }
  sparkGeo.attributes.position.needsUpdate = true;

  stepBodies(dt);
  composer.render();
}
frame();
stage.classList.add('ready');
hud.hint.textContent = isSmall ? '点按画面开枪 · 打碎展柜、打灭吊灯、打掉摄像头' : '移动鼠标瞄准，点击开枪 · R 换弹 · 第一枪就会触发警报';
