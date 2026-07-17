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
const vm = require("vm");
const { createEngine } = require("./loadEngine");
const { moveContext, applyRecipe, resolveCutRecipe, budgetRadOf } = require("./dartDriver");

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

// ══════════════════════════════════════════════
// C6: preview/apply가 evaluation.shape를 공유하는 계약.
//
// C6의 핵심은 "④가 만든 shape를 버리지 않고 apply가 같은 참조를 커밋한다"는 것이다.
// 참조 공유가 핵심이면 참조 동일성을 테스트해야 한다(브라우저 1회 성공은 회귀망이 아니다).
// dartDriver가 재사용 경로를 타는 것만으로는 "같은 참조를 커밋했다"가 증명되지 않는다.
//
// 새 프로덕션 API를 노출하지 않는다 — 비노출 dispose 함수(start/selectSide/cancel)는
// 이미 vm 컨텍스트 전역에 있으므로 vm.runInContext로 호출한다(export 추가 아님).
// 렌더 경로(drawAppliedSegments)는 render.js라 이 하네스에 없다 — preview 렌더 동일성은
// 브라우저 검증의 몫이고, 여기서는 apply 재사용 로직·dispose·불변성을 못박는다.
// ══════════════════════════════════════════════
function setupReuse() {
  const { engine, context } = createEngine();
  const ctx = moveContext(engine, "front", dims);
  const cut = resolveCutRecipe(engine, "front", ctx, { type: "front-waist", arcFraction: 0.35 });
  const split = engine.splitFrontOutline(ctx.segs, cut.point, cut.segIndex, ctx.d.pts, B);
  const rot = split.pieceA, fix = split.pieceB;
  const budgetRad = budgetRadOf(engine, "front", dims);
  const cand = engine.prepareDartMoveCandidate({
    pivot: ctx.pivot, budgetRad, rawBaseAngleRad: budgetRad,
    cutPoint: cut.point, rotatePiece: rot, fixedPiece: fix, prevBakedSegments: null,
  });
  const resolved = engine.resolveRequestedAngle(cand.evalCtx, cand.closeAngleRad, cand.closeAngleRad);
  // mousemove 종료 상태 재현 (UI가 apply 직전에 갖는 상태와 동일)
  Object.assign(engine.dartMoveState, {
    active: true, side: "front", mode: "drag",
    cutPoint: cut.point, cutSegIndex: cut.segIndex,
    rotatePts: rot.pts, fixedPts: fix.pts,
    rotateSegs: rot.segs, fixedSegs: fix.segsFull || fix.segs,
    baseAngle: cand.closeAngleRad, evalCtx: cand.evalCtx,
    userAngle: resolved.resolvedAngleRad, evaluation: resolved.evaluation,
  });
  return { engine, context, resolved };
}
// bake/normalize 호출 계측 (vm 전역 래핑 — perfBaseline과 같은 방식)
function instrumentBN(context) {
  vm.runInContext(`
    globalThis.__bn = { bake: 0, normalize: 0 };
    var _b = bakeFromSplitPieces;    bakeFromSplitPieces = function (...a) { __bn.bake++; return _b(...a); };
    var _n = normalizeBakedSegments; normalizeBakedSegments = function (...a) { __bn.normalize++; return _n(...a); };
  `, context);
}
const readBN = (context) => JSON.parse(vm.runInContext("JSON.stringify(__bn)", context));

console.log("\n── C6: preview/apply evaluation.shape 공유 계약 ──");

// 전제: setupReuse의 evaluation은 valid이고 shape가 비어있지 않아야 한다(재사용 대상).
{
  const { engine } = setupReuse();
  const ev = engine.dartMoveState.evaluation;
  check("C6 전제: evaluation valid & shape 비어있지 않음",
    !!ev && ev.valid === true && ev.angleRad === engine.dartMoveState.userAngle && ev.shape.length > 0);
}

// [1] 참조 동일성 + [8] apply 전후 deep 불변
{
  const { engine } = setupReuse();
  const shapeRef = engine.dartMoveState.evaluation.shape;   // apply가 null 처리하기 전 캡처
  const deepBefore = clone(shapeRef);
  engine.applyDartMove();
  const app = engine.dartMoveState.appliedFront;
  const identity = !!app && app.bakedSegments === shapeRef;
  check("C6[1] 재사용 apply: appliedFront.bakedSegments === evaluation.shape (object identity)", identity);
  check("C6[8] apply 전후 evaluation.shape deep snapshot 불변",
    !!app && eq(app.bakedSegments, deepBefore));
  console.log(`  [1] object identity(appliedFront.bakedSegments === evaluation.shape): ${identity} · [8] deep 불변 확인`);
}

