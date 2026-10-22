#!/usr/bin/env python3
"""Merge every Haraj ad we have into one photo pool keyed by catalogue id.

Inputs
  research/haraj_ads.json            ads found by the research agent, already keyed by catalogue id
  <gpt>/Haraj_Cars/cars.json         ads collected separately (ChatGPT pack), keyed by Haraj post id
  research/cover_fixes.json          covers that aren't the car's exterior (rotate) or aren't usable (skip)
Outputs
  research/haraj_all.json            {"ads": {catalogue_id: [ad, ...]}}  (deduped by post id and photo)
  research/cars_haraj_new.json       new catalogue entries for model-years only the ads cover
  research/haraj_merge_report.md     what was matched, created, rejected and why
"""
import json
import math
import re
import statistics
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RESEARCH = Path('/home/claude/research')
GPT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('/tmp/claude-0/-home-claude/15da4d35-95ca-511f-947e-484db8ab0656/scratchpad/gpt/Haraj_Cars/cars.json')
NOW = 2026

# ------------------------------------------------------------------ catalogue
# the researched catalogue only (not the entries this script generated last time)
sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_catalogue as bc  # noqa: E402

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

MAKE_EN = {
    'نيسان': 'Nissan', 'تويوتا': 'Toyota', 'شيفروليه': 'Chevrolet', 'شفروليه': 'Chevrolet', 'فورد': 'Ford', 'كيا': 'Kia',
    'مازدا': 'Mazda', 'جيلي': 'Geely', 'جيتور': 'Jetour', 'شانجان': 'Changan', 'لكزس': 'Lexus', 'جي ام سي': 'GMC',
    'فاو FAW': 'FAW', 'بي ام دبليو': 'BMW', 'هونداي': 'Hyundai', 'هيونداي': 'Hyundai', 'اودي': 'Audi', 'انفنيتي': 'Infiniti',
    'بورش': 'Porsche', 'مرسيدس': 'Mercedes-Benz', 'بيجو': 'Peugeot', 'هافال': 'Haval',
}
# GPT model words -> catalogue modelEn (existing) or a NEW key from NEW_MODELS below
MODEL_KEY = {
    ('Nissan', 'صني'): 'Sunny', ('Nissan', 'باترول'): 'Patrol', ('Nissan', 'التيما'): 'Altima', ('Nissan', 'اكس تريل'): 'X-Trail',
    ('Nissan', 'سنترا'): 'NEW:Sentra', ('Nissan', 'ددسن'): 'Pickup (Datsun)', ('Nissan', 'اورفان'): 'NEW:Urvan',
    ('Toyota', 'هايلوكس'): 'Hilux', ('Toyota', 'لاندكروزر'): 'Land Cruiser', ('Toyota', 'كامري'): 'Camry', ('Toyota', 'راف فور'): 'RAV4',
    ('Toyota', 'فورتونر'): 'Fortuner', ('Toyota', 'شاص'): 'Land Cruiser 79 Pickup', ('Toyota', 'كورولا'): 'Corolla', ('Toyota', 'يارس'): 'Yaris',
    ('Chevrolet', 'تاهو'): 'Tahoe', ('Chevrolet', 'امبالا'): 'Impala', ('Chevrolet', 'كابريس'): 'Caprice', ('Chevrolet', 'بليزر'): 'NEW:Blazer',
    ('Chevrolet', 'سلفرادو'): 'Silverado 1500', ('Chevrolet', 'كابتيفا'): 'Captiva', ('Chevrolet', 'سبارك'): 'NEW:Spark',
    ('Chevrolet', 'ماليبو'): 'Malibu', ('Chevrolet', 'كروز'): 'NEW:Cruze',
    ('Ford', 'توروس'): 'Taurus', ('Ford', 'كراون فكتوريا'): 'Crown Victoria', ('Ford', 'تيريتوري'): 'Territory', ('Ford', 'موستنج'): 'Mustang',
    ('Ford', 'اكسبلورر'): 'Explorer', ('Ford', 'رينجر'): 'NEW:Ranger', ('Ford', 'فلكس'): 'NEW:Flex', ('Ford', 'إيكوسبورت'): 'NEW:EcoSport',
    ('Ford', 'اكسبيدشن'): 'Expedition',
    ('Kia', 'بيجاس'): 'Pegas', ('Kia', 'سيراتو'): 'Cerato', ('Kia', 'سيلتوس'): 'Seltos', ('Kia', 'تاسمان'): 'NEW:Tasman', ('Kia', 'سبورتاج'): 'Sportage',
    ('Kia', 'K8'): 'K8', ('Kia', 'اوبتيما'): 'Optima', ('Kia', 'K5'): 'K5', ('Kia', 'كادينزا'): 'NEW:Cadenza', ('Kia', 'ريو'): 'Rio',
    ('Mazda', 'مازدا 6'): '6', ('Mazda', 'CX5'): 'CX-5', ('Mazda', 'CX30'): 'NEW:CX-30', ('Mazda', 'CX9'): 'CX-9', ('Mazda', 'CX90'): 'NEW:CX-90',
    ('Mazda', 'CX3'): 'NEW:CX-3',
    ('Geely', 'امجراند 7'): 'Emgrand', ('Geely', 'كولراي'): 'Coolray', ('Geely', 'توجيلا'): 'Tugella', ('Geely', 'اوكافانجو'): 'NEW:Okavango',
    ('Geely', 'امجراند X7'): 'NEW:Emgrand X7', ('Geely', 'امجراند GS'): 'NEW:Emgrand GS', ('Geely', 'ستار راي'): 'Starray',
    ('Geely', 'بينراي'): 'NEW:Binray', ('Geely', 'ازكارا'): 'NEW:Azkarra',
    ('Jetour', 'داشينج'): 'Dashing', ('Jetour', 'جيتور X50'): 'NEW:X50', ('Jetour', 'جيتور T2'): 'T2', ('Jetour', 'جيتور T1'): 'T1',
    ('Changan', 'ايدو'): 'NEW:Eado', ('Changan', 'السفن'): 'Alsvin', ('Changan', 'CS95'): 'NEW:CS95', ('Changan', 'CS75'): 'CS75 Plus',
    ('Changan', 'يوني في'): 'NEW:UNI-V', ('Changan', 'CS35'): 'CS35 Plus',
    ('Lexus', 'LS'): 'LS', ('Lexus', 'ES'): 'ES', ('GMC', 'يوكن'): 'Yukon', ('FAW', 'أولي'): 'NEW:Oley',
    ('BMW', 'الفئة الرابعة'): 'NEW:4 Series', ('Hyundai', 'كريتا'): 'Creta', ('Hyundai', 'النترا'): 'Elantra', ('Hyundai', 'سنتافي'): 'Santa Fe',
    ('Audi', 'Q5'): 'NEW:Q5', ('Infiniti', 'QX70'): 'NEW:QX70', ('Porsche', 'كايين'): 'Cayenne', ('Mercedes-Benz', 'S'): 'S-Class',
    ('Peugeot', 'بيجو2008'): 'NEW:2008', ('Haval', 'هافال H9'): 'H9',
}
# Specs for models the catalogue doesn't have yet (common Saudi-market configurations).
NEW_MODELS = {
    'Sentra': dict(model_ar='سنترا', body='sedan', tier='daily', engine='1.6L 4 سلندر', hp=118, drive='FWD', transmission='CVT', pop='medium'),
    'Urvan': dict(model_ar='اورفان', body='van', tier='work', engine='2.5L 4 سلندر', hp=150, drive='RWD', transmission='5MT', pop='medium'),
    'Blazer': dict(model_ar='بليزر', body='suv', tier='family', engine='3.6L V6', hp=308, drive='AWD', transmission='9AT', pop='low'),
    'Spark': dict(model_ar='سبارك', body='hatch', tier='daily', engine='1.4L 4 سلندر', hp=98, drive='FWD', transmission='CVT', pop='low'),
    'Cruze': dict(model_ar='كروز', body='sedan', tier='daily', engine='1.8L 4 سلندر', hp=139, drive='FWD', transmission='6AT', pop='medium'),
    'Ranger': dict(model_ar='رينجر', body='pickup', tier='work', engine='2.5L 4 سلندر', hp=166, drive='4WD', transmission='6AT', pop='medium'),
    'Flex': dict(model_ar='فلكس', body='wagon', tier='family', engine='3.5L V6', hp=287, drive='FWD', transmission='6AT', pop='low'),
    'EcoSport': dict(model_ar='ايكو سبورت', body='suv', tier='daily', engine='1.5L 3 سلندر', hp=121, drive='FWD', transmission='6AT', pop='low'),
    'Tasman': dict(model_ar='تاسمان', body='pickup', tier='work', engine='2.5L تيربو', hp=277, drive='4WD', transmission='8AT', pop='medium'),
    'Cadenza': dict(model_ar='كادينزا', body='sedan', tier='family', engine='3.3L V6', hp=290, drive='FWD', transmission='8AT', pop='low'),
    'CX-30': dict(model_ar='سي اكس 30', body='suv', tier='daily', engine='2.0L 4 سلندر', hp=155, drive='FWD', transmission='6AT', pop='medium'),
    'CX-90': dict(model_ar='سي اكس 90', body='suv', tier='luxury', engine='3.3L تيربو 6 سلندر', hp=340, drive='AWD', transmission='8AT', pop='low'),
    'CX-3': dict(model_ar='سي اكس 3', body='suv', tier='daily', engine='2.0L 4 سلندر', hp=148, drive='FWD', transmission='6AT', pop='low'),
    'Okavango': dict(model_ar='اوكافانجو', body='suv', tier='family', engine='1.5L تيربو', hp=181, drive='FWD', transmission='7DCT', pop='low'),
    'Emgrand X7': dict(model_ar='امجراند X7', body='suv', tier='daily', engine='2.0L 4 سلندر', hp=139, drive='FWD', transmission='6AT', pop='low'),
    'Emgrand GS': dict(model_ar='امجراند GS', body='suv', tier='daily', engine='1.5L تيربو', hp=174, drive='FWD', transmission='7DCT', pop='low'),
    'Binray': dict(model_ar='بينراي', body='sedan', tier='daily', engine='1.5L تيربو', hp=174, drive='FWD', transmission='7DCT', pop='low'),
    'Azkarra': dict(model_ar='ازكارا', body='suv', tier='family', engine='1.5L تيربو', hp=174, drive='FWD', transmission='7DCT', pop='low'),
    'X50': dict(model_ar='اكس 50', body='suv', tier='daily', engine='1.5L تيربو', hp=154, drive='FWD', transmission='DCT', pop='low'),
    'Eado': dict(model_ar='ايدو', body='sedan', tier='daily', engine='1.4L تيربو', hp=158, drive='FWD', transmission='7DCT', pop='medium'),
    'CS95': dict(model_ar='سي اس 95', body='suv', tier='family', engine='2.0L تيربو', hp=233, drive='AWD', transmission='8AT', pop='low'),
    'UNI-V': dict(model_ar='يوني في', body='sedan', tier='daily', engine='1.5L تيربو', hp=188, drive='FWD', transmission='7DCT', pop='medium'),
    'Oley': dict(model_ar='اولي', body='sedan', tier='daily', engine='1.5L 4 سلندر', hp=105, drive='FWD', transmission='AT', pop='low'),
    '4 Series': dict(model_ar='الفئة الرابعة', body='coupe', tier='luxury', engine='2.0L تيربو', hp=255, drive='RWD', transmission='8AT', pop='low'),
    'Q5': dict(model_ar='كيو 5', body='suv', tier='luxury', engine='2.0L تيربو', hp=248, drive='AWD', transmission='7DCT', pop='low'),
    'QX70': dict(model_ar='كيو اكس 70', body='suv', tier='luxury', engine='3.7L V6', hp=325, drive='AWD', transmission='7AT', pop='low'),
    '2008': dict(model_ar='2008', body='suv', tier='daily', engine='1.6L تيربو', hp=163, drive='FWD', transmission='6AT', pop='low'),
}
MAKE_AR = {'Nissan': 'نيسان', 'Chevrolet': 'شفروليه', 'Ford': 'فورد', 'Kia': 'كيا', 'Mazda': 'مازدا', 'Geely': 'جيلي', 'Jetour': 'جيتور',
           'Changan': 'شانجان', 'FAW': 'فاو', 'BMW': 'بي ام دبليو', 'Audi': 'اودي', 'Infiniti': 'انفينيتي', 'Peugeot': 'بيجو'}


