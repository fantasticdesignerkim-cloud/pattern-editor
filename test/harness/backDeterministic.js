// ══════════════════════════════════════════════
// 뒤판(pivot=E) 다트이동 결정론적 검증 스위트.
//
// 커버리지 (사용자 요청 순서):
//   1. 첫 다트 풀/부분
//   2. 오래된 다트 재이동 (전수조사 방식으로 재겨냥 가능 지점 확인 + 보존 검증)
//   3. A/B 조각 선택
//   4. 중간각 10/25/50/75/90/100%
//   5. source −θ / new +θ 보존
//   6. selfX/breaks/closed=0, 총량 1.00 (해당하는 경우)
//
// 실행: node test/harness/backDeterministic.js
// ══════════════════════════════════════════════
const { createEngine } = require("./loadEngine");
const { attemptDartMove, listOpenNotches, countBreaks, countClosedTraces, clickableIndices } = require("./dartDriver");
const { mulberry32 } = require("./rng");

let pass = 0, fail = 0;
const failures = [];
function check(label, cond, detail) {
  if (cond) { pass++; }
  else { fail++; failures.push({ label, detail }); console.error("  ✗ FAIL:", label, detail ?? ""); }
}
function section(title) { console.log("\n── " + title + " ──"); }

function near(a, b, eps = 0.01) {
  return a && b && Math.hypot(a.x - b.x, a.y - b.y) < eps;
}
function lerp(a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }

function verifyApplied(engine, r, label, expect = {}) {
  check(`${label}: applied`, r.status === "applied", r.status);
  if (r.status !== "applied") return null;
  const selfX = engine.findSelfIntersections(r.bakedSegments, r.pivot).length;
  const breaks = countBreaks(r.bakedSegments);
  const closed = countClosedTraces(engine, r.bakedSegments, r.pivot);
  check(`${label}: selfX=0`, selfX === 0, selfX);
  check(`${label}: breaks=0`, breaks === 0, breaks);
  check(`${label}: closed=0`, closed === 0, closed);
  return { selfX, breaks, closed };
}

// ══════════════════════════════════════════════
// 1. 첫 다트 풀/부분 + 3. A/B 조각 선택 (4콤보)
// ══════════════════════════════════════════════
section("1+3. 첫 다트 풀/부분 × A/B 조각");
for (const frac of [1.0, 0.5]) {
  for (const piece of ["A", "B"]) {
    const { engine, B, W, BL } = createEngine();
    const rng = mulberry32(1000 + frac * 10 + (piece === "A" ? 0 : 1));
    const r = attemptDartMove(engine, "back", { B, W, BL }, frac, piece, rng);
    const label = `frac=${frac} piece=${piece}`;
    verifyApplied(engine, r, label);
    if (r.status === "applied") {
      // gen0의 "기본 다트"는 이미 존재하는 원본 다트(back-shoulder-dart)를 재분배하는
      // 것이라 열린 다트 총합은 frac과 무관하게 항상 budget(=budgetRad) 근처로 보존돼야
      // 한다 (신규=θ, 기존=budget−θ, 총합=budget 보존 — CLAUDE.md "다트 예산 게이트" 참고).
      const used = engine.sumOpenDartAngle(r.bakedSegments, r.pivot);
      const budget = Math.abs(r.baseAngleDeg * Math.PI / 180);
      const ratio = used / budget;
      check(`${label}: 총합(used) ≈ budget (재분배 보존, 오차<1%)`,
        Math.abs(ratio - 1) < 0.01, { ratio, usedDeg: (used*180/Math.PI).toFixed(2), budgetDeg: (budget*180/Math.PI).toFixed(2) });
    }
  }
}

// ══════════════════════════════════════════════
// 4. 중간각 스윕 10/25/50/75/90/100% (첫 다트, 동일 컷 지점 재현)
// ══════════════════════════════════════════════
section("4. 중간각 스윕 (첫 다트)");
for (const pct of [0.10, 0.25, 0.50, 0.75, 0.90, 1.00]) {
  const { engine, B, W, BL } = createEngine();
  const rng = mulberry32(2025); // 고정 시드 → 매번 같은 cutPoint/조각 재현
  const r = attemptDartMove(engine, "back", { B, W, BL }, pct, "A", rng);
  const label = `pct=${(pct * 100).toFixed(0)}%`;
  verifyApplied(engine, r, label);
  if (r.status === "applied") {
    // 위와 동일한 이유로 총합은 pct와 무관하게 budget 근처로 보존된다.
    const used = engine.sumOpenDartAngle(r.bakedSegments, r.pivot);
    const budget = Math.abs(r.baseAngleDeg * Math.PI / 180);
    check(`${label}: 총합(used) ≈ budget (재분배 보존)`, Math.abs(used / budget - 1) < 0.01,
      { usedDeg: (used*180/Math.PI).toFixed(2), budgetDeg: (budget*180/Math.PI).toFixed(2) });
  }
}

