// ══════════════════════════════════════════════
// sleeveCResultCheck.js — 소매 Ⓒ(P.41 하단) 전용 완료본(sleeveResult) + Design 통합(카라 → designResult) 회귀. 실제 모듈 전부(스텁 없음).
//   sleeveBResultCheck 와 같은 구조 — Ⓒ 의 차이(입력 = 소매길이·EL · 곡선 소맷부리/뒤 열린 다트 geometry · 잘못된 입력 차단)를 검증한다.
//   (1) 적용 → 소매 모양 완료: origin(P.41)·inputs(소매길이·EL)·meta·sourceSleeveAHash·불변 geometry. 지배 ease = 완료본 cap.ease(최종 geometry 실측).
//   (2) 재현성·변경 감지(EL·소매길이·geometry)  (3) 잘못된 EL 입력은 이전 정상 형상을 조용히 재사용하지 않는다(차단·완료 불가)
//   (4) Ⓒ → 카라 → Design 통합  (5) 전환: 기본/Ⓐ/Ⓑ ↔ Ⓒ  (6) 몸판 변경: 무효·재제도·재완료·지원 밖 차단  (7) 게이트  (8) 기존 완료본 byte-equivalent
//   node test/harness/sleeveCResultCheck.js
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
  "designSleeveA.js", "designSleeveB.js", "sleevePresets.js", "sleeveAApply.js", "sleeveBApply.js", "designSleeveC.js", "sleeveCApply.js", "designCollar.js", "collarCheckpoint.js", "designResult.js"].forEach(load);
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

const SCA = W.sleeveCApply;
const P = mkProject("A");
const round4 = v => Math.round(v * 1e4) / 1e4;

