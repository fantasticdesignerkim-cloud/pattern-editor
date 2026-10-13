// ══════════════════════════════════════════════
// designSleeveJ.js — 소매 Ⓙ 퍼프([패턴학교] P.45 «소매 중심선에서 평행으로 잘라서 벌린다»). 순수.
// 김님 확정(2026-10-12, docs/book/P045.md): 출발 Ⓐ 중심선을 잘라 두 반쪽을 좌우 ∅/2 씩 평행 이동(회전 없음). O·SP 는 둘로 갈라지고 틈 가운데(원래 중심선)가 기준.
//   ● = 손바닥 + 3(손바닥 기본 21) · ■ = Ⓐ 소맷부리 − ● · ∅ = 0.7● − ■(개더 계수 0.7 = 책 설정). 새 소매산 꼭대기 = 원래 높이 + 상승(기본 0.7 — 설정값, 개더 계수와 별개).
//   틈 위 소매산은 필요한 최소 국소 재제도로 양쪽 소매산과 잇는다(전체 곡선 재설계 금지). 소맷부리는 평행 벌림 후 직선(책 공정 — 곡선화 안 함).
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var PALM_DEFAULT = 21, CUFF_ADD = 3, CUFF_WIDTH = 1, GATHER_RATIO = 0.7, RISE_DEFAULT = 0.7;
  var ELL_MIN = 0.5, ELL_STEP = 0.25, ELL_MAX_RATIO = 0.6;   // 재제도 구간: 0(틈 위만) → 0.5 → 0.25 씩, 가장 작은 것부터(잠정 — 책 수치 아님), 반호의 60% 까지
  var JOIN = 1e-9, TOL = 1e-6;
  var FOLD_TOL = 1e-7;               // 접은 상태 ↔ Ⓐ 일치 허용(cm)
  var G1_TOL_DEG = 1e-6;
  var KAPPA_DEAD = 0.001;            // 소맷부리 변곡 판정 불감대(/cm) — 꺾임이 작아 곡률도 작다(Ⓔ 0.01 보다 엄격)
  var FLAT_N = 24;
  var GX = [-0.9894009349916499, -0.9445750230732326, -0.8656312023878318, -0.7554044083550030, -0.6178762444026438, -0.4580167776572274, -0.2816035507792589, -0.0950125098376374,
    0.0950125098376374, 0.2816035507792589, 0.4580167776572274, 0.6178762444026438, 0.7554044083550030, 0.8656312023878318, 0.9445750230732326, 0.9894009349916499];
  var GW = [0.0271524594117541, 0.0622535239386479, 0.0951585116824928, 0.1246289712555339, 0.1495959888165767, 0.1691565193950025, 0.1826034150449236, 0.1894506104550685,
    0.1894506104550685, 0.1826034150449236, 0.1691565193950025, 0.1495959888165767, 0.1246289712555339, 0.0951585116824928, 0.0622535239386479, 0.0271524594117541];

  function cp(p) { return { x: p.x, y: p.y }; }
  function fin(v) { return typeof v === "number" && isFinite(v); }
  function finPt(p) { return !!p && fin(p.x) && fin(p.y); }
  function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
  function dist(a, b) { var dx = b.x - a.x, dy = b.y - a.y; return Math.sqrt(dx * dx + dy * dy); }
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
  function cubicLen(q) {   // Gauss-Legendre 16점
    var s = 0;
    for (var i = 0; i < 16; i++) { var d = cubicD1(q, (GX[i] + 1) / 2); s += GW[i] * Math.sqrt(d.x * d.x + d.y * d.y); }
    return s / 2;
  }
  function kappa(q, t) {
    var d = cubicD1(q, t), u = 1 - t, dd = { x: 6 * u * (q[2].x - 2 * q[1].x + q[0].x) + 6 * t * (q[3].x - 2 * q[2].x + q[1].x), y: 6 * u * (q[2].y - 2 * q[1].y + q[0].y) + 6 * t * (q[3].y - 2 * q[2].y + q[1].y) };
    var l = Math.sqrt(d.x * d.x + d.y * d.y); return l > 1e-15 ? (d.x * dd.y - d.y * dd.x) / (l * l * l) : 0;
  }
  function inflectionCount(ks) {   // 부호 바뀜 수(불감대 KAPPA_DEAD)
    var sg = ks.map(function (k) { return k > KAPPA_DEAD ? 1 : (k < -KAPPA_DEAD ? -1 : 0); }).filter(function (v) { return v; }), n = 0;
    for (var i = 1; i < sg.length; i++) if (sg[i] !== sg[i - 1]) n++;
    return n;
  }
  function unit(a) { var l = Math.sqrt(a.x * a.x + a.y * a.y); return l > 1e-15 ? { x: a.x / l, y: a.y / l } : null; }
  function hermite(A, Ta, B, Tb) { var h = dist(A, B) / 3; return [cp(A), { x: A.x + Ta.x * h, y: A.y + Ta.y * h }, { x: B.x - Tb.x * h, y: B.y - Tb.y * h }, cp(B)]; }
  // 이어진 점열을 지나는 G1 Hermite 사슬: 내부 접선 = 이웃 두 점 방향, 양 끝 접선 = 이웃 접선을 현에 대해 거울(한 방향으로 휨). Ⓔ 와 같은 규칙.
  function throughCurve(pts) {
    var n = pts.length, T = [];
    for (var i = 1; i < n - 1; i++) T[i] = unit(sub(pts[i + 1], pts[i - 1]));
    var mirror = function (A, B, t) { var c = unit(sub(B, A)), d = Math.atan2(t.y, t.x) - Math.atan2(c.y, c.x), ca = Math.cos(-d), sa = Math.sin(-d); return { x: c.x * ca - c.y * sa, y: c.x * sa + c.y * ca }; };
    T[0] = mirror(pts[0], pts[1], T[1]);
    var tl = mirror(pts[n - 1], pts[n - 2], { x: -T[n - 2].x, y: -T[n - 2].y }); T[n - 1] = { x: -tl.x, y: -tl.y };
    var cs = [];
    for (var j = 0; j < n - 1; j++) cs.push(hermite(pts[j], T[j], pts[j + 1], T[j + 1]));
    return cs;
  }
  function cubicsLen(cs) { var s = 0; cs.forEach(function (q) { s += cubicLen(q); }); return s; }
  function splitAt(q, t) {   // De Casteljau → [왼쪽, 오른쪽]
    var l = function (a, b) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; };
    var p01 = l(q[0], q[1]), p12 = l(q[1], q[2]), p23 = l(q[2], q[3]), a = l(p01, p12), b = l(p12, p23), m = l(a, b);
    return [[cp(q[0]), p01, a, m], [cp(m), b, p23, cp(q[3])]];
  }
  // 이어진 cubic 목록을 부호 함수 f(점) 가 0 이 되는 곳(단조 교차 1회)에서 둘로.
  function splitListBy(cs, f) {
    for (var i = 0; i < cs.length; i++) {
      var q = cs[i], f0 = f(q[0]), f3 = f(q[3]);
      if (f0 === 0 && i > 0) return [cs.slice(0, i), cs.slice(i)];
      if (f0 * f3 <= 0 && f3 !== 0) {
        var lo = 0, hi = 1, neg0 = f0 < 0;
        for (var k = 0; k < 90; k++) { var m = (lo + hi) / 2; if ((f(cubicAt(q, m)) < 0) === neg0) lo = m; else hi = m; }
        var t = (lo + hi) / 2;
        if (t < 1e-12) return [cs.slice(0, i), cs.slice(i)];
        if (t > 1 - 1e-12) return [cs.slice(0, i + 1), cs.slice(i + 1)];
        var p = splitAt(q, t); return [cs.slice(0, i).concat([p[0]]), [p[1]].concat(cs.slice(i + 1))];
      }
      if (f3 === 0) return [cs.slice(0, i + 1), cs.slice(i + 1)];
    }
    return null;
  }
  function splitListAtX(cs, x) { return splitListBy(cs, function (p) { return p.x - x; }); }
  // 강체 변환 {c, s, tx, ty}: p → R·p + t
  var ID = { c: 1, s: 0, tx: 0, ty: 0 };
  function app(T, p) { return { x: T.c * p.x - T.s * p.y + T.tx, y: T.s * p.x + T.c * p.y + T.ty }; }
  function rotAbout(c, a) { var ca = Math.cos(a), sa = Math.sin(a); return { c: ca, s: sa, tx: c.x - ca * c.x + sa * c.y, ty: c.y - sa * c.x - ca * c.y }; }
  function compose(A, B) { return { c: A.c * B.c - A.s * B.s, s: A.s * B.c + A.c * B.s, tx: A.c * B.tx - A.s * B.ty + A.tx, ty: A.s * B.tx + A.c * B.ty + A.ty }; }   // A∘B
  function inverse(T) { return { c: T.c, s: -T.s, tx: -(T.c * T.tx + T.s * T.ty), ty: -(-T.s * T.tx + T.c * T.ty) }; }
  function mapList(cs, f) { return cs.map(function (q) { return q.map(f); }); }
  function revList(cs) { return cs.slice().reverse().map(function (q) { return [cp(q[3]), cp(q[2]), cp(q[1]), cp(q[0])]; }); }
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
  function cubicsOfPath(p) { var o = [], cur = p.commands[0].points[0]; p.commands.slice(1).forEach(function (c) { o.push([cp(cur), cp(c.points[0]), cp(c.points[1]), cp(c.points[2])]); cur = c.points[2]; }); return o; }
  function flattenCubics(cs, n) { var out = []; cs.forEach(function (q, ci) { for (var i = (ci === 0 ? 0 : 1); i <= n; i++) out.push(cubicAt(q, i / n)); }); return out; }
  function maxDevList(a, b) {   // 같은 매개화의 두 cubic 목록 표본 최대 거리
    if (a.length !== b.length) return Infinity;
    var m = 0; for (var i = 0; i < a.length; i++) for (var k = 0; k <= 8; k++) m = Math.max(m, dist(cubicAt(a[i], k / 8), cubicAt(b[i], k / 8)));
    return m;
  }

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

  function rotAt(c, a) { return rotAbout(c, a); }

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


  function hermite2(A, Ta, B, Tb) { var h = dist(A, B) / 3; return [cp(A), { x: A.x + Ta.x * h, y: A.y + Ta.y * h }, { x: B.x - Tb.x * h, y: B.y - Tb.y * h }, cp(B)]; }
  function splitListAtLen2(cs, s) {
    var acc = 0;
    for (var i = 0; i < cs.length; i++) { var l = cubicLen(cs[i]);
      if (acc + l >= s - 1e-12) { var lo = 0, hi = 1; for (var k = 0; k < 64; k++) { var m = (lo + hi) / 2; if (cubicLen(splitAt(cs[i], m)[0]) < s - acc) lo = m; else hi = m; }
        var t = (lo + hi) / 2; if (t < 1e-12) return [cs.slice(0, i), cs.slice(i)]; if (t > 1 - 1e-12) return [cs.slice(0, i + 1), cs.slice(i + 1)];
        var p = splitAt(cs[i], t); return [cs.slice(0, i).concat([p[0]]), [p[1]].concat(cs.slice(i + 1))]; }
      acc += l; }
    return [cs.slice(), []];
  }
  function draftSleeveJ(sleeveA, params) {
    var p = params || {};
    var palm = p.palmCircumferenceCm === undefined || p.palmCircumferenceCm === null ? PALM_DEFAULT : p.palmCircumferenceCm;
    var rise = p.riseCm === undefined || p.riseCm === null ? RISE_DEFAULT : p.riseCm;
    if (!fin(palm) || !(palm > 0)) return fail("invalid-palm", palm);
    if (!fin(rise) || rise < 0) return fail("invalid-rise", rise);
    var r = readSleeveA(sleeveA); if (!r.ok) return r;
    var cubs = r.cubics, Ub = r.Ub, Uf = r.Uf, H = r.hemY, W = r.W, SP = cp(r.sp), X0 = SP.x;
    var cuff = palm + CUFF_ADD, square = W - cuff, spread = GATHER_RATIO * cuff - square, half = spread / 2;
    if (!(spread > 0)) return fail("no-spread", { cuff: cuff, hemA: W, spread: spread }, true);
    var back = cubs.slice(0, r.spIndex + 1), front = cubs.slice(r.spIndex + 1);
    var mv = function (cs, dx) { return cs.map(function (q) { return q.map(function (pt) { return { x: pt.x + dx, y: pt.y }; }); }); };
    var B = mv(back, -half), F = mv(front, +half), top = { x: X0, y: SP.y - rise };
    var LB = cubicsLen(B), LF = cubicsLen(F), best = null;
    // 가장 작은 재제도 구간(앞뒤 같은 ℓ)부터 — 변곡 없음 · 꼭대기 위로 넘지 않음
    for (var ell = 0; ell <= Math.min(LB, LF) * ELL_MAX_RATIO + 1e-9 && !best; ell = ell === 0 ? ELL_MIN : ell + ELL_STEP) {   // ℓ = 0: 틈 위만 잇기(상승 0 이면 수평 직선 다리)
      var sb = splitListAtLen2(B, LB - ell), sf = splitListAtLen2(F, ell); if (!sb[0].length || !sf[1].length) continue;
      var qa = sb[0][sb[0].length - 1], qb = sf[1][0], Ta = unit(cubicD1(qa, 1)), Tb = unit(cubicD1(qb, 0));
      var h1 = hermite2(qa[3], Ta, top, { x: 1, y: 0 }), h2 = hermite2(top, { x: 1, y: 0 }, qb[0], Tb);
      var ks = []; [h1, h2].forEach(function (q) { for (var i = 0; i <= 120; i++) ks.push(kappa(q, i / 120)); });
      var ok2 = inflectionCount(ks) === 0, ymin = Infinity; [h1, h2].forEach(function (q) { for (var i = 0; i <= 60; i++) ymin = Math.min(ymin, cubicAt(q, i / 60).y); });
      if (ok2 && ymin >= top.y - 1e-9) best = { ell: ell, cap: sb[0].concat([h1, h2], sf[1]), replaced: [sb[1], sf[0]], h: [h1, h2] };
    }
    if (!best) return fail("redraw-inflection-unavoidable", null, true);
    var cap = best.cap; for (var j = 1; j < cap.length; j++) cap[j][0] = cp(cap[j - 1][3]);
    var Ubm = { x: Ub.x - half, y: Ub.y }, Ufm = { x: Uf.x + half, y: Uf.y }, B0 = { x: Ub.x - half, y: H }, F0 = { x: Uf.x + half, y: H };
    var outline = [pathOf(cap, "cap"), L(Ufm, F0, "side-seam-front"), L(F0, B0, "hem"), L(B0, Ubm, "side-seam-back")];
    var loop = flattenCubics(cap, FLAT_N); loop.push(cp(F0), cp(B0), cp(Ubm));
    if (loopSelfIntersects(loop)) return fail("self-intersection", null, true);
    var iTop = sbIndex(cap, best.h[0]);
    var capBack = cubicsLen(cap.slice(0, iTop + 1)), capFront = cubicsLen(cap.slice(iTop + 1)), capTotal = capBack + capFront;
    var capA = { back: cubicsLen(back), front: cubicsLen(front) }; capA.total = capA.back + capA.front;
    var ahc = r.armholeCm, ah = (ahc && fin(ahc.back) && fin(ahc.front)) ? ahc : null;
    var flat = function (cs) { var o = []; cs.forEach(function (q, i) { for (var k = (i ? 1 : 0); k <= 24; k++) o.push(cubicAt(q, k / 24)); }); return o; };
    var pieces = { back: flat(B).concat([{ x: X0 - half, y: H }, B0]).map(cp), front: flat(F).concat([F0, { x: X0 + half, y: H }]).map(cp) };
    var gap = [{ x: X0 - half, y: SP.y }, { x: X0 + half, y: SP.y }, { x: X0 + half, y: H }, { x: X0 - half, y: H }];
    var rev = function (pts) { return pts.slice().reverse(); };
    var fillPts = flat(best.h).concat(rev(flat(best.replaced[1])), [{ x: X0 + half, y: H }, { x: X0 - half, y: H }], rev(flat(best.replaced[0]))).map(cp);
    var construction = [L(top, { x: X0, y: H }, "center-line"), L(gap[0], gap[3], "cut-edge-back"), L(gap[1], gap[2], "cut-edge-front")];
    var hemCm = W + spread, am = sleeveA.meta;
    return {
      // capSplit: 소매산 앞/뒤 계측 분할 기준 = 소매 중심선(틈 이등분선) x — 공용 측정(designSleeve.capPrimitives)이 이 세로선과 최종 소매산의 교점에서 나눈다(상승 0 에서도 정확).
      ok: true, geometry: { outline: outline, construction: construction, capSplit: { x: X0 } },
      meta: {
        rule: "pattern-school-p45-puff-sleeve-J(2026-10-12)", widthCm: W, widthAfterCm: W + spread, sleeveLengthCm: r.sleeveLengthCm,
        cuff: { palmCm: palm, lengthCm: cuff, widthCm: CUFF_WIDTH, rule: "손바닥 둘레 + 3 · 폭 1cm — 치수 정보(별도 조각 아님)" },
        formula: { square: square, spread: spread, gatherRatio: GATHER_RATIO, note: "■ = Ⓐ 소맷부리 − ● · ∅ = 0.7● − ■ = 1.7● − W(개더 계수 0.7 = 책 설정) — 책 «9 정도»는 예시" },
        rise: { cm: rise, top: cp(top), spBefore: cp(SP), note: "새 소매산 꼭대기 = 원래 높이 + 상승(설정값 — 개더 계수 0.7 과 별개)" },
        reference: { fixed: "틈 가운데(원래 중심선 x)", notFixed: "O·SP — 중심선 절개로 두 조각으로 갈라짐" },
        fill: { pts: fillPts, note: "틈 + 소매산 정리로 덧댄 종이(표시용)" },
        originalCap: { back: flat(best.replaced[0]).map(cp), front: flat(best.replaced[1]).map(cp), note: "재제도로 대체된 원래(평행 이동한) 소매산 구간" },
        redraw: { ellCm: best.ell, rule: "가장 작은 구간부터(0 → 0.5 · 0.25 씩, 잠정) — 변곡 없음 · 꼭대기 위로 안 넘음 · 양 끝 G1 · 꼭대기 수평", from: cp(best.h[0][0]), to: cp(best.h[1][3]) },
        hem: { lengthCm: hemCm, straight: true, gatherCm: hemCm - cuff, gatherRatio: (hemCm - cuff) / cuff, formulaHemCm: 1.7 * cuff },
        capLengths: { back: capBack, front: capFront, total: capTotal }, capLengthsA: capA,
        armholeCm: ah ? { back: ah.back, front: ah.front } : null,
        easeA: ah ? { back: capA.back - ah.back, front: capA.front - ah.front, total: capA.total - ah.back - ah.front } : null,
        addedGather: { back: capBack - capA.back, front: capFront - capA.front, total: capTotal - capA.total },
        totalOverAH: ah ? { back: capBack - ah.back, front: capFront - ah.front, total: capTotal - ah.back - ah.front } : null,
        easeAfter: ah ? { back: capBack - ah.back, front: capFront - ah.front, total: capTotal - ah.back - ah.front } : null,
        sp: cp(top), capSplit: { point: cp(top) }, centerLength: { inputCm: r.sleeveLengthCm, spreadCm: H - top.y },
        underarm: { before: { back: cp(Ub), front: cp(Uf) }, after: { back: cp(Ubm), front: cp(Ufm) } },
        rigid: { pieces: pieces, gap: gap, note: "평행 이동 원래 종이 2조각(감사·표시용)" },
        checks: { closed: true, selfIntersection: false, singlePiece: true }, easeSourceA: am.easeAfter ? JSON.parse(JSON.stringify(am.easeAfter)) : null
      },
      warnings: [], sourceSleeveAHash: hashStr(JSON.stringify({ geometry: sleeveA.geometry, meta: sleeveA.meta }))
    };
  }
  function sbIndex(cap, h) { for (var i = 0; i < cap.length; i++) if (cap[i] === h) return i; return -1; }
  window.designSleeveJ = Object.freeze({ draftSleeveJ: draftSleeveJ, readSleeveA: readSleeveA,
    RULES: Object.freeze({ palmDefaultCm: PALM_DEFAULT, cuffAddCm: CUFF_ADD, cuffWidthCm: CUFF_WIDTH, gatherRatio: GATHER_RATIO, riseDefaultCm: RISE_DEFAULT, ellMinCm: ELL_MIN }) });
})();
