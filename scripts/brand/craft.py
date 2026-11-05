import sys, math
sys.path.insert(0, '/tmp/claude-0/-home-claude/15da4d35-95ca-511f-947e-484db8ab0656/scratchpad/logo')
from geo import *
from shapely.geometry import Polygon
from shapely.ops import unary_union
from shapely import affinity

def craft(slug='kufam', w=900, slant=11, cut=26, cut_side='left', B=6.0, depth=(3.2, 7.0), box_scale=0.62,
          red='#e5262d', ink='#0b0f0d', deep='#000000', face='#ffffff', face2=None, dot='#e5262d', boxdot='#ffffff',
          gap=7.0, align='right', top_word='مزاد', big_word='الكراج', tone_split=None, tag=True, layout='stack', parts_only=None):
    # big word
    g2 = text_geom(slug, w, big_word, 100)
    body2, dots2 = split_dots(g2, 100)
    x0, y0, x1, y1 = body2.bounds
    xh = y0 + (y1 - y0) * 0.62
    if cut: body2 = angled_tops(body2, xh, cut, cut_side)
    dia2 = [diamond(d) for d in dots2]
    big = unary_union([body2, *dia2])
    bx0, by0, bx1, by1 = big.bounds
    W = bx1 - bx0
    # top word inside a box
    g1 = text_geom(slug, w, top_word, 100)
    body1, dots1 = split_dots(g1, 100)
    if cut:
        a0, b0, a1, b1 = body1.bounds
        body1 = angled_tops(body1, b0 + (b1 - b0) * 0.62, cut, cut_side)
    dia1 = [diamond(d) for d in dots1]
    small = unary_union([body1, *dia1])
    sx0, sy0, sx1, sy1 = small.bounds
    k = (W * box_scale - 0) / (sx1 - sx0) * 0.78
    small = affinity.scale(small, k, k, origin=(sx0, sy0))
    body1 = affinity.scale(body1, k, k, origin=(sx0, sy0)); dia1 = [affinity.scale(d, k, k, origin=(sx0, sy0)) for d in dia1]
    sx0, sy0, sx1, sy1 = small.bounds
    padx, pady = (sx1 - sx0) * 0.13, (sy1 - sy0) * 0.17
    bh = (sy1 - sy0) + 2 * pady
    bw = (sx1 - sx0) + 2 * padx + (bh * 0.42 if tag else 0)
    if layout == 'row':
        # tag sits to the right of the big word, centred on the letters' main body
        kk = ((by1 - by0) * 0.62) / bh
        small = affinity.scale(small, kk, kk, origin=(sx0, sy0)); body1 = affinity.scale(body1, kk, kk, origin=(sx0, sy0))
        dia1 = [affinity.scale(d, kk, kk, origin=(sx0, sy0)) for d in dia1]
        sx0, sy0, sx1, sy1 = small.bounds
        padx, pady = padx * kk, pady * kk; bw, bh = bw * kk, bh * kk
        bottom = by0 + (by1 - by0) * 0.30 - bh * 0.35
        right = bx1 + gap * 2.2 + bw
    else:
        bottom = by1 + gap
        right = bx1 if align == 'right' else (bx0 + bx1) / 2 + bw / 2
    if tag:
        tip = bh * 0.42
        boxp = Polygon([(right - bw, bottom + bh * 0.5 - bh * 0.5), (right, bottom), (right, bottom + bh), (right - bw, bottom + bh)])
        boxp = Polygon([(right - bw + tip, bottom), (right, bottom), (right, bottom + bh), (right - bw + tip, bottom + bh), (right - bw, bottom + bh / 2)])
        from shapely.geometry import Point
        hole = Point(right - bw + tip * 0.62, bottom + bh / 2).buffer(bh * 0.085, 24)
        boxp = boxp.difference(hole)
    else:
        boxp = Polygon([(right - bw, bottom), (right, bottom), (right, bottom + bh), (right - bw, bottom + bh)])
    dx = (right - padx) - sx1; dy = (bottom + pady) - sy0
    move = lambda g: affinity.translate(g, dx, dy)
    small, body1, dia1 = move(small), move(body1), [move(d) for d in dia1]
    # slant everything around the baseline of the big word
    sk = lambda g: affinity.skew(g, xs=-slant, origin=(bx0 + W / 2, 0))
    big, body2, dia2 = sk(big), sk(body2), [sk(d) for d in dia2]
    boxp, small, body1, dia1 = sk(boxp), sk(small), sk(body1), [sk(d) for d in dia1]
    all_face = unary_union([big, boxp])
    back = all_face.buffer(B, join_style=2, mitre_limit=3.0)
    ext = unary_union([affinity.translate(back, depth[0] * t, -depth[1] * t) for t in [i / 6 for i in range(1, 7)]])
    shadow = ext.difference(back)
    gx0, gy0, gx1, gy1 = unary_union([back, ext]).bounds
    m = 4
    H = gy1 + m
    vb = f'{gx0 - m:.1f} {0:.1f} {gx1 - gx0 + 2 * m:.1f} {gy1 - gy0 + 2 * m:.1f}'
    # flip helper: path uses H - y; view box from y = 0 .. (gy1-gy0+2m) after flip H = gy1 + m
    P = lambda g: to_path(g, H)
    face_body = body2
    parts = [f'<path d="{P(ext)}" fill="{deep}"/>', f'<path d="{P(back)}" fill="{ink}"/>',
             f'<path d="{P(boxp)}" fill="{red}"/>']
    if tone_split:
        # lower part of the big letters a touch darker: a flat two-tone cut, no gradient
        lx0, ly0, lx1, ly1 = face_body.bounds
        lower = face_body.intersection(affinity.skew(Polygon([(lx0 - 50, ly0 - 50), (lx1 + 50, ly0 - 50), (lx1 + 50, tone_split), (lx0 - 50, tone_split)]), xs=0))
        parts.append(f'<path d="{P(face_body)}" fill="{face}"/>')
        parts.append(f'<path d="{P(lower)}" fill="{face2}"/>')
    else:
        parts.append(f'<path d="{P(face_body)}" fill="{face}"/>')
    parts.append(f'<path d="{P(unary_union(dia2))}" fill="{dot}"/>')
    parts.append(f'<path d="{P(body1)}" fill="#ffffff"/>')
    if dia1: parts.append(f'<path d="{P(unary_union(dia1))}" fill="{boxdot}"/>')
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}">' + ''.join(parts) + '</svg>'
    return svg

