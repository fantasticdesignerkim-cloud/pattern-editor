// ══════════════════════════════════════════════
// 다트이동 "클릭 한 번"을 헤드리스로 재현하는 드라이버.
//
// DOM 이벤트 없이 selectPiece → 드래그 → 적용 경로를 재현한다. 판단(각도/충돌/예산)은
// 전부 프로덕션 함수를 그대로 호출해서 얻는다.
//
// **각도 결정 오케스트레이션은 복제가 아니라 공유다** (2026-07 추출 이후):
// `engine.prepareDartMoveCandidate()`를 UI(initDartMoveClickHandler)와 이 드라이버가
// 함께 호출한다. 예전엔 그 호출 순서/분기가 여기에 손으로 복제돼 있어, 클릭 핸들러가
// 바뀌면 테스트가 계속 통과하면서도 더 이상 실제 앱 경로를 대표하지 못하는 위험이
// 있었다 — 이제 구조적으로 불가능하다.
//
// 이 파일에 남은 책임은 순수한 배선뿐이다: 컷 위치 선택(무작위/시맨틱 레시피),
// split 호출, 조각 선택, dartMoveState 세팅 후 applyDartMove 호출.
// ══════════════════════════════════════════════

function lerp(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

// 현재 outline에서 클릭 가능한 세그먼트 인덱스 목록.
function clickableIndices(engine, segs) {
  const out = [];
  segs.forEach((s, i) => { if (engine.isClickableSeg(s)) out.push(i); });
  return out;
}

// 특정 세그먼트 인덱스 후보들 중 하나에서 무작위 지점을 뽑아 findCutPoint(Back)까지
// 통과하는 cutPoint를 찾는다. attempts회 시도해도 못 찾으면 null.
function pickCutPoint(engine, side, segs, d, B, rng, candidateIndices, attempts = 20) {
  for (let i = 0; i < attempts; i++) {
    const idx = candidateIndices[Math.floor(rng() * candidateIndices.length)];
    const seg = segs[idx];
    const t = 0.15 + rng() * 0.7; // 끝점 근처(다트 끝점 차단 반경) 회피
    const pt = lerp(seg.from, seg.to, t);
    const result = side === "back"
      ? engine.findCutPointBack(pt, segs, d.pts, d.formula, B)
      : engine.findCutPoint(pt, segs, d.pts);
    if (result && !result.blocked) return result;
  }
  return null;
}

// dartMoveState.appliedFront/Back의 bakedSegments 안에서 "열린 notch"(다트 입구)
// 목록을 pivot 기준으로 나열한다 — "가장 오래된 다트를 다시 겨냥" 테스트용으로,
// 어떤 세그먼트를 클릭하면 그 notch에 도달하는지 찾는 데 쓴다.
function listOpenNotches(engine, segs, pivot) {
  const isOpenLeg = (s) => s?.type === "dart-leg-new" || s?.type === "dart-leg-old";
  const isPivotPt = (pt) => pt && Math.hypot(pt.x - pivot.x, pt.y - pivot.y) < 1e-3;
  const notches = [];
  for (let i = 0; i < segs.length; i++) {
    const a = segs[i], b = segs[(i + 1) % segs.length];
    if (isOpenLeg(a) && isOpenLeg(b) && isPivotPt(a.to) && isPivotPt(b.from)) {
      notches.push({ legIdxA: i, legIdxB: (i + 1) % segs.length, mouthA: a.from, mouthB: b.to });
    }
  }
  return notches;
}

// ── 이동 컨텍스트: draft/pivot/outline/baked여부를 한 번에 만든다 ──
function moveContext(engine, side, dims) {
  const { B, W, BL } = dims;
  const d = engine.createDraft(B, W, BL);
  const pivot = side === "back" ? d.pts.E : d.pts.BP;
  const segs = side === "back"
    ? engine.getBackTargetOutline(d.pts, d.formula, B)
    : engine.getFrontTargetOutline(d.pts, d.formula, B);
  const isBaked = side === "back"
    ? !!engine.dartMoveState.appliedBack?.bakedSegments
    : !!engine.dartMoveState.appliedFront?.bakedSegments;
  return { B, W, BL, d, pivot, segs, isBaked };
}

/**
 * 다트이동 오케스트레이션의 단일 코어. cut(={point,segIndex})이 이미 정해진 상태에서
 * split → 조각선택 → closeAngle 결정 → applyDartMove까지 수행한다.
 *
 * closeAngle 결정은 **프로덕션과 같은 함수**(`engine.prepareDartMoveCandidate`)를
 * 호출한다 — 예전엔 그 오케스트레이션이 여기에 복제돼 있어 dartMove.js와 조용히
 * 어긋날 수 있었지만(2026-07 추출로 해소), 이제 UI(initDartMoveClickHandler)와
 * 이 하네스가 같은 코드를 공유하므로 하네스가 실제 앱 경로를 대표한다는 게
 * 구조적으로 보장된다.
 */
function performMove(engine, side, dims, ctx, cut, pieceChoice, fraction, rng) {
  const { B, d, pivot, segs, isBaked } = ctx;

  const split = isBaked
    ? engine.splitBakedOutline(segs, cut.point, cut.segIndex, pivot)
    : side === "back"
      ? engine.splitBackOutline(segs, cut.point, cut.segIndex, d.pts, d.formula, B)
      : engine.splitFrontOutline(segs, cut.point, cut.segIndex, d.pts, B);

  if (!split.pieceA || !split.pieceB) return { status: "no-split" };

  let chosen;
  if (pieceChoice === "A" || pieceChoice === "B") chosen = pieceChoice;
  else if (typeof pieceChoice === "function") chosen = pieceChoice(split.pieceA, split.pieceB, rng);
  else chosen = (rng ? rng() : Math.random()) < 0.5 ? "A" : "B";

  const rotatePiece = chosen === "A" ? split.pieceA : split.pieceB;
  const fixedPiece  = chosen === "A" ? split.pieceB : split.pieceA;
  if (!(rotatePiece.pts && rotatePiece.pts.length >= 3)) return { status: "degenerate-piece" };

  const rotateSegs = rotatePiece.segs;
  const fixedSegs  = fixedPiece.segsFull || fixedPiece.segs;
  // calc*BaseDartAngle은 Math.abs()를 반환 — 예산과 gen-0 시작각이 같은 값이지만
  // 역할이 달라 prepareDartMoveCandidate에 각각의 이름으로 전달한다(UI와 동일).
  const baseDartAngle = side === "back"
    ? engine.calcBackBaseDartAngle(engine.buildBackShoulderDartInfo(d.formula, d.pts, B))
    : engine.calcFrontBaseDartAngle(d.pts, B);
  const prevBaked = side === "back"
    ? engine.dartMoveState.appliedBack?.bakedSegments
    : engine.dartMoveState.appliedFront?.bakedSegments;

  // ── closeAngle 결정: UI와 공유하는 프로덕션 순수 함수 (복제 없음) ──
  const candidate = engine.prepareDartMoveCandidate({
    pivot,
    budgetRad: Math.abs(baseDartAngle),
    rawBaseAngleRad: baseDartAngle,
    cutPoint: cut.point,
    rotatePiece, fixedPiece,
    prevBakedSegments: prevBaked,
  });
  const closeAngle = candidate.closeAngleRad;
  const viaSourceNotch = !!candidate.sourceNotch;

  if (!candidate.valid) {
    return { status: "no-room", sourceNotch: viaSourceNotch, chosen, reason: candidate.reason };
  }

  const sourceApertureBefore = candidate.sourceApertureBeforeRad;

  // ── 실제 applyDartMove()를 그대로 호출 (bake/normalize/충돌게이트/예산게이트 전부 real code) ──
  engine.dartMoveState.side        = side;
  engine.dartMoveState.cutPoint    = cut.point;
  engine.dartMoveState.cutSegIndex = cut.segIndex;
  engine.dartMoveState.rotatePts   = rotatePiece.pts;
  engine.dartMoveState.fixedPts    = fixedPiece.pts;
  engine.dartMoveState.rotateSegs  = rotateSegs;
  engine.dartMoveState.fixedSegs   = fixedSegs;
  engine.dartMoveState.rotateHit   = rotatePiece.hit;
  engine.dartMoveState.fixedHit    = fixedPiece.hit;
  engine.dartMoveState.mode        = "drag";
  engine.dartMoveState.baseAngle   = closeAngle;
  engine.dartMoveState.userAngle   = closeAngle * fraction;

  engine.applyDartMove();

  const applied = engine.dartMoveState.mode === "idle" && engine.dartMoveState.cutPoint === null;
  if (!applied) {
    return { status: "blocked", chosen, closeAngleDeg: closeAngle * 180 / Math.PI, sourceNotch: viaSourceNotch };
  }

  const bakedSegments = side === "back"
    ? engine.dartMoveState.appliedBack.bakedSegments
    : engine.dartMoveState.appliedFront.bakedSegments;

  return {
    status: "applied",
    chosen, viaSourceNotch,
    fraction,
    userAngleDeg: closeAngle * fraction * 180 / Math.PI,
    baseAngleDeg: closeAngle * 180 / Math.PI,
    sourceApertureBeforeDeg: sourceApertureBefore != null ? sourceApertureBefore * 180 / Math.PI : null,
    bakedSegments,
    pivot,
  };
}

/**
 * 뒤판 또는 앞판 다트이동 한 번을 무작위 컷으로 시도한다(스트레스용).
 *
 * @param {object} engine  loadEngine.createEngine().engine
 * @param {"front"|"back"} side
 * @param {{B:number,W:number,BL:number}} dims
 * @param {number} fraction  0~1, baseAngle 대비 실제 적용할 비율(중간각 테스트용)
 * @param {"A"|"B"|function} pieceChoice  'A'|'B' 고정, 또는 (pieceA,pieceB)=>chosen 함수
 * @param {function} rng  0~1 난수 생성기 (재현 가능한 시드용)
 * @param {{forceSegIndices?: number[]}} opts  후보 세그먼트 인덱스를 특정 영역으로 제한
 * @returns {{status:string, [key:string]:any}}
 */
function attemptDartMove(engine, side, dims, fraction, pieceChoice, rng, opts = {}) {
  const ctx = moveContext(engine, side, dims);
  const candidates = opts.forceSegIndices || clickableIndices(engine, ctx.segs);
  if (candidates.length === 0) return { status: "no-candidates" };
  const cut = pickCutPoint(engine, side, ctx.segs, ctx.d, ctx.B, rng, candidates);
  if (!cut) return { status: "no-cut-point" };
  return performMove(engine, side, dims, ctx, cut, pieceChoice, fraction, rng);
}

// ── 시맨틱 컷 레시피 ───────────────────────────
// { type, arcFraction, piece, moveFraction }
// type + "연속 구간의 호 길이 비율"로 컷 위치를 찾는다(세그먼트 인덱스·절대좌표 금지).
// 같은 type의 첫 연속 구간(run)을 잡아 그 폴리라인 arcFraction 지점을 계산하고,
// findCutPoint(Back)으로 스냅한다. 탐색 실패(run 없음/차단/스냅 실패)는 예외로 던진다
// (사용자 확정: 탐색 실패 = 테스트 실패).
function findContiguousRun(segs, type) {
  let start = -1;
  for (let i = 0; i < segs.length; i++) {
    if (segs[i].type === type) {
      start = i;
      let end = i;
      while (end + 1 < segs.length && segs[end + 1].type === type) end++;
      return { start, end };
    }
  }
  return null;
}

function pointAtArcFraction(runSegs, frac) {
  const pts = [runSegs[0].from, ...runSegs.map(s => s.to)];
  let total = 0;
  const segLens = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const L = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    segLens.push(L); total += L;
  }
  if (total < 1e-9) return { ...pts[0] };
  let target = Math.max(0, Math.min(1, frac)) * total, acc = 0;
  for (let i = 0; i < segLens.length; i++) {
    if (acc + segLens[i] >= target || i === segLens.length - 1) {
      const t = segLens[i] < 1e-9 ? 0 : (target - acc) / segLens[i];
      return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * t, y: pts[i].y + (pts[i + 1].y - pts[i].y) * t };
    }
    acc += segLens[i];
  }
  return { ...pts[pts.length - 1] };
}

