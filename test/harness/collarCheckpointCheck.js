// ══════════════════════════════════════════════
// collarCheckpointCheck.js — js/collarCheckpoint.js 완료 게이트·스냅샷·스테일 회귀.
// 실제 designCollar.js + collarCheckpoint.js 를 같은 vm 으로 실행(진짜 stand/body geometry).
// bodiceCheckpoint/sleeveCheckpoint/designWorkflow 는 스텁(게이트·불변 스냅샷·형상전용 스테일·
// 몸판 무효화 vs 소매 순서 게이트 분리·idempotent 가 대상).
//   node test/harness/collarCheckpointCheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");
let PASS = 0, FAIL = 0; const fails = [];
function ok(cond, name) { if (cond) PASS++; else { FAIL++; fails.push(name); } }
const near = (a, b, e = 1e-3) => Math.abs(a - b) < e;
const num = (v) => typeof v === "number" && isFinite(v);

// 스텁 상태
let BODICE = null, BODICE_STALE = false, SLEEVE = null, SLEEVE_CHANGED = false, SLEEVE_INVAL = false, PROJECT = null;
const sandbox = { window: {}, Math, JSON, Object, Array, isFinite, Infinity, Date };
sandbox.window.designWorkflow = { current: () => PROJECT };
sandbox.window.bodiceCheckpoint = { latest: () => BODICE, isCurrentBodiceChanged: () => BODICE_STALE };
sandbox.window.sleeveCheckpoint = { latest: () => SLEEVE, isCurrentSleeveChanged: () => SLEEVE_CHANGED, invalidatedByBodice: () => SLEEVE_INVAL };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "..", "js", "designCollar.js"), "utf8"), sandbox, { filename: "designCollar.js" });
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "..", "js", "collarCheckpoint.js"), "utf8"), sandbox, { filename: "collarCheckpoint.js" });
const DC = sandbox.window.designCollar, CC = sandbox.window.collarCheckpoint;

function bodice(hash) { return { hash: hash || "BH1", sourceVersion: 1, necklineLengths: { back: 10, front: 8, half: 18, finished: 36 } }; }
const STAND_P = { bandWidthCm: 3, frontRiseCm: 1.5, frontEndCm: 0.5 };   // 교재 P.148 밴드 파라미터
const BODY_P = { gapCm: 3, cbWidthCm: 4, frontProjectionCm: 1.5, pointDiagonalCm: 6, outerBowCm: 0 };   // 교재 M 위 칼라
// 실제 stand/body 로 collarDraft 구성.
function makeDraft(hash, opts) {
  opts = opts || {};
  const b = bodice(hash);
  const stand = DC.computeStand(b, STAND_P);
  const body = DC.computeBody(stand, BODY_P);
  const cd = { sourceBodiceHash: hash || "BH1", type: "shirt-two-piece", parameters: { stand: Object.assign({}, STAND_P) },
    standGeometry: opts.standGeometry || stand.standGeometry,
    body: { parameters: Object.assign({}, BODY_P), geometry: opts.bodyGeometry || body.bodyGeometry, attachLenCm: opts.attachLenCm != null ? opts.attachLenCm : body.attachLenCm, measure: body.measure } };
  if (opts.manual) { const lc = DC.collarBodyLineFromGeometry(body.bodyGeometry); cd.body.mode = "manual"; cd.body.lineId = "collar-body-1"; cd.body.invalid = !!opts.invalid; cd.body.manualLocked = lc.locked; opts._managedSegs = lc.segments; }
  return cd;
}
function fakeProject(opts) {
  opts = opts || {};
  const hash = opts.bodiceHash || "BH1";
  const cd = makeDraft(hash, opts);
  const pls = [];
  if (cd.body.mode === "manual") pls.push({ id: "collar-body-1", piece: "collar", role: "boundary", managedBy: "collar-body", segments: opts._managedSegs });
  return { sourceBlock: { id: "block-1", version: 1, canonicalHash: "CH1" }, working: { collarDraft: cd, patternLines: pls, collarResult: null } };
}
function reset() { BODICE = bodice("BH1"); BODICE_STALE = false; SLEEVE = { id: "s" }; SLEEVE_CHANGED = false; SLEEVE_INVAL = false; }

