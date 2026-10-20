// ══════════════════════════════════════════════
// designSleeveM.js — 소매 Ⓜ 반소매 퍼프([패턴학교] P.46 하단 «소매산과 소맷부리를 잘라서 벌린다(퍼프 슬리브)»). 순수.
//   (공용 도구는 designSleeveI/K.js 와 같은 것 — 꺾임 국소 재제도 · 소맷부리 truing · 가운데 틈 다리.)
// 김님 확정(2026-10-20, docs/book/P046.md § Ⓜ):
//   · 출발 = 같은 몸판의 짧은 Ⓐ — 소매길이 기본 20(SP → 출발 밑단) · 위팔 둘레 기본 26 · 소매산 상승 기본 0.5(모두 수정 가능).
//   · ● = 위팔 + 4 · ■ = Ⓐ 소매폭 − ●(부호 있는 값 그대로 — Ⓛ 승인) · ∅ = 0.7● − ■ = 1.7● − W · ⊠ = ∅/10. 상승 0.5cm 와 개더 계수 0.7배는 별개.
//   · 절개 5개(중심선 + 앞·뒤 반폭을 각각 3등분한 선 2개씩). 다섯 틈 현 거리(뒤 → 앞) 1 : 2 : 4 : 2 : 1(⊠ 단위).
//   · 순서: 가운데 두 반쪽을 좌우 2⊠ 평행 이동 → 각 반쪽 중심 쪽 조각 고정 → 중간 조각을 이동한 안쪽 기준점(절개선 × 소매산)에서 2⊠ 벌림
//     → 바깥 조각을 (중간 조각과 함께 운반된) 바깥 기준점에서 ⊠ 추가 벌림. O·SP 는 중심 절개로 갈라지고 틈 이등분선(원래 중심선)이 기준.
//   · 마무리: 소매산 가운데 틈 + 기준점 꺾임 4곳 최소 국소 재제도(구간은 잠정 설정 — 책 규칙 아님) · 소맷부리 전체 자연 곡선(약간 파임·덧댐 허용).
//   · 막는 것은 실제 기하(겹침·자기교차·연속성·곡률)와, 구분해 표시하는 설정된 수치 가드(회전 45° — 책 규칙 아님)뿐.
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var GATHER_RATIO = 0.7, RISE_DEFAULT = 0.5;   // 책 설정(개더 0.7배) · 상승 기본값 0.5(설정값 — 개더 계수와 별개)
  var UNITS = 10, CENTER_UNITS = 4, INNER_UNITS = 2, OUTER_UNITS = 1;   // ⊠ = ∅/10 · 가운데 4⊠ · 안쪽 2⊠ · 바깥 ⊠ (책 1 : 2 : 4 : 2 : 1)
  var BRIDGE_MIN = 0.5, BRIDGE_STEP = 0.25, BRIDGE_MAX_RATIO = 0.5;   // 가운데 틈 재제도 구간: 0 → 0.5 → 0.25 씩(잠정) · 중심 쪽 호의 50% 까지(꺾임 구간 40% 와 겹치지 않게)
  var UPPER_ARM_DEFAULT = 26, SLEEVE_LENGTH_DEFAULT = 20, CUFF_ADD = 4, CUFF_WIDTH = 1;   // 김님 확정(위팔 26 · 소매길이 20 · 커프스 달림 = 위팔 + 4 · 폭 1)
  var CUTS = 5;                       // 절개 5개(중심선 + 앞·뒤 3등분 선 2개씩)
  var REDRAW_ELL = 2.0;               // 소매산 재제도 구간(잠정 구현값 — 책 수치 아님)
  var REDRAW_RATIO = 0.4;             // 재제도 구간 ≤ 인접 호의 40% (잠정)
  var REDRAW_MIN = 0.5, REDRAW_STEP = 0.25;   // Ⓘ: 꺾임이 작은 경우(손바닥 작음·소매 긺) 1cm 로는 변곡 없는 재제도가 안 될 때가 있어 하한 0.5(잠정 — 책 규칙 아님)   // 구간 내부 S 가 생기면 줄이는 하한·단계(잠정)
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

  function draftSleeveM(sleeveA, params) {
    var p = params || {};
    var arm = p.upperArmCm === undefined || p.upperArmCm === null ? UPPER_ARM_DEFAULT : p.upperArmCm;
    var rise = p.riseCm === undefined || p.riseCm === null ? RISE_DEFAULT : p.riseCm;
    if (!fin(arm) || !(arm > 0)) return fail("invalid-upper-arm", arm);
    if (!fin(rise) || rise < 0) return fail("invalid-rise", rise);
    var r = readSleeveA(sleeveA);
    if (!r.ok) return r;
    var cubs = r.cubics, Ub = r.Ub, Uf = r.Uf, H = r.hemY, W = r.W, XL = Ub.x, XR = Uf.x, SP = cp(r.sp), X0 = SP.x;
    // ■ 는 부호 있는 값 그대로(Ⓛ 승인과 같은 원칙). ∅ ≤ 0 이면 벌릴 것이 없다.
    var cuff = arm + CUFF_ADD, square = W - cuff, spread = GATHER_RATIO * cuff - square, u = spread / UNITS;
    var gapC = CENTER_UNITS * u, gapI = INNER_UNITS * u, gapO = OUTER_UNITS * u, half = gapC / 2;
    if (!(spread > 0)) return fail("no-spread", { cuff: cuff, hemA: W, spread: spread }, true);
    // 반폭 3등분 절개선: 안쪽(중심에서 1/3) · 바깥쪽(2/3)
    var xb1 = X0 + (XL - X0) / 3, xb2 = X0 + 2 * (XL - X0) / 3, xf1 = X0 + (XR - X0) / 3, xf2 = X0 + 2 * (XR - X0) / 3;
    var s1 = splitListAtX(cubs, xb2), s2 = s1 && splitListAtX(s1[1], xb1), s3 = s2 && splitListAtX(s2[1], X0), s4 = s3 && splitListAtX(s3[1], xf1), s5 = s4 && splitListAtX(s4[1], xf2);
    if (!s5) return fail("no-cap-intersection");
    var arcs = { bo: s1[0], bm: s2[0], bc: s3[0], fc: s4[0], fm: s5[0], fo: s5[1] };
    var Pb2 = cp(arcs.bo[arcs.bo.length - 1][3]), Pb1 = cp(arcs.bm[arcs.bm.length - 1][3]), Pf1 = cp(arcs.fc[arcs.fc.length - 1][3]), Pf2 = cp(arcs.fm[arcs.fm.length - 1][3]);
    var at = function (x) { return { x: x, y: H }; };
    var B0 = at(XL), Cb2 = at(xb2), Cb1 = at(xb1), Cm = at(X0), Cf1 = at(xf1), Cf2 = at(xf2), F0 = at(XR);
    // ① 가운데: 두 반쪽을 좌우 2⊠ 평행 이동(회전 없음) — 각 반쪽의 중심 쪽 조각은 여기서 고정
    var TB = function (q) { return { x: q.x - half, y: q.y }; }, TF = function (q) { return { x: q.x + half, y: q.y }; };
    // ② 중간 조각: 이동한 안쪽 기준점(절개선 × 소매산) 중심 회전 β1 — 중간 조각 안쪽 밑단 끝과 중심 쪽 조각 바깥 밑단 끝 사이 현 = 2⊠
    var Pb1M = TB(Pb1), Pf1M = TF(Pf1), Rb1 = dist(Pb1M, TB(Cb1)), Rf1 = dist(Pf1M, TF(Cf1));
    if (!(gapI < 2 * Rb1 && gapI < 2 * Rf1)) return fail("flare-too-large", gapI, true);
    var b1B = 2 * Math.asin(gapI / (2 * Rb1)), b1F = 2 * Math.asin(gapI / (2 * Rf1));
    var MB = function (q) { return rotP(TB(q), +b1B, Pb1M); }, MF = function (q) { return rotP(TF(q), -b1F, Pf1M); };
    // ③ 바깥 조각: 중간 조각과 함께 운반된 뒤(MB/MF), 그 바깥 기준점 중심 추가 회전 β2 — 현 = ⊠
    var Pb2M = MB(Pb2), Pf2M = MF(Pf2), Rb2 = dist(Pb2M, MB(Cb2)), Rf2 = dist(Pf2M, MF(Cf2));
    if (!(gapO < 2 * Rb2 && gapO < 2 * Rf2)) return fail("flare-too-large", gapO, true);
    var b2B = 2 * Math.asin(gapO / (2 * Rb2)), b2F = 2 * Math.asin(gapO / (2 * Rf2));
    if (!(b1B + b2B <= MAX_ROTATION && b1F + b2F <= MAX_ROTATION)) {   // 설정된 수치 가드(45° — 책 규칙 아님): 물리적 불가능 판정이 아니다
      var rg = fail("rotation-too-large", { deg: Math.max(b1B + b2B, b1F + b2F) * 180 / Math.PI, limitDeg: MAX_ROTATION * 180 / Math.PI, kind: "numeric-guard" }, true);
      rg.numericGuard = true; return rg;
    }
    var OB = function (q) { return rotP(MB(q), +b2B, Pb2M); }, OF = function (q) { return rotP(MF(q), -b2F, Pf2M); };
    var mapList = function (cs, f) { return cs.map(function (q) { return q.map(f); }); };
    var bo = mapList(arcs.bo, OB), bm = mapList(arcs.bm, MB), bc = mapList(arcs.bc, TB), fc = mapList(arcs.fc, TF), fm = mapList(arcs.fm, MF), fo = mapList(arcs.fo, OF);
    var hp = { frontOuter: OF(F0), frontOuterIn: OF(Cf2), frontMidOut: MF(Cf2), frontMidIn: MF(Cf1), frontCenterOut: TF(Cf1), frontCenterMid: TF(Cm),
      backCenterMid: TB(Cm), backCenterOut: TB(Cb1), backMidIn: MB(Cb1), backMidOut: MB(Cb2), backOuterIn: OB(Cb2), backOuter: OB(B0) };
    var opened = { backOuter: dist(hp.backOuterIn, hp.backMidOut), backInner: dist(hp.backMidIn, hp.backCenterOut), center: dist(hp.backCenterMid, hp.frontCenterMid),
      frontInner: dist(hp.frontCenterOut, hp.frontMidIn), frontOuter: dist(hp.frontMidOut, hp.frontOuterIn) };
    if (!(hp.backOuterIn.x < hp.backMidOut.x && hp.backMidIn.x < hp.backCenterOut.x && hp.backCenterMid.x < hp.frontCenterMid.x && hp.frontMidIn.x > hp.frontCenterOut.x && hp.frontOuterIn.x > hp.frontMidOut.x))
      return fail("flare-direction");
    var UbM = OB(Ub), UfM = OF(Uf);

    // ④ 소매산 가운데 틈: 새 꼭대기(틈 가운데 · 원래 높이 − 상승)로 양쪽 중심 쪽 호를 잇는다 — 가장 작은 구간부터(Ⓚ 와 같은 규칙 · 곡률 부호 한쪽, 불감대 없음)
    var top = { x: X0, y: SP.y - rise }, LBc = cubicsLen(bc), LFc = cubicsLen(fc), bridge = null;
    for (var ell = 0; ell <= Math.min(LBc, LFc) * BRIDGE_MAX_RATIO + 1e-9 && !bridge; ell = ell === 0 ? BRIDGE_MIN : ell + BRIDGE_STEP) {
      var sb = splitListAtLen(bc, LBc - ell), sf = splitListAtLen(fc, ell);
      if (!sb[0].length || !sf[1].length) continue;
      var qa = sb[0][sb[0].length - 1], qb = sf[1][0];
      var h1 = hermite(qa[3], unit(cubicD1(qa, 1)), top, { x: 1, y: 0 }), h2 = hermite(top, { x: 1, y: 0 }, qb[0], unit(cubicD1(qb, 0)));
      var kLo = Infinity, kHi = -Infinity, ymin = Infinity;
      [h1, h2].forEach(function (q) { for (var i = 0; i <= 240; i++) { var kq = kappa(q, i / 240); kLo = Math.min(kLo, kq); kHi = Math.max(kHi, kq); ymin = Math.min(ymin, cubicAt(q, i / 240).y); } });
      if (!(kLo < -1e-6 && kHi > 1e-6) && ymin >= top.y - 1e-9) bridge = { ell: ell, keepB: sb[0], keepF: sf[1], replaced: [sb[1], sf[0]], h: [h1, h2] };
    }
    if (!bridge) {   // 잠정 설정 한계(구간 상한 = 중심 쪽 호의 50%) 안에서 변곡 없는 연결이 없음 — 책 규칙·물리적 불가 판정이 아니다(상한을 넓히면 이어질 수 있음)
      var bf = fail("bridge-inflection-unavoidable", { riseCm: rise, windowLimitCm: Math.min(LBc, LFc) * BRIDGE_MAX_RATIO, ratio: BRIDGE_MAX_RATIO, kind: "provisional-limit" }, true);
      bf.provisionalLimit = true; return bf;
    }
    var center = bridge.keepB.concat(bridge.h, bridge.keepF);
    for (var ci = 1; ci < center.length; ci++) center[ci][0] = cp(center[ci - 1][3]);
    // ⑤ 소매산 기준점 꺾임 4곳: 각각 국소 재제도(Ⓔ·Ⓘ·Ⓚ 와 같은 규칙 — ℓ 2cm 시작, 내부 S 면 축소 · 인접 호의 40% 이내 · 가운데 구간과 겹치지 않음)
    var LBo = cubicsLen(bo), LBm = cubicsLen(bm), LFm = cubicsLen(fm), LFo = cubicsLen(fo), LC = cubicsLen(center);
    var RAW = bo.concat(bm, center, fm, fo);
    var rd = redrawKinks(RAW, [{ s: LBo, adjL: LBo, adjR: LBm }, { s: LBo + LBm, adjL: LBm, adjR: LBc - bridge.ell },
      { s: LBo + LBm + LC, adjL: LFc - bridge.ell, adjR: LFm }, { s: LBo + LBm + LC + LFm, adjL: LFm, adjR: LFo }]);
    if (rd.error) return fail(rd.error, null, rd.error === "redraw-inflection-unavoidable");
    var cap = rd.cap, joinGap = 0, joinG1 = 0;
    rd.joins.forEach(function (j) { joinGap = Math.max(joinGap, j.gapCm); joinG1 = Math.max(joinG1, j.g1Deg); });
    if (!(joinGap < JOIN)) return fail("discontinuous", joinGap);
    if (!(joinG1 <= G1_TOL_DEG)) return fail("redraw-g1-break", joinG1);
    var capG1 = 0; for (var gi = 1; gi < cap.length; gi++) capG1 = Math.max(capG1, angleBetween(cubicD1(cap[gi - 1], 1), cubicD1(cap[gi], 0)));
    if (!(capG1 <= 1e-6)) return fail("redraw-g1-break", capG1);
    var iTop = -1; for (var ti = 0; ti < cap.length - 1; ti++) if (dist(cap[ti][3], top) < 1e-9) iTop = ti;
    if (iTop < 0) return fail("cap-split-failed");

    // ⑥ 소맷부리: 여섯 조각 밑단 끝점 12점(앞 바깥 → 뒤 바깥) — 전체를 자연스러운 곡선으로(약간 파임·덧댐 허용 · 변곡 없음 · 곡률 연속)
    var hemPts = [hp.frontOuter, hp.frontOuterIn, hp.frontMidOut, hp.frontMidIn, hp.frontCenterOut, hp.frontCenterMid, hp.backCenterMid, hp.backCenterOut, hp.backMidIn, hp.backMidOut, hp.backOuterIn, hp.backOuter];
    var fairR = fairHem(hemPts), hemCs = fairR.bz;
    var hemG1 = 0, kJump = 0; for (var hi = 1; hi < hemCs.length; hi++) { hemG1 = Math.max(hemG1, angleBetween(cubicD1(hemCs[hi - 1], 1), cubicD1(hemCs[hi], 0))); kJump = Math.max(kJump, Math.abs(kappa(hemCs[hi - 1], 1) - kappa(hemCs[hi], 0))); }
    if (!(hemG1 <= G1_TOL_DEG)) return fail("hem-g1-break", hemG1);
    var hk = []; hemCs.forEach(function (q) { for (var i = 0; i <= 120; i++) hk.push(kappa(q, i / 120)); });
    var hemInfl = inflectionCount(hk);
    if (hemInfl > 0) return fail("hem-fair-inflection", hemInfl, true);
    var corner = hemPts.slice(1, -1).map(function (q) { return { at: cp(q), dyCm: yAtX(hemCs, q.x) - q.y }; });
    var maxCut = Math.max(0, -Math.min.apply(null, corner.map(function (c) { return c.dyCm; }))), maxOut = Math.max(0, Math.max.apply(null, corner.map(function (c) { return c.dyCm; })));
    var areaCut = 0, areaAdd = 0;   // 원래 종이 조각 아래변 6개(0–1 · 2–3 · … · 10–11)와 곡선 사이(틈은 원래 덧댄 종이) — 최대 파임·덧댐도 변 전체에서
    [[0, 1], [2, 3], [4, 5], [6, 7], [8, 9], [10, 11]].forEach(function (e) { var a = hemPts[e[0]], b = hemPts[e[1]];
      for (var ia = 0; ia < 200; ia++) { var tt = (ia + 0.5) / 200, xm = a.x + (b.x - a.x) * tt, dyA = yAtX(hemCs, xm) - (a.y + (b.y - a.y) * tt), dxA = Math.abs(b.x - a.x) / 200;
        if (dyA < 0) { areaCut += -dyA * dxA; maxCut = Math.max(maxCut, -dyA); } else { areaAdd += dyA * dxA; maxOut = Math.max(maxOut, dyA); } } });

    var outline = [pathOf(cap, "cap"), L(UfM, hp.frontOuter, "side-seam-front"), pathOf(hemCs, "hem"), L(hp.backOuter, UbM, "side-seam-back")];
    var loop = flattenCubics(cap, FLAT_N);
    loop.push(cp(hp.frontOuter)); flattenCubics(hemCs, FLAT_N).slice(1).forEach(function (q) { loop.push(q); }); loop.push(cp(UbM));
    var closeGap = dist(loop[loop.length - 1], loop[0]);
    if (!(closeGap < JOIN)) return fail("discontinuous", closeGap);
    if (loopSelfIntersects(loop)) return fail("self-intersection", null, true);
    var construction = [
      L(top, { x: X0, y: H }, "center-line"),   // 소매 중심선 = 가운데 틈의 이등분선(원래 중심선 위치)
      L(TB(SP), hp.backCenterMid, "cut-center-back"), L(TF(SP), hp.frontCenterMid, "cut-center-front"),
      L(Pb1M, hp.backCenterOut, "cut-axis-back-inner"), L(Pb1M, hp.backMidIn, "cut-edge-back-inner"), L(Pb2M, hp.backMidOut, "cut-axis-back-outer"), L(Pb2M, hp.backOuterIn, "cut-edge-back-outer"),
      L(Pf1M, hp.frontCenterOut, "cut-axis-front-inner"), L(Pf1M, hp.frontMidIn, "cut-edge-front-inner"), L(Pf2M, hp.frontMidOut, "cut-axis-front-outer"), L(Pf2M, hp.frontOuterIn, "cut-edge-front-outer")
    ];

    // 원래 종이 6조각(실제 강체 변환 그대로 — 표시·감사용) · 조각끼리 겹치면(기준점 밖 교차) 막는다
    var flatArc = function (cs) { var o = []; cs.forEach(function (q, i) { for (var k = (i ? 1 : 0); k <= 24; k++) o.push(cubicAt(q, k / 24)); }); return o; };
    var pieceOf = function (arc, extra, f) { return flatArc(arc).concat(extra).map(function (q) { return cp(f(q)); }); };
    var pieces = { backOuter: pieceOf(arcs.bo, [Cb2, B0], OB), backMid: pieceOf(arcs.bm, [Cb1, Cb2], MB), backCenter: pieceOf(arcs.bc, [Cm, Cb1], TB),
      frontCenter: pieceOf(arcs.fc, [Cf1, Cm], TF), frontMid: pieceOf(arcs.fm, [Cf2, Cf1], MF), frontOuter: pieceOf(arcs.fo, [F0, Cf2], OF) };
    var pk = ["backOuter", "backMid", "backCenter", "frontCenter", "frontMid", "frontOuter"], touch = [Pb2M, Pb1M, Pf1M, Pf2M];
    var nearTouch = function (q) { return touch.some(function (t) { return dist(q, t) < 1e-6; }); };
    for (var pa = 0; pa < pk.length; pa++) for (var pb2 = pa + 1; pb2 < pk.length; pb2++) {
      var A1 = pieces[pk[pa]].concat([pieces[pk[pa]][0]]), B1 = pieces[pk[pb2]].concat([pieces[pk[pb2]][0]]);
      for (var ia1 = 1; ia1 < A1.length; ia1++) for (var ib1 = 1; ib1 < B1.length; ib1++) {
        var a0 = A1[ia1 - 1], a1 = A1[ia1], c0 = B1[ib1 - 1], c1 = B1[ib1];
        if (nearTouch(a0) || nearTouch(a1) || nearTouch(c0) || nearTouch(c1)) continue;
        if (segCross(a0, a1, c0, c1)) return fail("pieces-overlap", { pieces: [pk[pa], pk[pb2]] }, true);
      }
    }

    var capBack = cubicsLen(cap.slice(0, iTop + 1)), capFront = cubicsLen(cap.slice(iTop + 1)), capTotal = capBack + capFront;
    var capA = { back: cubicsLen(arcs.bo) + cubicsLen(arcs.bm) + cubicsLen(arcs.bc), front: cubicsLen(arcs.fc) + cubicsLen(arcs.fm) + cubicsLen(arcs.fo) }; capA.total = capA.back + capA.front;
    var ahc = r.armholeCm, ah = (ahc && fin(ahc.back) && fin(ahc.front)) ? ahc : null;
    var hemCm = cubicsLen(hemCs), am = sleeveA.meta;
    var rev = function (pts) { return pts.slice().reverse(); };
    var fillCenter = flatArc(bridge.h).concat(rev(flatArc(bridge.replaced[1])), [hp.frontCenterMid, hp.backCenterMid], rev(flatArc(bridge.replaced[0]))).map(cp);
    var cHem = yAtX(hemCs, X0);
    var kmin = function (h) { var m = Infinity; for (var i = 0; i <= 240; i++) m = Math.min(m, kappa(h, i / 240)); return m; };
    var deg = function (a) { return a * 180 / Math.PI; };
    return {
      ok: true,
      // capSplit: 소매산 앞/뒤 계측 분할 기준 = 소매 중심선(가운데 틈의 이등분선) x — 공용 측정(designSleeve.capPrimitives)이 이 세로선과 최종 소매산의 교점에서 나눈다.
      geometry: { outline: outline, construction: construction, capSplit: { x: X0 } },
      meta: {
        rule: "pattern-school-p46-short-puff-sleeve-M(2026-10-20)",
        widthCm: W, sleeveLengthCm: r.sleeveLengthCm, hemCm: hemCm, hemBeforeCm: W,
        cuff: { upperArmCm: arm, lengthCm: cuff, widthCm: CUFF_WIDTH, rule: "위팔 둘레 + 4 · 폭 1cm — 치수 정보(별도 조각 아님)" },
        formula: { square: square, spread: spread, unit: u, units: UNITS, ratios: [OUTER_UNITS, INNER_UNITS, CENTER_UNITS, INNER_UNITS, OUTER_UNITS], gatherRatio: GATHER_RATIO, cuts: CUTS, parallelEachSideCm: half,
          note: "■ = Ⓐ 소매폭 − ●(부호 그대로) · ∅ = 0.7● − ■ = 1.7● − W · ⊠ = ∅/10 · 틈(현) 뒤 → 앞 ⊠ · 2⊠ · 4⊠ · 2⊠ · ⊠ — 책 «2 정도»는 예시" },
        flare: { totalCm: spread, unitCm: u, centerCm: gapC, innerCm: gapI, outerCm: gapO, cuts: CUTS, openedCm: opened,
          measure: "각 틈의 두 밑단 끝점 사이 직선 거리(현)", order: "가운데 평행(좌우 2⊠) → 중심 쪽 조각 고정 → 중간 조각(안쪽 기준점) → 바깥 조각(함께 운반된 바깥 기준점)" },
        rise: { cm: rise, top: cp(top), spBefore: cp(SP), note: "새 소매산 꼭대기 = 원래 높이 + 상승(설정값 0.5 — 개더 계수 0.7 과 별개)" },
        reference: { fixed: "틈 이등분선(원래 중심선 x) · 각 반쪽의 중심 쪽 조각(평행 이동 뒤 고정)", notFixed: "O·SP — 중심선 절개로 두 조각으로 갈라짐" },
        pivots: { backInner: cp(Pb1M), backOuter: cp(Pb2M), frontInner: cp(Pf1M), frontOuter: cp(Pf2M),
          backInnerBefore: cp(Pb1), backOuterBefore: cp(Pb2), frontInnerBefore: cp(Pf1), frontOuterBefore: cp(Pf2), spBack: cp(TB(SP)), spFront: cp(TF(SP)) },
        rotationDeg: { backMid: deg(b1B), backOuterRelative: deg(b2B), backOuterTotal: deg(b1B + b2B), frontMid: deg(b1F), frontOuterRelative: deg(b2F), frontOuterTotal: deg(b1F + b2F), center: 0 },
        cutX: { backInner: xb1, backOuter: xb2, frontInner: xf1, frontOuter: xf2 },
        hemPoints: hp,
        seams: { backCm: dist(UbM, hp.backOuter), frontCm: dist(UfM, hp.frontOuter) },
        redraw: { status: "잠정 구현값(책 수치 아님)",
          center: { ellCm: bridge.ell, rule: "가장 작은 구간부터(0 → 0.5 · 0.25 씩) — 곡률 부호 한쪽(불감대 없음) · 꼭대기 위로 안 넘음 · 양 끝 G1 · 꼭대기 수평", from: cp(bridge.h[0][0]), to: cp(bridge.h[1][3]) },
          kinks: { ellChosenCm: { Pb2: rd.windows[0].ell, Pb1: rd.windows[1].ell, Pf1: rd.windows[2].ell, Pf2: rd.windows[3].ell },
            windows: { Pb2: rd.windows[0].w, Pb1: rd.windows[1].w, Pf1: rd.windows[2].w, Pf2: rd.windows[3].w },
            kinkDegRaw: { Pb2: deg(b2B), Pb1: deg(b1B), Pf1: deg(b1F), Pf2: deg(b2F) }, rule: "ℓ 2cm 시작, 구간 내부 S 면 0.25cm 씩 축소(최소 0.5) · 인접 호의 40% 이내",
            curvatureMin: { Pb2: kmin(rd.hermites[0]), Pb1: kmin(rd.hermites[1]), Pf1: kmin(rd.hermites[2]), Pf2: kmin(rd.hermites[3]) } },
          joins: rd.joins, continuity: "G1(곡률 연속 아님)" },
        hem: { points: hemPts.map(cp), lengthCm: hemCm, polylineCm: (function () { var t = 0; for (var i = 1; i < hemPts.length; i++) t += dist(hemPts[i - 1], hemPts[i]); return t; })(),
          gatherCm: hemCm - cuff, gatherRatio: (hemCm - cuff) / cuff, formulaHemCm: (1 + GATHER_RATIO) * cuff, formulaGatherCm: GATHER_RATIO * cuff,
          fair: { method: "오목 제어다각형 3차 B-spline truing(Ⓗ·Ⓘ·Ⓚ·Ⓛ 와 같은 방법) — 양 끝 고정 · C2 · 변곡 없음", approvedBy: "김님 2026-10-20 Ⓜ 2)(소맷부리 자연 곡선 · 약간 파임/덧댐 허용)",
            maxCutCm: maxCut, maxOutwardCm: maxOut, corners: corner, areaCutCm2: areaCut, areaAddedCm2: areaAdd, inflections: hemInfl,
            curvatureJumpMax: kJump, g1MaxDeg: hemG1, controlPolygon: fairR.ctrl },
          status: "화면 검토용 시안(최종 형상 승인 전)" },
        centerLength: { inputCm: r.sleeveLengthCm, spreadCm: fin(cHem) ? cHem - top.y : null, note: "입력 소매길이(SP → 출발 밑단) vs 펼친 중심(새 꼭대기 → 소맷부리 곡선 × 중심선)" },
        fill: { center: fillCenter, note: "가운데 틈 + 소매산 정리로 덧댄 종이(표시용)" },
        rigid: { cap: pathOf(bo.concat(bm, bc)), capFront: pathOf(fc.concat(fm, fo)), hemPoints: hemPts.map(cp), pieces: pieces, note: "평행 이동·회전 직후의 원래 종이 6조각(감사·표시용) — 최종 geometry 가 권위값" },
        sp: cp(top), spBefore: cp(SP), capSplit: { point: cp(top) },
        underarm: { before: { back: cp(Ub), front: cp(Uf) }, after: { back: cp(UbM), front: cp(UfM) } },
        capLengths: { back: capBack, front: capFront, total: capTotal, measure: "Gauss-Legendre(final curve) · 앞/뒤 분할 = 새 꼭대기(틈 이등분선)" },
        capLengthsA: capA,
        armholeCm: ah ? { back: ah.back, front: ah.front } : null,
        easeA: ah ? { back: capA.back - ah.back, front: capA.front - ah.front, total: capA.total - ah.back - ah.front } : null,
        addedGather: { back: capBack - capA.back, front: capFront - capA.front, total: capTotal - capA.total },
        totalOverAH: ah ? { back: capBack - ah.back, front: capFront - ah.front, total: capTotal - ah.back - ah.front } : null,
        easeAfter: ah ? { back: capBack - ah.back, front: capFront - ah.front, total: capTotal - ah.back - ah.front } : null,
        easeSourceA: am.easeAfter ? JSON.parse(JSON.stringify(am.easeAfter)) : null,
        checks: { closed: true, connected: true, maxGapCm: Math.max(joinGap, closeGap), selfIntersection: false, singlePiece: true, piecesOverlap: false, maxG1BreakDeg: Math.max(capG1, hemG1) }
      },
      warnings: [],
      sourceSleeveAHash: hashStr(JSON.stringify({ geometry: sleeveA.geometry, meta: sleeveA.meta }))
    };
  }

  window.designSleeveM = Object.freeze({ draftSleeveM: draftSleeveM, readSleeveA: readSleeveA,
    RULES: Object.freeze({ upperArmDefaultCm: UPPER_ARM_DEFAULT, sleeveLengthDefaultCm: SLEEVE_LENGTH_DEFAULT, riseDefaultCm: RISE_DEFAULT, cuffAddCm: CUFF_ADD, cuffWidthCm: CUFF_WIDTH,
      gatherRatio: GATHER_RATIO, units: UNITS, ratios: Object.freeze([OUTER_UNITS, INNER_UNITS, CENTER_UNITS, INNER_UNITS, OUTER_UNITS]), cuts: CUTS,
      redrawEllCm: REDRAW_ELL, redrawMinCm: REDRAW_MIN, redrawStepCm: REDRAW_STEP, redrawRatio: REDRAW_RATIO, bridgeMinCm: BRIDGE_MIN, bridgeStepCm: BRIDGE_STEP, bridgeMaxRatio: BRIDGE_MAX_RATIO, maxRotationRad: MAX_ROTATION }) });
})();
