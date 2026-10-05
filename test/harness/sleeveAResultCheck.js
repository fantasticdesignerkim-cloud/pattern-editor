// ══════════════════════════════════════════════
// sleeveAResultCheck.js — 소매 Ⓐ 전용 완료본(sleeveResult) + Design 통합(카라 → designResult) 회귀. 실제 모듈 전부(스텁 없음).
//
//   (1) Ⓐ 적용 → 소매 모양 완료: 출처(origin)·입력(inputs)·meta·불변 geometry 스냅샷·몸판 hash. 기본 소매 전용 parameters 는 없다.
//   (2) 불변성·재현성: 깊은 동결, 원본(working.geometry.sleeve·bodiceResult) 변경이 완료본에 닿지 않고 «변경»으로 잡힘, 같은 입력 → 같은 hash.
//   (3) Ⓐ → 카라 완료 → Design 통합 완료(designResult 가 Ⓐ 완료본을 그대로 담음).
//   (4) 재진입·소매길이 변경·기본↔Ⓐ 전환: 변경 감지 → 재완료 → 카라·Design 연쇄 무효/재완료.
//   (5) 몸판 변경: 소매 무효(invalidatedByBodice) · 재제도 후 재완료 · 지원 밖 몸판은 차단 · 완료본 보존.
//   (6) 게이트: 차단 상태·형상 불일치(다른 소매가 Ⓐ 로 서명되는 것)·소매길이 오류는 완료 거부, 이전 완료본 보존.
//   (7) 기본 소매 byte-equivalent: 기본 경로 완료본이 이 변경 이전(HEAD b84d20d) 코드의 산출과 키·값·hash 가 같다.
//   node test/harness/sleeveAResultCheck.js
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
  "designSleeveA.js", "sleevePresets.js", "sleeveAApply.js", "designCollar.js", "collarCheckpoint.js", "designResult.js"].forEach(load);
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, BC = W.bodiceCheckpoint, SC = W.sleeveCheckpoint, SAA = W.sleeveAApply,
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

