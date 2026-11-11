import { TREES } from './trees.js';
import { MODELS } from './models.js';
import { mountViewer } from './viewer.js';
import * as sync from './sync.js';
import { KIT, COMPARE } from './kitinfo.js';

const app = document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* private mode */ } },
  del(k) { try { sessionStorage.removeItem(k); } catch { /* ignore */ } },
  lget(k) { try { return localStorage.getItem(k); } catch { return null; } },
  lset(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};
// ---------- Platform ----------
// FIELD_CONFIG is written by the phone-app build (js/config.js). The web version leaves it empty.
const CFG = window.FIELD_CONFIG || {};
const NATIVE = !!(CFG.native || window.Capacitor?.isNativePlatform?.());
// One app for every iPhone: the split Duo layout switches itself on whenever the screen is big enough
// (iPhone Duo unfolded, iPad). The web version can preview it with ?duo=1.
const DUO_BUILD = !!CFG.duo || new URLSearchParams(location.search).has('duo');
const APP_NAME = 'Field Comms';
document.documentElement.classList.toggle('native', NATIVE);
// Native-iOS look for the phone apps (preview in a browser with ?appui=1)
document.documentElement.classList.toggle('app-ui', NATIVE || new URLSearchParams(location.search).has('appui'));
if (NATIVE) {
  // Standalone app: no admin/upload tools, a Settings page for the update server instead
  document.querySelector('.nav a[data-r="admin"]')?.remove();
  const a = document.createElement('a'); a.href = '#/settings'; a.dataset.r = 'settings'; a.textContent = 'Settings';
  document.querySelector('.nav .theme').before(a);
}
// iPhone update server console: only what's needed to load new tech for the phones
const CONSOLE = !!CFG.console;
if (CONSOLE) {
  document.querySelector('.brand').lastChild.textContent = ' iPhone Update Server';
  document.querySelectorAll('.nav a').forEach((a) => { if (!['library', 'admin'].includes(a.dataset.r)) a.remove(); });
  const p = document.createElement('a'); p.href = '/pair'; p.textContent = 'Pair phones';
  document.querySelector('.nav .theme').before(p);
}

let disposeViewers = [];
const cleanup = () => { disposeViewers.forEach((d) => d()); disposeViewers = []; };

// ---------- Theme & nav ----------
const savedTheme = store.lget('theme'); if (savedTheme) document.documentElement.dataset.theme = savedTheme;
document.querySelector('.theme').onclick = () => {
  const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  const next = cur === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next; store.lset('theme', next);
};
document.querySelector('.navtoggle').onclick = () => document.querySelector('.nav').classList.toggle('open');

// ---------- Equipment (uploaded) ----------
let equipment = [];
async function loadEquipment() {
  if (NATIVE) {
    // Everything synced from the update server, held on the phone
    equipment = await sync.loadCachedEquipment().catch(() => []);
    for (const e of equipment) e.urls = await sync.urlsFor(e).catch(() => ({}));
  } else {
    try { equipment = await (await fetch('/api/equipment')).json(); } catch { equipment = []; }
  }
  for (const k of Object.keys(TREES)) if (k.startsWith('up:')) delete TREES[k];
  for (const e of equipment) if (e.tree && e.tree.nodes) TREES['up:' + e.id] = { title: e.name, upload: e.id, ...e.tree };
}
const CATS = ['Starshield / Network', 'VSAT', 'GRRIP / BGAN', 'Sat Phone', 'Other'];
const TREE_CAT = { grrip: 'GRRIP / BGAN', starlink: 'Starshield / Network', c1121: 'Starshield / Network', ap: 'Starshield / Network', c9200cx: 'Starshield / Network', cabling: 'Starshield / Network', vsat: 'VSAT', bgan: 'GRRIP / BGAN', satphone: 'Sat Phone' };

// ---------- Modal ----------
const modal = document.getElementById('modal');
let modalDispose = null;
function closeModal() { if (modalDispose) modalDispose(); modalDispose = null; modal.hidden = true; }
modal.querySelector('.modal-close').onclick = closeModal;
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
// Escape closes the pop-up – unless a 3D view inside it is full screen (that Escape just exits full screen)
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden && !e.defaultPrevented && !document.querySelector('.viewer.vfull')) closeModal(); });
function open3D(opts) {
  if (duoShow(opts)) return; // Duo: 3D lives on the right-hand screen
  closeModal(); modal.hidden = false;
  modalDispose = mountViewer(modal.querySelector('.modal-body'), opts);
}
function openModelFor(treeKey, step) {
  const t = TREES[treeKey];
  if (t?.upload) {
    const e = equipment.find((x) => x.id === t.upload);
    if (e?.models3d?.length) return open3D({ gltfUrl: fileUrl(e, e.models3d[0]), files: fileMap(e), name: e.name, steps: e.steps, startStep: step || 0 });
  }
  open3D({ model: t?.model || 'starlink', startStep: step || 0 });
}
const fileUrl = (e, f) => (e.urls ? e.urls[f] || '#' : '/uploads/' + encodeURIComponent(e.id) + '/' + f.split('/').map(encodeURIComponent).join('/'));
// For synced .gltf models: file name → local blob URL, so the loader finds its .bin and textures
const fileMap = (e) => (e.urls ? Object.fromEntries(Object.entries(e.urls).map(([k, v]) => [k.split('/').pop(), v])) : undefined);

// ---------- Duo (unfolded iPhone Duo / wide screens): menu on the left, live 3D on the right ----------
// iPhone Duo unfolded is ~466 pt wide (portrait) / 678 pt (landscape); folded cover screen is narrower
// Both sides ≥ 460 pt: iPhone Duo unfolded (466 × 678) yes; 16 Pro Max (440 × 956) never, in either orientation
const duoMQ = matchMedia('(min-width: 460px) and (min-height: 460px)');
const duoOn = () => DUO_BUILD && duoMQ.matches;
let duoView = null, duoKey = null;
function duoLayout() {
  const on = duoOn();
  document.body.classList.toggle('duo', on);
  let pane = document.getElementById('duo3d');
  if (on && !pane) {
    pane = document.createElement('aside'); pane.id = 'duo3d';
    pane.innerHTML = '<div class="duo-head"><b>3D repair view</b><span class="muted">follows the step on the left</span></div><div class="duo-body"></div>';
    document.body.appendChild(pane);
    duoShow({ model: 'starlink' });
  }
  if (!on && pane) { duoView?.(); duoView = null; duoKey = null; pane.remove(); }
}
// soft = only switch models, keep the current step (used while answering questions)
function duoShow(opts, soft = false) {
  if (!duoOn()) return false;
  const key = opts.model || opts.gltfUrl;
  if (key === duoKey && duoView) { if (!soft) duoView.showStep(opts.startStep || 0); return true; }
  duoView?.(); duoKey = key;
  duoView = mountViewer(document.querySelector('#duo3d .duo-body'), opts);
  return true;
}
duoMQ.addEventListener('change', () => { duoLayout(); route(); });

