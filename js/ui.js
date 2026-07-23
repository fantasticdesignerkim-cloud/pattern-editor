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
  // design 진입 시 도구를 자동 선택하지 않는다(tool=null). 도구·context 는 사용자가
  // 캔버스 상단 바에서 직접 고를 때만 나타난다.
  const STAGE_TOOLS  = { draft: [], design: ["dart", "curves"] };
  const DEFAULT_TOOL = { draft: null, design: null };

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
  // idle 에서 동일 도구 재선택 = 닫힘(tool=null). busy 중 동일 도구는 유지(강제 종료 없음).
  function setActiveTool(tool) {
    const busy = busyTool();
    if (busy && tool !== busy) return;
    if (!STAGE_TOOLS[uiState.stage].includes(tool)) return;
    uiState.tool = (tool === uiState.tool && !busy) ? null : tool;
    refresh();
  }

  // ── tool 동기화: busy(실제 DOM 파생)에서 tool 을 맞춘다 ──
  // refresh 맨 앞에서 1회만 실행해, 뒤이은 updateContextActions(aria-pressed) 와
  // updateContextInspector(패널 표시) 가 **같은 tool 값**을 보게 한다. 이 조정을
  // inspector 안에 두면 actions 가 먼저 옛 tool 로 aria-pressed 를 굳혀 버린다
  // (Reset 후 tool=null 인데 도구 버튼이 계속 눌린 것처럼 보이던 순서 버그).
  function syncToolFromBusy() {
    const busy = busyTool();
    if (busy && uiState.tool !== busy) uiState.tool = busy;   // busy 면 그 도구로
    // dart Apply 는 현재 다트만 커밋하고 세션을 유지한다(busy=dart) → 이 분기에 안 걸려
    // tool=dart 가 유지된다(다중다트 연속 작업). Cancel·Reset 만 세션을 닫아 busy=false 가
    // 되고, 그때 tool=null 로 되돌린다. curves 는 편집 종료 후에도 tool=curves 를 유지한다.
    // dartMove.js 를 바꾸지 않고 실제 DOM 파생(busyTool)만으로 판정한다.
    if (uiState.tool === "dart" && busy !== "dart") uiState.tool = null;
  }

  // ── 필수 함수 3: 현재 컨텍스트의 inspector만 노출 ──
  function updateContextInspector() {
    const active = activePanel();
    panelEls().forEach(p => { p.hidden = p.dataset.panel !== active; });

    // 원형 stage 만 우측 치수 inspector 를 쓴다. design stage 는 inspector 자체를 숨기고
    // (CSS :has 가 280px column 도 함께 제거), 도구 조작은 상단 context host 가 담당한다.
    // 새 상태 저장 없이 stage 로만 파생한다.
    const inspector = document.querySelector(".inspector");
    if (inspector) inspector.hidden = uiState.stage !== "draft";

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
    syncToolFromBusy();
    updateContextActions();
    updateContextInspector();
    updateDartInspector();
  }

  // ── 다트 inspector 표시 ───────────────────────
  // 엔진 스냅샷을 **그 순간 읽기만** 한다. uiState 에 저장하지 않는다.
  const setText = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  const setShown = (id, on) => { const el = document.getElementById(id); if (el) el.hidden = !on; };

  // 크기만 표기(부호는 사용자에게 노출하지 않음), 소수 2자리에서 불필요한 0 제거
  function degText(rad) {
    if (rad == null) return "—";
    let t = (Math.abs(rad) * 180 / Math.PI).toFixed(2);
    if (t.indexOf(".") >= 0) t = t.replace(/0+$/, "").replace(/\.$/, "");
    return (t === "" ? "0" : t) + "°";
  }

  function stepLabel(s) {
    if (!s.active) return "대기";
    if (!s.side) return "앞판 / 뒤판 선택";
    if (s.valid === false) return "회전 · 적용 불가";
    if (s.stepKey === "selectCut") return "절개 위치 선택";
    if (s.stepKey === "selectPiece") return "조각 선택";
    if (s.stepKey === "drag") return s.valid === null ? "회전 준비" : "회전";
    return "대기";
  }

  function updateDartInspector() {
    if (typeof getDartMoveUiSnapshot !== "function") return;
    const s = getDartMoveUiSnapshot();
    const ready = s.maxReachableRad != null;          // 조각 선택 이후에만 수치가 존재

    setText("dartPropSide", s.side === "front" ? "앞판" : s.side === "back" ? "뒤판" : "—");
    setText("dartPropStep", stepLabel(s));
    setText("dartPropRange",  ready ? "0–" + degText(s.maxReachableRad) : "—");
    setText("dartPropBudget", s.budgetRad == null ? "—" : degText(s.budgetRad));
    setText("dartPropRotation", !ready ? "—"
      : degText(s.userAngleRad) + (s.openWidthCm == null ? "" : " · " + s.openWidthCm.toFixed(1) + "cm"));

    // 소스 다트각은 sourceNotch 경로에서만(이동 전 확정값). gen-0 은 보조 문구 하나만.
    // "이동된 각 / 잔여각"은 엔진 metrics 가 최근접 휴리스틱이라 완전 이동에서 틀리므로
    // 표시하지 않는다(S5 조사 결론 C).
    const src = s.viaSourceNotch;
    setShown("dartPropSourceRow", src && s.sourceApertureBeforeRad != null);
    setShown("dartPropNewNote",   ready && !src);
    if (src) setText("dartPropSource", degText(s.sourceApertureBeforeRad));
  }

  // ── btnDartMove 라벨: 별도 boolean 없이 실제 DOM 텍스트에서 파생 ──
  function syncDartLabel() {
    const b = document.getElementById("btnDartMove");
    if (!b) return;
    const label = b.textContent.trim() === "취소" ? "다트 이동 종료" : "다트 이동 시작";
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
    // MutationObserver 는 두 곳에만 (attributes 는 관찰하지 않아 루프 없음):
    //  · btnDartMove — 시작/취소/적용 전이
    //  · dartMoveHint — 절개 위치·조각 선택·드래그 (setHint 가 매 전이/드래그마다 호출)
    // polling·rAF 루프·document 전역 Observer 는 쓰지 않는다.
    const dart = document.getElementById("btnDartMove");
    if (dart) {
      new MutationObserver(refresh)
        .observe(dart, { childList: true, characterData: true, subtree: true });
    }
    const hint = document.getElementById("dartMoveHint");
    if (hint) {
      new MutationObserver(updateDartInspector)
        .observe(hint, { childList: true, characterData: true, subtree: true });
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
