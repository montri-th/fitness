#!/usr/bin/env python3
"""Build the public brand-logo registry: assets/brand-logos/ + data/brand-logos.json.

  python3 -I scripts/build-logos.py --library <unzipped "CityMETER-Fitness-Brand-Logos-YYYY-MM-DD" folder>
                                    --sheet <16_BRAND_LOGOS.csv exported from the research master> --out <repo root>

Inputs (internal, never committed): the research team's logo library (manifest.json + assets/, every file hashed)
and the sheet tab 16_BRAND_LOGOS (one row per brand, logo_sha256). The build stops when a file, the manifest and
the sheet disagree on a SHA-256, when a brand has no logo, or when a public URL is not a public https page.

Output, per brand (01_BRANDS brand_id): one display file named by the brand id.
  - the original bytes when the file is already display-sized (SVG, or raster ≤ 512 px and ≤ 64 KB);
  - otherwise a downscaled copy (longest side 384 px, never upscaled; WebP lossless when the image has alpha,
    else WebP quality 90). Colours, proportions and background are unchanged; the original's SHA-256, size and
    public asset URL stay in the record and the operation is listed under transformations;
  - a transparent canvas whose artwork fills less than 60 % of it is first trimmed to the artwork's alpha box plus a
    6 % margin (empty transparent pixels only — never ink, never an opaque background), so a small wordmark on a
    large empty canvas still reads at list size.
Never copied: Drive file ids or URLs, researcher notes, the library's internal file names.
The display backing is theme-invariant (the same in light and dark): the library's recommended surface.
"""
import argparse, csv, hashlib, io, json, os, re, shutil, sys

from PIL import Image

MAX_EDGE, MAX_BYTES, TARGET_EDGE = 512, 64 * 1024, 384
SURFACE = {  # recommended_surface → backing colour (LDS foundation values, light theme, used in both themes)
    'light': '#FFFFFF',            # surface.raised@light
    'dark': '#182327',             # text.primary@light (deep ink surface)
    'mid-tone neutral': '#7B877D',  # text.muted@light
}
SURFACE_KEY = {'light': 'light', 'dark': 'dark', 'mid-tone neutral': 'mid'}
# Display-only corrections after a visual check (2026-10-30): white artwork that disappears on the library's light
# surface. The sheet keeps its value; the correction is reported to the research team and noted in each record.
SURFACE_OVERRIDE = {
    'BR-FIT-4654a5e369a3': ('dark', 'white wordmark (CULT, FITNESS SOCIETY) is invisible on light; shown on dark'),
    'BR-FIT-6cae7a1adacd': ('dark', 'white ROCK CANYON wordmark and ridge line are invisible on light; shown on dark'),
    'BR-FIT-e24341a4c506': ('dark', 'white figure and "ness" letters are invisible on light; shown on dark'),
}
OPAQUE = {'solid', 'source_solid_background', 'solid background (source original)'}
MIME_EXT = {'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg'}
PRIVATE_HOST = re.compile(r'(^|\.)(drive\.google\.com|docs\.google\.com|drive\.usercontent\.google\.com|googleusercontent\.com|goo\.gl)$')


def sha(b):
    return hashlib.sha256(b).hexdigest()


