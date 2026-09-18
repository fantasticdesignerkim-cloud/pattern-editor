// ══════════════════════════════════════════════
// js/collarPresets.js — 카라 프리셋 registry(결정론적 코드 데이터, 단일 진실 원천).
//
// 새 카라를 추가할 때는 RECORDS 에 **검증된 레코드 하나**를 넣는다. 선택 UI 옵션·초기화 기본값·
// collarDraft 출처(presetId/baseMethod/type)는 전부 여기서 파생된다(ui.js·index.html 에 값 복제 금지).
//
// 계약:
//  - 레코드·목록은 deepFreeze(외부 변경 불가). 적용 시 편집값은 deep clone(사용자 수정이 원본 불변).
//  - 로드 시 검증: 중복 id / 필수 항목 누락 / 비유한·범위 밖 숫자는 즉시 throw(조용히 수용 안 함).
//  - 프리셋 identity(presetId)와 편집값(parameters)은 분리. identity 는 hash 입력이 아니다
//    (collarCheckpoint.signatureOf 는 parameters·geometry 만 서명한다).
//  - neckline 요구조건은 **메타데이터만** 기록한다. 카라 단계는 완료된 몸판을 변경하지 않는다.
//  - stand/body 기본값의 키 순서는 기존 계약(collarCheckpoint 서명 JSON)과 동일하게 유지한다.
//  - DOM·storage 미접근(순수). composeDraft 는 designCollar 를 인자로 받는다.
// ══════════════════════════════════════════════
(function () {
  "use strict";

  // 섹션별 편집 필드(키 순서 = 기존 parameters 키 순서). min/minExclusive 는 엔진 실패 계약과 같은 하한.
  var STAND_FIELDS = [
    { key: "standHeightCm", label: "밴드 폭", unit: "cm", min: 0, minExclusive: true },
    { key: "frontRiseCm", label: "CF 앞끝 올림", unit: "cm", min: 0 }
  ];
  var BODY_FIELDS = [
    { key: "gapCm", label: "위칼라 gap(CB)", unit: "cm", min: 0, minExclusive: true },
    { key: "cbWidthCm", label: "위칼라 CB 폭", unit: "cm", min: 0, minExclusive: true },
    { key: "frontInsetCm", label: "setback(밴드 위선 CF→CB)", unit: "cm", min: 0 },
    { key: "frontProjectionCm", label: "수평 돌출", unit: "cm", min: 0 },
    { key: "pointDiagonalCm", label: "끝 사선", unit: "cm", min: 0, minExclusive: true },
    { key: "outerBowCm", label: "외곽 휨", unit: "cm" }
  ];

  var RECORDS = [
    {
      id: "bunka-shirt-collar-M",
      label: "교재 M 기본형",
      description: "2피스 셔츠 칼라(밴드 + 위칼라) 교재 M형 제도 기본값",
      source: "『パターン製作の基礎』 셔츠 칼라 M형",
      type: "shirt-two-piece",
      baseMethod: "bunka-shirt-collar-M-v2",
      // 몸판 셔츠 목선 전제(앞·뒤 SNP +1·앞 FNP 1 내림)는 몸판 네크라인 단계의 별도 프리셋이다.
      //   여기서는 기록만 한다 — 카라 적용이 bodiceResult 를 확인·변경하지 않는다.
      neckline: { requiredType: "shirt", enforcement: "metadata-only" },
      stand: { standHeightCm: 3, frontRiseCm: 1 },
      body: { gapCm: 3, cbWidthCm: 4, frontInsetCm: 0.5, frontProjectionCm: 1.5, pointDiagonalCm: 6, outerBowCm: 0 }
    }
  ];

  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function deepFreeze(o) {
    if (o && typeof o === "object" && !Object.isFrozen(o)) { Object.freeze(o); Object.keys(o).forEach(function (k) { deepFreeze(o[k]); }); }
    return o;
  }
  function fail(reason, detail) { var e = new Error("collar-preset: " + reason + (detail ? " (" + detail + ")" : "")); e.reason = reason; e.detail = detail; throw e; }
  function isStr(v) { return typeof v === "string" && v.length > 0; }

  function validateSection(sec, fields, name, id) {
    if (!sec || typeof sec !== "object") fail("missing-section", id + "." + name);
    var keys = Object.keys(sec), want = fields.map(function (f) { return f.key; });
    if (keys.length !== want.length || keys.some(function (k, i) { return k !== want[i]; })) fail("bad-section-keys", id + "." + name);
    fields.forEach(function (f) {
      var v = sec[f.key];
      if (typeof v !== "number" || !isFinite(v)) fail("invalid-number", id + "." + name + "." + f.key);
      if (f.min !== undefined && (f.minExclusive ? v <= f.min : v < f.min)) fail("out-of-range", id + "." + name + "." + f.key);
    });
  }
  // 한 레코드 검증(순수). 실패 시 throw(reason 포함).
  function validateRecord(r) {
    if (!r || typeof r !== "object") fail("invalid-record");
    ["id", "label", "description", "source", "type", "baseMethod"].forEach(function (k) { if (!isStr(r[k])) fail("missing-field", (r.id || "?") + "." + k); });
    if (!r.neckline || !isStr(r.neckline.requiredType) || r.neckline.enforcement !== "metadata-only") fail("invalid-neckline", r.id);
    validateSection(r.stand, STAND_FIELDS, "stand", r.id);
    validateSection(r.body, BODY_FIELDS, "body", r.id);
    if (!(r.body.pointDiagonalCm > r.body.frontProjectionCm)) fail("out-of-range", r.id + ".body.pointDiagonalCm");   // 엔진 계약: 사선 > 돌출
    return true;
  }
  // 레코드 배열 → 동결 registry(순수). 중복 id·빈 목록은 throw.
  function buildRegistry(records) {
    if (!Array.isArray(records) || records.length === 0) fail("empty-registry");
    var seen = {};
    records.forEach(function (r) { validateRecord(r); if (seen[r.id]) fail("duplicate-id", r.id); seen[r.id] = true; });
    var list = deepFreeze(clone(records));
    var byId = {}; list.forEach(function (r) { byId[r.id] = r; });
    return { list: list, byId: Object.freeze(byId) };
  }

  var REG = buildRegistry(RECORDS);
  var DEFAULT_ID = REG.list[0].id;

  function list() { return REG.list; }                                   // 동결 배열(정의 순서, 결정론)
  function get(id) { return Object.prototype.hasOwnProperty.call(REG.byId, id) ? REG.byId[id] : null; }
  // 편집용 기본값(deep clone). 알 수 없는 id 는 거부.
  function defaults(id) {
    var r = get(id); if (!r) return { ok: false, reason: "unknown-collar-preset" };
    return { ok: true, id: r.id, stand: clone(r.stand), body: clone(r.body) };
  }
  // 선택 UI 옵션 모델(registry 에서 생성).
  function options() { return REG.list.map(function (r) { return { value: r.id, label: r.label }; }); }
  // 섹션 필드 의미·단위(표시용).
  function fields(section) { return clone(section === "stand" ? STAND_FIELDS : section === "body" ? BODY_FIELDS : []); }
  // 편집값이 프리셋 기본값과 같은지(표시 판단용, 저장 없음).
  function matches(id, stand, body) {
    var r = get(id); if (!r) return false;
    var eq = function (a, b, fs) { return !!a && fs.every(function (f) { return a[f.key] === b[f.key]; }); };
    return eq(stand, r.stand, STAND_FIELDS) && eq(body, r.body, BODY_FIELDS);
  }
  // 프리셋 전체 적용 계획(순수·원자): 스탠드·본체를 모두 계산·검증한 뒤 새 collarDraft 를 반환한다.
  //   호출부가 ok 일 때만 한 번에 교체한다(실패 시 기존 상태 불변). designCollar 는 인자로 받는다.
  function composeDraft(id, bodice, DC) {
    var d = defaults(id); if (!d.ok) return d;
    var r = get(id);
    if (!DC || !bodice) return { ok: false, stage: "stand", reason: "no-bodice" };
    var standRe = DC.computeStand(bodice, d.stand);
    if (!standRe.ok) return { ok: false, stage: "stand", reason: standRe.reason };
    var bodyRe = DC.computeBody(standRe, d.body);
    if (!bodyRe.ok) return { ok: false, stage: "body", reason: bodyRe.reason };
    return { ok: true, draft: {
      sourceBodiceHash: bodice.hash, type: r.type, baseMethod: r.baseMethod, presetId: r.id,
      parameters: { stand: d.stand },
      standGeometry: standRe.standGeometry, standAnchors: standRe.anchors, collarGeometry: null,   // standAnchors·body.anchors = 표시 전용(hash 미포함)
      body: { parameters: d.body, geometry: bodyRe.bodyGeometry, attachLenCm: bodyRe.attachLenCm, measure: bodyRe.measure, anchors: bodyRe.anchors },
      measure: {
        lowerNeckSeamLenCm: standRe.lowerNeckSeamLenCm, lowerExtensionLenCm: standRe.lowerExtensionLenCm,
        upperNeckSegmentLenCm: standRe.upperNeckSegmentLenCm, upperExtensionLenCm: standRe.upperExtensionLenCm,
        upperTotalLenCm: standRe.upperTotalLenCm, backNeckLenCm: standRe.backNeckLenCm, frontNeckLenCm: standRe.frontNeckLenCm
      }
    } };
  }

  window.collarPresets = Object.freeze({
    DEFAULT_ID: DEFAULT_ID,
    list: list, get: get, defaults: defaults, options: options, fields: fields, matches: matches, composeDraft: composeDraft,
    validateRecord: validateRecord, buildRegistry: buildRegistry   // 순수(하네스·향후 레코드 추가 검증)
  });
})();