// 0. API
ok(typeof CC.check === "function" && typeof CC.complete === "function" && Object.isFrozen(CC), "0: API·frozen");

// 1. 유효 → 완료 스냅샷
{
  reset(); PROJECT = fakeProject();
  const c = CC.check(PROJECT); ok(c.ok, "1: 유효 check ok (" + c.fails.join(",") + ")");
  const r = CC.complete(PROJECT);
  ok(r.ok && PROJECT.working.collarResult, "1: 완료 성공·collarResult 저장");
  const res = r.result;
  ok(res.schemaVersion === 1 && res.type === "shirt-two-piece" && res.symmetry === "half-cb-fold", "1: schema·type·symmetry");
  ok(res.sourceBodiceHash === "BH1" && res.sourceBlock.version === 1, "1: sourceBodiceHash·sourceBlock");
  ok(res.stand.lengths && near(res.stand.lengths.lowerNeckSeam, 18, 0.01) && res.stand.geometry.outline.length, "1: stand.lengths·geometry");
  ok(res.body.mode === "parametric" && near(res.body.attachLenCm, res.stand.lengths.upperNeckSegment, 0.01) && res.body.manualSource === null, "1: body parametric·위칼라 이음선 = 밴드 윗선 ⒸⒹ(P.148 step 3)·manualSource null");
  ok(typeof res.hash === "string" && typeof res.completedAt === "number" && Object.isFrozen(res), "1: hash·completedAt·deepFrozen");
}

// 2. idempotent: 같은 형상 재완료 → 기존 참조·completedAt 유지
{
  reset(); PROJECT = fakeProject();
  const r1 = CC.complete(PROJECT), t1 = r1.result.completedAt;
  const r2 = CC.complete(PROJECT);
  ok(r2.idempotent === true && r2.result === r1.result && r2.result.completedAt === t1, "2: idempotent 같은 참조·completedAt 불변");
}

// 3. 게이트 실패(각각) — 실패 시 collarResult 불변
{
  reset(); PROJECT = fakeProject(); CC.complete(PROJECT); const frozen = PROJECT.working.collarResult;
  reset(); BODICE = null; ok(CC.complete(PROJECT).reason === "no-bodice" && PROJECT.working.collarResult === frozen, "3: no-bodice·result 불변");
  reset(); BODICE_STALE = true; ok(CC.complete(PROJECT).reason === "bodice-stale", "3: bodice-stale");
  reset(); PROJECT.working.collarDraft.sourceBodiceHash = "OTHER"; ok(CC.check(PROJECT).fails.indexOf("source-mismatch") >= 0, "3: source-mismatch"); PROJECT.working.collarDraft.sourceBodiceHash = "BH1";
  reset(); SLEEVE = null; ok(CC.complete(PROJECT).reason === "no-sleeve", "3: no-sleeve(순서 게이트)");
  reset(); SLEEVE_CHANGED = true; ok(CC.check(PROJECT).fails.indexOf("sleeve-stale") >= 0, "3: sleeve-stale(순서 게이트)");
  reset(); PROJECT.working.collarDraft.standGeometry = null; ok(CC.check(PROJECT).fails.indexOf("no-stand") >= 0, "3: no-stand");
  reset(); PROJECT = fakeProject(); PROJECT.working.collarDraft.body.geometry = null; ok(CC.check(PROJECT).fails.indexOf("no-body") >= 0, "3: no-body");
  reset(); PROJECT = fakeProject(); PROJECT.working.collarDraft.body.attachLenCm = 999; ok(CC.check(PROJECT).fails.indexOf("seam-length-mismatch") >= 0, "3: 위칼라 이음선·밴드 길이 불일치 → seam-length-mismatch");
  reset(); PROJECT = fakeProject(); delete PROJECT.working.collarDraft.body.parameters.gapCm; ok(CC.check(PROJECT).fails.indexOf("gap-missing") >= 0, "3: CB 제도 간격 기록 없음 → gap-missing");
  reset(); PROJECT = fakeProject(); PROJECT.working.collarDraft.parameters.stand.bandWidthCm = 4; ok(CC.check(PROJECT).fails.indexOf("seam-length-mismatch") >= 0, "3: 밴드 파라미터가 형상과 어긋나면 길이 정합 실패");
}

