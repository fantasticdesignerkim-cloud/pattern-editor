// ══════════════════════════════════════════════
// js/ui.js — CAD workspace의 "노출 상태"만 중앙화한다.
//
// 경계:
//  - UI 상태는 stage / tool 두 값이 전부다. tool 은 **실제 캔버스 상호작용 모드가 있는
//    것**만 남긴다(dart, curves). 보기·파일은 도구가 아니라 상단 메뉴이고, 치수는
//    원형 stage의 기본 패널이므로 tool 이 아니다.
//  - 엔진 상태(선택 조각·다트 각도·편집 모드)를 복제하지 않는다. "작업 중(busy)"도
//    저장하지 않고 매번 실제 DOM에서 파생한다.
//  - 기능 함수(generatePattern / toggleDartMove / toggleArmEdit ...)를 호출하지 않는다.
//    기존 inline onclick이 기능을 담당하고, 여기서는 stage/tool 선택과 노출만 본다.
//  - DOM은 최초부터 전부 존재한다. innerHTML 없이
//    hidden / disabled / aria-* 만 갱신한다.
// ══════════════════════════════════════════════
(function () {
  "use strict";

  // stage 별 도구. draft 는 도구 없이 치수 패널만 쓴다.
  const STAGE_TOOLS  = { draft: [], design: ["dart", "curves"] };
  const DEFAULT_TOOL = { draft: null, design: "curves" };

  // ── UI 상태: 이 두 값이 전부 ──────────────────
  const uiState = { stage: "draft", tool: null };

  const stageEls = () => document.querySelectorAll("[data-stage]");
  const toolEls  = () => document.querySelectorAll("[data-tool]");
  const panelEls = () => document.querySelectorAll("[data-panel]");
  const fileMenu = () => document.querySelector('[data-menu="file"]');
  const text     = (id) => {
    const el = document.getElementById(id);
    return el ? el.textContent.trim() : "";
  };

  // ── busy 파생: 저장하지 않고 실제 DOM에서 읽는다 ──
  function isDartBusy() {
    if (text("btnDartMove") === "취소") return true;
    const row = document.getElementById("dartSideRow");
    return !!(row && row.style.display !== "none");
  }
  function isCurveBusy() {
    return ["btnArmEdit", "btnNeckEdit", "btnSleeveEdit"].some(id => text(id) === "편집 종료");
  }
  function busyTool() {
    if (isDartBusy())  return "dart";
    if (isCurveBusy()) return "curves";
    return null;
  }

  // 지금 보여야 할 패널: busy > design의 tool > draft의 치수
  function activePanel() {
    const busy = busyTool();
    if (busy) return busy;
    if (uiState.stage === "draft") return "measurements";
    return uiState.tool;
  }

  // ── 필수 함수 1: stage 전환 (수동만, busy 중에는 잠금) ──
  function setWorkspaceStage(stage) {
    if (!STAGE_TOOLS[stage]) return;
    if (busyTool()) return;
    uiState.stage = stage;
    if (!STAGE_TOOLS[stage].includes(uiState.tool)) uiState.tool = DEFAULT_TOOL[stage];
    refresh();
  }

  // ── 필수 함수 2: 도구 선택 (busy 중에는 그 도구만 허용) ──
  function setActiveTool(tool) {
    const busy = busyTool();
    if (busy && tool !== busy) return;
    if (!STAGE_TOOLS[uiState.stage].includes(tool)) return;
    uiState.tool = tool;
    refresh();
  }

  // ── 필수 함수 3: 현재 컨텍스트의 inspector만 노출 ──
  function updateContextInspector() {
    const busy = busyTool();
    if (busy && uiState.tool !== busy) uiState.tool = busy;   // 작업 인스펙터 유지
    const active = activePanel();
    panelEls().forEach(p => { p.hidden = p.dataset.panel !== active; });

    // 다트 패널: idle 안내 / busy 컨텍스트 전환 (가짜 수치 없음)
    const dartBusy = isDartBusy();
    const idle = document.querySelector("[data-dart-idle]");
    const work = document.querySelector("[data-dart-busy]");
    if (idle) idle.hidden = dartBusy;
    if (work) work.hidden = !dartBusy;
  }

  // ── 필수 함수 4: stage/tool/메뉴의 활성·가용 상태 ──
  function updateContextActions() {
    const busy = busyTool();

    stageEls().forEach(btn => {
      const isCurrent = btn.dataset.stage === uiState.stage;
      btn.setAttribute("aria-selected", String(isCurrent));
      const blocked = !!busy && !isCurrent;
      btn.disabled = blocked;
      if (blocked) btn.setAttribute("aria-disabled", "true");
      else         btn.removeAttribute("aria-disabled");
    });

    toolEls().forEach(btn => {
      const t = btn.dataset.tool;
      const ok = STAGE_TOOLS[uiState.stage].includes(t) && (!busy || t === busy);
      btn.disabled = !ok;
      btn.setAttribute("aria-pressed", String(ok && t === uiState.tool));
      if (ok) btn.removeAttribute("aria-disabled");
      else    btn.setAttribute("aria-disabled", "true");
    });

    // 파일 메뉴: 작업 중에는 닫고 접근 차단(보기 메뉴는 계속 허용).
    // <summary> 에는 disabled 속성이 없으므로 aria-disabled 표시 + 기본동작 차단으로 처리.
    const file = fileMenu();
    if (file) {
      const sum = file.querySelector("summary");
      if (busy) {
        file.open = false;
        sum.setAttribute("aria-disabled", "true");
        sum.setAttribute("title", "작업을 종료한 뒤 사용할 수 있습니다");
      } else {
        sum.removeAttribute("aria-disabled");
        sum.setAttribute("title", "파일");
      }
    }

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
    // 파일 메뉴 잠금: busy 면 열리지 않게 기본동작만 막는다(상태 저장·엔진 호출 없음).
    const file = fileMenu();
    if (file) {
      const sum = file.querySelector("summary");
      sum.addEventListener("click", e => { if (busyTool()) e.preventDefault(); });
      sum.addEventListener("keydown", e => {
        if ((e.key === "Enter" || e.key === " ") && busyTool()) e.preventDefault();
      });
    }
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
    uiState.tool  = null;
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
