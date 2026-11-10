// ══════════════════════════════════════════════
// js/designLineQuickBar.js — 패턴선 «선 가까이» 빠른 도구막대(UI 전용 · 2026-11-05 김님 시안 «선 가까이» 승인).
//
// 무엇: 패턴 위, 지금 작업 대상 가까이에 작은 도구막대를 띄워 오른쪽 패널 왕복을 줄인다.
//   · 그리기 중(점 ≥1) → 캔버스 가장자리 고정 자리(dock · 2026-11-07 — 마지막 점·진행 방향을 비움)에 «그리기 취소» · «그리기 완료»(완료 가능 = designLineTool.canFinishDraw 그대로)
//   · 선 선택(정상 완료 직후 자동 선택 포함 · 기존 선 재선택) → 그 선 근처에 절개선 · 외곽 · 보조선(현재 역할 강조)
//   · 관리형 선(네크라인 전용 · 소매산 · 칼라 본체)은 역할 버튼 잠금(designLineTool 의 잠금 판정 그대로)
//   · 선택한 선이 절개선이면 별도 «다음 단계» 행에 «파트 분리»(2026-11-05 김님 요청) — 오른쪽 «파트 분리»와 **같은 판정**
//     (designLineTool.getSplitState = syncSplitButton 이 마지막으로 쓴 판정 · 재판정 없음)과 **같은 명령**(doSplit).
//     불가면 비활성 + 보이는 짧은 이유(무효 절개선 · 최종 몸판 미확정 · 파생 몸판 미지원 · 앞/뒤판 아님). 분리되면 «분리됨 · 파트 N개».
//   · 선택한 선이 외곽이면 별도 «다음 단계» 행에 «외곽 대체 미리보기»(2026-11-06 김님 «외곽 선택하면 외곽 대체 미리보기가 있어야지»)
//     — 오른쪽 «외곽 대체 미리보기»와 같은 판정(designLineTool.getBoundaryState = syncBoundaryStatus 가 마지막으로 쓴 판정)·같은 명령(doBoundaryPreview).
//     불가면 비활성 + 이유(무효 · 판정 보류 · 별도 소매 조각 없음 · 파생 몸판 미지원 · 카라). 보이면 «미리보기 표시 중»(완성 외곽 아님). 보조선 = 다음 단계 없음.
//
// 계약(제품 엔진 불변):
//   · 상태를 새로 갖지 않는다 — 매 render 직후 designLineTool 의 공개 상태(getMode·getDraft·getSelectedId·findLine·
//     canFinishDraw·잠금 판정)를 읽어 보이기만 한다. 저장 상태·선 생성·자동 역할 지정 없음.
//   · 버튼은 기존 명령만 부른다: finishDraw · cancel(= 오른쪽 «그리기 취소»와 같은 setMode("off")) · setRole.
//     오른쪽 버튼·id·단축키(Enter·Esc·Backspace·Delete)는 그대로이고, 둘 다 같은 명령이라 자동 동기화된다.
//   · UI 상태: «접기(×)» = 지금 선택한 선에 대해서만 막대를 접는다(선·선택 무변경). 캔버스를 다시 누르면 풀린다.
//     «도구»(소형 상태줄 → 전체 막대, 2026-11-05) = 분리 결과 확인용 상태줄을 그 결과에 대해서만 펼친다. 선택·결과 변화·캔버스 누름에 풀린다.
//   · 위치 기준 = **실제로 그려진 SVG**(선택 선 path · overlay 앵커/핸들 · 작성 중 preview/vertex)의 화면 좌표(getScreenCTM).
//     피스 offset·파생 몸판·카라 레이어·줌·팬이 무엇이든 화면에 그려진 선과 정합. 커서 위치는 쓰지 않는다(흔들림 없음).
//   · 배치 = 기준점 위/아래/오른쪽/왼쪽 후보 중 **선·앵커·핸들 점을 가리지 않는 첫 후보**(같으면 위 우선) → 캔버스 안으로 클램프.
//   · 캔버스 위 드래그(곡선 핸들·앵커 이동·팬·핀치) 중에는 숨기고, 손을 떼면 다시 계산한다.
//   · 막대는 #cv 의 형제(SVG 밖) → 막대 클릭은 캔버스 점 추가·피스 드래그로 전파되지 않는다.
// ══════════════════════════════════════════════
(function () {
  "use strict";

  const PIECE_LABEL = { front: "앞판", back: "뒤판", sleeve: "소매", collar: "카라" };
  const LOCK_TITLE = { neck: "네크라인 전용선 · 역할 고정", cap: "소매산 관리선 · 역할 고정", collar: "칼라 본체 관리선 · 역할 고정" };
  const GAP = 18;        // 기준점과 막대 사이(손가락·핸들 여유)
  const PAD = 12;        // 가림 판정 여유(막대 사각형을 이만큼 키워 점이 들어오면 «가림»)
  const MARGIN = 8;      // 캔버스 가장자리 여백
  const DRAG_PX = 4;     // 이 이상 움직이면 캔버스 드래그로 보고 숨김(designLineTool DRAG_PX 와 같은 값)

  // ── 순수: 도구 상태 → 막대 표시 모델 ──
  // s = {design, mode, draft:{piece,n}|null, canFinish, sel:{id,piece,role,lock}|null}
  function describe(s) {
    if (!s || !s.design) return null;
    if (s.mode === "draw" && s.draft && s.draft.n > 0) {
      return { kind: "draw", key: "draw", title: "그리기 · " + (PIECE_LABEL[s.draft.piece] || s.draft.piece) + " · 점 " + s.draft.n + "개", canFinish: !!s.canFinish };
    }
    if (s.mode === "select" && s.sel) {
      const lock = s.sel.lock || null;
      const role = s.sel.role || "guide";
      const sp = (!lock && role === "cut" && s.sel.split) ? s.sel.split : null;   // 절개선만 · 관리선·다른 역할은 분리 행 없음
      const split = sp ? { allowed: !!sp.allowed, kind: sp.kind, parts: sp.parts || 0,
        text: sp.allowed ? (sp.parts > 0 ? "분리됨 · 파트 " + sp.parts + "개(색으로 미리보기)" : "분리 가능") : "분리 불가 · " + sp.reason } : null;
      const bs = (!lock && role === "boundary" && s.sel.boundary && !(s.sel.reflect && s.sel.reflect.done)) ? s.sel.boundary : null;   // 몸판 외곽에 이미 반영된 선은 «대체 미리보기» 단계가 필요 없다(반영 = 합성까지 한 번에)   // 외곽만 · 관리선(네크라인 전용선 등)은 잠금 그대로
      // 단계(2026-11-06 소매 «외곽 반영»): preview(미리보기 전) → confirm(미리보기 확인 · 소매만 «외곽 반영») → applied(반영됨 · 수정 중 → «소매 모양 완료» 안내).
      //   몸판은 apply 가 없어 종전 그대로(preview·미리보기 표시 중).
      const stage = bs ? (bs.applied ? "applied" : (bs.shown && bs.apply) ? "confirm" : "preview") : null;
      const boundary = bs ? { allowed: !!bs.allowed, kind: bs.kind, shown: !!bs.shown, stage: stage,
        apply: bs.apply ? { allowed: !!bs.apply.allowed, reason: bs.apply.reason } : null, undo: !!bs.edit,
        text: stage === "applied" ? (bs.edit && bs.edit.pending ? "반영됨 · 수정 중 — 다 고치면 «소매 모양 완료»" : "반영됨 · 소매 외곽의 일부")
          : stage === "confirm" ? (bs.apply.allowed ? "미리보기 확인 · «외곽 반영»을 눌러야 소매에 반영됩니다" : "반영 불가 · " + bs.apply.reason)
          : bs.allowed ? (bs.shown ? "미리보기 표시 중 · 보라 외곽(완성 외곽 아님)" : bs.reason) : "대체 불가 · " + bs.reason } : null;
      // 옆선 행(2026-11-08): 권위 계측 숫자 + 몸판 완료 차단 사유·완료 버튼만(자동 길이 맞춤·자석·여유 설정 없음).
      const seam = (!lock && role === "boundary" && s.sel.seam && s.sel.seam.show) ? { text: s.sel.seam.text, bodice: s.sel.bodice || null } : null;
      const rf = (!lock && s.sel.reflect && !s.sel.reflect.done) ? { allowed: !!s.sel.reflect.allowed, text: s.sel.reflect.reason } : null;   // 몸판 외곽으로 반영(앞·뒤판 일반 선 · 아직 미반영일 때)
      return { kind: "select", reflect: rf, seam: seam, key: "sel:" + s.sel.id, title: lock ? LOCK_TITLE[lock] : "선택한 선 · " + (PIECE_LABEL[s.sel.piece] || s.sel.piece), role: role, locked: !!lock, split: split, boundary: boundary };
    }
    return null;
  }

  // ── 순수: 표시 형태(2026-11-05 · Codex 후속 «320×640 팝업이 분리 파트를 덮음») ──
  //   분리가 성공해 파트가 현재 결과로 보이는데(sp.allowed && parts>0) **전체 막대를 놓을 빈자리가 없으면**(배치 최소 가림 > 0)
  //   결과 확인용 소형 상태줄 «분리됨 · 파트 N개» + «도구»로 줄인다. «도구»를 누르면(expandedKey = 그 결과 키) 전체 막대로 복귀.
  //   미분리·실패·보류·그리기·관리선·넓은 화면(빈자리 있음)은 언제나 전체 막대(이유·분리 버튼이 보여야 한다).
  //   버튼을 구겨 작게 만들지 않는다 — 소형 상태줄의 «도구»도 44px.
  //   외곽 대체 미리보기가 보이는 것도 같은 «결과»(2026-11-06) — 소형 상태줄 «외곽 대체 미리보기 표시 중».
  function resultKey(vm) {
    const sp = vm && vm.kind === "select" ? vm.split : null, bd = vm && vm.kind === "select" ? vm.boundary : null;
    if (sp && sp.allowed && sp.parts > 0) return vm.key + ":parts" + sp.parts;
    if (bd && bd.allowed && bd.shown) return vm.key + ":bnd";
    return null;
  }
  function compactText(vm) {
    const sp = vm && vm.split;
    return (sp && sp.allowed && sp.parts > 0) ? "분리됨 · 파트 " + sp.parts + "개" : "외곽 대체 미리보기 표시 중 · «도구»에서 반영";
  }
  function chooseMode(vm, fullHits, expandedKey) {
    const k = resultKey(vm);
    return (k && fullHits > 0 && expandedKey !== k) ? "compact" : "full";
  }

  // ── 순수: 배치 ──
  // o = {bounds:{l,t,r,b}, size:{w,h}, refs:[{x,y}], obstacles:[{x,y}]} (모두 canvas-wrap 기준 px)
  // 반환 {x, y, hits, index} — 후보 순서: 각 기준점마다 위 · 아래 · 오른쪽 · 왼쪽. 가림 점 수가 가장 적은 첫 후보.
  function place(o) {
    const b = o.bounds, w = o.size.w, h = o.size.h;
    const clampX = x => Math.max(b.l, Math.min(x, b.r - w));
    const clampY = y => Math.max(b.t, Math.min(y, b.b - h));
    const cands = [];
    (o.refs || []).forEach(p => {
      cands.push({ x: p.x - w / 2, y: p.y - GAP - h });   // 위
      cands.push({ x: p.x - w / 2, y: p.y + GAP });       // 아래(위가 막히면 반전)
      cands.push({ x: p.x + GAP, y: p.y - h / 2 });       // 오른쪽
      cands.push({ x: p.x - GAP - w, y: p.y - h / 2 });   // 왼쪽
    });
    // 가림 대상 묶음(선·분리 파트) 바깥 네 방향(2026-11-05 소매 파트 분리) — 좁은 화면에서 선 주변 후보가 모두 파트를 덮을 때만 뽑힌다
    //   (동점이면 앞 후보 유지 → 선 주변에 빈자리가 있으면 종전 위치 그대로).
    const nRef = cands.length, ob = o.obstacles || [];
    if (ob.length) {
      let l = Infinity, r = -Infinity, t = Infinity, bt = -Infinity;
      ob.forEach(q => { l = Math.min(l, q.x); r = Math.max(r, q.x); t = Math.min(t, q.y); bt = Math.max(bt, q.y); });
      const mx = (l + r) / 2, my = (t + bt) / 2;
      cands.push({ x: mx - w / 2, y: bt + GAP }, { x: mx - w / 2, y: t - GAP - h }, { x: l - GAP - w, y: my - h / 2 }, { x: r + GAP, y: my - h / 2 });
    }
    (o.extra || []).forEach(c => cands.push({ x: c.x, y: c.y }));   // 호출부가 더하는 자리(소형 상태줄 = 캔버스 네 모서리) — 맨 뒤라 동점이면 앞 후보 우선
    let best = null;
    cands.forEach((c, i) => {
      const x = clampX(c.x), y = clampY(c.y);
      let hits = 0;
      (o.obstacles || []).forEach(q => { if (q.x >= x - PAD && q.x <= x + w + PAD && q.y >= y - PAD && q.y <= y + h + PAD) hits++; });
      if (!best || hits < best.hits) best = { x: x, y: y, hits: hits, index: i, around: i >= nRef };
    });
    return best;
  }

  // ── 순수: 선택 막대 붙박이(2026-11-09 김님 «팝업창이 계속 움직인다») ──
  // 같은 선을 선택한 동안에는 처음 고른 자리를 지킨다 — hover·rerender·설명줄 증감·값 갱신·핸들 드래그 뒤에도 그대로.
  // 다시 고르는 경우는 최소: (1) 다른 선 선택·닫기 후 재열기 (2) 보기(팬·줌)·캔버스 크기 변화 (3) 지금 자리가 선택 선·anchor·핸들을 가리게 됨.
  // 크기만 바뀌면 화면 안으로만 밀어 넣는다(clamp). o = {keep:{x,y}, bounds, size, essential:[{x,y}]} → {x,y} | null(다시 골라야 함)
  function keepPlace(o) {
    if (!o || !o.keep) return null;
    const b = o.bounds, w = o.size.w, h = o.size.h;
    const x = Math.max(b.l, Math.min(o.keep.x, b.r - w)), y = Math.max(b.t, Math.min(o.keep.y, b.b - h));
    const covers = (o.essential || []).some(q => q.x >= x - PAD && q.x <= x + w + PAD && q.y >= y - PAD && q.y <= y + h + PAD);
    return covers ? null : { x: x, y: y };
  }

  // ── 순수: 같은 선 동안의 자리 결정(2026-11-10 김님 «밑단 수정하는데 팝업이 아래·왼쪽·오른쪽으로 너무 움직여») ──
  // 원인(390 실측): 앵커를 막대 밑으로 끌어오면 keepPlace 가 null → place() 가 **지금 형상 기준으로 새 자리**를 골랐고,
  //   반영 행이 다시 생겨 막대가 커지자 또 새 자리, 되돌려도 새 자리가 기준이 돼 처음 자리로 안 돌아왔다(88,8 → 196,8 → 196,92).
  // 규칙: 같은 선을 고른 동안 선 주변 재채점(place)은 다시 하지 않는다.
  //   · 처음 자리(home)를 크기만 clamp 해서 쓴다 — 설명줄 증감·값 갱신·드래그(중엔 숨김) 뒤에도 그대로.
  //   · home 이 **잡는 점(앵커·핸들 점)**을 가릴 때만 캔버스 가장자리 고정 자리(dock)로 한 번 옮기고, 그 선 동안 거기 머문다
  //     (선 몸통을 조금 덮는 것은 옮길 이유가 아니다 — 메뉴가 도망가지 않는 쪽이 우선).
  //   · dock 자리가 다시 잡는 점을 가리면 그때만 다른 dock(같은 순서 · 동점이면 앞 자리).
  // o = {keep:{x,y,dock:index|null}, bounds, size, grab:[{x,y}], line:[{x,y}]} → {x, y, dock:index|null}
  function holdPlace(o) {
    const k = o.keep;
    if (k.dock == null) {
      const h = keepPlace({ keep: k, bounds: o.bounds, size: o.size, essential: o.grab });
      if (h) return { x: h.x, y: h.y, dock: null };
    }
    // 가장자리 자리: 잡는 점을 가장 덜 가리고 → 선 몸통 점을 덜 가리는 곳(같으면 DOCKS 순서).
    //   지금 dock 이 있으면 **엄격히 나아질 때만** 옮긴다(동점 왕복 flip 없음). 좁은 화면에서 어디도 다 비울 수 없으면 가장 덜 가리는 곳에 머문다.
    const b = o.bounds, w = o.size.w, hh = o.size.h, cx = Math.max(b.l, Math.round((b.l + b.r - w) / 2));
    const P = { tl: [b.l, b.t], tr: [b.r - w, b.t], bl: [b.l, b.b - hh], br: [b.r - w, b.b - hh], tc: [cx, b.t], bc: [cx, b.b - hh] };
    const at = i => { const n = DOCKS[i], x = Math.max(b.l, Math.min(P[n][0], b.r - w)), y = Math.max(b.t, Math.min(P[n][1], b.b - hh));
      const cnt = pts => (pts || []).filter(q => q.x >= x - PAD && q.x <= x + w + PAD && q.y >= y - PAD && q.y <= y + hh + PAD).length;
      return { x: x, y: y, dock: i, g: cnt(o.grab), l: cnt(o.line) }; };
    const better = (c, d) => c.g < d.g || (c.g === d.g && c.l < d.l);
    let best = null;
    for (let i = 0; i < DOCKS.length; i++) { const c = at(i); if (!best || better(c, best)) best = c; }
    if (k.dock != null && k.dock >= 0 && k.dock < DOCKS.length) { const cur = at(k.dock); if (!better(best, cur)) return { x: cur.x, y: cur.y, dock: cur.dock }; }
    return { x: best.x, y: best.y, dock: best.dock };
  }


  // ── 순수: 그리기 전용 고정 자리(dock · 2026-11-07 김님 «다음 점 찍을 곳을 팝업이 가림») ──
  // 그리기 중에는 다음 점이 어디로 갈지 알 수 없어서, 마지막 점 옆은 어느 방향이든 다음 점 자리를 가릴 수 있다.
  // 그래서 그리기 막대는 캔버스 가장자리 고정 자리(네 모서리 · 위/아래 가운데)에 둔다.
  //   · 가림 금지(필수): 작성 중 선·꼭짓점·핸들 점 / 마지막 점 둘레 CLEAR 반경 / 진행 방향 앞쪽(직전→마지막 연장) 반경
  //   · 그다음: 몸판·소매 조각 영역(hit rect)과 덜 겹치는 자리
  //   · 붙박이: 지금 자리(keep)가 여전히 필수 조건을 지키면 움직이지 않는다 — 새 점이 그 자리 가까이 찍혔을 때만 옮긴다.
  //     커서 위치는 쓰지 않는다(버튼을 누르러 가는 동안 막대가 도망가거나 깜빡이지 않음).
  // o = {bounds, size, last:{x,y}|null, prev:{x,y}|null, draft:[{x,y}], pieces:[{l,t,r,b}], keep:index|null}
  // 반환 {x, y, index, name, hits, near, overlap}
  const DOCKS = ["bl", "br", "tl", "tr", "bc", "tc"];
  function dockClear(b) { return Math.max(72, Math.min(160, Math.min(b.r - b.l, b.b - b.t) * 0.28)); }
  function dock(o) {
    const b = o.bounds, w = o.size.w, h = o.size.h;
    const cx = Math.max(b.l, Math.round((b.l + b.r - w) / 2));
    const pos = { tl: [b.l, b.t], tr: [b.r - w, b.t], bl: [b.l, b.b - h], br: [b.r - w, b.b - h], tc: [cx, b.t], bc: [cx, b.b - h] };
    const clear = dockClear(b);
    const zones = [];
    if (o.last) {
      zones.push({ x: o.last.x, y: o.last.y, r: clear });
      if (o.prev) {   // 진행 방향 앞쪽 — 연속으로 같은 방향(가로·세로·긴 곡선)으로 갈 때 다음 점 자리
        const dx = o.last.x - o.prev.x, dy = o.last.y - o.prev.y, L = Math.hypot(dx, dy);
        if (L > 1) zones.push({ x: o.last.x + dx / L * clear * 1.6, y: o.last.y + dy / L * clear * 1.6, r: clear });
      }
    }
    const distRect = (x, y, q) => { const ex = Math.max(x - q.x, 0, q.x - (x + w)), ey = Math.max(y - q.y, 0, q.y - (y + h)); return Math.hypot(ex, ey); };
    const evalAt = (i) => {
      const name = DOCKS[i], x = Math.max(b.l, Math.min(pos[name][0], b.r - w)), y = Math.max(b.t, Math.min(pos[name][1], b.b - h));
      let hits = 0; (o.draft || []).forEach(q => { if (q.x >= x - PAD && q.x <= x + w + PAD && q.y >= y - PAD && q.y <= y + h + PAD) hits++; });
      let near = 0; zones.forEach(z => { near += Math.max(0, z.r - distRect(x, y, z)); });
      let overlap = 0; (o.pieces || []).forEach(p => { const ix = Math.min(x + w, p.r) - Math.max(x, p.l), iy = Math.min(y + h, p.b) - Math.max(y, p.t); if (ix > 0 && iy > 0) overlap += ix * iy; });
      return { x: x, y: y, index: i, name: name, hits: hits, near: near, overlap: overlap / Math.max(1, w * h) };
    };
    if (o.keep != null && o.keep >= 0 && o.keep < DOCKS.length) { const k = evalAt(o.keep); if (k.hits === 0 && k.near === 0) return k; }
    let best = null;
    for (let i = 0; i < DOCKS.length; i++) {
      const c = evalAt(i);
      const better = !best || c.hits < best.hits || (c.hits === best.hits && ((c.near > 0) !== (best.near > 0) ? c.near === 0
        : c.near > 0 ? c.near < best.near - 0.5 : c.overlap < best.overlap - 0.02));
      if (better) best = c;
    }
    return best;
  }

  // ── DOM ──

  let drawHintEl = null, failsEl = null, completeBtn = null;

  let selKeep = null;                  // 선택 막대 붙박이 {key, view, mode, x, y}(UI 전용 · 2026-11-09)
  let dockIdx = null;                  // 그리기 막대의 지금 고정 자리(붙박이 · 그리기가 끝나면 버림)
  let bar = null, titleEl = null, dismissBtn = null, drawRow = null, roleRow = null, finishBtn = null, cancelBtn = null, roleBtns = [];
  let splitRow = null, splitBtn = null, splitReason = null;
  let bndRow = null, bndBtn = null, bndReason = null, bndApply = null, bndUndo = null, seamRow = null, seamText = null;
  let rflRow = null, rflBtn = null, rflReason = null;
  let rflNote = null;
  let headRow = null, compactRow = null, compactText_ = null, expandBtn = null;
  let expandedKey = null;             // 소형 상태줄에서 «도구»로 펼친 결과 키(UI 전용 · 선택·결과가 바뀌거나 캔버스를 누르면 풀림)
  let splitNote = null;                // {key, text}: 막대 «파트 분리»를 눌렀는데 파트가 안 생겼을 때 doSplit 이 남긴 안내(#designSplitNote) — 선택이 바뀌면 버림
  let bndNote = null;                  // {key, text}: 막대 «외곽 대체 미리보기»를 눌렀는데 미리보기가 안 생겼을 때 doBoundaryPreview 가 남긴 안내(#designBoundaryNote)
  let dismissedKey = null;            // «접기(×)» 한 선택 키(UI 전용)
  let press = null, dragging = false;  // 캔버스 위 누름·드래그 상태
  let lastPos = null;

  function tool() { return window.designLineTool || null; }
  // 몸판 완료 게이트(권위 check 그대로 · 모든 차단 사유) — 옆선 행에서 «무엇이 남았나»를 정직하게 보이기 위해.
  function bodiceGate() {
    const BC = window.bodiceCheckpoint, W = window.designWorkflow, p = W && W.current ? W.current() : null;
    if (!BC || !p) return null;
    const c = BC.check(p), latest = BC.latest ? BC.latest(p) : null;
    const pending = !latest || (BC.isCurrentBodiceChanged && BC.isCurrentBodiceChanged(p));
    return { ok: !!c.ok, fails: (c.fails || []).slice(), pending: !!pending };
  }
  function snapshot() {
    const T = tool();
    const design = typeof window.isDesignStageActive === "function" && window.isDesignStageActive();
    if (!T || !design) return { design: false };
    const mode = T.getMode();
    if (mode === "draw") {
      const d = T.getDraft();
      return { design: true, mode: mode, draft: d ? { piece: d.piece, n: d.anchors.length } : null, canFinish: T.canFinishDraw() };
    }
    if (mode === "select") {
      const id = T.getSelectedId(), l = id ? T.findLine(id) : null;
      if (!l) return { design: true, mode: mode, sel: null };
      const lock = T.isNeckAutoLine(id) ? "neck" : T.isSleeveCapLine(l) ? "cap" : T.isCollarBodyLine(l) ? "collar" : null;
      const seamSt = T.getSeamState ? T.getSeamState() : null;   // 옆선 행이 있을 때만 완료 게이트를 계산(매 render 비용 최소)
      return { design: true, mode: mode, sel: { id: id, piece: l.piece, role: l.role || "guide", lock: lock, split: T.getSplitState ? T.getSplitState() : null, boundary: T.getBoundaryState ? T.getBoundaryState() : null, seam: seamSt, reflect: T.getReflectState ? T.getReflectState() : null,
        bodice: (!dragging && seamSt) ? bodiceGate() : null } };
    }
    return { design: true, mode: mode };
  }

  // 화면에 그려진 대상 → 기준점·가림 점(canvas-wrap 기준 px).
  function collectTargets(kind, wrapRect) {
    const cv = (typeof svg !== "undefined" && svg) ? svg : document.getElementById("cv");
    if (!cv) return null;
    const local = (el, x, y) => { const m = el.getScreenCTM && el.getScreenCTM(); if (!m) return null; return { x: m.a * x + m.c * y + m.e - wrapRect.left, y: m.b * x + m.d * y + m.f - wrapRect.top }; };
    const pathPts = (p) => {
      const out = []; let L = 0; try { L = p.getTotalLength(); } catch (_) { return out; }
      const n = Math.max(16, Math.min(120, Math.ceil(L / 8)));
      for (let i = 0; i <= n; i++) { const q = p.getPointAtLength(L * i / n); const r = local(p, q.x, q.y); if (r) out.push(r); }
      return out;
    };
    const circlePt = c => local(c, c.cx.baseVal.value, c.cy.baseVal.value);
    const obstacles = [], refs = [], pieces = [], essential = [], grab = []; let prevPt = null;   // grab = 손으로 잡는 점(앵커·핸들 점)
    cv.querySelectorAll(".design-line-handle").forEach(ln => {   // 곡선 핸들선(작성 중·선택 overlay 공통)
      const x1 = ln.x1.baseVal.value, y1 = ln.y1.baseVal.value, x2 = ln.x2.baseVal.value, y2 = ln.y2.baseVal.value;
      for (let i = 0; i <= 4; i++) { const r = local(ln, x1 + (x2 - x1) * i / 4, y1 + (y2 - y1) * i / 4); if (r) { obstacles.push(r); essential.push(r); } }
    });
    cv.querySelectorAll(".design-line-handledot").forEach(c => { const r = circlePt(c); if (r) { obstacles.push(r); essential.push(r); grab.push(r); } });
    // 옆선 길이 상시 표시(2026-11-08)·그리기 거리 안내 글자도 가리지 않을 대상(글자 상자의 모서리·가운데)
    cv.querySelectorAll("text[data-seam-len-text], text[data-measure-text]").forEach(t => { let b = null; try { b = t.getBBox(); } catch (_) { b = null; } if (!b) return;
      [[0, 0], [0.5, 0], [1, 0], [0, 1], [0.5, 1], [1, 1], [0.5, 0.5]].forEach(f => { const r = local(t, b.x + b.width * f[0], b.y + b.height * f[1]); if (r) obstacles.push(r); }); });
    if (kind === "draw") {
      const pv = cv.querySelector(".design-line-preview");
      if (pv) pathPts(pv).forEach(r => obstacles.push(r));
      const vs = cv.querySelectorAll(".design-line-vertex");
      vs.forEach(c => { const r = circlePt(c); if (r) obstacles.push(r); });
      if (vs.length) { const r = circlePt(vs[vs.length - 1]); if (r) refs.push(r); }   // 마지막 점
      if (vs.length > 1) { const r = circlePt(vs[vs.length - 2]); if (r) prevPt = r; }   // 직전 점(진행 방향)
      cv.querySelectorAll('[data-design-root="hit"] > *').forEach(el => {   // 조각 영역(클릭 가능한 hit rect) — 고정 자리는 덜 덮는 곳
        const q = el.getBoundingClientRect(); if (q.width > 0 && q.height > 0) pieces.push({ l: q.left - wrapRect.left, t: q.top - wrapRect.top, r: q.right - wrapRect.left, b: q.bottom - wrapRect.top });
      });
    } else {
      // 파트 분리 결과(색 미리보기) 외곽도 가리지 않을 대상 — 분리 직후 막대가 작은 파트를 덮지 않게.
      cv.querySelectorAll('[data-design-root="parts"] path').forEach(pp => pathPts(pp).forEach(r => obstacles.push(r)));
      cv.querySelectorAll('[data-design-root="boundary"] path').forEach(pp => pathPts(pp).forEach(r => obstacles.push(r)));
      const sp = cv.querySelector("path.design-line.selected");
      const anchors = []; cv.querySelectorAll(".design-line-anchor").forEach(c => { const r = circlePt(c); if (r) anchors.push(r); });
      anchors.forEach(r => { obstacles.push(r); essential.push(r); grab.push(r); });
      if (sp) {
        const pts = pathPts(sp); pts.forEach(r => { obstacles.push(r); essential.push(r); });
        if (pts.length) { refs.push(pts[Math.floor(pts.length / 2)]); refs.push(pts[0]); refs.push(pts[pts.length - 1]); }
      } else if (anchors.length) {   // 관리형 선(유효 상태는 path 를 따로 그리지 않음) → overlay 앵커 기준
        refs.push(anchors[Math.floor(anchors.length / 2)]); refs.push(anchors[0]); refs.push(anchors[anchors.length - 1]);
      }
    }
    if (!refs.length) return null;
    return { cv: cv, refs: refs, obstacles: obstacles, prev: prevPt, pieces: pieces, essential: essential, grab: grab };
  }

  function hide() { if (bar && !bar.hidden) bar.hidden = true; lastPos = null; }

  function sync() {
    if (!bar) return;
    const vm = describe(snapshot());
    if (!vm || vm.kind !== "draw") dockIdx = null;
    if (!vm || vm.kind !== "select") selKeep = null;   // 선택이 끝나면(해제·그리기) 붙박이 자리를 버린다   // 그리기가 끝나면(완료·취소·선택) 고정 자리를 버린다 — 다음 그리기는 새로 고른다
    if (!vm || dragging || (vm.kind === "select" && dismissedKey === vm.key)) { hide(); return; }
    const wrap = bar.parentElement; if (!wrap) { hide(); return; }
    const wr = wrap.getBoundingClientRect();
    const tg = collectTargets(vm.kind, wr);
    if (!tg) { hide(); return; }                       // 대상이 화면에 안 그려짐(숨김 모드·다른 stage) → 막대도 없음
    const sr = tg.cv.getBoundingClientRect();
    if (sr.width < 1 || sr.height < 1) { hide(); return; }

    // 내용 갱신(요소 재생성 없음 — 포커스 보존)
    const hadFocus = bar.contains(document.activeElement);
    titleEl.textContent = vm.title;
    bar.setAttribute("aria-label", "패턴선 빠른 조작 · " + vm.title);
    bar.setAttribute("data-kind", vm.kind);
    drawRow.hidden = vm.kind !== "draw";
    roleRow.hidden = vm.kind !== "select";
    if (vm.kind !== "select") { splitRow.hidden = true; if (bndRow) bndRow.hidden = true; if (rflRow) rflRow.hidden = true; }
    if (rflRow && vm.kind === "select") {
      const rf = vm.reflect; rflRow.hidden = !rf;
      if (rf) {
        if (rflNote && rflNote.key !== vm.key) rflNote = null;
        rflBtn.disabled = !rf.allowed; rflBtn.setAttribute("aria-disabled", rf.allowed ? "false" : "true");
        rflReason.textContent = (rflNote && rf.allowed) ? rflNote.text : rf.text;
        rflRow.setAttribute("data-state", (rflNote && rf.allowed) ? "no" : rf.allowed ? "ok" : "no");
      }
    }
    if (seamRow) {   // 옆선 행(2026-11-08): 몸판 외곽이 옆선 구간을 대체할 때만 · 권위 계측 숫자 + 완료 차단 사유
      const sm = vm.kind === "select" ? vm.seam : null; seamRow.hidden = !sm;
      if (sm) { seamText.textContent = sm.text; seamRow.setAttribute("data-state", sm.bodice && sm.bodice.ok ? "ok" : "no"); renderGate(sm.bodice); }
    }
    dismissBtn.hidden = vm.kind !== "select";        // 그리기 중엔 접기 없음(완료·취소만 명시적으로)
    if (vm.kind === "draw") {
      finishBtn.disabled = !vm.canFinish; finishBtn.setAttribute("aria-disabled", vm.canFinish ? "false" : "true");
      if (vm.canFinish) finishBtn.removeAttribute("title"); else finishBtn.setAttribute("title", "서로 다른 점을 2개 이상 찍으면(또는 곡선을 드래그하면) 누를 수 있습니다");
      if (drawHintEl) { const T = tool(); drawHintEl.textContent = (T && T.getDrawHint && T.getDrawHint()) || ""; }
    } else {
      const sp = vm.split;
      splitRow.hidden = !sp;
      if (sp) {
        if (splitNote && splitNote.key !== vm.key) splitNote = null;
        const note = (splitNote && sp.allowed && !sp.parts) ? splitNote.text : null;
        splitBtn.disabled = !sp.allowed; splitBtn.setAttribute("aria-disabled", sp.allowed ? "false" : "true");
        splitReason.textContent = note || sp.text;
        splitRow.setAttribute("data-state", note ? "no" : !sp.allowed ? "no" : sp.parts > 0 ? "done" : "ok");
      }
      const bd = vm.boundary;
      if (bndRow) {
        bndRow.hidden = !bd;
        if (bd) {
          if (bndNote && bndNote.key !== vm.key) bndNote = null;
          const note = (bndNote && ((bd.stage === "preview" && bd.allowed && !bd.shown) || bd.stage === "confirm")) ? bndNote.text : null;
          bndBtn.hidden = bd.stage !== "preview";
          bndBtn.disabled = !bd.allowed; bndBtn.setAttribute("aria-disabled", bd.allowed ? "false" : "true");
          if (bndApply) {   // 같은 명령(doBoundaryApply) · 같은 판정(getBoundaryState.apply) — 오른쪽 «외곽 반영»과 공용
            const ap = bd.stage === "confirm" && bd.apply;
            bndApply.hidden = !ap; const on = !!(ap && bd.apply.allowed);
            bndApply.disabled = !on; bndApply.setAttribute("aria-disabled", on ? "false" : "true");
          }
          if (bndUndo) bndUndo.hidden = !(bd.stage === "applied" && bd.undo);
          bndReason.textContent = note || bd.text;
          bndRow.setAttribute("data-state", note ? "no" : bd.stage === "applied" ? "done" : bd.stage === "confirm" ? (bd.apply.allowed ? "ok" : "no") : !bd.allowed ? "no" : bd.shown ? "done" : "ok");
        }
      }
      roleBtns.forEach(b => {
        const on = b.getAttribute("data-role") === vm.role;
        b.setAttribute("aria-pressed", on ? "true" : "false");
        b.disabled = vm.locked; b.setAttribute("aria-disabled", vm.locked ? "true" : "false");
      });
    }

    // 측정 → 배치(보이기 전에 visibility 로 측정)
    const wasHidden = bar.hidden;
    if (wasHidden) { bar.style.visibility = "hidden"; bar.hidden = false; }
    const size = { w: bar.offsetWidth, h: bar.offsetHeight };
    const bounds = { l: sr.left - wr.left + MARGIN, t: sr.top - wr.top + MARGIN, r: sr.right - wr.left - MARGIN, b: sr.bottom - wr.top - MARGIN };
    if (vm.kind === "draw") {   // 그리기 = 캔버스 가장자리 고정 자리(마지막 점·진행 방향을 비움 · 마지막 점이 화면 밖이어도 완료·취소는 보인다)
      const d = dock({ bounds: bounds, size: size, last: tg.refs[0], prev: tg.prev, draft: tg.obstacles, pieces: tg.pieces, keep: dockIdx });
      dockIdx = d.index;
      setCompact(false, vm); bar.setAttribute("data-mode", "full");
      const dx = Math.round(d.x), dy = Math.round(d.y);
      if (!lastPos || lastPos.x !== dx || lastPos.y !== dy) { bar.style.left = dx + "px"; bar.style.top = dy + "px"; lastPos = { x: dx, y: dy }; }
      bar.setAttribute("data-place", "dock-" + d.name);
      bar.style.visibility = "";
      if (hadFocus && !bar.contains(document.activeElement)) focusPrimary(vm);
      return;
    }
    // 화면 안에 보이는 기준점만 쓴다. 기준점이 모두 밖이면 보이는 선 위 점 하나로 · 대상이 통째로 화면 밖(팬·줌)이면 막대도 숨김.
    const vis = q => q.x >= bounds.l && q.x <= bounds.r && q.y >= bounds.t && q.y <= bounds.b;
    let refs = tg.refs.filter(vis);
    if (!refs.length) { const v = tg.obstacles.filter(vis); if (v.length) refs = [v[Math.floor(v.length / 2)]]; }
    if (!refs.length) { bar.style.visibility = ""; hide(); return; }
    const rk = resultKey(vm);
    if (expandedKey && expandedKey !== rk) expandedKey = null;   // 다른 선·다른 결과(무효화·재분리)면 펼침 해제
    // 붙박이(2026-11-10 재설계 · holdPlace): 같은 선 · 같은 결과/펼침 · 같은 창 크기 · 명시 화면 초기화 없음 → 자리·형태를 다시 고르지 않는다.
    //   팬·줌·캔버스 높이(상태줄 증감)는 다시 고를 이유가 아니다(화면 안 clamp 만). 형태(전체/소형)도 그 결과에 대해 한 번만 정한다.
    const winSig = (typeof window !== "undefined" ? window.innerWidth + "x" + window.innerHeight : "");
    const modeSig = (rk || "") + "|" + (expandedKey || "");
    const sameKey = !!(selKeep && selKeep.key === vm.key && selKeep.win === winSig && !selKeep.replace);
    let fresh = false;
    if (!sameKey || selKeep.modeSig !== modeSig) {
      // 형태(전체/소형)는 결과·펼침이 바뀔 때만 한 번 정한다(전체 막대 크기로 빈자리 유무만 본다).
      setCompact(false, vm);
      const fs = { w: bar.offsetWidth, h: bar.offsetHeight };
      const probe = place({ bounds: bounds, size: fs, refs: refs, obstacles: tg.obstacles });
      const m = chooseMode(vm, probe.hits, expandedKey);
      if (!sameKey) {   // 새 선·닫기 후 재열기·창 크기 변화·명시 화면 초기화 → 자리(home)를 새로 고른다
        let home = probe;
        if (m === "compact") {   // 줄인 크기로 배치 — 선·파트 둘레 후보 + 캔버스 네 모서리(빈 UI 자리) 중 가장 덜 가리는 곳
          setCompact(true, vm);
          const cs = { w: bar.offsetWidth, h: bar.offsetHeight };
          home = place({ bounds: bounds, size: cs, refs: refs, obstacles: tg.obstacles,
            extra: [{ x: bounds.l, y: bounds.t }, { x: bounds.r - cs.w, y: bounds.t }, { x: bounds.l, y: bounds.b - cs.h }, { x: bounds.r - cs.w, y: bounds.b - cs.h }] });
        }
        selKeep = { key: vm.key, win: winSig, x: home.x, y: home.y, dock: null };   // home = 처음 고른 자리(clamp 값으로 덮지 않음)
        fresh = true;
      }
      selKeep.mode = m; selKeep.modeSig = modeSig;   // 같은 선의 결과 변화(미리보기 생김·사라짐)는 형태만 바꾸고 자리는 그대로
    }
    const mode = selKeep.mode;
    setCompact(mode === "compact", vm);
    // 자리: home 을 clamp · 잡는 점을 가리면 가장자리 고정 자리(첫 배치에도 같은 규칙 → 손 뗀 뒤 두 번 움직이지 않음)
    const hp = holdPlace({ keep: selKeep, bounds: bounds, size: { w: bar.offsetWidth, h: bar.offsetHeight }, grab: tg.grab, line: tg.essential });
    selKeep.dock = hp.dock;
    const pos = { x: hp.x, y: hp.y };
    const how = hp.dock != null ? "dock" : fresh ? "placed" : "kept";
    bar.setAttribute("data-mode", mode);
    bar.setAttribute("data-keep", how);
    const x = Math.round(pos.x), y = Math.round(pos.y);
    if (!lastPos || lastPos.x !== x || lastPos.y !== y) { bar.style.left = x + "px"; bar.style.top = y + "px"; lastPos = { x: x, y: y }; }
    bar.setAttribute("data-place", how === "dock" ? "dock-" + DOCKS[selKeep.dock] : "home");
    bar.style.visibility = "";

    // 포커스가 막대 안에 있었는데 그 버튼이 숨겨졌으면(완료 → 역할 단계) 지금 단계의 주 버튼으로 옮긴다.
    if (hadFocus && !bar.contains(document.activeElement)) focusPrimary(vm);
    else if (hadFocus && document.activeElement && document.activeElement.closest("[hidden]")) focusPrimary(vm);
  }
  // 소형 상태줄 켜기/끄기 — 전체 막대의 행은 그대로 두고 보이기만 바꾼다(요소 재생성 없음).
  function setCompact(on, vm) {
    if (!compactRow) return;
    if (on) {
      const t = compactText(vm);
      compactText_.textContent = t;
      headRow.hidden = true; roleRow.hidden = true; splitRow.hidden = true; if (seamRow) seamRow.hidden = true; if (bndRow) bndRow.hidden = true; if (rflRow) rflRow.hidden = true; drawRow.hidden = true; compactRow.hidden = false;
      bar.setAttribute("aria-label", "패턴선 빠른 조작 · " + vm.title + " · " + t);
    } else { compactRow.hidden = true; headRow.hidden = false; }
  }
  function focusPrimary(vm) {
    if (compactRow && !compactRow.hidden) { try { expandBtn.focus({ preventScroll: true }); } catch (_) { expandBtn.focus(); } return; }
    if (vm.kind === "select" && bndApply && !bndApply.hidden && !bndApply.disabled && bndRow && !bndRow.hidden) { try { bndApply.focus({ preventScroll: true }); } catch (_) { bndApply.focus(); } return; }   // 미리보기 확인 단계 = 다음 행동
    const t = vm.kind === "draw" ? (finishBtn.disabled ? cancelBtn : finishBtn)
      : (roleBtns.filter(b => b.getAttribute("aria-pressed") === "true" && !b.disabled)[0] || (dismissBtn.hidden ? null : dismissBtn));
    if (t) { try { t.focus({ preventScroll: true }); } catch (_) { t.focus(); } }
  }

  // 막대 «파트 분리» 동작(버튼 click 이 부르는 그대로 · 검사도 이 함수를 부른다). 판정이 허용일 때만 doSplit.
  function actSplit() {
    const T = tool(), vm = describe(snapshot()); if (!T || !vm || !vm.split || !vm.split.allowed) return false;
    T.doSplit();
    const st = T.getSplitState ? T.getSplitState() : null, el = typeof document !== "undefined" ? document.getElementById("designSplitNote") : null;
    const done = !!(st && st.parts > 0);
    splitNote = done ? null : { key: vm.key, text: (el && el.textContent) || "분리되지 않았습니다" };
    sync(); return done;
  }

  // 막대 «외곽 대체 미리보기» 동작(버튼 click 이 부르는 그대로 · 검사도 이 함수를 부른다). 판정이 허용일 때만 doBoundaryPreview.
  function actBoundary() {
    const T = tool(), vm = describe(snapshot()); if (!T || !vm || !vm.boundary || !vm.boundary.allowed) return false;
    T.doBoundaryPreview();
    const st = T.getBoundaryState ? T.getBoundaryState() : null, el = typeof document !== "undefined" ? document.getElementById("designBoundaryNote") : null;
    const done = !!(st && st.shown);
    bndNote = done ? null : { key: vm.key, text: (el && el.textContent) || "미리보기가 만들어지지 않았습니다" };
    sync(); return done;
  }

  // 막대 «외곽 반영»(소매 · 미리보기 확인 단계에서만) — 오른쪽 버튼과 같은 doBoundaryApply. 반영이 안 되면 그 안내를 막대에도.
  function actBoundaryApply() {
    const T = tool(), vm = describe(snapshot()); if (!T || !vm || !vm.boundary || vm.boundary.stage !== "confirm" || !vm.boundary.apply || !vm.boundary.apply.allowed) return false;
    const done = !!(T.doBoundaryApply && T.doBoundaryApply());
    const el = typeof document !== "undefined" ? document.getElementById("designBoundaryNote") : null;
    bndNote = done ? null : { key: vm.key, text: (el && el.textContent) || "반영되지 않았습니다" };
    sync(); return done;
  }
  // 막대 «몸판 외곽으로 반영»(버튼 click 이 부르는 그대로 · 검사도 이 함수를 부른다). 실패면 이유를 막대에도(원자적 — 몸판 불변).
  function actReflect() {
    const T = tool(), vm = describe(snapshot()); if (!T || !vm || !vm.reflect || !vm.reflect.allowed || !T.doReflectToBodice) return false;
    const done = !!T.doReflectToBodice();
    const el = typeof document !== "undefined" ? document.getElementById("designComposeNote") : null;
    rflNote = done ? null : { key: vm.key, text: (el && el.textContent) || "반영되지 않았습니다" };
    sync(); return done;
  }
  // 몸판 완료 차단 사유 전부 + 완료 가능하면 «몸판 모양 완료»(오른쪽과 같은 명령). 자동 보정 설정으로 돌려보내지 않는다.
  function renderGate(gate) {
    if (!failsEl || !completeBtn) return;
    const ok = !!(gate && gate.ok), pend = !!(gate && gate.pending);
    completeBtn.hidden = !(ok && pend);
    const F = window.bodiceFailText || (x => x);
    failsEl.textContent = !gate ? "" : gate.ok ? (pend ? "몸판 완료 가능" : "몸판 완료됨") : "몸판 완료 막힘(" + gate.fails.length + "건): " + gate.fails.map(f => F(f) + (FAIL_ACT[f] ? " → " + FAIL_ACT[f] : "")).join(" · ");
  }
  // 막대에서 바로 할 수 있는 조치(문구만 · 자동 수정 없음). 없는 사유는 이름만 보인다(오른쪽 몸판 패널에서 처리).
  const FAIL_ACT = {
    "front-outline-not-connected": "외곽으로 반영한 선의 끝점이 외곽선 위에 있지 않음 — 끝점을 외곽선(모서리 포함)에 다시 맞추거나 선을 지우세요",
    "back-outline-not-connected": "외곽으로 반영한 선의 끝점이 외곽선 위에 있지 않음 — 끝점을 외곽선(모서리 포함)에 다시 맞추거나 선을 지우세요"
  };
  function fmt(v) { return (Math.round(v * 100) / 100).toFixed(2); }
  function actCompleteBodice() { const b = document.getElementById("btnCompleteBodice"); if (!b || b.disabled) return false; b.click(); sync(); return true; }   // 오른쪽 «몸판 모양 완료»와 같은 명령
  function init() {
    bar = document.getElementById("lineQuickBar");
    if (!bar) return;
    titleEl = document.getElementById("lineQuickTitle");
    dismissBtn = document.getElementById("lineQuickDismiss");
    drawRow = bar.querySelector('[data-lqb="draw"]');
    roleRow = bar.querySelector('[data-lqb="role"]');
    finishBtn = document.getElementById("lineQuickFinish");
    cancelBtn = document.getElementById("lineQuickCancel");
    roleBtns = Array.prototype.slice.call(roleRow.querySelectorAll("[data-role]"));
    splitRow = bar.querySelector('[data-lqb="split"]');
    splitBtn = document.getElementById("lineQuickSplit");
    splitReason = document.getElementById("lineQuickSplitReason");
    headRow = bar.querySelector(".lqb-head");
    compactRow = bar.querySelector('[data-lqb="compact"]');
    compactText_ = document.getElementById("lineQuickCompactText");
    bndRow = bar.querySelector('[data-lqb="boundary"]');
    bndBtn = document.getElementById("lineQuickBoundary");
    bndReason = document.getElementById("lineQuickBoundaryReason");
    bndApply = document.getElementById("lineQuickBoundaryApply");
    bndUndo = document.getElementById("lineQuickBoundaryUndo");
    seamRow = bar.querySelector('[data-lqb="seam"]'); seamText = document.getElementById("lineQuickSeamText");
    expandBtn = document.getElementById("lineQuickExpand");
    rflRow = bar.querySelector('[data-lqb="reflect"]'); rflBtn = document.getElementById("lineQuickReflect"); rflReason = document.getElementById("lineQuickReflectReason");
    drawHintEl = document.getElementById("lineQuickDrawHint");
    failsEl = document.getElementById("lineQuickBodiceFails"); completeBtn = document.getElementById("lineQuickCompleteBodice");
    if (completeBtn) completeBtn.addEventListener("click", () => { actCompleteBodice(); });
    if (rflBtn) rflBtn.addEventListener("click", () => { actReflect(); });

    // 막대 위 조작은 캔버스(점 추가·피스 드래그·팬)로 가지 않는다.
    ["pointerdown", "mousedown", "touchstart", "wheel", "dblclick"].forEach(t => bar.addEventListener(t, e => e.stopPropagation(), { passive: true }));
    finishBtn.addEventListener("click", () => { const T = tool(); if (T) T.finishDraw(); });
    cancelBtn.addEventListener("click", () => { const T = tool(); if (T && T.getMode() === "draw") T.cancel(); });
    roleBtns.forEach(b => b.addEventListener("click", () => { const T = tool(); if (T) T.setRole(b.getAttribute("data-role")); }));
    // 파트 분리 = 오른쪽 버튼과 같은 doSplit. 파트가 안 생기면(분할 직전 재검증·ring 실패) doSplit 이 남긴 안내를 막대에도 보인다.
    splitBtn.addEventListener("click", () => { actSplit(); });
    if (bndBtn) bndBtn.addEventListener("click", () => { actBoundary(); });   // 외곽 대체 미리보기 = 오른쪽 버튼과 같은 doBoundaryPreview
    if (bndApply) bndApply.addEventListener("click", () => { actBoundaryApply(); });   // 외곽 반영 = 오른쪽 버튼과 같은 doBoundaryApply
    if (bndUndo) bndUndo.addEventListener("click", () => { const T = tool(); if (T && T.doSleeveEditUndo) T.doSleeveEditUndo(); sync(); });   // 되돌리기 = 오른쪽과 같은 doSleeveEditUndo
    // 소형 상태줄 «도구» = 이 결과에 대해 전체 막대(역할·파트 분리)로 복귀.
    if (expandBtn) expandBtn.addEventListener("click", () => { const vm = describe(snapshot()); expandedKey = resultKey(vm); sync();
      const t = roleBtns.filter(b => b.getAttribute("aria-pressed") === "true" && !b.disabled)[0]; if (t) { try { t.focus({ preventScroll: true }); } catch (_) { t.focus(); } } });
    dismissBtn.addEventListener("click", () => { const vm = describe(snapshot()); if (vm && vm.kind === "select") { dismissedKey = vm.key; selKeep = null; hide(); } });   // 닫기 → 다시 열면 새로 고름

    // 캔버스 드래그 중 숨김 · 손 떼면 재계산. 캔버스를 누르면 «접기» 해제(같은 선 재선택에도 다시 보임).
    const cv = (typeof svg !== "undefined" && svg) ? svg : document.getElementById("cv");
    if (cv) cv.addEventListener("pointerdown", e => { press = { x: e.clientX, y: e.clientY, id: e.pointerId }; dismissedKey = null; expandedKey = null; }, true);
    window.addEventListener("pointermove", e => {
      if (!press || dragging) return;
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > DRAG_PX) { dragging = true; hide(); }
    }, true);
    const release = () => { if (!press) return; press = null; if (dragging) { dragging = false; sync(); } };
    window.addEventListener("pointerup", release, true);
    window.addEventListener("pointercancel", release, true);
    // 명시적 화면 초기화(헤더 «화면 초기화» = resetView)만 같은 선 동안에도 자리를 한 번 다시 고른다(팬·줌은 안 고름).
    document.querySelectorAll('button[onclick^="resetView"]').forEach(btn => btn.addEventListener("click", () => { if (selKeep) { selKeep.replace = true; sync(); } }));
    // 캔버스 크기 변화(창·패널 리사이즈)에는 render 없이도 위치만 다시 맞춘다.
    // 막대 자체 크기 변화(글꼴·단계 전환으로 높이가 바뀜)도 다시 맞춘다 — sync 는 left/top 만 바꿔 크기를 안 바꾸므로 되먹임 루프 없음.
    if (typeof ResizeObserver !== "undefined" && bar.parentElement) { const ro = new ResizeObserver(() => sync()); ro.observe(bar.parentElement); ro.observe(bar); }
    sync();
  }

  window.designLineQuickBar = Object.freeze({ sync: () => { try { sync(); } catch (_) { hide(); } }, describe: describe, place: place, keepPlace: keepPlace, holdPlace: holdPlace, dock: dock, chooseMode: chooseMode, resultKey: resultKey,
    viewModel: () => describe(snapshot()), actSplit: actSplit, actBoundary: actBoundary, actBoundaryApply: actBoundaryApply, actReflect: actReflect,
    actCompleteBodice: actCompleteBodice });
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  }
})();
