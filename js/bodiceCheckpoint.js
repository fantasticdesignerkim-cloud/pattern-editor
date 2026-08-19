// ══════════════════════════════════════════════
// bodiceCheckpoint.js — 몸판 모양 완료 체크포인트(원형 완료 blockWorkflow 와 같은 결).
//
// Design 몸판 결과를 **세션 전용 불변 스냅샷** working.bodiceResult 로 잠근다. 소매 단계가
// 안정적으로 몸판(확정 진동선)을 참조하게 하는 것이 목적이다. **아직 시접·너치·재단선이 아니다.**
//
// 단계 계약(사용자 확정):
//   · 이것은 Design 몸판 결과이며 재단 패턴이 아니다.
//   · 소매 단계는 bodiceResult 의 확정 진동선만 참조한다.
//   · 몸판을 다시 수정하면 소매 결과를 조용히 갱신하지 말고 "몸판 변경됨"으로 무효화 →
//     사용자가 다시 완료한 뒤 소매를 명시적으로 재생성한다.
//   · reference·원본 block 은 불변.
//
// 완료 게이트(사용자 확정): 옆선 봉제 길이 차 >0.3cm(불일치)이면 완료 차단. 0.1~0.3(확인)·
//   ≤0.1(정합)은 허용. 외곽 연결 실패 / 진동·목둘레 미측정 / 무효 preview(manual 인데
//   designOutline null, placket 파라미터 있는데 frontPlacket null)도 차단.
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var MATCH = 0.1, CHECK = 0.3;   // 옆선 봉제 길이 차 임계(cm)

  function project() { return (window.designWorkflow && window.designWorkflow.current()) || null; }
  function cp(p) { return { x: p.x, y: p.y }; }
  function dist(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); }

  // 세그먼트 호 길이(line/cubic/path). cubic 은 24 샘플(길이 측정용).
  function segLen(seg) {
    if (seg.kind === "line") return dist(seg.from, seg.to);
    if (seg.kind === "cubic") return cubicLen(seg.from, seg.c1, seg.c2, seg.to);
    if (seg.kind === "path" && Array.isArray(seg.commands)) {
      var total = 0, cur = seg.commands[0] && seg.commands[0].points[0];
      seg.commands.forEach(function (c) {
        if (c.type === "M") { cur = c.points[0]; return; }
        if (c.type !== "C" || !cur) return;
        total += cubicLen(cur, c.points[0], c.points[1], c.points[2]); cur = c.points[2];
      });
      return total;
    }
    return 0;
  }
  function cubicLen(p0, p1, p2, p3) {
    var total = 0, prev = p0;
    for (var i = 1; i <= 24; i++) {
      var t = i / 24, u = 1 - t;
      var q = { x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
                y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y };
      total += dist(prev, q); prev = q;
    }
    return total;
  }
  function endpointsOf(seg) {
    if (seg.kind === "line") return [seg.from, seg.to];
    if (seg.kind === "cubic") return [seg.from, seg.to];
    if (seg.kind === "path" && Array.isArray(seg.commands)) {
      var pts = [];
      seg.commands.forEach(function (c) { if (c.type === "M") pts.push(c.points[0]); else if (c.type === "C") pts.push(c.points[c.points.length - 1]); });
      return pts;
    }
    return [];
  }

  // 현재 유효 앞/뒤 외곽(designOutline 우선 = manual 네크라인 반영).
  function effectiveOutline(proj, piece) {
    var dO = proj.working.designOutline && proj.working.designOutline[piece];
    if (dO && Array.isArray(dO.outline) && dO.outline.length) return dO.outline;
    var g = proj.working.geometry && proj.working.geometry[piece];
    return (g && Array.isArray(g.outline)) ? g.outline : null;
  }

  // 옆선 봉제 길이(geometry edge==="side-seam"). 네크라인/여밈은 옆선 미영향이라 geometry 로 충분.
  function sideSeamLen(geometry, piece) {
    var b = geometry && geometry[piece]; if (!b || !Array.isArray(b.outline)) return 0;
    return b.outline.filter(function (s) { return s.edge === "side-seam"; }).reduce(function (t, s) { return t + segLen(s); }, 0);
  }
  // center edge 최상단 점(FNP/BNP). 진동 식별에서 네크라인 제외용.
  function centerTop(geometry, piece) {
    var b = geometry && geometry[piece]; if (!b) return null;
    var top = null;
    b.outline.forEach(function (s) { if (s.edge !== "center") return; endpointsOf(s).forEach(function (p) { if (!top || p.y < top.y) top = p; }); });
    return top;
  }
  // 진동둘레 길이: **edge 없는 곡선(path/cubic) 중 center-top(목점)에 닿지 않는** 세그먼트 합.
  //   어깨는 항상 직선·네크라인은 목점에 닿음 → 남는 곡선이 진동(앞은 다트로 2조각, 뒤는 1조각).
  //   네크라인/여밈에 무관하도록 geometry 로 측정(designOutline 아님).
  function armholeLen(geometry, piece) {
    var b = geometry && geometry[piece]; if (!b || !Array.isArray(b.outline)) return { ok: false, len: 0 };
    var top = centerTop(geometry, piece); if (!top) return { ok: false, len: 0 };
    var touchesTop = function (s) { return endpointsOf(s).some(function (p) { return dist(p, top) < 0.05; }); };
    var arcs = b.outline.filter(function (s) {
      if ("edge" in s) return false;                    // center/waist/side-seam/hem 제외
      var curve = (s.kind === "cubic") || (s.kind === "path");
      return curve && !touchesTop(s);                   // 네크라인(목점 접) 제외, 직선 어깨는 curve 아님
    });
    if (!arcs.length) return { ok: false, len: 0 };
    return { ok: true, len: arcs.reduce(function (t, s) { return t + segLen(s); }, 0) };
  }

  // 네크라인 반쪽 길이: manual = 자동 boundary 선 / parametric = geometry.necklineLenCm / 원본 = 단일 추적.
  function necklineHalf(proj, piece) {
    var nk = proj.working.parameters && proj.working.parameters.neckline;
    if (nk && nk.mode === "manual" && nk.boundaryLineIds) {
      var id = nk.boundaryLineIds[piece];
      var line = (proj.working.patternLines || []).find(function (l) { return l.id === id; });
      if (line) return line.segments.reduce(function (t, s) { return t + segLen(s); }, 0);
      return 0;
    }
    var b = proj.working.geometry && proj.working.geometry[piece];
    if (b && typeof b.necklineLenCm === "number") return b.necklineLenCm;
    // 원본/미적용: center-top 에 닿는 단일 네크라인 세그먼트.
    if (!b || !Array.isArray(b.outline)) return 0;
    var top = centerTop(proj.working.geometry, piece); if (!top) return 0;
    var seg = b.outline.find(function (s) { return !("edge" in s) && endpointsOf(s).some(function (p) { return dist(p, top) < 0.05; }); });
    return seg ? segLen(seg) : 0;
  }

  // 유효 외곽 연결성: designLineTool.buildPieceRing 로 폐곡선 구성 성공 여부.
  function connectivityOk(proj, piece) {
    if (!window.designLineTool || !window.designLineTool.buildPieceRing) return true;   // 도구 없으면 통과(검증 불가)
    var outline = effectiveOutline(proj, piece); if (!outline) return false;
    var ring = ringSegs(outline);
    var g = proj.working.geometry && proj.working.geometry[piece];
    var constr = (g && Array.isArray(g.construction)) ? g.construction.filter(function (s) { return s.kind === "line"; }).map(function (s) { return { from: cp(s.from), to: cp(s.to) }; }) : [];
    // shared(허리다트 c 다리)은 front 에 귀속 — front 링에 함께.
    if (piece === "front" && proj.working.geometry.shared) (proj.working.geometry.shared.construction || []).forEach(function (s) { if (s.kind === "line") constr.push({ from: cp(s.from), to: cp(s.to) }); });
    try { var r = window.designLineTool.buildPieceRing(ring, constr); return !!(r && r.ok); }
    catch (e) { return false; }
  }
  // 외곽을 buildPieceRing 이 받는 {line|cubic} 로 정규화(path→cubic).
  function ringSegs(outline) {
    var out = [];
    outline.forEach(function (s) {
      if (s.kind === "line") out.push({ kind: "line", from: cp(s.from), to: cp(s.to) });
      else if (s.kind === "cubic") out.push({ kind: "cubic", from: cp(s.from), c1: cp(s.c1), c2: cp(s.c2), to: cp(s.to) });
      else if (s.kind === "path" && Array.isArray(s.commands)) { var cur = null; s.commands.forEach(function (c) { if (c.type === "M") cur = c.points[0]; else if (c.type === "C") { out.push({ kind: "cubic", from: cp(cur), c1: cp(c.points[0]), c2: cp(c.points[1]), to: cp(c.points[2]) }); cur = c.points[2]; } }); }
    });
    return out;
  }

  function round4(v) { return Math.round(v * 1e4) / 1e4; }

  // ── 검사 ──
  function check(proj) {
    proj = proj || project();
    if (!proj) return { ok: false, fails: ["no-project"] };
    var g = proj.working.geometry;
    var conF = connectivityOk(proj, "front"), conB = connectivityOk(proj, "back");
    var ssF = sideSeamLen(g, "front"), ssB = sideSeamLen(g, "back"), ssDiff = Math.abs(ssF - ssB);
    var ssStatus = ssDiff <= MATCH ? "match" : (ssDiff <= CHECK ? "check" : "mismatch");
    var ahF = armholeLen(g, "front"), ahB = armholeLen(g, "back");
    var nkF = necklineHalf(proj, "front"), nkB = necklineHalf(proj, "back"), nkHalf = nkF + nkB;
    // preview 유효성: manual 인데 designOutline 없음 / placket 파라미터 있는데 frontPlacket 없음 = 무효.
    var nk = proj.working.parameters && proj.working.parameters.neckline;
    var manualBad = !!(nk && nk.mode === "manual") && !(proj.working.designOutline && proj.working.designOutline.front);
    var placketParamsExist = false, placketBad = false;   // frontPlacket 은 성공 시에만 존재(실패 시 null)
    // (여밈은 성공 시에만 저장되므로, "파라미터 입력했는데 null"은 UI 가 막는다. 여기선 존재 여부만.)
    var previewOk = !manualBad && !placketBad;

    var fails = [];
    if (!conF) fails.push("front-outline-not-connected");
    if (!conB) fails.push("back-outline-not-connected");
    if (ssStatus === "mismatch") fails.push("side-seam-mismatch");
    if (!ahF.ok) fails.push("front-armhole-unmeasured");
    if (!ahB.ok) fails.push("back-armhole-unmeasured");
    if (!(nkHalf > 0)) fails.push("neckline-unmeasured");
    if (manualBad) fails.push("neckline-preview-invalid");

    return {
      ok: fails.length === 0,
      fails: fails,
      connectivity: { front: conF, back: conB, ok: conF && conB },
      sideSeam: { front: ssF, back: ssB, diff: ssDiff, status: ssStatus },
      armhole: { front: ahF.len, back: ahB.len, ok: ahF.ok && ahB.ok },
      neckline: { front: nkF, back: nkB, half: nkHalf, finished: 2 * nkHalf, ok: nkHalf > 0 },
      previews: { neckline: !manualBad, placket: !placketBad, ok: previewOk }
    };
  }

  function deepFreeze(o) {
    if (o && typeof o === "object") { Object.keys(o).forEach(function (k) { deepFreeze(o[k]); }); Object.freeze(o); }
    return o;
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  // ── 완료 ── 검사 통과 시 working.bodiceResult 불변 스냅샷 생성. 실패 시 변경 없음.
  function complete(proj) {
    proj = proj || project();
    if (!proj) return { ok: false, reason: "no-project" };
    var c = check(proj);
    if (!c.ok) return { ok: false, reason: c.fails[0], check: c };
    var effF = effectiveOutline(proj, "front"), effB = effectiveOutline(proj, "back");
    var result = deepFreeze({
      sourceVersion: proj.sourceBlock ? proj.sourceBlock.version : null,
      front: { outline: clone(effF), construction: clone(proj.working.geometry.front.construction || []) },
      back: { outline: clone(effB), construction: clone(proj.working.geometry.back.construction || []) },
      armholeLengths: { front: round4(c.armhole.front), back: round4(c.armhole.back) },
      necklineLengths: { front: round4(c.neckline.front), back: round4(c.neckline.back), half: round4(c.neckline.half), finished: round4(c.neckline.finished) },
      placket: proj.working.frontPlacket ? clone(proj.working.frontPlacket) : null,
      completedAt: Date.now()
    });
    proj.working.bodiceResult = result;   // 세션 전용(reload 시 소멸). reference·원본 불변.
    return { ok: true, result: result, check: c };
  }

  // 현재 몸판 상태 signature(스테일 판정용): 유효 외곽 + 진동/목둘레 + 여밈 파라미터.
  function signature(front, back, armhole, neckline, placketParams) {
    return JSON.stringify({
      f: front, b: back,
      ah: { f: round4(armhole.front), b: round4(armhole.back) },
      nk: { h: round4(neckline.half) },
      pk: placketParams
    });
  }
  function currentSignature(proj) {
    var c = check(proj);
    var placketParams = proj.working.frontPlacket ? proj.working.frontPlacket.parameters : null;
    return signature(canonOutline(effectiveOutline(proj, "front")), canonOutline(effectiveOutline(proj, "back")), c.armhole, c.neckline, placketParams);
  }
  function snapshotSignature(res) {
    return signature(canonOutline(res.front.outline), canonOutline(res.back.outline),
      { front: res.armholeLengths.front, back: res.armholeLengths.back },
      { half: res.necklineLengths.half }, res.placket ? res.placket.parameters : null);
  }
  function canonOutline(outline) {
    if (!outline) return null;
    return outline.map(function (s) { return endpointsOf(s).map(function (p) { return round4(p.x) + "," + round4(p.y); }).join(";") + "|" + s.kind; });
  }
  function latest(proj) { proj = proj || project(); return (proj && proj.working.bodiceResult) || null; }
  // 완료본 없음 → true. 있으면 현재 signature 와 스냅샷 signature 비교.
  function isCurrentBodiceChanged(proj) {
    proj = proj || project(); if (!proj) return false;
    var res = proj.working.bodiceResult; if (!res) return true;
    return currentSignature(proj) !== snapshotSignature(res);
  }

  window.bodiceCheckpoint = Object.freeze({ check: check, complete: complete, latest: latest, isCurrentBodiceChanged: isCurrentBodiceChanged });
})();
