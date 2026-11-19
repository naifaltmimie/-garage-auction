// The wheel model: a 245/40 R19 tyre on a 19" two-tone five split-Y spoke rim, with a disc and a red caliper behind.
// Units: tyre outer radius = 1, wheel axis = Z, viewer on +Z. render.html exposes window.renderLayer(name, size).
import * as THREE from 'three';

const TAU = Math.PI * 2;
const PITCHES = 72;

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
  let d = 0;
  // four circumferential grooves
  for (const c of [0.24, 0.6]) d = Math.max(d, 1 - smooth(0.04, 0.065, Math.abs(a - c)));
  if (a > 0.66) {
    // shoulder blocks: lateral slots, slightly swept
    const f = frac(u + 0.18 * a + side);
    d = Math.max(d, 1 - smooth(0.1, 0.14, Math.abs(f - 0.12)));
    // a thin sipe across each shoulder block
    d = Math.max(d, 0.55 * (1 - smooth(0.012, 0.025, Math.abs(f - 0.62))));
  } else if (a > 0.3) {
    // intermediate rib: angled lateral slots that stop short of the centre groove
    const f = frac(u + 0.55 * a + side + 0.25);
    if (a > 0.36) d = Math.max(d, 0.85 * (1 - smooth(0.035, 0.055, Math.abs(f - 0.5))));
  } else if (a < 0.18) {
    // centre rib: fine directional sipes
    const f = frac(u + 0.9 * a + side);
    d = Math.max(d, 0.45 * (1 - smooth(0.01, 0.022, Math.abs(f - 0.5))));
  }
  return d;
}

// ------------------------------------------------------------------ tyre
const PROFILE = [
  [0.69, 0.3], [0.73, 0.335], [0.78, 0.355], [0.83, 0.36], [0.89, 0.355], [0.935, 0.345], [0.965, 0.33],
  [0.988, 0.305], [1.0, 0.27], [1.0, 0.0], [1.0, -0.27], [0.988, -0.305], [0.965, -0.33], [0.935, -0.345],
  [0.89, -0.355], [0.83, -0.36], [0.78, -0.355], [0.73, -0.335], [0.69, -0.3],
];

