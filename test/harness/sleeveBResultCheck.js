// ══════════════════════════════════════════════
// sleeveBResultCheck.js — 소매 Ⓑ(P.41) 전용 완료본(sleeveResult) + Design 통합(카라 → designResult) 회귀. 실제 모듈 전부(스텁 없음).
//   sleeveAResultCheck 와 같은 구조 — Ⓑ 의 차이(출발 Ⓐ hash·손바닥 입력·fairing 된 geometry·경고 비차단)를 검증한다.
//
//   (1) Ⓑ 적용 → 소매 모양 완료: origin(bunka-sleeve-B·P.41)·inputs(소매길이·손바닥)·meta·sourceSleeveAHash·불변 geometry. 기본 소매 전용 parameters 는 없다.
//       ★ 지배 ease = 완료본 cap.ease(fairing 된 최종 geometry 실측). meta.easeTarget/easeAfter 는 감사 정보(덮어쓰지 않음).
//   (2) 불변성·재현성·변경 감지(소매길이·손바닥·geometry).
//   (3) 손바닥 경고는 완료를 막지 않고 warnings 에만 남는다(자동 보정 없음).
//   (4) Ⓑ → 카라 완료 → Design 통합(designResult 가 Ⓑ 완료본을 그대로 담음).
//   (5) 전환: Ⓐ↔Ⓑ↔기본 소매 — 변경 감지·재완료·연쇄 무효. 동시 활성은 거부.
//   (6) 몸판 변경: 무효 · 재제도 후 재완료 · 지원 밖 몸판은 차단 · 완료본 보존.
//   (7) 게이트: 차단·형상/meta 변조·입력 오류·모르는 preset 은 완료 거부.
//   (8) Ⓐ/기본 소매 완료본 byte-equivalent(이 변경 이전 값 고정).
//   node test/harness/sleeveBResultCheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");

let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
const J = JSON.stringify;
const ROOT = path.join(__dirname, "..", "..");

let PROJECT = null;
const sandbox = {
  window: {}, console: { log() {}, warn() {} }, Math, JSON, Object, Array, isFinite, structuredClone, Error, Date,
  c2p: (x, y) => [x * 10, y * 10],
  document: { createElementNS: () => ({ setAttribute() {}, appendChild() {} }) }
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
const load = (f) => vm.runInContext(fs.readFileSync(path.join(ROOT, "js", f), "utf8"), sandbox, { filename: f });
sandbox.window.designWorkflow = { current: () => PROJECT };
["designLineTool.js", "designFlare.js", "designJoin.js", "designWaistSeam.js", "designYokeSeam.js", "designPrincess.js", "designBodice.js", "bodicePresets.js",
  "designLayout.js", "designRenderer.js", "bodiceCheckpoint.js", "peplumAnnotation.js", "designSleeve.js", "sleeveMeasure.js", "sleeveCheckpoint.js",
  "designSleeveA.js", "designSleeveB.js", "sleevePresets.js", "sleeveAApply.js", "sleeveBApply.js", "designCollar.js", "collarCheckpoint.js", "designResult.js"].forEach(load);
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, BC = W.bodiceCheckpoint, SC = W.sleeveCheckpoint, SAA = W.sleeveAApply, SBA = W.sleeveBApply,
  DS = W.designSleeve, DC = W.designCollar, CC = W.collarCheckpoint, DR = W.designResult;
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));

