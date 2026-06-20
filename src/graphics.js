import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { $, clamp, lerp, rnd, ri } from './util.js';
import { W, H, ZW, ZH, ZONES, zoneAt, BUILDINGS, INDUSTRIES, SKINS, FITS, NPCS, npcById, PLOTS } from './worldData.js';
import { ac, sBig, Music, sTap } from './audio.js';
import { S, QUESTS, saveGame } from './state.js';
import { toast, feed, learn, dialogOpen } from './dialog.js';
import { getSupabase } from './supabase.js';

/* =========================================================
   THREE.JS SCENE
   ========================================================= */
export let renderer, scene, camera, composer;
let sunLight, hemiLight, bloomPass;
export const playerPos = { x: 560, z: 1180 };
export let playerGroup = null, playerParts = null;
export const npcMeshes = {}; // id -> {group, parts}
export const buildingMeshes = {};
export let questMarker = null;
let streetLampMats = [];
export let cars = [];
let muralsAdded = false;
export let goldenHour = 0;
export function setGoldenHour(v) { goldenHour = v; }
export const particles = [];
// remote founders beyond the 24-avatar render cap: minimap dots only
export const remoteDots = [];
const PERSON_H = 16;

export const clouds = [];
let stars = null, sunDisc = null, moonDisc = null;
let skyDome = null, skyCanvas = null, skyTex = null, fillLight = null, lastSkyKey = '';
const flags = [], birds = [];
let fountainWater = null;

// Shared toon gradient — 3-step shadow/mid/lit bands for all cel-shaded surfaces
let toonGrad = null;
function toon(color, opts = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: toonGrad, ...opts });
}

/* =========================================================
   MINIMAP — 2D canvas overlay
   ========================================================= */
let minimapCV = null, minimapCTX = null;
const MM_W = 148, MM_H = 100; // display px
const MM_SCALE_X = MM_W / 2400, MM_SCALE_Y = MM_H / 1600;
const ZONE_COLORS_MM = ['#4A3C2E', '#363D47', '#253238', '#3E3020', '#252830', '#302A18'];
function initMinimap() {
  minimapCV = document.createElement('canvas');
  minimapCV.id = 'minimapCV';
  minimapCV.width = MM_W * 2; minimapCV.height = MM_H * 2;
  minimapCV.style.cssText = 'position:absolute;top:max(58px,calc(' +
    '10px + env(safe-area-inset-top) + 44px));right:10px;' +
    'width:' + MM_W + 'px;height:' + MM_H + 'px;z-index:11;' +
    'border-radius:10px;border:2px solid rgba(242,163,60,0.6);' +
    'background:rgba(20,18,15,0.78);image-rendering:pixelated';
  document.getElementById('hud').appendChild(minimapCV);
  minimapCTX = minimapCV.getContext('2d');
}
export function drawMinimap() {
  if (!minimapCV || !S) return;
  const x = minimapCTX, W2 = MM_W * 2, H2 = MM_H * 2;
  x.clearRect(0, 0, W2, H2);
  // zones
  ZONES.forEach((zo, i) => {
    x.fillStyle = S.stage < zo.unlock ? 'rgba(20,18,15,0.9)' : ZONE_COLORS_MM[i];
    x.fillRect(zo.x * MM_SCALE_X * 2, zo.y * MM_SCALE_Y * 2, 800 * MM_SCALE_X * 2, 800 * MM_SCALE_Y * 2);
    if (S.stage >= zo.unlock) {
      x.fillStyle = zo.accent + '55';
      x.fillRect(zo.x * MM_SCALE_X * 2 + 2, zo.y * MM_SCALE_Y * 2 + 2,
        800 * MM_SCALE_X * 2 - 4, 800 * MM_SCALE_Y * 2 - 4);
    }
  });
  // roads
  x.fillStyle = 'rgba(40,36,28,0.9)';
  x.fillRect(0, 800 * MM_SCALE_Y * 2, W2, 4); x.fillRect(800 * MM_SCALE_X * 2, 0, 4, H2); x.fillRect(1600 * MM_SCALE_X * 2, 0, 4, H2);
  // buildings as tiny dots
  x.fillStyle = 'rgba(245,239,227,0.22)';
  BUILDINGS.forEach(b => x.fillRect(b.x * MM_SCALE_X * 2, b.y * MM_SCALE_Y * 2,
    Math.max(b.w * MM_SCALE_X * 2, 3), Math.max(b.d * MM_SCALE_Y * 2, 3)));
  // founders commons plots
  PLOTS.forEach(p => {
    x.fillStyle = p.data ? 'rgba(232,192,100,0.7)' : 'rgba(100,90,60,0.35)';
    x.fillRect(p.x * MM_SCALE_X * 2, p.z * MM_SCALE_Y * 2, p.w * MM_SCALE_X * 2, p.d * MM_SCALE_Y * 2);
  });
  // key NPCs
  const npcCols = { marcus: '#F2A33C', redhawk: '#3FB8AF', rivera: '#5FA86B',
    park: '#5E7C99', chase: '#9AA4B5', rival: '#B6657F' };
  Object.entries(npcCols).forEach(([id, c]) => {
    const n = npcById(id); if (!n) return;
    x.fillStyle = c; x.beginPath();
    x.arc(n.x * MM_SCALE_X * 2, n.z * MM_SCALE_Y * 2, 5, 0, Math.PI * 2); x.fill();
  });
  // quest target pulsing ring
  const q = QUESTS[S ? S.quest : 0];
  if (q && q.target) {
    const t = q.target();
    if (t) {
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 260);
      x.strokeStyle = 'rgba(232,192,100,' + clamp(0.5 + pulse * 0.5, 0, 1) + ')';
      x.lineWidth = 3; x.beginPath();
      x.arc(t.x * MM_SCALE_X * 2, t.z * MM_SCALE_Y * 2, 6 + pulse * 4, 0, Math.PI * 2); x.stroke();
    }
  }
  // player — gold dot, larger
  x.fillStyle = '#E8C064'; x.beginPath();
  x.arc(playerPos.x * MM_SCALE_X * 2, playerPos.z * MM_SCALE_Y * 2, 7, 0, Math.PI * 2); x.fill();
  x.strokeStyle = '#fff'; x.lineWidth = 2; x.stroke();
  // remote founders beyond the render cap — minimap dots only
  if (remoteDots.length) {
    x.fillStyle = '#9FD8FF';
    remoteDots.forEach(d => {
      x.beginPath();
      x.arc(d.x * MM_SCALE_X * 2, d.z * MM_SCALE_Y * 2, 3, 0, Math.PI * 2); x.fill();
    });
  }
  // zone label in corner
  const pz = zoneAt(playerPos.x, playerPos.z);
  if (pz) { x.fillStyle = pz.accent; x.font = 'bold 16px Arial';
    x.fillText(pz.name, 6, H2 - 6); }
}


/* =========================================================
   FLOATING REWARD TEXT
   ========================================================= */
const floatPool = [];
export function floatText(x, y, z, text, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 80;
  const cx = c.getContext('2d');
  cx.font = 'bold 48px Arial'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.fillStyle = color || '#E8C064';
  // glow
  cx.shadowColor = color || '#E8C064'; cx.shadowBlur = 12;
  cx.fillText(text, 128, 40);
  const mat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c),
    transparent: true, depthTest: false });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(44, 14, 1);
  sp.position.set(x, y, z);
  scene.add(sp);
  floatPool.push({ sp, life: 1.6, vy: 28 });
  while (floatPool.length > 10) { const old = floatPool.shift(); scene.remove(old.sp); }
}
export function updateFloats(DT) {
  for (let i = floatPool.length - 1; i >= 0; i--) {
    const f = floatPool[i]; f.life -= DT;
    if (f.life <= 0) { scene.remove(f.sp); floatPool.splice(i, 1); continue; }
    f.sp.position.y += f.vy * DT; f.vy *= 0.95;
    f.sp.material.opacity = clamp(f.life, 0, 1);
  }
}


/* =========================================================
   TUTORIAL SYSTEM — gentle first-game arrows
   ========================================================= */
let tutCV = null, tutCTX = null;
function initTutorial() {
  tutCV = document.createElement('canvas');
  tutCV.id = 'tutCV';
  tutCV.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:9';
  document.getElementById('hud').appendChild(tutCV);
  tutCV.width = window.innerWidth; tutCV.height = window.innerHeight;
  window.addEventListener('resize', () => { tutCV.width = window.innerWidth; tutCV.height = window.innerHeight; });
}
export function drawTutorial() {
  if (!tutCV || !S || dialogOpen) return;
  const x = tutCTX = tutCTX || tutCV.getContext('2d');
  x.clearRect(0, 0, tutCV.width, tutCV.height);
  const q = QUESTS[S.quest];
  if (!q || !q.target || S.quest > 2) return; // only guide for quests 0-2
  const t = q.target(); if (!t) return;
  // world→screen projection
  const v3 = new THREE.Vector3(t.x, 18, t.z);
  v3.project(camera);
  const sx = (v3.x * 0.5 + 0.5) * tutCV.width, sy = (-v3.y * 0.5 + 0.5) * tutCV.height;
  const onScreen = v3.z < 1 && sx > 0 && sx < tutCV.width && sy > 0 && sy < tutCV.height;
  if (onScreen) {
    // pulsing ring on target
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 280);
    x.strokeStyle = 'rgba(232,192,100,' + (0.6 + pulse * 0.4) + ')';
    x.lineWidth = 3; x.beginPath(); x.arc(sx, sy, 18 + pulse * 8, 0, Math.PI * 2); x.stroke();
  } else {
    // off-screen: draw arrow at edge pointing toward target
    const cx = tutCV.width / 2, cy = tutCV.height / 2;
    const ang = Math.atan2(sy - cy, sx - cx);
    const edge = 70;
    const ax = clamp(cx + Math.cos(ang) * cx * 0.8, edge, tutCV.width - edge);
    const ay = clamp(cy + Math.sin(ang) * cy * 0.8, edge, tutCV.height - edge);
    x.save(); x.translate(ax, ay); x.rotate(ang + Math.PI / 2);
    x.fillStyle = 'rgba(232,192,100,0.88)';
    x.beginPath(); x.moveTo(0, -18); x.lineTo(11, 8); x.lineTo(-11, 8); x.closePath(); x.fill();
    x.restore();
    // label
    x.font = 'bold 13px Arial'; x.textAlign = 'center'; x.fillStyle = 'rgba(232,192,100,0.9)';
    x.fillText('Follow the arrow', ax, ay + 28);
  }
}


