#!/usr/bin/env python3
"""Venue logos other CityMETER demos verified for the same venue id (owner 2026-11-24).

  python3 -I scripts/attach-family-venue-logos.py --family <dir holding the demo checkouts> --checked-on YYYY-MM-DD

Owner 2026-11-24 07:53, VERBATIM: “ทำไมหลายร้านในศูนย์การค้าเราควรจะมี logo แล้ว แต่เวบเดโมไม่แสดงโลโก้ แก้ให้ครบทุก venue
และตรวจใน dataset อื่นๆด้วยในเคสนี้หาวิธีแก้ที่แก้ได้ทุกที่เหมือนกัน”. The check of that day found 14 venues of this demo
without a logo while CityMETER · Camera Shops shipped one under the same venue id (Seacon Square, Future Park & Zpell, Central
Si Racha, Robinson Lifestyle branches …). The shared kit (scripts/logo-kit/citymeter_logos.py, VenuePool, citymeter-logos
1.1.0 — D65 of CityMETER · Shopping Center) links a venue logo by the venue id only (a venue's scId here): one artwork with one
role across the other demos, else none; the original bytes before a downscale; never by name or distance.

Writes data/venue-logo-links.json ({meta, logos, venues: scId → key}) and assets/venue-logos-family/<sha20>.<ext> (bytes as
the source demo shipped them). data/fitness.json and data/venue-logos.json are not changed; js/logos.js uses a link only
for a venue the registry leaves without a logo. Run it after every rebuild of either file
(tests/venue-logo-links.test.js fails while the bound hashes differ).
"""
import argparse
import collections
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'scripts' / 'logo-kit'))
import citymeter_logos as kit  # noqa: E402

EXT = {'image/svg+xml': 'svg', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp'}
FOLDER = 'assets/venue-logos-family'


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--family', required=True)
    ap.add_argument('--checked-on', required=True)
    a = ap.parse_args()
    family = os.path.abspath(a.family)
    if Path(family, 'fitness').resolve() != ROOT:
        sys.exit(f'--family must hold this checkout as fitness/ ({ROOT})')
    pool = kit.build_venue_pool(family)
    if pool.issues:
        sys.exit(f'venue pool issues: {pool.issues[:5]}')
    data_path, reg_path = ROOT / 'data' / 'fitness.json', ROOT / 'data' / 'venue-logos.json'
    venues = json.loads(data_path.read_text(encoding='utf-8'))['venues']
    own_keys = {r['key'] for r in json.loads(reg_path.read_text(encoding='utf-8'))['logos']}
    out = ROOT / FOLDER
    out.mkdir(parents=True, exist_ok=True)
    logos, links, keep, counts, by_repo = {}, {}, set(), collections.Counter(), collections.Counter()
    for v in venues:
        sc = v.get('scId')
        if not sc:
            counts['noScId'] += 1
            continue
        if v.get('logo') in own_keys:
            counts['own'] += 1
            continue
        hit, why = pool.resolve(sc, exclude=('fitness',))
        if not hit:
            counts[why] += 1
            continue
        rec = pool.files[hit['sha256']]
        key = 'FVL-' + rec['sha256'][:16]
        file = f'{FOLDER}/{rec["sha256"][:20]}.{EXT[rec["mime"]]}'
        target = ROOT / file
        if target.exists():
            if kit.sha256_file(target) != rec['sha256']:
                sys.exit(f'{file} exists with other bytes')
        else:
            target.write_bytes(open(os.path.join(family, rec['repo'], rec['path']), 'rb').read())
        keep.add(target.name)
        logos.setdefault(key, {'key': key, 'file': file, 'mime': rec['mime'], 'bytes': rec['bytes'], 'sha256': rec['sha256'],
                               'width': rec['width'], 'height': rec['height'], 'background': rec['background'], 'role': hit['role'],
                               'sourcePage': rec['sourcePage'], 'from': rec['repo'], 'sourcePath': rec['path']})
        links[sc] = key
        counts['added'] += 1
        by_repo[hit['repo']] += 1
    stale = sorted(f.name for f in out.iterdir() if f.name not in keep)
    for name in stale:
        (out / name).unlink()
    body = {
        'meta': {
            'schemaVersion': '1', 'kit': f'{kit.KIT} {kit.VERSION}', 'checkedOn': a.checked_on,
            'rule': 'A venue the registry (data/venue-logos.json) leaves without a logo takes the logo another CityMETER demo links to the same venue id (scId): one artwork with one role, else none; never by name or distance',
            'rights': 'โลโก้ใช้ระบุชื่อสถานที่บนจอ ไม่เปลี่ยนการนับ การรวบรวมไฟล์ไม่ใช่ใบอนุญาตเครื่องหมายการค้า สิทธิ์ยังเป็นของเจ้าของ',
            'inputs': {'fitnessSha256': kit.sha256_file(data_path), 'registrySha256': kit.sha256_file(reg_path)},
            'pool': {k: v for k, v in pool.summary().items() if k != 'issues'},
            'counts': {'venues': len(venues), 'withOwnLogo': counts['own'], 'added': counts['added'], 'byDemo': dict(sorted(by_repo.items())),
                       'ambiguous': counts['ambiguous'], 'roleConflict': counts['role-conflict'], 'none': counts['none'], 'noScId': counts['noScId']},
            'filesRemoved': stale,
        },
        'logos': sorted(logos.values(), key=lambda x: x['key']),
        'venues': dict(sorted(links.items())),
    }
    (ROOT / 'data' / 'venue-logo-links.json').write_text(json.dumps(body, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(json.dumps(body['meta']['counts'], ensure_ascii=False), f'files {len(logos)}')


if __name__ == '__main__':
    main()
