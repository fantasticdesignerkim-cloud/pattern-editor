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
  // 구조 모서리(SV2). SV3 봉제 의미(neckline/shoulder/armhole)가 붙어도 아래 **기존 휴리스틱이
  // 고르던 세그먼트를 그대로 고르도록** 이 집합만 배제한다 — 측정 경로를 semantic 으로 교체하지
  // 않는다(교체는 Phase 1 canonical 측정 승인 이후). 동일성은 하네스가 회귀로 비교한다.
  var STRUCT_EDGE = { center: 1, waist: 1, "side-seam": 1, hem: 1 };
  var isStructEdge = function (s) { return !!STRUCT_EDGE[s.edge]; };
  // 진동둘레 길이: **구조 모서리가 아닌 곡선(path/cubic) 중 center-top(목점)에 닿지 않는** 세그먼트 합.
  //   어깨는 항상 직선·네크라인은 목점에 닿음 → 남는 곡선이 진동(앞은 다트로 2조각, 뒤는 1조각).
  //   네크라인/여밈에 무관하도록 geometry 로 측정(designOutline 아님).
  function armholeLen(geometry, piece) {
    var b = geometry && geometry[piece]; if (!b || !Array.isArray(b.outline)) return { ok: false, len: 0, segs: [] };
    var top = centerTop(geometry, piece); if (!top) return { ok: false, len: 0, segs: [] };
    var touchesTop = function (s) { return endpointsOf(s).some(function (p) { return dist(p, top) < 0.05; }); };
    var arcs = b.outline.filter(function (s) {
      if (isStructEdge(s)) return false;                // center/waist/side-seam/hem 제외
      var curve = (s.kind === "cubic") || (s.kind === "path");
      return curve && !touchesTop(s);                   // 네크라인(목점 접) 제외, 직선 어깨는 curve 아님
    });
    if (!arcs.length) return { ok: false, len: 0, segs: [] };
    return { ok: true, len: arcs.reduce(function (t, s) { return t + segLen(s); }, 0), segs: arcs };
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
    var seg = b.outline.find(function (s) { return !isStructEdge(s) && endpointsOf(s).some(function (p) { return dist(p, top) < 0.05; }); });
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

  // ── 봉제 의미 readiness(P0.1) ──
  // **현재 effective outline** 의 의미 완전성을 평가한다. designProject.semanticStatus 는
  // source block 상태라 편집 후를 대표하지 못하므로, 편집 결과는 여기서 따로 평가해 완료
  // 스냅샷에 보존한다. ★ 이번 증분에서 이 값으로 몸판 완료를 **막지 않는다** — 이후
  // project seam-ready 게이트가 소비할 증거만 남긴다(hash·측정 경로 무관).
  //
  // 필수 role(현재 effective outline 구성 기준): 신규 봉제 경계 3종 + 기존 seam-relevant 2종.
  //   waist/hem 은 디자인 길이 상태에 따라 외곽 경계였다가 내부 기준선으로 옮겨가므로
  //   **무조건 요구하지 않는다**(waist 를 봉제선으로 자동 분류하지 않는다).
  //   각 role 은 **1 span 이상이면 존재**로 본다 — span 수를 고정하지 않는다.
  var REQUIRED_ROLES = ["neckline", "shoulder", "armhole", "center", "side-seam"];

  // ── 구조화 다트 의미(P0.2) ──
  // 다트 레코드는 **선언된 metadata + 그 primitive 자신의 좌표**로만 만든다. 좌표 근접/배열
  // 순서로 apex·leg·intake·target boundary 를 찾아내지 않는다.
  // ⚠️ 자동 정렬이 보장되지 않는다: primitive 좌표와 선언 attachment({root,t})는 **서로 다른 데이터**이고
  //   디자인 변환·다트 이동이 둘 중 하나만 바꾸면 어긋난다. 그래서 seam-ready gate(attachmentStatus)가
  //   둘의 정합을 별도로 검증하며, 경계나 다리를 바꾸는 **변환 생산자가 정합을 보존할 책임**을 진다.
  function dartEndsOf(prim) {
    var e = endpointsOf(prim);
    var a = e[0], z = e[e.length - 1];
    return (prim.dart.apexAt === "from") ? { apex: a, leg: z } : { apex: z, leg: a };
  }
  // effective outline + construction 에서 piece 별 다트 레코드를 모은다(다중 다트 지원).
  function dartRecords(proj, piece) {
    var eff = effectiveOutline(proj, piece) || [];
    var g = proj.working.geometry && proj.working.geometry[piece];
    var constr = (g && Array.isArray(g.construction)) ? g.construction : [];
    var groups = {}, order = [];
    eff.concat(constr).forEach(function (prm) {
      if (!prm || !prm.dart || !prm.dart.id) return;
      var id = prm.dart.id;
      if (!groups[id]) { groups[id] = []; order.push(id); }
      groups[id].push(prm);
    });
    return order.sort().map(function (id) {
      var legs = groups[id];
      var onFold = legs.some(function (l) { return !!l.dart.onFold; });
      var ends = legs.map(dartEndsOf);
      var apex = ends[0].apex;
      var legPts = ends.map(function (x) { return x.leg; });
      // intake = 경계 위 두 leg endpoint 사이 열린 분량. 접어재단 반쪽 다트는 다리가 하나라
      // 전체 intake 를 알 수 없으므로 **null 로 남긴다**(지어내지 않는다).
      var intake = (legPts.length === 2) ? round4(dist(legPts[0], legPts[1])) : null;
      var apexOk = ends.every(function (x) { return dist(x.apex, apex) < 1e-4; });
      // P0.3b: 다리마다 선언된 경계 attachment 를 **최종 effective 경계 구간**에 대조한다(복원·보정 없음).
      var attachments = legs.map(function (l) {
        var at = l.dart.attach;
        if (!at) return { root: null, t: null, status: "missing" };
        var st = attachmentStatus(proj, at, piece, l.dart.boundary, dartEndsOf(l).leg);
        return { root: (typeof at.root === "string") ? at.root : null, t: isFinite(at.t) ? round4(at.t) : null, status: st };
      });
      var attachment = attachments.some(function (a) { return a.status === "misaligned"; }) ? "misaligned"
        : attachments.some(function (a) { return a.status === "missing"; }) ? "missing" : "complete";
      return {
        id: id, boundary: legs[0].dart.boundary || null, onFold: onFold,
        apex: { x: round4(apex.x), y: round4(apex.y) },
        legs: legPts.map(function (q) { return { x: round4(q.x), y: round4(q.y) }; }),
        intakeCm: intake, legCount: legs.length,
        attachments: attachments, attachment: attachment,
        complete: apexOk && legs.length === (onFold ? 1 : 2) && !!legs[0].dart.boundary
      };
    });
  }
  // 의미 전용 deterministic fingerprint. **기존 형상 hash 와 분리** — 의미만 바뀌어도 바뀐다.
  function semanticFingerprint(perPiece) {
    var parts = [];
    Object.keys(perPiece).sort().forEach(function (piece) {
      perPiece[piece].forEach(function (d) {
        parts.push([piece, d.id, d.boundary, d.onFold ? "fold" : "-", d.legCount,
          d.apex.x, d.apex.y,
          d.legs.map(function (q, i) { var a = d.attachments[i]; return q.x + ":" + q.y + "@" + a.root + ":" + a.t + ":" + a.status; }).sort().join("/"),
          d.intakeCm].join("|"));
      });
    });
    return hashStr(parts.sort().join(";"));
  }

  // ── 봉제 경계 안정 identity(P0.3a) ──
  // 생산자가 선언한 primitive.boundary = { root, ranges:[[from,to] per 그리기 명령] } 만 읽는다.
  // root 는 좌표·배열 순서에서 만들지 않는다. **최종 effective outline** 에서 모으므로 manual 합성·
  // 디자인 변환 뒤의 lineage 가 그대로 증거가 된다. 이번 단계는 참조 기반까지만 — affected chain·
  // correspondence·닫힘 부호는 만들지 않는다.
  var BOUNDARY_ROOT_EDGE = {
    center: "center", waist: "waist", "side-seam": "side-seam",
    neckline: "neckline", shoulder: "shoulder",
    "shoulder-neck": "shoulder", "shoulder-armhole": "shoulder",
    armhole: "armhole", "armhole-upper": "armhole", "armhole-lower": "armhole",
    hem: "hem", "center-extension": "center", "side-seam-extension": "side-seam"
  };
  // root 파라미터 계약은 [0,1]. 부동소수 오차만 흡수하는 명시적 허용치 — 그 밖은 정렬 실패로 본다.
  var BOUNDARY_RANGE_EPS = 1e-6;
  function inRootRange(v) { return isFinite(v) && v >= -BOUNDARY_RANGE_EPS && v <= 1 + BOUNDARY_RANGE_EPS; }
  function commandCount(prim) {
    if (prim.kind === "line" || prim.kind === "cubic") return 1;
    if (prim.kind === "path" && Array.isArray(prim.commands)) return prim.commands.filter(function (c) { return c.type === "C"; }).length;
    return 0;
  }
  // 선언값이 이 primitive·piece 와 정렬되는지만 검사한다(형상 재추론 없음).
  function boundaryDeclOk(prim, piece) {
    var b = prim.boundary;
    if (!b || typeof b.root !== "string" || !Array.isArray(b.ranges)) return false;
    var slash = b.root.indexOf("/");
    if (slash < 0 || b.root.slice(0, slash) !== piece) return false;
    if (BOUNDARY_ROOT_EDGE[b.root.slice(slash + 1)] !== prim.edge) return false;
    if (b.ranges.length !== commandCount(prim)) return false;
    return b.ranges.every(function (r) { return Array.isArray(r) && r.length === 2 && inRootRange(r[0]) && inRootRange(r[1]) && r[0] !== r[1]; });
  }
  // 안정 span reference 를 순서·방향과 함께 담는 ordered chain(기반만). 입력은 {root, from, to} 목록.
  // 유효하지 않은 참조가 하나라도 있으면 chain 을 만들지 않는다(부분 chain 을 ready 로 위장하지 않음).
  // P0.3b: attachment 판정. root 는 앞/뒤 root 여야 하고(shared 다트는 어느 쪽이든), root 의미가 다트
  //   boundary 와 같고, t 가 [0,1] 이며, 그 root piece 의 effective outline ∪ construction(허리처럼 기준선으로
  //   옮겨간 경계 lineage 포함)에서 **정렬된 선언 구간이 t 를 덮어야** 한다. 아니면 misaligned.
  // ★ P0.3b 보완: coverage 만으로는 경계만 움직이고 다리는 제자리인 경우를 못 잡는다. 선언된 {root,t} 를
  //   좌표로 복원하지 않고 **그 참조의 무결성만** 검증한다 — t 를 덮는 모든 후보 구간에서 t 의 실제 점을
  //   평가해 다리 경계 끝점과 계산 허용치 안에서 일치하는 후보가 하나라도 있어야 complete.
  //   local 파라미터는 명령별 선언 구간·방향에 affine(호길이·봉제 허용오차·다트 닫힘 아님).
  //   ATTACH_POINT_EPS(cm)는 부동소수 계산 허용치이며 봉제 허용오차(MATCH/CHECK)와 분리한다.
  var ATTACH_POINT_EPS = 1e-3;
  function cubicPt(p0, p1, p2, p3, u) {
    var v = 1 - u;
    return { x: v * v * v * p0.x + 3 * v * v * u * p1.x + 3 * v * u * u * p2.x + u * u * u * p3.x,
             y: v * v * v * p0.y + 3 * v * v * u * p1.y + 3 * v * u * u * p2.y + u * u * u * p3.y };
  }
  function commandEvaluators(prm) {
    if (prm.kind === "line") return [function (u) { return { x: prm.from.x + (prm.to.x - prm.from.x) * u, y: prm.from.y + (prm.to.y - prm.from.y) * u }; }];
    if (prm.kind === "cubic") return [function (u) { return cubicPt(prm.from, prm.c1, prm.c2, prm.to, u); }];
    var out = [], cur = null;
    (prm.commands || []).forEach(function (c) {
      if (c.type === "M") { cur = c.points[0]; return; }
      if (c.type !== "C") return;
      var st = cur, q = c.points; cur = q[2];
      out.push(function (u) { return cubicPt(st, q[0], q[1], q[2], u); });
    });
    return out;
  }
  function attachmentStatus(proj, at, piece, boundary, legPt) {
    if (!at || typeof at.root !== "string" || !inRootRange(at.t)) return "misaligned";
    var slash = at.root.indexOf("/"), rp = at.root.slice(0, slash), rn = at.root.slice(slash + 1);
    if (slash < 0 || !(rp === "front" || rp === "back") || !BOUNDARY_ROOT_EDGE[rn]) return "misaligned";
    if (piece !== "shared" && rp !== piece) return "misaligned";
    if (boundary && BOUNDARY_ROOT_EDGE[rn] !== boundary) return "misaligned";
    var g = proj.working.geometry && proj.working.geometry[rp];
    var prims = (effectiveOutline(proj, rp) || []).concat((g && Array.isArray(g.construction)) ? g.construction : []);
    var matched = !!legPt && prims.some(function (prm) {
      if (!prm || !prm.boundary || prm.boundary.root !== at.root || !boundaryDeclOk(prm, rp)) return false;
      var evals = commandEvaluators(prm);
      return prm.boundary.ranges.some(function (r, k) {
        if (!evals[k] || at.t < Math.min(r[0], r[1]) - BOUNDARY_RANGE_EPS || at.t > Math.max(r[0], r[1]) + BOUNDARY_RANGE_EPS) return false;
        var u = Math.max(0, Math.min(1, (at.t - r[0]) / (r[1] - r[0])));
        var q = evals[k](u);
        return Math.hypot(q.x - legPt.x, q.y - legPt.y) <= ATTACH_POINT_EPS;   // 이 다리 좌표와 맞는 후보 하나면 충분
      });
    });
    return matched ? "complete" : "misaligned";
  }
  function makeBoundaryChain(spans) {
    if (!Array.isArray(spans) || !spans.length) return { ok: false, reason: "empty-chain" };
    var out = [];
    for (var i = 0; i < spans.length; i++) {
      var sp = spans[i];
      if (!sp || typeof sp.root !== "string" || !isFinite(sp.from) || !isFinite(sp.to) || sp.from === sp.to) return { ok: false, reason: "invalid-span", index: i };
      if (!inRootRange(sp.from) || !inRootRange(sp.to)) return { ok: false, reason: "span-out-of-range", index: i };
      out.push(Object.freeze({ root: sp.root, from: sp.from, to: sp.to, direction: sp.to > sp.from ? "forward" : "reverse" }));
    }
    return { ok: true, chain: Object.freeze({ spans: Object.freeze(out) }) };
  }
  // piece 의 effective outline 에서 span reference 목록(outline 순서 그대로) + 누락/부정합 증거.
  function boundarySpans(proj, piece) {
    var spans = [], missing = [], misaligned = [];
    (effectiveOutline(proj, piece) || []).forEach(function (prim) {
      if (!prim) return;
      if (prim.boundary) {
        if (!boundaryDeclOk(prim, piece)) { misaligned.push({ piece: piece, role: prim.edge || null, root: (typeof prim.boundary.root === "string") ? prim.boundary.root : null }); return; }
        prim.boundary.ranges.forEach(function (r) { spans.push({ root: prim.boundary.root, role: prim.edge, from: r[0], to: r[1] }); });
      } else if (prim.edge) {
        missing.push({ piece: piece, role: prim.edge });   // 의미는 있는데 identity 선언이 없음
      }
    });
    return { spans: spans, missing: missing, misaligned: misaligned };
  }
  // 경계 topology 의미 전용 fingerprint. 형상 hash 와 분리 — 좌표·배치·UI 상태 미포함.
  // ★ ordered semantics: piece 순서는 명시적으로 front→back 고정, 각 piece 안에서는 effective
  //   outline 의 span 순서를 **그대로 보존**한다(정렬하지 않는다). 같은 span 집합이라도 순서가
  //   바뀌면 fingerprint 가 바뀐다.
  var BOUNDARY_PIECE_ORDER = ["front", "back"];
  function boundaryFingerprint(per) {
    var parts = [];
    BOUNDARY_PIECE_ORDER.forEach(function (piece) {
      var e = per[piece] || { spans: [], missing: [], misaligned: [] };
      parts.push("piece|" + piece);
      e.spans.forEach(function (sp) { parts.push(["span", sp.role, sp.root, round4(sp.from), round4(sp.to)].join("|")); });
      e.missing.forEach(function (m) { parts.push(["missing", m.role].join("|")); });
      e.misaligned.forEach(function (m) { parts.push(["misaligned", m.role, m.root].join("|")); });
    });
    return hashStr(parts.join(";"));
  }

  // 상호 배타적 단일 status 를 쓰지 않는다 — legacy / unresolved / missing 은 **동시에** 성립할
  // 수 있으므로 issues 배열로 복수 원인을 전부 보존한다. summary(ready)는 issues 를 덮지 않는다.
  function evaluateSemantics(proj) {
    var sb = proj && proj.sourceBlock;
    var sv = (sb && typeof sb.schemaVersion === "number") ? sb.schemaVersion : null;
    var unresolved = [], missing = [], issues = [], seen = {}, hasUnresolved = { front: false, back: false };
    ["front", "back"].forEach(function (piece) {
      var outline = effectiveOutline(proj, piece) || [];
      var have = {};
      outline.forEach(function (s) {
        if (s.edge) have[s.edge] = 1;                       // role 은 edge 에만
        if (s.edgeStatus === "unresolved") {                // 명시적 unresolved 만 인정
          hasUnresolved[piece] = true;
          var lineId = (typeof s.edgeSourceLineId === "string") ? s.edgeSourceLineId : null;
          var key = piece + "|" + lineId;
          if (!seen[key]) { seen[key] = 1; unresolved.push({ piece: piece, lineId: lineId }); }
        }
      });
      REQUIRED_ROLES.forEach(function (role) { if (!have[role]) missing.push({ piece: piece, role: role }); });
    });
    // 구조화 다트 의미(P0.2)
    var darts = { front: dartRecords(proj, "front"), back: dartRecords(proj, "back"), shared: dartRecords(proj, "shared") };
    var dartIssue = false, dartBoundaryMissing = false;
    ["front", "back", "shared"].forEach(function (piece) {
      var roleHost = (piece === "shared") ? "front" : piece;   // shared 다트는 앞판 경계로 열린다
      // ★ 경계 존재 판정은 **유효 외곽 ∪ construction** 으로 본다. waist/hem 은 디자인 길이 상태에
      //   따라 외곽 경계였다가 내부 기준선으로 옮겨가므로(hem 연장), 그 이동을 "끊김"으로 오판하지
      //   않는다. 실제로 사라진 경우(대체선이 구간을 삼킴)만 잡는다.
      var have = {}, hg = proj.working.geometry && proj.working.geometry[roleHost];
      (effectiveOutline(proj, roleHost) || []).forEach(function (s2) { if (s2.edge) have[s2.edge] = 1; });
      if (hg && Array.isArray(hg.construction)) hg.construction.forEach(function (s2) { if (s2.edge) have[s2.edge] = 1; });
      darts[piece].forEach(function (d) {
        if (!d.complete) dartIssue = true;
        // manual replacement 가 다트가 열리는 경계를 끊었으면 complete 로 두지 않는다.
        if (d.boundary && !have[d.boundary]) dartBoundaryMissing = true;
      });
    });
    // 경계 identity(P0.3a)
    var bnd = { front: boundarySpans(proj, "front"), back: boundarySpans(proj, "back") };
    var bMissing = bnd.front.missing.concat(bnd.back.missing), bMisaligned = bnd.front.misaligned.concat(bnd.back.misaligned);
    // v5 가 아닌 출처(구형 v2/v3/v4·미상)는 신규 의미를 보장하지 못한다.
    if (sv !== 6) issues.push("legacy-source");
    // legacy 는 identity 가 없는 것이 정상이라 legacy-source 로 이미 not-ready 다(누락을 지어내지 않음).
    if (sv >= 5 && bMissing.length) issues.push("boundary-identity-missing");
    // P0.3b 다트 attachment: v6 에서 선언이 없으면 incomplete, 선언이 최종 경계와 정렬되지 않으면 misaligned.
    //   legacy(v2~v5)는 선언이 없는 것이 정상 — legacy-source 로 이미 not-ready 이므로 누락을 오류로 만들지 않는다.
    var attMissing = false, attMisaligned = false;
    ["front", "back", "shared"].forEach(function (pc) { darts[pc].forEach(function (d) {
      if (d.attachment === "misaligned") attMisaligned = true;
      if (d.attachment === "missing" || d.attachments.some(function (a) { return a.status === "missing"; })) attMissing = true;
    }); });
    if (sv >= 6 && attMissing) issues.push("dart-attachment-missing");
    if (attMisaligned) issues.push("dart-attachment-misaligned");
    if (bMisaligned.length) issues.push("boundary-identity-misaligned");
    if (dartIssue) issues.push("dart-semantics-incomplete");
    if (dartBoundaryMissing) issues.push("dart-boundary-missing");
    if (unresolved.length) issues.push("unresolved-replacement");
    // 필수 role 이 **provenance 있는 unresolved 없이** 사라졌다면 metadata 전달 오류다
    // (의도된 unresolved 와 구분). unresolved 로 설명되는 유실도 missing 목록에는 그대로 남긴다.
    var unexplained = missing.filter(function (m) { return sv >= 4 && !hasUnresolved[m.piece]; });
    if (unexplained.length) issues.push("missing-required-role");
    return { ready: issues.length === 0, sourceSchemaVersion: sv, issues: issues, unresolved: unresolved, missing: missing,
      darts: darts, fingerprint: semanticFingerprint(darts),
      boundaries: {
        front: bnd.front.spans.map(function (sp) { return { root: sp.root, role: sp.role, from: round4(sp.from), to: round4(sp.to) }; }),
        back: bnd.back.spans.map(function (sp) { return { root: sp.root, role: sp.role, from: round4(sp.from), to: round4(sp.to) }; }),
        missing: bMissing, misaligned: bMisaligned
      },
      boundaryFingerprint: boundaryFingerprint(bnd) };
  }

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
      previews: { neckline: !manualBad, placket: !placketBad, ok: previewOk },
      semantics: evaluateSemantics(proj)          // 완료 차단 아님 — 증거만
    };
  }

  function deepFreeze(o) {
    if (o && typeof o === "object") { Object.keys(o).forEach(function (k) { deepFreeze(o[k]); }); Object.freeze(o); }
    return o;
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  // 32bit 해시(문자열) — 소매 결과가 sourceBodiceHash 로 어떤 완료본에서 나왔는지 고정하는 용도.
  function hashStr(s) { var h = 0; for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return (h >>> 0).toString(16); }

  // ── 완료 ── 검사 통과 시 working.bodiceResult 불변 스냅샷 생성. 실패 시 변경 없음.
  function complete(proj) {
    proj = proj || project();
    if (!proj) return { ok: false, reason: "no-project" };
    var c = check(proj);
    if (!c.ok) return { ok: false, reason: c.fails[0], check: c };
    var effF = effectiveOutline(proj, "front"), effB = effectiveOutline(proj, "back");
    var g = proj.working.geometry;
    var ahF = armholeLen(g, "front"), ahB = armholeLen(g, "back");
    // 소매가 참조할 형상 hash(형상 전용: 유효 외곽·진동·목둘레·여밈. 배치·선택·guide 제외).
    var placketParams = proj.working.frontPlacket ? proj.working.frontPlacket.parameters : null;
    var sig = signature(canonOutline(effF), canonOutline(effB), c.armhole, c.neckline, placketParams);
    var result = deepFreeze({
      sourceVersion: proj.sourceBlock ? proj.sourceBlock.version : null,
      hash: hashStr(sig),                                     // 소매 결과의 sourceBodiceHash 앵커
      front: { outline: clone(effF), construction: clone(g.front.construction || []) },
      back: { outline: clone(effB), construction: clone(g.back.construction || []) },
      // ★ 진동선 primitive 자체(소매는 길이값이 아니라 이 곡선을 참조). 앞은 다트로 2조각.
      armhole: { front: clone(ahF.segs), back: clone(ahB.segs) },
      armholeLengths: { front: round4(c.armhole.front), back: round4(c.armhole.back) },
      necklineLengths: { front: round4(c.neckline.front), back: round4(c.neckline.back), half: round4(c.neckline.half), finished: round4(c.neckline.finished) },
      placket: proj.working.frontPlacket ? clone(proj.working.frontPlacket) : null,
      // 편집 후 봉제 의미 readiness(복수 원인 보존). **hash signature 에 미포함** — 형상 identity 불변.
      semantics: evaluateSemantics(proj),
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

  window.bodiceCheckpoint = Object.freeze({ evaluateSemantics: evaluateSemantics, makeBoundaryChain: makeBoundaryChain, check: check, complete: complete, latest: latest, isCurrentBodiceChanged: isCurrentBodiceChanged });
})();
