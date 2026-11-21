// ══════════════════════════════════════════════
// js/cutPrep.js — 재단 준비 1단계(2026-11-13 김님 승인 «순서대로 작업 이어가자»).
//
// 무엇: 유효한 Design 완료본(designResult)에서 **읽기 전용으로** 재단 조각 목록·외곽을 파생해 보여 준다.
//   ★ (처음 단계 기록) 시접 전 — 완성선(봉제선) 그대로. 이후 시접·너치·수량·식서가 차례로 붙었다(아래 각 절). 배치 최적화·출력은 아직 없다.
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
    "no-collar": "카라 모양 완료 전입니다(카라를 달지 않으면 카라 종류 «카라 없음» 적용)", "collar-changed": "카라가 완료 뒤 바뀌었습니다",
    "collar-bodice-mismatch": "카라가 지금 몸판이 아니라 예전 몸판 기준입니다", "collar-source-mismatch": "카라가 지금 몸판이 아니라 예전 몸판 기준입니다",
    "collar-sleeve-order": "소매를 다시 완료한 뒤 카라도 다시 완료해야 합니다",
    "cut-invalid-on-final-bodice": "절개선 일부가 최종 몸판에서 유효하지 않습니다",
    "pocket-invalid": "앞 주머니가 최종 몸판 위에서 유효하지 않습니다"
  };
  var TAB_LABEL = { body: "몸판", sleeve: "소매", collar: "카라", detail: "디테일" };
  function returnTabOf(fail) {
    if (!fail) return "collar";
    if (fail === "pocket-invalid") return "detail";
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
    if (!c) { if (R.collarChoice !== "none") missing.push({ id: "collar", label: "카라", reason: "완료본에 카라가 없습니다" }); }   // 명시 «카라 없음» = 누락 아님
    else if (!map) missing.push({ id: "collar", label: "카라", reason: "이 카라 종류(" + c.type + ")는 재단 준비에서 아직 읽지 않습니다" });
    else map.forEach(function (m) {
      var part = c[m[0]];
      if (!part || !part.geometry) { if (!(c.type === "shirt-two-piece" && m[0] === "body")) missing.push({ id: "collar-" + m[0], label: m[1], reason: "완료본에 이 조각 형상이 없습니다" }); return; }
      add("collar", "collar-" + m[0], m[1], "designResult.collar." + m[0] + ".geometry", part.geometry.outline,
        { note: c.symmetry === "half-cb-fold" ? "뒤중심 접힘 반쪽(펼치기 전)" : null });
    });

    // 디테일 — 셔츠 앞 주머니(오각 패치 1장 · designResult.pocket 이 있을 때만). 독립 조각 + 해당 앞판 위 달림선(비재단 표시).
    //   입구 접어박기 분량 = 앱 초깃값(교재 수치 아님 · 설정에서 조정). 다른 변은 기존 시접 규칙.
    if (R.pocket) {
      var DPk = W().designPocket, pm = DPk && DPk.cutModel ? DPk.cutModel(R.pocket, R) : { ok: false, reason: "주머니 모듈이 준비되지 않았습니다" };
      var frontC = out.filter(function (p) { return p.group === "bodice" && p.id === "front"; })[0];
      if (!pm.ok) missing.push({ id: "pocket", label: "앞 주머니", reason: "재단 조각을 만들지 못했습니다 — " + pm.reason });
      else if (!frontC) missing.push({ id: "pocket", label: "앞 주머니", reason: "나뉘지 않은 앞판 한 장이 없어 주머니를 달 앞판을 정할 수 없습니다" });
      else {
        add("detail", "pocket", "앞 주머니(오각 패치)", "designResult.pocket → [패턴학교] P.100 ③ 오각 패치(폭·높이·밑각) + 앱 입구 접어박기", pm.outline,
          { note: "입구 접어박기 " + c2s(pm.mouthFoldCm) + "cm = 앱 초깃값(교재 수치 아님) · 착용자 " + (pm.side === "left" ? "왼쪽" : "오른쪽") + " 앞판에 부착",
            pocket: { side: pm.side, mouthFoldCm: pm.mouthFoldCm, widthCm: pm.info.widthCm, heightCm: pm.info.heightCm, tipDepthCm: pm.info.tipDepthCm },
            marks: [{ kind: "pocket-fold", outline: [pm.fold], label: "입구 접는선" }] });
        (frontC.marks = frontC.marks || []).push({ kind: "pocket-attach", outline: pm.attach, label: "주머니 달림선(재단 아님)", side: pm.side });
      }
    }

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
      if (c.pocket) rec.pocket = c.pocket;
      if (!n.ok) { rec.check = { ok: false, reason: n.reason }; rec.segs = []; pieces.push(rec); return; }
      var ring = ringOf(n.segs, c.construction);
      if (!ring.ok) { rec.check = { ok: false, reason: ring.reason }; rec.segs = []; pieces.push(rec); return; }
      n.segs = ring.segs; rec.dartLegs = ring.legs;
      var marks = (c.marks || []).map(function (m) { var mn = normOutline(m.outline); if (!mn.ok) return null; var mo = m.label ? { kind: m.kind, segs: mn.segs, label: m.label } : { kind: m.kind, segs: mn.segs }; if (m.side) mo.side = m.side; return mo; }).filter(Boolean);
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
      if (withEdges) {
        rec.edges = edgesOf(rec, c, n.segs);
        if (rec.pocket) rec.edges.forEach(function (e) { if (e.label === "mouth") e.defaultWidthCm = rec.pocket.mouthFoldCm; });   // 입구 접어박기 = 설정값이 이 변의 기본 시접 폭(직접 지정하면 그 값이 우선)
      }
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
    attach: "밴드에 다는 선", "point-front": "칼라 끝", outer: "칼라 바깥선", all: "조각 전체",
    mouth: "입구(접어박기)", "pocket-side-r": "주머니 오른 옆", "pocket-side-l": "주머니 왼 옆", "pocket-bottom-r": "주머니 오른 아래 사선", "pocket-bottom-l": "주머니 왼 아래 사선" };
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
      var e = { roots: ix.map(function (k) { return it[k] && it[k].root || null; }), id: id, label: lab, name: name, segs: ix, darts: darts, positional: !!positional, foldCapable: foldable, defaultKind: foldable ? "fold" : "seam", sig: hashStr(canon(es)) };
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
    var dw = typeof edge.defaultWidthCm === "number" ? edge.defaultWidthCm : sp.defaultCm;   // 변 자체 기본 폭(주머니 입구 접어박기 등) · 없으면 공통 기본 1cm
    var ent = sp.edges[edgeKey(piece.id, edge.id)], auto = { kind: edge.defaultKind, widthCm: edge.defaultKind === "fold" ? 0 : dw, explicit: false };
    if (!ent) return auto;
    if (edge.positional && ent.sig !== edge.sig) return Object.assign(auto, { orphan: "변 모양이 바뀌어 같은 변인지 알 수 없습니다" });
    if (ent.kind === "fold" && !edge.foldCapable) return Object.assign(auto, { orphan: "이 변은 지금 골선이 될 수 없습니다" });
    var kind = edge.foldCapable ? (ent.kind || edge.defaultKind) : "seam";
    return { kind: kind, widthCm: kind === "fold" ? 0 : (typeof ent.widthCm === "number" ? ent.widthCm : dw), explicit: true, keptWidthCm: typeof ent.widthCm === "number" ? ent.widthCm : null };
  }
  // ══ 다트 입구 정리 — working.cutDart 판 1 (2026-11-16 master 확정 · 지원 대상 한정) ══
  //   지원: 앞판(front) 진동 다트 · 뒤판(back) 어깨 다트 **뿐**. 그 밖(허리·옆선·곡선 어깨·요크/프린세스 조각의 다트)은 예전 방식 그대로(오적용 금지).
  //   방식: up-extend = 위(어깨)로 접고 아래 겹 진동선을 입구 너머로 곧게 이어 정리 · down-legacy = 아래(허리)로 눕혀 그대로 본뜸(2026-11-15 방식)
  //         center-chord = 중심 쪽 윗겹으로 접고 목옆점~어깨끝을 직선으로 정리 · center-legacy = 중심 쪽 윗겹 · 그대로 본뜸.
  //   **working.cutDart 가 없는 프로젝트(이전에 만든·저장한 것) = 전부 예전 방식**(결과를 조용히 바꾸지 않는다). 새 프로젝트는 만들 때 { schema:1, darts:{} } 가 들어가 기본 = up-extend · center-chord.
  //   항목 = 고친 다트만 { "조각id|다트id": { mode } }. 예전 프로젝트에서 한 다트를 고치면 나머지 지원 다트는 예전 방식으로 **명시해 고정**한다.
  var DART_MODES = { ah: ["up-extend", "down-legacy"], sh: ["center-chord", "center-legacy"] };
  var DART_MODE_LABEL = { "up-extend": "위(어깨)로 접어 입구 정리 — 아래 겹 진동선을 곧게 연장", "down-legacy": "아래(허리)로 눕혀 그대로 본뜸(예전 방식)", "center-chord": "중심 쪽 윗겹 · 목옆점~어깨끝 직선으로 정리", "center-legacy": "중심 쪽 윗겹 · 그대로 본뜸(예전 방식)" };
  var DART_KEY = /^[a-z][a-z0-9-]{0,39}\|[A-Za-z0-9][A-Za-z0-9_.:#-]{0,79}$/;
  function dartKind(p, d) { return !p || !d ? null : p.id === "front" && d.boundary === "armhole" ? "ah" : p.id === "back" && d.boundary === "shoulder" ? "sh" : null; }
  function readDart(proj) {
    var s = proj && proj.working ? proj.working.cutDart : null;
    if (s == null) return { state: "none", darts: {} };
    var bad = function (r) { return { state: "invalid", reason: r, darts: {} }; };
    if (typeof s !== "object" || Array.isArray(s) || Object.keys(s).sort().join(",") !== "darts,schema") return bad("형식 오류(schema·darts 만 허용)");
    if (s.schema !== 1) return bad("모르는 판(schema " + s.schema + ")");
    if (!s.darts || typeof s.darts !== "object" || Array.isArray(s.darts)) return bad("다트 목록 형식 오류");
    var ks = Object.keys(s.darts);
    for (var i = 0; i < ks.length; i++) { var k = ks[i], v = s.darts[k]; if (!DART_KEY.test(k)) return bad("다트 키 형식 오류(" + k + ")");
      if (!v || typeof v !== "object" || Array.isArray(v) || Object.keys(v).join(",") !== "mode" || !DART_MODE_LABEL[v.mode]) return bad("다트 항목은 mode 하나만 허용(" + k + ")"); }
    return { state: "ok", darts: s.darts };
  }
  // 다트 한 개의 계획: 접는 방향(topFirst) + 정리 방식(method · 없으면 예전 그대로 본뜸). ds = readDart 결과.
  function dartPlan(p, d, ds) {
    var kind = dartKind(p, d), key = p.id + "|" + d.id, base = { key: key, id: d.id, kind: kind, boundary: d.boundary || null, topFirst: d.topFirst, method: null, mode: null, explicit: false, supported: !!kind, legacyProject: ds.state !== "ok", why: null };
    if (!kind) return base;
    if (ds.state !== "ok") { base.mode = DART_MODES[kind][1]; return base; }
    var ent = ds.darts[key], mode = ent ? ent.mode : DART_MODES[kind][0];
    if (DART_MODES[kind].indexOf(mode) < 0) { base.mode = DART_MODES[kind][1]; base.why = "저장된 방식(" + mode + ")이 이 다트에 맞지 않아 예전 방식으로 둡니다"; return base; }
    base.mode = mode; base.explicit = !!ent;
    if (mode === "up-extend") { if (d.topFirst !== true && d.topFirst !== false) { base.why = "접는 방향을 정할 수 없습니다"; return base; } base.topFirst = !d.topFirst; base.method = "extend-lower"; }
    else if (mode === "center-chord") {
      var n = p.segs.length, a = p.segs[(d.legs[0] + n - 1) % n], b = p.segs[(d.legs[1] + 1) % n];
      if (!a || !b || a.kind !== "line" || b.kind !== "line") { base.mode = "center-legacy"; base.why = "어깨선이 직선이 아니어서 «직선으로 정리»를 쓰지 않습니다(예전 방식 · 곡선 어깨는 아직 지원하지 않음)"; return base; }
      base.method = "chord";
    }
    return base;
  }
  function dartsOf(d, proj) {   // 지금 조각들의 다트 계획 목록(화면·검사용)
    var ds = readDart(proj || project()), out = { state: ds.state, reason: ds.reason || null, list: [] };
    if (!d || d.state !== "ready") return out;
    d.pieces.forEach(function (p) { if (!p.check.ok || !p.edges) return; p.edges.forEach(function (e) { e.darts.forEach(function (x) { out.list.push(Object.assign({ pieceId: p.id, pieceLabel: p.label, edgeId: e.id }, dartPlan(p, x, ds))); }); }); });
    return out;
  }
  function setDartMode(pid, dartId, mode, proj) {
    proj = proj || project(); var ds = readDart(proj); if (ds.state === "invalid") return { ok: false, reason: "저장된 다트 정리 설정을 읽을 수 없어 고치지 않습니다 — " + ds.reason };
    var d = derive(proj, true); if (d.state !== "ready") return { ok: false, reason: d.reason };
    var all = dartsOf(d, proj).list, me = all.filter(function (x) { return x.pieceId === pid && x.id === dartId; })[0];
    if (!me) return { ok: false, reason: "이 다트가 없습니다" };
    if (!me.kind) return { ok: false, reason: "이 다트는 입구 정리 방식을 고를 수 없습니다(지원: 앞판 진동 다트 · 뒤판 어깨 다트)" };
    if (DART_MODES[me.kind].indexOf(mode) < 0) return { ok: false, reason: "이 다트에 쓸 수 없는 방식입니다" };
    if (!DART_KEY.test(me.key)) return { ok: false, reason: "다트 이름을 저장할 수 없습니다" };
    var pinned = 0;
    if (ds.state === "none") {   // 예전 프로젝트: 다른 지원 다트가 새 기본으로 조용히 바뀌지 않게 예전 방식으로 고정
      proj.working.cutDart = { schema: 1, darts: {} };
      all.forEach(function (x) { if (x.kind && x.key !== me.key && DART_KEY.test(x.key)) { proj.working.cutDart.darts[x.key] = { mode: DART_MODES[x.kind][1] }; pinned++; } });
    }
    proj.working.cutDart.darts[me.key] = { mode: mode };
    return { ok: true, pinned: pinned, wasLegacyProject: ds.state === "none" };
  }

  // 시접 모델(읽기 전용 파생). d = derive(proj, true) 결과.
  function seamOf(d, proj) {
    var SA = W().seamAllowance, sp = readSpec(proj || project()), out = { state: "ready", spec: { state: sp.state, reason: sp.reason || null }, pieces: {}, orphans: [], done: 0, total: 0 };
    if (!d || d.state !== "ready") { out.state = "blocked"; return out; }
    if (!SA) { out.state = "no-module"; return out; }
    out.pairing = pairingOf(d, proj || project());
    var dsp = readDart(proj || project()); out.dartSpec = { state: dsp.state, reason: dsp.reason || null };
    var hit = {}, nsp = readNotchSpec(proj || project()), un = nsp.state === "ok" ? userNotchesOf(d, nsp) : { list: [], orphans: [] };
    out.notchSpec = { state: nsp.state, reason: nsp.reason || null, split: nsp.split };
    out.notchOrphans = un.orphans; out.armhole = d.notches ? d.notches.armhole : null;
    var allNotches = (d.notches ? d.notches.list : []).concat(un.list);
    d.pieces.forEach(function (p) {
      if (!p.check.ok || !p.edges) return;
      out.total++;
      var es = p.edges.map(function (e) { var r = resolveEdge(p, e, sp); if (!r.orphan && sp.edges[edgeKey(p.id, e.id)]) hit[edgeKey(p.id, e.id)] = 1; return Object.assign({ id: e.id, name: e.name, foldCapable: e.foldCapable, whole: !!e.whole, wholeReason: e.wholeReason || null, dartCount: e.darts.length }, r); });
      var plans = [];
      var res = SA.build({ ring: p.segs, edges: p.edges.map(function (e, k) { return { id: e.id, segs: e.segs, widthCm: es[k].widthCm, darts: e.darts.map(function (x) { var pl = dartPlan(p, x, dsp); plans.push(Object.assign({ edgeId: e.id }, pl)); return pl.method ? { legs: x.legs, topFirst: pl.topFirst, method: pl.method } : { legs: x.legs, topFirst: pl.topFirst }; }) }; }) });
      if (res.ok) out.done++;
      out.pieces[p.id] = { notches: allNotches.filter(function (n) { return n.pieceId === p.id; }).map(function (n) { var h = truedHold(p, n, res.trued); return h ? Object.assign({}, n, { from: h.pt, sewnAt: h.pt, to: null, held: true, heldWhy: h.why, why: h.why, heldDevCm: h.devCm, heldDevDeg: h.devDeg }) : Object.assign({}, n, notchLine(p, n, { ok: res.ok, edges: es, edgePaths: res.edgePaths })); }), edges: es, ok: res.ok, points: res.points, edgePaths: res.edgePaths, refusals: res.refusals, darts: res.darts, stats: res.stats, trued: res.trued || null, dartPlans: plans };
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
  // ══ 맞춤 표시(너치) 1차(2026-11-15) ══ 읽기 전용 파생 · 저장 없음 · 형상/시접/완료 hash 무변경
  //   근거가 확실한 것만 기본으로 만든다(등분·픽셀 추정 없음). 위치 권위 = 완성선 위 경로 위치(변 시작에서 잰 호 길이).
  //   표시 = 그 점에서 완성선에 직각으로 시접선(재단선)까지([패턴학교] P.164 «바깥쪽으로 내는 치수는 시접 폭이 기준»). 시접 폭을 바꿔도 위치는 그대로.
  //   · WL: 몸판 옆선·중심선이 허리선에서 나뉘는 점(완료본 경계 root «…» ↔ «…-extension») — [패턴학교] P.164 «각 파트로 분리할 때: WL»
  //   · 소매산점: 소매 형상의 앞/뒤 분할점(designSleeve.capPrimitives.splitPoint · 소매산 길이 측정과 같은 권위) — P.164 «소매산점»
  //   · 밴드 SNP: 밴드 달림선 위, 뒤중심에서 몸판 뒤 목둘레 길이(완료본 necklineLengths.back)만큼 — P.164 «칼라의 SNP와 뒤 중심»
  var NOTCH_JOIN = 1e-6;
  function segLenOf(g) { if (g.kind !== "cubic") return Math.hypot(g.to.x - g.from.x, g.to.y - g.from.y); var L = 0, p = g.from; for (var k = 1; k <= 200; k++) { var q = cubicAt(g, k / 200); L += Math.hypot(q.x - p.x, q.y - p.y); p = q; } return L; }
  function edgeChain(p, e) { return e.segs.map(function (i) { return p.segs[i]; }); }
  function chainLen(ch) { return ch.reduce(function (t, g) { return t + segLenOf(g); }, 0); }
  // 변 위 호 길이 s 의 점·접선(시작 쪽에서). 곡선은 200 등분 점열로 잰다(측정 해상도 ≤ 0.01cm 수준).
  function pointAtArc(ch, s) {
    var acc = 0;
    for (var i = 0; i < ch.length; i++) {
      var g = ch[i], L = segLenOf(g);
      if (s <= acc + L + 1e-9 || i === ch.length - 1) {
        var r = Math.max(0, Math.min(1, L > 0 ? (s - acc) / L : 0));
        if (r >= 1 - 1e-12) return { pt: { x: g.to.x, y: g.to.y }, tan: g.kind === "cubic" ? { x: g.to.x - g.c2.x, y: g.to.y - g.c2.y } : { x: g.to.x - g.from.x, y: g.to.y - g.from.y } };
        if (r <= 1e-12) return { pt: { x: g.from.x, y: g.from.y }, tan: g.kind === "cubic" ? { x: g.c1.x - g.from.x, y: g.c1.y - g.from.y } : { x: g.to.x - g.from.x, y: g.to.y - g.from.y } };
        if (g.kind !== "cubic") return { pt: { x: g.from.x + (g.to.x - g.from.x) * r, y: g.from.y + (g.to.y - g.from.y) * r }, tan: { x: g.to.x - g.from.x, y: g.to.y - g.from.y } };
        var a2 = 0, prev = g.from, t = 0;
        for (var k = 1; k <= 200; k++) { var q = cubicAt(g, k / 200), d = Math.hypot(q.x - prev.x, q.y - prev.y); if (a2 + d >= r * L) { t = (k - 1 + (d > 0 ? (r * L - a2) / d : 0)) / 200; break; } a2 += d; prev = q; t = 1; }
        var p0 = cubicAt(g, Math.max(0, t - 1e-4)), p1 = cubicAt(g, Math.min(1, t + 1e-4));
        return { pt: cubicAt(g, t), tan: { x: p1.x - p0.x, y: p1.y - p0.y } };
      }
      acc += L;
    }
    return null;
  }
  // 점이 변 위 어디(호 길이)인지 — 선분 끝점과 정확히 맞는 경우만(맞춤점은 완료본 선의 꼭짓점이어야 한다)
  function arcAtVertex(ch, q) {
    var acc = 0;
    for (var i = 0; i < ch.length; i++) {
      if (Math.hypot(ch[i].from.x - q.x, ch[i].from.y - q.y) <= NOTCH_JOIN) return acc;
      acc += segLenOf(ch[i]);
      if (Math.hypot(ch[i].to.x - q.x, ch[i].to.y - q.y) <= NOTCH_JOIN) return acc;
    }
    return null;
  }
  // 책 이즈 배분(구간별 비율 · 합 100): 뒤 [아래, 가운데, 위] · 앞 [위, 가운데, 아래] — [패턴학교] P.165 «여유분 줄임의 배분 방법»
  var EASE_BOOK = Object.freeze({ back: Object.freeze([6, 18, 35]), front: Object.freeze([32, 9, 0]) });
  // 봉제 경로 = 변의 선 중 다트 다리를 뺀 것(다트를 닫으면 다리는 봉제선에 들어가지 않는다)
  function sewnChain(p, e) { var legs = {}; (e.darts || []).forEach(function (d) { legs[d.legs[0]] = legs[d.legs[1]] = 1; }); return e.segs.filter(function (i) { return !legs[i]; }).map(function (i) { return p.segs[i]; }); }
  function notchesOf(R, pieces, split) {
    var list = [], todo = [], P = function (id) { return pieces.filter(function (x) { return x.id === id && x.check.ok && x.edges; })[0]; };
    var E = function (p, id) { return p ? p.edges.filter(function (e) { return e.id === id; })[0] : null; };
    var add = function (p, e, s, o) { var ch = sewnChain(p, e), L = chainLen(ch); list.push(Object.assign({ pieceId: p.id, edgeId: e.id, atCm: s, edgeLenCm: L, sig: e.sig }, o)); };
    // 변을 위쪽 끝(도안 y 가 작은 쪽)에서 잰 호 길이로 바꾼다 — 옆선의 짝 비교용(겨드랑이 쪽에서 잼)
    var fromTop = function (p, e, s) { var ch = edgeChain(p, e), L = chainLen(ch), a = ch[0].from, z = ch[ch.length - 1].to; return a.y <= z.y ? s : L - s; };
    // ① WL — 변 안에서 경계 root 가 «X» → «X-extension» 으로 바뀌는 꼭짓점
    var wl = {};
    ["front", "back"].forEach(function (pid) {
      var p = P(pid); if (!p) return;
      p.edges.forEach(function (e) {
        if (!e.roots || (e.label !== "side-seam" && e.label !== "center")) return;
        var acc = 0;
        for (var k = 0; k + 1 < e.segs.length; k++) {
          acc += segLenOf(p.segs[e.segs[k]]);
          var a = e.roots[k], b = e.roots[k + 1]; if (!a || !b) continue;
          var ta = a.split("/").pop(), tb = b.split("/").pop();
          if ((tb === ta + "-extension") || (ta === tb + "-extension")) {
            var pid2 = e.label === "side-seam" ? "wl-side" : null;
            add(p, e, acc, { id: pid + "-" + e.id + "-wl", kind: "wl", name: "WL", pairId: pid2, side: pid === "front" ? "앞" : "뒤",
              basis: "완료본 경계: «" + ta + "» 와 «" + tb + "» 가 나뉘는 점(허리선) — [패턴학교] P.164 «각 파트로 분리할 때: WL»", fromTopCm: r4(fromTop(p, e, acc)) });
            if (pid2) wl[pid] = list[list.length - 1];
          }
        }
      });
    });
    if (P("front") && P("back")) { if (!(wl.front && wl.back)) todo.push({ what: "옆선 WL", why: "앞·뒤 옆선 둘 다에 허리선 나뉨점이 있어야 짝을 지을 수 있습니다(몸판 길이를 늘이지 않으면 옆선 끝 = 허리선 모서리라 표시가 필요 없습니다)" }); }
    else todo.push({ what: "몸판 WL", why: "나뉘지 않은 앞판·뒤판일 때만 1차 지원(요크·프린세스·페플럼·소매 파생 몸판은 변 이름을 아직 못 읽음)" });
    if (wl.front && wl.back) { var dd = wl.back.fromTopCm - wl.front.fromTopCm; wl.front.pair = wl.back.pair = { a: "앞 옆선 겨드랑이~WL " + c2s(wl.front.fromTopCm), b: "뒤 옆선 겨드랑이~WL " + c2s(wl.back.fromTopCm), diffCm: r4(dd) }; }
    var fc = E(P("front"), "center"); if (P("front") && !fc) todo.push({ what: "앞 중심 WL", why: "여밈·안단을 합친 앞판은 앞중심이 외곽이 아니라 앞단(접는선·안단 끝)이 외곽 — 앞단의 WL 위치는 아직 정하지 않음" });
    // ② 소매산점
    var sl = P("sleeve-sleeve"), cap = E(sl, "cap"), DS = W().designSleeve;
    if (sl && cap && DS && typeof DS.capPrimitives === "function") {
      var pr = null; try { pr = DS.capPrimitives(R.sleeve.geometry); } catch (x) { pr = null; }
      var s0 = pr ? arcAtVertex(edgeChain(sl, cap), pr.splitPoint) : null, AH = R.bodice && R.bodice.armholeLengths;
      if (s0 == null) todo.push({ what: "소매산점", why: "소매 형상의 앞/뒤 분할점을 소매산 선 위 꼭짓점에서 찾지 못함" });
      else add(sl, cap, s0, { id: "sleeve-cap-top", kind: "cap-top", name: "소매산점", pairId: "cap-sp", side: "소매",
        basis: "소매 형상의 앞/뒤 분할점(designSleeve.capPrimitives · 소매산 길이 측정과 같은 점) — [패턴학교] P.164 «소매산점»",
        pair: AH && pr ? { a: "몸판 어깨선 끝(SP · 모서리라 몸판에는 표시 안 함)", b: "소매산 뒤 " + c2s(r4(pr.lengths.back)) + " / 앞 " + c2s(r4(pr.lengths.front)) + " · 몸판 진동 뒤 " + c2s(AH.back) + " / 앞 " + c2s(AH.front), diffCm: r4(pr.lengths.total - AH.front - AH.back), diffText: "이세 합계" } : null });
    } else if (R.sleeve && R.sleeve.geometry) todo.push({ what: "소매산점", why: "소매 Ⓐ(변 이름이 있는 소매)만 1차 지원" });
    // ③ 밴드 SNP
    var st = P("collar-stand"), ns = E(st, "neck-seam"), cb = E(st, "cb-fold"), back = R.bodice && R.bodice.necklineLengths && R.bodice.necklineLengths.back;
    if (st && ns && cb && typeof back === "number") {
      var ch = edgeChain(st, ns), L = chainLen(ch), cbPts = edgeChain(st, cb), cbEnds = [cbPts[0].from, cbPts[cbPts.length - 1].to];
      var startAtCB = cbEnds.some(function (q) { return Math.hypot(q.x - ch[0].from.x, q.y - ch[0].from.y) <= NOTCH_JOIN; }), endAtCB = cbEnds.some(function (q) { return Math.hypot(q.x - ch[ch.length - 1].to.x, q.y - ch[ch.length - 1].to.y) <= NOTCH_JOIN; });
      if (!(startAtCB || endAtCB) || !(back > 0 && back < L)) todo.push({ what: "밴드 SNP", why: "밴드 달림선이 뒤중심에서 시작하지 않거나 뒤 목둘레가 달림선보다 김" });
      else add(st, ns, startAtCB ? back : L - back, { id: "collar-stand-snp", kind: "snp", name: "SNP", pairId: "neck-snp", side: "밴드",
        basis: "밴드 달림선 위 뒤중심에서 몸판 뒤 목둘레 길이 " + c2s(back) + "cm (완료본 몸판 necklineLengths) — [패턴학교] P.164 «칼라의 SNP와 뒤 중심»",
        pair: { a: "몸판 SNP(어깨선과 목둘레 모서리 — 몸판에는 표시 안 함)", b: "밴드 달림선 " + c2s(r4(L)) + " · 몸판 목둘레 반 " + c2s(R.bodice.necklineLengths.half), diffCm: r4(L - R.bodice.necklineLengths.half), diffText: "달림선 − 목둘레" } });
    } else if (R.collar) todo.push({ what: "밴드 SNP", why: "밴드 + 위 칼라 셔츠 칼라의 달림선·뒤중심 골선이 있을 때만 1차 지원" });
    if (P("collar-body")) todo.push({ what: "위 칼라 SNP", why: "밴드 윗선 위 SNP 위치의 권위가 없음(목둘레와 길이가 다름) — 추정해 만들지 않음" });
    // ④ 진동 둘레 · 소매산 너치([패턴학교] P.165 · 김님 확정 2026-11-15 «몸판이 먼저고 그걸 가지고 소매에 적용»)
    //   몸판(현재 완료 몸판 · 다트를 닫은 봉제 진동 = 다트 다리는 길이에 넣지 않음): 위 = 어깨점(SP)에서 6 · 아래 = 진동 아랫점(옆선 끝)에서 뒤 6.5 / 앞 5.
    //   소매(위 몸판 위치에서 파생): 위 = 소매산점에서 6 + 그 구간 이즈 · 아래 = 소매 아랫점에서 6.5 + 그 구간 이즈(뒤) / 5 + 그 구간 이즈(앞).
    //   이즈 = 전체 이즈(소매산 − 몸판 봉제 진동) × 구간 비율 — 구간별 비율(합 100): 뒤 아래 6 · 뒤 가운데 18 · 뒤 위 35 · 앞 위 32 · 앞 가운데 9 · 앞 아래 0.
    //   각 구간 이즈는 책대로 소수 둘째 자리에서 반올림(0.1 단위). 가운데 구간은 너치를 두지 않으므로 나머지(실제 앞/뒤 이즈 − 위 − 아래)를 그대로 흡수한다.
    var sp = split || EASE_BOOK, sl2 = P("sleeve-sleeve"), cap2 = E(sl2, "cap"), AH2 = R.bodice && R.bodice.armholeLengths, DS2 = W().designSleeve;
    var ahWhy = !(P("front") && P("back")) ? "나뉘지 않은 앞판·뒤판일 때만 1차 지원" : !(sl2 && cap2) ? "소매 Ⓐ(변 이름이 있는 소매)만 1차 지원" : !(AH2 && AH2.front > 0 && AH2.back > 0) ? "완료 몸판의 봉제 진동 길이 기록이 없음" : null;
    var pr2 = null; if (!ahWhy) { try { pr2 = DS2.capPrimitives(R.sleeve.geometry); } catch (x) { pr2 = null; } if (!pr2) ahWhy = "소매산 앞/뒤 분할을 잴 수 없음"; }
    var ah = { ok: false, split: sp, book: sp === EASE_BOOK };
    if (!ahWhy) {
      var sides = {}, bad = null;
      ["front", "back"].forEach(function (pid) {
        var p = P(pid), e = E(p, "armhole"); if (!e) { bad = "몸판 진동 변을 찾지 못함"; return; }
        var ch = sewnChain(p, e), L = chainLen(ch), sh = E(p, "shoulder"), sd = E(p, "side-seam");
        if (!sh || !sd) { bad = "진동 양 끝(어깨·옆선) 변을 찾지 못함"; return; }
        var endPt = ch[ch.length - 1].to, startPt = ch[0].from, touch = function (q, ed) { return edgeChain(p, ed).some(function (g) { return Math.hypot(g.from.x - q.x, g.from.y - q.y) <= NOTCH_JOIN || Math.hypot(g.to.x - q.x, g.to.y - q.y) <= NOTCH_JOIN; }); };
        var spAtEnd = touch(endPt, sh) && touch(startPt, sd), spAtStart = touch(startPt, sh) && touch(endPt, sd);
        if (!(spAtEnd || spAtStart)) { bad = "진동의 어깨점·진동 아랫점을 정하지 못함"; return; }
        if (Math.abs(L - AH2[pid]) > 0.02) { bad = (pid === "front" ? "앞" : "뒤") + " 진동 봉제 길이(" + c2s(r4(L)) + ")가 완료 몸판 기록(" + c2s(AH2[pid]) + ")과 다름"; return; }
        sides[pid] = { p: p, e: e, L: L, spAtEnd: spAtEnd };
      });
      if (bad) ahWhy = bad;
      var capCh = !ahWhy ? edgeChain(sl2, cap2) : null, capL = capCh ? chainLen(capCh) : 0, s0c = capCh ? arcAtVertex(capCh, pr2.splitPoint) : null;
      if (!ahWhy && s0c == null) ahWhy = "소매산점을 소매산 선 위에서 찾지 못함";
      if (!ahWhy) {
        var backFirst = Math.abs(s0c - pr2.lengths.back) < Math.abs(s0c - pr2.lengths.front);   // 소매산 선이 뒤쪽 아랫점에서 시작하는가
        var BOD = { back: { up: 6, low: 6.5 }, front: { up: 6, low: 5 } };
        var tot = (pr2.lengths.back + pr2.lengths.front) - (AH2.back + AH2.front), r1 = function (v) { return Math.round(v * 10) / 10; };
        var eB = { low: r1(tot * sp.back[0] / 100), mid: r1(tot * sp.back[1] / 100), up: r1(tot * sp.back[2] / 100) }, eF = { up: r1(tot * sp.front[0] / 100), mid: r1(tot * sp.front[1] / 100), low: r1(tot * sp.front[2] / 100) };
        var capLenSide = { back: pr2.lengths.back, front: pr2.lengths.front }, EZ = { back: eB, front: eF };
        ah = { ok: true, split: sp, book: sp === EASE_BOOK, totalEaseCm: r4(tot), sides: {} };
        ["back", "front"].forEach(function (k) {
          var sd = sides[k], kn = k === "back" ? "뒤" : "앞", ez = EZ[k], sideEase = capLenSide[k] - AH2[k], midRest = sideEase - ez.up - ez.low;
          var bUp = sd.spAtEnd ? sd.L - BOD[k].up : BOD[k].up, bLow = sd.spAtEnd ? BOD[k].low : sd.L - BOD[k].low;
          // 소매: 소매산점에서 위 너치까지(6 + 이즈) · 소매 아랫점에서 아래 너치까지
          var sUpFromTop = BOD[k].up + ez.up, sLowFromU = BOD[k].low + ez.low;
          var sUp = (k === "back") === backFirst ? s0c - sUpFromTop : s0c + sUpFromTop, sLow = (k === "back") === backFirst ? sLowFromU : capL - sLowFromU;
          var midBody = AH2[k] - BOD[k].up - BOD[k].low, midSleeve = capLenSide[k] - sUpFromTop - sLowFromU;
          ah.sides[k] = { bodyCm: r4(AH2[k]), capCm: r4(capLenSide[k]), sideEaseCm: r4(sideEase), ease: ez, midEaseCm: r4(midRest), midBodyCm: r4(midBody), midSleeveCm: r4(midSleeve) };
          if (!(midBody > 0) || !(midSleeve > 0)) { todo.push({ what: kn + " 진동·소매산 너치", why: "너치 사이 가운데 구간이 0 이하(몸판 " + c2s(r4(midBody)) + " · 소매 " + c2s(r4(midSleeve)) + "cm) — 진동이 너무 짧거나 이즈 배분이 맞지 않음" }); return; }
          var pct = k === "back" ? { up: sp.back[2], low: sp.back[0] } : { up: sp.front[0], low: sp.front[2] };
          var note = (midRest < -0.005 ? " · 가운데 구간 이즈 " + c2s(r4(midRest)) + "(음수 — 소매가 오그라듦)" : " · 가운데 구간 이즈 " + c2s(r4(midRest)));
          var src = "[패턴학교] P.165 «진동 둘레·소매산» — 몸판 = 현재 완료 몸판 봉제 진동(다트 닫음) · 소매 = 그 몸판 위치 + 구간 이즈(전체 이즈 " + c2s(r4(tot)) + " × 비율, 0.1 반올림)";
          add(sd.p, sd.e, bUp, { id: k + "-ah-up", kind: "ah", name: kn + " 진동 위", pairId: k + "-ah-up", side: kn + "판", basis: src, ref: "어깨점(SP)에서 봉제 진동 " + c2s(BOD[k].up),
            pair: { a: "몸판 SP 에서 " + c2s(BOD[k].up), b: "소매산점에서 " + c2s(BOD[k].up) + " + 이즈 " + c2s(ez.up) + " (" + pct.up + "%) = " + c2s(r4(sUpFromTop)), diffCm: ez.up, diffText: "이즈" } });
          add(sd.p, sd.e, bLow, { id: k + "-ah-low", kind: "ah", name: kn + " 진동 아래", pairId: k + "-ah-low", side: kn + "판", basis: src, ref: "진동 아랫점(옆선 끝)에서 봉제 진동 " + c2s(BOD[k].low),
            pair: { a: "몸판 진동 아랫점에서 " + c2s(BOD[k].low), b: "소매 아랫점에서 " + c2s(BOD[k].low) + " + 이즈 " + c2s(ez.low) + " (" + pct.low + "%) = " + c2s(r4(sLowFromU)), diffCm: ez.low, diffText: "이즈" } });
          add(sl2, cap2, sUp, { id: "sleeve-" + k + "-up", kind: "cap", name: kn + " 소매산 위", pairId: k + "-ah-up", side: "소매", basis: src + note, ref: "소매산점에서 " + c2s(r4(sUpFromTop)) + "(" + kn + "쪽)",
            pair: { a: "몸판 SP 에서 " + c2s(BOD[k].up), b: "소매산점에서 " + c2s(r4(sUpFromTop)), diffCm: ez.up, diffText: "이즈" } });
          add(sl2, cap2, sLow, { id: "sleeve-" + k + "-low", kind: "cap", name: kn + " 소매산 아래", pairId: k + "-ah-low", side: "소매", basis: src + note, ref: "소매 아랫점에서 " + c2s(r4(sLowFromU)) + "(" + kn + "쪽)",
            pair: { a: "몸판 진동 아랫점에서 " + c2s(BOD[k].low), b: "소매 아랫점에서 " + c2s(r4(sLowFromU)), diffCm: ez.low, diffText: "이즈" } });
        });
      }
    }
    if (ahWhy) todo.push({ what: "진동 둘레·소매산 너치", why: ahWhy });
    todo.push({ what: "다트 위치 · 개더 끝 · EL · 트임 끝 · 칼라 달림 끝", why: "다트 산 시접 위 표시 방향·개더 구간·EL 권위가 1차에 없음(트임 끝은 소매 위 «가위집» 표시로 대신)" });
    return { list: list, todo: todo, armhole: ah };
  }
  // ── 다트 입구 정리 뒤 너치 확인(2026-11-17 Codex 검토) ──
  //   너치 위치는 원래 완성선(정리 전) 기준 호 길이다. 정리 외곽이 그 자리에서 바뀌었으면(점이 외곽 위에 없거나 방향이 다르면) 옛 자리를 정상 너치로 내지 않는다:
  //   보류(이유 표시) · 인쇄·DXF 에서 뺀다 · 위치를 옮기지 않는다 · 저장값 그대로. 영향 없는 너치는 그대로 둔다(같은 자리·같은 방향이면 보류 안 함).
  var HOLD_POS_CM = 0.002, HOLD_DEG = 0.1, NOTCH_MAX_CM = 0.3;   // NOTCH_MAX_CM = 맞춤 표시 선 최대 길이 3mm(재단선에서 안으로 · 2026-11-20 김님: Optitex 검수 후 7→3mm)
  function nearestOnRing(ring, q) {
    var best = [];
    ring.forEach(function (g) {
      if (g.kind !== "cubic") { var vx = g.to.x - g.from.x, vy = g.to.y - g.from.y, l2 = vx * vx + vy * vy, t = l2 ? Math.max(0, Math.min(1, ((q.x - g.from.x) * vx + (q.y - g.from.y) * vy) / l2)) : 0;
        best.push({ d: Math.hypot(q.x - g.from.x - vx * t, q.y - g.from.y - vy * t), tan: { x: vx, y: vy } }); return; }
      var N = 64, bi = 0, bd = Infinity, k; for (k = 0; k <= N; k++) { var c = cubicAt(g, k / N), dd = Math.hypot(c.x - q.x, c.y - q.y); if (dd < bd) { bd = dd; bi = k; } }
      var lo = Math.max(0, (bi - 1) / N), hi = Math.min(1, (bi + 1) / N), f = function (t) { var c = cubicAt(g, t); return Math.hypot(c.x - q.x, c.y - q.y); };
      for (k = 0; k < 60; k++) { var m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3; if (f(m1) < f(m2)) hi = m2; else lo = m1; }
      var t2 = (lo + hi) / 2, u = 1 - t2;
      best.push({ d: f(t2), tan: { x: 3 * u * u * (g.c1.x - g.from.x) + 6 * u * t2 * (g.c2.x - g.c1.x) + 3 * t2 * t2 * (g.to.x - g.c2.x), y: 3 * u * u * (g.c1.y - g.from.y) + 6 * u * t2 * (g.c2.y - g.c1.y) + 3 * t2 * t2 * (g.to.y - g.c2.y) } });
    });
    return best;
  }
  function truedHold(p, n, trued) {
    if (!trued || !trued.ring) return null;
    var e = p.edges.filter(function (x) { return x.id === n.edgeId; })[0], at = e && pointAtArc(sewnChain(p, e), n.atCm); if (!at) return null;
    var cand = nearestOnRing(trued.ring, at.pt), dmin = Infinity; cand.forEach(function (c) { if (c.d < dmin) dmin = c.d; });
    var tl = Math.hypot(at.tan.x, at.tan.y), ang = Infinity;
    cand.forEach(function (c) { if (c.d > dmin + 1e-7) return; var cl = Math.hypot(c.tan.x, c.tan.y); if (!cl || !tl) return; var a = Math.asin(Math.min(1, Math.abs(at.tan.x * c.tan.y - at.tan.y * c.tan.x) / (tl * cl))) * 180 / Math.PI; if (a < ang) ang = a; });
    if (dmin <= HOLD_POS_CM && ang <= HOLD_DEG) return null;
    return { devCm: r4(dmin), devDeg: Math.round(ang * 100) / 100, pt: at.pt,
      why: "다트 입구를 접어 정리하면서 이 자리의 완성선이 바뀌었습니다(어긋남 " + c2s(r4(dmin)) + "cm · 기울기 " + (Math.round(ang * 100) / 100) + "°) — 너치는 정리 전 선 기준이라 보류: 재단선·인쇄·DXF 에 내지 않고 위치도 옮기지 않습니다(저장값 그대로). 위치를 다시 정하거나 다트 정리 방식을 바꾸세요" };
  }
  // 표시 선: 완성선 점에서 바깥 법선으로 그 변의 시접선(재단선)까지. 시접 폭 0·시접 미완이면 선 없음 + 사유.
  function notchLine(p, n, sm) {
    var e = p.edges.filter(function (x) { return x.id === n.edgeId; })[0], at = e && pointAtArc(sewnChain(p, e), n.atCm);
    if (!at) return { why: "변을 찾지 못함" };
    var se = sm.edges.filter(function (x) { return x.id === n.edgeId; })[0], tl = Math.hypot(at.tan.x, at.tan.y);
    if (!se) return { why: "변 시접 정보 없음" };
    if (se.widthCm === 0) return { from: at.pt, sewnAt: at.pt, to: null, why: se.kind === "fold" ? "골선(시접 0) — 재단선 표시 없음" : "시접 0 — 재단선 표시 없음" };
    var path = sm.edgePaths && sm.edgePaths[n.edgeId]; if (!sm.ok || !path) return { from: at.pt, sewnAt: at.pt, to: null, why: "이 조각 시접 미완 — 재단선 표시 없음" };
    var nx = at.tan.y / tl, ny = -at.tan.x / tl, best = null;
    for (var sgn = -1; sgn <= 1; sgn += 2) for (var i = 0; i + 1 < path.length; i++) {
      var a = path[i], b = path[i + 1], rx = b.x - a.x, ry = b.y - a.y, dx = nx * sgn, dy = ny * sgn, den = dx * ry - dy * rx; if (Math.abs(den) < 1e-12) continue;
      var wx = a.x - at.pt.x, wy = a.y - at.pt.y, t = (wx * ry - wy * rx) / den, u = (wx * dy - wy * dx) / den;
      if (t > 1e-9 && u >= -1e-9 && u <= 1 + 1e-9 && (!best || t < best.t)) best = { t: t, x: at.pt.x + dx * t, y: at.pt.y + dy * t };
    }
    if (!best) return { from: at.pt, sewnAt: at.pt, to: null, why: "직각선이 시접선과 만나지 않음" };
    // ⑧ 표시 규격(2026-11-19): 위치(완성선 위 호 길이 · 직각 방향)는 그대로. 선은 재단선(to)에서 안쪽으로 최대 NOTCH_MAX_CM(3mm) 곧은 I자 한 줄.
    //   시접이 7mm 보다 좁으면 완성선(봉제선)에서 멈춘다(from = 완성선 위 점) — 봉제선을 넘지 않는다. 시접 0·골선·보류·미완은 위 분기 그대로(점/없음).
    var len = Math.min(NOTCH_MAX_CM, best.t), ux = (best.x - at.pt.x) / best.t, uy = (best.y - at.pt.y) / best.t;
    var inner = best.t <= NOTCH_MAX_CM ? at.pt : { x: best.x - ux * len, y: best.y - uy * len };
    return { from: inner, sewnAt: at.pt, to: { x: best.x, y: best.y }, lenCm: r4(len), seamCm: r4(best.t), narrow: best.t < NOTCH_MAX_CM };
  }

  // ══ 사용자 맞춤 표시 · 이즈 배분 저장(working.cutNotches · 판 1 · 김님 승인 2026-11-15) ══
  //   { schema:1, easeSplit?: { back:[아래,가운데,위], front:[위,가운데,아래] }, notches: { "u1": { piece, edge, atCm, sig, label, pair? } } }
  //   · 시접 설정(cutSpec)과 따로 둔다(그쪽 엄격 검증·값 무변경). 완료본·hash 와 무관. 항목이 없으면 기본(책 배분 · 사용자 너치 없음).
  //   · 엄격 검증: 모르는 키·판·유한하지 않은 값·음수·합 ≠ 100·짝 불일치 = 통째로 «읽을 수 없음»(고쳐 쓰지 않음 · 수정 잠금).
  //   · atCm = 변 «시작 끝»에서 잰 봉제 경로 거리(다트 다리 제외). 변이 사라지거나 모양(서명)이 바뀌거나 길이를 넘으면 «연결 끊김»으로 보류(삭제·자동 이동 없음).
  var NOTCH_ID = /^u[1-9][0-9]{0,5}$/;
  function readNotchSpec(proj) {
    var s = proj && proj.working ? proj.working.cutNotches : null, none = { state: "none", split: null, notches: {} };
    if (s == null) return none;
    var bad = function (r) { return { state: "invalid", reason: r, split: null, notches: {} }; };
    if (typeof s !== "object" || Array.isArray(s)) return bad("형식이 객체가 아닙니다");
    var ks = Object.keys(s);
    if (!ks.every(function (k) { return k === "schema" || k === "easeSplit" || k === "notches"; }) || ks.indexOf("schema") < 0 || ks.indexOf("notches") < 0) return bad("모르는 항목이 있거나 필수 항목이 없습니다");
    if (s.schema !== 1) return bad("모르는 판(schema " + s.schema + ")입니다");
    var split = null;
    if (s.easeSplit !== undefined) { var v = validSplit(s.easeSplit); if (!v.ok) return bad("이즈 배분 — " + v.reason); split = s.easeSplit; }
    if (!s.notches || typeof s.notches !== "object" || Array.isArray(s.notches)) return bad("맞춤 표시 목록 형식 오류");
    var ids = Object.keys(s.notches), pairs = {};
    for (var i = 0; i < ids.length; i++) {
      var n = s.notches[ids[i]];
      if (!NOTCH_ID.test(ids[i]) || !n || typeof n !== "object" || Array.isArray(n)) return bad("맞춤 표시 항목 형식 오류(" + ids[i] + ")");
      if (!Object.keys(n).every(function (k) { return ["piece", "edge", "atCm", "sig", "label", "pair"].indexOf(k) >= 0; })) return bad("맞춤 표시 항목에 모르는 키(" + ids[i] + ")");
      if (typeof n.piece !== "string" || typeof n.edge !== "string" || typeof n.sig !== "string" || typeof n.label !== "string" || /\|/.test(n.piece + n.edge)) return bad("맞춤 표시 항목의 조각·변·서명 누락(" + ids[i] + ")");
      if (!(typeof n.atCm === "number" && isFinite(n.atCm) && n.atCm >= 0 && n.atCm <= 500)) return bad("맞춤 표시 위치가 0~500cm 숫자가 아닙니다(" + ids[i] + ")");
      if (n.pair !== undefined) { if (typeof n.pair !== "string" || !NOTCH_ID.test(n.pair) || n.pair === ids[i]) return bad("짝 지정 오류(" + ids[i] + ")"); pairs[ids[i]] = n.pair; }
    }
    var pk = Object.keys(pairs);
    for (var j = 0; j < pk.length; j++) { var o = pairs[pk[j]]; if (pairs[o] !== pk[j]) return bad("짝이 서로 가리키지 않습니다(" + pk[j] + " → " + o + ")"); if (s.notches[o].piece === s.notches[pk[j]].piece && s.notches[o].edge === s.notches[pk[j]].edge) return bad("같은 변끼리 짝(" + pk[j] + ")"); }
    return { state: "ok", split: split, notches: s.notches };
  }
  function validSplit(sp) {
    if (!sp || typeof sp !== "object" || Array.isArray(sp) || Object.keys(sp).sort().join(",") !== "back,front") return { ok: false, reason: "back·front 두 항목이어야 합니다" };
    var all = [];
    for (var k in { back: 1, front: 1 }) { var a = sp[k]; if (!Array.isArray(a) || a.length !== 3 || !a.every(function (v) { return typeof v === "number" && isFinite(v) && v >= 0 && v <= 100; })) return { ok: false, reason: (k === "back" ? "뒤" : "앞") + " 구간 비율 3개가 0~100 숫자여야 합니다" }; all = all.concat(a); }
    var sum = all.reduce(function (t, v) { return t + v; }, 0);
    if (Math.abs(sum - 100) > 1e-9) return { ok: false, reason: "여섯 구간 비율의 합이 100 이어야 합니다(지금 " + (Math.round(sum * 1000) / 1000) + ")" };
    return { ok: true };
  }
  function notchStore(proj) {
    var sp = readNotchSpec(proj); if (sp.state === "invalid") return { err: "저장된 맞춤 표시 설정을 읽을 수 없어 고치지 않습니다 — " + sp.reason };
    if (!proj.working.cutNotches) proj.working.cutNotches = { schema: 1, notches: {} };
    return { s: proj.working.cutNotches };
  }
  function findEdge(d, pid, eid) { var p = d.pieces.filter(function (x) { return x.id === pid && x.check.ok && x.edges; })[0], e = p && p.edges.filter(function (x) { return x.id === eid; })[0]; return e ? { p: p, e: e, L: chainLen(sewnChain(p, e)) } : null; }
  function addNotch(pid, eid, atCm, proj) {
    proj = proj || project(); var d = derive(proj, true); if (d.state !== "ready") return { ok: false, reason: d.reason };
    var f = findEdge(d, pid, eid); if (!f) return { ok: false, reason: "이 변을 찾을 수 없습니다" };
    if (!(typeof atCm === "number" && isFinite(atCm) && atCm >= 0 && atCm <= f.L)) return { ok: false, reason: "위치는 0~" + c2s(r4(f.L)) + "cm 사이 숫자여야 합니다" };
    var st = notchStore(proj); if (st.err) return { ok: false, reason: st.err };
    var n = 1; Object.keys(st.s.notches).forEach(function (k) { n = Math.max(n, Number(k.slice(1)) + 1); });
    var id = "u" + n; st.s.notches[id] = { piece: pid, edge: eid, atCm: r4(atCm), sig: f.e.sig, label: f.p.label + " · " + f.e.name };
    return { ok: true, id: id };
  }
  function moveNotch(id, atCm, proj) {
    proj = proj || project(); var sp = readNotchSpec(proj); if (sp.state === "invalid") return { ok: false, reason: "저장된 맞춤 표시 설정을 읽을 수 없어 고치지 않습니다 — " + sp.reason };
    var n = sp.notches[id]; if (!n) return { ok: false, reason: "이 맞춤 표시가 없습니다" };
    var d = derive(proj, true); if (d.state !== "ready") return { ok: false, reason: d.reason };
    var f = findEdge(d, n.piece, n.edge); if (!f) return { ok: false, reason: "이 변이 지금 조각에 없습니다(연결 끊김)" };
    if (!(typeof atCm === "number" && isFinite(atCm) && atCm >= 0 && atCm <= f.L)) return { ok: false, reason: "위치는 0~" + c2s(r4(f.L)) + "cm 사이 숫자여야 합니다" };
    n.atCm = r4(atCm); n.sig = f.e.sig;   // 사용자가 지금 변 위에서 정했다 = 지금 모양에 다시 연결
    return { ok: true };
  }
  function removeNotch(id, proj) {
    proj = proj || project(); var sp = readNotchSpec(proj); if (sp.state === "invalid") return { ok: false, reason: "저장된 맞춤 표시 설정을 읽을 수 없어 고치지 않습니다 — " + sp.reason };
    var n = sp.notches[id]; if (!n) return { ok: false, reason: "이 맞춤 표시가 없습니다" };
    if (n.pair && sp.notches[n.pair]) delete sp.notches[n.pair].pair;
    delete sp.notches[id]; return { ok: true };
  }
  function pairNotches(a, b, proj) {
    proj = proj || project(); var sp = readNotchSpec(proj); if (sp.state === "invalid") return { ok: false, reason: "저장된 맞춤 표시 설정을 읽을 수 없어 고치지 않습니다 — " + sp.reason };
    var A = sp.notches[a]; if (!A) return { ok: false, reason: "이 맞춤 표시가 없습니다" };
    if (b == null) { if (A.pair && sp.notches[A.pair]) delete sp.notches[A.pair].pair; delete A.pair; return { ok: true }; }
    var B = sp.notches[b]; if (!B || a === b) return { ok: false, reason: "짝으로 고를 맞춤 표시가 없습니다" };
    if (A.piece === B.piece && A.edge === B.edge) return { ok: false, reason: "같은 변끼리는 짝이 될 수 없습니다(봉제로 붙는 다른 변을 고르세요)" };
    [A, B].forEach(function (x) { if (x.pair && sp.notches[x.pair]) delete sp.notches[x.pair].pair; });
    A.pair = b; B.pair = a; return { ok: true };
  }
  function setEaseSplit(split, proj) {
    proj = proj || project();
    if (split !== null) { var v = validSplit(split); if (!v.ok) return { ok: false, reason: v.reason }; }
    var st = notchStore(proj); if (st.err) return { ok: false, reason: st.err };
    if (split === null) delete st.s.easeSplit; else st.s.easeSplit = { back: split.back.slice(), front: split.front.slice() };
    return { ok: true };
  }
  // 사용자 맞춤 표시 해석(조각·변·서명·길이) → 표시 목록 + 연결 끊김
  function userNotchesOf(d, sp) {
    var list = [], orphans = [];
    Object.keys(sp.notches).sort(function (a, b) { return Number(a.slice(1)) - Number(b.slice(1)); }).forEach(function (id) {
      var n = sp.notches[id], f = findEdge(d, n.piece, n.edge), why = !f ? (d.pieces.some(function (p) { return p.id === n.piece; }) ? "이 변이 지금 조각에 없습니다" : "이 조각이 지금 재단 조각에 없습니다")
        : f.e.sig !== n.sig ? "변 모양이 바뀌었습니다 — 위치를 다시 확인하고 «다시 연결»" : n.atCm > f.L + 1e-9 ? "변이 짧아져 위치(" + c2s(n.atCm) + ")가 변 길이(" + c2s(r4(f.L)) + ")를 넘습니다" : null;
      if (why) { orphans.push({ id: id, label: n.label, atCm: n.atCm, pair: n.pair || null, why: why, canReconnect: !!f && n.atCm <= f.L + 1e-9 }); return; }
      list.push({ id: id, pieceId: n.piece, edgeId: n.edge, atCm: n.atCm, edgeLenCm: f.L, sig: n.sig, user: true, name: "맞춤 " + id.slice(1), pairId: n.pair || null, side: f.p.label, basis: "사용자 지정(변 시작 끝에서 봉제 경로 " + c2s(n.atCm) + "cm)", ref: "변 시작 끝에서 " + c2s(n.atCm) });
    });
    // 짝 설명(서로의 위치를 양 끝에서) — 자동 이즈 판단은 하지 않는다
    list.forEach(function (n) {
      if (!n.pairId) return; var o = list.filter(function (x) { return x.id === n.pairId; })[0];
      n.pair = o ? { a: n.side + " · 시작에서 " + c2s(n.atCm) + " / 끝에서 " + c2s(r4(n.edgeLenCm - n.atCm)), b: o.side + " · 시작에서 " + c2s(o.atCm) + " / 끝에서 " + c2s(r4(o.edgeLenCm - o.atCm)), diffCm: null } : { a: n.side, b: "짝(" + n.pairId + ")이 연결 끊김 상태", diffCm: null };
    });
    return { list: list, orphans: orphans };
  }
  function reconnectNotch(id, proj) {
    proj = proj || project(); var sp = readNotchSpec(proj); if (sp.state === "invalid") return { ok: false, reason: "저장된 맞춤 표시 설정을 읽을 수 없어 고치지 않습니다 — " + sp.reason };
    var n = sp.notches[id]; if (!n) return { ok: false, reason: "이 맞춤 표시가 없습니다" };
    var d = derive(proj, true); if (d.state !== "ready") return { ok: false, reason: d.reason };
    var f = findEdge(d, n.piece, n.edge); if (!f) return { ok: false, reason: "이 변이 지금 조각에 없어 다시 연결할 수 없습니다 — 지우거나 다른 변에 새로 추가하세요" };
    if (n.atCm > f.L + 1e-9) return { ok: false, reason: "위치가 지금 변 길이를 넘어 다시 연결할 수 없습니다" };
    n.sig = f.e.sig; return { ok: true };
  }

  // ══ 재단 화면 표시 모델(2026-11-15 · 순수 · 원본·시접·너치 설정 무변경) ══
  //   · 골선(시접 설정 kind = fold)인 변이 있으면 그 골선에 대해 **반사해 펼친 한 장**으로 보여 준다(뒤판 뒤중심 · 밴드·위 칼라 뒤중심).
  //     외곽 = 골선 아닌 선(골선 끝 B → 다른 끝 A) + 그 반사를 거꾸로(A → B) — 골선 자체는 외곽이 아니라 안쪽 «골» 점선. 시접도 같은 방식(골선 위 점에서 이어 붙임).
  //     반사 쪽 변·너치는 원래 변 id 를 그대로 가진다 → 눌러도 원래 변의 시접·너치를 편집(복제 아님). 골 → 봉제선으로 바꾸면 반쪽 표시로 돌아간다.
  //   · BL(가슴선) = bodiceCheckpoint.bustLineY 와 같은 규칙: 옆선 변의 위 끝 y. 앞·뒤판을 이 높이에 맞춰 놓는다(위 끝 맞춤 아님).
  function mirrorFn(A, B) {
    var dx = B.x - A.x, dy = B.y - A.y, L2 = dx * dx + dy * dy;
    return function (q) { var t = ((q.x - A.x) * dx + (q.y - A.y) * dy) / L2, px = A.x + dx * t, py = A.y + dy * t; return { x: 2 * px - q.x, y: 2 * py - q.y }; };
  }
  function mirSeg(g, M) { return g.kind === "cubic" ? { kind: "cubic", from: M(g.from), c1: M(g.c1), c2: M(g.c2), to: M(g.to) } : { kind: "line", from: M(g.from), to: M(g.to) }; }
  function unfoldOf(p, e, sm) {
    var n = p.segs.length, F = e.segs, last = F[F.length - 1], start = (last + 1) % n, N = [];
    for (var k = 0; k < n - F.length; k++) N.push(p.segs[(start + k) % n]);
    var A = p.segs[F[0]].from, B = p.segs[last].to;
    if (!N.length || Math.hypot(B.x - A.x, B.y - A.y) < 1e-6) return { ok: false, why: "골선 길이가 0" };
    var M = mirrorFn(A, B), mirRev = N.slice().reverse().map(function (g) { return mirSeg(rev(g), M); });
    var out = { ok: true, A: A, B: B, M: M, outline: N.concat(mirRev), seam: null, seamWhy: null };
    if (sm && sm.ok && sm.points) {
      var pts = sm.points, m = pts.length, dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy);
      var on = pts.map(function (q) { return Math.abs((q.x - A.x) * dy - (q.y - A.y) * dx) / L < 1e-6; }), s = -1;
      for (var i = 0; i < m; i++) if (on[i] && !on[(i + 1) % m]) { if (s >= 0) { s = -2; break; } s = i; }
      if (s < 0) out.seamWhy = "시접선이 골선 위에서 한 번에 끊기지 않음";
      else {
        var path = [pts[s]], j = (s + 1) % m; while (!on[j]) { path.push(pts[j]); j = (j + 1) % m; } path.push(pts[j]);
        var cnt = 0; for (var c = 0; c < m; c++) if (on[c]) cnt++;
        if (cnt + path.length - 2 !== m) out.seamWhy = "시접선의 골선 위 점이 한 덩어리가 아님";
        else out.seam = path.concat(path.slice(1, -1).reverse().map(M));
      }
    } else out.seamWhy = sm && !sm.ok ? "시접 미완" : null;
    return out;
  }
  function blYOf(p) {
    var e = (p.edges || []).filter(function (x) { return x.label === "side-seam"; })[0]; if (!e) return null;
    var ys = []; e.segs.forEach(function (i) { ys.push(p.segs[i].from.y, p.segs[i].to.y); });
    return Math.min.apply(null, ys);
  }
  function bboxOf(segLists, pointLists) {
    var b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }, addP = function (q) { if (q.x < b.minX) b.minX = q.x; if (q.x > b.maxX) b.maxX = q.x; if (q.y < b.minY) b.minY = q.y; if (q.y > b.maxY) b.maxY = q.y; };
    segLists.forEach(function (segs) { sample(segs, 24).forEach(addP); segs.forEach(function (g) { addP(g.to); }); });
    pointLists.forEach(function (pl) { (pl || []).forEach(addP); });
    return b;
  }
  // ══ ⑦ 앞판 좌우 한 쌍 — 투영 계층(2026-11-19 · 순수 · 원본 조각·hash·저장 시접/너치/식서/수량 id 무변경) ══
  //   기본 셔츠 앞판 «front»(기본 수량 2)를 «왼앞판 1장 + 오른앞판 1장» 실제 거울상으로 보여 준다. 원본 조각 id «front» 는 그대로 한쪽이고,
  //   거울 쪽은 표시 전용 id «front~m» 로 둔다(저장 키가 아님 — 시접·너치·식서·수량 설정은 전부 원본 조각 id 에 그대로 연결, 두 조각이 같은 설정을 읽는다).
  //   거울 = 세로 축(x = 0) 반사: 곡선 조절점·다트·여밈·안단·너치·식서(각도 θ → 180−θ)·부착 표시를 모두 같은 변환으로 옮긴다. 글자는 뒤집지 않는다.
  //   쌍으로 펼치는 조건(전부 검증 · 어긋나면 아무것도 바꾸지 않고 사유만 남긴다): 조각 «front» 가 있고 · 외곽 검사 통과 · 다른 «front…» 조각이 없음(이미 분리/비대칭 아님) ·
  //   저장 수량 읽기 가능 · 지금 수량이 정확히 2 · 앞중심이 세로 직선으로 확인됨. 사용자가 수량을 2 가 아닌 값으로 바꿨으면 그 의미를 추정하지 않고 기존 한 조각 표시.
  //   좌우 이름 = 착용자 기준: 앞중심이 조각의 오른쪽 끝에 있으면 그 조각은 겉에서 정면으로 볼 때 화면 왼쪽 = 착용자의 오른쪽 몸판(오른앞판).
  //   2026-11-20 일반화: 같은 투영을 소매(sleeve-…)·커프스(cuff)에도 쓴다. 쌍 조건의 «수량» = 1(기본 · 한 쌍) — 사용자가 1 이 아닌 값을 정했으면 쌍으로 펼치지 않고 그 수량 그대로 한 조각.
  var PAIR_BASE = "front", PAIR_MIRROR = "front~m";
  function baseOf(id) { return String(id).replace(/~m$/, ""); }
  function isPairable(p) { return p.id === "front" || p.id === "cuff" || p.id === "vent-placket" || p.id === "vent-bias" || (p.group === "sleeve" && /^sleeve-/.test(p.id)); }
  //   좌우 쌍 조각의 읽는 이름(앞판·커프스·트임 덧단·트임 바이어스·소매) — 소매 트임은 소매마다 한 장씩이라 소매와 같은 쌍(2026-11-21).
  function pairKindName(base) { return base === "front" ? "앞판" : base === "cuff" ? "커프스" : base === "vent-placket" ? "트임 덧단" : base === "vent-bias" ? "트임 바이어스" : "소매"; }
  function sideName(side, base) { var w = side === "R" ? "오른" : "왼"; return w + pairKindName(!base ? "front" : base); }
  function sideLabel(label, side, base) { var nm = sideName(side, base); return base === "front" ? (/^앞판/.test(label) ? label.replace(/^앞판/, nm) : nm + " · " + label) : (nm + " · " + label); }
  function pairOne(d, proj, base, q) {
    var out = { active: false, base: base, mirrorId: base + "~m", reason: null }, no = function (r) { out.reason = r; return out; };
    var p = (d.pieces || []).filter(function (x) { return x.id === base; })[0]; if (!p) return out;
    var nm = pairKindName(base);
    if (!p.check.ok || !p.edges) return no(nm + " 외곽 검사가 끝나지 않아 좌우 한 쌍으로 펼치지 않았습니다");
    if (base === "front") {
      var other = (d.pieces || []).filter(function (x) { return x.id !== base && /^front/i.test(x.id); })[0];
      if (other) return no("앞판이 이미 따로 나뉘어 있어(«" + other.label + "») 좌우 한 쌍으로 펼치지 않고 기존 수량 그대로 둡니다");
    }
    var n = q.pieces[base] != null ? q.pieces[base] : defaultQty(base, false);
    if (n !== 1) return no(nm + " 재단 수량이 " + n + "장(직접 지정)이라 «왼 1장 + 오른 1장» 한 쌍으로 펼치지 않습니다 — 수량 의미를 추정해 바꾸지 않고 기존 한 조각 그대로 둡니다");
    var cfX = null, bb = bboxOf([p.segs], []);
    if (base === "front") {
      if (p.placket) cfX = p.placket.cfX;
      else {
        var ce = p.edges.filter(function (e) { return e.label === "center"; });
        if (ce.length === 1) { var cs = ce[0].segs.map(function (i) { return p.segs[i]; }); if (cs.every(function (g) { return g.kind === "line" && Math.abs(g.from.x - g.to.x) < 1e-6 && Math.abs(g.from.x - cs[0].from.x) < 1e-6; })) cfX = cs[0].from.x; }
      }
      if (cfX == null || !isFinite(cfX)) return no("앞중심을 세로 직선으로 확인하지 못해 좌우 한 쌍으로 펼치지 않았습니다");
    }
    // 앞판: 앞중심이 오른쪽 끝 = 오른앞판. 소매·커프스: 원본 = 오른쪽 · 반사 = 왼쪽(제도 기준 관례 — 모양이 거울상일 뿐 재단·봉제는 두 장이 한 쌍으로 같다)
    var origSide = base === "front" ? (cfX > (bb.minX + bb.maxX) / 2 ? "R" : "L") : "R", mirSide = origSide === "R" ? "L" : "R";
    out.active = true; out.origSide = origSide; out.mirrorSide = mirSide; out.cfX = cfX; out.qtyExplicit = q.pieces[base] != null;
    out.labels = {}; out.labels[base] = sideLabel(p.label, origSide, base); out.labels[out.mirrorId] = sideLabel(p.label, mirSide, base);
    out.viewerLeftFirst = origSide === "R";
    out.order = origSide === "R" ? [base, out.mirrorId] : [out.mirrorId, base];
    return out;
  }
  // 반환 = 앞판의 쌍 정보(기존 호환) + .all = { 원본 id: 쌍 정보 } (앞판·소매·커프스)
  function pairingOf(d, proj) {
    var q = readQty(proj), all = {}, head = null, reasons = [];
    (d.pieces || []).filter(isPairable).forEach(function (p) {
      if (q.state === "invalid") { all[p.id] = { active: false, base: p.id, mirrorId: p.id + "~m", reason: "저장된 재단 수량을 읽을 수 없어 좌우 한 쌍으로 펼치지 않습니다 — " + q.reason }; return; }
      all[p.id] = pairOne(d, proj, p.id, q);
    });
    head = all[PAIR_BASE] || { active: false, base: PAIR_BASE, mirrorId: PAIR_MIRROR, reason: null };
    var out = Object.assign({}, head); out.all = all;
    Object.keys(all).forEach(function (k) { if (k !== PAIR_BASE && all[k].reason) reasons.push(all[k].reason); });
    out.otherReasons = reasons;
    return out;
  }
  function mirrorDisp(r, pr) {
    var Mx = function (q) { return q ? { x: q.x === 0 ? 0 : -q.x, y: q.y } : q; }, Ms = function (g) { return mirSeg(g, Mx); }, o = Object.assign({}, r);
    o.id = pr.mirrorId; o.base = pr.base; o.instMirrored = true; o.pair = null; o.pairRole = "mirror"; o.side = pr.mirrorSide; o.label = pr.labels[pr.mirrorId];
    o.outline = r.outline.map(Ms); o.seam = r.seam ? r.seam.map(Mx) : r.seam; o.seamParts = (r.seamParts || []).map(function (pl) { return pl.map(Mx); });
    o.edges = (r.edges || []).map(function (e) { return { id: e.id, parts: e.parts.map(function (ps) { return ps.map(Ms); }), fold: e.fold }; });
    o.notches = (r.notches || []).map(function (n) { return { id: n.id, from: Mx(n.from), to: n.to ? Mx(n.to) : null }; });
    o.heldNotches = (r.heldNotches || []).map(function (n) { return { id: n.id, name: n.name, at: Mx(n.at), why: n.why }; });
    o.marks = (r.marks || []).map(function (mk) { var c = { kind: mk.kind, segs: mk.segs.map(Ms) }; if (mk.label) c.label = mk.label; if (mk.side) c.side = mk.side; return c; });
    o.guides = (r.guides || []).map(function (gd) { return Object.assign({}, gd, { a: Mx(gd.a), b: Mx(gd.b), tx: -gd.tx === 0 ? 0 : -gd.tx }); });
    o.trued = r.trued ? r.trued.map(Ms) : null;
    o.truedDarts = (r.truedDarts || []).map(function (q) { return Object.assign({}, q, { cap: q.cap.map(Mx), apex: Mx(q.apex) }); });
    o.mirror = { A: { x: 0, y: 0 }, B: { x: 0, y: 1 } };   // 눌린 점을 원본 좌표로 되돌릴 때(clickArc) 쓰는 같은 축
    o.bbox = bboxOf([o.outline], [o.seam].concat(o.seamParts));
    return o;
  }
  // ══ 기본 표시선(자르지 않는 선) — 2026-11-20 ══
  //   앞판 앞중심 «C.F» · 뒤판 뒤중심 «C.B» · 앞·뒤판 가슴선(BL = 옆선 위끝 높이 = blYOf) · 허리선(WL = 원형 기준 형상 outline 의 waist 변 높이 · derive 가 refY 로 싣는다 — 새로 계산하지 않는다).
  //   모델은 조각 좌표의 {kind, a, b, line, ko, en, tx, ty, th} — 화면·인쇄·DXF 가 같은 값을 읽는다(글자 중심 tx,ty · 높이 th cm). 중심선은 이미 그려지는 선(여밈 «앞중심» 표시 · 골선)이 있으면 line:false(글자만).
  var GUIDE_TEXT_CM = 0.4;
  function hChord(pts, y) { var xs = []; for (var i = 0; i < pts.length; i++) { var a = pts[i], b = pts[(i + 1) % pts.length]; if ((a.y - y) * (b.y - y) < 0 || (a.y === y && b.y !== y)) { var t = (y - a.y) / (b.y - a.y); xs.push(a.x + (b.x - a.x) * t); } } return xs.length >= 2 ? { x0: Math.min.apply(null, xs), x1: Math.max.apply(null, xs) } : null; }
  function guidesOf(p, r, refY) {
    var out = [];
    if (!r || (p.id !== "front" && p.id !== "back") || !p.edges || !p.check || !p.check.ok) return out;
    var pts = sample(r.outline, 24), bb = r.bbox, cxm = (bb.minX + bb.maxX) / 2, th = GUIDE_TEXT_CM, cfX = null, y0 = null, y1 = null, hasLine = false;
    if (p.id === "front" && p.placket) { cfX = p.placket.cfX; y0 = p.placket.topY; y1 = p.placket.botY; hasLine = true; }
    else {
      var ce = p.edges.filter(function (e) { return e.label === "center"; });
      if (ce.length === 1) { var cs = ce[0].segs.map(function (i) { return p.segs[i]; }); if (cs.every(function (g) { return g.kind === "line" && Math.abs(g.from.x - g.to.x) < 1e-6 && Math.abs(g.from.x - cs[0].from.x) < 1e-6; })) {
        cfX = cs[0].from.x; y0 = Math.min.apply(null, cs.map(function (g) { return Math.min(g.from.y, g.to.y); })); y1 = Math.max.apply(null, cs.map(function (g) { return Math.max(g.from.y, g.to.y); })); hasLine = r.foldEdge === ce[0].id; } }
    }
    if (cfX != null && isFinite(cfX) && y0 != null && y1 > y0) {
      var inw = Math.abs(cxm - cfX) < 0.5 ? 1 : (cxm < cfX ? -1 : 1), nm = p.id === "front" ? "C.F" : "C.B";
      out.push({ kind: p.id === "front" ? "cf" : "cb", a: { x: cfX, y: y0 }, b: { x: cfX, y: y1 }, line: !hasLine, ko: p.id === "front" ? "앞중심" : "뒤중심", en: nm, text: nm, tx: cfX + inw * 0.75, ty: y0 + (y1 - y0) * 0.55, th: th });
    }
    var bust = blYOf(p), waist = refY && refY[p.id] != null ? refY[p.id] : null;
    [["bust", bust, "가슴선", "BUST LINE"], ["waist", waist, "허리선", "WAIST LINE"]].forEach(function (g) {
      if (g[1] == null || !isFinite(g[1])) return;
      var ch = hChord(pts, g[1]); if (!ch) return;
      if (cfX != null) { if (cfX > cxm) ch.x1 = Math.min(ch.x1, cfX); else if (cfX < cxm) ch.x0 = Math.max(ch.x0, cfX); }
      if (!(ch.x1 - ch.x0 > 1)) return;
      out.push({ kind: g[0], a: { x: ch.x0, y: g[1] }, b: { x: ch.x1, y: g[1] }, line: true, ko: g[2], en: g[3], text: g[3], tx: ch.x0 + 0.5 + g[3].length * th * 0.3, ty: g[1] + th * 1.4, th: th });
    });
    return out;
  }
  // 조각별 표시 데이터. d = derive(proj, true) · m = seam(d, proj)
  function displayOf(d, m) {
    var out = {};
    (d.pieces || []).forEach(function (p) {
      if (!p.check.ok) return;
      var sm = m && m.pieces ? m.pieces[p.id] : null, fe = null;
      if (sm && p.edges) p.edges.forEach(function (e, k) { if (!fe && sm.edges[k] && sm.edges[k].kind === "fold") fe = e; });
      var u = fe ? unfoldOf(p, fe, sm) : null, unf = !!(u && u.ok);
      var r = { id: p.id, unfolded: unf, foldEdge: fe ? fe.id : null, foldWhy: fe && !unf ? u.why : null, outline: unf ? u.outline : p.segs,
        seam: unf ? u.seam : (sm && sm.ok ? sm.points : null), seamParts: [], edges: [], notches: [], marks: [], fold: null, blY: blYOf(p), mirror: unf ? { A: u.A, B: u.B } : null };
      if (unf && u.seamWhy) r.seamWhy = u.seamWhy;
      // 접어 정리한 완성 외곽(역할: 정리 외곽) — 원래 완성선(r.outline · 열린 다트 긴 V)과 따로 든다. 골 펼친 조각은 같은 방식으로 반사해 한 장.
      r.trued = null; r.truedDarts = [];
      if (sm && sm.trued) { var tu = unf ? unfoldOf({ segs: sm.trued.ring }, fe, null) : null; r.trued = unf ? (tu && tu.ok ? tu.outline : null) : sm.trued.ring;
        sm.trued.darts.forEach(function (q) { var cap = [q.newMouthA, q.peak, q.newMouthB]; r.truedDarts.push({ edgeId: q.edgeId, method: q.method, cap: cap, apex: q.apex }); if (unf) r.truedDarts.push({ edgeId: q.edgeId, method: q.method, cap: cap.map(u.M), apex: u.M(q.apex), mirrored: true }); }); }
      if (sm && !sm.ok) Object.keys(sm.edgePaths || {}).forEach(function (k) { r.seamParts.push(sm.edgePaths[k]); if (unf && k !== fe.id) r.seamParts.push(sm.edgePaths[k].map(u.M)); });
      (p.edges || []).forEach(function (e) {
        var segs = e.segs.map(function (i) { return p.segs[i]; });
        if (unf && e.id === fe.id) { r.fold = { edgeId: e.id, segs: segs }; r.edges.push({ id: e.id, parts: [segs], fold: true }); return; }
        r.edges.push({ id: e.id, parts: unf ? [segs, segs.map(function (g) { return mirSeg(g, u.M); })] : [segs] });
      });
      r.heldNotches = [];
      (sm && sm.notches || []).forEach(function (n) {
        if (n.held) { r.heldNotches.push({ id: n.id, name: n.name, at: n.from, why: n.heldWhy }); if (unf && n.edgeId !== fe.id && n.from) r.heldNotches.push({ id: n.id, name: n.name, at: u.M(n.from), why: n.heldWhy, mirrored: true }); return; }   // 보류 = 출력 모델에 넣지 않는다
        r.notches.push({ id: n.id, from: n.from, to: n.to });
        if (unf && n.edgeId !== fe.id && n.from) r.notches.push({ id: n.id, from: u.M(n.from), to: n.to ? u.M(n.to) : null, mirrored: true });
      });
      (p.marks || []).forEach(function (mk) { r.marks.push(mk); if (unf) r.marks.push({ kind: mk.kind, segs: mk.segs.map(function (g) { return mirSeg(g, u.M); }), label: mk.label, side: mk.side, mirrored: true }); });
      r.bbox = bboxOf([r.outline], [r.seam].concat(r.seamParts));
      out[p.id] = r;
    });
    // 기본 표시선(자르지 않음): 앞중심 C.F · 뒤중심 C.B · 가슴선 · 허리선 — 거울 쪽은 같은 변환으로 옮긴다
    (d.pieces || []).forEach(function (p) { if (out[p.id]) out[p.id].guides = guidesOf(p, out[p.id], d.refY); });
    var prs = m && m.pairing && m.pairing.all;   // ⑦ 좌우 한 쌍(앞판·소매·커프스 — 조건은 pairOne · 어긋나면 아무것도 하지 않는다)
    Object.keys(prs || {}).forEach(function (bk) {
      var pr = prs[bk];
      if (!(pr && pr.active && out[pr.base] && !out[pr.base].unfolded && out[pr.base].seam)) return;
      var o0 = out[pr.base]; o0.base = pr.base; o0.pairRole = "orig"; o0.side = pr.origSide; o0.label = pr.labels[pr.base];
      o0.pair = { mirrorId: pr.mirrorId, viewerLeftFirst: pr.viewerLeftFirst };
      out[pr.mirrorId] = mirrorDisp(o0, pr);
      // 앞 주머니 달림선(착용자 기준 한쪽)은 그 쪽 앞판에만 — 반대쪽 거울상에 복사하지 않는다.
      [[pr.base, pr.origSide], [pr.mirrorId, pr.mirrorSide]].forEach(function (e) {
        var rr = out[e[0]], want = e[1] === "R" ? "right" : "left";
        rr.marks = rr.marks.filter(function (mk) { return mk.kind !== "pocket-attach" || mk.side === want; });
      });
    });
    return out;
  }
  // 화면에서 누른 점(조각 좌표) → 그 변 위 봉제 경로 위치(호 길이). 반사 쪽 경로를 눌렀으면(mirrored) 먼저 골선에 대해 되돌린다.
  //   반사 여부는 «눌린 경로가 반사 쪽으로 그린 것인가»로만 정한다(축 위 점·부동소수점 판정에 기대지 않는다).
  function clickArc(p, r, eid, q, mirrored) {
    if (mirrored && r && r.mirror) q = mirrorFn(r.mirror.A, r.mirror.B)(q);
    var e = p && p.edges && p.edges.filter(function (x) { return x.id === eid; })[0]; if (!e) return null;
    var ch = sewnChain(p, e), acc = 0, best = null;
    ch.forEach(function (g) { var L = segLenOf(g), N = g.kind === "cubic" ? 200 : 1, prev = g.from, a = acc;
      for (var k = 1; k <= N; k++) { var cur = g.kind === "cubic" ? cubicAt(g, k / N) : g.to, vx = cur.x - prev.x, vy = cur.y - prev.y, l2 = vx * vx + vy * vy, t = l2 ? Math.max(0, Math.min(1, ((q.x - prev.x) * vx + (q.y - prev.y) * vy) / l2)) : 0, dd = Math.hypot(q.x - prev.x - vx * t, q.y - prev.y - vy * t), sl = Math.sqrt(l2);
        if (!best || dd < best.d) best = { d: dd, s: a + sl * t }; a += sl; prev = cur; }
      acc += L; });
    return best ? Math.max(0, Math.min(acc, best.s)) : null;
  }
  // 배치: 1줄 = 뒤판 → 앞판(몸판 · BL 높이 맞춤) → 소매 · 2줄 = 작은 부속(커프스·트임·카라 등). 간격은 시접 포함 테두리 기준.
  var ROW_RANK = function (p) {
    if (p.group === "bodice") return /^back|Back$/.test(p.id) || /^back/.test(p.id) ? 0 : 1;
    if (p.group === "sleeve" && /^sleeve-/.test(p.id)) return 2;
    return 3;
  };
  function orderOf(pieces) {
    return pieces.map(function (p, i) { return { p: p, r: ROW_RANK(p), i: i }; }).sort(function (a, b) { return a.r - b.r || a.i - b.i; }).map(function (x) { return x.p; });
  }
  function layoutOf(pieces, disp) {
    var shown = [], pos = {}, G = 6;
    orderOf(pieces.filter(function (p) { return p.check.ok && disp[p.id]; })).forEach(function (p) {   // ⑦ 쌍으로 펼친 앞판 = 화면 왼쪽(착용자 오른쪽) → 오른쪽 순으로 나란히
      var pr = disp[p.id].pair, mp = pr && disp[pr.mirrorId] ? Object.assign({}, p, { id: pr.mirrorId, label: disp[pr.mirrorId].label }) : null;
      if (!mp) { shown.push(p); return; }
      if (pr.viewerLeftFirst) shown.push(p, mp); else shown.push(mp, p);
    });
    var row1 = shown.filter(function (p) { return ROW_RANK(p) < 3; }), row2 = shown.filter(function (p) { return ROW_RANK(p) === 3; });
    var bod = row1.filter(function (p) { return p.group === "bodice"; }), blOK = bod.length > 0 && bod.every(function (p) { return disp[p.id].blY != null; });
    var lift = blOK ? Math.max.apply(null, bod.map(function (p) { return disp[p.id].blY - disp[p.id].bbox.minY; })) : 0;   // 줄 위끝 → BL
    var x = 0, h1 = 0;
    row1.forEach(function (p) {
      var b = disp[p.id].bbox, w = b.maxX - b.minX, dy = (blOK && p.group === "bodice") ? lift - disp[p.id].blY : -b.minY;
      pos[p.id] = { dx: x - b.minX, dy: dy, x: x, y: b.minY + dy };
      x += w + G; h1 = Math.max(h1, b.maxY + dy);
    });
    var rowW = Math.max(120, x - G), y = row1.length ? h1 + G + 4 : 0, x2 = 0, rh = 0;
    row2.forEach(function (p) {
      var b = disp[p.id].bbox, w = b.maxX - b.minX, h = b.maxY - b.minY;
      if (x2 > 0 && x2 + w > rowW) { x2 = 0; y += rh + G; rh = 0; }
      pos[p.id] = { dx: x2 - b.minX, dy: y - b.minY, x: x2, y: y };
      x2 += w + G; rh = Math.max(rh, h);
    });
    return { pos: pos, width: Math.max(rowW, 10), height: row2.length ? y + rh : h1, blY: blOK ? lift : null, blAligned: blOK, order: shown.map(function (p) { return p.id; }) };
  }

  // ══ 재단 수량(working.cutQty · 판 1 · 2026-11-15 master 확정 기본값) ══
  //   (2026-11-20 이전 기본 «앞판 2·소매 2·칼라 골 2…» 는 폐기 — 아래 defaultQty 가 현재 규칙: 전부 1. 칼라·밴드는 1장이고 겉감·안감 각각 재단은 안내 문구로만 말한다.) 그 밖 조각 = 기본 없음(직접 입력).
  //   펼친 한 장은 한 장 — 거울 표시로 수량을 두 배로 하지 않는다. 사용자가 고친 값만 저장. 엄격 검증(모르는 키·판·정수 1~99 아님 = 읽지 않음 · 잠금).
  var QTY_ID = /^[a-z][A-Za-z0-9-]{0,40}$/;
  function readQty(proj) {
    var s = proj && proj.working ? proj.working.cutQty : null;
    if (s == null) return { state: "none", pieces: {} };
    var bad = function (r) { return { state: "invalid", reason: r, pieces: {} }; };
    if (typeof s !== "object" || Array.isArray(s) || Object.keys(s).sort().join(",") !== "pieces,schema") return bad("형식 오류(schema·pieces 만 허용)");
    if (s.schema !== 1) return bad("모르는 판(schema " + s.schema + ")");
    if (!s.pieces || typeof s.pieces !== "object" || Array.isArray(s.pieces)) return bad("조각 목록 형식 오류");
    var ks = Object.keys(s.pieces);
    for (var i = 0; i < ks.length; i++) { var v = s.pieces[ks[i]]; if (!QTY_ID.test(ks[i])) return bad("조각 id 형식 오류(" + ks[i] + ")"); if (!(typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 99)) return bad("수량은 1~99 정수(" + ks[i] + ")"); }
    return { state: "ok", pieces: s.pieces };
  }
  //   2026-11-20 김님 확정: 모든 재단 수량 기본 1. 좌우가 있는 조각(앞판·소매·커프스)은 «왼 1 + 오른 1» 거울 쌍으로 보이고(수량 1 = 한 쌍), 골로 쓰는 조각(뒤판·칼라·밴드)은 골 1장.
  function defaultQty(id, folded) {
    if (id === "back" || id === "front" || id === "pocket" || id === "cuff" || id === "vent-placket" || id === "vent-bias" || id === "collar-stand" || id === "collar-body" || /^sleeve-/.test(id)) return 1;
    return null;
  }
  function qtyOf(d, disp, proj) {
    var q = readQty(proj), out = { state: q.state, reason: q.reason || null, pieces: {}, stale: [] };
    (d.pieces || []).forEach(function (p) {
      if (!p.check.ok) return;
      var folded = !!(disp[p.id] && disp[p.id].unfolded), def = defaultQty(p.id, folded), mine = q.pieces[p.id];
      out.pieces[p.id] = { qty: mine != null ? mine : def, explicit: mine != null, def: def, folded: folded,
        how: folded ? "골 · 펼친 한 장" : "" };
      if (/^collar-/.test(p.id)) out.pieces[p.id].how = folded ? "골 1장 · 겉감·안감은 각각 재단" : "1장 · 겉감·안감은 각각 재단";   // 수량 1 = 조각 한 장(2026-11-21 김님: 수량은 1 로 두고 몇 장 자를지는 안내·재단 단계가 정한다)
    });
    Object.keys(q.pieces).forEach(function (k) { if (!out.pieces[k]) out.stale.push(k); });
    // ⑦ 쌍으로 펼친 앞판: 저장 수량(원본 id · 2)은 그대로 두고, 보이는 두 조각은 각 1장. out.inst = 조각 «표시 id» 별 재단 장 수(인쇄·DXF·화면 글자가 읽는다).
    out.inst = {};
    Object.keys(disp).forEach(function (id) {
      var r = disp[id]; if (!r || !r.pair || !out.pieces[id] || disp[r.pair.mirrorId] == null) return;
      var b = out.pieces[id]; b.how = (b.how ? b.how + " · " : "") + sideName("L", r.base) + " 1장 + " + sideName("R", r.base) + " 1장(거울상 쌍)"; b.paired = true;
      [id, r.pair.mirrorId].forEach(function (k) { out.inst[k] = { qty: 1, explicit: b.explicit, def: 1, folded: false, how: "착용자 기준 " + sideName(disp[k].side, disp[k].base) + " 1장 · 거울상 쌍", paired: true, side: disp[k].side }; });
    });
    return out;
  }
  function setQty(pid, n, proj) {
    proj = proj || project(); var q = readQty(proj); if (q.state === "invalid") return { ok: false, reason: "저장된 재단 수량을 읽을 수 없어 고치지 않습니다 — " + q.reason };
    var d = derive(proj, true); if (d.state !== "ready") return { ok: false, reason: d.reason };
    if (!d.pieces.some(function (p) { return p.id === pid && p.check.ok; })) return { ok: false, reason: "이 조각이 없습니다" };
    if (n !== null && !(typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 99)) return { ok: false, reason: "수량은 1~99 정수로 적어 주세요" };
    if (!proj.working.cutQty) proj.working.cutQty = { schema: 1, pieces: {} };
    if (n === null) delete proj.working.cutQty.pieces[pid]; else proj.working.cutQty.pieces[pid] = n;
    return { ok: true };
  }

  // ══ 식서(올 방향) 표시 — working.cutGrain 판 1 (2026-11-16 master 승인) ══
  //   근거: [패턴학교] P.169 «시접 포함 패턴의 완성 예»(셔츠) — 뒤·앞 = 중심선과 평행 · 소매 = 소매 중심선과 평행 · 위 칼라·칼라 밴드·커프스 = 길이 방향 ·
  //         덧단 = 길이 방향. 트임 바이어스 = 45°(P.91 «바이어스»). 그 밖 조각(요크·프린세스·두 장 소매 등)은 근거 미확인 → 기본 없음(직접 지정).
  //   각도 = 조각 좌표의 가로축 기준(가로 0° · 세로 90° · 0 ≤ 각도 < 180). 위치 = 화살표 가운데(조각 좌표 cm). 길이는 저장하지 않는다 —
  //   가운데에서 양쪽으로 «처음 만나는 외곽»까지만 재서 여백을 두고 그리므로 오목한 조각에서도 조각 밖으로 나가지 않는다. 골을 펼친 조각에도 하나만.
  //   사용자가 고친 값만 저장. 엄격 검증(모르는 키·판·범위 밖 = 읽지 않음 · 잠금). 원본 조각·완료 hash·시접·너치·수량 무변경.
  var GRAIN_CAP_CM = 10, GRAIN_MARGIN_CM = 0.5, GRAIN_SIDE_CM = 0.3, GRAIN_MIN_CM = 1.2, GRAIN_P169 = "[패턴학교] P.169 완성 예";
  var GRAIN_AT_CACHE = {};
  function normAngle(a) { a = ((a % 180) + 180) % 180; a = Math.round(a * 1e4) / 1e4; return a >= 180 ? 0 : a; }
  function angleOfDir(dx, dy) { return normAngle(Math.atan2(dy, dx) * 180 / Math.PI); }
  // 조각 서명 = 원본 완성 외곽(p.segs)만. 시접 폭·수량·골 펼침(표시)은 들어가지 않는다 → 그것만 바뀌면 서명은 그대로.
  //   식서 각도·자리는 형상에 딸린 값이라, 저장할 때의 서명과 지금 서명이 다르면 그 설정은 «보류»(적용 안 함 · 지우지 않음).
  var GRAIN_SIG = /^n\d{1,4}-[0-9a-f]{1,8}-[0-9a-f]{1,8}$/;
  function grainSig(p) {
    var r3 = function (v) { var x = Math.round(v * 1e3); return x === 0 ? 0 : x; }, pt = function (q) { return r3(q.x) + "," + r3(q.y); }, segs = p.segs || [];
    var t = segs.map(function (g) { return g.kind === "cubic" ? "C" + pt(g.from) + ";" + pt(g.c1) + ";" + pt(g.c2) + ";" + pt(g.to) : "L" + pt(g.from) + ";" + pt(g.to); }).join("|");
    var h2 = 5381; for (var i = 0; i < t.length; i++) h2 = ((h2 * 33) ^ t.charCodeAt(i)) | 0;
    return "n" + segs.length + "-" + hashStr(t) + "-" + (h2 >>> 0).toString(16);
  }
  function readGrain(proj) {
    var s = proj && proj.working ? proj.working.cutGrain : null;
    if (s == null) return { state: "none", pieces: {} };
    var bad = function (r) { return { state: "invalid", reason: r, pieces: {} }; }, num = function (v) { return typeof v === "number" && Number.isFinite(v); };
    if (typeof s !== "object" || Array.isArray(s) || Object.keys(s).sort().join(",") !== "pieces,schema") return bad("형식 오류(schema·pieces 만 허용)");
    if (s.schema !== 1) return bad("모르는 판(schema " + s.schema + ")");
    if (!s.pieces || typeof s.pieces !== "object" || Array.isArray(s.pieces)) return bad("조각 목록 형식 오류");
    var ks = Object.keys(s.pieces);
    for (var i = 0; i < ks.length; i++) {
      var k = ks[i], v = s.pieces[k]; if (!QTY_ID.test(k)) return bad("조각 id 형식 오류(" + k + ")");
      if (!v || typeof v !== "object" || Array.isArray(v)) return bad("식서 항목 형식 오류(" + k + ")");
      var vk = Object.keys(v); if (vk.length < 2 || vk.some(function (x) { return x !== "angleDeg" && x !== "at" && x !== "sig"; })) return bad("식서 항목은 sig 와 angleDeg·at 만 허용(" + k + ")");
      if (!(typeof v.sig === "string" && GRAIN_SIG.test(v.sig))) return bad("조각 서명(sig) 없음·형식 오류(" + k + ")");
      if ("angleDeg" in v && !(num(v.angleDeg) && v.angleDeg >= 0 && v.angleDeg < 180)) return bad("각도는 0 이상 180 미만(" + k + ")");
      if ("at" in v && !(v.at && typeof v.at === "object" && !Array.isArray(v.at) && Object.keys(v.at).sort().join(",") === "x,y" && num(v.at.x) && num(v.at.y) && Math.abs(v.at.x) <= 10000 && Math.abs(v.at.y) <= 10000)) return bad("위치는 x·y 숫자(" + k + ")");
    }
    return { state: "ok", pieces: s.pieces };
  }
  function edgeDir(p, e) { var a = p.segs[e.segs[0]].from, b = p.segs[e.segs[e.segs.length - 1]].to; return { dx: b.x - a.x, dy: b.y - a.y }; }
  function defaultGrain(p) {
    var id = p.id, E = function (re) { return (p.edges || []).filter(function (e) { return re.test(e.id); })[0]; }, no = function (w) { return { angleDeg: null, why: w }; };
    if (id === "front" || id === "back") return { angleDeg: 90, basis: "앞·뒤 중심선과 평행 — " + GRAIN_P169 };
    if (id === "sleeve-sleeve") return { angleDeg: 90, basis: "소매 중심선과 평행 — " + GRAIN_P169 };
    if (id === "pocket") return { angleDeg: 90, basis: "앞판 식서와 같은 세로 방향 — 앱 기본값(P.100 에는 식서 표시를 확인하지 못함)" };
    if (id === "cuff") { var ce = E(/^attach-edge$/); if (!ce) return no("커프스 달림선을 찾지 못함"); var cd = edgeDir(p, ce); return { angleDeg: angleOfDir(cd.dx, cd.dy), basis: "커프스 길이 방향 — " + GRAIN_P169 }; }
    if (id === "collar-stand" || id === "collar-body") { var cb = E(/^cb(-|$)/); if (!cb) return no("뒤중심선을 찾지 못함"); var d = edgeDir(p, cb); if (Math.hypot(d.dx, d.dy) < 1e-6) return no("뒤중심선 길이 0");
      return { angleDeg: angleOfDir(-d.dy, d.dx), basis: "뒤중심과 직각(길이 방향) — " + GRAIN_P169 }; }
    if (id === "vent-placket" || id === "vent-bias") { var fm = (p.marks || []).filter(function (m) { return m.kind === "fold"; })[0], g = fm && fm.segs && fm.segs[0]; if (!g) return no("접는선을 찾지 못함");
      var fa = angleOfDir(g.to.x - g.from.x, g.to.y - g.from.y);
      return id === "vent-placket" ? { angleDeg: fa, basis: "덧단 길이 방향 — " + GRAIN_P169 } : { angleDeg: normAngle(fa - 45), basis: "바이어스 — 길이 방향에서 45°(P.91)" }; }
    return no("교재 근거를 아직 확인하지 못한 조각 — 각도를 직접 지정");
  }
  function polyOf(segs) { var o = sample(segs, 24); return o; }
  function inPolyPt(q, poly) { var c = false; for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) { var a = poly[i], b = poly[j]; if ((a.y > q.y) !== (b.y > q.y) && q.x < (b.x - a.x) * (q.y - a.y) / (b.y - a.y) + a.x) c = !c; } return c; }
  // 가운데 c 에서 각도 방향 양쪽으로 «처음 만나는 외곽»까지의 구간 안에서만 그린다 → 조각 밖을 지나지 않는다.
  function grainLine(poly, c, angleDeg) {
    if (!poly || poly.length < 3 || !inPolyPt(c, poly)) return { ok: false, why: "가운데가 조각 밖" };
    var th = angleDeg * Math.PI / 180, ux = Math.cos(th), uy = Math.sin(th), tn = -Infinity, tp = Infinity;
    for (var i = 0; i < poly.length; i++) {
      var a = poly[i], b = poly[(i + 1) % poly.length], ex = b.x - a.x, ey = b.y - a.y, den = ux * ey - uy * ex; if (Math.abs(den) < 1e-12) continue;
      var t = ((a.x - c.x) * ey - (a.y - c.y) * ex) / den, w = ((a.x - c.x) * uy - (a.y - c.y) * ux) / den; if (w < -1e-9 || w > 1 + 1e-9) continue;
      if (t < 0 && t > tn) tn = t; if (t >= 0 && t < tp) tp = t;
    }
    if (!Number.isFinite(tn) || !Number.isFinite(tp)) return { ok: false, why: "외곽을 만나지 못함" };
    var half = Math.min(-tn - GRAIN_MARGIN_CM, tp - GRAIN_MARGIN_CM, GRAIN_CAP_CM / 2);
    if (half * 2 < GRAIN_MIN_CM) return { ok: false, why: "이 자리·각도에서는 화살표가 조각 안에 들어가지 않음" };
    for (var k = -2; k <= 2; k++) if (clearOf({ x: c.x + ux * half * k / 2, y: c.y + uy * half * k / 2 }, poly) < GRAIN_SIDE_CM) return { ok: false, why: "외곽에 너무 붙음(화살촉이 밖으로 나감)" };
    return { ok: true, from: { x: c.x - ux * half, y: c.y - uy * half }, to: { x: c.x + ux * half, y: c.y + uy * half }, lenCm: half * 2, roomCm: tp - tn };
  }
  function clearOf(q, poly) { var m = Infinity; for (var i = 0; i < poly.length; i++) { var a = poly[i], b = poly[(i + 1) % poly.length], vx = b.x - a.x, vy = b.y - a.y, l2 = vx * vx + vy * vy, t = l2 ? Math.max(0, Math.min(1, ((q.x - a.x) * vx + (q.y - a.y) * vy) / l2)) : 0, dd = Math.hypot(q.x - a.x - vx * t, q.y - a.y - vy * t); if (dd < m) m = dd; } return m; }
  function clearOpen(q, pts) { var m = Infinity; for (var i = 0; i + 1 < pts.length; i += 2) { var a = pts[i], b = pts[i + 1], vx = b.x - a.x, vy = b.y - a.y, l2 = vx * vx + vy * vy, t = l2 ? Math.max(0, Math.min(1, ((q.x - a.x) * vx + (q.y - a.y) * vy) / l2)) : 0, dd = Math.hypot(q.x - a.x - vx * t, q.y - a.y - vy * t); if (dd < m) m = dd; } return m; }
  // 기본 자리: 원래(반쪽) 조각 안의 격자점 가운데 — 화살표가 길게 들어가고 · 외곽에서 떨어지고 · 조각 이름 글자와 겹치지 않는 곳. 펼친 조각도 원래 쪽에 하나.
  function defaultGrainAt(halfPoly, dispPoly, angleDeg, labelBox, markPts) {
    var b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }; halfPoly.forEach(function (q) { b.minX = Math.min(b.minX, q.x); b.maxX = Math.max(b.maxX, q.x); b.minY = Math.min(b.minY, q.y); b.maxY = Math.max(b.maxY, q.y); });
    var N = 24, best = null, mx = (b.minX + b.maxX) / 2, my = (b.minY + b.maxY) / 2;
    for (var i = 1; i < N; i++) for (var j = 1; j < N; j++) {
      var c = { x: b.minX + (b.maxX - b.minX) * i / N, y: b.minY + (b.maxY - b.minY) * j / N }; if (!inPolyPt(c, halfPoly)) continue;
      var g = grainLine(dispPoly, c, angleDeg); if (!g.ok) continue;
      var hit = labelBox && Math.max(g.from.x, g.to.x) >= labelBox.x0 && Math.min(g.from.x, g.to.x) <= labelBox.x1 && Math.max(g.from.y, g.to.y) >= labelBox.y0 && Math.min(g.from.y, g.to.y) <= labelBox.y1;
      var onMark = markPts && markPts.length > 1 && clearOpen(c, markPts) < 0.5;   // 접는선·앞중심선 위에 겹쳐 놓지 않는다
      var sc = g.lenCm + 1.5 * Math.min(clearOf(c, dispPoly), 3) - (hit ? 4 : 0) - (onMark ? 3 : 0) - 0.02 * Math.hypot(c.x - mx, c.y - my);
      if (!best || sc > best.sc + 1e-9) best = { sc: sc, c: c };
    }
    return best ? { x: r4(best.c.x), y: r4(best.c.y) } : null;
  }
  // d = derive(proj, true) · disp = displayOf(d, m)
  function grainOf(d, disp, proj) {
    var q = readGrain(proj), out = { state: q.state, reason: q.reason || null, pieces: {}, stale: [], held: [] };
    (d.pieces || []).forEach(function (p) {
      if (!p.check.ok || !disp[p.id]) return;
      var r = disp[p.id], saved = q.pieces[p.id] || null, sig = grainSig(p), held = !!saved && saved.sig !== sig, mine = saved && !held ? saved : {}, def = defaultGrain(p), ang = "angleDeg" in mine ? mine.angleDeg : def.angleDeg;
      var o = { held: held, heldAngleDeg: held && "angleDeg" in saved ? saved.angleDeg : null, heldAt: held && saved.at ? { x: saved.at.x, y: saved.at.y } : null, tempDefault: held && ang != null,
        heldWhy: held ? "조각 외곽이 이 식서를 정할 때와 달라짐" : null, ok: false, angleDeg: ang, defAngleDeg: def.angleDeg, basis: def.basis || null, why: def.why || null, explicitAngle: "angleDeg" in mine, explicitAt: "at" in mine, atStale: false, unfolded: !!r.unfolded };
      out.pieces[p.id] = o; if (held) out.held.push(p.id);
      if (ang == null) { o.why = def.why; return; }
      var dispPoly = polyOf(r.outline), halfPoly = r.unfolded ? polyOf(p.segs) : dispPoly, g = null;
      if (mine.at) { g = grainLine(dispPoly, mine.at, ang); if (g.ok) o.at = { x: mine.at.x, y: mine.at.y }; else { o.atStale = true; g = null; } }
      if (!g) {
      var bb = r.bbox, cx = (bb.minX + bb.maxX) / 2, cy = (bb.minY + bb.maxY) / 2, fs = Math.max(1.2, Math.min(2.4, (bb.maxX - bb.minX) / 9)), hw = (String(p.label).length + 3) * fs * 0.5;
        var mk = []; (p.marks || []).forEach(function (m0) { if (/^zone-/.test(m0.kind)) return; m0.segs.forEach(function (sg) { if (sg.kind === "line") mk.push(sg.from, sg.to); }); });
        if (r.fold) r.fold.segs.forEach(function (sg) { mk.push(sg.from, sg.to); });
        var ck = [d.resultHash, sig, p.id, r.unfolded ? r.foldEdge : "-", ang, r4(bb.minX), r4(bb.maxX), r4(bb.minY), r4(bb.maxY)].join("|"), at;   // 기본 자리 찾기는 무겁다 → 같은 모양·각도면 다시 찾지 않는다
        if (ck in GRAIN_AT_CACHE) at = GRAIN_AT_CACHE[ck];
        else { at = defaultGrainAt(halfPoly, dispPoly, ang, { x0: cx - hw, x1: cx + hw, y0: cy - fs * 0.9, y1: cy + fs * 1.3 }, mk); if (Object.keys(GRAIN_AT_CACHE).length > 300) GRAIN_AT_CACHE = {}; GRAIN_AT_CACHE[ck] = at; }
        if (!at) { o.why = "이 각도로는 화살표가 조각 안에 들어갈 자리가 없음"; return; }
        g = grainLine(dispPoly, at, ang); o.at = at;
      }
      o.ok = true; o.from = g.from; o.to = g.to; o.lenCm = g.lenCm; o.why = null;
    });
    Object.keys(q.pieces).forEach(function (k) { if (!out.pieces[k]) out.stale.push(k); });
    // ⑦ 쌍의 거울 쪽 식서: 같은 설정을 세로 축 반사(위치 x → −x · 각도 θ → 180−θ). 저장 키는 원본 조각 id 하나 — 거울 쪽은 읽기 전용 파생.
    Object.keys(disp).forEach(function (id) {
      var r = disp[id], o = r && r.pair && out.pieces[id]; if (!o) return;
      var Mx = function (c) { return c ? { x: c.x === 0 ? 0 : -c.x, y: c.y } : c; };
      out.pieces[r.pair.mirrorId] = Object.assign({}, o, { mirroredFrom: id, from: Mx(o.from), to: Mx(o.to), at: Mx(o.at), angleDeg: o.angleDeg == null ? null : normAngle(180 - o.angleDeg), heldAt: Mx(o.heldAt) });
    });
    return out;
  }
  // patch ={ angleDeg: 숫자 | null(기본으로) , at: {x,y} | null(기본 자리로) } — 적은 것만 바꾼다. 조각 밖·들어가지 않는 자리는 거부(저장 안 함).
  function setGrain(pid, patch, proj) {
    proj = proj || project(); var q = readGrain(proj); if (q.state === "invalid") return { ok: false, reason: "저장된 식서 설정을 읽을 수 없어 고치지 않습니다 — " + q.reason };
    var d = derive(proj, true); if (d.state !== "ready") return { ok: false, reason: d.reason };
    var p = d.pieces.filter(function (x) { return x.id === pid && x.check.ok; })[0]; if (!p) return { ok: false, reason: "이 조각이 없습니다" };
    if (!patch || typeof patch !== "object") return { ok: false, reason: "바꿀 값이 없습니다" };
    var sig = grainSig(p), saved = q.pieces[pid] || null, wasHeld = !!saved && saved.sig !== sig, cur = saved && !wasHeld ? saved : {}, next = {}, num = function (v) { return typeof v === "number" && Number.isFinite(v); };
    if ("angleDeg" in cur) next.angleDeg = cur.angleDeg; if ("at" in cur) next.at = { x: cur.at.x, y: cur.at.y };
    if ("angleDeg" in patch) { if (patch.angleDeg === null) delete next.angleDeg; else if (!num(patch.angleDeg) || patch.angleDeg < 0 || patch.angleDeg > 180) return { ok: false, reason: "각도는 0~180 사이 숫자로 적어 주세요(가로 0 · 세로 90)" }; else next.angleDeg = normAngle(patch.angleDeg); }
    if ("at" in patch) { if (patch.at === null) delete next.at; else if (!patch.at || !num(patch.at.x) || !num(patch.at.y)) return { ok: false, reason: "위치 값이 숫자가 아닙니다" }; else next.at = { x: r4(patch.at.x), y: r4(patch.at.y) }; }
    var disp = displayOf(d, seamOf(d, proj))[pid], ang = "angleDeg" in next ? next.angleDeg : defaultGrain(p).angleDeg;
    if (ang == null && next.at) return { ok: false, reason: "먼저 각도를 정해 주세요(이 조각은 기본 방향이 없습니다)" };
    if (ang != null && disp) {
      var poly = polyOf(disp.outline);
      if (next.at) { var g = grainLine(poly, next.at, ang); if (!g.ok) return { ok: false, reason: "그 자리에는 둘 수 없습니다 — " + g.why }; }
      else if (!defaultGrainAt(disp.unfolded ? polyOf(p.segs) : poly, poly, ang, null)) return { ok: false, reason: "이 각도로는 화살표가 조각 안에 들어갈 자리가 없습니다" };
    }
    if (!proj.working.cutGrain) proj.working.cutGrain = { schema: 1, pieces: {} };
    if (Object.keys(next).length) { var ent = { sig: sig }; if ("angleDeg" in next) ent.angleDeg = next.angleDeg; if ("at" in next) ent.at = next.at; proj.working.cutGrain.pieces[pid] = ent; } else delete proj.working.cutGrain.pieces[pid];
    return { ok: true, replacedHeld: wasHeld };   // 보류 중에 사용자가 직접 고치면 그 값이 지금 외곽에 대한 새 설정이 된다(예전 값은 이어 쓰지 않음)
  }
  // 보류된 설정을 지금 외곽에 다시 연결(사용자가 누를 때만). 지금 외곽에 들어가지 않으면 거부 — 저장값은 그대로 둔다.
  function relinkGrain(pid, proj) {
    proj = proj || project(); var q = readGrain(proj); if (q.state === "invalid") return { ok: false, reason: "저장된 식서 설정을 읽을 수 없어 고치지 않습니다 — " + q.reason };
    var d = derive(proj, true); if (d.state !== "ready") return { ok: false, reason: d.reason };
    var p = d.pieces.filter(function (x) { return x.id === pid && x.check.ok; })[0]; if (!p) return { ok: false, reason: "이 조각이 없습니다" };
    var saved = q.pieces[pid], sig = grainSig(p); if (!saved || saved.sig === sig) return { ok: false, reason: "보류된 식서 설정이 없습니다" };
    var ang = "angleDeg" in saved ? saved.angleDeg : defaultGrain(p).angleDeg, disp = displayOf(d, seamOf(d, proj))[pid];
    if (ang == null) return { ok: false, reason: "이 조각은 기본 방향이 없어 자리만으로는 다시 쓸 수 없습니다 — 각도를 적어 주세요" };
    if (!disp) return { ok: false, reason: "이 조각을 표시할 수 없습니다" };
    var poly = polyOf(disp.outline);
    if (saved.at) { var g = grainLine(poly, saved.at, ang); if (!g.ok) return { ok: false, reason: "예전 자리가 지금 조각 모양에는 들어가지 않습니다(" + g.why + ") — 각도를 다시 적거나 «기본값»을 눌러 주세요" }; }
    else if (!defaultGrainAt(disp.unfolded ? polyOf(p.segs) : poly, poly, ang, null)) return { ok: false, reason: "예전 각도로는 지금 조각 안에 화살표가 들어갈 자리가 없습니다" };
    saved.sig = sig; return { ok: true };
  }

  // 가벼운 상태 확인(조각을 만들지 않는다) — 탭 활성·안내용. derive 와 같은 판정·같은 문구.
  function peek(proj) {
    var d = gate(proj || project());
    return d.latest ? deepFreeze({ state: "ready", resultHash: d.latest.hash }) : d;
  }
  function derive(proj, withEdges) {
    var d = gate(proj || project()); if (!d.latest) return d;
    var latest = d.latest, b = buildPieces(latest, !!withEdges), bad = b.pieces.filter(function (p) { return !p.check.ok; }).length;
    proj = proj || project();
    var out = {
      state: "ready", resultHash: latest.hash, completedAt: latest.completedAt || null,
      sourceBlock: { version: latest.sourceBlock ? latest.sourceBlock.version : null },
      pieces: b.pieces, missing: b.missing, excluded: b.excluded, info: b.info, failedPieces: bad,
      previewPartsIgnored: !!(proj.working && Array.isArray(proj.working.parts) && proj.working.parts.length)
    };
    var rg = proj && proj.referenceGeometry, ry = {};   // 허리선 높이 = 원형 기준 형상 앞·뒤 outline 의 waist 변 y(그대로 읽는다)
    ["front", "back"].forEach(function (k) { var o = rg && rg[k] && Array.isArray(rg[k].outline) ? rg[k].outline : [], w = o.filter(function (g) { return g && g.edge === "waist" && g.from && g.to && isFinite(g.from.y) && Math.abs(g.from.y - g.to.y) < 1e-6; })[0]; if (w) ry[k] = w.from.y; });
    out.refY = ry;
    if (withEdges) { var nsp = readNotchSpec(proj); out.notches = notchesOf(latest, b.pieces, nsp.split); }   // 맞춤 표시는 요청할 때만(기본 derive 출력은 그대로)
    return deepFreeze(out);
  }
  function gate(proj) {
    var DR = W().designResult;
    if (!proj) return deepFreeze({ state: "no-project", reason: FAIL_TEXT["no-project"] + " — 원형 완료 → «디자인 시작»", returnTab: null });
    if (!DR) return deepFreeze({ state: "no-project", reason: FAIL_TEXT["no-module"], returnTab: null });
    var latest = DR.latest(proj);
    if (!latest) {
      var c0 = DR.check(proj), f0 = c0.ok ? null : c0.fails[0];
      return deepFreeze({ state: "incomplete", fail: f0, returnTab: returnTabOf(f0),
        reason: c0.ok ? "Design 형상 완료 전입니다 — 디자인 제목 옆 «Design 형상 완료»를 누르세요" : (FAIL_TEXT[f0] || f0) + " — Design 형상 완료 전" });
    }
    if (DR.isCurrentDesignChanged(proj)) {
      var c1 = DR.check(proj), f1 = c1.ok ? null : c1.fails[0];
      return deepFreeze({ state: "changed", fail: f1, returnTab: returnTabOf(f1), resultHash: latest.hash,
        reason: "Design 이 완료 뒤 바뀌었습니다 · " + (c1.ok ? "디자인 제목 옆 «Design 형상 완료»를 다시 누르세요" : (FAIL_TEXT[f1] || f1) + " → 다시 완료 필요") });
    }
    return { latest: latest };
  }

  // 선택 위치 드러내기(2026-11-15): 화면 px 기준. 가시 영역 vis(캔버스 ∩ 창 − 카드) 안에 «선택 위치»가 들도록 필요한 최소 이동(px)만 돌려준다.
  //   pt(실제로 누른 점 · 골 반사 쪽이면 반사 쪽 점)가 있으면 그것이 기준: 이미 보이면 {0,0}, 가려졌으면 그 점 둘레 ±22px 가 보일 만큼만.
  //   pt 가 없으면 변 bbox(box) 기준 — 이미 다 보이면 {0,0}, 가시 영역보다 크면 위·왼쪽을 맞춘다. 배율은 다루지 않는다(호출자는 이동만).
  function revealShift(box, pt, vis, margin) {
    var m = margin == null ? 8 : margin;
    if (!vis || !(vis.bottom - vis.top > 2 * m) || !(vis.right - vis.left > 2 * m)) return { dx: 0, dy: 0, fits: false };
    var V = { left: vis.left + m, top: vis.top + m, right: vis.right - m, bottom: vis.bottom - m }, R = 22;
    var T = pt ? (pt.x >= V.left && pt.x <= V.right && pt.y >= V.top && pt.y <= V.bottom ? null : { left: pt.x - R, top: pt.y - R, right: pt.x + R, bottom: pt.y + R }) : box;
    if (!T) return { dx: 0, dy: 0, fits: true };
    var ax = function (lo, hi, a, b) { if (b - a > hi - lo) return lo - a; if (a < lo) return lo - a; if (b > hi) return hi - b; return 0; };
    return { dx: ax(V.left, V.right, T.left, T.right), dy: ax(V.top, V.bottom, T.top, T.bottom), fits: T.right - T.left <= V.right - V.left && T.bottom - T.top <= V.bottom - V.top };
  }
  // 선택 조각 보기(2026-11-17 master 승인) — 순수. box = 조각 테두리(시트 cm · 시접·골 펼침·보류 표시 포함) · rect = 캔버스 화면 사각형(px) ·
  //   vis = 실제로 보이는 곳(px · 화면 ∩ 하단 카드 위). 조각이 vis 안에 여백 padPx 를 두고 들어가게 하는 카메라(캔버스 비율 그대로).
  //   최대 확대 = 캔버스 폭이 minWcm 보다 좁아지지 않음(작은 부속도 선·식서를 잡을 만큼만). 보이는 곳이 너무 좁으면 이유를 돌려준다.
  function pieceCam(box, rect, vis, opt) {
    opt = opt || {}; var pad = opt.padPx == null ? 16 : opt.padPx, minW = opt.minWcm == null ? 8 : opt.minWcm;
    if (!box || !(box.maxX > box.minX) || !(box.maxY > box.minY)) return { why: "조각 테두리를 알 수 없습니다" };
    if (!rect || !(rect.width > 0 && rect.height > 0)) return { why: "작업 영역 크기를 알 수 없습니다" };
    var vw = vis.right - vis.left - 2 * pad, vh = vis.bottom - vis.top - 2 * pad;
    if (!(vw > 40 && vh > 40)) return { why: "보이는 작업 영역이 너무 좁습니다(아래 카드를 닫거나 화면을 키우세요)" };
    var bw = box.maxX - box.minX, bh = box.maxY - box.minY, s = Math.max(bw / vw, bh / vh), limited = false;
    if (s * rect.width < minW) { s = minW / rect.width; limited = true; }
    var cx = (box.minX + box.maxX) / 2, cy = (box.minY + box.maxY) / 2, vcx = (vis.left + vis.right) / 2 - rect.left, vcy = (vis.top + vis.bottom) / 2 - rect.top;
    return { cam: { x: cx - vcx * s, y: cy - vcy * s, w: s * rect.width, h: s * rect.height }, cmPerPx: s, limited: limited };
  }
  var model = { pairingOf: pairingOf, baseOf: baseOf, NOTCH_MAX_CM: NOTCH_MAX_CM, pieceCam: pieceCam, readDart: readDart, dartsOf: dartsOf, setDartMode: setDartMode, DART_MODES: DART_MODES, DART_MODE_LABEL: DART_MODE_LABEL, readGrain: readGrain, grainOf: grainOf, setGrain: setGrain, relinkGrain: relinkGrain, grainSig: grainSig, defaultGrain: defaultGrain, grainLine: grainLine, revealShift: revealShift, clickArc: clickArc,displayOf: displayOf, layoutOf: layoutOf, orderOf: orderOf, readQty: readQty, qtyOf: qtyOf, setQty: setQty, defaultQty: defaultQty, readNotchSpec: readNotchSpec, addNotch: addNotch, moveNotch: moveNotch, removeNotch: removeNotch, pairNotches: pairNotches, setEaseSplit: setEaseSplit, reconnectNotch: reconnectNotch, EASE_BOOK: EASE_BOOK, sewnChain: sewnChain, notchesOf: notchesOf, peek: peek, foldMeasure: foldMeasure, edgesOf: edgesOf, readSpec: readSpec, seam: seamOf, setEdge: setEdge, clearOrphans: clearOrphans, SEAM_DEFAULT_CM: SEAM_DEFAULT_CM, ventPieces: ventPieces, composePlacket: composePlacket, ringOf: ringOf, derive: derive, candidates: candidates, buildPieces: buildPieces, normOutline: normOutline, paperCheck: paperCheck, FAIL_TEXT: FAIL_TEXT, TAB_LABEL: TAB_LABEL };

  // ══ 화면(읽기 전용 오버레이) ══ ─────────────────────────────────────
  var NS = "http://www.w3.org/2000/svg", GAP = 6;
  var view = { showWidths: false, open: false, proj: null, data: null, sel: null, cam: null, layout: null, notice: "", seam: null, edge: null, cardMsg: "" };
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
    var D = view.disp = displayOf(d, view.seam);
    view.layout = layoutOf(d.pieces, D);
    var Q = view.qty = qtyOf(d, D, view.proj);
    view.grain = grainOf(d, D, view.proj);
    view.layout.order.forEach(function (pid) {
      var p = d.pieces.filter(function (x) { return x.id === baseOf(pid); })[0], r = D[pid], pos = view.layout.pos[pid]; if (!p || !r || !pos) return;
      var plabel = r.label || p.label, sgn = r.instMirrored ? -1 : 1;   // 쌍의 거울 쪽: data-piece 는 원본 조각 id(같은 설정) · data-inst 가 보이는 조각
      var g = el("g", { "class": "cut-piece" + (view.sel === p.id ? " is-sel" : "") + (r.unfolded ? " is-unfolded" : "") + (r.instMirrored ? " is-pair-mirror" : ""), "data-piece": p.id, "data-inst": pid, transform: "translate(" + pos.dx + " " + pos.dy + ")" });
      if (r.seam) g.appendChild(el("path", { "class": "cut-seam", d: polyD(r.seam, true) }));
      if (r.trued) g.appendChild(el("path", { "class": "cut-trued", d: pathD(r.trued) + " Z" }));   // 접어 정리한 완성 외곽(다트 긴 V 는 변 선으로 그대로 그린다)
      g.appendChild(el("path", { "class": "cut-piece-outline", d: pathD(r.outline) + " Z" }));
      r.seamParts.forEach(function (pl) { g.appendChild(el("path", { "class": "cut-seam cut-seam-part", d: polyD(pl, false) })); });
      r.marks.forEach(function (m) { g.appendChild(el("path", { "class": (m.kind.indexOf("zone-") === 0 ? "cut-zone cut-" : "cut-mark cut-mark-") + m.kind, d: pathD(m.segs) + (m.kind.indexOf("zone-") === 0 ? " Z" : "") })); });
      r.marks.forEach(function (m) {   // 주머니 표시 이름: 가로로(입구 접는선 = 윗변 위 · 달림선 = 오각형 가운데)
        if (!m.label || m.mirrored || (m.kind !== "pocket-fold" && m.kind !== "pocket-attach")) return;
        var xs = [], ys = []; m.segs.forEach(function (g) { xs.push(g.from.x, g.to.x); ys.push(g.from.y, g.to.y); });
        var mx = (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2, my = m.kind === "pocket-fold" ? Math.min.apply(null, ys) - 0.35 : (Math.min.apply(null, ys) + Math.max.apply(null, ys)) / 2;
        g.appendChild(el("text", { "class": "cut-mark-label cut-mark-label-" + m.kind, x: mx, y: my, "text-anchor": "middle", "font-size": LABEL_CM, "data-cap": LABEL_CAP_CM }, m.label));
      });
      r.marks.forEach(function (m) {   // 세로 기준선 이름(반사 쪽은 이름 생략 — 같은 선)
        if (!m.label || m.mirrored || m.kind === "pocket-fold" || m.kind === "pocket-attach") return; var s0 = m.segs[0], ly = s0.from.y + (s0.to.y - s0.from.y) * (m.kind === "cf" ? 0.3 : 0.62), lx = s0.from.x - 0.22 * sgn;
        var cap =m.kind === "fold" ? (p.placket ? p.placket.overlapCm : p.vent ? p.vent.finishedWidthCm : 0) : 0;
        g.appendChild(el("text", { "class": "cut-mark-label cut-mark-label-" + m.kind, x: lx, y: ly, "font-size": LABEL_CM, "data-cap": cap > 0 ? Math.max(LABEL_CM, cap * 0.8) : LABEL_CAP_CM, transform: "rotate(-90 " + lx + " " + ly + ")" }, m.label));
      });
      if (p.placket && p.placket.facingWidthCm > 0) { var ex = (r.instMirrored ? -p.placket.cutX : p.placket.cutX) + 0.75 * sgn, ey =p.placket.topY + (p.placket.botY - p.placket.topY) * 0.46;
        g.appendChild(el("text", { "class": "cut-mark-label", x: ex, y: ey, "font-size": 0.78, transform: "rotate(-90 " + ex + " " + ey + ")" }, "안단 끝(외곽)")); }
      (r.guides || []).forEach(function (gd) {   // 기본 표시선(자르지 않음): C.F · C.B · 가슴선 · 허리선 — 글자 위치는 인쇄·DXF 와 같은 모델 값
        if (gd.line) g.appendChild(el("path", { "class": "cut-guide cut-guide-" + gd.kind, "data-guide": gd.kind, d: "M" + gd.a.x + " " + gd.a.y + " L" + gd.b.x + " " + gd.b.y }));
        g.appendChild(el("text", { "class": "cut-guide-label cut-guide-label-" + gd.kind, "data-guide-label": gd.kind, x: gd.tx, y: gd.ty, "text-anchor": "middle", "font-size": gd.th }, gd.kind === "bust" || gd.kind === "waist" ? gd.ko : gd.text));
      });
      var bb = r.bbox, cx = (bb.minX + bb.maxX) / 2, cy = (bb.minY + bb.maxY) / 2, fs = Math.max(1.2, Math.min(2.4, (bb.maxX - bb.minX) / 9)), qq = (Q.inst && Q.inst[pid]) || Q.pieces[pid];
      g.appendChild(el("text", { "class": "cut-piece-label", x: cx, y: cy, "font-size": fs }, plabel + (qq && qq.qty ? " ×" + qq.qty : "")));
      g.appendChild(el("text", { "class": "cut-piece-size", x: cx, y: cy + fs * 1.15, "font-size": fs * 0.72 }, fmt(p.widthCm) + " × " + fmt(p.heightCm) + " cm" + (r.unfolded ? " (반쪽 · 펼침 " + fmt(bb.maxX - bb.minX) + " 시접 포함)" : "")));
      r.notches.forEach(function (n) {
        if (n.to) g.appendChild(el("path", { "class": "cut-notch", "data-notch": n.id, d: "M" + n.from.x + " " + n.from.y + " L" + n.to.x + " " + n.to.y }));
        else if (n.from) g.appendChild(el("circle", { "class": "cut-notch-dot", "data-notch": n.id, cx: n.from.x, cy: n.from.y, r: 0.25 }));
      });
      (r.heldNotches || []).forEach(function (n) { var hc = el("circle", { "class": "cut-notch-held", "data-notch-held": n.id, cx: n.at.x, cy: n.at.y, r: 0.35 }); hc.appendChild(el("title", {}, "보류 — " + n.why)); g.appendChild(hc); });
      var gr = view.grain && view.grain.pieces[pid];
      if (gr && gr.ok) {   // 식서: 양끝 화살표 하나(펼친 조각에도 하나) · 끌어서 옮김
        var gattrs = { "class": "cut-grain" + (gr.explicitAngle || gr.explicitAt ? " is-explicit" : "") + (gr.held ? " is-held" : "") }; if (!r.instMirrored) gattrs["data-grain"] = p.id;   // 거울 쪽은 표시만(끌기는 원본 쪽 — 같은 설정이 반사되어 따라온다)
        var gg = el("g", gattrs);
        gg.appendChild(el("path", { "class": "cut-grain-line", d: grainD(gr.from, gr.to) }));
        if (!r.instMirrored) gg.appendChild(el("path", { "class": "cut-grain-hit", d: "M" + gr.from.x + " " + gr.from.y + " L" + gr.to.x + " " + gr.to.y }));
        g.appendChild(gg);
      }
      var sm = view.seam && view.seam.pieces[p.id];
      r.edges.forEach(function (e) {   // 변: 골선 표시 · 선택 강조 · 누르는 자리(반사 쪽도 같은 변 id → 같은 설정)
        var se = sm && sm.edges.filter(function (x) { return x.id === e.id; })[0], on = view.edge && view.edge.piece === p.id && view.edge.id === e.id;
        e.parts.forEach(function (segs, pi) {
          var ed = pathD(segs);
          if (se && se.kind === "fold") { g.appendChild(el("path", { "class": "cut-edge-fold" + (r.unfolded ? " is-inner" : ""), d: ed }));
            var a = segs[0].from, z = segs[segs.length - 1].to, mx = (a.x + z.x) / 2, my = (a.y + z.y) / 2, vert = Math.abs(a.x - z.x) < Math.abs(a.y - z.y);
            g.appendChild(el("text", { "class": "cut-mark-label cut-edge-fold-label", x: mx, y: my, "font-size": LABEL_CM, "data-cap": LABEL_CAP_CM, transform: vert ? "rotate(-90 " + mx + " " + my + ") translate(0 -0.3)" : "translate(0 -0.3)" }, r.unfolded ? "골(펼침 중심)" : "골선")); }
          if (on) g.appendChild(el("path", { "class": "cut-edge-sel", d: ed }));
          var hitAttrs = { "class": "cut-edge-hit", "data-edge": e.id, d: ed }; if (pi === 1 || r.instMirrored) hitAttrs["data-mirrored"] = "1";   // 반사 쪽 경로 표시(원래 쪽 판별은 이것으로만)
          g.appendChild(el("path", hitAttrs));
          if (view.showWidths && se) {   // ⑤ 구간별 실제 적용 시접을 한꺼번에: 골선 0 · 직접 지정 값에는 * · 나머지 = 기본값
            var wch = segs.filter(function (s) { return s.kind === "cubic" || Math.hypot(s.to.x - s.from.x, s.to.y - s.from.y) > 1e-9; }), wlen = chainLen(wch), wm = wlen > 0 ? pointAtArc(wch, wlen / 2) : null;
            if (wm) g.appendChild(el("text", { "class": "cut-width-label" + (se.kind === "fold" ? " is-fold" : se.explicit ? " is-explicit" : ""), x: wm.pt.x, y: wm.pt.y, "font-size": LABEL_CM, "data-cap": LABEL_CAP_CM, "data-edge-w": e.id }, (se.kind === "fold" ? "골 0" : c2s(se.widthCm)) + (se.explicit && se.kind !== "fold" ? "*" : "")));
          }
        });
      });
      svg.appendChild(g);
    });
    var by = view.layout.height + 6, sb = el("g", { "class": "cut-scale" });
    sb.appendChild(el("path", { d: "M0 " + by + " L10 " + by + " M0 " + (by - 0.6) + " L0 " + (by + 0.6) + " M10 " + (by - 0.6) + " L10 " + (by + 0.6) }));
    sb.appendChild(el("text", { x: 11, y: by + 0.5, "font-size": 1.6 }, "10 cm · 실물 치수(축소·확대는 화면 보기만)" + (view.layout.blAligned ? " · 앞·뒤판 = 가슴선(BL) 높이 맞춤" : "")));
    svg.appendChild(sb);
    sizeLabels();
  }

  // 식서 화살표 경로: 가운데 선 + 양 끝 화살촉(조각 좌표 cm)
  function grainD(a, b) {
    var L = Math.hypot(b.x - a.x, b.y - a.y) || 1, ux = (b.x - a.x) / L, uy = (b.y - a.y) / L, h = Math.min(0.8, L * 0.25), w = h * 0.35;   // 화살촉 반폭 ≤ 0.28 < 옆 여백 0.3
    var head = function (t, sx) { return "M" + (t.x - sx * ux * h - uy * w) + " " + (t.y - sx * uy * h + ux * w) + " L" + t.x + " " + t.y + " L" + (t.x - sx * ux * h + uy * w) + " " + (t.y - sx * uy * h - ux * w); };
    return "M" + a.x + " " + a.y + " L" + b.x + " " + b.y + " " + head(b, 1) + " " + head(a, -1);
  }
  function grainMsg(r, okMsg) { var t = r.ok ? okMsg : "식서 안 바뀜: " + r.reason; reseam(t); setNote("식서: " + t); }
  // 각도 칸에서 고칠 수 없는 값(빈칸 · 숫자 아님 · 범위 밖 · 그 각도로 안 들어감) = 저장 설정·자리·hash 를 건드리지 않고 칸 옆에 이유를 적는다.
  //   칸에 친 글자는 그대로 둔다(고쳐 쓸 수 있게) — 저장·화면·인쇄·DXF 는 지금 값을 계속 쓴다는 것을 함께 적는다. 기본으로 돌리기는 «기본값» 단추만.
  function grainInputError(input, pid, reason) {
    var gq = view.grain && view.grain.pieces[pid], tail = " 고쳐 쓰거나, 기본으로 돌리려면 «기본값»을 누르세요";
    var now = !gq ? "저장 설정은 그대로입니다." : gq.held ? "보류해 둔 저장 설정은 그대로 남습니다. 화면·인쇄·일반 DXF 는 지금처럼 " + (gq.tempDefault && gq.angleDeg != null ? "임시 기본 " + gq.angleDeg + "°(점선 · 일반 DXF 는 GRAIN_HELD 레이어)" : "식서선 없이") + " 쓰고, AAMA DXF 는 식서선을 넣지 않습니다(글자 GRAIN HELD)."
      : gq.angleDeg == null ? "저장 설정은 그대로이고 방향은 계속 미정입니다." : "저장·화면·인쇄·DXF 는 지금 값 " + gq.angleDeg + "°(" + (gq.explicitAngle ? "직접 지정" : "기본값") + ")를 그대로 씁니다.";
    var msg = "식서 안 바뀜: " + reason + " — " + now + tail;
    if (input) { input.setAttribute("aria-invalid", "true"); var row = input.closest(".ci-grain"), sp = row && row.querySelector(".ci-grain-err");
      if (row && !sp) { sp = document.createElement("span"); sp.className = "ci-grain-err"; sp.setAttribute("role", "alert"); row.appendChild(sp); }
      if (sp) sp.textContent = msg; }
    setNote("식서: " + msg);
    return { ok: false, reason: reason };
  }
  function grainAngle(pid, v, input) {
    var r = setGrain(pid, { angleDeg: v }, view.proj), moved = false;
    if (!r.ok && v !== null && typeof v === "number" && Number.isFinite(v) && view.grain && view.grain.pieces[pid] && view.grain.pieces[pid].explicitAt) { var r2 = setGrain(pid, { angleDeg: v, at: null }, view.proj); if (r2.ok) { r = r2; moved = true; } }
    if (!r.ok && input) return grainInputError(input, pid, r.reason);   // 칸에서 친 값이 안 맞으면 칸을 그대로 두고 이유만(다시 그려 지우지 않음)
    grainMsg(r, "식서 각도 바뀜" + (r.replacedHeld ? " — 보류 중이던 예전 설정은 이 값으로 바뀜" : "") + (moved ? " — 옮겨 둔 자리에는 이 각도로 들어가지 않아 기본 자리로 옮김" : "") + " · 프로젝트를 저장해야 파일에 남습니다");
    return r;
  }
  function li(cls, html) { var e = document.createElement("li"); if (cls) e.className = cls; e.innerHTML = html; return e; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var GROUP_LABEL = { bodice: "몸판", sleeve: "소매·커프스", collar: "카라", detail: "디테일" };

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
      t += "<span class=\"ci-note\">바이어스 방향으로 재단(식서 45°) · 소매 한 쪽당 1장</span>";
    }
    return t;
  }

  function seamHtml(p) {
    var sm = view.seam && view.seam.pieces[p.id]; if (!sm) return "";
    var ex = sm.edges.filter(function (e) { return e.explicit; }).length, t = "";
    if (sm.ok) t += "<span class=\"ci-ok\">시접 완료 · " + (ex ? "직접 지정 " + ex + "곳" : "기본값(1cm · 골선 0)") + "</span>";
    else t += "<span class=\"ci-bad\">시접 미완 — " + esc(sm.refusals.map(function (r) { var nm = r.edgeIds.map(function (id) { var e = sm.edges.filter(function (x) { return x.id === id; })[0]; return e ? e.name : id; }).join("·"); return (nm ? nm + ": " : "") + r.reason; }).join(" / ")) + "</span>";
    if (sm.edges.length === 1 && sm.edges[0].whole) t += "<span class=\"ci-note\">" + esc(sm.edges[0].wholeReason) + " — 조각 전체 한 값</span>";
    if (sm.notches && sm.notches.length) t += "<span class=\"ci-notch\">맞춤 표시 " + sm.notches.length + " — " + esc(sm.notches.map(function (n) { return n.name + (n.held ? "(보류)" : n.to ? "" : "(재단선 없음)"); }).join(" · ")) + "</span>";
    sm.notches.filter(function (n) { return n.held; }).forEach(function (n) { t += "<span class=\"ci-bad\">맞춤 «" + esc(n.name) + "» 보류 — " + esc(n.heldWhy) + "</span>"; });
    var lockD = view.seam && view.seam.dartSpec && view.seam.dartSpec.state === "invalid";
    (sm.dartPlans || []).forEach(function (pl) {
      var tq = (sm.trued ? sm.trued.darts : []).filter(function (q) { return q.legs && pl.kind && q.edgeId === pl.edgeId; }), lq = sm.darts.filter(function (q) { return q.edgeId === pl.edgeId; })[0];
      if (!pl.kind) { t += "<span class=\"ci-note\">다트 시접: " + (pl.boundary === "armhole" ? "아래(허리) 쪽으로 눕혀" : "중심 쪽 겹이 위로 오게") + " 접은 모양(이 다트는 입구 정리 방식을 고를 수 없음 — 지원: 앞판 진동 다트 · 뒤판 어깨 다트)</span>"; return; }
      var opts = DART_MODES[pl.kind].map(function (m) { return "<option value=\"" + m + "\"" + (m === pl.mode ? " selected" : "") + ">" + esc(DART_MODE_LABEL[m]) + "</option>"; }).join("");
      t += "<span class=\"ci-note ci-dart\"><label>" + (pl.kind === "ah" ? "진동 다트" : "어깨 다트") + " 입구 정리 <select data-dart-mode=\"" + esc(p.id) + "\" data-dart-id=\"" + esc(pl.id) + "\"" + (lockD ? " disabled" : "") + ">" + opts + "</select></label>" +
        (pl.legacyProject ? " <em>이전에 만든 프로젝트 — 예전 방식 유지(바꾸면 이 프로젝트에 저장)</em>" : pl.explicit ? " <em>직접 고름</em>" : " <em>기본</em>") +
        (pl.method ? " · 긴 V(다트 봉제선)는 그대로 두고, 정리한 완성 외곽과 그 바깥 재단선을 따로 만듭니다" : "") + (pl.method === "chord" ? (function () { var tq0 = (sm.trued ? sm.trued.darts : []).filter(function (q) { return q.edgeId === pl.edgeId && q.method === "chord"; })[0]; return tq0 && tq0.mouthShiftCm > 0.0005 ? " · 입구가 다리 연장선 위로 " + c2s(r4(tq0.mouthShiftCm)) + "cm 늘었지만 긴 V 는 원래 입구까지만 그립니다(연장 표시는 master 미확정 — 자동으로 더하지 않음)" : ""; })() : "") + (pl.why ? " · " + esc(pl.why) : "") +
        (lq && lq.legMismatchCm > 0.005 ? " · 다트 두 다리 길이 차 " + c2s(lq.legMismatchCm) + "cm 는 고치지 않음(맞춤 = 패턴 확정 단계)" : "") + "</span>";
    });
    if (lockD) t += "<span class=\"ci-bad\">저장된 다트 정리 설정을 읽을 수 없습니다 — " + esc(view.seam.dartSpec.reason) + "</span>";
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
    if (st) { st.textContent = d.failedPieces ? "검사 실패 " + d.failedPieces + "개" : "도안 " + (view.disp ? Object.keys(view.disp).length : d.pieces.length) + "개" + (view.seam && view.seam.state === "ready" ? " · 시접 " + view.seam.done + "/" + view.seam.total + "종" : "");
      // 도안 = 화면에 보이는 조각(앞판 좌우 포함) · 시접 N/M종 = 검사 단위(저장 조각 종류)
      st.dataset.state = d.failedPieces || (view.seam && view.seam.done < view.seam.total) ? "warn" : "ok";
    }
    if (st) view.baseStatus = st.textContent;
    ["bodice", "sleeve", "collar", "detail"].forEach(function (gk) {
      var ps = orderOf(d.pieces.filter(function (p) { return p.group === gk; })); if (!ps.length) return;
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
        item.appendChild(btn);
        var qq = view.qty && view.qty.pieces[p.id];
        if (qq) {   // 재단 수량(버튼 밖 · 입력은 목록 위임 리스너가 받는다)
          var qd = document.createElement("div"); qd.className = "ci-qty";
          qd.innerHTML = "<label>재단 <input type=\"number\" inputmode=\"numeric\" min=\"1\" max=\"99\" step=\"1\" data-qty=\"" + esc(p.id) + "\" value=\"" + (qq.qty == null ? "" : qq.qty) + "\"" + (view.qty.state === "invalid" ? " disabled" : "") + "> 장</label>" +
            "<span class=\"ci-qty-how\">" + esc(qq.how || "") + (qq.explicit ? " · 직접 지정(기본 " + (qq.def == null ? "없음" : qq.def) + ")" : qq.def == null ? " · 기본값 없음 — 직접 입력" : " · 기본값") + "</span>" +
            (qq.explicit ? "<button type=\"button\" class=\"btn ci-qty-reset\" data-qty-reset=\"" + esc(p.id) + "\">기본값</button>" : "");
          item.appendChild(qd);
        }
        var gq = view.grain && view.grain.pieces[p.id];
        if (gq) {   // 식서(올 방향) — 각도는 여기서, 자리는 화면의 화살표를 끌어서
          var glock = view.grain.state === "invalid" ? " disabled" : "", gd = document.createElement("div"); gd.className = "ci-qty ci-grain";
          var gheld = gq.held ? "보류 — " + gq.heldWhy + " · 저장해 둔 식서(" + (gq.heldAngleDeg == null ? "" : "각도 " + gq.heldAngleDeg + "°") + (gq.heldAngleDeg != null && gq.heldAt ? " · " : "") + (gq.heldAt ? "옮긴 자리" : "") + ")는 적용하지 않고 남겨 둠 · " + (gq.tempDefault ? "지금 화살표는 임시 기본 방향 · " : "") : "";
          var gst = gheld + (gq.angleDeg == null ? "방향 미정 — " + (gq.why || "직접 지정") : !gq.ok ? "표시 안 됨 — " + (gq.why || "") : (gq.explicitAngle ? "직접 지정(기본 " + (gq.defAngleDeg == null ? "없음" : gq.defAngleDeg + "°") + ")" : "기본값 · " + (gq.basis || "")) + (gq.explicitAt ? " · 자리 옮김" : "") + (gq.atStale ? " · 옮겨 둔 자리가 지금 모양 밖이라 기본 자리에 표시" : "") + (gq.unfolded ? " · 펼친 한 장에 하나" : ""));
          gd.innerHTML = "<label>식서 <input type=\"number\" inputmode=\"decimal\" min=\"0\" max=\"180\" step=\"1\" data-grain-angle=\"" + esc(p.id) + "\" value=\"" + (gq.angleDeg == null ? "" : gq.angleDeg) + "\"" + glock + "> °</label>" +
            "<button type=\"button\" class=\"btn\" data-grain-set=\"90\" data-pid=\"" + esc(p.id) + "\"" + glock + ">세로</button><button type=\"button\" class=\"btn\" data-grain-set=\"0\" data-pid=\"" + esc(p.id) + "\"" + glock + ">가로</button><button type=\"button\" class=\"btn\" data-grain-set=\"45\" data-pid=\"" + esc(p.id) + "\"" + glock + ">바이어스</button>" +
            (gq.held ? "<button type=\"button\" class=\"btn\" data-grain-relink=\"" + esc(p.id) + "\"" + glock + ">이전 설정 다시 쓰기</button>" : "") +
            (gq.held || gq.explicitAngle || gq.explicitAt ? "<button type=\"button\" class=\"btn ci-qty-reset\" data-grain-reset=\"" + esc(p.id) + "\"" + glock + ">기본값</button>" : "") +
            "<span class=\"ci-qty-how\">" + esc(gst) + (gq.ok ? " · 자리는 화면의 화살표를 끌어 옮김" : "") + "</span>";
          item.appendChild(gd);
        }
        box.appendChild(item);
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
    if (view.qty && view.qty.state === "invalid") box.appendChild(li("cut-miss", "<b>저장된 재단 수량을 읽을 수 없습니다</b> " + esc(view.qty.reason) + " — 기본값으로 표시하고 저장된 값은 고치지 않았습니다(수정 잠김)"));
    if (view.qty && view.qty.stale.length) box.appendChild(li("cut-info", "지금 없는 조각의 재단 수량 설정 " + view.qty.stale.length + "개는 지우지 않고 보관합니다(" + esc(view.qty.stale.join(", ")) + ")"));
    if (sv && sv.notchSpec && sv.notchSpec.state === "invalid") box.appendChild(li("cut-miss", "<b>저장된 맞춤 표시 설정을 읽을 수 없습니다</b> " + esc(sv.notchSpec.reason) + " — 기본 표시만 보이고 저장된 값은 고치지 않았습니다(수정 잠김)"));
    if (sv && sv.notchOrphans && sv.notchOrphans.length) {
      box.appendChild(li("cut-list-h", "연결이 끊긴 맞춤 표시 " + sv.notchOrphans.length + "개"));
      sv.notchOrphans.forEach(function (o) { var it2 = li("cut-miss", "<b>" + esc(o.label) + " · 맞춤 " + esc(o.id.slice(1)) + "</b> 시작에서 " + c2s(o.atCm) + "cm — " + esc(o.why) + " · 다른 변으로 옮기지 않았습니다 ");
        if (o.canReconnect) { var rb = document.createElement("button"); rb.type = "button"; rb.className = "btn"; rb.dataset.act = "nrecon"; rb.dataset.id = o.id; rb.textContent = "이 위치로 다시 연결"; it2.appendChild(rb); }
        var db = document.createElement("button"); db.type = "button"; db.className = "btn"; db.dataset.act = "norph-del"; db.dataset.id = o.id; db.textContent = "지우기"; it2.appendChild(db); box.appendChild(it2); });
    }
    if (d.notches && d.notches.todo.length) {
      box.appendChild(li("cut-list-h", "맞춤 표시 — 아직 만들지 않은 것"));
      d.notches.todo.forEach(function (t) { box.appendChild(li("cut-miss", "<b>" + esc(t.what) + "</b> " + esc(t.why))); });
    }
    var notes = d.info.concat(d.excluded.map(function (x) { return x.label + ": " + x.reason; }));
    if (sv && sv.pairing && sv.pairing.all) {
      var pall = sv.pairing.all, act = Object.keys(pall).filter(function (k) { return pall[k].active; });
      if (act.length) notes.push("좌우가 있는 조각(" + act.map(pairKindName).join("·") + ") = 착용자 기준 왼 1장 + 오른 1장(실제 거울상) — 저장된 시접·맞춤 표시·식서·수량은 원본 조각 하나에 연결되어 두 조각이 함께 바뀝니다(수량 1 = 한 쌍)");
      Object.keys(pall).forEach(function (k) { if (!pall[k].active && pall[k].reason) notes.push(pairKindName(k) + " 좌우 한 쌍 표시 안 함 — " + pall[k].reason); });
    }
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
    syncFitSel();
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
    var ni = $("cutNotchInfo"), all = (c.sm.notches || []).filter(function (n) { return n.edgeId === e.id; }), defs = all.filter(function (n) { return !n.user; }), users = all.filter(function (n) { return n.user; });
    var pe = c.piece.edges, k0 = pe.map(function (x) { return x.id; }).indexOf(e.id), endA = pe[(k0 - 1 + pe.length) % pe.length].name, endB = pe[(k0 + 1) % pe.length].name;
    if (ni) { ni.hidden = !defs.length; ni.textContent = defs.map(function (n) {
      return "기본 «" + n.name + "» — " + (n.ref || "변 시작에서 " + c2s(n.atCm)) + " (" + "«" + endA + "» 쪽 끝에서 " + c2s(n.atCm) + " / «" + endB + "» 쪽 끝에서 " + c2s(n.edgeLenCm - n.atCm) + ")" + (n.to ? " · 재단선에서 안으로 " + c2s(n.lenCm) + "cm" + (n.narrow ? "(시접이 좁아 봉제선에서 멈춤)" : "") : " · " + n.why) +
        (n.pair ? " · 짝: " + n.pair.a + " ↔ " + n.pair.b + (n.pair.diffCm != null ? " (" + (n.pair.diffText || "차이") + " " + c2s(n.pair.diffCm) + ")" : "") : " · 짝 없음(위치 표시)") + " · 근거: " + n.basis;
    }).join("\n"); }
    var ne = $("cutNotchEdit");
    if (ne) {
      var nlock = view.seam.notchSpec.state === "invalid", L = c.sm.edges && (function () { var f = c.piece.edges.filter(function (x) { return x.id === e.id; })[0]; return chainLen(sewnChain(c.piece, f)); })();
      var others = []; Object.keys(view.seam.pieces).forEach(function (pid) { (view.seam.pieces[pid].notches || []).forEach(function (n) { if (n.user) others.push(n); }); });
      var h = "<div class=\"cne-head\"><b>사용자 맞춤 표시</b><button type=\"button\" class=\"btn\" data-act=\"nadd\"" + (nlock ? " disabled" : "") + ">＋ 누른 자리에 추가</button></div>";
      if (nlock) h += "<p class=\"cne-note\">저장된 맞춤 표시 설정을 읽을 수 없어 수정이 잠겼습니다 — " + esc(view.seam.notchSpec.reason) + "</p>";
      users.forEach(function (n) {
        var opts = "<option value=\"\">짝 없음</option>" + others.filter(function (o) { return o.id !== n.id && !(o.pieceId === n.pieceId && o.edgeId === n.edgeId); }).map(function (o) { return "<option value=\"" + o.id + "\"" + (n.pairId === o.id ? " selected" : "") + ">" + esc(o.name + " · " + o.side) + "</option>"; }).join("");
        h += "<div class=\"cne-row\" data-id=\"" + n.id + "\"><b>" + esc(n.name) + "</b><label>«" + esc(endA) + "» 쪽 끝에서 <input type=\"number\" inputmode=\"decimal\" step=\"0.1\" min=\"0\" max=\"" + r4(L) + "\" value=\"" + n.atCm + "\" data-act=\"nmove\"" + (nlock ? " disabled" : "") + "> cm</label>" +
          "<span class=\"cne-note\">«" + esc(endB) + "» 쪽 끝에서 " + c2s(r4(L - n.atCm)) + " · " + (n.to ? "재단선에서 안으로 " + c2s(n.lenCm) + "cm" + (n.narrow ? "(시접이 좁아 봉제선에서 멈춤)" : "") : esc(n.why || "")) + "</span>" +
          "<label>짝 <select data-act=\"npair\"" + (nlock ? " disabled" : "") + ">" + opts + "</select></label><button type=\"button\" class=\"btn\" data-act=\"ndel\"" + (nlock ? " disabled" : "") + ">삭제</button>" +
          (n.pair ? "<span class=\"cne-note\">짝: " + esc(n.pair.a + " ↔ " + n.pair.b) + " (자동 이즈 판단 없음 — 위치는 각각 직접 지정)</span>" : "") + "</div>";
      });
      var A = view.seam.armhole;
      if (A && A.ok && (e.id === "armhole" || e.id === "cap")) {
        var sp = A.split, inp = function (key, v, lab) { return "<label>" + lab + " <input type=\"number\" inputmode=\"decimal\" step=\"1\" min=\"0\" max=\"100\" value=\"" + v + "\" data-ek=\"" + key + "\"" + (nlock ? " disabled" : "") + ">%</label>"; };
        h += "<div class=\"cne-ease\"><b>진동·소매산 이즈 배분(구간별 % · 여섯 칸 합 100)</b> " + (A.book ? "책 기본값" : "사용자 수정값") + " · 전체 이즈 " + c2s(A.totalEaseCm) + "cm<br>" +
          inp("b0", sp.back[0], "뒤 아래") + inp("b1", sp.back[1], "뒤 가운데") + inp("b2", sp.back[2], "뒤 위") + inp("f0", sp.front[0], "앞 위") + inp("f1", sp.front[1], "앞 가운데") + inp("f2", sp.front[2], "앞 아래") +
          "<button type=\"button\" class=\"btn\" data-act=\"esave\"" + (nlock ? " disabled" : "") + ">배분 적용</button><button type=\"button\" class=\"btn\" data-act=\"ebook\"" + (nlock || A.book ? " disabled" : "") + ">책 기본값</button>" +
          "<span class=\"cne-note\">너치는 위·아래에만 둔다 — 가운데 구간은 실제 이즈의 나머지를 흡수(뒤 " + c2s(A.sides.back.midEaseCm) + " · 앞 " + c2s(A.sides.front.midEaseCm) + "cm). 배분을 바꾸면 소매 쪽 너치만 움직이고 몸판 너치·소매 형상·시접선은 그대로.</span></div>";
      }
      ne.innerHTML = h; ne.hidden = false;
    }
    card.dataset.state = why.length || locked ? "warn" : "ok";
  }
  function notchAct(t) {
    var act = t.getAttribute("data-act"), row = t.closest(".cne-row"), id = row && row.getAttribute("data-id"), r = null, c = curEdge(); if (!c) return;
    if (act === "nadd") {
      var ca = view.clickAt, at = ca && ca.piece === c.piece.id && ca.edge === c.e.id && ca.at != null ? ca.at : null;
      if (at == null) { var f = c.piece.edges.filter(function (x) { return x.id === c.e.id; })[0]; at = chainLen(sewnChain(c.piece, f)) / 2; }
      r = addNotch(c.piece.id, c.e.id, at, view.proj); reseam(r.ok ? "맞춤 표시 추가 — 위치는 아래 칸에서 cm 로 고칠 수 있습니다 · 프로젝트를 저장해야 파일에 남습니다" : "추가 안 됨: " + r.reason); return;
    }
    if (act === "ndel") { r = removeNotch(id, view.proj); reseam(r.ok ? "맞춤 표시 삭제됨" : "삭제 안 됨: " + r.reason); return; }
    if (act === "nmove") { var v = t.value === "" ? NaN : Number(t.value); r = moveNotch(id, v, view.proj); reseam(r.ok ? "위치 바뀜 — 재단선 표시도 다시 그림" : "위치 안 바뀜: " + r.reason); return; }
    if (act === "npair") { r = pairNotches(id, t.value || null, view.proj); reseam(r.ok ? (t.value ? "짝 연결됨(양쪽 위치는 각각 직접 정한 값)" : "짝 해제됨") : "짝 안 바뀜: " + r.reason); return; }
    if (act === "ebook") { r = setEaseSplit(null, view.proj); reseam(r.ok ? "이즈 배분 = 책 기본값 — 소매 쪽 너치 다시 계산" : "안 바뀜: " + r.reason); return; }
    if (act === "esave") {
      var box = t.closest(".cne-ease"), val = function (k) { var x = box.querySelector("[data-ek=\"" + k + "\"]").value; return x === "" ? NaN : Number(x); };
      r = setEaseSplit({ back: [val("b0"), val("b1"), val("b2")], front: [val("f0"), val("f1"), val("f2")] }, view.proj);
      reseam(r.ok ? "이즈 배분 바뀜 — 소매 쪽 너치 위치 = 소매산점/아랫점에서 (몸판 거리 + 새 구간 이즈). 몸판 너치·형상·시접은 그대로" : "배분 안 바뀜: " + r.reason); return;
    }
  }
  function selectEdge(pid, eid) {
    view.edge = { piece: pid, id: eid }; view.sel = pid; view.cardMsg = ""; view.manual = false;
    drawCanvas(); var box = $("cutList"); if (box) box.querySelectorAll(".cut-item-btn").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.piece === view.sel)); });
    syncFitSel(); syncCard(); revealSel();
  }
  // ── 선택 조각 보기 · 전체 보기로 돌아가기(누를 때만 · 자동으로 따라 움직이지 않음) ──
  function visArea() {
    var svg = $("cutCv"); if (!svg || !svg.getBoundingClientRect) return null;
    var r = svg.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0)) return null;
    var vis = { left: Math.max(r.left, 0), top: Math.max(r.top, 0), right: Math.min(r.right, window.innerWidth || r.right), bottom: Math.min(r.bottom, window.innerHeight || r.bottom) };
    var card = $("cutSeamCard"); if (card && !card.hidden) { var cr = card.getBoundingClientRect(); if (cr.height > 0 && cr.left < vis.right && cr.right > vis.left && cr.top < vis.bottom && cr.bottom > vis.top) vis.bottom = Math.min(vis.bottom, cr.top); }
    return { rect: r, vis: vis };
  }
  function selBox(pid) {
    var r0 = view.disp && view.disp[pid], ids = r0 && r0.pair ? [pid, r0.pair.mirrorId] : [pid], b = null;   // 쌍으로 펼친 조각은 보이는 두 조각을 함께
    ids.forEach(function (id) {
      var r = view.disp && view.disp[id], pos = view.layout && view.layout.pos[id]; if (!r || !r.bbox || !pos) return;
      var c = { minX: r.bbox.minX + pos.dx, minY: r.bbox.minY + pos.dy, maxX: r.bbox.maxX + pos.dx, maxY: r.bbox.maxY + pos.dy };
      (r.heldNotches || []).forEach(function (n) { c.minX = Math.min(c.minX, n.at.x + pos.dx - 0.4); c.maxX = Math.max(c.maxX, n.at.x + pos.dx + 0.4); c.minY = Math.min(c.minY, n.at.y + pos.dy - 0.4); c.maxY = Math.max(c.maxY, n.at.y + pos.dy + 0.4); });
      b = b ? { minX: Math.min(b.minX, c.minX), minY: Math.min(b.minY, c.minY), maxX: Math.max(b.maxX, c.maxX), maxY: Math.max(b.maxY, c.maxY) } : c;
    });
    return b;
  }
  function syncFitSel() {
    var b = $("btnCutFitSel"); if (!b) return;
    var d = view.data, p = view.sel && d && d.pieces ? d.pieces.filter(function (x) { return x.id === view.sel; })[0] : null, why = !view.sel ? "목록이나 화면에서 조각을 먼저 고르세요" : !p ? "고른 조각이 지금 없습니다" : !p.check.ok ? "«" + p.label + "» 외곽 검사 실패 — 화면에 그릴 수 없어 확대할 수 없습니다" : null;
    b.disabled = !!why; if (why) b.setAttribute("aria-disabled", "true"); else b.removeAttribute("aria-disabled");
    b.title = why || "«" + p.label + "»을(를) 작업 영역에 맞춰 크게 봅니다 — 돌아가려면 «전체 보기»";
    b.setAttribute("aria-label", why ? "조각 보기(" + why + ")" : "«" + p.label + "» 조각 보기");
  }
  function fitSel() {
    var d = view.data, p = view.sel && d && d.pieces ? d.pieces.filter(function (x) { return x.id === view.sel; })[0] : null;
    if (!p) { view.fitMsg = "조각을 먼저 고르세요"; return { ok: false, reason: view.fitMsg }; }
    if (!p.check.ok) { view.fitMsg = "«" + p.label + "» 외곽 검사 실패 — 확대할 수 없습니다"; return { ok: false, reason: view.fitMsg }; }
    var a = visArea(), box = selBox(p.id); if (!a || !box) { view.fitMsg = "작업 영역을 아직 그리지 않았습니다"; return { ok: false, reason: view.fitMsg }; }
    var r = pieceCam(box, a.rect, a.vis, { padPx: 16, minWcm: 8 }); if (r.why) { view.fitMsg = r.why; return { ok: false, reason: r.why }; }
    view.cam = r.cam; view.manual = true; applyCam(); view.fitMsg = "«" + p.label + "» 보기" + (r.limited ? "(최대 확대)" : "") + " — 돌아가려면 «전체 보기»";
    var st = $("cutStatus"); if (st) st.textContent = view.fitMsg;
    return { ok: true, piece: p.id, limited: r.limited, cmPerPx: r.cmPerPx };
  }
  // 선택한 변(골 반사 쪽을 눌렀으면 그 반사 쪽)이 하단 카드에 가리면 화면을 최소한으로 옮긴다 — 배율 그대로, 이미 보이면 이동 0.
  //   부르는 곳: 변 선택 직후 1회 · 카드 크기가 바뀔 때(사용자가 그 뒤 끌기·핀치·휠·확대 버튼·맞춤을 하지 않았을 때만) 1회.
  //   매 그리기·끌기 중에는 부르지 않는다(따라다니지 않음).
  function revealSel() {
    var svg = $("cutCv"), card = $("cutSeamCard"), ed = view.edge, c = view.cam; if (!svg || !card || card.hidden || !ed || !c || !svg.getBoundingClientRect) return null;
    var r = svg.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0)) return null;
    var vis = { left: Math.max(r.left, 0), top: Math.max(r.top, 0), right: Math.min(r.right, window.innerWidth || r.right), bottom: Math.min(r.bottom, window.innerHeight || r.bottom) };
    var cr = card.getBoundingClientRect();
    if (cr.height > 0 && cr.left < vis.right && cr.right > vis.left && cr.top < vis.bottom && cr.bottom > vis.top) vis.bottom = Math.min(vis.bottom, cr.top);
    var ca = view.clickAt && view.clickAt.piece === ed.piece && view.clickAt.edge === ed.id && view.clickAt.cm ? view.clickAt : null, box = null;
    svg.querySelectorAll(".cut-piece[data-piece=\"" + ed.piece + "\"] .cut-edge-hit[data-edge=\"" + ed.id + "\"]").forEach(function (h) {
      if (ca && (h.getAttribute("data-mirrored") === "1") !== !!ca.mirrored) return;   // 누른 쪽(원래/반사)만
      var b = h.getBoundingClientRect(); if (!(b.width > 0 || b.height > 0)) return;
      box = box ? { left: Math.min(box.left, b.left), top: Math.min(box.top, b.top), right: Math.max(box.right, b.right), bottom: Math.max(box.bottom, b.bottom) } : { left: b.left, top: b.top, right: b.right, bottom: b.bottom };
    });
    var pt = ca ? { x: r.left + (ca.cm.x - c.x) / c.w * r.width, y: r.top + (ca.cm.y - c.y) / c.h * r.height } : null;
    var sh = revealShift(box, pt, vis, 8);
    if (sh.dx || sh.dy) { view.cam = { x: c.x - sh.dx * c.w / r.width, y: c.y - sh.dy * c.h / r.height, w: c.w, h: c.h }; applyCam(); }
    view.lastReveal = { dx: sh.dx, dy: sh.dy, fits: sh.fits, n: (view.lastReveal ? view.lastReveal.n : 0) + (sh.dx || sh.dy ? 1 : 0) };
    return sh;
  }
  // 카드 내용이 바뀐 직후(시접 적용·너치 추가/이동/삭제·이즈 배분) 1회 — 사용자가 선택 뒤 직접 옮겼으면 하지 않는다.
  function cardChanged() { if (view.open && view.edge && !view.manual) revealSel(); }
  function clearEdge() { if (!view.edge) return; view.edge = null; view.cardMsg = ""; drawCanvas(); syncCard(); }
  function refreshDisp() { if (view.data && view.data.state === "ready") { view.disp = displayOf(view.data, view.seam); view.qty = qtyOf(view.data, view.disp, view.proj); view.grain = grainOf(view.data, view.disp, view.proj); } }
  function reseam(msg) { var nd = derive(view.proj, true); if (nd.state === "ready" && nd.resultHash === view.data.resultHash) view.data = nd; view.seam = seamOf(view.data, view.proj); refreshDisp(); view.cardMsg = msg || ""; drawList(); drawCanvas(); syncCard(); syncFitSel(); cardChanged(); }
  function applyEdge() {
    var c = curEdge(); if (!c) return;
    var kind = c.e.foldCapable ? $("cutSeamKind").value : "seam", raw = $("cutSeamWidth").value, w = raw === "" ? NaN : Number(raw);
    var r = setEdge(view.edge.piece, view.edge.id, { kind: kind, widthCm: w }, view.proj);
    if (!r.ok) { view.cardMsg = "적용 안 됨: " + r.reason; syncCard(); cardChanged(); return; }
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
    refreshDisp(); drawList(); drawCanvas(); fit(); syncCard(); syncFitSel(); schedule();   // 안내 문구도 지금 상태로(이전 «다시 열어 닫음» 문구를 남기지 않음)
    return true;
  }
  function closeView() {
    if (!view.open) return;
    view.open = false; view.data = null; view.layout = null; view.proj = null; view.seam = null; view.edge = null;
    var card = $("cutSeamCard"); if (card) card.hidden = true; view.clickAt = null;
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
        refreshDisp(); drawList(); drawCanvas(); syncCard(); syncFitSel(); if (d && d.state === "ready") fit(); }
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
    on("btnCutFit", function () { view.manual = true; fit(); var st = $("cutStatus"); if (st && view.fitMsg && view.baseStatus != null) st.textContent = view.baseStatus; view.fitMsg = ""; });
    on("btnCutFitSel", function () { var r = fitSel(); if (!r.ok) { var st = $("cutStatus"); if (st) st.textContent = r.reason; } });
    on("btnCutWidths", function () {   // ⑤ 시접 폭 보기 전환(화면 표시만 — 저장·계산 없음)
      view.showWidths = !view.showWidths; var wb = $("btnCutWidths"); if (wb) { wb.setAttribute("aria-pressed", String(view.showWidths)); wb.classList.toggle("is-on", view.showWidths); }
      drawCanvas(); });
    on("btnCutZoomIn", function () { view.manual = true; zoom(1 / 1.25); });
    on("btnCutZoomOut", function () { view.manual = true; zoom(1.25); });
    var list = $("cutList");
    if (list) list.addEventListener("click", function (e) {
      var o = e.target.closest("[data-act=\"clear-orphans\"]"); if (o) { var cr = clearOrphans(view.proj); reseam(cr.ok ? "" : ""); return; }
      var qr = e.target.closest("[data-qty-reset]"); if (qr) { var rq = setQty(qr.getAttribute("data-qty-reset"), null, view.proj); reseam(rq.ok ? "재단 수량 = 기본값" : rq.reason); return; }
      var gs = e.target.closest("[data-grain-set]"); if (gs && !gs.disabled) { grainAngle(gs.getAttribute("data-pid"), Number(gs.getAttribute("data-grain-set"))); return; }
      var gl0 = e.target.closest("[data-grain-relink]"); if (gl0 && !gl0.disabled) { grainMsg(relinkGrain(gl0.getAttribute("data-grain-relink"), view.proj), "보류한 식서를 지금 조각에 다시 연결 · 프로젝트를 저장해야 파일에 남습니다"); return; }
      var gx = e.target.closest("[data-grain-reset]"); if (gx && !gx.disabled) { grainMsg(setGrain(gx.getAttribute("data-grain-reset"), { angleDeg: null, at: null }, view.proj), "식서 = 기본값"); return; }
      if (e.target.closest(".ci-qty")) return;   // 수량 칸을 누른 것은 조각 선택이 아님
      var nr = e.target.closest("[data-act=\"nrecon\"],[data-act=\"norph-del\"]");
      if (nr) { var rr = nr.dataset.act === "nrecon" ? reconnectNotch(nr.dataset.id, view.proj) : removeNotch(nr.dataset.id, view.proj); reseam(rr.ok ? "" : rr.reason); return; }
      var b = e.target.closest(".cut-item-btn"); if (b && !b.disabled) { clearEdge(); select(b.dataset.piece); }
    });
    on("btnCutSeamApply", applyEdge);
    if (list) list.addEventListener("change", function (e) { var t = e.target;
      if (t.matches && t.matches("select[data-dart-mode]")) { var dr = setDartMode(t.getAttribute("data-dart-mode"), t.getAttribute("data-dart-id"), t.value, view.proj);
        reseam(dr.ok ? "다트 입구 정리 방식 바뀜" + (dr.wasLegacyProject && dr.pinned ? " — 다른 다트 " + dr.pinned + "개는 예전 방식으로 고정" : "") + " · 프로젝트를 저장해야 파일에 남습니다" : "안 바뀜: " + dr.reason); if (!dr.ok) setNote("다트 정리: " + dr.reason); return; }
      if (t.matches && t.matches("input[data-grain-angle]")) {   // 빈칸·숫자 아님 = 기본 복귀가 아니다(예전엔 빈칸이 저장 설정·보류 설정을 지웠다 — 야간 리뷰 재현 2026-11-17)
        var gpid = t.getAttribute("data-grain-angle"), graw = String(t.value).trim(), gv = Number(graw);
        if (t.validity && t.validity.badInput) { grainInputError(t, gpid, "숫자로 읽을 수 없습니다"); return; }
        if (graw === "") { grainInputError(t, gpid, "각도 칸이 비어 있습니다"); return; }
        if (!Number.isFinite(gv)) { grainInputError(t, gpid, "숫자로 읽을 수 없습니다"); return; }
        grainAngle(gpid, gv, t); return; }
      if (!t.matches || !t.matches("input[data-qty]")) return;
      var v = t.value.trim() === "" ? NaN : Number(t.value), r = setQty(t.getAttribute("data-qty"), v, view.proj); reseam(r.ok ? "재단 수량 바뀜 — 프로젝트를 저장해야 파일에 남습니다" : "수량 안 바뀜: " + r.reason);
      if (!r.ok) setNote("재단 수량: " + r.reason); });
    var nedit = $("cutNotchEdit");
    if (nedit) {
      nedit.addEventListener("click", function (e) { var b = e.target.closest("button[data-act]"); if (b && !b.disabled) notchAct(b); });
      nedit.addEventListener("change", function (e) { var t = e.target; if (t.matches && t.matches("[data-act=\"nmove\"],[data-act=\"npair\"]")) notchAct(t); });
    }
    on("btnCutSeamClose", clearEdge);
    var ksel = $("cutSeamKind"); if (ksel) ksel.addEventListener("change", function () { var wi = $("cutSeamWidth"), card = $("cutSeamCard"), fold = ksel.value === "fold"; wi.disabled = fold; wi.value = fold ? "0" : card.dataset.kept; });
    var win = $("cutSeamWidth"); if (win) win.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); applyEdge(); } });
    var svg = $("cutCv"); if (!svg) return;
    var drag = null;
    var toCm = function (e) { var r = svg.getBoundingClientRect(), c = view.cam; return { x: c.x + (e.clientX - r.left) / r.width * c.w, y: c.y + (e.clientY - r.top) / r.height * c.h }; };
    // 두 손가락(2026-11-15): 가운데가 움직이면 이동, 벌리면 확대 — 시작할 때 두 손가락 가운데 아래 있던 실물 점이 계속 가운데 아래에 있도록.
    //   두 번째 손가락이 닿으면 한 손가락 끌기·누르기는 취소한다(선택이 잘못 눌리지 않게). 캔버스는 touch-action:none 이라 브라우저 확대는 일어나지 않는다.
    var pts = {}, pinch = null, gdrag = null;   // gdrag = 식서 화살표 끌기(화면 이동 아님)
    var two = function () { var k = Object.keys(pts); return k.length === 2 ? [pts[k[0]], pts[k[1]]] : null; };
    svg.addEventListener("pointerdown", function (e) {
      if (!view.cam) return;
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      var t = two();
      if (t) { if (gdrag) { gdrag = null; drawCanvas(); } drag = null; pinch = { d: Math.max(1, Math.hypot(t[0].x - t[1].x, t[0].y - t[1].y)), cx: (t[0].x + t[1].x) / 2, cy: (t[0].y + t[1].y) / 2, cam: Object.assign({}, view.cam) }; return; }
      if (Object.keys(pts).length > 2) { drag = null; pinch = null; return; }
      var gh = e.target.closest && e.target.closest(".cut-grain-hit"), gpid = gh && gh.parentNode.getAttribute("data-grain"), gcur = gpid && view.grain && view.grain.state !== "invalid" && view.grain.pieces[gpid];
      if (gcur && gcur.ok && view.disp && view.disp[gpid]) { drag = null; gdrag = { pid: gpid, x: e.clientX, y: e.clientY, id: e.pointerId, at0: gcur.at, at: null, ang: gcur.angleDeg, poly: polyOf(view.disp[gpid].outline), node: gh.parentNode, moved: false }; return; }
      drag = { x: e.clientX, y: e.clientY, cam: Object.assign({}, view.cam), moved: false, id: e.pointerId };
    });
    svg.addEventListener("pointermove", function (e) {
      if (pts[e.pointerId]) pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      var t = pinch && two();
      if (t) {
        var rr = svg.getBoundingClientRect(), c0 = pinch.cam, dn = Math.max(1, Math.hypot(t[0].x - t[1].x, t[0].y - t[1].y)), cx = (t[0].x + t[1].x) / 2, cy = (t[0].y + t[1].y) / 2;
        var nw = Math.min(Math.max(c0.w * pinch.d / dn, 8), 2000), k = nw / c0.w, nh = c0.h * k;
        var ax = c0.x + (pinch.cx - rr.left) / rr.width * c0.w, ay = c0.y + (pinch.cy - rr.top) / rr.height * c0.h;
        view.manual = true; view.cam = { x: ax - (cx - rr.left) / rr.width * nw, y: ay - (cy - rr.top) / rr.height * nh, w: nw, h: nh }; applyCam();
        return;
      }
      if (gdrag && e.pointerId === gdrag.id) {   // 조각 안에 들어가는 자리로만 따라온다(밖으로는 그리지 않음)
        var gr0 = svg.getBoundingClientRect(), gc = view.cam;
        if (!gdrag.moved && Math.hypot(e.clientX - gdrag.x, e.clientY - gdrag.y) < 4) return;
        if (!gdrag.moved) { gdrag.moved = true; try { svg.setPointerCapture(e.pointerId); } catch (x) { /* 무시 */ } }
        var nat = { x: gdrag.at0.x + (e.clientX - gdrag.x) / gr0.width * gc.w, y: gdrag.at0.y + (e.clientY - gdrag.y) / gr0.height * gc.h }, gl = grainLine(gdrag.poly, nat, gdrag.ang);
        if (gl.ok) { gdrag.at = nat; var ps = gdrag.node.querySelectorAll("path"); ps[0].setAttribute("d", grainD(gl.from, gl.to)); ps[1].setAttribute("d", "M" + gl.from.x + " " + gl.from.y + " L" + gl.to.x + " " + gl.to.y); }
        return;
      }
      if (!drag || e.pointerId !== drag.id) return;
      var r = svg.getBoundingClientRect(), dx = (e.clientX - drag.x) / r.width * drag.cam.w, dy = (e.clientY - drag.y) / r.height * drag.cam.h;
      if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 4) return;
      if (!drag.moved) { drag.moved = true; view.manual = true; try { svg.setPointerCapture(e.pointerId); } catch (x) { /* 무시 */ } }
      view.cam = { x: drag.cam.x - dx, y: drag.cam.y - dy, w: drag.cam.w, h: drag.cam.h }; applyCam();
    });
    var end = function (e) {
      delete pts[e.pointerId]; if (pinch) { pinch = null; drag = null; gdrag = null; return; }
      if (gdrag) { var gd0 = gdrag; gdrag = null; if (e.pointerId !== gd0.id) return;
        if (gd0.moved && gd0.at) { var gsr = setGrain(gd0.pid, { at: gd0.at }, view.proj); grainMsg(gsr, "식서 자리 옮김" + (gsr.replacedHeld ? " — 보류 중이던 예전 설정은 이 값으로 바뀜" : "") + " · 프로젝트를 저장해야 파일에 남습니다"); } else if (gd0.moved) drawCanvas(); else { clearEdge(); select(gd0.pid); }
        return; }
      if (!drag) return;
      if (!drag.moved) {
        var g = e.target.closest && e.target.closest(".cut-piece"), h = e.target.closest && e.target.closest("[data-edge]");
        if (g && h) { var pid0 = g.getAttribute("data-piece"), iid0 = g.getAttribute("data-inst") || pid0, eid0 = h.getAttribute("data-edge"), pos0 = view.layout && view.layout.pos[iid0], cm0 = toCm(e);
          var q0 = pos0 ? { x: cm0.x - pos0.dx, y: cm0.y - pos0.dy } : null, pc0 = view.data && view.data.pieces.filter(function (x) { return x.id === pid0; })[0];
          var mir0 = h.getAttribute("data-mirrored") === "1";
          view.clickAt = q0 && pc0 ? { piece: pid0, edge: eid0, at: clickArc(pc0, view.disp && view.disp[iid0], eid0, q0, mir0), cm: cm0, mirrored: mir0, inst: iid0 } : null;
          selectEdge(pid0, eid0);
          // 손가락·펜으로 누른 경우: 바로 뜬 카드가 손가락 아래에 오면, 브라우저가 이어 보내는 «클릭»이 카드의 단추(«적용» 등)를 누른다(실측 390 · 2026-11-17).
          //   그 한 번의 뒤따르는 클릭만 삼킨다(같은 자리 근처 · 짧은 시간) — 사용자가 일부러 누르는 다음 클릭은 그대로.
          if (e.pointerType && e.pointerType !== "mouse") ghostGuard = { x: e.clientX, y: e.clientY, until: Date.now() + 700 }; }
        else { clearEdge(); select(g ? g.getAttribute("data-piece") : view.sel); }
      }
      drag = null;
    };
    var ghostGuard = null;
    window.addEventListener("click", function (e) {
      var gg = ghostGuard; if (!gg) return; ghostGuard = null;
      if (Date.now() > gg.until || Math.hypot(e.clientX - gg.x, e.clientY - gg.y) > 24) return;
      var tg = e.target; if (!tg || !tg.closest || !tg.closest("#cutSeamCard")) return;   // 카드 안을 누른 뒤따르는 클릭만
      e.preventDefault(); e.stopPropagation();
    }, true);
    svg.addEventListener("pointerup", end); svg.addEventListener("pointercancel", function (e) { delete pts[e.pointerId]; pinch = null; drag = null; if (gdrag) { gdrag = null; drawCanvas(); } });
    // 캔버스 밖에서 손가락을 떼면 캔버스는 pointerup 을 못 받는다 → 그 손가락이 «눌린 채» 남아 다음 핀치·탭이 먹히지 않는다(2026-11-15 실측 재현).
    //   화면 어디서 떼든 받아 정리한다. 캔버스 안에서 뗀 것은 위 end 가 처리하므로 건드리지 않는다.
    var lift = function (e) {
      if (!pts[e.pointerId] || (e.target && svg.contains(e.target))) return;
      delete pts[e.pointerId];
      if (drag && drag.id === e.pointerId) drag = null;
      if (gdrag && gdrag.id === e.pointerId) { gdrag = null; drawCanvas(); }
      if (!Object.keys(pts).length) { pinch = null; drag = null; }
    };
    window.addEventListener("pointerup", lift, true); window.addEventListener("pointercancel", lift, true);
    svg.addEventListener("wheel", function (e) { if (!view.cam) return; e.preventDefault(); view.manual = true; var p = toCm(e); zoom(e.deltaY > 0 ? 1.12 : 1 / 1.12, p.x, p.y); }, { passive: false });
    window.addEventListener("resize", function () { if (view.open) fit(); });
    // 카드 높이가 바뀌면(너치 추가·더보기·안내 문구) 가려졌을 때만 한 번 보정 — 사용자가 직접 옮겼으면 건드리지 않는다.
    var cardEl = $("cutSeamCard");
    if (cardEl && typeof ResizeObserver !== "undefined") { var lastH = -1; new ResizeObserver(function () { var hh = cardEl.hidden ? 0 : cardEl.getBoundingClientRect().height; if (Math.abs(hh - lastH) < 1) return; lastH = hh; cardChanged(); }).observe(cardEl); }
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
    viewState: function () { return { manual: !!view.manual, lastReveal: view.lastReveal || null, cam: view.cam ? Object.assign({}, view.cam) : null, open: view.open, sel: view.sel, edge: view.edge ? view.edge.piece + "|" + view.edge.id : null, seam: view.seam ? view.seam.done + "/" + view.seam.total : null, state: view.data && view.data.state, resultHash: view.data && view.data.resultHash, pieces: view.data && view.data.pieces ? view.data.pieces.map(function (p) { return p.id; }) : [] }; }
  }));

  if (typeof document !== "undefined" && document.querySelector && document.addEventListener) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindView); else bindView();
  }
})();
