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
  // ── 앞 여밈·컷온 안단을 앞판과 한 장으로(읽기 전용 · 재단 표시 파생만 · 완료본 무변경) ──
  //   근거 = designPlacket 의 확정 규칙: 앞중심(CF) ─ +여밈분 → 완성 앞단선·접는선 ─ +안단 폭 → 안단 끝(재단선),
  //   윗변·아랫변은 목-CF 점·밑단-CF 점에서 수평 연장. 여기서는 그 영역을 **새로 만들지 않고** 완료본의 placket.outline 을 그대로 쓴다:
  //   앞판 ring 의 앞중심 변(placket 의 공유 경계와 좌표가 같은 것만)을 빼고 placket 의 나머지 세 변으로 바꾼다.
  //   앞중심 변이 placket 과 안 맞으면(나뉜/바뀐 앞판) 합치지 않고 이유만 돌려준다 — 추측해 잇지 않는다.
  //   접힘 검산: 접는선에서 안단을 몸판 쪽으로 접었을 때 안단 윗변·아랫변이 그 자리의 실제 외곽(여밈 윗변 또는 목선/밑단)과
  //   얼마나 어긋나는지 실측한다(안단 ≤ 여밈분이면 여밈 사각형 위라 0). 어긋나도 형상은 확정 규칙 그대로 두고 숫자로만 알린다.
  var PL_EPS = 1e-6, FOLD_TOL = 0.05;
  function composePlacket(ring, placket) {
    var pm = placket && placket.parameters, po = placket && placket.outline;
    if (!pm || !Array.isArray(po) || po.length !== 4 || !po.every(function (s) { return s && s.kind === "line" && s.from && s.to; })) return { ok: false, reason: "여밈 영역 형식을 읽을 수 없습니다" };
    var ov = pm.overlapCm, fc = pm.facingWidthCm;
    if (!(typeof ov === "number" && isFinite(ov) && ov >= 0 && typeof fc === "number" && isFinite(fc) && fc >= 0) || (ov === 0 && fc === 0)) return { ok: false, reason: "여밈·안단 값이 올바르지 않습니다" };
    if (pm.lengthMode && pm.lengthMode !== "full") return { ok: false, reason: "목~밑단 전체 여밈만 합칩니다" };
    var cfX = po[0].from.x, topY = po[0].from.y, cutX = po[0].to.x, botY = po[1].to.y, foldX = cfX + ov;
    if (!allFinite(po) || Math.abs(cutX - (cfX + ov + fc)) > PL_EPS || Math.abs(po[1].from.x - cutX) > PL_EPS || Math.abs(po[2].to.x - cfX) > PL_EPS || Math.abs(po[2].to.y - botY) > PL_EPS || !(botY - topY > PL_EPS))
      return { ok: false, reason: "여밈 영역이 여밈·안단 값과 맞지 않습니다" };
    var isCF = function (s) { return s.kind === "line" && Math.abs(s.from.x - cfX) <= PL_EPS && Math.abs(s.to.x - cfX) <= PL_EPS; };
    var n = ring.length, flags = ring.map(isCF), cnt = flags.filter(Boolean).length;
    if (!cnt || cnt === n) return { ok: false, reason: "이 앞판에는 여밈을 잡았던 앞중심 변이 없습니다(앞중심이 바뀐 앞판)" };
    var st = -1; for (var i = 0; i < n; i++) if (flags[i] && !flags[(i + n - 1) % n]) { if (st >= 0) return { ok: false, reason: "앞중심 변이 한 줄로 이어져 있지 않습니다" }; st = i; }
    var run = [], rest = []; for (var k = 0; k < n; k++) { var sg = ring[(st + k) % n]; (k < cnt ? run : rest).push(sg); }
    var a = run[0].from, z = run[cnt - 1].to, len = 0; run.forEach(function (s) { len += Math.abs(s.to.y - s.from.y); });
    var down = a.y < z.y, top = down ? a : z, bot = down ? z : a;
    if (Math.abs(top.y - topY) > PL_EPS || Math.abs(bot.y - botY) > PL_EPS || Math.abs(len - (botY - topY)) > PL_EPS) return { ok: false, reason: "앞중심 변이 여밈을 잡았던 목~밑단 구간과 다릅니다(여밈 적용 뒤 앞판이 바뀜)" };
    var over = 0; sample(rest, 24).forEach(function (p) { if (p.x - cfX > over) over = p.x - cfX; });
    if (over > PL_EPS) return { ok: false, reason: "앞중심보다 바깥으로 나간 외곽이 있어 여밈을 붙일 수 없습니다(" + r4(over) + "cm)" };
    var d = fc - ov, mirX = cfX + 2 * ov, trimmed = fc > 0 && d > PL_EPS, wa = null, wz = null, segs, facingZone;
    if (!trimmed) {
      var c1 = { x: cutX, y: a.y }, c2 = { x: cutX, y: z.y };
      segs = rest.concat([{ kind: "line", from: pt(a), to: c1 }, { kind: "line", from: pt(c1), to: c2 }, { kind: "line", from: pt(c2), to: pt(z) }]);
      facingZone = fc > 0 ? rectSegs(foldX, cutX, topY, botY) : null;
    } else {
      // 안단 > 여밈분(김님 확정 2026-11-14): 접은 상태에서 목선/밑단에 맞춰 자르고 펼친 모양 = 접는선 기준 반사 복사.
      //   접힌 안단 중 앞중심 안쪽으로 넘어간 폭 d 만큼, 앞중심 점에서 몸판 외곽을 따라가(정확한 line/cubic 분할) 그 구간을 접는선에 대해 뒤집는다.
      //   따라가는 구간이 x 로 한 방향이 아니거나(복수 교차) 폭 d 에 닿기 전에 끝나면 정의할 수 없다 → 거부(선을 늘이지 않는다).
      wa = walkIn(rest.slice().reverse().map(rev), cfX, d); wz = walkIn(rest, cfX, d);
      if (!wa.ok || !wz.ok) return { ok: false, reason: "안단(" + fc + ")이 여밈분(" + ov + ")보다 넓어 접은 안단을 " + (!wa.ok ? (down ? "목선" : "밑단") : (down ? "밑단" : "목선")) + "에 맞춰 자를 수 없습니다 — " + (!wa.ok ? wa.reason : wz.reason) };
      var mir = function (q) { return { x: 2 * foldX - q.x, y: q.y }; }, mseg = function (g) { return g.kind === "cubic" ? { kind: "cubic", from: mir(g.from), c1: mir(g.c1), c2: mir(g.c2), to: mir(g.to) } : { kind: "line", from: mir(g.from), to: mir(g.to) }; };
      var ma = wa.parts.map(mseg), mz = wz.parts.map(mseg), ea = ma[ma.length - 1].to, ez = mz[mz.length - 1].to;
      if (!((down ? ez.y - ea.y : ea.y - ez.y) > PL_EPS)) return { ok: false, reason: "안단이 너무 넓어 목 쪽과 밑단 쪽 자른 선이 서로 만납니다" };
      var edge = ma.concat([{ kind: "line", from: pt(ea), to: pt(ez) }], mz.slice().reverse().map(rev));   // (mirX,a.y) → … → (mirX,z.y)
      var pre = ov > 0 ? [{ kind: "line", from: pt(a), to: { x: mirX, y: a.y } }] : [], post = ov > 0 ? [{ kind: "line", from: { x: mirX, y: z.y }, to: pt(z) }] : [];
      segs = rest.concat(pre, edge, post);
      facingZone = [{ kind: "line", from: { x: foldX, y: a.y }, to: { x: mirX, y: a.y } }].concat(edge, [{ kind: "line", from: { x: mirX, y: z.y }, to: { x: foldX, y: z.y } }, { kind: "line", from: { x: foldX, y: z.y }, to: { x: foldX, y: a.y } }]).filter(function (g) { return Math.hypot(g.to.x - g.from.x, g.to.y - g.from.y) > PL_EPS; });
    }
    var topW = trimmed ? (down ? wa : wz) : null, botW = trimmed ? (down ? wz : wa) : null;
    var fm = fc > 0 ? foldMeasure(segs, foldX) : { ok: false, reason: "안단 0", maxDevCm: null, checked: 0 };
    return { ok: true, segs: segs, info: { overlapCm: ov, facingWidthCm: fc, cfX: cfX, foldX: foldX, cutX: cutX, topY: topY, botY: botY, facingZone: facingZone,
      fold: { applies: fc > 0, ok: fc > 0 && fm.ok, maxDevCm: fm.maxDevCm, checked: fm.checked, reason: fm.ok ? null : fm.reason, trimmed: trimmed, insideCm: trimmed ? r4(d) : 0, neckEndY: topW ? r4(topW.end.y) : null, hemEndY: botW ? r4(botW.end.y) : null } } };
  }
  // 접힘 검산(독립 실측 · 생성 과정을 되풀이하지 않는다): **완성된 외곽만** 보고, 접는선 바깥(안단) 쪽 점을 접는선에 대해 뒤집어
  //   접는선 안쪽 외곽(몸판 목선·밑단·여밈 윗변)까지의 거리를 잰다. 안단 끝(세로 자유단)은 조각 안에 놓이는지만 본다.
  //   잴 점이 없거나 기준 외곽이 없으면 «미검증»(녹색 표시 금지). 허용 편차 = FOLD_TOL.
  function foldMeasure(segs, foldX) {
    var N = 48, dense = segs.map(function (g) { var o = []; for (var k = 0; k <= N; k++) { var t = k / N; o.push(g.kind === "cubic" ? cubicAt(g, t) : { x: g.from.x + (g.to.x - g.from.x) * t, y: g.from.y + (g.to.y - g.from.y) * t }); } return o; });
    var xmax = -Infinity; dense.forEach(function (o) { o.forEach(function (q) { if (q.x > xmax) xmax = q.x; }); });
    if (!(xmax > foldX + PL_EPS)) return { ok: false, reason: "접는선 바깥에 안단이 없습니다", maxDevCm: null, checked: 0 };
    var ref = [], poly = []; dense.forEach(function (o) { for (var k = 0; k < N; k++) { poly.push(o[k]); if (o[k].x <= foldX + PL_EPS && o[k + 1].x <= foldX + PL_EPS) ref.push([o[k], o[k + 1]]); } });
    if (!ref.length) return { ok: false, reason: "접는선 안쪽 기준 외곽이 없습니다", maxDevCm: null, checked: 0 };
    var dseg = function (q, a, b) { var vx = b.x - a.x, vy = b.y - a.y, l2 = vx * vx + vy * vy, t = l2 ? Math.max(0, Math.min(1, ((q.x - a.x) * vx + (q.y - a.y) * vy) / l2)) : 0; return Math.hypot(q.x - a.x - vx * t, q.y - a.y - vy * t); };
    var dref = function (q) { var m = Infinity; for (var i = 0; i < ref.length; i++) { var dd = dseg(q, ref[i][0], ref[i][1]); if (dd < m) m = dd; } return m; };
    var inside = function (q) { var c = false; for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) { var a = poly[i], b = poly[j]; if ((a.y > q.y) !== (b.y > q.y) && q.x < (b.x - a.x) * (q.y - a.y) / (b.y - a.y) + a.x) c = !c; } return c; };
    var worst = 0, n = 0, free = 0, freeBad = 0;
    segs.forEach(function (g, i) {
      var isFree = g.kind === "line" && Math.abs(g.from.x - g.to.x) <= PL_EPS && Math.abs(g.from.x - xmax) <= PL_EPS;
      dense[i].forEach(function (q, k) {
        if (!(q.x > foldX + PL_EPS)) return;
        var m = { x: 2 * foldX - q.x, y: q.y };
        if (isFree) { if (k > 0 && k < N) { free++; if (!inside(m) && dref(m) > FOLD_TOL) freeBad++; } return; }
        var dd = dref(m); n++; if (dd > worst) worst = dd;
      });
    });
    if (!n) return { ok: false, reason: "잴 수 있는 안단 윗끝·아랫끝 점이 없습니다", maxDevCm: null, checked: 0 };
    if (freeBad) return { ok: false, reason: "접은 안단 끝이 조각 밖으로 나갑니다(" + freeBad + "점)", maxDevCm: r4(worst), checked: n };
    if (worst > FOLD_TOL) return { ok: false, reason: "접은 안단 윗끝·아랫끝이 외곽에서 최대 " + r4(worst) + "cm 벗어납니다(허용 " + FOLD_TOL + ")", maxDevCm: r4(worst), checked: n };
    return { ok: true, maxDevCm: r4(worst), checked: n };
  }
  // 앞중심 점에서 외곽을 따라 안쪽으로 폭 d 까지: 걸친 선은 정확히 나눈다(line = 비례 · cubic = de Casteljau, t 는 x 이분법).
  function splitAt(g, t) {
    if (g.kind === "line") return { kind: "line", from: pt(g.from), to: { x: g.from.x + (g.to.x - g.from.x) * t, y: g.from.y + (g.to.y - g.from.y) * t } };
    var L = function (p, q) { return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t }; }, p01 = L(g.from, g.c1), p12 = L(g.c1, g.c2), p23 = L(g.c2, g.to), p012 = L(p01, p12), p123 = L(p12, p23);
    return { kind: "cubic", from: pt(g.from), c1: p01, c2: p012, to: L(p012, p123) };
  }
  function xAt(g, t) { return g.kind === "cubic" ? cubicAt(g, t).x : g.from.x + (g.to.x - g.from.x) * t; }
  //   단조 검사는 **실제로 반사 복사에 쓰는 구간(앞중심 점 → 폭 d 에 처음 닿는 점)** 만 본다. 그 뒤에서 외곽이 되돌아오는 것은 정상 곡선이다.
  //   쓰는 구간 안에서 x 가 되돌아가면(접힌 안단과 여러 번 만남) 거부한다.
  function walkIn(chain, cfX, d) {
    var target = cfX - d, parts = [], N = 64;
    for (var i = 0; i < chain.length; i++) {
      var g = chain[i], prev = xAt(g, 0);
      for (var k = 1; k <= N; k++) {
        var x = xAt(g, k / N);
        if (x <= target + PL_EPS) {   // 폭 d 에 처음 닿음 → 여기서 자른다
          if (k === N && Math.abs(x - target) <= PL_EPS) { parts.push(g); return { ok: true, parts: parts, end: g.to }; }
          var lo = (k - 1) / N, hi = k / N; for (var n = 0; n < 60; n++) { var m = (lo + hi) / 2; if (xAt(g, m) > target) lo = m; else hi = m; }
          var part = splitAt(g, (lo + hi) / 2); parts.push(part); return { ok: true, parts: parts, end: part.to };
        }
        if (x > prev + 1e-9) return { ok: false, reason: "그 구간의 외곽이 한 방향으로 이어지지 않습니다(접힌 안단과 여러 번 만남)" };
        prev = x;
      }
      if (Math.hypot(g.to.x - g.from.x, g.to.y - g.from.y) > PL_EPS) parts.push(g);
    }
    return { ok: false, reason: "외곽이 그 폭에 닿기 전에 끝납니다" };
  }
  function vline(x, y0, y1) { return { kind: "line", from: { x: x, y: y0 }, to: { x: x, y: y1 } }; }
  function rectSegs(x0, x1, y0, y1) { return [{ kind: "line", from: { x: x0, y: y0 }, to: { x: x1, y: y0 } }, vline(x1, y0, y1), { kind: "line", from: { x: x1, y: y1 }, to: { x: x0, y: y1 } }, vline(x0, y1, y0)]; }
  // ── 소매 트임 ④ 덧단(P.91) 재단 조각 — 시접 전 · 읽기 전용 파생 ──
  //   근거: 완성 덧단 윤곽 = designCuff vent.placket(권위). 책에는 완성 치수뿐이라 아래 셋은 김님 확정(2026-11-14):
  //     ① 가위집 길이 = 덧단 길이 − 뾰족 끝 − 고정 박음 칸 1.5(P.91 ④ 도해 «1.5») → 기본 10−1−1.5 = 7.5
  //     ② 앞쪽 덧단 = 한 장 접기 · 양쪽 뾰족: 완성 윤곽을 접는선(세로 가장자리) 기준으로 반사 → 펼친 폭 = 완성 폭 × 2
  //     ③ 뒤쪽 바이어스 = 접어 감싸기: 완성 1(P.91 ④ 단면 «1») → 펼친 폭 2 × 가위집 길이, 가운데 접는선
  //   완성 윤곽이 입력 치수와 어긋나거나 가위집 길이가 0 이하이면 만들지 않는다(사유 반환 · 추측 없음).
  var VENT_BOX_CM = 1.5, VENT_BIAS_CM = 1;
  function c2s(v) { return (Math.round(v * 100) / 100).toString(); }
  function ventPieces(v) {
    var no = function (r) { return { ok: false, reason: r }; };
    var pl = v && v.placket, n = pl && normOutline(pl);
    if (!n || !n.ok || n.segs.length !== 4 || !allFinite(n.segs) || n.segs.some(function (g) { return g.kind !== "line"; })) return no("덧단 완성 윤곽을 읽을 수 없습니다");
    var p0 = n.segs[0].from, p1 = n.segs[0].to, p2 = n.segs[1].to, p3 = n.segs[2].to, p4 = n.segs[3].to, E = 1e-6;
    for (var i = 1; i < 4; i++) if (Math.hypot(n.segs[i].from.x - n.segs[i - 1].to.x, n.segs[i].from.y - n.segs[i - 1].to.y) > E) return no("덧단 완성 윤곽이 이어져 있지 않습니다");
    var w = Math.abs(p4.x - p0.x), len = p0.y - p2.y, tip = p1.y - p2.y;
    if (Math.abs(p1.x - p0.x) > E || Math.abs(p3.x - p4.x) > E || Math.abs(p0.y - p4.y) > E || Math.abs(p1.y - p3.y) > E || Math.abs(p2.x - (p0.x + p4.x) / 2) > E || !(w > E) || !(len > E) || tip < -E)
      return no("덧단 완성 윤곽이 «세로 두 변 + 가운데 뾰족 끝» 모양이 아닙니다");
    if (Math.abs(w - v.placketWidthCm) > E || Math.abs(len - v.lengthCm) > E || Math.abs(tip - v.tipCm) > E) return no("덧단 완성 윤곽이 입력 치수(폭·길이·끝)와 다릅니다");
    var slitCm = len - tip - VENT_BOX_CM;
    if (!(slitCm > E)) return no("가위집 길이를 정할 수 없습니다 — 덧단 길이 " + c2s(len) + " − 끝 " + c2s(tip) + " − 박음 칸 " + c2s(VENT_BOX_CM) + " 이 0 이하");
    var fx = p4.x, mx = function (p) { return { x: 2 * fx - p.x, y: p.y }; }, ln = function (a, b) { return { kind: "line", from: { x: a.x, y: a.y }, to: { x: b.x, y: b.y } }; };
    var q2 = mx(p2), q1 = mx(p1), q0 = mx(p0);
    var bw = VENT_BIAS_CM * 2;
    return {
      ok: true, slitCm: slitCm,
      finished: n.segs.concat([ln(p4, p0)]),
      slit: ln(p0, { x: p0.x, y: p0.y - slitCm }),
      placket: { outline: [ln(p0, p1), ln(p1, p2), ln(p2, p3), ln(p3, q2), ln(q2, q1), ln(q1, q0), ln(q0, p0)], fold: ln(p3, p4),
        info: { kind: "placket", finishedWidthCm: w, openWidthCm: 2 * w, lengthCm: len, tipCm: tip, slitCm: slitCm, boxCm: VENT_BOX_CM, foldX: fx } },
      bias: { outline: rectSegs(0, bw, 0, slitCm), fold: vline(VENT_BIAS_CM, 0, slitCm),
        info: { kind: "bias", finishedWidthCm: VENT_BIAS_CM, openWidthCm: bw, lengthCm: slitCm, slitCm: slitCm, foldX: VENT_BIAS_CM } }
    };
  }
  // 합친 앞판 위 표시: 연장 영역 2칸(여밈분·안단) + 앞중심선 + 접는선. 안단 끝선은 외곽 자체.
  function placketMarks(q) {
    var m = [];
    if (q.overlapCm > 0) m.push({ kind: "zone-overlap", segs: rectSegs(q.cfX, q.foldX, q.topY, q.botY) });
    if (q.facingZone) m.push({ kind: "zone-facing", segs: q.facingZone });
    m.push({ kind: "cf", segs: [vline(q.cfX, q.topY, q.botY)], label: "앞중심 · 단추선" });
    if (q.overlapCm > 0 && q.facingWidthCm > 0) m.push({ kind: "fold", segs: [vline(q.foldX, q.topY, q.botY)], label: "완성 앞단 · 접는선" });
    return m;
  }

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
      // 소매 Ⓡ~Ⓩ 엔진은 여밈 붙은 몸판을 받지 않는다(bodice-not-a) — 이 조합은 실제 엔진이 만들지 않는 경로라 합성 근거가 없다.
      if (b && b.placket) missing.push({ id: "placket", label: "앞 여밈·컷온 안단", reason: "소매와 함께 제도한 파생 몸판에는 여밈·안단을 합치지 않습니다 — 디자인 엔진이 만들지 않는 조합이라 확인된 근거가 없음" });
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
        if (!modes) out.forEach(function (c) { if (c.id === "front") c.placket = b.placket; });   // 나뉘지 않은 앞판 한 장 = 합성 대상(buildPieces)
        else {
          missing.push({ id: "placket", label: "앞 여밈·컷온 안단", reason: "여밈 " + b.placket.parameters.overlapCm + " · 안단 " + b.placket.parameters.facingWidthCm + "cm — 나뉜 앞판(요크·프린세스·페플럼)은 앞중심이 여러 조각에 걸쳐 있어 아직 한 장으로 합치지 않습니다" + (peplum ? " — 앞판 위에 점선으로만 표시" : "") });
          if (peplum) out.forEach(function (c) { if (c.id === "front") c.marks = [{ kind: "placket", outline: b.placket.outline }]; });
        }
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
      add("sleeve", "sleeve-" + nm, SLEEVE_PIECE_LABEL[nm] || "소매", "designResult.sleeve.geometry", g.outline, { note: nm === "sleeve" && Array.isArray(g.pieces) ? "앞·뒤를 맞댄 한 장" : null, construction: g.construction,
        edgeNames: (s.origin && s.origin.presetId === "bunka-sleeve-A" && g.outline.length === 4) ? SLEEVE_A_EDGES : null });   // 소매 Ⓐ 외곽 순서 계약 [소매산, 뒤 옆선, 앞 옆선, 소맷부리]
    } else if (g.sleevePiece === false) info.push("소매 조각 없음 — 몸판 일체형 소매" + (sym ? "(" + sym + ")" : "") + "라 소매는 몸판 조각 안에 있습니다");
    else missing.push({ id: "sleeve", label: "소매", reason: "소매 외곽이 비어 있습니다" });
    if (s && s.cuff && s.cuff.piece) {
      add("sleeve", "cuff", "커프스", "designResult.sleeve.cuff.piece", s.cuff.piece.outline);
      if (s.cuff.vent) {
        var vp = ventPieces(s.cuff.vent), sl = out.filter(function (p) { return p.group === "sleeve" && p.id !== "cuff"; });
        if (vp.ok && sl.length === 1) {
          add("sleeve", "vent-placket", "소매 트임 덧단(앞쪽)", "designResult.sleeve.cuff.vent.placket → 접는선 반사", vp.placket.outline,
            { vent: vp.placket.info, marks: [{ kind: "fold", outline: [vp.placket.fold], label: "접는선" }] });
          add("sleeve", "vent-bias", "소매 트임 바이어스(뒤쪽)", "designResult.sleeve.cuff.vent(가위집 길이)", vp.bias.outline,
            { vent: vp.bias.info, marks: [{ kind: "fold", outline: [vp.bias.fold], label: "접는선" }] });
          (sl[0].marks = sl[0].marks || []).push({ kind: "vent-placket", outline: vp.finished }, { kind: "vent-slit", outline: [vp.slit], label: "가위집 " + c2s(vp.slitCm) });
        } else missing.push({ id: "sleeve-vent", label: "소매 트임 덧단", reason: "재단 조각을 만들지 못했습니다 — " + (vp.ok ? "소매가 한 장이 아니라 트임 자리를 정할 수 없습니다" : vp.reason) });
      }
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
  function buildPieces(R, withEdges) {
    var cand = candidates(R), pieces = [], seenRef = [], seenHash = {}, sameShape = [], excluded = [], missing = cand.missing.slice();
    cand.pieces.forEach(function (c) {
      if (c.outline && seenRef.indexOf(c.outline) >= 0) { excluded.push({ id: c.id, label: c.label, reason: "같은 외곽을 가리키는 중복 — 한 번만 표시" }); return; }
      if (c.outline) seenRef.push(c.outline);
      var n = normOutline(c.outline);
      var rec = { id: c.id, label: c.label, group: c.group, source: c.source, note: c.note || null };
      if (c.vent) rec.vent = c.vent;
      if (!n.ok) { rec.check = { ok: false, reason: n.reason }; rec.segs = []; pieces.push(rec); return; }
      var ring = ringOf(n.segs, c.construction);
      if (!ring.ok) { rec.check = { ok: false, reason: ring.reason }; rec.segs = []; pieces.push(rec); return; }
      n.segs = ring.segs; rec.dartLegs = ring.legs;
      var marks = (c.marks || []).map(function (m) { var mn = normOutline(m.outline); return mn.ok ? (m.label ? { kind: m.kind, segs: mn.segs, label: m.label } : { kind: m.kind, segs: mn.segs }) : null; }).filter(Boolean);
      if (c.placket) {
        var pc = composePlacket(n.segs, c.placket), pchk = pc.ok ? paperCheck(pc.segs) : null, w0 = measure(n.segs).widthCm;
        if (pc.ok && pchk.ok) {
          n.segs = pc.segs; rec.placket = Object.assign({ widthBeforeCm: w0 }, pc.info); rec.label = c.label + "(여밈·안단 포함)";
          marks = marks.concat(placketMarks(pc.info));
        } else {
          var why = pc.ok ? pchk.reason : pc.reason, pn = normOutline(c.placket.outline);
          missing.push({ id: "placket", label: "앞 여밈·컷온 안단", reason: "앞판과 한 장으로 합치지 못했습니다 — " + why + " · 앞판은 여밈 없는 완성선 그대로" + (pn.ok ? " · 여밈 자리는 점선" : "") });
          if (pn.ok) marks.push({ kind: "placket", segs: pn.segs });
        }
      }
      // 같은 형상이라고 조각을 빼지 않는다(2026-11-15 야간 리뷰 #1): 용도가 다른 같은 모양 조각이 조용히 사라지면 안 된다.
      //   빼는 것은 «같은 외곽 객체를 가리키는 별칭»(위 seenRef)뿐. 형상 일치는 짧은 hash 가 아니라 정규화 원문 전체로 비교하고, 사실만 참고로 적는다.
      var cn = canon(n.segs), h = hashStr(cn);
      if (seenHash[cn]) sameShape.push("«" + c.label + "»과 «" + seenHash[cn] + "»은 형상이 같지만 서로 다른 조각이라 둘 다 표시합니다");
      else seenHash[cn] = c.label;
      rec.segs = n.segs; rec.hash = h; rec.check = paperCheck(n.segs);
      Object.assign(rec, measure(n.segs));
      rec.marks = marks;
      if (withEdges) rec.edges = edgesOf(rec, c, n.segs);
      pieces.push(rec);
    });
    return { pieces: pieces, missing: missing, info: cand.info.concat(sameShape), excluded: excluded };
  }

  // ══ 시접(2026-11-14) ══ 변 이름·고정 ID · 설정 소유권(working.cutSpec) · 순수 기하(js/seamAllowance.js)
  //   · 완료본·조각 완성선은 읽기만 한다. 설정은 working.cutSpec 한 곳에만 쓰고, 조각/변 ID + 형상 서명으로 연결한다.
  //   · 변 이름은 완료본 선의 의미(edge·role·part·다트)에서 **형상 일치로** 되찾는다 — 추측해 붙이지 않는다. 못 찾은 선이 있으면 «조각 전체 한 값».
  //   · 골선 가능 = 뒤판 뒤중심(직선) · 카라 뒤중심(cb-fold). 내부 접는선·가위집·부착선은 외곽 변이 아니라서 대상이 아니다.
  var SEAM_DEFAULT_CM = 1, SEAM_MAX_CM = 10;
  var SLEEVE_A_EDGES = ["cap", "back-seam", "front-seam", "hem"];
  var EDGE_NAME = { neckline: "목둘레", shoulder: "어깨", armhole: "진동", "side-seam": "옆선", hem: "밑단", waist: "허리", center: "중심",
    "placket-top": "여밈 윗변", "facing-edge": "안단 끝", cap: "소매산", "back-seam": "뒤 소매 옆선", "front-seam": "앞 소매 옆선",
    "attach-edge": "소매에 다는 변", "end-overlap": "겹침 쪽 끝", "outer-edge": "바깥 변", "end-plain": "반대쪽 끝",
    "neck-seam": "목둘레에 다는 선", extension: "여밈분 아래", cf: "앞 끝", "top-extension": "여밈분 위", top: "윗변(칼라 다는 선)", "cb-fold": "뒤중심",
    attach: "밴드에 다는 선", "point-front": "칼라 끝", outer: "칼라 바깥선", all: "조각 전체" };
  var DART_VERTICAL = { shoulder: 1, waist: 1, neckline: 1, hem: 1 };   // 중심 쪽 다리가 분명한 다트(세로 다트) → 중심 쪽 조각이 위 겹
  var DART_DOWN = { armhole: 1 };   // 진동 가슴 다트(김님 확정 2026-11-15): 봉제 후 아래쪽·허리 방향으로 눕힌다 → 아래쪽 조각이 위 겹. 옆선 다트 등은 답이 없어 정하지 않는다.
  var LABEL_TOL = 2e-3;   // 폐곡선 구성(designLineTool.buildPieceRing)이 끝점을 1e-3 안에서 맞붙이므로 그만큼 허용
  function sameSeg(a, b) {
    if (a.kind !== b.kind) return false;
    var pa = segPts(a), pb = segPts(b), fw = true, bw = true;
    for (var i = 0; i < pa.length; i++) { if (Math.hypot(pa[i].x - pb[i].x, pa[i].y - pb[i].y) > LABEL_TOL) fw = false; var q = pb[pb.length - 1 - i]; if (Math.hypot(pa[i].x - q.x, pa[i].y - q.y) > LABEL_TOL) bw = false; }
    return fw || bw;
  }
  function edgesOf(rec, c, segs) {
    var n = segs.length, src = [], centerX = null, i;
    (c.outline || []).forEach(function (s, k) {
      var lab = (c.edgeNames && c.edgeNames[k]) || (s && (s.edge || s.role || s.part)) || null, ns = normSeg(s) || [];
      if (s && s.edge === "center" && s.kind === "line" && Math.abs(s.from.x - s.to.x) < 1e-9) centerX = s.from.x;
      ns.forEach(function (g) { src.push({ g: g, v: { lab: lab, root: s && s.boundary && typeof s.boundary.root === "string" ? s.boundary.root : null } }); });
    });
    (c.construction || []).forEach(function (s) { if (s && s.kind === "line" && s.dart && s.dart.id && s.from && s.to) { src.push({ g: { kind: "line", from: s.from, to: s.to }, v: { dart: s.dart } }); } });
    var it = segs.map(function (g) {   // 외곽 선의 이름이 먼저(같은 자리에 겹친 다트 보조선보다) · 이름이 하나로 정해질 때만
      var m = src.filter(function (x) { return sameSeg(g, x.g); }), o = m.filter(function (x) { return x.v.lab; }), dd = m.filter(function (x) { return x.v.dart; });
      if (o.length) return o.every(function (x) { return x.v.lab === o[0].v.lab; }) ? o[0].v : null;
      return dd.length === 1 ? dd[0].v : null;
    });
    if (rec.placket) {   // 합성으로 새로 생긴 선(여밈 윗변 · 안단 끝 · 밑단 연장) — 합성 결과의 자리로만 이름 붙인다
      var q = rec.placket, un = []; for (i = 0; i < n; i++) if (!it[i] && Math.min(segs[i].from.x, segs[i].to.x) >= q.cfX - 1e-6) un.push(i);
      var vi = -1; un.forEach(function (k) { var g = segs[k]; if (g.kind === "line" && Math.abs(g.from.x - g.to.x) < 1e-9 && Math.abs(g.from.x - q.cutX) < 1e-6) vi = k; });
      if (vi >= 0) un.forEach(function (k) {
        if (k === vi) { it[k] = { lab: "facing-edge" }; return; }
        var my = (segs[k].from.y + segs[k].to.y) / 2; it[k] = { lab: Math.abs(my - q.topY) < Math.abs(my - q.botY) ? "placket-top" : "hem" };
      });
    }
    var whole = function (why) {
      var darts = [];
      for (var k = 0; k < n; k++) { var a = it[k], b = it[(k + 1) % n]; if (a && b && a.dart && b.dart && a.dart.id === b.dart.id) darts.push(dartOf(k)); }
      var ix = []; for (var j = 0; j < n; j++) ix.push(j);
      return [mk("all", "all", ix, darts, false, why)];
    };
    function dartOf(k) {
      var d = it[k].dart, mA = segs[k].from, mB = segs[(k + 1) % n].to, top = null;
      if (DART_VERTICAL[d.boundary] && centerX != null && Math.abs(Math.abs(mA.x - centerX) - Math.abs(mB.x - centerX)) > 1e-6) top = Math.abs(mA.x - centerX) < Math.abs(mB.x - centerX);
      else if (DART_DOWN[d.boundary] && Math.abs(mA.y - mB.y) > 1e-6) top = mA.y > mB.y;   // 도안 y 는 아래(밑단)로 갈수록 크다
      return { legs: [k, (k + 1) % n], id: d.id, boundary: d.boundary || null, topFirst: top };
    }
    function mk(id, lab, ix, darts, positional, wholeWhy) {
      var es = ix.map(function (k) { return segs[k]; }), straight = es.every(function (g) { return g.kind === "line"; });
      if (straight) { var d0 = { x: es[0].to.x - es[0].from.x, y: es[0].to.y - es[0].from.y }; straight = es.every(function (g) { return Math.abs(d0.x * (g.to.y - g.from.y) - d0.y * (g.to.x - g.from.x)) < 1e-7; }); }
      var foldable = !darts.length && straight && (lab === "cb-fold" || (lab === "center" && rec.group === "bodice" && /^back/.test(rec.id)));
      var name = lab === "center" ? (/^back/.test(rec.id) ? "뒤중심" : "앞중심") : (EDGE_NAME[lab] || lab);
      var e = { id: id, label: lab, name: name, segs: ix, darts: darts, positional: !!positional, foldCapable: foldable, defaultKind: foldable ? "fold" : "seam", sig: hashStr(canon(es)) };
      if (wholeWhy) { e.whole = true; e.wholeReason = wholeWhy; }
      return e;
    }
    for (i = 0; i < n; i++) if (!it[i]) return whole("변 이름을 알 수 없는 선이 있어 구간별로 나누지 않았습니다");
    var tag = new Array(n), dartAt = {};
    for (i = 0; i < n; i++) if (!it[i].dart) tag[i] = it[i].lab;
    for (i = 0; i < n; i++) {
      if (!it[i].dart || tag[i]) continue;
      var j = (i + 1) % n, p = (i + n - 1) % n, nx = (i + 2) % n;
      if (it[p].dart) continue;   // 두 번째 다리(앞 다리에서 처리)
      if (!(it[j].dart && it[j].dart.id === it[i].dart.id && !it[p].dart && !it[nx].dart && it[p].lab && it[p].lab === it[nx].lab)) return whole("다트 양옆 변을 한 변으로 묶을 수 없어 구간별로 나누지 않았습니다");
      tag[i] = tag[j] = it[p].lab; dartAt[i] = dartOf(i);
    }
    for (i = 0; i < n; i++) if (!tag[i]) return whole("변 이름이 없는 선이 있어 구간별로 나누지 않았습니다");
    var st = -1; for (i = 0; i < n; i++) if (tag[i] !== tag[(i + n - 1) % n]) { st = i; break; }
    var runs = [];
    if (st < 0) { var ixa = [], da = []; for (i = 0; i < n; i++) { ixa.push(i); if (dartAt[i]) da.push(dartAt[i]); } runs.push({ lab: tag[0], ix: ixa, darts: da }); }
    else for (var k = 0; k < n; k++) { var id = (st + k) % n, last = runs[runs.length - 1]; if (!last || last.lab !== tag[id]) { last = { lab: tag[id], ix: [], darts: [] }; runs.push(last); } last.ix.push(id); if (dartAt[id]) last.darts.push(dartAt[id]); }
    var count = {}; runs.forEach(function (r) { count[r.lab] = (count[r.lab] || 0) + 1; });
    var seen = {}, used = {};
    return runs.map(function (r) {
      if (count[r.lab] === 1) return mk(r.lab, r.lab, r.ix, r.darts, false);
      var root = it[r.ix[0]].root, tail = root ? root.split("/").pop() : null, id1 = tail ? r.lab + "@" + tail : null;
      if (id1 && !used[id1]) { used[id1] = 1; return mk(id1, r.lab, r.ix, r.darts, false); }
      seen[r.lab] = (seen[r.lab] || 0) + 1;
      return mk(r.lab + "#" + seen[r.lab], r.lab, r.ix, r.darts, true);   // 순서로만 구분되는 변 — 형상 서명이 같을 때만 설정을 잇는다
    });
  }

  // 저장된 설정 읽기 — 엄격 검증(모르는 키·유한하지 않은 폭·모르는 종류 = 통째로 «읽을 수 없음», 고쳐 쓰지 않는다)
  function readSpec(proj) {
    var s = proj && proj.working ? proj.working.cutSpec : null, none = { state: "none", defaultCm: SEAM_DEFAULT_CM, edges: {} };
    if (s == null) return none;
    var bad = function (r) { return { state: "invalid", reason: r, defaultCm: SEAM_DEFAULT_CM, edges: {} }; };
    if (typeof s !== "object" || Array.isArray(s)) return bad("형식이 객체가 아닙니다");
    if (Object.keys(s).sort().join(",") !== "defaultCm,edges,schema") return bad("모르는 항목이 있습니다");
    if (s.schema !== 1) return bad("모르는 판(schema " + s.schema + ")입니다");
    if (s.defaultCm !== SEAM_DEFAULT_CM) return bad("기본 폭 " + s.defaultCm + " 은 지원하지 않습니다");
    if (!s.edges || typeof s.edges !== "object" || Array.isArray(s.edges)) return bad("변 목록 형식 오류");
    var ks = Object.keys(s.edges);
    for (var i = 0; i < ks.length; i++) {
      var e = s.edges[ks[i]];
      if (!/^[^|]+\|[^|]+$/.test(ks[i]) || !e || typeof e !== "object" || Array.isArray(e)) return bad("변 항목 형식 오류(" + ks[i] + ")");
      if (!Object.keys(e).every(function (k) { return k === "kind" || k === "widthCm" || k === "sig" || k === "label"; })) return bad("변 항목에 모르는 키(" + ks[i] + ")");
      if (typeof e.sig !== "string" || typeof e.label !== "string") return bad("변 항목 서명·이름 누락(" + ks[i] + ")");
      if (e.kind !== undefined && e.kind !== "fold" && e.kind !== "seam") return bad("모르는 변 종류(" + ks[i] + ")");
      if (e.widthCm !== undefined && !(typeof e.widthCm === "number" && isFinite(e.widthCm) && e.widthCm >= 0 && e.widthCm <= SEAM_MAX_CM)) return bad("폭이 0~" + SEAM_MAX_CM + "cm 숫자가 아닙니다(" + ks[i] + ")");
      if (e.kind === undefined && e.widthCm === undefined) return bad("값이 없는 변 항목(" + ks[i] + ")");
    }
    return { state: "ok", defaultCm: SEAM_DEFAULT_CM, edges: s.edges };
  }
  function edgeKey(pieceId, edgeId) { return pieceId + "|" + edgeId; }
  // 한 변의 현재 값. explicit = 사용자가 직접 지정한 값(저장됨) / 아니면 형태별 자동값(골선 0 · 그 밖 1cm)
  function resolveEdge(piece, edge, sp) {
    var ent = sp.edges[edgeKey(piece.id, edge.id)], auto = { kind: edge.defaultKind, widthCm: edge.defaultKind === "fold" ? 0 : sp.defaultCm, explicit: false };
    if (!ent) return auto;
    if (edge.positional && ent.sig !== edge.sig) return Object.assign(auto, { orphan: "변 모양이 바뀌어 같은 변인지 알 수 없습니다" });
    if (ent.kind === "fold" && !edge.foldCapable) return Object.assign(auto, { orphan: "이 변은 지금 골선이 될 수 없습니다" });
    var kind = edge.foldCapable ? (ent.kind || edge.defaultKind) : "seam";
    return { kind: kind, widthCm: kind === "fold" ? 0 : (typeof ent.widthCm === "number" ? ent.widthCm : sp.defaultCm), explicit: true, keptWidthCm: typeof ent.widthCm === "number" ? ent.widthCm : null };
  }
  // 시접 모델(읽기 전용 파생). d = derive(proj, true) 결과.
  function seamOf(d, proj) {
    var SA = W().seamAllowance, sp = readSpec(proj || project()), out = { state: "ready", spec: { state: sp.state, reason: sp.reason || null }, pieces: {}, orphans: [], done: 0, total: 0 };
    if (!d || d.state !== "ready") { out.state = "blocked"; return out; }
    if (!SA) { out.state = "no-module"; return out; }
    var hit = {};
    d.pieces.forEach(function (p) {
      if (!p.check.ok || !p.edges) return;
      out.total++;
      var es = p.edges.map(function (e) { var r = resolveEdge(p, e, sp); if (!r.orphan && sp.edges[edgeKey(p.id, e.id)]) hit[edgeKey(p.id, e.id)] = 1; return Object.assign({ id: e.id, name: e.name, foldCapable: e.foldCapable, whole: !!e.whole, wholeReason: e.wholeReason || null, dartCount: e.darts.length }, r); });
      var res = SA.build({ ring: p.segs, edges: p.edges.map(function (e, k) { return { id: e.id, segs: e.segs, widthCm: es[k].widthCm, darts: e.darts.map(function (x) { return { legs: x.legs, topFirst: x.topFirst }; }) }; }) });
      if (res.ok) out.done++;
      out.pieces[p.id] = { edges: es, ok: res.ok, points: res.points, edgePaths: res.edgePaths, refusals: res.refusals, darts: res.darts, stats: res.stats };
    });
    Object.keys(sp.edges).forEach(function (k) {
      if (hit[k]) return;
      var ent = sp.edges[k], pid = k.split("|")[0], eid = k.split("|")[1], pc = d.pieces.filter(function (p) { return p.id === pid; })[0], ed = pc && pc.edges && pc.edges.filter(function (e) { return e.id === eid; })[0];
      var why = !pc ? "이 조각이 지금 재단 조각에 없습니다" : !ed ? "이 변이 지금 조각에 없습니다" : (ed.positional && ent.sig !== ed.sig) ? "변 모양이 바뀌어 같은 변인지 알 수 없습니다" : "이 변은 지금 골선이 될 수 없습니다";
      out.orphans.push({ key: k, label: ent.label, kind: ent.kind || null, widthCm: typeof ent.widthCm === "number" ? ent.widthCm : null, why: why });
    });
    return out;
  }
  // 사용자 지정 쓰기 — working.cutSpec 에만 쓴다(완료본·디자인 hash 와 무관). 성공해야 쓴다.
  function setEdge(pieceId, edgeId, val, proj) {
    proj = proj || project();
    var d = derive(proj, true); if (d.state !== "ready") return { ok: false, reason: d.reason };
    var sp = readSpec(proj); if (sp.state === "invalid") return { ok: false, reason: "저장된 시접 설정을 읽을 수 없어 고치지 않습니다 — " + sp.reason };
    var pc = d.pieces.filter(function (p) { return p.id === pieceId; })[0], ed = pc && pc.edges && pc.edges.filter(function (e) { return e.id === edgeId; })[0];
    if (!ed) return { ok: false, reason: "이 변을 찾을 수 없습니다" };
    var kind = val && val.kind ? val.kind : (ed.foldCapable ? null : "seam");
    if (kind !== "fold" && kind !== "seam") return { ok: false, reason: "골선인지 봉제선인지 정해 주세요" };
    if (kind === "fold" && !ed.foldCapable) return { ok: false, reason: "이 변은 골선으로 둘 수 없습니다" };
    var w = val ? val.widthCm : undefined;
    if (kind === "seam" && !(typeof w === "number" && isFinite(w) && w >= 0 && w <= SEAM_MAX_CM)) return { ok: false, reason: "폭은 0~" + SEAM_MAX_CM + "cm 숫자로 적어 주세요" };
    if (!proj.working.cutSpec) proj.working.cutSpec = { schema: 1, defaultCm: SEAM_DEFAULT_CM, edges: {} };
    var key = edgeKey(pieceId, edgeId), prev = proj.working.cutSpec.edges[key], ent = {};
    if (ed.foldCapable) ent.kind = kind;
    if (kind === "seam") ent.widthCm = r4(w); else if (prev && typeof prev.widthCm === "number") ent.widthCm = prev.widthCm;   // 골선으로 바꿔도 전에 적은 폭은 남긴다
    ent.sig = ed.sig; ent.label = pc.label + " · " + ed.name;
    proj.working.cutSpec.edges[key] = ent;
    return { ok: true, key: key };
  }
  function clearOrphans(proj) {
    proj = proj || project();
    var d = derive(proj, true), sp = readSpec(proj); if (d.state !== "ready" || sp.state !== "ok") return { ok: false, removed: 0 };
    var o = seamOf(d, proj).orphans; o.forEach(function (x) { delete proj.working.cutSpec.edges[x.key]; });
    return { ok: true, removed: o.length };
  }

  // ── 진입점 ── 매번 새로 파생. 반환은 동결(소비자가 바꿀 수 없다).
  // 가벼운 상태 확인(조각을 만들지 않는다) — 탭 활성·안내용. derive 와 같은 판정·같은 문구.
  function peek(proj) {
    var d = gate(proj || project());
    return d.latest ? deepFreeze({ state: "ready", resultHash: d.latest.hash }) : d;
  }
  function derive(proj, withEdges) {
    var d = gate(proj || project()); if (!d.latest) return d;
    var latest = d.latest, b = buildPieces(latest, !!withEdges), bad = b.pieces.filter(function (p) { return !p.check.ok; }).length;
    proj = proj || project();
    return deepFreeze({
      state: "ready", resultHash: latest.hash, completedAt: latest.completedAt || null,
      sourceBlock: { version: latest.sourceBlock ? latest.sourceBlock.version : null },
      pieces: b.pieces, missing: b.missing, excluded: b.excluded, info: b.info, failedPieces: bad,
      previewPartsIgnored: !!(proj.working && Array.isArray(proj.working.parts) && proj.working.parts.length)
    });
  }
  function gate(proj) {
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
    return { latest: latest };
  }

  var model = { peek: peek, foldMeasure: foldMeasure, edgesOf: edgesOf, readSpec: readSpec, seam: seamOf, setEdge: setEdge, clearOrphans: clearOrphans, SEAM_DEFAULT_CM: SEAM_DEFAULT_CM, ventPieces: ventPieces, composePlacket: composePlacket, ringOf: ringOf, derive: derive, candidates: candidates, buildPieces: buildPieces, normOutline: normOutline, paperCheck: paperCheck, FAIL_TEXT: FAIL_TEXT, TAB_LABEL: TAB_LABEL };

  // ══ 화면(읽기 전용 오버레이) ══ ─────────────────────────────────────
  var NS = "http://www.w3.org/2000/svg", GAP = 6;
  var view = { open: false, proj: null, data: null, sel: null, cam: null, layout: null, notice: "", seam: null, edge: null, cardMsg: "" };
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
  function polyD(pts, close) { return pts.map(function (q, i) { return (i ? "L" : "M") + q.x + " " + q.y; }).join(" ") + (close ? " Z" : ""); }
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
  function applyCam() { var svg = $("cutCv"), c = view.cam; if (svg && c) svg.setAttribute("viewBox", c.x + " " + c.y + " " + c.w + " " + c.h); sizeLabels(); }
  // 기준선 이름 글자 크기: 화면에서 약 LABEL_PX 로 보이게(축소해도 읽히게) 하되, 실물 0.78cm 보다 작아지지 않고 이웃 기준선과 겹치지 않는 상한까지만.
  var LABEL_CM = 0.78, LABEL_PX = 10, LABEL_CAP_CM = 2.4;
  function sizeLabels() {
    var svg = $("cutCv"), c = view.cam; if (!svg || !c || !svg.querySelectorAll) return;
    var r = svg.getBoundingClientRect(); if (!(r.width > 0)) return;
    var want = LABEL_PX * c.w / r.width;
    svg.querySelectorAll("text[data-cap]").forEach(function (t) { t.setAttribute("font-size", Math.max(LABEL_CM, Math.min(want, Number(t.getAttribute("data-cap"))))); });
  }
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
      var sm = view.seam && view.seam.pieces[p.id];
      if (sm && sm.ok) g.appendChild(el("path", { "class": "cut-seam", d: polyD(sm.points, true) }));
      g.appendChild(el("path", { "class": "cut-piece-outline", d: pathD(p.segs) }));
      if (sm && !sm.ok) Object.keys(sm.edgePaths).forEach(function (k) { g.appendChild(el("path", { "class": "cut-seam cut-seam-part", d: polyD(sm.edgePaths[k], false) })); });
      (p.marks || []).forEach(function (m) { g.appendChild(el("path", { "class": (m.kind.indexOf("zone-") === 0 ? "cut-zone cut-" : "cut-mark cut-mark-") + m.kind, d: pathD(m.segs) + (m.kind.indexOf("zone-") === 0 ? " Z" : "") })); });
      (p.marks || []).forEach(function (m, i) {   // 세로 기준선 이름(선 옆 · 세로쓰기 방향 · 서로 높이를 달리해 겹치지 않게)
        if (!m.label) return; var s0 = m.segs[0], ly = s0.from.y + (s0.to.y - s0.from.y) * (m.kind === "cf" ? 0.3 : 0.62), lx = s0.from.x - 0.22;
        var cap = m.kind === "fold" ? (p.placket ? p.placket.overlapCm : p.vent ? p.vent.finishedWidthCm : 0) : 0;   // 왼쪽 이웃 기준선까지의 거리(겹침 방지 상한)
        g.appendChild(el("text", { "class": "cut-mark-label cut-mark-label-" + m.kind, x: lx, y: ly, "font-size": LABEL_CM, "data-cap": cap > 0 ? Math.max(LABEL_CM, cap * 0.8) : LABEL_CAP_CM, transform: "rotate(-90 " + lx + " " + ly + ")" }, m.label));
      });
      if (p.placket && p.placket.facingWidthCm > 0) { var ex = p.placket.cutX + 0.75, ey = p.placket.topY + (p.placket.botY - p.placket.topY) * 0.46;
        g.appendChild(el("text", { "class": "cut-mark-label", x: ex, y: ey, "font-size": 0.78, transform: "rotate(-90 " + ex + " " + ey + ")" }, "안단 끝(외곽)")); }
      var cx = (p.bbox.minX + p.bbox.maxX) / 2, cy = (p.bbox.minY + p.bbox.maxY) / 2, fs = Math.max(1.2, Math.min(2.4, p.widthCm / 9));
      g.appendChild(el("text", { "class": "cut-piece-label", x: cx, y: cy, "font-size": fs }, p.label));
      g.appendChild(el("text", { "class": "cut-piece-size", x: cx, y: cy + fs * 1.15, "font-size": fs * 0.72 }, fmt(p.widthCm) + " × " + fmt(p.heightCm) + " cm"));
      if (sm && p.edges) p.edges.forEach(function (e, k) {   // 변: 골선 표시 · 선택 강조 · 누르는 자리(맨 위)
        var se = sm.edges[k], ed = pathD(e.segs.map(function (ix) { return p.segs[ix]; })), on = view.edge && view.edge.piece === p.id && view.edge.id === e.id;
        if (se.kind === "fold") { g.appendChild(el("path", { "class": "cut-edge-fold", d: ed }));
          var a = p.segs[e.segs[0]].from, z = p.segs[e.segs[e.segs.length - 1]].to, mx = (a.x + z.x) / 2, my = (a.y + z.y) / 2, vert = Math.abs(a.x - z.x) < Math.abs(a.y - z.y);
          g.appendChild(el("text", { "class": "cut-mark-label cut-edge-fold-label", x: mx, y: my, "font-size": LABEL_CM, "data-cap": LABEL_CAP_CM, transform: vert ? "rotate(-90 " + mx + " " + my + ") translate(0 -0.3)" : "translate(0 -0.3)" }, "골선")); }
        if (on) g.appendChild(el("path", { "class": "cut-edge-sel", d: ed }));
        g.appendChild(el("path", { "class": "cut-edge-hit", "data-edge": e.id, d: ed }));
      });
      svg.appendChild(g);
    });
    var by = view.layout.height + 6, sb = el("g", { "class": "cut-scale" });
    sb.appendChild(el("path", { d: "M0 " + by + " L10 " + by + " M0 " + (by - 0.6) + " L0 " + (by + 0.6) + " M10 " + (by - 0.6) + " L10 " + (by + 0.6) }));
    sb.appendChild(el("text", { x: 11, y: by + 0.5, "font-size": 1.6 }, "10 cm · 실물 치수(축소·확대는 화면 보기만)"));
    svg.appendChild(sb);
    sizeLabels();
  }

  function li(cls, html) { var e = document.createElement("li"); if (cls) e.className = cls; e.innerHTML = html; return e; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var GROUP_LABEL = { bodice: "몸판", sleeve: "소매·커프스", collar: "카라" };

  // 합친 앞판 설명: 폭 전후 · 세 기준선 · 접힘 검산(숫자 그대로) · 목둘레 길이와 무관함
  function placketHtml(p) {
    var q = p.placket, f = q.fold, c2 = function (v) { return (Math.round(v * 100) / 100).toString(); }, t = "";
    t += "<span class=\"ci-pl\">여밈 " + c2(q.overlapCm) + " + 안단 " + c2(q.facingWidthCm) + " cm 를 앞중심 밖으로 붙임 · 폭 " + fmt(q.widthBeforeCm) + " → " + fmt(p.widthCm) + " cm</span>";
    t += "<span class=\"ci-legend\"><span class=\"lg-i\"><i class=\"lg lg-cf\"></i>앞중심(단추선)</span>" + (q.overlapCm > 0 && q.facingWidthCm > 0 ? "<span class=\"lg-i\"><i class=\"lg lg-fold\"></i>완성 앞단 = 접는선</span>" : "") + "<span class=\"lg-i\"><i class=\"lg lg-edge\"></i>" + (q.facingWidthCm > 0 ? "안단 끝 = 외곽" : "완성 앞단 = 외곽") + "</span></span>";
    if (!f.applies) t += "<span class=\"ci-note\">안단 0 — 접는선 없음(앞단 처리는 이 조각에 없습니다)</span>";
    else if (!f.ok) t += "<span class=\"ci-bad\">접힘 미검증 — " + esc(f.reason || "잴 수 없음") + "</span>";
    else if (!f.trimmed) t += "<span class=\"ci-ok\">접힘 실측: 접는선에서 접은 안단 윗끝·아랫끝 ↔ 목·밑단 외곽 최대 편차 " + c2(f.maxDevCm) + "cm (" + f.checked + "점)</span>";
    else t += "<span class=\"ci-ok\">안단이 여밈분보다 " + c2(f.insideCm) + "cm 넓음 → 접은 상태에서 목선·밑단에 맞춰 자른 모양 · 접힘 실측 최대 편차 " + c2(f.maxDevCm) + "cm (" + f.checked + "점)</span>";
    t += "<span class=\"ci-note\">여밈 윗변은 목둘레 봉제 길이에 들어가지 않습니다(목둘레는 앞중심까지 — 맞춤 길이 카드 값 그대로)</span>";
    return t;
  }

  function ventHtml(p) {
    var q = p.vent, t = "";
    if (q.kind === "placket") {
      t += "<span class=\"ci-pl\">완성 폭 " + c2s(q.finishedWidthCm) + " × 길이 " + c2s(q.lengthCm) + "(끝 " + c2s(q.tipCm) + ") 을 접는선에서 펼친 한 장 · 펼친 폭 " + c2s(q.openWidthCm) + " cm</span>";
      t += "<span class=\"ci-legend\"><span class=\"lg-i\"><i class=\"lg lg-fold\"></i>접는선</span><span class=\"lg-i\"><i class=\"lg lg-edge\"></i>외곽 = 완성선</span></span>";
      t += "<span class=\"ci-ok\">접힘 검산: 접으면 겉·안이 완성 덧단 윤곽과 일치(양쪽 뾰족)</span>";
      t += "<span class=\"ci-note\">가위집 " + c2s(q.slitCm) + " = 길이 − 끝 − 박음 칸 " + c2s(q.boxCm) + "(P.91 ④ · 김님 확정) · 소매 한 쪽당 1장</span>";
    } else {
      t += "<span class=\"ci-pl\">완성 폭 " + c2s(q.finishedWidthCm) + " 을 접어 감싸는 한 장 · 펼친 폭 " + c2s(q.openWidthCm) + " × 가위집 길이 " + c2s(q.lengthCm) + " cm</span>";
      t += "<span class=\"ci-legend\"><span class=\"lg-i\"><i class=\"lg lg-fold\"></i>접는선</span><span class=\"lg-i\"><i class=\"lg lg-edge\"></i>외곽 = 완성선</span></span>";
      t += "<span class=\"ci-note\">바이어스 방향으로 재단(식서 표시는 다음 단계) · 소매 한 쪽당 1장</span>";
    }
    return t;
  }

  function seamHtml(p) {
    var sm = view.seam && view.seam.pieces[p.id]; if (!sm) return "";
    var ex = sm.edges.filter(function (e) { return e.explicit; }).length, t = "";
    if (sm.ok) t += "<span class=\"ci-ok\">시접 완료 · " + (ex ? "직접 지정 " + ex + "곳" : "기본값(1cm · 골선 0)") + "</span>";
    else t += "<span class=\"ci-bad\">시접 미완 — " + esc(sm.refusals.map(function (r) { var nm = r.edgeIds.map(function (id) { var e = sm.edges.filter(function (x) { return x.id === id; })[0]; return e ? e.name : id; }).join("·"); return (nm ? nm + ": " : "") + r.reason; }).join(" / ")) + "</span>";
    if (sm.edges.length === 1 && sm.edges[0].whole) t += "<span class=\"ci-note\">" + esc(sm.edges[0].wholeReason) + " — 조각 전체 한 값</span>";
    sm.darts.forEach(function (q) { t += "<span class=\"ci-note\">다트 시접: " + (/armhole/.test(q.edgeId) ? "아래(허리) 쪽으로 눕혀" : "중심 쪽 겹이 위로 오게") + " 접은 모양" + (q.legMismatchCm > 0.005 ? " · 다트 두 다리 길이 차 " + c2s(q.legMismatchCm) + "cm 는 고치지 않음(맞춤 = 패턴 확정 단계)" : "") + "</span>"; });
    return t;
  }
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
    if (st) { st.textContent = d.failedPieces ? "검사 실패 " + d.failedPieces + "개" : "조각 " + d.pieces.length + "개" + (view.seam && view.seam.state === "ready" ? " · 시접 " + view.seam.done + "/" + view.seam.total : ""); st.dataset.state = d.failedPieces || (view.seam && view.seam.done < view.seam.total) ? "warn" : "ok"; }
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
          (p.note ? "<span class=\"ci-note\">" + esc(p.note) + "</span>" : "") + (p.check.ok && p.placket ? placketHtml(p) : "") + (p.check.ok && p.vent ? ventHtml(p) : "") + (p.check.ok ? seamHtml(p) : "");
        if (!p.check.ok) btn.disabled = true;
        item.appendChild(btn); box.appendChild(item);
      });
    });
    if (d.missing.length) {
      box.appendChild(li("cut-list-h", "아직 재단 조각 아님"));
      d.missing.forEach(function (m) { box.appendChild(li("cut-miss", "<b>" + esc(m.label) + "</b> " + esc(m.reason))); });
    }
    var sv = view.seam;
    if (sv && sv.spec.state === "invalid") box.appendChild(li("cut-miss", "<b>저장된 시접 설정을 읽을 수 없습니다</b> " + esc(sv.spec.reason) + " — 기본값으로 표시하고, 저장된 값은 고치지 않았습니다(수정 잠김)"));
    if (sv && sv.orphans.length) {
      box.appendChild(li("cut-list-h", "연결이 끊긴 시접 설정 " + sv.orphans.length + "개"));
      sv.orphans.forEach(function (o) { box.appendChild(li("cut-miss", "<b>" + esc(o.label) + "</b> " + (o.kind === "fold" ? "골선" : (o.widthCm != null ? c2s(o.widthCm) + "cm" : "")) + " — " + esc(o.why) + " · 다른 변에 자동으로 옮기지 않았습니다(해당 선을 눌러 다시 지정)")); });
      var ob = li("cut-item", ""), bb = document.createElement("button"); bb.type = "button"; bb.className = "btn"; bb.dataset.act = "clear-orphans"; bb.textContent = "끊긴 설정 지우기"; ob.appendChild(bb); box.appendChild(ob);
    }
    var notes = d.info.concat(d.excluded.map(function (x) { return x.label + ": " + x.reason; }));
    if (d.previewPartsIgnored) notes.push("디자인 화면의 «파트 분리» 미리보기는 완료 패키지에 없어 재단 조각에 넣지 않았습니다");
    if (notes.length) { box.appendChild(li("cut-list-h", "참고")); notes.forEach(function (t) { box.appendChild(li("cut-info", esc(t))); }); }
    var src = $("cutSource");
    if (src) src.textContent = "Design 완료본 #" + d.resultHash + (d.sourceBlock.version != null ? " · 원형 v" + d.sourceBlock.version : "") + " · 시접 설정은 프로젝트 파일을 저장할 때 함께 저장됩니다(자동 저장 아님 · 파일은 디자인 단계로 열림)";
  }

  function select(id) {
    view.sel = (view.sel === id) ? null : id;
    var svg = $("cutCv");
    if (svg) svg.querySelectorAll(".cut-piece").forEach(function (g) { g.classList.toggle("is-sel", g.getAttribute("data-piece") === view.sel); });
    var box = $("cutList");
    if (box) box.querySelectorAll(".cut-item-btn").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.piece === view.sel)); });
  }

  function curEdge() {
    var ed = view.edge, d = view.data, sv = view.seam; if (!ed || !d || d.state !== "ready" || !sv) return null;
    var p = d.pieces.filter(function (x) { return x.id === ed.piece; })[0], sm = sv.pieces[ed.piece]; if (!p || !sm) return null;
    var e = sm.edges.filter(function (x) { return x.id === ed.id; })[0]; return e ? { piece: p, sm: sm, e: e } : null;
  }
  function syncCard() {
    var card = $("cutSeamCard"); if (!card) return;
    var c = curEdge(); if (!c) { card.hidden = true; view.edge = null; return; }
    card.hidden = false;
    var e = c.e, kw = $("cutSeamKindWrap"), ks = $("cutSeamKind"), wi = $("cutSeamWidth"), ap = $("btnCutSeamApply"), locked = view.seam.spec.state === "invalid";
    $("cutSeamName").textContent = c.piece.label + " · " + e.name;
    kw.hidden = !e.foldCapable; ks.value = e.kind;
    wi.value = e.kind === "fold" ? "0" : String(e.widthCm); wi.disabled = e.kind === "fold" || locked; ks.disabled = locked; ap.disabled = locked;
    card.dataset.kept = e.keptWidthCm != null ? String(e.keptWidthCm) : String(SEAM_DEFAULT_CM);
    var why = c.sm.refusals.filter(function (r) { return !r.edgeIds.length || r.edgeIds.indexOf(e.id) >= 0; }).map(function (r) { return r.reason; });
    var parts = [e.explicit ? "직접 지정한 값" : (e.kind === "fold" ? "기본값(골선 0)" : "기본값(" + c2s(e.widthCm) + "cm)")];
    if (e.whole) parts.push(e.wholeReason);
    if (why.length) parts.push("시접 미완: " + why.join(" / "));
    if (locked) parts.push("저장된 시접 설정을 읽을 수 없어 수정이 잠겼습니다");
    if (view.cardMsg) parts.push(view.cardMsg);
    $("cutSeamMsg").textContent = parts.join(" · ");
    card.dataset.state = why.length || locked ? "warn" : "ok";
  }
  function selectEdge(pid, eid) {
    view.edge = { piece: pid, id: eid }; view.sel = pid; view.cardMsg = "";
    drawCanvas(); var box = $("cutList"); if (box) box.querySelectorAll(".cut-item-btn").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.piece === view.sel)); });
    syncCard();
  }
  function clearEdge() { if (!view.edge) return; view.edge = null; view.cardMsg = ""; drawCanvas(); syncCard(); }
  function reseam(msg) { view.seam = seamOf(view.data, view.proj); view.cardMsg = msg || ""; drawList(); drawCanvas(); syncCard(); }
  function applyEdge() {
    var c = curEdge(); if (!c) return;
    var kind = c.e.foldCapable ? $("cutSeamKind").value : "seam", raw = $("cutSeamWidth").value, w = raw === "" ? NaN : Number(raw);
    var r = setEdge(view.edge.piece, view.edge.id, { kind: kind, widthCm: w }, view.proj);
    if (!r.ok) { view.cardMsg = "적용 안 됨: " + r.reason; syncCard(); return; }
    reseam("적용됨 — 프로젝트 파일을 저장해야 파일에 남습니다");
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
    var d = derive(null, true); if (d.state !== "ready") { setNote("재단 준비 불가: " + d.reason); return false; }
    var DLT = window.designLineTool; if (DLT && DLT.getMode && DLT.getMode() !== "off" && DLT.setMode) DLT.setMode("off");
    view.open = true; view.proj = project(); view.data = d; view.notice = ""; view.sel = null; view.edge = null; view.cardMsg = ""; view.seam = seamOf(d, view.proj);
    var sec = $("cutView"); if (sec) sec.hidden = false;
    setOpenAttr(true); syncTabs();
    drawList(); drawCanvas(); fit(); syncCard(); schedule();   // 안내 문구도 지금 상태로(이전 «다시 열어 닫음» 문구를 남기지 않음)
    return true;
  }
  function closeView() {
    if (!view.open) return;
    view.open = false; view.data = null; view.layout = null; view.proj = null; view.seam = null; view.edge = null;
    var card = $("cutSeamCard"); if (card) card.hidden = true;
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
    var d = p ? peek(p) : null;   // 탭·안내는 상태만 본다 — 조각 계산은 화면을 열 때와 열린 화면의 완료본이 바뀔 때만
    var ready = !!(d && d.state === "ready");
    if (t) {
      t.disabled = !ready; if (ready) t.removeAttribute("aria-disabled"); else t.setAttribute("aria-disabled", "true");
      t.title = ready ? "재단 준비 — Design 완료본 조각 · 시접" : (d ? d.reason : "원형 완료 → 디자인 → Design 형상 완료 뒤 사용");
    }
    if (p) setNote(ready ? "재단 준비 가능 — 상단 «재단» · 완성선과 시접" + (view.notice ? " · " + view.notice : "")
      : "재단 준비 불가: " + d.reason + (d.returnTab ? " (디자인 ▸ " + TAB_LABEL[d.returnTab] + ")" : ""));
    if (view.open) {
      var cur = view.data;
      if (!d || d.state !== "ready" || !cur || cur.resultHash !== d.resultHash) {
        view.data = (d && d.state === "ready") ? derive(p, true) : d; view.sel = null; view.edge = null; view.cardMsg = ""; view.seam = (d && d.state === "ready") ? seamOf(view.data, p) : null;
        drawList(); drawCanvas(); syncCard(); if (d && d.state === "ready") fit(); }
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
    if (list) list.addEventListener("click", function (e) {
      var o = e.target.closest("[data-act=\"clear-orphans\"]"); if (o) { var cr = clearOrphans(view.proj); reseam(cr.ok ? "" : ""); return; }
      var b = e.target.closest(".cut-item-btn"); if (b && !b.disabled) { clearEdge(); select(b.dataset.piece); }
    });
    on("btnCutSeamApply", applyEdge);
    on("btnCutSeamClose", clearEdge);
    var ksel = $("cutSeamKind"); if (ksel) ksel.addEventListener("change", function () { var wi = $("cutSeamWidth"), card = $("cutSeamCard"), fold = ksel.value === "fold"; wi.disabled = fold; wi.value = fold ? "0" : card.dataset.kept; });
    var win = $("cutSeamWidth"); if (win) win.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); applyEdge(); } });
    var svg = $("cutCv"); if (!svg) return;
    var drag = null;
    var toCm = function (e) { var r = svg.getBoundingClientRect(), c = view.cam; return { x: c.x + (e.clientX - r.left) / r.width * c.w, y: c.y + (e.clientY - r.top) / r.height * c.h }; };
    // 두 손가락(2026-11-15): 가운데가 움직이면 이동, 벌리면 확대 — 시작할 때 두 손가락 가운데 아래 있던 실물 점이 계속 가운데 아래에 있도록.
    //   두 번째 손가락이 닿으면 한 손가락 끌기·누르기는 취소한다(선택이 잘못 눌리지 않게). 캔버스는 touch-action:none 이라 브라우저 확대는 일어나지 않는다.
    var pts = {}, pinch = null;
    var two = function () { var k = Object.keys(pts); return k.length === 2 ? [pts[k[0]], pts[k[1]]] : null; };
    svg.addEventListener("pointerdown", function (e) {
      if (!view.cam) return;
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      var t = two();
      if (t) { drag = null; pinch = { d: Math.max(1, Math.hypot(t[0].x - t[1].x, t[0].y - t[1].y)), cx: (t[0].x + t[1].x) / 2, cy: (t[0].y + t[1].y) / 2, cam: Object.assign({}, view.cam) }; return; }
      if (Object.keys(pts).length > 2) { drag = null; pinch = null; return; }
      drag = { x: e.clientX, y: e.clientY, cam: Object.assign({}, view.cam), moved: false, id: e.pointerId };
    });
    svg.addEventListener("pointermove", function (e) {
      if (pts[e.pointerId]) pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      var t = pinch && two();
      if (t) {
        var rr = svg.getBoundingClientRect(), c0 = pinch.cam, dn = Math.max(1, Math.hypot(t[0].x - t[1].x, t[0].y - t[1].y)), cx = (t[0].x + t[1].x) / 2, cy = (t[0].y + t[1].y) / 2;
        var nw = Math.min(Math.max(c0.w * pinch.d / dn, 8), 2000), k = nw / c0.w, nh = c0.h * k;
        var ax = c0.x + (pinch.cx - rr.left) / rr.width * c0.w, ay = c0.y + (pinch.cy - rr.top) / rr.height * c0.h;
        view.cam = { x: ax - (cx - rr.left) / rr.width * nw, y: ay - (cy - rr.top) / rr.height * nh, w: nw, h: nh }; applyCam();
        return;
      }
      if (!drag || e.pointerId !== drag.id) return;
      var r = svg.getBoundingClientRect(), dx = (e.clientX - drag.x) / r.width * drag.cam.w, dy = (e.clientY - drag.y) / r.height * drag.cam.h;
      if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 4) return;
      if (!drag.moved) { drag.moved = true; try { svg.setPointerCapture(e.pointerId); } catch (x) { /* 무시 */ } }
      view.cam = { x: drag.cam.x - dx, y: drag.cam.y - dy, w: drag.cam.w, h: drag.cam.h }; applyCam();
    });
    var end = function (e) {
      delete pts[e.pointerId]; if (pinch) { pinch = null; drag = null; return; }
      if (!drag) return;
      if (!drag.moved) {
        var g = e.target.closest && e.target.closest(".cut-piece"), h = e.target.closest && e.target.closest("[data-edge]");
        if (g && h) selectEdge(g.getAttribute("data-piece"), h.getAttribute("data-edge"));
        else { clearEdge(); select(g ? g.getAttribute("data-piece") : view.sel); }
      }
      drag = null;
    };
    svg.addEventListener("pointerup", end); svg.addEventListener("pointercancel", function (e) { delete pts[e.pointerId]; pinch = null; drag = null; });
    // 캔버스 밖에서 손가락을 떼면 캔버스는 pointerup 을 못 받는다 → 그 손가락이 «눌린 채» 남아 다음 핀치·탭이 먹히지 않는다(2026-11-15 실측 재현).
    //   화면 어디서 떼든 받아 정리한다. 캔버스 안에서 뗀 것은 위 end 가 처리하므로 건드리지 않는다.
    var lift = function (e) {
      if (!pts[e.pointerId] || (e.target && svg.contains(e.target))) return;
      delete pts[e.pointerId];
      if (drag && drag.id === e.pointerId) drag = null;
      if (!Object.keys(pts).length) { pinch = null; drag = null; }
    };
    window.addEventListener("pointerup", lift, true); window.addEventListener("pointercancel", lift, true);
    svg.addEventListener("wheel", function (e) { if (!view.cam) return; e.preventDefault(); var p = toCm(e); zoom(e.deltaY > 0 ? 1.12 : 1 / 1.12, p.x, p.y); }, { passive: false });
    window.addEventListener("resize", function () { if (view.open) fit(); });
    document.addEventListener("keydown", function (e) { if (view.open && e.key === "Escape") { if (view.edge) clearEdge(); else returnTo(null); } });
    var sig = $("designResultCheckNote");
    if (sig && typeof MutationObserver !== "undefined") new MutationObserver(schedule).observe(sig, { childList: true, characterData: true, subtree: true });
    if (typeof MutationObserver !== "undefined") new MutationObserver(schedule).observe(document.documentElement, { attributes: true, attributeFilter: ["data-workspace-stage"] });
    schedule();
  }

  W().cutPrep = Object.freeze(Object.assign({}, model, {
    isOpen: function () { return view.open; },
    open: function () { return typeof document !== "undefined" && document.querySelector ? openView() : false; },
    close: function () { if (typeof document !== "undefined" && document.querySelector) closeView(); },
    viewState: function () { return { open: view.open, sel: view.sel, edge: view.edge ? view.edge.piece + "|" + view.edge.id : null, seam: view.seam ? view.seam.done + "/" + view.seam.total : null, state: view.data && view.data.state, resultHash: view.data && view.data.resultHash, pieces: view.data && view.data.pieces ? view.data.pieces.map(function (p) { return p.id; }) : [] }; }
  }));

  if (typeof document !== "undefined" && document.querySelector && document.addEventListener) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindView); else bindView();
  }
})();
