# เริ่มงานต่อ — CityMETER Fitness

รุ่นส่งต่อ 0.3.0 · 30 ตุลาคม 2569 · ชีตวิจัยตรวจแหล่ง 26 ตุลาคม 2569

ชุดนี้ส่งต่อให้ developer หรือ coding agent พัฒนาต่อจาก repository ที่ใช้งานจริง หลักของรุ่นนี้คือ **นับสาขาที่หน้าทางการของแบรนด์ยังแสดง แยกจากสถานะอื่น แล้วเห็นเมือง 3 มิติที่โฟกัสเขต/อำเภอที่สาขากระจุกในจังหวัดที่นำ พร้อมบุคลิกสตูดิโอเทียบยิม และบริษัทเบื้องหลังแบรนด์** โดยคงสัญญากล้อง basemap และมวลอาคารของ CityMETER · Luxury Brands 0.5 / Restaurants / Pharmacy 0.1.1 · รุ่น 0.2.0 เพิ่ม **มุมมองอาคาร** แบบ Shopping centers (2-point perspective, zoom to fit, x-ray ไม่ให้ตึกอื่นบัง) **รายการเดียวต่ออาคาร** และ **สีครบ 41 ระดับ** · รุ่น 0.2.1 กัน error ของ MapLibre 5.6.2 ที่พบตอนเดินตรวจเว็บจริง (`js/maplibre-guard.js`) · รุ่น 0.3.0 ให้ **แบรนด์มาก่อนชื่อสาขา** ทุกที่ (โลโก้ 126 แบรนด์จากคลังโลโก้ของชีตวิจัย) ทำแผงให้สั้นลง และเพิ่ม **ปุ่มถามต่อใน Google** (AI Mode, Maps, Street View) ตามมุมมอง