/* =========================================================
   HQ BUSINESS SIGN — 3D branded sign on the founder's lot
   ========================================================= */
let hqSign = null;
export function buildHQSign() {
  if (hqSign) { scene.remove(hqSign); hqSign = null; }
  if (!S || !S.biz) return;
  const b = BUILDINGS.find(b => b.id === 'lot');
  const ind = INDUSTRIES.find(i => i.id === S.biz.industry) || INDUSTRIES[INDUSTRIES.length - 1];
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const x = c.getContext('2d');
  // sign background
  x.fillStyle = '#' + ind.col.toString(16).padStart(6, '0');
  x.fillRect(0, 0, 512, 128);
  x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(0, 0, 512, 32);
  x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(0, 96, 512, 32);
  // business name
  x.font = 'bold 52px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = '#FFFFFF';
  x.shadowColor = 'rgba(0,0,0,0.6)'; x.shadowBlur = 8;
  x.fillText(S.biz.name.toUpperCase(), 256, 56);
  // industry strip
  x.font = '600 22px Arial'; x.fillStyle = 'rgba(255,255,255,0.75)'; x.shadowBlur = 0;
  x.fillText(ind.name, 256, 106);
  const mat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false });
  hqSign = new THREE.Sprite(mat);
  hqSign.scale.set(120, 30, 1);
  const h = BUILDINGS.find(b => b.id === 'lot');
  const cy = h.h3 * (S.hqLevel >= 2 ? 1.5 : 1) + 46;
  hqSign.position.set(b.x + b.w / 2, cy, b.y + b.d / 2);
  scene.add(hqSign);
}


/* =========================================================
   STAGE UNLOCK BANNER — DOM overlay celebration
   ========================================================= */
export function stageBanner(txt, sub) {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;left:50%;top:38%;transform:translate(-50%,-50%);' +
    'z-index:35;text-align:center;pointer-events:none;animation:stageFly 3.2s ease forwards';
  d.innerHTML = '<div style="font-family:Archivo,sans-serif;font-weight:900;font-size:clamp(28px,8vw,52px);' +
    'color:#E8C064;text-shadow:0 0 30px #E8C064,0 2px 0 #8a5a00;letter-spacing:.04em">' + txt + '</div>' +
    '<div style="font-family:Inter,sans-serif;font-size:clamp(13px,3vw,18px);color:#F5EFE3;' +
    'margin-top:8px;font-weight:600;letter-spacing:.1em;text-transform:uppercase">' + sub + '</div>';
  if (!document.getElementById('stageKF')) {
    const s = document.createElement('style');
    s.id = 'stageKF';
    s.textContent = '@keyframes stageFly{0%{opacity:0;transform:translate(-50%,-40%)}' +
      '15%{opacity:1;transform:translate(-50%,-50%)}' +
      '70%{opacity:1;transform:translate(-50%,-50%)}' +
      '100%{opacity:0;transform:translate(-50%,-60%)}}';
    document.head.appendChild(s);
  }
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 3400);
}


/* =========================================================
   STOREFRONT POINT LIGHTS — warm pools at ground level
   ========================================================= */
const streetLights = [];
function buildStreetLights() {
  // Warm orange pools in front of major buildings, zones 1 & 2
  [[255, 1020], [530, 1010], [940, 1020], [1300, 980]].forEach(([x, z]) => {
    const pl = new THREE.PointLight(0xFFB060, 0, 140, 2);
    pl.position.set(x, 14, z); pl.castShadow = false;
    scene.add(pl); streetLights.push(pl);
  });
}


/* =========================================================
   AUTO PERFORMANCE MODE
   ========================================================= */
let perfSamples = 0, perfTime = 0, perfChecked = false, lowPower = false;
function applyLowPower() {
  if (lowPower) return; lowPower = true;
  renderer.shadowMap.enabled = false;
  sunLight.castShadow = false;
  renderer.setPixelRatio(1);
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (composer) { composer.setPixelRatio(1); composer.setSize(window.innerWidth, window.innerHeight); }
  if (bloomPass) bloomPass.enabled = false;
  scene.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false;
    if (o.material && o.material.needsUpdate !== undefined) o.material.needsUpdate = true; } });
  streetLights.forEach(l => { l.intensity = 0; l.visible = false; });
  if (fillLight) fillLight.intensity = 0;
  toast('Performance mode on: smoother play on this device.', 'good');
}
export function perfSample(DT) {
  if (perfChecked || !S) return;
  perfSamples++; perfTime += DT;
  if (perfSamples >= 240 || perfTime > 6) {
    perfChecked = true;
    const avgFPS = perfSamples / perfTime;
    if (avgFPS < 38) applyLowPower();
  }
}


/* ---- music mute button ---- */
export function initMuteBtn() {
  const b = document.createElement('button');
  b.id = 'muteBtn';
  b.style.cssText = 'position:absolute;bottom:calc(98px + env(safe-area-inset-bottom));right:18px;' +
    'width:44px;height:44px;border-radius:14px;background:rgba(34,30,24,.85);' +
    'border:2px solid #4A4438;color:#F5EFE3;font-size:18px;pointer-events:auto;' +
    'display:flex;align-items:center;justify-content:center;z-index:11';
  b.innerHTML = (S && S.muted) ? '🔇' : '🎵';
  b.onclick = () => {
    ac(); Music.init();
    S.muted = !S.muted;
    Music.setEnabled(!S.muted);
    b.innerHTML = S.muted ? '🔇' : '🎵';
    sTap(); saveGame();
  };
  document.getElementById('hud').appendChild(b);
}

export function initThree() {
  renderer = new THREE.WebGLRenderer({ canvas: $('game'), antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputEncoding = THREE.sRGBEncoding;
  window._maxAniso = renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 4;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9bb8d4);
  scene.fog = new THREE.Fog(0x9bb8d4, 500, 2300);
  scene.environment = buildEnvMap();
  // toon gradient: 3 discrete bands (shadow / midtone / highlight)
  const tgc = document.createElement('canvas'); tgc.width = 3; tgc.height = 1;
  const tgx = tgc.getContext('2d');
  tgx.fillStyle = '#1a1a1a'; tgx.fillRect(0, 0, 1, 1);
  tgx.fillStyle = '#777777'; tgx.fillRect(1, 0, 1, 1);
  tgx.fillStyle = '#ffffff'; tgx.fillRect(2, 0, 1, 1);
  toonGrad = new THREE.CanvasTexture(tgc);
  toonGrad.minFilter = THREE.NearestFilter;
  toonGrad.magFilter = THREE.NearestFilter;
  camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 1, 4000);
  hemiLight = new THREE.HemisphereLight(0xFFE8C0, 0x3A2A1A, 0.55);
  scene.add(hemiLight);
  sunLight = new THREE.DirectionalLight(0xfff2dc, 1.15);
  sunLight.position.set(400, 600, 300);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.left = -420; sunLight.shadow.camera.right = 420;
  sunLight.shadow.camera.top = 420; sunLight.shadow.camera.bottom = -420;
  sunLight.shadow.camera.near = 50; sunLight.shadow.camera.far = 1600;
  sunLight.shadow.bias = -0.0008;
  scene.add(sunLight); scene.add(sunLight.target);
  // sun + moon discs
  sunDisc = new THREE.Mesh(new THREE.CircleGeometry(46, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff3c4, fog: false }));
  scene.add(sunDisc);
  moonDisc = new THREE.Mesh(new THREE.CircleGeometry(30, 24),
    new THREE.MeshBasicMaterial({ color: 0xdfe8ff, fog: false, transparent: true, opacity: 0.9 }));
  scene.add(moonDisc);
  // drifting clouds
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, fog: false, depthWrite: false });
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group();
    for (let p = 0; p < 3; p++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(rnd(40, 80), 8, 6), cloudMat);
      puff.position.set(rnd(-70, 70), rnd(-10, 10), rnd(-40, 40));
      puff.scale.y = 0.42; g.add(puff);
    }
    g.position.set(rnd(0, W), rnd(560, 720), rnd(0, H));
    g.userData.spd = rnd(3, 7);
    scene.add(g); clouds.push(g);
  }
  // stars
  const starGeo = new THREE.BufferGeometry();
  const pos = new Float32Array(900);
  for (let i = 0; i < 300; i++) {
    const a = rnd(0, Math.PI * 2), e = rnd(0.12, 1.4), r = 1900;
    pos[i * 3] = W / 2 + Math.cos(a) * Math.cos(e) * r;
    pos[i * 3 + 1] = Math.sin(e) * r * 0.7 + 150;
    pos[i * 3 + 2] = H / 2 + Math.sin(a) * Math.cos(e) * r;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 3.2, transparent: true, opacity: 0, fog: false, sizeAttenuation: false }));
  scene.add(stars);
  // gradient sky dome (replaces flat background as the visible sky)
  skyCanvas = document.createElement('canvas'); skyCanvas.width = 2; skyCanvas.height = 256;
  skyTex = new THREE.CanvasTexture(skyCanvas);
  paintSkyGrad('#6fa3d8', '#cfe3ee');
  skyDome = new THREE.Mesh(new THREE.SphereGeometry(2300, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false }));
  skyDome.renderOrder = -10;
  scene.add(skyDome);
  // cool fill light opposite the sun: makes characters pop
  fillLight = new THREE.DirectionalLight(0x9ab8ff, 0.22);
  scene.add(fillLight); scene.add(fillLight.target);
  // cinematic vignette overlay (pure CSS, zero GPU cost)
  if (!document.getElementById('vignette')) {
    const v = document.createElement('div');
    v.id = 'vignette';
    v.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:5;' +
      'background:radial-gradient(ellipse at center,transparent 52%,rgba(10,8,5,0.34) 100%)';
    document.body.appendChild(v);
  }
  // post-processing: ACES tonemapping (set above) + bloom for neon/emissive glow.
  // The final pass renders straight to screen, where renderer.outputEncoding
  // already applies sRGB encoding — no extra gamma-correction pass needed.
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.5, 0.45, 0.85);
  composer.addPass(bloomPass);
  buildCity();
  buildStreetLights();
  initMinimap();
  initTutorial();
  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    composer.setSize(window.innerWidth, window.innerHeight);
  });
}

