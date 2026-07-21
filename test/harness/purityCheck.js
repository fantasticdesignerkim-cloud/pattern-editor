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

// 거부 시 보존돼야 할 상태 스냅샷 (mode/userAngle/evaluation/evalCtx는 그대로 유지)
const rejectState = (s) => ({ mode: s.mode, userAngle: s.userAngle, evaluation: s.evaluation, evalCtx: s.evalCtx });
const preserved = (b, s) => b.mode === s.mode && b.userAngle === s.userAngle && b.evaluation === s.evaluation && b.evalCtx === s.evalCtx;

console.log("\n── C6/C7: preview·apply evaluation.shape 공유 + 단일 거부/commit ──");

// 전제: setupReuse의 evaluation은 valid이고 shape가 비어있지 않아야 한다(commit 대상).
{
  const { engine } = setupReuse();
  const ev = engine.dartMoveState.evaluation;
  check("전제: evaluation valid & shape 비어있지 않음",
    !!ev && ev.valid === true && ev.angleRad === engine.dartMoveState.userAngle && ev.shape.length > 0);
}

// [1] 참조 동일성 + [8] apply 전후 deep 불변 + valid apply bake/normalize 0/0 (C7: C1 제거)
{
  const { engine, context } = setupReuse();
  const shapeRef = engine.dartMoveState.evaluation.shape;   // apply가 null 처리하기 전 캡처
  const deepBefore = clone(shapeRef);
  instrumentBN(context);
  engine.applyDartMove();
  const c = readBN(context);
  const app = engine.dartMoveState.appliedFront;
  const identity = !!app && app.bakedSegments === shapeRef;
  check("[1] valid apply: appliedFront.bakedSegments === evaluation.shape (object identity)", identity);
  check("[8] apply 전후 evaluation.shape deep snapshot 불변", !!app && eq(app.bakedSegments, deepBefore));
  check("[2][3] valid apply: bake/normalize 0/0 (C7 — 재bake·C1 없음)", c.bake === 0 && c.normalize === 0, c);
  check("[7] valid apply 성공 후 evaluation=null (폐기)", engine.dartMoveState.evaluation === null);
  console.log(`  [1] identity=${identity} · [8] deep 불변 · [2][3] valid apply bake/normalize ${c.bake}/${c.normalize}`);
}

// [4] angle mismatch → getReusable null → "평가 없음" 거부, commit 없음, 상태 유지, bake 0
{
  const { engine, context } = setupReuse();
  engine.dartMoveState.userAngle = engine.dartMoveState.evaluation.angleRad * 0.9;  // 각도 불일치(≥MIN)
  const before = rejectState(engine.dartMoveState);
  instrumentBN(context);
  engine.applyDartMove();
  const c = readBN(context);
  check("[4] angle mismatch: commit 없음", engine.dartMoveState.appliedFront === null);
  check("[4] angle mismatch: bake/normalize 0/0 (재평가 없음)", c.bake === 0 && c.normalize === 0, c);
  check("[4] angle mismatch: mode/userAngle/evaluation/evalCtx 유지", preserved(before, engine.dartMoveState));
}

// [5] evalCtx=null → getReusable null → 거부, commit 없음, 상태 유지, bake 0
{
  const { engine, context } = setupReuse();
  engine.dartMoveState.evalCtx = null;
  const before = rejectState(engine.dartMoveState);
  instrumentBN(context);
  engine.applyDartMove();
  const c = readBN(context);
  check("[5] evalCtx=null: commit 없음", engine.dartMoveState.appliedFront === null);
  check("[5] evalCtx=null: bake/normalize 0/0", c.bake === 0 && c.normalize === 0, c);
  check("[5] evalCtx=null: 상태 유지", preserved(before, engine.dartMoveState));
}

// [6] invalid evaluation → getReusable 반환(valid 미검사) → apply가 !valid로 reasons 거부,
//     commit 없음, 상태 유지, bake 0. (valid는 endpoint 안전성의 단일 진실 — 함수는 안 봄)
for (const reasons of [["budget-exceeded"], ["self-intersection"], ["discontinuous"], ["loop-open"], ["unknown"]]) {
  const { engine, context } = setupReuse();
  engine.dartMoveState.evaluation = { ...engine.dartMoveState.evaluation, valid: false, reasons };
  const before = rejectState(engine.dartMoveState);
  instrumentBN(context);
  engine.applyDartMove();
  const c = readBN(context);
  check(`[6] invalid(${reasons[0]}): commit 없음`, engine.dartMoveState.appliedFront === null);
  check(`[6] invalid(${reasons[0]}): bake/normalize 0/0`, c.bake === 0 && c.normalize === 0, c);
  check(`[6] invalid(${reasons[0]}): 상태 유지`, preserved(before, engine.dartMoveState));
}