const REFSLEEVE = () => { // designSleeveCheck 와 같은 실제 소매 구조 fixture(공유 block fixture 의 sleeve 는 비어 있다)
  const cap = { kind: "path", commands: [{ type: "M", points: [{ x: 5.53, y: 66.42 }] }, { type: "C", points: [{ x: 12, y: 56 }, { x: 18, y: 53 }, { x: 23.75, y: 53 }] }, { type: "C", points: [{ x: 29, y: 53 }, { x: 35, y: 56 }, { x: 39.29, y: 66.42 }] }] };
  const line = (a, b) => ({ kind: "line", from: { x: a[0], y: a[1] }, to: { x: b[0], y: b[1] } });
  return { outline: [cap, line([5.53, 66.42], [7.56, 105]), line([39.29, 66.42], [37.56, 105]), line([7.56, 105], [37.56, 105])], construction: [] };
};
const presetOf = (sym) => { for (const f of BP.families()) for (const v of f.variants) if (v.symbol === sym) return v.presetId; return null; };
const setBodice = (P, sym) => {
  const body = BP.bodyParams(presetOf(sym));
  P.working.parameters = { neckline: { mode: "parametric", type: "original", parameters: {} }, body };
  P.working.geometry = DB.computeGeometry(REF, { body });
  PROJECT = P; return BC.complete(P);
};
function mkProject(sym) {
  const P = { sourceBlock: { id: "blk", version: 2, schemaVersion: 8, canonicalHash: "CH" }, referenceGeometry: Object.assign(JSON.parse(J(REF)), { sleeve: REFSLEEVE() }),
    working: { geometry: null, parameters: null, patternLines: [], designOutline: null, frontPlacket: null } };
  const c = setBodice(P, sym); if (!c.ok) throw new Error("bodice complete 실패 " + sym + " " + (c.check && c.check.fails));
  return P;
}
// 기본 소매(ui.js deriveSleeve 와 같은 모양): designSleeve.computeSilhouette → working.sleeveDraft + geometry.sleeve
function deriveDefault(P, len) {
  const lower = { sleeveLengthCm: len, cuffCircumferenceCm: 30, sideShape: "straight" };
  const r = DS.computeSilhouette(P.referenceGeometry.sleeve, { lower, cap: null });
  if (!r.ok) throw new Error("computeSilhouette " + r.reason);
  P.working.sleeveDraft = { sourceBodiceHash: P.working.bodiceResult.hash, mode: "parametric", capLineId: null, capInvalid: false,
    parameters: { lower, cap: null }, geometry: r.geometry, capLengths: r.capLengths };
  P.working.geometry.sleeve = r.geometry;
}
const STAND_P = { bandWidthCm: 3, frontRiseCm: 1.5, frontEndCm: 0.5 }, BODY_P = { gapCm: 3, cbWidthCm: 4, frontProjectionCm: 1.5, pointDiagonalCm: 6, outerBowCm: 0 };
function setCollar(P) {
  const b = P.working.bodiceResult, stand = DC.computeStand(b, STAND_P), body = DC.computeBody(stand, BODY_P);
  P.working.collarDraft = { sourceBodiceHash: b.hash, type: "shirt-two-piece", parameters: { stand: Object.assign({}, STAND_P) },
    standGeometry: stand.standGeometry, body: { parameters: Object.assign({}, BODY_P), geometry: body.bodyGeometry, attachLenCm: body.attachLenCm, measure: body.measure } };
  P.working.collarResult = null;
}
const deepFrozen = (o) => { if (!o || typeof o !== "object") return true; return Object.isFrozen(o) && Object.keys(o).every(k => deepFrozen(o[k])); };


const near = (a, b, e) => Math.abs(a - b) < e;

