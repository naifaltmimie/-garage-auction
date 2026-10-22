#!/usr/bin/env python3
"""research/haraj_all.json (+ photo QA) -> src/data/photos.ts: every real ad, with what it says about its car.

Photo QA (research/photo_qa_v2.txt, one line per ad, from the CLIP build on Vercel):
  <postid> <codes> <color><conf> <body><conf> <cab><conf> <damage 0-9> <model rank> <p:top_guess>
  codes, one letter per photo, in the order of that ad's photo list in qa/input.json:
  E exterior, I seats, D dashboard, O odometer, N engine, W wheel, T trunk, L lights, S screenshot/graphic,
  P paper, X person, G parts, K keys, ? failed to load.
Codes are matched to photos by path (the merge may order an ad's photos differently from the QA run).
Only the photo kinds and a confident colour are used; CLIP's damage, cab and model guesses are too noisy
to state as facts about a real car.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('/home/claude/research/haraj_all.json')
QA = Path('/home/claude/research/photo_qa_v2.txt')
QA_INPUT = Path('/home/claude/qa2/qa/input.json')
OUT = ROOT / 'src' / 'data' / 'photos.ts'
MAX_IMGS = 8
COLOR_KEY = {'w': 'أبيض', 'k': 'أسود', 's': 'فضي', 'g': 'رصاصي', 'r': 'أحمر', 'm': 'عنابي', 'b': 'أزرق', 'n': 'كحلي',
             'e': 'بيج', 'c': 'شمباني', 'o': 'بني', 'v': 'أخضر زيتي', 'y': 'أصفر', 'a': 'برتقالي'}
DROP_CODES = set('SPX?')

qa = {}
if QA.exists():
    for line in QA.read_text(encoding='utf-8').splitlines():
        f = line.split()
        if len(f) >= 7 and f[1] != 'ERR':
            qa[f[0]] = dict(codes=f[1], color=f[2], body=f[3], cab=f[4], dmg=f[5], mrank=f[6], guess=f[7] if len(f) > 7 else '')
# path -> photo kind, from the exact photo list each ad had in the QA run
kind_of = {}
if QA_INPUT.exists():
    for row in json.loads(QA_INPUT.read_text(encoding='utf-8')):
        q = qa.get(row['k'])
        if not q:
            continue
        for path, code in zip(row['i'], q['codes']):
            kind_of[path] = code

data = json.load(open(SRC, encoding='utf-8'))
cat = {}
for line in (ROOT / 'src' / 'data' / 'catalogue.ts').read_text(encoding='utf-8').splitlines():
    if line.startswith('  {'):
        e = json.loads(line.strip().rstrip(','))
        cat[e['id']] = e

report = []
out = {}
stats = dict(ads=0, covers=0, dropped_noext=0, junk_photos=0, qa_color=0, no_qa=0)
for mid, lst in data['ads'].items():
    if mid not in cat:
        report.append(f'skip (not in catalogue): {mid}')
        continue
    e = cat[mid]
    sets = []
    for a in lst:
        imgs = [u for u in (a.get('imgs') or []) if isinstance(u, str) and u.startswith('https://')]
        imgs = list(dict.fromkeys(imgs))[:10]
        imgs = [('h:' + u.split('haraj.com.sa/', 1)[1]) if 'haraj.com.sa/' in u else u for u in imgs]
        pid = a.get('pid')
        q = qa.get(pid)
        color = a.get('color')
        cab = a.get('cab')
        codes = [kind_of.get(u[2:] if u.startswith('h:') else u, 'U') for u in imgs]
        if any(c != 'U' for c in codes):
            keep = [(u, c) for u, c in zip(imgs, codes) if c not in DROP_CODES]
            stats['junk_photos'] += sum(1 for c in codes if c in DROP_CODES)
            first = next((k for k, (u, c) in enumerate(keep) if c == 'E'), None)
            if first is None:
                report.append(f'drop {pid} ({mid}): no exterior photo [{"".join(codes)}]')
                stats['dropped_noext'] += 1
                continue
            if first:
                stats['covers'] += 1
                report.append(f'cover {pid} ({mid}): photo {first + 1} is the first exterior [{"".join(codes)}]')
            # the exterior shots first (cover + three), then the cabin/engine/details in the seller's order
            ext = [u for u, c in keep if c == 'E']
            rest = [u for u, c in keep if c != 'E']
            imgs = [ext[0]] + ext[1:4] + rest + ext[4:]
            verified = True  # the cover is a checked exterior shot
            if q and not color and q['color'] != '-' and int(q['color'][1]) >= 7:
                color = COLOR_KEY.get(q['color'][0])
                stats['qa_color'] += 1
        else:
            verified = False
            stats['no_qa'] += 1
        imgs = imgs[:MAX_IMGS]
        if len(imgs) < 3:
            continue
        o = {'key': pid or (a.get('url') or '')[-12:], 'imgs': imgs}
        for k in ('title', 'city', 'km', 'value', 'trim', 'engine', 'hp', 'trans', 'fuel', 'drive'):
            v = a.get(k)
            if v not in (None, '', 0, []):
                o[k] = v
        if color:
            o['color'] = color
        if cab:
            o['cab'] = cab
        if verified:
            o['ext'] = True
        if a.get('damaged'):
            o['damaged'] = True
        if a.get('new'):
            o['isNew'] = True
        if a.get('feats'):
            o['feats'] = a['feats'][:8]
        if a.get('lines'):
            o['lines'] = a['lines'][:5]
        if a.get('text') and not a.get('lines'):
            o['text'] = a['text'][:400]
        sets.append(o)
        stats['ads'] += 1
    if sets:
        out[mid] = sets

lines = [
    '// GENERATED by scripts/build_photos.py from research/haraj_all.json (+ photo QA) — one entry per real Haraj ad.',
    'export interface AdSet {',
    '  /** stable id (Haraj post id) so a night never shows the same ad twice and the next night avoids it */',
    '  key: string;',
    '  imgs: string[];',
    '  title?: string;',
    '  city?: string | null;',
    '  km?: number | null;',
    "  /** this car's own market value (its asking price −7%) when that price is believable */",
    '  value?: number;',
    '  trim?: string;',
    '  engine?: string;',
    '  hp?: number;',
    "  trans?: 'AT' | 'MT';",
    "  fuel?: 'petrol' | 'diesel' | 'hybrid';",
    "  cab?: 'single' | 'double';",
    "  /** the drive the ad states («دبل» = 4x4, «بدون دبل» = two-wheel drive) */",
    "  drive?: 'FWD' | 'RWD' | 'AWD' | '4WD';",
    '  color?: string;',
    '  /** the first photo was checked to be the outside of the car */',
    '  ext?: boolean;',
    '  damaged?: boolean;',
    '  isNew?: boolean;',
    '  feats?: string[];',
    '  lines?: string[];',
    '  text?: string;',
    '}',
    '',
    'export const PHOTOS: Record<string, AdSet[]> = {',
]
for mid, sets in out.items():
    lines.append(f'  {json.dumps(mid)}: {json.dumps(sets, ensure_ascii=False, separators=(",", ":"))},')
lines.append('};')
lines.append('')
OUT.write_text('\n'.join(lines), encoding='utf-8')
Path('/home/claude/research/photo_qa_report.md').write_text('\n'.join(report) + '\n', encoding='utf-8')
print('models with photos:', len(out), 'ads:', sum(len(v) for v in out.values()), 'imgs:', sum(len(s['imgs']) for v in out.values() for s in v))
print('qa:', len(qa), stats)