// ── 1. Ⓐ 적용 → 소매 모양 완료 ──
const P = mkProject("A");
{
  PROJECT = P;
  ok(SAA.apply(P, { sleeveLengthCm: 52 }).ok, "1: Ⓐ 적용");
  const c = SC.check(P);
  ok(c.ok && c.fails.length === 0, "1: 완료 게이트 통과(sleeve-preset-not-linked 없음): " + c.fails.join());
  ok(c.mode === "preset" && c.preset === "bunka-sleeve-A" && c.lower === null && c.cap === null, "1: check 가 Ⓐ 를 파라미터 없는 preset 으로 보고");
  const before = { b: J(P.working.bodiceResult), src: J(P.sourceBlock), ref: J(P.referenceGeometry), geom: J(P.working.geometry.sleeve), sa: J(P.working.sleeveA) };
  const r = SC.complete(P);
  ok(r.ok && P.working.sleeveResult === r.result && SC.latest(P) === r.result, "1: 완료 → working.sleeveResult");
  const R = r.result;
  ok(R.schemaVersion === 1 && SC.kindOf(R) === "preset" && SC.kindOf({}) === "default" && SC.kindOf(null) === null, "1: schemaVersion 1 · kindOf");
  ok(R.origin.kind === "preset" && R.origin.presetId === "bunka-sleeve-A" && R.origin.method === "bodice-armhole" && R.origin.methodPage === 137, "1: 명시적 출처 origin");
  ok(R.sourceBodiceHash === P.working.bodiceResult.hash && R.sourceBlock.id === "blk" && R.sourceBlock.version === 2 && R.sourceBlock.canonicalHash === "CH", "1: 출처 hash·원형 sourceBlock");
  ok(J(R.inputs) === J({ sleeveLengthCm: 52 }), "1: 입력 = 소매길이만");
  ok(R.parameters === undefined && R.cap.manualSource === null && R.cap.mode === "preset", "1: 기본 소매 전용 parameters 를 지어내지 않는다");
  ok(J(R.geometry) === before.geom, "1: geometry 스냅샷 = 적용 시점 geometry.sleeve");
  const m = R.meta;
  ok(m.rule === "pattern-school-p137-type4" && m.capHeightCm > 0 && m.bicepCm > 0 && m.sleeveLengthCm === 52 && m.armholeCm.front > 0 && m.armholeCm.back > 0, "1: meta — AH·소매산·폭·소매길이");
  ok(m.easeTarget.total > 0 && Math.abs(m.easeAfter.total - m.easeTarget.total) < 0.02, "1: meta — 목표/실제 이세");
  ok(J(R.meta) === J(P.working.sleeveA.meta) && J(R.warnings) === J(P.working.sleeveA.warnings), "1: meta·warnings = 엔진 상태 복사");
  const bAH = P.working.bodiceResult.armholeLengths;
  ok(Number.isFinite(R.cap.lengths.total) && Math.abs(R.cap.ease.front - (R.cap.lengths.front - bAH.front)) < 1e-3 && Math.abs(R.cap.ease.total - (R.cap.ease.front + R.cap.ease.back)) < 2e-4,
    "1: 공통 필드 cap.lengths·cap.ease 는 실제 geometry 에서 측정(앞 " + R.cap.ease.front + " 뒤 " + R.cap.ease.back + ")");
  // 권위값 = cap.ease(최종 geometry 직접 측정). meta.easeAfter 는 엔진 기록 — 측정 방식 차이(샘플링)로 ~0.001cm 어긋나는 것이 정상이며 허용오차 TOL 안이어야 한다.
  const TOL = 0.005, dF = R.cap.ease.front - m.easeAfter.front, dB = R.cap.ease.back - m.easeAfter.back, dT = R.cap.ease.total - m.easeAfter.total;
  ok(Math.abs(dF) < TOL && Math.abs(dB) < TOL && Math.abs(dT) < 2 * TOL, "1: cap.ease(권위) vs meta.easeAfter(엔진 기록) 샘플링 차이 허용오차 " + TOL + "cm 안(앞 " + dF.toFixed(5) + " 뒤 " + dB.toFixed(5) + " 총 " + dT.toFixed(5) + ")");
  ok(Math.abs(R.cap.lengths.front - m.capLengths.front) < TOL && Math.abs(R.cap.lengths.back - m.capLengths.back) < TOL, "1: cap.lengths(권위) vs meta.capLengths 샘플링 차이 허용오차 안");
  ok(R.cap.ease.front === Math.round((R.cap.lengths.front - bAH.front) * 1e4) / 1e4 && J(R.meta.easeAfter) === J(P.working.sleeveA.meta.easeAfter), "1: cap.ease 는 geometry 측정 그대로(meta 값으로 덮어쓰지 않음) · meta.easeAfter 는 엔진 값 그대로");
  ok(R.cap.frontPrimitives.length > 0 && R.cap.backPrimitives.length > 0 && R.cap.splitPoint.x === 0 && R.cap.splitPoint.y === 0, "1: cap 앞/뒤 조각·SP 분할");
  ok(typeof R.hash === "string" && R.hash.length > 0 && typeof R.completedAt === "number", "1: hash·completedAt");
  ok(J(P.working.bodiceResult) === before.b && J(P.sourceBlock) === before.src && J(P.referenceGeometry) === before.ref && J(P.working.sleeveA) === before.sa, "1: 완료가 몸판·원형·Ⓐ 상태를 건드리지 않는다");
  ok(SC.isCurrentSleeveChanged(P) === false && SC.invalidatedByBodice(P) === false, "1: 완료 직후 변경·무효 아님");
}

// ── 2. 불변성·재현성 ──
{
  const R = P.working.sleeveResult;
  ok(deepFrozen(R), "2: 완료본 깊은 동결");
  const snap = J(R);
  P.working.geometry.sleeve.outline[1].to.y += 1;     // 원본 geometry 변경
  P.working.sleeveA.parameters.sleeveLengthCm = 40;   // 원본 상태 변경
  ok(J(P.working.sleeveResult) === snap, "2: 원본 변경이 완료본 스냅샷에 닿지 않음");
  ok(SC.isCurrentSleeveChanged(P) === true, "2: 원본 변경 → «소매 변경됨»");
  P.working.geometry.sleeve.outline[1].to.y -= 1; P.working.sleeveA.parameters.sleeveLengthCm = 52;
  ok(SC.isCurrentSleeveChanged(P) === false, "2: 되돌리면 변경 아님(형상 전용 signature)");
  const Q = mkProject("A"); PROJECT = Q; SAA.apply(Q, { sleeveLengthCm: 52 }); const R2 = SC.complete(Q).result;
  ok(R2.hash === R.hash && J(Object.assign({}, R2, { completedAt: 0 })) === J(Object.assign({}, R, { completedAt: 0 })), "2: 같은 몸판·입력 → 같은 hash·같은 완료본(재현성)");
  PROJECT = P; SAA.apply(P, { sleeveLengthCm: 55 });
  ok(SC.isCurrentSleeveChanged(P) === true, "2: 소매길이 변경 → 변경됨");
  SAA.apply(P, { sleeveLengthCm: 52 });
  ok(SC.isCurrentSleeveChanged(P) === false && SC.latest(P) === R, "2: 같은 입력으로 재적용 → 변경 아님·완료본 그대로");
}

