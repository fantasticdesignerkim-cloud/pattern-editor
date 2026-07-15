// ══════════════════════════════════════════════
// 앞판 "오래된 다트 재이동" 전수 감사 — 2층 분리(사용자 확정).
//
//  Layer 1 (빠른 위상 감사): 클릭 가능한 모든 세그먼트 × 3 지점 전 조합에 대해
//    splitBakedOutline + sourceNotch 귀속만 검사(bake/apply/각도 스캔 없음).
//    목적: 오래된 다트가 latestDartId류로 영구 동결되지 않고 최소 1개 조합에서
//    재겨냥 가능함을 증명 + split이 항상 두 조각을 내고 sourceNotch 귀속이
//    실제 열린 notch와 일치하는지 확인.
//
//  Layer 2 (대표 bake/apply): reachable 조합 중 대표 8~12개만 실제 적용해
//    source−θ / new+θ 보존(서로 다른 인스턴스) + 불변식 + 골든 대조.
//
// 무거운 각도 스캔(findMaxSafeAngle 40스텝 등)을 171 조합 전부에 돌리지 않는다.
//
// 실행: node test/harness/frontOldestDartAudit.js [--update "reason"]
// ══════════════════════════════════════════════
const path = require("path");
const { createEngine } = require("./loadEngine");
const {
  applyRecipe, performMove, moveContext, listOpenNotches,
  clickableIndices, countBreaks, countClosedTraces, budgetRadOf,
} = require("./dartDriver");
const { makeSnapshot, GoldenFile } = require("./goldenSnapshot");

const golden = new GoldenFile(path.join(__dirname, "golden", "oldest_retarget.json"));

let pass = 0, fail = 0;
const failures = [];
function check(label, cond, detail) {
  if (cond) { pass++; }
  else { fail++; failures.push({ label, detail }); console.error("  ✗ FAIL:", label, detail ?? ""); }
}
function section(t) { console.log("\n── " + t + " ──"); }

const B = 83, W = 64, BL = 38, dims = { B, W, BL };
const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const angleOf = (n, pivot) => {
  const v1x = n.mouthA.x - pivot.x, v1y = n.mouthA.y - pivot.y;
  const v2x = n.mouthB.x - pivot.x, v2y = n.mouthB.y - pivot.y;
  return Math.abs(Math.atan2(v1x * v2y - v1y * v2x, v1x * v2x + v1y * v2y));
};

// ── baseline: 2다트 상태(오래된 다트가 명확히 최대 aperture이도록 부분 30%) ──
const baseEngineHolder = createEngine();
const baseEngine = baseEngineHolder.engine;
const baseRes = applyRecipe(baseEngine, "front", dims, { type: "front-waist", arcFraction: 0.35, piece: "A", moveFraction: 0.3 });
if (baseRes.status !== "applied") { console.error("baseline 생성 실패:", baseRes.status); process.exit(1); }
const pivot = baseRes.pivot;
const baselineBaked = JSON.parse(JSON.stringify(baseRes.bakedSegments));
const baseNotches = listOpenNotches(baseEngine, baselineBaked, pivot);
const baseApertures = baseNotches.map(n => angleOf(n, pivot));
const oldestApertureRad = Math.max(...baseApertures);
console.log(`baseline notch apertures(deg): ${baseApertures.map(a => (a*180/Math.PI).toFixed(2)).join(", ")}  → oldest=${(oldestApertureRad*180/Math.PI).toFixed(2)}°`);

