// ══════════════════════════════════════════════
// designCollar.js — 카라 모양 단계 파생(순수). C1: 2피스 셔츠 칼라의 **칼라 스탠드**.
//
// 입력은 live 몸판이 아니라 **완료본에 고정된 bodiceResult**(bodiceCheckpoint.complete 결과):
//   · 목둘레 봉제 길이 = bodiceResult.necklineLengths.half  (반패턴 합계 = 앞목 반쪽 + 뒤목 반쪽).
//     CB(뒤중심)는 접어 재단하는 반패턴 → 이 half 가 스탠드 한 장의 봉제 길이다.
//   · 앞끝 여밈 연장분 = bodiceResult.placket.parameters.overlapCm  (여밈이 없으면 0).
//     앞끝을 완성 앞단선(CF+overlap)까지 연장하되, **연장분은 목둘레 봉제 길이(seamLenCm)에 포함하지
//     않는다** — 별도 extensionLenCm 으로 분리한다.
//
// C1 = 직선 스캐폴드(A안). 길이=반패턴 합계, 높이 3cm 직선 밴드 + CF 여밈 연장.
//   베이스 곡률·CF 훅업은 이후 수치 파라미터로 확장한다(옆선 박스형 → 곡선화 증분과 같은 결).
//
// 로컬 좌표 프레임(캔버스 y-down): CB 는 x=0, 목둘레 봉제 모서리는 y=0, 스탠드는 위(−y)로 선다.
//   x: CB(0) → CF 봉제(neckHalf) → CF 완성 앞단(neckHalf+overlap). 최종 캔버스 배치는 표시 offset 이
//   담당하고 이 모듈은 형상만 만든다(designSleeve 와 동일 원칙 — 형상은 배치와 분리).
//
// 카라 형상은 소매에 의존하지 않는다 → sourceSleeveHash 에 묶지 않는다(작업 순서용 탭 활성만 소매 참조).
// ══════════════════════════════════════════════
(function () {
  "use strict";
  function cp(p) { return { x: p.x, y: p.y }; }
  function L(a, b, part) { var s = { kind: "line", from: cp(a), to: cp(b) }; if (part) s.part = part; return s; }
  function num(v) { return typeof v === "number" && isFinite(v); }

  var DEFAULT_STAND_HEIGHT = 3;   // cm

  // 초기 UI 기본값(임의 숫자 하드코딩 대신 한 곳에서).
  function referenceParams() { return { standHeightCm: DEFAULT_STAND_HEIGHT }; }

  // bodiceResult 에서 카라가 쓰는 봉제 길이·여밈 연장을 뽑는다.
  //   { ok, neckHalfCm, overlapCm } | { ok:false, reason }.
  function readBodice(bodiceResult) {
    if (!bodiceResult || typeof bodiceResult !== "object") return { ok: false, reason: "no-bodice" };
    var nl = bodiceResult.necklineLengths;
    if (!nl || !num(nl.half) || nl.half <= 0) return { ok: false, reason: "no-neckline" };
    // 여밈이 없으면(placket null) 연장 0 = 앞끝을 CF 까지만. 있으면 overlapCm 사용(음수면 거부).
    var overlap = 0;
    if (bodiceResult.placket && bodiceResult.placket.parameters) {
      var o = bodiceResult.placket.parameters.overlapCm;
      if (o !== undefined && o !== null) {
        if (!num(o) || o < 0) return { ok: false, reason: "invalid-overlap" };
        overlap = o;
      }
    }
    return { ok: true, neckHalfCm: nl.half, overlapCm: overlap };
  }

  // C1 스탠드 파생: params = { standHeightCm }.
  //   반환 { ok, standGeometry:{outline,construction}, seamLenCm, extensionLenCm, standTopLenCm,
  //          standHeightCm, anchors } | { ok:false, reason }.
  function computeStand(bodiceResult, params) {
    var b = readBodice(bodiceResult);
    if (!b.ok) return b;
    var H = (params && params.standHeightCm !== undefined) ? params.standHeightCm : DEFAULT_STAND_HEIGHT;
    if (!num(H) || H <= 0) return { ok: false, reason: "invalid-stand-height" };

    var neckHalf = b.neckHalfCm, overlap = b.overlapCm;
    var cfSeamX = neckHalf, cfExtX = neckHalf + overlap;

    // 로컬 프레임 앵커(봉제 모서리 y=0, 스탠드 top y=−H, CB x=0).
    var cbSeam = { x: 0, y: 0 };                  // CB · 목둘레 봉제
    var cbTop = { x: 0, y: -H };                   // CB · 스탠드 윗선
    var cfSeam = { x: cfSeamX, y: 0 };             // CF · 목둘레 봉제(여밈 연장 시작점)
    var cfExtSeam = { x: cfExtX, y: 0 };           // 완성 앞단선 · 봉제 모서리
    var cfTop = { x: cfExtX, y: -H };              // 완성 앞단선 · 스탠드 윗선

    // 닫힌 outline: 목둘레 봉제 → (여밈 연장) → CF 앞단 → 스탠드 윗선 → CB 접힘.
    var outline = [L(cbSeam, cfSeam, "neck-seam")];
    if (overlap > 0) outline.push(L(cfSeam, cfExtSeam, "extension"));
    outline.push(L(cfExtSeam, cfTop, "cf"));
    outline.push(L(cfTop, cbTop, "top"));         // 스탠드 윗선 = C2 칼라 본체가 붙는 기준선
    outline.push(L(cbTop, cbSeam, "cb-fold"));    // CB 접어재단 모서리

    return {
      ok: true,
      standGeometry: { outline: outline, construction: [] },
      seamLenCm: neckHalf,                          // 목둘레 봉제 구간(연장 미포함)
      extensionLenCm: overlap,                       // 앞여밈 연장 구간
      standTopLenCm: neckHalf + overlap,             // 스탠드 윗선 길이(C2 기준)
      standHeightCm: H,
      anchors: { cbSeam: cbSeam, cbTop: cbTop, cfSeam: cfSeam, cfExtSeam: cfExtSeam, cfTop: cfTop }
    };
  }

  window.designCollar = Object.freeze({
    referenceParams: referenceParams,
    readBodice: readBodice,
    computeStand: computeStand
  });
})();
