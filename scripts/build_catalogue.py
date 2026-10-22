#!/usr/bin/env python3
"""Turn the researched market files (research/cars_*.json) into src/data/catalogue.ts.

Each research entry is one make/model/trim/model-year priced clean, typical km, Saudi spec,
with the live listings it was priced from (Haraj, Yallamotor, Syarah…). The game rolls
condition, km, spec and history on top of this base value at runtime.
"""
import glob
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RESEARCH = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('/home/claude/research')
OUT = ROOT / 'src' / 'data' / 'catalogue.ts'
NOW_YEAR = 2026

TIERS = {'junk', 'daily', 'family', 'work', 'luxury', 'sport', 'exotic', 'classic'}
TIER_MAP = {
    'economy': 'daily', 'budget': 'daily', 'compact': 'daily', 'mid': 'daily',
    'premium': 'luxury', 'lux': 'luxury', 'performance': 'sport', 'muscle': 'sport',
    'supercar': 'exotic', 'hypercar': 'exotic', 'commercial': 'work', 'pickup': 'work',
    'truck': 'work', 'vintage': 'classic', 'suv': 'family',
}
BODIES = {'sedan', 'suv', 'pickup', 'coupe', 'hatch', 'van', 'convertible', 'wagon'}
BODY_MAP = {
    'hatchback': 'hatch', 'crossover': 'suv', 'cuv': 'suv', 'minivan': 'van', 'bus': 'van',
    'truck': 'pickup', 'cabriolet': 'convertible', 'roadster': 'convertible', 'spyder': 'convertible',
    'spider': 'convertible', 'estate': 'wagon', 'liftback': 'hatch', 'fastback': 'coupe',
}
FUEL_MAP = {'gasoline': 'petrol', 'gas': 'petrol', 'benzine': 'petrol', 'electric': 'ev', 'bev': 'ev',
            'phev': 'hybrid', 'hev': 'hybrid'}
DRIVE_MAP = {'4x4': '4WD', '4wd': '4WD', 'awd': 'AWD', 'fwd': 'FWD', 'rwd': 'RWD', '2wd': 'RWD', 'part-time 4wd': '4WD'}
POP = {'high', 'medium', 'low'}

# research colour words → the game's paint table (src/engine/lotgen.ts COLORS)
COLOR_KEYS = ['أبيض', 'أبيض لؤلؤي', 'فضي', 'رصاصي', 'أسود', 'شمباني', 'بيج', 'عنابي', 'كحلي', 'أحمر',
              'أزرق', 'أخضر زيتي', 'بني', 'برتقالي', 'أصفر', 'سكني']
COLOR_ALIASES = [
    ('لؤلؤ', 'أبيض لؤلؤي'), ('لولو', 'أبيض لؤلؤي'), ('بيرل', 'أبيض لؤلؤي'),
    ('ابيض', 'أبيض'), ('أبيض', 'أبيض'),
    ('فضي', 'فضي'), ('سلفر', 'فضي'), ('فضة', 'فضي'),
    ('رصاصي', 'رصاصي'), ('رمادي', 'رصاصي'), ('جراي', 'رصاصي'), ('غامق رصاصي', 'رصاصي'),
    ('سكني', 'سكني'),
    ('اسود', 'أسود'), ('أسود', 'أسود'),
    ('شمباني', 'شمباني'), ('ذهبي', 'شمباني'), ('شامبين', 'شمباني'),
    ('بيج', 'بيج'), ('عنابي', 'عنابي'), ('ماروني', 'عنابي'), ('خمري', 'عنابي'),
    ('كحلي', 'كحلي'), ('احمر', 'أحمر'), ('أحمر', 'أحمر'),
    ('ازرق', 'أزرق'), ('أزرق', 'أزرق'), ('زيتي', 'أخضر زيتي'), ('اخضر', 'أخضر زيتي'), ('أخضر', 'أخضر زيتي'),
    ('بني', 'بني'), ('برتقالي', 'برتقالي'), ('اصفر', 'أصفر'), ('أصفر', 'أصفر'),
]


def norm_color(c):
    if not isinstance(c, str):
        return None
    for needle, key in COLOR_ALIASES:
        if needle in c:
            return key
    return None


def as_int(x):
    try:
        if x is None:
            return None
        if isinstance(x, str):
            x = re.sub(r'[^\d.]', '', x)
            if not x:
                return None
        return int(round(float(x)))
    except (TypeError, ValueError):
        return None


def clean_list(xs, limit=8):
    out = []
    for x in xs or []:
        if isinstance(x, str):
            x = re.sub(r'\s+', ' ', x).strip().strip('.')
            if x and x not in out:
                out.append(x)
    return out[:limit]


GENERIC_TRIM = [('full option', 'فل كامل'), ('fully loaded', 'فل كامل'), ('standard', 'ستاندر'), ('base', 'ستاندر'),
                ('mid', 'نص فل'), ('top', 'فل كامل'), ('std', 'ستاندر')]


