// ══════════════════════════════════════════════
// 프로덕션 `selectRotationSign` 검증 (C4) — 2층 구조.
//
//  Layer 1 (실제 기하): 현재 도안에서 **실제로 발생하는** 분기를 실제 split/bake로 검증.
//    한쪽 부호만 가능 / 양쪽 다 가능 / sourceNotch 단일 부호 / leg-barrier 제한 /
//    C0 비단조 다중구간 / 최종 exact-angle의 evaluateEndpoint valid.
//
//  Layer 2 (②·③ 스텁): **현재 도안 기하에서는 발생하지 않는** 분기를 결정 규칙만
//    격리해서 검증. 실측 근거: 전 시나리오 × 클릭 가능 세그먼트 전수 × 5지점 × A/B를
//    훑어도 `tie-geometric`과 `no-intervals`는 **0건**이었고, 두 부호의 maxReachable
//    최소 차이는 10.53°(EPS 1e-4rad보다 6자리 크다). 즉 이 두 분기는 "실제 기하로는
//    재현할 수 없지만 코드에는 존재하는 경로"라 스텁으로만 정직하게 덮을 수 있다.
//    ②/③를 vm 컨텍스트에서 갈아끼워 selectRotationSign의 **선택 규칙 자체**만 본다.
//
// **왜 스텁이 정당한가**: Layer 2는 기하를 검증하지 않는다 — "구간 목록이 이렇게 주어졌을
// 때 어느 부호를 고르는가"라는 순수 결정 규칙만 검증한다. 그 규칙은 ②/③의 구현과 무관하게
// 성립해야 하고, 특히 **최대 도달 각도로 고른다(구간 길이 합이 아니다)**는 사용자 확정
// 규칙은 스텁이 아니면 반례를 만들 수조차 없다(실제 기하에서 합↔최대가 뒤집히는 조합이
// 안 나온다).
//
// 실행: node test/harness/rotationSignSelection.js
// ══════════════════════════════════════════════
const vm = require("vm");
const { createEngine } = require("./loadEngine");
const { applyRecipe, moveContext, clickableIndices, budgetRadOf } = require("./dartDriver");
const { setupCase, sweepLimitMag, scanIntervals, SCAN_STEPS, CASES } = require("./nonMonotonicFixture");

let pass = 0, fail = 0;
const failures = [];
function check(label, cond, detail) {
  if (cond) { pass++; }
  else { fail++; failures.push({ label, detail }); console.error("  ✗ FAIL:", label, detail ?? ""); }
}
function section(t) { console.log("\n── " + t + " ──"); }

const B = 83, W = 64, BL = 38, dims = { B, W, BL };
const D = (r) => r * 180 / Math.PI;
const R = (d) => d * Math.PI / 180;
const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

// ── 한 조합을 세팅해 selectRotationSign 입력을 만든다 ──
function buildCase({ side, setup, segIndex, frac, piece }) {
  const { engine } = createEngine();
  let prevBaked = null;
  for (const st of (setup || [])) {
    const r = applyRecipe(engine, side, dims, st);
    if (r.status !== "applied") throw new Error(`setup 실패: ${r.status}`);
    prevBaked = r.bakedSegments;
  }
  const ctx = moveContext(engine, side, dims);
  const seg = ctx.segs[segIndex];
  if (!seg?.from || !seg?.to) throw new Error(`세그먼트 ${segIndex} 없음`);
  const pt = lerp(seg.from, seg.to, frac);
  const cut = side === "back"
    ? engine.findCutPointBack(pt, ctx.segs, ctx.d.pts, ctx.d.formula, B)
    : engine.findCutPoint(pt, ctx.segs, ctx.d.pts);
  if (!cut || cut.blocked) throw new Error(`컷 차단/실패`);
  const split = ctx.isBaked
    ? engine.splitBakedOutline(ctx.segs, cut.point, cut.segIndex, ctx.pivot)
    : (side === "back"
        ? engine.splitBackOutline(ctx.segs, cut.point, cut.segIndex, ctx.d.pts, ctx.d.formula, B)
        : engine.splitFrontOutline(ctx.segs, cut.point, cut.segIndex, ctx.d.pts, B));
  const rot = piece === "A" ? split.pieceA : split.pieceB;
  const fix = piece === "A" ? split.pieceB : split.pieceA;
  const budgetRad = budgetRadOf(engine, side, dims);
  const rawBase = side === "back"
    ? engine.calcBackBaseDartAngle(engine.buildBackShoulderDartInfo(ctx.d.formula, ctx.d.pts, B))
    : engine.calcFrontBaseDartAngle(ctx.d.pts, B);
  const evalCtx = {
    fixedSegs: fix.segsFull || fix.segs, rotateSegs: rot.segs, pivot: ctx.pivot,
    budgetRad, prevBakedSegments: prevBaked, sourceNotch: rot.sourceNotch || null,
  };
  let geomSign = 1;
  if (!rot.sourceNotch && rot.pts?.length >= 3) {
    geomSign = Math.sign(engine.choosePhysicalCloseAngle({
      pivot: ctx.pivot, cutPoint: cut.point, rotatePts: rot.pts, absAngle: rawBase })) || 1;
  }
  const sel = engine.selectRotationSign(evalCtx, { baseMagRad: rawBase, cutPoint: cut.point, geomSign });
  return { engine, evalCtx, sel, segType: seg.type, geomSign };
}

