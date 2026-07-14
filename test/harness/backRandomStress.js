// ══════════════════════════════════════════════
// 뒤판 무작위 스트레스 — 프로젝트 기존 방법론(N런×G세대, 무작위 위치/조각/각도)을
// 뒤판(pivot=E)에 그대로 적용한다. 결정론적 매트릭스(backDeterministic.js)가 특정
// 시나리오를 정밀 검증한다면, 이쪽은 넓은 무작위 커버리지로 놓친 조합을 찾는다.
//
// 실행: node test/harness/backRandomStress.js [runs] [generations]
// ══════════════════════════════════════════════
const { createEngine } = require("./loadEngine");
const { attemptDartMove, countBreaks, countClosedTraces } = require("./dartDriver");
const { mulberry32 } = require("./rng");

const RUNS = parseInt(process.argv[2] || "40", 10);
const GENS = parseInt(process.argv[3] || "8", 10);

let totalApplied = 0, totalBlocked = 0, totalOther = 0;
let selfXFail = 0, breaksFail = 0, closedFail = 0, budgetFail = 0;
let maxRatio = 0;
const anomalies = [];

for (let run = 0; run < RUNS; run++) {
  const { engine, B, W, BL } = createEngine();
  const dims = { B, W, BL };
  const rng = mulberry32(run * 100003 + 7);

  for (let gen = 0; gen < GENS; gen++) {
    const frac = 0.1 + rng() * 0.9; // 0.1~1.0 (MIN_DART_ANGLE_RAD 미만은 attemptDartMove 내부에서 no-room 처리)
    const piece = rng() < 0.5 ? "A" : "B";
    const r = attemptDartMove(engine, "back", dims, frac, piece, rng);

    if (r.status === "applied") {
      totalApplied++;
      const selfX = engine.findSelfIntersections(r.bakedSegments, r.pivot).length;
      const breaks = countBreaks(r.bakedSegments);
      const closed = countClosedTraces(engine, r.bakedSegments, r.pivot);
      const used = engine.sumOpenDartAngle(r.bakedSegments, r.pivot);
      const budget = Math.abs(engine.calcBackBaseDartAngle(
        engine.buildBackShoulderDartInfo(engine.createDraft(B, W, BL).formula, engine.createDraft(B, W, BL).pts, B)));
      const ratio = used / budget;
      if (ratio > maxRatio) maxRatio = ratio;

      if (selfX > 0) { selfXFail++; anomalies.push({ run, gen, kind: "selfX", selfX }); }
      if (breaks > 0) { breaksFail++; anomalies.push({ run, gen, kind: "breaks", breaks }); }
      // 알려진 뒤판 소견: 원본 back-shoulder-dart 비대칭 잔여 sliver(~0.10cm)는
      // EPS_CLOSED_DART=0.05cm보다 커서 normalize가 못 잡는다 — closedTraces 자체는
      // 0으로 유지되지만(그 sliver는 "열린 다트"로 카운트됨), 혹시 그 이상(진짜 회귀)
      // 이 생기면 잡기 위해 그대로 카운트한다.
      if (closed > 0) { closedFail++; anomalies.push({ run, gen, kind: "closed", closed }); }
      if (ratio > engine.DART_BUDGET_TOL + 1e-6) { budgetFail++; anomalies.push({ run, gen, kind: "budget", ratio }); }
    } else if (r.status === "blocked" || r.status === "no-room") {
      totalBlocked++;
    } else {
      totalOther++;
      anomalies.push({ run, gen, kind: "other-status", status: r.status });
    }
  }
}

console.log(`뒤판 무작위 스트레스: ${RUNS}런 × ${GENS}세대 = ${RUNS * GENS}세대 실행`);
console.log(`적용: ${totalApplied} / 차단(정상): ${totalBlocked} / 기타: ${totalOther}`);
console.log(`selfX>0: ${selfXFail} / breaks>0: ${breaksFail} / closed>0: ${closedFail} / budget초과: ${budgetFail}`);
console.log(`maxRatio: ${maxRatio.toFixed(4)} (허용 상한 ${1 /*base*/}~${1.15})`);
if (anomalies.length > 0) {
  console.log(`\n이상 사례 ${anomalies.length}건 (최대 20건 표시):`);
  anomalies.slice(0, 20).forEach(a => console.log(" -", JSON.stringify(a)));
  process.exitCode = 1;
} else {
  console.log("\n이상 없음 — selfX/breaks/closed/budget 전부 0.");
}
