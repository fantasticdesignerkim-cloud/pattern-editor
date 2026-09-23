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
// 앞판 외곽(SV3 의미 모서리) — L(오픈 칼라)의 몸판 연동 제도 입력. center∩neckline = 앞 중심 목점.
function frontOutline() {
  return [
    { kind: "line", from: { x: 40, y: 2 }, to: { x: 40, y: 38 }, edge: "center" },
    { kind: "path", commands: [{ type: "M", points: [{ x: 40, y: 2 }] },
      { type: "C", points: [{ x: 35.6, y: 2 }, { x: 31.4, y: 0.2 }, { x: 29.2, y: -2.4 }] }], edge: "neckline" },
    { kind: "line", from: { x: 29.2, y: -2.4 }, to: { x: 21, y: 1.2 }, edge: "shoulder" }
  ];
}
function bodice(hash) { return { hash: hash || "BH1", sourceVersion: 1, necklineLengths: { back: 7.6926, front: 11.129, half: 18.8216, finished: 37.6432 }, placket: { parameters: { overlapCm: 1.75, facingWidthCm: 4, lengthMode: "full" } }, front: { outline: frontOutline() } }; }
function standFBodice(hash) {
  const b = bodice(hash || "BHF");
  b.necklineProfile = { mode: "parametric", type: "stand-f", parameters: {
    neckWidthCm: 3, frontDepthCm: 3, backDepthCm: 2, curveAmountNorm: 1,
    vPointDepthCm: 0, squareWidthCm: 0, cornerRadiusCm: 0
  } };
  return b;
}