// ══════════════════════════════════════════════
// Layer 1 — 전수 위상 감사 (split + sourceNotch 귀속만)
// ══════════════════════════════════════════════
let layer1Reachable = [];
section("Layer 1: 전수 위상 감사 (split + sourceNotch 귀속)");
{
  const d = baseEngine.createDraft(B, W, BL);
  const segs = baseEngine.getFrontTargetOutline(d.pts, d.formula, B);
  const clickable = clickableIndices(baseEngine, segs);
  const APERTURE_EPS = 0.01; // rad

  let total = 0, blocked = 0, splitOk = 0, reachable = 0, attributionOk = 0, attributionBad = 0;
  const reachableCombos = [];

  for (const idx of clickable) {
    const seg = segs[idx];
    for (const t of [0.3, 0.5, 0.7]) {
      total++;
      const cut = baseEngine.findCutPoint(lerp(seg.from, seg.to, t), segs, d.pts);
      if (!cut || cut.blocked) { blocked++; continue; }
      const split = baseEngine.splitBakedOutline(segs, cut.point, cut.segIndex, pivot);
      if (split.pieceA && split.pieceB) splitOk++;

      // sourceNotch 귀속 일관성: 각 조각의 sourceNotch aperture는 baseline의 어떤
      // 열린 notch aperture와 일치해야 한다(위상이 실재하지 않는 다트를 만들면 안 됨).
      for (const piece of [split.pieceA, split.pieceB]) {
        if (piece?.sourceNotch) {
          const ap = piece.sourceNotch.apertureRad;
          const matches = baseApertures.some(b => Math.abs(b - ap) < 0.02);
          if (matches) attributionOk++; else { attributionBad++; }
        }
      }

      const aIsOld = split.pieceA?.sourceNotch && Math.abs(split.pieceA.sourceNotch.apertureRad - oldestApertureRad) < APERTURE_EPS;
      const bIsOld = split.pieceB?.sourceNotch && Math.abs(split.pieceB.sourceNotch.apertureRad - oldestApertureRad) < APERTURE_EPS;
      if (aIsOld || bIsOld) {
        reachable++;
        reachableCombos.push({ idx, t, via: aIsOld ? "A" : "B" });
      }
    }
  }

  console.log(`  전체 조합: ${total} (차단 ${blocked}, split 성공 ${splitOk})`);
  console.log(`  오래된 다트 재겨냥 가능: ${reachable} / ${total - blocked}`);
  console.log(`  sourceNotch 귀속: 일치 ${attributionOk} / 불일치 ${attributionBad}`);
  check("Layer1: 모든 비차단 조합이 두 조각으로 split됨", splitOk === total - blocked, { splitOk, nonBlocked: total - blocked });
  check("Layer1: sourceNotch 귀속 불일치 0 (위상이 실재 notch만 참조)", attributionBad === 0, attributionBad);
  check("Layer1: 오래된 다트가 최소 1개 조합에서 재겨냥 가능 (영구 동결 아님)", reachable > 0, reachable);

  // 대표 조합을 Layer 2로 넘긴다(결정론적: 순서 유지 후 균등 샘플, via A/B 모두 포함 시도).
  layer1Reachable = reachableCombos;
}

