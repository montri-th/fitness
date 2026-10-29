# Verification — CityMETER Fitness

ผลตรวจแยกตามระดับ ผลในเครื่องไม่ใช่หลักฐานแทนเว็บจริง ส่วน “Live” บันทึกหลังเผยแพร่บน GitHub Pages เท่านั้น เวลาเป็นเวลาไทย (UTC+7)

| รุ่น | commit | Pages | ไบต์บนเว็บ (`npm run verify:live`) |
|---|---|---|---|
| 0.1.0 | ดู §4 | ดู §4 | ดู §4 |

## 1. Unit tests บนข้อมูลจริง (`npm test`)

65 tests ผ่านทั้งหมด (Node 22, 29 ต.ค. 2569) — สาระที่ตรวจ:

- `tests/data.test.js`: 378 แถวถอดครบ ไม่มีแถวตก id ไม่ซ้ำ · ตัวเลขหัวตารางตรงกับ README ของชีต (126 แบรนด์ · 378 · 352 · 28 · 44 · 48) · จำนวนแถวต่อแบรนด์ทุกสถานะ · หน่วยนับตามสถานะ · ความเป็นสมาชิกพื้นที่และวิธีของทุกแถว · conflict ไม่ถูกวาง · จุด 36 แถว (28 + 8 ของศูนย์การค้า) ไม่สร้างพิกัด · ศูนย์การค้า 7 แห่ง เขตตรงทะเบียน · บริษัทและความสัมพันธ์ join ด้วย id ครบ · ไม่มีที่อยู่ เบอร์โทร ลิงก์แผนที่ บันทึก หรือข้อความ README ในไฟล์ที่เผยแพร่ · ขอบเขต 928 เขต/อำเภอ 77 จังหวัด 77 ไฟล์ · digest ของใบรับ 78 ใบตรงกับดัชนีและ meta
- `tests/insight.test.js`: ข้อค้นพบแรกค่าเริ่มต้น (BKK · 1039/1007/1033 · 21/19/16 · 56/147 · 39 · สตูดิโอ 35/56 กับ 28/91 · เมืองภูเก็ต 17) · กติกาค่าเท่ากัน (Jetts → ปทุมวัน, Fitness First → กระจาย 11 เขต) · ตามตัวกรอง · EVID-05 (928 เขต, 857 measured_zero, no_data ไม่ใช้) · กรอบจังหวัด · คำ เขต/อำเภอ
- `tests/views.test.js`: ทุกมุมมองของแผงจบด้วย provenance หนึ่งบรรทัด · ข้อความข้อค้นพบ · สถานะอื่นแยกบรรทัด · ไม่อยู่ในอันดับ · บัตรแบรนด์ (บทบาทรวมต่อบริษัท ผู้ลงทุน บริษัทเดียวกัน ไม่มีคำว่าอิสระ) · missing ไม่เป็นศูนย์ · คำแปลครบทุก code ที่ข้อมูลใช้ · กราฟ · breadcrumb และลิงก์ production · series/รูปทรง (ไม่มีดาว) · ตัวกรอง escape ข้อความ
- `tests/scales.test.js`: LUT 41 ค่าของ `count`, สีระดับ, theme.css ไม่มีค่า analytical ใน dark, ระดับเรขาคณิต 1–2–5 อัตรา 2, EVID-05, contrast ของตัวเลขบนสี ≥ 4.5:1
- `tests/release.test.js`: cache tag เดียวทุกไฟล์และทุก module ใน import map · version เดียวกันทุกเอกสาร · JSON ผ่าน schema · ไม่มีลิงก์เอกสารส่วนตัว credential สเปรดชีต หรือไลบรารี LDS ใน tree
- `tests/frames.test.js` · `massing.test.js` (Aha 3 เขตต้องใช้ 16 tiles z14 = `MAX_TILES`, ไม่ถูกตัด) · `pins.test.js` · `building-join.test.js` · `geometry.test.js` · `mvt.test.js` · `map-style.test.js`

