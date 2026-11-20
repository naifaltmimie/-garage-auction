"""UX atlas: drives a host, players and a big screen through whole nights and screenshots every surface.

usage:
  python3 scripts/qa/atlas.py OUT_ROOT BASE_URL PHOTOS_DIR [MODE] [--no-shots]

  main         host + two players + a late spectator + the big screen, one whole night, at 390x844 (OUT_ROOT/390, OUT_ROOT/tv)
  small        a short night at 360x740 and again at 320x640 (OUT_ROOT/360, OUT_ROOT/320)
  small:W,W..  the same short night at the widths given, e.g. small:390,360 (heights: 390 844, 360 740, 320 640, else 800)
  stress       three 20-character names, a 7-digit budget and bid, a full garage, at 390x844 (OUT_ROOT/stress)
  measure      touch-target sizes and text contrast on the main screens (OUT_ROOT/measure/measure.json)
  sheets       one contact sheet per folder (OUT_ROOT/<folder>/_contact.png)

  --no-shots   walk the same states and run every check, but save no screenshots (a fast re-run of the audit)

At every shot the page is also checked, and the results go to OUT_ROOT/<folder>/_report.md (and _report.json):
  - the clipped-ink audit (scripts/qa/ink_audit.js): every on-screen text line whose glyphs are cut by a clipping box
  - horizontal overflow: documentElement.scrollWidth wider than the viewport
  - page errors and console errors that page logged since its previous check
A full-page shot runs the ink audit at each screen height down the page.

  --compare-css=FILE  a layout check for a fix that must move nothing: at each shot every element is measured, then
               measured again with FILE's rules added (FILE undoes the fix), and any element whose box moved is
               reported ('layout' in the report). An element whose own padding FILE changes may change height only.
               When FILE changes anything on the page, a second screenshot, NNN-name~without.png, shows it undone.

BASE_URL is the app with its broker, e.g. http://localhost:5226/?brokers=ws://localhost:8916&bridge=0
PHOTOS_DIR holds ph_portrait.jpg and ph_land.jpg, served in place of the ad photos.
Every page context stubs the photo hosts and marks the news as seen, so no overlay covers the page.
What a run could not reach is written to OUT_ROOT/<folder>/_missed.txt.
"""
import asyncio
import json
import os
import re
import sys
import time

from playwright.async_api import async_playwright

ARGS = [x for x in sys.argv[1:] if not x.startswith('--')]
FLAGS = {x for x in sys.argv[1:] if x.startswith('--')}
OUT_ROOT = ARGS[0]
BASE = ARGS[1] if len(ARGS) > 1 else ''
PHOTOS = ARGS[2] if len(ARGS) > 2 else ''
MODE = ARGS[3] if len(ARGS) > 3 else 'main'
SAVE_SHOTS = '--no-shots' not in FLAGS
COMPARE_CSS = next((open(x.split('=', 1)[1], encoding='utf-8').read() for x in FLAGS if x.startswith('--compare-css=')), None)
INK_JS = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ink_audit.js'), encoding='utf-8').read()
HEIGHTS = {390: 844, 360: 740, 320: 640}

# errors each page logged since its last check, keyed by id(page)
ERRS = {}

CHECK_JS = """(full) => {
  const out = { sw: document.documentElement.scrollWidth, iw: innerWidth, ink: [] };
  if (typeof window.auditInk !== 'function') return out;
  const seen = new Set();
  const add = (list) => { for (const f of list) { const k = f.el + '|' + f.clip + '|' + f.cut; if (!seen.has(k)) { seen.add(k); out.ink.push(f); } } };
  if (!full) { add(window.auditInk()); return out; }
  const y0 = scrollY, max = document.documentElement.scrollHeight;
  for (let y = 0; y < max; y += innerHeight * 0.8) { window.scrollTo(0, y); add(window.auditInk()); }
  window.scrollTo(0, y0);
  return out;
}"""


RECTS_JS = """() => [...document.querySelectorAll('body *')].map((e) => {
  const r = e.getBoundingClientRect(); const s = getComputedStyle(e);
  return [Math.round(r.left * 4) / 4, Math.round(r.top * 4) / 4, Math.round(r.width * 4) / 4, Math.round(r.height * 4) / 4, s.paddingTop + ' ' + s.paddingBottom];
})"""

COMPARE_JS = """(css) => {
  const st = document.createElement('style'); st.id = 'qa-compare'; st.textContent = css; document.head.appendChild(st);
  document.body.offsetHeight; return true;
}"""

PATH_JS = """(i) => { const e = document.querySelectorAll('body *')[i]; const out = [];
  for (let n = e, k = 0; n && n.nodeType === 1 && k < 4; n = n.parentElement, k++) {
    const c = typeof n.className === 'string' ? n.className.trim().split(/\\s+/).filter(Boolean).slice(0, 2).join('.') : '';
    out.unshift(n.tagName.toLowerCase() + (c ? '.' + c : '')); }
  return out.join(' > '); }"""


async def layout_moves(pg):
    """Elements whose box moves when COMPARE_CSS is added: [(path, before, after)], and whether the CSS touched the page."""
    a1 = await pg.evaluate(RECTS_JS)
    await pg.evaluate(COMPARE_JS, COMPARE_CSS)
    b = await pg.evaluate(RECTS_JS)
    await pg.evaluate("() => { const s = document.getElementById('qa-compare'); if (s) s.remove(); document.body.offsetHeight }")
    a2 = await pg.evaluate(RECTS_JS)
    await pg.evaluate(COMPARE_JS, COMPARE_CSS)
    b2 = await pg.evaluate(RECTS_JS)
    await pg.evaluate("() => { const s = document.getElementById('qa-compare'); if (s) s.remove(); document.body.offsetHeight }")
    touched = False
    moved = []
    if not (len(a1) == len(b) == len(a2) == len(b2)):
        return [], False  # the page changed while it was measured (a reveal landing): nothing to compare
    for i, (x, y, z, w) in enumerate(zip(a1, b, a2, b2)):
        if x != z or y != w:
            continue  # moving on its own (an animation): not ours to judge
        own = x[4] != y[4]
        touched = touched or own
        # the fixed element itself may grow into its padding; its inline position and width stay, and so does every other box
        # (half a pixel of slack on the fixed element: on a rotated tag its bounding box widens with its height)
        if (own and (abs(x[0] - y[0]) > 0.5 or abs(x[2] - y[2]) > 0.5)) or (not own and x[:4] != y[:4]):
            moved.append((i, x[:4], y[:4]))
    out = []
    for i, x, y in moved[:6]:
        out.append((await pg.evaluate(PATH_JS, i), x, y))
    if len(moved) > 6:
        out.append((f'... and {len(moved) - 6} more', None, None))
    return out, touched