function resolveCutRecipe(engine, side, ctx, recipe) {
  const { segs, d, B } = ctx;
  const run = findContiguousRun(segs, recipe.type);
  if (!run) throw new Error(`resolveCutRecipe: type '${recipe.type}' 연속 구간을 찾을 수 없음`);
  const runSegs = segs.slice(run.start, run.end + 1);
  const pt = pointAtArcFraction(runSegs, recipe.arcFraction);
  const cut = side === "back"
    ? engine.findCutPointBack(pt, segs, d.pts, d.formula, B)
    : engine.findCutPoint(pt, segs, d.pts);
  if (!cut) throw new Error(`resolveCutRecipe: findCutPoint가 null (type=${recipe.type} arcFraction=${recipe.arcFraction})`);
  if (cut.blocked) throw new Error(`resolveCutRecipe: 컷 위치 차단됨 (reason=${cut.reason} type=${recipe.type} arcFraction=${recipe.arcFraction})`);
  return { point: cut.point, segIndex: cut.segIndex };
}

/**
 * 시맨틱 레시피 하나로 다트이동을 결정론적으로 적용한다.
 * @param {{type:string, arcFraction:number, piece:"A"|"B", moveFraction:number}} recipe
 */
function applyRecipe(engine, side, dims, recipe) {
  const ctx = moveContext(engine, side, dims);
  const cut = resolveCutRecipe(engine, side, ctx, recipe); // 실패 시 throw
  return performMove(engine, side, dims, ctx, cut, recipe.piece, recipe.moveFraction, null);
}

