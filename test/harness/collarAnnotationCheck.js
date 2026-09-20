// ══════════════════════════════════════════════
// collarAnnotationCheck.js — js/collarAnnotation.js 카라 제도 보조수치 표시 모델 회귀.
// 실제 designCollar.js + collarCheckpoint.js + collarAnnotation.js 를 같은 vm 으로 실행.
// 표시 모델이 named anchors·parameters·measures 만 소비하는지, manual/stale/미등록 recipe 처리,
// 그리고 표시용 anchors 보존이 collarResult hash·완료 스냅샷을 바꾸지 않는지를 잠근다.
//   node test/harness/collarAnnotationCheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");
let PASS = 0, FAIL = 0; const fails = [];
function ok(cond, name) { if (cond) PASS++; else { FAIL++; fails.push(name); } }
const same = (a, b) => !!a && !!b && a.x === b.x && a.y === b.y;

let BODICE = null, PROJECT = null;
const sandbox = { window: {}, Math, JSON, Object, Array, isFinite, Infinity, Date };
sandbox.window.designWorkflow = { current: () => PROJECT };
sandbox.window.bodiceCheckpoint = { latest: () => BODICE, isCurrentBodiceChanged: () => false };
sandbox.window.sleeveCheckpoint = { latest: () => ({ id: "s" }), isCurrentSleeveChanged: () => false, invalidatedByBodice: () => false };
vm.createContext(sandbox);
["designCollar.js", "collarCheckpoint.js", "collarAnnotation.js"].forEach(f =>
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "..", "js", f), "utf8"), sandbox, { filename: f }));
const DC = sandbox.window.designCollar, CC = sandbox.window.collarCheckpoint, CA = sandbox.window.collarAnnotation;

BODICE = { hash: "BH1", sourceVersion: 1, placket: { parameters: { overlapCm: 1.75 } }, necklineLengths: { back: 7.6926, front: 11.129, half: 18.8216, finished: 37.6432 } };
const RP = DC.referenceParams(), RB = DC.referenceBodyParams();
// ui.js onCollarBaseM 과 같은 형태로 collarDraft 구성(withAnchors=false 면 표시용 anchors 없이).
function draft(withAnchors) {
  const st = DC.computeStand(BODICE, RP), bd = DC.computeBody(st, RB);
  const cd = { sourceBodiceHash: "BH1", type: "shirt-two-piece", baseMethod: "bunka-band-collar-P148-v1",
    parameters: { stand: { bandWidthCm: RP.bandWidthCm, frontRiseCm: RP.frontRiseCm, frontEndCm: RP.frontEndCm } }, standGeometry: st.standGeometry, collarGeometry: null,
    body: { parameters: RB, geometry: bd.bodyGeometry, attachLenCm: bd.attachLenCm, measure: bd.measure },
    measure: { lowerNeckSeamLenCm: st.lowerNeckSeamLenCm, lowerExtensionLenCm: st.lowerExtensionLenCm, upperNeckSegmentLenCm: st.upperNeckSegmentLenCm,
      upperExtensionLenCm: st.upperExtensionLenCm, upperTotalLenCm: st.upperTotalLenCm, backNeckLenCm: st.backNeckLenCm, frontNeckLenCm: st.frontNeckLenCm,
      neckTargetCm: st.neckTargetCm, cbTrimCm: st.cbTrimCm } };
  if (withAnchors) { cd.standAnchors = st.anchors; cd.body.anchors = bd.anchors; }
  return { cd, st, bd };
}
const project = (cd) => ({ sourceBlock: { id: "block-1", version: 1, canonicalHash: "CH1" }, working: { collarDraft: cd, patternLines: [], collarResult: null } });

ok(typeof CA.buildModel === "function" && Object.isFrozen(CA), "0: API·frozen");

