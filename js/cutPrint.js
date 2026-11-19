// ══════════════════════════════════════════════
// cutPrint.js — 재단 결과를 실물 크기(1:1) A4 이어 붙이기 종이로 인쇄(2026-11-16 master 승인)
//   방법(기록): 브라우저의 «시스템 인쇄»를 쓴다 — 인쇄 창에서 대상을 «PDF로 저장»으로 고르면 PDF 가 된다.
//     · 이유: 의존 라이브러리 0 · 한글 조각 이름을 글꼴 내장 없이 그대로 · 선은 벡터 · 전부 이 기기 안에서 끝남(전송 없음).
//     · 이 모듈은 PDF 파일을 직접 만들어 내려받지 않는다 → 화면 문구도 «인쇄 창 열기»로만 적는다.
//   치수: 조각 좌표 1 = 1cm. 타일 SVG 는 width/height 를 mm 로, viewBox 를 cm 로 주므로(1cm = 10mm) 화면 배율·카메라·DPR 과 무관하다.
//   읽기 전용: cutPrep 의 derive·seam·displayOf·layoutOf·qtyOf·grainOf 결과만 읽는다. 원본 도형·완료 hash·저장값을 쓰지 않는다.
//   골을 펼친 조각은 한 장으로(displayOf 가 이미 펼친 것) — 여기서 다시 반사하지 않고, 수량만큼 복제하지 않는다.
//   배치: 재단 화면과 같은 layoutOf 한 벌을 그대로 큰 한 장으로 보고 A4 로 나눈다(원단 마커·자동 최적 배치 아님).
// ══════════════════════════════════════════════
(function () {
  "use strict";
  function W() { return (typeof window !== "undefined") ? window : {}; }
  var DEF = { paperWmm: 210, paperHmm: 297, marginMm: 10, overlapMm: 10, safetyMm: 1, padCm: 0.5, bandMm: 12 };   // bandMm = 각 장 위쪽 안내 띠(장 이름·검척선·이웃 장) — 패턴 영역과 겹치지 않는 예약 자리
  var LIM = { marginMin: 3, marginMax: 30, overlapMin: 0, overlapMax: 40, stepMinMm: 60 };
  var JOIN = "#b3005e";    // 이어 붙이기 표시 전용 색(붙임선·자름선·맞춤 표시) — 패턴 선(검정)과 색·선 모양으로 구별
  var GAUGE = "#006699";   // 검척선 전용 색(실제 PDF 검사에서 이 색 선을 찾아 길이를 잰다)
  function fin(v) { return typeof v === "number" && Number.isFinite(v); }
  function n4(v) { var x = Math.round(v * 1e4) / 1e4; return (x === 0 ? 0 : x).toString(); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]; }); }
  function fmt(v) { return (Math.round(v * 10) / 10).toFixed(1); }

  // 여백·겹침(mm) 검증. 고칠 수 있는 값은 이 둘뿐(용지 = A4 세로 고정).
  function optsOf(o) {
    o = o || {}; var m = "marginMm" in o ? o.marginMm : DEF.marginMm, ov = "overlapMm" in o ? o.overlapMm : DEF.overlapMm;
    if (!fin(m) || m < LIM.marginMin || m > LIM.marginMax) return { ok: false, reason: "프린터 여백은 " + LIM.marginMin + "~" + LIM.marginMax + "mm 사이 숫자로 적어 주세요" };
    if (!fin(ov) || ov < LIM.overlapMin || ov > LIM.overlapMax) return { ok: false, reason: "겹침은 " + LIM.overlapMin + "~" + LIM.overlapMax + "mm 사이 숫자로 적어 주세요" };
    m = Math.round(m * 10) / 10; ov = Math.round(ov * 10) / 10;
    var wMm = DEF.paperWmm - 2 * m, pgH = DEF.paperHmm - 2 * m - DEF.safetyMm, hMm = pgH - DEF.bandMm;   // win* = 패턴 영역(안내 띠 제외)
    if (wMm - ov < LIM.stepMinMm || hMm - ov < LIM.stepMinMm) return { ok: false, reason: "여백·겹침이 너무 커서 한 장에 그릴 자리가 모자랍니다" };
    return { ok: true, marginMm: m, overlapMm: ov, pageWmm: wMm, pageHmm: pgH, bandMm: DEF.bandMm, pageW: wMm / 10, pageH: pgH / 10, band: DEF.bandMm / 10, winWmm: wMm, winHmm: hMm, winW: wMm / 10, winH: hMm / 10, stepX: (wMm - ov) / 10, stepY: (hMm - ov) / 10, ov: ov / 10 };
  }

  // ── 사전 점검: 막는 문제(blockers) / 알림(warnings) / 조각별 수량·식서 상태(rows) ──
  function preflight(proj) {
    var C = W().cutPrep, out = { ok: false, blockers: [], warnings: [], rows: [], attention: [] };
    if (!C) { out.blockers.push("재단 모듈을 불러오지 못했습니다"); return out; }
    proj = proj || (W().designWorkflow && W().designWorkflow.current && W().designWorkflow.current()) || null;
    var d = C.derive(proj, true);
    if (d.state !== "ready") { out.blockers.push(d.reason || "재단 준비가 끝나지 않았습니다"); return out; }
    var m = C.seam(d, proj), D = C.displayOf(d, m), L = C.layoutOf(d.pieces, D), Q = C.qtyOf(d, D, proj), G = C.grainOf(d, D, proj);
    out.d = d; out.m = m; out.D = D; out.L = L; out.Q = Q; out.G = G; out.resultHash = d.resultHash;
    if (m.state !== "ready") out.blockers.push("시접을 계산할 수 없습니다(" + m.state + ")");
    if (m.spec && m.spec.state === "invalid") out.blockers.push("저장된 시접 설정을 읽을 수 없습니다 — " + m.spec.reason);
    if (m.notchSpec && m.notchSpec.state === "invalid") out.blockers.push("저장된 맞춤 표시 설정을 읽을 수 없습니다 — " + m.notchSpec.reason);
    if (Q.state === "invalid") out.blockers.push("저장된 재단 수량 설정을 읽을 수 없습니다 — " + Q.reason);
    if (G.state === "invalid") out.blockers.push("저장된 식서 설정을 읽을 수 없습니다 — " + G.reason);
    if (m.dartSpec && m.dartSpec.state === "invalid") out.blockers.push("저장된 다트 정리 설정을 읽을 수 없습니다 — " + m.dartSpec.reason);
    (d.missing || []).forEach(function (x) { out.blockers.push("미완성 — " + x.label + ": " + x.reason); });
    var shown = 0;
    d.pieces.forEach(function (p) {
      if (!p.check.ok) { out.blockers.push("«" + p.label + "» 외곽 검사 실패 — " + (p.check.reason || "이유 없음")); return; }
      var sm = m.pieces ? m.pieces[p.id] : null, r = D[p.id];
      if (!sm || !sm.ok || !r || !r.seam) { out.blockers.push("«" + p.label + "» 시접선 미완 — 재단선을 닫지 못했습니다"); return; }
      if (r.seamWhy) { out.blockers.push("«" + p.label + "» 펼친 시접선 문제 — " + r.seamWhy); return; }
      shown++;
      (sm.notches || []).filter(function (n) { return n.held; }).forEach(function (n) { out.attention.push("«" + p.label + "» 맞춤 «" + n.name + "» 보류 — 다트 입구 정리로 그 자리 완성선이 바뀜(어긋남 " + n.heldDevCm + "cm · 기울기 " + n.heldDevDeg + "°) · 인쇄·DXF 에서 뺍니다(위치를 옮기지 않음 · 저장값 그대로)"); });
      if (r.foldWhy) out.warnings.push("«" + p.label + "» 골선을 펼치지 못해 반쪽으로 인쇄합니다(골선 표시) — " + r.foldWhy);
      // ⑦ 앞판 좌우 한 쌍: 보이는 조각마다 한 줄(각 1장 · 같은 설정을 반사). 쌍이 아닐 때는 예전과 같은 한 줄.
      var insts = r.pair && D[r.pair.mirrorId] ? [p.id, r.pair.mirrorId] : [p.id];
      insts.forEach(function (iid) {
        var ri = D[iid], lab = ri.label || p.label, paired = insts.length > 1, q = (paired && Q.inst && Q.inst[iid]) || Q.pieces[p.id] || {}, g = G.pieces[iid] || {};
        var row = { id: iid, base: p.id, label: lab, unfolded: !!ri.unfolded, paired: paired, side: paired ? ri.side : null,
          qty: { n: q.qty == null ? null : q.qty, kind: q.qty == null ? "none" : q.explicit ? "user" : "default", how: q.how || "" },
          grain: { kind: g.held ? "held" : g.angleDeg == null ? "none" : !g.ok ? "unfit" : (g.explicitAngle || g.explicitAt) ? "user" : "default", angleDeg: g.angleDeg == null ? null : g.angleDeg, shown: !!g.ok, basis: g.basis || null, why: g.why || g.heldWhy || null } };
        out.rows.push(row);
        if (row.qty.kind === "none") out.attention.push("«" + lab + "» 재단 수량 미정 — 종이에 «수량 미정»으로 인쇄됩니다");
        if (row.grain.kind === "held") out.attention.push("«" + lab + "» 식서 보류 — " + (row.grain.shown ? "임시 기본 방향을 점선으로 인쇄합니다" : "화살표 없이 «식서 보류»로 인쇄합니다") + "(저장해 둔 설정은 적용하지 않음)");
        if (row.grain.kind === "none") out.attention.push("«" + lab + "» 식서 방향 미정 — 화살표 없이 «식서 미정»으로 인쇄됩니다");
        if (row.grain.kind === "unfit") out.attention.push("«" + lab + "» 식서 화살표가 조각 안에 들어가지 않아 인쇄되지 않습니다");
      });
    });
    out.pairing = m.pairing || null;   // ⑦ 쌍으로 펼치지 않은 사유(reason)는 경고가 아니라 참고 — 기존 수량·표시 그대로이므로 화면 «참고»에서만 알린다
    if (!shown && !out.blockers.length) out.blockers.push("인쇄할 조각이 없습니다");
    if (m.orphans && m.orphans.length) out.warnings.push("연결이 끊긴 시접 설정 " + m.orphans.length + "건 — 인쇄에 쓰이지 않습니다");
    if (m.notchOrphans && m.notchOrphans.length) out.warnings.push("연결이 끊긴 맞춤 표시 " + m.notchOrphans.length + "건 — 인쇄되지 않습니다");
    if (Q.stale && Q.stale.length) out.warnings.push("지금 없는 조각의 수량 설정 " + Q.stale.length + "건 — 쓰이지 않습니다");
    if (G.stale && G.stale.length) out.warnings.push("지금 없는 조각의 식서 설정 " + G.stale.length + "건 — 쓰이지 않습니다");
    out.ok = out.blockers.length === 0;
    return out;
  }

  // ── 도형 → SVG 글자 ──
  function cubicAt(s, t) { var u = 1 - t; return { x: u * u * u * s.from.x + 3 * u * u * t * s.c1.x + 3 * u * t * t * s.c2.x + t * t * t * s.to.x, y: u * u * u * s.from.y + 3 * u * u * t * s.c1.y + 3 * u * t * t * s.c2.y + t * t * t * s.to.y }; }
  function sample(segs, n) { var o = []; segs.forEach(function (s) { if (s.kind !== "cubic") { o.push(s.from); return; } for (var k = 0; k < n; k++) o.push(cubicAt(s, k / n)); }); return o; }
  function pathD(segs) {
    var o = [], last = null;
    segs.forEach(function (s) {
      if (!last || Math.abs(last.x - s.from.x) > 1e-9 || Math.abs(last.y - s.from.y) > 1e-9) o.push("M" + n4(s.from.x) + " " + n4(s.from.y));
      o.push(s.kind === "cubic" ? "C" + n4(s.c1.x) + " " + n4(s.c1.y) + " " + n4(s.c2.x) + " " + n4(s.c2.y) + " " + n4(s.to.x) + " " + n4(s.to.y) : "L" + n4(s.to.x) + " " + n4(s.to.y));
      last = s.to;
    });
    return o.join(" ");
  }
  function polyD(pts) { return pts.map(function (q, i) { return (i ? "L" : "M") + n4(q.x) + " " + n4(q.y); }).join(" ") + " Z"; }
  function grainD(a, b) {   // cutPrep.grainD 와 같은 모양(가운데 선 + 양 끝 화살촉)
    var L = Math.hypot(b.x - a.x, b.y - a.y) || 1, ux = (b.x - a.x) / L, uy = (b.y - a.y) / L, h = Math.min(0.8, L * 0.25), w = h * 0.35;
    var head = function (t, sx) { return "M" + n4(t.x - sx * ux * h - uy * w) + " " + n4(t.y - sx * uy * h + ux * w) + " L" + n4(t.x) + " " + n4(t.y) + " L" + n4(t.x - sx * ux * h + uy * w) + " " + n4(t.y - sx * uy * h - ux * w); };
    return "M" + n4(a.x) + " " + n4(a.y) + " L" + n4(b.x) + " " + n4(b.y) + " " + head(b, 1) + " " + head(a, -1);
  }
  function txt(cls, x, y, fs, s, extra) { return "<text class=\"" + cls + "\" x=\"" + n4(x) + "\" y=\"" + n4(y) + "\" font-size=\"" + n4(fs) + "\"" + (extra || "") + ">" + esc(s) + "</text>"; }

  // ── 타일이 필요한가: 재단선 다각형(또는 글자 상자)이 그 칸에 닿는가 ──
  function inPoly(q, poly) { var c = false; for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) { var a = poly[i], b = poly[j]; if ((a.y > q.y) !== (b.y > q.y) && q.x < (b.x - a.x) * (q.y - a.y) / (b.y - a.y) + a.x) c = !c; } return c; }
  function segHitsRect(a, b, R) {   // Liang–Barsky
    var t0 = 0, t1 = 1, dx = b.x - a.x, dy = b.y - a.y, P = [-dx, dx, -dy, dy], Qv = [a.x - R.x0, R.x1 - a.x, a.y - R.y0, R.y1 - a.y];
    for (var i = 0; i < 4; i++) { if (P[i] === 0) { if (Qv[i] < 0) return false; } else { var t = Qv[i] / P[i]; if (P[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; } } }
    return true;
  }
  function polyHitsRect(poly, bb, R) {
    if (bb.x1 < R.x0 || bb.x0 > R.x1 || bb.y1 < R.y0 || bb.y0 > R.y1) return false;
    for (var i = 0; i < poly.length; i++) if (segHitsRect(poly[i], poly[(i + 1) % poly.length], R)) return true;
    return inPoly({ x: (R.x0 + R.x1) / 2, y: (R.y0 + R.y1) / 2 }, poly);
  }
  function bbOf(pts) { var b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }; pts.forEach(function (q) { if (q.x < b.x0) b.x0 = q.x; if (q.x > b.x1) b.x1 = q.x; if (q.y < b.y0) b.y0 = q.y; if (q.y > b.y1) b.y1 = q.y; }); return b; }

  var LABEL_CM = 0.32;   // 선 이름 글자 3.2mm(실물)
  // 한 조각 → SVG 글자 + 덮는 영역(재단선 다각형 · 글자 상자) — 조각 좌표에 배치 이동(dx,dy)을 얹는다
  function pieceSvg(p, r, pos, row, sm, g) {
    var o = [], shapes = [], T = function (q) { return { x: q.x + pos.dx, y: q.y + pos.dy }; }, sgn = r.instMirrored ? -1 : 1, plab = row.label || p.label;   // sgn: 거울 쪽 글자 위치만 반대로(글자 자체는 뒤집지 않음)
    o.push("<g class=\"cp-piece\" data-piece=\"" + esc(row.id || p.id) + "\" transform=\"translate(" + n4(pos.dx) + " " + n4(pos.dy) + ")\">");
    o.push("<path class=\"cp-cut\" d=\"" + polyD(r.seam) + "\"/>");
    o.push("<path class=\"cp-fin\" d=\"" + pathD(r.outline) + " Z\"/>");
    if (r.trued) o.push("<path class=\"cp-fin cp-trued\" d=\"" + pathD(r.trued) + " Z\"/>");   // 접어 정리한 완성 외곽(다트 긴 V 는 위 완성선에 그대로)
    var cut = r.seam.map(T); shapes.push({ pts: cut, bb: bbOf(cut) });
    var fo = sample(r.outline, 24).map(T); shapes.push({ pts: fo, bb: bbOf(fo) });
    r.marks.forEach(function (mk) {
      var zone = mk.kind.indexOf("zone-") === 0;
      o.push("<path class=\"" + (zone ? "cp-zone" : "cp-mark") + "\" d=\"" + pathD(mk.segs) + (zone ? " Z" : "") + "\"/>");
      if (!mk.label || mk.mirrored) return;
      var s0 = mk.segs[0], ly = s0.from.y + (s0.to.y - s0.from.y) * (mk.kind === "cf" ? 0.3 : 0.62), lx = s0.from.x - 0.15 * sgn;
      o.push(txt("cp-lab", lx, ly, LABEL_CM, mk.label, " transform=\"rotate(-90 " + n4(lx) + " " + n4(ly) + ")\""));
    });
    if (p.placket && p.placket.facingWidthCm > 0) { var ex = (r.instMirrored ? -p.placket.cutX : p.placket.cutX) + 0.45 * sgn, ey = p.placket.topY + (p.placket.botY - p.placket.topY) * 0.46;
      o.push(txt("cp-lab", ex, ey, LABEL_CM, "안단 끝(외곽)", " transform=\"rotate(-90 " + n4(ex) + " " + n4(ey) + ")\"")); }
    r.edges.forEach(function (e) {   // 골선: 펼친 조각 = 가운데 선 하나 · 펼치지 못한 조각 = 접어 재단 표시
      var se = sm.edges.filter(function (x) { return x.id === e.id; })[0]; if (!se || se.kind !== "fold") return;
      var segs = e.parts[0], a = segs[0].from, z = segs[segs.length - 1].to, mx = (a.x + z.x) / 2, my = (a.y + z.y) / 2, vert = Math.abs(a.x - z.x) < Math.abs(a.y - z.y);
      o.push("<path class=\"cp-fold\" d=\"" + pathD(segs) + "\"/>");
      o.push(txt("cp-lab", mx, my, LABEL_CM, r.unfolded ? "골(펼친 중심 — 자르지 않음)" : "골선 — 원단을 접어 이 선에 맞춤", " text-anchor=\"middle\" transform=\"" + (vert ? "rotate(-90 " + n4(mx) + " " + n4(my) + ") " : "") + "translate(0 -0.15)\""));
    });
    r.notches.forEach(function (n) {
      if (n.to) o.push("<path class=\"cp-notch\" d=\"M" + n4(n.from.x) + " " + n4(n.from.y) + " L" + n4(n.to.x) + " " + n4(n.to.y) + "\"/>");
      else if (n.from) o.push("<circle class=\"cp-notch-dot\" cx=\"" + n4(n.from.x) + "\" cy=\"" + n4(n.from.y) + "\" r=\"0.12\"/>");
    });
    if (g && g.ok) o.push("<path class=\"cp-grain" + (g.held ? " cp-grain-held" : "") + "\" d=\"" + grainD(g.from, g.to) + "\"/>");
    // 조각 글자: 이름 · 수량 · 치수 · 식서 상태(기본/직접 지정/보류/미정을 글자로 구별)
    var bb = r.bbox, w = bb.maxX - bb.minX, h = bb.maxY - bb.minY, cx = (bb.minX + bb.maxX) / 2, cy = (bb.minY + bb.maxY) / 2, tall = h > w * 1.5 && w < 9;
    var room = tall ? w : h, fs = Math.max(0.3, Math.min(0.7, room / 6)), fs2 = Math.max(0.26, fs * 0.62);
    var ql = row.qty.kind === "none" ? "수량 미정" : "재단 " + row.qty.n + "장" + (row.qty.how ? " · " + row.qty.how : "") + (row.qty.kind === "default" ? " (기본)" : " (직접 지정)");
    var gk = row.grain.kind, gl = gk === "default" ? "식서 " + row.grain.angleDeg + "° · " + (/앱 기본값/.test(row.grain.basis || "") ? "앱 기본" : "교재 기본") : gk === "user" ? "식서 " + row.grain.angleDeg + "° · 직접 지정" : gk === "held" ? (row.grain.shown ? "식서 보류 — 점선은 임시 기본" : "식서 보류 — 방향 미정") : gk === "none" ? "식서 미정" : "식서 표시 못함";
    var lines = [[plab, fs, "cp-name"], [ql, fs2, "cp-info"], ["완성 " + fmt(p.widthCm) + " × " + fmt(p.heightCm) + " cm" + (r.unfolded ? " · 골 펼친 한 장" : ""), fs2, "cp-info"], [gl, fs2, "cp-info"]];
    var rot = tall ? " transform=\"rotate(-90 " + n4(cx) + " " + n4(cy) + ")\"" : "", y = cy - fs * 0.6, wmax = 0;
    lines.forEach(function (ln, i) { o.push(txt(ln[2], cx, y, ln[1], ln[0], " text-anchor=\"middle\"" + rot)); y += (i === 0 ? fs2 * 1.5 : fs2 * 1.35); wmax = Math.max(wmax, String(ln[0]).length * ln[1]); });
    var hw = wmax / 2, hh = fs + fs2 * 4.5, lb = tall ? [{ x: cx - hh, y: cy - hw }, { x: cx + hh, y: cy - hw }, { x: cx + hh, y: cy + hw }, { x: cx - hh, y: cy + hw }] : [{ x: cx - hw, y: cy - hh }, { x: cx + hw, y: cy - hh }, { x: cx + hw, y: cy + hh }, { x: cx - hw, y: cy + hh }];
    lb = lb.map(T); shapes.push({ pts: lb, bb: bbOf(lb) });
    o.push("</g>");
    return { svg: sty(o.join("")), shapes: shapes };
  }

  // ── 전체 한 장 + 타일 나누기 ──
  //   meta = { version, createdAt } (글자만 · 계산에 쓰지 않음)
  function build(proj, optsRaw, meta) {
    var op = optsOf(optsRaw); if (!op.ok) return { ok: false, reason: op.reason, blockers: [op.reason] };
    var pre = preflight(proj); if (!pre.ok) return { ok: false, reason: pre.blockers[0], blockers: pre.blockers, pre: pre };
    meta = meta || {};
    var d = pre.d, D = pre.D, L = pre.L, parts = [], shapes = [], rowOf = {}; pre.rows.forEach(function (r) { rowOf[r.id] = r; });
    L.order.forEach(function (pid) {
      var bid = String(pid).replace(/~m$/, ""), p = d.pieces.filter(function (x) { return x.id === bid; })[0], r = D[pid], pos = L.pos[pid]; if (!p || !r || !pos || !rowOf[pid]) return;
      var ps = pieceSvg(p, r, pos, rowOf[pid], pre.m.pieces[bid], pre.G.pieces[pid]);
      parts.push(ps.svg); ps.shapes.forEach(function (s) { s.pid = pid; s.label = rowOf[pid].label || p.label; shapes.push(s); });
    });
    var all = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    shapes.forEach(function (s) { all.x0 = Math.min(all.x0, s.bb.x0); all.y0 = Math.min(all.y0, s.bb.y0); all.x1 = Math.max(all.x1, s.bb.x1); all.y1 = Math.max(all.y1, s.bb.y1); });
    var ox = all.x0 - DEF.padCm, oy = all.y0 - DEF.padCm, sw = all.x1 - all.x0 + 2 * DEF.padCm, sh = all.y1 - all.y0 + 2 * DEF.padCm;
    var cols = Math.max(1, Math.ceil((sw - op.ov) / op.stepX - 1e-9)), rows = Math.max(1, Math.ceil((sh - op.ov) / op.stepY - 1e-9));
    var need = {}, tiles = [], blank = 0;
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
      // 자기 칸(겹치지 않는 몫): 마지막 열·행은 창 끝까지. 모든 점은 정확히 한 칸의 몫이고 그 칸의 창(겹침 포함)에 들어 있다 → 빠지는 선이 없다.
      var own = { x0: ox + c * op.stepX, y0: oy + r * op.stepY, x1: c === cols - 1 ? ox + c * op.stepX + op.winW : ox + (c + 1) * op.stepX, y1: r === rows - 1 ? oy + r * op.stepY + op.winH : oy + (r + 1) * op.stepY };
      var win = { x0: own.x0, y0: own.y0, x1: own.x0 + op.winW, y1: own.y0 + op.winH };
      if (!shapes.some(function (s) { return polyHitsRect(s.pts, s.bb, own); })) { blank++; continue; }
      var names = []; shapes.forEach(function (s) { if (names.indexOf(s.label) < 0 && polyHitsRect(s.pts, s.bb, win)) names.push(s.label); });
      need[r + "," + c] = true; tiles.push({ r: r, c: c, x0: win.x0, y0: win.y0, pieces: names });
    }
    tiles.forEach(function (t, i) { t.page = i + 1; });
    var out = { ok: true, pre: pre, opts: op, meta: { version: meta.version || "", createdAt: meta.createdAt || "" }, resultHash: pre.resultHash,
      sheet: { x0: ox, y0: oy, wCm: sw, hCm: sh }, cols: cols, rows: rows, blank: blank, tiles: tiles, need: need, shapes: shapes, sheetSvg: parts.join("") };
    out.css = cssOf(op); out.body = bodyOf(out);
    return out;
  }

  function cssOf(op) {
    var R = "#cutPrintRoot ";
    return "@page{size:" + DEF.paperWmm + "mm " + DEF.paperHmm + "mm;margin:" + op.marginMm + "mm}" +
      R + "{font-family:-apple-system,\"Apple SD Gothic Neo\",\"Malgun Gothic\",\"Noto Sans KR\",sans-serif;color:#000;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}" +
      R + ".cp-pg{width:" + op.pageWmm + "mm;height:" + op.pageHmm + "mm;overflow:hidden;break-after:page;page-break-after:always;break-inside:avoid;page-break-inside:avoid;position:relative;margin:0;padding:0}" +
      R + ".cp-pg:last-child{break-after:auto;page-break-after:auto}" +
      R + "svg.cp-page{display:block;width:" + op.pageWmm + "mm;height:" + op.pageHmm + "mm}" +
      R + ".cp-guide{font-size:9.5pt;line-height:1.4}" + R + ".cp-guide h1{font-size:15pt;margin:0 0 2mm}" + R + ".cp-guide h2{font-size:10.5pt;margin:2.5mm 0 1mm}" +
      R + ".cp-guide ol," + R + ".cp-guide ul{margin:0;padding-left:5mm}" + R + ".cp-guide table{border-collapse:collapse;font-size:8.5pt}" +
      R + ".cp-guide td," + R + ".cp-guide th{border:0.2mm solid #888;padding:0.5mm 1.5mm;text-align:left}" + R + ".cp-guide .cp-warn{color:#8a3b00}" + R + ".cp-guide{max-width:100%;overflow-wrap:anywhere}" +
      // 안내 쪽은 쪽 폭(210 − 2·여백) 안에 든다: 검척선(114mm · 실물 그대로 · 줄이지 않음)과 배치도가 한 줄에 안 들어가면 배치도가 아래로 내려간다.
      //   한 줄이라도 쪽 폭을 넘으면 브라우저가 문서 전체를 줄여 인쇄해 패턴 쪽까지 1:1 이 깨진다(실측: 여백 12mm → 98.6% · 20mm → 90% · 30mm → 79%).
      R + ".cp-guide .cp-row{display:flex;flex-wrap:wrap;gap:5mm;align-items:flex-start}" + R + ".cp-guide .cp-row>div{break-inside:avoid;page-break-inside:avoid;max-width:100%}" +
      R + ".cp-guide svg.cp-overview{max-width:100%;height:auto}" + R + ".cp-guide table{max-width:100%}" + R + ".cp-guide tr{break-inside:avoid;page-break-inside:avoid}";
  }
  // 선 굵기·색 = 실물 기준(단위 cm): 재단선 0.5mm · 완성선 0.25mm · 골선 0.35mm · 너치·식서 0.35mm.
  //   <use> 로 비춰 그린 도형에는 바깥 조상 선택자가 닿지 않는다(실측: 스타일이 빠져 검게 채워짐) → 스타일시트가 아니라 요소 속성으로 직접 적는다.
  var STY = {
    "cp-cut": "fill=\"none\" stroke=\"#000\" stroke-width=\".05\" stroke-linejoin=\"round\"", "cp-fin": "fill=\"none\" stroke=\"#000\" stroke-width=\".025\" stroke-linejoin=\"round\"",
    "cp-fold": "fill=\"none\" stroke=\"#000\" stroke-width=\".035\" stroke-dasharray=\".8 .15 .15 .15\"", "cp-mark": "fill=\"none\" stroke=\"#333\" stroke-width=\".02\" stroke-dasharray=\".3 .2\"",
    "cp-zone": "fill=\"none\" stroke=\"#555\" stroke-width=\".015\" stroke-dasharray=\".1 .15\"", "cp-notch": "fill=\"none\" stroke=\"#000\" stroke-width=\".035\"", "cp-notch-dot": "fill=\"#000\" stroke=\"none\"",
    "cp-grain": "fill=\"none\" stroke=\"#000\" stroke-width=\".035\" stroke-linecap=\"round\" stroke-linejoin=\"round\"", "cp-grain-held": "stroke-dasharray=\".4 .25\"",
    "cp-name": "fill=\"#000\" stroke=\"none\" font-weight=\"600\"", "cp-info": "fill=\"#222\" stroke=\"none\"", "cp-lab": "fill=\"#333\" stroke=\"none\"", "cp-tl": "fill=\"#444\" stroke=\"none\"",
    "cp-frame": "fill=\"none\" stroke=\"#999\" stroke-width=\".012\"", "cp-glue": "fill=\"none\" stroke=\"" + JOIN + "\" stroke-width=\".03\" stroke-dasharray=\".5 .25\"", "cp-trim": "fill=\"none\" stroke=\"" + JOIN + "\" stroke-width=\".03\" stroke-dasharray=\"1.2 .2 .1 .2\"",
    "cp-reg": "fill=\"none\" stroke=\"" + JOIN + "\" stroke-width=\".025\"", "cp-gauge": "fill=\"none\" stroke=\"" + GAUGE + "\" stroke-width=\".03\"", "cp-gauge-big": "fill=\"none\" stroke=\"" + GAUGE + "\" stroke-width=\".05\"", "cp-band": "fill=\"#222\" stroke=\"none\"", "cp-bandline": "fill=\"none\" stroke=\"#999\" stroke-width=\".012\"", "cp-grid": "fill=\"none\" stroke=\"#06c\" stroke-width=\".15\"", "cp-gridn": "fill=\"#06c\" stroke=\"none\" font-weight=\"700\""
  };
  function sty(html) { return html.replace(/class="(cp-[a-z-]+(?: cp-[a-z-]+)*)"/g, function (m0, cls) { var a = cls.split(" ").map(function (c) { return STY[c] || ""; }).filter(Boolean).join(" "); return a ? m0 + " " + a : m0; }); }
  function regMark(x, y) { return "<path class=\"cp-reg\" d=\"M" + n4(x - 0.35) + " " + n4(y) + " L" + n4(x + 0.35) + " " + n4(y) + " M" + n4(x) + " " + n4(y - 0.35) + " L" + n4(x) + " " + n4(y + 0.35) + "\"/><circle class=\"cp-reg\" cx=\"" + n4(x) + "\" cy=\"" + n4(y) + "\" r=\"0.2\"/>"; }
  function gaugeD(x, y) {   // ㄱ자 검척선: 가로 100mm · 세로 100mm(끝 눈금 포함) — 안내 쪽
    return "M" + n4(x) + " " + n4(y) + " L" + n4(x + 10) + " " + n4(y) + " M" + n4(x) + " " + n4(y) + " L" + n4(x) + " " + n4(y + 10) +
      " M" + n4(x + 10) + " " + n4(y - 0.2) + " L" + n4(x + 10) + " " + n4(y + 0.2) + " M" + n4(x - 0.2) + " " + n4(y + 10) + " L" + n4(x + 0.2) + " " + n4(y + 10) + " M" + n4(x + 5) + " " + n4(y - 0.12) + " L" + n4(x + 5) + " " + n4(y + 0.12) + " M" + n4(x - 0.12) + " " + n4(y + 5) + " L" + n4(x + 0.12) + " " + n4(y + 5);
  }
  function gaugeHD(x, y) {   // 가로 100mm 검척선(각 장 안내 띠) — 끝 눈금 ±1mm · 가운데 눈금
    return "M" + n4(x) + " " + n4(y) + " L" + n4(x + 10) + " " + n4(y) + " M" + n4(x) + " " + n4(y - 0.1) + " L" + n4(x) + " " + n4(y + 0.1) + " M" + n4(x + 10) + " " + n4(y - 0.1) + " L" + n4(x + 10) + " " + n4(y + 0.1) + " M" + n4(x + 5) + " " + n4(y - 0.06) + " L" + n4(x + 5) + " " + n4(y + 0.06);
  }
  function tileName(r, c) { return (r + 1) + "행 " + (c + 1) + "열"; }
  // 글자 폭 어림(넉넉하게): 한글·전각 = 글자 크기 × 1.02 · 그 밖 × 0.66 · 빈칸 × 0.34. 안내 띠 안에서 잘리거나 서로 겹치지 않게 자리를 잡는 데만 쓴다.
  function estW(s, fs, bold) { var w = 0; s = String(s); for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); w += (c > 0x2e7f ? 1.02 : c === 32 ? 0.34 : 0.66) * fs; } return w * (bold ? 1.06 : 1); }
  function fitTxt(s, fs, maxW) { s = String(s); if (estW(s, fs) <= maxW) return s; while (s.length > 1 && estW(s + "…", fs) > maxW) s = s.slice(0, -1); return s + "…"; }
  // 안내 띠(쪽 위쪽 band cm) — 장 이름·판·조각·이웃 장·가로 10cm 검척선. 좌표 = 쪽 기준 cm. boxes = 각 항목이 차지하는 자리(검사용 어림 상자).
  function bandOf(b, t) {
    var op = b.opts, PW = op.pageW, o = [], boxes = [], has = function (r, c) { return !!b.need[r + "," + c]; }, rc = function (r, c) { return "R" + (r + 1) + "C" + (c + 1); };
    var put = function (s, x, base, fs, right, bold) { var w = estW(s, fs, bold); o.push(txt("cp-band", x, base, fs, s, (right ? " text-anchor=\"end\"" : "") + (bold ? " font-weight=\"700\"" : ""))); boxes.push({ x: right ? x - w : x, y: base - fs * 0.88, w: w, h: fs * 1.14, s: s }); return w; };
    var w1 = put(rc(t.r, t.c) + " · " + tileName(t.r, t.c) + " · " + t.page + "/" + b.tiles.length + "쪽", 0.1, 0.34, 0.3, false, true);
    put(fitTxt("DOROBO " + b.meta.version + " · 완료본 #" + b.resultHash + " · 100% 인쇄", 0.22, PW - 0.5 - w1), PW - 0.1, 0.32, 0.22, true);
    var glue = [], trim = [];
    if (has(t.r, t.c + 1)) glue.push("오른쪽 " + rc(t.r, t.c + 1)); if (has(t.r + 1, t.c)) glue.push("아래 " + rc(t.r + 1, t.c));
    if (has(t.r, t.c - 1)) trim.push("왼쪽"); if (has(t.r - 1, t.c)) trim.push("위쪽");
    var js = (glue.length || trim.length) ? [glue.length ? "붙임선(점선): " + glue.join(" · ") : "", trim.length ? "자름선(긴 점선): " + trim.join("·") : ""].filter(Boolean).join(" / ") : "이어 붙일 이웃 장 없음";
    var w4 = put(js, PW - 0.1, 0.65, 0.22, true);
    put(fitTxt("조각: " + t.pieces.join(", "), 0.22, PW - 0.6 - w4), 0.1, 0.65, 0.22);
    o.push("<path class=\"cp-gauge\" d=\"" + gaugeHD(0.2, 0.98) + "\"/>"); boxes.push({ x: 0.18, y: 0.86, w: 10.04, h: 0.24, s: "gauge" });
    put(fitTxt("가로 10cm 검척선 · 세로 확인 = 아래 틀 높이 " + n4(op.winHmm) + "mm · 큰 검척선은 안내 쪽", 0.22, PW - 10.6), 10.45, 1.06, 0.22);
    return { svg: o.join(""), boxes: boxes };
  }
  // 한 쪽 = 안내 띠(위) + 패턴 영역(아래). 패턴 영역은 안쪽 <svg> 로 잘라 그린다 — 띠에는 패턴이, 패턴 영역에는 글자가 들어가지 않는다(선 위를 덮는 상자 없음).
  function tileSvg(b, t) {
    var op = b.opts, x0 = t.x0, y0 = t.y0, W_ = op.winW, H_ = op.winH, o = [], has = function (r, c) { return !!b.need[r + "," + c]; }, bd = bandOf(b, t);
    t.bandBoxes = bd.boxes;
    o.push("<svg class=\"cp-page\" xmlns=\"http://www.w3.org/2000/svg\" width=\"" + n4(op.pageWmm) + "mm\" height=\"" + n4(op.pageHmm) + "mm\" viewBox=\"0 0 " + n4(op.pageW) + " " + n4(op.pageH) + "\">");
    o.push("<g class=\"cp-bandg\">" + bd.svg + "</g>");
    o.push("<svg class=\"cp-tile\" x=\"0\" y=\"" + n4(op.band) + "\" width=\"" + n4(W_) + "\" height=\"" + n4(H_) + "\" viewBox=\"" + n4(x0) + " " + n4(y0) + " " + n4(W_) + " " + n4(H_) + "\" data-row=\"" + (t.r + 1) + "\" data-col=\"" + (t.c + 1) + "\">");
    o.push("<use href=\"#cpSheet\"/>");
    o.push("<rect class=\"cp-frame\" x=\"" + n4(x0 + 0.006) + "\" y=\"" + n4(y0 + 0.006) + "\" width=\"" + n4(W_ - 0.012) + "\" height=\"" + n4(H_ - 0.012) + "\"/>");
    var ys = [y0 + H_ * 0.25, y0 + H_ * 0.75], xs = [x0 + W_ * 0.25, x0 + W_ * 0.75];
    if (has(t.r, t.c + 1)) { var xg = x0 + op.stepX;   // 오른쪽 장이 이 점선에 올라온다
      o.push("<path class=\"cp-glue\" d=\"M" + n4(xg) + " " + n4(y0) + " L" + n4(xg) + " " + n4(y0 + H_) + "\"/>");
      ys.forEach(function (y) { o.push(regMark(xg + op.ov / 2, y)); }); }
    if (has(t.r, t.c - 1)) {
      o.push("<path class=\"cp-trim\" d=\"M" + n4(x0 + 0.015) + " " + n4(y0) + " L" + n4(x0 + 0.015) + " " + n4(y0 + H_) + "\"/>");
      ys.forEach(function (y) { o.push(regMark(x0 + op.ov / 2, y)); }); }
    if (has(t.r + 1, t.c)) { var yg = y0 + op.stepY;
      o.push("<path class=\"cp-glue\" d=\"M" + n4(x0) + " " + n4(yg) + " L" + n4(x0 + W_) + " " + n4(yg) + "\"/>");
      xs.forEach(function (x) { o.push(regMark(x, yg + op.ov / 2)); }); }
    if (has(t.r - 1, t.c)) {
      o.push("<path class=\"cp-trim\" d=\"M" + n4(x0) + " " + n4(y0 + 0.015) + " L" + n4(x0 + W_) + " " + n4(y0 + 0.015) + "\"/>");
      xs.forEach(function (x) { o.push(regMark(x, y0 + op.ov / 2)); }); }
    o.push("</svg></svg>");
    return sty(o.join(""));
  }
  function guideHtml(b) {
    var op = b.opts, o = [], pre = b.pre, S = b.sheet;
    var QK = { user: "직접 지정", "default": "기본값", none: "미정" }, GK = { user: "직접 지정", "default": "교재 기본", held: "보류", none: "미정", unfit: "표시 못함" };
    o.push("<h1>실물 크기 재단 패턴 — A4 이어 붙이기 안내</h1>");
    o.push("<div>DOROBO " + esc(b.meta.version) + " · 완료본 #" + esc(b.resultHash) + (b.meta.createdAt ? " · " + esc(b.meta.createdAt) : "") + "</div>");
    o.push("<div>용지 A4 세로 · 프린터 여백 " + op.marginMm + "mm · 겹침 " + op.overlapMm + "mm · 한 장 = 위쪽 안내 띠 " + op.bandMm + "mm + 패턴 영역 " + n4(op.winWmm) + " × " + n4(op.winHmm) + "mm · 전체 " + fmt(S.wCm) + " × " + fmt(S.hCm) + "cm · 세로 " + b.rows + "행 × 가로 " + b.cols + "열 가운데 " + b.tiles.length + "장(빈 칸 " + b.blank + "장은 인쇄하지 않음)</div>");
    o.push("<h2>인쇄 설정</h2><ol><li>용지 <b>A4 세로</b> · 배율 <b>100%(실제 크기)</b>. «페이지에 맞춤 · 용지에 맞게 · 축소/확대»는 끕니다.</li><li><b>머리글·바닥글(머리말 및 꼬리말)은 끕니다</b> · 여백은 «기본값»(사용자 지정으로 바꾸지 않음).</li>" +
      "<li>인쇄한 뒤 <b>이 쪽의 큰 검척선</b>을 자로 잽니다(가로·세로 모두 100mm). 다르면 배율 설정을 고쳐 다시 인쇄합니다. 각 장 위쪽 띠에도 가로 10cm 검척선이 있고, 세로는 패턴 틀 높이(" + n4(op.winHmm) + "mm)로 확인합니다.</li></ol>");
    o.push("<h2>이어 붙이기</h2><ol><li>각 장 위쪽 띠 = 장 이름(R행C열)·쪽·조각·이웃 장. 띠 아래 회색 틀 안이 패턴 영역입니다(띠와 패턴은 겹치지 않습니다).</li>" +
      "<li><b>자름선</b>(자주색 긴 점선 · 틀의 왼쪽·위쪽 변): 이 선 바깥(왼쪽 여백 / 위쪽 띠와 여백)을 잘라 냅니다.</li><li><b>붙임선</b>(자주색 짧은 점선 · 오른쪽·아래쪽 안쪽): 오른쪽·아래 장의 자른 변을 이 선에 맞춰 올려 붙입니다.</li>" +
      "<li>겹치는 띠(" + op.overlapMm + "mm) 안의 <b>⊕ 맞춤 표시</b>(자주색)가 두 장에서 서로 포개지면 맞은 것입니다. 자주색 선·표시는 패턴 선이 아닙니다.</li>" +
      "<li>패턴 선(검정): 굵은 선 = 재단선(시접 포함) · 가는 선 = 완성선 · 긴 점선 = 골선 · 양끝 화살표 = 식서.</li></ol>");
    var gt = []; for (var k = 1; k < 10; k++) { if (k === 5) continue; gt.push("M" + n4(0.6 + k) + " 0.6 L" + n4(0.6 + k) + " 0.72 M0.6 " + n4(0.6 + k) + " L0.72 " + n4(0.6 + k)); }
    o.push("<div class=\"cp-row\"><div><h2>검척선(100mm) — 자로 재어 확인</h2><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"114mm\" height=\"110mm\" viewBox=\"0 0 11.4 11\"><path class=\"cp-gauge-big\" d=\"" + gaugeD(0.6, 0.6) + "\"/><path class=\"cp-gauge\" d=\"" + gt.join(" ") + "\"/>" + txt("cp-tl", 0.45, 0.4, 0.26, "0") + txt("cp-tl", 5.45, 0.4, 0.26, "50") + txt("cp-tl", 10.3, 0.4, 0.26, "100mm") + txt("cp-tl", 0.05, 5.7, 0.26, "50") + txt("cp-tl", 0.0, 10.95, 0.26, "100") + txt("cp-tl", 4.0, 1.3, 0.34, "가로 100mm") + txt("cp-tl", 1.0, 5.7, 0.34, "세로 100mm") + "</svg></div>");
    var GW = Math.max(S.wCm, (b.cols - 1) * op.stepX + op.winW), GH = Math.max(S.hCm, (b.rows - 1) * op.stepY + op.winH), sc = Math.min(70 / (GW * 10), 100 / (GH * 10)), gw = GW * 10 * sc, gh = GH * 10 * sc, gfs = Math.min(op.stepX, op.stepY) * 0.32;
    o.push("<div><h2>전체 배치(축소 안내도 — 치수 아님)</h2><svg class=\"cp-overview\" xmlns=\"http://www.w3.org/2000/svg\" width=\"" + n4(gw) + "mm\" height=\"" + n4(gh) + "mm\" viewBox=\"" + n4(S.x0 - 0.1) + " " + n4(S.y0 - 0.1) + " " + n4(GW + 0.2) + " " + n4(GH + 0.2) + "\"><use href=\"#cpSheet\"/>");
    b.tiles.forEach(function (t) { o.push("<rect class=\"cp-grid\" x=\"" + n4(t.x0) + "\" y=\"" + n4(t.y0) + "\" width=\"" + n4(op.stepX) + "\" height=\"" + n4(op.stepY) + "\"/>" + txt("cp-gridn", t.x0 + op.stepX / 2, t.y0 + op.stepY / 2 + gfs * 0.35, gfs, String(t.page), " text-anchor=\"middle\"")); });
    o.push("</svg><div>숫자 = 쪽 번호(왼쪽 위부터 행 순서)</div></div></div>");
    o.push("<h2>사전 점검 — 조각 · 수량 · 식서</h2><table><tr><th>조각</th><th>재단 수량</th><th>식서</th><th>비고</th></tr>");
    pre.rows.forEach(function (r) {
      o.push("<tr><td>" + esc(r.label) + "</td><td>" + (r.qty.n == null ? "<span class=\"cp-warn\">미정</span>" : r.qty.n + "장 · " + QK[r.qty.kind]) + "</td><td>" + (r.grain.kind === "user" || r.grain.kind === "default" ? r.grain.angleDeg + "° · " + (r.grain.kind === "default" && /앱 기본값/.test(r.grain.basis || "") ? "앱 기본" : GK[r.grain.kind]) : "<span class=\"cp-warn\">" + GK[r.grain.kind] + (r.grain.kind === "held" && r.grain.shown ? "(점선 = 임시 기본 " + r.grain.angleDeg + "°)" : "") + "</span>") + "</td><td>" + (r.unfolded ? "골 펼친 한 장" : "") + "</td></tr>");
    });
    o.push("</table>");
    var notes = pre.attention.concat(pre.warnings);
    if (notes.length) o.push("<h2 class=\"cp-warn\">확인할 것</h2><ul class=\"cp-warn\">" + notes.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ul>");
    else o.push("<div>수량·식서는 모두 기본값 또는 직접 지정한 값입니다(보류·미정 없음).</div>");
    return sty(o.join(""));
  }
  function bodyOf(b) {
    var o = ["<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"0\" height=\"0\" style=\"position:absolute\" aria-hidden=\"true\"><defs><g id=\"cpSheet\">" + b.sheetSvg + "</g></defs></svg>"];
    o.push("<div class=\"cp-guide\" style=\"break-after:page;page-break-after:always\">" + guideHtml(b) + "</div>");
    b.tiles.forEach(function (t) { o.push("<div class=\"cp-pg\">" + tileSvg(b, t) + "</div>"); });
    return o.join("");
  }
  // 따로 여는 완결 문서(검증·보관용 · 앱 화면 없이 인쇄 내용만)
  function buildHtml(proj, optsRaw, meta) {
    var b = build(proj, optsRaw, meta); if (!b.ok) return b;
    b.html = "<!doctype html><html lang=\"ko\"><head><meta charset=\"utf-8\"><title>DOROBO 실물 크기 재단 패턴</title><style>html,body{margin:0;padding:0;background:#fff}" + b.css + "</style></head><body><div id=\"cutPrintRoot\">" + b.body + "</div></body></html>";
    return b;
  }

  var model = { DEFAULTS: DEF, LIMITS: LIM, GAUGE_COLOR: GAUGE, optsOf: optsOf, preflight: preflight, build: build, buildHtml: buildHtml };

  // ══ 화면: 사전 점검 창 + 시스템 인쇄 ══
  var ui = { opts: { marginMm: DEF.marginMm, overlapMm: DEF.overlapMm }, msg: "", last: null, printing: false, sawPrintMedia: false };
  // 인쇄 수명(2026-11-17 야간 리뷰): 인쇄용 내용은 «인쇄 창 열기»를 누른 그 인쇄 한 번에만 문서에 둔다.
  //   ui.printing = 그 인쇄가 진행 중. 인쇄가 끝나면(afterprint · 또는 인쇄 미디어가 끝남) 바로 걷는다 — 취소·닫기도 같은 이벤트로 끝난다.
  //   print() 가 바로 돌아오는 브라우저(Safari 등)에서는 돌아왔다고 걷지 않는다(그때는 아직 인쇄 창이 내용을 읽는 중일 수 있다).
  //   그 뒤 사용자가 Cmd/Ctrl+P 로 앱을 인쇄하면(ui.printing 아님) 남은 내용이 있어도 beforeprint 에서 걷어 앱 화면이 인쇄된다.
  function $(id) { return document.getElementById(id); }
  function versionNow() { var v = $("appVersion"); return v ? String(v.textContent || "").trim() : ""; }
  function unmount() { var r = $("cutPrintRoot"); if (r && r.parentNode) r.parentNode.removeChild(r); }
  function endPrint() { if (!ui.printing) return; ui.printing = false; ui.sawPrintMedia = false; unmount(); }
  function mount(b) {
    unmount();
    var root = document.createElement("div"); root.id = "cutPrintRoot"; root.setAttribute("aria-hidden", "true");
    root.innerHTML = "<style>@media screen{#cutPrintRoot{display:none!important}}@media print{html,body{margin:0!important;padding:0!important;background:#fff!important;height:auto!important;min-height:0!important;overflow:visible!important;display:block!important;position:static!important}body>*:not(#cutPrintRoot){display:none!important}#cutPrintRoot{display:block!important}}" + b.css + "</style>" + b.body;
    document.body.appendChild(root);
    return root;
  }
  function panel() {
    var p = $("cutPrintPanel"); if (p) return p;
    var host = $("cutView"); if (!host) return null;
    p = document.createElement("div"); p.id = "cutPrintPanel"; p.className = "cut-print"; p.hidden = true; p.setAttribute("role", "dialog"); p.setAttribute("aria-modal", "true"); p.setAttribute("aria-label", "실물 크기 인쇄");
    p.innerHTML = "<div class=\"cut-print-card\"><div class=\"cut-print-head\"><b>실물 크기 인쇄 · A4 이어 붙이기</b><button type=\"button\" class=\"btn\" data-cp=\"close\">닫기</button></div><div class=\"cut-print-body\" id=\"cutPrintBody\"></div></div>";
    host.appendChild(p);
    p.addEventListener("click", function (e) {
      var t = e.target.closest ? e.target.closest("[data-cp]") : null; if (!t || t.disabled) { if (e.target === p) closePanel(); return; }
      var k = t.getAttribute("data-cp");
      if (k === "close") closePanel();
      else if (k === "reset") { ui.opts = { marginMm: DEF.marginMm, overlapMm: DEF.overlapMm }; ui.msg = "여백·겹침 = 기본값"; renderPanel(); }
      else if (k === "print") doPrint();
      else if ((k === "dxf" || k === "dxf-aama") && W().cutDxf) { var now = new Date(), pad = function (v) { return (v < 10 ? "0" : "") + v; };
        var r = W().cutDxf.download(null, { version: versionNow(), createdAt: now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate()) + " " + pad(now.getHours()) + ":" + pad(now.getMinutes()) }, k === "dxf-aama" ? { format: "aama" } : null);
        ui.msg = r.ok ? "DXF 파일 내려받기를 시작했습니다 — " + r.fileName + " (브라우저의 다운로드 폴더)" + (r.notes && r.notes.length ? " · " + r.notes.join(" · ") : "") : "DXF 저장 안 함: " + r.reason; renderPanel(); }
    });
    p.addEventListener("change", function (e) {
      var t = e.target; if (!t.matches || !t.matches("input[data-cp-opt]")) return;
      var k = t.getAttribute("data-cp-opt"), v = t.value.trim() === "" ? NaN : Number(t.value), next = { marginMm: ui.opts.marginMm, overlapMm: ui.opts.overlapMm }; next[k] = v;
      var ck = optsOf(next);
      if (ck.ok) { ui.opts = { marginMm: ck.marginMm, overlapMm: ck.overlapMm }; ui.msg = ""; } else ui.msg = "안 바뀜: " + ck.reason;
      renderPanel();
    });
    return p;
  }
  function renderPanel() {
    var body = $("cutPrintBody"); if (!body) return;
    var b = build(null, ui.opts, { version: versionNow() }), o = [], pre = b.pre || { blockers: b.blockers || [], rows: [], attention: [], warnings: [] };
    ui.last = b.ok ? { pages: b.tiles.length, cols: b.cols, rows: b.rows, blank: b.blank, resultHash: b.resultHash } : null;
    var QK = { user: "직접 지정", "default": "기본값", none: "미정" }, GK = { user: "직접 지정", "default": "교재 기본", held: "보류", none: "미정", unfit: "표시 못함" };
    if (!b.ok) {
      o.push("<div class=\"cut-print-block\" role=\"alert\"><b>지금은 인쇄·DXF 저장을 할 수 없습니다</b> — 아래 문제를 먼저 풀어야 합니다(미완성 패턴을 완성본처럼 내보내지 않습니다).<ul>" + (pre.blockers || []).map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ul></div>");
    } else {
      o.push("<div class=\"cut-print-sum\">전체 " + fmt(b.sheet.wCm) + " × " + fmt(b.sheet.hCm) + " cm · A4 세로 <b>" + b.tiles.length + "장</b> + 안내 1장 (세로 " + b.rows + "행 × 가로 " + b.cols + "열 · 빈 칸 " + b.blank + "장 제외) · 실물 크기 1:1 · 한 장 = 안내 띠 " + b.opts.bandMm + "mm + 패턴 영역 " + n4(b.opts.winWmm) + " × " + n4(b.opts.winHmm) + "mm</div>");
    }
    o.push("<div class=\"cut-print-opts\"><label>프린터 여백 <input type=\"number\" inputmode=\"decimal\" min=\"" + LIM.marginMin + "\" max=\"" + LIM.marginMax + "\" step=\"1\" data-cp-opt=\"marginMm\" value=\"" + ui.opts.marginMm + "\"> mm</label><label>겹침 <input type=\"number\" inputmode=\"decimal\" min=\"" + LIM.overlapMin + "\" max=\"" + LIM.overlapMax + "\" step=\"1\" data-cp-opt=\"overlapMm\" value=\"" + ui.opts.overlapMm + "\"> mm</label><button type=\"button\" class=\"btn\" data-cp=\"reset\">기본값(10 · 10)</button></div>");
    if (ui.msg) o.push("<div class=\"cut-print-msg\" aria-live=\"polite\">" + esc(ui.msg) + "</div>");
    if (pre.rows && pre.rows.length) {
      o.push("<div class=\"cut-print-h\">사전 점검 — 수량·식서가 기본값인지 직접 정한 값인지</div><table class=\"cut-print-table\"><tr><th>조각</th><th>수량</th><th>식서</th></tr>");
      pre.rows.forEach(function (r) {
        o.push("<tr><td>" + esc(r.label) + (r.unfolded ? " <small>(골 펼친 한 장)</small>" : "") + "</td><td" + (r.qty.kind === "none" ? " class=\"is-warn\"" : "") + ">" + (r.qty.n == null ? "미정" : r.qty.n + "장 · " + QK[r.qty.kind]) + "</td><td" + (/held|none|unfit/.test(r.grain.kind) ? " class=\"is-warn\"" : "") + ">" + (r.grain.angleDeg == null ? "" : r.grain.angleDeg + "° · ") + (r.grain.kind === "default" && /앱 기본값/.test(r.grain.basis || "") ? "앱 기본" : GK[r.grain.kind]) + (r.grain.kind === "held" && r.grain.shown ? "(임시 기본을 점선으로)" : "") + "</td></tr>");
      });
      o.push("</table>");
    }
    var notes = (pre.attention || []).concat(pre.warnings || []);
    if (notes.length) o.push("<div class=\"cut-print-h is-warn\">확인할 것(인쇄는 됩니다 · 종이에도 그대로 적힙니다)</div><ul class=\"cut-print-notes\">" + notes.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ul>");
    o.push("<div class=\"cut-print-h\">인쇄 방법</div><ol class=\"cut-print-how\"><li>«인쇄 창 열기»를 누르면 <b>이 기기의 인쇄 창</b>이 열립니다. 파일을 바로 내려받는 것이 아닙니다.</li>" +
      "<li>PDF 로 남기려면 인쇄 창에서 직접 고릅니다 — Mac Chrome: 대상 «PDF로 저장» · Mac Safari: 인쇄 창 아래 «PDF» → «PDF로 저장» · iPhone/iPad: 인쇄 미리보기를 두 손가락으로 벌린 뒤 공유 → «파일에 저장».</li>" +
      "<li>용지 <b>A4 세로</b> · 배율 <b>100%(실제 크기)</b> · «페이지에 맞춤/용지에 맞게»는 <b>끔</b> · 여백 «기본값» · <b>머리글·바닥글(Safari: «머리말 및 꼬리말 프린트») 끔</b>.</li>" +
      "<li>인쇄 뒤 안내 쪽의 큰 <b>검척선</b>(가로·세로 100mm)을 자로 재어 확인합니다. 각 장 위쪽 띠에도 가로 10cm 검척선이 있습니다.</li></ol>" +
      "<div class=\"cut-print-foot\">이 기기 안에서만 만들며 패턴을 밖으로 보내지 않습니다. 원본 도형·저장값은 바뀌지 않습니다.</div>");
    o.push("<div class=\"cut-print-actions\"><button type=\"button\" class=\"btn action-primary\" data-cp=\"print\"" + (b.ok ? "" : " disabled aria-disabled=\"true\" title=\"" + esc((pre.blockers || [])[0] || "인쇄할 수 없음") + "\"") + ">인쇄 창 열기</button><button type=\"button\" class=\"btn\" data-cp=\"close\">닫기</button></div>");
    if (W().cutDxf) o.push("<div class=\"cut-print-h\">DXF 파일(CAD 용)</div><div class=\"cut-print-foot\">같은 사전 점검을 통과한 재단 결과를 <b>파일로 내려받습니다</b>(인쇄 창과 별개 · 여백·겹침 값과 무관). 일반 DXF R12 · 단위 mm · 1:1 · 조각마다 재단선·완성선은 닫힌 선 · 레이어 CUT / FINISHED / FOLD / NOTCH / GRAIN / GRAIN_HELD / INTERNAL / TEXT. " +
      "곡선은 0.01mm 이내 오차의 짧은 직선으로 나눕니다. AAMA/ASTM 규격 파일이 아니며, 특정 CAD 에서 열리는지는 아직 확인하지 않았습니다. 원형 탭의 «DXF 다운로드»(원형 도안)와는 다른 파일입니다.</div>" +
      "<div class=\"cut-print-actions\"><button type=\"button\" class=\"btn\" data-cp=\"dxf\"" + (b.ok ? "" : " disabled aria-disabled=\"true\" title=\"" + esc((pre.blockers || [])[0] || "내보낼 수 없음") + "\"") + ">DXF 파일 저장</button><button type=\"button\" class=\"btn\" data-cp=\"dxf-aama\"" + (b.ok ? "" : " disabled aria-disabled=\"true\"") + ">DXF 저장(AAMA 구조)</button></div>" +
      "<div class=\"cut-print-foot\">«AAMA 구조» = 어패럴 CAD 교환용 구조를 따른 파일(조각마다 블록 하나 · 숫자 레이어 1 재단선 / 2·3 점 / 4 너치 / 6 대칭선 / 7 식서 / 8 안쪽 선 / 14 봉제선 · Piece Name·Quantity·Units 글자). 규격 인증을 받은 것이 아니고 CLO 등에서 열리는지는 아직 확인하지 못했습니다. 식서 보류 조각은 식서선을 넣지 않습니다.</div>");
    body.innerHTML = o.join("");
  }
  function openPanel() { var p = panel(); if (!p) return false; ui.msg = ""; renderPanel(); p.hidden = false; return true; }
  function closePanel() { var p = $("cutPrintPanel"); if (p) p.hidden = true; ui.printing = false; ui.sawPrintMedia = false; unmount(); }
  function doPrint() {
    var now = new Date(), pad = function (v) { return (v < 10 ? "0" : "") + v; };
    var b = build(null, ui.opts, { version: versionNow(), createdAt: now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate()) + " " + pad(now.getHours()) + ":" + pad(now.getMinutes()) });
    if (!b.ok) { ui.msg = "인쇄 안 함: " + b.reason; renderPanel(); return { ok: false, reason: b.reason }; }
    mount(b); ui.printing = true; ui.sawPrintMedia = false;   // 새 인쇄마다 지금 사전 점검으로 새로 만든 내용
    ui.msg = "인쇄 창을 열었습니다 — 대상·배율(100%)을 확인하세요"; renderPanel();
    try { W().print(); } catch (e) { endPrint(); ui.msg = "이 브라우저에서 인쇄 창을 열지 못했습니다"; renderPanel(); return { ok: false, reason: "print-failed" }; }
    return { ok: true, pages: b.tiles.length };
  }
  function bind() {
    var btn = $("btnCutPrint"); if (!btn) return;
    btn.addEventListener("click", function () { openPanel(); });
    var back = $("btnCutBack"); if (back) back.addEventListener("click", function () { closePanel(); });
    // 인쇄 창이 이 창(사전 점검)에서 열린 것이 아니면 패턴 인쇄용 내용을 남겨 두지 않는다(앱 화면을 인쇄할 때 섞이지 않게)
    if (W().addEventListener) {
      // 앱 인쇄(Cmd/Ctrl+P · 메뉴)와 «인쇄 창 열기»를 구별: 진행 중인 실물 인쇄가 아니면 남은 인쇄용 내용을 걷는다(앱 화면이 인쇄된다).
      W().addEventListener("beforeprint", function () { var p = $("cutPrintPanel"), cv = $("cutView"); if (!ui.printing || !p || p.hidden || !cv || cv.hidden) { ui.printing = false; unmount(); } });
      W().addEventListener("afterprint", function () { endPrint(); });   // 인쇄·PDF 저장·취소·창 닫기 모두 여기로 끝난다
    }
    // afterprint 를 보내지 않는 브라우저 대비: 인쇄 미디어가 켜졌다가 꺼지면 끝난 것으로 본다(켜진 적이 없으면 걷지 않음 — 조기 제거 금지)
    var mq = W().matchMedia ? W().matchMedia("print") : null, onMq = function (ev) { if (!ui.printing) return; if (ev.matches) ui.sawPrintMedia = true; else if (ui.sawPrintMedia) endPrint(); };
    if (mq) { if (mq.addEventListener) mq.addEventListener("change", onMq); else if (mq.addListener) mq.addListener(onMq); }
  }
  W().cutPrint = Object.freeze(Object.assign({}, model, { openPanel: function () { return openPanel(); }, closePanel: function () { closePanel(); }, print: function () { return doPrint(); },
    panelState: function () { var p = $("cutPrintPanel"); return { open: !!p && !p.hidden, opts: Object.assign({}, ui.opts), msg: ui.msg, last: ui.last, mounted: !!$("cutPrintRoot"), printing: ui.printing }; } }));
  if (typeof document !== "undefined" && document.querySelector && document.addEventListener) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind); else bind();
  }
})();