def tag_only(slug='lalezar', w=400, text='مزاد', slant=11, cut=26, B=6.0, depth=(3.2, 7.0), red='#e5262d', ink='#0b0f0d',
             deep='#000000', letter='#ffffff', pad=(0.16, 0.2), margin=4, square=False):
    from shapely.geometry import Point
    g1 = text_geom(slug, w, text, 100)
    body1, dots1 = split_dots(g1, 100)
    if cut:
        a0, b0, a1, b1 = body1.bounds
        body1 = angled_tops(body1, b0 + (b1 - b0) * 0.62, cut, 'left')
    dia1 = [diamond(d) for d in dots1]
    small = unary_union([body1, *dia1])
    sx0, sy0, sx1, sy1 = small.bounds
    padx, pady = (sx1 - sx0) * pad[0], (sy1 - sy0) * pad[1]
    bh = (sy1 - sy0) + 2 * pady
    tip = bh * 0.42
    bw = (sx1 - sx0) + 2 * padx + tip
    right, bottom = sx1 + padx, sy0 - pady
    boxp = Polygon([(right - bw + tip, bottom), (right, bottom), (right, bottom + bh), (right - bw + tip, bottom + bh), (right - bw, bottom + bh / 2)])
    hole = Point(right - bw + tip * 0.62, bottom + bh / 2).buffer(bh * 0.085, 24)
    boxp = boxp.difference(hole)
    cx = (right - bw / 2)
    sk = lambda g: affinity.skew(g, xs=-slant, origin=(cx, bottom))
    boxp, body1, dia1 = sk(boxp), sk(body1), [sk(d) for d in dia1]
    back = boxp.buffer(B, join_style=2, mitre_limit=3.0)
    ext = unary_union([affinity.translate(back, depth[0] * t, -depth[1] * t) for t in [i / 6 for i in range(1, 7)]])
    gx0, gy0, gx1, gy1 = unary_union([back, ext]).bounds
    m = margin
    W_, H_ = gx1 - gx0 + 2 * m, gy1 - gy0 + 2 * m
    if square:
        side = max(W_, H_)
        ox, oy = (side - W_) / 2, (side - H_) / 2
        W_, H_ = side, side
    else:
        ox = oy = 0
    H = gy1 + m + oy
    P = lambda g: to_path(g, H)
    vb = f'{gx0 - m - ox:.1f} 0 {W_:.1f} {H_:.1f}'
    parts = [f'<path d="{P(ext)}" fill="{deep}"/>', f'<path d="{P(back)}" fill="{ink}"/>', f'<path d="{P(boxp)}" fill="{red}"/>',
             f'<path d="{P(body1)}" fill="{letter}"/>']
    if dia1: parts.append(f'<path d="{P(unary_union(dia1))}" fill="{letter}"/>')
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}">' + ''.join(parts) + '</svg>'
