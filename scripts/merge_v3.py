#!/usr/bin/env python3
"""v3 Haraj merge: every real ad becomes one auction car with its own facts.

Inputs
  research/cars_*.json                researched catalogue (minus cars_haraj_new.json, which this script writes)
  research/haraj_ads.json             ads found by the research agent, keyed by catalogue id
  <pack>/cars.json                    ChatGPT Haraj pack v2 (386 ads; replaces the earlier 175-ad file)
  research/haraj_specs.py             hand-checked specs and values for model-years the research didn't cover
Outputs
  research/haraj_all.json             {"ads": {catalogue_id: [ad, ...]}} — one entry per real ad, deduped
  research/cars_haraj_new.json        catalogue entries for the model-years only the ads cover
  research/haraj_merge_report.md      every ad that was dropped and why
"""
import json
import math
import re
import statistics
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, '/home/claude/research')
import build_catalogue as bc  # noqa: E402
from haraj_maps import MAKE_EN, MODEL  # noqa: E402
from haraj_specs import (  # noqa: E402
    AD_DROP, AD_SPECS, AGENT_DROP, ENGINE_ALTS, FUEL_SPECS, MODEL_FIX, NEW_SPECS, OVERRIDE, TRIM_SPECS, YEAR_FIX,
)

RESEARCH = Path('/home/claude/research')
PACK = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('/tmp/claude-0/-home-claude/15da4d35-95ca-511f-947e-484db8ab0656/scratchpad/gpt2/x/cars.json')
NOW = 2026
PER_YEAR_KM = {'luxury': 15000, 'sport': 11000, 'exotic': 6000, 'classic': 9000}
report = []


def say(x):
    report.append(f'- {x}')


# ------------------------------------------------------------------ catalogue
cat = []
_seen = {}
for fn in sorted(RESEARCH.glob('cars_*.json')):
    if fn.name == 'cars_haraj_new.json':
        continue
    data = json.loads(fn.read_text(encoding='utf-8'))
    for e in (data['entries'] if isinstance(data, dict) else data):
        o, _ = bc.convert(e, _seen)
        if o:
            _seen[o['id']] = True
            cat.append(o)
by_id = {c['id']: c for c in cat}
by_key = {}
for c in cat:
    by_key.setdefault((c['makeEn'], c['modelEn'], c['year']), []).append(c)


def norm_en(s):
    return re.sub(r'[^a-z0-9]', '', (s or '').lower())


def post_id(url):
    m = re.search(r'haraj\.com\.sa/(\d{8,})', url or '')
    return m.group(1) if m else None


def img_path(u):
    m = re.match(r'https://(?:mimg\d*cdn|postcdn)\.haraj\.com\.sa/(.+?)(?:-700\.webp)?$', u or '')
    return m.group(1) if m else None


# ------------------------------------------------------------------ what an ad says about the car
PHONE = re.compile(r'(\+?966|0)?5\d{8}')
EMOJI = re.compile('[\U0001F000-\U0001FFFF☀-➿️]')


def clean_line(x):
    x = PHONE.sub('', x or '')
    x = EMOJI.sub('', x)
    x = re.sub(r'[​-‏‪-‮⁠﻿]', '', x)  # invisible joiners/direction marks from copy-paste
    x = re.sub(r'\s*\|\s*', '، ', x)
    x = re.sub(r'\s+', ' ', x).strip(' -–•*،.')
    return x


def km_of(text):
    if not text:
        return None
    t = str(text).replace('٬', ',')
    m = re.search(r'(\d[\d,\.]*)\s*(ألف|الف|K\b|k\b)', t)
    if m:
        try:
            return int(float(m.group(1).replace(',', '')) * 1000)
        except ValueError:
            return None
    m = re.search(r'(\d{4,7})', t.replace(',', ''))
    return int(m.group(1)) if m else None


GEAR = r'(?:قير|جير|ناقل(?:\s+ال)?حركة)'


def trans_of(*texts):
    """The gearbox the ad names. «يدوي/اوتوماتيك» only count next to the gearbox word or as Haraj's own form
    value: «مكيف يدوي» is the air conditioning, not a manual Hilux."""
    mt = at = False
    for x in texts:
        s = (x or '').strip()
        if not s:
            continue
        if s in ('يدوي', 'عادي', 'manual', 'Manual'):
            mt = True
            continue
        if re.fullmatch(r'[اأ]وتوماتيك|[اأ]وتماتيك|اتوماتيك|automatic', s, re.I):
            at = True
            continue
        if re.search(GEAR + r'\s*[:：/-]?\s*(?:يدوي|عادي|مانيوال)|مانيوال|\bmanual\b', s, re.I):
            mt = True
        if re.search(GEAR + r'\s*[:：/-]?\s*(?:[اأ]وتوماتيك|[اأ]وتماتيك|اتوماتيك|تماتيك|تبترونك)|\bautomatic\b'
                     r'|(?<!مكيف )(?<!تكييف )(?<!مكيفات )(?:[اأ]وتوماتيك|[اأ]وتماتيك|اتوماتيك|تماتيك)', s, re.I):
            at = True
    return 'MT' if mt and not at else 'AT' if at and not mt else None


def hp_said(*texts):
    """The horsepower an ad states («420 حصان»، «190HP»), when it states exactly one."""
    found = set()
    for t in texts:
        for m in re.finditer(r'(?<![\d.])(\d{2,4})\s*(?:حصان|حصانا|خيل|bhp\b|hp\b)', t or '', re.I):
            v = int(m.group(1))
            if 60 <= v <= 1600:
                found.add(v)
    return found.pop() if len(found) == 1 else None


def fuel_of(*texts):
    t = ' '.join(x for x in texts if x)
    if re.search(r'ديزل|diesel', t, re.I):
        return 'diesel'
    if re.search(r'هايبرد|هايبرد|هجين|hybrid', t, re.I):
        return 'hybrid'
    if re.search(r'بنزين', t):
        return 'petrol'
    return None


def cab_of(*texts):
    t = ' '.join(x for x in texts if x)
    if re.search(r'غمارتين|دبل كابين|دبل غماره|crew\s*cab|double\s*cab|4\s*أبواب|٤ أبواب', t, re.I):
        return 'double'
    if re.search(r'غماره(?!\s*وربع)|غمارة(?!\s*وربع)|سنقل|single\s*cab|regular\s*cab', t, re.I) and not re.search(r'غمارتين', t):
        return 'single'
    return None


