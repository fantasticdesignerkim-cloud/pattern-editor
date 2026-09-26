// ══════════════════════════════════════════════════════════════════════════════
// bodicePresets.js — 몸판 라인 카탈로그 ([패턴학교] 기초 강의 1, P.14–35)
//
// 칼라(collarPresets.js)와 같은 구조다: family(라인) → variant(교재 표식) → record(실행 수치).
// **다른 점**: 칼라는 별도 조각을 만드는 생성기를 갖지만, 몸판 라인은 **원형을 변형**하는 것이라
//   record 가 곧 `designBodice.computeGeometry` 의 `body` 파라미터 묶음이다.
//
// ★ 출처 주의: 이 카탈로그는 **[패턴학교]** 쪽번호·표식이다. 우리 원형은 **[학교책]** 기준이라
//   허리 다트가 a~f(c=옆선, f=뒤중심)이고, [패턴학교]의 몸판 Ⓐ 는 a·b·d·e 넷만 쓴다.
//   자세한 대조는 docs/book/P130.md · docs/book/SCHOOL-BLOCK.md.
//
// ★ blockedBy: 아직 실행할 수 없는 라인은 **왜 못 그리는지**를 적는다(후드 e·f·g·하이넥과 같은
//   취급). 22개 변형은 전부 [패턴학교] 「처리 방법」(P.157–163) 연산 위에 올라앉는데, 우리는
//   160/161/163(dartMove 계열)을 원형 단계에만 갖고 있고 157·158·159(맞댄다)·162 는 없다.
// ══════════════════════════════════════════════════════════════════════════════
(function () {
  "use strict";

  function fail(reason, detail) {
    var e = new Error("bodicePresets: " + reason);
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

  // body 파라미터로 허용하는 키 — `designBodice.computeGeometry` 의 body 계약과 1:1.
  //   여기에 없는 키는 레코드에 둘 수 없다(오타·추측 값이 조용히 형상을 바꾸는 걸 막는다).
  var BODY_FIELDS = [
    { key: "bustEaseCm", label: "품·여유량", unit: "cm" },
    { key: "hemExtensionBelowWaistCm", label: "엉덩이 길이", unit: "cm" },
    { key: "waistSideOffsetCm", label: "허리 옆선 이동", unit: "cm" },
    { key: "hemSideOffsetCm", label: "밑단 옆선 이동", unit: "cm" },
    { key: "sideSeamCurve", label: "옆선 곡선화", unit: "" },
    { key: "waistDartScales", label: "허리 다트 배분", unit: "" },
    { key: "flare", label: "다트를 닫아 밑단 벌리기", unit: "" }
  ];
  var BODY_KEYS = BODY_FIELDS.map(function (f) { return f.key; });
  var DART_SYMBOLS = ["a", "b", "d", "e"];   // [패턴학교]가 쓰는 봉제 허리다트 넷

  var PENDING_NOTE = "제도 연산 준비 후 제공";

  function pendingVariant(id, symbol, label, page, referenceNote, blockedBy) {
    return { id: id, symbol: symbol, label: label, page: page, availability: "pending-op",
      presetId: null, referenceNote: referenceNote, blockedBy: blockedBy, note: PENDING_NOTE };
  }
  function availVariant(id, symbol, label, page) {
    return { id: id, symbol: symbol, label: label, page: page, availability: "available",
      presetId: id, note: null };
  }

  // ── 카탈로그(교재 순서 = 기초 강의 1 의 교시 순서) ──
  var CATALOG = [
    { id: "boxy-line", order: 1, label: "박시 라인", symbol: "A", page: 14,
      availability: "available", note: null,
      familyNote: "옆선을 밑단까지 수직으로 내린 상자형. 이 책의 **모든 몸판 패턴이 Ⓐ 에서 전개**된다.",
      variants: [
        availVariant("bunka-bodice-A", "A", "A · 기본 패턴(변형 없음)", 14),
        availVariant("bunka-bodice-B", "B", "B · 밑단에서 1cm 추가", 15)
      ] },
    { id: "shaped-line", order: 2, label: "셰이프트 라인", symbol: "C", page: 16,
      availability: "available", note: null,
      familyNote: "허리를 줄여 몸매 라인을 표현. **쓰는 다트를 골라** 형태감과 여유분을 조절한다.",
      variants: [
        availVariant("bunka-bodice-C", "C", "C · 다트 a·e · 옆선 −1 · 밑단 +1", 16),
        availVariant("bunka-bodice-D", "D", "D · 다트 a·b·d(½)·e · 옆선 −1.5 · 밑단 +1", 17)
      ] },
    { id: "princess-line", order: 3, label: "프린세스 라인", symbol: "E", page: 18,
      availability: "pending-op", note: PENDING_NOTE,
      familyNote: "이음선으로 조각을 나누고 앞 AH 다트를 닫는다.",
      variants: [
        pendingVariant("bunka-bodice-E", "E", "E · 허리 다트 1개 이용 · 옆선 −1 · 밑단 +1", 18,
          "다트 a·e 를 쓰되 e 를 옆쪽으로 이동. 앞 AH 다트를 닫는다(0.5). 앞·옆 조각으로 분리",
          "이음선으로 **조각을 실제로 분리**하고 AH 다트를 닫아야 한다(처리 방법 160). 현재 절개·파트 분리는 파생 미리보기(working.parts)일 뿐 디자인 결과로 확정되지 않고, 디자인 단계에서 다트를 닫는 경로가 없다."),
        pendingVariant("bunka-bodice-F", "F", "F · 프린세스 라인 변형", 19, null,
          "E 와 같은 이유(미판독 — E 착수 시 함께 읽는다).")
      ] },
    { id: "flare-line", order: 4, label: "플레어 라인", symbol: "G", page: 20,
      availability: "available", note: null,
      familyNote: "다트를 닫아 그 반동으로 밑단을 벌린다(처리 방법 161).",
      variants: [
        availVariant("bunka-bodice-G", "G", "G · 밑단 폭 3cm 추가 · 다트를 닫아 밑단을 벌린다", 20),
        pendingVariant("bunka-bodice-H", "H", "H · 플레어 분량을 더 넣는다", 21,
          "Ⓖ 의 꼬리말이 «플레어를 더 넣고 싶은 경우 Ⓗ 를 참조» 라고 가리킨다",
          "다트를 닫아 얻는 분량에는 상한이 있다(다트각 만큼). 그 이상은 **처리 방법 162(평행으로 잘라서 벌린다)** 로 넣는데 그 연산이 아직 없다. P.21 미판독.")
      ] },
    { id: "neck-tuck", order: 5, label: "목둘레에 턱을 넣는다", symbol: "I", page: 22,
      availability: "pending-op", note: PENDING_NOTE,
      familyNote: "다트를 닫아 그 반동으로 목둘레를 벌려 턱을 만든다.",
      variants: [
        pendingVariant("bunka-bodice-I", "I", "I · 밑단 폭 1cm 추가 · 다트를 닫아 목둘레를 벌린다", 22,
          "원하는 목둘레 위치에 절개선을 넣어 벌린다. 꼬리말: 닫는다·벌린다 P.161",
          "**처리 방법 161** + 목둘레 절개 위치 지정이 필요하다(플레어 G 와 같은 계열)."),
        pendingVariant("bunka-bodice-J", "J", "J · 턱 변형", 23, null, "I 와 같은 이유(미판독).")
      ] },
    { id: "neck-gather", order: 6, label: "목둘레에 개더를 넣는다", symbol: "K", page: 24,
      availability: "pending-op", note: PENDING_NOTE,
      familyNote: "턱 대신 개더로 분량을 소화한다.",
      variants: [
        pendingVariant("bunka-bodice-K", "K", "K · 목둘레 개더", 24, null,
          "턱(I·J)과 같은 계열로 추정 — **미판독**. 착수 시 P.24–25 를 읽고 확정한다."),
        pendingVariant("bunka-bodice-L", "L", "L · 목둘레 개더 변형", 25, null, "K 와 같은 이유(미판독).")
      ] },
    { id: "waist-seam", order: 7, label: "허리 이음선", symbol: "M", page: 26,
      availability: "pending-op", note: PENDING_NOTE,
      familyNote: "허리에서 잘라 페플럼을 붙인다. 처리 방법 세 가지가 한꺼번에 쓰인다.",
      variants: [
        pendingVariant("bunka-bodice-M", "M", "M · 옆선 −1.5 · 밑단 +1 · 다트 b·d 를 닫고 페플럼은 맞댄다", 26,
          "몸판은 a·e 를 다트로, b·d 는 닫아 진동 둘레 여유분으로. 페플럼은 a·b·d·e 를 같은 분량으로 잡은 뒤 맞댄다. 꼬리말: 닫는다 P.160 · 닫는다·벌린다 P.161 · **맞댄다 P.157**",
          "**맞댄다(157)** 가 없다 — 지금 코드에는 조각을 **나누는** 연산만 있고 표시 위치에서 **한 장으로 잇는** 연산이 없다. 허리 분리(파트 확정)도 필요하다."),
        pendingVariant("bunka-bodice-N", "N", "N · 페플럼에 플레어를 넣는다", 27,
          "처리 방법 P.158「맞대면서 벌린다」의 워크 예시가 이 몸판 Ⓝ 페플럼이다",
          "**맞댄다(157) + 맞대면서 벌린다(158)** 가 필요하다."),
        pendingVariant("bunka-bodice-O", "O", "O · 허리 이음선 변형", 28, null, "M 과 같은 이유(미판독)."),
        pendingVariant("bunka-bodice-P", "P", "P · 허리 이음선 변형", 29, null, "M 과 같은 이유(미판독).")
      ] },
    { id: "yoke-seam-1", order: 8, label: "요크 이음선 ①", symbol: "Q", page: 30,
      availability: "pending-op", note: PENDING_NOTE,
      familyNote: "어깨 쪽에서 잘라 요크를 만들고 앞뒤 요크를 한 장으로 잇는다.",
      variants: [
        pendingVariant("bunka-bodice-Q", "Q", "요크 이음선 ①", 30, null,
          "**맞댄다(157)·2곳 이상 맞댄다(159)** 가 필요하다 — 요크는 앞뒤를 맞대어 한 장으로 만든다."),
        pendingVariant("bunka-bodice-R", "R", "요크 이음선 ① 변형", 31, null, "Q 와 같은 이유(미판독).")
      ] },
    { id: "yoke-seam-2", order: 9, label: "요크 이음선 ②", symbol: "S", page: 32,
      availability: "pending-op", note: PENDING_NOTE, familyNote: null,
      variants: [
        pendingVariant("bunka-bodice-S", "S", "요크 이음선 ②", 32, null, "요크 ① 과 같은 이유(미판독)."),
        pendingVariant("bunka-bodice-T", "T", "요크 이음선 ② 변형", 33, null, "요크 ① 과 같은 이유(미판독).")
      ] },
    { id: "yoke-seam-3", order: 10, label: "요크 이음선 ③", symbol: "U", page: 34,
      availability: "pending-op", note: PENDING_NOTE,
      familyNote: "처리 방법 P.159「2곳 이상 맞댄다」의 워크 예시가 이 몸판 Ⓤ 요크다.",
      variants: [
        pendingVariant("bunka-bodice-U", "U", "요크 이음선 ③", 34,
          "P.159 워크 예시 — 뒤 요크 다트를 맞대고, 다음에 앞 요크와 맞대어 1장의 패턴으로",
          "**2곳 이상 맞댄다(159)** 가 필요하다."),
        pendingVariant("bunka-bodice-V", "V", "요크 이음선 ③ 변형", 35, null, "U 와 같은 이유(미판독).")
      ] }
  ];

  // ── 실행 레코드 ──
  //   body 는 `designBodice.computeGeometry({ body })` 에 그대로 넘어간다.
  //   ★ waistDartScales 는 **원형(=[학교책]) 다트 대비 배율**이다. 교재 도해가 "쓰지 않는" 다트는 0.
  var RECORDS = [
    {
      id: "bunka-bodice-A", label: "교재 A 기본 패턴", familyId: "boxy-line", symbol: "A", page: 14,
      description: "박시 라인 기본형 — 원형에 변형을 주지 않는다",
      source: "[패턴학교] 박시 라인 Ⓐ(P.14)",
      baseMethod: "bunka-bodice-A-v1",
      // ※ 교재 Ⓐ 는 다트 a·b·d·e 만 쓰지만(82%), 우리 원형은 [학교책] 기준이라 c(옆선)·f(뒤중심)까지
      //   포함한다. 그래서 **우리 Ⓐ 는 교재보다 허리가 조금 더 조인다**(완성 70.9 vs 교재 74.5).
      //   원형 형상을 바꾸지 않기로 한 결정에 따라 그대로 두고, 차이는 문서로만 남긴다.
      // ★ [패턴학교] P.14 Ⓐ: "허리선에서 **엉덩이 길이**를 더한 엉덩이선의 위치가 밑단선".
      // P.13 기본 체형(키 160·등 길이 38)의 엉덩이 길이가 **20cm** 다. 이게 없으면 `hemSideOffsetCm`
      // 이 **조용히 무시된다**(밑단이 없으니 옮길 것도 없다) — 실제로 Ⓑ·Ⓒ·Ⓓ 의 "밑단 +1" 이
      // 그렇게 사라지고 있었다.
      body: { hemExtensionBelowWaistCm: 20 }
    },
    {
      id: "bunka-bodice-B", label: "교재 B 밑단 추가", familyId: "boxy-line", symbol: "B", page: 15,
      description: "박시 라인 + 밑단에서 1cm 추가(엉덩이 둘레 여유 확보)",
      source: "[패턴학교] 박시 라인 Ⓑ(P.15)",
      baseMethod: "bunka-bodice-B-v1",
      // 교재: "오버 블라우스의 경우 엉덩이선에 8cm 이상의 여유분이 들어가 있는지 확인하자"
      body: { hemExtensionBelowWaistCm: 20, hemSideOffsetCm: 1 }
    },
    {
      id: "bunka-bodice-G", label: "교재 G 플레어", familyId: "flare-line", symbol: "G", page: 20,
      description: "허리 다트를 없애고 앞 AH·뒤 어깨 다트를 닫아 밑단을 벌린다 · 밑단 폭 3cm 추가",
      source: "[패턴학교] 플레어 라인 Ⓖ(P.20)",
      baseMethod: "bunka-bodice-G-v1",
      // ★ 허리 다트 배분 0 이 **필수**다 — 플레어가 그 조임을 대신하고(교재 도해에도 허리 다트가
      //   없다), 절개선이 앞판 다트 a 를 관통한다(a 의 apex 가 BP 바로 아래). designFlare 는
      //   봉제 허리다트가 남아 있으면 거부하므로 여기서 함께 지정한다.
      body: { hemExtensionBelowWaistCm: 20, hemSideOffsetCm: 3,
              waistDartScales: { a: 0, b: 0, d: 0, e: 0 }, flare: true }
    },
    {
      id: "bunka-bodice-C", label: "교재 C 셰이프트(다트 2개)", familyId: "shaped-line", symbol: "C", page: 16,
      description: "허리 다트 a·e 만 사용 · 옆선 1cm 줄임 · 밑단 1cm 추가",
      source: "[패턴학교] 셰이프트 라인 Ⓒ(P.16)",
      baseMethod: "bunka-bodice-C-v1",
      // 교재 인쇄값: 허리둘레 여유분 17cm(기본 체형). 우리 계산과 차이가 있다 — docs/book/P016.md 참고.
      body: { hemExtensionBelowWaistCm: 20, waistSideOffsetCm: -1, hemSideOffsetCm: 1, waistDartScales: { a: 1, b: 0, d: 0, e: 1 } }
    },
    {
      id: "bunka-bodice-D", label: "교재 D 셰이프트(다트 4개)", familyId: "shaped-line", symbol: "D", page: 17,
      description: "허리 다트 a·b·d·e 전부 사용(단 d 는 ½) · 옆선 1.5cm 줄임 · 밑단 1cm 추가",
      source: "[패턴학교] 셰이프트 라인 Ⓓ(P.17)",
      baseMethod: "bunka-bodice-D-v1",
      // 교재 인쇄값: 허리둘레 여유분 7.8cm(기본 체형).
      body: { hemExtensionBelowWaistCm: 20, waistSideOffsetCm: -1.5, hemSideOffsetCm: 1, waistDartScales: { a: 1, b: 1, d: 0.5, e: 1 } }
    }
  ];

  // ── 검증 ──
  var AVAIL = { available: 1, "pending-op": 1 };
  function validateBody(body, id) {
    if (!body || typeof body !== "object" || Array.isArray(body)) fail("invalid-body", id);
    Object.keys(body).forEach(function (k) {
      if (BODY_KEYS.indexOf(k) < 0) fail("unknown-body-key", id + "." + k);
      var v = body[k];
      if (k === "waistDartScales") {
        if (!v || typeof v !== "object" || Array.isArray(v)) fail("invalid-body", id + "." + k);
        Object.keys(v).forEach(function (sym) {
          if (DART_SYMBOLS.indexOf(sym) < 0) fail("unknown-dart-symbol", id + "." + k + "." + sym);
          if (!isNum(v[sym]) || v[sym] < 0) fail("invalid-body", id + "." + k + "." + sym);
        });
        return;
      }
      if (k === "flare") { if (v !== true) fail("invalid-body", id + ".flare"); return; }
      if (!isNum(v)) fail("invalid-body", id + "." + k);
    });
  }
  function validateRecord(r) {
    if (!r || typeof r !== "object") fail("invalid-record");
    ["id", "label", "familyId", "symbol", "baseMethod"].forEach(function (k) {
      if (!isStr(r[k])) fail("missing-field", (r.id || "?") + "." + k);
    });
    if (!isNum(r.page) || r.page <= 0) fail("invalid-page", r.id);
    validateBody(r.body, r.id);
    // 형상·기하 데이터는 레코드에 두지 않는다(수치만).
    ["geometry", "outline", "construction", "parameters"].forEach(function (k) {
      if (k in r) fail("record-shape-data", r.id);
    });
    return true;
  }
  function validateFamily(f, presetIds, seen, expectOrder) {
    if (!f || typeof f !== "object") fail("invalid-family");
    ["id", "label", "symbol"].forEach(function (k) { if (!isStr(f[k])) fail("missing-field", (f.id || "?") + "." + k); });
    if (f.order !== expectOrder) fail("bad-book-order", f.id);
    if (!isNum(f.page) || f.page <= 0) fail("invalid-page", f.id);
    if (!AVAIL[f.availability]) fail("invalid-availability", f.id);
    if (seen[f.id]) fail("duplicate-id", f.id); seen[f.id] = true;
    if (!Array.isArray(f.variants) || !f.variants.length) fail("invalid-variants", f.id);
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
        // ★ 보류 슬롯은 **왜 못 그리는지**를 반드시 들고 있어야 한다 — 없으면 "그냥 아직 안 함"과
        //   구별이 안 되고, 다음 세션이 근거 없이 착수하게 된다.
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
  function get(presetId) {
    return Object.prototype.hasOwnProperty.call(REG.recById, presetId) ? REG.recById[presetId] : null;
  }
  function familyOptions() {
    return REG.list.map(function (f) {
      return { value: f.id, label: f.label + " " + f.symbol + " (P" + f.page + ")", available: f.availability === "available" };
    });
  }
  function variantOptions(familyId) {
    return variants(familyId).map(function (v) {
      return { value: v.id, label: v.label, available: v.availability === "available" };
    });
  }
  // 선택 해석 — 미구현은 **명시적 거부**. 절대 다른 프리셋으로 대체하지 않는다.
  function resolve(familyId, variantId) {
    var f = family(familyId); if (!f) return { ok: false, reason: "unknown-bodice-family" };
    var v = variant(familyId, variantId); if (!v) return { ok: false, reason: "unknown-bodice-variant" };
    if (v.availability !== "available" || !v.presetId) return { ok: false, reason: "bodice-preset-unavailable" };
    return { ok: true, presetId: v.presetId };
  }
  // 그 프리셋이 뜻하는 body 파라미터(새 복사본). 없는 키는 **넣지 않는다** — 호출부가
  //   "미지정 = 기본값" 계약(예: waistDartTotalCm 빈 값 = 원형 그대로)을 그대로 쓸 수 있게.
  function bodyParams(presetId) {
    var r = get(presetId);
    return r ? clone(r.body) : null;
  }
  function displayTitle(familyId, variantId) {
    var f = family(familyId); if (!f) return null;
    var v = variant(familyId, variantId);
    return Object.freeze({ familyLabel: f.label, symbol: (v && v.symbol) || f.symbol,
      page: (v && isNum(v.page)) ? v.page : f.page, variantId: v ? v.id : null });
  }
  var DEFAULT_FAMILY_ID = "boxy-line";
  var DEFAULT_ID = "bunka-bodice-A";

  window.bodicePresets = Object.freeze({
    families: families, family: family, variants: variants, variant: variant,
    get: get, familyOptions: familyOptions, variantOptions: variantOptions,
    resolve: resolve, bodyParams: bodyParams, displayTitle: displayTitle,
    fields: function () { return clone(BODY_FIELDS); },
    validateRecord: validateRecord,
    PENDING_NOTE: PENDING_NOTE, DEFAULT_ID: DEFAULT_ID, DEFAULT_FAMILY_ID: DEFAULT_FAMILY_ID
  });
})();
