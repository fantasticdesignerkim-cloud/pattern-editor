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

// 6. F형 보조수치: 벌림 횟수 단위와 몸판 목선 이동은 값 손실 없이 표시 모델에 남는다.
{
  const fb = JSON.parse(JSON.stringify(BODICE));
  fb.necklineProfile = { mode: "parametric", type: "stand-f", parameters: {
    neckWidthCm: 3, frontDepthCm: 3, backDepthCm: 2, curveAmountNorm: 1
  } };
  const construction = { fitNeckSeam: false, baselineReductionCm: 0, guideRiseCm: 0,
    requiresNecklineProfile: "stand-f", slashSpreadCm: 0.2, slashCount: 3 };
  const params = { collarWidthCm: 3, frontRiseCm: 0, topSetbackCm: 0 };
  const made = DC.computeStandaloneStand(fb, params, construction);
  const cd = { sourceBodiceHash: fb.hash, type: "stand-collar", baseMethod: "bunka-stand-collar-F-P146-v1",
    construction, parameters: { standalone: params }, standalone: { geometry: made.geometry, measure: made.measure, anchors: made.anchors } };
  const model = CA.buildModel(cd, fb), count = model.inputs.find(r => r.key === "slashCount");
  const offsets = model.results.find(r => r.key === "neckOffsets"), spread = model.results.find(r => r.key === "totalSpread");
  ok(count.value === 3 && count.unit === "개", "6: 벌림 위치 수 = 3개(cm 아님)");
  ok(offsets.value === null && offsets.text === "2.00 · 3.00 cm", "6: F 목선 이동(뒤2·SNP/앞3) text 보존");
  ok(Math.abs(spread.value - 0.6) < 1e-5, "6: 외곽 총 벌림 0.60cm 표시");
}

// 7. H형은 G와 같은 P.147 표시 구조를 쓰되 H 전용 baseMethod·수치를 그대로 노출한다.
{
  const P = { riseCm: 8, backCollarWidthCm: 3.5, collarStandCm: 1, frontCollarWidthCm: 6.5, tipProjectionCm: 4.5, attachCurveCm: 0.3 };
  const made = DC.computeOnePiece(BODICE, P);
  const cd = { sourceBodiceHash: BODICE.hash, type: "shirt-one-piece", baseMethod: "bunka-shirt-collar-H-v1",
    parameters: { onePiece: P }, onePiece: { geometry: made.geometry, measure: made.measure, anchors: made.anchors } };
  const model = CA.buildModel(cd, BODICE), inputs = {};
  model.inputs.forEach(r => { inputs[r.key] = r.value; });
  ok(model && model.recipe === "bunka-shirt-collar-H-v1" && model.mode === "parametric", "7: H 전용 recipe 등록");
  ok(inputs.riseCm === 8 && inputs.collarStandCm === 1 && inputs.tipProjectionCm === 4.5 && inputs.attachCurveCm === 0.3, "7: H 보조수치(올림8·허리1·앞끝4.5·곡률0.3)");
  ok(model.dims.find(d => d.id === "rise").text === 8 && model.dims.find(d => d.id === "collar-stand").text === 1, "7: H 치수선은 named anchors 기반");
  ok(CA.recipes().indexOf("bunka-shirt-collar-H-v1") >= 0, "7: H recipe 목록 노출");
}

// 8. I형도 독립 recipe 로 등록하고 P.64 수치를 그대로 표시한다.
{
  const P = { riseCm: 4.5, backCollarWidthCm: 3.5, collarStandCm: 2, frontCollarWidthCm: 6.5, tipProjectionCm: 3.5, attachCurveCm: 0.3 };
  const made = DC.computeOnePiece(BODICE, P);
  const cd = { sourceBodiceHash: BODICE.hash, type: "shirt-one-piece", baseMethod: "bunka-shirt-collar-I-v1",
    parameters: { onePiece: P }, onePiece: { geometry: made.geometry, measure: made.measure, anchors: made.anchors } };
  const model = CA.buildModel(cd, BODICE), inputs = {};
  model.inputs.forEach(r => { inputs[r.key] = r.value; });
  ok(model && model.recipe === "bunka-shirt-collar-I-v1" && model.mode === "parametric", "8: I 전용 recipe 등록");
  ok(inputs.riseCm === 4.5 && inputs.collarStandCm === 2 && inputs.tipProjectionCm === 3.5 && inputs.attachCurveCm === 0.3, "8: I 보조수치(올림4.5·허리2·앞끝3.5·곡률0.3)");
  const backWidth = model.dims.find(d => d.id === "back-collar-width"), fold = made.anchors.cbFold, outer = made.anchors.cbOuter;
  ok(same(backWidth.from, fold) && same(backWidth.to, outer) && Math.abs(Math.hypot(outer.x - fold.x, outer.y - fold.y) - 3.5) < 1e-9, "8: 뒤 칼라 폭은 허리 위 F0→O0 구간(포개 측정 아님)");
  ok(model.dims.find(d => d.id === "rise").text === 4.5 && model.dims.find(d => d.id === "collar-stand").text === 2, "8: I 치수선은 named anchors 기반");
  ok(CA.recipes().indexOf("bunka-shirt-collar-I-v1") >= 0, "8: I recipe 목록 노출");
}

// 9. J형은 허리4 + 뒤 폭3.5를 독립 치수로 표시하고, 교재에 없는 곡률값을 사실처럼 표시하지 않는다.
{
  const P = { riseCm: 1, backCollarWidthCm: 3.5, collarStandCm: 4, frontCollarWidthCm: 6.5, tipProjectionCm: 2.5, attachCurveCm: 0 };
  const made = DC.computeOnePiece(BODICE, P);
  const cd = { sourceBodiceHash: BODICE.hash, type: "shirt-one-piece", baseMethod: "bunka-shirt-collar-J-v1",
    parameters: { onePiece: P }, onePiece: { geometry: made.geometry, measure: made.measure, anchors: made.anchors } };
  const model = CA.buildModel(cd, BODICE), inputs = {};
  model.inputs.forEach(r => { inputs[r.key] = r.value; });
  ok(model && model.recipe === "bunka-shirt-collar-J-v1" && model.mode === "parametric", "9: J 전용 recipe 등록");
  ok(inputs.riseCm === 1 && inputs.collarStandCm === 4 && inputs.tipProjectionCm === 2.5 && inputs.attachCurveCm === 0, "9: J 보조수치(올림1·허리4·앞끝2.5·별도 오프셋 없음)");
  const stand = model.dims.find(d => d.id === "collar-stand"), width = model.dims.find(d => d.id === "back-collar-width");
  ok(same(stand.from, made.anchors.cbAttach) && same(stand.to, made.anchors.cbFold)
    && same(width.from, made.anchors.cbFold) && same(width.to, made.anchors.cbOuter), "9: J 허리 N0→F0·뒤 폭 F0→O0 분리 표시");
  const attach = made.geometry.outline.filter(s => s.part === "attach");
  ok(attach.length === 2 && attach.every(s => s.kind === "line"), "9: 곡률 무표기 구현 기준은 별도 볼록 오프셋 없는 두 기초 구간");
  ok(/곡률 수치를 표기하지/.test(model.note) && /구현 기준/.test(model.note), "9: 0cm를 교재 수치로 오인하지 않는 안내");
  ok(CA.recipes().indexOf("bunka-shirt-collar-J-v1") >= 0, "9: J recipe 목록 노출");
}

