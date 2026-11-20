"""Brushed alloy: one tileable grain of fine horizontal brushing, white and black strokes on alpha,
laid over --alloy-face so the metal's tone shows through. Writes public/brand/kit/alloy-brush.webp.

usage: python3 scripts/brand/alloy/brush.py [OUT]
The tile is drawn at twice its CSS size (W x H pixels shown at W/2 x H/2), and wraps on both axes:
every stroke is a sum of periodic noise, so no seam shows where tiles meet."""
import sys

import numpy as np
from PIL import Image

W, H = 512, 96           # pixels; shown at 256 x 48 CSS px
SEED = 20261121
rng = np.random.default_rng(SEED)


def periodic_blur_x(a, sigma):
    """Gaussian blur along x by FFT, so the result wraps around the tile."""
    f = np.fft.rfft(a, axis=1)
    k = np.fft.rfftfreq(a.shape[1])
    return np.fft.irfft(f * np.exp(-2 * (np.pi * k * sigma) ** 2), n=a.shape[1], axis=1)


def periodic_blur_y(a, sigma):
    f = np.fft.rfft(a, axis=0)
    k = np.fft.rfftfreq(a.shape[0])[:, None]
    return np.fft.irfft(f * np.exp(-2 * (np.pi * k * sigma) ** 2), n=a.shape[0], axis=0)


def norm(a):
    a = a - a.mean()
    return a / (np.abs(a).max() + 1e-9)


# long strokes: per-pixel noise smeared far along x, barely across y
long_ = norm(periodic_blur_y(periodic_blur_x(rng.standard_normal((H, W)), 60), 0.45))
# finer, shorter strokes that break the long ones up
short = norm(periodic_blur_y(periodic_blur_x(rng.standard_normal((H, W)), 14), 0.35))
# a few brighter scratches: sparse rows lifted along part of their length
scratch = np.zeros((H, W))
for _ in range(10):
    y = rng.integers(0, H)
    x0 = rng.integers(0, W)
    ln = rng.integers(W // 6, W // 2)
    xs = (np.arange(ln) + x0) % W
    env = np.sin(np.linspace(0, np.pi, ln)) ** 2
    scratch[y, xs] += env
scratch = norm(periodic_blur_x(scratch, 3)) * 0.8

v = 0.6 * long_ + 0.35 * short + 0.25 * scratch
v = np.clip(v / np.abs(v).max(), -1, 1)

# white where the metal catches the light, black where the groove holds shadow; alpha carries the strength
ALPHA = 0.27
rgb = np.where(v > 0, 255, 0).astype(np.uint8)
a = (np.abs(v) ** 1.15 * ALPHA * 255).astype(np.uint8)
img = np.dstack([rgb, rgb, rgb, a])
out = sys.argv[1] if len(sys.argv) > 1 else 'public/brand/kit/alloy-brush.webp'
Image.fromarray(img, 'RGBA').save(out, 'WEBP', quality=60, method=6, alpha_quality=50)
print(out)
