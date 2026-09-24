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
    { key: "bandWidthCm", label: "밴드 폭", unit: "cm", min: 0, minExclusive: true },
    { key: "frontRiseCm", label: "앞 중심 올림", unit: "cm", min: 0 },
    { key: "frontEndCm", label: "앞 끝선(앞 중심선 앞)", unit: "cm", min: 0 }
  ];
  // 단독 스탠드 칼라(family 1, 교재 P.146). 셔츠 칼라 밴드의 frontEndCm 과 의미를 공유하지 않는다.
  var STANDALONE_FIELDS = [
    { key: "collarWidthCm", label: "칼라 폭", unit: "cm", min: 0, minExclusive: true },
    { key: "frontRiseCm", label: "앞 중심 올림", unit: "cm", min: 0 },
    { key: "topSetbackCm", label: "앞 윗끝 물림", unit: "cm", min: 0 }
  ];
  // 한 장 셔츠 칼라(family 2, 교재 P.147) 실행 파라미터. 키 순서 = designCollar.computeOnePiece 계약.
  var ONE_PIECE_FIELDS = [
    { key: "riseCm", label: "올림 치수(★)", unit: "cm", min: 0, minExclusive: true },
    { key: "backCollarWidthCm", label: "뒤 칼라 폭", unit: "cm", min: 0, minExclusive: true },
    { key: "collarStandCm", label: "칼라 허리", unit: "cm", min: 0, minExclusive: true },
    { key: "frontCollarWidthCm", label: "앞 칼라 폭", unit: "cm", min: 0, minExclusive: true },
    { key: "tipProjectionCm", label: "칼라 끝(수평)", unit: "cm", min: 0 },
    { key: "attachCurveCm", label: "달림선 곡률", unit: "cm", min: 0 }
  ];
  // 오픈 칼라(family 2 안의 몸판 연동 제도, 교재 L P.65) 실행 파라미터. 키 순서 = designCollar.computeOpenCollar 계약.
  //   G~K 의 ONE_PIECE_FIELDS 와 의미를 공유하지 않는다(올림 ★·앞 칼라 폭·칼라 끝이 없고, 몸판 꺾임선 치수가 있다).
  var OPEN_COLLAR_FIELDS = [
    { key: "backCollarWidthCm", label: "뒤 칼라 폭", unit: "cm", min: 0, minExclusive: true },
    { key: "collarStandCm", label: "칼라 허리", unit: "cm", min: 0, minExclusive: true },
    { key: "frontEndRiseCm", label: "앞 끝 올림(기초선 위)", unit: "cm", min: 0 },
    { key: "frontStraightCm", label: "앞 직선 구간", unit: "cm", min: 0, minExclusive: true },
    { key: "breakPointDistanceCm", label: "앞목점→꺾임 끝(직선)", unit: "cm", min: 0, minExclusive: true }
  ];
  // 윙 칼라(교재 Q, P.68) 칼라 끝 파라미터. 키 순서 = designCollar.computeWingTip 계약.
  //   세로 성분 √(앞변²−후퇴²)은 **파생값**이라 입력에 두지 않는다.
  var WING_TIP_FIELDS = [
    { key: "tipBaseCm", label: "꺾임선 위 밑변(앞끝→뒤)", unit: "cm", min: 0, minExclusive: true },
    { key: "tipSetbackCm", label: "칼라 끝 수평 후퇴", unit: "cm", min: 0, minExclusive: true },
    { key: "tipEdgeCm", label: "칼라 끝 앞변(직선)", unit: "cm", min: 0, minExclusive: true }
  ];
  // 밴드+위 칼라 한 장(교재 R, P.68) 위 칼라 파라미터. 키 순서 = designCollar.computeBandOnePiece 계약.
  //   외곽 뒤 구간은 **몸판 뒤 목둘레 ×** 에서 오므로 입력에 두지 않는다(파생).
  var UPPER_ONE_PIECE_FIELDS = [
    { key: "upperWidthCm", label: "위 칼라 폭(CB)", unit: "cm", min: 0, minExclusive: true },
    { key: "frontWidthCm", label: "앞 칼라 폭(Ⓒ에서 수직)", unit: "cm", min: 0, minExclusive: true },
    { key: "outerBowCm", label: "외곽 앞 구간 처짐", unit: "cm", min: 0 }
  ];
  // Q 는 교재 본문대로 밴드의 **꺾임선을 수평 직선**으로 긋는다(type 계약 — 레코드 수치가 아니다).
  var WING_STAND_OPTIONS = { horizontalTopLine: true };
  var BODY_FIELDS = [
    { key: "gapCm", label: "위칼라 gap(CB)", unit: "cm", min: 0, minExclusive: true },
    { key: "cbWidthCm", label: "위칼라 CB 폭", unit: "cm", min: 0, minExclusive: true },
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
  // variant 의 교재 표식(symbol)은 **안정 필드**다 — 표시 제목은 label 문자열을 파싱하지 않고 이 값을 쓴다.
  function pendingVariant(id, symbol, label) { return { id: id, symbol: symbol, label: label, availability: "pending-source", presetId: null, note: PENDING_NOTE }; }
  // 참고 도면 수치 표시 순서·의미(라벨). frontEndMark 는 **도면 표기이고 기하학적 의미는 미확정**이라 그대로 적는다.
  var REFERENCE_FIELDS = [
    { key: "backCollarWidthCm", label: "뒤 칼라 폭", unit: "cm" },
    { key: "frontCollarWidthCm", label: "앞 칼라 폭", unit: "cm" },
    { key: "collarStandCm", label: "칼라 허리", unit: "cm" },
    { key: "riseCm", label: "올림 치수(★)", unit: "cm" },
    { key: "frontEndMarkCm", label: "도면 앞쪽 표기(의미 미확정)", unit: "cm" },
    { key: "attachCurveMarkCm", label: "달림선 곡률 표기", unit: "cm" }
  ];
  // family 3 참고 전용 variant(실행 수치 아님). 제도 근거가 확정되지 않은 O·Q·R.
  //   unresolved = **이 수치를 좌표로 옮기려면 확정돼야 하는 기준(자유도)**. 비어 있지 않으면 실행하지 않는다.
  function bandRefVariant(id, symbol, label, page, ref, note, methodPage, unresolved) {
    var v = pendingVariant(id, symbol, label);
    v.page = page; v.bandReference = ref; v.referenceNote = note;
    if (methodPage) v.requiresMethodPage = methodPage;
    if (unresolved) { v.unresolved = unresolved; v.note = "제도 기준 미확정"; }
    return v;
  }
  var CATALOG = [
    // 스탠드 family: A~F는 P.60~62 도면과 P.146 제도법을 기반으로 실행 가능.
    { id: "stand-collar", order: 1, label: "스탠드 칼라", symbol: "A", page: 60, generator: "stand-collar-v1", availability: "available", note: null,
      variants: [
        { id: "bunka-stand-collar-A", symbol: "A", label: "A · 앞 중심 올림 1cm", page: 60, availability: "available", presetId: "bunka-stand-collar-A", note: null },
        { id: "bunka-stand-collar-B", symbol: "B", label: "B · 달림선 수평", page: 60, availability: "available", presetId: "bunka-stand-collar-B", note: null },
        { id: "bunka-stand-collar-C", symbol: "C", label: "C · 앞 중심 올림 3cm", page: 61, availability: "available", presetId: "bunka-stand-collar-C", note: null },
        { id: "bunka-stand-collar-D", symbol: "D", label: "D · 앞 중심 올림 8.5cm", page: 61, availability: "available", presetId: "bunka-stand-collar-D", note: null },
        { id: "bunka-stand-collar-E", symbol: "E", label: "E · 몸판 앞끝까지 연장", page: 62, availability: "available", presetId: "bunka-stand-collar-E", note: null },
        { id: "bunka-stand-collar-F", symbol: "F", label: "F · 넓힌 목선·잘라서 벌림", page: 62, availability: "available", presetId: "bunka-stand-collar-F", note: null }
      ] },
    // 셔츠 칼라(한 장 구조): 달림선·칼라 허리·꺾임선·외곽선·칼라 끝이 한 조각. family 3(M, 밴드+위칼라 2피스)와
    //   생성 구조가 다르다. G~J 는 앞뒤 칼라 폭을 고정한 채 칼라 허리·올림(★)만 바꿔 비교한 계열,
    //   K 는 I 의 앞 달림선 곡선을 반대로 그린 변형, L 은 꺾임선을 앞중심에서 떨어뜨린 오픈 칼라(몸판 연동).
    //   ★ L 은 목둘레 길이만으로 독립 생성되지 않는다 — 몸판 앞 목둘레선·여밈 끝선에서 꺾임선을 먼저 그린다.
    { id: "shirt-collar-one-piece", order: 2, label: "셔츠 칼라", symbol: "G", page: 63, generator: "shirt-one-piece-v1", availability: "available", note: null,
      reference: {
        pages: [63, 64, 65], methodPage: METHOD_PAGE,
        structure: "한 장 구조(달림선·칼라 허리·꺾임선·외곽선·칼라 끝)",
        attachLine: "달림선 길이 = 몸판 뒤목(×) + 앞목(⊘)",
        commonWidths: "G~J 공통 뒤 칼라 폭 3.5cm · 앞 칼라 폭 6.5cm",
        fitting: "수치를 바꾸면 칼라 외곽 치수가 부족·과다해 가봉 필요(교재 본문)"
      },
      variants: [
        // G~L 실행 가능. G~K 는 P.147 한 장 제도(RECORDS 의 onePiece 가 수치 출처),
        //   L 은 같은 family 안의 **몸판 연동 오픈 칼라**(RECORDS 의 openCollar · designCollar.computeOpenCollar)다.
        { id: "bunka-shirt-collar-G", symbol: "G", label: "G · 칼라 허리 3cm", page: 63, availability: "available", presetId: "bunka-shirt-collar-G", note: null },
        { id: "bunka-shirt-collar-H", symbol: "H", label: "H · 칼라 허리 1cm", page: 63, availability: "available", presetId: "bunka-shirt-collar-H", note: null },
        { id: "bunka-shirt-collar-I", symbol: "I", label: "I · 칼라 허리 2cm", page: 64, availability: "available", presetId: "bunka-shirt-collar-I", note: null },
        { id: "bunka-shirt-collar-J", symbol: "J", label: "J · 칼라 허리 4cm", page: 64, availability: "available", presetId: "bunka-shirt-collar-J", note: null },
        { id: "bunka-shirt-collar-K", symbol: "K", label: "K · 앞 달림선 곡선 반대", page: 65, availability: "available", presetId: "bunka-shirt-collar-K", note: null },
        { id: "bunka-shirt-collar-L", symbol: "L", label: "L · 오픈 칼라(몸판 연동)", page: 65, availability: "available", presetId: "bunka-shirt-collar-L", note: null }
      ] },
    // 구현된 유일한 family: 밴드 + 위칼라 2피스(designCollar.computeStand/computeBody).
    { id: "shirt-collar-with-band", order: 3, label: "칼라 밴드 달린 셔츠 칼라", symbol: "M", page: 66, generator: "shirt-collar-with-band-v2", availability: "available", note: null,
      variants: [
        { id: "bunka-shirt-collar-M", symbol: "M", label: "M · 올림 1 · 간격 3", page: 66, availability: "available", presetId: "bunka-shirt-collar-M", note: null },
        { id: "bunka-band-collar-N", symbol: "N", label: "N · 올림 3 · 간격 7", page: 66, availability: "available", presetId: "bunka-band-collar-N", note: null },
        // O: 올림 8.5 라 D(P.61) 방식으로 기초선을 ×+⊘−2.5 로 줄이고 앞쪽 2/3 안내점 Ⓐ 를 2 올린다.
        //    (P.146 ⑥·P.148 ⑥ 의 유일한 명명 안내점이 Ⓐ 이고, 올려야 ⑭ 뒤 중심 수정이 성립한다.)
        { id: "bunka-band-collar-O", symbol: "O", label: "O · 올림 8.5 · 간격 14", page: 67, availability: "available", presetId: "bunka-band-collar-O", note: null },
        { id: "bunka-band-collar-P", symbol: "P", label: "P · 밴드 폭 5 · 올림 3", page: 67, availability: "available", presetId: "bunka-band-collar-P", note: null },
        // Q: 수평 꺾임선 밴드 + 앞 위 끝 칼라 끝(7·1.5·4.5 는 전부 꺾임선·Ⓒ 기준).
        { id: "bunka-band-collar-Q", symbol: "Q", label: "Q · 윙 칼라", page: 68, availability: "available", presetId: "bunka-band-collar-Q", note: null },
        // R: 밴드 윗선을 경계로 위 칼라를 한 장으로 잇는다(외곽 뒤 구간 = 뒤 목둘레 ×).
        { id: "bunka-band-collar-R", symbol: "R", label: "R · 밴드+위칼라 한 장", page: 68, availability: "available", presetId: "bunka-band-collar-R", note: null }
      ] },
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
      id: "bunka-stand-collar-A",
      label: "교재 A 기본형",
      description: "단독 스탠드 칼라 A형(폭 3.5·앞 중심 올림 1·앞 윗끝 물림 0.5)",
      source: "『パターン製作の基礎』 스탠드 칼라 A형(P.60) · 제도 방법 P.146",
      type: "stand-collar", baseMethod: "bunka-stand-collar-A-P146-v1",
      neckline: { requiredType: "shirt", enforcement: "metadata-only" }, familyId: "stand-collar",
      construction: { fitNeckSeam: false, baselineReductionCm: 0, guideRiseCm: 0 },
      standalone: { collarWidthCm: 3.5, frontRiseCm: 1, topSetbackCm: 0.5 }
    },
    {
      id: "bunka-stand-collar-B",
      label: "교재 B 수평형",
      description: "단독 스탠드 칼라 B형(폭 3.5·달림선 수평·앞 윗끝 물림 0.5)",
      source: "『パターン製作の基礎』 스탠드 칼라 B형(P.60) · 제도 방법 P.146",
      type: "stand-collar", baseMethod: "bunka-stand-collar-B-P146-v1",
      neckline: { requiredType: "shirt", enforcement: "metadata-only" }, familyId: "stand-collar",
      construction: { fitNeckSeam: false, baselineReductionCm: 0, guideRiseCm: 0 },
      standalone: { collarWidthCm: 3.5, frontRiseCm: 0, topSetbackCm: 0.5 }
    },
    {
      id: "bunka-stand-collar-C",
      label: "교재 C 3cm 올림형",
      description: "단독 스탠드 칼라 C형(폭 3.5·앞 중심 올림 3·앞 윗끝 물림 0.5·CB 길이 보정)",
      source: "『パターン製作の基礎』 스탠드 칼라 C형(P.61) · 제도 방법 P.146",
      type: "stand-collar", baseMethod: "bunka-stand-collar-C-P146-v1",
      neckline: { requiredType: "shirt", enforcement: "metadata-only" }, familyId: "stand-collar",
      construction: { fitNeckSeam: true, baselineReductionCm: 0, guideRiseCm: 0 },
      standalone: { collarWidthCm: 3.5, frontRiseCm: 3, topSetbackCm: 0.5 }
    },
    {
      id: "bunka-stand-collar-D",
      label: "교재 D 8.5cm 올림형",
      description: "단독 스탠드 칼라 D형(폭 3.5·앞 중심 올림 8.5·기초선 2.5 감산·중간점 2 올림·CB 길이 보정)",
      source: "『パターン製作の基礎』 스탠드 칼라 D형(P.61) · 제도 방법 P.146",
      type: "stand-collar", baseMethod: "bunka-stand-collar-D-P146-v1",
      neckline: { requiredType: "shirt", enforcement: "metadata-only" }, familyId: "stand-collar",
      construction: { fitNeckSeam: true, baselineReductionCm: 2.5, guideRiseCm: 2 },
      standalone: { collarWidthCm: 3.5, frontRiseCm: 8.5, topSetbackCm: 0.5 }
    },
    {
      id: "bunka-stand-collar-E",
      label: "교재 E 앞끝 연장형",
      description: "단독 스탠드 칼라 E형(B형 수평 달림선·몸판의 실제 앞중심→앞끝 길이만큼 평행 연장)",
      source: "『パターン製作の基礎』 스탠드 칼라 E형(P.62) · 제도 방법 P.146",
      type: "stand-collar", baseMethod: "bunka-stand-collar-E-P146-v1",
      neckline: { requiredType: "shirt", enforcement: "metadata-only" }, familyId: "stand-collar",
      construction: { fitNeckSeam: false, baselineReductionCm: 0, guideRiseCm: 0, extendToFrontEdge: true },
      standalone: { collarWidthCm: 3.5, frontRiseCm: 0, topSetbackCm: 0.5 }
    },
    {
      id: "bunka-stand-collar-F",
      label: "교재 F 목선 직접 제도형",
      description: "단독 스탠드 칼라 F형(뒤중심 2·SNP/앞중심 3 목선, 폭 3, 외곽 0.2×3 잘라서 벌림)",
      source: "『パターン製作の基礎』 스탠드 칼라 F형(P.62) · 제도 방법 P.146",
      type: "stand-collar", baseMethod: "bunka-stand-collar-F-P146-v1",
      neckline: { requiredType: "stand-f", enforcement: "metadata-only" }, familyId: "stand-collar",
      construction: { fitNeckSeam: false, baselineReductionCm: 0, guideRiseCm: 0,
        requiresNecklineProfile: "stand-f", slashSpreadCm: 0.2, slashCount: 3 },
      standalone: { collarWidthCm: 3, frontRiseCm: 0, topSetbackCm: 0 }
    },
    {
      id: "bunka-shirt-collar-M",
      label: "교재 M 기본형",
      description: "칼라 밴드 달린 셔츠 칼라 M형(올림 1·간격 3)",
      source: "『パターン製作の基礎』 칼라 밴드 달린 셔츠 칼라 M형(P.66) · 제도 방법 P.148",
      type: "shirt-two-piece",
      baseMethod: "bunka-band-collar-P148-v1",
      // 몸판 셔츠 목선 전제(앞·뒤 SNP +1·앞 FNP 1 내림)는 몸판 네크라인 단계의 별도 프리셋이다.
      //   여기서는 기록만 한다 — 카라 적용이 bodiceResult 를 확인·변경하지 않는다.
      neckline: { requiredType: "shirt", enforcement: "metadata-only" },
      familyId: "shirt-collar-with-band",   // catalog family(생성 구조) 연결. 값·키 순서·hash 와 무관한 메타.
      stand: { bandWidthCm: 3, frontRiseCm: 1, frontEndCm: 0.5 },
      body: { gapCm: 3, cbWidthCm: 4, frontProjectionCm: 1.5, pointDiagonalCm: 6, outerBowCm: 0 }
    },
    {
      // 교재 N(P.66) — M 과 같은 P.148 제도, 앞 중심 올림 3·간격 7·앞 수평 2.
      id: "bunka-band-collar-N", label: "교재 N", description: "칼라 밴드 달린 셔츠 칼라 N형(올림 3·간격 7)",
      source: "『パターン製作の基礎』 칼라 밴드 달린 셔츠 칼라 N형(P.66) · 제도 방법 P.148",
      type: "shirt-two-piece", baseMethod: "bunka-band-collar-P148-v1",
      neckline: { requiredType: "shirt", enforcement: "metadata-only" }, familyId: "shirt-collar-with-band",
      stand: { bandWidthCm: 3, frontRiseCm: 3, frontEndCm: 0.5 },
      body: { gapCm: 7, cbWidthCm: 4, frontProjectionCm: 2, pointDiagonalCm: 6, outerBowCm: 0 }
    },
    {
      // 교재 O(P.67) — 본문 "칼라 밴드는 앞 중심에서 올리는 치수가 많으므로 Ⓓ(P.61)와 같이
      //   수평선상에서 줄여둔다. 치수를 맞추는 방법은 Ⓝ과 같다."
      //   → 제도법은 M·N·P 와 같은 P.148 이고, 기초선에만 D(P.61) 방식 감산·안내점 올림을 더한다.
      //   construction 은 형상 옵션이며 stand 파라미터(밴드 폭·올림·앞 끝선)와 의미를 섞지 않는다.
      id: "bunka-band-collar-O", label: "교재 O", description: "칼라 밴드 달린 셔츠 칼라 O형(올림 8.5·간격 14·기초선 −2.5·2/3 안내점 2 올림)",
      source: "『パターン製作の基礎』 칼라 밴드 달린 셔츠 칼라 O형(P.67) · 제도 방법 P.148 · 기초선 감산은 스탠드 칼라 D형(P.61·제도 방법 P.146) 방식",
      type: "shirt-two-piece", baseMethod: "bunka-band-collar-P148-v1",
      neckline: { requiredType: "shirt", enforcement: "metadata-only" }, familyId: "shirt-collar-with-band",
      construction: { baselineReductionCm: 2.5, guideRiseCm: 2 },
      stand: { bandWidthCm: 3, frontRiseCm: 8.5, frontEndCm: 0.5 },
      body: { gapCm: 14, cbWidthCm: 4, frontProjectionCm: 4, pointDiagonalCm: 6, outerBowCm: 0 }
    },
    {
      // 교재 P(P.67) — 본문 "제도 방법은 N과 같다". 밴드 폭만 5.
      id: "bunka-band-collar-P", label: "교재 P", description: "칼라 밴드 달린 셔츠 칼라 P형(밴드 폭 5·올림 3·간격 7)",
      source: "『パターン製作の基礎』 칼라 밴드 달린 셔츠 칼라 P형(P.67) · 제도 방법 P.148",
      type: "shirt-two-piece", baseMethod: "bunka-band-collar-P148-v1",
      neckline: { requiredType: "shirt", enforcement: "metadata-only" }, familyId: "shirt-collar-with-band",
      stand: { bandWidthCm: 5, frontRiseCm: 3, frontEndCm: 0.5 },
      body: { gapCm: 7, cbWidthCm: 4, frontProjectionCm: 2, pointDiagonalCm: 6, outerBowCm: 0 }
    },
    {
      // 교재 Q(P.68) 윙 칼라 — 본문 "몸판의 목둘레 치수를 토대로 칼라 밴드를 그리는데, 칼라 외곽의
      //   꺾임선은 수평으로 그린다. 이어서 앞 위 끝에, 칼라 끝부분만 제도한다."
      //   밴드는 P.148 골격(달림선 = ×+⊘ · 앞 끝선 0.5 는 M~P와 같은 연장량)이고 위 칼라는 없다.
      //   칼라 끝 세 수치는 전부 수평 꺾임선과 앞 위 끝 Ⓒ 기준: 밑변 7(뒤로) · 수평 후퇴 1.5 · 앞변 4.5.
      id: "bunka-band-collar-Q", label: "교재 Q", description: "윙 칼라 Q형(수평 꺾임선 · 앞 위 끝에 칼라 끝만 제도)",
      source: "『パターン製作の基礎』 윙 칼라 Q형(P.68) · 밴드 제도 방법 P.148",
      type: "shirt-wing-collar", baseMethod: "bunka-wing-collar-Q-v1",
      neckline: { requiredType: "shirt", enforcement: "metadata-only" }, familyId: "shirt-collar-with-band",
      stand: { bandWidthCm: 3, frontRiseCm: 1, frontEndCm: 0.5 },
      tip: { tipBaseCm: 7, tipSetbackCm: 1.5, tipEdgeCm: 4.5 }
    },
    {
      // 교재 R(P.68) — 본문 "칼라 밴드와 위 칼라를 1장으로 이어서 제도한다. 어깨부터 앞까지 칼라
      //   외곽 치수가 부족해지기 쉬워, 칼라 밴드 단추를 채우지 않고 입는 경우에 적합하다."
      //   밴드는 M·N·P 와 같은 P.148 골격이고, 밴드 윗선을 경계로 위 칼라가 한 장으로 이어진다.
      //   위 칼라: CB 3.5(수직) · 외곽 뒤 구간 = 뒤 목둘레 ×(수평·파생) · 앞 칼라 폭 6.5(Ⓒ에서 수직)
      //   · 외곽 앞 구간은 현에서 0.5 처진 완만한 곡선.
      id: "bunka-band-collar-R", label: "교재 R", description: "밴드+위 칼라 한 장 R형(어깨부터 앞까지 외곽 치수 확보·밴드 단추를 채우지 않는 착장)",
      source: "『パターン製作の基礎』 밴드+위 칼라 한 장 R형(P.68) · 밴드 제도 방법 P.148",
      type: "shirt-band-one-piece", baseMethod: "bunka-band-collar-R-v1",
      neckline: { requiredType: "shirt", enforcement: "metadata-only" }, familyId: "shirt-collar-with-band",
      stand: { bandWidthCm: 3, frontRiseCm: 1, frontEndCm: 0.5 },
      upper: { upperWidthCm: 3.5, frontWidthCm: 6.5, outerBowCm: 0.5 }
    },
    {
      // 한 장 셔츠 칼라(family 2) 교재 G형. 아래 수치가 **유일한 출처**다(catalog 의 참고값과 중복 금지).
      //   제도 절차는 교재 P.147, 예시 도면은 P.63. 곡선 정리 규칙은 designCollar.ONE_PIECE_METHOD.
      id: "bunka-shirt-collar-G",
      label: "교재 G 기본형",
      description: "한 장 셔츠 칼라(달림선·꺾임선·외곽선이 한 조각) 교재 G형 제도 기본값",
      source: "『パターン製作の基礎』 셔츠 칼라 G형(P.63) · 제도 방법 P.147",
      type: "shirt-one-piece",
      baseMethod: "bunka-shirt-collar-G-v1",
      neckline: { requiredType: "shirt", enforcement: "metadata-only" },
      familyId: "shirt-collar-one-piece",
      onePiece: { riseCm: 2.5, backCollarWidthCm: 3.5, collarStandCm: 3, frontCollarWidthCm: 6.5, tipProjectionCm: 3, attachCurveCm: 0.2 }
    },
    {
      // 교재 H(P.63) — G 와 같은 P.147 제도. 칼라 허리 1·올림 8·앞끝 4.5·달림선 곡률 0.3.
      //   교재 본문: 허리를 낮추면 뒤 칼라가 덜 서므로 외곽 길이를 확보하기 위해 올림 치수를 크게 한다.
      id: "bunka-shirt-collar-H",
      label: "교재 H 기본형",
      description: "한 장 셔츠 칼라 H형(칼라 허리 1·올림 8·완만하게 눕는 실루엣)",
      source: "『パターン製作の基礎』 셔츠 칼라 H형(P.63) · 제도 방법 P.147",
      type: "shirt-one-piece",
      baseMethod: "bunka-shirt-collar-H-v1",
      neckline: { requiredType: "shirt", enforcement: "metadata-only" },
      familyId: "shirt-collar-one-piece",
      onePiece: { riseCm: 8, backCollarWidthCm: 3.5, collarStandCm: 1, frontCollarWidthCm: 6.5, tipProjectionCm: 4.5, attachCurveCm: 0.3 }
    },
    {
      // 교재 I(P.64) — G/H 와 같은 P.147 제도. 칼라 허리 2·올림 4.5·앞끝 3.5·달림선 곡률 0.3.
      //   교재 본문: 칼라 허리가 낮은 셔츠 칼라로, 꺾임 각도와 어깨에 눕는 정도가 G/H의 중간이다.
      id: "bunka-shirt-collar-I",
      label: "교재 I 기본형",
      description: "한 장 셔츠 칼라 I형(칼라 허리 2·올림 4.5·G/H 중간 실루엣)",
      source: "『パターン製作の基礎』 셔츠 칼라 I형(P.64) · 제도 방법 P.147",
      type: "shirt-one-piece",
      baseMethod: "bunka-shirt-collar-I-v1",
      neckline: { requiredType: "shirt", enforcement: "metadata-only" },
      familyId: "shirt-collar-one-piece",
      onePiece: { riseCm: 4.5, backCollarWidthCm: 3.5, collarStandCm: 2, frontCollarWidthCm: 6.5, tipProjectionCm: 3.5, attachCurveCm: 0.3 }
    },
    {
      // 교재 J(P.64) — G와 같은 P.147 제도. 칼라 허리 4·올림 1·앞끝 2.5.
      //   달림선은 직선에 가까운 완만한 곡선이라고 설명하지만 별도 곡률 수치는 표기하지 않는다.
      //   attachCurveCm:0 은 "교재 수치 0cm"가 아니라 별도 볼록 오프셋을 주지 않는 구현 관례다.
      id: "bunka-shirt-collar-J",
      label: "교재 J 기본형",
      description: "한 장 셔츠 칼라 J형(칼라 허리 4·올림 1·뒤 달림선이 보이는 높은 허리)",
      source: "『パターン製作の基礎』 셔츠 칼라 J형(P.64) · 제도 방법 P.147 · 달림선 곡률 수치 무표기",
      type: "shirt-one-piece",
      baseMethod: "bunka-shirt-collar-J-v1",
      neckline: { requiredType: "shirt", enforcement: "metadata-only" },
      familyId: "shirt-collar-one-piece",
      onePiece: { riseCm: 1, backCollarWidthCm: 3.5, collarStandCm: 4, frontCollarWidthCm: 6.5, tipProjectionCm: 2.5, attachCurveCm: 0 }
    },
    {
      // 교재 K(P.65) — I와 같은 P.147 치수에서 앞 달림선 곡률만 반대로 0.6cm 둔다.
      //   방향은 signed 값에 숨기지 않고 attachCurveDirection 으로 보존한다.
      id: "bunka-shirt-collar-K",
      label: "교재 K 기본형",
      description: "한 장 셔츠 칼라 K형(I형과 같은 치수·앞 달림선 곡률 0.6을 반대 방향으로 변경)",
      source: "『パターン製作の基礎』 셔츠 칼라 K형(P.65) · 제도 방법 P.147",
      type: "shirt-one-piece",
      baseMethod: "bunka-shirt-collar-K-v1",
      neckline: { requiredType: "shirt", enforcement: "metadata-only" },
      familyId: "shirt-collar-one-piece",
      onePiece: { riseCm: 4.5, backCollarWidthCm: 3.5, collarStandCm: 2, frontCollarWidthCm: 6.5, tipProjectionCm: 3.5, attachCurveCm: 0.6, attachCurveDirection: "reversed" }
    },
    {
      // 교재 L(P.65) — "꺾임선을 앞 중심에서 떨어뜨린다"(오픈 칼라). G~K 와 같은 family 2 지만
      //   **몸판 연동 제도**라 생성 계약이 다르다(designCollar.computeOpenCollar):
      //   교재 본문 "몸판의 목둘레와 앞 꺾임선을 그린 뒤 이 치수를 토대로 제도한다".
      //   · 몸판: 앞목점에서 목둘레 곡선을 따라 4cm 뒤 = 꺾임선 윗 끝 / 앞목점에서 직선 8cm = 꺾임 끝(여밈 끝선 위).
      //   · 칼라: CB 허리 3 + 뒤 폭 3.5, 앞 끝은 기초선 위 1, 앞 끝에서 4cm 직선, 외곽은 수평 직선.
      //   · 길이 책임: 달림선 실측 = ×+⊘(기초선 길이·꺾임점 들림은 파생값).
      id: "bunka-shirt-collar-L",
      label: "교재 L 기본형",
      description: "오픈 칼라 L형(꺾임선을 앞 중심에서 떨어뜨린 몸판 연동 제도 · 외곽 수평 직선)",
      source: "『パターン製作の基礎』 오픈 칼라 L형(P.65) · 제도 방법 P.147",
      type: "shirt-open-collar",
      baseMethod: "bunka-open-collar-L-v1",
      neckline: { requiredType: "shirt", enforcement: "metadata-only" },
      familyId: "shirt-collar-one-piece",
      openCollar: { backCollarWidthCm: 3.5, collarStandCm: 3, frontEndRiseCm: 1, frontStraightCm: 4, breakPointDistanceCm: 8 }
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
  function validateOnePiece(sec, id) {
    if (!sec || typeof sec !== "object") fail("missing-section", id + ".onePiece");
    var keys = Object.keys(sec), want = ONE_PIECE_FIELDS.map(function (f) { return f.key; });
    var hasDir = keys.length === want.length + 1 && keys[keys.length - 1] === "attachCurveDirection";
    if (!(keys.length === want.length || hasDir) || want.some(function (k, i) { return keys[i] !== k; })) fail("bad-section-keys", id + ".onePiece");
    ONE_PIECE_FIELDS.forEach(function (f) {
      var v = sec[f.key];
      if (typeof v !== "number" || !isFinite(v)) fail("invalid-number", id + ".onePiece." + f.key);
      if (f.min !== undefined && (f.minExclusive ? v <= f.min : v < f.min)) fail("out-of-range", id + ".onePiece." + f.key);
    });
    if (hasDir && !CURVE_DIR[sec.attachCurveDirection]) fail("invalid-curve-direction", id + ".onePiece.attachCurveDirection");
  }
  // 한 레코드 검증(순수). 실패 시 throw(reason 포함).
  var RECORD_TYPES = { "shirt-two-piece": 1, "shirt-one-piece": 1, "shirt-open-collar": 1, "shirt-wing-collar": 1, "shirt-band-one-piece": 1, "stand-collar": 1 };
  function validateRecord(r) {
    if (!r || typeof r !== "object") fail("invalid-record");
    ["id", "label", "description", "source", "type", "baseMethod", "familyId"].forEach(function (k) { if (!isStr(r[k])) fail("missing-field", (r.id || "?") + "." + k); });
    if (!RECORD_TYPES[r.type]) fail("unknown-record-type", r.id);
    if (!r.neckline || !isStr(r.neckline.requiredType) || r.neckline.enforcement !== "metadata-only") fail("invalid-neckline", r.id);
    if (r.type === "shirt-one-piece") {
      // 한 장 칼라: 밴드/본체 섹션을 쓰지 않는다(M 전용 의미를 빌려오지 않음).
      ["stand", "body", "openCollar", "tip", "upper"].forEach(function (k) { if (k in r) fail("mixed-record-sections", r.id + "." + k); });
      validateOnePiece(r.onePiece, r.id);
      if (!(r.onePiece.frontCollarWidthCm > r.onePiece.tipProjectionCm)) fail("out-of-range", r.id + ".onePiece.frontCollarWidthCm");   // 엔진 계약: 앞 폭 > 칼라 끝(수평)
      return true;
    }
    if (r.type === "shirt-band-one-piece") {
      // 밴드+위 칼라 한 장: 밴드(stand) + 위 칼라(upper). 2피스 body·칼라 끝 tip 을 빌려오지 않는다.
      ["body", "onePiece", "openCollar", "standalone", "construction", "tip"].forEach(function (k) { if (k in r) fail("mixed-record-sections", r.id + "." + k); });
      validateSection(r.stand, STAND_FIELDS, "stand", r.id);
      validateSection(r.upper, UPPER_ONE_PIECE_FIELDS, "upper", r.id);
      return true;
    }
    if (r.type === "shirt-wing-collar") {
      // 윙 칼라: 밴드(stand) + 칼라 끝(tip). 위 칼라(body)·한 장·오픈 섹션을 빌려오지 않는다.
      ["body", "onePiece", "openCollar", "standalone", "construction", "upper"].forEach(function (k) { if (k in r) fail("mixed-record-sections", r.id + "." + k); });
      validateSection(r.stand, STAND_FIELDS, "stand", r.id);
      validateSection(r.tip, WING_TIP_FIELDS, "tip", r.id);
      if (!(r.tip.tipEdgeCm > r.tip.tipSetbackCm)) fail("out-of-range", r.id + ".tip.tipEdgeCm");     // 파생 세로 성분 > 0
      if (!(r.tip.tipBaseCm > r.tip.tipSetbackCm)) fail("out-of-range", r.id + ".tip.tipBaseCm");     // 뒤 제도점이 꼭짓점보다 뒤
      if (!(r.stand.bandWidthCm > r.stand.frontRiseCm)) fail("out-of-range", r.id + ".stand.bandWidthCm");   // 수평 꺾임선 계약
      return true;
    }
    if (r.type === "shirt-open-collar") {
      // 오픈 칼라: 밴드/본체/한 장 섹션을 쓰지 않는다(각 제도의 의미를 빌려오지 않음).
      ["stand", "body", "onePiece", "standalone", "tip", "upper"].forEach(function (k) { if (k in r) fail("mixed-record-sections", r.id + "." + k); });
      validateSection(r.openCollar, OPEN_COLLAR_FIELDS, "openCollar", r.id);
      if (!(r.openCollar.frontEndRiseCm < r.openCollar.collarStandCm + r.openCollar.backCollarWidthCm)) fail("out-of-range", r.id + ".openCollar.frontEndRiseCm");   // 엔진 계약: 앞 끝선 길이 > 0
      return true;
    }
    if (r.type === "stand-collar") {
      ["stand", "body", "onePiece", "openCollar", "tip", "upper"].forEach(function (k) { if (k in r) fail("mixed-record-sections", r.id + "." + k); });
      var c = r.construction;
      if (!c || typeof c.fitNeckSeam !== "boolean" || typeof c.baselineReductionCm !== "number" || !isFinite(c.baselineReductionCm) || c.baselineReductionCm < 0 ||
        typeof c.guideRiseCm !== "number" || !isFinite(c.guideRiseCm) || c.guideRiseCm < 0 ||
        (c.extendToFrontEdge !== undefined && typeof c.extendToFrontEdge !== "boolean") ||
        (c.requiresNecklineProfile !== undefined && c.requiresNecklineProfile !== "stand-f") ||
        (c.slashSpreadCm !== undefined && (typeof c.slashSpreadCm !== "number" || !isFinite(c.slashSpreadCm) || c.slashSpreadCm <= 0)) ||
        (c.slashCount !== undefined && (!Number.isInteger(c.slashCount) || c.slashCount <= 0))) fail("invalid-construction", r.id);
      validateSection(r.standalone, STANDALONE_FIELDS, "standalone", r.id);
      return true;
    }
    ["onePiece", "openCollar", "standalone", "tip", "upper"].forEach(function (k) { if (k in r) fail("mixed-record-sections", r.id + "." + k); });
    // 선택적 형상 옵션(교재 O = D 방식 기초선 감산·안내점 올림). 없으면 기존 M·N·P 와 완전히 동일한 제도다.
    if ("construction" in r) {
      var bc = r.construction;
      if (!bc || typeof bc !== "object" || Array.isArray(bc)) fail("invalid-construction", r.id);
      var bk = Object.keys(bc);
      if (bk.length !== 2 || bk[0] !== "baselineReductionCm" || bk[1] !== "guideRiseCm") fail("invalid-construction", r.id);
      if (typeof bc.baselineReductionCm !== "number" || !isFinite(bc.baselineReductionCm) || bc.baselineReductionCm < 0
        || typeof bc.guideRiseCm !== "number" || !isFinite(bc.guideRiseCm) || bc.guideRiseCm < 0) fail("invalid-construction", r.id);
    }
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
      if (!v || !isStr(v.id) || !isStr(v.label) || !isStr(v.symbol)) fail("missing-field", f.id + ".variant");
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
  // 기존 프로젝트의 초기 선택은 M을 유지한다. catalog 에 A가 먼저 보여도 자동 기본형을 바꾸지 않는다.
  var DEFAULT_ID = "bunka-shirt-collar-M";
  var DEFAULT_FAMILY_ID = "shirt-collar-with-band";

  function list() { return REG.list; }                                   // 동결 배열(정의 순서, 결정론)
  function get(id) { return Object.prototype.hasOwnProperty.call(REG.byId, id) ? REG.byId[id] : null; }
  // 편집용 기본값(deep clone). 알 수 없는 id 는 거부.
  function defaults(id) {
    var r = get(id); if (!r) return { ok: false, reason: "unknown-collar-preset" };
    if (r.type === "shirt-one-piece") return { ok: true, id: r.id, type: r.type, onePiece: clone(r.onePiece) };
    if (r.type === "shirt-open-collar") return { ok: true, id: r.id, type: r.type, openCollar: clone(r.openCollar) };
    if (r.type === "shirt-wing-collar") return { ok: true, id: r.id, type: r.type, stand: clone(r.stand), tip: clone(r.tip) };
    if (r.type === "shirt-band-one-piece") return { ok: true, id: r.id, type: r.type, stand: clone(r.stand), upper: clone(r.upper) };
    if (r.type === "stand-collar") return { ok: true, id: r.id, type: r.type, standalone: clone(r.standalone), construction: clone(r.construction) };
    var d2 = { ok: true, id: r.id, type: r.type, stand: clone(r.stand), body: clone(r.body) };
    if (r.construction) d2.construction = clone(r.construction);
    return d2;
  }
  // 선택 UI 옵션 모델(registry 에서 생성).
  function options() { return REG.list.map(function (r) { return { value: r.id, label: r.label }; }); }
  // 섹션 필드 의미·단위(표시용).
  function fields(section) { return clone(section === "stand" ? STAND_FIELDS : section === "body" ? BODY_FIELDS : section === "onePiece" ? ONE_PIECE_FIELDS : section === "openCollar" ? OPEN_COLLAR_FIELDS : section === "tip" ? WING_TIP_FIELDS : section === "upper" ? UPPER_ONE_PIECE_FIELDS : section === "standalone" ? STANDALONE_FIELDS : []); }
  // 편집값이 프리셋 기본값과 같은지(표시 판단용, 저장 없음).
  function matches(id, stand, body) {
    var r = get(id); if (!r) return false;
    var eq = function (a, b, fs) { return !!a && fs.every(function (f) { return a[f.key] === b[f.key]; }); };
    if (r.type === "shirt-one-piece") return eq(stand, r.onePiece, ONE_PIECE_FIELDS)
      && ((stand.attachCurveDirection || "as-drawn") === (r.onePiece.attachCurveDirection || "as-drawn"));   // 한 장: 방향은 선택적 안정 필드
    if (r.type === "shirt-open-collar") return eq(stand, r.openCollar, OPEN_COLLAR_FIELDS);
    if (r.type === "shirt-wing-collar") return eq(stand, r.stand, STAND_FIELDS) && eq(body, r.tip, WING_TIP_FIELDS);
    if (r.type === "shirt-band-one-piece") return eq(stand, r.stand, STAND_FIELDS) && eq(body, r.upper, UPPER_ONE_PIECE_FIELDS);
    if (r.type === "stand-collar") return eq(stand, r.standalone, STANDALONE_FIELDS);
    return eq(stand, r.stand, STAND_FIELDS) && eq(body, r.body, BODY_FIELDS);
  }
  // 프리셋 전체 적용 계획(순수·원자): 스탠드·본체를 모두 계산·검증한 뒤 새 collarDraft 를 반환한다.
  //   호출부가 ok 일 때만 한 번에 교체한다(실패 시 기존 상태 불변). designCollar 는 인자로 받는다.
  function composeDraft(id, bodice, DC) {
    var d = defaults(id); if (!d.ok) return d;
    var r = get(id);
    if (!DC || !bodice) return { ok: false, stage: "stand", reason: "no-bodice" };
    if (r.type === "shirt-one-piece") {
      var oneRe = DC.computeOnePiece(bodice, d.onePiece);
      if (!oneRe.ok) return { ok: false, stage: "collar", reason: oneRe.reason };
      return { ok: true, draft: {
        sourceBodiceHash: bodice.hash, type: r.type, baseMethod: r.baseMethod, presetId: r.id,
        parameters: { onePiece: d.onePiece },
        onePiece: { geometry: oneRe.geometry, measure: oneRe.measure, anchors: oneRe.anchors }   // anchors = 표시 전용(hash 미포함)
      } };
    }
    if (r.type === "shirt-open-collar") {
      // 몸판 연동: 목둘레 길이뿐 아니라 **실제 앞 목둘레선·여밈 끝선**을 읽어 꺾임선까지 만든다.
      var openRe = DC.computeOpenCollar(bodice, d.openCollar);
      if (!openRe.ok) return { ok: false, stage: "collar", reason: openRe.reason };
      return { ok: true, draft: {
        sourceBodiceHash: bodice.hash, type: r.type, baseMethod: r.baseMethod, presetId: r.id,
        parameters: { openCollar: d.openCollar },
        // bodyLink = 몸판 프레임의 꺾임선 출처(제도 근거). 몸판 geometry 는 변경하지 않는다.
        openCollar: { geometry: openRe.geometry, measure: openRe.measure, anchors: openRe.anchors, bodyLink: openRe.bodyLink }
      } };
    }
    if (r.type === "shirt-band-one-piece") {
      // 밴드 윗선을 경계로 위 칼라를 한 장으로 이어 그린다(외곽 뒤 구간은 몸판 뒤 목둘레 ×).
      var rRe = DC.computeBandOnePiece(bodice, d.stand, d.upper);
      if (!rRe.ok) return { ok: false, stage: "collar", reason: rRe.reason };
      return { ok: true, draft: {
        sourceBodiceHash: bodice.hash, type: r.type, baseMethod: r.baseMethod, presetId: r.id,
        parameters: { stand: d.stand, upper: d.upper },
        joined: { geometry: rRe.geometry, measure: rRe.measure, anchors: rRe.anchors }
      } };
    }
    if (r.type === "shirt-wing-collar") {
      // 밴드는 수평 꺾임선(type 계약), 위 칼라 대신 앞 위 끝의 칼라 끝만 그린다.
      var wingStand = DC.computeStand(bodice, d.stand, WING_STAND_OPTIONS);
      if (!wingStand.ok) return { ok: false, stage: "stand", reason: wingStand.reason };
      var wingTip = DC.computeWingTip(wingStand, d.tip);
      if (!wingTip.ok) return { ok: false, stage: "tip", reason: wingTip.reason };
      return { ok: true, draft: {
        sourceBodiceHash: bodice.hash, type: r.type, baseMethod: r.baseMethod, presetId: r.id,
        parameters: { stand: d.stand, tip: d.tip },
        standGeometry: wingStand.standGeometry, standAnchors: wingStand.anchors,
        tip: { geometry: wingTip.geometry, measure: wingTip.measure, anchors: wingTip.anchors },
        measure: {
          lowerNeckSeamLenCm: wingStand.lowerNeckSeamLenCm, lowerExtensionLenCm: wingStand.lowerExtensionLenCm,
          upperNeckSegmentLenCm: wingStand.upperNeckSegmentLenCm, upperExtensionLenCm: wingStand.upperExtensionLenCm,
          upperTotalLenCm: wingStand.upperTotalLenCm, backNeckLenCm: wingStand.backNeckLenCm, frontNeckLenCm: wingStand.frontNeckLenCm,
          neckTargetCm: wingStand.neckTargetCm, cbTrimCm: wingStand.cbTrimCm,
          baseLineLenCm: wingStand.baseLineLenCm, baselineReductionCm: wingStand.baselineReductionCm, guideRiseCm: wingStand.guideRiseCm
        }
      } };
    }
    if (r.type === "stand-collar") {
      var standaloneRe = DC.computeStandaloneStand(bodice, d.standalone, d.construction);
      if (!standaloneRe.ok) return { ok: false, stage: "collar", reason: standaloneRe.reason };
      return { ok: true, draft: {
        sourceBodiceHash: bodice.hash, type: r.type, baseMethod: r.baseMethod, presetId: r.id,
        construction: d.construction, parameters: { standalone: d.standalone },
        standalone: { geometry: standaloneRe.geometry, measure: standaloneRe.measure, anchors: standaloneRe.anchors }
      } };
    }
    var standRe = DC.computeStand(bodice, d.stand, d.construction);
    if (!standRe.ok) return { ok: false, stage: "stand", reason: standRe.reason };
    var bodyRe = DC.computeBody(standRe, d.body);
    if (!bodyRe.ok) return { ok: false, stage: "body", reason: bodyRe.reason };
    var twoPieceDraft = {
      sourceBodiceHash: bodice.hash, type: r.type, baseMethod: r.baseMethod, presetId: r.id,
      parameters: { stand: d.stand },
      standGeometry: standRe.standGeometry, standAnchors: standRe.anchors, collarGeometry: null,   // standAnchors·body.anchors = 표시 전용(hash 미포함)
      body: { parameters: d.body, geometry: bodyRe.bodyGeometry, attachLenCm: bodyRe.attachLenCm, measure: bodyRe.measure, anchors: bodyRe.anchors },
      measure: {
        lowerNeckSeamLenCm: standRe.lowerNeckSeamLenCm, lowerExtensionLenCm: standRe.lowerExtensionLenCm,
        upperNeckSegmentLenCm: standRe.upperNeckSegmentLenCm, upperExtensionLenCm: standRe.upperExtensionLenCm,
        upperTotalLenCm: standRe.upperTotalLenCm, backNeckLenCm: standRe.backNeckLenCm, frontNeckLenCm: standRe.frontNeckLenCm,
        neckTargetCm: standRe.neckTargetCm, cbTrimCm: standRe.cbTrimCm,   // P.148 ⑭ 목표 목둘레·뒤 중심 보정량
        baseLineLenCm: standRe.baseLineLenCm, baselineReductionCm: standRe.baselineReductionCm, guideRiseCm: standRe.guideRiseCm
      }
    };
    if (d.construction) twoPieceDraft.construction = d.construction;   // D 방식 형상 옵션(있을 때만)
    return { ok: true, draft: twoPieceDraft };
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
  // 선택 variant 의 표시 제목 데이터(순수): 교재 분류명 + **선택 variant 의 표식·페이지**.
  //   variant 가 없으면 family 대표 표식·페이지로 떨어진다. label 파싱 금지.
  function displayTitle(familyId, variantId) {
    var f = family(familyId); if (!f) return null;
    var v = variant(familyId, variantId);
    return Object.freeze({ familyLabel: f.label, symbol: (v && v.symbol) || f.symbol,
      page: (v && typeof v.page === "number") ? v.page : f.page, variantId: v ? v.id : null });
  }
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
    WING_STAND_OPTIONS: Object.freeze(clone(WING_STAND_OPTIONS)),   // Q 밴드 계약(수평 꺾임선) — checkpoint 재계산 공용
    families: families, family: family, variants: variants, variant: variant,
    familyOptions: familyOptions, variantOptions: variantOptions, resolve: resolve, referenceRows: referenceRows, displayTitle: displayTitle, referenceFields: function () { return clone(REFERENCE_FIELDS); },
    validateRecord: validateRecord, buildRegistry: buildRegistry,   // 순수(하네스·향후 레코드 추가 검증)
    validateFamily: validateFamily, buildCatalog: buildCatalog
  });
})();