/* ---- procedural sky/ground environment map for PBR reflections ----
   Built once from a small gradient sphere + lights via PMREMGenerator so
   MeshStandardMaterial surfaces (roads, water, glass, cars, characters)
   pick up soft sky and ground-color reflections. ---- */
function buildEnvMap() {
  const envScene = new THREE.Scene();
  const ec = document.createElement('canvas'); ec.width = 2; ec.height = 256;
  const ex = ec.getContext('2d');
  // dim sky-to-ground gradient: provides reflection color/shape without
  // adding significant extra exposure on top of the scene's direct lights
  const g = ex.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#2e3947'); g.addColorStop(0.5, '#3a4047');
  g.addColorStop(0.62, '#3a352c'); g.addColorStop(1, '#1a1814');
  ex.fillStyle = g; ex.fillRect(0, 0, 2, 256);
  const envSphere = new THREE.Mesh(new THREE.SphereGeometry(60, 16, 12),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(ec), side: THREE.BackSide }));
  envScene.add(envSphere);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(envScene, 0, 0.1, 1000);
  pmrem.dispose();
  return rt.texture;
}

/* ---- sky gradient helpers ---- */
function lerpHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(lerp((pa >> 16) & 255, (pb >> 16) & 255, t)),
    g = Math.round(lerp((pa >> 8) & 255, (pb >> 8) & 255, t)),
    bl = Math.round(lerp(pa & 255, pb & 255, t));
  return '#' + ((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0');
}
function paintSkyGrad(top, horizon) {
  if (!skyCanvas) return;
  const x = skyCanvas.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, top); g.addColorStop(0.62, horizon);
  g.addColorStop(1, horizon);
  x.fillStyle = g; x.fillRect(0, 0, 2, 256);
  skyTex.needsUpdate = true;
}
/* ---- cinematic vignette: cool edges deepen and a faint warm core
   bleeds in as the city's neon lights take over at dusk/night ---- */
let lastVignetteKey = '';
function updateVignette(t) {
  const key = t.toFixed(2);
  if (key === lastVignetteKey) return;
  lastVignetteKey = key;
  const v = document.getElementById('vignette');
  if (!v) return;
  const edgeA = lerp(0.30, 0.62, t).toFixed(2);
  const coreA = lerp(0, 0.10, t).toFixed(2);
  const edge = lerpHex('#0a0805', '#160e22', t);
  const er = parseInt(edge.slice(1, 3), 16), eg = parseInt(edge.slice(3, 5), 16), eb = parseInt(edge.slice(5, 7), 16);
  v.style.background = 'radial-gradient(ellipse at center, rgba(255,176,96,' + coreA + ') 0%, transparent 46%, rgba(' +
    er + ',' + eg + ',' + eb + ',' + edgeA + ') 100%)';
}

/* ---- procedural surface textures ---- */
function noiseCanvas(base, grain, size) {
  const c = document.createElement('canvas'); c.width = c.height = size || 128;
  const x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, c.width, c.height);
  const img = x.getImageData(0, 0, c.width, c.height), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * grain;
    d[i] = clamp(d[i] + n, 0, 255); d[i + 1] = clamp(d[i + 1] + n, 0, 255); d[i + 2] = clamp(d[i + 2] + n, 0, 255);
  }
  x.putImageData(img, 0, 0);
  return c;
}
function groundTexture(hexColor, kind) {
  const base = '#' + hexColor.toString(16).padStart(6, '0');
  const c = noiseCanvas(base, kind === 'asphalt' ? 22 : 34, 128);
  const x = c.getContext('2d');
  if (kind === 'grass') {
    x.strokeStyle = 'rgba(0,0,0,0.10)'; x.lineWidth = 1;
    for (let i = 0; i < 70; i++) { const px = rnd(0, 128), pz = rnd(0, 128);
      x.beginPath(); x.moveTo(px, pz); x.lineTo(px + rnd(-2, 2), pz - rnd(2, 5)); x.stroke(); }
  }
  if (kind === 'plaza') {
    x.strokeStyle = 'rgba(0,0,0,0.16)'; x.lineWidth = 1.5;
    for (let i = 0; i <= 128; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 128); x.stroke();
      x.beginPath(); x.moveTo(0, i); x.lineTo(128, i); x.stroke(); }
  }
  if (kind === 'asphalt') {
    x.strokeStyle = 'rgba(0,0,0,0.22)';
    for (let i = 0; i < 8; i++) { x.beginPath(); x.moveTo(rnd(0, 128), rnd(0, 128));
      x.lineTo(rnd(0, 128), rnd(0, 128)); x.lineWidth = 0.6; x.stroke(); }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = Math.min(window._maxAniso || 4, 8);
  return t;
}

function makeFacadeTexture(hex, litRatio) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 512;
  const x = c.getContext('2d');
  const col = '#' + hex.toString(16).padStart(6, '0');
  x.fillStyle = col; x.fillRect(0, 0, 256, 512);
  // wall grain
  const img = x.getImageData(0, 0, 256, 512), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 16;
    d[i] = clamp(d[i] + n, 0, 255); d[i + 1] = clamp(d[i + 1] + n, 0, 255); d[i + 2] = clamp(d[i + 2] + n, 0, 255); }
  x.putImageData(img, 0, 0);
  // vertical edge shading
  const g = x.createLinearGradient(0, 0, 256, 0);
  g.addColorStop(0, 'rgba(0,0,0,0.26)'); g.addColorStop(.5, 'rgba(255,255,255,0.06)'); g.addColorStop(1, 'rgba(0,0,0,0.30)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 512);
  // ground-floor storefront band
  x.fillStyle = 'rgba(15,16,20,0.85)'; x.fillRect(8, 448, 240, 56);
  x.fillStyle = 'rgba(150,190,210,0.30)'; x.fillRect(16, 454, 150, 44); // glass
  x.fillStyle = 'rgba(255,214,140,0.5)'; x.fillRect(176, 454, 64, 44);  // lit shop
  x.fillStyle = 'rgba(0,0,0,0.4)'; x.fillRect(8, 440, 240, 8);          // awning shadow
  // window grid with mullions
  for (let r = 0; r < 9; r++) for (let cl = 0; cl < 5; cl++) {
    const wx = 16 + cl * 48, wy = 18 + r * 46;
    x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(wx - 2, wy - 2, 36, 32); // frame
    const lit = Math.random() < litRatio;
    x.fillStyle = lit ? 'rgba(255,214,140,0.95)' : 'rgba(26,32,46,0.92)';
    x.fillRect(wx, wy, 32, 28);
    x.fillStyle = 'rgba(0,0,0,0.45)';
    x.fillRect(wx + 15, wy, 2, 28); x.fillRect(wx, wy + 13, 32, 2); // mullions
    if (!lit) { x.fillStyle = 'rgba(180,210,235,0.18)'; x.fillRect(wx, wy, 14, 12); } // sky reflection
  }
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = Math.min(window._maxAniso || 4, 8);
  return t;
}
export function makeLabelSprite(text, color) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96;
  drawLabel(c, text, color);
  const t = new THREE.CanvasTexture(c);
  const m = new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false });
  const sp = new THREE.Sprite(m);
  sp.scale.set(140, 26, 1);
  sp.userData.canvas = c;
  return sp;
}
function drawLabel(c, text, color) {
  const x = c.getContext('2d');
  x.clearRect(0, 0, 512, 96);
  x.font = '700 44px Archivo, Inter, sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = 'rgba(12,10,8,0.55)';
  const w = x.measureText(text).width + 44;
  roundRectPath(x, (512 - w) / 2, 14, w, 68, 16); x.fill();
  x.fillStyle = color || '#F5EFE3';
  x.fillText(text, 256, 50);
}
function roundRectPath(x, a, b, w, h, r) {
  x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r);
  x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath();
}
export function updateLabelSprite(sp, text, color) {
  drawLabel(sp.userData.canvas, text, color);
  sp.material.map.needsUpdate = true;
}

