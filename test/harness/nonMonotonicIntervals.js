// ══════════════════════════════════════════════
// 비단조 안전구간 회귀 픽스처 — 순서 ③(evaluateMove 4계층)의 핵심 안전망.
//
// **왜 이 파일이 존재하는가**: 안전구간은 단조롭지 않다. 낮은 각도에서 valid,
// 중간에서 invalid, 더 큰 각도에서 다시 valid가 될 수 있다. 그래서 "최대 안전각
// 하나"나 단순 이분탐색으로는 안 되고 `findApplicableIntervals`가 **구간 목록**을
// 반환해야 한다. 이 파일이 그 필요성을 현재 엔진에서 실측으로 못 박는다.
//
// **과거 사례에 대하여**: CLAUDE.md에 기록된 0.752°/18.06° 사례는 현재 sourceNotch
// 엔진과 조사한 1956개 시나리오에서는 재현되지 않았다. 과거 부호 선택 경로
// (chooseSignedBaseAngle/calc*CloseAngleByRotateHit 계보)에 종속된 사례로 판단하며,
// 현재 엔진에서 재현된 비단조 사례 3건으로 회귀 픽스처를 교체한다.
//
// **계층 계약 준수**: oracle은 확정된 경계를 지킨다 —
//   ② sweepLimit = findRotationCollisions의 "경로" 스캔 (0→θ 첫 충돌 전까지)
//   ① endpoint   = piece-collision 제외. selfX 델타 + budget만.
//   ③           = ②의 한계 내부에서만 ①을 스캔
// oracle은 미래의 findApplicableIntervals를 호출하지 않는 독립 검증기다.
//
// **⚠️ 안전 원칙 (C7에서도 유지)**: 케이스2/3의 금지구간은 0.049°로 60스텝 간격
// (0.162°)보다 3.3배 좁다 — 60스텝이 잡은 건 샘플이 우연히 안에 떨어져서지 보장이
// 아니다. 격자 스캔은 원리적으로 스텝보다 좁은 구간을 보장 탐지할 수 없다.
// 따라서 `findApplicableIntervals`는 편의상 구간을 제공할 뿐 **최종 안전 판정
// 기관이 될 수 없다**. 반드시:
//     resolved angle → evaluateEndpoint(ctx, resolvedAngle) → ev.valid → preview/commit
// 순서를 유지한다. 스캔이 좁은 금지구간을 놓쳐도 정확한 요청각의 evaluateEndpoint가
// 마지막에 잡아야 한다. 이 단일 실제 차단은 C7에서도 제거 금지.
//
// 실행:
//   node test/harness/nonMonotonicIntervals.js              # 60스텝 + 경계 이분탐색
//   node test/harness/nonMonotonicIntervals.js --oracle800  # 800스텝 고해상도 진실값 재확인
//   node test/harness/nonMonotonicIntervals.js --update      # 골든 갱신
// ══════════════════════════════════════════════
const path = require("path");
const { createEngine } = require("./loadEngine");
const { applyRecipe, moveContext, resolveCutRecipe, budgetRadOf } = require("./dartDriver");
const { GoldenFile } = require("./goldenSnapshot");

const golden = new GoldenFile(path.join(__dirname, "golden", "nonmonotonic.json"));
const RUN_ORACLE_800 = process.argv.includes("--oracle800");

let pass = 0, fail = 0;
const failures = [];
function check(label, cond, detail) {
  if (cond) { pass++; }
  else { fail++; failures.push({ label, detail }); console.error("  ✗ FAIL:", label, detail ?? ""); }
}

const B = 83, W = 64, BL = 38, dims = { B, W, BL };
const D = (r) => r * 180 / Math.PI;
const R = (d) => d * Math.PI / 180;
const SCAN_STEPS = 60;      // 프로덕션 ③가 쓸 값과 동일 — 40은 케이스2/3을 놓친다(실측)
const BOUNDARY_BISECT = 18;
const BOUNDARY_TOL_DEG = 0.1;

const cleanForBake = (segs) => (segs || []).filter(s =>
  s?.from && s?.to && s.type !== "dart-leg" && s.type !== "dart-bridge");

// 세 케이스 전부 같은 레시피에서 나온다 — 조각/부호만 다르다.
const BASE_RECIPE = { gen0: { type: "front-armhole-lower", arcFraction: 0.5, piece: "B", moveFraction: 0.5 },
                      cut2: { type: "front-armhole-lower", arcFraction: 0.65 } };

