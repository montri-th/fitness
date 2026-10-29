"""Read the province and district of a fitness branch from the row's OWN address text.

Used by scripts/build-data.py at build time only. Store names and brand names are never read: a name is a
search key, not a location. The result is a district code of CityMETER production (DOPA 4-digit code) or
nothing; every result carries the method and the address words it rests on, so it can be audited row by row.

Gazetteer
  district / subdistrict codes and Thai names: CityMETER production base info (/base/info/lv0, /lv1/{uuid})
  English district names: OpenGISData-Thailand districts.geojson (amp_en) joined by district code
  English subdistrict names: production nameEn, plus OpenGISData-Thailand subdistricts.geojson (tam_en) when the
  code AND the Thai name agree

Reading an address (comma-separated parts; a Thai address is also split on spaces)
  * explicit markers fix the reading: เขต/อำเภอ/อ. · Khet/Amphoe/Amphur/'X District' → district;
    แขวง/ตำบล/ต. · Khwaeng/Tambon/T./'X Sub-district' → subdistrict
  * 'Mueang'/'Muang' (+ the province, any spelling) → the province's capital district เมือง{จังหวัด}
  * any other part that is a district or subdistrict name inside the province is read both ways
  * a part with a house number, a road/building word or fewer than three letters is not read
  * Latin words inside a Thai address are names of places, not units, and are not read

Deciding (one rule for every row)
  A district d is CONSISTENT when every administrative part can be read inside d (as d's own name or as one of
  d's subdistricts). Exactly one consistent district → resolved, provided the evidence is enough:
    marker      at least one explicit marker
    pair        two or more administrative parts (e.g. subdistrict + district)
    mueang      the Mueang reading inside a known province
    trailing    a single administrative part that ends the address (only the province, a postcode or the
                country follow it) inside a known province
  A single part in the middle of an address ('Wannasorn Building, Phayathai, BTS exit 4') is a place name as
  often as a unit and is NOT resolved; several consistent districts (a name shared by a district and another
  district's subdistrict: 'Yannawa', 'Phra Khanong') are ambiguous; no consistent district is inconsistent
  (retired units such as 'Bangna, Phra Khanong', or a subdistrict written under the wrong district).
  Without a province (sheet blank, no province word, no single-province postcode) only marker or pair evidence
  whose consistent district is unique in the whole country is accepted; the province then follows the district.
"""
import json, os, re, unicodedata

PREFIX_TH = re.compile(r'^(?:กิ่งอำเภอ|อำเภอ|ตำบล|แขวง|เขต|จังหวัด|อ\.|ต\.|จ\.)\s*')
POSTCODE = re.compile(r'(?<!\d)(\d{5})(?!\d)')
ROADISH = re.compile(r'\b(road|rd|street|st|soi|alley|lane|yaek|frontage|highway|hwy|bts|mrt|exit|tower|building|bldg|plaza|mall|'
                     r'moo|center|centre|market|village|square|floor|fl|flr|room|unit|zone|park|hotel|condo|residence|avenue|'
                     r'co|ltd|company|no)\b', re.I)
TH_ROADISH = re.compile(r'(ถนน|ถ\.|ซอย|ซ\.|หมู่|ม\.|อาคาร|ชั้น|ห้อง|ศูนย์การค้า|ตึก|เลขที่|ใกล้|ตรงข้าม|หน้า|หลัง|ระหว่าง)')
EN_DIST_MARK = [re.compile(r'\b(?:khet|amphoe|amphur|amphor|amper)\s+([a-z][a-z\-\' ]{2,40}?)(?=\s*(?:[,;.\d(]|$|district\b|province\b|chang\b))', re.I),
                re.compile(r'([a-z][a-z\-\' ]{2,40}?)\s+district\b', re.I)]
