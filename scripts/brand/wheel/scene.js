// The wheel model: a 245/40 R19 tyre on a 19" two-tone five split-Y spoke rim, with a drilled disc and a red caliper behind.
// Units: tyre outer radius = 1, wheel axis = Z, viewer on +Z. render.html exposes window.renderLayer(name, size).
import * as THREE from 'three';
import { TessellateModifier } from 'three/addons/modifiers/TessellateModifier.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
export const PITCHES = 72;

// ------------------------------------------------------------------ tread height map (shared by the tyre, the tread strip and the track)
// u: position around the tyre in pitches (period 1), v: across the tread, -1..1. Returns groove depth 0 (contact) .. 1 (deep groove).
const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
const frac = (x) => x - Math.floor(x);
export function treadDepth(u, v) {
  const a = Math.abs(v);
  const side = v < 0 ? 0.5 : 0;
  const sipe = (f, at, w = 0.011) => 1 - smooth(w, w + 0.012, Math.abs(f - at));
  let d = 0;
  // four continuous circumferential grooves
  for (const c of [0.235, 0.585]) d = Math.max(d, 1 - smooth(0.042, 0.066, Math.abs(a - c)));
  if (a > 0.64) {
    // shoulder blocks: one wide lateral slot per pitch, swept, opening out over the shoulder, and two slanted sipes
    const f = frac(u + 0.22 * a + side);
    d = Math.max(d, 1 - smooth(0.085, 0.115, Math.abs(f - 0.1)));
    d = Math.max(d, 0.6 * sipe(frac(u + 0.42 * a + side), 0.45), 0.6 * sipe(frac(u + 0.42 * a + side), 0.76));
  } else if (a > 0.29) {
    // intermediate rib: slanted slots that stop short of the centre groove, a sipe between them
    const f = frac(u + 0.6 * a + side + 0.25);
    d = Math.max(d, 0.85 * (1 - smooth(0.03, 0.05, Math.abs(f - 0.5))) * smooth(0.37, 0.42, a));
    d = Math.max(d, 0.55 * sipe(f, 0.0) * smooth(0.3, 0.33, a) * (1 - smooth(0.5, 0.53, a)));
  } else if (a < 0.19) {
    // centre rib: continuous, cut by fine slanted sipes
    const f = frac(2 * (u + 0.9 * a) + side);
    d = Math.max(d, 0.45 * sipe(f, 0.5, 0.008) * (1 - smooth(0.15, 0.18, a)));
  }
  return d;
}

// ------------------------------------------------------------------ tyre
const PROFILE = [
  // the shoulder rolls over from the tread into the sidewall on a wide radius
  [0.69, 0.3], [0.73, 0.335], [0.78, 0.355], [0.83, 0.36], [0.89, 0.356], [0.932, 0.348], [0.957, 0.336],
  [0.976, 0.318], [0.99, 0.292], [0.998, 0.258], [1.0, 0.22], [1.0, 0.0], [1.0, -0.22], [0.998, -0.258], [0.99, -0.292],
  [0.976, -0.318], [0.957, -0.336], [0.932, -0.348], [0.89, -0.356], [0.83, -0.36], [0.78, -0.355], [0.73, -0.335], [0.69, -0.3],
];

function profilePoints(n) {
  const curve = new THREE.SplineCurve(PROFILE.map(([r, z]) => new THREE.Vector2(r, z)));
  curve.arcLengthDivisions = 4000;
  return { pts: curve.getSpacedPoints(n - 1), length: curve.getLength() };
}

