# CityMETER: Fitness

**สาขาฟิตเนสกระจุกอยู่ตรงไหน และเป็นฟิตเนสแบบไหน** — เดโมแผนที่ 3 มิติของสาขาฟิตเนสและสตูดิโอในประเทศไทย ที่อ่านสาขาของ 126 แบรนด์ในชุดข้อมูลวิจัยเป็นจำนวนต่อเขต/อำเภอ พร้อมรูปแบบ (ยิมเทียบสตูดิโอ) สถานะตามแหล่งทางการ บริษัทเบื้องหลังแบรนด์ และที่มาของทุกตัวเลข

- เว็บ: https://montri-th.github.io/fitness/
- ระบบจริงของ CityMETER: https://landometer.com/v3/citymeter
- รุ่น 0.2.1 · 29 ตุลาคม 2569 · ชีตวิจัยตรวจแหล่ง 26 ตุลาคม 2569 · ขอบเขต production อ่าน 29 ตุลาคม 2569

ข้อค้นพบแรก (snapshot ปัจจุบัน ไม่กรอง): **38% ของสาขาในกรุงเทพมหานครที่ระบุเขตได้ (56 จาก 147) อยู่ใน 3 เขต — วัฒนา ปทุมวัน คลองเตย** · สตูดิโอ 63% (35/56) ใน 3 เขตนี้ เทียบ 31% (28/91) ในเขตอื่นของกรุงเทพฯ · นอกกรุงเทพฯ มากที่สุดที่อำเภอเมืองภูเก็ต 17 สาขา

> ชุดข้อมูล CityMETER Fitness · แหล่ง หน้าทางการของแต่ละแบรนด์ · ตรวจ 26 ต.ค. 2569 · ขอบเขต เขต/อำเภอของ CityMETER ทั่วประเทศ — สาขา = สาขาที่หน้าทางการของแบรนด์ยังแสดง ณ วันตรวจ · 126 แบรนด์ในชุดข้อมูล ไม่ใช่ทุกฟิตเนสในประเทศ

## ใช้งาน

```sh
npm start   # http://127.0.0.1:4173/
npm test    # unit tests บนข้อมูลจริง (node --test)
```

เป็น static site ไม่มี build step และไม่ต้อง `npm install` (Node ≥ 20 สำหรับ tests, Python 3 สำหรับ server) แผนที่โหลด MapLibre GL 5.6.2 จาก unpkg และ tiles/glyphs จาก OpenFreeMap; basemap สร้างเองใน `js/map-style.js` กราฟไม่ใช้ไลบรารีภายนอก ถ้าแผนที่โหลดไม่ได้ ข้อค้นพบ แผง กราฟ และตารางยังใช้ได้ การเปิด `index.html` เป็นไฟล์จะพาไปเว็บสาธารณะ

## สิ่งที่สำรวจได้

