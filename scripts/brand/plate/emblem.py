"""The national emblem as pressed on the plate's strip, drawn as one solid silhouette (viewBox 0 0 380 420):
a round dense crown of fronds radiating from the top of a thin straight trunk, the lower fronds drooping, a small base,
and under it two long curved swords crossing in a wide flat X, tips curving up at the outer ends, each with a guard and
a pommel at its lower end. Every sub-path winds the same way, so overlaps fill (nonzero)."""
import math

CX = 190.0


def _area(pts):
    return sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1])) / 2


def _poly(pts):
    if _area(pts) < 0:
        pts = pts[::-1]
    return 'M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in pts) + 'Z'


def leaf(bx, by, ang, length, width, droop, teeth=5):
    """A tapered frond along a drooping curve, its edges cut into a few leaflets."""
    a = math.radians(ang)
    dx, dy = math.cos(a), math.sin(a)
    n = 22
    cl = []
    for i in range(n + 1):
        t = i / n
        cl.append((bx + dx * length * t, by + dy * length * t + droop * t * t))
    left, right = [], []
    for i, (x, y) in enumerate(cl):
        t = i / n
        if i < n:
            tx, ty = cl[i + 1][0] - x, cl[i + 1][1] - y
        else:
            tx, ty = x - cl[i - 1][0], y - cl[i - 1][1]
        L = math.hypot(tx, ty) or 1
        px, py = -ty / L, tx / L
        w = width * (math.sin(math.pi * min(t * 1.15, 1)) ** .7) * (1 - .25 * t)
        w *= .6 + .75 * abs(math.sin(t * math.pi * teeth))
        left.append((x + px * w / 2, y + py * w / 2))
        right.append((x - px * w / 2, y - py * w / 2))
    return _poly(left + right[::-1])


def crown():
    bx, by = CX, 116.0
    parts = []
    # the upper half: many narrow fronds fanning round
    for i in range(19):
        ang = -180 + i * 10
        side = abs(math.cos(math.radians(ang)))
        parts.append(leaf(bx, by, ang, 114 - 4 * side, 27, 34 * side, teeth=4))
    # the lower fronds hanging down on each side
    for ang, ln, dr in [(14, 106, 58), (34, 92, 48), (54, 76, 32), (166, 106, 58), (146, 92, 48), (126, 76, 32)]:
        parts.append(leaf(bx, by, ang, ln, 22, dr, teeth=4))
    # the dense heart of the crown
    pts = [(bx + 62 * math.cos(t), by - 6 + 52 * math.sin(t)) for t in [i * math.pi / 24 for i in range(48)]]
    parts.append(_poly(pts))
    return parts


def trunk():
    top, bot = 128.0, 304.0
    t = [(CX - 7, top), (CX + 7, top), (CX + 8.5, bot), (CX - 8.5, bot)]
    neck = [(CX - 12, bot - 8), (CX + 12, bot - 8), (CX + 16, bot + 3), (CX - 16, bot + 3)]
    base = [(CX - 36, bot + 1), (CX + 36, bot + 1), (CX + 30, bot + 15), (CX - 30, bot + 15)]
    return [_poly(t), _poly(neck), _poly(base)]


def _bez(p0, p1, p2, p3, t):
    u = 1 - t
    return (u ** 3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t ** 3 * p3[0],
            u ** 3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t ** 3 * p3[1])


def sword(mirror=False):
    """Tip at the upper outer end, blade sweeping down across the centre to the hilt at the lower opposite side."""
    P = [(30, 276), (80, 322), (156, 356), (246, 382)]
    n = 40
    cl = [_bez(*P, i / n) for i in range(n + 1)]
    top, bot = [], []
    for i, (x, y) in enumerate(cl):
        t = i / n
        j = min(i + 1, n)
        k = max(i - 1, 0)
        tx, ty = cl[j][0] - cl[k][0], cl[j][1] - cl[k][1]
        L = math.hypot(tx, ty) or 1
        px, py = -ty / L, tx / L
        w = 2 + 12 * (t ** .55)
        # the edge is the convex underside: the back stays straighter
        top.append((x - px * w * .35, y - py * w * .35))
        bot.append((x + px * w * .65, y + py * w * .65))
    blade = top + bot[::-1]
    hx, hy = cl[-1]
    tx, ty = cl[-1][0] - cl[-3][0], cl[-1][1] - cl[-3][1]
    L = math.hypot(tx, ty)
    ux, uy = tx / L, ty / L
    px, py = -uy, ux
    g = 22  # half guard
    guard = [(hx + px * g - ux * 5, hy + py * g - uy * 5), (hx + px * g + ux * 5, hy + py * g + uy * 5),
             (hx - px * g + ux * 5, hy - py * g + uy * 5), (hx - px * g - ux * 5, hy - py * g - uy * 5)]
    gl = 30
    grip = [(hx + px * 5.5, hy + py * 5.5), (hx + px * 5 + ux * gl, hy + py * 5 + uy * gl),
            (hx - px * 5 + ux * gl, hy - py * 5 + uy * gl), (hx - px * 5.5, hy - py * 5.5)]
    ex, ey = hx + ux * (gl + 6), hy + uy * (gl + 6)
    pommel = [(ex + 10 * math.cos(a) , ey + 10 * math.sin(a)) for a in [i * math.pi / 10 for i in range(20)]]
    # the hilt's curl turning back up toward the outside
    curl = [(ex + px * 2 + ux * 2, ey + py * 2 + uy * 2), (ex - px * 20 + ux * 4, ey - py * 20 + uy * 4),
            (ex - px * 24 - ux * 4, ey - py * 24 - uy * 4), (ex - px * 4 - ux * 6, ey - py * 4 - uy * 6)]
    shapes = [blade, guard, grip, pommel, curl]
    if mirror:
        shapes = [[(2 * CX - x, y) for x, y in s] for s in shapes]
    return [_poly(s) for s in shapes]


def emblem_path():
    return ''.join(crown() + trunk() + sword() + sword(True))


if __name__ == '__main__':
    print(len(emblem_path()))