// 1. M 기본형 표시 모델 — 입력값은 parameters 그대로, 보조선은 named anchors 그대로
{
  const { cd, st, bd } = draft(true);
  const m = CA.buildModel(cd, BODICE);
  ok(m && m.mode === "parametric" && m.note === null && m.recipe === "bunka-band-collar-P148-v1", "1: parametric 모델");
  const inp = {}; m.inputs.forEach(r => { inp[r.key] = r.value; });
  ok(inp.bandWidthCm === 3 && inp.frontRiseCm === 1 && inp.frontEndCm === 0.5 && inp.gapCm === 3 && inp.cbWidthCm === 4 &&
     inp.frontProjectionCm === 1.5 && inp.pointDiagonalCm === 6 && inp.outerBowCm === 0, "1: 입력값 = M 기본값(3,1,3,4,0.5,1.5,6,0)");
  const D = {}; m.dims.forEach(d => { D[d.id] = d; });
  ok(D["band-width"].text === 3 && D["cf-rise"].text === 1 && D.gap.text === 3 && D["cb-width"].text === 4 &&
     D.projection.text === 1.5 && D["point-diagonal"].text === 6, "1: 치수 라벨 = parameters 값");
  ok(same(D["band-width"].from, st.anchors.cbSeam) && same(D["band-width"].to, st.anchors.cbTop), "1: 밴드 폭 = cbSeam→cbTop anchor");
  ok(same(D["cf-rise"].to, st.anchors.cfSeam) && D["cf-rise"].from.x === st.anchors.cfSeam.x && D["cf-rise"].from.y === st.anchors.cbSeam.y, "1: CF 올림 = CB 기준 수평선→cfSeam");
  ok(D["cf-perpendicular"].kind === "ref" && same(D["cf-perpendicular"].from, st.anchors.cfSeam) && same(D["cf-perpendicular"].to, st.anchors.upperNeckEnd), "1: CF 90° 기준선 = cfSeam→밴드 위선 CF 기준점");
  ok(same(D.gap.from, bd.anchors.bandTopCb) && D.gap.to.x === bd.anchors.bandTopCb.x && D.gap.to.y === bd.anchors.upperCbSeam.y, "1: gap = 밴드 위선 CB→gap 높이(수직)");
  ok(same(D["cb-width"].from, bd.anchors.upperCbSeam) && same(D["cb-width"].to, bd.anchors.cbOuter), "1: CB 폭 = upperCbSeam→cbOuter");
  ok(same(D["point-diagonal"].from, bd.anchors.attachFront) && same(D["point-diagonal"].to, bd.anchors.tip) &&
     same(D.projection.to, bd.anchors.tip) && D.projection.from.x === bd.anchors.attachFront.x && D.projection.from.y === bd.anchors.tip.y, "1: 사선·수평 돌출 = Ⓒ·tip anchor");
  ok(same(bd.anchors.attachFront, DC.computeBody(DC.computeStand(BODICE, RP), RB).anchors.attachFront), "1: 표시 anchor = 엔진 재계산 anchor(결정론)");
  ok(m.labels.map(l => l.id).join(",") === "cb,cf,attach-front", "1: CB/CF/Ⓒ 라벨");
  const R = {}; m.results.forEach(r => { R[r.key] = r; });
  const bm = bd.measure;
  ok(R.neckBack.value === 7.6926 && R.neckFront.value === 11.129 && R.neckHalf.value === 18.8216 && R.neckFinished.value === 37.6432, "1: 몸판 목둘레 = bodiceResult.necklineLengths(반/완성 구분)");
  ok(Math.abs(R.neckDiff.value - (st.lowerNeckSeamLenCm - 18.8216)) < 1e-9 && R.neckDiff.status === "match", "1: 달림선 − 목둘레 합계 = 정합(P.148 ⑭ 보정 결과)");
  ok(R.lowerNeckSeam.value === st.lowerNeckSeamLenCm && R.lowerExtension.value === st.lowerExtensionLenCm && R.bandTopNeck.value === st.upperNeckSegmentLenCm, "1: 밴드 길이 = stand measure");
  ok(R.upperSeam.value === bm.upperCollarSeamLenCm && R.seamDiff.value === bm.seamLengthDiffCm && R.seamDiff.status === "match", "1: 이음선·길이차 = body measure · 정합");
  ok(R.cbCorrection.value === bm.cbCorrectionCm && /^앞쪽 /.test(R.cbCorrection.text), "1: CB 보정 = cbCorrectionCm(+ = 앞쪽)");
  ok(R.derivedVertical.value === bm.frontWidthCm && Math.abs(R.derivedVertical.value - Math.sqrt(33.75)) < 1e-9, "1: 파생 세로성분 = measure.frontWidthCm ≈ 5.81");
  ok(R.actualCbWidth.value === bm.cbWidthCm && R.actualProjection.value === bm.frontProjectionCm && R.actualDiagonal.value === bm.pointDiagonalLenCm &&
     R.cbTrim.value === st.cbTrimCm, "1: 실제 CB 폭·밴드 뒤중심 보정·돌출·사선 = measures");
  const bad = JSON.parse(JSON.stringify(m.results)); bad.forEach(r => { if (r.key === "seamDiff") r.value = 0.2; });
  ok(CA.SEAM_MATCH_TOL === 0.01, "1: 정합 허용치 = checkpoint 0.01");
  const mm = JSON.parse(JSON.stringify(cd)); mm.body.measure.seamLengthDiffCm = 0.2;
  ok(CA.buildModel(mm, BODICE).results.find(r => r.key === "seamDiff").status === "mismatch", "1: 허용치 초과 → mismatch(보정 없음)");
}