- **ข้อค้นพบแรกแบบ 3 มิติ:** หน้าแรกโฟกัสเขต/อำเภอที่มีสาขามากที่สุด (ไม่เกิน 3) ในจังหวัดที่มีสาขาที่ระบุเขตได้มากที่สุด บอกสัดส่วน ตัวตั้ง ตัวหาร สัดส่วนสตูดิโอเทียบส่วนอื่นของจังหวัด และพื้นที่ที่มีมากที่สุดนอกจังหวัดนั้น — ไม่ตัดผ่านค่าที่เท่ากัน ถ้าทุกเขตเท่ากันจะบอกว่าสาขา “กระจาย”
- **สถานะ:** ค่าเริ่มต้นนับสาขาที่หน้าทางการยังแสดง ณ วันตรวจ · ประกาศเปิด ปิดแล้ว และต้องตรวจสถานะ เลือกดูแยกได้ (คำบนจอเปลี่ยนเป็น “รายการ”) ไม่บวกรวมกัน
- **เส้นทาง:** ประเทศไทย › จังหวัด › เขต/อำเภอ (› ศูนย์การค้า) ใช้รหัสเดียวกับ CityMETER production และเปิดพื้นที่เดียวกันในระบบจริงได้
- **แบรนด์และบริษัท:** เลือกแบรนด์เพื่อดูบริษัทที่แหล่งทางการระบุ (ผู้ดำเนินงานในไทย เจ้าของแบรนด์ ผู้ถือสิทธิ์ ผู้ลงทุน) พร้อมลิงก์หลักฐาน และแบรนด์อื่นที่บันทึกกับบริษัทเดียวกัน
- **อาคารที่ดูอยู่ (0.2.0):** เลือกศูนย์การค้า อาคาร หรือสาขาที่มีพิกัด กล้องหันมุมให้เห็นอาคารสองด้าน (2-point perspective) และซูมให้อาคารพอดีส่วนที่ว่างของแผนที่ทุกครั้ง ทั้งจอกว้างและมือถือ · อาคารนั้นวาดเหนืออาคารอื่นเสมอ (x-ray) อาคารที่บังโปร่ง ป้ายเขตไม่ทับ · รายชื่อในอาคารเป็นรายการเดียว: สาขาที่ชีตผูกกับศูนย์การค้าในทะเบียน CityMETER และสาขาที่จุดตกในอาคารเดียวกัน
- **กราฟและตาราง:** จำนวนสาขาต่อเขต/อำเภอ · เขต × รูปแบบ · จำนวนสาขาต่อแบรนด์ · ตารางสาขาพร้อมสถานะและวิธีระบุพื้นที่

## Data and method

- หนึ่งแถว = การพบสาขาหนึ่งในแหล่งทางการของแบรนด์ (แท็บ `02_STORES` ของชีตวิจัย) 378 แถว: เปิดตามแหล่ง 352 · ประกาศเปิด 19 · ปิดแล้ว 2 · ต้องตรวจสถานะ 5 (`data/fitness.json`)
- เขต/อำเภอจับคู่ตอนสร้างข้อมูลจากจุดของแหล่ง ศูนย์การค้าในทะเบียน หรือที่อยู่ของแถวเอง วิธีบันทึกในทุกแถว · 252 จาก 352 สาขาระบุเขตได้ ที่เหลือนับในยอดรวมและบอกแยก ไม่แสดงเป็นศูนย์ในพื้นที่ใด
- ตัวชี้วัดคือจำนวน (LDS `count`) ไม่มีความหนาแน่น เพราะชุดข้อมูลครอบคลุมเฉพาะแบรนด์ที่คัดไว้ · สีใช้ครบ 41 ระดับของ LDS ตามลำดับค่า (ต่ำสุดระดับแรก สูงสุดระดับสุดท้าย ค่าเท่ากันสีเดียวกัน)
- พิกัดมี 36 แถว (28 จุดจากแหล่ง · 8 จุดอ้างอิงของศูนย์การค้า) ไม่สร้างพิกัดจากที่อยู่
- ไม่คัดลอกที่อยู่ เบอร์โทร ลิงก์แผนที่ หรือบันทึกของนักวิจัย
- รายละเอียด: [DATA_METHOD.md](DATA_METHOD.md) · [docs/CHART_SELECTION.md](docs/CHART_SELECTION.md) · [docs/BUILD_CARD.md](docs/BUILD_CARD.md) · Product Statement: [PRODUCT_STATEMENT.md](PRODUCT_STATEMENT.md)

## โครงสร้าง

