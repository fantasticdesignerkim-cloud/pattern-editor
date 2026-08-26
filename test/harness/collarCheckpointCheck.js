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
const STAND_P = { standHeightCm: 3, frontRiseCm: 1.5 };
const BODY_P = { cbWidthCm: 6, frontWidthCm: 6, frontInsetCm: 0.3, frontProjectionCm: 4, outerBowCm: 0 };
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
  ok(res.body.mode === "parametric" && near(res.body.attachLenCm, res.stand.lengths.upperNeckSegment - 0.3, 0.01) && res.body.manualSource === null, "1: body parametric·attachLen=upperNeck−0.3·manualSource null");
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
  reset(); PROJECT = fakeProject(); PROJECT.working.collarDraft.body.attachLenCm = 999; ok(CC.check(PROJECT).fails.indexOf("attach-mismatch") >= 0, "3: attach-mismatch");
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
  // 스탠드 파라미터 변경(형상 재생성) → 변경됨
  const b = bodice("BH1"); const st = DC.computeStand(b, { standHeightCm: 4, frontRiseCm: 1.5 });
  const bd = DC.computeBody(st, BODY_P);
  PROJECT.working.collarDraft.parameters.stand.standHeightCm = 4; PROJECT.working.collarDraft.standGeometry = st.standGeometry;
  PROJECT.working.collarDraft.body.geometry = bd.bodyGeometry; PROJECT.working.collarDraft.body.attachLenCm = bd.attachLenCm; PROJECT.working.collarDraft.body.measure = bd.measure;
  ok(CC.isCurrentCollarChanged(PROJECT) === true, "5: 스탠드 파라미터 변경 → 변경됨");
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

console.log(`collarCheckpointCheck: ${PASS} PASS, ${FAIL} FAIL`);
if (FAIL) { console.log("FAILURES:\n  " + fails.join("\n  ")); process.exit(1); }
