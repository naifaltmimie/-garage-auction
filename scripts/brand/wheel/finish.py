"""Finish the rendered wheel layers: shade the machined spoke faces, back the brake, and build the stills.

The turning layers are lit symmetrically around the axis, so a flat spoke face comes out one flat grey.
A real concave diamond-cut face reflects the room in bands along its length; that falloff depends only on the
distance from the hub, so it can be laid on here without breaking the rotation (the image still looks the same
at every angle).

usage: python3 scripts/brand/wheel/finish.py WHEEL.png BRAKE.png   (the raw frames from render.py, RAW_DIR)
writes public/brand/wheel/{wheel-512,wheel-160,brake-512,brake-160,wheel-full-320,hero-960}.webp
"""
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get('WHEEL_OUT') or os.path.abspath(os.path.join(HERE, '..', '..', '..', 'public', 'brand', 'wheel'))

MARGIN = 0.03  # render.py frames the tyre with a 3% margin


def polar(n):
    y, x = np.mgrid[0:n, 0:n].astype(np.float32)
    c = (n - 1) / 2
    R = n / 2 * (1 - 2 * MARGIN)  # the tyre's outer radius in px
    dx, dy = (x - c) / R, (y - c) / R
    return np.hypot(dx, dy), dx, dy


def shade_wheel(im):
    """Bands of light along the spokes and a lift on the rubber's raised detail."""
    a = np.asarray(im, dtype=np.float32) / 255
    n = a.shape[0]
    r, _, _ = polar(n)
    rgb, alpha = a[..., :3], a[..., 3:]
    lum = rgb.mean(axis=2)

    # the machined faces: bright pixels inside the rim
    face = np.clip((lum - 0.42) / 0.2, 0, 1) * (r < 0.692)
    # a concave face seen head on: bright by the lip, a dark run, a bright band, dark into the hub
    band = 0.60 + 0.34 * np.cos(2 * np.pi * (r - 0.375) / 0.31)
    band = np.where(r < 0.22, 0.42 + (r / 0.22) * 0.2, band)
    cool = np.array([0.95, 0.975, 1.02], dtype=np.float32)
    shaded = rgb * band[..., None] * cool
    rgb = rgb * (1 - face[..., None]) + shaded * face[..., None]

    # the polished lip keeps one crisp ring of light
    lip = np.exp(-((r - 0.7) / 0.006) ** 2) * (lum > 0.3)
    rgb = np.clip(rgb + lip[..., None] * 0.18, 0, 1)

    # rubber: lift the mid-tones so ribs, letters and shoulder blocks read on a dark page
    tyre = (r > 0.715).astype(np.float32)
    lifted = np.clip(0.035 + rgb * 1.28, 0, 1) ** 0.92
    rgb = rgb * (1 - tyre[..., None]) + lifted * tyre[..., None]
    # the centre cap: the tag's red in a thin alloy ring
    cap = np.clip((0.058 - r) / 0.004, 0, 1)
    ring = np.clip((0.074 - r) / 0.004, 0, 1) - cap
    red = np.array([0.90, 0.15, 0.18], dtype=np.float32) * (1.08 - 0.5 * np.clip(r / 0.058, 0, 1) ** 2)[..., None]
    alloy = np.array([0.80, 0.82, 0.86], dtype=np.float32)
    rgb = rgb * (1 - ring[..., None]) + alloy * ring[..., None]
    rgb = rgb * (1 - cap[..., None]) + red * cap[..., None]
    alpha = np.maximum(alpha, (cap + ring)[..., None])
    return Image.fromarray((np.dstack([np.clip(rgb, 0, 1), alpha[..., 0]]) * 255).astype(np.uint8), 'RGBA')


