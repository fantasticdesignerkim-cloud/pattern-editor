// ══════════════════════════════════════════════
// js/cutPrep.js — 재단 준비 1단계(2026-11-13 김님 승인 «순서대로 작업 이어가자»).
//
// 무엇: 유효한 Design 완료본(designResult)에서 **읽기 전용으로** 재단 조각 목록·외곽을 파생해 보여 준다.
//   ★ 시접 전이다 — 그리는 선은 완성선(봉제선) 그대로다. 시접·너치·식서·재단 수량·배치 최적화·출력은 아직 없다.
//
// 계약(저장·엔진 무변경):
//   · 권위 = designResult(.latest · .check · .isCurrentDesignChanged · .finalBodiceOf). 새 판정 원리·새 차단 없음
//     (맞춤 길이 카드의 차이로 막지 않는다).
//   · 새 스냅샷·새 저장 키·새 stage 없음. uiState.stage 는 그대로 "design" 이고, 재단 화면은 그 위의 오버레이다.
//     → 프로젝트 파일에는 stage "design" 으로 저장되고 열면 디자인 단계로 열린다(재단 화면은 다시 «재단»을 누른다).
//   · 조각 좌표는 완료본의 새 복사본(정규화: path → cubic/line)이다. 원본·완료본·hash 를 바꾸지 않는다.
//     화면 배치는 표시 offset(transform)일 뿐 조각 좌표에 넣지 않는다.
//   · 매번 다시 파생한다(캐시된 옛 조각을 그리지 않는다). Design 이 바뀌면 «변경됨 · 다시 완료» 만 보이고 조각은 없다.
//   · 조각 = 완료 패키지가 실제로 담고 있는 폐곡선만: 몸판(최종 몸판 = 소매 파생 몸판 ∥ bodiceResult, 분리 조각이 있으면
//     그 조각들로 대체 — 원본+파생 이중 노출 금지) · 소매(여러 장이면 장마다) · 커프스 · 카라 종류별 조각.
//     없는 조각(여밈 합성 외곽·트임 덧단 등)은 «아직 재단 조각 아님 + 이유» 로 적는다. 대체 직사각형을 만들지 않는다.
//   · 종이 위 검사 = 유한 좌표 + designCollar.validateClosedOutline(연속·폐곡선·자기교차·면적 — 기존 검증 재사용).
// ══════════════════════════════════════════════
(function () {
  "use strict";

  function W() { return (typeof window !== "undefined") ? window : {}; }
  function project() { var dw = W().designWorkflow; return (dw && dw.current && dw.current()) || null; }
  function hashStr(s) { var h = 0; for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return (h >>> 0).toString(16); }
  function r4(v) { return Math.round(v * 1e4) / 1e4; }
  function pt(p) { return { x: p.x, y: p.y }; }
  function deepFreeze(o) { if (o && typeof o === "object" && !Object.isFrozen(o)) { Object.keys(o).forEach(function (k) { deepFreeze(o[k]); }); Object.freeze(o); } return o; }

  // ── 실패 사유(designResult.check fails) → 글 · 돌아갈 곳(디자인 서브탭) ──
  var FAIL_TEXT = {
    "no-project": "디자인 프로젝트가 없습니다", "no-module": "디자인 모듈이 준비되지 않았습니다",
    "no-bodice": "몸판 모양 완료 전입니다", "bodice-changed": "몸판이 완료 뒤 바뀌었습니다",
    "no-sleeve": "소매 모양 완료 전입니다", "sleeve-changed": "소매가 완료 뒤 바뀌었습니다",
    "sleeve-bodice-mismatch": "소매가 지금 몸판이 아니라 예전 몸판 기준입니다", "sleeve-source-mismatch": "소매가 지금 몸판이 아니라 예전 몸판 기준입니다",
    "no-collar": "카라 모양 완료 전입니다", "collar-changed": "카라가 완료 뒤 바뀌었습니다",
    "collar-bodice-mismatch": "카라가 지금 몸판이 아니라 예전 몸판 기준입니다", "collar-source-mismatch": "카라가 지금 몸판이 아니라 예전 몸판 기준입니다",
    "collar-sleeve-order": "소매를 다시 완료한 뒤 카라도 다시 완료해야 합니다",
    "cut-invalid-on-final-bodice": "절개선 일부가 최종 몸판에서 유효하지 않습니다"
  };
  var TAB_LABEL = { body: "몸판", sleeve: "소매", collar: "카라" };
  function returnTabOf(fail) {
    if (!fail) return "collar";
    if (/bodice/.test(fail) && !/^(sleeve|collar)-/.test(fail)) return "body";
    if (fail === "cut-invalid-on-final-bodice") return "body";
    if (/^(no-sleeve|sleeve-)/.test(fail)) return "sleeve";
    return "collar";
  }

  // ── 세그먼트 정규화(새 객체) — line·cubic·path(M/C/L/Z) 만. 그 밖은 null(추측하지 않는다) ──
  function normSeg(s) {
    if (!s || typeof s !== "object") return null;
    if (s.kind === "line" && s.from && s.to) return [{ kind: "line", from: pt(s.from), to: pt(s.to) }];
    if (s.kind === "cubic" && s.from && s.c1 && s.c2 && s.to) return [{ kind: "cubic", from: pt(s.from), c1: pt(s.c1), c2: pt(s.c2), to: pt(s.to) }];
    if (s.kind === "path" && Array.isArray(s.commands)) {
      var out = [], cur = null, start = null;
      for (var i = 0; i < s.commands.length; i++) {
        var c = s.commands[i], P = c.points || [];
        if (c.type === "M") { cur = start = P[0]; continue; }
        if (!cur) return null;
        if (c.type === "C" && P.length >= 3) { out.push({ kind: "cubic", from: pt(cur), c1: pt(P[0]), c2: pt(P[1]), to: pt(P[2]) }); cur = P[2]; }
        else if (c.type === "L" && P.length >= 1) { out.push({ kind: "line", from: pt(cur), to: pt(P[0]) }); cur = P[0]; }
        else if (c.type === "Z") { if (start) out.push({ kind: "line", from: pt(cur), to: pt(start) }); cur = start; }
        else return null;
      }
      return out;
    }
    return null;
  }
  function normOutline(outline) {
    if (!Array.isArray(outline) || !outline.length) return { ok: false, reason: "외곽이 비어 있습니다" };
    var segs = [];
    for (var i = 0; i < outline.length; i++) { var n = normSeg(outline[i]); if (!n) return { ok: false, reason: "읽을 수 없는 선 종류(" + (outline[i] && outline[i].kind) + ")" }; segs = segs.concat(n); }
    return { ok: true, segs: segs };
  }
  function segPts(s) { return s.kind === "cubic" ? [s.from, s.c1, s.c2, s.to] : [s.from, s.to]; }
  function allFinite(segs) { return segs.every(function (s) { return segPts(s).every(function (p) { return p && isFinite(p.x) && isFinite(p.y); }); }); }
  function cubicAt(s, t) { var u = 1 - t; return { x: u * u * u * s.from.x + 3 * u * u * t * s.c1.x + 3 * u * t * t * s.c2.x + t * t * t * s.to.x, y: u * u * u * s.from.y + 3 * u * u * t * s.c1.y + 3 * u * t * t * s.c2.y + t * t * t * s.to.y }; }
  function sample(segs, n) { var out = []; segs.forEach(function (s) { if (s.kind === "line") { out.push(s.from); return; } for (var k = 0; k < n; k++) out.push(cubicAt(s, k / n)); }); return out; }
  function measure(segs) {
    var pts = sample(segs, 48), minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, per = 0, area = 0;
    pts.forEach(function (p, i) {
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
      var q = pts[(i + 1) % pts.length]; per += Math.hypot(q.x - p.x, q.y - p.y); area += p.x * q.y - q.x * p.y;
    });
    return { bbox: { minX: r4(minX), minY: r4(minY), maxX: r4(maxX), maxY: r4(maxY) }, widthCm: r4(maxX - minX), heightCm: r4(maxY - minY), perimeterCm: r4(per), areaCm2: r4(Math.abs(area) / 2) };
  }
  function canon(segs) { return JSON.stringify(segs.map(function (s) { return segPts(s).map(function (p) { return [r4(p.x), r4(p.y)]; }); })); }

  // 종이 위 검사: 유한 좌표 → 기존 폐곡선 검증(designCollar.validateClosedOutline: 연속·닫힘·자기교차·면적).
  var CHECK_TEXT = { "empty": "외곽이 비어 있습니다", "not-closed": "외곽이 끊겨 있습니다(폐곡선 아님)", "self-intersection": "외곽이 스스로 교차합니다", "degenerate-area": "면적이 없습니다" };
  function paperCheck(segs) {
    if (!allFinite(segs)) return { ok: false, reason: "좌표에 유한하지 않은 값이 있습니다" };
    var DC = W().designCollar;
    if (!DC || typeof DC.validateClosedOutline !== "function") return { ok: false, reason: "폐곡선 검증 모듈이 없습니다" };
    var v = DC.validateClosedOutline(segs);
    if (!v.ok) { var key = String(v.reason || "").split(":")[0]; return { ok: false, reason: CHECK_TEXT[key] || ("검증 실패(" + v.reason + ")") }; }
    return { ok: true };
  }

  // ── 순서 없는 외곽 집합 → 한 바퀴 ring(새 객체) ──
  //   ① 외곽만으로 닫히면 그대로(뒤집기만) ② 끝이 둘 남으면(열린 다트 입구) 기존 designLineTool.buildPieceRing 이
  //   construction 의 다트 다리로 닫는다(= 디자인 «파트 분리»와 같은 폐곡선) ③ 그 밖은 실패(이유 그대로 — 추측해 잇지 않는다).
  var JOIN = 1e-4;
  function near(a, b) { return Math.hypot(a.x - b.x, a.y - b.y) <= JOIN; }
  function rev(s) { return s.kind === "cubic" ? { kind: "cubic", from: pt(s.to), c1: pt(s.c2), c2: pt(s.c1), to: pt(s.from) } : { kind: "line", from: pt(s.to), to: pt(s.from) }; }
  function chainClosed(segs) {
    var n = segs.length, used = new Array(n).fill(false), out = [segs[0]], cur = segs[0].to; used[0] = true;
    for (var step = 1; step < n; step++) {
      var f = -1, o = null;
      for (var j = 0; j < n; j++) { if (used[j]) continue; if (near(segs[j].from, cur)) { f = j; o = segs[j]; break; } if (near(segs[j].to, cur)) { f = j; o = rev(segs[j]); break; } }
      if (f < 0) return null;
      used[f] = true; out.push(o); cur = o.to;
    }
    return near(cur, out[0].from) ? out : null;
  }
  function ringOf(segs, construction) {
    if (!segs.length) return { ok: false, reason: "외곽이 비어 있습니다" };
    var closed = chainClosed(segs);
    if (closed) return { ok: true, segs: closed, legs: 0 };
    var DLT = W().designLineTool, cons = (construction || []).filter(function (c) { return c && c.kind === "line" && c.from && c.to; });
    if (DLT && typeof DLT.buildPieceRing === "function" && cons.length) {
      var r = DLT.buildPieceRing(segs, cons);
      if (r.ok) return { ok: true, legs: r.ring.filter(function (x) { return x.source === "dartleg"; }).length, segs: r.ring.map(function (x) { return x.seg.kind === "cubic" ? { kind: "cubic", from: pt(x.seg.from), c1: pt(x.seg.c1), c2: pt(x.seg.c2), to: pt(x.seg.to) } : { kind: "line", from: pt(x.seg.from), to: pt(x.seg.to) }; }) };
    }
    return { ok: false, reason: openReason(segs) };
  }
  // 닫히지 않은 이유를 실측으로(열린 끝 수 · 가장 작은 틈). 틈을 메우지 않는다.
  function openReason(segs) {
    var E = []; segs.forEach(function (s, i) { E.push({ i: i, p: s.from }); E.push({ i: i, p: s.to }); });
    var free = E.filter(function (e) { return !E.some(function (x) { return x.i !== e.i && near(x.p, e.p); }); });
    var gap = Infinity;
    for (var a = 0; a < free.length; a++) for (var b = a + 1; b < free.length; b++) gap = Math.min(gap, Math.hypot(free[a].p.x - free[b].p.x, free[a].p.y - free[b].p.y));
    return "외곽이 끊겨 있습니다 — 열린 끝 " + free.length + "개" + (isFinite(gap) ? " · 가장 작은 틈 " + (gap < 0.01 ? gap.toExponential(1) : gap.toFixed(2)) + "cm" : "") + " (폐곡선 아님 · 메우지 않음)";
  }

  // ── 파생 몸판 읽기 어댑터(재단 표시 전용 · 완료본·hash 무변경 · 새 허용 공차 없음) ──
  //   ① 다트 다리 상속: 파생 조각 외곽이 원래 몸판(bodiceResult) 같은 조각 외곽과 **완전히 같으면**(복제 — Ⓣ·Ⓤ 뒤판 «그대로»)
  //      그 조각의 열린 다트 입구 다리는 원래 몸판 construction 에 있다 → 그것을 그대로 읽는다(외곽이 하나라도 다르면 상속 없음).
  //   ② 진동 아랫점 정합: 원래 몸판에서 진동(armhole) 끝 A 가 옆선(side-seam) 끝 S 를 소수 셋째 자리로 반올림한 값과 같으면(곡선 앵커는
  //      3자리로 저장 — 같은 설계점의 두 표기) 파생 조각에 **그 두 좌표가 그대로 남은 경우에만** 진동 끝 A 를 S 로 맞춘다. 근접 병합 아님.
  function endsOf(s) {
    if (s && s.kind === "path" && s.commands && s.commands.length) { var c = s.commands, lp = c[c.length - 1].points; return [c[0].points[0], lp[lp.length - 1]]; }
    return s && s.from && s.to ? [s.from, s.to] : [];
  }
  function same(a, b) { return !!a && !!b && Math.abs(a.x - b.x) <= 1e-9 && Math.abs(a.y - b.y) <= 1e-9; }
  function r3(v) { return Math.round(v * 1000) / 1000; }
  function underarmPair(orig) {
    if (!orig || !Array.isArray(orig.outline)) return null;
    var arm = [], side = [];
    orig.outline.forEach(function (s) { if (s.edge === "armhole") arm = arm.concat(endsOf(s)); else if (s.edge === "side-seam") side = side.concat(endsOf(s)); });
    for (var i = 0; i < arm.length; i++) for (var j = 0; j < side.length; j++) {
      var A = arm[i], Sd = side[j];
      if (!near(A, Sd) && same(A, { x: r3(Sd.x), y: r3(Sd.y) })) return { a: A, s: Sd };
    }
    return null;
  }
  function adaptDerived(piece, orig) {
    var out = { outline: piece && piece.outline, construction: piece && piece.construction, notes: [] };
    if (!piece || !Array.isArray(piece.outline)) return out;
    if (!(piece.construction && piece.construction.some(function (c) { return c && c.dart; })) && orig && Array.isArray(orig.construction)
        && JSON.stringify(piece.outline) === JSON.stringify(orig.outline)) {
      out.construction = orig.construction;
      out.notes.push("다트 다리 = 원래 몸판 그대로(외곽 동일)");
    }
    var pr = underarmPair(orig);
    if (pr) {
      var ends = []; piece.outline.forEach(function (s, i) { endsOf(s).forEach(function (p) { ends.push({ i: i, p: p }); }); });
      var atA = ends.filter(function (e) { return same(e.p, pr.a); }), atS = ends.filter(function (e) { return same(e.p, pr.s); });
      var arm = atA.length === 1 && piece.outline[atA[0].i].edge === "armhole" ? atA[0].i : -1;
      var dangling = arm >= 0 && !ends.some(function (e) { return e.i !== arm && near(e.p, pr.a); });   // 이미 이어진 끝이면 손대지 않음
      if (dangling && atS.length === 1 && piece.outline[atS[0].i].edge === "side-seam") {
        var sg = JSON.parse(JSON.stringify(piece.outline[arm])), S0 = { x: pr.s.x, y: pr.s.y };
        if (sg.kind === "path") { var c = sg.commands, lp = c[c.length - 1].points; if (same(lp[lp.length - 1], pr.a)) lp[lp.length - 1] = S0; else c[0].points[0] = S0; }
        else if (same(sg.to, pr.a)) sg.to = S0; else sg.from = S0;
        out.outline = piece.outline.slice(); out.outline[arm] = sg;
        out.notes.push("진동 아랫점 " + (Math.hypot(pr.a.x - pr.s.x, pr.a.y - pr.s.y) * 1e4).toFixed(1) + "µm 정합(같은 설계점의 반올림 표기)");
      }
    }
    return out;
  }

  // ── 완료 패키지 → 조각 후보(순수) ──
  var COLLAR_PIECES = {
    "shirt-two-piece": [["stand", "밴드"], ["body", "위 칼라"]],
    "shirt-one-piece": [["onePiece", "한 장 셔츠 칼라"]], "shirt-open-collar": [["openCollar", "오픈 칼라"]],
    "shirt-wing-collar": [["stand", "밴드"], ["tip", "윙 칼라 끝"]], "shirt-band-one-piece": [["joined", "밴드·위 칼라 한 장"]],
    "flat-collar": [["flat", "플랫 칼라"]], "flat-collar-overlap": [["flat", "플랫 칼라"]], "sailor-collar": [["sailor", "세일러 칼라"]],
    "bow-collar": [["bow", "보 칼라"]], "frill-collar": [["frill", "프릴 칼라"]], "hood": [["hood", "후드"]],
    "tailored-collar": [["tailored", "테일러드 칼라"]], "shawl-collar": [["shawl", "숄 칼라"]], "stand-collar": [["standalone", "스탠드 칼라"]]
  };
  var SLEEVE_PIECE_LABEL = { back: "뒤 소매", front: "앞 소매", sleeve: "소매", gusset: "덧천(무)" };
  function sleeveSym(res) { var o = res && res.origin; return (o && (o.symbol || o.sym)) || null; }

  function candidates(R) {
    var out = [], missing = [], info = [], DR = W().designResult;
    function add(group, id, label, source, outline, extra) { out.push(Object.assign({ group: group, id: id, label: label, source: source, outline: outline }, extra || {})); }
    // 몸판 — 최종 몸판(designResult.finalBodiceOf 권위)
    var b = R.bodice, fin = DR && DR.finalBodiceOf ? DR.finalBodiceOf(R) : null;
    if (fin && fin.source === "sleeve-derived") {
      [["front", "앞판"], ["back", "뒤판"]].forEach(function (e) {
        var a = adaptDerived(fin[e[0]], b && b[e[0]]);
        add("bodice", e[0], e[1], "designResult.sleeve.derivedBodice." + e[0], a.outline,
          { note: "소매와 함께 제도한 파생 몸판" + (a.notes.length ? " · " + a.notes.join(" · ") : ""), construction: a.construction });
      });
      info.push("최종 몸판 = 소매 파생 몸판 — 원래 몸판(bodiceResult) 앞·뒤는 중복이라 조각에 넣지 않았습니다");
      if (b && b.placket) missing.push({ id: "placket", label: "앞 여밈·컷온 안단", reason: "파생 몸판 위 여밈 자리를 아직 확인하지 않았습니다 — 앞판에 합친 재단 외곽 없음(재단 다음 단계)" });
    } else if (b) {
      var yoke = !!(b.frontYoke && b.frontBody && b.backYoke && b.backBody), sYoke = !!(b.shoulderYoke && b.frontBody && b.backBody),
        princess = !!(b.frontCenter && b.frontSide && b.backCenter && b.backSide), peplum = !!(b.frontPeplum || b.backPeplum);
      var modes = [yoke, sYoke, princess, peplum].filter(Boolean).length;
      var bp = function (key, label) { add("bodice", key, label, "designResult.bodice." + key, b[key] && b[key].outline, { construction: b[key] && b[key].construction }); };
      if (modes > 1) missing.push({ id: "bodice-mixed", label: "몸판", reason: "분리 조각 종류가 둘 이상 겹친 몸판은 아직 읽지 않습니다(요크·프린세스·페플럼 조합)" });
      else if (yoke) { bp("frontYoke", "앞 요크"); bp("frontBody", "앞판(요크 아래)"); bp("backYoke", "뒤 요크"); bp("backBody", "뒤판(요크 아래)"); info.push("요크로 나뉜 몸판 — 나뉘기 전 앞·뒤 전체는 중복이라 조각에 넣지 않았습니다"); }
      else if (sYoke) { bp("shoulderYoke", "어깨 요크"); bp("frontBody", "앞판(요크 아래)"); bp("backBody", "뒤판(요크 아래)"); info.push("어깨 요크로 나뉜 몸판 — 나뉘기 전 앞·뒤 전체는 중복이라 조각에 넣지 않았습니다"); }
      else if (princess) { bp("frontCenter", "앞 중심판"); bp("frontSide", "앞 옆판"); bp("backCenter", "뒤 중심판"); bp("backSide", "뒤 옆판"); info.push("프린세스로 나뉜 몸판 — 나뉘기 전 앞·뒤 전체는 중복이라 조각에 넣지 않았습니다"); }
      else if (peplum) { bp("front", "앞판(허리 위)"); bp("back", "뒤판(허리 위)"); if (b.frontPeplum) bp("frontPeplum", "앞 페플럼"); if (b.backPeplum) bp("backPeplum", "뒤 페플럼"); }
      else { bp("front", "앞판"); bp("back", "뒤판"); }
      if (b.placket) {
        var onFront = !modes || peplum;
        missing.push({ id: "placket", label: "앞 여밈·컷온 안단", reason: "여밈 " + b.placket.parameters.overlapCm + " · 안단 " + b.placket.parameters.facingWidthCm + "cm 영역은 있지만 앞판과 한 장으로 합친 재단 외곽은 아직 없습니다(안단 접힘·합성 규칙 = 재단 다음 단계)" + (onFront ? " — 앞판 위에 점선으로만 표시" : "") });
        if (onFront) out.forEach(function (c) { if (c.id === "front") c.marks = [{ kind: "placket", outline: b.placket.outline }]; });
      }
    } else missing.push({ id: "bodice", label: "몸판", reason: "완료본에 몸판이 없습니다" });

    // 소매
    var s = R.sleeve, g = s && s.geometry, sym = sleeveSym(s);
    if (!g) missing.push({ id: "sleeve", label: "소매", reason: "완료본에 소매 형상이 없습니다" });
    else if (Array.isArray(g.pieces) && g.pieces.length > 1) {
      g.pieces.forEach(function (name) {
        var segs = (g.outline || []).filter(function (x) { return x && x.piece === name; });
        add("sleeve", "sleeve-" + name, SLEEVE_PIECE_LABEL[name] || ("소매 " + name), "designResult.sleeve.geometry(piece=" + name + ")", segs);
      });
      var stray = (g.outline || []).filter(function (x) { return !x || g.pieces.indexOf(x.piece) < 0; }).length;
      if (stray) missing.push({ id: "sleeve-stray", label: "소매", reason: "어느 소매 조각에도 속하지 않은 선 " + stray + "개 — 추측해 붙이지 않았습니다" });
    } else if (Array.isArray(g.outline) && g.outline.length) {
      var nm = (Array.isArray(g.pieces) && g.pieces.length === 1) ? g.pieces[0] : "sleeve";
      add("sleeve", "sleeve-" + nm, SLEEVE_PIECE_LABEL[nm] || "소매", "designResult.sleeve.geometry", g.outline, { note: nm === "sleeve" && Array.isArray(g.pieces) ? "앞·뒤를 맞댄 한 장" : null, construction: g.construction });
    } else if (g.sleevePiece === false) info.push("소매 조각 없음 — 몸판 일체형 소매" + (sym ? "(" + sym + ")" : "") + "라 소매는 몸판 조각 안에 있습니다");
    else missing.push({ id: "sleeve", label: "소매", reason: "소매 외곽이 비어 있습니다" });
    if (s && s.cuff && s.cuff.piece) {
      add("sleeve", "cuff", "커프스", "designResult.sleeve.cuff.piece", s.cuff.piece.outline);
      if (s.cuff.vent) missing.push({ id: "sleeve-vent", label: "소매 트임 덧단", reason: "트임 자리·덧단 표시선만 있고 재단 조각은 아직 없습니다(트임 처리 방법 미구현)" });
    }

    // 카라
    var c = R.collar, map = c && COLLAR_PIECES[c.type];
    if (!c) missing.push({ id: "collar", label: "카라", reason: "완료본에 카라가 없습니다" });
    else if (!map) missing.push({ id: "collar", label: "카라", reason: "이 카라 종류(" + c.type + ")는 재단 준비에서 아직 읽지 않습니다" });
    else map.forEach(function (m) {
      var part = c[m[0]];
      if (!part || !part.geometry) { if (!(c.type === "shirt-two-piece" && m[0] === "body")) missing.push({ id: "collar-" + m[0], label: m[1], reason: "완료본에 이 조각 형상이 없습니다" }); return; }
      add("collar", "collar-" + m[0], m[1], "designResult.collar." + m[0] + ".geometry", part.geometry.outline,
        { note: c.symmetry === "half-cb-fold" ? "뒤중심 접힘 반쪽(펼치기 전)" : null });
    });

    // 절개선(structuralLines.cut) — 분리하지 않는다. 해당 조각 위에 점선으로만.
    var cuts = (R.structuralLines && R.structuralLines.cut) || [];
    if (cuts.length) {
      cuts.forEach(function (ct) {
        var host = out.filter(function (p) { return p.id === ct.piece || (ct.piece === "sleeve" && p.group === "sleeve" && p.id !== "cuff"); })[0];
        if (host) (host.marks = host.marks || []).push({ kind: "cut", outline: ct.segments });
      });
      missing.push({ id: "cuts", label: "절개선 " + cuts.length + "개", reason: "절개선으로 조각을 나누지 않았습니다 — 조각 위에 점선으로만 표시(파트 확정 = 재단 다음 단계)" });
    }
    return { pieces: out, missing: missing, info: info };
  }

  // ── 조각 확정(정규화·검사·중복 제거) — 순수 ──
  function buildPieces(R) {
    var cand = candidates(R), pieces = [], seenRef = [], seenHash = {}, excluded = [];
    cand.pieces.forEach(function (c) {
      if (c.outline && seenRef.indexOf(c.outline) >= 0) { excluded.push({ id: c.id, label: c.label, reason: "같은 외곽을 가리키는 중복 — 한 번만 표시" }); return; }
      if (c.outline) seenRef.push(c.outline);
      var n = normOutline(c.outline);
      var rec = { id: c.id, label: c.label, group: c.group, source: c.source, note: c.note || null };
      if (!n.ok) { rec.check = { ok: false, reason: n.reason }; rec.segs = []; pieces.push(rec); return; }
      var ring = ringOf(n.segs, c.construction);
      if (!ring.ok) { rec.check = { ok: false, reason: ring.reason }; rec.segs = []; pieces.push(rec); return; }
      n.segs = ring.segs; rec.dartLegs = ring.legs;
      var h = hashStr(canon(n.segs));
      if (seenHash[h]) { excluded.push({ id: c.id, label: c.label, reason: "«" + seenHash[h] + "»과 같은 형상 — 중복이라 한 번만 표시" }); return; }
      seenHash[h] = c.label;
      rec.segs = n.segs; rec.hash = h; rec.check = paperCheck(n.segs);
      Object.assign(rec, measure(n.segs));
      rec.marks = (c.marks || []).map(function (m) { var mn = normOutline(m.outline); return mn.ok ? { kind: m.kind, segs: mn.segs } : null; }).filter(Boolean);
      pieces.push(rec);
    });
    return { pieces: pieces, missing: cand.missing, info: cand.info, excluded: excluded };
  }

  // ── 진입점 ── 매번 새로 파생. 반환은 동결(소비자가 바꿀 수 없다).
  function derive(proj) {
    proj = proj || project();
    var DR = W().designResult;
    if (!proj) return deepFreeze({ state: "no-project", reason: FAIL_TEXT["no-project"] + " — 원형 완료 → «디자인 시작»", returnTab: null });
    if (!DR) return deepFreeze({ state: "no-project", reason: FAIL_TEXT["no-module"], returnTab: null });
    var latest = DR.latest(proj);
    if (!latest) {
      var c0 = DR.check(proj), f0 = c0.ok ? null : c0.fails[0];
      return deepFreeze({ state: "incomplete", fail: f0, returnTab: returnTabOf(f0),
        reason: c0.ok ? "Design 형상 완료 전입니다 — 카라 탭 «Design 형상 완료»를 누르세요" : (FAIL_TEXT[f0] || f0) + " — Design 형상 완료 전" });
    }
    if (DR.isCurrentDesignChanged(proj)) {
      var c1 = DR.check(proj), f1 = c1.ok ? null : c1.fails[0];
      return deepFreeze({ state: "changed", fail: f1, returnTab: returnTabOf(f1), resultHash: latest.hash,
        reason: "Design 이 완료 뒤 바뀌었습니다 · " + (c1.ok ? "카라 탭 «Design 형상 완료»를 다시 누르세요" : (FAIL_TEXT[f1] || f1) + " → 다시 완료 필요") });
    }
    var b = buildPieces(latest), bad = b.pieces.filter(function (p) { return !p.check.ok; }).length;
    return deepFreeze({
      state: "ready", resultHash: latest.hash, completedAt: latest.completedAt || null,
      sourceBlock: { version: latest.sourceBlock ? latest.sourceBlock.version : null },
      pieces: b.pieces, missing: b.missing, excluded: b.excluded, info: b.info, failedPieces: bad,
      previewPartsIgnored: !!(proj.working && Array.isArray(proj.working.parts) && proj.working.parts.length)
    });
  }

  var model = { ringOf: ringOf, derive: derive, candidates: candidates, buildPieces: buildPieces, normOutline: normOutline, paperCheck: paperCheck, FAIL_TEXT: FAIL_TEXT, TAB_LABEL: TAB_LABEL };

  // ══ 화면(읽기 전용 오버레이) ══ ─────────────────────────────────────
  var NS = "http://www.w3.org/2000/svg", GAP = 6;
  var view = { open: false, proj: null, data: null, sel: null, cam: null, layout: null, notice: "" };
  function $(id) { return document.getElementById(id); }
  function el(tag, attrs, text) { var e = document.createElementNS(NS, tag); Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); }); if (text != null) e.textContent = text; return e; }
  function fmt(v) { return (Math.round(v * 10) / 10).toFixed(1); }
  function pathD(segs) {
    if (!segs.length) return "";
    var d = "M" + segs[0].from.x + " " + segs[0].from.y, cur = segs[0].from;
    segs.forEach(function (s) {
      if (Math.hypot(s.from.x - cur.x, s.from.y - cur.y) > 1e-6) d += " M" + s.from.x + " " + s.from.y;
      d += s.kind === "cubic" ? " C" + s.c1.x + " " + s.c1.y + " " + s.c2.x + " " + s.c2.y + " " + s.to.x + " " + s.to.y : " L" + s.to.x + " " + s.to.y;
      cur = s.to;
    });
    return d;
  }
  function stageNow() { return (document.documentElement && document.documentElement.dataset.workspaceStage) || "draft"; }

  // 표시 offset 배치(선반 쌓기) — 조각 좌표는 그대로, transform 만.
  function layoutOf(pieces) {
    var shown = pieces.filter(function (p) { return p.check.ok; }), maxW = shown.reduce(function (m, p) { return Math.max(m, p.widthCm); }, 0);
    var rowW = Math.max(120, maxW), x = 0, y = 0, rowH = 0, pos = {};
    shown.forEach(function (p) {
      if (x > 0 && x + p.widthCm > rowW) { x = 0; y += rowH + GAP + 6; rowH = 0; }
      pos[p.id] = { dx: x - p.bbox.minX, dy: y - p.bbox.minY, x: x, y: y };
      x += p.widthCm + GAP; rowH = Math.max(rowH, p.heightCm);
    });
    var W0 = Math.max(rowW, 10), H0 = y + rowH;
    return { pos: pos, width: W0, height: H0 };
  }
  function fit() {
    var L = view.layout, svg = $("cutCv"); if (!L || !svg) return;
    var r = svg.getBoundingClientRect(), aspect = (r.width > 0 && r.height > 0) ? r.width / r.height : 1.5;
    var pad = 8, w = L.width + pad * 2, h = L.height + pad * 2 + 10;
    if (w / h < aspect) w = h * aspect; else h = w / aspect;
    view.cam = { x: L.width / 2 - w / 2, y: (L.height + 10) / 2 - h / 2, w: w, h: h };
    applyCam();
  }
  function applyCam() { var svg = $("cutCv"), c = view.cam; if (svg && c) svg.setAttribute("viewBox", c.x + " " + c.y + " " + c.w + " " + c.h); }
  function zoom(f, cx, cy) {
    var c = view.cam; if (!c) return;
    var nw = Math.min(Math.max(c.w * f, 8), 2000), k = nw / c.w;
    if (cx == null) { cx = c.x + c.w / 2; cy = c.y + c.h / 2; }
    view.cam = { x: cx - (cx - c.x) * k, y: cy - (cy - c.y) * k, w: nw, h: c.h * k }; applyCam();
  }

  function drawCanvas() {
    var svg = $("cutCv"); if (!svg) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var d = view.data; if (!d || d.state !== "ready") return;
    view.layout = layoutOf(d.pieces);
    d.pieces.forEach(function (p) {
      var pos = view.layout.pos[p.id]; if (!pos) return;
      var g = el("g", { "class": "cut-piece" + (view.sel === p.id ? " is-sel" : ""), "data-piece": p.id, transform: "translate(" + pos.dx + " " + pos.dy + ")" });
      g.appendChild(el("path", { "class": "cut-piece-outline", d: pathD(p.segs) }));
      (p.marks || []).forEach(function (m) { g.appendChild(el("path", { "class": "cut-mark cut-mark-" + m.kind, d: pathD(m.segs) })); });
      var cx = (p.bbox.minX + p.bbox.maxX) / 2, cy = (p.bbox.minY + p.bbox.maxY) / 2, fs = Math.max(1.2, Math.min(2.4, p.widthCm / 9));
      g.appendChild(el("text", { "class": "cut-piece-label", x: cx, y: cy, "font-size": fs }, p.label));
      g.appendChild(el("text", { "class": "cut-piece-size", x: cx, y: cy + fs * 1.15, "font-size": fs * 0.72 }, fmt(p.widthCm) + " × " + fmt(p.heightCm) + " cm"));
      svg.appendChild(g);
    });
    var by = view.layout.height + 6, sb = el("g", { "class": "cut-scale" });
    sb.appendChild(el("path", { d: "M0 " + by + " L10 " + by + " M0 " + (by - 0.6) + " L0 " + (by + 0.6) + " M10 " + (by - 0.6) + " L10 " + (by + 0.6) }));
    sb.appendChild(el("text", { x: 11, y: by + 0.5, "font-size": 1.6 }, "10 cm · 실물 치수(축소·확대는 화면 보기만)"));
    svg.appendChild(sb);
  }

  function li(cls, html) { var e = document.createElement("li"); if (cls) e.className = cls; e.innerHTML = html; return e; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var GROUP_LABEL = { bodice: "몸판", sleeve: "소매·커프스", collar: "카라" };

  function drawList() {
    var box = $("cutList"), st = $("cutStatus"), msg = $("cutBlocked"), d = view.data; if (!box || !d) return;
    box.innerHTML = "";
    if (d.state !== "ready") {
      if (st) { st.textContent = d.state === "changed" ? "변경됨 · 사용 불가" : "재단 준비 전"; st.dataset.state = "blocked"; }
      if (msg) {
        msg.hidden = false;
        $("cutBlockedText").textContent = d.reason + (view.notice ? " · " + view.notice : "");
        var b = $("btnCutReturnTo");
        if (b) { b.hidden = !d.returnTab; b.textContent = d.returnTab ? "디자인 ▸ " + TAB_LABEL[d.returnTab] + "(으)로" : ""; }
      }
      return;
    }
    if (msg) msg.hidden = true;
    if (st) { st.textContent = d.failedPieces ? "검사 실패 " + d.failedPieces + "개" : "조각 " + d.pieces.length + "개 · 시접 전"; st.dataset.state = d.failedPieces ? "warn" : "ok"; }
    ["bodice", "sleeve", "collar"].forEach(function (gk) {
      var ps = d.pieces.filter(function (p) { return p.group === gk; }); if (!ps.length) return;
      var h = document.createElement("li"); h.className = "cut-list-h"; h.textContent = GROUP_LABEL[gk]; box.appendChild(h);
      ps.forEach(function (p) {
        var item = li("cut-item", "");
        var btn = document.createElement("button"); btn.type = "button"; btn.className = "cut-item-btn"; btn.dataset.piece = p.id;
        btn.setAttribute("aria-pressed", String(view.sel === p.id));
        btn.innerHTML = "<span class=\"ci-name\">" + esc(p.label) + "</span>" +
          (p.check.ok ? "<span class=\"ci-size\">" + fmt(p.widthCm) + " × " + fmt(p.heightCm) + " cm · 둘레 " + fmt(p.perimeterCm) + "</span>" +
            "<span class=\"ci-ok\">폐곡선 · 교차 없음</span>"
            : "<span class=\"ci-bad\">표시 보류 — " + esc(p.check.reason) + "</span>") +
          (p.note ? "<span class=\"ci-note\">" + esc(p.note) + "</span>" : "");
        if (!p.check.ok) btn.disabled = true;
        item.appendChild(btn); box.appendChild(item);
      });
    });
    if (d.missing.length) {
      box.appendChild(li("cut-list-h", "아직 재단 조각 아님"));
      d.missing.forEach(function (m) { box.appendChild(li("cut-miss", "<b>" + esc(m.label) + "</b> " + esc(m.reason))); });
    }
    var notes = d.info.concat(d.excluded.map(function (x) { return x.label + ": " + x.reason; }));
    if (d.previewPartsIgnored) notes.push("디자인 화면의 «파트 분리» 미리보기는 완료 패키지에 없어 재단 조각에 넣지 않았습니다");
    if (notes.length) { box.appendChild(li("cut-list-h", "참고")); notes.forEach(function (t) { box.appendChild(li("cut-info", esc(t))); }); }
    var src = $("cutSource");
    if (src) src.textContent = "Design 완료본 #" + d.resultHash + (d.sourceBlock.version != null ? " · 원형 v" + d.sourceBlock.version : "") + " · 재단 화면은 파일에 저장하지 않습니다(파일은 디자인 단계로 열림)";
  }

  function select(id) {
    view.sel = (view.sel === id) ? null : id;
    var svg = $("cutCv");
    if (svg) svg.querySelectorAll(".cut-piece").forEach(function (g) { g.classList.toggle("is-sel", g.getAttribute("data-piece") === view.sel); });
    var box = $("cutList");
    if (box) box.querySelectorAll(".cut-item-btn").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.piece === view.sel)); });
  }

  function setOpenAttr(on) { if (on) document.documentElement.setAttribute("data-cut-view", "open"); else document.documentElement.removeAttribute("data-cut-view"); }
  function syncTabs() {
    if (typeof window.updateContextActions === "function") window.updateContextActions();   // 디자인 탭 aria-selected(ui.js 가 isOpen 을 읽는다)
    var t = $("stageCut"); if (t) t.setAttribute("aria-selected", String(view.open));
  }

  function openView() {
    var ui = window.projectSessionUI, un = ui && ui.unfinished ? ui.unfinished() : [];
    if (un.length) { setNote("재단 열기 전: " + un[0]); return false; }
    if (stageNow() !== "design" && typeof window.setWorkspaceStage === "function") window.setWorkspaceStage("design");
    if (stageNow() !== "design") return false;
    var d = derive(); if (d.state !== "ready") { setNote("재단 준비 불가: " + d.reason); return false; }
    var DLT = window.designLineTool; if (DLT && DLT.getMode && DLT.getMode() !== "off" && DLT.setMode) DLT.setMode("off");
    view.open = true; view.proj = project(); view.data = d; view.notice = ""; view.sel = null;
    var sec = $("cutView"); if (sec) sec.hidden = false;
    setOpenAttr(true); syncTabs();
    drawList(); drawCanvas(); fit(); schedule();   // 안내 문구도 지금 상태로(이전 «다시 열어 닫음» 문구를 남기지 않음)
    return true;
  }
  function closeView() {
    if (!view.open) return;
    view.open = false; view.data = null; view.layout = null; view.proj = null;
    var sec = $("cutView"); if (sec) sec.hidden = true;
    var svg = $("cutCv"); if (svg) while (svg.firstChild) svg.removeChild(svg.firstChild);
    setOpenAttr(false); syncTabs();
    if (typeof window.render === "function") window.render();
  }
  function returnTo(tab) {
    closeView();
    var b = tab && document.querySelector('[data-subtab-btn="' + tab + '"]');
    if (b && !b.disabled) b.click();
  }
  function setNote(t) { var n = $("cutPrepNote"); if (n) n.textContent = t; }

  // 탭·안내 상태 갱신(디자인 갱신 신호마다 · trailing 150ms). 열린 재단 화면은 다시 파생해 즉시 무효화한다.
  var timer = null;
  function schedule() { if (timer) return; timer = setTimeout(tick, 150); }
  function tick() {
    timer = null;
    var DLT = window.designLineTool;
    if (DLT && DLT.isEditDragging && DLT.isEditDragging()) { timer = setTimeout(tick, 150); return; }
    var p = project(), t = $("stageCut");
    if (view.open && p !== view.proj) {   // 프로젝트 열기·교체 → 재단 화면은 저장되지 않으므로 닫고 알린다
      closeView(); view.notice = "프로젝트를 다시 열어 재단 화면을 닫았습니다 — «재단»을 다시 누르세요";
    }
    var d = p ? derive(p) : null;
    var ready = !!(d && d.state === "ready");
    if (t) {
      t.disabled = !ready; if (ready) t.removeAttribute("aria-disabled"); else t.setAttribute("aria-disabled", "true");
      t.title = ready ? "재단 준비(시접 전) — Design 완료본 조각 보기" : (d ? d.reason : "원형 완료 → 디자인 → Design 형상 완료 뒤 사용");
    }
    if (p) setNote(ready ? "재단 준비 가능 — 상단 «재단» · 시접 전 완성선" + (view.notice ? " · " + view.notice : "")
      : "재단 준비 불가: " + d.reason + (d.returnTab ? " (디자인 ▸ " + TAB_LABEL[d.returnTab] + ")" : ""));
    if (view.open) {
      var cur = view.data;
      if (!d || d.state !== "ready" || !cur || cur.resultHash !== d.resultHash) { view.data = d; view.sel = null; drawList(); drawCanvas(); if (d && d.state === "ready") fit(); }
    }
    syncTabs();
  }

  function bindView() {
    var t = $("stageCut"); if (!t) return;
    t.addEventListener("click", function () { if (!t.disabled) { if (view.open) return; openView(); } });
    document.querySelectorAll("[data-stage]").forEach(function (b) { b.addEventListener("click", function () { if (view.open) closeView(); }); });
    var on = function (id, fn) { var e = $(id); if (e) e.addEventListener("click", fn); };
    on("btnCutBack", function () { returnTo(null); });
    on("btnCutReturnTo", function () { returnTo(view.data && view.data.returnTab); });
    on("btnCutFit", fit);
    on("btnCutZoomIn", function () { zoom(1 / 1.25); });
    on("btnCutZoomOut", function () { zoom(1.25); });
    var list = $("cutList");
    if (list) list.addEventListener("click", function (e) { var b = e.target.closest(".cut-item-btn"); if (b && !b.disabled) select(b.dataset.piece); });
    var svg = $("cutCv"); if (!svg) return;
    var drag = null;
    var toCm = function (e) { var r = svg.getBoundingClientRect(), c = view.cam; return { x: c.x + (e.clientX - r.left) / r.width * c.w, y: c.y + (e.clientY - r.top) / r.height * c.h }; };
    svg.addEventListener("pointerdown", function (e) { if (!view.cam) return; drag = { x: e.clientX, y: e.clientY, cam: Object.assign({}, view.cam), moved: false, id: e.pointerId }; });
    svg.addEventListener("pointermove", function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var r = svg.getBoundingClientRect(), dx = (e.clientX - drag.x) / r.width * drag.cam.w, dy = (e.clientY - drag.y) / r.height * drag.cam.h;
      if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 4) return;
      if (!drag.moved) { drag.moved = true; try { svg.setPointerCapture(e.pointerId); } catch (x) { /* 무시 */ } }
      view.cam = { x: drag.cam.x - dx, y: drag.cam.y - dy, w: drag.cam.w, h: drag.cam.h }; applyCam();
    });
    var end = function (e) {
      if (!drag) return;
      if (!drag.moved) { var g = e.target.closest && e.target.closest(".cut-piece"); select(g ? g.getAttribute("data-piece") : view.sel); }
      drag = null;
    };
    svg.addEventListener("pointerup", end); svg.addEventListener("pointercancel", function () { drag = null; });
    svg.addEventListener("wheel", function (e) { if (!view.cam) return; e.preventDefault(); var p = toCm(e); zoom(e.deltaY > 0 ? 1.12 : 1 / 1.12, p.x, p.y); }, { passive: false });
    window.addEventListener("resize", function () { if (view.open) fit(); });
    document.addEventListener("keydown", function (e) { if (view.open && e.key === "Escape") returnTo(null); });
    var sig = $("designResultCheckNote");
    if (sig && typeof MutationObserver !== "undefined") new MutationObserver(schedule).observe(sig, { childList: true, characterData: true, subtree: true });
    if (typeof MutationObserver !== "undefined") new MutationObserver(schedule).observe(document.documentElement, { attributes: true, attributeFilter: ["data-workspace-stage"] });
    schedule();
  }

  W().cutPrep = Object.freeze(Object.assign({}, model, {
    isOpen: function () { return view.open; },
    open: function () { return typeof document !== "undefined" && document.querySelector ? openView() : false; },
    close: function () { if (typeof document !== "undefined" && document.querySelector) closeView(); },
    viewState: function () { return { open: view.open, sel: view.sel, state: view.data && view.data.state, resultHash: view.data && view.data.resultHash, pieces: view.data && view.data.pieces ? view.data.pieces.map(function (p) { return p.id; }) : [] }; }
  }));

  if (typeof document !== "undefined" && document.querySelector && document.addEventListener) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindView); else bindView();
  }
})();