// ── 1. Ⓒ 적용 → 소매 모양 완료 ──
let HASH_C, RES_C;
{
  PROJECT = P;
  ok(SCA.apply(P, { sleeveLengthCm: 52, elbowLengthCm: 31.4 }).ok, "1: Ⓒ 적용");
  const c = SC.check(P);
  ok(c.ok && c.fails.length === 0, "1: 완료 게이트 통과(곡선 소맷부리·다트 노치 geometry 에 직선-소맷부리 전제 검사가 걸리지 않는다): " + c.fails.join());
  ok(c.mode === "preset" && c.preset === "bunka-sleeve-C" && c.lower === null && c.cap === null, "1: check 가 Ⓒ 를 파라미터 없는 preset 으로 보고");
  const before = { b: J(P.working.bodiceResult), src: J(P.sourceBlock), ref: J(P.referenceGeometry), geom: J(P.working.geometry.sleeve), sc: J(P.working.sleeveC) };
  const r = SC.complete(P);
  ok(r.ok && P.working.sleeveResult === r.result && SC.latest(P) === r.result, "1: 완료 → working.sleeveResult");
  const R = r.result; RES_C = R; HASH_C = R.hash;
  ok(R.schemaVersion === 1 && SC.kindOf(R) === "preset", "1: schemaVersion 1 · kindOf preset");
  ok(R.origin.kind === "preset" && R.origin.presetId === "bunka-sleeve-C" && R.origin.method === "tight-back-dart-from-sleeve-A" && R.origin.methodPage === 41, "1: 명시적 출처 origin(P.41)");
  ok(R.sourceBodiceHash === P.working.bodiceResult.hash && R.sourceBlock.id === "blk" && R.sourceBlock.version === 2 && R.sourceBlock.canonicalHash === "CH", "1: 몸판 hash·원형 sourceBlock");
  ok(R.sourceSleeveAHash === P.working.sleeveC.sourceSleeveAHash && typeof R.sourceSleeveAHash === "string" && R.sourceSleeveAHash.length > 0, "1: 출발 Ⓐ hash 기록");
  ok(J(R.inputs) === J({ sleeveLengthCm: 52, elbowLengthCm: 31.4 }), "1: 입력 = 소매길이 + EL(31.4)");
  ok(R.parameters === undefined && R.cap.manualSource === null && R.cap.mode === "preset", "1: 기본 소매 전용 parameters 를 지어내지 않는다");
  ok(J(R.geometry) === before.geom && R.geometry.outline.length === 11 && !J(R.geometry).includes('"rigid"'), "1: geometry 스냅샷 = 적용 시점 geometry.sleeve(정리된 한 조각 11 구간)");
  const m = R.meta;
  ok(m.rule === "pattern-school-p41-tight-sleeve-C" && near(m.hemTargetCm, m.widthCm * 0.75, 1e-12) && near(m.hemCm, m.hemTargetCm, 1e-9) && m.sleeveLengthCm === 52 && m.elbowLengthCm === 31.4 && m.armholeCm.front > 0, "1: meta — 규칙·W×3/4 목표=실제(호 길이)·소매길이·EL·AH");
  ok(J(R.meta) === J(P.working.sleeveC.meta) && J(R.warnings) === J(P.working.sleeveC.warnings), "1: meta·warnings = 상태 복사");
  ok(near(m.sections.actual.backOuter, m.sections.unitCm, 1e-9) && near(m.sections.actual.center, 2 * m.sections.unitCm, 1e-9) && m.back.dartWidthAtHemCm > 1 && m.back.legLengthDiffCm === m.back.legLengthDiffCm && Math.abs(m.back.legLengthDiffCm) < 1e-9, "1: meta 에 소맷부리 세 구간 ●:2●:● · 뒤 열린 다트 · 두 다리 길이 같음");
  // 지배 ease = cap.ease(최종 geometry 실측)
  const bAH = P.working.bodiceResult.armholeLengths;
  ok(R.cap.ease.front === round4(R.cap.lengths.front - bAH.front) && R.cap.ease.back === round4(R.cap.lengths.back - bAH.back), "1: cap.ease = (완료본 geometry 에서 측정한 소매산 길이) − (몸판 AH) — 권위값");
  const prim = DS.capPrimitives(R.geometry);
  ok(R.cap.lengths.front === round4(prim.lengths.front) && R.cap.lengths.back === round4(prim.lengths.back), "1: cap.lengths = 완료본 geometry 직접 측정");
  const TOL = 0.005, dT = R.cap.ease.total - m.easeAfter.total;
  ok(Math.abs(R.cap.ease.front - m.easeAfter.front) < TOL && Math.abs(R.cap.ease.back - m.easeAfter.back) < TOL && Math.abs(dT) < 2 * TOL, "1: cap.ease(권위) vs meta.easeAfter(엔진 최종 곡선 GL 실측) 샘플링 차 허용 안(총 " + dT.toFixed(5) + ")");
  ok(R.cap.frontPrimitives.length > 0 && R.cap.backPrimitives.length > 0 && R.cap.splitPoint.x === 0 && R.cap.splitPoint.y === 0, "1: cap 앞/뒤 조각·SP 분할");
  const aOnly = SC.check((() => { const Z = mkProject("A"); PROJECT = Z; SAA.apply(Z, { sleeveLengthCm: 52 }); return Z; })());
  PROJECT = P;
  ok(near(aOnly.ease.total, c.ease.total, 5e-3) && near(aOnly.capLengths.total, c.capLengths.total, 5e-3), "1: Ⓒ 의 cap.ease 는 출발 Ⓐ 와 같다(정리가 소매산 길이를 보존)");
  ok(typeof R.hash === "string" && R.hash.length > 0 && typeof R.completedAt === "number" && deepFrozen(R), "1: hash·completedAt · 완료본 deep-frozen");
  ok(J(P.working.bodiceResult) === before.b && J(P.sourceBlock) === before.src && J(P.referenceGeometry) === before.ref && J(P.working.sleeveC) === before.sc, "1: 완료가 몸판·원형·Ⓒ 상태를 건드리지 않는다");
  ok(SC.isCurrentSleeveChanged(P) === false && SC.invalidatedByBodice(P) === false, "1: 완료 직후 변경·무효 아님");
}

