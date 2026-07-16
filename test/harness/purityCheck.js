// ══════════════════════════════════════════════
// prepareDartMoveCandidate 순수성 검사.
//
// 이 함수는 UI(initDartMoveClickHandler)와 테스트 하네스(dartDriver.performMove)가
// **공유**하는 평가 함수이므로, 입력을 몰래 변형하면 두 호출자 중 한쪽에서만 나타나는
// 재현 불가 버그가 된다. 그래서 계약을 테스트로 못박는다:
//   1. 입력 비변형: segments / rotatePiece / fixedPiece / cutPoint / prevBaked를 안 바꾼다.
//   2. 결정성: 같은 입력을 두 번 넣으면 같은 결과가 나온다(숨은 전역 상태 의존 없음).
// 두 분기(sourceNotch 경로 / gen-0 경로) 모두 검사한다.
//
// 실행: node test/harness/purityCheck.js
// ══════════════════════════════════════════════
const { createEngine } = require("./loadEngine");
const { moveContext, applyRecipe, resolveCutRecipe } = require("./dartDriver");

let pass = 0, fail = 0;
const failures = [];
function check(label, cond, detail) {
  if (cond) { pass++; }
  else { fail++; failures.push({ label, detail }); console.error("  ✗ FAIL:", label, detail ?? ""); }
}

const B = 83, W = 64, BL = 38, dims = { B, W, BL };
const clone = (o) => JSON.parse(JSON.stringify(o));
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// 주어진 엔진 상태에서 후보 준비에 필요한 입력 일습을 만든다.
function buildInputs(engine, recipe) {
  const ctx = moveContext(engine, "front", dims);
  const cut = resolveCutRecipe(engine, "front", ctx, recipe);
  const split = ctx.isBaked
    ? engine.splitBakedOutline(ctx.segs, cut.point, cut.segIndex, ctx.pivot)
    : engine.splitFrontOutline(ctx.segs, cut.point, cut.segIndex, ctx.d.pts, B);
  const rotatePiece = recipe.piece === "A" ? split.pieceA : split.pieceB;
  const fixedPiece  = recipe.piece === "A" ? split.pieceB : split.pieceA;
  const baseDartAngle = engine.calcFrontBaseDartAngle(ctx.d.pts, B);
  const prevBaked = engine.dartMoveState.appliedFront?.bakedSegments || null;
  return {
    pivot: ctx.pivot,
    budgetRad: Math.abs(baseDartAngle),
    rawBaseAngleRad: baseDartAngle,
    cutPoint: cut.point,
    rotatePiece, fixedPiece,
    prevBakedSegments: prevBaked,
    _segs: ctx.segs,
  };
}

