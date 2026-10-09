// ══════════════════════════════════════════════
// designSleeveD.js — 소매 Ⓓ 플레어([패턴학교] P.42 «절개선을 2개 넣고 잘라서 벌린다»). 순수.
//
// 김님 확정(2026-10-09, docs/book/P042.md § 김님 확정):
//   · 출발 = 완성 소매 Ⓐ(읽기 전용). 앞·뒤 반폭 중점의 세로 절개 2개, 각 절개의 소매산 위 기준점 P_b·P_f(P.163 «기준점을 잡고 잘라서 벌린다»).
//   · 소매중심선을 포함한 중앙 조각 고정. 양옆 조각은 각 기준점 중심 **강체 회전** — 소맷부리에서 총 벌림 = 소매폭 × 0.5, 각 절개 = 그 절반.
//   · 소매산: 회전으로 기준점에 생긴 꺾임을 자연스럽게 다시 그린다(양쪽 국소 구간, 끝점·접선 고정 Hermite).
//   · 소맷부리: 각 조각 밑단 끝점(6점)을 기준으로 벌린 틈까지 자연스러운 곡선으로 잇는다(끝점 통과, 이음 G1).
// 잠정 구현값(책 수치 아님 — meta.provisional 에 기록): 벌림 거리 = 벌린 틈의 두 밑단 끝점 사이 직선 거리(현) · 소매산 재제도 구간 ℓ 2cm(인접 호 40% 한도)
//   · 소매산 구간: ℓ 2cm 에서 시작해 다시 그린 곡선 안에 S(곡률 부호 변화)가 생기면 0.25cm 씩 줄인다(최소 1cm)
//   · 소맷부리 곡선 = 끝점 통과 Hermite(내부 접선 = 이웃 두 점 방향, 양 끝 접선 = 이웃 접선의 현 대칭, 핸들 = 현/3).
// raw 강체 결과는 meta.rigid(감사), 최종 geometry 가 권위값. 소매산 길이·이세·소맷부리 길이는 최종 곡선 실측.
// 반환 { ok, geometry:{outline, construction}, meta, warnings, sourceSleeveAHash } | { ok:false, reason, detail?, outOfSupportedRange? }.
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var FLARE_RATIO = 0.5;              // 플레어 분량 ∅ = 소매폭 × 0.5 (책 산식)
  var CUTS = 2;                       // 절개 2개 → 각 ∅/2 (책)
  var REDRAW_ELL = 2.0;               // 소매산 재제도 구간(잠정 구현값 — 책 수치 아님)
  var REDRAW_RATIO = 0.4;             // 재제도 구간 ≤ 인접 호의 40% (잠정)
  var REDRAW_MIN = 1.0, REDRAW_STEP = 0.25;   // 구간 내부 S 가 생기면 줄이는 하한·단계(잠정)
  var JOIN = 1e-9, TOL = 1e-6;
  var G1_TOL_DEG = 1e-9;
  var KAPPA_DEAD = 0.01;              // 변곡 판정 불감대(/cm, 검증 설정)
  var FLAT_N = 24;
  var MAX_ROTATION = Math.PI / 4;     // 회전 한계(45°) — 지원 범위 가드(책 수치 아님)
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
  function draftSleeveD(sleeveA, params) {
    var r = readSleeveA(sleeveA);
    if (!r.ok) return r;
    var cubs = r.cubics, Ub = r.Ub, Uf = r.Uf, H = r.hemY, W = r.W, XL = Ub.x, XR = Uf.x;
    var xb = XL / 2, xf = XR / 2, flare = W * FLARE_RATIO, perCut = flare / CUTS;
    var s1 = splitListAtX(cubs, xb), s2 = s1 && splitListAtX(s1[1], xf), s3 = s2 && splitListAtX(s2[0], r.sp.x);
    if (!s3) return fail("no-cap-intersection");
    var backArc = s1[0], frontArc = s2[1], centerB = s3[0], centerF = s3[1];
    var Pb = cp(backArc[backArc.length - 1][3]), Pf = cp(frontArc[0][0]);
    var B0 = { x: XL, y: H }, Bi = { x: xb, y: H }, Cf = { x: xf, y: H }, F0 = { x: XR, y: H };
    // 강체 회전각: 각 기준점에서 그 절개의 밑단점까지 반지름 R, 두 밑단 끝점 사이 현 = ∅/2 → θ = 2·asin(∅/2 / 2R)
    var Rb = dist(Pb, Bi), Rf = dist(Pf, Cf);
    if (!(perCut < 2 * Rb && perCut < 2 * Rf)) return fail("flare-too-large", perCut, true);
    var thB = 2 * Math.asin(perCut / (2 * Rb)), thF = 2 * Math.asin(perCut / (2 * Rf));
    if (!(thB <= MAX_ROTATION && thF <= MAX_ROTATION)) return fail("rotation-too-large", Math.max(thB, thF) * 180 / Math.PI, true);
    var RB = function (p) { return rotP(p, +thB, Pb); }, RF = function (p) { return rotP(p, -thF, Pf); };   // 뒤는 바깥(왼쪽), 앞은 바깥(오른쪽)으로
    var rotList = function (cs, f) { return cs.map(function (q) { return q.map(f); }); };
    var backRot = rotList(backArc, RB), frontRot = rotList(frontArc, RF);
    var RAW = backRot.concat(centerB, centerF, frontRot);
    var UbM = RB(Ub), UfM = RF(Uf), B0M = RB(B0), BiM = RB(Bi), FiM = RF(Cf), F0M = RF(F0);
    var openBack = dist(BiM, Bi), openFront = dist(FiM, Cf);
    if (!(BiM.x < Bi.x && FiM.x > Cf.x)) return fail("flare-direction");

    // 소매산 국소 재제도(기준점 꺾임). 바깥으로 돌린 꺾임은 볼록한 소매산에 오목하게 꺾여(반대 방향) 다시 그린 구간은 오목 호가 된다(강체 회전의 귀결).
    //   잠정 구간 규칙: 꺾임 양쪽 ℓ = 2cm 에서 시작해, 다시 그린 곡선 **안에서** 곡률 부호가 바뀌면(구간 내부 S) 0.25cm 씩 줄인다(최소 1cm, 인접 호 40% 한도).
    var LB = cubicsLen(backRot), LcB = cubicsLen(centerB), LcF = cubicsLen(centerF), LF = cubicsLen(frontRot), sPb = LB, sPf = LB + LcB + LcF;
    var signChanges = function (h) { var k = []; for (var i = 0; i <= 240; i++) k.push(kappa(h, i / 240)); return inflectionCount(k); };
    var windowAt = function (sP, adjL, adjR) {
      for (var ell = REDRAW_ELL; ell >= REDRAW_MIN - 1e-12; ell -= REDRAW_STEP) {
        var lL = Math.min(ell, REDRAW_RATIO * adjL), lR = Math.min(ell, REDRAW_RATIO * adjR);
        var q0 = splitListAtLen(RAW, sP - lL), q1 = splitListAtLen(q0[1], lL + lR);
        if (!q0[0].length || !q1[1].length) continue;
        var ca = q0[0][q0[0].length - 1], cb = q1[1][0], h = hermite(ca[3], unit(cubicD1(ca, 1)), cb[0], unit(cubicD1(cb, 0)));
        if (signChanges(h) === 0) return { ell: ell, w: [lL, lR] };
      }
      return null;
    };
    var win1 = windowAt(sPb, LB, LcB), win2 = windowAt(sPf, LcF, LF);
    if (!win1 || !win2) return fail("redraw-inflection-unavoidable", null, true);
    var w1 = win1.w, w2 = win2.w, a1 = sPb - w1[0], b1 = sPb + w1[1], a2 = sPf - w2[0], b2 = sPf + w2[1];
    if (!(a1 > 0 && b1 < sPb + LcB && a2 > sPb + LcB && b2 < sPf + LF && b1 < a2)) return fail("redraw-window-invalid");
    var p0 = splitListAtLen(RAW, a1), p1 = splitListAtLen(p0[1], b1 - a1), p2 = splitListAtLen(p1[1], a2 - b1), p3 = splitListAtLen(p2[1], b2 - a2);
    var head = p0[0], mid = p2[0], tail = p3[1];
    if (!head.length || !mid.length || !tail.length) return fail("redraw-window-invalid");
    var cA = head[head.length - 1], cB = mid[0], cC = mid[mid.length - 1], cD = tail[0];
    var h1 = hermite(cA[3], unit(cubicD1(cA, 1)), cB[0], unit(cubicD1(cB, 0))), h2 = hermite(cC[3], unit(cubicD1(cC, 1)), cD[0], unit(cubicD1(cD, 0)));
    var cap = head.concat([h1], mid, [h2], tail);
    var joins = [[cA, h1], [h1, cB], [cC, h2], [h2, cD]].map(function (pq) { return { gapCm: dist(pq[0][3], pq[1][0]), g1Deg: angleBetween(cubicD1(pq[0], 1), cubicD1(pq[1], 0)) }; });
    var joinGap = 0, joinG1 = 0; joins.forEach(function (j) { joinGap = Math.max(joinGap, j.gapCm); joinG1 = Math.max(joinG1, j.g1Deg); });
    if (!(joinGap < JOIN)) return fail("discontinuous", joinGap);
    if (!(joinG1 <= G1_TOL_DEG)) return fail("redraw-g1-break", joinG1);
    var ptAt = function (cs, s) { var sp_ = splitListAtLen(cs, s); return sp_[1].length ? sp_[1][0][0] : sp_[0][sp_[0].length - 1][3]; };
    var shift1 = cubicLen(h1) - (b1 - a1), preserved = 0;
    for (var kk = 1; kk < 8; kk++) {
      preserved = Math.max(preserved, dist(ptAt(RAW, a1 * kk / 8), ptAt(cap, a1 * kk / 8)));
      var sm = b1 + (a2 - b1) * kk / 8; preserved = Math.max(preserved, dist(ptAt(RAW, sm), ptAt(cap, sm + shift1)));
    }
    var kH = function (h) { var o = []; for (var i = 0; i <= 240; i++) o.push(kappa(h, i / 240)); return o; };
    var k1 = kH(h1), k2 = kH(h2), kA1 = kappaOnRange(cubs, a1, b1), kA2 = kappaOnRange(cubs, a2, b2);
    var inflExtra = 0;   // 구간 내부 S 는 위 규칙으로 배제. 볼록 소매산 위 오목 구간(기준점 꺾임의 귀결)은 meta.redraw.concave 로 기록한다.
    var amax = function (a) { return a.reduce(function (m, v) { return Math.max(m, Math.abs(v)); }, 0); };

    // 소맷부리: 각 조각 밑단 끝점 6점(앞 바깥 모서리 → 앞 조각 안쪽 끝 → 중앙 앞 끝 → 중앙 뒤 끝 → 뒤 조각 안쪽 끝 → 뒤 바깥 모서리)을 지나는 곡선
    var hemPts = [F0M, FiM, Cf, Bi, BiM, B0M];
    var hemCs = throughCurve(hemPts);
    var hemG1 = 0; for (var hi = 1; hi < hemCs.length; hi++) hemG1 = Math.max(hemG1, angleBetween(cubicD1(hemCs[hi - 1], 1), cubicD1(hemCs[hi], 0)));
    if (!(hemG1 <= G1_TOL_DEG)) return fail("hem-g1-break", hemG1);
    var hk = []; hemCs.forEach(function (q) { for (var i = 0; i <= 120; i++) hk.push(kappa(q, i / 120)); });
    var hemInfl = inflectionCount(hk);
    if (hemInfl > 0) return fail("hem-inflection", hemInfl, true);

    // ── 단일 외곽 ──
    var outline = [pathOf(cap, "cap"), L(UfM, F0M, "side-seam-front"), pathOf(hemCs, "hem"), L(B0M, UbM, "side-seam-back")];
    var loop = flattenCubics(cap, FLAT_N);
    loop.push(cp(F0M)); flattenCubics(hemCs, FLAT_N).slice(1).forEach(function (p) { loop.push(p); }); loop.push(cp(UbM));
    var closeGap = dist(loop[loop.length - 1], loop[0]);
    if (!(closeGap < JOIN)) return fail("discontinuous", closeGap);
    if (loopSelfIntersects(loop)) return fail("self-intersection");
    var construction = [
      L({ x: r.sp.x, y: r.sp.y }, { x: r.sp.x, y: H }, "center-line"),
      L(Pb, Bi, "cut-axis-back"), L(Pf, Cf, "cut-axis-front"),          // 중앙 조각의 절개변(고정)
      L(Pb, BiM, "cut-edge-back"), L(Pf, FiM, "cut-edge-front")          // 돌아간 옆 조각의 절개변 — 사이가 벌린 틈
    ];

    // ── 독립 실측 ──
    var capBack = cubicsLen(head) + cubicLen(h1) + (LB + LcB - b1), capTotal = cubicsLen(cap), capFront = capTotal - capBack;
    var ahc = r.armholeCm, easeNow = (ahc && fin(ahc.back) && fin(ahc.front)) ? { back: capBack - ahc.back, front: capFront - ahc.front, total: capTotal - ahc.back - ahc.front } : null;
    var hemCm = cubicsLen(hemCs);
    var am = sleeveA.meta;
    return {
      ok: true,
      geometry: { outline: outline, construction: construction },
      meta: {
        rule: "pattern-school-p42-flare-sleeve-D(2026-10-09)",
        widthCm: W, sleeveLengthCm: r.sleeveLengthCm, hemCm: hemCm, hemBeforeCm: W,
        flare: { ratio: FLARE_RATIO, totalCm: flare, perCutCm: perCut, cuts: CUTS, openedCm: { back: openBack, front: openFront },
          measure: "벌린 틈의 두 밑단 끝점 사이 직선 거리(현) — 잠정 정의",
          alternatives: { arcCm: { back: Rb * thB, front: Rf * thF }, horizontalCm: { back: Bi.x - BiM.x, front: FiM.x - Cf.x } } },
        pivots: { back: cp(Pb), front: cp(Pf) }, rotationDeg: { back: thB * 180 / Math.PI, front: thF * 180 / Math.PI },
        axes: { back: { x: xb, cap: cp(Pb), hem: cp(Bi) }, front: { x: xf, cap: cp(Pf), hem: cp(Cf) } },
        hemPoints: { frontOuter: cp(F0M), frontInner: cp(FiM), centerFront: cp(Cf), centerBack: cp(Bi), backInner: cp(BiM), backOuter: cp(B0M) },
        seams: { backCm: dist(UbM, B0M), frontCm: dist(UfM, F0M) },
        redraw: { ellCm: REDRAW_ELL, ratio: REDRAW_RATIO, status: "잠정 구현값(책 수치 아님) — ℓ 2cm 시작, 구간 내부 S 면 0.25cm 씩 축소(최소 1cm)", windows: { Pb: w1, Pf: w2 },
          ellChosenCm: { Pb: win1.ell, Pf: win2.ell }, concave: { Pb: Math.min.apply(null, k1) < 0, Pf: Math.min.apply(null, k2) < 0, note: "바깥으로 돌린 기준점 꺾임은 오목 — 다시 그린 구간이 오목 호" },
          kinkDegRaw: { Pb: thB * 180 / Math.PI, Pf: thF * 180 / Math.PI }, joins: joins, preservedMaxCm: preserved, inflectionExtra: inflExtra,
          kappaMax: { Pb: amax(k1), Pf: amax(k2), PbA: amax(kA1), PfA: amax(kA2) }, continuity: "G1(곡률 연속 아님)" },
        hemCurve: { method: "6 밑단 끝점 통과 Hermite(내부 접선 = 이웃 두 점 방향, 양 끝 = 현 대칭, 핸들 = 현/3)", g1MaxDeg: hemG1, inflections: hemInfl, status: "잠정 구현값" },
        rigid: { cap: pathOf(RAW), hemPoints: [cp(F0M), cp(FiM), cp(Cf), cp(Bi), cp(BiM), cp(B0M)], note: "강체 회전 직후(감사용) — 최종 geometry 가 권위값" },
        provisional: { flareMeasure: "현(chord)", redrawEllCm: REDRAW_ELL, redrawMinCm: REDRAW_MIN, redrawStepCm: REDRAW_STEP, redrawRatio: REDRAW_RATIO, hemCurve: "끝점 통과 Hermite" },
        sp: cp(r.sp), capSplit: { point: cp(r.sp) },
        underarm: { before: { back: cp(Ub), front: cp(Uf) }, after: { back: cp(UbM), front: cp(UfM) } },
        capLengths: { back: capBack, front: capFront, total: capTotal, measure: "Gauss-Legendre(final curve)" },
        capLengthsA: am.capLengths ? JSON.parse(JSON.stringify(am.capLengths)) : null,
        armholeCm: ahc ? { back: ahc.back, front: ahc.front } : null,
        easeAfter: easeNow, easeSourceA: am.easeAfter ? JSON.parse(JSON.stringify(am.easeAfter)) : null,
        checks: { closed: true, connected: true, maxGapCm: Math.max(joinGap, closeGap), selfIntersection: false, singlePiece: true, maxG1BreakDeg: Math.max(joinG1, hemG1), preservedMaxCm: preserved }
      },
      warnings: [],
      sourceSleeveAHash: hashStr(JSON.stringify({ geometry: sleeveA.geometry, meta: sleeveA.meta }))
    };
  }

  window.designSleeveD = Object.freeze({ draftSleeveD: draftSleeveD, readSleeveA: readSleeveA,
    RULES: Object.freeze({ flareRatio: FLARE_RATIO, cuts: CUTS, redrawEllCm: REDRAW_ELL, redrawMinCm: REDRAW_MIN, redrawStepCm: REDRAW_STEP, redrawRatio: REDRAW_RATIO, g1TolDeg: G1_TOL_DEG, kappaDeadPerCm: KAPPA_DEAD, maxRotationRad: MAX_ROTATION }) });
})();
