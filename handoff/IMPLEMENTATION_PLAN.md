# Implementation Plan — CityMETER Fitness 0.2.0

คู่กับ [implementation-plan.json](implementation-plan.json) · 29 ต.ค. 2569

## สถาปัตยกรรม

Static site บน GitHub Pages (main / root) · ES modules ผ่าน import map ที่ติด cache tag เดียวกันทุกไฟล์ · MapLibre GL 5.6.2 (unpkg, pinned) · tiles และ glyphs จาก OpenFreeMap · กราฟและตารางเป็น HTML ของเดโมเอง · earcut vendored (ISC)

| โมดูล | หน้าที่ |
|---|---|
| `js/app.js` | ประกอบทุกส่วน: ตัวกรอง สถานะ row scopes โหมดโฟกัส URL แผง กล้อง คลิกแผนที่ ขอบเขตรายจังหวัด |
| `js/model.js` | ถอด `data/fitness.json`, `filterRows`, `unitWords`, `summarize`, `mixOf`, ลิงก์ production |
| `js/areas.js` · `js/frames.js` | ดัชนีเขต/อำเภอ/จังหวัด, ผูกขอบเขตที่โหลด, locator สำหรับป้าย |
| `js/area-insight.js` | ข้อค้นพบแรก (กติกาค่าเท่ากัน, spread, บุคลิกสตูดิโอ, นอกบ้าน) |
| `js/profile-model.js` | โมเดลของแผงทุกโหมด รวมบริษัทและแบรนด์ที่บันทึกกับบริษัทเดียวกัน |
| `js/panel.js` · `js/breadcrumb.js` | HTML ของแผงและ breadcrumb (pure) |
| `js/scales.js` · `js/cues.js` | LDS count LUT + ramp 41 ระดับตามลำดับค่า (`buildRamp`, `rampLegendHTML`), series และรูปทรงของรูปแบบ |
| `js/map-layers.js` · `js/provinces.js` · `js/pins.js` · `js/building-join.js` | choropleth + ป้าย, กรอบจังหวัด, สัญลักษณ์และหมุด, จุดของสาขาและศูนย์การค้า × อาคาร (`joinBuildings`, `groupPieces`) |
| `js/venue-xray.js` | อาคารที่ดูอยู่วาดเหนืออาคารอื่นและชื่อถนน (custom layer, scissored depth clear, hit test) |
| `js/massing.js` · `js/geometry.js` · `js/mvt.js` · `js/map-style.js` · `js/camera.js` · `js/vendors.js` | มวลอาคาร (`featuresOf`, `fitPointsOf`, `obstaclesNear`, `setScene`) basemap กล้อง (`fitBuilding`, `twoPointBearing` จาก Shopping centers) และ loader |
| `js/chart-model.js` · `js/charts.js` | กราฟ count / mix / brands |
| `js/navigation.js` · `js/launch.js` | ไอคอน nav-7 + help dialog, หน้าโหลดและ error |

## งาน

| id | งาน | ขึ้นกับ | AC | สถานะ |
|---|---|---|---|---|
| P01 | อ่าน export ของชีตวิจัยและบันทึก hash | — | AC22 | done |
| P02 | base info พร้อมใบรับ, ดัชนีเขต/อำเภอ, ขอบเขตรายจังหวัด | P01 | AC13 AC22 | done |
| P03 | จับคู่เขตจากจุด ศูนย์การค้า หรือที่อยู่ของแถว; ตรวจจุดใกล้ขอบ; รายงาน conflict | P02 | AC05 AC06 | done |
| P04 | `data/fitness.json` + ตรวจตัวเลขหัวตารางของชีต | P03 | AC03 AC04 AC21 | done |
| P05 | model / areas / insight / scales / cues | P04 | AC02 AC07 AC08 | done |
| P06 | แผงทุกโหมด + provenance | P05 | AC09–AC12 | done |
| P07 | แผนที่: choropleth กรอบจังหวัด หมุด มวลอาคาร อาคาร กล้อง | P05 | AC13–AC16 | done |
| P08 | กราฟและตาราง | P05 | AC17 AC18 | done |
| P09 | copy, help, เอกสาร, handoff JSON, LDS parity | P06–P08 | AC19 AC20 AC23 | done |
| P10 | เผยแพร่ GitHub Pages, verify live, เดินตรวจเว็บจริง | P09 | AC01 AC24 AC25 | ดู VERIFICATION.md |
| P11 | มุมมองอาคาร: eye + มุมสองด้าน + zoom to fit กรอบว่าง ทุกทางเข้า, x-ray, อาคารที่บังโปร่ง, ป้ายไม่ทับ, ซูมได้ถึง 21 สำหรับอาคารเล็ก, GeoJSON maxzoom 24 (เจ้าของ 29 ต.ค. 19:47) | P07 | AC26 AC27 | done |
| P12 | รายการเดียวต่ออาคาร: ศูนย์การค้า × อาคาร, สาขาที่ผูก + สาขาที่จุดตก ไม่นับซ้ำ | P06 P11 | AC28 AC30 | done |
| P13 | สีครบ 41 ระดับของ LDS ตามลำดับค่า (กติกาประจำของเจ้าของ) ทั้งแผนที่ กรอบจังหวัด กราฟ และคำอธิบาย | P05 | AC29 | done |
| P14 | เผยแพร่ 0.2.0, verify live, เดินตรวจมุมมองอาคารบนเว็บจริง (desktop และ 390 px สองธีม) | P11–P13 | AC24 AC25 AC26 AC27 | ดู VERIFICATION.md |