// 4. manual: 관리선 존재·invalid 아니면 완료 + manualSource 저장
{
  reset(); PROJECT = fakeProject({ manual: true });
  const c = CC.check(PROJECT); ok(c.ok, "4: manual 유효 (" + c.fails.join(",") + ")");
  const r = CC.complete(PROJECT);
  ok(r.ok && r.result.body.mode === "manual" && r.result.body.manualSource && r.result.body.manualSource.lineId === "collar-body-1" && r.result.body.manualSource.segments.length, "4: manual 완료·manualSource(관리선 1개)");
  // manual invalid → 차단
  reset(); PROJECT = fakeProject({ manual: true, invalid: true });
  ok(CC.check(PROJECT).fails.indexOf("body-invalid") >= 0, "4: manual invalid → body-invalid 차단");
  // 관리선 없음 → 차단
  reset(); PROJECT = fakeProject({ manual: true }); PROJECT.working.patternLines = [];
  ok(CC.check(PROJECT).fails.indexOf("manual-line-missing") >= 0, "4: 관리선 없음 → manual-line-missing");
}

// 5. isCurrentCollarChanged: 파라미터 변경 → 변경됨
{
  reset(); PROJECT = fakeProject(); CC.complete(PROJECT);
  ok(CC.isCurrentCollarChanged(PROJECT) === false, "5: 완료 직후 미변경");
  // 밴드 파라미터 변경(P.148 계약 키) → **유효한 새 형상**으로 교체한 뒤 변경 판정.
  //   ★ 실패한 계산이나 undefined geometry 로 우연히 true 가 되면 안 되므로 성공을 먼저 assert 한다.
  const b = bodice("BH1");
  const stand2Params = { bandWidthCm: 4, frontRiseCm: 1.5, frontEndCm: 0.5 };
  const st = DC.computeStand(b, stand2Params);
  ok(st.ok && Array.isArray(st.standGeometry.outline) && st.standGeometry.outline.length > 0, "5: 새 밴드 계산 성공(" + (st.reason || "") + ")");
  const bd = DC.computeBody(st, BODY_P);
  ok(bd.ok && Array.isArray(bd.bodyGeometry.outline) && bd.bodyGeometry.outline.length > 0 && num(bd.attachLenCm), "5: 새 위 칼라 계산 성공(" + (bd.reason || "") + ")");
  const cd5 = PROJECT.working.collarDraft;
  cd5.parameters.stand = Object.assign({}, stand2Params);
  cd5.standGeometry = st.standGeometry;
  cd5.body.geometry = bd.bodyGeometry; cd5.body.attachLenCm = bd.attachLenCm; cd5.body.measure = bd.measure;
  ok(CC.check(PROJECT).ok, "5: 교체된 형상도 완료 게이트 통과(유효한 변경 경로)");
  ok(CC.isCurrentCollarChanged(PROJECT) === true, "5: 밴드 파라미터 변경 → 변경됨");
  // 다시 완료하면 새 형상 기준으로 미변경(변경 판정이 형상 signature 에서 온다는 확인)
  const r5 = CC.complete(PROJECT);
  ok(r5.ok && CC.isCurrentCollarChanged(PROJECT) === false, "5: 새 형상 재완료 → 미변경");
}