// ── 1. Ⓑ 적용 → 소매 모양 완료 ──
const P = mkProject("A");
{
  PROJECT = P;
  ok(SBA.apply(P, { sleeveLengthCm: 52 }).ok, "1: Ⓑ 적용");
  const c = SC.check(P);
  ok(c.ok && c.fails.length === 0, "1: 완료 게이트 통과(소맷부리 곡선 geometry 에 직선-소맷부리 전제 검사가 걸리지 않는다): " + c.fails.join());
  ok(c.mode === "preset" && c.preset === "bunka-sleeve-B" && c.lower === null && c.cap === null, "1: check 가 Ⓑ 를 파라미터 없는 preset 으로 보고");
  const before = { b: J(P.working.bodiceResult), src: J(P.sourceBlock), ref: J(P.referenceGeometry), geom: J(P.working.geometry.sleeve), sb: J(P.working.sleeveB) };
  const r = SC.complete(P);
  ok(r.ok && P.working.sleeveResult === r.result && SC.latest(P) === r.result, "1: 완료 → working.sleeveResult");
  const R = r.result;
  ok(R.schemaVersion === 1 && SC.kindOf(R) === "preset", "1: schemaVersion 1 · kindOf preset");
  ok(R.origin.kind === "preset" && R.origin.presetId === "bunka-sleeve-B" && R.origin.method === "tight-from-sleeve-A" && R.origin.methodPage === 41, "1: 명시적 출처 origin(P.41)");
  ok(R.sourceBodiceHash === P.working.bodiceResult.hash && R.sourceBlock.id === "blk" && R.sourceBlock.version === 2 && R.sourceBlock.canonicalHash === "CH", "1: 몸판 hash·원형 sourceBlock");
  ok(R.sourceSleeveAHash === P.working.sleeveB.sourceSleeveAHash && typeof R.sourceSleeveAHash === "string" && R.sourceSleeveAHash.length > 0, "1: 출발 Ⓐ hash 기록");
  ok(J(R.inputs) === J({ sleeveLengthCm: 52, palmCircumferenceCm: null }), "1: 입력 = 소매길이 + 손바닥(없으면 null)");
  ok(R.parameters === undefined && R.cap.manualSource === null && R.cap.mode === "preset", "1: 기본 소매 전용 parameters 를 지어내지 않는다");
  ok(J(R.geometry) === before.geom, "1: geometry 스냅샷 = 적용 시점 geometry.sleeve(fairing 된 단일 outline)");
  ok(R.geometry.outline.length === 4 && !J(R.geometry).includes("hem-step") && !J(R.geometry).includes('"rigid"'), "1: geometry 에 hem-step·rigid 없음");
  const m = R.meta;
  ok(m.rule === "pattern-school-p41-tight-sleeve-B" && near(m.hemTargetCm, m.widthCm * 0.75, 1e-12) && m.sleeveLengthCm === 52 && m.armholeCm.front > 0, "1: meta — 규칙·W×3/4·소매길이·AH");
  ok(J(R.meta) === J(P.working.sleeveB.meta) && J(R.warnings) === J(P.working.sleeveB.warnings), "1: meta·warnings = 엔진 상태 복사");
  // 지배 ease 는 cap.ease(최종 geometry 실측). meta.easeAfter 는 감사 정보
  const bAH = P.working.bodiceResult.armholeLengths;
  ok(R.cap.ease.front === Math.round((R.cap.lengths.front - bAH.front) * 1e4) / 1e4 && R.cap.ease.back === Math.round((R.cap.lengths.back - bAH.back) * 1e4) / 1e4, "1: cap.ease = (완료본 geometry 에서 측정한 소매산 길이) − 몸판 AH");
  const TOL = 0.005, dT = R.cap.ease.total - m.easeAfter.total;
  ok(Math.abs(R.cap.ease.front - m.easeAfter.front) < TOL && Math.abs(R.cap.ease.back - m.easeAfter.back) < TOL && Math.abs(dT) < 2 * TOL, "1: cap.ease(권위) vs meta.easeAfter(감사) 샘플링 차 허용오차 안(총 " + dT.toFixed(5) + ")");
  ok(J(R.meta.easeAfter) === J(P.working.sleeveB.meta.easeAfter), "1: meta.easeAfter 는 엔진 값 그대로(cap.ease 로 덮어쓰지 않음)");
  ok(R.cap.frontPrimitives.length > 0 && R.cap.backPrimitives.length > 0 && R.cap.splitPoint.x === 0 && R.cap.splitPoint.y === 0, "1: cap 앞/뒤 조각·SP 분할");
  // Ⓑ 는 맞댐으로 소매산 길이·이세를 바꾸지 않는다(Ⓐ 와 같은 cap)
  const aOnly = SC.check((() => { const Z = mkProject("A"); PROJECT = Z; SAA.apply(Z, { sleeveLengthCm: 52 }); return Z; })());
  PROJECT = P;
  ok(near(aOnly.ease.total, c.ease.total, 5e-3) && near(aOnly.capLengths.total, c.capLengths.total, 5e-3), "1: Ⓑ 의 cap.ease 는 출발 Ⓐ 와 같다(맞댐·fairing 이 소매산 길이를 보존)");
  ok(typeof R.hash === "string" && R.hash.length > 0 && typeof R.completedAt === "number", "1: hash·completedAt");
  ok(J(P.working.bodiceResult) === before.b && J(P.sourceBlock) === before.src && J(P.referenceGeometry) === before.ref && J(P.working.sleeveB) === before.sb, "1: 완료가 몸판·원형·Ⓑ 상태를 건드리지 않는다");
  ok(SC.isCurrentSleeveChanged(P) === false && SC.invalidatedByBodice(P) === false, "1: 완료 직후 변경·무효 아님");
}

