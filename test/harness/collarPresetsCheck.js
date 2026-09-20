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
  ok(Array.isArray(L) && L.length === 2 && Object.isFrozen(L), "1: 실행 레코드 2개(M·G)·목록 frozen");
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
  ok(J(M) === before && CP.list().length === 2 && Object.isFrozen(M.stand) && Object.isFrozen(M.body) && Object.isFrozen(M.neckline), "3: 레코드·섹션·목록 변경 불가");
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
  ok(J(o) === J([{ value: "bunka-shirt-collar-M", label: "교재 M 기본형" }, { value: "bunka-shirt-collar-G", label: "교재 G 기본형" }]), "5: 옵션 = registry 레코드(M·G)");
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

// 7. 완료본 provenance: presetId 보존(hash 제외)·legacy null·id 만 다르면 hash·stale·idempotency 불변
{
  BODICE = bodice("BH1");
  const d1 = CP.composeDraft(CP.DEFAULT_ID, BODICE, DC).draft;
  PROJECT = project(d1); const r1 = CC.complete(PROJECT);
  ok(r1.ok && r1.result.presetId === "bunka-shirt-collar-M" && r1.result.baseMethod === "bunka-shirt-collar-M-v2", "7: 완료본에 presetId 보존");
  PROJECT = project(legacyMDraft(BODICE)); const r0 = CC.complete(PROJECT);
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
  ok(F.filter(f => f.availability === "available").map(f => f.id).join() === "shirt-collar-one-piece,shirt-collar-with-band", "8: available family = 셔츠 칼라(G)·밴드 셔츠 칼라(M)");
  ok(F.every(f => f.availability === "available" ? typeof f.generator === "string" : f.generator === null), "8: generator 는 구현된 family 만");
  ok(F.filter(f => f.availability === "pending-source").every(f => f.note === CP.PENDING_NOTE) && F.filter(f => f.availability === "pending-source").length === 9, "8: 미구현 family 9개 안내 문구");
  const M = CP.family("shirt-collar-with-band");
  ok(M && CP.family("nope") === null && CP.family("__proto__") === null, "8: family 조회·알 수 없는 id null");
  try { F.push({}); } catch (_) {}
  try { M.variants.push({}); } catch (_) {}
  try { CP.family("stand-collar").page = 1; } catch (_) {}
  ok(CP.families().length === 11 && M.variants.length === 1 && CP.family("stand-collar").page === 60 && Object.isFrozen(M.variants), "8: catalog 변경 불가");
  ok(CP.families() === F, "8: families 결정론(같은 참조)");
  ok(CP.get(CP.DEFAULT_ID).familyId === "shirt-collar-with-band" && CP.DEFAULT_FAMILY_ID === "shirt-collar-with-band", "8: M 레코드 ↔ family 연결");
}
// 9. 스탠드 A~F 슬롯: 형상·수치 없음·전부 미구현
{
  const vs = CP.variants("stand-collar");
  ok(vs.length === 6 && J(vs.map(v => v.id)) === J(["A", "B", "C", "D", "E", "F"].map(x => "bunka-stand-collar-" + x)), "9: 스탠드 A~F 슬롯 6개");
  ok(vs.every(v => v.availability === "pending-source" && v.presetId === null && v.note === CP.PENDING_NOTE), "9: 전부 미구현·preset 없음");
  ok(vs.every(v => !("stand" in v) && !("body" in v) && !("parameters" in v) && !("geometry" in v)), "9: 수치·형상 데이터 없음");
  ok(CP.variants("hood").length === 0 && CP.variants("nope").length === 0 && Object.isFrozen(CP.variants("nope")), "9: 다른 미구현 family 는 빈 슬롯");
  ok(CP.variant("stand-collar", "bunka-stand-collar-A") === vs[0] && CP.variant("stand-collar", "nope") === null, "9: variant 조회");
  ok(J(CP.variantOptions("stand-collar")) === J(vs.map(v => ({ value: v.id, label: v.label, available: false }))), "9: 옵션 available:false");
  ok(J(CP.variantOptions("shirt-collar-with-band")) === J([{ value: "bunka-shirt-collar-M", label: "교재 M 기본형", available: true }]), "9: M variant 옵션");
  const fo = CP.familyOptions();
  ok(fo.length === 11 && fo[0].label === "스탠드 칼라 A (P60)" && fo[0].available === false && fo[2].available === true, "9: family 옵션(표식·페이지·availability)");
}
// 10. ★ 안전장치: 미구현·알 수 없음은 명시적 거부 — 절대 M 으로 fallback 하지 않는다
{
  ok(CP.resolve("shirt-collar-with-band", "bunka-shirt-collar-M").presetId === "bunka-shirt-collar-M", "10: M 해석 ok");
  const cases = [["stand-collar", "bunka-stand-collar-A", "collar-preset-unavailable"], ["stand-collar", "", "unknown-collar-variant"],
    ["hood", "", "unknown-collar-variant"], ["hood", "bunka-shirt-collar-M", "unknown-collar-variant"],
    ["nope", "bunka-shirt-collar-M", "unknown-collar-family"], ["shirt-collar-with-band", "", "unknown-collar-variant"],
    ["shirt-collar-with-band", null, "unknown-collar-variant"], ["stand-collar", "bunka-stand-collar-F", "collar-preset-unavailable"]];
  ok(cases.every(([f, v, r]) => { const res = CP.resolve(f, v); return res.ok === false && res.reason === r && !("presetId" in res); }), "10: 미구현·알 수 없음 거부(presetId 미부여)");
  ok(cases.every(([f, v]) => { const res = CP.resolve(f, v); return res.presetId !== CP.DEFAULT_ID; }), "10: DEFAULT_ID(M) fallback 없음");
  // 거부된 id 로 compose 를 시도해도 M 형상이 만들어지지 않는다
  BODICE = bodice("BH1");
  ok(["bunka-stand-collar-A", "", null, undefined].every(id => { const r = CP.composeDraft(id, BODICE, DC); return r.ok === false && !("draft" in r); }), "10: 미구현 id compose 거부(draft 없음)");
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
  c = cat(); c[0].generator = "made-up"; throwsReason(() => CP.buildCatalog(c, recs()), "invalid-generator", "11: 미구현 family 에 generator 금지");
  c = cat(); c[0].variants[0].availability = "available"; c[0].variants[0].presetId = "bunka-shirt-collar-M";
  throwsReason(() => CP.buildCatalog(c, recs()), "unavailable-family-variant", "11: 미구현 family 의 available variant 금지");
  c = cat(); c[2].variants[0].presetId = "nope"; throwsReason(() => CP.buildCatalog(c, recs()), "unknown-variant-preset", "11: 없는 preset 참조");
  c = cat(); c[0].variants[0].presetId = "bunka-shirt-collar-M"; throwsReason(() => CP.buildCatalog(c, recs()), "pending-variant-preset", "11: 미구현 variant 는 preset 없음");
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
  ok(J(noId) === J(legacyMDraft(BODICE)), "12: M draft 는 catalog 도입 후에도 byte-identical");
  PROJECT = project(d); const r = CC.complete(PROJECT);
  ok(r.ok && r.result.presetId === "bunka-shirt-collar-M" && r.result.hash === CC.complete(project(legacyMDraft(BODICE))).result.hash, "12: 완료 hash 불변");
}