// 6. 몸판 hash 변경 → invalidatedByBodice(형상 무효) / 소매 변경은 무효화 아님
{
  reset(); PROJECT = fakeProject(); CC.complete(PROJECT);
  ok(CC.invalidatedByBodice(PROJECT) === false, "6: 완료 직후 몸판 무효 아님");
  BODICE = bodice("BH2");   // 몸판 hash 변경
  ok(CC.invalidatedByBodice(PROJECT) === true, "6: 몸판 hash 변경 → 무효");
  // 소매 변경은 result·무효화에 영향 없음 — sleeveStepChanged 만 true
  reset(); PROJECT = fakeProject(); CC.complete(PROJECT); const before = PROJECT.working.collarResult;
  SLEEVE_CHANGED = true;
  ok(CC.sleeveStepChanged(PROJECT) === true && CC.invalidatedByBodice(PROJECT) === false && PROJECT.working.collarResult === before, "6: 소매 변경 → 순서 표시만·result·무효화 없음");
}

// 7. hash 는 completedAt 제외(idempotent 로 이미 증명) + 다른 patternLines 제외
{
  reset(); PROJECT = fakeProject(); const r1 = CC.complete(PROJECT);
  PROJECT.working.patternLines.push({ id: "guide-9", piece: "front", role: "guide", segments: [{ kind: "line", from: { x: 0, y: 0 }, to: { x: 1, y: 1 } }] });
  const r2 = CC.complete(PROJECT);
  ok(r2.idempotent === true && r2.result === r1.result, "7: 다른 patternLine 추가는 hash 무관(idempotent 유지)");
}