// 선택 결과가 실제로 적용 가능한 각도인지 — ③가 구간을 줬어도 최종 판정은 정확한
// 요청각의 evaluateEndpoint가 한다(C0 안전 원칙: 격자는 스텝보다 좁은 금지구간을
// 보장 탐지 못 한다). 이게 C4의 출력이 실제로 쓸 수 있는 값이라는 증거다.
function checkExactAngleValid(label, engine, evalCtx, sel) {
  if (!(sel.selectedMaxReachableMagRad > 0)) return;
  const ang = sel.selectedSign * sel.selectedMaxReachableMagRad;
  const ev = engine.evaluateEndpoint(evalCtx, ang);
  check(`${label}: 선택각 ${D(ang).toFixed(3)}°의 evaluateEndpoint valid`, ev.valid === true,
    { reasons: ev.reasons });
}

// ══════════════════════════════════════════════
// Layer 1 — 실제 기하
// ══════════════════════════════════════════════
section("Layer 1: 한쪽 부호만 가능 (반대 부호는 구간 0개)");
{
  // 실측 탐색으로 찾은 조합: 반대 부호는 즉시 조각 충돌이라 도달 가능 구간이 없다.
  const c = buildCase({ side: "front", setup: null, segIndex: 15, frac: 0.65, piece: "A" });
  check("한쪽만: 세그먼트 타입 front-armhole-lower", c.segType === "front-armhole-lower", c.segType);
  check("한쪽만: 후보 2개 (gen-0은 양쪽 부호 평가)", c.sel.candidates.length === 2, c.sel.candidates.length);
  const pos = c.sel.candidates.find(x => x.sign === +1);
  const neg = c.sel.candidates.find(x => x.sign === -1);
  check("한쪽만: 한 부호만 도달 가능 구간 보유",
    (pos.maxReachableMagRad > 0) !== (neg.maxReachableMagRad > 0),
    { pos: +D(pos.maxReachableMagRad).toFixed(4), neg: +D(neg.maxReachableMagRad).toFixed(4) });
  check("한쪽만: 가능한 부호를 선택", c.sel.selectedSign === (pos.maxReachableMagRad > 0 ? +1 : -1),
    { selected: c.sel.selectedSign });
  check("한쪽만: reason = max-reachable", c.sel.reason === "max-reachable", c.sel.reason);
  check("한쪽만: 불가능한 부호는 maxReachable 0",
    Math.min(pos.maxReachableMagRad, neg.maxReachableMagRad) === 0);
  checkExactAngleValid("한쪽만", c.engine, c.evalCtx, c.sel);
  console.log(`    +${D(pos.maxReachableMagRad).toFixed(3)}° (${pos.foundBy}) / ` +
    `-${D(neg.maxReachableMagRad).toFixed(3)}° (${neg.foundBy}) → 선택 ${c.sel.selectedSign > 0 ? "+" : "-"}`);
}

