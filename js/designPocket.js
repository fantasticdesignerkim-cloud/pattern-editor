// ══════════════════════════════════════════════
// designPocket.js — 디자인 «디테일»: 셔츠 앞 주머니(오각 패치 1장). 순수 기하·검증·세션 설정 소유.
//
// 근거(교재): [패턴학교] P.100 ③ «패치(오각)» — 셔츠 가슴 포켓 도해.
//   책 도해 치수 = 폭 15 · 높이 16 · 밑각 3(양옆 수직선 끝 ~ 맨 아래 중심의 높이 차). 위치는 자유(책에 치수 없음).
//   입구 쪽 접기 표시만 있고 접어박기 분량 숫자는 확인되지 않았다.
//   ★ 교재 수치(BOOK)와 앱 초깃값(APP)을 구별한다 — 폭·높이·밑각의 초깃값은 도해 값을 쓰지만,
//     부착 위치(앞중심에서·가슴선에서)와 입구 접어박기 분량은 **앱이 정한 초깃값이지 교재 수치가 아니다**.
//
// 소유권/계약:
//   · 설정 = working.pocket (엄격 형식 · 모르는 키/판/범위 밖 = 읽지 않음). 없으면 «주머니 없음» — 기존 저장본은 그대로.
//   · Design 완료본(designResult)이 완료 시점의 설정을 frozen 사본 designResult.pocket 으로 묶는다(서명 키 pk 는 주머니가 있을 때만).
//   · 최종 몸판(원형/몸판 완료본)·sleeve/derive 엔진·다트 엔진·골든은 읽기만 한다. 위치를 임의로 옮기지 않는다 —
//     몸판 밖/열린 다트/진동·옆선·밑단에 걸리면 사유만 돌려준다.
//   · 출발 범위: 나뉘지 않은 한 장 앞판 박시 셔츠(소매 파생 몸판 · 요크 · 프린세스 · 페플럼 앞판은 사유와 함께 거부).
//   · 좌우: 앞판 도안은 착용자 오른쪽(앞중심이 도안 오른쪽 끝) 한 쪽이다. 주머니의 위치 값(앞중심에서·가슴선에서)은 그 반쪽 틀 기준이고,
//     side("left"|"right") 는 어느 앞판(착용자 기준)에 다는지만 정한다. 기본 = 착용자 왼쪽.
// ══════════════════════════════════════════════
(function () {
  "use strict";
  function Wn() { return (typeof window !== "undefined") ? window : {}; }
  function project() { var dw = Wn().designWorkflow; return (dw && dw.current && dw.current()) || null; }
  function r4(v) { return Math.round(v * 1e4) / 1e4; }
  function pt(p) { return { x: p.x, y: p.y }; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function isNum(v) { return typeof v === "number" && isFinite(v); }

  var KIND = "shirt-patch-pentagon";
  // 교재 도해 치수(P.100 ③) — 읽기 전용 상수
  var BOOK = Object.freeze({ widthCm: 15, heightCm: 16, tipDepthCm: 3, source: "[패턴학교] P.100 ③ 패치(오각) 도해" });
  // 앱 초깃값 — 폭·높이·밑각은 도해 값. 나머지 셋은 교재 수치가 아니다.
  var APP = Object.freeze({ side: "left", widthCm: BOOK.widthCm, heightCm: BOOK.heightCm, tipDepthCm: BOOK.tipDepthCm,
    cxFromCfCm: 11, topBelowBustCm: 2, mouthFoldCm: 3 });
  var APP_NOTE = "부착 위치(앞중심에서 11 · 가슴선 아래 2)와 입구 접어박기 3cm 는 앱 초깃값입니다(교재 수치 아님 — P.100 은 위치 자유 · 접기 표시만 있고 숫자 없음)";
  var LIMITS = Object.freeze({ widthCm: [5, 30], heightCm: [5, 30], tipDepthCm: [0.5, 10], cxFromCfCm: [0, 40], topBelowBustCm: [-10, 40], mouthFoldCm: [0.5, 8] });
  var LABEL = { widthCm: "폭", heightCm: "높이", tipDepthCm: "밑각", cxFromCfCm: "앞중심에서 가운데까지", topBelowBustCm: "가슴선에서 입구까지", mouthFoldCm: "입구 접어박기" };
  var KEYS = "cxFromCfCm,heightCm,kind,mouthFoldCm,schema,side,tipDepthCm,topBelowBustCm,widthCm";
  var MIN_CLEAR_CM = 0.05;   // 주머니 변이 몸판 외곽에 이보다 가까우면 «걸림»

  function defaultSpec() { return { schema: 1, kind: KIND, side: APP.side, widthCm: APP.widthCm, heightCm: APP.heightCm, tipDepthCm: APP.tipDepthCm, cxFromCfCm: APP.cxFromCfCm, topBelowBustCm: APP.topBelowBustCm, mouthFoldCm: APP.mouthFoldCm }; }

  // 엄격 정규화: 새 객체(소수 4자리). 고쳐 쓰지 않는다 — 어긋나면 사유.
  function normalizeSpec(raw) {
    var no = function (r) { return { ok: false, reason: r }; };
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return no("주머니 설정 형식이 객체가 아닙니다");
    if (Object.keys(raw).sort().join(",") !== KEYS) return no("주머니 설정에 모르는 항목이 있거나 빠진 항목이 있습니다");
    if (raw.schema !== 1) return no("모르는 판(schema " + raw.schema + ")입니다");
    if (raw.kind !== KIND) return no("모르는 주머니 종류(" + raw.kind + ")입니다");
    if (raw.side !== "left" && raw.side !== "right") return no("주머니 좌우는 left 또는 right 입니다");
    var out = { schema: 1, kind: KIND, side: raw.side };
    var ks = Object.keys(LIMITS);
    for (var i = 0; i < ks.length; i++) {
      var k = ks[i], v = raw[k], lim = LIMITS[k];
      if (!isNum(v)) return no(LABEL[k] + " 값이 숫자가 아닙니다");
      if (v < lim[0] || v > lim[1]) return no(LABEL[k] + " " + v + "cm 는 " + lim[0] + "~" + lim[1] + "cm 범위 밖입니다");
      out[k] = r4(v);
    }
    if (out.tipDepthCm > out.heightCm - 1) return no("밑각 " + out.tipDepthCm + "cm 는 높이 " + out.heightCm + "cm 보다 1cm 이상 작아야 합니다(옆 수직선이 남아야 오각형)");
    return { ok: true, spec: out };
  }

  // 완성선 오각형(조각 좌표: 입구 윗변이 y=0, 아래로 +y). 변 이름은 시접 변 이름으로 쓰인다.
  function localOutline(s) {
    var W_ = s.widthCm, H = s.heightCm, D = s.tipDepthCm, L = function (a, b, e) { return { kind: "line", from: { x: a[0], y: a[1] }, to: { x: b[0], y: b[1] }, edge: e }; };
    return [L([0, 0], [W_, 0], "mouth"), L([W_, 0], [W_, H - D], "pocket-side-r"), L([W_, H - D], [W_ / 2, H], "pocket-bottom-r"),
      L([W_ / 2, H], [0, H - D], "pocket-bottom-l"), L([0, H - D], [0, 0], "pocket-side-l")];
  }

  // ── 앞판 외곽 읽기(순수) ──
  function cubicAt(s, t) { var u = 1 - t; return { x: u * u * u * s.from.x + 3 * u * u * t * s.c1.x + 3 * u * t * t * s.c2.x + t * t * t * s.to.x, y: u * u * u * s.from.y + 3 * u * u * t * s.c1.y + 3 * u * t * t * s.c2.y + t * t * t * s.to.y }; }
  function normSegs(outline) {
    var out = [];
    for (var i = 0; i < (outline || []).length; i++) {
      var s = outline[i]; if (!s || typeof s !== "object") return null;
      if (s.kind === "line" && s.from && s.to) out.push({ kind: "line", from: pt(s.from), to: pt(s.to) });
      else if (s.kind === "cubic" && s.from && s.c1 && s.c2 && s.to) out.push({ kind: "cubic", from: pt(s.from), c1: pt(s.c1), c2: pt(s.c2), to: pt(s.to) });
      else if (s.kind === "path" && Array.isArray(s.commands)) {
        var cur = null, start = null;
        for (var k = 0; k < s.commands.length; k++) {
          var c = s.commands[k], P = c.points || [];
          if (c.type === "M") { cur = start = P[0]; continue; }
          if (!cur) return null;
          if (c.type === "C" && P.length >= 3) { out.push({ kind: "cubic", from: pt(cur), c1: pt(P[0]), c2: pt(P[1]), to: pt(P[2]) }); cur = P[2]; }
          else if (c.type === "L" && P.length >= 1) { out.push({ kind: "line", from: pt(cur), to: pt(P[0]) }); cur = P[0]; }
          else if (c.type === "Z") { if (start) out.push({ kind: "line", from: pt(cur), to: pt(start) }); cur = start; }
          else return null;
        }
      } else return null;
    }
    return out;
  }
  function near(a, b) { return Math.hypot(a.x - b.x, a.y - b.y) <= 1e-4; }
  function rev(s) { return s.kind === "cubic" ? { kind: "cubic", from: pt(s.to), c1: pt(s.c2), c2: pt(s.c1), to: pt(s.from) } : { kind: "line", from: pt(s.to), to: pt(s.from) }; }
  function chainClosed(segs) {
    var n = segs.length; if (!n) return null;
    var used = new Array(n).fill(false), out = [segs[0]], cur = segs[0].to; used[0] = true;
    for (var step = 1; step < n; step++) {
      var f = -1, o = null;
      for (var j = 0; j < n; j++) { if (used[j]) continue; if (near(segs[j].from, cur)) { f = j; o = segs[j]; break; } if (near(segs[j].to, cur)) { f = j; o = rev(segs[j]); break; } }
      if (f < 0) return null;
      used[f] = true; out.push(o); cur = o.to;
    }
    return near(cur, out[0].from) ? out : null;
  }
  function ringOf(segs, construction) {
    var closed = chainClosed(segs); if (closed) return closed;
    var DLT = Wn().designLineTool, cons = (construction || []).filter(function (c) { return c && c.kind === "line" && c.from && c.to; });
    if (DLT && typeof DLT.buildPieceRing === "function" && cons.length) {
      var r = DLT.buildPieceRing(segs, cons);
      if (r && r.ok) return r.ring.map(function (x) { return x.seg.kind === "cubic" ? { kind: "cubic", from: pt(x.seg.from), c1: pt(x.seg.c1), c2: pt(x.seg.c2), to: pt(x.seg.to) } : { kind: "line", from: pt(x.seg.from), to: pt(x.seg.to) }; });
    }
    return null;
  }
  function polyOfRing(ring) {
    var pts = [];
    ring.forEach(function (s) { if (s.kind === "line") { pts.push(s.from); return; } for (var k = 0; k < 24; k++) pts.push(cubicAt(s, k / 24)); });
    return pts;
  }
  function endpointsOfPrim(s) {
    if (!s) return [];
    if (s.kind === "path" && Array.isArray(s.commands) && s.commands.length) { var c = s.commands, lp = c[c.length - 1].points || []; return [c[0].points && c[0].points[0], lp[lp.length - 1]]; }
    return s.from && s.to ? [s.from, s.to] : [];
  }
  function edgeLines(prims, name) { return (prims || []).filter(function (s) { return s && s.edge === name; }); }
  function inPoly(q, poly) { var c = false; for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) { var a = poly[i], b = poly[j]; if ((a.y > q.y) !== (b.y > q.y) && q.x < (b.x - a.x) * (q.y - a.y) / (b.y - a.y) + a.x) c = !c; } return c; }
  function distSeg(q, a, b) { var vx = b.x - a.x, vy = b.y - a.y, l2 = vx * vx + vy * vy, t = l2 ? Math.max(0, Math.min(1, ((q.x - a.x) * vx + (q.y - a.y) * vy) / l2)) : 0; return Math.hypot(q.x - a.x - vx * t, q.y - a.y - vy * t); }
  function distPoly(q, poly) { var m = Infinity; for (var i = 0; i < poly.length; i++) { var d = distSeg(q, poly[i], poly[(i + 1) % poly.length]); if (d < m) m = d; } return m; }
  function segsCross(a, b, c, d) {
    var rx = b.x - a.x, ry = b.y - a.y, sx = d.x - c.x, sy = d.y - c.y, den = rx * sy - ry * sx; if (Math.abs(den) < 1e-12) return false;
    var t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / den, u = ((c.x - a.x) * ry - (c.y - a.y) * rx) / den;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  }

  // 앞판 틀: 앞중심 x · 가슴선 y · 몸쪽 방향 부호 · 폐곡선 다각형. 어느 하나라도 확정 못하면 사유.
  var SPLIT_KEYS = ["frontYoke", "shoulderYoke", "frontBody", "frontCenter", "frontSide", "frontPeplum"];
  function frontFrame(src) {
    var no = function (r) { return { ok: false, reason: r }; };
    var DR = Wn().designResult, b = src && src.bodice;
    var fin = DR && DR.finalBodiceOf ? DR.finalBodiceOf(src) : null;
    if (!b || !fin) return no("몸판 모양 완료 전입니다 — 몸판을 완료한 뒤 주머니 위치를 확인합니다");
    if (fin.source !== "bodice") return no("소매와 함께 제도한 파생 몸판에는 주머니를 달지 않습니다(출발 범위: 한 장 앞판 박시 셔츠)");
    for (var i = 0; i < SPLIT_KEYS.length; i++) if (b[SPLIT_KEYS[i]]) return no("요크·프린세스·페플럼 등으로 나뉜 앞판에는 아직 주머니를 달지 않습니다(출발 범위: 한 장 앞판 박시 셔츠)");
    var fr = fin.front; if (!fr || !Array.isArray(fr.outline) || !fr.outline.length) return no("앞판 외곽을 읽을 수 없습니다");
    var segs = normSegs(fr.outline); if (!segs || !segs.length) return no("앞판 외곽의 선 종류를 읽을 수 없습니다");
    var ring = ringOf(segs, fr.construction); if (!ring) return no("앞판 외곽이 폐곡선이 아니라 주머니 자리를 검사할 수 없습니다");
    var poly = polyOfRing(ring);
    // 앞중심 x
    var cfs = [];
    edgeLines(fr.outline, "center").forEach(function (s) { if (s.kind === "line" && s.from && s.to && Math.abs(s.from.x - s.to.x) < 1e-9) cfs.push(s.from.x); });
    var cfX = null;
    if (cfs.length && Math.max.apply(null, cfs) - Math.min.apply(null, cfs) < 1e-6) cfX = cfs[0];
    else if (!cfs.length && b.placket && Array.isArray(b.placket.outline) && b.placket.outline[0] && b.placket.outline[0].from) cfX = b.placket.outline[0].from.x;
    if (cfX == null || !isNum(cfX)) return no("앞중심선(세로 직선)을 찾지 못해 부착 기준을 정할 수 없습니다");
    // 가슴선(BL) = 옆선 변 끝점 중 가장 위(작은 y) — 몸판 체크포인트와 같은 규칙
    var blY = Infinity;
    (fr.outline || []).concat(fr.construction || []).forEach(function (s) { if (s && s.edge === "side-seam") endpointsOfPrim(s).forEach(function (p) { if (p && isNum(p.y) && p.y < blY) blY = p.y; }); });
    if (!isFinite(blY)) return no("옆선에서 가슴선 높이를 찾지 못해 부착 기준을 정할 수 없습니다");
    var minX = Infinity, maxX = -Infinity; poly.forEach(function (p) { if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x; });
    var sign = cfX >= (minX + maxX) / 2 ? -1 : 1;   // 앞중심에서 몸 쪽으로 가는 x 방향
    return { ok: true, cfX: cfX, blY: blY, sign: sign, ring: ring, poly: poly };
  }

  // 평가: 설정 + 최종 몸판 → 기하(조각 외곽·부착선·접는선) 또는 사유. 위치를 임의로 바꾸지 않는다.
  function evaluate(rawSpec, src) {
    var n = normalizeSpec(rawSpec); if (!n.ok) return { ok: false, reason: n.reason };
    var s = n.spec, fr = frontFrame(src); if (!fr.ok) return { ok: false, reason: fr.reason };
    var cxC = fr.cfX + fr.sign * s.cxFromCfCm, x0 = r4(cxC - s.widthCm / 2), y0 = r4(fr.blY + s.topBelowBustCm);
    var local = localOutline(s);
    var verts = local.map(function (p) { return { x: r4(x0 + p.from.x), y: r4(y0 + p.from.y) }; });
    var attach = verts.map(function (v, i) { var w = verts[(i + 1) % verts.length]; return { kind: "line", from: pt(v), to: pt(w) }; });
    if (!verts.every(function (v) { return isNum(v.x) && isNum(v.y); })) return { ok: false, reason: "부착점 좌표가 유효하지 않습니다" };
    // 걸림 검사 ① 변 위 표본 모두 몸판 안 · 외곽에서 떨어져 있음 ② 변이 외곽과 교차하지 않음 ③ 외곽 꼭짓점(다트 끝 포함)이 주머니 안에 없음
    var bad = null;
    for (var e = 0; e < verts.length && !bad; e++) {
      var a = verts[e], b = verts[(e + 1) % verts.length], len = Math.hypot(b.x - a.x, b.y - a.y), steps = Math.max(2, Math.ceil(len / 0.5));
      for (var k = 0; k <= steps; k++) {
        var q = { x: a.x + (b.x - a.x) * k / steps, y: a.y + (b.y - a.y) * k / steps };
        if (!inPoly(q, fr.poly)) { bad = "주머니 " + edgeKo(local[e].edge) + " 쪽이 앞판 밖(또는 열린 다트·진동·옆선·밑단 바깥)에 걸립니다"; break; }
        if (distPoly(q, fr.poly) < MIN_CLEAR_CM) { bad = "주머니 " + edgeKo(local[e].edge) + " 쪽이 앞판 외곽선에 닿습니다"; break; }
      }
      if (bad) break;
      for (var j = 0; j < fr.poly.length; j++) if (segsCross(a, b, fr.poly[j], fr.poly[(j + 1) % fr.poly.length])) { bad = "주머니 " + edgeKo(local[e].edge) + " 변이 앞판 외곽선·다트 다리와 교차합니다"; break; }
    }
    if (!bad) for (var m = 0; m < fr.poly.length; m++) if (inPoly(fr.poly[m], verts)) { bad = "앞판 외곽의 꼭짓점(다트 끝 등)이 주머니 안에 들어옵니다 — 열린 다트와 겹칩니다"; break; }
    if (bad) return { ok: false, reason: bad + " — 위치·크기를 직접 바꿔 주세요(자동으로 옮기지 않습니다)", spec: s };
    return { ok: true, spec: s, origin: { x: x0, y: y0 }, cfX: fr.cfX, blY: fr.blY, sign: fr.sign, side: s.side,
      local: local, attach: attach, fold: { kind: "line", from: pt(local[0].from), to: pt(local[0].to) }, mouthFoldCm: s.mouthFoldCm,
      info: { widthCm: s.widthCm, heightCm: s.heightCm, tipDepthCm: s.tipDepthCm, sideLengthCm: r4(s.heightCm - s.tipDepthCm) } };
  }
  function edgeKo(e) { return e === "mouth" ? "입구" : e === "pocket-side-r" || e === "pocket-side-l" ? "옆" : "아래 사선"; }

  // ── 세션 설정 ──
  function contextOf(proj) {
    var BC = Wn().bodiceCheckpoint, SC = Wn().sleeveCheckpoint;
    return { bodice: BC && BC.latest ? BC.latest(proj) : null, sleeve: SC && SC.latest ? SC.latest(proj) : null };
  }
  function get(proj) { proj = proj || project(); return (proj && proj.working && proj.working.pocket) || null; }
  function isApplied(proj) { return !!get(proj); }
  // 저장본 검증용(projectFile): 키가 없으면 ok(없음) · 있으면 엄격 형식.
  function validateStored(raw) { if (raw === undefined) return { ok: true, none: true }; var n = normalizeSpec(raw); return n.ok ? { ok: true, spec: n.spec } : n; }
  // 적용: 평가가 통과해야만 쓴다(걸리면 사유만 돌려주고 아무것도 바꾸지 않음).
  function apply(proj, raw) {
    proj = proj || project(); if (!proj || !proj.working) return { ok: false, reason: "디자인 프로젝트가 없습니다" };
    var ev = evaluate(raw, contextOf(proj)); if (!ev.ok) return { ok: false, reason: ev.reason };
    proj.working.pocket = clone(ev.spec);
    return { ok: true, spec: ev.spec, eval: ev };
  }
  function clear(proj) { proj = proj || project(); if (proj && proj.working && Object.prototype.hasOwnProperty.call(proj.working, "pocket")) { delete proj.working.pocket; return { ok: true, removed: true }; } return { ok: true, removed: false }; }

  // 디자인 화면(render.js)이 읽는 표시 모델. 같은 설정·몸판 해시면 캐시.
  var memo = { key: null, val: null };
  function previewFor(proj) {
    proj = proj || project(); var raw = get(proj); if (!raw) return null;
    var ctx = contextOf(proj), key = JSON.stringify(raw) + "|" + (ctx.bodice ? ctx.bodice.hash : "-") + "|" + (ctx.sleeve ? ctx.sleeve.hash : "-");
    if (memo.key === key) return memo.val;
    var ev = evaluate(raw, ctx), val = ev.ok ? { ok: true, side: ev.side, attach: ev.attach, label: "주머니 달림선 · 착용자 " + (ev.side === "left" ? "왼쪽" : "오른쪽") } : { ok: false, reason: ev.reason };
    memo.key = key; memo.val = val; return val;
  }

  // 재단(cutPrep)이 읽는 조각 모델(완료본 frozen 설정 + 완료본 몸판 묶음). 새 좌표 복사본.
  function cutModel(spec, src) {
    var ev = evaluate(spec, src); if (!ev.ok) return ev;
    return { ok: true, spec: ev.spec, side: ev.side, outline: ev.local, mouthFoldCm: ev.mouthFoldCm, fold: ev.fold, attach: ev.attach, info: ev.info };
  }

  Wn().designPocket = Object.freeze({ KIND: KIND, BOOK: BOOK, APP: APP, APP_NOTE: APP_NOTE, LIMITS: LIMITS, LABEL: LABEL,
    defaultSpec: defaultSpec, normalizeSpec: normalizeSpec, localOutline: localOutline, evaluate: evaluate, cutModel: cutModel,
    get: get, isApplied: isApplied, apply: apply, clear: clear, validateStored: validateStored, previewFor: previewFor, contextOf: contextOf });
})();
