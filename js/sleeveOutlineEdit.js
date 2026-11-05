// ══════════════════════════════════════════════
// js/sleeveOutlineEdit.js — 소매 수동 외곽 편집(2026-11-06 김님 승인 «미리보기에서 확인한 소매 외곽을 반영 → 실제 형상으로 재계측 → 소매 재완료»).
//
// 프리셋 재제도 동일성 검사(sleeveCheckpoint check*)를 우회·완화하지 않는다. 대신 **명시적 수동 편집 기록**을 따로 소유한다.
//   working.sleeveEdit = deepFrozen {
//     key(소매 라인 A~Z | base), sym, base(= 편집 전 frozen sleeveResult 그 자체 — 원본 완료본 · 바꾸지 않는다), baseHash,
//     ops: [{ lineId, lineSig, segments(대체선 복사), piece, cls, fromHash(미리보기를 만든 완료본 hash) }],
//     geometry(= base.geometry 에 ops 를 차례로 적용한 현재 수정 소매 · frozen) }
//   working.geometry.sleeve = geometry 의 복사(화면·snap·절개 판정이 같은 형상을 본다 — 원본과 현재 형상을 섞지 않는다).
//
// 권위 구분: base(프리셋 제도 결과·제도 기록 meta)와 현재 수정 형상은 다른 것이다. 현재 실측은 geometry 를 직접 잰 값(measure)이고,
//   base.meta 의 예측값(목표 이세·소매산 높이 등)은 «제도 기록»으로만 남는다.
//
// 반영 가능 조건(planEdit): 미리보기와 같은 판정(sleeveSplit.boundarySleeve)이 통과하고, 대체되는 원래 외곽 구간의 **의미가 하나**여야 한다
//   (소매산 · 앞 옆선 · 뒤 옆선 · 소맷부리 · 중심 솔기). 두 의미에 걸치면(소매산→옆선 등) 새 선을 어느 쪽으로 잴지 추측하지 않고 거부한다.
//   · 소매산: 단순 길이로 재는 소매(capPrimitives)만 · 분할점(SP)이 유지 구간에 남아야 하고 수정 후 SP 가 그대로여야 한다(SP 를 지나거나
//     새 꼭대기가 생겨 SP 가 옮겨지면 거부 — 필요한 선택 = 새 SP 위치). 턱 소매(Ⓕ·Ⓖ·Ⓞ)·파생 몸판 소매(Ⓡ~Ⓦ)·관리형 소매산 선(기본 manual)은 소매산 거부.
//   · 래글런 달림선·목선(Ⓥ·Ⓦ) · 덧천(Ⓧ) · 별도 소매 없음(Ⓨ·Ⓩ) = 거부.
//   · 턱 표시(tuck-*)가 닿은 외곽 구간 = 거부(접는 자리 표시를 어떻게 옮길지 판단 필요). 그 밖의 제도선(중심선·폭선 등)은 제도 기록 그대로 둔다.
//   · 열린 V(Ⓒ·Ⓦ) · Ⓥ 다른 조각은 boundarySleeve 계약 그대로(V 를 품거나 다리 위 끝점 거부 · 다른 조각 불변).
//
// 순수 함수(classify·planEdit·replay·measure)는 상태를 바꾸지 않는다. 상태 변경은 apply·undo·prune 셋뿐이고, 실패하면 아무것도 바꾸지 않는다.
// ══════════════════════════════════════════════
(function () {
  "use strict";

  const ON_TOL = 0.05;
  const T = () => window.designLineTool, S = () => window.sleeveSplit, C = () => window.sleeveCheckpoint;
  const J = JSON.stringify;
  function clone(o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }
  function deepFreeze(o) { if (o && typeof o === "object" && !Object.isFrozen(o)) { Object.keys(o).forEach(k => deepFreeze(o[k])); Object.freeze(o); } return o; }
  function pt(p) { return { x: p.x, y: p.y }; }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  // ── 소매 라인 규칙 ──
  const RULE = { F: "tuck", G: "tuck", O: "tuck", R: "derived", S: "derived", T: "derived", U: "derived", V: "raglan", W: "raglan", X: "gusset", Y: "none", Z: "none" };
  function keyOfPresetId(id) { const m = /^bunka-sleeve-([A-Z])$/.exec(id || ""); return m ? m[1] : "base"; }
  function liveKey(p) { const l = S() && S().liveLine(p); return l ? l.key.slice(-1) : "base"; }
  function ruleOf(key, p) {
    if (key === "base") return (p && p.working && p.working.sleeveDraft && p.working.sleeveDraft.mode === "manual") ? "managed" : "plain";
    return RULE[key] || "plain";
  }
  const LABEL = { cap: "소매산", raglan: "소매 달림선(래글런)", neck: "목선", "side-front": "앞 옆선", "side-back": "뒤 옆선", hem: "소맷부리", center: "중심 솔기", dart: "다트", gusset: "덧천", unknown: "의미 미상 구간" };
  const ROLE_OF = { cap: "cap", "side-front": "side-seam-front", "side-back": "side-seam-back", hem: "hem", center: "center-seam" };

  // ── 순수: 외곽 primitive 의 구간 의미 ──
  function roleClass(pr) {
    const r = pr.role || "";
    if (r === "cap") return "cap";
    if (r === "raglan") return "raglan";
    if (r === "neck") return "neck";
    if (/dart/.test(r)) return "dart";
    if (/^gusset/.test(r)) return "gusset";
    if (r === "center-seam") return "center";
    if (/^hem/.test(r)) return "hem";
    if (/^(side-seam|underarm)-front/.test(r)) return "side-front";
    if (/^(side-seam|underarm)-back/.test(r)) return "side-back";
    if (r === "underarm") return pr.piece === "front" ? "side-front" : pr.piece === "back" ? "side-back" : "unknown";
    return "unknown";
  }
  function endsOf(pr) {
    if (pr.kind === "line" || pr.kind === "cubic") return [pr.from, pr.to];
    if (pr.kind === "path" && Array.isArray(pr.commands) && pr.commands.length) { const l = pr.commands[pr.commands.length - 1]; return [pr.commands[0].points[0], l.points[l.points.length - 1]]; }
    return [];
  }
  // 반환 { cls:[outline 번호별 의미], tagged }. 역할 표시가 없는 소매(기본·Ⓐ)는 designSleeve.capSegsOf 와 같은 규칙
  //   (소맷부리 = 가장 낮은 두 끝점을 잇는 직선 · 옆선 = 소맷부리에 닿는 선 · 소매산 = 나머지)으로 나누고, 옆선의 앞·뒤는
  //   소매산 끝 중 x 가 작은 쪽 = 뒤(measureCapSeam 과 같은 규칙)로 정한다. 정할 수 없으면 unknown(반영 거부).
  function classify(g) {
    const ol = (g && g.outline) || [];
    if (ol.some(pr => pr && pr.role)) return { cls: ol.map(roleClass), tagged: true };
    let hemY = -Infinity; ol.forEach(pr => endsOf(pr).forEach(q => { if (q.y > hemY) hemY = q.y; }));
    const atHem = q => Math.abs(q.y - hemY) < 0.5;
    const isHem = pr => pr.kind === "line" && endsOf(pr).every(atHem);
    const touches = pr => !isHem(pr) && endsOf(pr).some(atHem);
    const capEnds = []; ol.forEach(pr => { if (!isHem(pr) && !touches(pr)) endsOf(pr).forEach(q => capEnds.push(q)); });
    const once = capEnds.filter(q => capEnds.filter(r => dist(q, r) < 1e-6).length === 1);
    const ends = once.length === 2 ? once : [];
    const back = ends.length ? (ends[0].x < ends[1].x ? ends[0] : ends[1]) : null, front = ends.length ? (back === ends[0] ? ends[1] : ends[0]) : null;
    return { tagged: false, cls: ol.map(pr => {
      if (isHem(pr)) return "hem";
      if (!touches(pr)) return "cap";
      if (!back) return "unknown";
      const e = endsOf(pr);
      if (e.some(q => dist(q, back) < 0.5)) return "side-back";
      if (e.some(q => dist(q, front) < 0.5)) return "side-front";
      return "unknown";
    }) };
  }

  // ── 순수: 세그먼트 도구 ──
  function segsOfPrim(pr) {
    if (pr.kind === "path" && (pr.commands || []).some(c => c.type === "L")) {
      const out = []; let cur = null;
      pr.commands.forEach(c => {
        if (c.type === "M") cur = c.points[0];
        else if (c.type === "L") { out.push({ kind: "line", from: pt(cur), to: pt(c.points[0]) }); cur = c.points[0]; }
        else if (c.type === "C") { out.push({ kind: "cubic", from: pt(cur), c1: pt(c.points[0]), c2: pt(c.points[1]), to: pt(c.points[2]) }); cur = c.points[2]; }
      });
      return out;
    }
    return T().outlinePrimsToSegs([pr]);
  }
  function segAt(s, t) {
    if (s.kind === "line") return { x: s.from.x + (s.to.x - s.from.x) * t, y: s.from.y + (s.to.y - s.from.y) * t };
    const u = 1 - t;
    return { x: u * u * u * s.from.x + 3 * u * u * t * s.c1.x + 3 * u * t * t * s.c2.x + t * t * t * s.to.x,
      y: u * u * u * s.from.y + 3 * u * u * t * s.c1.y + 3 * u * t * t * s.c2.y + t * t * t * s.to.y };
  }
  function segLen(s) { let L = 0; T().flattenSegment(s).forEach(ab => { L += dist(ab[0], ab[1]); }); return L; }
  function primLen(pr) { return segsOfPrim(pr).reduce((a, s) => a + segLen(s), 0); }
  function pieceIdx(g, name) {
    const ol = g.outline || [];
    if (Array.isArray(g.pieces) && g.pieces.length > 1) return ol.map((pr, i) => pr.piece === name ? i : -1).filter(i => i >= 0);
    return ol.map((pr, i) => i);
  }
  const GEOM_KEYS = { kind: 1, from: 1, to: 1, c1: 1, c2: 1, commands: 1 };
  function tagsOf(pr) { const o = {}; Object.keys(pr || {}).forEach(k => { if (!GEOM_KEYS[k]) o[k] = clone(pr[k]); }); return o; }
  // geometry primitive 계약 = line | path(M/C) (designRenderer·ui 와 같은 형식 — 맨 cubic primitive 는 렌더러가 거부한다).
  function primOfSeg(s, tags) {
    const o = s.kind === "cubic" ? { kind: "path", commands: [{ type: "M", points: [pt(s.from)] }, { type: "C", points: [pt(s.c1), pt(s.c2), pt(s.to)] }] } : { kind: "line", from: pt(s.from), to: pt(s.to) };
    return Object.assign(o, tags || {});
  }
  // 닫힌 고리 점열의 비인접 교차(끝점 공유 제외).
  function ringSimple(segs) {
    const D = T(), flat = [];
    segs.forEach(s => D.flattenSegment(s).forEach(ab => flat.push(ab)));
    const n = flat.length;
    for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const p = D.segCross(flat[i][0], flat[i][1], flat[j][0], flat[j][1]);
      if (p && !(dist(p, flat[i][0]) < 1e-7 || dist(p, flat[i][1]) < 1e-7)) return false;
    }
    return true;
  }
  function fail(code, reason, extra) { return Object.assign({ ok: false, code: code, reason: reason }, extra || {}); }

  // ── 순수: 한 번의 외곽 반영 계획 ──
  //   g = 지금 소매 geometry(완료본) · bndSegs = 대체선(boundarySegsOf) · ctx = { rule, splitPoint, measureCap(geom)→prim|null, capRequired }
  //   반환 { ok, geometry(새 geometry — g 불변), piece, cls, label, previewOutline(미리보기와 같은 결과), measure } | { ok:false, code, reason, classes? }
  function planEdit(g, bndSegs, ctx) {
    ctx = ctx || {};
    const rule = ctx.rule || "plain";
    if (rule === "none" || !g || g.sleevePiece === false || !Array.isArray(g.outline) || !g.outline.length) return fail("no-piece", "별도 소매 조각이 없음(소매가 몸판과 한 장) — 반영할 소매 외곽이 없습니다");
    if (rule === "gusset") return fail("rule", "덧천 소매(Ⓧ)의 네 변은 모두 몸판·소매와 맞물리는 봉제선 — 외곽 반영 미지원(맞물리는 쪽을 함께 고칠지 판단 필요)");
    const pv = S().boundarySleeve(g, bndSegs);
    if (!pv.ok) return fail(pv.code, pv.reason);
    const cl = classify(g), idx = pieceIdx(g, pv.piece), D = T();
    const table = [];
    idx.forEach(i => segsOfPrim(g.outline[i]).forEach(s => table.push({ i: i, seg: s })));
    const plen = {}, klen = {};
    idx.forEach(i => { plen[i] = primLen(g.outline[i]); klen[i] = 0; });
    const nB = bndSegs.length, out = pv.outline, kept = out.slice(nB);
    const keptSrc = kept.map(s => {
      const m = segAt(s, 0.5); let best = -1, bd = Infinity;
      table.forEach(r => { const d = D.projectOntoSeg(m, r.seg).dist; if (d < bd) { bd = d; best = r.i; } });
      return bd < 1e-5 ? best : -1;
    });
    if (keptSrc.some(i => i < 0)) return fail("map", "유지 구간을 원래 외곽에 대응시키지 못함 — 반영하지 않습니다");
    kept.forEach((s, k) => { klen[keptSrc[k]] += segLen(s); });
    const full = {}; idx.forEach(i => { full[i] = klen[i] >= plen[i] - 1e-5; });
    const touched = idx.filter(i => !full[i]);
    if (!touched.length) return fail("noop", "바뀌는 외곽 구간이 없음 — 이미 같은 외곽입니다");
    const classes = touched.map(i => cl.cls[i]).filter((c, k, a) => a.indexOf(c) === k);
    const labels = classes.map(c => LABEL[c] || c);
    if (classes.indexOf("unknown") >= 0) return fail("unknown", "대체되는 외곽 구간의 의미(소매산·옆선·소맷부리)를 정할 수 없음 — 반영하지 않습니다", { classes: classes });
    if (classes.length > 1) return fail("mixed", "대체 구간이 " + labels.join("·") + "에 걸침 — 새 선을 어느 구간으로 잴지 정할 수 없습니다(필요한 선택: 새 선을 " + labels.join(" 또는 ") + " 중 하나로 지정 · 지금은 구간마다 따로 그려 주세요)", { classes: classes });
    const cls = classes[0];
    if (cls === "dart") return fail("rule", "열린 다트 V 는 실제 외곽이라 바꾸지 않습니다");
    if (cls === "raglan" || cls === "neck") return fail("rule", LABEL[cls] + "은 몸판 진동·목선과 함께 제도된 봉제선 — 반영 미지원(몸판 쪽을 함께 고칠지 판단 필요)");
    if (cls === "gusset") return fail("rule", "덧천 봉제선 — 반영 미지원");
    if (cls === "cap") {
      if (rule === "managed") return fail("rule", "관리형 소매산 선을 쓰는 소매 — 소매산은 그 관리선으로 편집합니다");
      if (rule === "tuck") return fail("rule", "턱 소매의 소매산은 턱을 접은 길이로 잽니다 — 턱 자리를 어떻게 옮길지 정할 수 없어 소매산 반영 미지원(옆선·소맷부리는 가능)");
      if (rule === "derived") return fail("rule", "이 소매는 몸판과 함께 제도돼(파생 몸판) 소매산이 몸판 진동과 짝 — 소매산 반영 미지원(옆선·소맷부리는 가능)");
      if (rule !== "plain") return fail("rule", "이 소매의 소매산 반영은 지원하지 않습니다");
      const sp = ctx.splitPoint;
      if (!sp) return fail("split", "소매산 앞·뒤 분할점(SP)을 알 수 없음 — 소매산 반영 불가");
      if (D.distPtToSegs(sp, D.flattenLine(kept)) > 1e-4) return fail("split", "대체 구간이 소매산 분할점(SP)을 지남 — 새 소매산에서 앞·뒤를 나눌 점을 정할 수 없습니다(필요한 선택: 새 선 위 SP 위치 · 지금은 SP 한쪽씩 따로 그려 주세요)");
    }
    // 턱 표시가 닿은 구간(접는 자리 = 봉제 표시)은 바꾸지 않는다.
    const origFlat = D.flattenLine(table.map(r => r.seg)), keptFlat = D.flattenLine(kept);
    const tuckHit = (g.construction || []).some(pr => /tuck/.test(pr.role || "") && endsOf(pr).some(q => D.distPtToSegs(q, origFlat) <= ON_TOL && D.distPtToSegs(q, keptFlat) > ON_TOL));
    if (tuckHit) return fail("construction", "턱 표시(접는 자리)가 닿은 외곽 구간 — 표시를 어떻게 옮길지 정할 수 없어 반영하지 않습니다");

    // 고리 순서: out = [대체선 …, 유지 …](순환). 새 구간 = 대체선 + 일부만 남은 원래 primitive 의 조각 — 순환상 한 덩어리여야 한다.
    const src = bndSegs.map(() => -1).concat(keptSrc), n = out.length;
    const inRun = k => src[k] < 0 || !full[src[k]];
    let st = -1;
    for (let k = 0; k < n; k++) if (inRun(k) && !inRun((k - 1 + n) % n)) { if (st >= 0) return fail("map", "바뀌는 구간이 한 덩어리가 아님 — 반영하지 않습니다"); st = k; }
    if (st < 0) return fail("map", "바뀌는 구간을 찾지 못함");
    const run = []; for (let k = st; run.length < n && inRun(k % n); k++) run.push(k % n);
    const roles = touched.map(i => g.outline[i].role).filter((r, k, a) => r && a.indexOf(r) === k);
    const pieces = touched.map(i => g.outline[i].piece).filter((r, k, a) => r && a.indexOf(r) === k);
    const newTags = { role: roles.length === 1 ? roles[0] : ROLE_OF[cls] };
    if (pieces.length === 1) newTags.piece = pieces[0];
    const roleFix = i => (!cl.tagged && ROLE_OF[cl.cls[i]]) ? { role: ROLE_OF[cl.cls[i]] } : {};
    const outline = []; let placed = false;
    g.outline.forEach((pr, i) => {
      if (idx.indexOf(i) >= 0 && !full[i]) {
        if (!placed) { run.forEach(k => outline.push(primOfSeg(out[k], src[k] < 0 ? newTags : Object.assign(tagsOf(g.outline[src[k]]), roleFix(src[k]))))); placed = true; }
        return;
      }
      outline.push(Object.assign(clone(pr), roleFix(i)));
    });
    const ng = clone(g); ng.outline = outline;
    // 독립 확인: 그 조각이 외곽만으로 닫힌 한 고리 · 자기교차 없음.
    const grp = S().pieceGroups(ng).filter(x => x.name === pv.piece)[0];
    const rb = grp ? S().buildClosedRing(grp.segs) : { ok: false, reason: "조각 없음" };
    if (!rb.ok) return fail("ring", "수정한 소매 외곽이 닫힌 한 고리가 아님: " + rb.reason);
    if (!ringSimple(rb.ring.map(r => r.seg))) return fail("ring", "수정한 소매 외곽이 자기 교차");
    // 소매산 실측(완료와 같은 함수) — SP 가 그대로여야 한다.
    if (ctx.measureCap && ctx.capRequired) {
      const prim = ctx.measureCap(ng);
      if (!prim) return fail("measure", "수정한 소매에서 소매산 앞·뒤 길이를 잴 수 없음 — 반영하지 않습니다");
      if (ctx.splitPoint && prim.splitPoint && dist(prim.splitPoint, ctx.splitPoint) > 1e-6) return fail("split-moved", "수정 후 소매산 분할점(SP)이 달라짐(새 꼭대기 등) — 새 SP 를 어디로 둘지 정해야 합니다(필요한 선택: SP 위치)");
    }
    return { ok: true, geometry: ng, piece: pv.piece, cls: cls, label: LABEL[cls], previewOutline: pv.outline };
  }
  // 순수: base geometry 에 ops 를 차례로 다시 적용(출처 검증 — 같은 결과여야 현재 형상으로 인정).
  function replay(baseGeom, ops, ctx) {
    let g = baseGeom;
    for (let i = 0; i < (ops || []).length; i++) {
      const r = planEdit(g, ops[i].segments, ctx);
      if (!r.ok) return { ok: false, step: i, reason: r.reason };
      if (r.cls !== ops[i].cls || r.piece !== ops[i].piece) return { ok: false, step: i, reason: "반영 기록과 다른 구간" };
      g = r.geometry;
    }
    return { ok: true, geometry: g };
  }

  // ── 순수: 현재 형상 실측(표시·완료 기록용) ──
  //   cap(소매산 앞·뒤·총 — ctx.measureCap = 완료와 같은 함수) · 소맷부리(소맷부리 구간 외곽 길이 · 다트 다리 제외) · 앞/뒤 옆선 ·
  //   소매길이(SP 수직선이 소맷부리와 만나는 점까지 · 만나지 않거나 SP 없으면 null — 추측하지 않음).
  function measure(g, ctx) {
    ctx = ctx || {};
    const cl = classify(g), sum = { hem: 0, "side-front": 0, "side-back": 0 }, hemSegs = [];
    (g.outline || []).forEach((pr, i) => { const c = cl.cls[i]; if (sum[c] !== undefined) { sum[c] += primLen(pr); if (c === "hem") segsOfPrim(pr).forEach(s => hemSegs.push(s)); } });
    const prim = ctx.measureCap ? ctx.measureCap(g) : null;
    let sleeveLength = null;
    if (prim && prim.splitPoint) {
      const x0 = prim.splitPoint.x, ys = [];
      T().flattenLine(hemSegs).forEach(ab => { const a = ab[0], b = ab[1]; if ((a.x - x0) * (b.x - x0) <= 0 && a.x !== b.x) ys.push(a.y + (b.y - a.y) * (x0 - a.x) / (b.x - a.x)); });
      if (ys.length) sleeveLength = Math.max.apply(null, ys) - prim.splitPoint.y;
    }
    return { cap: prim ? { front: prim.lengths.front, back: prim.lengths.back, total: prim.lengths.total } : null, splitPoint: prim && prim.splitPoint ? pt(prim.splitPoint) : null,
      cuff: sum.hem > 0 ? sum.hem : null, sideFront: sum["side-front"] > 0 ? sum["side-front"] : null, sideBack: sum["side-back"] > 0 ? sum["side-back"] : null, sleeveLength: sleeveLength };
  }

  // ── 상태 ──
  function editOf(p) { return (p && p.working && p.working.sleeveEdit) || null; }
  function shapeSig(g) { return g ? J({ o: g.outline || null, c: g.construction || null, s: g.capSplit === undefined ? null : g.capSplit }) : ""; }
  function opsSig(ops) { return J((ops || []).map(o => [o.lineId, o.lineSig, o.piece, o.cls])); }
  // { kind: none | active | stale, reason?, edit? } — 화면 소매가 수정 형상과 다르면(프리셋·입력·몸판을 새로 적용) 낡은 편집이다(승계하지 않음).
  function state(p) {
    const ed = editOf(p); if (!ed) return { kind: "none" };
    const w = p.working, live = S() && S().liveLine(p);
    if (liveKey(p) !== ed.key) return { kind: "stale", edit: ed, reason: "소매 라인이 바뀜" };
    if (live && live.state.blocked) return { kind: "stale", edit: ed, reason: "소매 적용이 차단됨" };
    if (shapeSig(w.geometry && w.geometry.sleeve) !== shapeSig(ed.geometry)) return { kind: "stale", edit: ed, reason: "소매를 새로 적용함" };
    return { kind: "active", edit: ed };
  }
  function isActive(p) { return state(p).kind === "active"; }
  // 낡은 편집 제거(프리셋·입력·몸판을 새로 적용한 뒤) — 다른 형상에 옮기지 않는다. 안내는 sleeveEditDropped 에 남긴다.
  function prune(p) {
    const s = state(p); if (s.kind !== "stale") return false;
    p.working.sleeveEditDropped = { sym: s.edit.sym, count: s.edit.ops.length, reason: s.reason };
    p.working.sleeveEdit = null;
    return true;
  }
  function ctxFor(p, base) {
    const key = keyOfPresetId(base && base.origin && base.origin.presetId), SC = C();
    return { key: key, rule: ruleOf(key, p), splitPoint: base && base.cap && base.cap.splitPoint ? pt(base.cap.splitPoint) : null,
      measureCap: SC && SC.measureCap ? (g => SC.measureCap(g, key)) : null, capRequired: !(key === "X" || key === "Y" || key === "Z") };
  }
  // 지금 완료본의 편집 기준(base). 완료본이 수정 완료본이면 활성 편집의 base(이력이 맞을 때만) · 아니면 완료본 그 자체.
  function baseFor(p) {
    const res = C() && C().latest(p); if (!res) return { ok: false, reason: "소매 모양 완료 전" };
    if (!res.manualEdit) return { ok: true, base: res, prevOps: [] };
    const s = state(p);
    if (s.kind !== "active" || s.edit.base.hash !== res.manualEdit.baseSleeveHash || opsSig(s.edit.ops) !== opsSig(res.manualEdit.ops)) return { ok: false, reason: "수동 외곽 수정 기록이 완료본과 맞지 않음 — 소매 모양을 다시 완료하세요" };
    return { ok: true, base: s.edit.base, prevOps: s.edit.ops };
  }
  function isApplied(p, line) {
    const s = state(p); if (s.kind !== "active" || !line) return false;
    const sig = S().cutSig(line.segments);
    return s.edit.ops.some(o => o.lineId === line.id && o.lineSig === sig);
  }
  // 반영 가능 판정(상태 동기화 때 · v = sleeveSplit.boundaryStatus 결과). 미리보기 판정이 통과해도 반영은 따로 막힐 수 있다(의미 모호 등).
  function applyStatus(p, line, v) {
    if (isApplied(p, line)) return { allowed: false, applied: true, reason: "이 선은 소매 외곽에 반영됨" };
    if (!v || !v.ok) return { allowed: false, reason: v ? v.reason : "대체선 아님" };
    const ref = v._ref; if (!ref || ref.source !== "current") return { allowed: false, reason: ref ? ref.reason : "소매 기준 없음" };
    const bf = baseFor(p); if (!bf.ok) return { allowed: false, reason: bf.reason };
    const pl = planEdit(ref.geometry, T().boundarySegsOf(line), ctxFor(p, bf.base));
    return pl.ok ? { allowed: true, cls: pl.cls, reason: LABEL[pl.cls] + " 수정 — «외곽 반영»으로 소매에 반영" } : { allowed: false, code: pl.code, reason: pl.reason };
  }
  // 소매 절개선을 지금 화면 소매(수정 형상)로 다시 판정 — 남기고/이유만 모은다(자동 삭제·이동 없음).
  function cutSummary(p) {
    const D = T(), g = p.working.geometry.sleeve, cuts = (p.working.patternLines || []).filter(l => l.piece === "sleeve" && l.role === "cut");
    const flat = D.flattenLine([].concat.apply([], S().pieceGroups(g).map(x => x.segs)));
    const bad = [];
    cuts.forEach(l => { const v = D.validateCut(l, flat, cuts.filter(o => o !== l).map(o => D.flattenLine(o.segments))); if (!v.ok) bad.push({ lineId: l.id, reason: v.reason }); });
    return { total: cuts.length, invalid: bad };
  }

  // ── 상태 변경: 반영 · 되돌리기 ──
  // 반영(«외곽 반영» 명시 클릭만): 현재 소매 완료본으로 만든 **보이는 미리보기**가 있어야 하고, 직전에 같은 판정을 다시 낸다.
  //   하나라도 어긋나면 아무것도 바꾸지 않는다(원자적). 성공 = sleeveEdit 교체 + 화면 소매 = 수정 형상 · 미리보기·소매 파트 정리.
  function apply(p, line) {
    if (!p || !line || line.piece !== "sleeve" || line.role !== "boundary") return fail("line", "소매 외곽 대체선을 선택하세요");
    const SS = S(), SC = C(), w = p.working;
    if (isApplied(p, line)) return fail("applied", "이 선은 이미 소매 외곽에 반영됨");
    const v = SS.boundaryStatus(p, line);                    // ★ 반영 직전 재판정(미리보기와 같은 판정)
    if (!v.ok) return fail(v.kind || "invalid", v.reason);
    const ref = v._ref;
    const bp = w.boundaryPreview;
    if (!bp || bp.sourceLineId !== line.id || !SS.previewCurrent(p, bp, ref)) return fail("preview", "확인한 외곽 대체 미리보기가 없거나 낡음 — 미리보기를 다시 만든 뒤 반영하세요");
    if (J(bp.outline) !== J(v.outline)) return fail("preview", "미리보기와 지금 판정이 다름 — 미리보기를 다시 만드세요");
    const bf = baseFor(p); if (!bf.ok) return fail("history", bf.reason);
    const ctx = ctxFor(p, bf.base);
    const bnd = T().boundarySegsOf(line);
    const pl = planEdit(ref.geometry, bnd, ctx);
    if (!pl.ok) return pl;
    if (J(pl.previewOutline) !== J(bp.outline)) return fail("preview", "미리보기와 반영 결과가 다름 — 반영하지 않습니다");
    const res = SC.latest(p);
    const op = { lineId: line.id, lineSig: SS.cutSig(line.segments), segments: clone(bnd), piece: pl.piece, cls: pl.cls, fromHash: res.hash };
    const ops = clone(bf.prevOps).concat([op]);
    const rp = replay(bf.base.geometry, ops, ctx);
    if (!rp.ok || J(rp.geometry) !== J(pl.geometry)) return fail("replay", "원본 소매에서 반영 기록을 다시 적용한 결과가 다름 — 반영하지 않습니다");
    const next = deepFreeze({ schemaVersion: 1, key: ctx.key, sym: ref.sym, base: bf.base, baseHash: bf.base.hash, ops: ops, geometry: clone(pl.geometry) });
    // 가상 완료 검사(실제 상태는 아직 그대로) — 통과해야만 반영한다.
    const pw = Object.assign({}, w, { sleeveEdit: next, geometry: Object.assign({}, w.geometry, { sleeve: clone(pl.geometry) }) });
    const ck = SC.check(Object.assign({}, p, { working: pw }));
    if (!ck.ok) return fail("check", "반영 후 소매 검사 실패(" + ck.fails[0] + ") — 반영하지 않습니다");
    // 커밋
    w.sleeveEdit = next;
    w.geometry.sleeve = clone(pl.geometry);
    w.boundaryPreview = null;
    w.sleeveEditDropped = null;
    if (Array.isArray(w.parts) && w.parts.some(q => q.sourcePiece === "sleeve")) w.parts = w.parts.filter(q => q.sourcePiece !== "sleeve");
    return { ok: true, op: op, cls: pl.cls, label: pl.label, count: ops.length, cuts: cutSummary(p) };
  }
  // 마지막 반영 하나 되돌리기(한 번이면 원래 소매 완료본 형상으로). 활성 편집에서만. 그 사이 완료본이 그대로면 바로 «현재»로 돌아간다.
  function undoLast(p) {
    const s = state(p); if (s.kind !== "active") return fail("none", "되돌릴 수동 외곽 수정 없음");
    const ed = s.edit, w = p.working, ops = ed.ops.slice(0, -1);
    if (!ops.length) {
      w.geometry.sleeve = clone(ed.base.geometry); w.sleeveEdit = null;
    } else {
      const ctx = ctxFor(p, ed.base), rp = replay(ed.base.geometry, ops, ctx);
      if (!rp.ok) return fail("replay", "이전 단계 형상을 다시 만들 수 없음 — 되돌리지 않습니다");
      const next = deepFreeze({ schemaVersion: 1, key: ed.key, sym: ed.sym, base: ed.base, baseHash: ed.baseHash, ops: clone(ops), geometry: clone(rp.geometry) });
      w.sleeveEdit = next; w.geometry.sleeve = clone(rp.geometry);
    }
    w.boundaryPreview = null; w.sleeveEditDropped = null;
    if (Array.isArray(w.parts) && w.parts.some(q => q.sourcePiece === "sleeve")) w.parts = w.parts.filter(q => q.sourcePiece !== "sleeve");
    return { ok: true, count: ops.length };
  }

  window.sleeveOutlineEdit = Object.freeze({ classify, planEdit, replay, measure, state, isActive, prune, ctxFor, baseFor, isApplied, applyStatus, cutSummary, apply, undoLast,
    opsSig, shapeSig, keyOfPresetId, ruleOf, LABEL });
})();