// 10. K형은 I형과 같은 기준 치수와 반대 곡률 방향을 함께 표시한다.
{
  const P = { riseCm: 4.5, backCollarWidthCm: 3.5, collarStandCm: 2, frontCollarWidthCm: 6.5, tipProjectionCm: 3.5, attachCurveCm: 0.6, attachCurveDirection: "reversed" };
  const made = DC.computeOnePiece(BODICE, P);
  const cd = { sourceBodiceHash: BODICE.hash, type: "shirt-one-piece", baseMethod: "bunka-shirt-collar-K-v1",
    parameters: { onePiece: P }, onePiece: { geometry: made.geometry, measure: made.measure, anchors: made.anchors } };
  const model = CA.buildModel(cd, BODICE), inputs = {};
  model.inputs.forEach(r => { inputs[r.key] = r.text != null ? r.text : r.value; });
  ok(model && model.recipe === "bunka-shirt-collar-K-v1" && model.mode === "parametric", "10: K 전용 recipe 등록");
  ok(inputs.riseCm === 4.5 && inputs.collarStandCm === 2 && inputs.tipProjectionCm === 3.5 && inputs.attachCurveCm === 0.6
    && inputs.attachCurveDirection === "반대 방향", "10: K 보조수치(I 치수·곡률0.6·반대 방향)");
  ok(/I형과 같은 치수/.test(model.note) && /반대 방향/.test(model.note), "10: K 곡률 방향 변경 안내");
  const attach = made.geometry.outline.filter(s => s.part === "attach"), midY = (made.anchors.a.y + made.anchors.b.y) / 2;
  ok(attach.length === 3 && attach[1].to.y > midY, "10: K 보조수치의 반대 방향과 실제 곡률 형상 일치");
  ok(CA.recipes().indexOf("bunka-shirt-collar-K-v1") >= 0, "10: K recipe 목록 노출");
}

// 11. 오픈 칼라 L(P.65, 몸판 연동) 표시 모델 — 몸판 프레임 좌표를 카라 로컬 dims 에 섞지 않는다
{
  const B = JSON.parse(JSON.stringify(BODICE));
  B.front = { outline: [
    { kind: "line", from: { x: 40, y: 2 }, to: { x: 40, y: 38 }, edge: "center" },
    { kind: "path", commands: [{ type: "M", points: [{ x: 40, y: 2 }] },
      { type: "C", points: [{ x: 35.6, y: 2 }, { x: 31.4, y: 0.2 }, { x: 29.2, y: -2.4 }] }], edge: "neckline" },
    { kind: "line", from: { x: 29.2, y: -2.4 }, to: { x: 21, y: 1.2 }, edge: "shoulder" }
  ] };
  const P = { backCollarWidthCm: 3.5, collarStandCm: 3, frontEndRiseCm: 1, frontStraightCm: 4, breakPointDistanceCm: 8 };
  const made = DC.computeOpenCollar(B, P);
  const cd = { sourceBodiceHash: B.hash, type: "shirt-open-collar", baseMethod: "bunka-open-collar-L-v1",
    parameters: { openCollar: P }, openCollar: { geometry: made.geometry, measure: made.measure, anchors: made.anchors, bodyLink: made.bodyLink } };
  const model = CA.buildModel(cd, B), inputs = {}, results = {};
  model.inputs.forEach(r => { inputs[r.key] = r.text != null ? r.text : r.value; });
  model.results.forEach(r => { results[r.key] = r; });
  ok(model && model.recipe === "bunka-open-collar-L-v1" && model.mode === "parametric" && CA.recipes().indexOf("bunka-open-collar-L-v1") >= 0, "11: L 전용 recipe 등록");
  ok(inputs.backCollarWidthCm === 3.5 && inputs.collarStandCm === 3 && inputs.frontEndRiseCm === 1
    && inputs.frontStraightCm === 4 && inputs.breakPointDistanceCm === 8, "11: L 제도 입력값 5개");
  ok(results.attachDiff.status === "match" && Math.abs(results.attachLen.value - results.neckTarget.value) <= CA.SEAM_MATCH_TOL,
    "11: 달림선 = 목둘레 정합 판정(L 은 길이 책임이 달림선에 있다)");
  ok(results.baseLineLen.value === made.measure.baseLineLenCm && results.foldLift.value === made.measure.foldJunctionLiftCm
    && /파생/.test(results.baseLineLen.label) && /파생/.test(results.foldLift.label), "11: 기초선·꺾임점 들림은 파생값으로 표시");
  ok(results.breakLineLen.value === made.measure.breakLineLenCm && results.breakDrop.value === made.measure.breakDropCm
    && results.frontOverlap.value === 1.75, "11: 몸판 꺾임선 수치 보고(길이·내림·여밈분)");
  // ★ dims 는 카라 로컬 좌표만 — 몸판 프레임(x≈40)의 꺾임선 점이 섞이면 잘못된 위치에 그려진다
  const allPts = [];
  model.dims.forEach(d => { allPts.push(d.from, d.to); });
  model.labels.forEach(l => allPts.push(l.at));
  ok(allPts.length > 0 && allPts.every(p => p.x <= made.measure.baseLineLenCm + 1e-9 && p.x >= -1e-9), "11: 표시 좌표는 카라 로컬 프레임 안(몸판 좌표 미혼입)");
  const ids = model.dims.map(d => d.id);
  ok(ids.indexOf("collar-stand") >= 0 && ids.indexOf("back-collar-width") >= 0 && ids.indexOf("front-end-rise") >= 0
    && ids.indexOf("front-straight") >= 0 && ids.indexOf("baseline") >= 0, "11: 치수선 = 허리·뒤 폭·앞 끝 올림·앞 직선 + 기초선 참조");
  ok(/몸판/.test(model.note), "11: 몸판 연동 제도 안내");
  // 형상 없으면 이전 수치를 현재처럼 남기지 않는다
  ok(CA.buildModel({ type: "shirt-open-collar", baseMethod: "bunka-open-collar-L-v1", openCollar: {} }, B) === null, "11: 형상 없으면 표시 모델 없음");
}

// 12. 교재 O: D 방식 기초선 옵션 표시(옵션 없는 M·N·P 표시 모델은 불변)
{
  const P = { bandWidthCm: 3, frontRiseCm: 8.5, frontEndCm: 0.5 };
  const BP = { gapCm: 14, cbWidthCm: 4, frontProjectionCm: 4, pointDiagonalCm: 6, outerBowCm: 0 };
  const CONS = { baselineReductionCm: 2.5, guideRiseCm: 2 };
  const st = DC.computeStand(BODICE, P, CONS), bd = DC.computeBody(st, BP);
  const cd = { sourceBodiceHash: "BH1", type: "shirt-two-piece", baseMethod: "bunka-band-collar-P148-v1",
    construction: CONS, parameters: { stand: P }, standGeometry: st.standGeometry, standAnchors: st.anchors, collarGeometry: null,
    body: { parameters: BP, geometry: bd.bodyGeometry, attachLenCm: bd.attachLenCm, measure: bd.measure, anchors: bd.anchors },
    measure: { lowerNeckSeamLenCm: st.lowerNeckSeamLenCm, lowerExtensionLenCm: st.lowerExtensionLenCm, upperNeckSegmentLenCm: st.upperNeckSegmentLenCm,
      upperExtensionLenCm: st.upperExtensionLenCm, upperTotalLenCm: st.upperTotalLenCm, backNeckLenCm: st.backNeckLenCm, frontNeckLenCm: st.frontNeckLenCm,
      neckTargetCm: st.neckTargetCm, cbTrimCm: st.cbTrimCm, baseLineLenCm: st.baseLineLenCm,
      baselineReductionCm: st.baselineReductionCm, guideRiseCm: st.guideRiseCm } };
  const model = CA.buildModel(cd, BODICE), inputs = {}, results = {};
  model.inputs.forEach(r => { inputs[r.key] = r.value; });
  model.results.forEach(r => { results[r.key] = r.value; });
  ok(inputs.baselineReductionCm === 2.5 && inputs.guideRiseCm === 2, "12: O 구성 옵션 두 행 표시");
  ok(Math.abs(results.baseLineLen - (BODICE.necklineLengths.half - 2.5)) < 1e-9, "12: 기초 수평선(×+⊘−감산) 결과 행");
  const gr = model.dims.filter(d => d.id === "guide-rise")[0];
  ok(gr && gr.kind === "dim" && gr.text === 2 && Math.abs(gr.from.y) < 1e-12 && Math.abs(gr.to.y + 2) < 1e-12
    && Math.abs(gr.from.x - st.anchors.guideA.x) < 1e-12, "12: Ⓐ 올림 치수선 = 기초선(y0) → Ⓐ");
  ok(model.labels.some(l => l.id === "guide-a" && /2\/3/.test(l.text)), "12: Ⓐ(2/3) 라벨");
  ok(results.neckDiff != null && Math.abs(results.neckDiff) <= CA.SEAM_MATCH_TOL, "12: 달림선 − 목둘레 정합(감산은 기초선에만)");

  // 옵션 없는 M 은 새 행·치수선이 생기지 않는다(표시 모델 불변)
  const m = draft(true).cd, mModel = CA.buildModel(m, BODICE);
  ok(!mModel.inputs.some(r => r.key === "baselineReductionCm" || r.key === "guideRiseCm")
    && !mModel.results.some(r => r.key === "baseLineLen")
    && !mModel.dims.some(d => d.id === "guide-rise") && !mModel.labels.some(l => l.id === "guide-a"), "12: M 표시 모델에는 D 방식 행·치수선 없음");
}