// ---------- Signal flow diagrams ----------
// Nodes are placed by column (their x) and row (their y). Spacing is computed so every link label fits
// on its own straight segment, links are square elbows, and groups are drawn around their member nodes.
// The same diagram renders left→right (inline) or top→bottom (full-screen vertical mode).
const NW = 150, NH = 58;
const labelW = (t) => (t ? Math.ceil(String(t).length * 6.6) + 16 : 0);
function elbow(pts, r = 9) { // rounded orthogonal polyline
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1], [cx, cy] = pts[i], [nx, ny] = pts[i + 1];
    const r1 = Math.min(r, Math.hypot(cx - px, cy - py) / 2, Math.hypot(nx - cx, ny - cy) / 2);
    const ux = Math.sign(cx - px), uy = Math.sign(cy - py), vx = Math.sign(nx - cx), vy = Math.sign(ny - cy);
    d += ` L${cx - ux * r1},${cy - uy * r1} Q${cx},${cy} ${cx + vx * r1},${cy + vy * r1}`;
  }
  const [lx, ly] = pts[pts.length - 1];
  return d + ` L${lx},${ly}`;
}
function topo(nodes, links, groups = [], vertical = false) {
  const by = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const cols = [...new Set(nodes.map((n) => n.x))].sort((a, b) => a - b);
  const ci = (n) => cols.indexOf(n.x);
  const inDeg = {}; links.forEach((l) => { inDeg[l.b] = (inDeg[l.b] || 0) + 1; });
  const pos = {};
  if (!vertical) {
    // gap after each column = widest label leaving it + room for the bend
    const gap = cols.map((_, i) => Math.max(72, ...links.filter((l) => ci(by[l.a]) === i).map((l) => labelW(l.l) + 44)));
    let x = 0; const X = cols.map((_, i) => { const v = x; x += NW + gap[i]; return v; });
    nodes.forEach((n) => { pos[n.id] = [X[ci(n)], n.y]; });
  } else {
    // rows = columns; horizontal spread scales the original y so nodes sharing a row never overlap
    let s = 1;
    cols.forEach((c) => {
      const ys = nodes.filter((n) => n.x === c).map((n) => n.y).sort((a, b) => a - b);
      for (let i = 1; i < ys.length; i++) s = Math.max(s, (NW + 18) / Math.max(1, ys[i] - ys[i - 1]));
    });
    s = Math.min(s, 2.4);
    const minY = Math.min(...nodes.map((n) => n.y));
    const gapV = 84;
    nodes.forEach((n) => { pos[n.id] = [(n.y - minY) * s, ci(n) * (NH + gapV)]; });
  }
  const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const grow = (x, y, w, h) => { box.x0 = Math.min(box.x0, x); box.y0 = Math.min(box.y0, y); box.x1 = Math.max(box.x1, x + w); box.y1 = Math.max(box.y1, y + h); };
  nodes.forEach((n) => grow(...pos[n.id], NW, NH));

  const lbl = (t, x, y, anchor) => {
    if (!t) return '';
    const w = labelW(t), rx = anchor === 'start' ? x - 4 : x - w / 2;
    grow(rx, y - 12, w, 17);
    return `<rect class="lblbg" x="${rx}" y="${y - 12}" width="${w}" height="17" rx="8"/><text class="lbl" x="${anchor === 'start' ? x + 4 : x}" y="${y}" text-anchor="${anchor}">${esc(t)}</text>`;
  };
  const paths = links.map((l) => {
    const [ax, ay] = pos[l.a], [bx, by2] = pos[l.b], fanIn = inDeg[l.b] > 1;
    let pts, label;
    if (!vertical) {
      const x1 = ax + NW, y1 = ay + NH / 2, x2 = bx, y2 = by2 + NH / 2;
      if (Math.abs(y1 - y2) < 1) { pts = [[x1, y1], [x2, y2]]; label = lbl(l.l, (x1 + x2) / 2, y1 - 7, 'middle'); }
      else {
        const mx = fanIn ? x2 - 22 : x1 + 22;
        pts = [[x1, y1], [mx, y1], [mx, y2], [x2, y2]];
        label = fanIn ? lbl(l.l, (x1 + mx) / 2, y1 - 7, 'middle') : lbl(l.l, (mx + x2) / 2, y2 - 7, 'middle');
      }
    } else {
      const x1 = ax + NW / 2, y1 = ay + NH, x2 = bx + NW / 2, y2 = by2;
      if (Math.abs(x1 - x2) < 1) { pts = [[x1, y1], [x2, y2]]; label = lbl(l.l, x1 + 8, (y1 + y2) / 2 + 4, 'start'); }
      else {
        const my = fanIn ? y1 + 30 : y1 + 22; // merges stay clear of group labels above the target
        pts = [[x1, y1], [x1, my], [x2, my], [x2, y2]];
        label = fanIn ? lbl(l.l, x1 + 8, (y1 + my) / 2 + 4, 'start') : lbl(l.l, x2 + 8, (my + y2) / 2 + 4, 'start');
      }
    }
    return `<path class="link ${l.alt ? 'alt' : ''}" d="${elbow(pts)}"/>${label}`;
  });
  const linked = new Set(links.flatMap((l) => [l.a, l.b]));
  const boxes = nodes.map((n) => {
    const [x, y] = pos[n.id];
    return `<g class="node ${n.cls || ''} ${linked.has(n.id) ? '' : 'aux'}" data-id="${n.id}" tabindex="0" role="button" aria-label="${esc(n.t)}">
      <rect x="${x}" y="${y}" width="${NW}" height="${NH}" rx="10"/>
      <text x="${x + NW / 2}" y="${y + 24}" text-anchor="middle" font-weight="600">${esc(n.t)}</text>
      <text class="sub" x="${x + NW / 2}" y="${y + 42}" text-anchor="middle">${esc(n.s || '')}</text></g>`;
  });
  const grps = groups.map((g) => {
    const m = g.ids.map((id) => pos[id]).filter(Boolean);
    const gx = Math.min(...m.map((p) => p[0])) - 16, gy = Math.min(...m.map((p) => p[1])) - 28;
    const gw = Math.max(...m.map((p) => p[0])) + NW + 16 - gx, gh = Math.max(...m.map((p) => p[1])) + NH + 14 - gy;
    grow(gx, gy, gw, gh);
    return `<g class="grp"><rect x="${gx}" y="${gy}" width="${gw}" height="${gh}" rx="14"/><text x="${gx + 12}" y="${gy + 18}">${esc(g.l)}</text></g>`;
  });
  const pad = 10, vw = box.x1 - box.x0 + pad * 2, vh = box.y1 - box.y0 + pad * 2;
  return `<svg class="topo ${vertical ? 'vert' : ''}" viewBox="${box.x0 - pad} ${box.y0 - pad} ${vw} ${vh}" data-w="${Math.round(vw)}" xmlns="http://www.w3.org/2000/svg">${grps.join('')}${paths.join('')}${boxes.join('')}</svg>`;
}

// Full-screen vertical view of a diagram (button on every diagram)
function openTopoFull(cfgTopo, title, onClick) {
  document.querySelector('.topo-full')?.remove();
  const ov = document.createElement('div'); ov.className = 'topo-full';
  const hint = String(cfgTopo.hint || '').replace(/^Left to right/, 'Top to bottom');
  ov.innerHTML = `<div class="tf-head"><b>${esc(title)}</b><button class="btn sm primary tf-close">Close</button></div>
    <div class="tf-body">${topo(cfgTopo.nodes, cfgTopo.links, cfgTopo.groups, true)}<p class="muted tf-hint">${esc(hint)}</p></div>`;
  document.body.appendChild(ov); document.body.classList.add('noscroll');
  const svg = ov.querySelector('svg'); const natural = +svg.dataset.w;
  svg.style.maxWidth = Math.round(natural * 1.35) + 'px'; svg.style.minWidth = Math.min(natural * 0.72, 560) + 'px';
  const close = () => { ov.remove(); document.body.classList.remove('noscroll'); removeEventListener('keydown', esc_); };
  const esc_ = (e) => { if (e.key === 'Escape') close(); };
  addEventListener('keydown', esc_);
  ov.querySelector('.tf-close').onclick = close;
  bindTopo(ov, cfgTopo.nodes, (n) => { close(); onClick(n); });
}
function bindTopo(root, nodes, onClick) {
  root.querySelectorAll('.topo .node').forEach((g) => {
    const n = nodes.find((x) => x.id === g.dataset.id);
    const go = () => onClick(n);
    g.addEventListener('click', go);
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });
}