// 13. 셔츠 칼라(한 장, family 2) G~L: 교재 순서·참고 도면 수치·전부 pending(적용 불가)
const ONE = "shirt-collar-one-piece";
{
  const f = CP.family(ONE);
  ok(f && f.order === 2 && f.symbol === "G" && f.page === 63 && f.availability === "available" && f.generator === "shirt-one-piece-v1", "13: family 2 셔츠 칼라(G 구현 후 available)");
  ok(f.reference && f.reference.methodPage === 147 && J(f.reference.pages) === J([63, 64, 65]) && /달림선 길이/.test(f.reference.attachLine) && /가봉/.test(f.reference.fitting), "13: family 참고 메모(제도법 P147·달림선 정합·가봉)");
  const vs = CP.variants(ONE);
  ok(J(vs.map(v => v.id)) === J(["G", "H", "I", "J", "K", "L"].map(x => "bunka-shirt-collar-" + x)), "13: G~L 교재 순서");
  ok(vs[0].availability === "available" && vs[0].presetId === "bunka-shirt-collar-G" && !("reference" in vs[0]), "13: G 만 실행 가능(참고값 아님 — 수치는 레코드가 출처)");
  ok(vs.slice(1).every(v => v.availability === "pending-source" && v.presetId === null && v.requiresMethodPage === 147), "13: H~L 은 계속 pending·preset 없음·P147 필요");
  ok(vs.every(v => !("stand" in v) && !("body" in v) && !("parameters" in v) && !("geometry" in v)), "13: 실행 수치·형상 없음(참고값과 분리)");
  ok(J(vs.map(v => v.page)) === J([63, 63, 64, 64, 65, 65]), "13: variant 페이지 G·H 63 / I·J 64 / K·L 65");
  // 사진에서 확인한 도면 수치(교차검증 대상)
  const ref = (x) => CP.variant(ONE, "bunka-shirt-collar-" + x).reference;
  ok(J(ref("H")) === J({ backCollarWidthCm: 3.5, frontCollarWidthCm: 6.5, collarStandCm: 1, riseCm: 8, frontEndMarkCm: 4.5, attachCurveMarkCm: 0.3, attachCurveDirection: "as-drawn" }), "13: H 허리 1·올림 8·앞표기 4.5·곡률 0.3");
  ok(J(ref("I")) === J({ backCollarWidthCm: 3.5, frontCollarWidthCm: 6.5, collarStandCm: 2, riseCm: 4.5, frontEndMarkCm: 3.5, attachCurveMarkCm: 0.3, attachCurveDirection: "as-drawn" }), "13: I 허리 2·올림 4.5·앞표기 3.5·곡률 0.3");
  ok(J(ref("J")) === J({ backCollarWidthCm: 3.5, frontCollarWidthCm: 6.5, collarStandCm: 4, riseCm: 1, frontEndMarkCm: 2.5, attachCurveMarkCm: null, attachCurveDirection: "as-drawn" }), "13: J 허리 4·올림 1·앞표기 2.5·곡률 표기 없음");
  ok(J(ref("K")) === J({ backCollarWidthCm: 3.5, frontCollarWidthCm: 6.5, collarStandCm: 2, riseCm: 4.5, frontEndMarkCm: 3.5, attachCurveMarkCm: 0.6, attachCurveDirection: "reversed" }), "13: K = I 치수 + 곡률 0.6 반대 방향");
  ok(J(ref("L")) === J({ backCollarWidthCm: 3.5, frontCollarWidthCm: null, collarStandCm: 3, riseCm: null, frontEndMarkCm: null, attachCurveMarkCm: null, attachCurveDirection: null }), "13: L 뒤 폭 3.5·허리 3 만(나머지 미확정)");
  ok(["H", "I", "J"].every(x => ref(x).backCollarWidthCm === 3.5 && ref(x).frontCollarWidthCm === 6.5)
    && CP.get("bunka-shirt-collar-G").onePiece.backCollarWidthCm === 3.5 && CP.get("bunka-shirt-collar-G").onePiece.frontCollarWidthCm === 6.5, "13: G~J 공통 폭 3.5/6.5(G 는 실행 레코드에서)");
  ok(/반대로/.test(CP.variant(ONE, "bunka-shirt-collar-K").referenceNote) && /몸판/.test(CP.variant(ONE, "bunka-shirt-collar-L").referenceNote) && /직선에 가까운/.test(CP.variant(ONE, "bunka-shirt-collar-J").referenceNote), "13: K·L·J 설명");
  // 불변
  try { ref("H").collarStandCm = 9; } catch (_) {}
  try { CP.variants(ONE).push({}); } catch (_) {}
  ok(ref("H").collarStandCm === 1 && CP.variants(ONE).length === 6 && Object.isFrozen(ref("H")), "13: 참고 수치 변경 불가");
}
// 14. 참고 수치 표시 행(실행값 아님) + 표기 없는 항목 제외
{
  const rows = CP.referenceRows(ONE, "bunka-shirt-collar-H");
  ok(rows.length === 6 && rows[0].key === "backCollarWidthCm" && rows[3].value === 8 && rows[5].value === 0.3 && rows.every(r => r.unit === "cm"), "14: H 표시 행 6개");
  ok(CP.referenceRows(ONE, "bunka-shirt-collar-G").length === 0, "14: G 는 실행 레코드라 참고 행 없음");
  ok(J(CP.referenceRows(ONE, "bunka-shirt-collar-J").map(r => r.key)) === J(["backCollarWidthCm", "frontCollarWidthCm", "collarStandCm", "riseCm", "frontEndMarkCm"]), "14: J 는 곡률 표기 없음 → 행 제외");
  const k = CP.referenceRows(ONE, "bunka-shirt-collar-K");
  ok(k[k.length - 1].key === "attachCurveDirection" && k[k.length - 1].text === "반대 방향", "14: K 곡선 방향 표시");
  ok(CP.referenceRows(ONE, "bunka-shirt-collar-L").length === 2, "14: L 은 확인된 두 수치만");
  ok(CP.referenceRows("shirt-collar-with-band", "bunka-shirt-collar-M").length === 0 && CP.referenceRows("nope", "x").length === 0, "14: 실행 preset·없는 선택은 참고 행 없음");
  ok(CP.referenceFields().map(f => f.key).join() === "backCollarWidthCm,frontCollarWidthCm,collarStandCm,riseCm,frontEndMarkCm,attachCurveMarkCm", "14: 참고 필드 의미 순서");
  ok(/의미 미확정/.test(CP.referenceFields()[4].label), "14: 앞쪽 표기는 의미 미확정으로 표기");
}
// 15. G~L 은 적용 불가 — M 으로 대체되지 않는다
{
  BODICE = bodice("BH1");
  const ids = ["H", "I", "J", "K", "L"].map(x => "bunka-shirt-collar-" + x);
  ok(ids.every(id => { const r = CP.resolve(ONE, id); return r.ok === false && r.reason === "collar-preset-unavailable" && !("presetId" in r); }), "15: H~L resolve 거부");
  ok(ids.every(id => { const r = CP.composeDraft(id, BODICE, DC); return r.ok === false && r.reason === "unknown-collar-preset" && !("draft" in r); }), "15: H~L compose 거부(G·M 형상 안 만듦)");
  ok(ids.every(id => CP.get(id) === null) && CP.list().length === 2, "15: H~L 은 실행 레코드가 아니다(레코드 = M·G 둘)");
  ok(J(CP.variantOptions(ONE)) === J(CP.variants(ONE).map((v, i) => ({ value: v.id, label: v.label, available: i === 0 })), "15: G 만 available"), "15: 옵션은 G 만 available");
}
// 16. 참고 수치 검증(조용히 수용 금지)
{
  const cat = () => JSON.parse(J(CP.families())), recs = () => JSON.parse(J(CP.list()));
  const one = (c) => c[1].variants[1];   // H = 참고 전용 variant
  const one0 = (c) => c[1].variants[1];   // H(참고 전용) 기준
  let c = cat(); one(c).reference.bogus = 1; throwsReason(() => CP.buildCatalog(c, recs()), "unknown-reference-key", "16: 알 수 없는 참고 키");
  c = cat(); one(c).reference.collarStandCm = "3"; throwsReason(() => CP.buildCatalog(c, recs()), "invalid-reference", "16: 문자열 수치");
  c = cat(); one(c).reference.riseCm = 0; throwsReason(() => CP.buildCatalog(c, recs()), "invalid-reference", "16: 0 이하 수치");
  c = cat(); one(c).reference.attachCurveDirection = "sideways"; throwsReason(() => CP.buildCatalog(c, recs()), "invalid-reference", "16: 알 수 없는 곡선 방향");
  c = cat(); delete one(c).requiresMethodPage; throwsReason(() => CP.buildCatalog(c, recs()), "reference-without-method-page", "16: 제도법 페이지 없는 참고값");
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
  ok(J(CP.variants("stand-collar").map(v => v.symbol)) === J(["A", "B", "C", "D", "E", "F"]) && title("stand-collar", "bunka-stand-collar-C") === "스탠드 칼라 C (교재 P60)", "17: 스탠드 A~F 표식");
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
  ok(near(an.cbFold.y, an.cbAttach.y - 3) && near(an.cbOuter.y, an.cbAttach.y - 3.5) && near(an.cbFold.x, 0) && near(an.cbOuter.x, 0), "18: 2-② CB 허리 3·뒤 폭 3.5");
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
  ok(bad({ collarStandCm: 3.5 }, "invalid-collar-stand") && bad({ collarStandCm: 0 }, "invalid-collar-stand"), "18: 칼라 허리 ≥ 뒤 폭 거부");
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

console.log("══════════════════════════════════════════════");
if (FAIL) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); }
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
if (FAIL) process.exitCode = 1;