# Agent ads whose model-year is a different generation/facelift from the catalogue entry they were filed under.
DROP_AGENT = {('rollsroyce-cullinan-2020', 2026), ('bmw-730li-2020', 2018)}
# Ads whose year can't be trusted or whose model we can't spec reliably.
DROP_NEW = {'peugeot-2008-2008-hj', 'chevrolet-cruze-2027-hj'}
# Hand-checked model-years built from a neighbouring year: generation-correct specs, and a value (SAR)
# where the depreciation estimate or a lone asking price is off for the Saudi market.
OVERRIDE = {
    'lexus-ls350-2022-y2007': dict(trim='460', engine='4.6L V8', hp=380, transmission='8AT', value=28000),
    'toyota-land-cruiser-2006-gxr-y1999': dict(value=26000),
    'toyota-fortuner-2022-vx1-y2006': dict(trim='', hp=158, transmission='4AT'),
    'kia-cerato-2021-lx-y2023': dict(value=50000),
    'toyota-hilux-2012-single-cab-y2014': dict(value=42000),
    'toyota-hilux-2021-double-cab-diesel-y2019': dict(value=62000),
    'toyota-rav4-2021-le-awd-y2014': dict(trim='', engine='2.5L 4 سلندر', hp=176, transmission='6AT'),
    'toyota-hilux-2006-gl-y2002': dict(engine='2.7L 4 سلندر (3RZ-FE)', hp=150, transmission='5MT'),
    'toyota-rav4-2021-le-awd-y2025': dict(value=100000),
    'toyota-hilux-2025-2-7-gl-4x4-y2023': dict(value=90000),
    'ford-mustang-2020-ecoboost-y2017': dict(transmission='6AT'),
    'ford-explorer-2020-limited-y2008': dict(trim='', engine='4.0L V6', hp=210, transmission='5AT'),
    'ford-ecosport-2016-hj': dict(engine='1.5L 4 سلندر', hp=110),
    'ford-expedition-2020-limited-y2013': dict(engine='5.4L V8', hp=310, transmission='6AT', value=38000),
    'nissan-xtrail-2018-sv-y2026': dict(trim='', engine='2.5L 4 سلندر', hp=181),
    'nissan-patrol-y62-2016-le-y2013': dict(value=68000),
    'nissan-pickup-d22-2014-single-cab-y2005': dict(value=16000),
    'nissan-patrol-y62-2020-le-platinum-y2022': dict(value=215000),
    'chevrolet-tahoe-2016-ls-y2013': dict(hp=320),
    'chevrolet-blazer-2008-hj': dict(engine='4.2L 6 سلندر', hp=285, transmission='4AT', drive='4WD', tier='junk'),
    'chevrolet-tahoe-2016-ls-y2011': dict(hp=320),
    'chevrolet-tahoe-2005-ls-y2007': dict(hp=320, value=22000),
    'chevrolet-captiva-2021-lt-y2024': dict(value=58000),
    'chevrolet-impala-2008-lt-y2015': dict(engine='3.6L V6', hp=305, transmission='6AT', value=32000),
    'chevrolet-impala-2008-lt-y2019': dict(engine='3.6L V6', hp=305, transmission='6AT', value=48000),
    'chevrolet-malibu-2017-ls-y2022': dict(trim='LS', engine='1.5L تيربو', hp=160, transmission='CVT', value=55000),
    'kia-cerato-2010-ex-y2015': dict(hp=128, transmission='6AT'),
    'kia-k8-2023-gdi-y2026': dict(value=140000),
    'kia-sportage-2023-awd-y2017': dict(value=36000),
    'mazda-cx9-2021-signature-y2014': dict(trim='', engine='3.7L V6', hp=273, transmission='6AT'),
    'mazda-6-2022-standard-y2009': dict(trim='', engine='2.5L 4 سلندر', hp=170, transmission='5AT'),
    'mazda-6-2022-standard-y2016': dict(hp=184, value=34000),
    'mazda-6-2022-standard-y2015': dict(hp=184, value=31000),
    'geely-emgrand-2023-comfort-y2025': dict(value=33000),
    'geely-emgrand-2023-comfort-y2017': dict(trim='', engine='1.8L 4 سلندر', hp=136, transmission='CVT'),
    'geely-emgrand-2023-comfort-y2015': dict(trim='', engine='1.8L 4 سلندر', hp=136, transmission='CVT', value=14000),
    'geely-emgrand-2023-comfort-y2026': dict(value=45000),
    'geely-emgrand-2023-comfort-y2027': dict(value=47000),
    'geely-tugella-2023-gf-4wd-y2026': dict(value=86000),
    'geely-tugella-2023-gf-4wd-y2025': dict(value=80000),
    'jetour-dashing-2024-luxury-y2026': dict(value=70000),
    'jetour-dashing-2024-luxury-y2027': dict(value=76500),
    'geely-coolray-2023-gf-y2026': dict(trim='', engine='1.5L تيربو', hp=181, transmission='7DCT', value=65000),
    'changan-cs75plus-2023-limited-y2018': dict(model_en='CS75', model_ar='CS75', trim='', engine='1.8L تيربو', hp=175, transmission='6AT', value=23500),
    'changan-alsvin-2022-y2026': dict(value=36500),
}
PER_YEAR_KM = {'luxury': 15000, 'sport': 11000, 'exotic': 6000, 'classic': 9000}