function profilePoints(n) {
  const curve = new THREE.SplineCurve(PROFILE.map(([r, z]) => new THREE.Vector2(r, z)));
  curve.arcLengthDivisions = 2000;
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
  g.fillStyle = 'rgb(0,205,0)'; g.fillRect(0, 0, W, H);
  const P = pts.length;
  // canvas row for a radius on the front (and mirrored back) sidewall
  const rowFront = (r) => {
    for (let j = 0; j < P / 2; j++) if (pts[j].x >= r) return (j / (P - 1)) * H;
    return H / 2;
  };
  const rowBack = (r) => H - rowFront(r);
  const band = (r0, r1, val) => {
    for (const rowOf of [rowFront, rowBack]) {
      const y0 = rowOf(r0), y1 = rowOf(r1);
      b.fillStyle = `rgb(${val},${val},${val})`;
      b.fillRect(0, Math.min(y0, y1), W, Math.max(1, Math.abs(y1 - y0)));
    }
  };
  // concentric ribs near the bead, the rim-protector ridge, ribs near the shoulder
  for (let k = 0; k < 6; k++) band(0.715 + k * 0.011, 0.72 + k * 0.011, 150);
  band(0.7, 0.708, 255); // rim protector
  band(0.703, 0.705, 200);
  for (let k = 0; k < 5; k++) band(0.915 + k * 0.009, 0.919 + k * 0.009, 140);
  band(0.905, 0.908, 220);
  // lettering band at r 0.86: same rubber, raised, smoother
  const pxU = W / (TAU * 0.86); // px per unit along the circumference
  const pxV = H / length; // px per unit across
  const yC = rowFront(0.862);
  const words = [];
  const big = 'ALKARAJ', size = 'AL', small1 = '245/40 ZR19 98Y', small2 = 'RADIAL TUBELESS';
  words.push([big, 0.25, 0.062], [big, 0.75, 0.062], [small1, 0.0, 0.026], [small2, 0.5, 0.026]);
  void size;
  for (const [txt, u, hUnits] of words) {
    for (const [ctx, fill] of [[b, '#fff'], [g, 'rgb(0,150,0)']]) {
      ctx.save();
      ctx.translate(u * W, yC);
      ctx.rotate(Math.PI); // letters advance clockwise with their tops outward
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

export function buildTyre({ segments = 1080, rows = 200 } = {}) {
  const { pts, length } = profilePoints(rows);
  const geo = new THREE.LatheGeometry(pts, segments);
  const pos = geo.attributes.position;
  const P = pts.length;
  for (let i = 0; i <= segments; i++) {
    const phi = (i / segments) * TAU;
    const u = (i / segments) * PITCHES;
    for (let j = 0; j < P; j++) {
      const r = pts[j].x, z = pts[j].y;
      if (r < 0.94) continue;
      const fade = smooth(0.94, 0.965, r);
      const v = Math.max(-1, Math.min(1, z / 0.33));
      const d = 0.02 * treadDepth(i === segments ? 0 : u, v) * fade;
      const k = i * P + j;
      const nr = r - d;
      pos.setXYZ(k, nr * Math.sin(phi), z, nr * Math.cos(phi));
    }
  }
  geo.computeVertexNormals();
  geo.rotateX(Math.PI / 2);
  const { tb, tr } = sidewallMaps(pts, length);
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x17171a,
    roughness: 1,
    roughnessMap: tr,
    metalness: 0,
    bumpMap: tb,
    bumpScale: 14,
    sheen: 0.35,
    sheenRoughness: 0.6,
    sheenColor: new THREE.Color(0x3a3c42),
    specularIntensity: 1,
    side: THREE.DoubleSide,
  });
  return new THREE.Mesh(geo, mat);
}

// ------------------------------------------------------------------ rim
const alu = () => new THREE.MeshPhysicalMaterial({ color: 0xe6e8ec, metalness: 1, roughness: 0.24 });
const gun = () => new THREE.MeshPhysicalMaterial({ color: 0x2a2c31, metalness: 0.9, roughness: 0.45 });

function lathe(points, seg = 256) {
  const g = new THREE.LatheGeometry(points.map(([r, z]) => new THREE.Vector2(r, z)), seg);
  g.rotateX(Math.PI / 2);
  return g;
}

function spokeShape() {
  // one split-Y spoke pointing along +Y, from under the hub cap to the lip; straight diamond-cut edges
  const s = new THREE.Shape();
  const deg = Math.PI / 180;
  const P = (r, a) => [r * Math.sin(a * deg), r * Math.cos(a * deg)];
  const pts = [
    P(0.13, -20), P(0.3, -9.5), P(0.42, -8.5), P(0.56, -16.5), P(0.67, -20), P(0.67, -9.5), P(0.56, -5.5),
    P(0.475, -2.2), P(0.475, 2.2), P(0.56, 5.5), P(0.67, 9.5), P(0.67, 20), P(0.56, 16.5), P(0.42, 8.5), P(0.3, 9.5), P(0.13, 20),
  ];
  s.moveTo(...pts[0]);
  for (const p of pts.slice(1)) s.lineTo(...p);
  s.closePath();
  return s;
}

function concave(geo, zFront, depth) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const r = Math.hypot(x, y);
    const t = 1 - smooth(0.14, 0.66, r);
    pos.setZ(i, z + zFront - depth * Math.pow(t, 0.8));
  }
  geo.computeVertexNormals();
  return geo;
}