// [4b] missing evaluation(null) → 거부, commit 없음, 상태 유지, bake 0
{
  const { engine, context } = setupReuse();
  engine.dartMoveState.evaluation = null;
  const before = rejectState(engine.dartMoveState);
  instrumentBN(context);
  engine.applyDartMove();
  const c = readBN(context);
  check("[4b] missing evaluation: commit 없음", engine.dartMoveState.appliedFront === null);
  check("[4b] missing evaluation: bake/normalize 0/0", c.bake === 0 && c.normalize === 0, c);
  check("[4b] missing evaluation: 상태 유지", preserved(before, engine.dartMoveState));
}

// [7] dispose: reset/start/cancel/selectSide 전이 후 evaluation=null (apply 성공은 [1]에서 확인)
{
  const { engine } = setupReuse();
  engine.resetDartMove();
  check("[7] reset 후 evaluation=null", engine.dartMoveState.evaluation === null);
}
for (const call of ["startDartMove()", "cancelDartMove()", "selectDartSide('back')"]) {
  const { engine, context } = setupReuse();
  engine.dartMoveState.evaluation = { angleRad: 1, valid: true, shape: [{ type: "x", from: { x: 0, y: 0 }, to: { x: 1, y: 1 } }] };
  try {
    vm.runInContext(call, context);
    check(`[7] ${call} 후 evaluation=null`, engine.dartMoveState.evaluation === null);
  } catch (e) {
    check(`[7] ${call} 후 evaluation=null`, false, e.message.split("\n")[0]);
  }
}
console.log(`  [4]mismatch [5]evalCtx=null [6]invalid(reasons) [4b]missing → 전부 commit 0·bake 0·상태 유지`);
console.log(`  [7] apply성공/reset/start/cancel/selectSide 전이 후 evaluation=null`);

// ══════════════════════════════════════════════
// (S5) getDartMoveUiSnapshot 읽기 전용 계약
//  UI가 엔진 내부를 소유하지 않고 "그 순간 읽기만" 하는지 못박는다.
// ══════════════════════════════════════════════
console.log("\n── S5: getDartMoveUiSnapshot 읽기 전용 계약 ──");

const snapOf = (context) => JSON.parse(vm.runInContext("JSON.stringify(getDartMoveUiSnapshot())", context));
const SNAP_KEYS = ["active","side","stepKey","viaSourceNotch","budgetRad","sourceApertureBeforeRad",
  "maxReachableRad","userAngleRad","openWidthCm","valid","reasons"];
// 내부 참조 금지 + 진단용 최근접 휴리스틱 금지.
// sourceApertureAfterRad / newNotchRad 는 신원 추적이 아니라 "열린 노치 중 기대값에 가장
// 가까운 것"이라, 소스가 완전히 닫히면 새 노치를 집어 값이 틀린다 → 공개 계약에서 제외.
const FORBIDDEN = ["shape","evaluation","evalCtx","segments","pieces","candidate","fixedSegs","rotateSegs",
  "pieceA","pieceB","metrics","cutPoint","pivot","sourceApertureAfterRad","newNotchRad"];

// [S5-1] idle 스냅샷 (아무 것도 시작하지 않은 엔진)
{
  const { engine, context } = createEngine();
  const s = snapOf(context);
  check("[S5-1] idle: active=false", s.active === false, s.active);
  check("[S5-1] idle: side=null / stepKey=idle", s.side === null && s.stepKey === "idle", [s.side, s.stepKey]);
  check("[S5-1] idle: evalCtx 없음 → budget/source/maxReachable=null",
    s.budgetRad === null && s.sourceApertureBeforeRad === null && s.maxReachableRad === null);
  check("[S5-1] idle: openWidthCm=null (cutPoint 없음)", s.openWidthCm === null, s.openWidthCm);
  check("[S5-1] idle: valid=null, reasons=[]", s.valid === null && Array.isArray(s.reasons) && s.reasons.length === 0);
  check("[S5-1] 스키마 키 정확히 11개", eq(Object.keys(s).sort(), SNAP_KEYS.slice().sort()), Object.keys(s));
  void engine;
}

// [S5-2] active/side 선택 전  [S5-3] selectCut  [S5-4] selectPiece
{
  const { engine, context } = createEngine();
  vm.runInContext("startDartMove()", context);
  let s = snapOf(context);
  check("[S5-2] start 후 active=true, side=null", s.active === true && s.side === null, [s.active, s.side]);
  vm.runInContext("selectDartSide('front')", context);
  s = snapOf(context);
  check("[S5-3] selectCut: stepKey=selectCut, side=front", s.stepKey === "selectCut" && s.side === "front", [s.stepKey, s.side]);
  check("[S5-3] selectCut: 수치 아직 없음", s.maxReachableRad === null && s.budgetRad === null);
  // selectPiece 상태를 mode 만으로 재현(엔진 계산 없이 상태 필드만)
  engine.dartMoveState.mode = "selectPiece";
  s = snapOf(context);
  check("[S5-4] selectPiece: stepKey 반영", s.stepKey === "selectPiece", s.stepKey);
}

