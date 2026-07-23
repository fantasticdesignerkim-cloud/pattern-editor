// ══════════════════════════════════════════════
// js/testSeed.js — 테스트 전용 read-only 곡선 fixture (서비스 시작 전 제거 대상)
//
// 목적: localStorage 가 비어 있는 격리 테스트 환경에서도 검증된 곡선(권위 백업
// armhole_data_2026-07-16.json, 미추적)을 기본값으로 화면에 적용한다.
// 저장소(localStorage/IndexedDB)에는 **아무것도 쓰지 않는다** — state 메모리에만 적용.
//
// 제거 방법: 이 파일과 index.html 의 <script src="js/testSeed.js"> 1줄을 지우면
// 기존 동작(사용자 저장값 → initHandles/sleeve 공식 기본값)으로 완전 복귀한다.
//
// 우선순위: A. 사용자 저장값(exact B-W-BL) → B. fixture exact key → C. 공식 기본값.
// fixture 적용 자체는 저장 0건·dirty 불변이며, 사용자가 곡선을 실제로 편집하는
// 순간부터는 기존 autoSave 가 그것을 사용자 데이터로 저장한다(의도된 경계).
// ══════════════════════════════════════════════
const ENABLE_TEST_CURVE_DEFAULTS = true;

(function () {
  "use strict";
  if (!ENABLE_TEST_CURVE_DEFAULTS) return;

  const dbg = (...a) => { if (typeof DEBUG_DART_MOVE !== "undefined" && DEBUG_DART_MOVE) console.log("[testSeed]", ...a); };

  // 고유 B-W-BL 키별 "마지막" 항목만 메모리 Map 에 보관.
  // 원본 배열은 변형하지 않고, timestamp/이력을 어디에도 기록하지 않는다.
  const seedMap = new Map();
  let ready = false;

  function currentKey() { return `${n("inpB")}-${n("inpW")}-${n("inpBL")}`; }

  function applySeedForCurrentKey() {
    if (!ready) return false;
    const entry = seedMap.get(currentKey());
    if (!entry) return false;
    // 적용 직전 재확인: fetch 사이에 사용자 저장값이 생겼거나 편집 중이면 절대 덮지 않는다.
    if (findLastSavedForCurrentMeasurements()) return false;
    if (state.armEditMode || state.neckEditMode || state.sleeveEditMode) return false;
    // sleeve 는 기존 exact 계약(SL·capFormula, sleeveMeasurementMatches)을 그대로 따른다 —
    // body 가 exact 여도 sleeve 조건이 다르면 sleeve 는 억지 적용하지 않는다.
    applySavedCurveEntry(entry, sleeveMeasurementMatches(entry));
    dbg("fixture 적용:", currentKey());
    return true;
  }

  // 치수 전환 지원: 기존 자동 복원(loadSavedCurveForCurrentMeasurements)이 **실패한
  // 경우에만** fixture 로 폴백한다. original 참조는 1회만 보관, wrapper 는 한 번만 설치.
  if (!loadSavedCurveForCurrentMeasurements.__testSeedWrapped) {
    const original = loadSavedCurveForCurrentMeasurements;
    const wrapped = function (showAlert) {
      const ok = original(showAlert);
      if (ok || showAlert) return ok;   // 사용자 저장값 우선 / 명시 호출(alert 경로)엔 개입 안 함
      applySeedForCurrentKey();         // fixture 는 "저장 데이터" 가 아니므로 반환값은 원본
      return ok;                        // 그대로 둔다. 자동 호출부(render 28행)는 이 직후
    };                                  // initHandles·그리기를 이어가므로 별도 render 불필요.
    wrapped.__testSeedWrapped = true;
    loadSavedCurveForCurrentMeasurements = wrapped;
  }

  // fixture 로드 (cache:no-store). 404·malformed·빈 배열이면 조용히 기존 기본값으로 진행.
  fetch("./armhole_data_2026-07-16.json", { cache: "no-store" })
    .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(list => {
      if (!Array.isArray(list) || list.length === 0) throw new Error("빈/비정상 fixture");
      for (const e of list) {           // 앞→뒤 순회: 같은 키는 뒤(최신) 항목이 이긴다
        const m = e && e.measurements;
        if (!m || m.B == null || m.W == null || m.BL == null) continue;
        seedMap.set(`${m.B}-${m.W}-${m.BL}`, e);
      }
      ready = seedMap.size > 0;
      dbg("fixture 준비:", seedMap.size, "키");
      // 초기 1회: init 이 이미 그린 공식 기본값을 fixture 곡선으로 교체(render 1회만)
      if (ready && applySeedForCurrentKey()) render();
    })
    .catch(err => { dbg("fixture 없음/실패 — 공식 기본값 사용:", err && err.message); });
})();
