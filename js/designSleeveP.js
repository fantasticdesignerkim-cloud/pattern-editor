// ══════════════════════════════════════════════
// designSleeveP.js — 소매 Ⓟ 반소매 플레어([패턴학교] P.48 «소맷부리를 잘라서 벌린다(플레어 슬리브)»). 순수.
//   (공용 도구는 designSleeveM.js 와 같은 것 — 꺾임 국소 재제도 · 소맷부리 truing.)
//
// 김님 확정(2026-10-26, docs/book/P048.md § Ⓟ):
//   · 출발 = 같은 몸판의 짧은 Ⓐ(소매길이 기본 20 = SP → 출발 밑단, 수정 가능 · 읽기 전용).
//   · ● = Ⓐ 소매 전체 폭 W(책 «잘라서 벌리기 전 소매 폭») · ∅ = W × 플레어 계수(기본 0.7 — 수정 가능 설정값) · ⊠ = ∅/10.
//     틈(소맷부리 현)은 1:2:4:2:1 로 자동 계산 — 가운데 전체 4⊠ · 안쪽 각 2⊠ · 바깥 각 ⊠ (⊠ 를 따로 입력하지 않는다). 책 «(2 정도)» 는 예시.
//   · 절개 = 앞·뒤 반폭 각 3등분선 2개씩 + 소매 중심선 = 5개 → 원래 종이 6조각.
//   · 이동 순서: ① 가운데 두 조각을 SP 대칭 쐐기로 ±α(가운데 전체 현 = 4⊠) — 중간·바깥 조각도 함께 운반
//                ② 중간 조각을 운반된 안쪽 기준점(절개선 × 소매산)에서 β1(현 2⊠) — 바깥 조각 함께 운반
//                ③ 바깥 조각을 운반된 바깥 기준점에서 β2(현 ⊠). O 는 중심 절개로 갈라짐 — 기준 = SP · 틈 이등분선.
//     Ⓜ 의 가운데 평행 벌림 · 상승 · 위팔/커프스/개더 입력은 없다.
//   · 마무리: 소매산 꺾임 5곳(뒤 바깥 · 뒤 안쪽 · SP · 앞 안쪽 · 앞 바깥) 국소 재제도(Ⓛ·Ⓜ 와 같은 잠정 구현값) ·
//     소맷부리 전체 자연 곡선 truing(약간 파임·덧댐 허용). 산식(1.7W)에 맞추려고 형상을 보정하지 않는다 — 실측과 편차를 기록한다.
// raw 강체 조각(meta.rigid.pieces 6)·틈·최종 외곽 분리. 길이는 최종 곡선 실측. 앞/뒤 분할 = geometry.capSplit(x = SP.x).
// 회전 45° 는 설정된 수치 가드(책 규칙·물리 불가 아님).
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var FLARE_RATIO_DEFAULT = 0.7, SLEEVE_LENGTH_DEFAULT = 20;   // 책 기본 설정값(수정 가능)
  var UNITS = 10, CENTER_UNITS = 4, INNER_UNITS = 2, OUTER_UNITS = 1;   // ⊠ = ∅/10 · 1 : 2 : 4 : 2 : 1(책)
  var CUTS = 5;
  var REDRAW_ELL = 2.0;               // 소매산 재제도 구간(잠정 구현값 — 책 수치 아님)
  var REDRAW_RATIO = 0.4;             // 재제도 구간 ≤ 인접 호의 40% (잠정)
  var REDRAW_MIN = 0.5, REDRAW_STEP = 0.25;
  var JOIN = 1e-9, TOL = 1e-6;
  var G1_TOL_DEG = 1e-9;
  var KAPPA_DEAD = 0.01;              // 변곡 판정 불감대(/cm, 검증 설정)
  var FLAT_N = 24;
  var MAX_ROTATION = Math.PI / 4;     // 회전 한계(45°) — 지원 범위 수치 가드(책 수치 아님)
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

  // 입력: sleeveA = 짧은 Ⓐ(draftSleeveA 결과). params = { flareRatio } — 없으면 책 기본 0.7. 값은 고쳐 쓰지 않는다.
  function draftSleeveP(sleeveA, params) {
    var p = params || {};
    var ratio = p.flareRatio === undefined || p.flareRatio === null ? FLARE_RATIO_DEFAULT : p.flareRatio;
    if (!fin(ratio) || !(ratio > 0)) return fail("invalid-flare-ratio", ratio);
    var r = readSleeveA(sleeveA);
    if (!r.ok) return r;
    var cubs = r.cubics, Ub = r.Ub, Uf = r.Uf, H = r.hemY, W = r.W, XL = Ub.x, XR = Uf.x, SP = cp(r.sp), X0 = SP.x;
    var spread = W * ratio, u = spread / UNITS;   // ● = W · ∅ = ● × 계수 · ⊠ = ∅/10
    var gapC = CENTER_UNITS * u, gapI = INNER_UNITS * u, gapO = OUTER_UNITS * u;
    // 반폭 3등분 절개선: 안쪽(중심에서 1/3) · 바깥쪽(2/3)
    var xb1 = X0 + (XL - X0) / 3, xb2 = X0 + 2 * (XL - X0) / 3, xf1 = X0 + (XR - X0) / 3, xf2 = X0 + 2 * (XR - X0) / 3;
    var s1 = splitListAtX(cubs, xb2), s2 = s1 && splitListAtX(s1[1], xb1), s3 = s2 && splitListAtX(s2[1], X0), s4 = s3 && splitListAtX(s3[1], xf1), s5 = s4 && splitListAtX(s4[1], xf2);
    if (!s5) return fail("no-cap-intersection");
    var arcs = { bo: s1[0], bm: s2[0], bc: s3[0], fc: s4[0], fm: s5[0], fo: s5[1] };
    var Pb2 = cp(arcs.bo[arcs.bo.length - 1][3]), Pb1 = cp(arcs.bm[arcs.bm.length - 1][3]), Pf1 = cp(arcs.fc[arcs.fc.length - 1][3]), Pf2 = cp(arcs.fm[arcs.fm.length - 1][3]);
    var at = function (x) { return { x: x, y: H }; };
    var B0 = at(XL), Cb2 = at(xb2), Cb1 = at(xb1), Cm = at(X0), Cf1 = at(xf1), Cf2 = at(xf2), F0 = at(XR);
    // ① 가운데 두 조각: SP 중심 대칭 회전 ±α — 두 밑단 끝점(중심선 쪽) 사이 현 = 4⊠. 중간·바깥 조각도 함께 운반된다(부모 변환).
    var Rc = dist(SP, Cm);
    if (!(gapC / 2 < Rc)) return fail("flare-too-large", { which: "center", cm: gapC }, true);
    var alpha = Math.asin((gapC / 2) / Rc);
    var RCb = function (q) { return rotP(q, +alpha, SP); }, RCf = function (q) { return rotP(q, -alpha, SP); };
    // ② 중간 조각: 운반된 안쪽 기준점 중심 β1 — 현 2⊠
    var Pb1M = RCb(Pb1), Pf1M = RCf(Pf1), Rb1 = dist(Pb1M, RCb(Cb1)), Rf1 = dist(Pf1M, RCf(Cf1));
    if (!(gapI < 2 * Rb1 && gapI < 2 * Rf1)) return fail("flare-too-large", { which: "inner", cm: gapI }, true);
    var b1B = 2 * Math.asin(gapI / (2 * Rb1)), b1F = 2 * Math.asin(gapI / (2 * Rf1));
    var MB = function (q) { return rotP(RCb(q), +b1B, Pb1M); }, MF = function (q) { return rotP(RCf(q), -b1F, Pf1M); };
    // ③ 바깥 조각: 운반된 바깥 기준점 중심 β2 — 현 ⊠
    var Pb2M = MB(Pb2), Pf2M = MF(Pf2), Rb2 = dist(Pb2M, MB(Cb2)), Rf2 = dist(Pf2M, MF(Cf2));
    if (!(gapO < 2 * Rb2 && gapO < 2 * Rf2)) return fail("flare-too-large", { which: "outer", cm: gapO }, true);
    var b2B = 2 * Math.asin(gapO / (2 * Rb2)), b2F = 2 * Math.asin(gapO / (2 * Rf2));
    var totB = alpha + b1B + b2B, totF = alpha + b1F + b2F;
    if (!(totB <= MAX_ROTATION && totF <= MAX_ROTATION)) {   // 설정된 수치 가드(45° — 책 규칙 아님): 물리적 불가능 판정이 아니다
      var rg = fail("rotation-too-large", { deg: Math.max(totB, totF) * 180 / Math.PI, limitDeg: MAX_ROTATION * 180 / Math.PI, kind: "numeric-guard" }, true);
      rg.numericGuard = true; return rg;
    }
    var OB = function (q) { return rotP(MB(q), +b2B, Pb2M); }, OF = function (q) { return rotP(MF(q), -b2F, Pf2M); };
    var mapList = function (cs, f) { return cs.map(function (q) { return q.map(f); }); };
    var bo = mapList(arcs.bo, OB), bm = mapList(arcs.bm, MB), bc = mapList(arcs.bc, RCb), fc = mapList(arcs.fc, RCf), fm = mapList(arcs.fm, MF), fo = mapList(arcs.fo, OF);
    var hp = { frontOuter: OF(F0), frontOuterIn: OF(Cf2), frontMidOut: MF(Cf2), frontMidIn: MF(Cf1), frontCenterOut: RCf(Cf1), frontCenterMid: RCf(Cm),
      backCenterMid: RCb(Cm), backCenterOut: RCb(Cb1), backMidIn: MB(Cb1), backMidOut: MB(Cb2), backOuterIn: OB(Cb2), backOuter: OB(B0) };
    var opened = { backOuter: dist(hp.backOuterIn, hp.backMidOut), backInner: dist(hp.backMidIn, hp.backCenterOut), center: dist(hp.backCenterMid, hp.frontCenterMid),
      frontInner: dist(hp.frontCenterOut, hp.frontMidIn), frontOuter: dist(hp.frontMidOut, hp.frontOuterIn) };
    if (!(hp.backOuterIn.x < hp.backMidOut.x && hp.backMidIn.x < hp.backCenterOut.x && hp.backCenterMid.x < hp.frontCenterMid.x && hp.frontMidIn.x > hp.frontCenterOut.x && hp.frontOuterIn.x > hp.frontMidOut.x))
      return fail("flare-direction");
    var UbM = OB(Ub), UfM = OF(Uf);

    // ④ 소매산 꺾임 5곳 국소 재제도(Ⓛ·Ⓜ 와 같은 도구 · 잠정 구현값)
    var LBo = cubicsLen(bo), LBm = cubicsLen(bm), LBc = cubicsLen(bc), LFc = cubicsLen(fc), LFm = cubicsLen(fm), LFo = cubicsLen(fo);
    var RAW = bo.concat(bm, bc, fc, fm, fo);
    var rd = redrawKinks(RAW, [{ s: LBo, adjL: LBo, adjR: LBm }, { s: LBo + LBm, adjL: LBm, adjR: LBc }, { s: LBo + LBm + LBc, adjL: LBc, adjR: LFc },
      { s: LBo + LBm + LBc + LFc, adjL: LFc, adjR: LFm }, { s: LBo + LBm + LBc + LFc + LFm, adjL: LFm, adjR: LFo }]);
    if (rd.error) return fail(rd.error, null, rd.error === "redraw-inflection-unavoidable");
    var cap = rd.cap, joinGap = 0, joinG1 = 0;
    rd.joins.forEach(function (j) { joinGap = Math.max(joinGap, j.gapCm); joinG1 = Math.max(joinG1, j.g1Deg); });
    if (!(joinGap < JOIN)) return fail("discontinuous", joinGap);
    if (!(joinG1 <= G1_TOL_DEG)) return fail("redraw-g1-break", joinG1);
    var kTop = Infinity; for (var it0 = 0; it0 <= 240; it0++) kTop = Math.min(kTop, kappa(rd.hermites[2], it0 / 240));
    if (kTop < -KAPPA_DEAD) return fail("cap-top-concave", { curvatureMin: kTop, deadband: KAPPA_DEAD, kinkDeg: 2 * alpha * 180 / Math.PI }, true);
    var preserved = 0, ptAt = function (cs, s) { var sp_ = splitListAtLen(cs, s); return sp_[1].length ? sp_[1][0][0] : sp_[0][sp_[0].length - 1][3]; };
    var starts = [0].concat(rd.windows.map(function (w) { return w.b; }));
    rd.kept.forEach(function (seg, k) { var L0 = cubicsLen(seg); for (var t = 1; t < 6; t++) { var sl = L0 * t / 6; preserved = Math.max(preserved, dist(ptAt(seg, sl), ptAt(RAW, starts[k] + sl))); } });
    // 국소 S(내부 변곡) 검사: 각 재제도 구간의 변곡 수 ≤ 원래 호가 가진 변곡 수(redrawKinks 규칙) — 결과 기록
    var kmin = function (h) { var m = Infinity; for (var i = 0; i <= 240; i++) m = Math.min(m, kappa(h, i / 240)); return m; };
    var deg = function (a) { return a * 180 / Math.PI; };

    // ⑤ 소맷부리: 여섯 조각 밑단 끝점 12점(앞 바깥 → 뒤 바깥) — 전체를 자연 곡선으로(약간 파임·덧댐 허용 · 변곡 없음 · 곡률 연속)
    var hemPts = [hp.frontOuter, hp.frontOuterIn, hp.frontMidOut, hp.frontMidIn, hp.frontCenterOut, hp.frontCenterMid, hp.backCenterMid, hp.backCenterOut, hp.backMidIn, hp.backMidOut, hp.backOuterIn, hp.backOuter];
    var fairR = fairHem(hemPts), hemCs = fairR.bz;
    var hemG1 = 0, kJump = 0; for (var hi = 1; hi < hemCs.length; hi++) { hemG1 = Math.max(hemG1, angleBetween(cubicD1(hemCs[hi - 1], 1), cubicD1(hemCs[hi], 0))); kJump = Math.max(kJump, Math.abs(kappa(hemCs[hi - 1], 1) - kappa(hemCs[hi], 0))); }
    if (!(hemG1 <= G1_TOL_DEG)) return fail("hem-g1-break", hemG1);
    var hk = []; hemCs.forEach(function (q) { for (var i = 0; i <= 120; i++) hk.push(kappa(q, i / 120)); });
    var hemInfl = inflectionCount(hk);
    if (hemInfl > 0) return fail("hem-fair-inflection", hemInfl, true);
    var corner = hemPts.slice(1, -1).map(function (q) { return { at: cp(q), dyCm: yAtX(hemCs, q.x) - q.y }; });
    var maxCut = Math.max(0, -Math.min.apply(null, corner.map(function (c) { return c.dyCm; }))), maxOut = Math.max(0, Math.max.apply(null, corner.map(function (c) { return c.dyCm; })));
    var areaCut = 0, areaAdd = 0;   // 원래 종이 조각 아래변 6개와 곡선 사이(틈은 원래 덧댄 종이) — 최대 파임·덧댐도 변 전체에서
    [[0, 1], [2, 3], [4, 5], [6, 7], [8, 9], [10, 11]].forEach(function (e) { var a = hemPts[e[0]], b = hemPts[e[1]];
      for (var ia = 0; ia < 200; ia++) { var tt = (ia + 0.5) / 200, xm = a.x + (b.x - a.x) * tt, dyA = yAtX(hemCs, xm) - (a.y + (b.y - a.y) * tt), dxA = Math.abs(b.x - a.x) / 200;
        if (dyA < 0) { areaCut += -dyA * dxA; maxCut = Math.max(maxCut, -dyA); } else { areaAdd += dyA * dxA; maxOut = Math.max(maxOut, dyA); } } });

    // 소매산 앞/뒤 분할: SP 재제도 구간(가운데 Hermite) × 소매 중심선 x = SP.x(틈 이등분선)
    var hSP = rd.hermites[2], lo = 0, hi2 = 1;
    for (var it = 0; it < 90; it++) { var m1 = (lo + hi2) / 2; if (cubicAt(hSP, m1).x < X0) lo = m1; else hi2 = m1; }
    var tTop = (lo + hi2) / 2, hsplit = splitAt(hSP, tTop);
    if (!(tTop > 1e-6 && tTop < 1 - 1e-6)) return fail("cap-split-failed");
    var capOut = [];
    cap.forEach(function (q) { if (q === hSP) { capOut.push(hsplit[0]); capOut.push(hsplit[1]); } else capOut.push(q); });
    var iTop = capOut.indexOf(hsplit[0]), top = cp(hsplit[0][3]);
    var outline = [pathOf(capOut, "cap"), L(UfM, hp.frontOuter, "side-seam-front"), pathOf(hemCs, "hem"), L(hp.backOuter, UbM, "side-seam-back")];
    var loop = flattenCubics(capOut, FLAT_N);
    loop.push(cp(hp.frontOuter)); flattenCubics(hemCs, FLAT_N).slice(1).forEach(function (q) { loop.push(q); }); loop.push(cp(UbM));
    var closeGap = dist(loop[loop.length - 1], loop[0]);
    if (!(closeGap < JOIN)) return fail("discontinuous", closeGap);
    if (loopSelfIntersects(loop)) return fail("self-intersection", null, true);
    var construction = [
      L(SP, { x: X0, y: H }, "center-line"),   // 소매 중심선 = 가운데 틈의 이등분선(x = SP.x · 대칭)
      L(SP, hp.backCenterMid, "cut-center-back"), L(SP, hp.frontCenterMid, "cut-center-front"),
      L(Pb1M, hp.backCenterOut, "cut-axis-back-inner"), L(Pb1M, hp.backMidIn, "cut-edge-back-inner"), L(Pb2M, hp.backMidOut, "cut-axis-back-outer"), L(Pb2M, hp.backOuterIn, "cut-edge-back-outer"),
      L(Pf1M, hp.frontCenterOut, "cut-axis-front-inner"), L(Pf1M, hp.frontMidIn, "cut-edge-front-inner"), L(Pf2M, hp.frontMidOut, "cut-axis-front-outer"), L(Pf2M, hp.frontOuterIn, "cut-edge-front-outer")
    ];

    // 원래 종이 6조각(실제 강체 변환 그대로 — 표시·감사용) · 조각끼리 겹치면(기준점 밖 교차) 막는다
    var flatArc = function (cs) { var o = []; cs.forEach(function (q, i) { for (var k = (i ? 1 : 0); k <= 24; k++) o.push(cubicAt(q, k / 24)); }); return o; };
    var pieceOf = function (arc, extra, f) { return flatArc(arc).concat(extra).map(function (q) { return cp(f(q)); }); };
    var pieces = { backOuter: pieceOf(arcs.bo, [Cb2, B0], OB), backMid: pieceOf(arcs.bm, [Cb1, Cb2], MB), backCenter: pieceOf(arcs.bc, [Cm, Cb1], RCb),
      frontCenter: pieceOf(arcs.fc, [Cf1, Cm], RCf), frontMid: pieceOf(arcs.fm, [Cf2, Cf1], MF), frontOuter: pieceOf(arcs.fo, [F0, Cf2], OF) };
    var pk = ["backOuter", "backMid", "backCenter", "frontCenter", "frontMid", "frontOuter"], touch = [Pb2M, Pb1M, SP, Pf1M, Pf2M];
    var nearTouch = function (q) { return touch.some(function (t) { return dist(q, t) < 1e-6; }); };
    for (var pa = 0; pa < pk.length; pa++) for (var pb2 = pa + 1; pb2 < pk.length; pb2++) {
      var A1 = pieces[pk[pa]].concat([pieces[pk[pa]][0]]), B1 = pieces[pk[pb2]].concat([pieces[pk[pb2]][0]]);
      for (var ia1 = 1; ia1 < A1.length; ia1++) for (var ib1 = 1; ib1 < B1.length; ib1++) {
        var a0 = A1[ia1 - 1], a1 = A1[ia1], c0 = B1[ib1 - 1], c1 = B1[ib1];
        if (nearTouch(a0) || nearTouch(a1) || nearTouch(c0) || nearTouch(c1)) continue;
        if (segCross(a0, a1, c0, c1)) return fail("pieces-overlap", { pieces: [pk[pa], pk[pb2]] }, true);
      }
    }

    var capBack = cubicsLen(capOut.slice(0, iTop + 1)), capFront = cubicsLen(capOut.slice(iTop + 1)), capTotal = capBack + capFront;
    var ahc = r.armholeCm, ah = (ahc && fin(ahc.back) && fin(ahc.front)) ? ahc : null;
    var hemCm = cubicsLen(hemCs), am = sleeveA.meta, formulaHem = W * (1 + ratio);
    var cHem = yAtX(hemCs, X0);
    // Ⓐ 소매산의 기준점 곡률(원래 볼록이었는지 — 오목 꺾임 판정용): 각 기준점에서 끝나는 원래 호의 끝 곡률
    var kA = [arcs.bo, arcs.bm, arcs.bc, arcs.fc, arcs.fm].map(function (cs) { return kappa(cs[cs.length - 1], 1); });
    var names = ["Pb2", "Pb1", "SP", "Pf1", "Pf2"], byName = function (f) { var o = {}; names.forEach(function (n, i) { o[n] = f(i); }); return o; };
    return {
      ok: true,
      geometry: { outline: outline, construction: construction, capSplit: { x: X0 } },
      meta: {
        rule: "pattern-school-p48-short-flare-sleeve-P(2026-10-26)",
        widthCm: W, sleeveLengthCm: r.sleeveLengthCm, hemCm: hemCm, hemBeforeCm: W,
        settings: { flareRatio: ratio, defaults: { sleeveLengthCm: SLEEVE_LENGTH_DEFAULT, flareRatio: FLARE_RATIO_DEFAULT }, note: "플레어 계수 = 책 기본 0.7(수정 가능 설정값) · 틈 비율 1:2:4:2:1 은 자동(⊠ 독립 입력 없음)" },
        formula: { widthCm: W, ratio: ratio, spread: spread, unit: u, units: UNITS, ratios: [OUTER_UNITS, INNER_UNITS, CENTER_UNITS, INNER_UNITS, OUTER_UNITS], cuts: CUTS,
          note: "● = Ⓐ 소매 전체 폭 W · ∅ = ● × 계수 · ⊠ = ∅/10 · 틈(현) 뒤 → 앞 ⊠ · 2⊠ · 4⊠ · 2⊠ · ⊠ — 책 «(2 정도)» 는 예시" },
        flare: { totalCm: spread, unitCm: u, centerCm: gapC, innerCm: gapI, outerCm: gapO, cuts: CUTS, openedCm: opened,
          measure: "각 틈의 두 밑단 끝점 사이 직선 거리(현)", order: "가운데 SP 대칭(중간·바깥 조각 함께 운반) → 중간 조각(운반된 안쪽 기준점) → 바깥 조각(운반된 바깥 기준점)" },
        reference: { fixed: "SP · 틈 이등분선(x = SP.x)", notFixed: "O(중심선 × 위팔선) — 중심 절개로 갈라짐" },
        pivots: { sp: cp(SP), backInner: cp(Pb1M), backOuter: cp(Pb2M), frontInner: cp(Pf1M), frontOuter: cp(Pf2M),
          backInnerBefore: cp(Pb1), backOuterBefore: cp(Pb2), frontInnerBefore: cp(Pf1), frontOuterBefore: cp(Pf2) },
        rotationDeg: { center: deg(alpha), backMid: deg(b1B), backOuterRelative: deg(b2B), backOuterTotal: deg(totB), frontMid: deg(b1F), frontOuterRelative: deg(b2F), frontOuterTotal: deg(totF) },
        cutX: { backInner: xb1, backOuter: xb2, frontInner: xf1, frontOuter: xf2 },
        hemPoints: hp,
        seams: { backCm: dist(UbM, hp.backOuter), frontCm: dist(UfM, hp.frontOuter) },
        redraw: { status: "잠정 구현값(책 수치 아님) — ℓ 2cm 시작, 구간 내부 S 면 0.25cm 씩 축소(최소 0.5) · 인접 호의 40% 이내",
          ellChosenCm: byName(function (i) { return rd.windows[i].ell; }), windows: byName(function (i) { return rd.windows[i].w; }),
          kinkDegRaw: { Pb2: deg(b2B), Pb1: deg(b1B), SP: deg(2 * alpha), Pf1: deg(b1F), Pf2: deg(b2F) },
          originalInflections: byName(function (i) { return rd.windows[i].origInflections; }), curvatureMin: byName(function (i) { return kmin(rd.hermites[i]); }),
          // 오목 꺾임(관찰): 바깥으로 돌린 조각의 기준점에서 소매산이 오목하게 꺾이면(강체 회전의 귀결 — Ⓓ 와 같은 현상) 재제도 구간도 오목 호가 되어
          //   양옆 볼록 호와 함께 국소 S 가 생긴다. 형상을 억지로 볼록하게 바꾸지 않고 위치만 기록한다(처리 방식은 김님 판단 대기).
          concaveDents: names.filter(function (n, i) { return kmin(rd.hermites[i]) < -KAPPA_DEAD && kA[i] > KAPPA_DEAD; }),
          curvatureAAtPivot: byName(function (i) { return kA[i]; }),
          joins: rd.joins, preservedMaxCm: preserved, continuity: "G1(곡률 연속 아님)", top: top },
        hem: { points: hemPts.map(cp), lengthCm: hemCm, polylineCm: (function () { var t = 0; for (var i = 1; i < hemPts.length; i++) t += dist(hemPts[i - 1], hemPts[i]); return t; })(),
          formulaHemCm: formulaHem, diffFromFormulaCm: hemCm - formulaHem, startWidthCm: W,
          fair: { method: "오목 제어다각형 3차 B-spline truing(Ⓗ·Ⓘ·Ⓚ·Ⓛ·Ⓜ 와 같은 방법) — 양 끝 고정 · C2 · 변곡 없음", approvedBy: "김님 2026-10-26 Ⓟ ③(소맷부리 자연 곡선 · 약간 파임/덧댐 허용)",
            maxCutCm: maxCut, maxOutwardCm: maxOut, corners: corner, areaCutCm2: areaCut, areaAddedCm2: areaAdd, inflections: hemInfl,
            curvatureJumpMax: kJump, g1MaxDeg: hemG1, controlPolygon: fairR.ctrl },
          status: "화면 검토용 시안(최종 형상 승인 전) — 산식 W(1 + 계수)에 맞추려고 형상을 보정하지 않음" },
        centerLength: { inputCm: r.sleeveLengthCm, spreadCm: fin(cHem) ? cHem - top.y : null, note: "입력 소매길이(SP → 출발 밑단) vs 벌린 뒤 중심(새 꼭대기 → 소맷부리 곡선 × 중심선)" },
        rigid: { cap: pathOf(RAW), hemPoints: hemPts.map(cp), pieces: pieces, note: "강체 회전 직후의 원래 종이 6조각(감사·표시용) — 최종 geometry 가 권위값" },
        sp: cp(top), spBefore: cp(SP), capSplit: { point: cp(top) },
        underarm: { before: { back: cp(Ub), front: cp(Uf) }, after: { back: cp(UbM), front: cp(UfM) } },
        capLengths: { back: capBack, front: capFront, total: capTotal, measure: "Gauss-Legendre(final curve) · 앞/뒤 분할 = 최종 곡선 × 소매 중심선 · 소매산 개더 없음" },
        capLengthsA: am.capLengths ? JSON.parse(JSON.stringify(am.capLengths)) : null,
        armholeCm: ah ? { back: ah.back, front: ah.front } : null,
        easeAfter: ah ? { back: capBack - ah.back, front: capFront - ah.front, total: capTotal - ah.back - ah.front } : null,
        easeSourceA: am.easeAfter ? JSON.parse(JSON.stringify(am.easeAfter)) : null,
        checks: { closed: true, connected: true, maxGapCm: Math.max(joinGap, closeGap), selfIntersection: false, singlePiece: true, piecesOverlap: false, maxG1BreakDeg: Math.max(joinG1, hemG1), preservedMaxCm: preserved }
      },
      warnings: [],
      sourceSleeveAHash: hashStr(JSON.stringify({ geometry: sleeveA.geometry, meta: sleeveA.meta }))
    };
  }

  window.designSleeveP = Object.freeze({ draftSleeveP: draftSleeveP, readSleeveA: readSleeveA,
    RULES: Object.freeze({ sleeveLengthDefaultCm: SLEEVE_LENGTH_DEFAULT, flareRatioDefault: FLARE_RATIO_DEFAULT, units: UNITS, ratios: Object.freeze([OUTER_UNITS, INNER_UNITS, CENTER_UNITS, INNER_UNITS, OUTER_UNITS]),
      cuts: CUTS, redrawEllCm: REDRAW_ELL, redrawMinCm: REDRAW_MIN, redrawStepCm: REDRAW_STEP, redrawRatio: REDRAW_RATIO, g1TolDeg: G1_TOL_DEG, kappaDeadPerCm: KAPPA_DEAD, maxRotationRad: MAX_ROTATION }) });
})();
