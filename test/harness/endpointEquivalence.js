// ══════════════════════════════════════════════
// endpoint ↔ legacy-gate 동치 검사 — `evaluateEndpoint`(①)가 **예전 apply 게이트**와
// 같은 판정을 내는지 확인한다.
//
// **C7 이후 역할 (2026-07)**: 프로덕션 apply는 이제 self-intersection/budget 게이트와
// C1 이중검증을 삭제하고 `evaluation.valid` 하나로 거부·commit한다. 그래서 이 스위트의
// `legacyGates()`는 프로덕션 코드가 아니라 **독립 동결 기준**이다 — 예전 게이트 로직을
// 재구현해 evaluateEndpoint와 대조함으로써, 프로덕션 C1을 지운 뒤에도 그 동치를 하네스가
// 계속 강제한다(프로덕션 C1에 비의존). 불일치가 한 번이라도 나오면 즉시 throw = 중단.
// legacyGates는 이 시점부터 프로덕션과 함께 바뀌지 않는 **회귀 앵커**다.
//
// **비교 항목**:
//   - valid 판정 / reasons / canonicalized shape 좌표
//   - selfX, breaks, loop gap / 열린 다트각 합, budget ratio
//
// ★ 주의: `evaluateEndpoint`는 계층 계약상 `piece-collision`을 검사하지 않는다(②의
//   책임). 예전 apply 게이트(및 C7 이후에도 유지되는 apply의 piece-collision)는
//   findRotationCollisions로 그걸 본다. 따라서 두 판정이 갈릴 수 있는 유일한 정당한
//   경우가 "조각 충돌만 있고 endpoint는 멀쩡" 이다 — 동치 비교에서 제외하고 별도로 센다.
//
// 실행: node test/harness/endpointEquivalence.js
// ══════════════════════════════════════════════
const { createEngine } = require("./loadEngine");
const { applyRecipe, moveContext, resolveCutRecipe, budgetRadOf } = require("./dartDriver");
const { canonicalizeSegments } = require("./goldenSnapshot");

let pass = 0, fail = 0, contractDiff = 0;
function check(label, cond, detail) {
  if (cond) { pass++; return; }
  fail++;
  // 불일치는 즉시 실패 — C1의 존재 이유다.
  throw new Error(`[C1 동치 위반] ${label}\n  ${JSON.stringify(detail)}`);
}
const B = 83, W = 64, BL = 38, dims = { B, W, BL };
const D = (r) => r * 180 / Math.PI;
const cleanForBake = (segs) => (segs || []).filter(s =>
  s?.from && s?.to && s.type !== "dart-leg" && s.type !== "dart-bridge");

// ── 기존 apply 게이트를 그대로 재현(프로덕션 applyDartMove의 순서·기준) ──
function legacyGates(engine, fc, rc, pivot, prevBaked, budgetRad, angle) {
  const shape = engine.normalizeBakedSegments(
    engine.bakeFromSplitPieces({ fixedSegs: fc, rotateSegs: rc, pivot, angle }), pivot);
  const pieceCollision = engine.findRotationCollisions(fc, rc, pivot, angle).length > 0;
  const cross0 = prevBaked ? engine.findSelfIntersections(prevBaked, pivot).length : 0;
  const selfXCount = engine.findSelfIntersections(shape, pivot).length;
  const selfXWorse = selfXCount > cross0;
  const openSum = engine.sumOpenDartAngle(shape, pivot);
  const budgetOver = budgetRad > 1e-6 && openSum > budgetRad * engine.DART_BUDGET_TOL;
  let breaks = 0;
  for (let i = 0; i < shape.length - 1; i++) {
    const a = shape[i].to, b = shape[i + 1].from;
    if (Math.hypot(a.x - b.x, a.y - b.y) > 0.05) breaks++;
  }
  return { shape, pieceCollision, selfXCount, baselineSelfXCount: cross0, selfXWorse,
    openSum, budgetOver, breaks,
    // 기존 게이트의 최종 판정(= applyDartMove가 커밋했을지)
    legacyValid: !pieceCollision && !selfXWorse && !budgetOver };
}