// ── 2. 불변성·재현성·변경 감지(소매길이·EL) ──
{
  PROJECT = P;
  const again = SC.complete(P).result;
  ok(again.hash === HASH_C && again !== RES_C, "2: 같은 상태 재완료 → 같은 hash(결정적)");
  // EL 변경 → 변경됨 → 재완료 시 다른 hash·inputs
  SCA.apply(P, { sleeveLengthCm: 52, elbowLengthCm: 30 });
  ok(SC.isCurrentSleeveChanged(P) === true && SC.check(P).ok, "2: EL 31.4 → 30 : 변경됨·게이트 통과");
  const r30 = SC.complete(P).result;
  ok(r30.hash !== HASH_C && J(r30.inputs) === J({ sleeveLengthCm: 52, elbowLengthCm: 30 }) && r30.meta.elbowLengthCm === 30 && r30.meta.back.apex.y === 30 && SC.isCurrentSleeveChanged(P) === false, "2: EL 30 완료 — 새 hash·inputs·meta(EL·다트 꼭짓점)");
  ok(near(r30.cap.lengths.total, RES_C.cap.lengths.total, 1e-6) && near(r30.cap.ease.total, RES_C.cap.ease.total, 1e-6), "2: EL 변경은 소매산 길이·이세를 바꾸지 않는다");
  SCA.apply(P, { sleeveLengthCm: 52, elbowLengthCm: 31.4 });
  ok(SC.isCurrentSleeveChanged(P) === true && SC.complete(P).result.hash === HASH_C, "2: EL 31.4 로 되돌려 재완료 → 처음 hash");
  // 소매길이 변경
  SCA.apply(P, { sleeveLengthCm: 58, elbowLengthCm: 31.4 });
  ok(SC.isCurrentSleeveChanged(P) === true, "2: 소매길이 변경 → 변경됨");
  const r58 = SC.complete(P).result;
  ok(r58.hash !== HASH_C && r58.inputs.sleeveLengthCm === 58 && near(r58.cap.ease.total, RES_C.cap.ease.total, 1e-6), "2: 소매길이 58 완료 — 새 hash · 이세 불변");
  SCA.apply(P, { sleeveLengthCm: 52, elbowLengthCm: 31.4 }); SC.complete(P);
  // geometry 변조 → 변경됨
  const g0 = J(P.working.geometry.sleeve);
  P.working.geometry.sleeve.outline[1].to.x += 0.05;
  ok(SC.isCurrentSleeveChanged(P) === true && !SC.check(P).ok, "2: geometry 0.05cm 변조 → 변경됨·게이트 거부");
  P.working.geometry.sleeve = JSON.parse(g0);
  ok(SC.isCurrentSleeveChanged(P) === false && SC.check(P).ok, "2: 원복 → 변경 아님");
}