function buildCity() {
  // ground per zone (textured, receives shadows)
  ZONES.forEach(zo => {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(ZW, ZH), toon(zo.ground));
    g.rotation.x = -Math.PI / 2;
    g.position.set(zo.x + ZW / 2, 0, zo.y + ZH / 2);
    g.receiveShadow = true;
    scene.add(g); zo.groundMesh = g;
    // zone name sprite at center, high
    const sp = makeLabelSprite('ZONE ' + zo.id + ' · ' + zo.name.toUpperCase(), zo.accent);
    sp.position.set(zo.x + ZW / 2, 120, zo.y + ZH / 2);
    sp.scale.set(190, 34, 1);
    scene.add(sp); zo.labelSprite = sp;
    zo.lockSprite = null;
    if (zo.unlock > 1) {
      const ls = makeLabelSprite('UNLOCKS AT STAGE ' + zo.unlock, '#9A917F');
      ls.position.set(zo.x + ZW / 2, 96, zo.y + ZH / 2);
      ls.scale.set(150, 24, 1);
      scene.add(ls); zo.lockSprite = ls;
    }
  });
  // roads + sidewalks — flat cel-shaded colors
  const roadMatH = toon(0x181614);
  const roadMatV = toon(0x181614);
  const walkMatH = toon(0x5A5248);
  const walkMatV = toon(0x5A5248);
  const r1 = new THREE.Mesh(new THREE.PlaneGeometry(W, 70), roadMatH);
  r1.rotation.x = -Math.PI / 2; r1.position.set(W / 2, 0.4, 800); r1.receiveShadow = true; scene.add(r1);
  [765, 835].forEach(sz => {
    const sw = new THREE.Mesh(new THREE.PlaneGeometry(W, 16), walkMatH);
    sw.rotation.x = -Math.PI / 2; sw.position.set(W / 2, 0.55, sz < 800 ? sz - 9 : sz + 9);
    sw.receiveShadow = true; scene.add(sw);
  });
  [800, 1600].forEach(rx => {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(70, H), roadMatV);
    r.rotation.x = -Math.PI / 2; r.position.set(rx, 0.4, H / 2); r.receiveShadow = true; scene.add(r);
    [-44, 44].forEach(off => {
      const sw = new THREE.Mesh(new THREE.PlaneGeometry(16, H), walkMatV);
      sw.rotation.x = -Math.PI / 2; sw.position.set(rx + off, 0.55, H / 2);
      sw.receiveShadow = true; scene.add(sw);
    });
  });
  // crosswalk stripes at the two intersections
  const cwMat = new THREE.MeshBasicMaterial({ color: 0xd8d2c4 });
  [800, 1600].forEach(ix => {
    for (let s = -24; s <= 24; s += 12) {
      const c1 = new THREE.Mesh(new THREE.PlaneGeometry(7, 26), cwMat);
      c1.rotation.x = -Math.PI / 2; c1.position.set(ix + s, 0.62, 800 - 52); scene.add(c1);
      const c2 = new THREE.Mesh(new THREE.PlaneGeometry(7, 26), cwMat);
      c2.rotation.x = -Math.PI / 2; c2.position.set(ix + s, 0.62, 800 + 52); scene.add(c2);
      const c3 = new THREE.Mesh(new THREE.PlaneGeometry(26, 7), cwMat);
      c3.rotation.x = -Math.PI / 2; c3.position.set(ix - 52, 0.62, 800 + s); scene.add(c3);
      const c4 = new THREE.Mesh(new THREE.PlaneGeometry(26, 7), cwMat);
      c4.rotation.x = -Math.PI / 2; c4.position.set(ix + 52, 0.62, 800 + s); scene.add(c4);
    }
  });
  // lane dashes
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xF2A33C });
  for (let x = 30; x < W; x += 70) {
    const d = new THREE.Mesh(new THREE.PlaneGeometry(34, 4), dashMat);
    d.rotation.x = -Math.PI / 2; d.position.set(x, 0.6, 800); scene.add(d);
  }
  for (let z = 30; z < H; z += 70) {
    [800, 1600].forEach(rx => {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(4, 34), dashMat);
      d.rotation.x = -Math.PI / 2; d.position.set(rx, 0.6, z); scene.add(d);
    });
  }
  // buildings
  BUILDINGS.forEach(b => {
    const zo = ZONES.find(z => z.id === b.z);
    let h;
    if (b.small) h = 26;
    else if (b.id === 'tower') h = 520;
    else h = rnd(zo.bh[0], zo.bh[1]);
    b.h3 = h;
    const mat = toon(zo.buildingColor || b.c, { emissive: new THREE.Color(0xffc878), emissiveIntensity: 0 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(b.w, h, b.d), mat);
    mesh.position.set(b.x + b.w / 2, h / 2, b.y + b.d / 2);
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    // roof accent
    const roof = new THREE.Mesh(new THREE.BoxGeometry(b.w + 4, 4, b.d + 4),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(zo.accent) }));
    roof.position.set(b.x + b.w / 2, h + 2, b.y + b.d / 2);
    scene.add(roof);
    // storefront door + colored awning for street-level zones
    if (!b.small && !b.tower && (b.z === 1 || b.z === 2 || b.z === 4)) {
      const door = new THREE.Mesh(new THREE.PlaneGeometry(16, 26), toon(0x1c1813));
      door.position.set(b.x + b.w / 2, 13, b.y + b.d + 0.6);
      scene.add(door);
      const awnCols = [0xC96F4A, 0x3FB8AF, 0xE8C064, 0x5E7C99];
      const awn = new THREE.Mesh(new THREE.BoxGeometry(Math.min(b.w * 0.7, 120), 3, 16),
        toon(awnCols[(b.x + b.z) % 4]));
      awn.position.set(b.x + b.w / 2, 34, b.y + b.d + 8);
      awn.rotation.x = 0.28; awn.castShadow = true;
      scene.add(awn);
      // colorful neon storefront sign above the awning
      if (!b.lot && NEON_TEXT[b.id]) {
        const ncol = NEON_COLS[(b.x + b.y) % NEON_COLS.length];
        addNeonSign(b.x + b.w / 2, 44, b.y + b.d + 0.8, NEON_TEXT[b.id], ncol);
      }
    }
    // rooftop AC units (not on the small board or the tower)
    if (!b.small && !b.tower) {
      for (let u = 0; u < ri(1, 2); u++) {
        const acu = new THREE.Mesh(new THREE.BoxGeometry(rnd(14, 24), 8, rnd(12, 18)), toon(0x7e7a72));
        acu.position.set(b.x + rnd(20, b.w - 20), h + 8, b.y + rnd(16, b.d - 16));
        acu.castShadow = true;
        scene.add(acu); b.acu = acu;
      }
    }
    // Capital Row setback crowns: stacked narrower top for skyscraper feel
    if (b.z === 5) {
      const crownH = h * 0.34;
      const crown = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.62, crownH, b.d * 0.62), mat);
      crown.position.set(b.x + b.w / 2, h + crownH / 2, b.y + b.d / 2);
      crown.castShadow = true;
      scene.add(crown);
      roof.position.y = h + crownH + 2;
    }
    // label
    const sp = makeLabelSprite(b.label, '#F5EFE3');
    sp.position.set(b.x + b.w / 2, h + 22, b.y + b.d / 2);
    scene.add(sp);
    b.mesh = mesh; b.roof = roof; b.labelSprite = sp; b.mat = mat;
    buildingMeshes[b.id] = { mesh, roof, sp };
  });
  // empty lot starts flat: shrink it
  setHQEmpty();
  // tower starts as low construction (geometry is full 520, scaled down)
  const tw = BUILDINGS.find(b => b.id === 'tower');
  tw.mesh.scale.y = 60 / tw.h3; tw.mesh.position.y = 30;
  tw.roof.position.y = 64;
  tw.labelSprite.position.y = 86;
  // streetlamps along roads
  const poleMat = toon(0x3a352c);
  for (let x = 120; x < W; x += 260) {
    [770, 830].forEach(z => addLamp(x, z, poleMat));
  }
  for (let z = 120; z < H; z += 260) {
    [770, 830].forEach(dx => { addLamp(800 + (dx - 800), z, poleMat); });
    addLamp(1570, z, poleMat); addLamp(1630, z, poleMat);
  }
  // trees in zones 1 & 4
  [1, 4].forEach(zid => {
    const zo = ZONES.find(z => z.id === zid);
    for (let i = 0; i < 10; i++) addTree(zo.x + rnd(60, ZW - 60), zo.y + rnd(60, ZH - 60));
  });
  // cars
  const carCols = [0xC96F4A, 0x5E7C99, 0xD9D2C0, 0x3FB8AF];
  for (let i = 0; i < 5; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(26, 8, 13), toon(carCols[i % carCols.length]));
    body.position.y = 7;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(13, 6, 11), toon(0x222831));
    cab.position.set(-1, 13, 0);
    body.castShadow = true; cab.castShadow = true;
    g.add(body, cab);
    scene.add(g);
    const horiz = i % 2 === 0;
    cars.push({ g, horiz, p: rnd(0, 1), spd: rnd(0.018, 0.03) * (Math.random() < .5 ? 1 : -1),
      lane: horiz ? (Math.random() < .5 ? 786 : 814) : (Math.random() < .5 ? 786 : 814) + (i > 2 ? 800 : 0) });
  }
  // quest marker
  questMarker = new THREE.Mesh(new THREE.ConeGeometry(9, 20, 4),
    new THREE.MeshBasicMaterial({ color: 0xE8C064 }));
  questMarker.rotation.x = Math.PI;
  scene.add(questMarker);
  // the market goose (city legend)
  buildGoose();
  // founders commons plots
  buildPlots();
  // street furniture, stalls, fountain, flags, birds
  buildProps();
  // player + npcs
  playerGroup = makePerson(SKINS[2], FITS[0]); scene.add(playerGroup.group);
  playerParts = playerGroup;
}
export let goose = null;
function buildGoose() {
  const g = new THREE.Group();
  const white = toon(0xf2efe6);
  const body = new THREE.Mesh(new THREE.SphereGeometry(5, 10, 8), white);
  body.position.y = 6; body.scale.set(1.25, 1, 0.9);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 8, 8), white);
  neck.position.set(4.5, 11, 0); neck.rotation.z = -0.3;
  const head = new THREE.Mesh(new THREE.SphereGeometry(2.4, 8, 8), white);
  head.position.set(6.2, 15.2, 0);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(1.2, 3.4, 6),
    toon(0xe8862c));
  beak.rotation.z = -Math.PI / 2; beak.position.set(9.2, 15.2, 0);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.6, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0x111111 }));
  eye.position.set(6.8, 16, 1.6);
  g.add(body, neck, head, beak, eye);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  scene.add(g);
  goose = { g, x: 1050, z: 1030, tx: 1050, tz: 1030, wait: 1, spd: 46, dash: 0, honked: 0 };
}
export function gooseDash() { if (goose) { goose.dash = 4; } }

