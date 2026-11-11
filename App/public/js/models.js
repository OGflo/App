// Procedural exploded-view models. Generic, representative geometry (not manufacturer CAD).
// Part fields:
//  id     unique id (steps highlight by id OR id prefix, e.g. "lan" matches lan0..lan7)
//  label  name shown in the parts list / label
//  g      geometry: ['box',w,h,d] ['cyl',rTop,rBot,h] ['sph',r] ['cone',r,h] ['torus',R,tube] ['dish',r,theta,phiStart,phiLen]
//  p      position [x,y,z]   r rotation [rx,ry,rz]   c color   m metalness   o opacity
//  e      explode offset in world space; el = explode offset in the part's local (rotated) frame
//  info   one-line description
const PI = Math.PI;
const range = (n, f) => Array.from({ length: n }, (_, i) => f(i));
// Real-size modelling: write sizes/positions in millimetres; 1 scene unit = 50 mm.
const M = (...v) => v.map((n) => n / 50);
// Printed label on a face. face: 'front' (+z), 'rear' (-z), 'top' (+y). Attached to part `of`.
const lbl = (of, text, [x, y, z], [w, h], face = 'front', color = '#20242a') => ({
  id: `${of}-t-${text}-${x}-${y}`, of, g: ['text', ...M(w, h), text], c: color, p: M(x, y, z),
  r: face === 'rear' ? [0, PI, 0] : face === 'top' ? [-PI / 2, 0, 0] : [0, 0, 0],
});
// RJ45 jack seen from the front: dark socket + metal shield lip.
// Pan-head screw (spins out along its own axis in repair animations). Head sits on top at y; shank goes down into the part.
const SCREW = (id, x, y, z, { r = 3.5, len = 10, label = 'Cover screw (Phillips #1)', lift = 220, c = '#b9bec5', call } = {}) => ({
  id, label, g: ['cyl', ...M(r, r, len)], p: M(x, y + r - len / 2, z), c, m: 0.9, rough: 0.3, spin: true, e: M(0, lift, 0),
  info: 'Keep screws in a tray – they are different lengths. Do not over-tighten on reassembly.', ...(call ? { call } : {}),
});
const HOLE = (of, i, x, y, z, r = 3.8) => ({ id: `${of}-hole${i}`, of, g: ['cyl', ...M(r, r, 0.8)], p: M(x, y, z), c: '#0d0e10' });
const BOSS = (of, i, x, y, z, h = 30) => ({ id: `${of}-boss${i}`, of, g: ['cyl', ...M(3.5, 4.5, h)], p: M(x, y, z), c: '#b08d57', m: 0.9, rough: 0.35 });
const RJ = (id, label, x, y, z, extra = {}) => ({ id, label, g: ['box', ...M(15.5, 13.5, 3)], p: M(x, y, z), c: '#16181b', m: 0.3, ...extra });
const T568B = ['#f5d6b8', '#f28c28', '#d9f0d0', '#1f5fd6', '#cfe0ff', '#2e9b3a', '#e8d6c6', '#7a4a21'];


// ---- LS-248 geometry helpers (scene units: 1.3 m dish ≈ 2.94 units) ----
// vsA(s, x, z): point s units along the feed axis from the dish apex, offset x (left/right) and z (perpendicular).
const VS_T = 0.88, VS_C = Math.cos(VS_T), VS_S = Math.sin(VS_T);
const vsA = (s, x = 0, z = 0) => [x, 3 + s * VS_C - z * VS_S, s * VS_S + z * VS_C];
// vsDish(x, y, z): a point in the reflector's own frame (as the petals are built) → world
const vsDish = (x, y, z) => { const t = -2.27, c = Math.cos(t), sn = Math.sin(t); return [x, 3 + y * c - z * sn, y * sn + z * c]; };
// Bolt (built as a real screw in Blender; spins out along its own axis = its local +y)
const VBOLT = (id, pos, r, { rad = 0.022, len = 0.09, lift = 0.35, label = 'Bolt', call, info } = {}) => ({
  id, label, g: ['cyl', rad, rad, len], p: pos, r, c: '#b9bec5', m: 0.9, rough: 0.3, spin: true, el: [0, lift, 0], elseq: [0, lift, 0],
  ...(call ? { call } : {}), ...(info ? { info } : {}),
});

