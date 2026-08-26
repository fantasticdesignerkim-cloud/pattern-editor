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
//    예외: DB1b 몸판 디자인 적용(onApplyBodyLength)만은 designBodice.computeGeometry 로
//    재계산해 project.working 에 원자적으로 커밋하고 render() 한다(design stage 전용 기능).
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
    // design 진입은 designLayout.enterDesign()(소매 auto 배치 + 몸판 카메라 중앙 + render).
    if (changed) {
      if (uiState.stage === "design" && window.designLayout) window.designLayout.enterDesign();
      else if (typeof render === "function") render();
    }
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
      // 우측 inspector 패널은 stage 로 상호배타 표시(동시 노출 금지):
      //  · measurements = draft 에서만 · design-body = design 에서만.
      if (name === "measurements") p.hidden = uiState.stage !== "draft";
      else if (name === "design-body") p.hidden = uiState.stage !== "design";
      else p.hidden = name !== ctx;   // dart/curves context-host popup
    });

    // 우측 inspector 는 draft(치수) 와 design(몸판 디자인) 에서 쓴다. 그 외에는 숨겨
    // (CSS :has 가 280px column 도 함께 제거). 두 stage 만 진입 가능하므로 사실상 상시.
    const inspector = document.querySelector(".inspector");
    if (inspector) inspector.hidden = !(uiState.stage === "draft" || uiState.stage === "design");

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
    updateDesignBodyPanel();
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

  // ── DB1b: 몸판 디자인(허리 아래 길이) 컨트롤러 ──────────────────
  // ui.js 는 원칙적으로 기능 함수를 호출하지 않지만, design-body 적용만은 예외다 —
  // designBodice.computeGeometry 로 재계산해 project.working 에 원자적으로 커밋하고
  // render() 한다. 계산 기준은 **항상 referenceGeometry**(현재 working 을 입력으로
  // 재사용하지 않는다). 실패 시 parameters·geometry·화면 변화 0.
  function fmtL(v) { return String(Math.round(v * 10) / 10); }
  function designProjectNow() {
    const dw = window.designWorkflow;
    const project = dw && dw.current();
    return (uiState.stage === "design" && project) ? project : null;
  }
  function committedBody(project) {
    const b = project && project.working && project.working.parameters && project.working.parameters.body;
    const num = (k) => (b && typeof b[k] === "number") ? b[k] : 0;
    return { L: num("hemExtensionBelowWaistCm"), E: num("bustEaseCm"), W: num("waistSideOffsetCm"), H: num("hemSideOffsetCm"), Cv: num("sideSeamCurve") };
  }
  // 프리미티브(line/path) 호 길이(cubic 은 평탄화 합).
  function primArcLen(pr) {
    const d = (a, c) => Math.hypot(c.x - a.x, c.y - a.y);
    if (pr.kind === "line") return d(pr.from, pr.to);
    if (!Array.isArray(pr.commands)) return 0;
    let total = 0, cur = pr.commands[0] && pr.commands[0].points[0];
    pr.commands.forEach(cmd => {
      if (cmd.type === "M") { cur = cmd.points[0]; return; }
      if (cmd.type !== "C" || !cur) return;
      const p0 = cur, p1 = cmd.points[0], p2 = cmd.points[1], p3 = cmd.points[2];
      let prev = p0; for (let i = 1; i <= 24; i++) { const t = i / 24, u = 1 - t; const q = { x: u*u*u*p0.x + 3*u*u*t*p1.x + 3*u*t*t*p2.x + t*t*t*p3.x, y: u*u*u*p0.y + 3*u*u*t*p1.y + 3*u*t*t*p2.y + t*t*t*p3.y }; total += d(prev, q); prev = q; }
      cur = p3;
    });
    return total;
  }
  const primEnds = (pr) => pr.kind === "line" ? [pr.from, pr.to] : [pr.commands[0].points[0], pr.commands[pr.commands.length - 1].points.slice(-1)[0]];
  // 한 piece 의 side-seam edge(곡선화 반영) 봉제 길이.
  function sideSeamLen(geometry, piece) {
    const b = geometry && geometry[piece]; if (!b || !Array.isArray(b.outline)) return 0;
    return b.outline.filter(pr => pr.edge === "side-seam").reduce((s, pr) => s + primArcLen(pr), 0);
  }
  // 한 piece 의 네크라인 호 길이: center 목점(top=FNP/BNP)에 닿는 edge 없는 outline seg.
  function necklineLen(geometry, piece) {
    const b = geometry && geometry[piece]; if (!b || !Array.isArray(b.outline)) return 0;
    // parametric 결과: computeGeometry 가 designBodice.measureNeckline 으로 측정해 실은 piece 스칼라
    // (다세그먼트 스퀘어 포함, primitive 표식 없음). 없으면(원본/미적용) center 목점 단일 seg 추적.
    if (typeof b.necklineLenCm === "number") return b.necklineLenCm;
    const center = b.outline.find(pr => pr.edge === "center"); if (!center) return 0;
    const ce = primEnds(center); const FNP = ce[0].y < ce[1].y ? ce[0] : ce[1];
    const near = (a, c) => Math.hypot(a.x - c.x, a.y - c.y) < 0.02;
    const seg = b.outline.find(pr => !("edge" in pr) && (() => { const e = primEnds(pr); return near(e[0], FNP) || near(e[1], FNP); })());
    return seg ? primArcLen(seg) : 0;
  }
  function neckLenNote(project) {
    const g = project && project.working && project.working.geometry;
    const el = document.getElementById("designNeckLenNote"); if (!el) return;
    if (!g) { el.textContent = ""; return; }
    // 앞·뒤판은 반쪽 패턴. 반패턴 합계 = 앞반+뒤반. 완성 목둘레 = 2×(반패턴 합계).
    // 카라: 전체 카라=완성 목둘레 / 중심 접어재단 반쪽 카라=반패턴 합계.
    // manual(세부 수정) 상태는 파라미터가 아니라 designOutline 에 스플라이스된 네크라인 boundary 에서 측정.
    const nk = project.working && project.working.parameters && project.working.parameters.neckline;
    const manual = nk && nk.mode === "manual" && window.designLineTool && window.designLineTool.necklineBoundaryLen;
    const f = manual ? window.designLineTool.necklineBoundaryLen("front") : necklineLen(g, "front");
    const b = manual ? window.designLineTool.necklineBoundaryLen("back") : necklineLen(g, "back");
    const half = f + b;
    el.textContent = "앞목선(반쪽) " + fmtL(f) + "cm · 뒤목선(반쪽) " + fmtL(b) + "cm · 반패턴 합계 " + fmtL(half) + "cm · 완성 목둘레 " + fmtL(2 * half) + "cm";
  }
  function committedNeckline(project) {
    const n = project && project.working && project.working.parameters && project.working.parameters.neckline;
    const np = (n && n.parameters) || {};
    const type = (n && n.type) || "original";
    const num = (k, d) => typeof np[k] === "number" ? np[k] : d;
    return {
      type: type, mode: (n && n.mode) || "parametric",
      W: num("neckWidthCm", 0), F: num("frontDepthCm", 0), B: num("backDepthCm", 0),
      // 곡선 정도(round/boat): 미저장이면 형태 기본값(round=1, boat=0.5)
      CA: num("curveAmountNorm", type === "boat" ? 0.5 : 1),
      VD: num("vPointDepthCm", 0), SW: num("squareWidthCm", 0), CR: num("cornerRadiusCm", 0)
    };
  }
  // ── 네크라인 카드(기본형) ── aria-pressed 로 현재 형태 저장. 값의 진실은 DOM(카드+입력).
  function currentNeckType() {
    const cards = document.getElementById("necklineCards");
    if (!cards) return "original";
    const on = cards.querySelector('.neck-card[aria-pressed="true"]');
    return on ? on.getAttribute("data-neck") : "original";
  }
  function setNeckType(type) {
    const cards = document.getElementById("necklineCards");
    if (!cards) return;
    cards.querySelectorAll(".neck-card").forEach(c => c.setAttribute("aria-pressed", c.getAttribute("data-neck") === type ? "true" : "false"));
    syncNecklineRows(type);
  }
  // 형태별 입력 행 표시/숨김. original 이면 전부 숨김. round/boat=곡선정도, v=V끝점, square=가로폭·모서리.
  function syncNecklineRows(type) {
    const cards = document.getElementById("necklineCards");
    const panel = cards && cards.closest(".insp-body");
    if (!panel) return;
    panel.querySelectorAll("[data-neck-for]").forEach(r => {
      const forTypes = r.getAttribute("data-neck-for").split(/\s+/);
      const show = type !== "original" && (forTypes.indexOf("common") >= 0 || forTypes.indexOf(type) >= 0);
      r.hidden = !show;
      // 곡선 정도 행을 처음 표시할 때 비어 있으면 형태 기본값 채움(빈 값=0=평평 방지)
      if (show && r.getAttribute("data-neck-for") === "round boat") {
        const inp = document.getElementById("inpNeckCurveAmount");
        if (inp && String(inp.value).trim() === "") inp.value = fmtL(type === "boat" ? 0.5 : 1);
      }
    });
  }
  // 앞·뒤 옆선 봉제 길이 + 차이(정합 검증) 문구. 차이 > 1cm 이면 주의.
  function sideLenNote(project) {
    const g = project && project.working && project.working.geometry;
    const el = document.getElementById("designSideLenNote"); if (!el) return;
    if (!g) { el.textContent = ""; el.removeAttribute("data-ok"); return; }
    const f = sideSeamLen(g, "front"), b = sideSeamLen(g, "back"), diff = Math.abs(f - b);
    el.textContent = "앞옆선 " + fmtL(f) + "cm · 뒤옆선 " + fmtL(b) + "cm · 차이 " + fmtL(diff) + "cm";
    el.setAttribute("data-ok", diff <= 1 ? "1" : "0");
  }
  function setBodyNote(txt) { const n = document.getElementById("designBodyNote"); if (n) n.textContent = txt; }
  // 적용 중 상태 문구(여유량·길이·허리/밑단 옆선). 전부 0이면 기본 안내. 옆선은 부호 표시(안/밖).
  function offStr(v, inLabel, outLabel) { return (v < 0 ? inLabel + " " + fmtL(-v) : outLabel + " " + fmtL(v)) + "cm"; }
  function bodyStatusNote(E, L, W, H, Cv, neckType) {
    const parts = [];
    if (E > 0) parts.push("여유량 " + fmtL(E) + "cm");
    if (L > 0) parts.push("길이 " + fmtL(L) + "cm");
    if (W !== 0) parts.push("허리 " + offStr(W, "안쪽", "바깥"));
    if (H !== 0) parts.push("밑단 " + offStr(H, "안쪽", "바깥"));
    if (Cv > 0) parts.push("옆선 곡선 " + fmtL(Cv));
    const NECK_LABEL = { round: "라운드넥", v: "V넥", square: "스퀘어넥", boat: "보트넥" };
    if (NECK_LABEL[neckType]) parts.push(NECK_LABEL[neckType]);
    return parts.length ? parts.join(" · ") + " · 세션 전용" : "여유량·길이·옆선 실루엣·네크라인으로 몸판을 조정합니다";
  }
  function noteForReason(reason) {
    if (reason === "extension-intersection") return "연장선이 기존 패턴과 겹칩니다 · 값을 조정하세요";
    if (reason === "invalid-side-extension") return "이 길이로는 옆선을 연장할 수 없습니다";
    if (reason === "invalid-body-length" || reason === "invalid-body-ease") return "여유량·길이는 0–100 사이여야 합니다";
    if (reason === "invalid-body-side-offset") return "옆선 이동은 −30–30 사이여야 합니다";
    if (reason === "invalid-body-curve") return "옆선 곡선화는 0–1 사이여야 합니다";
    if (reason === "invalid-neckline-param") return "네크라인 입력값을 확인하세요";
    if (reason === "neckline-not-found" || reason === "shoulder-not-found") return "이 형태로는 네크라인을 계산할 수 없습니다";
    return "적용할 수 없습니다 · 값을 조정하세요";
  }
  // 한 입력의 유효성(빈 값=0, 그 외 [min,max] 유한 숫자).
  function readNum(id, min, max) {
    const input = document.getElementById(id);
    const raw = input ? String(input.value).trim() : "";
    if (raw === "") return { input: input, v: 0, valid: true };
    const v = Number(raw);
    return { input: input, v: v, valid: isFinite(v) && v >= min && v <= max };
  }
  // 빈 값이면 dflt(형태별 기본값). 그 외 [min,max] 유한.
  function readNumD(id, min, max, dflt) {
    const el = document.getElementById(id);
    const raw = el ? String(el.value).trim() : "";
    if (raw === "") return { input: el, v: dflt, valid: true };
    const v = Number(raw);
    return { input: el, v: v, valid: isFinite(v) && v >= min && v <= max };
  }
  function readBodyInputs() {
    const ease = readNum("inpBodyBustEase", 0, 100), len = readNum("inpBodyHemExtension", 0, 100);
    const waist = readNum("inpBodyWaistOffset", -30, 30), hem = readNum("inpBodyHemOffset", -30, 30);
    const curve = readNum("inpBodySideCurve", 0, 1);
    const neckType = currentNeckType();
    const nW = readNum("inpNeckWidth", -15, 15), nF = readNum("inpNeckFrontDepth", -10, 20), nB = readNum("inpNeckBackDepth", -10, 20);
    // 형태별: 곡선정도 빈 값=형태 기본(round 1 / boat 0.5), V끝점·가로폭·모서리 빈 값=0
    const nCA = readNumD("inpNeckCurveAmount", 0, 1, neckType === "boat" ? 0.5 : 1);
    const nVD = readNum("inpNeckVDepth", 0, 20), nSW = readNum("inpNeckSquareWidth", 0, 20), nCR = readNum("inpNeckCornerRadius", 0, 10);
    return {
      ease, len, waist, hem, curve, neckType, nW, nF, nB, nCA, nVD, nSW, nCR,
      valid: ease.valid && len.valid && waist.valid && hem.valid && curve.valid &&
        nW.valid && nF.valid && nB.valid && nCA.valid && nVD.valid && nSW.valid && nCR.valid
    };
  }
  // apply/reset 버튼 활성 상태만 갱신(값·note 미변경 — 성공/오류 문구 보존).
  function syncBodyButtons() {
    const project = designProjectNow();
    const manual = !!(project && committedNeckline(project).mode === "manual");
    const apply = document.getElementById("btnApplyBodyLength");
    const reset = document.getElementById("btnResetBodyLength");
    if (apply) apply.disabled = !(project && readBodyInputs().valid);
    if (reset) reset.disabled = !project || manual;   // manual 은 기본형으로 돌아가기로 먼저 나간 뒤 리셋
  }
  // 네크라인 mode 잠금 표시: manual 이면 카드·수치 입력 disabled + 기본형으로 돌아가기 노출,
  // parametric 이면 카드·입력 활성 + (적용된 형태일 때만) 세부 수정 활성. 표시 제어만(엔진 미호출).
  function syncNecklineModeUI(project) {
    const cn = project ? committedNeckline(project) : { mode: "parametric", type: "original" };
    const manual = cn.mode === "manual";
    const cards = document.getElementById("necklineCards");
    if (cards) cards.querySelectorAll(".neck-card").forEach(c => { c.disabled = manual; });
    ["inpNeckWidth", "inpNeckFrontDepth", "inpNeckBackDepth", "inpNeckCurveAmount", "inpNeckVDepth", "inpNeckSquareWidth", "inpNeckCornerRadius"]
      .forEach(id => { const el = document.getElementById(id); if (el) el.disabled = manual; });
    const bM = document.getElementById("btnNeckManual"), bR = document.getElementById("btnNeckRevert");
    if (bM) { bM.hidden = manual; bM.disabled = !(project && !manual && cn.type !== "original"); }
    if (bR) bR.hidden = !manual;
    const note = document.getElementById("designNeckModeNote");
    if (note) note.textContent = manual ? "세부 수정 중 · 카드·수치 잠금 · anchor·핸들·snap 으로 편집"
      : (cn.type !== "original" ? "세부 수정으로 네크라인을 직접 편집할 수 있습니다" : "");
  }
  // 세부 수정: 현재 committed parametric 네크라인을 앞·뒤 boundary patternLine 으로 변환(manual).
  function onNeckManual() {
    const project = designProjectNow();
    if (!project || !window.designLineTool) return;
    const cn = committedNeckline(project);
    if (cn.mode !== "parametric" || cn.type === "original") return;
    const r = window.designLineTool.convertNecklineToBoundary(project.working.parameters.neckline);
    const note = document.getElementById("designNeckModeNote");
    if (!r.ok) { if (note) note.textContent = "세부 수정 불가: " + r.reason; return; }   // 변경 없음
    refreshFrontPlacket(project);   // 네크라인 → designOutline 변경 → 여밈 재파생
    if (typeof render === "function") render();
    refresh();
  }
  // 기본형으로 돌아가기: 자동 네크라인 boundary 만 제거하고 parametric 복귀(다른 사용자 선 보존).
  function onNeckRevert() {
    const project = designProjectNow();
    if (!project || !window.designLineTool) return;
    const r = window.designLineTool.revertNecklineToParametric();
    const note = document.getElementById("designNeckModeNote");
    if (!r.ok) { if (note) note.textContent = "기본형 복귀 불가: " + r.reason; return; }
    refreshFrontPlacket(project);   // 네크라인 변경 → 유효 외곽 변경 → 여밈 재파생
    if (typeof render === "function") render();
    refresh();
  }

  // ── 앞중심 여밈(front placket) ── computeGeometry 밖의 별도 파생. 현재 유효 앞판 외곽에서 파생.
  function readPlacketInputs() {
    const overlap = readNum("inpPlacketOverlap", 0, 10), facing = readNum("inpPlacketFacing", 0, 15);
    return { overlap, facing, valid: overlap.valid && facing.valid };
  }
  function committedPlacket(project) {
    const pk = project && project.working && project.working.frontPlacket;
    const pr = (pk && pk.parameters) || {};
    return { has: !!pk, overlap: typeof pr.overlapCm === "number" ? pr.overlapCm : 0, facing: typeof pr.facingWidthCm === "number" ? pr.facingWidthCm : 0 };
  }
  // 현재 유효 앞판 외곽: manual 네크라인은 designOutline 에 있으므로 그것을 우선.
  function effectiveFrontOutline(project) {
    const dO = project.working.designOutline && project.working.designOutline.front;
    if (dO && Array.isArray(dO.outline) && dO.outline.length) return dO.outline;
    const g = project.working.geometry && project.working.geometry.front;
    return (g && Array.isArray(g.outline)) ? g.outline : null;
  }
  function setPlacketNote(txt) { const n = document.getElementById("designPlacketNote"); if (n) n.textContent = txt; }
  // params 로 여밈 재파생(원자적). 성공 시 working.frontPlacket 교체, 실패 시 제거(stale 금지) + 사유.
  function computeFrontPlacket(project, params) {
    if (!window.designPlacket) return { ok: false, reason: "no-module" };
    const outline = effectiveFrontOutline(project);
    if (!outline) { project.working.frontPlacket = null; return { ok: false, reason: "no-outline" }; }
    const r = window.designPlacket.compute(outline, params);
    if (!r.ok) { project.working.frontPlacket = null; return r; }   // 실패 시 stale 유지 금지
    project.working.frontPlacket = { parameters: { overlapCm: params.overlapCm, facingWidthCm: params.facingWidthCm, lengthMode: "full" }, outline: r.outline, construction: r.construction };
    return { ok: true };
  }
  // 유효 외곽이 바뀐 뒤(몸판·네크라인 변경) 저장된 여밈 파라미터로 재파생. 여밈 없으면 무동작.
  function refreshFrontPlacket(project) {
    project = project || designProjectNow(); if (!project) return;
    const cp = committedPlacket(project);
    if (!cp.has) return;
    computeFrontPlacket(project, { overlapCm: cp.overlap, facingWidthCm: cp.facing, lengthMode: "full" });
  }
  function placketNoteFor(reason) {
    if (reason === "invalid-overlap" || reason === "invalid-facing") return "여밈분·안단 폭은 0 이상이어야 합니다";
    if (reason === "no-placket") return "여밈분·안단 폭을 입력하세요";
    if (reason === "no-outline" || reason === "no-cf-edge" || reason === "degenerate-cf-edge") return "앞판 외곽에서 여밈을 만들 수 없습니다";
    return "여밈을 적용할 수 없습니다 · 값을 확인하세요";
  }
  function onApplyPlacket() {
    const project = designProjectNow();
    if (!project || !window.designPlacket) return;
    const st = readPlacketInputs();
    if (!st.valid) { setPlacketNote("여밈분 0–10 · 안단 폭 0–15 범위를 확인하세요"); return; }
    const r = computeFrontPlacket(project, { overlapCm: st.overlap.v, facingWidthCm: st.facing.v, lengthMode: "full" });
    if (!r.ok) { setPlacketNote(placketNoteFor(r.reason)); if (typeof render === "function") render(); return; }
    if (typeof render === "function") render();
    setPlacketNote("여밈 " + fmtL(st.overlap.v) + "cm · 안단 " + fmtL(st.facing.v) + "cm(컷온) · 세션 전용");
    syncPlacketButtons();
    updateBodiceCheckpointUI(project);
  }
  function onClearPlacket() {
    const project = designProjectNow();
    if (!project) return;
    project.working.frontPlacket = null;
    ["inpPlacketOverlap", "inpPlacketFacing"].forEach(id => { const el = document.getElementById(id); if (el) el.value = "0"; });
    if (typeof render === "function") render();
    setPlacketNote("여밈 제거됨"); syncPlacketButtons();
    updateBodiceCheckpointUI(project);
  }
  function syncPlacketButtons() {
    const project = designProjectNow();
    const apply = document.getElementById("btnApplyPlacket"), clear = document.getElementById("btnClearPlacket");
    if (apply) apply.disabled = !(project && readPlacketInputs().valid);
    if (clear) clear.disabled = !(project && committedPlacket(project).has);
  }

  // ── 몸판 모양 완료 체크포인트(bodiceCheckpoint) ──
  function bodiceStatusStr(s) { return s === "match" ? "정합" : s === "check" ? "확인" : "불일치"; }
  function bodiceFailStr(reason) {
    const m = {
      "front-outline-not-connected": "앞판 외곽이 연결되지 않음", "back-outline-not-connected": "뒤판 외곽이 연결되지 않음",
      "side-seam-mismatch": "옆선 봉제 길이 불일치(>0.3cm)", "front-armhole-unmeasured": "앞 진동둘레 측정 불가",
      "back-armhole-unmeasured": "뒤 진동둘레 측정 불가", "neckline-unmeasured": "목둘레 측정 불가",
      "neckline-preview-invalid": "네크라인 미리보기 무효", "no-project": "프로젝트 없음"
    };
    return m[reason] || reason;
  }
  // refresh 에서 읽기 전용 — check() 실행해 검사 요약·완료 버튼·상태(미완료/완료/변경됨) 갱신.
  function updateBodiceCheckpointUI(project) {
    const checkNote = document.getElementById("designBodiceCheckNote");
    const statusNote = document.getElementById("designBodiceStatusNote");
    const btn = document.getElementById("btnCompleteBodice");
    if (!project || !window.bodiceCheckpoint) {
      if (btn) btn.disabled = true;
      if (checkNote) checkNote.textContent = "";
      if (statusNote) statusNote.textContent = "몸판 미완료 · 세션 전용";
      return;
    }
    const c = window.bodiceCheckpoint.check(project);
    if (checkNote) checkNote.textContent = "옆선 차 " + fmtL(c.sideSeam.diff) + "cm(" + bodiceStatusStr(c.sideSeam.status) + ") · 진동 앞 " + fmtL(c.armhole.front) + "·뒤 " + fmtL(c.armhole.back) + "cm · 반패턴 목둘레 " + fmtL(c.neckline.half) + "cm";
    if (btn) btn.disabled = !c.ok;
    const latest = window.bodiceCheckpoint.latest(project);
    if (statusNote) {
      if (!latest) statusNote.textContent = c.ok ? "완료 가능 · 세션 전용" : "완료 전 검사: " + bodiceFailStr(c.fails[0]);
      else if (window.bodiceCheckpoint.isCurrentBodiceChanged(project)) statusNote.textContent = "몸판 변경됨 · 다시 완료 필요 · 세션 전용";
      else statusNote.textContent = "몸판 완료됨(원형 v" + latest.sourceVersion + ") · 세션 전용";
    }
    updateSleeveEaseUI(project);   // 소매산 봉제선 정합(읽기 전용) 갱신
    syncDesignSubtabGate(project); // 소매 탭 활성 게이트(몸판 완료·비스테일)
    updateSleevePanel(project);    // 소매 입력·버튼 상태
  }
  function onCompleteBodice() {
    const project = designProjectNow();
    if (!project || !window.bodiceCheckpoint) return;
    const r = window.bodiceCheckpoint.complete(project);
    const statusNote = document.getElementById("designBodiceStatusNote");
    if (!r.ok) { if (statusNote) statusNote.textContent = "완료 불가: " + bodiceFailStr(r.reason); updateBodiceCheckpointUI(project); return; }
    refreshSleeve(project);   // 재완료 → sleeveDraft.sourceBodiceHash 를 새 완료본으로 갱신(S1 하부 설정 재사용)
    refreshCollarStale(project);   // 몸판 hash 변경 시 카라 geometry 숨김(높이 파라미터 보존, 재적용 필요)
    updateBodiceCheckpointUI(project);
    if (typeof render === "function") render();
    if (statusNote) statusNote.textContent = "몸판 완료됨(원형 v" + r.result.sourceVersion + ") · 세션 전용";
  }

  // ── 소매산 봉제선 정합 확인(읽기 전용) ── 완료 몸판 진동 ↔ 소매산 ↔ 이세. 소매 형상·시접 미변경.
  // 완료본 없음/스테일/출처 불일치면 측정 차단. 수치만 표시(합격/불합격 판정 없음, 음수 이세도 그대로).
  function sleeveEaseRelation(project) {
    if (!window.bodiceCheckpoint) return { ok: false, reason: "no-module" };
    const bodice = window.bodiceCheckpoint.latest(project);
    if (!bodice) return { ok: false, reason: "no-bodice" };
    if (window.bodiceCheckpoint.isCurrentBodiceChanged(project)) return { ok: false, reason: "bodice-stale" };
    if (sleeveCapInvalid(project)) return { ok: false, reason: "cap-invalid" };   // manual 편집 무효 → 이세 보류
    // 소매산 길이: 파생 소매(sleeveDraft)면 그 capLengths(S1 원형 cap / S2 변환 cap), 없으면 원형 소매 측정.
    const draft = project.working && project.working.sleeveDraft;
    let cap;
    if (draft && draft.capLengths) {
      if (draft.sourceBodiceHash !== bodice.hash) return { ok: false, reason: "source-mismatch" };   // 소매 출처 ≠ 완료본
      cap = { frontLength: draft.capLengths.front, backLength: draft.capLengths.back, totalLength: draft.capLengths.total };
    } else {
      if (!project.sourceBlock || project.sourceBlock.version !== bodice.sourceVersion) return { ok: false, reason: "source-mismatch" };
      if (!window.sleeveMeasure) return { ok: false, reason: "no-module" };
      cap = window.sleeveMeasure.measureSleeveCap(project.referenceGeometry && project.referenceGeometry.sleeve);
    }
    if (!cap) return { ok: false, reason: "cap-unmeasured" };
    const frontEase = cap.frontLength - bodice.armholeLengths.front;
    const backEase = cap.backLength - bodice.armholeLengths.back;
    return { ok: true, bodice: bodice.armholeLengths, cap: cap, ease: { front: frontEase, back: backEase, total: frontEase + backEase } };
  }
  function updateSleeveEaseUI(project) {
    const el = document.getElementById("designSleeveEaseNote"); if (!el) return;
    if (!project) { el.textContent = ""; return; }
    const r = sleeveEaseRelation(project);
    if (!r.ok) {
      const m = { "no-bodice": "몸판 완료 후 소매산 이세 확인", "bodice-stale": "몸판 변경됨 · 다시 완료 후 이세 확인", "source-mismatch": "소매 출처가 몸판 완료본과 다름(source-mismatch)", "cap-unmeasured": "소매산 봉제선 측정 불가", "cap-invalid": "소매산 편집 무효 · 이세 현재 유효하지 않음", "no-module": "" };
      el.textContent = m[r.reason] || ""; return;
    }
    // 수치만 표시(합격/불합격 판정 없음). 음수 이세는 fmtL 이 부호를 그대로 노출.
    const sgn = v => v >= 0 ? "+" : "";
    el.textContent = "소매산 앞 " + fmtL(r.cap.frontLength) + "·뒤 " + fmtL(r.cap.backLength) + "cm · 이세 앞 " + sgn(r.ease.front) + fmtL(r.ease.front) + "·뒤 " + sgn(r.ease.back) + fmtL(r.ease.back) + "·총 " + sgn(r.ease.total) + fmtL(r.ease.total) + "cm";
  }

  // ── 디자인 몸판/소매 서브탭 + 소매 모양(S1) ──
  function currentDesignSubtab() {
    const tabs = document.getElementById("designSubtabs");
    const on = tabs && tabs.querySelector('.subtab[aria-selected="true"]');
    return on ? on.getAttribute("data-subtab-btn") : "body";
  }
  function setDesignSubtab(tab) {
    const tabs = document.getElementById("designSubtabs"); if (!tabs) return;
    tabs.querySelectorAll(".subtab").forEach(b => b.setAttribute("aria-selected", b.getAttribute("data-subtab-btn") === tab ? "true" : "false"));
    document.querySelectorAll('[data-panel="design-body"] [data-subtab]').forEach(p => { p.hidden = p.getAttribute("data-subtab") !== tab; });
  }
  // 소매 편집 게이트: 몸판 완료(bodiceResult) + 비스테일일 때만.
  function sleeveGateOk(project) {
    return !!(project && window.bodiceCheckpoint && window.bodiceCheckpoint.latest(project) && !window.bodiceCheckpoint.isCurrentBodiceChanged(project));
  }
  // 소매 탭 활성 게이트 + 비활성인데 소매 탭이면 몸판으로 되돌림.
  function syncDesignSubtabGate(project) {
    const btn = document.querySelector('.subtab[data-subtab-btn="sleeve"]'); if (!btn) return;
    const ok = sleeveGateOk(project);
    btn.disabled = !ok; btn.title = ok ? "" : "몸판 완료 후 활성";
    if (!ok && currentDesignSubtab() === "sleeve") setDesignSubtab("body");
  }
  function readSleeveInputs() {   // S1 하부
    const len = readNum("inpSleeveLength", 10, 90), cuff = readNum("inpSleeveCuff", 8, 60);
    const sideEl = document.getElementById("selSleeveSide");
    return { len, cuff, side: sideEl ? sideEl.value : "straight", valid: len.valid && cuff.valid };
  }
  function readCapInputs() {       // S2 소매산: 위팔 완성둘레 + 소매산 높이
    const bicep = readNum("inpSleeveBicep", 10, 80), capH = readNum("inpSleeveCapHeight", 3, 30);
    return { bicep, capH, valid: bicep.valid && capH.valid };
  }
  function committedSleeve(project) {
    const p = project && project.working && project.working.sleeveDraft && project.working.sleeveDraft.parameters;
    return p ? { has: true, lower: p.lower, cap: p.cap || null } : { has: false, lower: null, cap: null };
  }
  function bodiceHashOf(project) {
    const b = project && window.bodiceCheckpoint && window.bodiceCheckpoint.latest(project);
    return b ? b.hash : null;
  }
  function refSleeveVals(project) {
    const ref = window.designSleeve && window.designSleeve.referenceSilhouette(project.referenceGeometry && project.referenceGeometry.sleeve);
    return ref ? { len: ref.sleeveLengthCm, cuff: ref.cuffCircumferenceCm, bicep: ref.bicepCm, capH: ref.capHeightCm } : null;
  }
  function setSleeveNote(t) { const n = document.getElementById("designSleeveNote"); if (n) n.textContent = t; }
  function sleeveFailStr(reason) {
    const m = { "no-sleeve": "소매 외곽을 찾을 수 없음", "invalid-length": "소매길이 값 확인", "invalid-cuff": "소매부리 완성둘레 값 확인", "invalid-side-shape": "옆선 형태 확인", "invalid-bicep": "위팔 완성둘레 값 확인", "invalid-cap-height": "소매산 높이 값 확인", "degenerate-cap": "원형 소매산이 퇴화됨", "cap-unmeasured": "소매산 봉제선 측정 불가", "self-intersection": "소매 형상이 교차합니다 · 값을 조정하세요", "no-module": "" };
    return m[reason] || "소매를 적용할 수 없습니다";
  }
  // 파생: computeSilhouette({lower, cap}) → working.sleeveDraft(sourceBodiceHash·parameters{lower,cap}·
  //   geometry·capLengths) + render 미러 working.geometry.sleeve. 실패 시 이전 유지(호출부 판단).
  function deriveSleeve(project, lower, cap) {
    if (!window.designSleeve) return { ok: false, reason: "no-module" };
    const r = window.designSleeve.computeSilhouette(project.referenceGeometry && project.referenceGeometry.sleeve, { lower: lower, cap: cap || null });
    if (!r.ok) return r;
    project.working.sleeveDraft = {
      sourceBodiceHash: bodiceHashOf(project),
      mode: "parametric", capLineId: null, capInvalid: false,   // S1/S2 적용은 parametric
      parameters: { lower: lower, cap: cap || null },
      geometry: r.geometry, capLengths: r.capLengths
    };
    project.working.geometry.sleeve = r.geometry;   // render/layout 미러(render.js 무변경).
    return { ok: true, result: r };
  }
  function sleeveManual(project) { const d = project && project.working && project.working.sleeveDraft; return !!(d && d.mode === "manual"); }
  function sleeveCapInvalid(project) { const d = project && project.working && project.working.sleeveDraft; return !!(d && d.capInvalid); }
  // 무효 사유(사용자 확정 문구).
  function capInvalidReasonStr(reason) {
    const m = { "cap-order": "소매산 순서가 잘못됨", "self-intersection": "소매산이 자기 교차함", "no-cap-line": "진동밑 연결이 끊김", "cap-split": "SP 분할을 측정할 수 없음", "cap-unmeasured": "SP 분할을 측정할 수 없음" };
    return m[reason] || "소매산 편집이 유효하지 않음";
  }
  // body apply / 재완료 후 재파생. ★ 조건부 hash 규칙(사용자 확정): lower 는 재사용, cap 은 완료본
  // hash 가 달라지면 stale → 폐기하고 reference cap(+lower) 로 복원(사용자가 S2 재적용해야 새 cap).
  function refreshSleeve(project) {
    project = project || designProjectNow(); if (!project) return;
    const c = committedSleeve(project); if (!c.has) return;
    const d = project.working.sleeveDraft;
    const currentHash = bodiceHashOf(project);
    if (d.sourceBodiceHash !== currentHash) {
      // hash 변경 → parametric cap·manual cap 모두 stale: 관리선 제거·capLineId/capInvalid clear·cap 폐기·reference+lower.
      if (d.capLineId) project.working.patternLines = (project.working.patternLines || []).filter(l => l.id !== d.capLineId);
      deriveSleeve(project, c.lower, null);
      return;
    }
    if (d.mode === "manual" && d.capLineId) recomposeSleeveCap();   // 같은 hash: 관리선에서 재합성(하부 변화 반영)
    else deriveSleeve(project, c.lower, c.cap);
  }
  // 관리형 소매산 선(source of truth)에서 소매 재합성. 유효하면 working.geometry.sleeve 갱신, 무효면
  // capInvalid=true(마지막 유효 geometry 유지, 완료 차단). designLineTool 편집 pointerup 이 호출.
  function recomposeSleeveCap() {
    const project = designProjectNow();
    if (!project || !window.designSleeve) return;
    const d = project.working.sleeveDraft;
    if (!d || d.mode !== "manual") return;
    const line = (project.working.patternLines || []).find(l => l.id === d.capLineId);
    if (!line) return;
    const r = window.designSleeve.computeFromCapLine(project.referenceGeometry && project.referenceGeometry.sleeve, line.segments, line.splitAnchorIndex, d.parameters.lower);
    if (!r.ok) {
      d.capInvalid = true; d.capInvalidReason = r.reason;   // 무효: 마지막 유효 geometry 유지, 이세·완료 차단
      setSleeveNote("소매산 편집 무효 · " + capInvalidReasonStr(r.reason) + " · 편집 복구 또는 기본 소매산으로 돌아가기");
    } else {
      d.capInvalid = false; d.capInvalidReason = null;
      project.working.geometry.sleeve = r.geometry; d.geometry = r.geometry; d.capLengths = r.capLengths;
      setSleeveNote("소매산 직접 수정 중 · 재합성됨 · 진동밑 고정");
    }
    if (typeof render === "function") render();
    updateSleevePanel(project); updateSleeveEaseUI(project);
  }
  // 소매산 직접 수정(parametric → manual): 현재 cap 을 관리형 patternLine 으로 변환. cap 파라미터 보존.
  function onSleeveCapManual() {
    const project = designProjectNow();
    if (!project || !window.designSleeve || !window.designLineTool) return;
    if (!sleeveGateOk(project)) { setSleeveNote("몸판 완료 후 소매산을 직접 수정할 수 있습니다"); return; }
    const c = committedSleeve(project);
    if (!c.has) { setSleeveNote("먼저 소매/소매산을 적용한 뒤 직접 수정할 수 있습니다"); return; }
    const lc = window.designSleeve.capLineFromGeometry(project.working.geometry.sleeve);
    if (!lc) { setSleeveNote("소매산을 관리선으로 변환할 수 없습니다"); return; }
    const ls = project.working.patternLines || (project.working.patternLines = []);
    const id = window.designLineTool.nextId(ls);
    ls.push({ id: id, piece: "sleeve", role: "boundary", managedBy: "sleeve-cap", splitAnchorIndex: lc.splitAnchorIndex, segments: lc.segments });
    const d = project.working.sleeveDraft;
    d.mode = "manual"; d.capLineId = id; d.capInvalid = false;
    if (typeof render === "function") render();
    setSleeveNote("소매산 직접 수정 중 · 진동밑 고정 · SP·중간 anchor·핸들 편집");
    updateSleevePanel(project); updateSleeveEaseUI(project);
  }
  // 기본 소매산으로 돌아가기(manual → parametric): 관리선만 제거, 보존된 cap 파라미터로 재파생.
  function onSleeveCapRevert() {
    const project = designProjectNow();
    if (!project || !window.designSleeve) return;
    const d = project.working.sleeveDraft;
    if (!d || d.mode !== "manual") return;
    project.working.patternLines = (project.working.patternLines || []).filter(l => l.id !== d.capLineId);   // 관리선만 제거(다른 사용자 선 보존)
    deriveSleeve(project, d.parameters.lower, d.parameters.cap);   // 보존된 parametric cap 재파생(mode parametric)
    if (typeof render === "function") render();
    setSleeveNote("기본 소매산으로 복원됨 · 세션 전용");
    updateSleevePanel(project); updateSleeveEaseUI(project);
  }
  function syncSleeveButtons() {
    const project = designProjectNow(), gate = sleeveGateOk(project);
    const manual = sleeveManual(project), invalid = sleeveCapInvalid(project);
    const apply = document.getElementById("btnApplySleeve"), reset = document.getElementById("btnResetSleeve");
    const applyCap = document.getElementById("btnApplyCap");
    // capInvalid 동안 S1 적용 차단(어떤 cap 을 쓸지 모호). S2 cap 은 manual 이면 입력 잠금.
    if (apply) apply.disabled = !(gate && readSleeveInputs().valid && !invalid);
    if (reset) reset.disabled = !(gate && committedSleeve(project).has);
    if (applyCap) applyCap.disabled = !(gate && readCapInputs().valid && !manual);
    syncSleeveModeUI(project);   // 직접 수정/돌아가기 버튼·cap 입력 잠금 동기화
  }
  // 소매산 mode UI: manual 이면 cap 입력 잠금·기본 소매산으로 돌아가기 노출·직접 수정 숨김. capInvalid 안내.
  function syncSleeveModeUI(project) {
    const manual = sleeveManual(project), invalid = sleeveCapInvalid(project), gate = sleeveGateOk(project);
    ["inpSleeveBicep", "inpSleeveCapHeight"].forEach(id => { const el = document.getElementById(id); if (el) el.disabled = manual; });
    const bM = document.getElementById("btnSleeveCapManual"), bR = document.getElementById("btnSleeveCapRevert");
    if (bM) { bM.hidden = manual; bM.disabled = !(gate && committedSleeve(project).has && !manual); }
    if (bR) bR.hidden = !manual;
  }
  // S1 적용(하부): lower 갱신, 기존 cap 유지(cap null 이면 원형 cap).
  function onApplySleeve() {
    const project = designProjectNow();
    if (!project || !window.designSleeve) return;
    if (!sleeveGateOk(project)) { setSleeveNote("몸판 완료 후 소매를 편집할 수 있습니다"); return; }
    if (sleeveCapInvalid(project)) { setSleeveNote("소매산 편집이 무효입니다 · 복구 또는 기본 소매산으로 돌아간 뒤 적용"); return; }
    const st = readSleeveInputs();
    if (!st.valid) { setSleeveNote("소매길이 10–90 · 소매부리 완성둘레 8–60 범위를 확인하세요"); return; }
    // manual 이면 하부만 갱신하고 cap 은 관리선 재합성(deriveSleeve 로 parametric 회귀 방지).
    if (sleeveManual(project)) {
      const d = project.working.sleeveDraft;
      d.parameters.lower = { sleeveLengthCm: st.len.v, cuffCircumferenceCm: st.cuff.v, sideShape: st.side };
      recomposeSleeveCap();
      if (!sleeveCapInvalid(project)) setSleeveNote("소매길이 " + fmtL(st.len.v) + "cm · 소매부리 " + fmtL(st.cuff.v) + "cm · 소매산 직접 수정 유지 · 세션 전용");
      syncSleeveButtons(); return;
    }
    const c = committedSleeve(project);
    const r = deriveSleeve(project, { sleeveLengthCm: st.len.v, cuffCircumferenceCm: st.cuff.v, sideShape: st.side }, c.cap);
    if (!r.ok) { setSleeveNote(sleeveFailStr(r.reason)); return; }   // 이전 유지
    if (typeof render === "function") render();
    const warn = r.result.warnings.indexOf("narrow-cuff") >= 0 ? " · ⚠ 원형보다 좁음 · 트임/커프스 필요 가능" : "";
    setSleeveNote("소매길이 " + fmtL(st.len.v) + "cm · 소매부리 " + fmtL(st.cuff.v) + "cm(" + (st.side === "gentle" ? "완만 곡선" : "직선") + ")" + warn + " · 세션 전용");
    syncSleeveButtons(); updateSleeveEaseUI(project); updateSleeveCheckpointUI(project);
  }
  // S2 적용(소매산): 위팔 완성둘레 + 소매산 높이로 cap 변환. lower 는 기존(없으면 원형 기준값).
  //   실패(cap 붕괴·교차)하면 이전 소매 형상 유지. 출력 = 이세(사실값, 판정 없음).
  function onApplyCap() {
    const project = designProjectNow();
    if (!project || !window.designSleeve) return;
    if (!sleeveGateOk(project)) { setSleeveNote("몸판 완료 후 소매산을 편집할 수 있습니다"); return; }
    if (sleeveManual(project)) { setSleeveNote("직접 수정 중에는 소매산 수치를 잠급니다 · 기본 소매산으로 돌아가기 후 변경"); return; }
    const st = readCapInputs();
    if (!st.valid) { setSleeveNote("위팔 완성둘레 10–80 · 소매산 높이 3–30 범위를 확인하세요"); return; }
    const c = committedSleeve(project);
    const rv = refSleeveVals(project);
    const lower = c.lower || { sleeveLengthCm: rv.len, cuffCircumferenceCm: rv.cuff, sideShape: "straight" };
    const r = deriveSleeve(project, lower, { bicepCircumferenceCm: st.bicep.v, capHeightCm: st.capH.v });
    if (!r.ok) { setSleeveNote(sleeveFailStr(r.reason)); return; }   // 원자적: 이전 유지
    if (typeof render === "function") render();
    setSleeveNote("소매산: 위팔 " + fmtL(st.bicep.v) + "cm · 소매산 높이 " + fmtL(st.capH.v) + "cm · 세션 전용");
    syncSleeveButtons(); updateSleeveEaseUI(project); updateSleeveCheckpointUI(project);
  }
  function onResetSleeve() {
    const project = designProjectNow(); if (!project || !window.designSleeve) return;
    const rv = refSleeveVals(project); if (!rv) return;
    const setV = (id, v) => { const el = document.getElementById(id); if (el) el.value = fmtL(v); };
    setV("inpSleeveLength", rv.len); setV("inpSleeveCuff", rv.cuff); setV("inpSleeveBicep", rv.bicep); setV("inpSleeveCapHeight", rv.capH);
    const sideEl = document.getElementById("selSleeveSide"); if (sideEl) sideEl.value = "straight";
    project.working.sleeveDraft = null;   // 파생 제거 + working.geometry.sleeve 를 원형 clone
    project.working.geometry.sleeve = JSON.parse(JSON.stringify(project.referenceGeometry.sleeve));
    if (typeof render === "function") render();
    setSleeveNote("원형 소매로 복원됨 · 세션 전용");
    syncSleeveButtons(); updateSleeveEaseUI(project); updateSleeveCheckpointUI(project);
  }
  // refresh 훅: 소매 입력 복원(committed 있으면 그것, 없으면 원형 기준값) + 버튼 상태.
  function updateSleevePanel(project) {
    if (!project) return;
    const setIf = (id, v) => { const el = document.getElementById(id); if (el && document.activeElement !== el) el.value = fmtL(v); };
    const c = committedSleeve(project);
    const rv = refSleeveVals(project) || { len: 0, cuff: 0, bicep: 0, capH: 0 };
    const lw = c.has ? c.lower : null;
    setIf("inpSleeveLength", lw ? lw.sleeveLengthCm : rv.len); setIf("inpSleeveCuff", lw ? lw.cuffCircumferenceCm : rv.cuff);
    const sideEl = document.getElementById("selSleeveSide");
    if (sideEl && document.activeElement !== sideEl) sideEl.value = lw ? (lw.sideShape || "straight") : "straight";
    const cap = c.has ? c.cap : null;
    setIf("inpSleeveBicep", cap ? cap.bicepCircumferenceCm : rv.bicep); setIf("inpSleeveCapHeight", cap ? cap.capHeightCm : rv.capH);
    if (sleeveCapInvalid(project)) setSleeveNote("소매산 편집 무효 · " + capInvalidReasonStr(project.working.sleeveDraft.capInvalidReason) + " · 편집 복구 또는 기본 소매산으로 돌아가기");
    else if (sleeveManual(project)) setSleeveNote("소매산 직접 수정 중 · 진동밑 고정 · SP·핸들 편집");
    else if (!c.has) setSleeveNote(sleeveGateOk(project) ? "원형 소매 기준값 · 소매/소매산 적용으로 변형" : "몸판 완료 후 소매를 편집할 수 있습니다");
    else if (!cap) setSleeveNote("소매산은 원형 · 소매산 적용으로 위팔·높이 변형");
    syncSleeveButtons();
    syncSleeveModeUI(project);
    updateSleeveCheckpointUI(project);
  }

  // ── 소매 모양 완료 체크포인트(S5, sleeveCheckpoint) ──
  function sleeveCPFailStr(reason) {
    const m = { "no-bodice": "몸판 완료 필요", "bodice-stale": "몸판 변경됨 · 다시 완료 필요", "no-sleeve": "소매를 먼저 적용",
      "source-mismatch": "소매 출처가 몸판 완료본과 다름", "cap-invalid": "소매산 편집 무효", "manual-line-missing": "관리형 소매산 선 없음",
      "cap-unmeasured": "소매산 앞·뒤 분리 불가", "self-intersection": "소매 형상이 교차함", "ease-unmeasured": "이세 측정 불가", "no-project": "프로젝트 없음" };
    return m[reason] || reason;
  }
  function updateSleeveCheckpointUI(project) {
    const checkNote = document.getElementById("designSleeveCheckNote");
    const statusNote = document.getElementById("designSleeveStatusNote");
    const btn = document.getElementById("btnCompleteSleeve");
    if (!project || !window.sleeveCheckpoint) { if (btn) btn.disabled = true; if (checkNote) checkNote.textContent = ""; if (statusNote) statusNote.textContent = "소매 미완료 · 세션 전용"; return; }
    const c = window.sleeveCheckpoint.check(project);
    const sgn = v => (v >= 0 ? "+" : "") + fmtL(v);
    if (checkNote) {
      if (c.capLengths && c.ease) checkNote.textContent = "소매산 앞 " + fmtL(c.capLengths.front) + "·뒤 " + fmtL(c.capLengths.back) + "·총 " + fmtL(c.capLengths.total) + "cm · 이세 앞 " + sgn(c.ease.front) + "·뒤 " + sgn(c.ease.back) + "·총 " + sgn(c.ease.total) + "cm";
      else checkNote.textContent = c.fails.length ? "완료 전 검사: " + sleeveCPFailStr(c.fails[0]) : "";
    }
    if (btn) btn.disabled = !c.ok;
    const latest = window.sleeveCheckpoint.latest(project);
    if (statusNote) {
      if (!latest) statusNote.textContent = c.ok ? "완료 가능 · 세션 전용" : "완료 전 검사: " + sleeveCPFailStr(c.fails[0]);
      else if (window.sleeveCheckpoint.invalidatedByBodice(project)) statusNote.textContent = "몸판 변경으로 소매 무효 · 다시 완료 필요";
      else if (window.sleeveCheckpoint.isCurrentSleeveChanged(project)) statusNote.textContent = "소매 변경됨 · 다시 완료 필요 · 세션 전용";
      else statusNote.textContent = "소매 완료됨(원형 v" + (latest.sourceBlock.version != null ? latest.sourceBlock.version : "?") + ") · 세션 전용";
    }
    refreshCollarUI(project);   // 소매 완료/변경은 카라 탭 게이트에 영향 → 카라 UI 동기화(refresh 종점)
  }
  function onCompleteSleeve() {
    const project = designProjectNow();
    if (!project || !window.sleeveCheckpoint) return;
    const r = window.sleeveCheckpoint.complete(project);
    const statusNote = document.getElementById("designSleeveStatusNote");
    if (!r.ok) { if (statusNote) statusNote.textContent = "완료 불가: " + sleeveCPFailStr(r.reason); updateSleeveCheckpointUI(project); return; }
    updateSleeveCheckpointUI(project);
    if (statusNote) statusNote.textContent = "소매 완료됨(원형 v" + (r.result.sourceBlock.version != null ? r.result.sourceBlock.version : "?") + ") · 세션 전용";
  }

  // ── 카라 모양(C1: 2피스 셔츠 칼라의 칼라 스탠드) ── designCollar.computeStand(bodiceResult) →
  // working.collarDraft. 카라는 소매에 의존하지 않지만(sourceSleeveHash 없음), 작업 순서상 소매 완료·
  // 비스테일일 때만 편집 가능하다. 몸판 hash 변경 시 기존 geometry 를 숨기고 stale 표시(높이는 보존).
  function collarGateOk(project) {
    if (!sleeveGateOk(project)) return false;                 // 몸판 완료·비스테일
    const SC = window.sleeveCheckpoint; if (!SC) return false;
    if (!SC.latest(project)) return false;                    // 소매 완료본 존재
    if (SC.invalidatedByBodice(project)) return false;        // 몸판 변경으로 소매 무효
    if (SC.isCurrentSleeveChanged(project)) return false;     // 현재 소매 비스테일
    return true;
  }
  function syncCollarSubtabGate(project) {
    const btn = document.querySelector('.subtab[data-subtab-btn="collar"]'); if (!btn) return;
    const ok = collarGateOk(project);
    btn.disabled = !ok; btn.title = ok ? "" : "소매 완료 후 활성";
    if (!ok && currentDesignSubtab() === "collar") setDesignSubtab("body");
  }
  function collarBodiceHash(project) { const b = project && window.bodiceCheckpoint && window.bodiceCheckpoint.latest(project); return b ? b.hash : null; }
  function committedCollar(project) {
    const cd = project && project.working && project.working.collarDraft;
    const st = (cd && cd.parameters && cd.parameters.stand) ? cd.parameters.stand : null;
    return { has: !!cd, standHeightCm: st ? st.standHeightCm : null, frontRiseCm: st ? st.frontRiseCm : null,
      geom: !!(cd && cd.standGeometry), measure: cd ? cd.measure : null };
  }
  // 몸판 완료본 hash 가 collarDraft.sourceBodiceHash 와 다르면 stale(기존 geometry 숨김·높이 파라미터 보존).
  function collarStale(project) {
    const cd = project && project.working && project.working.collarDraft; if (!cd) return false;
    const h = collarBodiceHash(project); return !!(h && cd.sourceBodiceHash !== h);
  }
  // stale 이면 standGeometry=null(숨김) — parameters.stand 는 보존. 명시적 재적용으로만 복구.
  function refreshCollarStale(project) {
    const cd = project && project.working && project.working.collarDraft;
    if (cd && collarStale(project)) {
      // 몸판 hash 변경 → 관리형 선 제거·manual 폐기·스탠드/본체 숨김(소매 stale 과 분리 — 소매는 탭 게이트만).
      if (cd.body && cd.body.lineId) project.working.patternLines = (project.working.patternLines || []).filter(l => l.id !== cd.body.lineId);
      cd.standGeometry = null; cd.body = null;
    }
  }
  function deriveCollar(project, standHeightCm, frontRiseCm) {
    if (!window.designCollar || !window.bodiceCheckpoint) return { ok: false, reason: "no-module" };
    const bodice = window.bodiceCheckpoint.latest(project);
    const r = window.designCollar.computeStand(bodice, { standHeightCm: standHeightCm, frontRiseCm: frontRiseCm });
    if (!r.ok) return r;
    project.working.collarDraft = {
      sourceBodiceHash: bodice.hash,
      type: "shirt-two-piece",
      parameters: { stand: { standHeightCm: standHeightCm, frontRiseCm: frontRiseCm } },
      standGeometry: r.standGeometry,
      collarGeometry: null,   // (미사용 예약)
      body: null,             // C2 본체(스탠드 재적용 시 무효 → 명시적 재생성)
      // 5분리 길이(직선 스캐폴드 아님 — 곡률 반영). C2 는 upperTotal 을 직접 쓰지 않고 앞끝 여백을 별도 결정.
      measure: {
        lowerNeckSeamLenCm: r.lowerNeckSeamLenCm, lowerExtensionLenCm: r.lowerExtensionLenCm,
        upperNeckSegmentLenCm: r.upperNeckSegmentLenCm, upperExtensionLenCm: r.upperExtensionLenCm,
        upperTotalLenCm: r.upperTotalLenCm, backNeckLenCm: r.backNeckLenCm, frontNeckLenCm: r.frontNeckLenCm
      }
    };
    return { ok: true, result: r };
  }
  function setCollarNote(t) { const n = document.getElementById("designCollarNote"); if (n) n.textContent = t; }
  function collarFailStr(reason) {
    const m = { "no-bodice": "몸판 완료 필요", "no-neckline": "목둘레 측정 불가", "invalid-overlap": "여밈 값 확인",
      "invalid-stand-height": "스탠드 높이 값 확인(1–8)", "invalid-front-rise": "앞끝 올림 값 확인(0 이상·과대 금지)",
      "invalid-stand-offset": "앞끝 올림 대비 스탠드 높이 과대(윗선 붕괴)", "self-intersection": "스탠드 형상이 교차합니다 · 값을 조정하세요", "no-module": "" };
    return m[reason] || "카라를 적용할 수 없습니다";
  }
  function onApplyCollar() {
    const project = designProjectNow(); if (!project) return;
    if (!collarGateOk(project)) { setCollarNote("소매 완료 후 카라를 편집할 수 있습니다"); return; }
    const h = readNum("inpCollarStandHeight", 1, 8), fr = readNum("inpCollarFrontRise", 0, 6);
    if (!h.valid) { setCollarNote("스탠드 높이 범위를 확인하세요(1–8cm)"); return; }
    if (!fr.valid) { setCollarNote("앞끝 올림 범위를 확인하세요(0–6cm)"); return; }
    const r = deriveCollar(project, h.v, fr.v);
    if (!r.ok) { setCollarNote("적용 불가: " + collarFailStr(r.reason)); return; }   // 실패 시 이전 유지
    if (window.designLayout) window.designLayout.afterCollar();
    if (typeof render === "function") render();
    updateCollarPanel(project);
  }
  function onResetCollar() {
    const project = designProjectNow(); if (!project) return;
    project.working.collarDraft = null;
    if (window.designLayout) window.designLayout.afterCollar();
    if (typeof render === "function") render();
    updateCollarPanel(project);
  }
  // refresh 훅: 입력 복원(포커스 중 안 덮음) + 버튼/게이트 + committed 기준 note.
  function updateCollarPanel(project) {
    if (!project) return;
    const gate = collarGateOk(project), c = committedCollar(project);
    const setIf = (id, v) => { const el = document.getElementById(id); if (el && document.activeElement !== el) el.value = fmtL(v); };
    const ref = (window.designCollar && window.designCollar.referenceParams()) || { standHeightCm: 3, frontRiseCm: 1.5 };
    setIf("inpCollarStandHeight", (c.has && c.standHeightCm != null) ? c.standHeightCm : ref.standHeightCm);
    setIf("inpCollarFrontRise", (c.has && c.frontRiseCm != null) ? c.frontRiseCm : ref.frontRiseCm);
    const applyBtn = document.getElementById("btnApplyCollar"), resetBtn = document.getElementById("btnResetCollar");
    if (applyBtn) applyBtn.disabled = !gate;
    if (resetBtn) resetBtn.disabled = !c.has;
    if (!gate) setCollarNote("소매 완료 후 카라를 편집할 수 있습니다");
    else if (c.has && collarStale(project)) setCollarNote("몸판 변경됨 · 카라 다시 적용 필요(높이·앞끝올림 보존) · 세션 전용");
    // 윗선 목 구간(upperNeckSegmentLenCm)은 곡률 반영값 — C2 봉제 길이는 앞끝 여백과 함께 C2 에서 확정.
    else if (c.has && c.geom && c.measure) {
      const m = c.measure;
      setCollarNote("목둘레 봉제 " + fmtL(m.lowerNeckSeamLenCm) + "cm(뒤 " + fmtL(m.backNeckLenCm) + "·앞 " + fmtL(m.frontNeckLenCm) + ") · 여밈 연장 " + fmtL(m.lowerExtensionLenCm) + "cm · 윗선 목 " + fmtL(m.upperNeckSegmentLenCm) + "cm · 앞끝 올림 " + fmtL(c.frontRiseCm) + "cm · 세션 전용");
    }
    else setCollarNote("스탠드 높이·앞끝 올림 적용으로 카라 스탠드 생성 · 세션 전용");
    updateCollarBodyPanel(project);
  }
  function refreshCollarUI(project) { syncCollarSubtabGate(project); updateCollarPanel(project); }

  // ── C2 칼라 본체 ── 스탠드 윗선 primitive 를 부착선으로. 스탠드가 준비(비스테일)됐을 때만.
  //   스탠드 높이·앞끝 올림이 바뀌면(deriveCollar 가 collarDraft 재생성) body 는 자동 소멸 → 명시적 재생성.
  function collarStandReady(project) { const c = committedCollar(project); return !!(c.has && c.geom && !collarStale(project) && collarGateOk(project)); }
  function committedCollarBody(project) {
    const bd = project && project.working && project.working.collarDraft && project.working.collarDraft.body;
    return bd ? { has: true, params: bd.parameters, attachLenCm: bd.attachLenCm, measure: bd.measure } : { has: false, params: null, attachLenCm: null, measure: null };
  }
  function deriveCollarBody(project, bodyParams) {
    if (!window.designCollar || !window.bodiceCheckpoint) return { ok: false, reason: "no-module" };
    const cd = project.working.collarDraft; if (!cd) return { ok: false, reason: "invalid-stand" };
    // 스탠드 result 재생성(순수, upperNeckPath·anchors 확보) → 본체 파생.
    const stand = window.designCollar.computeStand(window.bodiceCheckpoint.latest(project), cd.parameters.stand);
    if (!stand.ok) return stand;
    const r = window.designCollar.computeBody(stand, bodyParams);
    if (!r.ok) return r;
    cd.body = { parameters: bodyParams, geometry: r.bodyGeometry, attachLenCm: r.attachLenCm, measure: r.measure };
    return { ok: true, result: r };
  }
  function setCollarBodyNote(t) { const n = document.getElementById("designCollarBodyNote"); if (n) n.textContent = t; }
  function collarBodyFailStr(reason) {
    const m = { "invalid-stand": "스탠드를 먼저 적용", "invalid-cb-width": "CB 칼라 폭 값 확인(1–15)", "invalid-front-width": "앞쪽 칼라 폭 값 확인(1–15)", "invalid-front-inset": "앞끝 물림 값 확인(0–3)", "invalid-front-projection": "칼라 앞끝 돌출 값 확인(0–15)", "invalid-outer-bow": "외곽 휨 값 확인(−2–2)", "self-intersection": "칼라 형상이 교차합니다 · 값을 조정하세요", "no-module": "" };
    return m[reason] || "칼라 본체를 적용할 수 없습니다";
  }
  function onApplyCollarBody() {
    const project = designProjectNow(); if (!project) return;
    if (!collarStandReady(project)) { setCollarBodyNote("카라 스탠드를 먼저 적용하세요"); return; }
    const w = readNum("inpCollarBodyWidth", 1, 15), fw = readNum("inpCollarBodyFrontWidth", 1, 15), inset = readNum("inpCollarBodyInset", 0, 3), proj = readNum("inpCollarBodyProjection", 0, 15), bow = readNum("inpCollarBodyBow", -2, 2);
    if (!w.valid || !fw.valid || !inset.valid || !proj.valid || !bow.valid) { setCollarBodyNote("칼라 본체 값 범위를 확인하세요(CB 폭·앞폭 1–15·물림 0–3·앞끝 돌출 0–15·외곽 휨 −2–2)"); return; }
    const r = deriveCollarBody(project, { cbWidthCm: w.v, frontWidthCm: fw.v, frontInsetCm: inset.v, frontProjectionCm: proj.v, outerBowCm: bow.v });
    if (!r.ok) { setCollarBodyNote("적용 불가: " + collarBodyFailStr(r.reason)); return; }   // 이전 유지
    if (window.designLayout) window.designLayout.afterCollar();
    if (typeof render === "function") render();
    updateCollarBodyPanel(project);
  }
  function onResetCollarBody() {
    const project = designProjectNow(); if (!project) return;
    if (project.working.collarDraft) project.working.collarDraft.body = null;
    if (window.designLayout) window.designLayout.afterCollar();
    if (typeof render === "function") render();
    updateCollarBodyPanel(project);
  }
  function updateCollarBodyPanel(project) {
    if (!project) return;
    const ready = collarStandReady(project), cb = committedCollarBody(project);
    const setIf = (id, v) => { const el = document.getElementById(id); if (el && document.activeElement !== el) el.value = fmtL(v); };
    const ref = (window.designCollar && window.designCollar.referenceBodyParams()) || { cbWidthCm: 6, frontWidthCm: 6, frontInsetCm: 0.3, frontProjectionCm: 4 };
    const p = cb.has ? cb.params : ref;
    setIf("inpCollarBodyWidth", p.cbWidthCm); setIf("inpCollarBodyFrontWidth", p.frontWidthCm != null ? p.frontWidthCm : p.cbWidthCm);
    setIf("inpCollarBodyInset", p.frontInsetCm); setIf("inpCollarBodyProjection", p.frontProjectionCm);
    setIf("inpCollarBodyBow", p.outerBowCm != null ? p.outerBowCm : 0);
    const applyBtn = document.getElementById("btnApplyCollarBody"), resetBtn = document.getElementById("btnResetCollarBody");
    if (applyBtn) applyBtn.disabled = !ready;
    if (resetBtn) resetBtn.disabled = !cb.has;
    if (!ready) setCollarBodyNote("카라 스탠드 적용 후 본체를 생성할 수 있습니다");
    else if (collarBodyManual(project)) {
      if (collarBodyInvalid(project)) setCollarBodyNote("칼라 본체 편집 무효 · " + collarBodyReasonStr(project.working.collarDraft.body.invalidReason) + " · 편집 복구 또는 기본형으로 돌아가기");
      else { const m = cb.measure || {}; setCollarBodyNote("칼라 본체 직접 수정 중 · endpoint 고정 · 외곽·포인트 anchor·핸들 편집 · 포인트 사선 " + fmtL(m.pointDiagonalLenCm || 0) + "cm · 외곽선 " + fmtL(m.outerEdgeLenCm || 0) + "cm"); }
    }
    // 읽기 전용 실제 결과: CB 폭·앞쪽 폭·앞끝 접선 돌출·포인트 사선 길이(=앞폭·투영 합성)·앞끝 기울기.
    //   ★ 기울기는 부착선 로컬 접선 기준 평면 기하값(캔버스 축·착용 spread 아님). frontRise 와 무관.
    else if (cb.has && cb.measure && cb.measure.cbWidthCm != null) { const m = cb.measure;
      setCollarBodyNote("부착 " + fmtL(cb.attachLenCm) + "cm · CB 폭 " + fmtL(m.cbWidthCm) + "·앞폭 " + fmtL(m.frontWidthCm) + " · 앞끝 돌출 " + fmtL(m.frontProjectionCm) + "cm · 포인트 사선 " + fmtL(m.pointDiagonalLenCm) + "cm · 앞끝 기울기(부착 접선) " + m.localTiltDeg.toFixed(1) + "° · 외곽 휨 " + fmtL(m.outerBowCm) + "cm(외곽선 " + fmtL(m.outerEdgeLenCm) + "cm) · 세션 전용");
    }
    else setCollarBodyNote("CB 폭·앞폭·앞끝 물림·앞끝 돌출·외곽 휨 적용으로 본체 생성(여밈 연장 미포함) · 세션 전용");
    syncCollarBodyModeUI(project);
  }

  // ── C3 칼라 본체 직접 편집(관리형 선, 소매산 manual 미러) ──
  function collarBodyManual(project) { const cd = project && project.working && project.working.collarDraft; return !!(cd && cd.body && cd.body.mode === "manual"); }
  function collarBodyInvalid(project) { const cd = project && project.working && project.working.collarDraft; return !!(cd && cd.body && cd.body.invalid); }
  function collarBodyReasonStr(reason) {
    const m = { "endpoint-cbouter": "CB 외곽점이 고정 위치를 벗어남", "endpoint-attachfront": "앞 부착점이 고정 위치를 벗어남", "not-closed": "외곽선 연결이 끊김", "self-intersection": "형상이 교차/부착선 침범", "degenerate-area": "형상이 퇴화됨", "no-line": "관리선 없음", "no-attach": "부착선 없음" };
    return m[reason] || reason;
  }
  // 파라미터 본체 → 관리형 선(collar-body) 변환. 스탠드+본체 파라미터 입력 잠금(부착선 고정).
  function onCollarBodyManual() {
    const project = designProjectNow(); if (!project || !window.designCollar || !window.designLineTool) return;
    if (!collarStandReady(project)) { setCollarBodyNote("카라 스탠드 적용 후 직접 수정할 수 있습니다"); return; }
    const cd = project.working.collarDraft;
    if (!cd.body || !cd.body.geometry) { setCollarBodyNote("먼저 본체를 적용한 뒤 직접 수정할 수 있습니다"); return; }
    if (cd.body.mode === "manual") return;
    const lc = window.designCollar.collarBodyLineFromGeometry(cd.body.geometry);
    if (!lc) { setCollarBodyNote("본체를 관리선으로 변환할 수 없습니다"); return; }
    const ls = project.working.patternLines || (project.working.patternLines = []);
    const id = window.designLineTool.nextId(ls);
    ls.push({ id: id, piece: "collar", role: "boundary", managedBy: "collar-body", segments: lc.segments });
    cd.body.mode = "manual"; cd.body.lineId = id; cd.body.invalid = false; cd.body.invalidReason = null; cd.body.manualLocked = lc.locked;
    if (typeof render === "function") render();
    updateCollarBodyPanel(project);
  }
  // 기본형으로 돌아가기(manual → parametric): 관리선만 제거(다른 선 보존), 보존 파라미터로 재파생.
  function onCollarBodyRevert() {
    const project = designProjectNow(); if (!project) return;
    const cd = project.working.collarDraft; if (!cd || !cd.body || cd.body.mode !== "manual") return;
    project.working.patternLines = (project.working.patternLines || []).filter(l => l.id !== cd.body.lineId);   // 관리선만 제거
    const r = deriveCollarBody(project, cd.body.parameters);   // 보존 파라미터로 parametric 재생성(mode 없음=parametric)
    if (typeof render === "function") render();
    updateCollarBodyPanel(project);
    setCollarBodyNote(r.ok ? "기본형으로 복원됨 · 세션 전용" : "복원 실패: " + collarBodyFailStr(r.reason));
  }
  // designLineTool 관리선 편집 pointerup 이 호출: 검증→갱신/무효(마지막 유효 geometry 유지).
  function recomposeCollarBody() {
    const project = designProjectNow(); if (!project || !window.designCollar) return;
    const cd = project.working.collarDraft; if (!cd || !cd.body || cd.body.mode !== "manual") return;
    const line = (project.working.patternLines || []).find(l => l.id === cd.body.lineId);
    if (!line) { cd.body.invalid = true; cd.body.invalidReason = "no-line"; updateCollarBodyPanel(project); return; }
    const r = window.designCollar.computeFromBodyLine(line.segments, cd.body.manualLocked);
    if (!r.ok) { cd.body.invalid = true; cd.body.invalidReason = r.reason; }   // 무효: 마지막 유효 geometry 유지
    else { cd.body.invalid = false; cd.body.invalidReason = null; cd.body.geometry = r.bodyGeometry; cd.body.attachLenCm = r.attachLenCm; cd.body.measure = r.measure; }
    updateCollarBodyPanel(project);
  }
  // manual 이면 스탠드·본체 파라미터 입력 잠금 + 기본형으로 돌아가기 노출·직접 수정 숨김.
  function syncCollarBodyModeUI(project) {
    const manual = collarBodyManual(project), ready = collarStandReady(project), hasBody = committedCollarBody(project).has;
    const manualBtn = document.getElementById("btnCollarBodyManual"), revertBtn = document.getElementById("btnCollarBodyRevert");
    if (manualBtn) { manualBtn.hidden = manual; manualBtn.disabled = !(ready && hasBody && !manual); }
    if (revertBtn) revertBtn.hidden = !manual;
    // 입력은 manual 이면 잠금·아니면 해제(다른 disable 조건 없음). 부착선이 스탠드에 고정되므로 스탠드 입력도 잠금.
    ["inpCollarStandHeight", "inpCollarFrontRise", "inpCollarBodyWidth", "inpCollarBodyFrontWidth", "inpCollarBodyInset", "inpCollarBodyProjection", "inpCollarBodyBow"]
      .forEach(id => { const el = document.getElementById(id); if (el) el.disabled = manual; });
    // 적용/초기화 버튼은 기존 gate/ready 상태 위에 manual 잠금을 얹는다(manual 이면 무조건 disabled).
    if (manual) ["btnApplyCollar", "btnResetCollar", "btnApplyCollarBody", "btnResetCollarBody"].forEach(id => { const el = document.getElementById(id); if (el) el.disabled = true; });
  }

  // refresh 훅: design 진입/재진입 시 committed 값을 표시(포커스 중 입력은 안 덮음) + 버튼 상태 +
  // committed 기준 note. 성공/오류 문구는 onApply/onReset 이 직접 관리(refresh 미호출).
  function updateDesignBodyPanel() {
    const project = designProjectNow();
    if (!project) { syncBodyButtons(); return; }
    const cb = committedBody(project);
    const setIf = (id, v) => { const el = document.getElementById(id); if (el && document.activeElement !== el) el.value = fmtL(v); };
    setIf("inpBodyBustEase", cb.E); setIf("inpBodyHemExtension", cb.L);
    setIf("inpBodyWaistOffset", cb.W); setIf("inpBodyHemOffset", cb.H); setIf("inpBodySideCurve", cb.Cv);
    // 네크라인 형태(카드)·입력 복원(포커스 중 안 덮음)
    const cn = committedNeckline(project);
    setNeckType(cn.type);
    setIf("inpNeckWidth", cn.W); setIf("inpNeckFrontDepth", cn.F); setIf("inpNeckBackDepth", cn.B);
    setIf("inpNeckCurveAmount", cn.CA); setIf("inpNeckVDepth", cn.VD);
    setIf("inpNeckSquareWidth", cn.SW); setIf("inpNeckCornerRadius", cn.CR);
    setBodyNote(bodyStatusNote(cb.E, cb.L, cb.W, cb.H, cb.Cv, cn.type));
    sideLenNote(project); neckLenNote(project);
    syncBodyButtons();
    syncNecklineModeUI(project);
    // 앞중심 여밈 입력·상태 복원(포커스 중 안 덮음)
    const cp = committedPlacket(project);
    setIf("inpPlacketOverlap", cp.overlap); setIf("inpPlacketFacing", cp.facing);
    setPlacketNote(cp.has ? "여밈 " + fmtL(cp.overlap) + "cm · 안단 " + fmtL(cp.facing) + "cm(컷온) · 세션 전용" : "");
    syncPlacketButtons();
    updateBodiceCheckpointUI(project);
  }
  // 원자적 적용: 검증 → referenceGeometry 에서 재계산(여유량·길이·옆선 실루엣) → 성공 후에만
  // parameters·geometry 동시 갱신 → render(). 실패 시 커밋·화면 변화 0, note 에만 사유 표시.
  function onApplyBodyLength() {
    const project = designProjectNow();
    if (!project || !window.designBodice) return;
    const st = readBodyInputs();
    if (!st.valid) { setBodyNote("입력값 범위를 확인하세요(여유량·길이 0–100, 옆선 −30–30)"); syncBodyButtons(); return; }
    const E = st.ease.v, L = st.len.v, W = st.waist.v, H = st.hem.v, Cv = st.curve.v;
    const nextParameters = structuredClone(project.working.parameters);
    nextParameters.body = Object.assign({}, nextParameters.body || {}, { bustEaseCm: E, hemExtensionBelowWaistCm: L, waistSideOffsetCm: W, hemSideOffsetCm: H, sideSeamCurve: Cv });
    // 네크라인: manual(세부 수정) 이면 기존 manual 네크라인 보존(입력 잠금 — 인풋에서 재구성하지
    // 않는다). parametric 이면 카드·입력에서 재구성. manual 은 아래에서 designOutline 재합성.
    const committedNk = committedNeckline(project);
    const manualNeck = committedNk.mode === "manual";
    if (manualNeck) nextParameters.neckline = structuredClone(project.working.parameters.neckline);
    else nextParameters.neckline = { mode: "parametric", type: st.neckType, parameters: {
      neckWidthCm: st.nW.v, frontDepthCm: st.nF.v, backDepthCm: st.nB.v,
      curveAmountNorm: st.nCA.v, vPointDepthCm: st.nVD.v, squareWidthCm: st.nSW.v, cornerRadiusCm: st.nCR.v
    } };
    let nextGeometry = null, reason = null;
    try { nextGeometry = window.designBodice.computeGeometry(project.referenceGeometry, nextParameters); }
    catch (e) { reason = (e && e.reason) || "compute-failed"; }
    if (reason) { setBodyNote(noteForReason(reason)); syncBodyButtons(); return; }  // 불변
    // ── 유일한 commit 지점 ──
    project.working.parameters = nextParameters;
    project.working.geometry = nextGeometry;
    // 몸판 형상 변경: auto 면 소매 재배치+fit, manual 이면 카메라·offset 유지(자동 이동 안 함).
    if (window.designLayout) window.designLayout.afterBodyLength();
    // geometry 재계산됨. manual 네크라인이면 boundary 를 새 geometry 로 재합성(designOutline 유지),
    // 아니면 기존대로 파생 무효화 + 절개선 재검사.
    if (window.designLineTool) {
      if (manualNeck && window.designLineTool.recomposeDesignOutline) window.designLineTool.recomposeDesignOutline();
      else if (window.designLineTool.revalidate) window.designLineTool.revalidate();
    }
    refreshFrontPlacket(project);   // 유효 앞판 외곽 변경 → 여밈 재파생(있을 때만)
    refreshSleeve(project);         // body apply 가 working.geometry.sleeve 를 블록으로 덮음 → 파생 소매 재적용
    if (typeof render === "function") render();
    const setBack = (st2, v) => { if (st2.input && document.activeElement !== st2.input) st2.input.value = fmtL(v); };
    setBack(st.ease, E); setBack(st.len, L); setBack(st.waist, W); setBack(st.hem, H); setBack(st.curve, Cv);
    setBack(st.nW, st.nW.v); setBack(st.nF, st.nF.v); setBack(st.nB, st.nB.v);
    setBack(st.nCA, st.nCA.v); setBack(st.nVD, st.nVD.v); setBack(st.nSW, st.nSW.v); setBack(st.nCR, st.nCR.v);
    const necked = st.neckType !== "original";
    setBodyNote((E === 0 && L === 0 && W === 0 && H === 0 && Cv === 0 && !necked) ? "원형으로 복원됨 · 세션 전용" : bodyStatusNote(E, L, W, H, Cv, st.neckType));
    sideLenNote(project); neckLenNote(project);
    syncBodyButtons();
    syncNecklineModeUI(project);
    updateBodiceCheckpointUI(project);   // 몸판 변경 → 검사 요약·완료 상태(변경됨) 갱신
  }
  function onResetBodyLength() {
    ["inpBodyBustEase", "inpBodyHemExtension", "inpBodyWaistOffset", "inpBodyHemOffset", "inpBodySideCurve",
      "inpNeckWidth", "inpNeckFrontDepth", "inpNeckBackDepth", "inpNeckCurveAmount", "inpNeckVDepth", "inpNeckSquareWidth", "inpNeckCornerRadius"]
      .forEach(id => { const el = document.getElementById(id); if (el) el.value = "0"; });
    setNeckType("original");
    onApplyBodyLength();   // 전부 0 · 원형 유지 적용(원형 복원)
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
    // DB1b 몸판 디자인(inline handler 없음 — addEventListener 로만 연결).
    const applyBody = document.getElementById("btnApplyBodyLength");
    if (applyBody) applyBody.addEventListener("click", () => { if (!applyBody.disabled) onApplyBodyLength(); });
    const resetBody = document.getElementById("btnResetBodyLength");
    if (resetBody) resetBody.addEventListener("click", () => { if (!resetBody.disabled) onResetBodyLength(); });
    // 몸판 입력 넷 모두(여유량·길이·허리/밑단 옆선): 입력 중엔 버튼 활성만 갱신, Enter 로 적용.
    ["inpBodyBustEase", "inpBodyHemExtension", "inpBodyWaistOffset", "inpBodyHemOffset", "inpBodySideCurve",
      "inpNeckWidth", "inpNeckFrontDepth", "inpNeckBackDepth", "inpNeckCurveAmount", "inpNeckVDepth", "inpNeckSquareWidth", "inpNeckCornerRadius"].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("input", syncBodyButtons);
      el.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); onApplyBodyLength(); } });
    });
    // 네크라인 기본형 카드: 클릭 = 형태 선택(+형태별 입력 행 표시). 값은 적용 버튼에서 커밋.
    const neckCards = document.getElementById("necklineCards");
    if (neckCards) neckCards.querySelectorAll(".neck-card").forEach(c =>
      c.addEventListener("click", () => { if (c.disabled) return; setNeckType(c.getAttribute("data-neck")); syncBodyButtons(); }));
    // 세부 수정(→manual boundary 변환) · 기본형으로 돌아가기(→parametric 복귀).
    const neckManual = document.getElementById("btnNeckManual");
    if (neckManual) neckManual.addEventListener("click", () => { if (!neckManual.disabled) onNeckManual(); });
    const neckRevert = document.getElementById("btnNeckRevert");
    if (neckRevert) neckRevert.addEventListener("click", () => { if (!neckRevert.hidden) onNeckRevert(); });
    // 앞중심 여밈: 입력 중엔 버튼 활성만 갱신·Enter 로 적용, 적용/제거 버튼.
    ["inpPlacketOverlap", "inpPlacketFacing"].forEach(id => {
      const el = document.getElementById(id); if (!el) return;
      el.addEventListener("input", syncPlacketButtons);
      el.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); onApplyPlacket(); } });
    });
    const applyPk = document.getElementById("btnApplyPlacket");
    if (applyPk) applyPk.addEventListener("click", () => { if (!applyPk.disabled) onApplyPlacket(); });
    const clearPk = document.getElementById("btnClearPlacket");
    if (clearPk) clearPk.addEventListener("click", () => { if (!clearPk.disabled) onClearPlacket(); });
    // 몸판 모양 완료(bodiceCheckpoint): 검사 통과 시에만 활성(updateBodiceCheckpointUI 가 disabled 관리).
    const completeBodice = document.getElementById("btnCompleteBodice");
    if (completeBodice) completeBodice.addEventListener("click", () => { if (!completeBodice.disabled) onCompleteBodice(); });
    // 몸판/소매 서브탭: 클릭 = 전환(disabled 소매 탭은 무시). 게이트는 updateBodiceCheckpointUI 가 관리.
    const subtabs = document.getElementById("designSubtabs");
    if (subtabs) subtabs.querySelectorAll(".subtab").forEach(b =>
      b.addEventListener("click", () => { if (!b.disabled) setDesignSubtab(b.getAttribute("data-subtab-btn")); }));
    // 소매 모양(S1): 입력 중엔 버튼 활성만 갱신·Enter 로 적용, 적용/원형복원 버튼.
    ["inpSleeveLength", "inpSleeveCuff"].forEach(id => {
      const el = document.getElementById(id); if (!el) return;
      el.addEventListener("input", syncSleeveButtons);
      el.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); onApplySleeve(); } });
    });
    const selSide = document.getElementById("selSleeveSide");
    if (selSide) selSide.addEventListener("change", syncSleeveButtons);
    const applySleeve = document.getElementById("btnApplySleeve");
    if (applySleeve) applySleeve.addEventListener("click", () => { if (!applySleeve.disabled) onApplySleeve(); });
    const resetSleeve = document.getElementById("btnResetSleeve");
    if (resetSleeve) resetSleeve.addEventListener("click", () => { if (!resetSleeve.disabled) onResetSleeve(); });
    // 소매산(S2): 위팔 완성둘레 + 소매산 높이 → cap 변환, Enter 로 적용.
    ["inpSleeveBicep", "inpSleeveCapHeight"].forEach(id => {
      const el = document.getElementById(id); if (!el) return;
      el.addEventListener("input", syncSleeveButtons);
      el.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); onApplyCap(); } });
    });
    const applyCap = document.getElementById("btnApplyCap");
    if (applyCap) applyCap.addEventListener("click", () => { if (!applyCap.disabled) onApplyCap(); });
    // 소매산 직접 수정(S3): parametric→manual 변환 / 기본 소매산으로 돌아가기.
    const capManual = document.getElementById("btnSleeveCapManual");
    if (capManual) capManual.addEventListener("click", () => { if (!capManual.disabled) onSleeveCapManual(); });
    const capRevert = document.getElementById("btnSleeveCapRevert");
    if (capRevert) capRevert.addEventListener("click", () => { if (!capRevert.hidden) onSleeveCapRevert(); });
    // 소매 모양 완료(S5): 게이트 통과 시에만 활성(updateSleeveCheckpointUI 가 disabled 관리).
    const completeSleeve = document.getElementById("btnCompleteSleeve");
    if (completeSleeve) completeSleeve.addEventListener("click", () => { if (!completeSleeve.disabled) onCompleteSleeve(); });
    // 카라 모양(C1): 스탠드 높이·앞끝 올림 Enter 로 적용, 카라 적용/초기화 버튼.
    ["inpCollarStandHeight", "inpCollarFrontRise"].forEach(id => {
      const el = document.getElementById(id); if (!el) return;
      el.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); onApplyCollar(); } });
    });
    const applyCollar = document.getElementById("btnApplyCollar");
    if (applyCollar) applyCollar.addEventListener("click", () => { if (!applyCollar.disabled) onApplyCollar(); });
    const resetCollar = document.getElementById("btnResetCollar");
    if (resetCollar) resetCollar.addEventListener("click", () => { if (!resetCollar.disabled) onResetCollar(); });
    // 카라 본체(C2): CB 폭·앞폭·앞끝 물림·앞끝 돌출·외곽 휨 Enter 로 적용, 본체 적용/초기화.
    ["inpCollarBodyWidth", "inpCollarBodyFrontWidth", "inpCollarBodyInset", "inpCollarBodyProjection", "inpCollarBodyBow"].forEach(id => {
      const el = document.getElementById(id); if (!el) return;
      el.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); onApplyCollarBody(); } });
    });
    const applyCollarBody = document.getElementById("btnApplyCollarBody");
    if (applyCollarBody) applyCollarBody.addEventListener("click", () => { if (!applyCollarBody.disabled) onApplyCollarBody(); });
    const resetCollarBody = document.getElementById("btnResetCollarBody");
    if (resetCollarBody) resetCollarBody.addEventListener("click", () => { if (!resetCollarBody.disabled) onResetCollarBody(); });
    // 카라 본체 직접 편집(C3): parametric→manual 변환 / 기본형으로 돌아가기.
    const collarBodyManualBtn = document.getElementById("btnCollarBodyManual");
    if (collarBodyManualBtn) collarBodyManualBtn.addEventListener("click", () => { if (!collarBodyManualBtn.disabled) onCollarBodyManual(); });
    const collarBodyRevertBtn = document.getElementById("btnCollarBodyRevert");
    if (collarBodyRevertBtn) collarBodyRevertBtn.addEventListener("click", () => { if (!collarBodyRevertBtn.hidden) onCollarBodyRevert(); });
    // 배치 버튼(designLayout 위임 — 형상 불변, 카메라/offset 만). inline handler 없음.
    const layoutBtn = (id, fn) => { const b = document.getElementById(id); if (b) b.addEventListener("click", () => { if (window.designLayout) window.designLayout[fn](); }); };
    layoutBtn("btnLayoutCenterBody", "centerBody");
    layoutBtn("btnLayoutSleeveRight", "placeSleeveRight");
    layoutBtn("btnLayoutReset", "resetLayout");
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
  window.refreshDesignBodyPanel = updateDesignBodyPanel;  // designLineTool 이 boundary 편집 후 목둘레·상태 갱신
  window.refreshFrontPlacket = () => refreshFrontPlacket();  // boundary 편집으로 유효 외곽 변경 시 여밈 재파생
  window.recomposeSleeveCap = recomposeSleeveCap;            // designLineTool 이 관리형 소매산 편집 후 소매 재합성
  window.recomposeCollarBody = recomposeCollarBody;          // designLineTool 이 관리형 칼라 본체 편집 후 본체 재합성
})();
