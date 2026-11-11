// Offline update cache for the phone apps.
// The app links to an update server (Settings), downloads every uploaded kit (docs, photos, 3D models,
// troubleshooting trees) and keeps them in IndexedDB so they work with no signal.

const DB_NAME = 'fieldcomms', FILES = 'files', META = 'meta';
const LS = { server: 'fc.server', recent: 'fc.recent', auto: 'fc.autoCheck' };
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
};

let dbp = null;
function db() {
  if (!dbp) dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore(FILES); r.result.createObjectStore(META); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  return dbp;
}
async function tx(store, mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode); const s = t.objectStore(store); let out;
    Promise.resolve(fn(s)).then((v) => { out = v; });
    t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
  });
}
const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const get = (store, k) => tx(store, 'readonly', (s) => req(s.get(k)));
const put = (store, k, v) => tx(store, 'readwrite', (s) => req(s.put(v, k)));
const del = (store, k) => tx(store, 'readwrite', (s) => req(s.delete(k)));
const keys = (store) => tx(store, 'readonly', (s) => req(s.getAllKeys()));

// ---------- Settings ----------
export const settings = {
  get server() { return ls.get(LS.server) || ''; },
  set server(v) { ls.set(LS.server, v || ''); if (v) { const r = settings.recent.filter((x) => x !== v); r.unshift(v); ls.set(LS.recent, JSON.stringify(r.slice(0, 6))); } },
  get recent() { try { return JSON.parse(ls.get(LS.recent) || '[]'); } catch { return []; } },
  get autoCheck() { return ls.get(LS.auto) !== '0'; },
  set autoCheck(v) { ls.set(LS.auto, v ? '1' : '0'); },
};

// "192.168.1.20" → "http://192.168.1.20:8080"; strips paths and trailing slashes
export function normalizeServer(input) {
  let s = String(input || '').trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'http://' + s;
  try {
    const u = new URL(s);
    // Plain LAN addresses (IP, name.local, single-word host) default to the server's port 8080
    const lan = /^\d+\.\d+\.\d+\.\d+$/.test(u.hostname) || /\.local$/i.test(u.hostname) || !u.hostname.includes('.');
    if (!u.port && u.protocol === 'http:' && lan) u.port = '8080';
    return u.origin;
  } catch { return ''; }
}

const timeout = (ms) => (typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined);

// Ask a server who it is. Resolves to {name, version, items} or throws.
export async function ping(base) {
  const r = await fetch(base + '/api/ping', { cache: 'no-store', signal: timeout(5000) });
  if (!r.ok) throw new Error(`Server answered ${r.status}`);
  const j = await r.json();
  if (j.app !== 'field-comms') throw new Error('That address is not a Field Comms update server');
  return j;
}

// Try the saved server, recent servers and any extra guesses; first one that answers wins.
export async function findServer(extra = []) {
  const cands = [...new Set([settings.server, ...settings.recent, ...extra].map(normalizeServer).filter(Boolean))];
  if (!cands.length) throw new Error('No server addresses to try yet – type one in, or scan the pairing QR code.');
  const tries = cands.map((c) => ping(c).then((info) => ({ base: c, info })));
  try { return await Promise.any(tries); } catch { throw new Error(`No server answered (tried ${cands.join(', ')}).`); }
}

// ---------- Cache ----------
export async function cachedIndex() { return (await get(META, 'index').catch(() => null)) || { items: [], server: null, syncedAt: null }; }
export async function loadCachedEquipment() { return (await cachedIndex()).items || []; }

const MIME = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', glb: 'model/gltf-binary', gltf: 'model/gltf+json', bin: 'application/octet-stream', ktx2: 'image/ktx2', mp4: 'video/mp4', webm: 'video/webm', txt: 'text/plain', md: 'text/plain', csv: 'text/plain', json: 'application/json', log: 'text/plain', cfg: 'text/plain', conf: 'text/plain' };
const mimeFor = (f) => MIME[(f.split('.').pop() || '').toLowerCase()] || 'application/octet-stream';
const fileKey = (id, f) => `${id}/${f}`;
const urlFor = (base, id, f) => `${base}/uploads/${encodeURIComponent(id)}/${f.split('/').map(encodeURIComponent).join('/')}`;