// 8. 오픈 칼라 L: 종류별 스냅샷 분리 + 몸판 무효화 vs 소매 순서 게이트(한 장·2피스와 같은 계약)
{
  const b = bodice("BHL");
  b.front = { outline: [
    { kind: "line", from: { x: 40, y: 2 }, to: { x: 40, y: 38 }, edge: "center" },
    { kind: "path", commands: [{ type: "M", points: [{ x: 40, y: 2 }] },
      { type: "C", points: [{ x: 35.6, y: 2 }, { x: 31.4, y: 0.2 }, { x: 29.2, y: -2.4 }] }], edge: "neckline" },
    { kind: "line", from: { x: 29.2, y: -2.4 }, to: { x: 21, y: 1.2 }, edge: "shoulder" }
  ] };
  const P = { backCollarWidthCm: 3.5, collarStandCm: 3, frontEndRiseCm: 1, frontStraightCm: 4, breakPointDistanceCm: 8 };
  const made = DC.computeOpenCollar(b, P);
  const openDraft = () => ({ sourceBodiceHash: "BHL", type: "shirt-open-collar", baseMethod: "bunka-open-collar-L-v1", presetId: "bunka-shirt-collar-L",
    parameters: { openCollar: Object.assign({}, P) },
    openCollar: { geometry: JSON.parse(JSON.stringify(made.geometry)), measure: JSON.parse(JSON.stringify(made.measure)),
      anchors: made.anchors, bodyLink: JSON.parse(JSON.stringify(made.bodyLink)) } });

  BODICE = b; BODICE_STALE = false; SLEEVE = { id: "s" }; SLEEVE_CHANGED = false; SLEEVE_INVAL = false;
  PROJECT = { sourceBlock: { id: "block-1", version: 1, canonicalHash: "CH1" }, working: { collarDraft: openDraft(), patternLines: [], collarResult: null } };
  ok(made.ok && CC.check(PROJECT).ok, "8: L 초안이 완료 게이트 통과");
  const r = CC.complete(PROJECT);
  ok(r.ok && r.result.type === "shirt-open-collar" && Object.isFrozen(r.result) && Object.isFrozen(r.result.openCollar.bodyLink)
    && r.result.baseMethod === "bunka-open-collar-L-v1" && r.result.presetId === "bunka-shirt-collar-L", "8: L 완료 스냅샷 동결·출처 메타");
  ok(CC.isCurrentCollarChanged(PROJECT) === false, "8: 완료 직후 미변경");
  // 파라미터 변경 → 변경됨(형상 전용 signature)
  PROJECT.working.collarDraft = (function () { const d = openDraft(); const p2 = Object.assign({}, P, { collarStandCm: 4 });
    const m2 = DC.computeOpenCollar(b, p2); d.parameters.openCollar = p2; d.openCollar.geometry = m2.geometry; d.openCollar.measure = m2.measure; d.openCollar.bodyLink = m2.bodyLink; return d; })();
  ok(CC.isCurrentCollarChanged(PROJECT) === true, "8: 칼라 허리 변경 → 카라 변경됨");
  // 소매만 변경되면 카라 형상은 무효가 아니다(작업 순서 표시)
  PROJECT.working.collarDraft = openDraft(); CC.complete(PROJECT);
  SLEEVE_CHANGED = true;
  ok(CC.isCurrentCollarChanged(PROJECT) === false && CC.invalidatedByBodice(PROJECT) === false && CC.sleeveStepChanged(PROJECT) === true,
    "8: 소매 변경은 카라 무효화 아님(순서 게이트만)");
  SLEEVE_CHANGED = false;
  // 몸판 hash 변경 → 카라 무효
  BODICE = bodice("BHL2"); BODICE.front = b.front;
  ok(CC.invalidatedByBodice(PROJECT) === true, "8: 몸판 hash 변경 → 카라 무효");
  BODICE = b;
  // 종류가 다른 완료본과 섞이지 않는다
  const onePieceDraft = (function () {
    const o = DC.computeOnePiece(b, { riseCm: 2.5, backCollarWidthCm: 3.5, collarStandCm: 3, frontCollarWidthCm: 6.5, tipProjectionCm: 3, attachCurveCm: 0.2 });
    return { sourceBodiceHash: "BHL", type: "shirt-one-piece", baseMethod: "bunka-shirt-collar-G-v1", parameters: { onePiece: { riseCm: 2.5, backCollarWidthCm: 3.5, collarStandCm: 3, frontCollarWidthCm: 6.5, tipProjectionCm: 3, attachCurveCm: 0.2 } },
      onePiece: { geometry: o.geometry, measure: o.measure, anchors: o.anchors } };
  })();
  PROJECT.working.collarDraft = onePieceDraft;
  ok(CC.isCurrentCollarChanged(PROJECT) === true, "8: L 완료본 + 한 장 초안 → 변경됨(종류 혼동 없음)");
  const gRes = CC.complete(PROJECT);
  PROJECT.working.collarDraft = openDraft();
  ok(gRes.ok && CC.isCurrentCollarChanged(PROJECT) === true, "8: 한 장 완료본 + L 초안 → 변경됨");
}

