"""UX atlas: drives a host, players and a big screen through whole nights and screenshots every surface.

usage:
  python3 scripts/qa/atlas.py OUT_ROOT BASE_URL PHOTOS_DIR [main|small|stress|sheets]

  main    host + two players + a late spectator + the big screen, one whole night, at 390x844 (OUT_ROOT/390, OUT_ROOT/tv)
  small   a short night at 360x740 and again at 320x640 (OUT_ROOT/360, OUT_ROOT/320)
  stress  three 20-character names, a 7-digit budget and bid, a full garage, at 390x844 (OUT_ROOT/stress)
  measure touch-target sizes and text contrast on the main screens (OUT_ROOT/measure/measure.json)
  sheets  one contact sheet per folder (OUT_ROOT/<folder>/_contact.png)

BASE_URL is the app with its broker, e.g. http://localhost:5226/?brokers=ws://localhost:8916&bridge=0
PHOTOS_DIR holds ph_portrait.jpg and ph_land.jpg, served in place of the ad photos.
Every page context stubs the photo hosts and marks the news as seen, so no overlay covers the page.
What a run could not reach is written to OUT_ROOT/<folder>/_missed.txt.
"""
import asyncio
import os
import sys
import time

from playwright.async_api import async_playwright

OUT_ROOT = sys.argv[1]
BASE = sys.argv[2]
PHOTOS = sys.argv[3]
MODE = sys.argv[4] if len(sys.argv) > 4 else 'main'


class Atlas:
    """Numbered screenshots in one folder, plus a log of what could not be reached."""

    def __init__(self, folder):
        self.dir = os.path.join(OUT_ROOT, folder)
        os.makedirs(self.dir, exist_ok=True)
        self.n = 0
        self.seen = set()
        self.missed = []
        self.log = []

    def say(self, *a):
        s = ' '.join(str(x) for x in a)
        self.log.append(s)
        print(s, flush=True)

    async def shot(self, pg, name, full=False, once=True):
        if once and name in self.seen:
            return
        self.seen.add(name)
        self.n += 1
        path = os.path.join(self.dir, f'{self.n:03d}-{name}.png')
        try:
            await pg.screenshot(path=path, full_page=full)
        except Exception as ex:  # noqa: BLE001
            self.say('shot failed', name, ex)

    def miss(self, what, why):
        self.missed.append(f'{what}: {why}')
        self.say('MISSED', what, why)

    def close(self):
        with open(os.path.join(self.dir, '_missed.txt'), 'w') as f:
            f.write('\n'.join(self.missed) + '\n')
        with open(os.path.join(self.dir, '_log.txt'), 'w') as f:
            f.write('\n'.join(self.log) + '\n')


async def wait(s):
    await asyncio.sleep(s)


async def new_page(browser, a, name, w, h, mobile=True, dsf=2):
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
    await ctx.add_init_script("try{localStorage.setItem('mzk:news',JSON.stringify('2026-11-19'))}catch(e){}")
    pg = await ctx.new_page()
    pg.on('pageerror', lambda e: a.say(f'[{name}] PAGEERROR', e))
    return ctx, pg


async def phase(pg):
    try:
        return await pg.evaluate("() => [document.documentElement.dataset.phase || '', +(document.documentElement.dataset.lot || 0)]")
    except Exception:  # noqa: BLE001
        return ['?', 0]