def norm_en(s):
    return re.sub(r'[^a-z0-9]', '', (s or '').lower())


def post_id(url):
    m = re.search(r'haraj\.com\.sa/(\d{8,})', url or '')
    return m.group(1) if m else None


def img_path(u):
    """Canonical Haraj photo path (works for mimg6cdn originals and postcdn -700.webp thumbs)."""
    m = re.match(r'https://(?:mimg\d*cdn|postcdn)\.haraj\.com\.sa/(.+?)(?:-700\.webp)?$', u or '')
    return m.group(1) if m else None


def km_of(text):
    if not text:
        return None
    t = str(text)
    m = re.search(r'(\d[\d,٬\.]*)\s*(ألف|الف|K|k)', t)
    if m:
        try:
            return int(float(m.group(1).replace(',', '').replace('٬', '')) * 1000)
        except ValueError:
            return None
    m = re.search(r'(\d{4,7})', t.replace(',', ''))
    return int(m.group(1)) if m else None


report = []
fixes = json.loads((RESEARCH / 'cover_fixes.json').read_text())

# ------------------------------------------------------------------ agent ads (already keyed)
agent = json.loads((RESEARCH / 'haraj_ads.json').read_text(encoding='utf-8'))['ads']
merged = {}
seen_posts = set()
seen_imgs = set()