class Atlas:
    """Numbered screenshots in one folder, the checks run at each, and a log of what could not be reached."""

    def __init__(self, folder):
        self.folder = folder
        self.dir = os.path.join(OUT_ROOT, folder)
        os.makedirs(self.dir, exist_ok=True)
        self.n = 0
        self.seen = set()
        self.missed = []
        self.log = []
        self.checks = []

    def say(self, *a):
        s = ' '.join(str(x) for x in a)
        self.log.append(s)
        print(f'[{self.folder}] {s}', flush=True)

    async def check(self, pg, name, full=False):
        row = {'state': name, 'overflow': None, 'errors': [], 'ink': []}
        try:
            # the audit is injected at every navigation by the init script; a page opened before it still gets it here
            if not await pg.evaluate("() => typeof window.auditInk === 'function'"):
                await pg.add_script_tag(content=INK_JS)
            await pg.evaluate('() => document.fonts.ready.then(() => 1)')
            r = await pg.evaluate(CHECK_JS, full)
            if r['sw'] > r['iw']:
                row['overflow'] = f"{r['sw']} > {r['iw']}"
            row['ink'] = r['ink']
            if COMPARE_CSS:
                moves, row['touched'] = await layout_moves(pg)
                row['layout'] = [f'{p_}: {x} -> {y}' for p_, x, y in moves]
        except Exception as ex:  # noqa: BLE001
            row['errors'].append(f'check failed: {ex}'[:200])
        errs = ERRS.pop(id(pg), [])
        row['errors'] += [e if errs.count(e) == 1 else f'{e} (x{errs.count(e)})' for e in dict.fromkeys(errs)]
        self.checks.append(row)
        for f in row['ink']:
            self.say(f"INK {name}: {f['cut']} {f['px']}px «{f['text']}» {f['el']} | clip {f['clip']}")
        if row['overflow']:
            self.say(f'OVERFLOW {name}: {row["overflow"]}')
        for e in row['errors']:
            self.say(f'ERROR {name}: {e}')
        for m in row.get('layout', []):
            self.say(f'LAYOUT {name}: {m}')
        return row

    async def shot(self, pg, name, full=False, once=True):
        if once and name in self.seen:
            return
        self.seen.add(name)
        self.n += 1
        row = await self.check(pg, name, full)
        if not SAVE_SHOTS:
            return
        path = os.path.join(self.dir, f'{self.n:03d}-{name}.png')
        try:
            await pg.screenshot(path=path, full_page=full)
            if row.get('touched'):
                await pg.evaluate(COMPARE_JS, COMPARE_CSS)
                await pg.screenshot(path=path[:-4] + '~without.png', full_page=full)
                await pg.evaluate("() => { const s = document.getElementById('qa-compare'); if (s) s.remove() }")
        except Exception as ex:  # noqa: BLE001
            self.say('shot failed', name, ex)

    def miss(self, what, why):
        self.missed.append(f'{what}: {why}')
        self.say('MISSED', what, str(why).split('\n')[0][:160])

    def close(self):
        with open(os.path.join(self.dir, '_missed.txt'), 'w') as f:
            f.write('\n'.join(self.missed) + '\n')
        with open(os.path.join(self.dir, '_log.txt'), 'w') as f:
            f.write('\n'.join(self.log) + '\n')
        with open(os.path.join(self.dir, '_report.json'), 'w') as f:
            json.dump(self.checks, f, ensure_ascii=False, indent=1)
        ink = [(c['state'], f) for c in self.checks for f in c['ink']]
        bad = [c for c in self.checks if c['overflow'] or c['errors'] or c.get('layout')]
        esc = lambda s: str(s).replace('|', '\\|')  # noqa: E731
        lines = [f'# Atlas report: {self.folder}', '',
                 f'{len(self.checks)} states checked · {len(ink)} clipped lines · '
                 f'{sum(1 for c in self.checks if c["overflow"])} with horizontal overflow · '
                 f'{sum(1 for c in self.checks if c["errors"])} with errors · {len(self.missed)} missed', '',
                 '## Clipped ink', '']
        if ink:
            lines += ['| state | text | cut | px | element | clip |', '|---|---|---|---|---|---|']
            lines += [f"| {esc(s)} | {esc(f['text'])} | {f['cut']} | {f['px']} | `{esc(f['el'])}` | `{esc(f['clip'])}` |" for s, f in ink]
        else:
            lines.append('None.')
        lines += ['', '## Overflow, errors' + (', layout moves (--compare-css)' if COMPARE_CSS else ''), '']
        if bad:
            lines += ['| state | overflow | errors | layout |', '|---|---|---|---|']
            lines += [f"| {esc(c['state'])} | {c['overflow'] or ''} | {esc('<br>'.join(e[:160] for e in c['errors']))} | "
                      f"{esc('<br>'.join(c.get('layout', [])))} |" for c in bad]
        else:
            lines.append('None.')
        if self.missed:
            lines += ['', '## Missed', ''] + [f'- {m}' for m in self.missed]
        with open(os.path.join(self.dir, '_report.md'), 'w') as f:
            f.write('\n'.join(lines) + '\n')
        print(f'[{self.folder}] report: {len(self.checks)} states, {len(ink)} ink, {len(bad)} overflow/error, {len(self.missed)} missed', flush=True)


async def wait(s):
    await asyncio.sleep(s)


async def new_page(browser, a, name, w, h, mobile=True, dsf=2, news_seen=True):
    ctx = await browser.new_context(viewport={'width': w, 'height': h}, device_scale_factor=dsf,
                                    is_mobile=mobile, has_touch=mobile, locale='ar-SA')
    ph = {'p': open(os.path.join(PHOTOS, 'ph_portrait.jpg'), 'rb').read(),
          'l': open(os.path.join(PHOTOS, 'ph_land.jpg'), 'rb').read()}
    cnt = {'n': 0}

    async def fake(route):
        cnt['n'] += 1
        await route.fulfill(status=200, content_type='image/jpeg', body=ph['p' if cnt['n'] % 3 else 'l'])

    await ctx.route('**/*haraj*/**', fake)
    await ctx.route('**/api/img**', fake)
    if news_seen:
        await ctx.add_init_script("try{localStorage.setItem('mzk:news',JSON.stringify('2099-12-31'))}catch(e){}")
    await ctx.add_init_script(INK_JS)
    pg = await ctx.new_page()
    key = id(pg)

    def err(text):
        ERRS.setdefault(key, []).append(text)

    pg.on('pageerror', lambda e: err(f'pageerror: {e}'.split('\n')[0][:300]))
    pg.on('console', lambda m: err(f'console: {m.text}'[:300]) if m.type == 'error' else None)
    return ctx, pg


async def phase(pg):
    try:
        return await pg.evaluate("() => [document.documentElement.dataset.phase || '', +(document.documentElement.dataset.lot || 0)]")
    except Exception:  # noqa: BLE001
        return ['?', 0]


# the kind of the car on the block, read from the console and the car sheet's sale facts
KIND_JS = """() => {
  if (document.querySelector('.dutch-panel')) return 'dutch';
  if (document.documentElement.dataset.phase === 'sealed' || document.querySelector('.cs--sealed, .cs-env')) return 'sealed';
  const f = [...document.querySelectorAll('.sh-facts, .cs-facts')].map(e => e.textContent).join(' ');
  if (f.includes('هولندي')) return 'dutch';
  if (f.includes('ظرف مختوم')) return 'sealed';
  if (document.querySelector('.sh-photo.is-covered')) return 'covered';
  return 'open';
}"""


async def kind(pg):
    try:
        return await pg.evaluate(KIND_JS)
    except Exception:  # noqa: BLE001
        return '?'


async def tap(pg, name, timeout=1500, nth=0, exact=False):
    try:
        await pg.get_by_role('button', name=name, exact=exact).nth(nth).click(timeout=timeout)
        return True
    except Exception:  # noqa: BLE001
        return False


async def need(a, pg, name, timeout=1500, nth=0, exact=False):
    """A tap the walk depends on: a miss is logged when the button is not there."""
    if await tap(pg, name, timeout, nth, exact):
        return True
    a.miss(f'button «{name}»', 'not found or not clickable')
    return False


async def click(pg, sel, timeout=1500):
    try:
        await pg.locator(sel).first.click(timeout=timeout)
        return True
    except Exception:  # noqa: BLE001
        return False


async def bid_min(pg):
    return await click(pg, 'section.cs button.bid-main:not(:disabled)', 900)


async def type_amount(pg, amount):
    """Types an amount on the free-bid keypad, one key at a time."""
    for ch in str(amount):
        await pg.locator(f'.cs-k12[aria-label="{ch}"]').click(timeout=1500)


async def free_bid(pg, amount):
    """Opens the free-bid keypad, types the amount and sends it (an extreme amount asks a second time)."""
    if not await click(pg, '.cs-key.is-free:not(:disabled)', 900):
        return False
    try:
        await type_amount(pg, amount)
    except Exception:  # noqa: BLE001
        return False  # the lot closed under the keypad
    if not await click(pg, '.cs-pad .bid-main:not(:disabled)', 900):
        return False
    await wait(0.25)
    await click(pg, '.cs-pad .bid-main.is-ask:not(:disabled)', 500)
    return True