# families sold in Saudi with a diesel: a «ديزل» ticked in Haraj's form for anything else (a Yaris,
# an Expedition) is the seller's slip, not the car
DIESEL_FAMILIES = {k[:2] for k in FUEL_SPECS if k[2] == 'diesel'} | {
    ('Nissan', 'Urvan'), ('Toyota', 'Hiace'), ('Isuzu', 'D-Max'), ('Mitsubishi', 'L200'), ('Kia', 'Tasman'), ('Ford', 'Ranger'),
    ('Ford', 'F-350'), ('Changan', 'Hunter'), ('Nissan', 'Pickup (Datsun)'), ('Toyota', 'Land Cruiser 79 Double Cab'),
    ('Toyota', 'Land Cruiser 76 Hardtop'), ('Kia', 'Sorento'), ('Hyundai', 'Santa Fe'), ('Mitsubishi', 'Pajero'),
}


def engine_alt(make_en, model_en, year, cyl=None, disp=None):
    """The one engine of this family/model-year that fits the cylinders and/or size the ad states, else None."""
    if not cyl and not disp:
        return None
    hits = [x for x in ENGINE_ALTS.get((make_en, model_en), [])
            if x['years'][0] <= year <= x['years'][1]
            and (not cyl or x['cyl'] == cyl) and (not disp or abs(x['disp'] - disp) < 0.15)]
    return hits[0] if len(hits) == 1 else None


def pack_fuel(make_en, model_en, said_in_text, said_in_form):
    if said_in_text:
        return said_in_text
    if said_in_form == 'diesel' and (make_en, model_en) not in DIESEL_FAMILIES:
        return None
    return said_in_form


def damaged_of(t):
    """The ad says the car is crashed/rolled/burnt — and doesn't say it isn't («غير مصدومة»)."""
    for m in re.finditer(r'مصدوم|مقلوب|حادث قوي|للتشليح|يصلح تشليح|محترق', t or ''):
        before = (t or '')[max(0, m.start() - 8):m.start()]
        if not re.search(r'(غير|مو|مب|ما|بدون|ليس|ليست|ماهي|ماهو|ولا)\s*$', before):
            return True
    return False


def drive_of(*texts):
    """Saudi usage: «دبل» after a truck/SUV name means 4x4 (not double cab — that is «غمارتين»).
    «دفع خلفي/امامي» names the driven wheels outright. An ad that says both kinds says nothing."""
    t = ' '.join(x for x in texts if x)
    two = re.search(r'(بدون|غير|مو|ماهو|ماهي|مب|مش)\s*دبل|دفع ثنائي|\b4\s*[xX×]\s*2\b|\b2WD\b', t)
    rear = re.search(r'دفع\s*خلف[يى]|\bRWD\b', t)
    front = re.search(r'دفع\s*[اأ]مام[يى]|\bFWD\b', t)
    four = re.search(r'(?<!بدون )(?<!غير )(?<!مو )(?<!مب )(?<!مش )دبل(?!\s*(كابين|كبينه|كبينة|غمار|قمار))'
                     r'|دفع رباعي|دفع كلي|\b4\s*[xX×]\s*4\b|\b4WD\b|فور ويل', t)
    if (two or rear or front) and not four:
        return 'RWD' if rear and not front else 'FWD' if front and not rear else '2WD'
    if four and not (two or rear or front):
        return '4WD'
    return None


CYL_WORDS = {'اربع': 4, 'أربع': 4, 'اربعة': 4, 'أربعة': 4, 'ست': 6, 'ستة': 6, 'سته': 6, 'ثمان': 8, 'ثمانية': 8, 'ثمانيه': 8}


def cyl_said(*texts):
    """The cylinder count an ad states («6 سلندر»، «V8»، «W12»), when it states exactly one."""
    found = set()
    for t in texts:
        if not t:
            continue
        for m in re.finditer(r'(?<![\d.])(\d{1,2})\s*(?:سلندر|سلندرات|سليندر)', t):
            found.add(int(m.group(1)))
        for m in re.finditer(r'(?<![A-Za-z])[VW]\s?(6|8|10|12)(?![\d])', t):
            found.add(int(m.group(1)))
        for w, n in CYL_WORDS.items():
            if re.search(rf'(?:^|\s){w}\s*(?:سلندر|سليندر)', t):
                found.add(n)
    found = {n for n in found if n in (3, 4, 5, 6, 8, 10, 12)}
    return found.pop() if len(found) == 1 else None


DISP_RX = re.compile(
    r'(?:مكين[هة]|ماكين[هة]|محرك|المحرك|المكين[هة])\s*[:：]?\s*(?:(\d\.\d)(?!\d)|([1-6][0-9]00)(?!\d))'
    r'|(\d\.\d)\s*(?:تيربو|توربو|لتر)|([1-6][0-9]00)\s*(?:سي\s?سي|cc|تيربو|توربو)')


def disp_said(*texts):
    """The engine size an ad states («مكينة 1.6»، «1600 تيربو»، «محرك 2500»), when it states exactly one."""
    found = set()
    for t in texts:
        for m in DISP_RX.finditer(t or ''):
            d, cc, d2, cc2 = m.groups()
            v = float(d or d2) if (d or d2) else int(cc or cc2) / 1000
            if 0.9 <= v <= 7.0:
                found.add(round(v, 1))
    return found.pop() if len(found) == 1 else None


def cyl_of_engine(s):
    m = re.search(r'(?<![A-Za-z])[VW](\d{1,2})(?![\d])', s or '')
    if m:
        return int(m.group(1))
    m = re.search(r'(\d{1,2})\s*سلندر', s or '')
    return int(m.group(1)) if m else None


COLOR_WORDS = [
    (r'لؤلؤ|لولو|بيرل|pearl', 'أبيض لؤلؤي'), (r'ابيض|أبيض|white', 'أبيض'), (r'فضي|سلفر|silver', 'فضي'),
    (r'رصاصي|رمادي|جراي|سكني|grey|gray', 'رصاصي'), (r'اسود|أسود|black', 'أسود'), (r'شمباني|ذهبي', 'شمباني'),
    (r'بيج', 'بيج'), (r'عنابي|ماروني|خمري', 'عنابي'), (r'كحلي', 'كحلي'), (r'احمر|أحمر|red\b', 'أحمر'),
    (r'ازرق|أزرق|blue', 'أزرق'), (r'زيتي|اخضر|أخضر|green', 'أخضر زيتي'), (r'بني', 'بني'), (r'برتقالي|orange', 'برتقالي'),
    (r'اصفر|أصفر|yellow', 'أصفر'),
]