KIND_JS = """() => {
  if (document.querySelector('.dutch-panel')) return 'dutch';
  const g = [...document.querySelectorAll('.g-kind')].map(e => e.textContent).join(' ');
  if (g.includes('هولندي')) return 'dutch';
  if (g.includes('ظرف')) return 'sealed';
  if (g.includes('الغطا')) return 'covered';
  const t = (document.querySelector('.bp-state') || {}).textContent || '';
  if (document.documentElement.dataset.phase === 'sealed' || t.includes('الظروف')) return 'sealed';
  if (t.includes('ينزل')) return 'dutch';
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


async def click(pg, sel, timeout=1500):
    try:
        await pg.locator(sel).first.click(timeout=timeout)
        return True
    except Exception:  # noqa: BLE001
        return False


async def bid_min(pg):
    return await click(pg, 'button.bid-main:not(:disabled)', 900)


async def free_bid(pg, amount):
    if not await click(pg, '.chip-free:not(:disabled)', 900):
        return False
    await pg.locator('.drawer input.amount-input').fill(str(amount))
    return await click(pg, '.drawer button.bid-main:not(:disabled)', 900)


async def until(pg, want_phase, lot=None, limit=60):
    t0 = time.time()
    while time.time() - t0 < limit:
        ph, n = await phase(pg)
        if (ph in want_phase if isinstance(want_phase, (list, tuple, set)) else ph == want_phase) and (lot is None or n == lot):
            return ph, n
        await wait(0.2)
    return None


async def hot(pg, limit=25):
    t0 = time.time()
    while time.time() - t0 < limit:
        if await pg.locator('.ring.hot').count():
            return True
        ph, _ = await phase(pg)
        if ph != 'bidding':
            return False
        await wait(0.15)
    return False


async def sheet_tabs(a, pg, prefix):
    """The car sheet: each of its four tabs, at its top and scrolled to its bottom."""
    for label in ['الفحص', 'السجلات', 'كلام المعلن', 'المواصفات']:
        try:
            await pg.get_by_role('tab', name=label).first.click(timeout=1500)
            await wait(0.35)
            await pg.locator('.lot-tabs').first.scroll_into_view_if_needed(timeout=1000)
            await pg.evaluate("() => { const t = document.querySelector('.lot-tabs'); if (t) window.scrollTo(0, window.scrollY + t.getBoundingClientRect().top - 60) }")
            await wait(0.25)
            await a.shot(pg, f'{prefix}-tab-{label.replace(" ", "_")}-top')
            await pg.evaluate("() => { const t = document.querySelector('.lot-tabs'); if (t) window.scrollTo(0, window.scrollY + t.getBoundingClientRect().bottom - innerHeight + 40) }")
            await wait(0.25)
            await a.shot(pg, f'{prefix}-tab-{label.replace(" ", "_")}-bottom')
        except Exception as ex:  # noqa: BLE001
            a.miss(f'car sheet tab {label}', ex)
    await pg.evaluate('() => window.scrollTo(0, 0)')


async def create_room(a, host, name, *, garage='3 سيارات', speed='سريع', lots=('+', '-'), budget=None, shots=True):
    await host.goto(BASE + '#/new')
    await wait(1.0)
    if shots:
        await a.shot(host, 'create-top')
        # the tap on «افتح الصالة» with no name: what the form says
        await host.fill('input[autocomplete="nickname"]', '')
        await host.locator('button.btn-gold').click()
        await wait(0.4)
        await a.shot(host, 'create-error-no-name')
    await host.fill('input[autocomplete="nickname"]', name)
    await tap(host, garage)
    await tap(host, speed)
    for k in lots:
        await tap(host, 'أكثر' if k == '+' else 'أقل', nth=1)
    if budget:
        await host.locator('input[placeholder="أو اكتب مبلغ ثاني"]').fill(str(budget))
    if shots:
        for i, frac in enumerate([0.33, 0.66, 1.0]):
            await host.evaluate(f'() => window.scrollTo(0, (document.body.scrollHeight - innerHeight) * {frac})')
            await wait(0.3)
            await a.shot(host, f'create-scroll-{i + 1}')
        await a.shot(host, 'create-full', full=True)
    await host.locator('button.btn-gold').click()
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
    await tap(pg, 'ادخل الصالة')
    return ctx, pg


async def wait_players(host, n, limit=30):
    t0 = time.time()
    while time.time() - t0 < limit:
        if await host.locator('.player-row').count() >= n:
            return True
        await wait(0.4)
    return False


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
    await tap(host, 'ابدأ التقييم السري', 4000)
    await wait(2.0)
    if tv:
        await a_tv(tv, 'voting')
    voters = [host] + pages[:2]
    for k, pg in enumerate(voters):
        first = pg is sa
        if first:
            await a.shot(pg, f'{prefix}voting-untouched')
            await a.shot(pg, f'{prefix}voting-untouched-full', full=True)
        for i in range(6):
            rate = pg.locator('.rate button')
            if await rate.count() == 0:
                break
            await rate.nth([6, 3, 8, 5][i % 4]).click()
            await wait(0.2)
            if first and i == 0:
                await a.shot(pg, f'{prefix}voting-picked')
            if await pg.get_by_role('button', name='التالي').count():
                await tap(pg, 'التالي')
                await wait(0.35)
                if first and i == 0:
                    await a.shot(pg, f'{prefix}voting-second-car')
                continue
            if first:
                await a.shot(pg, f'{prefix}voting-last-before-send')
            await tap(pg, 'أرسل التقييم')
            await wait(0.6)
            if first or pg is host:
                await a.shot(pg, f'{prefix}voting-sent-{"player" if first else "host"}')
            break
    if not await until(host, 'results', limit=30):
        a.miss('results', 'host never reached results')
        return
    await wait(0.4)
    await a.shot(host, f'{prefix}results-host-reveal-start')
    await wait(2.0)
    await a.shot(host, f'{prefix}results-host-podium')
    await a.shot(sa, f'{prefix}results-player')
    if tv:
        await a_tv(tv, 'results')
    for i in range(40):
        if await host.locator('.aw-frame').count():
            break
        await wait(0.5)
    await wait(1.2)
    try:
        await host.locator('.aw').first.scroll_into_view_if_needed(timeout=2000)
        await a.shot(host, f'{prefix}awards-ceremony-1')
        await wait(2.8)
        await a.shot(host, f'{prefix}awards-ceremony-2')
    except Exception as ex:  # noqa: BLE001
        a.miss('awards ceremony', ex)
    if not await tap(host, 'تخطَّ الحفل', 3000):
        a.miss('skip ceremony button', 'not found')
    await wait(1.2)
    try:
        await host.locator('.aw').first.scroll_into_view_if_needed(timeout=2000)
    except Exception:  # noqa: BLE001
        pass
    await a.shot(host, f'{prefix}awards-final-list')
    await a.shot(host, f'{prefix}results-host-full', full=True)
    if await tap(host, 'شارك كراجك', 3000):
        await wait(2.5)
        await a.shot(host, f'{prefix}share-poster-dialog')
        await tap(host, 'سكّر', 2000)
    else:
        a.miss('share poster', 'no «شارك كراجك» button')
    await host.evaluate('() => window.scrollTo(0, 0)')
    try:
        await host.locator('.rs-row, .rs-champion').first.click(timeout=2000)
        await wait(0.5)
        await a.shot(host, f'{prefix}results-garage-open-full', full=True)
    except Exception as ex:  # noqa: BLE001
        a.miss('results garage open', ex)
    for i in range(60):
        if await sa.locator('.aw-mine').count():
            break
        await wait(0.5)
    await a.shot(sa, f'{prefix}results-player-full', full=True)


TV = {}


async def a_tv(tv, tag):
    a, pg = tv
    await a.shot(pg, f'tv-{tag}')


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
    await tap(host, 'عندي كود صالة')
    await wait(0.4)
    await a.shot(host, 'join-code-empty')
    await host.locator('input[aria-label="كود الصالة"]').fill('k7q')
    await wait(0.2)
    await a.shot(host, 'join-code-typing')
    await host.locator('input[aria-label="كود الصالة"]').fill('ZZ9ZZ9')
    await wait(0.2)
    await a.shot(host, 'join-code-full')
    await host.locator('form.joinrow button').click()
    await wait(0.8)
    await a.shot(host, 'join-name-for-wrong-code')
    await host.fill('input[autocomplete="nickname"]', 'نايف')
    await tap(host, 'ادخل الصالة')
    await wait(1.5)
    await a.shot(host, 'join-wrong-code-waiting')
    await wait(9.0)
    await a.shot(host, 'join-wrong-code-after-9s')
    await host.goto(BASE + '#/rules')
    await wait(0.8)
    await a.shot(host, 'howto')
    await a.shot(host, 'howto-full', full=True)
    await host.goto(BASE + '#/')
    await wait(1.0)
    await host.evaluate('() => window.scrollTo(0, document.body.scrollHeight)')
    if await tap(host, 'الجديد'):
        await wait(0.6)
        await a.shot(host, 'whats-new')
        await host.keyboard.press('Escape')
        await tap(host, 'تمام', 800)
    else:
        a.miss("What's new", 'no «الجديد» link')

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
    await wait_players(host, 3)
    await wait(1.5)
    await a.shot(host, 'lobby-host')
    await a.shot(host, 'lobby-host-full', full=True)
    await a.shot(saud, 'lobby-player')
    await a.shot(saud, 'lobby-player-full', full=True)
    await a_tv(tvp, 'lobby')
    # kick asks first
    try:
        await host.get_by_role('button', name='طلّع فهد').click(timeout=1500)
        await wait(0.3)
        await a.shot(host, 'lobby-kick-ask')
        await wait(3.8)
    except Exception as ex:  # noqa: BLE001
        a.miss('kick confirm', ex)
    # the settings sheet
    if await tap(host, 'عدّل'):
        await wait(0.6)
        await a.shot(host, 'settings-sheet-top')
        await host.evaluate("() => { const d = document.querySelector('.drawer'); if (d) d.scrollTop = 99999 }")
        await wait(0.3)
        await a.shot(host, 'settings-sheet-bottom')
        await tap(host, 'تمام')
    # players sheet, room menu, leave confirm (lobby)
    if await tap(host, 'الكراجات والترتيب'):
        await wait(0.6)
        await a.shot(host, 'players-sheet-lobby-host')
        await tap(host, 'سكّر', exact=True)
    if await tap(host, 'القائمة والخروج'):
        await wait(0.5)
        await a.shot(host, 'room-menu-lobby-host')
        await tap(host, 'اطلع من الصالة')
        await wait(0.3)
        await a.shot(host, 'room-menu-lobby-host-leave-confirm')
        await tap(host, 'خلني')
        await tap(host, 'سكّر', exact=True)
    if await tap(saud, 'القائمة والخروج'):
        await wait(0.5)
        await a.shot(saud, 'room-menu-lobby-player')
        await tap(saud, 'سكّر', exact=True)

    # ---- start ----
    await host.locator('button.btn-gold', has_text='ابدأ').click()
    await wait(0.9)
    await a.shot(host, 'intro-host')
    await a.shot(saud, 'intro-player')
    await a_tv(tvp, 'intro')

    pages = [saud, fahd]
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
        r = await until(saud, ['preview', 'bidding', 'sealed', 'dutch'], lot=n, limit=20)
        k = await kind(saud)
        a.say(f'{time.time() - t0:6.1f}s lot {n} kind {k} saud-wins {wins["saud"]}')

        # ---------- lot 1: the full preview and bidding walk ----------
        if n == 1:
            await until(saud, 'preview', lot=1, limit=20)
            await wait(0.4)
            await a.shot(saud, 'preview-player-console-closed')
            await a.shot(host, 'preview-host')
            await a_tv(tvp, 'preview')
            await tap(host, 'وقف مؤقت')
            await wait(0.6)
            await a.shot(saud, 'preview-player-paused-by-host')
            await a.shot(saud, 'preview-player-full', full=True)
            await sheet_tabs(a, saud, 'car-sheet')
            try:
                await saud.locator('.g-slide').first.click(timeout=1500)
                await wait(0.8)
                await a.shot(saud, 'gallery-viewer')
                await click(saud, '.lb-close')
            except Exception as ex:  # noqa: BLE001
                a.miss('gallery viewer', ex)
            await tap(host, 'كمّل المزاد')
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
            if await click(saud, '.chip-free:not(:disabled)', 800):
                await wait(0.5)
                await a.shot(saud, 'keypad-empty')
                await saud.locator('.drawer input.amount-input').fill('123')
                await wait(0.2)
                await a.shot(saud, 'keypad-too-low')
                await tap(saud, 'رجوع')
            await bid_min(saud)
            await wait(0.08)
            await a.shot(saud, 'bid-sending')
            await wait(0.6)
            await a.shot(saud, 'bid-holding')
            await a_tv(tvp, 'bidding-bid')
            await wait(0.5)
            # فهد throws almost his whole budget: he outbids, wins, and is short of money for the rest of the night
            await free_bid(fahd, 1_400_000)
            await wait(0.45)
            await a.shot(saud, 'bid-outbid')
            await a.shot(fahd, 'free-bid-holding-big')
            await wait(0.3)
            if await click(saud, '.bp-foot button', 800):
                await wait(0.4)
                await a.shot(saud, 'bid-log')
                await tap(saud, 'سكّر', exact=True)
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

        # ---------- lot 2: the host's menu during a car, and the player who wins ----------
        if k == 'open' and 'menu' not in done:
            done.add('menu')
            await until(host, 'preview', lot=n, limit=10)
            if await tap(host, 'القائمة والخروج'):
                await wait(0.4)
                await a.shot(host, 'room-menu-auction-host')
                await tap(host, 'شيل السيارة')
                await wait(0.3)
                await a.shot(host, 'room-menu-skip-confirm')
                await tap(host, 'لا، خلها')
                await tap(host, 'أنهِ المزاد للكل')
                await wait(0.3)
                await a.shot(host, 'room-menu-end-confirm')
                await tap(host, 'لا، كمّل')
                await tap(host, 'اطلع من الصالة')
                await wait(0.3)
                await a.shot(host, 'room-menu-host-leave-confirm')
                await tap(host, 'خلني')
                await tap(host, 'سكّر', exact=True)
            if await tap(saud, 'القائمة والخروج'):
                await wait(0.4)
                await a.shot(saud, 'room-menu-auction-player')
                await tap(saud, 'اطلع من الصالة')
                await wait(0.3)
                await a.shot(saud, 'room-menu-player-leave-confirm')
                await tap(saud, 'خلني')
                await tap(saud, 'سكّر', exact=True)
            await tap(host, 'افتح المزاد الحين')
            await until(saud, 'bidding', lot=n, limit=20)
            await wait(0.3)
            await a.shot(fahd, 'not-enough-money')
            await bid_min(saud)
            await until(saud, ['sold', 'unsold', 'approval'], lot=n, limit=40)
            await wait(0.5)
            await a.shot(saud, 'sold-to-me-0s')
            await wait(2.8)
            await a.shot(saud, 'sold-to-me-3s')
            await a.shot(saud, 'sold-to-me-3s-full', full=True)
            ph2, _ = await phase(saud)
            if ph2 == 'approval':
                await a.shot(saud, 'approval')
            wins['saud'] += 1
            if await tap(saud, 'الكراجات والترتيب'):
                await wait(0.5)
                await a.shot(saud, 'players-sheet-auction')
                try:
                    await saud.locator('.standing').first.click(timeout=1200)
                    await wait(0.4)
                    await a.shot(saud, 'players-sheet-garage-open')
                except Exception as ex:  # noqa: BLE001
                    a.miss('players sheet garage', ex)
                await tap(saud, 'سكّر', exact=True)
            continue

        # ---------- an open car nobody bids on ----------
        if k == 'open' and 'unsold' not in done:
            done.add('unsold')
            await tap(host, 'افتح المزاد الحين')
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
            await tap(host, 'افتح المزاد الحين')
            await until(saud, 'bidding', lot=n, limit=20)
            await wait(0.4)
            await a.shot(saud, 'covered-bidding')
            buyer = saud if wins['saud'] < 3 else host
            await bid_min(buyer)
            if buyer is saud:
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
            await tap(host, 'افتح المزاد الحين')
            await until(saud, 'sealed', lot=n, limit=20)
            await wait(0.5)
            await a.shot(saud, 'sealed-before')
            try:
                await saud.locator('.envelope .bid-chips button').nth(1).click(timeout=1200)
                await wait(0.2)
                await a.shot(saud, 'sealed-amount-picked')
                await tap(saud, 'اختم الظرف')
                await wait(0.6)
                await a.shot(saud, 'sealed-after')
                await host.locator('.envelope .bid-chips button').nth(0).click(timeout=1200)
                await tap(host, 'اختم الظرف')
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
            await tap(host, 'افتح المزاد الحين')
            await until(saud, 'dutch', lot=n, limit=20)
            await wait(0.6)
            await a.shot(saud, 'dutch-falling')
            await a_tv(tvp, 'dutch')
            await wait(3.0)
            await a.shot(saud, 'dutch-falling-3s')
            taker = saud if wins['saud'] < 3 else host
            try:
                await taker.locator('.dutch-panel button.bid-main:not(:disabled), .dutch-panel button.dc-take:not(:disabled)').first.click(timeout=2500)
                if taker is saud:
                    wins['saud'] += 1
            except Exception:  # noqa: BLE001
                try:
                    await taker.locator('.dutch-panel button:not(:disabled)').last.click(timeout=1500)
                except Exception as ex:  # noqa: BLE001
                    a.miss('dutch take', ex)
            await wait(0.6)
            await a.shot(saud, 'dutch-after-take')
            await until(saud, ['sold', 'unsold', 'approval'], lot=n, limit=40)
            await wait(2.6)
            await a.shot(saud, 'dutch-reveal-3s')
            continue

        # ---------- the rest: سعود fills his garage, events on the way ----------
        await tap(host, 'افتح المزاد الحين')
        r = await until(saud, ['bidding', 'sealed', 'dutch'], lot=n, limit=20)
        phn = r[0] if r else ''
        if 'offline' not in done and phn == 'bidding':
            done.add('offline')
            await sctx.set_offline(True)
            await wait(2.5)
            await a.shot(saud, 'offline-2s')
            await wait(4.0)
            await a.shot(saud, 'offline-6s')
            await sctx.set_offline(False)
            await wait(1.0)
            await a.shot(saud, 'reconnect-1s')
            await wait(3.0)
            await a.shot(saud, 'reconnect-4s')
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
            full = 'فل' in ((await saud.locator('.bidpanel').first.inner_text()) if await saud.locator('.bidpanel').count() else '')
            if not full:
                if await bid_min(saud):
                    wins['saud'] += 1
            else:
                wins['saud'] = 3
                await a.shot(saud, 'garage-full')
                await bid_min(host)
        elif phn == 'sealed':
            await host.locator('.envelope .bid-chips button').nth(0).click(timeout=1200)
            await tap(host, 'اختم الظرف')
        elif phn == 'dutch':
            await wait(2)
            await click(host, '.dutch-panel button:not(:disabled)')
        await until(saud, ['sold', 'unsold', 'approval'], lot=n, limit=40)
        if wins['saud'] >= 3 and 'garage-full-sold' not in done:
            done.add('garage-full-sold')
            await wait(2.5)
            await a.shot(saud, 'sold-garage-now-full-3s')
        # once every kind and event is seen and the garage is full, the host ends the night
        need = {'menu', 'unsold', 'covered', 'sealed', 'dutch', 'offline', 'hostreload'}
        if need <= done and wins['saud'] >= 3 and 'garage-full' in a.seen and late is not None:
            break

    for k in ['covered', 'sealed', 'dutch', 'unsold', 'offline', 'hostreload']:
        if k not in done:
            a.miss(k, 'the deck did not offer it before the night ended')
    if 'garage-full' not in a.seen:
        a.miss('garage full', 'سعود never filled three slots before the end')
    ph, _ = await phase(host)
    if ph not in ('showcase', 'voting', 'results'):
        if await tap(host, 'القائمة والخروج'):
            await tap(host, 'أنهِ المزاد للكل')
            await tap(host, 'أنهِ المزاد', exact=True)
    pages_all = [saud, fahd]
    await end_night(a, host, pages_all, tv=tvp)
    if late is not None:
        await a.shot(late, 'results-late-spectator')
    # home after the night: «سجلي» and back to the room
    await host.goto(BASE + '#/')
    await wait(1.5)
    await a.shot(host, 'home-after-night')
    if await tap(host, 'سجلي', 3000):
        await wait(0.8)
        await a.shot(host, 'career-sheet')
        await host.evaluate("() => { const s = document.querySelector('.cr-sheet'); if (s) s.scrollTop = 9999 }")
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
    code = await create_room(a, host, 'نايف', lots=('+', '-', '-'), shots=False)
    sctx, saud = await join(b, a, code, 'سعود', W, H)
    await wait_players(host, 2)
    await wait(1.2)
    await a.shot(host, 'lobby-host')
    await a.shot(saud, 'lobby-player')
    await host.locator('button.btn-gold', has_text='ابدأ').click()
    await until(saud, 'preview', lot=1, limit=30)
    await wait(0.4)
    await a.shot(saud, 'preview')
    await tap(host, 'وقف مؤقت')
    await sheet_tabs(a, saud, 'car-sheet')
    await tap(host, 'كمّل المزاد')
    await until(saud, 'bidding', lot=1, limit=20)
    await wait(0.5)
    await a.shot(saud, 'bidding-console-open')
    await a.shot(host, 'bidding-host')
    if await click(saud, '.chip-free:not(:disabled)', 800):
        await wait(0.5)
        await saud.locator('.drawer input.amount-input').fill('250000')
        await a.shot(saud, 'keypad')
        await tap(saud, 'رجوع')
    await bid_min(saud)
    await wait(0.6)
    await a.shot(saud, 'bid-holding')
    await bid_min(host)
    await wait(0.4)
    await a.shot(saud, 'bid-outbid')
    await until(saud, ['sold', 'unsold', 'approval'], lot=1, limit=40)
    await wait(0.6)
    await a.shot(saud, 'reveal-0s')
    await wait(2.6)
    await a.shot(saud, 'reveal-3s')
    await a.shot(host, 'reveal-host-3s')
    if await tap(host, 'القائمة والخروج'):
        await tap(host, 'أنهِ المزاد للكل')
        await tap(host, 'أنهِ المزاد', exact=True)
    await end_night(a, host, [saud, saud])
    await b.close()
    a.close()


async def stress_run(p):
    a = Atlas('stress')
    W, H = 390, 844
    b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    names = ['عبدالرحمن بن سلطان ال', 'محمد عبدالعزيز الفهيد', 'سلطان بن عبدالمحسن ال']  # 20+ characters each
    _, host = await new_page(b, a, 'host', W, H)
    code = await create_room(a, host, names[0], budget=9_999_999, shots=False)
    a.say('typed name length', len(names[0]), 'stored', len(await host.inner_text('.player-row .name')))
    p1ctx, p1 = await join(b, a, code, names[1], W, H)
    p2ctx, p2 = await join(b, a, code, names[2], W, H)
    await wait_players(host, 3)
    await wait(1.2)
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
            if wins < 3:
                if wins == 0:
                    await free_bid(p1, 2_350_000)
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
            await p1.locator('.envelope .bid-chips button').nth(2).click(timeout=1200)
            await tap(p1, 'اختم الظرف')
            await wait(0.4)
            await a.shot(p1, 'sealed-sealed-seven-digit')
        elif phn == 'dutch':
            await wait(0.6)
            await a.shot(p1, 'dutch-seven-digit-budget')
        await until(p1, ['sold', 'unsold', 'approval'], lot=n, limit=60)
        await wait(2.8)
        await a.shot(p1, f'reveal-lot{n}-3s')
        if wins >= 3 and 'garage-full-long-names' in a.seen:
            break
    if await tap(p1, 'الكراجات والترتيب'):
        await wait(0.5)
        await a.shot(p1, 'players-sheet-long-names')
        await tap(p1, 'سكّر', exact=True)
    if await tap(host, 'القائمة والخروج'):
        await tap(host, 'أنهِ المزاد للكل')
        await tap(host, 'أنهِ المزاد', exact=True)
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
    import json
    a = Atlas('measure')
    W, H = 390, 844
    b = await p.chromium.launch()
    _, host = await new_page(b, a, 'host', W, H)
    res = []
    await host.goto(BASE + '#/')
    await wait(1.5)
    res.append(await host.evaluate(MEASURE_JS, 'home'))
    await host.goto(BASE + '#/new')
    await wait(1.0)
    res.append(await host.evaluate(MEASURE_JS, 'create-top'))
    code = await create_room(a, host, 'نايف', shots=False)
    _, saud = await join(b, a, code, 'سعود', W, H)
    await wait_players(host, 2)
    await wait(1.0)
    res.append(await host.evaluate(MEASURE_JS, 'lobby-host'))
    res.append(await saud.evaluate(MEASURE_JS, 'lobby-player'))
    await tap(host, 'عدّل')
    await wait(0.5)
    res.append(await host.evaluate(MEASURE_JS, 'settings-sheet'))
    await tap(host, 'تمام')
    await host.locator('button.btn-gold', has_text='ابدأ').click()
    await until(saud, 'preview', lot=1, limit=30)
    await wait(0.5)
    res.append(await saud.evaluate(MEASURE_JS, 'preview-player'))
    res.append(await host.evaluate(MEASURE_JS, 'preview-host'))
    await until(saud, 'bidding', lot=1, limit=30)
    await wait(0.5)
    res.append(await saud.evaluate(MEASURE_JS, 'bidding-player'))
    res.append(await host.evaluate(MEASURE_JS, 'bidding-host'))
    await bid_min(saud)
    await wait(0.6)
    res.append(await saud.evaluate(MEASURE_JS, 'holding-player'))
    with open(os.path.join(a.dir, 'measure.json'), 'w') as f:
        json.dump(res, f, ensure_ascii=False, indent=1)
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
        elif MODE == 'small':
            await small_run(p, 360, 740, '360')
            await small_run(p, 320, 640, '320')
        elif MODE == 'stress':
            await stress_run(p)
        elif MODE == 'measure':
            await measure_run(p)


if MODE == 'sheets':
    contact_sheets()
else:
    asyncio.run(run())
