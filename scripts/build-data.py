#!/usr/bin/env python3
"""Build data/fitness.json from the fitness research master and CityMETER production boundaries.

Inputs (internal, never committed):
  --export   text export of “CityMETER Fitness Thailand — Research Master 2026-10-26” (one CSV block per tab, each
             headed by '## Sheet name: <tab>'); tabs read: 00_README, 01_BRANDS, 02_STORES, 07_SHOPPING_CENTERS,
             11_COMPANIES, 12_RELATIONSHIPS, 13_SOURCES, 14_NETWORK_COVERAGE, 15_SISTER_BRANDS
  --api      production base info responses with receipts (base-lv0.json, base-{province uuid}.json, *.meta.json)
  --ogd      OpenGISData-Thailand districts.geojson + subdistricts.geojson at commit fafcea1 (English names, postcodes)
  --geom     production SUBDISTRICT geometry responses (+ .meta.json receipts) for the points that sit near a district edge
Public inputs (in the repository):
  --index    data/area-index.json   (districts and provinces: codes, names, production areaSqm, label, bbox)
  --frames   data/frames/            (district outlines per province, display geometry)

Output: data/fitness.json — columnar rows + dictionaries + provenance.

One row = one row of 02_STORES (a source-qualified branch observation, as the sheet defines it). Nothing is
merged, split, moved or re-labelled; the build only adds the join to production district codes:

ADMIN METHODS (the first that applies)
  point     the row's published source point lies in a production district (display outline; a point within
            EDGE_M of a district edge is confirmed on full-resolution production subdistrict geometry)
  host      the row's CityMETER Shopping Center id → that venue's registry reference point → production district
  address   the row's own address text names the district (scripts/admin_text.py: marker · pair · mueang · trailing)
  province  province only — the sheet's province, else the province the address itself states
  conflict  the sheet's province disagrees with the row's own address or point: placed nowhere, reported
  none      no province anywhere in the row
A province disagreement is never settled by choosing a side: the row stays in the national total, outside
every area, and is listed in meta.conflicts for the research team.

Not copied: addresses, unit/floor, phone numbers, map links, coordinates' raw strings, researcher notes, branch
source ids, company research notes, internal sheet URLs. Source links are public https pages of the operator.
"""
import argparse, collections, csv, datetime, hashlib, io, json, math, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from admin_text import Gazetteer, resolve, address_province, postcode_provinces  # noqa: E402

EDGE_M = 150

GROUPS = [
    # id, Thai, English, segments of 01_BRANDS / 02_STORES
    ('gym', 'ยิม/ฟิตเนสคลับ', 'Gym & fitness club', ['gym_club', 'gym_chain', 'gym_independent']),
    ('ems', 'ฟิตเนส EMS', 'EMS fitness', ['gym_chain_ems']),
    ('training', 'เทรนนิ่ง/PT', 'Strength, functional & PT', ['strength_functional_pt']),
    ('pilates', 'พิลาทิส/บาร์เร่', 'Pilates, barre & Lagree', ['pilates_barre_lagree', 'pilates_reformer', 'pilates_hot_mat', 'pilates_multiclass']),
    ('boutique', 'คลาสบูทีค/เต้น', 'Boutique classes & dance', ['boutique_multiclass', 'dance_fitness']),
    ('yoga', 'โยคะ/แอเรียล', 'Yoga, aerial & pole', ['yoga_aerial_pole', 'yoga']),
    ('combat', 'มวย/ต่อสู้', 'Combat fitness', ['combat_fitness']),
    ('climb', 'ปีนผา/มูฟเมนต์', 'Climbing & movement', ['climbing_bouldering', 'parkour_movement']),
    ('special', 'บริการเฉพาะ', 'Kids, retreat & studio rental', ['kids_activity', 'fitness_retreat_multisport', 'self_practice_rental']),
]
SEGMENT_GROUP = {seg: i for i, g in enumerate(GROUPS) for seg in g[3]}
SEGMENT_TH = {
    'gym_club': 'ฟิตเนสคลับ', 'gym_chain': 'ยิมเครือ', 'gym_independent': 'ยิมอิสระ', 'gym_chain_ems': 'ฟิตเนส EMS',
    'strength_functional_pt': 'สตรองก์/ฟังก์ชันนัล/PT', 'pilates_barre_lagree': 'พิลาทิส/บาร์เร่/ลากรี', 'pilates_reformer': 'พิลาทิสรีฟอร์มเมอร์',
    'pilates_hot_mat': 'ฮอตพิลาทิส', 'pilates_multiclass': 'พิลาทิสหลายคลาส', 'boutique_multiclass': 'สตูดิโอบูทีค', 'dance_fitness': 'เต้น/แดนซ์ฟิตเนส',
    'yoga_aerial_pole': 'โยคะ/แอเรียล/โพล', 'yoga': 'โยคะ', 'combat_fitness': 'มวย/ศิลปะการต่อสู้', 'climbing_bouldering': 'ปีนผา/โบลเดอริง',
    'parkour_movement': 'พาร์คัวร์/มูฟเมนต์', 'kids_activity': 'กิจกรรมเด็ก', 'fitness_retreat_multisport': 'รีทรีต/สปอร์ตคลับ',
    'self_practice_rental': 'เช่าสตูดิโอฝึกเอง',
}
# Operating status of the sheet → the four states the product counts apart (never summed into one figure).
STATUS = ['listed', 'announced', 'closed', 'review']
STATUS_OF = {
    'source_listed': 'listed',
    'announced_opening_soon': 'announced', 'announced_coming_soon': 'announced', 'announced_presale': 'announced',
    'announced_opening_date_today': 'announced',
    'permanently_closed': 'closed', 'closed_official': 'closed',
    'source_status_unknown': 'review', 'primary_network_listed_location_unresolved': 'review',
    'official_profile_listed_source_conflict': 'review', 'primary_listed_detail_refresh_pending': 'review',
}
ADMIN = ['point', 'host', 'address', 'province', 'conflict', 'none']
ADDRESS_HOW = ['', 'marker', 'pair', 'mueang', 'trailing']
POINT_ROLES = ['store_source_point', 'operator_published_map_destination_point', 'official_social_profile_map_point_historical',
               'host_registry_reference_point']