// ── 3. 잘못된 EL 입력: 이전 정상 형상을 조용히 재사용하지 않는다 ──
{
  PROJECT = P;
  const keep = SC.latest(P), keepG = J(P.working.geometry.sleeve);
  const bad = SCA.apply(P, { sleeveLengthCm: 52, elbowLengthCm: 51.5 });
  ok(!bad.ok && J(P.working.geometry.sleeve) === keepG && SC.check(P).ok === true, "3: apply 실패만으로는 상태가 안 바뀐다(= ui 가 reject 호출 전) — 이 상태의 완료는 «이전 입력(31.4)» 의 완료");
  SCA.reject(P, bad);   // ui.applySleeveC 가 잘못된 입력에서 하는 일
  const c = SC.check(P);
  ok(c.ok === false && c.fails.includes("sleeve-c-blocked"), "3: reject 후 완료 게이트 거부(sleeve-c-blocked)");
  const cr = SC.complete(P);
  ok(!cr.ok && cr.reason === "sleeve-c-blocked" && SC.latest(P) === keep && J(P.working.geometry.sleeve) === keepG, "3: 차단 중 완료 거부·이전 완료본 보존·geometry 그대로");
  ok(SC.isCurrentSleeveChanged(P) === true, "3: 차단 중에는 «완료본이 현재와 같다» 로 보이지 않는다(변경됨)");
  ok(SCA.apply(P, { sleeveLengthCm: 52, elbowLengthCm: 31.4 }).ok && SC.check(P).ok && SC.complete(P).result.hash === HASH_C, "3: 올바른 입력 재적용 → 차단 해제·완료 hash 복귀");
  ["", NaN, "abc", 0, -2].forEach(v => {
    const x = SCA.apply(P, { sleeveLengthCm: 52, elbowLengthCm: v }); SCA.reject(P, x);
    ok(!x.ok && x.reason === "invalid-elbow-length" && SC.check(P).fails.includes("sleeve-c-blocked") && !SC.complete(P).ok, "3: EL " + J(v) + " → 거부·차단·완료 불가");
    SCA.apply(P, { sleeveLengthCm: 52, elbowLengthCm: 31.4 });
  });
  // 상태의 EL 이 변조돼 비정상이면 게이트가 거부
  const e0 = P.working.sleeveC.parameters.elbowLengthCm; P.working.sleeveC.parameters.elbowLengthCm = NaN;
  ok(SC.check(P).fails.includes("invalid-elbow-length") && !SC.complete(P).ok, "3: 상태 EL 비정상 → invalid-elbow-length 거부");
  P.working.sleeveC.parameters.elbowLengthCm = 33;
  ok(SC.check(P).fails.includes("sleeve-c-geometry-mismatch") && !SC.complete(P).ok, "3: 상태 EL(33)과 geometry(31.4)가 다르면 재제도 불일치로 거부");
  P.working.sleeveC.parameters.elbowLengthCm = e0;
  ok(SC.check(P).ok, "3: 복구 → 통과");
}

// ── 4. Ⓒ → 카라 → Design 통합 ──
{
  PROJECT = P; SCA.apply(P, { sleeveLengthCm: 52, elbowLengthCm: 31.4 }); SC.complete(P);
  setCollar(P);
  ok(CC.check(P).ok, "4: Ⓒ 완료본으로 카라 게이트 통과: " + CC.check(P).fails.join());
  ok(CC.complete(P).ok && CC.sleeveStepChanged(P) === false, "4: 카라 완료 · «소매 단계 변경됨» 아님");
  const dc = DR.check(P);
  ok(dc.ok, "4: designResult 게이트 통과: " + dc.fails.join());
  const d = DR.complete(P);
  ok(d.ok && d.result.sleeve === SC.latest(P) && d.result.sleeveHash === P.working.sleeveResult.hash, "4: designResult 가 Ⓒ 완료본을 그대로 담는다");
  ok(SC.kindOf(d.result.sleeve) === "preset" && d.result.sleeve.origin.presetId === "bunka-sleeve-C" && J(d.result.sleeve.inputs) === J({ sleeveLengthCm: 52, elbowLengthCm: 31.4 }), "4: designResult.sleeve 에서 출처(Ⓒ)·입력(EL)이 보인다");
  ok(DR.isCurrentDesignChanged(P) === false, "4: Design 변경 아님");
  const again = DR.complete(P);
  ok(again.ok && again.idempotent === true && again.result === d.result, "4: 같은 상태 재완료 idempotent");
  // EL 변경 → 소매 변경됨 → 카라 «소매 단계 변경됨»·Design 변경됨 → 재완료 연쇄
  SCA.apply(P, { sleeveLengthCm: 52, elbowLengthCm: 29 });
  ok(SC.isCurrentSleeveChanged(P) && CC.sleeveStepChanged(P) && DR.isCurrentDesignChanged(P), "4: EL 변경 → 카라 «소매 단계 변경됨»·Design 변경됨");
  ok(SC.complete(P).ok && CC.complete(P).ok && DR.complete(P).ok && DR.latest(P).sleeve.inputs.elbowLengthCm === 29, "4: 소매→카라→Design 재완료(EL 29 반영)");
  SCA.apply(P, { sleeveLengthCm: 52, elbowLengthCm: 31.4 }); SC.complete(P); CC.complete(P); DR.complete(P);
}