// [2][3] 재사용 경로: initial bake/normalize 0회, C1 때문에 총 1회
{
  const { engine, context } = setupReuse();
  instrumentBN(context);
  engine.applyDartMove();
  const c = readBN(context);
  check("C6[2] 재사용 경로: initial bake/normalize 0회 (총 1 = C1만)", c.bake === 1 && c.normalize === 1, c);
  check("C6[3] C1 때문에 apply 전체 bake 1 / normalize 1", c.bake === 1 && c.normalize === 1, c);
  console.log(`  [2][3] 재사용 apply: bake ${c.bake} / normalize ${c.normalize} (initial 0 + C1 1 = 1)`);
}

// [4] angle mismatch → 재사용 안 함, fallback(bake 2)
{
  const { engine, context } = setupReuse();
  const shapeRef = engine.dartMoveState.evaluation.shape;
  engine.dartMoveState.userAngle = engine.dartMoveState.evaluation.angleRad * 0.9;  // 불일치(여전히 valid 범위)
  instrumentBN(context);
  engine.applyDartMove();
  const c = readBN(context);
  const app = engine.dartMoveState.appliedFront;
  check("C6[4] angle mismatch: 재사용 안 함 → fallback bake 2 / normalize 2", c.bake === 2 && c.normalize === 2, c);
  check("C6[4] angle mismatch: 저장 shape !== evaluation.shape", !!app && app.bakedSegments !== shapeRef);
}

// [5] evalCtx=null → 재사용 안 함, fallback
{
  const { engine, context } = setupReuse();
  const shapeRef = engine.dartMoveState.evaluation.shape;
  engine.dartMoveState.evalCtx = null;
  instrumentBN(context);
  engine.applyDartMove();
  const c = readBN(context);
  const app = engine.dartMoveState.appliedFront;
  check("C6[5] evalCtx=null: 재사용 안 함 → fallback bake 2", c.bake === 2 && c.normalize === 2, c);
  check("C6[5] evalCtx=null: 저장 shape !== evaluation.shape", !!app && app.bakedSegments !== shapeRef);
}

// [6] invalid evaluation → 재사용 안 함
{
  const { engine, context } = setupReuse();
  const shapeRef = engine.dartMoveState.evaluation.shape;
  engine.dartMoveState.evaluation = { ...engine.dartMoveState.evaluation, valid: false };
  instrumentBN(context);
  engine.applyDartMove();
  const c = readBN(context);
  const app = engine.dartMoveState.appliedFront;
  check("C6[6] invalid evaluation: 재사용 안 함 → fallback bake 2", c.bake === 2 && c.normalize === 2, c);
  check("C6[6] invalid evaluation: 저장 shape !== evaluation.shape", !!app && app.bakedSegments !== shapeRef);
}

// [7] dispose: 각 상태 전이 후 evaluation=null
{
  const { engine } = setupReuse();
  engine.applyDartMove();
  check("C6[7] apply 성공 후 evaluation=null", engine.dartMoveState.evaluation === null);
}
{
  const { engine } = setupReuse();
  engine.resetDartMove();
  check("C6[7] reset 후 evaluation=null", engine.dartMoveState.evaluation === null);
}
for (const call of ["startDartMove()", "cancelDartMove()", "selectDartSide('back')"]) {
  const { engine, context } = setupReuse();
  // 실제 shape 대신 감지용 sentinel을 심어 dispose가 확실히 null로 덮는지 본다.
  engine.dartMoveState.evaluation = { angleRad: 1, valid: true, shape: [{ type: "x", from: { x: 0, y: 0 }, to: { x: 1, y: 1 } }] };
  try {
    vm.runInContext(call, context);
    check(`C6[7] ${call} 후 evaluation=null`, engine.dartMoveState.evaluation === null);
  } catch (e) {
    check(`C6[7] ${call} 후 evaluation=null`, false, e.message.split("\n")[0]);
  }
}
console.log(`  [4]angle mismatch [5]evalCtx=null [6]invalid → 전부 fallback(bake 2, 저장≠evaluation.shape)`);
console.log(`  [7] apply/reset/start/cancel/selectSide 전이 후 evaluation=null 확인`);

console.log(`\n══════════════════════════════════════════════`);
console.log(`결과: ${pass} PASS / ${fail} FAIL`);
if (fail > 0) {
  console.log("실패 목록:");
  failures.forEach(f => console.log(" -", f.label, JSON.stringify(f.detail)));
  process.exitCode = 1;
}
