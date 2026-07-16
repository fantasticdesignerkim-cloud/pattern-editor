// ══════════════════════════════════════════════
// 프로덕션 ④ `resolveRequestedAngle` 검증 — 순서 ③ C5.
//
// **무엇을 대조하는가**: C0가 확정한 비단조 3케이스에서, ④가 요청각을 실제 적용 가능한
// 각도로 확정하는 규칙을 `./nonMonotonicFixture`의 **독립 oracle**(프로덕션을 호출하지
// 않는 재구현)과 대조한다. 이 스위트는 C5d에서 삭제되는 `applicableIntervals.js`의
// **비단조·스냅 커버리지를 이어받는다** — ③가 사라져도 "요청각이 금지구간에 떨어지면
// 가장 가까운 경계로 스냅한다"가 계속 지켜지는지 본다.
//
// **왜 oracle 한계를 주입하는가**: 프로덕션 ②(findPhysicalSweepLimit)는 leg-barrier를
// 포함해 한계가 비단조 구멍보다 아래에 놓일 수 있다(C4 실측 — 프로덕션 경로에선 스냅이
// 안 일어난다). ④의 스냅 분기 자체를 격리 검증하려면 oracle의 ② 한계를 limit으로 줘서
// 금지구간이 [0, limit] 안에 드러나게 해야 한다. ④의 계약상 limit은 입력이다.
//
// **핵심 계약(사용자 확정)**:
//   1. 정상 경로(요청각 그대로 valid) = 평가 1회.
//   2. 중복 평가 금지 = resolved 각도의 evaluation을 함께 반환(evaluation.angleRad ===
//      resolvedAngleRad). resolved가 0이면 evaluation은 null.
//   3. 안전 판정은 오직 evaluation.valid — 경계 탐색은 스냅 보조일 뿐.
//   4. 0/MIN 보존 = |요청| < MIN → resolved 0(중립, 평가 0회).
//   5. 순수 = 드래그 방향 이력 무시(같은 요청각 → 같은 결과), 동률이면 작은 각도.
//
// 실행: node test/harness/resolveRequestedAngle.js
// ══════════════════════════════════════════════
const {
  D, R, SCAN_STEPS,
  CASES, setupCase, sweepLimitMag, scanIntervals, endpointValid,
} = require("./nonMonotonicFixture");

let pass = 0, fail = 0;
const failures = [];
function check(label, cond, detail) {
  if (cond) { pass++; }
  else { fail++; failures.push({ label, detail }); console.error("  ✗ FAIL:", label, detail ?? ""); }
}

const evalCtxOf = (s) => ({
  fixedSegs: s.rawFixedSegs, rotateSegs: s.rawRotateSegs, pivot: s.pivot,
  budgetRad: s.budgetRad, prevBakedSegments: s.prevBaked, sourceNotch: s.sourceNotch,
});

// resolved 각도가 어느 oracle 구간에 드는지(=valid여야 하는지) 판정
const inSomeInterval = (ivs, mag) =>
  ivs.some(iv => mag >= iv[0] - 1e-9 && mag <= iv[1] + 1e-9);

// ④가 반환한 결과의 공통 계약을 검사한다.
function checkContract(tag, r) {
  // 계약 2: evaluation.angleRad === resolvedAngleRad (요청각이 아니라 확정각의 평가)
  if (r.evaluation) {
    check(`${tag}: evaluation.angleRad === resolvedAngleRad`,
      r.evaluation.angleRad === r.resolvedAngleRad,
      { evalAngle: r.evaluation ? +D(r.evaluation.angleRad).toFixed(4) : null,
        resolved: +D(r.resolvedAngleRad).toFixed(4) });
    // 계약 3: 반환된 evaluation은 반드시 valid(안전 판정의 유일 출처)
    check(`${tag}: 반환된 evaluation은 valid`, r.evaluation.valid === true, r.evaluation.reasons);
  } else {
    // evaluation null이면 resolved는 반드시 0(회전 없음)
    check(`${tag}: evaluation null ⇒ resolved 0`, r.resolvedAngleRad === 0,
      { resolved: r.resolvedAngleRad });
  }
}