// ══════════════════════════════════════════════
// 2+5. 오래된 다트 재이동 — 전수조사 + source/new 보존
//
// 뒤판은 예산이 하나의 원본 back-shoulder-dart에서 나온다(다트 예산 게이트: 총합은
// 항상 ≈budget으로 보존). 그래서 "완전히 독립적인 두 번째 풀 다트"는 애초에 예산
// 여유가 없어 만들 수 없다 — 두 번째 컷은 항상 첫 번째가 남긴 것(원본 잔여 또는
// 새로 연 다트)을 재분배하는 형태로만 존재한다. 따라서 "2다트 상태"는 dart1을
// 부분(60%)만 회전시켜 한 번에 만든다: 원본 잔여(다트1 이전부터 있던 진짜 "가장
// 오래된" 다트) + 새로 연 다트, 이렇게 자연스러운 2다트가 나온다.
// ══════════════════════════════════════════════
section("2+5. 오래된 다트 재이동 (전수조사 + 보존 검증)");
{
  const { engine, B, W, BL } = createEngine();
  const dims = { B, W, BL };

  // "가장 오래된 다트"의 원본 좌표(dartCenter/dartEnd_) — 이동 전 draft 그대로.
  const d0 = engine.createDraft(B, W, BL);
  const info0 = engine.buildBackShoulderDartInfo(d0.formula, d0.pts, B);
  const angleOfP = (pt, piv) => Math.atan2(pt.y - piv.y, pt.x - piv.x);
  const normA = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a <= -Math.PI) a += 2 * Math.PI; return a; };

  // dart1 — 부분 회전(60%)으로 "원본 잔여 + 신규 다트" 2개를 한 번에 만든다.
  const rng1 = mulberry32(1);
  const r1 = attemptDartMove(engine, "back", dims, 0.6, "A", rng1);
  check("dart1(60%) applied", r1.status === "applied", r1.status);
  if (r1.status !== "applied") {
    console.error("dart1 생성 실패 — 이후 테스트 스킵");
  } else {
    verifyApplied(engine, r1, "dart1(60%) 직후");
    const notchesAfter1 = listOpenNotches(engine, r1.bakedSegments, r1.pivot);
    check("dart1(60%) 후 notch 2개(원본 잔여 + 신규)", notchesAfter1.length === 2, notchesAfter1.length);

    // 원본 잔여 다트 식별: 두 mouth 중 하나가 원본 dartCenter 또는 dartEnd_와 좌표
    // 일치하는 쪽이 "회전 안 한 원래 다리" — 그 다리를 가진 notch가 진짜 오래된 다트.
    const oldNotch = notchesAfter1.find(n =>
      near(n.mouthA, info0.dartCenter, 0.01) || near(n.mouthB, info0.dartCenter, 0.01) ||
      near(n.mouthA, info0.dartEnd_, 0.01) || near(n.mouthB, info0.dartEnd_, 0.01));
    check("원본 잔여 다트(가장 오래됨)를 원본 좌표로 식별", !!oldNotch,
      { dartCenter: info0.dartCenter, dartEnd_: info0.dartEnd_, notches: notchesAfter1 });

    if (oldNotch) {
      const oldAperture0 = Math.abs(normA(angleOfP(oldNotch.mouthB, r1.pivot) - angleOfP(oldNotch.mouthA, r1.pivot)));
      const oldWidth0 = Math.hypot(oldNotch.mouthA.x - oldNotch.mouthB.x, oldNotch.mouthA.y - oldNotch.mouthB.y);
      console.log(`  원본 잔여 다트: aperture=${(oldAperture0*180/Math.PI).toFixed(3)}° width=${oldWidth0.toFixed(3)}cm`);

      // ── 전수조사: 클릭 가능한 모든 세그먼트 × 3개 t지점 중 oldest notch에
      //    도달하는 조합이 존재하는가 (latestDartId 방식이면 0/N이어야 했던 것) ──
      const d = engine.createDraft(B, W, BL);
      const segsNow = engine.getBackTargetOutline(d.pts, d.formula, B);
      const pivot = d.pts.E;
      const clickable = clickableIndices(engine, segsNow);
      let reachableCount = 0;
      const reachableCombos = [];
      for (const idx of clickable) {
        const seg = segsNow[idx];
        for (const t of [0.3, 0.5, 0.7]) {
          const pt = lerp(seg.from, seg.to, t);
          const cutRes = engine.findCutPointBack(pt, segsNow, d.pts, d.formula, B);
          if (!cutRes || cutRes.blocked) continue;
          const split = engine.splitBakedOutline(segsNow, cutRes.point, cutRes.segIndex, pivot);
          // pivot(E)은 절대 움직이지 않으므로 aperture(=신호각 절댓값)는 불변 물리량이다.
          const aIsOld = split.pieceA.sourceNotch && Math.abs(split.pieceA.sourceNotch.apertureRad - oldAperture0) < 0.01;
          const bIsOld = split.pieceB.sourceNotch && Math.abs(split.pieceB.sourceNotch.apertureRad - oldAperture0) < 0.01;
          if (aIsOld || bIsOld) {
            reachableCount++;
            reachableCombos.push({ idx, t, via: aIsOld ? "A" : "B", cutPoint: cutRes.point, segIndex: cutRes.segIndex });
          }
        }
      }
      const totalCombos = clickable.length * 3;
      console.log(`  oldest-dart 재겨냥 가능 조합: ${reachableCount} / ${totalCombos}`);
      check("oldest dart가 최소 1개 조합에서 재겨냥 가능 (영구 동결 아님)", reachableCount > 0, reachableCount);

      // ── source −θ / new +θ 보존: 재겨냥 가능한 조합 중 대표 몇 개에 대해
      //    A/B 각각, 중간각 여러 개로 실제 적용해 보존을 확인한다.
      const baselineBaked = JSON.parse(JSON.stringify(r1.bakedSegments));

      const byVia = { A: reachableCombos.find(c => c.via === "A"), B: reachableCombos.find(c => c.via === "B") };
      for (const via of ["A", "B"]) {
        const combo = byVia[via];
        if (!combo) { console.log(`  (via=${via} 조합 없음 — 스킵)`); continue; }
        for (const pct of [0.10, 0.25, 0.50, 0.75, 0.90, 1.00]) {
          // 매 시행 전 2다트 기준선으로 복원 (독립 시행 보장)
          engine.dartMoveState.appliedBack = { side: "back", bakedSegments: JSON.parse(JSON.stringify(baselineBaked)), pivot: { ...pivot }, angle: 0, cutPoint: { ...pivot } };
          engine.dartMoveState.mode = "idle"; engine.dartMoveState.side = null; engine.dartMoveState.cutPoint = null;

          const d3 = engine.createDraft(B, W, BL);
          const segs3 = engine.getBackTargetOutline(d3.pts, d3.formula, B);
          const cutRes = engine.findCutPointBack(lerp(segs3[combo.idx].from, segs3[combo.idx].to, combo.t), segs3, d3.pts, d3.formula, B);
          if (!cutRes || cutRes.blocked) { console.log(`  (via=${via} pct=${pct} cutPoint 재현 실패 — 스킵)`); continue; }
          const split = engine.splitBakedOutline(segs3, cutRes.point, cutRes.segIndex, pivot);
          const rotatePiece = combo.via === "A" ? split.pieceA : split.pieceB;
          const fixedPiece = combo.via === "A" ? split.pieceB : split.pieceA;
          if (!rotatePiece.sourceNotch) { console.log(`  (via=${via} pct=${pct} sourceNotch 소실 — 스킵)`); continue; }

          const rotateSegs = rotatePiece.segs, fixedSegs = fixedPiece.segsFull || fixedPiece.segs;
          const budgetRad = Math.abs(engine.calcBackBaseDartAngle(engine.buildBackShoulderDartInfo(d3.formula, d3.pts, B)));

          // ── baseAngle 결정: 프로덕션과 같은 순수 함수 (legacy findMaxSafeAngle→budgetMaxAngle→
          //    applyTimeSafeAngle 3줄 복제를 제거, C5c) ──
          const candidate = engine.prepareDartMoveCandidate({
            pivot,
            budgetRad,
            rawBaseAngleRad: rotatePiece.sourceNotch.signedAngleRad,
            cutPoint: cutRes.point,
            rotatePiece, fixedPiece,
            prevBakedSegments: engine.dartMoveState.appliedBack.bakedSegments,
          });
          if (!candidate.valid) { console.log(`  (via=${via} pct=${pct} no-room — 스킵)`); continue; }
          const ca = candidate.closeAngleRad;

          const sourceApertureBefore = rotatePiece.sourceNotch.apertureRad;

          engine.dartMoveState.side = "back";
          engine.dartMoveState.cutPoint = cutRes.point;
          engine.dartMoveState.cutSegIndex = cutRes.segIndex;
          engine.dartMoveState.rotatePts = rotatePiece.pts;
          engine.dartMoveState.fixedPts = fixedPiece.pts;
          engine.dartMoveState.rotateSegs = rotateSegs;
          engine.dartMoveState.fixedSegs = fixedSegs;
          engine.dartMoveState.rotateHit = rotatePiece.hit;
          engine.dartMoveState.fixedHit = fixedPiece.hit;
          engine.dartMoveState.mode = "drag";
          engine.dartMoveState.baseAngle = ca;
          engine.dartMoveState.evalCtx = candidate.evalCtx;
          // 요청각도 프로덕션과 같은 ④를 탄다(직접 userAngle 세팅 금지, C5c).
          const _resolved = engine.resolveRequestedAngle(candidate.evalCtx, ca * pct, ca);
          engine.dartMoveState.userAngle = _resolved.resolvedAngleRad;
          engine.applyDartMove();

          const theta = _resolved.resolvedAngleRad; // ④가 확정한 실제 회전각.
          const applied = engine.dartMoveState.mode === "idle" && engine.dartMoveState.cutPoint === null;
          const label = `oldest-retarget via=${via} pct=${(pct * 100).toFixed(0)}%`;

          // MIN_DART_ANGLE_RAD 미만이면 applyDartMove 자체가 정직하게 차단한다(퇴화
          // 다트 방지 안전망, 정상 동작) — 이 경우는 실패가 아니라 기대된 스킵이다.
          if (Math.abs(theta) < engine.MIN_DART_ANGLE_RAD) {
            console.log(`  (via=${via} pct=${pct} θ=${(theta*180/Math.PI).toFixed(2)}° < MIN_DART_ANGLE_RAD — 정상 차단, 스킵)`);
            continue;
          }
          check(`${label}: applied`, applied, { thetaDeg: (theta*180/Math.PI).toFixed(2) });
          if (!applied) continue;

          const baked = engine.dartMoveState.appliedBack.bakedSegments;
          const selfX = engine.findSelfIntersections(baked, pivot).length;
          const breaks = countBreaks(baked);
          const closed = countClosedTraces(engine, baked, pivot);
          check(`${label}: selfX=0`, selfX === 0, selfX);
          check(`${label}: breaks=0`, breaks === 0, breaks);
          check(`${label}: closed=0`, closed === 0, closed);

          // source −θ / new +θ 보존 확인: source notch aperture는 정확히 |θ|만큼 줄고,
          // 그 자리에서 새로 연 notch aperture는 정확히 |θ|여야 한다(둘의 합=변화없음).
          //
          // 주의(50% 케이스 함정): expectedSourceAfter(=before−θ)와 θ는 pct=50%일 때
          // 정확히 같은 값이 된다(before−0.5·before = 0.5·before = θ). 두 후보를
          // notch 배열 전체에서 각각 독립적으로 "가장 가까운 값"을 고르면, 같은 notch
          // 하나가 두 체크 모두를 통과시켜버릴 수 있다(서로 다른 두 노치가 실제로
          // 존재하는지 확인 못 함). 그래서 (1) 먼저 source 후보를 고르고 (2) 그 노치를
          // 제외한 나머지에서 new 후보를 골라 **서로 다른 notch 인스턴스임을 구조적으로
          // 보장**한다.
          //
          // notch 총개수: 여기서 재겨냥하는 oldNotch는 원본 back-shoulder-dart의
          // 비대칭 잔여(위 "뒤판 검증" 소견 — apex 기준 두 다리 반지름이 달라 각도상
          // 완전히 닫혀도 ~0.1cm 잔여 sliver가 남을 수 있음, 사용자 확인: 버그 아님).
          // 그래서 개수는 정확히 baseline+1로 강제하지 않고, "baseline+1 또는 그
          // sliver로 설명되는 baseline+2"까지만 허용하며 초과분 각 notch의 폭이
          // 알려진 한계(0.15cm) 이내인지로 검증한다 — 설명 안 되는 여분은 그대로 실패.
          const notchesNow = listOpenNotches(engine, baked, pivot);
          const angleOfNow = (n) => Math.abs(normA(angleOfP(n.mouthB, pivot) - angleOfP(n.mouthA, pivot)));
          const widthOfNow = (n) => Math.hypot(n.mouthA.x - n.mouthB.x, n.mouthA.y - n.mouthB.y);
          const expectedSourceAfter = sourceApertureBefore - Math.abs(theta);

          // (1) source 잔여에 가장 가까운 notch를 먼저 고른다.
          let sourceIdx = 0;
          notchesNow.forEach((n, i) => {
            if (Math.abs(angleOfNow(n) - expectedSourceAfter) < Math.abs(angleOfNow(notchesNow[sourceIdx]) - expectedSourceAfter)) sourceIdx = i;
          });
          // (2) 그 notch를 제외한 나머지에서 θ(새 notch)에 가장 가까운 것을 고른다 —
          //     같은 notch가 두 역할을 겸하지 못하도록 구조적으로 배제.
          const rest = notchesNow.filter((_, i) => i !== sourceIdx);
          let newBest = rest[0];
          for (const n of rest) if (Math.abs(angleOfNow(n) - Math.abs(theta)) < Math.abs(angleOfNow(newBest) - Math.abs(theta))) newBest = n;

          const gotSource = angleOfNow(notchesNow[sourceIdx]);
          const gotNew = newBest ? angleOfNow(newBest) : null;
          check(`${label}: source notch 잔여 ≈ before−θ (서로 다른 인스턴스, 오차<0.3°)`,
            Math.abs(gotSource - expectedSourceAfter) * 180 / Math.PI < 0.3,
            { sourceApertureBeforeDeg: (sourceApertureBefore*180/Math.PI).toFixed(2), thetaDeg: (Math.abs(theta)*180/Math.PI).toFixed(2), expectedDeg: (expectedSourceAfter*180/Math.PI).toFixed(2), gotDeg: (gotSource*180/Math.PI).toFixed(2) });
          check(`${label}: new notch ≈ θ (서로 다른 인스턴스, 오차<0.3°)`,
            gotNew != null && Math.abs(gotNew - Math.abs(theta)) * 180 / Math.PI < 0.3,
            { thetaDeg: (Math.abs(theta)*180/Math.PI).toFixed(2), gotDeg: gotNew != null ? (gotNew*180/Math.PI).toFixed(2) : null });

          const matchedIdxs = new Set([sourceIdx, notchesNow.indexOf(newBest)]);
          const unexplained = notchesNow.filter((_, i) => !matchedIdxs.has(i));
          const expectedCount = notchesAfter1.length + 1; // source(잔존/거의0) + new, 정상 케이스
          check(`${label}: notch 총개수 (기대 ${expectedCount}, 여분은 전부 알려진 sliver(<0.15cm)여야 함)`,
            notchesNow.length === expectedCount ||
              (notchesNow.length > expectedCount && unexplained.every(n => widthOfNow(n) < 0.15)),
            { got: notchesNow.length, expectedCount, unexplainedWidths: unexplained.map(n => widthOfNow(n).toFixed(4)) });

          const usedTotal = engine.sumOpenDartAngle(baked, pivot);
          const budgetDeg = budgetRad * 180 / Math.PI;
          const usedDeg = usedTotal * 180 / Math.PI;
          check(`${label}: 총합 ≤ budget×TOL`, usedTotal <= budgetRad * engine.DART_BUDGET_TOL + 1e-6,
            { usedDeg: usedDeg.toFixed(2), budgetDeg: budgetDeg.toFixed(2) });
          console.log(`    via=${via} pct=${(pct*100).toFixed(0)}%: θ=${(theta*180/Math.PI).toFixed(2)}° sourceBefore=${(sourceApertureBefore*180/Math.PI).toFixed(2)}° usedTotal=${usedDeg.toFixed(2)}° (budget=${budgetDeg.toFixed(2)}°)`);
        }
      }
    }
  }
}

// ══════════════════════════════════════════════
console.log(`\n══════════════════════════════════════════════`);
console.log(`결과: ${pass} PASS / ${fail} FAIL`);
if (fail > 0) {
  console.log("실패 목록:");
  failures.forEach(f => console.log(" -", f.label, JSON.stringify(f.detail)));
  process.exitCode = 1;
}
