// ══════════════════════════════════════════════
// 비단조 안전구간 픽스처 — C0가 확정한 케이스 정의 + **독립 oracle**.
//
// **왜 별도 모듈인가**: 이 케이스와 oracle을 두 스위트가 쓴다 —
//   - `nonMonotonicIntervals.js` (C0): 현재 엔진에 비단조가 실재함을 못 박는다.
//   - `applicableIntervals.js`  (C3): 프로덕션 `findApplicableIntervals`를 이 oracle과 대조한다.
// 양쪽에 복제하면 한쪽만 고쳐도 조용히 어긋난다(순서 ②의 `prepareDartMoveCandidate`
// 추출과 같은 이유). 상수·oracle의 단일 출처는 이 파일이다.
//
// **⚠️ oracle은 프로덕션을 호출하지 않는 독립 검증기다.** 여기 있는 scanIntervals/
// endpointValid/sweepLimitMag는 `findApplicableIntervals`·`evaluateEndpoint`·
// `findPhysicalSweepLimit`를 쓰지 않고 bake/normalize/교차 검사만으로 진실값을 만든다.
// 프로덕션이 이 파일을 import하는 것도 금지다 — 그러면 "독립"이 아니라 같은 코드를
// 두 번 부르는 것이라 검증이 아니다.
//
// **계층 계약 준수**(확정된 경계):
//   ② sweepLimit = findRotationCollisions의 "경로" 스캔 (0→θ 첫 충돌 전까지)
//   ① endpoint   = piece-collision 제외. selfX 델타 + budget만.
//   ③           = ②의 한계 내부에서만 ①을 스캔
// ══════════════════════════════════════════════
const { createEngine } = require("./loadEngine");
const { applyRecipe, moveContext, resolveCutRecipe, budgetRadOf } = require("./dartDriver");

const B = 83, W = 64, BL = 38;
const dims = { B, W, BL };

const SCAN_STEPS = 60;      // 프로덕션 ③가 쓸 값과 동일 — 40은 케이스2/3을 놓친다(실측)
const BOUNDARY_BISECT = 18;
const BOUNDARY_TOL_DEG = 0.1;

const D = (r) => r * 180 / Math.PI;
const R = (d) => d * Math.PI / 180;

const cleanForBake = (segs) => (segs || []).filter(s =>
  s?.from && s?.to && s.type !== "dart-leg" && s.type !== "dart-bridge");

// 세 케이스 전부 같은 레시피에서 나온다 — 조각/부호만 다르다.
const BASE_RECIPE = { gen0: { type: "front-armhole-lower", arcFraction: 0.5, piece: "B", moveFraction: 0.5 },
                      cut2: { type: "front-armhole-lower", arcFraction: 0.65 } };

// ══════════════════════════════════════════════
// 케이스 정의 — 진실값은 C0 구축 시 800스텝+이분탐색으로 확정했다.
// 케이스 2와 3은 같은 parameterized 테스트로 돈다(조각 선택 대칭만 다름) — 구현 복제 금지.
// ══════════════════════════════════════════════
const CASES = [
  { name: "case1_pieceA_signPos", piece: "A", sign: +1,
    role: "주 회귀 사례 (넓은 금지구간)",
    representative: [{ deg: 5, valid: true }, { deg: 9.25, valid: false }, { deg: 10, valid: true }],
    boundaries: [9.143, 9.376] },
  { name: "case2_pieceA_signNeg", piece: "A", sign: -1,
    role: "좁은 금지구간 사례 (0.049° — 60스텝 간격보다 3.3× 좁음)",
    representative: [{ deg: 0.30, valid: true }, { deg: 0.33, valid: false }, { deg: 0.36, valid: true }],
    boundaries: [0.304, 0.353] },
  { name: "case3_pieceB_signPos", piece: "B", sign: +1,
    role: "케이스2의 조각 선택 대칭 (같은 parameterized 테스트)",
    representative: [{ deg: 0.30, valid: true }, { deg: 0.33, valid: false }, { deg: 0.36, valid: true }],
    boundaries: [0.304, 0.353] },
];