// ── 5. 전환: 기본/Ⓐ/Ⓑ ↔ Ⓒ ──
{
  PROJECT = P;
  const rC = P.working.sleeveResult;
  // 동시 활성 거부(어떤 조합이든)
  SAA.apply(P, { sleeveLengthCm: 52 });
  ok(SC.check(P).fails.includes("sleeve-line-conflict") && !SC.complete(P).ok && SC.latest(P) === rC, "5: Ⓐ·Ⓒ 동시 활성 → 거부(sleeve-line-conflict)·완료본 보존");
  SAA.clear(P);
  SBA.apply(P, { sleeveLengthCm: 52 });
  ok(SC.check(P).fails.includes("sleeve-line-conflict") && !SC.complete(P).ok, "5: Ⓑ·Ⓒ 동시 활성 → 거부");
  // Ⓒ → Ⓑ (ui: Ⓑ 적용 성공 → 나머지 해제)
  SCA.clear(P);
  ok(SC.check(P).ok && SC.check(P).preset === "bunka-sleeve-B" && SC.isCurrentSleeveChanged(P) === true && SC.latest(P) === rC, "5: Ⓒ → Ⓑ 전환 → Ⓑ 게이트 통과·Ⓒ 완료본 보존·변경됨");
  const rB = SC.complete(P).result;
  ok(rB.origin.presetId === "bunka-sleeve-B" && rB.hash !== HASH_C && rB.inputs.elbowLengthCm === undefined && rB.meta.back === undefined, "5: Ⓑ 재완료 — Ⓒ 필드(EL·뒤 다트)가 섞이지 않는다");
  // Ⓑ → Ⓐ → 기본 → Ⓒ
  SBA.clear(P); SAA.apply(P, { sleeveLengthCm: 52 });
  const rA = SC.complete(P).result;
  ok(rA.origin.presetId === "bunka-sleeve-A" && J(rA.inputs) === J({ sleeveLengthCm: 52 }) && rA.hash !== rB.hash, "5: Ⓐ 재완료 — Ⓐ 스키마 그대로");
  SAA.clear(P); deriveDefault(P, 52);
  const rD = SC.complete(P).result;
  ok(SC.kindOf(rD) === "default" && rD.origin === undefined && rD.inputs === undefined, "5: 기본 소매 완료본은 기존 스키마 그대로");
  SCA.apply(P, { sleeveLengthCm: 52, elbowLengthCm: 31.4 });
  ok(SC.isCurrentSleeveChanged(P) === true && SC.check(P).ok && SC.complete(P).result.hash === HASH_C, "5: 기본 → Ⓒ 재전환 → Ⓒ 완료 hash 동일(기본 sleeveDraft 영향 없음)");
  ok(CC.complete(P).ok && DR.complete(P).ok && DR.latest(P).sleeve.origin.presetId === "bunka-sleeve-C", "5: Design 재완료(Ⓒ)");
}