Live: [Fitness](https://montri-th.github.io/fitness/) · Source: [GitHub](https://github.com/montri-th/fitness) · ระบบจริง: [CityMETER](https://landometer.com/v3/citymeter)

## อ่านตามลำดับนี้

| คนอ่าน | เครื่องอ่าน | ใช้ทำอะไร |
|---|---|---|
| [../PRODUCT_STATEMENT.md](../PRODUCT_STATEMENT.md) | [product-statement.json](product-statement.json) | Winning strategy: Who / What / Which / How, quality bar, ป้ายหลักฐาน, hypotheses — อ่านก่อนเปลี่ยนสิ่งที่หน้าแรกบอก |
| [PRODUCT_BRIEF.md](PRODUCT_BRIEF.md) | [product-brief.json](product-brief.json) | row scopes, หน่วยนับตามสถานะ, first Aha และกติกาค่าเท่ากัน, ตัวชี้วัด ความครอบคลุม ขอบเขตรายจังหวัด รูปทรงรูปแบบ แผนที่ focus/quiet, มุมมองอาคาร, breadcrumb, แผง, อาคาร, กราฟ, ตัวตนแบรนด์, ปุ่มถามต่อ, การผูกศูนย์การค้า, invariants INV01–INV29 |
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | [implementation-plan.json](implementation-plan.json) | โมดูล งาน P01–P22 acceptance AC01–AC36 backlog N01–N20 วิธีทำงานต่อ |
| [VERIFICATION.md](VERIFICATION.md) | `handoff-manifest.json` (ใน bundle) | ผลตรวจแยกระดับ (unit / LDS parity / rendered / live) และ hash ของทุกไฟล์ |
| README นี้ | [handoff.schema.json](handoff.schema.json) | สัญญาโครงสร้างของ JSON (schema 1.5.0, ตรวจใน `tests/release.test.js`) |

`product-statement.json`, `product-brief.json` และ `implementation-plan.json` แก้คู่กับ Markdown ส่วน `handoff-manifest.json` สร้างด้วย `npm run handoff:manifest` เท่านั้น ไม่ถูก track ใน git ห้ามแก้ hash ด้วยมือ

บริบทข้อมูล: [DATA_METHOD.md](../DATA_METHOD.md) · [docs/CHART_SELECTION.md](../docs/CHART_SELECTION.md) · [docs/BUILD_CARD.md](../docs/BUILD_CARD.md)

## เปิดในเครื่อง

```sh
npm start      # http://127.0.0.1:4173/
npm test       # unit tests บนข้อมูลจริง
```

เป็น static site ไม่มี build step ไม่ต้อง `npm install` ต้องมี Node ≥ 20 และ Python 3 แผนที่ต้องเข้าถึง unpkg.com (MapLibre) และ tiles.openfreemap.org (tiles + glyphs) กราฟไม่ใช้ไลบรารีภายนอก การเปิด `index.html` เป็นไฟล์โดยตรงจะพาไปเว็บสาธารณะ

สร้างข้อมูลใหม่ต้องใช้อินพุตภายใน (export ของชีตวิจัย, responses ของ production API) ซึ่งไม่อยู่ใน repository — ดู DATA_METHOD §10 · ตรวจ LDS parity ต้องมีไฟล์ LDS 0.9.7 ของเจ้าของ (`npm run check:lds -- --lds <file>`)

## สิ่งที่ห้ามทำหล่น

- หน่วยนับ: ค่าเริ่มต้นนับเฉพาะสาขาที่เปิดตามแหล่ง (“สาขา”) · สถานะอื่นใช้คำว่า “รายการ” ทุกที่ · ห้ามบวกข้ามสถานะ
- ขอบเขตข้อมูลสามชั้น: `scopeRows` ขับข้อค้นพบ choropleth กราฟ และอันดับในโปรไฟล์; `rows` ขับสัญลักษณ์ที่มีรายละเอียด ตัวนับ และตาราง
- ความเป็นสมาชิกพื้นที่ = เขต/อำเภอที่จับคู่ตอน build (`row.admin`) ห้าม point-in-polygon ตอนแสดงผล ห้ามเดาจากชื่อสาขาหรือแบรนด์
- ตัวชี้วัด = จำนวน ไม่มีความหนาแน่น ไม่มีส่วนแบ่งตลาด · สัดส่วนทุกตัวแสดงตัวตั้งและตัวหาร · ข้อค้นพบไม่ตัดผ่านค่าที่เท่ากัน
- 0 ของชุดข้อมูล (เส้นขอบศูนย์) ≠ ไม่มีข้อมูล ≠ ระบุพื้นที่ไม่ได้; สาขาที่ระบุพื้นที่ไม่ได้นับแยกและบอกไว้; ไม่สร้างพิกัด
- ขอบเขตโหลดทีละจังหวัด ห้ามโหลดทั้ง 77 ไฟล์ตอนเริ่ม; ทุกอย่างนอกแผนที่ต้องใช้ได้โดยไม่มีขอบเขต
- โฟกัสแล้วเงียบ, ภาพแรก 3 มิติ, สีข้อมูล HEX เดียวกันทั้งสองธีมและครบ 41 ระดับของ LDS ตามลำดับค่า (ห้ามกลับไปเลือก 3/5 ระดับ), รูปทรงประจำ series คู่กับสี ไม่มีดาว
- อาคารที่ดูอยู่ (ศูนย์การค้า อาคาร สาขาที่มีจุด): มุม eye สองด้าน เต็มกรอบว่างทุกทางเข้า ไม่มีอาคารอื่นบัง (x-ray + อาคารด้านหน้าโปร่ง) และแสดงรายการเดียวต่ออาคาร — สาขาที่ผูกกับศูนย์การค้า + สาขาที่จุดตกในอาคาร ไม่นับซ้ำ ไม่เปลี่ยนจำนวนของพื้นที่
- แบรนด์มาก่อนสาขา: โลโก้ (ถ้ามี) และชื่อแบรนด์มาก่อนชื่อสาขาทุกที่ โลโก้ไม่แทนชื่อ · โลโก้มาจากทะเบียนที่ตรวจ SHA-256 เท่านั้น · ปุ่มออกไป Google ใช้ชื่อสาธารณะและพิกัดที่เผยแพร่ บอกว่าผลไม่ใช่ข้อมูล CityMETER
- แบรนด์ บริษัท ศูนย์การค้า ผูกด้วย id ของชีตเท่านั้น; แก้การผูกในชีตวิจัยแล้ว export ใหม่ ห้ามแก้ใน `data/`; ชื่อบริษัทยังไม่ได้ตรวจกับทะเบียน; ไม่พบบันทึก ≠ อิสระ; “จุดตกในอาคาร” ไม่ใช่ “ตั้งอยู่ใน”
- ไม่คัดลอกที่อยู่ เบอร์โทร ลิงก์แผนที่ บันทึกของนักวิจัย; ไม่มีลิงก์เอกสารส่วนตัว credential หรือไลบรารี LDS เต็มใน repository
- ทุกมุมมองของแผงจบด้วย dataset · source · date · boundary และหน่วยนับ หนึ่งบรรทัด

## เริ่มด้วยงานหนึ่งชิ้น

เลือกงานจาก backlog (N02–N20) ที่เจ้าของจัดลำดับ ทำทีละงาน เพิ่ม test บนข้อมูลจริง ตรวจหน้าจอทั้งสองธีมที่ 390 px และ desktop แล้วเผยแพร่และรัน `npm run verify:live` ก่อนรายงาน

## ตรวจความครบก่อนรับช่วง

```sh
npm test                       # ทุก test ผ่าน
npm run handoff:manifest       # manifest ตรงกับ commit
npm run verify:live            # ไบต์บนเว็บตรง manifest
```