EN_SUB_MARK = [re.compile(r'\b(?:khwaeng|kwaeng|tambon|tambol|t\.)\s*([a-z][a-z\-\' ]{2,40}?)(?=\s*(?:[,;.\d(]|$|sub|khet|amphoe|amphur))', re.I),
               re.compile(r'([a-z][a-z\-\' ]{2,40}?)\s+sub-?\s?district\b', re.I)]
TH_DIST_MARK = re.compile(r'(?:เขต|อำเภอ|อ\.)\s*([ก-๙]+)')
TH_SUB_MARK = re.compile(r'(?:แขวง|ตำบล|ต\.)\s*([ก-๙]+)')
MUEANG = re.compile(r'^(?:amphoe\s+|amphur\s+)?mu?e?a?e?ng(?:\s*-\s*|\s+|$)', re.I)
COUNTRY = re.compile(r'^(thailand|th|ไทย|ประเทศไทย)$', re.I)


def th_norm(s):
    s = unicodedata.normalize('NFC', str(s or ''))
    s = s.replace('​', '').replace('\xa0', ' ').replace('ํา', 'ำ').strip()
    s = PREFIX_TH.sub('', s)
    return re.sub(r'\s+', '', s)


def ekey(s):
    """Romanisation skeleton: Latin letters only, common Thai romanisation variants folded, doubled letters collapsed."""
    s = unicodedata.normalize('NFKD', str(s or '')).lower()
    s = re.sub(r'[^a-z]', '', s)
    for a, b in (('tch', 'ch'), ('kh', 'k'), ('ph', 'p'), ('th', 't'), ('ch', 'c'), ('j', 'c'), ('sri', 'si'),
                 ('uea', 'ua'), ('ue', 'u'), ('oe', 'o'), ('ae', 'a'), ('ie', 'ia'), ('ee', 'i'), ('oo', 'u'),
                 ('y', 'i'), ('v', 'w'), ('d', 't'), ('rn', 'n'), ('koh', 'ko')):
        s = s.replace(a, b)
    return re.sub(r'(.)\1+', r'\1', s)


def thai(s):
    return bool(re.search(r'[ก-๙]', s or ''))


