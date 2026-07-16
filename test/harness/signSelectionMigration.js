// ══════════════════════════════════════════════
// C4 마이그레이션 대조 — legacy 부호 선택 vs interval 기반 `selectRotationSign`.
//
// **목적(사용자 지시)**: `chooseSignedBaseAngle`을 바로 지우지 않고 새 선택기를 **병렬
// 실행**해, 넓은 결정론 매트릭스에서 **선택 부호**와 **최대 사용 가능 각도**를 비교한다.
// 불일치가 있으면 커밋하지 않고 케이스를 분해해 보고한다. 동치가 확인된 뒤에만
// `prepareDartMoveCandidate`를 전환한다.
//
// **legacy 기준 = `legacyChoose()`** — `prepareDartMoveCandidate`의 분기 로직을 그대로
// 옮긴 **의도적·한시적 복제**다:
//   - gen-0 경로:      choosePhysicalCloseAngle → chooseSignedBaseAngle
//                      (부호마다 findMaxSafeAngle → budgetMaxAngle → applyTimeSafeAngle)
//   - sourceNotch 경로: notch가 부호 확정 → 같은 세 캡을 단일 부호에 적용
//
// ⚠️ **왜 prepareDartMoveCandidate를 직접 부르지 않는가**: C4가 그 함수를 새 선택기로
// 전환하는 순간, 그걸 legacy 기준으로 삼으면 **자기 자신과의 비교**가 되어 무의미해진다.
// legacy 함수들(chooseSignedBaseAngle 등)은 C5/C7에서 호출 0이 될 때까지 남으므로,
// 여기서 직접 불러야 전환 후에도 대조가 살아있다. 이 복제는 legacy가 삭제될 때 함께
// 사라진다(그때 이 파일도 목적을 다한다).
//
// **전환 전 실측 근거**: 이 복제가 실제 프로덕션과 같은 값을 낸다는 것은 배선 **전에**
// `prepareDartMoveCandidate`를 legacy 기준으로 놓고 돌린 **868조합 전수 불일치 0**으로
// 확인했다(stride=1, 226초).
//
// **new = `selectRotationSign`**: ② findPhysicalSweepLimit → ③ findApplicableIntervals,
// 부호별 `maxReachableMagRad`(구간 중 최대 toMagRad)로 비교.
//
// ⚠️ 두 경로는 **해상도와 구조가 다르다**(legacy: 24/40스텝 3중 스캔 · 예산을 먼저
// 자르고 그 안에서 델타 스캔 / new: 60스텝 단일 스캔 · 물리 한계 전체에서 구간 탐색).
// 따라서 차이가 나오는 것 자체가 정보다 — 이 파일은 **동치를 강요하지 않고 실측해서
// 분해 보고**한다.
//
// 실행: node test/harness/signSelectionMigration.js [--stride N] [--verbose]
// ══════════════════════════════════════════════
const { createEngine } = require("./loadEngine");
const {
  applyRecipe, moveContext, resolveCutRecipe, clickableIndices, budgetRadOf,
} = require("./dartDriver");

const argOf = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : dflt;
};
const STRIDE  = argOf("--stride", 4);        // 세그먼트 표본 간격(넓이 vs 시간)
const VERBOSE = process.argv.includes("--verbose");

const B = 83, W = 64, BL = 38, dims = { B, W, BL };
const D = (r) => r * 180 / Math.PI;
const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

const MAG_TOL_DEG = 0.1;   // 스캔 해상도 차이로 이 정도는 정상 — 넘으면 분해 보고 대상

let pass = 0, fail = 0;
const failures = [];
function check(label, cond, detail) {
  if (cond) { pass++; }
  else { fail++; failures.push({ label, detail }); console.error("  ✗ FAIL:", label, detail ?? ""); }
}

