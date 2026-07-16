// ══════════════════════════════════════════════
// 프로덕션 ③ `findApplicableIntervals` 검증 — 순서 ③ C3.
//
// **무엇을 대조하는가**: C0가 확정한 비단조 3케이스에서, 프로덕션 ③의 출력이
//   (1) `./nonMonotonicFixture`의 **독립 oracle**(프로덕션을 호출하지 않는 재구현)과
//   (2) 같은 픽스처에 커밋된 **경계 상수**(CASES[].boundaries)
// 양쪽과 ±0.1° 이내로 일치하는지 본다. 보고서의 반올림 숫자를 다시 타이핑하지 않는다 —
// 진실값의 출처는 커밋된 픽스처 하나다.
//
// **범위(C3)**: ③를 신설·검증만 한다. `prepareDartMoveCandidate`의 기존 경로
// (`findMaxSafeAngle → budgetMaxAngle → applyTimeSafeAngle`)는 건드리지 않으므로
// 프로덕션 호출 횟수와 기존 골든은 전부 무변경이다. 배선은 C4/C5.
//
// **성능**: C3는 아직 프로덕션에 배선되지 않았으므로 `≤1.2×`를 통과 조건으로 강제하지
// 않는다(그 판정은 배선 후 실제 프로덕션 경로에서 내린다). 여기서는 **신설 함수 단독의
// evaluateEndpoint 호출 수·서로 다른 각도 수·중복 평가 수·시간**을 정보용으로 기록한다.
// 단 **중복 평가 수 0은 실패 조건이다** — 격자점을 이분탐색이 재평가하면 즉시 드러난다.
//
// 실행: node test/harness/applicableIntervals.js
// ══════════════════════════════════════════════
const vm = require("vm");
const {
  D, R, SCAN_STEPS, BOUNDARY_TOL_DEG,
  CASES, setupCase, sweepLimitMag, scanIntervals, endpointValid,
} = require("./nonMonotonicFixture");

let pass = 0, fail = 0;
const failures = [];
function check(label, cond, detail) {
  if (cond) { pass++; }
  else { fail++; failures.push({ label, detail }); console.error("  ✗ FAIL:", label, detail ?? ""); }
}

// ── 계측: vm 컨텍스트 **내부**의 전역 바인딩을 감싼다. loadEngine이 export한 참조만
//    바꾸면 findApplicableIntervals 내부 호출이 안 잡힌다(perfBaseline과 같은 이유).
//    findSelfIntersections도 함께 센다 — 기준선 재계산 제거(C3 발견)의 효과를 본다.
function instrumentEval(context) {
  vm.runInContext(`
    globalThis.__evalLog = [];
    globalThis.__selfXCalls = 0;
    var _ee = evaluateEndpoint;
    evaluateEndpoint = function (ctx, angleRad) { __evalLog.push(angleRad); return _ee(ctx, angleRad); };
    var _sx = findSelfIntersections;
    findSelfIntersections = function (...a) { __selfXCalls++; return _sx(...a); };
  `, context);
}
const readEvalLog   = (context) => JSON.parse(vm.runInContext("JSON.stringify(__evalLog)", context));
const readSelfXCalls = (context) => vm.runInContext("__selfXCalls", context);

// 프로덕션 ①에 넘길 컨텍스트 — oracle은 이걸 쓰지 않는다(독립성 유지).
const evalCtxOf = (s) => ({
  fixedSegs: s.rawFixedSegs, rotateSegs: s.rawRotateSegs, pivot: s.pivot,
  budgetRad: s.budgetRad, prevBakedSegments: s.prevBaked, sourceNotch: s.sourceNotch,
});

const perfRows = [];