// ---------- Wizard ----------
function wizard(el, treeKey, onTreeChange) {
  let stack = [{ tree: treeKey, node: TREES[treeKey].start }];
  const resolve = (next, cur) => {
    if (next.startsWith('tree:')) { const [, t, n] = next.split(':'); return { tree: t, node: n || TREES[t].start }; }
    return { tree: cur.tree, node: next };
  };
  function render() {
    const cur = stack[stack.length - 1];
    const tree = TREES[cur.tree]; const n = tree?.nodes[cur.node];
    onTreeChange?.(cur.tree);
    const crumbs = stack.slice(0, -1).map((s) => `<span>${esc(s.answer || '')}</span>`).join('');
    if (!n) { el.innerHTML = `<div class="notice err">Missing step "${esc(cur.node)}" in ${esc(cur.tree)}.</div>`; return; }
    let body;
    if (n.fix) {
      const sev = n.sev || 'ok';
      body = `<div class="card fix ${sev}">
        <div class="row"><span class="sev ${sev}">${sev === 'crit' ? 'Critical' : sev === 'warn' ? 'Action needed' : 'Fix'}</span><h3 style="margin:0">${esc(n.fix)}</h3></div>
        ${n.body ? `<p>${esc(n.body)}</p>` : ''}
        <ol class="checks">${(n.steps || []).map((s, i) => `<li><label><input type="checkbox" data-i="${i}">${esc(s)}</label></li>`).join('')}</ol>
        ${n.cmds ? `<div class="cmd"><button class="btn sm copy">Copy</button><pre>${esc(n.cmds)}</pre></div>` : ''}
        <div class="row wiz-actions">
          ${n.model !== undefined || tree.model || tree.upload ? `<button class="btn primary v3d">Open 3D repair view</button>` : ''}
          <button class="btn back">Back</button>
          <button class="btn restart">Start over</button>
          <button class="btn report">Copy report</button>
        </div>
        <details style="margin-top:12px"><summary>Still not fixed?</summary>
          <p class="muted">Record what you checked (Copy report), swap the unit with a spare if you have one, and escalate to your NOC / help desk / vendor support (Starshield support ticket, Cisco TAC with serial number, satellite service provider). Do not bypass security controls to restore service.</p>
        </details>
      </div>`;
    } else {
      body = `<div class="q">${esc(n.q)}</div>
        ${n.help ? `<div class="help">${esc(n.help)}</div>` : ''}
        <div class="opts">${n.opts.map(([l], i) => `<button class="btn opt" data-i="${i}">${esc(l)}</button>`).join('')}</div>
        <div class="row wiz-actions">${stack.length > 1 ? '<button class="btn back">Back</button><button class="btn restart">Start over</button>' : ''}</div>`;
    }
    el.innerHTML = `<div class="crumbs">${crumbs}</div><div class="muted" style="font-size:.85rem;margin-bottom:6px">${esc(tree.title)}</div>${body}`;
    if (duoOn()) {
      if (tree.upload) { if (n.fix) openModelFor(cur.tree, n.step); }
      else { const m = (n.fix && n.model) || tree.model; if (m) duoShow({ model: m, startStep: n.fix ? (n.step || 0) : 0 }, !n.fix); }
    }
    el.querySelectorAll('.opt').forEach((b) => b.onclick = () => {
      const [label, next] = n.opts[+b.dataset.i];
      cur.answer = label; stack.push(resolve(next, cur)); render();
    });
    el.querySelector('.back')?.addEventListener('click', () => { stack.pop(); delete stack[stack.length - 1].answer; render(); });
    el.querySelector('.restart')?.addEventListener('click', () => { stack = [{ tree: stack[0].tree, node: TREES[stack[0].tree].start }]; render(); });
    el.querySelector('.v3d')?.addEventListener('click', () => {
      if (n.model && !tree.upload) open3D({ model: n.model, startStep: n.step || 0 }); else openModelFor(cur.tree, n.step);
    });
    el.querySelector('.copy')?.addEventListener('click', (e) => { navigator.clipboard?.writeText(n.cmds); e.target.textContent = 'Copied'; });
    el.querySelectorAll('.checks input').forEach((c) => c.onchange = () => c.closest('li').classList.toggle('done', c.checked));
    el.querySelector('.report')?.addEventListener('click', (e) => {
      const lines = [`Troubleshooting report – ${new Date().toLocaleString()}`, `Start: ${TREES[stack[0].tree].title}`, ''];
      stack.slice(0, -1).forEach((s) => { const q = TREES[s.tree].nodes[s.node].q; lines.push(`Q: ${q}`, `A: ${s.answer}`); });
      lines.push('', `Result: ${n.fix}`);
      el.querySelectorAll('.checks li').forEach((li) => lines.push(`[${li.querySelector('input').checked ? 'x' : ' '}] ${li.textContent}`));
      navigator.clipboard?.writeText(lines.join('\n')); e.target.textContent = 'Copied';
    });
  }
  render();
  return { reset(k) { stack = [{ tree: k, node: TREES[k].start }]; render(); } };
}

// ---------- Quick reference ----------
const REF = {
  starlink: ['Performance Gen 3 dish · up to 12 users · set up in < 20 min', 'Down 300–475 Mbps, up 50–75 Mbps – TACLANE caps encrypted traffic at ~100 Mbps', 'Power: 100–240 VAC or 12–56 VDC + backup battery', 'IP68/IP69K · −40 °F to 140 °F · wind to 170 mph', 'MIL-AIR only – not on commercial flights', 'Dish status page: http://192.168.100.1 (or Starshield app)', 'Combiner has 2 outputs: Wi-Fi router + C1121 WAN (separate cables)', 'Reboot: app → Settings → Reboot, or unplug the combiner 60 s', 'Boot/search can take up to 15 min after power-on or a move', 'Never cut/splice the Starshield cable – replace it'],
  c1121: ['Console: 9600 8N1, no flow control', 'WAN: Gi0/0/0 (RJ45/SFP combo) → Starshield', 'LAN: Gi0/1/0–7 switched, PoE (-8P)', '<code>show ip interface brief</code>', '<code>show dhcp lease</code> · <code>show ip nat translations</code>', '<code>show power inline</code>'],
  ap: ['Wi-Fi router has its own cable from the combiner (not via the C1121)', 'Router mode (Bypass OFF) – Bypass switches the Wi-Fi off', 'Router page: http://192.168.1.1 · Dish: http://192.168.100.1', 'Undo Bypass = factory reset the Starshield router', 'Open the case lid for better range', 'Wi-Fi clients are NOT on the secure network – never bridge it'],
  c9200cx: ['Downlinks: Gi1/0/1–12 PoE+', 'Uplinks: 2× 1G copper + 2× 10G SFP+ (confirm names with <code>show interfaces status</code>)', 'Console: RJ45 or USB-C, 9600 8N1', '<code>show interfaces status err-disabled</code>', '<code>show port-security</code> · <code>show access-session</code>', '<code>show ip dhcp snooping</code> – trust the uplink'],
  cabling: ['T568B: W/O O W/G Bl W/Bl G W/Br Br', 'Max 100 m copper run', 'TDR test: <code>test cable-diagnostics tdr interface Gi1/0/x</code>', 'Clean fiber every time it is unplugged'],
  vsat: ['Lite Coms LITE SAT 1.3A (AN/TSC-248) · X / Ku / Ka · GEO & MEO', 'Up to 300 Mbps (allocated) · up to ~15 users', 'Power: 90–264 VAC or 24–32 VDC', 'Operating wind: 30 mph, gusts to 45 mph – stow above that', 'GX Type 1, WGS, mPOWER approved · MIL-AIR only', '⚠ RF hazard: keep clear of the beam/feed when transmitting', 'Signal chain: Reflector → Feed/OMT → BUC (TX) / LNB (RX) → IFL → Modem → (Encryptor) → LAN', 'Never transmit before NOC line-up / cross-pol check', 'Peak order: Azimuth → Elevation → Polarisation', 'GEO latency ≈ 600 ms – tune VPN MTU/MSS'],
  grrip: ['Klas Pioneer Express 5.1 · AN/PSC-19 · part KLAS-FACP-0001-K-R51', 'Power: built-in 250 W AC/DC, or DC from a 2590 battery', 'UPS 72 Wh backs up VoyagerVMm + encryptor only', '15 VDC outputs live only on external AC/DC', 'Red ports 5 (incl. built-in laptop) · Black ports 4', 'Bearers: BGAN, hotel broadband, VSAT', 'Operating −20 °C to 40 °C · IP67 when closed', 'COMSEC: keying/zeroizing by authorised personnel only'],
  bgan: ['UNCLASSIFIED ONLY on its own – classified traffic goes through the GRRIP encryptor', 'Inmarsat + Viasat = one provider since May 2023', 'Airtime is very expensive – stop background updates', 'Coverage is poor near the poles', 'Needs GPS fix before registering', 'Inmarsat satellites sit over the equator', 'Web UI usually at the terminal\'s LAN gateway (often 192.168.0.1 – check the label/manual)', 'Standard IP = shared · Streaming = guaranteed, billed by time', 'Dial: 00 + country code + number'],
  satphone: ['GEO and LEO networks · voice, SMS, GPS location', 'For small amounts of traffic / SOS – expect delay on GEO', 'Outdoors, clear sky, antenna fully extended & vertical', 'Dial: + or 00, country code, number', 'Iridium numbers usually start +8816', 'Keep batteries warm; carry a spare', 'Indoors/vehicle: external antenna or dock'],
};

function sidePanel(treeKey) {
  const t = TREES[treeKey];
  const cat = TREE_CAT[treeKey];
  const docs = equipment.filter((e) => e.category === cat);
  return `<div class="card side">
    <h3>Quick reference</h3>
    <ul>${(REF[treeKey] || []).map((r) => `<li>${r}</li>`).join('')}</ul>
    ${t.model && !duoOn() ? `<div class="mini3d"><button class="btn primary v3dside" style="position:absolute;inset:auto 10px 10px auto">Open full 3D ▸</button></div>` : ''}
    <h3 style="margin-top:16px">Uploaded docs · ${esc(cat || '')}</h3>
    ${docs.length ? `<ul>${docs.map((d) => `<li><a href="#/item/${encodeURIComponent(d.id)}">${esc(d.name)}</a> <span class="pill">${d.files.length} files</span></li>`).join('')}</ul>` : (NATIVE ? '<p class="muted">None yet – new tech arrives through <a href="#/settings">Settings → Update server</a>.</p>' : '<p class="muted">None yet – add manuals, photos and models in <a href="#/admin">Admin</a>.</p>')}
  </div>`;
}

