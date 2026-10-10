// ══════════════════════════════════════════════
// sleeveAnnotation.js — 소매 Ⓐ/Ⓑ/Ⓒ 제작 정보 표시 모델(순수, 표시 전용). peplumAnnotation 과 같은 결.
//
// ★ 이 모듈이 만드는 것은 형상이 아니다. geometry·계측·체크포인트·hash·완료본·hit·레이아웃 어디에도 들어가지 않는다.
//   render.js 가 읽어 SVG 오버레이로만 그린다(pointer-events:none). 기본 소매(원형 소매 기준)에는 모델이 없다(null) — 기존 표시 회귀 보존.
// ★ 수치·위치는 전부 **현재 working.geometry.sleeve 와 그 라인 상태(working.sleeveA/B/C 의 meta)** 에서 읽는다(추측·재계산 없음).
//   그래서 EL 수정·라인 전환·몸판 변경 뒤 재제도되면 라벨·치수도 같은 geometry 로 다시 만들어진다. 소매산 길이·이세는 geometry 실측(designSleeve.capPrimitives)이다.
// ★ 선 종류: 재단 외곽 = 남색 실선(designRenderer). 이 모델의 선은 전부 «설명용» — 청록 점선/가는 치수선/옅은 음영. 닫힌 과거 절개선·겹침 영역은
//   음영/참고선으로만 보이고(cls "past"/"zone"), 현재 외곽이나 봉제 다트로 그리지 않는다. 해석이 확정되지 않은 값(도해 ⊠ 등)은 만들지 않는다.
//
// buildModel(project) → Model | null
//   Model = { key:"sleeve", line:"A"|"B"|"C", title,
//             lines:[{id,at,px:{dx,dy},anchor,text,cls}],            // 글자(기준점 + 화면 px 오프셋)
//             dims:[{id,from,to,axis:"h"|"v",at,text,px,anchor,cls}], // 치수선(축 고정 baseline `at`, 끝에서 baseline 까지 보조선)
//             leaders:[{id,from,toAt,toPx}],                          // 리더선(geometry 점 → 글자 위치)
//             zones:[{id,pts,cls}], refs:[{id,from,to,cls}], marks:[{id,at,cls}] }
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var num = function (v) { return typeof v === "number" && isFinite(v); };
  var P = function (p) { return { x: p.x, y: p.y }; };
  var dist = function (a, b) { return Math.hypot(a.x - b.x, a.y - b.y); };
  var f2 = function (v) { return (Math.round(v * 100) / 100).toFixed(2); };
  var sg = function (v) { return (v >= 0 ? "+" : "") + f2(v); };
  var DEFAULT_EL = 31.4;

  function lineOf(project) {
    var w = project && project.working; if (!w) return null;
    if (w.sleeveE) return { key: "E", st: w.sleeveE };
    if (w.sleeveD) return { key: "D", st: w.sleeveD };
    if (w.sleeveC) return { key: "C", st: w.sleeveC };
    if (w.sleeveB) return { key: "B", st: w.sleeveB };
    if (w.sleeveA) return { key: "A", st: w.sleeveA };
    return null;
  }
  function ctrl(prim) {
    if (!prim) return [];
    if (prim.kind === "line") return [prim.from, prim.to];
    if (prim.kind === "cubic") return [prim.from, prim.c1, prim.c2, prim.to];
    var pts = []; (prim.commands || []).forEach(function (c) { (c.points || []).forEach(function (p) { pts.push(p); }); }); return pts;
  }
  function cubicAt(q, t) {
    var u = 1 - t;
    return { x: u * u * u * q[0].x + 3 * u * u * t * q[1].x + 3 * u * t * t * q[2].x + t * t * t * q[3].x, y: u * u * u * q[0].y + 3 * u * u * t * q[1].y + 3 * u * t * t * q[2].y + t * t * t * q[3].y };
  }
  // cubic primitive 목록의 호 길이 중점
  function arcMid(prims) {
    var pts = [];
    prims.forEach(function (s) { var q = [s.from, s.c1, s.c2, s.to]; for (var i = (pts.length ? 1 : 0); i <= 40; i++) pts.push(cubicAt(q, i / 40)); });
    var tot = 0, i, segs = [];
    for (i = 1; i < pts.length; i++) { var d = dist(pts[i - 1], pts[i]); segs.push(d); tot += d; }
    var half = tot / 2, acc = 0;
    for (i = 0; i < segs.length; i++) { if (acc + segs[i] >= half) { var t = (half - acc) / segs[i]; return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * t, y: pts[i].y + (pts[i + 1].y - pts[i].y) * t }; } acc += segs[i]; }
    return pts[pts.length - 1];
  }

  function buildModel(project) {
    var L = lineOf(project); if (!L) return null;
    var w = project.working, g = w.geometry && w.geometry.sleeve, st = L.st, m = st && st.meta;
    var DS = window.designSleeve, BC = window.bodiceCheckpoint;
    if (!g || !Array.isArray(g.outline) || !m || st.blocked || !DS || !BC) return null;   // 차단 중에는 낡은 형상에 설명을 붙이지 않는다
    var bodice = BC.latest(project), prim = DS.capPrimitives(g);
    if (!prim || !bodice || !bodice.armholeLengths) return null;
    var AH = bodice.armholeLengths, key = L.key, hemY = m.sleeveLengthCm;
    if (!num(hemY)) return null;
    var xs = [], ys = [];
    g.outline.forEach(function (s) { ctrl(s).forEach(function (q) { xs.push(q.x); ys.push(q.y); }); });
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs), maxY = Math.max.apply(null, ys);

    var lines = [], dims = [], leaders = [], zones = [], refs = [], marks = [];
    var add = function (id, at, dx, dy, anchor, text, cls, group) { lines.push({ id: id, at: P(at), px: { dx: dx, dy: dy }, anchor: anchor, text: text, cls: cls || "label", group: group || id }); };
    var dim = function (id, a, b, axis, at, text, px, anchor, cls) { dims.push({ id: id, from: P(a), to: P(b), axis: axis, at: at, text: text, px: px || { dx: 0, dy: 11 }, anchor: anchor || "middle", cls: cls || "dim" }); };

    // ── 공통: 앞/뒤 · SP/소매 중심 · 위팔(소매폭)·소매산 높이 기준선 · 소매길이 · 소매산 길이/이세 ──
    var ref = (key === "A") ? m.underarm.after : m.underarm.before;   // Ⓐ = 실제 아랫점 · Ⓑ/Ⓒ = 출발 Ⓐ 의 위팔 기준(회전·맞댐 전, 설명용)
    var bicepY = ref.back.y, bicepW = ref.front.x - ref.back.x, capH = bicepY - m.sp.y;
    var sp = P(prim.splitPoint);
    add("back", { x: (ref.back.x + (key === "A" ? 0 : (m.axes ? m.axes.back.x : (m.cuts ? m.cuts.back.axisX : ref.back.x / 2)))) / 2, y: bicepY }, 0, 30, "middle", "뒤", "side");
    add("front", { x: (ref.front.x + (key === "A" ? 0 : (m.axes ? m.axes.front.x : (m.cuts ? m.cuts.front.axisX : ref.front.x / 2)))) / 2, y: bicepY }, 0, 30, "middle", "앞", "side");
    marks.push({ id: "sp", at: sp, cls: "sp" });
    add("sp", sp, 0, 18, "middle", "SP · 소매 중심(결)", "edge");
    if (key !== "A") refs.push({ id: "bicep-ref", from: P(ref.back), to: P(ref.front), cls: "past" });   // 출발 Ⓐ 위팔선(Ⓐ 는 construction 의 underarm-level 이 이미 있다)
    add("bicep", { x: 0, y: bicepY }, 0, -5, "middle", (key === "A" ? "위팔 기준선(소매폭) " : "출발 Ⓐ 위팔선(참고) ") + f2(bicepW) + " · 소매산 높이 " + f2(capH), "ref");
    // 소매길이: 오른쪽 치수선
    var dimX = 0;   // 소매 중심선 위(오른쪽 여백을 쓰지 않는다 — 소매는 맨 오른쪽 조각이라 fit 에서 잘린다)
    dim("len", { x: 0, y: m.sp.y }, { x: 0, y: hemY }, "v", dimX, "소매길이 " + f2(hemY), { dx: -5, dy: 3 }, "end", "dim");
    // 소매산 길이·이세(geometry 실측) — SP 위쪽 두 블록 + 호 중점에서 리더선
    var backMid = arcMid(prim.backPrimitives), frontMid = arcMid(prim.frontPrimitives);
    var eb = prim.lengths.back - AH.back, ef = prim.lengths.front - AH.front;
    add("cap-back-1", sp, -12, -34, "end", "뒤 소매산 " + f2(prim.lengths.back), "label", "cap-back");
    add("cap-back-2", sp, -12, -22, "end", "AH " + f2(AH.back) + " · 이세 " + sg(eb), "ref", "cap-back");
    add("cap-front-1", sp, 12, -34, "start", "앞 소매산 " + f2(prim.lengths.front), "label", "cap-front");
    add("cap-front-2", sp, 12, -22, "start", "AH " + f2(AH.front) + " · 이세 " + sg(ef), "ref", "cap-front");
    leaders.push({ id: "cap-back", from: P(backMid), toAt: sp, toPx: { dx: -14, dy: -18 } });
    leaders.push({ id: "cap-front", from: P(frontMid), toAt: sp, toPx: { dx: 14, dy: -18 } });
    var lengthsLine = "소매산 총 " + f2(prim.lengths.total) + " · AH 총 " + f2(AH.front + AH.back) + " · 이세(실측) 총 " + sg(eb + ef);

    // ── 라인별 ──
    var title, body = [], below = { x: 0, y: maxY };
    var rows = function (arr) { body = arr; };
    if (key === "A") {
      var hA = g.outline[3] && g.outline[3].kind === "line" ? g.outline[3] : null, cb = g.outline[1].to, cf = g.outline[2].to;
      title = "소매 Ⓐ · 기본 패턴(몸판 진동둘레 기준, P.137)";
      dim("hem", cb, cf, "h", hemY + 2.2, "소맷부리 " + f2(dist(cb, cf)) + " (= 소매폭)", { dx: 0, dy: 11 }, "middle", "dim");
      if (m.lineCm) {
        var bl = g.construction.filter(function (s) { return s.role === "back-line"; })[0], fl = g.construction.filter(function (s) { return s.role === "front-line"; })[0];
        if (bl) add("back-line", { x: (bl.from.x + bl.to.x) / 2, y: (bl.from.y + bl.to.y) / 2 }, -6, 3, "end", "뒤 기준선 " + f2(m.lineCm.back), "ref");
        if (fl) add("front-line", { x: (fl.from.x + fl.to.x) / 2, y: (fl.from.y + fl.to.y) / 2 }, 6, 3, "start", "앞 기준선 " + f2(m.lineCm.front), "ref");
      }
      rows([title, lengthsLine, "점선·가는 선 = 설명용(재단선 아님) · 남색 실선 = 재단 외곽"]);
    } else if (key === "B") {
      var fc = g.outline[1].to, bc = g.outline[3].from;
      title = "소매 Ⓑ · 타이트(소맷부리 W×3/4 맞댐, P.41)";
      dim("hem", bc, fc, "h", hemY + 2.2, "소맷부리 실측 " + f2(m.hemCm), { dx: 0, dy: 11 }, "middle", "dim");
      ["back", "front"].forEach(function (s) {
        var c = m.cuts[s], isB = s === "back";
        var ay = (c.pivot.y + hemY) / 2;
        add("axis-" + s, { x: c.axisX, y: ay }, isB ? -5 : 5, 0, isB ? "end" : "start", (isB ? "뒤" : "앞") + " 절개축", "ref", "axis-" + s);
        add("axis2-" + s, { x: c.axisX, y: ay }, isB ? -5 : 5, 10, isB ? "end" : "start", "(반폭 중점)", "ref", "axis-" + s);
        add("close-" + s, { x: c.axisX, y: ay }, isB ? -5 : 5, 20, isB ? "end" : "start", "맞댐 " + f2(c.closeAtHemCm), "ref", "axis-" + s);
      });
      rows([title, "소맷부리 목표 W×3/4 " + f2(m.hemTargetCm) + " · 실측 " + f2(m.hemCm) + " · 맞댐 ● " + f2(m.closeTotalCm) + " = " + f2(m.closePerCutCm) + " × 2곳", lengthsLine, "점선 = 설명용(맞댐 전 절개축·절개선, 재단선 아님) · 남색 실선 = 재단 외곽"]);
    } else if (key === "E") {
      var fe = m.flare, he = m.hemPoints;
      title = "소매 Ⓔ · 플레어(절개 3개 잘라서 벌림, P.42)";
      dim("open-back", he.backInner, he.backCenterOuter, "h", hemY + 2.2, "∅/3 " + f2(fe.openedCm.back), { dx: 0, dy: 11 }, "middle", "dim");
      dim("open-center", he.backCenterMid, he.frontCenterMid, "h", hemY + 2.2, "∅/3 " + f2(fe.openedCm.center), { dx: 0, dy: 11 }, "middle", "dim");
      dim("open-front", he.frontCenterOuter, he.frontInner, "h", hemY + 2.2, "∅/3 " + f2(fe.openedCm.front), { dx: 0, dy: 11 }, "middle", "dim");
      zones.push({ id: "open-back", pts: [P(m.pivots.back), P(he.backCenterOuter), P(he.backInner)], cls: "zone" });
      zones.push({ id: "open-center", pts: [P(m.pivots.sp), P(he.frontCenterMid), P(he.backCenterMid)], cls: "zone" });
      zones.push({ id: "open-front", pts: [P(m.pivots.front), P(he.frontInner), P(he.frontCenterOuter)], cls: "zone" });
      marks.push({ id: "pivot-sp", at: P(m.pivots.sp), cls: "notch" });
      add("pivot-sp", m.pivots.sp, 0, -8, "middle", "SP 기준(가운데 대칭 ±" + f2(m.rotationDeg.center) + "°)", "ref", "pivot-sp");
      [["back", m.pivots.back, -5, "end"], ["front", m.pivots.front, 5, "start"]].forEach(function (a) {
        marks.push({ id: "pivot-" + a[0], at: P(a[1]), cls: "notch" });
        add("pivot-" + a[0], a[1], a[2], 14, a[3], "기준점(" + (a[0] === "back" ? "뒤" : "앞") + ") +" + f2(m.rotationDeg[a[0] + "OuterRelative"]) + "°", "ref", "axis-" + a[0]);
      });
      add("open-note", { x: 0, y: (m.pivots.back.y + hemY) / 2 }, 0, 0, "middle", "벌린 틈(음영) = 잘라서 벌린 플레어", "ref", "open-note");
      rows([title, "플레어 ∅ = 소매폭 " + f2(m.widthCm) + " × 1 = " + f2(fe.totalCm) + " · 틈마다 ∅/3 " + f2(fe.perCutCm) + " (가운데 SP 대칭 → 바깥)",
        "소맷부리(곡선, 8 끝점 통과) " + f2(m.hemCm) + " · 벌리기 전 " + f2(m.hemBeforeCm) + " · 옆선 앞 " + f2(m.seams.frontCm) + " / 뒤 " + f2(m.seams.backCm),
        lengthsLine, "소매산 꺾임 3곳 재제도(잠정 구간 뒤 " + f2(m.redraw.ellChosenCm.Pb) + " · SP " + f2(m.redraw.ellChosenCm.SP) + " · 앞 " + f2(m.redraw.ellChosenCm.Pf) + "cm)",
        "점선·음영 = 설명용(재단선 아님, 벌린 틈은 처리 과정) · 남색 실선 = 재단 외곽"]);
    } else if (key === "D") {
      var fl = m.flare, hp = m.hemPoints;
      title = "소매 Ⓓ · 플레어(절개 2개 잘라서 벌림, P.42)";
      dim("open-back", hp.backInner, hp.centerBack, "h", hemY + 2.2, "∅/2 " + f2(fl.openedCm.back), { dx: 0, dy: 11 }, "middle", "dim");
      dim("open-front", hp.centerFront, hp.frontInner, "h", hemY + 2.2, "∅/2 " + f2(fl.openedCm.front), { dx: 0, dy: 11 }, "middle", "dim");
      zones.push({ id: "open-back", pts: [P(m.pivots.back), P(hp.centerBack), P(hp.backInner)], cls: "zone" });
      zones.push({ id: "open-front", pts: [P(m.pivots.front), P(hp.frontInner), P(hp.centerFront)], cls: "zone" });
      [["back", m.pivots.back, -5, "end"], ["front", m.pivots.front, 5, "start"]].forEach(function (a) {
        marks.push({ id: "pivot-" + a[0], at: P(a[1]), cls: "notch" });
        add("pivot-" + a[0], a[1], a[2], 14, a[3], "기준점(" + (a[0] === "back" ? "뒤" : "앞") + ") 회전 " + f2(m.rotationDeg[a[0]]) + "°", "ref", "axis-" + a[0]);
      });
      add("open-note", { x: 0, y: (m.pivots.back.y + hemY) / 2 }, 0, 0, "middle", "벌린 틈(음영) = 잘라서 벌린 플레어", "ref", "open-note");
      rows([title, "플레어 ∅ = 소매폭 " + f2(m.widthCm) + " × 0.5 = " + f2(fl.totalCm) + " · 절개마다 ∅/2 " + f2(fl.perCutCm),
        "소맷부리(곡선, 6 끝점 통과) " + f2(m.hemCm) + " · 벌리기 전 " + f2(m.hemBeforeCm) + " · 옆선 앞 " + f2(m.seams.frontCm) + " / 뒤 " + f2(m.seams.backCm),
        lengthsLine, "소매산 기준점 꺾임 재제도(잠정 구간 뒤 " + f2(m.redraw.ellChosenCm.Pb) + " · 앞 " + f2(m.redraw.ellChosenCm.Pf) + "cm)",
        "점선·음영 = 설명용(재단선 아님, 벌린 틈은 처리 과정) · 남색 실선 = 재단 외곽"]);
    } else {
      var sec = m.sections, wh = sec.white, fi = sec.final, u = sec.unitCm, elY = m.elbowLengthCm, bk = m.back, fr = m.front, wd = m.derivation.backWedge;
      var K = bk.outerCorner, Dn = bk.outerEnd, Hr = bk.legCenter.to, Cf = m.derivation.frontHemPoints[0], FP = fr.outerCorner;
      title = "소매 Ⓒ · 타이트 + 뒤 소맷부리 다트(P.41)";
      var base = hemY + 3.2;
      dim("hem-back", K, Dn, "h", base, "뒤 ● " + f2(fi.backOuter), { dx: 0, dy: 11 }, "middle", "dim");
      dim("hem-center", Hr, Cf, "h", base, "중앙 2● " + f2(fi.center), { dx: 0, dy: 11 }, "middle", "dim");
      dim("hem-front", Cf, FP, "h", base, "앞 " + f2(fi.frontOuter), { dx: 0, dy: 11 }, "middle", "dim");
      // 뒤 열린 다트: 꼭짓점(EL, 맞댄 쐐기 끝)·두 다리 길이·벌어짐·다리끝 1cm 내림
      var apex = bk.apex, legC = bk.legCenter, legO = bk.legOuter;
      marks.push({ id: "apex", at: P(apex), cls: "notch" });
      add("apex", apex, -8, 4, "end", "뒤 다트 꼭짓점(EL)", "label");
      add("leg-outer", { x: (apex.x + legO.to.x) / 2, y: (apex.y + legO.to.y) / 2 }, -6, 0, "end", "다리 " + f2(legO.lengthCm), "ref");
      add("leg-center", { x: (apex.x + legC.to.x) / 2, y: (apex.y + legC.to.y) / 2 }, 6, 0, "start", "다리 " + f2(legC.lengthCm), "ref");
      add("dart-width", { x: (Dn.x + Hr.x) / 2, y: hemY - 1.5 }, 0, 0, "middle", "벌어짐 " + f2(bk.dartOpenCm), "label");
      add("dart-drop", { x: (Dn.x + Hr.x) / 2, y: hemY - 1.5 }, 0, 11, "middle", "다리끝 소맷부리선 아래 1", "ref", "dart-width");
      // EL 선 라벨(기본 31.4 와 현재값)
      add("el", { x: m.axes.front.x + 0.8, y: elY }, 0, -14, "start", "EL " + f2(elY), "label", "el");
      add("el-2", { x: m.axes.front.x + 0.8, y: elY }, 0, -4, "start", "(기본 " + DEFAULT_EL + ")", "ref", "el");
      add("axis-back", { x: m.axes.back.x, y: elY - 9 }, -5, 0, "end", "뒤 맞댐(EL 까지)", "ref", "axis-back");
      add("axis-back-2", { x: m.axes.back.x, y: elY - 9 }, -5, 10, "end", "쐐기 EL 폭 " + f2(wd.D), "ref", "axis-back");
      add("axis-front", { x: m.axes.front.x, y: elY - 9 }, 5, 0, "start", "앞 맞댐", "ref", "axis-front");
      add("axis-front-2", { x: m.axes.front.x, y: elY - 9 }, 5, 10, "start", "(EL 간격 1)", "ref", "axis-front");
      // 앞 EL 절개 겹침(처리 과정, 재단선 아님): 맞댄 뒤 EL 절개선(하부 조각 위 변)과 상부 조각 아래 변 사이 쐐기
      zones.push({ id: "lap", pts: [P(fr.elCut.from), P(fr.elCut.to), P(fr.elCut.lowerOuter)], cls: "zone" });
      // 앞 EL→소매구 맞댐선(construction front-axis-lower, 청록 점선) 이름
      var ax = fr.axisLower, axM = { x: (ax.from.x + ax.to.x) / 2, y: (ax.from.y + ax.to.y) / 2 };
      add("axis-lower", axM, -5, 0, "end", "앞 맞댐선(EL→소매구)", "ref", "axis-lower");
      // 소매구 연장 영역(처리 과정 — 옅은 음영): 연장 전 모서리 → 연장 후 모서리 → 최종 앞 소맷부리 곡선
      var ex = fr.extension;
      zones.push({ id: "ext", pts: ex.zone.map(P), cls: "zone" });
      refs.push({ id: "ext-before", from: P(ex.before.from), to: P(ex.before.to), cls: "past" });   // 연장 전 앞 소맷부리 기준선(점선)
      add("ext", { x: ex.after.x + 0.6, y: ex.after.y + 1.2 }, 4, 0, "start", "소매구 연장 " + f2(ex.amountCm), "label", "ext");
      add("ext-2", { x: ex.after.x + 0.6, y: ex.after.y + 1.2 }, 4, 11, "start", "(점선 = 연장 전)", "ref", "ext");
      leaders.push({ id: "ext", from: P({ x: (ex.after.x + ex.before.from.x) / 2, y: (ex.after.y + ex.before.from.y) / 2 }), toAt: { x: ex.after.x + 0.6, y: ex.after.y + 1.2 }, toPx: { dx: 2, dy: -3 } });
      add("lap", { x: fr.elCut.to.x + 0.6, y: elY - 0.4 }, 4, 0, "start", "앞 EL 절개 겹침 " + f2(fr.overlapCm), "label", "lap");
      add("lap-2", { x: fr.elCut.to.x + 0.6, y: elY - 0.4 }, 4, 11, "start", "→ 소매구 연장 " + f2(fr.extensionCm), "label", "lap");
      rows([title, "소맷부리 목표 W×3/4 " + f2(m.hemTargetCm) + " · 실측(마무리 곡선) " + f2(m.hemCm) + " · ● = 소맷부리÷4 = " + f2(u),
        "완성 가정선 구간 뒤 ● " + f2(wh.backOuter) + " · 중앙 2● " + f2(wh.center) + " · 앞 ● " + f2(wh.frontOuter) + " (앞 최종 " + f2(fi.frontOuter) + ")",
        lengthsLine, "옆선 앞 " + f2(m.seams.frontCm) + " · 뒤 " + f2(m.seams.backCm) + " · 소매산 꺾임 양쪽 " + f2(m.redraw.ellCm) + "cm 재제도(임시 시작 설정)",
        "점선·음영 = 설명용(재단선 아님, 겹침은 처리 과정) · 남색 실선 = 재단 외곽"]);
    }
    body.forEach(function (t, i) { add("block-" + i, below, 0, 56 + i * 12, "middle", t, i === 0 ? "title" : (i === body.length - 1 ? "note" : "label"), "block"); lines[lines.length - 1].block = i; });
    var bb = { minX: minX, maxX: maxX, minY: Math.min.apply(null, ys.concat((g.construction || []).reduce(function (a, c) { return a.concat([c.from.y, c.to.y]); }, []))), maxY: Math.max(maxY, hemY) };
    (g.construction || []).forEach(function (c) { bb.minX = Math.min(bb.minX, c.from.x, c.to.x); bb.maxX = Math.max(bb.maxX, c.from.x, c.to.x); bb.maxY = Math.max(bb.maxY, c.from.y, c.to.y); });
    return { key: "sleeve", line: key, title: title, lines: lines, dims: dims, leaders: leaders, zones: zones, refs: refs, marks: marks, bbox: bb };
  }


  // ── 화면 배치(표시 전용, 순수): 글자 상자가 겹치면 가까운 빈 곳으로 옮기고(리더선), 그래도 안 되면 번호 표식 + 아래 «번호 설명»으로 모은다.
  //   필수 정보(앞/뒤·EL·다트·소맷부리 구간 등)는 조용히 생략하지 않는다 — 제자리에 못 두면 반드시 번호 설명에 남는다. scale = 화면 px / cm(= SC × zoom).
  var FS = { title: 12, side: 13, note: 8.5 };
  var fsOf = function (cls) { return FS[cls] || 9; };
  function textW(t, f) { var w = 0; for (var i = 0; i < t.length; i++) w += (t.charCodeAt(i) > 255 ? 1.0 : 0.58) * f; return w; }
  function boxOf(x, y, anchor, text, f) { var w = textW(text, f), x0 = anchor === "end" ? x - w : anchor === "middle" ? x - w / 2 : x; return { x0: x0, x1: x0 + w, y0: y - f * 0.85, y1: y + f * 0.2 }; }
  function hit(a, b) { return a.x0 < b.x1 - 0.5 && b.x0 < a.x1 - 0.5 && a.y0 < b.y1 - 0.5 && b.y0 < a.y1 - 0.5; }
  var PRIO = { len: 0, "hem": 0, "hem-back": 0, "hem-center": 0, "hem-front": 0, el: 1, apex: 1, "dart-width": 1, back: 2, front: 2, "leg-outer": 2, "leg-center": 2, lap: 2, ext: 2, "cap-back": 3, "cap-front": 3, sp: 4, bicep: 4, "axis-back": 5, "axis-front": 5, "axis-lower": 5, "open-note": 6, "open-back": 0, "open-front": 0, "open-center": 0, "pivot-sp": 4, "back-line": 6, "front-line": 6 };
  var NUM = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩", "⑪", "⑫", "⑬", "⑭", "⑮", "⑯", "⑰", "⑱", "⑲", "⑳"];

  function layout(model, scale) {
    var s = scale, bb = model.bbox, items = [], groups = {}, order = [];
    var push = function (it) { items.push(it); if (!groups[it.group]) { groups[it.group] = []; order.push(it.group); } groups[it.group].push(it); };
    model.dims.forEach(function (d) {
      var a = d.axis === "h" ? { x: (d.from.x + d.to.x) / 2, y: d.at } : { x: d.at, y: (d.from.y + d.to.y) / 2 };
      push({ id: d.id, dim: true, at: a, dx: d.px.dx, dy: d.px.dy, anchor: d.anchor, text: d.text, cls: "dim", group: d.id });
    });
    model.lines.forEach(function (l) { if (l.block === undefined) push({ id: l.id, at: l.at, dx: l.px.dx, dy: l.px.dy, anchor: l.anchor, text: l.text, cls: l.cls, group: l.group }); });
    var prio = function (g) { var k = g.indexOf("axis-") === 0 ? g : g; return PRIO[k] !== undefined ? PRIO[k] : 5; };
    order.sort(function (a, b) { return prio(a) - prio(b); });
    var placed = [], tags = [], legend = [], leaders = [];
    var boxesOf = function (g, sx, sy) { return groups[g].map(function (it) { return boxOf(it.at.x * s + it.dx + sx, it.at.y * s + it.dy + sy, it.anchor, it.text, fsOf(it.cls)); }); };
    var free = function (bxs) { return bxs.every(function (b) { return placed.every(function (p) { return !hit(b, p); }); }); };
    order.forEach(function (g) {
      var its = groups[g], h = Math.max.apply(null, its.map(function (i) { return fsOf(i.cls); })) + 2;
      var w = Math.max.apply(null, boxesOf(g, 0, 0).map(function (b) { return b.x1 - b.x0; })) + 4;
      var cands = [[0, 0]]; for (var k = 1; k <= 4; k++) cands.push([0, -k * h], [0, k * h]);
      cands.push([w, 0], [-w, 0], [w, -h], [-w, -h], [w, h], [-w, h], [0, -5 * h], [0, 5 * h]);
      var chosen = null;
      for (var c = 0; c < cands.length && !chosen; c++) { var bxs = boxesOf(g, cands[c][0], cands[c][1]); if (free(bxs)) chosen = { sx: cands[c][0], sy: cands[c][1], bxs: bxs }; }
      if (chosen) {
        its.forEach(function (it, i) { it.fdx = it.dx + chosen.sx; it.fdy = it.dy + chosen.sy; });
        chosen.bxs.forEach(function (b) { placed.push(b); });
        if (Math.abs(chosen.sx) + Math.abs(chosen.sy) > 6) leaders.push({ id: g, at: its[0].at, toPx: { dx: its[0].fdx + (its[0].anchor === "end" ? 0 : its[0].anchor === "middle" ? 0 : 0), dy: its[0].fdy - 3 } });
      } else {   // 번호 표식 + 번호 설명
        var n = legend.length, tag = { n: n, id: g, at: its[0].at, dx: 0, dy: 0 }, tb;
        for (var c2 = 0; c2 < cands.length; c2++) { tb = { x0: its[0].at.x * s + cands[c2][0] - 6, x1: its[0].at.x * s + cands[c2][0] + 6, y0: its[0].at.y * s + cands[c2][1] - 6, y1: its[0].at.y * s + cands[c2][1] + 6 }; if (free([tb])) { tag.dx = cands[c2][0]; tag.dy = cands[c2][1]; break; } tb = null; }
        if (!tb) tb = { x0: its[0].at.x * s - 6, x1: its[0].at.x * s + 6, y0: its[0].at.y * s - 6, y1: its[0].at.y * s + 6 };
        placed.push(tb); tags.push(tag);
        legend.push({ n: n, label: NUM[n] || String(n + 1), text: its.map(function (i) { return i.text; }).join(" "), group: g });
        its.forEach(function (it) { it.legend = n; });
      }
    });
    // 설명 블록(제목·요약·구분 문구) — 치수선 글자 아래에서 시작, 번호 설명이 있으면 그 아래에 이어 붙인다
    var baseY = bb.maxY * s, bottom = placed.reduce(function (m, b) { return Math.max(m, b.y1); }, baseY);
    var top = Math.max(36, bottom - baseY + 16), bl = model.lines.filter(function (l) { return l.block !== undefined; }).sort(function (a, b) { return a.block - b.block; });
    var blocks = [], row = 0;
    var addRow = function (id, text, cls) { blocks.push({ id: id, at: { x: 0, y: bb.maxY }, dx: 0, dy: top + row * 12, anchor: "middle", text: text, cls: cls }); row++; };
    bl.forEach(function (l, i) { if (l.cls === "note" && legend.length) return; addRow(l.id, l.text, l.cls); });
    if (legend.length) {
      addRow("legend-head", "배율이 작아 일부 설명을 번호(" + legend.map(function (e) { return e.label; }).join("") + ")로 모았습니다 — 확대하면 제자리에 표시됩니다", "label");
      legend.forEach(function (e) { addRow("legend-" + e.n, e.label + " " + e.text, "ref"); });
      var nt = bl.filter(function (l) { return l.cls === "note"; })[0]; if (nt) addRow(nt.id, nt.text, "note");
    }
    blocks.forEach(function (b) { placed.push(boxOf(b.at.x * s + b.dx, b.at.y * s + b.dy, b.anchor, b.text, fsOf(b.cls))); });
    var ext = { top: 0, bottom: 0, left: 0, right: 0 };
    placed.forEach(function (b) { ext.top = Math.max(ext.top, bb.minY * s - b.y0); ext.bottom = Math.max(ext.bottom, b.y1 - bb.maxY * s); ext.left = Math.max(ext.left, bb.minX * s - b.x0); ext.right = Math.max(ext.right, b.x1 - bb.maxX * s); });
    return { items: items.filter(function (i) { return i.legend === undefined; }).map(function (i) { return { id: i.id, dim: !!i.dim, at: i.at, dx: i.fdx, dy: i.fdy, anchor: i.anchor, text: i.text, cls: i.cls }; }).concat(blocks.map(function (b) { return { id: b.id, dim: false, at: b.at, dx: b.dx, dy: b.dy, anchor: b.anchor, text: b.text, cls: b.cls }; })),
      leaders: leaders, tags: tags.map(function (t) { return { n: t.n, label: NUM[t.n] || String(t.n + 1), at: t.at, dx: t.dx, dy: t.dy }; }), legend: legend, compact: legend.length > 0, extent: ext, scale: s };
  }
  // 화면 초기화(fit)가 설명 영역을 포함하도록 — 소매 geometry bbox 바깥으로 나오는 px 여백(위·아래·좌·우). 모델이 없으면 0.
  function overhang(project, scale) {
    var m = buildModel(project); if (!m) return { top: 0, bottom: 0, left: 0, right: 0 };
    var e = layout(m, scale).extent; return { top: Math.max(0, e.top), bottom: Math.max(0, e.bottom), left: Math.max(0, e.left), right: Math.max(0, e.right) };
  }

  window.sleeveAnnotation = Object.freeze({ buildModel: buildModel, layout: layout, overhang: overhang });
})();
