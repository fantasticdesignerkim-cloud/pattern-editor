// ══════════════════════════════════════════════
// designSleeveS.js — 소매 Ⓢ(P.49 하단 «Ⓡ 방법 + 소매 중심에 개더 분량을 추가한다») 순수 엔진. 화면 검토용 시안(2026-10-28).
// 책: «Ⓡ 과 같이 제도한다. 소매를 맞댈 때 개더 분량을 소매 중심선에 평행으로 추가한다.» 절개 그림 = 중심 띠 12 · 위 «개더» 6·6 · 소맷부리 개더.
// 김님 확정(2026-10-28): ① 같은 완료 몸판 Ⓐ 에서 만든 Ⓡ 한 장 소매를 중심선(x=0)에서 나눠 뒤 −G/2 · 앞 +G/2 **평행 이동**(회전·소매산 상승·끝점 재제도 없음),
//   가운데에 폭 G 의 종이 띠를 넣는다. G 기본 12(책 설정값, 수정 가능).
//   ② 위쪽 6·6 = 띠 **바깥** 소매산 양쪽 각 6 의 개더 범위(이동량이 아님) — 별도 설정값. 개더 구간 = G + 6 + 6(기본 24, 실제 봉제선 호 길이).
//   ③ 소맷부리 개더 = 전체 둘레(Ⓡ 와 같음). P.158(맞대면서 벌린다 = 회전) 일반 참조로 회전을 강제하지 않는다.
// 입력 = Ⓡ 결과(designSleeveR.draftSleeveR 성공값, 읽기 전용) + { spreadCm, capGatherSideCm }. Ⓡ 의 게이트·거부·잠정 곡선 설정은 Ⓡ 결과에서 그대로 이어받는다.
// 원래 반쪽(곡선·밑선·치수)은 강체 평행 이동만 — 띠 경계는 실제 종이 띠의 네 변(위·아래 = 수평 직선, 양옆 = 옛 중심선 ◎).
// Ⓡ 의 소매산은 새 SP 에서, 소맷부리는 E 에서 접선이 수평(중심선 직각)이므로 띠 위·아래 변과 접선이 이어진다(각 없음 → P.157 «각지지 않게» 추가 처리 불필요) — 검산해 meta.joints 에 기록.
// G = 0 이면 Ⓡ 형상과 같다(0 폭 띠 조각을 남기지 않는다).
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var DEFAULTS = Object.freeze({ spreadCm: 12, capGatherSideCm: 6 });
  var JOIN = 1e-9;
  function cp(p) { return { x: p.x, y: p.y }; }
  function fin(v) { return typeof v === "number" && isFinite(v); }
  function fail(reason, detail) { var o = { ok: false, reason: reason }; if (detail !== undefined) o.detail = detail; return o; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function sh(p, dx) { return { x: p.x + dx, y: p.y }; }
  function cubicAt(q, t) { var u = 1 - t; return { x: u * u * u * q[0].x + 3 * u * u * t * q[1].x + 3 * u * t * t * q[2].x + t * t * t * q[3].x, y: u * u * u * q[0].y + 3 * u * u * t * q[1].y + 3 * u * t * t * q[2].y + t * t * t * q[3].y }; }
  function cubicD1(q, t) { var u = 1 - t; return { x: 3 * u * u * (q[1].x - q[0].x) + 6 * u * t * (q[2].x - q[1].x) + 3 * t * t * (q[3].x - q[2].x), y: 3 * u * u * (q[1].y - q[0].y) + 6 * u * t * (q[2].y - q[1].y) + 3 * t * t * (q[3].y - q[2].y) }; }
  function angDeg(a, b) { var c = (a.x * b.x + a.y * b.y) / (Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y)); return Math.acos(Math.max(-1, Math.min(1, c))) * 180 / Math.PI; }
  function straightQ(a, b) { return [cp(a), { x: a.x + (b.x - a.x) / 3, y: a.y + (b.y - a.y) / 3 }, { x: a.x + 2 * (b.x - a.x) / 3, y: a.y + 2 * (b.y - a.y) / 3 }, cp(b)]; }   // 직선 변(3차 표현 — 공용 path 형식)
  function cubicsOf(path) { var out = [], cur = path.commands[0].points[0]; path.commands.slice(1).forEach(function (c) { out.push([cp(cur), cp(c.points[0]), cp(c.points[1]), cp(c.points[2])]); cur = c.points[2]; }); return out; }
  function pathOf(cs, role) { var cmds = [{ type: "M", points: [cp(cs[0][0])] }]; cs.forEach(function (q) { cmds.push({ type: "C", points: [cp(q[1]), cp(q[2]), cp(q[3])] }); }); return { kind: "path", commands: cmds, role: role }; }
  function shQ(q, dx) { return q.map(function (p) { return sh(p, dx); }); }
  function flat(q, n) { var o = []; for (var i = 0; i <= n; i++) o.push(cubicAt(q, i / n)); return o; }
  function plen(pts) { var s = 0; for (var i = 1; i < pts.length; i++) s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); return s; }
  function segsCross(a, b, c, d) {
    var o = function (p, q, r) { return (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x); };
    var d1 = o(c, d, a), d2 = o(c, d, b), d3 = o(a, b, c), d4 = o(a, b, d);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  }
  function loopSelfIntersects(loop) {
    var n = loop.length - 1;
    for (var i = 0; i < n; i++) for (var j = i + 2; j < n; j++) { if (i === 0 && j === n - 1) continue; if (segsCross(loop[i], loop[i + 1], loop[j], loop[j + 1])) return true; }
    return false;
  }
  // 소매산 반쪽 cubic(SP 쪽 끝 = 띠 경계) 위에서 SP 쪽 끝부터 호 길이 s 인 점(조밀 점열 4000 · 선형 보간). 반쪽 길이를 넘으면 null(거부 — clamp 없음).
  function pointAtArcFromEnd(q, fromEnd, s) {
    var pts = flat(q, 4000); if (fromEnd) pts.reverse();
    var acc = 0;
    for (var i = 1; i < pts.length; i++) {
      var d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      if (acc + d >= s) { var t = d > 0 ? (s - acc) / d : 0; return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t }; }
      acc += d;
    }
    return null;
  }

  // r = designSleeveR.draftSleeveR 성공 결과(읽기 전용) · params = { spreadCm, capGatherSideCm }(없으면 책 기본값)
  function draftSleeveS(r, params) {
    if (!r || !r.ok || !r.geometry || !r.meta) return fail("no-r-draft");
    var p = {}, bad = [];
    Object.keys(DEFAULTS).forEach(function (k) { var v = params && params[k]; p[k] = (v === undefined || v === null) ? DEFAULTS[k] : v; if (!fin(p[k])) bad.push(k); });
    if (bad.length) return fail("invalid-input", { keys: bad });
    if (p.spreadCm < 0 || p.capGatherSideCm < 0) return fail("input-out-of-range", { rule: "총 벌림 ≥ 0 · 띠 바깥 개더 범위 ≥ 0" });
    var G = p.spreadCm, h = G / 2, rg = r.geometry, rm = r.meta;
    var cap = rg.outline.filter(function (s) { return s.role === "cap"; })[0], hem = rg.outline.filter(function (s) { return s.role === "hem"; })[0];
    var uaF = rg.outline.filter(function (s) { return s.role === "underarm-front"; })[0], uaB = rg.outline.filter(function (s) { return s.role === "underarm-back"; })[0];
    if (!cap || !hem || !uaF || !uaB) return fail("r-geometry-unreadable");
    var cc = cubicsOf(cap), hc = cubicsOf(hem);   // cap: [U_b → SP, SP → U_f] · hem: [C_f → E, E → C_b]
    if (cc.length !== 2 || hc.length !== 2 || Math.abs(cc[0][3].x) > JOIN || Math.abs(cc[0][3].y) > JOIN || Math.abs(hc[0][3].x) > JOIN) return fail("r-geometry-unreadable", { why: "center-split" });
    var capB = cc[0], capF = cc[1], hemF = hc[0], hemB = hc[1], SP0 = cp(cc[0][3]), E0 = cp(hc[0][3]);
    // 띠 바깥 개더 범위: 원래 반쪽 소매산 위 SP 쪽 끝(= 띠 경계)부터 호 길이 capGatherSideCm 인 점. 반쪽 소매산보다 길면 거부.
    var side = p.capGatherSideCm, capLenB = plen(flat(capB, 4000)), capLenF = plen(flat(capF, 4000));
    if (!(side < capLenB) || !(side < capLenF)) return fail("gather-zone-too-long", { capGatherSideCm: side, backCapCm: capLenB, frontCapCm: capLenF });
    var gB = pointAtArcFromEnd(capB, true, side), gF = pointAtArcFromEnd(capF, false, side);
    if (!gB || !gF) return fail("gather-zone-too-long");
    var outline, construction, bandZone = null;
    var rCons = rg.construction || [];
    if (G === 0) {   // 벌림 0 = Ⓡ 형상 그대로(0 폭 띠 조각 없음)
      outline = clone(rg.outline); construction = clone(rCons);
    } else {
      var Tb = cp(sh(SP0, -h)), Tf = cp(sh(SP0, h)), Bb = cp(sh(E0, -h)), Bf = cp(sh(E0, h));
      var capPath = pathOf([shQ(capB, -h), straightQ(Tb, SP0), straightQ(SP0, Tf), shQ(capF, h)], "cap");   // 띠 위 변은 SP′(x=0)에서 두 토막 — 공용 capSplit 이 그 마디에서 앞뒤를 나눈다
      var hemPath = pathOf([shQ(hemF, h), straightQ(Bf, E0), straightQ(E0, Bb), shQ(hemB, -h)], "hem");
      outline = [capPath, { kind: "line", from: sh(uaF.from, h), to: sh(uaF.to, h), role: "underarm-front" }, hemPath, { kind: "line", from: sh(uaB.from, -h), to: sh(uaB.to, -h), role: "underarm-back" }];
      construction = [];
      rCons.forEach(function (c) {
        if (c.role === "center-line") {   // 옛 중심선 두 개(◎ — 띠 양옆, 맞댐선이 아니라 띠 경계) + 새 결(띠 가운데)
          construction.push({ kind: "line", from: sh(c.from, -h), to: sh(c.to, -h), role: "old-center-back" }, { kind: "line", from: sh(c.from, h), to: sh(c.to, h), role: "old-center-front" },
            { kind: "line", from: cp(c.from), to: cp(c.to), role: "center-line" });
        } else if (c.role === "width-line") construction.push({ kind: "line", from: sh(c.from, -h), to: sh(c.to, h), role: "width-line" });   // 폭선 U_b′ → U_f′(띠를 가로지름)
        else if (c.role === "cuff-guide") { var dx = c.to.x < 0 ? -h : h; construction.push({ kind: "line", from: sh(c.from, dx), to: sh(c.to, dx), role: "cuff-guide" }); }
        else construction.push(clone(c));
      });
      bandZone = [Tb, Tf, Bf, Bb];
    }
    var geometry = { outline: outline, construction: construction, capSplit: { x: 0 } };
    // 검증: 폐곡선 · 자기교차 · 접속(띠 위·아래 변과 원래 반쪽)
    var oc = cubicsOf(outline[0]), oh = cubicsOf(outline[2]), loop = [];
    oc.forEach(function (q, i) { loop = loop.concat(flat(q, 48).slice(i ? 1 : 0)); });
    loop.push(cp(outline[1].to));
    oh.forEach(function (q) { loop = loop.concat(flat(q, 48).slice(1)); });
    loop.push(cp(outline[3].to));
    var gap = Math.hypot(loop[0].x - loop[loop.length - 1].x, loop[0].y - loop[loop.length - 1].y);
    if (gap > 1e-6) return fail("discontinuous", { gapCm: gap });
    if (loopSelfIntersects(loop)) return fail("self-intersection");
    var horiz = { x: 1, y: 0 };
    var joints = G === 0 ? { capAtBandBackDeg: 0, capAtBandFrontDeg: 0, hemAtBandBackDeg: 0, hemAtBandFrontDeg: 0, note: "벌림 0 — 띠 없음(Ⓡ 그대로)" } : {
      capAtBandBackDeg: angDeg(cubicD1(oc[0], 1), cubicD1(oc[1], 0)), capAtBandFrontDeg: angDeg(cubicD1(oc[2], 1), cubicD1(oc[3], 0)),
      hemAtBandFrontDeg: angDeg(cubicD1(oh[0], 1), cubicD1(oh[1], 0)), hemAtBandBackDeg: angDeg(cubicD1(oh[2], 1), cubicD1(oh[3], 0)),
      capBandFlat: angDeg(cubicD1(oc[1], 0.5), horiz) < 1e-9, hemBandFlat: angDeg(cubicD1(oh[1], 0.5), horiz) < 1e-9 || angDeg(cubicD1(oh[1], 0.5), { x: -1, y: 0 }) < 1e-9,
      note: "Ⓡ 소매산(새 SP)·소맷부리(E) 접선이 수평 → 띠 위·아래 수평 변과 접선 연속(각 없음) · 띠 구간은 평평" };
    // 계측: 원래 반쪽은 강체 이동이라 길이 불변 — 각 반쪽 + 띠 절반(G/2). 결과 이세 = 소매산 − 새 몸판 진동(Ⓡ 기본 이세 + 추가 G).
    var capBack = rm.cap.back + h, capFront = rm.cap.front + h, hemCm = rm.cuff.measuredHemCm + G;
    var meta = {
      rule: "pattern-school-p49-dolman-S(2026-10-28 draft)",
      settings: { inputs: clone(p), defaults: clone(DEFAULTS) },
      source: { presetId: "bunka-sleeve-R", inputs: clone(rm.settings.inputs), geometryHash: hashOf({ o: rg.outline, c: rg.construction }), derivedBodiceHash: hashOf(r.derivedBodice) },
      sleeveLengthCm: rm.sleeveLengthCm, capHeightCm: rm.capHeightCm, widthCm: rm.widthCm + G, spreadCm: G, halfShiftCm: h,
      back: { shiftCm: -h, capCm: capBack, sleevePoints: shiftPts(rm.back.sleevePoints, -h), match: { X: sh(rm.back.match.sleeve.X, -h), capMid: sh(rm.back.match.sleeve.capMid, -h) }, lower: clone(rm.back.lower), widthLineCm: rm.back.widthLineCm },
      front: { shiftCm: h, capCm: capFront, sleevePoints: shiftPts(rm.front.sleevePoints, h), match: { X: sh(rm.front.match.sleeve.X, h), capMid: sh(rm.front.match.sleeve.capMid, h) }, lower: clone(rm.front.lower), widthLineCm: rm.front.widthLineCm },
      cap: { back: capBack, front: capFront, total: capBack + capFront, r: clone(rm.cap) },
      armhole: clone(rm.armhole),
      ease: { baseRCm: rm.ease.total, addedGatherCm: G, total: capBack + capFront - rm.armhole.total, back: capBack - rm.armhole.back, front: capFront - rm.armhole.front,
        note: "결과 이세 = 소매산 − 새 몸판 진동 = Ⓡ 기본 이세 + 추가 개더 G(구분 표시)" },
      gather: { cap: { addedCm: G, sideCm: side, zoneCm: G + 2 * side, back: sh(gB, -h), front: sh(gF, h),   // 띠 바깥 개더 끝점(이동 후 소매 좌표)
          bandTop: G === 0 ? null : { from: sh(SP0, -h), to: sh(SP0, h) },
          note: "개더 구간 = 띠(G) + 띠 바깥 소매산 양쪽 각 범위(실제 봉제선 호 길이) — 이 구간에 소매산 추가 개더 G 를 배분" },
        cuff: { whole: true, note: "소맷부리 전체 둘레 개더(Ⓡ 와 같음)" } },
      cuff: { attachCm: rm.cuff.attachCm, formulaHemCm: rm.cuff.formulaHemCm + G, measuredHemCm: hemCm, gatherActualCm: hemCm - rm.cuff.attachCm, rMeasuredHemCm: rm.cuff.measuredHemCm,
        gatherReferenceCm: rm.cuff.gatherReferenceCm, curve: clone(rm.cuff.curve),
        note: "커프스 달림 ● = Ⓡ 그대로 · 직선 산식 = 2● + G · 실측 = Ⓡ 소맷부리 + 띠 아래 변 G · 실제 개더 = 실측 − 달림" },
      seams: clone(rm.seams),
      joints: joints,
      band: bandZone ? { pts: bandZone, widthCm: G, heightCm: E0.y - SP0.y } : null,
      unconfirmed: (rm.unconfirmed || []).slice(),
      checks: { closed: true, selfIntersection: false, maxGapCm: gap }
    };
    return { ok: true, geometry: geometry, derivedBodice: clone(r.derivedBodice), meta: meta, rMeta: rm, warnings: (r.warnings || []).slice(), sourceBodiceHash: r.sourceBodiceHash };
  }
  function shiftPts(o, dx) { var out = {}; Object.keys(o).forEach(function (k) { out[k] = sh(o[k], dx); }); return out; }
  function hashOf(o) { var s = JSON.stringify(o), h = 0; for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return (h >>> 0).toString(16); }

  window.designSleeveS = Object.freeze({ draftSleeveS: draftSleeveS, RULES: Object.freeze({ defaults: DEFAULTS }) });
})();
