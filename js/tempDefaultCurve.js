// ══════════════════════════════════════════════
// js/tempDefaultCurve.js — ★ TEMP: B83/W64/BL38 몸판 곡선 임시 기본값 (제거 대상) ★
//
// 출처: 사용자 제공 armhole_data_2026-07-16 (1).json 을 JSON 불러오기 했을 때
//       현재 코드(getSavedCurveEntries = kv, 같은 치수는 뒤 항목이 이김)가 B83/W64/BL38 에
//       선택하는 마지막 기록 = 배열 index 24 (SL52/Hem30, timestamp 2026-06-10T07:40:11.158Z).
//       그 기록에서 **몸판 곡선에 필요한 최소 필드만** 옮겼다(anchors·handles·fArmhole·
//       bNeckline·fNeckline). 소매(sleevePattern)·capFormula·이력 24건은 넣지 않았다.
// 적용 조건: B=83, W=64, BL=38 일 때만. SL/Hem 은 조건이 아니다(measurementMatches 계약 유지).
// 우선순위: ① localStorage 사용자 저장값/가져온 값(findLastSavedForCurrentMeasurements) →
//           ② 이 TEMP 기본값 → ③ 기존 공식 기본값(initHandles). 다른 치수는 ③ 그대로.
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

  // 최초 로드: storage.js 의 자동 복원이 실패한 뒤·init.js(initHandles)보다 먼저 state 를 채운다.
  if (n("inpB") && n("inpW") && n("inpBL")) applyTempDefaultForCurrentMeasurements();
})();