export function buildRim() {
  const g = new THREE.Group();
  // outer lip (polished), flange and barrel (dark)
  g.add(new THREE.Mesh(lathe([[0.62, 0.27], [0.635, 0.3], [0.655, 0.318], [0.68, 0.322], [0.7, 0.315], [0.708, 0.3], [0.7, 0.28]], 360), alu()));
  g.add(new THREE.Mesh(lathe([[0.64, 0.24], [0.636, 0.1], [0.636, -0.28], [0.69, -0.29]], 180), Object.assign(gun(), { side: THREE.DoubleSide })));
  // spoke face
  const spoke = new THREE.ExtrudeGeometry(spokeShape(), {
    depth: 0.06, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: 3, curveSegments: 1,
  });
  // concave face: each spoke leans back toward the hub, about 0.10 deeper at the hub than at the lip (flat facets stay crisp)
  spoke.translate(0, -0.67, -0.06);
  spoke.rotateX(-Math.atan2(0.1, 0.5));
  spoke.translate(0, 0.67, 0.27);
  const faceM = alu(), sideM = gun();
  for (let k = 0; k < 5; k++) {
    const m = new THREE.Mesh(spoke, [faceM, sideM]);
    m.rotation.z = (k * TAU) / 5;
    g.add(m);
  }
  // inner face ring where the spokes meet the lip
  g.add(new THREE.Mesh(lathe([[0.6, 0.255], [0.625, 0.272], [0.64, 0.27]], 360), gun()));
  // hub
  g.add(new THREE.Mesh(lathe([[0.0, 0.18], [0.17, 0.178], [0.19, 0.16], [0.19, 0.08]], 128), gun()));
  const hubFace = new THREE.Mesh(lathe([[0.155, 0.181], [0.178, 0.179], [0.186, 0.17]], 128), alu());
  g.add(hubFace);
  const nutM = new THREE.MeshPhysicalMaterial({ color: 0x3a3c42, metalness: 1, roughness: 0.18 });
  const holeM = new THREE.MeshPhysicalMaterial({ color: 0x08090a, metalness: 0.5, roughness: 0.7 });
  for (let k = 0; k < 5; k++) {
    const a = (k * TAU) / 5 + TAU / 10;
    const x = 0.118 * Math.sin(a), y = 0.118 * Math.cos(a);
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.01, 40), holeM);
    hole.rotation.x = Math.PI / 2; hole.position.set(x, y, 0.182); g.add(hole);
    const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.03, 6), nutM);
    nut.rotation.x = Math.PI / 2; nut.position.set(x, y, 0.18); g.add(nut);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.016, 24, 12, 0, TAU, 0, Math.PI / 2), nutM);
    tip.rotation.x = Math.PI / 2; tip.position.set(x, y, 0.194); g.add(tip);
  }
  // centre cap: brand red inside a thin alloy ring
  g.add(new THREE.Mesh(lathe([[0.0, 0.192], [0.062, 0.192], [0.07, 0.19], [0.072, 0.18]], 128), alu()));
  const red = new THREE.MeshPhysicalMaterial({ color: 0xe5262d, metalness: 0.1, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.12 });
  g.add(new THREE.Mesh(lathe([[0.0, 0.198], [0.052, 0.196], [0.056, 0.192]], 128), red));
  return g;
}

