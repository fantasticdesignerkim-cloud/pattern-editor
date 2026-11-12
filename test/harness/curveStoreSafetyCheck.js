// ═════════════════════════════════════════════
// curveStoreSafetyCheck.js — 곡선 저장·복원 안전성(2026-11-12) 실행 검사.
// 실제 js/state.js + js/handles.js + js/storage.js 를 vm 으로 실행한다(가짜 localStorage — 실제 저장소 무접촉).
//   node test/harness/curveStoreSafetyCheck.js
//   §1 로드 순서(자동 복원이 render 를 부르지 않음) · §2 잘못된 가져오기 거부(전후 state/storage 동일)
//   §3 정상 legacy·신규 호환 · §4 깨진 기존 로컬값(기본 시작·원문 보존) · §5 저장 실패(용량·접근 예외)
//   §6 markDirty: 소매 입력은 몸판 곡선 불변 · 다음 저장에서도 보존 · §7 권위 백업 파일(있을 때만)
// ═════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
// CURVE_CHECK_JS_DIR: 수정 전 소스(예: git show HEAD:js/… 로 뽑은 사본)에 이 검사가 실패하는지 대조할 때만 쓴다.
const JS_DIR = process.env.CURVE_CHECK_JS_DIR || path.join(ROOT, "js");
const JS = f => fs.readFileSync(path.join(JS_DIR, f), "utf8");
const SRC = { state: JS("state.js"), handles: JS("handles.js"), storage: JS("storage.js") };
const BACKUP = path.join(ROOT, "armhole_data_2026-07-16.json");

let PASS = 0, FAIL = 0; const fails = [];
function ok(c, name) { if (c) PASS++; else { FAIL++; fails.push(name); } }

