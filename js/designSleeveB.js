// ══════════════════════════════════════════════
// designSleeveB.js — 소매 Ⓑ 엔진 코어([패턴학교] P.41 「타이트 슬리브 · 소맷부리 치수를 결정해 맞댄다」). 순수.
//
// ⚠️ 이번 묶음은 **엔진 코어만**이다 — UI·프리셋·체크포인트 연결 없음(index.html 미등록).
//    designSleeveA.js / designSleeve.js 는 건드리지 않는다. Ⓑ 는 완성된 Ⓐ geometry 를 **읽기 전용 출발 원형**으로 쓴다
//    (입력은 draftSleeveA 반환 {geometry, meta} 또는 같은 모양의 sleeveResult. 쓰지 않는다 — 반환값은 전부 새 객체,
//    입력 JSON hash 를 sourceSleeveAHash 로 복사만 한다).
//
// 제도(P.41 Ⓑ, 사용자 확정 사양):
//   W = Ⓐ 아랫점 사이 소매폭. 목표 소맷부리 = W × 3/4, 총 맞댐량 ● = W − 소맷부리 = W/4 (= 절개 2개 × ●/2 = W/8).
//   앞·뒤 소매 폭을 각각 2등분하는 위치(중심선 기준 각 반폭의 중점 — 김님 확정, 유일한 규칙)에서 소맷부리 → 소매산 곡선 교점 P 까지
//   절개축을 긋는다. 앞뒤 반폭이 다르면(Ⓐ 는 뒤가 더 넓다) 축 x 는 ±W/4 가 아니라 각 변 반폭/2 다(B83: 뒤 −8.53 · 앞 +7.50). 중심 조각은 고정, 각 바깥 조각을 **P 를 축으로 강체 회전**해 소맷부리 쪽 쐐기(소맷부리선 위 폭 W/8)를
//   닫는다. 쐐기 한 변 = 절개축, 다른 변 = P 에서 소맷부리선 위 (축 + W/8) 점으로 가는 직선 → 닫으면 그 직선이 절개축과 겹친다.
//   결과는 **현재 형상 하나** — 폭 0 이 된 절개는 외곽선에 흔적을 남기지 않고 construction(cut-axis-*) 과 meta.cuts 로만 보존한다.
// ★ 구현 관례(책 수치 아님):
//   · 강체 회전 단계에서 큐빅은 재평활하지 않는다 — 바깥 조각의 control point 를 그대로 회전하고 교점에서 de Casteljau 분할만 한다
//     (앞·뒤 소매산 길이·이세는 회전 불변). 이 «강체 닫힘» 형상은 meta.rigid 로만 남는다(반환·렌더 outline 이 아니다).
//   · 강체 회전의 귀결 — ① 소매산 P 에 회전각만큼의 꺾임 ② 바깥 소맷부리 모서리가 y 로 약간 내려간다(hem 기울기 = 회전각) ③ 회전한 쐐기 변의 끝이
//     소맷부리 높이보다 R(secθ−1) 만큼 내려와 절개축 위에 짧은 단차가 생긴다. 이 셋은 책의 «처리한 곳이 각지지 않게 완만한 곡선으로»(fairing)로 정리한다:
//   · fairing(2026-10-06 김님 확정 설계; 수치는 책 값이 아니라 1344 sweep 실측으로 확정한 구현 관례) — 결정적, 폴백 없음(실패 = 명시적 reason):
//     ① 소매산: 각 절개점 P 주변 [P−ℓ, P+ℓ](호 길이) 만 **끝점 고정 Hermite cubic 한 개**로 대체한다. 양 끝 위치·접선은 강체 닫힘 곡선의 그것이라 경계는 G1 이다.
//        핸들 길이 h(양쪽 같은 스칼라)를 이분법으로 찾아 호 길이를 교체 구간의 원래 호 길이에 맞춘다 → 앞·뒤 소매산 길이·이세 불변. ℓ = min(2.0, 인접 호의 40%).
//     ② 소맷부리: (0,hemY)에서 수평 접선인 G1 **자연 Hermite**(핸들 = chord/3) 두 개(앞·뒤). 바깥 끝 = 회전된 모서리, 접선 = 회전된 소맷부리 변 방향.
//        호 길이는 강제하지 않고 W×3/4 대비 절대오차 ≤ 1e-3cm 로 검증한다(강체 닫힘의 호 길이 예산이 직선거리와 거의 같아 exact 해가 없는 경우가 있다 — 1344 sweep 실측).
//        hem-step-* 단차는 사라진다. 옆선·SP·중심선·(0,hemY)·회전된 겨드랑/커프 모서리는 비트 동일. 강체 폴리라인 대비 편차는 게이트가 아니라 품질 측정치(meta.fairing.cuff.*.deviationCm).
//        ★ 편차 회귀 한계 0.46cm(RULES.cuffDeviationRegressionCm)는 **책의 설계 수치가 아니다** — 승인된 입력 sweep(1344건, 소매 42~66cm)에서 관측한 최댓값 0.4535cm(42cm 소매)에
//          여유를 둔 품질 회귀 한계이며, 전용 테스트가 검증한다. 입력 범위를 넓히거나 규칙을 바꾸면 다시 실측해 정한다.
//     ③ 게이트: 소매산 편차(강체 닫힘 대비) ≤ 0.1cm · 새 변곡 없음(|κ|<0.03/cm 평탄 구간은 부호로 세지 않는 검증 공차) · 소맷부리 y 단조·변곡 없음 · 자기교차 없음 · 소매산 길이 drift ≤ 1e-3cm.
//   · 책에 정확한 위치가 없는 ◎ 맞춤표시는 만들지 않는다(후속 UI/표시 판단).
//   · 손바닥 둘레(선택): 있으면 목표 소맷부리 < 손바닥+3cm 일 때 **경고만**(자동 보정 금지). 비어 있으면 3/4 규칙만.
//   · 폴백 없음 — 교점 없음·회전 불가·자기교차는 명시적 reason 으로 실패.
// 반환 { ok, geometry:{outline, construction}, meta, warnings, sourceSleeveAHash } | { ok:false, reason, detail? }.
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var HEM_RATIO = 3 / 4;            // 소맷부리 = 소매 폭 × 3/4
  var PALM_ALLOWANCE = 3;           // 손바닥 둘레 + 3cm(여유분) 이상이 기준 — 미달은 경고만
  var MAX_ROTATION = Math.PI / 6;   // 한 쪽 회전 한계(30°) — 넘으면 거절(극단 치수)
  var TOL = 1e-6, JOIN = 1e-9, SAMPLES = 1000;
  // fairing 구현 관례(책 값 아님 — 1344 sweep 으로 확정): 소매산 교체 구간 반길이 ℓ 상한 · 인접 호 대비 비율 · 소매산 편차 상한(강체 닫힘 대비)
  //   · 소맷부리 호 길이 허용오차(W×3/4 대비, cm) · 곡률 평탄 공차 KAPPA_FLAT(/cm) — 이 미만의 곡률 부호 구간은 변곡으로 세지 않는 **검증 공차**(책 수치 아님).
  var CAP_FAIR_LEN = 2.0, CAP_FAIR_RATIO = 0.4, CAP_DEV_MAX = 0.1, CUFF_LEN_TOL = 1e-3, LEN_DRIFT_MAX = 1e-3, KAPPA_FLAT = 0.03;
  var CUFF_DEV_REGRESSION = 0.46;   // 소맷부리 편차(강체 폴리라인 대비) 품질 회귀 한계 — 게이트가 아니라 전용 테스트가 검증한다(RULES). 책 수치 아님.

  function dist(a, b) { var dx = b.x - a.x, dy = b.y - a.y; return Math.sqrt(dx * dx + dy * dy); }   // Math.hypot 대신 — fairing 의 이분법·편차 측정이 수백만 번 부른다
  function cp(p) { return { x: p.x, y: p.y }; }
  function fin(v) { return typeof v === "number" && isFinite(v); }
  function finPt(p) { return !!p && fin(p.x) && fin(p.y); }
  function L(a, b, role) { var s = { kind: "line", from: cp(a), to: cp(b) }; if (role) s.role = role; return s; }
  function hashStr(s) { var h = 0; for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return (h >>> 0).toString(16); }
  function wrapPi(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a <= -Math.PI) a += 2 * Math.PI; return a; }
  function rot(p, c, ang) {
    var dx = p.x - c.x, dy = p.y - c.y, cs = Math.cos(ang), sn = Math.sin(ang);
    return { x: c.x + dx * cs - dy * sn, y: c.y + dx * sn + dy * cs };
  }

  // ── 곡선 보조 ──
  function cubicAt(q, t) {
    var u = 1 - t;
    return { x: u * u * u * q[0].x + 3 * u * u * t * q[1].x + 3 * u * t * t * q[2].x + t * t * t * q[3].x,
             y: u * u * u * q[0].y + 3 * u * u * t * q[1].y + 3 * u * t * t * q[2].y + t * t * t * q[3].y };
  }
  function flattenCubics(cubs, n) {
    var out = [];
    cubs.forEach(function (q, ci) { for (var i = (ci === 0 ? 0 : 1); i <= n; i++) out.push(cubicAt(q, i / n)); });
    return out;
  }
  function polyLen(pts) { var s = 0; for (var i = 0; i < pts.length - 1; i++) s += dist(pts[i], pts[i + 1]); return s; }
  // 호 길이 — 구간 8등분 × 5점 Gauss-Legendre 로 |B'(t)| 를 적분(오차 ~1e-12, 평가 40회). fairing 이분법이 수천 번 부르므로 표본 폴리라인(1000점)을 쓰지 않는다.
  var GL_X = [0.0469100770306680, 0.2307653449471584, 0.5, 0.7692346550528416, 0.9530899229693320], GL_W = [0.1184634425280945, 0.2393143352496832, 0.2844444444444444, 0.2393143352496832, 0.1184634425280945];
  function cubicLen1(q) {
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
  function cubicsLen(cubs) { var s = 0; for (var i = 0; i < cubs.length; i++) s += cubicLen1(cubs[i]); return s; }
  function reverseCubic(q) { return [cp(q[3]), cp(q[2]), cp(q[1]), cp(q[0])]; }
  function splitLeft(q, t) {   // De Casteljau — [0,t] 조각
    var l = function (a, b) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; };
    var p01 = l(q[0], q[1]), p12 = l(q[1], q[2]), p23 = l(q[2], q[3]);
    var p012 = l(p01, p12), p123 = l(p12, p23), p = l(p012, p123);
    return [cp(q[0]), p01, p012, p];
  }
  function splitRight(q, t) { return reverseCubic(splitLeft(reverseCubic(q), 1 - t))   ; }
  function rotCubic(q, c, ang) { return q.map(function (p) { return rot(p, c, ang); }); }
  function degenerate(q) { return dist(q[0], q[3]) < JOIN && dist(q[0], q[1]) < JOIN && dist(q[0], q[2]) < JOIN; }

  // ── fairing 보조 ──
  function unitDir(a, b) { var d = dist(a, b); return d > 1e-12 ? { x: (b.x - a.x) / d, y: (b.y - a.y) / d } : null; }
  function startTan(q) { return unitDir(q[0], q[1]) || unitDir(q[0], q[2]) || unitDir(q[0], q[3]); }
  function endTan(q) { return unitDir(q[2], q[3]) || unitDir(q[1], q[3]) || unitDir(q[0], q[3]); }
  // 순서대로 이어진 cubic 목록을 시작점에서 호 길이 s 만큼 간 곳에서 자른다. { before, after, pt, tan(진행 방향 단위접선) } | null.
  function advanceAlong(list, s) {
    var acc = 0;
    for (var i = 0; i < list.length; i++) {
      var q = list[i], li = cubicsLen([q]);
      if (acc + li >= s - 1e-12) {
        var lo = 0, hi = 1, need = Math.max(0, Math.min(li, s - acc));
        for (var it = 0; it < 48; it++) { var m = (lo + hi) / 2; if (cubicsLen([splitLeft(q, m)]) < need) lo = m; else hi = m; }
        var t = (lo + hi) / 2, left = splitLeft(q, t), right = splitRight(q, t);
        var before = list.slice(0, i).concat([left]).filter(function (c) { return !degenerate(c); });
        var after = [right].concat(list.slice(i + 1)).filter(function (c) { return !degenerate(c); });
        var tan = startTan(after[0] || right);
        return { before: before, after: after, pt: cp(left[3]), tan: tan };
      }
      acc += li;
    }
    return null;
  }
  function hermite(A, Ta, B, Tb, h) { return [cp(A), { x: A.x + h * Ta.x, y: A.y + h * Ta.y }, { x: B.x - h * Tb.x, y: B.y - h * Tb.y }, cp(B)]; }
  // 끝점·접선 고정 Hermite 의 핸들 스칼라 h∈(0, chord) 를 호 길이 = target 이 되도록 이분법으로 찾는다. 거친 격자에서 **첫** 부호 변화 구간을 잡아(가장 자연스러운 해) 이분한다.
  function solveHandle(A, Ta, B, Tb, target) {
    var chord = dist(A, B);
    if (!(target > chord + 1e-12)) return { error: "length-below-chord" };
    var f = function (h) { return cubicsLen([hermite(A, Ta, B, Tb, h)]) - target; };
    var N = 40, prevH = 0, prevF = f(0), lo = null, hi = null;
    for (var i = 1; i <= N; i++) { var h = chord * i / N, fh = f(h); if (prevF < 0 && fh >= 0) { lo = prevH; hi = h; break; } prevH = h; prevF = fh; }
    if (lo === null) return { error: "length-unreachable" };
    for (var it = 0; it < 52; it++) { var m = (lo + hi) / 2; if (f(m) < 0) lo = m; else hi = m; }
    var hs = (lo + hi) / 2;
    return { h: hs, scale: hs / chord, q: hermite(A, Ta, B, Tb, hs) };
  }
  // 부호 있는 곡률(방향 의존) — cubic 한 개의 내부 샘플.
  function kappaAt(q, t) {
    var u = 1 - t;
    var dx = 3 * (u * u * (q[1].x - q[0].x) + 2 * u * t * (q[2].x - q[1].x) + t * t * (q[3].x - q[2].x));
    var dy = 3 * (u * u * (q[1].y - q[0].y) + 2 * u * t * (q[2].y - q[1].y) + t * t * (q[3].y - q[2].y));
    var ex = 6 * (u * (q[2].x - 2 * q[1].x + q[0].x) + t * (q[3].x - 2 * q[2].x + q[1].x));
    var ey = 6 * (u * (q[2].y - 2 * q[1].y + q[0].y) + t * (q[3].y - 2 * q[2].y + q[1].y));
    var sp = Math.hypot(dx, dy);
    return sp > 1e-12 ? (dx * ey - dy * ex) / (sp * sp * sp) : 0;
  }
  // 변곡 개수 = 곡률 부호 구간(run) 중 최대 |κ| ≥ flat 인 것들의 부호 변화 횟수. flat 미만의 부호 구간은 수치 잡음 수준의 평탄 구간이라 무시한다
  //   (G1 이음에서 곡률이 0 근처를 오가는 것 — 책 수치가 아닌 검증 공차). flat = 0 이면 모든 부호 변화를 센다.
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
  // 두 점열(폴리라인)의 양방향 최대 거리. 한쪽이 성긴 선분이면 resample 해서 점을 촘촘히 만든다.
  function resample(poly, step) {
    var out = [cp(poly[0])];
    for (var i = 0; i < poly.length - 1; i++) {
      var d = dist(poly[i], poly[i + 1]), k = Math.max(1, Math.ceil(d / step));
      for (var j = 1; j <= k; j++) out.push({ x: poly[i].x + (poly[i + 1].x - poly[i].x) * j / k, y: poly[i].y + (poly[i + 1].y - poly[i].y) * j / k });
    }
    return out;
  }
  function hausdorff(a, b) {
    var pa = resample(a, 0.05), pb = resample(b, 0.05), m = 0, i;
    for (i = 0; i < pa.length; i++) m = Math.max(m, distToPoly(pa[i], b));
    for (i = 0; i < pb.length; i++) m = Math.max(m, distToPoly(pb[i], a));
    return m;
  }

  // 한 변의 소매산 fairing: chain 순서의 prefix(→P)·suffix(P→) 를 받아 P 둘레 [P−ℓ, P+ℓ] 만 Hermite cubic 한 개로 교체한다.
  //   반환 { cubics(chain 순서: prefix 나머지 + Hermite + suffix 나머지), info } | { error, detail }.
  function fairCapJoin(prefix, suffix) {
    var lenPre = cubicsLen(prefix), lenSuf = cubicsLen(suffix);
    var ell = Math.min(CAP_FAIR_LEN, CAP_FAIR_RATIO * lenPre, CAP_FAIR_RATIO * lenSuf);
    if (!(ell > TOL)) return { error: "fairing-interval-degenerate" };
    var a = advanceAlong(prefix.slice().reverse().map(reverseCubic), ell), b = advanceAlong(suffix, ell);
    if (!a || !b || !a.tan || !b.tan) return { error: "fairing-interval-degenerate" };
    var Ta = { x: -a.tan.x, y: -a.tan.y }, Tb = b.tan;   // Ta = chain 진행 방향(→P), Tb = chain 진행 방향(P→)
    var preRest = a.after.slice().reverse().map(reverseCubic), sufRest = b.after;
    var rawInterval = a.before.slice().reverse().map(reverseCubic).concat(b.before);   // 교체 대상: Qa → P → Qb (강체 닫힘 형상)
    var target = cubicsLen(rawInterval);
    var sol = solveHandle(a.pt, Ta, b.pt, Tb, target);
    if (sol.error) return { error: "fairing-cap-" + sol.error, detail: dist(a.pt, b.pt) - target };
    var dev = hausdorff(flattenCubics(rawInterval, 40), flattenCubics([sol.q], 80));
    return {
      cubics: preRest.concat([sol.q], sufRest),
      info: { ellCm: ell, handleCm: sol.h, handleScale: sol.scale, chordCm: dist(a.pt, b.pt), intervalLengthCm: target, deviationCm: dev,
        from: cp(a.pt), to: cp(b.pt), rigidKinkDeg: Math.acos(Math.max(-1, Math.min(1, Ta.x * Tb.x + Ta.y * Tb.y))) * 180 / Math.PI }
    };
  }

  // 한 변의 소맷부리 fairing: (0,hemY) 에서 수평 접선, 바깥 끝 = 회전된 모서리(접선 = 회전된 소맷부리 변 방향). 중심 → 바깥 방향 **자연 Hermite**(핸들 = chord/3) 한 개.
  //   호 길이를 강제로 맞추지 않는다 — 강체 닫힘의 호 길이 예산이 직선거리와 거의 같아(여유 −0.0013~+0.005cm) exact 해가 없는 경우가 있다. 소맷부리 합은 허용오차(CUFF_LEN_TOL)로 검증한다.
  function fairCuffSide(X, hemY) {
    var C = { x: 0, y: hemY }, K = X.hem2, s = X.s;
    var Tc = { x: s, y: 0 }, Tk = { x: s * Math.cos(X.angleRad), y: s * Math.sin(X.angleRad) };
    var chord = dist(C, K), h = chord / 3, q = hermite(C, Tc, K, Tk, h);
    var target = Math.abs(X.axisX) + X.outerHemEdge;   // 강체 닫힘의 변별 소맷부리 변 길이(단차 제외) — 합 W×3/4
    var raw = [K, X.H2r, X.H1, C];   // 강체 닫힘 소맷부리(모서리 → 쐐기 변 끝 → 단차 → 축 → 중심) — 편차 측정 기준(품질 측정치, 게이트 아님)
    var dev = hausdorff(raw, flattenCubics([reverseCubic(q)], 120)), len = cubicsLen([q]);
    return { q: q, info: { handleCm: h, handleScale: 1 / 3, chordCm: chord, lengthCm: len, targetCm: target, lengthErrCm: len - target, deviationCm: dev } };
  }

  function pathOf(cubs, role) {
    var cmds = [{ type: "M", points: [cp(cubs[0][0])] }];
    cubs.forEach(function (q) { cmds.push({ type: "C", points: [cp(q[1]), cp(q[2]), cp(q[3])] }); });
    var p = { kind: "path", commands: cmds }; if (role) p.role = role; return p;
  }
  function segFrom(sg) { return sg.kind === "path" ? sg.commands[0].points[0] : sg.from; }
  function segTo(sg) { return sg.kind === "path" ? sg.commands[sg.commands.length - 1].points[2] : sg.to; }

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

  // ── Ⓐ 읽기: 소매산 cubic 연쇄(뒤 아랫점 → SP → 앞 아랫점) · 밑선 · 소매부리 ──────────────────
  function readSleeveA(a) {
    if (!a || typeof a !== "object") return { ok: false, reason: "no-sleeve-a" };
    if (a.ok === false) return { ok: false, reason: "no-sleeve-a" };
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
    var all = [].concat.apply([], cubs);
    if (!all.every(finPt)) return { ok: false, reason: "invalid-sleeve-a" };
    var lines = [sB, sF, hm];
    if (!lines.every(function (s) { return s && s.kind === "line" && finPt(s.from) && finPt(s.to); })) return { ok: false, reason: "invalid-sleeve-a" };
    var Ub = cubs[0][0], Uf = cubs[cubs.length - 1][3], sp = m.sp;
    if (!finPt(sp)) return { ok: false, reason: "invalid-sleeve-a" };
    var k = -1;
    for (var j = 0; j < cubs.length; j++) if (dist(cubs[j][3], sp) < JOIN) k = j;
    if (k < 0 || k === cubs.length - 1) return { ok: false, reason: "invalid-sleeve-a", detail: "sp-not-on-cap" };
    var slen = m.sleeveLengthCm;
    // 밑선은 수직 · 소매부리는 수평 · 소매산 끝점과 밑선 시작점 일치.
    var vertical = sB.from.x === sB.to.x && sF.from.x === sF.to.x;
    var okEnds = dist(sB.from, Ub) < JOIN && dist(sF.from, Uf) < JOIN;
    var hemFlat = Math.abs(sB.to.y - sF.to.y) < JOIN && Math.abs(sB.to.y - slen) < TOL;
    if (!vertical || !okEnds || !fin(slen) || !hemFlat) return { ok: false, reason: "invalid-sleeve-a", detail: "seam-or-hem" };
    var W = Uf.x - Ub.x;
    if (!(W > 0) || !(Ub.x < 0) || !(Uf.x > 0)) return { ok: false, reason: "invalid-width" };
    if (fin(m.bicepCm) && Math.abs(m.bicepCm - W) > TOL) return { ok: false, reason: "invalid-sleeve-a", detail: "bicep-mismatch" };
    if (!(slen > Math.max(Ub.y, Uf.y))) return { ok: false, reason: "invalid-sleeve-a", detail: "hem-above-underarm" };
    return { ok: true, cubics: cubs, spIndex: k, sp: cp(sp), Ub: cp(Ub), Uf: cp(Uf), hemY: slen, W: W,
      armholeCm: m.armholeCm || null, capLengths: m.capLengths || null, underarmY: Ub.y, sleeveLengthCm: slen };
  }

  // 한 변의 절개축(x = axisX)과 소매산 곡선의 교점 — 변 곡선 구간(cubs: 이 변의 cubic 목록)에서 정확히 하나여야 한다.
  //   반환 { i, t, P } | { error }.
  function findCapCrossing(cubs, axisX) {
    var hits = [];
    for (var i = 0; i < cubs.length; i++) {
      var q = cubs[i], prev = cubicAt(q, 0).x - axisX;
      for (var s = 1; s <= 400; s++) {
        var cur = cubicAt(q, s / 400).x - axisX;
        if ((prev < 0) !== (cur < 0) && prev !== cur) {
          var lo = (s - 1) / 400, hi = s / 400, flo = prev;
          for (var it = 0; it < 80; it++) { var mid = (lo + hi) / 2, fm = cubicAt(q, mid).x - axisX; if ((fm < 0) === (flo < 0)) { lo = mid; flo = fm; } else hi = mid; }
          hits.push({ i: i, t: (lo + hi) / 2 });
        }
        prev = cur;
      }
    }
    if (hits.length === 0) return { error: "no-cap-intersection" };
    // 같은 지점의 중복(cubic 경계에서 두 번 잡힘)은 하나로 본다.
    var uniq = [];
    hits.forEach(function (h) { var P = cubicAt(cubs[h.i], h.t); if (!uniq.some(function (u) { return dist(u.P, P) < 1e-7; })) uniq.push({ i: h.i, t: h.t, P: P }); });
    if (uniq.length !== 1) return { error: "ambiguous-cap-intersection", count: uniq.length };
    return uniq[0];
  }

  // 한 변 처리. s: −1 뒤 / +1 앞. sideCubs: SP 쪽에서 아랫점 쪽으로 향하는 방향으로 정렬하지 않고 **원래 연쇄 방향** 그대로.
  //   outerFirst: 바깥(아랫점) 조각이 연쇄의 앞(뒤 변) / 뒤(앞 변).
  function processSide(s, sideCubs, U, W, hemY, outerFirst) {
    var axisX = U.x / 2, a = Math.abs(axisX), g = W / 8;   // 절개축 = 이 변 반폭의 중점(책: 앞뒤 소매 폭을 각각 2등분) · 각 절개의 소맷부리 폐쇄량 g = 총량(W/4)의 절반
    var cross = findCapCrossing(sideCubs, axisX);
    if (cross.error) return { error: cross.error, detail: cross.count };
    var P = cross.P, R = hemY - P.y;
    if (!(R > TOL)) return { error: "cut-axis-degenerate" };
    var outerHemEdge = Math.abs(U.x) - a - g;   // 쐐기를 뺀 바깥 소맷부리 변 길이(기본: |U.x|/2 − W/8)
    if (!(outerHemEdge > TOL)) return { error: "closure-exceeds-outer-width" };
    var H1 = { x: axisX, y: hemY }, H2 = { x: axisX + s * g, y: hemY };
    var ang = wrapPi(Math.atan2(H1.y - P.y, H1.x - P.x) - Math.atan2(H2.y - P.y, H2.x - P.x));
    if (!(Math.abs(ang) > 0) || Math.abs(ang) > MAX_ROTATION) return { error: Math.abs(ang) > 0 ? "closure-rotation-too-large" : "closure-rotation-degenerate", detail: ang };
    var ci = sideCubs[cross.i], inner, outer;
    var leftPart = splitLeft(ci, cross.t), rightPart = splitRight(ci, cross.t);
    if (outerFirst) {   // 뒤 변: 연쇄 = [바깥… → P → 안쪽… SP]
      outer = sideCubs.slice(0, cross.i).concat([leftPart]); inner = [rightPart].concat(sideCubs.slice(cross.i + 1));
    } else {            // 앞 변: 연쇄 = [SP … 안쪽 → P → 바깥… U]
      inner = sideCubs.slice(0, cross.i).concat([leftPart]); outer = [rightPart].concat(sideCubs.slice(cross.i + 1));
    }
    inner = inner.filter(function (q) { return !degenerate(q); }); outer = outer.filter(function (q) { return !degenerate(q); });
    var hemCorner = { x: U.x, y: hemY };
    return {
      s: s, axisX: axisX, P: P, R: R, g: g, angleRad: ang, H1: H1, H2: H2,
      inner: inner, outer: outer.map(function (q) { return rotCubic(q, P, ang); }),
      U2: rot(U, P, ang), hem2: rot(hemCorner, P, ang), H2r: rot(H2, P, ang),
      outerHemEdge: outerHemEdge, hemCorner: hemCorner
    };
  }

  // 입력: sleeveA = draftSleeveA 결과({geometry, meta}). params = { palmCircumferenceCm?: number|null }.
  function draftSleeveB(sleeveA, params) {
    params = params || {};
    var palm = params.palmCircumferenceCm, havePalm = !(palm === undefined || palm === null || palm === "");
    if (havePalm && (!fin(palm) || !(palm > 0))) return { ok: false, reason: "invalid-palm-circumference" };
    var r = readSleeveA(sleeveA);
    if (!r.ok) return r;
    var W = r.W, hemY = r.hemY, k = r.spIndex;
    var backCubs = r.cubics.slice(0, k + 1), frontCubs = r.cubics.slice(k + 1);
    var B = processSide(-1, backCubs, r.Ub, W, hemY, true);
    if (B.error) return { ok: false, reason: B.error, piece: "back", detail: B.detail };
    var F = processSide(1, frontCubs, r.Uf, W, hemY, false);
    if (F.error) return { ok: false, reason: F.error, piece: "front", detail: F.detail };

    // ── 강체 닫힘(raw) 형상: 소매산 한 개 path + 소맷부리 폴리라인. 반환 outline 이 아니라 meta.rigid 로만 남는다. ──
    //   소매산 연쇄: 뒤 아랫점' → (뒤 바깥) → P → (뒤 안쪽) → SP → (앞 안쪽) → P → (앞 바깥) → 앞 아랫점'.
    var rigidChain = B.outer.concat(B.inner, F.inner, F.outer);
    var rigidCap = pathOf(rigidChain);
    var rigidHem = [cp(F.hem2), cp(F.H2r), cp(F.H1), cp(B.H1), cp(B.H2r), cp(B.hem2)];   // 앞 모서리 → (쐐기 변 끝 → 단차) → 중심 → (단차) → 뒤 모서리

    // ── fairing ①: 소매산 — 각 P 주변만 Hermite 한 개로 교체(호 길이·G1 보존). 뒤 변 chain 순서 = [바깥 | 안쪽], 앞 변 = [안쪽 | 바깥]. ──
    var fB = fairCapJoin(B.outer, B.inner);
    if (fB.error) return { ok: false, reason: fB.error, piece: "back", detail: fB.detail };
    var fF = fairCapJoin(F.inner, F.outer);
    if (fF.error) return { ok: false, reason: fF.error, piece: "front", detail: fF.detail };
    var chain = fB.cubics.concat(fF.cubics);
    var spAnchor = fB.cubics.length;   // SP 앵커 번호(M 앵커 = 0)
    var cap = pathOf(chain);
    if (fB.info.deviationCm > CAP_DEV_MAX) return { ok: false, reason: "fairing-cap-deviation", piece: "back", detail: fB.info.deviationCm };
    if (fF.info.deviationCm > CAP_DEV_MAX) return { ok: false, reason: "fairing-cap-deviation", piece: "front", detail: fF.info.deviationCm };
    // 새 변곡 금지: 소매산 전체의 변곡 수는 Ⓐ 원본 이하여야 한다.
    var inflBefore = inflections(r.cubics, KAPPA_FLAT), inflAfter = inflections(chain, KAPPA_FLAT);
    if (inflAfter > inflBefore) return { ok: false, reason: "fairing-cap-new-inflection", detail: inflAfter - inflBefore };

    // ── fairing ②: 소맷부리 — (0,hemY) 수평 접선 G1 cubic 두 개(앞 모서리 → 중심 → 뒤 모서리). ──
    var cF = fairCuffSide(F, hemY); if (cF.error) return { ok: false, reason: cF.error, piece: "front", detail: cF.detail };
    var cB = fairCuffSide(B, hemY); if (cB.error) return { ok: false, reason: cB.error, piece: "back", detail: cB.detail };
    var cuffCubs = [reverseCubic(cF.q), cB.q];   // 진행 방향 앞 모서리 → 중심 → 뒤 모서리
    var cuffMonotone = true;
    [cF.q, cB.q].forEach(function (q) { var py = q[0].y; for (var i = 1; i <= 200; i++) { var y = cubicAt(q, i / 200).y; if (y < py - 1e-12) cuffMonotone = false; py = y; } });
    if (!cuffMonotone) return { ok: false, reason: "fairing-cuff-not-monotone" };
    if (inflections(cuffCubs, 0) > 0) return { ok: false, reason: "fairing-cuff-inflection" };
    var cuff = pathOf(cuffCubs, "hem");

    // 소맷부리 윤곽(앞 → 뒤): 앞 밑선 → 소맷부리 곡선(앞 모서리 → 중심 → 뒤 모서리) → 뒤 밑선. 연쇄가 닫힌 고리가 된다. hem-step 은 없다.
    var outline = [cap, L(F.U2, F.hem2, "side-seam-front"), cuff, L(B.hem2, B.U2, "side-seam-back")];

    // 닫힌 외곽 점열 → 연속·자기교차 검산.
    var capPts = flattenCubics(chain, 60), loop = capPts.slice();
    outline.slice(1).forEach(function (sg) { if (sg.kind === "path") flattenCubics(cuffCubs, 60).slice(1).forEach(function (p) { loop.push(p); }); else loop.push(cp(sg.to)); });
    var selfX = loopSelfIntersects(loop);
    if (selfX) return { ok: false, reason: "self-intersection" };
    var gap = 0, prevEnd = cp(capPts[capPts.length - 1]);
    outline.slice(1).forEach(function (sg) { var f = segFrom(sg), t = segTo(sg); gap = Math.max(gap, dist(prevEnd, f)); prevEnd = t; });
    gap = Math.max(gap, dist(prevEnd, capPts[0]));
    var connected = gap < 1e-9;

    // 측정값: 소매산 길이·이세(회전·fairing 불변이어야 한다) · 밑선 길이 · 소맷부리 길이.
    var capBack = cubicsLen(fB.cubics), capFront = cubicsLen(fF.cubics);
    var capBack0 = cubicsLen(backCubs), capFront0 = cubicsLen(frontCubs);
    var drift = Math.max(Math.abs(capBack - capBack0), Math.abs(capFront - capFront0));
    if (drift > LEN_DRIFT_MAX) return { ok: false, reason: "fairing-cap-length-drift", detail: drift };
    var ah = r.armholeCm, easeAfter = null, easeBefore = null;
    if (ah && fin(ah.back) && fin(ah.front)) {
      easeAfter = { back: capBack - ah.back, front: capFront - ah.front, total: capBack + capFront - ah.back - ah.front };
      easeBefore = { back: capBack0 - ah.back, front: capFront0 - ah.front, total: capBack0 + capFront0 - ah.back - ah.front };
    }
    var seamBack = dist(B.U2, B.hem2), seamFront = dist(F.U2, F.hem2);
    var seamBack0 = hemY - r.Ub.y, seamFront0 = hemY - r.Uf.y;
    var hemTarget = W * HEM_RATIO, closeTotal = W - hemTarget;
    var hemCm = cubicsLen(cuffCubs);
    if (Math.abs(hemCm - hemTarget) > CUFF_LEN_TOL) return { ok: false, reason: "fairing-cuff-length-drift", detail: hemCm - hemTarget };
    var hemChord = dist(B.hem2, F.hem2);
    var warnings = [];
    var palmInfo = null;
    if (havePalm) {
      var need = palm + PALM_ALLOWANCE;
      palmInfo = { circumferenceCm: palm, allowanceCm: PALM_ALLOWANCE, minHemCm: need, shortfallCm: Math.max(0, need - hemTarget), satisfied: hemTarget >= need };
      if (hemTarget < need) warnings.push("hem-below-palm-allowance");   // 자동 보정 금지 — 경고만
    }
    var cutMeta = function (X, name) {   // hemStepCm·*DropCm 는 fairing 전 강체 닫힘 기준 관찰값
      return { side: name, axisX: X.axisX, pivot: cp(X.P), axisLengthCm: X.R, closeAtHemCm: X.g, angleRad: X.angleRad, angleDeg: X.angleRad * 180 / Math.PI,
        wedgeHem: { onAxis: cp(X.H1), onLeg: cp(X.H2) }, wedgeLegRotated: cp(X.H2r), hemStepCm: dist(X.H2r, X.H1),
        outerHemCornerDropCm: X.hem2.y - hemY, underarmDropCm: X.U2.y - r.underarmY };
    };
    var construction = [
      L({ x: 0, y: 0 }, { x: 0, y: hemY }, "center-line"),
      L(B.P, B.H1, "cut-axis-back"), L(F.P, F.H1, "cut-axis-front"),
      L(B.P, B.H2, "cut-leg-back"), L(F.P, F.H2, "cut-leg-front")
    ];
    // G1 점검: 소매산 cubic 연쇄 이음새의 접선 꺾임(°) 최댓값 — 입력 Ⓐ 연쇄와 같은 척도.
    var g1 = function (cubs) { var m = 0; for (var i = 1; i < cubs.length; i++) { var t0 = endTan(cubs[i - 1]), t1 = startTan(cubs[i]); if (t0 && t1) m = Math.max(m, Math.acos(Math.max(-1, Math.min(1, t0.x * t1.x + t0.y * t1.y))) * 180 / Math.PI); } return m; };
    return {
      ok: true,
      geometry: { outline: outline, construction: construction },
      meta: {
        rule: "pattern-school-p41-tight-sleeve-B",
        widthCm: W, hemTargetCm: hemTarget, hemRatio: HEM_RATIO, closeTotalCm: closeTotal, closePerCutCm: closeTotal / 2,
        hemCm: hemCm, hemChordCm: hemChord, sleeveLengthCm: r.sleeveLengthCm,
        cuts: { back: cutMeta(B, "back"), front: cutMeta(F, "front") },
        sp: cp(r.sp), capSplit: { anchorIndex: spAnchor, point: cp(r.sp) },
        underarm: { before: { back: cp(r.Ub), front: cp(r.Uf) }, after: { back: cp(B.U2), front: cp(F.U2) } },
        capLengthsBefore: { back: capBack0, front: capFront0, total: capBack0 + capFront0 },
        capLengths: { back: capBack, front: capFront, total: capBack + capFront },
        armholeCm: ah ? { back: ah.back, front: ah.front } : null, easeBefore: easeBefore, easeAfter: easeAfter,
        seamLengthsCm: { back: seamBack, front: seamFront, backBefore: seamBack0, frontBefore: seamFront0 },
        palm: palmInfo, fitMarks: null,
        fairing: {
          cap: { back: fB.info, front: fF.info, inflections: { before: inflBefore, after: inflAfter }, g1MaxDeg: { before: g1(r.cubics), rigid: g1(rigidChain), after: g1(chain) } },
          cuff: { back: cB.info, front: cF.info, centerTangentHorizontal: true, monotone: cuffMonotone },
          limits: { capFairLenCm: CAP_FAIR_LEN, capFairRatio: CAP_FAIR_RATIO, capDeviationMaxCm: CAP_DEV_MAX, cuffLengthTolCm: CUFF_LEN_TOL, kappaFlatPerCm: KAPPA_FLAT, lengthDriftMaxCm: LEN_DRIFT_MAX }
        },
        rigid: { cap: rigidCap, hem: rigidHem, capSplitAnchorIndex: B.outer.length + B.inner.length },   // fairing 전 강체 닫힘(관찰·검증용) — outline 아님
        checks: { closed: true, connected: connected, maxGapCm: gap, selfIntersection: selfX,
          centerLineVertical: dist(r.sp, { x: 0, y: 0 }) < JOIN }
      },
      warnings: warnings,
      sourceSleeveAHash: hashStr(JSON.stringify({ geometry: sleeveA.geometry, meta: sleeveA.meta }))
    };
  }

  window.designSleeveB = Object.freeze({ draftSleeveB: draftSleeveB, readSleeveA: readSleeveA,
    RULES: Object.freeze({ hemRatio: HEM_RATIO, palmAllowanceCm: PALM_ALLOWANCE, maxRotationRad: MAX_ROTATION, capFairLenCm: CAP_FAIR_LEN, capFairRatio: CAP_FAIR_RATIO,
      capDeviationMaxCm: CAP_DEV_MAX, cuffLengthTolCm: CUFF_LEN_TOL, kappaFlatPerCm: KAPPA_FLAT, lengthDriftMaxCm: LEN_DRIFT_MAX, cuffDeviationRegressionCm: CUFF_DEV_REGRESSION }) });
})();