// ---------- Specs & limits card (from the unit's Flyaway Kit Technical Overview) ----------
function infoCard(keys) {
  return keys.map((k) => {
    const i = KIT[k]; if (!i) return '';
    const list = (title, items) => items?.length ? `<div><h4 class="ilabel">${esc(title)}</h4><ul class="ilist">${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '';
    const table = (rows) => rows?.length ? `<dl class="ispecs">${rows.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl>` : '';
    return `<details class="card info">
      <summary><span class="ilabel">Specs &amp; limits</span> <b>${esc(i.name)}</b></summary>
      <p class="muted">${esc(i.summary)}</p>
      ${table(i.specs)}
      <div class="igrid">${list('Capabilities', i.capabilities)}${list('Limitations', i.limitations)}</div>
      ${i.ratings?.length ? `<h4 class="ilabel">Ratings</h4>${table(i.ratings)}` : ''}
      <p class="isrc">Source: ${i.sources.map(esc).join(' · ')}</p>
    </details>`;
  }).join('');
}

// ---------- System page (shared by Starshield, VSAT, GRRIP, Sat phone) ----------
function systemPage(cfg) {
  app.innerHTML = `
    <section class="hero"><h1>${esc(cfg.title)}</h1><p>${cfg.intro}</p></section>
    ${cfg.info ? `<div class="infos">${infoCard(cfg.info)}</div>` : ''}
    ${cfg.topo ? `<div class="card topo-card"><div class="topo-bar"><span class="ilabel">Signal flow</span><button class="btn sm topo-fs" aria-label="Show the diagram full screen, top to bottom">⤢ Full screen</button></div><div class="topo-scroll">${topo(cfg.topo.nodes, cfg.topo.links, cfg.topo.groups)}</div><p class="muted" style="margin:6px 0 0;font-size:.85rem">${esc(cfg.topo.hint)}</p></div>` : ''}
    <div class="tabs">${cfg.tabs.map((t) => `<button class="btn" data-k="${t.k}">${esc(t.l)}</button>`).join('')}</div>
    <div class="layout2"><div class="card wizard"></div><div class="sidewrap"></div></div>
    ${cfg.extra || ''}`;
  const wEl = app.querySelector('.wizard'), sideEl = app.querySelector('.sidewrap');
  let shown = null, miniDispose = null;
  const showSide = (k) => {
    if (shown === k) return; shown = k;
    miniDispose?.(); miniDispose = null;
    sideEl.innerHTML = sidePanel(k);
    app.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.k === k));
    app.querySelectorAll('.topo .node').forEach((g) => g.classList.toggle('active', cfg.topo?.nodes.find((n) => n.id === g.dataset.id)?.k === k));
    const mini = sideEl.querySelector('.mini3d');
    if (mini) {
      const holder = document.createElement('div'); holder.style.cssText = 'position:absolute;inset:0';
      mini.prepend(holder);
      miniDispose = miniViewer(holder, TREES[k].model);
      sideEl.querySelector('.v3dside').onclick = () => open3D({ model: TREES[k].model });
    }
  };
  disposeViewers.push(() => miniDispose?.());
  const wiz = wizard(wEl, cfg.tabs[0].k, showSide);
  app.querySelectorAll('.tabs button').forEach((b) => b.onclick = () => wiz.reset(b.dataset.k));
  const topoClick = (n) => { if (n.k) { wiz.reset(n.k); wEl.scrollIntoView({ behavior: 'smooth', block: 'start' }); } else if (n.model) open3D({ model: n.model, startStep: n.step || 0 }); };
  app.querySelector('.topo-fs')?.addEventListener('click', () => openTopoFull(cfg.topo, cfg.title, topoClick));
  if (cfg.topo) bindTopo(app, cfg.topo.nodes, (n) => { if (n.k) { wiz.reset(n.k); wEl.scrollIntoView({ behavior: 'smooth', block: 'start' }); } else if (n.model) open3D({ model: n.model, startStep: n.step || 0 }); });
  cfg.after?.();
}

// Lightweight spinning preview for the side panel
function miniViewer(holder, model) {
  const d = mountViewer(holder, { model });
  // hide side panel/hud for the mini version
  const v = holder.querySelector('.viewer'); v.style.cssText = 'display:block;height:100%';
  holder.querySelector('.viewer-side').style.display = 'none';
  holder.querySelector('.viewer-hud').style.display = 'none';
  holder.querySelector('.viewer-stage').style.cssText = 'position:absolute;inset:0;border:0;border-radius:0;min-height:0';
  setTimeout(() => { holder.querySelector('.vspin')?.click(); holder.querySelector('.vx').value = 0.5; holder.querySelector('.vx').dispatchEvent(new Event('input')); }, 50);
  return d;
}

function checklist(id, title, items) {
  const key = 'chk:' + id;
  let saved = {}; try { saved = JSON.parse(store.lget(key) || '{}'); } catch { /* ignore */ }
  const html = `<section class="card"><div class="row" style="justify-content:space-between"><h2 style="margin:0">${esc(title)}</h2><button class="btn sm clr-${id}">Clear</button></div>
    <div class="grid" style="margin-top:10px">${items.map(([g, list]) => `<div><h4>${esc(g)}</h4>${list.map((it, i) => `<label style="display:block;margin:4px 0"><input type="checkbox" data-c="${esc(g)}:${i}" ${saved[`${g}:${i}`] ? 'checked' : ''}> ${esc(it)}</label>`).join('')}</div>`).join('')}</div></section>`;
  const after = () => {
    app.querySelectorAll(`[data-c]`).forEach((c) => c.onchange = () => { saved[c.dataset.c] = c.checked; store.lset(key, JSON.stringify(saved)); });
    app.querySelector(`.clr-${id}`).onclick = () => { saved = {}; store.lset(key, '{}'); app.querySelectorAll('[data-c]').forEach((c) => { c.checked = false; }); };
  };
  return { html, after };
}

// ---------- Pages ----------
const pages = {
  home() {
    app.innerHTML = `
      <section class="hero"><h1>Field Comms Troubleshooter</h1>
        <p>Step-by-step guided troubleshooting for deployed satellite and network kits, with 3D exploded views showing how to replace parts and fix cables. Pick a system to start. ${NATIVE ? 'Works fully offline; new tech arrives through <a href="#/settings">Settings → Update server</a>.' : 'Works offline once the server is running on your local network.'}</p></section>
      <div class="grid">
        ${[
          ['#/kit', '🧳', 'Flyaway kit', 'All systems side by side: throughput, users, power, setup time, transport and limits.'],
          ['#/starlink', '🛰️', 'Starshield network', 'Starshield dish → AC power / network combiner → Wi-Fi router + Cisco C1121-8P → secure C9200CX-12P-2X2G.'],
          ['#/vsat', '📡', 'LS248 VSAT', '1.3 m flyaway terminal: pointing, RX lock, BUC/LNB, IFL, modem.'],
          ['#/grrip', '🎒', 'GRRIP / BGAN', 'Klas Pioneer Express 5.1 (AN/PSC-19): power, red/black networking, HAIPE/GoSilent, Hughes 9211 BGAN.'],
          ['#/satphone', '📞', 'Sat phone', 'Handheld satellite phone: signal, SIM, battery, antenna, calling.'],
          ['#/3d', '🧩', '3D repair views', 'Exploded models with step-by-step replacement guides for every unit and cable.'],
          ['#/library', '📚', 'Equipment library', 'Manuals, photos, configs and 3D models uploaded for new tech.'],
        ].map(([h, i, t, d]) => `<a class="card tile" href="${h}"><div class="ico">${i}</div><h3>${t}</h3><p>${d}</p></a>`).join('')}
      </div>
      <p class="notice" style="margin-top:20px">This guide is generic field guidance. Always follow your unit's SOPs, manufacturer manuals and security/COMSEC policy. Don't bypass port-security or authentication controls on the secure network to restore service.</p>`;
  },

  starlink() {
    // Physical order: dish → AC power adapter / network combiner → (Wi-Fi router) + (C1121 → secure C9200CX)
    const nodes = [
      { id: 'dish', x: 10, y: 110, t: 'Starshield Dish', s: 'Performance Gen 3', k: 'starlink' },
      { id: 'psu', x: 270, y: 110, t: 'AC Power + Combiner', s: 'Advanced PSU · AC or DC', k: 'starlink' },
      { id: 'rtr', x: 530, y: 30, t: 'Starshield Wi-Fi Router', s: 'In case · router mode', k: 'ap' },
      { id: 'c1121', x: 530, y: 190, t: 'Cisco C1121-8P', s: 'In case · gateway · PoE', k: 'c1121' },
      { id: 'sw', x: 800, y: 190, t: 'C9200CX-12P-2X2G', s: 'Secure LAN · 802.1X', k: 'c9200cx', cls: 'secure' },
      { id: 'ep', x: 1070, y: 190, t: 'Secure endpoints', s: 'PoE+ access ports', k: 'c9200cx', cls: 'secure' },
      { id: 'cab', x: 1070, y: 30, t: 'Cables', s: 'RJ45 · fiber · Starshield', k: 'cabling' },
    ];
    const links = [
      { a: 'dish', b: 'psu', l: 'Starshield cable' },
      { a: 'psu', b: 'rtr', l: 'Ethernet' },
      { a: 'psu', b: 'c1121', l: 'Separate cable → Gi0/0/0' },
      { a: 'c1121', b: 'sw', l: 'Gi0/1/x → uplink' },
      { a: 'sw', b: 'ep', l: 'Gi1/0/1–12' },
    ];
    const groups = [{ ids: ['psu', 'rtr', 'c1121'], l: 'Transit case' }];
    systemPage({
      title: 'Starshield network',
      info: ['starshield'],
      intro: 'Starshield gives NIPR/SIPR access through PACSTAR and commercial internet over LEO, on a Starlink Performance (Gen 3) dish. The dish runs to the AC power adapter / network combiner (Advanced Power Supply) in the transit case. The combiner feeds two separate cables: one to the in-case Starshield Wi-Fi router, and one to the Cisco C1121-8P, which then feeds the secure Catalyst C9200CX-12P-2X2G. Click a device in the diagram or a tab to start troubleshooting it.',
      topo: { nodes, links, groups, hint: 'Left to right is the physical cable order. Green = secure segment. The Wi-Fi router and the C1121 each have their own cable from the combiner; the C1121 gets its address straight from Starshield (usually 100.64.x.x).' },
      tabs: [{ k: 'starlink', l: 'Starshield dish & service' }, { k: 'c1121', l: 'Cisco C1121-8P' }, { k: 'ap', l: 'Starshield Wi-Fi' }, { k: 'c9200cx', l: 'C9200CX-12P-2X2G' }, { k: 'cabling', l: 'Cabling' }],
    });
  },

  vsat() {
    const nodes = [
      { id: 'refl', x: 10, y: 50, t: 'Reflector', s: '1.3 m petals', model: 'vsat', step: 1 },
      { id: 'feed', x: 230, y: 50, t: 'Feed / OMT', s: 'Horn + diplexer', model: 'vsat', step: 2 },
      { id: 'buc', x: 450, y: 5, t: 'BUC (TX)', s: 'Up-converter', model: 'vsat', step: 3 },
      { id: 'lnb', x: 450, y: 95, t: 'LNB (RX)', s: 'Low-noise block', model: 'vsat', step: 3 },
      { id: 'modem', x: 690, y: 50, t: 'Modem case', s: 'TX/RX IFL in', model: 'vsat', step: 5 },
      { id: 'lan', x: 920, y: 50, t: 'Encryptor / LAN', s: 'Router · switch', k: 'vsat' },
      { id: 'pos', x: 230, y: 155, t: 'Positioner', s: 'GPS · compass · tripod', model: 'vsat', step: 4 },
    ];
    const links = [{ a: 'refl', b: 'feed' }, { a: 'feed', b: 'buc' }, { a: 'feed', b: 'lnb' }, { a: 'buc', b: 'modem', l: 'TX IFL' }, { a: 'lnb', b: 'modem', l: 'RX IFL' }, { a: 'modem', b: 'lan', l: 'Ethernet' }];
    const chk = checklist('vsat', 'Pre-deployment / setup checklist', [
      ['Site', ['Clear line of sight to the satellite arc', 'Away from Starshield dish, BGAN, and personnel paths (RF hazard zone)', 'Ground level & firm; stakes/ballast ready']],
      ['Antenna', ['All petals latched, no gaps', 'Feed cover intact, OMT/BUC/LNB bolted', 'Tripod levelled, GPS has sky view']],
      ['Electronics', ['TX IFL → BUC, RX IFL → LNB', 'Modem config/option file current', 'LNB DC, BUC DC & 10 MHz enabled', 'NOC contacted before transmit']],
    ]);
    systemPage({
      title: 'LS-248 VSAT – Lite Coms LITE SAT 1.3A',
      info: ['ls248'],
      intro: 'The LS-248 is the Lite Coms LITE SAT 1.3A (AN/TSC-248): a 1.3 m auto-acquire X / Ku / Ka-band terminal, set up in under 10 minutes. Troubleshoot the signal chain end-to-end – click any block to jump straight to its 3D repair step. <span class="muted">Modem and feed details vary by configuration; check against your unit\'s manual.</span>',
      topo: { nodes, links, hint: 'Click a block to open its 3D exploded repair step; "Encryptor / LAN" opens the troubleshooter.' },
      tabs: [{ k: 'vsat', l: 'VSAT troubleshooter' }, { k: 'cabling', l: 'IFL & cabling' }],
      extra: '<div style="margin-top:22px">' + chk.html + '</div>', after: chk.after,
    });
  },

  grrip() {
    // Klas Pioneer Express 5.1 (GRRIP, AN/PSC-19): black bearer → black ports → encryptor → red router → red laptops
    const nodes = [
      { id: 'bgan', x: 10, y: 30, t: 'Hughes 9211 BGAN', s: 'Black bearer · Inmarsat', k: 'bgan' },
      { id: 'hotel', x: 10, y: 110, t: 'Starshield / hotel', s: 'Black bearer · Ethernet', k: 'starlink' },
      { id: 'vsat', x: 10, y: 190, t: 'VSAT', s: 'Black bearer · modem', k: 'vsat' },
      { id: 'black', x: 280, y: 110, t: 'Black ports (4)', s: 'VoyagerVMm · ciphertext', k: 'grrip' },
      { id: 'crypto', x: 540, y: 110, t: 'Encryptor', s: 'KG-250XS HAIPE / GoSilent', k: 'grrip', cls: 'secure' },
      { id: 'red', x: 800, y: 110, t: 'Red router', s: 'KlasOS Keel / VNF', k: 'grrip', cls: 'secure' },
      { id: 'laptops', x: 1060, y: 60, t: 'Red laptops', s: 'Built-in + up to 4', k: 'grrip', cls: 'secure' },
      { id: 'phone', x: 1060, y: 170, t: 'Sat phone', s: 'Separate voice backup', k: 'satphone' },
    ];
    const links = [
      { a: 'bgan', b: 'black', l: 'Ethernet' }, { a: 'hotel', b: 'black', l: '' }, { a: 'vsat', b: 'black', l: '' },
      { a: 'black', b: 'crypto', l: 'Black (CT)' }, { a: 'crypto', b: 'red', l: 'Red (PT)' }, { a: 'red', b: 'laptops', l: 'Red ports (5)' },
    ];
    const groups = [{ ids: ['black', 'crypto', 'red'], l: 'Pioneer Express core module' }];
    const chk = checklist('grrip', 'GRRIP (Pioneer Express 5.1) kit check', [
      ['Case & power', ['Case latched and seals clean (IP67 only when closed)', 'AC cord for the core module (built-in 250 W AC/DC)', 'Charged 2590 battery + DC cable', 'UPS charged (kit on external power before moving out)']],
      ['Networking', ['Hughes 9211 BGAN, charged, SIM fitted', 'Black patch cables (marked)', 'Red patch cables (marked)', 'Encryptor fitted and accounted for (COMSEC/CSfC rules)']],
      ['Laptop & support', ['Panasonic laptop charged', 'Quick-release SSD present and locked', 'Sat phone charged with active SIM', 'Klas support / NOC contact numbers', 'This guide (phone app or printout)']],
    ]);
    systemPage({
      title: 'GRRIP – Klas Pioneer Express 5.1',
      info: ['grrip', 'bgan'],
      intro: 'The GRRIP kit is the Klas Pioneer Express (AN/PSC-19): one IP67 carry-on case giving small teams secure network access from anywhere. Reachback (most commonly BGAN, or Starshield, hotel broadband or VSAT) comes in on the <b>black</b> side, passes through a Type 1 HAIPE or CSfC encryptor, and reaches the <b>red</b> laptops. Click a block or a tab to start troubleshooting.',
      topo: { nodes, links, groups, hint: 'Black = encrypted / untrusted side. Green = red (secure) side. Never connect a black or untrusted network to a red port. The Hughes 9211 BGAN and the encryptor are separate items, not part of the kit.' },
      tabs: [{ k: 'grrip', l: 'Pioneer Express kit' }, { k: 'bgan', l: 'Hughes 9211 BGAN' }, { k: 'satphone', l: 'Sat phone' }],
      extra: '<div style="margin-top:22px">' + chk.html + '</div>', after: chk.after,
    });
  },

  satphone() {
    systemPage({
      title: 'Satellite phone',
      info: ['satphone'],
      topo: {
        nodes: [
          { id: 'phone', x: 10, y: 40, t: 'Sat phone', s: 'Antenna up · clear sky', k: 'satphone' },
          { id: 'sat', x: 270, y: 40, t: 'Satellite', s: 'LEO or GEO', k: 'satphone' },
          { id: 'gw', x: 530, y: 40, t: 'Ground gateway', s: 'Provider network', k: 'satphone' },
          { id: 'pstn', x: 790, y: 40, t: 'Phone / SMS network', s: 'Any phone worldwide', k: 'satphone' },
        ],
        links: [{ a: 'phone', b: 'sat', l: 'L-band radio' }, { a: 'sat', b: 'gw', l: 'Feeder link' }, { a: 'gw', b: 'pstn', l: 'Call / SMS' }],
        hint: 'Left to right is the signal path. No cell towers: the phone talks straight to a satellite, so it needs a clear view of the sky. LEO has short delay; GEO adds noticeable delay.',
      },
      intro: 'Handheld sat phone troubleshooting: power, sky view, registration, calling, SMS. Use the 3D view to swap the battery, SIM or antenna.',
      tabs: [{ k: 'satphone', l: 'Sat phone' }],
    });
  },

  '3d'(arg) {
    const keys = Object.keys(MODELS);
    const ups = equipment.filter((e) => e.models3d?.length);
    const cur = arg || keys[0];
    app.innerHTML = `<section class="hero"><h1>3D exploded repair views</h1><p>Drag to rotate, scroll/pinch to zoom, slide to explode. Step through the repair guide on the right – highlighted parts glow orange. Click any part to identify it.</p></section>
      <div class="tabs">${keys.map((k) => `<a class="btn ${k === cur ? 'active' : ''}" style="${k === cur ? 'background:var(--accent);color:#111' : ''}" href="#/3d/${k}">${esc(MODELS[k].name.split('(')[0])}</a>`).join('')}
      ${ups.map((e) => `<a class="btn" href="#/item/${encodeURIComponent(e.id)}">⬆ ${esc(e.name)}</a>`).join('')}</div>
      ${duoOn() ? `<div class="card"><h3 style="margin-top:0">${esc(MODELS[cur]?.name || '')}</h3><p class="muted">${esc(MODELS[cur]?.note || '')}</p><p>Use the steps on the right-hand screen; tap a model above to switch.</p></div>` : '<div class="v"></div>'}`;
    if (duoOn()) duoShow({ model: MODELS[cur] ? cur : keys[0] }, true);
    else disposeViewers.push(mountViewer(app.querySelector('.v'), { model: MODELS[cur] ? cur : keys[0] }));
  },

  library() {
    app.innerHTML = `<section class="hero"><h1>Equipment library</h1><p>Built-in guides plus ${NATIVE ? 'everything downloaded from your <a href="#/settings">update server</a>' : 'everything uploaded through <a href="#/admin">Admin</a>'}.</p></section>
      <div class="row" style="margin-bottom:12px"><input type="text" class="search" placeholder="Search equipment, files, categories…" style="max-width:420px">
      <select class="cat" style="max-width:220px"><option value="">All categories</option>${CATS.map((c) => `<option>${c}</option>`).join('')}</select></div>
      <h2>Uploaded equipment</h2><div class="ups grid"></div>
      <h2 style="margin-top:24px">Built-in guides</h2>
      <div class="grid">${Object.entries(TREES).filter(([k]) => !k.startsWith('up:')).map(([k, t]) => `<div class="card"><h3>${esc(t.title)}</h3><p class="muted">${esc(TREE_CAT[k])}</p><div class="row"><a class="btn sm" href="#/${({ c1121: 'starlink', ap: 'starlink', c9200cx: 'starlink', cabling: 'starlink', bgan: 'grrip', grrip: 'grrip' })[k] || k}">Troubleshoot</a>${t.model ? `<a class="btn sm" href="#/3d/${t.model}">3D view</a>` : ''}</div></div>`).join('')}</div>`;
    const render = () => {
      const q = app.querySelector('.search').value.toLowerCase(), c = app.querySelector('.cat').value;
      const list = equipment.filter((e) => (!c || e.category === c) && (!q || JSON.stringify([e.name, e.category, e.description, e.manufacturer, e.model, e.files]).toLowerCase().includes(q)));
      app.querySelector('.ups').innerHTML = list.length ? list.map((e) => `<a class="card tile" href="#/item/${encodeURIComponent(e.id)}"><h3>${esc(e.name)}</h3><p>${esc(e.description || '')}</p><div class="row" style="margin-top:8px"><span class="pill">${esc(e.category)}</span><span class="pill">${e.files.length} files</span>${e.models3d.length ? '<span class="pill">3D</span>' : ''}${e.tree ? '<span class="pill">Troubleshooter</span>' : ''}</div></a>`).join('') : '<p class="muted">Nothing uploaded yet.</p>';
    };
    app.querySelector('.search').oninput = render; app.querySelector('.cat').onchange = render; render();
  },

  item(id) {
    const e = equipment.find((x) => x.id === decodeURIComponent(id || ''));
    if (!e) { app.innerHTML = '<div class="notice err">Equipment not found.</div>'; return; }
    const imgs = e.files.filter((f) => /\.(png|jpe?g|gif|webp)$/i.test(f));
    const others = e.files.filter((f) => !imgs.includes(f) && !/\.(bin)$/i.test(f));
    app.innerHTML = `<section class="hero"><h1>${esc(e.name)}</h1><p>${esc(e.description || '')}</p>
      <div class="row"><span class="pill">${esc(e.category)}</span>${e.manufacturer ? `<span class="pill">${esc(e.manufacturer)}</span>` : ''}${e.model ? `<span class="pill">${esc(e.model)}</span>` : ''}<span class="pill">Uploaded ${esc(new Date(e.uploadedAt).toLocaleString())}</span></div></section>
      ${e.models3d.length ? `<section><h2>3D model</h2><div class="tabs">${e.models3d.map((m, i) => `<button class="btn m3 ${i ? '' : 'active'}" data-i="${i}">${esc(m)}</button>`).join('')}</div><div class="v"></div></section>` : ''}
      ${e.tree?.nodes ? '<section><h2>Troubleshooter</h2><div class="card wizard"></div></section>' : ''}
      ${imgs.length ? `<section><h2>Photos</h2><div class="grid">${imgs.map((f) => `<a href="${fileUrl(e, f)}" target="_blank" rel="noopener"><img src="${fileUrl(e, f)}" alt="${esc(f)}" style="width:100%;border-radius:10px;border:1px solid var(--line)"></a>`).join('')}</div></section>` : ''}
      <section><h2>Files</h2><ul class="files">${others.map((f) => `<li><a href="${fileUrl(e, f)}" target="_blank" rel="noopener">${esc(f)}</a></li>`).join('')}</ul></section>`;
    if (e.models3d.length) {
      const show = (i) => {
        const o = { gltfUrl: fileUrl(e, e.models3d[i]), files: fileMap(e), name: e.name, steps: e.steps };
        if (!duoShow(o)) { cleanup(); disposeViewers.push(mountViewer(app.querySelector('.v'), o)); }
        app.querySelectorAll('.m3').forEach((b) => b.classList.toggle('active', +b.dataset.i === i));
      };
      app.querySelectorAll('.m3').forEach((b) => b.onclick = () => show(+b.dataset.i)); show(0);
    }
    if (e.tree?.nodes) {
      if (!TREES['up:' + e.id]?.nodes[e.tree.start]) app.querySelector('.wizard').innerHTML = '<div class="notice err">Tree has no valid "start" node.</div>';
      else wizard(app.querySelector('.wizard'), 'up:' + e.id);
    }
  },

  kit() {
    app.innerHTML = `<section class="hero"><h1>Flyaway kit</h1><p>What each system in the kit does, how fast it is, how many people it supports and what limits it. From the unit's Flyaway Kit Technical Overview.</p></section>
      <div class="card" style="overflow-x:auto"><table class="cmp">${COMPARE.map((r, i) => `<tr>${r.map((c, j) => (i === 0 || j === 0) ? `<th>${esc(c)}</th>` : `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table></div>
      <div class="infos" style="margin-top:14px">${infoCard(Object.keys(KIT))}</div>
      <p class="notice">Transport: Starshield and the LS-248 are MIL-AIR only – not authorised on commercial flights. BGAN alone carries unclassified traffic only.</p>`;
  },

  settings(arg) {
    const st = sync.settings;
    app.innerHTML = `<section class="hero"><h1>Settings</h1><p>${esc(APP_NAME)} works fully offline. Link it to a Field Comms update server to download new tech – manuals, photos, 3D models and troubleshooting guides – as it is added.</p></section>
      <div class="card set">
        <h2>Update server</h2>
        <label class="f">Server address<input class="srv" type="url" inputmode="url" placeholder="e.g. 192.168.1.20:8080" autocapitalize="off" autocorrect="off" spellcheck="false" value="${esc(st.server)}"></label>
        <div class="row"><button class="btn primary connect">Connect</button><button class="btn find">Find server</button></div>
        <div class="srvmsg"></div>
        <details><summary>How to link this phone</summary><ol>
          <li>Start the troubleshooter server on a computer on the same network (double-click <b>Start Troubleshooter</b>).</li>
          <li>On that computer open <code>http://localhost:8080/pair</code>.</li>
          <li>Point the iPhone <b>Camera</b> at the <b>${esc(APP_NAME)}</b> code and tap the banner – the app opens and links itself.</li>
          <li>Or type the address shown on that page above and tap Connect.</li></ol>
          <p class="muted">Internet-hosted servers must use https://. Plain http:// works on your local network.</p></details>
      </div>
      <div class="card set">
        <h2>Updates</h2>
        <div class="updstat muted">Not checked yet.</div>
        <div class="row"><button class="btn check">Check for updates</button><button class="btn primary syncnow">Download updates</button></div>
        <div class="prog" hidden><div class="bar"><span></span></div><div class="ptext muted"></div></div>
        <label class="tog"><input type="checkbox" class="auto" ${st.autoCheck ? 'checked' : ''}> Check for updates when the app opens</label>
      </div>
      <div class="card set"><h2>On this phone</h2><div class="local muted">…</div><button class="btn clear">Remove downloaded files</button></div>
      <div class="card set"><h2>About</h2><p class="muted">${esc(APP_NAME)} ${esc(CFG.version || '')} · ${Object.keys(TREES).filter((k) => !k.startsWith('up:')).length} built-in guides · ${Object.keys(MODELS).length} built-in 3D models${DUO_BUILD ? ` · Layout: ${duoOn() ? 'Duo – menu on the left, 3D on the right' : 'phone (Duo layout turns on when unfolded)'}` : ''}</p></div>`;
    const $ = (q) => app.querySelector(q);
    const msg = (html, cls = '') => { $('.srvmsg').innerHTML = html ? `<div class="notice ${cls}">${html}</div>` : ''; };
    const showLocal = async () => {
      const idx = await sync.cachedIndex();
      const used = await sync.storageUsed().catch(() => 0);
      $('.local').innerHTML = idx.syncedAt
        ? `${idx.items.length} kit${idx.items.length === 1 ? '' : 's'} downloaded from <b>${esc(idx.server?.name || idx.server?.base || '')}</b> · last updated ${esc(new Date(idx.syncedAt).toLocaleString())} · ${esc(sync.fmtBytes(used))} used`
        : 'Nothing downloaded yet – only the built-in guides and models are on this phone.';
    };
    const connect = async (base) => {
      if (!base) { msg('Enter a server address, e.g. <code>192.168.1.20:8080</code>.', 'err'); return null; }
      msg(`Connecting to ${esc(base)}…`);
      try {
        const info = await sync.ping(base);
        st.server = base; $('.srv').value = base;
        msg(`✓ Linked to <b>${esc(info.name)}</b> (${info.items} kit${info.items === 1 ? '' : 's'} available).`);
        return info;
      } catch (e) { msg(`Could not reach ${esc(base)}: ${esc(e.message)}. Check the phone is on the same network and the server is running.`, 'err'); return null; }
    };
    const check = async () => {
      if (!st.server) { $('.updstat').textContent = 'Link a server first.'; return null; }
      $('.updstat').textContent = 'Checking…';
      try {
        const p = await sync.checkUpdates(st.server);
        $('.updstat').innerHTML = p.upToDate ? `✓ Up to date with <b>${esc(p.remote.name)}</b>.`
          : `<b>${p.added} new</b>, <b>${p.changed} changed</b>, ${p.removed} removed · ${p.files} file${p.files === 1 ? '' : 's'} (${esc(sync.fmtBytes(p.bytes))}) to download.`;
        return p;
      } catch (e) { $('.updstat').innerHTML = `<span class="err-text">Couldn't check: ${esc(e.message)}</span>`; return null; }
    };
    const download = async () => {
      if (!st.server) { $('.updstat').textContent = 'Link a server first.'; return; }
      const btn = $('.syncnow'); btn.disabled = true; $('.prog').hidden = false;
      try {
        const r = await sync.syncNow(st.server, (pr) => {
          const pct = pr.totalBytes ? Math.round((pr.bytes / pr.totalBytes) * 100) : pr.total ? Math.round((pr.done / pr.total) * 100) : 100;
          $('.prog .bar span').style.width = (pr.finished ? 100 : pct) + '%';
          $('.ptext').textContent = pr.finished ? 'Done.' : `${pr.done} / ${pr.total} files${pr.file ? ' · ' + pr.file : ''}`;
        });
        await loadEquipment();
        $('.updstat').innerHTML = `✓ Updated: ${r.index.items.length} kit${r.index.items.length === 1 ? '' : 's'} on this phone. Find them in the <a href="#/library">Library</a> and on each system page.`;
        document.querySelector('.updbar')?.remove();
      } catch (e) { $('.updstat').innerHTML = `<span class="err-text">Download stopped: ${esc(e.message)}. Already-downloaded files are kept – try again to resume.</span>`; }
      finally { btn.disabled = false; showLocal(); }
    };
    $('.connect').onclick = () => connect(sync.normalizeServer($('.srv').value));
    $('.srv').onkeydown = (e) => { if (e.key === 'Enter') $('.connect').click(); };
    $('.find').onclick = async () => {
      msg('Looking for a server…');
      try {
        const typed = sync.normalizeServer($('.srv').value);
        const { base, info } = await sync.findServer([typed, 'http://fieldcomms.local:8080']);
        st.server = base; $('.srv').value = base;
        msg(`✓ Found <b>${esc(info.name)}</b> at ${esc(base)} (${info.items} kit${info.items === 1 ? '' : 's'}).`);
        check();
      } catch (e) { msg(`${esc(e.message)} Open <code>/pair</code> on the server computer and scan the code instead.`, 'err'); }
    };
    $('.check').onclick = check;
    $('.syncnow').onclick = download;
    $('.auto').onchange = (e) => { st.autoCheck = e.target.checked; };
    $('.clear').onclick = async () => {
      if (!confirm('Remove all downloaded kits and files from this phone? Built-in guides stay. You can download them again from the server.')) return;
      await sync.clearCache(); await loadEquipment(); showLocal(); $('.updstat').textContent = 'Downloaded files removed.';
    };
    showLocal();
    if (pairedJustNow) { pairedJustNow = false; connect(st.server).then((ok) => ok && check()); }
    else if (arg === 'sync') download();
    else if (st.server) check();
  },

  admin() {
    const token = store.get('adminToken');
    if (!token) {
      app.innerHTML = `<section class="hero"><h1>Admin</h1><p>Enter the admin token printed in the server console${CONSOLE ? ' (saved in iphone/server/data/.admin-token)' : ' (saved in web/server/data/.admin-token)'}.</p></section>
        <form class="card login" style="max-width:420px"><label class="f">Admin token<input type="password" name="t" autocomplete="current-password" required></label><button class="btn primary">Sign in</button><div class="msg"></div></form>`;
      app.querySelector('.login').onsubmit = async (ev) => {
        ev.preventDefault(); const t = ev.target.t.value.trim();
        const r = await fetch('/api/auth/check', { method: 'POST', headers: { 'x-admin-token': t } });
        if (r.ok) { store.set('adminToken', t); pages.admin(); } else ev.target.querySelector('.msg').innerHTML = '<div class="notice err">Invalid token.</div>';
      };
      return;
    }
    const template = JSON.stringify({
      name: 'New Kit Name', category: 'VSAT', manufacturer: 'Vendor', model: 'Model-123', description: 'What this kit is and where it is used.',
      steps: [{ t: 'Overview', d: 'Explode the model to see all parts.', x: 0.5, h: [] }, { t: 'Replace the fan', d: 'Remove 4 screws, unplug, swap.', x: 1, h: ['Fan'] }],
      tree: { start: 'q1', nodes: {
        q1: { q: 'Does the unit power on?', opts: [['No', 'f1'], ['Yes', 'f2']] },
        f1: { fix: 'No power', sev: 'crit', steps: ['Check the power cable', 'Swap PSU'], step: 1 },
        f2: { fix: 'Contact support', sev: 'ok', steps: ['Record serial number', 'Call vendor support'] },
      } },
    }, null, 2);
    app.innerHTML = `<section class="hero"><div class="row" style="justify-content:space-between"><h1 style="margin:0">Admin – add new tech</h1><button class="btn sm logout">Sign out</button></div>
      <p>Upload a whole folder per piece of equipment: manuals (PDF), photos, configs, and 3D models (<b>.glb</b> preferred, or .gltf + .bin + textures). Add an optional <code>equipment.json</code> in the folder to define the name, category, a troubleshooting tree and 3D repair steps.</p></section>
      ${CONSOLE ? '<div class="notice" style="margin-bottom:14px">Everything uploaded here is downloaded by the <b>Field Comms</b> iPhone app (Settings → Download updates). <a href="/pair">Pair a phone</a> to link it to this server.</div>' : ''}
      <div class="layout2">
        <form class="card up">
          <label class="f">Equipment name <input type="text" name="name" placeholder="Defaults to the folder name"></label>
          <label class="f">Category <select name="category">${CATS.map((c) => `<option>${c}</option>`).join('')}</select></label>
          <label class="f">Description <textarea name="description" placeholder="What it is, where it's deployed…"></textarea></label>
          <label class="f"><span><input type="checkbox" name="merge"> Add files to an existing item with the same name (instead of creating a new one)</span></label>
          <div class="drop">Drag &amp; drop a folder (or files) here<br><br>
            <label class="btn">📁 Choose folder<input type="file" name="dir" webkitdirectory directory multiple hidden></label>
            <label class="btn">📄 Choose files<input type="file" name="files" multiple hidden></label>
            <div class="picked muted" style="margin-top:10px"></div></div>
          <div class="progress" style="margin:12px 0"><div></div></div>
          <button class="btn primary">⬆ Upload</button><div class="msg"></div>
        </form>
        <div class="card side"><h3>equipment.json template</h3>
          <p class="muted">Tree format matches the built-in guides. In <code>steps</code>, <code>h</code> lists mesh/node names from your 3D model to highlight; <code>x</code> is the explode amount (0–1). Fix nodes with <code>step</code> open that 3D step.</p>
          <button class="btn sm dl">Download template</button>
          <pre style="max-height:260px;overflow:auto;font-size:.75rem;background:var(--code);color:#cfe3ff;padding:10px;border-radius:8px">${esc(template)}</pre>
          <p class="muted">Allowed: pdf, images, txt/md/csv/json, glb/gltf/bin/ktx2, mp4/webm, docx/xlsx/pptx, cfg/conf/log, zip.</p></div>
      </div>
      <section><h2>Manage uploaded equipment</h2><div class="card"><table><thead><tr><th>Name</th><th>Category</th><th>Files</th><th></th></tr></thead><tbody class="mg"></tbody></table></div></section>`;
    const hdr = { 'x-admin-token': token };
    app.querySelector('.logout').onclick = () => { store.del('adminToken'); pages.admin(); };
    app.querySelector('.dl').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([template], { type: 'application/json' })); a.download = 'equipment.json'; a.click(); };

    let picked = []; // [{file, path}]
    const form = app.querySelector('.up'), drop = app.querySelector('.drop'), pickedEl = app.querySelector('.picked');
    const showPicked = () => { pickedEl.textContent = picked.length ? `${picked.length} file(s) selected – ${picked.slice(0, 4).map((p) => p.path).join(', ')}${picked.length > 4 ? '…' : ''}` : ''; };
    form.dir.onchange = () => { picked = [...form.dir.files].map((f) => ({ file: f, path: f.webkitRelativePath || f.name })); showPicked(); };
    form.files.onchange = () => { picked = [...form.files.files].map((f) => ({ file: f, path: f.name })); showPicked(); };
    drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
    drop.ondragleave = () => drop.classList.remove('over');
    drop.ondrop = async (e) => {
      e.preventDefault(); drop.classList.remove('over'); picked = [];
      const walk = (entry, pre) => new Promise((res) => {
        if (entry.isFile) entry.file((f) => { picked.push({ file: f, path: pre + f.name }); res(); }, res);
        else if (entry.isDirectory) {
          const rd = entry.createReader(); const all = [];
          const read = () => rd.readEntries(async (ents) => { if (!ents.length) { for (const en of all) await walk(en, pre + entry.name + '/'); res(); } else { all.push(...ents); read(); } }, res);
          read();
        } else res();
      });
      const entries = [...e.dataTransfer.items].map((i) => i.webkitGetAsEntry?.()).filter(Boolean);
      if (entries.length) { for (const en of entries) await walk(en, ''); } else picked = [...e.dataTransfer.files].map((f) => ({ file: f, path: f.name }));
      showPicked();
    };
    form.onsubmit = (ev) => {
      ev.preventDefault();
      const msg = form.querySelector('.msg'), bar = form.querySelector('.progress > div');
      if (!picked.length) { msg.innerHTML = '<div class="notice err">Choose a folder or files first.</div>'; return; }
      const fd = new FormData();
      fd.append('name', form.name.value); fd.append('category', form.category.value); fd.append('description', form.description.value);
      if (form.merge.checked) fd.append('mode', 'merge');
      picked.forEach((p) => { fd.append('paths', p.path); fd.append('files', p.file, p.file.name); }); // keep interleaved
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload'); xhr.setRequestHeader('x-admin-token', token);
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) bar.style.width = (e.loaded / e.total * 100) + '%'; };
      xhr.onload = async () => {
        let r = {}; try { r = JSON.parse(xhr.responseText); } catch { /* ignore */ }
        if (xhr.status === 401) { store.del('adminToken'); return pages.admin(); }
        if (xhr.status >= 300) { msg.innerHTML = `<div class="notice err">${esc(r.error || 'Upload failed')}</div>`; return; }
        msg.innerHTML = `<div class="notice">Uploaded to <a href="#/item/${encodeURIComponent(r.entry.id)}">${esc(r.entry.name)}</a> (${r.entry.files.length} file(s) stored).</div>` +
          (r.rejected?.length ? `<div class="notice err">Skipped (file type not allowed): ${esc(r.rejected.join(', '))}</div>` : '');
        picked = []; showPicked(); form.reset(); await loadEquipment(); renderManage();
      };
      xhr.onerror = () => { msg.innerHTML = '<div class="notice err">Network error during upload.</div>'; };
      msg.innerHTML = ''; bar.style.width = '0'; xhr.send(fd);
    };
    const renderManage = () => {
      const tb = app.querySelector('.mg');
      tb.innerHTML = equipment.length ? equipment.map((e) => `<tr><td><a href="#/item/${encodeURIComponent(e.id)}">${esc(e.name)}</a></td><td>${esc(e.category)}</td><td>${e.files.length}${e.models3d.length ? ' · 3D' : ''}${e.tree ? ' · tree' : ''}</td><td><button class="btn sm danger" data-del="${esc(e.id)}">Delete</button></td></tr>`).join('') : '<tr><td colspan="4" class="muted">No uploads yet.</td></tr>';
      tb.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
        if (!confirm('Delete this equipment and all its files?')) return;
        const r = await fetch('/api/equipment/' + encodeURIComponent(b.dataset.del), { method: 'DELETE', headers: hdr });
        if (r.ok) { delete TREES['up:' + b.dataset.del]; await loadEquipment(); renderManage(); } else alert('Delete failed');
      });
    };
    renderManage();
  },
};

