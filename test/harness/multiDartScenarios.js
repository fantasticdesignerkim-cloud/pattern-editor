// ══════════════════════════════════════════════
// 앞판 다중다트 분산 체인 — 이 리팩터의 최고 위험 지점.
//
// CLAUDE.md가 "split/bake가 닫힌 흔적을 재분할로 재개방하는 아티팩트가 나타나
// normalize가 사후 청소하는" 바로 그 구간이라고 경고하는 3다트+ 부채꼴을, 시맨틱
// 레시피로 **결정론적으로** 쌓고 매 세대 검증 + 골든 고정한다. 골든은 현재
// post-normalize 결과를 잠그며, 이는 영구 정답이 아니라 **리팩터 기간의 호환성
// 기준**이다(사용자 확정). 나중에 bake 아티팩트를 근본 개선할 때는 `--update`와
// 변경 사유를 함께 커밋한다.
//
// 실행:
//   node test/harness/multiDartScenarios.js
//   node test/harness/multiDartScenarios.js --update "reason"
// ══════════════════════════════════════════════
const path = require("path");
const { createEngine } = require("./loadEngine");
const { applyRecipe, listOpenNotches, countBreaks, countClosedTraces, budgetRadOf } = require("./dartDriver");
const { makeSnapshot, GoldenFile } = require("./goldenSnapshot");

const golden = new GoldenFile(path.join(__dirname, "golden", "multidart.json"));

let pass = 0, fail = 0;
const failures = [];
function check(label, cond, detail) {
  if (cond) { pass++; }
  else { fail++; failures.push({ label, detail }); console.error("  ✗ FAIL:", label, detail ?? ""); }
}
function section(t) { console.log("\n── " + t + " ──"); }

const B = 83, W = 64, BL = 38, dims = { B, W, BL };

// 한 세대 적용 결과 검증 + 골든 대조. 다중다트 고유 검사(퇴화 slivers 없음, 합=budget)
// 를 포함한다.
function verifyGen(name, engine, res) {
  check(`${name}: applied`, res.status === "applied", res.status);
  if (res.status !== "applied") return null;

  const pivot = res.pivot;
  const baked = res.bakedSegments;
  const selfX = engine.findSelfIntersections(baked, pivot).length;
  const breaks = countBreaks(baked);
  const closed = countClosedTraces(engine, baked, pivot);
  check(`${name}: selfX=0`, selfX === 0, selfX);
  check(`${name}: breaks=0`, breaks === 0, breaks);
  check(`${name}: closed=0`, closed === 0, closed);

  const notches = listOpenNotches(engine, baked, pivot);
  const budgetRad = budgetRadOf(engine, "front", dims);
  const used = engine.sumOpenDartAngle(baked, pivot);

  // 다중다트 불변식: 예산 게이트 상한(1.15×) 이내 + 앞판은 이등변이라 사실상 =budget.
  check(`${name}: 총합 ≤ budget×1.15 (예산 게이트)`, used <= budgetRad * engine.DART_BUDGET_TOL + 1e-6,
    { usedDeg: (used*180/Math.PI).toFixed(3), budgetDeg: (budgetRad*180/Math.PI).toFixed(3) });

  // 퇴화 sliver 없음: 열린 notch는 전부 MIN_DART_ANGLE_RAD 이상이어야 한다(입이
  // 안 벌어진 다리쌍이 남으면 방사형 잔선이 된다 — CLAUDE.md 잔선 버그).
  const angleOf = (nn) => {
    const v1x = nn.mouthA.x - pivot.x, v1y = nn.mouthA.y - pivot.y;
    const v2x = nn.mouthB.x - pivot.x, v2y = nn.mouthB.y - pivot.y;
    return Math.abs(Math.atan2(v1x * v2y - v1y * v2x, v1x * v2x + v1y * v2y));
  };
  const tiny = notches.filter(nn => angleOf(nn) < engine.MIN_DART_ANGLE_RAD);
  check(`${name}: 퇴화 sliver 없음 (모든 notch ≥ 0.5°)`, tiny.length === 0,
    { tinyDeg: tiny.map(nn => (angleOf(nn)*180/Math.PI).toFixed(3)) });

  const snap = makeSnapshot({ segments: baked, notches, pivot, budgetRad });
  const diffs = golden.check(name, snap);
  check(`${name}: 골든 일치`, diffs.length === 0, diffs.length ? diffs.slice(0, 6) : undefined);

  return { notchCount: notches.length, usedDeg: +(used*180/Math.PI).toFixed(2) };
}

// 레시피 시퀀스를 한 엔진에 순서대로 적용하고 매 세대 검증.
function runSequence(scenario, recipes) {
  section(`${scenario}`);
  const { engine } = createEngine();
  recipes.forEach((r, i) => {
    const name = `${scenario}_gen${i}`;
    let res;
    try { res = applyRecipe(engine, "front", dims, r); }
    catch (e) { check(`${name}: 레시피 해석`, false, e.message); return; }
    const info = verifyGen(name, engine, res);
    if (info) console.log(`    gen${i} (${r.type} ${r.piece} ${Math.round(r.moveFraction*100)}%): notch=${info.notchCount} used=${info.usedDeg}°`);
  });
}

// ══════════════════════════════════════════════
// 시나리오 (사용자 확정 레시피 포함)
// ══════════════════════════════════════════════

// 2다트 분산: 부분 드래그로 예산을 나눠 두 곳에 다트를 연다.
runSequence("two_dart", [
  { type: "front-waist", arcFraction: 0.35, piece: "A", moveFraction: 0.5 },
  { type: "side-seam",   arcFraction: 0.45, piece: "B", moveFraction: 0.4 },
]);

// 3다트 분산 (사용자 예시 레시피 그대로) — 최고 위험 구간.
runSequence("three_dart", [
  { type: "front-waist",         arcFraction: 0.35, piece: "A", moveFraction: 0.5 },
  { type: "side-seam",           arcFraction: 0.45, piece: "B", moveFraction: 0.4 },
  { type: "front-armhole-upper", arcFraction: 0.6,  piece: "A", moveFraction: 1.0 },
]);

// relocate: 풀 드래그 연쇄 = 전체 다트를 매번 새 위치로 이전(분산이 아님).
runSequence("relocate", [
  { type: "front-waist", arcFraction: 0.35, piece: "A", moveFraction: 1.0 },
  { type: "side-seam",   arcFraction: 0.45, piece: "B", moveFraction: 1.0 },
]);

// ══════════════════════════════════════════════
if (golden.update) {
  const reason = process.argv.slice(2).filter(a => a !== "--update").join(" ") || "multidart baseline (post-normalize, refactor-period compat)";
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
