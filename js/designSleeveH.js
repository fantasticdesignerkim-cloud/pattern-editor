// ══════════════════════════════════════════════
// designSleeveH.js — 소매 Ⓗ 퍼프 슬리브([패턴학교] P.44 «EL 아래로 절개선을 넣고, 소맷부리만 잘라서 벌린다»). 순수.
//
// 김님 확정(2026-10-11, docs/book/P044.md § 김님 확정):
//   · 출발 = 완성 소매 Ⓐ(읽기 전용). EL(SP 에서 팔꿈치 길이, 기본 31.4 — 수정 가능) **위는 고정**(소매산·O·SP·위팔·이세 = Ⓐ).
//   · EL 에서 앞·뒤 반폭을 각각 2등분 → 절개 a(소매 중심선) · b(앞·뒤 반폭 중점), 소맷부리 → EL. EL 선은 ☆(EL × 옆선) 직전까지 자른다.
//   · 순서: ① 가운데 두 조각을 ★ 만큼 아래로(기본 3.5, 수정 가능 — 공식 아님) → ② a: 두 조각을 중심선 위 기준점 C″(= EL 중심점 + ★)에서 좌우 대칭으로 돌려
//     소맷부리에서 ∅/3 → ③ b: 바깥 두 조각을 ☆ 에서 돌려 소맷부리에서 ∅/3(바깥으로 벌어지는 해).
//   · 커프스 달림 ● = 손바닥 둘레(기본 21) + 3 · ■ = Ⓐ 소맷부리 − ● · ∅ = ● × 1 − ■(책 식) · 커프스 폭 1cm(치수 정보만 — 별도 조각은 질문 후).
//   · 소맷부리 = 8 끝점을 지나는 자연 곡선(Ⓔ 와 같은 끝점 통과 Hermite). 최종 호 길이·개더량은 실측(산식 «2●»와의 차 기록).
//   · 벌어진 틈(가운데 위 ★ 틈·쐐기)은 종이 덧댐(meta.fill) — 외곽선 아님. raw 강체는 meta.rigid.
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var EL_DEFAULT = 31.4, PALM_DEFAULT = 21, CUFF_ADD = 3, CUFF_WIDTH = 1, DROP_DEFAULT = 3.5, CUTS = 3;
  var BETA_MAX = Math.PI / 3;
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

  function draftSleeveH(sleeveA, params) {
    var p = params || {};
    var EL = p.elbowLengthCm !== undefined && p.elbowLengthCm !== null ? p.elbowLengthCm : EL_DEFAULT;
    var palm = p.palmCircumferenceCm !== undefined && p.palmCircumferenceCm !== null ? p.palmCircumferenceCm : PALM_DEFAULT;
    var drop = p.dropCm !== undefined && p.dropCm !== null ? p.dropCm : DROP_DEFAULT;
    if (!fin(EL) || !(EL > 0)) return fail("invalid-elbow-length", EL);
    if (!fin(palm) || !(palm > 0)) return fail("invalid-palm", palm);
    if (!fin(drop) || !(drop > 0)) return fail("invalid-drop", drop);
    var r = readSleeveA(sleeveA);
    if (!r.ok) return r;
    var cubs = r.cubics, Ub = r.Ub, Uf = r.Uf, H = r.hemY, SP = cp(r.sp), X0 = SP.x, W = r.W, XL = Ub.x, XR = Uf.x;
    var Yel = SP.y + EL;
    if (!(Yel > Math.max(Ub.y, Uf.y) + TOL && Yel < H - TOL)) return fail("el-out-of-range", { el: EL, underarm: Ub.y - SP.y, hem: H - SP.y }, true);
    var cuff = palm + CUFF_ADD, sq = W - cuff, spread = cuff - sq, per = spread / CUTS;   // ● · ■ · ∅ (책 식)
    if (!(spread > 0)) return fail("no-spread", { cuff: cuff, hemA: W, spread: spread }, true);
    var xb = (XL + X0) / 2, xf = (X0 + XR) / 2;
    var Cel = { x: X0, y: Yel }, Cdd = { x: X0, y: Yel + drop };
    // 조각(Ⓐ 좌표, 직사각형): 뒤 바깥 [XL,xb] · 뒤 안 [xb,X0] · 앞 안 [X0,xf] · 앞 바깥 [xf,XR], y ∈ [Yel, H]
    var rect = function (x0, x1) { return [{ x: x0, y: Yel }, { x: x1, y: Yel }, { x: x1, y: H }, { x: x0, y: H }]; };
    var Td = { c: 1, s: 0, tx: 0, ty: drop };
    var R = H - Yel;                                   // C″ → 가운데 소맷부리 모서리(내린 뒤에도 같은 거리)
    if (!(per / 2 < R)) return fail("spread-too-large", per, true);
    var gam = Math.asin((per / 2) / R);
    // y 아래 좌표: 기준점 아래 점을 −x 로 보내려면 양의 각(뒤), +x 는 음의 각(앞)
    var Tin = { back: compose(rotAt(Cdd, +gam), Td), front: compose(rotAt(Cdd, -gam), Td) };
    var Sst = { back: { x: XL, y: Yel }, front: { x: XR, y: Yel } };
    var sides = {};
    var SD = [{ id: "back", s: -1, xo: XL, xm: xb }, { id: "front", s: +1, xo: XR, xm: xf }];
    for (var k = 0; k < 2; k++) {
      var sd = SD[k], s = sd.s, Ti = Tin[sd.id], S = Sst[sd.id];
      var inMid = app(Ti, { x: sd.xm, y: H }), inTopMid = app(Ti, { x: sd.xm, y: Yel });
      var chord = function (b) { var q = app(rotAt(S, b), { x: sd.xm, y: H }); return { d: dist(q, inMid), out: (q.x - inMid.x) * s }; };
      var dirSign = s < 0 ? 1 : -1;   // 아래(소맷부리)가 바깥으로
      var beta = null, N = 1200, prev = chord(0);
      for (var j = 1; j <= N && beta === null; j++) {
        var b1 = dirSign * BETA_MAX * j / N, c1 = chord(b1);
        if ((prev.d - per) * (c1.d - per) <= 0 && c1.out > 0) {
          var lo = dirSign * BETA_MAX * (j - 1) / N, hi = b1;
          for (var it = 0; it < 100; it++) { var mb = (lo + hi) / 2; if ((chord(lo).d - per) * (chord(mb).d - per) <= 0) hi = mb; else lo = mb; }
          var bb = (lo + hi) / 2; if (chord(bb).out > 0) beta = bb;
        }
        prev = c1;
      }
      if (beta === null) return fail("spread-incompatible", { side: sd.id, perCut: per, drop: drop }, true);
      var To = rotAt(S, beta);
      var oCorner = app(To, { x: sd.xo, y: H }), oMid = app(To, { x: sd.xm, y: H }), oTopMid = app(To, { x: sd.xm, y: Yel });
      // 물리 검사: 안쪽 조각 위변이 EL 위로 올라가 위 몸통과 겹치지 않음 · 안쪽/바깥 b 변 교차 없음 · 바깥 위변이 EL 위로 올라가지 않음
      var inTop0 = app(Ti, { x: X0, y: Yel }), inTopRise = Math.min(inTopMid.y, inTop0.y);
      if (!(inTopRise > Yel + 1e-9)) return fail("pieces-overlap", { side: sd.id, where: "inner-top-above-EL", y: inTopRise - Yel }, true);
      if (!(oTopMid.y >= Yel - 1e-9)) return fail("pieces-overlap", { side: sd.id, where: "outer-top-above-EL" }, true);
      if (segCross(inTopMid, inMid, oTopMid, oMid)) return fail("pieces-overlap", { side: sd.id, where: "b-edges-cross" }, true);
      sides[sd.id] = { s: s, beta: beta, To: To, Ti: Ti, S: S, oCorner: oCorner, oMid: oMid, oTopMid: oTopMid, inMid: inMid, inTopMid: inTopMid, inCenter: app(Ti, { x: X0, y: H }), inTop0: inTop0, xo: sd.xo, xm: sd.xm };
    }
    var bk = sides.back, fr = sides.front;
    if (!(bk.inCenter.x < fr.inCenter.x)) return fail("spread-direction");
    // 소맷부리: 8 끝점(앞 바깥 → … → 뒤 바깥) 통과 자연 곡선
    var hemPts = [fr.oCorner, fr.oMid, fr.inMid, fr.inCenter, bk.inCenter, bk.inMid, bk.oMid, bk.oCorner];
    // 소맷부리 마무리(김님 2026-10-12 «조금 파먹어도 괜찮으니 전체적인 라인의 곡선을 유지하면서 예쁜 곡선» — 이전 «8 끝점 통과·S 허용» 시안 조건을 대체):
    //   양 끝(옆선 아래끝) 고정, 안쪽 조각 모서리는 조금 파이거나 덧대도 되게, 변곡 없이 곡률이 이어지는(C2) 곡선으로 truing.
    //   방법(후보 비교 후 선택 — P044): 3차 B-spline 의 제어점 x = 끝점 x, 제어점 y 를 «원래 모서리를 지나도록» 반복 보정하되 매번 제어 다각형을 오목으로 투영
    //   → 제어 다각형이 오목이면 곡선도 변곡 없음(변동 감소 성질), B-spline 이라 이음 곡률 연속. 정확한 Bézier 로 바꿔 외곽에 넣는다.
    var prev8 = throughCurve(hemPts), prev8Cm = cubicsLen(prev8);
    var fairR = fairHem(hemPts);
    var hemCs = fairR.bz;
    var hemG1 = 0, kJump = 0; for (var hg = 1; hg < hemCs.length; hg++) { hemG1 = Math.max(hemG1, angleBetween(cubicD1(hemCs[hg - 1], 1), cubicD1(hemCs[hg], 0))); kJump = Math.max(kJump, Math.abs(kappa(hemCs[hg - 1], 1) - kappa(hemCs[hg], 0))); }
    if (!(hemG1 <= G1_TOL_DEG)) return fail("hem-g1-break", hemG1);
    var hk = []; hemCs.forEach(function (q) { for (var i3 = 0; i3 <= 120; i3++) hk.push(kappa(q, i3 / 120)); });
    var hemInfl = inflectionCount(hk), kMin = Math.min.apply(null, hk), kMax = Math.max.apply(null, hk);
    if (hemInfl > 0) return fail("hem-fair-inflection", hemInfl, true);
    var hemCm = cubicsLen(hemCs);
    // 원래 모서리 대비: 곡선 y − 모서리 y(y 아래 좌표) < 0 → 모서리를 파냄, > 0 → 바깥으로 덧댐. 면적은 원래 밑단(끝점 꺾은선)과 곡선 사이.
    var corner = hemPts.slice(1, -1).map(function (q) { return { at: cp(q), dyCm: yAtX(hemCs, q.x) - q.y }; });
    var maxCut = Math.max(0, -Math.min.apply(null, corner.map(function (c) { return c.dyCm; }))), maxOut = Math.max(0, Math.max.apply(null, corner.map(function (c) { return c.dyCm; })));
    // 면적은 원래 종이 조각의 아래변(원래 밑단: 0–1 · 2–3 · 4–5 · 6–7)과 곡선 사이만 — 틈(1–2 · 3–4 · 5–6)은 원래 덧댄 종이라 따로 세지 않는다.
    var areaCut = 0, areaAdd = 0, NA = 200;
    [[0, 1], [2, 3], [4, 5], [6, 7]].forEach(function (e) {
      var a = hemPts[e[0]], b = hemPts[e[1]];
      for (var ia = 0; ia < NA; ia++) { var tt = (ia + 0.5) / NA, xm = a.x + (b.x - a.x) * tt, dyA = yAtX(hemCs, xm) - (a.y + (b.y - a.y) * tt), dxA = Math.abs(b.x - a.x) / NA;
        if (dyA < 0) areaCut += -dyA * dxA; else areaAdd += dyA * dxA; }
    });
    // 외곽: Ⓐ 소매산 · 앞 옆선(위팔 → ☆ 는 Ⓐ, ☆ → 소맷부리는 회전한 바깥 조각) · 소맷부리 곡선 · 뒤 옆선
    var outline = [pathOf(cubs.map(function (q) { return q.map(cp); }), "cap"), L(Uf, fr.S, "side-seam-front-upper"), L(fr.S, fr.oCorner, "side-seam-front-lower"),
      pathOf(hemCs, "hem"), L(bk.oCorner, bk.S, "side-seam-back-lower"), L(bk.S, Ub, "side-seam-back-upper")];
    var loop = flattenCubics(cubs, FLAT_N); loop.push(cp(fr.S)); flattenCubics(hemCs, FLAT_N).forEach(function (q) { loop.push(q); }); loop.push(cp(bk.S)); loop.push(cp(Ub));
    if (loopSelfIntersects(loop)) return fail("self-intersection", null, true);
    var kinkDeg = { back: Math.abs(bk.beta) * 180 / Math.PI, front: Math.abs(fr.beta) * 180 / Math.PI };
    var construction = [L(SP, { x: X0, y: (bk.inCenter.y + fr.inCenter.y) / 2 }, "center-line"), L(bk.S, fr.S, "el-line"), L(Cel, Cdd, "drop"),
      L(app(bk.Ti, { x: X0, y: Yel }), bk.inCenter, "cut-a-back"), L(app(fr.Ti, { x: X0, y: Yel }), fr.inCenter, "cut-a-front"),
      L(bk.inTopMid, bk.inMid, "cut-b-inner-back"), L(bk.oTopMid, bk.oMid, "cut-b-outer-back"), L(fr.inTopMid, fr.inMid, "cut-b-inner-front"), L(fr.oTopMid, fr.oMid, "cut-b-outer-front")];
    var rigidPiece = function (T, x0, x1) { return rect(x0, x1).map(function (q) { return app(T, q); }); };
    var centerHem = (function () { var lo = 0, hi = 1, q = null; for (var c = 0; c < hemCs.length; c++) { var qq = hemCs[c]; if ((qq[0].x - X0) * (qq[3].x - X0) <= 0) { q = qq; break; } }
      if (!q) return null; var inc = q[3].x > q[0].x; for (var it2 = 0; it2 < 90; it2++) { var m = (lo + hi) / 2; if ((cubicAt(q, m).x < X0) === inc) lo = m; else hi = m; } return cubicAt(q, (lo + hi) / 2); })();
    var am = sleeveA.meta;
    return {
      ok: true,
      geometry: { outline: outline, construction: construction },
      meta: {
        rule: "pattern-school-p44-puff-sleeve-H(2026-10-11)",
        widthCm: W, sleeveLengthCm: r.sleeveLengthCm, elbowLengthCm: EL, elY: Yel, sp: cp(SP),
        cuff: { palmCm: palm, lengthCm: cuff, widthCm: CUFF_WIDTH, rule: "손바닥 둘레 + 3(김님) · 폭 1cm — 치수 정보(별도 조각 아님)" },
        formula: { square: sq, spread: spread, perCut: per, hemTarget: W + spread, note: "■ = Ⓐ 소맷부리 − ● · ∅ = ● − ■ · 각 ∅/3 → 벌린 소맷부리(직선 합) = 2● (산식)" },
        drop: { cm: drop, from: cp(Cel), to: cp(Cdd), note: "가운데 두 조각을 ★ 만큼 아래로 — 설정값(공식 아님)" },
        rotationDeg: { inner: gam * 180 / Math.PI, outerBack: kinkDeg.back, outerFront: kinkDeg.front },
        openedCm: { a: dist(bk.inCenter, fr.inCenter), bBack: dist(bk.inMid, bk.oMid), bFront: dist(fr.inMid, fr.oMid) },
        sides: { back: { star: cp(bk.S), outerHem: cp(bk.oCorner), innerTopRiseCm: Yel + drop - Math.min(bk.inTopMid.y, bk.inTop0.y) },
                 front: { star: cp(fr.S), outerHem: cp(fr.oCorner), innerTopRiseCm: Yel + drop - Math.min(fr.inTopMid.y, fr.inTop0.y) } },
        hem: { points: hemPts.map(cp), lengthCm: hemCm, polylineCm: (function () { var t = 0; for (var i = 1; i < hemPts.length; i++) t += dist(hemPts[i - 1], hemPts[i]); return t; })(),
          gatherCm: hemCm - cuff, gatherRatio: (hemCm - cuff) / cuff, formulaHemCm: 2 * cuff, diffFromFormulaCm: hemCm - 2 * cuff, g1MaxDeg: hemG1,
          fair: { method: "오목 제어다각형 3차 B-spline(제어점 x = 끝점 x, 원래 모서리 쪽으로 반복 보정 + 오목 투영) — 양 끝 고정 · C2 · 변곡 없음",
            approvedBy: "김님 2026-10-12 «조금 파먹어도 괜찮으니 … 예쁜 곡선»(8 끝점 통과·S 허용 시안 조건 대체)",
            maxCutCm: maxCut, maxOutwardCm: maxOut, corners: corner, areaCutCm2: areaCut, areaAddedCm2: areaAdd, inflections: hemInfl,
            kappaMinPerCm: kMin, kappaMaxPerCm: kMax, curvatureJumpMax: kJump, g1MaxDeg: hemG1, controlPolygon: fairR.ctrl,
            previous8PointCm: prev8Cm, changeFromPreviousCm: hemCm - prev8Cm, previous8Point: pathOf(prev8),
            largeDeviationNote: Math.max(maxCut, maxOut) > 1 ? "파임/덧댐 1cm 초과 — 김님 2026-10-12 Ⓗ 검토 범위 승인(개더 여유 부분이라 실루엣에 안 나타남 · 일반 규칙 아님)" : null },
          method: "오목 B-spline truing(시안)", status: "화면 검토용 시안(최종 형상 승인 전)" },
        sideSeamKinkDeg: kinkDeg, seams: { backCm: dist(Ub, bk.S) + dist(bk.S, bk.oCorner), frontCm: dist(Uf, fr.S) + dist(fr.S, fr.oCorner) },
        centerLength: { inputCm: r.sleeveLengthCm, spreadCm: centerHem ? centerHem.y - SP.y : null, note: "입력 소매길이 vs 펼친 중심(SP → 소맷부리 곡선 × 중심선)" },
        fill: { centerGap: [cp(app(bk.Ti, { x: xb, y: Yel })), cp(bk.inTop0), cp(app(fr.Ti, { x: xf, y: Yel })), { x: xf, y: Yel }, { x: xb, y: Yel }], note: "가운데 내림 위 틈 + 쐐기 — 종이 덧댐" },
        rigid: { backOuter: rigidPiece(bk.To, XL, xb), backInner: rigidPiece(bk.Ti, xb, X0), frontInner: rigidPiece(fr.Ti, X0, xf), frontOuter: rigidPiece(fr.To, xf, XR), note: "강체 직사각형(감사용)" },
        capLengthsA: am.capLengths ? JSON.parse(JSON.stringify(am.capLengths)) : null, easeSourceA: am.easeAfter ? JSON.parse(JSON.stringify(am.easeAfter)) : null,
        armholeCm: r.armholeCm ? { back: r.armholeCm.back, front: r.armholeCm.front } : null,
        underarm: { before: { back: cp(Ub), front: cp(Uf) }, after: { back: cp(Ub), front: cp(Uf) } },
        provisional: { hemCurve: "끝점 통과 Hermite", spreadMeasure: "소맷부리 끝점 사이 현" },
        checks: { closed: true, connected: true, selfIntersection: false, singlePiece: true, maxG1BreakDeg: hemG1 }
      },
      warnings: [],
      sourceSleeveAHash: hashStr(JSON.stringify({ geometry: sleeveA.geometry, meta: sleeveA.meta }))
    };
  }

  window.designSleeveH = Object.freeze({ draftSleeveH: draftSleeveH, readSleeveA: readSleeveA,
    RULES: Object.freeze({ elbowDefaultCm: EL_DEFAULT, palmDefaultCm: PALM_DEFAULT, cuffAddCm: CUFF_ADD, cuffWidthCm: CUFF_WIDTH, dropDefaultCm: DROP_DEFAULT, cuts: CUTS }) });
})();