def public_url(value):
    v = (value or '').split('\n')[0].strip()
    if not v.startswith('https://'):
        return ''
    host = re.sub(r'^https://([^/:?#]+).*$', r'\1', v).lower()
    return '' if PRIVATE_HOST.search(host) or '.' not in host else v


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--library', required=True)
    ap.add_argument('--sheet', required=True)
    ap.add_argument('--brands', required=True, help='01_BRANDS.csv (brand ids and names)')
    ap.add_argument('--out', required=True)
    a = ap.parse_args()

    man = json.load(open(os.path.join(a.library, 'manifest.json'), encoding='utf-8'))
    assets = {x['asset_id']: x for x in man['assets']}
    sheet = {r['brand_id'].strip(): r for r in csv.DictReader(open(a.sheet, encoding='utf-8')) if r.get('brand_id', '').strip()}
    brands = {r['brand_id'].strip(): r['brand_name'].strip() for r in csv.DictReader(open(a.brands, encoding='utf-8')) if r.get('brand_id', '').strip()}
    out_dir = os.path.join(a.out, 'assets', 'brand-logos')
    if os.path.isdir(out_dir):
        shutil.rmtree(out_dir)
    os.makedirs(out_dir)

    records, problems = [], []
    for m in man['mappings']:
        bid = m['entity_id']
        if bid not in brands:
            problems.append(f'{bid}: not in 01_BRANDS'); continue
        if m.get('result') != 'collected':
            problems.append(f'{bid}: result {m.get("result")}'); continue
        x = assets[m['asset_id']]
        raw = open(os.path.join(a.library, x['filename']), 'rb').read()
        h = sha(raw)
        row = sheet.get(bid)
        if h != x['sha256'] or len(raw) != x['bytes']:
            problems.append(f'{bid}: file differs from the manifest'); continue
        if not row or row.get('logo_sha256', '').strip().lower() != h:
            problems.append(f'{bid}: 16_BRAND_LOGOS sha256 differs or row missing'); continue
        mime = x['mime_type']
        if mime not in MIME_EXT:
            problems.append(f'{bid}: unsupported mime {mime}'); continue
        source_page, asset_url = public_url(x.get('source_page_url')), public_url(x.get('source_asset_url'))
        if not source_page:
            problems.append(f'{bid}: no public source page'); continue
        transformations = []
        for t in x.get('transformations') or []:   # recorded by the library (e.g. AVIF → PNG recontainer)
            transformations.append({k: v for k, v in t.items() if k in ('operation', 'source_sha256', 'geometry', 'decoded_pixel_parity', 'geometry_changed', 'output_sha256')})
        data, out_mime, width, height = raw, mime, x['width'], x['height']
        if mime == 'image/svg+xml':
            head = raw[:600].decode('utf-8', 'replace')
            if re.match(r'\s*(<\?xml[^>]*>\s*)?<svg\b', head) and 'xmlns="http://www.w3.org/2000/svg"' not in head:
                # Extracted from inline HTML: a standalone .svg needs the SVG namespace to render; the drawing is unchanged.
                data = re.sub(rb'<svg\b', b'<svg xmlns="http://www.w3.org/2000/svg"', raw, count=1)
                transformations.append({'operation': 'add_svg_namespace', 'source_sha256': h,
                                        'reason': 'inline-extracted SVG lacks xmlns; added so the file renders as an image. Paths, colours and viewBox unchanged.'})
        trim = None
        if mime != 'image/svg+xml':
            im = Image.open(io.BytesIO(raw))
            im.load()
            alpha = im.mode in ('RGBA', 'LA', 'PA') or (im.mode == 'P' and 'transparency' in im.info)
            if alpha:
                # Empty transparent margin only (never ink): the artwork's alpha box plus a margin of 6 % of its long side.
                box = im.convert('RGBA').getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
                if box:
                    bw, bh = box[2] - box[0], box[3] - box[1]
                    if bw * bh < 0.6 * im.size[0] * im.size[1]:
                        pad = max(2, round(0.06 * max(bw, bh)))
                        trim = (max(0, box[0] - pad), max(0, box[1] - pad), min(im.size[0], box[2] + pad), min(im.size[1], box[3] + pad))
        if mime != 'image/svg+xml' and (trim or max(width, height) > MAX_EDGE or len(raw) > MAX_BYTES):
            im = Image.open(io.BytesIO(raw))
            im.load()
            alpha = im.mode in ('RGBA', 'LA', 'PA') or (im.mode == 'P' and 'transparency' in im.info)
            im = im.convert('RGBA' if alpha else 'RGB')
            if trim:
                im = im.crop(trim)
                transformations.append({'operation': 'trim_transparent_margin', 'source_sha256': h, 'source_size': [x['width'], x['height']],
                                        'kept_box': list(trim), 'rule': 'alpha bounding box (alpha > 8) + 6 % of its long side; transparent pixels only, artwork unchanged'})
            scale = min(1.0, TARGET_EDGE / max(im.size))
            size = (max(1, round(im.size[0] * scale)), max(1, round(im.size[1] * scale)))
            if size != im.size:
                im = im.resize(size, Image.LANCZOS)
            buf = io.BytesIO()
            if alpha:
                im.save(buf, 'WEBP', lossless=True, quality=100, method=6)
            else:
                im.save(buf, 'WEBP', quality=90, method=6)
            data, out_mime, (width, height) = buf.getvalue(), 'image/webp', im.size
            transformations.append({'operation': 'display_downscale' if not trim else 'display_encode', 'source_sha256': h, 'source_size': [x['width'], x['height']],
                                    'output_size': [width, height], 'method': f'Pillow LANCZOS to at most {TARGET_EDGE} px longest side; WebP ' + ('lossless' if alpha else 'quality 90'),
                                    'colour_and_geometry': 'unchanged (uniform scale only)'})
        name = f"{bid.lower()}.{MIME_EXT[out_mime]}"
        open(os.path.join(out_dir, name), 'wb').write(data)
        surface = x.get('recommended_surface', 'light')
        if surface not in SURFACE:
            problems.append(f'{bid}: unknown surface {surface}'); continue
        surface_note = ''
        if bid in SURFACE_OVERRIDE:
            surface_note = f"library surface {surface}; {SURFACE_OVERRIDE[bid][1]} (visual check 2026-10-30)"
            surface = SURFACE_OVERRIDE[bid][0]
        records.append({
            'brand': bid, 'name': brands[bid], 'file': f'assets/brand-logos/{name}', 'mime': out_mime, 'bytes': len(data),
            'sha256': sha(data), 'width': width, 'height': height,
            'original': {'sha256': h, 'mime': mime, 'bytes': len(raw), 'width': x['width'], 'height': x['height']},
            'surface': SURFACE_KEY[surface], 'backing': SURFACE[surface], 'opaque': x.get('background') in OPAQUE,
            **({'surfaceNote': surface_note} if surface_note else {}),
            'role': m.get('logo_role', 'brand_primary'), 'tier': x.get('source_tier', ''),
            'sourcePage': source_page, 'assetURL': asset_url, 'checkedOn': man.get('checked_on', ''),
            'rights': x.get('rights', {}).get('notice', ''), 'transformations': transformations,
        })
    missing = sorted(set(brands) - {r['brand'] for r in records})
    if missing:
        problems.append(f'brands without a logo: {missing}')
    if problems:
        sys.exit('logo registry not built:\n  ' + '\n  '.join(problems))
    records.sort(key=lambda r: r['brand'])
    meta = {
        'asOf': man.get('checked_on', ''), 'count': len(records), 'brands': len(brands),
        'source': 'CityMETER Fitness Thailand — Research Master, tab 16_BRAND_LOGOS, and the research team\'s logo library (every file SHA-256 checked against the tab)',
        'publicationBasis': 'user_requested_brand_identity_display',
        'identityRole': 'Identify the brand next to its name in pins, lists, charts and panels; the brand name stays the record of identity',
        'display': f'original bytes when display-sized (SVG, or raster ≤ {MAX_EDGE} px and ≤ {MAX_BYTES // 1024} KB); otherwise a uniform downscale to {TARGET_EDGE} px longest side (WebP); a large empty transparent margin is trimmed to the artwork + 6 % — no recolouring, ink cropping, tracing or upscaling',
        'backing': 'theme-invariant backing from the library\'s recommended surface: light #FFFFFF, dark #182327, mid-tone #7B877D; opaque files cover their own backing',
        'roles': {'brand_primary': 'โลโก้ของแบรนด์', 'shared_chain_banner': 'โลโก้ร่วมของเครือ (ไม่ใช่โลโก้เฉพาะแบรนด์ย่อย)'},
        'rights': 'เครื่องหมายเป็นของเจ้าของแต่ละราย การแสดงเพื่อระบุแบรนด์ในเดโมนี้ไม่ใช่การรับรองหรือใบอนุญาตเครื่องหมายการค้า',
        'sha256': '',
    }
    body = {'meta': meta, 'logos': records}
    meta['sha256'] = sha(json.dumps(records, ensure_ascii=False, sort_keys=True).encode())
    os.makedirs(os.path.join(a.out, 'data'), exist_ok=True)
    with open(os.path.join(a.out, 'data', 'brand-logos.json'), 'w', encoding='utf-8') as fh:
        json.dump(body, fh, ensure_ascii=False, separators=(',', ':'))
    total = sum(r['bytes'] for r in records)
    print(f'brand logos: {len(records)} files, {total / 1024:.0f} KB; downscaled {sum(1 for r in records if any(t["operation"] == "display_downscale" for t in r["transformations"]))}')


if __name__ == '__main__':
    main()