// ── 6. 몸판 변경 ──
{
  PROJECT = P;
  const oldHash = P.working.sleeveResult.hash, oldBodice = P.working.bodiceResult.hash, oldSleeve = P.working.sleeveResult, oldDesign = DR.latest(P);
  ok(setBodice(P, "I").ok && P.working.bodiceResult.hash !== oldBodice, "6: 다른 몸판 재완료");
  ok(SC.invalidatedByBodice(P) === true && SC.isCurrentSleeveChanged(P) === true, "6: 몸판 변경 → Ⓒ 완료본 무효");
  ok(SC.check(P).ok === false && SC.check(P).fails.includes("source-mismatch") && SC.complete(P).ok === false && SC.latest(P) === oldSleeve, "6: 재제도 전 완료 거부(출처 불일치)·이전 완료본 그대로");
  ok(CC.invalidatedByBodice(P) === true && DR.check(P).ok === false && DR.isCurrentDesignChanged(P) === true, "6: 카라·Design 도 무효");
  const rd = SCA.rederive(P);
  ok(rd.ok && P.working.sleeveC.sourceBodiceHash === P.working.bodiceResult.hash && P.working.sleeveC.parameters.elbowLengthCm === 31.4, "6: 재제도(몸판 변경 훅) — 같은 소매길이·EL");
  ok(SC.check(P).ok === true && SC.invalidatedByBodice(P) === true, "6: 재제도 후 완료 가능·이전 완료본은 여전히 무효");
  const rn = SC.complete(P).result;
  ok(rn.hash !== oldHash && rn.sourceBodiceHash === P.working.bodiceResult.hash && SC.invalidatedByBodice(P) === false && rn.inputs.elbowLengthCm === 31.4, "6: 재완료 → 새 몸판 기준 새 hash");
  setCollar(P);
  ok(CC.complete(P).ok && DR.complete(P).ok && DR.latest(P) !== oldDesign && DR.latest(P).sleeveHash === rn.hash, "6: 카라·Design 재완료");
  const keep = P.working.sleeveResult;
  ok(setBodice(P, "G").ok, "6: Ⓖ 몸판 재완료");
  const rb = SCA.rederive(P);
  ok(!rb.ok && P.working.sleeveC.blocked && SC.check(P).ok === false && SC.check(P).fails.includes("sleeve-c-blocked"), "6: 지원 밖 몸판 → sleeve-c-blocked");
  const cr = SC.complete(P);
  ok(!cr.ok && cr.reason === SC.check(P).fails[0] && SC.latest(P) === keep, "6: 차단 중 완료 거부·완료본 보존");
}