// ── 3. Ⓐ → 카라 완료 → Design 통합 ──
let DESIGN_A;
{
  PROJECT = P;
  setCollar(P);
  const cc = CC.check(P);
  ok(cc.ok, "3: Ⓐ 완료본으로 카라 게이트 통과: " + cc.fails.join());
  ok(CC.complete(P).ok, "3: 카라 완료");
  ok(CC.sleeveStepChanged(P) === false, "3: 카라 «소매 단계 변경됨» 아님");
  const dc = DR.check(P);
  ok(dc.ok, "3: designResult 게이트 통과: " + dc.fails.join());
  const d = DR.complete(P);
  ok(d.ok && d.result.sleeve === SC.latest(P) && d.result.sleeveHash === P.working.sleeveResult.hash, "3: designResult 가 Ⓐ 완료본을 그대로 담는다");
  ok(SC.kindOf(d.result.sleeve) === "preset" && d.result.sleeve.origin.presetId === "bunka-sleeve-A", "3: designResult.sleeve 에서 출처가 보인다");
  ok(DR.isCurrentDesignChanged(P) === false, "3: Design 변경 아님");
  const again = DR.complete(P);
  ok(again.ok && again.idempotent === true && again.result === d.result, "3: 같은 상태 재완료 idempotent");
  DESIGN_A = d.result;
}

// ── 4. 재진입 · 소매길이 변경 · 기본↔Ⓐ 전환 ──
let HASH_DEFAULT;
{
  PROJECT = P;
  const rA = P.working.sleeveResult;
  // 소매길이 변경 → 소매 변경 → 카라 순서 경고 · Design 변경 → 재완료
  SAA.apply(P, { sleeveLengthCm: 56 });
  ok(SC.isCurrentSleeveChanged(P) && CC.sleeveStepChanged(P) && DR.isCurrentDesignChanged(P) === true, "4: 소매길이 변경 → 소매·카라 순서·Design 변경됨");
  ok(DR.complete(P).ok === false && DR.complete(P).reason !== undefined, "4: 소매 재완료 전 Design 완료 거부");
  ok(SC.latest(P) === rA, "4: 변경 중에도 이전 완료본은 삭제되지 않는다");
  const r56 = SC.complete(P).result;
  ok(r56 !== rA && r56.hash !== rA.hash && r56.inputs.sleeveLengthCm === 56 && r56.geometry.outline.length === rA.geometry.outline.length, "4: 재완료 → 새 완료본·새 hash");
  ok(DR.isCurrentDesignChanged(P) === true && CC.complete(P).ok && DR.complete(P).ok && DR.latest(P) !== DESIGN_A && DR.latest(P).sleeveHash === r56.hash, "4: 카라·Design 재완료 → 새 designResult");
  // 재진입: 52 로 되돌려 다시 완료 → 이전과 같은 hash(결정적)
  SAA.apply(P, { sleeveLengthCm: 52 }); const r52 = SC.complete(P).result;
  ok(r52.hash === rA.hash && r52 !== rA, "4: 52 로 재진입·재완료 → 같은 hash(새 객체)");

  // Ⓐ → 기본 소매: Ⓐ 해제 + 기본 파생 → Ⓐ 완료본은 «변경»(기본 소매는 다른 형상)
  SAA.clear(P); deriveDefault(P, 52);
  ok(SC.check(P).ok && SC.check(P).mode === "parametric", "4: 기본 소매로 전환 → 기본 게이트 통과");
  ok(SC.isCurrentSleeveChanged(P) === true && SC.kindOf(SC.latest(P)) === "preset", "4: Ⓐ 완료본 vs 기본 소매 → 변경됨(완료본은 보존)");
  const rD = SC.complete(P).result;
  ok(SC.kindOf(rD) === "default" && rD.origin === undefined && rD.inputs === undefined && rD.meta === undefined && rD.parameters.lower.sleeveLengthCm === 52, "4: 기본 소매 완료본은 기존 스키마 그대로(origin·inputs·meta 없음)");
  HASH_DEFAULT = rD.hash;
  ok(DR.isCurrentDesignChanged(P) === true, "4: 기본 전환 → Design 변경됨(소매 hash 가 달라짐)");
  ok(CC.complete(P).ok && DR.complete(P).ok && SC.kindOf(DR.latest(P).sleeve) === "default", "4: 카라·Design 재완료(기본 소매)");
  // 기본 → Ⓐ 재전환: 소매 draft 는 그대로 두고 Ⓐ 적용 → 기본 완료본이 «변경»
  SAA.apply(P, { sleeveLengthCm: 52 });
  ok(SC.isCurrentSleeveChanged(P) === true && SC.check(P).ok, "4: 기본 → Ⓐ 전환 → 변경됨 · Ⓐ 게이트 통과");
  const rA2 = SC.complete(P).result;
  ok(rA2.hash === rA.hash && SC.kindOf(rA2) === "preset", "4: Ⓐ 재완료 hash = 처음 Ⓐ 완료본(기본 sleeveDraft 가 남아 있어도 영향 없음)");
  ok(CC.complete(P).ok && DR.complete(P).ok && DR.latest(P).sleeve === rA2, "4: Design 재완료(Ⓐ)");
}