SOURCE_TYPES = ['official_operator_page', 'official_operator_web', 'official_operator_locator_rendered', 'official_operator_social',
                'official_line_oa', 'official_operator_facebook', 'official_operator_network_locator', 'official_linktree',
                'official_operator_facebook_closure_notice', 'official_operator_website', 'official_company_profile_index',
                'official_facebook_rendered', 'official_host_directory']
COVERAGE = ['full', 'full_locator_enumerated', 'official_sites_enumerated', 'partial']
PRIVATE_HOST = re.compile(r'(^|\.)(drive\.google\.com|docs\.google\.com|drive\.usercontent\.google\.com|googleusercontent\.com|maps\.app\.goo\.gl|goo\.gl)$')
MAPS_PATH = re.compile(r'^https://(www\.)?google\.[a-z.]+/maps', re.I)


def text(v):
    return '' if v is None else str(v).strip()


def iso(v):
    s = text(v)
    m = re.match(r'^(\d{1,2})/(\d{1,2})/(\d{4})$', s)
    if m:
        mo, d, y = map(int, m.groups())          # the export writes M/D/YYYY
        return f'{y:04d}-{mo:02d}-{d:02d}'
    m = re.match(r'^(\d{4}-\d{2}-\d{2})', s)
    return m.group(1) if m else s


def public_url(value):
    v = text(value).split('\n')[0].strip()
    if not v.startswith('https://'):
        return ''
    host = re.sub(r'^https://([^/:?#]+).*$', r'\1', v).lower()
    if PRIVATE_HOST.search(host) or MAPS_PATH.match(v):
        return ''
    return v


def read_export(path):
    """{tab: [row dict]} from the '## Sheet name:' text export, or from an .xlsx export of the same sheet."""
    raw = open(path, 'rb').read()
    if path.lower().endswith('.xlsx'):
        return read_xlsx(raw), hashlib.sha256(raw).hexdigest()
    body = raw.decode('utf-8')
    parts = re.split(r'^## Sheet name: (.+)$', body, flags=re.M)
    tabs = {}
    for i in range(1, len(parts), 2):
        rows = list(csv.reader(io.StringIO(parts[i + 1].strip('\n'))))
        header = rows[0] if rows else []
        tabs[parts[i].strip()] = [dict(zip(header, r)) for r in rows[1:] if any(c.strip() for c in r)]
    return tabs, hashlib.sha256(raw).hexdigest()


def xlsx_text(v):
    """Cell value → the text the CSV export writes: whole numbers without '.0', dates as YYYY-MM-DD."""
    if v is None:
        return ''
    if isinstance(v, bool):
        return 'TRUE' if v else 'FALSE'
    if isinstance(v, datetime.datetime):
        return v.strftime('%Y-%m-%d') if (v.hour, v.minute, v.second) == (0, 0, 0) else v.isoformat(sep=' ')
    if isinstance(v, datetime.date):
        return v.isoformat()
    if isinstance(v, float):
        return str(int(v)) if v.is_integer() and abs(v) < 1e15 else repr(v)
    return str(v)


def read_xlsx(raw):
    import openpyxl
    wb = openpyxl.load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
    tabs = {}
    for ws in wb.worksheets:
        rows = [[xlsx_text(c) for c in r] for r in ws.iter_rows(values_only=True)]
        header = [h.strip() for h in rows[0]] if rows else []
        tabs[ws.title.strip()] = [dict(zip(header, r)) for r in rows[1:] if any(c.strip() for c in r)]
    return tabs


def haversine_m(a, b):
    """Great-circle distance in metres between two (lat, lon) points."""
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    h = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(b[1] - a[1]) / 2) ** 2
    return 2 * 6371008.8 * math.asin(math.sqrt(h))


class Registry:
    """Read-only snapshot of the CityMETER Shopping Centers & Retail Venues registry as published by the Shopping
    Centers demo (data/venues.json + data/details/*.json + data/venue-logos.json at a pinned commit). Every file read
    is hashed into meta.registry. Used for the reference point of a venue the research sheet links (accepted) that the
    sheet's own 07_SHOPPING_CENTERS tab does not carry."""

    def __init__(self, root):
        self.root, self.files, self.venues = root, {}, {}
        if not root:
            return
        details = os.path.join(root, 'data', 'details')
        for name in sorted(os.listdir(details)):
            raw = self._read(os.path.join('data', 'details', name))
            self.venues.update(json.loads(raw)['venues'])
        meta = json.loads(self._read(os.path.join('data', 'venues.json')))['meta']
        self.as_of = meta.get('asOf', '')
        self.logos = json.loads(self._read(os.path.join('data', 'venue-logos.json')))

    def _read(self, rel):
        raw = open(os.path.join(self.root, rel), 'rb').read()
        self.files[rel.replace(os.sep, '/')] = hashlib.sha256(raw).hexdigest()
        return raw

    def logo_of(self, vid):
        by_key = {a['key']: a for a in self.logos.get('assets', [])}
        for v in self.logos.get('venues', []):
            if v.get('id') == vid and v.get('key') in by_key:
                return {**by_key[v['key']], 'role': v.get('role', '')}
        return None