// 새 세션. pre = 미리 채운 localStorage 원문, inputs = 입력칸 값.
function boot(pre = {}, inputs = {}) {
  const store = Object.assign({}, pre);
  const fail = { set: {}, get: null };            // 실패 주입: set[key] = 예외 이름 / get = 예외 이름
  const mkErr = name => { const e = new Error(name); e.name = name; return e; };
  const els = {};
  const vals = Object.assign({ inpB: 83, inpW: 64, inpBL: 38, inpSL: 52, inpHem: 30, selCapFormula: "culture" }, inputs);
  for (const id of Object.keys(vals)) els[id] = { id, value: String(vals[id]) };
  els.saveCount = { id: "saveCount", textContent: "" };
  els.cv = { getBoundingClientRect: () => ({ left: 0, top: 0 }), addEventListener() {} };
  const log = { alerts: [], renders: 0, renderThrows: true };
  const sb = {
    console,
    localStorage: {
      getItem: k => { if (fail.get) throw mkErr(fail.get); return k in store ? store[k] : null; },
      setItem: (k, v) => { if (fail.set[k]) throw mkErr(fail.set[k]); store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    },
    document: { getElementById: id => els[id] || null, createElement: () => ({}), body: {} },
    alert: m => { log.alerts.push(String(m)); },
    // 로드 중에는 뒤 스크립트(dartMove.js 등)가 없어 render 가 ReferenceError 를 낸다 — 그 상황을 흉내.
    render: () => { log.renders++; if (log.renderThrows) throw new ReferenceError("buildGen0WaistDarts is not defined"); },
    FileReader: function () {}, setTimeout, clearTimeout
  };
  vm.createContext(sb);
  let loadError = null;
  try {
    vm.runInContext(SRC.state, sb, { filename: "state.js" });
    vm.runInContext(SRC.handles, sb, { filename: "handles.js" });
    vm.runInContext(SRC.storage, sb, { filename: "storage.js" });
  } catch (e) { loadError = e; }
  const ev = code => vm.runInContext(code, sb);
  return { sb, store, fail, els, log, ev, loadError,
    body: () => ev("JSON.stringify([state.armH,state.fArmH,state.bNeckH,state.fNeckH])"),
    all: () => ev("JSON.stringify([state.armH,state.fArmH,state.bNeckH,state.fNeckH,state.sleeveH])"),
    count: () => els.saveCount.textContent };
}
const snap = s => JSON.stringify(s.store);
const P = (x, y) => ({ x, y });
function entry(B = 83, W = 64, BL = 38, v = 1, extra = {}) {
  return Object.assign({
    timestamp: "2026-01-0" + v + "T00:00:00.000Z",
    measurements: { B, W, BL, SL: 52, Hem: 30 }, capFormula: "culture",
    anchors: { a1: P(v, 1), a2: P(v, 2), a3: P(v, 3) },
    handles: { h0: P(v, 4), h1a: P(v, 5), h1b: P(v, 6), h2a: P(v, 7), h2b: P(v, 8), h3a: P(v, 9), h3b: P(v, 10), h4: P(v, 11) },
    fArmhole: { hGa: P(v, 12), hGb: P(v, 13), hFa: P(v, 14), hFb: P(v, 15) },
    bNeckline: { h0: P(v, 16), h1: P(v, 17) }, fNeckline: { h0: P(v, 18), h1: P(v, 19) },
    sleevePattern: { anchorCount: 3, segments: [{ c1: P(v, 20), c2: P(v, 21) }, { c1: P(v, 22), c2: P(v, 23) }],
                     anchorOffsets: [{ dx: 0, dy: 0 }, { dx: 0.1, dy: 0 }, { dx: 0, dy: 0 }] }
  }, extra);
}
// 구버전: SL·Hem·capFormula·sleevePattern 없음(권위 백업의 가장 오래된 형태).
function legacy(B = 83, W = 64, BL = 38, v = 2) {
  const e = entry(B, W, BL, v); delete e.capFormula; delete e.sleevePattern; e.measurements = { B, W, BL }; return e;
}
const kvOf = (...es) => { const o = {}; for (const e of es) o[e.measurements.B + "-" + e.measurements.W + "-" + e.measurements.BL] = e; return JSON.stringify(o); };
const clone = o => JSON.parse(JSON.stringify(o));

// ── §1 로드 순서: 저장값이 있어도 로드 중 render 를 부르지 않는다 ──
{
  const e = entry(83, 64, 38, 1);
  const pre = { armhole_data: JSON.stringify([e]), armhole_data_kv: kvOf(e) };
  const s = boot(pre);
  ok(s.loadError === null, "1: 저장값 있는 로드에서 예외 없음(" + (s.loadError && s.loadError.message) + ")");
  ok(s.log.renders === 0, "1: 로드 중 render 호출 0회");
  ok(s.ev("state.armH && state.armH.a1.x") === 1 && s.ev("state.sleeveH.anchorCount") === 3, "1: 저장 곡선이 state 에 복원됨");
  ok(s.count() === "저장 1건 (치수별)", "1: 저장 건수 갱신(" + s.count() + ")");
  ok(snap(s) === JSON.stringify(pre), "1: 로드는 저장소에 쓰지 않음");
  // 치수 전환 분기(render 안에서 호출)도 render 를 다시 부르지 않는다 = 재귀 없음
  ok(s.ev("loadSavedCurveForCurrentMeasurements(false)") === true && s.log.renders === 0, "1: 자동 복원은 render 를 부르지 않음(재귀 방지)");
  s.log.renderThrows = false;
  ok(s.ev("loadSavedCurveForCurrentMeasurements(true)") === true && s.log.renders === 1, "1: «불러오기» 버튼 경로는 그린다");
  const empty = boot();
  ok(empty.loadError === null && empty.count() === "저장 0건 (치수별)" && Object.keys(empty.store).length === 0, "1: 빈 저장소 로드 = 0건·0키");
}

// ── §2 잘못된 가져오기: 거부 + 전후 state/storage 동일 ──
{
  const good = entry(83, 64, 38, 1);
  const bads = {
    "배열 아님(문자열)": '"hello"',
    "배열 아님(객체)": '{"a":1}',
    "프로젝트 파일": '{"format":"bunka-pattern-editor.project","schemaVersion":1}',
    "빈 배열": "[]",
    "null 항목": "[null]",
    "measurements 없음": JSON.stringify([Object.assign(clone(good), { measurements: undefined })]),
    "B 문자열": JSON.stringify([Object.assign(clone(good), { measurements: { B: "83", W: 64, BL: 38 } })]),
    "B 음수": JSON.stringify([Object.assign(clone(good), { measurements: { B: -83, W: 64, BL: 38 } })]),
    "핸들 점 누락": (() => { const e = clone(good); delete e.handles.h2a; return JSON.stringify([e]); })(),
    "좌표 문자열": (() => { const e = clone(good); e.fArmhole.hGa.x = "12"; return JSON.stringify([e]); })(),
    "좌표 null": (() => { const e = clone(good); e.bNeckline.h0.y = null; return JSON.stringify([e]); })(),
    "좌표 Infinity(1e999)": JSON.stringify([good]).replace('"hGa":{"x":1,', '"hGa":{"x":1e999,'),
    "좌표 과대": (() => { const e = clone(good); e.anchors.a1.x = 1e9; return JSON.stringify([e]); })(),
    "위험 키 __proto__": JSON.stringify([good]).replace('"capFormula"', '"__proto__":{"polluted":1},"capFormula"'),
    "위험 키 constructor(깊은 곳)": JSON.stringify([good]).replace('"hGa":{', '"hGa":{"constructor":{"prototype":{}},'),
    "anchors 만 있음": JSON.stringify([Object.assign(clone(good), { handles: null })]),
    "segments 개수 불일치": (() => { const e = clone(good); e.sleevePattern.segments.pop(); return JSON.stringify([e]); })(),
    "anchorCount 소수": (() => { const e = clone(good); e.sleevePattern.anchorCount = 2.5; return JSON.stringify([e]); })(),
    "anchorOffsets NaN 대용 null": (() => { const e = clone(good); e.sleevePattern.anchorOffsets[1].dx = null; return JSON.stringify([e]); })(),
    "곡선 없음": JSON.stringify([{ measurements: { B: 83, W: 64, BL: 38 } }]),
    "정상 1 + 불량 1(전부 거부)": (() => { const b = clone(good); delete b.fNeckline.h1; return JSON.stringify([entry(90, 70, 40, 3), b]); })()
  };
  ok(bads["좌표 Infinity(1e999)"].includes("1e999") && bads["위험 키 __proto__"].includes("__proto__") && bads["위험 키 constructor(깊은 곳)"].includes("constructor"), "2: 픽스처 치환 확인");
  const base = entry(83, 64, 38, 5);
  for (const name of Object.keys(bads)) {
    const s = boot({ armhole_data: JSON.stringify([base]), armhole_data_kv: kvOf(base) });
    s.ev("state.armH.h0.x = 77.7");                      // 저장 안 된 현재 작업
    const st0 = s.all(), ls0 = snap(s);
    let threw = null;
    try { s.sb.importCurveEntries(JSON.parse(bads[name])); } catch (e) { threw = e; }
    ok(threw && typeof threw.message === "string" && threw.message.length > 5, "2: 거부 + 사유 — " + name);
    ok(s.all() === st0, "2: state 동일 — " + name);
    ok(snap(s) === ls0, "2: storage 동일 — " + name);
    ok(({}).polluted === undefined, "2: prototype 오염 없음 — " + name);
    // 새로고침(새 세션, 같은 저장소) 정상
    const again = boot(s.store);
    ok(again.loadError === null && again.ev("state.armH.a1.x") === 5 && again.count() === "저장 1건 (치수별)", "2: 재로드 정상 — " + name);
  }
  // 실제 UI 경로(importDataFromFile): 깨진 JSON 원문 → 알림에 이유, 성공 문구 없음, 전후 동일
  for (const [name, text] of [["깨진 JSON", "{ not json"], ["프로젝트 파일", bads["프로젝트 파일"]], ["점 누락", bads["핸들 점 누락"]]]) {
    const s = boot({ armhole_data: JSON.stringify([base]), armhole_data_kv: kvOf(base) });
    s.log.renderThrows = false;
    s.sb.FileReader = function () { this.readAsText = () => { this.result = text; this.onload(); }; };
    const st0 = s.all(), ls0 = snap(s), input = { files: [{}], value: "x" };
    s.sb.importDataFromFile(input);
    const msg = s.log.alerts.join("|");
    ok(/가져오기 실패/.test(msg) && !/가져오기 완료/.test(msg), "2: UI 알림 = 실패 사유 — " + name);
    ok(s.all() === st0 && snap(s) === ls0 && s.log.renders === 0, "2: UI 경로 전후 동일 — " + name);
  }
  ok(/프로젝트 열기/.test((() => { try { boot().sb.importCurveEntries(JSON.parse(bads["프로젝트 파일"])); } catch (e) { return e.message; } })()), "2: 프로젝트 파일은 «프로젝트 열기» 안내");
}

// ── §3 정상 legacy·신규 호환 ──
{
  const s = boot({}, { inpB: 90, inpW: 70, inpBL: 40 });
  const file = [legacy(83, 64, 38, 2), entry(83, 64, 38, 3), entry(90, 70, 40, 4), legacy(86, 66, 38, 6)];
  const r = s.sb.importCurveEntries(clone(file));
  ok(r.imported === 4 && r.duplicates === 0 && r.skipped === 0 && r.total === 4, "3: legacy+신규 4건 가져옴");
  ok(JSON.parse(s.store.armhole_data).length === 4 && Object.keys(JSON.parse(s.store.armhole_data_kv)).length === 3, "3: 두 키 모두 기록(이력 4 · 치수별 3)");
  ok(JSON.parse(s.store.armhole_data_kv)["83-64-38"].handles.h0.x === 3, "3: 같은 치수는 뒤 항목이 이김");
  ok(s.count() === "저장 3건 (치수별)" && s.sb.getSavedCurveEntries().length === 3, "3: 건수 = 복원 가능 목록");
  const ls1 = snap(s);
  const r2 = s.sb.importCurveEntries(clone(file));
  ok(r2.imported === 0 && r2.duplicates === 4 && snap(s) === ls1, "3: 재가져오기 멱등(저장소 불변)");
  ok(s.sb.loadSavedCurveForCurrentMeasurements(false) === true && s.ev("state.armH.a1.x") === 4 && s.ev("state.sleeveH.segments.length") === 2, "3: 현재 치수 곡선 적용");
  // legacy 항목(소매 없음) 복원
  const l = boot({ armhole_data: JSON.stringify([legacy(83, 64, 38, 2)]), armhole_data_kv: kvOf(legacy(83, 64, 38, 2)) });
  ok(l.ev("state.armH.a1.x") === 2 && l.ev("state.sleeveH") === null && l.count() === "저장 1건 (치수별)", "3: legacy 항목 자동 복원");
  // kv 없이 구버전 배열만: 복원·건수가 같은 목록
  const arrOnly = boot({ armhole_data: JSON.stringify([legacy(83, 64, 38, 2), legacy(86, 66, 38, 6), legacy(83, 64, 38, 7)]) });
  ok(arrOnly.ev("state.armH.a1.x") === 7, "3: 배열만 있을 때 같은 치수의 마지막 항목 복원");
  ok(arrOnly.count() === "저장 2건 (치수별)" && arrOnly.sb.getSavedCurveEntries().length === 2, "3: 배열만 있을 때 건수 = 복원 가능 치수 수(종전 0건 표시)");
  // 그 상태에서 저장 → 다른 치수(배열에만 있음)가 건수·복원에서 사라지지 않는다
  ok(arrOnly.sb.autoSaveCurveData() === true && arrOnly.count() === "저장 2건 (치수별)", "3: 저장 후에도 배열 쪽 치수 유지");
  ok(arrOnly.sb.getSavedCurveEntries().some(e => e.measurements.B === 86), "3: 배열 쪽 86-66-38 여전히 복원 가능");
}

// ── §4 깨진 기존 로컬값: 기본 시작 가능 · 원문 보존 · 저장 거부 ──
{
  const good = entry(83, 64, 38, 1), other = entry(90, 70, 40, 3);
  const half = clone(good); delete half.handles.h4;                    // 부분 누락
  const cases = {
    "kv 깨진 JSON": { armhole_data: JSON.stringify([good]), armhole_data_kv: '{"83-64-38": {"meas' },
    "배열 깨진 JSON": { armhole_data: "[{,,", armhole_data_kv: kvOf(good) },
    "kv 가 배열": { armhole_data: JSON.stringify([good]), armhole_data_kv: "[1,2]" },
    "배열이 문자열": { armhole_data: '"oops"', armhole_data_kv: kvOf(good) },
    "둘 다 깨짐": { armhole_data: "not json", armhole_data_kv: "}{" },
    "kv 현재 치수 항목 부분 누락": { armhole_data: JSON.stringify([half]), armhole_data_kv: JSON.stringify({ "83-64-38": half, "90-70-40": other }) },
    "kv 값이 null·숫자": { armhole_data: "[null, 5]", armhole_data_kv: '{"83-64-38": null, "x": 5}' }
  };
  for (const name of Object.keys(cases)) {
    const pre = cases[name], raw = JSON.stringify(pre);
    const s = boot(pre);
    ok(s.loadError === null && s.log.renders === 0, "4: 로드 예외 없음 — " + name);
    ok(snap(s) === raw, "4: 로드 후 원문 그대로 — " + name);
    ok(/⚠|읽을 수 없는 항목/.test(s.count()), "4: 건수 줄에 이유 표시 — " + name + " [" + s.count() + "]");
    // 깨진 값이 state 를 오염시키지 않는다: 복원됐다면 완전한 항목뿐
    const armH = s.ev("state.armH");
    ok(armH === null || Object.keys(armH).every(k => armH[k] && Number.isFinite(armH[k].x)), "4: state 무오염 — " + name);
    // 기본 시작 후 편집 → 저장 시도: 거부(원문 보존) + 성공 문구 없음
    s.ev("state.armH = " + JSON.stringify(Object.assign({}, good.handles, good.anchors)) + "; state.fArmH = " + JSON.stringify(good.fArmhole)
       + "; state.bNeckH = " + JSON.stringify(good.bNeckline) + "; state.fNeckH = " + JSON.stringify(good.fNeckline));
    const r = s.sb.saveCurveData(), msg = s.log.alerts.join("|");
    ok(r === false && /저장하지 못했습니다/.test(msg) && !/저장 완료/.test(msg), "4: 저장 거부 + 사유 — " + name);
    ok(/덮어쓰지 않았습니다/.test(msg), "4: 사유 = 원문 보호 — " + name);
    ok(snap(s) === raw, "4: 저장 시도 후에도 원문 그대로 — " + name);
    ok(s.sb.autoSaveCurveData() === false && snap(s) === raw, "4: 자동 저장도 거부·원문 그대로 — " + name);
    let threw = false; try { s.sb.importCurveEntries([entry(83, 64, 38, 8)]); } catch (e) { threw = true; }
    ok(threw && snap(s) === raw, "4: 가져오기도 거부·원문 그대로 — " + name);
  }
  // kv 만 깨지고 배열은 멀쩡 → 배열에서 복원
  const s = boot(cases["kv 깨진 JSON"]);
  ok(s.ev("state.armH.a1.x") === 1 && /^저장 1건 \(치수별\)/.test(s.count()), "4: kv 손상 시 이력 배열에서 복원");
  // 현재 치수 항목만 깨짐 → 그 치수는 복원 안 함, 다른 치수는 정상 집계
  const h = boot(cases["kv 현재 치수 항목 부분 누락"]);
  ok(h.ev("state.armH") === null && /^저장 1건 \(치수별\) · 읽을 수 없는 항목 2건/.test(h.count()), "4: 깨진 항목 제외·정상 항목 집계 [" + h.count() + "]");
  // 다른 치수의 깨진 항목은 현재 치수 저장을 막지 않고, 재직렬화 후에도 내용이 보존된다
  const o = boot({ armhole_data: JSON.stringify([other]), armhole_data_kv: JSON.stringify({ "90-70-40": other, "70-60-36": half }) });
  o.ev("state.armH = " + JSON.stringify(Object.assign({}, good.handles, good.anchors)));
  ok(o.sb.autoSaveCurveData() === true, "4: 다른 치수의 깨진 항목은 현재 치수 저장을 막지 않음");
  ok(JSON.stringify(JSON.parse(o.store.armhole_data_kv)["70-60-36"]) === JSON.stringify(half), "4: 그 깨진 항목 내용 보존");
}

// ── §5 저장 실패(용량·접근 예외): 성공인 척 금지 · 반쪽 저장 금지 ──
{
  const prev = entry(83, 64, 38, 1);
  const pre = { armhole_data: JSON.stringify([prev]), armhole_data_kv: kvOf(prev) };
  // (a) 첫 키에서 용량 초과
  let s = boot(pre); s.ev("state.armH.h0.x = 55"); s.fail.set.armhole_data = "QuotaExceededError";
  let r = s.sb.saveCurveData(), msg = s.log.alerts.join("|");
  ok(r === false && /저장하지 못했습니다/.test(msg) && /가득/.test(msg) && !/저장 완료/.test(msg), "5a: 용량 초과 = 실패 알림");
  ok(snap(s) === JSON.stringify(pre), "5a: 저장소 불변");
  ok(/⚠ 저장 실패/.test(s.count()), "5a: 건수 줄에 실패 표시");
  // (b) 둘째 키에서 실패 → 첫 키 원복
  s = boot(pre); s.ev("state.armH.h0.x = 55"); s.fail.set.armhole_data_kv = "QuotaExceededError";
  r = s.sb.saveCurveData();
  ok(r === false && snap(s) === JSON.stringify(pre), "5b: 둘째 키 실패 → 첫 키 원문 복귀(반쪽 저장 없음)");
  // (b2) 빈 저장소에서 둘째 키 실패 → 첫 키 제거
  s = boot({}); s.ev("state.armH = " + JSON.stringify(Object.assign({}, prev.handles, prev.anchors))); s.fail.set.armhole_data_kv = "QuotaExceededError";
  ok(s.sb.autoSaveCurveData() === false && Object.keys(s.store).length === 0, "5b: 빈 저장소 = 0키 복귀");
  // (c) 자동 저장 실패: 같은 사유는 한 번만 알림, 성공하면 표시 해제
  s = boot(pre); s.fail.set.armhole_data = "QuotaExceededError";
  ok(s.sb.autoSaveCurveData() === false && s.sb.autoSaveCurveData() === false && s.log.alerts.length === 1 && /자동 저장하지 못했습니다/.test(s.log.alerts[0]), "5c: 자동 저장 실패 알림 1회");
  s.fail.set = {};
  ok(s.sb.autoSaveCurveData() === true && s.count() === "저장 1건 (치수별)", "5c: 이후 성공 → 실패 표시 해제");
  // (d) 저장소 접근 자체가 예외(SecurityError): 로드·기본 시작 가능, 저장은 실패로 보고
  s = boot({}); s.fail.get = "SecurityError";
  ok(s.sb.getSavedCurveEntries().length === 0 && /접근할 수 없습니다/.test(s.sb.updateSaveCount()), "5d: 접근 예외 = 0건 + 이유");
  s.ev("state.armH = " + JSON.stringify(Object.assign({}, prev.handles, prev.anchors)));
  ok(s.sb.saveCurveData() === false && /접근할 수 없습니다/.test(s.log.alerts.join("|")) && !/저장 완료/.test(s.log.alerts.join("|")), "5d: 접근 예외 저장 = 실패 알림");
  // (e) state 에 비정상 수치 → 저장 거부(깨진 항목을 만들지 않음)
  s = boot(pre); s.ev("state.armH.h0.x = NaN");
  ok(s.sb.autoSaveCurveData() === false && snap(s) === JSON.stringify(pre), "5e: NaN 곡선은 저장하지 않음(기존 저장값 보존)");
  // (f) 가져오기 중 둘째 키 실패 → 전후 동일
  s = boot(pre); s.fail.set.armhole_data_kv = "QuotaExceededError";
  let threw = false; try { s.sb.importCurveEntries([entry(90, 70, 40, 3)]); } catch (e) { threw = /가득/.test(e.message); }
  ok(threw && snap(s) === JSON.stringify(pre), "5f: 가져오기 쓰기 실패 → 저장소 불변");
}

// ── §6 markDirty: 몸판 치수만 몸판 곡선 리셋 · 소매 입력은 불변 · 다음 저장에서도 보존 ──
{
  const e = entry(83, 64, 38, 1);
  const pre = { armhole_data: JSON.stringify([e]), armhole_data_kv: kvOf(e) };
  for (const id of ["inpSL", "inpHem"]) {
    const s = boot(pre);
    s.ev("state.armH.h0.x = 42.5; state.fNeckH.h1.y = 3.25");        // 사용자가 편집한 몸판 곡선
    const h0 = s.body();
    s.els[id].value = id === "inpSL" ? "53" : "31";
    s.ev("markDirty({ target: { id: '" + id + "' } })");
    ok(s.body() === h0, "6: " + id + " 변경 후 몸판 곡선 동일");
    ok(s.ev("isMeasureDirty") === true, "6: " + id + " 변경 = 치수 변경됨 표시는 유지");
    ok(s.sb.autoSaveCurveData() === true, "6: " + id + " 변경 뒤 저장 성공");
    const saved = JSON.parse(s.store.armhole_data_kv)["83-64-38"];
    ok(saved.handles.h0.x === 42.5 && saved.fNeckline.h1.y === 3.25, "6: " + id + " 변경 뒤 저장값에 편집 곡선 보존");
    const again = boot(s.store, id === "inpSL" ? { inpSL: 53 } : { inpHem: 31 });
    ok(again.body() === h0, "6: " + id + " — 재로드 복원 곡선 동일");
  }
  for (const id of ["inpB", "inpW", "inpBL"]) {
    const s = boot(pre);
    s.ev("markDirty({ target: { id: '" + id + "' } })");
    ok(s.body() === "[null,null,null,null]", "6: " + id + " 변경 = 몸판 곡선 리셋(기존 의미)");
    ok(s.ev("state.sleeveH") !== null, "6: " + id + " 변경은 소매 핸들을 여기서 지우지 않음(render 담당)");
    ok(snap(s) === JSON.stringify(pre), "6: " + id + " 변경만으로 저장소 불변");
  }
}

// ── §7 정상 저장 roundtrip + 권위 백업 파일(읽기 전용, 있을 때만) ──
{
  const s = boot({});
  const e = entry(83, 64, 38, 1);
  s.ev("state.armH = " + JSON.stringify(Object.assign({}, e.handles, e.anchors)) + "; state.fArmH = " + JSON.stringify(e.fArmhole)
     + "; state.bNeckH = " + JSON.stringify(e.bNeckline) + "; state.fNeckH = " + JSON.stringify(e.fNeckline)
     + "; state.sleeveH = " + JSON.stringify(e.sleevePattern));
  const st0 = s.all();
  ok(s.sb.saveCurveData() === true && /저장 완료/.test(s.log.alerts.join("|")) && s.count() === "저장 1건 (치수별)", "7: 수동 저장 성공");
  ok(s.sb.autoSaveCurveData() === true && JSON.parse(s.store.armhole_data).length === 2, "7: 자동 저장 = 이력에 1건 추가");
  ok(s.sb.autoSaveCurveData() === true && JSON.parse(s.store.armhole_data).length === 2, "7: 같은 치수 자동 저장은 교체(이력 불어나지 않음)");
  const again = boot(s.store);
  ok(again.loadError === null && again.all() === st0 && again.count() === "저장 1건 (치수별)", "7: 재로드 = 같은 곡선·같은 건수");

  if (fs.existsSync(BACKUP)) {
    const text = fs.readFileSync(BACKUP, "utf8"), data = JSON.parse(text);
    const b = boot({});
    const badIdx = data.map((x, i) => (b.sb.validateCurveEntry(x).ok ? -1 : i)).filter(i => i >= 0);
    ok(badIdx.length === 0, "7: 권위 백업 전 항목 검증 통과(불량 " + badIdx.join(",") + ")");
    const r = b.sb.importCurveEntries(JSON.parse(text));
    ok(r.imported + r.duplicates === data.length && r.total === r.imported, "7: 권위 백업 가져오기(mock) 전부 수용");
    ok(JSON.stringify(JSON.parse(b.store.armhole_data)) === JSON.stringify(data.filter((x, i) => data.findIndex(y => JSON.stringify(y) === JSON.stringify(x)) === i)), "7: 이력 = 파일 내용 그대로(중복만 제외)");
    ok(fs.readFileSync(BACKUP, "utf8") === text, "7: 백업 파일 무변경");
  } else {
    console.log("  (SKIP §7 권위 백업: " + path.basename(BACKUP) + " 없음)");
  }
}

console.log("curveStoreSafetyCheck: " + PASS + " PASS, " + FAIL + " FAIL");
if (FAIL) { for (const f of fails) console.log("  FAIL: " + f); process.exit(1); }