class Gazetteer:
    def __init__(self, api_dir, ogd_districts, ogd_subdistricts):
        lv0 = json.load(open(os.path.join(api_dir, 'base-lv0.json'), encoding='utf-8'))['value']
        ogd_d = {f['properties']['amp_code']: f['properties'] for f in json.load(open(ogd_districts, encoding='utf-8'))['features']}
        ogd_s = {f['properties']['tam_code']: f['properties'] for f in json.load(open(ogd_subdistricts, encoding='utf-8'))['features']}
        self.provinces, self.districts, self.subs = {}, {}, {}
        self.district_en_missing, self.sub_en_from_ogd = [], 0
        for p in lv0['provinceInfos']:
            self.provinces[p['code']] = {'code': p['code'], 'abbr': p['abbrEn'], 'th': p['nameTh'], 'en': p['nameEn'], 'id': p['id'],
                                         'areaSqm': p.get('areaSqm')}
            base = json.load(open(os.path.join(api_dir, f"base-{p['id']}.json"), encoding='utf-8'))['value']
            for d in base['districtInfos']:
                o = ogd_d.get(d['code'])
                en = o['amp_en'] if o and o.get('amp_en') else ''
                if not en:
                    self.district_en_missing.append(d['code'])
                self.districts[d['code']] = {'code': d['code'], 'th': d['nameTh'], 'en': en, 'province': p['code'], 'id': d['id'],
                                             'areaSqm': d.get('areaSqm')}
            for s in base['subdistrictInfos']:
                names = [s.get('nameEn') or '']
                o = ogd_s.get(s['code'])
                if o and th_norm(o.get('tam_th')) == th_norm(s['nameTh']) and o.get('tam_en') and o['tam_en'] not in names:
                    names.append(o['tam_en'])
                    self.sub_en_from_ogd += 1
                self.subs[s['code']] = {'code': s['code'], 'th': s['nameTh'], 'en': [n for n in names if n], 'district': s['code'][:4],
                                        'province': p['code'], 'id': s['id']}
        self.prov_by_th = {th_norm(p['th']): c for c, p in self.provinces.items()}
        self.prov_by_th.update({th_norm('กรุงเทพฯ'): '10', 'กทม': '10', 'กทม.': '10', 'กรุงเทพ': '10'})
        self.prov_by_ek = {ekey(p['en']): c for c, p in self.provinces.items()}
        for alias in ('Krung Thep Maha Nakhon', 'Krung Thep', 'Bangkok Metropolis'):
            self.prov_by_ek[ekey(alias)] = '10'
        self.dist_by_th, self.dist_by_ek, self.sub_by_th, self.sub_by_ek = {}, {}, {}, {}
        for c, d in self.districts.items():
            self.dist_by_th.setdefault(th_norm(d['th']), set()).add(c)
            if len(ekey(d['en'])) >= 3:
                self.dist_by_ek.setdefault(ekey(d['en']), set()).add(c)
        for c, s in self.subs.items():
            self.sub_by_th.setdefault(th_norm(s['th']), set()).add(c)
            for en in s['en']:
                if len(ekey(en)) >= 3:
                    self.sub_by_ek.setdefault(ekey(en), set()).add(c)
        self.capital = {}
        for c, d in self.districts.items():
            if th_norm(d['th']) == 'เมือง' + th_norm(self.provinces[d['province']]['th']):
                self.capital[d['province']] = c

    def province_of_text(self, value):
        v = (value or '').strip()
        if not v:
            return None
        if thai(v):
            return self.prov_by_th.get(th_norm(v))
        return self.prov_by_ek.get(ekey(v))

    def district_codes(self, name, province=None):
        if not thai(name) and MUEANG.match(name):
            if province and self.capital.get(province):
                return {self.capital[province]}
        out = set(self.dist_by_th.get(th_norm(name), set()) if thai(name) else self.dist_by_ek.get(ekey(name), set()))
        return {c for c in out if not province or self.districts[c]['province'] == province}

    def sub_districts(self, name, province=None):
        """Districts holding a subdistrict of this name."""
        subs = self.sub_by_th.get(th_norm(name), set()) if thai(name) else self.sub_by_ek.get(ekey(name), set())
        return {self.subs[c]['district'] for c in subs if not province or self.subs[c]['province'] == province}


def _clean(t):
    t = unicodedata.normalize('NFC', t)
    t = re.sub(r'\[[^\]]*\]', ' ', t)                  # editorial brackets: [as source], [source wording]
    t = re.sub(r'[(){}"“”]', ' ', t)
    return re.sub(r'\s+', ' ', t).strip(' .-')


def parse(addr, gaz):
    """Ordered parts of an address: (kind, text) with kind in marker-d, marker-s, admin, province, postcode, country, other."""
    text = unicodedata.normalize('NFC', addr or '').replace('\n', ', ')
    marks = []
    for m in TH_DIST_MARK.finditer(text):
        marks.append(('marker-d', m.group(1)))
    for m in TH_SUB_MARK.finditer(text):
        marks.append(('marker-s', m.group(1)))
    for rx in EN_DIST_MARK:
        for m in rx.finditer(text):
            marks.append(('marker-d', m.group(1).strip()))
    for rx in EN_SUB_MARK:
        for m in rx.finditer(text):
            marks.append(('marker-s', m.group(1).strip()))
    marked = {th_norm(n) if thai(n) else n.lower() for _, n in marks}
    parts = []
    for raw in re.split(r'[,;]|\.\s', text):
        for code in POSTCODE.findall(raw):
            parts.append(('postcode', code))
        t = _clean(POSTCODE.sub(' ', raw))
        if not t:
            continue
        is_thai = thai(t)
        words = [w for w in re.split(r'\s+', t) if w] if is_thai else [t]
        for w in words:
            if is_thai and not thai(w):
                continue
            if COUNTRY.match(w):
                parts.append(('country', w)); continue
            p = gaz.province_of_text(w)
            if p:
                parts.append(('province', p)); continue
            if not is_thai and re.sub(r'(?i)\s*bangkok$', '', w) != w and gaz.province_of_text(re.sub(r'(?i)\s*bangkok$', '', w)) is None:
                head = re.sub(r'(?i)\s*bangkok$', '', w)    # 'Klongtoey Bangkok' → 'Klongtoey' + province
                if head:
                    parts.append(('admin', head))
                parts.append(('province', '10')); continue
            key = th_norm(w) if is_thai else w.lower()
            if key in marked or PREFIX_TH.match(w):
                parts.append(('marked', w)); continue
            if is_thai and TH_ROADISH.search(w):
                parts.append(('other', w)); continue
            if not is_thai and (re.search(r'\d', w) or len(re.sub(r'[^a-z]', '', w.lower())) < 3 or ROADISH.search(w)):
                parts.append(('other', w)); continue
            parts.append(('admin', w))
    return marks, parts