def paint_caliper(im):
    """The caliper is painted and glossy: the tag's red, lighter along its outer edge, a deep red at the disc."""
    a = np.asarray(im, dtype=np.float32) / 255
    n = a.shape[0]
    r, _, _ = polar(n)
    rgb = a[..., :3]
    redness = np.clip((rgb[..., 0] - np.maximum(rgb[..., 1], rgb[..., 2]) - 0.12) / 0.2, 0, 1)
    t = np.clip((r - 0.38) / 0.22, 0, 1)
    base = np.array([0.898, 0.149, 0.176], dtype=np.float32)
    paint = base[None, None, :] * (0.62 + 0.5 * t)[..., None]
    gloss = np.exp(-((r - 0.565) / 0.018) ** 2) * 0.34
    paint = np.clip(paint + gloss[..., None], 0, 1)
    rgb = rgb * (1 - redness[..., None]) + paint * redness[..., None]
    return Image.fromarray((np.dstack([np.clip(rgb, 0, 1), a[..., 3]]) * 255).astype(np.uint8), 'RGBA')


def back_brake(im):
    """Nothing of the page shows through the wheel: the well behind the disc is dark."""
    n = im.size[0]
    r, _, _ = polar(n)
    well = np.zeros((n, n, 4), dtype=np.float32)
    inside = np.clip((0.66 - r) / 0.004, 0, 1)
    shade = 0.03 + 0.035 * np.clip(r / 0.66, 0, 1)  # a touch lighter toward the barrel
    well[..., 0] = shade
    well[..., 1] = shade
    well[..., 2] = shade * 1.08
    well[..., 3] = inside
    base = Image.fromarray((well * 255).astype(np.uint8), 'RGBA')
    base.alpha_composite(im)
    return base


def light(n, key=(-0.35, -0.75), strength=0.5):
    """A fixed studio light for the stills: a soft key from above and a shade below, inside the wheel only."""
    r, dx, dy = polar(n)
    kx, ky = key
    d = np.hypot(dx - kx, dy - ky)
    hi = np.clip(1 - d / 1.25, 0, 1) ** 2 * strength
    lo = np.clip((dy * 0.9 - dx * kx) * 0.5 + 0.15, 0, 1) * strength * 0.9
    inside = np.clip((1.0 - r) / 0.01, 0, 1)
    return hi * inside, lo * inside


def still(wheel, brake, turn=18.0, strength=0.5):
    n = wheel.size[0]
    comp = brake.copy()
    comp.alpha_composite(wheel.rotate(turn, resample=Image.BICUBIC))
    a = np.asarray(comp, dtype=np.float32) / 255
    hi, lo = light(n, strength=strength)
    rgb = a[..., :3]
    rgb = rgb + (1 - rgb) * hi[..., None] * (0.25 + 0.75 * rgb)  # screen, weighted so black rubber stays black
    rgb = rgb * (1 - lo[..., None] * 0.75)
    return Image.fromarray((np.dstack([np.clip(rgb, 0, 1), a[..., 3]]) * 255).astype(np.uint8), 'RGBA')


def save(im, name, size, q=84):
    out = im.resize((size, size), Image.LANCZOS)
    if size <= 320:
        out = out.filter(ImageFilter.UnsharpMask(radius=0.6, percent=60, threshold=2))
    out.save(os.path.join(OUT, name), 'WEBP', quality=q, method=6, alpha_quality=92)
    print(name, os.path.getsize(os.path.join(OUT, name)))


def main(wheel_path, brake_path):
    wheel = shade_wheel(Image.open(wheel_path).convert('RGBA'))
    brake = back_brake(paint_caliper(Image.open(brake_path).convert('RGBA')))
    save(wheel, 'wheel-512.webp', 512)
    save(wheel, 'wheel-160.webp', 160)
    save(brake, 'brake-512.webp', 512)
    save(brake, 'brake-160.webp', 160)
    save(still(wheel, brake), 'wheel-full-320.webp', 320)
    save(still(wheel, brake, turn=-12.0, strength=0.62), 'hero-960.webp', 960, q=82)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
