// ══════════════════════════════════════════════════════════════════════════════
// sleevePresets.js — 소매 라인 카탈로그 ([패턴학교] 기초 강의 2 「소매 패턴」, P.36–37 개요)
//
// 몸판(bodicePresets.js)·칼라(collarPresets.js)와 같은 구조다: family(교시 = 소매 종류) → variant(교재 표식) → record.
// ★ 소매 기호 Ⓐ~Ⓩ 는 몸판 `bunka-bodice-*` 와 **다른 네임스페이스**다(docs/book/P036.md) — id 는 `bunka-sleeve-*`.
// ★ 소매 10종류의 이름·시작 쪽·표지 기호는 P036 판독 표만 근거다. 아직 판독하지 않은 라인의 변형(Ⓑ 다음 기호 등)은
//   **슬롯을 만들지 않는다** — 표지 대표 기호 하나만 «보류»로 두고, 왜 못 만드는지(blockedBy)를 들고 있게 한다.
//
// (돌먼 Ⓡ 은 소매 Ⓐ 가 아니라 몸판 Ⓐ 에서 몸판·소매를 함께 제도한다 — designSleeveR.)
// 지금 실행 가능한 것은 **스트레이트 Ⓐ · 타이트 Ⓑ · Ⓒ · 플레어 Ⓓ · Ⓔ · 턱 Ⓕ · Ⓖ · 퍼프 Ⓗ · Ⓘ · Ⓙ · Ⓚ · 반소매 Ⓛ · Ⓜ 열세 개**다(Ⓒ = 뒤 소맷부리 다트, `designSleeveC`). Ⓑ(P.41)는 Ⓐ 를 출발 원형으로 소맷부리를 W×3/4 로 맞댄다(`designSleeveB`).
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
        { key: "tuckCm", label: "턱 분량(각)", unit: "cm", defaultValue: 1.5 }] },
    // Ⓖ: 소매산 높이 2등분 위만 a(±1→중심점)·b(±3→2등분 선 ±2) 절개. 가운데 ★ 상승 → a 벌림 → 좌우 ☆ 기준 b 벌림.
    //   턱(기본 1.5 · 최대 2, 책 본문)과 ★(기본 3)는 독립 설정값(김님: 공식 아님) — 성립하지 않는 조합은 엔진 기하 가드가 거부.
    { id: "bunka-sleeve-G", familyId: "tuck-sleeve", symbol: "G",
      method: "tuck-cap-half-slash-from-sleeve-A", methodPage: 43,
      inputs: [{ key: "sleeveLengthCm", label: "소매길이", unit: "cm" },
        { key: "tuckCm", label: "턱 분량(각)", unit: "cm", defaultValue: 1.5 },
        { key: "starCm", label: "★ 가운데 상승", unit: "cm", defaultValue: 3 }] },
    // Ⓗ: EL 아래만 a(중심선)·b(반폭 중점) 절개 — 가운데 ★ 내림 → a → 바깥 ☆ 기준 b. 커프스 달림 ● = 손바닥 + 3, ∅ = ● − ■(■ = Ⓐ 소맷부리 − ●), 각 ∅/3.
    //   김님 확정 기본값(모두 수정 가능): EL 31.4 · 손바닥 21 · ★ 3.5 · 커프스 폭 1(치수 정보만). 소맷부리는 8 끝점 통과 곡선(S 굽이 허용 — 화면 검토용 시안).
    { id: "bunka-sleeve-H", familyId: "puff-sleeve", symbol: "H",
      method: "puff-below-el-slash-from-sleeve-A", methodPage: 44,
      inputs: [{ key: "sleeveLengthCm", label: "소매길이", unit: "cm" },
        { key: "elbowLengthCm", label: "팔꿈치 길이 EL", unit: "cm", defaultValue: 31.4 },
        { key: "palmCircumferenceCm", label: "손바닥 둘레", unit: "cm", defaultValue: 21 },
        { key: "dropCm", label: "★ 가운데 내림", unit: "cm", defaultValue: 3.5 }] },
    // Ⓘ: Ⓔ 와 같은 절개·이동(가운데 SP 대칭 → 바깥 이동 기준점) + 벌림량은 Ⓗ 커프스 산식(∅ = ● − ■, 각 ∅/3). 입력 = 소매길이 · 손바닥(기본 21). 화면 검토용 시안.
    { id: "bunka-sleeve-I", familyId: "puff-sleeve", symbol: "I",
      method: "puff-cap-pivot-slash-from-sleeve-A", methodPage: 44,
      inputs: [{ key: "sleeveLengthCm", label: "소매길이", unit: "cm" },
        { key: "palmCircumferenceCm", label: "손바닥 둘레", unit: "cm", defaultValue: 21 }] },
    // Ⓙ(P.45): Ⓐ 중심선을 잘라 두 반쪽을 좌우 ∅/2 평행 이동(회전 없음). ∅ = 0.7● − ■(개더 계수 0.7 = 책 설정). 소매산 꼭대기 +상승(기본 0.7 — 별개 설정값),
    //   틈 위만 국소 재제도 · 소맷부리 직선. 김님 승인 2026-10-12(docs/book/P045.md). 화면 검토용 시안.
    { id: "bunka-sleeve-J", familyId: "puff-sleeve", symbol: "J",
      method: "puff-center-parallel-spread-from-sleeve-A", methodPage: 45,
      inputs: [{ key: "sleeveLengthCm", label: "소매길이", unit: "cm" },
        { key: "palmCircumferenceCm", label: "손바닥 둘레", unit: "cm", defaultValue: 21 },
        { key: "riseCm", label: "소매산 상승", unit: "cm", defaultValue: 0.7 }] },
    // Ⓚ(P.45 하단): Ⓐ 에 절개 3개 — 가운데 좌우 ∅/6 평행(Ⓙ 방법) + 바깥 조각만 이동한 소매산 기준점에서 회전. ∅ = 1.5● − ■(개더 계수 1.5 = 책 설정), 틈마다 ∅/3.
    //   소매산 꼭대기 +상승(기본 0.7 — 별개 설정값) · 가운데 틈·기준점 꺾임 국소 재제도 · 소맷부리 전체 자연 곡선. 김님 승인 2026-10-13(docs/book/P045.md § Ⓚ). 화면 검토용 시안.
    { id: "bunka-sleeve-K", familyId: "puff-sleeve", symbol: "K",
      method: "puff-center-parallel-plus-cap-pivot-slash-from-sleeve-A", methodPage: 45,
      inputs: [{ key: "sleeveLengthCm", label: "소매길이", unit: "cm" },
        { key: "palmCircumferenceCm", label: "손바닥 둘레", unit: "cm", defaultValue: 21 },
        { key: "riseCm", label: "소매산 상승", unit: "cm", defaultValue: 0.7 }] },
    // Ⓛ(P.46 반소매 퍼프 «소맷부리를 잘라서 벌린다»): 소매길이 기본 20(SP → 출발 밑단)의 Ⓐ 에 절개 3개 — 가운데 SP 대칭 → 바깥 이동 기준점(Ⓘ 와 같은 이동).
    //   ● = 위팔 둘레(이 책 26) + 4 · ∅ = 0.5● − ■ · ⊠ = ∅/4 · 틈(현) 가운데 2⊠ · 양옆 ⊠. 김님 확정 2026-10-13(docs/book/P046.md). 화면 검토용 시안.
    //   sleeveLengthCm 의 defaultValue = 이 라인을 고를 때 소매길이 입력칸에 넣는 기본값(수정 가능 — 다른 라인은 기본값 없음).
    { id: "bunka-sleeve-L", familyId: "short-sleeve", symbol: "L",
      method: "short-puff-cap-pivot-slash-from-sleeve-A", methodPage: 46,
      inputs: [{ key: "sleeveLengthCm", label: "소매길이", unit: "cm", defaultValue: 20 },
        { key: "upperArmCm", label: "위팔 둘레", unit: "cm", defaultValue: 26 }] },
    // Ⓜ(P.46 하단 «소매산과 소맷부리를 잘라서 벌린다»): 소매길이 기본 20 의 Ⓐ 에 절개 5개(중심선 + 반폭 3등분 2개씩) — 가운데 평행(좌우 2⊠) → 중간 → 바깥 순서로 기준점 회전.
    //   ● = 위팔 + 4 · ∅ = 0.7● − ■ · ⊠ = ∅/10 · 틈(현) 1 : 2 : 4 : 2 : 1 · 상승 기본 0.5(개더 계수 0.7 과 별개). 김님 확정 2026-10-20(docs/book/P046.md § Ⓜ). 화면 검토용 시안.
    //   riseCm 의 defaultValue(0.5)도 이 라인을 고를 때 상승 입력칸에 넣는다(Ⓙ·Ⓚ 0.7 과 다름).
    { id: "bunka-sleeve-M", familyId: "short-sleeve", symbol: "M",
      method: "short-puff-center-parallel-plus-two-cap-pivot-slashes-from-sleeve-A", methodPage: 46,
      inputs: [{ key: "sleeveLengthCm", label: "소매길이", unit: "cm", defaultValue: 20 },
        { key: "upperArmCm", label: "위팔 둘레", unit: "cm", defaultValue: 26 },
        { key: "riseCm", label: "소매산 상승", unit: "cm", defaultValue: 0.5 }] },
    // Ⓝ(P.47 «소맷부리를 잘라서 벌린다(퍼프)» · 소맷부리 턱): 소매길이 기본 20 의 Ⓐ 에 절개 3개(중심선 + 좌우 각 2.5 평행선) — 가운데 SP 대칭 → 바깥 이동 기준점(Ⓛ 와 같은 이동).
    //   벌림(소맷부리 현) 가운데 4 · 양옆 각 2 · 턱은 중심 쪽으로 접음 · 박기 끝 1.5. 전부 책 기본 설정값(수정 가능 — 산식·불변 규칙 아님). 커프스·개더 없음.
    //   김님 확정 2026-10-20(docs/book/P047.md § Ⓝ). 화면 검토용 시안.
    { id: "bunka-sleeve-N", familyId: "short-sleeve", symbol: "N",
      method: "short-puff-hem-tuck-cap-pivot-slash-from-sleeve-A", methodPage: 47,
      inputs: [{ key: "sleeveLengthCm", label: "소매길이", unit: "cm", defaultValue: 20 },
        { key: "cutOffsetCm", label: "절개 위치(중심선 좌우 각)", unit: "cm", defaultValue: 2.5 },
        { key: "centerTuckCm", label: "가운데 벌림", unit: "cm", defaultValue: 4 },
        { key: "sideTuckCm", label: "양옆 벌림(각)", unit: "cm", defaultValue: 2 },
        { key: "stitchEndCm", label: "박기 끝(소맷부리에서)", unit: "cm", defaultValue: 1.5 }] },
    // Ⓞ(P.47 하단 «소매산과 소맷부리를 잘라서 벌린다(턱트 슬리브)»): 소매길이 기본 20 의 Ⓐ 에 평행 절개 4개 — 안쪽 = 중심에서 좌우 각 1.25(도해 «2.5» = 가운데 띠 폭),
    //   바깥 = 안쪽에서 2.5 더(도해 지시선) · 틈마다 2 평행 벌림(가운데 띠 고정) · 턱은 소매산·소맷부리 모두 바깥쪽(밑선 쪽) · 소맷부리 박기 끝 1.5(소매산 쪽 미지정).
    //   전부 책 기본 설정값(수정 가능). 김님 확정 2026-10-21(docs/book/P047.md § Ⓞ). 화면 검토용 시안.
    { id: "bunka-sleeve-O", familyId: "short-sleeve", symbol: "O",
      method: "short-tucked-parallel-slash-from-sleeve-A", methodPage: 47,
      inputs: [{ key: "sleeveLengthCm", label: "소매길이", unit: "cm", defaultValue: 20 },
        { key: "innerOffsetCm", label: "안쪽 절개(중심에서 좌우 각)", unit: "cm", defaultValue: 1.25 },
        { key: "cutSpacingCm", label: "절개 간격(안쪽 → 바깥)", unit: "cm", defaultValue: 2.5 },
        { key: "spreadCm", label: "벌림(틈마다)", unit: "cm", defaultValue: 2 },
        { key: "stitchEndCm", label: "박기 끝(소맷부리에서)", unit: "cm", defaultValue: 1.5 }] },
    // Ⓟ(P.48 «소맷부리를 잘라서 벌린다(플레어 슬리브)»): 소매길이 기본 20 의 Ⓐ 에 절개 5개(앞·뒤 반폭 3등분 + 중심선) — 가운데 SP 대칭 → 중간 → 바깥 조각을 운반된 기준점에서 회전.
    //   ● = Ⓐ 소매 폭 W · ∅ = W × 플레어 계수(기본 0.7 — 수정 가능) · ⊠ = ∅/10 · 틈 1:2:4:2:1 자동. 김님 확정 2026-10-26(docs/book/P048.md § Ⓟ). 화면 검토용 시안.
    { id: "bunka-sleeve-P", familyId: "short-sleeve", symbol: "P",
      method: "short-flare-cap-pivot-five-slashes-from-sleeve-A", methodPage: 48,
      inputs: [{ key: "sleeveLengthCm", label: "소매길이", unit: "cm", defaultValue: 20 },
        { key: "flareRatio", label: "플레어 계수(× 소매 폭)", unit: "", defaultValue: 0.7 }] },
    // Ⓠ(P.48 하단 «소맷부리선을 그린다(캡 슬리브)»): 같은 몸판 Ⓐ 의 소매산만 — 위팔선에서 위로 소매산 높이 × 비율(기본 1/4, 1/4 ~ 3/4) 수평선과 소매산의 두 교점을
    //   직선 소맷부리로 잇는다. 기장·앞뒤 호 길이는 입력하지 않는다. 김님 확정 2026-10-26(docs/book/P048.md § Ⓠ). 화면 검토용 시안.
    { id: "bunka-sleeve-Q", familyId: "short-sleeve", symbol: "Q",
      method: "cap-sleeve-horizontal-hem-on-sleeve-A-cap", methodPage: 48,
      inputs: [{ key: "heightRatio", label: "소매산 높이 비율(위팔선에서 위로)", unit: "", defaultValue: 0.25 }] },
    // Ⓡ(P.49 «돌먼 슬리브» — 몸판에 직접 제도): 소매 Ⓐ 가 아니라 **완료 몸판 Ⓐ** 에서 몸판과 소매를 새로 제도하는 결합 파생(파생 몸판 + 한 장 소매).
    //   책 수치는 전부 설정값(어깨 연장 5 · 옆 여유 뒤 3 / 앞 1.5 · 소매 폭선 5 · 소매 길이 26 · 소맷부리 아래 1.5), 팔꿈치 둘레 기본 22(P.8 참고 치수표) · 커프스 = 팔꿈치 + 4.
    //   곡선 핸들(0.4 · 1/3)은 구현 관례. 김님 확정 2026-10-27(docs/book/P049.md). 화면 검토용 시안. 몸판 Ⓐ 외 출발 몸판은 형상 게이트가 거부한다.
    { id: "bunka-sleeve-R", familyId: "dolman-sleeve", symbol: "R",
      method: "dolman-drafted-on-bodice-A-one-piece-sleeve", methodPage: 49,
      inputs: [{ key: "shoulderExtCm", label: "어깨 연장", unit: "cm", defaultValue: 5 },
        { key: "backSideEaseCm", label: "옆 여유(뒤)", unit: "cm", defaultValue: 3 },
        { key: "frontSideEaseCm", label: "옆 여유(앞)", unit: "cm", defaultValue: 1.5 },
        { key: "capHeightCm", label: "소매 폭선 위치(새 SP 에서)", unit: "cm", defaultValue: 5 },
        { key: "sleeveLengthCm", label: "소매 길이(새 SP 에서)", unit: "cm", defaultValue: 26 },
        { key: "elbowGirthCm", label: "팔꿈치 둘레", unit: "cm", defaultValue: 22 },
        { key: "cuffAddCm", label: "커프스 더하기(팔꿈치 + )", unit: "cm", defaultValue: 4 },
        { key: "hemDropCm", label: "소맷부리 아래(밑선 연장)", unit: "cm", defaultValue: 1.5 },
        { key: "armholeHandle", label: "몸판 진동 부푼 정도(핸들 × 현)", unit: "", defaultValue: 0.4 },
        { key: "capHandle", label: "소매산 부푼 정도(핸들 × 현)", unit: "", defaultValue: 1 / 3 }] }
  ];

  function pendingFamily(id, order, label, symbol, page) {
    return { id: id, order: order, label: label, symbol: symbol, page: page, availability: "pending-page", note: PENDING_NOTE,
      familyNote: "표지 대표 기호만 확인됨 — 나머지 변형은 쪽 판독 후.",
      variants: [{ id: "bunka-sleeve-" + symbol, symbol: symbol, label: symbol + " · " + label, page: page, availability: "pending-page",
        presetId: null, blockedBy: BLOCKED, note: PENDING_NOTE }] };
  }

  // 반소매(P.46–48)의 아직 구현하지 않은 변형: 제목만 판독(2026-10-13) — 본문·도해 해석과 김님 확정 전이라 보류(blockedBy 를 들고 있다).
  var SHORT_BLOCKED = "제목만 판독했다(P.46–48) — 본문·도해 해석과 김님의 도메인 확정(치수·분량·마무리)이 아직 없다. 변형마다 읽기 전용 해석 → 승인 후 별도 착수";
  function shortPending(symbol, title, page) {
    return { id: "bunka-sleeve-" + symbol, symbol: symbol, label: symbol + " · " + title, page: page, availability: "pending-page",
      presetId: null, blockedBy: SHORT_BLOCKED, note: PENDING_NOTE };
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
      familyNote: "Ⓕ — 소매 Ⓐ 에 소매 중심선과 평행한 절개 4개(중심 ±1·±3cm)를 넣고, 가운데 띠를 고정한 채 소맷부리를 기준점으로 소매산을 벌려 턱 4개(각 기본 1.5cm · 최대 3cm). 소맷부리·소매산 높이는 그대로, 소매폭이 조금 넓어진다. 턱은 바깥쪽으로 접고 중심 쪽 천이 위. Ⓖ — 소매산 높이 2등분 위만 a·b 절개: 가운데를 ★ 만큼 올리며 a 를 벌리고 좌우를 ☆ 기준으로 돌려 b 를 벌린다(턱·★ 독립 입력, 소매산이 높아진다).",
      variants: [
        { id: "bunka-sleeve-F", symbol: "F", label: "F · 평행 절개 4개 · 소맷부리 기준점 · 턱 분량 입력(소매 Ⓐ 기반)", page: 43, methodPage: 43,
          availability: "available", presetId: "bunka-sleeve-F", note: null },
        { id: "bunka-sleeve-G", symbol: "G", label: "G · 소매산 높이 2등분 위 a·b 절개 · 턱 분량·★ 입력(소매 Ⓐ 기반)", page: 43, methodPage: 43,
          availability: "available", presetId: "bunka-sleeve-G", note: null }
      ] },
    { id: "puff-sleeve", order: 5, label: "퍼프 소매", symbol: "H", page: 44, availability: "available", note: null,
      familyNote: "Ⓗ — 소매 Ⓐ 의 EL(팔꿈치) 아래만 절개: 가운데 두 조각을 ★ 만큼 내려 중심선 위 기준점에서 벌리고(a), 바깥 두 조각을 ☆(EL × 옆선)에서 벌린다(b). 벌린 소맷부리를 커프스(손바닥 + 3)에 개더로 단다(개더 = 커프스의 1배). Ⓘ — 절개 3개(반폭 중점·중심선)를 소매산 기준점에서 벌린다(가운데 SP 대칭, 개더 분량은 Ⓗ 와 같고 소매 폭 전체가 넓어짐). 화면 검토용 시안.",
      variants: [
        { id: "bunka-sleeve-H", symbol: "H", label: "H · EL 아래 a·b 절개 · 소맷부리만 벌림 · 커프스 개더(소매 Ⓐ 기반, 시안)", page: 44, methodPage: 44,
          availability: "available", presetId: "bunka-sleeve-H", note: null },
        { id: "bunka-sleeve-I", symbol: "I", label: "I · 소매산 기준점 절개 3개 · 소맷부리만 벌림 · 커프스 개더(소매 Ⓐ 기반, 시안)", page: 44, methodPage: 44,
          availability: "available", presetId: "bunka-sleeve-I", note: null },
        { id: "bunka-sleeve-J", symbol: "J", label: "J · 중심선 평행 벌림 · 소매산 상승 · 커프스 개더(소매 Ⓐ 기반, 시안)", page: 45, methodPage: 45,
          availability: "available", presetId: "bunka-sleeve-J", note: null },
        { id: "bunka-sleeve-K", symbol: "K", label: "K · 중심선 평행 벌림 + 소매산 기준점 절개 2개 · 커프스 개더 1.5배(소매 Ⓐ 기반, 시안)", page: 45, methodPage: 45,
          availability: "available", presetId: "bunka-sleeve-K", note: null }
      ] },
    { id: "short-sleeve", order: 6, label: "반소매", symbol: "L", page: 46, availability: "available", note: null,
      familyNote: "6교시 «반소매의 변형»(P.46–48): Ⓛ·Ⓜ·Ⓝ·Ⓞ·Ⓟ·Ⓠ. 지금 실행 가능한 것은 Ⓛ·Ⓜ·Ⓝ·Ⓞ·Ⓟ·Ⓠ — 짧은 소매 Ⓐ(소매길이 기본 20)에 절개를 넣어 벌린다. Ⓛ = 절개 3개 · 소맷부리만 · 커프스 개더 0.5배 · Ⓜ = 절개 5개 · 가운데 평행 + 소매산 상승 0.5 · 커프스 개더 0.7배 · Ⓝ = 절개 3개 · 소맷부리 턱(중심 쪽 · 박기 끝 1.5, 커프스 없음) · Ⓞ = 평행 절개 4개 · 소매산·소맷부리 턱(바깥쪽) · Ⓟ = 절개 5개 · 소맷부리 플레어(소매 폭 × 0.7) · Ⓠ = 캡 슬리브(소매산 높이 1/4 수평 · 직선 소맷부리). 화면 검토용 시안.",
      variants: [
        { id: "bunka-sleeve-L", symbol: "L", label: "L · 소맷부리를 잘라서 벌린다(퍼프) · 절개 3개 2:1:1 · 커프스 개더 0.5배(소매 Ⓐ 기반, 시안)", page: 46, methodPage: 46,
          availability: "available", presetId: "bunka-sleeve-L", note: null },
        { id: "bunka-sleeve-M", symbol: "M", label: "M · 소매산과 소맷부리를 잘라서 벌린다(퍼프) · 절개 5개 1:2:4:2:1 · 상승 0.5 · 커프스 개더 0.7배(소매 Ⓐ 기반, 시안)", page: 46, methodPage: 46,
          availability: "available", presetId: "bunka-sleeve-M", note: null },
        { id: "bunka-sleeve-N", symbol: "N", label: "N · 소맷부리를 잘라서 벌린다(퍼프 · 소맷부리 턱) · 절개 3개 · 벌림 4 · 2 · 턱 중심 쪽 · 박기 끝 1.5(소매 Ⓐ 기반, 시안)", page: 47, methodPage: 47,
          availability: "available", presetId: "bunka-sleeve-N", note: null },
        { id: "bunka-sleeve-O", symbol: "O", label: "O · 소매산과 소맷부리를 잘라서 벌린다(턱트) · 평행 절개 4개 · 틈마다 2 · 턱 바깥쪽 · 박기 끝 1.5(소매 Ⓐ 기반, 시안)", page: 47, methodPage: 47,
          availability: "available", presetId: "bunka-sleeve-O", note: null },
        { id: "bunka-sleeve-P", symbol: "P", label: "P · 소맷부리를 잘라서 벌린다(플레어) · 절개 5개 1:2:4:2:1 · 계수 0.7(소매 Ⓐ 기반, 시안)", page: 48, methodPage: 48,
          availability: "available", presetId: "bunka-sleeve-P", note: null },
        { id: "bunka-sleeve-Q", symbol: "Q", label: "Q · 소맷부리선을 그린다(캡) · 소매산 높이 1/4 수평 · 직선 소맷부리(소매 Ⓐ 소매산, 시안)", page: 48, methodPage: 48,
          availability: "available", presetId: "bunka-sleeve-Q", note: null }
      ] },
    { id: "dolman-sleeve", order: 7, label: "돌먼 소매", symbol: "R", page: 49, availability: "available", note: null,
      familyNote: "Ⓡ — 몸판 Ⓐ 에 직접 제도한다: 뒤 어깨 다트를 닫아 진동 쪽으로 벌리고, 어깨 5 연장 · 옆 여유 뒤 3 / 앞 1.5 · 진동 아랫점을 WL 까지. 연장한 어깨선 = 소매 중심선(새 SP 에서 26), 소매 폭선에서 소매 밑점(교차점 아래 몸판 진동과 같은 길이), 소맷부리 ● = 팔꿈치 둘레 + 4(개더 1배). 앞뒤 소매 중심선을 맞대 한 장 소매. 앞 AH 다트는 박지 않는다. 화면 검토용 시안(몸판 Ⓐ 만).",
      variants: [
        { id: "bunka-sleeve-R", symbol: "R", label: "R · 몸판 Ⓐ 에 직접 제도 · 한 장 소매 · 커프스 개더 1배(몸판 Ⓐ 만, 시안)", page: 49, methodPage: 49,
          availability: "available", presetId: "bunka-sleeve-R", note: null },
        { id: "bunka-sleeve-S", symbol: "S", label: "S · Ⓡ 방법 + 소매 중심에 개더 분량 추가", page: 49, availability: "pending-page",
          presetId: null, blockedBy: "Ⓡ 시안 확인(김님) 전 — 개더 분량·벌림 위치(본문 «소매 중심에 개더 분량 추가») 판독과 확정이 아직 없다", note: PENDING_NOTE }
      ] },
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
