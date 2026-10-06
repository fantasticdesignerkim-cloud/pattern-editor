// ═════════════════════════════════════════════
// tempDefaultCurveCheck.js — js/tempDefaultCurve.js (TEMP B83/W64/BL38 몸판 곡선 기본값) 회귀.
// 실제 storage.js + tempDefaultCurve.js 를 vm 으로 실행한다(가짜 localStorage — 실제 저장소 무접촉).
//   node test/harness/tempDefaultCurveCheck.js
// 동등성 섹션(§5)은 사용자 제공 JSON 이 있을 때만 돈다(없으면 SKIP 을 출력한다).
// ═════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");

const JS = f => fs.readFileSync(path.join(__dirname, "..", "..", "js", f), "utf8");
const STORAGE = JS("storage.js"), TEMP = JS("tempDefaultCurve.js");
const USER_JSON = "/Users/gimgeonhyeong/Downloads/armhole_data_2026-07-16 (1).json";

let PASS = 0, FAIL = 0; const fails = [];
function ok(c, name) { if (c) PASS++; else { FAIL++; fails.push(name); } }
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// 새 세션: inputs 와 (선택) 미리 채운 localStorage 로 storage.js → tempDefaultCurve.js 순서 로드.
function boot(inputs, pre = {}, { withTemp = true } = {}) {
  const store = Object.assign({}, pre);
  const sb = {
    console, JSON, Math, Object, Array, Set, Error, Date,
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; },
      get length() { return Object.keys(store).length; }
    },
    document: { getElementById: id => (id === "selCapFormula" && inputs.cap ? { value: inputs.cap } : null),
                createElement: () => ({}), body: {} },
    state: { armH: null, fArmH: null, bNeckH: null, fNeckH: null, sleeveH: null,
             armEditMode: false, neckEditMode: false, sleeveEditMode: false },
    alert() {}, render() {}, FileReader: function () {},
    n: id => +inputs[id] || 0
  };
  vm.createContext(sb);
  vm.runInContext(STORAGE, sb, { filename: "storage.js" });
  if (withTemp) vm.runInContext(TEMP, sb, { filename: "tempDefaultCurve.js" });
  return { sb, store, inputs };
}
const curve = sb => JSON.parse(JSON.stringify({
  armH: sb.state.armH, fArmH: sb.state.fArmH, bNeckH: sb.state.bNeckH, fNeckH: sb.state.fNeckH }));
const M = (B, W, BL) => ({ inpB: B, inpW: W, inpBL: BL });
const MS = (B, W, BL, SL = 52, Hem = 30, cap) => Object.assign(M(B, W, BL), { inpSL: SL, inpHem: Hem }, cap ? { cap } : {});
// render 가 sleeve.js 에서 하는 호출을 그대로 흉내: sleeveH 가 비면 앵커 수로 복원 시도.
const sleeveInit = sb => { if (!sb.state.sleeveH) sb.restoreSavedSleevePatternForAnchorCount(9); return sb.state.sleeveH; };
const resetAll = sb => { sb.state.armH = sb.state.fArmH = sb.state.bNeckH = sb.state.fNeckH = sb.state.sleeveH = null; };