def add(cid, ad):
    pid = post_id(ad.get('url'))
    if pid and pid in seen_posts:
        return 'dup-post'
    paths = [p for p in (img_path(u) for u in ad['imgs']) if p]
    fresh = [p for p in paths if p not in seen_imgs]
    if len(fresh) < 3:
        return 'too-few-photos'
    if pid:
        seen_posts.add(pid)
    seen_imgs.update(fresh)
    ad = {**ad, 'imgs': [f'https://mimg6cdn.haraj.com.sa/{p}' for p in fresh]}
    ad.pop('thumbs', None)
    merged.setdefault(cid, []).append(ad)
    return 'ok'


for cid, ads in agent.items():
    if cid not in by_id:
        report.append(f'- agent ads for unknown id {cid} dropped')
        continue
    for ad in ads:
        try:
            ay = int(ad.get('year'))
        except (TypeError, ValueError):
            ay = None
        if (cid, ay) in DROP_AGENT:
            report.append(f'- agent ad {ad.get("url")} ({cid}): {ay} is a different generation/facelift — dropped')
            continue
        r = add(cid, ad)
        if r != 'ok':
            report.append(f'- agent ad {ad.get("url")} ({cid}): {r}')

# ------------------------------------------------------------------ GPT ads
gpt = json.loads(GPT.read_text(encoding='utf-8'))['cars']
new_entries = {}