// 9. D 방식 기초선 옵션(교재 O): construction 이 형상 identity 에 들어가되, 없으면 서명에 키가 없다
{
  BODICE = bodice("BH1"); BODICE_STALE = false; SLEEVE = { id: "s" }; SLEEVE_CHANGED = false; SLEEVE_INVAL = false;
  const CONS = { baselineReductionCm: 2.5, guideRiseCm: 2 };
  const O_STAND = { bandWidthCm: 3, frontRiseCm: 8.5, frontEndCm: 0.5 };   // 감산은 올림이 클 때만 성립한다
  const O_BODY = { gapCm: 14, cbWidthCm: 4, frontProjectionCm: 4, pointDiagonalCm: 6, outerBowCm: 0 };
  const mk = (cons) => {
    const b = bodice("BH1"), st = DC.computeStand(b, O_STAND, cons), bd = DC.computeBody(st, O_BODY);
    const cd = { sourceBodiceHash: "BH1", type: "shirt-two-piece", parameters: { stand: Object.assign({}, O_STAND) },
      standGeometry: st.standGeometry,
      body: { parameters: Object.assign({}, O_BODY), geometry: bd.bodyGeometry, attachLenCm: bd.attachLenCm, measure: bd.measure } };
    if (cons) cd.construction = JSON.parse(JSON.stringify(cons));
    return cd;
  };
  PROJECT = { sourceBlock: { id: "block-1", version: 1, canonicalHash: "CH1" }, working: { collarDraft: mk(null), patternLines: [], collarResult: null } };
  const plain = CC.complete(PROJECT);
  ok(plain.ok && plain.result.stand.construction === null, "9: 옵션 없는 초안 완료 → construction null");
  PROJECT.working.collarDraft = mk(CONS); PROJECT.working.collarResult = null;
  const withCons = CC.complete(PROJECT);
  ok(withCons.ok && JSON.stringify(withCons.result.stand.construction) === JSON.stringify(CONS), "9: 옵션 있는 초안 완료 → construction 보존");
  ok(withCons.result.hash !== plain.result.hash, "9: 같은 파라미터라도 construction 이 다르면 hash 분리");
  ok(CC.isCurrentCollarChanged(PROJECT) === false, "9: 옵션 초안 완료 직후 미변경");
  // 옵션만 제거하면 변경으로 잡힌다(스테일 판정에도 반영)
  PROJECT.working.collarDraft = mk(null);
  ok(CC.isCurrentCollarChanged(PROJECT) === true, "9: construction 제거 → 카라 변경됨");
  // 감산이 과해 ⑭ 보정이 불가능하면 완료 게이트가 stand-recompute 로 차단
  const bad = mk(CONS); bad.construction = { baselineReductionCm: 12, guideRiseCm: 2 };
  ok(CC.check({ sourceBlock: {}, working: { collarDraft: bad, patternLines: [], collarResult: null } }).fails.indexOf("stand-recompute") >= 0,
    "9: 재계산 불가한 construction → 완료 차단");
}