// ── 2. 불변성·재현성·변경 감지 ──
{
  const R = P.working.sleeveResult;
  ok(deepFrozen(R), "2: 완료본 깊은 동결");
  const snap = J(R);
  P.working.geometry.sleeve.outline[1].to.y += 1;
  P.working.sleeveB.parameters.sleeveLengthCm = 40;
  ok(J(P.working.sleeveResult) === snap && SC.isCurrentSleeveChanged(P) === true, "2: 원본 변경이 스냅샷에 닿지 않고 «변경됨»으로 잡힘");
  P.working.geometry.sleeve.outline[1].to.y -= 1; P.working.sleeveB.parameters.sleeveLengthCm = 52;
  ok(SC.isCurrentSleeveChanged(P) === false, "2: 되돌리면 변경 아님");
  const Q = mkProject("A"); PROJECT = Q; SBA.apply(Q, { sleeveLengthCm: 52 }); const R2 = SC.complete(Q).result;
  ok(R2.hash === R.hash && J(Object.assign({}, R2, { completedAt: 0 })) === J(Object.assign({}, R, { completedAt: 0 })), "2: 같은 몸판·입력 → 같은 hash·같은 완료본(재현성)");
  PROJECT = P; SBA.apply(P, { sleeveLengthCm: 55 });
  ok(SC.isCurrentSleeveChanged(P) === true, "2: 소매길이 변경 → 변경됨");
  SBA.apply(P, { sleeveLengthCm: 52 });
  ok(SC.isCurrentSleeveChanged(P) === false && SC.latest(P) === R, "2: 같은 입력 재적용 → 변경 아님·완료본 그대로");
  SBA.apply(P, { sleeveLengthCm: 52, palmCircumferenceCm: 18 });
  ok(SC.isCurrentSleeveChanged(P) === true && SC.check(P).ok, "2: 손바닥 입력 변경 → 변경됨(형상은 같아도 입력이 서명에 들어간다)");
  const R18 = SC.complete(P).result;
  ok(R18.hash !== R.hash && R18.inputs.palmCircumferenceCm === 18 && J(R18.geometry) === J(R.geometry) && R18.warnings.length === 0, "2: 손바닥 18 완료본 — 새 hash·같은 geometry·경고 없음");
  SBA.apply(P, { sleeveLengthCm: 52 });
  ok(SC.complete(P).result.hash === R.hash, "2: 손바닥 없음으로 되돌려 재완료 → 처음 hash");
}

// ── 3. 손바닥 경고는 완료를 막지 않는다 ──
{
  const Q = mkProject("A"); PROJECT = Q;
  SBA.apply(Q, { sleeveLengthCm: 52, palmCircumferenceCm: 23 });
  const c = SC.check(Q);
  ok(c.ok && Q.working.sleeveB.warnings.join() === "hem-below-palm-allowance", "3: 경고(손바닥+3 > W×3/4)가 있어도 게이트 통과");
  const R = SC.complete(Q).result;
  ok(R.warnings.join() === "hem-below-palm-allowance" && R.inputs.palmCircumferenceCm === 23 && R.meta.palm.satisfied === false, "3: 완료본 warnings·meta.palm 에 경고가 남는다");
  ok(near(R.meta.hemCm, R.meta.widthCm * 0.75, 1.1e-3) && R.meta.hemTargetCm === R.meta.widthCm * 0.75, "3: 소맷부리는 W×3/4 그대로 — 자동 보정 없음");
}

