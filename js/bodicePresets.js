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
    { key: "waistDartExtraCm", label: "허리 다트 폭 추가(절대 cm)", unit: "cm" },
    { key: "flare", label: "다트를 닫아 밑단 벌리기", unit: "" },
    { key: "flareSlash", label: "진동 가장 안쪽 수직 절개로 플레어 더 벌리기", unit: "" },
    { key: "waistSeam", label: "허리 이음선(상·하 조각 분리)", unit: "" },
    { key: "peplumFlare", label: "페플럼 맞대면서 플레어 벌리기", unit: "" },
    { key: "peplumCut", label: "페플럼 WL 등분 수직 절개로 벌리기", unit: "" },
    { key: "yokeSeam", label: "요크 이음선(요크·몸판 조각 분리)", unit: "" },
    { key: "yokeGather", label: "요크 이음선 아래 몸판 중심 개더 띠", unit: "" },
    { key: "princess", label: "프린세스 이음선(앞·뒤 중심·옆 조각 분리)", unit: "" }
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
      availability: "available", note: null,
      familyNote: "어깨(뒤는 다트 입구)에서 밑단까지 이음선으로 앞·뒤를 중심·옆 조각으로 나눈다. 앞 AH 다트는 BP 를 축으로 닫고, 허리 다트 a·e 는 이음선의 마름모가 된다(처리 방법 P.160).",
      variants: [
        availVariant("bunka-bodice-E", "E", "E · 프린세스 이음선(앞·뒤 중심/옆 4조각) · 다트 a·e · 옆선 −1 · 밑단 +1", 18),
        availVariant("bunka-bodice-F", "F", "F · 프린세스 이음선 · 다트 a +1 · e +1.5 · 옆선 −1.5 · 밑단 +1", 19)
      ] },
    { id: "flare-line", order: 4, label: "플레어 라인", symbol: "G", page: 20,
      availability: "available", note: null,
      familyNote: "다트를 닫아 그 반동으로 밑단을 벌린다(처리 방법 161). Ⓗ 는 거기에 진동 가장 안쪽 기준점의 수직 절개를 더해 기준점을 잡고 벌린다(처리 방법 163).",
      variants: [
        availVariant("bunka-bodice-G", "G", "G · 밑단 폭 3cm 추가 · 다트를 닫아 밑단을 벌린다", 20),
        availVariant("bunka-bodice-H", "H", "H · Ⓖ 방법 + 진동 가장 안쪽에서 밑단까지 수직 절개를 넣어 플레어 분량을 더 벌린다", 21)
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
      availability: "available", note: null,
      familyNote: "허리에서 잘라 페플럼을 붙인다. 몸판(상)과 페플럼(하)은 **별개의 조각**이다.",
      variants: [
        availVariant("bunka-bodice-M", "M", "M · 옆선 −1.5 · 밑단 +1 · 다트 b·d 를 닫고 페플럼은 맞댄다", 26),
        availVariant("bunka-bodice-N", "N", "N · Ⓜ 방법 + 페플럼은 맞대면서 플레어 분량을 벌린다", 27),
        availVariant("bunka-bodice-O", "O", "O · 박시 몸판 + 페플럼 절개 3조각 벌림(허리 이음선 · 밑단 +2)", 28),
        availVariant("bunka-bodice-P", "P", "P · 박시 몸판 + 이음선 WL−5cm · 페플럼 절개 벌림(밑단 +1.5)", 29)
      ] },
    { id: "yoke-seam-1", order: 8, label: "요크 이음선 ①", symbol: "Q", page: 30,
      availability: "available", note: null,
      familyNote: "다트 끝을 지나는 수평 이음선으로 요크와 몸판을 나눈다. 앞뒤 요크와 몸판은 **별개의 조각**이다.",
      variants: [
        availVariant("bunka-bodice-Q", "Q", "Q · 박시 몸판 + 이음선(다트 끝 높이) · 앞 AH·뒤 어깨 다트를 이음선에 흡수 · 밑단 +1", 30),
        availVariant("bunka-bodice-R", "R", "R · Ⓠ 방법 + 이음선 아래 몸판 중심에 개더 분량 추가(뒤 10cm · 앞 다트끝 거리−1cm)", 31)
      ] },
    { id: "yoke-seam-2", order: 9, label: "요크 이음선 ②", symbol: "S", page: 32,
      availability: "available", note: null,
      familyNote: "앞은 BP 를 지나는 꺾인 이음선(AH 다트를 닫는다), 뒤는 BL 5cm 아래 수평 이음선. 뒤 어깨 다트는 요크에 열린 봉제 다트로 남는다. Ⓢ 는 몸판 중심에 이음선 길이 ½ 의 개더 분량을 추가하고, Ⓣ 는 몸판을 절개해 밑단만 벌린다.",
      variants: [
        availVariant("bunka-bodice-S", "S", "S · 박시 몸판 + 이음선(뒤 BL−5 · 앞 BP 경유 사선) · 앞 AH 다트 흡수 · 뒤 어깨 다트 보존 · 중심 개더 = 이음선×½ · 밑단 +1", 32),
        availVariant("bunka-bodice-T", "T", "T · Ⓢ 요크·이음선 + 몸판 절개 2곳 밑단 벌림(∅ = BL 폭×½−2.5) · 밑단 +2.5", 33)
      ] },
    { id: "yoke-seam-3", order: 10, label: "요크 이음선 ③", symbol: "U", page: 34,
      availability: "available", note: null,
      familyNote: "처리 방법 P.159「2곳 이상 맞댄다」의 워크 예시가 이 몸판 Ⓤ 요크다: 뒤 요크 다트를 먼저 맞대고, 그다음 앞 요크와 어깨선에서 맞대어 «어깨 요크» 한 장으로 만든다. 앞 이음선은 어깨선과 평행, 앞 AH 다트는 몸판에서 닫아 이음선에 쐐기(개더)를 벌린다. Ⓥ(P.35)는 Ⓤ 에 개더만 키운다 — 뒤 ∅×1 · 앞은 BP→밑단 수직 절개를 평행으로 벌려 총 ●×1.2.",
      variants: [
        availVariant("bunka-bodice-U", "U", "U · 박시 몸판 + 어깨 요크 한 장(뒤 다트를 먼저 닫아 앞 요크와 어깨선에서 맞댐) · 앞 이음선 어깨 평행 −6 · 앞 AH 다트 몸판에서 닫아 쐐기 개더 · 뒤 중심 개더 ∅×0.5 · 밑단 +1", 34),
        availVariant("bunka-bodice-V", "V", "V · Ⓤ 방법 + 앞뒤 개더 분량 추가 · 뒤 중심 개더 ∅×1 · 앞 BP→밑단 수직 절개를 평행으로 벌려 총 개더 ●×1.2 · 밑단 +1", 35)
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
      id: "bunka-bodice-H", label: "교재 H 플레어 + 절개", familyId: "flare-line", symbol: "H", page: 21,
      description: "Ⓖ 방법 + 진동 가장 안쪽 기준점에서 밑단까지 수직 절개 1개(앞·뒤) · 벌림 ∅ = min(●−(3+■), ■) · 허리 다트 없음",
      source: "[패턴학교] 플레어 라인 Ⓗ(P.21) · 처리 방법 닫는다·벌린다(P.161) · 기준점을 잡고 잘라서 벌린다(P.163)",
      baseMethod: "bunka-bodice-H-v1",
      // Ⓖ 와 같은 몸판(허리 다트 0 · 밑단 +3 · 다트 닫기) + flareSlash. ∅ 는 교재 «■ 까지가 최대» 를 산식보다 우선해 clamp 한다(사용자 확정).
      body: { hemExtensionBelowWaistCm: 20, hemSideOffsetCm: 3,
              waistDartScales: { a: 0, b: 0, d: 0, e: 0 }, flare: true, flareSlash: true }
    },
    {
      id: "bunka-bodice-M", label: "교재 M 허리 이음선", familyId: "waist-seam", symbol: "M", page: 26,
      description: "허리에서 몸판/페플럼 분리 · 옆선 1.5cm 줄임 · 밑단 1cm 추가 · 몸판은 b·d 를 닫고 페플럼은 a·b·d·e 를 맞댄다",
      source: "[패턴학교] 허리 이음선 Ⓜ(P.26)",
      baseMethod: "bunka-bodice-M-v1",
      // 조합 연산(js/designWaistSeam.js): 몸판 = a·e 유지, b(앞)·d(뒤) 닫아 그 반동을 진동 둘레 여유분으로.
      //   페플럼 = a·b·d·e 를 몸판과 같은 분량으로 잡아 designJoin.buttJoin 으로 다트마다 맞댄다.
      //   허리 다트 배분(waistDartScales)은 지정하지 않는다 — 원형 배율(1)이 곧 "몸판과 같은 분량"이다.
      //   밑단(엉덩이 길이 20)이 있어야 페플럼이 생긴다.
      body: { hemExtensionBelowWaistCm: 20, waistSideOffsetCm: -1.5, hemSideOffsetCm: 1, waistSeam: true }
    },
    {
      id: "bunka-bodice-N", label: "교재 N 허리 이음선 + 페플럼 플레어", familyId: "waist-seam", symbol: "N", page: 27,
      description: "Ⓜ 방법 + 페플럼은 허리선에서 맞대어 밑단에 플레어 분량을 넣는다(플레어 = 허리 완성치수 × 0.9 − 1)",
      source: "[패턴학교] 허리 이음선 Ⓝ(P.27) · 처리 방법 맞대면서 벌린다(P.158)",
      baseMethod: "bunka-bodice-N-v1",
      // Ⓜ 과 몸판이 같다. 페플럼만 다르다: 맞댄 뒤 앞·뒤 각각의 완성 허리길이(●+■) × 0.9 − 1cm 가 총 플레어 ∅ 이고,
      //   절개(다트 자리) 수로 균등 분배해(교재 도해 2곳 각 ∅/2) 허리선 입 점을 고정한 채 밑단 끝을 벌린다.
      //   교재의 «약 5cm» 는 고정값이 아니라 참고 결과다. 밑단 이음은 접선 연속 곡선(fairing).
      body: { hemExtensionBelowWaistCm: 20, waistSideOffsetCm: -1.5, hemSideOffsetCm: 1, waistSeam: true, peplumFlare: true }
    },
    {
      id: "bunka-bodice-O", label: "교재 O 허리 이음선 + 페플럼 절개 벌림", familyId: "waist-seam", symbol: "O", page: 28,
      description: "박시 몸판(허리 다트 없음 · 옆선 수직) + 페플럼은 WL 3등분 수직 절개 2곳을 벌린다(플레어 = 허리 완성치수 × 0.4 − 2 · 밑단 +2)",
      source: "[패턴학교] 허리 이음선 Ⓞ(P.28) · 처리 방법 기준점을 잡고 잘라서 벌린다(P.163)",
      baseMethod: "bunka-bodice-O-v1",
      // 몸판 = 박시 Ⓐ: 허리 다트 a·b·d·e 는 없고(배율 0) 옆선은 WL 까지 수직(−1.5 조정 없음). 앞 AH·뒤 어깨 다트는 원형 그대로다.
      //   페플럼: WL 을 3등분한 점에서 수직 절개 2곳 → 중심 조각 고정 · 중간·옆 조각을 바깥으로 순차 회전 ·
      //   각 절개는 WL 점 고정, 밑단 끝 chord ∅/2 · ∅ = 완성 허리 × 0.4 − 2 · 옆 밑단 +2 · 허리선·밑단 fairing.
      body: { hemExtensionBelowWaistCm: 20, hemSideOffsetCm: 2, waistDartScales: { a: 0, b: 0, d: 0, e: 0 }, waistSeam: true, peplumCut: true }
    },
    {
      id: "bunka-bodice-P", label: "교재 P 허리 이음선(WL 아래 5cm) + 페플럼 절개 벌림", familyId: "waist-seam", symbol: "P", page: 29,
      description: "박시 몸판 · 이음선은 WL 에서 5cm 아래 · 페플럼(15cm)은 수직 절개 2곳을 벌린다(플레어 = 이음선 완성 둘레 × 0.3 − 1.5 · 밑단 +1.5)",
      source: "[패턴학교] 허리 이음선 Ⓟ(P.29) · 처리 방법 기준점을 잡고 잘라서 벌린다(P.163)",
      baseMethod: "bunka-bodice-P-v1",
      // 사용자 확정(2026-09-30): 몸판 옆선은 WL~이음선 수직 · +1.5 는 이음선 아래 페플럼에만 · ● = 이음선 완성 둘레 ·
      //   전체 길이 WL 아래 20cm(페플럼 15cm) · 이음선·밑단 fairing. hemSideOffsetCm 은 쓰지 않는다(옆선 전체 기울기 아님).
      body: { hemExtensionBelowWaistCm: 20, waistDartScales: { a: 0, b: 0, d: 0, e: 0 }, waistSeam: true, peplumCut: "P" }
    },
    {
      id: "bunka-bodice-Q", label: "교재 Q 요크 이음선 ①", familyId: "yoke-seam-1", symbol: "Q", page: 30,
      description: "박시 몸판 · 앞뒤 다트 끝을 지나는 수평 이음선으로 요크·몸판 분리 · 앞 AH 다트와 뒤 어깨 다트는 이음선으로 전량 흡수 · 밑단 옆 +1cm",
      source: "[패턴학교] 요크 이음선 ① Ⓠ(P.30) · 처리 방법 닫는다(P.160)",
      baseMethod: "bunka-bodice-Q-v1",
      // 사용자 확정(2026-09-30): 이음선 = 다트 apex 를 지나는 수평선(도해의 «11» 은 쓰지 않는다) · 앞·뒤 요크는 어깨에서
      //   합치지 않는 별도 조각 · 다트 전량 흡수(3cm·2cm 이동 조정은 이번 기본형에 없다) · 밑단 +1cm 는 앞·뒤 각각 옆선 방향.
      body: { hemExtensionBelowWaistCm: 20, hemSideOffsetCm: 1, yokeSeam: true }
    },
    {
      id: "bunka-bodice-R", label: "교재 R 요크 이음선 ① + 중심 개더", familyId: "yoke-seam-1", symbol: "R", page: 31,
      description: "Ⓠ 방법 + 이음선 아래 몸판 중심 쪽에 개더 분량을 평행 추가 · 뒤 ⌀=10cm · 앞 ⊠=앞중심→AH 다트 끝 수평거리−1cm · 요크는 Ⓠ 와 동일",
      source: "[패턴학교] 요크 이음선 ① Ⓡ(P.31) · 처리 방법 닫는다(P.160)",
      baseMethod: "bunka-bodice-R-v1",
      // 사용자 확정(2026-10-01): 개더 띠는 몸판에만(요크 geometry 불변) · 뒤 10cm 고정 · 앞 ⊠ = 앞중심→다트 끝 − 1cm · 주름 수·턱 형상은 책에 없어 만들지 않는다.
      body: { hemExtensionBelowWaistCm: 20, hemSideOffsetCm: 1, yokeSeam: true, yokeGather: true }
    },
    {
      id: "bunka-bodice-S", label: "교재 S 요크 이음선 ②", familyId: "yoke-seam-2", symbol: "S", page: 32,
      description: "박시 몸판 · 뒤 이음선 BL 5cm 아래 수평 · 앞 이음선 CF→BP(BL 높이)→옆선 BL−5 사선 · 앞 AH 다트는 BP 축으로 닫아 요크에 흡수 · 뒤 어깨 다트는 요크에 열린 봉제 다트로 보존 · 이음선 아래 몸판 중심에 개더 분량(각 이음선 길이×0.5) · 밑단 옆 +1cm",
      source: "[패턴학교] 요크 이음선 ② Ⓢ(P.32) · 처리 방법 닫는다(P.160)",
      baseMethod: "bunka-bodice-S-v1",
      // 사용자 확정(2026-10-01): 뒤 어깨 다트는 도해처럼 요크에 열린 봉제 다트로 남긴다(닫지도 이음선에 흡수하지도 않는다) · 개더 띠는 몸판에만 ·
      //   폭 = 앞·뒤 각자의 완성 이음선 전체 길이 × 0.5 · 주름 수·턱 형상은 책에 없어 만들지 않는다. yokeSeam "S" 는 개더 띠를 포함한다.
      body: { hemExtensionBelowWaistCm: 20, hemSideOffsetCm: 1, yokeSeam: "S" }
    },
    {
      id: "bunka-bodice-T", label: "교재 T 요크 이음선 ②(절개 벌림)", familyId: "yoke-seam-2", symbol: "T", page: 33,
      description: "요크·이음선은 Ⓢ 와 동일(앞 AH 다트 흡수 · 뒤 어깨 다트 보존) · 몸판은 WL 3등분점 수직 절개 2곳으로 이음선 교점을 고정하고 밑단만 벌린다(총 ∅ = 앞/뒤 각 BL 수평폭 × 0.5 − 2.5, 절개당 ∅/2) · 밑단 옆 +2.5cm · 개더·턱 없음",
      source: "[패턴학교] 요크 이음선 ② Ⓣ(P.33) · 처리 방법 닫는다(P.160) · 기준점을 잡고 잘라서 벌린다(P.163)",
      baseMethod: "bunka-bodice-T-v1",
      // 사용자 확정(2026-10-01): ● = Ⓐ 몸판 BL 수평폭(교재 도해 호의 시작점·본문 «가슴 완성 치수», 앞 24.447cm → ∅ 9.72cm · 이음선 전체 길이 해석은 쓰지 않는다) ·
      //   절개 2곳 = WL 3등분점의 수직선 · 각 절개 chord ∅/2 · 밑단 옆 +2.5(= «−2.5» 가 이미 차지한 몫) · 주름·턱은 책에 없어 만들지 않는다.
      body: { hemExtensionBelowWaistCm: 20, hemSideOffsetCm: 2.5, yokeSeam: "T" }
    },
    {
      id: "bunka-bodice-U", label: "교재 U 요크 이음선 ③", familyId: "yoke-seam-3", symbol: "U", page: 34,
      description: "박시 몸판 · 어깨 요크 한 장(뒤 어깨 다트를 먼저 닫고 앞 요크와 어깨선에서 맞댄다) · 앞 이음선 = 어깨선과 평행 −6cm · 앞 AH 다트는 몸판에서 BP 축으로 닫아 이음선 쐐기가 개더 · 뒤 이음선 = 다트 끝 높이 수평 · 뒤 중심 개더 = (이음선−2)×0.5 · 밑단 옆 +1cm",
      source: "[패턴학교] 요크 이음선 ③ Ⓤ(P.34) · 처리 방법 2곳 이상 맞댄다(P.159) · 닫는다·벌린다(P.161)",
      baseMethod: "bunka-bodice-U-v1",
      // 사용자 확정(2026-10-02): 어깨 요크는 뒤 어깨 다트를 먼저 닫아 붙이고 그다음 앞 요크를 어깨선으로 붙인 한 장 · 앞·뒤 몸판은 별도 조각 ·
      //   앞 «6» = 어깨선에서의 수직거리 · BP 절개 = BP 와 앞 이음선 호길이 1/2점의 직선(연직 투영 아님 — 김님 최종 확정 2026-10-02) · 앞 쐐기 = 개더(●×0.6 은 결과 비율로만 기록) · 뒤 ∅ = 이음선 − 2 · 주름 수·턱은 책에 없어 만들지 않는다.
      body: { hemExtensionBelowWaistCm: 20, hemSideOffsetCm: 1, yokeSeam: "U" }
    },
    {
      id: "bunka-bodice-V", label: "교재 V 요크 이음선 ③ 변형", familyId: "yoke-seam-3", symbol: "V", page: 35,
      description: "Ⓤ 방법 + 앞뒤에서 개더 분량을 추가 · 어깨 요크·앞 이음선·BP→이음선 1/2점 절개·AH 쐐기는 Ⓤ 와 같다 · 뒤 중심 개더 띠 = ∅×1(∅ = 이음선 − 2) · 앞은 BP 에서 밑단까지 앞중심과 평행한 수직 절개를 넣어 앞중심 쪽 조각을 수평으로 평행 이동 — 총 앞 개더 = ● × 1.2(● = 이음선 − 양 끝 2cm×2) · 밑단 옆 +1. 도해 «5 정도» 는 평행 벌림 분량의 참고 결과(고정 5cm 가 아니다).",
      source: "[패턴학교] 요크 이음선 ③ Ⓥ(P.35) · 처리 방법 2곳 이상 맞댄다(P.159) · 닫는다(P.160) · 평행으로 잘라서 벌린다(P.162)",
      baseMethod: "bunka-bodice-V-v1",
      // 책이 정한 공식만: 뒤 ∅×1 · 앞 ●×1.2(총 초과분). 평행 벌림 d 는 «1.2● − Ⓤ 쐐기 g» 가 이음선에 더해지도록 수평 이동량을 푼다(주름 수·턱은 책에 없어 만들지 않는다).
      body: { hemExtensionBelowWaistCm: 20, hemSideOffsetCm: 1, yokeSeam: "V" }
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
      id: "bunka-bodice-E", label: "교재 E 프린세스 라인", familyId: "princess-line", symbol: "E", page: 18,
      description: "허리 다트 a·e 를 이음선으로 · 옆선 1cm 줄임 · 밑단 1cm 추가 · 앞 AH 다트는 BP 를 축으로 닫는다 · 앞·뒤 각각 중심·옆 2조각(총 4조각)",
      source: "[패턴학교] 프린세스 라인 Ⓔ(P.18) · 처리 방법 닫는다(P.160)",
      baseMethod: "bunka-bodice-E-v1",
      // 사용자 확정(2026-10-03, 도해 실측 기준 A안): 앞 어깨 절개 시작점 = 목점에서 어깨 호길이 50% · 어깨→BP 이음선 = 기준 직선에서 진동 쪽으로 최대 0.5cm 곡선 ·
      //   뒤 = 기존 어깨 다트 입구에서 시작 · 허리 다트 a·e 마름모는 이음선 축(위쪽 다트 끝 x)에 맞춘다 · 앞 AH 다트만 BP 고정 기본각으로 닫는다 ·
      //   어깨는 강체 회전이라 길이·직선 연속 보존. 몸판 파라미터는 Ⓒ 와 같다.
      body: { hemExtensionBelowWaistCm: 20, waistSideOffsetCm: -1, hemSideOffsetCm: 1, waistDartScales: { a: 1, b: 0, d: 0, e: 1 }, princess: "E" }
    },
    {
      id: "bunka-bodice-F", label: "교재 F 프린세스 라인(더 줄임)", familyId: "princess-line", symbol: "F", page: 19,
      description: "Ⓔ 와 같은 이음선·닫기 · 앞 다트 a + 1cm · 뒤 다트 e + 1.5cm · 옆선 각 1.5cm 줄임 · 밑단 1cm 추가(1개 이음선에서 줄일 수 있는 최대) · 앞·뒤 각각 중심·옆 2조각(총 4조각)",
      source: "[패턴학교] 프린세스 라인 Ⓕ(P.19) · Ⓔ(P.18) · 처리 방법 닫는다(P.160)",
      baseMethod: "bunka-bodice-F-v1",
      // 책 문장: «Ⓔ 와 같은 방법으로 더 줄인 디자인. 앞은 다트 a + 1cm, 뒤는 다트 e + 1.5cm, 옆선에서 각각 1.5cm 줄인다.» 도해 실측(마름모 폭 ≈ a+1 · e+1.5)이 «폭에 더한다»로 읽힘을 확인.
      //   다트 폭 +cm 는 마름모를 이음선 축 둘레 대칭으로 키운다(Ⓔ 의 잠긴 마름모 규칙 그대로). 어깨·BP·닫기 규칙은 Ⓔ 와 동일. 문서: docs/book/P019.md
      body: { hemExtensionBelowWaistCm: 20, waistSideOffsetCm: -1.5, hemSideOffsetCm: 1, waistDartScales: { a: 1, b: 0, d: 0, e: 1 }, waistDartExtraCm: { a: 1, e: 1.5 }, princess: "F" }
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
      if (k === "flareSlash") { if (v !== true) fail("invalid-body", id + ".flareSlash"); if (body.flare !== true) fail("flare-slash-needs-flare", id); return; }
      if (k === "waistSeam") { if (v !== true) fail("invalid-body", id + ".waistSeam"); return; }
      if (k === "yokeSeam") {
        if (v !== true && v !== "S" && v !== "T" && v !== "U" && v !== "V") fail("invalid-body", id + ".yokeSeam");   // true = Ⓠ·Ⓡ(P.30–31) · "S" = Ⓢ(P.32) · "T" = Ⓣ(P.33) · "U" = Ⓤ(P.34)
        if (body.waistSeam === true) fail("yoke-seam-waist-seam-conflict", id);
        if (body.flare != null) fail("yoke-seam-flare-conflict", id);
        return;
      }
      if (k === "waistDartExtraCm") {
        if (!v || typeof v !== "object" || Array.isArray(v)) fail("invalid-body", id + "." + k);
        Object.keys(v).forEach(function (sym) {
          if (DART_SYMBOLS.indexOf(sym) < 0) fail("unknown-dart-symbol", id + "." + k + "." + sym);
          if (!isNum(v[sym]) || v[sym] < 0) fail("invalid-body", id + "." + k + "." + sym);
        });
        return;
      }
      if (k === "princess") {
        if (v !== "E" && v !== "F") fail("invalid-body", id + ".princess");   // "E" = Ⓔ(P.18) · "F" = Ⓕ(P.19)
        if (body.waistSeam === true || body.yokeSeam != null || body.flare != null) fail("princess-conflict", id);
        return;
      }
      if (k === "yokeGather") {
        if (v !== true) fail("invalid-body", id + ".yokeGather");
        if (body.yokeSeam !== true) fail("yoke-gather-needs-yoke-seam", id);
        return;
      }
      if (k === "peplumCut") {
        if (v !== true && v !== "P") fail("invalid-body", id + ".peplumCut");
        if (body.waistSeam !== true) fail("peplum-cut-needs-waist-seam", id);
        if (body.peplumFlare === true) fail("peplum-cut-flare-conflict", id);
        return;
      }
      if (k === "peplumFlare") {
        if (v !== true) fail("invalid-body", id + ".peplumFlare");
        if (body.waistSeam !== true) fail("peplum-flare-needs-waist-seam", id);
        return;
      }
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
  // 요크 이음선 라인에서 body 파라미터에 해당하는 변형 기호(Q/R = 요크 ①, S = 요크 ②). 레코드의 body 와 비교한다. 없으면 null.
  function yokeVariantSymbol(body) {
    var ys = body && body.yokeSeam;
    if (ys !== true && ys !== "S" && ys !== "T" && ys !== "U" && ys !== "V") return null;
    var fam = (ys === "U" || ys === "V") ? "yoke-seam-3" : (ys === "S" || ys === "T") ? "yoke-seam-2" : "yoke-seam-1", want = body.yokeGather === true, hit = null;
    variants(fam).forEach(function (v) {
      var r = v.presetId ? get(v.presetId) : null;
      if (r && r.body.yokeSeam === ys && (ys !== true || (r.body.yokeGather === true) === want)) hit = v.symbol;
    });
    return hit;
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
    resolve: resolve, bodyParams: bodyParams, yokeVariantSymbol: yokeVariantSymbol, displayTitle: displayTitle,
    fields: function () { return clone(BODY_FIELDS); },
    validateRecord: validateRecord,
    PENDING_NOTE: PENDING_NOTE, DEFAULT_ID: DEFAULT_ID, DEFAULT_FAMILY_ID: DEFAULT_FAMILY_ID
  });
})();
