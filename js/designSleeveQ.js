// ══════════════════════════════════════════════
// designSleeveQ.js — 소매 Ⓠ 캡 슬리브([패턴학교] P.48 하단 «소맷부리선을 그린다(캡 슬리브)»). 순수.
//
// 김님 확정(2026-10-26, docs/book/P048.md § Ⓠ):
//   · 출발 = 같은 완료 몸판의 Ⓐ **소매산만**(위팔선 아래는 전부 잘라냄 — 출발 Ⓐ 기장은 결과와 무관, 형상·출처 hash 에 들어가지 않는다).
//   · 소매산 높이 H(SP → 위팔선) · 높이 비율 r(기본 1/4 = 0.25, 입력 범위 1/4 ~ 3/4 = 0.25 ~ 0.75 양 끝 포함, 연속 중간값 허용):
//     위팔선에서 위로 H × r 올라간 수평선 y = 위팔선 y − H·r 이 소매산 곡선과 만나는 두 점(뒤·앞)을 구해 **직선 소맷부리**로 잇는다.
//     범위 밖·빈 값·NaN 은 사유와 함께 거부(clamp·대체 없음). SP 높이 유지.
//   · 소매산은 두 교점 사이의 원래 곡선을 그대로 잘라 쓴다(국소 재제도·벌림·상승·회전·옆선 추가 없음).
//   · 소매에서 빠지는 호(Ⓐ 아랫점 → 교점): 뒤 ● · 앞 ∅ 를 실측한다(몸판 달림 끝 위치는 Apply 가 같은 몸판 진동에서 같은 호 길이로 잰다).
//   · 중심선의 점선 고리 기호(책)는 의미 미확정 — 형상 계산에 쓰지 않는다.
// 길이는 최종 geometry 실측. 앞/뒤 분할 = geometry.capSplit(x = SP.x).
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var RATIO_DEFAULT = 0.25, RATIO_MIN = 0.25, RATIO_MAX = 0.75;   // 김님 확정(기본 1/4 · 범위 1/4 ~ 3/4 양 끝 포함)
  var JOIN = 1e-9, TOL = 1e-6;
  var G1_TOL_DEG = 1e-9;
  var KAPPA_DEAD = 0.01;
  var FLAT_N = 24;
  var MAX_ROTATION = Math.PI / 4;   // 공용 도구 상수(Ⓠ 은 회전 없음)
  var REDRAW_ELL = 2.0, REDRAW_RATIO = 0.4, REDRAW_MIN = 0.5, REDRAW_STEP = 0.25;   // 공용 도구 상수(Ⓠ 은 재제도 없음)
  var GX = [-0.9894009349916499, -0.9445750230732326, -0.8656312023878318, -0.7554044083550030, -0.6178762444026438, -0.4580167776572274, -0.2816035507792589, -0.0950125098376374,
    0.0950125098376374, 0.2816035507792589, 0.4580167776572274, 0.6178762444026438, 0.7554044083550030, 0.8656312023878318, 0.9445750230732326, 0.9894009349916499];
  var GW = [0.0271524594117541, 0.0622535239386479, 0.0951585116824928, 0.1246289712555339, 0.1495959888165767, 0.1691565193950025, 0.1826034150449236, 0.1894506104550685,
    0.1894506104550685, 0.1826034150449236, 0.1691565193950025, 0.1495959888165767, 0.1246289712555339, 0.0951585116824928, 0.0622535239386479, 0.0271524594117541];

  function cp(p) { return { x: p.x, y: p.y }; }
  function fin(v) { return typeof v === "number" && isFinite(v); }
  function finPt(p) { return !!p && fin(p.x) && fin(p.y); }
  function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
  function add(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }
  function mul(a, k) { return { x: a.x * k, y: a.y * k }; }
  function dist(a, b) { var dx = b.x - a.x, dy = b.y - a.y; return Math.sqrt(dx * dx + dy * dy); }
  function unit(a) { var l = Math.sqrt(a.x * a.x + a.y * a.y); return l > 1e-15 ? { x: a.x / l, y: a.y / l } : null; }
  function cross(a, b) { return a.x * b.y - a.y * b.x; }
  function angleBetween(u, v) { return Math.atan2(Math.abs(u.x * v.y - u.y * v.x), u.x * v.x + u.y * v.y) * 180 / Math.PI; }
  function L(a, b, role) { var s = { kind: "line", from: cp(a), to: cp(b) }; if (role) s.role = role; return s; }
  function hashStr(s) { var h = 0; for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return (h >>> 0).toString(16); }
  function cubicAt(q, t) {
    var u = 1 - t;
    return { x: u * u * u * q[0].x + 3 * u * u * t * q[1].x + 3 * u * t * t * q[2].x + t * t * t * q[3].x,
      y: u * u * u * q[0].y + 3 * u * u * t * q[1].y + 3 * u * t * t * q[2].y + t * t * t * q[3].y };
  }
  function cubicD1(q, t) {
    var u = 1 - t;
    return { x: 3 * u * u * (q[1].x - q[0].x) + 6 * u * t * (q[2].x - q[1].x) + 3 * t * t * (q[3].x - q[2].x),
      y: 3 * u * u * (q[1].y - q[0].y) + 6 * u * t * (q[2].y - q[1].y) + 3 * t * t * (q[3].y - q[2].y) };
  }
  function cubicD2(q, t) {
    return { x: 6 * (1 - t) * (q[2].x - 2 * q[1].x + q[0].x) + 6 * t * (q[3].x - 2 * q[2].x + q[1].x),
      y: 6 * (1 - t) * (q[2].y - 2 * q[1].y + q[0].y) + 6 * t * (q[3].y - 2 * q[2].y + q[1].y) };
  }
  function kappa(q, t) { var d = cubicD1(q, t), dd = cubicD2(q, t), l = Math.sqrt(d.x * d.x + d.y * d.y); return l > 1e-15 ? cross(d, dd) / (l * l * l) : 0; }
  function cubicLen(q, t0, t1) {   // Gauss-Legendre 16점
    t0 = t0 || 0; t1 = t1 === undefined ? 1 : t1;
    var s = 0;
    for (var i = 0; i < 16; i++) { var t = t0 + (t1 - t0) * (GX[i] + 1) / 2, d = cubicD1(q, t); s += GW[i] * Math.sqrt(d.x * d.x + d.y * d.y); }
    return s * (t1 - t0) / 2;
  }
  function cubicsLen(cs) { var s = 0; cs.forEach(function (q) { s += cubicLen(q); }); return s; }
  function splitAt(q, t) {   // De Casteljau → [왼쪽, 오른쪽]
    var l = function (a, b) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; };
    var p01 = l(q[0], q[1]), p12 = l(q[1], q[2]), p23 = l(q[2], q[3]), a = l(p01, p12), b = l(p12, p23), m = l(a, b);
    return [[cp(q[0]), p01, a, m], [cp(m), b, p23, cp(q[3])]];
  }
  function tAtLen(q, s) { var lo = 0, hi = 1; for (var k = 0; k < 64; k++) { var m = (lo + hi) / 2; if (cubicLen(q, 0, m) < s) lo = m; else hi = m; } return (lo + hi) / 2; }
  function splitListAtLen(cs, s) {   // 이어진 cubic 목록을 시작에서 호 길이 s 인 곳에서 둘로
    var acc = 0;
    for (var i = 0; i < cs.length; i++) {
      var l = cubicLen(cs[i]);
      if (acc + l >= s - 1e-12) {
        var t = tAtLen(cs[i], s - acc);
        if (t < 1e-12) return [cs.slice(0, i), cs.slice(i)];
        if (t > 1 - 1e-12) return [cs.slice(0, i + 1), cs.slice(i + 1)];
        var p = splitAt(cs[i], t); return [cs.slice(0, i).concat([p[0]]), [p[1]].concat(cs.slice(i + 1))];
      }
      acc += l;
    }
    return [cs.slice(), []];
  }
  function splitListAtX(cs, x) {   // x 단조 소매산을 세로선 x 에서 둘로
    for (var i = 0; i < cs.length; i++) {
      var q = cs[i];
      if ((q[0].x - x) * (q[3].x - x) <= 0) {
        var lo = 0, hi = 1, inc = q[3].x > q[0].x;
        for (var k = 0; k < 90; k++) { var m = (lo + hi) / 2; if ((cubicAt(q, m).x < x) === inc) lo = m; else hi = m; }
        var t = (lo + hi) / 2;
        if (t < 1e-12) return [cs.slice(0, i), cs.slice(i)];
        if (t > 1 - 1e-12) return [cs.slice(0, i + 1), cs.slice(i + 1)];
        var p = splitAt(q, t); return [cs.slice(0, i).concat([p[0]]), [p[1]].concat(cs.slice(i + 1))];
      }
    }
    return null;
  }
  function rotP(p, a, c) { var d = sub(p, c), ca = Math.cos(a), sa = Math.sin(a); return { x: c.x + d.x * ca - d.y * sa, y: c.y + d.x * sa + d.y * ca }; }
  function angOf(c, p) { return Math.atan2(p.y - c.y, p.x - c.x); }
  function lineX(p1, p2, p3, p4) {
    var d = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
    if (Math.abs(d) < 1e-14) return null;
    var t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / d;
    return add(p1, mul(sub(p2, p1), t));
  }
  function crossSign(o, a, b) { return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x); }
  function segCross(a, b, c, d) {
    var d1 = crossSign(c, d, a), d2 = crossSign(c, d, b), d3 = crossSign(a, b, c), d4 = crossSign(a, b, d);
    return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
  }
  function loopSelfIntersects(loop) {   // 닫힌 점열(마지막 = 처음)
    var n = loop.length;
    for (var i = 0; i < n - 1; i++) for (var j = i + 2; j < n - 1; j++) {
      if (i === 0 && j === n - 2) continue;
      if (segCross(loop[i], loop[i + 1], loop[j], loop[j + 1])) return true;
    }
    return false;
  }
  function pathOf(cs, role) {
    var cmds = [{ type: "M", points: [cp(cs[0][0])] }];
    cs.forEach(function (q) { cmds.push({ type: "C", points: [cp(q[1]), cp(q[2]), cp(q[3])] }); });
    var o = { kind: "path", commands: cmds }; if (role) o.role = role; return o;
  }
  function flattenCubics(cs, n) { var out = []; cs.forEach(function (q, ci) { for (var i = (ci === 0 ? 0 : 1); i <= n; i++) out.push(cubicAt(q, i / n)); }); return out; }
  function hermite(A, Ta, B, Tb) { var h = dist(A, B) / 3; return [cp(A), add(A, mul(Ta, h)), sub(B, mul(Tb, h)), cp(B)]; }   // 끝점·접선 고정, 핸들 = 현/3(길이 강제 없음)
  function inflectionCount(ks) {
    var sg = ks.map(function (k) { return k > KAPPA_DEAD ? 1 : (k < -KAPPA_DEAD ? -1 : 0); }).filter(function (v) { return v; }), n = 0;
    for (var i = 1; i < sg.length; i++) if (sg[i] !== sg[i - 1]) n++;
    return n;
  }
  function kappaOnRange(cs, s0, s1) {   // 목록의 호 길이 [s0, s1] 구간 곡률 표본
    var out = [], acc = 0;
    cs.forEach(function (q) {
      var l = cubicLen(q);
      if (acc + l >= s0 && acc <= s1) {
        var m = Math.max(16, Math.ceil(240 * l / Math.max(s1 - s0, 1e-9)));
        for (var i = 0; i <= m; i++) { var t = i / m, s = acc + cubicLen(q, 0, t); if (s >= s0 && s <= s1) out.push(kappa(q, t)); }
      }
      acc += l;
    });
    return out;
  }

  // ── Ⓐ 읽기(소매산 cubic 연쇄 · 수직 밑선 · 수평 소맷부리) ──
  function readSleeveA(a) {
    if (!a || typeof a !== "object" || a.ok === false) return { ok: false, reason: "no-sleeve-a" };
    var g = a.geometry, m = a.meta;
    if (!g || !Array.isArray(g.outline) || g.outline.length !== 4 || !m || typeof m !== "object") return { ok: false, reason: "invalid-sleeve-a" };
    var capS = g.outline[0], sB = g.outline[1], sF = g.outline[2], hm = g.outline[3];
    if (!capS || capS.kind !== "path" || !Array.isArray(capS.commands) || capS.commands.length < 3 || capS.commands[0].type !== "M") return { ok: false, reason: "invalid-sleeve-a" };
    var cubs = [], cur = capS.commands[0].points[0];
    for (var i = 1; i < capS.commands.length; i++) {
      var c = capS.commands[i];
      if (c.type !== "C" || !c.points || c.points.length !== 3) return { ok: false, reason: "invalid-sleeve-a" };
      cubs.push([cp(cur), cp(c.points[0]), cp(c.points[1]), cp(c.points[2])]); cur = c.points[2];
    }
    if (!cubs.every(function (q) { return q.every(finPt); })) return { ok: false, reason: "invalid-sleeve-a" };
    if (![sB, sF, hm].every(function (s) { return s && s.kind === "line" && finPt(s.from) && finPt(s.to); })) return { ok: false, reason: "invalid-sleeve-a" };
    var Ub = cubs[0][0], Uf = cubs[cubs.length - 1][3], sp = m.sp, slen = m.sleeveLengthCm;
    if (!finPt(sp) || !fin(slen)) return { ok: false, reason: "invalid-sleeve-a" };
    var k = -1;
    for (var j = 0; j < cubs.length; j++) if (dist(cubs[j][3], sp) < JOIN) k = j;
    if (k < 0 || k === cubs.length - 1) return { ok: false, reason: "invalid-sleeve-a", detail: "sp-not-on-cap" };
    var vertical = sB.from.x === sB.to.x && sF.from.x === sF.to.x;
    var okEnds = dist(sB.from, Ub) < JOIN && dist(sF.from, Uf) < JOIN;
    var hemFlat = Math.abs(sB.to.y - sF.to.y) < JOIN && Math.abs(sB.to.y - slen) < TOL;
    if (!vertical || !okEnds || !hemFlat) return { ok: false, reason: "invalid-sleeve-a", detail: "seam-or-hem" };
    var W = Uf.x - Ub.x;
    if (!(W > 0) || !(Ub.x < 0) || !(Uf.x > 0)) return { ok: false, reason: "invalid-width" };
    if (fin(m.bicepCm) && Math.abs(m.bicepCm - W) > TOL) return { ok: false, reason: "invalid-sleeve-a", detail: "bicep-mismatch" };
    if (!(slen > Math.max(Ub.y, Uf.y))) return { ok: false, reason: "invalid-sleeve-a", detail: "hem-above-underarm" };
    for (var q2 = 0; q2 < cubs.length; q2++) for (var s2 = 1; s2 <= 64; s2++) if (!(cubicAt(cubs[q2], s2 / 64).x > cubicAt(cubs[q2], (s2 - 1) / 64).x)) return { ok: false, reason: "invalid-sleeve-a", detail: "cap-not-x-monotone" };
    return { ok: true, cubics: cubs, spIndex: k, sp: cp(sp), Ub: cp(Ub), Uf: cp(Uf), hemY: slen, W: W, armholeCm: m.armholeCm || null, sleeveLengthCm: slen };
  }

  function fail(reason, detail, out) { var o = { ok: false, reason: reason }; if (detail !== undefined) o.detail = detail; if (out) o.outOfSupportedRange = true; return o; }

  // 이어진 점열을 지나는 G1 Hermite 사슬: 내부 접선 = 이웃 두 점 방향, 양 끝 접선 = 이웃 접선을 현에 대해 거울(한 방향으로 휨).
  function throughCurve(pts) {
    var n = pts.length, T = [];
    for (var i = 1; i < n - 1; i++) T[i] = unit(sub(pts[i + 1], pts[i - 1]));
    var mirror = function (A, B, t) { var c = unit(sub(B, A)), d = Math.atan2(t.y, t.x) - Math.atan2(c.y, c.x); return rotP(c, -d, { x: 0, y: 0 }); };
    T[0] = mirror(pts[0], pts[1], T[1]);                  // 시작 접선: 두 번째 점 접선의 현 대칭
    var tl = mirror(pts[n - 1], pts[n - 2], { x: -T[n - 2].x, y: -T[n - 2].y }); T[n - 1] = { x: -tl.x, y: -tl.y };
    var cs = [];
    for (var j = 0; j < n - 1; j++) cs.push(hermite(pts[j], T[j], pts[j + 1], T[j + 1]));
    return cs;
  }

  // 입력: sleeveA = draftSleeveA 결과({geometry, meta}). params = {} (Ⓓ 는 소매길이만 — Ⓐ 가 이미 소매길이로 제도된다)

  // 여러 꺾임(호 길이 위치)을 국소 Hermite 로 다시 그린다. 각 꺾임 창은 ℓ 시작값에서 내부 S 가 생기면 줄인다.
  function redrawKinks(RAW, kinks) {
    var signChanges = function (h) { var k = []; for (var i = 0; i <= 240; i++) k.push(kappa(h, i / 240)); return inflectionCount(k); };
    var wins = [];
    for (var ki = 0; ki < kinks.length; ki++) {
      var kp = kinks[ki], got = null;
      for (var ell = REDRAW_ELL; ell >= REDRAW_MIN - 1e-12; ell -= REDRAW_STEP) {
        var lL = Math.min(ell, REDRAW_RATIO * kp.adjL), lR = Math.min(ell, REDRAW_RATIO * kp.adjR);
        var q0 = splitListAtLen(RAW, kp.s - lL), q1 = splitListAtLen(q0[1], lL + lR);
        if (!q0[0].length || !q1[1].length) continue;
        var ca = q0[0][q0[0].length - 1], cb = q1[1][0], h = hermite(ca[3], unit(cubicD1(ca, 1)), cb[0], unit(cubicD1(cb, 0)));
        // Ⓘ: 구간 안의 원래 곡선(꺾임 양쪽 호)이 이미 가진 변곡 수보다 많지 않으면 허용 — Ⓐ 소매산은 반폭 부근에 원래 변곡이 있어,
        //   꺾임이 작을 때(손바닥 작음·소매 긺) «변곡 0» 만 고집하면 자연스러운 재제도도 거부된다(Ⓔ 규칙은 그대로 둠).
        var orig = 0; q1[0].forEach(function (qq) { var kk = []; for (var i2 = 0; i2 <= 120; i2++) kk.push(kappa(qq, i2 / 120)); orig += inflectionCount(kk); });
        if (signChanges(h) <= orig) { got = { ell: ell, a: kp.s - lL, b: kp.s + lR, w: [lL, lR], origInflections: orig }; break; }
      }
      if (!got) return { error: "redraw-inflection-unavoidable" };
      wins.push(got);
    }
    for (var wi = 1; wi < wins.length; wi++) if (!(wins[wi].a > wins[wi - 1].b)) return { error: "redraw-window-invalid" };
    // 창 순서대로 잘라 이어 붙인다.
    var out = [], rest = RAW, pos = 0, hs = [], joins = [], segsKept = [];
    for (var j = 0; j < wins.length; j++) {
      var w = wins[j];
      var s0 = splitListAtLen(rest, w.a - pos), s1 = splitListAtLen(s0[1], w.b - w.a);
      if (!s0[0].length || !s1[1].length) return { error: "redraw-window-invalid" };
      var keep = s0[0], cA = keep[keep.length - 1], cB = s1[1][0];
      var h2 = hermite(cA[3], unit(cubicD1(cA, 1)), cB[0], unit(cubicD1(cB, 0)));
      joins.push({ gapCm: dist(cA[3], h2[0]), g1Deg: angleBetween(cubicD1(cA, 1), cubicD1(h2, 0)) });
      joins.push({ gapCm: dist(h2[3], cB[0]), g1Deg: angleBetween(cubicD1(h2, 1), cubicD1(cB, 0)) });
      out = out.concat(keep, [h2]); hs.push(h2); segsKept.push(keep);
      rest = s1[1]; pos = w.b;
    }
    out = out.concat(rest); segsKept.push(rest);
    return { cap: out, hermites: hs, windows: wins, joins: joins, kept: segsKept };
  }

  // 입력: sleeveA = draftSleeveA 결과({geometry, meta}). params = {} (소매길이는 Ⓐ 가 이미 반영)
  // ── 소맷부리 truing 도구: clamped 3차 B-spline → Bézier(Boehm 삽입) · 오목 투영(Dykstra) ──
  function blKnots(n) { var k = [0, 0, 0, 0], sg = n - 3; for (var i = 1; i < sg; i++) k.push(i); k.push(sg, sg, sg, sg); return k; }
  function blInsert(knots, ctrl, u) {
    var k = 0; while (k < knots.length - 1 && !(u >= knots[k] && u < knots[k + 1])) k++;
    var nc = [];
    for (var i = 0; i <= ctrl.length; i++) {
      if (i <= k - 3) nc.push(ctrl[i]); else if (i > k) nc.push(ctrl[i - 1]);
      else { var a = (u - knots[i]) / (knots[i + 3] - knots[i]); nc.push({ x: (1 - a) * ctrl[i - 1].x + a * ctrl[i].x, y: (1 - a) * ctrl[i - 1].y + a * ctrl[i].y }); }
    }
    return { knots: knots.slice(0, k + 1).concat([u], knots.slice(k + 1)), ctrl: nc };
  }
  function blBezier(ctrl) {
    var knots = blKnots(ctrl.length), c = ctrl.slice(), sg = ctrl.length - 3;
    for (var u = 1; u < sg; u++) for (var r2 = 0; r2 < 2; r2++) { var o = blInsert(knots, c, u); knots = o.knots; c = o.ctrl; }
    var bz = []; for (var s2 = 0; s2 < sg; s2++) bz.push([cp(c[3 * s2]), cp(c[3 * s2 + 1]), cp(c[3 * s2 + 2]), cp(c[3 * s2 + 3])]);
    return bz;
  }
  function yAtX(cs, x) {
    for (var i = 0; i < cs.length; i++) { var q = cs[i], a = q[0].x, b = q[3].x;
      if ((x - a) * (x - b) <= 0) { var lo = 0, hi = 1, inc = b > a; for (var it = 0; it < 80; it++) { var m = (lo + hi) / 2; if ((cubicAt(q, m).x < x) === inc) lo = m; else hi = m; } return cubicAt(q, (lo + hi) / 2).y; } }
    return NaN;
  }
  function concaveProject(xs, ys) {   // y(x) 의 기울기가 줄어들도록(오목) — 양 끝 고정, Dykstra
    var n = xs.length, y = ys.slice(), cons = [];
    for (var i = 1; i < n - 1; i++) { var a = 1 / (xs[i] - xs[i - 1]), b = 1 / (xs[i + 1] - xs[i]), c = []; for (var k = 0; k < n; k++) c.push(0);
      c[i - 1] = (i - 1 === 0) ? 0 : -a; c[i] = a + b; c[i + 1] = (i + 1 === n - 1) ? 0 : -b; cons.push({ c: c, i: i, a: a, b: b }); }
    var inc = cons.map(function () { var z = []; for (var k = 0; k < n; k++) z.push(0); return z; });
    for (var it = 0; it < 300; it++) {
      var viol = 0;
      for (var ci = 0; ci < cons.length; ci++) {
        var C = cons[ci], z = y.map(function (v, k) { return v + inc[ci][k]; }), g = (z[C.i] - z[C.i - 1]) * C.a - (z[C.i + 1] - z[C.i]) * C.b, p = z;
        if (g < 0) { var nn = C.c.reduce(function (s3, ck) { return s3 + ck * ck; }, 0); p = z.map(function (v, k) { return v - g * C.c[k] / nn; }); viol = Math.max(viol, -g); }
        inc[ci] = z.map(function (v, k) { return v - p[k]; }); y = p;
      }
      if (viol < 1e-11) break;
    }
    return y;
  }
  function fairHem(P) {   // P: 앞 바깥 → 뒤 바깥(8점). 반환 bz 도 같은 방향.
    var pts = P.slice().sort(function (a, b) { return a.x - b.x; }), xs = pts.map(function (q) { return q.x; }), ys = pts.map(function (q) { return q.y; });
    var cy = concaveProject(xs, ys);
    for (var it = 0; it < 80; it++) {
      var bz0 = blBezier(xs.map(function (x, i) { return { x: x, y: cy[i] }; }));
      var nc = cy.map(function (v, i) { return (i === 0 || i === xs.length - 1) ? v : v + (ys[i] - yAtX(bz0, xs[i])); });
      cy = concaveProject(xs, nc);
    }
    var ctrl = xs.map(function (x, i) { return { x: x, y: cy[i] }; }), bz = blBezier(ctrl);
    var desc = P[0].x > P[P.length - 1].x;
    if (desc) bz = bz.slice().reverse().map(function (q) { return [cp(q[3]), cp(q[2]), cp(q[1]), cp(q[0])]; });
    bz[0][0] = cp(P[0]); bz[bz.length - 1][3] = cp(P[P.length - 1]);
    return { bz: bz, ctrl: ctrl };
  }

  // 소매산 한쪽(뒤 = SP 왼쪽 / 앞 = SP 오른쪽) 목록에서 y = yh 와 만나는 곳: 표본 부호 변화 수(유일성)와 이분법 위치.
  function crossings(cs, yh) {   // 표본 부호 변화마다 하나(교점 수 = 유일성 검사) · 위치는 그 cubic 안 이분법
    var smp = [], N = 400;
    cs.forEach(function (q, i) { for (var k = (i ? 1 : 0); k <= N; k++) smp.push({ i: i, t: k / N, f: cubicAt(q, k / N).y - yh }); });
    var hits = [], last = null;
    smp.forEach(function (sm) {
      if (sm.f === 0) { hits.push({ i: sm.i, t: sm.t, exact: true }); last = null; return; }
      if (last && (last.f > 0) !== (sm.f > 0)) {
        var qi = sm.i, lo = last.i === sm.i ? last.t : 0, hi = sm.t;
        var f = function (u) { return cubicAt(cs[qi], u).y - yh; };
        if (last.i !== sm.i && (f(0) > 0) !== (sm.f > 0) && (f(0) > 0) === (last.f > 0)) { lo = 0; }
        var flo = f(lo);
        for (var it = 0; it < 90; it++) { var mid = (lo + hi) / 2, fm = f(mid); if ((fm > 0) === (flo > 0)) { lo = mid; flo = fm; } else hi = mid; }
        hits.push({ i: qi, t: (lo + hi) / 2 });
      }
      last = sm;
    });
    return hits;
  }
  function polyOfSeg(sg) {   // 몸판 진동 한 조각 → 조밀 점열
    if (sg.kind === "line") return [cp(sg.from), cp(sg.to)];
    var out = [], cur = null;
    sg.commands.forEach(function (c) {
      if (c.type === "M") { cur = c.points[0]; out.push(cp(cur)); }
      else if (c.type === "C") { var q = [cur, c.points[0], c.points[1], c.points[2]]; for (var k = 1; k <= 64; k++) out.push(cubicAt(q, k / 64)); cur = c.points[2]; }
    });
    return out;
  }
  // 몸판 «보관 형상» 진동에서 진동 아랫점부터 호 길이 arc 만큼 잰 점(달림 끝). 진동 체인이 다트 입구 등으로 끊기기 전에 닿지 못하면 위치를 정하지 않는다
  //   (봉제 후 닫힌 진동과 보관 좌표의 관계가 모호 — 임의 보정하지 않고 상태로 보고). 몸판 geometry 는 읽기만 한다.
  // closedDart(선택): Ⓐ 판독의 닫힘 변환 { apex, angleRad } — 위쪽 진동 조각을 apex 축으로 angleRad 돌려 열린 AH 다트를 닫는다(아랫점 고정).
  //   이어진 진동선이 아래 다리 입구 E 에서 끊기면, 남은 조각 끝점 중 닫힘 회전으로 E 에 겹치는 점(위 다리 입구)에서 남은 호를 이어 잰다(2026-10-27 김님 승인).
  //   회전은 호 길이를 보존하므로 이 점이 «다트를 닫은 봉제 진동선 위 같은 호 길이 점»의 보관(열린) 좌표다. 다트 입구 빈 공간·다트 다리 길이는 더하지 않는다.
  var MOUTH_TOL_Q = 0.1;
  function attachEndOn(segs, underarm, arc, closedDart) {
    var polys = segs.map(polyOfSeg), used = polys.map(function () { return false; }), cur = cp(underarm), walked = 0, chain = 0, across = null;
    while (true) {
      var k = -1, rev = false;
      for (var i = 0; i < polys.length; i++) {
        if (used[i]) continue;
        if (dist(polys[i][0], cur) < 1e-3) { k = i; rev = false; break; }
        if (dist(polys[i][polys[i].length - 1], cur) < 1e-3) { k = i; rev = true; break; }
      }
      if (k < 0 && closedDart && !across) {   // 열린 AH 다트 입구 E = cur — 닫힘 회전으로 E 에 오는 위 다리 입구를 찾는다
        var best = null;
        for (var i2 = 0; i2 < polys.length; i2++) {
          if (used[i2]) continue;
          [[0, false], [polys[i2].length - 1, true]].forEach(function (e) {
            var pt = polys[i2][e[0]], r = rotP(pt, closedDart.angleRad, closedDart.apex), res = dist(r, cur);
            if (res <= MOUTH_TOL_Q && (!best || res < best.res)) best = { k: i2, rev: e[1], res: res, upMouth: cp(pt) };
          });
        }
        if (best) { across = { lowerMouth: cp(cur), upperMouth: best.upMouth, mouthResidualCm: best.res, lowerArcCm: walked, apex: cp(closedDart.apex), angleRad: closedDart.angleRad }; k = best.k; rev = best.rev; }
      }
      if (k < 0) return { status: "beyond-continuous-armhole", reachedCm: walked, note: closedDart ? "닫힘 회전으로 이어지는 위 다리 입구를 찾지 못함 — 달림 끝 표시 보류(판단 필요)" : "진동 아랫점에서 이어진 진동선(다트 입구 전)이 이 호 길이보다 짧음 — 달림 끝 표시 보류(판단 필요)" };
      used[k] = true; chain++;
      var pts = rev ? polys[k].slice().reverse() : polys[k];
      for (var j = 1; j < pts.length; j++) {
        var d = dist(pts[j - 1], pts[j]);
        if (walked + d >= arc) {
          var u = (arc - walked) / d, pnt = { x: pts[j - 1].x + (pts[j].x - pts[j - 1].x) * u, y: pts[j - 1].y + (pts[j].y - pts[j - 1].y) * u };
          var res0 = { status: "ok", point: pnt, arcCm: arc, segmentsWalked: chain, segIndex: k };
          if (across) {   // 위쪽 조각 위의 점: 보관 좌표(표시) + 닫힌 봉제 좌표(= 닫힘 회전) · 대응 근거 기록
            res0.acrossClosedDart = true; res0.owner = "upper-armhole-piece"; res0.closedPoint = rotP(pnt, across.angleRad, across.apex);
            res0.closure = { apex: across.apex, angleDeg: across.angleRad * 180 / Math.PI, lowerMouth: across.lowerMouth, upperMouth: across.upperMouth, mouthResidualCm: across.mouthResidualCm, lowerArcCm: across.lowerArcCm,
              note: "Ⓐ 판독 닫힘 변환(위쪽 조각을 BP 축 회전 · 아랫점 고정)의 역 — 보관 점 = 닫힌 봉제 진동 위 같은 호 길이 점을 위쪽 조각으로 되돌린 것" };
          }
          return res0;
        }
        walked += d;
      }
      cur = pts[pts.length - 1];
    }
  }
  function bodiceAttachEnds(bodiceResult, excluded) {
    var SAx = window.designSleeveA; if (!SAx || !bodiceResult || !bodiceResult.armhole) return null;
    var rb = SAx.readBodiceArmhole(bodiceResult); if (!rb.ok) return null;
    var out = {};
    // 원형 등가 측정 복사본(Ⓗ·Ⓜ·Ⓝ — 2026-10-27)의 진동에서 호 길이로 재고, 그 점이 놓인 조각의 정변환으로 몸판(보관) 위치에 되돌린다.
    //   복원 기록이 없는 몸판은 측정 복사본 = 보관 형상(기존과 같음). Ⓜ·Ⓝ 의 틈 메움 직선은 복사본에 없으므로 호에 들어가지 않는다.
    ["back", "front"].forEach(function (pc) {
      var R = rb[pc], segs = R.armholeMeasure || bodiceResult.armhole[pc], u0 = R.underarmMeasure || R.underarmStored;
      var e = attachEndOn(segs, u0, excluded[pc], R.closedDart || null);
      var fw = R.armholeForward && e.status === "ok" ? R.armholeForward[e.segIndex] : null;
      if (fw) {
        var mp = cp(e.point);
        e.point = rotP(mp, fw.angleRad, fw.center); e.measurePoint = mp;
        e.restoreOwner = { kind: R.restore ? R.restore.kind : null, center: cp(fw.center), angleDeg: fw.angleRad * 180 / Math.PI,
          note: "측정 복사본(원형 등가) 위 점을 그 점이 놓인 조각의 변환으로 몸판 위치에 되돌림" };
      }
      delete e.segIndex;
      e.underarm = cp(R.underarmStored); out[pc] = e;
    });
    return out;
  }

  // 입력: sleeveA = Ⓐ(draftSleeveA 결과 — 소매산만 쓴다). params = { heightRatio } — 없으면 기본 0.25. 값은 고쳐 쓰지 않는다.
  function draftSleeveQ(sleeveA, params) {
    var r0 = params && params.heightRatio, ratio = (r0 === undefined || r0 === null) ? RATIO_DEFAULT : r0;
    if (!fin(ratio)) return fail("invalid-height-ratio", ratio);
    if (ratio < RATIO_MIN || ratio > RATIO_MAX) return fail("height-ratio-out-of-range", { value: ratio, min: RATIO_MIN, max: RATIO_MAX });
    var r = readSleeveA(sleeveA);
    if (!r.ok) return r;
    var cubs = r.cubics, Ub = r.Ub, Uf = r.Uf, SP = cp(r.sp), X0 = SP.x, k = r.spIndex;
    if (Math.abs(Ub.y - Uf.y) > 1e-9) return fail("invalid-sleeve-a", "underarm-not-level");
    var bicepY = Ub.y, H = bicepY - SP.y;
    if (!(H > 0)) return fail("invalid-sleeve-a", "cap-height");
    var yh = bicepY - H * ratio;
    var backCs = cubs.slice(0, k + 1), frontCs = cubs.slice(k + 1);
    var hb = crossings(backCs, yh), hf = crossings(frontCs, yh);
    if (hb.length !== 1 || hf.length !== 1) return fail("hem-intersection-not-unique", { back: hb.length, front: hf.length });
    var sb = splitAt(backCs[hb[0].i], hb[0].t), sf = splitAt(frontCs[hf[0].i], hf[0].t);
    var Pb = cp(sb[0][3]), Pf = cp(sf[0][3]);
    // 남는 소매산 = 원래 곡선의 [Pb, Pf] 구간(같은 cubic 을 De Casteljau 로 자른 조각 + 나머지 원래 cubic 그대로)
    var capCs = [sb[1]].concat(backCs.slice(hb[0].i + 1), frontCs.slice(0, hf[0].i), [sf[0]]);
    var exB = backCs.slice(0, hb[0].i).concat([sb[0]]), exF = [sf[1]].concat(frontCs.slice(hf[0].i + 1));
    var excluded = { back: cubicsLen(exB), front: cubicsLen(exF) };
    var outline = [pathOf(capCs, "cap"), L(Pf, Pb, "hem")];
    var loop = flattenCubics(capCs, FLAT_N); loop.push(cp(Pb));
    var closeGap = dist(loop[0], Pb);
    if (!(closeGap < JOIN)) return fail("discontinuous", closeGap);
    if (loopSelfIntersects(loop)) return fail("self-intersection");
    var construction = [L(SP, { x: X0, y: yh }, "center-line")];
    var nBack = backCs.length - hb[0].i, capBack = cubicsLen(capCs.slice(0, nBack)), capTotal = cubicsLen(capCs), capFront = capTotal - capBack;
    var flatArc = function (cs) { var o = []; cs.forEach(function (q, i) { for (var j = (i ? 1 : 0); j <= 24; j++) o.push(cubicAt(q, j / 24)); }); return o; };
    var originalUpper = flatArc(cubs).map(cp);   // 출발 Ⓐ 윗부분(소매산 + 위팔선) — 원래 종이(표시용)
    var cutAway = flatArc(exB).concat([cp(Pf)], flatArc(exF)).map(cp);   // 잘라내는 아래 영역(위팔선 위 · 새 소맷부리 아래)
    var am = sleeveA.meta, ah = (r.armholeCm && fin(r.armholeCm.back) && fin(r.armholeCm.front)) ? r.armholeCm : null;
    return {
      ok: true,
      geometry: { outline: outline, construction: construction, capSplit: { x: X0 } },
      meta: {
        rule: "pattern-school-p48-cap-sleeve-Q(2026-10-26)",
        widthCm: r.W, sleeveLengthCm: yh - SP.y,   // 소매 좌표 y(SP = 0) — 소맷부리 높이 = 중심 길이 H(1 − r)
        settings: { heightRatio: ratio, defaults: { heightRatio: RATIO_DEFAULT }, range: { min: RATIO_MIN, max: RATIO_MAX, inclusive: true },
          note: "김님 확정 2026-10-26 — 소매산 높이 비율(기본 1/4, 1/4 ~ 3/4 · 연속 중간값). 위팔선에서 위로 H × r" },
        capHeightCm: H, bicepY: bicepY, hemY: yh, hemPoints: { back: Pb, front: Pf },
        hem: { lengthCm: dist(Pb, Pf), straight: true, horizontal: Math.abs(Pb.y - Pf.y) < 1e-9, note: "책 «직선 쪽이 편하다» — 직선 소맷부리" },
        excludedArcCm: excluded, excludedNote: "소매에서 빠지는 호(Ⓐ 아랫점 → 교점): 뒤 ● · 앞 ∅",
        centerLength: { inputCm: null, spreadCm: yh - SP.y, formulaCm: H * (1 - ratio), note: "SP → 수평 소맷부리 = H × (1 − r) · 출발 Ⓐ 기장과 무관" },
        capLengths: { back: capBack, front: capFront, total: capTotal, measure: "Gauss-Legendre(final curve) · 앞/뒤 분할 = SP(중심선)" },
        capLengthsA: am.capLengths ? JSON.parse(JSON.stringify(am.capLengths)) : null,
        armholeCm: ah ? { back: ah.back, front: ah.front } : null,
        sewnArmholeCm: ah ? { back: ah.back - excluded.back, front: ah.front - excluded.front } : null,
        easeAfter: ah ? { back: capBack - (ah.back - excluded.back), front: capFront - (ah.front - excluded.front), total: capTotal - (ah.back - excluded.back) - (ah.front - excluded.front) } : null,
        easeBasis: "구간 이세 = 남은 소매산 − 남은 AH(AH − 빠진 호) · 앞뒤 각각 — 전체 AH 와 다름",
        rigid: { originalUpper: originalUpper, cutAway: cutAway, note: "출발 Ⓐ 윗부분(원래 종이) · 잘라내는 아래 영역 — 표시용(위팔선 아래 Ⓐ 는 그리지 않음)" },
        sp: cp(SP), capSplit: { point: cp(SP) },
        underarm: { before: { back: cp(Ub), front: cp(Uf) }, after: { back: cp(Pb), front: cp(Pf) } },
        symbolCenterLoops: "책 중심선 점선 고리 기호 — 의미 미확정(형상 계산에 쓰지 않음)",
        checks: { closed: true, connected: true, maxGapCm: closeGap, selfIntersection: false, singlePiece: true, piecesOverlap: false, intersectionsUnique: true }
      },
      warnings: [],
      // 출처 hash = 소매산·SP·AH 만(출발 Ⓐ 기장·밑단은 넣지 않는다 — 결과와 무관)
      sourceSleeveAHash: hashStr(JSON.stringify({ cap: sleeveA.geometry.outline[0], sp: am.sp, armholeCm: am.armholeCm || null, capLengths: am.capLengths || null }))
    };
  }

  window.designSleeveQ = Object.freeze({ draftSleeveQ: draftSleeveQ, readSleeveA: readSleeveA, bodiceAttachEnds: bodiceAttachEnds,
    RULES: Object.freeze({ heightRatioDefault: RATIO_DEFAULT, heightRatioMin: RATIO_MIN, heightRatioMax: RATIO_MAX }) });
})();
