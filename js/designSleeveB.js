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
//   · 큐빅은 재평활하지 않는다 — 바깥 조각의 control point 를 그대로 회전하고 교점에서 de Casteljau 분할만 한다
//     (그래서 앞·뒤 소매산 길이·이세는 회전 불변으로 보존된다). 책의 «처리한 곳을 완만한 곡선으로»(fairing)와 hem step 정리는 **이번 코어 범위 밖**(후속 UI 단계에서 판단) — 기록만 남긴다(꺾임 각 = meta.cuts.*.angleDeg).
//   · 강체 회전의 귀결 — ① 바깥 소맷부리 모서리는 y 로 약간 내려간다(hem 기울기 = 회전각) ② 회전한 쐐기 변의 끝(P 에서 R/cosθ)이 소맷부리 높이보다
//     R(secθ−1) 만큼 아래로 내려와 절개축 위에 짧은 단차(hem-step-*)가 생긴다(축 위 수직선, 폭 0 절개 흔적이 아니라 실제 소맷부리 윤곽).
//     소맷부리 길이는 «소맷부리선 변 길이 합»(중심 + 바깥 2변)이며 정확히 W×3/4 다 — 단차는 합에 넣지 않고 따로 기록한다.
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

  function dist(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); }
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
  function cubicsLen(cubs) { return cubs.length ? polyLen(flattenCubics(cubs, SAMPLES)) : 0; }
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

    // 소매산 한 개 path: 뒤 아랫점' → (뒤 바깥) → P → (뒤 안쪽) → SP → (앞 안쪽) → P → (앞 바깥) → 앞 아랫점'.
    var chain = B.outer.concat(B.inner, F.inner, F.outer);
    var spAnchor = B.outer.length + B.inner.length;   // SP 앵커 번호(M 앵커 = 0)
    var cmds = [{ type: "M", points: [cp(chain[0][0])] }];
    chain.forEach(function (q) { cmds.push({ type: "C", points: [cp(q[1]), cp(q[2]), cp(q[3])] }); });
    var cap = { kind: "path", commands: cmds };

    // 소맷부리 윤곽(앞 → 뒤): 앞 밑선 → 앞 바깥 변 → (단차) → 중심 변 → (단차) → 뒤 바깥 변 → 뒤 밑선. 연쇄가 닫힌 고리가 된다.
    var step = function (from, to, role) { return dist(from, to) > JOIN ? [L(from, to, role)] : []; };
    var outline = [cap, L(F.U2, F.hem2, "side-seam-front"), L(F.hem2, F.H2r, "hem-front")]
      .concat(step(F.H2r, F.H1, "hem-step-front"), [L(F.H1, B.H1, "hem-center")], step(B.H1, B.H2r, "hem-step-back"),
        [L(B.H2r, B.hem2, "hem-back"), L(B.hem2, B.U2, "side-seam-back")]);

    // 닫힌 외곽 점열 → 연속·자기교차 검산.
    var capPts = flattenCubics(chain, 60), loop = capPts.slice();
    outline.slice(1).forEach(function (sg) { loop.push(cp(sg.to)); });
    var selfX = loopSelfIntersects(loop);
    if (selfX) return { ok: false, reason: "self-intersection" };
    var gap = 0, prevEnd = cp(capPts[capPts.length - 1]);
    outline.slice(1).forEach(function (sg) { gap = Math.max(gap, dist(prevEnd, sg.from)); prevEnd = sg.to; });
    gap = Math.max(gap, dist(prevEnd, capPts[0]));
    var connected = gap < 1e-9;

    // 측정값: 소매산 길이·이세(회전 불변이어야 한다) · 밑선 길이 · 소맷부리 길이.
    var capBack = cubicsLen(B.outer.concat(B.inner)), capFront = cubicsLen(F.inner.concat(F.outer));
    var capBack0 = cubicsLen(backCubs), capFront0 = cubicsLen(frontCubs);
    var ah = r.armholeCm, easeAfter = null, easeBefore = null;
    if (ah && fin(ah.back) && fin(ah.front)) {
      easeAfter = { back: capBack - ah.back, front: capFront - ah.front, total: capBack + capFront - ah.back - ah.front };
      easeBefore = { back: capBack0 - ah.back, front: capFront0 - ah.front, total: capBack0 + capFront0 - ah.back - ah.front };
    }
    var seamBack = dist(B.U2, B.hem2), seamFront = dist(F.U2, F.hem2);
    var seamBack0 = hemY - r.Ub.y, seamFront0 = hemY - r.Uf.y;
    var hemCm = dist(F.H2r, F.hem2) + dist(F.H1, B.H1) + dist(B.H2r, B.hem2);
    var hemTarget = W * HEM_RATIO, closeTotal = W - hemTarget;
    var hemChord = dist(B.hem2, F.hem2);
    var warnings = [];
    var palmInfo = null;
    if (havePalm) {
      var need = palm + PALM_ALLOWANCE;
      palmInfo = { circumferenceCm: palm, allowanceCm: PALM_ALLOWANCE, minHemCm: need, shortfallCm: Math.max(0, need - hemTarget), satisfied: hemTarget >= need };
      if (hemTarget < need) warnings.push("hem-below-palm-allowance");   // 자동 보정 금지 — 경고만
    }
    var cutMeta = function (X, name) {
      return { side: name, axisX: X.axisX, pivot: cp(X.P), axisLengthCm: X.R, closeAtHemCm: X.g, angleRad: X.angleRad, angleDeg: X.angleRad * 180 / Math.PI,
        wedgeHem: { onAxis: cp(X.H1), onLeg: cp(X.H2) }, wedgeLegRotated: cp(X.H2r), hemStepCm: dist(X.H2r, X.H1),
        outerHemCornerDropCm: X.hem2.y - hemY, underarmDropCm: X.U2.y - r.underarmY };
    };
    var construction = [
      L({ x: 0, y: 0 }, { x: 0, y: hemY }, "center-line"),
      L(B.P, B.H1, "cut-axis-back"), L(F.P, F.H1, "cut-axis-front"),
      L(B.P, B.H2, "cut-leg-back"), L(F.P, F.H2, "cut-leg-front")
    ];
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
        checks: { closed: true, connected: connected, maxGapCm: gap, selfIntersection: selfX,
          centerLineVertical: dist(r.sp, { x: 0, y: 0 }) < JOIN }
      },
      warnings: warnings,
      sourceSleeveAHash: hashStr(JSON.stringify({ geometry: sleeveA.geometry, meta: sleeveA.meta }))
    };
  }

  window.designSleeveB = Object.freeze({ draftSleeveB: draftSleeveB, readSleeveA: readSleeveA,
    RULES: Object.freeze({ hemRatio: HEM_RATIO, palmAllowanceCm: PALM_ALLOWANCE, maxRotationRad: MAX_ROTATION }) });
})();