for (const c of CASES) {
  console.log(`\n── ${c.name} — ${c.role} ──`);
  const s = setupCase(c.piece);
  const ctx = evalCtxOf(s);
  const eng = s.engine;
  const MIN = eng.MIN_DART_ANGLE_RAD;

  const limMag = sweepLimitMag(s, c.sign);
  const limit = c.sign * limMag;
  const oracleIv = scanIntervals(s, c.sign, limMag, SCAN_STEPS);  // [[fromMag,toMag],...]
  const ivStr = oracleIv.map(x => `${D(x[0]).toFixed(3)}~${D(x[1]).toFixed(3)}`).join(" ∪ ");
  console.log(`    sweepLimit=${D(limMag).toFixed(3)}° oracle 구간: ${ivStr}`);
  check(`${c.name}: 비단조(구간 2개)`, oracleIv.length === 2, { got: oracleIv.length });
  if (oracleIv.length !== 2) continue;

  // 금지구간 [lo, hi]. **④는 MIN 미만 요청을 평가 없이 중립 0으로 처리한다** — 그러니
  // 금지구간이 MIN보다 아래(case2/3: [0.307,0.345]°)면 ④ 경로에서는 관측 불가능하다.
  // 이게 ③와 ④의 계약 차이다(③는 MIN을 안 자르고, ④는 자른다). 스냅 검증은 금지구간이
  // MIN보다 위에 있는 case1에서만 유효하다.
  const lo = oracleIv[0][1], hi = oracleIv[1][0];
  const snapObservable = lo > MIN;
  console.log(`    금지구간 [${D(lo).toFixed(3)}, ${D(hi).toFixed(3)}]° · MIN=${D(MIN).toFixed(2)}° · 스냅 관측가능=${snapObservable}`);

  // ── 대표점: MIN 미만이면 중립 0, 아니면 valid=통과 / invalid=스냅 ──
  for (const rep of c.representative) {
    const reqMag = R(rep.deg);
    const r = eng.resolveRequestedAngle(ctx, c.sign * reqMag, limit);
    const resMag = Math.abs(r.resolvedAngleRad);
    const tag = `${c.name} @${rep.deg}°`;
    checkContract(tag, r);

    if (reqMag < MIN) {
      // ④ 계약: MIN 미만 요청 → 중립 0(평가 0회). 구간 안/밖 무관.
      check(`${tag}: MIN 미만 요청 → 중립 0(zero-request)`, r.reason === "zero-request" && r.resolvedAngleRad === 0,
        { reason: r.reason, resolved: r.resolvedAngleRad });
      check(`${tag}: MIN 미만 요청 → 평가 0회`, r.scan.evaluated === 0, { evaluated: r.scan.evaluated });
    } else if (rep.valid) {
      check(`${tag}: valid 요청 → 그대로 통과(request-valid)`, r.reason === "request-valid",
        { reason: r.reason, resolved: +D(r.resolvedAngleRad).toFixed(3) });
      check(`${tag}: valid 요청 정상경로 평가 1회`, r.scan.evaluated === 1, { evaluated: r.scan.evaluated });
      check(`${tag}: resolved ≈ 요청(스냅 안 함)`, Math.abs(resMag - reqMag) < 1e-9,
        { resolved: +D(r.resolvedAngleRad).toFixed(4), req: rep.deg });
    } else {
      check(`${tag}: 금지구간 요청 → 스냅(snap-boundary)`, r.reason === "snap-boundary",
        { reason: r.reason });
      check(`${tag}: resolved가 oracle valid 구간 안`, inSomeInterval(oracleIv, resMag),
        { resolved: +D(r.resolvedAngleRad).toFixed(4) });
      check(`${tag}: resolved가 요청과 다름(실제로 이동)`, Math.abs(resMag - reqMag) > 1e-6,
        { resolved: +D(r.resolvedAngleRad).toFixed(4), req: rep.deg });
    }
  }

  if (!snapObservable) {
    // 금지구간이 MIN 미만이라 ④에서 스냅이 안 일어난다 — 그 자체를 계약으로 확인한다.
    const rInside = eng.resolveRequestedAngle(ctx, c.sign * (lo + hi) / 2, limit);
    check(`${c.name}: MIN 미만 금지구간은 ④에서 중립 0(스냅 관측 불가)`,
      rInside.resolvedAngleRad === 0 && rInside.reason === "zero-request",
      { resolved: +D(rInside.resolvedAngleRad).toFixed(4), reason: rInside.reason });
    continue;
  }

  // ── 스냅 방향/동률: **④ 자신이 반환한 경계**를 진실값으로 쓴다 ──
  // oracle 경계(scanIntervals)는 반올림이라 ④의 이분탐색 경계와 미세하게 달라, 그 중점은
  // ④ 기준으로 정확한 동률이 아니다. ④가 실제로 내놓는 경계로 동률 지점을 만든다.
  const loB = Math.abs(eng.resolveRequestedAngle(ctx, c.sign * (lo + (hi - lo) * 0.25), limit).resolvedAngleRad);
  const hiB = Math.abs(eng.resolveRequestedAngle(ctx, c.sign * (lo + (hi - lo) * 0.75), limit).resolvedAngleRad);
  check(`${c.name}: 아래쪽 요청 → 아래 경계로 스냅`, Math.abs(loB - lo) < 1e-3,
    { snapped: +D(loB).toFixed(4), loBoundary: +D(lo).toFixed(4) });
  check(`${c.name}: 위쪽 요청 → 위 경계로 스냅`, Math.abs(hiB - hi) < 1e-3,
    { snapped: +D(hiB).toFixed(4), hiBoundary: +D(hi).toFixed(4) });

  // 동률: ④가 반환한 두 경계 loB/hiB의 정확한 중점 → 작은 각도(아래)
  const trueMid = (loB + hiB) / 2;
  const rMid = eng.resolveRequestedAngle(ctx, c.sign * trueMid, limit);
  check(`${c.name}: 정확한 동률 중점 → 작은 각도(아래 경계)`,
    Math.abs(Math.abs(rMid.resolvedAngleRad) - loB) < 1e-6,
    { resolved: +D(rMid.resolvedAngleRad).toFixed(6), lo: +D(loB).toFixed(6), hi: +D(hiB).toFixed(6) });

  // 재현성(히스테리시스 금지): 다른 각도를 거쳐도 같은 요청각 → 같은 결과
  const nearLo = lo + (hi - lo) * 0.25;
  const a = eng.resolveRequestedAngle(ctx, c.sign * nearLo, limit).resolvedAngleRad;
  eng.resolveRequestedAngle(ctx, c.sign * (hi + (limMag - hi) * 0.5), limit);  // 다른 각도 경유
  const b = eng.resolveRequestedAngle(ctx, c.sign * nearLo, limit).resolvedAngleRad;
  check(`${c.name}: 같은 요청각 재현성(히스테리시스 없음)`, a === b,
    { first: +D(a).toFixed(6), second: +D(b).toFixed(6) });

  // 스냅 결과 안전성: 금지구간 전후를 촘촘히 스윕 → 반환 evaluation은 항상 valid + 계약
  let unsafe = 0, contractBreak = 0, swept = 0;
  for (let m = lo - (hi - lo); m <= hi + (hi - lo); m += (hi - lo) / 20) {
    if (m <= MIN || m >= limMag) continue;
    swept++;
    const rr = eng.resolveRequestedAngle(ctx, c.sign * m, limit);
    if (rr.evaluation) {
      if (!rr.evaluation.valid) unsafe++;
      if (rr.evaluation.angleRad !== rr.resolvedAngleRad) contractBreak++;
    }
  }
  check(`${c.name}: 금지구간 스윕(${swept}점) — 반환 evaluation 전부 valid`, unsafe === 0, { unsafe });
  check(`${c.name}: 금지구간 스윕 — 계약(angleRad===resolved) 위반 0`, contractBreak === 0, { contractBreak });
}