/* =========================================================
   FOUNDERS COMMONS - shared co-op town (Zone 6)
   Plots claimed here are stored in Supabase, keyed by the
   founder's Town Code: every founder using the same code
   sees the same town. Build it together.
   ========================================================= */
export let townTalentBonus = 0, fameCache = [];
let townDailyChallenge = null;
export function getTownDailyChallenge() { return townDailyChallenge; }
let currentTownId = null, currentTownCode = null;

async function resolveTownId(sb) {
  if (!S || !S.townCode) return null;
  if (currentTownId && currentTownCode === S.townCode) return currentTownId;
  currentTownCode = S.townCode;
  currentTownId = null;
  try {
    const { data } = await sb.from('towns').select('id').eq('code', S.townCode).maybeSingle();
    if (data) { currentTownId = data.id; return currentTownId; }
    const { data: created } = await sb.from('towns').insert({ code: S.townCode, name: S.townCode }).select('id').single();
    if (created) currentTownId = created.id;
  } catch (e) {}
  return currentTownId;
}

function buildPlots() {
  PLOTS.forEach(p => {
    const pad = new THREE.Mesh(new THREE.BoxGeometry(p.w, 2, p.d), toon(0x4a452f));
    pad.position.set(p.x + p.w / 2, 1, p.z + p.d / 2); pad.receiveShadow = true;
    scene.add(pad); p.pad = pad;
    const sp = makeLabelSprite('OPEN PLOT · Founders Commons', '#9A917F');
    sp.scale.set(120, 20, 1); sp.position.set(p.x + p.w / 2, 26, p.z + p.d / 2);
    scene.add(sp); p.sp = sp;
  });
}
export async function loadTown() {
  let town = { plots: {} };
  const sb = getSupabase();
  if (sb && S && S.townCode) {
    try {
      const townId = await resolveTownId(sb);
      if (townId) {
        const { data } = await sb.from('plots').select('*').eq('town_id', townId);
        (data || []).forEach(row => {
          town.plots[row.plot_index] = { name: row.founder_name, biz: row.biz_name, industry: row.industry, talent: row.talent };
        });
        // Fetch teacher's Hustle of the Day override
        try {
          const { data: tr } = await sb.from('towns').select('daily_challenge').eq('id', townId).maybeSingle();
          townDailyChallenge = (tr && tr.daily_challenge) ? tr.daily_challenge : null;
        } catch (e) {}
      }
    } catch (e) {}
  }
  renderTown(town);
  // Hall of Fame is global — show top 20 fastest to Sovereignty across all towns
  if (sb) {
    try {
      const { data: fameData } = await sb.from('fame').select('*').order('day_achieved', { ascending: true }).limit(20);
      fameCache = (fameData || []).map(f => ({ name: f.founder_name, biz: f.biz_name, day: f.day_achieved }));
    } catch (e) {}
  }
}

let plotsChannel = null;
export function subscribeTownPlots() {
  const sb = getSupabase();
  if (!sb || !S || !S.townCode) return;
  if (plotsChannel) { try { sb.removeChannel(plotsChannel); } catch (e) {} }
  plotsChannel = sb.channel('db-plots:' + S.townCode)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'plots' }, (payload) => {
      const row = payload.new;
      if (row.town_id !== currentTownId) return;
      const entry = { name: row.founder_name, biz: row.biz_name, industry: row.industry, talent: row.talent };
      const plotsMap = {};
      PLOTS.forEach(p => { if (p.data) plotsMap[p.idx] = p.data; });
      plotsMap[row.plot_index] = entry;
      renderTown({ plots: plotsMap });
      if (S && S.founder && row.founder_name !== S.founder.name)
        toast('<b>' + row.founder_name + '</b> built in Founders Commons as a ' + row.talent + '!', 'gold');
    })
    .subscribe();
}
export function unsubscribeTownPlots() {
  const sb = getSupabase();
  if (plotsChannel && sb) { try { sb.removeChannel(plotsChannel); } catch (e) {} plotsChannel = null; }
}
function renderTown(town) {
  const talents = new Set();
  PLOTS.forEach(p => {
    const d = town.plots[p.idx];
    p.data = d || null;
    if (d) talents.add(d.talent);
    if (d && !p.mesh) {
      const ind = INDUSTRIES.find(i => i.id === d.industry) || INDUSTRIES[INDUSTRIES.length - 1];
      const h = 70 + ((d.name || '').length % 5) * 14;
      const m = new THREE.Mesh(new THREE.BoxGeometry(p.w - 14, h, p.d - 14),
        toon(ind.col, { emissive: new THREE.Color(0xffc878), emissiveIntensity: 0 }));
      m.position.set(p.x + p.w / 2, h / 2 + 2, p.z + p.d / 2);
      m.castShadow = true; scene.add(m); p.mesh = m; p.h = h;
      const roof = new THREE.Mesh(new THREE.BoxGeometry(p.w - 10, 4, p.d - 10),
        new THREE.MeshBasicMaterial({ color: ind.col }));
      roof.position.set(p.x + p.w / 2, h + 4, p.z + p.d / 2); scene.add(roof); p.roof = roof;
      updateLabelSprite(p.sp, d.name + ' · ' + d.biz, '#E8C064');
      p.sp.position.y = h + 22; p.sp.scale.set(150, 24, 1);
    }
    if (d && p.mesh && S) p.mesh.material.emissiveIntensity = 0; // sky pass will set
  });
  townTalentBonus = Math.min(talents.size, 7) * 0.01;
}
export async function claimPlot(p, talent) {
  const entry = { name: S.founder.name, biz: S.biz.name, industry: S.biz.industry, talent, ts: Date.now() };
  const sb = getSupabase();
  try {
    if (sb && S.townCode) {
      const townId = await resolveTownId(sb);
      if (!townId) { toast('The town ledger is busy. Try again in a moment.', 'bad'); return; }
      const { data: existing } = await sb.from('plots').select('plot_index').eq('town_id', townId).eq('plot_index', p.idx).maybeSingle();
      if (existing) { toast('Another founder just claimed that plot. Pick a different one.', 'bad'); await loadTown(); return; }
      const { error } = await sb.from('plots').insert({ town_id: townId, plot_index: p.idx,
        founder_name: entry.name, biz_name: entry.biz, industry: entry.industry, talent });
      if (error) { toast('The town ledger is busy. Try again in a moment.', 'bad'); return; }
      await loadTown();
    } else {
      renderTown({ plots: { [p.idx]: entry } });
    }
    S.townPlot = p.idx; S.talent = talent;
    sBig(); spawnBurst(p.x + p.w / 2, 40, p.z + p.d / 2, 0xE8C064);
    feed('You claimed a plot in Founders Commons as a ' + talent + '. Every founder in this city can see it.');
    toast('<b>Plot claimed.</b> Your ' + talent + ' talent strengthens the whole town: every distinct talent adds +1% revenue for all members.', 'gold');
    learn('Collective Ownership', 'A town where every founder brings a different talent grows faster than any founder alone.');
    saveGame();
  } catch (e) { toast('The town ledger is busy. Try again in a moment.', 'bad'); }
}
export async function recordFame() {
  const sb = getSupabase();
  if (!sb || !S || !S.townCode) return;
  try {
    const townId = await resolveTownId(sb);
    if (!townId) return;
    await sb.from('fame').insert({
      town_id: townId,
      founder_name: S.founder.name,
      biz_name: S.biz.name,
      industry: S.biz.industry,
      day_achieved: S.day
    });
    // Reload global Hall of Fame after recording
    const { data } = await sb.from('fame').select('*').order('day_achieved', { ascending: true }).limit(20);
    fameCache = (data || []).map(f => ({ name: f.founder_name, biz: f.biz_name, day: f.day_achieved }));
  } catch (e) {}
}

