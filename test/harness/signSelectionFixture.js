// ══════════════════════════════════════════════
// 양쪽 회전 부호 비교 픽스처.
//
// 순서 ③(C4)에서 `chooseSignedBaseAngle`을 해체하고 부호 선택을 intervals 기반으로
// 바꾼다. 그때 **현재 생산 코드가 최종 선택한 결과**가 보존되는지 확인할 안전망이다.
// 기하 힌트(choosePhysicalCloseAngle)가 아니라 파이프라인 통과 후 실제 선택을 고정한다.
//
// 각 부호를 **기존 파이프라인 그대로** 개별 평가해서 기록한다:
//   physicalRad  = findMaxSafeAngle       (② 물리 한계)
//   usableRad    = ... → budgetMaxAngle → applyTimeSafeAngle  (최종 사용 가능 각도)
// 그리고 prepareDartMoveCandidate가 실제로 고른 closeAngleRad를 골든으로 못 박는다.
//
// 부호 비교는 gen-0 경로에서만 일어난다 — sourceNotch 경로는 "source를 감소시키는
// 방향"만 유효 후보라 부호가 해석적으로 확정된다(반대는 더 벌린다). 그래서 이 픽스처는
// gen-0(splitFrontOutline/splitBackOutline, sourceNotch 없음) 시나리오를 쓴다.
//
// 실행: node test/harness/signSelectionFixture.js [--update "reason"]
// ══════════════════════════════════════════════
const path = require("path");
const { createEngine } = require("./loadEngine");
const { moveContext, resolveCutRecipe, budgetRadOf } = require("./dartDriver");
const { GoldenFile } = require("./goldenSnapshot");

const golden = new GoldenFile(path.join(__dirname, "golden", "evaluation.json"));

let pass = 0, fail = 0;
const failures = [];
function check(label, cond, detail) {
  if (cond) { pass++; }
  else { fail++; failures.push({ label, detail }); console.error("  ✗ FAIL:", label, detail ?? ""); }
}
const B = 83, W = 64, BL = 38, dims = { B, W, BL };
const D = (r) => r * 180 / Math.PI;

const SCENARIOS = [
  { name: "sign_front_waist_A",    side: "front", type: "front-waist",         arc: 0.35, piece: "A" },
  { name: "sign_front_sideseam_B", side: "front", type: "side-seam",           arc: 0.45, piece: "B" },
  { name: "sign_front_armUp_A",    side: "front", type: "front-armhole-upper", arc: 0.60, piece: "A" },
  { name: "sign_back_shoulder_A",  side: "back",  type: "back-shoulder",       arc: 0.35, piece: "A" },
];

console.log("\n── 양쪽 부호 비교 (gen-0 경로, 현재 생산 파이프라인 실측) ──");
for (const sc of SCENARIOS) {
  const { engine } = createEngine();
  const ctx = moveContext(engine, sc.side, dims);
  let cut;
  try { cut = resolveCutRecipe(engine, sc.side, ctx, { type: sc.type, arcFraction: sc.arc }); }
  catch (e) { check(`${sc.name}: 레시피 해석`, false, e.message); continue; }

  const split = sc.side === "back"
    ? engine.splitBackOutline(ctx.segs, cut.point, cut.segIndex, ctx.d.pts, ctx.d.formula, B)
    : engine.splitFrontOutline(ctx.segs, cut.point, cut.segIndex, ctx.d.pts, B);
  const rot = sc.piece === "A" ? split.pieceA : split.pieceB;
  const fix = sc.piece === "A" ? split.pieceB : split.pieceA;

  check(`${sc.name}: gen-0 경로 (sourceNotch 없음)`, !rot.sourceNotch, { sourceNotch: !!rot.sourceNotch });

  const rotateSegs = rot.segs, fixedSegs = fix.segsFull || fix.segs;
  const budgetRad = budgetRadOf(engine, sc.side, dims);
  const baseMag = budgetRad; // calc*BaseDartAngle은 abs 반환 = budgetRad와 동일 값

  // 각 부호를 기존 파이프라인 그대로 개별 평가
  const perSign = {};
  for (const sign of [+1, -1]) {
    const physicalRad = engine.findMaxSafeAngle(fixedSegs, rotateSegs, ctx.pivot, sign * baseMag, cut.point);
    const budgetCapped = engine.budgetMaxAngle(fixedSegs, rotateSegs, ctx.pivot, physicalRad, budgetRad);
    const usableRad = engine.applyTimeSafeAngle(fixedSegs, rotateSegs, ctx.pivot, budgetCapped, null);
    perSign[sign > 0 ? "pos" : "neg"] = {
      physicalDeg: +D(physicalRad).toFixed(3),
      usableDeg: +D(usableRad).toFixed(3),
    };
  }

  // 생산 코드가 실제로 고른 결과 (기하 힌트가 아니라 최종 선택)
  const cand = engine.prepareDartMoveCandidate({
    pivot: ctx.pivot, budgetRad, rawBaseAngleRad: baseMag,
    cutPoint: cut.point, rotatePiece: rot, fixedPiece: fix, prevBakedSegments: null,
  });
  const chosenDeg = +D(cand.closeAngleRad).toFixed(3);
  const chosenSign = Math.sign(cand.closeAngleRad) > 0 ? "pos" : "neg";

  // 불변식: 생산이 고른 부호의 usable이 반대 부호보다 크거나 같아야 한다
  // (chooseSignedBaseAngle 규칙 = "usable이 큰 쪽", 동률이면 기하 부호 유지)
  const mChosen = Math.abs(perSign[chosenSign].usableDeg);
  const mOther = Math.abs(perSign[chosenSign === "pos" ? "neg" : "pos"].usableDeg);
  check(`${sc.name}: 선택 부호의 usable ≥ 반대 부호 (오차 1e-3)`, mChosen >= mOther - 1e-3,
    { chosenSign, mChosen, mOther });

  const snap = { perSign, chosenDeg, chosenSign, valid: cand.valid };
  const g = golden.check(sc.name, snap);
  check(`${sc.name}: 골든 일치`, g.length === 0, g.length ? g.slice(0, 3) : undefined);

  console.log(`  ${sc.name}: +${perSign.pos.usableDeg}° / ${perSign.neg.usableDeg}° (physical +${perSign.pos.physicalDeg}/${perSign.neg.physicalDeg}) → 선택 ${chosenDeg}° (${chosenSign})`);
}

if (golden.update) {
  const reason = process.argv.slice(2).filter(a => !a.startsWith("--")).join(" ") || "sign selection baseline";
  golden.save(reason);
  console.log(`\n[golden] ${golden.filePath} 갱신 (사유: ${reason})`);
}
console.log(`\n══════════════════════════════════════════════`);
console.log(`결과: ${pass} PASS / ${fail} FAIL${golden.update ? "  (--update 모드)" : ""}`);
if (fail > 0) {
  console.log("실패 목록:");
  failures.forEach(f => console.log(" -", f.label, JSON.stringify(f.detail)));
  process.exitCode = 1;
}
