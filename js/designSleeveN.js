// ══════════════════════════════════════════════
// designSleeveN.js — 소매 Ⓝ 반소매 퍼프·소맷부리 턱([패턴학교] P.47 «소맷부리를 잘라서 벌린다(퍼프 슬리브)»). 순수.
//   (소매산 쪽 이동·재제도는 Ⓛ 와 같은 도구 · 턱 접기/펼치기는 Ⓕ 와 같은 강체·거울 변환 — 위치만 소맷부리.)
//
// 김님 확정(2026-10-20, docs/book/P047.md § Ⓝ). 아래 수치는 전부 «책 기본 설정값» — 사용자 수정 가능, 산식·불변 규칙 아님:
//   · 출발 = 같은 몸판의 짧은 Ⓐ(소매길이 기본 20 = SP → 출발 밑단, 읽기 전용).
//   · 절개 3개 = 소매 중심선 + 중심선 좌우 각 2.5cm 평행선 → 원래 종이 4조각.
//   · 벌림(소맷부리 현): 가운데 4 · 양옆 각 2. Ⓛ 와 같은 이동 — 가운데 두 조각을 SP 기준 좌우 대칭 회전(가운데 전체 틈 = 4),
//     바깥 조각은 함께 움직인 «절개선 × 소매산» 기준점에서 순차 회전(틈 = 2). 소매산 꺾임 3곳 국소 재제도(Ⓛ 와 같은 잠정 구현값).
//   · 턱(책 «턱은 중심 쪽으로 꺾는다» · 빗금 = 높은 쪽 접는 선 → 낮은 쪽 맞출 선 · 작은 접힘도):
//       양옆 턱: 접는 선 = 바깥 조각의 절개 변 → 중심 쪽 변(맞출 선)에 얹는다. 위층 = 바깥 조각, 접혀 들어간 두 겹은 바깥 조각 아래.
//       가운데 턱: 두 반쪽(각 2)이 각자 중심선 쪽으로 — 두 접는 선(가운데 두 조각의 절개 변)이 중심선에서 맞닿는다(작은 도해의 맞주름).
//         접혀 들어간 겹은 각 반쪽 조각 아래, 가장 안쪽 겹(틈 가운데 천)은 중심선 양쪽으로 이어진다.
//   · 박기 끝 1.5(소맷부리에서 다리를 따라): 소맷부리 ~ 박기 끝 띠에서 두 다리가 맞붙어 접힌 채 박힌다(그 띠가 «접은 상태»).
//     박기 끝 위는 턱이 풀려 볼륨이 된다 — 소매산·소매산 길이에는 영향 없음(소매산 개더 없음). 책에 없는 박음 모양은 만들지 않는다.
//   · 소맷부리 재단선 = 턱을 접은 상태(접힌 띠 = 조각이 Ⓐ 자리)의 소맷부리를 정리한 뒤 좌표 역변환으로 펼친 선. 접은 상태의 소맷부리는
//     Ⓐ 직선이라 정리할 꺾임이 없다(파임·덧댐 0) — 펼친 재단선은 각 조각 밑단 직선이 턱 안으로 그대로 이어져 접힘 중간선에서 만나는 모양.
//   · 커프스·위팔·손바닥·상승·개더 입력 없음.
// raw 강체 조각(meta.rigid.pieces)·틈/턱 영역·최종 외곽을 분리해 둔다. 길이는 최종 geometry 실측. 앞/뒤 분할 기준 = geometry.capSplit(x = SP.x).
// 회전 45° 는 설정된 수치 가드(책 규칙·물리 불가 아님).
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var CUT_OFFSET_DEFAULT = 2.5, CENTER_TUCK_DEFAULT = 4, SIDE_TUCK_DEFAULT = 2, STITCH_END_DEFAULT = 1.5, SLEEVE_LENGTH_DEFAULT = 20;   // 책 기본 설정값(수정 가능)
  var CUTS = 3;                       // 절개 3개(중심선 + 좌우 평행선)
  var REDRAW_ELL = 2.0;               // 소매산 재제도 구간(잠정 구현값 — 책 수치 아님)
  var REDRAW_RATIO = 0.4;             // 재제도 구간 ≤ 인접 호의 40% (잠정)
  var REDRAW_MIN = 0.5, REDRAW_STEP = 0.25;
  var JOIN = 1e-9, TOL = 1e-6;
  var FOLD_TOL = 1e-7;                // 접기 ↔ 펼치기 · 접힌 겹 ↔ Ⓐ 일치 허용(cm)
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

  function yAtX(cs, x) {
    for (var i = 0; i < cs.length; i++) { var q = cs[i], a = q[0].x, b = q[3].x;
      if ((x - a) * (x - b) <= 0) { var lo = 0, hi = 1, inc = b > a; for (var it = 0; it < 80; it++) { var m = (lo + hi) / 2; if ((cubicAt(q, m).x < x) === inc) lo = m; else hi = m; } return cubicAt(q, (lo + hi) / 2).y; } }
    return NaN;
  }
  function lineCubic(a, b) { return [cp(a), { x: a.x + (b.x - a.x) / 3, y: a.y + (b.y - a.y) / 3 }, { x: a.x + 2 * (b.x - a.x) / 3, y: a.y + 2 * (b.y - a.y) / 3 }, cp(b)]; }
  function paramOf(params, key, dflt) { var v = params ? params[key] : undefined; return (v === undefined || v === null) ? dflt : v; }
  function ident(p) { return cp(p); }

  // 입력: sleeveA = 짧은 Ⓐ(draftSleeveA 결과). params = { cutOffsetCm, centerTuckCm, sideTuckCm, stitchEndCm } — 없으면 책 기본 설정값. 값은 고쳐 쓰지 않는다.
  function draftSleeveN(sleeveA, params) {
    var off = paramOf(params, "cutOffsetCm", CUT_OFFSET_DEFAULT), tC = paramOf(params, "centerTuckCm", CENTER_TUCK_DEFAULT),
      tS = paramOf(params, "sideTuckCm", SIDE_TUCK_DEFAULT), se = paramOf(params, "stitchEndCm", STITCH_END_DEFAULT);
    if (!fin(off) || !(off > 0)) return fail("invalid-cut-offset", off);
    if (!fin(tC) || !(tC > 0)) return fail("invalid-center-tuck", tC);
    if (!fin(tS) || !(tS > 0)) return fail("invalid-side-tuck", tS);
    if (!fin(se) || !(se > 0)) return fail("invalid-stitch-end", se);
    var r = readSleeveA(sleeveA);
    if (!r.ok) return r;
    var cubs = r.cubics, Ub = r.Ub, Uf = r.Uf, H = r.hemY, W = r.W, XL = Ub.x, XR = Uf.x, SP = cp(r.sp), X0 = SP.x;
    var xb = X0 - off, xf = X0 + off;
    if (!(XL < xb - TOL && XR > xf + TOL)) return fail("cut-outside-sleeve", { offsetCm: off, backHalfCm: X0 - XL, frontHalfCm: XR - X0 }, true);
    var s1 = splitListAtX(cubs, xb), s2 = s1 && splitListAtX(s1[1], xf), s3 = s2 && splitListAtX(s2[0], X0);
    if (!s3) return fail("no-cap-intersection");
    var backOuterArc = s1[0], frontOuterArc = s2[1], backCenterArc = s3[0], frontCenterArc = s3[1];
    var Pb = cp(backOuterArc[backOuterArc.length - 1][3]), Pf = cp(frontOuterArc[0][0]);
    var Cm = { x: X0, y: H }, Cb = { x: xb, y: H }, Cf = { x: xf, y: H }, B0 = { x: XL, y: H }, F0 = { x: XR, y: H };
    // ① 가운데 두 조각: SP 중심 대칭 회전 ±α — 두 밑단 끝점(중심선 쪽) 사이 현 = 가운데 벌림(기본 4)
    var Rc = dist(SP, Cm);
    if (!(tC / 2 < Rc)) return fail("spread-too-large", { which: "center", cm: tC }, true);
    var alpha = Math.asin((tC / 2) / Rc);
    var RCb = function (p) { return rotP(p, +alpha, SP); }, RCf = function (p) { return rotP(p, -alpha, SP); };   // 뒤 가운데 = 왼쪽, 앞 가운데 = 오른쪽
    // ② 바깥 조각: 부모(가운데 조각) 변환 뒤, 함께 움직인 기준점(절개선 × 소매산) 중심 추가 회전 β — 틈(현) = 양옆 벌림(기본 2)
    var PbM = RCb(Pb), PfM = RCf(Pf), CbM = RCb(Cb), CfM = RCf(Cf);
    var Rb = dist(PbM, CbM), Rf = dist(PfM, CfM);
    if (!(tS < 2 * Rb && tS < 2 * Rf)) return fail("spread-too-large", { which: "side", cm: tS }, true);
    var betaB = 2 * Math.asin(tS / (2 * Rb)), betaF = 2 * Math.asin(tS / (2 * Rf));
    if (!(alpha + betaB <= MAX_ROTATION && alpha + betaF <= MAX_ROTATION)) {   // 설정된 수치 가드(45° — 책 규칙 아님): 물리적 불가능 판정이 아니다
      var rg = fail("rotation-too-large", { deg: (alpha + Math.max(betaB, betaF)) * 180 / Math.PI, limitDeg: MAX_ROTATION * 180 / Math.PI, kind: "numeric-guard" }, true);
      rg.numericGuard = true; return rg;
    }
    var RBo = function (p) { return rotP(RCb(p), +betaB, PbM); }, RFo = function (p) { return rotP(RCf(p), -betaF, PfM); };
    var invRCb = function (p) { return rotP(p, -alpha, SP); }, invRCf = function (p) { return rotP(p, +alpha, SP); };
    var invRBo = function (p) { return invRCb(rotP(p, -betaB, PbM)); }, invRFo = function (p) { return invRCf(rotP(p, +betaF, PfM)); };
    var rotList = function (cs, f) { return cs.map(function (q) { return q.map(f); }); };
    var bo = rotList(backOuterArc, RBo), bc = rotList(backCenterArc, RCb), fc = rotList(frontCenterArc, RCf), fo = rotList(frontOuterArc, RFo);
    var RAW = bo.concat(bc, fc, fo);
    var UbM = RBo(Ub), UfM = RFo(Uf), B0M = RBo(B0), BiM = RBo(Cb), FiM = RFo(Cf), F0M = RFo(F0), CmB = RCb(Cm), CmF = RCf(Cm);
    var openCenter = dist(CmB, CmF), openBack = dist(BiM, CbM), openFront = dist(FiM, CfM);
    if (!(CmB.x < CmF.x && BiM.x < CbM.x && FiM.x > CfM.x)) return fail("spread-direction");

    // ③ 소매산 꺾임 3곳 재제도(Ⓛ 와 같은 도구·잠정 구현값)
    var LBo = cubicsLen(bo), LBc = cubicsLen(bc), LFc = cubicsLen(fc), LFo = cubicsLen(fo);
    var rd = redrawKinks(RAW, [{ s: LBo, adjL: LBo, adjR: LBc }, { s: LBo + LBc, adjL: LBc, adjR: LFc }, { s: LBo + LBc + LFc, adjL: LFc, adjR: LFo }]);
    if (rd.error) return fail(rd.error, null, rd.error === "redraw-inflection-unavoidable");
    var cap = rd.cap, joinGap = 0, joinG1 = 0;
    rd.joins.forEach(function (j) { joinGap = Math.max(joinGap, j.gapCm); joinG1 = Math.max(joinG1, j.g1Deg); });
    if (!(joinGap < JOIN)) return fail("discontinuous", joinGap);
    if (!(joinG1 <= G1_TOL_DEG)) return fail("redraw-g1-break", joinG1);
    var kTop = Infinity; for (var it0 = 0; it0 <= 240; it0++) kTop = Math.min(kTop, kappa(rd.hermites[1], it0 / 240));
    if (kTop < -KAPPA_DEAD) return fail("cap-top-concave", { curvatureMin: kTop, deadband: KAPPA_DEAD, kinkDeg: 2 * alpha * 180 / Math.PI }, true);
    var preserved = 0, ptAt = function (cs, s) { var sp_ = splitListAtLen(cs, s); return sp_[1].length ? sp_[1][0][0] : sp_[0][sp_[0].length - 1][3]; };
    var starts = [0].concat(rd.windows.map(function (w) { return w.b; }));
    rd.kept.forEach(function (seg, k) { var L0 = cubicsLen(seg); for (var t = 1; t < 6; t++) { var sl = L0 * t / 6; preserved = Math.max(preserved, dist(ptAt(seg, sl), ptAt(RAW, starts[k] + sl))); } });
    var kinkDeg = { Pb: betaB * 180 / Math.PI, SP: 2 * alpha * 180 / Math.PI, Pf: betaF * 180 / Math.PI };
    var kmin = function (h) { var m = Infinity; for (var i = 0; i <= 240; i++) m = Math.min(m, kappa(h, i / 240)); return m; };

    // ④ 턱 접기 모델(Ⓐ 좌표 = 접은 상태 — 박기 끝까지의 띠에서 두 다리가 맞붙으면 조각은 Ⓐ 자리로 돌아간다).
    //   c = 절개선 x(Ⓐ 에서 세로) · side = 접는 조각(위층)이 놓인 쪽(+1 앞 / −1 뒤) · φ = 그 틈의 쐐기 각.
    //   접힘 중간선 M′ = 기준점을 지나는 세로선을 접는 쪽으로 φ/2 기울인 선 → 겹 폭(소맷부리) w = 다리 길이 · tan(φ/2).
    //   펼침: 첫 겹(접는 선 쪽) = 접는 조각 변환 ∘ 절개선 거울 · 둘째 겹 = 맞출 쪽 변환(가운데 턱은 틈 가운데 천 = 제자리).
    var tucks = [
      { id: "front-side", c: xf, pivot: Pf, side: +1, phi: betaF, crease: RFo, creaseInv: invRFo, place: RCf, placeInv: invRCf, creasePiece: "frontOuter", placePiece: "frontCenter", targetCm: tS, room: XR - xf },
      { id: "center-front", c: X0, pivot: SP, side: +1, phi: alpha, crease: RCf, creaseInv: invRCf, place: ident, placeInv: ident, creasePiece: "frontCenter", placePiece: "centerFill", targetCm: tC / 2, room: off },
      { id: "center-back", c: X0, pivot: SP, side: -1, phi: alpha, crease: RCb, creaseInv: invRCb, place: ident, placeInv: ident, creasePiece: "backCenter", placePiece: "centerFill", targetCm: tC / 2, room: off },
      { id: "back-side", c: xb, pivot: Pb, side: -1, phi: betaB, crease: RBo, creaseInv: invRBo, place: RCb, placeInv: invRCb, creasePiece: "backOuter", placePiece: "backCenter", targetCm: tS, room: xb - XL }
    ];
    var TK = {};
    for (var ti = 0; ti < tucks.length; ti++) {
      var tk = tucks[ti], depth = H - tk.pivot.y, c0 = tk.c;
      if (!(se < depth - TOL)) return fail("stitch-end-beyond-pivot", { tuck: tk.id, stitchEndCm: se, legCm: depth }, true);
      var w = depth * Math.tan(tk.phi / 2);
      if (!(w < tk.room - TOL)) return fail("tuck-layer-exceeds-piece", { tuck: tk.id, layerCm: w, pieceCm: tk.room }, true);
      var refl = (function (c) { return function (p) { return { x: 2 * c - p.x, y: p.y }; }; })(c0);
      var A0 = { x: c0, y: H }, Mp = { x: c0 + tk.side * w, y: H };
      var midC = tk.crease(refl(Mp)), midP = tk.place(Mp), midGap = dist(midC, midP);
      if (!(midGap < FOLD_TOL)) return fail("fold-mid-mismatch", { tuck: tk.id, gapCm: midGap });
      var wS = (depth - se) * Math.tan(tk.phi / 2), S0 = { x: c0, y: H - se }, MS = { x: c0 + tk.side * wS, y: H - se };
      TK[tk.id] = { def: tk, refl: refl, w: w, depth: depth, creaseCorner: tk.crease(A0), placeCorner: tk.place(A0), mid: midP,
        creaseStitch: tk.crease(S0), placeStitch: tk.place(S0), midStitch: tk.place(MS), pivot: tk.crease(tk.pivot), midGap: midGap };
    }
    var Tf = TK["front-side"], Tcf = TK["center-front"], Tcb = TK["center-back"], Tb = TK["back-side"], Ccen = cp(Cm);
    // 펼친 소맷부리(앞 바깥 → 뒤 바깥): 조각 밑단 직선 · 턱 입구(첫 겹 → 접힘 중간선 → 둘째 겹)
    var hemPts = [F0M, Tf.creaseCorner, Tf.mid, Tf.placeCorner, Tcf.creaseCorner, Tcf.mid, Ccen, Tcb.mid, Tcb.creaseCorner, Tb.placeCorner, Tb.mid, Tb.creaseCorner, B0M];
    var cornerGap = Math.max(dist(Tf.creaseCorner, FiM), dist(Tf.placeCorner, CfM), dist(Tcf.creaseCorner, CmF), dist(Tcb.creaseCorner, CmB), dist(Tb.placeCorner, CbM), dist(Tb.creaseCorner, BiM));
    if (!(cornerGap < 1e-9)) return fail("discontinuous", { hemCorners: cornerGap });
    // 각 소맷부리 변의 «접기» 변환(펼친 → Ⓐ) · 소속
    var reflInv = function (t) { return function (p) { return TK[t].refl(TK[t].def.creaseInv(p)); }; };
    var owners = [
      { kind: "piece", piece: "frontOuter", fold: invRFo, range: [xf, XR] },
      { kind: "layer1", tuck: "front-side", fold: reflInv("front-side") },
      { kind: "layer2", tuck: "front-side", fold: invRCf },
      { kind: "piece", piece: "frontCenter", fold: invRCf, range: [X0, xf] },
      { kind: "layer1", tuck: "center-front", fold: reflInv("center-front") },
      { kind: "layer2", tuck: "center-front", fold: ident },
      { kind: "layer2", tuck: "center-back", fold: ident },
      { kind: "layer1", tuck: "center-back", fold: reflInv("center-back") },
      { kind: "piece", piece: "backCenter", fold: invRCb, range: [xb, X0] },
      { kind: "layer2", tuck: "back-side", fold: invRCb },
      { kind: "layer1", tuck: "back-side", fold: reflInv("back-side") },
      { kind: "piece", piece: "backOuter", fold: invRBo, range: [XL, xb] }
    ];
    var hemCs = []; for (var hi0 = 1; hi0 < hemPts.length; hi0++) hemCs.push(lineCubic(hemPts[hi0 - 1], hemPts[hi0]));
    // 펼친 재단선의 꺾임(이음점마다) — 조각 밑단과 첫 겹은 같은 직선(거울 = 같은 수평선)이라 0, 접힘 중간선에서만 꺾인다.
    var hemKinkDeg = []; for (var hk = 1; hk < hemPts.length - 1; hk++) hemKinkDeg.push(angleBetween(sub(hemPts[hk], hemPts[hk - 1]), sub(hemPts[hk + 1], hemPts[hk])));

    var outline = [pathOf(cap, "cap"), L(UfM, F0M, "side-seam-front"), pathOf(hemCs, "hem"), L(B0M, UbM, "side-seam-back")];
    // ⑤ 접기 검증(최종 geometry 의 소맷부리에서 표본 → 접기 변환): 전부 Ⓐ 소맷부리(y = H) 위 · 조각은 자기 구간 · 겹은 접는 조각 아래 [c, c ± w]
    //   + 왕복(펼침 ∘ 접기 = 그대로) · 접은 조각 밑단이 Ⓐ 소맷부리를 빈틈·겹침 없이 한 줄로 덮는지 · 봉제(접은) 길이를 접은 좌표에서 따로 잰다.
    var hemFinal = cubicsOfPath(outline[2]), foldDev = 0, layerDev = 0, rangeDev = 0, roundTrip = 0, foldedPieces = [];
    if (hemFinal.length !== owners.length) return fail("hem-owner-mismatch", { segments: hemFinal.length, owners: owners.length });
    var unfoldOf = function (o) {
      if (o.kind === "piece") return { frontOuter: RFo, frontCenter: RCf, backCenter: RCb, backOuter: RBo }[o.piece];
      if (o.kind === "layer2") return TK[o.tuck].def.place;
      var d = TK[o.tuck]; return function (p) { return d.def.crease(d.refl(p)); };
    };
    owners.forEach(function (o, k) {
      var q = hemFinal[k], un = unfoldOf(o), lo = Infinity, hiX = -Infinity;
      for (var s = 0; s <= 16; s++) {
        var p = cubicAt(q, s / 16), f = o.fold(p), back = un(f);
        roundTrip = Math.max(roundTrip, dist(back, p));
        if (o.kind === "piece") foldDev = Math.max(foldDev, Math.abs(f.y - H)); else layerDev = Math.max(layerDev, Math.abs(f.y - H));
        lo = Math.min(lo, f.x); hiX = Math.max(hiX, f.x);
        if (o.kind !== "piece") { var d = TK[o.tuck], a0 = Math.min(d.def.c, d.def.c + d.def.side * d.w), a1 = Math.max(d.def.c, d.def.c + d.def.side * d.w);
          rangeDev = Math.max(rangeDev, Math.max(0, a0 - f.x, f.x - a1)); }
      }
      if (o.kind === "piece") { rangeDev = Math.max(rangeDev, Math.abs(lo - o.range[0]), Math.abs(hiX - o.range[1])); foldedPieces.push({ piece: o.piece, from: lo, to: hiX, cm: dist(o.fold(q[0]), o.fold(q[3])) }); }
    });
    if (!(foldDev < FOLD_TOL)) return fail("fold-mismatch", foldDev);
    if (!(layerDev < FOLD_TOL && rangeDev < FOLD_TOL)) return fail("fold-layer-mismatch", { onHemCm: layerDev, rangeCm: rangeDev });
    if (!(roundTrip < FOLD_TOL)) return fail("fold-round-trip", roundTrip);
    foldedPieces.sort(function (a, b) { return a.from - b.from; });
    var tileGap = Math.abs(foldedPieces[0].from - XL) + Math.abs(foldedPieces[foldedPieces.length - 1].to - XR);
    for (var fp = 1; fp < foldedPieces.length; fp++) tileGap = Math.max(tileGap, Math.abs(foldedPieces[fp].from - foldedPieces[fp - 1].to));
    if (!(tileGap < FOLD_TOL)) return fail("folded-hem-gap", tileGap);
    var sewnFolded = foldedPieces.reduce(function (s, p) { return s + p.cm; }, 0);

    var loop = flattenCubics(cap, FLAT_N);
    loop.push(cp(F0M)); flattenCubics(hemCs, FLAT_N).slice(1).forEach(function (p) { loop.push(p); }); loop.push(cp(UbM));
    var closeGap = dist(loop[loop.length - 1], loop[0]);
    if (!(closeGap < JOIN)) return fail("discontinuous", closeGap);
    if (loopSelfIntersects(loop)) return fail("self-intersection");   // 펼친 재단선(평면) 검사 — 접은 상태의 겹 포개짐은 정상 접힘이라 여기서 보지 않는다
    var construction = [
      L(SP, Ccen, "center-line"),   // 소매 중심선 = 가운데 틈의 이등분선(x = SP.x · 대칭)
      L(SP, CmB, "cut-center-back"), L(SP, CmF, "cut-center-front"),
      L(PbM, CbM, "cut-axis-back"), L(PbM, BiM, "cut-edge-back"), L(PfM, CfM, "cut-axis-front"), L(PfM, FiM, "cut-edge-front")
    ];
    // 턱 표시선(설명 · 접기 정보): 접는 선 다리·맞출 선 다리·접힘 중간선(소맷부리 → 박기 끝) · 박기 끝선
    tucks.forEach(function (tk) {
      var d = TK[tk.id], push = function (a, b, role) { var s = L(a, b, role); s.tuck = tk.id; construction.push(s); };
      push(d.creaseCorner, d.creaseStitch, "tuck-crease"); push(d.placeCorner, d.placeStitch, "tuck-place");
      push(d.mid, d.midStitch, "tuck-mid"); push(d.creaseStitch, d.placeStitch, "tuck-stitch-end");
    });
    var geometry = { outline: outline, construction: construction, capSplit: { x: X0 } };
    var hl = hemLengthsOf(geometry);
    if (!hl) return fail("hem-unmeasured");

    var capTotal = cubicsLen(cap);
    var hSP = rd.hermites[1], lo2 = 0, hi2 = 1;
    for (var it = 0; it < 90; it++) { var m1 = (lo2 + hi2) / 2; if (cubicAt(hSP, m1).x < X0) lo2 = m1; else hi2 = m1; }
    var tTop = (lo2 + hi2) / 2, hsplit = splitAt(hSP, tTop);
    if (!(tTop > 1e-6 && tTop < 1 - 1e-6)) return fail("cap-split-failed");
    var capOut = [];
    cap.forEach(function (q) { if (q === hSP) { capOut.push(hsplit[0]); capOut.push(hsplit[1]); } else capOut.push(q); });
    var iTop = capOut.indexOf(hsplit[0]);
    var capBack = cubicsLen(capOut.slice(0, iTop + 1)), capFront = capTotal - capBack, top = cp(hsplit[0][3]);
    outline[0] = pathOf(capOut, "cap");
    var ahc = r.armholeCm, easeNow = (ahc && fin(ahc.back) && fin(ahc.front)) ? { back: capBack - ahc.back, front: capFront - ahc.front, total: capTotal - ahc.back - ahc.front } : null;
    var am = sleeveA.meta;
    var flatArc = function (cs) { var o = []; cs.forEach(function (q, i) { for (var k = (i ? 1 : 0); k <= 24; k++) o.push(cubicAt(q, k / 24)); }); return o; };
    var pieceOf = function (arc, extra, f) { return flatArc(arc).concat(extra).map(function (p) { return cp(f(p)); }); };
    var pieces = { backOuter: pieceOf(backOuterArc, [Cb, B0], RBo), backCenter: pieceOf(backCenterArc, [Cm, Cb], RCb),
      frontCenter: pieceOf(frontCenterArc, [Cf, Cm], RCf), frontOuter: pieceOf(frontOuterArc, [F0, Cf], RFo) };
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
    var tuckMeta = {};
    tucks.forEach(function (tk) {
      var d = TK[tk.id], isC = tk.id.indexOf("center") === 0;
      tuckMeta[tk.id] = { amountCm: tk.targetCm, rotationShareDeg: tk.phi * 180 / Math.PI, legCm: d.depth, layerWidthCm: d.w, stitchEndCm: se,
        direction: "중심 쪽", crease: isC ? "가운데 조각의 절개 변(중심선으로)" : "바깥 조각의 절개 변", place: isC ? "중심선(틈 이등분선)" : "가운데 조각의 절개 변",
        topLayer: tk.creasePiece, layersUnder: tk.creasePiece + " 아래 두 겹(각 " + (Math.round(d.w * 100) / 100) + " cm)",
        creaseCorner: cp(d.creaseCorner), placeCorner: cp(d.placeCorner), mid: cp(d.mid), pivot: cp(d.pivot),
        stitch: { crease: cp(d.creaseStitch), place: cp(d.placeStitch), mid: cp(d.midStitch) },
        band: [d.creaseCorner, d.mid, d.placeCorner, d.placeStitch, d.midStitch, d.creaseStitch].map(cp),
        mouthCutCm: dist(d.creaseCorner, d.mid) + dist(d.mid, d.placeCorner), midJoinCm: d.midGap };
    });
    var cHem = yAtX(hemCs, X0);
    return {
      ok: true,
      geometry: geometry,
      meta: {
        rule: "pattern-school-p47-short-puff-hem-tuck-N(2026-10-20)",
        widthCm: W, sleeveLengthCm: r.sleeveLengthCm,
        settings: { cutOffsetCm: off, centerTuckCm: tC, sideTuckCm: tS, stitchEndCm: se,
          defaults: { sleeveLengthCm: SLEEVE_LENGTH_DEFAULT, cutOffsetCm: CUT_OFFSET_DEFAULT, centerTuckCm: CENTER_TUCK_DEFAULT, sideTuckCm: SIDE_TUCK_DEFAULT, stitchEndCm: STITCH_END_DEFAULT },
          note: "책 기본 설정값(김님 2026-10-20) — 수정 가능, 산식·불변 규칙 아님" },
        spread: { cuts: CUTS, cutX: { back: xb, center: X0, front: xf }, targetCm: { back: tS, center: tC, front: tS }, openedCm: { back: openBack, center: openCenter, front: openFront },
          measure: "각 틈의 두 밑단 끝점 사이 직선 거리(현)", order: "가운데(SP 대칭) → 바깥(함께 움직인 «절개선 × 소매산» 기준점)" },
        pivots: { sp: cp(SP), back: cp(PbM), front: cp(PfM), backBefore: cp(Pb), frontBefore: cp(Pf) },
        rotationDeg: { center: alpha * 180 / Math.PI, backOuterRelative: betaB * 180 / Math.PI, frontOuterRelative: betaF * 180 / Math.PI,
          backOuterTotal: (alpha + betaB) * 180 / Math.PI, frontOuterTotal: (alpha + betaF) * 180 / Math.PI },
        axes: { back: { x: xb, cap: cp(PbM), hem: cp(CbM) }, front: { x: xf, cap: cp(PfM), hem: cp(CfM) } },
        hemPoints: { frontOuter: cp(F0M), frontInner: cp(FiM), frontCenterOuter: cp(CfM), frontCenterMid: cp(CmF), center: cp(Ccen), backCenterMid: cp(CmB), backCenterOuter: cp(CbM), backInner: cp(BiM), backOuter: cp(B0M) },
        tucks: tuckMeta,
        stitchEnd: { cm: se, model: "소맷부리 ~ 박기 끝(다리를 따라 " + se + " cm) 띠에서 두 다리가 맞붙어 접힌 채 박힘 = 접은 상태(조각이 Ⓐ 자리). 박기 끝 위는 턱이 풀려 볼륨",
          effect: "소맷부리 재단선은 접은 띠의 아래 끝(소맷부리)에서 정해지므로 박기 끝 길이로 모양이 바뀌지 않는다 · 소매산·소매산 길이 무관 · 박기 끝은 다리 길이(기준점까지)보다 짧아야 한다",
          seamShape: "책에 없는 박음 모양(박음선 위치·되박음 등)은 만들지 않음" },
        folded: { model: "턱을 중심 쪽으로 접은 상태 = 조각이 Ⓐ 자리(접은 띠) — 소맷부리는 Ⓐ 직선", hemStraight: true, maxDevCm: foldDev, layersOnHemMaxCm: layerDev, layerRangeMaxCm: rangeDev,
          roundTripMaxCm: roundTrip, tileGapCm: tileGap, sewnCm: sewnFolded, pieces: foldedPieces,
          truing: "불필요 — 접은 소맷부리가 Ⓐ 직선이라 꺾임이 없다(파임 0 · 덧댐 0)", cutCm: 0, addedCm: 0 },
        hem: { points: hemPts.map(cp), kinkDeg: hemKinkDeg, cutCm: hl.cut.total, sewnCm: hl.sewn.total, hiddenCm: hl.hidden.total, cut: hl.cut, sewn: hl.sewn, hidden: hl.hidden,
          sewnFoldedCm: sewnFolded, formulaCutCm: W + tC + 2 * tS, formulaSewnCm: W, formulaNote: "참고 산식 W + 가운데 + 양옆 합(현 기준) — 권위값은 최종 geometry 실측",
          method: "접은 상태(Ⓐ 직선)의 소맷부리를 좌표 역변환으로 펼침 — 조각 밑단 직선이 턱 안으로 그대로 이어져 접힘 중간선에서 만난다(임의 잇기·전체 곡선 덮기 없음)",
          status: "화면 검토용 시안(최종 형상 승인 전)" },
        centerLength: { inputCm: r.sleeveLengthCm, spreadCm: fin(cHem) ? cHem - top.y : null, note: "입력 소매길이(SP → 출발 밑단) vs 벌린 뒤 중심(새 꼭대기 → 소맷부리 × 중심선)" },
        seams: { backCm: dist(UbM, B0M), frontCm: dist(UfM, F0M) },
        redraw: { ellStartCm: REDRAW_ELL, ratio: REDRAW_RATIO, status: "잠정 구현값(책 수치 아님) — ℓ 2cm 시작, 구간 내부 S 면 0.25cm 씩 축소(최소 0.5cm)",
          windows: { Pb: rd.windows[0].w, SP: rd.windows[1].w, Pf: rd.windows[2].w }, ellChosenCm: { Pb: rd.windows[0].ell, SP: rd.windows[1].ell, Pf: rd.windows[2].ell },
          kinkDegRaw: kinkDeg, joins: rd.joins, preservedMaxCm: preserved,
          curvatureMin: { Pb: kmin(rd.hermites[0]), SP: kmin(rd.hermites[1]), Pf: kmin(rd.hermites[2]) }, continuity: "G1(곡률 연속 아님)", top: top },
        rigid: { cap: pathOf(RAW), hemPoints: hemPts.map(cp), pieces: pieces, note: "강체 회전 직후(감사·표시용 원래 종이 4조각) — 최종 geometry 가 권위값" },
        provisional: { capSplit: "최종 곡선 × 소매 중심선(x = SP.x)", spreadMeasure: "현(chord)", redrawEllCm: REDRAW_ELL, redrawMinCm: REDRAW_MIN, redrawStepCm: REDRAW_STEP, redrawRatio: REDRAW_RATIO },
        sp: cp(top), spBefore: cp(SP), capSplit: { point: cp(top) },
        underarm: { before: { back: cp(Ub), front: cp(Uf) }, after: { back: cp(UbM), front: cp(UfM) } },
        capLengths: { back: capBack, front: capFront, total: capTotal, measure: "Gauss-Legendre(final curve) · 앞/뒤 분할 = 최종 곡선 × 소매 중심선 · 소매산 개더 없음" },
        capLengthsA: am.capLengths ? JSON.parse(JSON.stringify(am.capLengths)) : null,
        armholeCm: ahc ? { back: ahc.back, front: ahc.front } : null,
        easeAfter: easeNow, easeSourceA: am.easeAfter ? JSON.parse(JSON.stringify(am.easeAfter)) : null,
        checks: { closed: true, connected: true, maxGapCm: Math.max(joinGap, closeGap), selfIntersection: false, singlePiece: true, piecesOverlap: false, maxG1BreakDeg: joinG1, preservedMaxCm: preserved,
          foldRoundTripCm: roundTrip, foldedTileGapCm: tileGap, tuckMidJoinMaxCm: Math.max(Tf.midGap, Tcf.midGap, Tcb.midGap, Tb.midGap) }
      },
      warnings: [],
      sourceSleeveAHash: hashStr(JSON.stringify({ geometry: sleeveA.geometry, meta: sleeveA.meta }))
    };
  }

  function cubicsOfPath(p) { var o = [], cur = p.commands[0].points[0]; p.commands.slice(1).forEach(function (c) { o.push([cp(cur), cp(c.points[0]), cp(c.points[1]), cp(c.points[2])]); cur = c.points[2]; }); return o; }
  // 최종 geometry 에서 소맷부리 길이 실측 — 재단(펼친 재단선 전체)과 봉제(턱 접음: 턱 입구 = 접는 선 모서리 ~ 맞출 선 모서리 제외).
  //   턱 입구 모서리 = construction tuck-crease / tuck-place 의 소맷부리 끝(from), 앞/뒤 분할 = center-line 아래 끝(소맷부리 × 중심선).
  //   반환 {cut, sewn, hidden, split} | null. (designSleeveF.capLengthsOf 와 같은 결 — 위치만 소맷부리)
  function hemLengthsOf(geometry) {
    if (!geometry || !Array.isArray(geometry.outline) || !Array.isArray(geometry.construction)) return null;
    var hemS = geometry.outline.filter(function (s) { return s && s.role === "hem" && s.kind === "path"; })[0];
    var cl = geometry.construction.filter(function (s) { return s.role === "center-line"; })[0];
    var cr = geometry.construction.filter(function (s) { return s.role === "tuck-crease"; }), pl = geometry.construction.filter(function (s) { return s.role === "tuck-place"; });
    if (!hemS || !cl || cr.length !== 4 || pl.length !== 4) return null;
    var cs = cubicsOfPath(hemS), anchors = [cs[0][0]], acc = [0];
    cs.forEach(function (q) { anchors.push(q[3]); acc.push(acc[acc.length - 1] + cubicLen(q)); });
    var idxOf = function (p) { var best = -1, bd = Infinity; anchors.forEach(function (a, i) { var d = dist(a, p); if (d < bd) { bd = d; best = i; } }); return bd < 1e-6 ? best : -1; };
    var iC = idxOf(cl.to);   // 소맷부리는 앞 바깥 → 뒤 바깥 순서: [0, iC] = 앞 · [iC, 끝] = 뒤
    if (iC <= 0 || iC >= anchors.length - 1) return null;
    var total = acc[acc.length - 1], front = acc[iC], back = total - front, hidden = { back: 0, front: 0 };
    for (var k = 0; k < 4; k++) {
      var id = cr[k].tuck, p = pl.filter(function (s) { return s.tuck === id; })[0];
      if (!p) return null;
      var a = idxOf(cr[k].from), b = idxOf(p.from);
      if (a < 0 || b < 0 || a === b) return null;
      var lo = Math.min(a, b), hi = Math.max(a, b), seg = acc[hi] - acc[lo];
      if (hi <= iC) hidden.front += seg; else if (lo >= iC) hidden.back += seg; else return null;
    }
    return { cut: { back: back, front: front, total: total }, sewn: { back: back - hidden.back, front: front - hidden.front, total: total - hidden.back - hidden.front },
      hidden: { back: hidden.back, front: hidden.front, total: hidden.back + hidden.front }, split: cp(anchors[iC]), splitIndex: iC };
  }

  window.designSleeveN = Object.freeze({ draftSleeveN: draftSleeveN, readSleeveA: readSleeveA, hemLengthsOf: hemLengthsOf,
    RULES: Object.freeze({ sleeveLengthDefaultCm: SLEEVE_LENGTH_DEFAULT, cutOffsetDefaultCm: CUT_OFFSET_DEFAULT, centerTuckDefaultCm: CENTER_TUCK_DEFAULT, sideTuckDefaultCm: SIDE_TUCK_DEFAULT,
      stitchEndDefaultCm: STITCH_END_DEFAULT, cuts: CUTS, redrawEllCm: REDRAW_ELL, redrawMinCm: REDRAW_MIN, redrawStepCm: REDRAW_STEP, redrawRatio: REDRAW_RATIO,
      g1TolDeg: G1_TOL_DEG, kappaDeadPerCm: KAPPA_DEAD, foldTolCm: FOLD_TOL, maxRotationRad: MAX_ROTATION }) });
})();