// 13. 교재 Q(윙 칼라) 표시 모델 — 수평 꺾임선·칼라 끝 세 치수, 세로 성분은 파생(치수선 아님)
{
  const SP = { bandWidthCm: 3, frontRiseCm: 1, frontEndCm: 0.5 };
  const TP = { tipBaseCm: 7, tipSetbackCm: 1.5, tipEdgeCm: 4.5 };
  const st = DC.computeStand(BODICE, SP, { horizontalTopLine: true }), tp = DC.computeWingTip(st, TP);
  const cd = { sourceBodiceHash: "BH1", type: "shirt-wing-collar", baseMethod: "bunka-wing-collar-Q-v1",
    parameters: { stand: SP, tip: TP }, standGeometry: st.standGeometry, standAnchors: st.anchors,
    tip: { geometry: tp.geometry, measure: tp.measure, anchors: tp.anchors },
    measure: { lowerNeckSeamLenCm: st.lowerNeckSeamLenCm, lowerExtensionLenCm: st.lowerExtensionLenCm,
      upperNeckSegmentLenCm: st.upperNeckSegmentLenCm, upperExtensionLenCm: st.upperExtensionLenCm,
      upperTotalLenCm: st.upperTotalLenCm, backNeckLenCm: st.backNeckLenCm, frontNeckLenCm: st.frontNeckLenCm,
      neckTargetCm: st.neckTargetCm, cbTrimCm: st.cbTrimCm } };
  const model = CA.buildModel(cd, BODICE), inputs = {}, results = {}, dims = {};
  model.inputs.forEach(r => { inputs[r.key] = r.value; });
  model.results.forEach(r => { results[r.key] = r; });
  model.dims.forEach(d => { dims[d.id] = d; });
  ok(model && model.recipe === "bunka-wing-collar-Q-v1" && CA.recipes().indexOf("bunka-wing-collar-Q-v1") >= 0, "13: Q 전용 recipe 등록");
  ok(inputs.bandWidthCm === 3 && inputs.frontRiseCm === 1 && inputs.frontEndCm === 0.5
    && inputs.tipBaseCm === 7 && inputs.tipSetbackCm === 1.5 && inputs.tipEdgeCm === 4.5, "13: 제도 입력값 6개(밴드 3 + 칼라 끝 3)");
  ok(dims["tip-base"].text === 7 && dims["tip-edge"].text === 4.5 && dims["tip-setback"].text === 1.5, "13: 칼라 끝 치수선 3개");
  ok(dims["tip-height"] && dims["tip-height"].kind === "ref" && dims["tip-height"].text === null, "13: 세로 성분은 참조선(치수 아님 = 파생값)");
  ok(dims["fold-line"] && dims["fold-line"].kind === "ref" && Math.abs(dims["fold-line"].from.y - dims["fold-line"].to.y) < 1e-12, "13: 꺾임선 참조선은 수평");
  ok(Math.abs(dims["tip-base"].from.x - dims["tip-base"].to.x - 7) < 1e-9 && Math.abs(dims["tip-base"].from.y - dims["tip-base"].to.y) < 1e-12,
    "13: 밑변 치수선은 꺾임선 위 Ⓒ→뒤 7");
  ok(results.neckDiff.status === "match" && Math.abs(results.lowerNeckSeam.value - results.neckHalf.value) <= CA.SEAM_MATCH_TOL, "13: 달림선 = 목둘레 정합");
  ok(results.tipBase.value === tp.measure.foldBaseLenCm && results.tipEdge.value === tp.measure.tipEdgeLenCm
    && results.tipHeight.value === tp.measure.tipHeightCm && /파생/.test(results.tipHeight.label), "13: 칼라 끝 실측·파생 결과 행");
  ok(/수평/.test(model.note) && /위 칼라 없음/.test(model.note), "13: 수평 꺾임선·위 칼라 없음 안내");
  ok(model.labels.some(l => l.id === "tip") && model.labels.some(l => l.id === "fold-front"), "13: 칼라 끝·Ⓒ 라벨");
  ok(CA.buildModel({ type: "shirt-wing-collar", baseMethod: "bunka-wing-collar-Q-v1", standGeometry: st.standGeometry }, BODICE) === null,
    "13: 칼라 끝 형상 없으면 표시 모델 없음");
}

// 14. 교재 R(밴드+위 칼라 한 장) 표시 모델 — 밴드 3 치수 + 위 칼라 3 치수, 외곽 뒤 = 뒤 목둘레 ×
{
  const SP = { bandWidthCm: 3, frontRiseCm: 1, frontEndCm: 0.5 };
  const UP = { upperWidthCm: 3.5, frontWidthCm: 6.5, outerBowCm: 0.5 };
  const jn = DC.computeBandOnePiece(BODICE, SP, UP);
  const cd = { sourceBodiceHash: "BH1", type: "shirt-band-one-piece", baseMethod: "bunka-band-collar-R-v1",
    parameters: { stand: SP, upper: UP }, joined: { geometry: jn.geometry, measure: jn.measure, anchors: jn.anchors } };
  const model = CA.buildModel(cd, BODICE), inputs = {}, results = {}, dims = {};
  model.inputs.forEach(r => { inputs[r.key] = r.value; });
  model.results.forEach(r => { results[r.key] = r; });
  model.dims.forEach(d => { dims[d.id] = d; });
  ok(model.recipe === "bunka-band-collar-R-v1" && CA.recipes().indexOf("bunka-band-collar-R-v1") >= 0, "14: R 전용 recipe 등록");
  ok(inputs.bandWidthCm === 3 && inputs.frontRiseCm === 1 && inputs.frontEndCm === 0.5
    && inputs.upperWidthCm === 3.5 && inputs.frontWidthCm === 6.5 && inputs.outerBowCm === 0.5, "14: 제도 입력값 6개(밴드 3 + 위 칼라 3)");
  ok(dims["band-width"].text === 3 && dims["upper-width"].text === 3.5 && dims["front-width"].text === 6.5 && dims["outer-bow"].text === 0.5,
    "14: 밴드 폭·위 칼라 폭·앞 칼라 폭·처짐 치수선");
  ok(Math.abs(dims["upper-width"].from.x - dims["upper-width"].to.x) < 1e-12
    && Math.abs(dims["front-width"].from.x - dims["front-width"].to.x) < 1e-12, "14: 위 칼라 CB·앞 칼라 폭 치수선은 수직");
  ok(Math.abs(dims["outer-back"].from.y - dims["outer-back"].to.y) < 1e-12 && dims["outer-back"].text === jn.measure.backNeckLenCm,
    "14: 외곽 뒤 치수선은 수평이고 값 = 뒤 목둘레 ×");
  ok(dims["band-top"].kind === "ref" && dims["outer-chord"].kind === "ref", "14: 이음선 자리·현은 참조선(치수 아님)");
  ok(results.neckDiff.status === "match" && results.outerBackDiff.status === "match", "14: 달림선 = 목둘레 · 외곽 뒤 = 뒤 목둘레 정합");
  ok(results.outerTotal.value === jn.measure.outerLenCm && results.cbHeight.value === jn.measure.cbHeightCm
    && results.bandTop.value === jn.measure.bandTopLenCm, "14: 외곽 전체·CB 전체·이음선 자리 실측 결과 행");
  ok(/한 장/.test(model.note) && /외곽/.test(model.note), "14: 한 장·외곽 치수 확보 안내");
  ok(model.labels.some(l => l.id === "shoulder") && model.labels.some(l => l.id === "band-top-front"), "14: 어깨·Ⓒ 라벨");
  ok(CA.buildModel({ type: "shirt-band-one-piece", baseMethod: "bunka-band-collar-R-v1" }, BODICE) === null, "14: 한 조각 형상 없으면 표시 모델 없음");
}