// ── legacy 부호/각도 선택 (prepareDartMoveCandidate의 분기 로직 복제 — 위 ⚠️ 참고) ──
function legacyChoose(engine, { pivot, budgetRad, rawBase, cutPoint, rot, fix, prevBaked }) {
  const rotateSegs = rot.segs;
  const fixedSegs  = fix.segsFull || fix.segs;
  const sourceNotch = rot.sourceNotch || null;

  if (sourceNotch) {
    const targetSigned = sourceNotch.signedAngleRad;
    const sign = Math.sign(targetSigned) || 1;
    const mag  = Math.min(Math.abs(targetSigned), budgetRad);
    let a = sign * mag;
    a = engine.findMaxSafeAngle(fixedSegs, rotateSegs, pivot, a, cutPoint);
    a = engine.budgetMaxAngle(fixedSegs, rotateSegs, pivot, a, budgetRad);
    a = engine.applyTimeSafeAngle(fixedSegs, rotateSegs, pivot, a, prevBaked);
    return a;
  }
  let baseAngle = rawBase;
  if (rot.pts && rot.pts.length >= 3) {
    baseAngle = engine.choosePhysicalCloseAngle({
      pivot, cutPoint, rotatePts: rot.pts, absAngle: baseAngle,
    });
  }
  return engine.chooseSignedBaseAngle(fixedSegs, rotateSegs, pivot, Math.abs(baseAngle),
    cutPoint, budgetRad, Math.sign(baseAngle) || 1, prevBaked);
}

// ── 한 조합에서 legacy와 new를 나란히 평가한다 ──
function compareOne(engine, side, ctx, cut, pieceChoice, prevBaked) {
  const split = ctx.isBaked
    ? engine.splitBakedOutline(ctx.segs, cut.point, cut.segIndex, ctx.pivot)
    : (side === "back"
        ? engine.splitBackOutline(ctx.segs, cut.point, cut.segIndex, ctx.d.pts, ctx.d.formula, B)
        : engine.splitFrontOutline(ctx.segs, cut.point, cut.segIndex, ctx.d.pts, B));
  if (!split || !split.pieceA || !split.pieceB) return null;

  const rot = pieceChoice === "A" ? split.pieceA : split.pieceB;
  const fix = pieceChoice === "A" ? split.pieceB : split.pieceA;
  if (!rot.segs?.length || !fix.segs?.length) return null;

  const budgetRad = budgetRadOf(engine, side, dims);
  const rawBase = side === "back"
    ? engine.calcBackBaseDartAngle(engine.buildBackShoulderDartInfo(ctx.d.formula, ctx.d.pts, B))
    : engine.calcFrontBaseDartAngle(ctx.d.pts, B);

  // ── legacy: 전환 전 프로덕션과 같은 분기·같은 캡 순서 ──
  let legacyAngle;
  try {
    legacyAngle = legacyChoose(engine, {
      pivot: ctx.pivot, budgetRad, rawBase, cutPoint: cut.point, rot, fix, prevBaked,
    });
  } catch (e) { return { error: "legacy: " + e.message }; }

  // ── new: interval 기반 선택기 ──
  const evalCtx = {
    fixedSegs: fix.segsFull || fix.segs, rotateSegs: rot.segs, pivot: ctx.pivot,
    budgetRad, prevBakedSegments: prevBaked, sourceNotch: rot.sourceNotch || null,
  };
  // 기하 부호는 legacy와 동일하게 구한다(tie-breaker로만 쓰인다).
  let geomSign = 1;
  if (!rot.sourceNotch && rot.pts && rot.pts.length >= 3) {
    geomSign = Math.sign(engine.choosePhysicalCloseAngle({
      pivot: ctx.pivot, cutPoint: cut.point, rotatePts: rot.pts, absAngle: rawBase,
    })) || 1;
  }
  let sel;
  try {
    sel = engine.selectRotationSign(evalCtx, { baseMagRad: rawBase, cutPoint: cut.point, geomSign });
  } catch (e) { return { error: "new: " + e.message }; }

  return {
    viaSourceNotch: !!rot.sourceNotch,
    legacySign: Math.sign(legacyAngle) || 0,
    legacyMagDeg: Math.abs(D(legacyAngle)),
    newSign: sel.selectedSign,
    newMagDeg: D(sel.selectedMaxReachableMagRad),
    reason: sel.reason,
    candidates: sel.candidates.map(c => ({
      sign: c.sign,
      physDeg: +D(c.physicalLimitMagRad).toFixed(3),
      maxReachDeg: +D(c.maxReachableMagRad).toFixed(3),
      foundBy: c.foundBy,
      blockedBy: c.blockedBy,
      evals: c.scan.evaluated + c.scan.refined,
    })),
    evals: sel.candidates.reduce((n, c) => n + c.scan.evaluated + c.scan.refined, 0),
  };
}