let lampGlows = [];
// ground-level glow pools (wet-pavement reflections) and neon sign halos —
// opacity driven by night/dusk progress in updateSky()
const groundGlows = [];
const neonGlows = [];
let _glowTex = null;
function glowTexture() {
  if (_glowTex) return _glowTex;
  const gc = document.createElement('canvas'); gc.width = gc.height = 64;
  const gx = gc.getContext('2d');
  const grad = gx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.4)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  gx.fillStyle = grad; gx.fillRect(0, 0, 64, 64);
  _glowTex = new THREE.CanvasTexture(gc);
  return _glowTex;
}
// colorful neon storefront signage — text + palette per building id
const NEON_COLS = [0xFF3B6E, 0x3FE0FF, 0xFFD23F, 0x4CFF8F, 0xFF9A3F, 0xB14CFF];
const NEON_TEXT = {
  corner: 'OPEN', community: 'EVENTS', bank1: 'BANK', market: 'MARKET',
  adagency: 'ADS', lawoffice: 'LAW', cowork: 'CO-WORK',
  council: 'COUNCIL', cmarket: 'MARKET', language: 'LEARN', clinic: 'CLINIC'
};
function neonSignTexture(text, colHex) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 96;
  const x = c.getContext('2d');
  const col = '#' + colHex.toString(16).padStart(6, '0');
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = "bold 44px Arial, sans-serif";
  x.shadowColor = col; x.shadowBlur = 22;
  x.fillStyle = col; x.fillText(text, 128, 50);
  x.shadowBlur = 6;
  x.fillStyle = '#fff'; x.fillText(text, 128, 50);
  return new THREE.CanvasTexture(c);
}
function addNeonSign(x, y, z, text, colHex) {
  const w = 14 + text.length * 5.6;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.375),
    new THREE.MeshBasicMaterial({ map: neonSignTexture(text, colHex), transparent: true, depthWrite: false, fog: false }));
  sign.position.set(x, y, z);
  scene.add(sign);
  // additive glow halo behind the sign — bleeds light like neon at dusk/night
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color: colHex, transparent: true, depthWrite: false,
    opacity: 0, blending: THREE.AdditiveBlending, fog: false }));
  glow.scale.set(w * 1.4, w * 1.4 * 0.55, 1);
  glow.position.set(x, y, z + 0.3);
  scene.add(glow);
  neonGlows.push(glow.material);
  // soft pool of the sign's color reflected on the ground below
  const refl = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.1, w * 1.8),
    new THREE.MeshBasicMaterial({ map: glowTexture(), color: colHex, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  refl.rotation.x = -Math.PI / 2; refl.position.set(x, 0.66, z + w * 0.5);
  scene.add(refl);
  groundGlows.push(refl.material);
}
function addLamp(x, z, poleMat) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 30, 6), poleMat);
  pole.position.set(x, 15, z); pole.castShadow = true;
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0x554a30 });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(3.2, 8, 8), bulbMat);
  bulb.position.set(x, 31, z);
  // warm glow halo (sprite)
  const gc = document.createElement('canvas'); gc.width = gc.height = 64;
  const gx = gc.getContext('2d');
  const grad = gx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,208,128,0.9)'); grad.addColorStop(1, 'rgba(255,208,128,0)');
  gx.fillStyle = grad; gx.fillRect(0, 0, 64, 64);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(gc), transparent: true, opacity: 0, depthWrite: false }));
  glow.scale.set(42, 42, 1); glow.position.set(x, 31, z);
  scene.add(pole, bulb, glow);
  streetLampMats.push(bulbMat); lampGlows.push(glow.material);
  // warm reflection pool on the wet pavement below the lamp
  const refl = new THREE.Mesh(new THREE.PlaneGeometry(20, 56),
    new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0xFFC878, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  refl.rotation.x = -Math.PI / 2; refl.position.set(x, 0.66, z);
  scene.add(refl);
  groundGlows.push(refl.material);
}
function addTree(x, z) {
  const s = rnd(0.8, 1.3);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(2.2 * s, 3 * s, 15 * s, 6), toon(0x5a4630));
  trunk.position.set(x, 7.5 * s, z); trunk.castShadow = true;
  scene.add(trunk);
  // clustered canopy: 3 spheres, slight hue variance per tree
  const greens = [0x4e6b3a, 0x5a7a42, 0x46613a, 0x6b8248];
  const base = greens[ri(0, greens.length - 1)];
  [[0, 21, 0, 11], [6, 17, 3, 7.5], [-5, 18, -3, 8]].forEach(([ox, oy, oz, r]) => {
    const c = new THREE.Mesh(new THREE.SphereGeometry(r * s, 7, 7), toon(base));
    c.position.set(x + ox * s, oy * s, z + oz * s); c.castShadow = true;
    scene.add(c);
  });
}
function addBush(x, z) {
  const b = new THREE.Mesh(new THREE.SphereGeometry(rnd(4, 7), 6, 6), toon(0x55703e));
  b.position.set(x, 3.5, z); b.scale.y = 0.7;
  scene.add(b);
}
function buildProps() {
  const wood = toon(0x6a5436);
  const dark = toon(0x2a2620);
  // benches along the main horizontal road sidewalks
  [[300, 745], [640, 745], [1050, 745], [1380, 745], [300, 856], [980, 856], [1340, 856], [1900, 856]].forEach(([x, z]) => {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(26, 2.5, 8), wood);
    seat.position.set(x, 8, z); seat.castShadow = true;
    const back = new THREE.Mesh(new THREE.BoxGeometry(26, 8, 2), wood);
    back.position.set(x, 13, z + (z < 800 ? -3 : 3));
    const l1 = new THREE.Mesh(new THREE.BoxGeometry(2.5, 8, 7), dark); l1.position.set(x - 10, 4, z);
    const l2 = new THREE.Mesh(new THREE.BoxGeometry(2.5, 8, 7), dark); l2.position.set(x + 10, 4, z);
    scene.add(seat, back, l1, l2);
  });
  // fire hydrants — small, red, charming
  const red = toon(0xb33a2a);
  [[150, 860], [700, 742], [1180, 860], [1700, 742], [2080, 860]].forEach(([x, z]) => {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3, 8, 8), red);
    body.position.set(x, 4, z);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(2.7, 8, 6), red);
    cap.position.set(x, 8.4, z);
    scene.add(body, cap);
  });
  // trash cans
  const can = toon(0x3a4046);
  [[420, 742], [880, 858], [1480, 742], [1820, 858], [760, 1500], [1660, 300]].forEach(([x, z]) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(4, 3.4, 10, 8), can);
    c.position.set(x, 5, z); scene.add(c);
  });
  // planters with greenery — Main Street + Capital Row polish
  const stone = toon(0x7a756a);
  [[900, 920], [1200, 920], [1500, 920], [940, 250], [1180, 420], [1430, 250]].forEach(([x, z]) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(16, 8, 16), stone);
    p.position.set(x, 4, z);
    const g = new THREE.Mesh(new THREE.SphereGeometry(7, 7, 6),
      toon(0x5a7a42));
    g.position.set(x, 11, z); g.scale.y = 0.75;
    scene.add(p, g);
  });
  // bushes scattered through The Grind, Sovereign District, Skyline
  for (let i = 0; i < 8; i++) addBush(rnd(80, 720), rnd(880, 1540));
  for (let i = 0; i < 8; i++) addBush(rnd(80, 720), rnd(80, 720));
  for (let i = 0; i < 5; i++) addBush(rnd(1680, 2340), rnd(880, 1540));
  // MARKET STALLS — striped canopies in front of City Market
  const stripeCols = [[0xC96F4A, 0xF5EFE3], [0x3FB8AF, 0xF5EFE3], [0xE8C064, 0x14120F]];
  [[960, 1150], [1050, 1150], [1140, 1150]].forEach(([x, z], i) => {
    const post = toon(0x5a4a32);
    [[-14, -10], [14, -10], [-14, 10], [14, 10]].forEach(([ox, oz]) => {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 18, 5), post);
      p.position.set(x + ox, 9, z + oz); scene.add(p);
    });
    // striped canopy texture
    const cc = document.createElement('canvas'); cc.width = 64; cc.height = 32;
    const cx2 = cc.getContext('2d');
    const [a, b2] = stripeCols[i];
    for (let s2 = 0; s2 < 8; s2++) {
      cx2.fillStyle = '#' + (s2 % 2 ? a : b2).toString(16).padStart(6, '0');
      cx2.fillRect(s2 * 8, 0, 8, 32);
    }
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(36, 2.5, 26),
      new THREE.MeshToonMaterial({ map: new THREE.CanvasTexture(cc), gradientMap: toonGrad }));
    canopy.position.set(x, 19, z); canopy.rotation.x = 0.08; canopy.castShadow = true;
    scene.add(canopy);
    // crates of goods
    const crate = new THREE.Mesh(new THREE.BoxGeometry(10, 7, 8),
      toon(0x8a6a3a));
    crate.position.set(x + rnd(-8, 8), 3.5, z + rnd(-4, 4)); scene.add(crate);
  });
  // FLAGS on the Council Hall and the Tower
  [[255, 18, 140], [2000, 18, 1000]].forEach(([x, zoff, z], fi) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 56, 6),
      toon(0x9a958a));
    pole.position.set(x, 28, z - 6);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(24, 14),
      toon(fi === 0 ? 0x3FB8AF : 0xE8C064, { side: THREE.DoubleSide }));
    flag.position.set(x + 12, 48, z - 6);
    scene.add(pole, flag);
    flags.push({ m: flag, phase: rnd(0, 6) });
  });
  // FOUNTAIN PLAZA — Sovereign District centerpiece
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(30, 32, 8, 18),
    toon(0x8a8378));
  basin.position.set(395, 4, 345); basin.castShadow = true;
  // rippled water surface (rotating)
  const wc = document.createElement('canvas'); wc.width = wc.height = 128;
  const wx = wc.getContext('2d');
  wx.fillStyle = '#2E8B84'; wx.fillRect(0, 0, 128, 128);
  wx.strokeStyle = 'rgba(255,255,255,0.35)'; wx.lineWidth = 2;
  for (let r2 = 12; r2 < 70; r2 += 14) { wx.beginPath(); wx.arc(64, 64, r2, 0, Math.PI * 2); wx.stroke(); }
  fountainWater = new THREE.Mesh(new THREE.CircleGeometry(27, 20),
    new THREE.MeshToonMaterial({ map: new THREE.CanvasTexture(wc), transparent: true, opacity: 0.85,
      gradientMap: toonGrad, emissive: new THREE.Color(0x1a4f4a), emissiveIntensity: 0.25 }));
  fountainWater.rotation.x = -Math.PI / 2; fountainWater.position.set(395, 8.4, 345);
  const column = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4.4, 16, 8),
    toon(0x9a958a));
  column.position.set(395, 16, 345);
  const orb = new THREE.Mesh(new THREE.SphereGeometry(5, 10, 8),
    toon(0x3FB8AF, { emissive: 0x1a4f4a, emissiveIntensity: 0.5 }));
  orb.position.set(395, 27, 345);
  scene.add(basin, fountainWater, column, orb);
  // BIRDS — small flocks crossing the sky
  for (let i = 0; i < 3; i++) {
    const bc = document.createElement('canvas'); bc.width = 64; bc.height = 32;
    const bx = bc.getContext('2d');
    bx.strokeStyle = 'rgba(20,18,15,0.8)'; bx.lineWidth = 3; bx.lineCap = 'round';
    [[16, 16], [34, 12], [50, 18]].forEach(([px, py]) => {
      bx.beginPath(); bx.moveTo(px - 7, py); bx.quadraticCurveTo(px - 2, py - 6, px, py);
      bx.quadraticCurveTo(px + 2, py - 6, px + 7, py); bx.stroke();
    });
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(bc), transparent: true, depthWrite: false }));
    sp.scale.set(46, 23, 1);
    sp.position.set(rnd(0, W), rnd(220, 330), rnd(0, H));
    scene.add(sp);
    birds.push({ sp, vx: rnd(14, 26) * (Math.random() < 0.5 ? 1 : -1), vz: rnd(-6, 6) });
  }
}
export function addMurals() {
  if (muralsAdded) return; muralsAdded = true;
  const cols = [0x3FB8AF, 0xC96F4A, 0xE8C064, 0x8FA98B];
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(42, 22),
      new THREE.MeshBasicMaterial({ color: cols[i] }));
    m.position.set(150 + i * 160, 18, 700);
    scene.add(m);
  }
}
export function setHQEmpty() {
  const b = BUILDINGS.find(b => b.id === 'lot');
  const bm = buildingMeshes['lot'];
  bm.mesh.scale.y = 0.06; bm.mesh.position.y = b.h3 * 0.03;
  bm.roof.visible = false;
  bm.sp.position.y = 24;
  updateLabelSprite(bm.sp, 'Empty Lot · $1,500', '#9A917F');
}
export function setHQBuilt() {
  const b = BUILDINGS.find(b => b.id === 'lot');
  const bm = buildingMeshes['lot'];
  const sc = S.hqLevel >= 2 ? 1.5 : 1;
  bm.mesh.scale.y = sc; bm.mesh.position.y = b.h3 * sc / 2;
  bm.roof.visible = true; bm.roof.position.y = b.h3 * sc + 2;
  bm.sp.position.y = b.h3 * sc + 22;
  b.label = (S.biz ? S.biz.name : 'Your') + ' HQ';
  updateLabelSprite(bm.sp, b.label, '#F2A33C');
}