// 1. registry 구성·조회·결정론
{
  ok(Object.isFrozen(CP) && typeof CP.composeDraft === "function", "1: API frozen");
  const L = CP.list();
  ok(Array.isArray(L) && L.length === 17 && Object.isFrozen(L), "1: 실행 레코드 17개(A~F·M·N·O·P·Q·G~L)·목록 frozen");
  const M = CP.get(CP.DEFAULT_ID);
  ok(M.id === "bunka-shirt-collar-M" && CP.DEFAULT_ID === M.id && CP.get(M.id) === M, "1: M id·기본 id·get 동일 참조");
  ok(M.label === "교재 M 기본형" && M.type === "shirt-two-piece" && M.baseMethod === "bunka-band-collar-P148-v1", "1: 표시 이름·type·baseMethod(P.148 공통 제도법)");
  ok(M.neckline.requiredType === "shirt" && M.neckline.enforcement === "metadata-only", "1: 목선 요구 = metadata-only(자동 몸판 변경 없음)");
  ok(J(CP.list()) === J(L) && CP.list() === L, "1: list 결정론(같은 참조)");
  ok(CP.get("nope") === null && CP.get("__proto__") === null && CP.get("toString") === null, "1: 알 수 없는 id → null(프로토타입 키 포함)");
}
// 2. 정확한 8개 M 기본 수치 + 키 순서(checkpoint 서명 JSON 계약) + 엔진 기준값과 일치
{
  const M = CP.get(CP.DEFAULT_ID);
  ok(J(M.stand) === J({ bandWidthCm: 3, frontRiseCm: 1, frontEndCm: 0.5 }), "2: M 밴드 = 폭 3·올림 1·앞 끝선 0.5");
  ok(J(M.body) === J({ gapCm: 3, cbWidthCm: 4, frontProjectionCm: 1.5, pointDiagonalCm: 6, outerBowCm: 0 }), "2: M 위 칼라 = 간격 3·뒤 폭 4·수평 1.5·사선 6·휨 0");
  const Nr = CP.get("bunka-band-collar-N"), Pr = CP.get("bunka-band-collar-P");
  ok(J(Nr.stand) === J({ bandWidthCm: 3, frontRiseCm: 3, frontEndCm: 0.5 }) && J(Nr.body) === J({ gapCm: 7, cbWidthCm: 4, frontProjectionCm: 2, pointDiagonalCm: 6, outerBowCm: 0 }), "2: N = 폭 3·올림 3·간격 7·수평 2");
  ok(J(Pr.stand) === J({ bandWidthCm: 5, frontRiseCm: 3, frontEndCm: 0.5 }) && J(Pr.body) === J(Nr.body), "2: P = 밴드 폭 5, 그 외 N 과 같음(본문 근거)");
  ok(Nr.baseMethod === M.baseMethod && Pr.baseMethod === M.baseMethod && M.baseMethod === "bunka-band-collar-P148-v1", "2: M·N·P 가 같은 P.148 제도법");
  ok(J(M.stand) === J(DC.referenceParams()) && J(M.body) === J(DC.referenceBodyParams()), "2: 엔진 referenceParams/referenceBodyParams 와 값·키 순서 동일");
  const sf = CP.fields("stand"), bf = CP.fields("body");
  ok(sf.map(f => f.key).join() === Object.keys(M.stand).join() && bf.map(f => f.key).join() === Object.keys(M.body).join() && sf.concat(bf).every(f => f.unit === "cm" && typeof f.label === "string"), "2: 필드 의미·단위(cm)");
}
// 3. immutability·deep clone
{
  const M = CP.get(CP.DEFAULT_ID), before = J(M);
  try { M.stand.bandWidthCm = 9; } catch (_) {}
  try { M.body.cbWidthCm = 9; } catch (_) {}
  try { CP.list().push({}); } catch (_) {}
  ok(J(M) === before && CP.list().length === 17 && Object.isFrozen(M.stand) && Object.isFrozen(M.body) && Object.isFrozen(M.neckline), "3: 레코드·섹션·목록 변경 불가");
  const d = CP.defaults(M.id);
  ok(d.ok && !Object.isFrozen(d.stand) && d.stand !== M.stand && d.body !== M.body, "3: defaults 는 편집 가능한 clone");
  d.stand.bandWidthCm = 5; d.body.cbWidthCm = 7;
  ok(M.stand.bandWidthCm === 3 && M.body.cbWidthCm === 4 && CP.defaults(M.id).body.cbWidthCm === 4, "3: 편집값 수정이 원본 오염 안 함");
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
  r = base(); r.stand.bandWidthCm = "3"; throwsReason(() => CP.validateRecord(r), "invalid-number", "4: 문자열 숫자");
  r = base(); r.stand.bandWidthCm = 0; throwsReason(() => CP.validateRecord(r), "out-of-range", "4: 밴드 폭 0");
  r = base(); r.stand.frontEndCm = -1; throwsReason(() => CP.validateRecord(r), "out-of-range", "4: 음수 앞 끝선");
  r = base(); r.body.pointDiagonalCm = 1.5; throwsReason(() => CP.validateRecord(r), "out-of-range", "4: 사선 ≤ 돌출");
  r = base(); r.neckline.enforcement = "auto"; throwsReason(() => CP.validateRecord(r), "invalid-neckline", "4: 목선 자동 강제 금지");
  const two = base(); two.id = "other"; two.label = "다른";
  const reg = CP.buildRegistry([base(), two]);
  ok(reg.list.length === 2 && reg.list[1].id === "other" && Object.isFrozen(reg.list), "4: 유효 레코드 추가는 순서대로 등록");
}
// 5. 옵션 모델·알 수 없는 id 거부
{
  const o = CP.options();
  ok(J(o.map(x => x.value)) === J(["bunka-stand-collar-A", "bunka-stand-collar-B", "bunka-stand-collar-C", "bunka-stand-collar-D", "bunka-stand-collar-E", "bunka-stand-collar-F", "bunka-shirt-collar-M", "bunka-band-collar-N", "bunka-band-collar-O", "bunka-band-collar-P", "bunka-band-collar-Q", "bunka-shirt-collar-G", "bunka-shirt-collar-H", "bunka-shirt-collar-I", "bunka-shirt-collar-J", "bunka-shirt-collar-K", "bunka-shirt-collar-L"]), "5: 옵션 = registry 레코드(A~F·M·N·O·P·Q·G~L)");
  ok(CP.defaults("nope").ok === false && CP.defaults("nope").reason === "unknown-collar-preset", "5: defaults 알 수 없는 id 거부");
  ok(CP.composeDraft("nope", bodice(), DC).reason === "unknown-collar-preset", "5: composeDraft 알 수 없는 id 거부");
  ok(CP.matches(CP.DEFAULT_ID, { bandWidthCm: 3, frontRiseCm: 1, frontEndCm: 0.5 }, CP.defaults(CP.DEFAULT_ID).body) === true
    && CP.matches(CP.DEFAULT_ID, { bandWidthCm: 3.1, frontRiseCm: 1, frontEndCm: 0.5 }, CP.defaults(CP.DEFAULT_ID).body) === false
    && CP.matches("nope", {}, {}) === false, "5: matches(일치/수정됨/알 수 없음)");
}
// 6. composeDraft = 기존 교재 M 초기화 draft(ui.js onCollarBaseM 구버전과 같은 구성) — presetId 외 동일
// ui.js 가 직접 조립하던 형태(프리셋 밖 경로)와 composeDraft 가 같은 draft 를 만드는지 대조하는 기준.
function manualMDraft(b) {
  const rec = CP.get("bunka-shirt-collar-M");
  const s = DC.computeStand(b, rec.stand), bd = DC.computeBody(s, rec.body);
  return { sourceBodiceHash: b.hash, type: "shirt-two-piece", baseMethod: rec.baseMethod,
    parameters: { stand: JSON.parse(J(rec.stand)) },
    standGeometry: s.standGeometry, standAnchors: s.anchors, collarGeometry: null,
    body: { parameters: JSON.parse(J(rec.body)), geometry: bd.bodyGeometry, attachLenCm: bd.attachLenCm, measure: bd.measure, anchors: bd.anchors },
    measure: { lowerNeckSeamLenCm: s.lowerNeckSeamLenCm, lowerExtensionLenCm: s.lowerExtensionLenCm, upperNeckSegmentLenCm: s.upperNeckSegmentLenCm,
      upperExtensionLenCm: s.upperExtensionLenCm, upperTotalLenCm: s.upperTotalLenCm, backNeckLenCm: s.backNeckLenCm, frontNeckLenCm: s.frontNeckLenCm,
      neckTargetCm: s.neckTargetCm, cbTrimCm: s.cbTrimCm,
      baseLineLenCm: s.baseLineLenCm, baselineReductionCm: s.baselineReductionCm, guideRiseCm: s.guideRiseCm } };
}
function project(cd) { return { sourceBlock: { id: "block-1", version: 1, canonicalHash: "CH1" }, working: { collarDraft: cd, patternLines: [], collarResult: null } }; }
{
  BODICE = bodice("BH1");
  const plan = CP.composeDraft(CP.DEFAULT_ID, BODICE, DC), old = manualMDraft(BODICE);
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

// 7. 완료본 provenance: presetId 보존(hash 제외)·legacy null·id 만 다르면 hash·stale·idempotency 불변
{
  BODICE = bodice("BH1");
  const d1 = CP.composeDraft(CP.DEFAULT_ID, BODICE, DC).draft;
  PROJECT = project(d1); const r1 = CC.complete(PROJECT);
  ok(r1.ok && r1.result.presetId === "bunka-shirt-collar-M" && r1.result.baseMethod === "bunka-band-collar-P148-v1", "7: 완료본에 presetId 보존");
  PROJECT = project(manualMDraft(BODICE)); const r0 = CC.complete(PROJECT);
  ok(r0.ok && r0.result.presetId === null && "presetId" in r0.result, "7: legacy draft → presetId null");
  const d2 = CP.composeDraft(CP.DEFAULT_ID, BODICE, DC).draft; d2.presetId = "other-preset-id";
  PROJECT = project(d2); const r2 = CC.complete(PROJECT);
  ok(r2.ok && r2.result.presetId === "other-preset-id" && r2.result.hash === r1.result.hash && r0.result.hash === r1.result.hash, "7: presetId 만 달라도 hash 동일");
  PROJECT = project(d1); CC.complete(PROJECT); const done = PROJECT.working.collarResult;
  PROJECT.working.collarDraft = d2;
  ok(CC.isCurrentCollarChanged(PROJECT) === false, "7: presetId 만 다르면 stale 아님");
  const again = CC.complete(PROJECT);
  ok(again.idempotent === true && again.result === done && done.presetId === "bunka-shirt-collar-M", "7: presetId 만 다르면 idempotent(기존 완료본 유지)");
}

// 8. catalog(교재 분류 11종): 순서·표식·페이지·availability·불변성
{
  const F = CP.families();
  ok(Array.isArray(F) && F.length === 11 && Object.isFrozen(F), "8: family 11개·목록 frozen");
  const want = [["stand-collar", 1, "스탠드 칼라", "A", 60], ["shirt-collar-one-piece", 2, "셔츠 칼라", "G", 63],
    ["shirt-collar-with-band", 3, "칼라 밴드 달린 셔츠 칼라", "M", 66], ["flat-collar", 4, "플랫 칼라", "S", 69],
    ["sailor-collar", 5, "세일러 칼라", "U", 70], ["bow-collar", 6, "보 칼라", "X", 71], ["frill-collar", 7, "프릴 칼라", "a", 72],
    ["hood", 8, "후드", "d", 74], ["tailored-collar", 9, "테일러드 칼라", "h", 78], ["shawl-collar", 10, "숄 칼라", "j", 80],
    ["high-neck", 11, "하이넥", "l", 82]];
  ok(J(F.map(f => [f.id, f.order, f.label, f.symbol, f.page])) === J(want), "8: 교재 순서·id·표시명·표식·페이지 정확");
  ok(F.filter(f => f.availability === "available").map(f => f.id).join() === "stand-collar,shirt-collar-one-piece,shirt-collar-with-band", "8: available family = 스탠드(A)·셔츠(G)·밴드 셔츠(M)");
  ok(F.every(f => f.availability === "available" ? typeof f.generator === "string" : f.generator === null), "8: generator 는 구현된 family 만");
  ok(F.filter(f => f.availability === "pending-source").every(f => f.note === CP.PENDING_NOTE) && F.filter(f => f.availability === "pending-source").length === 8, "8: 미구현 family 8개 안내 문구");
  const M = CP.family("shirt-collar-with-band");
  ok(M && CP.family("nope") === null && CP.family("__proto__") === null, "8: family 조회·알 수 없는 id null");
  try { F.push({}); } catch (_) {}
  try { M.variants.push({}); } catch (_) {}
  try { CP.family("stand-collar").page = 1; } catch (_) {}
  ok(CP.families().length === 11 && M.variants.length === 6 && CP.family("stand-collar").page === 60 && Object.isFrozen(M.variants), "8: catalog 변경 불가");
  ok(CP.families() === F, "8: families 결정론(같은 참조)");
  ok(CP.get(CP.DEFAULT_ID).familyId === "shirt-collar-with-band" && CP.DEFAULT_FAMILY_ID === "shirt-collar-with-band", "8: M 레코드 ↔ family 연결");
}
// 9. 스탠드 A~F 슬롯: 전부 실행
{
  const vs = CP.variants("stand-collar");
  ok(vs.length === 6 && J(vs.map(v => v.id)) === J(["A", "B", "C", "D", "E", "F"].map(x => "bunka-stand-collar-" + x)), "9: 스탠드 A~F 슬롯 6개");
  ok(vs.every(v => v.availability === "available" && v.presetId === v.id), "9: A~F 실행");
  ok(vs.every(v => !("stand" in v) && !("body" in v) && !("parameters" in v) && !("geometry" in v)), "9: 수치·형상 데이터 없음");
  ok(CP.variants("hood").length === 0 && CP.variants("nope").length === 0 && Object.isFrozen(CP.variants("nope")), "9: 다른 미구현 family 는 빈 슬롯");
  ok(CP.variant("stand-collar", "bunka-stand-collar-A") === vs[0] && CP.variant("stand-collar", "bunka-stand-collar-B") === vs[1] && CP.variant("stand-collar", "nope") === null, "9: variant 조회");
  ok(J(CP.variantOptions("stand-collar").map(v => v.available)) === J([true, true, true, true, true, true]), "9: A~F 옵션 available");
  ok(J(CP.variantOptions("shirt-collar-with-band").map(o => [o.value, o.available])) === J([["bunka-shirt-collar-M", true], ["bunka-band-collar-N", true], ["bunka-band-collar-O", true], ["bunka-band-collar-P", true], ["bunka-band-collar-Q", true], ["bunka-band-collar-R", false]]), "9: family 3 = M·N·O·P·Q 실행 / R 참고");
  const fo = CP.familyOptions();
  ok(fo.length === 11 && fo[0].label === "스탠드 칼라 A (P60)" && fo[0].available === true && fo[2].available === true, "9: family 옵션(표식·페이지·availability)");
}
// 10. ★ 안전장치: 미구현·알 수 없음은 명시적 거부 — 절대 M 으로 fallback 하지 않는다
{
  ok(CP.resolve("shirt-collar-with-band", "bunka-shirt-collar-M").presetId === "bunka-shirt-collar-M", "10: M 해석 ok");
  ok(["A", "B", "C", "D", "E", "F"].every(x => CP.resolve("stand-collar", "bunka-stand-collar-" + x).presetId === "bunka-stand-collar-" + x), "10: A~F 해석 ok");
  const cases = [["stand-collar", "", "unknown-collar-variant"],
    ["hood", "", "unknown-collar-variant"], ["hood", "bunka-shirt-collar-M", "unknown-collar-variant"],
    ["nope", "bunka-shirt-collar-M", "unknown-collar-family"], ["shirt-collar-with-band", "", "unknown-collar-variant"],
    ["shirt-collar-with-band", null, "unknown-collar-variant"], ["shirt-collar-with-band", "bunka-band-collar-R", "collar-preset-unavailable"]];
  ok(cases.every(([f, v, r]) => { const res = CP.resolve(f, v); return res.ok === false && res.reason === r && !("presetId" in res); }), "10: 미구현·알 수 없음 거부(presetId 미부여)");
  ok(cases.every(([f, v]) => { const res = CP.resolve(f, v); return res.presetId !== CP.DEFAULT_ID; }), "10: DEFAULT_ID(M) fallback 없음");
  // 거부된 id 로 compose 를 시도해도 M 형상이 만들어지지 않는다
  BODICE = bodice("BH1");
  ok(["", null, undefined, "bunka-band-collar-R"].every(id => { const r = CP.composeDraft(id, BODICE, DC); return r.ok === false && !("draft" in r); }), "10: 미구현 id compose 거부(draft 없음)");
}
// 11. catalog 검증 실패(조용히 수용 금지)
{
  const cat = () => JSON.parse(J(CP.families()));
  const recs = () => JSON.parse(J(CP.list()));
  ok(CP.buildCatalog(cat(), recs()).list.length === 11, "11: 유효 catalog 재구성");
  throwsReason(() => CP.buildCatalog([], recs()), "empty-catalog", "11: 빈 catalog");
  let c = cat(); c[1].order = 5; throwsReason(() => CP.buildCatalog(c, recs()), "bad-book-order", "11: 교재 순서 불일치");
  c = cat(); c[0].id = c[1].id; throwsReason(() => CP.buildCatalog(c, recs()), "duplicate-id", "11: 중복 family id");
  c = cat(); c[0].variants[1].id = c[0].variants[0].id; throwsReason(() => CP.buildCatalog(c, recs()), "duplicate-id", "11: 중복 variant id");
  c = cat(); c[0].symbol = ""; throwsReason(() => CP.buildCatalog(c, recs()), "missing-field", "11: 표식 누락");
  c = cat(); c[0].page = 0; throwsReason(() => CP.buildCatalog(c, recs()), "invalid-page", "11: 잘못된 페이지");
  c = cat(); c[0].availability = "soon"; throwsReason(() => CP.buildCatalog(c, recs()), "invalid-availability", "11: 알 수 없는 상태");
  c = cat(); c[3].generator = "made-up"; throwsReason(() => CP.buildCatalog(c, recs()), "invalid-generator", "11: 미구현 family 에 generator 금지");
  c = cat(); c[3].variants = [{ id: "flat-x", symbol: "X", label: "X", availability: "available", presetId: "bunka-shirt-collar-M", note: null }];
  throwsReason(() => CP.buildCatalog(c, recs()), "unavailable-family-variant", "11: 미구현 family 의 available variant 금지");
  c = cat(); c[2].variants[0].presetId = "nope"; throwsReason(() => CP.buildCatalog(c, recs()), "unknown-variant-preset", "11: 없는 preset 참조");
  c = cat(); c[2].variants[5].presetId = "bunka-shirt-collar-M"; throwsReason(() => CP.buildCatalog(c, recs()), "pending-variant-preset", "11: 미구현 variant 는 preset 없음");
  c = cat(); c[0].variants[0].body = { cbWidthCm: 4 }; throwsReason(() => CP.buildCatalog(c, recs()), "variant-shape-data", "11: variant 에 수치·형상 금지");
  c = cat(); c[2].variants = []; throwsReason(() => CP.buildCatalog(c, recs()), "available-family-without-preset", "11: available family 는 preset 필요");
  let r = recs(); r[0].familyId = "nope"; throwsReason(() => CP.buildCatalog(cat(), r), "unknown-preset-family", "11: 레코드의 알 수 없는 family");
  r = recs(); const extra = JSON.parse(J(r[0])); extra.id = "loose"; r.push(extra);
  throwsReason(() => CP.buildCatalog(cat(), r), "preset-without-variant", "11: variant 가 가리키지 않는 레코드");
  r = recs(); delete r[0].familyId; throwsReason(() => CP.validateRecord(r[0]), "missing-field", "11: 레코드 familyId 필수");
}
// 12. catalog 추가 후에도 기존 M 적용·hash 불변(선택 층은 형상에 영향 없음)
{
  BODICE = bodice("BH1");
  const sel = CP.resolve("shirt-collar-with-band", "bunka-shirt-collar-M");
  const d = CP.composeDraft(sel.presetId, BODICE, DC).draft;
  const noId = JSON.parse(J(d)); delete noId.presetId;
  ok(J(noId) === J(manualMDraft(BODICE)), "12: M draft 는 catalog 도입 후에도 byte-identical");
  PROJECT = project(d); const r = CC.complete(PROJECT);
  ok(r.ok && r.result.presetId === "bunka-shirt-collar-M" && r.result.hash === CC.complete(project(manualMDraft(BODICE))).result.hash, "12: 완료 hash 불변");
}

// 13. 셔츠 칼라(한 장, family 2) G~L: 교재 순서·G/H/I/J/K 실행·L 참고 도면 수치
const ONE = "shirt-collar-one-piece";
{
  const f = CP.family(ONE);
  ok(f && f.order === 2 && f.symbol === "G" && f.page === 63 && f.availability === "available" && f.generator === "shirt-one-piece-v1", "13: family 2 셔츠 칼라(G 구현 후 available)");
  ok(f.reference && f.reference.methodPage === 147 && J(f.reference.pages) === J([63, 64, 65]) && /달림선 길이/.test(f.reference.attachLine) && /가봉/.test(f.reference.fitting), "13: family 참고 메모(제도법 P147·달림선 정합·가봉)");
  const vs = CP.variants(ONE);
  ok(J(vs.map(v => v.id)) === J(["G", "H", "I", "J", "K", "L"].map(x => "bunka-shirt-collar-" + x)), "13: G~L 교재 순서");
  ok(vs.every(v => v.availability === "available" && v.presetId === v.id && !("reference" in v)), "13: G~L 전부 실행 가능(수치는 레코드가 출처)");
  ok(vs.every(v => !("stand" in v) && !("body" in v) && !("openCollar" in v) && !("parameters" in v) && !("geometry" in v)), "13: catalog 에 실행 수치·형상 없음");
  ok(J(vs.map(v => v.page)) === J([63, 63, 64, 64, 65, 65]), "13: variant 페이지 G·H 63 / I·J 64 / K·L 65");
  // 같은 family 안에서도 생성 구조가 다르다: G~K = 한 장(P.147), L = 몸판 연동 오픈 칼라(P.65)
  ok(["G", "H", "I", "J", "K"].every(x => CP.get("bunka-shirt-collar-" + x).type === "shirt-one-piece")
    && CP.get("bunka-shirt-collar-L").type === "shirt-open-collar", "13: G~K 한 장 / L 오픈 칼라 type 분리");
  ok(["G", "H", "I", "J", "K"].every(x => { const p = CP.get("bunka-shirt-collar-" + x).onePiece; return p.backCollarWidthCm === 3.5 && p.frontCollarWidthCm === 6.5; }), "13: G~K 공통 폭 3.5/6.5(실행 레코드에서)");
  ok(/반대 방향/.test(CP.get("bunka-shirt-collar-K").description) && /꺾임선/.test(CP.get("bunka-shirt-collar-L").description)
    && /곡률 수치 무표기/.test(CP.get("bunka-shirt-collar-J").source), "13: K·L 실행 설명 + J 곡률 무표기 출처");
  // 불변
  try { CP.variants(ONE).push({}); } catch (_) {}
  ok(CP.variants(ONE).length === 6 && CP.variants(ONE).every(v => Object.isFrozen(v)), "13: variant 목록 변경 불가");
}
// 14. 참고 수치 표시 행(실행값 아님) + 표기 없는 항목 제외
{
  ok(CP.variants(ONE).every(v => CP.referenceRows(ONE, v.id).length === 0), "14: G~L 은 전부 실행 레코드라 참고 행 없음");
  ok(CP.families().every(f => f.variants.every(v => v.availability !== "available" || CP.referenceRows(f.id, v.id).length === 0)), "14: 적용 가능한 variant 에는 참고 행이 없다");
  ok(CP.referenceRows("shirt-collar-with-band", "bunka-shirt-collar-M").length === 0 && CP.referenceRows("nope", "x").length === 0, "14: 실행 preset·없는 선택은 참고 행 없음");
  ok(CP.referenceFields().map(f => f.key).join() === "backCollarWidthCm,frontCollarWidthCm,collarStandCm,riseCm,frontEndMarkCm,attachCurveMarkCm", "14: 참고 필드 의미 순서");
  ok(/의미 미확정/.test(CP.referenceFields()[4].label), "14: 앞쪽 표기는 의미 미확정으로 표기");
}
// 15. 미구현 선택은 여전히 거부 — 어떤 경로에서도 M/G~L 로 대체되지 않는다
{
  BODICE = bodice("BH1");
  const pending = [["shirt-collar-with-band", "bunka-band-collar-R"]];
  ok(pending.every(([f, id]) => { const r = CP.resolve(f, id); return r.ok === false && r.reason === "collar-preset-unavailable" && !("presetId" in r); }), "15: R resolve 거부");
  ok(pending.every(([, id]) => { const r = CP.composeDraft(id, BODICE, DC); return r.ok === false && r.reason === "unknown-collar-preset" && !("draft" in r); }), "15: 미구현 id compose 거부(다른 형상 안 만듦)");
  ok(CP.list().length === 17, "15: 실행 레코드 = A~F·M·N·O·P·Q·G~L");
  ok(J(CP.variantOptions(ONE)) === J(CP.variants(ONE).map(v => ({ value: v.id, label: v.label, available: true }))), "15: family 2 옵션 G~L 전부 available");
}
// 16. 참고 수치 검증(조용히 수용 금지)
{
  const cat = () => JSON.parse(J(CP.families())), recs = () => JSON.parse(J(CP.list()));
  // 참고 전용 variant 픽스처: family 3(밴드)의 pending O 에 reference 를 얹어 검증 경로만 태운다.
  const one = (c) => { const v = c[2].variants[5]; if (!v.reference) { v.reference = { collarStandCm: 3 }; v.requiresMethodPage = 147; } return v; };
  let c = cat(); one(c).reference.bogus = 1; throwsReason(() => CP.buildCatalog(c, recs()), "unknown-reference-key", "16: 알 수 없는 참고 키");
  c = cat(); one(c).reference.collarStandCm = "3"; throwsReason(() => CP.buildCatalog(c, recs()), "invalid-reference", "16: 문자열 수치");
  c = cat(); one(c).reference.riseCm = 0; throwsReason(() => CP.buildCatalog(c, recs()), "invalid-reference", "16: 0 이하 수치");
  c = cat(); one(c).reference.attachCurveDirection = "sideways"; throwsReason(() => CP.buildCatalog(c, recs()), "invalid-reference", "16: 알 수 없는 곡선 방향");
  c = cat(); one(c); c[2].variants[5].requiresMethodPage = undefined; delete c[2].variants[5].requiresMethodPage;
  throwsReason(() => CP.buildCatalog(c, recs()), "reference-without-method-page", "16: 제도법 페이지 없는 참고값");
  c = cat(); c[2].variants[0].reference = { collarStandCm: 3 }; c[2].variants[0].requiresMethodPage = 147;
  throwsReason(() => CP.buildCatalog(c, recs()), "reference-on-available-variant", "16: 적용 가능한 variant 에 참고값 금지");
  c = cat(); c[1].reference.pages = ["63"]; throwsReason(() => CP.buildCatalog(c, recs()), "invalid-reference", "16: family 참고 메모 형식");
  c = cat(); c[1].reference.stand = { standHeightCm: 3 }; throwsReason(() => CP.buildCatalog(c, recs()), "invalid-reference", "16: family 참고에 형상 키 금지");
}

// 17. variant 표식(symbol)은 안정 필드 — 표시 제목은 선택 variant 의 표식·페이지를 쓴다(대표 symbol·label 파싱 아님)
{
  const title = (f, v) => { const t = CP.displayTitle(f, v); return t.familyLabel + " " + t.symbol + " (교재 P" + t.page + ")"; };
  ok(J(CP.variants(ONE).map(v => v.symbol)) === J(["G", "H", "I", "J", "K", "L"]), "17: G~L symbol 필드");
  ok(J(["G", "H", "I", "J", "K", "L"].map(x => title(ONE, "bunka-shirt-collar-" + x)))
    === J(["셔츠 칼라 G (교재 P63)", "셔츠 칼라 H (교재 P63)", "셔츠 칼라 I (교재 P64)", "셔츠 칼라 J (교재 P64)", "셔츠 칼라 K (교재 P65)", "셔츠 칼라 L (교재 P65)"]), "17: G~L 제목이 각 variant 표식·페이지");
  ok(title("shirt-collar-with-band", "bunka-shirt-collar-M") === "칼라 밴드 달린 셔츠 칼라 M (교재 P66)", "17: M 제목 불변");
  ok(J(CP.variants("stand-collar").map(v => v.symbol)) === J(["A", "B", "C", "D", "E", "F"]) && title("stand-collar", "bunka-stand-collar-C") === "스탠드 칼라 C (교재 P61)", "17: 스탠드 A~F 표식");
  ok(title("hood", "") === "후드 d (교재 P74)" && title("hood", "nope") === "후드 d (교재 P74)", "17: variant 없으면 family 대표 표식·페이지");
  ok(CP.displayTitle("nope", "x") === null, "17: 알 수 없는 family → null");
  const t = CP.displayTitle(ONE, "bunka-shirt-collar-L");
  ok(Object.isFrozen(t) && t.variantId === "bunka-shirt-collar-L" && t.symbol === "L", "17: 제목 데이터 동결·선택 variant 식별");
  const c = JSON.parse(J(CP.families())); delete c[1].variants[0].symbol;
  throwsReason(() => CP.buildCatalog(c, JSON.parse(J(CP.list()))), "missing-field", "17: variant symbol 필수");
  ok(CP.families().every(f => f.variants.every(v => Object.isFrozen(v) && typeof v.symbol === "string" && v.symbol.length > 0)), "17: 모든 variant 표식 동결·존재");
}

// 18. 한 장 셔츠 칼라 G 실행 레코드·생성기(교재 P.147 작도) — 독립 재계산과 대조
{
  const G = CP.get("bunka-shirt-collar-G");
  ok(G && G.type === "shirt-one-piece" && G.baseMethod === "bunka-shirt-collar-G-v1" && G.familyId === ONE, "18: G 레코드 type·baseMethod·family");
  ok(J(G.onePiece) === J({ riseCm: 2.5, backCollarWidthCm: 3.5, collarStandCm: 3, frontCollarWidthCm: 6.5, tipProjectionCm: 3, attachCurveCm: 0.2 }), "18: G 교재 수치(★2.5·뒤3.5·허리3·앞6.5·끝3·곡률0.2)");
  ok(!("stand" in G) && !("body" in G), "18: 한 장 레코드는 밴드/본체 섹션을 쓰지 않음");
  ok(CP.fields("onePiece").map(f => f.key).join() === Object.keys(G.onePiece).join(), "18: onePiece 필드 순서 = 파라미터 키 순서");
  BODICE = bodice("BH1");
  const r = DC.computeOnePiece(BODICE, G.onePiece);
  ok(r.ok, "18: computeOnePiece ok (" + (r.reason || "") + ")");
  // 작도 규칙 독립 검증: ★·×·⊘·칼라 끝·앞 칼라 폭
  const back = BODICE.necklineLengths.back, front = BODICE.necklineLengths.front, an = r.anchors;
  const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
  ok(near(an.cbAttach.x, 0) && near(an.cbAttach.y, -2.5), "18: ③ CB 에서 올림 ★ 2.5");
  ok(near(an.a.x, back) && near(an.a.y, -2.5), "18: ④ A = CB 에 직각으로 뒤목 × (같은 높이)");
  ok(near(Math.hypot(an.b.x - an.a.x, an.b.y - an.a.y), front) && near(an.b.y, 0), "18: ⑤ B = A 에서 앞목 ⊘, 기초선 위");
  ok(near(an.tipBase.x - an.b.x, 3) && near(an.tipBase.y, 0), "18: ⑦ 칼라 끝 수평 3");
  ok(near(an.tip.x, an.tipBase.x) && near(Math.hypot(an.tip.x - an.b.x, an.tip.y - an.b.y), 6.5), "18: ⑧⑨ 앞 칼라 폭 6.5(끝 수직선 위)");
  ok(near(an.cbFold.y, an.cbAttach.y - 3) && near(an.cbOuter.y, an.cbFold.y - 3.5) && near(an.cbOuter.y, an.cbAttach.y - 6.5)
    && near(an.cbFold.x, 0) && near(an.cbOuter.x, 0), "18: 2-② CB 허리 3 + 그 위 뒤 폭 3.5(전체 6.5)");
  // 2-① 안내선 = 두 달림 기초선에 세운 수직선의 이등분(각도 동일)
  const ang = (p, q) => Math.atan2(q.y - p.y, q.x - p.x), u = an.guideDir, uA = Math.atan2(u.y, u.x);
  const acute = (a, b) => { let d = Math.abs(a - b) % Math.PI; return Math.min(d, Math.PI - d); };   // 선 사이 각(방향 무관)
  ok(Math.abs(acute(uA, ang(an.cbAttach, an.a)) - acute(uA, ang(an.a, an.b))) < 1e-9, "18: 안내선이 두 달림 기초선과 같은 각(2-①)");
  ok(near(an.foldGuide.y, an.cbFold.y) && near(an.outerGuide.y, an.cbOuter.y), "18: 허리·폭 수평선(뒤 중심선에 직각)과 안내선의 교점");
  // 달림선 0.2 = A–B 현 중점에서 수직·칼라 쪽(위)으로
  const attach = r.geometry.outline.filter(s => s.part === "attach");
  ok(attach.length === 3 && attach[0].kind === "line" && attach[1].kind === "cubic" && attach[2].kind === "cubic", "18: 달림선 = CB→A 직선 + A→B 두 cubic");
  const bowMid = attach[1].to, mx = (an.a.x + an.b.x) / 2, my = (an.a.y + an.b.y) / 2;
  const d = Math.hypot(bowMid.x - mx, bowMid.y - my);
  ok(near(d, 0.2, 1e-9) && bowMid.y < my, "18: 0.2 = 현 중점에서 위(칼라 쪽) 볼록");
  // 조각 구성·닫힘·측정
  ok(J(r.geometry.outline.map(s => s.part)) === J(["attach", "attach", "attach", "front-end", "outer", "outer", "cb"]), "18: 한 조각 = 달림선·앞끝·외곽·CB");
  ok(r.geometry.construction.every(s => s.part === "fold") && r.geometry.construction.length === 2, "18: 꺾임선은 construction");
  ok(DC.validateClosedOutline(r.geometry.outline).ok, "18: 폐곡선·자기교차 없음");
  ok(r.measure.attachLenCm > r.measure.neckTargetCm && r.measure.attachLenCm - r.measure.neckTargetCm < 0.05
    && near(r.measure.neckTargetCm, back + front, 1e-9) && near(r.measure.attachDiffCm, r.measure.attachLenCm - (back + front), 1e-9), "18: 달림선 실측 ≥ 목둘레(곡선분) · 차이는 측정값");
  ok(near(r.measure.frontCollarWidthCm, 6.5, 1e-9) && near(r.measure.tipProjectionCm, 3, 1e-9) && r.measure.outerLenCm > 0 && r.measure.foldLenCm > 0, "18: 측정값(앞 폭·칼라 끝·외곽·꺾임)");
  // 결정론 + 입력 불변
  const snapshot = J(G.onePiece);
  ok(J(DC.computeOnePiece(BODICE, G.onePiece)) === J(r) && J(G.onePiece) === snapshot, "18: 결정론·입력 불변");
  // 실패 계약(원자)
  const bad = (patch, reason) => { const p2 = Object.assign({}, G.onePiece, patch); const x = DC.computeOnePiece(BODICE, p2); return x.ok === false && x.reason === reason && !("geometry" in x); };
  ok(bad({ riseCm: 0 }, "invalid-rise") && bad({ riseCm: front + 1 }, "invalid-rise"), "18: 올림 치수 실패");
  ok(bad({ collarStandCm: 0 }, "invalid-collar-stand"), "18: 칼라 허리 0 거부(뒤 폭과 독립 치수)");
  ok(bad({ frontCollarWidthCm: 3 }, "invalid-front-collar-width") && bad({ tipProjectionCm: -1 }, "invalid-tip-projection") && bad({ attachCurveCm: -0.1 }, "invalid-attach-curve"), "18: 앞 폭·칼라 끝·곡률 실패");
  ok(DC.computeOnePiece({ hash: "x" }, G.onePiece).reason === "no-bodice" || DC.computeOnePiece({ hash: "x" }, G.onePiece).reason === "no-neckline", "18: 몸판 없음 거부");
  ok(J(DC.ONE_PIECE_METHOD) === J({ page: 147, smoothing: "tangent-continuous-cubic", handleFraction: 1 / 3 }), "18: 정리 규칙은 구현 관례로 명시(교재 수치 아님)");
}
// 19. G 초안·완료본: M 과 섞이지 않는 type 분리 + 선택 왕복 무변경
{
  BODICE = bodice("BH1");
  const g = CP.composeDraft("bunka-shirt-collar-G", BODICE, DC);
  ok(g.ok && g.draft.type === "shirt-one-piece" && g.draft.presetId === "bunka-shirt-collar-G" && g.draft.baseMethod === "bunka-shirt-collar-G-v1", "19: G draft type·출처");
  ok(!("standGeometry" in g.draft) && !("body" in g.draft) && !("stand" in g.draft.parameters) && g.draft.parameters.onePiece && g.draft.onePiece.geometry, "19: 밴드/본체 필드 없음(거짓 재사용 금지)");
  PROJECT = project(g.draft);
  const rc = CC.complete(PROJECT);
  ok(rc.ok && rc.result.type === "shirt-one-piece" && rc.result.onePiece.geometry && rc.result.symmetry === "half-cb-fold" && Object.isFrozen(rc.result), "19: G 완료 스냅샷(" + (rc.reason || "") + ")");
  ok(!("stand" in rc.result) && !("body" in rc.result) && rc.result.presetId === "bunka-shirt-collar-G", "19: 완료본도 밴드/본체 없음·presetId 보존");
  ok(CC.isCurrentCollarChanged(PROJECT) === false && CC.complete(PROJECT).idempotent === true, "19: 변경 없음·idempotent");
  // M draft 와 hash 가 다르고, 종류가 바뀌면 stale
  const m = CP.composeDraft(CP.DEFAULT_ID, BODICE, DC).draft;
  PROJECT.working.collarDraft = m;
  ok(CC.isCurrentCollarChanged(PROJECT) === true, "19: 한 장 완료본 vs 2피스 draft → 변경됨");
  const mDone = CC.complete(PROJECT);
  ok(mDone.ok && mDone.result.type === "shirt-two-piece" && mDone.result.hash !== rc.result.hash, "19: M 완료본과 hash 분리");
  PROJECT.working.collarDraft = CP.composeDraft("bunka-shirt-collar-G", BODICE, DC).draft;
  ok(CC.isCurrentCollarChanged(PROJECT) === true && CC.complete(PROJECT).result.hash === rc.result.hash, "19: G 재적용 → 같은 형상 hash 복귀");
  // 게이트: 형상 없는 한 장 draft 는 완료 불가(원자)
  const broken = JSON.parse(J(g.draft)); delete broken.onePiece;
  const P2 = project(broken); const before = P2.working.collarResult;
  const rb = CC.complete(P2);
  ok(rb.ok === false && rb.reason === "no-collar-piece" && P2.working.collarResult === before, "19: 형상 없는 한 장 draft 거부·불변");
}

// 19-H. H 실행 레코드·초안·완료본: P.63 수치 보존, G fallback 금지
{
  BODICE = bodice("BH1");
  const H = CP.get("bunka-shirt-collar-H"), G = CP.get("bunka-shirt-collar-G");
  ok(H && H.type === "shirt-one-piece" && H.baseMethod === "bunka-shirt-collar-H-v1" && H.familyId === ONE, "19-H: H 레코드 type·baseMethod·family");
  ok(J(H.onePiece) === J({ riseCm: 8, backCollarWidthCm: 3.5, collarStandCm: 1, frontCollarWidthCm: 6.5, tipProjectionCm: 4.5, attachCurveCm: 0.3 }), "19-H: H 교재 수치(★8·뒤3.5·허리1·앞6.5·끝4.5·곡률0.3)");
  ok(H.baseMethod !== G.baseMethod && J(H.onePiece) !== J(G.onePiece), "19-H: H 출처·입력은 G와 분리");
  const made = CP.composeDraft(H.id, BODICE, DC), g = CP.composeDraft(G.id, BODICE, DC);
  ok(made.ok && made.draft.presetId === H.id && made.draft.baseMethod === H.baseMethod && made.draft.type === "shirt-one-piece", "19-H: H draft 생성·출처 보존");
  ok(DC.validateClosedOutline(made.draft.onePiece.geometry.outline).ok && made.draft.onePiece.measure.riseCm === 8 && made.draft.onePiece.measure.collarStandCm === 1, "19-H: H 폐곡선·실측값");
  ok(J(made.draft.onePiece.geometry) !== J(g.draft.onePiece.geometry), "19-H: G와 다른 geometry(조용한 fallback 없음)");
  PROJECT = project(made.draft);
  const done = CC.complete(PROJECT), again = CC.complete(PROJECT);
  ok(done.ok && done.result.presetId === H.id && done.result.baseMethod === H.baseMethod && done.result.type === "shirt-one-piece", "19-H: H 완료 스냅샷 출처 보존");
  ok(again.ok && again.idempotent === true && again.result.hash === done.result.hash, "19-H: H 재완료 결정론·idempotent");
  const gDone = CC.complete(project(g.draft));
  ok(gDone.ok && gDone.result.hash !== done.result.hash, "19-H: H와 G 완료 hash 분리");
  try { H.onePiece.riseCm = 2.5; } catch (_) {}
  ok(H.onePiece.riseCm === 8 && Object.isFrozen(H.onePiece), "19-H: H 레코드 불변");
}

// 19-I. I 실행 레코드·초안·완료본: P.64 수치 보존, G/H fallback 금지
{
  BODICE = bodice("BH1");
  const I = CP.get("bunka-shirt-collar-I"), G = CP.get("bunka-shirt-collar-G"), H = CP.get("bunka-shirt-collar-H");
  ok(I && I.type === "shirt-one-piece" && I.baseMethod === "bunka-shirt-collar-I-v1" && I.familyId === ONE, "19-I: I 레코드 type·baseMethod·family");
  ok(J(I.onePiece) === J({ riseCm: 4.5, backCollarWidthCm: 3.5, collarStandCm: 2, frontCollarWidthCm: 6.5, tipProjectionCm: 3.5, attachCurveCm: 0.3 }), "19-I: I 교재 수치(★4.5·뒤3.5·허리2·앞6.5·끝3.5·곡률0.3)");
  ok(I.baseMethod !== G.baseMethod && I.baseMethod !== H.baseMethod && J(I.onePiece) !== J(G.onePiece) && J(I.onePiece) !== J(H.onePiece), "19-I: I 출처·입력은 G/H와 분리");
  const made = CP.composeDraft(I.id, BODICE, DC), g = CP.composeDraft(G.id, BODICE, DC), h = CP.composeDraft(H.id, BODICE, DC);
  ok(made.ok && made.draft.presetId === I.id && made.draft.baseMethod === I.baseMethod && made.draft.type === "shirt-one-piece", "19-I: I draft 생성·출처 보존");
  ok(DC.validateClosedOutline(made.draft.onePiece.geometry.outline).ok && made.draft.onePiece.measure.riseCm === 4.5 && made.draft.onePiece.measure.collarStandCm === 2, "19-I: I 폐곡선·실측값");
  ok(J(made.draft.onePiece.geometry) !== J(g.draft.onePiece.geometry) && J(made.draft.onePiece.geometry) !== J(h.draft.onePiece.geometry), "19-I: G/H와 다른 geometry(조용한 fallback 없음)");
  PROJECT = project(made.draft);
  const done = CC.complete(PROJECT), again = CC.complete(PROJECT);
  ok(done.ok && done.result.presetId === I.id && done.result.baseMethod === I.baseMethod && done.result.type === "shirt-one-piece", "19-I: I 완료 스냅샷 출처 보존");
  ok(again.ok && again.idempotent === true && again.result.hash === done.result.hash, "19-I: I 재완료 결정론·idempotent");
  const gDone = CC.complete(project(g.draft)), hDone = CC.complete(project(h.draft));
  ok(gDone.ok && hDone.ok && done.result.hash !== gDone.result.hash && done.result.hash !== hDone.result.hash, "19-I: I와 G/H 완료 hash 분리");
  try { I.onePiece.riseCm = 2.5; } catch (_) {}
  ok(I.onePiece.riseCm === 4.5 && Object.isFrozen(I.onePiece), "19-I: I 레코드 불변");
}

// 19-J. J 실행 레코드·초안·완료본: P.64 수치 보존, 허리와 뒤 폭의 독립 구간 계약
{
  BODICE = bodice("BH1");
  const Jp = CP.get("bunka-shirt-collar-J"), G = CP.get("bunka-shirt-collar-G");
  const H = CP.get("bunka-shirt-collar-H"), I = CP.get("bunka-shirt-collar-I");
  ok(Jp && Jp.type === "shirt-one-piece" && Jp.baseMethod === "bunka-shirt-collar-J-v1" && Jp.familyId === ONE, "19-J: J 레코드 type·baseMethod·family");
  ok(J(Jp.onePiece) === J({ riseCm: 1, backCollarWidthCm: 3.5, collarStandCm: 4, frontCollarWidthCm: 6.5, tipProjectionCm: 2.5, attachCurveCm: 0 }), "19-J: J 교재 수치(★1·뒤3.5·허리4·앞6.5·끝2.5) + 곡률 무표기 구현 기준");
  ok([G, H, I].every(x => Jp.baseMethod !== x.baseMethod && J(Jp.onePiece) !== J(x.onePiece)), "19-J: J 출처·입력은 G/H/I와 분리");
  const made = CP.composeDraft(Jp.id, BODICE, DC), g = CP.composeDraft(G.id, BODICE, DC);
  const h = CP.composeDraft(H.id, BODICE, DC), i = CP.composeDraft(I.id, BODICE, DC);
  ok(made.ok && made.draft.presetId === Jp.id && made.draft.baseMethod === Jp.baseMethod && made.draft.type === "shirt-one-piece", "19-J: J draft 생성·출처 보존");
  const an = made.draft.onePiece.anchors;
  ok(DC.validateClosedOutline(made.draft.onePiece.geometry.outline).ok
    && Math.abs(an.cbFold.y - (an.cbAttach.y - 4)) < 1e-9
    && Math.abs(an.cbOuter.y - (an.cbFold.y - 3.5)) < 1e-9, "19-J: J 폐곡선·CB 허리4와 뒤 폭3.5 독립 구간");
  const attach = made.draft.onePiece.geometry.outline.filter(s => s.part === "attach");
  ok(attach.length === 2 && attach.every(s => s.kind === "line"), "19-J: 곡률 수치 무표기 → 별도 볼록 오프셋 없는 구현 기준");
  ok([g, h, i].every(x => J(x.draft.onePiece.geometry) !== J(made.draft.onePiece.geometry)), "19-J: G/H/I와 다른 geometry(조용한 fallback 없음)");
  PROJECT = project(made.draft);
  const done = CC.complete(PROJECT), again = CC.complete(PROJECT);
  ok(done.ok && done.result.presetId === Jp.id && done.result.baseMethod === Jp.baseMethod && done.result.type === "shirt-one-piece", "19-J: J 완료 스냅샷 출처 보존");
  ok(again.ok && again.idempotent === true && again.result.hash === done.result.hash, "19-J: J 재완료 결정론·idempotent");
  const prior = [g, h, i].map(x => CC.complete(project(x.draft)));
  ok(prior.every(x => x.ok && x.result.hash !== done.result.hash), "19-J: J와 G/H/I 완료 hash 분리");
  try { Jp.onePiece.collarStandCm = 2; } catch (_) {}
  ok(Jp.onePiece.collarStandCm === 4 && Object.isFrozen(Jp.onePiece), "19-J: J 레코드 불변");
}

// 19-K. K 실행 레코드·초안·완료본: I 치수 유지 + 앞 달림선 곡률 방향 반전
{
  BODICE = bodice("BH1");
  const K = CP.get("bunka-shirt-collar-K"), I = CP.get("bunka-shirt-collar-I");
  ok(K && K.type === "shirt-one-piece" && K.baseMethod === "bunka-shirt-collar-K-v1" && K.familyId === ONE, "19-K: K 레코드 type·baseMethod·family");
  ok(J(K.onePiece) === J({ riseCm: 4.5, backCollarWidthCm: 3.5, collarStandCm: 2, frontCollarWidthCm: 6.5, tipProjectionCm: 3.5, attachCurveCm: 0.6, attachCurveDirection: "reversed" }), "19-K: K 교재 수치(I 치수·곡률0.6·반대 방향)");
  ok(K.baseMethod !== I.baseMethod && K.onePiece.riseCm === I.onePiece.riseCm && K.onePiece.collarStandCm === I.onePiece.collarStandCm
    && K.onePiece.tipProjectionCm === I.onePiece.tipProjectionCm, "19-K: I 기준 치수 보존·출처 분리");
  const made = CP.composeDraft(K.id, BODICE, DC), i = CP.composeDraft(I.id, BODICE, DC);
  ok(made.ok && made.draft.presetId === K.id && made.draft.baseMethod === K.baseMethod && made.draft.type === "shirt-one-piece", "19-K: K draft 생성·출처 보존");
  const attach = made.draft.onePiece.geometry.outline.filter(s => s.part === "attach"), an = made.draft.onePiece.anchors;
  ok(DC.validateClosedOutline(made.draft.onePiece.geometry.outline).ok && attach.length === 3
    && attach[1].to.y > (an.a.y + an.b.y) / 2, "19-K: K 폐곡선·앞 달림선 반대 방향");
  ok(J(made.draft.onePiece.geometry) !== J(i.draft.onePiece.geometry)
    && made.draft.onePiece.measure.attachCurveDirection === "reversed", "19-K: I와 기준점은 같아도 형상·방향 측정은 분리");
  ok(CP.matches(K.id, K.onePiece, null) && !CP.matches(K.id, Object.assign({}, K.onePiece, { attachCurveDirection: "as-drawn" }), null), "19-K: preset 일치 판정에 곡률 방향 포함");
  PROJECT = project(made.draft);
  const done = CC.complete(PROJECT), again = CC.complete(PROJECT), iDone = CC.complete(project(i.draft));
  ok(done.ok && done.result.presetId === K.id && done.result.baseMethod === K.baseMethod && done.result.type === "shirt-one-piece", "19-K: K 완료 스냅샷 출처 보존");
  ok(again.ok && again.idempotent === true && again.result.hash === done.result.hash, "19-K: K 재완료 결정론·idempotent");
  ok(iDone.ok && iDone.result.hash !== done.result.hash, "19-K: K와 I 완료 hash 분리");
  const bad = JSON.parse(J(K)); bad.id = "bad-k"; bad.onePiece.attachCurveDirection = "sideways";
  throwsReason(() => CP.validateRecord(bad), "invalid-curve-direction", "19-K: 알 수 없는 실행 곡률 방향 거부");
  try { K.onePiece.attachCurveDirection = "as-drawn"; } catch (_) {}
  ok(K.onePiece.attachCurveDirection === "reversed" && Object.isFrozen(K.onePiece), "19-K: K 레코드 불변");
}

// 20. family 3(M~R): 교재 순서·실행/참고 구분·O·Q·R 의 남은 자유도 기록
const BAND_FAM = "shirt-collar-with-band";
{
  const vs = CP.variants(BAND_FAM);
  ok(J(vs.map(v => v.symbol)) === J(["M", "N", "O", "P", "Q", "R"]), "20: 교재 순서 M~R");
  ok(J(vs.map(v => v.availability === "available")) === J([true, true, true, true, true, false]), "20: M·N·O·P·Q 실행 / R 참고");
  ok(J(vs.map(v => v.page)) === J([66, 66, 67, 67, 68, 68]), "20: 페이지 66·66·67·67·68·68");
  const byId = {}; vs.forEach(v => { byId[v.symbol] = v; });
  ok(byId.M.presetId === "bunka-shirt-collar-M" && byId.N.presetId === "bunka-band-collar-N" && byId.O.presetId === "bunka-band-collar-O" && byId.P.presetId === "bunka-band-collar-P" && byId.Q.presetId === "bunka-band-collar-Q", "20: 실행 variant → 레코드 연결");
  ok(byId.R.presetId === null && Array.isArray(byId.R.unresolved) && byId.R.unresolved.length > 0, "20: R 은 preset 없음 + 남은 자유도 기록");
  ok(["O", "Q"].every(k => !("unresolved" in byId[k]) && !("bandReference" in byId[k]) && byId[k].availability === "available"), "20: O·Q 는 자유도·참고값 없이 실행 레코드로 전환");
  ok(byId.R.bandReference.bandWidthCm === 3, "20: R 참고 수치 보존");
  ok(CP.resolve(BAND_FAM, byId.R.id).ok === false && CP.resolve(BAND_FAM, byId.R.id).reason === "collar-preset-unavailable", "20: R resolve 거부");
  ok((function () { const r = CP.composeDraft(byId.R.id, BODICE, DC); return r.ok === false && !("draft" in r); })(), "20: R compose 거부(M 으로 fallback 없음)");
}
// 21. M·N·P 는 같은 P.148 골격, preset 치수만 다르다 — draft·완료본 분리
{
  BODICE = bodice("BH1");
  const made = {};
  ["bunka-shirt-collar-M", "bunka-band-collar-N", "bunka-band-collar-P"].forEach(id => {
    const d = CP.composeDraft(id, BODICE, DC);
    ok(d.ok && d.draft.presetId === id && d.draft.baseMethod === "bunka-band-collar-P148-v1", "21: " + id + " draft 생성");
    made[id] = d.draft;
    // P.148 ⑭: 달림선 실측 = 몸판 목둘레(×+⊘)
    ok(Math.abs(d.draft.measure.lowerNeckSeamLenCm - (BODICE.necklineLengths.back + BODICE.necklineLengths.front)) < 1e-6, "21: " + id + " 달림선 = ×+⊘");
    // step 3: 위칼라 이음선 = 밴드 윗선 ⒸⒹ
    ok(Math.abs(d.draft.body.attachLenCm - d.draft.measure.upperNeckSegmentLenCm) < 0.01, "21: " + id + " 이음선 = 밴드 윗선");
    PROJECT = project(d.draft);
    const r = CC.complete(PROJECT);
    ok(r.ok && r.result.presetId === id, "21: " + id + " 완료본");
    made[id + ":hash"] = r.result.hash;
  });
  ok(made["bunka-shirt-collar-M:hash"] !== made["bunka-band-collar-N:hash"] && made["bunka-band-collar-N:hash"] !== made["bunka-band-collar-P:hash"], "21: variant 별 완료본 hash 분리");
  // M↔N↔P 왕복: 같은 preset 재적용이면 같은 형상·hash
  PROJECT = project(CP.composeDraft("bunka-shirt-collar-M", BODICE, DC).draft);
  const back1 = CC.complete(PROJECT);
  ok(back1.result.hash === made["bunka-shirt-collar-M:hash"], "21: M 재적용 → 원래 hash 복귀");
  ok(J(CP.composeDraft("bunka-band-collar-N", BODICE, DC).draft.parameters) !== J(CP.composeDraft("bunka-band-collar-P", BODICE, DC).draft.parameters), "21: N·P 파라미터 구분");
}

// 22. 단독 스탠드 칼라 A(P.60/P.146): 독립 type·0.5 윗끝 물림·완료 스냅샷
{
  BODICE = bodice("BH1");
  const A = CP.get("bunka-stand-collar-A");
  ok(A && A.type === "stand-collar" && A.baseMethod === "bunka-stand-collar-A-P146-v1" &&
    J(A.standalone) === J({ collarWidthCm: 3.5, frontRiseCm: 1, topSetbackCm: 0.5 }), "22: A 레코드·교재 수치");
  ok(!("stand" in A) && !("body" in A) && !("onePiece" in A) && CP.fields("standalone").map(f => f.key).join() === Object.keys(A.standalone).join(), "22: 단독 구조·필드 분리");
  const plan = CP.composeDraft(A.id, BODICE, DC), d = plan.draft;
  ok(plan.ok && d.type === "stand-collar" && d.standalone.geometry && !d.standGeometry && !d.body && !d.onePiece, "22: A draft 독립 구조");
  const an = d.standalone.anchors, u = an.guideDir;
  ok(Math.abs(Math.hypot(an.cfOuterGuide.x - an.cfOuter.x, an.cfOuterGuide.y - an.cfOuter.y) - 0.5) < 1e-9 &&
    Math.abs((an.cfOuter.x - an.cfOuterGuide.x) * u.y - (an.cfOuter.y - an.cfOuterGuide.y) * u.x) < 1e-9,
    "22: 0.5 = 앞 윗끝에서 윗선 안내 방향으로 뒤쪽 물림(앞끝 연장 아님)");
  ok(DC.validateClosedOutline(d.standalone.geometry.outline).ok && d.standalone.measure.attachLenCm > 0 && d.standalone.measure.outerLenCm > 0, "22: 폐곡선·측정");
  PROJECT = project(d); const done = CC.complete(PROJECT);
  ok(done.ok && done.result.type === "stand-collar" && done.result.standalone.geometry && !("stand" in done.result) && !("body" in done.result), "22: A 완료본 독립 구조");
  ok(CC.isCurrentCollarChanged(PROJECT) === false && CC.complete(PROJECT).idempotent === true, "22: A 완료 직후 미변경·idempotent");
  PROJECT.working.collarDraft = CP.composeDraft(CP.DEFAULT_ID, BODICE, DC).draft;
  ok(CC.isCurrentCollarChanged(PROJECT) === true && CC.complete(PROJECT).result.hash !== done.result.hash, "22: A↔M type·hash 분리");
}

// 23. 단독 스탠드 칼라 B(P.60/P.146): 달림선 수평·0.5 윗끝 물림·A와 별도 출처/hash
{
  BODICE = bodice("BH1");
  const B = CP.get("bunka-stand-collar-B");
  ok(B && B.type === "stand-collar" && B.baseMethod === "bunka-stand-collar-B-P146-v1" &&
    J(B.standalone) === J({ collarWidthCm: 3.5, frontRiseCm: 0, topSetbackCm: 0.5 }), "23: B 레코드·교재 수치");
  const plan = CP.composeDraft(B.id, BODICE, DC), d = plan.draft;
  ok(plan.ok && d.standalone.geometry && Math.abs(d.standalone.anchors.cfSeam.y - d.standalone.anchors.cbSeam.y) < 1e-12 &&
    Math.abs(d.standalone.anchors.guideDir.y) < 1e-12, "23: B 달림선·안내 방향 수평");
  const an = d.standalone.anchors, u = an.guideDir;
  ok(Math.abs(Math.hypot(an.cfOuterGuide.x - an.cfOuter.x, an.cfOuterGuide.y - an.cfOuter.y) - 0.5) < 1e-9 &&
    Math.abs((an.cfOuter.x - an.cfOuterGuide.x) * u.y - (an.cfOuter.y - an.cfOuterGuide.y) * u.x) < 1e-9,
    "23: B 0.5 윗끝 물림");
  ok(DC.validateClosedOutline(d.standalone.geometry.outline).ok && Math.abs(d.standalone.measure.frontRiseCm) < 1e-12, "23: B 폐곡선·앞올림 0");
  PROJECT = project(d); const done = CC.complete(PROJECT);
  const aDone = CC.complete(project(CP.composeDraft("bunka-stand-collar-A", BODICE, DC).draft));
  ok(done.ok && done.result.presetId === B.id && done.result.hash !== aDone.result.hash, "23: B 완료본·A와 별도 hash");
}

// 24. 단독 스탠드 칼라 C(P.61/P.146): 앞올림 3cm·곡선 실측 후 뒤중심 길이 보정
{
  BODICE = bodice("BH1");
  const C = CP.get("bunka-stand-collar-C");
  ok(C && C.construction.fitNeckSeam === true && C.construction.baselineReductionCm === 0 && C.construction.guideRiseCm === 0 && C.baseMethod === "bunka-stand-collar-C-P146-v1" &&
    J(C.standalone) === J({ collarWidthCm: 3.5, frontRiseCm: 3, topSetbackCm: 0.5 }), "24: C 레코드·교재 수치·CB 보정 방식");
  const plan = CP.composeDraft(C.id, BODICE, DC), d = plan.draft, m = d.standalone.measure;
  ok(plan.ok && d.construction.fitNeckSeam === true && m.drawnAttachLenCm > m.neckTargetCm && m.cbTrimCm > 0,
    "24: C 보정 전 달림선 증가·뒤중심 보정 발생");
  ok(Math.abs(m.attachLenCm - m.neckTargetCm) < 1e-6 && Math.abs(m.attachDiffCm) < 1e-6 &&
    d.standalone.anchors.cbSeam.x > 0, "24: C 보정 후 달림선 = 목둘레");
  ok(DC.validateClosedOutline(d.standalone.geometry.outline).ok && Math.abs(m.frontRiseCm - 3) < 1e-12, "24: C 폐곡선·앞올림 3");
  PROJECT = project(d); const done = CC.complete(PROJECT);
  const bDone = CC.complete(project(CP.composeDraft("bunka-stand-collar-B", BODICE, DC).draft));
  ok(done.ok && done.result.presetId === C.id && done.result.standalone.construction.fitNeckSeam === true && done.result.hash !== bDone.result.hash,
    "24: C 완료본·보정 방식 보존·B와 별도 hash");
}

// 25. 단독 스탠드 칼라 D(P.61/P.146): 앞올림 8.5·기초선 2.5 감산·2/3점 2 올림·CB 재보정
{
  BODICE = bodice("BH1");
  const D = CP.get("bunka-stand-collar-D");
  ok(D && D.baseMethod === "bunka-stand-collar-D-P146-v1" &&
    J(D.construction) === J({ fitNeckSeam: true, baselineReductionCm: 2.5, guideRiseCm: 2 }) &&
    J(D.standalone) === J({ collarWidthCm: 3.5, frontRiseCm: 8.5, topSetbackCm: 0.5 }), "25: D 레코드·교재 보조치수");
  const plan = CP.composeDraft(D.id, BODICE, DC);
  ok(plan.ok, "25: D draft 생성");
  if (plan.ok) {
    const d = plan.draft, m = d.standalone.measure, an = d.standalone.anchors;
    ok(Math.abs(an.guideA.y + 2) < 1e-12 && Math.abs(an.cfSeam.y + 8.5) < 1e-12 &&
      Math.abs(m.baselineReductionCm - 2.5) < 1e-12, "25: D 기준점 2·앞올림 8.5·기초선 2.5 감산");
    ok(m.drawnAttachLenCm >= m.neckTargetCm && m.cbTrimCm >= 0 && Math.abs(m.attachLenCm - m.neckTargetCm) < 1e-6,
      "25: D 제도 후 뒤중심 재보정");
    ok(DC.validateClosedOutline(d.standalone.geometry.outline).ok, "25: D 폐곡선");
    PROJECT = project(d); const done = CC.complete(PROJECT);
    const cDone = CC.complete(project(CP.composeDraft("bunka-stand-collar-C", BODICE, DC).draft));
    ok(done.ok && done.result.presetId === D.id && done.result.standalone.construction.baselineReductionCm === 2.5 && done.result.hash !== cDone.result.hash,
      "25: D 완료본·C와 별도 hash");
  }
}

// 26. 단독 스탠드 칼라 E(P.62/P.146): B형 + 몸판에 적용된 앞중심→앞끝 실제 여밈 평행 연장
{
  BODICE = bodice("BH1");
  const E = CP.get("bunka-stand-collar-E");
  ok(E && E.baseMethod === "bunka-stand-collar-E-P146-v1" && E.construction.extendToFrontEdge === true &&
    J(E.standalone) === J({ collarWidthCm: 3.5, frontRiseCm: 0, topSetbackCm: 0.5 }), "26: E 레코드·B형 기초·앞끝 연장 규칙");
  const plan = CP.composeDraft(E.id, BODICE, DC), d = plan.draft;
  ok(plan.ok && Math.abs(d.standalone.measure.frontExtensionCm - 1.75) < 1e-12, "26: 몸판 placket.overlapCm 1.75를 실제 연장값으로 사용");
  if (plan.ok) {
    const an = d.standalone.anchors, u = an.guideDir;
    const dx = an.frontEdgeSeam.x - an.cfSeam.x, dy = an.frontEdgeSeam.y - an.cfSeam.y;
    ok(Math.abs(Math.hypot(dx, dy) - 1.75) < 1e-9 && Math.abs(dx * u.y - dy * u.x) < 1e-9,
      "26: 앞중심→앞끝은 달림선 방향 평행 연장");
    ok(d.standalone.geometry.outline.some(s => s.part === "front-extension") && d.standalone.geometry.outline.some(s => s.part === "outer-extension") &&
      Math.abs(d.standalone.measure.attachLenCm - d.standalone.measure.neckTargetCm) < 1e-9,
      "26: 연장분 출처 구분·목둘레 달림선에 미포함");
    const bDraft = CP.composeDraft("bunka-stand-collar-B", BODICE, DC).draft;
    ok(Math.abs((d.standalone.measure.outerLenCm - bDraft.standalone.measure.outerLenCm) - 1.75) < 1e-9 &&
      DC.validateClosedOutline(d.standalone.geometry.outline).ok, "26: B형 윗선도 같은 길이로 연장·폐곡선");
    PROJECT = project(d); const done = CC.complete(PROJECT);
    const bDone = CC.complete(project(bDraft));
    ok(done.ok && done.result.standalone.construction.extendToFrontEdge === true && done.result.hash !== bDone.result.hash,
      "26: E 완료본에 연장 규칙 고정·B와 별도 hash");
  }
  const noPlacket = bodice("BH2"); noPlacket.placket = null;
  const missing = CP.composeDraft(E.id, noPlacket, DC);
  ok(missing.ok === false && missing.reason === "front-extension-missing" && !("draft" in missing),
    "26: 앞여밈 없으면 임의 연장·B형 대체 없이 명시적 중단");
}

// 27. 단독 스탠드 칼라 F(P.62): 전용 몸판 목선(뒤2·SNP/앞3) + 폭3 + 외곽 0.2×3 벌림
{
  const F = CP.get("bunka-stand-collar-F");
  ok(F && F.baseMethod === "bunka-stand-collar-F-P146-v1" &&
    J(F.standalone) === J({ collarWidthCm: 3, frontRiseCm: 0, topSetbackCm: 0 }) &&
    J(F.construction) === J({ fitNeckSeam: false, baselineReductionCm: 0, guideRiseCm: 0,
      requiresNecklineProfile: "stand-f", slashSpreadCm: 0.2, slashCount: 3 }),
    "27: F 레코드·전용 목선·폭3·0.2×3 벌림 규칙");
  const rejected = CP.composeDraft(F.id, bodice("BH-normal"), DC);
  ok(rejected.ok === false && rejected.reason === "stand-f-neckline-required" && !("draft" in rejected),
    "27: 일반 목선에는 F를 자동 적용하지 않고 명시적 중단");
  BODICE = standFBodice("BH-F");
  const plan = CP.composeDraft(F.id, BODICE, DC);
  ok(plan.ok && plan.draft.type === "stand-collar", "27: F 전용 목선 완료본으로 draft 생성");
  if (plan.ok) {
    const d = plan.draft, m = d.standalone.measure, g = d.standalone.geometry;
    ok(Math.abs(m.attachLenCm - m.neckTargetCm) < 1e-6 && Math.abs(m.attachDiffCm) < 1e-6,
      "27: F 달림선 실측 = 완료 몸판 목둘레");
    ok(Math.abs(m.collarWidthCm - 3) < 1e-12 && Math.abs(m.spreadEachCm - 0.2) < 1e-12 &&
      m.spreadCount === 3 && Math.abs(m.totalSpreadCm - 0.6) < 1e-5,
      "27: 폭3·외곽 벌림 0.2cm×3 = 총 0.6cm");
    ok(g.construction.length === 3 && g.construction.every(s => s.kind === "line" && s.part === "slash-guide") &&
      DC.validateClosedOutline(g.outline).ok, "27: 3개 절개 안내선·폐곡선");
    ok(m.neckWidthCm === 3 && m.frontNeckDropCm === 3 && m.backNeckDropCm === 2,
      "27: 몸판 F 목선 이동값을 측정 근거로 보존");
    PROJECT = project(d); const done = CC.complete(PROJECT);
    ok(done.ok && done.result.presetId === F.id && done.result.standalone.construction.requiresNecklineProfile === "stand-f" &&
      done.result.standalone.measures.spreadCount === 3, "27: F 완료본에 목선 요구·벌림 근거 고정");
    ok(CC.isCurrentCollarChanged(PROJECT) === false && CC.complete(PROJECT).idempotent === true,
      "27: F 완료 직후 미변경·idempotent");
  }
}

// 28. L 실행 레코드·초안·완료본: family 2 안의 **몸판 연동 오픈 칼라**(G~K 와 생성 계약 분리)
{
  BODICE = bodice("BH1");
  const Lr = CP.get("bunka-shirt-collar-L"), G = CP.get("bunka-shirt-collar-G");
  ok(Lr && Lr.type === "shirt-open-collar" && Lr.baseMethod === "bunka-open-collar-L-v1" && Lr.familyId === ONE, "28: L 레코드 type·baseMethod·family");
  ok(J(Lr.openCollar) === J({ backCollarWidthCm: 3.5, collarStandCm: 3, frontEndRiseCm: 1, frontStraightCm: 4, breakPointDistanceCm: 8 }), "28: L 교재 수치(뒤 폭 3.5·허리 3·앞 끝 올림 1·앞 직선 4·꺾임 끝 8)");
  ok(!("onePiece" in Lr) && !("stand" in Lr) && !("body" in Lr) && !("standalone" in Lr), "28: L 은 한 장·밴드·단독 스탠드 섹션을 빌려오지 않는다");
  ok(CP.fields("openCollar").map(f => f.key).join() === Object.keys(Lr.openCollar).join(), "28: 필드 의미 순서 = 레코드 키 순서(엔진 계약)");
  ok(/P\.65/.test(Lr.source) && /몸판 연동|꺾임선/.test(Lr.description), "28: 출처·설명에 교재 P.65·몸판 연동 근거");

  const made = CP.composeDraft(Lr.id, BODICE, DC);
  ok(made.ok && made.draft.type === "shirt-open-collar" && made.draft.presetId === Lr.id && made.draft.baseMethod === Lr.baseMethod, "28: L draft 생성·출처 보존");
  ok(J(made.draft.parameters) === J({ openCollar: Lr.openCollar }) && made.draft.openCollar.geometry && made.draft.openCollar.bodyLink, "28: draft 파라미터·형상·몸판 연동 출처");
  ok(DC.validateClosedOutline(made.draft.openCollar.geometry.outline).ok
    && Math.abs(made.draft.openCollar.measure.attachLenCm - BODICE.necklineLengths.half) < 1e-6, "28: 폐곡선 + 달림선 실측 = 반패턴 목둘레(×+⊘)");
  ok(CP.matches(Lr.id, Lr.openCollar, null) && !CP.matches(Lr.id, Object.assign({}, Lr.openCollar, { frontStraightCm: 5 }), null), "28: preset 일치 판정");
  // 수정 후에도 레코드 원본 불변(deep clone 계약)
  made.draft.parameters.openCollar.collarStandCm = 9;
  ok(CP.get(Lr.id).openCollar.collarStandCm === 3 && Object.isFrozen(Lr.openCollar), "28: 편집값이 레코드를 오염시키지 않음");

  // 완료 스냅샷: 몸판 꺾임선까지 형상 identity 에 포함, 재완료 idempotent, G 와 분리
  const fresh = CP.composeDraft(Lr.id, BODICE, DC).draft;
  PROJECT = project(fresh);
  const done = CC.complete(PROJECT), again = CC.complete(PROJECT);
  ok(done.ok && done.result.type === "shirt-open-collar" && done.result.presetId === Lr.id && done.result.symmetry === "half-cb-fold" && Object.isFrozen(done.result), "28: L 완료 스냅샷(" + (done.reason || "") + ")");
  ok(done.ok && done.result.openCollar.bodyLink && done.result.openCollar.bodyLink.breakLine.length === 1, "28: 완료본에 몸판 꺾임선 출처 보존");
  ok(again.ok && again.idempotent === true && again.result.hash === done.result.hash && CC.isCurrentCollarChanged(PROJECT) === false, "28: 재완료 idempotent·직후 미변경");
  const gDone = CC.complete(project(CP.composeDraft(G.id, BODICE, DC).draft));
  ok(gDone.ok && gDone.result.hash !== done.result.hash, "28: L 과 G 완료 hash 분리");
  // 몸판 목둘레 **곡선**만 달라져도 형상 identity 가 바뀐다(몸판 연동 증거)
  const B2 = bodice("BH1");
  B2.front.outline[1] = { kind: "path", commands: [{ type: "M", points: [{ x: 40, y: 2 }] },
    { type: "C", points: [{ x: 37.5, y: 2 }, { x: 31.8, y: -1.6 }, { x: 29.2, y: -2.4 }] }], edge: "neckline" };
  BODICE = B2;
  const done2 = CC.complete(project(CP.composeDraft(Lr.id, B2, DC).draft));
  ok(done2.ok && done2.result.hash !== done.result.hash, "28: 몸판 목둘레 곡선이 달라지면 L hash 도 달라진다");
  BODICE = bodice("BH1");

  // 완료 게이트: 달림선 길이 책임·몸판 꺾임선 출처
  const broken = JSON.parse(J(fresh)); broken.openCollar.measure.attachLenCm += 0.5;
  ok(CC.check(project(broken)).fails.indexOf("attach-length-mismatch") >= 0, "28: 달림선 실측 ≠ 목둘레 → 완료 차단");
  const noLink = JSON.parse(J(fresh)); delete noLink.openCollar.bodyLink;
  ok(CC.check(project(noLink)).fails.indexOf("break-line-missing") >= 0, "28: 몸판 꺾임선 출처 없음 → 완료 차단");
  const noGeom = JSON.parse(J(fresh)); delete noGeom.openCollar.geometry;
  ok(CC.check(project(noGeom)).fails.indexOf("no-collar-piece") >= 0, "28: 칼라 형상 없음 → 완료 차단");

  // 레코드 검증(조용히 수용 금지)
  const bad = JSON.parse(J(Lr)); bad.id = "bad-l"; bad.openCollar.frontEndRiseCm = 7;
  throwsReason(() => CP.validateRecord(bad), "out-of-range", "28: 앞 끝 올림 ≥ 칼라 높이 레코드 거부");
  const bad2 = JSON.parse(J(Lr)); bad2.id = "bad-l2"; bad2.onePiece = { riseCm: 1 };
  throwsReason(() => CP.validateRecord(bad2), "mixed-record-sections", "28: 한 장 섹션 혼용 거부");
  const bad3 = JSON.parse(J(Lr)); bad3.id = "bad-l3"; delete bad3.openCollar.breakPointDistanceCm;
  throwsReason(() => CP.validateRecord(bad3), "bad-section-keys", "28: 필수 키 누락 거부");
  const bad4 = JSON.parse(J(CP.get("bunka-shirt-collar-G"))); bad4.id = "bad-g"; bad4.openCollar = { backCollarWidthCm: 3.5 };
  throwsReason(() => CP.validateRecord(bad4), "mixed-record-sections", "28: 한 장 레코드에 오픈 칼라 섹션 금지");
}

// 29. O 실행 레코드·초안·완료본: P.148 골격 + D(P.61) 기초선 옵션, M·N·P 서명 불변
{
  BODICE = bodice("BH1");
  const O = CP.get("bunka-band-collar-O"), M = CP.get("bunka-shirt-collar-M");
  ok(O && O.type === "shirt-two-piece" && O.baseMethod === M.baseMethod && O.familyId === "shirt-collar-with-band",
    "29: O 는 M·N·P 와 같은 P.148 제도법·family");
  ok(J(O.stand) === J({ bandWidthCm: 3, frontRiseCm: 8.5, frontEndCm: 0.5 })
    && J(O.body) === J({ gapCm: 14, cbWidthCm: 4, frontProjectionCm: 4, pointDiagonalCm: 6, outerBowCm: 0 }), "29: O 교재 수치(밴드 3·올림 8.5·간격 14·위 칼라 4·수평 4·사선 6)");
  ok(J(O.construction) === J({ baselineReductionCm: 2.5, guideRiseCm: 2 }), "29: O construction = 기초선 −2.5 · Ⓐ 2 올림");
  ok(/P\.67/.test(O.source) && /P\.61/.test(O.source) && /P\.146/.test(O.source), "29: 출처에 O(P.67)·D(P.61)·제도법(P.146) 근거");
  ok(!("construction" in M) && !("construction" in CP.get("bunka-band-collar-N")) && !("construction" in CP.get("bunka-band-collar-P")),
    "29: M·N·P 에는 construction 없음(기존 제도 그대로)");

  const made = CP.composeDraft(O.id, BODICE, DC);
  ok(made.ok && made.draft.presetId === O.id && J(made.draft.construction) === J(O.construction), "29: O draft 에 construction 보존");
  ok(Math.abs(made.draft.measure.baseLineLenCm - (BODICE.necklineLengths.half - 2.5)) < 1e-9
    && Math.abs(made.draft.measure.lowerNeckSeamLenCm - BODICE.necklineLengths.half) < 1e-6, "29: 기초선 = ×+⊘−2.5 · 달림선 = ×+⊘");
  ok(made.draft.measure.cbTrimCm > 0, "29: ⑭ 뒤 중심 보정이 잘라내는 방향(그린 길이 > 목둘레)");

  PROJECT = project(made.draft);
  const done = CC.complete(PROJECT), again = CC.complete(PROJECT);
  ok(done.ok && done.result.type === "shirt-two-piece" && J(done.result.stand.construction) === J(O.construction) && Object.isFrozen(done.result),
    "29: O 완료 스냅샷에 construction 보존(" + (done.reason || "") + ")");
  ok(again.ok && again.idempotent === true && CC.isCurrentCollarChanged(PROJECT) === false, "29: O 재완료 idempotent·직후 미변경");

  // ★ construction 은 형상 identity 에 포함된다 — 같은 stand/body 라도 옵션이 다르면 다른 hash
  const noCons = JSON.parse(J(made.draft)); delete noCons.construction;
  const stand2 = DC.computeStand(BODICE, noCons.parameters.stand);
  noCons.standGeometry = stand2.standGeometry;
  const body2 = DC.computeBody(stand2, noCons.body.parameters);
  noCons.body.geometry = body2.bodyGeometry; noCons.body.attachLenCm = body2.attachLenCm; noCons.body.measure = body2.measure;
  const doneNo = CC.complete(project(noCons));
  ok(doneNo.ok && doneNo.result.hash !== done.result.hash && doneNo.result.stand.construction === null, "29: 옵션 없는 같은 수치 초안과 hash 분리");

  // M·N·P 완료 hash 는 construction 도입과 무관(서명에서 키 자체가 없음)
  ["bunka-shirt-collar-M", "bunka-band-collar-N", "bunka-band-collar-P"].forEach(id => {
    const r = CC.complete(project(CP.composeDraft(id, BODICE, DC).draft));
    ok(r.ok && r.result.stand.construction === null, "29: " + id + " 완료본 construction null");
  });

  // 레코드 검증(조용히 수용 금지)
  const bad = JSON.parse(J(O)); bad.id = "bad-o"; bad.construction.baselineReductionCm = -1;
  throwsReason(() => CP.validateRecord(bad), "invalid-construction", "29: 음수 감산 거부");
  const bad2 = JSON.parse(J(O)); bad2.id = "bad-o2"; bad2.construction = { baselineReductionCm: 2.5 };
  throwsReason(() => CP.validateRecord(bad2), "invalid-construction", "29: 키 누락 거부");
  const bad3 = JSON.parse(J(O)); bad3.id = "bad-o3"; bad3.construction = { guideRiseCm: 2, baselineReductionCm: 2.5 };
  throwsReason(() => CP.validateRecord(bad3), "invalid-construction", "29: 키 순서 계약 위반 거부");
  const bad4 = JSON.parse(J(O)); bad4.id = "bad-o4"; bad4.construction.fitNeckSeam = true;
  throwsReason(() => CP.validateRecord(bad4), "invalid-construction", "29: 알 수 없는 옵션 키 거부");
}

// 30. Q 실행 레코드·초안·완료본: 수평 꺾임선 밴드 + 칼라 끝, M·N·O·P 불변
{
  BODICE = bodice("BH1");
  const Q = CP.get("bunka-band-collar-Q"), M = CP.get(CP.DEFAULT_ID);
  ok(Q && Q.type === "shirt-wing-collar" && Q.baseMethod === "bunka-wing-collar-Q-v1" && Q.familyId === "shirt-collar-with-band",
    "30: Q type·baseMethod·family(밴드 family 안의 별도 생성 계약)");
  ok(J(Q.stand) === J({ bandWidthCm: 3, frontRiseCm: 1, frontEndCm: 0.5 })
    && J(Q.tip) === J({ tipBaseCm: 7, tipSetbackCm: 1.5, tipEdgeCm: 4.5 }), "30: Q 교재 수치(밴드 3·올림 1·앞 끝선 0.5 · 끝 7·1.5·4.5)");
  ok(!("body" in Q) && !("construction" in Q) && !("onePiece" in Q), "30: Q 에는 위 칼라·D 방식 옵션·한 장 섹션이 없다");
  ok(CP.fields("tip").map(f => f.key).join() === Object.keys(Q.tip).join(), "30: 칼라 끝 필드 순서 = 레코드 키 순서(엔진 계약)");
  ok(/P\.68/.test(Q.source) && /P\.148/.test(Q.source), "30: 출처에 Q(P.68)·밴드 제도법(P.148)");
  ok(J(CP.WING_STAND_OPTIONS) === J({ horizontalTopLine: true }) && Object.isFrozen(CP.WING_STAND_OPTIONS), "30: 수평 꺾임선은 type 계약으로 동결 노출");

  const made = CP.composeDraft(Q.id, BODICE, DC);
  ok(made.ok && made.draft.type === "shirt-wing-collar" && made.draft.presetId === Q.id
    && J(made.draft.parameters) === J({ stand: Q.stand, tip: Q.tip }), "30: Q draft 파라미터·출처");
  ok(made.ok && made.draft.standGeometry && made.draft.tip && made.draft.tip.geometry && !("body" in made.draft), "30: 밴드 + 칼라 끝(위 칼라 없음)");
  // ★ 길이 책임: 밴드 달림선 = 반패턴 목둘레, 칼라 끝 세 수치는 실제 형상에서 일치
  ok(Math.abs(made.draft.measure.lowerNeckSeamLenCm - BODICE.necklineLengths.half) < 1e-6, "30: 달림선 실측 = ×+⊘");
  const tm = made.draft.tip.measure;
  ok(Math.abs(tm.foldBaseLenCm - 7) < 1e-6 && Math.abs(tm.tipEdgeLenCm - 4.5) < 1e-6 && Math.abs(tm.tipSetbackLenCm - 1.5) < 1e-6,
    "30: 칼라 끝 7·4.5·1.5 실측 일치");
  ok(CP.matches(Q.id, Q.stand, Q.tip) && !CP.matches(Q.id, Q.stand, Object.assign({}, Q.tip, { tipBaseCm: 8 })), "30: preset 일치 판정(밴드+끝)");

  PROJECT = project(made.draft);
  const done = CC.complete(PROJECT), again = CC.complete(PROJECT);
  ok(done.ok && done.result.type === "shirt-wing-collar" && Object.isFrozen(done.result)
    && J(done.result.tip.parameters) === J(Q.tip) && done.result.symmetry === "half-cb-fold", "30: Q 완료 스냅샷(" + (done.reason || "") + ")");
  ok(again.ok && again.idempotent === true && CC.isCurrentCollarChanged(PROJECT) === false, "30: Q 재완료 idempotent·직후 미변경");
  // 칼라 끝 수치만 바꿔도 형상 identity 가 달라진다
  const alt = JSON.parse(J(made.draft));
  const stAlt = DC.computeStand(BODICE, alt.parameters.stand, CP.WING_STAND_OPTIONS);
  alt.parameters.tip.tipBaseCm = 8;
  const tipAlt = DC.computeWingTip(stAlt, alt.parameters.tip);
  alt.tip.geometry = tipAlt.geometry; alt.tip.measure = tipAlt.measure;
  const doneAlt = CC.complete(project(alt));
  ok(doneAlt.ok && doneAlt.result.hash !== done.result.hash, "30: 칼라 끝 밑변이 다르면 hash 분리");
  // M·N·O·P 는 같은 세션에서 그대로 완료된다(밴드 2피스 경로 불변)
  ["bunka-shirt-collar-M", "bunka-band-collar-N", "bunka-band-collar-O", "bunka-band-collar-P"].forEach(id => {
    const r = CC.complete(project(CP.composeDraft(id, BODICE, DC).draft));
    ok(r.ok && r.result.type === "shirt-two-piece", "30: " + id + " 2피스 완료 유지");
  });

  // 레코드 검증(조용히 수용 금지)
  const bad = JSON.parse(J(Q)); bad.id = "bad-q"; bad.tip.tipEdgeCm = 1.5;
  throwsReason(() => CP.validateRecord(bad), "out-of-range", "30: 앞변 ≤ 수평 후퇴 거부(세로 성분 0)");
  const bad2 = JSON.parse(J(Q)); bad2.id = "bad-q2"; bad2.tip.tipBaseCm = 1;
  throwsReason(() => CP.validateRecord(bad2), "out-of-range", "30: 밑변 ≤ 수평 후퇴 거부");
  const bad3 = JSON.parse(J(Q)); bad3.id = "bad-q3"; bad3.stand.bandWidthCm = 1;
  throwsReason(() => CP.validateRecord(bad3), "out-of-range", "30: 밴드 폭 ≤ 앞 중심 올림 거부(수평 꺾임선 불가)");
  const bad4 = JSON.parse(J(Q)); bad4.id = "bad-q4"; bad4.body = { gapCm: 3 };
  throwsReason(() => CP.validateRecord(bad4), "mixed-record-sections", "30: 위 칼라 섹션 혼용 거부");
  const bad5 = JSON.parse(J(M)); bad5.id = "bad-m"; bad5.tip = { tipBaseCm: 7 };
  throwsReason(() => CP.validateRecord(bad5), "mixed-record-sections", "30: 2피스 레코드에 칼라 끝 섹션 금지");
  const bad6 = JSON.parse(J(Q)); bad6.id = "bad-q6"; delete bad6.tip.tipSetbackCm;
  throwsReason(() => CP.validateRecord(bad6), "bad-section-keys", "30: 칼라 끝 필수 키 누락 거부");
}

console.log("══════════════════════════════════════════════");
if (FAIL) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); }
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
if (FAIL) process.exitCode = 1;
