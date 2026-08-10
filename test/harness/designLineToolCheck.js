// ══════════════════════════════════════════════
// designLineToolCheck.js — js/designLineTool.js 의 순수 로직 회귀 테스트.
// 핵심 계약: (1) 클릭 도안 cm → 피스 offset 역변환해 형상 cm 로 저장, (2) 왕복 정합
// (형상 cm + offset = 원래 도안 cm → 렌더가 클릭 위치에 정확히 그림), (3) piece 소유권
// 기록. 클릭 이벤트·DOM 흐름은 브라우저 검증 몫. 실제 소스를 vm 으로 실행한다.
//
//   node test/harness/designLineToolCheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "..", "js", "designLineTool.js"), "utf8");

let PASS = 0, FAIL = 0; const fails = [];
function ok(cond, name) { if (cond) PASS++; else { FAIL++; fails.push(name); } }
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

// svg 미정의(pointerdown/keydown 리스너 skip) — window 만 최소 제공.
function load() {
  const sandbox = { window: {}, document: {}, console: { log() {}, warn() {} }, Math, JSON, Object, Array };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox, { filename: "designLineTool.js" });
  return sandbox.window.designLineTool;
}
const T = load();

// 0. API
ok(typeof T.pointToGeometryCm === "function" && typeof T.geometryToDrawCm === "function" && typeof T.makeLine === "function" && typeof T.toggle === "function" && Object.isFrozen(T), "0: API·frozen");

// 1. offset 역변환: 형상 cm = 도안 cm − offset
{
  const off = { dx: 57.5, dy: -0.965 };
  const geo = T.pointToGeometryCm(60, 12, off);
  ok(near(geo.x, 60 - 57.5) && near(geo.y, 12 - (-0.965)), "1: pointToGeometryCm = draw − offset");
}
// 2. 왕복 정합: geometryToDrawCm(pointToGeometryCm(draw, off), off) === draw
{
  const off = { dx: 85.02, dy: -62.14 };
  const draw = { x: 90.5, y: 3.2 };
  const geo = T.pointToGeometryCm(draw.x, draw.y, off);
  const back = T.geometryToDrawCm(geo, off);
  ok(near(back.x, draw.x) && near(back.y, draw.y), "2: 왕복 정합(형상+offset=도안)");
}
// 3. 피스별 offset 이 다르면 같은 클릭도 다른 형상 cm 로 저장(피스 상대 저장)
{
  const clickDraw = { x: 40, y: 20 };
  const front = T.pointToGeometryCm(clickDraw.x, clickDraw.y, { dx: 0, dy: 0 });
  const back = T.pointToGeometryCm(clickDraw.x, clickDraw.y, { dx: 57.5, dy: 0 });
  ok(near(front.x, 40) && near(back.x, 40 - 57.5), "3: 같은 클릭도 피스 offset 따라 다른 형상 cm");
  // 그러나 화면 표시 위치는 동일(각자 offset 더하면 같은 도안 cm)
  ok(near(T.geometryToDrawCm(front, { dx: 0, dy: 0 }).x, T.geometryToDrawCm(back, { dx: 57.5, dy: 0 }).x), "3: 표시 위치는 동일(클릭 지점)");
}
// 4. makeLine: piece 소유권 기록 + from/to 복사(입력 참조 아님)
{
  const from = { x: 1, y: 2 }, to = { x: 3, y: 4 };
  const ln = T.makeLine(from, to, "front");
  ok(ln.kind === "line" && ln.piece === "front" && near(ln.from.x, 1) && near(ln.to.y, 4), "4: makeLine 소유권+좌표");
  from.x = 999;
  ok(near(ln.from.x, 1), "4: from 복사(입력 참조 아님)");
}
// 5. 순수 함수 입력 비변형
{
  const off = { dx: 5, dy: 6 }, os = JSON.stringify(off);
  T.pointToGeometryCm(1, 2, off);
  const g = { x: 1, y: 2 }, gs = JSON.stringify(g);
  T.geometryToDrawCm(g, off);
  ok(JSON.stringify(off) === os && JSON.stringify(g) === gs, "5: 입력 비변형");
}

console.log("══════════════════════════════════════════════");
if (FAIL) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); }
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
if (FAIL) process.exitCode = 1;