// 15. 교재 S(플랫 칼라) 표시 모델 — 칼라 폭·앞 끝선만 치수, 달림선은 몸판 목둘레선이라 실측 결과로만
{
  const cub = (a, b, c, d) => ({ kind: "cubic", from: { x: a[0], y: a[1] }, c1: { x: b[0], y: b[1] }, c2: { x: c[0], y: c[1] }, to: { x: d[0], y: d[1] } });
  const ln = (a, b, edge) => { const s2 = { kind: "line", from: { x: a[0], y: a[1] }, to: { x: b[0], y: b[1] } }; if (edge) s2.edge = edge; return s2; };
  const we = (s2, e) => Object.assign({}, s2, { edge: e });
  const backNeck = we(cub([0, 0], [3, 0], [6, -1], [8, -2]), "neckline");
  const frontNeck = we(cub([40, 4], [37, 2], [34, -2], [32, -4]), "neckline");
  const dense = (sg) => { let t = 0, pr = sg.from; for (let i = 1; i <= 4000; i++) { const q = i / 4000, u = 1 - q;
    const p = { x: u*u*u*sg.from.x + 3*u*u*q*sg.c1.x + 3*u*q*q*sg.c2.x + q*q*q*sg.to.x,
                y: u*u*u*sg.from.y + 3*u*u*q*sg.c1.y + 3*u*q*q*sg.c2.y + q*q*q*sg.to.y };
    t += Math.hypot(p.x - pr.x, p.y - pr.y); pr = p; } return t; };
  const BL = dense(backNeck), FL = dense(frontNeck);
  const FB = { hash: "BF1", sourceVersion: 1, necklineLengths: { back: BL, front: FL, half: BL + FL, finished: 2 * (BL + FL) },
    back: { outline: [ln([0, 0], [0, 20], "center"), backNeck, ln([8, -2], [18, 2], "shoulder")], construction: [] },
    front: { outline: [ln([40, 4], [40, 20], "center"), frontNeck, ln([32, -4], [22, 0], "shoulder")], construction: [] } };
  const FS = { collarWidthCm: 5.5, frontEndFromFnpCm: 6, frontEndOffsetCm: 4 };
  const fl = DC.computeFlatCollarS(FB, FS);
  const cd = { sourceBodiceHash: "BF1", type: "flat-collar", baseMethod: "bunka-flat-collar-S-v1",
    parameters: { flat: FS }, flat: { geometry: fl.geometry, measure: fl.measure, anchors: fl.anchors } };
  const model = CA.buildModel(cd, FB), inputs = {}, results = {}, dims = {};
  model.inputs.forEach(r => { inputs[r.key] = r.value; });
  model.results.forEach(r => { results[r.key] = r; });
  model.dims.forEach(d => { dims[d.id] = d; });
  ok(model.recipe === "bunka-flat-collar-S-v1" && CA.recipes().indexOf("bunka-flat-collar-S-v1") >= 0, "15: S 전용 recipe 등록");
  ok(inputs.collarWidthCm === 5.5 && inputs.frontEndFromFnpCm === 6 && inputs.frontEndOffsetCm === 4, "15: 제도 입력값 3개(칼라 폭·앞 끝선·안내선)");
  ok(dims["cb-width"].text === 5.5 && dims["shoulder-butt"].text === 5.5 && dims["front-end"].text === 6, "15: 뒤 중심 폭·어깨 폭·앞 끝선 치수선");
  ok(Math.abs(dims["cb-width"].from.x - dims["cb-width"].to.x) < 1e-9, "15: 뒤 중심 폭 치수선은 CB(수직)");
  ok(dims["front-end-offset"].kind === "ref" && dims["front-end"].kind === "dim", "15: 안내선은 참조선(치수 아님)");
  ok(!dims["attach"] && results.attachLen.value === fl.measure.attachLenCm, "15: 달림선은 치수선이 아니라 실측 결과로만");
  ok(results.neckDiff.status === "match", "15: 달림선 = 몸판 목둘레 정합");
  ok(results.cbWidth.value === fl.measure.cbWidthLenCm && results.shoulderWidth.value === fl.measure.shoulderWidthLenCm
    && results.frontEnd.value === fl.measure.frontEndLenCm && results.outerLen.value === fl.measure.outerLenCm, "15: 실측 결과 행");
  ok(/맞대/.test(model.note) && /플랫/.test(model.note), "15: 어깨 맞댐·플랫 칼라 안내");
  ok(model.labels.some(l => l.id === "snp") && model.labels.some(l => l.id === "fnp") && model.labels.some(l => l.id === "cb"), "15: CB·SNP·FNP 라벨");
  ok(CA.buildModel({ type: "flat-collar", baseMethod: "bunka-flat-collar-S-v1" }, FB) === null, "15: 형상 없으면 표시 모델 없음");
}

