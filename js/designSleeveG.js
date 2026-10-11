// ══════════════════════════════════════════════
// designSleeveG.js — 소매 Ⓖ 턱트 슬리브([패턴학교] P.43 «소매산 높이를 2등분해, 소매산만 절개선을 넣어 잘라서 벌린다»). 순수.
//
// 김님 확정(2026-10-10·11, docs/book/P043.md § Ⓖ 김님 확정 1·2):
//   · 출발 = 완성 소매 Ⓐ(읽기 전용). 소매산 높이 2등분 선(y = Ym) 위만 자른다 — 아래 몸통·소맷부리·옆선은 Ⓐ 그대로.
//   · 선: a = 소매산 ±1 → 중심점 C(0, Ym) · b = 소매산 ±3 → 2등분 선 ±2 (책 «2» 간격). ☆ = 2등분 선 × 소매산.
//   · 순서: 가운데 조각을 ★ 만큼 평행 상승(C → C′) → 안쪽 조각은 함께 오른 뒤 C′ 중심 회전(a 쐐기 현 = 턱) →
//     바깥 조각은 ☆ 중심 회전(b 쐐기 현 = 턱, 바깥으로 벌어지는 해 — 다른 해는 조각이 겹침).
//   · 턱 기본 1.5(책 본문 최대 2) · ★ 기본 3 — **둘 다 독립 입력**(공식 아님). 성립하지 않는 조합은 기하 가드로 거부한다.
//   · 턱 방향 = Ⓕ 와 같음(바깥으로 접고 중심 쪽 천이 위층). 재단선 = 턱 접은 상태에서 정리한 소매산을 펼친 선. 이세 = 턱 접은 소매산 길이 − AH.
//   · ☆ 꺾임: 진동밑점부터 b 위끝까지 소매산을 다시 그린다. b 턱은 두 변이 한 점에서 만나지 않아(아래끝 틈) 접으면 단차가 생긴다 →
//     b 변 연장선의 교점 X 를 꼭짓점으로 접은 상태(바깥 쪽 = 진동밑까지 X 중심 −φ 회전)에서 재제도하고 펼친다. 단차는 meta 에 그대로 기록.
//   · 벌어진 틈(가운데 상승·안쪽 회전 아래 · 아래끝 사이 · ☆ 삼각)은 종이를 덧대 메운다(meta.fill — 외곽선 아님).
// raw 강체 결과는 meta.rigid(감사). 박기 끝은 책에 없음 — 만들지 않는다.
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var A_OFF = 1, B_TOP = 3, B_FOOT = 2;     // 책 «2» 간격(김님 확정)
  var TUCK_DEFAULT = 1.5, TUCK_MAX = 2.0;   // 책 도해 1.5 · 본문 «1곳 2cm 가 최대»
  var STAR_DEFAULT = 3.0;                   // 책 도해 ★ 3 — 설정값(김님: 언제든 바뀔 수 있다)
  var BETA_MAX = Math.PI / 3;               // 바깥 조각 회전 탐색 범위(60°) — 기하 가드
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
  function angOf(v) { return Math.atan2(v.y, v.x); }
  function lineX(p1, p2, p3, p4) {
    var d = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
    if (Math.abs(d) < 1e-12) return null;
    var u = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / d;
    return { x: p1.x + (p2.x - p1.x) * u, y: p1.y + (p2.y - p1.y) * u, u: u };
  }
  function segHit(a, b, c, d) { return segCross(a, b, c, d); }
  function capAtY(cubs, y, side) {   // 소매산 × 가로선(한쪽): side<0 = 뒤(앞부분), >0 = 앞
    var n = cubs.length, order = []; for (var i = 0; i < n; i++) order.push(side < 0 ? i : n - 1 - i);
    for (var k = 0; k < n; k++) {
      var q = cubs[order[k]], f0 = q[0].y - y, f3 = q[3].y - y;
      if (f0 * f3 <= 0) { var lo = 0, hi = 1; for (var it = 0; it < 90; it++) { var m = (lo + hi) / 2; if (((cubicAt(q, m).y - y) <= 0) === (f0 <= 0)) lo = m; else hi = m; } return cubicAt(q, (lo + hi) / 2); }
    }
    return null;
  }
  function dirAt(cs, atEnd) { var q = atEnd ? cs[cs.length - 1] : cs[0], d = cubicD1(q, atEnd ? 1 : 0); return unit(d); }
  function rotV(v, a) { var c = Math.cos(a), s = Math.sin(a); return { x: c * v.x - s * v.y, y: s * v.x + c * v.y }; }

  function draftSleeveG(sleeveA, params) {
    var t = params && params.tuckCm !== undefined && params.tuckCm !== null ? params.tuckCm : TUCK_DEFAULT;
    var star = params && params.starCm !== undefined && params.starCm !== null ? params.starCm : STAR_DEFAULT;
    if (!fin(t) || !(t > 0) || t > TUCK_MAX + 1e-12) return fail("invalid-tuck", t);
    if (!fin(star) || !(star > 0)) return fail("invalid-star", star);
    var r = readSleeveA(sleeveA);
    if (!r.ok) return r;
    var cubs = r.cubics, Ub = r.Ub, Uf = r.Uf, H = r.hemY, SP = cp(r.sp), X0 = SP.x;
    var Yb = Ub.y, capH = Yb - SP.y, Ym = SP.y + capH / 2;
    if (!(Math.abs(Uf.y - Yb) < 1e-6)) return fail("invalid-sleeve-a", "underarm-level");
    // 절개 위치(Ⓐ 좌표) — 소매산을 x = ±3, ±1 에서 다섯 호로
    var xs = [X0 - B_TOP, X0 - A_OFF, X0 + A_OFF, X0 + B_TOP];
    var arcs = [], rest = cubs;
    for (var i = 0; i < 4; i++) { var sp = splitListAtX(rest, xs[i]); if (!sp || !sp[0].length || !sp[1].length) return fail("no-cap-intersection", xs[i]); arcs.push(sp[0]); rest = sp[1]; }
    arcs.push(rest);
    var Sb = capAtY(cubs, Ym, -1), Sf = capAtY(cubs, Ym, +1);
    if (!Sb || !Sf || !(Sb.x < xs[0] - TOL && Sf.x > xs[3] + TOL)) return fail("width-too-narrow", null, true);
    var C = { x: X0, y: Ym }, Cp = { x: X0, y: Ym - star };
    if (!(Cp.y > SP.y - capH)) return fail("star-too-large", star, true);
    var Tc = { c: 1, s: 0, tx: 0, ty: -star };
    // Ⓐ 앞/뒤 봉제 소매산 길이(같은 Gauss 측정, 분할 = SP) — 진동밑 연장의 목표
    var targetA = { back: cubicsLen(cubs.slice(0, r.spIndex + 1)), front: cubicsLen(cubs.slice(r.spIndex + 1)) };
    var halfA = splitListAtX(arcs[2], X0);
    var sides = {}, rigid = {}, fill = {};
    var SIDES = [{ id: "back", s: -1, A: 1, B: 0, inner: 1, outer: 0, S: Sb, U: Ub }, { id: "front", s: +1, A: 2, B: 3, inner: 3, outer: 4, S: Sf, U: Uf }];
    for (var si = 0; si < 2; si++) {
      var sd = SIDES[si], s = sd.s;
      var Aq = cp(sd.s < 0 ? arcs[2][0][0] : arcs[2][arcs[2].length - 1][3]);              // 소매산 × x = ±1
      var Bq = cp(sd.s < 0 ? arcs[1][0][0] : arcs[3][arcs[3].length - 1][3]);              // 소매산 × x = ±3
      var Fq = { x: X0 + s * B_FOOT, y: Ym };
      if (!(Bq.y < Ym && Aq.y < Ym)) return fail("cut-below-half", sd.id, true);
      // ① 가운데 상승 + a 벌림: 안쪽 = C′ 중심 s·α 회전(가운데와 함께 오른 뒤)
      var Ra = dist(Aq, C);
      if (!(t < 2 * Ra)) return fail("tuck-too-large", t, true);
      var al = 2 * Math.asin(t / (2 * Ra));
      var Tin = compose(rotAt(Cp, s * al), Tc);
      var Bin = app(Tin, Bq), Fin = app(Tin, Fq);
      // ② 바깥 = ☆ 중심 회전 β: b 쐐기 현 = t, 바깥으로 벌어지는 해(현이 바깥 방향) 중 회전이 가장 작은 것
      var S = sd.S, chord = function (b) { var Bo = app(rotAt(S, b), Bq); return { d: dist(Bo, Bin), out: (Bo.x - Bin.x) * s, footUp: Ym - app(rotAt(S, b), Fq).y }; };
      var dirSign = -s;   // 바깥 아래끝이 올라가는 회전 방향(y 아래 좌표: 앞(+x)은 음의 각)
      if (!(chord(dirSign * 0.01).footUp > 0)) dirSign = -dirSign;
      var beta = null, N = 1200, prev = chord(0);
      for (var k = 1; k <= N && beta === null; k++) {
        var b1 = dirSign * BETA_MAX * k / N, c1 = chord(b1);
        if ((prev.d - t) * (c1.d - t) <= 0 && c1.out > 0) {
          var lo = dirSign * BETA_MAX * (k - 1) / N, hi = b1;
          for (var it = 0; it < 100; it++) { var mb = (lo + hi) / 2; if ((chord(lo).d - t) * (chord(mb).d - t) <= 0) hi = mb; else lo = mb; }
          var bb = (lo + hi) / 2; if (chord(bb).out > 0) beta = bb;
        }
        prev = c1;
      }
      if (beta === null) return fail("tuck-star-incompatible", { side: sd.id, tuck: t, star: star }, true);
      var Tout = rotAt(S, beta), Bo = app(Tout, Bq), Fo = app(Tout, Fq);
      if (segHit(Bin, Fin, Bo, Fo)) return fail("pieces-overlap", sd.id, true);
      // ③ b 턱 꼭짓점 X = 두 b 변 연장선 교점(아래끝이 떨어져 있어 종이 위 한 점이 아님 — 덧댄 영역 안)
      var Xb = lineX(Bin, Fin, Bo, Fo);
      if (!Xb || !(Xb.u > 0)) return fail("b-apex-invalid", sd.id, true);
      var X = { x: Xb.x, y: Xb.y };
      var phi = angOf(sub(Bo, X)) - angOf(sub(Bin, X)); while (phi > Math.PI) phi -= 2 * Math.PI; while (phi < -Math.PI) phi += 2 * Math.PI;
      if (!(Math.abs(phi) > 1e-9)) return fail("b-apex-invalid", sd.id, true);
      var legIn = dist(X, Bin), legOut = dist(X, Bo);
      // ④ b 턱 접은 상태(안쪽 조각 펼친 자리 기준, 바깥 쪽 = X 중심 −φ): 진동밑 U → b 위끝(Bin) 재제도
      var fold = rotAt(X, -phi), unfold = rotAt(X, phi);
      var DB = unit(cubicD1(sd.s < 0 ? arcs[1][0] : arcs[3][arcs[3].length - 1], sd.s < 0 ? 0 : 1));   // Ⓐ 접선(+x 방향) at B
      var outB = rotV(s > 0 ? DB : { x: -DB.x, y: -DB.y }, s * al);                                      // Bin 에서 바깥(진동밑) 쪽 접선
      var DU = unit(sd.s < 0 ? cubicD1(cubs[0], 0) : cubicD1(cubs[cubs.length - 1], 1));                 // Ⓐ 접선(+x) at U
      var arrU = s > 0 ? DU : { x: -DU.x, y: -DU.y };                                                    // U 로 들어오는 방향
      var d0 = rotV(arrU, -phi);
      var redrawAt = function (Uq) { var P0q = app(fold, Uq), h = dist(Bin, P0q) / 3; return [cp(Bin), { x: Bin.x + outB.x * h, y: Bin.y + outB.y * h }, { x: P0q.x - d0.x * h, y: P0q.y - d0.y * h }, cp(P0q)]; };
      // ⑤′ 진동밑점 연장(김님 2026-10-11 시안 승인 «안 1»): 위팔선 따라 바깥으로 e 만큼 옮겨, 이쪽 봉제(턱 접은) 소매산 길이를 Ⓐ 와 같게 한다.
      //   봉제 길이 = 재제도(접은 상태) + 안쪽 조각 호 + 가운데 반호(조각 호는 강체라 Ⓐ 와 같은 길이). e 는 실제 곡선 길이로 푼다(비율·숫자 덮어쓰기 없음).
      var fixedLen = cubicsLen(arcs[sd.inner]) + cubicsLen(sd.s < 0 ? halfA[0] : halfA[1]), targetLen = sd.s < 0 ? targetA.back : targetA.front;
      var Uat = function (e) { return { x: sd.U.x + s * e, y: sd.U.y }; }, gap0 = function (e) { return cubicsLen([redrawAt(Uat(e))]) + fixedLen - targetLen; };
      var ext = 0, before = gap0(0);
      if (before < 0) {
        var lo2 = 0, hi2 = 1; while (gap0(hi2) < 0 && hi2 < r.W) hi2 *= 2;
        if (gap0(hi2) < 0) return fail("underarm-extension-unsolvable", { side: sd.id, deficit: -before }, true);
        for (var ie = 0; ie < 100; ie++) { var me = (lo2 + hi2) / 2; if (gap0(me) < 0) lo2 = me; else hi2 = me; }
        ext = (lo2 + hi2) / 2;
      }
      var Unew = Uat(ext), P0 = app(fold, Unew);
      var redrawF = redrawAt(Unew), redrawF0 = redrawAt(sd.U);
      var kR = []; for (var ik = 0; ik <= 200; ik++) kR.push(kappa(redrawF, ik / 200));
      var redrawInfl = inflectionCount(kR);
      // Ⓐ 소매산도 진동밑~b 위끝 구간에 변곡이 있다(아래 오목 → 위 볼록). 재제도가 그보다 많은 변곡을 만들면 거부.
      var aSpan = sd.s < 0 ? arcs[0] : arcs[4], kA = []; aSpan.forEach(function (q) { for (var ia = 0; ia <= 120; ia++) kA.push(kappa(q, ia / 120)); });
      var aInfl = inflectionCount(kA);
      if (redrawInfl > aInfl) return fail("redraw-inflection", { side: sd.id, n: redrawInfl, sleeveA: aInfl }, true);
      // 재제도 곡선이 접는 선(안쪽 b 변) 안쪽으로 넘어가지 않는지(바깥 쪽 영역 유지)
      var sideOf = function (p) { return crossSign(X, Bin, p); }, sgnOut = sideOf(app(fold, Bo)) || sideOf(P0);
      for (var ic = 1; ic <= 64; ic++) { if (sideOf(cubicAt(redrawF, ic / 64)) * sgnOut < -1e-9) return fail("redraw-crosses-fold", sd.id, true); }
      var redrawCut = [redrawF.map(function (p) { return app(unfold, p); })];   // 펼친 재단선(Bin 쪽 → U)
      redrawCut[0][3] = cp(Unew);
      // ⑤ 턱 입구(Ⓕ 와 같은 접힘: 접는 선 = 중심 쪽 변, 두 겹은 중심 쪽 조각 아래)
      var innerArc = mapList(arcs[sd.inner], function (p) { return app(Tin, p); });   // 펼친 안쪽 호(+x 순)
      var centerArc = mapList(arcs[2], function (p) { return app(Tc, p); });
      var mouthOf = function (csArc, pivot, foldA, foldB, ang, outFn, cornerIn, label) {
        // csArc: 중심 쪽 조각 펼친 호(+x 순). 접는 선 = foldA→foldB(꼭짓점 pivot 지남). M′ = 접는 선을 pivot 중심 중심 쪽으로 ang/2.
        var Rm = rotAt(pivot, -ang / 2), mTop = app(Rm, foldA);
        var fM = function (p) { return crossSign(pivot, mTop, p); };
        var sp1 = splitListBy(csArc, fM);
        if (!sp1) return { err: "tuck-too-deep", label: label };
        var portion = s > 0 ? sp1[1] : sp1[0];
        var pc2m = s > 0 ? revList(portion) : portion;
        if (dist(pc2m[0][0], cornerIn) > 1e-7) return { err: "discontinuous", label: label };
        var dx = foldB.x - foldA.x, dy = foldB.y - foldA.y, L2 = dx * dx + dy * dy;
        var refl = function (p) { var u = ((p.x - foldA.x) * dx + (p.y - foldA.y) * dy) / L2, fx = foldA.x + dx * u, fy = foldA.y + dy * u; return { x: 2 * fx - p.x, y: 2 * fy - p.y }; };
        var half1 = mapList(pc2m, refl), half2 = mapList(revList(pc2m), outFn);
        var gap = dist(half1[half1.length - 1][3], half2[0][0]);
        if (!(gap < 1e-7)) return { err: "discontinuous", label: label, gap: gap };
        half2[0][0] = cp(half1[half1.length - 1][3]);
        return { mouth: half1.concat(half2), mid: cp(half2[0][0]), layerEnd: cp(pc2m[pc2m.length - 1][3]), half1Len: cubicsLen(half1), half2Len: cubicsLen(half2) };
      };
      var Ac = app(Tc, Aq);
      var ma = mouthOf(centerArc, Cp, Ac, Cp, s * al, function (p) { return app(rotAt(Cp, s * al), p); }, Ac, sd.id + "-a");
      if (ma.err) return fail(ma.err, ma, true);
      var mb2 = mouthOf(innerArc, X, Bin, X, phi, function (p) { return app(unfold, p); }, Bin, sd.id + "-b");
      if (mb2.err) return fail(mb2.err, mb2, true);
      sides[sd.id] = { s: s, al: al, beta: beta, phi: phi, X: X, legIn: legIn, legOut: legOut, step: legOut - legIn, Tin: Tin, Tout: Tout, Bin: Bin, Bo: Bo, Fin: Fin, Fo: Fo, Ac: Ac, Ain: app(Tin, Aq),
        innerArc: innerArc, ma: ma, mb: mb2, redrawF: redrawF, redrawCut: redrawCut, place: app(unfold, Bin), S: cp(S), U: cp(Unew), U0: cp(sd.U), ext: ext, sewnNoExt: before + targetLen, targetLen: targetLen, redrawF0: redrawF0, Aq: Aq, Bq: Bq, Fq: Fq, redrawInfl: redrawInfl, aInfl: aInfl };
      rigid[sd.id] = { innerCap: pathOf(innerArc), outerCap: pathOf(mapList(splitListBy(sd.s < 0 ? arcs[0] : arcs[4], function (p) { return p.y - Ym; })[sd.s < 0 ? 1 : 0], function (p) { return app(Tout, p); })),
        alphaDeg: al * 180 / Math.PI, betaDeg: beta * 180 / Math.PI, outerCorner: cp(Bo), innerCorner: cp(Bin) };
      fill[sd.id] = { pts: [cp(C), cp(Cp), cp(Fin), cp(Fo), cp(S)], note: "가운데 상승·안쪽 회전 아래 + 아래끝 틈 + ☆ 삼각 — 종이 덧댐" };
    }
    // ── 재단선(펼침): 뒤 진동밑 → 뒤 재제도 → 뒤 b 입구 → 뒤 안쪽 → 뒤 a 입구 → 가운데 → 앞 a → 앞 안쪽 → 앞 b → 앞 재제도 → 앞 진동밑 ──
    var bk = sides.back, fr = sides.front;
    var frontOut = [].concat(fr.ma.mouth, fr.innerArc, fr.mb.mouth, fr.redrawCut);                       // 앞: 중심 쪽 → 바깥
    var backOut = [].concat(bk.ma.mouth, revList(bk.innerArc), bk.mb.mouth, bk.redrawCut);              // 뒤: 중심 쪽 → 바깥(−x)
    var centerArc = mapList(arcs[2], function (p) { return app(Tc, p); });
    var cap = revList(backOut).concat(centerArc, frontOut);
    var joinGap = 0; for (var j2 = 1; j2 < cap.length; j2++) joinGap = Math.max(joinGap, dist(cap[j2 - 1][3], cap[j2][0]));
    if (!(joinGap < 1e-6)) return fail("discontinuous", joinGap);
    for (var j3 = 1; j3 < cap.length; j3++) cap[j3][0] = cp(cap[j3 - 1][3]);
    var Ubn = bk.U, Ufn = fr.U;
    if (dist(cap[0][0], Ubn) > 1e-9 || dist(cap[cap.length - 1][3], Ufn) > 1e-9) return fail("discontinuous", "underarm");
    cap[0][0] = cp(Ubn); cap[cap.length - 1][3] = cp(Ufn);
    // 외곽: 소매산 + 옆선(새 진동밑 → Ⓐ 소맷부리 끝) + Ⓐ 소맷부리 그대로. 진동밑 높이·소맷부리 끝점 유지.
    var aOut = sleeveA.geometry.outline;
    if (dist(aOut[2].from, Uf) > 1e-9 || dist(aOut[1].from, Ub) > 1e-9) return fail("invalid-sleeve-a", "seam-ends");
    var outline = [pathOf(cap, "cap"), L(Ufn, aOut[2].to, "side-seam-front"), L(aOut[2].to, aOut[1].to, "hem"), L(aOut[1].to, Ubn, "side-seam-back")];
    var loop = flattenCubics(cap, FLAT_N); loop.push(cp(aOut[2].to)); loop.push(cp(aOut[1].to)); loop.push(cp(Ubn));
    if (loopSelfIntersects(loop)) return fail("self-intersection", null, true);
    var topY = Math.min.apply(null, loop.map(function (p) { return p.y; }));
    // 접은 상태(봉제) 이음 매끄러움: 재제도 양 끝 G1(안쪽 호 · Ⓐ 진동밑 접선), a 접힘 이음 = Ⓐ
    var g1R = 0;
    [bk, fr].forEach(function (sd) {
      var q = sd.redrawF, inArcDir = unit(cubicD1(sd.s > 0 ? sd.innerArc[sd.innerArc.length - 1] : sd.innerArc[0], sd.s > 0 ? 1 : 0));
      var outDir0 = unit(cubicD1(q, 0)); g1R = Math.max(g1R, angleBetween(sd.s > 0 ? inArcDir : { x: -inArcDir.x, y: -inArcDir.y }, outDir0));
    });
    if (!(g1R <= 1e-6)) return fail("redraw-g1-break", g1R);
    var construction = [L(app(Tc, SP), { x: X0, y: H }, "center-line"), L(Sb, Sf, "half-line"), L(C, Cp, "star-lift")];
    var tuckMeta = {};
    [["back", bk], ["front", fr]].forEach(function (e) {
      var id = e[0], sd = e[1];
      [["a", sd.ma, sd.Ac, sd.Ain, Cp, sd.al * 180 / Math.PI], ["b", sd.mb, sd.Bin, sd.place, sd.X, Math.abs(sd.phi) * 180 / Math.PI]].forEach(function (q) {
        var tid = id + "-" + q[0];
        var f = L(q[2], q[4], "tuck-fold"); f.tuck = tid; construction.push(f);
        var p = L(q[3], q[4], "tuck-place"); p.tuck = tid; construction.push(p);
        var m = L(q[1].mid, q[4], "tuck-mid"); m.tuck = tid; construction.push(m);
        tuckMeta[tid] = { line: q[0], fold: cp(q[2]), place: cp(q[3]), mid: cp(q[1].mid), apex: cp(q[4]), angleDeg: q[5], openedCm: q[0] === "a" ? dist(sd.Ac, sd.Ain) : dist(sd.Bin, sd.Bo),
          mouthCutCm: q[1].half1Len + q[1].half2Len };
      });
    });
    var lens = capLengthsOf({ outline: outline, construction: construction });
    if (!lens) return fail("cap-unmeasured");
    // 접어서 다시 잰 봉제 길이(독립 경로): 재제도(접은 상태) + 안쪽 호 + 가운데 반호
    var halfC = splitListAtX(centerArc, X0), sewnRe = { back: cubicsLen([bk.redrawF]) + cubicsLen(bk.innerArc) + cubicsLen(halfC[0]), front: cubicsLen([fr.redrawF]) + cubicsLen(fr.innerArc) + cubicsLen(halfC[1]) };
    var ahc = r.armholeCm, easeSewn = (ahc && fin(ahc.back) && fin(ahc.front)) ? { back: lens.sewn.back - ahc.back, front: lens.sewn.front - ahc.front, total: lens.sewn.total - ahc.back - ahc.front } : null;
    var am = sleeveA.meta;
    var sideMeta = function (sd) { return { alphaDeg: sd.al * 180 / Math.PI, betaDeg: sd.beta * 180 / Math.PI, bApex: cp(sd.X), bFoldAngleDeg: Math.abs(sd.phi) * 180 / Math.PI,
      bLegs: { inner: sd.legIn, outer: sd.legOut, stepCm: sd.step }, feetGapCm: dist(sd.Fin, sd.Fo), star: cp(sd.S), underarm: cp(sd.U),
      underarmExtension: { direction: "위팔선 따라 바깥(김님 2026-10-11 시안 승인 — 화면 확인 대기, 일반 원칙 아님)", cm: sd.ext, from: cp(sd.U0), to: cp(sd.U),
        sewnBeforeCm: sd.sewnNoExt, sewnAfterCm: cubicsLen([sd.redrawF]) + cubicsLen(sd.innerArc) + cubicsLen(sd.s < 0 ? halfA[0] : halfA[1]), targetCm: sd.targetLen, deficitCm: Math.max(0, sd.targetLen - sd.sewnNoExt),
        surplusCm: Math.max(0, sd.sewnNoExt - sd.targetLen), foldedCurveBefore: pathOf([sd.redrawF0]) },
      redraw: { from: "진동밑점", to: "b 위끝(접은 상태)", foldedCurve: pathOf([sd.redrawF]), lengthCm: cubicsLen([sd.redrawF]), inflections: sd.redrawInfl, sleeveAInflections: sd.aInfl,
        method: "b 턱 접은 상태(X 중심 −φ)에서 진동밑 접선·안쪽 호 접선 고정 Hermite(핸들 = 현/3) → 펼침" } }; };
    return {
      ok: true,
      geometry: { outline: outline, construction: construction },
      meta: {
        rule: "pattern-school-p43-tucked-sleeve-G(2026-10-11)",
        widthCm: r.W, sleeveLengthCm: r.sleeveLengthCm, hemCm: dist(aOut[3].from, aOut[3].to),
        capHeightBeforeCm: capH, capHeightAfterCm: Yb - topY, halfLineY: Ym, sp: cp(app(Tc, SP)), spBefore: cp(SP),
        tuck: { perTuckCm: t, defaultCm: TUCK_DEFAULT, maxCm: TUCK_MAX, count: 4, totalCm: 4 * t, tucks: tuckMeta,
          direction: { rule: "Ⓕ 와 같음(김님 확정)", fold: "중심 쪽 변", topLayer: "중심 쪽" }, stitchEnd: null, stitchEndStatus: "미확정(책에 없음) — 만들지 않음" },
        star: { cm: star, defaultCm: STAR_DEFAULT, from: cp(C), to: cp(Cp), note: "가운데 평행 상승 — 턱과 독립 입력(공식 아님)" },
        sides: { back: sideMeta(bk), front: sideMeta(fr) },
        fill: fill,
        underarm: { before: { back: cp(Ub), front: cp(Uf) }, after: { back: cp(Ubn), front: cp(Ufn) } },
        widthAfterCm: Ufn.x - Ubn.x, seamsBefore: { backCm: dist(aOut[1].from, aOut[1].to), frontCm: dist(aOut[2].from, aOut[2].to) },
        rigid: rigid,
        seams: { backCm: dist(Ubn, aOut[1].to), frontCm: dist(Ufn, aOut[2].to), diffCm: dist(Ubn, aOut[1].to) - dist(Ufn, aOut[2].to) },
        capSplit: { point: cp(app(Tc, SP)), rule: "가운데 조각 평행 상승 — SP′ = SP − ★" },
        capLengths: { sewn: lens.sewn, cut: lens.cut, sewnRefolded: sewnRe, measure: "Gauss-Legendre · 봉제 = 재단선 − 쐐기 입구(접혀 들어가는 두 겹) · 앞/뒤 분할 = SP′" },
        capLengthsA: am.capLengths ? JSON.parse(JSON.stringify(am.capLengths)) : null,
        armholeCm: ahc ? { back: ahc.back, front: ahc.front } : null,
        easeAfter: easeSewn, easeBasis: "턱을 접은(봉제 후) 소매산 길이 − AH (김님 확정)",
        easeSourceA: am.easeAfter ? JSON.parse(JSON.stringify(am.easeAfter)) : null,
        provisional: { tuckMeasure: "현(chord)", redraw: "접은 상태 Hermite(핸들 현/3)", bApex: "b 변 연장선 교점" },
        checks: { closed: true, connected: true, maxGapCm: joinGap, selfIntersection: false, singlePiece: true, redrawG1Deg: g1R }
      },
      warnings: [],
      sourceSleeveAHash: hashStr(JSON.stringify({ geometry: sleeveA.geometry, meta: sleeveA.meta }))
    };
  }

  // 최종 geometry 에서 소매산 길이 실측(Ⓕ 와 같은 방식) — 재단(펼친 재단선 전체)과 봉제(턱 접음: 쐐기 입구 = 접는 선 모서리 ~ 맞출 선 모서리 제외).
  //   쐐기 입구 모서리 = construction tuck-fold / tuck-place 의 위 끝, 앞/뒤 분할 = center-line 위 끝(SP). 반환 {cut, sewn, split} | null.
  function capLengthsOf(geometry) {
    if (!geometry || !Array.isArray(geometry.outline) || !Array.isArray(geometry.construction)) return null;
    var capS = geometry.outline.filter(function (s) { return s && s.role === "cap" && s.kind === "path"; })[0];
    var cl = geometry.construction.filter(function (s) { return s.role === "center-line"; })[0];
    var folds = geometry.construction.filter(function (s) { return s.role === "tuck-fold"; }), places = geometry.construction.filter(function (s) { return s.role === "tuck-place"; });
    if (!capS || !cl || folds.length !== 4 || places.length !== 4) return null;
    var cs = cubicsOfPath(capS);
    // 이음점(anchor) 목록과 누적 길이
    var anchors = [cs[0][0]], acc = [0];
    cs.forEach(function (q) { anchors.push(q[3]); acc.push(acc[acc.length - 1] + cubicLen(q)); });
    var idxOf = function (p) { var best = -1, bd = Infinity; anchors.forEach(function (a, i) { var d = dist(a, p); if (d < bd) { bd = d; best = i; } }); return bd < 1e-6 ? best : -1; };
    var iSP = idxOf(cl.from);
    if (iSP <= 0 || iSP >= anchors.length - 1) return null;
    var total = acc[acc.length - 1], back = acc[iSP], front = total - back;
    var hidden = { back: 0, front: 0 };
    for (var k = 0; k < 4; k++) {
      var tk = folds[k].tuck, pl = places.filter(function (s) { return s.tuck === tk; })[0];
      if (!pl) return null;
      var a = idxOf(folds[k].from), b = idxOf(pl.from);
      if (a < 0 || b < 0 || a === b) return null;
      var lo = Math.min(a, b), hi = Math.max(a, b), seg = acc[hi] - acc[lo];
      if (hi <= iSP) hidden.back += seg; else if (lo >= iSP) hidden.front += seg; else return null;
    }
    return { cut: { back: back, front: front, total: total },
      sewn: { back: back - hidden.back, front: front - hidden.front, total: total - hidden.back - hidden.front }, split: cp(anchors[iSP]), splitIndex: iSP };
  }

  window.designSleeveG = Object.freeze({ draftSleeveG: draftSleeveG, readSleeveA: readSleeveA, capLengthsOf: capLengthsOf,
    RULES: Object.freeze({ aOffsetCm: A_OFF, bTopCm: B_TOP, bFootCm: B_FOOT, tuckDefaultCm: TUCK_DEFAULT, tuckMaxCm: TUCK_MAX, starDefaultCm: STAR_DEFAULT }) });
})();