// ── 시나리오 정의: gen-0 / sourceNotch(1다트·2다트) × 앞뒤 ──
const SCENARIOS = [
  { name: "front_gen0", side: "front", setup: null },
  { name: "back_gen0",  side: "back",  setup: null },
  { name: "front_1dart", side: "front",
    setup: { type: "front-waist", arcFraction: 0.35, piece: "A", moveFraction: 0.5 } },
  { name: "front_2dart", side: "front",
    setup: [{ type: "front-waist", arcFraction: 0.35, piece: "A", moveFraction: 0.5 },
            { type: "side-seam",   arcFraction: 0.45, piece: "B", moveFraction: 0.4 }] },
  { name: "back_1dart", side: "back",
    setup: { type: "back-shoulder", arcFraction: 0.35, piece: "A", moveFraction: 0.5 } },
  // C0가 확정한 비단조 다중구간 setup — legacy의 단조 가정(예산을 먼저 자르고 그 안에서
  // 델타 스캔)과 new의 구간 탐색이 가장 갈리기 쉬운 지점이다.
  { name: "front_nonmono", side: "front",
    setup: { type: "front-armhole-lower", arcFraction: 0.5, piece: "B", moveFraction: 0.5 } },
];

const rows = [];
const mismatches = [];
let combos = 0, errors = 0;