// ── 7. 게이트(변조·입력 오류·모르는 preset) ──
{
  const Q = mkProject("A"); PROJECT = Q; SCA.apply(Q, { sleeveLengthCm: 52, elbowLengthCm: 31.4 });
  ok(SC.check(Q).ok, "7: 기준 상태 통과");
  const real = J(Q.working.geometry.sleeve);
  Q.working.geometry.sleeve = JSON.parse(J(Q.referenceGeometry.sleeve));
  ok(!SC.check(Q).ok && SC.complete(Q).ok === false && Q.working.sleeveResult === undefined, "7: geometry 가 Ⓒ 가 아니면 완료 거부·sleeveResult 미생성(" + SC.check(Q).fails.join() + ")");
  SBA.apply(Q, { sleeveLengthCm: 52 }); const bGeom = J(Q.working.geometry.sleeve); SBA.clear(Q);
  Q.working.geometry.sleeve = JSON.parse(bGeom);
  ok(SC.check(Q).fails.includes("sleeve-c-geometry-mismatch") && !SC.complete(Q).ok, "7: Ⓑ 형상이 Ⓒ 로 서명되려 하면 거부");
  const g = JSON.parse(real); g.outline[1].to.x += 0.05; Q.working.geometry.sleeve = g;
  ok(SC.check(Q).fails.includes("sleeve-c-geometry-mismatch"), "7: 형상이 Ⓒ 제도와 0.05cm 만 달라도 거부");
  const g2 = JSON.parse(real); g2.construction.push({ kind: "line", from: { x: 0, y: 0 }, to: { x: 1, y: 1 }, role: "front-cut-edge-rotated" }); Q.working.geometry.sleeve = g2;
  ok(SC.check(Q).fails.includes("sleeve-c-geometry-mismatch"), "7: 겹침 내부선 같은 내부 construction 이 끼어도 거부(표시용 construction 만 허용)");
  Q.working.geometry.sleeve = JSON.parse(real);
  ok(SC.check(Q).ok, "7: 원복 → 통과");
  const m0 = J(Q.working.sleeveC.meta); Q.working.sleeveC.meta.hemCm += 0.01;
  ok(SC.check(Q).fails.includes("sleeve-c-geometry-mismatch"), "7: meta 변조 거부");
  Q.working.sleeveC.meta = JSON.parse(m0);
  const h0 = Q.working.sleeveC.sourceSleeveAHash; Q.working.sleeveC.sourceSleeveAHash = "deadbeef";
  ok(SC.check(Q).fails.includes("sleeve-c-geometry-mismatch"), "7: 출발 Ⓐ hash 변조 거부");
  Q.working.sleeveC.sourceSleeveAHash = h0;
  const len0 = Q.working.sleeveC.parameters.sleeveLengthCm; Q.working.sleeveC.parameters.sleeveLengthCm = NaN;
  ok(SC.check(Q).fails.includes("invalid-sleeve-length"), "7: 소매길이 비정상 거부");
  Q.working.sleeveC.parameters.sleeveLengthCm = len0;
  Q.working.sleeveC.meta.checks.selfIntersection = true;
  ok(SC.check(Q).fails.includes("self-intersection") && !SC.complete(Q).ok, "7: 엔진이 자기교차로 기록한 meta 는 거부");
  Q.working.sleeveC.meta = JSON.parse(m0);
  Q.working.sleeveC.presetId = "bunka-sleeve-Z";
  ok(SC.check(Q).fails.includes("sleeve-preset-unsupported") && !SC.complete(Q).ok, "7: 지원하지 않는 preset 거부");
  Q.working.sleeveC.presetId = "bunka-sleeve-C";
  ok(SC.check(Q).ok, "7: 복구 → 통과");
  const N = mkProject("A"); PROJECT = N; SCA.apply(N, { sleeveLengthCm: 52, elbowLengthCm: 31.4 });
  N.working.geometry.front.outline.find(s => s.kind === "line" && s.edge === "shoulder").to.y += 0.3;
  ok(SC.check(N).fails.includes("bodice-stale") && !SC.complete(N).ok, "7: 몸판 스테일 → 거부");
  const E = { sourceBlock: {}, working: { sleeveC: { presetId: "bunka-sleeve-C", parameters: { sleeveLengthCm: 52, elbowLengthCm: 31.4 }, blocked: null, meta: {} }, geometry: {} } }; PROJECT = E;
  ok(SC.check(E).fails.includes("no-bodice"), "7: 몸판 완료 없음 → no-bodice");
}

// ── 8. 기존 완료본 byte-equivalent (기본·Ⓐ — sleeveBResultCheck 와 같은 기준, Ⓑ 는 sleeveBResultCheck 가 전담) ──
{
  const fp = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(16); };
  const Z = mkProject("A"); PROJECT = Z; deriveDefault(Z, 52);
  const r = SC.complete(Z).result, body = Object.assign({}, r); delete body.completedAt; delete body.hash;
  ok(r.hash === "9ac0b34e" && fp(J(body)) === "81600ed5", "8: 기본 소매 완료본 hash·본문 지문 = 변경 이전 값(" + r.hash + "/" + fp(J(body)) + ")");
  const A = mkProject("A"); PROJECT = A; SAA.apply(A, { sleeveLengthCm: 52 });
  const ra = SC.complete(A).result;
  ok(Object.keys(ra).join() === "schemaVersion,origin,sourceBodiceHash,sourceBlock,inputs,geometry,meta,warnings,cap,completedAt,hash" && ra.origin.presetId === "bunka-sleeve-A", "8: Ⓐ 완료본 키·순서 불변");
  const B = mkProject("A"); PROJECT = B; SBA.apply(B, { sleeveLengthCm: 52 });
  const rb = SC.complete(B).result;
  ok(Object.keys(rb).join() === "schemaVersion,origin,sourceBodiceHash,sourceSleeveAHash,sourceBlock,inputs,geometry,meta,warnings,cap,completedAt,hash" && rb.origin.presetId === "bunka-sleeve-B", "8: Ⓑ 완료본 키·순서 불변");
}

console.log("sleeveCResultCheck: " + PASS + " PASS / " + FAIL + " FAIL");
if (FAIL) { fails.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