// 2. 입력 불변·결정론
{
  const { cd } = draft(true); const s = JSON.stringify(cd);
  const a = CA.buildModel(cd, BODICE), b = CA.buildModel(cd, BODICE);
  ok(JSON.stringify(cd) === s && JSON.stringify(a) === JSON.stringify(b), "2: 입력 불변·결정론");
}

// 3. manual: 본체 보조선 숨김·안내, 스탠드 보조선 유지, 부재 measure 는 null
{
  const { cd, bd } = draft(true);
  const lc = DC.collarBodyLineFromGeometry(bd.bodyGeometry);
  const r = DC.computeFromBodyLine(lc.segments, lc.locked);
  cd.body.mode = "manual"; cd.body.lineId = "collar-body-1"; cd.body.manualLocked = lc.locked; cd.body.measure = r.measure;
  const m = CA.buildModel(cd, BODICE);
  const ids = m.dims.map(d => d.id);
  ok(m.mode === "manual" && /직접 수정 중/.test(m.note), "3: manual 안내");
  ok(ids.indexOf("band-width") >= 0 && ["gap", "cb-width", "projection", "point-diagonal"].every(i => ids.indexOf(i) < 0) && m.labels.every(l => l.id !== "attach-front"), "3: manual → 본체 보조선 숨김(밴드만)");
  const R = {}; m.results.forEach(x => { R[x.key] = x; });
  ok(R.bandTopNeck.value !== null && R.seamDiff.value === null && R.seamDiff.status === null && R.cbCorrection.value === null && R.actualDiagonal.value === r.measure.pointDiagonalLenCm, "3: 부재 measure 는 null(재계산 없음)");
}

// 4. 부재·stale·미등록 recipe·anchors 없음
{
  ok(CA.buildModel(null, BODICE) === null, "4: 카라 없음 → null");
  const { cd } = draft(true);
  const stale = JSON.parse(JSON.stringify(cd)); stale.standGeometry = null; stale.body = null;
  ok(CA.buildModel(stale, BODICE) === null, "4: stale 숨김(standGeometry null) → null");
  const other = JSON.parse(JSON.stringify(cd)); other.baseMethod = "other-collar";
  ok(CA.buildModel(other, BODICE) === null, "4: 미등록 recipe → 표시 모델 없음");
  const noAnch = draft(false).cd;
  ok(CA.buildModel(noAnch, BODICE).dims.length === 0, "4: anchors 없음 → 보조선 없음(좌표 휴리스틱 없음)");
  const standOnly = JSON.parse(JSON.stringify(cd)); standOnly.body = null;
  const so = CA.buildModel(standOnly, BODICE);
  ok(so.inputs.find(r => r.key === "gapCm").value === null && so.dims.every(d => ["band-width", "cb-baseline", "cf-rise", "cf-perpendicular"].indexOf(d.id) >= 0), "4: 스탠드만 → 본체 입력 null·스탠드 보조선만");
}

// 5. 표시용 anchors 보존이 완료 스냅샷·hash·변경 판정을 바꾸지 않는다
{
  PROJECT = project(draft(false).cd); const r0 = CC.complete(PROJECT);
  PROJECT = project(draft(true).cd); const r1 = CC.complete(PROJECT);
  ok(r0.ok && r1.ok && r0.result.hash === r1.result.hash, "5: anchors 유무 무관 collarResult hash 동일 (" + r0.result.hash + ")");
  ok(JSON.stringify(r0.result.body.geometry) === JSON.stringify(r1.result.body.geometry) && JSON.stringify(r0.result.stand) === JSON.stringify(r1.result.stand), "5: 스냅샷 stand·body geometry 동일");
  ok(JSON.stringify(r1.result).indexOf("anchors") < 0 && JSON.stringify(r1.result).indexOf("standAnchors") < 0, "5: 스냅샷에 표시 anchors 미포함");
  PROJECT.working.collarDraft.standAnchors = null; PROJECT.working.collarDraft.body.anchors = null;
  ok(CC.isCurrentCollarChanged(PROJECT) === false, "5: 표시 anchors 제거해도 변경 아님");
}

console.log(`collarAnnotationCheck: ${PASS} PASS, ${FAIL} FAIL`);
if (FAIL) { console.log("FAILURES:\n  " + fails.join("\n  ")); process.exit(1); }