// ══════════════════════════════════════════════
// 0/MIN 보존 + 퇴화 입력 (계층 계약 — ④의 책임)
// ══════════════════════════════════════════════
{
  console.log(`\n── 0/MIN 보존 + 퇴화 입력 ──`);
  const s = setupCase("A");
  const ctx = evalCtxOf(s);
  const eng = s.engine;
  const MIN = eng.MIN_DART_ANGLE_RAD;
  const limit = sweepLimitMag(s, +1);  // sign +1

  // 요청 0 → resolved 0, evaluation null, 평가 0회
  const r0 = eng.resolveRequestedAngle(ctx, 0, limit);
  check("요청 0° → resolved 0", r0.resolvedAngleRad === 0, { resolved: r0.resolvedAngleRad });
  check("요청 0° → reason zero-request", r0.reason === "zero-request", { reason: r0.reason });
  check("요청 0° → evaluation null", r0.evaluation === null, { evaluation: r0.evaluation });
  check("요청 0° → 평가 0회", r0.scan.evaluated === 0, { evaluated: r0.scan.evaluated });

  // 요청 MIN 미만(0.3°) → 중립 0(0.5°로 튀지 않는다)
  const rMinus = eng.resolveRequestedAngle(ctx, R(0.3), limit);
  check("요청 0.3°(<MIN) → resolved 0 (0.5°로 안 튐)", rMinus.resolvedAngleRad === 0,
    { resolved: +D(rMinus.resolvedAngleRad).toFixed(4) });
  check("요청 0.3° → 평가 0회", rMinus.scan.evaluated === 0, { evaluated: rMinus.scan.evaluated });

  // 반대 부호 요청 → 0으로 clamp(상한 방향 아님)
  const rOpp = eng.resolveRequestedAngle(ctx, -R(5), limit);
  check("반대 부호 요청 → resolved 0", rOpp.resolvedAngleRad === 0, { resolved: rOpp.resolvedAngleRad });

  // limit 0 → zero-limit, 평가 0회
  const rZeroLim = eng.resolveRequestedAngle(ctx, R(5), 0);
  check("limit 0 → reason zero-limit", rZeroLim.reason === "zero-limit", { reason: rZeroLim.reason });
  check("limit 0 → resolved 0, 평가 0회",
    rZeroLim.resolvedAngleRad === 0 && rZeroLim.scan.evaluated === 0,
    { resolved: rZeroLim.resolvedAngleRad, evaluated: rZeroLim.scan.evaluated });

  console.log(`    0°/MIN미만/반대부호/limit0 전부 중립 0 — MIN으로 튀지 않음 확인`);
}

