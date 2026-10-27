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

  // 봉제(소매 제도)용 진동 길이 — 저장 AH 에서 확인된 틈 메움 직선만 뺀 값(허리 이음선 Ⓜ·Ⓝ). 그 밖의 몸판은 저장 AH 그대로(2026-10-27).
  //   designSleeveA 가 없는 맥락(소매 Ⓐ 미사용 단독 계산)에서는 빼야 할 틈 기록(waistSeam.closedDart)이 없을 때만 저장 AH 와 같다고 확정할 수 있다 — 있으면 null.
  function sewnAH(b) {
    if (!b) return null; var S = window.designSleeveA; if (S && S.sewnArmholeLengths) return S.sewnArmholeLengths(b);
    var ws = b.waistSeam; return (ws && ((ws.front && ws.front.closedDart) || (ws.back && ws.back.closedDart))) ? null : (b.armholeLengths || null);
  }
  var num = function (v) { return typeof v === "number" && isFinite(v); };
  var P = function (p) { return { x: p.x, y: p.y }; };
  var dist = function (a, b) { return Math.hypot(a.x - b.x, a.y - b.y); };
  var f2 = function (v) { return (Math.round(v * 100) / 100).toFixed(2); };
  var sg = function (v) { return (v >= 0 ? "+" : "") + f2(v); };
  var DEFAULT_EL = 31.4;

  function lineOf(project) {
    var w = project && project.working; if (!w) return null;
    if (w.sleeveQ) return { key: "Q", st: w.sleeveQ };
    if (w.sleeveP) return { key: "P", st: w.sleeveP };
    if (w.sleeveO) return { key: "O", st: w.sleeveO };
    if (w.sleeveN) return { key: "N", st: w.sleeveN };
    if (w.sleeveM) return { key: "M", st: w.sleeveM };
    if (w.sleeveL) return { key: "L", st: w.sleeveL };
    if (w.sleeveK) return { key: "K", st: w.sleeveK };
    if (w.sleeveJ) return { key: "J", st: w.sleeveJ };
    if (w.sleeveI) return { key: "I", st: w.sleeveI };
    if (w.sleeveH) return { key: "H", st: w.sleeveH };
    if (w.sleeveG) return { key: "G", st: w.sleeveG };
    if (w.sleeveF) return { key: "F", st: w.sleeveF };
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

  function key0(L) { return L.key; }
  // Ⓕ: 소매산 길이 = 턱을 접은(봉제 후) 길이(designSleeveF.capLengthsOf, 김님 ③). 분할 = SP(가운데 띠 고정). 호 중점용 primitive 는 재단선 cubic.
  function primF(g, SF) {   // Ⓕ·Ⓖ 공통(모듈의 capLengthsOf)
    if (!SF) return null;
    var lens = SF.capLengthsOf(g); if (!lens) return null;
    var capS = g.outline.filter(function (s) { return s.role === "cap" && s.kind === "path"; })[0], cs = [], cur = capS.commands[0].points[0];
    capS.commands.slice(1).forEach(function (c) { cs.push({ kind: "cubic", from: cur, c1: c.points[0], c2: c.points[1], to: c.points[2] }); cur = c.points[2]; });
    return { backPrimitives: cs.slice(0, lens.splitIndex), frontPrimitives: cs.slice(lens.splitIndex), splitPoint: lens.split, lengths: lens.sewn, cutLengths: lens.cut };
  }

  function buildModel(project, opts) {
    var L = lineOf(project); if (!L) return null;
    var w = project.working, g = w.geometry && w.geometry.sleeve, st = L.st, m = st && st.meta;
    var DS = window.designSleeve, BC = window.bodiceCheckpoint;
    if (!g || !Array.isArray(g.outline) || !m || st.blocked || !DS || !BC) return null;   // 차단 중에는 낡은 형상에 설명을 붙이지 않는다
    var bodice = BC.latest(project), prim = key0(L) === "O" ? primF(g, window.designSleeveO) : key0(L) === "F" ? primF(g, window.designSleeveF) : key0(L) === "G" ? primF(g, window.designSleeveG) : DS.capPrimitives(g);
    if (!prim || !bodice || !sewnAH(bodice)) return null;
    var AH = sewnAH(bodice), key = L.key, hemY = m.sleeveLengthCm;
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
    add("sp", sp, 0, 18, "middle", (key === "J" || key === "K" || key === "M") ? "새 꼭대기(틈 가운데) · 결" : "SP · 소매 중심(결)", "edge");
    if (key !== "A") refs.push({ id: "bicep-ref", from: P(ref.back), to: P(ref.front), cls: "past" });   // 출발 Ⓐ 위팔선(Ⓐ 는 construction 의 underarm-level 이 이미 있다)
    add("bicep", { x: 0, y: bicepY }, 0, -5, "middle", (key === "A" ? "위팔 기준선(소매폭) " : "출발 Ⓐ 위팔선(참고) ") + f2(bicepW) + " · 소매산 높이 " + f2(capH), "ref");
    // 소매길이: 오른쪽 치수선
    var dimX = 0;   // 소매 중심선 위(오른쪽 여백을 쓰지 않는다 — 소매는 맨 오른쪽 조각이라 fit 에서 잘린다)
    // Ⓖ: O(중심선 × 위팔선) 고정·★ 위로 → 펼친 중심 길이 SP′→소맷부리 = 입력 소매길이 + ★(김님 2026-10-11: 길이 보정 안 함). 입력값과 구분해 표시.
    if ((key === "H" || key === "J" || key === "K" || key === "L" || key === "M" || key === "N" || key === "P") && num(m.centerLength && m.centerLength.spreadCm)) dim("len", { x: 0, y: m.sp.y }, { x: 0, y: m.sp.y + m.centerLength.spreadCm }, "v", dimX, ((key === "J" || key === "K" || key === "L" || key === "M" || key === "N" || key === "P") ? "꼭대기→소맷부리(중심) " : "SP→소맷부리(중심) ") + f2(m.centerLength.spreadCm) + " (입력 소매길이 " + f2(hemY) + ")", { dx: -5, dy: 3 }, "end", "dim");
    else dim("len", { x: 0, y: m.sp.y }, { x: 0, y: hemY }, "v", dimX, key === "G" ? "SP′→소맷부리 " + f2(hemY - m.sp.y) + " (입력 소매길이 " + f2(hemY) + " + ★)" : "소매길이 " + f2(hemY), { dx: -5, dy: 3 }, "end", "dim");
    // 소매산 길이·이세(geometry 실측) — SP 위쪽 두 블록 + 호 중점에서 리더선
    var backMid = arcMid(prim.backPrimitives), frontMid = arcMid(prim.frontPrimitives);
    var AHs = (key === "Q" && m.sewnArmholeCm) ? m.sewnArmholeCm : AH, ahWord = key === "Q" ? "남은 AH " : "AH ";   // Ⓠ: 구간 이세 = 남은 소매산 − 남은 AH(전체 AH 와 혼동 금지)
    var eb = prim.lengths.back - AHs.back, ef = prim.lengths.front - AHs.front;
    var capWord = (key === "F" || key === "G" || key === "O") ? "소매산(턱 접음) " : "소매산 ";
    add("cap-back-1", sp, -12, -34, "end", "뒤 " + capWord + f2(prim.lengths.back), "label", "cap-back");
    add("cap-back-2", sp, -12, -22, "end", ahWord + f2(AHs.back) + ((key === "J" || key === "K" || key === "M") ? " · 이세+개더 " : " · 이세 ") + sg(eb), "ref", "cap-back");
    add("cap-front-1", sp, 12, -34, "start", "앞 " + capWord + f2(prim.lengths.front), "label", "cap-front");
    add("cap-front-2", sp, 12, -22, "start", ahWord + f2(AHs.front) + ((key === "J" || key === "K" || key === "M") ? " · 이세+개더 " : " · 이세 ") + sg(ef), "ref", "cap-front");
    leaders.push({ id: "cap-back", from: P(backMid), toAt: sp, toPx: { dx: -14, dy: -18 } });
    leaders.push({ id: "cap-front", from: P(frontMid), toAt: sp, toPx: { dx: 14, dy: -18 } });
    var lengthsLine = "소매산 총 " + f2(prim.lengths.total) + " · " + ahWord + "총 " + f2(AHs.front + AHs.back) + " · " + (key === "Q" ? "구간 이세" : "이세") + "(실측) 총 " + sg(eb + ef);

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
    } else if (key === "H") {
      var hh = m.hem, fo = m.formula, cons = g.construction || [], cByRole = function (r) { return cons.filter(function (c) { return c.role === r; })[0]; };
      // 원래 종이 조각(김님 2026-10-11 의도 정정 — 책 P.44 «절개 그림»의 녹색 조각): EL 위 고정 부분 + EL 아래 강체 조각 4개(meta.rigid 그대로).
      //   표시 전용(재단선·hit·편집 대상 아님). 조각 아래변 = 원래 밑단(직선) — 최종 소맷부리 곡선(남색)과 다른 것을 그대로 보인다.
      var showPieces = !opts || opts.pieces !== false, paperZones = [];
      if (showPieces && m.rigid) {
        var capS = g.outline.filter(function (s2) { return s2.role === "cap" && s2.kind === "path"; })[0], up = [];
        if (capS) { var cur2 = capS.commands[0].points[0]; up.push(P(cur2)); capS.commands.slice(1).forEach(function (c) { var q = [cur2, c.points[0], c.points[1], c.points[2]]; for (var k2 = 1; k2 <= 24; k2++) up.push(cubicAt(q, k2 / 24)); cur2 = c.points[2]; }); }
        up.push(P(m.sides.front.star), P(m.sides.back.star));
        paperZones.push({ id: "paper-upper", pts: up, cls: "paper" });
        ["backOuter", "backInner", "frontInner", "frontOuter"].forEach(function (k) { if (m.rigid[k]) paperZones.push({ id: "paper-" + k, pts: m.rigid[k].map(P), cls: "paper" }); });
      }
      title = "소매 Ⓗ · 퍼프(EL 아래 절개 · 소맷부리 개더, P.44) — 화면 검토용 시안";
      dim("drop", m.drop.from, m.drop.to, "v", m.drop.from.x, "★ " + f2(m.drop.cm), { dx: 5, dy: 3 }, "start", "dim");
      add("el", { x: m.sides.front.star.x, y: m.elY }, 6, -4, "start", "EL " + f2(m.elbowLengthCm) + " (위는 Ⓐ 그대로)", "label", "el");
      zones.push({ id: "fill-center", pts: m.fill.centerGap.map(P), cls: "zone" });
      ["back", "front"].forEach(function (sid) {
        var isB = sid === "back", inn = cByRole("cut-b-inner-" + sid), out = cByRole("cut-b-outer-" + sid);
        if (inn && out) {
          zones.push({ id: "wedge-b-" + sid, pts: [P(inn.from), P(inn.to), P(out.to), P(out.from)], cls: "zone" });
          add("open-b-" + sid, { x: (inn.to.x + out.to.x) / 2, y: (inn.to.y + out.to.y) / 2 }, 0, 14, "middle", "∅/3 " + f2(isB ? m.openedCm.bBack : m.openedCm.bFront), "dim", "open-b-" + sid);
        }
        marks.push({ id: "star-" + sid, at: P(m.sides[sid].star), cls: "notch" });
        add("star-" + sid, m.sides[sid].star, isB ? -6 : 6, 12, isB ? "end" : "start", "☆ 기준점(바깥 " + f2(isB ? m.rotationDeg.outerBack : m.rotationDeg.outerFront) + "°)", "ref", "star-" + sid);
      });
      var aB = cByRole("cut-a-back"), aF = cByRole("cut-a-front");
      if (aB && aF) { zones.push({ id: "wedge-a", pts: [P(aB.from), P(aB.to), P(aF.to)], cls: "zone" }); add("open-a", { x: (aB.to.x + aF.to.x) / 2, y: (aB.to.y + aF.to.y) / 2 }, 0, 14, "middle", "∅/3 " + f2(m.openedCm.a), "dim", "open-a"); }
      add("fill-note", { x: 0, y: m.elY }, 0, 26, "middle", "음영 = 벌어진 틈(종이 덧댐)", "ref", "open-note");
      rows([title, "커프스 달림 ● = 손바닥 " + f2(m.cuff.palmCm) + " + 3 = " + f2(m.cuff.lengthCm) + " · 폭 " + f2(m.cuff.widthCm) + " (치수 정보 — 커프스 조각 없음)",
        "■ = Ⓐ 소맷부리 " + f2(m.widthCm) + " − ● = " + f2(fo.square) + " · ∅ = ● − ■ = " + f2(fo.spread) + " · 절개마다 " + f2(fo.perCut),
        "소맷부리(최종 곡선 실측) " + f2(hh.lengthCm) + " · 여유 산식 2● " + f2(hh.formulaHemCm) + " · 개더 " + f2(hh.gatherCm) + " · truing 파임 최대 " + hh.fair.maxCutCm.toFixed(2) + " · 덧댐 최대 " + hh.fair.maxOutwardCm.toFixed(2) + (hh.fair.largeDeviationNote ? " · 1cm 초과(Ⓗ 승인 범위)" : ""),
        "★ 가운데 내림 " + f2(m.drop.cm) + " · EL " + f2(m.elbowLengthCm) + " · 옆선 ☆ 에서 꺾임 뒤 " + f2(m.sideSeamKinkDeg.back) + "° · 앞 " + f2(m.sideSeamKinkDeg.front) + "°",
        lengthsLine + " (소매산 = Ⓐ — 소맷부리 개더와 별개)",
        (paperZones.length ? "녹색 = 원래 종이(아래변 = 원래 밑단 — 남색선 밖 녹색 = 파낸 곳) · 음영 = 벌어진 틈(덧댄 종이) · " : "점선·음영 = 설명용(재단선 아님) · ") + "남색 실선 = 최종 재단선"]);
      zones = paperZones.concat(zones);   // 종이 조각을 먼저(아래) 그리고 틈 음영을 그 위에
    } else if (key === "Q") {
      var hpQ = m.hemPoints, exQ = m.excludedArcCm, stQ = m.settings, atQ = m.attach;
      title = "소매 Ⓠ · 캡 슬리브(소매산 높이 × " + stQ.heightRatio + " 수평 · 직선 소맷부리, P.48) — 화면 검토용 시안";
      // 2026-10-27 표시 보완(김님): 녹색 = 남기는 Ⓠ(최종 소매산 + 새 수평 소맷부리 안쪽)만 · 회색 사선 + 점선 경계 = 잘라내는 부분(새 소맷부리 ~ Ⓐ 위팔선)
      //   — 두 영역을 겹치지 않는 별도 폴리곤으로 그린다(원래 Ⓐ 윗부분 전체를 녹색으로 깔지 않는다). 원래 Ⓐ 전체는 비교 도안 토글에 그대로.
      var showPcQ = !opts || opts.pieces !== false, paperQ = [];
      var capPathQ = g.outline.filter(function (sg) { return sg.role === "cap" && sg.kind === "path"; })[0];
      if (showPcQ && capPathQ) {   // 남기는 영역 = 최종 소매산(뒤 끝 → 앞 끝) + 직선 소맷부리로 닫힘(최종 geometry 그대로)
        var keepPts = [], curQ = capPathQ.commands[0].points[0]; keepPts.push(P(curQ));
        capPathQ.commands.slice(1).forEach(function (c) { var q = [curQ, c.points[0], c.points[1], c.points[2]]; for (var kq = 1; kq <= 24; kq++) keepPts.push(cubicAt(q, kq / 24)); curQ = c.points[2]; });
        paperQ.push({ id: "keep", pts: keepPts, cls: "keep" });
      }
      if (m.rigid && m.rigid.cutAway) zones.push({ id: "cut-away", pts: m.rigid.cutAway.map(P), cls: "cut" });
      add("cut-label", { x: (hpQ.back.x + hpQ.front.x) / 2, y: (m.bicepY + m.hemY) / 2 }, 0, 3, "middle", "잘라냄", "ref", "cut-label");
      dim("ratio", { x: hpQ.front.x, y: m.bicepY }, { x: hpQ.front.x, y: m.hemY }, "v", hpQ.front.x + 1.5, "H × " + stQ.heightRatio + " = " + f2(m.capHeightCm * stQ.heightRatio), { dx: 5, dy: 3 }, "start", "dim");
      dim("hem-q", hpQ.back, hpQ.front, "h", m.bicepY + 1.5, "소맷부리(직선) " + f2(m.hem.lengthCm), { dx: 0, dy: 11 }, "middle", "dim");
      marks.push({ id: "end-back", at: P(hpQ.back), cls: "notch" }, { id: "end-front", at: P(hpQ.front), cls: "notch" });
      add("end-back", hpQ.back, -6, -4, "end", "뒤 끝 · ● " + f2(exQ.back), "ref", "end-back");
      add("end-front", hpQ.front, 6, -4, "start", "앞 끝 · ∅ " + f2(exQ.front), "ref", "end-front");
      var atTxt = function (e) { return !e ? "-" : e.status === "ok" ? (e.acrossClosedDart ? "몸판에 표시(다트 닫은 봉제 진동 기준)" : "몸판에 표시") : "표시 보류(이어진 진동선 " + f2(e.reachedCm) + " cm 보다 김 — 판단 필요)"; };
      rows([title, "높이 비율 " + stQ.heightRatio + "(기본 1/4 · 허용 1/4 ~ 3/4) · 소매산 높이 H " + f2(m.capHeightCm) + " · 위팔선 위 " + f2(m.capHeightCm * stQ.heightRatio) + " · 결과 중심 길이 H × (1 − r) " + f2(m.centerLength.spreadCm) + " · 기장 입력 없음",
        "소매에서 빠진 호 뒤 ● " + f2(exQ.back) + " · 앞 ∅ " + f2(exQ.front) + " · 남은 소매산 뒤 " + f2(m.capLengths.back) + " · 앞 " + f2(m.capLengths.front) + (m.sewnArmholeCm ? " · 몸판 달림 구간(AH − 빠진 호) 뒤 " + f2(m.sewnArmholeCm.back) + " · 앞 " + f2(m.sewnArmholeCm.front) : ""),
        lengthsLine + " (구간 이세 = 남은 소매산 − 남은 AH · 소매산 원래 곡선 그대로)",
        "몸판 달림 끝: 뒤 " + atTxt(atQ && atQ.back) + " · 앞 " + atTxt(atQ && atQ.front) + " · 중심선 점선 고리(책 기호) — 의미 미확정, 형상에 쓰지 않음",
        (paperQ.length ? "녹색 = 남기는 Ⓠ(소매산 + 새 소맷부리 안쪽) · " : "") + "회색 사선 = 잘라내는 부분(새 소맷부리 ~ Ⓐ 위팔선 · 점선 = 원래 Ⓐ 외곽) · 남색 실선 = 최종 재단선(소매산 원래 곡선 + 직선 소맷부리)"]);
      zones = paperQ.concat(zones);
    } else if (key === "P") {
      var fP = m.flare, hP = m.hem, heP = m.hemPoints, rdP = m.redraw, rtP = m.rotationDeg, consP = g.construction || [], cP = function (r) { return consP.filter(function (c) { return c.role === r; })[0]; };
      title = "소매 Ⓟ · 반소매 플레어(절개 5개 · 가운데 SP 대칭 → 중간 → 바깥 · 소맷부리 플레어 = 소매 폭 × " + m.formula.ratio + ", P.48) — 화면 검토용 시안";
      // 원래 종이 6조각(엔진 meta.rigid.pieces 그대로 — 표시 전용) · 틈 5곳(옅은 음영) · 남색 = 최종 재단선
      var showPcP = !opts || opts.pieces !== false, paperP = [];
      if (showPcP && m.rigid && m.rigid.pieces) ["backOuter", "backMid", "backCenter", "frontCenter", "frontMid", "frontOuter"].forEach(function (k) { paperP.push({ id: "paper-" + k, pts: m.rigid.pieces[k].map(P), cls: "paper" }); });
      var ccb = cP("cut-center-back"), ccf = cP("cut-center-front");
      if (ccb && ccf) zones.push({ id: "wedge-center", pts: [P(ccb.from), P(ccb.to), P(ccf.to)], cls: "zone" });
      ["back-outer", "back-inner", "front-inner", "front-outer"].forEach(function (k) { var ax = cP("cut-axis-" + k), ed = cP("cut-edge-" + k); if (ax && ed) zones.push({ id: "wedge-" + k, pts: [P(ax.from), P(ax.to), P(ed.to)], cls: "zone" }); });
      dim("open-back-outer", heP.backOuterIn, heP.backMidOut, "h", hemY + 2.2, "⊠ " + f2(fP.openedCm.backOuter), { dx: 0, dy: 11 }, "middle", "dim");
      dim("open-back-inner", heP.backMidIn, heP.backCenterOut, "h", hemY + 2.2, "2⊠ " + f2(fP.openedCm.backInner), { dx: 0, dy: 11 }, "middle", "dim");
      dim("open-center", heP.backCenterMid, heP.frontCenterMid, "h", hemY + 2.2, "4⊠ " + f2(fP.openedCm.center), { dx: 0, dy: 11 }, "middle", "dim");
      dim("open-front-inner", heP.frontCenterOut, heP.frontMidIn, "h", hemY + 2.2, "2⊠ " + f2(fP.openedCm.frontInner), { dx: 0, dy: 11 }, "middle", "dim");
      dim("open-front-outer", heP.frontMidOut, heP.frontOuterIn, "h", hemY + 2.2, "⊠ " + f2(fP.openedCm.frontOuter), { dx: 0, dy: 11 }, "middle", "dim");
      marks.push({ id: "pivot-sp", at: P(m.pivots.sp), cls: "notch" });
      add("pivot-sp", m.pivots.sp, 0, -8, "middle", "SP 기준(가운데 대칭 ±" + f2(rtP.center) + "°)", "ref", "pivot-sp");
      [["back-inner", m.pivots.backInner, -5, "end", "뒤 안쪽", rtP.backMid], ["back-outer", m.pivots.backOuter, -5, "end", "뒤 바깥", rtP.backOuterRelative],
       ["front-inner", m.pivots.frontInner, 5, "start", "앞 안쪽", rtP.frontMid], ["front-outer", m.pivots.frontOuter, 5, "start", "앞 바깥", rtP.frontOuterRelative]].forEach(function (a6) {
        marks.push({ id: "pivot-" + a6[0], at: P(a6[1]), cls: "notch" });
        add("pivot-" + a6[0], a6[1], a6[2], 14, a6[3], "기준점(" + a6[4] + ") +" + f2(a6[5]) + "°", "ref", "axis-" + a6[0]);
      });
      rows([title, "● = Ⓐ 소매 폭 " + f2(m.formula.widthCm) + " · ∅ = ● × " + m.formula.ratio + "(설정값 — 책 기본 0.7) = " + f2(m.formula.spread) + " · ⊠ = ∅/10 = " + f2(m.formula.unit) + " · 틈(현) 1:2:4:2:1 · O 는 중심 절개로 갈라짐(기준 = SP · 틈 이등분선)",
        "소맷부리(최종 곡선 실측) " + f2(hP.lengthCm) + " · 출발 폭 " + f2(hP.startWidthCm) + " · 산식 W(1 + 계수) " + f2(hP.formulaHemCm) + " · 편차 " + sg(hP.diffFromFormulaCm) + " · truing 파임 최대 " + hP.fair.maxCutCm.toFixed(2) + " · 덧댐 최대 " + hP.fair.maxOutwardCm.toFixed(2),
        "회전: 가운데 ±" + f2(rtP.center) + "° → 중간 뒤 " + f2(rtP.backMid) + "° · 앞 " + f2(rtP.frontMid) + "° → 바깥 추가 뒤 " + f2(rtP.backOuterRelative) + "° · 앞 " + f2(rtP.frontOuterRelative) + "° · 소매산 꺾임 5곳 재제도(잠정 ℓ " + ["Pb2", "Pb1", "SP", "Pf1", "Pf2"].map(function (k) { return f2(rdP.ellChosenCm[k]); }).join(" / ") + ")" + (rdP.concaveDents && rdP.concaveDents.length ? " · 국소 오목/S 굽이 실측 " + rdP.concaveDents.join("·") + " — 승인 범위는 P048 참조" : ""),
        "길이: 입력 소매길이(SP → 출발 밑단) " + f2(m.centerLength.inputCm) + " · 벌린 뒤 중심 길이(실측) " + f2(m.centerLength.spreadCm),
        lengthsLine + " (소매산 개더 없음 — 플레어는 소맷부리)",
        (paperP.length ? "녹색 = 원래 종이 6조각(윗변 = 원래 소매산 · 아래변 = 원래 밑단 — 남색선과의 차이 = 재제도·truing) · 음영 = 벌어진 틈 5곳 · " : "점선·음영 = 설명용(재단선 아님) · ") + "남색 실선 = 최종 재단선"]);
      zones = paperP.concat(zones);
    } else if (key === "O") {
      var stO = m.settings, tkO = m.tucks, hO = m.hem, cO = m.cap;
      title = "소매 Ⓞ · 턱트 슬리브(평행 절개 4개 · 소매산·소맷부리 턱 바깥쪽, P.47) — 화면 검토용 시안";
      // 원래 종이 5조각(엔진 meta.rigid.pieces 그대로 — 표시 전용) · 평행 틈 4곳(옅은 음영) · 소맷부리 턱 박음 띠 · 남색 = 최종 재단선
      var showPcO = !opts || opts.pieces !== false, paperO = [];
      if (showPcO && m.rigid && m.rigid.pieces) ["backOuter", "backInner", "center", "frontInner", "frontOuter"].forEach(function (k) { paperO.push({ id: "paper-" + k, pts: m.rigid.pieces[k].map(P), cls: "paper" }); });
      var lerpO = function (a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; };
      ["back-outer", "back-inner", "front-inner", "front-outer"].forEach(function (id) {
        var t = tkO[id], isB = id.indexOf("back") === 0;
        zones.push({ id: "gap-" + id, pts: t.gap.map(P), cls: "zone" });
        zones.push({ id: "tuck-" + id, pts: t.hem.band.map(P), cls: "zone" });
        // 턱 표시(책 기호, 소맷부리 박음 띠 안): 높은 쪽 = 접는 선(중심 쪽), 낮은 쪽 = 맞출 선(바깥)
        [[0.5, 0.2], [0.85, 0.55]].forEach(function (f, i) { refs.push({ id: "tuck-mark-" + id + "-" + i, from: lerpO(t.hem.crease, t.hem.stitch.crease, f[0]), to: lerpO(t.hem.place, t.hem.stitch.place, f[1]), cls: "tick" }); });
        add("tuck-" + id, t.hem.mid, 0, -16, "middle", isB ? "← " + f2(t.spreadCm) : f2(t.spreadCm) + " →", "label", "tuck-" + id);
        add("captuck-" + id, t.cap.mid, 0, -8, "middle", isB ? "←" : "→", "ref", "captuck-" + id);
      });
      add("stitch-end", tkO["front-outer"].hem.stitch.place, 6, -2, "start", "박기 끝 " + f2(stO.stitchEndCm) + " (소맷부리에서)", "ref", "stitch-end");
      dim("hem-cut", hO.points[hO.points.length - 1], hO.points[0], "h", hemY + 2.2, "소맷부리 재단 " + f2(hO.cutCm) + " · 봉제(턱 접음) " + f2(hO.sewnCm), { dx: 0, dy: 11 }, "middle", "dim");
      rows([title, "설정(책 기본값 — 수정 가능, 산식 아님): 안쪽 절개 중심에서 좌우 각 " + f2(stO.innerOffsetCm) + "(가운데 띠 " + f2(2 * stO.innerOffsetCm) + ") · 간격 " + f2(stO.cutSpacingCm) + " · 틈마다 " + f2(stO.spreadCm) + " · 소맷부리 박기 끝 " + f2(stO.stitchEndCm),
        "턱: 소매산·소맷부리 모두 바깥쪽(소매 밑선 쪽)으로 접음 · 겹은 중심 쪽 조각 아래 · 소매산 쪽 박음 길이 미지정(책에 수치 없음)",
        "평행 이동(회전 없음): 가운데 띠(SP·중심선) 고정 · 안쪽 띠 ±" + f2(stO.spreadCm) + " · 바깥 조각 ±" + f2(2 * stO.spreadCm) + " · 접은 상태 = Ⓐ 선 → 거울/평행 역변환으로 펼친 재단선(소맷부리 직선 · 소매산 턱 입구 = 접기로 정해진 모양)",
        "소매산 재단(펼침) " + f2(cO.cutCm) + " · 봉제(턱 접음) " + f2(cO.sewnCm) + " · 소맷부리 재단 " + f2(hO.cutCm) + " · 봉제 " + f2(hO.sewnCm) + " · 참고 W + 틈 합 " + f2(hO.formulaCutCm) + " · W " + f2(hO.formulaSewnCm),
        lengthsLine + " (턱 접은 길이 · 소매산 개더 없음)",
        (paperO.length ? "녹색 = 원래 종이 5조각(윗변 = 원래 소매산 · 아래변 = 원래 밑단 — 남색선과의 차이 = 턱 입구) · 음영 = 평행 틈 4곳 + 소맷부리 턱 박음 띠 · 사선 = 턱(높은 쪽을 낮은 쪽으로) · " : "점선·음영·사선 = 설명용(재단선 아님) · ") + "남색 실선 = 최종 재단선"]);
      zones = paperO.concat(zones);
    } else if (key === "N") {
      var spN = m.spread, hN = m.hem, heN = m.hemPoints, rdN = m.redraw, stN = m.settings, tkN = m.tucks, consN = g.construction || [], cN = function (r) { return consN.filter(function (c) { return c.role === r; })[0]; };
      title = "소매 Ⓝ · 반소매 퍼프·소맷부리 턱(절개 3개 · 턱은 중심 쪽 · 박기 끝, P.47) — 화면 검토용 시안";
      // 원래 종이 4조각(엔진 meta.rigid.pieces 그대로 — 표시 전용) · 벌어진 틈 3곳(옅은 음영) · 턱 접힘 띠(소맷부리 ~ 박기 끝) · 남색 = 최종 재단선
      var showPcN = !opts || opts.pieces !== false, paperN = [];
      if (showPcN && m.rigid && m.rigid.pieces) ["backOuter", "backCenter", "frontCenter", "frontOuter"].forEach(function (k) { paperN.push({ id: "paper-" + k, pts: m.rigid.pieces[k].map(P), cls: "paper" }); });
      var cbN = cN("cut-center-back"), cfN = cN("cut-center-front"), abN = cN("cut-axis-back"), ebN = cN("cut-edge-back"), afN = cN("cut-axis-front"), efN = cN("cut-edge-front");
      if (cbN && cfN) zones.push({ id: "wedge-center", pts: [P(cbN.from), P(cbN.to), P(cfN.to)], cls: "zone" });
      if (abN && ebN) zones.push({ id: "wedge-back", pts: [P(abN.from), P(abN.to), P(ebN.to)], cls: "zone" });
      if (afN && efN) zones.push({ id: "wedge-front", pts: [P(afN.from), P(afN.to), P(efN.to)], cls: "zone" });
      // 턱 표시(책 기호): 접힘 띠 음영 + 사선 — 높은 쪽 = 접는 선(위층), 낮은 쪽 = 맞출 선. 박기 끝선은 construction(tuck-stitch-end).
      var lerpN = function (a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; };
      ["back-side", "center-back", "center-front", "front-side"].forEach(function (id) {
        var t = tkN[id], isC = id.indexOf("center") === 0, isB = id.indexOf("back") >= 0;
        zones.push({ id: "tuck-" + id, pts: t.band.map(P), cls: "zone" });
        [[0.5, 0.2], [0.85, 0.55]].forEach(function (f, i) { refs.push({ id: "tuck-mark-" + id + "-" + i, from: lerpN(t.creaseCorner, t.stitch.crease, f[0]), to: lerpN(t.placeCorner, t.stitch.place, f[1]), cls: "tick" }); });
        if (!isC) add("tuck-" + id, t.mid, isB ? -4 : 4, -16, isB ? "end" : "start", (isB ? "턱 " + f2(t.amountCm) + " → 중심" : "중심 ← 턱 " + f2(t.amountCm)), "label", "tuck-" + id);
      });
      add("tuck-center", heN.center, 0, -16, "middle", "→ 턱 " + f2(stN.centerTuckCm) + " ←", "label", "tuck-center");   // «두 반쪽이 중심선에서 맞닿음» 은 설명 블록(턱 줄)에
      add("stitch-end", tkN["front-side"].stitch.crease, 6, -2, "start", "박기 끝 " + f2(stN.stitchEndCm) + " (소맷부리에서)", "ref", "stitch-end");
      dim("open-back", heN.backInner, heN.backCenterOuter, "h", hemY + 2.2, "양옆 " + f2(spN.openedCm.back), { dx: 0, dy: 11 }, "middle", "dim");
      dim("open-center", heN.backCenterMid, heN.frontCenterMid, "h", hemY + 2.2, "가운데 " + f2(spN.openedCm.center), { dx: 0, dy: 11 }, "middle", "dim");
      dim("open-front", heN.frontCenterOuter, heN.frontInner, "h", hemY + 2.2, "양옆 " + f2(spN.openedCm.front), { dx: 0, dy: 11 }, "middle", "dim");
      marks.push({ id: "pivot-sp", at: P(m.pivots.sp), cls: "notch" });
      add("pivot-sp", m.pivots.sp, 0, -8, "middle", "SP 기준(가운데 대칭 ±" + f2(m.rotationDeg.center) + "°)", "ref", "pivot-sp");
      [["back", m.pivots.back, -5, "end"], ["front", m.pivots.front, 5, "start"]].forEach(function (a4) {
        marks.push({ id: "pivot-" + a4[0], at: P(a4[1]), cls: "notch" });
        add("pivot-" + a4[0], a4[1], a4[2], 14, a4[3], "기준점(" + (a4[0] === "back" ? "뒤" : "앞") + ") +" + f2(m.rotationDeg[a4[0] + "OuterRelative"]) + "°", "ref", "axis-" + a4[0]);
      });
      rows([title, "설정(책 기본값 — 수정 가능, 산식 아님): 절개 중심선 좌우 각 " + f2(stN.cutOffsetCm) + " · 벌림(현) 가운데 " + f2(stN.centerTuckCm) + " · 양옆 각 " + f2(stN.sideTuckCm) + " · 박기 끝 " + f2(stN.stitchEndCm) + " · 커프스·개더 없음",
        "턱: 중심 쪽으로 접음 — 양옆 = 바깥 조각 변을 가운데 조각 변에 얹음(겹은 바깥 조각 아래) · 가운데 = 두 반쪽이 중심선에서 맞닿음(겹은 각 조각 아래) · 박기 끝 위는 풀려 볼륨",
        "소맷부리(최종 실측) 재단(펼침) " + f2(hN.cutCm) + " · 봉제(턱 접음) " + f2(hN.sewnCm) + " · 턱에 숨는 길이 " + f2(hN.hiddenCm) + " · 참고 산식 W + 가운데 + 양옆 " + f2(hN.formulaCutCm),
        "접은 소맷부리 = Ⓐ 직선(정리할 꺾임 없음 · 파임·덧댐 0) → 역변환으로 펼친 재단선 · 소매산 꺾임 3곳 재제도(잠정 ℓ 뒤 " + f2(rdN.ellChosenCm.Pb) + " · SP " + f2(rdN.ellChosenCm.SP) + " · 앞 " + f2(rdN.ellChosenCm.Pf) + ")",
        "길이: 입력 소매길이(SP → 출발 밑단) " + f2(m.centerLength.inputCm) + " · 벌린 뒤 중심 길이(실측) " + f2(m.centerLength.spreadCm),
        lengthsLine + " (소매산 개더 없음)",
        (paperN.length ? "녹색 = 원래 종이 4조각(윗변 = 원래 소매산 · 아래변 = 원래 밑단 — 남색선과의 차이 = 재제도·턱 입구) · 음영 = 벌어진 틈 3곳 + 턱 접힘 띠 · 사선 = 턱(높은 쪽을 낮은 쪽으로) · " : "점선·음영·사선 = 설명용(재단선 아님) · ") + "남색 실선 = 최종 재단선"]);
      zones = paperN.concat(zones);
    } else if (key === "M") {
      var fM = m.flare, hM = m.hem, heM = m.hemPoints, rdM = m.redraw, rtM = m.rotationDeg, caM = m.capLengthsA, consM = g.construction || [], cM = function (r) { return consM.filter(function (c) { return c.role === r; })[0]; };
      title = "소매 Ⓜ · 반소매 퍼프(절개 5개 · 가운데 평행 + 소매산 기준점 회전 · 상승 · 소맷부리 개더 0.7배, P.46) — 화면 검토용 시안";
      // 원래 종이 6조각(엔진 meta.rigid.pieces 그대로 — 표시 전용) · 가운데 평행 틈 + 소매산 덧댐 · 쐐기 4곳 · 남색 = 최종 재단선
      var showPcM = !opts || opts.pieces !== false, paperM = [];
      if (showPcM && m.rigid && m.rigid.pieces) ["backOuter", "backMid", "backCenter", "frontCenter", "frontMid", "frontOuter"].forEach(function (k) { paperM.push({ id: "paper-" + k, pts: m.rigid.pieces[k].map(P), cls: "paper" }); });
      zones.push({ id: "fill-center", pts: m.fill.center.map(P), cls: "zone" });
      [["back-outer"], ["back-inner"], ["front-inner"], ["front-outer"]].forEach(function (a5) {
        var ax = cM("cut-axis-" + a5[0]), ed = cM("cut-edge-" + a5[0]);
        if (ax && ed) zones.push({ id: "wedge-" + a5[0], pts: [P(ax.from), P(ax.to), P(ed.to)], cls: "zone" });
      });
      dim("rise", m.rise.spBefore, m.rise.top, "v", m.rise.top.x, "상승 " + f2(m.rise.cm), { dx: 5, dy: 3 }, "start", "dim");
      dim("open-back-outer", heM.backOuterIn, heM.backMidOut, "h", hemY + 2.2, "⊠ " + f2(fM.openedCm.backOuter), { dx: 0, dy: 11 }, "middle", "dim");
      dim("open-back-inner", heM.backMidIn, heM.backCenterOut, "h", hemY + 2.2, "2⊠ " + f2(fM.openedCm.backInner), { dx: 0, dy: 11 }, "middle", "dim");
      dim("open-center", heM.backCenterMid, heM.frontCenterMid, "h", hemY + 2.2, "4⊠ " + f2(fM.openedCm.center) + " (평행)", { dx: 0, dy: 11 }, "middle", "dim");
      dim("open-front-inner", heM.frontCenterOut, heM.frontMidIn, "h", hemY + 2.2, "2⊠ " + f2(fM.openedCm.frontInner), { dx: 0, dy: 11 }, "middle", "dim");
      dim("open-front-outer", heM.frontMidOut, heM.frontOuterIn, "h", hemY + 2.2, "⊠ " + f2(fM.openedCm.frontOuter), { dx: 0, dy: 11 }, "middle", "dim");
      [["back-inner", m.pivots.backInner, -5, "end", "뒤 안쪽", rtM.backMid], ["back-outer", m.pivots.backOuter, -5, "end", "뒤 바깥", rtM.backOuterRelative],
       ["front-inner", m.pivots.frontInner, 5, "start", "앞 안쪽", rtM.frontMid], ["front-outer", m.pivots.frontOuter, 5, "start", "앞 바깥", rtM.frontOuterRelative]].forEach(function (a6) {
        marks.push({ id: "pivot-" + a6[0], at: P(a6[1]), cls: "notch" });
        add("pivot-" + a6[0], a6[1], a6[2], 14, a6[3], "기준점(" + a6[4] + ") +" + f2(a6[5]) + "°", "ref", "axis-" + a6[0]);
      });
      rows([title, "커프스 달림 ● = 위팔 둘레 " + f2(m.cuff.upperArmCm) + " + 4 = " + f2(m.cuff.lengthCm) + " · 폭 " + f2(m.cuff.widthCm) + " (치수 정보 — 커프스 조각 없음)",
        "■ = Ⓐ 소매폭 " + f2(m.widthCm) + " − ● = " + f2(m.formula.square) + " · ∅ = 0.7● − ■ = " + f2(m.formula.spread) + " · ⊠ = ∅/10 = " + f2(m.formula.unit) + " · 틈(현) 1:2:4:2:1 · 가운데 평행(좌우 2⊠) → 중간 → 바깥 순 회전 · O·SP 는 갈라짐(기준 = 틈 이등분선)",
        "소맷부리(최종 곡선 실측) " + f2(hM.lengthCm) + " · 산식 1.7● " + f2(hM.formulaHemCm) + " · 개더(실측) " + f2(hM.gatherCm) + " · 산식 0.7● " + f2(hM.formulaGatherCm) + " · truing 파임 최대 " + hM.fair.maxCutCm.toFixed(2) + " · 덧댐 최대 " + hM.fair.maxOutwardCm.toFixed(2) + " · 물결 = 개더 표시(재단선 아님)",
        "소매산 상승 " + f2(m.rise.cm) + " (설정값 — 개더 계수 0.7 과 별개) · 국소 재제도(잠정): 가운데 틈 양쪽 " + f2(rdM.center.ellCm) + " · 기준점 꺾임 " + ["Pb2", "Pb1", "Pf1", "Pf2"].map(function (k) { return f2(rdM.kinks.ellChosenCm[k]); }).join(" / ") + " cm · 입력 소매길이 " + f2(m.centerLength.inputCm) + " · 벌린 뒤 중심 " + f2(m.centerLength.spreadCm),
        caM ? "Ⓐ 소매산 " + f2(caM.total) + " · Ⓐ 실측 이세 " + sg(caM.total - AH.front - AH.back) + " + 추가 개더 " + sg(prim.lengths.total - caM.total) + " = 최종 − AH " + sg(eb + ef) + " (이세+개더 총량)" : lengthsLine,
        (paperM.length ? "녹색 = 원래 종이 6조각(윗변 = 원래 소매산 · 아래변 = 원래 밑단 — 남색선과의 차이 = 재제도·truing) · 음영 = 틈 5곳 + 소매산 덧댐 · " : "점선·음영 = 설명용(재단선 아님) · ") + "남색 실선 = 최종 재단선"]);
      zones = paperM.concat(zones);
    } else if (key === "L") {
      var fL = m.flare, hL = m.hem, heL = m.hemPoints, rdL = m.redraw, consL = g.construction || [], cL = function (r) { return consL.filter(function (c) { return c.role === r; })[0]; };
      title = "소매 Ⓛ · 반소매 퍼프(소매산 기준점 절개 3개 · 소맷부리 개더 0.5배, P.46) — 화면 검토용 시안";
      // 원래 종이 4조각(엔진 meta.rigid.pieces 그대로 — 표시 전용) · 틈 3곳(덧댄 종이) · 남색 = 최종 재단선
      var showPcL = !opts || opts.pieces !== false, paperL = [];
      if (showPcL && m.rigid && m.rigid.pieces) ["backOuter", "backCenter", "frontCenter", "frontOuter"].forEach(function (k) { paperL.push({ id: "paper-" + k, pts: m.rigid.pieces[k].map(P), cls: "paper" }); });
      var cbL = cL("cut-center-back"), cfL = cL("cut-center-front"), abL = cL("cut-axis-back"), ebL = cL("cut-edge-back"), afL = cL("cut-axis-front"), efL = cL("cut-edge-front");
      if (cbL && cfL) zones.push({ id: "wedge-center", pts: [P(cbL.from), P(cbL.to), P(cfL.to)], cls: "zone" });
      if (abL && ebL) zones.push({ id: "wedge-back", pts: [P(abL.from), P(abL.to), P(ebL.to)], cls: "zone" });
      if (afL && efL) zones.push({ id: "wedge-front", pts: [P(afL.from), P(afL.to), P(efL.to)], cls: "zone" });
      dim("open-back", heL.backInner, heL.backCenterOuter, "h", hemY + 2.2, "⊠ " + f2(fL.openedCm.back), { dx: 0, dy: 11 }, "middle", "dim");
      dim("open-center", heL.backCenterMid, heL.frontCenterMid, "h", hemY + 2.2, "2⊠ " + f2(fL.openedCm.center), { dx: 0, dy: 11 }, "middle", "dim");
      dim("open-front", heL.frontCenterOuter, heL.frontInner, "h", hemY + 2.2, "⊠ " + f2(fL.openedCm.front), { dx: 0, dy: 11 }, "middle", "dim");
      marks.push({ id: "pivot-sp", at: P(m.pivots.sp), cls: "notch" });
      add("pivot-sp", m.pivots.sp, 0, -8, "middle", "SP 기준(가운데 대칭 ±" + f2(m.rotationDeg.center) + "°)", "ref", "pivot-sp");
      [["back", m.pivots.back, -5, "end"], ["front", m.pivots.front, 5, "start"]].forEach(function (a4) {
        marks.push({ id: "pivot-" + a4[0], at: P(a4[1]), cls: "notch" });
        add("pivot-" + a4[0], a4[1], a4[2], 14, a4[3], "기준점(" + (a4[0] === "back" ? "뒤" : "앞") + ") +" + f2(m.rotationDeg[a4[0] + "OuterRelative"]) + "°", "ref", "axis-" + a4[0]);
      });
      rows([title, "커프스 달림 ● = 위팔 둘레 " + f2(m.cuff.upperArmCm) + " + 4 = " + f2(m.cuff.lengthCm) + " · 폭 " + f2(m.cuff.widthCm) + " (치수 정보 — 커프스 조각 없음)",
        "■ = Ⓐ 소매폭 " + f2(m.widthCm) + " − ● = " + f2(m.formula.square) + " · ∅ = 0.5● − ■ = " + f2(m.formula.spread) + " · ⊠ = ∅/4 = " + f2(m.formula.unit) + " · 틈(현) 가운데 2⊠ · 양옆 ⊠ · O 는 중심선 절개로 갈라짐(기준 = SP · 틈 이등분선)",
        "소맷부리(최종 곡선 실측) " + f2(hL.lengthCm) + " · 산식 1.5● " + f2(hL.formulaHemCm) + " · 개더(실측) " + f2(hL.gatherCm) + " · 산식 0.5● " + f2(hL.formulaGatherCm) + " · truing 파임 최대 " + hL.fair.maxCutCm.toFixed(2) + " · 덧댐 최대 " + hL.fair.maxOutwardCm.toFixed(2),
        "길이: 입력 소매길이(SP → 출발 밑단) " + f2(m.centerLength.inputCm) + " · 벌린 뒤 중심 길이(실측) " + f2(m.centerLength.spreadCm) + " · 소매산 꺾임 3곳 재제도(잠정 ℓ 뒤 " + f2(rdL.ellChosenCm.Pb) + " · SP " + f2(rdL.ellChosenCm.SP) + " · 앞 " + f2(rdL.ellChosenCm.Pf) + ")",
        lengthsLine + " (소매산은 늘리지 않음 — 개더는 소맷부리)",
        (paperL.length ? "녹색 = 원래 종이 4조각(윗변 = 원래 소매산 · 아래변 = 원래 밑단 — 남색선과의 차이 = 재제도·truing) · 음영 = 벌어진 틈 3곳(덧댄 종이) · " : "점선·음영 = 설명용(재단선 아님) · ") + "남색 실선 = 최종 재단선"]);
      zones = paperL.concat(zones);
    } else if (key === "K") {
      var fk = m.flare, hK = m.hem, heK = m.hemPoints, consK = g.construction || [], cK = function (r) { return consK.filter(function (c) { return c.role === r; })[0]; };
      var caK = m.capLengthsA, rdK = m.redraw, showPcK = !opts || opts.pieces !== false, paperK = [];
      title = "소매 Ⓚ · 퍼프(Ⓙ 방법 + 소매산 기준점 절개 2개 · 소맷부리 개더 1.5배, P.45) — 화면 검토용 시안";
      // 원래 종이 4조각(엔진 meta.rigid.pieces 그대로 — 표시 전용) · 틈 3곳(가운데 평행 + 양옆 쐐기)과 소매산 덧댐 · 남색 = 최종 재단선
      if (showPcK && m.rigid && m.rigid.pieces) ["backOuter", "backCenter", "frontCenter", "frontOuter"].forEach(function (k) { paperK.push({ id: "paper-" + k, pts: m.rigid.pieces[k].map(P), cls: "paper" }); });
      zones.push({ id: "fill-center", pts: m.fill.center.map(P), cls: "zone" });
      var abK = cK("cut-axis-back"), ebK = cK("cut-edge-back"), afK = cK("cut-axis-front"), efK = cK("cut-edge-front");
      if (abK && ebK) zones.push({ id: "wedge-back", pts: [P(abK.from), P(abK.to), P(ebK.to)], cls: "zone" });
      if (afK && efK) zones.push({ id: "wedge-front", pts: [P(afK.from), P(afK.to), P(efK.to)], cls: "zone" });
      dim("rise", m.rise.spBefore, m.rise.top, "v", m.rise.top.x, "상승 " + f2(m.rise.cm), { dx: 5, dy: 3 }, "start", "dim");
      dim("open-back", heK.backInner, heK.backCenterOuter, "h", hemY + 2.2, "∅/3 " + f2(fk.openedCm.back), { dx: 0, dy: 11 }, "middle", "dim");
      dim("open-center", heK.backCenterMid, heK.frontCenterMid, "h", hemY + 2.2, "∅/3 " + f2(fk.openedCm.center) + " (평행)", { dx: 0, dy: 11 }, "middle", "dim");
      dim("open-front", heK.frontCenterOuter, heK.frontInner, "h", hemY + 2.2, "∅/3 " + f2(fk.openedCm.front), { dx: 0, dy: 11 }, "middle", "dim");
      [["back", m.pivots.back, -5, "end"], ["front", m.pivots.front, 5, "start"]].forEach(function (a3) {
        marks.push({ id: "pivot-" + a3[0], at: P(a3[1]), cls: "notch" });
        add("pivot-" + a3[0], a3[1], a3[2], 14, a3[3], "기준점(" + (a3[0] === "back" ? "뒤" : "앞") + ") 회전 " + f2(m.rotationDeg[a3[0] + "Outer"]) + "°", "ref", "axis-" + a3[0]);
      });
      rows([title, "커프스 달림 ● = 손바닥 " + f2(m.cuff.palmCm) + " + 3 = " + f2(m.cuff.lengthCm) + " · 폭 " + f2(m.cuff.widthCm) + " (치수 정보 — 커프스 조각 없음)",
        "■ = Ⓐ 소맷부리 " + f2(m.widthCm) + " − ● = " + f2(m.formula.square) + " · ∅ = 1.5● − ■ = " + f2(m.formula.spread) + " · 틈마다 ∅/3 " + f2(m.formula.perCut) + " (가운데 = 좌우 ∅/6 평행 · 양옆 = 기준점 회전) · O·SP 는 갈라짐(기준 = 틈 이등분선)",
        "소맷부리(최종 곡선 실측) " + f2(hK.lengthCm) + " · 산식 2.5● " + f2(hK.formulaHemCm) + " · 개더(실측) " + f2(hK.gatherCm) + " · 산식 1.5● " + f2(hK.formulaGatherCm) + " · truing 파임 최대 " + hK.fair.maxCutCm.toFixed(2) + " · 덧댐 최대 " + hK.fair.maxOutwardCm.toFixed(2) + " · 물결 = 개더 표시(재단선 아님)",
        "소매산 상승 " + f2(m.rise.cm) + " (설정값 — 개더 계수 1.5 · Ⓙ 의 0.7 과 별개) · 국소 재제도(잠정): 가운데 틈 양쪽 " + f2(rdK.center.ellCm) + " · 기준점 꺾임 뒤 " + f2(rdK.kinks.ellChosenCm.Pb) + " · 앞 " + f2(rdK.kinks.ellChosenCm.Pf) + " cm",
        caK ? "Ⓐ 소매산 " + f2(caK.total) + " · Ⓐ 실측 이세 " + sg(caK.total - AH.front - AH.back) + " + 추가 개더 " + sg(prim.lengths.total - caK.total) + " = 최종 − AH " + sg(eb + ef) + " (이세+개더 총량)" : lengthsLine,
        (paperK.length ? "녹색 = 원래 종이 4조각(윗변 = 원래 소매산 · 아래변 = 원래 밑단 — 남색선과의 차이 = 재제도·truing) · 음영 = 틈 3곳 + 소매산 덧댐 · " : "점선·음영 = 설명용(재단선 아님) · ") + "남색 실선 = 최종 재단선"]);
      zones = paperK.concat(zones);
    } else if (key === "J") {
      var hj = m.hem, foJ = m.formula, gp = m.rigid.gap, ca = m.capLengthsA, showPcJ = !opts || opts.pieces !== false, paperJ = [];
      title = "소매 Ⓙ · 퍼프(중심선 평행 벌림 · 소매산 상승 · 소맷부리 개더, P.45) — 화면 검토용 시안";
      // 원래 종이 2조각(평행 이동만 — meta.rigid.pieces 그대로, 표시 전용) · 덧댄 종이(틈 + 소매산 정리) · 점선 = 대체된 원래 소매산 · 남색 = 최종 재단선
      if (showPcJ && m.rigid && m.rigid.pieces) ["back", "front"].forEach(function (k) { paperJ.push({ id: "paper-" + k, pts: m.rigid.pieces[k].map(P), cls: "paper" }); });
      zones.push({ id: "fill-gap", pts: m.fill.pts.map(P), cls: "zone" });
      ["back", "front"].forEach(function (k) { var oc = m.originalCap[k]; for (var i = 1; i < oc.length; i++) refs.push({ id: "orig-cap-" + k + "-" + i, from: P(oc[i - 1]), to: P(oc[i]), cls: "past" }); });
      dim("rise", m.rise.spBefore, m.rise.top, "v", m.rise.top.x, "상승 " + f2(m.rise.cm), { dx: 5, dy: 3 }, "start", "dim");
      dim("open-gap", gp[3], gp[2], "h", hemY + 2.2, "∅ " + f2(foJ.spread) + " (좌우 ∅/2 " + f2(foJ.spread / 2) + ")", { dx: 0, dy: 11 }, "middle", "dim");
      rows([title, "커프스 달림 ● = 손바닥 " + f2(m.cuff.palmCm) + " + 3 = " + f2(m.cuff.lengthCm) + " · 폭 " + f2(m.cuff.widthCm) + " (치수 정보 — 커프스 조각 없음)",
        "■ = Ⓐ 소맷부리 " + f2(m.widthCm) + " − ● = " + f2(foJ.square) + " · ∅ = 0.7● − ■ = " + f2(foJ.spread) + " · 중심선에서 좌우 ∅/2 평행 이동(회전 없음 · O·SP 는 갈라짐)",
        "소맷부리(직선 — 평행 벌림 그대로) " + f2(hj.lengthCm) + " = 1.7● · 개더 " + f2(hj.gatherCm) + " · 도해의 물결 = 개더 표시(재단선 아님)",
        "소매산 상승 " + f2(m.rise.cm) + " (설정값 — 개더 계수 0.7 과 별개) · 틈 위 국소 재제도 양쪽 " + f2(m.redraw.ellCm) + " cm(잠정) · 점선 = 원래 소매산",
        ca ? "Ⓐ 소매산 " + f2(ca.total) + " · Ⓐ 실측 이세 " + sg(ca.total - AH.front - AH.back) + " + 추가 개더 " + sg(prim.lengths.total - ca.total) + " = 최종 − AH " + sg(eb + ef) + " (이세+개더 총량)" : lengthsLine,
        (paperJ.length ? "녹색 = 원래 종이 2조각(평행 이동만) · 음영 = 덧댄 종이(틈 + 소매산 정리) · " : "점선·음영 = 설명용(재단선 아님) · ") + "남색 실선 = 최종 재단선"]);
      zones = paperJ.concat(zones);
    } else if (key === "I") {
      var fi = m.flare, hi2 = m.hem, he2 = m.hemPoints, consI = g.construction || [], cR = function (r) { return consI.filter(function (c) { return c.role === r; })[0]; };
      title = "소매 Ⓘ · 퍼프(소매산 기준점 절개 3개 · 소맷부리 개더, P.44) — 화면 검토용 시안";
      // 원래 종이 4조각(엔진 meta.rigid.pieces 그대로 — 표시 전용) · 틈 3개(덧댄 종이) · 남색 = 최종 재단선
      var showPcI = !opts || opts.pieces !== false, paperI = [];
      if (showPcI && m.rigid && m.rigid.pieces) ["backOuter", "backCenter", "frontCenter", "frontOuter"].forEach(function (k) { paperI.push({ id: "paper-" + k, pts: m.rigid.pieces[k].map(P), cls: "paper" }); });
      var cb = cR("cut-center-back"), cf = cR("cut-center-front"), ab = cR("cut-axis-back"), eb2 = cR("cut-edge-back"), af = cR("cut-axis-front"), ef2 = cR("cut-edge-front");
      if (cb && cf) zones.push({ id: "wedge-center", pts: [P(cb.from), P(cb.to), P(cf.to)], cls: "zone" });
      if (ab && eb2) zones.push({ id: "wedge-back", pts: [P(ab.from), P(ab.to), P(eb2.to)], cls: "zone" });
      if (af && ef2) zones.push({ id: "wedge-front", pts: [P(af.from), P(af.to), P(ef2.to)], cls: "zone" });
      dim("open-back", he2.backInner, he2.backCenterOuter, "h", hemY + 2.2, "∅/3 " + f2(fi.openedCm.back), { dx: 0, dy: 11 }, "middle", "dim");
      dim("open-center", he2.backCenterMid, he2.frontCenterMid, "h", hemY + 2.2, "∅/3 " + f2(fi.openedCm.center), { dx: 0, dy: 11 }, "middle", "dim");
      dim("open-front", he2.frontCenterOuter, he2.frontInner, "h", hemY + 2.2, "∅/3 " + f2(fi.openedCm.front), { dx: 0, dy: 11 }, "middle", "dim");
      marks.push({ id: "pivot-sp", at: P(m.pivots.sp), cls: "notch" });
      add("pivot-sp", m.pivots.sp, 0, -8, "middle", "SP 기준(가운데 대칭 ±" + f2(m.rotationDeg.center) + "°)", "ref", "pivot-sp");
      [["back", m.pivots.back, -5, "end"], ["front", m.pivots.front, 5, "start"]].forEach(function (a2) {
        marks.push({ id: "pivot-" + a2[0], at: P(a2[1]), cls: "notch" });
        add("pivot-" + a2[0], a2[1], a2[2], 14, a2[3], "기준점(" + (a2[0] === "back" ? "뒤" : "앞") + ") +" + f2(m.rotationDeg[a2[0] + "OuterRelative"]) + "°", "ref", "axis-" + a2[0]);
      });
      rows([title, "커프스 달림 ● = 손바닥 " + f2(m.cuff.palmCm) + " + 3 = " + f2(m.cuff.lengthCm) + " · 폭 " + f2(m.cuff.widthCm) + " (치수 정보 — 커프스 조각 없음)",
        "■ = Ⓐ 소맷부리 " + f2(m.widthCm) + " − ● = " + f2(m.formula.square) + " · ∅ = ● − ■ = " + f2(m.formula.spread) + " · 틈마다 " + f2(m.formula.perCut) + " · O 는 중심선 절개로 갈라짐(기준 = SP)",
        "소맷부리(최종 곡선 실측) " + f2(hi2.lengthCm) + " · 여유 산식 2● " + f2(hi2.formulaHemCm) + " · 개더 " + f2(hi2.gatherCm) + " · truing 파임 최대 " + hi2.fair.maxCutCm.toFixed(2) + " · 덧댐 최대 " + hi2.fair.maxOutwardCm.toFixed(2),
        lengthsLine + " · 소매산 꺾임 3곳 재제도(잠정 ℓ)",
        (paperI.length ? "녹색 = 원래 종이 4조각(아래변 = 원래 밑단) · 음영 = 벌어진 틈(덧댄 종이) · " : "점선·음영 = 설명용(재단선 아님) · ") + "남색 실선 = 최종 재단선"]);
      zones = paperI.concat(zones);
    } else if (key === "G") {
      var tg = m.tuck, TG = tg.tucks, SB = m.sides.back, SF2 = m.sides.front;
      title = "소매 Ⓖ · 턱 소매(소매산 높이 2등분 위 a·b 절개, P.43)";
      dim("star", m.star.from, m.star.to, "v", m.star.from.x, "★ " + f2(m.star.cm), { dx: 5, dy: 3 }, "start", "dim");
      ["back", "front"].forEach(function (sid) {
        var sd = m.sides[sid], isB = sid === "back";
        zones.push({ id: "fill-" + sid, pts: m.fill[sid].pts.map(P), cls: "zone" });
        marks.push({ id: "star-" + sid, at: P(sd.star), cls: "notch" });
        add("star-" + sid, sd.star, isB ? -6 : 6, 12, isB ? "end" : "start", "☆ 기준점(바깥 회전 " + f2(Math.abs(sd.betaDeg)) + "°)", "ref", "star-" + sid);
        ["a", "b"].forEach(function (ln) {
          var t = TG[sid + "-" + ln];
          var along = function (from, d) { var L0 = dist(from, t.apex); return { x: from.x + (t.apex.x - from.x) * d / L0, y: from.y + (t.apex.y - from.y) * d / L0 }; };
          [0.9, 1.5].forEach(function (d, i) { refs.push({ id: "tuck-mark-" + sid + ln + "-" + i, from: along(t.fold, d), to: along(t.place, d + 0.6), cls: "tick" }); });
          add("tuck-" + sid + "-" + ln, t.mid, isB ? -3 : 3, -10, isB ? "end" : "start", ln + " 턱 " + f2(t.openedCm), "label", "tuck-" + sid + "-" + ln);
        });
        var ue = sd.underarmExtension;
        refs.push({ id: "ext-" + sid, from: P(ue.from), to: P(ue.to), cls: "tick" });
        marks.push({ id: "ext-" + sid, at: P(ue.to), cls: "notch" });
        add("ext-" + sid, ue.to, isB ? -6 : 6, -8, isB ? "end" : "start", "진동밑 연장 " + f2(ue.cm) + "(시안)", "label", "ext-" + sid);
        add("step-" + sid, TG[sid + "-b"].fold, isB ? -6 : 6, 14, isB ? "end" : "start", "b 접을 때 단차 " + f2(Math.abs(sd.bLegs.stepCm)) + " → 재제도로 정리", "ref", "step-" + sid);
      });
      add("fill-note", { x: 0, y: m.halfLineY }, 0, 14, "middle", "음영 = 벌어진 틈(종이 덧댐) · 사선 = 턱 표시", "ref", "open-note");
      var lcg = prim.cutLengths;
      rows([title, "턱 각 " + f2(tg.perTuckCm) + " × 4 · ★ 가운데 상승 " + f2(m.star.cm) + " (독립 설정값) · 2등분 선 위만 절개",
        "소매산 높이 " + f2(m.capHeightBeforeCm) + " → " + f2(m.capHeightAfterCm) + " · 진동밑~b 위끝 턱 접은 상태 재제도 · 소맷부리 " + f2(m.hemCm) + "(그대로)",
        "진동밑 연장(시안) 뒤 " + f2(SB.underarmExtension.cm) + " · 앞 " + f2(SF2.underarmExtension.cm) + " → 소매폭 " + f2(m.widthCm) + " → " + f2(m.widthAfterCm) + " · 옆선 뒤 " + f2(m.seams.backCm) + " / 앞 " + f2(m.seams.frontCm),
        "턱 방향: 바깥쪽으로 접음 · 소매 중심 쪽 천이 위 · 박기 끝 미확정",
        lengthsLine + " (턱 접은 길이)", "재단선 소매산(펼침) 총 " + f2(lcg.total) + " · Ⓐ 소매산 " + f2(m.capLengthsA.total),
        "점선·음영·사선 = 설명용(재단선 아님) · 남색 실선 = 재단 외곽"]);
    } else if (key === "F") {
      var tf = m.tuck, TK = tf.tucks, hpF = m.hem.points;
      title = "소매 Ⓕ · 턱 소매(평행 절개 4개 · 소맷부리 기준점, P.43)";
      dim("hem", hpF[5], hpF[0], "h", hemY + 2.2, "소맷부리(곡선) " + f2(m.hemCm) + " · Ⓐ 대비 " + (m.hem.diffFromSleeveACm >= 0 ? "+" : "") + m.hem.diffFromSleeveACm.toFixed(4), { dx: 0, dy: 11 }, "middle", "dim");
      ["back-outer", "back-inner", "front-inner", "front-outer"].forEach(function (id) {
        var t = TK[id], isB = id.indexOf("back") === 0;
        zones.push({ id: "tuck-" + id, pts: [P(t.pivot), P(t.place), P(t.fold)], cls: "zone" });
        marks.push({ id: "pivot-" + id, at: P(t.pivot), cls: "notch" });
        // 턱 표시(책 기호): 쐐기 입구 아래 사선 두 줄 — 높은 쪽 = 접는 선(중심 쪽, 위층), 낮은 쪽 = 맞출 선(바깥). 박기 끝 아님(미확정).
        var along = function (from, d) { var L0 = dist(from, t.pivot); return { x: from.x + (t.pivot.x - from.x) * d / L0, y: from.y + (t.pivot.y - from.y) * d / L0 }; };
        [0.9, 1.5].forEach(function (d, i) { refs.push({ id: "tuck-mark-" + id + "-" + i, from: along(t.fold, d), to: along(t.place, d + 0.6), cls: "tick" }); });
        add("tuck-" + id, t.mid, isB ? -3 : 3, -10, isB ? "end" : "start", "턱 " + f2(t.openedCm), "label", "tuck-" + id);
      });
      add("pivot-note", { x: 0, y: hemY }, 0, -6, "middle", "기준점 = 절개선 소맷부리 끝(소맷부리는 벌어지지 않음)", "ref", "pivot-note");
      add("tuck-note", { x: 0, y: (m.sp.y + hemY) / 2 }, 0, 0, "middle", "음영 = 턱 분량(재단 패턴에 포함) · 사선 = 턱 표시", "ref", "open-note");
      var lc = prim.cutLengths;
      rows([title, "턱 각 " + f2(tf.perTuckCm) + " × 4 = " + f2(tf.totalCm) + " · 절개선 중심 ±1·±3cm · 가운데 띠 고정",
        "턱 방향: 바깥쪽으로 접음 · 소매 중심 쪽 천이 위(김님) · 박기 끝 미확정",
        "소매폭 " + f2(m.widthCm) + " → " + f2(m.widthAfterCm) + " · 소맷부리(자연 곡선) " + f2(m.hemCm) + " · 소매산 높이 그대로 · 옆선 앞 " + f2(m.seams.frontCm) + " / 뒤 " + f2(m.seams.backCm),
        lengthsLine + " (턱 접은 길이)", "재단선 소매산(펼침) 총 " + f2(lc.total) + " · 쐐기 위 산 모양 = 턱 접은 상태 소매산을 펼친 선",
        "점선·음영·사선 = 설명용(재단선 아님) · 남색 실선 = 재단 외곽"]);
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
  function boxOf(x, y, anchor, text, f) { var w = textW(text, f), x0 = anchor === "end" ? x - w : anchor === "middle" ? x - w / 2 : x; return { x0: x0, x1: x0 + w, y0: y - f * 0.85 - 1, y1: y + f * 0.2 + 1 }; }   // 세로 ±1px = 실제 글자 상자와의 차(2026-10-26 Ⓝ·Ⓞ 1~2px 겹침 정리, 표시 전용)
  function hit(a, b) { return a.x0 < b.x1 - 0.5 && b.x0 < a.x1 - 0.5 && a.y0 < b.y1 - 0.5 && b.y0 < a.y1 - 0.5; }
  var PRIO = { len: 0, "hem": 0, "hem-back": 0, "hem-center": 0, "hem-front": 0, el: 1, apex: 1, "dart-width": 1, back: 2, front: 2, "leg-outer": 2, "leg-center": 2, lap: 2, ext: 2, "cap-back": 3, "cap-front": 3, sp: 4, bicep: 4, "axis-back": 5, "axis-front": 5, "axis-lower": 5, "open-note": 6, "open-back": 0, "open-front": 0, "open-center": 0, "pivot-sp": 4, "tuck-back-outer": 1, "tuck-back-inner": 1, "tuck-front-inner": 1, "tuck-front-outer": 1, "pivot-note": 6, star: 0, "tuck-back-a": 1, "tuck-back-b": 1, "tuck-front-a": 1, "tuck-front-b": 1, "star-back": 3, "star-front": 3, "step-back": 4, "step-front": 4, "ext-back": 1, "ext-front": 1, drop: 0, "open-a": 0, "open-b-back": 0, "open-b-front": 0, "back-line": 6, "front-line": 6 };
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
    var above = !!model.blockAbove, baseY = above ? bb.minY * s : bb.maxY * s, bottom = placed.reduce(function (m, b) { return Math.max(m, b.y1); }, baseY);
    var top = Math.max(36, bottom - baseY + 16), bl = model.lines.filter(function (l) { return l.block !== undefined; }).sort(function (a, b) { return a.block - b.block; });
    var blocks = [], row = 0;
    var bx = num(model.blockX) ? model.blockX : 0;   // 설명 블록 가로 기준(기본 = 소매 중심선 x 0, 참고 도안 = 그 도안 중심)
    var nBl = model.lines.filter(function (l) { return l.block !== undefined; }).length;
    var addRow = function (id, text, cls) {   // blockAbove: 도안 위에 제목부터 아래로 쌓아 마지막 줄이 도안 위끝 16px 위
      if (above) blocks.push({ id: id, at: { x: bx, y: bb.minY }, dx: 0, dy: -16 - (nBl - 1 - row) * 12, anchor: "middle", text: text, cls: cls });
      else blocks.push({ id: id, at: { x: bx, y: bb.maxY }, dx: 0, dy: top + row * 12, anchor: "middle", text: text, cls: cls });
      row++;
    };
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
  // ── Ⓗ «벌리기 전 절개 도안(참고)» (김님 2026-10-11, 표시 전용) ──
  //   현재 몸판·입력(소매길이·EL)으로 출발 Ⓐ 를 읽기 전용으로 다시 제도해(sleeveAApply.draft — 상태 변경 없음) 완성 Ⓗ 오른쪽에 따로 그린다.
  //   EL · 중심 a · 앞뒤 반폭 중점 b · ☆(EL × 옆선) · 벌림 순서를 표시. geometry·계측·hash·완료본·hit 와 무관(소매 피스 그룹의 설명 오버레이로만).
  //   가로 위치는 화면 배율에 따라 완성 Ⓗ 의 설명 글자 오른쪽 끝(px) 밖으로 띄운다(글자·도안 겹침 방지). Ⓗ 가 아니거나 차단 중이면 null.
  var REF_GAP_PX = 28;
  function REF_ROWS(pr, m, kind) {
    if (kind === "Q") return ["잘라내기 전 도안(참고) — 출발 Ⓐ · 현재 입력",
      "소매산 높이 비율 " + pr.heightRatio + " — 위팔선에서 위로 H × 비율 높이의 수평선(점선)",
      "→ 그 위 소매산만 남기고 수평선 아래는 잘라냄 · 소맷부리 = 직선",
      "회색 점선 = 참고 도안(재단선 아님) · 완성 Ⓠ 는 왼쪽 남색 실선"];
    if (kind === "P") return ["벌리기 전 절개 도안(참고) — 출발 Ⓐ · 현재 입력",
      "소매길이 " + f2(pr.sleeveLengthCm) + " · 플레어 계수 " + pr.flareRatio + " (∅ = 소매 폭 × 계수 · ⊠ = ∅/10)",
      "① 가운데 두 조각을 SP 기준 좌우로(현 4⊠ " + f2(m.flare.centerCm) + ") → ② 중간 조각을 운반된 안쪽 기준점에서(2⊠ " + f2(m.flare.innerCm) + ")",
      "→ ③ 바깥 조각을 운반된 바깥 기준점에서(⊠ " + f2(m.flare.outerCm) + ") · 소맷부리만 벌림 · O 는 갈라짐",
      "회색 점선 = 참고 도안(재단선 아님) · 완성 Ⓟ 는 왼쪽 남색 실선"];
    if (kind === "O") return ["벌리기 전 절개 도안(참고) — 출발 Ⓐ · 현재 입력",
      "소매길이 " + f2(pr.sleeveLengthCm) + " · 안쪽 절개 중심에서 ±" + f2(pr.innerOffsetCm) + "(가운데 띠 " + f2(2 * pr.innerOffsetCm) + ") · 간격 " + f2(pr.cutSpacingCm) + " · 틈마다 " + f2(pr.spreadCm) + " · 박기 끝 " + f2(pr.stitchEndCm),
      "① 중심선은 자르지 않음 · 가운데 띠 고정 → ② 안쪽 띠를 좌우로 " + f2(pr.spreadCm) + " · 바깥 조각을 " + f2(2 * pr.spreadCm) + " 평행 이동(회전 없음)",
      "→ 틈 4곳 = 턱(소매산·소맷부리 모두 바깥쪽으로 접음)",
      "회색 점선 = 참고 도안(재단선 아님) · 완성 Ⓞ 는 왼쪽 남색 실선"];
    if (kind === "N") return ["벌리기 전 절개 도안(참고) — 출발 Ⓐ · 현재 입력",
      "소매길이 " + f2(pr.sleeveLengthCm) + " · 절개 중심선 좌우 각 " + f2(pr.cutOffsetCm) + " · 벌림 가운데 " + f2(pr.centerTuckCm) + " · 양옆 " + f2(pr.sideTuckCm) + " · 박기 끝 " + f2(pr.stitchEndCm),
      "① 가운데 두 조각을 SP 기준 좌우로(소맷부리 현 " + f2(m.spread.openedCm.center) + ") → ② 바깥 두 조각을 함께 움직인 기준점(절개선 × 소매산)에서(현 " + f2(m.spread.openedCm.back) + " · " + f2(m.spread.openedCm.front) + ")",
      "→ 소맷부리 틈 = 턱(중심 쪽으로 접음 · 박기 끝까지 박음) · 커프스 없음",
      "회색 점선 = 참고 도안(재단선 아님) · 완성 Ⓝ 은 왼쪽 남색 실선"];
    if (kind === "M") return ["벌리기 전 절개 도안(참고) — 출발 Ⓐ · 현재 입력",
      "소매길이 " + f2(pr.sleeveLengthCm) + " · 위팔 둘레 " + f2(pr.upperArmCm) + " · 소매산 상승 " + f2(pr.riseCm),
      "① 중심선을 잘라 두 반쪽을 좌우 2⊠ " + f2(m.formula.parallelEachSideCm) + " 평행 이동 → ② 중간 조각을 안쪽 기준점에서(틈 2⊠ " + f2(m.flare.innerCm) + ")",
      "→ ③ 바깥 조각을 함께 움직인 바깥 기준점에서(틈 ⊠ " + f2(m.flare.outerCm) + ") · 틈 가운데 꼭대기를 상승만큼 올려 소매산을 잇는다",
      "회색 점선 = 참고 도안(재단선 아님) · 완성 Ⓜ 는 왼쪽 남색 실선"];
    if (kind === "L") return ["벌리기 전 절개 도안(참고) — 출발 Ⓐ · 현재 입력",
      "소매길이 " + f2(pr.sleeveLengthCm) + " · 위팔 둘레 " + f2(pr.upperArmCm),
      "① 가운데 두 조각을 SP 기준 좌우로(전체 틈 2⊠ " + f2(m.flare.centerCm) + ") → ② 바깥 두 조각을 함께 움직인 기준점(절개선 × 소매산)에서(틈 ⊠ " + f2(m.flare.sideCm) + ")",
      "→ 소맷부리만 벌림 · 중심선이 잘려 O 는 갈라짐",
      "회색 점선 = 참고 도안(재단선 아님) · 완성 Ⓛ 는 왼쪽 남색 실선"];
    if (kind === "K") return ["벌리기 전 절개 도안(참고) — 출발 Ⓐ · 현재 입력",
      "소매길이 " + f2(pr.sleeveLengthCm) + " · 손바닥 " + f2(pr.palmCircumferenceCm) + " · 소매산 상승 " + f2(pr.riseCm),
      "① 중심선을 잘라 두 반쪽을 좌우 ∅/6 " + f2(m.formula.parallelEachSideCm) + " 씩 평행 이동 → ② 각 반쪽의 바깥 조각만 기준점(절개선 × 소매산)에서 회전",
      "→ 소맷부리에서 틈마다 ∅/3 " + f2(m.formula.perCut) + " · 틈 가운데 꼭대기를 상승만큼 올려 소매산을 잇는다",
      "회색 점선 = 참고 도안(재단선 아님) · 완성 Ⓚ 는 왼쪽 남색 실선"];
    if (kind === "J") return ["벌리기 전 절개 도안(참고) — 출발 Ⓐ · 현재 입력",
      "소매길이 " + f2(pr.sleeveLengthCm) + " · 손바닥 " + f2(pr.palmCircumferenceCm) + " · 소매산 상승 " + f2(pr.riseCm),
      "① 중심선(SP → 소맷부리)을 자른다 → ② 두 반쪽을 좌우 ∅/2 " + f2(m.formula.spread / 2) + " 씩 평행 이동(회전 없음)",
      "→ ③ 틈 가운데 꼭대기를 상승만큼 올려 소매산을 잇는다 · 소맷부리는 직선",
      "회색 점선 = 참고 도안(재단선 아님) · 완성 Ⓙ 는 왼쪽 남색 실선"];
    if (kind === "I") return ["벌리기 전 절개 도안(참고) — 출발 Ⓐ · 현재 입력",
      "소매길이 " + f2(pr.sleeveLengthCm) + " · 손바닥 " + f2(pr.palmCircumferenceCm),
      "① 가운데 두 조각을 SP 기준 좌우로 → ② 바깥 두 조각을 함께 움직인 기준점(절개선 × 소매산)에서",
      "→ 소맷부리에서 틈마다 ∅/3 " + f2(m.formula.perCut) + " · 중심선이 잘려 O 는 갈라짐",
      "회색 점선 = 참고 도안(재단선 아님) · 완성 Ⓘ 는 왼쪽 남색 실선"];
    return ["벌리기 전 절개 도안(참고) — 출발 Ⓐ · 현재 입력",
      "소매길이 " + f2(pr.sleeveLengthCm) + " · EL " + f2(pr.elbowLengthCm) + " · 손바닥 " + f2(pr.palmCircumferenceCm) + " · ★ " + f2(pr.dropCm),
      "① 가운데 두 조각 ★ " + f2(m.drop.cm) + " 아래로 → ② a 를 중심선 위 기준점에서 벌림(∅/3 " + f2(m.formula.perCut) + ")",
      "→ ③ 바깥 두 조각을 ☆ 에서 돌려 b 벌림(∅/3) · EL 위는 고정",
      "회색 점선 = 참고 도안(재단선 아님) · 완성 Ⓗ 는 왼쪽 남색 실선"];
  }
  function refModel(project, scale, opts) {
    var w = project && project.working, kind = w && w.sleeveQ ? "Q" : w && w.sleeveP ? "P" : w && w.sleeveO ? "O" : w && w.sleeveN ? "N" : w && w.sleeveM ? "M" : w && w.sleeveL ? "L" : w && w.sleeveK ? "K" : w && w.sleeveJ ? "J" : w && w.sleeveI ? "I" : "H", st = w && (w.sleeveQ || w.sleeveP || w.sleeveO || w.sleeveN || w.sleeveM || w.sleeveL || w.sleeveK || w.sleeveJ || w.sleeveI || w.sleeveH), g = w && w.geometry && w.geometry.sleeve, SAA = window.sleeveAApply;
    if (!st || st.blocked || !g || !SAA || !(scale > 0)) return null;
    var pr = st.parameters, m = st.meta, a = SAA.draft(project, kind === "Q" ? (window.sleeveQApply && window.sleeveQApply.SOURCE_A_LENGTH) : pr.sleeveLengthCm);
    if (!a || !a.ok) return null;
    var ag = a.geometry, sp = a.meta.sp, capS = ag.outline[0], cs = [], cur = capS.commands[0].points[0];
    capS.commands.slice(1).forEach(function (c) { cs.push([cur, c.points[0], c.points[1], c.points[2]]); cur = c.points[2]; });
    var Ub = cs[0][0], Uf = cs[cs.length - 1][3], hemY = a.meta.sleeveLengthCm, yEl = kind === "H" ? sp.y + pr.elbowLengthCm : null;
    // 완성 Ⓗ 의 오른쪽 끝(형상 + 설명 글자 px)
    var hx = []; g.outline.forEach(function (sg) { ctrl(sg).forEach(function (q) { hx.push(q.x); }); });
    var rightAbsPx = Math.max.apply(null, hx) * scale;   // 완성 Ⓗ 오른쪽 끝(화면 px, 소매 좌표 기준)
    // 참고 도안의 세로 띠(설명 블록은 도안 위 — blockAbove): 그 띠와 겹치는 완성 Ⓗ 글자만 비켜 간다(Ⓗ 설명 블록은 Ⓗ 소맷부리 아래라 겹치지 않음)
    var nRows = REF_ROWS(pr, m, kind).length, bandTop = sp.y * scale - (18 + nRows * 12), bandBot = hemY * scale + 14;
    if (!opts || opts.mainVisible !== false) {
      var mm = buildModel(project);
      if (mm) layout(mm, scale).items.forEach(function (it) {
        var f = fsOf(it.cls), w = textW(it.text, f), x = it.at.x * scale + it.dx, y = it.at.y * scale + it.dy, x0 = it.anchor === "end" ? x - w : it.anchor === "middle" ? x - w / 2 : x;
        if (y + f * 0.2 >= bandTop && y - f * 0.85 <= bandBot) rightAbsPx = Math.max(rightAbsPx, x0 + w);
      });
    }
    var rowsW = REF_ROWS(pr, m, kind).map(function (t, i) { return textW(t, fsOf(i === 0 ? "title" : "label")); }), halfW = Math.max.apply(null, rowsW) / 2;
    var cA = (Ub.x + Uf.x) / 2;
    var dx = Math.max((rightAbsPx + REF_GAP_PX) / scale - Ub.x, (rightAbsPx + REF_GAP_PX + halfW) / scale - cA);
    var T = function (p) { return { x: p.x + dx, y: p.y }; };
    var refs = [], lines = [], marks = [];
    var add = function (id, at, ddx, ddy, anchor, text, cls, group) { lines.push({ id: id, at: T(at), px: { dx: ddx, dy: ddy }, anchor: anchor, text: text, cls: cls || "label", group: group || id }); };
    // 출발 Ⓐ 외곽(참고 = 회색 점선)
    var pts = []; cs.forEach(function (q, i) { for (var k = (i ? 1 : 0); k <= 24; k++) pts.push(cubicAt(q, k / 24)); });
    pts.push({ x: Uf.x, y: hemY }, { x: Ub.x, y: hemY }, cp0(Ub));
    for (var i = 1; i < pts.length; i++) refs.push({ id: "ref-outline-" + i, from: T(pts[i - 1]), to: T(pts[i]), cls: "past" });
    var X0 = sp.x, xb = (Ub.x + X0) / 2, xf = (Uf.x + X0) / 2;
    if (kind === "J") {   // Ⓙ: 중심선 절개 하나 — 좌우 평행 이동
      refs.push({ id: "ref-cut-center", from: T(sp), to: T({ x: X0, y: hemY }), cls: "tick" });
      marks.push({ id: "ref-sp", at: T(sp), cls: "notch" });
      add("ref-cut-center", { x: X0, y: (sp.y + hemY) / 2 }, 0, 0, "middle", "← ∅/2 · 중심선 · ∅/2 →", "label");
      add("ref-sp", sp, 6, -4, "start", "SP", "label");
    } else if (kind === "Q") {   // Ⓠ: 위팔선 위 H × 비율 높이의 수평선
      var bY = Ub.y, yQ = bY - (bY - sp.y) * pr.heightRatio;
      refs.push({ id: "ref-ratio", from: T({ x: Ub.x, y: yQ }), to: T({ x: Uf.x, y: yQ }), cls: "tick" });
      add("ref-ratio", { x: Uf.x, y: yQ }, 6, -4, "start", "H × " + pr.heightRatio, "label");
      refs.push({ id: "ref-center", from: T(sp), to: T({ x: X0, y: hemY }), cls: "past" });
    } else if (kind === "M" || kind === "P") {   // Ⓜ·Ⓟ: 절개 5개 — 중심선(Ⓜ 평행 · Ⓟ SP 쐐기) + 앞·뒤 반폭 3등분 선 2개씩(위 화살표 = 소매산 기준점)
      var capYm = function (x) { var best = pts[0]; pts.forEach(function (q) { if (Math.abs(q.x - x) < Math.abs(best.x - x)) best = q; }); return best.y; };
      [["back-outer", X0 + 2 * (Ub.x - X0) / 3], ["back-inner", X0 + (Ub.x - X0) / 3], ["center", X0], ["front-inner", X0 + (Uf.x - X0) / 3], ["front-outer", X0 + 2 * (Uf.x - X0) / 3]].forEach(function (e) {
        var top = { x: e[1], y: e[0] === "center" ? sp.y : capYm(e[1]) }, back = e[0].indexOf("back") === 0;
        refs.push({ id: "ref-cut-" + e[0], from: T(top), to: T({ x: e[1], y: hemY }), cls: "tick" });
        marks.push({ id: "ref-pivot-" + e[0], at: T(top), cls: "notch" });
        add("ref-cut-" + e[0], { x: e[1], y: (top.y + hemY) / 2 }, back ? -4 : 4, 0, back ? "end" : "start", e[0] === "center" ? (kind === "P" ? "중심선(SP 쐐기)" : "중심선(평행)") : "절개", "label");
        if (e[0] !== "center") add("ref-pivot-" + e[0], top, back ? -6 : 6, -4, back ? "end" : "start", "기준점", "label");
      });
    } else if (kind === "O") {   // Ⓞ: 평행 절개 4개(중심선은 자르지 않음)
      var capYo = function (x) { var best = pts[0]; pts.forEach(function (q) { if (Math.abs(q.x - x) < Math.abs(best.x - x)) best = q; }); return best.y; };
      [["back-outer", X0 - pr.innerOffsetCm - pr.cutSpacingCm], ["back-inner", X0 - pr.innerOffsetCm], ["front-inner", X0 + pr.innerOffsetCm], ["front-outer", X0 + pr.innerOffsetCm + pr.cutSpacingCm]].forEach(function (e) {
        var top = { x: e[1], y: capYo(e[1]) }, back = e[0].indexOf("back") === 0;
        refs.push({ id: "ref-cut-" + e[0], from: T(top), to: T({ x: e[1], y: hemY }), cls: "tick" });
        add("ref-cut-" + e[0], { x: e[1], y: (top.y + hemY) / 2 }, back ? -4 : 4, 0, back ? "end" : "start", "절개", "label");
      });
      refs.push({ id: "ref-center", from: T(sp), to: T({ x: X0, y: hemY }), cls: "past" });
      add("ref-sp", sp, 6, -4, "start", "SP · 중심선(자르지 않음)", "label");
    } else if (kind === "N") {   // Ⓝ: 절개 3개(중심선 + 좌우 각 절개 위치) — 소맷부리 → 소매산 기준점(위 화살표 = 기준점)
      var capYn = function (x) { var best = pts[0]; pts.forEach(function (q) { if (Math.abs(q.x - x) < Math.abs(best.x - x)) best = q; }); return best.y; };
      [["back", X0 - pr.cutOffsetCm], ["center", X0], ["front", X0 + pr.cutOffsetCm]].forEach(function (e) {
        var top = { x: e[1], y: e[0] === "center" ? sp.y : capYn(e[1]) };
        refs.push({ id: "ref-cut-" + e[0], from: T(top), to: T({ x: e[1], y: hemY }), cls: "tick" });
        marks.push({ id: "ref-pivot-" + e[0], at: T(top), cls: "notch" });
        add("ref-cut-" + e[0], { x: e[1], y: (top.y + hemY) / 2 }, e[0] === "back" ? -4 : 4, 0, e[0] === "back" ? "end" : "start", e[0] === "center" ? "중심선" : "절개", "label");
        add("ref-pivot-" + e[0], top, e[0] === "back" ? -6 : 6, -4, e[0] === "back" ? "end" : "start", e[0] === "center" ? "SP" : "기준점", "label");
      });
    } else if (kind === "I" || kind === "K" || kind === "L") {   // Ⓘ·Ⓚ·Ⓛ: 절개 3개(반폭 중점·중심선) — 소맷부리 → 소매산 기준점(위 화살표 = 기준점)
      var capY = function (x) { var best = pts[0]; pts.forEach(function (q) { if (Math.abs(q.x - x) < Math.abs(best.x - x)) best = q; }); return best.y; };
      [["back", xb], ["center", X0], ["front", xf]].forEach(function (e) {
        var top = { x: e[1], y: e[0] === "center" ? sp.y : capY(e[1]) };
        refs.push({ id: "ref-cut-" + e[0], from: T(top), to: T({ x: e[1], y: hemY }), cls: "tick" });
        marks.push({ id: "ref-pivot-" + e[0], at: T(top), cls: "notch" });
        add("ref-cut-" + e[0], { x: e[1], y: (top.y + hemY) / 2 }, e[0] === "back" ? -4 : 4, 0, e[0] === "back" ? "end" : "start", e[0] === "center" ? "중심선" : "절개", "label");
        add("ref-pivot-" + e[0], top, e[0] === "back" ? -6 : 6, -4, e[0] === "back" ? "end" : "start", e[0] === "center" ? "SP" : "기준점", "label");
      });
    } else {
    // EL · a · b (절개선 = 청록 가는 실선) · ☆
    refs.push({ id: "ref-el", from: T({ x: Ub.x, y: yEl }), to: T({ x: Uf.x, y: yEl }), cls: "tick" });
    refs.push({ id: "ref-a", from: T({ x: X0, y: yEl }), to: T({ x: X0, y: hemY }), cls: "tick" });
    refs.push({ id: "ref-b-back", from: T({ x: xb, y: yEl }), to: T({ x: xb, y: hemY }), cls: "tick" });
    refs.push({ id: "ref-b-front", from: T({ x: xf, y: yEl }), to: T({ x: xf, y: hemY }), cls: "tick" });
    refs.push({ id: "ref-center", from: T(sp), to: T({ x: X0, y: yEl }), cls: "past" });
    marks.push({ id: "ref-star-back", at: T({ x: Ub.x, y: yEl }), cls: "notch" }, { id: "ref-star-front", at: T({ x: Uf.x, y: yEl }), cls: "notch" }, { id: "ref-c", at: T({ x: X0, y: yEl }), cls: "notch" });
    add("ref-el", { x: Uf.x, y: yEl }, 6, -4, "start", "EL " + f2(pr.elbowLengthCm), "label");
    add("ref-star-back", { x: Ub.x, y: yEl }, -6, 4, "end", "☆", "label");
    add("ref-star-front", { x: Uf.x, y: yEl }, 6, 12, "start", "☆", "label");
    add("ref-a", { x: X0, y: (yEl + hemY) / 2 }, 4, 0, "start", "a(중심선)", "label");
    add("ref-b-back", { x: xb, y: (yEl + hemY) / 2 }, -4, 0, "end", "b", "label");
    add("ref-b-front", { x: xf, y: (yEl + hemY) / 2 }, 4, 0, "start", "b", "label");
    }
    var rowsT = REF_ROWS(pr, m, kind), title = rowsT[0];
    rowsT.forEach(function (t, i) { add("ref-block-" + i, { x: (Ub.x + Uf.x) / 2, y: hemY }, 0, 56 + i * 12, "middle", t, i === 0 ? "title" : (i === rowsT.length - 1 ? "note" : "label"), "ref-block"); lines[lines.length - 1].block = i; });
    var bb = { minX: Ub.x + dx, maxX: Uf.x + dx, minY: sp.y, maxY: hemY };
    return { key: "sleeveRef", line: kind + "-ref", title: title, lines: lines, dims: [], leaders: [], zones: [], refs: refs, marks: marks, bbox: bb, offsetCm: dx, blockX: (Ub.x + Uf.x) / 2 + dx, blockAbove: true };
  }
  function cp0(p) { return { x: p.x, y: p.y }; }

  // 화면 초기화(fit)가 설명 영역을 포함하도록 — 소매 geometry bbox 바깥으로 나오는 px 여백(위·아래·좌·우). 모델이 없으면 0.
  function overhang(project, scale, opts) {
    var info = !opts || opts.info !== false, ref = !!(opts && opts.ref);
    var m = info ? buildModel(project) : null, o = { top: 0, bottom: 0, left: 0, right: 0 };
    if (m) { var e = layout(m, scale).extent; o = { top: Math.max(0, e.top), bottom: Math.max(0, e.bottom), left: Math.max(0, e.left), right: Math.max(0, e.right) }; }
    var rm = ref ? refModel(project, scale, { mainVisible: info }) : null;
    if (rm) {   // 참고 도안: 소매 bbox 오른쪽 밖(형상 + 글자) · 아래(설명 블록)
      var g = project.working.geometry.sleeve, xs = [], ys = []; g.outline.forEach(function (sg) { ctrl(sg).forEach(function (q) { xs.push(q.x); ys.push(q.y); }); });
      var sMaxX = Math.max.apply(null, xs), sMaxY = Math.max.apply(null, ys), sMinY = Math.min.apply(null, ys), re = layout(rm, scale).extent;
      o.right = Math.max(o.right, (rm.bbox.maxX - sMaxX) * scale + Math.max(0, re.right) + REF_GAP_PX);   // 배율에 따라 위치가 바뀌는 도안이라 fit 반복 수렴 여유
      o.bottom = Math.max(o.bottom, (rm.bbox.maxY - sMaxY) * scale + Math.max(0, re.bottom));
      o.top = Math.max(o.top, (sMinY - rm.bbox.minY) * scale + Math.max(0, re.top));
    }
    if (!m && !rm) return { top: 0, bottom: 0, left: 0, right: 0 };
    return o;
  }

  // 소매 Ⓠ 의 몸판 달림 끝(뒤·앞) — 몸판 보관 좌표의 점과 짧은 글자(표시 전용 · geometry·hash 무관). 위치를 정하지 못한 쪽은 없다(상태는 정보 줄).
  function bodiceMarks(project) {
    var w = project && project.working, st = w && w.sleeveQ; if (!st || st.blocked || !st.meta || !st.meta.attach) return null;
    var at = st.meta.attach, ex = st.meta.excludedArcCm, out = {};
    [["back", "●"], ["front", "∅"]].forEach(function (e) { var a = at[e[0]]; if (a && a.status === "ok") out[e[0]] = { at: P(a.point), text: "소매 달림 끝 · " + e[1] + " " + f2(ex[e[0]]) }; });
    return out;
  }

  window.sleeveAnnotation = Object.freeze({ buildModel: buildModel, layout: layout, overhang: overhang, refModel: refModel, bodiceMarks: bodiceMarks });
})();
