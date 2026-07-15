// ══════════════════════════════════════════════
// 앞판(pivot=BP) 다트이동 결정론적 검증 + 골든 스냅샷.
//
// backDeterministic.js의 앞판 대응이되, 컷 위치를 무작위 시드가 아니라 **시맨틱
// 레시피**(type + 연속 구간 호 길이 비율)로 잡아 결과 형상을 골든으로 고정한다.
// 앞판 old-dart(BP-G-GG)는 이등변이라 뒤판과 달리 잔여 sliver가 없어 불변식이 더
// 엄격하다(closed=0 정확, 풀클로징 시 notch 개수 정확).
//
// 실행:
//   node test/harness/frontDeterministic.js            # 골든과 대조
//   node test/harness/frontDeterministic.js --update    # 골든 재생성(변경 사유 기록)
// ══════════════════════════════════════════════
const path = require("path");
const { createEngine } = require("./loadEngine");
const { applyRecipe, listOpenNotches, countBreaks, countClosedTraces, budgetRadOf } = require("./dartDriver");
const { makeSnapshot, GoldenFile } = require("./goldenSnapshot");

const golden = new GoldenFile(path.join(__dirname, "golden", "front.json"));

let pass = 0, fail = 0;
const failures = [];
function check(label, cond, detail) {
  if (cond) { pass++; }
  else { fail++; failures.push({ label, detail }); console.error("  ✗ FAIL:", label, detail ?? ""); }
}
function section(t) { console.log("\n── " + t + " ──"); }

const B = 83, W = 64, BL = 38, dims = { B, W, BL };

// 하나의 적용 결과에 대해 불변식 검사 + 골든 대조.
function verify(name, engine, res, { expectBudgetPreserved = true } = {}) {
  check(`${name}: applied`, res.status === "applied", res.status);
  if (res.status !== "applied") return;
  const selfX = engine.findSelfIntersections(res.bakedSegments, res.pivot).length;
  const breaks = countBreaks(res.bakedSegments);
  const closed = countClosedTraces(engine, res.bakedSegments, res.pivot);
  check(`${name}: selfX=0`, selfX === 0, selfX);
  check(`${name}: breaks=0`, breaks === 0, breaks);
  check(`${name}: closed=0`, closed === 0, closed);

  const notches = listOpenNotches(engine, res.bakedSegments, res.pivot);
  const budgetRad = budgetRadOf(engine, "front", dims);
  const used = engine.sumOpenDartAngle(res.bakedSegments, res.pivot);
  if (expectBudgetPreserved) {
    // 앞판은 이등변 old-dart라 재분배가 예산을 정확히 보존한다(뒤판 sliver 없음).
    check(`${name}: 총합 ≈ budget (재분배 보존, 오차<0.5%)`,
      Math.abs(used / budgetRad - 1) < 0.005,
      { usedDeg: (used*180/Math.PI).toFixed(3), budgetDeg: (budgetRad*180/Math.PI).toFixed(3) });
  }

  const snap = makeSnapshot({ segments: res.bakedSegments, notches, pivot: res.pivot, budgetRad });
  const diffs = golden.check(name, snap);
  check(`${name}: 골든 일치`, diffs.length === 0, diffs.length ? diffs.slice(0, 6) : undefined);
}

// ══════════════════════════════════════════════
// 1+3. 첫 다트 풀/부분 × A/B 조각 (시맨틱 레시피)
// ══════════════════════════════════════════════
section("1+3. 첫 다트 풀/부분 × A/B 조각");
const firstDartRecipes = [
  { name: "first_waist_A_full",    type: "front-waist", arcFraction: 0.35, piece: "A", moveFraction: 1.0 },
  { name: "first_waist_A_half",    type: "front-waist", arcFraction: 0.35, piece: "A", moveFraction: 0.5 },
  { name: "first_sideseam_B_full", type: "side-seam",   arcFraction: 0.45, piece: "B", moveFraction: 1.0 },
  { name: "first_sideseam_B_half", type: "side-seam",   arcFraction: 0.45, piece: "B", moveFraction: 0.5 },
];
for (const r of firstDartRecipes) {
  const { engine } = createEngine();
  let res;
  try { res = applyRecipe(engine, "front", dims, r); }
  catch (e) { check(`${r.name}: 레시피 해석`, false, e.message); continue; }
  verify(r.name, engine, res);
}

// ══════════════════════════════════════════════
// 4. 중간각 스윕 10/25/50/75/90/100% (동일 컷, 앞판)
// ══════════════════════════════════════════════
section("4. 중간각 스윕 (첫 다트, front-waist A)");
for (const pct of [0.10, 0.25, 0.50, 0.75, 0.90, 1.00]) {
  const { engine } = createEngine();
  const name = `sweep_waist_A_${Math.round(pct * 100)}`;
  let res;
  try { res = applyRecipe(engine, "front", dims, { type: "front-waist", arcFraction: 0.35, piece: "A", moveFraction: pct }); }
  catch (e) { check(`${name}: 레시피 해석`, false, e.message); continue; }
  verify(name, engine, res);
}

// ══════════════════════════════════════════════
// 결과
// ══════════════════════════════════════════════
if (golden.update) {
  const reason = process.argv.slice(2).filter(a => a !== "--update").join(" ") || "front deterministic baseline";
  golden.save(reason);
  console.log(`\n[golden] ${golden.filePath} 갱신 (사유: ${reason})`);
}
console.log(`\n══════════════════════════════════════════════`);
console.log(`결과: ${pass} PASS / ${fail} FAIL${golden.update ? "  (--update 모드: 골든 대조는 skip)" : ""}`);
if (fail > 0) {
  console.log("실패 목록:");
  failures.forEach(f => console.log(" -", f.label, JSON.stringify(f.detail)));
  process.exitCode = 1;
}