def color_of(*texts):
    for t in texts:
        if not t:
            continue
        m = re.search(r'اللون\s*[:：]?\s*([^\n،,.]{2,40})', t)
        s = m.group(1) if m else (t if len(t) < 90 else None)
        if not s:
            continue
        for pat, key in COLOR_WORDS:
            if re.search(pat, s, re.I):
                return key
    return None


def plausible_price(p, title=''):
    if not isinstance(p, (int, float)) or p < 3000 or p > 30_000_000:
        return None
    s = str(int(p))
    if re.fullmatch(r'(\d)\1{3,}', s):  # 555555, 1111111 — placeholders
        return None
    if re.search(r'دفعة|قسط|تمويل|شهري', title or ''):
        return None
    return int(p)


TRIM_CODES = re.compile(
    r'\b(LTZ|LT|LS|LE|SE|SEL|XLE|XLI|GLX|GL|GXR|VXR|VXS|VX|TXL|EXR|GXL|LX|EX|SX|S|Z71|RST|High Country|Premier|Denali|AT4|SLE|SLT|'
    r'Platinum|Limited|Sport|Titanium|Signature|Black Badge|Performante|Competition|Carrera S|Turbo S|Turbo|GTS|GT|RS|AMG|M Sport|'
    r'\d{3}[iId]|\d{3}Li|Nismo|Pro-?4X|SV|SL|SR|Smart|Comfort|Luxury|Flagship|Premium|Elite)\b', re.I)


# performance trims sellers write in Arabic; shown with their English names
ARABIC_TRIMS = [
    (r'ريد\s?اي', 'Hellcat Redeye'), (r'هيل\s?كات|هلكات|هيلكات', 'Hellcat'), (r'سكات\s?باك|سكاتباك|سكات', 'Scat Pack'),
    (r'شلبي|شيلبي', 'Shelby GT500'), (r'تراك\s?هوك', 'Trackhawk'), (r'دينالي|دنالي', 'Denali'), (r'هاي\s?كنتري', 'High Country'),
    (r'بلاتينيوم|بلاتينوم|بلاتنيوم', 'Platinum'), (r'نيسمو', 'Nismo'), (r'بلاك\s?بادج', 'Black Badge'),
    (r'بيرفورمانتي|برفورمانتي|بيرفومانتي', 'Performante'), (r'توربو\s?اس|تيربو\s?اس', 'Turbo S'),
    (r'كاريرا\s?اس|كريرا\s?اس', 'Carrera S'), (r'كومبتشن|كومبيتشن|كومبتيشن', 'Competition'),
    (r'\bار\s?تي\b|آر\s?تي', 'R/T'), (r'رابتر', 'Raptor'),
]
PERF_TRIMS = re.compile(r'\b(Hellcat Redeye|Redeye|Hellcat|Scat ?Pack|SRT|R/T|GT500|Shelby|Trackhawk|SS|ZL1|Raptor|TRX|GR[\s-]?Sport|GR-S)\b', re.I)


LEXUS_NO = re.compile(r'\b(?:ES|LS|GS|IS|RX|NX)\s?-?(\d{3})\s?(h)?\b', re.I)


def trim_hint(*texts):
    for t in texts:
        if not t:
            continue
        m = LEXUS_NO.search(t)
        if m:
            return m.group(1) + ('H' if m.group(2) else '')
        m = PERF_TRIMS.search(t)
        if m:
            f = m.group(1)
            if re.fullmatch(r'GR[\s-]?Sport|GR-S', f, re.I):
                return 'GR Sport'
            return {'redeye': 'Hellcat Redeye', 'scatpack': 'Scat Pack', 'scat pack': 'Scat Pack', 'shelby': 'Shelby GT500'}.get(f.lower(), f if len(f) > 3 else f.upper())
        for pat, name in ARABIC_TRIMS:
            if re.search(pat, t):
                return name
        found = [m.group(1) for m in TRIM_CODES.finditer(t)]
        found = [f for f in found if not re.fullmatch(r's|S|gt|GT', f) or len(found) == 1]
        if found:
            f = found[0]
            return f.upper() if len(f) <= 4 and not re.search(r'\d', f) else f
    return None


# a form label with no value («اللون الخارجي»، «المواصفات:»), the model year again, or a bare city says nothing
LABEL_ONLY = re.compile(
    r'^(?:ال)?(?:موديل(?: ال?سيار[هة])?|عداد|ممشى|لون(?: ال?(?:خارجي|داخلي))?|مواصفات|وكيل|نوع الوقود|قير|مكين[هة]|محرك|'
    r'حال[هة]|ملاحظات|تفاصيل|مميزات|وصف|نوع ال?سيار[هة]|فئ[هة]|بيانات ال?سيار[هة])\s*[:：_\-]*\s*(?:\d{4})?\s*$')
# a section heading («المعلومات والمواصفات الفنية»، «معلومات عن ضمان السيارة») or the make/model/trim said again
HEADING = re.compile(
    r'^(?:ال)?معلومات\b|المواصفات الفنية|^نبذ[هة]\b|^وصف ال?سيار[هة]'
    r'|^(?:نوع\s+)?(?:ال)?(?:سيار[هة]|مركب[هة]|فئ[هة])\s*[:：]?\s*\S+(?:\s+\S+){0,3}$')