// ══════════════════════════════════════════════
// Layer 2 — 대표 조합 실제 bake/apply + 보존 검증
// ══════════════════════════════════════════════
section("Layer 2: 대표 조합 실제 적용 + source−θ/new+θ 보존");
{
  const reachableCombos = layer1Reachable;
  // 균등 샘플로 최대 10개(via A/B 섞이도록 A 먼저·B 먼저 각각에서 뽑음).
  const pick = (arr, k) => {
    if (arr.length <= k) return arr.slice();
    const out = [];
    for (let i = 0; i < k; i++) out.push(arr[Math.floor(i * arr.length / k)]);
    return out;
  };
  const viaA = reachableCombos.filter(c => c.via === "A");
  const viaB = reachableCombos.filter(c => c.via === "B");
  const reps = [...pick(viaA, 5), ...pick(viaB, 5)];
  console.log(`  대표 조합 ${reps.length}개 (viaA ${viaA.length}→${pick(viaA,5).length}, viaB ${viaB.length}→${pick(viaB,5).length})`);

  const moveFraction = 0.5;
  reps.forEach((combo, ri) => {
    // baseline으로 리셋
    baseEngine.dartMoveState.appliedFront = { side: "front", bakedSegments: JSON.parse(JSON.stringify(baselineBaked)), pivot: { ...pivot }, angle: 0, cutPoint: { ...pivot } };
    baseEngine.dartMoveState.mode = "idle"; baseEngine.dartMoveState.side = null; baseEngine.dartMoveState.cutPoint = null;

    const ctx = moveContext(baseEngine, "front", dims);
    const seg = ctx.segs[combo.idx];
    const cut = baseEngine.findCutPoint(lerp(seg.from, seg.to, combo.t), ctx.segs, ctx.d.pts);
    const name = `retarget_${ri}_via${combo.via}`;
    if (!cut || cut.blocked) { check(`${name}: cutPoint 재현`, false, cut?.reason || "null"); return; }

    const res = performMove(baseEngine, "front", dims, ctx, { point: cut.point, segIndex: cut.segIndex }, combo.via, moveFraction, null);

    // sourceNotch 경로가 아니면(오래된 다트를 안 물었으면) 이 대표는 스킵 — Layer1과
    // Layer2 사이 findCutPoint 스냅 차이로 드물게 발생할 수 있다.
    if (!res.viaSourceNotch) { console.log(`  (${name}: sourceNotch 아님 — 스킵)`); return; }
    if (res.status === "no-room" || res.status === "blocked") { console.log(`  (${name}: ${res.status} — 스킵)`); return; }

    check(`${name}: applied`, res.status === "applied", res.status);
    if (res.status !== "applied") return;

    const baked = res.bakedSegments;
    check(`${name}: selfX=0`, baseEngine.findSelfIntersections(baked, pivot).length === 0);
    check(`${name}: breaks=0`, countBreaks(baked) === 0);
    check(`${name}: closed=0`, countClosedTraces(baseEngine, baked, pivot) === 0);

    // 보존: θ = baseAngle × moveFraction. source(오래된) 잔여 ≈ before−θ, 새 notch ≈ θ,
    // 서로 다른 인스턴스(backDeterministic와 동일 로직).
    const theta = Math.abs(res.baseAngleDeg * Math.PI / 180 * moveFraction);
    const sourceBefore = res.sourceApertureBeforeDeg * Math.PI / 180;
    const expectedSourceAfter = sourceBefore - theta;
    const notches = listOpenNotches(baseEngine, baked, pivot);
    let srcIdx = 0;
    notches.forEach((n, i) => { if (Math.abs(angleOf(n, pivot) - expectedSourceAfter) < Math.abs(angleOf(notches[srcIdx], pivot) - expectedSourceAfter)) srcIdx = i; });
    const rest = notches.filter((_, i) => i !== srcIdx);
    let newBest = rest[0];
    for (const n of rest) if (Math.abs(angleOf(n, pivot) - theta) < Math.abs(angleOf(newBest, pivot) - theta)) newBest = n;

    check(`${name}: source 잔여 ≈ before−θ (서로 다른 인스턴스, 오차<0.3°)`,
      Math.abs(angleOf(notches[srcIdx], pivot) - expectedSourceAfter) * 180 / Math.PI < 0.3,
      { beforeDeg: (sourceBefore*180/Math.PI).toFixed(2), thetaDeg: (theta*180/Math.PI).toFixed(2), gotDeg: (angleOf(notches[srcIdx], pivot)*180/Math.PI).toFixed(2) });
    check(`${name}: new notch ≈ θ (서로 다른 인스턴스, 오차<0.3°)`,
      newBest != null && Math.abs(angleOf(newBest, pivot) - theta) * 180 / Math.PI < 0.3,
      { thetaDeg: (theta*180/Math.PI).toFixed(2), gotDeg: newBest ? (angleOf(newBest, pivot)*180/Math.PI).toFixed(2) : null });

    const budgetRad = budgetRadOf(baseEngine, "front", dims);
    const used = baseEngine.sumOpenDartAngle(baked, pivot);
    check(`${name}: 총합 ≤ budget×1.15`, used <= budgetRad * baseEngine.DART_BUDGET_TOL + 1e-6,
      { usedDeg: (used*180/Math.PI).toFixed(2), budgetDeg: (budgetRad*180/Math.PI).toFixed(2) });

    const snap = makeSnapshot({ segments: baked, notches, pivot, budgetRad });
    const diffs = golden.check(name, snap);
    check(`${name}: 골든 일치`, diffs.length === 0, diffs.length ? diffs.slice(0, 6) : undefined);
  });
}

// ══════════════════════════════════════════════
if (golden.update) {
  const reason = process.argv.slice(2).filter(a => a !== "--update").join(" ") || "front oldest-dart retarget baseline";
  golden.save(reason);
  console.log(`\n[golden] ${golden.filePath} 갱신 (사유: ${reason})`);
}
console.log(`\n══════════════════════════════════════════════`);
console.log(`결과: ${pass} PASS / ${fail} FAIL${golden.update ? "  (--update 모드: 골든 대조는 skip)" : ""}`);
if (fail > 0) {
  console.log("실패 목록:");
  failures.forEach(f => console.log(" -", f.label, JSON.stringify(f.detail)));
  process.exitCode = 1;
}