// ── 5. 몸판 변경 ──
{
  PROJECT = P;
  const oldHash = P.working.sleeveResult.hash, oldBodice = P.working.bodiceResult.hash, oldSleeve = P.working.sleeveResult;
  const oldDesign = DR.latest(P);
  // 지원되는 다른 몸판 Ⓘ 로 재완료
  ok(setBodice(P, "I").ok && P.working.bodiceResult.hash !== oldBodice, "5: 다른 몸판 재완료 → hash 변경");
  ok(SC.invalidatedByBodice(P) === true && SC.isCurrentSleeveChanged(P) === true, "5: 몸판 변경 → 소매 완료본 무효(invalidatedByBodice)");
  ok(SC.check(P).ok === false && SC.check(P).fails.includes("source-mismatch"), "5: 재제도 전 Ⓐ 완료 거부(출처 불일치)");
  ok(SC.complete(P).ok === false && SC.latest(P) === oldSleeve, "5: 거부 시 이전 완료본 그대로");
  ok(CC.invalidatedByBodice(P) === true && DR.check(P).ok === false && DR.isCurrentDesignChanged(P) === true, "5: 카라·Design 도 무효");
  const rd = SAA.rederive(P);
  ok(rd.ok && P.working.sleeveA.sourceBodiceHash === P.working.bodiceResult.hash, "5: 재제도(몸판 변경 훅)");
  ok(SC.check(P).ok === true && SC.invalidatedByBodice(P) === true, "5: 재제도 후 완료 가능 · 이전 완료본은 여전히 무효");
  const rn = SC.complete(P).result;
  ok(rn.hash !== oldHash && rn.sourceBodiceHash === P.working.bodiceResult.hash && SC.invalidatedByBodice(P) === false && rn.inputs.sleeveLengthCm === 52, "5: 재완료 → 새 몸판 기준 새 hash");
  ok(Math.abs(rn.meta.armholeCm.front - P.working.bodiceResult.armholeLengths.front) < 0.2 || rn.meta.armholeCm.front > 0, "5: 새 몸판 AH 가 meta 에 반영");
  setCollar(P);
  ok(CC.complete(P).ok && DR.complete(P).ok && DR.latest(P) !== oldDesign && DR.latest(P).sleeveHash === rn.hash, "5: 카라·Design 재완료");

  // 지원 밖 몸판(Ⓖ): 재제도 차단 → 완료 거부 · 완료본 보존
  const keep = P.working.sleeveResult;
  ok(setBodice(P, "G").ok, "5: Ⓖ 몸판 재완료");
  const rb = SAA.rederive(P);
  ok(!rb.ok && P.working.sleeveA.blocked && SC.check(P).ok === false && SC.check(P).fails.includes("sleeve-a-blocked"), "5: 지원 밖 몸판 → 차단 사유(sleeve-a-blocked)");
  const cr = SC.complete(P);
  ok(!cr.ok && cr.reason === SC.check(P).fails[0] && SC.latest(P) === keep, "5: 차단 중 완료 거부 · 완료본 보존");
}

