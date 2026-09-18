// ══════════════════════════════════════════════
// collarPresetsCheck.js — js/collarPresets.js 카라 프리셋 registry 회귀.
// 실제 designCollar.js + collarPresets.js + collarCheckpoint.js 를 같은 vm 으로 실행한다(구현 복사 아님).
//   · registry: M 레코드 1개·조회/목록 결정론·immutability·deep clone·검증 실패·정확한 8개 기본 수치
//   · 옵션 모델이 registry 에서 생성·알 수 없는 id 거부
//   · composeDraft = 기존 교재 M 초기화 draft 와 presetId 외 byte-identical·완료 hash 동일
//   · 수정 후 원본 불변·같은 값 재적용 idempotent·수정 → 카라 변경됨 → 프리셋 재적용 → 원래 hash
//   node test/harness/collarPresetsCheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");
let PASS = 0, FAIL = 0; const fails = [];
function ok(cond, name) { if (cond) PASS++; else { FAIL++; fails.push(name); } }
function throwsReason(fn, reason, name) { try { fn(); ok(false, name + " (throw 없음)"); } catch (e) { ok(e.reason === reason, name + " (reason=" + e.reason + ")"); } }

let BODICE = null, PROJECT = null;
const sandbox = { window: {}, Math, JSON, Object, Array, isFinite, Infinity, Date, Error };
sandbox.window.designWorkflow = { current: () => PROJECT };
sandbox.window.bodiceCheckpoint = { latest: () => BODICE, isCurrentBodiceChanged: () => false };
sandbox.window.sleeveCheckpoint = { latest: () => ({ id: "s" }), isCurrentSleeveChanged: () => false, invalidatedByBodice: () => false };
vm.createContext(sandbox);
["designCollar.js", "collarPresets.js", "collarCheckpoint.js"].forEach(f =>
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "..", "js", f), "utf8"), sandbox, { filename: f }));
const DC = sandbox.window.designCollar, CP = sandbox.window.collarPresets, CC = sandbox.window.collarCheckpoint;
const J = (v) => JSON.stringify(v);
function bodice(hash) { return { hash: hash || "BH1", sourceVersion: 1, necklineLengths: { back: 7.6926, front: 11.129, half: 18.8216, finished: 37.6432 }, placket: { parameters: { overlapCm: 1.75, facingWidthCm: 4, lengthMode: "full" } } }; }

