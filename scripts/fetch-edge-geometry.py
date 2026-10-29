#!/usr/bin/env python3
"""Fetch full-resolution production SUBDISTRICT geometry for the published points that sit near a district edge.

The district of a point is read on the display outlines (data/frames, simplified at 30 m). A point closer than
EDGE_M to an edge of its district is confirmed on full-resolution production geometry: this script fetches the
subdistricts whose display outline lies within RADIUS_M of such a point, with a receipt per response
(url, status, bytes, sha256, retrievedAt) next to it.

  python3 -I scripts/fetch-edge-geometry.py --export <research export> --pharmacy <montri-th/pharmacy checkout> \
      --frames data/frames --index data/area-index.json --out <geom dir>
"""
import argparse, datetime, hashlib, importlib.util, json, math, os, sys, time, urllib.request

EDGE_M, RADIUS_M = 150, 400
API = 'https://landometer.com/api/v2/citymeter-v3/base/info/geom/{uuid}/SUBDISTRICT'


def load_build():
    spec = importlib.util.spec_from_file_location('build', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'build-data.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def fetch(url, path):
    if os.path.exists(path) and os.path.exists(path[:-5] + '.meta.json'):
        return
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={'Accept': 'application/json', 'User-Agent': 'citymeter-fitness-build/0.1'})
            with urllib.request.urlopen(req, timeout=60) as r:
                raw, status = r.read(), r.status
            break
        except Exception as e:  # noqa: BLE001
            print('retry', url, e)
            time.sleep(2)
    else:
        sys.exit('failed ' + url)
    open(path, 'wb').write(raw)
    json.dump({'url': url, 'status': status, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest(),
               'retrievedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')}, open(path[:-5] + '.meta.json', 'w'))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    for k in ('--export', '--pharmacy', '--frames', '--index', '--out'):
        ap.add_argument(k, required=True)
    a = ap.parse_args()
    build = load_build()
    tabs, _ = build.read_export(a.export)
    index = json.load(open(a.index, encoding='utf-8'))
    locator = build.DistrictLocator(a.frames, index)
    points = []
    for r in tabs['02_STORES']:
        if r.get('latitude', '').strip() and r.get('longitude', '').strip():
            points.append((float(r['longitude']), float(r['latitude'])))
    for v in tabs['07_SHOPPING_CENTERS']:
        points.append((float(v['longitude']), float(v['latitude'])))
    near = []
    for lon, lat in points:
        code, edge = locator.locate(lon, lat)
        if code and edge < EDGE_M:
            near.append((lon, lat, code, edge))
    # candidate subdistricts: pharmacy subdistrict outlines within RADIUS_M of a near-edge point
    os.makedirs(a.out, exist_ok=True)
    wanted = {}
    for p in index['provinces']:
        frames = json.load(open(os.path.join(a.pharmacy, f"data/frames/{p['id']}.json"), encoding='utf-8'))
        for f in frames['areas']['features']:
            w, s, e, n = f['properties']['bbox']
            for lon, lat, code, edge in near:
                dx = RADIUS_M / (111320 * math.cos(math.radians(lat))); dy = RADIUS_M / 110574
                if w - dx <= lon <= e + dx and s - dy <= lat <= n + dy:
                    wanted[f['properties']['uuid']] = str(f['id'])
    for uuid, code in sorted(wanted.items(), key=lambda x: x[1]):
        fetch(API.format(uuid=uuid), os.path.join(a.out, f'SUBDISTRICT-{uuid}.json'))
    print(f'points {len(points)} · near an edge {len(near)} · subdistrict geometries {len(wanted)}')
    for lon, lat, code, edge in near:
        print(f'  {lat:.6f},{lon:.6f} district {code} edge {edge:.0f} m')


if __name__ == '__main__':
    main()
