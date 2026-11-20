"""Renders the wheel art into public/brand/wheel as WebP.

Usage: THREE_DIR=<three>/build python3 scripts/brand/wheel/render.py [layer ...]
Layers: wheel brake full hero tread track (default: all).
Serves this folder plus three (build/ and examples/jsm/) on a local port, drives render.html in headless Chromium
(WebGL2 through SwiftShader), renders at SIZE px (2048 default) and downsamples with LANCZOS. Everything you see is lit
in 3D; this script only crops, resizes, takes the hero's alpha from its transparent pass, and turns the tread's
height map into the chalk track.

Env: SIZE (render size), HERO_SIZE (default 1.5 x SIZE), OUT_DIR (default public/brand/wheel), RAW_DIR (also keep the raw PNG frames),
PORT (default 8931), P='{"exposure":1.1}' (knobs read by render.html).
"""
import base64, io, json, os, sys, threading, http.server
import numpy as np
from PIL import Image, ImageFilter
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
OUT = os.environ.get('OUT_DIR') or os.path.join(ROOT, 'public', 'brand', 'wheel')
THREE_DIR = os.environ.get('THREE_DIR', '')
JSM_DIR = os.path.join(os.path.dirname(THREE_DIR.rstrip('/')), 'examples', 'jsm')
PORT = int(os.environ.get('PORT', '8931'))
RAW = os.environ.get('RAW_DIR', '')
SIZE = int(os.environ.get('SIZE', '2048'))
HERO_SIZE = int(os.environ.get('HERO_SIZE', str(SIZE * 3 // 2)))  # the beauty shot is supersampled harder
PARAMS = json.loads(os.environ.get('P', '{}'))


class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        p = path.split('?')[0]
        if p.startswith('/three/'):
            return os.path.join(THREE_DIR, p[len('/three/'):])
        if p.startswith('/jsm/'):
            return os.path.join(JSM_DIR, p[len('/jsm/'):])
        return os.path.join(HERE, p.lstrip('/'))

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *a):
        pass


def serve():
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def decode(url):
    return Image.open(io.BytesIO(base64.b64decode(url.split(',')[1])))


def grab(page, name, w=SIZE, h=None):
    url = page.evaluate(f"window.renderLayer('{name}', {w}, {h or w})")
    im = decode(url).convert('RGBA')
    if RAW:
        im.save(os.path.join(RAW, f'{name}.png'))
    return im


def save(im, fname, size, q=82, sharpen=False):
    w, h = (size, size) if isinstance(size, int) else size
    out = no_overshoot(im, im.resize((w, h), Image.LANCZOS))
    if sharpen:
        out = no_overshoot(im, out.filter(ImageFilter.UnsharpMask(radius=0.6, percent=50, threshold=2)))
    path = os.path.join(OUT, fname)
    out.save(path, 'WEBP', quality=q, method=6, alpha_quality=90)
    print(fname, out.size, os.path.getsize(path))
    return out


def no_overshoot(src, out):
    """LANCZOS and sharpening ring past the brightest pixel of the render; keep the result within the render's range."""
    top = np.asarray(src.convert('RGB')).max()
    a = np.asarray(out).copy()
    a[..., :3] = np.minimum(a[..., :3], top)
    return Image.fromarray(a, out.mode)


def save_under(im, fname, size, limit):
    """The best WebP quality that keeps the file under `limit` bytes."""
    for q in range(90, 40, -3):
        out = no_overshoot(im, im.resize((size, size), Image.LANCZOS))
        path = os.path.join(OUT, fname)
        out.save(path, 'WEBP', quality=q, method=6, alpha_quality=85)
        if os.path.getsize(path) <= limit:
            print(fname, out.size, os.path.getsize(path), 'q', q)
            return
    print(fname, 'over budget', os.path.getsize(path))


def hero(page):
    data = json.loads(page.evaluate(f"window.renderLayer('hero', {HERO_SIZE})"))
    im = np.asarray(decode(data['color']).convert('RGBA'), dtype=np.float32) / 255
    ao = np.asarray(decode(data['ao']).convert('L'), dtype=np.float32) / 255
    # occlusion multiplies the light that reaches the surface: apply it in linear light
    k = float(PARAMS.get('aoStrength', 0.9))
    ao = 1 - (1 - ao) * k
    lin = np.where(im[..., :3] <= 0.04045, im[..., :3] / 12.92, ((im[..., :3] + 0.055) / 1.055) ** 2.4) * ao[..., None]
    srgb = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.power(lin, 1 / 2.4) - 0.055)
    out = Image.fromarray((np.dstack([srgb, im[..., 3]]).clip(0, 1) * 255 + 0.5).astype(np.uint8), 'RGBA')
    if RAW:
        decode(data['ao']).save(os.path.join(RAW, 'hero-ao.png'))
        out.save(os.path.join(RAW, 'hero.png'))
    return out


def crop_square(im, margin=0.02):
    box = im.getchannel('A').point(lambda a: 255 if a > 6 else 0).getbbox()
    im = im.crop(box)
    w, h = im.size
    s = int(max(w, h) / (1 - 2 * margin))
    c = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    c.paste(im, ((s - w) // 2, (s - h) // 2))
    return c


def periodic_noise(h, w, scale, rng):
    """Smooth noise that wraps in both directions (FFT low-pass of white noise), 0..1; about `scale` blobs across."""
    n = rng.standard_normal((h, w))
    fy = np.fft.fftfreq(h)[:, None] * h
    fx = np.fft.fftfreq(w)[None, :] * w
    k = np.exp(-((fx / scale) ** 2 + (fy / (scale * h / w)) ** 2))
    s = np.real(np.fft.ifft2(np.fft.fft2(n) * k))
    s = (s - s.min()) / (s.max() - s.min())
    return s.astype(np.float32)


def track(height):
    """The print the tyre leaves: chalk white where the tread touches, worn away in patches, soft, tiling along x."""
    hgt = np.asarray(height.convert('L'), dtype=np.float32) / 255  # 1 = contact, 0 = groove
    h, w = hgt.shape
    rng = np.random.default_rng(19)
    contact = np.clip((hgt - 0.55) / 0.3, 0, 1)
    # blocks press harder in the middle of the tread and fade toward the shoulders
    v = np.linspace(-1, 1, h)[:, None]
    press = np.clip(1.15 - np.abs(v) ** 3 * 0.9, 0, 1)
    coarse = periodic_noise(h, w, 4, rng)
    mid = periodic_noise(h, w, 16, rng)
    grain = periodic_noise(h, w, 140, rng)
    # worn in patches: some stretches print solid, some faintly, a few not at all
    combo = coarse * 0.55 + mid * 0.45
    lo, hi = np.percentile(combo, 8), np.percentile(combo, 80)
    t = np.clip((combo - lo) / (hi - lo), 0, 1)
    wear = 0.18 + 0.82 * t * t * (3 - 2 * t)
    g = np.clip((grain - 0.25) / 0.5, 0, 1)
    m = contact * press * wear * (0.55 + 0.45 * g)
    # soft: blur with wrap-around so the seam stays invisible
    pad = 24
    big = np.concatenate([m[:, -pad:], m, m[:, :pad]], axis=1)
    img = Image.fromarray((np.clip(big, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(h / 340))
    a = np.asarray(img, dtype=np.float32)[:, pad:-pad] / 255
    edge = np.clip(np.minimum(np.linspace(0, 1, h), np.linspace(1, 0, h)) * 14, 0, 1)[:, None]
    alpha = np.clip(a * edge * 1.15, 0, 1) * 235
    rgba = np.dstack([np.full((h, w), 238), np.full((h, w), 236), np.full((h, w), 230), alpha]).astype(np.uint8)
    return Image.fromarray(rgba, 'RGBA')


def main(layers):
    os.makedirs(OUT, exist_ok=True)
    serve()
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        page = b.new_page()
        page.on('console', lambda m: print('[page]', m.text) if m.type in ('error', 'warning') else None)
        page.on('pageerror', lambda e: print('[error]', e))
        page.add_init_script(f'window.P = {json.dumps(PARAMS)};')
        page.goto(f'http://127.0.0.1:{PORT}/render.html')
        page.wait_for_function('window.ready === true', timeout=120000)
        page.set_default_timeout(1800000)
        if 'wheel' in layers:
            im = grab(page, 'wheel'); save(im, 'wheel-512.webp', 512, q=84); save(im, 'wheel-160.webp', 160, q=86, sharpen=True)
        if 'brake' in layers:
            im = grab(page, 'brake'); save(im, 'brake-512.webp', 512, q=80); save(im, 'brake-160.webp', 160, q=84, sharpen=True)
        if 'full' in layers:
            save(grab(page, 'full'), 'wheel-full-320.webp', 320, q=84)
        if 'hero' in layers:
            im = crop_square(hero(page))
            save_under(im, 'hero-1200.webp', 1200, 186_000)
            save_under(im, 'hero-960.webp', 960, 130_000)
        if 'tread' in layers:
            im = grab(page, 'tread', SIZE, SIZE // 2)
            save(im.convert('RGB'), 'tread-512.webp', (512, 256), q=80)
        if 'track' in layers:
            im = grab(page, 'height', 2048, 1024)
            t = track(im)
            out = t.resize((512, 256), Image.LANCZOS)
            path = os.path.join(OUT, 'track-512.webp')
            out.save(path, 'WEBP', quality=80, method=6, alpha_quality=85)
            print('track-512.webp', os.path.getsize(path))
        b.close()


if __name__ == '__main__':
    main(sys.argv[1:] or ['wheel', 'brake', 'full', 'hero', 'tread', 'track'])
