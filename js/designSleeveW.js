// ══════════════════════════════════════════════
// designSleeveW.js — 소매 Ⓦ 래글런 슬리브([패턴학교] P.53 «몸판에 소매 달림선을 그리고 직접 제도한다(소매산 높이 = 평균 어깨 길이의 1/2)» ·
//   소매산 높이 P.137 · 제도 방법 P.142–143 · 맞댄다 P.157 · 닫는다 P.160). 2026-11-03 시안(김님 그림 확인 «괜찮은데» — 제품 완성 승인은 검증 후 별도).
//
// 책(P.53):
//   «Ⓥ 와 같이 제도한다. 소매산 높이는 낮게, 평균 어깨 길이의 1/2 로 설정. 따라서 소매 폭이 넓어진다. 이와 연동해 소매 경사도 Ⓥ 보다 완만해진다.»
//   도해: 경사 8 ⟂ 뒤 1.3 / 앞 (★)2 · 뒤·앞 «다트 끝» = SP · 뒤 «닫는다»(뒤 어깨 다트 — Ⓥ 와 같음) · 앞 0.6.
//   사진 설명: «앞뒤 소매를 맞대고 어깨선은 다트로 처리한다» → **한 장 소매**: SP ~ 소맷부리의 두 중심선을 맞대고(P.157) 목 ~ SP 는 열린 어깨 다트.
//
// 공정: 몸판 쪽(Ⓐ · 앞 AH 다트 → 옆 · 목 2/3 · 가장 안쪽 ⟂ BL · M · 안내선 · ★ · 뒤 어깨 다트 닫기)은 Ⓥ 와 **같다** → 파생 몸판은 Ⓥ 와 같은 형상.
//   소매 쪽만 다르다: ◉ = 평균 어깨 길이 × 1/2 · 경사 1.3 / 2 · 폭 시안 19.5 / 19.1 · SP 다듬기 없음(SP = 다트 끝) · 두 장을 중심선에서 맞대 한 장.
//   엔진 재사용 경계: designSleeveV.draftSleeveV(…, { spCorner: "keep", pieceGapCm: 0 }) 한 번 호출 → 그 두 장 결과를 맞댄다.
//   Ⓥ 기본 경로(opts 없음)는 바뀌지 않는다.
//
// 맞대기(제1법칙 · 종이로 접히는가): 두 중심선 SP→E 는 같은 직선(길이 = 소매길이)이라 정확히 겹친다(차 0). 뒤 조각은 x ≤ 0, 앞 조각은 x ≥ 0 이어야
//   겹치지 않는다(맞댄 선 양쪽). 맞댄 선 SP→E 는 외곽에서 사라지고(솔기 아님) 기준선(butt-line)으로만 남는다. 목 ~ SP 의 두 다리는 지금 열린 다트 =
//   실제 외곽선이다. 다리 길이 차(B83 0.016cm)는 기록만 — 보정하지 않는다(두 다리는 SP 를 공유하고 목옆점은 각 몸판이 정한다).
//
// 폭 기본값 19.5 / 19.1(B83 · 소매길이 54 시안 — 보편 공식 아님): 몸판 ★ → 진동 아랫점 곡선을 ★ 접선에 반전한 뒤, 같은 현 길이로 소매 폭선에
//   닿게 한 점의 폭(B83: 뒤 19.49 / 앞 19.09)을 0.05 단위로 올린 값. 책 그림 실측 폭/◉ ≈ 2.2(뒤·앞 거의 같음)와 맞는다. meta.widthBasis 에
//   현재 몸판의 반전 기준 폭을 함께 기록한다(입력값을 바꾸지 않는다).
// ══════════════════════════════════════════════
(function () {
  "use strict";
  // 책 수치(P.53 · P.142–143 — 설정값) + 이번 시안 설정값(폭 = Ⓦ 새 값 · 나머지 = Ⓥ 확정 시안 값 그대로 · 일반 공식 아님).
  var BOOK = Object.freeze({ slopeRunCm: 8, backSlopeDropCm: 1.3, frontSlopeDropCm: 2, capHeightRatio: 0.5, sideDartDropCm: 3, frontBulgeCm: 0.6, cuffRatio: 0.75 });
  var DRAFT = Object.freeze({ backStarAboveMCm: 2, frontStarAboveMCm: 3.5, backLowerJoinCm: 1, frontLowerJoinCm: 2, lowerHandleRatio: 0.45,
    backUnderarmWidthCm: 19.5, frontUnderarmWidthCm: 19.1, backUnderHandleRatio: 1.4, frontUnderHandleRatio: 0.35,
    releaseBeyondApCm: 4, releaseHandleRatio: 0.5, shoulderFairCm: 2, cuffFairCm: 3 });
  var NEW_FOR_W = ["backUnderarmWidthCm", "frontUnderarmWidthCm"];
  var DEFAULTS = Object.freeze(Object.assign({}, BOOK, DRAFT));
  var KEYS = ["sleeveLengthCm"].concat(Object.keys(DEFAULTS));
  var SAME = 1e-6;

  function cp(p) { return { x: p.x, y: p.y }; }
  function fin(v) { return typeof v === "number" && isFinite(v); }
  function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
  function dot(a, b) { return a.x * b.x + a.y * b.y; }
  function cross(a, b) { return a.x * b.y - a.y * b.x; }
  function dist(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); }
  function unit(a) { var l = Math.hypot(a.x, a.y); return l > 1e-15 ? { x: a.x / l, y: a.y / l } : null; }
  function deg(r) { return r * 180 / Math.PI; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function fail(reason, detail) { var o = { ok: false, reason: reason }; if (detail !== undefined) o.detail = detail; return o; }
  function cubicAt(q, t) { var u = 1 - t; return { x: u * u * u * q[0].x + 3 * u * u * t * q[1].x + 3 * u * t * t * q[2].x + t * t * t * q[3].x, y: u * u * u * q[0].y + 3 * u * u * t * q[1].y + 3 * u * t * t * q[2].y + t * t * t * q[3].y }; }
  function cubicsOf(s) {   // 외곽 조각 → cubic 목록(직선은 같은 직선의 cubic)
    if (s.kind === "line") return [[cp(s.from), cp(s.from), cp(s.to), cp(s.to)]];
    var o = [], cur = null;
    s.commands.forEach(function (c) { if (c.type === "M") cur = cp(c.points[0]); else { o.push([cur, cp(c.points[0]), cp(c.points[1]), cp(c.points[2])]); cur = cp(c.points[2]); } });
    return o;
  }
  function pathOf(cs, extra) {
    var cmds = [{ type: "M", points: [cp(cs[0][0])] }];
    cs.forEach(function (q) { cmds.push({ type: "C", points: [cp(q[1]), cp(q[2]), cp(q[3])] }); });
    var o = { kind: "path", commands: cmds }; if (extra) Object.keys(extra).forEach(function (k) { o[k] = extra[k]; }); return o;
  }
  function revChain(cs) { return cs.slice().reverse().map(function (q) { return [cp(q[3]), cp(q[2]), cp(q[1]), cp(q[0])]; }); }
  function flat(cs, n) { var o = []; cs.forEach(function (q, i) { for (var k = i ? 1 : 0; k <= n; k++) o.push(cubicAt(q, k / n)); }); return o; }
  function plen(pts) { var s = 0; for (var i = 1; i < pts.length; i++) s += dist(pts[i - 1], pts[i]); return s; }
  function chainLen(cs) { return plen(flat(cs, 400)); }
  function extraOf(s) { var o = {}; Object.keys(s).forEach(function (k) { if (k !== "kind" && k !== "commands" && k !== "from" && k !== "to") o[k] = clone(s[k]); }); return o; }
  // 닫힌 외곽 순서(끝점 최근접 이음 · 방향 무관) → 점열 + 최대 틈
  function orderLoop(segs) {
    var left = segs.map(cubicsOf), cs = left.shift(), pts = flat(cs, 24), end = cs[cs.length - 1][3], gap = 0;
    while (left.length) {
      var bi = -1, bd = Infinity, rv = false;
      left.forEach(function (c, i) { var d0 = dist(c[0][0], end), d1 = dist(c[c.length - 1][3], end); if (d0 < bd) { bd = d0; bi = i; rv = false; } if (d1 < bd) { bd = d1; bi = i; rv = true; } });
      var nx = left.splice(bi, 1)[0]; if (rv) nx = revChain(nx);
      gap = Math.max(gap, bd); flat(nx, 24).slice(1).forEach(function (q) { pts.push(q); }); end = nx[nx.length - 1][3];
    }
    gap = Math.max(gap, dist(end, pts[0]));
    return { ok: gap <= SAME, loop: pts, gapCm: gap };
  }
  function crossSign(o, a, b) { return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x); }
  // 진짜 교차만(부호가 허용오차 너머로 갈림) — 같은 직선 위 두 토막(공선)의 부동소수 잡음을 교차로 보지 않는다(소매길이 66·70 오판 수정)
  var CROSS_EPS = 1e-9;
  function segCross(a, b, c, d) { var d1 = crossSign(c, d, a), d2 = crossSign(c, d, b), d3 = crossSign(a, b, c), d4 = crossSign(a, b, d), e = CROSS_EPS; return ((d1 > e && d2 < -e) || (d1 < -e && d2 > e)) && ((d3 > e && d4 < -e) || (d3 < -e && d4 > e)); }
  function loopSelfIntersects(loop) {
    var n = loop.length;
    for (var i = 0; i < n - 1; i++) for (var j = i + 2; j < n - 1; j++) { if (i === 0 && j === n - 2) continue; if (segCross(loop[i], loop[i + 1], loop[j], loop[j + 1])) return true; }
    return false;
  }

  // 현재 몸판에서 «반전 → 같은 현 길이로 폭선» 기준 폭(기록용 · 입력을 바꾸지 않는다). 소매 좌표: x = 겨드랑이 쪽(n), y = 중심선(u).
  function widthBasisOf(m, side) {
    var dl = m.draftLayer[side], u = unit(sub(dl.E, dl.SP)), n = unit(sub(dl.Ustar, dl.W0)), H = m.capHeight.cm;
    var v = sub(dl.star, dl.SP), sx = dot(n, v), sy = dot(u, v), chord = dist(dl.star, dl.U), dy = H - sy;
    var ref = chord * chord >= dy * dy ? sx + Math.sqrt(chord * chord - dy * dy) : null;
    return { referenceCm: ref, chosenCm: m.widthCm[side], chordCm: chord, bodyLowerCm: m.raglan[side].body.starToUnderarmCm, starInSleeve: { x: sx, y: sy } };
  }

  function draftSleeveW(bodice, aGeometry, params) {
    var SV = window.designSleeveV;
    if (!SV || !SV.draftSleeveV || !SV.RULES) return fail("no-module");
    var p = {}, bad = [];
    KEYS.forEach(function (k) { var v = params && params[k]; p[k] = (v === undefined || v === null) ? DEFAULTS[k] : v; if (!fin(p[k])) bad.push(k); });
    if (bad.length) return fail("invalid-input", { keys: bad });
    var vp = clone(p); vp.spFairCm = SV.RULES.defaults.spFairCm;   // Ⓥ 입력 검사용 자리값 — spCorner "keep" 에서는 쓰이지 않는다
    var v = SV.draftSleeveV(bodice, aGeometry, vp, { spCorner: "keep", pieceGapCm: 0 });
    if (!v.ok) return v;
    var L0 = p.sleeveLengthCm, SPs = { x: 0, y: 0 }, Es = { x: 0, y: L0 };
    var seg = function (pc, role) { return v.geometry.outline.filter(function (s) { return s.piece === pc && s.role === role; }); };
    var one = function (pc, role) { var a = seg(pc, role); return a.length === 1 ? a[0] : null; };
    var need = ["raglan", "neck", "center-seam", "hem", "underarm"], pcs = ["back", "front"];
    for (var i = 0; i < pcs.length; i++) for (var j = 0; j < need.length; j++) if (!one(pcs[i], need[j])) return fail("butt-failed", { why: "piece-role", piece: pcs[i], role: need[j] });

    // ── 중심선을 SP 에서 나눈다: 목 ~ SP = 어깨 다트 다리(열린 다트 = 외곽) · SP ~ E = 맞댄 선(외곽에서 빠짐) ──
    var split = function (pc) {
      var cs = cubicsOf(one(pc, "center-seam")), last = cs[cs.length - 1];
      if (cs.length < 2 || dist(last[0], SPs) > SAME || dist(last[3], Es) > SAME) return null;
      return { leg: cs.slice(0, -1), butt: last };
    };
    var cB = split("back"), cF = split("front");
    if (!cB || !cF) return fail("butt-failed", { why: "center-not-split-at-SP" });
    var buttDev = Math.max(dist(cB.butt[0], cF.butt[0]), dist(cB.butt[3], cF.butt[3]), dist(cB.butt[1], cF.butt[1]), dist(cB.butt[2], cF.butt[2]));
    if (!(buttDev <= SAME)) return fail("butt-failed", { why: "center-lines-differ", devCm: buttDev });
    // 종이 겹침: 뒤 조각은 맞댄 선 왼쪽(x ≤ 0), 앞 조각은 오른쪽(x ≥ 0)
    var side = { back: -Infinity, front: Infinity };
    v.geometry.outline.forEach(function (s) { flat(cubicsOf(s), 48).forEach(function (q) { if (s.piece === "back") side.back = Math.max(side.back, q.x); else side.front = Math.min(side.front, q.x); }); });
    if (!(side.back <= SAME) || !(side.front >= -SAME)) return fail("butt-overlap", { backMaxX: side.back, frontMinX: side.front });

    // ── 한 장 외곽 ──
    var legB = cB.leg, legF = cF.leg, snpB = legB[0][0], snpF = legF[0][0];
    var hemB = cubicsOf(one("back", "hem")), hemF = cubicsOf(one("front", "hem"));
    if (dist(hemB[0][0], Es) > SAME || dist(hemF[0][0], Es) > SAME) return fail("butt-failed", { why: "hem-not-from-E" });
    var hem = revChain(hemB).concat(hemF);   // 뒤 소맷부리 끝 C → E → 앞 C(E 에서 한 직선)
    var dartTag = function (pc) { return { role: "shoulder-dart", piece: pc, dart: { id: "raglan-shoulder", apexAt: "to", open: true } }; };
    var outline = [clone(one("back", "raglan")), clone(one("back", "neck")), pathOf(legB, dartTag("back")), pathOf(legF, dartTag("front")),
      clone(one("front", "neck")), clone(one("front", "raglan")), clone(one("front", "underarm")), pathOf(hem, { role: "hem", piece: "sleeve" }), clone(one("back", "underarm"))];
    var lp = orderLoop(outline);
    if (!lp.ok) return fail("discontinuous", { gapCm: lp.gapCm });
    if (loopSelfIntersects(lp.loop)) return fail("self-intersection");
    var construction = clone(v.geometry.construction).concat([{ kind: "line", from: cp(SPs), to: cp(Es), role: "butt-line", piece: "sleeve" }]);

    // ── 실측(독립 — 각 선을 따로 잰다) ──
    var lenB = chainLen(legB), lenF = chainLen(legF);
    var dirB = unit(sub(legB[legB.length - 1][2], SPs)) || unit(sub(snpB, SPs)), dirF = unit(sub(legF[legF.length - 1][2], SPs)) || unit(sub(snpF, SPs));
    var dartDeg = deg(Math.abs(Math.atan2(cross(dirB, dirF), dot(dirB, dirF))));
    var m = clone(v.meta);
    m.rule = "pattern-school-p53-raglan-sleeve-W(2026-11-03 draft)";
    m.settings = { inputs: clone(p), defaults: clone(DEFAULTS), book: Object.keys(BOOK), draftChoices: Object.keys(DRAFT), newForW: NEW_FOR_W.slice(),
      inheritedFromV: Object.keys(DRAFT).filter(function (k) { return NEW_FOR_W.indexOf(k) < 0; }),
      constants: { fairHandle: v.meta.settings.constants.fairHandle, cuffHandle: v.meta.settings.constants.cuffHandle, pieceGapCm: 0 },
      vEngine: { spCorner: "keep", pieceGapCm: 0, note: "designSleeveV.draftSleeveV 재사용 — 몸판 쪽 공정·소매 두 장 제도는 Ⓥ 와 같은 함수" } };
    m.capHeight.note = "P.137 1·2: 다트를 닫은 봉제 상태의 SP → 진동 아랫점 수직 거리 평균 × 1/2(P.53) — 소매 폭선 = SP 에서 중심선을 따라 ◉";
    m.seams = {
      dart: { back: lenB, front: lenF, diffCm: lenB - lenF, angleDeg: dartDeg, neckOpenCm: dist(snpB, snpF), apex: cp(SPs), snp: { back: cp(snpB), front: cp(snpF) },
        note: "어깨 다트(목옆점 → SP · 다트 끝 = SP — P.53 «다트 끝») — 두 다리 길이 차는 이 시안의 결과로 기록만 한다(보정 없음)" },
      butt: { back: chainLen([cB.butt]), front: chainLen([cF.butt]), maxDevCm: buttDev, note: "맞댄 선(SP → 소맷부리 · P.157 맞댄다) — 솔기 아님 · 외곽에서 빠지고 기준선으로만 남는다" },
      underarm: clone(v.meta.seams.underarm), cuff: clone(v.meta.seams.cuff), hemCm: chainLen(hem)
    };
    m.fairing.spCm = null;
    m.fairing.note = "SP 다듬기 없음 — SP = 어깨 다트 끝(Ⓥ 의 «SP 가 각지지 않도록»은 Ⓦ 에 적용하지 않는다) · 뒤 어깨 닫은 자리 · 소맷부리 모서리 다듬기는 Ⓥ 와 같음";
    m.widthBasis = { back: widthBasisOf(m, "back"), front: widthBasisOf(m, "front"),
      rule: "몸판 ★ → 진동 아랫점 곡선을 ★ 접선에 반전 → 같은 현 길이로 소매 폭선에 닿는 점의 폭(B83 뒤 19.49 / 앞 19.09 → 시안 19.5 / 19.1)",
      bookFigure: "P.53 도해 실측 폭/◉ ≈ 2.2(뒤 2.20 · 앞 2.16) · 소맷부리/폭 ≈ 0.74",
      support: "B83 · 소매길이 54 에서 확인한 범위: 뒤·앞 17 ~ 20 은 소매 아래 곡선이 같은 치수로 이어짐 · 21 은 거부(under-curve-unreachable). 다른 치수의 기본값은 미검토" };
    m.sleevePoints.dart = { apex: cp(SPs), back: cp(snpB), front: cp(snpF) };
    m.sleevePoints.butt = { from: cp(SPs), to: cp(Es) };
    m.joints.neckSNPNote = "목옆점(뒤 + 앞) = 어깨 다트를 닫은 봉제 상태의 목선 연결각(180 이면 매끈)";
    m.unconfirmed = ["소매 폭 19.5 / 19.1 · ★ 위치 · 핸들 · 해제 곡선 · 진동 합류 · 다듬기 폭은 B83 · 소매길이 54 시안 설정값(폭 = 반전 기준 · 나머지 = Ⓥ 확정값) — 다른 치수의 기본값 타당성은 미검토",
      "어깨 다트 다리 길이 차(B83 0.016cm)는 기록만 — 보정하지 않는다", "다트 끝 = SP(책 도해) — SP 너머로 내리는 변형은 범위 밖",
      "카라 단계는 bodiceResult 목둘레를 그대로 쓴다(래글런 목 분할·뒤 소매 목 회전·어깨 다트 미반영 — 목둘레 길이는 같음)"];
    m.checks = { closed: true, connected: true, maxGapCm: Math.max(v.meta.checks.maxGapCm, lp.gapCm), selfIntersection: false, bodiceSelfIntersection: false,
      pieces: 1, centerSeam: false, butted: true, overlap: false, buttMaxDevCm: buttDev, sideExtentCm: { backMaxX: side.back, frontMinX: side.front } };
    return { ok: true, geometry: { outline: outline, construction: construction, pieces: ["sleeve"], centerSeam: false, butted: true, layoutGapCm: 0 },
      derivedBodice: v.derivedBodice, meta: m, warnings: [], sourceBodiceHash: v.sourceBodiceHash };
  }

  window.designSleeveW = Object.freeze({ draftSleeveW: draftSleeveW, KEYS: KEYS,
    RULES: Object.freeze({ defaults: DEFAULTS, book: BOOK, draft: DRAFT, newForW: NEW_FOR_W, bodicePresetId: "bunka-bodice-A" }) });
})();
