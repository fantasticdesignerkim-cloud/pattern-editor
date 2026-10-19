// ══════════════════════════════════════════════
// designSleeveL.js — 소매 Ⓛ 반소매 퍼프([패턴학교] P.46 «소맷부리를 잘라서 벌린다(퍼프 슬리브)»). 순수.
//   (공용 도구는 designSleeveI.js 와 같은 것 — 꺾임 국소 재제도 · 소맷부리 truing.)
//
// 김님 확정(2026-10-13, docs/book/P046.md § Ⓛ):
//   · 출발 = 같은 몸판의 Ⓐ 를 **소매길이 기본 20**(SP → 출발 밑단, 수정 가능)으로 새로 제도한 것(읽기 전용). «위팔선 아래 5» 로 자동 계산·고정하지 않는다.
//   · 절개 3개(앞·뒤 반폭 중점 + 소매 중심선) → 4조각. Ⓘ 처럼 가운데 두 조각을 SP 기준 좌우 대칭으로 먼저 벌리고, 바깥 조각은 함께 움직인 «절개선 × 소매산» 기준점에서 더 벌린다.
//     O(중심선 × 위팔선)는 중심 절개로 갈라진다 — 기준은 SP 와 가운데 틈의 이등분선.
//   · ● = 위팔 둘레(이 책 26 — 기본, 수정 가능) + 4 · ■ = Ⓐ 소매폭 − ● · ∅ = 0.5● − ■ = 1.5● − W · ⊠ = ∅/4.
//     소맷부리 현 거리: 가운데 틈 2⊠ · 양옆 틈 각 ⊠(2 : 1 : 1). 가운데 두 조각의 회전각은 «가운데 전체 틈 = 2⊠» 에 맞춰 구한다(폭을 각도처럼 더하지 않는다).
//     손바닥 · 상승 0.7 · Ⓙ/Ⓚ 계수는 쓰지 않는다. 커프스 폭 1cm 는 치수 정보만.
//   · 마무리: 소매산 꺾임 3곳 국소 재제도(ℓ 2cm 시작 — 잠정 구현값) · 소맷부리 전체를 자연스러운 곡선으로 truing(약간 파임·덧댐 허용).
//   · ■ < 0(커프스 달림이 Ⓐ 소매폭보다 큼)도 **같은 산식으로 허용**(김님 2026-10-19) — ■ 는 부호 있는 산식값 그대로, clamp·치환·출발 폭 확대 없음.
//     막는 것은 실제 기하 문제뿐: 원래 종이 조각 겹침 · 외곽 자기교차 · 소매산 꼭대기의 비정상 오목(불감대 밖 음의 곡률) · 연속성 실패.
//     회전 45° 는 **설정된 수치 가드**(책 규칙 아님) — 그것에만 걸리면 물리적 불가능이 아니라 «수치 가드 초과»로 보고한다.
// raw 강체 조각(meta.rigid.pieces)·덧댐(틈)·최종 외곽을 분리해 둔다. 소매산 길이·이세·소맷부리 길이는 최종 곡선 실측. 앞/뒤 분할 기준 = geometry.capSplit(중심선 x).
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var UPPER_ARM_DEFAULT = 26, CUFF_ADD = 4, CUFF_WIDTH = 1;   // 김님 확정(이 책 위팔 둘레 26 · 커프스 달림 = 위팔 둘레 + 4 · 폭 1)
  var GATHER_RATIO = 0.5;             // 개더 분량 = 커프스 달림의 0.5배(책)
  var UNITS = 4, CENTER_UNITS = 2;    // ∅/4 = ⊠ · 가운데 틈 2⊠ · 양옆 틈 각 ⊠(책 2 : 1 : 1)
  var CUTS = 3;                       // 절개 3개(앞·뒤 반폭 중점 + 소매 중심선)
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

  function draftSleeveL(sleeveA, params) {
    var arm = params && params.upperArmCm !== undefined && params.upperArmCm !== null ? params.upperArmCm : UPPER_ARM_DEFAULT;
    if (!fin(arm) || !(arm > 0)) return fail("invalid-upper-arm", arm);
    var r = readSleeveA(sleeveA);
    if (!r.ok) return r;
    var cubs = r.cubics, Ub = r.Ub, Uf = r.Uf, H = r.hemY, W = r.W, XL = Ub.x, XR = Uf.x, SP = cp(r.sp);
    var cuff = arm + CUFF_ADD, square = W - cuff, flare = GATHER_RATIO * cuff - square, unitGap = flare / UNITS;   // ● · ■ · ∅ = 0.5● − ■ · ⊠ = ∅/4
    var gapC = CENTER_UNITS * unitGap, gap = unitGap;   // 가운데 틈 2⊠ · 양옆 틈 ⊠
    // ■ 는 부호 있는 값 그대로 쓴다(■ < 0 = 커프스 달림이 출발 Ⓐ 소매폭보다 큼 — 김님 승인: 같은 산식 허용). ∅ ≤ 0 이면 벌릴 것이 없다.
    if (!(flare > 0)) return fail("no-spread", { cuff: cuff, hemA: W, spread: flare }, true);
    var xb = (XL + SP.x) / 2, xf = (XR + SP.x) / 2;
    var s1 = splitListAtX(cubs, xb), s2 = s1 && splitListAtX(s1[1], xf), s3 = s2 && splitListAtX(s2[0], SP.x);
    if (!s3) return fail("no-cap-intersection");
    var backOuterArc = s1[0], frontOuterArc = s2[1], backCenterArc = s3[0], frontCenterArc = s3[1];
    var Pb = cp(backOuterArc[backOuterArc.length - 1][3]), Pf = cp(frontOuterArc[0][0]);
    var Cm = { x: SP.x, y: H }, Cb = { x: xb, y: H }, Cf = { x: xf, y: H }, B0 = { x: XL, y: H }, F0 = { x: XR, y: H };
    // ① 가운데 두 조각: SP 중심 대칭 회전 ±α — 두 최종 밑단 끝점(중심선 쪽) 사이 현 = 2·Rc·sin α = 가운데 전체 틈 2⊠
    var Rc = dist(SP, Cm);
    if (!(gapC / 2 < Rc)) return fail("flare-too-large", gapC, true);
    var alpha = Math.asin((gapC / 2) / Rc);
    var RCb = function (p) { return rotP(p, +alpha, SP); }, RCf = function (p) { return rotP(p, -alpha, SP); };   // 뒤 가운데 = 왼쪽, 앞 가운데 = 오른쪽
    // ② 바깥 조각: 부모(가운데 조각) 변환 뒤, 움직인 기준점 중심으로 추가 회전 β — 바깥 안쪽 끝점과 가운데 바깥쪽 끝점 사이 현 = ⊠
    var PbM = RCb(Pb), PfM = RCf(Pf), CbM = RCb(Cb), CfM = RCf(Cf);
    var Rb = dist(PbM, CbM), Rf = dist(PfM, CfM);
    if (!(gap < 2 * Rb && gap < 2 * Rf)) return fail("flare-too-large", gap, true);
    var betaB = 2 * Math.asin(gap / (2 * Rb)), betaF = 2 * Math.asin(gap / (2 * Rf));
    if (!(alpha + betaB <= MAX_ROTATION && alpha + betaF <= MAX_ROTATION)) {   // 설정된 수치 가드(45° — 책 규칙 아님): 물리적 불가능 판정이 아니다
      var rg = fail("rotation-too-large", { deg: (alpha + Math.max(betaB, betaF)) * 180 / Math.PI, limitDeg: MAX_ROTATION * 180 / Math.PI, kind: "numeric-guard" }, true);
      rg.numericGuard = true; return rg;
    }
    var RBo = function (p) { return rotP(RCb(p), +betaB, PbM); }, RFo = function (p) { return rotP(RCf(p), -betaF, PfM); };
    var rotList = function (cs, f) { return cs.map(function (q) { return q.map(f); }); };
    var bo = rotList(backOuterArc, RBo), bc = rotList(backCenterArc, RCb), fc = rotList(frontCenterArc, RCf), fo = rotList(frontOuterArc, RFo);
    var RAW = bo.concat(bc, fc, fo);
    var UbM = RBo(Ub), UfM = RFo(Uf), B0M = RBo(B0), BiM = RBo(Cb), FiM = RFo(Cf), F0M = RFo(F0), CmB = RCb(Cm), CmF = RCf(Cm);
    var openCenter = dist(CmB, CmF), openBack = dist(BiM, CbM), openFront = dist(FiM, CfM);
    if (!(CmB.x < CmF.x && BiM.x < CbM.x && FiM.x > CfM.x)) return fail("flare-direction");

    // ③ 소매산 꺾임 3곳 재제도
    var LBo = cubicsLen(bo), LBc = cubicsLen(bc), LFc = cubicsLen(fc), LFo = cubicsLen(fo);
    var rd = redrawKinks(RAW, [{ s: LBo, adjL: LBo, adjR: LBc }, { s: LBo + LBc, adjL: LBc, adjR: LFc }, { s: LBo + LBc + LFc, adjL: LFc, adjR: LFo }]);
    if (rd.error) return fail(rd.error, null, rd.error === "redraw-inflection-unavoidable");
    var cap = rd.cap, joinGap = 0, joinG1 = 0;
    rd.joins.forEach(function (j) { joinGap = Math.max(joinGap, j.gapCm); joinG1 = Math.max(joinG1, j.g1Deg); });
    if (!(joinGap < JOIN)) return fail("discontinuous", joinGap);
    if (!(joinG1 <= G1_TOL_DEG)) return fail("redraw-g1-break", joinG1);
    // 소매산 꼭대기(SP 재제도 구간)는 볼록해야 한다 — 불감대(KAPPA_DEAD, 검증 설정) 밖의 음의 곡률 = 꼭대기가 오목하게 꺼짐(실제 형상 문제)
    var kTop = Infinity; for (var it0 = 0; it0 <= 240; it0++) kTop = Math.min(kTop, kappa(rd.hermites[1], it0 / 240));
    if (kTop < -KAPPA_DEAD) return fail("cap-top-concave", { curvatureMin: kTop, deadband: KAPPA_DEAD, kinkDeg: 2 * alpha * 180 / Math.PI }, true);
    // 구간 밖 보존: 남긴 조각(kept)이 RAW 의 같은 호 구간과 일치하는지 표본 대조
    var preserved = 0, ptAt = function (cs, s) { var sp_ = splitListAtLen(cs, s); return sp_[1].length ? sp_[1][0][0] : sp_[0][sp_[0].length - 1][3]; };
    var starts = [0].concat(rd.windows.map(function (w) { return w.b; }));
    rd.kept.forEach(function (seg, k) { var L0 = cubicsLen(seg); for (var t = 1; t < 6; t++) { var sl = L0 * t / 6; preserved = Math.max(preserved, dist(ptAt(seg, sl), ptAt(RAW, starts[k] + sl))); } });
    var kinkDeg = { Pb: betaB * 180 / Math.PI, SP: 2 * alpha * 180 / Math.PI, Pf: betaF * 180 / Math.PI };
    var kmin = function (h) { var m = Infinity; for (var i = 0; i <= 240; i++) m = Math.min(m, kappa(h, i / 240)); return m; };

    // 소맷부리: 네 조각 밑단 끝점 8점(앞 바깥 → … → 뒤 바깥). Ⓗ 와 같은 truing(김님 승인 — 조금 파내거나 덧댐 허용, 변곡 없음·곡률 연속).
    var hemPts = [F0M, FiM, CfM, CmF, CmB, CbM, BiM, B0M];
    var raw8 = throughCurve(hemPts), raw8Cm = cubicsLen(raw8);
    var fairR = fairHem(hemPts), hemCs = fairR.bz;
    var hemG1 = 0, kJump = 0; for (var hi = 1; hi < hemCs.length; hi++) { hemG1 = Math.max(hemG1, angleBetween(cubicD1(hemCs[hi - 1], 1), cubicD1(hemCs[hi], 0))); kJump = Math.max(kJump, Math.abs(kappa(hemCs[hi - 1], 1) - kappa(hemCs[hi], 0))); }
    if (!(hemG1 <= G1_TOL_DEG)) return fail("hem-g1-break", hemG1);
    var hk = []; hemCs.forEach(function (q) { for (var i = 0; i <= 120; i++) hk.push(kappa(q, i / 120)); });
    var hemInfl = inflectionCount(hk);
    if (hemInfl > 0) return fail("hem-fair-inflection", hemInfl, true);
    var corner = hemPts.slice(1, -1).map(function (q) { return { at: cp(q), dyCm: yAtX(hemCs, q.x) - q.y }; });
    var maxCut = Math.max(0, -Math.min.apply(null, corner.map(function (c) { return c.dyCm; }))), maxOut = Math.max(0, Math.max.apply(null, corner.map(function (c) { return c.dyCm; })));
    var areaCut = 0, areaAdd = 0;   // 원래 종이 조각 아래변(0–1 · 2–3 · 4–5 · 6–7)과 곡선 사이만(틈은 원래 덧댄 종이). Ⓛ: 최대 파임·덧댐도 모서리만이 아니라 변 전체에서 잰다(사실대로).
    [[0, 1], [2, 3], [4, 5], [6, 7]].forEach(function (e) { var a = hemPts[e[0]], b = hemPts[e[1]];
      for (var ia = 0; ia < 200; ia++) { var tt = (ia + 0.5) / 200, xm = a.x + (b.x - a.x) * tt, dyA = yAtX(hemCs, xm) - (a.y + (b.y - a.y) * tt), dxA = Math.abs(b.x - a.x) / 200;
        if (dyA < 0) { areaCut += -dyA * dxA; maxCut = Math.max(maxCut, -dyA); } else { areaAdd += dyA * dxA; maxOut = Math.max(maxOut, dyA); } } });

    var outline = [pathOf(cap, "cap"), L(UfM, F0M, "side-seam-front"), pathOf(hemCs, "hem"), L(B0M, UbM, "side-seam-back")];
    var loop = flattenCubics(cap, FLAT_N);
    loop.push(cp(F0M)); flattenCubics(hemCs, FLAT_N).slice(1).forEach(function (p) { loop.push(p); }); loop.push(cp(UbM));
    var closeGap = dist(loop[loop.length - 1], loop[0]);
    if (!(closeGap < JOIN)) return fail("discontinuous", closeGap);
    if (loopSelfIntersects(loop)) return fail("self-intersection");
    var construction = [
      L(SP, { x: (CmB.x + CmF.x) / 2, y: (CmB.y + CmF.y) / 2 }, "center-line"),   // 소매 중심선 = 가운데 틈의 이등분선(대칭)
      L(SP, CmB, "cut-center-back"), L(SP, CmF, "cut-center-front"),
      L(PbM, CbM, "cut-axis-back"), L(PbM, BiM, "cut-edge-back"), L(PfM, CfM, "cut-axis-front"), L(PfM, FiM, "cut-edge-front")
    ];

    var capTotal = cubicsLen(cap);
    // SP 는 재제도 구간 안에 있어 cubic 이음이 아니다 → 앞/뒤 분할점 = 최종 곡선과 **소매 중심선(가운데 틈의 이등분선, x = SP.x)** 의 교점(잠정 — 대칭 벌림의 축).
    //   capPrimitives 의 «가장 높은 앵커 = 분할점» 규칙과 맞도록 그 점에서 Hermite 를 둘로 나눈다.
    var hSP = rd.hermites[1], lo = 0, hi2 = 1;
    for (var it = 0; it < 90; it++) { var m1 = (lo + hi2) / 2; if (cubicAt(hSP, m1).x < SP.x) lo = m1; else hi2 = m1; }
    var tTop = (lo + hi2) / 2, hsplit = splitAt(hSP, tTop);
    if (!(tTop > 1e-6 && tTop < 1 - 1e-6)) return fail("cap-split-failed");
    var capOut = [];
    cap.forEach(function (q) { if (q === hSP) { capOut.push(hsplit[0]); capOut.push(hsplit[1]); } else capOut.push(q); });
    var iTop = capOut.indexOf(hsplit[0]);
    var capBack = cubicsLen(capOut.slice(0, iTop + 1)), capFront = capTotal - capBack, top = cp(hsplit[0][3]);
    outline[0] = pathOf(capOut, "cap");
    var ahc = r.armholeCm, easeNow = (ahc && fin(ahc.back) && fin(ahc.front)) ? { back: capBack - ahc.back, front: capFront - ahc.front, total: capTotal - ahc.back - ahc.front } : null;
    var hemCm = cubicsLen(hemCs), am = sleeveA.meta;
    // raw 강체 조각(원래 종이 4조각, 표시·감사용): Ⓐ 조각 다각형(소매산 호 + 절개선 + 소맷부리)을 각 조각 변환 그대로
    var flatArc = function (cs) { var o = []; cs.forEach(function (q, i) { for (var k = (i ? 1 : 0); k <= 24; k++) o.push(cubicAt(q, k / 24)); }); return o; };
    var pieceOf = function (arc, extra, f) { return flatArc(arc).concat(extra).map(function (p) { return cp(f(p)); }); };
    var pieces = { backOuter: pieceOf(backOuterArc, [Cb, B0], RBo), backCenter: pieceOf(backCenterArc, [Cm, Cb], RCb),
      frontCenter: pieceOf(frontCenterArc, [Cf, Cm], RCf), frontOuter: pieceOf(frontOuterArc, [F0, Cf], RFo) };
    // 원래 종이 조각끼리 겹침(실제 형상 문제): 서로 다른 두 조각의 변이 기준점(맞닿는 점) 밖에서 교차하면 막는다
    var pk = ["backOuter", "backCenter", "frontCenter", "frontOuter"], touch = [PbM, SP, PfM];
    var nearTouch = function (p) { return touch.some(function (t) { return dist(p, t) < 1e-6; }); };
    for (var pa = 0; pa < pk.length; pa++) for (var pb2 = pa + 1; pb2 < pk.length; pb2++) {
      var A1 = pieces[pk[pa]].concat([pieces[pk[pa]][0]]), B1 = pieces[pk[pb2]].concat([pieces[pk[pb2]][0]]);
      for (var ia1 = 1; ia1 < A1.length; ia1++) for (var ib1 = 1; ib1 < B1.length; ib1++) {
        var a0 = A1[ia1 - 1], a1 = A1[ia1], b0 = B1[ib1 - 1], b1 = B1[ib1];
        if (nearTouch(a0) || nearTouch(a1) || nearTouch(b0) || nearTouch(b1)) continue;
        if (segCross(a0, a1, b0, b1)) return fail("pieces-overlap", { pieces: [pk[pa], pk[pb2]] }, true);
      }
    }
    var cHem = yAtX(hemCs, SP.x);
    return {
      ok: true,
      // capSplit: 소매산 앞/뒤 계측 분할 기준 = 소매 중심선(가운데 틈의 이등분선) x — 공용 측정(designSleeve.capPrimitives)이 이 세로선과 최종 소매산의 교점에서 나눈다.
      geometry: { outline: outline, construction: construction, capSplit: { x: SP.x } },
      meta: {
        rule: "pattern-school-p46-short-puff-sleeve-L(2026-10-13)",
        widthCm: W, sleeveLengthCm: r.sleeveLengthCm, hemCm: hemCm, hemBeforeCm: W,
        cuff: { upperArmCm: arm, lengthCm: cuff, widthCm: CUFF_WIDTH, rule: "위팔 둘레 + 4 · 폭 1cm — 치수 정보(별도 조각 아님)" },
        formula: { square: square, spread: flare, unit: unitGap, units: UNITS, centerUnits: CENTER_UNITS, gatherRatio: GATHER_RATIO, cuts: CUTS,
          note: "■ = Ⓐ 소매폭 − ● · ∅ = 0.5● − ■ = 1.5● − W · ⊠ = ∅/4 · 가운데 틈 2⊠ · 양옆 틈 각 ⊠(현) — 책 «3.5 정도»는 예시" },
        flare: { totalCm: flare, unitCm: unitGap, centerCm: gapC, sideCm: gap, cuts: CUTS, openedCm: { back: openBack, center: openCenter, front: openFront },
          measure: "각 틈의 두 밑단 끝점 사이 직선 거리(현)", order: "가운데(SP 대칭) → 바깥(이동한 가운데 조각의 기준점)" },
        reference: { fixed: "SP · 벌림 중심 이등분선(x = SP.x)", notFixed: "O(중심선 × 위팔선) — 중심선 절개로 갈라짐(김님)" },
        pivots: { sp: cp(SP), back: cp(PbM), front: cp(PfM), backBefore: cp(Pb), frontBefore: cp(Pf) },
        rotationDeg: { center: alpha * 180 / Math.PI, backOuterRelative: betaB * 180 / Math.PI, frontOuterRelative: betaF * 180 / Math.PI,
          backOuterTotal: (alpha + betaB) * 180 / Math.PI, frontOuterTotal: (alpha + betaF) * 180 / Math.PI },
        axes: { back: { x: xb, cap: cp(PbM), hem: cp(CbM) }, front: { x: xf, cap: cp(PfM), hem: cp(CfM) } },
        hemPoints: { frontOuter: cp(F0M), frontInner: cp(FiM), frontCenterOuter: cp(CfM), frontCenterMid: cp(CmF), backCenterMid: cp(CmB), backCenterOuter: cp(CbM), backInner: cp(BiM), backOuter: cp(B0M) },
        seams: { backCm: dist(UbM, B0M), frontCm: dist(UfM, F0M) },
        redraw: { ellStartCm: REDRAW_ELL, ratio: REDRAW_RATIO, status: "잠정 구현값(책 수치 아님) — ℓ 2cm 시작, 구간 내부 S 면 0.25cm 씩 축소(최소 1cm)",
          windows: { Pb: rd.windows[0].w, SP: rd.windows[1].w, Pf: rd.windows[2].w }, ellChosenCm: { Pb: rd.windows[0].ell, SP: rd.windows[1].ell, Pf: rd.windows[2].ell },
          kinkDegRaw: kinkDeg, joins: rd.joins, preservedMaxCm: preserved,
          curvatureMin: { Pb: kmin(rd.hermites[0]), SP: kmin(rd.hermites[1]), Pf: kmin(rd.hermites[2]) },
          curvatureMax: (function () { var kx = function (h) { var m = -Infinity; for (var i = 0; i <= 240; i++) m = Math.max(m, kappa(h, i / 240)); return m; }; return { Pb: kx(rd.hermites[0]), SP: kx(rd.hermites[1]), Pf: kx(rd.hermites[2]) }; })(),
          continuity: "G1(곡률 연속 아님)", top: top },
        hem: { points: hemPts.map(cp), lengthCm: hemCm, polylineCm: (function () { var t = 0; for (var i = 1; i < hemPts.length; i++) t += dist(hemPts[i - 1], hemPts[i]); return t; })(),
          gatherCm: hemCm - cuff, gatherRatio: (hemCm - cuff) / cuff, formulaHemCm: (1 + GATHER_RATIO) * cuff, formulaGatherCm: GATHER_RATIO * cuff,
          fair: { method: "오목 제어다각형 3차 B-spline truing(Ⓗ·Ⓘ 와 같은 방법) — 양 끝 고정 · C2 · 변곡 없음", approvedBy: "김님 2026-10-13 Ⓛ ③(소맷부리 전체 자연 곡선 정리)",
            maxCutCm: maxCut, maxOutwardCm: maxOut, corners: corner, areaCutCm2: areaCut, areaAddedCm2: areaAdd, inflections: hemInfl,
            curvatureJumpMax: kJump, g1MaxDeg: hemG1, controlPolygon: fairR.ctrl, raw8PointCm: raw8Cm, raw8Point: pathOf(raw8) },
          status: "화면 검토용 시안(최종 형상 승인 전)" },
        centerLength: { inputCm: r.sleeveLengthCm, spreadCm: fin(cHem) ? cHem - top.y : null, note: "입력 소매길이 vs 펼친 중심(최종 SP → 소맷부리 곡선 × 중심선)" },
        rigid: { cap: pathOf(RAW), hemPoints: hemPts.map(cp), pieces: pieces, note: "강체 회전 직후(감사·표시용 원래 종이 4조각) — 최종 geometry 가 권위값" },
        provisional: { capSplit: "최종 곡선 × 소매 중심선(x = SP.x)", flareMeasure: "현(chord)", redrawEllCm: REDRAW_ELL, redrawMinCm: REDRAW_MIN, redrawStepCm: REDRAW_STEP, redrawRatio: REDRAW_RATIO, hemCurve: "오목 B-spline truing" },
        sp: cp(top), spBefore: cp(SP), capSplit: { point: cp(top) },
        underarm: { before: { back: cp(Ub), front: cp(Uf) }, after: { back: cp(UbM), front: cp(UfM) } },
        capLengths: { back: capBack, front: capFront, total: capTotal, measure: "Gauss-Legendre(final curve) · 앞/뒤 분할 = 최종 곡선 × 소매 중심선(잠정)" },
        capLengthsA: am.capLengths ? JSON.parse(JSON.stringify(am.capLengths)) : null,
        armholeCm: ahc ? { back: ahc.back, front: ahc.front } : null,
        easeAfter: easeNow, easeSourceA: am.easeAfter ? JSON.parse(JSON.stringify(am.easeAfter)) : null,
        checks: { closed: true, connected: true, maxGapCm: Math.max(joinGap, closeGap), selfIntersection: false, singlePiece: true, maxG1BreakDeg: Math.max(joinG1, hemG1), preservedMaxCm: preserved }
      },
      warnings: [],
      sourceSleeveAHash: hashStr(JSON.stringify({ geometry: sleeveA.geometry, meta: sleeveA.meta }))
    };
  }

  window.designSleeveL = Object.freeze({ draftSleeveL: draftSleeveL, readSleeveA: readSleeveA,
    RULES: Object.freeze({ upperArmDefaultCm: UPPER_ARM_DEFAULT, sleeveLengthDefaultCm: 20, cuffAddCm: CUFF_ADD, cuffWidthCm: CUFF_WIDTH, gatherRatio: GATHER_RATIO, units: UNITS, centerUnits: CENTER_UNITS, cuts: CUTS, redrawEllCm: REDRAW_ELL, redrawMinCm: REDRAW_MIN, redrawStepCm: REDRAW_STEP, redrawRatio: REDRAW_RATIO, g1TolDeg: G1_TOL_DEG, kappaDeadPerCm: KAPPA_DEAD, maxRotationRad: MAX_ROTATION }) });
})();