async def over_reserve(pg):
    """An amount past the top of the estimate in the console's fact line (past any reserve), or 600,000."""
    try:
        t = await pg.locator('.cs-facts').first.inner_text()
        hi = max(int(x.replace(',', '')) for x in re.findall(r'\d[\d,]{4,}', t.split('التقدير')[-1].split('·')[0]))
        return (hi * 11 // 10 // 5000 + 1) * 5000
    except Exception:  # noqa: BLE001
        return 600_000


async def until(pg, want_phase, lot=None, limit=60):
    t0 = time.time()
    while time.time() - t0 < limit:
        ph, n = await phase(pg)
        if (ph in want_phase if isinstance(want_phase, (list, tuple, set)) else ph == want_phase) and (lot is None or n == lot):
            return ph, n
        await wait(0.2)
    return None


async def until_sel(pg, sel, limit=15):
    t0 = time.time()
    while time.time() - t0 < limit:
        try:
            if await pg.locator(sel).count():
                return True
        except Exception:  # noqa: BLE001
            pass
        await wait(0.15)
    return False


async def hot(pg, limit=25):
    t0 = time.time()
    while time.time() - t0 < limit:
        if await pg.locator('.cs-ring.hot').count():
            return True
        ph, _ = await phase(pg)
        if ph != 'bidding':
            return False
        await wait(0.15)
    return False


async def garage_full(pg):
    try:
        loc = pg.locator('section.cs[data-cs="calm"]')
        return await loc.count() > 0 and 'كراجك فل' in await loc.first.inner_text()
    except Exception:  # noqa: BLE001
        return False


async def sheet_tabs(a, pg, prefix):
    """The car sheet: each of its four tabs, at its top and with the page scrolled to its end."""
    for label in ['الفحص', 'السجلات', 'كلام المعلن', 'المواصفات']:
        try:
            await pg.get_by_role('tab', name=label).first.click(timeout=1500)
            await wait(0.35)
            await pg.evaluate("() => { const t = document.querySelector('.sh-tabbar'); if (t) window.scrollTo(0, window.scrollY + t.getBoundingClientRect().top - 120) }")
            await wait(0.3)
            await a.shot(pg, f'{prefix}-tab-{label.replace(" ", "_")}-top')
            await pg.evaluate('() => window.scrollTo(0, document.documentElement.scrollHeight)')
            await wait(0.35)
            await a.shot(pg, f'{prefix}-tab-{label.replace(" ", "_")}-end')
        except Exception as ex:  # noqa: BLE001
            a.miss(f'car sheet tab {label}', ex)
    await pg.evaluate('() => window.scrollTo(0, 0)')


async def create_room(a, host, name, *, garage='3 سيارات', speed='سريع', budget=None, shots=True):
    await host.goto(BASE + '#/new')
    await host.wait_for_selector('input[autocomplete="nickname"]')
    await wait(1.0)
    await host.fill('input[autocomplete="nickname"]', '')
    if shots:
        await a.shot(host, 'create-top')
        # the tap on «افتح الصالة» with no name: what the form says
        await need(a, host, 'افتح الصالة')
        await wait(0.4)
        await a.shot(host, 'create-error-no-name')
    await host.fill('input[autocomplete="nickname"]', name)
    if not await click(host, '.lby-more-btn'):
        a.miss('create details', 'no «تفاصيل المزاد» toggle')
    await wait(0.3)
    if garage:
        await need(a, host, garage, exact=True)
    if speed:
        await need(a, host, speed, exact=True)
    if budget:
        await host.locator('.sf-custom input').fill(str(budget))
    if shots:
        for i, frac in enumerate([0.33, 0.66, 1.0]):
            await host.evaluate(f'() => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * {frac})')
            await wait(0.3)
            await a.shot(host, f'create-scroll-{i + 1}')
        await a.shot(host, 'create-full', full=True)
    await need(a, host, 'افتح الصالة')
    await host.wait_for_selector('.codebox .code', timeout=40000)
    return (await host.inner_text('.codebox .code')).strip().replace(' ', '')


async def join(browser, a, code, name, w, h, shots_prefix=None):
    ctx, pg = await new_page(browser, a, name, w, h)
    await pg.goto(f'{BASE}#/r/{code}')
    await pg.wait_for_selector('input[autocomplete="nickname"]')
    await wait(0.6)
    if shots_prefix:
        await pg.fill('input[autocomplete="nickname"]', '')
        await a.shot(pg, f'{shots_prefix}-empty')
    await pg.fill('input[autocomplete="nickname"]', name)
    if shots_prefix:
        await a.shot(pg, f'{shots_prefix}-typed')
    await need(a, pg, 'ادخل الصالة')
    return ctx, pg


async def wait_players(host, n, limit=30):
    t0 = time.time()
    while time.time() - t0 < limit:
        if await host.locator('.lby-p').count() >= n:
            return True
        await wait(0.4)
    return False


async def open_menu(a, pg):
    if await need(a, pg, 'قائمة الصالة', exact=True):
        await wait(0.45)
        return True
    return False


async def end_now(a, host):
    """The host ends the night from the room menu, with its confirm."""
    if await open_menu(a, host):
        await need(a, host, 'خلّص المزاد للكل')
        await wait(0.3)
        await need(a, host, 'إيه، خلّصه', exact=True)


async def wait_stage(pg, stage, limit=12):
    """Waits until a sold reveal shows its stage: 2 when the receipt or paid line prints, 1 when the value is named."""
    sel = {1: '.srv-verdict-k.is-on', 2: '.srv-paid, .srv-rcpt, .srv-comps'}[stage]
    return await until_sel(pg, sel, limit)


async def end_night(a, host, pages, tv=None, prefix=''):
    """Showcase, voting (untouched / partly / sent), results, ceremony, poster."""
    sa = pages[0]
    if not await until(host, ['showcase', 'voting', 'results'], limit=120):
        a.miss('showcase', 'host never left the auction')
        return
    await wait(1.5)
    await a.shot(host, f'{prefix}showcase-host')
    await a.shot(host, f'{prefix}showcase-host-full', full=True)
    await a.shot(sa, f'{prefix}showcase-player')
    if not await tap(host, 'ابدأ التقييم السري', 4000):
        await need(a, host, 'اعرض النتيجة', 3000)
    await wait(2.0)
    if tv:
        await a_tv(tv, 'voting')
    voters = [host] + [p for i, p in enumerate(pages[:2]) if p not in pages[:i]]
    for pg in voters:
        first = pg is sa
        # a phone can still be drawing the showcase: wait for its voting screen
        await until_sel(pg, '.e-voting:not(.is-wait), .e-voting.is-wait', 10)
        await wait(0.3)
        if first:
            await a.shot(pg, f'{prefix}voting-untouched')
            await a.shot(pg, f'{prefix}voting-untouched-full', full=True)
        for i in range(8):
            rate = pg.locator('.rate button')
            if await rate.count() == 0:
                # nobody else bought a car: nothing to rate, the send button alone
                if first:
                    await a.shot(pg, f'{prefix}voting-nothing-to-rate')
                if not await need(a, pg, 'أرسل التقييم'):
                    await a.shot(pg, f'{prefix}voting-no-send-{voters.index(pg)}')
                await wait(0.6)
                break
            await rate.nth([6, 3, 8, 5][i % 4]).click()
            await wait(0.2)
            if first and i == 0:
                await a.shot(pg, f'{prefix}voting-picked')
            if await pg.get_by_role('button', name='اللي بعده', exact=True).count():
                await tap(pg, 'اللي بعده', exact=True)
                await wait(0.35)
                if first and i == 0:
                    await a.shot(pg, f'{prefix}voting-second-car')
                continue
            # a pick on a garage before the last moves on by itself after 400 ms: the last one may still be unrated
            if not await pg.locator('.rate button[aria-checked="true"]').count():
                await wait(0.3)
                continue
            if first:
                await a.shot(pg, f'{prefix}voting-last-before-send')
            await need(a, pg, 'أرسل التقييم')
            await wait(0.6)
            if first or pg is host:
                await a.shot(pg, f'{prefix}voting-sent-{"player" if first else "host"}')
            break
    if not await until(host, 'results', limit=20):
        await a.shot(host, f'{prefix}voting-host-still-waiting')
        a.miss('results', 'a voter never sent: the host announces with the votes he has')
        await need(a, host, 'اعرض النتيجة الحين', 3000)
        if not await until(host, 'results', limit=20):
            a.miss('results', 'host never reached results')
            return
    await wait(0.4)
    await a.shot(host, f'{prefix}results-host-reveal-start')
    await wait(2.0)
    await a.shot(host, f'{prefix}results-host-podium')
    await a.shot(sa, f'{prefix}results-player')
    if tv:
        await a_tv(tv, 'results')
    if await until_sel(host, '.e-stage', 30):
        await wait(1.2)
        await a.shot(host, f'{prefix}awards-ceremony-1')
        await wait(2.8)
        await a.shot(host, f'{prefix}awards-ceremony-2')
        await need(a, host, 'تخطي الجوايز', 3000)
    elif not await until_sel(host, '.e-awards', 5):
        a.miss('awards ceremony', 'neither the stage nor the list showed up')
    await wait(1.2)
    try:
        await host.locator('.e-awards').first.scroll_into_view_if_needed(timeout=2000)
    except Exception:  # noqa: BLE001
        pass
    await a.shot(host, f'{prefix}awards-final-list')
    await a.shot(host, f'{prefix}results-host-full', full=True)
    if await tap(host, 'شارك كراجك', 3000):
        await wait(2.5)
        await a.shot(host, f'{prefix}share-poster-dialog')
        if not await tap(host, 'سكّر', 2000, exact=True):
            await host.keyboard.press('Escape')
    else:
        a.miss('share poster', 'no «شارك كراجك» button')
    await host.evaluate('() => window.scrollTo(0, 0)')
    try:
        await host.locator('button.e-rank-row').first.click(timeout=2000)
        await wait(0.5)
        await a.shot(host, f'{prefix}results-garage-open-full', full=True)
    except Exception as ex:  # noqa: BLE001
        a.miss('results garage open', ex)
    await until_sel(sa, '.e-awards', 30)
    await wait(0.5)
    await a.shot(sa, f'{prefix}results-player-full', full=True)


async def a_tv(tv, tag):
    a, pg = tv
    await a.shot(pg, f'tv-{tag}')


async def players_garage(a, pg, who, tag):
    """Opens the players sheet and one player's garage from it."""
    if not await tap(pg, 'الكراجات والترتيب', exact=True) and not await tap(pg, 'المزايدين والكراجات', exact=True):
        a.miss('players sheet', 'no players button in the top bar')
        return
    await wait(0.5)
    await a.shot(pg, f'{tag}')
    try:
        await pg.locator('.shl-p-main', has_text=who).first.click(timeout=1500)
        await wait(0.5)
        await a.shot(pg, f'{tag}-garage-{who}')
        await pg.evaluate("() => { const s = document.querySelector('.shl-sheet-body, [role=dialog] .shl-body'); if (s) s.scrollTop = 99999 }")
    except Exception as ex:  # noqa: BLE001
        a.miss(f'garage of {who} from the players sheet', ex)
    await tap(pg, 'سكّر', exact=True)
    await wait(0.3)


async def host_menu_walk(a, host, tag):
    """The host's room menu and each of its confirms."""
    if not await open_menu(a, host):
        return
    await a.shot(host, f'room-menu-{tag}-host')
    if await need(a, host, 'شيل السيارة'):
        await wait(0.3)
        await a.shot(host, 'room-menu-skip-confirm')
        await need(a, host, 'لا، خلها')
        await wait(0.3)
    if await need(a, host, 'خلّص المزاد للكل'):
        await wait(0.3)
        await a.shot(host, 'room-menu-end-confirm')
        await need(a, host, 'لا، كمّل')
        await wait(0.3)
    if await need(a, host, 'اطلع من الصالة'):
        await wait(0.3)
        await a.shot(host, 'room-menu-host-leave-confirm')
        await need(a, host, 'خلني')
        await wait(0.3)
    await tap(host, 'سكّر', exact=True)


async def main_run(p):
    a = Atlas('390')
    ta = Atlas('tv')
    b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    W, H = 390, 844
    hctx, host = await new_page(b, a, 'host', W, H)

    # ---- home, how-to, what's new, join code states ----
    await host.goto(BASE + '#/')
    await wait(1.6)
    await a.shot(host, 'home')
    await host.evaluate('() => window.scrollTo(0, innerHeight)')
    await wait(0.4)
    await a.shot(host, 'home-scrolled')
    await a.shot(host, 'home-full', full=True)
    await host.evaluate('() => window.scrollTo(0, 0)')
    await need(a, host, 'عندي كود صالة')
    await wait(0.4)
    await a.shot(host, 'join-code-empty')
    await host.locator('input[aria-label="كود الصالة"]').fill('k7q')
    await wait(0.2)
    await a.shot(host, 'join-code-typing')
    await click(host, 'form.hm-join button.hm-join-go')
    await wait(0.3)
    await a.shot(host, 'join-code-too-short')
    await host.locator('input[aria-label="كود الصالة"]').fill('ZZ9ZZ9')
    await wait(0.2)
    await a.shot(host, 'join-code-full')
    await click(host, 'form.hm-join button.hm-join-go')
    await wait(0.8)
    await a.shot(host, 'join-name-for-wrong-code')
    await host.fill('input[autocomplete="nickname"]', 'نايف')
    await need(a, host, 'ادخل الصالة')
    await wait(1.5)
    await a.shot(host, 'join-wrong-code-waiting')
    await wait(9.0)
    await a.shot(host, 'join-wrong-code-after-9s')
    await host.goto(BASE + '#/rules')
    await wait(0.8)
    await a.shot(host, 'howto')
    await a.shot(host, 'howto-full', full=True)
    # what's new opens by itself on a phone that has not seen the latest release: a fresh context without the mark
    nctx, news = await new_page(b, a, 'news', W, H, news_seen=False)
    await news.goto(BASE + '#/')
    if await until_sel(news, '.hm-news', 4):
        await wait(0.8)
        await a.shot(news, 'whats-new')
        await news.evaluate("() => { const s = document.querySelector('.hm-news-body'); if (s) s.scrollTop = 99999 }")
        await wait(0.3)
        await a.shot(news, 'whats-new-end')
    else:
        a.miss("What's new", 'the sheet did not open on a phone that never saw it')
    await nctx.close()

    # ---- create ----
    code = await create_room(a, host, 'نايف', budget=None)
    a.say('room', code)
    await wait(1.2)
    await a.shot(host, 'lobby-host-empty')
    await a.shot(host, 'lobby-host-empty-full', full=True)

    tvctx, tv = await new_page(b, ta, 'tv', 1280, 720, mobile=False, dsf=1)
    await tv.goto(f'{BASE}#/tv/{code}')
    await wait(2.5)
    tvp = (ta, tv)
    await a_tv(tvp, 'lobby-empty')

    sctx, saud = await join(b, a, code, 'سعود', W, H, shots_prefix='join-from-link')
    fctx, fahd = await join(b, a, code, 'فهد', W, H)
    if not await wait_players(host, 3):
        a.miss('lobby', 'three players never showed in the host lobby')
    await wait(1.5)
    await a.shot(host, 'lobby-host')
    await a.shot(host, 'lobby-host-full', full=True)
    await a.shot(saud, 'lobby-player')
    await a.shot(saud, 'lobby-player-full', full=True)
    await a_tv(tvp, 'lobby')
    # kick asks first
    if await need(a, host, 'طلّع فهد'):
        await wait(0.3)
        await a.shot(host, 'lobby-kick-ask')
        await wait(3.8)
    # the settings sheet
    if await need(a, host, 'عدّل'):
        await wait(0.6)
        await a.shot(host, 'settings-sheet-top')
        await host.evaluate("() => { const d = document.querySelector('.lby-sheet-body'); if (d) d.scrollTop = 99999 }")
        await wait(0.3)
        await a.shot(host, 'settings-sheet-bottom')
        await need(a, host, 'تمام', exact=True)
    # players sheet, room menu, leave confirm (lobby)
    if await need(a, host, 'المزايدين والكراجات', exact=True):
        await wait(0.6)
        await a.shot(host, 'players-sheet-lobby-host')
        await tap(host, 'سكّر', exact=True)
    if await open_menu(a, host):
        await a.shot(host, 'room-menu-lobby-host')
        await need(a, host, 'اطلع من الصالة')
        await wait(0.3)
        await a.shot(host, 'room-menu-lobby-host-leave-confirm')
        await need(a, host, 'خلني')
        await tap(host, 'سكّر', exact=True)
    if await open_menu(a, saud):
        await a.shot(saud, 'room-menu-lobby-player')
        await tap(saud, 'سكّر', exact=True)

    # ---- start ----
    await host.locator('button.btn-gold', has_text='ابدأ').click()
    await wait(0.9)
    await a.shot(host, 'intro-host')
    await a.shot(saud, 'intro-player')
    await a_tv(tvp, 'intro')

    wins = {'saud': 0}
    done = set()
    late = None
    t0 = time.time()
    last_lot = 0
    while time.time() - t0 < 900:
        ph, n = await phase(host)
        if ph in ('showcase', 'voting', 'results'):
            break
        if n == 0 or n == last_lot:
            await wait(0.25)
            continue
        last_lot = n
        await until(saud, ['preview', 'bidding', 'sealed', 'dutch'], lot=n, limit=20)
        await wait(0.3)
        k = await kind(saud)
        a.say(f'{time.time() - t0:6.1f}s lot {n} kind {k} saud-wins {wins["saud"]}')

        # ---------- lot 1: the full preview and bidding walk ----------
        if n == 1:
            await until(saud, 'preview', lot=1, limit=20)
            await wait(0.4)
            await a.shot(saud, 'preview-player-console-closed')
            await a.shot(host, 'preview-host')
            await a_tv(tvp, 'preview')
            await need(a, host, 'وقّف مؤقت')
            await wait(0.6)
            await a.shot(saud, 'preview-player-paused-by-host')
            await a.shot(saud, 'preview-player-full', full=True)
            await sheet_tabs(a, saud, 'car-sheet')
            try:
                await saud.locator('button.sh-slide').first.click(timeout=1500)
                await wait(0.8)
                await a.shot(saud, 'gallery-viewer')
                await click(saud, '.sh-lb-close')
            except Exception as ex:  # noqa: BLE001
                a.miss('gallery viewer', ex)
            await need(a, host, 'كمّل المزاد')
            await until(saud, 'bidding', lot=1, limit=20)
            await wait(0.5)
            await a.shot(saud, 'bidding-player-console-open')
            await a.shot(host, 'bidding-host')
            await a_tv(tvp, 'bidding-open')
            if await click(saud, '.rx-fab', 800):
                await wait(0.4)
                await a.shot(saud, 'reactions-tray')
                await click(saud, '.rx-chip', 600)
                await wait(0.3)
                await a.shot(saud, 'reaction-sent')
                await click(saud, '.rx-fab', 600)
            else:
                a.miss('reactions tray', 'no .rx-fab on the player during bidding')
            if await click(saud, '.cs-key.is-free:not(:disabled)', 800):
                await wait(0.5)
                await a.shot(saud, 'keypad-empty')
                await type_amount(saud, 123)
                await wait(0.2)
                await a.shot(saud, 'keypad-too-low')
                await click(saud, '.cs-pad .cs-x', 800)
            else:
                a.miss('free-bid keypad', 'no «سوم حر» key')
            await bid_min(saud)
            await wait(0.08)
            await a.shot(saud, 'bid-sending')
            await wait(0.6)
            await a.shot(saud, 'bid-holding')
            await a_tv(tvp, 'bidding-bid')
            await wait(0.5)
            # فهد throws almost his whole budget: he outbids, wins, and is short of money for the rest of the night
            if not await free_bid(fahd, 1_400_000):
                a.miss('free bid', 'فهد could not send 1,400,000')
            await wait(0.45)
            await a.shot(saud, 'bid-outbid')
            await a.shot(fahd, 'free-bid-holding-big')
            await wait(0.3)
            if await click(saud, '.cs-log', 800):
                await wait(0.4)
                await a.shot(saud, 'bid-log')
                await tap(saud, 'سكّر', exact=True)
            else:
                a.miss('bid log', 'no .cs-log button')
            if await hot(saud):
                await a.shot(saud, 'last-five-seconds')
                await a_tv(tvp, 'last-seconds')
            else:
                a.miss('last five seconds', 'ring never went hot')
            await until(saud, ['sold', 'unsold', 'approval'], lot=1, limit=30)
            await wait(0.5)
            await a.shot(saud, 'sold-to-another-0s')
            await a.shot(fahd, 'sold-to-me-overpaid-0s')
            await a_tv(tvp, 'sold')
            await wait(2.8)
            await a.shot(saud, 'sold-to-another-3s')
            await a.shot(fahd, 'sold-to-me-overpaid-3s')
            await a.shot(host, 'sold-host-3s')
            await a_tv(tvp, 'sold-3s')
            continue

        # ---------- lot 2: the host's menu during bidding, a late bid that stretches the clock, the player who wins ----------
        if k == 'open' and 'menu' not in done:
            done.add('menu')
            await until(host, 'preview', lot=n, limit=10)
            if await open_menu(a, saud):
                await a.shot(saud, 'room-menu-auction-player')
                await need(a, saud, 'اطلع من الصالة')
                await wait(0.3)
                await a.shot(saud, 'room-menu-player-leave-confirm')
                await need(a, saud, 'خلني')
                await tap(saud, 'سكّر', exact=True)
            await need(a, host, 'افتح المزاد الحين')
            await until(saud, 'bidding', lot=n, limit=20)
            await bid_min(saud)
            # the host's menu while the car is on the block, and each of its confirms
            await host_menu_walk(a, host, 'bidding')
            await wait(0.3)
            await a.shot(fahd, 'not-enough-money')
            # a late bid stretches the clock: the host outbids in the last seconds, سعود sees «تمدد الوقت», then takes it back
            if await hot(saud):
                await bid_min(host)
                await wait(0.35)
                await a.shot(saud, 'clock-extended')
                await a.shot(fahd, 'clock-extended-watcher')
                await a.shot(host, 'clock-extended-host')
                await wait(1.0)
                # above the reserve, so the car sells to him and both phones show the reveal's stages
                amt = await over_reserve(saud)
                if not await free_bid(saud, amt):
                    a.miss('lot 2 win', f'سعود could not send {amt}')
            else:
                a.miss('clock extended', 'ring never went hot on lot 2')
            await until(saud, ['sold', 'unsold', 'approval'], lot=n, limit=40)
            ph2, _ = await phase(saud)
            if ph2 == 'sold':
                wins['saud'] += 1
                await wait(0.5)
                await a.shot(saud, 'sold-to-me-0s')
                if await wait_stage(saud, 2):
                    await a.shot(saud, 'sold-to-me-stage2')
                    await a.shot(fahd, 'sold-to-other-stage2')
                    await wait(2.7)
                    await a.shot(saud, 'sold-to-me-stage3')
                    await a.shot(fahd, 'sold-to-other-stage3')
                    await a.shot(saud, 'sold-to-me-stage3-full', full=True)
                else:
                    a.miss('sold reveal stage 2', 'the receipt never printed')
            elif ph2 == 'approval':
                await a.shot(saud, 'approval')
            else:
                a.miss('sold reveal stages', f'lot 2 ended {ph2}')
            continue

        # ---------- an open car nobody bids on ----------
        if k == 'open' and 'unsold' not in done:
            done.add('unsold')
            await need(a, host, 'افتح المزاد الحين')
            # a player reloads in the middle of the car
            await until(fahd, 'bidding', lot=n, limit=20)
            await wait(0.5)
            await fahd.reload()
            await wait(0.6)
            await a.shot(fahd, 'player-reload-0s')
            await wait(2.5)
            await a.shot(fahd, 'player-reload-3s')
            await until(saud, ['sold', 'unsold', 'approval'], lot=n, limit=40)
            await wait(0.5)
            await a.shot(saud, 'unsold-0s')
            await wait(1.8)
            await a.shot(saud, 'unsold-2s')
            continue

        # ---------- covered ----------
        if k == 'covered' and 'covered' not in done:
            done.add('covered')
            await wait(0.4)
            await a.shot(saud, 'covered-preview')
            await a.shot(saud, 'covered-preview-full', full=True)
            await need(a, host, 'افتح المزاد الحين')
            await until(saud, 'bidding', lot=n, limit=20)
            await wait(0.4)
            await a.shot(saud, 'covered-bidding')
            buyer = saud if wins['saud'] < 3 else host
            if await bid_min(buyer) and buyer is saud:
                wins['saud'] += 1
            await until(saud, ['sold', 'unsold', 'approval'], lot=n, limit=40)
            await wait(0.6)
            await a.shot(saud, 'covered-reveal-0s')
            await wait(3.0)
            await a.shot(saud, 'covered-reveal-3s')
            await wait(3.0)
            await a.shot(saud, 'covered-reveal-6s')
            continue

        # ---------- sealed envelope ----------
        if k == 'sealed' and 'sealed' not in done:
            done.add('sealed')
            await wait(0.4)
            await a.shot(saud, 'sealed-preview')
            await need(a, host, 'افتح المزاد الحين')
            await until(saud, 'sealed', lot=n, limit=20)
            await wait(0.5)
            await a.shot(saud, 'sealed-before')
            # with a full garage سعود only watches: the host and the envelope he seals are shot instead
            sealer = host if await garage_full(saud) else saud
            try:
                await sealer.locator('.cs-env .cs-raise button:not(:disabled)').nth(1).click(timeout=1200)
                await wait(0.2)
                await a.shot(sealer, 'sealed-amount-picked')
                await need(a, sealer, 'اختم الظرف')
                await wait(0.6)
                await a.shot(sealer, 'sealed-after')
                if sealer is saud:
                    await host.locator('.cs-env .cs-raise button:not(:disabled)').nth(0).click(timeout=1200)
                    await need(a, host, 'اختم الظرف')
            except Exception as ex:  # noqa: BLE001
                a.miss('sealed envelope', ex)
            await until(saud, ['sold', 'unsold', 'approval'], lot=n, limit=40)
            await wait(0.6)
            await a.shot(saud, 'sealed-reveal-0s')
            await wait(2.6)
            await a.shot(saud, 'sealed-reveal-3s')
            await wait(3.0)
            await a.shot(saud, 'sealed-reveal-6s')
            continue

        # ---------- dutch ----------
        if k == 'dutch' and 'dutch' not in done:
            done.add('dutch')
            await wait(0.4)
            await a.shot(saud, 'dutch-preview')
            await need(a, host, 'افتح المزاد الحين')
            await until(saud, 'dutch', lot=n, limit=20)
            await wait(0.6)
            await a.shot(saud, 'dutch-falling')
            await a_tv(tvp, 'dutch')
            await wait(3.0)
            await a.shot(saud, 'dutch-falling-3s')
            taker = saud if wins['saud'] < 3 else host
            if await click(taker, '.dutch-panel button.dc-take:not(:disabled)', 2500):
                if taker is saud:
                    wins['saud'] += 1
            else:
                a.miss('dutch take', '«أبيها» never enabled')
            await wait(0.6)
            await a.shot(saud, 'dutch-after-take')
            await until(saud, ['sold', 'unsold', 'approval'], lot=n, limit=40)
            await wait(2.6)
            await a.shot(saud, 'dutch-reveal-3s')
            continue

        # ---------- the rest: سعود fills his garage, events on the way ----------
        await need(a, host, 'افتح المزاد الحين')
        r = await until(saud, ['bidding', 'sealed', 'dutch'], lot=n, limit=20)
        phn = r[0] if r else ''
        if 'offline' not in done and phn == 'bidding':
            done.add('offline')
            await sctx.set_offline(True)
            await wait(2.5)
            await a.shot(saud, 'offline-2s')
            if await click(saud, '.rx-fab', 800):
                await wait(0.4)
                await a.shot(saud, 'offline-reactions-tray')
                await click(saud, '.rx-fab', 600)
            else:
                await a.shot(saud, 'offline-reactions-no-button')
            await wait(3.0)
            await a.shot(saud, 'offline-6s')
            await sctx.set_offline(False)
            await wait(1.0)
            await a.shot(saud, 'reconnect-1s')
            await wait(3.0)
            await a.shot(saud, 'reconnect-4s')
            if await click(saud, '.rx-fab', 800):
                await wait(0.4)
                await a.shot(saud, 'reconnect-reactions-tray')
                await click(saud, '.rx-fab', 600)
        elif 'hostreload' not in done and phn == 'bidding':
            done.add('hostreload')
            await host.reload()
            await wait(0.8)
            await a.shot(host, 'host-reload-0s')
            await a.shot(saud, 'host-reload-player-sees')
            await wait(3.0)
            await a.shot(host, 'host-reload-3s')
            await a.shot(saud, 'host-reload-player-3s')
        if late is None and n >= 4:
            lctx, lpg = await join(b, a, code, 'متأخر', W, H)
            await wait(3.5)
            await a.shot(lpg, 'late-spectator')
            late = lpg
        if phn == 'bidding':
            await wait(0.3)
            if wins['saud'] >= 2 and 'players-garage' not in done:
                done.add('players-garage')
                await players_garage(a, fahd, 'سعود', 'players-sheet-auction')
            if not await garage_full(saud):
                if await bid_min(saud):
                    wins['saud'] += 1
            else:
                wins['saud'] = 3
                await a.shot(saud, 'garage-full')
                await a.shot(saud, 'garage-full-console-end', full=False)
                await bid_min(host)
        elif phn == 'sealed':
            try:
                await host.locator('.cs-env .cs-raise button:not(:disabled)').nth(0).click(timeout=1200)
                await tap(host, 'اختم الظرف')
            except Exception:  # noqa: BLE001
                pass
        elif phn == 'dutch':
            await wait(2)
            await click(host, '.dutch-panel button.dc-take:not(:disabled)')
        await until(saud, ['sold', 'unsold', 'approval'], lot=n, limit=40)
        if wins['saud'] >= 3 and 'garage-full-sold' not in done:
            done.add('garage-full-sold')
            await wait(2.5)
            await a.shot(saud, 'sold-garage-now-full-3s')
        # once every kind and event is seen and the garage is full, the host ends the night
        need_all = {'menu', 'unsold', 'covered', 'sealed', 'dutch', 'offline', 'hostreload', 'players-garage'}
        if need_all <= done and 'garage-full' in a.seen and late is not None:
            break

    for k in ['covered', 'sealed', 'dutch', 'unsold', 'offline', 'hostreload', 'players-garage']:
        if k not in done:
            a.miss(k, 'the deck did not offer it before the night ended')
    if 'garage-full' not in a.seen:
        a.miss('garage full', 'سعود never filled three slots before the end')
    ph, _ = await phase(host)
    if ph not in ('showcase', 'voting', 'results'):
        await end_now(a, host)
    await end_night(a, host, [saud, fahd], tv=tvp)
    if late is not None:
        await a.shot(late, 'results-late-spectator')
    # home after the night: «سجلي» and back to the room
    await host.goto(BASE + '#/')
    await wait(1.5)
    await a.shot(host, 'home-after-night')
    if await tap(host, 'سجلي', 3000):
        await wait(0.8)
        await a.shot(host, 'career-sheet')
        await host.evaluate("() => { const s = document.querySelector('.e-cr'); if (s) s.scrollTop = 9999 }")
        await wait(0.3)
        await a.shot(host, 'career-sheet-bottom')
    else:
        a.miss('سجلي', 'no button on home after a night')
    await b.close()
    a.close()
    ta.close()


async def small_run(p, W, H, folder):
    a = Atlas(folder)
    b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    _, host = await new_page(b, a, 'host', W, H)
    await host.goto(BASE + '#/')
    await wait(1.6)
    await a.shot(host, 'home')
    await a.shot(host, 'home-full', full=True)
    await need(a, host, 'عندي كود صالة')
    await wait(0.3)
    await click(host, 'form.hm-join button.hm-join-go')
    await wait(0.3)
    await a.shot(host, 'join-code-empty-error')
    await host.goto(BASE + '#/rules')
    await wait(0.8)
    await a.shot(host, 'howto-full', full=True)
    code = await create_room(a, host, 'نايف', shots=True)
    sctx, saud = await join(b, a, code, 'سعود', W, H, shots_prefix='join-from-link')
    fctx, fahd = await join(b, a, code, 'فهد', W, H)
    if not await wait_players(host, 3):
        a.miss('lobby', 'players never showed in the host lobby')
    await wait(1.2)
    await a.shot(host, 'lobby-host')
    await a.shot(host, 'lobby-host-full', full=True)
    await a.shot(saud, 'lobby-player')
    await a.shot(saud, 'lobby-player-full', full=True)
    if await need(a, host, 'عدّل'):
        await wait(0.6)
        await a.shot(host, 'settings-sheet-top')
        await host.evaluate("() => { const d = document.querySelector('.lby-sheet-body'); if (d) d.scrollTop = 99999 }")
        await wait(0.3)
        await a.shot(host, 'settings-sheet-bottom')
        await need(a, host, 'تمام', exact=True)
    if await open_menu(a, host):
        await a.shot(host, 'room-menu-lobby-host')
        await tap(host, 'سكّر', exact=True)
    await host.locator('button.btn-gold', has_text='ابدأ').click()
    await wait(0.9)
    await a.shot(saud, 'intro-player')
    await until(saud, 'preview', lot=1, limit=30)
    await wait(0.4)
    await a.shot(saud, 'preview')
    await a.shot(host, 'preview-host')
    await need(a, host, 'وقّف مؤقت')
    await wait(0.4)
    await a.shot(saud, 'preview-paused')
    await sheet_tabs(a, saud, 'car-sheet')
    await need(a, host, 'كمّل المزاد')
    await until(saud, 'bidding', lot=1, limit=20)
    await wait(0.5)
    await a.shot(saud, 'bidding-console-open')
    await a.shot(host, 'bidding-host')
    await host_menu_walk(a, host, 'bidding')
    if await click(saud, '.rx-fab', 800):
        await wait(0.4)
        await a.shot(saud, 'reactions-tray')
        await click(saud, '.rx-fab', 600)
    if await click(saud, '.cs-key.is-free:not(:disabled)', 800):
        await wait(0.5)
        await type_amount(saud, 250000)
        await a.shot(saud, 'keypad')
        await click(saud, '.cs-pad .cs-x', 800)
    await bid_min(saud)
    await wait(0.6)
    await a.shot(saud, 'bid-holding')
    await bid_min(fahd)
    await wait(0.4)
    await a.shot(saud, 'bid-outbid')
    if await click(saud, '.cs-log', 800):
        await wait(0.4)
        await a.shot(saud, 'bid-log')
        await tap(saud, 'سكّر', exact=True)
    if await hot(saud):
        # a late bid past the reserve: the clock stretches and the car sells to سعود
        if not await free_bid(saud, await over_reserve(saud)):
            await bid_min(saud)
        await wait(0.35)
        await a.shot(saud, 'clock-extended')
    await until(saud, ['sold', 'unsold', 'approval'], lot=1, limit=40)
    await wait(0.6)
    await a.shot(saud, 'reveal-0s')
    if await wait_stage(saud, 2):
        await a.shot(saud, 'reveal-stage2')
        await a.shot(fahd, 'reveal-other-stage2')
        await wait(2.7)
        await a.shot(saud, 'reveal-stage3')
        await a.shot(fahd, 'reveal-other-stage3')
        await a.shot(host, 'reveal-host-stage3')
    else:
        a.miss('sold reveal stages', f'lot 1 ended {(await phase(saud))[0]}, no receipt printed')
    await players_garage(a, fahd, 'سعود', 'players-sheet')
    # سعود fills his garage on the next cars, then the host ends the night
    t0 = time.time()
    last = 1
    while time.time() - t0 < 150:
        ph, n = await phase(host)
        if ph in ('showcase', 'voting', 'results'):
            break
        if n == last:
            await wait(0.25)
            continue
        last = n
        await tap(host, 'افتح المزاد الحين', 3000)
        r = await until(saud, ['bidding', 'sealed', 'dutch'], lot=n, limit=20)
        phn = r[0] if r else ''
        await wait(0.4)
        k = await kind(saud)
        await a.shot(saud, f'{k}-console')
        if phn == 'bidding':
            if await garage_full(saud):
                await a.shot(saud, 'garage-full')
                break
            await bid_min(saud)
        elif phn == 'sealed':
            try:
                await saud.locator('.cs-env .cs-raise button:not(:disabled)').nth(0).click(timeout=1200)
                await tap(saud, 'اختم الظرف')
            except Exception:  # noqa: BLE001
                pass
        elif phn == 'dutch':
            await wait(1.5)
            await click(saud, '.dutch-panel button.dc-take:not(:disabled)')
        await until(saud, ['sold', 'unsold', 'approval'], lot=n, limit=40)
        await wait(0.6)
        await a.shot(saud, f'{k}-reveal-0s')
        await wait(2.6)
        await a.shot(saud, f'{k}-reveal-3s')
    if 'garage-full' not in a.seen:
        a.miss('garage full', 'سعود never filled his garage before the end')
    ph, _ = await phase(host)
    if ph not in ('showcase', 'voting', 'results'):
        await end_now(a, host)
    await end_night(a, host, [saud, fahd])
    await b.close()
    a.close()


async def stress_run(p):
    a = Atlas('stress')
    W, H = 390, 844
    b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    names = ['عبدالرحمن بن سلطان ال', 'محمد عبدالعزيز الفهيد', 'سلطان بن عبدالمحسن ال']  # 20+ characters each
    _, host = await new_page(b, a, 'host', W, H)
    code = await create_room(a, host, names[0], budget=9_999_999, shots=False)
    p1ctx, p1 = await join(b, a, code, names[1], W, H)
    p2ctx, p2 = await join(b, a, code, names[2], W, H)
    await wait_players(host, 3)
    await wait(1.2)
    try:
        a.say('typed name length', len(names[0]), 'stored', len(await host.locator('.lby-p-name').first.inner_text()))
    except Exception as ex:  # noqa: BLE001
        a.miss('lobby name', ex)
    await a.shot(host, 'lobby-host-long-names')
    await a.shot(host, 'lobby-host-long-names-full', full=True)
    await a.shot(p1, 'lobby-player-long-names')
    await host.locator('button.btn-gold', has_text='ابدأ').click()
    wins = 0
    t0 = time.time()
    last = 0
    while time.time() - t0 < 420:
        ph, n = await phase(host)
        if ph in ('showcase', 'voting', 'results'):
            break
        if n == 0 or n == last:
            await wait(0.25)
            continue
        last = n
        await tap(host, 'افتح المزاد الحين', 3000)
        r = await until(p1, ['bidding', 'sealed', 'dutch'], lot=n, limit=20)
        phn = r[0] if r else ''
        if phn == 'bidding':
            if not await garage_full(p1):
                if wins == 0:
                    if not await free_bid(p1, 2_350_000):
                        a.miss('seven-digit bid', 'the keypad did not send 2,350,000')
                    await wait(0.6)
                    await a.shot(p1, 'seven-digit-holding')
                    await a.shot(host, 'seven-digit-host')
                    await bid_min(p2)
                    await wait(0.5)
                    await a.shot(p1, 'seven-digit-outbid')
                    await free_bid(p1, 3_100_000)
                else:
                    await bid_min(p1)
                wins += 1
            else:
                await wait(0.4)
                await a.shot(p1, 'garage-full-long-names')
                await bid_min(p2)
        elif phn == 'sealed':
            await wait(0.4)
            await a.shot(p1, 'sealed-seven-digit-budget')
            try:
                await p1.locator('.cs-env .cs-raise button:not(:disabled)').nth(2).click(timeout=1200)
                await tap(p1, 'اختم الظرف')
                await wait(0.4)
                await a.shot(p1, 'sealed-sealed-seven-digit')
            except Exception as ex:  # noqa: BLE001
                a.miss('sealed seven-digit', ex)
        elif phn == 'dutch':
            await wait(0.6)
            await a.shot(p1, 'dutch-seven-digit-budget')
        await until(p1, ['sold', 'unsold', 'approval'], lot=n, limit=60)
        await wait(2.8)
        await a.shot(p1, f'reveal-lot{n}-3s')
        if 'garage-full-long-names' in a.seen:
            break
    if 'garage-full-long-names' not in a.seen:
        a.miss('garage full', 'the long-named player never filled his garage')
    await players_garage(a, p1, names[1][:6], 'players-sheet-long-names')
    ph, _ = await phase(host)
    if ph not in ('showcase', 'voting', 'results'):
        await end_now(a, host)
    await end_night(a, host, [p1, p2])
    await b.close()
    a.close()


MEASURE_JS = r"""(tag) => {
  const lum = (c) => { const m = c.match(/[\d.]+/g); if (!m) return null; const [r,g,b] = m.slice(0,3).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4) }); return { L: 0.2126*r + 0.7152*g + 0.0722*b, a: m[3] === undefined ? 1 : +m[3] } };
  const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); const c = lum(s.backgroundColor); if (c && c.a > 0.85) return { c: s.backgroundColor, img: s.backgroundImage !== 'none' }; if (s.backgroundImage !== 'none' && s.backgroundImage.includes('gradient')) return { c: null, img: true } } return { c: getComputedStyle(document.body).backgroundColor, img: false } };
  const out = { tag, small: [], contrast: [] };
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05 && r.bottom > 0 && r.top < innerHeight };
  for (const el of document.querySelectorAll('button, a, input, [role=tab], [role=radio], [role=switch]')) {
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.height < 44 || r.width < 44) out.small.push({ name: (el.getAttribute('aria-label') || el.textContent || el.placeholder || '').trim().slice(0, 30), cls: (el.className || '').toString().slice(0, 40), w: Math.round(r.width), h: Math.round(r.height), disabled: !!el.disabled });
  }
  const seen = new Set();
  for (const el of document.querySelectorAll('body *')) {
    if (!vis(el)) continue;
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (!own) continue;
    const s = getComputedStyle(el); const fg = lum(s.color); const bg = bgOf(el);
    if (!fg || !bg.c || bg.img) continue;
    const b = lum(bg.c); const L1 = Math.max(fg.L, b.L), L2 = Math.min(fg.L, b.L);
    let ratio = (L1 + 0.05) / (L2 + 0.05);
    if (fg.a < 1) ratio = 1 + (ratio - 1) * fg.a;
    const px = parseFloat(s.fontSize); const bold = +s.fontWeight >= 700; const large = px >= 24 || (bold && px >= 18.66);
    const need = large ? 3 : 4.5;
    const txt = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').slice(0, 40);
    if (ratio < need && !el.closest('button:disabled') && !seen.has(txt)) { seen.add(txt); out.contrast.push({ txt, ratio: +ratio.toFixed(2), need, px, color: s.color, bg: bg.c }) }
  }
  return out;
}"""


async def measure_run(p):
    """Touch-target sizes and text contrast, measured in the browser on the main screens."""
    a = Atlas('measure')
    W, H = 390, 844
    b = await p.chromium.launch()
    _, host = await new_page(b, a, 'host', W, H)
    res = []

    async def m(pg, tag):
        res.append(await pg.evaluate(MEASURE_JS, tag))
        await a.check(pg, tag)

    await host.goto(BASE + '#/')
    await wait(1.5)
    await m(host, 'home')
    await host.goto(BASE + '#/new')
    await wait(1.0)
    await m(host, 'create-top')
    code = await create_room(a, host, 'نايف', shots=False)
    _, saud = await join(b, a, code, 'سعود', W, H)
    if not await wait_players(host, 2):
        a.miss('lobby', 'the player never showed in the host lobby')
    await wait(1.0)
    await m(host, 'lobby-host')
    await m(saud, 'lobby-player')
    if await need(a, host, 'عدّل'):
        await wait(0.5)
        await m(host, 'settings-sheet')
        await need(a, host, 'تمام', exact=True)
    await host.locator('button.btn-gold', has_text='ابدأ').click()
    await until(saud, 'preview', lot=1, limit=30)
    await wait(0.5)
    await m(saud, 'preview-player')
    await m(host, 'preview-host')
    await until(saud, 'bidding', lot=1, limit=30)
    await wait(0.5)
    await m(saud, 'bidding-player')
    await m(host, 'bidding-host')
    await bid_min(saud)
    await wait(0.6)
    await m(saud, 'holding-player')
    with open(os.path.join(a.dir, 'measure.json'), 'w') as f:
        json.dump(res, f, ensure_ascii=False, indent=1)
    a.say('measured', len(res), 'screens:', ', '.join(f"{r['tag']} {len(r['small'])} small / {len(r['contrast'])} low contrast" for r in res))
    await b.close()
    a.close()


def contact_sheets():
    from PIL import Image, ImageDraw, ImageFont
    font = None
    for f in ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']:
        if os.path.exists(f):
            font = ImageFont.truetype(f, 13)
    for folder in sorted(os.listdir(OUT_ROOT)):
        d = os.path.join(OUT_ROOT, folder)
        if not os.path.isdir(d):
            continue
        files = sorted(x for x in os.listdir(d) if x.endswith('.png') and not x.startswith('_') and '-full' not in x)
        if not files:
            continue
        tw = 300 if folder == 'tv' else 180
        ims = []
        for f in files:
            im = Image.open(os.path.join(d, f)).convert('RGB')
            r = tw / im.width
            im = im.resize((tw, int(im.height * r)))
            ims.append((f, im))
        cols = 4 if folder == 'tv' else 8
        th = max(i.height for _, i in ims)
        cell_h = th + 34
        rows = (len(ims) + cols - 1) // cols
        sheet = Image.new('RGB', (cols * (tw + 12) + 12, rows * cell_h + 12), (235, 235, 235))
        dr = ImageDraw.Draw(sheet)
        for k, (f, im) in enumerate(ims):
            x = 12 + (k % cols) * (tw + 12)
            y = 12 + (k // cols) * cell_h
            sheet.paste(im, (x, y))
            label = f[:-4]
            dr.text((x, y + im.height + 3), label[:30], fill=(0, 0, 0), font=font)
            if len(label) > 30:
                dr.text((x, y + im.height + 17), label[30:60], fill=(0, 0, 0), font=font)
        sheet.save(os.path.join(d, '_contact.png'))
        print('contact sheet', folder, len(ims), 'shots')


async def run():
    async with async_playwright() as p:
        if MODE == 'main':
            await main_run(p)
        elif MODE == 'small' or MODE.startswith('small:'):
            widths = [int(x) for x in MODE.split(':', 1)[1].split(',')] if ':' in MODE else [360, 320]
            for w in widths:
                # the main night owns OUT_ROOT/390: the short night at 390 goes beside it
                await small_run(p, w, HEIGHTS.get(w, 800), f'{w}-small' if w == 390 else str(w))
        elif MODE == 'stress':
            await stress_run(p)
        elif MODE == 'measure':
            await measure_run(p)
        else:
            sys.exit(f'unknown mode {MODE}')


if MODE == 'sheets':
    contact_sheets()
else:
    asyncio.run(run())