const SCENARIOS = [
  { name: "gen0_front_waist_A", setup: [], cut: { type: "front-waist", arcFraction: 0.35 }, piece: "A", side: "front" },
  { name: "gen0_front_sideseam_B", setup: [], cut: { type: "side-seam", arcFraction: 0.45 }, piece: "B", side: "front" },
  { name: "gen0_back_shoulder_A", setup: [], cut: { type: "back-shoulder", arcFraction: 0.35 }, piece: "A", side: "back" },
  { name: "baked_front_sideseam_B",
    setup: [{ type: "front-waist", arcFraction: 0.35, piece: "A", moveFraction: 0.3 }],
    cut: { type: "side-seam", arcFraction: 0.45 }, piece: "B", side: "front" },
  { name: "multi_front_armUp_A",
    setup: [{ type: "front-waist", arcFraction: 0.35, piece: "A", moveFraction: 0.4 },
            { type: "side-seam", arcFraction: 0.45, piece: "B", moveFraction: 0.4 }],
    cut: { type: "front-armhole-upper", arcFraction: 0.6 }, piece: "A", side: "front" },
  // C0가 찾은 비단조 케이스 — 금지구간을 지나며 판정이 뒤집히는 구간까지 훑는다
  { name: "nonmono_front_armLow_A",
    setup: [{ type: "front-armhole-lower", arcFraction: 0.5, piece: "B", moveFraction: 0.5 }],
    cut: { type: "front-armhole-lower", arcFraction: 0.65 }, piece: "A", side: "front" },
];

// 각 시나리오를 여러 각도에서 훑어 두 경로를 비교한다(비단조 구간 포함).
const FRACTIONS = [0, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];