function setupCase(piece) {
  const { engine, context } = createEngine();
  const r0 = applyRecipe(engine, "front", dims, BASE_RECIPE.gen0);
  if (r0.status !== "applied") throw new Error("baseline 생성 실패: " + r0.status);
  const ctx = moveContext(engine, "front", dims);
  const cut = resolveCutRecipe(engine, "front", ctx, BASE_RECIPE.cut2);
  const split = engine.splitBakedOutline(ctx.segs, cut.point, cut.segIndex, ctx.pivot);
  const rot = piece === "A" ? split.pieceA : split.pieceB;
  const fix = piece === "A" ? split.pieceB : split.pieceA;
  const prevBaked = engine.dartMoveState.appliedFront.bakedSegments;
  return {
    engine, context, pivot: ctx.pivot,
    fc: cleanForBake(fix.segsFull || fix.segs),
    rc: cleanForBake(rot.segs),
    budgetRad: budgetRadOf(engine, "front", dims),
    prevBaked,
    cross0: engine.findSelfIntersections(prevBaked, ctx.pivot).length,
    // C3가 프로덕션 ①/②/③에 넘길 컨텍스트. oracle은 이걸 쓰지 않는다.
    rawFixedSegs: fix.segsFull || fix.segs,
    rawRotateSegs: rot.segs,
    sourceNotch: rot.sourceNotch || null,
    cutPoint: cut.point,
  };
}

// ── ② 스윕 물리 한계: 경로상 첫 조각 충돌 직전까지 ──
function sweepLimitMag(s, sign, steps = 120) {
  let lastSafe = 0;
  for (let i = 1; i <= steps; i++) {
    const mag = s.budgetRad * (i / steps);
    if (s.engine.findRotationCollisions(s.fc, s.rc, s.pivot, sign * mag).length > 0) return lastSafe;
    lastSafe = mag;
  }
  return s.budgetRad;
}

// ── ① endpoint: piece-collision 제외(그건 ②의 책임). selfX 델타 + budget만 ──
function endpointValid(s, angle) {
  const baked = s.engine.normalizeBakedSegments(
    s.engine.bakeFromSplitPieces({ fixedSegs: s.fc, rotateSegs: s.rc, pivot: s.pivot, angle }), s.pivot);
  if (s.engine.findSelfIntersections(baked, s.pivot).length > s.cross0) return false;
  const used = s.engine.sumOpenDartAngle(baked, s.pivot);
  if (s.budgetRad > 1e-6 && used > s.budgetRad * s.engine.DART_BUDGET_TOL) return false;
  return true;
}

// ── ③ 격자 스캔 → 구간. 경계는 이분탐색으로 정밀화(생스캔 경계는 오차 0.15°까지 난다) ──
function scanIntervals(s, sign, limMag, steps) {
  const grid = [];
  for (let i = 0; i <= steps; i++) {
    const mag = limMag * (i / steps);
    grid.push({ mag, v: endpointValid(s, sign * mag) });
  }
  const refineRise = (loInvalid, hiValid) => { // invalid→valid 경계
    for (let i = 0; i < BOUNDARY_BISECT; i++) { const m = (loInvalid + hiValid) / 2; if (endpointValid(s, sign * m)) hiValid = m; else loInvalid = m; }
    return hiValid;
  };
  const refineFall = (loValid, hiInvalid) => { // valid→invalid 경계
    for (let i = 0; i < BOUNDARY_BISECT; i++) { const m = (loValid + hiInvalid) / 2; if (endpointValid(s, sign * m)) loValid = m; else hiInvalid = m; }
    return loValid;
  };
  const iv = []; let start = null;
  for (let i = 0; i < grid.length; i++) {
    if (grid[i].v && start === null) start = (i === 0) ? 0 : refineRise(grid[i - 1].mag, grid[i].mag);
    if (!grid[i].v && start !== null) { iv.push([start, refineFall(grid[i - 1].mag, grid[i].mag)]); start = null; }
  }
  if (start !== null) iv.push([start, grid[grid.length - 1].mag]);
  return iv;
}

module.exports = {
  B, W, BL, dims, D, R, cleanForBake,
  SCAN_STEPS, BOUNDARY_BISECT, BOUNDARY_TOL_DEG,
  BASE_RECIPE, CASES,
  setupCase, sweepLimitMag, endpointValid, scanIntervals,
};
