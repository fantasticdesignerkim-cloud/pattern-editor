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
//  - catalog(family/variant) 층은 교재 분류 표시·선택용이다. **미구현 family/variant 는 형상·수치를 갖지
//    않으며, resolve() 가 명시적으로 거부한다 — 어떤 경로에서도 DEFAULT_ID(M) 로 fallback 하지 않는다.**
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

  // ── 교재 카라 분류 catalog(family 층) ──
  //   교재 순서(order)·표식(symbol)·페이지(page)를 그대로 보존한다. family = 생성 구조(generator)의 단위이며,
  //   수치 차이가 아니라 제도 방식이 다르면 다른 family 다. **검증된 제도 자료가 온 family 만 available**,
  //   나머지는 "pending-source"(형상·수치 없음 — 표시 슬롯만). variant 는 family 안의 세부 제도형이고,
  //   available variant 만 presetId 로 RECORDS 의 레코드를 가리킨다(미구현 variant 의 presetId 는 null).
  var PENDING_NOTE = "제도 자료 확인 후 제공";
  // 참고 도면 수치(source facts)는 **실행 기본값이 아니다** — 교재 도면에서 읽은 치수를 기록만 한다.
  //   제도 절차(교재 P.147)가 없으면 이 수치로 형상을 만들지 않는다(variant 는 pending 유지).
  var METHOD_PAGE = 147;
  var PENDING_SHORT = "준비 중";        // select 옵션용 짧은 표식(전체 안내는 PENDING_NOTE)
  function pendingVariant(id, label) { return { id: id, label: label, availability: "pending-source", presetId: null, note: PENDING_NOTE }; }
  // 참고 도면 수치 표시 순서·의미(라벨). frontEndMark 는 **도면 표기이고 기하학적 의미는 미확정**이라 그대로 적는다.
  var REFERENCE_FIELDS = [
    { key: "backCollarWidthCm", label: "뒤 칼라 폭", unit: "cm" },
    { key: "frontCollarWidthCm", label: "앞 칼라 폭", unit: "cm" },
    { key: "collarStandCm", label: "칼라 허리", unit: "cm" },
    { key: "riseCm", label: "올림 치수(★)", unit: "cm" },
    { key: "frontEndMarkCm", label: "도면 앞쪽 표기(의미 미확정)", unit: "cm" },
    { key: "attachCurveMarkCm", label: "달림선 곡률 표기", unit: "cm" }
  ];
  var ONEPIECE_NOTES = {
    "bunka-shirt-collar-J": "달림선은 직선에 가까운 완만한 곡선(도면에 곡률 표기 없음)",
    "bunka-shirt-collar-K": "I 와 같은 치수, 앞 달림선 곡선을 반대로 그려 칼라 허리 부분을 늘린다",
    "bunka-shirt-collar-L": "몸판 목둘레와 앞 꺾임선을 먼저 그린 뒤 그 치수로 제도(몸판 연동) · 도면 표기 4·1, 몸판 앞 꺾임 끝 8·4 는 의미 미확정"
  };
  // 셔츠 칼라(한 장) variant: 참고 도면 수치만 싣고 실행 기본값·생성기는 두지 않는다.
  function onePieceVariant(id, label, page, ref) {
    var v = pendingVariant(id, label);
    v.page = page;
    v.reference = ref;
    v.requiresMethodPage = METHOD_PAGE;   // 전체 제도법이 오기 전에는 적용 불가
    if (ONEPIECE_NOTES[id]) v.referenceNote = ONEPIECE_NOTES[id];
    return v;
  }
  var CATALOG = [
    // 스탠드 family: 교재에 A~F 세부형이 있으나 제도 수치·방식은 아직 확인 전이라 슬롯만 둔다(형상·수치 없음).
    { id: "stand-collar", order: 1, label: "스탠드 칼라", symbol: "A", page: 60, generator: null, availability: "pending-source", note: PENDING_NOTE,
      variants: ["A", "B", "C", "D", "E", "F"].map(function (v) { return pendingVariant("bunka-stand-collar-" + v, v + "형"); }) },
    // 셔츠 칼라(한 장 구조): 달림선·칼라 허리·꺾임선·외곽선·칼라 끝이 한 조각. family 3(M, 밴드+위칼라 2피스)와
    //   생성 구조가 다르다. G~J 는 앞뒤 칼라 폭을 고정한 채 칼라 허리·올림(★)만 바꿔 비교한 계열,
    //   K 는 I 의 앞 달림선 곡선을 반대로 그린 변형, L 은 꺾임선을 앞중심에서 떨어뜨린 오픈 칼라(몸판 연동).
    //   ★ 도면 치수는 확인했으나 **제도 절차(P.147)가 없어 전부 pending** — 아래 reference 는 참고값이다.
    { id: "shirt-collar-one-piece", order: 2, label: "셔츠 칼라", symbol: "G", page: 63, generator: null, availability: "pending-source", note: PENDING_NOTE,
      reference: {
        pages: [63, 64, 65], methodPage: METHOD_PAGE,
        structure: "한 장 구조(달림선·칼라 허리·꺾임선·외곽선·칼라 끝)",
        attachLine: "달림선 길이 = 몸판 뒤목(×) + 앞목(⊘)",
        commonWidths: "G~J 공통 뒤 칼라 폭 3.5cm · 앞 칼라 폭 6.5cm",
        fitting: "수치를 바꾸면 칼라 외곽 치수가 부족·과다해 가봉 필요(교재 본문)"
      },
      variants: [
        onePieceVariant("bunka-shirt-collar-G", "G · 칼라 허리 3cm", 63, { backCollarWidthCm: 3.5, frontCollarWidthCm: 6.5, collarStandCm: 3, riseCm: 2.5, frontEndMarkCm: 3, attachCurveMarkCm: 0.2, attachCurveDirection: "as-drawn" }),
        onePieceVariant("bunka-shirt-collar-H", "H · 칼라 허리 1cm", 63, { backCollarWidthCm: 3.5, frontCollarWidthCm: 6.5, collarStandCm: 1, riseCm: 8, frontEndMarkCm: 4.5, attachCurveMarkCm: 0.3, attachCurveDirection: "as-drawn" }),
        onePieceVariant("bunka-shirt-collar-I", "I · 칼라 허리 2cm", 64, { backCollarWidthCm: 3.5, frontCollarWidthCm: 6.5, collarStandCm: 2, riseCm: 4.5, frontEndMarkCm: 3.5, attachCurveMarkCm: 0.3, attachCurveDirection: "as-drawn" }),
        onePieceVariant("bunka-shirt-collar-J", "J · 칼라 허리 4cm", 64, { backCollarWidthCm: 3.5, frontCollarWidthCm: 6.5, collarStandCm: 4, riseCm: 1, frontEndMarkCm: 2.5, attachCurveMarkCm: null, attachCurveDirection: "as-drawn" }),
        onePieceVariant("bunka-shirt-collar-K", "K · 앞 달림선 곡선 반대", 65, { backCollarWidthCm: 3.5, frontCollarWidthCm: 6.5, collarStandCm: 2, riseCm: 4.5, frontEndMarkCm: 3.5, attachCurveMarkCm: 0.6, attachCurveDirection: "reversed" }),
        onePieceVariant("bunka-shirt-collar-L", "L · 오픈 칼라", 65, { backCollarWidthCm: 3.5, frontCollarWidthCm: null, collarStandCm: 3, riseCm: null, frontEndMarkCm: null, attachCurveMarkCm: null, attachCurveDirection: null })
      ] },
    // 구현된 유일한 family: 밴드 + 위칼라 2피스(designCollar.computeStand/computeBody).
    { id: "shirt-collar-with-band", order: 3, label: "칼라 밴드 달린 셔츠 칼라", symbol: "M", page: 66, generator: "shirt-collar-with-band-v2", availability: "available", note: null,
      variants: [{ id: "bunka-shirt-collar-M", label: "교재 M 기본형", availability: "available", presetId: "bunka-shirt-collar-M", note: null }] },
    { id: "flat-collar", order: 4, label: "플랫 칼라", symbol: "S", page: 69, generator: null, availability: "pending-source", note: PENDING_NOTE, variants: [] },
    { id: "sailor-collar", order: 5, label: "세일러 칼라", symbol: "U", page: 70, generator: null, availability: "pending-source", note: PENDING_NOTE, variants: [] },
    { id: "bow-collar", order: 6, label: "보 칼라", symbol: "X", page: 71, generator: null, availability: "pending-source", note: PENDING_NOTE, variants: [] },
    { id: "frill-collar", order: 7, label: "프릴 칼라", symbol: "a", page: 72, generator: null, availability: "pending-source", note: PENDING_NOTE, variants: [] },
    { id: "hood", order: 8, label: "후드", symbol: "d", page: 74, generator: null, availability: "pending-source", note: PENDING_NOTE, variants: [] },
    { id: "tailored-collar", order: 9, label: "테일러드 칼라", symbol: "h", page: 78, generator: null, availability: "pending-source", note: PENDING_NOTE, variants: [] },
    { id: "shawl-collar", order: 10, label: "숄 칼라", symbol: "j", page: 80, generator: null, availability: "pending-source", note: PENDING_NOTE, variants: [] },
    { id: "high-neck", order: 11, label: "하이넥", symbol: "l", page: 82, generator: null, availability: "pending-source", note: PENDING_NOTE, variants: [] }
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
      familyId: "shirt-collar-with-band",   // catalog family(생성 구조) 연결. 값·키 순서·hash 와 무관한 메타.
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
    ["id", "label", "description", "source", "type", "baseMethod", "familyId"].forEach(function (k) { if (!isStr(r[k])) fail("missing-field", (r.id || "?") + "." + k); });
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

  // ── catalog 검증·구성(순수) ── 교재 순서 1..N 연속·고유, 표식·페이지 필수, id 전역 고유(family/variant),
  //   available variant 만 실제 레코드를 가리키고, pending 은 presetId null·형상/수치 키 없음.
  var AVAIL = { available: 1, "pending-source": 1 };
  var SHAPE_KEYS = ["stand", "body", "parameters", "geometry"];
  var REFERENCE_KEYS = REFERENCE_FIELDS.map(function (f) { return f.key; }).concat(["attachCurveDirection"]);
  var CURVE_DIR = { "as-drawn": 1, reversed: 1 };
  // variant 참고 도면 수치: 알려진 키만, 값은 유한 숫자 또는 null(도면에 표기 없음). 형상·실행 데이터 금지.
  function validateVariantReference(v) {
    var ref = v.reference;
    if (ref === undefined) return;
    if (!ref || typeof ref !== "object" || Array.isArray(ref)) fail("invalid-reference", v.id);
    Object.keys(ref).forEach(function (k) {
      if (REFERENCE_KEYS.indexOf(k) < 0) fail("unknown-reference-key", v.id + "." + k);
      var val = ref[k];
      if (k === "attachCurveDirection") { if (!(val === null || CURVE_DIR[val])) fail("invalid-reference", v.id + "." + k); return; }
      if (!(val === null || (typeof val === "number" && isFinite(val) && val > 0))) fail("invalid-reference", v.id + "." + k);
    });
    if (typeof v.requiresMethodPage !== "number" || v.requiresMethodPage <= 0) fail("reference-without-method-page", v.id);
    if (v.availability !== "pending-source") fail("reference-on-available-variant", v.id);   // 참고값은 실행값이 아니다
  }
  // family 참고 메모: 문자열·유한 숫자·숫자 배열만(형상 키 금지).
  function validateFamilyReference(f) {
    var ref = f.reference;
    if (ref === undefined) return;
    if (!ref || typeof ref !== "object" || Array.isArray(ref)) fail("invalid-reference", f.id);
    Object.keys(ref).forEach(function (k) {
      if (SHAPE_KEYS.indexOf(k) >= 0) fail("invalid-reference", f.id + "." + k);
      var val = ref[k];
      var okVal = isStr(val) || (typeof val === "number" && isFinite(val))
        || (Array.isArray(val) && val.length > 0 && val.every(function (n) { return typeof n === "number" && isFinite(n); }));
      if (!okVal) fail("invalid-reference", f.id + "." + k);
    });
  }
  function validateFamily(f, presetIds, seenId, expectOrder) {
    if (!f || typeof f !== "object") fail("invalid-family");
    ["id", "label", "symbol"].forEach(function (k) { if (!isStr(f[k])) fail("missing-field", (f.id || "?") + "." + k); });
    if (f.order !== expectOrder) fail("bad-book-order", f.id);
    if (typeof f.page !== "number" || !isFinite(f.page) || f.page <= 0 || f.page !== Math.round(f.page)) fail("invalid-page", f.id);
    if (!AVAIL[f.availability]) fail("invalid-availability", f.id);
    if (f.availability === "available" ? !isStr(f.generator) : f.generator !== null) fail("invalid-generator", f.id);
    if (seenId[f.id]) fail("duplicate-id", f.id); seenId[f.id] = true;
    if (!Array.isArray(f.variants)) fail("invalid-variants", f.id);
    validateFamilyReference(f);
    var anyAvail = false;
    f.variants.forEach(function (v) {
      if (!v || !isStr(v.id) || !isStr(v.label)) fail("missing-field", f.id + ".variant");
      if (seenId[v.id]) fail("duplicate-id", v.id); seenId[v.id] = true;
      if (!AVAIL[v.availability]) fail("invalid-availability", v.id);
      SHAPE_KEYS.forEach(function (k) { if (k in v) fail("variant-shape-data", v.id); });   // 실행 수치·형상은 catalog 에 두지 않는다
      validateVariantReference(v);
      if (v.availability === "available") {
        if (f.availability !== "available") fail("unavailable-family-variant", v.id);
        if (!isStr(v.presetId) || !presetIds[v.presetId]) fail("unknown-variant-preset", v.id);
        anyAvail = true;
      } else if (v.presetId !== null) fail("pending-variant-preset", v.id);
    });
    if (f.availability === "available" && !anyAvail) fail("available-family-without-preset", f.id);
    return true;
  }
  function buildCatalog(families, records) {
    if (!Array.isArray(families) || families.length === 0) fail("empty-catalog");
    var presetIds = {}; (records || []).forEach(function (r) { presetIds[r.id] = 1; });
    var seenId = {};
    families.forEach(function (f, i) { validateFamily(f, presetIds, seenId, i + 1); });
    (records || []).forEach(function (r) {
      var f = families.filter(function (x) { return x.id === r.familyId; })[0];
      if (!f) fail("unknown-preset-family", r.id);
      if (!f.variants.some(function (v) { return v.presetId === r.id; })) fail("preset-without-variant", r.id);
    });
    var list = deepFreeze(clone(families));
    var byId = {}; list.forEach(function (f) { byId[f.id] = f; });
    return { list: list, byId: Object.freeze(byId) };
  }

  var REG = buildRegistry(RECORDS);
  var CAT = buildCatalog(CATALOG, RECORDS);
  var DEFAULT_ID = REG.list[0].id;
  var DEFAULT_FAMILY_ID = REG.list[0].familyId;

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

  // ── catalog 조회(전부 동결 데이터 반환) ──
  var EMPTY = Object.freeze([]);
  function families() { return CAT.list; }                               // 교재 순서(order 1..N)
  function family(id) { return Object.prototype.hasOwnProperty.call(CAT.byId, id) ? CAT.byId[id] : null; }
  function variants(familyId) { var f = family(familyId); return f ? f.variants : EMPTY; }
  function variant(familyId, variantId) {
    var vs = variants(familyId);
    for (var i = 0; i < vs.length; i++) if (vs[i].id === variantId) return vs[i];
    return null;
  }
  // 종류 select 옵션(교재 표식·페이지 포함, 미구현은 available:false).
  function familyOptions() {
    return CAT.list.map(function (f) { return { value: f.id, label: f.label + " " + f.symbol + " (P" + f.page + ")", available: f.availability === "available" }; });
  }
  // 세부 제도 select 옵션. 미구현 family 는 슬롯만(available:false) 또는 빈 목록.
  function variantOptions(familyId) {
    return variants(familyId).map(function (v) { return { value: v.id, label: v.label, available: v.availability === "available" }; });
  }
  // 참고 도면 수치 표시 행(순수). 표기가 없는 항목(null)은 내보내지 않는다. **실행값이 아니다.**
  function referenceRows(familyId, variantId) {
    var v = variant(familyId, variantId);
    if (!v || !v.reference) return EMPTY;
    var rows = [];
    REFERENCE_FIELDS.forEach(function (f) {
      var val = v.reference[f.key];
      if (typeof val === "number") rows.push({ key: f.key, label: f.label, value: val, unit: f.unit });
    });
    if (v.reference.attachCurveDirection === "reversed") rows.push({ key: "attachCurveDirection", label: "앞 달림선 곡선", value: null, unit: null, text: "반대 방향" });
    return Object.freeze(rows);
  }

  // ★ 안전장치: (family, variant) → preset id 해석. **미구현·알 수 없음은 명시적으로 거부**하며
  //   절대 DEFAULT_ID(M) 로 대체하지 않는다. 호출부는 ok 일 때만 composeDraft 한다.
  function resolve(familyId, variantId) {
    var f = family(familyId); if (!f) return { ok: false, reason: "unknown-collar-family" };
    if (variantId === undefined || variantId === null || variantId === "") return { ok: false, reason: "unknown-collar-variant" };
    var v = variant(familyId, variantId); if (!v) return { ok: false, reason: "unknown-collar-variant" };
    if (f.availability !== "available" || v.availability !== "available" || !v.presetId || !get(v.presetId)) return { ok: false, reason: "collar-preset-unavailable" };
    return { ok: true, familyId: f.id, variantId: v.id, presetId: v.presetId };
  }

  window.collarPresets = Object.freeze({
    DEFAULT_ID: DEFAULT_ID, DEFAULT_FAMILY_ID: DEFAULT_FAMILY_ID, PENDING_NOTE: PENDING_NOTE, PENDING_SHORT: PENDING_SHORT,
    list: list, get: get, defaults: defaults, options: options, fields: fields, matches: matches, composeDraft: composeDraft,
    families: families, family: family, variants: variants, variant: variant,
    familyOptions: familyOptions, variantOptions: variantOptions, resolve: resolve, referenceRows: referenceRows, referenceFields: function () { return clone(REFERENCE_FIELDS); },
    validateRecord: validateRecord, buildRegistry: buildRegistry,   // 순수(하네스·향후 레코드 추가 검증)
    validateFamily: validateFamily, buildCatalog: buildCatalog
  });
})();