class DistrictLocator:
    """Point → district code on the display outlines; reports the distance to the nearest district edge."""

    def __init__(self, frames_dir, index):
        self.items = []
        for p in index['provinces']:
            path = os.path.join(frames_dir, f"{p['id']}.json")
            fc = json.load(open(path, encoding='utf-8'))['areas']
            for f in fc['features']:
                g = f['geometry']
                polys = [g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']
                xs = [x for poly in polys for x, _ in poly[0]]
                ys = [y for poly in polys for _, y in poly[0]]
                self.items.append((str(f['id']), polys, min(xs), min(ys), max(xs), max(ys)))

    @staticmethod
    def _in_ring(x, y, ring):
        inside, j = False, len(ring) - 1
        for i in range(len(ring)):
            xi, yi = ring[i]; xj, yj = ring[j]
            if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
                inside = not inside
            j = i
        return inside

    @staticmethod
    def _edge_m(x, y, polys):
        kx, ky = 111320 * math.cos(math.radians(y)), 110574
        best = float('inf')
        for poly in polys:
            for ring in poly:
                for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
                    ax, ay, bx, by = (x1 - x) * kx, (y1 - y) * ky, (x2 - x) * kx, (y2 - y) * ky
                    dx, dy = bx - ax, by - ay
                    t = 0 if dx == dy == 0 else max(0, min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy)))
                    best = min(best, math.hypot(ax + t * dx, ay + t * dy))
        return best

    def locate(self, lon, lat):
        for code, polys, w, s, e, n in self.items:
            if lon < w or lon > e or lat < s or lat > n:
                continue
            for poly in polys:
                if self._in_ring(lon, lat, poly[0]) and not any(self._in_ring(lon, lat, h) for h in poly[1:]):
                    return code, self._edge_m(lon, lat, polys)
        return '', 0.0