def squash(x):
    return re.sub(r'[\s\-]+', '', (x or '').lower())


def tidy_trim(t, model_en, model_ar):
    t = re.sub(r'\s*\([^)]*\)', '', t or '').strip()
    if t and (squash(t) == squash(model_en) or squash(t) == squash(model_ar)
              or squash(model_en).startswith(squash(t)) or squash(model_ar).startswith(squash(t))):
        return ''
    toks = [w for w in re.split(r'[\s\-/]+', t.lower()) if w]
    if toks and all(w in squash(model_en) for w in toks):
        return ''
    # drop leading words that just repeat the model ("TRX crew cab" on a "RAM TRX")
    words = t.split()
    model_words = set(model_en.lower().split()) | set((model_ar or '').split())
    while len(words) > 1 and words[0].lower() in model_words:
        words = words[1:]
    t = ' '.join(words)
    for pref in (model_en, model_ar):
        if not pref:
            continue
        if t.lower() == pref.lower():
            return ''
        if t.lower().startswith(pref.lower() + ' '):
            t = t[len(pref):].strip()
    if t and t.lower() in model_en.lower().split():
        return ''
    if t and model_ar and t in model_ar.split():
        return ''
    low = t.lower()
    for k, ar in GENERIC_TRIM:
        if low == k:
            return ar
        if low.startswith(k + ' '):
            return ar + t[len(k):]
    return t


def comps_of(e):
    """Up to four real listings this entry was priced from: [price, km|null, city|null, source]."""
    out = []
    for o in e.get('observed') or []:
        p = as_int(o.get('price_sar'))
        if not p or p < 1000:
            continue
        src = (o.get('source') or '').lower()
        src = {'haraj': 'حراج', 'yallamotor': 'يلا موتور', 'syarah': 'سيارة', 'motory': 'موتري',
               'dubizzle': 'دوبيزل', 'opensooq': 'السوق المفتوح', 'carswitch': 'كارسويتش',
               'expatriates': 'إكسبات', 'carsemsar': 'كار سمسار', 'mstaml': 'مستعمل'}.get(src, o.get('source') or 'السوق')
        city = o.get('city')
        if isinstance(city, str):
            city = city.strip() or None
        yr = as_int(o.get('year'))
        out.append([p, as_int(o.get('km')), city, src, yr])
    # prefer Haraj first, then others; keep it short
    out.sort(key=lambda r: (r[3] != 'حراج',))
    return out[:3]


