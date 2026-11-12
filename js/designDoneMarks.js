// ══════════════════════════════════════════════
// js/designDoneMarks.js — 디자인 단계 «완료» 표시(UI 전용 · 2026-11-10 김님 «소매 완료하고 카라로 넘어가면
//   외곽선이 몸판이랑 같이 테두리 선이 변경 · 카라도 끝났다는 걸 보여달라»).
//
// 무엇: 유효한 최신 완료본과 지금 형상이 일치할 때만
//   · 소매 외곽(working 소매 outline) · 커프스 재단 외곽(.sleeve-cuff-cut) → 몸판 수정 외곽과 같은 녹색(.design-outline-composed 와 같은 색·굵기)
//   · 카라 조각 외곽(완료본 종류의 조각만: 2피스 = 밴드·위 칼라 · 한 장 = 그 한 장 …) → 같은 녹색
//   · 조각 근처 작은 글자 «소매 완료» / «카라 완료»
//   완료본이 있는데 지금 형상·입력·몸판이 달라졌으면 녹색 없이 «소매 변경됨» / «카라 변경됨»(다시 완료 필요).
//   완료본이 없으면 아무 표시도 없다(탭에 들어갔다는 이유로 완료 처리하지 않는다).
//   · 몸판(2026-11-12 김님 «박시 A → 여밈 → 몸판 완료 하면 외곽선 색이 안 바뀐다»): 종전엔 몸판 녹색이 «합성 외곽(designOutline)이 있는가»에만
//     묶여 있어, 외곽 수정 없이 완료하면 색이 안 바뀌고 반대로 완료 전 합성 외곽은 녹색이었다. → 앞·뒤판의 «지금 외곽»(합성 외곽이 있으면 그 선,
//     없으면 working 재단 외곽)을 몸판 완료본 = 현재 형상일 때만 녹색 + «몸판 완료». 원래 몸판 맥락에서만(소매 Ⓡ~Ⓩ 파생 몸판·분리 조각 제외).
//
// 계약(제품 엔진 불변):
//   · 판정 = designResult.check 의 권위 체인 그대로(isCurrentSleeveChanged · invalidatedByBodice · isCurrentCollarChanged ·
//     sleeveStepChanged · 출처 hash) — 그 검사는 updateDesignResultUI(모든 디자인 갱신의 종점)가 이미 한 번 돌린다.
//     여기서는 그 결과를 받아 **캐시**만 하고, render 매 프레임에는 재검사하지 않는다(재제도 비용 0).
//   · 캐시는 project · 각 완료본 객체가 그대로일 때만 쓴다(완료본이 바뀌었는데 아직 갱신 전이면 표시하지 않음 — 거짓 완료 금지).
//   · geometry · 완료본 · hash · 저장 내용은 읽기만 한다. SVG 위에 class 와 글자만 덧붙인다(다음 render 가 새로 그리면 다시 붙인다).
//   · 접는선·꺾임선·제작 보조선·덧단 완성선은 녹색에 넣지 않는다(재단 외곽만).
// ══════════════════════════════════════════════
(function () {
  "use strict";

  // 카라 완료본 종류 → 그 종류가 그리는 조각 group(render.js data-design-collar). 남은 다른 종류 조각은 표시하지 않는다.
  const COLLAR_GROUPS = {
    "shirt-two-piece": ["stand", "body"], "shirt-one-piece": ["one-piece"], "shirt-open-collar": ["open"],
    "shirt-wing-collar": ["stand", "wing-tip"], "shirt-band-one-piece": ["band-one-piece"], "flat-collar": ["flat"],
    "flat-collar-overlap": ["flat"], "sailor-collar": ["sailor"], "bow-collar": ["bow"], "frill-collar": ["frill"],
    "hood": ["hood"], "tailored-collar": ["tailored"], "shawl-collar": ["shawl"], "stand-collar": ["standalone"]
  };
  const COLLAR_OUTLINE = "path.design-collar-stand, path.design-collar-body, path.design-collar-onepiece";
  const SLEEVE_BAD = ["no-bodice", "bodice-changed", "sleeve-changed", "sleeve-bodice-mismatch", "sleeve-source-mismatch"];
  const COLLAR_BAD = ["no-bodice", "bodice-changed", "collar-changed", "collar-bodice-mismatch", "collar-source-mismatch", "collar-sleeve-order"];

  // ── 순수: designResult.check 결과 → 단계 표시 상태 ── null(완료본 없음) | "done" | "changed"
  function stateOf(c) {
    if (!c || !c.fails) return { bodice: null, sleeve: null, collar: null };
    const has = list => list.some(f => c.fails.indexOf(f) >= 0);
    // 몸판(2026-11-12): 완료본이 있고 bodiceCheckpoint.isCurrentBodiceChanged(= "bodice-changed") 가 아니면 완료. 합성 외곽 유무·탭 진입과 무관.
    const bodice = !c._bodice ? null : has(["bodice-changed"]) ? "changed" : "done";
    const sleeve = !c._sleeve ? null : has(SLEEVE_BAD) ? "changed" : "done";
    const collar = !c._collar ? null : (has(COLLAR_BAD) || sleeve !== "done") ? "changed" : "done";
    return { bodice: bodice, sleeve: sleeve, collar: collar };
  }

  let st = null;   // {proj, bodiceRes, sleeveRes, collarRes, collarType, sleeve, collar}

  function update(proj, c) {
    if (!proj || !proj.working || !c) { st = null; apply(); return; }
    const w = proj.working, s = stateOf(c);
    st = { proj: proj, bodiceRes: w.bodiceResult || null, sleeveRes: w.sleeveResult || null, collarRes: w.collarResult || null,
      collarType: w.collarResult ? w.collarResult.type : null, bodice: s.bodice, sleeve: s.sleeve, collar: s.collar,
      original: originalCtx(proj) };
    apply();
  }
  // 화면의 앞·뒤판이 원래 몸판인가(소매 Ⓡ~Ⓩ 파생 몸판 맥락이 아니다) — designLineTool 의 같은 판정. update 때 한 번만(매 render 재판정 없음).
  //   판정 불가면 false(표시 안 함 — 파생 몸판에 원래 몸판 완료색을 묻히지 않는다).
  function originalCtx(proj) {
    const T = window.designLineTool;
    try { return !!(T && T.isOriginalBodiceContext && T.isOriginalBodiceContext(proj)); } catch (_) { return false; }
  }
  function current(proj) {
    if (!st || !proj || st.proj !== proj) return null;
    const w = proj.working || {};
    if (st.bodiceRes !== (w.bodiceResult || null) || st.sleeveRes !== (w.sleeveResult || null) || st.collarRes !== (w.collarResult || null)) return null;
    return st;
  }
  function projectNow() {
    const W = window.designWorkflow; let p = null;
    try { p = W && W.current ? W.current() : null; } catch (_) { p = null; }
    return p;
  }

  function cv() { return (typeof svg !== "undefined" && svg) ? svg : document.getElementById("cv"); }

  // 화면 기준 bbox(합집합) → svg 사용자 좌표
  function unionBox(root, els) {
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    els.forEach(el => { const q = el.getBoundingClientRect(); if (q.width <= 0 && q.height <= 0) return; l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom); });
    if (!(r > l) && !(b > t)) return null;
    const m = root.getScreenCTM && root.getScreenCTM(); if (!m) return null;
    const inv = m.inverse(), pt = root.createSVGPoint();
    pt.x = (l + r) / 2; pt.y = t; const top = pt.matrixTransform(inv);
    return { x: top.x, y: top.y };
  }
  function badge(root, kind, state, text, els) {
    const at = unionBox(root, els); if (!at) return;
    const NS = "http://www.w3.org/2000/svg";
    const g = document.createElementNS(NS, "g");
    g.setAttribute("data-done-badge", kind); g.setAttribute("data-state", state); g.setAttribute("class", "done-badge");
    g.setAttribute("aria-hidden", "true");
    const tx = document.createElementNS(NS, "text");
    tx.setAttribute("x", at.x); tx.setAttribute("y", at.y - 9); tx.setAttribute("text-anchor", "middle");
    tx.textContent = text;
    g.appendChild(tx); root.appendChild(g);
    let bb = null; try { bb = tx.getBBox(); } catch (_) { bb = null; }
    if (bb && bb.width > 0) {
      const rc = document.createElementNS(NS, "rect");
      rc.setAttribute("x", bb.x - 5); rc.setAttribute("y", bb.y - 2); rc.setAttribute("width", bb.width + 10); rc.setAttribute("height", bb.height + 4); rc.setAttribute("rx", 4);
      g.insertBefore(rc, tx);
    }
  }

  // 지금 SVG 에 표시를 붙인다(render 직후 · 상태 갱신 직후). 이전에 붙인 것은 먼저 걷어낸다.
  function apply() {
    const root = cv(); if (!root) return;
    root.querySelectorAll("[data-done-badge]").forEach(el => el.remove());
    root.querySelectorAll(".stage-done").forEach(el => el.classList.remove("stage-done"));
    root.querySelectorAll(".stage-undone").forEach(el => el.classList.remove("stage-undone"));
    const design = typeof window.isDesignStageActive === "function" && window.isDesignStageActive();
    if (!design) return;
    const s = current(projectNow()); if (!s) return;
    // 몸판: 원래 몸판 맥락에서만. 조각별로 «지금 외곽» = 합성 외곽(designOutline)이 있으면 그 선, 없으면 working 재단 외곽.
    //   완료 = 녹색 · 완료본 없음/변경됨 = 합성 외곽도 녹색이 아니다(녹색 = 완료 하나의 뜻 — 합성 버튼·외곽 수정 유무와 분리).
    //   분리 조각(parts)·외곽 미리보기·파생 몸판 재단선·여밈·접는선은 대상 아님.
    if (s.original) {
      const now = [];
      ["front", "back"].forEach(pc => {
        const comp = root.querySelectorAll('[data-design-outline="' + pc + '"] path.design-outline-composed');
        if (comp.length) { comp.forEach(el => { now.push(el); if (s.bodice !== "done") el.classList.add("stage-undone"); }); return; }
        root.querySelectorAll('[data-design-root="working"] [data-layout-piece="' + pc + '"] [data-design-layer="working"][data-geometry-role="outline"]').forEach(el => now.push(el));
      });
      if (s.bodice && now.length) {
        if (s.bodice === "done") now.forEach(el => el.classList.add("stage-done"));
        badge(root, "bodice", s.bodice, s.bodice === "done" ? "몸판 완료" : "몸판 변경됨 · 다시 완료", now);
      }
    }
    if (s.sleeve) {
      const els = Array.prototype.slice.call(root.querySelectorAll('[data-design-root="working"] [data-piece="sleeve"][data-geometry-role="outline"], .sleeve-cuff .sleeve-cuff-cut'));
      if (els.length) {   // 별도 소매 조각이 없는 일체형(Ⓧ·Ⓨ·Ⓩ)은 표시할 소매 외곽이 없다 → 표시 없음(몸판에 거짓 표시하지 않음)
        if (s.sleeve === "done") {
          els.forEach(el => el.classList.add("stage-done"));
          // «외곽 반영»으로 소매 외곽이 된 선(sleeveEdit.ops 의 lineId)은 완료본 외곽의 일부 — 남색 덧그림이 녹색 외곽을 가리지 않게 같은 녹색.
          //   반영 안 된 선·선택 중인 선(청록 우선)은 그대로.
          //   반영 뒤 선을 다시 움직였으면(= 반영본과 다른 선 · 아직 외곽 아님) 녹색에서 뺀다 — sleeveOutlineEdit.isApplied 와 같은 서명 비교.
          const ed = s.proj.working && s.proj.working.sleeveEdit, SS = window.sleeveSplit, T = window.designLineTool;
          if (ed && Array.isArray(ed.ops) && SS && SS.cutSig && T && T.findLine) ed.ops.forEach(o => {
            const line = o && o.lineId ? T.findLine(o.lineId) : null;
            if (!line || line.piece !== "sleeve" || SS.cutSig(line.segments) !== o.lineSig) return;
            root.querySelectorAll('path.design-line[data-piece="sleeve"][data-line-id="' + String(o.lineId).replace(/"/g, "") + '"]').forEach(p => { if (!p.classList.contains("selected")) p.classList.add("stage-done"); });
          });
        }
        badge(root, "sleeve", s.sleeve, s.sleeve === "done" ? "소매 완료" : "소매 변경됨 · 다시 완료", els);
      }
    }
    if (s.collar) {
      const groups = COLLAR_GROUPS[s.collarType] || [];
      const els = [];
      groups.forEach(gn => root.querySelectorAll('[data-design-root="collar"] [data-design-collar="' + gn + '"]').forEach(g => g.querySelectorAll(COLLAR_OUTLINE).forEach(p => els.push(p))));
      if (els.length) {
        if (s.collar === "done") els.forEach(el => el.classList.add("stage-done"));
        badge(root, "collar", s.collar, s.collar === "done" ? "카라 완료" : "카라 변경됨 · 다시 완료", els);
      }
    }
  }

  window.designDoneMarks = Object.freeze({ update: update, apply: () => { try { apply(); } catch (_) { /* 표시 전용 — 실패해도 도안에 영향 없음 */ } },
    stateOf: stateOf, COLLAR_GROUPS: COLLAR_GROUPS, peek: () => st ? { bodice: st.bodice, original: st.original, sleeve: st.sleeve, collar: st.collar, collarType: st.collarType } : null });
})();