// §1 처음 방문(storage 0) + 83/64/38 → TEMP 적용, localStorage 0키 유지
{
  const { sb, store } = boot(M(83, 64, 38));
  const c = curve(sb);
  ok(c.armH && c.armH.a1 && c.armH.h4 && c.fArmH && c.bNeckH && c.fNeckH, "1: 4개 곡선 모두 채워짐");
  ok(c.armH.a1.x === 19.585 && c.armH.h0.y === 8.4, "1: index24 값(a1.x·h0.y)");
  ok(sb.state.sleeveH === null, "1: 소매 곡선은 건드리지 않음");
  ok(Object.keys(store).length === 0, "1: localStorage 에 아무것도 쓰지 않음(seed 없음)");
  ok(sb.getSavedCurveEntries().length === 0, "1: 저장 0건 그대로");
}
// §2 다른 치수 → 영향 없음(state null 유지 = 기존 initHandles 공식 기본값 경로)
for (const [B, W, BL] of [[85.5, 64, 38], [83, 66, 38], [83, 64, 40], [84, 64, 38]]) {
  const { sb, store } = boot(M(B, W, BL));
  ok(sb.state.armH === null && sb.state.fArmH === null && sb.state.bNeckH === null && sb.state.fNeckH === null,
     `2: ${B}/${W}/${BL} 미적용`);
  ok(Object.keys(store).length === 0, `2: ${B}/${W}/${BL} storage 0키`);
}
// §3 SL/Hem 은 조건이 아니다(입력에 SL=30 같은 값이 있어도 적용)
{
  const { sb } = boot(Object.assign(M(83, 64, 38), { inpSL: 30, inpHem: 99 }));
  ok(sb.state.armH && sb.state.armH.a1.x === 19.585, "3: SL/Hem 무관 적용");
}
// §4 우선순위: 저장값/가져온 값이 TEMP 보다 우선
{
  const userEntry = { timestamp: "t", measurements: { B: 83, W: 64, BL: 38 },
    anchors: { a1: { x: 1, y: 1 }, a2: { x: 2, y: 2 }, a3: { x: 3, y: 3 } },
    handles: { h0: { x: 9, y: 9 }, h1a: { x: 9, y: 9 }, h1b: { x: 9, y: 9 }, h2a: { x: 9, y: 9 },
               h2b: { x: 9, y: 9 }, h3a: { x: 9, y: 9 }, h3b: { x: 9, y: 9 }, h4: { x: 9, y: 9 } },
    fArmhole: { hGa: { x: 7, y: 7 } }, bNeckline: { h0: { x: 7, y: 7 } }, fNeckline: { h0: { x: 7, y: 7 } } };
  // (a) 부팅 시점에 이미 저장값이 있음(kv)
  const kv = JSON.stringify({ "83-64-38": userEntry });
  const a = boot(M(83, 64, 38), { armhole_data_kv: kv, armhole_data: JSON.stringify([userEntry]) });
  ok(a.sb.state.armH.a1.x === 1 && a.sb.state.fArmH.hGa.x === 7, "4a: 부팅 시 저장값 우선");
  // (b) 세션 중 JSON 가져오기 → loadSaved 가 저장값 적용
  const b = boot(M(83, 64, 38));
  ok(b.sb.state.armH.a1.x === 19.585, "4b: 가져오기 전 TEMP");
  b.sb.importCurveEntries([userEntry]);
  b.sb.state.armH = null;                            // render 의 resetCurveHandles 와 동일
  b.sb.loadSavedCurveForCurrentMeasurements(false);
  ok(b.sb.state.armH.a1.x === 1, "4b: 가져온 값이 TEMP 를 이김");
  // (c) 다른 치수 → 83/64/38 복귀 시 저장값 없으면 TEMP 재적용, 있으면 저장값
  const c = boot(M(85.5, 64, 38));
  ok(c.sb.state.armH === null, "4c: 다른 치수 미적용");
  c.inputs.inpB = 83; c.sb.state.armH = c.sb.state.fArmH = c.sb.state.bNeckH = c.sb.state.fNeckH = null;
  c.sb.loadSavedCurveForCurrentMeasurements(false);
  ok(c.sb.state.armH && c.sb.state.armH.a1.x === 19.585, "4c: 치수 전환(83) 시 TEMP 적용");
  c.inputs.inpB = 85.5; c.sb.state.armH = c.sb.state.fArmH = c.sb.state.bNeckH = c.sb.state.fNeckH = null;
  c.sb.loadSavedCurveForCurrentMeasurements(false);
  ok(c.sb.state.armH === null, "4c: 다시 85.5 → 미적용");
  // (d) 편집 모드 중에는 덮지 않음
  const d = boot(M(85.5, 64, 38));
  d.inputs.inpB = 83; d.sb.state.armEditMode = true;
  d.sb.loadSavedCurveForCurrentMeasurements(false);
  ok(d.sb.state.armH === null, "4d: 편집 중 미적용");
  // (e) 명시 호출(알림 경로)은 기존 계약 유지: 저장 없음 → false
  const e = boot(M(83, 64, 38));
  ok(e.sb.loadSavedCurveForCurrentMeasurements(true) === false, "4e: showAlert 경로 반환값 불변(저장 데이터 아님)");
  // (f) 상수 오염 방지: 적용 후 state 를 편집해도 다음 적용값은 원본
  const f = boot(M(83, 64, 38));
  f.sb.state.armH.a1.x = 999; f.sb.state.fArmH.hGa.x = 999;
  f.sb.state.armH = f.sb.state.fArmH = f.sb.state.bNeckH = f.sb.state.fNeckH = null;
  f.sb.loadSavedCurveForCurrentMeasurements(false);
  ok(f.sb.state.armH.a1.x === 19.585 && f.sb.state.fArmH.hGa.x === 28.331, "4f: 편집이 상수를 오염시키지 않음");
  ok(Object.keys(f.store).length === 0, "4f: 저장 0키 유지");
}
// §5 동등성: 사용자 JSON 을 실제 import 했을 때 선택되는 기록(index 24) == TEMP 결과
if (fs.existsSync(USER_JSON)) {
  const raw = fs.readFileSync(USER_JSON, "utf8");          // 읽기 전용
  const list = JSON.parse(raw);
  const imp = boot(M(83, 64, 38), {}, { withTemp: false });
  const r = imp.sb.importCurveEntries(JSON.parse(raw));
  ok(r.imported === list.length, "5: 25건 import");
  imp.sb.loadSavedCurveForCurrentMeasurements(false);
  const imported = curve(imp.sb);
  const sel = imp.sb.findLastSavedForCurrentMeasurements();
  ok(same(sel, list[24]), "5: import 후 선택 기록 = index 24");
  const tmp = boot(MS(83, 64, 38));
  ok(same(curve(tmp.sb), imported), "5: TEMP 기본 곡선 데이터 == import 결과(armH·fArmH·bNeckH·fNeckH)");
  const impSleeve = JSON.parse(JSON.stringify(imp.sb.state.sleeveH));
  ok(same(impSleeve, list[24].sleevePattern), "5: import 후 sleeveH = index 24 sleevePattern");
  ok(same(JSON.parse(JSON.stringify(sleeveInit(tmp.sb))), impSleeve), "5: TEMP 소매 == import 소매(anchorCount·segments·anchorOffsets)");
  ok(list[24].capFormula === "culture" && +list[24].measurements.SL === 52 && +list[24].measurements.Hem === 30, "5: index 24 = SL52/Hem30/culture");
  // 멱등: 같은 파일 재 import → 변화 없음
  const r2 = imp.sb.importCurveEntries(JSON.parse(raw));
  ok(r2.imported === 0 && r2.duplicates === list.length, "5: import 멱등(재가져오기 0건)");
  ok(JSON.parse(imp.store.armhole_data).length === list.length, "5: 이력 25건 유지");
  // 이력 24건을 복제하지 않았는지: 코드 안에 timestamp·measurements 항목이 index 24 한 건분(상수 1개)뿐
  const code = TEMP.replace(/\/\/.*$/gm, "");
  ok(!/timestamp/.test(code) && (code.match(/measurements:/g) || []).length === 1, "5: 이력 비복제(measurements 1건)");
} else {
  console.log("SKIP §5 동등성: 사용자 JSON 없음 (" + USER_JSON + ")");
}