for (const c of CASES) {
  console.log(`\n── ${c.name} — ${c.role} ──`);
  const s = setupCase(c.piece);
  const evalCtx = evalCtxOf(s);

  // ② 한계는 oracle 것으로 **고정**해서 양쪽에 같은 값을 준다 — ③의 알고리즘만 격리해
  // 비교하기 위해서다(프로덕션 ②는 leg barrier를 포함해 한계 자체가 다를 수 있고,
  // 그건 ②의 검증 항목이지 ③의 것이 아니다). ③의 계약상 limit은 입력이다.
  const limMag = sweepLimitMag(s, c.sign);
  const oracleIv = scanIntervals(s, c.sign, limMag, SCAN_STEPS);

  // ── 프로덕션 ③ 실행 (+ 계측) ──
  instrumentEval(s.context);
  const t0 = Date.now();
  const got = s.engine.findApplicableIntervals(evalCtx, c.sign * limMag);
  const ms = Date.now() - t0;
  const log = readEvalLog(s.context);
  const selfXCalls = readSelfXCalls(s.context);
  const total = log.length, distinct = new Set(log).size, dup = total - distinct;
  perfRows.push({ name: c.name, total, distinct, dup, selfXCalls, ms });

  const ivDeg = got.intervals.map(iv => [D(iv.fromMagRad), D(iv.toMagRad)]);
  console.log(`    sweepLimit=${D(limMag).toFixed(3)}° 구간: ` +
    ivDeg.map(x => `${x[0].toFixed(3)}~${x[1].toFixed(3)}`).join("  ") +
    `  (sign=${got.sign})`);

  // ── 완료 조건 1: 비단조 구간 발견 (구간 2개) ──
  check(`${c.name}: 구간 2개 (비단조 발견)`, got.intervals.length === 2,
    { got: got.intervals.length, ivDeg: ivDeg.map(x => `${x[0].toFixed(3)}~${x[1].toFixed(3)}`) });

  // ── 완료 조건 2: 경계 오차 ≤0.1° — (a) 커밋된 픽스처 상수, (b) 독립 oracle ──
  if (got.intervals.length === 2) {
    const gotB = [ivDeg[0][1], ivDeg[1][0]];   // 구간1 상단, 구간2 하단 = 금지구간 경계
    check(`${c.name}: 구간1 상단 ≈ 픽스처 상수 ${c.boundaries[0]}° (±${BOUNDARY_TOL_DEG})`,
      Math.abs(gotB[0] - c.boundaries[0]) <= BOUNDARY_TOL_DEG,
      { expected: c.boundaries[0], got: +gotB[0].toFixed(4) });
    check(`${c.name}: 구간2 하단 ≈ 픽스처 상수 ${c.boundaries[1]}° (±${BOUNDARY_TOL_DEG})`,
      Math.abs(gotB[1] - c.boundaries[1]) <= BOUNDARY_TOL_DEG,
      { expected: c.boundaries[1], got: +gotB[1].toFixed(4) });
  }
  check(`${c.name}: 독립 oracle과 구간 개수 일치`, got.intervals.length === oracleIv.length,
    { prod: got.intervals.length, oracle: oracleIv.length });
  if (got.intervals.length === oracleIv.length) {
    const worst = got.intervals.reduce((w, iv, i) => Math.max(w,
      Math.abs(D(iv.fromMagRad) - D(oracleIv[i][0])),
      Math.abs(D(iv.toMagRad)   - D(oracleIv[i][1]))), 0);
    check(`${c.name}: 독립 oracle과 모든 경계 ±${BOUNDARY_TOL_DEG}° 이내`, worst <= BOUNDARY_TOL_DEG,
      { worstDiffDeg: +worst.toFixed(5),
        prod:   ivDeg.map(x => `${x[0].toFixed(3)}~${x[1].toFixed(3)}`),
        oracle: oracleIv.map(x => `${D(x[0]).toFixed(3)}~${D(x[1]).toFixed(3)}`) });
  }

  // ── 완료 조건 3: physical limit 바깥 구간 없음 ──
  check(`${c.name}: 모든 구간이 ② 한계 이내`,
    got.intervals.every(iv => iv.fromMagRad >= -1e-12 && iv.toMagRad <= limMag + 1e-9),
    { limitDeg: +D(limMag).toFixed(4), ivDeg: ivDeg.map(x => `${x[0].toFixed(3)}~${x[1].toFixed(3)}`) });
  check(`${c.name}: scan.limitMagRad = 준 한계`, Math.abs(got.scan.limitMagRad - limMag) < 1e-12,
    { got: got.scan.limitMagRad, expected: limMag });
  check(`${c.name}: sign = ${c.sign}`, got.sign === c.sign, { got: got.sign });

  // ── 완료 조건 4/5: 구간 내부 대표점은 valid, 금지구간 대표점은 invalid ──
  // 대표점 유효성은 oracle이 판정하고(독립), 구간 포함 여부는 프로덕션 출력이 답한다.
  const inSomeInterval = (magRad) =>
    got.intervals.some(iv => magRad >= iv.fromMagRad - 1e-12 && magRad <= iv.toMagRad + 1e-12);
  for (const rep of c.representative) {
    const magRad = R(rep.deg);
    check(`${c.name}: 대표점 ${rep.deg}° → ${rep.valid ? "구간 안" : "금지구간(구간 밖)"}`,
      inSomeInterval(magRad) === rep.valid, { inInterval: inSomeInterval(magRad), expectValid: rep.valid });
    // oracle로 대표점 유효성 자체를 재확인 — 픽스처 상수가 현재 엔진과 어긋나면 여기서 잡힌다.
    check(`${c.name}: 대표점 ${rep.deg}° oracle 유효성 = ${rep.valid}`,
      endpointValid(s, c.sign * magRad) === rep.valid);
  }

  // ── 완료 조건 6: 구간 정렬·비중첩 ──
  check(`${c.name}: 구간 정렬·비중첩 (from ≤ to, 앞 구간 to < 뒤 구간 from)`,
    got.intervals.every(iv => iv.fromMagRad <= iv.toMagRad) &&
    got.intervals.every((iv, i) => i === 0 || got.intervals[i - 1].toMagRad < iv.fromMagRad),
    { ivDeg: ivDeg.map(x => `${x[0].toFixed(3)}~${x[1].toFixed(3)}`) });

  // ── 0°를 자르지 않는다 + MIN_DART_ANGLE_RAD 트리밍 금지 (계층 계약) ──
  // 케이스2/3은 첫 구간 상단(≈0.307°)이 MIN(0.5°)보다 작다 — C3가 MIN으로 트리밍하면
  // 이 구간이 통째로 사라지므로, 이 검사가 트리밍 금지의 직접 증거가 된다.
  check(`${c.name}: 0°가 첫 구간의 시작 (0° 평가 포함, 잘라내지 않음)`,
    got.intervals.length > 0 && got.intervals[0].fromMagRad === 0,
    { first: got.intervals[0] ? +D(got.intervals[0].fromMagRad).toFixed(6) : null });
  const MIN = s.engine.MIN_DART_ANGLE_RAD;
  if (got.intervals.length > 0 && got.intervals[0].toMagRad < MIN) {
    check(`${c.name}: MIN(${D(MIN).toFixed(2)}°) 미만 구간이 보존됨 (④의 책임이지 ③의 것이 아님)`,
      true);
    console.log(`    ※ 첫 구간 상단 ${D(got.intervals[0].toMagRad).toFixed(3)}° < MIN ${D(MIN).toFixed(2)}° — 트리밍 없이 보존 확인`);
  }

  // ── 계측: 중복 평가 0 (실패 조건) ──
  check(`${c.name}: 같은 각도 중복 평가 0`, dup === 0, { total, distinct, dup });

  // ── 기준선(baselineSelfXCount) 재사용: 호출 수는 줄고 결과는 같아야 한다 ──
  // 기준선은 ctx당 불변이므로 스캔 전체에서 findSelfIntersections는
  // "기준선 1회 + 평가마다 shape 1회" = total + 1 이어야 한다(평가마다 기준선을
  // 다시 계산하던 예전이면 2×total 이었다).
  check(`${c.name}: findSelfIntersections = 평가수+1 (기준선 1회만 계산)`,
    selfXCalls === total + 1, { selfXCalls, expected: total + 1, evals: total });
}

