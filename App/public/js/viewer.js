import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MODELS } from './models.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function geometry(g) {
  const [k, a, b, c] = g;
  switch (k) {
    case 'box': return new RoundedBoxGeometry(a, b, c, 3, Math.min(a, b, c) * 0.12); // bevelled edges catch highlights
    case 'cyl': return new THREE.CylinderGeometry(a, b, c, 64);
    case 'sph': return new THREE.SphereGeometry(a, 48, 32);
    case 'cone': return new THREE.ConeGeometry(a, b, 64, 1, true);
    case 'torus': return new THREE.TorusGeometry(a, b, 24, 96);
    case 'text': return new THREE.PlaneGeometry(a, b);
    case 'dish': { const geo = new THREE.SphereGeometry(a, 96, 32, g[3] ?? 0, g[4] ?? Math.PI * 2, 0, b); geo.translate(0, -a, 0); return geo; }
    default: return new THREE.BoxGeometry(1, 1, 1);
  }
}

// Printed label: ['text', width, height, 'string'], colour = text colour. Drawn crisp on a canvas.
function textTexture(g, color) {
  const [, w, h, str] = g; const W = 1024, H = Math.max(32, Math.round(W * h / w));
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const x = cv.getContext('2d'); let fs = H * 0.78;
  x.font = `600 ${fs}px system-ui, -apple-system, Helvetica, Arial, sans-serif`;
  while (x.measureText(str).width > W * 0.96 && fs > 8) { fs -= 2; x.font = `600 ${fs}px system-ui, -apple-system, Helvetica, Arial, sans-serif`; }
  x.fillStyle = color || '#ffffff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(str, W / 2, H / 2);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

/**
 * Mount an exploded-view viewer.
 * opts: { model: key in MODELS } or { gltfUrl, name, steps }, startStep
 */
export function mountViewer(host, opts) {
  host.innerHTML = `
    <div class="viewer">
      <div class="viewer-stage">
        <div class="viewer-canvas"></div>
        <div class="viewer-hud">
          <label>Explode <input type="range" class="vx" min="0" max="1" step="0.01" value="0"></label>
          <button class="btn sm vlabels" title="Label every port, switch and connector">Callouts</button>
          <button class="btn sm vspin" title="Auto-rotate">Spin</button>
          <span class="vviews"><button class="btn sm vview" data-v="front" title="Look from the front">Front</button><button class="btn sm vview" data-v="side" title="Look from the side">Side</button><button class="btn sm vview" data-v="top" title="Look from above">Top</button></span>
          <button class="btn sm vreset" title="Reset camera">Reset</button>
          <button class="btn sm vpresent" title="Presentation mode: Next moves the camera to each repair step">Present</button>
          <button class="btn sm vfs" title="Full screen" aria-label="Full screen">⤢</button>
        </div>
        <div class="viewer-tip"></div>
        <div class="viewer-loading">Loading model…</div>
      </div>
      <aside class="viewer-side">
        <h3 class="vtitle"></h3>
        <p class="vnote muted"></p>
        <div class="vstep card"></div>
        <div class="vstep-nav"><button class="btn vprev">Prev</button><span class="vcount"></span><button class="btn primary vnext">Next</button></div>
        <button class="btn sm vreplay" hidden>Replay step</button>
        <div class="vofficial" hidden></div>
        <details class="vparts-wrap" open><summary>Parts</summary><ul class="vparts"></ul></details>
      </aside>
    </div>`;
  const $ = (s) => host.querySelector(s);
  const canvasHost = $('.viewer-canvas');
  const tip = $('.viewer-tip');
  const loading = $('.viewer-loading');

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  // Supersample: render at least 2x (up to 3x on retina) for crisp edges
  renderer.setPixelRatio(Math.min(Math.max(devicePixelRatio, 1) * 1.5, 3));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  canvasHost.appendChild(renderer.domElement);
  // Callout overlay: labels live in side columns with leader lines to their parts (laid out every frame)
  const callLayer = document.createElement('div'); callLayer.className = 'vcallouts';
  callLayer.innerHTML = '<svg class="vcall-lines" xmlns="http://www.w3.org/2000/svg"></svg>';
  canvasHost.appendChild(callLayer);
  const callSvg = callLayer.querySelector('svg');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 2000);
  // Image-based lighting for realistic reflections + brighter key/fill/rim lights
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.8));
  const sun = new THREE.DirectionalLight(0xffffff, 2.6); sun.position.set(5, 10, 7); scene.add(sun); scene.add(sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;
  const fill = new THREE.DirectionalLight(0xcfe0ff, 1.2); fill.position.set(-6, 4, -5); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 1.0); rim.position.set(0, 6, -10); scene.add(rim);
  const front = new THREE.DirectionalLight(0xffffff, 0.8); front.position.set(0, 2, 10); scene.add(front);
  const grid = new THREE.GridHelper(30, 30, 0x5a6b80, 0x2c3644); grid.material.opacity = 0.35; grid.material.transparent = true; scene.add(grid);
  // Invisible ground that only shows the shadows the model casts
  // Lit floor disc with a soft faded edge so cast shadows are visible on the dark backdrop
  const fade = document.createElement('canvas'); fade.width = fade.height = 256;
  { const g = fade.getContext('2d'), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, '#fff'); gr.addColorStop(0.55, '#fff'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); }
  const ground = new THREE.Mesh(new THREE.CircleGeometry(1, 128), new THREE.MeshStandardMaterial({
    color: 0x2f3a48, roughness: 0.9, metalness: 0, transparent: true, alphaMap: new THREE.CanvasTexture(fade), depthWrite: false, envMapIntensity: 0.4 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  const root = new THREE.Group(); scene.add(root);
  /** @type {{id,label,info,meshes:THREE.Mesh[],base:THREE.Vector3,off:THREE.Vector3,obj:THREE.Object3D,label2d:CSS2DObject}[]} */
  let parts = [];
  let steps = [], note = '', title = '';
  let stepIdx = 0, explode = 0, explodeTarget = 0, highlight = [], showLabels = false;
  let homePos = new THREE.Vector3(), homeTarget = new THREE.Vector3();
  let groundY = 0; // floor level of the assembled model; exploded parts never sink below it

  // How far a part moves when a repair step removes it (if different from the general explode)
  function seqOffset(p) {
    if (p.eseq) return new THREE.Vector3(...p.eseq);
    if (p.elseq) return new THREE.Vector3(...p.elseq).applyEuler(new THREE.Euler(...(p.r || [0, 0, 0])));
    return null;
  }

  function addLabel(part) {
    const div = document.createElement('div');
    div.className = 'vlabel'; div.textContent = part.label; div.style.display = 'none';
    callLayer.appendChild(div);
    part.label2d = { visible: false, element: div };
  }

  // Where on the part a leader line points: the part's centre, kept in its own frame so it follows explode/spin
  function setAnchors() {
    root.updateMatrixWorld(true);
    for (const p of parts) {
      const b = new THREE.Box3(); p.meshes.forEach((m) => b.expandByObject(m));
      p.anchorW0 = b.getCenter(new THREE.Vector3()); p.rad = b.getSize(new THREE.Vector3()).length() / 2;
      p.anchorLocal = p.obj.worldToLocal(p.anchorW0.clone());
    }
  }

  // Non-overlapping callout columns: left/right of the model, sorted by the part's screen height so lines never cross
  const _v = new THREE.Vector3();
  function layoutCallouts() {
    const W = canvasHost.clientWidth, H = canvasHost.clientHeight;
    const hud = host.querySelector('.viewer-hud');
    const bottom = H - (hud ? hud.offsetHeight + 16 : 12), top = 8, gap = 6, margin = 8;
    const items = [];
    for (const p of parts) {
      const el = p.label2d?.element; if (!el) continue;
      if (!p.label2d.visible || !p.anchorLocal) { if (el.style.display !== 'none') el.style.display = 'none'; continue; }
      _v.copy(p.anchorLocal); p.obj.localToWorld(_v); _v.project(camera);
      if (_v.z > 1 || _v.z < -1) { el.style.display = 'none'; continue; }
      if (el.style.display === 'none') el.style.display = '';
      if (el.dataset.t !== el.textContent) { el.dataset.t = el.textContent; el.style.maxWidth = Math.max(110, W * 0.38) + 'px'; p.lw = el.offsetWidth; p.lh = el.offsetHeight; }
      items.push({ p, el, ax: (_v.x + 1) / 2 * W, ay: (1 - _v.y) / 2 * H, w: p.lw, h: p.lh });
    }
    // split by side, then balance so neither column is badly overloaded
    // split around the middle of the labelled parts (not the screen), so lines head outward instead of across the model
    const mid = items.length ? items.map((i) => i.ax).sort((a, b) => a - b)[Math.floor(items.length / 2)] : W / 2;
    let L = items.filter((i) => i.ax < mid), R = items.filter((i) => i.ax >= mid);
    const byCentre = (a, b) => Math.abs(a.ax - mid) - Math.abs(b.ax - mid);
    while (L.length > R.length + 2) { L.sort(byCentre); R.push(L.shift()); }
    while (R.length > L.length + 2) { R.sort(byCentre); L.push(R.shift()); }
    let paths = '', dots = '';
    for (const [col, left] of [[L, true], [R, false]]) {
      col.sort((a, b) => a.ay - b.ay);
      const need = col.reduce((t, i) => t + i.h + gap, -gap);
      const g = need > bottom - top ? Math.max(1, gap - (need - (bottom - top)) / Math.max(1, col.length - 1)) : gap;
      let y = top;
      for (const i of col) { i.y = Math.max(i.ay - i.h / 2, y); y = i.y + i.h + g; }   // push down to clear the one above
      let limit = bottom;
      for (let k = col.length - 1; k >= 0; k--) { const i = col[k]; if (i.y + i.h > limit) i.y = limit - i.h; limit = i.y - g; } // pull up from the bottom
      for (const i of col) { if (i.y < top) i.y = top; }
      for (const i of col) {
        const x = left ? margin : W - margin - i.w;
        i.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(i.y)}px)`;
        i.el.classList.toggle('right', !left);
        const ex = left ? x + i.w : x, ey = i.y + i.h / 2, kx = left ? ex + 14 : ex - 14;
        paths += `M${ex},${ey} L${kx},${ey} L${i.ax.toFixed(1)},${i.ay.toFixed(1)} `;
        dots += `<circle cx="${i.ax.toFixed(1)}" cy="${i.ay.toFixed(1)}" r="3.5"/>`;
      }
    }
    callSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    callSvg.innerHTML = paths ? `<path d="${paths}"/>${dots}` : '';
  }

  // Optional manufacturer model shown in an overlay (loaded only on click, needs internet)
  function setupOfficial(o) {
    const box = $('.vofficial'); box.hidden = false;
    box.innerHTML = `<button class="btn vofficial-btn">View official ${esc(o.by)} 3D model</button>
      <p class="muted">The real unit, published by ${esc(o.by)}. Needs internet. Use it to check what the device looks like; use the repair model for exploded steps.</p>`;
    const stage = $('.viewer-stage');
    box.querySelector('.vofficial-btn').onclick = () => {
      if (stage.querySelector('.official-overlay')) return;
      const ov = document.createElement('div'); ov.className = 'official-overlay';
      const src = `https://sketchfab.com/models/${encodeURIComponent(o.uid)}/embed?autostart=1&ui_theme=dark&ui_infos=0&ui_watermark_link=0&dnt=1`;
      ov.innerHTML = navigator.onLine === false
        ? `<div class="official-msg">You're offline. The official ${esc(o.by)} model needs an internet connection.</div>`
        : `<iframe title="Official ${esc(o.by)} 3D model" src="${src}" allow="autoplay; fullscreen; xr-spatial-tracking" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
      ov.insertAdjacentHTML('beforeend', `<div class="official-bar"><span>Official ${esc(o.by)} model · <a href="${esc(o.page)}" target="_blank" rel="noopener noreferrer">open on Sketchfab ↗</a></span><button class="btn sm primary">Back to repair model</button></div>`);
      ov.querySelector('.official-bar button').onclick = () => ov.remove();
      stage.appendChild(ov);
    };
  }

  function buildProcedural(key) {
    const def = MODELS[key];
    if (!def) throw new Error('Unknown model ' + key);
    title = def.name; note = def.note || ''; steps = def.steps || [];
    if (def.official) setupOfficial(def.official);
    const byId = {};
    for (const p of def.parts) {
      const isText = p.g[0] === 'text';
      const mat = new THREE.MeshStandardMaterial({
        color: isText ? '#ffffff' : (p.c || '#999'), metalness: isText ? 0 : (p.m ?? 0.15), roughness: isText ? 0.8 : (p.rough ?? 0.45), envMapIntensity: 0.9,
        transparent: true, opacity: p.o ?? 1, map: isText ? textTexture(p.g, p.c) : null,
        side: ['dish', 'cone', 'text'].includes(p.g[0]) ? THREE.DoubleSide : THREE.FrontSide,
      });
      if (isText) mat.alphaTest = 0.05;
      mat.userData.baseOpacity = p.o ?? 1;
      const mesh = new THREE.Mesh(geometry(p.g), mat);
      mesh.castShadow = !isText && (p.o ?? 1) >= 0.6; mesh.receiveShadow = true;
      if (p.r) mesh.rotation.set(...p.r);
      // Detail meshes (port labels, LEDs, fins) ride along with a parent part: `of: '<partId>'`
      const parent = p.of && byId[p.of];
      if (parent) {
        mesh.position.set(...(p.p || [0, 0, 0])).sub(parent.obj.position);
        parent.obj.add(mesh); parent.meshes.push(mesh); mesh.userData.part = parent;
        continue;
      }
      mesh.position.set(...(p.p || [0, 0, 0]));
      const off = new THREE.Vector3(...(p.e || [0, 0, 0]));
      if (p.el) off.copy(new THREE.Vector3(...p.el).applyEuler(mesh.rotation));
      root.add(mesh);
      const part = { id: p.id, label: p.label || p.id, info: p.info || '', meshes: [mesh], obj: mesh, base: mesh.position.clone(), off, offSeq: seqOffset(p), def: p };
      mesh.userData.part = part; byId[p.id] = part;
      addLabel(part); parts.push(part);
    }
  }

  // Detailed Blender-built model (shared/client/models/<key>.glb). Nodes are named after part ids, so the
  // repair steps' highlights and explode offsets from models.js apply unchanged.
  async function buildDetailed(key) {
    const def = MODELS[key];
    if (!def) throw new Error('Unknown model ' + key);
    const gltf = await new GLTFLoader().loadAsync(`/models/${encodeURIComponent(key)}.glb`);
    const scene = gltf.scene; root.add(scene); scene.updateMatrixWorld(true);
    const want = def.parts.filter((p) => !p.of);
    const built = [];
    for (const p of want) {
      const node = scene.getObjectByName(p.id);
      if (!node) { root.remove(scene); throw new Error(`detailed model is missing part "${p.id}" – run npm run models`); }
      // Blender's export keeps parts under a rotated root node; re-parent onto our (unrotated) root while keeping
      // the exact world pose, so explode offsets from models.js act in true up/forward/sideways directions.
      root.attach(node);
      const meshes = [];
      node.traverse((o) => {
        if (!o.isMesh) return;
        o.material = o.material.clone(); o.material.transparent = true;
        o.material.userData.baseOpacity = o.material.opacity ?? 1;
        o.material.userData.baseEmissive = o.material.emissive ? o.material.emissive.getHex() : 0;
        o.material.userData.baseEmissiveI = o.material.emissiveIntensity ?? 1;
        o.castShadow = o.material.userData.baseOpacity >= 0.6; o.receiveShadow = true;
        meshes.push(o);
      });
      const off = new THREE.Vector3(...(p.e || [0, 0, 0]));
      // Part-local offsets use the part's design orientation from models.js. (The exported node's rotation
      // differs by the exporter's Z-up→Y-up 90° turn, which is baked into the mesh data instead.)
      if (p.el) off.copy(new THREE.Vector3(...p.el).applyEuler(new THREE.Euler(...(p.r || [0, 0, 0]))));
      built.push({ id: p.id, label: p.label || p.id, info: p.info || '', meshes, obj: node, base: node.position.clone(), off, offSeq: seqOffset(p), def: p });
    }
    title = def.name; note = def.note || ''; steps = def.steps || [];
    if (def.official) setupOfficial(def.official);
    for (const part of built) { part.meshes.forEach((m) => { m.userData.part = part; }); addLabel(part); parts.push(part); }
  }

  async function buildGltf(url) {
    // Files synced to the phone live at blob: URLs – map a .gltf's relative .bin/texture names onto them
    const manager = new THREE.LoadingManager();
    if (opts.files) manager.setURLModifier((u) => opts.files[decodeURIComponent(u.split(/[?#]/)[0].split('/').pop())] || u);
    const gltf = await new GLTFLoader(manager).loadAsync(url);
    const model = gltf.scene; root.add(model); model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3()).length() || 1;
    const center = box.getCenter(new THREE.Vector3());
    // Normalise scale so huge/tiny CAD exports frame nicely
    const s = 8 / size; model.scale.multiplyScalar(s); model.position.sub(center.clone().multiplyScalar(s)); model.updateMatrixWorld(true);
    const box2 = new THREE.Box3().setFromObject(model); const c2 = box2.getCenter(new THREE.Vector3());
    model.position.y -= box2.min.y; model.updateMatrixWorld(true);
    const wc = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());

    // Each top-level-ish node with meshes becomes a part (falls back to individual meshes)
    let candidates = [];
    model.traverse((o) => { if (o.isMesh) candidates.push(o); });
    const seen = new Map();
    for (const m of candidates) {
      // Group meshes by nearest named ancestor below the root so multi-material parts move together
      let node = m; while (node.parent && node.parent !== model && !node.name) node = node.parent;
      if (!seen.has(node)) seen.set(node, []);
      seen.get(node).push(m);
    }
    let i = 0;
    for (const [node, meshes] of seen) {
      const nb = new THREE.Box3().setFromObject(node); const nc = nb.getCenter(new THREE.Vector3());
      let dir = nc.clone().sub(wc); if (dir.lengthSq() < 1e-6) dir.set(0, 1, 0);
      const worldOff = dir.multiplyScalar(1.0);
      const parent = node.parent;
      const a = parent.worldToLocal(nc.clone()), b = parent.worldToLocal(nc.clone().add(worldOff));
      meshes.forEach((m) => {
        m.material = m.material.clone(); m.material.transparent = true;
        m.material.userData.baseOpacity = m.material.opacity ?? 1;
        m.castShadow = m.material.userData.baseOpacity >= 0.6; m.receiveShadow = true;
      });
      const part = { id: node.name || `part${i}`, label: (node.name || `Part ${i + 1}`).replace(/[_-]+/g, ' '), info: '', meshes, obj: node, base: node.position.clone(), off: b.sub(a) };
      meshes.forEach((m) => { m.userData.part = part; });
      addLabel(part); parts.push(part); i++;
    }
    title = opts.name || 'Uploaded model';
    note = 'Auto-exploded from the uploaded model: parts move away from the centre. Name meshes/nodes in your CAD export for clearer labels.';
    steps = opts.steps && opts.steps.length ? opts.steps : [{ t: 'Overview', d: 'Use the slider to explode the model. Click a part to identify it.', x: 0, h: [] }, { t: 'Fully exploded', d: 'All parts separated.', x: 1, h: [] }];
  }

  const lowest = (p) => { const b = new THREE.Box3(); p.meshes.forEach((m) => b.expandByObject(m)); return b.min.y; };
  // Raise the whole model while exploding so any part pushed downward still rests on the ground
  const liftFor = (e) => Math.max(0, groundY - Math.min(...parts.map((p) => p.minY0 + (p.minY1 - p.minY0) * (e ?? p.ex ?? 0))));

  function frame() {
    const box = new THREE.Box3();
    root.updateMatrixWorld(true);
    parts.forEach((p) => { p.minY0 = lowest(p); });
    groundY = Math.min(...parts.map((p) => p.minY0));
    parts.forEach((p) => { p.obj.position.copy(p.base).addScaledVector(p.off, 1); }); // frame the fully exploded state
    root.updateMatrixWorld(true);
    parts.forEach((p) => { p.minY1 = lowest(p); });
    root.position.y = liftFor(1); root.updateMatrixWorld(true); box.setFromObject(root);
    root.position.y = 0;
    parts.forEach((p) => p.obj.position.copy(p.base));
    root.updateMatrixWorld(true); const c0 = new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3());
    const c = box.getCenter(new THREE.Vector3()); const r = box.getSize(new THREE.Vector3()).length() / 2 || 5;
    homeTarget.copy(c).lerp(c0, 0.5); // aim between assembled and exploded layouts
    const dist = (r / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * (opts.gltfUrl ? 0.85 : 0.6);
    homePos.copy(homeTarget).add(new THREE.Vector3(0.6, 0.45, 0.75).normalize().multiplyScalar(dist));
    camera.position.copy(homePos); controls.target.copy(homeTarget);
    camera.near = r / 100; camera.far = r * 100; camera.updateProjectionMatrix();
    grid.position.y = groundY - 0.012; ground.position.y = groundY - 0.005; ground.scale.setScalar(r * 1.5);
    // Fit the shadow camera to the scene
    sun.position.copy(c).add(new THREE.Vector3(0.45, 1, 0.6).normalize().multiplyScalar(r * 3));
    sun.target.position.copy(c);
    const sc = sun.shadow.camera; sc.left = sc.bottom = -r * 1.3; sc.right = sc.top = r * 1.3; sc.near = r * 0.5; sc.far = r * 6; sc.updateProjectionMatrix();
  }

  const matches = (part, ids) => ids.some((h) => part.id === h || (part.id.startsWith(h) && /^\d+$/.test(part.id.slice(h.length))));

  function applyHighlight() {
    const on = highlight.length > 0;
    const labelled = new Set(); // one label per numbered group (lan0..lan7 -> "lan")
    for (const p of parts) {
      const hit = on && matches(p, highlight);
      for (const m of p.meshes) {
        const mat = m.material;
        // highlighted = orange glow; otherwise restore the part's own glow (status LEDs)
        if (mat.emissive) mat.emissive.set(hit ? 0xff8a00 : (mat.userData.baseEmissive ?? 0x000000));
        if (mat.emissive) mat.emissiveIntensity = hit ? 0.55 : (mat.userData.baseEmissive ? mat.userData.baseEmissiveI : 0);
        mat.opacity = on && !hit ? Math.min(0.18, mat.userData.baseOpacity) : mat.userData.baseOpacity;
        mat.depthWrite = !(on && !hit);
        m.castShadow = mat.userData.baseOpacity >= 0.6 && !(on && !hit);
      }
      const grp = p.id.replace(/\d+$/, '');
      const callable = !!p.def?.call;
      const want = showLabels ? (callable && (!on || hit)) || hit : hit;
      p.label2d.visible = want && !labelled.has(grp);
      if (p.label2d.visible) {
        labelled.add(grp);
        const name = typeof p.def?.call === 'string' ? p.def.call : p.label;
        // callout text is written for the whole group already; plain labels get '(all)' when they stand for a numbered set
        p.label2d.element.textContent = typeof p.def?.call === 'string' ? name : grp !== p.id && parts.some((q) => q !== p && q.id.replace(/\d+$/, '') === grp) ? name.replace(/\s*\d+$/, '') + ' (all)' : name;
      }
    }
    host.querySelectorAll('.vparts li').forEach((li) => li.classList.toggle('hit', on && matches(parts[+li.dataset.i], highlight)));
  }

  function showStep(i) {
    if (!steps.length) return;
    stepIdx = Math.max(0, Math.min(steps.length - 1, i));
    const s = steps[stepIdx];
    const stages = (s.seq || []).map((g) => (Array.isArray(g) ? { p: g } : g));
    $('.vstep').innerHTML = `<h4>${esc(s.t)}</h4><p>${esc(s.d)}</p>${stages.some((g) => g.t) ? `<ol class="vstages">${stages.map((g, k) => `<li data-k="${k}">${esc(g.t || '')}</li>`).join('')}</ol>` : ''}`;
    $('.vreplay').hidden = !stages.length;
    $('.vcount').textContent = `${stepIdx + 1} / ${steps.length}`;
    $('.vprev').disabled = stepIdx === 0; $('.vnext').disabled = stepIdx === steps.length - 1;
    explodeTarget = s.x ?? 0; $('.vx').value = explodeTarget;
    playStages(stages, s.x ?? 0);
    if (presenting) frameStep(s, stages);
    highlight = s.h || []; applyHighlight();
  }

  // Staged disassembly: parts in stage k start moving STAGE_MS * k after the step opens
  const STAGE_MS = 850;
  let stageList = [], stageT0 = 0;
  function playStages(stages, rest, fromZero = false) {
    stageList = stages; stageT0 = performance.now();
    for (const p of parts) {
      const k = stages.findIndex((g) => matches(p, g.p));
      p.tx = k >= 0 ? 1 : rest;
      p.startAt = k >= 0 ? stageT0 + k * STAGE_MS : stageT0;
      p.useSeq = k >= 0 && !!p.offSeq;
      if (fromZero && k >= 0) p.ex = 0;
    }
  }
  function setAll(v) { const now = performance.now(); stageList = []; for (const p of parts) { p.tx = v; p.startAt = now; p.useSeq = false; } host.querySelectorAll('.vstages li').forEach((li) => li.classList.remove('on', 'done')); }

  function renderPartsList() {
    $('.vparts').innerHTML = parts.map((p, i) => `<li data-i="${i}"><b>${esc(p.label)}</b>${p.info ? `<span>${esc(p.info)}</span>` : ''}</li>`).join('');
    $('.vparts').onclick = (e) => {
      const li = e.target.closest('li'); if (!li) return;
      const p = parts[+li.dataset.i];
      highlight = [p.id]; applyHighlight(); if (explodeTarget < 0.4) { explodeTarget = 0.6; $('.vx').value = 0.6; setAll(0.6); }
      tipFor(p);
    };
  }

  function tipFor(p) {
    tip.innerHTML = `<b>${esc(p.label)}</b>${p.info ? '<br>' + esc(p.info) : ''}`;
    tip.style.display = 'block';
  }

  // Interaction
  const ray = new THREE.Raycaster(); const ptr = new THREE.Vector2(); let downAt = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
    const r = renderer.domElement.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const hits = ray.intersectObjects(root.children, true).filter((h) => h.object.userData.part && h.object.material.opacity > 0.3);
    if (hits.length) { const p = hits[0].object.userData.part; highlight = [p.id]; applyHighlight(); tipFor(p); }
    else { tip.style.display = 'none'; highlight = steps[stepIdx]?.h || []; applyHighlight(); }
  });
  $('.vx').addEventListener('input', (e) => { explodeTarget = +e.target.value; setAll(explodeTarget); });
  $('.vreplay').onclick = () => { const s = steps[stepIdx]; playStages((s.seq || []).map((g) => (Array.isArray(g) ? { p: g } : g)), s.x ?? 0, true); };
  $('.vprev').onclick = () => showStep(stepIdx - 1);
  $('.vnext').onclick = () => showStep(stepIdx + 1);
  $('.vlabels').onclick = (e) => { showLabels = !showLabels; e.target.classList.toggle('on', showLabels); applyHighlight(); };
  $('.vspin').onclick = (e) => { controls.autoRotate = !controls.autoRotate; e.target.classList.toggle('on', controls.autoRotate); };
  $('.vreset').onclick = () => { camera.position.copy(homePos); controls.target.copy(homeTarget); };
  // ---------- Presentation mode: each step flies the camera to the parts it's about ----------
  let presenting = false, camAnim = null;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  function animateCam(toPos, toTarget, dur = 1500) {
    const fromTarget = controls.target.clone(), fromOff = camera.position.clone().sub(fromTarget);
    const toOff = toPos.clone().sub(toTarget);
    camAnim = { t0: performance.now(), dur, fromTarget, toTarget: toTarget.clone(), fromDir: fromOff.clone().normalize(), fromLen: fromOff.length(),
      rot: new THREE.Quaternion().setFromUnitVectors(fromOff.clone().normalize(), toOff.clone().normalize()), toLen: toOff.length() };
    controls.autoRotate = false; host.querySelector('.vspin')?.classList.remove('on');
  }
  function stepCamera(now) {
    if (!camAnim) return;
    const t = Math.min(1, (now - camAnim.t0) / camAnim.dur), e = ease(t);
    controls.target.lerpVectors(camAnim.fromTarget, camAnim.toTarget, e);
    const q = new THREE.Quaternion().slerp(camAnim.rot, e);                       // orbit round, not a straight cut
    const len = camAnim.fromLen + (camAnim.toLen - camAnim.fromLen) * e;
    camera.position.copy(controls.target).add(camAnim.fromDir.clone().applyQuaternion(q).multiplyScalar(len));
    if (t >= 1) camAnim = null;
  }
  controls.addEventListener('start', () => { camAnim = null; });            // grabbing the model hands control back to you
  function frameStep(s, stages) {
    const ids = [...(s.h || []), ...stages.flatMap((g) => g.p)];
    const hit = parts.filter((p) => p.anchorW0 && matches(p, ids));
    if (!hit.length || s.cam === 'home') { animateCam(homePos, homeTarget); return; }
    // frame where the parts start AND where they end up, so their motion stays in shot
    const pts = [], motion = new THREE.Vector3();
    for (const p of hit) {
      const mv = (p.useSeq ? p.offSeq : p.off).clone().multiplyScalar(p.tx ?? 0);
      pts.push({ v: p.anchorW0.clone(), r: p.rad }, { v: p.anchorW0.clone().add(mv), r: p.rad });
      motion.add(mv);
    }
    const c = pts.reduce((a, q) => a.add(q.v), new THREE.Vector3()).multiplyScalar(1 / pts.length);
    const r = Math.max(...pts.map((q) => q.v.distanceTo(c) + q.r), 0.05);
    const modelR = homePos.distanceTo(homeTarget);
    // look from the side the parts are on, keep the home 3/4 feel, and look across (not along) the way they move
    const dir = homePos.clone().sub(homeTarget).normalize();
    if (s.cam?.dir) dir.set(...s.cam.dir).normalize();
    else {
      // parts on one face of the unit (rear ports, front panel…): look square-on at that face, slightly from above
      const away = c.clone().sub(homeTarget); away.y = 0;
      if (away.length() > modelR * 0.04) { dir.multiplyScalar(0.35).addScaledVector(away.normalize(), 1); dir.y = 0.3; }
      if (motion.length() > 1e-4) { const m = motion.normalize(); dir.addScaledVector(m, -0.5 * dir.dot(m)); }
      dir.normalize(); if (dir.y < 0.22) { dir.y = 0.22; dir.normalize(); }
    }
    const fov = THREE.MathUtils.degToRad(camera.fov / 2), aspect = Math.min(1, camera.aspect);
    let dist = (r / Math.sin(fov)) * 1.25 / Math.pow(aspect, 0.65) * (s.cam?.zoom || 1);
    dist = Math.min(Math.max(dist, modelR * 0.34), modelR * 1.3);  // never so close you lose your bearings
    animateCam(c.clone().add(dir.multiplyScalar(dist)), c);
  }
  function setPresent(on) {
    presenting = on;
    host.querySelector('.vpresent').classList.toggle('on', on);
    viewerEl.classList.toggle('presenting', on);
    if (on) { if (!viewerEl.classList.contains('vfull')) setFull(true); showStep(stepIdx); }
    else { camAnim = null; }
  }

  // Full screen: the whole viewer (3D + repair steps) fills the screen; Escape or the button exits
  const viewerEl = host.querySelector('.viewer');
  const setFull = (on) => {
    viewerEl.classList.toggle('vfull', on);
    document.body.classList.toggle('noscroll', on || !!document.querySelector('.viewer.vfull, .topo-full'));
    const b = host.querySelector('.vfs'); b.textContent = on ? '✕' : '⤢'; b.title = on ? 'Exit full screen' : 'Full screen';
    if (!on && presenting) setPresent(false);
    requestAnimationFrame(resize);
  };
  host.querySelector('.vfs').onclick = () => setFull(!viewerEl.classList.contains('vfull'));
  host.querySelector('.vpresent').onclick = () => setPresent(!presenting);
  const onKey = (e) => {
    if (presenting && ['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); e.stopImmediatePropagation(); showStep(stepIdx + 1); return; }
    if (presenting && ['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); e.stopImmediatePropagation(); showStep(stepIdx - 1); return; }
    if (e.key === 'Escape' && viewerEl.classList.contains('vfull')) { e.preventDefault(); e.stopImmediatePropagation(); setFull(false); }
  };
  addEventListener('keydown', onKey, true);

  // Fixed viewpoints: same distance, looking at the model centre
  const VIEWS = { front: [0, 0.12, 1], side: [1, 0.12, 0], top: [0, 1, 0.0001] };
  host.querySelectorAll('.vview').forEach((b) => { b.onclick = () => {
    const dist = homePos.distanceTo(homeTarget);
    controls.target.copy(homeTarget);
    camera.position.copy(homeTarget).add(new THREE.Vector3(...VIEWS[b.dataset.v]).normalize().multiplyScalar(dist));
    controls.autoRotate = false; host.querySelector('.vspin')?.classList.remove('on');
  }; });

  function resize() {
    const w = canvasHost.clientWidth || 600, h = canvasHost.clientHeight || 400;
    renderer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize); ro.observe(canvasHost);

  let raf, alive = true;
  function tick() {
    if (!alive) return;
    raf = requestAnimationFrame(tick);
    const now = performance.now();
    for (const p of parts) {
      if (p.ex === undefined) { p.ex = 0; p.tx = p.tx ?? 0; p.q0 = p.obj.quaternion.clone(); }
      if (now >= (p.startAt || 0)) p.ex += ((p.tx ?? 0) - p.ex) * 0.11;
      p.obj.position.copy(p.base).addScaledVector(p.useSeq ? p.offSeq : p.off, p.ex);
      const d = p.def;
      if (d && (d.spin || d.tilt)) {
        const q = p.q0.clone();
        if (d.tilt) q.premultiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(d.tilt[0] * p.ex, d.tilt[1] * p.ex, d.tilt[2] * p.ex)));
        if (d.spin) { // unscrew about the screw's own axis (its design 'up')
          const axis = new THREE.Vector3(0, 1, 0).applyEuler(new THREE.Euler(...(d.r || [0, 0, 0])));
          q.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, -p.ex * Math.PI * 8));
        }
        p.obj.quaternion.copy(q);
      }
    }
    if (stageList.length) {
      const k = Math.floor((now - stageT0) / STAGE_MS);
      host.querySelectorAll('.vstages li').forEach((li) => { const i = +li.dataset.k; li.classList.toggle('on', i === Math.min(k, stageList.length - 1)); li.classList.toggle('done', i < k); });
    }
    root.position.y = liftFor();
    stepCamera(now);
    controls.update();
    renderer.render(scene, camera);
    layoutCallouts();
  }

  (async () => {
    try {
      if (opts.gltfUrl) await buildGltf(opts.gltfUrl);
      else if (opts.detailed === false) buildProcedural(opts.model);
      else {
        // Prefer the detailed Blender model; fall back to the built-in procedural one if it's missing or out of date
        try { await buildDetailed(opts.model); }
        catch (e) { console.warn('[viewer] using simple model:', e.message); parts = []; buildProcedural(opts.model); }
      }
      $('.vtitle').textContent = title; $('.vnote').textContent = note;
      renderPartsList(); resize(); frame(); setAnchors(); showStep(opts.startStep || 0);
      loading.remove(); tick();
    } catch (err) {
      loading.textContent = 'Could not load model: ' + err.message;
    }
  })();

  const dispose = () => {
    removeEventListener('keydown', onKey, true);
    if (viewerEl.classList.contains('vfull')) { viewerEl.classList.remove('vfull'); document.body.classList.remove('noscroll'); }
    alive = false; cancelAnimationFrame(raf); ro.disconnect(); controls.dispose();
    root.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); [].concat(o.material).forEach((m) => { m.map?.dispose(); m.dispose(); }); } });
    ground.geometry.dispose(); ground.material.alphaMap.dispose(); ground.material.dispose();
    scene.environment?.dispose(); pmrem.dispose(); renderer.dispose(); host.innerHTML = '';
  };
  // Jump to a repair step from outside (Duo screen follows the troubleshooter)
  dispose.showStep = (i) => { if (steps.length) showStep(i); else opts.startStep = i; };
  return dispose;
}
