/**
 * Breadcrumb — ประเทศไทย › จังหวัด › เขต/อำเภอ (› ศูนย์การค้า) — the CityMETER production hierarchy, through the shared
 * shell (js/shell/breadcrumb.js, citymeter-shell 0.4.3). Production routes (observed in the landometer.com/v3 bundle,
 * 2026-10-22): /v3/citymeter/{abbrEn} and /v3/citymeter/{abbrEn}/D/{district code}; every administrative crumb carries
 * its production deep link. Production has no fitness dataset and the dataset registry has no code for it, so the links
 * carry no `d` (and neither does this demo's address).
 * A venue is the CityMETER Shopping Center registry record (its id is the venue id); its district comes from the
 * registry reference point inside the production district outline (checked at build time against the registry's own
 * district). It is the last crumb, with no production link. A branch (store) is the panel heading, never a crumb — its
 * crumbs are its own matched district and province (a row placed only at province level stops there).
 */
import {provinceByCode} from './model.js';
import {areaWord} from './areas.js';
import {buildBreadcrumb as shellBreadcrumb, renderBreadcrumb, breadcrumbText, deepestHref} from './shell/breadcrumb.js';

/** Production carries no fitness dataset: crumbs link the place alone (no `?d=`). */
const PRODUCTION_DATASET = '';
const shellProvince = code => { const p = provinceByCode(code); return p ? {code: p.code, th: p.th} : null; };

/** Pure model. province = production code or ''; area = index record or null; venue = venue record or null. */
export function buildBreadcrumb({province = '', area = null, venue = null} = {}) {
  const code = area?.province || province || '';
  return shellBreadcrumb({
    province: code,
    area: area ? {id: area.id, name: area.name, province: code} : null,
    site: venue ? {id: venue.id, name: venue.name, province: code} : null,
  }, {dataset: PRODUCTION_DATASET, provinceByCode: shellProvince, areaWord});
}

export {renderBreadcrumb, breadcrumbText};

/** Production deep link of the deepest administrative crumb (for “ดูใน CityMETER”). */
export const productionHref = crumbs => deepestHref(crumbs, PRODUCTION_DATASET);