// ══════════════════════════════════════════════
// 정상 경로: **프로덕션 limit**(closeAngleRad)을 요청하면 request-valid + 평가 1회
// ══════════════════════════════════════════════
// 드래그를 끝까지 눌렀을 때(=baseAngle 요청)의 지배적 케이스다. 프로덕션 limit은
// prepareDartMoveCandidate가 C4로 **endpoint-valid까지 확인해** 내놓은 값이라(oracle의
// sweepLimit=조각 충돌 한계와 다르다 — 그건 endpoint-valid 보장이 없다) 그대로 요청하면
// 스냅 없이 통과하고 요청각 정확 평가는 1회다. UI가 baseAngle을 리졸버에 넘기는 실제
// 경로를 fixture 재료로 재현한다(sourceNotch 경로라 pts는 안 쓰인다).
{
  console.log(`\n── 정상 경로: 프로덕션 limit 요청 → request-valid + 평가 1회 ──`);
  for (const piece of ["A", "B"]) {
    const s = setupCase(piece);
    const ctx = evalCtxOf(s);
    const cand = s.engine.prepareDartMoveCandidate({
      pivot: s.pivot, budgetRad: s.budgetRad,
      rawBaseAngleRad: s.sourceNotch.signedAngleRad, cutPoint: s.cutPoint,
      rotatePiece: { segs: s.rawRotateSegs, sourceNotch: s.sourceNotch },
      fixedPiece: { segsFull: s.rawFixedSegs },
      prevBakedSegments: s.prevBaked,
    });
    if (!cand.valid) { console.log(`    piece ${piece}: no-room — 스킵`); continue; }
    const limit = cand.closeAngleRad;
    const r = s.engine.resolveRequestedAngle(ctx, limit, limit);
    check(`piece ${piece}: 프로덕션 limit 요청 → request-valid`, r.reason === "request-valid",
      { reason: r.reason, limitDeg: +D(limit).toFixed(3) });
    check(`piece ${piece}: limit 요청 평가 1회`, r.scan.evaluated === 1, { evaluated: r.scan.evaluated });
    check(`piece ${piece}: resolved === limit`, Math.abs(r.resolvedAngleRad - limit) < 1e-9,
      { resolved: +D(r.resolvedAngleRad).toFixed(4), limit: +D(limit).toFixed(4) });
    checkContract(`piece ${piece} limit`, r);
    console.log(`    piece ${piece}: limit ${D(limit).toFixed(3)}° → ${r.reason} 평가 ${r.scan.evaluated}회`);
  }
}

// ══════════════════════════════════════════════
// 순수성: 입력 ctx를 변형하지 않는다
// ══════════════════════════════════════════════
{
  const s = setupCase("A");
  const ctx = evalCtxOf(s);
  const before = Object.keys(ctx).sort().join(",");
  s.engine.resolveRequestedAngle(ctx, R(5), sweepLimitMag(s, +1));
  const after = Object.keys(ctx).sort().join(",");
  check("④가 입력 ctx를 변형하지 않음", before === after, { before, after });
}

console.log(`\n══════════════════════════════════════════════`);
console.log(`결과: ${pass} PASS / ${fail} FAIL`);
if (fail > 0) {
  console.log("실패 목록:");
  failures.forEach(f => console.log(" -", f.label, JSON.stringify(f.detail)));
  process.exitCode = 1;
}