SPEC_SAID = re.compile(r'^(?:ال)?(?:محرك|مكين[هة])\s*[:：]?\s*\d{1,2}\s*سلندر$|^سع[هة] (?:ال)?(?:محرك|مكين[هة])\s*[:：]?\s*[\d.]+\s*(?:L|لتر)?$')
# the end of a text the source cut short («العداد: 191 ال»): drop the broken word, say it goes on
CUT_TAIL = re.compile(r'\s(?:ال|لل|ك|ب|و|ف|ل|با|وا)$')
# Haraj's own form fields copied into the text («قير اوتماتيك»، «نوع الوقود: بنزين»، «8 سلندر») — the card already shows them
SPEC_ONLY = re.compile(
    r'^(?:(?:ال)?قير|ناقل الحركة)?\s*[:：]?\s*(?:[اأ]وتوماتيك|[اأ]وتماتيك|تماتيك|عادي|يدوي)(?:\s*[،,-]?\s*(?:بنزين|ديزل|هايبرد))?$'
    r'|^(?:نوع\s)?(?:ال)?وقود\s*[:：]?\s*(?:بنزين|ديزل|هايبرد|كهرباء|كهربائي)$'
    r'|^(?:ال)?لون(?:\s(?:ال)?خارجي)?\s*[:：]?\s*\S+$'
    r'|^(?:ال)?(?:ممشى|ممشي|عداد)\s*[:：]?\s*[\d,.]+\s*(?:ألف|الف)?\s*(?:كم|كيلو)?$'
    r'|^\d{1,2}\s*سلندر$|^دفع (?:رباعي|ثنائي|خلفي|أمامي|امامي)(?:\s+\w+)?$')
BARE_CITY = re.compile(r'^(?:في\s|ب)?(?:الرياض|جد[هة]|الدمام|الخبر|الظهران|مك[هة]|المدين[هة]|الطائف|تبوك|ابها|أبها|بريد[هة]|القصيم|'
                       r'حائل|جازان|جيزان|نجران|الاحساء|الأحساء|ينبع|الجبيل|خميس مشيط|عنيز[هة]|الخرج|القطيف|حفر الباطن|عرعر|الباح[هة])$')


def _pieces(t):
    """Sellers separate their points with new lines, full stops, dashes, bullets or slashes; a long run of
    points joined by commas is cut at the commas and packed back into readable lines."""
    for part in re.split(r'[\n\r]+|(?<=[.!؟?])\s+|\s[–—-]\s|\s/\s|[•▪◾●✓✔]|\s\*\s?|\|', t or ''):
        if len(part) <= 120:
            yield part
            continue
        line = ''
        for frag in re.split(r'\s*[،,]\s*', part):
            frag = frag.strip()
            if not frag or len(frag.split()) < 2 or SPEC_ONLY.match(frag) or LABEL_ONLY.match(frag):
                continue  # «اتوماتيك»، «بنزين»، «مستعملة» on their own
            if line and len(line) + len(frag) + 2 > 100:
                yield line
                line = frag
            else:
                line = f'{line}، {frag}' if line else frag
        if line:
            yield line


def lines_of(texts, limit=5):
    out = []
    for t in texts:
        for part in _pieces(t):
            x = clean_line(part)
            if CUT_TAIL.search(x):
                x = CUT_TAIL.sub('', x).rstrip(' ،,:') + '…'
            if len(x) < 6 or len(x) > 120 or len(x.split()) < 2:
                continue
            bare = x.replace('ـ', '').replace('⁠', '')
            if bare.endswith((':', '：')) or any(rx.match(bare) for rx in (LABEL_ONLY, BARE_CITY, SPEC_ONLY, SPEC_SAID)) or HEADING.search(bare):
                continue
            if re.search(r'ريال|سعر|السوم|سوم|الحد|حده|(?:^|\s)حد\s*\d|للتواصل|تواصل|واتس|جوال|اتصال|رقم|@|http|حراج|كاش وقسط|تمويل|الموقع|موقع|شامل الضريبة', x):
                continue
            # a showroom's standing offer, not this car
            if re.search(r'نرحب ب|يتوفر الشحن|الشحن (?:متوفر|لجميع)|لجميع مناطق المملكة|نستقبل (?:عملاء|طلبات)', x):
                continue
            if x not in out:
                out.append(x)
            if len(out) >= limit:
                return out
    return out


def patrol_fix(ad):
    """«باترول فتك/سفاري/4800» is the Y61 Super Safari, not the Y62/Y63 Patrol."""
    t = f"{ad.get('title') or ''} {(ad.get('text') or '')[:200]}"
    if ad['model'] == 'Patrol' and re.search(r'فتك|سفاري|سوبر\s?سفاري|\b4800\b', ad.get('title') or ''):
        ad['model'] = 'Patrol Super Safari'
        ad.pop('cid', None)
        ad.pop('target', None)
    if ad['model'] == 'Patrol' and ad['year'] >= 2025 and re.search(r'تنفس طبيعي|بدون تيربو|3\.8', t):
        ad['engine'], ad['hp'] = '3.8L V6', 316


def long_trim(ad):
    """«يوكن XL» and «تاهو طويل» are the long-wheelbase trucks: say so, the photos show it."""
    t = ad.get('title') or ''
    if ad['model'] in ('Yukon', 'Tahoe', 'Suburban') and re.search(r'\bXL\b', t, re.I):
        ad['trim'] = 'XL'
    elif ad['model'] in ('Yukon', 'Tahoe') and re.search(r'طويل', t):
        ad['trim'] = 'طويل'


# ------------------------------------------------------------------ the pool
pool = {}       # post id -> ad record
img_owner = {}  # image path -> post id


def put(ad):
    pid = ad['pid']
    paths = [p for p in ad['paths'] if p not in img_owner]
    if len(paths) < 3:
        return 'too-few-unique-photos'
    if pid in pool:
        return 'dup-post'
    ad['paths'] = paths[:10]
    for p in ad['paths']:
        img_owner[p] = pid
    pool[pid] = ad
    return 'ok'