for (const sc of SCENARIOS) {
  const { engine } = createEngine();
  let prevBaked = null;
  if (sc.setup) {
    const steps = Array.isArray(sc.setup) ? sc.setup : [sc.setup];
    let ok = true;
    for (const st of steps) {
      const r = applyRecipe(engine, sc.side, dims, st);
      if (r.status !== "applied") { ok = false; console.error(`  ! ${sc.name} setup 실패: ${r.status}`); break; }
      prevBaked = r.bakedSegments;
    }
    if (!ok) continue;
  }
  const ctx = moveContext(engine, sc.side, dims);   // isBaked는 setup 적용 여부를 반영한다
  const idxs = clickableIndices(engine, ctx.segs);
  const sampled = idxs.filter((_, i) => i % STRIDE === 0);

  let scCombos = 0, scMismatch = 0, scEvalSum = 0, scEvalMax = 0;
  for (const segIndex of sampled) {
    const seg = ctx.segs[segIndex];
    if (!seg?.from || !seg?.to) continue;
    for (const frac of [0.35, 0.65]) {
      const pt = lerp(seg.from, seg.to, frac);
      const cut = sc.side === "back"
        ? engine.findCutPointBack(pt, ctx.segs, ctx.d.pts, ctx.d.formula, B)
        : engine.findCutPoint(pt, ctx.segs, ctx.d.pts);
      if (!cut || cut.blocked) continue;
      for (const piece of ["A", "B"]) {
        const r = compareOne(engine, sc.side, ctx, cut, piece, prevBaked);
        if (!r) continue;
        if (r.error) { errors++; continue; }
        combos++; scCombos++;
        scEvalSum += r.evals; if (r.evals > scEvalMax) scEvalMax = r.evals;

        const signMismatch = r.legacySign !== 0 && r.newSign !== 0 && r.legacySign !== r.newSign;
        const magDiff = r.newMagDeg - r.legacyMagDeg;
        const magMismatch = Math.abs(magDiff) > MAG_TOL_DEG;
        if (signMismatch || magMismatch) {
          scMismatch++;
          mismatches.push({
            scenario: sc.name, segIndex, segType: seg.type, frac, piece,
            viaSourceNotch: r.viaSourceNotch, reason: r.reason,
            legacy: `${r.legacySign > 0 ? "+" : "-"}${r.legacyMagDeg.toFixed(3)}°`,
            new:    `${r.newSign > 0 ? "+" : "-"}${r.newMagDeg.toFixed(3)}°`,
            diffDeg: +magDiff.toFixed(3),
            kind: signMismatch ? "SIGN" : (magDiff > 0 ? "MAG(new↑)" : "MAG(new↓)"),
            candidates: r.candidates,
          });
        }
        if (VERBOSE) {
          console.log(`    [${sc.name}] seg${segIndex}(${seg.type}) f=${frac} ${piece} ` +
            `legacy=${r.legacySign > 0 ? "+" : "-"}${r.legacyMagDeg.toFixed(2)}° ` +
            `new=${r.newSign > 0 ? "+" : "-"}${r.newMagDeg.toFixed(2)}° (${r.reason})`);
        }
      }
    }
  }
  rows.push({ name: sc.name, combos: scCombos, mismatch: scMismatch,
    evalAvg: scCombos ? scEvalSum / scCombos : 0, evalMax: scEvalMax });
  console.log(`  ${sc.name.padEnd(13)} 조합 ${String(scCombos).padStart(3)} · 불일치 ${scMismatch} · ` +
    `평가 평균 ${(scCombos ? scEvalSum / scCombos : 0).toFixed(1)} / 최악 ${scEvalMax}`);
}

console.log(`\n── 대조 결과 ──`);
console.log(`  총 조합 ${combos} · 불일치 ${mismatches.length} · 예외 ${errors}`);

if (mismatches.length) {
  console.log(`\n── 불일치 분해 (${mismatches.length}건) ──`);
  const byKind = {};
  for (const m of mismatches) byKind[m.kind] = (byKind[m.kind] || 0) + 1;
  console.log(`  종류별: ${Object.entries(byKind).map(([k, v]) => `${k}=${v}`).join(" · ")}`);
  const show = mismatches.slice(0, 25);
  for (const m of show) {
    console.log(`\n  [${m.kind}] ${m.scenario} seg${m.segIndex}(${m.segType}) frac=${m.frac} piece=${m.piece}` +
      `${m.viaSourceNotch ? " · sourceNotch" : " · gen-0"}`);
    console.log(`      legacy=${m.legacy}  new=${m.new}  diff=${m.diffDeg}°  reason=${m.reason}`);
    for (const c of m.candidates) {
      console.log(`      후보 sign=${c.sign > 0 ? "+" : "-"} physLimit=${c.physDeg}° ` +
        `maxReach=${c.maxReachDeg}° foundBy=${c.foundBy} blockedBy=${c.blockedBy} 평가=${c.evals}`);
    }
  }
  if (mismatches.length > show.length) console.log(`\n  ... 외 ${mismatches.length - show.length}건`);
}

check("legacy와 new의 부호·최대 사용 가능 각도 동치", mismatches.length === 0,
  { mismatches: mismatches.length, combos });

console.log(`\n══════════════════════════════════════════════`);
console.log(`결과: ${pass} PASS / ${fail} FAIL   (조합 ${combos}, stride=${STRIDE})`);
if (fail > 0) {
  console.log("실패 목록:");
  failures.forEach(f => console.log(" -", f.label, JSON.stringify(f.detail)));
  process.exitCode = 1;
}