class FullResolution:
    """Full-resolution production subdistrict polygons (receipt-checked) for the points that sit near a district edge.

    The geometry directory holds the subdistricts within 400 m of every such point (scripts/fetch-edge-geometry.py)."""

    def __init__(self, geom_dir, gaz):
        by_uuid = {s['id']: c for c, s in gaz.subs.items()}
        self.items = []
        for name in sorted(os.listdir(geom_dir)) if os.path.isdir(geom_dir) else []:
            if not (name.startswith('SUBDISTRICT-') and name.endswith('.json')) or name.endswith('.meta.json'):
                continue
            path = os.path.join(geom_dir, name)
            raw = open(path, 'rb').read()
            meta = json.load(open(path[:-5] + '.meta.json'))
            if meta.get('status') != 200 or meta.get('sha256') != hashlib.sha256(raw).hexdigest():
                sys.exit(f'unverified geometry receipt: {path}')
            v = json.loads(raw)
            g = v.get('value', v)
            g = json.loads(g) if isinstance(g, str) else g
            if isinstance(g, dict) and 'geometry' in g:
                g = g['geometry']
            polys = [g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']
            xs = [x for poly in polys for x, _ in poly[0]]
            ys = [y for poly in polys for _, y in poly[0]]
            code = by_uuid.get(name[len('SUBDISTRICT-'):-5])
            if code:
                self.items.append((code, polys, min(xs), min(ys), max(xs), max(ys)))
        self.receipts = len(self.items)

    def subdistrict_of(self, lon, lat):
        for code, polys, w, s, e, n in self.items:
            if lon < w or lon > e or lat < s or lat > n:
                continue
            if any(DistrictLocator._in_ring(lon, lat, p[0]) and not any(DistrictLocator._in_ring(lon, lat, h) for h in p[1:]) for p in polys):
                return code
        return None


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--export', required=True)
    ap.add_argument('--api', required=True)
    ap.add_argument('--ogd', required=True)
    ap.add_argument('--geom', required=True)
    ap.add_argument('--index', required=True)
    ap.add_argument('--frames', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--registry', default='', help='checkout of montri-th/shoppingcenter (registry snapshot for linked venues)')
    ap.add_argument('--registry-commit', default='', help='git commit of that checkout (recorded in meta.registry)')
    ap.add_argument('--audit', help='write a row-by-row admin audit (internal; contains address words) to this path')
    a = ap.parse_args()
    registry = Registry(a.registry)

    tabs, export_sha = read_export(a.export)
    gaz = Gazetteer(a.api, os.path.join(a.ogd, 'districts.geojson'), os.path.join(a.ogd, 'subdistricts.geojson'))
    postcode_index = collections.defaultdict(set)
    for f in json.load(open(os.path.join(a.ogd, 'districts.geojson'), encoding='utf-8'))['features']:
        for pc in f['properties'].get('postcode') or []:
            postcode_index[pc].add(f['properties']['amp_code'])
    index = json.load(open(a.index, encoding='utf-8'))
    index_districts = set(index['areas']['id'])
    locator = DistrictLocator(a.frames, index)
    full = FullResolution(a.geom, gaz)
    abbr = {c: p['abbr'] for c, p in gaz.provinces.items()}

    readme = {text(r.get('หัวข้อ')): text(r.get('รายละเอียด')) for r in tabs['00_README']}
    checked = '2026-10-26'

    # ---- companies and relationships ----
    companies, company_index = [], {}
    for c in tabs['11_COMPANIES']:
        cid = text(c.get('company_id'))
        if not cid:
            continue
        company_index[cid] = len(companies)
        companies.append({'id': cid, 'name': text(c.get('company_name')), 'jurisdiction': text(c.get('jurisdiction')),
                          'entity': text(c.get('entity_type')), 'verification': text(c.get('verification_status')),
                          'url': public_url(c.get('source_url')), 'checkedOn': iso(c.get('checked_on'))})
    relationships = []
    for r in tabs['12_RELATIONSHIPS']:
        subj, obj = text(r.get('subject_entity_id')), text(r.get('object_entity_id'))
        if subj not in company_index:
            sys.exit(f"relationship {r.get('relationship_id')}: company {subj} not in 11_COMPANIES")
        relationships.append({'id': text(r.get('relationship_id')), 'company': subj, 'objectType': text(r.get('object_entity_type')),
                              'object': obj, 'type': text(r.get('relationship_type')), 'scope': text(r.get('geographic_scope')),
                              'evidence': text(r.get('evidence_status')), 'url': public_url(r.get('source_url')),
                              'sourceDate': iso(r.get('source_date')), 'checkedOn': iso(r.get('checked_on'))})

    # ---- brands ----
    coverage_tab = {text(r.get('brand_id')): r for r in tabs['14_NETWORK_COVERAGE']}
    brands, brand_index = [], {}
    for b in tabs['01_BRANDS']:
        bid = text(b.get('brand_id'))
        if not bid:
            continue
        seg = text(b.get('segment'))
        if seg not in SEGMENT_GROUP:
            sys.exit(f'unknown brand segment {seg!r} for {bid}')
        cov = text(b.get('branch_coverage'))
        brand_index[bid] = len(brands)
        brands.append({
            'id': bid, 'name': text(b.get('brand_name')), 'segment': seg, 'group': GROUPS[SEGMENT_GROUP[seg]][0],
            'url': public_url(b.get('source_url')), 'scope': text(b.get('scope_status')), 'origin': text(b.get('record_origin')),
            'coverage': cov, 'checkedOn': iso(b.get('checked_on')),
            'operator': text(b.get('operator_company_id')), 'owner': text(b.get('brand_owner_company_id')), 'parent': text(b.get('parent_company_id')),
            'corporate': text(b.get('corporate_evidence_status')), 'corporateUrl': public_url(b.get('corporate_source_url')),
            'logo': text(b.get('logo_status')) or 'not_collected',
        })
    # ---- venues (CityMETER Shopping Center registry reference points) ----
    # 07_SHOPPING_CENTERS first (the sheet's own bounded copy); a venue the sheet links (accepted) that 07 does not
    # carry comes from the registry snapshot by its registry id (common_retail_venue_ids). Keys: the CityMETER UUID
    # (citymeter_shopping_center_id) and the registry id, both pointing at one venue.
    venues, venue_index, venue_logo_files = [], {}, {}
    ROLE_POINT = 'host_registry_reference_point_not_shopfront_or_entrance'

    def add_venue(rec):
        venue_index[rec['id']] = len(venues)
        if rec.get('scId'):
            venue_index[rec['scId']] = len(venues)
        venues.append(rec)
        return len(venues) - 1

    for v in tabs['07_SHOPPING_CENTERS']:
        vid = text(v.get('citymeter_id'))
        if not vid:
            continue
        lat, lon = float(v['latitude']), float(v['longitude'])
        dcode, edge = locator.locate(lon, lat)
        add_venue({'id': vid, 'scId': text(v.get('mall_external_id')), 'name': text(v.get('name_en')), 'nameTh': text(v.get('name_th')),
                   'latitude': round(lat, 6), 'longitude': round(lon, 6), 'district': dcode, 'districtTh': text(v.get('district')),
                   'type': text(v.get('mall_type')), 'format': text(v.get('building_format')),
                   'role': ROLE_POINT, 'edgeM': round(edge), 'from': '07'})
        if dcode and gaz.districts[dcode]['th'] != text(v.get('district')):
            sys.exit(f"venue {vid}: registry district {v.get('district')} ≠ located {gaz.districts[dcode]['th']}")

    def registry_venue(rid, uuid):
        """A registry venue (located or not) as a venue record; None when the registry has no such id."""
        r = registry.venues.get(rid)
        if not r:
            return None
        if uuid and r.get('citymeterId') and r['citymeterId'] != uuid:
            sys.exit(f'venue {rid}: CityMETER UUID in the sheet {uuid} ≠ registry {r["citymeterId"]}')
        located = bool(r.get('located')) and r.get('lat') is not None and r.get('lon') is not None
        rec = {'id': r.get('citymeterId') or rid, 'scId': rid, 'name': text(r.get('nameEn')) or text(r.get('name')),
               'nameTh': text(r.get('nameTh')) if text(r.get('nameTh')) != (text(r.get('nameEn')) or text(r.get('name'))) else '',
               'latitude': None, 'longitude': None, 'district': '', 'districtTh': '',
               'type': text(r.get('venueType')), 'format': '', 'role': ROLE_POINT if located else 'registry_identity_without_reference_point',
               'edgeM': None, 'from': 'registry'}
        if located:
            lat, lon = float(r['lat']), float(r['lon'])
            dcode, edge = locator.locate(lon, lat)
            # districtTh: the production name of the district the point falls in (the registry's addrDistrict is free text)
            rec.update({'latitude': round(lat, 6), 'longitude': round(lon, 6), 'district': dcode, 'edgeM': round(edge),
                        'districtTh': gaz.districts[dcode]['th'] if dcode else ''})
            if dcode and r.get('districtCode') and str(r['districtCode']) != dcode:
                print(f'note: venue {rid} registry district {r["districtCode"]} ≠ point-in-polygon {dcode} (point decides)')
        logo = registry.logo_of(rid)
        if logo:
            rec['logo'] = logo['key']
            venue_logo_files[logo['key']] = logo
        return rec

    # ---- rows ----
    urls, url_index = [], {}

    def url_id(u):
        if not u:
            return -1
        if u not in url_index:
            url_index[u] = len(urls); urls.append(u)
        return url_index[u]

    cols = {k: [] for k in ('key', 'name', 'brand', 'group', 'segment', 'status', 'statusRaw', 'source', 'url', 'statusUrl', 'checked',
                            'province', 'district', 'admin', 'how', 'words', 'venue', 'scope', 'origin')}
    points, conflicts, audit, owner_host = [], [], [], []
    stats = collections.Counter()
    seen = set()
    segments = sorted(SEGMENT_GROUP)
    raw_statuses = sorted(STATUS_OF)
    for i, r in enumerate(tabs['02_STORES']):
        key = text(r.get('outlet_id'))
        if not key or key in seen:
            sys.exit(f'row {i + 2}: missing or duplicate outlet_id {key!r}')
        seen.add(key)
        seg = text(r.get('segment'))
        if seg not in SEGMENT_GROUP:
            sys.exit(f'row {i + 2}: unknown segment {seg!r}')
        bid = text(r.get('brand_id'))
        if bid not in brand_index:
            sys.exit(f'row {i + 2}: brand_id {bid!r} not in 01_BRANDS')
        if text(r.get('brand_name')) != brands[brand_index[bid]]['name']:
            sys.exit(f'row {i + 2}: brand name differs from 01_BRANDS')
        raw_status = text(r.get('operating_status'))
        if raw_status not in STATUS_OF:
            sys.exit(f'row {i + 2}: unknown operating_status {raw_status!r}')
        st = text(r.get('source_type'))
        if st not in SOURCE_TYPES:
            sys.exit(f'row {i + 2}: unknown source_type {st!r}')
        addr = text(r.get('address'))
        sheet_p = gaz.province_of_text(text(r.get('province')))
        if text(r.get('province')) and not sheet_p:
            sys.exit(f"row {i + 2}: province {r.get('province')!r} is not a production province name")
        # -- point (published source point) or host (CityMETER venue) --
        pt, role, venue = None, '', -1
        if text(r.get('latitude')) and text(r.get('longitude')):
            lat, lon = float(r['latitude']), float(r['longitude'])
            if not (5 <= lat <= 21 and 97 <= lon <= 106):
                sys.exit(f'row {i + 2}: point outside Thailand')
            pt, role = (lat, lon), text(r.get('geometry_role'))
            if role not in POINT_ROLES:
                sys.exit(f'row {i + 2}: unknown geometry_role {role!r}')
        vid = text(r.get('citymeter_shopping_center_id'))
        link_status = text(r.get('common_retail_venue_link_status'))
        rids = [x.strip() for x in re.split(r'[;,\s]+', text(r.get('common_retail_venue_ids'))) if x.strip()]
        stats[f'link.{link_status or "blank"}'] += 1
        if vid or (rids and link_status.startswith('accepted')):
            if not link_status.startswith('accepted'):
                sys.exit(f'row {i + 2}: CityMETER venue {vid} without an accepted link status ({link_status!r})')
            if len(rids) > 1:
                sys.exit(f'row {i + 2}: more than one accepted venue id {rids}')
            vkey = vid if vid in venue_index else (rids[0] if rids and rids[0] in venue_index else '')
            if not vkey:
                rec = registry_venue(rids[0], vid) if rids else None
                if not rec:
                    sys.exit(f'row {i + 2}: linked venue {vid or rids} is in neither 07_SHOPPING_CENTERS nor the registry snapshot')
                vkey = rec['id']
                add_venue(rec)
            venue = venue_index[vkey]
            stats['link.acceptedWithPoint' if venues[venue]['latitude'] is not None else 'link.acceptedNoPoint'] += 1
        # Owner map audit (map_audit_status = owner_confirmed_located_in_host_YYYYMMDD): the owner checked the branch on
        # the map and confirmed it is inside its accepted venue. The venue's registry reference point is drawn; the
        # published source point stays in the sheet (and in the 00_README source-point count) but is not used.
        source_pt = pt
        audit_status = text(r.get('map_audit_status'))
        owner_audit = re.fullmatch(r'owner_confirmed_located_in_host_(\d{4})(\d{2})(\d{2})', audit_status)
        if audit_status and audit_status != 'not_field_audited' and not owner_audit:
            sys.exit(f'row {i + 2}: unknown map_audit_status {audit_status!r}')
        if owner_audit:
            if venue < 0 or venues[venue]['latitude'] is None:
                sys.exit(f'row {i + 2}: owner-confirmed host location without an accepted venue that has a registry point')
            on = '-'.join(owner_audit.groups())
            datetime.date.fromisoformat(on)
            owner_host.append({'outlet': key, 'venue': venues[venue].get('scId') or venues[venue]['id'], 'on': on,
                               'sourcePointM': round(haversine_m(pt, (venues[venue]['latitude'], venues[venue]['longitude']))) if pt else None})
            pt, role = None, ''
            stats['points.ownerConfirmedHost'] += 1
        how, words, note = '', [], ''
        p_code = d_code = None
        method = None
        host_point = venue >= 0 and venues[venue]['latitude'] is not None
        if pt or host_point:
            lat, lon = pt if pt else (venues[venue]['latitude'], venues[venue]['longitude'])
            d_code, edge = locator.locate(lon, lat)
            if d_code and edge < EDGE_M:
                # near an edge of the display outline: confirm on full-resolution production geometry
                sub = full.subdistrict_of(lon, lat)
                if not sub:
                    sys.exit(f'row {i + 2}: no full-resolution subdistrict for a point {edge:.0f} m from a district edge — run scripts/fetch-edge-geometry.py')
                if sub[:4] != d_code:
                    note = f'edge: display {d_code} → full resolution {sub[:4]}'
                    d_code = sub[:4]
                stats['point.edgeChecked'] += 1
            if d_code:
                p_code = gaz.districts[d_code]['province']
                method = 'point' if pt else 'host'
        addr_res = resolve(addr, gaz, sheet_p) if addr else {'district': None, 'method': 'none', 'words': []}
        a_prov, a_prov_how = address_province(addr, gaz, postcode_index) if addr else (None, None)
        if method:
            # the point decides; the address is reported when it says something else
            if addr_res['district'] and addr_res['district'] != d_code:
                note = (note + '; ' if note else '') + f"address reads {addr_res['district']}"
            if sheet_p and sheet_p != p_code:
                method = 'conflict'
        else:
            if not sheet_p and not addr_res['district'] and a_prov:
                addr_res = resolve(addr, gaz, a_prov)
            if not sheet_p and not a_prov and addr_res['method'] in ('no_province',):
                pass
            if addr_res['district']:
                d_code = addr_res['district']
                p_code = gaz.districts[d_code]['province']
                method, how, words = 'address', addr_res['method'], addr_res['words']
                if sheet_p and sheet_p != p_code:
                    method = 'conflict'
            else:
                p_code = sheet_p or a_prov
                method = 'province' if p_code else 'none'
                # disagreement between the sheet's province and what the address itself says
                if sheet_p:
                    other = resolve(addr, gaz, None) if addr else {'district': None}
                    pcs = postcode_provinces(addr, gaz, postcode_index) if addr else set()
                    if (other['district'] and gaz.districts[other['district']]['province'] != sheet_p) or (pcs and sheet_p not in pcs):
                        method = 'conflict'
                        note = f"address points to {', '.join(sorted({gaz.provinces[p]['th'] for p in pcs} | ({gaz.provinces[gaz.districts[other['district']]['province']]['th']} if other['district'] else set())))}"
        if method == 'conflict':
            conflicts.append({'outlet': key, 'brand': brands[brand_index[bid]]['name'], 'store': text(r.get('store_name')),
                              'sheetProvince': text(r.get('province')), 'note': note or 'point outside the stated province'})
            p_code = d_code = None
            how, words = '', []
        if d_code and d_code not in index_districts:
            sys.exit(f'row {i + 2}: district {d_code} not in the area index')
        stats[f'admin.{method}'] += 1
        if how:
            stats[f'address.{how}'] += 1
        if a.audit is not None:
            audit.append({'outlet': key, 'brand': brands[brand_index[bid]]['name'], 'store': text(r.get('store_name')),
                          'sheetProvince': text(r.get('province')), 'province': gaz.provinces[p_code]['th'] if p_code else '',
                          'district': gaz.districts[d_code]['th'] if d_code else '', 'method': method, 'how': how or addr_res['method'],
                          'words': addr_res['words'], 'note': note, 'address': addr})
        status = STATUS_OF[raw_status]
        src = public_url(r.get('source_url'))
        stat_url = public_url(r.get('status_source_url'))
        cols['key'].append(key)
        cols['name'].append(text(r.get('store_name')))
        cols['brand'].append(brand_index[bid])
        cols['group'].append(SEGMENT_GROUP[seg])
        cols['segment'].append(segments.index(seg))
        cols['status'].append(STATUS.index(status))
        cols['statusRaw'].append(raw_statuses.index(raw_status))
        cols['source'].append(SOURCE_TYPES.index(st))
        cols['url'].append(url_id(src))
        cols['statusUrl'].append(url_id(stat_url) if stat_url and stat_url != src else -1)
        cols['checked'].append(iso(r.get('status_checked_on') or r.get('checked_on')))
        cols['province'].append(abbr[p_code] if p_code else '')
        cols['district'].append(d_code or '')
        cols['admin'].append(ADMIN.index(method))
        cols['how'].append(ADDRESS_HOW.index(how))
        cols['words'].append(' · '.join(words) if method == 'address' else '')
        cols['venue'].append(venue)
        cols['scope'].append(text(r.get('scope_status')))
        cols['origin'].append(text(r.get('record_origin')))
        if pt:
            points.append([i, round(pt[0], 6), round(pt[1], 6), POINT_ROLES.index(role)])
        stats[f'status.{status}'] += 1
        stats['points.source'] += 1 if source_pt else 0
        stats['points.host'] += 1 if (not pt and host_point) else 0
        stats['links.venue'] += 1 if venue >= 0 else 0

    def encode(name):
        values = sorted(set(v for v in cols[name] if v))
        pos = {v: j for j, v in enumerate(values)}
        cols[name] = [pos[v] if v else -1 for v in cols[name]]
        return values
    province_codes, district_codes = encode('province'), encode('district')
    for name in ('scope', 'origin'):
        vals = sorted(set(cols[name]))
        cols[name] = [vals.index(v) for v in cols[name]]
        cols[name + 'Vocab'] = vals

    n = len(cols['key'])
    by_brand = collections.Counter((cols['brand'][j], STATUS[cols['status'][j]]) for j in range(n))
    for bi, b in enumerate(brands):
        b['rows'] = {s: by_brand[(bi, s)] for s in STATUS}
    # cross-checks with the sheet's own headline figures and coverage tab
    check = {
        'brands': (len(brands), int(readme.get('จำนวนแบรนด์/ป้ายบริการในทะเบียน') or 0)),
        'rows': (n, int(readme.get('รายการสาขาใน02_STORES') or 0)),
        'listed': (stats['status.listed'], int(readme.get('รายการที่ต้นทางยังแสดงบริการ') or 0)),
        'points': (stats['points.source'], int(readme.get('รายการที่มีพิกัดจากแหล่ง') or 0)),
        'companies': (len(companies), int(readme.get('บริษัท/กลุ่มที่พบชื่อในหลักฐาน') or 0)),
        'relationships': (len(relationships), int(readme.get('ความสัมพันธ์บริษัทที่บันทึก') or 0)),
    }
    bad = {k: v for k, v in check.items() if v[0] != v[1]}
    if bad:
        sys.exit(f'headline figures differ from 00_README: {bad}')
    cov_bad = [b['id'] for b in brands if b['id'] in coverage_tab and
               int(coverage_tab[b['id']].get('observed_pos_rows') or 0) != sum(b['rows'].values())]
    if cov_bad:
        sys.exit(f'14_NETWORK_COVERAGE observed_pos_rows differ for {cov_bad}')

    receipts = {f: json.load(open(os.path.join(a.api, f))) for f in sorted(os.listdir(a.api)) if f.endswith('.meta.json')}
    meta = {
        'dataset': 'CityMETER Fitness', 'datasetTh': 'ฟิตเนสและสตูดิโอในประเทศไทย',
        'registryId': 'research.TH.fitness', 'registryRole': 'Location · TH',
        'sheetTitle': 'CityMETER Fitness Thailand — Research Master 2026-10-26',
        'exportSha256': export_sha, 'sheetStatus': 'research_master',
        'asOf': checked, 'checkedOn': checked, 'builtOn': datetime.date.today().isoformat(),
        'rows': n, 'counts': dict(sorted(stats.items())), 'readmeCheck': {k: v[0] for k, v in check.items()},
        'unit': {
            'row': 'one row of 02_STORES — a source-qualified branch observation (official operator page, locator, social profile or announcement); not a field-verified storefront',
            'default': 'listed — rows whose source still lists the service on the check date (source_listed); announced, closed and review rows are counted apart and never added to it',
        },
        'statusMap': STATUS_OF,
        'adminMethods': {
            'point': 'published source point inside the production district (display outline; points within %d m of an edge confirmed on full-resolution production subdistrict geometry)' % EDGE_M,
            'host': 'CityMETER Shopping Center id → registry reference point (07_SHOPPING_CENTERS) → production district',
            'address': "the row's own address text (scripts/admin_text.py): marker · pair · mueang · trailing",
            'province': "province only (the sheet's province, else the province or single-province postcode the address states)",
            'conflict': "the sheet's province disagrees with the row's own address or point — placed nowhere, listed in meta.conflicts",
            'none': 'no province anywhere in the row',
        },
        'addressHow': {'marker': 'explicit เขต/อำเภอ/แขวง/ตำบล or District/Sub-district/Khet/Khwaeng/Amphoe/Tambon word',
                       'pair': 'two or more administrative words consistent with one district (e.g. subdistrict + district)',
                       'mueang': "'Mueang' inside a known province → its capital district",
                       'trailing': 'one district word that ends the address inside a known province'},
        'conflicts': conflicts,
        'boundaries': {
            'districts': 'CityMETER production base info (lv0/lv1 retrieved %s) + district outlines of data/frames/{CODE}.json' % min(m['retrievedAt'][:10] for m in receipts.values()),
            'englishNames': 'OpenGISData-Thailand districts.geojson / subdistricts.geojson @ fafcea1 (CC BY 4.0) — address reading only',
            'receipts': len(receipts),
            'receiptsSha256': hashlib.sha256(json.dumps(receipts, sort_keys=True).encode()).hexdigest(),
        },
        'logos': {'brands': '01_BRANDS logo_status + 16_BRAND_LOGOS (data/brand-logos.json, scripts/build-logos.py)',
                  'venues': 'venue logos of the linked venues from the CityMETER Shopping Centers registry snapshot (data/venue-logos.json)'},
        'venueLinks': {k[5:]: v for k, v in sorted(stats.items()) if k.startswith('link.')},
        'ownerConfirmedHost': {
            'rule': 'map_audit_status owner_confirmed_located_in_host_YYYYMMDD: the owner confirmed on the map that the branch is inside its accepted venue; the venue registry reference point is drawn and the published source point (kept in the sheet and in points.source) is not',
            'rows': owner_host},
        'registry': {'dataset': 'CityMETER Shopping Centers & Retail Venues Thailand — Research Master (public snapshot of montri-th/shoppingcenter)',
                     'asOf': getattr(registry, 'as_of', ''), 'commit': a.registry_commit,
                     'files': {'count': len(registry.files),
                               'listSha256': hashlib.sha256(''.join(f'{p} {h}\n' for p, h in sorted(registry.files.items())).encode()).hexdigest(),
                               'listMethod': 'SHA-256 of the lines "<path> <sha256 of the file>\\n" of every registry file read, sorted by path',
                               'index': {p: registry.files[p] for p in ('data/venues.json', 'data/venue-logos.json') if p in registry.files}},
                     'use': 'reference point and name of a venue a branch row links with an accepted status when 07_SHOPPING_CENTERS does not carry it; never a branch coordinate, unit or opening state'} if a.registry else None,
        'excludedFields': ['address', 'unit_floor', 'public_business_phone', 'map_url', 'raw coordinates strings', 'notes',
                           'branch_source_id', 'company_research_note', 'coverage_note', 'sister_brand_names (15_SISTER_BRANDS: Thai presence mostly not established)', 'README text', 'venue source_url',
                           'internal sheet and registry URLs'],
    }
    out = {
        'meta': meta,
        'groups': [{'id': g[0], 'th': g[1], 'en': g[2], 'segments': g[3]} for g in GROUPS],
        'segments': [{'id': s, 'th': SEGMENT_TH[s], 'group': GROUPS[SEGMENT_GROUP[s]][0]} for s in segments],
        'brands': brands, 'companies': companies, 'relationships': relationships, 'venues': venues,
        'urls': urls,
        'vocab': {'status': STATUS, 'statusRaw': raw_statuses, 'admin': ADMIN, 'how': ADDRESS_HOW, 'pointRoles': POINT_ROLES,
                  'sourceTypes': SOURCE_TYPES, 'scope': cols.pop('scopeVocab'), 'origin': cols.pop('originVocab')},
        'provinces': province_codes, 'districts': district_codes,
        'cols': cols, 'points': points,
    }
    # Venue logos (identity support) for the venues in this file, from the registry snapshot: the original bytes when
    # display-sized (SVG, or raster ≤ 512 px and ≤ 64 KB), else the same recorded display derivative as the brand logos
    # (scripts/build-logos.py: uniform downscale to 384 px longest side, WebP; colours and proportions unchanged).
    for v in venues:
        if 'logo' not in v and v.get('scId') and a.registry:
            lg = registry.logo_of(v['scId'])
            if lg:
                v['logo'] = lg['key']; venue_logo_files[lg['key']] = lg
    logo_dir = os.path.join(a.out, 'assets', 'venue-logos')
    if os.path.isdir(logo_dir):
        for name in os.listdir(logo_dir):
            os.remove(os.path.join(logo_dir, name))
    venue_logos = []
    for key, lg in sorted(venue_logo_files.items()):
        raw = open(os.path.join(a.registry, lg['file']), 'rb').read()
        if hashlib.sha256(raw).hexdigest() != lg['sha256']:
            sys.exit(f'venue logo {key}: file differs from the registry SHA-256')
        os.makedirs(logo_dir, exist_ok=True)
        name, data, mime, (width, height), transformations = os.path.basename(lg['file']), raw, lg['mime'], (lg['width'], lg['height']), []
        if mime != 'image/svg+xml' and (max(width, height) > 512 or len(raw) > 64 * 1024):
            from PIL import Image  # only needed for oversize raster logos
            im = Image.open(io.BytesIO(raw)); im.load()
            alpha = im.mode in ('RGBA', 'LA', 'PA') or (im.mode == 'P' and 'transparency' in im.info)
            im = im.convert('RGBA' if alpha else 'RGB')
            scale = min(1.0, 384 / max(im.size))
            size = (max(1, round(im.size[0] * scale)), max(1, round(im.size[1] * scale)))
            if size != im.size:
                im = im.resize(size, Image.LANCZOS)
            buf = io.BytesIO()
            im.save(buf, 'WEBP', **({'lossless': True, 'quality': 100, 'method': 6} if alpha else {'quality': 90, 'method': 6}))
            data, mime, (width, height) = buf.getvalue(), 'image/webp', im.size
            name = os.path.splitext(name)[0] + '.webp'
            transformations.append({'operation': 'display_downscale', 'source_sha256': lg['sha256'], 'source_size': [lg['width'], lg['height']],
                                    'output_size': [width, height], 'method': 'Pillow LANCZOS to at most 384 px longest side; WebP ' + ('lossless' if alpha else 'quality 90'),
                                    'colour_and_geometry': 'unchanged (uniform scale only)'})
        open(os.path.join(logo_dir, name), 'wb').write(data)
        venue_logos.append({'key': key, 'file': f'assets/venue-logos/{name}', 'mime': mime, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
                            'width': width, 'height': height, 'background': lg.get('background', ''), 'role': lg.get('role', ''),
                            'original': {'sha256': lg['sha256'], 'mime': lg['mime'], 'bytes': lg['bytes'], 'width': lg['width'], 'height': lg['height']},
                            'transformations': transformations,
                            'sourcePage': public_url(lg.get('sourcePage')), 'assetURL': public_url(lg.get('assetURL')), 'checkedOn': lg.get('checkedOn', '')})
    os.makedirs(os.path.join(a.out, 'data'), exist_ok=True)
    with open(os.path.join(a.out, 'data', 'venue-logos.json'), 'w', encoding='utf-8') as fh:
        json.dump({'meta': {'asOf': registry.logos.get('meta', {}).get('asOf', '') if a.registry else '', 'count': len(venue_logos),
                            'source': 'CityMETER Shopping Centers & Retail Venues registry, tab 10_VENUE_LOGOS (public snapshot): original bytes when display-sized, else a recorded uniform downscale (original SHA-256 kept)',
                            'rights': 'เครื่องหมายเป็นของเจ้าของแต่ละราย การแสดงเพื่อระบุสถานที่ไม่ใช่ใบอนุญาตเครื่องหมายการค้า',
                            'backgroundRule': 'transparent marks on #E5E9E6, light transparent marks on #182327, opaque files on #FFFFFF (registry rule); colours and proportions unchanged'},
                   'logos': venue_logos}, fh, ensure_ascii=False, separators=(',', ':'))
    path = os.path.join(a.out, 'data', 'fitness.json')
    with open(path, 'w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(',', ':'))
    print('data/fitness.json', n, 'rows', os.path.getsize(path), 'bytes')
    print(json.dumps(meta['counts'], ensure_ascii=False))
    print('conflicts', json.dumps(conflicts, ensure_ascii=False))
    if a.audit:
        json.dump(audit, open(a.audit, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