// ══════════════════════════════════════════════
// 기준선 재사용 동치: baselineSelfXCount를 넘기든 안 넘기든 결과가 같아야 한다.
// (성능 수정이 판정을 바꾸지 않았다는 증거 — 값의 출처는 여전히 prevBakedSegments 하나다)
// ══════════════════════════════════════════════
{
  console.log(`\n── 기준선 재사용 동치 (baselineSelfXCount 유/무) ──`);
  const s = setupCase("A");
  const base = evalCtxOf(s);
  const precomputed = s.engine.findSelfIntersections(s.prevBaked, s.pivot).length;
  const withBase = { ...base, baselineSelfXCount: precomputed };

  // 대표 각도들에서 evaluateEndpoint의 판정이 완전히 일치하는가
  let mismatch = 0;
  for (let i = 0; i <= 20; i++) {
    const ang = (i / 20) * s.budgetRad;
    const a = s.engine.evaluateEndpoint(base, ang);
    const b = s.engine.evaluateEndpoint(withBase, ang);
    if (a.valid !== b.valid || a.reasons.join() !== b.reasons.join() ||
        a.metrics.baselineSelfXCount !== b.metrics.baselineSelfXCount) mismatch++;
  }
  check("기준선 유/무 evaluateEndpoint 판정 동일 (21각도)", mismatch === 0, { mismatch });

  // ③ 전체 결과도 동일한가
  const limMag = sweepLimitMag(s, +1);
  const ivA = s.engine.findApplicableIntervals(base, limMag);
  const ivB = s.engine.findApplicableIntervals(withBase, limMag);
  check("기준선 유/무 findApplicableIntervals 결과 동일",
    JSON.stringify(ivA) === JSON.stringify(ivB), { a: ivA.intervals.length, b: ivB.intervals.length });

  // 입력 ctx를 변형하지 않는다 (파생 ctx를 쓴다 — 순수성)
  check("③가 입력 ctx에 baselineSelfXCount를 주입하지 않음 (입력 비변형)",
    !("baselineSelfXCount" in base), { keys: Object.keys(base) });
  console.log(`    기준선=${precomputed} · 판정 불일치 ${mismatch}건 · 입력 ctx 비변형 확인`);
}

