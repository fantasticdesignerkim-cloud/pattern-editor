// ══════════════════════════════════════════════
// peplumAnnotation.js — 페플럼 제작 정보 표시 모델(순수, 표시 전용).
//
// ★ 이 모듈이 만드는 것은 형상이 아니다. geometry·계측·체크포인트·hash·선택(hit)·레이아웃 어디에도
//   들어가지 않는다. render.js 가 읽어 SVG 오버레이로만 그린다(pointer-events:none).
// ★ 의미는 좌표 추측이 아니라 **geometry 의 edge 태그(waist/hem/center/side-seam) + designWaistSeam 메타**
//   (`waistSeam.<side>.joins[].spread.pivot`, `peplumFlare`)에서만 읽는다. 절개 다리 끝점은 밑단 이음(cubic)의
//   두 끝점이며, 고정점과의 거리가 같은 쌍(이등변)이라는 **기하 항등식**으로 짝을 확인한다.
// ★ 모델이 있는 것: Ⓝ/Ⓞ/Ⓟ(페플럼) + 박시 Ⓐ·Ⓑ(buildModel 의 body 인자로 식별). Ⓜ 등 나머지는 null.
//
// buildModel(geometry) → { front: Model|null, back: Model|null }   (좌표 = geometry 좌표계, 표시 내림 전)
//   Model = { key, title, lines:[{id,at,px:{dx,dy},anchor,text,cls}], legs:[{id,from,to}], wedges:[{id,pts}],
//             notches:[{id,at}], cuts:[{id,symbol,chordCm,angleDeg,pivot}], totalCm, finishedWaistCm }
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var num = function (v) { return typeof v === "number" && isFinite(v); };
  var P = function (p) { return { x: p.x, y: p.y }; };
  var dist = function (a, b) { return Math.hypot(a.x - b.x, a.y - b.y); };
  var unit = function (v) { var l = Math.hypot(v.x, v.y); return l > 1e-12 ? { x: v.x / l, y: v.y / l } : null; };
  var fmt1 = function (v) { return (Math.round(v * 10) / 10).toFixed(1); };
  var fmt2 = function (v) { return (Math.round(v * 100) / 100).toFixed(2); };

  function ctrl(prim) {
    if (!prim) return [];
    if (prim.kind === "line") return [prim.from, prim.to];
    if (prim.kind === "cubic") return [prim.from, prim.c1, prim.c2, prim.to];
    var pts = [];
    (prim.commands || []).forEach(function (c) { (c.points || []).forEach(function (p) { pts.push(p); }); });
    return pts;
  }
  function ends(prim) { var c = ctrl(prim); return c.length ? { from: c[0], to: c[c.length - 1] } : null; }
  function isCurved(prim) { return ctrl(prim).length === 4; }
  // 선의 중점(곡선은 t=0.5 의 점)
  function mid(prim) {
    var c = ctrl(prim); if (!c.length) return null;
    if (c.length === 4) {
      return { x: (c[0].x + 3 * c[1].x + 3 * c[2].x + c[3].x) / 8, y: (c[0].y + 3 * c[1].y + 3 * c[2].y + c[3].y) / 8 };
    }
    return { x: (c[0].x + c[c.length - 1].x) / 2, y: (c[0].y + c[c.length - 1].y) / 2 };
  }
  var by = function (outline, edge) { return (outline || []).filter(function (s) { return s && s.edge === edge; }); };

  function buildSide(key, label, cfName, peplum, meta) {
    if (!peplum || !Array.isArray(peplum.outline) || !meta || !meta.peplumFlare) return null;
    var fl = meta.peplumFlare, joins = meta.joins || [];
    if (!num(fl.totalCm) || !num(fl.finishedWaistCm) || !joins.length || !joins.every(function (j) { return j && j.spread && j.spread.pivot && num(j.spread.chordCm); })) return null;
    var out = peplum.outline;
    var waists = by(out, "waist"), hems = by(out, "hem"), centers = by(out, "center"), sides = by(out, "side-seam");
    if (centers.length !== 1 || sides.length !== 1 || !waists.length || !hems.length) return null;
    var straight = hems.filter(function (s) { return !isCurved(s); }), bridges = hems.filter(isCurved);
    var cm = mid(centers[0]), sm = mid(sides[0]);
    var u = unit({ x: sm.x - cm.x, y: sm.y - cm.y }); if (!u) return null;
    var along = function (p) { return (p.x - cm.x) * u.x + (p.y - cm.y) * u.y; };
    var byAlong = function (a, b) { return along(mid(a)) - along(mid(b)); };
    waists = waists.slice().sort(byAlong); straight = straight.slice().sort(byAlong);
    // 명칭 라벨은 **가장 긴 변**의 중점에 둔다 — 절개 표지(고정점)와 겹치지 않게 넉넉한 구간을 고른다.
    var widest = function (arr) { return arr.slice().sort(function (a, b) { var ea = ends(a), eb = ends(b); return dist(eb.from, eb.to) - dist(ea.from, ea.to); })[0]; };
    var wMid = mid(widest(waists)), hMid = mid(widest(straight.length ? straight : hems));
    var up = unit({ x: wMid.x - hMid.x, y: wMid.y - hMid.y }) || { x: 0, y: -1 };
    var xs = [], ys = [];
    out.forEach(function (s) { ctrl(s).forEach(function (p) { xs.push(p.x); ys.push(p.y); }); });
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs), maxY = Math.max.apply(null, ys);
    var lines = [];
    var add = function (id, at, dx, dy, anchor, text, cls) { lines.push({ id: id, at: P(at), px: { dx: dx, dy: dy }, anchor: anchor, text: text, cls: cls }); };

    // ① 조각명 + ⑤ 총 플레어(조각 아래, 밑단 라벨과 겹치지 않게 충분히 내린다)
    var below = { x: (minX + maxX) / 2, y: maxY };
    var chordList = joins.map(function (j) { return fmt1(j.spread.chordCm); }).join("·");
    add("title", below, 0, 40, "middle", label, "title");
    var seamName = fl.seamBelowWaistCm > 0 ? "이음선" : "WL", isCut = fl.mode === "cut", rr = num(fl.ratio) ? fl.ratio : 0.9, ss = num(fl.subtractCm) ? fl.subtractCm : 1;
    add("flare", below, 0, 54, "middle", "플레어 ∅ " + fmt1(fl.totalCm) + "cm = 완성 허리 " + fmt1(fl.finishedWaistCm) + " × " + rr + " − " + ss, "note");
    add("cuts", below, 0, 67, "middle", "절개 " + joins.length + "곳 각 " + chordList + "cm · 각도 " +
      joins.map(function (j) { return num(j.spread.angleDeg) ? fmt1(Math.abs(j.spread.angleDeg)) + "°" : "—"; }).join("·"), "note");
    add("strips", below, 0, 80, "middle", "Ⓐ 중심쪽 · Ⓑ 중간 · Ⓒ 옆쪽 (교재 " + (isCut ? "P.163 · Ⓐ 고정, Ⓑ→Ⓒ 순차 회전" : "P.158") + " 조각 순서)", "note");
    if (isCut) add("cutrule", below, 0, 93, "middle", "절개: " + seamName + " " + (joins.length + 1) + "등분점에서 수직 · 고정점 = " + seamName + " 점 · " + (fl.seamBelowWaistCm > 0 ? "이음선" : "허리선") + "·밑단 fairing", "note");

    // ② 중심·옆선 방향 표지  ③ 허리선·밑단선 명칭
    // 중심·옆선 표지는 조각 **바깥**에 둔다 — 중심→옆 축(u)의 반대/같은 방향(앞판은 중심이 오른쪽이라 축이 왼쪽을 향한다).
    add("center", cm, -u.x * 8, 3, -u.x >= 0 ? "start" : "end", cfName, "edge");
    add("side", sm, u.x * 8, 3, u.x >= 0 ? "start" : "end", "옆선", "edge");
    add("waist", wMid, up.x * 12, up.y * 12 + 3, "middle", (fl.seamBelowWaistCm > 0 ? "이음선(WL−" + fl.seamBelowWaistCm + ")" : "허리선(WL)"), "edge");
    add("hem", hMid, -up.x * 13, -up.y * 13 + 4, "middle", "밑단선", "edge");

    // ⑥ A/B/C 조각 — 중심에서 옆 방향 순서. 허리·밑단 직선 변의 중점 평균에 둔다.
    var letters = ["Ⓐ", "Ⓑ", "Ⓒ", "Ⓓ", "Ⓔ"];
    if (isCut && straight.length === joins.length + 1 && straight.length <= letters.length) {
      // Ⓞ: 허리선은 fairing 으로 조각 수와 세그먼트 수가 다르다 → 허리 쪽 기준은 [중심 끝, 고정점들, 옆 끝].
      var wEnds = []; waists.forEach(function (w) { var e = ends(w); if (e) wEnds.push(e.from, e.to); });
      wEnds.sort(function (a, b) { return along(a) - along(b); });
      var pvs = joins.map(function (j) { return j.spread.pivot; }).sort(function (a, b) { return along(a) - along(b); });
      var wRef = [wEnds[0]].concat(pvs, [wEnds[wEnds.length - 1]]);
      straight.forEach(function (h, i) {
        var a = { x: (wRef[i].x + wRef[i + 1].x) / 2, y: (wRef[i].y + wRef[i + 1].y) / 2 }, b = mid(h);
        add("strip-" + i, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, 0, 4, "middle", letters[i], "strip");
      });
    } else if (waists.length === straight.length && waists.length <= letters.length) {
      waists.forEach(function (w, i) {
        var a = mid(w), b = mid(straight[i]);
        add("strip-" + i, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, 0, 4, "middle", letters[i], "strip");
      });
    }

    // ④ 원래 절개(맞댐·벌림) 위치 — 고정점(허리선의 입) → 밑단 이음 양 끝의 가는 안내선 + 벌어진 쐐기
    var legs = [], wedges = [], notches = [], cuts = [];
    var used = {};
    joins.forEach(function (j, ji) {
      var pv = j.spread.pivot, hit = null;
      bridges.forEach(function (b, bi) {
        if (used[bi]) return;
        var e = ends(b); if (!e) return;
        var dP = dist(pv, e.from), dQ = dist(pv, e.to);
        if (Math.abs(dP - dQ) < 1e-4 && (!hit || Math.abs(dP - dQ) < hit.err)) hit = { bi: bi, e: e, err: Math.abs(dP - dQ), b: b };
      });
      var sym = (/-([a-z])$/.exec(String(j.dartId || "")) || [])[1] || null;
      var id = "cut-" + ji;
      cuts.push({ id: id, symbol: sym, chordCm: j.spread.chordCm, angleDeg: j.spread.angleDeg, pivot: P(pv), matched: !!hit });
      notches.push({ id: id, at: P(pv) });
      add(id + "-name", pv, 0, -9, "middle", (["①", "②", "③", "④", "⑤"][ji] || String(ji + 1)) + (sym ? sym : ""), "cut");
      if (!hit) return;                       // 짝을 확인하지 못하면 안내선을 지어내지 않는다
      used[hit.bi] = true;
      legs.push({ id: id + "-a", from: P(pv), to: P(hit.e.from) }, { id: id + "-b", from: P(pv), to: P(hit.e.to) });
      wedges.push({ id: id, pts: [P(pv), P(hit.e.from), P(hit.e.to)] });
      var bm = mid(hit.b);
      add(id + "-amt", bm, -up.x * 12, -up.y * 12 + 4, "middle", "벌림 " + fmt1(j.spread.chordCm), "amount");
    });
    return { key: key, title: label, lines: lines, legs: legs, wedges: wedges, notches: notches, cuts: cuts,
      totalCm: fl.totalCm, finishedWaistCm: fl.finishedWaistCm };
  }

  // ── 박시 라인 Ⓐ·Ⓑ(다트 있는 기본 몸판) 표시 모델 ──
  // 프리셋 identity 는 프로젝트에 저장되지 않으므로 **적용된 body 파라미터**로만 식별한다
  // (hemExtensionBelowWaistCm=20 외에 다른 키가 없고 hemSideOffsetCm 이 0/미지정=Ⓐ, 1=Ⓑ). 다른 편집이 섞이면 null.
  var BOXY = { A: "기본 박시", B: "밑단 +1cm" };
  function identifyBoxy(body) {
    if (!body || typeof body !== "object" || body.hemExtensionBelowWaistCm !== 20) return null;
    var ok = Object.keys(body).every(function (k) {
      var v = body[k];
      return k === "hemExtensionBelowWaistCm" || ((k === "hemSideOffsetCm" || k === "waistSideOffsetCm" || k === "bustEaseCm" || k === "sideSeamCurve") && (v === 0 || (k === "hemSideOffsetCm" && v === 1)));
    });
    if (!ok) return null;
    return body.hemSideOffsetCm === 1 ? "B" : "A";
  }
  // 셰이프트 Ⓒ·Ⓓ: 프리셋 body 와 **정확히 일치**할 때만 식별한다(다른 편집이 섞이면 null).
  var SHAPED = { C: "C · 옆선 WL −1cm · 밑단 +1cm", D: "D · 옆선 WL −1.5cm · 밑단 +1cm" };
  var SHAPED_BODY = { C: [-1, { a: 1, b: 0, d: 0, e: 1 }], D: [-1.5, { a: 1, b: 1, d: 0.5, e: 1 }] };
  function identifyShaped(body) {
    if (!body || typeof body !== "object" || body.hemExtensionBelowWaistCm !== 20 || body.hemSideOffsetCm !== 1) return null;
    // 화면의 working body 는 정규화돼 bustEaseCm·sideSeamCurve 기본값 0 이 붙는다 — 0 이면 프리셋과 같은 것으로 본다.
    var extra = Object.keys(body).filter(function (k) { return k !== "hemExtensionBelowWaistCm" && k !== "hemSideOffsetCm" && k !== "waistDartScales" && k !== "waistSideOffsetCm"; });
    if (extra.some(function (k) { return !((k === "bustEaseCm" || k === "sideSeamCurve") && body[k] === 0); })) return null;
    if (body.waistSideOffsetCm === undefined) return null;
    var sc = body.waistDartScales; if (!sc || typeof sc !== "object") return null;
    return ["C", "D"].filter(function (id) {
      var e = SHAPED_BODY[id];
      return body.waistSideOffsetCm === e[0] && Object.keys(e[1]).every(function (k) { return sc[k] === e[1][k]; }) && Object.keys(sc).length === 4;
    })[0] || null;
  }
  // 다트 표시명: 허리 다트는 기호(a·b·c·d·e·f), 가슴·뒤어깨 다트는 이름
  function dartName(id) {
    var m = /-([a-f])$/.exec(id); if (m) return m[1];
    return id === "front-bust" ? "가슴" : id === "back-shoulder" ? "뒤어깨" : id;
  }
  function buildBoxySide(key, label, cfName, piece, variant) {
    if (!piece || !Array.isArray(piece.outline)) return null;
    var out = piece.outline, cons = piece.construction || [];
    var centers = by(out, "center"), sides = by(out, "side-seam"), hems = by(out, "hem"), waists = by(cons, "waist");
    if (!centers.length || !sides.length || hems.length !== 1 || waists.length !== 1) return null;
    var longest = function (arr) { return arr.slice().sort(function (a, b) { var ea = ends(a), eb = ends(b); return dist(eb.from, eb.to) - dist(ea.from, ea.to); })[0]; };
    var cm = mid(longest(centers)), sm = mid(longest(sides)), hm = mid(hems[0]), we = ends(waists[0]);
    var u = unit({ x: sm.x - cm.x, y: sm.y - cm.y }); if (!u) return null;
    var along = function (p) { return (p.x - cm.x) * u.x + (p.y - cm.y) * u.y; };
    var wSide = along(we.from) > along(we.to) ? we.from : we.to;
    var wMid = mid(waists[0]);
    var up = unit({ x: wMid.x - hm.x, y: wMid.y - hm.y }) || { x: 0, y: -1 };
    var xs = [], ys = [];
    out.forEach(function (s) { ctrl(s).forEach(function (p) { xs.push(p.x); ys.push(p.y); }); });
    var below = { x: (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2, y: Math.max.apply(null, ys) };
    var lines = [];
    var add = function (id, at, dx, dy, anchor, text, cls) { lines.push({ id: id, at: P(at), px: { dx: dx, dy: dy }, anchor: anchor, text: text, cls: cls }); };
    add("title", below, 0, 40, "middle", label, "title");
    add("variant", below, 0, 54, "middle", (BOXY[variant] || SHAPED[variant]), "note");
    add("center", cm, -u.x * 8, 3, -u.x >= 0 ? "start" : "end", cfName, "edge");
    add("side", sm, u.x * 8, 3, u.x >= 0 ? "start" : "end", "옆선", "edge");
    add("waist", wSide, u.x * 8, 3, u.x >= 0 ? "start" : "end", "허리선(WL)", "edge");
    add("hem", hm, -up.x * 13, -up.y * 13 + 4, "middle", "밑단선", "edge");
    // 가슴선(BL): 옆선 상단점 = 진동 끝점 C(draft.js ⑤, y=yBL). 이 점을 지나는 수평선을 앞/뒤중심 직선 변까지 긋는다(새 치수·추측 없음).
    var legs = [], sTop = null;
    sides.forEach(function (sd) { var e = ends(sd); [e.from, e.to].forEach(function (q) { if (!sTop || q.y < sTop.y) sTop = q; }); });
    var cSeg = centers.filter(function (c) { var e = ends(c); return !isCurved(c) && Math.abs(e.from.y - e.to.y) > 1e-9 && sTop && (sTop.y - e.from.y) * (sTop.y - e.to.y) <= 0; })[0];
    if (sTop && cSeg) {
      var ce = ends(cSeg), tt = (sTop.y - ce.from.y) / (ce.to.y - ce.from.y);
      var cPt = { x: ce.from.x + (ce.to.x - ce.from.x) * tt, y: sTop.y };
      legs.push({ id: "bl", from: P(cPt), to: P(sTop) });
      add("bl", cPt, -u.x * 8, -8, -u.x >= 0 ? "start" : "end", "가슴선(BL)", "edge");   // 앞뒤 옆선 사이 간격이 좁아 라벨은 중심선 쪽에 둔다
    }
    // 다트: id 별로 다리를 모아 입구(허리/외곽 쪽 끝) 두 점 사이 거리 = 다트 분량. 접어 재단(onFold)은 한쪽 다리뿐이라 접힘선까지 거리(반쪽).
    var byId = {}, order = [];
    cons.forEach(function (s) { if (s && s.dart && s.dart.id) { if (!byId[s.dart.id]) { byId[s.dart.id] = []; order.push(s.dart.id); } byId[s.dart.id].push(s); } });
    var darts = [];
    order.forEach(function (id) {
      var legs = byId[id], mouths = legs.map(function (l) { return l.dart.apexAt === "to" ? l.from : l.to; });
      var apex = legs[0].dart.apexAt === "to" ? legs[0].to : legs[0].from, amt, half = false;
      if (legs.length === 2) amt = dist(mouths[0], mouths[1]);
      else if (legs.length === 1 && legs[0].dart.onFold) { amt = Math.abs(mouths[0].x - apex.x); half = true; }
      else return;
      var at = legs.length === 2 ? { x: (mouths[0].x + mouths[1].x) / 2, y: (mouths[0].y + mouths[1].y) / 2 } : mouths[0];
      var nm = dartName(id), boundary = legs[0].dart.boundary;
      var isHalfD = variant === "D" && nm === "d";   // 교재 «d 는 반으로»: 실측 소수 둘째 자리까지 + (½)
      var txt = nm + " " + (isHalfD ? (Math.round(amt * 100) / 100).toFixed(2) : fmt1(amt)) + "cm" + (half ? "(접힘 반쪽)" : "") + (isHalfD ? "(½)" : "");
      if (boundary === "waist") add("dart-" + id, at, 0, 12, "middle", txt, "cut");
      else if (boundary === "shoulder") add("dart-" + id, at, 0, -8, "middle", txt, "cut");
      else add("dart-" + id, at, u.x * 8, 3, u.x >= 0 ? "start" : "end", txt, "cut");
      darts.push({ id: id, name: nm, amountCm: amt, half: half });
    });
    return { key: key, title: label, lines: lines, legs: legs, wedges: [], notches: [], cuts: [], darts: darts,
      totalCm: null, finishedWaistCm: null };
  }

  // ── 플레어 Ⓗ(P.21 · P.163) 표시 모델 ──
  // 의미는 좌표 추측이 아니라 `flareCm.slash` 메타(기준점·밑단 끝·∅·■·●)와 geometry 의 edge 태그(hem cubic 이음)에서만 읽는다.
  // ∅ 이음 = 끝점 하나가 메타의 foot(고정 쪽)과 일치하는 hem cubic — ∅ = ■ 로 잘린 경우에도 짝이 모호하지 않다.
  function buildFlareSlashSide(key, label, cfName, piece) {
    var m = piece && piece.flareCm && piece.flareCm.slash;
    if (!piece || !Array.isArray(piece.outline) || !m || !m.pivot || !m.foot || !num(m.chordCm) || !num(m.bustWidthCm) || !num(m.dartSpreadCm)) return null;
    var out = piece.outline;
    var centers = by(out, "center"), sides = by(out, "side-seam"), hems = by(out, "hem");
    if (!centers.length || !sides.length || !hems.length) return null;
    var longest = function (arr) { return arr.slice().sort(function (a, b) { var ea = ends(a), eb = ends(b); return dist(eb.from, eb.to) - dist(ea.from, ea.to); })[0]; };
    var cm = mid(longest(centers)), sm = mid(longest(sides)), hm = mid(longest(hems.filter(function (h) { return !isCurved(h); })));
    var u = unit({ x: sm.x - cm.x, y: sm.y - cm.y }); if (!u) return null;
    var bridge = null;
    hems.filter(isCurved).forEach(function (b) {
      var e = ends(b); if (!e) return;
      if (dist(e.from, m.foot) < 1e-6) bridge = { b: b, fixed: e.from, moved: e.to };
      else if (dist(e.to, m.foot) < 1e-6) bridge = { b: b, fixed: e.to, moved: e.from };
    });
    if (!bridge) return null;                                   // 짝을 확인하지 못하면 안내선을 지어내지 않는다
    var xs = [], ys = [];
    out.forEach(function (sg) { ctrl(sg).forEach(function (q) { xs.push(q.x); ys.push(q.y); }); });
    var below = { x: (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2, y: Math.max.apply(null, ys) };
    var lines = [];
    var add = function (id, at, dx, dy, anchor, text, cls) { lines.push({ id: id, at: P(at), px: { dx: dx, dy: dy }, anchor: anchor, text: text, cls: cls }); };
    add("title", below, 0, 40, "middle", label + " · 플레어 Ⓗ", "title");
    add("amount", below, 0, 54, "middle", "절개 벌림 ∅ " + fmt1(m.chordCm) + "cm = " + (m.clamped ? "■ 상한(산식 " + fmt1(m.formulaCm) + " > ■)" : "● " + fmt1(m.bustWidthCm) + " − (" + fmt1(m.hemExtraCm) + " + ■ " + fmt1(m.dartSpreadCm) + ")"), "note");
    add("rule", below, 0, 67, "middle", "∅ = min(●×1 − (밑단 옆 " + fmt1(m.hemExtraCm) + " + ■), ■) · ● 가슴선 폭 " + fmt1(m.bustWidthCm) + " · ■ 다트 닫음 " + fmt1(m.dartSpreadCm) + " · 각도 " + fmt1(Math.abs(m.angleDeg)) + "°", "note");
    add("basis", below, 0, 80, "middle", "절개: " + (m.rule === "dart-mouth" ? "AH 다트 입구" : "진동 가장 안쪽") + "(고정점)에서 밑단까지 · 교재 P.163 기준점 고정 벌림", "note");
    add("center", cm, -u.x * 8, 3, -u.x >= 0 ? "start" : "end", cfName, "edge");
    add("side", sm, u.x * 8, 3, u.x >= 0 ? "start" : "end", "옆선", "edge");
    add("hem", hm, 0, 16, "middle", "밑단선", "edge");
    add("pivot", m.pivot, 0, -9, "middle", "고정점", "cut");
    var bm = mid(bridge.b);
    add("amt", bm, 0, 14, "middle", "∅ " + fmt1(m.chordCm), "amount");
    return { key: key, title: label, lines: lines,
      legs: [{ id: "slash-a", from: P(m.pivot), to: P(bridge.fixed) }, { id: "slash-b", from: P(m.pivot), to: P(bridge.moved) }],
      wedges: [{ id: "slash", pts: [P(m.pivot), P(bridge.fixed), P(bridge.moved)] }],
      notches: [{ id: "slash", at: P(m.pivot) }],
      cuts: [{ id: "slash", symbol: null, chordCm: m.chordCm, angleDeg: m.angleDeg, pivot: P(m.pivot), matched: true }],
      totalCm: m.chordCm, finishedWaistCm: null };
  }

  // ── 목둘레 턱 Ⓘ(P.22 · P.161) 표시 모델 ──
  // 의미는 `neckTuck` 메타(절개 틈 양 끝·박기 끝·각·현)에서만 읽는다 — 좌표를 추측하지 않는다. 절개 위치·배분·깊이는 책에 수치가 없어 사용자 확정값이다.
  function buildNeckTuckSide(key, label, cfName, piece) {
    var m = piece && piece.neckTuck;
    if (!piece || !Array.isArray(piece.outline) || !m || !m.apex || !Array.isArray(m.cuts) || m.cuts.length !== 2 || !num(m.dartAngleRad) || !num(m.depthCm)) return null;
    var centers = by(piece.outline, "center"), necks = by(piece.outline, "neckline");
    if (!centers.length || !necks.length) return null;
    var xs = [], ys = [];
    piece.outline.forEach(function (sg) { ctrl(sg).forEach(function (q) { xs.push(q.x); ys.push(q.y); }); });
    var below = { x: (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2, y: Math.max.apply(null, ys) };
    var lines = [], legs = [], wedges = [], notches = [], cuts = [];
    var add = function (id, at, dx, dy, anchor, text, cls) { lines.push({ id: id, at: P(at), px: { dx: dx, dy: dy }, anchor: anchor, text: text, cls: cls }); };
    var deg = Math.abs(m.dartAngleRad) * 180 / Math.PI, total = 0;
    m.cuts.forEach(function (c) { total += c.gapChordCm; });
    var band = m.centerBand;   // Ⓙ(P.23) 에만 — 중심 평행 띠
    if (band && (!num(band.widthCm) || !band.stitchEnd || !band.oldCenter || !band.newCenter)) return null;
    add("title", below, 0, 40, "middle", label + (band ? " · 목둘레 턱 Ⓙ" : " · 목둘레 턱 Ⓘ"), "title");
    add("amount", below, 0, 54, "middle", "턱 2개 · 목둘레 벌림 " + m.cuts.map(function (c) { return fmt1(c.gapChordCm); }).join(" + ") + " = " + fmt1(total) + "cm" + (band ? " · 중심 평행 띠 " + fmt1(band.widthCm) + "cm" : ""), "amount");
    add("rule", below, 0, 67, "middle", "닫는 다트 " + fmt2(deg) + "° 를 절개 둘이 균등 분배(각 " + fmt2(deg / 2) + "°) · 목둘레 호 1/3·2/3 · 교재 P.161", "note");
    add("basis", below, 0, 80, "middle", band
      ? "턱은 중심 쪽으로 꺾는다 · 띠 폭 = 앞 목둘레 틈 합(앞·뒤 공통) · 박기 끝 = 새 중심선에서 목둘레 아래 " + fmt1(band.stitchEndCm) + "cm(책 P.23 + 확정값)"
      : "턱은 바깥쪽으로 꺾는다 · 박기 끝 = 목둘레에서 " + fmt1(m.depthCm) + "cm 아래(절개 위치·배분·깊이는 책에 수치가 없어 확정값)", "note");
    m.cuts.forEach(function (c) {
      var id = "tuck" + c.index;
      wedges.push({ id: id, pts: [P(c.neckBefore), P(c.neckAfter), P(m.apex)] });
      legs.push({ id: id + "-a", from: P(c.neckBefore), to: P(c.endBefore) });
      legs.push({ id: id + "-b", from: P(c.neckAfter), to: P(c.endAfter) });
      notches.push({ id: id + "-end-a", at: P(c.endBefore) });
      notches.push({ id: id + "-end-b", at: P(c.endAfter) });
      add(id, { x: (c.neckBefore.x + c.neckAfter.x) / 2, y: (c.neckBefore.y + c.neckAfter.y) / 2 }, 0, -9, "middle", "턱" + (c.index === 1 ? "①" : "②") + " " + fmt1(c.gapChordCm), "amount");
      add(id + "-end", { x: (c.endBefore.x + c.endAfter.x) / 2, y: (c.endBefore.y + c.endAfter.y) / 2 }, 0, 12, "middle", "박기 끝", "cut");
      cuts.push({ id: id, symbol: null, chordCm: c.gapChordCm, angleDeg: c.angleRad * 180 / Math.PI, pivot: P(m.apex), matched: true });
    });
    notches.push({ id: "apex", at: P(m.apex) });
    if (band) {   // 띠(원래 중심 → 새 중심) 표시와 박기 끝 — 새 중심선 위, 목둘레(위쪽 끝)에서 아래로
      var oc = band.oldCenter, nc = band.newCenter, up = nc.from.y <= nc.to.y ? nc.from : nc.to;
      wedges.push({ id: "band", pts: [P(oc.from), P(nc.from), P(nc.to), P(oc.to)] });
      legs.push({ id: "band-stitch", from: P(up), to: P(band.stitchEnd) });
      notches.push({ id: "band-stitch-end", at: P(band.stitchEnd) });
      var outDx = nc.from.x >= oc.from.x ? 6 : -6;
      add("band-stitch-end", band.stitchEnd, outDx, 4, outDx > 0 ? "start" : "end", "박기 끝", "cut");
    }
    var cm = mid(centers[0]);
    add("center", cm, -8, 3, "end", cfName, "edge");
    return { key: key, title: label, lines: lines, legs: legs, wedges: wedges, notches: notches, cuts: cuts, totalCm: total, finishedWaistCm: null };
  }

  function buildModel(geometry, body) {
    var g = geometry, ws = g && g.waistSeam;
    if (g && !ws && body && (body.neckTuck === true || body.neckTuck === "J")) {   // Ⓘ·Ⓙ — 파라미터가 말할 때만
      return { front: buildNeckTuckSide("front", "앞몸판", "앞중심(CF)", g.front), back: buildNeckTuckSide("back", "뒤몸판", "뒤중심(CB)", g.back) };
    }
    if (g && !ws && body && body.flareSlash === true) {   // Ⓗ — 파라미터가 말할 때만(메타만으로 식별하지 않는다)
      return { front: buildFlareSlashSide("front", "앞몸판", "앞중심(CF)", g.front), back: buildFlareSlashSide("back", "뒤몸판", "뒤중심(CB)", g.back) };
    }
    if (g && !ws) {
      var v = identifyBoxy(body) || identifyShaped(body);
      if (!v) return { front: null, back: null };
      return { front: buildBoxySide("front", "앞몸판", "앞중심(CF)", g.front, v), back: buildBoxySide("back", "뒤몸판", "뒤중심(CB)", g.back, v) };
    }
    if (!g || !ws) return { front: null, back: null };
    var m = {
      front: buildSide("frontPeplum", "앞 페플럼", "앞중심(CF)", g.frontPeplum, ws.front),
      back: buildSide("backPeplum", "뒤 페플럼", "뒤중심(CB)", g.backPeplum, ws.back)
    };
    // Ⓞ(true)·Ⓟ("P") 만: 상부 몸판 가슴선(BL)을 같은 모델에 합성한다. Ⓝ 등은 불변.
    if (body && (body.peplumCut === true || body.peplumCut === "P")) {
      addUpperBL(m.front, g.front, "frontPeplum", g);
      addUpperBL(m.back, g.back, "backPeplum", g);
    }
    return m;
  }

  // 모델 좌표는 렌더러가 페플럼 표시 내림(peplumDrop)을 더해 그린다. 상부 몸판의 BL 은 내리지 않으므로
  // 그만큼 미리 뺀다(모델 y + drop = geometry y). designLayout 이 없으면 추가하지 않는다(추측 금지).
  function addUpperBL(model, piece, peplumKey, g) {
    if (!model || !piece || !Array.isArray(piece.outline)) return;
    var DL = window.designLayout; if (!DL || typeof DL.peplumDrop !== "function") return;
    var centers = by(piece.outline, "center"), sides = by(piece.outline, "side-seam");
    if (!centers.length || !sides.length) return;
    var longest = function (arr) { return arr.slice().sort(function (a, b) { var ea = ends(a), eb = ends(b); return dist(eb.from, eb.to) - dist(ea.from, ea.to); })[0]; };
    var cm = mid(longest(centers)), sm = mid(longest(sides));
    var u = unit({ x: sm.x - cm.x, y: sm.y - cm.y }); if (!u) return;
    var sTop = null;
    sides.forEach(function (sd) { var e = ends(sd); [e.from, e.to].forEach(function (q) { if (!sTop || q.y < sTop.y) sTop = q; }); });
    var cSeg = centers.filter(function (c) { var e = ends(c); return !isCurved(c) && Math.abs(e.from.y - e.to.y) > 1e-9 && sTop && (sTop.y - e.from.y) * (sTop.y - e.to.y) <= 0; })[0];
    if (!sTop || !cSeg) return;
    var dy = DL.peplumDrop(g, peplumKey), ce = ends(cSeg), tt = (sTop.y - ce.from.y) / (ce.to.y - ce.from.y);
    var cPt = { x: ce.from.x + (ce.to.x - ce.from.x) * tt, y: sTop.y - dy };
    model.legs.push({ id: "bl", from: cPt, to: { x: sTop.x, y: sTop.y - dy } });
    model.lines.push({ id: "bl", at: P(cPt), px: { dx: -u.x * 8, dy: -8 }, anchor: -u.x >= 0 ? "start" : "end", text: "가슴선(BL)", cls: "edge" });
  }

  window.peplumAnnotation = Object.freeze({ buildModel: buildModel });
})();