// ── 4. Ⓑ → 카라 → Design 통합 ──
let DESIGN_B;
{
  PROJECT = P; SBA.apply(P, { sleeveLengthCm: 52 }); SC.complete(P);
  setCollar(P);
  ok(CC.check(P).ok, "4: Ⓑ 완료본으로 카라 게이트 통과: " + CC.check(P).fails.join());
  ok(CC.complete(P).ok && CC.sleeveStepChanged(P) === false, "4: 카라 완료 · «소매 단계 변경됨» 아님");
  const dc = DR.check(P);
  ok(dc.ok, "4: designResult 게이트 통과: " + dc.fails.join());
  const d = DR.complete(P);
  ok(d.ok && d.result.sleeve === SC.latest(P) && d.result.sleeveHash === P.working.sleeveResult.hash, "4: designResult 가 Ⓑ 완료본을 그대로 담는다");
  ok(SC.kindOf(d.result.sleeve) === "preset" && d.result.sleeve.origin.presetId === "bunka-sleeve-B", "4: designResult.sleeve 에서 출처(Ⓑ)가 보인다");
  ok(DR.isCurrentDesignChanged(P) === false, "4: Design 변경 아님");
  const again = DR.complete(P);
  ok(again.ok && again.idempotent === true && again.result === d.result, "4: 같은 상태 재완료 idempotent");
  DESIGN_B = d.result;
}

// ── 5. 전환: Ⓐ↔Ⓑ↔기본 ──
let HASH_B;
{
  PROJECT = P;
  const rB = P.working.sleeveResult; HASH_B = rB.hash;
  // 동시 활성 거부
  SAA.apply(P, { sleeveLengthCm: 52 });
  ok(SC.check(P).ok === false && SC.check(P).fails.includes("sleeve-line-conflict") && SC.complete(P).ok === false && SC.latest(P) === rB, "5: Ⓐ·Ⓑ 동시 활성 → 완료 거부(sleeve-line-conflict)·완료본 보존");
  // Ⓑ → Ⓐ (ui 와 같은 순서: Ⓐ 적용 성공 → Ⓑ 해제)
  SBA.clear(P);
  ok(SC.check(P).ok && SC.check(P).preset === "bunka-sleeve-A", "5: Ⓑ → Ⓐ 전환 → Ⓐ 게이트 통과");
  ok(SC.isCurrentSleeveChanged(P) === true && SC.latest(P) === rB && CC.sleeveStepChanged(P) && DR.isCurrentDesignChanged(P), "5: Ⓑ 완료본 vs Ⓐ → 변경됨(완료본 보존)·카라·Design 변경됨");
  const rA = SC.complete(P).result;
  ok(rA.origin.presetId === "bunka-sleeve-A" && rA.hash !== rB.hash && rA.sourceSleeveAHash === undefined && J(rA.inputs) === J({ sleeveLengthCm: 52 }), "5: Ⓐ 재완료 — 별개 hash · Ⓐ 스키마(sourceSleeveAHash·palm 없음)");
  ok(CC.complete(P).ok && DR.complete(P).ok && DR.latest(P).sleeve === rA, "5: 카라·Design 재완료(Ⓐ)");
  // Ⓐ → Ⓑ
  SBA.apply(P, { sleeveLengthCm: 52 }); SAA.clear(P);
  ok(SC.isCurrentSleeveChanged(P) === true && SC.check(P).ok, "5: Ⓐ → Ⓑ 전환 → 변경됨·Ⓑ 게이트 통과");
  const rB2 = SC.complete(P).result;
  ok(rB2.hash === HASH_B && rB2.origin.presetId === "bunka-sleeve-B", "5: Ⓑ 재완료 hash = 처음 Ⓑ 완료본");
  ok(CC.complete(P).ok && DR.complete(P).ok && DR.latest(P).sleeve === rB2, "5: Design 재완료(Ⓑ)");
  // Ⓑ → 기본 소매
  SBA.clear(P); deriveDefault(P, 52);
  ok(SC.check(P).ok && SC.check(P).mode === "parametric" && SC.isCurrentSleeveChanged(P) === true, "5: 기본 소매로 전환 → 기본 게이트 통과·Ⓑ 완료본은 변경됨");
  const rD = SC.complete(P).result;
  ok(SC.kindOf(rD) === "default" && rD.origin === undefined && rD.inputs === undefined && rD.sourceSleeveAHash === undefined, "5: 기본 소매 완료본은 기존 스키마 그대로");
  ok(CC.complete(P).ok && DR.complete(P).ok, "5: 카라·Design 재완료(기본)");
  // 기본 → Ⓑ: 기본 sleeveDraft 가 남아 있어도 영향 없음
  SBA.apply(P, { sleeveLengthCm: 52 });
  ok(SC.isCurrentSleeveChanged(P) === true && SC.check(P).ok && SC.complete(P).result.hash === HASH_B, "5: 기본 → Ⓑ 재전환 → Ⓑ 완료 hash 동일(기본 sleeveDraft 영향 없음)");
  ok(CC.complete(P).ok && DR.complete(P).ok, "5: Design 재완료");
}