def resolve(addr, gaz, province=None):
    """→ dict(district, method, words, note). `province` is the DOPA province code already known for the row (or None)."""
    marks, parts = parse(addr, gaz)
    readings = []        # (label, word, districts)
    for kind, name in marks:
        ds = gaz.district_codes(name, province) if kind == 'marker-d' else gaz.sub_districts(name, province)
        if ds:
            readings.append(('D' if kind == 'marker-d' else 'S', name, ds))
    admin_idx = [i for i, (k, _) in enumerate(parts) if k == 'admin']
    for i in admin_idx:
        name = parts[i][1]
        ds = gaz.district_codes(name, province) | gaz.sub_districts(name, province)
        if ds:
            readings.append(('M' if MUEANG.match(name) and not thai(name) else 'T', name, ds))
    if not readings:
        return {'district': None, 'method': 'none', 'words': []}
    words = [w for _, w, _ in readings]
    cands = set.intersection(*[r[2] for r in readings])
    if len(cands) > 1:
        return {'district': None, 'method': 'ambiguous', 'words': words, 'candidates': sorted(cands)}
    if not cands:
        return {'district': None, 'method': 'inconsistent', 'words': words}
    d = next(iter(cands))
    has_marker = any(l in ('D', 'S') for l, _, _ in readings)
    if has_marker:
        method = 'marker'
    elif len(readings) >= 2:
        method = 'pair'
    elif readings[0][0] == 'M' and province:
        method = 'mueang'
    else:
        # one administrative word: only when it ends the address (province / postcode / country / nothing follow)
        last_admin = max(i for i, (k, n) in enumerate(parts) if k == 'admin' and n == readings[0][1])
        tail = [k for k, _ in parts[last_admin + 1:]]
        method = 'trailing' if province and all(k in ('province', 'postcode', 'country') for k in tail) else 'single'
    if method == 'single':
        return {'district': None, 'method': 'single_unresolved', 'words': words}
    if province is None and method not in ('marker', 'pair'):
        return {'district': None, 'method': 'no_province', 'words': words}
    return {'district': d, 'method': method, 'words': words}


def address_province(addr, gaz, postcode_index):
    """Province stated by the address itself: its last province word, else a postcode that belongs to one province only."""
    _, parts = parse(addr, gaz)
    provs = [n for k, n in parts if k == 'province']
    if provs:
        return provs[-1], 'address_province'
    codes = [n for k, n in parts if k == 'postcode']
    ps = {gaz.districts[c]['province'] for pc in codes for c in postcode_index.get(pc, ()) if c in gaz.districts}
    if len(ps) == 1:
        return next(iter(ps)), 'address_postcode'
    return None, None


def postcode_provinces(addr, gaz, postcode_index):
    _, parts = parse(addr, gaz)
    return {gaz.districts[c]['province'] for k, pc in parts if k == 'postcode' for c in postcode_index.get(pc, ()) if c in gaz.districts}