// ---------- Router ----------
function route() {
  cleanup(); closeModal();
  const [, name = '', arg] = (location.hash || '#/').split('/');
  document.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.r === name));
  document.querySelector('.nav').classList.remove('open');
  if (CONSOLE && !['library', 'admin', 'item'].includes(name)) return void (location.hash = '#/admin');
  (pages[name] || pages.home)(arg);
  scrollTo(0, 0);
}
addEventListener('hashchange', route);

// ---------- Pairing deep links: fieldcomms://connect?server=http://… (from the server's /pair QR code) ----------
let pairedJustNow = false;
function handleOpenUrl(url) {
  try {
    const srv = sync.normalizeServer(new URL(url).searchParams.get('server'));
    if (!srv) return;
    sync.settings.server = srv; pairedJustNow = true;
    if (location.hash === '#/settings') route(); else location.hash = '#/settings';
  } catch { /* not a pairing link */ }
}
// Capacitor 8: native plugins are reached through registerPlugin (no bundler needed)
const CapApp = NATIVE ? (window.Capacitor?.Plugins?.App || window.Capacitor?.registerPlugin?.('App')) : null;
if (NATIVE) console.log('[fieldcomms] App plugin', CapApp ? 'ready' : 'missing');
CapApp?.addListener?.('appUrlOpen', (e) => handleOpenUrl(e.url));

// ---------- Update check on launch ----------
async function launchCheck() {
  if (!NATIVE || !sync.settings.server || !sync.settings.autoCheck) return;
  try {
    const p = await sync.checkUpdates(sync.settings.server);
    if (p.upToDate) return;
    const bar = document.createElement('div'); bar.className = 'updbar';
    bar.innerHTML = `<span>${p.added + p.changed + p.removed || p.files} update${(p.added + p.changed + p.removed || p.files) === 1 ? '' : 's'} ready on <b>${esc(p.remote.name)}</b> (${esc(sync.fmtBytes(p.bytes))})</span><a class="btn sm primary" href="#/settings/sync">Download</a><button class="btn sm" aria-label="Dismiss">✕</button>`;
    bar.querySelector('button').onclick = () => bar.remove();
    document.querySelector('.topbar').after(bar);
  } catch { /* offline in the field – that's fine */ }
}

duoLayout();
loadEquipment().then(async () => {
  route();
  const launch = await CapApp?.getLaunchUrl?.().catch(() => null);
  if (launch?.url) handleOpenUrl(launch.url);
  launchCheck();
});
