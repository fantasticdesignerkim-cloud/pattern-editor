// ══════════════════════════════════════════════
// 양쪽 회전 부호 비교 골든 (gen-0 경로) — sign-selection.json 을 잠근다.
//
// 이 골든은 C0에서 커밋된 **잠긴 shape 골든**이다(동작 불변식). 원래는 legacy 파이프라인
// (findMaxSafeAngle → budgetMaxAngle → applyTimeSafeAngle)으로 perSign을 계산했는데,
// C5d에서 그 legacy 체인이 삭제됐다. 이 검증기는 **현재 C4 API로 같은 snapshot을
// 재현**해 골든을 그대로 검증한다(골든은 한 바이트도 안 바꾼다).
//
// 재현 매핑(핵심): 예전 legacy 체인이 부호마다 따로 돌리던 세 단계는 이제
// `selectRotationSign`의 candidate 하나에 접혀 있다 —
//   physicalDeg(② 물리 한계)   = sign × candidate.physicalLimitMagRad   (findPhysicalSweepLimit)
//   usableDeg(최종 사용가능 각도) = sign × candidate.maxReachableMagRad   (findMaxApplicableMagnitude)
// 이 둘은 legacy `findMaxSafeAngle`·`budgetMaxAngle→applyTimeSafeAngle`와 값이 같아야
// 한다(C4가 signSelectionMigration으로 868조합 불일치 0 검증한 그 동치). chosen은
// `prepareDartMoveCandidate`가 그대로 반환한다. 그래서 시나리오당 **호출 한 번**이면 된다.
//
// gen-0(sourceNotch 없음)만 쓴다 — sourceNotch 경로는 부호가 해석적으로 확정돼 비교가 없다.
//
// ⚠️ 골든이 재현 안 되면 골든을 고치지 말고 **즉시 중단**하고 어느 필드가 왜 다른지 보고할 것.
//
// 실행: node test/harness/signSelectionFixture.js [--update "reason"]
// ══════════════════════════════════════════════
const path = require("path");
const { createEngine } = require("./loadEngine");
const { moveContext, resolveCutRecipe, budgetRadOf } = require("./dartDriver");
const { GoldenFile } = require("./goldenSnapshot");

const golden = new GoldenFile(path.join(__dirname, "golden", "sign-selection.json"));

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

console.log("\n── 양쪽 부호 비교 (gen-0 경로, 현재 C4 API로 재현) ──");
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

  const budgetRad = budgetRadOf(engine, sc.side, dims);
  const baseMag = budgetRad; // calc*BaseDartAngle은 abs 반환 = budgetRad와 동일 값

  // 생산 코드가 실제로 고른 결과 + 부호별 근거(selection.candidates)를 한 번에 얻는다.
  const cand = engine.prepareDartMoveCandidate({
    pivot: ctx.pivot, budgetRad, rawBaseAngleRad: baseMag,
    cutPoint: cut.point, rotatePiece: rot, fixedPiece: fix, prevBakedSegments: null,
  });

  // 부호별 physical/usable을 candidate에서 재구성 (pos 먼저, neg 뒤 — 원래 snapshot 순서).
  const perSign = {};
  let missing = false;
  for (const sign of [+1, -1]) {
    const c = cand.selection.candidates.find(x => x.sign === sign);
    if (!c) { missing = true; break; }
    perSign[sign > 0 ? "pos" : "neg"] = {
      physicalDeg: +D(sign * c.physicalLimitMagRad).toFixed(3),
      usableDeg: +D(sign * c.maxReachableMagRad).toFixed(3),
    };
  }
  check(`${sc.name}: 두 부호 candidate 존재 (gen-0)`, !missing, { candidates: cand.selection.candidates.length });
  if (missing) continue;

  const chosenDeg = +D(cand.closeAngleRad).toFixed(3);
  const chosenSign = Math.sign(cand.closeAngleRad) > 0 ? "pos" : "neg";

  // 불변식: 선택 부호의 usable ≥ 반대 부호 (선택기 규칙 = "usable이 큰 쪽").
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