// ── 사후 검증 헬퍼 ──────────────────────────────
function countBreaks(segs, eps = 0.05) {
  let breaks = 0;
  for (let i = 0; i < segs.length - 1; i++) {
    const a = segs[i].to, b = segs[i + 1].from;
    const gap = (!a || !b) ? Infinity : Math.hypot(a.x - b.x, a.y - b.y);
    if (gap > eps) breaks++;
  }
  return breaks;
}

function countClosedTraces(engine, segs, pivot) {
  const near = (a, b, eps) => a && b && Math.hypot(a.x - b.x, a.y - b.y) < eps;
  const isDartLeg = (s) => engine.isDartLegType(s);
  let count = 0;
  for (let i = 0; i < segs.length; i++) {
    const a = segs[i], b = segs[(i + 1) % segs.length];
    if (isDartLeg(a) && isDartLeg(b) &&
      near(a.to, pivot, engine.EPS_CLOSED_DART) &&
      near(b.from, pivot, engine.EPS_CLOSED_DART) &&
      near(a.from, b.to, engine.EPS_CLOSED_DART)) {
      count++;
    }
  }
  return count;
}

// budget(기본 다트각) 헬퍼 — 시나리오 파일이 예산 대조 시 재사용.
function budgetRadOf(engine, side, dims) {
  const d = engine.createDraft(dims.B, dims.W, dims.BL);
  return side === "back"
    ? Math.abs(engine.calcBackBaseDartAngle(engine.buildBackShoulderDartInfo(d.formula, d.pts, dims.B)))
    : Math.abs(engine.calcFrontBaseDartAngle(d.pts, dims.B));
}

module.exports = {
  attemptDartMove, applyRecipe, resolveCutRecipe, performMove, moveContext,
  listOpenNotches, countBreaks, countClosedTraces, clickableIndices,
  findContiguousRun, pointAtArcFraction, budgetRadOf,
};
