// ══════════════════════════════════════════════
// 전체 회귀 하네스 러너 — 리팩터 전후 동일 결과 비교용.
//   node test/harness/runAll.js            # 전 스위트 실행(골든 대조 포함)
//   node test/harness/runAll.js --update "reason"   # 모든 골든 재생성
//
// 골든 시나리오(front*/multidart/oldest)는 --update를 그대로 전달받는다.
// backDeterministic/backRandomStress는 골든이 없으므로 --update를 무시한다.
// ══════════════════════════════════════════════
const { execFileSync } = require("child_process");
const path = require("path");

const passThrough = process.argv.slice(2); // 예: --update "reason"

const suites = [
  { file: "purityCheck.js",           golden: false },
  { file: "unrelatedNotchInvariant.js", golden: false },
  { file: "backDeterministic.js",     golden: false },
  { file: "backRandomStress.js",      golden: false, args: ["40", "8"] },
  { file: "frontDeterministic.js",    golden: true },
  { file: "multiDartScenarios.js",    golden: true },
  { file: "frontOldestDartAudit.js",  golden: true },
  // 순서 ③(evaluateMove 4계층) 안전망
  { file: "endpointEquivalence.js",   golden: false },
  { file: "nonMonotonicIntervals.js", golden: true },
  // C5: 프로덕션 ④ resolveRequestedAngle — 비단조·스냅·0/MIN·계약을 oracle과 대조.
  // (C5d에서 삭제된 applicableIntervals.js의 비단조 커버리지를 이어받는다. 자체 골든 없음)
  { file: "resolveRequestedAngle.js", golden: false },
  // C4: 부호 선택 — 분기별 계약(실기하 + 스텁)을 독립 oracle과 대조.
  { file: "rotationSignSelection.js", golden: false },
  { file: "perfBaseline.js",          golden: true },
];

let anyFail = false;
for (const s of suites) {
  const args = [path.join(__dirname, s.file), ...(s.args || []), ...(s.golden ? passThrough : [])];
  process.stdout.write(`\n### ${s.file} ###\n`);
  try {
    const out = execFileSync("node", args, { encoding: "utf8" });
    const tail = out.trim().split("\n").slice(-2).join("\n");
    process.stdout.write(tail + "\n");
  } catch (e) {
    anyFail = true;
    const out = (e.stdout || "").toString().trim().split("\n").slice(-8).join("\n");
    process.stdout.write(out + "\n[FAILED]\n");
  }
}

console.log(`\n══════════════════════════════════════════════`);
console.log(anyFail ? "전체 결과: 실패 있음 ✗" : "전체 결과: 모두 통과 ✓");
if (anyFail) process.exitCode = 1;
