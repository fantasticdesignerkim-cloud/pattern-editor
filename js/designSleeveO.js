// ══════════════════════════════════════════════
// designSleeveO.js — 소매 Ⓞ 턱트 슬리브([패턴학교] P.47 하단 «소매산과 소맷부리를 잘라서 벌린다(턱트 슬리브)»). 순수.
//   (턱 접기/펼치기는 Ⓝ 과 같은 강체·거울 변환 — 이동이 회전이 아니라 평행이고, 턱이 소매산과 소맷부리 양쪽에 있다.)
//
// 김님 확정(2026-10-21, docs/book/P047.md § Ⓞ). 수치는 전부 «책 기본 설정값» — 사용자 수정 가능, 산식·불변 규칙 아님:
//   · 출발 = 같은 몸판의 짧은 Ⓐ(소매길이 기본 20 = SP → 출발 밑단, 읽기 전용).
//   · 절개 4개(소매 중심선과 평행, 중심선은 자르지 않음): 안쪽 = 중심에서 좌우 각 1.25(도해 «2.5» = 가운데 띠 폭 — 중심→절개가 아니다),
//     바깥 = 안쪽에서 2.5 더(도해 «2.5» 두 개의 지시선 = 안쪽 ↔ 바깥 절개) → 중심 ±3.75. 도해 픽셀 비율은 치수로 쓰지 않는다.
//   · 평행 벌림(회전 없음) — 틈마다 2(책 «같은 분량»): 가운데 띠(SP·중심선) 고정 · 안쪽 띠 좌우 각 2 · 바깥 조각 각 4 이동.
//   · 턱(책 캡션 «턱을 소매 밑선 쪽으로 꺾어» · 빗금 = 중심 쪽이 높음 · 위아래 작은 접힘도 = 거울상): 소매산·소맷부리 모두 바깥쪽으로 접는다.
//     접는 선 = 중심 쪽 조각의 절개 변 → 바깥 조각 변(맞출 선)에 얹는다. 위층 = 중심 쪽 조각, 접혀 들어간 두 겹(각 틈의 반)은 중심 쪽 조각 아래.
//     (Ⓝ 은 반대 — 접는 선 = 바깥 조각 변, 겹은 바깥 조각 아래.)
//   · 박기 끝: 소맷부리에서 1.5(김님 «아래에서 1.5 올라온 지점까지»). 소매산 쪽 박음 길이는 책에 수치가 없다 → 미지정(임의 수치·박음 모양 없음).
//   · 재단선 = 턱을 접은 상태(평행 이동이라 조각이 정확히 Ⓐ 자리 — 소매산·소맷부리 모두 Ⓐ 선, 정리할 꺾임 없음)를 거울/평행 역변환으로 펼친 선.
//     소맷부리는 수평이라 턱 입구도 직선, 소매산은 기울기 때문에 입구마다 접기로 정해지는 모양(책 V 모양을 억지로 흉내 내지 않는다).
//   · 커프스·위팔·손바닥·상승·개더 입력 없음.
// raw 강체 조각(meta.rigid.pieces 5)·틈/턱 영역·최종 외곽을 분리해 둔다. 길이는 최종 geometry 실측. 앞/뒤 분할 기준 = geometry.capSplit(x = SP.x).
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var INNER_OFFSET_DEFAULT = 1.25, CUT_SPACING_DEFAULT = 2.5, SPREAD_DEFAULT = 2, STITCH_END_DEFAULT = 1.5, SLEEVE_LENGTH_DEFAULT = 20;   // 책 기본 설정값(수정 가능)
  var CUTS = 4;
  var REDRAW_ELL = 2.0, REDRAW_RATIO = 0.4, REDRAW_MIN = 0.5, REDRAW_STEP = 0.25;   // 공용 도구 상수(Ⓞ 은 재제도 없음 — 접은 상태 = Ⓐ)
  var JOIN = 1e-9, TOL = 1e-6;
  var FOLD_TOL = 1e-7;                // 접기 ↔ 펼치기 · 접힌 겹 ↔ Ⓐ 일치 허용(cm)
  var G1_TOL_DEG = 1e-9;
  var KAPPA_DEAD = 0.01;
  var FLAT_N = 24;
  var MAX_ROTATION = Math.PI / 4;     // 공용 도구 상수(Ⓞ 은 회전 없음)
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
  function mapList(cs, f) { return cs.map(function (q) { return q.map(f); }); }
  function revList(cs) { return cs.slice().reverse().map(function (q) { return [cp(q[3]), cp(q[2]), cp(q[1]), cp(q[0])]; }); }
  function cubicsOfPath(p) { var o = [], cur = p.commands[0].points[0]; p.commands.slice(1).forEach(function (c) { o.push([cp(cur), cp(c.points[0]), cp(c.points[1]), cp(c.points[2])]); cur = c.points[2]; }); return o; }
  function subArc(cs, x0, x1) {   // x 단조 곡선 목록의 [x0, x1] 구간(왼쪽 → 오른쪽)
    var a = splitListAtX(cs, x0); if (!a || !a[1].length) return null;
    var b = splitListAtX(a[1], x1); if (!b || !b[0].length) return null;
    return b[0];
  }

  // 입력: sleeveA = 짧은 Ⓐ(draftSleeveA 결과). params = { innerOffsetCm, cutSpacingCm, spreadCm, stitchEndCm } — 없으면 책 기본 설정값. 값은 고쳐 쓰지 않는다.
  function draftSleeveO(sleeveA, params) {
    var a = paramOf(params, "innerOffsetCm", INNER_OFFSET_DEFAULT), s = paramOf(params, "cutSpacingCm", CUT_SPACING_DEFAULT),
      g = paramOf(params, "spreadCm", SPREAD_DEFAULT), se = paramOf(params, "stitchEndCm", STITCH_END_DEFAULT);
    if (!fin(a) || !(a > 0)) return fail("invalid-inner-offset", a);
    if (!fin(s) || !(s > 0)) return fail("invalid-cut-spacing", s);
    if (!fin(g) || !(g > 0)) return fail("invalid-spread", g);
    if (!fin(se) || !(se > 0)) return fail("invalid-stitch-end", se);
    var r = readSleeveA(sleeveA);
    if (!r.ok) return r;
    var cubs = r.cubics, Ub = r.Ub, Uf = r.Uf, H = r.hemY, W = r.W, XL = Ub.x, XR = Uf.x, SP = cp(r.sp), X0 = SP.x;
    var xs = [X0 - a - s, X0 - a, X0 + a, X0 + a + s];   // 뒤 바깥 · 뒤 안쪽 · 앞 안쪽 · 앞 바깥 절개
    if (!(XL < xs[0] - TOL && XR > xs[3] + TOL)) return fail("cut-outside-sleeve", { innerOffsetCm: a, cutSpacingCm: s, backHalfCm: X0 - XL, frontHalfCm: XR - X0 }, true);
    // Ⓐ 소매산을 다섯 호로: 뒤 바깥 · 뒤 안쪽 띠 · 가운데 띠(SP) · 앞 안쪽 띠 · 앞 바깥
    var arcs = [], rest = cubs;
    for (var i = 0; i < 4; i++) { var sp1 = splitListAtX(rest, xs[i]); if (!sp1 || !sp1[0].length || !sp1[1].length) return fail("no-cap-intersection", xs[i]); arcs.push(sp1[0]); rest = sp1[1]; }
    arcs.push(rest);
    var capY = xs.map(function (x) { return cp(arcs[xs.indexOf(x) + 1][0][0]); });   // 절개선 × 소매산(Ⓐ)
    // 평행 이동(회전 없음): 가운데 고정 · 안쪽 띠 ±g · 바깥 조각 ±2g
    var DX = [-2 * g, -g, 0, g, 2 * g];
    var T = function (k) { return function (p) { return { x: p.x + DX[k], y: p.y }; }; };
    var Tinv = function (k) { return function (p) { return { x: p.x - DX[k], y: p.y }; }; };
    var pieceArcs = arcs.map(function (cs, k) { return mapList(cs, T(k)); });

    // 턱 4곳(바깥쪽으로 접음): 접는 조각(위층) = 중심 쪽, 맞출 조각 = 바깥. side = 접는 조각이 놓인 쪽(+1 오른쪽 / −1 왼쪽) = 중심 방향.
    //   겹 폭 w = g/2 — 접은 상태(Ⓐ)에서 겹은 [c, c + side·w] (접는 조각 아래). 펼침: 첫 겹 = 접는 조각 이동 ∘ 절개선 거울 · 둘째 겹 = 맞출 조각 이동.
    var w = g / 2;
    var tucks = [
      { id: "back-outer", k: 0, crease: 1, place: 0, side: +1, room: s },
      { id: "back-inner", k: 1, crease: 2, place: 1, side: +1, room: a },   // 가운데 띠 아래에 뒤·앞 두 턱의 겹이 함께 들어간다(각 a 까지)
      { id: "front-inner", k: 2, crease: 2, place: 3, side: -1, room: a },
      { id: "front-outer", k: 3, crease: 3, place: 4, side: -1, room: s }
    ];
    var TK = {};
    for (var ti = 0; ti < tucks.length; ti++) {
      var tk = tucks[ti], c = xs[tk.k], P = capY[tk.k];
      if (!(w <= tk.room + TOL)) return fail("tuck-layer-exceeds-piece", { tuck: tk.id, layerCm: w, pieceCm: tk.room }, true);
      var legCm = H - P.y;
      if (!(se < legCm - TOL)) return fail("stitch-end-beyond-cap", { tuck: tk.id, stitchEndCm: se, legCm: legCm }, true);
      var refl = (function (cc) { return function (p) { return { x: 2 * cc - p.x, y: p.y }; }; })(c);
      var Tc = T(tk.crease), Tp = T(tk.place);
      var lo = Math.min(c, c + tk.side * w), hi = Math.max(c, c + tk.side * w);
      var portion = subArc(cubs, lo, hi);
      if (!portion) return fail("no-cap-intersection", { tuck: tk.id });
      var l2 = mapList(portion, Tp), l1 = revList(mapList(portion, function (p) { return Tc(refl(p)); }));
      var mouth = tk.side > 0 ? l2.concat(l1) : l1.concat(l2);   // 왼쪽 → 오른쪽
      var Mh = { x: c + tk.side * w, y: H };
      var midCap = Tp({ x: c + tk.side * w, y: tk.side > 0 ? portion[portion.length - 1][3].y : portion[0][0].y });
      var midGap = Math.max(dist(Tc(refl(Mh)), Tp(Mh)), dist(Tc(refl({ x: Mh.x, y: midCap.y })), midCap));
      if (!(midGap < FOLD_TOL)) return fail("fold-mid-mismatch", { tuck: tk.id, gapCm: midGap });
      TK[tk.id] = { def: tk, c: c, refl: refl, legCm: legCm, mouth: mouth, mouthLen: cubicsLen(mouth), midGap: midGap,
        capCrease: Tc(P), capPlace: Tp(P), capMid: midCap, hemCrease: Tc({ x: c, y: H }), hemPlace: Tp({ x: c, y: H }), hemMid: Tp(Mh),
        stitchCrease: Tc({ x: c, y: H - se }), stitchPlace: Tp({ x: c, y: H - se }), stitchMid: Tp({ x: Mh.x, y: H - se }) };
    }
    // 소매산(재단선): 조각 호 + 턱 입구(왼쪽 → 오른쪽)
    var cap = [].concat(pieceArcs[0], TK["back-outer"].mouth, pieceArcs[1], TK["back-inner"].mouth, pieceArcs[2], TK["front-inner"].mouth, pieceArcs[3], TK["front-outer"].mouth, pieceArcs[4]);
    var joinGap = 0; for (var j = 1; j < cap.length; j++) joinGap = Math.max(joinGap, dist(cap[j - 1][3], cap[j][0]));
    if (!(joinGap < 1e-9)) return fail("discontinuous", { cap: joinGap });
    for (var j2 = 1; j2 < cap.length; j2++) cap[j2][0] = cp(cap[j2 - 1][3]);
    var UbM = T(0)(Ub), UfM = T(4)(Uf), B0M = T(0)({ x: XL, y: H }), F0M = T(4)({ x: XR, y: H }), Ccen = { x: X0, y: H };
    // 소맷부리(앞 바깥 → 뒤 바깥 = 오른쪽 → 왼쪽): 직선 위 이음점(조각 끝·턱 입구 중간선·중심)
    var Tfo = TK["front-outer"], Tfi = TK["front-inner"], Tbi = TK["back-inner"], Tbo = TK["back-outer"];
    var hemPts = [F0M, Tfo.hemPlace, Tfo.hemMid, Tfo.hemCrease, Tfi.hemPlace, Tfi.hemMid, Tfi.hemCrease, Ccen, Tbi.hemCrease, Tbi.hemMid, Tbi.hemPlace, Tbo.hemCrease, Tbo.hemMid, Tbo.hemPlace, B0M];
    for (var hp = 1; hp < hemPts.length; hp++) if (!(hemPts[hp].x < hemPts[hp - 1].x - 1e-12) || Math.abs(hemPts[hp].y - H) > 1e-12) return fail("hem-order", hp);
    var hemCs = []; for (var h0 = 1; h0 < hemPts.length; h0++) hemCs.push(lineCubic(hemPts[h0 - 1], hemPts[h0]));
    var outline = [pathOf(cap, "cap"), L(UfM, F0M, "side-seam-front"), pathOf(hemCs, "hem"), L(B0M, UbM, "side-seam-back")];

    // 접기 검증(최종 geometry 에서 표본 → 접기 변환): 조각 = 평행 역이동 · 첫 겹 = 거울 ∘ 접는 조각 역이동 · 둘째 겹 = 맞출 조각 역이동.
    //   접은 소매산 = Ⓐ 소매산 위 · 접은 소맷부리 = y = H · 겹은 접는 조각 아래 [c, c + side·w] · 왕복 · 접은 조각이 Ⓐ 를 빈틈 없이 한 줄로.
    // 접은 점 → Ⓐ 소매산까지의 편차(2026-10-28). 바깥 조각 끝 표본은 평행 이동(+DX)·역이동(−DX)의 부동소수 왕복으로 Ⓐ 끝(Ub.x·Uf.x)을
    //   1ulp(~1e-15cm) 넘어갈 수 있다 — 그때 yAtX 가 NaN 을 돌려 접기 검사가 «fold-mismatch(null)» 로 떨어졌다(강체 불변식 위반이 아닌 비교 정의역 문제).
    //   정의역 밖 거리(넘친 x)는 편차에 그대로 더해 판정한다: 끝점 y 와의 차와 넘친 x 중 큰 값 — 넘침이 FOLD_TOL 을 넘으면 여전히 실패(종이 밖).
    //   정의역 안에서 값을 못 구하면(NaN) 무한대로 실패시킨다(조용한 통과 없음).
    var capDev = function (fp) {
      var x = fp.x, over = 0;
      if (x < XL) { over = XL - x; x = XL; } else if (x > XR) { over = x - XR; x = XR; }
      var y = yAtX(cubs, x);
      return fin(y) ? Math.max(over, Math.abs(fp.y - y)) : Infinity;
    };
    var foldDev = 0, layerDev = 0, rangeDev = 0, roundTrip = 0;
    var capOwners = [], hemOwners = [];
    var pushN = function (arr, n, o) { for (var q = 0; q < n; q++) arr.push(o); };
    pushN(capOwners, pieceArcs[0].length, { kind: "piece", k: 0 });
    [["back-outer", 1], ["back-inner", 2], ["front-inner", 3], ["front-outer", 4]].forEach(function (e) {
      var d = TK[e[0]], n2 = d.mouth.length / 2;
      if (d.def.side > 0) { pushN(capOwners, n2, { kind: "layer2", tuck: e[0] }); pushN(capOwners, n2, { kind: "layer1", tuck: e[0] }); }
      else { pushN(capOwners, n2, { kind: "layer1", tuck: e[0] }); pushN(capOwners, n2, { kind: "layer2", tuck: e[0] }); }
      pushN(capOwners, pieceArcs[e[1]].length, { kind: "piece", k: e[1] });
    });
    hemOwners = [{ kind: "piece", k: 4 }, { kind: "layer2", tuck: "front-outer" }, { kind: "layer1", tuck: "front-outer" }, { kind: "piece", k: 3 },
      { kind: "layer2", tuck: "front-inner" }, { kind: "layer1", tuck: "front-inner" }, { kind: "piece", k: 2 }, { kind: "piece", k: 2 },
      { kind: "layer1", tuck: "back-inner" }, { kind: "layer2", tuck: "back-inner" }, { kind: "piece", k: 1 }, { kind: "layer1", tuck: "back-outer" },
      { kind: "layer2", tuck: "back-outer" }, { kind: "piece", k: 0 }];
    var foldOf = function (o) {
      if (o.kind === "piece") return Tinv(o.k);
      var d = TK[o.tuck]; if (o.kind === "layer2") return Tinv(d.def.place);
      var ti2 = Tinv(d.def.crease); return function (p) { return d.refl(ti2(p)); };
    };
    var unfoldOf = function (o) {
      if (o.kind === "piece") return T(o.k);
      var d = TK[o.tuck]; if (o.kind === "layer2") return T(d.def.place);
      var t2 = T(d.def.crease); return function (p) { return t2(d.refl(p)); };
    };
    var foldedPieces = { cap: [], hem: [] };
    var check = function (segs, owners, devOf, which) {
      if (segs.length !== owners.length) return "owner-count";
      for (var k = 0; k < segs.length; k++) {
        var o = owners[k], q = segs[k], f = foldOf(o), u = unfoldOf(o), lo2 = Infinity, hi2 = -Infinity;
        for (var t = 0; t <= 16; t++) {
          var p = cubicAt(q, t / 16), fp = f(p);
          roundTrip = Math.max(roundTrip, dist(u(fp), p));
          var dev = devOf(fp);
          if (o.kind === "piece") foldDev = Math.max(foldDev, dev); else layerDev = Math.max(layerDev, dev);
          lo2 = Math.min(lo2, fp.x); hi2 = Math.max(hi2, fp.x);
          if (o.kind !== "piece") { var d = TK[o.tuck], r0 = Math.min(d.c, d.c + d.def.side * w), r1 = Math.max(d.c, d.c + d.def.side * w); rangeDev = Math.max(rangeDev, Math.max(0, r0 - fp.x, fp.x - r1)); }
        }
        if (o.kind === "piece") foldedPieces[which].push({ k: o.k, from: lo2, to: hi2, cm: cubicLen(mapList([q], f)[0]) });
      }
      return null;
    };
    var e1 = check(cap, capOwners, capDev, "cap"), e2 = check(hemCs, hemOwners, function (fp) { return Math.abs(fp.y - H); }, "hem");
    if (e1 || e2) return fail("fold-owner-mismatch", e1 || e2);
    if (!(foldDev < FOLD_TOL)) return fail("fold-mismatch", foldDev);
    if (!(layerDev < FOLD_TOL && rangeDev < FOLD_TOL)) return fail("fold-layer-mismatch", { onACm: layerDev, rangeCm: rangeDev });
    if (!(roundTrip < FOLD_TOL)) return fail("fold-round-trip", roundTrip);
    var tile = function (arr) {
      var v = arr.slice().sort(function (p, q) { return p.from - q.from; }), gap = Math.abs(v[0].from - XL) + Math.abs(v[v.length - 1].to - XR);
      for (var k = 1; k < v.length; k++) gap = Math.max(gap, Math.abs(v[k].from - v[k - 1].to));
      return { gap: gap, cm: v.reduce(function (t, p) { return t + p.cm; }, 0) };
    };
    var capTile = tile(foldedPieces.cap), hemTile = tile(foldedPieces.hem);
    if (!(capTile.gap < FOLD_TOL && hemTile.gap < FOLD_TOL)) return fail("folded-gap", { cap: capTile.gap, hem: hemTile.gap });

    var loop = flattenCubics(cap, FLAT_N);
    loop.push(cp(F0M)); flattenCubics(hemCs, FLAT_N).slice(1).forEach(function (p) { loop.push(p); }); loop.push(cp(UbM));
    var closeGap = dist(loop[loop.length - 1], loop[0]);
    if (!(closeGap < JOIN)) return fail("discontinuous", closeGap);
    if (loopSelfIntersects(loop)) return fail("self-intersection");   // 펼친 재단선(평면) — 접힌 겹의 포개짐은 정상 접힘이라 여기서 보지 않는다

    var construction = [L(SP, Ccen, "center-line")];
    tucks.forEach(function (tk) {
      var d = TK[tk.id], push = function (p, q, role) { var sg = L(p, q, role); sg.tuck = tk.id; construction.push(sg); };
      push(d.capCrease, d.hemCrease, "tuck-crease-edge"); push(d.capPlace, d.hemPlace, "tuck-place-edge"); push(d.capMid, d.hemMid, "tuck-mid");   // 절개 변(접는 선·맞출 선) · 접힘 중간선
      push(d.hemCrease, d.stitchCrease, "tuck-crease"); push(d.hemPlace, d.stitchPlace, "tuck-place"); push(d.stitchCrease, d.stitchPlace, "tuck-stitch-end");   // 소맷부리 박음(박기 끝)
    });
    var geometry = { outline: outline, construction: construction, capSplit: { x: X0 } };
    var hl = hemLengthsOf(geometry), cl = capLengthsOf(geometry);
    if (!hl) return fail("hem-unmeasured");
    if (!cl) return fail("cap-unmeasured");

    var flatArc = function (cs) { var o = []; cs.forEach(function (q, i) { for (var k = (i ? 1 : 0); k <= 24; k++) o.push(cubicAt(q, k / 24)); }); return o; };
    var B0 = { x: XL, y: H }, F0 = { x: XR, y: H };
    var bottoms = [[{ x: xs[0], y: H }, B0], [{ x: xs[1], y: H }, { x: xs[0], y: H }], [{ x: xs[2], y: H }, { x: xs[1], y: H }], [{ x: xs[3], y: H }, { x: xs[2], y: H }], [F0, { x: xs[3], y: H }]];
    var keys = ["backOuter", "backInner", "center", "frontInner", "frontOuter"], pieces = {};
    keys.forEach(function (k, i) { pieces[k] = flatArc(arcs[i]).concat(bottoms[i]).map(function (p) { return cp(T(i)(p)); }); });
    for (var pa = 0; pa < 5; pa++) for (var pb = pa + 1; pb < 5; pb++) {
      var A1 = pieces[keys[pa]].concat([pieces[keys[pa]][0]]), B1 = pieces[keys[pb]].concat([pieces[keys[pb]][0]]);
      for (var ia = 1; ia < A1.length; ia++) for (var ib = 1; ib < B1.length; ib++) if (segCross(A1[ia - 1], A1[ia], B1[ib - 1], B1[ib])) return fail("pieces-overlap", { pieces: [keys[pa], keys[pb]] }, true);
    }
    var ahc = r.armholeCm, am = sleeveA.meta;
    var easeSewn = (ahc && fin(ahc.back) && fin(ahc.front)) ? { back: cl.sewn.back - ahc.back, front: cl.sewn.front - ahc.front, total: cl.sewn.total - ahc.back - ahc.front } : null;
    var tuckMeta = {};
    tucks.forEach(function (tk) {
      var d = TK[tk.id];
      tuckMeta[tk.id] = { cutX: d.c, spreadCm: g, layerWidthCm: w, legCm: d.legCm, direction: "바깥쪽(소매 밑선 쪽)",
        crease: keys[tk.crease] + " 의 절개 변(중심 쪽)", place: keys[tk.place] + " 의 절개 변(바깥)", topLayer: keys[tk.crease], layersUnder: keys[tk.crease] + " 아래 두 겹(각 " + w + " cm)",
        cap: { crease: cp(d.capCrease), place: cp(d.capPlace), mid: cp(d.capMid), mouthCutCm: d.mouthLen, stitchEndCm: null, stitchEndStatus: "미지정 — 책에 수치 없음(박음 모양도 만들지 않음)" },
        hem: { crease: cp(d.hemCrease), place: cp(d.hemPlace), mid: cp(d.hemMid), stitchEndCm: se, stitch: { crease: cp(d.stitchCrease), place: cp(d.stitchPlace), mid: cp(d.stitchMid) },
          band: [d.hemCrease, d.hemMid, d.hemPlace, d.stitchPlace, d.stitchMid, d.stitchCrease].map(cp) },
        gap: [d.capPlace, d.capCrease, d.hemCrease, d.hemPlace].map(cp), midJoinCm: d.midGap };
    });
    var capKink = []; for (var ck = 1; ck < cap.length; ck++) capKink.push(angleBetween(cubicD1(cap[ck - 1], 1), cubicD1(cap[ck], 0)));
    return {
      ok: true,
      geometry: geometry,
      meta: {
        rule: "pattern-school-p47-tucked-sleeve-O(2026-10-21)",
        widthCm: W, widthAfterCm: dist(UbM, UfM), sleeveLengthCm: r.sleeveLengthCm,
        settings: { innerOffsetCm: a, cutSpacingCm: s, spreadCm: g, stitchEndCm: se,
          defaults: { sleeveLengthCm: SLEEVE_LENGTH_DEFAULT, innerOffsetCm: INNER_OFFSET_DEFAULT, cutSpacingCm: CUT_SPACING_DEFAULT, spreadCm: SPREAD_DEFAULT, stitchEndCm: STITCH_END_DEFAULT },
          note: "책 기본 설정값(김님 2026-10-21) — 수정 가능, 산식·불변 규칙 아님",
          bookDimension: "도해 «2.5»(위) = 가운데 띠 폭 = 2 × 안쪽 절개 위치 1.25 — 중심→절개 2.5 가 아니다(2026-10-21 정정)" },
        cutLines: { count: CUTS, x: { backOuter: xs[0], backInner: xs[1], frontInner: xs[2], frontOuter: xs[3] }, centerStripCm: 2 * a, centerCut: false },
        spread: { perGapCm: g, totalCm: 4 * g, shiftCm: { backOuter: DX[0], backInner: DX[1], center: 0, frontInner: DX[3], frontOuter: DX[4] }, parallel: true, rotationDeg: 0,
          order: "가운데 띠(SP·중심선) 고정 · 안쪽 띠 ±g · 바깥 조각 ±2g 평행 이동" },
        tucks: tuckMeta,
        stitchEnd: { hemCm: se, capCm: null, capStatus: "미지정 — 책에 수치 없음",
          model: "소맷부리 ~ 박기 끝(다리를 따라 " + se + " cm) 띠에서 두 다리가 맞붙어 접힌 채 박힘. 소매산 쪽도 같은 방향으로 접혀 박히지만 길이는 미지정",
          effect: "재단선은 접은 띠의 가장자리(소매산·소맷부리)에서 정해지므로 박기 끝 길이로 모양이 바뀌지 않는다 · 박기 끝은 절개 다리(소매산 → 소맷부리)보다 짧아야 한다",
          seamShape: "책에 없는 박음 모양은 만들지 않음" },
        folded: { model: "턱을 바깥쪽으로 접은 상태 = 조각이 Ⓐ 자리(평행 이동) — 소매산·소맷부리 모두 Ⓐ 선", maxDevCm: foldDev, layersOnAMaxCm: layerDev, layerRangeMaxCm: rangeDev,
          roundTripMaxCm: roundTrip, tileGapCm: { cap: capTile.gap, hem: hemTile.gap }, capSewnCm: capTile.cm, hemSewnCm: hemTile.cm,
          truing: "불필요 — 접은 소매산·소맷부리가 Ⓐ 선이라 꺾임이 없다(파임 0 · 덧댐 0)", cutCm: 0, addedCm: 0 },
        hem: { points: hemPts.map(cp), cutCm: hl.cut.total, sewnCm: hl.sewn.total, hiddenCm: hl.hidden.total, cut: hl.cut, sewn: hl.sewn, hidden: hl.hidden, sewnFoldedCm: hemTile.cm,
          formulaCutCm: W + 4 * g, formulaSewnCm: W, formulaNote: "참고 W + 틈 합 · W — 권위값은 최종 geometry 실측", straight: true },
        cap: { cutCm: cl.cut.total, sewnCm: cl.sewn.total, cut: cl.cut, sewn: cl.sewn, hidden: cl.hidden, sewnFoldedCm: capTile.cm, kinkDeg: capKink,
          method: "접은 상태(Ⓐ 소매산)를 거울/평행 역변환으로 펼침 — 턱 입구 모양은 접기로 정해진다(책 V 모양을 흉내 내지 않음) · 재제도 없음 · 소매산 개더 없음" },
        centerLength: { inputCm: r.sleeveLengthCm, spreadCm: H - SP.y, note: "가운데 띠 고정 — 중심 길이 = 입력 그대로" },
        seams: { backCm: dist(UbM, B0M), frontCm: dist(UfM, F0M) },
        rigid: { pieces: pieces, note: "평행 이동 직후(감사·표시용 원래 종이 5조각) — 최종 geometry 가 권위값" },
        sp: cp(SP), capSplit: { point: cp(SP) },
        underarm: { before: { back: cp(Ub), front: cp(Uf) }, after: { back: cp(UbM), front: cp(UfM) } },
        capLengths: { back: cl.sewn.back, front: cl.sewn.front, total: cl.sewn.total, cut: cl.cut, measure: "Gauss-Legendre(final curve) · 봉제 = 턱 입구(접혀 들어가는 두 겹) 제외 · 앞/뒤 분할 = SP(중심선)" },
        capLengthsA: am.capLengths ? JSON.parse(JSON.stringify(am.capLengths)) : null,
        armholeCm: ahc ? { back: ahc.back, front: ahc.front } : null,
        easeAfter: easeSewn, easeBasis: "턱을 접은(봉제) 소매산 길이 − AH", easeSourceA: am.easeAfter ? JSON.parse(JSON.stringify(am.easeAfter)) : null,
        checks: { closed: true, connected: true, maxGapCm: Math.max(joinGap, closeGap), selfIntersection: false, singlePiece: true, piecesOverlap: false,
          foldRoundTripCm: roundTrip, tuckMidJoinMaxCm: Math.max(Tfo.midGap, Tfi.midGap, Tbi.midGap, Tbo.midGap) }
      },
      warnings: [],
      sourceSleeveAHash: hashStr(JSON.stringify({ geometry: sleeveA.geometry, meta: sleeveA.meta }))
    };
  }

  // 최종 geometry 에서 길이 실측 — 재단(펼친 재단선 전체)과 봉제(턱 접음: 턱 입구 = 접는 선 모서리 ~ 맞출 선 모서리 제외).
  //   소맷부리: tuck-crease / tuck-place 의 from(소맷부리 끝), 분할 = center-line.to. 소매산: tuck-crease-edge / tuck-place-edge 의 from(소매산 끝), 분할 = center-line.from(SP).
  function lengthsAlong(path, splitP, pairs) {
    var cs = cubicsOfPath(path), anchors = [cs[0][0]], acc = [0];
    cs.forEach(function (q) { anchors.push(q[3]); acc.push(acc[acc.length - 1] + cubicLen(q)); });
    var idxOf = function (p) { var best = -1, bd = Infinity; anchors.forEach(function (an, i) { var d = dist(an, p); if (d < bd) { bd = d; best = i; } }); return bd < 1e-6 ? best : -1; };
    var iS = idxOf(splitP);
    if (iS <= 0 || iS >= anchors.length - 1) return null;
    var total = acc[acc.length - 1], first = acc[iS], hidden = { first: 0, second: 0 };
    for (var k = 0; k < pairs.length; k++) {
      var i0 = idxOf(pairs[k][0]), i1 = idxOf(pairs[k][1]);
      if (i0 < 0 || i1 < 0 || i0 === i1) return null;
      var lo = Math.min(i0, i1), hi = Math.max(i0, i1), seg = acc[hi] - acc[lo];
      if (hi <= iS) hidden.first += seg; else if (lo >= iS) hidden.second += seg; else return null;
    }
    return { total: total, first: first, second: total - first, hidden: hidden, split: cp(anchors[iS]), splitIndex: iS };
  }
  function pairsOf(geometry, creaseRole, placeRole) {
    var cr = geometry.construction.filter(function (s) { return s.role === creaseRole; }), pl = geometry.construction.filter(function (s) { return s.role === placeRole; });
    if (cr.length !== 4 || pl.length !== 4) return null;
    var out = [];
    for (var k = 0; k < 4; k++) { var p = pl.filter(function (s) { return s.tuck === cr[k].tuck; })[0]; if (!p) return null; out.push([cr[k].from, p.from]); }
    return out;
  }
  function hemLengthsOf(geometry) {   // 소맷부리는 앞 바깥 → 뒤 바깥: first = 앞
    if (!geometry || !Array.isArray(geometry.outline) || !Array.isArray(geometry.construction)) return null;
    var hemS = geometry.outline.filter(function (s) { return s && s.role === "hem" && s.kind === "path"; })[0], cl = geometry.construction.filter(function (s) { return s.role === "center-line"; })[0];
    var pairs = pairsOf(geometry, "tuck-crease", "tuck-place");
    if (!hemS || !cl || !pairs) return null;
    var m = lengthsAlong(hemS, cl.to, pairs); if (!m) return null;
    return { cut: { front: m.first, back: m.second, total: m.total }, sewn: { front: m.first - m.hidden.first, back: m.second - m.hidden.second, total: m.total - m.hidden.first - m.hidden.second },
      hidden: { front: m.hidden.first, back: m.hidden.second, total: m.hidden.first + m.hidden.second }, split: m.split, splitIndex: m.splitIndex };
  }
  function capLengthsOf(geometry) {   // 소매산은 뒤 → 앞: first = 뒤
    if (!geometry || !Array.isArray(geometry.outline) || !Array.isArray(geometry.construction)) return null;
    var capS = geometry.outline.filter(function (s) { return s && s.role === "cap" && s.kind === "path"; })[0], cl = geometry.construction.filter(function (s) { return s.role === "center-line"; })[0];
    var pairs = pairsOf(geometry, "tuck-crease-edge", "tuck-place-edge");
    if (!capS || !cl || !pairs) return null;
    var m = lengthsAlong(capS, cl.from, pairs); if (!m) return null;
    return { cut: { back: m.first, front: m.second, total: m.total }, sewn: { back: m.first - m.hidden.first, front: m.second - m.hidden.second, total: m.total - m.hidden.first - m.hidden.second },
      hidden: { back: m.hidden.first, front: m.hidden.second, total: m.hidden.first + m.hidden.second }, split: m.split, splitIndex: m.splitIndex };
  }

  window.designSleeveO = Object.freeze({ draftSleeveO: draftSleeveO, readSleeveA: readSleeveA, hemLengthsOf: hemLengthsOf, capLengthsOf: capLengthsOf,
    RULES: Object.freeze({ sleeveLengthDefaultCm: SLEEVE_LENGTH_DEFAULT, innerOffsetDefaultCm: INNER_OFFSET_DEFAULT, cutSpacingDefaultCm: CUT_SPACING_DEFAULT, spreadDefaultCm: SPREAD_DEFAULT,
      stitchEndDefaultCm: STITCH_END_DEFAULT, capStitchEndCm: null, cuts: CUTS, foldTolCm: FOLD_TOL }) });
})();