// §6 소매 TEMP(짝 세트): 조건·우선순위·깊은복사·storage 0키
{
  // (a) 정확 조건(83/64/38+SL52+Hem30+culture) → 적용, 0키
  const a = boot(MS(83, 64, 38));
  const sh = sleeveInit(a.sb);
  ok(sh && sh.anchorCount === 9 && sh.segments.length === 8 && sh.anchorOffsets.length === 9, "6a: 소매 TEMP 적용(9/8/9)");
  ok(sh.segments[0].c1.x === 6.819 && sh.anchorOffsets[1].dy === 0.178, "6a: index24 소매 값");
  ok(Object.keys(a.store).length === 0, "6a: storage 0키");
  // (b) 조건 불일치 → 소매 공식 그대로(sleeveH null 유지)
  const cases = [["SL50", MS(83, 64, 38, 50, 30)], ["SL52.5", MS(83, 64, 38, 52.5, 30)], ["Hem28", MS(83, 64, 38, 52, 28)],
                 ["recommend공식", MS(83, 64, 38, 52, 30, "recommend")], ["B85.5", MS(85.5, 64, 38)], ["W66", MS(83, 66, 38)], ["BL40", MS(83, 64, 40)]];
  for (const [nm, inp] of cases) {
    const b = boot(inp);
    ok(sleeveInit(b.sb) === null, `6b: ${nm} → 소매 TEMP 미적용`);
    ok(Object.keys(b.store).length === 0, `6b: ${nm} storage 0키`);
  }
  // (c) 앵커 수 불일치 호출 → 미적용
  const c = boot(MS(83, 64, 38));
  ok(c.sb.restoreSavedSleevePatternForAnchorCount(7) === false && c.sb.state.sleeveH === null, "6c: anchorCount≠9 미적용");
  // (d) 몸판 TEMP 는 SL/Hem 무관 유지(SL50 에서도 몸판은 적용, 소매는 아님)
  const d = boot(MS(83, 64, 38, 50, 30));
  ok(d.sb.state.armH && d.sb.state.armH.a1.x === 19.585 && sleeveInit(d.sb) === null, "6d: SL50 = 몸판 TEMP 만");
  // (e) 사용자 저장 소매(import) 우선
  const userSleeve = { anchorCount: 9, segments: Array.from({ length: 8 }, () => ({ c1: { x: 1, y: 1 }, c2: { x: 2, y: 2 } })),
                       anchorOffsets: Array.from({ length: 9 }, () => ({ dx: 0, dy: 0 })) };
  const userEntry = { timestamp: "u", measurements: { B: 83, W: 64, BL: 38, SL: 52, Hem: 30 }, capFormula: "culture",
    anchors: { a1: { x: 1, y: 1 }, a2: { x: 2, y: 2 }, a3: { x: 3, y: 3 } },
    handles: { h0: { x: 9, y: 9 }, h1a: { x: 9, y: 9 }, h1b: { x: 9, y: 9 }, h2a: { x: 9, y: 9 }, h2b: { x: 9, y: 9 },
               h3a: { x: 9, y: 9 }, h3b: { x: 9, y: 9 }, h4: { x: 9, y: 9 } },
    fArmhole: { hGa: { x: 7, y: 7 } }, bNeckline: { h0: { x: 7, y: 7 } }, fNeckline: { h0: { x: 7, y: 7 } }, sleevePattern: userSleeve };
  const e1 = boot(MS(83, 64, 38), { armhole_data_kv: JSON.stringify({ "83-64-38": userEntry }), armhole_data: JSON.stringify([userEntry]) });
  e1.sb.state.sleeveH = null;
  e1.sb.restoreSavedSleevePatternForAnchorCount(9);
  ok(e1.sb.state.sleeveH.segments[0].c1.x === 1, "6e: 부팅 시 저장 소매 우선");
  const e2 = boot(MS(83, 64, 38));
  ok(sleeveInit(e2.sb).segments[0].c1.x === 6.819, "6e: import 전 TEMP");
  e2.sb.importCurveEntries([userEntry]); resetAll(e2.sb);
  e2.sb.loadSavedCurveForCurrentMeasurements(false);
  ok(e2.sb.state.sleeveH.segments[0].c1.x === 1, "6e: import 소매가 TEMP 를 이김");
  // (f) 저장 몸판 항목은 있으나 소매 없음 → TEMP 소매를 섞지 않는다(몸판+소매 한 세트 원칙)
  const bodyOnly = Object.assign({}, userEntry); delete bodyOnly.sleevePattern; delete bodyOnly.capFormula;
  const f = boot(MS(83, 64, 38), { armhole_data_kv: JSON.stringify({ "83-64-38": bodyOnly }), armhole_data: JSON.stringify([bodyOnly]) });
  f.sb.state.sleeveH = null;
  ok(sleeveInit(f.sb) === null, "6f: 사용자 몸판 저장 + 소매 없음 → TEMP 소매 미적용(공식)");
  ok(f.sb.state.armH.a1.x === 1, "6f: 사용자 몸판 유지");
  // (g) 치수 전환 resetCurveHandles 후 복귀(render.js 경로: restoreSavedSleevePatternForCurrentSleeve)
  const g = boot(MS(85.5, 64, 38));
  g.inputs.inpB = 83; resetAll(g.sb);
  g.sb.loadSavedCurveForCurrentMeasurements(false);
  g.sb.restoreSavedSleevePatternForCurrentSleeve(false);
  ok(g.sb.state.sleeveH && g.sb.state.sleeveH.segments[0].c1.x === 6.819, "6g: 치수 전환 복귀 시 소매 TEMP");
  g.inputs.inpSL = 50; g.sb.state.sleeveH = null;
  ok(g.sb.restoreSavedSleevePatternForCurrentSleeve(false) === false && g.sb.state.sleeveH === null, "6g: SL 변경 시 공식으로");
  g.inputs.inpSL = 52;
  ok(g.sb.restoreSavedSleevePatternForCurrentSleeve(true) === false, "6g: 명시 호출(showAlert) 경로 반환 불변");
  // (h) 깊은복사: 편집이 상수를 오염시키지 않는다
  const h = boot(MS(83, 64, 38));
  sleeveInit(h.sb).segments[0].c1.x = 999; h.sb.state.sleeveH.anchorOffsets[1].dx = 999;
  h.sb.state.sleeveH = null;
  const again = sleeveInit(h.sb);
  ok(again.segments[0].c1.x === 6.819 && again.anchorOffsets[1].dx === 0.1017, "6h: 소매 상수 비오염");
  ok(Object.keys(h.store).length === 0, "6h: storage 0키");
}

console.log(`tempDefaultCurveCheck: ${PASS} PASS, ${FAIL} FAIL`);
if (FAIL) { fails.forEach(f => console.log("  FAIL:", f)); process.exit(1); }
