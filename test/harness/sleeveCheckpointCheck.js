// ══════════════════════════════════════════════
// sleeveCheckpointCheck.js — js/sleeveCheckpoint.js 완료 게이트·스냅샷·스테일 회귀.
// 실제 모듈을 vm 으로 실행하고, bodiceCheckpoint/designSleeve/designWorkflow 는 스텁으로
// 최소 제공한다(게이트 판정·불변 스냅샷·형상전용 스테일·몸판 무효화가 대상 — cap 기하
// 자체는 designSleeveCheck 가 이미 고정).
//   node test/harness/sleeveCheckpointCheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "..", "js", "sleeveCheckpoint.js"), "utf8");
let PASS = 0, FAIL = 0; const fails = [];
function ok(cond, name) { if (cond) PASS++; else { FAIL++; fails.push(name); } }
const near = (a, b, e = 1e-3) => Math.abs(a - b) < e;

// ── 스텁 상태(테스트마다 조정) ──
let BODICE = null;            // bodiceCheckpoint.latest 반환
let BODICE_STALE = false;     // bodiceCheckpoint.isCurrentBodiceChanged
let PRIM = null;              // designSleeve.capPrimitives 반환
let SELF_X = false;           // designSleeve.sleeveOutlineSelfIntersects
let PROJECT = null;

const sandbox = { window: {}, Math, JSON, Object, Array, isFinite, Date };
sandbox.window.designWorkflow = { current: () => PROJECT };
sandbox.window.bodiceCheckpoint = {
  latest: () => BODICE,
  isCurrentBodiceChanged: () => BODICE_STALE
};
sandbox.window.designSleeve = {
  capPrimitives: () => PRIM,
  sleeveOutlineSelfIntersects: () => SELF_X
};
vm.createContext(sandbox);
vm.runInContext(SRC, sandbox, { filename: "sleeveCheckpoint.js" });
const SC = sandbox.window.sleeveCheckpoint;

// 기본 유효 형상: capPrimitives(앞 21.8 / 뒤 23.6), 몸판 진동(앞 20.6 / 뒤 21.6) → 이세 +1.2/+2
function primOf(f, b) {
  return {
    frontPrimitives: [{ kind: "cubic", from: { x: 1, y: 1 }, c1: { x: 2, y: 0 }, c2: { x: 3, y: 0 }, to: { x: 4, y: 1 } }],
    backPrimitives: [{ kind: "cubic", from: { x: 0, y: 1 }, c1: { x: -1, y: 0 }, c2: { x: -2, y: 0 }, to: { x: -3, y: 1 } }],
    splitPoint: { x: 0, y: 0 },
    lengths: { front: f, back: b, total: f + b }
  };
}
function capLine(a, c) {
  const segs = [];
  a.forEach((p, i) => { if (i) segs.push({ kind: "line", from: a[i - 1], to: p }); });
  return { id: "sleeve-cap-1", piece: "sleeve", role: "boundary", managedBy: "sleeve-cap", splitAnchorIndex: c, segments: segs };
}
function fakeProject(opts) {
  opts = opts || {};
  const mode = opts.mode || "parametric";
  const geom = { outline: [{ kind: "line", from: { x: 0, y: 0 }, to: { x: 24, y: 0 } }], construction: [] };
  const pl = [];
  if (mode === "manual" && opts.capLine !== false) pl.push(capLine([{ x: 0, y: 0 }, { x: 12, y: -13 }, { x: 24, y: 0 }], 1));
  return {
    sourceBlock: { id: "block-1", version: 2, canonicalHash: "abc123" },
    working: {
      geometry: { sleeve: geom },
      sleeveDraft: {
        sourceBodiceHash: opts.sourceHash != null ? opts.sourceHash : "H1",
        mode: mode,
        capLineId: mode === "manual" ? "sleeve-cap-1" : null,
        capInvalid: !!opts.capInvalid, capInvalidReason: opts.capInvalidReason || null,
        parameters: { lower: { sleeveLengthCm: 52, cuffCircumferenceCm: 30, sideShape: "straight" }, cap: opts.cap || null },
        geometry: geom, capLengths: null
      },
      patternLines: pl
    }
  };
}

