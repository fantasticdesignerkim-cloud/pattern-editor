// ══════════════════════════════════════════════════════════════════════════════
// sleevePresets.js — 소매 라인 카탈로그 ([패턴학교] 기초 강의 2 「소매 패턴」, P.36–37 개요)
//
// 몸판(bodicePresets.js)·칼라(collarPresets.js)와 같은 구조다: family(교시 = 소매 종류) → variant(교재 표식) → record.
// ★ 소매 기호 Ⓐ~Ⓩ 는 몸판 `bunka-bodice-*` 와 **다른 네임스페이스**다(docs/book/P036.md) — id 는 `bunka-sleeve-*`.
// ★ 소매 10종류의 이름·시작 쪽·표지 기호는 P036 판독 표만 근거다. 아직 판독하지 않은 라인의 변형(Ⓑ 다음 기호 등)은
//   **슬롯을 만들지 않는다** — 표지 대표 기호 하나만 «보류»로 두고, 왜 못 만드는지(blockedBy)를 들고 있게 한다.
//
// 지금 실행 가능한 것은 **스트레이트 Ⓐ · 타이트 Ⓑ · Ⓒ · 플레어 Ⓓ · Ⓔ · 턱 Ⓕ 여섯 개**다(Ⓒ = 뒤 소맷부리 다트, `designSleeveC`). Ⓑ(P.41)는 Ⓐ 를 출발 원형으로 소맷부리를 W×3/4 로 맞댄다(`designSleeveB`).
// 그중 Ⓐ 는: 완성한 몸판의 진동둘레(다트 닫은 봉제 상태)에서 소매산을 제도한다
//   (`designSleeveA.draftSleeveA`, [패턴학교] P.137–139 «타입 4»). 이 레코드는 수치를 갖지 않는다 — 소매 길이만
//   사용자가 정하고 나머지는 전부 몸판에서 읽는다. 순수(DOM·storage 미접근).
//
// 미구현 슬롯은 `resolve()` 가 **명시적으로 거부**한다. 어떤 경로에서도 Ⓐ 나 기본 소매로 대체하지 않는다.
// ══════════════════════════════════════════════════════════════════════════════
(function () {
  "use strict";

  function fail(reason, detail) {
    var e = new Error("sleevePresets: " + reason);
    e.reason = reason;
    if (detail !== undefined) e.detail = detail;
    throw e;
  }
  function clone(v) {
    if (v === null || typeof v !== "object") return v;
    if (typeof structuredClone === "function") return structuredClone(v);
    return JSON.parse(JSON.stringify(v));
  }
  function deepFreeze(o) {
    if (!o || typeof o !== "object" || Object.isFrozen(o)) return o;
    Object.freeze(o);
    Object.keys(o).forEach(function (k) { deepFreeze(o[k]); });
    return o;
  }
  var isStr = function (v) { return typeof v === "string" && v.length > 0; };
  var isNum = function (v) { return typeof v === "number" && isFinite(v); };
  var EMPTY = Object.freeze([]);

  var PENDING_NOTE = "제도 쪽 판독 후 제공";
  var BLOCKED = "이 소매의 제도 쪽을 아직 판독하지 않았다(P036 은 장 표지·개요만 — 수치·절차 없음). 쪽 판독 후 별도 착수";

  // 레코드 = 실행 가능한 프리셋. method 는 designSleeveA 의 제도 방식 이름.
  var RECORDS = [
    { id: "bunka-sleeve-A", familyId: "straight-sleeve", symbol: "A",
      method: "bodice-armhole", methodPage: 137,
      // 사용자가 정하는 값(교재 수치 아님). 나머지는 몸판 진동둘레에서 읽는다.
      inputs: [{ key: "sleeveLengthCm", label: "소매길이", unit: "cm" }] },
    // Ⓑ: 출발 Ⓐ 는 같은 소매길이로 몸판에서 제도한다. 손바닥 둘레는 선택 — 비면 기본 커프 W×3/4(경고만, 자동 보정 없음).
    { id: "bunka-sleeve-B", familyId: "tight-sleeve", symbol: "B",
      method: "tight-from-sleeve-A", methodPage: 41,
      inputs: [{ key: "sleeveLengthCm", label: "소매길이", unit: "cm" },
        { key: "palmCircumferenceCm", label: "손바닥 둘레(선택)", unit: "cm", optional: true }] },
    // Ⓒ: Ⓑ 와 같은 출발 Ⓐ. 앞 겹침·뒤 열린 소맷부리 다트(EL 꼭짓점~소맷부리). EL = 팔꿈치 길이(SP 기준) 기본 31.4 — 사용자가 수정한다.
    { id: "bunka-sleeve-C", familyId: "tight-sleeve", symbol: "C",
      method: "tight-back-dart-from-sleeve-A", methodPage: 41,
      inputs: [{ key: "sleeveLengthCm", label: "소매길이", unit: "cm" },
        { key: "elbowLengthCm", label: "팔꿈치 길이 EL", unit: "cm", defaultValue: 31.4 }] },
    // Ⓓ: 출발 Ⓐ 에서 앞·뒤 반폭 중점 절개 2개를 소매산 기준점 중심으로 벌림(플레어 = 소매폭×0.5, 책 산식). 입력은 소매길이만.
    { id: "bunka-sleeve-D", familyId: "flare-sleeve", symbol: "D",
      method: "flare-slash-spread-from-sleeve-A", methodPage: 42,
      inputs: [{ key: "sleeveLengthCm", label: "소매길이", unit: "cm" }] },
    // Ⓔ: 절개 3개(반폭 중점 2 + 소매 중심선) · 4조각 · 플레어 = 소매폭×1. 가운데 두 조각 SP 대칭 → 바깥은 움직인 가운데 조각의 기준점 중심.
    { id: "bunka-sleeve-E", familyId: "flare-sleeve", symbol: "E",
      method: "flare-3cut-symmetric-from-sleeve-A", methodPage: 42,
      inputs: [{ key: "sleeveLengthCm", label: "소매길이", unit: "cm" }] },
    // Ⓕ: 소매 중심선 ±1·±3cm 평행 절개 4개 · 가운데 띠 고정 · 소맷부리 기준점으로 소매산을 벌려 턱(각 기본 1.5 · 최대 3cm, 김님 확정 — 사용자 수정).
    //   턱은 바깥쪽으로 접고 중심 쪽 천이 위(김님 원문). 재단선 = 턱 접은 상태에서 정리한 소매산을 펼친 선. 이세 = 턱 접은 소매산 길이 기준.
    { id: "bunka-sleeve-F", familyId: "tuck-sleeve", symbol: "F",
      method: "tuck-parallel-slash-from-sleeve-A", methodPage: 43,
      inputs: [{ key: "sleeveLengthCm", label: "소매길이", unit: "cm" },
        { key: "tuckCm", label: "턱 분량(각)", unit: "cm", defaultValue: 1.5 }] }
  ];

  function pendingFamily(id, order, label, symbol, page) {
    return { id: id, order: order, label: label, symbol: symbol, page: page, availability: "pending-page", note: PENDING_NOTE,
      familyNote: "표지 대표 기호만 확인됨 — 나머지 변형은 쪽 판독 후.",
      variants: [{ id: "bunka-sleeve-" + symbol, symbol: symbol, label: symbol + " · " + label, page: page, availability: "pending-page",
        presetId: null, blockedBy: BLOCKED, note: PENDING_NOTE }] };
  }

  // ── 카탈로그(교시 순서 = P.36–37) ──
  var CATALOG = [
    { id: "straight-sleeve", order: 1, label: "스트레이트 소매", symbol: "A", page: 40, availability: "available", note: null,
      familyNote: "기본 패턴 Ⓐ — 몸판 진동둘레(앞뒤 다트를 닫은 봉제 상태)에서 소매산을 제도한다. Ⓑ~Ⓠ 는 이 Ⓐ 에서 변형한다.",
      variants: [
        { id: "bunka-sleeve-A", symbol: "A", label: "A · 기본 패턴(완성한 몸판의 진동둘레를 토대로 제도)", page: 40, methodPage: 137,
          availability: "available", presetId: "bunka-sleeve-A", note: null }
      ] },
    { id: "tight-sleeve", order: 2, label: "타이트 소매", symbol: "B", page: 41, availability: "available", note: null,
      familyNote: "Ⓑ — 소매 Ⓐ 에서 소맷부리를 소매폭×3/4 로 정하고 앞·뒤 반폭 중점 2곳을 맞댄다(손바닥 둘레+3cm 미달은 경고만). Ⓒ — 완성 모양(● = 소맷부리÷4)을 가정해 그린 뒤 맞댄다: 뒤는 EL 까지 맞대고 아래 열린 봉제 다트, 앞은 EL 가로 절개·겹친 만큼 소매구 연장(EL 입력).",
      variants: [
        { id: "bunka-sleeve-B", symbol: "B", label: "B · 소맷부리를 소매폭의 3/4 로 맞댐(소매 Ⓐ 기반)", page: 41, methodPage: 41,
          availability: "available", presetId: "bunka-sleeve-B", note: null },
        { id: "bunka-sleeve-C", symbol: "C", label: "C · 뒤 소맷부리 다트 + 앞 EL 절개(소매 Ⓐ 기반, EL 입력)", page: 41, methodPage: 41,
          availability: "available", presetId: "bunka-sleeve-C", note: null }
      ] },
    { id: "flare-sleeve", order: 3, label: "플레어 소매", symbol: "D", page: 42, availability: "available", note: null,
      familyNote: "Ⓓ — 소매 Ⓐ 의 앞·뒤 반폭 중점에 절개 2개를 넣고, 소매산 기준점을 중심으로 옆 조각을 돌려 소맷부리에서 소매폭×0.5 를 벌린다. Ⓔ — 소매 중심선까지 절개 3개(4조각), 가운데 두 조각을 SP 대칭으로 벌린 뒤 바깥 조각을 더 벌려 소매폭×1(소매산 꺾임·소맷부리는 자연스러운 곡선으로).",
      variants: [
        { id: "bunka-sleeve-D", symbol: "D", label: "D · 절개 2개 · 플레어 소매폭×0.5(소매 Ⓐ 기반)", page: 42, methodPage: 42,
          availability: "available", presetId: "bunka-sleeve-D", note: null },
        { id: "bunka-sleeve-E", symbol: "E", label: "E · 절개 3개 · 플레어 소매폭×1(소매 Ⓐ 기반)", page: 42, methodPage: 42,
          availability: "available", presetId: "bunka-sleeve-E", note: null }
      ] },
    { id: "tuck-sleeve", order: 4, label: "턱 소매", symbol: "F", page: 43, availability: "available", note: null,
      familyNote: "Ⓕ — 소매 Ⓐ 에 소매 중심선과 평행한 절개 4개(중심 ±1·±3cm)를 넣고, 가운데 띠를 고정한 채 소맷부리를 기준점으로 소매산을 벌려 턱 4개(각 기본 1.5cm · 최대 3cm). 소맷부리·소매산 높이는 그대로, 소매폭이 조금 넓어진다. 턱은 바깥쪽으로 접고 중심 쪽 천이 위.",
      variants: [
        { id: "bunka-sleeve-F", symbol: "F", label: "F · 평행 절개 4개 · 소맷부리 기준점 · 턱 분량 입력(소매 Ⓐ 기반)", page: 43, methodPage: 43,
          availability: "available", presetId: "bunka-sleeve-F", note: null }
      ] },
    pendingFamily("puff-sleeve", 5, "퍼프 소매", "H", 44),
    pendingFamily("short-sleeve", 6, "반소매", "L", 46),
    pendingFamily("dolman-sleeve", 7, "돌먼 소매", "R", 49),
    pendingFamily("shirt-sleeve", 8, "셔츠 소매", "T", 50),
    pendingFamily("raglan-sleeve", 9, "래글런 소매", "V", 52),
    pendingFamily("kimono-sleeve", 10, "기모노 소매", "X", 54)
  ];

  var AVAIL = { "available": 1, "pending-page": 1 };
  function validateRecord(r) {
    if (!r || !isStr(r.id) || !isStr(r.familyId) || !isStr(r.symbol) || !isStr(r.method)) fail("missing-field", r && r.id);
    if (!isNum(r.methodPage) || r.methodPage <= 0) fail("invalid-page", r.id);
    if (!Array.isArray(r.inputs) || !r.inputs.every(function (f) { return f && isStr(f.key) && isStr(f.label); })) fail("invalid-inputs", r.id);
    return true;
  }
  function validateFamily(f, presetIds, seen, expectedOrder) {
    if (!f || !isStr(f.id) || !isStr(f.label) || !isStr(f.symbol)) fail("missing-field", "family");
    if (seen[f.id]) fail("duplicate-id", f.id); seen[f.id] = true;
    if (f.order !== expectedOrder) fail("invalid-order", f.id);
    if (!isNum(f.page) || f.page <= 0) fail("invalid-page", f.id);
    if (!AVAIL[f.availability]) fail("invalid-availability", f.id);
    if (!Array.isArray(f.variants) || !f.variants.length) fail("missing-variants", f.id);
    var anyAvail = false;
    f.variants.forEach(function (v) {
      if (!v || !isStr(v.id) || !isStr(v.label) || !isStr(v.symbol)) fail("missing-field", f.id + ".variant");
      if (seen[v.id]) fail("duplicate-id", v.id); seen[v.id] = true;
      if (!AVAIL[v.availability]) fail("invalid-availability", v.id);
      if (!isNum(v.page) || v.page <= 0) fail("invalid-page", v.id);
      if (v.availability === "available") {
        if (f.availability !== "available") fail("unavailable-family-variant", v.id);
        if (!isStr(v.presetId) || !presetIds[v.presetId]) fail("unknown-variant-preset", v.id);
        anyAvail = true;
      } else {
        if (v.presetId !== null) fail("pending-variant-preset", v.id);
        // ★ 보류 슬롯은 **왜 못 만드는지**를 반드시 들고 있어야 한다(없으면 «그냥 아직 안 함» 과 구별되지 않는다).
        if (!isStr(v.blockedBy)) fail("pending-without-reason", v.id);
      }
    });
    if (f.availability === "available" && !anyAvail) fail("available-family-without-preset", f.id);
    return true;
  }
  function build(families, records) {
    var presetIds = {}, seen = {};
    records.forEach(function (r) { validateRecord(r); if (presetIds[r.id]) fail("duplicate-id", r.id); presetIds[r.id] = 1; });
    families.forEach(function (f, i) { validateFamily(f, presetIds, seen, i + 1); });
    records.forEach(function (r) {
      var f = families.filter(function (x) { return x.id === r.familyId; })[0];
      if (!f) fail("unknown-record-family", r.id);
      if (!f.variants.some(function (v) { return v.presetId === r.id; })) fail("record-without-variant", r.id);
    });
    var list = deepFreeze(clone(families)), byId = {};
    list.forEach(function (f) { byId[f.id] = f; });
    var recById = {};
    deepFreeze(clone(records)).forEach(function (r) { recById[r.id] = r; });
    return { list: list, byId: Object.freeze(byId), recById: Object.freeze(recById) };
  }
  var REG = build(CATALOG, RECORDS);

  // ── 공개 API ──
  function families() { return REG.list; }
  function family(id) { return Object.prototype.hasOwnProperty.call(REG.byId, id) ? REG.byId[id] : null; }
  function variants(familyId) { var f = family(familyId); return f ? f.variants : EMPTY; }
  function variant(familyId, variantId) {
    var vs = variants(familyId);
    for (var i = 0; i < vs.length; i++) if (vs[i].id === variantId) return vs[i];
    return null;
  }
  function get(presetId) { return Object.prototype.hasOwnProperty.call(REG.recById, presetId) ? REG.recById[presetId] : null; }
  function familyOptions() {
    return REG.list.map(function (f) {
      return { value: f.id, label: f.label + " " + f.symbol + " (P" + f.page + ")", available: f.availability === "available" };
    });
  }
  function variantOptions(familyId) {
    return variants(familyId).map(function (v) { return { value: v.id, label: v.label, available: v.availability === "available" }; });
  }
  // 선택 해석 — 미구현은 **명시적 거부**. 절대 다른 프리셋으로 대체하지 않는다.
  function resolve(familyId, variantId) {
    var f = family(familyId); if (!f) return { ok: false, reason: "unknown-sleeve-family" };
    var v = variant(familyId, variantId); if (!v) return { ok: false, reason: "unknown-sleeve-variant" };
    if (v.availability !== "available" || !v.presetId) return { ok: false, reason: "sleeve-preset-unavailable" };
    return { ok: true, presetId: v.presetId };
  }
  function displayTitle(familyId, variantId) {
    var f = family(familyId); if (!f) return null;
    var v = variant(familyId, variantId);
    return Object.freeze({ familyLabel: f.label, symbol: (v && v.symbol) || f.symbol,
      page: (v && isNum(v.page)) ? v.page : f.page, variantId: v ? v.id : null });
  }

  window.sleevePresets = Object.freeze({
    families: families, family: family, variants: variants, variant: variant, get: get,
    familyOptions: familyOptions, variantOptions: variantOptions, resolve: resolve, displayTitle: displayTitle,
    validateRecord: validateRecord,
    PENDING_NOTE: PENDING_NOTE, DEFAULT_FAMILY_ID: "straight-sleeve", DEFAULT_ID: "bunka-sleeve-A"
  });
})();