export const MODELS = {
  starlink: {
    name: 'Starshield terminal kit (Performance Gen 3)',
    note: 'Starshield on a Starlink Performance (Gen 3) dish (609 × 396 × 40 mm, 5.2 kg) with the Advanced Power Supply (AC power + network combiner, 310 × 180 × 40 mm), in-case Wi-Fi router and a separate patch to the C1121. IP68/IP69K, −40 °F to 140 °F, wind to 170 mph. Kits are swap-as-a-unit; field fixes are cable, connector, placement and power.',
    // Real sizes: Performance Gen 3 dish 609 × 396 × 40 mm; Advanced Power Supply 310 × 180 × 40 mm; Gen 3 router 300 × 120 × 55 mm.
    parts: [
      { id: 'base', label: 'Kickstand foot', g: ['box', ...M(170, 12, 90)], p: M(0, 6, -185), c: '#2d2f33', e: M(0, 0, -420), info: 'Sits flat on firm, level ground. Ballast or stake it against wind.' },
      { id: 'mast', call: 'Kickstand', label: 'Kickstand', g: ['cyl', ...M(13, 15, 200)], p: M(0, 79, -112), r: [0.753, 0, 0], c: '#e4e6e9', e: M(0, 0, -260), info: 'Clicks fully into the back of the dish. A loose kickstand lets the dish rock and drop signal.' },
      { id: 'housing', label: 'Dish housing (rear)', g: ['box', ...M(609, 36, 396)], p: M(0, 145, 0), r: [0.7, 0, 0], c: '#d9dce0', e: M(0, 230, 0), info: 'Performance Gen 3 dish, 609 × 396 × 40 mm, 5.2 kg. IP68/IP69K, survives 3 ft submersion for 30 min. Contains the phased-array electronics. Not field serviceable.' },
      { id: 'face', call: 'Radome (dish face)', label: 'Dish face (radome)', g: ['box', ...M(605, 4, 392)], p: M(0, 160.3, 12.9), r: [0.7, 0, 0], c: '#f1f2f4', m: 0.1, rough: 0.6, e: M(0, 480, 0), info: 'Keep clear of snow/debris. Never pressure-wash or paint.' },
      { id: 'connector', call: 'Dish cable connector', label: 'Dish cable connector', g: ['cyl', ...M(9, 9, 35)], p: M(150, 114, -22), r: [0.7, 0, 0], c: '#111', e: M(60, -40, -240), info: 'Weatherproof push-lock Starshield plug. Inspect for water, corrosion, bent pins.' },
      { id: 'cable', call: 'Starshield cable', label: 'Starshield cable', g: ['torus', ...M(70, 4)], p: M(330, 4, -140), r: [PI / 2, 0, 0], c: '#151515', e: M(400, 0, -240), info: 'Proprietary Starshield cable, dish → combiner. Do not cut/splice; replace the whole cable.' },
      { id: 'router', call: 'Advanced Power Supply (AC/DC)', label: 'AC power adapter / network combiner (Advanced Power Supply)', g: ['box', ...M(310, 40, 180)], p: M(-420, 20, 0), c: '#e6e8eb', e: M(-320, 0, 0), info: '310 × 180 × 40 mm, 2.1 kg. Input 100–240 VAC or 12–56 VDC. Powers the dish over the Starshield cable and has two network outputs: one to the Wi-Fi router, one to the C1121. (Representative shape – check your unit.)' },
      lbl('router', 'ADVANCED POWER SUPPLY', [-420, 40.3, 10], [200, 16], 'top', '#555c66'),
      ...range(3, (i) => ({ id: 'router-port' + i, of: 'router', g: ['box', ...M(15.5, 13.5, 3)], p: M(-470 + i * 40, 20, 91.5), c: '#16181b' })),
      lbl('router', 'DISH     OUT 1     OUT 2', [-430, 8, 90.3], [130, 7]),
      { id: 'ethadapter', call: 'Starshield Wi-Fi router', label: 'Starshield Wi-Fi router (in case)', g: ['box', ...M(300, 120, 50)], p: M(-760, 60, -40), c: '#f4f5f7', rough: 0.55, e: M(-420, 0, 120), info: 'Gen 3 router, 300 × 120 × 55 mm. Fed by its own cable from the combiner. Keep it in router mode (Bypass OFF) so Wi-Fi stays on.' },
      { id: 'ethadapter-ring', of: 'ethadapter', g: ['torus', ...M(28, 2.5)], p: M(-760, 64, -14.5), c: '#c9ccd1', m: 0.4 },
      { id: 'ethadapter-dot', of: 'ethadapter', g: ['cyl', ...M(4, 4, 2)], p: M(-760, 64, -14), r: [PI / 2, 0, 0], c: '#555' },
      { id: 'ethadapter-led', of: 'ethadapter', g: ['box', ...M(3, 3, 1)], p: M(-902, 8, -14.5), c: '#22c55e' },
      ...range(2, (i) => ({ id: 'ethadapter-lan' + i, of: 'ethadapter', g: ['box', ...M(15.5, 13.5, 3)], p: M(-772 + i * 22, 14, -66), c: '#16181b' })),
      lbl('ethadapter', 'STARSHIELD   LAN   LAN   POWER', [-760, 30, -65.6], [120, 8], 'rear'),
      { id: 'wificable', label: 'Patch: combiner → Wi-Fi router', g: ['torus', ...M(55, 3.5)], p: M(-640, 4, 130), r: [PI / 2, 0, 0], c: '#e0e0e0', e: M(-440, 0, 320), info: 'Separate cable from the combiner to the Wi-Fi router.' },
      { id: 'ethcable', label: 'Patch: combiner → C1121 WAN', g: ['torus', ...M(60, 3.5)], p: M(-300, 4, 190), r: [PI / 2, 0, 0], c: '#2b6cff', e: M(-160, 0, 480), info: 'Separate Cat6 from the combiner to C1121-8P Gi0/0/0 (not via the Wi-Fi router).' },
    ],
    steps: [
      { t: 'Overview', d: 'Performance Gen 3 dish on its kickstand, Advanced Power Supply (AC power + network combiner), Wi-Fi router and patch cables. Sets up in under 20 minutes. Drag to rotate, pinch to zoom, slide to explode.', x: 0, h: [] },
      { t: '1. Clear & inspect the dish face', d: 'Check for snow, ice, leaves or impact damage. Brush off gently. A cracked face = replace the dish (open a Starshield support ticket).', x: 0.35, h: ['face'] },
      { t: '2. Check the dish cable connector', d: 'Unplug the AC power adapter / combiner first. Unplug the cable at the dish, look for water, green corrosion or bent pins. Re-seat until it clicks and the seal sits flush.', x: 0, h: ['connector'], seq: [{ p: ['connector'], t: 'Power off, then unplug the cable at the dish' }] },
      { t: '3. Replace the Starshield cable', d: 'Unplug the combiner. Disconnect the cable at the combiner, then at the dish. Route the new cable with drip loops and no tight bends or crush points. Connect dish end first, then combiner. Power on and wait up to 15 min for boot/search.', x: 0, h: ['cable', 'connector', 'router'], seq: [{ p: ['connector'], t: 'Unplug the cable at the dish' }, { p: ['cable'], t: 'Unplug at the combiner and lay out the new cable' }] },
      { t: '4. Combiner outputs: Wi-Fi router and C1121', d: 'The combiner has two separate network cables: one to the in-case Starshield Wi-Fi router, one to the C1121-8P Gi0/0/0 WAN. Re-seat both. The C1121 cable must go to the combiner, not the Wi-Fi router.', x: 0, h: ['router', 'ethadapter', 'wificable', 'ethcable'], seq: [{ p: ['wificable'], t: 'Re-seat the cable to the Wi-Fi router' }, { p: ['ethcable'], t: 'Re-seat the separate cable to the C1121 WAN' }] },
      { t: '5. Kickstand & ground placement', d: 'Click the kickstand fully into the dish and set the foot on firm, level ground with a clear view of the sky. Ballast or stake against wind; keep it out of standing water.', x: 0, h: ['mast', 'base'], seq: [{ p: ['mast'], t: 'Unclip the kickstand from the dish' }, { p: ['base'], t: 'Check the foot sits flat and level' }] },
    ],
  },

  c1121: {
    // Real size: 274 × 199 × 42 mm (W × D × H). Port order is approximate – check the labels on your unit.
    name: 'Cisco C1121-8P ISR router',
    note: 'Built to the real size (274 × 199 × 42 mm). Port positions are approximate – always read the printed labels on your unit. The C1121-8P is replaced as a whole unit (RMA); do not open the chassis in the field.',
    parts: [
      { id: 'chassis', label: 'Chassis', g: ['box', ...M(274, 36, 199)], p: M(0, 22, 0), c: '#c4c9cf', m: 0.55, rough: 0.35, info: 'Silver desktop / wall-mount ISR 1100 chassis.' },
      lbl('chassis', 'cisco', [-110, 28, 99.7], [34, 10], 'front', '#1b5fa8'),
      lbl('chassis', 'ISR 1100 · C1121-8P', [-110, 15, 99.7], [46, 5]),
      lbl('chassis', 'SYS  WAN  VPN  PoE', [-73, 22, 99.7], [28, 3.5]),
      { id: 'cover', label: 'Top cover', g: ['box', ...M(274, 4, 199)], p: M(0, 42, 0), c: '#d3d7dc', m: 0.55, rough: 0.35, e: M(0, 130, 0), tilt: [0.18, 0, -0.12], info: 'Removing voids warranty – shown for orientation only.' },
      lbl('cover', 'cisco  ISR 1100', [70, 44.2, 30], [60, 12], 'top', '#9aa1a9'),
      { id: 'board', label: 'Main board', g: ['box', ...M(262, 2, 186)], p: M(0, 8, 0), c: '#1f6b3a', e: M(0, 60, 0), info: 'CPU, DRAM, flash and switch ASIC.' },
      { id: 'cpu', label: 'CPU / SoC', g: ['box', ...M(28, 4, 28)], p: M(20, 11, -25), c: '#555', m: 0.6, e: M(0, 65, 0) },
      { id: 'dram', label: 'DRAM (soldered)', g: ['box', ...M(48, 3, 12)], p: M(-50, 10.5, -45), c: '#222', e: M(0, 65, 0) },
      { id: 'sfp', label: 'WAN SFP (combo with Gi0/0/0)', g: ['box', ...M(14, 10, 3)], p: M(-44, 21, 101), c: '#aeb4bc', m: 0.9, e: M(0, 50, 30), call: 'SFP 0/0/0 (combo)', info: 'Combo with Gi0/0/0: use RJ45 OR SFP, not both.' },
      lbl('chassis', 'SFP 0/0/0', [-44, 10, 99.7], [16, 4]),
      RJ('wan', 'WAN Gi0/0/0 (RJ45)', -24, 21, 101, { e: M(0, 50, 30), call: 'WAN GE 0/0/0', info: 'WAN – patch from the Starshield AC power adapter / network combiner.' }),
      lbl('chassis', 'GE 0/0/0', [-24, 10, 99.7], [16, 4]),
      ...range(8, (i) => RJ('lan' + i, `LAN Gi0/1/${i} (PoE)`, 10 + i * 16.5, 21, 101, { e: M(0, 50, 30), call: i === 0 ? 'LAN 0/1/0–7 (PoE)' : undefined, info: '8-port switched LAN with PoE (-8P). Uplink to the C9200CX or power PoE devices here.' })),
      ...range(8, (i) => lbl('chassis', `0/1/${i}`, [10 + i * 16.5, 10, 99.7], [13, 4])),
      lbl('chassis', 'LAN  ·  PoE', [68, 33, 99.7], [40, 4.5]),
      { id: 'wanplug', label: 'WAN patch cable', g: ['box', ...M(12, 11, 30)], p: M(-24, 21, 118), c: '#2b6cff', e: M(0, 0, 160), call: 'WAN patch cable', info: 'From the Starshield AC power adapter / network combiner. Listen/feel for the latch click.' },
      RJ('console', 'Console (RJ45 + USB)', -95, 21, -101, { c: '#2d6f9e', e: M(0, 40, -60), call: 'Console RJ45', info: '9600 8N1. Use for password recovery and config when IP access is lost.' }),
      lbl('chassis', 'CON', [-95, 10, -99.7], [14, 4], 'rear'),
      { id: 'power', label: 'DC power jack', g: ['cyl', ...M(5.5, 5.5, 8)], p: M(105, 21, -103), r: [PI / 2, 0, 0], c: '#111', e: M(0, 40, -60), call: 'DC power in' },
      { id: 'dcplug', label: 'DC plug (from adapter)', g: ['cyl', ...M(5, 5, 26)], p: M(105, 21, -117), r: [PI / 2, 0, 0], c: '#1a1a1a', e: M(0, 0, -120), info: 'Barrel plug from the external adapter – push fully home.' },
      lbl('chassis', 'PWR', [105, 9, -99.7], [14, 4], 'rear'),
      lbl('chassis', 'RESET', [70, 9, -99.7], [16, 4], 'rear'),
      { id: 'psu', label: 'External power adapter', g: ['box', ...M(110, 34, 60)], p: M(210, 17, -80), c: '#141414', e: M(90, 0, -60), info: 'PoE models need the higher-wattage adapter for PoE budget. Swap if LEDs are dark.' },
      ...[[-125, -87], [125, -87], [-125, 87], [125, 87]].map(([x, z], i) => SCREW('screw' + i, x, 44, z, { call: i === 0 ? 'Cover screws ×4 (Phillips #1)' : undefined })),
      ...[[-125, -87], [125, -87], [-125, 87], [125, 87]].map(([x, z], i) => HOLE('cover', i, x, 44.2, z)),
      ...[[-125, -87], [125, -87], [-125, 87], [125, 87]].map(([x, z], i) => BOSS('chassis', i, x, 22, z)),
      { id: 'reset', label: 'Reset button (pinhole)', g: ['cyl', ...M(2.2, 2.2, 3)], p: M(70, 18, -100.5), r: [PI / 2, 0, 0], c: '#0d0e10', call: 'Reset (pinhole)', info: 'Hold 10 s with a pin during boot to clear the config – only if your SOP allows it.' },
      { id: 'lock', label: 'Kensington lock slot', g: ['box', ...M(7, 3.5, 2)], p: M(-125, 22, -100.3), c: '#0d0e10', call: 'Lock slot' },
      ...range(4, (i) => ({ id: 'led' + i, label: ['SYS LED', 'WAN LED', 'VPN LED', 'PoE LED'][i], g: ['box', ...M(3, 2, 1)], p: M(-82 + i * 6, 30, 100), c: i === 0 ? '#22c55e' : '#3b4a3d', call: i === 0 ? 'Status LEDs: SYS · WAN · VPN · PoE' : undefined, info: 'SYS green = running. Amber/off = boot fault or no power.' })),
      ...range(4, (i) => ({ id: 'foot' + i, label: 'Rubber foot', g: ['cyl', ...M(8, 8, 4)], p: M(i % 2 ? 115 : -115, 2, i < 2 ? 80 : -80), c: '#000', e: M(0, -40, 0) })),
    ],
    steps: [
      { t: 'Overview', d: 'Real size 274 × 199 × 42 mm. Front: WAN SFP + RJ45 combo (Gi0/0/0), then 8× PoE LAN (Gi0/1/0–7). Rear: console and DC power. Port order is approximate – read the labels on your unit.', x: 0, h: [] },
      { t: '1. Power', d: 'No LEDs? Check the adapter LED, wall/generator power, and that the barrel plug is fully seated. Swap adapter with a known-good one of the same wattage.', x: 0, h: ['psu', 'power', 'dcplug', 'led'], seq: [{ p: ['dcplug'], t: 'Pull the DC plug from the rear jack' }, { p: ['psu'], t: 'Move the adapter clear – check its LED and the mains lead' }] },
      { t: '2. WAN from Starshield', d: 'Re-seat the WAN patch from the combiner. Link LED should be lit. Use the SFP only with an SFP fitted and the combo set to SFP media-type.', x: 0, h: ['wan', 'wanplug', 'sfp'], seq: [{ p: ['wanplug'], t: 'Press the latch and pull the WAN patch out' }, { p: ['wan', 'sfp'], t: 'Inspect the Gi0/0/0 jack and SFP cage for damage or dirt' }] },
      { t: '3. LAN / PoE ports', d: 'The C9200CX uplink and PoE devices plug into Gi0/1/x. Move the device to a different port to rule out a bad port; check "show power inline".', x: 0.5, h: ['lan'] },
      { t: '4. Console access', d: 'Blue console cable to the RJ45 console on the rear (or the USB console). 9600 baud, 8 data, no parity, 1 stop, no flow control. Reset pinhole is next to the power jack.', x: 0.3, h: ['console', 'reset'] },
      { t: '5. Inside (reference only)', d: 'No field-replaceable parts inside. Board/SoC/DRAM failures = RMA the whole router; restore config from backup. Opening the cover voids the warranty.', x: 0, h: ['screw', 'cover', 'board', 'cpu', 'dram'], seq: [{ p: ['screw'], t: 'Remove the 4 cover screws (Phillips #1)' }, { p: ['cover'], t: 'Lift the top cover off' }, { p: ['board', 'cpu', 'dram'], t: 'Main board, CPU and DRAM – nothing to replace in the field' }] },
    ],
  },

  c9200cx: {
    // Real size: 269 × 244 × 44 mm. Front layout follows Cisco's published 3D model.
    name: 'Cisco Catalyst C9200CX-12P-2X2G',
    // Cisco's own published 3D model (Sketchfab, embed only – needs internet)
    official: { by: 'Cisco', uid: 'c0eb68411eb749199ff94b1d72ab586e', page: 'https://sketchfab.com/3d-models/c9200cx-12p-2x2g-c0eb68411eb749199ff94b1d72ab586e' },
    note: 'Built to the real size (269 × 244 × 44 mm), front layout matched to Cisco\'s 3D model: console, 12× PoE+ (odd ports top row), 2× 1G copper + 2× 10G SFP+ uplinks, AC inlet. Fanless – whole-unit replacement.',
    parts: [
      { id: 'chassis', label: 'Chassis', g: ['box', ...M(269, 38, 244)], p: M(0, 21, 0), c: '#dde1e5', m: 0.35, rough: 0.4, info: 'Fanless compact chassis – keep the top fins clear; derate in hot cases.' },
      { id: 'chassis-face', of: 'chassis', g: ['box', ...M(266, 36, 1)], p: M(0, 22, 122.3), c: '#c3c8ce', m: 0.4 },
      lbl('chassis', 'cisco', [-115, 36, 123], [20, 5], 'front', '#1b5fa8'),
      lbl('chassis', 'CONSOLE', [-115, 8, 123], [20, 3.5]),
      lbl('chassis', 'C9200CX-12P-2X2G', [104, 37, 123], [40, 4]),
      ...range(6, (c) => ({ id: 'chassis-led' + c, of: 'chassis', g: ['box', ...M(4, 1.6, 1)], p: M(-80 + c * 16.5, 39.5, 123), c: '#22c55e' })),
      { id: 'cover', label: 'Top cover / heat-sink fins', g: ['box', ...M(269, 4, 244)], p: M(0, 42, 0), c: '#c9cdd3', m: 0.7, rough: 0.3, e: M(0, 230, 0), tilt: [0.16, 0, 0.1], info: 'Passive cooling – the fins are the heat sink. Never block or cover them.' },
      ...range(13, (i) => ({ id: 'cover-fin' + i, of: 'cover', g: ['box', ...M(3, 5, 200)], p: M(-108 + i * 18, 46.5, -8), c: '#b8bec6', m: 0.8, rough: 0.3 })),
      lbl('cover', 'cisco  Catalyst 9200CX', [0, 44.3, 105], [80, 9], 'top', '#7d858f'),
      { id: 'board', label: 'Main board', g: ['box', ...M(258, 2, 232)], p: M(0, 7, 0), c: '#1f6b3a', e: M(0, 110, 0) },
      { id: 'heatsink', label: 'Internal heat spreader', g: ['box', ...M(80, 10, 60)], p: M(30, 13, -30), c: '#999', m: 0.8, e: M(0, 160, 0) },
      { id: 'mode', label: 'Mode button / LEDs', g: ['cyl', ...M(3, 3, 3)], p: M(-126, 30, 124), r: [PI / 2, 0, 0], c: '#eee', e: M(0, 110, 40), call: 'Mode button', info: 'Hold during boot for recovery; press to cycle LED modes (STAT/SPEED/PoE).' },
      RJ('console', 'Console (RJ45 + USB-C)', -112, 22, 124, { c: '#2d6f9e', e: M(0, 110, 40), call: 'Console RJ45 / USB-C', info: 'RJ45 or USB-C console, 9600 8N1.' }),
      ...range(12, (i) => RJ('poe' + i, `Gi1/0/${i + 1} PoE+`, -82 + Math.floor(i / 2) * 16.5, i % 2 ? 14 : 30.5, 124, { e: M(0, 110, 40), call: i === 0 ? 'PoE+ Gi1/0/1–12' : undefined, info: 'Up to 30 W per port (PoE+) within the switch PoE budget. Odd ports top row, even ports bottom.' })),
      lbl('chassis', '1  3  5  7  9  11', [-41, 4.5, 123], [84, 3.5]),
      ...range(2, (i) => RJ('upc' + i, `Copper uplink Gi1/1/${i + 1}`, 22 + i * 16.5, 22, 124, { e: M(0, 110, 40), call: i === 0 ? '1G uplinks Gi1/1/1–2' : undefined, info: '1G copper uplink (e.g. to the C1121 LAN).' })),
      lbl('chassis', '1G UPLINK', [30, 8, 123], [30, 3.5]),
      ...range(2, (i) => ({ id: 'sfp' + i, label: `SFP+ cage Te1/1/${i + 3}`, g: ['box', ...M(14, 10, 3)], p: M(60 + i * 17, 22, 124), c: '#aeb4bc', m: 0.9, e: M(0, 110, 40), call: i === 0 ? '10G SFP+ Te1/1/3–4' : undefined, info: '10G SFP+ uplink. Use Cisco-supported optics.' })),
      lbl('chassis', '10G SFP+', [68, 8, 123], [26, 3.5]),
      { id: 'sfpmod', label: 'SFP+ module', g: ['box', ...M(13, 8.5, 56)], p: M(60, 22, 140), c: '#d7dbe2', m: 0.9, e: M(0, 110, 150), info: 'Pull by the bail latch. Clean fiber ends before inserting.' },
      { id: 'power', label: 'AC power inlet (front)', g: ['box', ...M(28, 20, 5)], p: M(112, 21, 124), c: '#111', e: M(0, 110, 50), call: 'AC power inlet', info: 'Front-mounted AC inlet. Fit the cord retainer clip; confirm the supply covers the PoE load.' },
      lbl('chassis', '100-240V~', [112, 7, 123], [26, 3.5]),
      { id: 'lock', label: 'Security lock slot', g: ['box', ...M(8, 4, 2)], p: M(-100, 22, -123), c: '#555', e: M(0, 0, -60), call: 'Lock slot' },
      ...[[-122, -110], [122, -110], [-122, 110], [122, 110]].map(([x, z], i) => SCREW('screw' + i, x, 44, z, { call: i === 0 ? 'Lid screws ×4 (Phillips #1)' : undefined })),
      ...[[-122, -110], [122, -110], [-122, 110], [122, 110]].map(([x, z], i) => HOLE('cover', i, x, 44.2, z)),
      ...[[-122, -110], [122, -110], [-122, 110], [122, 110]].map(([x, z], i) => BOSS('chassis', i, x, 22, z)),
      { id: 'cord', label: 'AC power cord plug', g: ['box', ...M(24, 16, 40)], p: M(112, 21, 146), c: '#16171a', e: M(0, 0, 160), info: 'IEC C13 plug – the retainer clip stops it working loose.' },
      { id: 'retainer', label: 'Power cord retainer clip', g: ['box', ...M(30, 3, 22)], p: M(112, 31, 136), c: '#9aa0a6', m: 0.8, e: M(0, 60, 40), info: 'Flip the clip up before pulling the cord.' },
      { id: 'bracket', label: 'Mount bracket / magnet', g: ['box', ...M(240, 3, 210)], p: M(0, 0.5, 0), c: '#777', m: 0.7, e: M(0, -70, 0) },
    ],
    steps: [
      { t: 'Overview', d: 'Real size 269 × 244 × 44 mm. Front, left to right: console + mode button, 12× PoE+ (odd ports top row), 2× 1G copper uplinks, 2× 10G SFP+, AC power inlet. Top: fanless heat-sink fins.', x: 0, h: [] },
      { t: '1. PoE downlinks', d: 'Device not powering? Check "show power inline". Move to another port. Verify switch PoE budget isn\'t exhausted.', x: 0.45, h: ['poe'] },
      { t: '2. Uplinks & SFP+', d: 'Pull the SFP by its bail, inspect, clean fiber with a one-click cleaner, re-insert until it clicks. Copper uplink to the C1121 goes in Gi1/1/x.', x: 0, h: ['sfp', 'sfpmod', 'upc'], seq: [{ p: ['sfpmod'], t: 'Open the bail latch and slide the SFP+ module out' }, { p: ['sfp'], t: 'Inspect the cage; clean the fibre ends before re-inserting' }] },
      { t: '3. Console & mode button', d: 'RJ45 or USB-C console at 9600 8N1, far left of the front. Mode button cycles LED views to spot PoE / err-disabled ports.', x: 0.5, h: ['console', 'mode'] },
      { t: '4. Power & mounting', d: 'AC inlet is on the front right – secure the cord retainer. Fanless: keep the top fins clear and shaded. Replace the bracket if magnets/screws are loose.', x: 0, h: ['power', 'cord', 'retainer', 'bracket', 'lock'], seq: [{ p: ['retainer'], t: 'Flip the cord retainer clip up' }, { p: ['cord'], t: 'Pull the AC cord straight out' }, { p: ['bracket'], t: 'Check the mounting bracket / magnets' }] },
      { t: '5. Inside (reference only)', d: 'No field-replaceable internals. Swap the whole switch and restore config from backup / USB.', x: 0, h: ['screw', 'cover', 'board', 'heatsink'], seq: [{ p: ['screw'], t: 'Remove the 4 lid screws (Phillips #1)' }, { p: ['cover'], t: 'Lift the finned lid off' }, { p: ['heatsink'], t: 'Internal heat spreader' }, { p: ['board', 'poe', 'upc', 'sfp', 'console', 'mode', 'power'], t: 'Main board with its ports – whole-unit replacement' }] },
    ],
  },

  ap: {
    name: 'Wireless Access Point (PoE)',
    note: 'Generic ceiling/wall-mount enterprise AP powered by PoE.',
    parts: [
      { id: 'bracket', label: 'Mount bracket', g: ['box', 3.4, 0.08, 3.4], p: [0, 1.25, 0], c: '#9aa0a6', m: 0.6, e: [0, 2.0, 0], info: 'Ceiling/wall plate. AP slides/twists onto it.' },
      { id: 'pin', label: 'Security pin / screw', g: ['cyl', 0.06, 0.06, 0.5], p: [1.55, 1.0, 0], r: [0, 0, PI / 2], c: '#ccc', m: 0.8, e: [1.6, 1.0, 0], info: 'Remove before twisting AP off the bracket.' },
      { id: 'body', label: 'AP body', g: ['box', 3.0, 0.5, 3.0], p: [0, 0.75, 0], c: '#f3f4f6' },
      { id: 'cover', label: 'Radome / front cover', g: ['box', 2.9, 0.08, 2.9], p: [0, 0.46, 0], c: '#ffffff', e: [0, -1.6, 0] },
      { id: 'led', label: 'Status LED', g: ['sph', 0.09], p: [0, 0.41, 1.1], c: '#00d26a', e: [0, -1.7, 0.3], info: 'Green = OK, amber/flashing = booting or no controller, red = fault.' },
      { id: 'ethport', label: 'Ethernet / PoE port', g: ['box', 0.42, 0.3, 0.4], p: [0, 1.05, -1.1], c: '#c9a227', m: 0.4, e: [0, 1.2, -0.8] },
      { id: 'ethplug', label: 'PoE patch cable', g: ['box', 0.35, 0.26, 0.8], p: [0, 1.05, -1.6], c: '#2b6cff', e: [0, 1.4, -2.4], info: 'From C1121 LAN, C9200CX, or PoE injector.' },
      { id: 'dc', label: 'DC jack (optional)', g: ['cyl', 0.1, 0.1, 0.3], p: [0.8, 1.05, -1.35], r: [PI / 2, 0, 0], c: '#111', e: [0.5, 1.2, -1.2] },
    ],
    steps: [
      { t: 'Overview', d: 'AP + bracket + PoE cable.', x: 0, h: [] },
      { t: '1. Read the LED', d: 'No light = no power (PoE). Flashing amber = booting / cannot join controller or cloud. Steady green = serving clients.', x: 0.3, h: ['led'] },
      { t: '2. Remove from bracket', d: 'Remove security pin, twist/slide AP off the bracket. Support the AP – do not let it hang on the cable.', x: 0.8, h: ['pin', 'bracket'] },
      { t: '3. PoE cable', d: 'Re-seat/replace the patch. Test the cable run with a tester. Check PoE class vs. switch port budget.', x: 0.8, h: ['ethport', 'ethplug'] },
      { t: '4. Replace AP', d: 'Fit new AP to bracket, insert pin, connect PoE. Make sure the replacement is claimed/joined to the same controller/cloud network & SSIDs.', x: 0.5, h: ['body', 'cover'] },
    ],
  },

  rj45: {
    name: 'Ethernet cable termination (RJ45, T568B)',
    note: 'How to re-terminate a damaged Cat5e/Cat6 cable end.',
    parts: [
      { id: 'jacket', label: 'Cable jacket', g: ['cyl', 0.24, 0.24, 3], p: [-2.3, 0, 0], r: [0, 0, PI / 2], c: '#2b6cff', e: [-1.6, 0, 0], info: 'Strip ~25 mm of jacket. Do not nick the pairs.' },
      { id: 'boot', label: 'Strain-relief boot', g: ['cyl', 0.32, 0.3, 0.7], p: [-0.6, 0, 0], r: [0, 0, PI / 2], c: '#6aa0ff', o: 0.6, e: [-0.9, 0, 0], info: 'Slide on BEFORE terminating!' },
      ...range(8, (i) => ({ id: 'wire' + i, label: `Pin ${i + 1} conductor`, g: ['cyl', 0.04, 0.04, 1.25], p: [0.1, 0, -0.28 + i * 0.08], r: [0, 0, PI / 2], c: T568B[i], e: [-0.4, 0, (i - 3.5) * 0.18], info: ['White/Orange', 'Orange', 'White/Green', 'Blue', 'White/Blue', 'Green', 'White/Brown', 'Brown'][i] + ' (T568B)' })),
      { id: 'plug', label: 'RJ45 plug body', g: ['box', 1.15, 0.42, 0.72], p: [0.75, 0, 0], c: '#dfe8f0', o: 0.45, e: [1.2, 0, 0], info: 'Use Cat6 plugs for Cat6 cable; pass-through plugs are easier in the field.' },
      ...range(8, (i) => ({ id: 'pin' + i, label: `Contact ${i + 1}`, g: ['box', 0.3, 0.06, 0.05], p: [1.15, 0.17, -0.28 + i * 0.08], c: '#e0b030', m: 0.9, e: [1.2, 0.9, 0] })),
      { id: 'latch', label: 'Locking tab', g: ['box', 0.6, 0.06, 0.28], p: [0.6, 0.25, 0], r: [0, 0, 0.18], c: '#dfe8f0', o: 0.7, e: [1.2, 0.5, 0], info: 'Broken tab = cable falls out. Re-terminate.' },
    ],
    steps: [
      { t: 'Overview', d: 'Jacket → boot → 8 conductors → plug → contacts.', x: 0.6, h: [] },
      { t: '1. Cut & strip', d: 'Cut off the damaged end square. Slide the boot on. Strip ~25 mm of jacket.', x: 0.8, h: ['jacket', 'boot'] },
      { t: '2. Untwist & order (T568B)', d: 'W/O, O, W/G, Bl, W/Bl, G, W/Br, Br. Keep twists to within 13 mm of the plug. Trim flush.', x: 1, h: ['wire'] },
      { t: '3. Insert into plug', d: 'Tab down, push conductors to the very end of the plug; jacket must sit inside the plug for strain relief.', x: 0.4, h: ['plug', 'wire'] },
      { t: '4. Crimp', d: 'Crimp firmly so contacts pierce each conductor. Slide boot over the plug.', x: 0.2, h: ['pin', 'latch'] },
      { t: '5. Test', d: 'Use a cable tester – all 8 pins in order, no shorts. For PoE runs, a bad pair = AP or switch port power faults.', x: 0, h: [] },
    ],
  },

  vsat: {
    name: 'LS-248 VSAT (Lite Coms LITE SAT 1.3A, AN/TSC-248)',
    note: 'Lite Coms LITE SAT 1.3A (AN/TSC-248): 1.3 m auto-acquire, X / Ku / Ka-band, 5–6 cases under 100 lb, 90–264 VAC or 24–32 VDC. Feed, BUC, LNB and modem layout is representative – they vary by band and configuration; confirm against your unit\'s manual.',
    parts: [
      ...range(4, (i) => ({ id: 'petal' + i, label: `Reflector petal ${i + 1}`, g: ['dish', 3.6, 0.42, i * PI / 2, PI / 2], p: [0, 3, 0], r: [-2.27, 0, 0], c: '#e9ecef', el: [-Math.cos(i * PI / 2 + PI / 4) * 1.1, -1.5, Math.sin(i * PI / 2 + PI / 4) * 1.1], info: 'Segments latch together – check alignment pins and latches; a gap or step distorts the beam.' })),
      { id: 'hub', call: 'Reflector hub', label: 'Reflector hub', g: ['cyl', 0.4, 0.4, 0.25], p: [0, 2.9, -0.1], r: [0.88, 0, 0], c: '#888', m: 0.6, e: [0, -0.26, -0.31] },
      { id: 'mount', call: 'Elevation arm', label: 'Reflector mount / elevation arm', g: ['box', 0.3, 0.45, 0.25], p: [0, 2.69, -0.33], r: [0.75, 0, 0], c: '#6b7a55', e: [0, 0, -1.3], info: 'Holds the reflector on the positioner and tilts it for elevation. Check the clamp, pins and quick-release are locked.' },
      { id: 'feedarm', label: 'Feed boom', g: ['cyl', 0.05, 0.05, 2.2], p: [0, 3.7, 0.85], r: [0.88, 0, 0], c: '#aaa', m: 0.7, e: [0, -0.62, 0.51] },
      { id: 'feed', call: 'Feed horn', label: 'Feed horn', g: ['cone', 0.28, 0.5], p: vsA(2.2), r: [0.88, 0, 0], c: '#d4af37', m: 0.8, e: [0, -0.51, -0.62], info: 'Check for water, insects, or damage. Cover must be intact.' },
      { id: 'omt', call: 'OMT / diplexer', label: 'OMT / diplexer', g: ['box', 0.35, 0.35, 0.35], p: vsA(2.73), r: [0.88, 0, 0], c: '#b08d57', m: 0.7, e: [0, 1.15, 1.39], info: 'Separates TX/RX by polarisation. Gaskets must be seated.' },
      { id: 'buc', call: 'BUC (TX)', label: 'BUC (transmit)', g: ['box', 0.6, 0.45, 0.8], p: vsA(2.91, 0.55, -0.06), r: [0.88, 0, 0], c: '#3c3c3c', m: 0.3, e: [1.0, 1.28, 1.54], eseq: [0.95, 0.06, 0.08], info: 'Block Up-Converter. Needs DC + 10 MHz ref over the TX IFL. Hot when running!' },
      { id: 'lnb', call: 'LNB (RX)', label: 'LNB (receive)', g: ['cyl', 0.16, 0.16, 0.6], p: vsA(2.84, -0.5, -0.056), r: [0.88, 0, PI / 2], c: '#f0f0f0', e: [-1.1, 1.28, 1.54], eseq: [-0.85, 0, 0], info: 'Low-Noise Block. Powered (13–24 VDC) from the modem over RX IFL.' },
      { id: 'pos', call: 'Positioner AZ / EL / POL', label: 'Positioner / AZ-EL-POL drive', g: ['box', 1.0, 0.8, 0.8], p: [0, 2.2, -0.7], c: '#4a5a3a', e: [0, 0, -1.3], info: 'Auto-acquire controller, GPS and compass. Check cable and limit errors.' },
      { id: 'gps', call: 'GPS / compass', label: 'GPS / compass puck', g: ['cyl', 0.2, 0.2, 0.1], p: [0, 2.65, -0.9], c: '#222', e: [0, 0.7, -1.3] },
      { id: 'mast', label: 'Mast', g: ['cyl', 0.13, 0.13, 1.8], p: [0, 1.0, -0.7], c: '#6b7a55', e: [0, -0.2, -1.3] },
      ...range(3, (i) => { const a = i * 2 * PI / 3; return { id: 'leg' + i, label: `Tripod leg ${i + 1}`, g: ['cyl', 0.06, 0.06, 1.6], p: [Math.cos(a) * 0.55, 0.6, -0.7 + Math.sin(a) * 0.55], r: [Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6], c: '#6b7a55', e: [Math.cos(a) * 0.7, -0.3, Math.sin(a) * 0.7 - 1.3], info: 'Level the base (bubble) and stake/ballast against wind.' }; }),
      { id: 'modem', call: 'Modem transit case', label: 'Modem transit case (iDirect-type)', g: ['box', 2.2, 0.9, 1.6], p: [3.6, 0.45, 0.5], c: '#3f4f36', e: [1.6, 0, 0.8], info: 'Houses satellite modem, power and LAN. Check TX/RX/NET LEDs.' },
      { id: 'modemlid', label: 'Modem case lid', g: ['box', 2.2, 0.08, 1.6], p: [3.6, 0.94, 0.5], c: '#46573d', e: [1.6, 1.3, 0.1], tilt: [-1.1, 0, 0], eseq: [0, 0.55, -0.8], info: 'Hinged at the back. Keep it closed in rain and dust.' },
      ...[-0.7, 0.7].map((dx, i) => ({ id: 'caselatch' + i, label: 'Case latch', g: ['box', 0.18, 0.14, 0.06], p: [3.6 + dx, 0.78, 1.33], c: '#9aa0a6', m: 0.8, e: [1.6, 0, 1.1], eseq: [0, 0, 0.14], ...(i === 0 ? { call: 'Case latches ×2' } : {}) })),
      { id: 'modemunit', call: 'Satellite modem', label: 'Satellite modem', g: ['box', 1.6, 0.3, 1.1], p: [3.6, 0.55, 0.5], c: '#1a1a1a', e: [1.6, 1.4, 0.8], eseq: [0, 0.55, 1.25] },
      ...range(4, (i) => ({ id: 'modemunit-led' + i, of: 'modemunit', g: ['box', 0.05, 0.025, 0.012], p: [3.02 + i * 0.13, 0.63, 1.056], c: ['#22c55e', '#22c55e', '#22c55e', '#f59e0b'][i] })),
      { id: 'modemunit-t', of: 'modemunit', g: ['text', 0.56, 0.045, 'TX    RX    NET   PWR'], c: '#cfd3d8', p: [3.21, 0.57, 1.057] },
      { id: 'mpwr', call: 'Modem power switch', label: 'Modem power switch', g: ['box', 0.09, 0.09, 0.03], p: [4.2, 0.6, 1.065], c: '#d62828', e: [1.6, 1.4, 0.8], eseq: [0, 0.55, 1.25] },
      { id: 'modemports', call: 'TX IFL · RX IFL · LAN (rear)', label: 'Modem rear ports', g: ['box', 0.7, 0.12, 0.03], p: [3.6, 0.55, -0.065], c: '#2a2c30', e: [1.6, 1.4, 0.8], eseq: [0, 0.55, 1.25] },
      { id: 'ifltx', call: 'TX IFL (to BUC)', label: 'TX IFL coax (to BUC)', g: ['torus', 0.6, 0.05], p: [2.2, 0.06, -1.2], r: [PI / 2, 0, 0], c: '#1d1d1d', e: [0.8, 0, -1.8], info: 'L-band TX + DC + 10 MHz. Check N/F connectors are tight & dry.' },
      { id: 'iflrx', call: 'RX IFL (from LNB)', label: 'RX IFL coax (from LNB)', g: ['torus', 0.6, 0.05], p: [2.2, 0.06, 0.2], r: [PI / 2, 0, 0], c: '#3d3d3d', e: [0.8, 0, 2.2] },
      // ---- feed flange: horn ↔ OMT ----
      { id: 'flange', label: 'Feed flange', g: ['cyl', 0.15, 0.15, 0.04], p: vsA(2.48), r: [0.88, 0, 0], c: '#b08d57', m: 0.85, rough: 0.3, e: [0, 0.83, 1.0], info: 'Waveguide flange between the horn and the OMT.' },
      { id: 'gasket', call: 'Flange gasket', label: 'Flange gasket (O-ring)', g: ['cyl', 0.13, 0.13, 0.014], p: vsA(2.505), r: [0.88, 0, 0], c: '#111', e: [0.5, 0.4, 0.5], eseq: [0.45, -0.2, -0.25], info: 'Replace every time the flange is opened. A pinched or missing gasket lets water into the waveguide.' },
      ...[[0.12, 0], [-0.12, 0], [0, 0.12], [0, -0.12]].map(([x, z], i) => VBOLT('feedbolt' + i, vsA(2.51, x, z), [0.88, 0, 0], { label: 'Horn flange bolt', call: i === 0 ? 'Horn flange bolts ×4' : undefined })),
      // ---- BUC mounting flange + TX connector ----
      { id: 'bucflange', label: 'BUC flange plate', g: ['box', 0.06, 0.32, 0.32], p: vsA(2.91, 0.21, -0.06), r: [0.88, 0, 0], c: '#9aa0a6', m: 0.85, e: [0.7, 1.28, 1.54] },
      ...[[0.11, 0.11], [0.11, -0.11], [-0.11, 0.11], [-0.11, -0.11]].map(([ds, dz], i) => VBOLT('bucbolt' + i, vsA(2.91 + ds, 0.27, -0.06 + dz), [0.88, 0, -PI / 2], { label: 'BUC flange bolt', call: i === 0 ? 'BUC flange bolts ×4' : undefined, info: 'Torque evenly in a cross pattern on refit.' })),
      { id: 'txconn', call: 'TX IFL connector (N-type)', label: 'TX IFL connector (N-type)', g: ['cyl', 0.045, 0.045, 0.14], p: vsA(2.91, 0.92, -0.06), r: [0.88, 0, -PI / 2], c: '#c9ccd1', m: 0.9, rough: 0.3, spin: true, e: [1.5, 1.28, 1.54], eseq: [0.35, 0, 0], info: 'Carries L-band TX + DC + 10 MHz to the BUC. Hand-tight, then weather-seal.' },
      // ---- LNB clamp + RX connector ----
      { id: 'lnbclamp', call: 'LNB clamp', label: 'LNB clamp band', g: ['cyl', 0.19, 0.19, 0.08], p: vsA(2.84, -0.3, -0.056), r: [0.88, 0, PI / 2], c: '#9aa0a6', m: 0.85, e: [-0.8, 1.28, 1.54], eseq: [0, 0, 0] },
      VBOLT('clampbolt0', vsA(2.84, -0.3, 0.15), [0.88 + PI / 2, 0, 0], { rad: 0.018, len: 0.07, lift: 0.22, label: 'LNB clamp screw', call: 'LNB clamp screw' }),
      { id: 'rxconn', call: 'RX IFL connector (F-type)', label: 'RX IFL connector (F-type)', g: ['cyl', 0.035, 0.035, 0.11], p: vsA(2.84, -0.86, -0.056), r: [0.88, 0, PI / 2], c: '#c9ccd1', m: 0.9, rough: 0.3, spin: true, e: [-1.5, 1.28, 1.54], eseq: [-0.35, 0, 0], info: 'Carries RX L-band + LNB power from the modem.' },
      // ---- reflector latches and hub pins ----
      ...range(4, (i) => { const f = i * PI / 2; return { id: 'latch' + i, label: 'Petal latch', g: ['box', 0.12, 0.05, 0.14], p: vsDish(-1.5 * Math.cos(f), -0.31, 1.5 * Math.sin(f)), r: [-2.27, -f, 0], c: '#9aa0a6', m: 0.85, el: [-Math.cos(f) * 1.6, -1.5, Math.sin(f) * 1.6], elseq: [-Math.cos(f) * 0.25, 0, Math.sin(f) * 0.25], ...(i === 0 ? { call: 'Petal latches ×4' } : {}), info: 'Over-centre latch on each petal seam. All four must be closed and flush.' }; }),
      ...range(4, (i) => { const f = PI / 4 + i * PI / 2; return { id: 'hubpin' + i, label: 'Hub alignment pin', g: ['cyl', 0.03, 0.03, 0.1], p: vsA(0.0, 0.28 * Math.cos(f), 0.28 * Math.sin(f)), r: [0.88, 0, 0], c: '#c9ccd1', m: 0.9, el: [0, 0.3, 0], eseq: [0, 0, 0], ...(i === 0 ? { call: 'Hub alignment pins ×4' } : {}) }; }),
      // ---- positioner access panel, controller, cable, level ----
      { id: 'poscover', call: 'Positioner access panel', label: 'Positioner access panel', g: ['box', 0.03, 0.62, 0.62], p: [0.515, 2.2, -0.7], c: '#55653f', e: [0.9, 0, -1.3], tilt: [0, 0, -0.4], eseq: [0.75, 0, 0] },
      ...[[0.25, 0.25], [0.25, -0.25], [-0.25, 0.25], [-0.25, -0.25]].map(([dy, dz], i) => VBOLT('posbolt' + i, [0.54, 2.2 + dy, -0.7 + dz], [0, 0, -PI / 2], { rad: 0.018, len: 0.06, lift: 0.4, label: 'Panel screw', call: i === 0 ? 'Access panel screws ×4' : undefined })),
      { id: 'posboard', call: 'Positioner controller', label: 'Positioner controller board', g: ['box', 0.02, 0.5, 0.5], p: [0.47, 2.2, -0.7], c: '#1f6b3a', e: [0.6, 0, -1.3], eseq: [0.35, 0, 0], info: 'Auto-acquire controller. Reference only – faults are fixed by swapping the positioner.' },
      { id: 'posconn', call: 'Positioner control cable', label: 'Positioner control cable connector', g: ['cyl', 0.05, 0.05, 0.12], p: [0, 2.1, -1.16], r: [-PI / 2, 0, 0], c: '#c9ccd1', m: 0.9, spin: true, e: [0, 0, -1.8], eseq: [0, 0, -0.3], info: 'Circular mil connector from the modem case. Push, turn to lock; check for bent pins.' },
      { id: 'level', call: 'Level bubble', label: 'Level bubble', g: ['cyl', 0.06, 0.06, 0.02], p: [0.3, 2.61, -0.4], c: '#9be564', m: 0.1, rough: 0.1, e: [0, 0.1, -1.3], eseq: [0, 0, 0], info: 'Centre the bubble before auto-acquire.' },
      ...range(3, (i) => { const a = i * 2 * PI / 3; return { id: 'legknob' + i, label: 'Leg lock knob', g: ['cyl', 0.05, 0.05, 0.1], p: [Math.cos(a) * 0.22, 0.55, -0.7 + Math.sin(a) * 0.22], c: '#2a2c30', e: [Math.cos(a) * 0.7, -0.3, Math.sin(a) * 0.7 - 1.3], eseq: [0, 0, 0], ...(i === 0 ? { call: 'Leg lock knobs ×3' } : {}) }; }),
    ],
    steps: [
      { t: 'Overview', d: 'Reflector petals, feed/OMT/BUC/LNB, positioner on a tripod, modem case and two IFL coax runs.', x: 0, h: [] },
      { t: '1. Reflector petals', d: 'Fit the petals on the hub; engage every alignment pin and close every latch flush. Gaps or steps between petals degrade gain and cross-pol.', x: 0, h: ['latch', 'petal', 'hub', 'hubpin'], seq: [{ p: ['latch'], t: 'Flip open the 4 petal latches' }, { p: ['petal'], t: 'Lift each petal off the hub' }, { p: ['hubpin'], t: 'Check the 4 hub alignment pins are straight and clean' }] },
      { t: '2. Feed horn, flange & OMT', d: 'Water in the waveguide = low SNR / no lock. Inspect the horn cover, replace the flange gasket every time the flange is opened, and torque the bolts evenly.', x: 0, h: ['feedbolt', 'feed', 'gasket', 'flange', 'omt'], seq: [{ p: ['feedbolt'], t: 'Remove the 4 horn flange bolts' }, { p: ['feed'], t: 'Slide the horn off toward the dish – check its cover for water' }, { p: ['gasket'], t: 'Remove the old gasket; fit a new one' }, { p: ['flange', 'omt'], t: 'Inspect the flange face and OMT for corrosion' }] },
      { t: '3. Swap BUC or LNB', d: 'TX OFF / disable first – the BUC can be hot and transmitting. Disconnect the IFLs, unbolt, fit the spare with a new gasket, torque in a cross pattern, reconnect and weather-seal.', x: 0, h: ['txconn', 'rxconn', 'bucbolt', 'buc', 'clampbolt', 'lnbclamp', 'lnb'], seq: [{ p: ['txconn', 'rxconn'], t: 'TX OFF – unscrew the TX (N-type) and RX (F-type) connectors' }, { p: ['bucbolt'], t: 'Remove the 4 BUC flange bolts' }, { p: ['buc'], t: 'Lift the BUC off the OMT' }, { p: ['clampbolt'], t: 'Loosen the LNB clamp screw' }, { p: ['lnb'], t: 'Slide the LNB out of the clamp' }] },
      { t: '4. Positioner & tripod', d: 'Level the base, lock and stake every leg, seat the positioner cable, and give the GPS puck a clear sky view.', x: 0, h: ['legknob', 'level', 'posconn', 'posbolt', 'poscover', 'posboard', 'pos', 'mount', 'gps', 'mast', 'leg'], seq: [{ p: ['legknob', 'level'], t: 'Check every leg lock is tight and the bubble is centred' }, { p: ['posconn'], t: 'Unlock and pull the positioner control cable – check the pins' }, { p: ['posbolt'], t: 'Remove the 4 access panel screws' }, { p: ['poscover'], t: 'Take the access panel off' }, { p: ['posboard'], t: 'Controller board – reference only, swap the positioner if faulty' }] },
      { t: '5. Modem case & IFL', d: 'TX IFL → BUC, RX IFL → LNB (never swap them). Check DC and 10 MHz are enabled on the modem. LAN out to your router / switch.', x: 0, h: ['caselatch', 'modemlid', 'modemunit', 'mpwr', 'modemports', 'ifltx', 'iflrx'], seq: [{ p: ['caselatch'], t: 'Flip open both case latches' }, { p: ['modemlid'], t: 'Swing the lid open' }, { p: ['modemunit', 'mpwr', 'modemports'], t: 'Slide the modem out – check the TX / RX / NET / PWR LEDs' }, { p: ['ifltx', 'iflrx'], t: 'Check both IFL runs: TX to the BUC, RX to the LNB' }] },
    ],
  },

  grrip: {
    // Klas Pioneer Express 5.1 (GRRIP, AN/PSC-19) – sizes from the Klas brochure:
    // case 559 × 356 × 229 mm, core module 382 × 254 × 83 mm, Hughes 9211 BGAN 292 × 232 × 51 mm.
    name: 'GRRIP – Klas Pioneer Express 5.1 (AN/PSC-19)',
    note: 'Pioneer Express 5.1 at real size: IP67 case, core module (red/black networking, 72 Wh UPS, 250 W AC/DC, 15 VDC outputs), built-in Panasonic laptop, encryptor bay, 2590 battery and Hughes 9211 BGAN (not included). Port layout is representative – read the panel labels on your kit.',
    parts: [
      { id: 'case', label: 'Rugged case (IP67)', g: ['box', ...M(559, 229, 356)], p: M(0, 114.5, 0), c: '#1d1f22', rough: 0.75, info: '559 × 356 × 229 mm, 18.8 kg fully loaded. IP67 only when closed and latched.' },
      { id: 'case-seam', of: 'case', g: ['box', ...M(561, 4, 358)], p: M(0, 160, 0), c: '#0d0e10' },
      ...range(2, (i) => ({ id: 'case-latch' + i, of: 'case', g: ['box', ...M(60, 40, 10)], p: M(i ? 150 : -150, 160, 180), c: '#2a2c30' })),
      { id: 'case-handle', of: 'case', g: ['box', ...M(150, 18, 22)], p: M(0, 120, 190), c: '#2a2c30' },
      ...range(2, (i) => ({ id: 'case-wheel' + i, of: 'case', g: ['cyl', ...M(35, 35, 30)], p: M(i ? 240 : -240, 35, -170), r: [0, 0, PI / 2], c: '#111' })),
      { id: 'core', label: 'Core module', g: ['box', ...M(382, 83, 254)], p: M(0, 270.5, 0), c: '#c9cdd2', m: 0.6, rough: 0.35, info: '382 × 254 × 83 mm, 4.5 kg. Red and black networking, 72 Wh UPS, built-in 250 W AC/DC.' },
      lbl('core', 'PIONEER EXPRESS 5.1', [-110, 300, 127.4], [120, 9]),
      lbl('core', 'RED  (5)', [-24, 289, 127.4], [60, 7], 'front', '#b4232a'),
      lbl('core', 'BLACK  (4)', [57, 289, 127.4], [60, 7], 'front', '#111'),
      lbl('core', 'DC IN', [-175, 250, 127.4], [26, 6]),
      lbl('core', '15 VDC OUT', [-127, 250, 127.4], [44, 6]),
      lbl('core', 'POWER', [140, 250, 127.4], [30, 6]),
      ...range(5, (i) => RJ('red' + i, `Red user port ${i + 1}`, -60 + i * 18, 270, 128.5, { c: '#8b1e1e', call: i === 0 ? 'RED ports ×5 (secure)' : undefined, e: M(0, 0, 70), info: 'RED (plaintext / secure) side. Built-in laptop + up to 4 external red laptops. Never connect a black or untrusted network here.' })),
      ...range(4, (i) => RJ('blk' + i, `Black user port ${i + 1}`, 30 + i * 18, 270, 128.5, { c: '#111214', call: i === 0 ? 'BLACK ports ×4' : undefined, e: M(0, 0, 70), info: 'BLACK (ciphertext) side: Hughes 9211 BGAN, hotel broadband or VSAT, and up to 4 black laptops.' })),
      { id: 'dcin', call: 'DC in (2590)', label: 'DC input connector', g: ['cyl', ...M(9, 9, 10)], p: M(-175, 270, 130), r: [PI / 2, 0, 0], c: '#222', m: 0.6, e: M(0, 0, 80), info: 'DC in – use the supplied cable for a 2590 battery.' },
      ...range(2, (i) => ({ id: 'out' + i, call: i === 0 ? '15 VDC outputs ×2' : undefined, label: `15 VDC output ${i + 1}`, g: ['cyl', ...M(6, 6, 8)], p: M(-140 + i * 26, 270, 130), r: [PI / 2, 0, 0], c: '#333', m: 0.5, e: M(0, 0, 80), info: 'Charges the BGAN or laptop. Only live when AC or DC external power is connected (off on UPS).' })),
      { id: 'pwrsw', call: 'Power switch', label: 'Power switch', g: ['box', ...M(16, 16, 6)], p: M(140, 270, 129), c: '#d62828', e: M(0, 0, 80) },
      ...range(2, (i) => ({ id: 'vm' + i, label: `VoyagerVMm ${i + 1} (AMD V2516)`, g: ['box', ...M(100, 40, 150)], p: M(-130 + i * 110, 262, -40), c: '#3a4048', m: 0.4, e: M(0, 200, 0), info: 'Virtualised router/compute: 6 × 1 Gbps ports, VMware ESXi or KlasOS Keel. Runs the red-side router (KlasOS Keel or a VNF such as Cisco Catalyst 8000v).' })),
      { id: 'crypto', label: 'Encryptor bay – KG-250XS HAIPE or GoSilent Cube (not included)', g: ['box', ...M(120, 40, 140)], p: M(110, 262, -40), c: '#4b4f2f', e: M(0, 170, 0), call: 'Encryptor bay', info: 'COMSEC/CSfC: only authorised personnel key, zeroize or configure the encryptor.' },
      { id: 'ups', label: 'UPS battery (72 Wh)', g: ['box', ...M(200, 20, 60)], p: M(0, 245, 80), c: '#1a1a1a', e: M(0, 140, 230), info: 'Backs up the VoyagerVMm and HAIPE/GoSilent only during power drops.' },
      { id: 'coretop', label: 'Core module top panel', g: ['box', ...M(382, 3, 254)], p: M(0, 311, 0), c: '#c3c8ce', m: 0.6, rough: 0.35, e: M(-480, 140, 0), tilt: [0, 0, 0.5], info: 'Held by 6 screws. Only open with your SOP / maintenance authority – the encryptor bay is underneath.' },
      ...[[-176, -115], [0, -115], [176, -115], [-176, 115], [0, 115], [176, 115]].map(([x, z], i) => SCREW('screw' + i, x, 312.5, z, { r: 3, len: 9, label: 'Top-panel screw (Phillips #1)', lift: 200, call: i === 0 ? 'Top-panel screws ×6' : undefined })),
      ...[[-176, -115], [0, -115], [176, -115], [-176, 115], [0, 115], [176, 115]].map(([x, z], i) => HOLE('coretop', i, x, 312.7, z, 3.3)),
      { id: 'laptop', label: 'Panasonic laptop (FZ-G2, 10")', g: ['box', ...M(270, 30, 200)], p: M(-60, 327, -10), c: '#3a3d42', rough: 0.6, e: M(0, 260, 0), info: 'Built-in red laptop. Intel i5-10310U, 16 GB, TPM 2.0, custom federal BIOS.' },
      { id: 'screen', label: 'Laptop screen', g: ['box', ...M(270, 190, 14)], p: M(-60, 432, -112), r: [-0.25, 0, 0], c: '#2b2e33', e: M(0, 260, 0) },
      { id: 'screen-glass', of: 'screen', g: ['box', ...M(240, 160, 2)], p: M(-60, 433, -104), r: [-0.25, 0, 0], c: '#5a7fa8', m: 0.2, rough: 0.15 },
      { id: 'ssd', call: 'Quick-release SSD', label: 'Quick-release SSD (512 GB OPAL)', g: ['box', ...M(10, 22, 90)], p: M(79, 327, -10), c: '#9aa0a6', m: 0.6, e: M(140, 260, 0), info: 'Encrypted drive – use only the SSD issued for this kit. Lock it fully home.' },
      { id: 'b2590', call: 'BB-2590 battery', label: 'BB-2590 battery', g: ['box', ...M(112, 127, 61)], p: M(390, 63.5, 90), c: '#5d6b4a', e: M(170, 0, 60), info: 'External DC source for the core module via the supplied cable.' },
      { id: 'dccable', label: 'DC cable (2590 → core module)', g: ['torus', ...M(50, 4)], p: M(350, 4, -80), r: [PI / 2, 0, 0], c: '#151515', e: M(200, 0, -80) },
      { id: 'bganext', call: 'Hughes 9211 BGAN', label: 'Hughes 9211 BGAN terminal (not included)', g: ['box', ...M(292, 232, 51)], p: M(-500, 121, -60), r: [-0.3, 0, 0], c: '#eceef0', rough: 0.5, e: M(-240, 0, 0), info: 'Class 1 BGAN, 650+ kbps, IP65. Cable it to a BLACK port.' },
      { id: 'blkcable', label: 'Patch: BGAN → black port', g: ['torus', ...M(55, 3.5)], p: M(-330, 4, 150), r: [PI / 2, 0, 0], c: '#2b6cff', e: M(-160, 0, 160) },
    ],
    steps: [
      { t: 'Overview', d: 'Pioneer Express 5.1 (GRRIP, AN/PSC-19): IP67 case 559 × 356 × 229 mm, 18.8 kg, −20 °C to 40 °C. Core module on the case, laptop on top. BGAN and encryptor are separate items.', x: 0, h: [] },
      { t: '1. Power in', d: 'Built-in 250 W AC/DC – plug AC straight into the core module, or use the DC cable from a 2590 battery. The 72 Wh UPS only bridges drops for the VoyagerVMm and encryptor.', x: 0, h: ['dcin', 'pwrsw', 'b2590', 'dccable', 'ups'], seq: [{ p: ['b2590'], t: 'Check the 2590 battery charge' }, { p: ['dccable'], t: 'Re-seat the DC cable at the battery and the DC IN connector' }] },
      { t: '2. 15 VDC charging outputs', d: 'Two 15 VDC outputs charge the BGAN and laptop – only while AC or DC external power is connected (off on UPS).', x: 0.4, h: ['out'] },
      { t: '3. Black side (reachback)', d: 'Hughes 9211 BGAN, hotel broadband or VSAT goes into a BLACK port (4 black user ports). Test the bearer from a black laptop first.', x: 0.6, h: ['blk', 'bganext', 'blkcable'] },
      { t: '4. Red side (secure network)', d: '5 red user ports including the built-in laptop; up to 4 external red laptops. The VoyagerVMm runs the red router (KlasOS Keel or a VNF). Never cross red and black cables.', x: 0.7, h: ['red', 'laptop', 'vm'] },
      { t: '5. Encryptor bay', d: 'KG-250XS HAIPE (Type 1) or GoSilent Cube (CSfC). Check power and that its red and black cables are in the right ports. Keying/zeroizing is for authorised COMSEC personnel only.', x: 0, h: ['laptop', 'screw', 'coretop', 'crypto'], seq: [{ p: ['laptop', 'screen', 'ssd'], t: 'Lift the laptop off the core module' }, { p: ['screw'], t: 'Remove the 6 top-panel screws (Phillips #1)' }, { p: ['coretop'], t: 'Lift the top panel off' }, { p: ['crypto'], t: 'Encryptor bay – KG-250XS / GoSilent (COMSEC rules apply)' }] },
      { t: '6. Laptop & quick-release SSD', d: 'Panasonic FZ-G2. If it won\'t boot, check charge and that the 512 GB OPAL SSD is locked home. Use only the SSD issued for this kit.', x: 0, h: ['laptop', 'screen', 'ssd'], seq: [{ p: ['ssd'], t: 'Slide the latch and pull the quick-release SSD' }] },
    ],
  },

  bgan: {
    name: 'Hughes 9211 BGAN terminal',
    note: 'Hughes 9211 BGAN at real size (292 × 232 × 51 mm, about 2 kg): antenna lid, body, battery, SIM and rear ports. Port layout is representative – check the 9211 manual.',
    // Real size: Hughes 9211 BGAN (as used with GRRIP / Pioneer Express), 292 × 232 × 51 mm.
    parts: [
      { id: 'lid', call: 'Antenna panel', label: 'Antenna lid', g: ['box', ...M(292, 15, 232)], p: M(0, 43.5, 0), c: '#e6e8ea', e: M(0, 150, 0), info: 'Flat-panel antenna side. Must face the Inmarsat satellite, clear line of sight.' },
      lbl('lid', 'HUGHES 9211', [70, 51.3, 80], [80, 14], 'top', '#8a929c'),
      ...range(4, (i) => ({ id: 'patch' + i, label: 'Antenna element', g: ['box', ...M(100, 1.5, 75)], p: M(i % 2 ? 55 : -55, 51.8, i < 2 ? 42 : -42), c: '#c07a3a', m: 0.9, e: M(0, 95, 0) })),
      { id: 'body', label: 'Terminal body', g: ['box', ...M(292, 20, 232)], p: M(0, 26, 0), c: '#59606a' },
      lbl('body', 'LAN    LAN    USB    PHONE    DC', [0, 30, -116.3], [140, 6], 'rear', '#e6e8ea'),
      { id: 'battery', label: 'Battery pack', g: ['box', ...M(220, 14, 130)], p: M(0, 8, 15), c: '#202326', e: M(0, -10, 220), call: 'Battery', info: 'Swappable Li-ion. Charge before deployment; cold reduces runtime.' },
      { id: 'latch', call: 'Battery latch', label: 'Battery latch', g: ['box', ...M(40, 8, 6)], p: M(0, 6, 84), c: '#2a2c30', e: M(0, -30, 60), info: 'Slide to release the battery.' },
      { id: 'sim', call: 'SIM slot', label: 'BGAN SIM', g: ['box', ...M(25, 1, 15)], p: M(90, 9, 95), c: '#d9b44a', m: 0.8, e: M(110, -40, 80), info: 'Gold contacts down. Under or beside the battery on most terminals.' },
      { id: 'ports', call: 'LAN · USB · Phone · DC', label: 'LAN / USB / Phone ports', g: ['box', ...M(130, 12, 4)], p: M(0, 24, -118), c: '#111', e: M(0, 0, -90), info: 'LAN to laptop/router, RJ11 for handset, USB.' },
      { id: 'dc', label: 'DC / AC adapter', g: ['box', ...M(150, 40, 80)], p: M(-270, 20, -110), c: '#141414', e: M(-100, 0, -80) },
      { id: 'handset', call: 'Handset', label: 'Handset (POTS)', g: ['box', ...M(50, 25, 190)], p: M(230, 12.5, -20), c: '#333', e: M(100, 0, 0) },
      { id: 'compass', call: 'Pointing compass', label: 'Compass / pointing aid', g: ['cyl', ...M(15, 15, 4)], p: M(-100, 52, 80), c: '#fff', e: M(0, 175, 30) },
    ],
    steps: [
      { t: 'Overview', d: 'Lid (antenna), body, battery, SIM, ports, power and handset.', x: 0, h: [] },
      { t: '1. Swap battery', d: 'Power off. Release the latch, slide out battery, insert charged pack until it clicks.', x: 0, h: ['latch', 'battery'], seq: [{ p: ['latch'], t: 'Power off, then slide the battery latch' }, { p: ['battery'], t: 'Slide the battery out; fit a charged one until it clicks' }] },
      { t: '2. Check / re-seat SIM', d: 'With battery removed, re-seat SIM contacts down. Clean contacts. Confirm PIN not locked (PUK).', x: 0, h: ['latch', 'battery', 'sim'], seq: [{ p: ['latch'], t: 'Release the battery latch' }, { p: ['battery'], t: 'Slide the battery out' }, { p: ['sim'], t: 'Re-seat the SIM, contacts down' }] },
      { t: '3. Ports & power', d: 'Re-seat LAN and power. Try AC adapter instead of battery. Try the handset on the phone port to test voice.', x: 0.6, h: ['ports', 'dc', 'handset'] },
      { t: '4. Antenna pointing', d: 'Point lid toward the equator at the azimuth/elevation the terminal gives. Use the pointing tone/bar and rotate slowly for max signal.', x: 0.4, h: ['lid', 'patch', 'compass'] },
    ],
  },

  satphone: {
    name: 'Satellite phone (Iridium-class handset)',
    note: 'Iridium 9555-class handset at real size (143 × 55 × 30 mm) with stow-away antenna, swappable battery and SIM.',
    // Real size: Iridium 9555-class handset, 143 × 55 × 30 mm.
    parts: [
      { id: 'body', label: 'Handset body', g: ['box', ...M(55, 143, 30)], p: M(0, 71.5, 0), c: '#3a3d42' },
      ...range(12, (i) => ({ id: 'body-key' + i, of: 'body', g: ['box', ...M(11, 6.5, 2)], p: M(-14 + (i % 3) * 14, 72 - Math.floor(i / 3) * 10, 15.5), c: '#c9cdd2' })),
      { id: 'screen', call: 'Display', label: 'Display', g: ['box', ...M(40, 30, 1)], p: M(0, 116, 15.3), c: '#7fb3d5', e: M(0, 0, 40) },
      { id: 'keypad', label: 'Keypad', g: ['box', ...M(46, 50, 1)], p: M(0, 58, 15.3), c: '#222', e: M(0, 0, 40) },
      { id: 'antenna', spin: true, call: 'Antenna – extend vertical', label: 'Antenna (extend & point up)', g: ['cyl', ...M(6, 8, 105)], p: M(15, 195, -4), c: '#1b1b1b', e: M(0, 95, 0), info: 'Must be fully extended and vertical with clear sky. Replace if cracked or hinge loose.' },
      { id: 'clip', call: 'Cover release', label: 'Battery cover release', g: ['box', ...M(20, 6, 4)], p: M(0, 12, -18.5), c: '#555', e: M(0, -30, -40) },
      { id: 'cover', tilt: [-0.35, 0, 0], label: 'Battery cover', g: ['box', ...M(55, 100, 3)], p: M(0, 60, -16.5), c: '#2c2f33', e: M(0, 0, -130) },
      { id: 'battery', label: 'Battery', g: ['box', ...M(48, 85, 10)], p: M(0, 60, -10), c: '#111', e: M(0, 0, -80) },
      { id: 'sim', call: 'SIM', label: 'SIM card', g: ['box', ...M(25, 15, 1)], p: M(0, 100, -4.5), c: '#d9b44a', m: 0.8, e: M(0, 15, -48) },
      { id: 'extant', call: 'External antenna port', label: 'External antenna / dock adapter', g: ['cyl', ...M(4, 4, 10)], p: M(-15, 148, 0), c: '#888', m: 0.7, e: M(-60, 55, 0), info: 'For use indoors/vehicles with a mast antenna. Remove cap & connect.' },
      { id: 'charger', label: 'Charger / USB', g: ['box', ...M(50, 30, 40)], p: M(110, 15, 0), c: '#151515', e: M(60, 0, 0) },
    ],
    steps: [
      { t: 'Overview', d: 'Antenna, body, battery, SIM, external antenna port, charger.', x: 0, h: [] },
      { t: '1. Antenna', d: 'Fully extend and rotate the antenna vertical. If damaged, unscrew/release and fit a replacement – the phone will not register without it.', x: 0, h: ['antenna'], seq: [{ p: ['antenna'], t: 'Unscrew / release the antenna and fit the spare' }] },
      { t: '2. Battery', d: 'Remove cover, lift battery out, insert a charged one. Cold drains batteries – keep spares warm.', x: 0, h: ['clip', 'cover', 'battery'], seq: [{ p: ['clip'], t: 'Press the cover release' }, { p: ['cover'], t: 'Lift the battery cover off' }, { p: ['battery'], t: 'Lift the battery out' }] },
      { t: '3. SIM', d: 'Under the battery. Re-seat, clean contacts; check PIN/PUK and that the SIM is active with airtime.', x: 0, h: ['cover', 'battery', 'sim'], seq: [{ p: ['clip'], t: 'Press the cover release' }, { p: ['cover'], t: 'Remove the cover' }, { p: ['battery'], t: 'Remove the battery' }, { p: ['sim'], t: 'Slide the SIM out and re-seat it' }] },
      { t: '4. External antenna', d: 'Indoors or in vehicles, connect the external antenna/dock. Check the cable and connector.', x: 0.6, h: ['extant'] },
    ],
  },
};
