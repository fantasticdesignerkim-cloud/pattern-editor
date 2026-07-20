// ══════════════════════════════════════════════
// js/ui.js — CAD workspace의 "노출 상태"만 중앙화한다.
//
// 경계 (S3):
//  - UI 상태는 stage / tool 두 값이 전부다. 엔진 상태(선택 조각·다트 각도·편집 모드)를
//    복제하지 않는다. "작업 중(busy)"도 저장하지 않고 매번 실제 DOM에서 파생한다.
//  - 기능 함수(generatePattern / toggleDartMove / toggleArmEdit ...)를 호출하지 않는다.
//    기존 inline onclick이 기능을 계속 담당하고, 여기서는 stage/tool 선택과 노출만 본다.
//  - DOM은 최초부터 전부 존재한다. innerHTML 없이
//    class / hidden / disabled / aria-* 만 갱신한다.
// ══════════════════════════════════════════════
(function () {
  "use strict";

  const STAGE_TOOLS  = { draft: ["measurements"], design: ["dart", "curves"] };
  const COMMON_TOOLS = ["view", "data"];
  const DEFAULT_TOOL = { draft: "measurements", design: "curves" };

  // ── UI 상태: 이 두 값이 전부 ──────────────────
  const uiState = { stage: "draft", tool: "measurements" };

  const stageEls = () => document.querySelectorAll("[data-stage]");
  const toolEls  = () => document.querySelectorAll("[data-tool]");
  const panelEls = () => document.querySelectorAll("[data-panel]");
  const text     = (id) => {
    const el = document.getElementById(id);
    return el ? el.textContent.trim() : "";
  };

  function allowedTools(stage) {
    return (STAGE_TOOLS[stage] || []).concat(COMMON_TOOLS);
  }

  // ── busy 파생: 저장하지 않고 실제 DOM에서 읽는다 ──
  // 다트: setBtn()이 쓰는 textContent, 또는 setSideRowVisible()이 쓰는 display
  function isDartBusy() {
    if (text("btnDartMove") === "취소") return true;
    const row = document.getElementById("dartSideRow");
    return !!(row && row.style.display !== "none");
  }
  // 곡선: toggle*Edit()가 쓰는 textContent
  function isCurveBusy() {
    return ["btnArmEdit", "btnNeckEdit", "btnSleeveEdit"].some(id => text(id) === "편집 종료");
  }
  function busyTool() {
    if (isDartBusy())  return "dart";
    if (isCurveBusy()) return "curves";
    return null;
  }

  // ── 필수 함수 1: stage 전환 (수동만, busy 중에는 잠금) ──
  function setWorkspaceStage(stage) {
    if (!STAGE_TOOLS[stage]) return;
    if (busyTool()) return;                 // 작업 중에는 stage 전환 금지
    uiState.stage = stage;
    if (!allowedTools(stage).includes(uiState.tool)) uiState.tool = DEFAULT_TOOL[stage];
    refresh();
  }

  // ── 필수 함수 2: 도구 선택 (busy 중에는 그 도구만 허용) ──
  function setActiveTool(tool) {
    const busy = busyTool();
    if (busy && tool !== busy) return;      // 작업 중에는 다른 도구로 전환 금지
    if (!allowedTools(uiState.stage).includes(tool)) return;
    uiState.tool = tool;
    refresh();
  }

  // ── 필수 함수 3: 현재 도구의 inspector만 노출 ──
  function updateContextInspector() {
    const busy = busyTool();
    if (busy && uiState.tool !== busy) uiState.tool = busy;   // 작업 인스펙터는 계속 표시
    panelEls().forEach(p => { p.hidden = p.dataset.panel !== uiState.tool; });

    // 다트 패널: idle 안내 / busy 컨텍스트 전환 (가짜 수치 없음)
    const dartBusy = isDartBusy();
    const idle = document.querySelector("[data-dart-idle]");
    const work = document.querySelector("[data-dart-busy]");
    if (idle) idle.hidden = dartBusy;
    if (work) work.hidden = !dartBusy;
  }

  // ── 필수 함수 4: stage/tool 버튼의 활성·가용 상태 ──
  function updateContextActions() {
    const busy = busyTool();
    const allowed = allowedTools(uiState.stage);

    stageEls().forEach(btn => {
      const isCurrent = btn.dataset.stage === uiState.stage;
      btn.setAttribute("aria-selected", String(isCurrent));
      const blocked = !!busy && !isCurrent;   // 작업 중에는 다른 stage 잠금
      btn.disabled = blocked;
      if (blocked) btn.setAttribute("aria-disabled", "true");
      else         btn.removeAttribute("aria-disabled");
    });

    toolEls().forEach(btn => {
      const t = btn.dataset.tool;
      // 작업 중이면 그 도구만 남긴다(취소·편집 종료를 누를 수 있어야 하므로).
      const ok = allowed.includes(t) && (!busy || t === busy);
      btn.disabled = !ok;
      btn.setAttribute("aria-pressed", String(ok && t === uiState.tool));
      if (ok) btn.removeAttribute("aria-disabled");
      else    btn.setAttribute("aria-disabled", "true");
    });

    syncDartLabel();
  }

  function refresh() {
    updateContextActions();
    updateContextInspector();
  }

  // ── btnDartMove 라벨: 별도 boolean 없이 실제 DOM 텍스트에서 파생 ──
  function syncDartLabel() {
    const b = document.getElementById("btnDartMove");
    if (!b) return;
    const label = b.textContent.trim() === "취소" ? "다트 이동 취소" : "다트 이동 시작";
    b.setAttribute("aria-label", label);
    b.setAttribute("title", label);
  }

  function bind() {
    stageEls().forEach(btn => {
      btn.addEventListener("click", () => { if (!btn.disabled) setWorkspaceStage(btn.dataset.stage); });
    });
    // 기존 inline onclick은 그대로 두고 리스너만 추가한다(기능은 onclick이 담당).
    toolEls().forEach(btn => {
      btn.addEventListener("click", () => { if (!btn.disabled) setActiveTool(btn.dataset.tool); });
    });
    // 편집 버튼: 기능 호출 없이, inline onclick 이 끝난 뒤 DOM 상태를 다시 읽는다.
    ["btnArmEdit", "btnNeckEdit", "btnSleeveEdit"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("click", () => queueMicrotask(refresh));
    });
    // MutationObserver 는 btnDartMove 하나에만 (attributes 는 관찰하지 않아 루프 없음).
    const dart = document.getElementById("btnDartMove");
    if (dart) {
      new MutationObserver(refresh)
        .observe(dart, { childList: true, characterData: true, subtree: true });
    }
  }

  function init() {
    bind();
    uiState.stage = "draft";
    uiState.tool  = "measurements";
    refresh();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  // 브라우저에서 검증 가능하도록 전역 노출
  window.setWorkspaceStage      = setWorkspaceStage;
  window.setActiveTool          = setActiveTool;
  window.updateContextInspector = updateContextInspector;
  window.updateContextActions   = updateContextActions;
})();
