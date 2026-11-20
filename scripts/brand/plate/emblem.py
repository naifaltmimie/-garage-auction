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


def _rand(seed):
    """A small fixed sequence, so the drawing is the same on every run."""
    x = seed
    while True:
        x = (x * 1103515245 + 12345) & 0x7fffffff
        yield x / 0x7fffffff


CROWN = (CX, 118.0)  # the crown's centre
RX, RY = 74.0, 54.0  # its solid mass: a little wider than tall


def frond(x, y, ang, length, width, droop):
    """A fine frond: a thin tapered blade bending under its own weight."""
    a = math.radians(ang)
    dx, dy = math.cos(a), math.sin(a)
    n = 10
    cl = [(x + dx * length * t, y + dy * length * t + droop * t * t) for t in [i / n for i in range(n + 1)]]
    left, right = [], []
    for i, (px, py) in enumerate(cl):
        t = i / n
        j, k = min(i + 1, n), max(i - 1, 0)
        tx, ty = cl[j][0] - cl[k][0], cl[j][1] - cl[k][1]
        L = math.hypot(tx, ty) or 1
        nx, ny = -ty / L, tx / L
        w = width * (1 - t) ** .9
        left.append((px + nx * w / 2, py + ny * w / 2))
        right.append((px - nx * w / 2, py - ny * w / 2))
    return _poly(left + right[::-1])


def crown():
    cx, cy = CROWN
    rnd = _rand(7)
    parts = []
    # the full mass
    parts.append(_poly([(cx + RX * math.cos(t), cy + RY * math.sin(t)) for t in [i * math.pi / 36 for i in range(72)]]))
    # a feathery edge: many short fine fronds of uneven length all round the upper two thirds of the mass
    for i in range(84):
        t = -math.pi - 0.5 + (math.pi + 1.0) * i / 83 + (next(rnd) - .5) * 0.04
        bx, by = cx + RX * .86 * math.cos(t), cy + RY * .86 * math.sin(t)
        ang = math.degrees(math.atan2(math.sin(t) * RY / RX, math.cos(t)))
        side = abs(math.cos(t))
        ln = 17 + 15 * next(rnd)
        parts.append(frond(bx, by, ang + (next(rnd) - .5) * 18, ln, 10 + 4 * next(rnd), 6 * side + 6 * next(rnd) * side))
    # the lowest fronds arch out and hang past the top of the trunk on both sides
    for sgn in (-1, 1):
        for k in range(9):
            ang = 90 - sgn * (30 + k * 6)
            ln = 40 + 10 * next(rnd) - k * 1.5
            bx = cx + sgn * (8 + k * 6.5)
            parts.append(frond(bx, cy + RY * .5, ang, ln, 17, 12 + 3 * k))
    return parts


def trunk():
    top, bot = 140.0, 300.0
    t = [(CX - 8, top), (CX + 8, top), (CX + 9, bot), (CX - 9, bot)]
    neck = [(CX - 13, bot - 8), (CX + 13, bot - 8), (CX + 17, bot + 3), (CX - 17, bot + 3)]
    base = [(CX - 36, bot + 1), (CX + 36, bot + 1), (CX + 30, bot + 15), (CX - 30, bot + 15)]
    return [_poly(t), _poly(neck), _poly(base)]


def _bez(p0, p1, p2, p3, t):
    u = 1 - t
    return (u ** 3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t ** 3 * p3[0],
            u ** 3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t ** 3 * p3[1])


def sword(mirror=False):
    """Tip at the upper outer end, blade sweeping down across the centre to the hilt at the lower opposite side."""
    P = [(6, 214), (62, 282), (150, 326), (262, 360)]
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
        w = 3 + 14 * (t ** .45)
        # the edge is the convex underside: the back stays straighter
        top.append((x - px * w * .35, y - py * w * .35))
        bot.append((x + px * w * .65, y + py * w * .65))
    blade = top + bot[::-1]
    hx, hy = cl[-1]
    tx, ty = cl[-1][0] - cl[-3][0], cl[-1][1] - cl[-3][1]
    L = math.hypot(tx, ty)
    ux, uy = tx / L, ty / L
    px, py = -uy, ux
    g = 15  # half guard
    guard = [(hx + px * g - ux * 6, hy + py * g - uy * 6), (hx + px * g + ux * 6, hy + py * g + uy * 6),
             (hx - px * g + ux * 6, hy - py * g + uy * 6), (hx - px * g - ux * 6, hy - py * g - uy * 6)]
    gl = 30
    grip = [(hx + px * 7, hy + py * 7), (hx + px * 6.5 + ux * gl, hy + py * 6.5 + uy * gl),
            (hx - px * 6.5 + ux * gl, hy - py * 6.5 + uy * gl), (hx - px * 7, hy - py * 7)]
    ex, ey = hx + ux * (gl + 6), hy + uy * (gl + 6)
    pommel = [(ex + 14 * math.cos(a), ey + 14 * math.sin(a)) for a in [i * math.pi / 10 for i in range(20)]]
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