section("Layer 2 준비 · Layer 1: 양쪽 부호 모두 가능");
{
  const c = buildCase({ side: "front", setup: null, segIndex: 0, frac: 0.25, piece: "A" });
  const pos = c.sel.candidates.find(x => x.sign === +1);
  const neg = c.sel.candidates.find(x => x.sign === -1);
  check("양쪽가능: 두 부호 다 도달 가능 구간 보유",
    pos.maxReachableMagRad > 0 && neg.maxReachableMagRad > 0,
    { pos: +D(pos.maxReachableMagRad).toFixed(4), neg: +D(neg.maxReachableMagRad).toFixed(4) });
  const bigger = pos.maxReachableMagRad >= neg.maxReachableMagRad ? +1 : -1;
  check("양쪽가능: 더 멀리 가는 부호를 선택", c.sel.selectedSign === bigger, { selected: c.sel.selectedSign, bigger });
  check("양쪽가능: selectedMaxReachable = 선택 부호의 maxReachable",
    c.sel.selectedMaxReachableMagRad === Math.max(pos.maxReachableMagRad, neg.maxReachableMagRad));
  checkExactAngleValid("양쪽가능", c.engine, c.evalCtx, c.sel);
  console.log(`    +${D(pos.maxReachableMagRad).toFixed(3)}° / -${D(neg.maxReachableMagRad).toFixed(3)}° → 선택 ${c.sel.selectedSign > 0 ? "+" : "-"}`);
}

section("Layer 1: sourceNotch — 단일 부호만 평가 (반대는 후보가 아니다)");
{
  const c = buildCase({ side: "front",
    setup: [{ type: "front-waist", arcFraction: 0.35, piece: "A", moveFraction: 0.5 }],
    segIndex: 1, frac: 0.25, piece: "A" });
  check("sourceNotch: ctx에 sourceNotch 존재", !!c.evalCtx.sourceNotch);
  check("sourceNotch: 후보 1개만 (반대 부호 미평가)", c.sel.candidates.length === 1, c.sel.candidates.length);
  check("sourceNotch: reason = source-notch", c.sel.reason === "source-notch", c.sel.reason);
  const expectSign = Math.sign(c.evalCtx.sourceNotch.signedAngleRad);
  check("sourceNotch: 부호 = signedAngleRad의 부호 (닫는 방향)",
    c.sel.selectedSign === expectSign, { got: c.sel.selectedSign, expect: expectSign });
  check("sourceNotch: 요청 크기가 aperture를 넘지 않음",
    c.sel.selectedMaxReachableMagRad <= c.evalCtx.sourceNotch.apertureRad + 1e-9,
    { maxReach: +D(c.sel.selectedMaxReachableMagRad).toFixed(4),
      aperture: +D(c.evalCtx.sourceNotch.apertureRad).toFixed(4) });
  checkExactAngleValid("sourceNotch", c.engine, c.evalCtx, c.sel);
  console.log(`    aperture=${D(c.evalCtx.sourceNotch.apertureRad).toFixed(3)}° → ` +
    `선택 ${c.sel.selectedSign > 0 ? "+" : "-"}${D(c.sel.selectedMaxReachableMagRad).toFixed(3)}° (후보 ${c.sel.candidates.length}개)`);
}

section("Layer 1: leg-barrier 제한 사례");
{
  const c = buildCase({ side: "front",
    setup: [{ type: "front-waist", arcFraction: 0.35, piece: "A", moveFraction: 0.5 }],
    segIndex: 44, frac: 0.25, piece: "B" });
  const cand = c.sel.candidates[0];
  check("leg-barrier: ②가 leg-barrier로 한계를 정함", cand.blockedBy === "leg-barrier", cand.blockedBy);
  check("leg-barrier: 물리 한계가 예산보다 작음",
    cand.physicalLimitMagRad < c.evalCtx.budgetRad - 1e-9,
    { phys: +D(cand.physicalLimitMagRad).toFixed(3), budget: +D(c.evalCtx.budgetRad).toFixed(3) });
  check("leg-barrier: 도달 각도가 ② 한계 이내",
    cand.maxReachableMagRad <= cand.physicalLimitMagRad + 1e-9);
  checkExactAngleValid("leg-barrier", c.engine, c.evalCtx, c.sel);
  console.log(`    physLimit=${D(cand.physicalLimitMagRad).toFixed(3)}° (blockedBy=${cand.blockedBy}) ` +
    `maxReach=${D(cand.maxReachableMagRad).toFixed(3)}° (${cand.foundBy})`);
}

