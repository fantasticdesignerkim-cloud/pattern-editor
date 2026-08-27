// ══════════════════════════════════════════════
// designResultCheck.js — js/designResult.js 통합 완료 게이트·structuralLines·hash·idempotent 회귀.
// 세 체크포인트(bodice/sleeve/collar)와 designLineTool.gatherValidCuts 는 스텁(designResult 는 하위
// hash·유효 cut 을 묶는 계층 — 하위 geometry 자체는 각 체크포인트 하네스가 이미 고정).
//   node test/harness/designResultCheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");
let PASS = 0, FAIL = 0; const fails = [];
function ok(cond, name) { if (cond) PASS++; else { FAIL++; fails.push(name); } }

// 스텁 상태
let ST = {};
function reset() {
  ST = {
    bodice: Object.freeze({ hash: "BH1", sourceVersion: 1 }), bodiceChanged: false,
    sleeve: Object.freeze({ hash: "SH1", sourceBodiceHash: "BH1" }), sleeveChanged: false, sleeveInval: false,
    collar: Object.freeze({ hash: "CH1", sourceBodiceHash: "BH1" }), collarChanged: false, collarInval: false, collarSleeveOrder: false,
    cuts: [{ piece: "front", segments: [{ kind: "line", from: { x: 15, y: -2.12 }, to: { x: 15, y: 38 } }] }],
    designResult: null
  };
}
reset();
const PROJECT = { sourceBlock: { id: "block-1", version: 1, canonicalHash: "CANON1" }, working: { get designResult() { return ST.designResult; }, set designResult(v) { ST.designResult = v; } } };

const sandbox = { window: {}, Math, JSON, Object, Array, isFinite, Date };
sandbox.window.designWorkflow = { current: () => PROJECT };
sandbox.window.bodiceCheckpoint = { latest: () => ST.bodice, isCurrentBodiceChanged: () => ST.bodiceChanged };
sandbox.window.sleeveCheckpoint = { latest: () => ST.sleeve, isCurrentSleeveChanged: () => ST.sleeveChanged, invalidatedByBodice: () => ST.sleeveInval };
sandbox.window.collarCheckpoint = { latest: () => ST.collar, isCurrentCollarChanged: () => ST.collarChanged, invalidatedByBodice: () => ST.collarInval, sleeveStepChanged: () => ST.collarSleeveOrder };
// ★ 새 시그니처(patternLines, bodiceResult): frozen 몸판을 명시 전달받아야만 cut 을 낸다.
//   bodiceResult 가 falsy 면 [] → designResult 가 몸판을 제대로 넘기는지까지 검증(테스트 1 cut.length===1).
sandbox.window.designLineTool = { gatherValidCuts: (patternLines, bodiceResult) => (bodiceResult ? ST.cuts.map(c => ({ piece: c.piece, segments: c.segments.map(s => JSON.parse(JSON.stringify(s))) })) : []) };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "..", "js", "designResult.js"), "utf8"), sandbox, { filename: "designResult.js" });
const DR = sandbox.window.designResult;

ok(typeof DR.check === "function" && typeof DR.complete === "function" && Object.isFrozen(DR), "0: API·frozen");

// 1. 유효 → 완료 스냅샷
{
  reset(); const c = DR.check(PROJECT); ok(c.ok, "1: 유효 check ok (" + c.fails.join(",") + ")");
  const r = DR.complete(PROJECT), res = r.result;
  ok(r.ok && ST.designResult, "1: 완료·designResult 저장");
  ok(res.schemaVersion === 1 && res.sourceBlock.version === 1 && !("symmetry" in res), "1: schema·sourceBlock·전역 symmetry 없음");
  ok(res.bodiceHash === "BH1" && res.sleeveHash === "SH1" && res.collarHash === "CH1", "1: 세 하위 hash");
  ok(res.bodice === ST.bodice && res.sleeve === ST.sleeve && res.collar === ST.collar, "1: 하위 result 참조(clone 아님)");
  ok(res.structuralLines.cut.length === 1 && res.structuralLines.cut[0].piece === "front" && res.structuralLines.cut[0].segments.length === 1, "1: structuralLines.cut(piece+cm)");
  ok(typeof res.hash === "string" && typeof res.completedAt === "number" && Object.isFrozen(res) && Object.isFrozen(res.structuralLines), "1: hash·completedAt·frozen");
}

// 2. idempotent
{
  reset(); const r1 = DR.complete(PROJECT), t1 = r1.result.completedAt;
  const r2 = DR.complete(PROJECT);
  ok(r2.idempotent === true && r2.result === r1.result && r2.result.completedAt === t1, "2: idempotent 참조·completedAt 불변");
}