# 1) the ChatGPT pack (authoritative for the ids it has)
pack = json.loads(PACK.read_text(encoding='utf-8'))['cars']
for c in pack:
    pid = str(c['id'])
    why = None
    if pid in AD_DROP:
        why = AD_DROP[pid]
    elif c.get('is_import_or_order'):
        why = 'import/order offer'
    elif c.get('is_transfer') or c.get('sale_type') == 'تنازل':
        why = 'تنازل'
    elif any('لم تعتمد سنة نهائية' in q for q in c['quality_notes']):
        why = 'year not settled'
    elif any('قطع الغيار' in q for q in c['quality_notes']):
        why = 'listed under parts'
    if why:
        say(f'pack {pid} «{c["title"]}»: {why}')
        continue
    mk = MAKE_EN.get(c['make'])
    year = YEAR_FIX.get(pid)
    conv = re.search(r'موديل\s*(19\d\d|20\d\d)\s*محول[ةه]?\s*(?:ل\s*)?(19\d\d|20\d\d)', c.get('title') or '')
    if not year and conv:
        year = int(conv.group(1))  # «موديل 1999 محول 2002»: the car is the older year with a newer face
    year = year or c.get('year')
    if year != c.get('year'):
        say(f'pack {pid} «{c["title"]}»: model year {year} (Haraj header says {c.get("year")})')
    key = MODEL_FIX.get((mk, c['model'], year)) or MODEL_FIX.get((mk, c['model'])) or MODEL.get((mk, c['model']))
    if key and len(key) == 3 and key[0] is None:
        say(f'pack {pid} «{c["title"]}»: model-year not reliable')
        continue
    if not mk or not key or not year:
        say(f'pack {pid} «{c["title"]}»: unmapped {c["make"]} {c["model"]} {year}')
        continue
    if isinstance(key, tuple) and len(key) == 3:
        mk, model_en, tr = key
    else:
        model_en, tr = key
    paths = [p for p in (img_path(u) for u in c['image_urls']) if p]
    sel = img_path(c.get('selected_image_url'))
    if sel and c.get('curated_gallery') and sel in paths:
        paths.remove(sel)
        paths.insert(0, sel)
    paths = list(dict.fromkeys(paths))
    seller = c.get('features_as_seller_claims') or []
    feats = c.get('features_mentioned') or []
    texts = [c.get('title'), c.get('trim_as_listed'), ' '.join(seller)]
    ad = {
        'pid': pid, 'src': 'pack', 'url': f'https://haraj.com.sa/{pid}', 'title': clean_line(c.get('title')),
        'make': mk, 'model': model_en, 'year': int(year), 'trim': tr or trim_hint(c.get('trim_as_listed'), c.get('title'), ' '.join(seller[:2])),
        'city': (c.get('city') or '').strip() or None,
        'km': c.get('mileage_km') if isinstance(c.get('mileage_km'), int) and 0 <= c['mileage_km'] < 2_000_000 else km_of(c.get('mileage_as_listed')),
        'price': plausible_price(c.get('price_sar'), c.get('title')),
        'trans': trans_of(c.get('transmission'), *texts), 'fuel': pack_fuel(mk, model_en, fuel_of(*texts), fuel_of(c.get('fuel'), c.get('engine_as_listed'))),
        'cab': cab_of(*texts), 'drive': drive_of(*texts), 'color': color_of(*seller, c.get('title')),
        'new': c.get('condition') == 'جديد', 'damaged': bool(c.get('is_damaged_or_repair') or c.get('damage_flag_in_title')),
        'feats': [f for f in feats if isinstance(f, str)][:8],
        'lines': lines_of(seller) if seller else [],
        'paths': paths, 'curated': bool(c.get('curated_gallery')), 'notes': c.get('quality_notes') or [],
    }
    ad.update(AD_SPECS.get(pid, {}))
    long_trim(ad)
    patrol_fix(ad)
    r = put(ad)
    if r != 'ok':
        say(f'pack {pid} «{c["title"]}»: {r}')

# 2) the research agents' ads (filed under the catalogue family they belong to)
agent = {}
for fn in [RESEARCH / 'haraj_ads.json', *sorted((RESEARCH / 'new_ads').glob('*.json'))]:
    if not fn.exists():
        continue
    for cid, ads in json.loads(fn.read_text(encoding='utf-8'))['ads'].items():
        agent.setdefault(cid, []).extend(ads)
for cid, ads in agent.items():
    e = by_id.get(cid)
    if not e:
        say(f'agent: unknown catalogue id {cid} ({len(ads)} ads)')
        continue
    for a in ads:
        pid = post_id(a.get('url'))
        if not pid:
            continue
        try:
            ay = int(a.get('year'))
        except (TypeError, ValueError):
            ay = e['year']
        if (cid, ay) in AGENT_DROP or pid in AD_DROP:
            say(f'agent {pid} ({cid}): {AD_DROP.get(pid, "different generation")}')
            continue
        text = a.get('text') or ''
        ad = {
            'pid': pid, 'src': 'agent', 'url': f'https://haraj.com.sa/{pid}', 'title': clean_line(a.get('title')),
            # the ad's own model year: same year -> the researched entry; another year -> a checked clone of the family
            'make': e['makeEn'], 'model': e['modelEn'], 'year': ay, 'target': cid, **({'cid': cid} if ay == e['year'] else {}),
            'trim': trim_hint(a.get('title'), text[:160]), 'city': a.get('city'),
            'km': a.get('km') if isinstance(a.get('km'), int) else km_of(a.get('km')),
            'price': plausible_price(a.get('price'), a.get('title')),
            'trans': trans_of(a.get('title'), text), 'fuel': fuel_of(a.get('title'), text), 'cab': cab_of(a.get('title'), text),
            'drive': drive_of(a.get('title'), text),
            'color': color_of(a.get('color'), a.get('title')), 'new': False,
            'damaged': damaged_of(f'{a.get("title")} {text}'),
            'feats': [], 'lines': lines_of([text]), 'text': text,
            'paths': [p for p in (img_path(u) for u in a.get('imgs') or []) if p], 'curated': False, 'notes': [],
        }
        # the researcher noted the cab word the ad itself uses (a «CREW CAB» RAM is غمارتين)
        if not ad['cab'] and a.get('cab') in ('غمارة', 'غماره', 'غمارتين'):
            ad['cab'] = 'double' if a['cab'] == 'غمارتين' else 'single'
        ad.update(AD_SPECS.get(pid, {}))
        long_trim(ad)
        patrol_fix(ad)
        r = put(ad)
        if r != 'ok':
            say(f'agent {pid} ({cid}): {r}')

# 3) one car posted twice (same seller, same car, sometimes different photos): keep the fuller ad.
#    «لا تستخدم صور إعلانات مختلفة لنفس السيارة» — never mix two ads' photos, never show the car twice.
def _tnorm(t):
    return re.sub(r'[\s\-–_.,،:()«»"]+', '', t or '')


groups = {}
for pid, ad in pool.items():
    base = (ad['make'], ad['model'], ad['year'], (ad.get('city') or '').strip())
    tn = _tnorm(ad.get('title'))
    if ad.get('km'):
        # an exact odometer reading is a fingerprint; a round one (200,000) only with the same title
        groups.setdefault(base + ('km', ad['km']) + (() if ad['km'] % 5000 else (tn,)), []).append(pid)
    if len(tn) >= 16:
        groups.setdefault(base + ('title', tn), []).append(pid)
    if ad.get('price') and tn:
        groups.setdefault(base + ('price', ad['price'], tn), []).append(pid)