// 16. 교재 T(플랫 칼라 겹침형) 표시 모델 — 겹침·올림·칼라 폭·앞 끝선 치수와 부족분 보고
{
  const cub = (a, b, c, d) => ({ kind: "cubic", from: { x: a[0], y: a[1] }, c1: { x: b[0], y: b[1] }, c2: { x: c[0], y: c[1] }, to: { x: d[0], y: d[1] } });
  const ln = (a, b, edge) => { const s2 = { kind: "line", from: { x: a[0], y: a[1] }, to: { x: b[0], y: b[1] } }; if (edge) s2.edge = edge; return s2; };
  const we = (s2, e) => Object.assign({}, s2, { edge: e });
  const backNeck = we(cub([0, 0], [3, 0], [6, -1], [8, -2]), "neckline");
  const frontNeck = we(cub([40, 4], [37, 2], [34, -2], [32, -4]), "neckline");
  const dense = (sg) => { let t = 0, pr = sg.from; for (let i = 1; i <= 4000; i++) { const q = i / 4000, u = 1 - q;
    const p = { x: u*u*u*sg.from.x + 3*u*u*q*sg.c1.x + 3*u*q*q*sg.c2.x + q*q*q*sg.to.x,
                y: u*u*u*sg.from.y + 3*u*u*q*sg.c1.y + 3*u*q*q*sg.c2.y + q*q*q*sg.to.y };
    t += Math.hypot(p.x - pr.x, p.y - pr.y); pr = p; } return t; };
  const BL = dense(backNeck), FL = dense(frontNeck);
  const TB = { hash: "BT1", sourceVersion: 1, necklineLengths: { back: BL, front: FL, half: BL + FL, finished: 2 * (BL + FL) },
    back: { outline: [ln([0, 0], [0, 20], "center"), backNeck, ln([8, -2], [18, 2], "shoulder")], construction: [] },
    front: { outline: [ln([40, 4], [40, 20], "center"), frontNeck, ln([32, -4], [22, 0], "shoulder")], construction: [] } };
  const TP = { collarWidthCm: 5.5, cbRiseCm: 0.5, shoulderOverlapCm: 3.5, frontEndFromFnpCm: 6, frontEndOffsetCm: 4 };
  const fl = DC.computeFlatCollarT(TB, TP);
  const cd = { sourceBodiceHash: "BT1", type: "flat-collar-overlap", baseMethod: "bunka-flat-collar-T-v1",
    parameters: { flatOverlap: TP }, flat: { geometry: fl.geometry, measure: fl.measure, anchors: fl.anchors } };
  const model = CA.buildModel(cd, TB), inputs = {}, results = {}, dims = {};
  model.inputs.forEach(r => { inputs[r.key] = r.value; });
  model.results.forEach(r => { results[r.key] = r; });
  model.dims.forEach(d => { dims[d.id] = d; });
  ok(model.recipe === "bunka-flat-collar-T-v1" && CA.recipes().indexOf("bunka-flat-collar-T-v1") >= 0, "16: T 전용 recipe 등록");
  ok(inputs.collarWidthCm === 5.5 && inputs.cbRiseCm === 0.5 && inputs.shoulderOverlapCm === 3.5
    && inputs.frontEndFromFnpCm === 6 && inputs.frontEndOffsetCm === 4, "16: 제도 입력값 5개");
  ok(dims["cb-rise"].text === 0.5 && dims["cb-width"].text === 5.5 && dims["shoulder-width"].text === 5.5 && dims["front-end"].text === 6,
    "16: 올림·뒤 중심 폭·어깨 폭·앞 끝선 치수선");
  ok(Math.abs(dims["cb-rise"].from.x - dims["cb-rise"].to.x) < 1e-9 && Math.abs(dims["cb-width"].from.x - dims["cb-width"].to.x) < 1e-9,
    "16: 올림·뒤 중심 폭 치수선은 CB(수직)");
  ok(results.attachShortfall.value === fl.measure.attachShortfallCm && results.attachShortfall.value > 0,
    "16: 부족분(늘려 박는 분) 결과 행");
  ok(results.shoulderTipGap.value === fl.measure.shoulderTipGapCm && results.overlapAngle.value === fl.measure.overlapAngleDeg,
    "16: 어깨 겹침·회전각 실측 결과 행");
  ok(!results.neckDiff, "16: T 는 달림선 = 목둘레 정합 행을 쓰지 않는다(짧은 게 정상)");
  ok(/겹쳐/.test(model.note) && /칼라 허리/.test(model.note), "16: 겹침·칼라 허리 안내");
  ok(CA.buildModel({ type: "flat-collar-overlap", baseMethod: "bunka-flat-collar-T-v1" }, TB) === null, "16: 형상 없으면 표시 모델 없음");
  // S recipe 는 그대로(같은 family 라도 분리)
  {
    const sFl = DC.computeFlatCollarS(TB, { collarWidthCm: 5.5, frontEndFromFnpCm: 6, frontEndOffsetCm: 4 });
    const sModel = CA.buildModel({ type: "flat-collar", baseMethod: "bunka-flat-collar-S-v1",
      parameters: { flat: { collarWidthCm: 5.5, frontEndFromFnpCm: 6, frontEndOffsetCm: 4 } },
      flat: { geometry: sFl.geometry, measure: sFl.measure, anchors: sFl.anchors } }, TB);
    ok(sModel.recipe === "bunka-flat-collar-S-v1" && sModel.inputs.length === 3, "16: S recipe 불변(입력 3개)");
  }
}

// 17. 교재 U(세일러 칼라) 표시 모델 — V 파생 목선·겹침·네모 뒤판 치수
{
  const cub = (a, b, c, d) => ({ kind: "cubic", from: { x: a[0], y: a[1] }, c1: { x: b[0], y: b[1] }, c2: { x: c[0], y: c[1] }, to: { x: d[0], y: d[1] } });
  const ln = (a, b, edge) => { const s2 = { kind: "line", from: { x: a[0], y: a[1] }, to: { x: b[0], y: b[1] } }; if (edge) s2.edge = edge; return s2; };
  const we = (s2, e) => Object.assign({}, s2, { edge: e });
  const backNeck = we(cub([0, 0], [3, 0], [6, -1], [8, -2]), "neckline");
  const frontNeck = we(cub([40, 4], [37, 2], [34, -2], [32, -4]), "neckline");
  const dense = (sg) => { let t = 0, pr = sg.from; for (let i = 1; i <= 4000; i++) { const q = i / 4000, u = 1 - q;
    const p = { x: u*u*u*sg.from.x + 3*u*u*q*sg.c1.x + 3*u*q*q*sg.c2.x + q*q*q*sg.to.x,
                y: u*u*u*sg.from.y + 3*u*u*q*sg.c1.y + 3*u*q*q*sg.c2.y + q*q*q*sg.to.y };
    t += Math.hypot(p.x - pr.x, p.y - pr.y); pr = p; } return t; };
  const BL = dense(backNeck), FL = dense(frontNeck);
  const UB = { hash: "BU1", sourceVersion: 1, necklineLengths: { back: BL, front: FL, half: BL + FL, finished: 2 * (BL + FL) },
    back: { outline: [ln([0, 0], [0, 40], "center"), backNeck, ln([8, -2], [18, 2], "shoulder")], construction: [] },
    front: { outline: [ln([40, 4], [40, 40], "center"), frontNeck, ln([32, -4], [22, 0], "shoulder")], construction: [] } };
  const UP = { vDropCm: 12, vHollowCm: 0.8, shoulderOverlapCm: 1.5, cbRiseCm: 0.5,
    cbWidthCm: 11, backOuterCm: 15.5, shoulderWidthCm: 10, frontOuterBowCm: 1.5 };
  const sc = DC.computeSailorCollarU(UB, UP);
  const cd = { sourceBodiceHash: "BU1", type: "sailor-collar", baseMethod: "bunka-sailor-collar-U-v1",
    parameters: { sailor: UP }, sailor: { geometry: sc.geometry, measure: sc.measure, anchors: sc.anchors } };
  const model = CA.buildModel(cd, UB), inputs = {}, results = {}, dims = {};
  model.inputs.forEach(r => { inputs[r.key] = r.value; });
  model.results.forEach(r => { results[r.key] = r; });
  model.dims.forEach(d => { dims[d.id] = d; });
  ok(model.recipe === "bunka-sailor-collar-U-v1" && CA.recipes().indexOf("bunka-sailor-collar-U-v1") >= 0, "17: U 전용 recipe 등록");
  ok(inputs.vDropCm === 12 && inputs.vHollowCm === 0.8 && inputs.shoulderOverlapCm === 1.5 && inputs.cbRiseCm === 0.5
    && inputs.cbWidthCm === 11 && inputs.backOuterCm === 15.5 && inputs.shoulderWidthCm === 10 && inputs.frontOuterBowCm === 1.5,
    "17: 제도 입력값 8개");
  ok(dims["cb-rise"].text === 0.5 && dims["cb-width"].text === 11 && dims["back-outer"].text === 15.5 && dims["shoulder-width"].text === 10,
    "17: 올림·뒤 중심 폭·뒤 외곽·어깨 폭 치수선");
  ok(Math.abs(dims["cb-width"].from.x - dims["cb-width"].to.x) < 1e-9 && Math.abs(dims["back-outer"].from.y - dims["back-outer"].to.y) < 1e-9,
    "17: 뒤 중심 폭은 수직 · 뒤 외곽은 그에 직각(수평)");
  ok(dims["front-chord"].kind === "ref", "17: 앞 외곽 현은 참조선");
  ok(results.vNeck.value === sc.measure.vNeckLenCm && results.neckTarget.value === sc.measure.neckTargetCm
    && results.neckTarget.value !== UB.necklineLengths.half, "17: 파생 V 목선·칼라가 붙는 목둘레를 따로 보고(원래 목둘레 아님)");
  ok(results.attachShortfall.value === sc.measure.attachShortfallCm && results.attachShortfall.value > 0, "17: 늘려 박는 분 보고");
  ok(results.backCorner.value === sc.measure.backCornerAngleDeg && Math.abs(results.backCorner.value - 90) < 1e-6, "17: 뒤 중심 모서리 90° 보고");
  ok(/V/.test(model.note) && /겹쳐/.test(model.note), "17: V·겹침 안내");
  ok(results.vNeck.label === "파생 V 목선 실측(SNP→12 내린 점)", "17: U 라벨 문구 불변(내림 12)");
  ok(model.labels.some(l => l.id === "snp") && model.labels.some(l => l.id === "fnp"), "17: SNP·FNP 라벨");
  ok(CA.buildModel({ type: "sailor-collar", baseMethod: "bunka-sailor-collar-U-v1" }, UB) === null, "17: 형상 없으면 표시 모델 없음");
  // 플랫 recipe 는 그대로
  {
    const fl = DC.computeFlatCollarS(UB, { collarWidthCm: 5.5, frontEndFromFnpCm: 6, frontEndOffsetCm: 4 });
    const sModel = CA.buildModel({ type: "flat-collar", baseMethod: "bunka-flat-collar-S-v1",
      parameters: { flat: { collarWidthCm: 5.5, frontEndFromFnpCm: 6, frontEndOffsetCm: 4 } },
      flat: { geometry: fl.geometry, measure: fl.measure, anchors: fl.anchors } }, UB);
    ok(sModel.recipe === "bunka-flat-collar-S-v1" && sModel.inputs.length === 3, "17: S recipe 불변");
  }
}