// ══════════════════════════════════════════════
// 퇴화 입력: limitRad = 0 → 스캔할 구간 자체가 없다
// ══════════════════════════════════════════════
{
  console.log(`\n── 퇴화 입력 (limitRad = 0) ──`);
  const s = setupCase("A");
  const evalCtx = evalCtxOf(s);
  instrumentEval(s.context);
  const got = s.engine.findApplicableIntervals(evalCtx, 0);
  const log = readEvalLog(s.context);
  check("limit 0: sign = 0", got.sign === 0, { got: got.sign });
  check("limit 0: intervals = []", Array.isArray(got.intervals) && got.intervals.length === 0, { got: got.intervals });
  check("limit 0: scan.limitMagRad = 0", got.scan.limitMagRad === 0, { got: got.scan.limitMagRad });
  check("limit 0: evaluateEndpoint 호출 0 (스캔 없음)", log.length === 0, { calls: log.length });
  console.log(`    sign=${got.sign} intervals=[] evaluateEndpoint 호출=${log.length}`);
}

// ══════════════════════════════════════════════
// 성능 기록 (정보용 — C3는 배선 전이라 ≤1.2× 게이트를 강제하지 않는다)
// ══════════════════════════════════════════════
console.log(`\n── ③ 단독 비용 (배선 전 · 정보용) ──`);
for (const r of perfRows) {
  console.log(`  ${r.name.padEnd(22)} evaluateEndpoint 총 ${String(r.total).padStart(3)} · ` +
    `서로 다른 angle ${String(r.distinct).padStart(3)} · 중복 ${r.dup} · ` +
    `selfX ${String(r.selfXCalls).padStart(3)}   (${r.ms}ms · 정보용)`);
}
console.log(`  ※ 격자 ${SCAN_STEPS + 1}점 + 경계당 이분탐색 18회. 중복 0 = 격자점을 재평가하지 않는다는 뜻.`);
console.log(`  ※ selfX = 평가수+1 (기준선 1회 + 평가마다 shape 1회). 기준선 재계산 제거 전이면 2×평가수였다.`);
console.log(`  ※ ≤1.2× 판정은 C4/C5 배선 후 실제 프로덕션 경로에서 내린다(perf-baseline.json 기준).`);

console.log(`\n══════════════════════════════════════════════`);
console.log(`결과: ${pass} PASS / ${fail} FAIL`);
if (fail > 0) {
  console.log("실패 목록:");
  failures.forEach(f => console.log(" -", f.label, JSON.stringify(f.detail)));
  process.exitCode = 1;
}
