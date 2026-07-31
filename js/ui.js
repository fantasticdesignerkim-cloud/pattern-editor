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

  // stage 별 도구. 다트·곡선 성형은 "원형(draft)" 을 만드는 작업이므로 draft stage 의
  // 도구다. design stage 는 실제 designProject·reference renderer 가 구현되기 전까지
  // 가용 stage 목록에 없다(STAGE_TOOLS 에 키 없음 = 미가용 → 정직하게 disabled).
  // 진입 시 도구를 자동 선택하지 않는다(tool=null). 도구·context 는 사용자가 캔버스
  // 상단 바에서 직접 고를 때만 나타난다.
  // design 은 stage 로 존재하지만 원형용 도구를 노출하지 않는다(빈 배열) — 원형 다트·곡선
  // 도구는 draft 책임. design 탭의 실제 활성 조건은 STAGE_TOOLS 키 유무가 아니라
  // designWorkflow.hasProject()다(stageAvailable 참고). project 생성 권한은 D3b 의
  // "디자인 시작" 버튼만 가진다(탭 클릭은 기존 project 탐색만).
  const STAGE_TOOLS  = { draft: ["dart", "curves"], design: [] };
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

  // context-host 에 띄울 "도구 패널"만 파생한다(measurements 는 별개로 stage 파생).
  // busy 가 tool 보다 우선. measurements 와 상호배타로 묶지 않는다 —
  // 원형 stage 에서는 우측 치수 inspector 와 도구 popup 이 동시에 보여야 한다.
  function contextTool() {
    const busy = busyTool();
    if (busy) return busy;      // "dart" | "curves"
    return uiState.tool;        // "dart" | "curves" | null
  }

  // render.js(및 외부)가 읽는 읽기 전용 신호. design 화면 여부.
  function isDesignStageActive() { return uiState.stage === "design"; }

  // stage 진입 가용성. design 은 project 가 있어야만 진입 가능(계약 교정 1) — 완료본만
  // 있고 project 가 없으면 탭을 눌러도 빈 design 에 들어가지 않는다. project 생성은
  // "디자인 시작"(D3b) 전용.
  function stageAvailable(stage) {
    if (stage === "design") return !!(window.designWorkflow && window.designWorkflow.hasProject());
    return Object.prototype.hasOwnProperty.call(STAGE_TOOLS, stage);
  }

  // ── 필수 함수 1: stage 전환 (수동만, busy 중에는 잠금) ──
  function setWorkspaceStage(stage) {
    if (!STAGE_TOOLS[stage]) return;
    if (!stageAvailable(stage)) return;   // design: project 없으면 진입 불가
    if (busyTool()) return;
    const changed = uiState.stage !== stage;
    uiState.stage = stage;
    if (!STAGE_TOOLS[stage].includes(uiState.tool)) uiState.tool = DEFAULT_TOOL[stage];
    refresh();
    // stage 전환 시 캔버스를 다시 그린다(setWorkspaceStage 는 원래 render 를 호출하지
    // 않았다). draft↔design 전환에서 라이브 원형 ↔ design 레이어가 즉시 바뀌게 한다.
    if (changed && typeof render === "function") render();
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
    // 두 표시를 독립 파생한다(상호배타로 묶지 않는다):
    //  · measurements(우측 치수 inspector 패널) = stage 로만. 도구 선택과 무관하게
    //    원형 stage 에서는 항상 표시한다.
    //  · dart/curves(context-host popup) = 선택/busy 도구.
    const ctx = contextTool();
    panelEls().forEach(p => {
      const name = p.dataset.panel;
      if (name === "measurements") p.hidden = uiState.stage !== "draft";
      else p.hidden = name !== ctx;
    });

    // 원형 stage 만 우측 치수 inspector 를 쓴다. design stage 는 inspector 자체를 숨기고
    // (CSS :has 가 280px column 도 함께 제거). 현재 design 은 미가용이라 원형에서만 표시.
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
      const stage = btn.dataset.stage;
      // design 탭 활성 = designWorkflow.hasProject()(계약 교정 1). project 가 없으면
      // 완료본이 있어도 disabled — 탭만으로 빈 design 진입 금지. draft 는 상시 가용.
      const available = stageAvailable(stage);
      const isCurrent = stage === uiState.stage;
      btn.setAttribute("aria-selected", String(isCurrent));
      const blocked = !available || (!!busy && !isCurrent);
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
    // chrome 표시 전용 stage 신호(CSS 가 design 에서 toolbar·메뉴·undo/redo 를 숨긴다).
    // 기존 inspector.hidden(updateContextInspector) 로직은 그대로 두어 이중 책임을 막는다.
    document.documentElement.dataset.workspaceStage = uiState.stage;
    updateContextActions();
    updateContextInspector();
    updateDartInspector();
    updateCompletionUI();
  }

  // ── 원형 완료 최소 UI ─────────────────────────
  // 읽기 전용: blockWorkflow.latest()·hasCompleted() 와 dirty(isMeasureDirty)·busy(busyTool)
  // 만 읽어 버튼/문구를 갱신한다. isCurrentDraftChanged() 는 호출하지 않는다(자동 hash
  // 비교·canvas observer 금지). uiState 에 완료 상태를 복제하지 않는다.
  function measurementsDirty() {
    return (typeof isMeasureDirty !== "undefined") && !!isMeasureDirty;
  }

  function updateCompletionUI() {
    const btn  = document.getElementById("btnCompleteDraft");
    const note = document.getElementById("blockStatusNote");
    if (!btn && !note) return;
    const wf = window.blockWorkflow;
    const dirty = measurementsDirty();
    const busy = !!busyTool();
    const completed = !!(wf && wf.hasCompleted());
    const latestV = completed ? wf.latest().version : 0;

    if (btn) {
      btn.textContent = completed ? "다시 완료" : "원형 완료";
      const blocked = dirty || busy;
      btn.disabled = blocked;
      if (blocked) {
        btn.setAttribute("aria-disabled", "true");
        btn.setAttribute("title", dirty
          ? "패턴을 다시 생성한 뒤 완료할 수 있습니다"
          : "현재 작업을 종료한 뒤 완료할 수 있습니다");
      } else {
        btn.removeAttribute("aria-disabled");
        btn.setAttribute("title", "현재 원형을 세션 완료본으로 기록합니다");
      }
    }
    if (note) {
      // 정직한 표현: 완료 후 draft 를 수정했어도 자동 비교 전에는 "완료본 v_ 보관 중".
      note.textContent = dirty ? "패턴을 다시 생성한 뒤 완료하세요"
        : busy ? "현재 작업을 종료한 뒤 완료하세요"
        : completed ? "완료본 v" + latestV + " 보관 중 · 세션 전용"
        : "원형 미완료 · 세션 전용";
    }

    // ── 디자인 시작/계속 버튼(D3b-1) ──
    // enabled = hasCompleted() && !busy. dirty 는 허용(기존 완료본으로 시작하므로).
    // project 가 있으면 그 고정 version 을 title 로 노출(디자인 계속), 없으면 완료본 version.
    // 별도 note 를 만들지 않는다(#blockStatusNote 가 "완료본 v_ 보관 중" 을 이미 표시).
    const startBtn = document.getElementById("btnStartDesign");
    if (startBtn) {
      const dw = window.designWorkflow;
      const hasProject = !!(dw && dw.hasProject());
      const startEnabled = completed && !busy;   // dirty 무관
      startBtn.textContent = hasProject ? "디자인 계속" : "디자인 시작";
      startBtn.disabled = !startEnabled;
      if (!startEnabled) {
        startBtn.setAttribute("aria-disabled", "true");
        startBtn.setAttribute("title", !completed
          ? "원형을 완료한 뒤 디자인을 시작할 수 있습니다"
          : "현재 작업을 종료한 뒤 디자인을 시작할 수 있습니다");
      } else {
        startBtn.removeAttribute("aria-disabled");
        startBtn.setAttribute("title", hasProject
          ? "원형 v" + dw.current().sourceBlock.version + " 디자인 계속"
          : "완료본 v" + latestV + "으로 디자인 시작");
      }
    }
  }

  // 완료 버튼 클릭: dirty/busy 재검사 → blockWorkflow.complete() → 성공 refresh /
  // 실패 시 성공 상태를 바꾸지 않고 reason 별로 문구만 정직하게 안내(콘솔로 흘리지 않음).
  // stage 를 활성화하거나 자동 전환하지 않는다.
  function onCompleteDraft() {
    const wf = window.blockWorkflow;
    if (!wf) return;
    if (measurementsDirty() || busyTool()) { refresh(); return; }  // 방어 재검사
    let ok = true, reason = null;
    try { wf.complete(); }
    catch (e) { ok = false; reason = e && e.reason; }
    if (ok) { refresh(); return; }
    const note = document.getElementById("blockStatusNote");
    if (note) {
      note.textContent =
        reason === "measure-dirty" ? "패턴을 다시 생성한 뒤 완료하세요"
        : (reason === "dart-busy" || reason === "edit-busy") ? "현재 작업을 종료한 뒤 완료하세요"
        : "완료할 수 없습니다 · 원형을 다시 생성해 주세요";
    }
    // refresh 를 부르지 않아 성공 상태·문구를 오염시키지 않고 실패 안내를 유지한다.
  }

  // 디자인 시작/계속 클릭: hasCompleted && !busy 재검사(UI disabled 만 믿지 않음) →
  // project 없으면 startFromBlock(latest()) / 있으면 current() → 성공한 뒤에만
  // setWorkspaceStage("design"). 실패 시 draft 유지·오염 0·정직한 문구.
  // 자동 complete·재캡처·latest 자동 교체·busy 강제 종료 없음.
  function onStartDesign() {
    const bw = window.blockWorkflow, dw = window.designWorkflow;
    if (!bw || !dw) return;
    // ★ 재검사: 완료본 없음/busy 중이면 진입 금지(dirty 는 허용).
    if (!bw.hasCompleted() || busyTool()) { refresh(); return; }
    let project = null, reason = null;
    try {
      project = dw.hasProject() ? dw.current() : dw.startFromBlock(bw.latest());
    } catch (e) { reason = (e && e.reason) || "start-failed"; }
    if (!project) {
      const note = document.getElementById("blockStatusNote");
      if (note) note.textContent = "디자인을 시작할 수 없습니다 · 다시 시도하세요";
      return; // draft 유지, project/version 오염 0
    }
    setWorkspaceStage("design"); // 성공 후에만(내부에서 hasProject·busy 게이트 재확인)
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
    // 원형 완료 버튼(inline onclick 없음 — addEventListener 로만 연결, inline handler 37 유지).
    const complete = document.getElementById("btnCompleteDraft");
    if (complete) complete.addEventListener("click", () => { if (!complete.disabled) onCompleteDraft(); });
    // 디자인 시작/계속 버튼(inline onclick 없음 — addEventListener 로만 연결).
    const startDesign = document.getElementById("btnStartDesign");
    if (startDesign) startDesign.addEventListener("click", () => { if (!startDesign.disabled) onStartDesign(); });
    // 패턴 생성 후: inline generatePattern() 이 끝난 뒤(dirty=false) 버튼/문구를 갱신.
    const gen = document.getElementById("btnGenerate");
    if (gen) gen.addEventListener("click", () => queueMicrotask(refresh));
    // 치수 입력 변경 후: inline markDirty/render 가 끝난 뒤 버튼/문구를 갱신(새 Observer 없음).
    document.querySelectorAll('.inspector [data-panel="measurements"] input, .inspector [data-panel="measurements"] select')
      .forEach(el => {
        el.addEventListener("input",  () => queueMicrotask(refresh));
        el.addEventListener("change", () => queueMicrotask(refresh));
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
  window.isDesignStageActive    = isDesignStageActive;   // render.js 등이 읽는 읽기 전용 신호
})();