// 17-VW. 교재 V·W 는 U 와 같은 표시 규칙을 공유한다 — 수치는 상수가 아니라 parameters 에서 온다
{
  const cub = (a, b, c, d) => ({ kind: "cubic", from: { x: a[0], y: a[1] }, c1: { x: b[0], y: b[1] }, c2: { x: c[0], y: c[1] }, to: { x: d[0], y: d[1] } });
  const ln = (a, b, edge) => { const s2 = { kind: "line", from: { x: a[0], y: a[1] }, to: { x: b[0], y: b[1] } }; if (edge) s2.edge = edge; return s2; };
  const we = (s2, e) => Object.assign({}, s2, { edge: e });
  const backNeck = we(cub([0, 0], [3, 0], [6, -1], [8, -2]), "neckline");
  const frontNeck = we(cub([40, 4], [37, 2], [34, -2], [32, -4]), "neckline");
  const B = { hash: "BVW", sourceVersion: 1, necklineLengths: { back: 8.5, front: 11.5, half: 20, finished: 40 },
    back: { outline: [ln([0, 0], [0, 40], "center"), backNeck, ln([8, -2], [18, 2], "shoulder")], construction: [] },
    front: { outline: [ln([40, 4], [40, 40], "center"), frontNeck, ln([32, -4], [22, 0], "shoulder")], construction: [] } };
  const VP = { vDropCm: 12, vHollowCm: 0.8, shoulderOverlapCm: 1.5, cbRiseCm: 0.5,
    cbWidthCm: 9, backOuterCm: 13.5, shoulderWidthCm: 7, frontOuterBowCm: 1 };
  const WP = { vDropCm: 22, vHollowCm: 0.3, shoulderOverlapCm: 1.5, cbRiseCm: 0.5,
    cbWidthCm: 11, backOuterCm: 15.5, shoulderWidthCm: 10, frontOuterBowCm: 0.7 };
  const mk = (P, method) => {
    const r = DC.computeSailorCollarU(B, P);
    return CA.buildModel({ sourceBodiceHash: "BVW", type: "sailor-collar", baseMethod: method,
      parameters: { sailor: P }, sailor: { geometry: r.geometry, measure: r.measure, anchors: r.anchors } }, B);
  };
  const mv = mk(VP, "bunka-sailor-collar-V-v1"), mw = mk(WP, "bunka-sailor-collar-W-v1");
  const idx = (m) => { const o = { inputs: {}, results: {}, dims: {} };
    m.inputs.forEach(r => { o.inputs[r.key] = r.value; }); m.results.forEach(r => { o.results[r.key] = r; });
    m.dims.forEach(d => { o.dims[d.id] = d; }); return o; };
  const iv = idx(mv), iw = idx(mw);

  ok(CA.recipes().indexOf("bunka-sailor-collar-V-v1") >= 0 && CA.recipes().indexOf("bunka-sailor-collar-W-v1") >= 0
    && mv.recipe === "bunka-sailor-collar-V-v1" && mw.recipe === "bunka-sailor-collar-W-v1", "17-VW: V·W recipe 등록·출처 표기");
  const JS = (x) => JSON.stringify(x);
  ok(JS(mv.inputs.map(r => r.key)) === JS(mw.inputs.map(r => r.key)) && mv.inputs.length === 8,
    "17-VW: 입력 항목·순서는 U 와 공유(8개)");
  ok(iv.inputs.cbWidthCm === 9 && iv.inputs.backOuterCm === 13.5 && iv.inputs.shoulderWidthCm === 7 && iv.inputs.frontOuterBowCm === 1,
    "17-VW: V 입력값 = 교재 수치");
  ok(iw.inputs.vDropCm === 22 && iw.inputs.vHollowCm === 0.3 && iw.inputs.frontOuterBowCm === 0.7 && iw.inputs.cbWidthCm === 11,
    "17-VW: W 입력값 = 교재 수치");
  ok(iv.dims["cb-width"].text === 9 && iv.dims["back-outer"].text === 13.5 && iv.dims["shoulder-width"].text === 7
    && iw.dims["cb-width"].text === 11 && iw.dims["back-outer"].text === 15.5, "17-VW: 치수선 값이 각 도해 수치");
  // ★ 라벨의 내림 치수는 상수가 아니다 — W 는 22 로 표시된다(U·V 는 12)
  ok(iv.results.vNeck.label === "파생 V 목선 실측(SNP→12 내린 점)"
    && iw.results.vNeck.label === "파생 V 목선 실측(SNP→22 내린 점)", "17-VW: V 목선 라벨이 parameters 의 내림 치수를 따른다");
  ok(iw.results.vNeck.value > iv.results.vNeck.value && iw.results.neckTarget.value > iv.results.neckTarget.value,
    "17-VW: W 가 더 깊은 V 목선·긴 목둘레로 보고");
  ok(Math.abs(iv.results.backCorner.value - 90) < 1e-6 && Math.abs(iw.results.backCorner.value - 90) < 1e-6, "17-VW: 뒤 중심 모서리 90° 보고");
  ok(mv.note === mw.note && /겹쳐/.test(mv.note), "17-VW: 같은 제도 안내를 공유");
  ok(CA.buildModel({ type: "sailor-collar", baseMethod: "bunka-sailor-collar-W-v1" }, B) === null, "17-VW: 형상 없으면 표시 모델 없음");
  ok(CA.buildModel({ type: "sailor-collar", baseMethod: "bunka-sailor-collar-X-v1",
    parameters: { sailor: VP }, sailor: { geometry: {}, measure: {}, anchors: {} } }, B) === null, "17-VW: 등록 안 된 recipe 는 표시 없음");
}

