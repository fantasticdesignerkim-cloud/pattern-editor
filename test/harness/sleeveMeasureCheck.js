// ══════════════════════════════════════════════
// sleeveMeasureCheck.js — js/sleeveMeasure.js 순수 측정 회귀.
// 소매산 봉제선(cap 곡선)을 apex(SP)에서 앞(높은 x)/뒤(낮은 x)로 나눠 호길이를 재는지,
// 실패 계약(cap 없음·apex 끝점 퇴화)과 결과 불변(frozen)을 고정한다.
//   node test/harness/sleeveMeasureCheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "..", "js", "sleeveMeasure.js"), "utf8");
let PASS = 0, FAIL = 0; const fails = [];
function ok(cond, name) { if (cond) PASS++; else { FAIL++; fails.push(name); } }
const near = (a, b, e = 0.05) => Math.abs(a - b) < e;

const sandbox = { window: {}, Math, Object };
vm.createContext(sandbox);
vm.runInContext(SRC, sandbox, { filename: "sleeveMeasure.js" });
const M = sandbox.window.sleeveMeasure;
ok(typeof M.measureSleeveCap === "function" && Object.isFrozen(M), "0: API·frozen");

const cubic = (a, c1, c2, b) => ({ kind: "cubic", from: { x: a[0], y: a[1] }, c1: { x: c1[0], y: c1[1] }, c2: { x: c2[0], y: c2[1] }, to: { x: b[0], y: b[1] } });
const line = (a, b) => ({ kind: "line", from: { x: a[0], y: a[1] }, to: { x: b[0], y: b[1] } });
const pathOf = (mpt, cs) => ({ kind: "path", commands: [{ type: "M", points: [{ x: mpt[0], y: mpt[1] }] }].concat(cs.map(c => ({ type: "C", points: [{ x: c[0][0], y: c[0][1] }, { x: c[1][0], y: c[1][1] }, { x: c[2][0], y: c[2][1] }] }))) });

// 1. 대칭 cap(2 cubic): 뒤(0,10)→apex(20,0)→앞(40,10). front≈back.
{
  const geom = { outline: [
    cubic([0, 10], [7, 4], [14, 0], [20, 0]),      // back arc (낮은 x → apex)
    cubic([20, 0], [26, 0], [33, 4], [40, 10]),    // front arc (apex → 높은 x)
    line([0, 10], [2, 40]), line([40, 10], [38, 40]), line([2, 40], [38, 40])
  ] };
  const r = M.measureSleeveCap(geom);
  ok(r && Object.isFrozen(r), "1: 결과 frozen");
  ok(near(r.frontLength, r.backLength, 0.2), "1: 대칭 → 앞≈뒤");
  ok(near(r.totalLength, r.frontLength + r.backLength), "1: total = 앞+뒤");
  ok(r.backLength > 20 && r.backLength < 24, "1: 뒤 호길이(현 20.6 < arc)");   // 직선 20.6, 곡선 그 이상
}
// 2. 비대칭 cap: apex(10,0), 뒤(0,10) 짧고 앞(40,10) 긺 → frontLength > backLength.
{
  const geom = { outline: [
    cubic([0, 10], [4, 4], [7, 0], [10, 0]),        // 짧은 뒤(낮은 x)
    cubic([10, 0], [20, 0], [30, 4], [40, 10]),     // 긴 앞(높은 x)
    line([0, 10], [0, 40]), line([40, 10], [40, 40]), line([0, 40], [40, 40])
  ] };
  const r = M.measureSleeveCap(geom);
  ok(r && r.frontLength > r.backLength, "2: 앞(높은 x) 길이 > 뒤(낮은 x)");
  ok(r.backLength > 12 && r.frontLength > 30, "2: 각 호길이 직선하한 이상");
}
// 3. 방향 무관(cap path 를 앞→뒤 순서로 줘도 앞=높은 x 로 배정)
{
  const geom = { outline: [
    cubic([40, 10], [33, 4], [26, 0], [20, 0]),     // 높은 x 시작
    cubic([20, 0], [14, 0], [7, 4], [0, 10]),
    line([0, 10], [0, 40]), line([40, 10], [40, 40]), line([0, 40], [40, 40])
  ] };
  const r = M.measureSleeveCap(geom);
  ok(r && near(r.frontLength, r.backLength, 0.2), "3: 역순 입력도 대칭 유지(끝점 x 로 앞/뒤 배정)");
}
// 4. single path(M+C 여러 개) — 실제 geometry 포맷
{
  const geom = { outline: [
    pathOf([0, 10], [[[7, 4], [14, 0], [20, 0]], [[26, 0], [33, 4], [40, 10]]]),
    line([0, 10], [0, 40]), line([40, 10], [40, 40]), line([0, 40], [40, 40])
  ] };
  const r = M.measureSleeveCap(geom);
  ok(r && near(r.frontLength, r.backLength, 0.2) && r.totalLength > 40, "4: single path cap 측정");
}
// 5. 실패 계약
{
  ok(M.measureSleeveCap(null) === null, "5: null 입력 → null");
  ok(M.measureSleeveCap({ outline: [line([0, 0], [10, 0]), line([10, 0], [10, 10])] }) === null, "5: 곡선 없음(직선만) → null");
  // apex 가 끝점(단조 곡선) → 퇴화 null
  ok(M.measureSleeveCap({ outline: [cubic([0, 0], [3, 3], [7, 7], [10, 10])] }) === null, "5: apex=끝점(단조) → null");
}
// 6. 입력 불변
{
  const geom = { outline: [cubic([0, 10], [7, 4], [14, 0], [20, 0]), cubic([20, 0], [26, 0], [33, 4], [40, 10])] };
  const snap = JSON.stringify(geom);
  M.measureSleeveCap(geom);
  ok(JSON.stringify(geom) === snap, "6: 입력 geometry 불변");
}

console.log("══════════════════════════════════════════════");
if (FAIL) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); }
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