// ------------------------------------------------------------------ brake
export function buildBrake() {
  const g = new THREE.Group();
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const x = c.getContext('2d');
  x.fillStyle = 'rgb(0,90,0)'; x.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 900; i++) {
    const r = (0.3 + Math.random() * 0.26) / 0.56 * 512;
    const v = 60 + Math.random() * 90;
    x.strokeStyle = `rgba(0,${v | 0},0,.5)`;
    x.lineWidth = 0.6 + Math.random();
    x.beginPath(); x.arc(512, 512, r, 0, TAU); x.stroke();
  }
  const rt = new THREE.CanvasTexture(c);
  const disc = new THREE.RingGeometry(0.3, 0.56, 256, 1);
  // planar UVs over the disc's bounding square
  const uv = disc.attributes.uv, p = disc.attributes.position;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 1.12 + 0.5, p.getY(i) / 1.12 + 0.5);
  const steel = new THREE.MeshPhysicalMaterial({ color: 0x6d7076, metalness: 1, roughness: 1, roughnessMap: rt });
  const d = new THREE.Mesh(disc, steel); d.position.z = -0.06; g.add(d);
  // drilled holes suggestion: a darker inner band where the vanes show
  const hat = new THREE.Mesh(lathe([[0.0, -0.02], [0.2, -0.02], [0.24, -0.035], [0.3, -0.06]], 128), new THREE.MeshPhysicalMaterial({ color: 0x2b2d31, metalness: 0.8, roughness: 0.55 }));
  g.add(hat);
  // caliper: an arc of about 62 degrees between r 0.38 and 0.60, centred near 10 o'clock
  const mid = (150 * Math.PI) / 180, half = (31 * Math.PI) / 180;
  const sh = new THREE.Shape();
  sh.absarc(0, 0, 0.6, mid - half, mid + half, false);
  sh.absarc(0, 0, 0.38, mid + half, mid - half, true);
  sh.closePath();
  const cg = new THREE.ExtrudeGeometry(sh, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 6, curveSegments: 96 });
  const red = new THREE.MeshPhysicalMaterial({ color: 0xe5262d, metalness: 0.15, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.08 });
  const cal = new THREE.Mesh(cg, red); cal.position.z = -0.03; g.add(cal);
  const boltM = new THREE.MeshPhysicalMaterial({ color: 0xb8bcc2, metalness: 1, roughness: 0.3 });
  for (const s of [-1, 1]) {
    const a = mid + s * half * 0.68;
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.02, 6), boltM);
    b.rotation.x = Math.PI / 2; b.position.set(0.49 * Math.cos(a), 0.49 * Math.sin(a), 0.065); g.add(b);
  }
  return g;
}

// ------------------------------------------------------------------ light rigs
function emissive(geo, intensity, color = 0xffffff) {
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
}

export function envAxis(renderer) {
  // light that is the same at every angle around the wheel's axis: a big coaxial ring in front plus a weak frontal fill
  const s = new THREE.Scene();
  s.background = new THREE.Color(0x050506);
  const ring = emissive(new THREE.TorusGeometry(3.2, 0.9, 32, 256), 2.2);
  ring.position.z = 3.2; s.add(ring);
  const fill = emissive(new THREE.CircleGeometry(1.4, 96), 0.55);
  fill.position.z = 6; s.add(fill);
  const back = emissive(new THREE.TorusGeometry(6, 1.2, 16, 128), 0.25);
  back.position.z = -1; s.add(back);
  return new THREE.PMREMGenerator(renderer).fromScene(s, 0.02).texture;
}

export function envStudio(renderer, top = false) {
  // soft key from the top left, a cool rim light from behind right, a low fill
  const s = new THREE.Scene();
  s.background = new THREE.Color(0x040405);
  const key = emissive(new THREE.PlaneGeometry(6, 4), 3.0);
  key.position.set(top ? 0 : -4, 6, 3); key.lookAt(0, 0, 0); s.add(key);
  const rim = emissive(new THREE.PlaneGeometry(2, 6), 2.2, 0xcfe0ff);
  rim.position.set(5, 1, -3); rim.lookAt(0, 0, 0); s.add(rim);
  const fill = emissive(new THREE.PlaneGeometry(8, 3), 0.35);
  fill.position.set(2, -3, 6); fill.lookAt(0, 0, 0); s.add(fill);
  const ring = emissive(new THREE.TorusGeometry(3.4, 0.5, 16, 128), 0.6);
  ring.position.z = 4; s.add(ring);
  return new THREE.PMREMGenerator(renderer).fromScene(s, 0.02).texture;
}