// 18. 보 칼라 X·Y·Z(P.71) — 하나의 recipe 가 세 도해를 표시하고, 수치는 parameters 에서만 읽는다
{
  const BB = { hash: "BX1", sourceVersion: 1, placket: { parameters: { overlapCm: 1.75 } },
    necklineLengths: { back: 7.6926, front: 11.129, half: 18.8216, finished: 37.6432 } };
  const P = { X: { collarWidthCm: 3, ribbonLengthCm: 45, attachEndFromCfCm: 3 },
    Y: { collarWidthCm: 7, ribbonLengthCm: 60, attachEndFromCfCm: 3 },
    Z: { collarWidthCm: 15, ribbonLengthCm: 75, attachEndFromCfCm: 3 } };
  const mk = (k) => {
    const r = DC.computeBowCollar(BB, P[k]);
    return { model: CA.buildModel({ sourceBodiceHash: "BX1", type: "bow-collar", baseMethod: "bunka-bow-collar-" + k + "-v1",
      parameters: { bow: P[k] }, bow: { geometry: r.geometry, measure: r.measure, anchors: r.anchors } }, BB), calc: r };
  };
  const idx = (m) => { const o = { inputs: {}, results: {}, dims: {}, labels: {} };
    m.inputs.forEach(r => { o.inputs[r.key] = r.value; });
    m.results.forEach(r => { o.results[r.key] = r; });
    m.dims.forEach(d => { o.dims[d.id] = d; });
    m.labels.forEach(l => { o.labels[l.id] = l; });
    return o; };
  const X = mk("X"), Y = mk("Y"), Z = mk("Z");
  const ix = idx(X.model), iy = idx(Y.model), iz = idx(Z.model);

  ok(["X", "Y", "Z"].every(k => CA.recipes().indexOf("bunka-bow-collar-" + k + "-v1") >= 0)
    && X.model.recipe === "bunka-bow-collar-X-v1" && Z.model.recipe === "bunka-bow-collar-Z-v1", "18: X·Y·Z recipe 등록·출처 표기");
  ok(ix.inputs.collarWidthCm === 3 && ix.inputs.ribbonLengthCm === 45 && ix.inputs.attachEndFromCfCm === 3
    && iz.inputs.collarWidthCm === 15 && iz.inputs.ribbonLengthCm === 75, "18: 제도 입력값 3개(도해별 수치 그대로)");
  ok(ix.dims["collar-width"].text === 3 && iy.dims["collar-width"].text === 7 && iz.dims["collar-width"].text === 15
    && ix.dims["ribbon-length"].text === 45 && iz.dims["ribbon-length"].text === 75, "18: 칼라 폭·리본 치수선은 parameters 값");
  ok(Math.abs(ix.dims["collar-width"].from.x - ix.dims["collar-width"].to.x) < 1e-9
    && Math.abs(ix.dims["ribbon-length"].from.y - ix.dims["ribbon-length"].to.y) < 1e-9,
    "18: 칼라 폭은 수직 · 리본은 기준 수평선 위");
  ok(ix.dims["neck-seam"].kind === "dim" && ix.dims["attach-end-mark"].kind === "ref",
    "18: 달림선은 치수선 · 칼라 달림 끝 표시는 참조선");
  ok(ix.labels["cb"] && ix.labels["attach-end"] && ix.labels["ribbon-end"], "18: CB·칼라 달림 끝·리본 끝 라벨");

  ok(ix.results.neckBack.value === BB.necklineLengths.back && ix.results.neckFront.value === BB.necklineLengths.front,
    "18: 몸판 목둘레를 그대로 보고");
  ok(ix.results.frontAttach.value === X.calc.measure.frontAttachLenCm
    && Math.abs(ix.results.frontAttach.value - (BB.necklineLengths.front - 3)) < 1e-9,
    "18: ⊠ = 앞목 − 칼라 달림 끝(앞목 전체가 아니다)");
  ok(ix.results.neckTarget.value === X.calc.measure.neckTargetCm && ix.results.attachLen.value === X.calc.measure.attachLenCm
    && ix.results.seamDiff.status === "match", "18: 달림선 = ×+⊠ 정합 보고");
  ok(ix.results.ribbonLen.value === 45 && iz.results.ribbonLen.value === 75
    && ix.results.totalLen.value === X.calc.measure.totalLenCm, "18: 리본·전체 길이 실측 보고");
  ok(ix.results.collarWidth.value === 3 && iz.results.collarWidth.value === 15, "18: 칼라 폭 실측 보고");

  // 세 도해가 같은 제도 → 달림선 치수·안내 문구는 공유하고 폭·리본만 다르다
  ok(X.model.note === Y.model.note && Y.model.note === Z.model.note && /수평선/.test(X.model.note), "18: 같은 제도 안내를 공유");
  ok(ix.results.neckTarget.value === iz.results.neckTarget.value && ix.results.attachLen.value === iz.results.attachLen.value,
    "18: 달림선은 X·Z 가 같다(칼라 달림 끝 공통)");
  ok(iz.results.collarWidth.value > iy.results.collarWidth.value && iy.results.collarWidth.value > ix.results.collarWidth.value
    && iz.results.ribbonLen.value > ix.results.ribbonLen.value, "18: 폭·리본만 도해별로 커진다");

  ok(CA.buildModel({ type: "bow-collar", baseMethod: "bunka-bow-collar-X-v1" }, BB) === null, "18: 형상 없으면 표시 모델 없음");
  ok(CA.buildModel({ type: "bow-collar", baseMethod: "bunka-bow-collar-Q-v1",
    parameters: { bow: P.X }, bow: { geometry: {}, measure: {}, anchors: {} } }, BB) === null, "18: 등록 안 된 recipe 는 표시 없음");
  // 다른 family recipe 는 그대로
  ok(CA.buildModel({ type: "flat-collar", baseMethod: "bunka-flat-collar-S-v1" }, BB) === null
    && CA.recipes().indexOf("bunka-band-collar-P148-v1") >= 0, "18: 기존 recipe 등록 유지");
}

// 19. 프릴 칼라 a·b·c(P.72–73): 개더 준비 길이와 절개·전개 보조수치를 구분한다
{
  const ln = (a, b, edge) => Object.assign({ kind: "line", from: { x: a[0], y: a[1] }, to: { x: b[0], y: b[1] } }, edge ? { edge } : {});
  const cub = (a, b, c, d, edge) => Object.assign({ kind: "cubic", from: { x: a[0], y: a[1] }, c1: { x: b[0], y: b[1] }, c2: { x: c[0], y: c[1] }, to: { x: d[0], y: d[1] } }, edge ? { edge } : {});
  const FB = { hash: "BFR", sourceVersion: 1, necklineLengths: { back: 8, front: 11, half: 19, finished: 38 },
    front: { outline: [ln([40, 2], [40, 40], "center"), cub([40, 2], [36, 2], [33, -1], [30, -3], "neckline"), ln([30, -3], [20, 1], "shoulder")], construction: [] } };
  const P = {
    a: { styleCode: 0, collarWidthCm: 8, gatherRatio: 2, vDropCm: 0, vHollowCm: 0, spreadCount: 0, spreadEachCm: 0 },
    b: { styleCode: 1, collarWidthCm: 8, gatherRatio: 1, vDropCm: 0, vHollowCm: 0, spreadCount: 6, spreadEachCm: 3 },
    c: { styleCode: 2, collarWidthCm: 8, gatherRatio: 1, vDropCm: 22, vHollowCm: 1, spreadCount: 10, spreadEachCm: 3 }
  };
  const make = (k) => { const r = DC.computeFrillCollar(FB, P[k]); return CA.buildModel({ sourceBodiceHash: "BFR", type: "frill-collar",
    baseMethod: "bunka-frill-collar-" + k + "-v1", parameters: { frill: P[k] },
    frill: { geometry: r.geometry, measure: r.measure, anchors: r.anchors } }, FB); };
  const a = make("a"), b = make("b"), c = make("c");
  const idx = (m) => { const o = { inputs: {}, results: {}, dims: {} }; m.inputs.forEach(x => o.inputs[x.key] = x.value);
    m.results.forEach(x => o.results[x.key] = x); m.dims.forEach(x => o.dims[x.id] = x); return o; };
  const ia = idx(a), ib = idx(b), ic = idx(c);
  ok(["a", "b", "c"].every(k => CA.recipes().indexOf("bunka-frill-collar-" + k + "-v1") >= 0), "19: a·b·c recipe 등록");
  ok(ia.inputs.collarWidthCm === 8 && ia.inputs.gatherRatio === 2 && ib.inputs.spreadCount === 6 && ic.inputs.vDropCm === 22,
    "19: 제도 입력값은 variant 파라미터에서 표시");
  ok(a.inputs.find(x => x.key === "gatherRatio").unit === "배"
    && b.inputs.find(x => x.key === "spreadCount").unit === "개"
    && b.results.find(x => x.key === "flareAngle").unit === "°",
    "19: 개더 배율·절개 수·전개각은 cm가 아닌 고유 단위");
  ok(ia.results.cutAttach.value === 38 && ia.results.finishedAttach.value === 19 && ia.results.gatherAmount.value === 19,
    "19: a 재단 길이·완성 달림선·개더 분량 분리");
  ok(ib.results.spreadTotal.value === 18 && ic.results.spreadTotal.value === 30 && ic.results.neckTarget.value > ib.results.neckTarget.value,
    "19: b·c 전개량과 V 목둘레 결과 분리");
  ok(ia.dims["collar-width"].text === 8 && ib.dims["prepared-attach"] && /절개·전개/.test(b.note) && /V 목둘레/.test(c.note),
    "19: 폭·달림변 치수선과 방식별 안내");
  ok(CA.buildModel({ type: "frill-collar", baseMethod: "bunka-frill-collar-a-v1" }, FB) === null, "19: 형상 없으면 표시 모델 없음");
}