def convert(e, seen):
    eid = str(e.get('id') or '').strip()
    year = as_int(e.get('year'))
    value = as_int(e.get('fair_value_sar'))
    if not eid or not year or not value or value < 2000:
        return None, f'skip (missing core): {eid or e.get("model_en")}'
    if eid in seen:
        eid = f'{eid}-{len(seen)}'
    tier = str(e.get('tier') or '').lower().strip()
    tier = tier if tier in TIERS else TIER_MAP.get(tier, 'daily')
    body = str(e.get('body') or 'sedan').lower().strip()
    body = body if body in BODIES else BODY_MAP.get(body, 'sedan')
    fuel = str(e.get('fuel') or 'petrol').lower().strip()
    fuel = fuel if fuel in {'petrol', 'diesel', 'hybrid', 'ev'} else FUEL_MAP.get(fuel, 'petrol')
    drive_raw = str(e.get('drive') or '').strip()
    drive = drive_raw.upper() if drive_raw.upper() in {'FWD', 'RWD', 'AWD', '4WD'} else DRIVE_MAP.get(drive_raw.lower(), 'RWD' if body == 'pickup' else 'FWD')
    trans = str(e.get('transmission') or 'AT').strip()
    if re.match(r'^1-?speed', trans, re.I) or fuel == 'ev':
        trans = 'AT'
    trans = trans.replace(' ', '')

    make_ar = (e.get('make_ar') or e.get('make_en') or '').strip()
    _model_ar = (e.get('model_ar') or '').strip()
    if _model_ar.startswith(make_ar + ' '):
        e = {**e, 'model_ar': _model_ar[len(make_ar) + 1:]}
        _model_ar = e['model_ar']
    if _model_ar and _model_ar in make_ar.split() and len(make_ar.split()) > 1:
        make_ar = ' '.join(w for w in make_ar.split() if w != _model_ar)  # "مرسيدس مايباخ" + "مايباخ" 
    make_en = (e.get('make_en') or '').strip()
    model_ar = (e.get('model_ar') or e.get('model_en') or '').strip()
    model_en = (e.get('model_en') or '').strip()
    trim = str(e.get('trim') or '').strip()
    trim_ar = str(e.get('trim_ar') or '').strip() or None
    # long English descriptions ("Hardtop 5-door, premium grade") read badly in an Arabic title
    if trim_ar and (',' in trim or len(trim) > 18):
        trim, trim_ar = trim_ar, None
    # no "S500 S500" / "جي 63 جي 63 AMG" titles
    trim = tidy_trim(trim, model_en, model_ar)
    if not trim and trim_ar:
        trim = tidy_trim(trim_ar, model_en, model_ar)
        trim_ar = None
    if trim_ar:
        trim_ar = re.sub(r'\s*\([^)]*\)', '', trim_ar).strip() or None
    if trim_ar and trim_ar == trim:
        trim_ar = None

    km = as_int(e.get('typical_km'))
    age = max(0, NOW_YEAR - year)
    if not km or km <= 0:
        per_year = 26000 if tier in ('daily', 'family', 'work', 'junk') else 16000 if tier in ('luxury',) else 9000
        km = max(4000 if age else 900, min(520000, age * per_year))
    rng = e.get('value_range_sar')
    rng = [as_int(rng[0]), as_int(rng[1])] if isinstance(rng, list) and len(rng) == 2 and all(as_int(x) for x in rng) else None
    if rng and rng[0] > rng[1]:
        rng = [rng[1], rng[0]]
    colors = []
    for c in e.get('colors_common') or []:
        k = norm_color(c)
        if k and k not in colors:
            colors.append(k)
    if not colors:
        colors = ['أبيض', 'فضي', 'أسود']
    pop = str(e.get('popularity') or 'medium').lower()
    pop = pop if pop in POP else 'medium'

    out = {
        'id': eid, 'makeAr': make_ar, 'makeEn': make_en, 'modelAr': model_ar, 'modelEn': model_en,
    }
    nick = e.get('nickname_ar')
    if isinstance(nick, str) and nick.strip() and nick.strip() != model_ar:
        out['nick'] = nick.strip()

    out.update({'year': year, 'trim': trim})
    if trim_ar:
        out['trimAr'] = trim_ar
    out.update({
        'body': body, 'engine': str(e.get('engine') or '').strip(),
    })
    hp = as_int(e.get('hp'))
    if hp:
        out['hp'] = hp
    out.update({
        'fuel': fuel, 'drive': drive, 'trans': trans, 'spec': str(e.get('spec_common') or 'سعودي').strip(),
        'km': km, 'value': value,
    })

    out.update({
        'tier': tier, 'pop': pop,
        'issues': clean_list(e.get('known_issues_ar'), 4),
        'perks': clean_list(e.get('selling_points_ar'), 4),
        'colors': colors[:6],
    })
    if body == 'coupe' or body == 'convertible':
        out['doors'] = 2
    if body == 'pickup':
        t = f"{e.get('trim') or ''} {e.get('trim_ar') or ''} {e.get('notes') or ''}"
        if re.search(r'غمارة(?!ين)|single\s*cab|regular\s*cab|غماره(?!ين)', t, re.I) and not re.search(r'غمارتين|double|crew', t, re.I):
            out['cab'] = 'single'
            out['doors'] = 2
        else:
            out['cab'] = 'double'

    comps = comps_of(e)
    if comps:
        out['comps'] = comps
    return out, None


def main():
    files = sorted(glob.glob(str(RESEARCH / 'cars_*.json')))
    seen = {}
    all_out = []
    notes = []
    for fn in files:
        try:
            data = json.load(open(fn, encoding='utf-8'))
        except Exception as ex:  # noqa: BLE001
            notes.append(f'{fn}: unreadable ({ex})')
            continue
        entries = data['entries'] if isinstance(data, dict) else data
        n = 0
        for e in entries:
            o, why = convert(e, seen)
            if not o:
                notes.append(f'{Path(fn).name}: {why}')
                continue
            seen[o['id']] = True
            all_out.append(o)
            n += 1
        notes.append(f'{Path(fn).name}: {n} entries')
    all_out.sort(key=lambda o: (o['tier'], o['makeEn'], o['modelEn'], o['year']))
    lines = [
        '// GENERATED by scripts/build_catalogue.py from research/cars_*.json — do not edit by hand.',
        '// Values are SAR, clean condition, typical km, Saudi spec; priced from live listings (Haraj, Yallamotor, Syarah…).',
        "import type { CarModel } from '../engine/types';",
        '',
        'export const CATALOGUE: CarModel[] = [',
    ]
    for o in all_out:
        lines.append('  ' + json.dumps(o, ensure_ascii=False, separators=(',', ':')) + ',')
    lines.append('];')
    lines.append('')
    OUT.write_text('\n'.join(lines), encoding='utf-8')
    by_tier = {}
    for o in all_out:
        by_tier[o['tier']] = by_tier.get(o['tier'], 0) + 1
    print('\n'.join(notes))
    print('total', len(all_out), by_tier)


if __name__ == '__main__':
    main()
