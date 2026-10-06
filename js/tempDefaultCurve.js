// ══════════════════════════════════════════════
// js/tempDefaultCurve.js — ★ TEMP: B83/W64/BL38 몸판+짝 소매 곡선 세트 임시 기본값 (제거 대상) ★
//
// 출처: 사용자 제공 armhole_data_2026-07-16 (1).json 을 JSON 불러오기 했을 때
//       현재 코드(getSavedCurveEntries = kv, 같은 치수는 뒤 항목이 이김)가 B83/W64/BL38 에
//       선택하는 마지막 기록 = 배열 index 24 (SL52/Hem30/culture, timestamp 2026-06-10T07:40:11.158Z).
//       그 기록에서 **최소 필드만** 옮겼다: 몸판(anchors·handles·fArmhole·bNeckline·fNeckline) +
//       짝 소매(sleevePattern: anchorCount·segments·anchorOffsets). 이력 24건은 넣지 않았다.
//       ※ 몸판만 적용하면 공식 소매와 짝이 어긋나 총 이세가 커진다(+4.05cm) — 그래서 소매도 한 세트다.
// 적용 조건:
//   · 몸판 = B=83, W=64, BL=38 만(SL/Hem 무관 — measurementMatches 계약 유지).
//   · 소매 = 위 + SL=52 + Hem=30 + 소매산 공식 문화식(culture) **정확히 일치**할 때만, 그리고 이 몸판 치수의
//     저장 항목이 하나도 없을 때만(사용자 몸판과 TEMP 소매가 섞이지 않게). 아니면 기존 소매 공식 그대로.
// 우선순위: ① localStorage 사용자 저장값/가져온 값 → ② 이 TEMP → ③ 공식 기본값(initHandles/소매 공식).
// localStorage 에는 **쓰지 않는다**(seed·덮어쓰기 없음) — state 메모리에만 적용.
//   사용자가 곡선을 실제로 편집하면 기존 autoSave 가 그것을 사용자 저장값으로 남기고, 그 뒤엔 ① 이 이긴다.
//
// 제거 방법: 이 파일과 index.html 의 <script src="js/tempDefaultCurve.js"> 1줄을 지우면
//   기존 동작으로 완전 복귀한다(다른 파일 무변경). 아래 플래그를 false 로 둬도 무력화된다.
// ══════════════════════════════════════════════
const ENABLE_TEMP_DEFAULT_BODY_CURVE = true;