section("Layer 1: ★ 비단조에서 위→아래 탐색이 먼 구간을 찾는가 (B 설계의 핵심 위험)");
{
  // C4의 위→아래 탐색이 "0 근처의 좁은 구간에서 멈춰 더 높은 구간을 놓치는"
  // applyTimeSafeAngle 1차 구현의 실수를 재현하지 않는지 직접 확인한다.
  // C0 케이스1은 oracle 한계(barrier 미포함)에서 [0, 9.148] ∪ [9.369, 10.494]이므로,
  // 위에서 내려오면 **먼 구간의 상단 10.494°**를 찾아야 한다(9.148°가 아니라).
  const cs = CASES[0];
  const s = setupCase(cs.piece);
  const evalCtx = {
    fixedSegs: s.rawFixedSegs, rotateSegs: s.rawRotateSegs, pivot: s.pivot,
    budgetRad: s.budgetRad, prevBakedSegments: s.prevBaked, sourceNotch: s.sourceNotch,
  };
  const oracleLimMag = sweepLimitMag(s, cs.sign);
  // 독립 oracle(scanIntervals — 프로덕션을 호출하지 않는 재구현)로 비단조 구간을 얻는다.
  // 예전엔 프로덕션 ③(findApplicableIntervals)을 oracle로 썼는데, 그건 "프로덕션으로
  // 프로덕션을 검증"하는 셈이라 C5d에서 ③를 삭제하며 독립 oracle로 교체했다.
  const ivOracle = scanIntervals(s, cs.sign, oracleLimMag, SCAN_STEPS);  // [[fromMag,toMag],...]
  check("비단조: oracle이 구간 2개를 본다 (전제 확인)", ivOracle.length === 2,
    { got: ivOracle.length });

  const found = s.engine.findMaxApplicableMagnitude(evalCtx, cs.sign * oracleLimMag);
  if (ivOracle.length === 2) {
    const farTop  = ivOracle[1][1];
    const nearTop = ivOracle[0][1];
    check("★ 비단조: 위→아래 탐색이 **먼 구간의 상단**을 찾음 (가까운 구간에 안 갇힘)",
      Math.abs(D(found.maxMagRad) - D(farTop)) <= 0.1,
      { found: +D(found.maxMagRad).toFixed(4), farTop: +D(farTop).toFixed(4), nearTop: +D(nearTop).toFixed(4) });
    check("비단조: 찾은 값이 가까운 구간 상단보다 큼 (아래→위였다면 여기 갇혔을 값)",
      found.maxMagRad > nearTop + 1e-9,
      { found: +D(found.maxMagRad).toFixed(4), nearTop: +D(nearTop).toFixed(4) });
    console.log(`    구간 ${ivOracle.map(iv => `${D(iv[0]).toFixed(3)}~${D(iv[1]).toFixed(3)}`).join(" ∪ ")}` +
      ` → 탐색 결과 ${D(found.maxMagRad).toFixed(3)}° (${found.reason}, 평가 ${found.scan.evaluated}+정밀 ${found.scan.refined})`);
  }
  check("비단조: 반환값이 exact evaluateEndpoint에서 valid",
    s.engine.evaluateEndpoint(evalCtx, cs.sign * found.maxMagRad).valid === true);
}

