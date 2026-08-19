// ══════════════════════════════════════════════
// designPlacketCheck.js — js/designPlacket.js 순수 파생 회귀.
// CF(앞판 max x) 앞단에서 여밈분+안단폭 만큼 바깥으로 확장하는 스트립을, working.geometry
// 포맷({kind:"line"|"path"})·designOutline 포맷({kind:"line"|"cubic"}) 양쪽 유효 외곽에서
// 동일하게 파생하는지, 실패 계약과 입력 불변을 고정한다.
//   node test/harness/designPlacketCheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "..", "js", "designPlacket.js"), "utf8");
let PASS = 0, FAIL = 0; const fails = [];
function ok(cond, name) { if (cond) PASS++; else { FAIL++; fails.push(name); } }
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;

const sandbox = { window: {}, Math, JSON, Object, Array, isFinite };
vm.createContext(sandbox);
vm.runInContext(SRC, sandbox, { filename: "designPlacket.js" });
const P = sandbox.window.designPlacket;

ok(typeof P.compute === "function" && Object.isFrozen(P), "0: API·frozen");

const line = (a, b) => ({ kind: "line", from: { x: a[0], y: a[1] }, to: { x: b[0], y: b[1] } });
// working.geometry 포맷 앞판 외곽(간이): CF(center, x=47.5 세로) + 목선 path + 어깨 + 옆선.
// CF 는 max x. T=neck-CF(47.5, 5) · B=hem-CF(47.5, 40).
function geomOutline() {
  return [
    line([47.5, 5], [47.5, 40]),                          // center(CF) — max x 세로
    line([47.5, 40], [23, 40]),                           // hem
    line([23, 40], [23, 18]),                             // side-seam
    { kind: "path", commands: [{ type: "M", points: [{ x: 23, y: 18 }] }, { type: "C", points: [{ x: 30, y: 8 }, { x: 38, y: 6 }, { x: 42, y: 5 }] }] }, // armhole/shoulder
    line([42, 5], [47.5, 5])                              // 목선(→CF)
  ];
}
// designOutline 포맷(cubic/line, edge 없음) — 같은 CF/T/B.
function designOutlineFmt() {
  return [
    line([47.5, 5], [47.5, 40]),
    line([47.5, 40], [23, 40]),
    { kind: "cubic", from: { x: 23, y: 40 }, c1: { x: 23, y: 30 }, c2: { x: 23, y: 24 }, to: { x: 23, y: 18 } },
    { kind: "cubic", from: { x: 23, y: 18 }, c1: { x: 30, y: 8 }, c2: { x: 38, y: 6 }, to: { x: 42, y: 5 } },
    line([42, 5], [47.5, 5])
  ];
}

// 1. 기본 파생(overlap 1.75 · facing 4): cfX·foldX·cutX·T/B, outline 4세그(폐곡선)·construction 2.
{
  const r = P.compute(geomOutline(), { overlapCm: 1.75, facingWidthCm: 4, lengthMode: "full" });
  ok(r.ok, "1: 파생 성공");
  ok(near(r.cfX, 47.5) && near(r.foldX, 49.25) && near(r.cutX, 53.25), "1: cfX 47.5 · foldX +1.75 · cutX +5.75");
  ok(near(r.topY, 5) && near(r.botY, 40), "1: T=neck-CF(5) · B=hem-CF(40)");
  ok(r.outline.length === 4 && r.outline.every(s => s.kind === "line"), "1: outline 4 line(폐곡선 스트립)");
  // 상단 수평 T→cut, 안단 바깥 세로, 밑단 수평, CF 복귀
  ok(near(r.outline[0].from.x, 47.5) && near(r.outline[0].to.x, 53.25) && near(r.outline[0].from.y, 5), "1: 상단 수평(CF→cutX, y=5)");
  ok(near(r.outline[1].from.x, 53.25) && near(r.outline[1].to.x, 53.25), "1: 안단 바깥 재단선(cutX 세로)");
  ok(near(r.outline[3].from.x, 47.5) && near(r.outline[3].to.x, 47.5), "1: CF 복귀(폐곡선)");
  ok(r.construction.length === 2 && near(r.construction[0].from.x, 49.25) && near(r.construction[1].from.x, 47.5), "1: construction = 접힘선(foldX) + CF(cfX)");
}
// 2. designOutline 포맷에서도 동일 파생(manual 네크라인 경로)
{
  const r = P.compute(designOutlineFmt(), { overlapCm: 1.75, facingWidthCm: 4, lengthMode: "full" });
  ok(r.ok && near(r.cfX, 47.5) && near(r.cutX, 53.25) && near(r.topY, 5) && near(r.botY, 40), "2: designOutline 포맷 동일 파생");
}
// 3. 입력 불변(외곽 배열·세그먼트 미변형)
{
  const g = geomOutline();
  const snap = JSON.stringify(g);
  P.compute(g, { overlapCm: 2, facingWidthCm: 3, lengthMode: "full" });
  ok(JSON.stringify(g) === snap, "3: 입력 외곽 불변");
}
// 4. 실패 계약
{
  ok(!P.compute([], { overlapCm: 1, facingWidthCm: 1 }).ok && P.compute([], { overlapCm: 1, facingWidthCm: 1 }).reason === "no-outline", "4: 빈 외곽 → no-outline");
  ok(P.compute(geomOutline(), { overlapCm: -1, facingWidthCm: 4 }).reason === "invalid-overlap", "4: 음수 여밈 → invalid-overlap");
  ok(P.compute(geomOutline(), { overlapCm: 1, facingWidthCm: NaN }).reason === "invalid-facing", "4: NaN 안단 → invalid-facing");
  ok(P.compute(geomOutline(), { overlapCm: 0, facingWidthCm: 0 }).reason === "no-placket", "4: 0/0 → no-placket");
  ok(P.compute(geomOutline(), { overlapCm: 1, facingWidthCm: 1, lengthMode: "partial" }).reason === "unsupported-length-mode", "4: partial → unsupported-length-mode");
  // CF 점 1개(세로 edge 없음) → no-cf-edge
  ok(P.compute([line([47.5, 5], [23, 40])], { overlapCm: 1, facingWidthCm: 1 }).reason === "no-cf-edge", "4: CF 세로 edge 없음 → no-cf-edge");
}
// 5. 여밈만(안단 0)·안단만(여밈 0) 도 유효
{
  const a = P.compute(geomOutline(), { overlapCm: 1.75, facingWidthCm: 0, lengthMode: "full" });
  ok(a.ok && near(a.cutX, 49.25), "5: 안단 0 → cutX=foldX");
  const b = P.compute(geomOutline(), { overlapCm: 0, facingWidthCm: 4, lengthMode: "full" });
  ok(b.ok && near(b.foldX, 47.5) && near(b.cutX, 51.5), "5: 여밈 0 → foldX=CF");
}

console.log("══════════════════════════════════════════════");
if (FAIL) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); }
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
