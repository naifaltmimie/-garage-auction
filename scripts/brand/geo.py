"""Custom lettering pipeline: shaped glyph outlines -> shapely geometry -> crafted layers -> SVG."""
import io, math
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.basePen import BasePen
from shapely.geometry import Polygon, MultiPolygon, box as sbox
from shapely.ops import unary_union
from shapely import affinity
from shapely.validation import make_valid

FX = '/tmp/claude-0/-home-claude/15da4d35-95ca-511f-947e-484db8ab0656/scratchpad/logo/fonts/x/fontsource-{0}-5.3.0/package/files/{0}-arabic-{1}-normal.woff'

class FlatPen(BasePen):
    def __init__(self, gs, steps=10):
        super().__init__(gs); self.contours = []; self.cur = []; self.steps = steps
    def _moveTo(self, p): self.cur = [p]
    def _lineTo(self, p): self.cur.append(p)
    def _curveToOne(self, p1, p2, p3):
        p0 = self.cur[-1]
        for i in range(1, self.steps + 1):
            t = i / self.steps; m = 1 - t
            self.cur.append((m**3*p0[0] + 3*m*m*t*p1[0] + 3*m*t*t*p2[0] + t**3*p3[0],
                             m**3*p0[1] + 3*m*m*t*p1[1] + 3*m*t*t*p2[1] + t**3*p3[1]))
    def _qCurveToOne(self, p1, p2):
        p0 = self.cur[-1]
        for i in range(1, self.steps + 1):
            t = i / self.steps; m = 1 - t
            self.cur.append((m*m*p0[0] + 2*m*t*p1[0] + t*t*p2[0], m*m*p0[1] + 2*m*t*p1[1] + t*t*p2[1]))
    def _closePath(self):
        if len(self.cur) > 2: self.contours.append(self.cur)
        self.cur = []
    _endPath = _closePath

_fonts = {}
def font(slug, w):
    k = (slug, w)
    if k not in _fonts:
        f = TTFont(FX.format(slug, w)); buf = io.BytesIO(); f.flavor = None; f.save(buf)
        data = buf.getvalue(); _fonts[k] = (TTFont(io.BytesIO(data)), data)
    return _fonts[k]

def signed_area(pts):
    return 0.5 * sum(pts[i][0]*pts[(i+1) % len(pts)][1] - pts[(i+1) % len(pts)][0]*pts[i][1] for i in range(len(pts)))

def glyph_geom(gs, name):
    pen = FlatPen(gs); gs[name].draw(pen)
    cs = pen.contours
    if not cs: return None
    areas = [signed_area(c) for c in cs]
    big = max(range(len(cs)), key=lambda i: abs(areas[i]))
    sign = 1 if areas[big] > 0 else -1
    outers = [make_valid(Polygon(c)) for c, a in zip(cs, areas) if a * sign > 0]
    holes = [make_valid(Polygon(c)) for c, a in zip(cs, areas) if a * sign < 0]
    g = unary_union(outers)
    if holes: g = g.difference(unary_union(holes))
    return g

def text_geom(slug, w, text, size=100):
    f, data = font(slug, w)
    upm = f['head'].unitsPerEm; s = size / upm
    face = hb.Face(data); hf = hb.Font(face)
    b = hb.Buffer(); b.add_str(text); b.guess_segment_properties(); hb.shape(hf, b, {})
    gs = f.getGlyphSet(); order = f.getGlyphOrder()
    x = 0; parts = []
    for i, p in zip(b.glyph_infos, b.glyph_positions):
        g = glyph_geom(gs, order[i.codepoint])
        if g is not None and not g.is_empty:
            g = affinity.scale(g, s, s, origin=(0, 0))
            g = affinity.translate(g, x + p.x_offset * s, p.y_offset * s)
            parts.append(g)
        x += p.x_advance * s
    return unary_union(parts)

def components(g):
    if g.is_empty: return []
    return list(g.geoms) if hasattr(g, 'geoms') else [g]

def split_dots(g, size, k=0.2):
    """small isolated components are dots"""
    dots, body = [], []
    for c in components(g):
        x0, y0, x1, y1 = c.bounds
        (dots if (x1-x0) * (y1-y0) < (size*k)**2 else body).append(c)
    return unary_union(body), dots

def diamond(c, scale=1.15):
    cx, cy = c.centroid.x, c.centroid.y
    r = math.sqrt(c.area / 2) * scale
    return Polygon([(cx, cy + r), (cx + r, cy), (cx, cy - r), (cx - r, cy)])

def angled_tops(g, y_cut, angle_deg=28, side='left'):
    """cut the top of every stroke that rises above y_cut with the same slanted plane per stroke"""
    x0, y0, x1, y1 = g.bounds
    top = g.intersection(sbox(x0 - 10, y_cut, x1 + 10, y1 + 10))
    cuts = []
    t = math.tan(math.radians(angle_deg))
    for c in components(top):
        a0, b0, a1, b1 = c.bounds
        w = a1 - a0
        if (b1 - b0) < w * 0.9:   # only real stems; leave arms (the kaf's) and bowls alone
            continue
        drop = w * t
        if side == 'left':   # left corner lower: cut a triangle off the top-left
            tri = Polygon([(a0 - 1, b1 + 1), (a1 + 1, b1 + 1), (a1 + 1, b1), (a0 - 1, b1 - drop)])
        else:
            tri = Polygon([(a0 - 1, b1 + 1), (a1 + 1, b1 + 1), (a1 + 1, b1 - drop), (a0 - 1, b1)])
        cuts.append(tri)
    return g.difference(unary_union(cuts)) if cuts else g

SIMPLIFY = 0.12
def to_path(g, H):
    """shapely (y-up) -> svg path (y-down, flipped about H)"""
    out = []
    g = g.simplify(SIMPLIFY, preserve_topology=True)
    for p in components(g):
        if p.geom_type != 'Polygon': continue
        for ring in [p.exterior, *p.interiors]:
            pts = list(ring.coords)
            out.append('M' + ' L'.join(f'{x:.1f} {H - y:.1f}' for x, y in pts[:-1]) + 'Z')
    return ' '.join(out)