const objectUrls = new Map();
// Object URLs for every cached file of an item: { 'docs/manual.pdf': 'blob:…' }
export async function urlsFor(item) {
  const out = {};
  for (const f of item.files || []) {
    const k = fileKey(item.id, f);
    if (!objectUrls.has(k)) {
      const b = await get(FILES, k).catch(() => null);
      if (b) objectUrls.set(k, URL.createObjectURL(b));
    }
    if (objectUrls.has(k)) out[f] = objectUrls.get(k);
  }
  return out;
}

// Compare the server's list with what's on the phone.
export async function checkUpdates(base) {
  const r = await fetch(base + '/api/sync', { cache: 'no-store', signal: timeout(15000) });
  if (!r.ok) throw new Error(`Server answered ${r.status}`);
  const remote = await r.json();
  if (remote.app !== 'field-comms') throw new Error('Not a Field Comms update server');
  const local = await cachedIndex();
  const lmap = new Map((local.items || []).map((e) => [e.id, e]));
  const have = new Set(await keys(FILES));
  let added = 0, changed = 0, bytes = 0, files = 0;
  for (const e of remote.items) {
    const l = lmap.get(e.id);
    if (!l) added++; else if (l.uploadedAt !== e.uploadedAt || JSON.stringify(l.fileInfo) !== JSON.stringify(e.fileInfo)) changed++;
    for (const f of e.files) {
      const info = e.fileInfo?.[f]; const old = l?.fileInfo?.[f];
      if (!have.has(fileKey(e.id, f)) || !old || !info || old.size !== info.size || old.mtime !== info.mtime) { files++; bytes += info?.size || 0; }
    }
  }
  const removed = (local.items || []).filter((e) => !remote.items.some((x) => x.id === e.id)).length;
  return { remote, added, changed, removed, files, bytes, upToDate: !added && !changed && !removed && !files };
}

// Download what changed, drop what was removed. onProgress({done, total, file, bytes})
export async function syncNow(base, onProgress = () => {}) {
  const plan = await checkUpdates(base);
  const { remote } = plan;
  const local = await cachedIndex();
  const lmap = new Map((local.items || []).map((e) => [e.id, e]));
  const have = new Set(await keys(FILES));
  const todo = [];
  for (const e of remote.items) for (const f of e.files) {
    const info = e.fileInfo?.[f], old = lmap.get(e.id)?.fileInfo?.[f];
    if (!have.has(fileKey(e.id, f)) || !old || !info || old.size !== info.size || old.mtime !== info.mtime) todo.push([e, f, info?.size || 0]);
  }
  let done = 0, got = 0;
  onProgress({ done, total: todo.length, bytes: 0, totalBytes: plan.bytes });
  for (const [e, f, size] of todo) {
    onProgress({ done, total: todo.length, file: `${e.name} · ${f}`, bytes: got, totalBytes: plan.bytes });
    const r = await fetch(urlFor(base, e.id, f), { cache: 'no-store' });
    if (!r.ok) throw new Error(`Could not download ${f} (${r.status})`);
    const blob = new Blob([await r.arrayBuffer()], { type: mimeFor(f) });
    await put(FILES, fileKey(e.id, f), blob);
    const k = fileKey(e.id, f); if (objectUrls.has(k)) { URL.revokeObjectURL(objectUrls.get(k)); objectUrls.delete(k); }
    done++; got += size;
  }
  // Remove files and items the server no longer has
  const want = new Set(remote.items.flatMap((e) => e.files.map((f) => fileKey(e.id, f))));
  for (const k of await keys(FILES)) if (!want.has(k)) { await del(FILES, k); if (objectUrls.has(k)) { URL.revokeObjectURL(objectUrls.get(k)); objectUrls.delete(k); } }
  const index = { items: remote.items, server: { base, name: remote.name, version: remote.version }, syncedAt: new Date().toISOString() };
  await put(META, 'index', index);
  onProgress({ done, total: todo.length, bytes: got, totalBytes: plan.bytes, finished: true });
  return { ...plan, index };
}

export async function storageUsed() {
  let total = 0;
  try { const est = await navigator.storage?.estimate?.(); if (est?.usage) return est.usage; } catch { /* fall back */ }
  for (const k of await keys(FILES)) { const b = await get(FILES, k); total += b?.size || 0; }
  return total;
}

export async function clearCache() {
  for (const u of objectUrls.values()) URL.revokeObjectURL(u);
  objectUrls.clear();
  await tx(FILES, 'readwrite', (s) => req(s.clear()));
  await tx(META, 'readwrite', (s) => req(s.clear()));
}

export const fmtBytes = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : n < 1073741824 ? `${(n / 1048576).toFixed(1)} MB` : `${(n / 1073741824).toFixed(2)} GB`);