function sidewallMaps(pts, length) {
  const W = 4096, H = 1024;
  const bump = document.createElement('canvas');
  bump.width = W; bump.height = H;
  const rough = document.createElement('canvas');
  rough.width = W; rough.height = H;
  const b = bump.getContext('2d'), g = rough.getContext('2d');
  b.fillStyle = '#000'; b.fillRect(0, 0, W, H);
  g.fillStyle = 'rgb(0,235,0)'; g.fillRect(0, 0, W, H);
  const P = pts.length;
  const rowFront = (r) => {
    for (let j = 0; j < P / 2; j++) if (pts[j].x >= r) return (j / (P - 1)) * H;
    return H / 2;
  };
  const rowBack = (r) => H - rowFront(r);
  const band = (r0, r1, val, ctx = b) => {
    for (const rowOf of [rowFront, rowBack]) {
      const y0 = rowOf(r0), y1 = rowOf(r1);
      ctx.fillStyle = ctx === b ? `rgb(${val},${val},${val})` : `rgb(0,${val},0)`;
      ctx.fillRect(0, Math.min(y0, y1), W, Math.max(1, Math.abs(y1 - y0)));
    }
  };
  // concentric ribs near the bead, the rim-protector ridge, ribs near the shoulder
  for (let k = 0; k < 6; k++) band(0.715 + k * 0.011, 0.72 + k * 0.011, 150);
  band(0.7, 0.708, 255);
  band(0.703, 0.705, 200);
  for (let k = 0; k < 5; k++) band(0.915 + k * 0.009, 0.919 + k * 0.009, 140);
  band(0.905, 0.908, 220);
  // the rim protector and the shoulder ribs are moulded smoother: a satin sheen
  band(0.698, 0.71, 150, g);
  // lettering band at r 0.86: same rubber, raised, smoother
  const pxU = W / (TAU * 0.86);
  const pxV = H / length;
  const yC = rowFront(0.862);
  const words = [['ALKARAJ', 0.25, 0.062], ['ALKARAJ', 0.75, 0.062], ['245/40 ZR19 98Y', 0.0, 0.026], ['RADIAL TUBELESS', 0.5, 0.026]];
  for (const [txt, u, hUnits] of words) {
    for (const [ctx, fill] of [[b, '#fff'], [g, 'rgb(0,95,0)']]) {
      ctx.save();
      ctx.translate(u * W, yC);
      ctx.rotate(Math.PI);
      ctx.scale(pxU / pxV, 1);
      ctx.font = `900 ${hUnits * pxV * 1.32}px "DejaVu Sans Condensed", "Arial Narrow", "Liberation Sans Narrow", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = fill;
      if (ctx === b) { ctx.shadowColor = '#fff'; ctx.shadowBlur = 3; }
      ctx.fillText(txt, 0, 0);
      ctx.restore();
    }
  }
  const tb = new THREE.CanvasTexture(bump);
  const tr = new THREE.CanvasTexture(rough);
  for (const t of [tb, tr]) { t.flipY = false; t.anisotropy = 8; t.wrapS = THREE.RepeatWrapping; }
  return { tb, tr };
}

export function buildTyre({ segments = 1440, rows = 240 } = {}) {
  const { pts, length } = profilePoints(rows);
  const geo = new THREE.LatheGeometry(pts, segments);
  const pos = geo.attributes.position;
  const P = pts.length;
  for (let i = 0; i <= segments; i++) {
    const phi = (i / segments) * TAU;
    const u = ((i % segments) / segments) * PITCHES;
    for (let j = 0; j < P; j++) {
      const r = pts[j].x, z = pts[j].y;
      if (r < 0.94) continue;
      const fade = smooth(0.94, 0.968, r);
      const v = Math.max(-1, Math.min(1, z / 0.33));
      const d = 0.024 * treadDepth(u, v) * fade;
      const nr = r - d;
      pos.setXYZ(i * P + j, nr * Math.sin(phi), z, nr * Math.cos(phi));
    }
  }
  geo.computeVertexNormals();
  geo.rotateX(Math.PI / 2);
  const { tb, tr } = sidewallMaps(pts, length);
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x2b2b30,
    roughness: 0.68,
    roughnessMap: tr,
    metalness: 0,
    bumpMap: tb,
    bumpScale: 28,
    sheen: 0.5,
    sheenRoughness: 0.55,
    sheenColor: new THREE.Color(0x4a4d55),
    specularIntensity: 1.0,
    side: THREE.DoubleSide,
  });
  return new THREE.Mesh(geo, mat);
}

// ------------------------------------------------------------------ materials
function concentricRoughness(lo, hi, rings = 1400, seed = 3) {
  // fine lathe-turned lines: a rotationally symmetric roughness texture over the part's bounding square
  const N = 2048;
  const c = document.createElement('canvas'); c.width = c.height = N;
  const x = c.getContext('2d');
  x.fillStyle = `rgb(0,${lo},0)`; x.fillRect(0, 0, N, N);
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < rings; i++) {
    const r = rnd() * N * 0.5;
    const v = lo + rnd() * (hi - lo);
    x.strokeStyle = `rgba(0,${v | 0},0,${0.25 + rnd() * 0.5})`;
    x.lineWidth = 0.5 + rnd() * 1.6;
    x.beginPath(); x.arc(N / 2, N / 2, r, 0, TAU); x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8;
  return t;
}

function planarUV(geo, R) {
  // UVs over the square -R..R in x and y, so a rotationally symmetric texture lines up with the axis
  const p = geo.attributes.position;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[2 * i] = p.getX(i) / (2 * R) + 0.5; uv[2 * i + 1] = p.getY(i) / (2 * R) + 0.5; }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

function tangentialAnisotropy() {
  // the anisotropy direction at each point of the disc's planar UVs: along the circle through it
  const N = 512, c = document.createElement('canvas'); c.width = c.height = N;
  const x = c.getContext('2d'), img = x.createImageData(N, N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const px = (i + 0.5) / N * 2 - 1, py = 1 - (j + 0.5) / N * 2, r = Math.hypot(px, py) || 1;
    const k = (j * N + i) * 4;
    img.data[k] = 127.5 + 127.5 * (-py / r); img.data[k + 1] = 127.5 + 127.5 * (px / r); img.data[k + 2] = 255; img.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.flipY = true;
  return t;
}

let MAT;
function mats() {
  if (MAT) return MAT;
  const machined = concentricRoughness(22, 36, 500, 11);
  MAT = {
    // the diamond-cut face: bright bare aluminium, lathe-turned
    face: new THREE.MeshPhysicalMaterial({ color: 0xdfe2e6, metalness: 1, roughness: 1, roughnessMap: machined, clearcoat: 0.6, clearcoatRoughness: 0.12 }),
    // the painted sides and pockets: dark gunmetal, satin
    gun: new THREE.MeshPhysicalMaterial({ color: 0x2b2e33, metalness: 0.75, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.2 }),
    gunDouble: new THREE.MeshPhysicalMaterial({ color: 0x16171a, metalness: 0.5, roughness: 0.7 }),
    // the polished outer lip
    lip: new THREE.MeshPhysicalMaterial({ color: 0xe6e8eb, metalness: 1, roughness: 0.18 }),
    nut: new THREE.MeshPhysicalMaterial({ color: 0x9ea2a9, metalness: 1, roughness: 0.22 }),
    hub: new THREE.MeshPhysicalMaterial({ color: 0x80858d, metalness: 0.9, roughness: 0.34, clearcoat: 0.6, clearcoatRoughness: 0.15 }),
    hole: new THREE.MeshPhysicalMaterial({ color: 0x0a0a0b, metalness: 0.2, roughness: 0.8 }),
    enamel: new THREE.MeshPhysicalMaterial({ color: 0xe5262d, metalness: 0, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.04 }),
    paint: new THREE.MeshPhysicalMaterial({ color: 0xd8222a, metalness: 0, roughness: 0.45, clearcoat: 1, clearcoatRoughness: 0.16 }),
    // brushed steel: circular grain (anisotropy running round the disc) and a fine concentric roughness
    disc: new THREE.MeshPhysicalMaterial({ color: 0x74787f, metalness: 1, roughness: 1, roughnessMap: concentricRoughness(80, 125, 1600, 5), anisotropy: 0.85, anisotropyMap: tangentialAnisotropy() }),
    discEdge: new THREE.MeshPhysicalMaterial({ color: 0x3a3c40, metalness: 0.8, roughness: 0.6 }),
    hat: new THREE.MeshPhysicalMaterial({ color: 0x1e2023, metalness: 0.6, roughness: 0.6 }),
    well: new THREE.MeshPhysicalMaterial({ color: 0x0c0c0e, metalness: 0.3, roughness: 0.75 }),
    bolt: new THREE.MeshPhysicalMaterial({ color: 0xb4b8be, metalness: 1, roughness: 0.28 }),
  };
  // lathed parts face either way depending on their profile's direction: draw both sides
  for (const m of Object.values(MAT)) m.side = THREE.DoubleSide;
  return MAT;
}

function lathe(points, seg = 256) {
  const g = new THREE.LatheGeometry(points.map(([r, z]) => new THREE.Vector2(r, z)), seg);
  g.rotateX(Math.PI / 2);
  return g;
}

// ------------------------------------------------------------------ a shaped solid with a curved face
// Extrudes a 2D outline, cuts it into small triangles, then bends it: `sweep(r)` moves it along Z by its distance from the
// axis, and a crown lifts the face's middle above its edges. Returns {cap, sides}; normals keep the bevel edges crisp.
function insidePoly(pts, x, y) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function edgeDist(pts, x, y) {
  let d = Infinity;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [ax, ay] = pts[j], [bx, by] = pts[i];
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    d = Math.min(d, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return d;
}

function bentSolid(outline, { depth, bevel, bevelSegments = 2, sweep = () => 0, crown = 0, crownW = 0.03, edge = 0.006, crease = 32 }) {
  const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  const ext = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments, curveSegments: 1, steps: 1,
  });
  const parts = [[], []];
  const pos = ext.attributes.position;
  for (const g of ext.groups) for (let i = g.start; i < g.start + g.count; i++) parts[g.materialIndex].push(pos.getX(i), pos.getY(i), pos.getZ(i));
  const tess = new TessellateModifier(edge, 12);
  return parts.map((arr, k) => {
    let geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    geo = tess.modify(geo);
    geo.deleteAttribute('normal');
    geo.deleteAttribute('uv');
    const p = geo.attributes.position;
    // the front face is a height field: its height over the outline, and its normal straight from that height's slope
    const lift = (x, y) => sweep(Math.hypot(x, y)) + (crown && insidePoly(outline, x, y) ? crown * smooth(0, crownW, edgeDist(outline, x, y)) : 0);
    const nrm = k === 0 ? new Float32Array(p.count * 3) : null;
    const e = 0.0008;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      // the crown only lifts the front: it fades to nothing at the back face
      const w = Math.max(0, Math.min(1, z / depth));
      const c = lift(x, y) - sweep(Math.hypot(x, y));
      p.setZ(i, z + sweep(Math.hypot(x, y)) + c * w);
      if (nrm) {
        if (z > depth / 2) {
          const gx = (lift(x + e, y) - lift(x - e, y)) / (2 * e), gy = (lift(x, y + e) - lift(x, y - e)) / (2 * e);
          const l = Math.hypot(gx, gy, 1);
          nrm[3 * i] = -gx / l; nrm[3 * i + 1] = -gy / l; nrm[3 * i + 2] = 1 / l;
        } else nrm[3 * i + 2] = -1;
      }
    }
    if (nrm) geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    else geo = toCreasedNormals(geo, crease * DEG);
    return geo;
  });
}

// ------------------------------------------------------------------ rim
const R_LIP = 0.665; // where each spoke runs under the lip
const R_HUB = 0.13;
const FACE_Z = 0.3; // the spoke face at the lip
const SPOKE_DEPTH = 0.06, SPOKE_BEVEL = 0.01;

export function spokeSweep(r) {
  // concave: about 0.12 deeper at the hub than at the lip, level at the lip
  const t = Math.max(0, Math.min(1, (R_LIP - r) / (R_LIP - R_HUB)));
  return -0.12 * t * t;
}

function spokeOutline() {
  // one split-Y spoke pointing along +Y, from under the hub to under the lip
  const P = (r, a) => [r * Math.sin(a * DEG), r * Math.cos(a * DEG)];
  return [
    P(0.13, -19), P(0.3, -9.2), P(0.415, -8.2), P(0.55, -15.8), P(R_LIP, -19.5), P(R_LIP, -9.8), P(0.555, -5.8),
    P(0.47, -2.3), P(0.47, 2.3), P(0.555, 5.8), P(R_LIP, 9.8), P(R_LIP, 19.5), P(0.55, 15.8), P(0.415, 8.2), P(0.3, 9.2), P(0.13, 19),
  ];
}

function circlePath(path, cx, cy, r, n = 32, cw = false) {
  for (let i = 0; i <= n; i++) {
    const a = (cw ? -1 : 1) * (i / n) * TAU;
    const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
    if (i === 0) path.moveTo(x, y); else path.lineTo(x, y);
  }
  return path;
}

export function buildRim() {
  const M = mats();
  const g = new THREE.Group();
  // the polished outer lip, and the dark step inside it where the spokes end
  g.add(new THREE.Mesh(lathe([[0.632, 0.288], [0.648, 0.309], [0.666, 0.321], [0.688, 0.323], [0.703, 0.315], [0.711, 0.298], [0.706, 0.276]], 480), M.lip));
  g.add(new THREE.Mesh(lathe([[0.575, 0.262], [0.6, 0.272], [0.62, 0.278], [0.633, 0.29]], 360), M.gun));
  // the barrel behind it
  g.add(new THREE.Mesh(lathe([[0.62, 0.262], [0.634, 0.24], [0.634, -0.27], [0.69, -0.285]], 240), M.gunDouble));

  // five split-Y spokes: machined face, gunmetal sides
  const [cap, sides] = bentSolid(spokeOutline(), {
    depth: SPOKE_DEPTH, bevel: SPOKE_BEVEL, sweep: spokeSweep, crown: 0.012, crownW: 0.04, edge: 0.0035,
  });
  const lift = FACE_Z - SPOKE_DEPTH - SPOKE_BEVEL;
  for (const geo of [cap, sides]) geo.translate(0, 0, lift);
  planarUV(cap, 0.7);
  for (let k = 0; k < 5; k++) {
    const a = (k * TAU) / 5;
    const c = new THREE.Mesh(cap, M.face); c.rotation.z = a; g.add(c);
    const s = new THREE.Mesh(sides, M.gun); s.rotation.z = a; g.add(s);
  }

  // hub: a dark face with five recesses for the lug nuts, and a machined ring round its edge
  const HUB_Z = FACE_Z + spokeSweep(0.19) + 0.016;
  const hub = new THREE.Shape(); circlePath(hub, 0, 0, 0.192, 128);
  hub.holes.push(circlePath(new THREE.Path(), 0, 0, 0.081, 96, true));
  const lugA = (k) => (k * TAU) / 5 + TAU / 10 + Math.PI / 2;
  for (let k = 0; k < 5; k++) hub.holes.push(circlePath(new THREE.Path(), 0.122 * Math.cos(lugA(k)), 0.122 * Math.sin(lugA(k)), 0.031, 48, true));
  const hubGeo = new THREE.ExtrudeGeometry(hub, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: 3, curveSegments: 48 });
  hubGeo.translate(0, 0, HUB_Z - 0.058);
  g.add(new THREE.Mesh(hubGeo, [M.hub, M.gun]));
  g.add(new THREE.Mesh(lathe([[0.176, HUB_Z + 0.0005], [0.19, HUB_Z - 0.003], [0.198, HUB_Z - 0.012]], 256), M.face));
  // the recess floors and the nuts in them
  const nutG = new THREE.CylinderGeometry(0.019, 0.02, 0.026, 6); nutG.rotateX(Math.PI / 2);
  const tipG = new THREE.SphereGeometry(0.0175, 32, 12, 0, TAU, 0, Math.PI / 2); tipG.rotateX(Math.PI / 2);
  const floorG = new THREE.CircleGeometry(0.032, 48);
  for (let k = 0; k < 5; k++) {
    const x = 0.122 * Math.cos(lugA(k)), y = 0.122 * Math.sin(lugA(k));
    const f = new THREE.Mesh(floorG, M.hole); f.position.set(x, y, HUB_Z - 0.05); g.add(f);
    const nut = new THREE.Mesh(nutG, M.nut); nut.position.set(x, y, HUB_Z - 0.035); g.add(nut);
    const tip = new THREE.Mesh(tipG, M.nut); tip.position.set(x, y, HUB_Z - 0.022); g.add(tip);
  }
  // centre cap: the tag's red enamel in a thin alloy ring
  const capZ = HUB_Z + 0.006;
  g.add(new THREE.Mesh(lathe([[0.06, capZ + 0.004], [0.068, capZ + 0.005], [0.076, capZ + 0.002], [0.083, capZ - 0.01], [0.083, capZ - 0.05]], 192), M.lip));
  g.add(new THREE.Mesh(lathe([[0.0, capZ + 0.009], [0.035, capZ + 0.0085], [0.055, capZ + 0.006], [0.0605, capZ + 0.003]], 192), M.enamel));
  g.add(new THREE.Mesh(new THREE.CircleGeometry(0.081, 64).translate(0, 0, HUB_Z - 0.04), M.hole));
  return g;
}

// ------------------------------------------------------------------ brake
export function buildBrake() {
  const M = mats();
  const g = new THREE.Group();
  // the disc: dark brushed steel, drilled in three staggered rows
  const disc = new THREE.Shape(); circlePath(disc, 0, 0, 0.56, 256);
  disc.holes.push(circlePath(new THREE.Path(), 0, 0, 0.3, 192, true));
  const GROUPS = 15;
  for (let k = 0; k < GROUPS; k++) {
    for (const [r, off] of [[0.395, 0], [0.445, 0.27], [0.495, 0.54]]) {
      const a = ((k + off) / GROUPS) * TAU;
      disc.holes.push(circlePath(new THREE.Path(), r * Math.cos(a), r * Math.sin(a), 0.0105, 20, true));
    }
  }
  const dg = new THREE.ExtrudeGeometry(disc, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.002, bevelSegments: 1, curveSegments: 32 });
  planarUV(dg, 0.56);
  const d = new THREE.Mesh(dg, [M.disc, M.discEdge]); d.position.z = -0.1; g.add(d);
  // the hat: darker, stepped down to the hub
  g.add(new THREE.Mesh(lathe([[0.0, -0.012], [0.2, -0.012], [0.235, -0.025], [0.27, -0.06], [0.3, -0.068], [0.31, -0.072]], 192), M.hat));
  // the cooling vanes seen through the holes, and the dark well behind everything
  g.add(new THREE.Mesh(new THREE.CircleGeometry(0.57, 128).translate(0, 0, -0.13), M.hat));
  g.add(new THREE.Mesh(new THREE.CircleGeometry(0.69, 128).translate(0, 0, -0.3), M.well));
  g.add(new THREE.Mesh(lathe([[0.69, -0.3], [0.64, -0.29], [0.6, -0.2], [0.59, -0.14]], 192), M.well));

  // the caliper: a rounded monoblock over the disc's edge at about ten o'clock, glossy red paint
  const mid = 148 * DEG, half = 29 * DEG;
  const cal = [];
  const N = 40;
  const r0 = 0.395, r1 = 0.605;
  for (let i = 0; i <= N; i++) { const a = mid - half + (2 * half * i) / N; cal.push([r1 * Math.cos(a), r1 * Math.sin(a)]); }
  for (let i = N; i >= 0; i--) { const a = mid - half * 0.86 + (2 * half * 0.86 * i) / N; cal.push([r0 * Math.cos(a), r0 * Math.sin(a)]); }
  const [cc, cs] = bentSolid(cal, { depth: 0.07, bevel: 0.024, bevelSegments: 6, crown: 0.034, crownW: 0.1, edge: 0.006, crease: 50 });
  for (const geo of [cc, cs]) geo.translate(0, 0, -0.065);
  g.add(new THREE.Mesh(cc, M.paint), new THREE.Mesh(cs, M.paint));
  // its two mounting bolts and the bridge bolt
  const boltG = new THREE.CylinderGeometry(0.014, 0.014, 0.018, 6); boltG.rotateX(Math.PI / 2);
  for (const [s, r] of [[-0.62, 0.5], [0.62, 0.5]]) {
    const a = mid + s * half;
    const b = new THREE.Mesh(boltG, M.bolt); b.position.set(r * Math.cos(a), r * Math.sin(a), 0.045); g.add(b);
  }
  return g;
}

// ------------------------------------------------------------------ light rigs
function emissive(geo, intensity, color = 0xffffff) {
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
}

export function envAxis(renderer) {
  // light that is the same at every angle around the wheel's axis: a broad bright field in front of the wheel cut by two
  // dark gaps, so each curved spoke face is mostly light with a band or two running along it, plus a wide ring low around
  // the wheel that grazes the sidewall
  const s = new THREE.Scene();
  s.background = new THREE.Color(0x000000);
  const Z = 5;
  const band = (a0, a1, intensity) => {
    const m = emissive(new THREE.RingGeometry(Z * Math.tan(a0 * DEG), Z * Math.tan(a1 * DEG), 256, 1), intensity);
    m.position.z = Z; s.add(m);
  };
  band(0, 9.5, 0.8);
  band(17, 25, 0.85);
  band(33, 48, 0.55);
  band(54, 70, 1.0);
  const wide = emissive(new THREE.TorusGeometry(5.5, 1.4, 24, 256), 1.4); wide.position.z = 0.5; s.add(wide);
  dome(s, 0.0, 0.05, 0.05);
  return new THREE.PMREMGenerator(renderer).fromScene(s, 0.0, 0.1, 100, { size: 1024 }).texture;
}

let SOFTBOX;
function softboxTexture() {
  if (SOFTBOX) return SOFTBOX;
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
  const x = c.getContext('2d'), img = x.createImageData(N, N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const u = Math.abs(i / (N - 1) * 2 - 1), v = Math.abs(j / (N - 1) * 2 - 1);
    const e = Math.min(1, (1 - u) / 0.6) * Math.min(1, (1 - v) / 0.6);
    const k = (j * N + i) * 4;
    img.data[k] = img.data[k + 1] = img.data[k + 2] = 255 * (0.82 + 0.18 * (1 - u * v)); img.data[k + 3] = 255 * e * e * (3 - 2 * e);
  }
  x.putImageData(img, 0, 0);
  SOFTBOX = new THREE.CanvasTexture(c);
  SOFTBOX.colorSpace = THREE.SRGBColorSpace;
  return SOFTBOX;
}

function dome(s, bottom, horizon, top) {
  // the studio walls: a sphere graded from a dark floor through a grey horizon to a lighter ceiling
  const g = new THREE.SphereGeometry(20, 64, 32);
  const p = g.attributes.position, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / 20;
    const v = y < 0 ? horizon + (bottom - horizon) * Math.min(1, -y * 3) : horizon + (top - horizon) * Math.pow(y, 0.7);
    col[3 * i] = col[3 * i + 1] = col[3 * i + 2] = v;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  s.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
}

export function envStudio(renderer, { top = false } = {}) {
  // the studio for the stills: a graded room with softboxes and black flags (top: one soft light overhead)
  const s = new THREE.Scene();
  s.background = new THREE.Color(0x000000);
  const box = (w, h, intensity, color, pos) => {
    // a softbox: bright in the middle, its diffusion falling off toward a soft edge
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(intensity), map: softboxTexture(), transparent: true, side: THREE.DoubleSide, depthWrite: false,
    }));
    m.position.set(...pos); m.lookAt(0, 0, 0); s.add(m);
  };
  const flag = (w, h, pos) => {
    // a black flag with soft edges, so its reflection in the polished lip has no hard border
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: softboxTexture(), transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 0, 0); s.add(m);
  };
  if (top) {
    dome(s, 0.03, 0.22, 0.55);
    box(12, 8, 3.2, 0xffffff, [0, 8, 3]);
    box(14, 2, 0.8, 0xffffff, [0, -3, 8]);
    flag(5, 2, [0, -4, 7]);
  } else {
    // a white studio: bright ceiling, a big key overhead to the left, a cool strip behind right, black flags for contrast
    dome(s, 0.03, 0.2, 0.5);
    box(12, 8, 3.4, 0xfff6ec, [-6, 7, 5]);
    // high on the right, where the turned sidewall's upper-left bulge mirrors to: its long soft sheen
    box(9, 5, 1.5, 0xfff6ec, [4.5, 6, 4.5]);
    box(3, 12, 3.4, 0xcfdcff, [8, 1, -6]);
    box(14, 3, 0.9, 0xffffff, [2, -2.5, 9]);
    // a big white card to the camera's right: the wheel is turned that way, so its machined faces reflect it
    box(9, 6, 0.9, 0xffffff, [7, 0.5, 7]);
    flag(5, 3, [-6, -3.5, 6]);
    flag(3, 8, [-7, 0, -6]);
    flag(10, 2, [0, -3.2, -6]);
  }
  return new THREE.PMREMGenerator(renderer).fromScene(s, 0.0, 0.1, 100, { size: 1024 }).texture;
}

// ------------------------------------------------------------------ the tread laid flat
// x = rolling direction, `pitches` across [-w/2, w/2]; y = across the tread, -1..1 spans the tread width (0.66 units).
export function buildTreadPlane(pitches, extra, segU = 2600, segV = 700) {
  const pitch = TAU / PITCHES;
  const total = pitches + 2 * extra;
  const W = total * pitch, H = 0.66 * 1.06;
  const geo = new THREE.PlaneGeometry(W, H, segU, segV);
  const p = geo.attributes.position;
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    const u = x / pitch + total / 2 - extra; // whole pitches, so the strip tiles
    const v = y / 0.33;
    const shoulder = smooth(0.92, 1.06, Math.abs(v));
    const d = treadDepth(u, Math.max(-1, Math.min(1, v))) * (1 - shoulder);
    p.setZ(i, -0.024 * d - 0.05 * shoulder * shoulder);
    const ao = 1 - 0.55 * d - 0.4 * shoulder; // the bottom of a groove sees less of the room
    col[3 * i] = col[3 * i + 1] = col[3 * i + 2] = ao;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return { geo, W: pitches * pitch, H };
}