for key, pids in groups.items():
    alive = [p for p in pids if p in pool]
    if len(alive) < 2:
        continue
    alive.sort(key=lambda p: (-len(pool[p]['paths']), p))
    for p in alive[1:]:
        say(f'{pool[p]["src"]} {p} «{pool[p]["title"]}»: same car as {alive[0]} ({key[4]} matches) — dropped')
        for path in pool[p]['paths']:
            img_owner.pop(path, None)
        del pool[p]

# ------------------------------------------------------------------ catalogue entry for every ad
new_entries = {}


def year_rate(make_en, model_en, tier, trim=None):
    pts = [(c['year'], c['value']) for c in cat if c['makeEn'] == make_en and c['modelEn'] == model_en]
    if trim is not None:
        # a family with very different trims (Challenger GT vs Hellcat) depreciates per trim
        same = [(c['year'], c['value']) for c in cat if c['makeEn'] == make_en and c['modelEn'] == model_en and norm_en(c['trim']) == norm_en(trim)]
        pts = same if len(same) >= 2 else []
    if len(pts) >= 2:
        xs = [p[0] for p in pts]
        ys = [math.log(p[1]) for p in pts]
        mx, my = statistics.mean(xs), statistics.mean(ys)
        den = sum((x - mx) ** 2 for x in xs)
        if den:
            slope = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / den
            return max(0.03, min(0.16, slope))
    return {'work': 0.06, 'luxury': 0.1, 'exotic': 0.09, 'sport': 0.08, 'classic': 0.0}.get(tier, 0.08)


def entry_for(ad):
    """Catalogue entry for this ad's exact model-year: researched, hand-checked, or derived."""
    if ad.get('cid'):
        return by_id[ad['cid']]
    # the trim this ad was filed under (agent ads) or names (pack ads) decides which sibling it follows
    target = by_id.get(ad.get('target') or '')
    tmatch = lambda o: bool(norm_en(ad.get('trim'))) and norm_en(ad['trim']) in norm_en(f"{o['trim']} {o.get('trimAr') or ''}")  # noqa: E731
    key = (ad['make'], ad['model'], ad['year'])
    if key in by_key:
        # several researched trims for one model-year: the one whose trim the ad names, else the first
        opts = by_key[key]
        if target:
            same = [o for o in opts if norm_en(o['trim']) == norm_en(target['trim'])]
            if same:
                return same[0]
        if len(opts) > 1 and ad.get('trim'):
            for o in opts:
                if tmatch(o):
                    return o
        fam_trims = {norm_en(c['trim']) for c in cat if c['makeEn'] == ad['make'] and c['modelEn'] == ad['model']}
        if not target or len(fam_trims) <= 1:
            return opts[0]
        # the filed trim wasn't researched for this year: follow that trim from its own year instead
    fam = [c for c in cat if c['makeEn'] == ad['make'] and c['modelEn'] == ad['model']]
    spec = NEW_SPECS.get((ad['make'], ad['model']))
    if fam:
        near = lambda c: abs(c['year'] - ad['year'])  # noqa: E731
        # a sibling with the ad's trim, but only within its generation; else the nearest year
        pool = [target] if target else ([c for c in fam if tmatch(c) and near(c) <= 4] or fam)
        best = min(pool, key=near)
        nid = f'{best["id"]}-y{ad["year"]}'
    else:
        best = None
        nid = f'{norm_en(ad["make"])}-{norm_en(ad["model"])}-{ad["year"]}-hj'
    if nid in new_entries:
        return new_entries[nid]
    gap = abs(best['year'] - ad['year']) if best else 99
    ov = OVERRIDE.get((ad['make'], ad['model'], ad['year']), OVERRIDE.get(nid, {}))
    if best:
        base = dict(
            id=nid, make_en=best['makeEn'], make_ar=best['makeAr'], model_en=best['modelEn'], model_ar=best['modelAr'],
            nickname_ar=best.get('nick'), year=ad['year'], trim='', trim_ar=None, body=best['body'],
            engine=best['engine'], hp=best.get('hp'), fuel=best['fuel'], drive=best['drive'], transmission=best['trans'],
            spec_common=best['spec'], tier=best['tier'], popularity=best['pop'], known_issues_ar=best.get('issues', []),
            selling_points_ar=best.get('perks', []), colors_common=best.get('colors', []),
        )
        if gap > 4 and not ov:
            return None  # a different generation we haven't hand-checked
    elif spec:
        s = dict(spec)
        yr = [v for (lo, hi), v in s.pop('years', {}).items() if lo <= ad['year'] <= hi]
        if yr:
            s.update(yr[0])
        base = dict(
            id=nid, make_en=ad['make'], make_ar=s.pop('make_ar'), model_en=ad['model'], model_ar=s.pop('model_ar'),
            nickname_ar=s.pop('nick', None), year=ad['year'], trim=s.pop('trim', ''), trim_ar=None, body=s.pop('body'),
            engine=s.pop('engine', ''), hp=s.pop('hp', None), fuel=s.pop('fuel', 'petrol'), drive=s.pop('drive'),
            transmission=s.pop('transmission', 'AT'), spec_common=s.pop('spec', 'خليجي'), tier=s.pop('tier'),
            popularity=s.pop('pop', 'low'), known_issues_ar=s.pop('issues', []), selling_points_ar=s.pop('perks', []),
            colors_common=s.pop('colors', []),
        )
    else:
        return None
    for k, v in ov.items():
        if k not in ('value', 'ok'):
            base[k] = v
    base['typical_km'] = int(max(3000, (NOW - ad['year'] + 0.5) * PER_YEAR_KM.get(base['tier'], 22000)))
    base['estimated'] = True
    base['observed'] = []
    base['_best'] = best
    base['_gap'] = gap
    base['_asks'] = []
    new_entries[nid] = base
    return base


assigned = {}  # catalogue id -> [ads]
for pid, ad in list(pool.items()):
    e = entry_for(ad)
    if e is None:
        say(f'{ad["src"]} {pid} «{ad["title"]}»: {ad["make"]} {ad["model"]} {ad["year"]} needs a hand-checked spec/value — dropped')
        del pool[pid]
        continue
    cid = e['id']
    ad['cid'] = cid
    if cid in new_entries and ad.get('price'):
        new_entries[cid]['_asks'].append(ad['price'])
        new_entries[cid]['observed'].append(dict(price_sar=ad['price'], km=ad.get('km'), year=ad['year'], city=ad.get('city'), source='haraj', url=ad['url']))
    assigned.setdefault(cid, []).append(ad)