console.log("\n── C1: evaluateEndpoint vs 기존 apply 게이트 동치 ──");
let compared = 0;
for (const sc of SCENARIOS) {
  const { engine } = createEngine();
  let ok = true;
  for (const r of sc.setup) { if (applyRecipe(engine, sc.side, dims, r).status !== "applied") ok = false; }
  if (!ok) { console.log(`  (${sc.name}: setup 실패 — 스킵)`); continue; }

  const ctx = moveContext(engine, sc.side, dims);
  let cut;
  try { cut = resolveCutRecipe(engine, sc.side, ctx, sc.cut); } catch (e) { console.log(`  (${sc.name}: ${e.message} — 스킵)`); continue; }
  const split = ctx.isBaked
    ? engine.splitBakedOutline(ctx.segs, cut.point, cut.segIndex, ctx.pivot)
    : sc.side === "back"
      ? engine.splitBackOutline(ctx.segs, cut.point, cut.segIndex, ctx.d.pts, ctx.d.formula, B)
      : engine.splitFrontOutline(ctx.segs, cut.point, cut.segIndex, ctx.d.pts, B);
  const rot = sc.piece === "A" ? split.pieceA : split.pieceB;
  const fix = sc.piece === "A" ? split.pieceB : split.pieceA;
  const budgetRad = budgetRadOf(engine, sc.side, dims);
  const prevBaked = (sc.side === "back" ? engine.dartMoveState.appliedBack : engine.dartMoveState.appliedFront)?.bakedSegments || null;
  const fc = cleanForBake(fix.segsFull || fix.segs), rc = cleanForBake(rot.segs);

  const evalCtx = { fixedSegs: fix.segsFull || fix.segs, rotateSegs: rot.segs, pivot: ctx.pivot,
    budgetRad, prevBakedSegments: prevBaked, sourceNotch: rot.sourceNotch || null };

  let scenarioContractDiff = 0;
  for (const f of FRACTIONS) {
    const angle = budgetRad * f * (rot.sourceNotch ? Math.sign(rot.sourceNotch.signedAngleRad) || 1 : 1);
    const legacy = legacyGates(engine, fc, rc, ctx.pivot, prevBaked, budgetRad, angle);
    const ev = engine.evaluateEndpoint(evalCtx, angle);
    compared++;

    // shape 좌표 동일 (canonicalize 후)
    const cl = canonicalizeSegments(legacy.shape), ce = canonicalizeSegments(ev.shape);
    check(`${sc.name}@${f}: shape 좌표 동일`, JSON.stringify(cl) === JSON.stringify(ce),
      { legacyLen: cl.length, evalLen: ce.length });

    // 지표 동일
    check(`${sc.name}@${f}: selfX 동일`, legacy.selfXCount === ev.metrics.selfXCount,
      { legacy: legacy.selfXCount, eval: ev.metrics.selfXCount });
    check(`${sc.name}@${f}: baseline selfX 동일`, legacy.baselineSelfXCount === ev.metrics.baselineSelfXCount,
      { legacy: legacy.baselineSelfXCount, eval: ev.metrics.baselineSelfXCount });
    check(`${sc.name}@${f}: breaks 동일`, legacy.breaks === ev.metrics.breaks,
      { legacy: legacy.breaks, eval: ev.metrics.breaks });
    check(`${sc.name}@${f}: 열린 다트각 합 동일 (1e-9)`, Math.abs(legacy.openSum - ev.metrics.openDartSumRad) < 1e-9,
      { legacy: D(legacy.openSum), eval: D(ev.metrics.openDartSumRad) });
    const legacyRatio = budgetRad > 1e-6 ? legacy.openSum / budgetRad : 0;
    check(`${sc.name}@${f}: budget ratio 동일 (1e-9)`, Math.abs(legacyRatio - ev.metrics.budgetRatio) < 1e-9,
      { legacy: legacyRatio, eval: ev.metrics.budgetRatio });

    // reasons가 기존 게이트의 개별 판정과 일치
    check(`${sc.name}@${f}: self-intersection reason 일치`,
      ev.reasons.includes("self-intersection") === legacy.selfXWorse,
      { legacy: legacy.selfXWorse, reasons: ev.reasons });
    check(`${sc.name}@${f}: budget-exceeded reason 일치`,
      ev.reasons.includes("budget-exceeded") === legacy.budgetOver,
      { legacy: legacy.budgetOver, reasons: ev.reasons });
    check(`${sc.name}@${f}: piece-collision 미검사 (②의 책임)`,
      !ev.reasons.includes("piece-collision"), { reasons: ev.reasons });

    // valid 판정: piece-collision을 뺀 나머지에서 동치여야 한다.
    if (legacy.pieceCollision && ev.valid) {
      // 계약대로의 정당한 차이 — ①은 조각 충돌을 안 본다. 버그 아님.
      scenarioContractDiff++; contractDiff++;
    } else {
      check(`${sc.name}@${f}: valid 판정 동치 (piece-collision 제외)`,
        ev.valid === legacy.legacyValid,
        { evalValid: ev.valid, legacyValid: legacy.legacyValid, pieceCollision: legacy.pieceCollision, reasons: ev.reasons });
    }
  }
  console.log(`  ${sc.name}: ${FRACTIONS.length}각도 동치 확인${scenarioContractDiff ? ` (조각충돌만 다른 계약상 차이 ${scenarioContractDiff}건)` : ""}`);
}

console.log(`\n비교한 (시나리오×각도) 조합: ${compared}`);
console.log(`계약상 정당한 차이(조각 충돌만 있고 endpoint는 유효): ${contractDiff}건 — ②가 담당할 몫`);
console.log(`\n══════════════════════════════════════════════`);
console.log(`결과: ${pass} PASS / ${fail} FAIL`);
if (fail > 0) process.exitCode = 1;
