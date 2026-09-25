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
    // Design 통합 상태는 서브탭 활성 여부와 무관하게(hidden 이어도) 현재 project 로 항상 갱신 —
    // 경로 의존적 stale 방지(designProjectNow() 가 null 이면 자체 가드로 "Design 미완료").
    updateDesignResultUI(designProjectNow());
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
      if (note) note.textContent = reason === "stale-schema-version" ? "원형 완료본이 이전 형식입니다 · 원형을 다시 완료하세요" : "디자인을 시작할 수 없습니다 · 다시 시도하세요";
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
  // 구조 모서리(SV2). SV3 봉제 의미(neckline/shoulder/armhole)가 붙어도 아래 fallback 이
  // 기존과 같은 세그먼트를 고르도록 이 집합만 배제한다(측정 경로 교체 아님).
  const STRUCT_EDGE = { center: 1, waist: 1, "side-seam": 1, hem: 1 };
  // 한 piece 의 네크라인 호 길이: center 목점(top=FNP/BNP)에 닿는 비구조 outline seg.
  function necklineLen(geometry, piece) {
    const b = geometry && geometry[piece]; if (!b || !Array.isArray(b.outline)) return 0;
    // parametric 결과: computeGeometry 가 designBodice.measureNeckline 으로 측정해 실은 piece 스칼라
    // (다세그먼트 스퀘어 포함, primitive 표식 없음). 없으면(원본/미적용) center 목점 단일 seg 추적.
    if (typeof b.necklineLenCm === "number") return b.necklineLenCm;
    const center = b.outline.find(pr => pr.edge === "center"); if (!center) return 0;
    const ce = primEnds(center); const FNP = ce[0].y < ce[1].y ? ce[0] : ce[1];
    const near = (a, c) => Math.hypot(a.x - c.x, a.y - c.y) < 0.02;
    const seg = b.outline.find(pr => !STRUCT_EDGE[pr.edge] && (() => { const e = primEnds(pr); return near(e[0], FNP) || near(e[1], FNP); })());
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
      // 곡선 정도 행을 처음 표시할 때 비어 있으면 형태 기본값 채움(빈 값=0=평평 방지). round/boat/shirt 공용.
      if (show && r.getAttribute("data-neck-for").indexOf("round") >= 0) {
        const inp = document.getElementById("inpNeckCurveAmount");
        if (inp && String(inp.value).trim() === "") inp.value = fmtL(type === "boat" ? 0.5 : 1);
      }
    });
  }
  // 앞·뒤 옆선 봉제 길이 + 차이(정합 검증) 문구. 차이 > 1cm 이면 주의.
  function sideLenNote(project) {
    const g = project && project.working && project.working.geometry;
    const el = document.getElementById("designSideLenNote"); if (!el) return;
    if (!g || !window.bodiceCheckpoint) { el.textContent = ""; el.removeAttribute("data-ok"); return; }
    // 몸판 체크포인트와 같은 측정(유효 외곽의 명시 side-seam). 측정 불가를 0cm 로 보이지 않는다.
    const ss = window.bodiceCheckpoint.check(project).sideSeam;
    if (ss.status === "unmeasured") {
      el.textContent = "앞옆선 " + (ss.front == null ? "측정 불가" : fmtL(ss.front) + "cm") + " · 뒤옆선 " + (ss.back == null ? "측정 불가" : fmtL(ss.back) + "cm");
      el.setAttribute("data-ok", "0"); return;
    }
    el.textContent = "앞옆선 " + fmtL(ss.front) + "cm · 뒤옆선 " + fmtL(ss.back) + "cm · 차이 " + fmtL(ss.diff) + "cm";
    el.setAttribute("data-ok", ss.diff <= 1 ? "1" : "0");
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
    const NECK_LABEL = { shirt: "셔츠 목선", "stand-f": "스탠드 F 목선", round: "라운드넥", v: "V넥", square: "스퀘어넥", boat: "보트넥" };
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
  function bodiceStatusStr(s) { return s === "match" ? "정합" : s === "check" ? "확인" : s === "unmeasured" ? "측정 불가" : "불일치"; }
  function bodiceFailStr(reason) {
    const m = {
      "front-outline-not-connected": "앞판 외곽이 연결되지 않음", "back-outline-not-connected": "뒤판 외곽이 연결되지 않음",
      "side-seam-mismatch": "옆선 봉제 길이 불일치(>0.3cm)", "side-seam-unmeasured": "옆선 측정 불가(유효 외곽에 명시 옆선 없음)",
      "side-waist-dart-missing": "옆허리 다트 c 반쪽 누락", "side-waist-dart-duplicate": "옆허리 다트 c 반쪽 중복", "side-waist-dart-shared": "옆허리 다트 c 가 공용으로 놓임",
      "side-waist-dart-unlocked": "옆허리 다트 c 고정 해제됨", "side-waist-dart-legs": "옆허리 다트 c 다리 수 오류", "side-waist-dart-attachment": "옆허리 다트 c 허리 부착 불일치",
      "side-waist-dart-intake": "옆허리 다트 c 분량 측정 불가", "side-waist-dart-total": "옆허리 다트 c 총량 불일치", "front-armhole-unmeasured": "앞 진동둘레 측정 불가",
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
    if (checkNote) checkNote.textContent = (c.sideSeam.status === "unmeasured" ? "옆선 측정 불가" : "옆선 차 " + fmtL(c.sideSeam.diff) + "cm(" + bodiceStatusStr(c.sideSeam.status) + ")") + " · 진동 앞 " + fmtL(c.armhole.front) + "·뒤 " + fmtL(c.armhole.back) + "cm · 반패턴 목둘레 " + fmtL(c.neckline.half) + "cm";
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
    updateDesignResultUI(project); // 몸판 완료/재완료는 Design 통합 게이트에 영향(소매·카라는 각 체크포인트 체인이 이미 갱신)
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
    if (!ok && currentDesignSubtab() === "collar") { setDesignSubtab("body"); if (typeof render === "function") render(); }
  }
  // ── 카라 종류(생성 구조) ── family 3 M = 밴드+위칼라 2피스 / family 2 G = 한 장.
  //   M 전용 '밴드·본체' 입력·버튼·문구를 한 장 칼라에 재사용하지 않는다(행은 data-collar-kind 로 분리).
  const COLLAR_KIND_BY_TYPE = { "shirt-one-piece": "one-piece", "shirt-open-collar": "open", "shirt-wing-collar": "wing", "shirt-band-one-piece": "band-one-piece", "flat-collar": "flat", "flat-collar-overlap": "flat", "sailor-collar": "sailor", "bow-collar": "bow", "frill-collar": "frill", "hood": "hood", "tailored-collar": "tailored", "stand-collar": "standalone", "shirt-two-piece": "two-piece" };
  function draftCollarKind(project) {
    const cd = project && project.working && project.working.collarDraft;
    return cd ? (COLLAR_KIND_BY_TYPE[cd.type] || "two-piece") : null;
  }
  function selectedCollarKind() {
    const r = resolveCollarSelection();
    if (!r.ok) return null;
    const rec = window.collarPresets.get(r.presetId);
    return rec ? (COLLAR_KIND_BY_TYPE[rec.type] || "two-piece") : null;
  }
  // 표시 종류는 **선택을 우선**한다(선택이 해석되면 그 종류의 행만 보인다) — 적용 버튼이 만드는 형상과 화면 행이
  //   어긋나지 않도록. 선택이 미구현·불명이면 현재 초안의 종류로 떨어진다.
  function activeCollarKind(project) { return selectedCollarKind() || draftCollarKind(project) || "two-piece"; }
  function isOnePieceCollar(project) { return activeCollarKind(project) === "one-piece"; }
  function isStandaloneCollar(project) { return activeCollarKind(project) === "standalone"; }
  function isOpenCollar(project) { return activeCollarKind(project) === "open"; }
  function isWingCollar(project) { return activeCollarKind(project) === "wing"; }
  function isBandOnePieceCollar(project) { return activeCollarKind(project) === "band-one-piece"; }
  function isFlatCollar(project) { return activeCollarKind(project) === "flat"; }
  function isSailorCollar(project) { return activeCollarKind(project) === "sailor"; }
  function isBowCollar(project) { return activeCollarKind(project) === "bow"; }
  function isFrillCollar(project) { return activeCollarKind(project) === "frill"; }
  function isHoodCollar(project) { return activeCollarKind(project) === "hood"; }
  function isTailoredCollar(project) { return activeCollarKind(project) === "tailored"; }
  function isTwoPieceCollar(project) { return activeCollarKind(project) === "two-piece"; }
  function syncCollarKindRows(project) {
    const kind = activeCollarKind(project);
    document.querySelectorAll("[data-collar-kind]").forEach(el => { el.hidden = el.getAttribute("data-collar-kind") !== kind; });
  }
  function collarBodiceHash(project) { const b = project && window.bodiceCheckpoint && window.bodiceCheckpoint.latest(project); return b ? b.hash : null; }
  function committedCollar(project) {
    const cd = project && project.working && project.working.collarDraft;
    const st = (cd && cd.parameters && cd.parameters.stand) ? cd.parameters.stand : null;
    return { has: !!cd, presetId: (cd && cd.presetId) || null,
      bandWidthCm: st ? st.bandWidthCm : null, frontRiseCm: st ? st.frontRiseCm : null, frontEndCm: st ? st.frontEndCm : null,
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
      cd.standGeometry = null; cd.body = null; cd.standalone = null; cd.tip = null; cd.joined = null; cd.flat = null; cd.sailor = null; cd.bow = null; cd.frill = null; cd.hood = null; cd.tailored = null;   // 파생 카라 형상을 한 벌로 숨김
    }
  }
  // ── 카라 종류·세부 제도 선택(collarPresets catalog + registry) ──
  //   선택값 = 두 select DOM(세션 UI 상태, 저장·hash 입력 아님), 편집값 = collarDraft.parameters.
  //   presetId/baseMethod/type 은 출처 메타(hash 미포함). 옵션·기본값·버튼 문구는 전부 catalog/registry 파생.
  //   ★ 미구현 family/variant 는 resolve() 가 거부한다 — **M 으로 fallback 하지 않는다**(적용 자체가 불가).
  function selectedCollarFamilyId() {
    const sel = document.getElementById("selCollarFamily");
    return (sel && sel.value) || (window.collarPresets ? window.collarPresets.DEFAULT_FAMILY_ID : null);
  }
  function selectedCollarVariantId() { const sel = document.getElementById("selCollarPreset"); return sel ? sel.value : ""; }
  function resolveCollarSelection() {
    if (!window.collarPresets) return { ok: false, reason: "no-module" };
    return window.collarPresets.resolve(selectedCollarFamilyId(), selectedCollarVariantId());
  }
  function selectedCollarPreset() {
    const r = resolveCollarSelection();
    return r.ok ? window.collarPresets.get(r.presetId) : null;
  }
  function collarPresetDefaults() {
    const r = resolveCollarSelection();
    return r.ok ? window.collarPresets.defaults(r.presetId) : { ok: false, reason: r.reason };
  }
  function collarSelectionStr(reason) {
    const m = { "unknown-collar-family": "카라 종류를 선택하세요", "unknown-collar-variant": "세부 제도형을 선택하세요",
      "collar-preset-unavailable": (window.collarPresets ? window.collarPresets.PENDING_NOTE : "제도 자료 확인 후 제공"), "no-module": "" };
    return m[reason] != null ? m[reason] : "";
  }
  // 세부 제도 select 옵션을 현재 종류에서 다시 만든다(미구현 variant 는 disabled 슬롯).
  function rebuildCollarVariantOptions() {
    const sel = document.getElementById("selCollarPreset"); if (!sel || !window.collarPresets) return;
    const fid = selectedCollarFamilyId(), opts = window.collarPresets.variantOptions(fid);
    while (sel.firstChild) sel.removeChild(sel.firstChild);
    if (opts.length === 0) {
      const op = document.createElement("option"); op.value = ""; op.textContent = "제도 자료 없음"; op.disabled = true; sel.appendChild(op);
    } else opts.forEach(o => { const op = document.createElement("option"); op.value = o.value; op.textContent = o.label + (o.available ? "" : " · " + window.collarPresets.PENDING_SHORT); op.disabled = !o.available; sel.appendChild(op); });
    const first = opts.filter(o => o.available)[0] || opts[0];
    sel.value = first ? first.value : "";
  }
  // 미구현 variant 의 **참고 도면 수치**(실행값 아님) 한 줄 요약. 없으면 빈 문자열.
  function collarReferenceStr(familyId, variantId) {
    if (!window.collarPresets) return "";
    const v = window.collarPresets.variant(familyId, variantId); if (!v) return "";
    const rows = window.collarPresets.referenceRows(familyId, variantId);
    const dims = rows.map(r => r.label + " " + (r.text != null ? r.text : fmtL(r.value) + (r.unit || ""))).join(" · ");
    const parts = [];
    if (dims) parts.push("참고 도면 수치: " + dims);
    if (v.referenceNote) parts.push(v.referenceNote);
    if (v.requiresMethodPage) parts.push("전체 제도법 P" + v.requiresMethodPage + " 필요 · 적용 불가");
    return parts.join(" · ");
  }
  // 버튼 문구 + 선택 상태 안내(형상은 안 건드린다).
  function syncCollarPresetLabel() {
    const btn = document.getElementById("btnCollarBaseM"), r = resolveCollarSelection();
    const rec = r.ok ? window.collarPresets.get(r.presetId) : null;
    if (btn) btn.textContent = (rec ? rec.label : "선택 제도형") + "으로 초기화";
    const note = document.getElementById("designCollarCatalogNote");
    if (note && window.collarPresets) {
      const fid = selectedCollarFamilyId();
      const t = window.collarPresets.displayTitle(fid, selectedCollarVariantId());   // 선택 variant 의 표식·페이지(대표 symbol 아님)
      const head = t ? t.familyLabel + " " + t.symbol + " (교재 P" + t.page + ")" : "카라 종류";
      if (r.ok) note.textContent = head + " · " + rec.label + " 적용 가능";
      else {
        const ref = collarReferenceStr(fid, selectedCollarVariantId());
        note.textContent = head + " · " + collarSelectionStr(r.reason) + (ref ? " · " + ref : "");
      }
    }
  }
  function deriveCollar(project, bandWidthCm, frontRiseCm, frontEndCm) {
    if (!window.designCollar || !window.bodiceCheckpoint) return { ok: false, reason: "no-module" };
    const sel = resolveCollarSelection(); if (!sel.ok) return { ok: false, reason: sel.reason };
    const preset = window.collarPresets.get(sel.presetId);
    const bodice = window.bodiceCheckpoint.latest(project);
    // 교재 O 처럼 D(P.61) 방식 기초선 옵션이 있는 프리셋이면 그 construction 을 함께 적용한다
    //   (밴드 폭·올림·앞 끝선은 사용자 편집값, construction 은 프리셋 고정 형상 옵션).
    const construction = preset.construction ? JSON.parse(JSON.stringify(preset.construction)) : null;
    const r = window.designCollar.computeStand(bodice, { bandWidthCm: bandWidthCm, frontRiseCm: frontRiseCm, frontEndCm: frontEndCm }, construction);
    if (!r.ok) return r;
    project.working.collarDraft = {
      sourceBodiceHash: bodice.hash,
      type: preset.type,
      baseMethod: preset.baseMethod,   // 정본 제도법 출처(registry 레코드). hash 미포함 메타.
      presetId: preset.id,             // 선택 프리셋 identity(출처 메타). hash 미포함.
      parameters: { stand: { bandWidthCm: bandWidthCm, frontRiseCm: frontRiseCm, frontEndCm: frontEndCm } },
      construction: construction,   // null 이면 기존 M·N·P 와 동일한 P.148 제도
      standGeometry: r.standGeometry,
      standAnchors: r.anchors,   // 표시 전용 named anchor(collarAnnotation) — checkpoint 스냅샷·hash 미포함
      collarGeometry: null,   // (미사용 예약)
      body: null,             // C2 본체(스탠드 재적용 시 무효 → 명시적 재생성)
      // 5분리 길이(직선 스캐폴드 아님 — 곡률 반영). C2 는 upperTotal 을 직접 쓰지 않고 앞끝 여백을 별도 결정.
      measure: {
        lowerNeckSeamLenCm: r.lowerNeckSeamLenCm, lowerExtensionLenCm: r.lowerExtensionLenCm,
        upperNeckSegmentLenCm: r.upperNeckSegmentLenCm, upperExtensionLenCm: r.upperExtensionLenCm,
        upperTotalLenCm: r.upperTotalLenCm, backNeckLenCm: r.backNeckLenCm, frontNeckLenCm: r.frontNeckLenCm,
        neckTargetCm: r.neckTargetCm, cbTrimCm: r.cbTrimCm,   // P.148 ⑭ 목표 목둘레·뒤 중심 보정량
        baseLineLenCm: r.baseLineLenCm, baselineReductionCm: r.baselineReductionCm, guideRiseCm: r.guideRiseCm
      }
    };
    return { ok: true, result: r };
  }
  function setCollarNote(t) { const n = document.getElementById("designCollarNote"); if (n) n.textContent = t; }
  function collarFailStr(reason) {
    const m = { "no-bodice": "몸판 완료 필요", "no-neckline": "목둘레 측정 불가", "invalid-overlap": "여밈 값 확인", "front-extension-missing": "몸판에 앞여밈을 먼저 적용하세요",
      "invalid-band-width": "밴드 폭 값 확인(1–8)", "invalid-collar-width": "칼라 폭 값 확인", "invalid-top-setback": "앞 윗끝 물림 값 확인", "invalid-front-end": "앞 끝선 값 확인", "invalid-front-rise": "앞 중심 올림 값 확인(0 이상·과대 금지)", "invalid-guide-direction": "안내선 방향 오류", "stand-f-neckline-required": "몸판에서 스탠드 F 목선을 적용·완료하세요",
      "invalid-stand-offset": "앞끝 올림 대비 스탠드 높이 과대(윗선 붕괴)", "invalid-construction-guide": "기초선 감산·안내점 올림 값 확인",
      "invalid-back-collar-width": "뒤 칼라 폭 값 확인", "invalid-collar-stand": "칼라 허리 값 확인",
      "invalid-tip-base": "칼라 끝 밑변 값 확인", "invalid-tip-setback": "칼라 끝 수평 후퇴 값 확인", "invalid-tip-edge": "칼라 끝 앞변이 수평 후퇴보다 커야 합니다", "tip-base-too-long": "칼라 끝 밑변이 꺾임선보다 깁니다", "invalid-stand": "밴드를 먼저 적용하세요",
      "invalid-front-end-rise": "앞 끝 올림이 칼라 높이(허리+뒤 폭) 이상입니다", "invalid-front-straight": "앞 직선 구간 값 확인",
      "invalid-cb-rise": "뒤 중심 올림 값 확인", "invalid-shoulder-overlap": "어깨 겹침 값 확인",
      "invalid-v-drop": "V 목둘레 내림 값 확인", "invalid-v-hollow": "V선 휨 값 확인", "v-neck-failed": "V 목선을 만들 수 없습니다",
      "invalid-ribbon-length": "리본 길이 값 확인(0 보다 커야 합니다)", "invalid-attach-end": "칼라 달림 끝 값 확인(0 이상)",
      "attach-end-unreachable": "칼라 달림 끝이 앞 목둘레보다 커서 달림선이 없습니다",
      "invalid-hood-style": "이 후드 도해는 아직 제도 자료가 확정되지 않았습니다", "invalid-head-circumference": "머리 둘레 값 확인",
      "invalid-hood-measure": "후드 치수 값 확인", "invalid-hood-width": "후드 폭이 0 이하입니다 · 머리 둘레·보정 값 확인",
      "invalid-hood-length": "후드 길이가 0 이하입니다 · 후드 치수·보정 값 확인", "invalid-top-straight": "윗변 직선이 후드 폭보다 깁니다",
      "invalid-corner-curve": "뒤 위 모서리 곡선이 후드 폭·길이보다 큽니다", "invalid-snp-radius": "SNP 반원 반지름 값 확인",
      "attach-angle-unreachable": "이 목둘레·후드 치수로는 앞 달림선 길이를 맞출 수 없습니다",
      "back-attach-unreachable": "뒤 달림선 길이를 맞출 수 없습니다",
      "invalid-collar-stand": "칼라 허리 값 확인(어깨선 연장 0.7 보다 커야 합니다)", "invalid-lapel-width": "라펠 폭 값 확인",
      "invalid-lay-down": "누임 치수 값 확인", "invalid-neck-shift": "목둘레 이동량 값 확인",
      "invalid-tip-radius": "칼라 끝 반원 반지름 값 확인", "invalid-lapel-bow": "라펠 외형 휨 값 확인",
      "invalid-front-neck": "앞 목둘레선 값 확인", "no-body-armhole": "몸판 진동선을 찾을 수 없습니다",
      "no-body-waist": "몸판 허리선을 찾을 수 없습니다", "ambiguous-bust-line": "몸판 가슴선(진동밑점)을 하나로 특정할 수 없습니다",
      "ambiguous-waist-line": "몸판 허리선을 하나로 특정할 수 없습니다",
      "lapel-guide-unreachable": "라펠 폭이 안내선에 닿지 않습니다", "lapel-tip-unreachable": "라펠 끝이 꺾임선 위쪽에 잡히지 않습니다",
      "lay-down-unreachable": "누임 치수가 뒤 목둘레로 회전할 수 없는 값입니다", "collar-tip-unreachable": "칼라 끝을 작도할 수 없습니다",
      "invalid-back-outer": "뒤 칼라 외곽 값 확인", "invalid-shoulder-width": "어깨 칼라 폭 값 확인", "invalid-front-bow": "앞 외곽 휨 값 확인",
      "shoulder-overlap-unreachable": "어깨 겹침 값이 어깨 길이로 만들 수 없는 값입니다", "attach-offset-failed": "달림선 재작도 실패",
      "invalid-collar-width": "칼라 폭 값 확인(0 보다 커야 합니다)", "invalid-front-end": "앞 끝선 값 확인", "invalid-front-end-offset": "칼라 끝 안내선 값 확인",
      "front-end-unreachable": "칼라 끝 안내선이 앞 끝선보다 멀어 닿지 않습니다", "shoulder-butt-overlap": "어깨선에서 맞대면 앞·뒤가 겹칩니다",
      "no-body-shoulder": "몸판 어깨선을 찾을 수 없습니다", "ambiguous-neck-point": "몸판 목점을 하나로 특정할 수 없습니다",
      "invalid-upper-width": "위 칼라 폭 값 확인", "invalid-front-width": "앞 칼라 폭 값 확인", "invalid-outer-bow": "외곽 처짐 값 확인(0 이상)", "invalid-outer-back": "외곽 뒤 구간(뒤 목둘레)이 앞 위 끝을 지납니다 · 폭 값을 조정하세요",
      "invalid-break-point": "앞목점→꺾임 끝 값이 여밈분보다 커야 합니다",
      "no-body-neckline": "몸판 앞 목둘레선을 찾을 수 없습니다", "no-body-center": "몸판 앞 중심선을 찾을 수 없습니다",
      "ambiguous-front-neck-point": "몸판 앞 중심 목점을 하나로 특정할 수 없습니다",
      "break-start-out-of-neckline": "앞 직선 구간이 몸판 앞 목둘레선보다 깁니다",
      "attach-length-unreachable": "달림선을 목둘레 길이에 맞출 수 없습니다", "self-intersection": "스탠드 형상이 교차합니다 · 값을 조정하세요", "unknown-collar-preset": "알 수 없는 카라 프리셋", "unknown-collar-family": "알 수 없는 카라 종류",
      "unknown-collar-variant": "세부 제도형을 선택하세요", "collar-preset-unavailable": "이 카라는 제도 자료 확인 후 제공", "no-module": "" };
    return m[reason] || "카라를 적용할 수 없습니다";
  }
  function onApplyCollar() {
    const project = designProjectNow(); if (!project) return;
    if (!collarGateOk(project)) { setCollarNote("소매 완료 후 카라를 편집할 수 있습니다"); return; }
    if (selectedCollarKind() === "hood") {   // 후드: 머리 둘레·후드 치수만 편집값으로 받는다
      const hh = readNum("inpHoodHead", 30, 80), hmv = readNum("inpHoodMeasure", 20, 70);
      if (!hh.valid) { setCollarNote("머리 둘레 범위를 확인하세요(30–80cm)"); return; }
      if (!hmv.valid) { setCollarNote("후드 치수 범위를 확인하세요(20–70cm)"); return; }
      const rh = deriveHood(project, hh.v, hmv.v);
      if (!rh.ok) { setCollarNote("적용 불가: " + collarFailStr(rh.reason)); return; }   // 실패 시 이전 유지
      if (window.designLayout) window.designLayout.afterCollar();
      if (typeof render === "function") render();
      updateCollarPanel(project);
      return;
    }
    if (selectedCollarKind() !== "two-piece") { onCollarBaseM(); return; }   // 한 장/단독 스탠드: 교재 기본값 적용(수치 입력 없음)
    const h = readNum("inpCollarStandHeight", 1, 8), fr = readNum("inpCollarFrontRise", 0, 10);
    if (!h.valid) { setCollarNote("밴드 폭 범위를 확인하세요(1–8cm)"); return; }
    if (!fr.valid) { setCollarNote("앞 중심 올림 범위를 확인하세요(0–10cm)"); return; }
    // 앞 끝선(⑪)은 입력이 없다 — 커밋값, 없으면 선택 제도형 기본값(교재 0.5).
    const pdNow = collarPresetDefaults(), cNow = committedCollar(project);
    // 앞 끝선도 같은 규칙 — 제도형이 바뀌면 옛 커밋값을 들고 가지 않는다.
    const keepEnd = cNow.has && pdNow.ok && cNow.presetId === pdNow.id && cNow.frontEndCm != null;
    const endCm = keepEnd ? cNow.frontEndCm : (pdNow.ok && pdNow.stand ? pdNow.stand.frontEndCm : 0.5);
    const r = deriveCollar(project, h.v, fr.v, endCm);
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
  // 선택 프리셋으로 초기화(현재 registry = 교재 M 기본형 하나): 스탠드·본체를 프리셋 기본값으로 **정확히**
  //   복원한다(M: 밴드 폭 3·올림 1·앞 끝선 0.5·gap 3·수평 돌출 1.5·사선 6, √33.75 는 파생). "수치형으로 돌아가기"
  //   (직접 편집 전 사용자 파라미터 복귀)와 다르다: 이건 프리셋 기준값 복원이다.
  //   ★ manual(관리형 직접 편집) 중에는 금지 — 관리선을 묵시 삭제/덮어쓰기 하지 않는다(먼저 수치형으로 돌아가기).
  //   ★ 원자성: collarPresets.composeDraft 가 스탠드·본체를 모두 계산·검증한 뒤에만 새 draft 를 준다.
  //     실패하면 기존 스탠드·본체·관리선·완료본을 전부 그대로 유지(collarDraft 미변경).
  //   완료본은 지우지 않는다 — 형상이 바뀌면 collarCheckpoint 가 "카라 변경됨"으로 판정(기존 수명주기).
  function onCollarBaseM() {
    const project = designProjectNow(); if (!project || !window.designCollar || !window.bodiceCheckpoint || !window.collarPresets) return;
    if (!collarGateOk(project)) { setCollarNote("소매 완료 후 카라를 편집할 수 있습니다"); return; }
    const sel = resolveCollarSelection();
    if (!sel.ok) { setCollarNote("적용 불가: " + collarFailStr(sel.reason)); return; }   // 미구현/알 수 없음 → M 으로 대체하지 않음
    const preset = window.collarPresets.get(sel.presetId);
    if (collarBodyManual(project)) { setCollarBodyNote("직접 수정 중에는 " + preset.label + "으로 초기화할 수 없습니다 · 먼저 수치형으로 돌아가기"); return; }
    const plan = window.collarPresets.composeDraft(sel.presetId, window.bodiceCheckpoint.latest(project), window.designCollar);
    if (!plan.ok) {
      if (plan.stage === "body") setCollarBodyNote("적용 불가: " + collarBodyFailStr(plan.reason));
      else setCollarNote("적용 불가: " + collarFailStr(plan.reason));
      return;
    }
    project.working.collarDraft = plan.draft;   // ── 원자 교체(스탠드·본체 둘 다 ok) ──
    if (window.designLayout) window.designLayout.afterCollar();
    if (typeof render === "function") render();
    updateCollarPanel(project); updateCollarBodyPanel(project);
    setCollarNote(preset.label + " 적용 · 세션 전용");
  }
  // 한 장 셔츠 칼라 패널(G): 수치 입력 없이 교재 제도 기본값을 적용한다(v1). 표시는 실측 결과 중심.
  //   ★ 달림선 실측과 몸판 목둘레(뒤목+앞목) 차이는 **사실 표시**다 — 교재는 외곽을 목둘레에 맞추지 않고 가봉한다.
  function onePieceMeasure(project) {
    const cd = project && project.working && project.working.collarDraft;
    return (cd && cd.type === "shirt-one-piece" && cd.onePiece) ? (cd.onePiece.measure || null) : null;
  }
  function onePieceSummary(m) {
    const d = m.attachDiffCm;
    return "달림선 " + fmtL(m.attachLenCm) + "cm(목둘레 " + fmtL(m.neckTargetCm) + "cm · 차이 " + (d >= 0 ? "+" : "−") + fmtL(Math.abs(d)) + "cm) · 뒤 폭 " +
      fmtL(m.backCollarWidthCm) + "·허리 " + fmtL(m.collarStandCm) + "·앞 폭 " + fmtL(m.frontCollarWidthCm) + "cm · 꺾임선 " + fmtL(m.foldLenCm) + "·외곽 " + fmtL(m.outerLenCm) + "cm · 세션 전용";
  }
  function updateOnePieceCollarPanel(project, gate, pd) {
    const applyBtn = document.getElementById("btnApplyCollar"), resetBtn = document.getElementById("btnResetCollar");
    const m = onePieceMeasure(project), stale = collarStale(project);
    if (applyBtn) applyBtn.disabled = !gate || !pd.ok || collarBodyManual(project);
    if (resetBtn) resetBtn.disabled = !(project.working.collarDraft);
    if (!gate) setCollarNote("소매 완료 후 카라를 편집할 수 있습니다");
    else if (!pd.ok) setCollarNote(collarSelectionStr(pd.reason) + (m ? " · 현재 카라 형상은 그대로 유지" : ""));
    else if (m && stale) setCollarNote("몸판 변경됨 · 카라 다시 적용 필요 · 세션 전용");
    else if (m) setCollarNote(onePieceSummary(m));
    else setCollarNote("교재 제도 기본값으로 한 장 셔츠 칼라를 만듭니다(달림선·꺾임선·외곽선 한 조각) · 세션 전용");
    syncCollarBodyModeUI(project);
    updateCollarCheckpointUI(project);
    updateCollarDraftSummary(project);
  }
  // 오픈 칼라 패널(L, 몸판 연동): 수치 입력 없이 교재 제도 기본값을 적용한다. 표시는 실측 결과 중심.
  //   ★ L 은 달림선 실측 = 목둘레(×+⊘)가 길이 책임이므로 차이를 "정합"으로 표시한다(G~K 의 사실 표시와 다름).
  function openCollarMeasure(project) {
    const cd = project && project.working && project.working.collarDraft;
    return (cd && cd.type === "shirt-open-collar" && cd.openCollar) ? (cd.openCollar.measure || null) : null;
  }
  function openCollarSummary(m) {
    return "달림선 " + fmtL(m.attachLenCm) + "cm = 목둘레 " + fmtL(m.neckTargetCm) + "cm · 기초선 " + fmtL(m.baseLineLenCm) +
      "cm(파생) · 뒤 폭 " + fmtL(m.backCollarWidthCm) + "·허리 " + fmtL(m.collarStandCm) + "·앞 끝 올림 " + fmtL(m.frontEndRiseCm) +
      "cm · 앞 직선 " + fmtL(m.frontStraightCm) + "cm(꺾임점 들림 " + fmtL(m.foldJunctionLiftCm) + "cm 파생) · 몸판 꺾임선 " +
      fmtL(m.breakLineLenCm) + "cm(앞목점→꺾임 끝 " + fmtL(m.breakPointDistanceCm) + "cm) · 세션 전용";
  }
  function updateOpenCollarPanel(project, gate, pd) {
    const applyBtn = document.getElementById("btnApplyCollar"), resetBtn = document.getElementById("btnResetCollar");
    const m = openCollarMeasure(project), stale = collarStale(project);
    syncCollarPresetLabel();
    if (applyBtn) applyBtn.disabled = !gate || !pd.ok;
    if (resetBtn) resetBtn.disabled = !(project.working.collarDraft);
    if (!gate) setCollarNote("소매 완료 후 카라를 편집할 수 있습니다");
    else if (!pd.ok) setCollarNote(collarSelectionStr(pd.reason) + (m ? " · 현재 카라 형상은 그대로 유지" : ""));
    else if (m && stale) setCollarNote("몸판 변경됨 · 오픈 칼라 다시 적용 필요 · 세션 전용");
    else if (m) setCollarNote(openCollarSummary(m));
    else setCollarNote("몸판 목둘레선·앞 꺾임선을 읽어 오픈 칼라를 만듭니다(몸판 형상은 변경하지 않음) · 세션 전용");
    syncCollarBodyModeUI(project);
    updateCollarCheckpointUI(project);
    updateCollarDraftSummary(project);
  }
  // 윙 칼라 패널(Q): 수치 입력 없이 교재 제도 기본값을 적용한다(밴드 수평 꺾임선 + 칼라 끝).
  function wingMeasure(project) {
    const cd = project && project.working && project.working.collarDraft;
    return (cd && cd.type === "shirt-wing-collar") ? { band: cd.measure || null, tip: (cd.tip && cd.tip.measure) || null } : null;
  }
  function wingSummary(m) {
    const b = m.band, t = m.tip;
    return "달림선 " + fmtL(b.lowerNeckSeamLenCm) + "cm = 목둘레 " + fmtL(b.neckTargetCm) + "cm(뒤중심 보정 " + fmtL(b.cbTrimCm) +
      "cm) · 꺾임선(수평) " + fmtL(b.upperNeckSegmentLenCm) + "cm · 앞 끝선 " + fmtL(b.lowerExtensionLenCm) +
      "cm · 칼라 끝 밑변 " + fmtL(t.foldBaseLenCm) + "·앞변 " + fmtL(t.tipEdgeLenCm) + "·후퇴 " + fmtL(t.tipSetbackLenCm) +
      "cm(세로 " + fmtL(t.tipHeightCm) + " 파생) · 세션 전용";
  }
  // 세일러 칼라(U·V·W): 수치 입력 없이 교재 기본값으로 적용한다(two-piece 행 숨김).
  //   셋은 같은 제도(P.150)에 수치만 다르므로 패널·문구를 공유하고, 어느 도해인지는 표식으로만 구분한다.
  //   표식은 **적용된 초안의 presetId** 에서 읽는다(선택 select 가 아니라 — 선택과 초안이 다를 수 있다).
  function collarDraftSymbol(cd) {
    const v = (cd && cd.presetId && window.collarPresets && window.collarPresets.variantByPreset)
      ? window.collarPresets.variantByPreset(cd.presetId) : null;
    return (v && v.symbol) || null;
  }
  function sailorCollarMeasure(project) {
    const cd = project && project.working && project.working.collarDraft;
    return (cd && cd.type === "sailor-collar" && cd.sailor) ? (cd.sailor.measure || null) : null;
  }
  function sailorCollarSummary(m) {
    return "V 목선 " + fmtL(m.vNeckLenCm) + "cm(FNP에서 " + fmtL(m.vDropCm) + " 내림) · 달림선 " + fmtL(m.attachLenCm) +
      "cm = 목둘레 " + fmtL(m.neckTargetCm) + "cm − " + fmtL(m.attachShortfallCm) + "cm(늘려 박는 분) · 어깨 겹침 " +
      fmtL(m.shoulderOverlapCm) + "cm(" + fmtL(m.overlapAngleDeg) + "°) · 뒤 중심 " + fmtL(m.cbWidthLenCm) + "·뒤 외곽 " +
      fmtL(m.backOuterLenCm) + "·어깨 폭 " + fmtL(m.shoulderWidthLenCm) + "cm · 외곽 전체 " + fmtL(m.outerLenCm) + "cm · 세션 전용";
  }
  function updateSailorCollarPanel(project, gate, pd) {
    const applyBtn = document.getElementById("btnApplyCollar"), resetBtn = document.getElementById("btnResetCollar");
    const m = sailorCollarMeasure(project), stale = collarStale(project);
    syncCollarPresetLabel();
    if (applyBtn) applyBtn.disabled = !gate || !pd.ok;
    if (resetBtn) resetBtn.disabled = !(project.working.collarDraft);
    if (!gate) setCollarNote("소매 완료 후 카라를 편집할 수 있습니다");
    else if (!pd.ok) setCollarNote(collarSelectionStr(pd.reason) + (m ? " · 현재 카라 형상은 그대로 유지" : ""));
    else if (m && stale) setCollarNote("몸판 변경됨 · 세일러 칼라 다시 적용 필요 · 세션 전용");
    else if (m) setCollarNote(sailorCollarSummary(m));
    else setCollarNote("앞 목둘레를 V 로 파고(칼라 내부 파생) 어깨선을 겹쳐 한 장으로 제도합니다 · 세션 전용");
    syncCollarBodyModeUI(project);
    updateCollarCheckpointUI(project);
    updateCollarDraftSummary(project);
  }
  // 보 칼라(X·Y·Z): 수치 입력 없이 교재 기본값으로 적용한다(two-piece 행 숨김).
  //   셋은 같은 제도(P.71)에 칼라 폭·리본 길이만 다르므로 패널·문구를 공유하고, 어느 도해인지는 표식으로만 구분한다.
  function bowCollarMeasure(project) {
    const cd = project && project.working && project.working.collarDraft;
    return (cd && cd.type === "bow-collar" && cd.bow) ? (cd.bow.measure || null) : null;
  }
  function bowCollarSummary(m) {
    return "달림선 " + fmtL(m.attachLenCm) + "cm = ×+⊠ " + fmtL(m.neckTargetCm) + "cm(뒤목 " + fmtL(m.backNeckLenCm) +
      " + 앞 달림 " + fmtL(m.frontAttachLenCm) + ") · 칼라 달림 끝 앞 중심에서 " + fmtL(m.attachEndFromCfCm) +
      "cm · 리본 " + fmtL(m.ribbonLenCm) + "cm · 칼라 폭 " + fmtL(m.collarWidthLenCm) + "cm · 전체 길이 " +
      fmtL(m.totalLenCm) + "cm · 세션 전용";
  }
  function updateBowCollarPanel(project, gate, pd) {
    const applyBtn = document.getElementById("btnApplyCollar"), resetBtn = document.getElementById("btnResetCollar");
    const m = bowCollarMeasure(project), stale = collarStale(project);
    syncCollarPresetLabel();
    if (applyBtn) applyBtn.disabled = !gate || !pd.ok;
    if (resetBtn) resetBtn.disabled = !(project.working.collarDraft);
    if (!gate) setCollarNote("소매 완료 후 카라를 편집할 수 있습니다");
    else if (!pd.ok) setCollarNote(collarSelectionStr(pd.reason) + (m ? " · 현재 카라 형상은 그대로 유지" : ""));
    else if (m && stale) setCollarNote("몸판 변경됨 · 보 칼라 다시 적용 필요 · 세션 전용");
    else if (m) setCollarNote(bowCollarSummary(m));
    else setCollarNote("목둘레 치수를 수평선에 올려 직사각형 한 장으로 제도합니다(달림선 + 리본) · 세션 전용");
    syncCollarBodyModeUI(project);
    updateCollarCheckpointUI(project);
    updateCollarDraftSummary(project);
  }
  // 프릴 칼라(a·b·c): 교재 기본값 선택형. a는 개더 준비 길이, b·c는 절개·전개량을 별도로 표시한다.
  function frillCollarMeasure(project) {
    const cd = project && project.working && project.working.collarDraft;
    return (cd && cd.type === "frill-collar" && cd.frill) ? (cd.frill.measure || null) : null;
  }
  function frillCollarSummary(m) {
    if (m.styleCode === 0) return "완성 달림선 " + fmtL(m.finishedAttachLenCm) + "cm · 재단 달림변 " + fmtL(m.cutAttachLenCm) +
      "cm(목둘레 ×" + fmtL(m.gatherRatio) + ") · 개더분 " + fmtL(m.cutAttachLenCm - m.finishedAttachLenCm) +
      "cm · 폭 " + fmtL(m.collarWidthCm) + "cm · 세션 전용";
    return (m.styleCode === 2 ? "V 목둘레 " : "몸판 목둘레 ") + fmtL(m.neckTargetCm) + "cm · 달림선 " + fmtL(m.cutAttachLenCm) +
      "cm · 폭 " + fmtL(m.collarWidthCm) + "cm · 절개 " + m.spreadCount + "곳×" + fmtL(m.spreadEachCm) +
      "cm(총 전개 " + fmtL(m.spreadTotalCm) + ") · 외곽 " + fmtL(m.outerLenCm) + "cm · 세션 전용";
  }
  function updateFrillCollarPanel(project, gate, pd) {
    const applyBtn = document.getElementById("btnApplyCollar"), resetBtn = document.getElementById("btnResetCollar");
    const m = frillCollarMeasure(project), stale = collarStale(project);
    syncCollarPresetLabel();
    if (applyBtn) applyBtn.disabled = !gate || !pd.ok;
    if (resetBtn) resetBtn.disabled = !(project.working.collarDraft);
    if (!gate) setCollarNote("소매 완료 후 카라를 편집할 수 있습니다");
    else if (!pd.ok) setCollarNote(collarSelectionStr(pd.reason) + (m ? " · 현재 카라 형상은 그대로 유지" : ""));
    else if (m && stale) setCollarNote("몸판 변경됨 · 프릴 칼라 다시 적용 필요 · 세션 전용");
    else if (m) setCollarNote(frillCollarSummary(m));
    else setCollarNote("개더형(a) 또는 목둘레 기준 절개·전개형(b·c)으로 제도합니다 · 세션 전용");
    syncCollarBodyModeUI(project); updateCollarCheckpointUI(project); updateCollarDraftSummary(project);
  }
  // 후드(d): **머리 둘레·후드 치수 두 값만** 편집한다(후드 폭·길이는 교재 공식으로 파생).
  //   이 둘은 몸판 치수(B/W/BL)에서 파생되지 않는 후드 전용 치수라 카라 패널에서 받는다 —
  //   블록 치수·state·storage 는 건드리지 않는다.
  function hoodMeasure(project) {
    const cd = project && project.working && project.working.collarDraft;
    return (cd && cd.type === "hood" && cd.hood) ? (cd.hood.measure || null) : null;
  }
  function hoodSummary(m) {
    return "달림선 " + fmtL(m.attachLenCm) + "cm = 몸판 목둘레 " + fmtL(m.neckTargetCm) + "cm(앞 " + fmtL(m.frontAttachLenCm) +
      "·뒤 " + fmtL(m.backAttachLenCm) + ") · 후드 폭 " + fmtL(m.hoodWidthCm) + "(머리둘레 " + fmtL(m.headCircumferenceCm) +
      "/2" + (m.widthOffsetCm >= 0 ? "+" : "−") + fmtL(Math.abs(m.widthOffsetCm)) + ") · 길이 " + fmtL(m.hoodLengthCm) +
      "(후드 치수 " + fmtL(m.hoodMeasureCm) + (m.lengthOffsetCm >= 0 ? "+" : "−") + fmtL(Math.abs(m.lengthOffsetCm)) +
      ") · 뒤 중심선 " + fmtL(m.cbLenCm) + "cm · 세션 전용";
  }
  // 편집값(머리 둘레·후드 치수)으로 후드를 다시 파생한다. 나머지 수치는 선택 프리셋 고정값.
  function deriveHood(project, headCm, measureCm) {
    if (!window.designCollar || !window.bodiceCheckpoint || !window.collarPresets) return { ok: false, reason: "no-module" };
    const sel = resolveCollarSelection(); if (!sel.ok) return { ok: false, reason: sel.reason };
    const preset = window.collarPresets.get(sel.presetId);
    const pd = window.collarPresets.defaults(sel.presetId);
    if (!pd.ok || !pd.hood) return { ok: false, reason: "unknown-collar-preset" };
    const bodice = window.bodiceCheckpoint.latest(project);
    const hoodParams = Object.assign({}, pd.hood, { headCircumferenceCm: headCm, hoodMeasureCm: measureCm });
    const r = window.designCollar.computeHood(bodice, hoodParams);
    if (!r.ok) return r;
    project.working.collarDraft = {
      sourceBodiceHash: bodice.hash, type: preset.type, baseMethod: preset.baseMethod, presetId: preset.id,
      parameters: { hood: hoodParams },
      hood: { geometry: r.geometry, measure: r.measure, anchors: r.anchors }
    };
    return { ok: true, result: r };
  }
  function updateHoodCollarPanel(project, gate, pd) {
    const applyBtn = document.getElementById("btnApplyCollar"), resetBtn = document.getElementById("btnResetCollar");
    const m = hoodMeasure(project), stale = collarStale(project);
    const cd = project.working.collarDraft, hp = (cd && cd.type === "hood" && cd.parameters) ? cd.parameters.hood : null;
    const setIf = (id, v) => { const el = document.getElementById(id); if (el && document.activeElement !== el && v != null) el.value = fmtL(v); };
    syncCollarPresetLabel();
    setIf("inpHoodHead", hp ? hp.headCircumferenceCm : (pd.ok && pd.hood ? pd.hood.headCircumferenceCm : null));
    setIf("inpHoodMeasure", hp ? hp.hoodMeasureCm : (pd.ok && pd.hood ? pd.hood.hoodMeasureCm : null));
    if (applyBtn) applyBtn.disabled = !gate || !pd.ok;
    if (resetBtn) resetBtn.disabled = !(project.working.collarDraft);
    if (!gate) setCollarNote("소매 완료 후 카라를 편집할 수 있습니다");
    else if (!pd.ok) setCollarNote(collarSelectionStr(pd.reason) + (m ? " · 현재 카라 형상은 그대로 유지" : ""));
    else if (m && stale) setCollarNote("몸판 변경됨 · 후드 다시 적용 필요 · 세션 전용");
    else if (m) setCollarNote(hoodSummary(m));
    else setCollarNote("앞 몸판 FNP 위에 직접 제도합니다 — 달림선이 앞뒤 몸판 목둘레와 같아집니다 · 세션 전용");
    syncCollarBodyModeUI(project);
    updateCollarCheckpointUI(project);
    updateCollarDraftSummary(project);
  }
  // 테일러드 칼라(h·i): 수치 입력 없이 교재 기본값으로 적용한다.
  //   h·i 는 같은 제도(P.152–153)라 패널·문구를 공유하고, 어느 도해인지는 표식으로만 구분한다.
  function tailoredMeasure(project) {
    const cd = project && project.working && project.working.collarDraft;
    return (cd && cd.type === "tailored-collar" && cd.tailored) ? (cd.tailored.measure || null) : null;
  }
  function tailoredSummary(m) {
    return "뒤 달림선 " + fmtL(m.backAttachLenCm) + "cm = 뒤 목둘레 " + fmtL(m.backNeckLenCm) + "cm(누임 " +
      fmtL(m.layDownCm) + "cm · " + fmtL(m.layDownAngleDeg) + "°) · 칼라 허리 " + fmtL(m.cbStandLenCm) + "·폭 " +
      fmtL(m.cbWidthLenCm) + "cm · 라펠 폭 " + fmtL(m.lapelWidthLenCm) + "cm · 칼라 끝 " + fmtL(m.collarTipToLapelCm) +
      "cm(정삼각형) · 꺾임 끝 = BL~WL " + fmtL(m.bustToWaistCm) + "cm 2등분 · 세션 전용";
  }
  function updateTailoredCollarPanel(project, gate, pd) {
    const applyBtn = document.getElementById("btnApplyCollar"), resetBtn = document.getElementById("btnResetCollar");
    const m = tailoredMeasure(project), stale = collarStale(project);
    syncCollarPresetLabel();
    if (applyBtn) applyBtn.disabled = !gate || !pd.ok;
    if (resetBtn) resetBtn.disabled = !(project.working.collarDraft);
    if (!gate) setCollarNote("소매 완료 후 카라를 편집할 수 있습니다");
    else if (!pd.ok) setCollarNote(collarSelectionStr(pd.reason) + (m ? " · 현재 카라 형상은 그대로 유지" : ""));
    else if (m && stale) setCollarNote("몸판 변경됨 · 테일러드 칼라 다시 적용 필요 · 세션 전용");
    else if (m) setCollarNote(tailoredSummary(m));
    else setCollarNote("앞 몸판 위에 라펠 → 위 칼라 순으로 제도합니다(몸판 형상은 변경하지 않음) · 세션 전용");
    syncCollarBodyModeUI(project);
    updateCollarCheckpointUI(project);
    updateCollarDraftSummary(project);
  }
  // 플랫 칼라(S): 수치 입력 없이 교재 기본값으로 적용한다(two-piece 행 숨김).
  function flatCollarMeasure(project) {
    const cd = project && project.working && project.working.collarDraft;
    const isFlat = cd && (cd.type === "flat-collar" || cd.type === "flat-collar-overlap");
    return (isFlat && cd.flat) ? (cd.flat.measure || null) : null;
  }
  // T(겹침형)는 달림선을 재작도하므로 몸판 목둘레보다 짧다 — 그 부족분을 함께 보고한다.
  function flatOverlapSummary(m) {
    return "달림선 " + fmtL(m.attachLenCm) + "cm = 몸판 목둘레 " + fmtL(m.neckTargetCm) + "cm − " + fmtL(m.attachShortfallCm) +
      "cm(늘려 박는 분) · 어깨 겹침 " + fmtL(m.shoulderTipGapCm) + "cm(" + fmtL(m.overlapAngleDeg) + "°) · 칼라 폭 뒤중심 " +
      fmtL(m.cbWidthLenCm) + "·어깨 " + fmtL(m.shoulderWidthLenCm) + "cm · 앞 끝선 " + fmtL(m.frontEndLenCm) +
      "cm(안내선 " + fmtL(m.frontEndOffsetLenCm) + ") · 외곽선 " + fmtL(m.outerLenCm) + "cm · 세션 전용";
  }
  function flatCollarSummary(m) {
    return "달림선 " + fmtL(m.attachLenCm) + "cm = 몸판 목둘레 " + fmtL(m.neckTargetCm) +
      "cm(뒤 " + fmtL(m.backAttachLenCm) + "·앞 " + fmtL(m.frontAttachLenCm) + ") · 칼라 폭 뒤중심 " + fmtL(m.cbWidthLenCm) +
      "·어깨 " + fmtL(m.shoulderWidthLenCm) + "cm · 앞 끝선 " + fmtL(m.frontEndLenCm) + "cm(안내선 " + fmtL(m.frontEndOffsetLenCm) +
      ") · 외곽선 " + fmtL(m.outerLenCm) + "cm · 세션 전용";
  }
  function updateFlatCollarPanel(project, gate, pd) {
    const applyBtn = document.getElementById("btnApplyCollar"), resetBtn = document.getElementById("btnResetCollar");
    const m = flatCollarMeasure(project), stale = collarStale(project);
    syncCollarPresetLabel();
    if (applyBtn) applyBtn.disabled = !gate || !pd.ok;
    if (resetBtn) resetBtn.disabled = !(project.working.collarDraft);
    if (!gate) setCollarNote("소매 완료 후 카라를 편집할 수 있습니다");
    else if (!pd.ok) setCollarNote(collarSelectionStr(pd.reason) + (m ? " · 현재 카라 형상은 그대로 유지" : ""));
    else if (m && stale) setCollarNote("몸판 변경됨 · 플랫 칼라 다시 적용 필요 · 세션 전용");
    else if (m) setCollarNote(m.shoulderOverlapCm != null ? flatOverlapSummary(m) : flatCollarSummary(m));
    else setCollarNote("몸판 목둘레선에 직접 제도해 어깨선에서 맞대거나(S) 어깨선을 겹쳐 제도합니다(T) · 세션 전용");
    syncCollarBodyModeUI(project);
    updateCollarCheckpointUI(project);
    updateCollarDraftSummary(project);
  }
  // 밴드+위 칼라 한 장(R): 수치 입력 없이 교재 기본값으로 적용한다(two-piece 행 숨김).
  function bandOnePieceMeasure(project) {
    const cd = project && project.working && project.working.collarDraft;
    return (cd && cd.type === "shirt-band-one-piece" && cd.joined) ? (cd.joined.measure || null) : null;
  }
  function bandOnePieceSummary(m) {
    return "달림선 " + fmtL(m.lowerNeckSeamLenCm) + "cm = 목둘레 " + fmtL(m.neckTargetCm) + "cm(뒤중심 보정 " + fmtL(m.cbTrimCm) +
      "cm) · 이음선 자리 " + fmtL(m.bandTopLenCm) + "cm · 외곽 뒤 " + fmtL(m.outerBackLenCm) + "cm = 뒤 목둘레 " + fmtL(m.backNeckLenCm) +
      "cm · 외곽 앞 " + fmtL(m.outerFrontLenCm) + "cm(전체 " + fmtL(m.outerLenCm) + ") · 앞 칼라 폭 " + fmtL(m.frontEdgeLenCm) +
      "cm · CB 전체 " + fmtL(m.cbHeightCm) + "cm · 세션 전용";
  }
  function updateBandOnePieceCollarPanel(project, gate, pd) {
    const applyBtn = document.getElementById("btnApplyCollar"), resetBtn = document.getElementById("btnResetCollar");
    const m = bandOnePieceMeasure(project), stale = collarStale(project);
    syncCollarPresetLabel();
    if (applyBtn) applyBtn.disabled = !gate || !pd.ok;
    if (resetBtn) resetBtn.disabled = !(project.working.collarDraft);
    if (!gate) setCollarNote("소매 완료 후 카라를 편집할 수 있습니다");
    else if (!pd.ok) setCollarNote(collarSelectionStr(pd.reason) + (m ? " · 현재 카라 형상은 그대로 유지" : ""));
    else if (m && stale) setCollarNote("몸판 변경됨 · 밴드+위 칼라 다시 적용 필요 · 세션 전용");
    else if (m) setCollarNote(bandOnePieceSummary(m));
    else setCollarNote("밴드 윗선을 경계로 위 칼라를 한 장으로 이어 제도합니다 · 세션 전용");
    syncCollarBodyModeUI(project);
    updateCollarCheckpointUI(project);
    updateCollarDraftSummary(project);
  }
  function updateWingCollarPanel(project, gate, pd) {
    const applyBtn = document.getElementById("btnApplyCollar"), resetBtn = document.getElementById("btnResetCollar");
    const m = wingMeasure(project), stale = collarStale(project);
    syncCollarPresetLabel();
    if (applyBtn) applyBtn.disabled = !gate || !pd.ok;
    if (resetBtn) resetBtn.disabled = !(project.working.collarDraft);
    if (!gate) setCollarNote("소매 완료 후 카라를 편집할 수 있습니다");
    else if (!pd.ok) setCollarNote(collarSelectionStr(pd.reason) + (m ? " · 현재 카라 형상은 그대로 유지" : ""));
    else if (m && m.band && m.tip && stale) setCollarNote("몸판 변경됨 · 윙 칼라 다시 적용 필요 · 세션 전용");
    else if (m && m.band && m.tip) setCollarNote(wingSummary(m));
    else setCollarNote("밴드 꺾임선을 수평으로 긋고 앞 위 끝에 칼라 끝만 제도합니다(위 칼라 없음) · 세션 전용");
    syncCollarBodyModeUI(project);
    updateCollarCheckpointUI(project);
    updateCollarDraftSummary(project);
  }
  function updateStandaloneCollarPanel(project, gate, pd) {
    const applyBtn = document.getElementById("btnApplyCollar"), resetBtn = document.getElementById("btnResetCollar");
    const cd = project && project.working && project.working.collarDraft;
    const m = cd && cd.type === "stand-collar" && cd.standalone ? cd.standalone.measure : null;
    if (applyBtn) applyBtn.disabled = !gate || !pd.ok;
    if (resetBtn) resetBtn.disabled = !cd;
    if (!gate) setCollarNote("소매 완료 후 카라를 편집할 수 있습니다");
    else if (!pd.ok) setCollarNote(collarSelectionStr(pd.reason) + (m ? " · 현재 카라 형상은 그대로 유지" : ""));
    else if (m && collarStale(project)) setCollarNote("몸판 변경됨 · 스탠드 칼라 다시 적용 필요 · 세션 전용");
    else if (m) {
      const d = m.attachDiffCm;
      setCollarNote("달림선 " + fmtL(m.attachLenCm) + "cm(목둘레 " + fmtL(m.neckTargetCm) + "cm · 차이 " + (d >= 0 ? "+" : "−") + fmtL(Math.abs(d)) + "cm) · 칼라 폭 " + fmtL(m.collarWidthCm) + "·앞 중심 올림 " + fmtL(m.frontRiseCm) + "·앞 윗끝 물림 " + fmtL(m.topSetbackCm) + "cm" + (m.frontExtensionCm > 0 ? " · 몸판 앞끝 연장 " + fmtL(m.frontExtensionCm) + "cm" : "") + (m.spreadEachCm > 0 ? " · 외곽 벌림 " + fmtL(m.spreadEachCm) + "cm×" + m.spreadCount : "") + (m.cbTrimCm > 0 ? " · 뒤중심 보정 " + fmtL(m.cbTrimCm) + "cm" : "") + " · 세션 전용");
    } else {
      const preset = selectedCollarPreset();
      setCollarNote((preset ? preset.label : "선택 제도형") + " 교재 기본값으로 단독 스탠드 칼라를 만듭니다 · 세션 전용");
    }
    syncCollarBodyModeUI(project); updateCollarCheckpointUI(project); updateCollarDraftSummary(project);
  }
  // refresh 훅: 입력 복원(포커스 중 안 덮음) + 버튼/게이트 + committed 기준 note.
  function updateCollarPanel(project) {
    if (!project) return;
    const gate = collarGateOk(project), c = committedCollar(project);
    const setIf = (id, v) => { const el = document.getElementById(id); if (el && document.activeElement !== el) el.value = fmtL(v); };
    const pd = collarPresetDefaults();   // 선택 제도형 stand 기본값(미구현이면 기본값 없음 → 입력 유지)
    syncCollarKindRows(project);
    if (isOnePieceCollar(project)) { updateOnePieceCollarPanel(project, gate, pd); return; }
    if (isOpenCollar(project)) { updateOpenCollarPanel(project, gate, pd); return; }
    if (isWingCollar(project)) { updateWingCollarPanel(project, gate, pd); return; }
    if (isBandOnePieceCollar(project)) { updateBandOnePieceCollarPanel(project, gate, pd); return; }
    if (isFlatCollar(project)) { updateFlatCollarPanel(project, gate, pd); return; }
    if (isSailorCollar(project)) { updateSailorCollarPanel(project, gate, pd); return; }
    if (isBowCollar(project)) { updateBowCollarPanel(project, gate, pd); return; }
    if (isFrillCollar(project)) { updateFrillCollarPanel(project, gate, pd); return; }
    if (isHoodCollar(project)) { updateHoodCollarPanel(project, gate, pd); return; }
    if (isTailoredCollar(project)) { updateTailoredCollarPanel(project, gate, pd); return; }
    if (isStandaloneCollar(project)) { updateStandaloneCollarPanel(project, gate, pd); return; }
    // ★ 커밋값은 **선택 제도형이 그대로일 때만** 우선한다(사용자 수정값을 기본값으로 덮지 않기 위해).
    //   제도형을 바꾸면 입력칸도 새 제도형 기본값으로 따라가야 한다 — 안 그러면 수치는 옛 제도형 것,
    //   construction(기초선 감산·안내점 올림)은 새 제도형 것이 되어 **교재에 없는 모순 조합**이 만들어진다.
    //   (실측 회귀: N 적용 후 O 선택 → 적용 시 올림 3 + O 의 기초선 −2.5 조합으로 엔진이 거부했다.)
    const keepEdits = c.has && pd.ok && c.presetId === pd.id;
    if (keepEdits && c.bandWidthCm != null) setIf("inpCollarStandHeight", c.bandWidthCm);
    else if (pd.ok) setIf("inpCollarStandHeight", pd.stand.bandWidthCm);
    if (keepEdits && c.frontRiseCm != null) setIf("inpCollarFrontRise", c.frontRiseCm);
    else if (pd.ok) setIf("inpCollarFrontRise", pd.stand.frontRiseCm);
    syncCollarPresetLabel();
    const applyBtn = document.getElementById("btnApplyCollar"), resetBtn = document.getElementById("btnResetCollar");
    if (applyBtn) applyBtn.disabled = !gate || !pd.ok;   // 미구현 제도형에서는 적용 불가(형상 생성기 없음)
    if (resetBtn) resetBtn.disabled = !c.has;
    if (!gate) setCollarNote("소매 완료 후 카라를 편집할 수 있습니다");
    else if (!pd.ok) setCollarNote(collarSelectionStr(pd.reason) + (c.has ? " · 현재 카라 형상은 그대로 유지" : ""));
    else if (c.has && collarStale(project)) setCollarNote("몸판 변경됨 · 카라 다시 적용 필요(높이·앞끝올림 보존) · 세션 전용");
    // 윗선 목 구간(upperNeckSegmentLenCm)은 곡률 반영값 — C2 봉제 길이는 앞끝 여백과 함께 C2 에서 확정.
    else if (c.has && c.geom && c.measure) {
      const m = c.measure;
      const red = (m.baselineReductionCm > 0 || m.guideRiseCm > 0)
        ? " · 기초선 " + fmtL(m.baseLineLenCm) + "cm(감산 " + fmtL(m.baselineReductionCm) + "·2/3 안내점 " + fmtL(m.guideRiseCm) + " 올림)" : "";
      setCollarNote("달림선 " + fmtL(m.lowerNeckSeamLenCm) + "cm = 목둘레 " + fmtL(m.neckTargetCm != null ? m.neckTargetCm : m.lowerNeckSeamLenCm) + "cm(뒤중심 보정 " + fmtL(m.cbTrimCm || 0) + "cm) · 밴드 윗선 " + fmtL(m.upperNeckSegmentLenCm) + "cm · 앞 끝선 " + fmtL(m.lowerExtensionLenCm) + "cm · 앞 중심 올림 " + fmtL(c.frontRiseCm) + "cm" + red + " · 세션 전용");
    }
    else setCollarNote("스탠드 높이·앞끝 올림 적용으로 카라 스탠드 생성 · 세션 전용");
    updateCollarBodyPanel(project);
  }
  function refreshCollarUI(project) { syncCollarSubtabGate(project); updateCollarPanel(project); }

  // ── C2 칼라 본체 ── 스탠드 윗선 primitive 를 부착선으로. 스탠드가 준비(비스테일)됐을 때만.
  //   스탠드 높이·앞끝 올림이 바뀌면(deriveCollar 가 collarDraft 재생성) body 는 자동 소멸 → 명시적 재생성.
  function collarStandReady(project) { const c = committedCollar(project); return !!(c.has && c.geom && !collarStale(project) && collarGateOk(project) && isTwoPieceCollar(project)); }
  function committedCollarBody(project) {
    const bd = project && project.working && project.working.collarDraft && project.working.collarDraft.body;
    return bd ? { has: true, params: bd.parameters, attachLenCm: bd.attachLenCm, measure: bd.measure } : { has: false, params: null, attachLenCm: null, measure: null };
  }
  function deriveCollarBody(project, bodyParams) {
    if (!window.designCollar || !window.bodiceCheckpoint) return { ok: false, reason: "no-module" };
    const cd = project.working.collarDraft; if (!cd) return { ok: false, reason: "invalid-stand" };
    // 스탠드 result 재생성(순수, upperNeckPath·anchors 확보) → 본체 파생.
    const stand = window.designCollar.computeStand(window.bodiceCheckpoint.latest(project), cd.parameters.stand, cd.construction);
    if (!stand.ok) return stand;
    const r = window.designCollar.computeBody(stand, bodyParams);
    if (!r.ok) return r;
    cd.body = { parameters: bodyParams, geometry: r.bodyGeometry, attachLenCm: r.attachLenCm, measure: r.measure, anchors: r.anchors };   // anchors = 표시 전용(hash 미포함)
    return { ok: true, result: r };
  }
  function setCollarBodyNote(t) { const n = document.getElementById("designCollarBodyNote"); if (n) n.textContent = t; }
  function collarBodyFailStr(reason) {
    const m = { "invalid-stand": "스탠드를 먼저 적용", "invalid-cb-width": "CB 칼라 폭 값 확인(1–15)", "invalid-point-diagonal": "칼라 끝 사선 길이는 앞끝 돌출보다 커야 합니다", "invalid-gap": "CB 제도 간격 확인", "cb-correction-failed": "위칼라 이음선 길이를 밴드와 맞출 수 없습니다", "invalid-front-projection": "칼라 앞끝 돌출 값 확인(0–15)", "invalid-outer-bow": "외곽 휨 값 확인(−2–2)", "self-intersection": "칼라 형상이 교차합니다 · 값을 조정하세요", "no-module": "" };
    return m[reason] || "칼라 본체를 적용할 수 없습니다";
  }
  function onApplyCollarBody() {
    const project = designProjectNow(); if (!project) return;
    if (!collarStandReady(project)) { setCollarBodyNote("카라 스탠드를 먼저 적용하세요"); return; }
    const w = readNum("inpCollarBodyWidth", 1, 15), fw = readNum("inpCollarBodyFrontWidth", 1, 15), proj = readNum("inpCollarBodyProjection", 0, 15), bow = readNum("inpCollarBodyBow", -2, 2);
    if (!w.valid || !fw.valid || !proj.valid || !bow.valid) { setCollarBodyNote("칼라 본체 값 범위를 확인하세요(CB 폭·끝 사선 1–15·앞끝 돌출 0–15·외곽 휨 −2–2)"); return; }
    // CB 제도 간격(gap)은 입력이 없으므로 기존 커밋값(없으면 교재 M 기준)을 유지한다.
    const prevBody = committedCollarBody(project), pd = collarPresetDefaults();
    if (!pd.ok) { setCollarBodyNote("적용 불가: " + collarFailStr(pd.reason)); return; }
    const gapCm = (prevBody.has && prevBody.params && prevBody.params.gapCm != null) ? prevBody.params.gapCm : pd.body.gapCm;   // 선택 프리셋 body 기본값
    const r = deriveCollarBody(project, { gapCm: gapCm, cbWidthCm: w.v, frontProjectionCm: proj.v, pointDiagonalCm: fw.v, outerBowCm: bow.v });
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
    if (!isTwoPieceCollar(project)) { syncCollarKindRows(project); return; }   // 한 장/단독 스탠드: 밴드/본체 UI 자체가 없다
    const ready = collarStandReady(project), cb = committedCollarBody(project);
    const setIf = (id, v) => { const el = document.getElementById(id); if (el && document.activeElement !== el) el.value = fmtL(v); };
    const pd = collarPresetDefaults();   // 선택 제도형 body 기본값(미구현이면 기본값 없음 → 입력 유지)
    const p = cb.has ? cb.params : (pd.ok ? pd.body : null);
    if (p) {
      setIf("inpCollarBodyWidth", p.cbWidthCm); setIf("inpCollarBodyFrontWidth", p.pointDiagonalCm);
      setIf("inpCollarBodyProjection", p.frontProjectionCm);
      setIf("inpCollarBodyBow", p.outerBowCm != null ? p.outerBowCm : 0);
    }
    const applyBtn = document.getElementById("btnApplyCollarBody"), resetBtn = document.getElementById("btnResetCollarBody");
    if (applyBtn) applyBtn.disabled = !ready || !pd.ok;   // 미구현 제도형에서는 본체 적용 불가
    if (resetBtn) resetBtn.disabled = !cb.has;
    if (!ready) setCollarBodyNote("카라 스탠드 적용 후 본체를 생성할 수 있습니다");
    else if (!pd.ok) setCollarBodyNote(collarSelectionStr(pd.reason) + (cb.has ? " · 현재 본체 형상은 그대로 유지" : ""));
    else if (collarBodyManual(project)) {
      if (collarBodyInvalid(project)) setCollarBodyNote("칼라 본체 편집 무효 · " + collarBodyReasonStr(project.working.collarDraft.body.invalidReason) + " · 편집 복구 또는 기본형으로 돌아가기");
      else { const m = cb.measure || {}; setCollarBodyNote("칼라 본체 직접 수정 중 · endpoint 고정 · 외곽·포인트 anchor·핸들 편집 · 포인트 사선 " + fmtL(m.pointDiagonalLenCm || 0) + "cm · 외곽선 " + fmtL(m.outerEdgeLenCm || 0) + "cm"); }
    }
    // 읽기 전용 실제 결과: CB 폭·앞쪽 폭·앞끝 접선 돌출·포인트 사선 길이(=앞폭·투영 합성)·앞끝 기울기.
    //   ★ 기울기는 부착선 로컬 접선 기준 평면 기하값(캔버스 축·착용 spread 아님). frontRise 와 무관.
    else if (cb.has && cb.measure && cb.measure.cbWidthCm != null) { const m = cb.measure;
      setCollarBodyNote("위칼라 이음선 " + fmtL(cb.attachLenCm) + "cm = 밴드 윗선 " + fmtL(m.bandAttachLenCm) + "cm(뒤중심 보정 " + fmtL(m.cbCorrectionCm) + "cm) · gap " + fmtL(m.gapCm) + " · CB 폭 " + fmtL(m.cbWidthCm) + " · 앞끝 돌출 " + fmtL(m.frontProjectionCm) + "cm · 끝 사선 " + fmtL(m.pointDiagonalLenCm) + "cm · 외곽 휨 " + fmtL(m.outerBowCm) + "cm(외곽선 " + fmtL(m.outerEdgeLenCm) + "cm) · 세션 전용");
    }
    else setCollarBodyNote("CB 폭·끝 사선·앞끝 돌출·외곽 휨 적용으로 위 칼라 생성(밴드 윗선 ⒸⒹ 에 이음) · 세션 전용");
    syncCollarBodyModeUI(project);
    updateCollarCheckpointUI(project);
    updateCollarDraftSummary(project);
  }

  // ── 카라 제도 보조수치(표시 전용) ── collarAnnotation.buildModel 이 named anchors·parameters·measures 로 만든
  //   표시 모델을 캔버스 오버레이(render.js)와 읽기 전용 패널이 소비한다. 형상·hash·게이트와 무관.
  //   토글 상태는 체크박스 DOM 하나(세션 UI) — 저장·hash 에 넣지 않는다.
  function collarAnnotationModel(project) {
    if (!project || !window.collarAnnotation || collarStale(project)) return null;
    const bodice = window.bodiceCheckpoint ? window.bodiceCheckpoint.latest(project) : null;
    return window.collarAnnotation.buildModel(project.working.collarDraft, bodice);
  }
  // render.js 가 읽는다: design stage · 카라 서브탭 · 토글 ON · 모델 있음 일 때만 모델, 그 외 null.
  function collarAnnotationForRender() {
    if (!isDesignStageActive() || currentDesignSubtab() !== "collar") return null;
    const chk = document.getElementById("chkCollarDraftDims"); if (!chk || !chk.checked) return null;
    return collarAnnotationModel(designProjectNow());
  }
  function fmtCm(v) { return v == null ? "—" : (Math.round(v * 100) / 100).toFixed(2); }
  function fillDraftList(listId, rows) {
    const dl = document.getElementById(listId); if (!dl) return;
    const nodes = [];
    rows.forEach(r => {
      const dt = document.createElement("dt"); dt.textContent = r.label;
      const dd = document.createElement("dd"); dd.setAttribute("data-key", r.key);
      dd.textContent = r.text != null ? r.text : (r.value == null ? "—" : fmtCm(r.value) + " " + (r.unit || "cm"));
      if (r.status === "match") { dd.textContent += " · 정합"; dd.setAttribute("data-status", "match"); }
      else if (r.status === "mismatch") dd.setAttribute("data-status", "mismatch");
      nodes.push(dt, dd);
    });
    dl.replaceChildren.apply(dl, nodes);
  }
  function updateCollarDraftSummary(project) {
    const model = collarAnnotationModel(project);
    const note = document.getElementById("collarDraftModeNote");
    fillDraftList("collarDraftInputs", model ? model.inputs : []);
    fillDraftList("collarDraftResults", model ? model.results : []);
    if (note) note.textContent = !model ? "카라 스탠드 적용 후 표시" : (model.note || "");
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
    const twoPiece = isTwoPieceCollar(project);
    const manual = twoPiece && collarBodyManual(project), ready = collarStandReady(project), hasBody = committedCollarBody(project).has;
    const manualBtn = document.getElementById("btnCollarBodyManual"), revertBtn = document.getElementById("btnCollarBodyRevert");
    if (manualBtn) { manualBtn.hidden = !twoPiece || manual; manualBtn.disabled = !(twoPiece && ready && hasBody && !manual); }
    if (revertBtn) revertBtn.hidden = !twoPiece || !manual;
    // 입력은 manual 이면 잠금·아니면 해제(다른 disable 조건 없음). 부착선이 스탠드에 고정되므로 스탠드 입력도 잠금.
    ["inpCollarStandHeight", "inpCollarFrontRise", "inpCollarBodyWidth", "inpCollarBodyFrontWidth", "inpCollarBodyProjection", "inpCollarBodyBow"]
      .forEach(id => { const el = document.getElementById(id); if (el) el.disabled = manual; });
    // 적용/초기화 버튼은 기존 gate/ready 상태 위에 manual 잠금을 얹는다(manual 이면 무조건 disabled).
    if (manual) ["btnApplyCollar", "btnResetCollar", "btnApplyCollarBody", "btnResetCollarBody"].forEach(id => { const el = document.getElementById(id); if (el) el.disabled = true; });
    // ★ 교재 M 기본형 버튼은 **양방향** 상태를 여기서 단일 관리한다(manual 진입 시 disable, 수치형 복귀 시 re-enable).
    //   조건 = gate 통과 + manual 아님. updateCollarPanel·updateCollarBodyPanel·manual 진입/복귀 전 경로가 이 함수를 거친다.
    const baseM = document.getElementById("btnCollarBaseM");
    const selectable = !manual && collarGateOk(project);
    if (baseM) baseM.disabled = !selectable || !resolveCollarSelection().ok;   // 관리형 직접 편집 중·미구현 제도형에서는 초기화 금지
    ["selCollarPreset", "selCollarFamily"].forEach(id => { const el = document.getElementById(id); if (el) el.disabled = !selectable; });
  }

  // ── 카라 모양 완료 체크포인트(collarCheckpoint) ──
  function collarCPFailStr(reason) {
    const m = { "no-bodice": "몸판 완료 필요", "bodice-stale": "몸판 변경됨 · 다시 완료 필요", "no-collar": "카라 적용 필요",
      "source-mismatch": "카라 출처가 몸판 완료본과 다름", "no-sleeve": "소매 완료 필요(작업 순서)", "sleeve-stale": "소매 변경됨 · 작업 순서 확인",
      "no-stand": "스탠드 적용 필요", "no-standalone": "스탠드 칼라 적용 필요", "no-body": "본체 적용 필요", "body-invalid": "본체 편집 무효 · 복구 필요", "manual-line-missing": "관리형 본체 선 없음",
      "attach-length-mismatch": "달림선 실측이 목둘레와 다름(길이 책임)", "break-line-missing": "몸판 앞 꺾임선 출처 없음",
      "no-tip": "칼라 끝 적용 필요", "tip-unmeasured": "칼라 끝 측정 불가", "tip-length-mismatch": "칼라 끝 수치가 형상과 다름", "tip-recompute": "칼라 끝 재계산 실패",
      "no-flat-collar": "플랫 칼라 적용 필요", "flat-recompute": "플랫 칼라 재계산 실패",
      "attach-not-shorter": "달림선이 몸판 목둘레보다 짧지 않음", "shoulder-overlap-mismatch": "어깨 겹침이 형상과 다름",
      "no-sailor-collar": "세일러 칼라 적용 필요", "sailor-recompute": "세일러 칼라 재계산 실패",
      "no-bow-collar": "보 칼라 적용 필요", "bow-recompute": "보 칼라 재계산 실패",
      "no-frill-collar": "프릴 칼라 적용 필요", "frill-recompute": "프릴 칼라 재계산 실패",
      "no-hood": "후드 적용 필요", "hood-recompute": "후드 재계산 실패",
      "no-tailored-collar": "테일러드 칼라 적용 필요", "tailored-recompute": "테일러드 칼라 재계산 실패",
      "collar-stand-mismatch": "칼라 허리가 형상과 다름", "lapel-width-mismatch": "라펠 폭이 형상과 다름",
      "collar-tip-mismatch": "칼라 끝 정삼각형이 형상과 다름", "stand-remainder-mismatch": "1-❸ 표기가 칼라 허리 파생값과 다름",
      "lapel-link-missing": "라펠·꺾임선 파생 기록 없음",
      "front-attach-mismatch": "앞 달림선이 몸판 앞 목둘레와 다름", "back-attach-mismatch": "뒤 달림선이 몸판 뒤 목둘레와 다름",
      "hood-width-mismatch": "후드 폭이 머리 둘레 파생값과 다름", "hood-length-mismatch": "후드 길이가 후드 치수 파생값과 다름",
      "top-straight-mismatch": "윗변 직선이 형상과 다름", "snp-radius-mismatch": "SNP 반원 반지름이 형상과 다름",
      "hood-guide-missing": "후드 안내선 없음",
      "gather-length-mismatch": "개더용 재단 길이가 목둘레 배율과 다름", "spread-mismatch": "플레어 전개량이 설정과 다름", "slash-lines-missing": "절개·전개 보조선 없음",
      "attach-end-mismatch": "칼라 달림 끝 위치가 형상과 다름", "ribbon-length-mismatch": "리본 길이가 형상과 다름",
      "total-length-mismatch": "칼라 전체 길이가 달림선+리본과 다름", "attach-end-mark-missing": "칼라 달림 끝 표시 없음",
      "back-outer-mismatch": "뒤 칼라 외곽이 형상과 다름", "shoulder-width-mismatch": "어깨 칼라 폭이 형상과 다름",
      "back-corner-not-square": "뒤 칼라 외곽이 뒤 중심선에 직각이 아님",
      "shoulder-mark-missing": "어깨선 표시 없음", "collar-width-mismatch": "칼라 폭이 형상과 다름",
      "front-end-mismatch": "앞 끝선 길이가 형상과 다름", "front-end-offset-mismatch": "칼라 끝 안내선 거리가 형상과 다름",
      "shoulder-butt-missing": "어깨 맞댐선 없음",
      "no-joined": "밴드+위 칼라 적용 필요", "joined-recompute": "밴드+위 칼라 재계산 실패", "outer-back-mismatch": "외곽 뒤 구간이 뒤 목둘레와 다름", "front-width-mismatch": "앞 칼라 폭이 형상과 다름", "cb-height-mismatch": "CB 전체 높이가 밴드+위 칼라 폭과 다름",
      "seam-length-mismatch": "위칼라 이음선·밴드 길이 불일치", "gap-missing": "CB 제도 간격 없음", "extension-included": "앞 끝선 연장이 이음선에 포함됨", "unmeasured": "측정 불가", "no-project": "프로젝트 없음", "no-module": "" };
    if (m[reason] != null) return m[reason];
    if (reason && reason.indexOf("sailor-") === 0) return "세일러 칼라 형상 오류(" + reason.slice(7) + ")";
    if (reason && reason.indexOf("bow-") === 0) return "보 칼라 형상 오류(" + reason.slice(4) + ")";
    if (reason && reason.indexOf("frill-") === 0) return "프릴 칼라 형상 오류(" + reason.slice(6) + ")";
    if (reason && reason.indexOf("hood-") === 0) return "후드 형상 오류(" + reason.slice(5) + ")";
    if (reason && reason.indexOf("tailored-") === 0) return "테일러드 칼라 형상 오류(" + reason.slice(9) + ")";
    if (reason && reason.indexOf("flat-") === 0) return "플랫 칼라 형상 오류(" + reason.slice(5) + ")";
    if (reason && reason.indexOf("joined-") === 0) return "밴드+위 칼라 형상 오류(" + reason.slice(7) + ")";
    if (reason && reason.indexOf("standalone-") === 0) return "스탠드 칼라 형상 오류(" + reason.slice(11) + ")";
    if (reason && reason.indexOf("stand-") === 0) return "스탠드 형상 오류(" + reason.slice(6) + ")";
    if (reason && reason.indexOf("body-") === 0) return "본체 형상 오류(" + reason.slice(5) + ")";
    return reason;
  }
  function updateCollarCheckpointUI(project) {
    const checkNote = document.getElementById("designCollarCheckNote");
    const statusNote = document.getElementById("designCollarStatusNote");
    const btn = document.getElementById("btnCompleteCollar");
    if (!project || !window.collarCheckpoint) { if (btn) btn.disabled = true; if (checkNote) checkNote.textContent = ""; if (statusNote) statusNote.textContent = "카라 미완료 · 세션 전용"; return; }
    const c = window.collarCheckpoint.check(project), cd = project.working.collarDraft;
    if (checkNote && cd && cd.type === "shirt-one-piece") {
      const m = (cd.onePiece && cd.onePiece.measure) || null;
      checkNote.textContent = m ? "한 장 칼라: 달림선 " + fmtL(m.attachLenCm) + "·목둘레 " + fmtL(m.neckTargetCm) + "·꺾임선 " + fmtL(m.foldLenCm) + "·외곽 " + fmtL(m.outerLenCm) + "cm" : "";
    }
    else if (checkNote && cd && cd.type === "shirt-wing-collar") {
      const b = cd.measure || null, t = (cd.tip && cd.tip.measure) || null;
      checkNote.textContent = (b && t) ? "윙 칼라: 달림선 " + fmtL(b.lowerNeckSeamLenCm) + "·목둘레 " + fmtL(b.neckTargetCm) + "·꺾임선 " + fmtL(b.upperNeckSegmentLenCm) + "cm · 칼라 끝 밑변 " + fmtL(t.foldBaseLenCm) + "·앞변 " + fmtL(t.tipEdgeLenCm) + "·후퇴 " + fmtL(t.tipSetbackLenCm) + "cm" : "";
    }
    else if (checkNote && cd && cd.type === "sailor-collar") {
      const m = (cd.sailor && cd.sailor.measure) || null;
      const sym = collarDraftSymbol(cd);
      checkNote.textContent = m ? "세일러 칼라" + (sym ? " " + sym : "") + ": V 목선 " + fmtL(m.vNeckLenCm) + "·달림선 " + fmtL(m.attachLenCm) + "·목둘레 " + fmtL(m.neckTargetCm) + "cm(부족 " + fmtL(m.attachShortfallCm) + ") · 어깨 겹침 " + fmtL(m.shoulderTipGapCm) + "cm · 뒤 중심 " + fmtL(m.cbWidthLenCm) + "·뒤 외곽 " + fmtL(m.backOuterLenCm) + "(모서리 " + fmtL(m.backCornerAngleDeg) + "°)·어깨 폭 " + fmtL(m.shoulderWidthLenCm) + "cm · 외곽 " + fmtL(m.outerLenCm) + "cm" : "";
    }
    else if (checkNote && cd && cd.type === "bow-collar") {
      const m = (cd.bow && cd.bow.measure) || null;
      const sym = collarDraftSymbol(cd);
      checkNote.textContent = m ? "보 칼라" + (sym ? " " + sym : "") + ": 달림선 " + fmtL(m.attachLenCm) + "·×+⊠ " + fmtL(m.neckTargetCm) + "cm(뒤목 " + fmtL(m.backNeckLenCm) + "+앞 달림 " + fmtL(m.frontAttachLenCm) + ") · 칼라 달림 끝 " + fmtL(m.attachEndFromCfCm) + "cm · 리본 " + fmtL(m.ribbonLenCm) + "·칼라 폭 " + fmtL(m.collarWidthLenCm) + "·전체 " + fmtL(m.totalLenCm) + "cm" : "";
    }
    else if (checkNote && cd && cd.type === "frill-collar") {
      const m = (cd.frill && cd.frill.measure) || null;
      const sym = collarDraftSymbol(cd);
      checkNote.textContent = m ? "프릴 칼라" + (sym ? " " + sym : "") + ": " + frillCollarSummary(m).replace(" · 세션 전용", "") : "";
    }
    else if (checkNote && cd && cd.type === "hood") {
      const m = (cd.hood && cd.hood.measure) || null;
      checkNote.textContent = m ? "후드 d: 달림선 " + fmtL(m.attachLenCm) + "·몸판 목둘레 " + fmtL(m.neckTargetCm) + "cm(앞 " + fmtL(m.frontAttachLenCm) + "·뒤 " + fmtL(m.backAttachLenCm) + ") · 폭 " + fmtL(m.hoodWidthCm) + "·길이 " + fmtL(m.hoodLengthCm) + "cm · 뒤 중심선 " + fmtL(m.cbLenCm) + "·윗변 " + fmtL(m.topStraightLenCm) + "cm" : "";
    }
    else if (checkNote && cd && cd.type === "tailored-collar") {
      const m = (cd.tailored && cd.tailored.measure) || null;
      const sym = collarDraftSymbol(cd);
      checkNote.textContent = m ? "테일러드 칼라" + (sym ? " " + sym : "") + ": 뒤 달림선 " + fmtL(m.backAttachLenCm) + "·뒤 목둘레 " + fmtL(m.backNeckLenCm) + "cm(누임 " + fmtL(m.layDownAngleDeg) + "°) · 칼라 허리 " + fmtL(m.cbStandLenCm) + "·폭 " + fmtL(m.cbWidthLenCm) + "·라펠 " + fmtL(m.lapelWidthLenCm) + "cm · 칼라 끝 " + fmtL(m.collarTipToLapelCm) + "cm · 외곽 " + fmtL(m.outerLenCm) + "cm" : "";
    }
    else if (checkNote && cd && cd.type === "flat-collar-overlap") {
      const m = (cd.flat && cd.flat.measure) || null;
      checkNote.textContent = m ? "플랫 칼라 T: 달림선 " + fmtL(m.attachLenCm) + "·몸판 목둘레 " + fmtL(m.neckTargetCm) + "cm(부족 " + fmtL(m.attachShortfallCm) + ") · 어깨 겹침 " + fmtL(m.shoulderTipGapCm) + "cm · 칼라 폭 뒤중심 " + fmtL(m.cbWidthLenCm) + "·어깨 " + fmtL(m.shoulderWidthLenCm) + "cm · 앞 끝선 " + fmtL(m.frontEndLenCm) + "·안내선 " + fmtL(m.frontEndOffsetLenCm) + "cm · 외곽선 " + fmtL(m.outerLenCm) + "cm" : "";
    }
    else if (checkNote && cd && cd.type === "flat-collar") {
      const m = (cd.flat && cd.flat.measure) || null;
      checkNote.textContent = m ? "플랫 칼라: 달림선 " + fmtL(m.attachLenCm) + "·몸판 목둘레 " + fmtL(m.neckTargetCm) + "cm · 칼라 폭 뒤중심 " + fmtL(m.cbWidthLenCm) + "·어깨 " + fmtL(m.shoulderWidthLenCm) + "cm · 앞 끝선 " + fmtL(m.frontEndLenCm) + "·안내선 " + fmtL(m.frontEndOffsetLenCm) + "cm · 외곽선 " + fmtL(m.outerLenCm) + "cm" : "";
    }
    else if (checkNote && cd && cd.type === "shirt-band-one-piece") {
      const m = (cd.joined && cd.joined.measure) || null;
      checkNote.textContent = m ? "밴드+위 칼라 한 장: 달림선 " + fmtL(m.lowerNeckSeamLenCm) + "·목둘레 " + fmtL(m.neckTargetCm) + "·이음선 자리 " + fmtL(m.bandTopLenCm) + "cm · 외곽 뒤 " + fmtL(m.outerBackLenCm) + "(뒤 목둘레 " + fmtL(m.backNeckLenCm) + ")·앞 " + fmtL(m.outerFrontLenCm) + "·전체 " + fmtL(m.outerLenCm) + "cm · 앞 칼라 폭 " + fmtL(m.frontEdgeLenCm) + "·CB " + fmtL(m.cbHeightCm) + "cm" : "";
    }
    else if (checkNote && cd && cd.type === "shirt-open-collar") {
      const m = (cd.openCollar && cd.openCollar.measure) || null;
      checkNote.textContent = m ? "오픈 칼라: 달림선 " + fmtL(m.attachLenCm) + "·목둘레 " + fmtL(m.neckTargetCm) + "·기초선 " + fmtL(m.baseLineLenCm) + "·꺾임선 " + fmtL(m.foldLenCm) + "·외곽 " + fmtL(m.outerLenCm) + "cm · 몸판 꺾임선 " + fmtL(m.breakLineLenCm) + "cm" : "";
    }
    else if (checkNote && cd && cd.type === "stand-collar") {
      const m = (cd.standalone && cd.standalone.measure) || null;
      const preset = cd.presetId && window.collarPresets ? window.collarPresets.get(cd.presetId) : null;
      checkNote.textContent = m ? (preset ? preset.label : "스탠드 칼라") + ": 달림선 " + fmtL(m.attachLenCm) + "·목둘레 " + fmtL(m.neckTargetCm) + "·폭 " + fmtL(m.collarWidthCm) + "·앞올림 " + fmtL(m.frontRiseCm) + "·윗끝물림 " + fmtL(m.topSetbackCm) + "cm" + (m.frontExtensionCm > 0 ? "·앞끝연장 " + fmtL(m.frontExtensionCm) + "cm" : "") + (m.spreadEachCm > 0 ? "·벌림 " + fmtL(m.spreadEachCm) + "cm×" + m.spreadCount : "") + (m.cbTrimCm > 0 ? "·CB보정 " + fmtL(m.cbTrimCm) + "cm" : "") : "";
    }
    else if (checkNote) {
      if (cd && cd.measure && cd.body && cd.body.measure) {
        const sm = cd.measure, bm = cd.body.measure, bp = cd.body.parameters || {};
        checkNote.textContent = "스탠드: 목 봉제 " + fmtL(sm.lowerNeckSeamLenCm) + "·연장 " + fmtL(sm.lowerExtensionLenCm) + "·윗선 " + fmtL(sm.upperNeckSegmentLenCm) + "cm · 본체: 부착 " + fmtL(cd.body.attachLenCm) + "·CB폭 " + fmtL(bm.cbWidthCm != null ? bm.cbWidthCm : bp.cbWidthCm) + "·gap " + fmtL(bm.gapCm != null ? bm.gapCm : bp.gapCm) + "·끝 사선 " + fmtL(bm.pointDiagonalLenCm) + "·외곽 " + fmtL(bm.outerEdgeLenCm) + "cm";
      } else checkNote.textContent = c.fails.length ? "완료 전 검사: " + collarCPFailStr(c.fails[0]) : "";
    }
    if (btn) btn.disabled = !c.ok;
    const latest = window.collarCheckpoint.latest(project);
    if (statusNote) {
      if (!latest) statusNote.textContent = c.ok ? "완료 가능 · 세션 전용" : "완료 전 검사: " + collarCPFailStr(c.fails[0]);
      else if (window.collarCheckpoint.invalidatedByBodice(project)) statusNote.textContent = "몸판 변경으로 카라 무효 · 다시 완료 필요";
      else if (window.collarCheckpoint.isCurrentCollarChanged(project)) statusNote.textContent = "카라 변경됨 · 다시 완료 필요 · 세션 전용";
      else if (window.collarCheckpoint.sleeveStepChanged(project)) statusNote.textContent = "카라 완료됨 · 소매 단계 변경됨 · 작업 순서 확인 필요";
      else statusNote.textContent = "카라 완료됨(원형 v" + (latest.sourceBlock.version != null ? latest.sourceBlock.version : "?") + ") · 세션 전용";
    }
    updateDesignResultUI(project);   // 카라 완료 상태는 Design 통합 게이트에 영향 → 함께 갱신
  }
  function onCompleteCollar() {
    const project = designProjectNow(); if (!project || !window.collarCheckpoint) return;
    const r = window.collarCheckpoint.complete(project);
    const statusNote = document.getElementById("designCollarStatusNote");
    if (!r.ok) { if (statusNote) statusNote.textContent = "완료 불가: " + collarCPFailStr(r.reason); updateCollarCheckpointUI(project); return; }
    updateCollarCheckpointUI(project);
    if (statusNote) statusNote.textContent = r.idempotent ? "카라 완료됨(변경 없음) · 세션 전용" : "카라 완료됨(원형 v" + (r.result.sourceBlock.version != null ? r.result.sourceBlock.version : "?") + ") · 세션 전용";
  }

  // ── Design 형상 통합 완료(designResult) — 몸판+소매+카라 형상 패키지. 재단 패턴 아님. ──
  function designResultFailStr(reason) {
    const m = { "no-bodice": "몸판 완료 필요", "bodice-changed": "몸판 변경됨 · 다시 완료 필요", "no-sleeve": "소매 완료 필요",
      "sleeve-changed": "소매 변경됨 · 다시 완료 필요", "sleeve-bodice-mismatch": "소매 출처가 몸판과 다름", "no-collar": "카라 완료 필요",
      "collar-changed": "카라 변경됨 · 다시 완료 필요", "collar-bodice-mismatch": "카라 출처가 몸판과 다름", "collar-sleeve-order": "카라 소매 순서 확인 필요",
      "sleeve-source-mismatch": "소매 출처가 몸판과 다름", "collar-source-mismatch": "카라 출처가 몸판과 다름", "no-project": "프로젝트 없음", "no-module": "" };
    return m[reason] != null ? m[reason] : reason;
  }
  function updateDesignResultUI(project) {
    const checkNote = document.getElementById("designResultCheckNote");
    const statusNote = document.getElementById("designResultStatusNote");
    const btn = document.getElementById("btnCompleteDesign");
    if (!project || !window.designResult) { if (btn) btn.disabled = true; if (checkNote) checkNote.textContent = ""; if (statusNote) statusNote.textContent = "Design 미완료 · 세션 전용"; return; }
    const c = window.designResult.check(project);
    if (checkNote) checkNote.textContent = c.ok ? ("몸판·소매·카라 완료 · 유효 절개선 " + c._cuts.length + "개") : ("완료 전 검사: " + designResultFailStr(c.fails[0]));
    if (btn) btn.disabled = !c.ok;
    const latest = window.designResult.latest(project);
    if (statusNote) {
      if (!latest) statusNote.textContent = c.ok ? "Design 완료 가능 · 세션 전용" : "완료 전 검사: " + designResultFailStr(c.fails[0]);
      else if (window.designResult.isCurrentDesignChanged(project)) statusNote.textContent = "Design 변경됨 · 다시 완료 필요 · 세션 전용";
      else statusNote.textContent = "Design 형상 완료됨(원형 v" + (latest.sourceBlock.version != null ? latest.sourceBlock.version : "?") + ") · 유효 절개선 " + latest.structuralLines.cut.length + "개 · 세션 전용";
    }
  }
  function onCompleteDesign() {
    const project = designProjectNow(); if (!project || !window.designResult) return;
    const r = window.designResult.complete(project);
    const statusNote = document.getElementById("designResultStatusNote");
    if (!r.ok) { if (statusNote) statusNote.textContent = "완료 불가: " + designResultFailStr(r.reason); updateDesignResultUI(project); return; }
    updateDesignResultUI(project);
    if (statusNote) statusNote.textContent = r.idempotent ? "Design 형상 완료됨(변경 없음) · 세션 전용" : "Design 형상 완료됨(원형 v" + (r.result.sourceBlock.version != null ? r.result.sourceBlock.version : "?") + ") · 유효 절개선 " + r.result.structuralLines.cut.length + "개 · 세션 전용";
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
    //   ★ 셔츠 목선 = 교재 셔츠 칼라 기본 목선 프리셋: 클릭 시 M 여유값을 채운다(앞·뒤 SNP +1cm,
    //     앞중심 FNP 1cm 내림, 뒤목 0, round scoop 1). 명시적 프리셋 선택이므로 기존 값을 덮는다
    //     (refresh 복원과 달리 카드 클릭은 사용자 의도). 곡선 형태는 round scoop 재사용.
    const neckCards = document.getElementById("necklineCards");
    if (neckCards) neckCards.querySelectorAll(".neck-card").forEach(c =>
      c.addEventListener("click", () => {
        if (c.disabled) return;
        const type = c.getAttribute("data-neck");
        setNeckType(type);
        if (type === "shirt" || type === "stand-f") {
          const setV = (id, v) => { const el = document.getElementById(id); if (el) el.value = fmtL(v); };
          if (type === "stand-f") {
            setV("inpNeckWidth", 3); setV("inpNeckFrontDepth", 3); setV("inpNeckBackDepth", 2); setV("inpNeckCurveAmount", 1);
          } else {
            setV("inpNeckWidth", 1); setV("inpNeckFrontDepth", 1); setV("inpNeckBackDepth", 0); setV("inpNeckCurveAmount", 1);
          }
        }
        syncBodyButtons();
      }));
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
      b.addEventListener("click", () => { if (!b.disabled) { setDesignSubtab(b.getAttribute("data-subtab-btn")); if (typeof render === "function") render(); } }));
    // 카라 제도 치수 표시 토글(세션 UI): 오버레이만 다시 그린다.
    const chkDims = document.getElementById("chkCollarDraftDims");
    if (chkDims) chkDims.addEventListener("change", () => { if (typeof render === "function") render(); });
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
    // 카라 종류·세부 제도 선택: 옵션은 catalog/registry 에서 생성(HTML 에 option 하드코딩 없음).
    //   선택 변경은 옵션·버튼 문구·입력 표시만 갱신하고 **collarDraft·완료본·몸판을 건드리지 않는다**.
    const famSel = document.getElementById("selCollarFamily"), presetSel = document.getElementById("selCollarPreset");
    if (famSel && presetSel && window.collarPresets && famSel.options.length === 0) {
      window.collarPresets.familyOptions().forEach(o => {
        const op = document.createElement("option"); op.value = o.value;
        op.textContent = o.label + (o.available ? "" : " · " + window.collarPresets.PENDING_SHORT);
        famSel.appendChild(op);
      });
      famSel.value = window.collarPresets.DEFAULT_FAMILY_ID;
      rebuildCollarVariantOptions();
      const onSelChange = () => { const pj = designProjectNow(); syncCollarPresetLabel(); if (pj) updateCollarPanel(pj); };
      famSel.addEventListener("change", () => { rebuildCollarVariantOptions(); onSelChange(); });
      presetSel.addEventListener("change", onSelChange);
    }
    syncCollarPresetLabel();
    const collarBaseM = document.getElementById("btnCollarBaseM");
    if (collarBaseM) collarBaseM.addEventListener("click", () => { if (!collarBaseM.disabled) onCollarBaseM(); });
    // 위 칼라: CB 폭·끝 사선·앞끝 돌출·외곽 휨 Enter 로 적용, 본체 적용/초기화.
    ["inpCollarBodyWidth", "inpCollarBodyFrontWidth", "inpCollarBodyProjection", "inpCollarBodyBow"].forEach(id => {
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
    // 카라 모양 완료(collarCheckpoint): 게이트 통과 시에만 활성.
    const completeCollar = document.getElementById("btnCompleteCollar");
    if (completeCollar) completeCollar.addEventListener("click", () => { if (!completeCollar.disabled) onCompleteCollar(); });
    // Design 형상 통합 완료(designResult): 세 완료본 일치 시에만 활성.
    const completeDesign = document.getElementById("btnCompleteDesign");
    if (completeDesign) completeDesign.addEventListener("click", () => { if (!completeDesign.disabled) onCompleteDesign(); });
    // cut 생성·삭제·역할 변경·편집 후 designLineTool 이 호출하는 훅 — 항상 현재 project 로 갱신(hidden 이어도).
    window.refreshDesignResultUI = () => updateDesignResultUI(designProjectNow());
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
  window.isDesignStageActive    = isDesignStageActive;
  window.collarAnnotationForRender = collarAnnotationForRender;   // render.js 카라 제도 보조수치 오버레이(표시 전용)   // render.js 등이 읽는 읽기 전용 신호
  window.refreshDesignBodyPanel = updateDesignBodyPanel;  // designLineTool 이 boundary 편집 후 목둘레·상태 갱신
  window.refreshFrontPlacket = () => refreshFrontPlacket();  // boundary 편집으로 유효 외곽 변경 시 여밈 재파생
  window.recomposeSleeveCap = recomposeSleeveCap;            // designLineTool 이 관리형 소매산 편집 후 소매 재합성
  window.recomposeCollarBody = recomposeCollarBody;          // designLineTool 이 관리형 칼라 본체 편집 후 본체 재합성
})();