function drawSCFace(x) {
  // Sovereign City signature face: rounded-square eyes with spark highlights,
  // confident brows, open grin. Ownable, not the classic oval-and-arc.
  x.fillStyle = '#1a1a1a';
  // eyes: rounded squares
  roundRectPath(x, 32, 42, 20, 20, 6); x.fill();
  roundRectPath(x, 76, 42, 20, 20, 6); x.fill();
  // eye sparks
  x.fillStyle = '#ffffff';
  x.fillRect(38, 46, 6, 6); x.fillRect(82, 46, 6, 6);
  // brows: slight confident tilt
  x.fillStyle = '#1a1a1a';
  x.save(); x.translate(42, 34); x.rotate(-0.12); x.fillRect(-12, -3, 24, 6); x.restore();
  x.save(); x.translate(86, 34); x.rotate(0.12); x.fillRect(-12, -3, 24, 6); x.restore();
  // open grin with tongue of color
  x.beginPath(); x.moveTo(40, 78);
  x.quadraticCurveTo(64, 104, 88, 78);
  x.quadraticCurveTo(64, 88, 40, 78); x.closePath();
  x.fillStyle = '#1a1a1a'; x.fill();
  x.beginPath(); x.moveTo(50, 84); x.quadraticCurveTo(64, 96, 78, 84);
  x.quadraticCurveTo(64, 90, 50, 84); x.closePath();
  x.fillStyle = '#E8C064'; x.fill();
}
function makeFaceTexture(skinHex) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = skinHex; x.fillRect(0, 0, 128, 128);
  drawSCFace(x);
  const t = new THREE.CanvasTexture(c);
  t.userData = { canvas: c };
  return t;
}
export function paintFace(tex, skinHex) {
  const c = tex.userData.canvas, x = c.getContext('2d');
  x.fillStyle = skinHex; x.fillRect(0, 0, 128, 128);
  drawSCFace(x);
  tex.needsUpdate = true;
}
let charShadowTex = null;
function getCharShadowTexture() {
  if (charShadowTex) return charShadowTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const grad = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(0,0,0,0.9)');
  grad.addColorStop(0.7, 'rgba(0,0,0,0.35)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = grad; x.fillRect(0, 0, 64, 64);
  charShadowTex = new THREE.CanvasTexture(c);
  return charShadowTex;
}
function addOutline(mesh, thickness) {
  const outlineMat = new THREE.MeshBasicMaterial({ color: 0x0A0806, side: THREE.BackSide });
  const outline = new THREE.Mesh(mesh.geometry, outlineMat);
  outline.scale.multiplyScalar(1 + thickness);
  mesh.add(outline);
}
export function makePerson(skinHex, fitHex) {
  // Blocky R6-style avatar: box head + face decal, shirt torso, skin arms, dark pants
  const group = new THREE.Group();
  const skin = toon(new THREE.Color(skinHex));
  const fit = toon(new THREE.Color(fitHex));
  const pants = toon(0x1A2040);
  const shoeMat = toon(0xF0EBE0);
  // torso: 8 wide x 8 tall x 4 deep, top of legs at y=8
  const torso = new THREE.Mesh(new THREE.BoxGeometry(8, 8, 4), fit);
  torso.position.y = 12;
  addOutline(torso, 0.10);
  // head: box with face decal on front (+z)
  const faceTex = makeFaceTexture(skinHex);
  const faceMat = new THREE.MeshToonMaterial({ map: faceTex, gradientMap: toonGrad });
  const headMats = [skin, skin, skin, skin, faceMat, skin]; // +x,-x,+y,-y,+z,-z
  const head = new THREE.Mesh(new THREE.BoxGeometry(5.6, 5.6, 5.6), headMats);
  head.position.y = 19.2;
  addOutline(head, 0.10);
  // limbs swing from joints (pivot groups), Roblox-style
  function limb(mat, isLeg) {
    const pivot = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(3.4, 8, 3.4), mat);
    m.position.y = -4; pivot.add(m);
    addOutline(m, 0.10);
    if (isLeg) {
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(3.9, 2.6, 5.4), shoeMat);
      shoe.position.set(0, -8, 1);
      pivot.add(shoe);
    }
    return pivot;
  }
  const lArm = limb(skin); lArm.position.set(-5.7, 16, 0);
  const rArm = limb(skin); rArm.position.set(5.7, 16, 0);
  const lLeg = limb(pants, true); lLeg.position.set(-2.1, 8, 0);
  const rLeg = limb(pants, true); rLeg.position.set(2.1, 8, 0);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(7.5, 16),
    new THREE.MeshBasicMaterial({ map: getCharShadowTexture(), color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.3;
  // skateboard (hidden until skating)
  const board = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.BoxGeometry(13, 1.2, 5), toon(0xC96F4A));
  deck.position.y = 2.6;
  const wMat = toon(0xE8C064);
  [[-4.6, -1.8], [4.6, -1.8], [-4.6, 1.8], [4.6, 1.8]].forEach(([wx, wz]) => {
    const wh = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 1.2, 8), wMat);
    wh.rotation.x = Math.PI / 2; wh.position.set(wx, 1.1, wz); board.add(wh);
  });
  board.add(deck); board.visible = false; board.rotation.y = Math.PI / 2;
  // gold founder chain (Stage 3+ flex)
  const chain = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.55, 6, 14),
    toon(0xE8C064, { emissive: 0x6a5210, emissiveIntensity: 0.4 }));
  chain.position.set(0, 14.6, 2.1); chain.rotation.x = Math.PI / 2.4; chain.visible = false;
  group.add(torso, head, lArm, rArm, lLeg, rLeg, shadow, board, chain);
  group.traverse(o => { if (o.isMesh && o !== shadow) o.castShadow = true; });
  return { group, lLeg, rLeg, lArm, rArm, fitMat: fit, skinMat: skin, faceTex, board, chain };
}
export function buildNPCMeshes() {
  Object.values(npcMeshes).forEach(m => scene.remove(m.group));
  for (const k in npcMeshes) delete npcMeshes[k];
  NPCS.forEach(n => {
    const p = makePerson(SKINS[n.skin], n.fit);
    p.group.position.set(n.x, 0, n.z);
    scene.add(p.group);
    npcMeshes[n.id] = p;
    if (n.key) {
      const sp = makeLabelSprite(n.name, n.pc || '#F5EFE3');
      sp.scale.set(86, 16, 1);
      sp.position.y = 30;
      p.group.add(sp);
      // relation ring
      const ring = new THREE.Mesh(new THREE.RingGeometry(6.5, 8, 20),
        new THREE.MeshBasicMaterial({ color: 0xE8C064, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.5;
      p.group.add(ring); p.ring = ring;
    }
  });
}
const PARTICLE_CAP = 130;
export function trimParticles() {
  while (particles.length > PARTICLE_CAP) {
    const old = particles.shift(); scene.remove(old.m);
  }
}
export function updateProps(DT) {
  // flags flutter
  flags.forEach(f => {
    f.phase += DT * 5;
    f.m.rotation.y = Math.sin(f.phase) * 0.22;
    f.m.scale.x = 1 + Math.sin(f.phase * 1.7) * 0.08;
  });
  // fountain water spins, occasional sparkle drip
  if (fountainWater) {
    fountainWater.rotation.z += DT * 0.4;
    if (Math.random() < DT * 1.6) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2),
        new THREE.MeshBasicMaterial({ color: 0x7FDBD4, transparent: true }));
      m.position.set(395 + rnd(-4, 4), 28, 345 + rnd(-4, 4));
      scene.add(m);
      particles.push({ m, vx: rnd(-10, 10), vy: rnd(10, 26), vz: rnd(-10, 10), life: rnd(.5, .9) });
      trimParticles();
    }
  }
  // birds cross the sky
  birds.forEach(b2 => {
    b2.sp.position.x += b2.vx * DT; b2.sp.position.z += b2.vz * DT;
    if (b2.sp.position.x > W + 120) b2.sp.position.x = -120;
    if (b2.sp.position.x < -120) b2.sp.position.x = W + 120;
    if (b2.sp.position.z > H + 120) b2.sp.position.z = -120;
    if (b2.sp.position.z < -120) b2.sp.position.z = H + 120;
  });
}
export function spawnBurst(x, y, z, colHex) {
  for (let i = 0; i < 16; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 2.4),
      new THREE.MeshBasicMaterial({ color: colHex, transparent: true }));
    m.position.set(x, y, z);
    const a = rnd(0, Math.PI * 2);
    scene.add(m);
    particles.push({ m, vx: Math.cos(a) * rnd(20, 70), vy: rnd(40, 110), vz: Math.sin(a) * rnd(20, 70), life: rnd(.7, 1.3) });
  }
  trimParticles();
}