// [S5-5] drag gen-0  +  [S5-9] 금지 키 미노출  +  [S5-12] 단위  +  [S5-14] openWidthCm 일치
{
  const { engine, context } = setupReuse();          // gen-0(front-waist) drag 상태
  const s = snapOf(context);
  check("[S5-5] drag: stepKey=drag, active/side", s.stepKey === "drag" && s.active === true && s.side === "front");
  check("[S5-5] gen-0: viaSourceNotch=false, source=null",
    s.viaSourceNotch === false && s.sourceApertureBeforeRad === null, [s.viaSourceNotch, s.sourceApertureBeforeRad]);
  check("[S5-5] drag: budget/maxReachable/valid 존재",
    typeof s.budgetRad === "number" && typeof s.maxReachableRad === "number" && typeof s.valid === "boolean");
  check("[S5-9] 금지 키 미노출", FORBIDDEN.every(k => !(k in s)), Object.keys(s).filter(k => FORBIDDEN.includes(k)));
  // 단위: budget 은 rad(18.25° ≈ 0.3185), openWidthCm 은 cm(수 cm 스케일)
  const budgetDeg = s.budgetRad * 180 / Math.PI;
  check("[S5-12] budgetRad 단위=rad (deg 환산 18.25±0.01)", Math.abs(budgetDeg - 18.25) < 0.01, budgetDeg);
  check("[S5-12] userAngleRad 단위=rad (|rad| ≤ 2π)", Math.abs(s.userAngleRad) <= 2 * Math.PI, s.userAngleRad);
  const expectCm = engine.dartOpenWidth
    ? engine.dartOpenWidth(engine.dartMoveState.cutPoint, engine.dartMoveState.evalCtx.pivot, engine.dartMoveState.userAngle)
    : JSON.parse(vm.runInContext(
        "JSON.stringify(dartOpenWidth(dartMoveState.cutPoint, dartMoveState.evalCtx.pivot, dartMoveState.userAngle))", context));
  check("[S5-14] openWidthCm === dartOpenWidth 결과", Math.abs(s.openWidthCm - expectCm) < 1e-9, [s.openWidthCm, expectCm]);
  check("[S5-12] openWidthCm 단위=cm (0 < v < 100)", s.openWidthCm > 0 && s.openWidthCm < 100, s.openWidthCm);
}

// [S5-6] sourceNotch drag (2차 다트)
{
  const { engine, context } = createEngine();
  const r1 = applyRecipe(engine, "front", dims, { type: "front-waist", arcFraction: 0.35, piece: "A", moveFraction: 0.5 });
  check("[S5-6] 1차 적용 성공(전제)", r1.status === "applied", r1.status);
  const ctx2 = moveContext(engine, "front", dims);
  const cut2 = resolveCutRecipe(engine, "front", ctx2, { type: "side-seam", arcFraction: 0.45 });
  const split2 = engine.splitBakedOutline(ctx2.segs, cut2.point, cut2.segIndex, ctx2.pivot);
  const rot2 = split2.pieceB, fix2 = split2.pieceA;
  const budget2 = budgetRadOf(engine, "front", dims);
  const cand2 = engine.prepareDartMoveCandidate({
    pivot: ctx2.pivot, budgetRad: budget2, rawBaseAngleRad: budget2,
    cutPoint: cut2.point, rotatePiece: rot2, fixedPiece: fix2,
    prevBakedSegments: engine.dartMoveState.appliedFront?.bakedSegments,
  });
  if (cand2.valid) {
    const res2 = engine.resolveRequestedAngle(cand2.evalCtx, cand2.closeAngleRad * 0.5, cand2.closeAngleRad);
    Object.assign(engine.dartMoveState, {
      active: true, side: "front", mode: "drag", cutPoint: cut2.point, cutSegIndex: cut2.segIndex,
      baseAngle: cand2.closeAngleRad, evalCtx: cand2.evalCtx,
      userAngle: res2.resolvedAngleRad, evaluation: res2.evaluation,
    });
    const s = snapOf(context);
    check("[S5-6] sourceNotch: viaSourceNotch=true", s.viaSourceNotch === true);
    check("[S5-6] sourceNotch: 소스 다트각(이동 전 확정값) 숫자",
      typeof s.sourceApertureBeforeRad === "number", s.sourceApertureBeforeRad);
    // 잔여/이동된 각은 휴리스틱이라 스냅샷에 없어야 한다(FORBIDDEN 계약).
    check("[S5-6] sourceNotch: 잔여/이동된 각 키 미노출",
      !("sourceApertureAfterRad" in s) && !("newNotchRad" in s), Object.keys(s));
  } else {
    check("[S5-6] sourceNotch 후보 준비", false, "candidate invalid: " + cand2.reason);
  }
}