section("Layer 1: C0 비단조 setup — 프로덕션 ②→탐색 체인에서의 실제 모습");
{
  // ★ C4에서 실측으로 드러난 구조 (테스트 기대를 코드에 맞춘 게 아니라, 계약이 이미
  //   그렇게 정해져 있었다):
  //   (1) C0 setup은 **1다트 상태**라 rot.sourceNotch가 존재한다 → 선택기는 규칙대로
  //       "닫는 부호 하나"만 평가한다. C0 oracle은 sourceNotch를 무시하고 양쪽 부호를
  //       직접 스캔하므로 케이스의 sign(+/−)이 선택기 후보와 1:1 대응되지 않는다.
  //   (2) C0 oracle의 ② 한계는 **leg-barrier를 포함하지 않는다**(findRotationCollisions만
  //       스캔). 프로덕션 ②는 barrier를 포함해 **더 낮게** 자른다 — 그래서 비단조 구멍이
  //       프로덕션 ② 한계 **바깥**에 놓이고, ③는 계약("② 한계 바깥의 안전 구간은
  //       존재해도 버린다")대로 그 구간을 버린다.
  //   즉 이 블록은 "비단조가 사라졌다"가 아니라 **계층 계약이 실제로 지켜지는지**를 본다.
  const cs = CASES[0];                       // case1 (piece A) — 주 회귀 사례
  const s = setupCase(cs.piece);
  const evalCtx = {
    fixedSegs: s.rawFixedSegs, rotateSegs: s.rawRotateSegs, pivot: s.pivot,
    budgetRad: s.budgetRad, prevBakedSegments: s.prevBaked, sourceNotch: s.sourceNotch,
  };
  const sel = s.engine.selectRotationSign(evalCtx, {
    baseMagRad: s.budgetRad, cutPoint: s.cutPoint, geomSign: cs.sign,
  });

  check("C0setup: sourceNotch 상태 → 단일 부호만 평가", sel.candidates.length === 1 && sel.reason === "source-notch",
    { n: sel.candidates.length, reason: sel.reason });
  const cand = sel.candidates[0];

  // ③를 oracle 한계(barrier 무시)로 직접 호출하면 비단조 2구간이 여전히 존재한다 —
  // 비단조가 사라진 게 아니라 ②가 그 앞에서 막는다는 걸 대조로 보인다.
  const oracleLimMag = sweepLimitMag(s, cand.sign);
  const ivOracle = scanIntervals(s, cand.sign, oracleLimMag, SCAN_STEPS);  // 독립 oracle
  check("C0setup: oracle 한계(barrier 미포함)에서 여전히 2구간 (비단조 실재)",
    ivOracle.length === 2,
    { got: ivOracle.length,
      iv: ivOracle.map(iv => `${D(iv[0]).toFixed(3)}~${D(iv[1]).toFixed(3)}`) });

  check("C0setup: 프로덕션 ②가 oracle 한계보다 낮게 캡 (leg-barrier 포함)",
    cand.physicalLimitMagRad < oracleLimMag - 1e-9,
    { prod: +D(cand.physicalLimitMagRad).toFixed(3), oracle: +D(oracleLimMag).toFixed(3),
      blockedBy: cand.blockedBy });
  check("C0setup: ②가 막은 이유 = leg-barrier", cand.blockedBy === "leg-barrier", cand.blockedBy);

  // 계약: ② 한계 바깥은 endpoint가 valid여도 버린다 → 비단조 구멍이 한계 위면 안 보인다.
  check("C0setup: 도달 각도가 ② 한계 이내 (계약)",
    cand.maxReachableMagRad <= cand.physicalLimitMagRad + 1e-9,
    { physLimit: +D(cand.physicalLimitMagRad).toFixed(3),
      maxReach: +D(cand.maxReachableMagRad).toFixed(3) });
  if (ivOracle.length === 2) {
    check("C0setup: 비단조 구멍이 프로덕션 ② 한계 위에 있음 (그래서 안 보인다)",
      D(ivOracle[0][1]) > D(cand.physicalLimitMagRad) - 1e-9,
      { gapStart: +D(ivOracle[0][1]).toFixed(3),
        physLimit: +D(cand.physicalLimitMagRad).toFixed(3) });
  }
  checkExactAngleValid("C0setup", s.engine, evalCtx, sel);

  console.log(`    프로덕션 ②=${D(cand.physicalLimitMagRad).toFixed(3)}° (${cand.blockedBy}) → ` +
    `maxReach=${D(cand.maxReachableMagRad).toFixed(3)}° (${cand.foundBy}, 평가 ${cand.scan.evaluated}+정밀 ${cand.scan.refined})`);
  console.log(`    oracle ②=${D(oracleLimMag).toFixed(3)}° (barrier 미포함) → 구간 ` +
    `${ivOracle.map(iv => `${D(iv[0]).toFixed(3)}~${D(iv[1]).toFixed(3)}`).join(" ∪ ")}` +
    `  ⇒ 비단조는 실재하나 ② 한계 밖`);
}

