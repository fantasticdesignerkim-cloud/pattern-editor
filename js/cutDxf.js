// ══════════════════════════════════════════════
// cutDxf.js — 재단 결과 DXF 내보내기(2026-11-16 master 승인)
//   원형 단계의 exportDXF(storage.js · 화면 SVG 를 읽는 옛 동선)와 별개다. 이 파일은 화면(SVG DOM·카메라·핸들)을 읽지 않고
//   재단 파생 모델(cutPrep derive → seam → displayOf → layoutOf → qtyOf → grainOf)만 읽는다. 사전 점검 = cutPrint.preflight 한 벌(규칙을 복사하지 않음).
//   형식(결정 기록): ASCII DXF R12(AC1009) — 가장 넓게 읽히는 판. 단위 mm · 1:1 · Y 위쪽이 +(화면 y 를 뒤집음) · 왼쪽 아래 = (0,0).
//     곡선 = 직선 조각으로 나눈 POLYLINE(R12 에는 SPLINE 이 없다) · 현 오차 ≤ 0.01mm · 좌표 소수 4자리(0.0001mm).
//     재단선·완성선 = 닫힌 POLYLINE(70=1). 레이어: CUT · FINISHED · FINISHED_TRUED(접어 정리한 완성 외곽 — 있을 때만) · FOLD · NOTCH · GRAIN · GRAIN_HELD · INTERNAL · TEXT.
//     단위 표시: $INSUNITS=4(mm) · $MEASUREMENT=1(미터법) — R12 정식 머리 변수는 아니라 읽는 쪽이 무시할 수 있다(그때는 «단위 없음 = mm»로 연다).
//   AAMA/ASTM 재단 DXF 규격이 아니다(블록·규격 레이어 번호를 쓰지 않음) — 일반 DXF.
//   골 펼친 조각 = 한 장 · 수량만큼 복제하지 않음 · 원본·hash·저장값을 바꾸지 않음 · 전송 없음(이 기기에서 파일 저장만).
// ══════════════════════════════════════════════
(function () {
  "use strict";
  function W() { return (typeof window !== "undefined") ? window : {}; }
  var TOL_CM = 0.001;   // 곡선을 직선으로 나눌 때 현 오차 한계 = 0.01mm
  var LAYERS = [["CUT", 7, "CONTINUOUS", "재단선(시접 포함)"], ["FINISHED", 5, "CONTINUOUS", "완성선(다트 봉제선 = 열린 다트 V 포함)"], ["FINISHED_TRUED", 6, "CONTINUOUS", "접어 정리한 완성 외곽(다트 입구 산)"], ["FOLD", 3, "DASHED", "골선 — 반쪽 조각을 원단을 접어 재단(펼친 한 장의 가운데 선은 INTERNAL)"], ["NOTCH", 1, "CONTINUOUS", "너치(맞춤 표시)"],
    ["GRAIN", 4, "CONTINUOUS", "식서"], ["GRAIN_HELD", 8, "DASHED", "식서 보류 — 임시 기본 방향"], ["INTERNAL", 9, "DASHED", "안쪽 기준선·자르지 않는 선(펼친 가운데 선 · 커프스·트임 접는 선 포함)"], ["TEXT", 2, "CONTINUOUS", "조각 이름·수량·식서 상태"]];
  function f4(v) { var s = (Math.round(v * 1e4) / 1e4).toFixed(4); return s === "-0.0000" ? "0.0000" : s; }
  // ASCII 만 쓴다: 한글 등은 DXF 유니코드 표기 \U+XXXX 로(읽는 쪽이 이 표기를 모르면 그대로 보인다 — 그래서 ASCII 조각 id 줄을 따로 둔다)
  function asc(s) { var o = ""; s = String(s == null ? "" : s); for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); o += (c >= 32 && c < 127) ? s.charAt(i) : c < 32 ? " " : "\\U+" + ("0000" + c.toString(16).toUpperCase()).slice(-4); } return o; }
  function cubicAt(s, t) { var u = 1 - t; return { x: u * u * u * s.from.x + 3 * u * u * t * s.c1.x + 3 * u * t * t * s.c2.x + t * t * t * s.to.x, y: u * u * u * s.from.y + 3 * u * u * t * s.c1.y + 3 * u * t * t * s.c2.y + t * t * t * s.to.y }; }
  // 3차 곡선 한 개를 n 등분: 현 오차 ≤ 0.75·M/n² (M = 조절점 2차 차분의 큰 쪽) → n = ⌈√(0.75·M/허용)⌉
  function stepsOf(s) { var ax = s.from.x - 2 * s.c1.x + s.c2.x, ay = s.from.y - 2 * s.c1.y + s.c2.y, bx = s.c1.x - 2 * s.c2.x + s.to.x, by = s.c1.y - 2 * s.c2.y + s.to.y;
    var M = Math.max(Math.hypot(ax, ay), Math.hypot(bx, by)); return Math.max(1, Math.min(4000, Math.ceil(Math.sqrt(0.75 * M / TOL_CM)))); }
  // 이어진 선분 묶음 → 점 열(끝점 포함). 이어지지 않는 자리에서는 새 열을 시작한다.
  function chains(segs) {
    var out = [], cur = null, last = null;
    (segs || []).forEach(function (s) {
      if (!cur || !last || Math.hypot(s.from.x - last.x, s.from.y - last.y) > 1e-6) { cur = [{ x: s.from.x, y: s.from.y }]; out.push(cur); }
      if (s.kind === "cubic") { var n = stepsOf(s); for (var k = 1; k < n; k++) cur.push(cubicAt(s, k / n)); }
      cur.push({ x: s.to.x, y: s.to.y }); last = s.to;
    });
    return out;
  }
  function closedRing(pts) { var p = pts.slice(); if (p.length > 2 && Math.hypot(p[0].x - p[p.length - 1].x, p[0].y - p[p.length - 1].y) < 1e-6) p.pop(); return p; }

  // 사전 점검(cutPrint.preflight 한 벌) + 조각 묶음 + 전체 범위 — 두 형식(일반 · AAMA 구조)이 같이 쓴다
  function collect(proj) {
    var CP = W().cutPrint; if (!CP || !CP.preflight) return { ok: false, reason: "사전 점검 모듈을 불러오지 못했습니다", blockers: ["사전 점검 모듈을 불러오지 못했습니다"] };
    var pre = CP.preflight(proj); if (!pre.ok) return { ok: false, reason: pre.blockers[0], blockers: pre.blockers, pre: pre };
    var d = pre.d, D = pre.D, L = pre.L, rowOf = {}, items = []; pre.rows.forEach(function (r) { rowOf[r.id] = r; });
    var minX = Infinity, maxY = -Infinity, maxX = -Infinity, minY = Infinity;
    L.order.forEach(function (pid) {
      var bid = String(pid).replace(/~m$/, ""), p = d.pieces.filter(function (x) { return x.id === bid; })[0], r = D[pid], pos = L.pos[pid]; if (!p || !r || !pos || !rowOf[pid]) return;
      // ⑦ 앞판 좌우 한 쌍: 보이는 조각마다 한 항목(수량 1) — 일반·AAMA 가 같은 항목 모델을 쓴다. pname = ASCII 조각 이름(착용자 기준 right/left).
      items.push({ p: p, r: r, pos: pos, row: rowOf[pid], sm: pre.m.pieces[bid], g: pre.G.pieces[pid], id: pid, label: rowOf[pid].label || p.label, pname: (r.pair || r.instMirrored) ? p.id + "-" + (r.side === "R" ? "right" : "left") : p.id });
      r.seam.forEach(function (q) { var x = q.x + pos.dx, y = q.y + pos.dy; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; });
    });
    if (!items.length) return { ok: false, reason: "내보낼 조각이 없습니다", blockers: ["내보낼 조각이 없습니다"], pre: pre };
    return { ok: true, pre: pre, items: items, minX: minX, maxX: maxX, minY: minY, maxY: maxY };
  }
  function dayOf(meta) { return String((meta && meta.createdAt) || "").slice(0, 10).replace(/[^0-9-]/g, ""); }

  //   meta = { version, createdAt } (글자만) · opt = { format: "generic"(기본) | "aama" }. 반환: { ok, dxf, fileName, stats, pre } / { ok:false, reason, blockers, pre }
  function build(proj, meta, opt) {
    if (opt && opt.format === "aama") return buildAama(proj, meta);
    var c = collect(proj); if (!c.ok) return c;
    meta = meta || {};
    var pre = c.pre, items = c.items, minX = c.minX, maxX = c.maxX, minY = c.minY, maxY = c.maxY;
    var E = [], count = {}, add = function (layer, arr) { count[layer] = (count[layer] || 0) + 1; for (var i = 0; i < arr.length; i++) E.push(arr[i]); };
    var X = function (q, pos) { return f4((q.x + pos.dx - minX) * 10); }, Y = function (q, pos) { return f4((maxY - (q.y + pos.dy)) * 10); };
    var poly = function (layer, pts, pos, closed) { var a = ["0", "POLYLINE", "8", layer, "66", "1", "10", "0.0", "20", "0.0", "30", "0.0", "70", closed ? "1" : "0"];
      pts.forEach(function (q) { a.push("0", "VERTEX", "8", layer, "10", X(q, pos), "20", Y(q, pos), "30", "0.0"); }); a.push("0", "SEQEND", "8", layer); add(layer, a); };
    var line = function (layer, a, b, pos) { add(layer, ["0", "LINE", "8", layer, "10", X(a, pos), "20", Y(a, pos), "30", "0.0", "11", X(b, pos), "21", Y(b, pos), "31", "0.0"]); };
    var text = function (q, pos, hMm, s, rot) { add("TEXT", ["0", "TEXT", "8", "TEXT", "10", X(q, pos), "20", Y(q, pos), "30", "0.0", "40", f4(hMm), "1", asc(s), "50", f4(rot || 0), "7", "STANDARD", "72", "1", "11", X(q, pos), "21", Y(q, pos), "31", "0.0"]); };
    var pieces = [];
    items.forEach(function (it) {
      var p = it.p, r = it.r, pos = it.pos, row = it.row, g = it.g;
      poly("CUT", closedRing(r.seam), pos, true);
      var fin = chains(r.outline); fin.forEach(function (c, i) { poly("FINISHED", fin.length === 1 ? closedRing(c) : c, pos, fin.length === 1); });
      if (r.trued) { var tr0 = chains(r.trued); tr0.forEach(function (c) { poly("FINISHED_TRUED", tr0.length === 1 ? closedRing(c) : c, pos, tr0.length === 1); }); }
      (r.marks || []).forEach(function (mk) { var zone = mk.kind.indexOf("zone-") === 0; chains(mk.segs).forEach(function (c) { if (c.length === 2 && !zone) line("INTERNAL", c[0], c[1], pos); else poly("INTERNAL", zone ? closedRing(c) : c, pos, zone); }); });
      // 기본 표시선(자르지 않음 · INTERNAL) + 글자(TEXT): C.F · C.B · BUST LINE · WAIST LINE — 화면·인쇄와 같은 모델 값(r.guides)
      (r.guides || []).forEach(function (gd) { if (gd.line) line("INTERNAL", gd.a, gd.b, pos); text({ x: gd.tx, y: gd.ty }, pos, gd.th * 10, gd.text, 0); });
      var foldN = 0;
      (r.edges || []).forEach(function (e) { var se = (it.sm.edges || []).filter(function (x) { return x.id === e.id; })[0]; if (!se || se.kind !== "fold") return;
        // 펼친 한 장의 가운데 선 = 자르지 않는 참고선(INTERNAL · 인쇄 «골(펼친 중심 — 자르지 않음)» · AAMA 레이어 8 과 같은 뜻).
        //   FOLD = 반쪽 그대로 원단을 접어 재단해야 하는 실제 골선만(펼치지 못한 조각 · 글자 «CUT ON FOLD»). 2026-11-17 야간 리뷰.
        var fl = r.unfolded ? "INTERNAL" : "FOLD";
        chains(e.parts[0]).forEach(function (c) { foldN++; if (c.length === 2) line(fl, c[0], c[1], pos); else poly(fl, c, pos, false); }); });
      (r.notches || []).forEach(function (n) {
        if (n.to) line("NOTCH", n.from, n.to, pos);
        else if (n.from) add("NOTCH", ["0", "CIRCLE", "8", "NOTCH", "10", X(n.from, pos), "20", Y(n.from, pos), "30", "0.0", "40", f4(1.2)]);
      });
      if (g && g.ok) { var gl = g.held ? "GRAIN_HELD" : "GRAIN", a = g.from, b = g.to, Lg = Math.hypot(b.x - a.x, b.y - a.y) || 1, ux = (b.x - a.x) / Lg, uy = (b.y - a.y) / Lg, h = Math.min(0.8, Lg * 0.25), w = h * 0.35;
        line(gl, a, b, pos);
        [[b, 1], [a, -1]].forEach(function (t) { var q = t[0], sx = t[1]; line(gl, { x: q.x - sx * ux * h - uy * w, y: q.y - sx * uy * h + ux * w }, q, pos); line(gl, { x: q.x - sx * ux * h + uy * w, y: q.y - sx * uy * h - ux * w }, q, pos); }); }
      // 글자: ASCII 조각 id 줄(항상 읽힘) + 한글 이름(\U+ 표기) + 수량 + 식서 상태 + 골 상태
      var bb = r.bbox, bw = bb.maxX - bb.minX, bh = bb.maxY - bb.minY, cx = (bb.minX + bb.maxX) / 2, cy = (bb.minY + bb.maxY) / 2, tall = bh > bw * 1.5 && bw < 9, room = tall ? bw : bh;
      var h1 = Math.max(0.25, Math.min(0.6, room / 9)), h2 = Math.max(0.2, h1 * 0.7), gk = row.grain.kind;
      var lines = [["PIECE " + it.pname, h1], [it.label, h2],
        [row.qty.kind === "none" ? "QTY UNSET" : "QTY " + row.qty.n + (row.qty.kind === "default" ? " (DEFAULT)" : " (USER)"), h2],
        [gk === "default" ? "GRAIN " + row.grain.angleDeg + " DEG (" + (/앱 기본값/.test(row.grain.basis || "") ? "APP DEFAULT" : "BOOK DEFAULT") + ")" : gk === "user" ? "GRAIN " + row.grain.angleDeg + " DEG (USER)" : gk === "held" ? (row.grain.shown ? "GRAIN HELD - LINE ON GRAIN_HELD IS PROVISIONAL" : "GRAIN HELD - NO DIRECTION") : gk === "none" ? "GRAIN UNSET" : "GRAIN NOT DRAWN",  h2]];
      if (r.unfolded) lines.push(["FOLD OPENED - ONE FULL PIECE", h2]); else if (foldN) lines.push(["CUT ON FOLD", h2]);
      var off = -(lines.length - 1) * h2 * 0.8;
      lines.forEach(function (ln) { var q = tall ? { x: cx + off, y: cy } : { x: cx, y: cy + off }; text(q, pos, ln[1] * 10, ln[0], tall ? 90 : 0); off += h2 * 1.6; });
      pieces.push({ id: it.pname, base: p.id, side: (r.pair || r.instMirrored) ? r.side : null, label: it.label, unfolded: !!r.unfolded, qty: row.qty.n, qtyKind: row.qty.kind, grainKind: gk, cutVertices: closedRing(r.seam).length, notches: (r.notches || []).length });
    });
    var wMm = (maxX - minX) * 10, hMm = (maxY - minY) * 10, o = [];
    var push = function () { for (var i = 0; i < arguments.length; i++) o.push(String(arguments[i])); };
    push("999", "DOROBO cut pattern - units mm - scale 1:1 - generic DXF R12 (not AAMA/ASTM)", "999", "version " + asc(meta.version || "") + " result " + asc(pre.resultHash) + (meta.createdAt ? " created " + asc(meta.createdAt) : ""));
    push("0", "SECTION", "2", "HEADER", "9", "$ACADVER", "1", "AC1009", "9", "$INSBASE", "10", "0.0", "20", "0.0", "30", "0.0",
      "9", "$EXTMIN", "10", "0.0", "20", "0.0", "30", "0.0", "9", "$EXTMAX", "10", f4(wMm), "20", f4(hMm), "30", "0.0",
      "9", "$LIMMIN", "10", "0.0", "20", "0.0", "9", "$LIMMAX", "10", f4(wMm), "20", f4(hMm),
      "9", "$LUNITS", "70", "2", "9", "$LUPREC", "70", "4", "9", "$INSUNITS", "70", "4", "9", "$MEASUREMENT", "70", "1", "0", "ENDSEC");
    push("0", "SECTION", "2", "TABLES", "0", "TABLE", "2", "LTYPE", "70", "2",
      "0", "LTYPE", "2", "CONTINUOUS", "70", "0", "3", "Solid line", "72", "65", "73", "0", "40", "0.0",
      "0", "LTYPE", "2", "DASHED", "70", "0", "3", "Dashed __ __ __", "72", "65", "73", "2", "40", "7.5", "49", "5.0", "49", "-2.5", "0", "ENDTAB",
      "0", "TABLE", "2", "LAYER", "70", String(LAYERS.length + 1), "0", "LAYER", "2", "0", "70", "0", "62", "7", "6", "CONTINUOUS");
    LAYERS.forEach(function (l) { push("0", "LAYER", "2", l[0], "70", "0", "62", l[1], "6", l[2]); });
    push("0", "ENDTAB", "0", "TABLE", "2", "STYLE", "70", "1", "0", "STYLE", "2", "STANDARD", "70", "0", "40", "0.0", "41", "1.0", "50", "0.0", "71", "0", "42", "2.5", "3", "txt", "4", "", "0", "ENDTAB", "0", "ENDSEC");
    push("0", "SECTION", "2", "BLOCKS", "0", "ENDSEC", "0", "SECTION", "2", "ENTITIES");
    for (var i = 0; i < E.length; i++) o.push(E[i]);
    push("0", "ENDSEC", "0", "EOF");
    var day = dayOf(meta);
    return { ok: true, format: "generic", pre: pre, dxf: o.join("\r\n") + "\r\n", fileName: "DOROBO_cut_" + String(pre.resultHash).replace(/[^A-Za-z0-9]/g, "") + (day ? "_" + day : "") + ".dxf",
      stats: { widthMm: wMm, heightMm: hMm, tolMm: TOL_CM * 10, layers: count, pieces: pieces }, resultHash: pre.resultHash };
  }

  // ── AAMA/ASTM D6673 구조를 따른 DXF(조각마다 BLOCK 하나 · 숫자 레이어 · 조각/스타일 글자) ──
  //   확인한 것(공개 자료): 레이어 번호 1 재단선 · 2 꺾임점 · 3 곡선점 · 4 너치 · 6 대칭(골)선 · 7 식서 · 8 안쪽 선 · 14 봉제(완성)선 · 15 주석,
  //     조각마다 블록 하나, 글자 항목 «Piece Name: / Size: / Quantity: / Annotation:» «Style Name: / Creation Date: / Creation Time: / Author: / Sample Size: / Units: METRIC».
  //   확인하지 못한 것(관례대로 씀 · 실제 CAD 에서 미검증): 너치 = 레이어 4 의 POINT(재단선 쪽 끝 · 50 = 안쪽 방향 각 · 39 = 길이) · ENTITIES 의 INSERT · 판 R12.
  //   규격 인증·특정 CAD 호환을 뜻하지 않는다. 그레이딩 규칙표(.rul)는 만들지 않는다(사이즈 하나).
  var AAMA_LAYERS = [["1", 7, "재단선(시접 포함) · 조각/스타일 글자"], ["2", 1, "꺾임점"], ["3", 3, "곡선점"], ["4", 1, "너치"], ["6", 6, "대칭(골)선 — 반쪽 조각"], ["7", 4, "식서"], ["8", 5, "안쪽 선(자르지 않음)"], ["14", 2, "봉제선(완성선)"], ["15", 8, "주석"]];
  var TURN_DEG = 12;   // 재단선 꼭짓점에서 방향이 이만큼 넘게 꺾이면 꺾임점(레이어 2), 아니면 곡선점(레이어 3)
  function blockName(id) { return String(id).replace(/[^A-Za-z0-9]+/g, "_").toUpperCase() + "_BASE"; }
  function buildAama(proj, meta) {
    var c = collect(proj); if (!c.ok) return c;
    meta = meta || {};
    var pre = c.pre, items = c.items, minX = c.minX, maxX = c.maxX, minY = c.minY, maxY = c.maxY, notes = [];
    var X = function (q, pos) { return f4((q.x + pos.dx - minX) * 10); }, Y = function (q, pos) { return f4((maxY - (q.y + pos.dy)) * 10); };
    var count = {}, B = [], INS = [], pieces = [];
    items.forEach(function (it) {
      var p = it.p, r = it.r, pos = it.pos, row = it.row, g = it.g, name = blockName(it.pname), E = [];
      var add = function (layer, arr) { count[layer] = (count[layer] || 0) + 1; for (var i = 0; i < arr.length; i++) E.push(arr[i]); };
      var poly = function (layer, pts, closed) { var a = ["0", "POLYLINE", "8", layer, "66", "1", "10", "0.0", "20", "0.0", "30", "0.0", "70", closed ? "1" : "0"];
        pts.forEach(function (q) { a.push("0", "VERTEX", "8", layer, "10", X(q, pos), "20", Y(q, pos), "30", "0.0"); }); a.push("0", "SEQEND", "8", layer); add(layer, a); };
      var line = function (layer, a, b) { add(layer, ["0", "LINE", "8", layer, "10", X(a, pos), "20", Y(a, pos), "30", "0.0", "11", X(b, pos), "21", Y(b, pos), "31", "0.0"]); };
      var point = function (layer, q, extra) { add(layer, ["0", "POINT", "8", layer, "10", X(q, pos), "20", Y(q, pos), "30", "0.0"].concat(extra || [])); };
      var cut = closedRing(r.seam), n = cut.length, turn = 0, curve = 0;
      poly("1", cut, true);
      cut.forEach(function (q, i) { var a = cut[(i + n - 1) % n], b = cut[(i + 1) % n], t = Math.abs(Math.atan2(b.y - q.y, b.x - q.x) - Math.atan2(q.y - a.y, q.x - a.x)) * 180 / Math.PI; if (t > 180) t = 360 - t;
        if (t > TURN_DEG) { turn++; point("2", q); } else { curve++; point("3", q); } });
      var fin = chains(r.outline); fin.forEach(function (ch) { poly("14", fin.length === 1 ? closedRing(ch) : ch, fin.length === 1); });
      // 접어 정리한 완성 외곽도 레이어 14 의 닫힌 선으로(master 확정: 다트 봉제선과 정리 외곽 둘 다 필요 — 한쪽을 중복으로 지우지 않는다)
      if (r.trued) { var tr1 = chains(r.trued); tr1.forEach(function (ch) { poly("14", tr1.length === 1 ? closedRing(ch) : ch, tr1.length === 1); }); }
      (r.marks || []).forEach(function (mk) { var zone = mk.kind.indexOf("zone-") === 0; chains(mk.segs).forEach(function (ch) { if (ch.length === 2 && !zone) line("8", ch[0], ch[1]); else poly("8", zone ? closedRing(ch) : ch, zone); }); });
      (r.guides || []).forEach(function (gd) { if (gd.line) line("8", gd.a, gd.b); add("15", ["0", "TEXT", "8", "15", "10", X({ x: gd.tx, y: gd.ty }, pos), "20", Y({ x: gd.tx, y: gd.ty }, pos), "30", "0.0", "40", f4(gd.th * 10), "1", gd.text, "72", "1", "11", X({ x: gd.tx, y: gd.ty }, pos), "21", Y({ x: gd.tx, y: gd.ty }, pos), "31", "0.0"]); });
      var foldN = 0;
      (r.edges || []).forEach(function (e) { var se = (it.sm.edges || []).filter(function (x) { return x.id === e.id; })[0]; if (!se || se.kind !== "fold") return;
        var layer = r.unfolded ? "8" : "6";   // 펼친 한 장 = 가운데 선은 안쪽 선 · 반쪽 그대로 = 대칭선
        chains(e.parts[0]).forEach(function (ch) { foldN++; if (ch.length === 2) line(layer, ch[0], ch[1]); else poly(layer, ch, false); }); });
      var dCut = function (q) { var m = Infinity; for (var i = 0; i < n; i++) { var a = cut[i], b = cut[(i + 1) % n], vx = b.x - a.x, vy = b.y - a.y, l2 = vx * vx + vy * vy, t = l2 ? Math.max(0, Math.min(1, ((q.x - a.x) * vx + (q.y - a.y) * vy) / l2)) : 0; m = Math.min(m, Math.hypot(q.x - a.x - vx * t, q.y - a.y - vy * t)); } return m; };
      var nN = 0, nIn = 0;
      (r.notches || []).forEach(function (nt) {
        if (!nt.to) { if (nt.from) { nIn++; point("8", nt.from); } return; }
        var outer = dCut(nt.from) <= dCut(nt.to) ? nt.from : nt.to, inner = outer === nt.from ? nt.to : nt.from;
        var ang = Math.atan2(-(inner.y - outer.y), inner.x - outer.x) * 180 / Math.PI; if (ang < 0) ang += 360;
        nN++; point("4", outer, ["39", f4(Math.hypot(inner.x - outer.x, inner.y - outer.y) * 10), "50", f4(ang)]);
      });
      var gk = row.grain.kind;
      if (g && g.ok && !g.held) line("7", g.from, g.to);
      // 조각 글자(레이어 1): 규격 항목은 ASCII 만
      var bb = r.bbox, cx = (bb.minX + bb.maxX) / 2, cy = (bb.minY + bb.maxY) / 2, h = Math.max(0.2, Math.min(0.5, Math.min(bb.maxX - bb.minX, bb.maxY - bb.minY) / 10)), T = [];
      T.push("Piece Name: " + asc(it.pname).replace(/\\U\+[0-9A-F]{4}/g, "?"), "Size: BASE");
      if (row.qty.kind !== "none") T.push("Quantity: " + row.qty.n); else notes.push("«" + it.label + "» 수량 미정 — Quantity 항목을 넣지 않았습니다");
      T.push("Annotation: " + (r.unfolded ? "FULL PIECE (FOLD OPENED)" : foldN ? "CUT ON FOLD" : (r.pair || r.instMirrored) ? (r.side === "R" ? "RIGHT" : "LEFT") + " (WEARER) MIRROR PAIR" : "SINGLE PIECE") + (row.qty.kind === "default" ? " / QTY DEFAULT" : row.qty.kind === "user" ? " / QTY USER" : " / QTY UNSET") +
        (gk === "default" ? " / GRAIN " + row.grain.angleDeg + (/앱 기본값/.test(row.grain.basis || "") ? " APP DEFAULT" : " BOOK DEFAULT") : gk === "user" ? " / GRAIN " + row.grain.angleDeg + " USER" : gk === "held" ? " / GRAIN HELD - NOT EXPORTED" : gk === "none" ? " / GRAIN UNSET" : " / GRAIN NOT DRAWN"));
      if (gk === "held") notes.push("«" + p.label + "» 식서 보류 — 식서선(레이어 7)을 넣지 않았습니다(임시 기본 방향을 확정된 것처럼 내보내지 않음)");
      else if (gk === "none" || gk === "unfit") notes.push("«" + p.label + "» 식서 없음 — 식서선(레이어 7)이 없습니다");
      var off = -(T.length - 1) * h * 0.8;
      T.forEach(function (s) { var q = { x: cx, y: cy + off }; off += h * 1.6; add("1", ["0", "TEXT", "8", "1", "10", X(q, pos), "20", Y(q, pos), "30", "0.0", "40", f4(h * 10), "1", s]); });
      B.push("0", "BLOCK", "8", "1", "2", name, "70", "0", "10", "0.0", "20", "0.0", "30", "0.0", "3", name);
      for (var i = 0; i < E.length; i++) B.push(E[i]);
      B.push("0", "ENDBLK", "8", "1");
      INS.push("0", "INSERT", "8", "1", "2", name, "10", "0.0", "20", "0.0", "30", "0.0");
      pieces.push({ id: it.pname, base: p.id, side: (r.pair || r.instMirrored) ? r.side : null, block: name, label: it.label, unfolded: !!r.unfolded, qty: row.qty.n, qtyKind: row.qty.kind, grainKind: gk, cutVertices: n, turnPoints: turn, curvePoints: curve, notches: nN, innerMarks: nIn });
    });
    var wMm = (maxX - minX) * 10, hMm = (maxY - minY) * 10, o = [], day = dayOf(meta), tm = String(meta.createdAt || "").slice(11, 16);
    var push = function () { for (var i = 0; i < arguments.length; i++) o.push(String(arguments[i])); };
    push("999", "DOROBO cut pattern - AAMA/ASTM D6673 style structure (not certified) - units mm - scale 1:1");
    push("0", "SECTION", "2", "HEADER", "9", "$ACADVER", "1", "AC1009", "9", "$INSBASE", "10", "0.0", "20", "0.0", "30", "0.0",
      "9", "$EXTMIN", "10", "0.0", "20", "0.0", "30", "0.0", "9", "$EXTMAX", "10", f4(wMm), "20", f4(hMm), "30", "0.0", "0", "ENDSEC");
    push("0", "SECTION", "2", "TABLES", "0", "TABLE", "2", "LTYPE", "70", "1", "0", "LTYPE", "2", "CONTINUOUS", "70", "0", "3", "Solid line", "72", "65", "73", "0", "40", "0.0", "0", "ENDTAB",
      "0", "TABLE", "2", "LAYER", "70", String(AAMA_LAYERS.length));
    AAMA_LAYERS.forEach(function (l) { push("0", "LAYER", "2", l[0], "70", "0", "62", l[1], "6", "CONTINUOUS"); });
    push("0", "ENDTAB", "0", "TABLE", "2", "STYLE", "70", "1", "0", "STYLE", "2", "STANDARD", "70", "0", "40", "0.0", "41", "1.0", "50", "0.0", "71", "0", "42", "2.5", "3", "txt", "4", "", "0", "ENDTAB", "0", "ENDSEC");
    push("0", "SECTION", "2", "BLOCKS"); for (var i = 0; i < B.length; i++) o.push(B[i]); push("0", "ENDSEC", "0", "SECTION", "2", "ENTITIES");
    var hash = String(pre.resultHash).replace(/[^A-Za-z0-9]/g, ""), dm = day ? day.slice(8, 10) + "-" + day.slice(5, 7) + "-" + day.slice(0, 4) : "";
    var ST = ["Style Name: DOROBO_" + hash, "Creation Date: " + dm, "Creation Time: " + (tm ? tm + ":00" : ""), "Author: DOROBO " + asc(meta.version || ""), "Sample Size: BASE", "Units: METRIC"];
    ST.forEach(function (s2, k) { push("0", "TEXT", "8", "1", "10", "0.0", "20", f4(hMm + 60 - k * 8), "30", "0.0", "40", "5.0", "1", s2); });
    for (var j = 0; j < INS.length; j++) o.push(INS[j]);
    push("0", "ENDSEC", "0", "EOF");
    return { ok: true, format: "aama", pre: pre, dxf: o.join("\r\n") + "\r\n", fileName: "DOROBO_cut_" + hash + (day ? "_" + day : "") + "_AAMA.dxf", notes: notes,
      stats: { widthMm: wMm, heightMm: hMm, tolMm: TOL_CM * 10, layers: count, pieces: pieces }, resultHash: pre.resultHash };
  }

  // 파일 저장(브라우저 내려받기) — 사전 점검을 통과할 때만. 화면을 읽지 않는다.
  function download(proj, meta, opt) {
    var b = build(proj, meta, opt); if (!b.ok) return { ok: false, reason: b.reason, blockers: b.blockers };
    var w = W(), doc = w.document; if (!doc || !w.Blob || !w.URL || !w.URL.createObjectURL) return { ok: false, reason: "이 브라우저에서는 파일을 저장할 수 없습니다" };
    var url = w.URL.createObjectURL(new w.Blob([b.dxf], { type: "application/dxf" })), a = doc.createElement("a");
    a.href = url; a.download = b.fileName; a.style.display = "none"; doc.body.appendChild(a); a.click();
    w.setTimeout(function () { if (a.parentNode) a.parentNode.removeChild(a); w.URL.revokeObjectURL(url); }, 1000);
    return { ok: true, format: b.format, fileName: b.fileName, bytes: b.dxf.length, stats: b.stats, notes: b.notes || [] };
  }
  W().cutDxf = Object.freeze({ TOL_MM: TOL_CM * 10, LAYERS: LAYERS.map(function (l) { return { name: l[0], color: l[1], ltype: l[2], what: l[3] }; }), AAMA_LAYERS: AAMA_LAYERS.map(function (l) { return { name: l[0], color: l[1], what: l[2] }; }), TURN_DEG: TURN_DEG, build: build, download: download });
})();