## Acceptance criteria

AC01 โหลดครั้งแรก · AC02 ข้อค้นพบแรกค่าเริ่มต้น · AC03 หน่วยเริ่มต้น · AC04 ตัวกรองสถานะ · AC05 ความเป็นสมาชิกพื้นที่ · AC06 conflict · AC07 ค่าเท่ากัน · AC08 EVID-05 · AC09 provenance · AC10 บัตรแบรนด์ · AC11 แผงเขต · AC12 แผงสาขา · AC13 ขอบเขตรายจังหวัด · AC14 focus + quiet · AC15 ศูนย์การค้า · AC16 มุมมองประเทศ · AC17 กราฟ · AC18 ตาราง · AC19 ภาษาไทย · AC20 LDS parity · AC21 ความสะอาดของข้อมูลที่เผยแพร่ · AC22 ใบรับ · AC23 ความสอดคล้องของรุ่น · AC24 ไบต์บนเว็บจริง · AC25 เดินตรวจเว็บจริง · AC26 กล้องมุมมองอาคาร · AC27 ไม่มีอาคารอื่นบัง · AC28 รายการเดียวต่ออาคาร · AC29 สีครบ 41 ระดับ · AC30 ชิ้นอาคารเป็นอาคารเดียว (ข้อความเต็มและวิธีตรวจใน JSON)

## วิธีทำงานต่อ

1. อ่าน `AGENTS.md` แล้ว `handoff/README.md`, `PRODUCT_STATEMENT.md` และ brief คู่ md/json
2. รัน `npm test` ก่อนแก้ คงสัญญา row scopes หน่วยตามสถานะ โหมดโฟกัส กติกาค่าเท่ากัน ตัวชี้วัด ขอบเขต และ action ของแผง
3. ทำทีละงาน คง id ของ invariant INV01–INV24
4. ตรวจการคำนวณบนข้อมูลจริงใน `tests/`
5. ตรวจหน้าจอภาษาไทยที่ 390 px และ desktop ทั้งสองธีม ถ้า tiles ถูกบล็อกใช้ harness ในเครื่องตรวจ layout แล้วยืนยันภาพจริงบนเว็บ
6. เพิ่ม cache tag และ version พร้อมกัน เผยแพร่ รัน `npm run verify:live` และเดินตรวจเว็บจริงก่อนรายงาน

## Backlog (เจ้าของจัดลำดับ)

| id | งาน | ผู้รับ |
|---|---|---|
| N01 | ทะเบียนโลโก้แบรนด์ (ไบต์ต้นฉบับ sha256 บทบาท) และโลโก้ที่ zoom ใกล้ | research + developer |
| N02 | ตรวจเงื่อนไขการใช้ของแต่ละแหล่งทางการก่อนใช้เชิงพาณิชย์/production และบันทึกการตัดสินใจ | owner / legal |
| N03 | รอบตรวจซ้ำตามกำหนดพร้อมบันทึกการเปลี่ยนแปลง (เปิด ปิด ประกาศ) และคลังตามวันที่ | data engineer |
| N04 | ผูก Locale Insight id เพื่อบริบทย่าน (id join เท่านั้น) | data engineer |
| N05 | ตรวจบริษัทกับทะเบียนนิติบุคคลและบันทึกเลขทะเบียน | research |
| N06 | ผูกสาขากับศูนย์การค้า CityMETER เพิ่มด้วย venue id (งานวิจัย) ไม่ใช้ชื่อ | research |
| N07 | ลดสาขาที่ระบุพื้นที่ไม่ได้: ขอคำเขต/อำเภอหรือจุดจากหน้าทางการในรอบวิจัยถัดไป | research |
| N08 | ตรวจภาคสนามตัวอย่างสาขาเพื่อวัดช่องว่างระหว่าง “แสดงในแหล่ง” กับเปิดจริง | research |
| N09 | dataset ใน CityMETER production (พารามิเตอร์ `d=`) เมื่อมี product dataset id | owner + platform |
| N10 | ทดสอบ hypotheses H1–H5 กับผู้ใช้ภายนอก | owner / product |
| N11 | จอแคบ 390 px: ภาพแรกยังต่ำกว่า minzoom ของมวลอาคาร (ลด minzoom บนจอแคบ หรือ fit เขตแรก) — ตัดสินพร้อม Luxury Brands แล้วตรวจบนเครื่องจริง | owner + developer |
| N12 | มุมมองประเทศ: คำบรรยายกราฟ “สีเดียวกับแผนที่” หมายถึงชั้นเขต/อำเภอ ขณะที่แผนที่แสดงกรอบจังหวัด | developer |
| N13 | ปุ่มซูม/เข็มทิศของ MapLibre ในธีมมืดยังเป็นพื้นขาว (ผูก token foundation) | developer |
| N14 | การ์ดบนแผนที่ของมุมมองอาคารบนมือถือเมื่อปิด sheet (ชื่อ + ตัวเลขหลัก) แบบ Shopping centers — รอเจ้าของตัดสิน | owner + developer |