// 10. 윙 칼라(교재 Q): 밴드 달림선 = 목둘레 + 칼라 끝 7·1.5·4.5 를 실제 형상에서 검증
{
  BODICE = bodice("BH1"); BODICE_STALE = false; SLEEVE = { id: "s" }; SLEEVE_CHANGED = false; SLEEVE_INVAL = false;
  const Q_STAND = { bandWidthCm: 3, frontRiseCm: 1, frontEndCm: 0.5 };
  const Q_TIP = { tipBaseCm: 7, tipSetbackCm: 1.5, tipEdgeCm: 4.5 };
  const WING = { horizontalTopLine: true };
  const mk = () => {
    const b = bodice("BH1"), st = DC.computeStand(b, Q_STAND, WING), tp = DC.computeWingTip(st, Q_TIP);
    return { sourceBodiceHash: "BH1", type: "shirt-wing-collar", baseMethod: "bunka-wing-collar-Q-v1", presetId: "bunka-band-collar-Q",
      parameters: { stand: Object.assign({}, Q_STAND), tip: Object.assign({}, Q_TIP) },
      standGeometry: st.standGeometry, standAnchors: st.anchors,
      tip: { geometry: tp.geometry, measure: tp.measure, anchors: tp.anchors },
      measure: { lowerNeckSeamLenCm: st.lowerNeckSeamLenCm, lowerExtensionLenCm: st.lowerExtensionLenCm,
        upperNeckSegmentLenCm: st.upperNeckSegmentLenCm, upperExtensionLenCm: st.upperExtensionLenCm,
        upperTotalLenCm: st.upperTotalLenCm, backNeckLenCm: st.backNeckLenCm, frontNeckLenCm: st.frontNeckLenCm,
        neckTargetCm: st.neckTargetCm, cbTrimCm: st.cbTrimCm,
        baseLineLenCm: st.baseLineLenCm, baselineReductionCm: st.baselineReductionCm, guideRiseCm: st.guideRiseCm } };
  };
  const proj = (cd) => ({ sourceBlock: { id: "block-1", version: 1, canonicalHash: "CH1" }, working: { collarDraft: cd, patternLines: [], collarResult: null } });
  PROJECT = proj(mk());
  ok(CC.check(PROJECT).ok, "10: Q 초안이 완료 게이트 통과");
  const r = CC.complete(PROJECT);
  ok(r.ok && r.result.type === "shirt-wing-collar" && Object.isFrozen(r.result.tip)
    && near(r.result.stand.lengths.foldLine, r.result.stand.lengths.foldLine), "10: Q 완료 스냅샷(밴드 lengths + 칼라 끝)");
  ok(CC.isCurrentCollarChanged(PROJECT) === false, "10: 완료 직후 미변경");

  // 길이 책임 게이트: 달림선 ≠ 목둘레 → 차단
  const badAttach = mk(); badAttach.measure.lowerNeckSeamLenCm += 0.5;
  ok(CC.check(proj(badAttach)).fails.indexOf("attach-length-mismatch") >= 0, "10: 달림선 실측 ≠ 목둘레 → 완료 차단");
  // 칼라 끝 수치 게이트: measure 가 파라미터와 다르면 차단
  const badTip = mk(); badTip.tip.measure.foldBaseLenCm = 9;
  ok(CC.check(proj(badTip)).fails.indexOf("tip-length-mismatch") >= 0, "10: 칼라 끝 밑변이 파라미터와 다르면 차단");
  const badEdge = mk(); badEdge.tip.measure.tipEdgeLenCm = 5;
  ok(CC.check(proj(badEdge)).fails.indexOf("tip-length-mismatch") >= 0, "10: 칼라 끝 앞변 불일치 차단");
  const noTip = mk(); delete noTip.tip;
  ok(CC.check(proj(noTip)).fails.indexOf("no-tip") >= 0, "10: 칼라 끝 없음 → 차단");
  const badParams = mk(); badParams.parameters.tip.tipBaseCm = 99;
  ok(CC.check(proj(badParams)).fails.indexOf("tip-recompute") >= 0, "10: 재계산 불가한 칼라 끝 → 차단");

  // 종류 분리: 2피스 완료본 + Q 초안 → 변경됨
  PROJECT.working.collarDraft = makeDraft("BH1");
  const twoPiece = CC.complete(PROJECT);
  PROJECT.working.collarDraft = mk();
  ok(twoPiece.ok && CC.isCurrentCollarChanged(PROJECT) === true, "10: 2피스 완료본 + Q 초안 → 변경됨(종류 혼동 없음)");
  // 몸판 hash 변경 → 무효
  PROJECT.working.collarDraft = mk(); CC.complete(PROJECT);
  BODICE = bodice("BH2");
  ok(CC.invalidatedByBodice(PROJECT) === true, "10: 몸판 hash 변경 → Q 무효");
  BODICE = bodice("BH1");
}