function runScenario(label, engine, recipe, expectSourceNotch) {
  const inp = buildInputs(engine, recipe);
  check(`${label}: sourceNotch 경로 여부 = ${expectSourceNotch}`,
    !!inp.rotatePiece.sourceNotch === expectSourceNotch,
    { got: !!inp.rotatePiece.sourceNotch });

  // 호출 전 스냅샷
  const before = {
    segs: clone(inp._segs),
    rotatePiece: clone(inp.rotatePiece),
    fixedPiece: clone(inp.fixedPiece),
    cutPoint: clone(inp.cutPoint),
    prevBaked: inp.prevBakedSegments ? clone(inp.prevBakedSegments) : null,
  };

  const r1 = engine.prepareDartMoveCandidate({
    pivot: inp.pivot, budgetRad: inp.budgetRad, rawBaseAngleRad: inp.rawBaseAngleRad,
    cutPoint: inp.cutPoint, rotatePiece: inp.rotatePiece, fixedPiece: inp.fixedPiece,
    prevBakedSegments: inp.prevBakedSegments,
  });

  // 1) 입력 비변형
  check(`${label}: segments 비변형`, eq(before.segs, inp._segs));
  check(`${label}: rotatePiece 비변형`, eq(before.rotatePiece, inp.rotatePiece));
  check(`${label}: fixedPiece 비변형`, eq(before.fixedPiece, inp.fixedPiece));
  check(`${label}: cutPoint 비변형`, eq(before.cutPoint, inp.cutPoint));
  check(`${label}: prevBakedSegments 비변형`,
    inp.prevBakedSegments ? eq(before.prevBaked, inp.prevBakedSegments) : true);

  // 2) 결정성: 같은 입력 두 번 → 같은 결과
  const r2 = engine.prepareDartMoveCandidate({
    pivot: inp.pivot, budgetRad: inp.budgetRad, rawBaseAngleRad: inp.rawBaseAngleRad,
    cutPoint: inp.cutPoint, rotatePiece: inp.rotatePiece, fixedPiece: inp.fixedPiece,
    prevBakedSegments: inp.prevBakedSegments,
  });
  check(`${label}: 결정성 (closeAngleRad 동일)`, r1.closeAngleRad === r2.closeAngleRad,
    { first: r1.closeAngleRad, second: r2.closeAngleRad });
  // selection = selectRotationSign의 반환(부호별 근거). C4에서 limits를 대체했다.
  check(`${label}: 결정성 (selection 동일)`, eq(r1.selection, r2.selection),
    { s1: r1.selection?.reason, s2: r2.selection?.reason });

  // 3) 반환 계약
  check(`${label}: valid=true`, r1.valid === true, r1.reason);
  check(`${label}: sourceNotch 반환 형태`,
    expectSourceNotch ? (r1.sourceNotch && typeof r1.sourceNotch.signedAngleRad === "number") : r1.sourceNotch === null);
  // 부호 선택 계약: sourceNotch면 후보 1개(닫는 부호만), gen-0이면 양쪽 부호 2개.
  check(`${label}: 후보 수 (${expectSourceNotch ? "sourceNotch=1" : "gen-0=2"})`,
    r1.selection.candidates.length === (expectSourceNotch ? 1 : 2),
    { n: r1.selection.candidates.length, reason: r1.selection.reason });
  check(`${label}: closeAngleRad = selectedSign × selectedMaxReachableMagRad`,
    Math.abs(r1.closeAngleRad - r1.selection.selectedSign * r1.selection.selectedMaxReachableMagRad) < 1e-12);
  const cands = r1.selection.candidates.map(c =>
    `${c.sign > 0 ? "+" : "-"}${(c.maxReachableMagRad*180/Math.PI).toFixed(2)}°(${c.foundBy},평가${c.scan.evaluated + c.scan.refined})`).join(" / ");
  console.log(`  ${label}: closeAngle=${(r1.closeAngleRad*180/Math.PI).toFixed(2)}° ` +
    `reason=${r1.selection.reason} 후보=${cands}`);
}

console.log("\n── prepareDartMoveCandidate 순수성/결정성 ──");

// 시나리오 1: gen-0 (sourceNotch 없음)
{
  const { engine } = createEngine();
  runScenario("gen0_waist_A", engine, { type: "front-waist", arcFraction: 0.35, piece: "A", moveFraction: 1.0 }, false);
}

// 시나리오 2: baked 다중다트 (sourceNotch 경로)
{
  const { engine } = createEngine();
  const seed = applyRecipe(engine, "front", dims, { type: "front-waist", arcFraction: 0.35, piece: "A", moveFraction: 0.3 });
  if (seed.status !== "applied") { check("시나리오2 baseline 생성", false, seed.status); }
  else runScenario("baked_sideseam_B", engine, { type: "side-seam", arcFraction: 0.45, piece: "B", moveFraction: 0.5 }, true);
}

console.log(`\n══════════════════════════════════════════════`);
console.log(`결과: ${pass} PASS / ${fail} FAIL`);
if (fail > 0) {
  console.log("실패 목록:");
  failures.forEach(f => console.log(" -", f.label, JSON.stringify(f.detail)));
  process.exitCode = 1;
}