def year_rate(make_en, model_en):
    pts = [(c['year'], c['value']) for c in cat if c['makeEn'] == make_en and c['modelEn'] == model_en]
    if len(pts) >= 2:
        xs = [p[0] for p in pts]
        ys = [math.log(p[1]) for p in pts]
        mx, my = statistics.mean(xs), statistics.mean(ys)
        den = sum((x - mx) ** 2 for x in xs)
        if den:
            slope = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / den
            return max(0.03, min(0.16, slope))
    tier = next((c['tier'] for c in cat if c['makeEn'] == make_en and c['modelEn'] == model_en), 'daily')
    return {'work': 0.06, 'luxury': 0.1, 'exotic': 0.1, 'sport': 0.08}.get(tier, 0.08)


def ok_price(p):
    return isinstance(p, (int, float)) and 3000 <= p <= 3_000_000 and not re.fullmatch(r'(\d)\1+', str(int(p)))


stats = {'matched': 0, 'cloned': 0, 'new_model': 0, 'skipped': 0}
for g in gpt:
    gid = str(g['id'])
    if g.get('make') in ('قطع غيار وملحقات',) or g.get('sale_type') == 'تنازل' or gid in fixes['skip']:
        stats['skipped'] += 1
        report.append(f'- skip {gid} «{g["title"]}»: {"parts" if g.get("make") == "قطع غيار وملحقات" else "تنازل" if g.get("sale_type") == "تنازل" else "cover is a screenshot/poster"}')
        continue
    make_en = MAKE_EN.get(g.get('make'))
    key = MODEL_KEY.get((make_en, g.get('model')))
    if not make_en or not key or not g.get('year'):
        stats['skipped'] += 1
        report.append(f'- skip {gid} «{g["title"]}»: unknown make/model {g.get("make")} {g.get("model")}')
        continue
    imgs = [f'https://mimg6cdn.haraj.com.sa/{p}' for p in (img_path(u) for u in g.get('image_urls') or []) if p]
    if gid in fixes['rotate'] and len(imgs) > 1:
        imgs = imgs[1:] + imgs[:1]
    price = g.get('price_sar') if ok_price(g.get('price_sar')) else None
    km = km_of(g.get('mileage_as_listed'))
    ad = {
        'source': 'haraj', 'url': f'https://haraj.com.sa/{gid}', 'title': g.get('title'), 'price': price, 'city': g.get('city'),
        'year': g['year'], 'km': km if g.get('condition') != 'جديد' else (km or 0), 'color': None, 'text': None, 'imgs': imgs[:12],
        'new': g.get('condition') == 'جديد', 'damaged': bool(g.get('damage_flag_in_title')),
    }
    year = int(g['year'])
    if key.startswith('NEW:'):
        mk = key[4:]
        spec = NEW_MODELS[mk]
        nid = f'{norm_en(make_en)}-{norm_en(mk)}-{year}-hj'
        if nid not in by_id and nid not in new_entries:
            if not price:
                stats['skipped'] += 1
                report.append(f'- skip {gid} «{g["title"]}»: new model with no price on the ad (not inventing one)')
                continue
            new_entries[nid] = dict(
                id=nid, make_en=make_en, make_ar=MAKE_AR.get(make_en, g['make']), model_en=mk, model_ar=spec['model_ar'],
                nickname_ar=None, generation=None, year=year, trim='', trim_ar=None, body=spec['body'], engine=spec['engine'],
                hp=spec['hp'], fuel='petrol', drive=spec['drive'], transmission=spec['transmission'], spec_common='سعودي',
                typical_km=int(max(3000, (NOW - year + 0.5) * PER_YEAR_KM.get(spec['tier'], 22000))), prices=[], estimated=True, observed=[], tier=spec['tier'],
                popularity=spec['pop'], known_issues_ar=[], selling_points_ar=[], colors_common=[],
                notes='Priced from live Haraj asking prices (ChatGPT pack, 2026-10-22), 7% off for haggling.',
            )
            stats['new_model'] += 1
        ent = new_entries.get(nid)
        if ent is not None:
            if price:
                ent['prices'].append(price)
                ent['observed'].append(dict(price_sar=price, km=km, year=year, city=g.get('city'), source='haraj', url=ad['url']))
            cid = nid
        else:
            cid = nid
    else:
        cands = [c for c in cat if c['makeEn'] == make_en and c['modelEn'] == key] or \
            [c for c in cat if c['makeEn'] == make_en and norm_en(c['modelEn']).startswith(norm_en(key))]
        if not cands:
            stats['skipped'] += 1
            report.append(f'- skip {gid} «{g["title"]}»: model {key} not in catalogue')
            continue
        best = min(cands, key=lambda c: abs(c['year'] - year))
        gap = abs(best['year'] - year)
        if gap > 1:
            alt = [c for c in cat if c['makeEn'] == make_en and c['modelEn'] != key and norm_en(c['modelEn']).startswith(norm_en(key))
                   and not re.search(r'Pickup|Hardtop|Double Cab|Prado|Nismo|Safari|\b7\d\b', c['modelEn']) and abs(c['year'] - year) <= 1]
            if alt:
                best = min(alt, key=lambda c: abs(c['year'] - year))
                gap = abs(best['year'] - year)
        if gap <= 1:
            cid = best['id']
            stats['matched'] += 1
            if price:
                ratio = price / best['value']
                if ratio < 0.45 or ratio > 2.2:
                    report.append(f'- price flag {gid} «{g["title"]}»: asks {price:,} vs our {best["value"]:,} for {cid} (ratio {ratio:.2f}) — price kept out')
                    ad['price'] = None
        else:
            nid = f'{best["id"]}-y{year}'
            if nid not in by_id and nid not in new_entries:
                rate = year_rate(make_en, best['modelEn'])
                dep = best['value'] * math.exp(rate * (year - best['year']))
                val = dep
                if price:
                    ratio = price * 0.93 / dep
                    val = 0.35 * dep + 0.65 * price * 0.93 if (0.6 <= ratio <= 1.6 and gap <= 4) else price * 0.93
                elif gap > 4 and nid not in OVERRIDE:
                    stats['skipped'] += 1
                    report.append(f'- skip {gid} «{g["title"]}»: {year} is {gap} years from our nearest researched {best["modelEn"]} and the ad has no price')
                    continue
                new_entries[nid] = dict(
                    id=nid, make_en=best['makeEn'], make_ar=best['makeAr'], model_en=best['modelEn'], model_ar=best['modelAr'],
                    nickname_ar=best.get('nick'), generation=None, year=year, trim=best['trim'], trim_ar=best.get('trimAr'),
                    body=best['body'], engine=best['engine'], hp=best.get('hp'), fuel=best['fuel'], drive=best['drive'],
                    transmission=best['trans'], spec_common=best['spec'],
                    typical_km=int(max(3000, (NOW - year + 0.5) * PER_YEAR_KM.get(best['tier'], 22000))),
                    fixed_value=int(round(val / 500) * 500), estimated=True, observed=[], tier=best['tier'], popularity=best['pop'],
                    known_issues_ar=best.get('issues', []), selling_points_ar=best.get('perks', []), colors_common=best.get('colors', []),
                    notes=f'Model-year from a Haraj ad; value from {best["id"]} with this model\'s depreciation ({rate:.1%}/yr) checked against the ad price.',
                )
                stats['cloned'] += 1
            if price and nid in new_entries:
                new_entries[nid]['observed'].append(dict(price_sar=price, km=km, year=year, city=g.get('city'), source='haraj', url=ad['url']))
            cid = nid
    r = add(cid, ad)
    if r != 'ok':
        report.append(f'- gpt ad {gid} «{g["title"]}» → {cid}: {r}')