## 2. LDS parity (`npm run check:lds -- --lds <Landometer-Design-System-v0.9.7.md>`)

ไฟล์ LDS ของ Project (SHA-256 `d3085cbc0a50195f1cbf0c77b1d77c0d19b84364daf2948eb367348d65432d96` ตรงค่าที่อนุมัติ) — **115 ok, 0 failed** (29 ต.ค. 2569): release/colorSet, `count` light และ dark (LUT 41 ค่า anchors scaleVersion classes 3/5/7/9 noData zeroOutline), `assets/theme.css` foundation 17 บทบาท map roles 6 dataState series 1–10 fill + ink ทั้งสองธีม count 5 ระดับ (light เท่านั้น), รูปทรง 10 แบบตามลำดับ LDS

ความต่างที่รายงานต่อเจ้าของ (ไม่เลือกข้างเงียบ ๆ): ในไฟล์ LDS 0.9.7 record ของ scale `count` ฝั่ง dark ระบุ noData `#3B4849` / zeroOutline `#BAC6C0` ขณะที่ `machine.tokens.dataState` ระบุ dark `#404844` / `#93A398` — แผนที่ใช้ treatment ของ EVID-05 (`dataState`) เหมือน Restaurants และ Pharmacy

ไฟล์ใน `assets/` (ตรวจ 29 ต.ค. 2569): 25 ไฟล์ (ฟอนต์ `fonts.css` ไอคอน nav-7 favicon และไฟล์สัญญาอนุญาต) ตรง SHA-256 ใน `assetFiles` ของ LDS · `material-pictogram-300.woff2/.json` เป็นข้อยกเว้นทดลองของเจ้าของ (22 ต.ค. 2569, ไม่อยู่ในทะเบียน LDS — ใช้ไบต์เดียวกับ Luxury Brands) · `theme.css` เป็นไฟล์ของผลิตภัณฑ์ ตรวจค่าด้วย parity ข้างบน

## 3. Rendered harness (ในเครื่อง ไม่ใช่เว็บจริง)

Playwright + Chromium + MapLibre 5.6.2 จาก npm (unpkg และ OpenFreeMap ถูกบล็อกในสภาพแวดล้อมสร้างงาน — tiles เป็น tile ทดสอบ `tests/fixtures/mvt-sample.pbf` ซ้ำทุกตำแหน่ง ไม่มี glyph จึงไม่มี basemap และมวลอาคารจริง) 21 ฉาก ที่ 1440×900 และ 390×844 ทั้งสองธีม:

- หน้าแรก (สองธีม จอกว้างและจอแคบ) · sheet บนจอแคบ · เขตวัฒนา · เขตพระนคร (measured zero) · ศูนย์การค้า (eye preset pitch 75) · สาขาที่มีจุดและไม่มีจุด · แบรนด์ Fitness First (กระจาย) และ Jetts (เขตเดียว) · ทั้งประเทศ · จังหวัดภูเก็ต · สถานะประกาศเปิด (กระจาย) · กราฟ 3 มุมมอง · ตาราง · วิธีใช้
- ทุกฉาก: ไม่มี horizontal overflow ของหน้า แผง และแถบเครื่องมือ · launch state = ready · ไม่มี console error จากผลิตภัณฑ์ (มีเพียง 404 ของ glyph ที่ stub ไว้)
- สิ่งที่แก้จากการดูภาพ: แท่งกราฟแบรนด์ไม่มีสี (เพิ่ม `.bar-fill[class*="category-"]`) · ระยะห่างรูปทรงกับชื่อแบรนด์ · โฟกัสตัดผ่านค่าเท่ากัน (Jetts/Fitness First) → กติกาค่าเท่ากันและ “กระจาย” · บริษัทเดียวกันหลายบทบาท → รวมเป็นบรรทัดเดียว

## 4. Live

ยังไม่ได้บันทึกในรุ่นเอกสารนี้ — บันทึกหลังเผยแพร่และตรวจจริงเท่านั้น
