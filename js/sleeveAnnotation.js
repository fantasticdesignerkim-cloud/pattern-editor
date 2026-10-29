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
    if (w.sleeveU) return { key: "U", st: w.sleeveU };
    if (w.sleeveT) return { key: "T", st: w.sleeveT };
    if (w.sleeveS) return { key: "S", st: w.sleeveS };
    if (w.sleeveR) return { key: "R", st: w.sleeveR };
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
    if (L.key === "R") return buildModelR(project, L.st);
    if (L.key === "S") return buildModelS(project, L.st);
    if (L.key === "T" || L.key === "U") return buildModelT(project, L.st, L.key);
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


  // ── 소매 Ⓡ 한 장 소매 제작 정보(표시 전용 · 소매 좌표 · 값은 엔진 meta 실측): 뒤/앞 · ◎ 중심 맞댐선(솔기 아님) · 소매산/밑선/소맷부리 ·
  //   X 맞춤 표시(교차점 아래 길이 = 몸판 진동 실측) · 소매 폭 · 중심 길이 · 커프스 달림 / 직선 산식 / 곡선 실측 / 실제 개더 구분.
  function buildModelR(project, st) {
    var w = project.working, g = w.geometry && w.geometry.sleeve, m = st && st.meta;
    if (!g || !Array.isArray(g.outline) || !m || st.blocked) return null;
    var lines = [], dims = [], leaders = [], refs = [], marks = [];
    var add = function (id, at, dx, dy, anchor, text, cls, group) { lines.push({ id: id, at: P(at), px: { dx: dx, dy: dy }, anchor: anchor, text: text, cls: cls || "label", group: group || id }); };
    var dim = function (id, a, b, axis, at, text, px, anchor) { dims.push({ id: id, from: P(a), to: P(b), axis: axis, at: at, text: text, px: px || { dx: 0, dy: 11 }, anchor: anchor || "middle", cls: "dim" }); };
    var b = m.back.sleevePoints, f = m.front.sleevePoints, mb = m.back.match.sleeve, mf = m.front.match.sleeve, L0 = m.sleeveLengthCm, cuf = m.cuff;
    var xs = [], ys = []; g.outline.forEach(function (sg) { ctrl(sg).forEach(function (q) { xs.push(q.x); ys.push(q.y); }); });
    var bb = { minX: Math.min.apply(null, xs), maxX: Math.max.apply(null, xs), minY: Math.min.apply(null, ys), maxY: Math.max.apply(null, ys) };
    var mid = function (a, c) { return { x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 }; };
    add("back", { x: (b.U.x + b.C.x) / 4, y: (b.U.y + b.C.y) / 2 }, 0, 0, "middle", "뒤", "side");
    add("front", { x: (f.U.x + f.C.x) / 4, y: (f.U.y + f.C.y) / 2 }, 0, 0, "middle", "앞", "side");
    marks.push({ id: "sp", at: { x: 0, y: 0 }, cls: "sp" });
    add("sp", { x: 0, y: 0 }, 0, -8, "middle", "새 SP · 결(중심)", "edge");
    add("center", { x: 0, y: L0 * 0.62 }, 5, 0, "start", "◎ 앞뒤 중심 맞댐선 — 솔기 아님(한 장)", "ref");
    dim("len", { x: 0, y: 0 }, { x: 0, y: L0 }, "v", 0, "중심 " + f2(L0), { dx: -5, dy: 3 }, "end");
    dim("width", b.U, f.U, "h", b.U.y, "소매 폭 " + f2(m.widthCm) + " (폭선 뒤 " + f2(m.back.widthLineCm) + " · 앞 " + f2(m.front.widthLineCm) + ")", { dx: 0, dy: -5 });
    add("cap-back", mid(b.U, mb.X), 0, -8, "middle", "소매산 뒤 " + f2(m.cap.back), "label");
    add("cap-front", mid(f.U, mf.X), 0, -8, "middle", "소매산 앞 " + f2(m.cap.front), "label");
    add("ua-back", mid(b.U, b.C), -6, 0, "end", "소매 밑선 뒤 " + f2(m.seams.underarm.back), "label");
    add("ua-front", mid(f.U, f.C), 6, 0, "start", "소매 밑선 앞 " + f2(m.seams.underarm.front), "label");
    [["back", b, mb, "‖", m.back], ["front", f, mf, "|", m.front]].forEach(function (e) {   // X 맞춤: 교차점 · 교차점 아래 소매산 중점(몸판 진동 같은 자리와 맞춤)
      marks.push({ id: "x-" + e[0], at: P(e[2].X), cls: "notch" }, { id: "xm-" + e[0], at: P(e[2].capMid), cls: "notch" });
      add("x-" + e[0], e[2].X, 0, 14, "middle", "X " + e[3] + " 아래 " + f2(e[4].lower.capLowerCm) + " = 몸판 " + f2(e[4].lower.armholeLowerCm), "dim");
      add("xm-" + e[0], e[2].capMid, 0, -5, "middle", e[3], "dim");
    });
    add("hem", { x: 0, y: L0 }, 0, 14, "middle", "소맷부리(개더 → 커프스)", "edge");
    add("guide-back", mid(b.E, b.P), 0, -5, "middle", "직선 기준 ● " + f2(cuf.attachCm) + " ⟂", "dim");   // 소맷부리 기준선 E→P(청록 점선) — 최종 곡선은 그 아래 C 까지
    add("guide-front", mid(f.E, f.P), 0, -5, "middle", "직선 기준 ● " + f2(cuf.attachCm) + " ⟂", "dim");
    var title = "돌먼 Ⓡ 한 장 소매(시안) — 몸판 Ⓐ 위에서 제도한 앞·뒤 반쪽을 중심선에서 맞댐";
    var body = [title,
      "커프스 달림 ● " + f2(cuf.attachCm) + " (팔꿈치 " + f2(m.settings.inputs.elbowGirthCm) + " + " + f2(m.settings.inputs.cuffAddCm) + ") · 직선 산식 2● " + f2(cuf.formulaHemCm),
      "소맷부리 곡선 실측 " + f2(cuf.measuredHemCm) + " · 실제 개더 " + f2(cuf.gatherActualCm) + " (= 실측 − 달림 · 책 참고 ●×1 " + f2(cuf.gatherReferenceCm) + ")",
      "소매산 " + f2(m.cap.total) + " / 몸판 진동 " + f2(m.armhole.total) + " · 결과 이세 " + sg(m.ease.total) + " (0 으로 맞추지 않음) · 밑선 차 " + sg(m.seams.underarm.diffCm),
      "남색 실선 = 재단선 · 청록 점선 = 기준선(재단선 아님) · ‖ | = 몸판과 맞춤"];
    body.forEach(function (t, i) { add("block-" + i, { x: 0, y: bb.maxY }, 0, 56 + i * 12, "middle", t, i === 0 ? "title" : (i === body.length - 1 ? "note" : "label"), "block"); lines[lines.length - 1].block = i; });
    (g.construction || []).forEach(function (c) { bb.minX = Math.min(bb.minX, c.from.x, c.to.x); bb.maxX = Math.max(bb.maxX, c.from.x, c.to.x); bb.maxY = Math.max(bb.maxY, c.from.y, c.to.y); });
    return { key: "sleeve", line: "R", title: title, lines: lines, dims: dims, leaders: leaders, zones: [], refs: refs, marks: marks, bbox: bb };
  }

  // ── 소매 Ⓢ 한 장 소매 제작 정보(표시 전용 · 소매 좌표 · 값은 엔진 meta): 원래 Ⓡ 종이 두 장(초록 — 평행 이동) · 새 중앙 개더 띠(노랑) · 옛 중심선 ◎ 두 개 ·
  //   총 벌림 G · 띠 바깥 소매산 개더 범위 각(호 길이 끝 표시) · 앞/뒤 · 소매산/밑선/소맷부리 · X 맞춤 · 커프스 달림 / 직선 산식 / 곡선 실측 / 실제 개더.
  function buildModelS(project, st) {
    var w = project.working, g = w.geometry && w.geometry.sleeve, m = st && st.meta;
    if (!g || !Array.isArray(g.outline) || !m || st.blocked) return null;
    var lines = [], dims = [], leaders = [], refs = [], marks = [], zones = [];
    var add = function (id, at, dx, dy, anchor, text, cls, group) { lines.push({ id: id, at: P(at), px: { dx: dx, dy: dy }, anchor: anchor, text: text, cls: cls || "label", group: group || id }); };
    var dim = function (id, a, b, axis, at, text, px, anchor) { dims.push({ id: id, from: P(a), to: P(b), axis: axis, at: at, text: text, px: px || { dx: 0, dy: 11 }, anchor: anchor || "middle", cls: "dim" }); };
    var b = m.back.sleevePoints, f = m.front.sleevePoints, G = m.spreadCm, h = m.halfShiftCm, L0 = m.sleeveLengthCm, cuf = m.cuff, ga = m.gather.cap;
    var xs = [], ys = []; g.outline.forEach(function (sg) { ctrl(sg).forEach(function (q) { xs.push(q.x); ys.push(q.y); }); });
    var bb = { minX: Math.min.apply(null, xs), maxX: Math.max.apply(null, xs), minY: Math.min.apply(null, ys), maxY: Math.max.apply(null, ys) };
    var mid = function (a, c) { return { x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 }; };
    // 원래 Ⓡ 종이(평행 이동한 두 반쪽)와 새 띠: 외곽 cubic 을 점열로(표시 전용)
    var cubs = function (path) { var o = [], cur = path.commands[0].points[0]; path.commands.slice(1).forEach(function (c) { o.push([cur, c.points[0], c.points[1], c.points[2]]); cur = c.points[2]; }); return o; };
    var flat = function (q) { var o = []; for (var i = 0; i <= 24; i++) o.push(P(cubicAt(q, i / 24))); return o; };
    var capP = g.outline.filter(function (sg) { return sg.role === "cap"; })[0], hemP = g.outline.filter(function (sg) { return sg.role === "hem"; })[0];
    if (G > 0 && capP && hemP) {
      var oc = cubs(capP), oh = cubs(hemP), ocL = oc.length, ohL = oh.length;
      zones.push({ id: "paper-back", pts: flat(oc[0]).concat([{ x: -h, y: L0 }], flat(oh[ohL - 1]).slice(1)), cls: "paper" });
      zones.push({ id: "paper-front", pts: flat(oc[ocL - 1]).concat(flat(oh[0])), cls: "paper" });
      zones.push({ id: "band", pts: m.band.pts.map(P), cls: "band" });
      dim("spread", { x: -h, y: 0 }, { x: h, y: 0 }, "h", -2.2, "G " + f2(G) + " (뒤 −" + f2(h) + " · 앞 +" + f2(h) + " 평행)", { dx: 0, dy: -5 });
      add("band", { x: 0, y: L0 * 0.45 }, 0, 0, "middle", "중앙 개더 띠(새로 덧댄 종이)", "label");
      add("old-back", { x: -h, y: L0 * 0.72 }, -4, 0, "end", "◎ 옛 중심선", "ref");
      add("old-front", { x: h, y: L0 * 0.72 }, 4, 0, "start", "◎ 옛 중심선", "ref");
      add("grain", { x: 0, y: L0 * 0.58 }, 0, 0, "middle", "결(띠 가운데) · 솔기 없음", "ref");
    } else add("center", { x: 0, y: L0 * 0.62 }, 5, 0, "start", "◎ 앞뒤 중심 맞댐선 — 솔기 아님(G = 0)", "ref");
    // 띠 바깥 소매산 개더 범위(호 길이) 끝 표시 + 개더 구간
    marks.push({ id: "g-back", at: P(ga.back), cls: "notch" }, { id: "g-front", at: P(ga.front), cls: "notch" });
    add("g-back", ga.back, -4, -8, "end", "개더 끝 · 띠 밖 " + f2(ga.sideCm), "dim");
    add("g-front", ga.front, 4, -8, "start", "띠 밖 " + f2(ga.sideCm) + " · 개더 끝", "dim");
    add("g-zone", { x: 0, y: 0 }, 0, -26, "middle", "소매산 개더 구간 " + f2(ga.zoneCm) + " = " + f2(ga.sideCm) + " + G " + f2(G) + " + " + f2(ga.sideCm) + " (봉제선 호 길이)", "label");
    add("back", { x: (b.U.x + b.C.x) / 2 * 0.55 - h * 0.45, y: (b.U.y + b.C.y) / 2 }, 0, 0, "middle", "뒤", "side");
    add("front", { x: (f.U.x + f.C.x) / 2 * 0.55 + h * 0.45, y: (f.U.y + f.C.y) / 2 }, 0, 0, "middle", "앞", "side");
    dim("len", { x: 0, y: 0 }, { x: 0, y: L0 }, "v", 0, "중심 " + f2(L0), { dx: -5, dy: 3 }, "end");
    dim("width", b.U, f.U, "h", b.U.y, "소매 폭 " + f2(m.widthCm), { dx: 0, dy: -5 });
    add("cap-back", mid(b.U, m.back.match.X), 0, -8, "middle", "소매산 뒤 " + f2(m.cap.back) + " (Ⓡ " + f2(m.cap.r.back) + " + " + f2(h) + ")", "label");
    add("cap-front", mid(f.U, m.front.match.X), 0, -8, "middle", "소매산 앞 " + f2(m.cap.front) + " (Ⓡ " + f2(m.cap.r.front) + " + " + f2(h) + ")", "label");
    add("ua-back", mid(b.U, b.C), -6, 0, "end", "소매 밑선 뒤 " + f2(m.seams.underarm.back), "label");
    add("ua-front", mid(f.U, f.C), 6, 0, "start", "소매 밑선 앞 " + f2(m.seams.underarm.front), "label");
    [["back", m.back, "‖"], ["front", m.front, "|"]].forEach(function (e) {
      marks.push({ id: "x-" + e[0], at: P(e[1].match.X), cls: "notch" }, { id: "xm-" + e[0], at: P(e[1].match.capMid), cls: "notch" });
      add("x-" + e[0], e[1].match.X, 0, 14, "middle", "X " + e[2] + " 아래 " + f2(e[1].lower.capLowerCm) + " = 몸판 " + f2(e[1].lower.armholeLowerCm), "dim");
      add("xm-" + e[0], e[1].match.capMid, 0, -5, "middle", e[2], "dim");
    });
    add("guide-back", mid(b.E, b.P), 0, -5, "middle", "직선 기준 ● " + f2(cuf.attachCm) + " ⟂", "dim");
    add("guide-front", mid(f.E, f.P), 0, -5, "middle", "직선 기준 ● " + f2(cuf.attachCm) + " ⟂", "dim");
    add("hem", { x: 0, y: L0 }, 0, 14, "middle", "소맷부리 전체 개더(→ 커프스)", "edge");
    var title = "돌먼 Ⓢ 한 장 소매(시안) — Ⓡ 를 중심선에서 나눠 평행으로 벌리고 가운데 개더 띠 G 를 덧댐";
    var body = [title,
      "커프스 달림 ● " + f2(cuf.attachCm) + " (Ⓡ 그대로) · 직선 산식 2● + G = " + f2(cuf.formulaHemCm),
      "소맷부리 곡선 실측 " + f2(cuf.measuredHemCm) + " (Ⓡ " + f2(cuf.rMeasuredHemCm) + " + 띠 " + f2(G) + ") · 실제 개더 " + f2(cuf.gatherActualCm) + " (= 실측 − 달림)",
      "소매산 " + f2(m.cap.total) + " / 몸판 진동 " + f2(m.armhole.total) + " · 결과 차 " + sg(m.ease.total) + " = Ⓡ 기본 이세 " + sg(m.ease.baseRCm) + " + 추가 개더 " + f2(m.ease.addedGatherCm),
      "초록 = 원래 Ⓡ 종이(평행 이동) · 노랑 = 새 중앙 개더 띠 · 남색 실선 = 재단선 · 청록 점선 = 기준선 · ◎ = 옛 중심선(띠 경계, 솔기 아님)"];
    body.forEach(function (t, i) { add("block-" + i, { x: 0, y: bb.maxY }, 0, 56 + i * 12, "middle", t, i === 0 ? "title" : (i === body.length - 1 ? "note" : "label"), "block"); lines[lines.length - 1].block = i; });
    (g.construction || []).forEach(function (c) { bb.minX = Math.min(bb.minX, c.from.x, c.to.x); bb.maxX = Math.max(bb.maxX, c.from.x, c.to.x); bb.maxY = Math.max(bb.maxY, c.from.y, c.to.y); });
    return { key: "sleeve", line: "S", title: title, lines: lines, dims: dims, leaders: leaders, zones: zones, refs: refs, marks: marks, bbox: bb };
  }

  // ── 소매 Ⓣ 한 장 소매 제작 정보(표시 전용 · 소매 좌표 · 값은 엔진 meta 실측): 뒤/앞 · ◎ 중심 맞댐선(솔기 아님) · 소매산 = 몸판 진동 ·
  //   소매 폭선(◉) · 소매 밑 안내선 · 소맷부리(뒤 폭 × 3/4 · ● 잘라 냄 · 앞 = 앞 폭 − ●) · 소매 밑선 · 맞춤 ‖ | (SP 에서 같은 호 길이).
  //   Ⓤ(P.51 «Ⓣ 와 같이»)도 같은 표시 틀 — sym 만 다르고, 출처 구분(책 / Ⓣ 승계 / 시안 관례) 한 줄을 더한다.
  function buildModelT(project, st, sym) {
    sym = sym || "T";
    var w = project.working, g = w.geometry && w.geometry.sleeve, m = st && st.meta;
    if (!g || !Array.isArray(g.outline) || !m || st.blocked) return null;
    var lines = [], dims = [], leaders = [], refs = [], marks = [];
    var add = function (id, at, dx, dy, anchor, text, cls, group) { lines.push({ id: id, at: P(at), px: { dx: dx, dy: dy }, anchor: anchor, text: text, cls: cls || "label", group: group || id }); };
    var dim = function (id, a, b, axis, at, text, px, anchor) { dims.push({ id: id, from: P(a), to: P(b), axis: axis, at: at, text: text, px: px || { dx: 0, dy: 11 }, anchor: anchor || "middle", cls: "dim" }); };
    var b = m.back.sleevePoints, f = m.front.sleevePoints, L0 = m.sleeveLengthCm, cuf = m.cuff, H = m.capHeight.cm;
    var Cb = { x: -cuf.back, y: L0 }, Cf = { x: cuf.front, y: L0 };
    var xs = [], ys = []; g.outline.forEach(function (sg) { ctrl(sg).forEach(function (q) { xs.push(q.x); ys.push(q.y); }); });
    var bb = { minX: Math.min.apply(null, xs), maxX: Math.max.apply(null, xs), minY: Math.min.apply(null, ys), maxY: Math.max.apply(null, ys) };
    var mid = function (a, c) { return { x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 }; };
    add("back", { x: b.U.x * 0.45, y: (H + L0) / 2 }, 0, 0, "middle", "뒤", "side");
    add("front", { x: f.U.x * 0.45, y: (H + L0) / 2 }, 0, 0, "middle", "앞", "side");
    marks.push({ id: "sp", at: { x: 0, y: 0 }, cls: "sp" });
    add("sp", { x: 0, y: 0 }, 0, -8, "middle", "SP · 결(중심)", "edge");
    add("center", { x: 0, y: L0 * 0.7 }, 5, 0, "start", "◎ 앞뒤 중심 맞댐선 — 솔기 아님(한 장)", "ref");
    dim("len", { x: 0, y: 0 }, { x: 0, y: L0 }, "v", 0, "소매길이 " + f2(L0), { dx: -5, dy: 3 }, "end");
    dim("cap-h", { x: 0, y: 0 }, { x: 0, y: H }, "v", 0, "◉ " + f2(H), { dx: 5, dy: 3 }, "start");
    dim("width", b.U, f.U, "h", b.U.y, "소매 폭 " + f2(m.widthCm) + " (뒤 " + f2(m.back.widthCm) + " · 앞 " + f2(m.front.widthCm) + ")", { dx: 0, dy: -5 });
    add("cap-back", { x: b.U.x * 0.55, y: H * 0.35 }, -6, 0, "end", "소매산 뒤 " + f2(m.cap.back) + " = 진동 " + f2(m.armhole.back), "label");
    add("cap-front", { x: f.U.x * 0.55, y: H * 0.35 }, 6, 0, "start", "소매산 앞 " + f2(m.cap.front) + " = 진동 " + f2(m.armhole.front), "label");
    add("ua-back", mid(b.U, Cb), -6, 0, "end", "소매 밑선 뒤 " + f2(m.seams.underarm.back), "label");
    add("ua-front", mid(f.U, Cf), 6, 0, "start", "소매 밑선 앞 " + f2(m.seams.underarm.front), "label");
    dim("cuff-back", Cb, { x: 0, y: L0 }, "h", L0, "뒤 " + f2(cuf.back), { dx: 0, dy: 13 });
    dim("cuff-front", { x: 0, y: L0 }, Cf, "h", L0, "앞 " + f2(cuf.front), { dx: 0, dy: 13 });
    add("cut-back", mid(Cb, b.G), 0, -5, "middle", "● " + f2(cuf.cutCm), "dim");
    add("cut-front", mid(Cf, f.G), 0, -5, "middle", "● " + f2(cuf.cutCm), "dim");
    [["back", b, "‖"], ["front", f, "|"]].forEach(function (e) {
      marks.push({ id: "n-" + e[0], at: P(e[1].notch), cls: "notch" });
      add("n-" + e[0], e[1].notch, e[0] === "back" ? -6 : 6, 0, e[0] === "back" ? "end" : "start", e[2] + " SP 에서 " + f2(m.notches[e[0]].sCm), "dim");
    });
    add("hem", { x: 0, y: L0 }, 0, 28, "middle", "소맷부리 " + f2(cuf.totalCm) + " (중심선 직각 직선)", "edge");
    var title = sym === "U" ? "셔츠 슬리브 Ⓤ 한 장 소매(시안) — Ⓣ 와 같이 몸판 Ⓐ 진동에 겹쳐 제도 · 소매산 낮게(× 1/2) · 앞·뒤 반쪽을 중심선에서 맞댐(P.51 · P.157)"
      : "셔츠 슬리브 Ⓣ 한 장 소매(시안) — 몸판 Ⓐ 진동에 겹쳐 제도한 앞·뒤 반쪽을 중심선에서 맞댐(P.50 · P.157)";
    var body = [title,
      "소매산 높이 ◉ " + f2(H) + " = 평균 어깨 길이 " + f2(m.capHeight.averageShoulderCm) + " × " + f2(m.capHeight.ratio) + " · 경사 뒤 8:" + f2(m.settings.inputs.backSlopeDropCm) + " / 앞 8:" + f2(m.settings.inputs.frontSlopeDropCm),
      "소매산 " + f2(m.cap.total) + " = 몸판 진동 " + f2(m.armhole.total) + " (여유분 줄임 없음 · 이세 " + sg(m.ease.total) + ")",
      "소맷부리: 뒤 = 뒤 소매 폭 × " + f2(cuf.ratio) + " · ● = 잘라 낸 분량 · 앞 = 앞 소매 폭 − ●(뒤와 같은 분량) → 밑선 앞뒤 " + f2(m.seams.underarm.back) + " / " + f2(m.seams.underarm.front),
      "남색 실선 = 재단선 · 청록 점선 = 기준선(소매 폭선 · 소매 밑 안내선 · 소맷부리선 — 재단선 아님) · ‖ | = 몸판과 맞춤"];
    if (sym === "U" && m.lineage) body.splice(body.length - 1, 0, "책 P.51: 1/2 · 경사 ★ 8:1.3 / 8:0.5 · 차이 0.5 · 이세 0 / Ⓣ 승계: 소맷부리 뒤 폭 × 3/4 · 옆 다트 3 / 시안 관례: SP 직각 접속 · 진동 접점 위치");
    body.forEach(function (t, i) { add("block-" + i, { x: 0, y: bb.maxY }, 0, 56 + i * 12, "middle", t, i === 0 ? "title" : (i === body.length - 1 ? "note" : "label"), "block"); lines[lines.length - 1].block = i; });
    (g.construction || []).forEach(function (c) { bb.minX = Math.min(bb.minX, c.from.x, c.to.x); bb.maxX = Math.max(bb.maxX, c.from.x, c.to.x); bb.maxY = Math.max(bb.maxY, c.from.y, c.to.y); });
    return { key: "sleeve", line: sym, title: title, lines: lines, dims: dims, leaders: leaders, zones: [], refs: refs, marks: marks, bbox: bb };
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
    var placed = (model.obstacles || []).slice(), tags = [], legend = [], leaders = [];   // obstacles = 이미 그려진 다른 글자 상자(화면 px, 배치 원점 기준) — 피해서 놓는다
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
    var top = Math.max(num(model.blockTopPx) ? model.blockTopPx : 36, bottom - baseY + 16), bl = model.lines.filter(function (l) { return l.block !== undefined; }).sort(function (a, b) { return a.block - b.block; });
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

  // 소매 Ⓡ(돌먼) 몸판 위 표시(표시 전용 · geometry·hash 무관): 파생 몸판 재단 외곽(굵은 선) · 몸판 위에 겹쳐 그린 소매 반쪽 제도 레이어(점선) ·
  //   교차점 X · 소매 밑점 U · 옆선 WL 점 S · 새 SP · 소매 끝 E · 소맷부리 끝 C. 값은 전부 working.sleeveR(엔진 meta)에서 읽는다(재계산 없음).
  //   원래 몸판(원종이)은 기존 작업 그룹이 그대로 그린다 — 이 표시는 그 위에 «새로 그린 선»만 얹는다.
  function dolmanBodice(project) {
    var w = project && project.working, st = w && w.sleeveR;
    if (w && w.sleeveU) return shirtBodice(w.sleeveU, "U");   // Ⓤ: Ⓣ 와 같은 표시 틀(P.51 «Ⓣ 와 같이»)
    if (w && w.sleeveT) return shirtBodice(w.sleeveT);   // Ⓣ: 몸판 진동에 겹쳐 그린 셔츠 슬리브 반쪽(같은 표시 틀 — 재단선 상시 · 제도선·공정은 토글)
    if (w && w.sleeveS) st = { meta: w.sleeveS.rMeta, derivedBodice: w.sleeveS.derivedBodice, blocked: w.sleeveS.blocked };   // Ⓢ: 몸판 위 제도는 Ⓡ 와 같은 의미(Ⓢ 가 들고 있는 Ⓡ meta 읽기 전용)
    if (!st || st.blocked || !st.meta || !st.derivedBodice) return null;
    var out = {};
    ["back", "front"].forEach(function (pc) {
      var dl = st.meta.draftLayer[pc], h = st.meta[pc];
      out[pc] = {
        cut: st.derivedBodice[pc].outline,
        draft: [dl.cap, dl.cuff, dl.center, dl.underarm, dl.width, dl.cuffGuide, dl.shoulderExt, dl.newSide],
        marks: [{ id: "X", at: P(dl.crossing), text: "X 교차 · 아래 " + f2(h.lower.armholeLowerCm) + " = " + f2(h.lower.capLowerCm) },
          { id: "U", at: P(dl.U), text: "소매 밑점" }, { id: "S", at: P(dl.S), text: "진동 아랫점(WL)" }, { id: "SPn", at: P(dl.spNew), text: "새 SP" },
          { id: "E", at: P(dl.E), text: "소매 끝" }, { id: "C", at: P(dl.C), text: "소맷부리 끝(+" + f2(st.meta.settings.inputs.hemDropCm) + ")" }]
      };
    });
    var fig = st.meta.backShoulder && st.meta.backShoulder.figure;
    if (fig) out.back.shoulder = dolmanShoulderFigure(fig, segsBBox(out.back.cut));
    out.back.anno = dolmanAnno(st, "back", segsBBox(out.back.cut.concat(out.back.draft)));
    out.front.anno = dolmanAnno(st, "front", segsBBox(out.front.cut.concat(out.front.draft)));
    return out;
  }
  // ── 소매 Ⓡ 몸판 위 제도 공정(표시 전용 · 몸판 좌표 · 값은 전부 엔진 meta/설정값): 기준선마다 짧은 순서 번호 + 치수선/인출선.
  //   ① 어깨 연장 · ② 소매 중심선(길이)·소매 폭선 · ③ 옆 여유 · ④ WL 새 진동 아랫점 · ⑤ 교차점 X 아래 같은 길이(맞춤 ‖/|) ·
  //   ⑥ 뒤 어깨 다트 닫힘 / 앞 AH 다트 미봉제 · ⑦ E→P 직각 ● · ⑧ P→C 밑선 연장. 글자 배치는 layout()(겹치면 이동 · 배율이 작으면 번호 설명).
  function dolmanAnno(st, pc, bb) {
    var m = st.meta, dl = m.draftLayer[pc], h = m[pc], inp = m.settings.inputs, back = pc === "back";
    var lines = [], refs = [], marks = [], leaders = [];
    var sub = function (a, b) { return { x: a.x - b.x, y: a.y - b.y }; }, addv = function (a, b) { return { x: a.x + b.x, y: a.y + b.y }; }, mul = function (a, k) { return { x: a.x * k, y: a.y * k }; };
    var unit = function (v) { var l = Math.hypot(v.x, v.y); return { x: v.x / l, y: v.y / l }; };
    var add = function (id, at, dx, dy, anchor, text, cls) { lines.push({ id: id, at: P(at), px: { dx: dx, dy: dy }, anchor: anchor, text: text, cls: cls || "label", group: id }); };
    // 기울어진 치수선: A→B 를 법선 nn 쪽으로 off(cm) 띄운 선 + 보조선, 글자는 그 바깥 9px
    var adim = function (id, A, B, nn, off, text) {
      var a2 = addv(A, mul(nn, off)), b2 = addv(B, mul(nn, off)), mid = mul(addv(a2, b2), 0.5);
      refs.push({ id: id + "-ext-a", from: P(A), to: a2, cls: "ext" }, { id: id + "-ext-b", from: P(B), to: b2, cls: "ext" }, { id: id + "-dim", from: a2, to: b2, cls: "dim" });
      add(id, mid, nn.x * 10, nn.y * 10 + 3, Math.abs(nn.x) > 0.6 ? (nn.x > 0 ? "start" : "end") : "middle", text, "dim");
    };
    var SP0 = dl.sp, SPn = dl.spNew, E = dl.E, W0 = dl.width.from, U = dl.U, S = dl.S, Pp = dl.P, C = dl.C, X = dl.crossing;
    var u = unit(sub(SPn, SP0)), n = unit(sub(Pp, E)), up = mul(n, -1);   // u = 어깨·소매 중심 방향 · n = 중심선 직각(몸 쪽) · up = 그 반대
    var ease = back ? inp.backSideEaseCm : inp.frontSideEaseCm, out = back ? 1 : -1, side0 = { x: S.x - out * ease, y: S.y };
    adim("r1", SP0, SPn, up, 1.4, "① 어깨 +" + f2(inp.shoulderExtCm));
    adim("r2w", SPn, W0, up, 1.4, "② 폭선 " + f2(inp.capHeightCm));
    adim("r2", SPn, E, up, 3.4, "② 소매 중심 " + f2(inp.sleeveLengthCm) + " (새 SP 부터)");
    add("r2u", mul(addv(W0, U), 0.5), 0, -4, "middle", "소매 폭선 ⟂ " + f2(h.widthLineCm), "ref");
    adim("r3", side0, S, { x: 0, y: 1 }, 1.6, "③ 옆 " + (back ? "뒤" : "앞") + " +" + f2(ease));
    marks.push({ id: "S", at: P(S), cls: "mark" }); add("r4", S, -out * 6, -6, back ? "end" : "start", "④ 진동 아랫점(WL)", "label");
    marks.push({ id: "X", at: P(X), cls: "mark" });
    add("r5", X, out * 7, -5, back ? "start" : "end", "⑤ X 아래 " + f2(h.lower.armholeLowerCm) + " = " + f2(h.lower.capLowerCm) + " " + (back ? "‖" : "|"), "label");
    [["r5a", h.match.armholeMid], ["r5c", h.match.capMid]].forEach(function (e) { marks.push({ id: e[0], at: P(e[1]), cls: "notch" }); add(e[0], e[1], 0, -5, "middle", back ? "‖" : "|", "dim"); });
    if (back && dl.closure) { leaders.push({ id: "r6", from: P(dl.closure.apex), toAt: P(dl.closure.apex), toPx: { dx: 10, dy: 16 } }); add("r6", dl.closure.apex, 12, 24, "start", "⑥ 어깨 다트 닫음 → 진동 쪽 벌림", "ref"); }
    if (!back && m.frontDart && m.frontDart.apex) { leaders.push({ id: "r6", from: P(m.frontDart.apex), toAt: P(m.frontDart.apex), toPx: { dx: 10, dy: 16 } }); add("r6", m.frontDart.apex, 12, 24, "start", "⑥ AH 다트 박지 않음 → 진동 여유", "ref"); }
    adim("r7", E, Pp, u, 1.4, "⑦ ● " + f2(m.cuff.attachCm) + " ⟂");
    refs.push({ id: "r7-sq-a", from: addv(E, mul(n, 0.8)), to: addv(addv(E, mul(n, 0.8)), mul(u, -0.8)), cls: "dim" }, { id: "r7-sq-b", from: addv(E, mul(u, -0.8)), to: addv(addv(E, mul(n, 0.8)), mul(u, -0.8)), cls: "dim" });   // E 직각 표시
    adim("r8", Pp, C, mul({ x: -unit(sub(C, Pp)).y, y: unit(sub(C, Pp)).x }, back ? -1 : 1), 1.0, "⑧ +" + f2(inp.hemDropCm));
    [["U", U, "U"], ["E", E, "E"], ["P", Pp, "P"], ["C", C, "C"], ["SPn", SPn, "SP′"]].forEach(function (e) { marks.push({ id: e[0], at: P(e[1]), cls: "mark" }); add("pt-" + e[0], e[1], 0, 13, "middle", e[2], "edge"); });
    return { key: "dolman-" + pc, line: "R", title: "", lines: lines, dims: [], leaders: leaders, zones: [], refs: refs, marks: marks, bbox: bb, blockX: (bb.minX + bb.maxX) / 2, blockTopPx: 52 };   // 번호 설명 줄은 조각 이름(밑단 아래) 밑에서
  }
  // 뒤 어깨 다트 닫힘 비교(표시 전용 · 형상 보정 없음): 닫기 전 두 구간(회색 점선) · 닫은 뒤 진동 쪽 구간(주황) · 최종 직선 목옆점 → 새 SP(검정) ·
  //   목 쪽 입구 → 직선 수선(빨강, 이탈 거리). 몸판 위 1배 + 몸판 위쪽 빈 자리에 입구 주변 확대(×SH_ZOOM, 창 반폭 SH_WIN cm) 상자.
  var SH_ZOOM = 10, SH_WIN = 1.4, SH_GAP = 3;
  function dolmanShoulderFigure(fig, cutBB) {
    var lines = [
      { id: "before-neck", cls: "before", from: P(fig.SNP), to: P(fig.neckMouth) }, { id: "before-arm", cls: "before", from: P(fig.armMouth), to: P(fig.spStored) },
      { id: "after-arm", cls: "after", from: P(fig.armMouthClosed), to: P(fig.spClosed) },
      { id: "final", cls: "final", from: P(fig.SNP), to: P(fig.spNew) },
      { id: "dev", cls: "dev", from: P(fig.neckMouth), to: P(fig.foot) }];
    var c = { x: (fig.neckMouth.x + fig.armMouthClosed.x) / 2, y: (fig.neckMouth.y + fig.armMouthClosed.y) / 2 }, half = SH_WIN * SH_ZOOM;
    var bc = { x: cutBB ? (cutBB.minX + cutBB.maxX) / 2 : c.x, y: (cutBB ? cutBB.minY : c.y) - SH_GAP - half };   // 상자 중심: 파생 몸판 위쪽(겹침 없음)
    var map = function (q) { return { x: bc.x + (q.x - c.x) * SH_ZOOM, y: bc.y + (q.y - c.y) * SH_ZOOM }; };
    var box = { minX: bc.x - half, minY: bc.y - half, maxX: bc.x + half, maxY: bc.y + half };
    return {
      lines: lines, residualCm: fig.neckMouthOffLineCm,
      inset: { box: box, zoom: SH_ZOOM, windowCm: SH_WIN, source: { minX: c.x - SH_WIN, minY: c.y - SH_WIN, maxX: c.x + SH_WIN, maxY: c.y + SH_WIN },
        lines: lines.map(function (l) { return { id: l.id, cls: l.cls, from: map(l.from), to: map(l.to) }; }),
        dev: { at: map(fig.neckMouth), text: "목 쪽 입구 이탈 " + f2(fig.neckMouthOffLineCm) + " cm" },
        title: "뒤 어깨 다트 닫힘 비교 ×" + SH_ZOOM + " (보정 없음)",
        legend: ["회색 점선 = 닫기 전", "주황 = 닫은 뒤(진동 쪽 회전)", "검정 = 최종 직선(목옆점 → 새 SP)", "빨강 = 목 쪽 입구 → 직선 수선", "─ 몸판 색 ─ 자홍 실선 = 최종 몸판 재단선 · 남색 = 원래 몸판 Ⓐ", "청록 점선 = 소매 반쪽 제도선(재단선 아님) · ①~⑧ = 제도 순서"] }
    };
  }
  function segsBBox(segs) {
    var b = null, add = function (q) { if (!b) b = { minX: q.x, minY: q.y, maxX: q.x, maxY: q.y }; else { b.minX = Math.min(b.minX, q.x); b.minY = Math.min(b.minY, q.y); b.maxX = Math.max(b.maxX, q.x); b.maxY = Math.max(b.maxY, q.y); } };
    (segs || []).forEach(function (s) { if (!s) return; if (s.kind === "line") { add(s.from); add(s.to); } else (s.commands || []).forEach(function (c) { c.points.forEach(add); }); });
    return b;
  }
  // 소매 Ⓡ 몸판 표시 범위(배치·fit 용, 몸판 좌표): 파생 몸판 재단선 ∪ 소매 반쪽 제도선 ∪ 뒤 어깨 비교 상자. 토글과 무관(켜고 꺼도 배치가 움직이지 않게).
  function dolmanExtents(project) {
    var d = dolmanBodice(project); if (!d) return null;
    var out = {};
    ["back", "front"].forEach(function (pc) {
      var b = segsBBox(d[pc].cut.concat(d[pc].draft)), sh = d[pc].shoulder;
      if (sh) { var x = sh.inset.box; b = { minX: Math.min(b.minX, x.minX), minY: Math.min(b.minY, x.minY), maxX: Math.max(b.maxX, x.maxX), maxY: Math.max(b.maxY, x.maxY) }; }
      out[pc] = b;
    });
    out.sleeveBelow = !(project.working && (project.working.sleeveT || project.working.sleeveU));   // 돌먼 한 장 소매(폭 ≈ 74)는 몸판 아래 줄(designLayout.autoLayout) · Ⓣ(폭 ≈ 30)는 기존 자리(오른쪽)
    return out;
  }

  // 소매 Ⓣ(셔츠 슬리브) 몸판 위 표시(표시 전용 · geometry·hash 무관 · 값은 working.sleeveT 엔진 meta — 재계산 없음):
  //   파생 몸판 재단선(앞 = AH 다트 → 옆 다트, 뒤 = 그대로) · 몸판 진동에 겹쳐 그린 소매 반쪽 제도선 · 제도 순서 번호(P.140–141 단계).
  function shirtBodice(st, sym) {
    if (!st || st.blocked || !st.meta || !st.derivedBodice) return null;
    var m = st.meta, out = {};
    ["back", "front"].forEach(function (pc) {
      var dl = m.draftLayer[pc];
      out[pc] = { cut: st.derivedBodice[pc].outline,
        draft: [dl.cap, dl.center, dl.shoulderExt, dl.slopeDrop, dl.width, dl.underarmGuide, dl.cuffLine, dl.underarm] };
      out[pc].anno = shirtAnno(m, pc, segsBBox(out[pc].cut.concat(out[pc].draft)), sym || "T");
    });
    return out;
  }
  // ── 소매 Ⓣ 몸판 위 제도 공정(표시 전용 · 몸판 좌표): ① 앞 AH 다트 → 옆(3) · ② 경사 8 ⟂ 4 / 3.4 · ③ 소매 중심선(소매길이) ·
  //   ④ 소매산 높이 ◉ · ⑤ 소매 폭선 ⟂ · ⑥ 소맷부리선 ⟂ · ⑦ 소매산(진동과 같은 길이 · 0.7 / 0.5 · ★) · ⑧ 소매 아랫점 · 안내선 ·
  //   ⑨ 소맷부리 = 뒤 폭 × 3/4 · ● / 앞 = 폭 − ● · ⑩ 소매 밑선. 맞춤 ‖ | = SP 에서 같은 호 길이(진동·소매산 각각).
  //   Ⓤ: P.51 도해의 ★ = 소매 경사(직각 1.3 / 0.5) — 그래서 ② 직각 치수에 ★ 를 달고, 소매산이 진동과 만나는 점(Ⓣ 관례)은 «접점»으로 표시해 기호를 섞지 않는다.
  function shirtAnno(m, pc, bb, sym) {
    var isU = sym === "U";
    var dl = m.draftLayer[pc], h = m[pc], inp = m.settings.inputs, back = pc === "back";
    var lines = [], refs = [], marks = [], leaders = [];
    var sub = function (a, b) { return { x: a.x - b.x, y: a.y - b.y }; }, addv = function (a, b) { return { x: a.x + b.x, y: a.y + b.y }; }, mul = function (a, k) { return { x: a.x * k, y: a.y * k }; };
    var unit = function (v) { var l = Math.hypot(v.x, v.y); return { x: v.x / l, y: v.y / l }; };
    var add = function (id, at, dx, dy, anchor, text, cls) { lines.push({ id: id, at: P(at), px: { dx: dx, dy: dy }, anchor: anchor, text: text, cls: cls || "label", group: id }); };
    var adim = function (id, A, B, nn, off, text) {
      var a2 = addv(A, mul(nn, off)), b2 = addv(B, mul(nn, off)), md = mul(addv(a2, b2), 0.5);
      refs.push({ id: id + "-ext-a", from: P(A), to: a2, cls: "ext" }, { id: id + "-ext-b", from: P(B), to: b2, cls: "ext" }, { id: id + "-dim", from: a2, to: b2, cls: "dim" });
      add(id, md, nn.x * 10, nn.y * 10 + 3, Math.abs(nn.x) > 0.6 ? (nn.x > 0 ? "start" : "end") : "middle", text, "dim");
    };
    var sq = function (id, at, a, c) {   // 직각 표시(at 에서 a·c 방향 0.8cm)
      var p1 = addv(at, mul(a, 0.8)), p2 = addv(p1, mul(c, 0.8)), p3 = addv(at, mul(c, 0.8));
      refs.push({ id: id + "-a", from: p1, to: p2, cls: "dim" }, { id: id + "-b", from: p3, to: p2, cls: "dim" });
    };
    var SP = dl.sp, E = dl.E, W0 = dl.W0, U = dl.U, G = dl.G, C = dl.C, K8 = dl.K8, KA = dl.KA;
    var u = unit(sub(E, SP)), n = unit(sub(U, W0)), up = mul(n, -1), us = unit(sub(K8, SP)), ds = unit(sub(KA, K8));
    if (!back) {
      var fd = m.frontDart, BP = fd.apex;
      marks.push({ id: "bp", at: P(BP), cls: "mark" });
      leaders.push({ id: "t1", from: P(BP), toAt: P(BP), toPx: { dx: 10, dy: 16 } });
      add("t1", BP, 12, 24, "start", "① AH 다트 닫음 → 옆 다트 " + f2(fd.angleDeg) + "° (진동 아랫점 아래 " + f2(fd.sideDropCm) + ")", "ref");
      adim("t1s", fd.underarmBefore, fd.legs[1], { x: 1, y: 0 }, -1.2, f2(fd.sideDropCm));
    }
    adim("t2r", SP, K8, mul(ds, -1), 1.0, "② " + f2(inp.slopeRunCm));
    adim("t2d", K8, KA, us, 1.0, f2(back ? inp.backSlopeDropCm : inp.frontSlopeDropCm) + (isU ? " (★ 경사)" : ""));
    sq("t2sq", K8, mul(us, -1), ds);
    adim("t3", SP, E, up, 3.4, "③ 소매 중심선 · 소매길이 " + f2(m.sleeveLengthCm));
    adim("t4", SP, W0, up, 1.4, "④ ◉ " + f2(m.capHeight.cm));
    sq("t5sq", W0, mul(u, -1), n);
    add("t5", mul(addv(W0, U), 0.5), 0, -4, "middle", "⑤ 소매 폭선 ⟂ " + f2(h.widthCm), "ref");
    sq("t6sq", E, mul(u, -1), n);
    add("t6", mul(addv(E, G), 0.5), 0, -4, "middle", "⑥ 소맷부리선 ⟂", "ref");
    dl.stars.forEach(function (s, i) { marks.push({ id: "star" + i, at: P(s), cls: "notch" }); add("star" + i, s, back ? -8 : 8, 0, back ? "end" : "start", isU ? "접점" : "★", "dim"); });
    dl.bumps.forEach(function (bp, i) { refs.push({ id: "bump" + i, from: P(bp.base), to: P(bp.pt), cls: "dim" }); add("bump" + i, bp.pt, back ? -6 : 6, -4, back ? "end" : "start", f2(Math.abs(bp.offsetCm)), "dim"); });
    add("t7", dl.bumps[0].pt, back ? -6 : 6, 12, back ? "end" : "start", "⑦ 소매산 " + f2(h.capCm) + " = 진동 " + f2(h.armholeCm), "label");
    [["t7a", dl.notch.armhole], ["t7c", dl.notch.cap]].forEach(function (e) { marks.push({ id: e[0], at: P(e[1]), cls: "notch" }); add(e[0], e[1], 0, -5, "middle", dl.notch.mark, "dim"); });
    marks.push({ id: "U", at: P(U), cls: "mark" }); add("t8", U, back ? -6 : 6, 12, back ? "end" : "start", "⑧ 소매 아랫점 · 안내선 ⟂ 폭선", "label");
    adim("t9", E, C, u, 1.4, "⑨ 소맷부리 " + f2(h.cuffCm) + (back ? " (폭 × " + f2(m.cuff.ratio) + ")" : " (폭 − ●)"));
    adim("t9c", C, G, u, 1.4, "● " + f2(m.cuff.cutCm));
    add("t10", mul(addv(U, C), 0.5), back ? -6 : 6, 0, back ? "end" : "start", "⑩ 소매 밑선 " + f2(h.underarmCm), "label");
    [["SP", SP, "SP"], ["E", E, "E"], ["C", C, "C"], ["G", G, "G"]].forEach(function (e) { marks.push({ id: e[0], at: P(e[1]), cls: "mark" }); add("pt-" + e[0], e[1], 0, 13, "middle", e[2], "edge"); });
    return { key: "dolman-" + pc, line: sym || "T", title: "", lines: lines, dims: [], leaders: leaders, zones: [], refs: refs, marks: marks, bbox: bb, blockX: (bb.minX + bb.maxX) / 2, blockTopPx: 52 };
  }

  window.sleeveAnnotation = Object.freeze({ buildModel: buildModel, layout: layout, overhang: overhang, refModel: refModel, bodiceMarks: bodiceMarks, dolmanBodice: dolmanBodice, dolmanExtents: dolmanExtents });
})();