// [S5-7] invalid evaluation → reasons 복사  [S5-10] 반환 배열 변형이 엔진에 무영향
{
  const { engine, context } = setupReuse();
  engine.dartMoveState.evaluation = {
    angleRad: engine.dartMoveState.userAngle, valid: false, reasons: ["self-intersection", "budget-exceeded"],
    shape: engine.dartMoveState.evaluation.shape, metrics: engine.dartMoveState.evaluation.metrics,
  };
  const s = snapOf(context);
  check("[S5-7] invalid: valid=false", s.valid === false, s.valid);
  check("[S5-7] invalid: reasons 전달", eq(s.reasons, ["self-intersection", "budget-exceeded"]), s.reasons);
  // 반환 배열을 변형해도 엔진 원본은 그대로
  const mutated = JSON.parse(vm.runInContext(`(function(){
    var a = getDartMoveUiSnapshot(); a.reasons.push("__mutated__"); a.userAngleRad = 999;
    var b = getDartMoveUiSnapshot();
    return JSON.stringify({ engineReasons: dartMoveState.evaluation.reasons,
                            bReasons: b.reasons, bUser: b.userAngleRad });
  })()`, context));
  check("[S5-10] reasons 변형 → 엔진 원본 무영향",
    eq(mutated.engineReasons, ["self-intersection", "budget-exceeded"]), mutated.engineReasons);
  check("[S5-11] 스냅샷 변형 후 재조회 정상", eq(mutated.bReasons, ["self-intersection", "budget-exceeded"])
    && Math.abs(mutated.bUser - engine.dartMoveState.userAngle) < 1e-12, [mutated.bReasons, mutated.bUser]);
}

// [S5-8] apply / reset / cancel 후 초기화
{
  for (const call of ["applyDartMove()", "resetDartMove()", "cancelDartMove()"]) {
    const { engine, context } = setupReuse();
    try { vm.runInContext(call, context); } catch (e) { /* 거부되어도 상태 계약만 본다 */ }
    const s = snapOf(context);
    const cleared = s.stepKey === "idle" && s.side === null && s.maxReachableRad === null
      && s.budgetRad === null && s.valid === null && s.reasons.length === 0 && s.openWidthCm === null;
    check(`[S5-8] ${call} 후 스냅샷 초기화`, cleared, s);
    void engine;
  }
}

// [S5-13] getter 호출이 bake/normalize/evaluateEndpoint 를 추가로 부르지 않음
{
  const { engine, context } = setupReuse();
  instrumentBN(context);
  vm.runInContext(`
    globalThis.__ev = 0;
    var _e = evaluateEndpoint; evaluateEndpoint = function (...a) { __ev++; return _e(...a); };
  `, context);
  const before = readBN(context);
  const evBefore = JSON.parse(vm.runInContext("JSON.stringify(__ev)", context));
  for (let i = 0; i < 5; i++) snapOf(context);
  const after = readBN(context);
  const evAfter = JSON.parse(vm.runInContext("JSON.stringify(__ev)", context));
  check("[S5-13] getter 5회 호출 → bake 증가 0", after.bake === before.bake, [before.bake, after.bake]);
  check("[S5-13] getter 5회 호출 → normalize 증가 0", after.normalize === before.normalize, [before.normalize, after.normalize]);
  check("[S5-13] getter 5회 호출 → evaluateEndpoint 증가 0", evAfter === evBefore, [evBefore, evAfter]);
  void engine;
}
console.log(`  [S5-1~4] idle/start/selectCut/selectPiece 단계 값`);
console.log(`  [S5-5,6] gen-0(source=null) / sourceNotch(소스·잔여·이동된 각)`);
console.log(`  [S5-7,10,11] invalid reasons 복사 · 변형 무영향`);
console.log(`  [S5-8] apply/reset/cancel 후 초기화  [S5-9] 금지 키 미노출`);
console.log(`  [S5-12,14] 단위 rad/cm · openWidthCm=dartOpenWidth  [S5-13] bake/normalize/evaluate 추가 호출 0`);

console.log(`\n══════════════════════════════════════════════`);
console.log(`결과: ${pass} PASS / ${fail} FAIL`);
if (fail > 0) {
  console.log("실패 목록:");
  failures.forEach(f => console.log(" -", f.label, JSON.stringify(f.detail)));
  process.exitCode = 1;
}