```
index.html            หน้าเดียว (header, map, chart tray, table, reading panel, help)
styles.css            layout + panel + map chrome + charts + สี series ของรูปแบบ (ใช้ token จาก assets/theme.css)
navigation.css        ไอคอน nav-7, help dialog
assets/theme.css      ค่า LDS 0.9.7 ที่ใช้ (foundation, map roles, dataState, series 1–10, count 5 ระดับ, basemap tokens)
js/app.js             ประกอบทุกส่วน: selection, สถานะ, URL, panel modes, camera, map click, โหลดขอบเขตรายจังหวัด
js/model.js           ถอดข้อมูล, ตัวกรอง, หน่วยนับตามสถานะ, สรุป, ลิงก์ production
js/areas.js           ดัชนีเขต/อำเภอและจังหวัด (ไม่มีเรขาคณิต) + ผูกขอบเขตที่โหลดแล้ว
js/frames.js          โหลดขอบเขตทีละจังหวัด + locator จังหวัด
js/area-insight.js    ข้อค้นพบแรก (เขตที่กระจุก ไม่ตัดผ่านค่าเท่ากัน + บุคลิกสตูดิโอ + นอกจังหวัด)
js/scales.js          LUT 41 ค่าของ count + ramp 41 ระดับตามลำดับค่า, คำอธิบายแถบสี และ EVID-05
js/cues.js            รูปแบบ → LDS series + รูปทรงประจำ series
js/map-layers.js      choropleth เขต/อำเภอ + ป้ายบนแผนที่
js/provinces.js       กรอบจังหวัดในมุมมองประเทศ
js/pins.js            สัญลักษณ์สาขา, จุดบริบท, หมุด HTML ที่ซูมใกล้
js/building-join.js   จุดของสาขาและศูนย์การค้า × อาคารที่แผนที่วาด (รวมชิ้นอาคารข้ามขอบ tile และ building:part เป็นอาคารเดียว)
js/venue-xray.js      วาดอาคารที่ดูอยู่เหนืออาคารอื่นทั้งหมด (custom layer, ใช้ร่วมกับ Luxury Brands / Shopping centers / Restaurants)
js/massing.js · js/geometry.js · js/mvt.js · js/map-style.js · js/camera.js · js/vendors.js
                      มวลอาคารเมือง, basemap, กล้อง (fitBuilding · twoPointBearing จาก Shopping centers), MapLibre loader
js/profile-model.js · js/panel.js · js/chart-model.js · js/charts.js · js/breadcrumb.js · js/navigation.js · js/launch.js
data/                 fitness.json, area-index.json, frames/{CODE}.json (77 จังหวัด), provinces.geojson, boundary-receipts.json
scripts/              build-boundaries.py, admin_text.py, build-data.py, fetch-edge-geometry.py, build-receipts.py,
                      build-handoff.mjs, verify-live.mjs, check-lds-parity.mjs, build-pictogram-font.py
tests/                node --test บนข้อมูลจริง
handoff/              Product Brief, Implementation Plan, Verification, JSON + schema
```

## Assets and verification

- สีทุกค่าตรง LDS 0.9.7 (`v0.9.7-owner.1`, `color-srgb-10`, SHA-256 `d3085cbc…2d96`) — ตรวจด้วย `npm run check:lds -- --lds <ไฟล์ LDS>` กับไฟล์ LDS ต้นฉบับ (ไฟล์ LDS ไม่อยู่ใน repository) ผลบันทึกใน [handoff/VERIFICATION.md](handoff/VERIFICATION.md)
- ฟอนต์และไอคอนจาก LDS build kit (`assets/lds/build-kit/`), ไอคอน nav-7 และ pictogram (Apache-2.0) ชุดเดียวกับ Luxury Brands
- ขอบเขตจาก CityMETER production (ใบรับใน `data/boundary-receipts.json`); อาคาร © OpenStreetMap contributors (ODbL 1.0); basemap © OpenFreeMap / OpenMapTiles / OpenStreetMap; ชื่ออังกฤษสำหรับอ่านที่อยู่ OpenGISData-Thailand (CC BY 4.0)
- ข้อมูลสาขาจากหน้าทางการของแบรนด์ตามชีตวิจัย — สิทธิ์การใช้ของแต่ละแหล่งยังไม่ได้ตรวจ (DATA_METHOD §11)
- `npm run handoff:manifest` สร้าง hash ของทุกไฟล์ · `npm run verify:live` เทียบไบต์บนเว็บจริงกับ manifest

ส่งต่อให้ developer หรือ coding agent: เริ่มที่ [handoff/README.md](handoff/README.md) และอ่าน [AGENTS.md](AGENTS.md) ก่อนแก้ไข
