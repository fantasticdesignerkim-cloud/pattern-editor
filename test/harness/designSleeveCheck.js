// ══════════════════════════════════════════════
// designSleeveCheck.js — js/designSleeve.js S1 순수 파생 회귀.
// cap+진동밑 고정 · 하부(옆선·밑단)만 변형 · 초기값=원형 재현 · 착용 경고 · 실패/불변 계약.
//   node test/harness/designSleeveCheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");
const SRC = fs.readFileSync(path.join(__dirname, "..", "..", "js", "designSleeve.js"), "utf8");
let PASS = 0, FAIL = 0; const fails = [];
function ok(cond, name) { if (cond) PASS++; else { FAIL++; fails.push(name); } }
const near = (a, b, e = 0.05) => Math.abs(a - b) < e;

const sandbox = { window: {}, Math, Object, JSON, Array, isFinite, Infinity };
vm.createContext(sandbox);
vm.runInContext(SRC, sandbox, { filename: "designSleeve.js" });
const S = sandbox.window.designSleeve;
ok(typeof S.computeSilhouette === "function" && typeof S.referenceSilhouette === "function" && Object.isFrozen(S), "0: API·frozen");

// 실제 소매 구조 fixture: cap path(뒤 5.53 → apex 23.75,53 → 앞 39.29), 옆선·밑단(폭 30, y105).
const cap = { kind: "path", commands: [
  { type: "M", points: [{ x: 5.53, y: 66.42 }] },
  { type: "C", points: [{ x: 12, y: 56 }, { x: 18, y: 53 }, { x: 23.75, y: 53 }] },
  { type: "C", points: [{ x: 29, y: 53 }, { x: 35, y: 56 }, { x: 39.29, y: 66.42 }] }
] };
const line = (a, b) => ({ kind: "line", from: { x: a[0], y: a[1] }, to: { x: b[0], y: b[1] } });
const sleeve = () => ({ outline: [cap, line([5.53, 66.42], [7.56, 105]), line([39.29, 66.42], [37.56, 105]), line([7.56, 105], [37.56, 105])], construction: [] });
const hemOf = (r) => r.geometry.outline.filter(s => s.kind === "line").find(s => Math.abs(s.from.y - s.to.y) < 0.1 && s.from.y > 60);

// 1. referenceSilhouette: 원형 기준값
{
  const ref = S.referenceSilhouette(sleeve());
  ok(ref && near(ref.spY, 53) && near(ref.cuffCircumferenceCm, 30) && near(ref.hemCenterX, 22.56, 0.1), "1: ref spY 53·cuff 30·center 22.56");
  ok(near(ref.sleeveLengthCm, 52) && near(ref.bicepCm, 33.76, 0.1), "1: ref 소매길이 52·bicep 33.76");
}
// 2. 초기값 → 원형 밑단 재현 + cap 불변
{
  const ref = S.referenceSilhouette(sleeve());
  const r = S.computeSilhouette(sleeve(), { sleeveLengthCm: ref.sleeveLengthCm, cuffCircumferenceCm: ref.cuffCircumferenceCm, sideShape: "straight" });
  ok(r.ok, "2: 파생 성공");
  const hem = hemOf(r);
  ok(hem && near(Math.min(hem.from.x, hem.to.x), 7.56) && near(Math.max(hem.from.x, hem.to.x), 37.56) && near(hem.from.y, 105), "2: 초기값 밑단 원형 재현(7.56~37.56, y105)");
  ok(JSON.stringify(r.geometry.outline.find(s => s.kind === "path")) === JSON.stringify(cap), "2: cap 불변");
  ok(r.warnings.length === 0, "2: 초기값 경고 없음");
}
// 3. 짧게+좁게: 밑단 y·폭 감소, cap 불변, narrow-cuff 경고
{
  const r = S.computeSilhouette(sleeve(), { sleeveLengthCm: 40, cuffCircumferenceCm: 24, sideShape: "straight" });
  const hem = hemOf(r);
  ok(near(hem.from.y, 93) && near(Math.abs(hem.to.x - hem.from.x), 24), "3: 소매길이 40 → y93 · 폭 24");
  ok(r.warnings.indexOf("narrow-cuff") >= 0, "3: 원형보다 좁음 → narrow-cuff 경고");
  ok(JSON.stringify(r.geometry.outline.find(s => s.kind === "path")) === JSON.stringify(cap), "3: cap 여전히 불변");
  // 진동밑점(cap 끝) = 옆선 시작 고정
  const sides = r.geometry.outline.filter(s => s.kind === "line" && s.from.y < 70);
  ok(sides.some(s => near(s.from.x, 5.53) && near(s.from.y, 66.42)) && sides.some(s => near(s.from.x, 39.29)), "3: 진동밑점 고정(옆선 시작)");
}
// 4. 넓게: 경고 없음
{
  const r = S.computeSilhouette(sleeve(), { sleeveLengthCm: 52, cuffCircumferenceCm: 34, sideShape: "straight" });
  ok(r.ok && r.warnings.length === 0, "4: 원형보다 넓음 → 경고 없음");
}
// 5. 옆선 형태: 직선 = line, 완만 = cubic
{
  const rS = S.computeSilhouette(sleeve(), { sleeveLengthCm: 52, cuffCircumferenceCm: 26, sideShape: "straight" });
  const rG = S.computeSilhouette(sleeve(), { sleeveLengthCm: 52, cuffCircumferenceCm: 26, sideShape: "gentle" });
  ok(rS.geometry.outline.filter(s => s.kind === "line" && s.from.y < 70).length === 2, "5: 직선 옆선 = line 2");
  ok(rG.geometry.outline.filter(s => s.kind === "cubic").length === 2, "5: 완만 옆선 = cubic 2");
  // gentle 도 끝점(진동밑·밑단)은 정확
  const g = rG.geometry.outline.find(s => s.kind === "cubic");
  ok(near(g.from.x, 5.53) || near(g.from.x, 39.29), "5: 완만 옆선 끝점(진동밑) 정확");
}
// 6. 실패 계약
{
  ok(S.computeSilhouette(null, { sleeveLengthCm: 50, cuffCircumferenceCm: 30 }).reason === "no-sleeve", "6: no-sleeve");
  ok(S.computeSilhouette(sleeve(), { sleeveLengthCm: 0, cuffCircumferenceCm: 30 }).reason === "invalid-length", "6: invalid-length");
  ok(S.computeSilhouette(sleeve(), { sleeveLengthCm: 50, cuffCircumferenceCm: -5 }).reason === "invalid-cuff", "6: invalid-cuff");
  ok(S.computeSilhouette(sleeve(), { sleeveLengthCm: 50, cuffCircumferenceCm: 30, sideShape: "zig" }).reason === "invalid-side-shape", "6: invalid-side-shape");
}
// 7. 입력 불변
{
  const g = sleeve(); const snap = JSON.stringify(g);
  S.computeSilhouette(g, { sleeveLengthCm: 45, cuffCircumferenceCm: 28, sideShape: "gentle" });
  ok(JSON.stringify(g) === snap, "7: 입력 sleeve 불변");
}

console.log("══════════════════════════════════════════════");
if (FAIL) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); }
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