(function () {
  "use strict";
  if (!ENABLE_TEMP_DEFAULT_BODY_CURVE) return;

  const TEMP_DEFAULT_BODY_CURVE = {
    measurements: { B: 83, W: 64, BL: 38 },
    anchors: {
      a1: { x: 19.585, y: 18.807 },
      a2: { x: 23.053, y: 20.617 },
      a3: { x: 26.734, y: 19.019 }
    },
    handles: {
      h0: { x: 18.362, y: 8.4 },
      h1a: { x: 16.184, y: 14.103 },
      h1b: { x: 20.75, y: 20.133 },
      h2a: { x: 21.756, y: 20.601 },
      h2b: { x: 24.668, y: 20.62 },
      h3a: { x: 25.902, y: 19.87 },
      h3b: { x: 28.068, y: 17.294 },
      h4: { x: 28.331, y: 16.61 }
    },
    fArmhole: {
      hGa: { x: 28.331, y: 13.321 },
      hGb: { x: 29.963, y: 12.781 },
      hFa: { x: 31.506, y: 8.187 },
      hFb: { x: 31.006, y: 4.649 }
    },
    bNeckline: {
      h0: { x: 3.72, y: 0 },
      h1: { x: 5.636, y: -0.742 }
    },
    fNeckline: {
      h0: { x: 46.165, y: 3.075 },
      h1: { x: 40.642, y: -2.879 }
    }
  };

  // 짝 소매: index 24 의 sleevePattern 그대로(capFormula=culture, SL52, Hem30 에서 만든 것).
  const TEMP_DEFAULT_SLEEVE_CURVE = {
    anchorCount: 9,
    segments: [
      { c1: { x: 6.819, y: 66.418 }, c2: { x: 7.444, y: 66.059 } },
      { c1: { x: 10.383, y: 63.902 }, c2: { x: 11.861, y: 62.272 } },
      { c1: { x: 14.132, y: 58.772 }, c2: { x: 16.586, y: 55.954 } },
      { c1: { x: 20.341, y: 52.99 }, c2: { x: 21.886, y: 53.127 } },
      { c1: { x: 25.66, y: 53.033 }, c2: { x: 26.967, y: 53.141 } },
      { c1: { x: 30.376, y: 56.386 }, c2: { x: 31.416, y: 58.859 } },
      { c1: { x: 32.78, y: 62.161 }, c2: { x: 34.692, y: 64.053 } },
      { c1: { x: 36.504, y: 65.686 }, c2: { x: 37.858, y: 66.395 } }
    ],
    anchorOffsets: [
      { dx: 0, dy: 0 }, { dx: 0.1017, dy: 0.178 }, { dx: 0, dy: 0 }, { dx: 0.0666, dy: 0.0295 },
      { dx: 0, dy: 0 }, { dx: -0.0487, dy: 0.019 }, { dx: 0, dy: 0 }, { dx: -0.0261, dy: 0.0261 },
      { dx: 0, dy: 0 }
    ]
  };
  const TEMP_SLEEVE_COND = { SL: 52, Hem: 30, capFormula: "culture" };

  function applyTempDefaultForCurrentMeasurements() {
    // measurementMatches 와 같은 계약: B/W/BL 만 본다(SL/Hem 무관).
    if (!measurementMatches(TEMP_DEFAULT_BODY_CURVE)) return false;
    // 사용자 저장값(직접 저장·JSON 가져오기)이 있으면 절대 덮지 않는다. 편집 중에도 건드리지 않는다.
    if (findLastSavedForCurrentMeasurements()) return false;
    if (state.armEditMode || state.neckEditMode || state.sleeveEditMode) return false;
    // state 가 상수 객체를 참조하지 않도록 매번 깊은 복사(편집이 상수를 오염시키지 않게).
    applySavedCurveEntry(JSON.parse(JSON.stringify(TEMP_DEFAULT_BODY_CURVE)), false);
    return true;
  }

  // 치수 전환 지원: 기존 자동 복원이 **실패한 경우에만** 폴백. 반환값은 원본 그대로
  // (TEMP 기본값은 "저장 데이터"가 아니다). testSeed.js 가 뒤에서 같은 방식으로 한 번 더 감싼다.
  if (!loadSavedCurveForCurrentMeasurements.__tempDefaultWrapped) {
    const original = loadSavedCurveForCurrentMeasurements;
    const wrapped = function (showAlert) {
      const ok = original(showAlert);
      if (ok || showAlert) return ok;     // 사용자 저장값 우선 / 명시 호출(alert 경로)엔 개입 안 함
      applyTempDefaultForCurrentMeasurements();
      return ok;
    };
    wrapped.__tempDefaultWrapped = true;
    loadSavedCurveForCurrentMeasurements = wrapped;
  }

  // 소매 TEMP: 몸판 TEMP 조건 + SL/Hem/문화식 정확 일치 + 이 몸판 치수의 저장 항목 없음.
  // sleeveH 가 비어 있는 시점(최초 로드·치수 전환 리셋)에 기존 저장 복원이 실패했을 때만 호출된다.
  function applyTempSleeveForCurrent(anchorCount) {
    if (anchorCount != null && anchorCount !== TEMP_DEFAULT_SLEEVE_CURVE.anchorCount) return false;
    if (!measurementMatches(TEMP_DEFAULT_BODY_CURVE)) return false;
    const same = (a, b) => Math.abs((+a || 0) - (+b || 0)) < 0.001;
    if (!same(n("inpSL"), TEMP_SLEEVE_COND.SL) || !same(n("inpHem"), TEMP_SLEEVE_COND.Hem)) return false;
    const mode = (document.getElementById("selCapFormula") || {}).value || "culture";
    if (mode !== TEMP_SLEEVE_COND.capFormula) return false;
    if (findLastSavedForCurrentMeasurements()) return false;      // 사용자 저장 세트가 있으면 섞지 않는다
    if (state.sleeveEditMode) return false;
    const sp = JSON.parse(JSON.stringify(TEMP_DEFAULT_SLEEVE_CURVE));   // 깊은 복사: 편집이 상수를 오염시키지 않게
    state.sleeveH = { anchorCount: sp.anchorCount, segments: sp.segments, anchorOffsets: sp.anchorOffsets };
    return true;
  }
  if (!restoreSavedSleevePatternForAnchorCount.__tempDefaultWrapped) {
    const origCount = restoreSavedSleevePatternForAnchorCount;
    const wrappedCount = function (anchorCount) {
      return origCount(anchorCount) || applyTempSleeveForCurrent(anchorCount);
    };
    wrappedCount.__tempDefaultWrapped = true;
    restoreSavedSleevePatternForAnchorCount = wrappedCount;
  }
  if (!restoreSavedSleevePatternForCurrentSleeve.__tempDefaultWrapped) {
    const origCur = restoreSavedSleevePatternForCurrentSleeve;
    const wrappedCur = function (showAlert) {
      // showAlert(명시 호출) 경로는 기존 계약 유지 — 실패 알림을 가리지 않는다.
      return origCur(showAlert) || (!showAlert && applyTempSleeveForCurrent(null));
    };
    wrappedCur.__tempDefaultWrapped = true;
    restoreSavedSleevePatternForCurrentSleeve = wrappedCur;
  }

  // 최초 로드: storage.js 의 자동 복원이 실패한 뒤·init.js(initHandles)보다 먼저 state 를 채운다.
  if (n("inpB") && n("inpW") && n("inpBL")) applyTempDefaultForCurrentMeasurements();
})();
