"""Renders the wheel layers into public/brand/wheel as transparent WebP.

Usage: THREE_DIR=<dir holding three.module.js> python3 scripts/brand/wheel/render.py [layer ...]
Serves this folder plus three on a local port, drives render.html in headless Chromium,
renders at 2048px and downsamples with LANCZOS.
"""
import base64, io, os, sys, threading, functools, http.server
import numpy as np
from PIL import Image, ImageFilter
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
OUT = os.path.join(ROOT, 'public', 'brand', 'wheel')
THREE_DIR = os.environ.get('THREE_DIR', '')
PORT = int(os.environ.get('PORT', '8931'))
RAW = os.environ.get('RAW_DIR', '')


class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        p = path.split('?')[0]
        if p.startswith('/three/'):
            return os.path.join(THREE_DIR, p[len('/three/'):])
        return os.path.join(HERE, p.lstrip('/'))

    def log_message(self, *a):
        pass


def serve():
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def grab(page, name, size=2048):
    url = page.evaluate(f"window.renderLayer('{name}', {size})")
    im = Image.open(io.BytesIO(base64.b64decode(url.split(',')[1]))).convert('RGBA')
    if RAW:
        im.save(os.path.join(RAW, f'{name}.png'))
    return im


def save(im, fname, size, q=82):
    w, h = (size, size) if isinstance(size, int) else size
    im.resize((w, h), Image.LANCZOS).save(os.path.join(OUT, fname), 'WEBP', quality=q, method=6, alpha_quality=90)


def crop_square(im, margin=0.03):
    box = im.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
    im = im.crop(box)
    w, h = im.size
    s = int(max(w, h) / (1 - 2 * margin))
    c = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    c.paste(im, ((s - w) // 2, (s - h) // 2))
    return c


def track(contact):
    """A tyre-track print: the contact patch in chalk white, eroded with noise, soft edges, tiling along x."""
    a = np.asarray(contact.convert('L'), dtype=np.float32) / 255.0
    h, w = a.shape
    rng = np.random.default_rng(7)
    noise = rng.random((h // 8, w // 8)).astype(np.float32)
    n = np.asarray(Image.fromarray((noise * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC), dtype=np.float32) / 255
    fine = rng.random((h, w)).astype(np.float32)
    m = a * (0.35 + 0.65 * n) * (0.55 + 0.45 * fine)
    m = np.where(m > 0.33, m, 0) * 1.3
    img = Image.fromarray(np.clip(m * 220, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.6))
    # fade the two long edges
    edge = np.minimum(np.linspace(0, 1, h) * 8, np.linspace(1, 0, h) * 8).clip(0, 1)[:, None]
    alpha = (np.asarray(img, dtype=np.float32) * edge).astype(np.uint8)
    rgba = np.dstack([np.full((h, w), 240, np.uint8), np.full((h, w), 240, np.uint8), np.full((h, w), 236, np.uint8), alpha])
    return Image.fromarray(rgba, 'RGBA')


def main(layers):
    os.makedirs(OUT, exist_ok=True)
    serve()
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        page = b.new_page()
        page.on('console', lambda m: print('[page]', m.text))
        page.on('pageerror', lambda e: print('[error]', e))
        page.goto(f'http://127.0.0.1:{PORT}/render.html')
        page.wait_for_function('window.ready === true', timeout=60000)
        page.set_default_timeout(600000)
        if 'wheel' in layers:
            im = grab(page, 'wheel'); save(im, 'wheel-512.webp', 512); save(im, 'wheel-160.webp', 160)
        if 'brake' in layers:
            im = grab(page, 'brake'); save(im, 'brake-512.webp', 512); save(im, 'brake-160.webp', 160)
        if 'full' in layers:
            save(grab(page, 'full'), 'wheel-full-320.webp', 320)
        if 'hero' in layers:
            save(crop_square(grab(page, 'hero')), 'hero-960.webp', 960, q=80)
        if 'tread' in layers:
            im = grab(page, 'tread', 2048)  # 8 pitches across, tiles along x; the square render is squashed back to 2:1
            save(im, 'tread-512.webp', (512, 256), q=78)
        if 'track' in layers:
            im = grab(page, 'contact', 2048)
            track(im.resize((1024, 512), Image.LANCZOS)).resize((512, 256), Image.LANCZOS).save(
                os.path.join(OUT, 'track-512.webp'), 'WEBP', quality=80, method=6)
        b.close()


if __name__ == '__main__':
    main(sys.argv[1:] or ['wheel', 'brake', 'full', 'hero', 'tread', 'track'])