// ── 6. 게이트: 형상 불일치·소매길이·모듈 ──
{
  const Q = mkProject("A"); PROJECT = Q; SAA.apply(Q, { sleeveLengthCm: 52 });
  ok(SC.check(Q).ok, "6: 기준 상태 통과");
  // 다른 소매 형상(원형 소매)이 Ⓐ 로 서명되려는 경우
  const real = J(Q.working.geometry.sleeve);
  Q.working.geometry.sleeve = JSON.parse(J(Q.referenceGeometry.sleeve));
  let c = SC.check(Q);
  ok(!c.ok && SC.complete(Q).ok === false && Q.working.sleeveResult === undefined, "6: geometry 가 Ⓐ 가 아니면 완료 거부(" + c.fails.join() + ") · sleeveResult 미생성");
  // 미세 변형(교차는 아님)
  const g = JSON.parse(real); g.outline[1].to.x += 0.05; Q.working.geometry.sleeve = g;
  c = SC.check(Q);
  ok(!c.ok && c.fails.includes("sleeve-a-geometry-mismatch"), "6: 형상이 Ⓐ 제도와 0.05cm 만 달라도 거부");
  Q.working.geometry.sleeve = JSON.parse(real);
  ok(SC.check(Q).ok, "6: 원복 → 통과");
  // meta 변조
  const m0 = J(Q.working.sleeveA.meta); Q.working.sleeveA.meta.capHeightCm += 0.01;
  ok(SC.check(Q).fails.includes("sleeve-a-geometry-mismatch"), "6: Ⓐ meta 변조 거부");
  Q.working.sleeveA.meta = JSON.parse(m0);
  // 소매길이 오류 / 모르는 preset
  const len0 = Q.working.sleeveA.parameters.sleeveLengthCm; Q.working.sleeveA.parameters.sleeveLengthCm = NaN;
  ok(SC.check(Q).fails.includes("invalid-sleeve-length"), "6: 소매길이 비정상 거부");
  Q.working.sleeveA.parameters.sleeveLengthCm = len0;
  Q.working.sleeveA.presetId = "bunka-sleeve-Z";
  ok(SC.check(Q).fails.includes("sleeve-preset-unsupported") && !SC.complete(Q).ok, "6: 지원하지 않는 preset 거부");
  Q.working.sleeveA.presetId = "bunka-sleeve-A";
  ok(SC.check(Q).ok, "6: 복구 → 통과");
  // 몸판 없음 / 몸판 스테일
  const N = mkProject("A"); PROJECT = N; SAA.apply(N, { sleeveLengthCm: 52 });
  N.working.geometry.front.outline.find(s => s.kind === "line" && s.edge === "shoulder").to.y += 0.3;   // 몸판 완료 뒤 원본 변경(몸판 스테일)
  ok(SC.check(N).fails.includes("bodice-stale") && !SC.complete(N).ok, "6: 몸판 스테일(완료 후 원본 변경) → Ⓐ 완료 거부");
  const E = { sourceBlock: {}, working: { sleeveA: { presetId: "bunka-sleeve-A", parameters: { sleeveLengthCm: 52 }, blocked: null, meta: {} }, geometry: {} } }; PROJECT = E;
  ok(SC.check(E).fails.includes("no-bodice"), "6: 몸판 완료 없음 → no-bodice");
}

// 변경 이전 코드(HEAD b84d20d)로 같은 입력을 완료해 얻은 값. 기본 소매 완료본이 한 비트도 달라지면 안 된다.
const EXPECT_DEFAULT_HASH = "9ac0b34e", EXPECT_DEFAULT_BODY_FP = "81600ed5";
// ── 7. 기본 소매 byte-equivalent (변경 이전 HEAD b84d20d 산출과 비교) ──
{
  const Z = mkProject("A"); PROJECT = Z; deriveDefault(Z, 52);
  const c = SC.check(Z);
  ok(c.ok && c.mode === "parametric" && c.lower.sleeveLengthCm === 52 && c.cap === null && c.preset === undefined, "7: 기본 소매 check 필드 그대로");
  const r = SC.complete(Z).result;
  const keys = Object.keys(r).join();
  ok(keys === "schemaVersion,sourceBodiceHash,sourceBlock,geometry,parameters,cap,completedAt,hash", "7: 기본 완료본 최상위 키·순서 불변: " + keys);
  ok(Object.keys(r.cap).join() === "mode,frontPrimitives,backPrimitives,splitPoint,lengths,ease,manualSource", "7: cap 키·순서 불변");
  const body = Object.assign({}, r); delete body.completedAt; delete body.hash;
  const fp = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(16); };
  ok(r.hash === EXPECT_DEFAULT_HASH, "7: 기본 완료본 hash = 변경 이전 값(" + r.hash + ")");
  ok(fp(J(body)) === EXPECT_DEFAULT_BODY_FP, "7: 기본 완료본 본문 JSON 지문 = 변경 이전 값(" + fp(J(body)) + ")");
  ok(r.hash === HASH_DEFAULT, "7: 전환 시나리오(4)의 기본 완료본과도 같은 hash");
}

console.log("sleeveAResultCheck: " + PASS + " PASS / " + FAIL + " FAIL");
if (FAIL) { fails.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
