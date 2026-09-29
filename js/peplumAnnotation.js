// ══════════════════════════════════════════════
// peplumAnnotation.js — 페플럼 제작 정보 표시 모델(순수, 표시 전용).
//
// ★ 이 모듈이 만드는 것은 형상이 아니다. geometry·계측·체크포인트·hash·선택(hit)·레이아웃 어디에도
//   들어가지 않는다. render.js 가 읽어 SVG 오버레이로만 그린다(pointer-events:none).
// ★ 의미는 좌표 추측이 아니라 **geometry 의 edge 태그(waist/hem/center/side-seam) + designWaistSeam 메타**
//   (`waistSeam.<side>.joins[].spread.pivot`, `peplumFlare`)에서만 읽는다. 절개 다리 끝점은 밑단 이음(cubic)의
//   두 끝점이며, 고정점과의 거리가 같은 쌍(이등변)이라는 **기하 항등식**으로 짝을 확인한다.
// ★ Ⓝ(peplumFlare) 에만 모델이 있다. Ⓜ 등 다른 프리셋은 null — 화면·데이터 모두 그대로다.
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

  function buildModel(geometry) {
    var g = geometry, ws = g && g.waistSeam;
    if (!g || !ws) return { front: null, back: null };
    return {
      front: buildSide("frontPeplum", "앞 페플럼", "앞중심(CF)", g.frontPeplum, ws.front),
      back: buildSide("backPeplum", "뒤 페플럼", "뒤중심(CB)", g.backPeplum, ws.back)
    };
  }

  window.peplumAnnotation = Object.freeze({ buildModel: buildModel });
})();