// ── 6. 몸판 변경 ──
{
  PROJECT = P;
  const oldHash = P.working.sleeveResult.hash, oldBodice = P.working.bodiceResult.hash, oldSleeve = P.working.sleeveResult, oldDesign = DR.latest(P);
  ok(setBodice(P, "I").ok && P.working.bodiceResult.hash !== oldBodice, "6: 다른 몸판 재완료");
  ok(SC.invalidatedByBodice(P) === true && SC.isCurrentSleeveChanged(P) === true, "6: 몸판 변경 → Ⓑ 완료본 무효");
  ok(SC.check(P).ok === false && SC.check(P).fails.includes("source-mismatch") && SC.complete(P).ok === false && SC.latest(P) === oldSleeve, "6: 재제도 전 완료 거부(출처 불일치)·이전 완료본 그대로");
  ok(CC.invalidatedByBodice(P) === true && DR.check(P).ok === false && DR.isCurrentDesignChanged(P) === true, "6: 카라·Design 도 무효");
  const rd = SBA.rederive(P);
  ok(rd.ok && P.working.sleeveB.sourceBodiceHash === P.working.bodiceResult.hash, "6: 재제도(몸판 변경 훅)");
  ok(SC.check(P).ok === true && SC.invalidatedByBodice(P) === true, "6: 재제도 후 완료 가능·이전 완료본은 여전히 무효");
  const rn = SC.complete(P).result;
  ok(rn.hash !== oldHash && rn.sourceBodiceHash === P.working.bodiceResult.hash && SC.invalidatedByBodice(P) === false && rn.inputs.sleeveLengthCm === 52, "6: 재완료 → 새 몸판 기준 새 hash");
  setCollar(P);
  ok(CC.complete(P).ok && DR.complete(P).ok && DR.latest(P) !== oldDesign && DR.latest(P).sleeveHash === rn.hash, "6: 카라·Design 재완료");
  const keep = P.working.sleeveResult;
  ok(setBodice(P, "G").ok, "6: Ⓖ 몸판 재완료");
  const rb = SBA.rederive(P);
  ok(!rb.ok && P.working.sleeveB.blocked && SC.check(P).ok === false && SC.check(P).fails.includes("sleeve-b-blocked"), "6: 지원 밖 몸판 → sleeve-b-blocked");
  const cr = SC.complete(P);
  ok(!cr.ok && cr.reason === SC.check(P).fails[0] && SC.latest(P) === keep, "6: 차단 중 완료 거부·완료본 보존");
}

