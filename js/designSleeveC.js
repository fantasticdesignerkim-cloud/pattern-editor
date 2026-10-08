// ══════════════════════════════════════════════
// designSleeveC.js — 소매 Ⓒ 엔진 코어([패턴학교] P.41 하단 «소맷부리 치수를 결정하고 인체 곡선을 고려해 그린 뒤 맞댄다», 뒤 소맷부리 다트). 순수.
//
// UI·프리셋·체크포인트·apply 연결은 하지 않는다(엔진 코어 범위). designSleeveA/B.js 는 건드리지 않는다. 입력은 완성 Ⓐ({geometry, meta}) 읽기 전용, 반환은 전부 새 객체.
//
// 김님 확정(2026-10-07): 완성 소맷부리 세 구간 = 뒤 바깥 ● : 중앙 2● : 앞 바깥 ● = 1:2:1 **우선**(● = W×3/16, 소맷부리 목표 W×3/4) · 앞 겹침 «정확히 1cm» **철회 — 겹침량은 치수별 계산**
//   (B83 ≈ 1.487) · EL(SP→팔꿈치선) 기본 31.4, params.elbowLengthCm 로 수정 · EL 위 절개축 = 앞·뒤 각 반폭의 중점 · EL 아래는 1:2:1 경계점(중심선 ∓●, C)으로 꺾음(중앙 조각이 사다리꼴로 좁아짐)
//   · 앞 겹침 처리 뒤 뒤 다트 역산 · 최종 열린 뒤 다트(EL 꼭짓점~소맷부리) · **앞 EL 절개는 겹치는 것이다 — 열린 앞 다트·종이 보충 아님**.
//
// 조각 변환(2026-10-07 재검토 — P.41 하단 도해와 수치로 확인):
//   · 소맷부리선이 경계점 C 를 지나고 앞 구간이 정확히 ● 가 되며 앞 바깥 조각이 **강체**인 회전은 중심이 앞 절개축(x = aF) 위에 있을 때만 성립한다(중심~소맷부리선 거리 D, 중심~C = √(D²+(aF−●)²) →
//     피타고라스로 A'C = aF−● = Of−●, 앞 구간 |F'C| = ● 가 항등식. 회전각 γ = 2·atan((aF−●)/D)). 축 위 어느 점이든 같은 항등식이지만 **회전 중심이 EL 점이면 EL 선(옆선 쪽)에 쐐기 틈이 열린다**
//     (이전 시도 — 미해결의 원인). 쐐기가 없으려면 앞 바깥 조각이 절개축 위 끝에서 아래까지 한 덩어리로 돌아야 한다.
//   · 앞 바깥 조각(소매산 앞부분~옆선~소맷부리)을 **절개축 위 끝(소매산 교점 P_f)** 중심으로 **한 덩어리** 회전한다: 절개축 전체(P_f→소맷부리)가 겹침 렌즈(꼭짓점 P_f, 아래로 갈수록 넓어짐 —
//     도해의 «EL 위 접힌 부분(겹친다)»)가 되고, EL 에서는 중앙 조각의 꺾임(수직→E→C 기울기)이 있을 뿐 겹침이 끊기지 않는다. 옆선은 회전해도 직선·길이 불변(재작도 없음), 종이를 더하지 않는다.
//   · 소매산: 중앙 조각·뒤 소매산·SP 는 Ⓐ 자리 그대로, 앞 소매산은 P_f 에서 쪼개 아랫점쪽 조각만 강체 회전(raw — 길이·지배 ease 불변, P_f 에 회전각 γ 의 꺾임). **김님 승인(2026-10-07)**: P_f 주변 [P_f−ℓ, P_f+ℓ] 를
//     끝점·접선 고정 Hermite 한 개로 정리해 꺾임을 없앤다(호 길이 보존 — 앞/뒤 소매산 길이·이세 불변, 뒤 소매산·SP·회전 후 앞 아랫점 유지). 이 구간에 한해 «소매산 비트 동일» 요구는 대체됐다. raw 는 meta.rigid 감사용, 최종 geometry 가 권위값.
//   · 뒤: 뒤 구간 = ● → 뒤 바깥 조각은 Ⓐ 자리(회전 없음), 안쪽 변만 E_b → D(뒤 모서리에서 ●) 다리 2. 바깥 변 Ob = |aB| 라 중앙 변 좁아짐 = 덜어냄 → 다트는 절개축 대칭, **두 다리 길이가 항등식으로 같다**.
//   · 소맷부리 정리(같은 승인): 앞/중앙 이음(raw 꺾임 γ)과 뒤 다트 닫힘 이음(raw 꺾임 13~25°)을 국소 Hermite 로 정리한다. 다트 이음은 **다트를 닫은 상태**에서 정리하고(다트선에 대칭 → 소맷부리가 다리에 수직) 열린 평면으로 복원한다.
//     볼록 곡선이라 호 길이가 줄어드는 만큼은 공차로 덮지 않고 raw 의 두 자유도(앞 회전각 · 뒤 다트 가상 모서리)로 보정해 최종 곡선 호 길이 구간(뒤 바깥 ●, 앞 모서리~다트 모서리 3●)을 정확히 맞춘다. 보정량은 meta.fairing.compensation 에 기록.
//   · 윤곽 = 이 변환들의 **합집합 경계**(겹친 내부 경계는 윤곽에 없다). 뒤 열린 다트의 두 다리는 보존. 모듈이 단일 조각·연속·자기교차 없음·G1·호 길이 구간을 검산한다.
// 반환 { ok, geometry:{outline, construction}, meta, warnings, sourceSleeveAHash } | { ok:false, reason, detail?, outOfSupportedRange? }.
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var DEFAULT_EL = 31.4;              // 팔꿈치 길이(SP → 팔꿈치선) 기본값 — params.elbowLengthCm 로 수정 가능
  var HEM_RATIO = 3 / 4;              // 소맷부리 = 소매 폭 × 3/4
  var SECTION_RATIO = [1, 2, 1];      // 뒤 바깥 : 중앙 : 앞 바깥
  var TOL = 1e-6, JOIN = 1e-9, SAMPLES = 400;
  // 지원 범위 한계(책 수치 아님 — designSleeveCCheck 스윕 실측으로 확정, docs/book/P041.md). 봉제 허용치가 아니다.
  var CHECK_TOL = 1e-9;               // 항등식·구간·다리 정합 대조 공차(수치 반올림 수준)
  var MAX_ROTATION = Math.PI / 6;     // 앞 회전 한계(30°)
  var MIN_LOWER = 1.0;                // EL → 소맷부리 최소 길이
  var MIN_UPPER = 0.5;                // 아랫점·절개축 교점이 EL 보다 위에 있어야 하는 최소 간격
  var MAX_DART_ANGLE = 45 * Math.PI / 180;   // 뒤 다트 꼭짓점각 상한
  var MIN_DART_WIDTH = 0.1;           // 뒤 다트 폭 하한(cm) — 퇴화 다트 차단
  var MAX_TURN = 150 * Math.PI / 180; // 윤곽 꼭짓점(다트 꼭짓점 제외) 꺾임 상한 — 스파이크 차단
  var FLAT_N = 24;                    // 자기교차 검산용 곡선 표본 수(cubic 당)
  var CAP_LEN_TOL = 1e-9;             // 소매산 앞부분 길이 보존 대조(Gauss-Legendre 길이 오차 수준 — 수치 오차)
  // fairing(꼭짓점 정리) — 2026-10-07 김님 승인: 소매산 P_f 이음·소맷부리 앞/중앙 이음·뒤 다트 닫힘 이음의 접선 꺾임을 국소 Hermite 로 없앤다. 아래 값은 책 수치가 아니라 구현 관례 / sweep 실측 검증 한계다.
  var FAIR_LEN = 2.0;                 // 정리 구간 반길이 ℓ 상한(cm, 호 길이) — 소매산은 인접 호의 40% 도 넘지 않는다
  var FAIR_RATIO = 0.4;               // ℓ ≤ 인접 호(소맷부리는 ●)의 40%
  var CAP_DEV_MAX = 0.05;             // 소매산 정리 형상 편차(강체 결과 대비 Hausdorff) 상한(cm) — 형상 편차 가드(수치 오차 아님)
  var CUFF_DEV_MAX = 0.5;             // 소맷부리 정리 형상 편차 상한(cm) — 형상 편차 가드
  var KAPPA_FLAT = 0.03;              // |κ| 이 미만이면 변곡으로 세지 않는 검증 공차(/cm, 수치 잡음 수준)
  var G1_TOL_DEG = 1e-9;              // 정리 이음의 접선 꺾임 허용(°) — 수치 반올림 수준(atan2 측정, sweep 최대 ≈1e-13)
  var EASE_A_TOL = 5e-5;              // Ⓐ 기록 capLengths(표본 길이)와 최종 곡선 GL 실측의 차 허용(cm) — Ⓐ 쪽 측정 오차 수준(수치 오차)

  function dist(a, b) { var dx = b.x - a.x, dy = b.y - a.y; return Math.sqrt(dx * dx + dy * dy); }
  function cp(p) { return { x: p.x, y: p.y }; }
  function fin(v) { return typeof v === "number" && isFinite(v); }
  function finPt(p) { return !!p && fin(p.x) && fin(p.y); }
  function L(a, b, role) { var s = { kind: "line", from: cp(a), to: cp(b) }; if (role) s.role = role; return s; }
  function hashStr(s) { var h = 0; for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return (h >>> 0).toString(16); }
  function cubicAt(q, t) {
    var u = 1 - t;
    return { x: u * u * u * q[0].x + 3 * u * u * t * q[1].x + 3 * u * t * t * q[2].x + t * t * t * q[3].x,
             y: u * u * u * q[0].y + 3 * u * u * t * q[1].y + 3 * u * t * t * q[2].y + t * t * t * q[3].y };
  }
  // 호 길이 — 구간 8등분 × 5점 Gauss-Legendre 로 |B'(t)| 적분(오차 ~1e-12). 분할·회전 전후 길이 보존 대조용.
  var GL_X = [0.0469100770306680, 0.2307653449471584, 0.5, 0.7692346550528416, 0.9530899229693320], GL_W = [0.1184634425280945, 0.2393143352496832, 0.2844444444444444, 0.2393143352496832, 0.1184634425280945];
  function cubicLen(q) {
    var s = 0, PAN = 8;
    var ax = 3 * (q[1].x - q[0].x), bx = 3 * (q[2].x - q[1].x), cx = 3 * (q[3].x - q[2].x);
    var ay = 3 * (q[1].y - q[0].y), by = 3 * (q[2].y - q[1].y), cy = 3 * (q[3].y - q[2].y);
    for (var k = 0; k < PAN; k++) for (var j = 0; j < 5; j++) {
      var t = (k + GL_X[j]) / PAN, u = 1 - t, w0 = u * u, w1 = 2 * u * t, w2 = t * t;
      var dx = w0 * ax + w1 * bx + w2 * cx, dy = w0 * ay + w1 * by + w2 * cy;
      s += GL_W[j] * Math.sqrt(dx * dx + dy * dy);
    }
    return s / PAN;
  }
  function cubicsLen(cubs) { var s = 0; cubs.forEach(function (q) { s += cubicLen(q); }); return s; }
  function reverseCubic(q) { return [cp(q[3]), cp(q[2]), cp(q[1]), cp(q[0])]; }
  function splitLeft(q, t) {   // De Casteljau — [0,t] 조각
    var l = function (a, b) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; };
    var p01 = l(q[0], q[1]), p12 = l(q[1], q[2]), p23 = l(q[2], q[3]);
    var p012 = l(p01, p12), p123 = l(p12, p23), p = l(p012, p123);
    return [cp(q[0]), p01, p012, p];
  }
  function splitRight(q, t) { return reverseCubic(splitLeft(reverseCubic(q), 1 - t)); }
  function degenerate(q) { return dist(q[0], q[3]) < JOIN && dist(q[0], q[1]) < JOIN && dist(q[0], q[2]) < JOIN; }
  function unitDir(a, b) { var d = dist(a, b); return d > 1e-12 ? { x: (b.x - a.x) / d, y: (b.y - a.y) / d } : null; }
  function startTan(q) { return unitDir(q[0], q[1]) || unitDir(q[0], q[2]) || unitDir(q[0], q[3]); }
  function endTan(q) { return unitDir(q[2], q[3]) || unitDir(q[1], q[3]) || unitDir(q[0], q[3]); }

  // ── Ⓐ 읽기(Ⓑ 와 같은 계약 — 소매산 cubic 연쇄 · 수직 밑선 · 수평 소맷부리) ──
  function readSleeveA(a) {
    if (!a || typeof a !== "object" || a.ok === false) return { ok: false, reason: "no-sleeve-a" };
    var g = a.geometry, m = a.meta;
    if (!g || !Array.isArray(g.outline) || g.outline.length !== 4 || !m || typeof m !== "object") return { ok: false, reason: "invalid-sleeve-a" };
    var cap = g.outline[0], sB = g.outline[1], sF = g.outline[2], hm = g.outline[3];
    if (!cap || cap.kind !== "path" || !Array.isArray(cap.commands) || cap.commands.length < 3 || cap.commands[0].type !== "M") return { ok: false, reason: "invalid-sleeve-a" };
    var cubs = [], cur = cap.commands[0].points[0];
    for (var i = 1; i < cap.commands.length; i++) {
      var c = cap.commands[i];
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
    return { ok: true, cubics: cubs, spIndex: k, sp: cp(sp), Ub: cp(Ub), Uf: cp(Uf), hemY: slen, W: W,
      armholeCm: m.armholeCm || null, sleeveLengthCm: slen };
  }

  // 소매산이 세로선 x = axisX 와 만나는 점들 중 가장 아래(y 최대) 교점 — 절개축 위 끝(소매산 P). { i, t, P } | null.
  function capCrossing(cubs, axisX) {
    var best = null;
    cubs.forEach(function (q, qi) {
      var prev = cubicAt(q, 0).x - axisX;
      for (var s = 1; s <= SAMPLES; s++) {
        var cur = cubicAt(q, s / SAMPLES).x - axisX;
        if ((prev < 0) !== (cur < 0) && prev !== cur) {
          var lo = (s - 1) / SAMPLES, hi = s / SAMPLES, flo = prev;
          for (var it = 0; it < 60; it++) { var mid = (lo + hi) / 2, fm = cubicAt(q, mid).x - axisX; if ((fm < 0) === (flo < 0)) { lo = mid; flo = fm; } else hi = mid; }
          var tt = (lo + hi) / 2, P = cubicAt(q, tt); if (!best || P.y > best.P.y) best = { i: qi, t: tt, P: P };
        }
        prev = cur;
      }
    });
    return best;
  }

  function crossSign(o, a, b) { return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x); }
  function segCross(a, b, c, d) {
    var d1 = crossSign(c, d, a), d2 = crossSign(c, d, b), d3 = crossSign(a, b, c), d4 = crossSign(a, b, d);
    return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
  }
  function loopSelfIntersects(loop) {
    var n = loop.length;
    for (var i = 0; i < n - 1; i++) for (var j = i + 2; j < n - 1; j++) {
      if (i === 0 && j === n - 2) continue;
      if (segCross(loop[i], loop[i + 1], loop[j], loop[j + 1])) return true;
    }
    return false;
  }
  function pathOf(cubs) {
    var cmds = [{ type: "M", points: [cp(cubs[0][0])] }];
    cubs.forEach(function (q) { cmds.push({ type: "C", points: [cp(q[1]), cp(q[2]), cp(q[3])] }); });
    return { kind: "path", commands: cmds };
  }
  function flattenCubics(cubs, n) {
    var out = [];
    cubs.forEach(function (q, ci) { for (var i = (ci === 0 ? 0 : 1); i <= n; i++) out.push(cubicAt(q, i / n)); });
    return out;
  }

  // ── fairing 보조(Ⓑ 의 검증된 구성과 같은 방식 — 끝점·접선 고정 Hermite, 호 길이 이분법) ──
  function advanceAlong(list, sArc) {   // 순서대로 이어진 cubic 목록을 시작점에서 호 길이 sArc 만큼 간 곳에서 자른다 → { before, after, pt, tan } | null
    var acc = 0;
    for (var i = 0; i < list.length; i++) {
      var q = list[i], li = cubicLen(q);
      if (acc + li >= sArc - 1e-12) {
        var lo = 0, hi = 1, need = Math.max(0, Math.min(li, sArc - acc));
        for (var it = 0; it < 52; it++) { var m = (lo + hi) / 2; if (cubicLen(splitLeft(q, m)) < need) lo = m; else hi = m; }
        var t = (lo + hi) / 2, left = splitLeft(q, t), right = splitRight(q, t);
        var before = list.slice(0, i).concat([left]).filter(function (c) { return !degenerate(c); });
        var after = [right].concat(list.slice(i + 1)).filter(function (c) { return !degenerate(c); });
        return { before: before, after: after, pt: cp(left[3]), tan: startTan(after[0] || right) };
      }
      acc += li;
    }
    return null;
  }
  function hermite(A, Ta, B, Tb, h) { return [cp(A), { x: A.x + h * Ta.x, y: A.y + h * Ta.y }, { x: B.x - h * Tb.x, y: B.y - h * Tb.y }, cp(B)]; }
  // 호 길이 = target 이 되는 핸들 스칼라 h∈(0, chord) — 거친 격자의 첫 부호 변화 구간을 이분. { h, q } | { error }
  function solveHandle(A, Ta, B, Tb, target) {
    var chord = dist(A, B);
    if (!(target > chord + 1e-12)) return { error: "length-below-chord" };
    var f = function (h) { return cubicLen(hermite(A, Ta, B, Tb, h)) - target; };
    var N = 40, prevH = 0, prevF = f(0), lo = null, hi = null;
    for (var i = 1; i <= N; i++) { var h = chord * i / N, fh = f(h); if (prevF < 0 && fh >= 0) { lo = prevH; hi = h; break; } prevH = h; prevF = fh; }
    if (lo === null) return { error: "length-unreachable" };
    for (var it = 0; it < 60; it++) { var m = (lo + hi) / 2; if (f(m) < 0) lo = m; else hi = m; }
    var hs = (lo + hi) / 2;
    return { h: hs, scale: hs / chord, q: hermite(A, Ta, B, Tb, hs) };
  }
  function kappaAt(q, t) {
    var u = 1 - t;
    var dx = 3 * (u * u * (q[1].x - q[0].x) + 2 * u * t * (q[2].x - q[1].x) + t * t * (q[3].x - q[2].x));
    var dy = 3 * (u * u * (q[1].y - q[0].y) + 2 * u * t * (q[2].y - q[1].y) + t * t * (q[3].y - q[2].y));
    var ex = 6 * (u * (q[2].x - 2 * q[1].x + q[0].x) + t * (q[3].x - 2 * q[2].x + q[1].x));
    var ey = 6 * (u * (q[2].y - 2 * q[1].y + q[0].y) + t * (q[3].y - 2 * q[2].y + q[1].y));
    var sp = Math.sqrt(dx * dx + dy * dy);
    return sp > 1e-12 ? (dx * ey - dy * ex) / (sp * sp * sp) : 0;
  }
  // 변곡 수 = 곡률 부호 구간 중 최대 |κ| ≥ flat 인 것들의 부호 변화 횟수(flat 미만 구간은 수치 잡음 수준이라 무시, flat = 0 이면 전부).
  function inflections(cubs, flat) {
    var runs = [];
    cubs.forEach(function (q) {
      for (var i = 0; i < 80; i++) {
        var k = kappaAt(q, (i + 0.5) / 80), a = Math.abs(k);
        if (a < 1e-9) continue;
        var sg = k > 0 ? 1 : -1;
        if (!runs.length || runs[runs.length - 1].sg !== sg) runs.push({ sg: sg, peak: a }); else runs[runs.length - 1].peak = Math.max(runs[runs.length - 1].peak, a);
      }
    });
    var n = 0, last = 0;
    runs.forEach(function (r) { if (r.peak < flat) return; if (last !== 0 && r.sg !== last) n++; last = r.sg; });
    return n;
  }
  function pointSegDist(p, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
    var ex = p.x - (a.x + t * dx), ey = p.y - (a.y + t * dy); return Math.sqrt(ex * ex + ey * ey);
  }
  function distToPoly(p, poly) { var m = Infinity; for (var i = 0; i < poly.length - 1; i++) m = Math.min(m, pointSegDist(p, poly[i], poly[i + 1])); return m; }
  function resample(poly, step) {
    var out = [cp(poly[0])];
    for (var i = 0; i < poly.length - 1; i++) {
      var d = dist(poly[i], poly[i + 1]), k = Math.max(1, Math.ceil(d / step));
      for (var j = 1; j <= k; j++) out.push({ x: poly[i].x + (poly[i + 1].x - poly[i].x) * j / k, y: poly[i].y + (poly[i + 1].y - poly[i].y) * j / k });
    }
    return out;
  }
  function hausdorff(a, b) {   // 두 점열(폴리라인)의 양방향 최대 거리 — 형상 편차(수치 오차와 구분)
    var pa = resample(a, 0.1), pb = resample(b, 0.1), m = 0, i;   // 표본 간격 0.1cm — 편차 측정 분해능(형상 편차 기록용, 호 길이 대조와 무관)
    for (i = 0; i < pa.length; i++) m = Math.max(m, distToPoly(pa[i], b));
    for (i = 0; i < pb.length; i++) m = Math.max(m, distToPoly(pb[i], a));
    return m;
  }
  function angleBetween(u, v) { return Math.atan2(Math.abs(u.x * v.y - u.y * v.x), u.x * v.x + u.y * v.y) * 180 / Math.PI; }   // atan2 — acos 는 0° 근처에서 수치 잡음(1e-8 rad)이 크다
  function reverseList(list) { return list.slice().reverse().map(reverseCubic); }
  // 소매산 P_f 이음 정리: prefix(SP→P_f) · suffix(P_f→아랫점) 의 P_f 주변 [P−ℓ, P+ℓ] 만 Hermite 한 개로 교체(끝점·접선·호 길이 보존).
  function fairCapJoin(prefix, suffix) {
    var lenPre = cubicsLen(prefix), lenSuf = cubicsLen(suffix);
    var ell = Math.min(FAIR_LEN, FAIR_RATIO * lenPre, FAIR_RATIO * lenSuf);
    if (!(ell > TOL)) return { error: "fairing-interval-degenerate" };
    var a = advanceAlong(reverseList(prefix), ell), b = advanceAlong(suffix, ell);
    if (!a || !b || !a.tan || !b.tan) return { error: "fairing-interval-degenerate" };
    var Ta = { x: -a.tan.x, y: -a.tan.y }, Tb = b.tan;   // 진행 방향(→P, P→) 단위 접선
    var preRest = reverseList(a.after), sufRest = b.after;
    var rawInterval = reverseList(a.before).concat(b.before);   // 교체 대상(강체 결과): Qa → P → Qb
    var target = cubicsLen(rawInterval);
    var sol = solveHandle(a.pt, Ta, b.pt, Tb, target);
    if (sol.error) return { error: "fairing-cap-" + sol.error };
    var dev = hausdorff(flattenCubics(rawInterval, 24), flattenCubics([sol.q], 48));
    return { cubics: preRest.concat([sol.q], sufRest), raw: preRest.concat(rawInterval, sufRest),
      info: { ellCm: ell, handleCm: sol.h, handleScale: sol.scale, chordCm: dist(a.pt, b.pt), intervalLengthCm: target, deviationCm: dev,
        from: cp(a.pt), to: cp(b.pt), rigidKinkDeg: angleBetween(Ta, Tb) } };
  }

  // 입력: sleeveA = draftSleeveA 결과({geometry, meta}). params = { elbowLengthCm?: number (기본 31.4) }.
  function draftSleeveC(sleeveA, params) {
    params = params || {};
    var el = params.elbowLengthCm;
    var EL = (el === undefined || el === null || el === "") ? DEFAULT_EL : el;
    if (!fin(EL) || !(EL > 0)) return { ok: false, reason: "invalid-elbow-length" };
    var r = readSleeveA(sleeveA);
    if (!r.ok) return r;
    var W = r.W, hemY = r.hemY, Ub = r.Ub, Uf = r.Uf;
    var hemTarget = W * HEM_RATIO, unit = hemTarget / (SECTION_RATIO[0] + SECTION_RATIO[1] + SECTION_RATIO[2]);   // ● = W×3/16
    var Lh = hemY - EL;
    if (!(Lh >= MIN_LOWER)) return { ok: false, reason: "elbow-too-close-to-hem", detail: Lh };
    var aB = Ub.x / 2, aF = Uf.x / 2;   // EL 위 절개축 = 각 반폭의 중점(Ⓑ 와 같은 규칙)
    var backCubs = r.cubics.slice(0, r.spIndex + 1), frontCubs = r.cubics.slice(r.spIndex + 1);
    var xB = capCrossing(backCubs, aB), xF = capCrossing(frontCubs, aF);
    if (!xB) return { ok: false, reason: "no-cap-intersection", piece: "back" };
    if (!xF) return { ok: false, reason: "no-cap-intersection", piece: "front" };
    var PB = { x: aB, y: xB.P.y }, PF = cp(xF.P);   // PF 는 분할점(회전 중심) — x 는 aF 와 부동소수 잔차 수준으로 같다
    var upperMax = Math.max(Ub.y, Uf.y, PB.y, PF.y);
    if (!(EL >= upperMax + MIN_UPPER)) return { ok: false, reason: "elbow-above-underarm", detail: EL - upperMax };

    var EB = { x: aB, y: EL }, EF = { x: aF, y: EL }, SB = { x: Ub.x, y: EL }, SF = { x: Uf.x, y: EL };
    var CB = { x: -unit, y: hemY }, CF = { x: unit, y: hemY };   // 완성 소맷부리 1:2:1 경계점(raw — 중심선 ∓●)
    var KB = { x: Ub.x, y: hemY };

    // ══ raw 강체 변환(감사용): 겹침량은 치수별 계산값 — 앞 바깥 조각을 P_f 중심으로 한 덩어리 회전, 뒤 구간은 앞 처리 뒤 역산 ══
    var Of = Uf.x - aF, overlap = aF - unit;   // 앞 바깥 소맷부리 변 · 필요한 겹침(= Of − ●)
    if (overlap < -CHECK_TOL) return { ok: false, reason: "front-overlap-negative", detail: overlap, outOfSupportedRange: true };
    if (!(overlap > CHECK_TOL)) return { ok: false, reason: "front-overlap-zero", detail: overlap, outOfSupportedRange: true };
    var Dh = hemY - PF.y;   // 회전 중심 ~ 소맷부리선 거리
    var theta = Math.atan(overlap / Dh), gam0 = 2 * theta;
    if (!(gam0 <= MAX_ROTATION)) return { ok: false, reason: "front-rotation-too-large", detail: gam0 };
    var qf = frontCubs[xF.i], headPart = splitLeft(qf, xF.t), tailPart = splitRight(qf, xF.t);
    var head = frontCubs.slice(0, xF.i).concat([headPart]).filter(function (q) { return !degenerate(q); });
    var tail = [tailPart].concat(frontCubs.slice(xF.i + 1)).filter(function (q) { return !degenerate(q); });
    var A0 = { x: PF.x, y: hemY }, F0 = { x: Uf.x, y: hemY };
    var rotateFront = function (g) {
      var cs = Math.cos(g), sn = Math.sin(g);
      var rf = function (v) { return { x: PF.x + (v.x - PF.x) * cs - (v.y - PF.y) * sn, y: PF.y + (v.x - PF.x) * sn + (v.y - PF.y) * cs }; };
      var tr = tail.map(function (q) { return q.map(rf); });
      return { g: g, AP: rf(A0), FP: rf(F0), tailRot: tr, UfP: cp(tr[tr.length - 1][3]) };
    };
    var raw = rotateFront(gam0);
    var dxl = raw.FP.x - raw.AP.x, dyl = raw.FP.y - raw.AP.y, ll = Math.sqrt(dxl * dxl + dyl * dyl);
    var offLine0 = Math.abs((CF.x - raw.AP.x) * dyl - (CF.y - raw.AP.y) * dxl) / ll;
    var rawFront = dist(raw.FP, CF), rawCenter = CF.x - CB.x, rawBack = hemTarget - rawFront - rawCenter;
    var DB = { x: Ub.x + rawBack, y: hemY }, rawDartW = CB.x - DB.x;
    if (rawDartW < -TOL) return { ok: false, reason: "dart-negative", detail: rawDartW, outOfSupportedRange: true };
    if (!(rawDartW >= MIN_DART_WIDTH)) return { ok: false, reason: "dart-degenerate", detail: rawDartW, outOfSupportedRange: true };
    var v1 = { x: CB.x - EB.x, y: CB.y - EB.y }, v2 = { x: DB.x - EB.x, y: DB.y - EB.y };
    var l1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y), l2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    var apex0 = Math.acos(Math.max(-1, Math.min(1, (v1.x * v2.x + v1.y * v2.y) / (l1 * l2))));
    if (!(apex0 > 0) || apex0 > MAX_DART_ANGLE) return { ok: false, reason: apex0 > 0 ? "dart-angle-too-large" : "dart-degenerate", detail: apex0, outOfSupportedRange: true };
    if (!(Math.abs(l1 - l2) <= CHECK_TOL)) return { ok: false, reason: "dart-legs-unequal", detail: l1 - l2 };
    var rotRaw = function (v, sg) { var c = Math.cos(apex0), s = Math.sin(apex0); return { x: EB.x + (v.x - EB.x) * c - sg * (v.y - EB.y) * s, y: EB.y + sg * (v.x - EB.x) * s + (v.y - EB.y) * c }; };
    var closeGap0 = Math.min(dist(rotRaw(DB, 1), CB), dist(rotRaw(DB, -1), CB));

    // ══ 정리(truing/fairing) — 김님 승인(2026-10-07). 수치 오차(호 길이 대조)와 형상 편차(raw 대비)를 분리해 기록한다. 최종 geometry 가 권위값이다. ══
    // 모서리를 G1 곡선으로 깎으면(볼록 곡선은 두 직선 합보다 반드시 짧다) 소맷부리 호 길이가 줄어든다. 공차를 풀지 않고 raw 의 두 자유도 — 앞 회전각 γ' 와 뒤 다트 가상 모서리 x_b —
    // 를 미세 보정해 최종 곡선의 호 길이 구간(뒤 바깥 = ●, 앞 모서리~다트 모서리 = 3●)을 정확히 맞춘다. 보정량은 meta.fairing.compensation 에 raw 와 분리해 남긴다.
    var ellC = Math.min(FAIR_LEN, FAIR_RATIO * unit);
    var frontJunction = function (rt) {
      if (!(rt.AP.y < hemY - JOIN) || !(rt.FP.y > hemY + JOIN)) return { error: "fairing-front-no-crossing" };
      var tX = (hemY - rt.AP.y) / (rt.FP.y - rt.AP.y), X = { x: rt.AP.x + tX * (rt.FP.x - rt.AP.x), y: hemY };
      var uu = unitDir(X, rt.FP), Sa = { x: X.x + uu.x * ellC, y: X.y + uu.y * ellC }, Sb = { x: X.x - ellC, y: hemY };
      var Ta = { x: -uu.x, y: -uu.y }, Tb = { x: -1, y: 0 }, h = dist(Sa, Sb) / 3, q = hermite(Sa, Ta, Sb, Tb, h);
      return { X: X, Sa: Sa, Sb: Sb, q: q, arcSa: dist(rt.FP, Sa), arcCurve: cubicLen(q), handleScale: 1 / 3 };
    };
    var dartJunction = function (xb) {   // 다트를 닫은 상태에서 소맷부리를 정리하고 평면 열린 다트로 복원
      var phi = Math.atan((xb - aB) / Lh);
      if (!(phi > 0)) return { error: "fairing-dart-angle" };
      var alpha = 2 * phi, c = Math.cos(alpha), s = Math.sin(alpha);
      var Cv = { x: xb, y: hemY }, Dv = { x: 2 * aB - xb, y: hemY };
      var rot = function (v, sg) { return { x: EB.x + (v.x - EB.x) * c - sg * (v.y - EB.y) * s, y: EB.y + sg * (v.x - EB.x) * s + (v.y - EB.y) * c }; };
      var sg = dist(rot(Dv, 1), Cv) <= dist(rot(Dv, -1), Cv) ? 1 : -1;
      var toClosed = function (v) { return rot(v, sg); }, toOpen = function (v) { return rot(v, -sg); };
      var S1 = { x: xb + ellC, y: hemY }, S2open = { x: 2 * aB - xb - ellC, y: hemY }, S2 = toClosed(S2open);
      var T1 = { x: -1, y: 0 }, T2 = unitDir(S2, toClosed({ x: S2open.x - 1, y: hemY }));
      var q = hermite(S1, T1, S2, T2, dist(S1, S2) / 3);
      var halfL = splitLeft(q, 0.5), halfR = splitRight(q, 0.5), Cn = cp(halfL[3]);
      halfR[0] = cp(Cn);
      var Dn = toOpen(Cn), halfRopen = halfR.map(toOpen); halfRopen[0] = cp(Dn); halfRopen[3] = cp(S2open);   // 회전 왕복 부동소수 잔차(1e-15)를 지워 이음을 비트 연속으로
      var aC = cubicLen(halfL);
      return { phi: phi, alpha: alpha, sg: sg, toClosed: toClosed, toOpen: toOpen, S1: S1, S2open: S2open, S2: S2, q: q, halfL: halfL, halfR: halfR, halfRopen: halfRopen, Cn: Cn, Dn: Dn, aC: aC,
        arcBack: aC + (S2open.x - KB.x) };
    };
    var xb = CB.x, gam = gam0, dj = null, fj = null, rt = raw, comp = { iterations: 0, residualBackCm: null, residualTotalCm: null };
    for (var itc = 0; itc < 80; itc++) {
      dj = dartJunction(xb); if (dj.error) return { ok: false, reason: dj.error };
      var totalAt = function (g) { var rr = rotateFront(g), ff = frontJunction(rr); if (ff.error) return NaN; return ff.arcSa + ff.arcCurve + (ff.Sb.x - dj.S1.x) + dj.aC - 3 * unit; };
      var lo = gam0 * 0.5, hi = gam0 * 1.5, flo = totalAt(lo), fhi = totalAt(hi);
      if (!isFinite(flo) || !isFinite(fhi) || flo * fhi > 0) return { ok: false, reason: "fairing-front-compensation-unreachable", detail: [flo, fhi] };
      for (var ib = 0; ib < 52; ib++) { var mm = (lo + hi) / 2, fm = totalAt(mm); if (fm * flo <= 0) { hi = mm; fhi = fm; } else { lo = mm; flo = fm; } }
      gam = (lo + hi) / 2; rt = rotateFront(gam); fj = frontJunction(rt);
      var resB = dj.arcBack - unit; comp.iterations = itc + 1; comp.residualBackCm = resB;
      if (Math.abs(resB) < 1e-13) break;
      xb += resB;
    }
    comp.residualTotalCm = fj.arcSa + fj.arcCurve + (fj.Sb.x - dj.S1.x) + dj.aC - 3 * unit;
    if (!(Math.abs(comp.residualBackCm) < 1e-11) || !(Math.abs(comp.residualTotalCm) < 1e-11)) return { ok: false, reason: "fairing-compensation-not-converged", detail: [comp.residualBackCm, comp.residualTotalCm] };
    var AP = rt.AP, FP = rt.FP, tailRot = rt.tailRot, UfP = rt.UfP, CBn = dj.Cn, DBn = dj.Dn;
    if (!(fj.Sb.x > dj.S1.x + TOL)) return { ok: false, reason: "fairing-cuff-overlap-intervals", detail: fj.Sb.x - dj.S1.x };
    var devF = hausdorff([{ x: CF.x + (raw.FP.x - CF.x) / dist(raw.FP, CF) * ellC, y: CF.y + (raw.FP.y - CF.y) / dist(raw.FP, CF) * ellC }, CF, { x: CF.x - ellC, y: hemY }], flattenCubics([fj.q], 40));
    var devD = hausdorff([dj.S1, CB, { x: 2 * aB - CB.x - ellC, y: hemY }].map(function (p, i) { return i === 2 ? dj.S2 : p; }), flattenCubics([dj.q], 40));
    if (Math.max(devF, devD) > CUFF_DEV_MAX) return { ok: false, reason: "fairing-cuff-deviation", detail: Math.max(devF, devD) };
    if (typeof DEBUG_C !== "undefined") console.log("dbgC", JSON.stringify(fj.q), JSON.stringify(dj.q), inflections([fj.q], 0), inflections([dj.q], 0), gam0, gam, xb);
    if (inflections([fj.q], 0) > 0 || inflections([dj.q], 0) > 0) return { ok: false, reason: "fairing-cuff-inflection" };
    var l1n = dist(EB, CBn), l2n = dist(EB, DBn);
    if (!(Math.abs(l1n - l2n) <= CHECK_TOL)) return { ok: false, reason: "dart-legs-unequal", detail: l1n - l2n };
    var closeGapN = dist(dj.toClosed(DBn), CBn), dartWn = CBn.x - DBn.x;
    if (!(dartWn >= MIN_DART_WIDTH)) return { ok: false, reason: "dart-degenerate", detail: dartWn, outOfSupportedRange: true };

    // ① 소매산 P_f 이음 — 보정된 회전의 앞 소매산 SP→P_f(head) · P_f→아랫점(tailRot) 의 P_f 주변만 Hermite 로. 뒤 소매산·SP·앞 아랫점은 그대로(호 길이 보존).
    var rigidChain = backCubs.concat(head, tailRot);   // 감사용 raw(보정 회전 기준)
    var rigidKink = angleBetween(endTan(head[head.length - 1]), startTan(tailRot[0]));   // P_f 에서의 접선 꺾임(= 보정 회전각)
    var fc = fairCapJoin(head, tailRot);
    if (fc.error) return { ok: false, reason: fc.error };
    if (fc.info.deviationCm > CAP_DEV_MAX) return { ok: false, reason: "fairing-cap-deviation", detail: fc.info.deviationCm };
    var chain = backCubs.concat(fc.cubics);
    var inflBefore = inflections(rigidChain, KAPPA_FLAT), inflAfter = inflections(chain, KAPPA_FLAT);
    if (inflAfter > inflBefore) return { ok: false, reason: "fairing-cap-new-inflection", detail: inflAfter - inflBefore };
    var g1Max = function (cubs) { var mm = 0; for (var gi = 1; gi < cubs.length; gi++) { var t0 = endTan(cubs[gi - 1]), t1 = startTan(cubs[gi]); if (t0 && t1) mm = Math.max(mm, angleBetween(t0, t1)); } return mm; };
    var capG1After = g1Max(chain), capG1A = g1Max(r.cubics), capG1Rigid = g1Max(rigidChain);
    if (!(capG1After <= capG1A + G1_TOL_DEG)) return { ok: false, reason: "fairing-cap-g1-break", detail: capG1After - capG1A };

    // 겹침 프로파일(앞 절개축 위 끝~소맷부리): 중앙 조각의 앞 변(수직 → E → C)과 회전한 절개변 사이의 가로 간격 — 전 구간 ≥ 0 이면 틈이 없다(최종 회전각 기준).
    var cutX = function (y) { return PF.x + (AP.x - PF.x) * (y - PF.y) / (AP.y - PF.y); };
    var cenX = function (y) { return y <= EL ? aF : aF - (aF - unit) * (y - EL) / Lh; };
    var minLap = Infinity, maxLap = 0, lapAtEL = cenX(EL) - cutX(EL);
    for (var si = 0; si <= 400; si++) { var yy = PF.y + (AP.y - PF.y) * si / 400, lp = cenX(yy) - cutX(yy); minLap = Math.min(minLap, lp); maxLap = Math.max(maxLap, lp); }
    var dxl2 = FP.x - AP.x, dyl2 = FP.y - AP.y, ll2 = Math.sqrt(dxl2 * dxl2 + dyl2 * dyl2);
    var offLine = Math.abs((CF.x - AP.x) * dyl2 - (CF.y - AP.y) * dxl2) / ll2, lapAlongHem = dist(AP, CF);

    // ── 윤곽(최종): 소매산(정리됨) → 앞 옆선 → 앞 소맷부리 직선 → 앞/중앙 정리 곡선 → 중앙 직선 → 다트 모서리 정리 곡선(중앙쪽) → 다리 1 → 다리 2 → 정리 곡선(뒤쪽) → 뒤 소맷부리 직선 → 뒤 옆선 ──
    var cap = pathOf(chain);
    var pF = pathOf([fj.q]); pF.role = "hem-front-fair";
    var pD1 = pathOf([dj.halfL]); pD1.role = "hem-center-fair";
    var pD2 = pathOf([dj.halfRopen]); pD2.role = "hem-back-fair";
    var outline = [cap,
      L(UfP, FP, "side-seam-front"),
      L(FP, fj.Sa, "hem-front"), pF, L(fj.Sb, dj.S1, "hem-center"), pD1,
      L(CBn, EB, "dart-leg-center"), L(EB, DBn, "dart-leg-outer"),
      pD2, L(dj.S2open, KB, "hem-back"),
      L(KB, Ub, "side-seam-back")];
    outline[6].pair = "elbow-back"; outline[7].pair = "elbow-back";
    var construction = [
      L({ x: 0, y: 0 }, { x: 0, y: hemY }, "center-line"),
      L(PB, EB, "cut-axis-back"), L(PF, EF, "cut-axis-front"),
      L(EF, CF, "cut-axis-front-lower"),    // 중앙 조각의 앞 변(회전한 앞 바깥 조각 아래에 겹쳐 있다)
      L(PF, AP, "front-cut-edge-rotated"),  // 회전한 앞 바깥 조각의 절개변
      L(SB, SF, "elbow-line")
    ];

    // ── 검산(최종 geometry 기준): 연속 · 단일 조각 · 자기교차 · 스파이크 · G1 · 소맷부리 호 길이 구간 ──
    var segCubics = function (sg) { var cs = []; for (var i = 1; i < sg.commands.length; i++) cs.push([cp(i === 1 ? sg.commands[0].points[0] : sg.commands[i - 1].points[2]), sg.commands[i].points[0], sg.commands[i].points[1], sg.commands[i].points[2]]); return cs; };
    var segPts = function (sg) { return sg.kind === "path" ? flattenCubics(segCubics(sg), FLAT_N) : [cp(sg.from), cp(sg.to)]; };
    var segFromP = function (sg) { return sg.kind === "path" ? sg.commands[0].points[0] : sg.from; };
    var segToP = function (sg) { return sg.kind === "path" ? sg.commands[sg.commands.length - 1].points[2] : sg.to; };
    var segLenF = function (sg) { return sg.kind === "path" ? cubicsLen(segCubics(sg)) : dist(sg.from, sg.to); };
    var loop = flattenCubics(chain, FLAT_N);
    outline.slice(1).forEach(function (sg) { segPts(sg).slice(1).forEach(function (p) { loop.push(p); }); });
    if (loopSelfIntersects(loop)) return { ok: false, reason: "self-intersection" };
    var capStart = cp(loop[0]), gap = 0, prevEnd = cp(chain[chain.length - 1][3]);
    for (var ci = 1; ci < chain.length; ci++) gap = Math.max(gap, dist(chain[ci - 1][3], chain[ci][0]));
    outline.slice(1).forEach(function (sg) { gap = Math.max(gap, dist(prevEnd, segFromP(sg))); prevEnd = segToP(sg); });
    gap = Math.max(gap, dist(prevEnd, capStart));
    if (!(gap < JOIN)) return { ok: false, reason: "discontinuous", detail: gap };
    // 접선 꺾임: 모든 이음의 단위 접선 사이각. 의도된 모서리(앞 모서리·다트 노치·뒤 모서리·소매산 끝)를 제외한 이음은 G1.
    var startT = function (sg) { return sg.kind === "path" ? startTan(segCubics(sg)[0]) : unitDir(sg.from, sg.to); };
    var endT = function (sg) { var cs = sg.kind === "path" ? segCubics(sg) : null; return cs ? endTan(cs[cs.length - 1]) : unitDir(sg.from, sg.to); };
    var corners = { "side-seam-front→hem-front": 1, "dart-leg-center→dart-leg-outer": 1, "hem-center-fair→dart-leg-center": 1, "dart-leg-outer→hem-back-fair": 1, "hem-back→side-seam-back": 1, "side-seam-back→cap": 1, "cap→side-seam-front": 1 };
    var maxG1 = 0, kinkByJoint = {};
    for (var i = 1; i <= outline.length; i++) {
      var a = outline[i - 1], b = i === outline.length ? outline[0] : outline[i];
      var ra = a.role || "cap", rb = b.role || "cap", ang = angleBetween(endT(a), startT(b)), key = ra + "→" + rb;
      kinkByJoint[key] = ang;
      if (!corners[key]) maxG1 = Math.max(maxG1, ang);
    }
    if (!(maxG1 <= G1_TOL_DEG)) return { ok: false, reason: "fairing-g1-break", detail: maxG1 };
    var maxCorner = 0, apexKink = kinkByJoint["dart-leg-center→dart-leg-outer"];
    for (var k2 in kinkByJoint) if (corners[k2] && k2 !== "dart-leg-center→dart-leg-outer") { maxCorner = Math.max(maxCorner, kinkByJoint[k2]); if (kinkByJoint[k2] * Math.PI / 180 > MAX_TURN) return { ok: false, reason: "spike", detail: kinkByJoint[k2] }; }
    // 소맷부리 구간(최종 곡선 호 길이): 앞 모서리 FP → 다트 모서리 C_b' (= 3●), 다트 모서리 D_b' → 뒤 모서리 K_b (= ●). 앞 경계점 B_f 는 FP 에서 호 길이 ● 인 점을 최종 곡선 위에서 직접 찾는다.
    var arcFP_Cb = segLenF(outline[2]) + segLenF(outline[3]) + segLenF(outline[4]) + segLenF(outline[5]);
    var arcBack = segLenF(outline[8]) + segLenF(outline[9]);
    var frontBoundary = null, accl = segLenF(outline[2]), need = unit - accl;
    if (need >= 0 && need <= segLenF(outline[3]) + 1e-12) { var q0 = segCubics(outline[3])[0], lo2 = 0, hi2 = 1; for (var it2 = 0; it2 < 60; it2++) { var m2 = (lo2 + hi2) / 2; if (cubicLen(splitLeft(q0, m2)) < need) lo2 = m2; else hi2 = m2; } frontBoundary = cubicAt(q0, (lo2 + hi2) / 2); }
    if (!frontBoundary) return { ok: false, reason: "fairing-front-boundary" };
    var sectionActual = { frontOuter: unit, center: arcFP_Cb - unit, backOuter: arcBack };   // frontOuter = 호 길이 ● 인 점까지(정의), 중앙 = 3● − ●
    var ideal = { backOuter: unit * SECTION_RATIO[0], center: unit * SECTION_RATIO[1], frontOuter: unit * SECTION_RATIO[2] };
    var secErr = Math.max(Math.abs(sectionActual.backOuter - ideal.backOuter), Math.abs(sectionActual.center - ideal.center), Math.abs(arcFP_Cb - 3 * unit));
    var hemCm = arcFP_Cb + arcBack, hemErr = hemCm - hemTarget;
    if (!(secErr <= CHECK_TOL) || !(Math.abs(hemErr) <= CHECK_TOL)) return { ok: false, reason: "cuff-sections-not-1-2-1", detail: { ideal: ideal, actual: sectionActual, hemErrorCm: hemErr } };

    // 소매산 길이·이세 — 최종 곡선 실측(Gauss-Legendre)을 원본(강체 변환 전)과 Ⓐ 기록에 대조한다.
    var capFront0 = cubicsLen(frontCubs), capFront1 = cubicsLen(fc.cubics), capBack = cubicsLen(backCubs), capFrontRigid = cubicsLen(head) + cubicsLen(tailRot);
    var capDrift = Math.abs(capFront1 - capFront0);
    if (!(capDrift <= CAP_LEN_TOL)) return { ok: false, reason: "cap-length-drift", detail: capDrift };
    var am = sleeveA.meta, ahc = r.armholeCm, easeNow = null, easeVsA = null;
    if (ahc && fin(ahc.back) && fin(ahc.front)) easeNow = { back: capBack - ahc.back, front: capFront1 - ahc.front, total: capBack + capFront1 - ahc.back - ahc.front };
    if (easeNow && am.easeAfter && fin(am.easeAfter.total)) {
      easeVsA = Math.max(Math.abs(easeNow.back - am.easeAfter.back), Math.abs(easeNow.front - am.easeAfter.front), Math.abs(easeNow.total - am.easeAfter.total));
      if (!(easeVsA <= EASE_A_TOL)) return { ok: false, reason: "ease-mismatch", detail: easeVsA };
    }
    return {
      ok: true,
      geometry: { outline: outline, construction: construction },
      meta: {
        rule: "pattern-school-p41-tight-sleeve-C",
        widthCm: W, hemRatio: HEM_RATIO, hemTargetCm: hemTarget, hemCm: hemCm, hemErrorCm: hemErr, sleeveLengthCm: r.sleeveLengthCm,
        elbowLengthCm: EL, elbowLine: { y: EL, back: cp(EB), front: cp(EF) }, lowerLengthCm: Lh,
        // 소맷부리 세 구간 = 최종 곡선 호 길이. 앞 경계점은 앞 모서리에서 호 길이 ● 인 점, 중앙/뒤 경계는 다트 모서리 C_b'.
        sections: { unitCm: unit, ratio: SECTION_RATIO.slice(), ideal: ideal, actual: sectionActual, maxErrorCm: secErr, measure: "arc-length(final curve)",
          arcFrontToDartCornerCm: arcFP_Cb, boundaries: { front: cp(frontBoundary), back: cp(CBn), frontRaw: cp(CF), backRaw: cp(CB) },
          boundaryShiftCm: { front: dist(frontBoundary, CF), back: dist(CBn, CB) } },
        front: { pivot: cp(PF), pivotKind: "cap-crossing(front cut axis top)", rigidHemEdgeCm: Of, overlapCm: overlap, overlapAlongHemCm: lapAlongHem, overlapAtHemXCm: CF.x - AP.x, overlapSource: "computed(Of−●) → 정리 보정 후 최종 회전각 기준 실측",
          closingAngleRad: theta, angleRad: gam, angleRawRad: gam0, angleDeg: gam * 180 / Math.PI, angleRawDeg: gam0 * 180 / Math.PI, cutEdgeEnd: cp(AP), outerCorner: cp(FP), underarm: cp(UfP),
          hemLineThroughBoundaryCm: offLine, hemLineThroughBoundaryRawCm: offLine0, seamLengthCm: dist(UfP, FP), seamLengthBeforeCm: hemY - Uf.y,
          lap: { atElbowXCm: lapAtEL, atHemXCm: CF.x - AP.x, minCm: minLap, maxCm: maxLap, gap: minLap < -CHECK_TOL } },
        back: { apex: cp(EB), outerCorner: cp(KB), outerEnd: cp(DBn), outerSectionCm: arcBack, dartWidthAtHemCm: dartWn,
          centerNarrowingCm: Math.abs(aB) - unit, legCenter: { to: cp(CBn), lengthCm: l1n }, legOuter: { to: cp(DBn), lengthCm: l2n },
          legLengthDiffCm: l1n - l2n, apexAngleRad: dj.alpha, apexAngleDeg: dj.alpha * 180 / Math.PI, closeGapCm: closeGapN,
          raw: { corner: cp(CB), outerEnd: cp(DB), dartWidthAtHemCm: rawDartW, legLengthCm: l1, apexAngleDeg: apex0 * 180 / Math.PI, closeGapCm: closeGap0, outerSectionCm: rawBack },
          closedCuff: { rotateSign: dj.sg, hemKinkBeforeDeg: apex0 * 180 / Math.PI, hemKinkAfterDeg: angleBetween(endTan(dj.halfL), startTan(dj.halfR)), hemPerpendicularToLegDeg: angleBetween(endTan(dj.halfL), unitDir(EB, CBn)) } },
        axes: { back: { x: aB, cap: cp(PB), elbow: cp(EB), hem: cp(CBn) }, front: { x: aF, cap: cp(PF), elbow: cp(EF), hem: cp(CF) } },
        sp: cp(r.sp), capSplit: { anchorIndex: backCubs.length, point: cp(r.sp) },
        underarm: { before: { back: cp(Ub), front: cp(Uf) }, after: { back: cp(Ub), front: cp(UfP) } },
        capLengths: { back: capBack, front: capFront1, total: capBack + capFront1, measure: "Gauss-Legendre(final curve)" },
        capLengthsA: am.capLengths ? JSON.parse(JSON.stringify(am.capLengths)) : null,
        capLengthsMeasured: { back: capBack, front: capFront1, frontBefore: capFront0, frontRigid: capFrontRigid, driftCm: capDrift },
        armholeCm: ahc ? { back: ahc.back, front: ahc.front } : null,
        easeAfter: easeNow, easeSourceA: am.easeAfter ? JSON.parse(JSON.stringify(am.easeAfter)) : null,
        easeCheck: { vsSleeveARecordCm: easeVsA, toleranceCm: EASE_A_TOL, basis: "Ⓐ 기록은 표본 길이(오차 ~1e-5) — 최종 곡선 GL 실측이 권위값" },
        cap: { rotatedPart: "front tail (P_f → underarm)", pivot: cp(PF), kinkDegRaw: rigidKink, g1MaxDegAfter: capG1After, g1MaxDegSleeveA: capG1A, g1MaxDegRaw: capG1Rigid, unchangedParts: "back cap · SP · front cap SP→P_f(곡선 위) · 앞 아랫점(회전 후)" },
        fairing: {
          cap: Object.assign({ inflections: { before: inflBefore, after: inflAfter } }, fc.info),
          cuffFront: { ellCm: ellC, handleScale: fj.handleScale, deviationCm: devF, kinkDegBefore: gam * 180 / Math.PI, from: cp(fj.Sa), to: cp(fj.Sb) },
          cuffDart: { ellCm: ellC, handleScale: 1 / 3, deviationCm: devD, kinkDegBefore: apex0 * 180 / Math.PI, from: cp(dj.S1), to: cp(dj.S2open), cornerShiftCm: dist(CBn, CB) },
          // 곡선 정리로 줄어든 호 길이를 raw 의 두 자유도로 보정한 양 — 형상 편차(수치 오차 아님)
          compensation: { frontRotationRawDeg: gam0 * 180 / Math.PI, frontRotationDeg: gam * 180 / Math.PI, frontRotationDeltaDeg: (gam - gam0) * 180 / Math.PI,
            backCornerRawX: CB.x, backCornerX: xb, backCornerShiftCm: xb - CB.x, legHalfAngleRawDeg: apex0 * 90 / Math.PI, legHalfAngleDeg: dj.phi * 180 / Math.PI,
            iterations: comp.iterations, residualBackCm: comp.residualBackCm, residualTotalCm: comp.residualTotalCm },
          maxG1BreakDeg: maxG1, joints: kinkByJoint,
          limits: { fairLenCm: FAIR_LEN, fairRatio: FAIR_RATIO, capDeviationMaxCm: CAP_DEV_MAX, cuffDeviationMaxCm: CUFF_DEV_MAX, kappaFlatPerCm: KAPPA_FLAT, g1TolDeg: G1_TOL_DEG, easeATolCm: EASE_A_TOL }
        },
        // raw 강체 변환 결과(감사용) — 최종 geometry 가 권위값이다.
        rigid: { cap: pathOf(backCubs.concat(head, raw.tailRot)), capKinkDeg: rigidKink, capG1MaxDeg: capG1Rigid, cuffFrontKinkDeg: gam0 * 180 / Math.PI, cuffDartHemKinkDeg: apex0 * 180 / Math.PI,
          hemCorners: { frontOuter: cp(raw.FP), frontBoundary: cp(CF), backBoundary: cp(CB), backOuterEnd: cp(DB), backOuterCorner: cp(KB) },
          sections: { frontOuter: rawFront, center: rawCenter, backOuter: rawBack } },
        checks: { closed: true, connected: true, maxGapCm: gap, selfIntersection: false, singlePiece: true, maxCornerDeg: maxCorner, maxG1BreakDeg: maxG1, apexKinkDeg: apexKink },
        limits: { checkTolCm: CHECK_TOL, maxRotationRad: MAX_ROTATION, minLowerCm: MIN_LOWER, minUpperCm: MIN_UPPER, maxDartAngleRad: MAX_DART_ANGLE, minDartWidthCm: MIN_DART_WIDTH, maxTurnRad: MAX_TURN, capLenTolCm: CAP_LEN_TOL }
      },
      warnings: [],
      sourceSleeveAHash: hashStr(JSON.stringify({ geometry: sleeveA.geometry, meta: sleeveA.meta }))
    };
  }

  window.designSleeveC = Object.freeze({ draftSleeveC: draftSleeveC, readSleeveA: readSleeveA,
    RULES: Object.freeze({ defaultElbowLengthCm: DEFAULT_EL, hemRatio: HEM_RATIO, sectionRatio: Object.freeze(SECTION_RATIO.slice()),
      checkTolCm: CHECK_TOL, maxRotationRad: MAX_ROTATION, minLowerCm: MIN_LOWER, minUpperCm: MIN_UPPER, maxDartAngleRad: MAX_DART_ANGLE, minDartWidthCm: MIN_DART_WIDTH, maxTurnRad: MAX_TURN, capLenTolCm: CAP_LEN_TOL,
      fairLenCm: FAIR_LEN, fairRatio: FAIR_RATIO, capDeviationMaxCm: CAP_DEV_MAX, cuffDeviationMaxCm: CUFF_DEV_MAX, kappaFlatPerCm: KAPPA_FLAT, g1TolDeg: G1_TOL_DEG, easeATolCm: EASE_A_TOL }) });
})();