# finalise new entries: value from asking prices (median, 7% haggle) or the depreciation study
out_entries = []
for nid, e in new_entries.items():
    if nid in DROP_NEW:
        report.append(f'- new entry {nid} dropped (year or spec not reliable)')
        merged.pop(nid, None)
        continue
    if 'prices' in e:
        if not e['prices']:
            continue
        v = statistics.median(e.pop('prices')) * 0.93
    else:
        v = e.pop('fixed_value')
    o = OVERRIDE.get(nid, {})
    for k, val in o.items():
        if k != 'value':
            e[k] = val
    if 'value' in o:
        v = o['value']
    e['fair_value_sar'] = int(round(v / 500) * 500)
    e['value_range_sar'] = [int(round(v * 0.88 / 500) * 500), int(round(v * 1.12 / 500) * 500)]
    e['new_price_sar'] = None
    if nid in merged:  # only keep entries that ended up with photos
        out_entries.append(e)
    else:
        report.append(f'- new entry {nid} dropped (its ad had too few unique photos)')

(RESEARCH / 'haraj_all.json').write_text(json.dumps({'ads': merged}, ensure_ascii=False, indent=1), encoding='utf-8')
(RESEARCH / 'cars_haraj_new.json').write_text(json.dumps({'segment': 'haraj_new', 'entries': out_entries}, ensure_ascii=False, indent=1), encoding='utf-8')
n_ads = sum(len(v) for v in merged.values())
n_imgs = sum(len(a['imgs']) for v in merged.values() for a in v)
head = [f'# Haraj merge — {len(merged)} catalogue ids with photos, {n_ads} ads, {n_imgs} photos',
        f'GPT pack: matched {stats["matched"]}, new model-years {stats["cloned"]}, new models {stats["new_model"]}, skipped {stats["skipped"]}.', '']
(RESEARCH / 'haraj_merge_report.md').write_text('\n'.join(head + report) + '\n', encoding='utf-8')
print('\n'.join(head))
print('\n'.join(report[:60]))