// ── 7. 게이트 ──
{
  const Q = mkProject("A"); PROJECT = Q; SBA.apply(Q, { sleeveLengthCm: 52, palmCircumferenceCm: 18 });
  ok(SC.check(Q).ok, "7: 기준 상태 통과");
  const real = J(Q.working.geometry.sleeve);
  Q.working.geometry.sleeve = JSON.parse(J(Q.referenceGeometry.sleeve));
  ok(!SC.check(Q).ok && SC.complete(Q).ok === false && Q.working.sleeveResult === undefined, "7: geometry 가 Ⓑ 가 아니면 완료 거부·sleeveResult 미생성(" + SC.check(Q).fails.join() + ")");
  // 다른 소매(Ⓐ 형상)가 Ⓑ 로 서명되는 경우
  SAA.apply(Q, { sleeveLengthCm: 52 }); const aGeom = J(Q.working.geometry.sleeve); SAA.clear(Q);
  Q.working.geometry.sleeve = JSON.parse(aGeom);
  ok(SC.check(Q).fails.includes("sleeve-b-geometry-mismatch") && !SC.complete(Q).ok, "7: Ⓐ 형상이 Ⓑ 로 서명되려 하면 거부");
  const g = JSON.parse(real); g.outline[1].to.x += 0.05; Q.working.geometry.sleeve = g;
  ok(SC.check(Q).fails.includes("sleeve-b-geometry-mismatch"), "7: 형상이 Ⓑ 제도와 0.05cm 만 달라도 거부");
  Q.working.geometry.sleeve = JSON.parse(real);
  ok(SC.check(Q).ok, "7: 원복 → 통과");
  const m0 = J(Q.working.sleeveB.meta); Q.working.sleeveB.meta.hemCm += 0.01;
  ok(SC.check(Q).fails.includes("sleeve-b-geometry-mismatch"), "7: meta 변조 거부");
  Q.working.sleeveB.meta = JSON.parse(m0);
  const h0 = Q.working.sleeveB.sourceSleeveAHash; Q.working.sleeveB.sourceSleeveAHash = "deadbeef";
  ok(SC.check(Q).fails.includes("sleeve-b-geometry-mismatch"), "7: 출발 Ⓐ hash 변조 거부");
  Q.working.sleeveB.sourceSleeveAHash = h0;
  const len0 = Q.working.sleeveB.parameters.sleeveLengthCm; Q.working.sleeveB.parameters.sleeveLengthCm = NaN;
  ok(SC.check(Q).fails.includes("invalid-sleeve-length"), "7: 소매길이 비정상 거부");
  Q.working.sleeveB.parameters.sleeveLengthCm = len0;
  Q.working.sleeveB.parameters.palmCircumferenceCm = -4;
  ok(SC.check(Q).fails.includes("invalid-palm-circumference") && !SC.complete(Q).ok, "7: 손바닥 값 비정상 거부");
  Q.working.sleeveB.parameters.palmCircumferenceCm = 18;
  Q.working.sleeveB.presetId = "bunka-sleeve-Z";
  ok(SC.check(Q).fails.includes("sleeve-preset-unsupported") && !SC.complete(Q).ok, "7: 지원하지 않는 preset 거부");
  Q.working.sleeveB.presetId = "bunka-sleeve-B";
  ok(SC.check(Q).ok, "7: 복구 → 통과");
  const N = mkProject("A"); PROJECT = N; SBA.apply(N, { sleeveLengthCm: 52 });
  N.working.geometry.front.outline.find(s => s.kind === "line" && s.edge === "shoulder").to.y += 0.3;
  ok(SC.check(N).fails.includes("bodice-stale") && !SC.complete(N).ok, "7: 몸판 스테일 → 거부");
  const E = { sourceBlock: {}, working: { sleeveB: { presetId: "bunka-sleeve-B", parameters: { sleeveLengthCm: 52, palmCircumferenceCm: null }, blocked: null, meta: {} }, geometry: {} } }; PROJECT = E;
  ok(SC.check(E).fails.includes("no-bodice"), "7: 몸판 완료 없음 → no-bodice");
}

// ── 8. Ⓐ/기본 소매 byte-equivalent (이 변경 이전 값 — sleeveAResultCheck 와 같은 기준) ──
{
  const fp = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(16); };
  const Z = mkProject("A"); PROJECT = Z; deriveDefault(Z, 52);
  const r = SC.complete(Z).result, body = Object.assign({}, r); delete body.completedAt; delete body.hash;
  ok(r.hash === "9ac0b34e" && fp(J(body)) === "81600ed5", "8: 기본 소매 완료본 hash·본문 지문 = 변경 이전 값(" + r.hash + "/" + fp(J(body)) + ")");
  const A = mkProject("A"); PROJECT = A; SAA.apply(A, { sleeveLengthCm: 52 });
  const ra = SC.complete(A).result;
  ok(Object.keys(ra).join() === "schemaVersion,origin,sourceBodiceHash,sourceBlock,inputs,geometry,meta,warnings,cap,completedAt,hash" && ra.origin.presetId === "bunka-sleeve-A", "8: Ⓐ 완료본 키·순서 불변(" + Object.keys(ra).join() + ")");
}

console.log("sleeveBResultCheck: " + PASS + " PASS / " + FAIL + " FAIL");
if (FAIL) { fails.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