// 20. 후드 d(P.74 · 제도 방법 P.151) — 표시 모델은 parameters·anchors·measures 만 소비한다
{
  const ln = (a, b, edge) => ({ kind: "line", from: { x: a[0], y: a[1] }, to: { x: b[0], y: b[1] }, edge: edge });
  const cub = (a, b, c, d, edge) => ({ kind: "cubic", from: { x: a[0], y: a[1] }, c1: { x: b[0], y: b[1] },
    c2: { x: c[0], y: c[1] }, to: { x: d[0], y: d[1] }, edge: edge });
  const frontNeck = cub([40, 4], [37, 2], [34, -2], [32, -4], "neckline");
  const dense = (s2) => { let t = 0, pr = s2.from; for (let i = 1; i <= 4000; i++) {
    const u = 1 - i / 4000, tt = i / 4000;
    const p = { x: u*u*u*s2.from.x + 3*u*u*tt*s2.c1.x + 3*u*tt*tt*s2.c2.x + tt*tt*tt*s2.to.x,
                y: u*u*u*s2.from.y + 3*u*u*tt*s2.c1.y + 3*u*tt*tt*s2.c2.y + tt*tt*tt*s2.to.y };
    t += Math.hypot(p.x - pr.x, p.y - pr.y); pr = p; } return t; };
  const FL = dense(frontNeck), BL = 8.5;
  const HB = { hash: "BHD", sourceVersion: 1,
    necklineLengths: { back: BL, front: FL, half: BL + FL, finished: 2 * (BL + FL) },
    front: { outline: [ln([40, 4], [40, 40], "center"), frontNeck, ln([32, -4], [22, 0], "shoulder")], construction: [] } };
  const HP = { styleCode: 0, headCircumferenceCm: 56, hoodMeasureCm: 39, widthOffsetCm: -3, lengthOffsetCm: 5,
    topStraightCm: 8, cornerCurveCm: 6.5, snpRadiusCm: 4 };
  const hd = DC.computeHood(HB, HP);
  const cd = { sourceBodiceHash: "BHD", type: "hood", baseMethod: "bunka-hood-d-v1",
    parameters: { hood: HP }, hood: { geometry: hd.geometry, measure: hd.measure, anchors: hd.anchors } };
  const model = CA.buildModel(cd, HB), inputs = {}, results = {}, dims = {}, labels = {};
  model.inputs.forEach(r => { inputs[r.key] = r.value; });
  model.results.forEach(r => { results[r.key] = r; });
  model.dims.forEach(d => { dims[d.id] = d; });
  model.labels.forEach(l => { labels[l.id] = l; });

  ok(model.recipe === "bunka-hood-d-v1" && CA.recipes().indexOf("bunka-hood-d-v1") >= 0, "20: d 전용 recipe 등록");
  ok(inputs.headCircumferenceCm === 56 && inputs.hoodMeasureCm === 39 && inputs.widthOffsetCm === -3
    && inputs.lengthOffsetCm === 5 && inputs.topStraightCm === 8 && inputs.cornerCurveCm === 6.5
    && inputs.snpRadiusCm === 4, "20: 제도 입력값 7개(전부 parameters 값)");
  // ★ 폭·길이는 입력이 아니라 **파생 결과**로만 보고한다(교재 공식)
  ok(!("hoodWidthCm" in inputs) && !("hoodLengthCm" in inputs)
    && results.hoodWidth.value === 25 && results.hoodLength.value === 44, "20: 폭 25·길이 44 는 파생 결과로 보고");
  ok(dims["hood-length"].text === 44 && dims["hood-width"].text === 25 && dims["top-straight"].text === 8
    && dims["snp-radius"].text === 4, "20: 길이·폭·윗변·반원 치수선");
  ok(Math.abs(dims["hood-length"].from.x - dims["hood-length"].to.x) < 1e-9
    && Math.abs(dims["hood-width"].from.y - dims["hood-width"].to.y) < 1e-9,
    "20: 앞 끝선은 수직 · 후드 폭은 그에 직각(수평)");
  ok(dims["cb-guide"].kind === "ref" && dims["mid-guide"].kind === "ref" && dims["corner-curve"].kind === "ref",
    "20: 안내선·모서리 대각은 참조선");
  ok(labels.fnp && labels.snp && labels["mid-front"] && labels["attach-join"], "20: FNP·SNP·Ⓐ·Ⓑ 라벨");

  ok(results.neckBack.value === BL && results.neckFront.value === FL, "20: 몸판 목둘레를 그대로 보고");
  ok(Math.abs(results.frontAttach.value - FL) < 1e-6 && Math.abs(results.backAttach.value - BL) < 1e-6
    && results.attachDiff.status === "match", "20: 앞·뒤 달림선 = 몸판 앞목·뒤목 정합 보고");
  // ★ Ⓑ 각도·뒤 달림선 처짐은 입력이 아니라 길이 책임을 맞춘 **결과**다
  ok(!("snpAngleDeg" in inputs) && !("backSeamBowCm" in inputs)
    && results.snpAngle.value > 0 && results.snpAngle.value < 90
    && results.backBow.value > 0.3 && results.backBow.value < 0.9, "20: Ⓑ 각도·처짐(교재 도해 0.6)은 파생 결과");
  ok(/목둘레와 같은 치수/.test(model.note) && /뒤 중심선/.test(model.note), "20: 길이 책임·뒤 중심선 안내");

  ok(CA.buildModel({ type: "hood", baseMethod: "bunka-hood-d-v1" }, HB) === null, "20: 형상 없으면 표시 모델 없음");
  ok(CA.buildModel({ type: "hood", baseMethod: "bunka-hood-f-v1",
    parameters: { hood: HP }, hood: { geometry: {}, measure: {}, anchors: {} } }, HB) === null,
    "20: 미구현 도해(f) recipe 는 표시 없음");
  ok(CA.recipes().indexOf("bunka-frill-collar-a-v1") >= 0 && CA.recipes().indexOf("bunka-bow-collar-X-v1") >= 0,
    "20: 기존 recipe 등록 유지");
}

console.log(`collarAnnotationCheck: ${PASS} PASS, ${FAIL} FAIL`);
if (FAIL) { console.log("FAILURES:\n  " + fails.join("\n  ")); process.exit(1); }