PREMIUM_MAKES = {'Lexus', 'Mercedes-Benz', 'Mercedes-AMG', 'BMW', 'Audi', 'Porsche', 'Land Rover', 'Cadillac', 'Lincoln', 'Genesis',
                 'Infiniti', 'Maserati', 'Bentley', 'Rolls-Royce', 'Ferrari', 'Lamborghini', 'McLaren', 'Aston Martin', 'Lucid'}

# values for derived entries: hand-checked > asking prices (−7% haggle) > neighbouring year's depreciation
out_entries = []
for nid, e in new_entries.items():
    if nid not in assigned:
        continue
    best, gap, asks = e.pop('_best'), e.pop('_gap'), e.pop('_asks')
    ov = OVERRIDE.get((e['make_en'], e['model_en'], e['year']), OVERRIDE.get(nid, {}))
    dep = None
    if best and gap <= 4:
        many_trims = len({norm_en(c['trim']) for c in cat if c['makeEn'] == best['makeEn'] and c['modelEn'] == best['modelEn']}) > 1
        rate = year_rate(best['makeEn'], best['modelEn'], best['tier'], best['trim'] if many_trims else None)
        dep = best['value'] * math.exp(rate * (e['year'] - best['year']))
    ask = statistics.median(asks) * 0.93 if asks else None
    if 'value' in ov:
        v, how = ov['value'], 'hand-checked'
    elif ask and dep:
        ratio = ask / dep
        if 0.6 <= ratio <= 1.6:
            v, how = 0.35 * dep + 0.65 * ask, 'blend'
        elif len(asks) >= 2:
            v, how = ask, f'asks (dep {dep:,.0f} off by {ratio:.2f})'
        else:
            # one hopeful seller is not the market: the priced ad keeps its own ask, its unpriced siblings get
            # halfway between that ask and the researched neighbour's depreciation
            v, how = 0.5 * dep + 0.5 * ask, f'half one ask, half dep (off by {ratio:.2f})'
    elif ask:
        v, how = ask, 'ask'
    elif dep:
        v, how = dep, f'depreciation from {best["year"]}'
    else:
        for ad in assigned[nid]:
            say(f'{ad["src"]} {ad["pid"]} «{ad["title"]}»: no price and no researched neighbour for {nid} — dropped')
            pool.pop(ad['pid'], None)
        assigned.pop(nid)
        continue
    age = NOW - e['year']
    # a clone keeps its researched sibling's tier only while it is still that kind of car:
    # a 2007 Sierra cloned from a 2022 Denali is a work truck, not a luxury one
    if e['tier'] in ('luxury', 'exotic') and e['make_en'] not in PREMIUM_MAKES and v < 90000:
        e['tier'] = 'work' if e['body'] == 'pickup' else 'family'
    if e['tier'] == 'exotic' and v < 150000:
        e['tier'] = 'luxury'
    if e['tier'] == 'junk' and (v >= 20000 or age <= 12):
        e['tier'] = 'family' if e['body'] in ('suv', 'van', 'wagon') or v >= 30000 else 'daily'
    if e['tier'] == 'classic' and age < 25:
        e['tier'] = 'family' if e['body'] in ('suv', 'van', 'wagon', 'sedan') else 'work'
    e['fair_value_sar'] = int(round(v / 500) * 500)
    e['value_range_sar'] = [int(round(v * 0.88 / 500) * 500), int(round(v * 1.12 / 500) * 500)]
    e['new_price_sar'] = None
    e['notes'] = f'Built from real Haraj ads; value: {how}.'
    out_entries.append(e)

TOP = re.compile(r'Denali|Platinum|High Country|VXR|VXS|Limited|LTZ|Premier|Signature|Black Badge|Turbo S|Performante|AMG|فل كامل|Titanium|Nismo|Prestige', re.I)
BASE = re.compile(r'^(LS|LT|SLE|GL|GLX|XLI|XLi|S|SE|LX|ستاندر|ستاندرد|عادي)$', re.I)
for pid, ad in pool.items():
    t = ad.get('trim')
    if t and norm_en(t) and norm_en(t) in norm_en(ad['model']):
        ad['trim'] = t = None
    # a Lexus model number on a hybrid is the «h» car (an LS 500 ticked هايبرد is the LS 500h)
    if t and ad['make'] == 'Lexus' and re.fullmatch(r'\d{3}', t) and ad.get('fuel') == 'hybrid':
        ad['trim'] = t = t + 'H'
    elif not t and (ad['make'], ad['model']) == ('Lexus', 'ES') and ad.get('fuel') == 'hybrid' and ad['year'] >= 2019:
        ad['trim'] = t = '300H'  # the only ES hybrid sold here
    # on a Land Cruiser 300 a bare «GR» is the GR Sport
    if (ad['make'], ad['model']) == ('Toyota', 'Land Cruiser') and ad['year'] >= 2022 and t != 'GR Sport' \
            and re.search(r'\bGR\b|جي\s?ار', f"{ad.get('title') or ''} {(ad.get('text') or '')[:200]}"):
        ad['trim'] = t = 'GR Sport'
    if t:
        ts = TRIM_SPECS.get((ad['make'], ad['model'], t))
        for spec in (ts if isinstance(ts, list) else [ts] if ts else []):
            lo, hi = spec.get('years', (0, 9999))
            if lo <= ad['year'] <= hi:
                ad.update({k: v for k, v in spec.items() if k != 'years'})
                break

values = {c['id']: c['value'] for c in cat}
values.update({e['id']: e['fair_value_sar'] for e in out_entries})