// 1. 완료 게이트 통과 → ok, 이세 사실값
{
  BODICE = { hash: "H1", armholeLengths: { front: 20.6, back: 21.6 } }; BODICE_STALE = false;
  PRIM = primOf(21.8, 23.6); SELF_X = false;
  PROJECT = fakeProject();
  const c = SC.check();
  ok(c.ok && c.fails.length === 0, "1: 게이트 통과");
  ok(near(c.ease.front, 1.2) && near(c.ease.back, 2.0) && near(c.ease.total, 3.2), "1: 이세 사실값(앞1.2/뒤2/총3.2)");
  ok(c.capLengths && near(c.capLengths.front, 21.8), "1: capLengths 노출");
}
// 2. 몸판 없음/스테일 → 차단
{
  BODICE = null; PROJECT = fakeProject();
  ok(SC.check().fails.indexOf("no-bodice") >= 0, "2: no-bodice 차단");
  BODICE = { hash: "H1", armholeLengths: { front: 20.6, back: 21.6 } }; BODICE_STALE = true;
  ok(SC.check().fails.indexOf("bodice-stale") >= 0, "2: bodice-stale 차단");
  BODICE_STALE = false;
}
// 3. source-mismatch(소매 sourceBodiceHash ≠ 몸판 hash) → 차단
{
  BODICE = { hash: "H2", armholeLengths: { front: 20.6, back: 21.6 } };
  PROJECT = fakeProject({ sourceHash: "H1" });
  const c = SC.check();
  ok(!c.ok && c.fails.indexOf("source-mismatch") >= 0, "3: source-mismatch 차단");
}
// 4. capInvalid → 차단
{
  BODICE = { hash: "H1", armholeLengths: { front: 20.6, back: 21.6 } };
  PROJECT = fakeProject({ capInvalid: true, capInvalidReason: "cap-order" });
  ok(SC.check().fails.indexOf("cap-invalid") >= 0, "4: cap-invalid 차단");
}
// 5. cap 측정 불가(capPrimitives null) → 차단
{
  PRIM = null; PROJECT = fakeProject();
  ok(SC.check().fails.indexOf("cap-unmeasured") >= 0, "5: cap-unmeasured 차단");
  PRIM = primOf(21.8, 23.6);
}
// 6. 자기교차 → 차단
{
  SELF_X = true; PROJECT = fakeProject();
  ok(SC.check().fails.indexOf("self-intersection") >= 0, "6: self-intersection 차단");
  SELF_X = false;
}
// 7. manual 인데 관리형 cap 선 없음 → 차단
{
  PROJECT = fakeProject({ mode: "manual", capLine: false });
  ok(SC.check().fails.indexOf("manual-line-missing") >= 0, "7: manual-line-missing 차단");
}
// 8. 완료 → 불변 스냅샷(spec 필드) + reference 무관
{
  BODICE = { hash: "H1", armholeLengths: { front: 20.6, back: 21.6 } }; PRIM = primOf(21.8, 23.6);
  PROJECT = fakeProject();
  const r = SC.complete();
  ok(r.ok, "8: 완료 성공");
  const res = PROJECT.working.sleeveResult;
  ok(res && res.schemaVersion === 1 && res.sourceBodiceHash === "H1" && res.geometry && res.parameters.lower && typeof res.completedAt === "number", "8: sleeveResult spec 필드");
  ok(res.sourceBlock.version === 2 && res.sourceBlock.id === "block-1", "8: sourceBlock 고정");
  ok(res.cap.mode === "parametric" && res.cap.frontPrimitives.length >= 1 && res.cap.backPrimitives.length >= 1 && res.cap.splitPoint, "8: cap primitives/splitPoint");
  ok(near(res.cap.lengths.total, 45.4) && near(res.cap.ease.total, 3.2), "8: cap 길이·이세 저장");
  ok(res.cap.manualSource === null, "8: parametric 은 manualSource null");
  ok(Object.isFrozen(res) && Object.isFrozen(res.cap) && Object.isFrozen(res.cap.lengths) && Object.isFrozen(res.geometry), "8: deepFrozen");
  ok(typeof res.hash === "string" && res.hash.length > 0, "8: 자체 hash");
  ok(SC.latest() === res, "8: latest = sleeveResult");
}
// 9. 완료 실패 시 변경 없음(자기교차) → sleeveResult 미생성
{
  PROJECT = fakeProject(); SELF_X = true;
  const r = SC.complete();
  ok(!r.ok && r.reason === "self-intersection" && !PROJECT.working.sleeveResult, "9: complete 거부 · sleeveResult 없음");
  SELF_X = false;
}
// 10. manual 완료 → manualSource 기록(재현·감사용)
{
  PROJECT = fakeProject({ mode: "manual", cap: { bicepCircumferenceCm: 30, capHeightCm: 15 } });
  const r = SC.complete();
  ok(r.ok, "10: manual 완료 성공");
  const res = PROJECT.working.sleeveResult;
  ok(res.cap.mode === "manual" && res.cap.manualSource && res.cap.manualSource.lineId === "sleeve-cap-1" && res.cap.manualSource.splitAnchorIndex === 1 && Array.isArray(res.cap.manualSource.segments), "10: manualSource lineId·splitAnchorIndex·segments");
  ok(res.parameters.cap && res.parameters.cap.bicepCircumferenceCm === 30, "10: cap parameters 저장");
}
// 11. hash 는 completedAt 제외(형상 같으면 동일)
{
  const p1 = fakeProject(); PROJECT = p1; SC.complete(); const h1 = p1.working.sleeveResult.hash;
  const p2 = fakeProject(); PROJECT = p2; SC.complete(); const h2 = p2.working.sleeveResult.hash;
  ok(h1 === h2, "11: 같은 형상 → 같은 hash(completedAt 제외)");
}
// 12. 스테일: 완료 직후 unchanged, cap 파라미터 변경 시 changed, layout·선택 제외
{
  PROJECT = fakeProject(); SC.complete();
  ok(SC.isCurrentSleeveChanged() === false, "12: 완료 직후 unchanged");
  PROJECT.working.layout = { sleeve: { dx: 99, dy: -40 } };
  ok(SC.isCurrentSleeveChanged() === false, "12: 배치 offset 변경 → 여전히 unchanged(형상 무관)");
  PROJECT.working.selectedId = "x";
  ok(SC.isCurrentSleeveChanged() === false, "12: 선택 상태 → 여전히 unchanged");
  PROJECT.working.sleeveDraft.parameters.lower.sleeveLengthCm = 58;   // 형상 파라미터 변경
  ok(SC.isCurrentSleeveChanged() === true, "12: lower 파라미터 변경 → changed");
}
// 13. 완료본 없으면 isCurrentSleeveChanged=true / invalidatedByBodice: 몸판 hash 변경
{
  PROJECT = fakeProject();
  ok(SC.isCurrentSleeveChanged() === true, "13: 완료본 없음 → changed(true)");
  ok(SC.invalidatedByBodice() === false, "13: 완료본 없음 → 무효 아님(false)");
  SC.complete();
  ok(SC.invalidatedByBodice() === false, "13: 완료 직후 몸판 무효 아님");
  BODICE = { hash: "H9", armholeLengths: { front: 20.6, back: 21.6 } };   // 몸판 재완료(hash 변경)
  ok(SC.invalidatedByBodice() === true, "13: 몸판 hash 변경 → 소매 무효(true)");
  BODICE = { hash: "H1", armholeLengths: { front: 20.6, back: 21.6 } };
}

console.log("══════════════════════════════════════════════");
if (FAIL) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); }
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