section("Layer 1: findMaxApplicableMagnitude 계약 (평가 횟수 · 퇴화 입력)");
{
  const c = buildCase({ side: "front", setup: null, segIndex: 0, frac: 0.35, piece: "A" });
  const evalCtx = c.evalCtx;

  // 정상 경로: 한계각이 그대로 valid → 평가 1회로 끝난다(B 설계의 성능 근거).
  const sweep = c.engine.findPhysicalSweepLimit(evalCtx.fixedSegs, evalCtx.rotateSegs,
    evalCtx.pivot, c.sel.selectedSign * evalCtx.budgetRad, null);
  const okCase = c.engine.findMaxApplicableMagnitude(evalCtx, sweep.limitRad);
  if (okCase.reason === "limit-valid") {
    check("정상경로: reason=limit-valid면 평가 1회 · 정밀화 0회",
      okCase.scan.evaluated === 1 && okCase.scan.refined === 0, okCase.scan);
    check("정상경로: maxMagRad = ② 한계 그대로",
      Math.abs(okCase.maxMagRad - Math.abs(sweep.limitRad)) < 1e-12);
    console.log(`    정상경로: ${D(okCase.maxMagRad).toFixed(3)}° (${okCase.reason}) 평가 ${okCase.scan.evaluated}회`);
  }

  // 퇴화 입력: ②가 0으로 막으면 평가 자체를 안 한다.
  const zero = c.engine.findMaxApplicableMagnitude(evalCtx, 0);
  check("퇴화: limit 0 → maxMagRad 0 · valid=false · reason=zero-limit",
    zero.maxMagRad === 0 && zero.valid === false && zero.reason === "zero-limit", zero);
  check("퇴화: limit 0 → 평가 0회", zero.scan.evaluated === 0 && zero.scan.refined === 0, zero.scan);

  // 최악 경로(비용 상한): 0°를 포함해 전부 invalid → 평가 1(끝점) + 60(격자) = 61회.
  // 만드는 법: **이미 열린 다트가 있는 상태**(1다트)에서 budget을 극소로 준다. 그러면
  // 0°에서도 기존 다트의 열린 각도가 예산을 넘어 budget-exceeded가 되므로 모든 격자점이
  // invalid다. (gen-0에 같은 짓을 하면 0°는 열린 다트가 없어 sum=0 → valid라 최악이
  // 안 된다. budget을 1e-6으로 주면 evaluateEndpoint의 `budgetRad > 1e-6` 가드에 걸려
  // 예산 검사 자체가 꺼진다 — 그래서 1e-5를 쓴다.)
  const w = buildCase({ side: "front",
    setup: [{ type: "front-waist", arcFraction: 0.35, piece: "A", moveFraction: 0.5 }],
    segIndex: 1, frac: 0.25, piece: "A" });
  const wSweep = w.engine.findPhysicalSweepLimit(w.evalCtx.fixedSegs, w.evalCtx.rotateSegs,
    w.evalCtx.pivot, w.sel.selectedSign * w.evalCtx.budgetRad, null);
  const worstCtx = { ...w.evalCtx, budgetRad: 1e-5 };
  const worst = w.engine.findMaxApplicableMagnitude(worstCtx, wSweep.limitRad);
  check("최악경로: 0°까지 전부 invalid → valid=false · reason=none-valid",
    worst.valid === false && worst.reason === "none-valid", { r: worst.reason, m: worst.maxMagRad });
  check("최악경로: 평가 = 1(끝점) + 60(격자) = 61회 · 정밀화 0회 (비용 상한)",
    worst.scan.evaluated === 61 && worst.scan.refined === 0, worst.scan);
  console.log(`    최악경로: ${worst.reason} 평가 ${worst.scan.evaluated}회 + 정밀 ${worst.scan.refined}회 ` +
    `(= 부호당 비용 상한, legacy 25회 대비 2.44×)`);
}