// 1. registry 구성·조회·결정론
{
  ok(Object.isFrozen(CP) && typeof CP.composeDraft === "function", "1: API frozen");
  const L = CP.list();
  ok(Array.isArray(L) && L.length === 1 && Object.isFrozen(L), "1: 레코드 1개·목록 frozen");
  const M = L[0];
  ok(M.id === "bunka-shirt-collar-M" && CP.DEFAULT_ID === M.id && CP.get(M.id) === M, "1: M id·기본 id·get 동일 참조");
  ok(M.label === "교재 M 기본형" && M.type === "shirt-two-piece" && M.baseMethod === "bunka-shirt-collar-M-v2", "1: 표시 이름·type·baseMethod(기존 계약)");
  ok(M.neckline.requiredType === "shirt" && M.neckline.enforcement === "metadata-only", "1: 목선 요구 = metadata-only(자동 몸판 변경 없음)");
  ok(J(CP.list()) === J(L) && CP.list() === L, "1: list 결정론(같은 참조)");
  ok(CP.get("nope") === null && CP.get("__proto__") === null && CP.get("toString") === null, "1: 알 수 없는 id → null(프로토타입 키 포함)");
}
// 2. 정확한 8개 M 기본 수치 + 키 순서(checkpoint 서명 JSON 계약) + 엔진 기준값과 일치
{
  const M = CP.get(CP.DEFAULT_ID);
  ok(J(M.stand) === J({ standHeightCm: 3, frontRiseCm: 1 }), "2: stand = 밴드 3·앞끝 올림 1");
  ok(J(M.body) === J({ gapCm: 3, cbWidthCm: 4, frontInsetCm: 0.5, frontProjectionCm: 1.5, pointDiagonalCm: 6, outerBowCm: 0 }), "2: body = gap 3·CB 폭 4·setback 0.5·돌출 1.5·사선 6·휨 0");
  ok(J(M.stand) === J(DC.referenceParams()) && J(M.body) === J(DC.referenceBodyParams()), "2: 엔진 referenceParams/referenceBodyParams 와 값·키 순서 동일");
  const sf = CP.fields("stand"), bf = CP.fields("body");
  ok(sf.map(f => f.key).join() === Object.keys(M.stand).join() && bf.map(f => f.key).join() === Object.keys(M.body).join() && sf.concat(bf).every(f => f.unit === "cm" && typeof f.label === "string"), "2: 필드 의미·단위(cm)");
}
// 3. immutability·deep clone
{
  const M = CP.get(CP.DEFAULT_ID), before = J(M);
  try { M.stand.standHeightCm = 9; } catch (_) {}
  try { M.body.cbWidthCm = 9; } catch (_) {}
  try { CP.list().push({}); } catch (_) {}
  ok(J(M) === before && CP.list().length === 1 && Object.isFrozen(M.stand) && Object.isFrozen(M.body) && Object.isFrozen(M.neckline), "3: 레코드·섹션·목록 변경 불가");
  const d = CP.defaults(M.id);
  ok(d.ok && !Object.isFrozen(d.stand) && d.stand !== M.stand && d.body !== M.body, "3: defaults 는 편집 가능한 clone");
  d.stand.standHeightCm = 5; d.body.cbWidthCm = 7;
  ok(M.stand.standHeightCm === 3 && M.body.cbWidthCm === 4 && CP.defaults(M.id).body.cbWidthCm === 4, "3: 편집값 수정이 원본 오염 안 함");
  const f = CP.fields("body"); f[0].key = "x";
  ok(CP.fields("body")[0].key === "gapCm", "3: fields 도 clone");
}
// 4. 검증 실패(조용히 수용 금지)
{
  const base = () => JSON.parse(J(CP.get(CP.DEFAULT_ID)));
  throwsReason(() => CP.buildRegistry([base(), base()]), "duplicate-id", "4: 중복 id");
  throwsReason(() => CP.buildRegistry([]), "empty-registry", "4: 빈 registry");
  let r = base(); delete r.label; throwsReason(() => CP.validateRecord(r), "missing-field", "4: label 누락");
  r = base(); r.baseMethod = ""; throwsReason(() => CP.validateRecord(r), "missing-field", "4: 빈 baseMethod");
  r = base(); delete r.body; throwsReason(() => CP.validateRecord(r), "missing-section", "4: body 누락");
  r = base(); delete r.body.gapCm; throwsReason(() => CP.validateRecord(r), "bad-section-keys", "4: body 필드 누락");
  r = base(); r.stand.extra = 1; throwsReason(() => CP.validateRecord(r), "bad-section-keys", "4: 알 수 없는 필드");
  r = base(); r.body.cbWidthCm = NaN; throwsReason(() => CP.validateRecord(r), "invalid-number", "4: NaN");
  r = base(); r.stand.standHeightCm = "3"; throwsReason(() => CP.validateRecord(r), "invalid-number", "4: 문자열 숫자");
  r = base(); r.stand.standHeightCm = 0; throwsReason(() => CP.validateRecord(r), "out-of-range", "4: 밴드 폭 0");
  r = base(); r.body.frontInsetCm = -1; throwsReason(() => CP.validateRecord(r), "out-of-range", "4: 음수 setback");
  r = base(); r.body.pointDiagonalCm = 1.5; throwsReason(() => CP.validateRecord(r), "out-of-range", "4: 사선 ≤ 돌출");
  r = base(); r.neckline.enforcement = "auto"; throwsReason(() => CP.validateRecord(r), "invalid-neckline", "4: 목선 자동 강제 금지");
  const two = base(); two.id = "other"; two.label = "다른";
  const reg = CP.buildRegistry([base(), two]);
  ok(reg.list.length === 2 && reg.list[1].id === "other" && Object.isFrozen(reg.list), "4: 유효 레코드 추가는 순서대로 등록");
}
// 5. 옵션 모델·알 수 없는 id 거부
{
  const o = CP.options();
  ok(J(o) === J([{ value: "bunka-shirt-collar-M", label: "교재 M 기본형" }]), "5: 옵션 = registry 레코드");
  ok(CP.defaults("nope").ok === false && CP.defaults("nope").reason === "unknown-collar-preset", "5: defaults 알 수 없는 id 거부");
  ok(CP.composeDraft("nope", bodice(), DC).reason === "unknown-collar-preset", "5: composeDraft 알 수 없는 id 거부");
  ok(CP.matches(CP.DEFAULT_ID, { standHeightCm: 3, frontRiseCm: 1 }, CP.defaults(CP.DEFAULT_ID).body) === true
    && CP.matches(CP.DEFAULT_ID, { standHeightCm: 3.1, frontRiseCm: 1 }, CP.defaults(CP.DEFAULT_ID).body) === false
    && CP.matches("nope", {}, {}) === false, "5: matches(일치/수정됨/알 수 없음)");
}
// 6. composeDraft = 기존 교재 M 초기화 draft(ui.js onCollarBaseM 구버전과 같은 구성) — presetId 외 동일
function legacyMDraft(b) {
  const rp = DC.referenceParams(), rb = DC.referenceBodyParams();
  const s = DC.computeStand(b, rp), bd = DC.computeBody(s, rb);
  return { sourceBodiceHash: b.hash, type: "shirt-two-piece", baseMethod: "bunka-shirt-collar-M-v2",
    parameters: { stand: { standHeightCm: rp.standHeightCm, frontRiseCm: rp.frontRiseCm } },
    standGeometry: s.standGeometry, standAnchors: s.anchors, collarGeometry: null,
    body: { parameters: rb, geometry: bd.bodyGeometry, attachLenCm: bd.attachLenCm, measure: bd.measure, anchors: bd.anchors },
    measure: { lowerNeckSeamLenCm: s.lowerNeckSeamLenCm, lowerExtensionLenCm: s.lowerExtensionLenCm, upperNeckSegmentLenCm: s.upperNeckSegmentLenCm,
      upperExtensionLenCm: s.upperExtensionLenCm, upperTotalLenCm: s.upperTotalLenCm, backNeckLenCm: s.backNeckLenCm, frontNeckLenCm: s.frontNeckLenCm } };
}
function project(cd) { return { sourceBlock: { id: "block-1", version: 1, canonicalHash: "CH1" }, working: { collarDraft: cd, patternLines: [], collarResult: null } }; }
{
  BODICE = bodice("BH1");
  const plan = CP.composeDraft(CP.DEFAULT_ID, BODICE, DC), old = legacyMDraft(BODICE);
  ok(plan.ok && plan.draft.presetId === "bunka-shirt-collar-M", "6: composeDraft ok·presetId 기록");
  const noId = JSON.parse(J(plan.draft)); delete noId.presetId;
  ok(J(noId) === J(old), "6: presetId 외 기존 M draft 와 byte-identical(파라미터·geometry·anchors·measure)");
  PROJECT = project(old); const rOld = CC.complete(PROJECT);
  PROJECT = project(plan.draft); const rNew = CC.complete(PROJECT);
  ok(rOld.ok && rNew.ok && rOld.result.hash === rNew.result.hash, "6: 완료 hash 동일(presetId 는 hash 입력 아님): " + (rNew.result && rNew.result.hash));
  // 같은 값 재적용 → 동일 geometry·idempotent 완료
  const again = CP.composeDraft(CP.DEFAULT_ID, BODICE, DC).draft;
  ok(J(again) === J(plan.draft), "6: 재적용 draft 동일");
  PROJECT.working.collarDraft = again;
  ok(CC.isCurrentCollarChanged(PROJECT) === false && CC.complete(PROJECT).idempotent === true, "6: 재적용 후 변경 없음·idempotent");
  // 편집 → 카라 변경됨(완료본 유지·스테일) → 프리셋 재적용 → 원래 hash 로 복귀
  const cd = PROJECT.working.collarDraft; cd.body.parameters.cbWidthCm = 5;
  const reb = DC.computeBody(DC.computeStand(BODICE, cd.parameters.stand), cd.body.parameters);
  cd.body.geometry = reb.bodyGeometry; cd.body.attachLenCm = reb.attachLenCm; cd.body.measure = reb.measure;
  ok(CC.isCurrentCollarChanged(PROJECT) === true && PROJECT.working.collarResult === rNew.result, "6: 수정 → 카라 변경됨(완료본 조용히 갱신 안 함)");
  ok(CP.get(CP.DEFAULT_ID).body.cbWidthCm === 4, "6: 수정 후 원본 레코드 불변");
  PROJECT.working.collarDraft = CP.composeDraft(CP.DEFAULT_ID, BODICE, DC).draft;
  ok(CC.isCurrentCollarChanged(PROJECT) === false, "6: 프리셋 재적용 → 완료 형상과 동일");
  // 스탠드 실패 시 draft 미생성(원자) — 호출부는 기존 상태 유지
  const bad = CP.composeDraft(CP.DEFAULT_ID, { hash: "X" }, DC);
  ok(bad.ok === false && bad.stage === "stand" && !("draft" in bad), "6: 계산 실패 → draft 없음(원자)");
}

console.log("══════════════════════════════════════════════");
if (FAIL) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); }
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
if (FAIL) process.exitCode = 1;