/* ---------------- DAY/NIGHT ---------------- */
const SKY_DAY = new THREE.Color(0x9bb8d4), SKY_DAWN = new THREE.Color(0xd9a06a),
  SKY_DUSK = new THREE.Color(0xd9633e), SKY_NIGHT = new THREE.Color(0x0c1322),
  SKY_GOLD = new THREE.Color(0xd9a44e);
const tmpC = new THREE.Color();
export function updateSky() {
  const h = S ? S.hour + S.min / 60 : 12;
  let sky, sun, hemi, night = false;
  if (S && (S.won || goldenHour > 0)) {
    sky = SKY_GOLD; sun = 1.0; hemi = 0.65;
  } else if (h >= 6 && h < 8) { tmpC.copy(SKY_DAWN).lerp(SKY_DAY, (h - 6) / 2); sky = tmpC; sun = lerp(.5, 1.15, (h - 6) / 2); hemi = .55; }
  else if (h >= 8 && h < 17) { sky = SKY_DAY; sun = 1.15; hemi = .55; }
  else if (h >= 17 && h < 20) { tmpC.copy(SKY_DAY).lerp(SKY_DUSK, (h - 17) / 3); sky = tmpC; sun = lerp(1.15, .4, (h - 17) / 3); hemi = .45; }
  else if (h >= 20 && h < 21) { tmpC.copy(SKY_DUSK).lerp(SKY_NIGHT, h - 20); sky = tmpC; sun = lerp(.4, .06, h - 20); hemi = .3; night = true; }
  else { sky = SKY_NIGHT; sun = .06; hemi = .22; night = true; }
  scene.background = sky instanceof THREE.Color ? sky : tmpC;
  scene.fog.color.copy(scene.background);
  sunLight.intensity = sun;
  hemiLight.intensity = hemi;
  // sun orbits around the PLAYER so the shadow frustum stays tight and useful
  const ang = (h / 24) * Math.PI * 2 - Math.PI / 2;
  const sdx = Math.cos(ang), sdy = Math.max(Math.sin(ang), 0.12);
  sunLight.position.set(playerPos.x + sdx * 700, sdy * 700, playerPos.z + 360);
  sunLight.target.position.set(playerPos.x, 0, playerPos.z);
  sunLight.target.updateMatrixWorld();
  // visible sun + moon discs on the sky
  sunDisc.position.set(playerPos.x + sdx * 1800, Math.sin(ang) * 1500 + 100, playerPos.z + 900);
  sunDisc.lookAt(camera.position);
  sunDisc.visible = Math.sin(ang) > -0.05 && !night;
  moonDisc.position.set(playerPos.x - sdx * 1800, -Math.sin(ang) * 1300 + 260, playerPos.z + 860);
  moonDisc.lookAt(camera.position);
  moonDisc.visible = night;
  // stars
  if (stars) stars.material.opacity = night ? 0.9 : (h >= 20 && h < 21 ? (h - 20) * 0.9 : 0);
  // windows + lamps + halos
  const winGlow = night ? 0.92 : (h >= 17 && h < 21 ? lerp(0, 0.92, (h - 17) / 4) : 0);
  BUILDINGS.forEach(b => { if (b.mat) b.mat.emissiveIntensity = winGlow; });
  PLOTS.forEach(p => { if (p.mesh) p.mesh.material.emissiveIntensity = winGlow; });
  const lampOn = night || h >= 19;
  streetLampMats.forEach(m => m.color.setHex(lampOn ? 0xFFD080 : 0x554a30));
  lampGlows.forEach(m => m.opacity = lampOn ? 0.92 : 0);
  streetLights.forEach(l => l.intensity = lampOn ? 1.7 : 0);
  // neon storefront signage: glow halos bleed light, wet pavement reflects it back
  const neonGlow = 0.15 + winGlow * 0.6;
  neonGlows.forEach(m => m.opacity = neonGlow);
  const groundGlow = winGlow * 0.4;
  groundGlows.forEach(m => m.opacity = groundGlow);
  updateVignette(winGlow / 0.92);
  // gradient sky dome colors per phase
  let topC, horC;
  if (S && (S.won || goldenHour > 0)) { topC = '#8a5a16'; horC = '#e8c064'; }
  else if (h >= 6 && h < 8) { const k = (h - 6) / 2; topC = lerpHex('#23306a', '#6fa3d8', k); horC = lerpHex('#e8956a', '#cfe3ee', k); }
  else if (h >= 8 && h < 17) { topC = '#6fa3d8'; horC = '#cfe3ee'; }
  else if (h >= 17 && h < 20) { const k = (h - 17) / 3; topC = lerpHex('#6fa3d8', '#2e1f4a', k); horC = lerpHex('#cfe3ee', '#ff7a4a', k); }
  else if (h >= 20 && h < 21) { const k = h - 20; topC = lerpHex('#2e1f4a', '#080c1f', k); horC = lerpHex('#ff7a4a', '#241a38', k); }
  else { topC = '#080c1f'; horC = '#241a38'; }
  const skKey = topC + horC;
  if (skKey !== lastSkyKey) { lastSkyKey = skKey; paintSkyGrad(topC, horC); }
  if (skyDome) skyDome.position.set(playerPos.x, 0, playerPos.z);
  scene.fog.color.set(horC); // horizon blends seamlessly into the dome
  if (fillLight) {
    fillLight.intensity = night ? 0.10 : 0.22;
    fillLight.position.set(playerPos.x - sdx * 500, 320, playerPos.z - 320);
    fillLight.target.position.set(playerPos.x, 0, playerPos.z);
    fillLight.target.updateMatrixWorld();
  }
}