function setupCase(piece) {
  const { engine } = createEngine();
  const r0 = applyRecipe(engine, "front", dims, BASE_RECIPE.gen0);
  if (r0.status !== "applied") throw new Error("baseline 생성 실패: " + r0.status);
  const ctx = moveContext(engine, "front", dims);
  const cut = resolveCutRecipe(engine, "front", ctx, BASE_RECIPE.cut2);
  const split = engine.splitBakedOutline(ctx.segs, cut.point, cut.segIndex, ctx.pivot);
  const rot = piece === "A" ? split.pieceA : split.pieceB;
  const fix = piece === "A" ? split.pieceB : split.pieceA;
  const prevBaked = engine.dartMoveState.appliedFront.bakedSegments;
  return {
    engine, pivot: ctx.pivot,
    fc: cleanForBake(fix.segsFull || fix.segs),
    rc: cleanForBake(rot.segs),
    budgetRad: budgetRadOf(engine, "front", dims),
    prevBaked,
    cross0: engine.findSelfIntersections(prevBaked, ctx.pivot).length,
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

for (const c of CASES) {
  console.log(`\n── ${c.name} — ${c.role} ──`);
  const s = setupCase(c.piece);

  // 1층: 고정 대표 각도 유효성 패턴 (싸고 결정적 — 스캔 해상도와 무관)
  for (const rep of c.representative) {
    const got = endpointValid(s, c.sign * R(rep.deg));
    check(`${c.name}: ${rep.deg}° = ${rep.valid ? "valid" : "invalid"}`, got === rep.valid, { got });
  }

  // 2층: 60스텝 스캔 + 경계 이분탐색
  const lim = sweepLimitMag(s, c.sign);
  const iv = scanIntervals(s, c.sign, lim, SCAN_STEPS);
  check(`${c.name}: 구간 2개 (비단조 확인)`, iv.length === 2,
    { got: iv.length, iv: iv.map(x => `${D(x[0]).toFixed(3)}~${D(x[1]).toFixed(3)}`) });

  if (iv.length === 2) {
    const gotB = [D(iv[0][1]), D(iv[1][0])];
    check(`${c.name}: 구간1 상단 ≈ ${c.boundaries[0]}° (±${BOUNDARY_TOL_DEG})`,
      Math.abs(gotB[0] - c.boundaries[0]) <= BOUNDARY_TOL_DEG, { expected: c.boundaries[0], got: +gotB[0].toFixed(4) });
    check(`${c.name}: 구간2 하단 ≈ ${c.boundaries[1]}° (±${BOUNDARY_TOL_DEG})`,
      Math.abs(gotB[1] - c.boundaries[1]) <= BOUNDARY_TOL_DEG, { expected: c.boundaries[1], got: +gotB[1].toFixed(4) });
    console.log(`    sweepLimit=${D(lim).toFixed(3)}° 구간: ${iv.map(x=>`${D(x[0]).toFixed(3)}~${D(x[1]).toFixed(3)}`).join("  ")}  금지폭=${(gotB[1]-gotB[0]).toFixed(4)}°`);
  }

  // 골든: 구간 경계(도, 소수 3자리)
  const snap = { intervalsDeg: iv.map(x => [+D(x[0]).toFixed(3), +D(x[1]).toFixed(3)]),
                 sweepLimitDeg: +D(lim).toFixed(3) };
  const g = golden.check(c.name, snap);
  check(`${c.name}: 골든 일치`, g.length === 0, g.length ? g.slice(0, 4) : undefined);

  // 선택 실행: 800스텝 고해상도 oracle로 진실값 재확인 (상시 스위트에선 생략 — 비용)
  if (RUN_ORACLE_800) {
    const truth = scanIntervals(s, c.sign, lim, 800);
    check(`${c.name}: [--oracle800] 800스텝도 2구간`, truth.length === 2, { got: truth.length });
    if (truth.length === 2) {
      console.log(`    800스텝 진실값: ${truth.map(x=>`${D(x[0]).toFixed(4)}~${D(x[1]).toFixed(4)}`).join("  ")}`);
      check(`${c.name}: [--oracle800] 60스텝 경계가 진실값과 ±${BOUNDARY_TOL_DEG}° 이내`,
        Math.abs(D(iv[0][1]) - D(truth[0][1])) <= BOUNDARY_TOL_DEG &&
        Math.abs(D(iv[1][0]) - D(truth[1][0])) <= BOUNDARY_TOL_DEG,
        { scan60: [+D(iv[0][1]).toFixed(4), +D(iv[1][0]).toFixed(4)],
          truth800: [+D(truth[0][1]).toFixed(4), +D(truth[1][0]).toFixed(4)] });
    }
  }
}

// ══════════════════════════════════════════════
// 계층 분리 실증 (C2) — "endpoint는 유효한데 물리 스윕이 먼저 막히는" 실제 사례.
//
// ①(evaluateEndpoint)과 ②(findPhysicalSweepLimit)를 왜 분리해야 하는지의 증거다.
// endpoint 유효성만 보면 9.12°까지 허용되지만, 회전 조각이 그 경로를 실제로 지나갈
// 수 없다(leg barrier가 8.85°에서 막는다). ③이 ②의 한계 내부에서만 스캔해야 하는
// 이유이기도 하다.
//
// 512건 조사(앞판 × gen-0/1다트/2다트/비단조setup × 컷 8종 × 양쪽 부호 × 요청각 4단계)
// 에서 이 조건을 만족한 유일한 사례다.
// ══════════════════════════════════════════════
{
  console.log(`\n── 계층 분리 실증 (endpoint valid + sweepLimit < requested) ──`);
  // 위 비단조 케이스와 **같은 레시피**다(BASE_RECIPE) — 케이스1(piece A, sign +)의
  // 요청각 절반 지점에서 leg barrier가 endpoint보다 먼저 막는다.
  const { engine } = createEngine();
  const r0 = applyRecipe(engine, "front", dims, BASE_RECIPE.gen0);
  check("분리사례: setup applied", r0.status === "applied", r0.status);
  if (r0.status === "applied") {
    const ctx = moveContext(engine, "front", dims);
    const cut = resolveCutRecipe(engine, "front", ctx, BASE_RECIPE.cut2);
    const split = engine.splitBakedOutline(ctx.segs, cut.point, cut.segIndex, ctx.pivot);
    const rot = split.pieceA, fix = split.pieceB;
    const budgetRad = budgetRadOf(engine, "front", dims);
    const prevBaked = engine.dartMoveState.appliedFront.bakedSegments;
    const requested = budgetRad * 0.5;   // +9.12°

    const ev = engine.evaluateEndpoint({
      fixedSegs: fix.segsFull || fix.segs, rotateSegs: rot.segs, pivot: ctx.pivot,
      budgetRad, prevBakedSegments: prevBaked, sourceNotch: rot.sourceNotch || null,
    }, requested);
    const sweep = engine.findPhysicalSweepLimit(fix.segsFull || fix.segs, rot.segs, ctx.pivot, requested, cut.point);

    check("분리사례: endpoint(9.12°)는 valid", ev.valid === true, { reasons: ev.reasons });
    check("분리사례: sweepLimit < requested (물리 스윕이 먼저 막음)",
      Math.abs(sweep.limitRad) < Math.abs(requested) - 1e-6,
      { requestedDeg: +D(requested).toFixed(3), limitDeg: +D(sweep.limitRad).toFixed(3) });
    check("분리사례: blockedBy = 'leg-barrier'", sweep.blockedBy === "leg-barrier", sweep.blockedBy);
    console.log(`    requested=${D(requested).toFixed(3)}° endpoint=valid | sweepLimit=${D(sweep.limitRad).toFixed(3)}° blockedBy=${sweep.blockedBy}`);

    const snap = { requestedDeg: +D(requested).toFixed(3), endpointValid: ev.valid,
      sweepLimitDeg: +D(sweep.limitRad).toFixed(3), blockedBy: sweep.blockedBy };
    const g = golden.check("layer_separation_legBarrier", snap);
    check("분리사례: 골든 일치", g.length === 0, g.length ? g.slice(0, 3) : undefined);
  }
}

// ══════════════════════════════════════════════
if (golden.update) {
  const reason = process.argv.slice(2).filter(a => !a.startsWith("--")).join(" ") || "non-monotonic interval baseline (current sourceNotch engine)";
  golden.save(reason);
  console.log(`\n[golden] ${golden.filePath} 갱신 (사유: ${reason})`);
}
console.log(`\n══════════════════════════════════════════════`);
console.log(`결과: ${pass} PASS / ${fail} FAIL${golden.update ? "  (--update 모드)" : ""}${RUN_ORACLE_800 ? "  (--oracle800 포함)" : ""}`);
if (fail > 0) {
  console.log("실패 목록:");
  failures.forEach(f => console.log(" -", f.label, JSON.stringify(f.detail)));
  process.exitCode = 1;
}