# a priced ad keeps its own value when the price is believable for that model-year
ads_out = {}
for cid, ads in assigned.items():
    for ad in ads:
        if ad['pid'] not in pool:
            continue
        v = values.get(cid)
        etrim = (by_id.get(cid) or {}).get('trim', '') if cid in by_id else ''
        if not ad.get('price') and v and ad.get('trim'):
            if BASE.match(ad['trim']) and TOP.search(etrim or ''):
                ad['value'] = int(round(v * 0.82 / 500) * 500)
            elif TOP.search(ad['trim']) and not TOP.search(etrim or ''):
                ad['value'] = int(round(v * 1.15 / 500) * 500)
        if ad.get('price') and v:
            r = ad['price'] * 0.93 / v
            if 0.45 <= r <= 2.0 or (v < 30000 and 0.35 <= r <= 2.0):
                # السعر سوم ليس بيعاً: an ask above the model value pulls this car's value most of the way up;
                # an ask below it (a V8 GT filed with the W12s, a high-km car) is the seller telling us what it's worth
                ad['value'] = int(round(v * r ** (0.75 if r >= 1 else 0.92) / 500) * 500)
            else:
                say(f'{ad["src"]} {ad["pid"]} «{ad["title"]}»: asks {ad["price"]:,} vs model value {v:,} — price kept out')
                ad['price'] = None
        e = by_id.get(cid) or next((x for x in out_entries if x['id'] == cid), None)
        # the ad names its cylinders and they aren't the model's usual engine (a 6-cylinder GXR filed under
        # the V8, a W12 Bentayga): show what the ad says, not the catalogue's engine
        texts = [ad.get('title'), *(ad.get('lines') or []), (ad.get('text') or '')[:600]]
        mk_e, md_e = e.get('makeEn') or e.get('make_en') if e else None, e.get('modelEn') or e.get('model_en') if e else None
        # another fuel than the model's usual one is another engine (a diesel LC300, a hybrid Camry)
        e_fuel = (e.get('fuel') if e else None)
        if e and 'هايبرد' in (e.get('engine') or ''):
            e_fuel = 'hybrid'  # a mild hybrid (EQ Boost, Levante GT) is already the model's usual engine
        if e and not ad.get('engine') and ad.get('fuel') in ('diesel', 'hybrid', 'petrol') and ad['fuel'] != e_fuel:
            fs = FUEL_SPECS.get((mk_e, md_e, ad['fuel'])) or []
            hit = next((x for x in fs if x['years'][0] <= ad['year'] <= x['years'][1]), None)
            if hit:
                ad['engine'], ad['hp'] = hit['engine'], hit.get('hp')
            elif ad['fuel'] != 'petrol':
                ad['engine'], ad['hp'] = '?', None
            if ad.get('engine'):
                say(f'{ad["src"]} {ad["pid"]} «{ad["title"]}»: {ad["fuel"]} where the model is usually {e.get("fuel")} — engine {ad["engine"]}')
        # the ad names its cylinders or engine size and they aren't the model's usual engine (a 6-cylinder GXR
        # filed under the V8, a W12 Bentayga, a 1.6 turbo Sportage): show what the ad says, not the catalogue's
        if e and not ad.get('engine'):
            said = cyl_said(*texts)
            have = cyl_of_engine(e.get('engine'))
            dsaid = disp_said(*texts)
            dm = re.search(r'(\d\.\d)L', e.get('engine') or '')
            dhave = float(dm.group(1)) if dm else None
            if (said and have and said != have) or (dsaid and dhave and abs(dsaid - dhave) >= 0.25):
                alt = engine_alt(mk_e, md_e, ad['year'], said, dsaid)
                if alt:
                    # the family's other engine that matches what the ad says (a 6-cylinder Fortuner = the 4.0 V6)
                    ad['engine'], ad['hp'] = alt['engine'], alt.get('hp')
                elif said and have and said != have:
                    ad['engine'] = f'{dsaid:.1f}L {said} سلندر' if dsaid else f'{said} سلندر'
                    ad['hp'] = None
                else:
                    turbo = ' تيربو' if re.search(r'تيربو|توربو|turbo', ' '.join(x for x in texts if x), re.I) else ''
                    # never pair the ad's engine size with the model's cylinder count (a 3.5 K8 is not a 4-cylinder);
                    # a small engine in a family of 4-cylinders is still a 4-cylinder
                    cyl = said or (4 if have == 4 and dsaid <= 2.5 else None)
                    ad['engine'] = f'{dsaid:.1f}L{turbo}' + (f' {cyl} سلندر' if cyl else '')
                    ad['hp'] = None
                say(f'{ad["src"]} {ad["pid"]} «{ad["title"]}»: ad says {f"{said} cylinders" if said else f"a {dsaid}L engine"}, '
                    f'model usually {e.get("engine")} — engine {ad["engine"]}')
        # an engine of the ad's own with no known output: the horsepower the seller states, if he states one
        if ad.get('engine') and ad['engine'] != '?' and not ad.get('hp'):
            hp = hp_said(*texts)
            if hp:
                ad['hp'] = hp
        if e and ad.get('drive'):
            cdrive = e.get('drive') or e.get('drivetrain')
            body = e.get('body')
            if ad['drive'] == '2WD':
                ad['drive'] = 'RWD' if body in ('pickup', 'suv', 'van') and cdrive in ('4WD', 'RWD', None) else ('FWD' if cdrive in ('AWD', 'FWD') else 'RWD')
                if cdrive == ad['drive']:
                    ad.pop('drive')
            elif ad['drive'] == '4WD':
                if cdrive in ('4WD', 'AWD') or body not in ('pickup', 'suv', 'van'):
                    ad.pop('drive')  # nothing new (or «دبل» on a car where it can't mean 4x4)
                elif cdrive == 'FWD':
                    ad['drive'] = 'AWD'  # a crossover's «دبل» is its all-wheel drive
            elif ad['drive'] == cdrive:
                ad.pop('drive')  # «دفع خلفي» on a car that is rear-driven anyway
        ad['imgs'] = [f'https://mimg6cdn.haraj.com.sa/{p}' for p in ad.pop('paths')]
        ads_out.setdefault(cid, []).append(ad)

(RESEARCH / 'haraj_all.json').write_text(json.dumps({'ads': ads_out}, ensure_ascii=False, indent=1), encoding='utf-8')
(RESEARCH / 'cars_haraj_new.json').write_text(json.dumps({'segment': 'haraj_new', 'entries': out_entries}, ensure_ascii=False, indent=1), encoding='utf-8')
n_ads = sum(len(v) for v in ads_out.values())
head = [f'# Haraj merge v3 — {n_ads} ads on {len(ads_out)} catalogue ids; {len(out_entries)} model-years built from ads', '']
(RESEARCH / 'haraj_merge_report.md').write_text('\n'.join(head + report) + '\n', encoding='utf-8')
print('\n'.join(head))
print(f'{len(report)} report lines')