// ══════════════════════════════════════════════
// Layer 2 — ②/탐색 스텁으로 선택 규칙만 격리 검증
// ══════════════════════════════════════════════
section("Layer 2: 선택 규칙 격리 검증 (②·탐색 스텁)");
{
  const { engine, context } = createEngine();
  // ②는 요청각을 그대로 한계로 돌려주고, 탐색은 __stub이 지정한 최대각을 돌려준다.
  vm.runInContext(`
    globalThis.__stub = { pos: 0, neg: 0 };
    findPhysicalSweepLimit = function (f, r, p, target, c) {
      return { limitRad: target, blockedBy: null, scan: null };
    };
    findMaxApplicableMagnitude = function (ctx, limitRad) {
      var sign = Math.sign(limitRad) || 0;
      if (sign === 0) return { maxMagRad: 0, valid: false, reason: "zero-limit", scan: { steps: 0, evaluated: 0, refined: 0 } };
      var m = (sign > 0 ? __stub.pos : __stub.neg) || 0;
      return {
        maxMagRad: m, valid: m > 0,
        reason: m > 0 ? "limit-valid" : "none-valid",
        scan: { steps: 60, evaluated: 1, refined: 0 },
      };
    };
  `, context);
  const setStub = (pos, neg) => {
    context.__stubIn = { pos, neg };
    vm.runInContext("__stub = __stubIn", context);
  };
  const stubCtx = {
    fixedSegs: [], rotateSegs: [], pivot: { x: 0, y: 0 },
    budgetRad: R(18.25), prevBakedSegments: null, sourceNotch: null,
  };
  const run = (geomSign) => engine.selectRotationSign(stubCtx, {
    baseMagRad: R(18.25), cutPoint: { x: 1, y: 1 }, geomSign,
  });

  // (1) EPS 동률 → 기하 부호를 tie-breaker로 유지
  setStub(R(10), R(10));                       // 완전 동일
  let r = run(+1);
  check("동률: reason = tie-geometric", r.reason === "tie-geometric", r.reason);
  check("동률: 기하 부호(+) 유지", r.selectedSign === +1, r.selectedSign);
  r = run(-1);
  check("동률: 기하 부호(−)면 −를 유지 (tie-breaker로만 작동)", r.selectedSign === -1, r.selectedSign);

  // EPS 경계: 차이가 EPS 미만이면 동률, 초과면 큰 쪽
  const EPS = 1e-4;
  setStub(R(10), R(10) + EPS * 0.5);
  r = run(+1);
  check("동률: 차이 < EPS면 기하 부호 유지 (반대가 근소히 커도)",
    r.reason === "tie-geometric" && r.selectedSign === +1, { reason: r.reason, sign: r.selectedSign });
  setStub(R(10), R(10) + EPS * 5);
  r = run(+1);
  check("동률 아님: 차이 > EPS면 큰 쪽(−) 선택",
    r.reason === "max-reachable" && r.selectedSign === -1, { reason: r.reason, sign: r.selectedSign });

  // (2) 양쪽 모두 불가 → no-room, 기하 부호 유지, maxReachable 0
  setStub(0, 0);
  r = run(+1);
  check("양쪽불가: reason = no-room", r.reason === "no-room", r.reason);
  check("양쪽불가: selectedMaxReachable = 0", r.selectedMaxReachableMagRad === 0, r.selectedMaxReachableMagRad);
  check("양쪽불가: 기하 부호 유지 (④가 MIN으로 차단할 몫)", r.selectedSign === +1, r.selectedSign);
  check("양쪽불가: 후보 2개 모두 노출", r.candidates.length === 2, r.candidates.length);
  r = run(-1);
  check("양쪽불가: 기하 부호(−)도 그대로 유지", r.selectedSign === -1, r.selectedSign);

  // (3) 양쪽 가능 → 큰 쪽
  setStub(R(4), R(12));
  r = run(+1);
  check("양쪽가능(스텁): 큰 쪽(−, 12°) 선택",
    r.selectedSign === -1 && Math.abs(D(r.selectedMaxReachableMagRad) - 12) < 1e-6,
    { sign: r.selectedSign, maxReach: +D(r.selectedMaxReachableMagRad).toFixed(4) });
  setStub(R(12), R(4));
  r = run(-1);   // 기하 부호가 −여도 +가 더 크면 +
  check("양쪽가능(스텁): 기하 부호와 무관하게 큰 쪽(+) 선택",
    r.selectedSign === +1 && r.reason === "max-reachable", { sign: r.selectedSign, reason: r.reason });

  // (4) 한쪽만 가능
  setStub(R(7), 0);
  r = run(-1);   // 기하 부호는 −인데 −는 불가
  check("한쪽만(스텁): 기하 부호와 무관하게 가능한 부호(+) 선택",
    r.selectedSign === +1 && r.reason === "max-reachable", { sign: r.selectedSign, reason: r.reason });

  console.log(`    동률/양쪽불가/양쪽가능/한쪽만 규칙 확인 완료 (기하 무관, 결정 규칙만)`);
}

console.log(`\n══════════════════════════════════════════════`);
console.log(`결과: ${pass} PASS / ${fail} FAIL`);
if (fail > 0) {
  console.log("실패 목록:");
  failures.forEach(f => console.log(" -", f.label, JSON.stringify(f.detail)));
  process.exitCode = 1;
}