// 3. 게이트 실패 — 실패 시 designResult 불변
{
  reset(); DR.complete(PROJECT); const frozen = ST.designResult;
  reset(); ST.designResult = frozen;
  ST.bodice = null; ok(DR.complete(PROJECT).reason === "no-bodice" && ST.designResult === frozen, "3: no-bodice·불변");
  reset(); ST.designResult = frozen; ST.bodiceChanged = true; ok(DR.check(PROJECT).fails.indexOf("bodice-changed") >= 0, "3: bodice-changed");
  reset(); ST.designResult = frozen; ST.sleeve = null; ok(DR.check(PROJECT).fails.indexOf("no-sleeve") >= 0, "3: no-sleeve");
  reset(); ST.designResult = frozen; ST.sleeveChanged = true; ok(DR.check(PROJECT).fails.indexOf("sleeve-changed") >= 0, "3: sleeve-changed");
  reset(); ST.designResult = frozen; ST.sleeveInval = true; ok(DR.check(PROJECT).fails.indexOf("sleeve-bodice-mismatch") >= 0, "3: sleeve-bodice-mismatch");
  reset(); ST.designResult = frozen; ST.collar = null; ok(DR.check(PROJECT).fails.indexOf("no-collar") >= 0, "3: no-collar");
  reset(); ST.designResult = frozen; ST.collarChanged = true; ok(DR.check(PROJECT).fails.indexOf("collar-changed") >= 0, "3: collar-changed");
  reset(); ST.designResult = frozen; ST.collarInval = true; ok(DR.check(PROJECT).fails.indexOf("collar-bodice-mismatch") >= 0, "3: collar-bodice-mismatch");
  reset(); ST.designResult = frozen; ST.collarSleeveOrder = true; ok(DR.check(PROJECT).fails.indexOf("collar-sleeve-order") >= 0, "3: collar-sleeve-order(소매 순서)");
  reset(); ST.designResult = frozen; ST.sleeve = Object.freeze({ hash: "SH1", sourceBodiceHash: "OTHER" }); ok(DR.check(PROJECT).fails.indexOf("sleeve-source-mismatch") >= 0, "3: sleeve-source-mismatch");
  reset(); ST.designResult = frozen; ST.collar = Object.freeze({ hash: "CH1", sourceBodiceHash: "OTHER" }); ok(DR.check(PROJECT).fails.indexOf("collar-source-mismatch") >= 0, "3: collar-source-mismatch");
}

// 4. hash 는 structuralLines 포함 — cut 변경 → hash 변경·Design 변경됨
{
  reset(); DR.complete(PROJECT); ok(DR.isCurrentDesignChanged(PROJECT) === false, "4: 완료 직후 미변경");
  ST.cuts = [{ piece: "front", segments: [{ kind: "line", from: { x: 15, y: -2.12 }, to: { x: 15, y: 38 } }] }, { piece: "back", segments: [{ kind: "line", from: { x: 5, y: 0 }, to: { x: 5, y: 30 } }] }];
  ok(DR.isCurrentDesignChanged(PROJECT) === true, "4: cut 추가 → Design 변경됨(hash 에 structuralLines 포함)");
  // 재완료 → 새 hash
  const h1 = ST.designResult.hash; DR.complete(PROJECT);
  ok(ST.designResult.hash !== h1 && ST.designResult.structuralLines.cut.length === 2, "4: 재완료 새 hash·cut 2");
}

// 5. 하위 result hash 변경 → Design 변경됨
{
  reset(); DR.complete(PROJECT);
  ST.collar = Object.freeze({ hash: "CH2", sourceBodiceHash: "BH1" });   // 카라 재완료(새 hash)
  ok(DR.isCurrentDesignChanged(PROJECT) === true, "5: 하위 hash 변경 → Design 변경됨");
}

// 6. cut 순서 무관(canonical) — 같은 cut 집합 순서만 다르면 같은 hash
{
  reset();
  const cutA = { piece: "front", segments: [{ kind: "line", from: { x: 15, y: -2 }, to: { x: 15, y: 38 } }] };
  const cutB = { piece: "back", segments: [{ kind: "line", from: { x: 5, y: 0 }, to: { x: 5, y: 30 } }] };
  ST.cuts = [cutA, cutB]; DR.complete(PROJECT); const h1 = ST.designResult.hash;
  ST.designResult = null; ST.cuts = [cutB, cutA]; DR.complete(PROJECT);
  ok(ST.designResult.hash === h1, "6: cut 순서 무관 hash 동일");
}

console.log(`designResultCheck: ${PASS} PASS, ${FAIL} FAIL`);
if (FAIL) { console.log("FAILURES:\n  " + fails.join("\n  ")); process.exit(1); }