// 11. 밴드+위 칼라 한 장(교재 R): 달림선 = 목둘레 · 외곽 뒤 = 뒤 목둘레 × · 앞 칼라 폭 · CB 전체 높이
{
  BODICE = bodice("BH1"); BODICE_STALE = false; SLEEVE = { id: "s" }; SLEEVE_CHANGED = false; SLEEVE_INVAL = false;
  const R_STAND = { bandWidthCm: 3, frontRiseCm: 1, frontEndCm: 0.5 };
  const R_UPPER = { upperWidthCm: 3.5, frontWidthCm: 6.5, outerBowCm: 0.5 };
  const mk = () => {
    const b = bodice("BH1"), jn = DC.computeBandOnePiece(b, R_STAND, R_UPPER);
    return { sourceBodiceHash: "BH1", type: "shirt-band-one-piece", baseMethod: "bunka-band-collar-R-v1", presetId: "bunka-band-collar-R",
      parameters: { stand: Object.assign({}, R_STAND), upper: Object.assign({}, R_UPPER) },
      joined: { geometry: jn.geometry, measure: jn.measure, anchors: jn.anchors } };
  };
  const proj = (cd) => ({ sourceBlock: { id: "block-1", version: 1, canonicalHash: "CH1" }, working: { collarDraft: cd, patternLines: [], collarResult: null } });
  PROJECT = proj(mk());
  ok(CC.check(PROJECT).ok, "11: R 초안이 완료 게이트 통과");
  const r = CC.complete(PROJECT);
  ok(r.ok && r.result.type === "shirt-band-one-piece" && Object.isFrozen(r.result.joined)
    && JSON.stringify(r.result.joined.parameters) === JSON.stringify({ stand: R_STAND, upper: R_UPPER }), "11: R 완료 스냅샷(한 조각·밴드+위 칼라 파라미터)");
  ok(!("stand" in r.result) && !("body" in r.result) && !("tip" in r.result), "11: 2피스·윙 섹션을 만들지 않는다");
  ok(CC.isCurrentCollarChanged(PROJECT) === false, "11: 완료 직후 미변경");
  const again = CC.complete(PROJECT);
  ok(again.ok && again.idempotent === true && again.result === r.result, "11: 재완료 idempotent(같은 참조)");

  // 길이 책임 게이트
  const badAttach = mk(); badAttach.joined.measure.lowerNeckSeamLenCm += 0.5;
  ok(CC.check(proj(badAttach)).fails.indexOf("attach-length-mismatch") >= 0, "11: 달림선 실측 ≠ 목둘레 → 완료 차단");
  const badBack = mk(); badBack.joined.measure.outerBackLenCm += 0.5;
  ok(CC.check(proj(badBack)).fails.indexOf("outer-back-mismatch") >= 0, "11: 외곽 뒤 구간 ≠ 뒤 목둘레 × → 차단");
  const badFront = mk(); badFront.joined.measure.frontEdgeLenCm += 0.5;
  ok(CC.check(proj(badFront)).fails.indexOf("front-width-mismatch") >= 0, "11: 앞 칼라 폭 불일치 차단");
  const badCb = mk(); badCb.joined.measure.cbHeightCm += 0.5;
  ok(CC.check(proj(badCb)).fails.indexOf("cb-height-mismatch") >= 0, "11: CB 전체 높이 ≠ 밴드+위 칼라 폭 → 차단");
  const noJoined = mk(); delete noJoined.joined;
  ok(CC.check(proj(noJoined)).fails.indexOf("no-joined") >= 0, "11: 한 조각 없음 → 차단");
  const badParams = mk(); badParams.parameters.upper.upperWidthCm = 0;
  ok(CC.check(proj(badParams)).fails.indexOf("joined-recompute") >= 0, "11: 재계산 불가한 위 칼라 → 차단");

  // 형상 identity: 위 칼라 폭만 달라도 hash 분리
  const alt = mk(); alt.parameters.upper.upperWidthCm = 4;
  const altGeom = DC.computeBandOnePiece(bodice("BH1"), R_STAND, alt.parameters.upper);
  alt.joined.geometry = altGeom.geometry; alt.joined.measure = altGeom.measure;
  const rAlt = CC.complete(proj(alt));
  ok(rAlt.ok && rAlt.result.hash !== r.result.hash, "11: 위 칼라 폭이 다르면 hash 분리");

  // 종류 분리: 2피스 완료본 + R 초안 → 변경됨
  PROJECT.working.collarDraft = makeDraft("BH1");
  const twoPiece = CC.complete(PROJECT);
  PROJECT.working.collarDraft = mk();
  ok(twoPiece.ok && CC.isCurrentCollarChanged(PROJECT) === true, "11: 2피스 완료본 + R 초안 → 변경됨(종류 혼동 없음)");
  // 몸판 hash 변경 → 무효
  PROJECT.working.collarDraft = mk(); CC.complete(PROJECT);
  BODICE = bodice("BH2");
  ok(CC.invalidatedByBodice(PROJECT) === true, "11: 몸판 hash 변경 → R 무효");
  BODICE = bodice("BH1");
}

console.log(`collarCheckpointCheck: ${PASS} PASS, ${FAIL} FAIL`);
if (FAIL) { console.log("FAILURES:\n  " + fails.join("\n  ")); process.exit(1); }
