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

  // 옆선 봉제 길이 = **유효 외곽**(effectiveOutline: designOutline 우선)에서 edge==="side-seam" 으로 **명시된**
  //   구간만 합산(side-seam-extension 포함 — 같은 edge). 좌표·형상 유사성으로 옆선을 추측하지 않는다.
  //   명시 side-seam 이 하나도 없으면(예: unresolved 대체선이 옆선을 삼킴) 0 이 아니라 unavailable.
  //   ★ 허리 아래 연장(boundary root "…/side-seam-extension")만 남은 것은 기본 옆선의 증거가 아니다 — 기본 옆선
  //   (root "…/side-seam" 이거나 boundary 없는 명시 edge = legacy·명시 의미 대체선)이 하나 이상 있어야 측정하고,
  //   그때 연장을 포함한 모든 명시 side-seam 구간을 합산한다. root 이름만 보며 좌표로 복원하지 않는다.
  function isSideSeamExtension(s) { var r = s.boundary && s.boundary.root; return typeof r === "string" && /\/side-seam-extension$/.test(r); }
  function measureSideSeam(outline) {
    var segs = Array.isArray(outline) ? outline.filter(function (s) { return s && s.edge === "side-seam"; }) : [];
    if (!segs.some(function (s) { return !isSideSeamExtension(s); })) return { status: "unavailable", length: null };
    return { status: "measured", length: segs.reduce(function (t, s) { return t + segLen(s); }, 0) };
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
    // ★ 1순위: semantic 표식 `edge:"armhole"`. 원형이 이미 붙여 주고 있으며 조각을 잘라
    //   붙이는 디자인(플레어 등)에도 살아남는다.
    var tagged = b.outline.filter(function (s) { return s.edge === "armhole"; });
    if (tagged.length) return { ok: true, len: tagged.reduce(function (t, s) { return t + segLen(s); }, 0), segs: tagged };

    // 2순위(표식 없는 구형 형상): "목점에 닿지 않는 edge 없는 곡선" 휴리스틱.
    //   ⚠ 이 휴리스틱은 **다중 C 경로가 쪼개지면 깨진다** — 네크라인이 두 조각이 되면 목점에
    //   안 닿는 쪽이 진동으로 오인된다(플레어 적용 시 실측: 20.63 → 26.34, 차이 5.715 =
    //   네크라인 한 조각). 그래서 표식을 먼저 본다.
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
    var ringOk = false;
    try { var r = window.designLineTool.buildPieceRing(ring, constr); ringOk = !!(r && r.ok); }
    catch (e) { ringOk = false; }
    if (ringOk) return true;
    // 기존 경로(열린 입구 1개 + construction 다리)가 실패하면, 다트이동 후처럼 **열린 다트가 외곽선에 포함돼
    // pivot 에서 닫힌** 형상인지 선언 기반으로만 추가 판정한다(연결성만 — 다른 게이트는 우회하지 않는다).
    return closedOutlineWithDeclaredDartJunctions(outline);
  }

  // ── dart-moved 닫힌 외곽 연결성(fallback) ──
  // 외곽 primitive(line/cubic/path)를 끝점 그래프로 보고: 모든 primitive 가 한 연결 성분 · 자유 끝점 0 ·
  // 모든 정점 차수 짝수. 차수>2 정점은 그 점에 닿는 **모든** branch 가 선언된 외곽 다트 다리이고 각 다리의
  // 선언 apex(dart.apexAt) 끝이 그 정점이어야 한다. 같은 dart id 의 다리들은 선언 apex 가 한 정점으로 모여야
  // 한다(서로 다른 id 가 같은 pivot 에 모이는 부분 이동은 각 id 의 apex 가 그 정점일 때만 허용).
  // 선언 없는 branch · apex 반대 끝의 모임 · 홀수 차수 · 복수 성분 · 실제 gap 은 not-connected.
  // CONNECT_EPS 는 끝점 동일성 계산 허용치(cm)이며 ring 구성 허용치(RING_EPS)와 별개다 — 느슨하게 잇지 않는다.
  var CONNECT_EPS = 1e-4;
  function primEnds(prm) {
    if (prm.kind === "line" || prm.kind === "cubic") return [prm.from, prm.to];
    if (prm.kind === "path" && Array.isArray(prm.commands) && prm.commands.length >= 2) {
      // 정확히 하나의 연속 subpath 만 한 edge 로 본다: 첫 명령은 점 1개의 M, 이후는 점 3개의 C 만(추가 M 금지).
      //   어긋나면 끝점을 이어 붙이거나 추론하지 않고 연결 판정을 거부한다(null).
      var validPt = function (q) { return !!q && isFinite(q.x) && isFinite(q.y); };
      var c0 = prm.commands[0];
      if (!c0 || c0.type !== "M" || !Array.isArray(c0.points) || c0.points.length !== 1 || !validPt(c0.points[0])) return null;
      for (var ci = 1; ci < prm.commands.length; ci++) {
        var cc = prm.commands[ci];
        if (!cc || cc.type !== "C" || !Array.isArray(cc.points) || cc.points.length !== 3 || !cc.points.every(validPt)) return null;
      }
      var lastC = prm.commands[prm.commands.length - 1];
      return [c0.points[0], lastC.points[2]];
    }
    return null;
  }
  function closedOutlineWithDeclaredDartJunctions(outline) {
    if (!Array.isArray(outline) || !outline.length) return false;
    var verts = [];
    var vertexOf = function (pt) {
      for (var i = 0; i < verts.length; i++) if (Math.hypot(verts[i].x - pt.x, verts[i].y - pt.y) <= CONNECT_EPS) return i;
      verts.push({ x: pt.x, y: pt.y, inc: [] }); return verts.length - 1;
    };
    var edges = [];
    for (var k = 0; k < outline.length; k++) {
      var prm = outline[k], ends = prm && primEnds(prm);
      if (!ends || !ends[0] || !ends[1]) return false;
      var a = vertexOf(ends[0]), b = vertexOf(ends[1]);
      edges.push({ prm: prm, a: a, b: b });
      verts[a].inc.push({ e: edges.length - 1, at: "from" });
      verts[b].inc.push({ e: edges.length - 1, at: "to" });
    }
    // 연결 성분(union-find)
    var parent = verts.map(function (_, i) { return i; });
    var find = function (i) { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
    edges.forEach(function (ed) { parent[find(ed.a)] = find(ed.b); });
    var root0 = find(edges[0].a);
    if (!verts.every(function (_, i) { return find(i) === root0; })) return false;
    var apexVertexById = {};
    for (var v = 0; v < verts.length; v++) {
      var deg = verts[v].inc.length;
      if (deg === 0 || deg % 2 !== 0) return false;             // 자유 끝점(차수 1)·홀수 차수
      if (deg <= 2) continue;
      for (var j = 0; j < deg; j++) {
        var hit = verts[v].inc[j], dp = edges[hit.e].prm.dart;
        // 이 정점에 닿는 끝이 선언 apex 끝이어야 한다(apex 반대 끝의 모임·선언 없는 branch 는 설명 불가)
        if (!dp || !dp.id || (dp.apexAt !== "from" && dp.apexAt !== "to") || dp.apexAt !== hit.at) return false;
        if (apexVertexById[dp.id] === undefined) apexVertexById[dp.id] = v;
        else if (apexVertexById[dp.id] !== v) return false;
      }
    }
    // 차수>2 정점에서 쓰인 dart id 의 외곽 다리 전부가 같은 선언 apex 정점으로 정합해야 한다
    for (var q = 0; q < edges.length; q++) {
      var d2 = edges[q].prm.dart;
      if (!d2 || apexVertexById[d2.id] === undefined) continue;
      var apexV = d2.apexAt === "from" ? edges[q].a : d2.apexAt === "to" ? edges[q].b : -1;
      if (apexV !== apexVertexById[d2.id]) return false;
    }
    return true;
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
        group: (typeof legs[0].dart.group === "string") ? legs[0].dart.group : null, locked: legs.every(function (l) { return l.dart.locked === true; }),
        // 논리 다트 총량(생산자 선언). 다리마다 같은 값이어야 한다 — 다르면 null(비교 불가 = 실패로 이어짐).
        groupTotalCm: (function () { var v = legs[0].dart.groupTotal; return (typeof v === "number" && legs.every(function (l) { return l.dart.groupTotal === v; })) ? v : null; })(),
        apex: { x: round4(apex.x), y: round4(apex.y) },
        legs: legPts.map(function (q) { return { x: round4(q.x), y: round4(q.y) }; }),
        intakeCm: intake, legCount: legs.length,
        attachments: attachments, attachment: attachment,
        complete: apexOk && legs.length === (onFold ? 1 : 2) && !!legs[0].dart.boundary
      };
    });
  }
  // ── 완성 치수(둘레) 계측 ── 읽기 전용. 형상을 바꾸지 않고 **현재 유효 외곽**에서 잰다.
  //   완성 둘레 = (그 높이의 외곽 폭 − 그 높이를 지나는 다트 폭의 합) × 2  (앞·뒤 반패턴 → 전체)
  //   ★ 다트는 "허리에서만" 빼는 게 아니다 — 다트는 apex 로 갈수록 좁아지므로 **그 높이에서의 폭**을
  //     각각 계산해서 뺀다(예: 앞 b·뒤 d·e·f 는 BL 을 지나가지만 a·c 는 BL 위에서 이미 닫혀 0).
  //   ★ 접어재단 반쪽 다트(f: onFold·다리 1개)는 intakeCm 이 null 이라 **단순 intake 합산에서 누락된다.**
  //     여기서는 다리↔apex(접힘선) 거리로 반패턴 몫을 직접 계산하므로 빠지지 않는다.
  var GIRTH_SAMPLES = 24;          // cubic 평탄화 해상도(cubicLen 과 같은 관례)
  var GIRTH_EPS = 1e-9;
  // ★ isFinite(null) 은 true 다(Number(null)===0). 높이가 없을 때 0 으로 새지 않도록 엄격히 본다.
  function isNum(v) { return typeof v === "number" && isFinite(v); }
  function bezPt(p0, p1, p2, p3, t) {
    var u = 1 - t;
    return { x: u*u*u*p0.x + 3*u*u*t*p1.x + 3*u*t*t*p2.x + t*t*t*p3.x,
             y: u*u*u*p0.y + 3*u*u*t*p1.y + 3*u*t*t*p2.y + t*t*t*p3.y };
  }
  function polyOf(seg) {
    if (!seg) return [];
    if (seg.kind === "line") return [seg.from, seg.to];
    if (seg.kind === "cubic") {
      var o = [seg.from];
      for (var i = 1; i <= GIRTH_SAMPLES; i++) o.push(bezPt(seg.from, seg.c1, seg.c2, seg.to, i / GIRTH_SAMPLES));
      return o;
    }
    if (seg.kind === "path" && Array.isArray(seg.commands)) {
      var pts = [], cur = null;
      seg.commands.forEach(function (c) {
        if (c.type === "M") { cur = c.points[0]; pts.push(cur); return; }
        if (c.type !== "C" || !cur) return;
        for (var k = 1; k <= GIRTH_SAMPLES; k++) pts.push(bezPt(cur, c.points[0], c.points[1], c.points[2], k / GIRTH_SAMPLES));
        cur = c.points[2];
      });
      return pts;
    }
    return [];
  }
  function allSegs(proj, piece) {
    var g = proj.working.geometry && proj.working.geometry[piece];
    if (!g) return [];
    return [].concat(g.outline || [], g.construction || []);
  }
  // WL: waist edge 의 대표 y. hem 연장 시 waist 는 outline → construction 으로 옮겨가므로 둘 다 본다.
  function waistLineY(proj, piece) {
    var ys = [];
    allSegs(proj, piece).forEach(function (s) {
      if (s.edge !== "waist") return;
      endpointsOf(s).forEach(function (pt) { if (pt && isNum(pt.y)) ys.push(pt.y); });
    });
    if (!ys.length) return null;
    return ys.reduce(function (a, b) { return a + b; }, 0) / ys.length;
  }
  // BL: 진동밑점의 y = side-seam 끝점 중 가장 위(작은 y). 옆선이 곡선이어도 끝점은 그대로다.
  function bustLineY(proj, piece) {
    var m = Infinity;
    allSegs(proj, piece).forEach(function (s) {
      if (s.edge !== "side-seam") return;
      endpointsOf(s).forEach(function (pt) { if (pt && isNum(pt.y) && pt.y < m) m = pt.y; });
    });
    return isFinite(m) ? m : null;
  }
  // 그 높이에서 외곽이 차지하는 가로 폭(중심선 ↔ 옆선). 수평선과의 교차 x 들의 최대−최소.
  function outlineWidthAtY(proj, piece, y) {
    var eff = effectiveOutline(proj, piece);
    if (!eff || !eff.length || !isNum(y)) return null;
    var xs = [];
    eff.forEach(function (seg) {
      var pts = polyOf(seg);
      for (var i = 1; i < pts.length; i++) {
        var a = pts[i - 1], b = pts[i];
        if (!a || !b) continue;
        if ((a.y - y) * (b.y - y) > GIRTH_EPS) continue;          // 같은 쪽 → 교차 없음
        if (Math.abs(b.y - a.y) < GIRTH_EPS) { xs.push(a.x, b.x); continue; }   // 수평 구간
        var t = (y - a.y) / (b.y - a.y);
        if (t < -GIRTH_EPS || t > 1 + GIRTH_EPS) continue;
        xs.push(a.x + t * (b.x - a.x));
      }
    });
    if (xs.length < 2) return null;
    return Math.max.apply(null, xs) - Math.min.apply(null, xs);
  }
  // 다트가 그 높이에서 잡아먹는 폭. 다리는 apex 에서 경계까지의 직선이라 선형 보간.
  //   apex 바깥(다트가 존재하지 않는 높이)이면 0. 다리 1개(접어재단)는 접힘선(apex.x)까지의 거리.
  // ★ 경계 허용오차: 다트 다리 끝은 허리선 **위**에 있지만, 좌표가 미세하게 어긋난다
  //   (다리 y=38.00000000000001 vs 허리선 y=38 — 변환 누적 오차 + dartRecords 의 1e-4 반올림).
  //   엄격히 t>1 을 버리면 **허리선에서 다트가 통째로 0 으로 계산된다**(실측으로 확인한 결함).
  var GIRTH_T_EPS = 1e-6;
  function dartWidthAtY(rec, y) {
    if (!rec || !rec.apex || !Array.isArray(rec.legs) || !rec.legs.length) return 0;
    var xs = [];
    for (var i = 0; i < rec.legs.length; i++) {
      var leg = rec.legs[i], dy = leg.y - rec.apex.y;
      if (Math.abs(dy) < GIRTH_EPS) return 0;
      var t = (y - rec.apex.y) / dy;
      if (t < -GIRTH_T_EPS || t > 1 + GIRTH_T_EPS) return 0;
      if (t < 0) t = 0; else if (t > 1) t = 1;
      xs.push(rec.apex.x + t * (leg.x - rec.apex.x));
    }
    if (xs.length >= 2) return Math.abs(xs[0] - xs[1]);
    return Math.abs(xs[0] - rec.apex.x);
  }
  function suppressionAtY(proj, piece, y) {
    return dartRecords(proj, piece).reduce(function (t, rec) { return t + dartWidthAtY(rec, y); }, 0);
  }
  function girthAt(proj, y) {
    if (!isNum(y)) return null;
    var fo = outlineWidthAtY(proj, "front", y), bo = outlineWidthAtY(proj, "back", y);
    if (fo === null || bo === null) return null;
    var supp = suppressionAtY(proj, "front", y) + suppressionAtY(proj, "back", y);
    return { outlineCm: round4((fo + bo) * 2), suppressionCm: round4(supp * 2),
      finishedCm: round4(((fo + bo) - supp) * 2) };
  }
  // 공개 계측: 가슴(BL)·허리(WL) 의 외곽/완성 둘레와 **실측 대비 여유**.
  //   실측은 DOM 이 아니라 **완료본에 고정된 baseSource.measurements**(frozen)에서 읽는다.
  function girthMeasure(proj) {
    proj = proj || project(); if (!proj) return null;
    var ms = (proj.baseSource && proj.baseSource.measurements) || null;
    var wy = waistLineY(proj, "front"), by = bustLineY(proj, "front");
    var waist = girthAt(proj, wy), bust = girthAt(proj, by);
    var ease = function (g, body) {
      if (!g || !isNum(body)) return null;
      return round4(g.finishedCm - body);
    };
    return {
      bodyBustCm: (ms && isNum(ms.B)) ? ms.B : null,
      bodyWaistCm: (ms && isNum(ms.W)) ? ms.W : null,
      bustLineY: isNum(by) ? round4(by) : null,
      waistLineY: isNum(wy) ? round4(wy) : null,
      bust: bust, waist: waist,
      bustEaseCm: ease(bust, ms && ms.B), waistEaseCm: ease(waist, ms && ms.W)
    };
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
    hem: "hem", "center-extension": "center", "side-seam-extension": "side-seam",
    // 허리 이음선(designWaistSeam) 이 다트를 닫으며 회전한 조각에 붙이는 새 identity — 회전 전
    // root(t)를 그대로 들고 가는 대신(강체 변환으로 좌표만 옮겨간 stale 선언을 막기 위해) 정직한
    // 새 이름으로 선언한다. root 값은 designWaistSeam.js 가 만든다(이 파일은 역할 매핑만 안다).
    "armhole-splice": "armhole", "side-seam-splice": "side-seam"
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
    // v8 이 아닌 출처(v2~v7·미상)는 현재 seam-ready 형상(수직 기본 옆선 + 옆허리 다트 c 반쪽)을 보장하지 못한다.
    if (sv !== 8) issues.push("legacy-source");
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

  // 옆허리 다트 c(논리 다트 하나 = 앞·뒤 c/2 반쪽 record). 총량은 생산자 선언 groupTotal(네 다리 공통)이 원천이고,
  //   두 반쪽 intake 합이 그 총량과 같아야 한다 — 예산에서는 group 총량을 **한 번만** 쓴다(반쪽을 따로 더하지 않음).
  //   판정 순서는 고정(결정론적 reason). 좌표로 c 를 찾지 않고 선언된 group·id·다리만 본다.
  var SIDE_WAIST_C_GROUP = "side-waist-c";
  var SIDE_WAIST_TOTAL_EPS = 1e-6;   // 계산 허용치(cm) — 봉제 허용오차 아님
  function sideWaistDartOf(darts) {
    var halves = {}, reason = null;
    var set = function (r) { if (!reason) reason = r; };
    if ((darts.shared || []).some(function (d) { return d.group === SIDE_WAIST_C_GROUP; })) set("side-waist-dart-shared");
    ["front", "back"].forEach(function (pc) {
      var rs = (darts[pc] || []).filter(function (d) { return d.group === SIDE_WAIST_C_GROUP; });
      if (rs.length === 0) { set("side-waist-dart-missing"); return; }
      if (rs.length > 1) { set("side-waist-dart-duplicate"); return; }
      var d = rs[0];
      halves[pc] = { id: d.id, intakeCm: d.intakeCm, groupTotalCm: d.groupTotalCm };
      if (!d.locked) set("side-waist-dart-unlocked");
      else if (d.legCount !== 2) set("side-waist-dart-legs");
      else if (!d.complete || d.attachment !== "complete") set("side-waist-dart-attachment");
      else if (typeof d.intakeCm !== "number" || !isFinite(d.intakeCm) || !(d.intakeCm > 0)) set("side-waist-dart-intake");
    });
    var f = halves.front, b = halves.back, total = null;
    if (!reason && f && b) {
      total = f.groupTotalCm;
      var sum = f.intakeCm + b.intakeCm;
      if (typeof total !== "number" || !isFinite(total) || total !== b.groupTotalCm || Math.abs(sum - total) > SIDE_WAIST_TOTAL_EPS) set("side-waist-dart-total");
    }
    return { group: SIDE_WAIST_C_GROUP, front: f || null, back: b || null, totalCm: reason ? null : total, ok: !reason, reason: reason };
  }

  // ── 허리 이음선 Ⓜ: 상·하 조각 분리 상태 ──
  //   geometry.frontPeplum/backPeplum(있을 때만) + geometry.waistSeam(designWaistSeam.split 의 검산 메타).
  //   페플럼은 별개 폐곡선 조각이라 **한 outline 으로 합치지 않고** 따로 검사한다.
  var SEAM_LEN_EPS = 0.01;   // designWaistSeam 의 허리 이음 길이 정합 허용오차와 같다
  function peplumClosed(outline) {
    if (!Array.isArray(outline) || outline.length < 3) return false;
    var pts = outline.map(function (s) { return endpointsOf(s); });
    var used = pts.map(function () { return false; }); used[0] = true;
    var cur = pts[0][1], start = pts[0][0], n = 1;
    var near = function (a, b) { return Math.hypot(a.x - b.x, a.y - b.y) < 1e-3; };
    for (var step = 1; step < pts.length; step++) {
      var hit = -1, flip = false;
      for (var j = 0; j < pts.length; j++) {
        if (used[j]) continue;
        if (near(pts[j][0], cur)) { hit = j; break; }
        if (near(pts[j][1], cur)) { hit = j; flip = true; break; }
      }
      if (hit < 0) return false;
      used[hit] = true; n++; cur = flip ? pts[hit][0] : pts[hit][1];
    }
    return n === pts.length && near(cur, start);
  }
  // Ⓝ(P.27): 페플럼 플레어 검산 — 벌린 분량 합 = 허리 완성길이 × 0.9 − 1 이고 절개마다 균등.
  //   메타(designWaistSeam)는 값을 들고 있을 뿐이고, 여기서 **다시 계산해 대조**한다(메타를 믿지 않는다).
  function flareRow(meta) {
    var fl = meta && meta.peplumFlare;
    if (!fl) return null;
    var joins = meta.joins || [];
    var sum = joins.reduce(function (a, j) { return a + (j.spread ? j.spread.chordCm : NaN); }, 0);
    // Ⓞ: 허리 fairing 이 줄인 만큼(meta.waistFair.shortfallCm)을 되돌려야 "완성 허리"(그린 허리 길이)가 된다.
    var want = fl.ratio * (meta.peplumWaistSeamCm + (meta.waistFair ? meta.waistFair.shortfallCm : 0)) - fl.subtractCm;
    var even = joins.length > 0 && joins.every(function (j) { return j.spread && Math.abs(j.spread.chordCm - want / joins.length) < 1e-9; });
    return { totalCm: round4(sum), expectedCm: round4(want), perCutCm: joins.length ? round4(want / joins.length) : null, cuts: joins.length,
      ok: isFinite(sum) && Math.abs(sum - want) < 1e-6 && even && want > 0 };
  }
  function waistSeamState(proj) {
    var g = proj && proj.working && proj.working.geometry;
    if (!g || !g.frontPeplum || !g.backPeplum) return null;
    var m = g.waistSeam || {}, f = m.front || {}, b = m.back || {};
    var row = function (pep, meta) {
      return { peplumClosed: peplumClosed(pep.outline),
        joins: (meta.joins || []).length,
        upperSeamCm: typeof meta.upperWaistSeamCm === "number" ? round4(meta.upperWaistSeamCm) : null,
        peplumSeamCm: typeof meta.peplumWaistSeamCm === "number" ? round4(meta.peplumWaistSeamCm) : null,
        deltaCm: typeof meta.waistSeamDeltaCm === "number" ? meta.waistSeamDeltaCm : null,
        closedDart: meta.closedDart ? meta.closedDart.dartId : null,
        armholeEaseCm: meta.closedDart ? round4(meta.closedDart.armholeEaseCm) : null,
        fairCm: meta.waistFair ? meta.waistFair.shortfallCm : 0,
        flare: flareRow(meta) };
    };
    var F = row(g.frontPeplum, f), B = row(g.backPeplum, b);
    var seamOk = function (r) { return r.deltaCm !== null && Math.abs(r.deltaCm - r.fairCm) <= SEAM_LEN_EPS; };
    var flareOk = function (r) { return r.flare === null || r.flare.ok; };
    var flareBad = !(flareOk(F) && flareOk(B));
    return { front: F, back: B, ok: F.peplumClosed && B.peplumClosed && seamOk(F) && seamOk(B) && !flareBad,
      reason: !(F.peplumClosed && B.peplumClosed) ? "waist-seam-peplum-open" : (!(seamOk(F) && seamOk(B)) ? "waist-seam-mismatch" : (flareBad ? "waist-seam-flare-mismatch" : null)) };
  }
  function peplumCanon(proj) {
    var g = proj && proj.working && proj.working.geometry;
    if (!g || !g.frontPeplum || !g.backPeplum) return null;
    return { f: canonOutline(g.frontPeplum.outline), b: canonOutline(g.backPeplum.outline) };
  }


  // ── 요크 이음선 Ⓠ: 요크·몸판 네 조각 상태 ──
  //   geometry.frontYoke/frontBody/backYoke/backBody(있을 때만). **geometry.yokeSeam 메타는 신뢰하지 않는다** —
  //   폐곡선·연속성·자기교차·이음 길이·면적을 출력 geometry 에서 **전부 다시 계산**한다(메타는 보존·표시용).
  //   전체 몸판(front/back)은 그대로이므로 면적 보존은 «요크+몸판 = 전체 몸판 링(열린 다트 다리로 닫은 것)» 이다.
  var YOKE_SEAM_LEN_EPS = 1e-4;    // 상·하 이음 길이 정합(cm) — 강체 회전이라 실제 오차는 ≈1e-13
  var YOKE_AREA_EPS = 0.05;        // 면적 보존(cm²) — designYokeSeam 의 AREA_TOL 과 같다
  var YOKE_HORIZ_EPS = 1e-3;       // 이음선 수평 허용(cm)
  var YOKE_WHOLE_EPS = 0.02;       // 전체 몸판 링(원본 외곽 + 다트 다리) 접합 허용
  var YOKE_CHAIN_EPS = 1e-4;       // 연속성(designYokeSeam CLOSE_EPS 와 같다)
  var YOKE_DART = { front: "front-bust", back: "back-shoulder" };
  // Ⓡ(P.31) 개더 띠 분량 — designYokeSeam 의 확정식을 **여기서 독립 재계산**한다(메타를 신뢰하지 않는다):
  //   뒤 ⌀ = 10cm 고정 · 앞 ⊠ = 앞중심→AH 다트 끝 이음선상 수평거리 − 1cm.
  var YOKE_GATHER_BACK_CM = 10;
  var YOKE_GATHER_FRONT_TRIM_CM = 1;
  var YOKE_GATHER_EPS = 1e-4;   // 이음선이 흡수하는 다트(designYokeSeam.ABSORB)
  function yokeFlatSeg(s) {
    if (s.kind !== "cubic") return [[s.from, s.to]];
    var out = [], N = 24, prev = s.from;
    for (var k = 1; k <= N; k++) {
      var t = k / N, u = 1 - t;
      var q = { x: u * u * u * s.from.x + 3 * u * u * t * s.c1.x + 3 * u * t * t * s.c2.x + t * t * t * s.to.x,
                y: u * u * u * s.from.y + 3 * u * u * t * s.c1.y + 3 * u * t * t * s.c2.y + t * t * t * s.to.y };
      out.push([prev, q]); prev = q;
    }
    return out;
  }
  // 무순서 세그먼트 → 이어진 폐곡선 체인(방향 정규화). 안 닫히거나 끊기면 null.
  function yokeOrderRing(segs, eps) {
    if (!segs.length) return null;
    eps = eps == null ? YOKE_CHAIN_EPS : eps;
    var used = segs.map(function () { return false; }); used[0] = true;
    var out = [segs[0]], tip = segs[0].to, near = function (a, b) { return Math.hypot(a.x - b.x, a.y - b.y) <= eps; };
    for (var step = 1; step < segs.length; step++) {
      var hit = -1, rev = false;
      for (var j = 0; j < segs.length; j++) {
        if (used[j]) continue;
        if (near(segs[j].from, tip)) { hit = j; break; }
        if (near(segs[j].to, tip)) { hit = j; rev = true; break; }
      }
      if (hit < 0) return null;
      used[hit] = true;
      var sg = segs[hit];
      if (rev) sg = sg.kind === "cubic" ? { kind: "cubic", from: sg.to, c1: sg.c2, c2: sg.c1, to: sg.from } : { kind: "line", from: sg.to, to: sg.from };
      out.push(sg); tip = sg.to;
    }
    return near(tip, out[0].from) ? out : null;
  }
  function yokeRingMetrics(ring) {
    var flat = []; ring.forEach(function (s) { yokeFlatSeg(s).forEach(function (ab) { flat.push(ab); }); });
    var a = 0; flat.forEach(function (ab) { a += ab[0].x * ab[1].y - ab[1].x * ab[0].y; });
    var o = function (p, q, r) { return (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x); };
    var same = function (p, q) { return Math.hypot(p.x - q.x, p.y - q.y) < 1e-6; };
    var cross = false;
    for (var i = 0; i < flat.length && !cross; i++) for (var j = i + 1; j < flat.length; j++) {
      var A = flat[i][0], B = flat[i][1], C = flat[j][0], D = flat[j][1];
      if (same(A, C) || same(A, D) || same(B, C) || same(B, D)) continue;
      if (o(A, B, C) * o(A, B, D) < 0 && o(C, D, A) * o(C, D, B) < 0) { cross = true; break; }
    }
    return { areaCm2: Math.abs(a / 2), selfIntersects: cross };
  }
  // ── 요크 이음선 Ⓢ(P.32) 한 면 — 출력 geometry 에서 **독립 재계산**한다(메타는 선언 확인용일 뿐 신뢰하지 않는다) ──
  //   BL = 전체 몸판 옆선 변의 위 끝 y(`bustLineY`). 뒤 이음선 = BL+5 수평선 · 앞 이음선 = CF→BP(BL 높이)→옆선 BL+5 사선.
  //   앞 AH 다트는 어느 조각에도 없어야 하고, 뒤 어깨 다트는 **요크에 열린 다리 두 줄로 원본 그대로** 남아야 한다.
  //   개더 폭 W = 이음선 전체 길이(요크 쪽) × 0.5 → 몸판 이음 길이 − 요크 이음 길이 = W.
  var YOKE_S_DROP_CM = 5;
  var YOKE_S_RATIO = 0.5;
  var YOKE_S_POS_EPS = 1e-3;
  function yokeRowS(r, side, Y, B, whole, m, proj) {
    var dartId = YOKE_DART[side];
    var legsOf = function (pc) {
      return (pc.construction || []).filter(function (s) { return s && s.kind === "line" && s.dart && s.dart.id === dartId; })
        .map(function (s) { return { kind: "line", from: cp(s.from), to: cp(s.to), apexAt: s.dart.apexAt }; });
    };
    var back = side === "back";
    var yLegs = legsOf(Y), wLegs = legsOf(whole);
    var ry = yokeOrderRing(ringSegs(Y.outline).concat(back ? yLegs.map(function (l) { return { kind: "line", from: l.from, to: l.to }; }) : []), back ? YOKE_WHOLE_EPS : undefined);
    var rb = yokeOrderRing(ringSegs(B.outline));
    r.closed = { yoke: !!ry, body: !!rb };
    if (!ry || !rb) { r.reason = "yoke-seam-open"; return r; }
    var my = yokeRingMetrics(ry), mb = yokeRingMetrics(rb);
    r.areaYokeCm2 = round4(my.areaCm2); r.areaBodyCm2 = round4(mb.areaCm2);
    r.selfIntersects = my.selfIntersects || mb.selfIntersects;
    if (r.selfIntersects || !(my.areaCm2 > 0) || !(mb.areaCm2 > 0)) { r.reason = "yoke-seam-self-intersection"; return r; }
    // 다트: 앞 = 어느 조각에도 없다(흡수) / 뒤 = 요크에 원본 다리 두 줄 그대로, 몸판에는 없다(열린 봉제 다트 보존)
    var hasDart = function (pc) { return pc.outline.concat(pc.construction || []).some(function (s) { return s && s.dart && s.dart.id === dartId; }); };
    var sameLeg = function (a, b) { return Math.hypot(a.from.x - b.from.x, a.from.y - b.from.y) < 1e-6 && Math.hypot(a.to.x - b.to.x, a.to.y - b.to.y) < 1e-6; };
    if (!back) { if (hasDart(Y) || hasDart(B)) { r.reason = "yoke-seam-dart-open"; return r; } }
    else {
      var kept = yLegs.length === 2 && wLegs.length === 2 && yLegs.every(function (l, i) { return sameLeg(l, wLegs[i]); });
      var inOutline = Y.outline.some(function (s) { return s && s.dart && s.dart.id === dartId; });
      if (!kept || inOutline || hasDart(B)) { r.reason = "yoke-seam-dart-not-preserved"; return r; }
    }
    r.preservedDartIds = back ? [dartId] : [];
    // 이음선 좌표: BL(전체 몸판 옆선 위 끝)에서 독립 계산
    var BLy = bustLineY(proj, side), Ys = BLy + YOKE_S_DROP_CM;
    r.bustLineY = round4(BLy); r.seamYCm = round4(Ys);
    var seamOf = function (pc) { return pc.outline.filter(function (s) { return s && s.edge === "yoke-seam"; }); };
    var sy = seamOf(Y), sb = seamOf(B), wantN = back ? 1 : 2;
    if (sy.length !== wantN || sb.length !== wantN || !sy.concat(sb).every(function (s) { return s.kind === "line"; })) { r.reason = "yoke-seam-missing"; return r; }
    var wc = ringSegs(whole.outline.filter(function (s) { return s && s.edge === "center"; }));
    var cxWhole = wc.length ? wc[0].from.x : null;
    var wSide = ringSegs(whole.outline.filter(function (s) { return s && s.edge === "side-seam"; }));
    if (cxWhole == null || !wSide.length) { r.reason = "yoke-seam-missing"; return r; }
    var onSide = function (p) {   // 점이 전체 몸판 옆선(직선 변) 위에 있다
      return wSide.some(function (sg) {
        if (sg.kind !== "line") return false;
        var dx = sg.to.x - sg.from.x, dy = sg.to.y - sg.from.y, L2 = dx * dx + dy * dy; if (!(L2 > 0)) return false;
        var t = ((p.x - sg.from.x) * dx + (p.y - sg.from.y) * dy) / L2; if (t < -1e-9 || t > 1 + 1e-9) return false;
        return Math.hypot(sg.from.x + dx * t - p.x, sg.from.y + dy * t - p.y) <= YOKE_S_POS_EPS;
      });
    };
    var ly = sy.reduce(function (t, sg) { return t + segLen(sg); }, 0), lb = sb.reduce(function (t, sg) { return t + segLen(sg); }, 0);
    var W = YOKE_S_RATIO * ly;
    var Ycf;   // 중심 쪽 이음선 높이
    if (back) {
      Ycf = Ys;
      var flat = sb[0].from.y, ok1 = [sb[0].from, sb[0].to, sy[0].from, sy[0].to].every(function (p) { return Math.abs(p.y - Ys) <= YOKE_S_POS_EPS; });
      var sideEnd = function (sg) { return onSide(sg.from) ? sg.from : (onSide(sg.to) ? sg.to : null); };
      var cenEnd = function (sg) { return onSide(sg.from) ? sg.to : sg.from; };
      var seY = sideEnd(sy[0]), seB = sideEnd(sb[0]);
      if (!ok1 || !seY || !seB || Math.abs(cenEnd(sy[0]).x - cxWhole) > YOKE_S_POS_EPS || Math.abs(Math.abs(cenEnd(sb[0]).x - cxWhole) - W) > YOKE_GATHER_EPS) { r.reason = "yoke-seam-position-mismatch"; return r; }
    } else {
      Ycf = BLy;
      var wl = wLegs[0], apex = wl ? (wl.apexAt === "to" ? wl.to : wl.from) : null;
      if (!apex || Math.abs(apex.y - BLy) > YOKE_S_POS_EPS) { r.reason = "yoke-seam-position-mismatch"; return r; }
      var parts = function (pc) {   // 앞 이음선 두 줄 → { hor: 중심 쪽 끝점, slant: 옆 쪽 끝점 } (apex 를 공유해야 한다)
        var o = null;
        [[0, 1], [1, 0]].some(function (ij) {
          var a = pc[ij[0]], b = pc[ij[1]];
          [[a.from, a.to], [a.to, a.from]].some(function (pq) {
            if (Math.hypot(pq[0].x - apex.x, pq[0].y - apex.y) > YOKE_S_POS_EPS) return false;
            [[b.from, b.to], [b.to, b.from]].some(function (uv) {
              if (Math.hypot(uv[0].x - apex.x, uv[0].y - apex.y) > YOKE_S_POS_EPS) return false;
              if (Math.abs(pq[1].y - BLy) <= YOKE_S_POS_EPS) o = { hor: pq[1], slant: uv[1] };
              return !!o;
            });
            return !!o;
          });
          return !!o;
        });
        return o;
      };
      var py = parts(sy), pb = parts(sb);
      if (!py || !pb || Math.abs(py.hor.x - cxWhole) > YOKE_S_POS_EPS || Math.abs(Math.abs(pb.hor.x - cxWhole) - W) > YOKE_GATHER_EPS ||
          Math.abs(pb.slant.y - Ys) > YOKE_S_POS_EPS || !onSide(pb.slant) ||
          Math.abs(Math.hypot(py.slant.x - apex.x, py.slant.y - apex.y) - Math.hypot(pb.slant.x - apex.x, pb.slant.y - apex.y)) > YOKE_SEAM_LEN_EPS) { r.reason = "yoke-seam-position-mismatch"; return r; }
    }
    r.seamLenYokeCm = round4(ly); r.seamLenBodyCm = round4(lb); r.deltaCm = ly - lb;
    r.gatherCm = round4(W); r.gatherDeltaCm = lb - ly;
    r.gatherDeclaredCm = (m.gather && typeof m.gather.addedCm === "number") ? round4(m.gather.addedCm) : null;
    if (!m.gather || typeof m.gather.addedCm !== "number" || !(W > 0) || !(Math.abs(lb - ly - W) <= YOKE_GATHER_EPS) || !(Math.abs(m.gather.addedCm - W) <= YOKE_GATHER_EPS)) { r.reason = "yoke-gather-mismatch"; return r; }
    // 면적 = 전체 몸판 링(외곽 + 열린 다트 다리) + 띠(W × 중심 쪽 이음선~밑단)
    var allLegs = wLegs.map(function (l) { return { kind: "line", from: l.from, to: l.to }; });
    var rw = yokeOrderRing(ringSegs(whole.outline).concat(allLegs), YOKE_WHOLE_EPS);
    if (!rw) { r.reason = "yoke-seam-missing"; return r; }
    var aw = yokeRingMetrics(rw).areaCm2;
    var ysC = []; ringSegs(B.outline.filter(function (sg) { return sg && sg.edge === "center"; })).forEach(function (sg) { ysC.push(sg.from.y, sg.to.y); });
    var extra = W * (ysC.length ? Math.max.apply(null, ysC) - Ycf : NaN);
    r.areaWholeCm2 = round4(aw); r.areaDeltaCm2 = round4(my.areaCm2 + mb.areaCm2 - aw); r.gatherAreaCm2 = round4(extra);
    if (!(Math.abs(my.areaCm2 + mb.areaCm2 - aw - extra) <= YOKE_AREA_EPS)) { r.reason = "yoke-seam-area-mismatch"; return r; }
    return r;
  }
  // ── 요크 이음선 Ⓣ(P.33) 한 면 — Ⓢ 의 요크·이음선·다트 규칙 + 몸판 절개 벌림을 출력 geometry 에서 **독립 재계산**한다 ──
  //   요크 쪽(다트 처리·이음선 위치)은 Ⓢ 와 같다. 몸판은 개더 띠가 없고, ① 이음선 총길이가 요크와 같아야 하며(강체 회전)
  //   ② 밑단 이음 호(edge:"hem" 곡선)의 현 합 = ∅ = 그 면 **BL 수평폭**(전체 몸판 옆선 위 끝~중심) × 0.5 − 2.5 · 호 수 = 절개 수 2 ·
  //   ③ 밑단 옆 +2.5 · ④ (요크+몸판) − 전체 몸판 면적 = 벌림 쐐기 면적(메타 합과 일치).
  var YOKE_T_RATIO = 0.5, YOKE_T_SUBTRACT_CM = 2.5, YOKE_T_CUTS = 2, YOKE_T_HEM_SIDE_CM = 2.5, YOKE_T_FLARE_EPS = 1e-3, YOKE_T_SEAM_TURN_EPS = 1e-3;
  function yokeRowT(r, side, Y, B, whole, m, proj) {
    var dartId = YOKE_DART[side], back = side === "back";
    var legsOf = function (pc) {
      return (pc.construction || []).filter(function (s) { return s && s.kind === "line" && s.dart && s.dart.id === dartId; })
        .map(function (s) { return { kind: "line", from: cp(s.from), to: cp(s.to), apexAt: s.dart.apexAt }; });
    };
    var yLegs = legsOf(Y), wLegs = legsOf(whole);
    var ry = yokeOrderRing(ringSegs(Y.outline).concat(back ? yLegs.map(function (l) { return { kind: "line", from: l.from, to: l.to }; }) : []), back ? YOKE_WHOLE_EPS : undefined);
    var rb = yokeOrderRing(ringSegs(B.outline));
    r.closed = { yoke: !!ry, body: !!rb };
    if (!ry || !rb) { r.reason = "yoke-seam-open"; return r; }
    var my = yokeRingMetrics(ry), mb = yokeRingMetrics(rb);
    r.areaYokeCm2 = round4(my.areaCm2); r.areaBodyCm2 = round4(mb.areaCm2);
    r.selfIntersects = my.selfIntersects || mb.selfIntersects;
    if (r.selfIntersects || !(my.areaCm2 > 0) || !(mb.areaCm2 > 0)) { r.reason = "yoke-seam-self-intersection"; return r; }
    var hasDart = function (pc) { return pc.outline.concat(pc.construction || []).some(function (s) { return s && s.dart && s.dart.id === dartId; }); };
    var sameLeg = function (a, b) { return Math.hypot(a.from.x - b.from.x, a.from.y - b.from.y) < 1e-6 && Math.hypot(a.to.x - b.to.x, a.to.y - b.to.y) < 1e-6; };
    if (!back) { if (hasDart(Y) || hasDart(B)) { r.reason = "yoke-seam-dart-open"; return r; } }
    else {
      var kept = yLegs.length === 2 && wLegs.length === 2 && yLegs.every(function (l, i) { return sameLeg(l, wLegs[i]); });
      var inOutline = Y.outline.some(function (s) { return s && s.dart && s.dart.id === dartId; });
      if (!kept || inOutline || hasDart(B)) { r.reason = "yoke-seam-dart-not-preserved"; return r; }
    }
    r.preservedDartIds = back ? [dartId] : [];
    var BLy = bustLineY(proj, side), Ys = BLy + YOKE_S_DROP_CM;
    r.bustLineY = round4(BLy); r.seamYCm = round4(Ys);
    var seamOf = function (pc) { return pc.outline.filter(function (s) { return s && s.edge === "yoke-seam"; }); };
    var sy = seamOf(Y), wantY = back ? 1 : 2;
    // 몸판 이음선은 truing 으로 직선 + 모서리 cubic(path) 이 섞인다 — 끝점·길이는 ringSegs(line/cubic 정규화)로 읽는다
    var sbRaw = seamOf(B), sb = ringSegs(sbRaw);
    if (sy.length !== wantY || !sbRaw.length || !sy.every(function (s) { return s.kind === "line"; }) || sb.length < sbRaw.length) { r.reason = "yoke-seam-missing"; return r; }
    var wc = ringSegs(whole.outline.filter(function (s) { return s && s.edge === "center"; }));
    var cxWhole = wc.length ? wc[0].from.x : null;
    var wSide = whole.outline.filter(function (s) { return s && s.edge === "side-seam"; });
    if (cxWhole == null || !wSide.length) { r.reason = "yoke-seam-missing"; return r; }
    var Ycf = back ? Ys : BLy;
    var atCf = function (p, y) { return Math.abs(p.x - cxWhole) <= YOKE_S_POS_EPS && Math.abs(p.y - y) <= YOKE_S_POS_EPS; };
    if (back) {
      if (![sy[0].from, sy[0].to].every(function (p) { return Math.abs(p.y - Ys) <= YOKE_S_POS_EPS; }) || !(atCf(sy[0].from, Ys) || atCf(sy[0].to, Ys))) { r.reason = "yoke-seam-position-mismatch"; return r; }
    } else {
      var wl = wLegs[0], apex = wl ? (wl.apexAt === "to" ? wl.to : wl.from) : null;
      var onApex = function (p) { return Math.hypot(p.x - apex.x, p.y - apex.y) <= YOKE_S_POS_EPS; };
      var horiz = apex ? sy.filter(function (sg) { return Math.abs(sg.from.y - BLy) <= YOKE_S_POS_EPS && Math.abs(sg.to.y - BLy) <= YOKE_S_POS_EPS; }) : [];
      if (!apex || Math.abs(apex.y - BLy) > YOKE_S_POS_EPS || horiz.length !== 1 || !(atCf(horiz[0].from, BLy) || atCf(horiz[0].to, BLy)) || !(onApex(horiz[0].from) || onApex(horiz[0].to))) { r.reason = "yoke-seam-position-mismatch"; return r; }
    }
    // 몸판 이음선: 중심 쪽 끝이 CF 의 이음선 높이에 있고(중심 조각은 고정), 총길이 = 요크 이음선 길이(절개 벌림은 강체 회전이라 보존)
    var ly = sy.reduce(function (t, sg) { return t + segLen(sg); }, 0), lb = sb.reduce(function (t, sg) { return t + segLen(sg); }, 0);
    if (!sb.some(function (sg) { return atCf(sg.from, Ycf) || atCf(sg.to, Ycf); })) { r.reason = "yoke-seam-position-mismatch"; return r; }
    r.seamLenYokeCm = round4(ly); r.seamLenBodyCm = round4(lb); r.deltaCm = ly - lb;
    if (!(Math.abs(ly - lb) <= YOKE_SEAM_LEN_EPS)) { r.reason = "yoke-seam-length-mismatch"; return r; }
    // 이음선 truing: 몸판 이음선의 이웃 선분 사이에 각진 모서리(절개 교점의 꺾임)가 남아 있으면 안 된다(접선 연속)
    var leave = function (sg, atStart) {   // 끝점에서 선분 안쪽으로 나가는 접선 방향
      var a = atStart ? sg.from : sg.to, b = atStart ? (sg.kind === "cubic" ? sg.c1 : sg.to) : (sg.kind === "cubic" ? sg.c2 : sg.from);
      return { x: b.x - a.x, y: b.y - a.y };
    };
    var maxTurn = 0;
    for (var qi = 0; qi < sb.length; qi++) for (var qj = qi + 1; qj < sb.length; qj++) {
      [[true, true], [true, false], [false, true], [false, false]].forEach(function (c) {
        var pa = c[0] ? sb[qi].from : sb[qi].to, pb = c[1] ? sb[qj].from : sb[qj].to;
        if (Math.hypot(pa.x - pb.x, pa.y - pb.y) > YOKE_CHAIN_EPS) return;
        var ua = leave(sb[qi], c[0]), ub = leave(sb[qj], c[1]);
        var tn = Math.abs(Math.atan2(-ua.x * ub.y + ua.y * ub.x, -ua.x * ub.x - ua.y * ub.y));   // (−ua) 와 ub 사이 각 = 통과 시 꺾임
        if (tn > maxTurn) maxTurn = tn;
      });
    }
    r.seamMaxTurnDeg = round4(maxTurn * 180 / Math.PI);
    if (!(maxTurn <= YOKE_T_SEAM_TURN_EPS)) { r.reason = "yoke-seam-kink"; return r; }
    // 플레어: ∅ = BL 수평폭 × 0.5 − 2.5 (BL = 전체 몸판 옆선 위 끝) · 밑단 이음 호의 현 합과 일치, 호 수 = 절개 수
    var top = null, bot = null;
    wSide.forEach(function (sg) { [sg.from, sg.to].forEach(function (p) { if (!top || p.y < top.y) top = p; if (!bot || p.y > bot.y) bot = p; }); });
    var BLw = Math.abs(top.x - cxWhole), want = YOKE_T_RATIO * BLw - YOKE_T_SUBTRACT_CM;
    var hemExtra = (top.x >= cxWhole ? 1 : -1) * (bot.x - top.x);
    var arcs = B.outline.filter(function (sg) { return sg && sg.edge === "hem" && sg.kind === "path" && Array.isArray(sg.commands); });
    var chords = arcs.map(function (sg) { var a = sg.commands[0].points[0], cc = sg.commands[sg.commands.length - 1], b = cc.points[cc.points.length - 1]; return Math.hypot(b.x - a.x, b.y - a.y); });
    var sum = chords.reduce(function (t, c) { return t + c; }, 0);
    r.bustWidthCm = round4(BLw); r.flareWantCm = round4(want); r.flareCm = round4(sum); r.flareCuts = arcs.length; r.hemSideExtraCm = round4(hemExtra);
    r.flareDeclaredCm = (m.flare && typeof m.flare.totalCm === "number") ? round4(m.flare.totalCm) : null;
    if (!(want > 0) || arcs.length !== YOKE_T_CUTS || !(Math.abs(sum - want) <= YOKE_T_FLARE_EPS) || !chords.every(function (c) { return Math.abs(c - want / YOKE_T_CUTS) <= YOKE_T_FLARE_EPS; }) ||
        !m.flare || typeof m.flare.totalCm !== "number" || !(Math.abs(m.flare.totalCm - want) <= YOKE_T_FLARE_EPS)) { r.reason = "yoke-flare-mismatch"; return r; }
    if (!(Math.abs(hemExtra - YOKE_T_HEM_SIDE_CM) <= 1e-6)) { r.reason = "yoke-hem-side-mismatch"; return r; }
    // 면적: (요크 + 몸판) − 전체 몸판 링 = 벌림 쐐기 + 밑단 이음 호 면적(메타 합과 일치, 양수)
    var rw = yokeOrderRing(ringSegs(whole.outline).concat(wLegs.map(function (l) { return { kind: "line", from: l.from, to: l.to }; })), YOKE_WHOLE_EPS);
    if (!rw) { r.reason = "yoke-seam-missing"; return r; }
    var aw = yokeRingMetrics(rw).areaCm2, delta = my.areaCm2 + mb.areaCm2 - aw;
    var declared = (m.flare.cuts || []).reduce(function (t, c) { return t + (typeof c.areaDeltaCm2 === "number" ? c.areaDeltaCm2 : NaN); }, 0);
    var fairArea = typeof m.flare.seamFairingAreaCm2 === "number" ? m.flare.seamFairingAreaCm2 : NaN;   // 이음선 truing 이 깎거나 보탠 면적(작아야 한다)
    r.areaWholeCm2 = round4(aw); r.areaDeltaCm2 = round4(delta);
    if (!(delta > 0) || !(Math.abs(fairArea) <= 1) || !(Math.abs(delta - declared - fairArea) <= YOKE_AREA_EPS)) { r.reason = "yoke-seam-area-mismatch"; return r; }
    return r;
  }
  // ── 요크 이음선 Ⓤ(P.34): 어깨 요크 한 장 + 앞·뒤 몸판 — 출력 geometry 에서 **전부 독립 재계산**(메타는 선언 확인용) ──
  //   불변식 ① 뒤 어깨 다트를 먼저 닫는다(어느 조각에도 다트 id 가 없고, 어깨 요크 안의 뒤 어깨 구성선이 원본 뒤 어깨와 길이가 맞는다)
  //   ② 앞·뒤 요크는 어깨선에서 맞대어 한 장(요크 외곽에 `shoulder` 변이 없고, 앞·뒤 어깨 구성선 두 줄이 목점에서 정확히 만난다)
  //   ③ 앞·뒤 몸판은 별도 조각. 이음선·개더 봉제 대응: 뒤 = 몸판 이음 − 요크 이음 = 띠 폭 W = (요크 이음 − 2)×0.5 /
  //   앞 = 몸판 이음 − 요크 이음 = 쐐기 현 g(두 절개선 끝 사이) · 앞 이음선은 어깨선과 평행·6cm · 쐐기 각 = 원본 AH 다트 각 · 절개 끝 = 이음선 호길이 1/2점(BP 연직 투영 아님, 김님 확정).
  var YOKE_U_OFFSET_CM = 6, YOKE_U_TRIM_CM = 2, YOKE_U_RATIO = 0.5;
  //   Ⓥ(P.35) = Ⓤ 위에 개더만 키운 변형: 뒤 띠 = (요크 이음 − 2) × 1 · 앞 총 개더(몸판 이음 − 요크 이음) = 1.2 × (요크 이음 − 4) — 쐐기(Ⓤ 그대로) + BP→밑단 수직 절개를 앞중심 쪽 조각이
  //   수평으로 d 만큼 평행 이동한 몫. 아래 yokeStateU 가 variant 로 갈린다(어깨 요크·어깨 맞댐·뒤 규칙은 공용).
  var YOKE_V_BACK_RATIO = 1, YOKE_V_FRONT_RATIO = 1.2, YOKE_V_LEN_EPS = 2e-3;   // 길이 허용 — 체크포인트 24분할 cubic 길이와 생성기 평탄화의 차(fairing cubic)
  var YOKE_U_GEO_EPS = 1e-4;       // 평행·거리·1/2점 허용(cm)
  var YOKE_U_SHOULDER_STEP_EPS = 0.2;   // 앞·뒤 어깨끝 단차 상한(cm) — 뒤 다트 다리 길이 차 허용(designYokeSeam LEG_TOL)과 같다
  var YOKE_U_GAP_MAX_CM2 = 8;
  var YOKE_U_AREA_EPS = 0.1;       // 어깨 단차 삼각 + 곡선 평탄화 차이(designLineTool 평탄화와 24분할의 차) — Ⓠ~Ⓣ 의 0.05 보다 조금 넉넉하다
  var YOKE_U_ANGLE_EPS_DEG = 1e-3;
  function edgeRuns(prims, edge) {
    var items = prims.filter(function (s) { return s && s.edge === edge; });
    var ends = function (s) { var e = endpointsOf(s); return [e[0], e[e.length - 1]]; };
    var runs = [], used = items.map(function () { return false; });
    for (var i = 0; i < items.length; i++) {
      if (used[i]) continue;
      var grp = [items[i]]; used[i] = true;
      for (var grew = true; grew;) {
        grew = false;
        for (var j = 0; j < items.length; j++) {
          if (used[j]) continue;
          var ej = ends(items[j]);
          if (grp.some(function (g) { var eg = ends(g); return near(eg[0], ej[0]) || near(eg[0], ej[1]) || near(eg[1], ej[0]) || near(eg[1], ej[1]); })) { grp.push(items[j]); used[j] = true; grew = true; }
        }
      }
      runs.push(grp);
    }
    return runs;
  }
  function near(a, b) { return Math.hypot(a.x - b.x, a.y - b.y) <= 1e-6; }
  var sumLen = function (segs) { return segs.reduce(function (t, s) { return t + segLen(s); }, 0); };
  function shoelace(pts) { var a = 0; for (var i = 0; i < pts.length; i++) { var p = pts[i], q = pts[(i + 1) % pts.length]; a += p.x * q.y - q.x * p.y; } return a / 2; }
  function yokeStateU(proj, g) {
    var Y = g.shoulderYoke, FB = g.frontBody, BB = g.backBody, wF = g.front, wB = g.back, m = g.yokeSeam || {};
    var out = { variant: "U", front: { side: "front", reason: null }, back: { side: "back", reason: null }, shoulderYoke: { closed: false, selfIntersects: null, reason: null }, ok: false, reason: null };
    var bad = function (reason) { out.reason = reason; return out; };
    var okPiece = function (pc) { return pc && Array.isArray(pc.outline) && pc.outline.length >= 3; };
    var pbody = proj.working.parameters && proj.working.parameters.body;
    if (pbody && pbody.yokeSeam != null && pbody.yokeSeam !== "U" && pbody.yokeSeam !== "V") return bad("yoke-seam-variant-mismatch");
    var vSel = (pbody && pbody.yokeSeam != null) ? pbody.yokeSeam : (m.variant === "V" ? "V" : "U"), isV = (vSel === "V");
    if (m.variant != null && m.variant !== vSel) return bad("yoke-seam-variant-mismatch");   // 파라미터가 말하는 규칙이 우선 — 메타가 다른 규칙을 고르지 못한다
    out.variant = vSel;
    if (!okPiece(Y) || !okPiece(FB) || !okPiece(BB) || !okPiece(wF) || !okPiece(wB) || !m.front || !m.back || g.frontYoke || g.backYoke) return bad("yoke-seam-missing");
    var ry = yokeOrderRing(ringSegs(Y.outline)), rf = yokeOrderRing(ringSegs(FB.outline)), rb = yokeOrderRing(ringSegs(BB.outline));
    out.shoulderYoke.closed = !!ry; out.front.closed = !!rf; out.back.closed = !!rb;
    if (!ry || !rf || !rb) return bad("yoke-seam-open");
    var my = yokeRingMetrics(ry), mf = yokeRingMetrics(rf), mb = yokeRingMetrics(rb);
    out.shoulderYoke.selfIntersects = my.selfIntersects; out.front.selfIntersects = mf.selfIntersects; out.back.selfIntersects = mb.selfIntersects;
    out.shoulderYoke.areaCm2 = round4(my.areaCm2); out.front.areaBodyCm2 = round4(mf.areaCm2); out.back.areaBodyCm2 = round4(mb.areaCm2);
    if (my.selfIntersects || mf.selfIntersects || mb.selfIntersects || !(my.areaCm2 > 0) || !(mf.areaCm2 > 0) || !(mb.areaCm2 > 0)) return bad("yoke-seam-self-intersection");

    // ① 다트는 어느 조각에도 남지 않는다(앞 AH = 몸판에서 닫음 · 뒤 어깨 = 맞대기 전에 닫음)
    var hasDart = function (pc, id) { return pc.outline.concat(pc.construction || []).some(function (s) { return s && s.dart && s.dart.id === id; }); };
    if ([Y, FB, BB].some(function (pc) { return hasDart(pc, YOKE_DART.front) || hasDart(pc, YOKE_DART.back); })) return bad("yoke-seam-dart-open");
    // ② 어깨 맞댐: 요크 외곽에 어깨 변이 없다 · 앞·뒤 어깨 구성선이 목점에서 만나고 어깨끝 단차가 작다
    if (Y.outline.some(function (s) { return s && s.edge === "shoulder"; })) return bad("yoke-seam-shoulder-open");
    var chain = function (tag) { return (Y.construction || []).filter(function (s) { return s && s.shoulderJoin === tag && s.kind === "line"; }); };
    var cb = chain("back"), cf = chain("front");
    if (!cb.length || cf.length !== 1) return bad("yoke-seam-shoulder-missing");
    var neckB = cb[0].from, tipB = cb[cb.length - 1].to, neckF = cf[0].from, tipF = cf[0].to;
    for (var ci = 0; ci + 1 < cb.length; ci++) if (!near(cb[ci].to, cb[ci + 1].from) && Math.hypot(cb[ci].to.x - cb[ci + 1].from.x, cb[ci].to.y - cb[ci + 1].from.y) > YOKE_U_SHOULDER_STEP_EPS) return bad("yoke-seam-shoulder-missing");
    if (!near(neckB, neckF)) return bad("yoke-seam-shoulder-neck-gap");
    var stepCm = dist(tipB, tipF);
    out.shoulderYoke.tipStepCm = round4(stepCm);
    if (!(stepCm <= YOKE_U_SHOULDER_STEP_EPS)) return bad("yoke-seam-shoulder-tip-gap");
    // 뒤 어깨 구성선 길이 = 원본 뒤 어깨(두 줄) 길이 ± 닫은 다트 다리 차 — 다트를 닫은 뒤에 맞댔다는 증거
    var wBSh = wB.outline.filter(function (s) { return s && s.edge === "shoulder"; });
    var wBShLen = sumLen(wBSh), cbLen = sumLen(cb);
    out.back.shoulderLenCm = round4(cbLen);
    if (!(Math.abs(cbLen - wBShLen) <= YOKE_U_SHOULDER_STEP_EPS)) return bad("yoke-seam-back-shoulder-mismatch");
    var wFSh = wF.outline.filter(function (s) { return s && s.edge === "shoulder"; });
    if (wFSh.length !== 1 || !(Math.abs(segLen(cf[0]) - segLen(wFSh[0])) <= 1e-6)) return bad("yoke-seam-front-shoulder-mismatch");
    // 어깨 틈(렌즈) 면적 = 앞·뒤 어깨 구성선과 어깨끝 단차가 둘러싼 면적
    var lensPts = [neckB]; cb.forEach(function (s) { lensPts.push(s.to); }); lensPts.push(tipF);
    var lensCm2 = Math.abs(shoelace(lensPts));
    out.shoulderYoke.gapAreaCm2 = round4(lensCm2);
    if (!(lensCm2 <= YOKE_U_GAP_MAX_CM2)) return bad("yoke-seam-shoulder-gap-large");

    // ③ 이음선·개더 봉제 대응
    var runsY = edgeRuns(Y.outline, "yoke-seam");
    var touchesCenter = function (run) { var cs = Y.outline.filter(function (s) { return s && s.edge === "center"; }); return cs.some(function (c) { var ec = endpointsOf(c); return run.some(function (r) { var er = endpointsOf(r); return [ec[0], ec[ec.length - 1]].some(function (p) { return near(p, er[0]) || near(p, er[er.length - 1]); }); }); }); };
    var runBack = runsY.filter(touchesCenter), runFront = runsY.filter(function (r) { return !touchesCenter(r); });
    if (runsY.length !== 2 || runBack.length !== 1 || runFront.length !== 1) return bad("yoke-seam-missing");
    var lyB = sumLen(runBack[0]), lyF = sumLen(runFront[0]);
    var seamBodyB = BB.outline.filter(function (s) { return s && s.edge === "yoke-seam"; }), seamBodyF = FB.outline.filter(function (s) { return s && s.edge === "yoke-seam"; });
    var lbB = sumLen(seamBodyB), lbF = sumLen(seamBodyF);
    out.back.seamLenYokeCm = round4(lyB); out.back.seamLenBodyCm = round4(lbB); out.back.deltaCm = lyB - lbB;
    out.front.seamLenYokeCm = round4(lyF); out.front.seamLenBodyCm = round4(lbF); out.front.deltaCm = lyF - lbF;
    // 뒤: 띠 폭 W = (요크 이음 − 2) × 0.5 = 몸판 이음 − 요크 이음 = 몸판 중심 변이 원본에서 밀린 거리
    var W = (isV ? YOKE_V_BACK_RATIO : YOKE_U_RATIO) * (lyB - YOKE_U_TRIM_CM);
    var gb = m.back.gather;
    out.back.gatherCm = round4(W); out.back.gatherDeclaredCm = gb && typeof gb.addedCm === "number" ? round4(gb.addedCm) : null; out.back.gatherDeltaCm = lbB - lyB;
    var cxW = wB.outline.filter(function (s) { return s && s.edge === "center"; }).map(function (s) { return s.from.x; })[0];
    var cxB = BB.outline.filter(function (s) { return s && s.edge === "center"; }).map(function (s) { return s.from.x; })[0];
    if (!(W > 0) || !gb || typeof gb.addedCm !== "number" || !(Math.abs(gb.addedCm - W) <= YOKE_GATHER_EPS) || !(Math.abs(lbB - lyB - W) <= YOKE_GATHER_EPS) ||
        cxW === undefined || cxB === undefined || !(Math.abs(Math.abs(cxB - cxW) - W) <= YOKE_GATHER_EPS)) return bad("yoke-gather-mismatch");
    var rF, rR, wedgeDeg, gapAreaV = 0, areaFairDelta = 0;
    if (isV) {
      // Ⓥ 앞: 독립 재계산 — T = 앞 이음선 양 끝의 1/2점, BP = 원본 AH 다트 apex, 수직 절개 두 줄, 앞중심 쪽 조각의 수평 평행 이동 d
      var legsV = (wF.construction || []).filter(function (s) { return s && s.kind === "line" && s.dart && s.dart.id === YOKE_DART.front; });
      if (legsV.length !== 2) return bad("yoke-seam-missing");
      var apexV = legsV[0].dart.apexAt === "to" ? legsV[0].to : legsV[0].from;
      var mouthV = function (sg) { return sg.dart.apexAt === "to" ? sg.from : sg.to; };
      var mv0 = mouthV(legsV[0]), mv1 = mouthV(legsV[1]);
      var dartDegV = Math.abs(Math.atan2((mv0.x - apexV.x) * (mv1.y - apexV.y) - (mv0.y - apexV.y) * (mv1.x - apexV.x), (mv0.x - apexV.x) * (mv1.x - apexV.x) + (mv0.y - apexV.y) * (mv1.y - apexV.y))) * 180 / Math.PI;
      var cutsV = (FB.construction || []).filter(function (s) { return s && s.wedgeCut && s.kind === "line"; });
      var cFixV = cutsV.filter(function (s) { return s.wedgeCut === "fixed"; })[0], cRotV = cutsV.filter(function (s) { return s.wedgeCut === "rotated"; })[0];
      var spCuts = (FB.construction || []).filter(function (s) { return s && s.spreadCut && s.kind === "line"; });
      var spStay = spCuts.filter(function (s) { return s.spreadCut === "stay"; }), spMoved = spCuts.filter(function (s) { return s.spreadCut === "moved"; });
      if (!cFixV || !cRotV || spStay.length !== 1 || spMoved.length !== 1 || spCuts.length !== 2) return bad("yoke-spread-cut");
      var BPv = cRotV.from, Trv = cRotV.to, Tpp = cFixV.to, BPm = cFixV.from;
      // 수직 절개: 옆 조각 가장자리 = BP 에서 밑단까지 수직(앞중심과 평행), 이동 조각 가장자리 = 같은 y 구간의 수직 · 둘의 간격 = d · 방향 = 앞중심 쪽
      var cxFWv = wF.outline.filter(function (s) { return s && s.edge === "center"; }).map(function (s) { return s.from.x; })[0];
      var dirV = cxFWv >= apexV.x ? 1 : -1, stay = spStay[0], mov = spMoved[0];
      var dV = (mov.from.x - stay.from.x) * dirV;
      // 앞 이음선 양 끝(앞 좌표계 — 어깨 요크는 어깨 맞댐으로 뒤 좌표계라 못 쓴다): Qn = 몸판 이음선의 목둘레 쪽 끝 − d(평행 이동 되돌림), 이음선 방향 = 원본 앞 어깨선 방향(평행), 길이 = 요크 이음선 길이
      var runsB = edgeRuns(FB.outline, "yoke-seam");
      if (runsB.length !== 1) return bad("yoke-seam-front-seam");
      var cntB = []; runsB[0].forEach(function (sg) { var e = endpointsOf(sg); [e[0], e[e.length - 1]].forEach(function (pt) { var h = cntB.filter(function (c) { return near(c.p, pt); })[0]; if (h) h.n++; else cntB.push({ p: pt, n: 1 }); }); });
      var endsB = cntB.filter(function (c) { return c.n === 1; }).map(function (c) { return c.p; });
      var neckPtsB = []; FB.outline.filter(function (sg) { return sg && sg.edge === "neckline"; }).forEach(function (sg) { var e = endpointsOf(sg); neckPtsB.push(e[0], e[e.length - 1]); });
      var QnMv = endsB.filter(function (pt) { return neckPtsB.some(function (q) { return near(q, pt); }); })[0];
      var neckPtsW = []; wF.outline.filter(function (sg) { return sg && sg.edge === "neckline"; }).forEach(function (sg) { var e = endpointsOf(sg); neckPtsW.push(e[0], e[e.length - 1]); });
      var shA = wFSh[0] && endpointsOf(wFSh[0]), shNeck = shA && (neckPtsW.some(function (q) { return near(q, shA[0]); }) ? shA[0] : shA[1]), shTip = shA && (shNeck === shA[0] ? shA[1] : shA[0]);
      if (endsB.length !== 2 || !QnMv || !shNeck) return bad("yoke-seam-front-seam");
      var shLenV = dist(shNeck, shTip), uSh = { x: (shTip.x - shNeck.x) / shLenV, y: (shTip.y - shNeck.y) / shLenV };
      var Qn = { x: QnMv.x - dirV * dV, y: QnMv.y }, Tm = { x: Qn.x + uSh.x * lyF / 2, y: Qn.y + uSh.y * lyF / 2 };
      if (!(Math.abs(Math.abs((Qn.x - shNeck.x) * uSh.y - (Qn.y - shNeck.y) * uSh.x) - YOKE_U_OFFSET_CM) <= YOKE_U_GEO_EPS)) return bad("yoke-seam-front-seam");   // Qn 은 어깨선에서 6cm
      var vertical = function (sg) { return Math.abs(sg.from.x - sg.to.x) <= YOKE_U_GEO_EPS; };
      var hemsV = FB.outline.filter(function (s) { return s && s.edge === "hem" && s.kind === "line"; });
      var hemYv = hemsV.length ? hemsV[0].from.y : NaN;
      if (!hemsV.length || !hemsV.every(function (s) { return Math.abs(s.from.y - hemYv) <= 1e-9 && Math.abs(s.to.y - hemYv) <= 1e-9; })) return bad("yoke-spread-hem");
      if (!near(BPv, apexV) || !vertical(stay) || !vertical(mov) || !(dV > 1e-6) || !near(stay.from, apexV) || !near(mov.from, BPm) ||
          !(Math.abs(stay.to.y - hemYv) <= YOKE_U_GEO_EPS) || !(Math.abs(mov.to.y - hemYv) <= YOKE_U_GEO_EPS) || !(Math.abs(mov.from.y - stay.from.y) <= YOKE_U_GEO_EPS) ||
          !(Math.abs(BPm.x - (apexV.x + dirV * dV)) <= YOKE_U_GEO_EPS) || !(Math.abs(BPm.y - apexV.y) <= YOKE_U_GEO_EPS)) return bad("yoke-spread-cut");
      // 쐐기 보존: 회전 절개 반경 = 고정 절개 반경 = |BP−T| · 쐐기 각 = 원본 AH 다트 각 · 이동한 고정 절개 = 원래 BP→T 의 평행 이동(수평)
      var rRv = dist(apexV, Trv), rFv = dist(apexV, Tm);
      var wedgeDegV = Math.abs(Math.atan2((Tm.x - apexV.x) * (Trv.y - apexV.y) - (Tm.y - apexV.y) * (Trv.x - apexV.x), (Tm.x - apexV.x) * (Trv.x - apexV.x) + (Tm.y - apexV.y) * (Trv.y - apexV.y))) * 180 / Math.PI;
      var Tdx = Tm.x + dirV * dV;
      if (!(Math.abs(rFv - rRv) <= YOKE_U_GEO_EPS) || !(Math.abs(wedgeDegV - dartDegV) <= YOKE_U_ANGLE_EPS_DEG) || !(Math.abs(Tpp.x - Tdx) <= YOKE_U_GEO_EPS) || !(Math.abs(Tpp.y - Tm.y) <= YOKE_U_GEO_EPS)) return bad("yoke-wedge-mismatch");
      // 총 개더: 몸판 이음 − 요크 이음 = 1.2 × ● (● = 요크 이음 − 4) · 이음선 초과분 = |T″ − T′| (fairing 이 길이를 보존) · d 는 이 방정식의 해
      var bulletV = lyF - 2 * YOKE_U_TRIM_CM, Etarget = YOKE_V_FRONT_RATIO * bulletV, wedgeChord = dist(Tm, Trv), chordNew = dist(Tpp, Trv);
      var gf = m.front.gather;
      out.front.gatherCm = round4(lbF - lyF); out.front.gatherSpanCm = round4(bulletV); out.front.gatherTargetCm = round4(Etarget); out.front.wedgeDeg = round4(wedgeDegV); out.front.dartDeg = round4(dartDegV);
      out.front.wedgeChordCm = round4(wedgeChord); out.front.spreadSeamCm = round4(Etarget - wedgeChord); out.front.spreadCm = round4(dV); out.front.gatherDeltaCm = lbF - lyF;
      if (!(Math.abs(lbF - lyF - Etarget) <= YOKE_V_LEN_EPS) || !(Math.abs(chordNew - Etarget) <= YOKE_V_LEN_EPS) || !(Etarget > wedgeChord) || !gf || typeof gf.addedCm !== "number" ||
          !(Math.abs(gf.addedCm - Etarget) <= YOKE_V_LEN_EPS)) return bad("yoke-gather-mismatch");
      // d 의 정확해(독립 재계산): (cdx + dir·d)² + cdy² = E² — 총 초과분 E 를 만족하는 평행 이동량
      var cdx = Tm.x - Trv.x, cdy = Tm.y - Trv.y, dExact = Math.sqrt(Etarget * Etarget - cdy * cdy) - dirV * cdx;
      if (!(Math.abs(dV - dExact) <= 1e-4)) return bad("yoke-spread-amount");
      // 평행 이동은 순수 수평 이동: 앞중심 변·목둘레 변은 원본 앞판의 그 변을 정확히 +d 이동한 것
      var cenY = wF.outline.filter(function (s) { return s && s.edge === "center"; }), cenFB = FB.outline.filter(function (s) { return s && s.edge === "center"; });
      var yr = function (list) { var ys = []; list.forEach(function (s) { ys.push(s.from.y, s.to.y); }); return [Math.min.apply(null, ys), Math.max.apply(null, ys)]; };
      var yrW = yr(cenY), yrB = yr(cenFB);
      if (!cenFB.length || !cenFB.every(function (s) { return Math.abs(s.from.x - (cxFWv + dirV * dV)) <= 1e-6 && Math.abs(s.to.x - (cxFWv + dirV * dV)) <= 1e-6; }) || !(Math.abs(yrW[0] - yrB[0]) <= 1e-6) || !(Math.abs(yrW[1] - yrB[1]) <= 1e-6)) return bad("yoke-spread-translation");
      var neckW = wF.outline.filter(function (s) { return s && s.edge === "neckline"; }), neckB = FB.outline.filter(function (s) { return s && s.edge === "neckline"; });
      var cfNeckW = neckW.map(function (s) { return endpointsOf(s); }).reduce(function (a, e) { return a.concat(e); }, []).filter(function (p) { return Math.abs(p.x - cxFWv) <= 1e-6; })[0];
      var cfNeckB = neckB.map(function (s) { return endpointsOf(s); }).reduce(function (a, e) { return a.concat(e); }, []).filter(function (p) { return Math.abs(p.x - (cxFWv + dirV * dV)) <= 1e-6; })[0];
      if (!cfNeckW || !cfNeckB || !(Math.abs(cfNeckB.y - cfNeckW.y) <= 1e-6)) return bad("yoke-spread-translation");
      // 밑단: 수평 · 절개 사이 간격 d 의 이음 변 포함 · 밑단 연속
      var hemBridge = hemsV.filter(function (s) { return Math.abs(Math.min(s.from.x, s.to.x) - apexV.x) <= 1e-6 && Math.abs(Math.max(s.from.x, s.to.x) - (apexV.x + dirV * dV)) <= 1e-6; });
      if (hemBridge.length !== 1) return bad("yoke-spread-hem");
      // 이음선 fairing 은 길이를 보존한다(위 방정식) — 면적용으로 fairing 전 모서리 다각형을 재구성
      var cornersSeq = [Tpp, Trv];
      var unf = [], placed = false, flatPts = function (sg) { ringSegs([sg]).forEach(function (q) { yokeFlatSeg(q).forEach(function (ab) { unf.push(ab[0]); }); }); };
      FB.outline.forEach(function (sg) {
        if (sg.edge === "yoke-seam") {
          if (!placed) { placed = true; var st = sg.from, o = cornersSeq.slice().sort(function (a, b) { return dist(st, a) - dist(st, b); }); unf.push(cp(st)); o.forEach(function (c) { unf.push(cp(c)); }); }
          return;
        }
        flatPts(sg);
      });
      var areaUnf = Math.abs(shoelace(unf));
      areaFairDelta = mf.areaCm2 - areaUnf;
      var Hl = stay.to, Hr = mov.to;
      gapAreaV = Math.abs(shoelace([Trv, Tpp, BPm, Hr, Hl, BPv]));
      out.front.areaGapCm2 = round4(gapAreaV); out.front.areaUnfairedCm2 = round4(areaUnf); out.front.areaFairDeltaCm2 = round4(areaFairDelta);
      rF = rFv; rR = rRv; wedgeDeg = wedgeDegV; mf = { areaCm2: areaUnf, selfIntersects: mf.selfIntersects };   // 이하 면적 정산은 fairing 전 몸판으로
    } else {
    // 앞: 쐐기 — 고정 절개선(BP→T)·회전 절개선(BP→T') · T = 이음선 1/2점 · 쐐기 각 = 원본 AH 다트 각 · 현 g = 몸판 이음 − 요크 이음
    var cuts = (FB.construction || []).filter(function (s) { return s && s.wedgeCut && s.kind === "line"; });
    var cFix = cuts.filter(function (s) { return s.wedgeCut === "fixed"; })[0], cRot = cuts.filter(function (s) { return s.wedgeCut === "rotated"; })[0];
    if (!cFix || !cRot || !near(cFix.from, cRot.from)) return bad("yoke-gather-mismatch");
    var BP = cFix.from, Tp = cFix.to, Tr = cRot.to;
    var gap = dist(Tp, Tr), rF = dist(BP, Tp), rR = dist(BP, Tr);
    var legsF = (wF.construction || []).filter(function (s) { return s && s.kind === "line" && s.dart && s.dart.id === YOKE_DART.front; });
    if (legsF.length !== 2) return bad("yoke-seam-missing");
    var apexF = legsF[0].dart.apexAt === "to" ? legsF[0].to : legsF[0].from;
    var mouthOf = function (sg) { return sg.dart.apexAt === "to" ? sg.from : sg.to; };
    var m0 = mouthOf(legsF[0]), m1 = mouthOf(legsF[1]);
    var dartDeg = Math.abs(Math.atan2((m0.x - apexF.x) * (m1.y - apexF.y) - (m0.y - apexF.y) * (m1.x - apexF.x), (m0.x - apexF.x) * (m1.x - apexF.x) + (m0.y - apexF.y) * (m1.y - apexF.y))) * 180 / Math.PI;
    var wedgeDeg = Math.abs(Math.atan2((Tp.x - BP.x) * (Tr.y - BP.y) - (Tp.y - BP.y) * (Tr.x - BP.x), (Tp.x - BP.x) * (Tr.x - BP.x) + (Tp.y - BP.y) * (Tr.y - BP.y))) * 180 / Math.PI;
    out.front.gatherCm = round4(gap); out.front.wedgeDeg = round4(wedgeDeg); out.front.dartDeg = round4(dartDeg); out.front.gatherDeltaCm = lbF - lyF;
    out.front.gatherSpanCm = round4(lyF - 2 * YOKE_U_TRIM_CM); out.front.gatherRefRatio = round4(gap / (lyF - 2 * YOKE_U_TRIM_CM));   // ●×0.6 은 결과 비율 — 게이트 아님
    var gf = m.front.gather;
    if (!(gap > 0) || !(Math.abs(rF - rR) <= YOKE_U_GEO_EPS) || !(Math.abs(wedgeDeg - dartDeg) <= YOKE_U_ANGLE_EPS_DEG) ||
        !(Math.abs(lbF - lyF - gap) <= YOKE_GATHER_EPS) || !gf || typeof gf.addedCm !== "number" || !(Math.abs(gf.addedCm - gap) <= YOKE_GATHER_EPS)) return bad("yoke-gather-mismatch");
    // 앞 이음선: 어깨선과 평행 · 어깨선에서 6cm(수직거리) — 몸판의 고정 이음선(T 에 닿는 직선)과 요크의 앞 이음선 둘 다
    var sh = wFSh[0], sd = { x: sh.to.x - sh.from.x, y: sh.to.y - sh.from.y }, sdl = Math.hypot(sd.x, sd.y);
    var perp = function (p) { return Math.abs((p.x - sh.from.x) * sd.y - (p.y - sh.from.y) * sd.x) / sdl; };
    var fixedSeam = seamBodyF.filter(function (s) { var e = endpointsOf(s); return s.kind === "line" && (near(e[0], Tp) || near(e[1], Tp)) && !near(e[0], Tr) && !near(e[1], Tr); })[0];
    if (!fixedSeam) return bad("yoke-seam-front-seam");
    var par = Math.abs((fixedSeam.to.x - fixedSeam.from.x) * sd.y - (fixedSeam.to.y - fixedSeam.from.y) * sd.x) / sdl;
    // 절개 끝 T = 이음선 양 끝(목둘레↔진동) 사이 호길이 정확히 1/2점: 고정 이음선(목둘레 끝 → T) 길이 = 요크 이음선 길이 / 2 · 회전한 쪽(T' → 진동 끝)도 같다. 연직 투영이 아니다.
    var rotSeam = seamBodyF.filter(function (s) { var e = endpointsOf(s); return s.kind === "line" && (near(e[0], Tr) || near(e[1], Tr)) && !near(e[0], Tp) && !near(e[1], Tp); })[0];
    out.front.cutFraction = round4(segLen(fixedSeam) / lyF);
    if (!rotSeam || !(Math.abs(segLen(fixedSeam) - lyF / 2) <= YOKE_U_GEO_EPS) || !(Math.abs(segLen(rotSeam) - lyF / 2) <= YOKE_U_GEO_EPS)) return bad("yoke-seam-front-cut-end");
    out.front.seamOffsetCm = round4(perp(fixedSeam.from));
    if (!(par <= YOKE_U_GEO_EPS) || !(Math.abs(perp(fixedSeam.from) - YOKE_U_OFFSET_CM) <= YOKE_U_GEO_EPS) || !(Math.abs(perp(fixedSeam.to) - YOKE_U_OFFSET_CM) <= YOKE_U_GEO_EPS)) return bad("yoke-seam-front-seam");
    }
    var ysF = runFront[0][0], sdy = { x: cf[0].to.x - cf[0].from.x, y: cf[0].to.y - cf[0].from.y }, sdyl = Math.hypot(sdy.x, sdy.y);
    var perpY = function (p) { return Math.abs((p.x - cf[0].from.x) * sdy.y - (p.y - cf[0].from.y) * sdy.x) / sdyl; };
    var eY = endpointsOf(ysF), eY1 = eY[eY.length - 1];
    if (runFront[0].length !== 1 || ysF.kind !== "line" || !(Math.abs(perpY(eY[0]) - YOKE_U_OFFSET_CM) <= YOKE_U_GEO_EPS) || !(Math.abs(perpY(eY1) - YOKE_U_OFFSET_CM) <= YOKE_U_GEO_EPS)) return bad("yoke-seam-front-seam");
    // 밑단 옆 +1(앞·뒤 몸판)
    var hemOf = function (pc, cx) {
      var sides = pc.outline.filter(function (s) { return s && s.edge === "side-seam"; });
      var pts = []; sides.forEach(function (s) { var e = endpointsOf(s); pts.push(e[0], e[e.length - 1]); });
      if (!pts.length) return NaN;
      var top = pts.reduce(function (a, b) { return b.y < a.y ? b : a; }), bot = pts.reduce(function (a, b) { return b.y > a.y ? b : a; });
      return (top.x >= cx ? 1 : -1) * (bot.x - top.x);
    };
    var cxFW = wF.outline.filter(function (s) { return s && s.edge === "center"; }).map(function (s) { return s.from.x; })[0];
    if (!(Math.abs(hemOf(BB, cxB) - 1) <= 1e-6) || !(Math.abs(hemOf(FB, cxFW) - 1) <= 1e-6)) return bad("yoke-seam-hem-side");
    // 면적: 어깨 요크 + 앞몸판 + 뒤몸판 = 원본 앞 링 + 원본 뒤 링 + 어깨 틈 + 뒤 띠 + 앞 쐐기
    var legsOf = function (pc, id) { return (pc.construction || []).filter(function (s) { return s && s.kind === "line" && s.dart && s.dart.id === id; }).map(function (s) { return { kind: "line", from: cp(s.from), to: cp(s.to) }; }); };
    var rwF = yokeOrderRing(ringSegs(wF.outline).concat(legsOf(wF, YOKE_DART.front)), YOKE_WHOLE_EPS), rwB = yokeOrderRing(ringSegs(wB.outline).concat(legsOf(wB, YOKE_DART.back)), YOKE_WHOLE_EPS);
    if (!rwF || !rwB) return bad("yoke-seam-missing");
    var awF = yokeRingMetrics(rwF).areaCm2, awB = yokeRingMetrics(rwB).areaCm2;
    var strip = (BB.construction || []).filter(function (s) { return s && s.gatherBoundary; })[0];
    var stripArea = strip ? W * dist(strip.from, strip.to) : NaN;
    var wedgeArea = isV ? gapAreaV : 0.5 * rF * rR * Math.sin(wedgeDeg * Math.PI / 180);   // Ⓥ: 쐐기 면적은 틈 다각형 G(쐐기 + 평행 벌림 띠)에 포함돼 W 항이 상쇄된다
    var dArea = my.areaCm2 + mf.areaCm2 + mb.areaCm2 - awF - awB - lensCm2 - stripArea - wedgeArea;
    out.shoulderYoke.areaDeltaCm2 = round4(dArea);
    if (!isFinite(dArea) || !(Math.abs(dArea) <= YOKE_U_AREA_EPS)) return bad("yoke-seam-area-mismatch");
    out.ok = true; out.reason = null;
    return out;
  }
  function yokeSeamState(proj) {
    var g = proj && proj.working && proj.working.geometry;
    if (!g || !(g.frontYoke || g.frontBody || g.backYoke || g.backBody || g.yokeSeam || g.shoulderYoke)) return null;
    if (g.shoulderYoke || (g.yokeSeam && g.yokeSeam.variant === "U") || (proj.working.parameters && proj.working.parameters.body && proj.working.parameters.body.yokeSeam === "U")) return yokeStateU(proj, g);   // Ⓤ(P.34)
    var row = function (side) {
      var Y = g[side + "Yoke"], B = g[side + "Body"], whole = g[side], m = (g.yokeSeam || {})[side];
      var r = { side: side, closed: { yoke: false, body: false }, selfIntersects: null, seamLenYokeCm: null, seamLenBodyCm: null,
        deltaCm: null, areaYokeCm2: null, areaBodyCm2: null, areaWholeCm2: null, areaDeltaCm2: null,
        absorbedDartIds: m && Array.isArray(m.absorbedDarts) ? m.absorbedDarts.map(function (d) { return d.id; }) : null, reason: null };
      var okPiece = function (pc) { return pc && Array.isArray(pc.outline) && pc.outline.length >= 3; };
      if (!okPiece(Y) || !okPiece(B) || !okPiece(whole) || !m) { r.reason = "yoke-seam-missing"; return r; }
      var pbody = proj.working.parameters && proj.working.parameters.body;
      var pyk = pbody && pbody.yokeSeam;   // 파라미터가 Ⓢ/Ⓣ 를 말하면 그 규칙이 우선한다(geometry 메타로 다른 규칙을 고르지 않는다)
      if (pyk === "T" || (pyk !== "S" && m.variant === "T")) { r.variant = "T"; return yokeRowT(r, side, Y, B, whole, m, proj); }   // Ⓣ(P.33): Ⓢ 요크 + 몸판 절개 벌림
      if ((pbody && pbody.yokeSeam === "S") || m.variant === "S") { r.variant = "S"; return yokeRowS(r, side, Y, B, whole, m, proj); }   // Ⓢ(P.32): 별도 규칙(Ⓠ·Ⓡ 경로는 아래 그대로)
      var ry = yokeOrderRing(ringSegs(Y.outline)), rb = yokeOrderRing(ringSegs(B.outline));
      r.closed = { yoke: !!ry, body: !!rb };
      if (!ry || !rb) { r.reason = "yoke-seam-open"; return r; }
      var my = yokeRingMetrics(ry), mb = yokeRingMetrics(rb);
      r.areaYokeCm2 = round4(my.areaCm2); r.areaBodyCm2 = round4(mb.areaCm2);
      r.selfIntersects = my.selfIntersects || mb.selfIntersects;
      if (r.selfIntersects || !(my.areaCm2 > 0) || !(mb.areaCm2 > 0)) { r.reason = "yoke-seam-self-intersection"; return r; }
      // 흡수한 다트는 어느 조각에도 남지 않는다(닫힌 다트 = 과거 흔적).
      var dartId = YOKE_DART[side];
      var hasDart = function (pc) { return pc.outline.concat(pc.construction || []).some(function (s) { return s && s.dart && s.dart.id === dartId; }); };
      if (hasDart(Y) || hasDart(B)) { r.reason = "yoke-seam-dart-open"; return r; }
      var seamOf = function (pc) { return pc.outline.filter(function (s) { return s && s.edge === "yoke-seam"; }); };
      var sy = seamOf(Y), sb = seamOf(B);
      if (sy.length !== 2 || sb.length !== 2 || !sy.concat(sb).every(function (s) { return s.kind === "line"; })) { r.reason = "yoke-seam-missing"; return r; }
      var ys = sb.map(function (s) { return [s.from.y, s.to.y]; }).reduce(function (a, b) { return a.concat(b); }, []);
      if (Math.max.apply(null, ys) - Math.min.apply(null, ys) > YOKE_HORIZ_EPS) { r.reason = "yoke-seam-not-horizontal"; return r; }
      r.seamLenYokeCm = round4(sy.reduce(function (t, s) { return t + segLen(s); }, 0));
      r.seamLenBodyCm = round4(sb.reduce(function (t, s) { return t + segLen(s); }, 0));
      var ly = sy.reduce(function (t, s) { return t + segLen(s); }, 0), lb = sb.reduce(function (t, s) { return t + segLen(s); }, 0);
      r.deltaCm = ly - lb;
      // 개더(Ⓡ): 메타가 선언했을 때만 — 몸판 이음 길이가 요크보다 **정확히 개더 분량만큼** 길어야 한다. 미선언이면 Ⓠ 그대로(차이 0).
      var gather = !!(m && m.gather);
      var gatherW = null;
      if (gather) {
        var apexP = sy[0].to, cxWhole = null;
        var wc = ringSegs(whole.outline.filter(function (s) { return s && s.edge === "center"; }));
        if (wc.length) cxWhole = wc[0].from.x;
        if (cxWhole == null || !(Math.abs(sy[0].to.x - sy[1].from.x) < YOKE_CHAIN_EPS)) { r.reason = "yoke-gather-mismatch"; return r; }
        gatherW = side === "back" ? YOKE_GATHER_BACK_CM : Math.abs(apexP.x - cxWhole) - YOKE_GATHER_FRONT_TRIM_CM;
        r.gatherCm = round4(gatherW);
        r.gatherDeclaredCm = typeof m.gather.addedCm === "number" ? round4(m.gather.addedCm) : null;
        r.gatherDeltaCm = lb - ly;
        if (!(gatherW > 0) || !(Math.abs(lb - ly - gatherW) <= YOKE_GATHER_EPS) ||
            typeof m.gather.addedCm !== "number" || !(Math.abs(m.gather.addedCm - gatherW) <= YOKE_GATHER_EPS)) { r.reason = "yoke-gather-mismatch"; return r; }
      } else if (!(Math.abs(r.deltaCm) <= YOKE_SEAM_LEN_EPS)) { r.reason = "yoke-seam-length-mismatch"; return r; }
      // 전체 몸판 링 = 외곽 + 열린 다트 다리(construction)로 닫은 폐곡선. 요크+몸판 면적과 비교한다.
      var legs = (whole.construction || []).filter(function (s) { return s && s.kind === "line" && s.dart && s.dart.id === dartId; }).map(function (s) { return { kind: "line", from: cp(s.from), to: cp(s.to) }; });
      var rw = yokeOrderRing(ringSegs(whole.outline).concat(legs), YOKE_WHOLE_EPS);   // 원본 몸판의 다트 입 접합 허용(designLineTool RING_EPS 와 같다)
      if (!rw) { r.reason = "yoke-seam-missing"; return r; }
      var aw = yokeRingMetrics(rw).areaCm2;
      r.areaWholeCm2 = round4(aw); r.areaDeltaCm2 = round4(my.areaCm2 + mb.areaCm2 - aw);
      if (gather) {
        // 면적 = 전체 몸판 + 개더 띠(분량 × 이음선~밑단 중심 높이). 띠 높이는 몸판의 center 변에서 재계산한다.
        var ce = ringSegs(B.outline.filter(function (s) { return s && s.edge === "center"; }));
        var ysC = []; ce.forEach(function (s) { ysC.push(s.from.y, s.to.y); });
        var hStrip = ysC.length ? Math.max.apply(null, ysC) - sb[0].from.y : NaN;
        var extra = gatherW * hStrip;
        r.gatherAreaCm2 = round4(extra);
        if (!(Math.abs(my.areaCm2 + mb.areaCm2 - aw - extra) <= YOKE_AREA_EPS)) { r.reason = "yoke-seam-area-mismatch"; return r; }
      } else if (Math.abs(my.areaCm2 + mb.areaCm2 - aw) > YOKE_AREA_EPS) { r.reason = "yoke-seam-area-mismatch"; return r; }
      return r;
    };
    var F = row("front"), B = row("back");
    return { front: F, back: B, ok: !F.reason && !B.reason, reason: F.reason || B.reason };
  }
  function yokeCanon(proj) {
    var g = proj && proj.working && proj.working.geometry;
    if (princessMode(g)) return princessCanon(proj);   // 프린세스 Ⓔ: 중심·옆 네 조각(요크 키와 겹치지 않는다)
    if (g && g.shoulderYoke && g.frontBody && g.backBody) return { sy: canonOutline(g.shoulderYoke.outline), syc: canonOutline(g.shoulderYoke.construction || []), fb: canonOutline(g.frontBody.outline), fbc: canonOutline(g.frontBody.construction || []), bb: canonOutline(g.backBody.outline), bbc: canonOutline(g.backBody.construction || []) };   // Ⓤ: 어깨 요크 한 장
    if (!g || !g.frontYoke || !g.frontBody || !g.backYoke || !g.backBody) return null;
    var o = { fy: canonOutline(g.frontYoke.outline), fb: canonOutline(g.frontBody.outline), by: canonOutline(g.backYoke.outline), bb: canonOutline(g.backBody.outline) };
    if (g.backYoke.construction && g.backYoke.construction.length) o.byc = canonOutline(g.backYoke.construction);   // Ⓢ: 요크에 남는 열린 다트 다리 — 없으면 Ⓠ·Ⓡ hash 불변
    return o;
  }

  // ── 프린세스 라인 Ⓔ(P.18): 중심·옆 조각 네 장 ──
  //   geometry.frontCenter/frontSide/backCenter/backSide(있을 때만). **geometry.princess 메타는 신뢰하지 않는다** — 폐곡선·연속성·자기교차·다트 흔적·
  //   이음선 위치(어깨 50%·BP·다트 입구)·최대 0.5cm 곡선·BP 회전(AH 다트각)·이음 길이·어깨 직선 연속·면적 보존·조각 겹침을 출력 geometry 와 전체 몸판(front/back)에서
  //   **전부 다시 계산**한다. 위반하면 완료를 막는다.
  var PRINCESS_POS_EPS = 1e-4;      // 점 위치(cm)
  var PRINCESS_SEAM_EPS = 1e-4;     // 앞 이음 길이 정합(cm) — 강체 회전이라 실제 오차는 ≈1e-13
  var PRINCESS_LEG_EPS = 0.2;       // 뒤 이음 길이 차 상한(cm) = 어깨 다트 두 다리 길이 차(문서화된 ≈0.10)
  var PRINCESS_BULGE_EPS = 2e-3;    // 최대 편차 0.5cm 허용(cm)
  var PRINCESS_KINK_EPS = 1e-4;     // 봉제 정렬 프레임에서 어깨선 꺾임(도)
  var PRINCESS_AREA_EPS = 0.05;
  var PRINCESS_DARTS = ["front-bust", "front-waist-a", "back-shoulder", "back-waist-e"];
  function princessMode(g) { return !!(g && g.frontCenter && g.frontSide && g.backCenter && g.backSide); }
  function princessFlat(segs) { var L = 0, pts = []; segs.forEach(function (sg) { yokeFlatSeg(sg).forEach(function (ab) { L += Math.hypot(ab[1].x - ab[0].x, ab[1].y - ab[0].y); }); }); return L; }
  function princessPts(ring) { var pts = []; ring.forEach(function (sg) { yokeFlatSeg(sg).forEach(function (ab) { if (!pts.length) pts.push(ab[0]); pts.push(ab[1]); }); }); return pts; }
  function princessOnEdge(p, pts) {
    for (var i = 0; i < pts.length; i++) {
      var a = pts[i], b = pts[(i + 1) % pts.length], dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy;
      var u = L2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2)) : 0;
      if (Math.hypot(p.x - (a.x + u * dx), p.y - (a.y + u * dy)) <= 1e-5) return true;
    }
    return false;
  }
  function princessInside(p, pts) {
    if (princessOnEdge(p, pts)) return false;
    var inside = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      var a = pts[i], b = pts[j];
      if (((a.y > p.y) !== (b.y > p.y)) && (p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x)) inside = !inside;
    }
    return inside;
  }
  // 두 폐곡선이 겹치는가(변이 가로지르거나 한쪽 점이 다른 쪽 엄격히 안쪽). 경계 접촉(이음선·점)은 겹침이 아니다.
  function princessOverlap(ra, rb) {
    var fa = [], fb = []; ra.forEach(function (sg) { yokeFlatSeg(sg).forEach(function (ab) { fa.push(ab); }); }); rb.forEach(function (sg) { yokeFlatSeg(sg).forEach(function (ab) { fb.push(ab); }); });
    var o = function (p, q, r) { return (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x); };
    var same = function (p, q) { return Math.hypot(p.x - q.x, p.y - q.y) < 1e-6; };
    for (var i = 0; i < fa.length; i++) for (var j = 0; j < fb.length; j++) {
      var A = fa[i][0], B = fa[i][1], C = fb[j][0], D = fb[j][1];
      if (same(A, C) || same(A, D) || same(B, C) || same(B, D)) continue;
      if (o(A, B, C) * o(A, B, D) < 0 && o(C, D, A) * o(C, D, B) < 0) return true;
    }
    var pa = princessPts(ra), pb = princessPts(rb);
    return pa.some(function (q) { return princessInside(q, pb); }) || pb.some(function (q) { return princessInside(q, pa); });
  }
  function princessRot(p, o, th) { var c = Math.cos(th), s = Math.sin(th), dx = p.x - o.x, dy = p.y - o.y; return { x: o.x + dx * c - dy * s, y: o.y + dx * s + dy * c }; }
  function princessRotSeg(sg, o, th) { var q = { kind: sg.kind, from: princessRot(sg.from, o, th), to: princessRot(sg.to, o, th) }; if (sg.kind === "cubic") { q.c1 = princessRot(sg.c1, o, th); q.c2 = princessRot(sg.c2, o, th); } return q; }
  function princessSameSeg(a, b, eps) { return a.kind === b.kind && ["from", "to", "c1", "c2"].every(function (k) { return !a[k] || Math.hypot(a[k].x - b[k].x, a[k].y - b[k].y) <= eps; }); }
  var PRINCESS_F_EXTRA = { a: 1, e: 1.5 };   // Ⓕ(P.19) 인쇄값 — 책이 정한 절대 증가량(cm)
  function princessState(proj) {
    var g = proj && proj.working && proj.working.geometry;
    if (!g) return null;
    var wantsPrincess = !!(proj.working.parameters && proj.working.parameters.body && proj.working.parameters.body.princess != null && (proj.working.parameters.body.princess === "E" || proj.working.parameters.body.princess === "F"));
    if (!wantsPrincess && !(g.frontCenter || g.frontSide || g.backCenter || g.backSide || g.princess)) return null;   // 파라미터가 프린세스를 말하는데 조각이 없으면 "없다"로 거부한다
    var pbody = proj.working.parameters && proj.working.parameters.body;
    var pv = (pbody && (pbody.princess === "E" || pbody.princess === "F")) ? pbody.princess : "E";   // Ⓔ(P.18) · Ⓕ(P.19) — 같은 규칙, Ⓕ 만 다트 폭 추가
    var out = { variant: pv, front: { side: "front", reason: null }, back: { side: "back", reason: null }, ok: false, reason: null };
    var bad = function (reason, side) { out.ok = false; out.reason = reason; if (side && out[side]) out[side].reason = reason; return out; };
    var okPiece = function (pc) { return pc && Array.isArray(pc.outline) && pc.outline.length >= 3; };
    var FC = g.frontCenter, FS = g.frontSide, BC = g.backCenter, BS = g.backSide, wF = g.front, wB = g.back;
    if (!pbody || (pbody.princess !== "E" && pbody.princess !== "F")) return bad("princess-variant-mismatch");   // 파라미터가 말하는 규칙이 우선 — 메타로 다른 규칙을 고르지 않는다
    if (!okPiece(FC) || !okPiece(FS) || !okPiece(BC) || !okPiece(BS) || !okPiece(wF) || !okPiece(wB) || !g.princess) return bad("princess-missing");
    if (g.princess.variant !== pv) return bad("princess-variant-mismatch");
    // 다트 폭 추가는 Ⓕ 에만 있다(P.19 «앞은 다트 a + 1cm, 뒤는 다트 e + 1.5cm»). 파라미터가 말하는 값이 우선이고 메타는 출력 geometry 와 대조만 한다.
    var xp = pbody.waistDartExtraCm, pxm = g.princess.waistDartExtra;
    if (pv === "E") { if (xp != null || pxm != null) return bad("princess-dart-extra-mismatch"); }
    else {
      if (!xp || typeof xp !== "object" || Object.keys(xp).sort().join() !== "a,e" || xp.a !== PRINCESS_F_EXTRA.a || xp.e !== PRINCESS_F_EXTRA.e) return bad("princess-dart-extra-mismatch");
      if (!pxm || !pxm.front || !pxm.back || !pxm.front.a || !pxm.back.e || Object.keys(pxm.front).length !== 1 || Object.keys(pxm.back).length !== 1) return bad("princess-dart-extra-mismatch");
    }
    if (g.frontYoke || g.backYoke || g.shoulderYoke || g.frontBody || g.backBody || g.frontPeplum || g.backPeplum) return bad("princess-missing");   // 한 번에 한 가지 조각 분리
    var rings = {}, mets = {};
    var pieces = { frontCenter: FC, frontSide: FS, backCenter: BC, backSide: BS };
    var keys = Object.keys(pieces);
    for (var ki = 0; ki < keys.length; ki++) {
      var r = yokeOrderRing(ringSegs(pieces[keys[ki]].outline));
      if (!r) return bad("princess-open", keys[ki].indexOf("front") === 0 ? "front" : "back");
      rings[keys[ki]] = r; mets[keys[ki]] = yokeRingMetrics(r);
      if (mets[keys[ki]].selfIntersects || !(mets[keys[ki]].areaCm2 > 0)) return bad("princess-self-intersection", keys[ki].indexOf("front") === 0 ? "front" : "back");
    }
    // 흡수·닫은 다트는 어느 조각에도 남지 않는다(닫힌 다트 = 과거 흔적).
    var hasDart = function (pc) { return pc.outline.concat(pc.construction || []).some(function (sg) { return sg && sg.dart && PRINCESS_DARTS.indexOf(sg.dart.id) >= 0; }); };
    if (keys.some(function (k) { return hasDart(pieces[k]); })) return bad("princess-dart-open");
    var wholeLegs = function (pc, id) { return (pc.construction || []).filter(function (sg) { return sg && sg.kind === "line" && sg.dart && sg.dart.id === id; }); };
    var apexOfLeg = function (sg) { return sg.dart.apexAt === "to" ? sg.to : sg.from; }, footOfLeg = function (sg) { return sg.dart.apexAt === "to" ? sg.from : sg.to; };
    var seamOf = function (pc) { return pc.outline.filter(function (sg) { return sg && sg.edge === "princess-seam"; }); };
    var cxOf = function (pc) { return pc.outline.filter(function (sg) { return sg && sg.edge === "center"; }).map(function (sg) { return sg.from.x; })[0]; };
    var lenSeg = function (sg) { return princessFlat([sg]); };
    var hemWidth = function (pc) { var L = 0; pc.outline.forEach(function (sg) { if (sg && sg.edge === "hem") L += Math.hypot(sg.to.x - sg.from.x, sg.to.y - sg.from.y); }); return L; };
    var hemY = wF.outline.filter(function (sg) { return sg && sg.edge === "hem"; }).map(function (sg) { return sg.from.y; })[0];

    // ── 앞 ──
    var fSeamC = ringSegs(seamOf(FC)), fSeamS = ringSegs(seamOf(FS));
    if (fSeamC.length !== 4 || fSeamS.length !== 4) return bad("princess-seam-missing", "front");
    var lenFC = princessFlat(fSeamC), lenFS = princessFlat(fSeamS);
    out.front.seamLenCenterCm = round4(lenFC); out.front.seamLenSideCm = round4(lenFS); out.front.deltaCm = round4(lenFC - lenFS);
    if (!(Math.abs(lenFC - lenFS) <= PRINCESS_SEAM_EPS)) return bad("princess-seam-length-mismatch", "front");
    var ahLegs = wholeLegs(wF, "front-bust"), waLegs = wholeLegs(wF, "front-waist-a");
    if (ahLegs.length !== 2 || waLegs.length !== 2) return bad("princess-seam-missing", "front");
    var BP = apexOfLeg(ahLegs[0]);
    var shSegs = wF.outline.filter(function (sg) { return sg && sg.edge === "shoulder"; });
    var neckSegs = wF.outline.filter(function (sg) { return sg && sg.edge === "neckline"; });
    if (shSegs.length !== 1 || !neckSegs.length) return bad("princess-shoulder-missing", "front");
    var shE = endpointsOf(shSegs[0]), neckPts = []; neckSegs.forEach(function (sg) { endpointsOf(sg).forEach(function (q) { neckPts.push(q); }); });
    var nearAny = function (q) { return neckPts.some(function (n) { return Math.hypot(n.x - q.x, n.y - q.y) < 1e-3; }); };
    var NP = nearAny(shE[0]) ? shE[0] : shE[1], SP = NP === shE[0] ? shE[1] : shE[0];
    var S0 = { x: NP.x + (SP.x - NP.x) * 0.5, y: NP.y + (SP.y - NP.y) * 0.5 };                 // 목점에서 어깨 호길이 50%(직선)
    var seamTop = fSeamC.filter(function (sg) { return sg.kind === "cubic"; });
    if (seamTop.length !== 1) return bad("princess-seam-missing", "front");
    var CC = seamTop[0];
    var dFrom = Math.hypot(CC.from.x - S0.x, CC.from.y - S0.y), dTo = Math.hypot(CC.to.x - S0.x, CC.to.y - S0.y);
    if (Math.min(dFrom, dTo) > PRINCESS_POS_EPS) return bad("princess-seam-position-mismatch", "front");   // 어깨 시작점 = 목점에서 어깨 호길이 50%
    var Cs = dFrom <= dTo ? CC : { kind: "cubic", from: CC.to, c1: CC.c2, c2: CC.c1, to: CC.from };   // S0→BP 방향
    if (Math.hypot(Cs.to.x - BP.x, Cs.to.y - BP.y) > PRINCESS_POS_EPS) return bad("princess-seam-position-mismatch", "front");
    // 최대 0.5cm 곡선: 기준 직선에서 앞중심 반대(진동) 쪽으로 볼록, 반대편 편차 0
    var cxF = cxOf(wF), dx = BP.x - S0.x, dy = BP.y - S0.y, Lc = Math.hypot(dx, dy), nx = -dy / Lc, ny = dx / Lc;
    if (nx * (cxF - S0.x) > 0) { nx = -nx; ny = -ny; }
    var dMax = -Infinity, dMin = Infinity;
    for (var bi = 0; bi <= 200; bi++) {
      var bt = bi / 200, bu = 1 - bt;
      var bx = bu * bu * bu * Cs.from.x + 3 * bu * bu * bt * Cs.c1.x + 3 * bu * bt * bt * Cs.c2.x + bt * bt * bt * Cs.to.x, by = bu * bu * bu * Cs.from.y + 3 * bu * bu * bt * Cs.c1.y + 3 * bu * bt * bt * Cs.c2.y + bt * bt * bt * Cs.to.y;
      var dv = (bx - S0.x) * nx + (by - S0.y) * ny; if (dv > dMax) dMax = dv; if (dv < dMin) dMin = dv;
    }
    out.front.bulgeMaxCm = round4(dMax);
    if (!(Math.abs(dMax - 0.5) <= PRINCESS_BULGE_EPS) || !(dMin >= -1e-9)) return bad("princess-seam-bulge", "front");
    // 옆 조각 윗부분 = 중심 곡선을 BP 축으로 AH 다트각만큼 회전(닫는다). 각은 전체 몸판의 두 다리에서 다시 계산한다.
    var farOf = function (sg) { return sg.dart.apexAt === "to" ? sg.from : sg.to; };
    var m0 = { x: farOf(ahLegs[0]).x - BP.x, y: farOf(ahLegs[0]).y - BP.y }, m1 = { x: farOf(ahLegs[1]).x - BP.x, y: farOf(ahLegs[1]).y - BP.y };
    var ang = Math.atan2(m0.x * m1.y - m0.y * m1.x, m0.x * m1.x + m0.y * m1.y), angAbs = Math.abs(ang);
    out.front.angleDeg = round4(angAbs * 180 / Math.PI);
    var sTop = fSeamS.filter(function (sg) { return sg.kind === "cubic"; });
    if (sTop.length !== 1) return bad("princess-seam-missing", "front");
    var sSegS = sTop[0];
    var sFwd = Math.hypot(sSegS.to.x - BP.x, sSegS.to.y - BP.y) <= PRINCESS_POS_EPS ? sSegS : { kind: "cubic", from: sSegS.to, c1: sSegS.c2, c2: sSegS.c1, to: sSegS.from };   // S0'→BP
    var theta = null;
    [angAbs, -angAbs].forEach(function (th) { if (theta == null && princessSameSeg(princessRotSeg(Cs, BP, th), sFwd, 1e-6)) theta = th; });
    if (theta == null) return bad("princess-ah-not-closed", "front");
    out.front.closedAngleDeg = round4(Math.abs(theta) * 180 / Math.PI);
    // 허리 다트 a: 마름모 — 축 x = BP.x, 폭 = 전체 몸판 a 의 폭, 끝 y = 전체 a 의 끝 y, 밑단 점 = (축, 밑단 y)
    var fa1 = footOfLeg(waLegs[0]), fa2 = footOfLeg(waLegs[1]), widthA = Math.abs(fa1.x - fa2.x), apexA = apexOfLeg(waLegs[0]);
    var linesC = fSeamC.filter(function (sg) { return sg.kind === "line"; }), linesS = fSeamS.filter(function (sg) { return sg.kind === "line"; });
    if (linesC.length !== 3 || linesS.length !== 3) return bad("princess-seam-missing", "front");
    var pointsOf = function (ls) { var o = []; ls.forEach(function (sg) { o.push(sg.from, sg.to); }); return o; };
    var footAt = function (ls) { var p = pointsOf(ls).filter(function (q) { return Math.abs(q.y - fa1.y) <= PRINCESS_POS_EPS; }); return p[0]; };
    var fC = footAt(linesC), fS = footAt(linesS);
    var Hc = pointsOf(linesC).filter(function (q) { return Math.abs(q.y - hemY) <= PRINCESS_POS_EPS; })[0], Hs = pointsOf(linesS).filter(function (q) { return Math.abs(q.y - hemY) <= PRINCESS_POS_EPS; })[0];
    if (!fC || !fS || !Hc || !Hs) return bad("princess-waist-dart-mismatch", "front");
    if (!(Math.abs(Math.abs(fC.x - fS.x) - widthA) <= PRINCESS_POS_EPS) || !(Math.abs((fC.x + fS.x) / 2 - BP.x) <= PRINCESS_POS_EPS) || !(Math.abs(Hc.x - BP.x) <= PRINCESS_POS_EPS) || !(Math.abs(Hs.x - BP.x) <= PRINCESS_POS_EPS)) return bad("princess-waist-dart-mismatch", "front");
    if (!pointsOf(linesC).concat(pointsOf(linesS)).some(function (q) { return Math.abs(q.x - BP.x) <= PRINCESS_POS_EPS && Math.abs(q.y - apexA.y) <= PRINCESS_POS_EPS; })) return bad("princess-waist-dart-mismatch", "front");
    if (pv === "F") {
      var xa = pxm.front.a;
      if (!(xa.beforeCm > 0) || Math.abs(xa.extraCm - PRINCESS_F_EXTRA.a) > 1e-9 || Math.abs(xa.afterCm - xa.beforeCm - PRINCESS_F_EXTRA.a) > PRINCESS_POS_EPS || Math.abs(widthA - xa.afterCm) > PRINCESS_POS_EPS) return bad("princess-dart-extra-mismatch", "front");
      out.front.waistDartExtraCm = round4(widthA - xa.beforeCm); out.front.waistDartBeforeCm = round4(xa.beforeCm);
    }
    out.front.waistDartCm = round4(widthA);
    // 어깨: 봉제 정렬 프레임(옆 조각 윗부분을 BP 축으로 되돌림)에서 중심·옆 어깨선이 한 직선, 길이 합 = 전체 어깨
    var shC = FC.outline.filter(function (sg) { return sg && sg.edge === "shoulder"; }), shS = FS.outline.filter(function (sg) { return sg && sg.edge === "shoulder"; });
    if (shC.length !== 1 || shS.length !== 1) return bad("princess-shoulder-missing", "front");
    var sb0 = princessRot(shS[0].from, BP, -theta), sb1 = princessRot(shS[0].to, BP, -theta);
    var uC = { x: shC[0].to.x - shC[0].from.x, y: shC[0].to.y - shC[0].from.y }, uS = { x: sb1.x - sb0.x, y: sb1.y - sb0.y };
    var kinkDeg = Math.abs(Math.atan2(uC.x * uS.y - uC.y * uS.x, uC.x * uS.x + uC.y * uS.y)) * 180 / Math.PI; if (kinkDeg > 90) kinkDeg = 180 - kinkDeg;
    var shLenC = Math.hypot(uC.x, uC.y), shLenS = Math.hypot(shS[0].to.x - shS[0].from.x, shS[0].to.y - shS[0].from.y), shWhole = Math.hypot(SP.x - NP.x, SP.y - NP.y);
    out.front.shoulderKinkDeg = round4(kinkDeg); out.front.shoulderTotalCm = round4(shLenC + shLenS);
    if (!(kinkDeg <= PRINCESS_KINK_EPS) || !(Math.abs(shLenC + shLenS - shWhole) <= 1e-6)) return bad("princess-shoulder-kink", "front");
    // 밑단 폭 보존 · 면적 보존 · 겹침 없음
    if (!(Math.abs(hemWidth(FC) + hemWidth(FS) - hemWidth(wF)) <= 1e-6)) return bad("princess-hem-changed", "front");
    var rwF = yokeOrderRing(ringSegs(wF.outline).concat(ahLegs.map(function (sg) { return { kind: "line", from: cp(sg.from), to: cp(sg.to) }; })), YOKE_WHOLE_EPS);
    if (!rwF) return bad("princess-seam-missing", "front");
    var aWF = yokeRingMetrics(rwF).areaCm2, dF = 0.5 * widthA * (hemY - apexA.y);
    out.front.areaDeltaCm2 = round4(mets.frontCenter.areaCm2 + mets.frontSide.areaCm2 - (aWF - dF));
    if (!(Math.abs(out.front.areaDeltaCm2) <= PRINCESS_AREA_EPS)) return bad("princess-area-mismatch", "front");
    if (princessOverlap(rings.frontCenter, rings.frontSide)) return bad("princess-pieces-overlap", "front");

    // ── 뒤 ──
    var bSeamC = ringSegs(seamOf(BC)), bSeamS = ringSegs(seamOf(BS));
    if (bSeamC.length !== 4 || bSeamS.length !== 4 || !bSeamC.concat(bSeamS).every(function (sg) { return sg.kind === "line"; })) return bad("princess-seam-missing", "back");
    var shLegs = wholeLegs(wB, "back-shoulder"), weLegs = wholeLegs(wB, "back-waist-e");
    if (shLegs.length !== 2 || weLegs.length !== 2) return bad("princess-seam-missing", "back");
    var A1 = apexOfLeg(shLegs[0]), mouths = shLegs.map(farOf), cxB = cxOf(wB);
    var Mb = Math.abs(mouths[0].x - cxB) <= Math.abs(mouths[1].x - cxB) ? mouths[0] : mouths[1], Ma = Mb === mouths[0] ? mouths[1] : mouths[0];
    var endsOf = function (ls) { var o = []; ls.forEach(function (sg) { o.push(sg.from, sg.to); }); return o; };
    var hasPt = function (ls, q) { return endsOf(ls).some(function (e) { return Math.hypot(e.x - q.x, e.y - q.y) <= PRINCESS_POS_EPS; }); };
    if (!hasPt(bSeamC, Mb) || !hasPt(bSeamS, Ma) || !hasPt(bSeamC, A1) || !hasPt(bSeamS, A1)) return bad("princess-seam-position-mismatch", "back");   // 어깨 다트 입구에서 시작
    var lenBC = princessFlat(bSeamC), lenBS = princessFlat(bSeamS), legDiff = Math.abs(Math.hypot(Ma.x - A1.x, Ma.y - A1.y) - Math.hypot(Mb.x - A1.x, Mb.y - A1.y));
    out.back.seamLenCenterCm = round4(lenBC); out.back.seamLenSideCm = round4(lenBS); out.back.deltaCm = round4(lenBC - lenBS);
    if (!(Math.abs(Math.abs(lenBC - lenBS) - legDiff) <= PRINCESS_SEAM_EPS) || !(legDiff <= PRINCESS_LEG_EPS)) return bad("princess-seam-length-mismatch", "back");
    var fe1 = footOfLeg(weLegs[0]), fe2 = footOfLeg(weLegs[1]), widthE = Math.abs(fe1.x - fe2.x), apexE = apexOfLeg(weLegs[0]);
    var footAtB = function (ls) { return endsOf(ls).filter(function (q) { return Math.abs(q.y - fe1.y) <= PRINCESS_POS_EPS; })[0]; };
    var eC = footAtB(bSeamC), eS = footAtB(bSeamS);
    var HcB = endsOf(bSeamC).filter(function (q) { return Math.abs(q.y - hemY) <= PRINCESS_POS_EPS; })[0], HsB = endsOf(bSeamS).filter(function (q) { return Math.abs(q.y - hemY) <= PRINCESS_POS_EPS; })[0];
    if (!eC || !eS || !HcB || !HsB) return bad("princess-waist-dart-mismatch", "back");
    if (!(Math.abs(Math.abs(eC.x - eS.x) - widthE) <= PRINCESS_POS_EPS) || !(Math.abs((eC.x + eS.x) / 2 - A1.x) <= PRINCESS_POS_EPS) || !(Math.abs(HcB.x - A1.x) <= PRINCESS_POS_EPS) || !(Math.abs(HsB.x - A1.x) <= PRINCESS_POS_EPS)) return bad("princess-waist-dart-mismatch", "back");   // e 마름모는 이음선 축(어깨 다트 끝 x)에 맞춘다
    if (!hasPt(bSeamC, { x: A1.x, y: apexE.y }) || !hasPt(bSeamS, { x: A1.x, y: apexE.y })) return bad("princess-waist-dart-mismatch", "back");
    if (pv === "F") {
      var xe = pxm.back.e;
      if (!(xe.beforeCm > 0) || Math.abs(xe.extraCm - PRINCESS_F_EXTRA.e) > 1e-9 || Math.abs(xe.afterCm - xe.beforeCm - PRINCESS_F_EXTRA.e) > PRINCESS_POS_EPS || Math.abs(widthE - xe.afterCm) > PRINCESS_POS_EPS) return bad("princess-dart-extra-mismatch", "back");
      out.back.waistDartExtraCm = round4(widthE - xe.beforeCm); out.back.waistDartBeforeCm = round4(xe.beforeCm);
    }
    out.back.waistDartCm = round4(widthE); out.back.waistShiftCm = round4(A1.x - (fe1.x + fe2.x) / 2);
    if (!(Math.abs(hemWidth(BC) + hemWidth(BS) - hemWidth(wB)) <= 1e-6)) return bad("princess-hem-changed", "back");
    var shLenOf = function (pc) { var L = 0; pc.outline.forEach(function (sg) { if (sg && sg.edge === "shoulder") L += Math.hypot(sg.to.x - sg.from.x, sg.to.y - sg.from.y); }); return L; };
    out.back.shoulderTotalCm = round4(shLenOf(BC) + shLenOf(BS));
    if (!(Math.abs(shLenOf(BC) + shLenOf(BS) - shLenOf(wB)) <= 1e-6)) return bad("princess-shoulder-kink", "back");
    var rwB = yokeOrderRing(ringSegs(wB.outline).concat(shLegs.map(function (sg) { return { kind: "line", from: cp(sg.from), to: cp(sg.to) }; })), YOKE_WHOLE_EPS);
    if (!rwB) return bad("princess-seam-missing", "back");
    var aWB = yokeRingMetrics(rwB).areaCm2, dB = 0.5 * widthE * (hemY - apexE.y);
    out.back.areaDeltaCm2 = round4(mets.backCenter.areaCm2 + mets.backSide.areaCm2 - (aWB - dB));
    if (!(Math.abs(out.back.areaDeltaCm2) <= PRINCESS_AREA_EPS)) return bad("princess-area-mismatch", "back");
    if (princessOverlap(rings.backCenter, rings.backSide)) return bad("princess-pieces-overlap", "back");
    out.ok = true; out.reason = null;
    return out;
  }
  function princessCanon(proj) {
    var g = proj && proj.working && proj.working.geometry;
    if (!princessMode(g)) return null;
    var o = {}; ["frontCenter", "frontSide", "backCenter", "backSide"].forEach(function (k) { o[k] = canonOutline(g[k].outline); o[k + "c"] = canonOutline(g[k].construction || []); });
    return { pr: o };
  }

  // ── 검사 ──
  // ── 플레어 Ⓗ(P.21 · 처리 방법 P.161·P.163): Ⓖ + 진동 가장 안쪽 수직 절개 ──
  //   파라미터(body.flare·flareSlash·hemSideOffsetCm·waistDartScales)가 규칙이고, geometry.*.flareCm.slash 메타는 **신뢰하지 않는다** —
  //   ∅ = min(●−(3+■), ■) 를 메타의 ●·■ 로 다시 계산해 대조하고, 출력 외곽의 밑단 접선 연속 이음(cubic hem) 두 개의 현을 직접 재서 {∅, ■} 와 맞춘다.
  //   (● = 벌리기 전 가슴선 폭, 3 = 파라미터 hemSideOffsetCm, ■ = Ⓖ 밑단 벌림.) 없으면(Ⓖ 포함 다른 라인) null.
  var FLARE_SLASH_EPS = 1e-6;
  function flareSlashState(proj) {
    var g = proj && proj.working && proj.working.geometry;
    if (!g || !g.front || !g.back) return null;
    var pb = proj.working.parameters && proj.working.parameters.body;
    var wants = !!(pb && pb.flareSlash != null);
    var has = !!((g.front.flareCm && g.front.flareCm.slash) || (g.back.flareCm && g.back.flareCm.slash));
    if (!wants && !has) return null;
    var out = { front: { reason: null }, back: { reason: null }, ok: false, reason: null };
    var bad = function (reason, side) { out.ok = false; out.reason = reason; if (side && out[side]) out[side].reason = reason; return out; };
    if (!pb || pb.flareSlash !== true || pb.flare !== true) return bad("flare-slash-mismatch");
    var sc = pb.waistDartScales;
    if (!sc || ["a", "b", "d", "e"].some(function (k) { return sc[k] !== 0; })) return bad("flare-slash-waist-darts");   // 허리 다트는 남기지 않는다(Ⓖ 와 같은 몸판)
    if (g.frontPeplum || g.backPeplum || g.frontYoke || g.backYoke || g.shoulderYoke || g.frontCenter || g.backCenter) return bad("flare-slash-mismatch");
    var extra = typeof pb.hemSideOffsetCm === "number" ? pb.hemSideOffsetCm : 0;
    var sides = ["front", "back"];
    for (var i = 0; i < sides.length; i++) {
      var side = sides[i], pc = g[side], fc = pc.flareCm, m = fc && fc.slash, row = out[side];
      if (!m) return bad("flare-slash-missing", side);
      var nums = [m.bustWidthCm, m.dartSpreadCm, m.chordCm, m.formulaCm, m.cutLenCm];
      if (nums.some(function (v) { return typeof v !== "number" || !isFinite(v); }) || !(m.chordCm > 0)) return bad("flare-slash-mismatch", side);
      if (Math.abs(m.hemExtraCm - extra) > FLARE_SLASH_EPS || Math.abs(fc.spread - m.dartSpreadCm) > FLARE_SLASH_EPS) return bad("flare-slash-mismatch", side);
      var formula = m.bustWidthCm - (extra + m.dartSpreadCm), expect = Math.min(formula, m.dartSpreadCm);
      row.bustWidthCm = round4(m.bustWidthCm); row.dartSpreadCm = round4(m.dartSpreadCm); row.formulaCm = round4(formula);
      row.chordCm = round4(m.chordCm); row.expectedCm = round4(expect); row.clamped = formula > m.dartSpreadCm + 1e-12;
      if (Math.abs(m.formulaCm - formula) > FLARE_SLASH_EPS || Math.abs(m.chordCm - expect) > FLARE_SLASH_EPS) return bad("flare-slash-mismatch", side);   // ∅ 산식·상한 clamp
      if (!!m.clamped !== row.clamped || m.chordCm > m.dartSpreadCm + FLARE_SLASH_EPS) return bad("flare-slash-mismatch", side);
      // 출력 외곽의 접선 연속 밑단 이음 두 개(Ⓖ 의 ■ · Ⓗ 의 ∅) 현을 직접 잰다.
      var chords = [];
      (pc.outline || []).forEach(function (sg) {
        if (sg && sg.edge === "hem" && sg.kind === "path") { var e = endpointsOf(sg); if (e.length === 2) chords.push(Math.hypot(e[1].x - e[0].x, e[1].y - e[0].y)); }
      });
      chords.sort(function (a, b) { return a - b; });
      row.measuredChordsCm = chords.map(round4);
      if (chords.length !== 2 || Math.abs(chords[0] - expect) > FLARE_SLASH_EPS || Math.abs(chords[1] - m.dartSpreadCm) > FLARE_SLASH_EPS) return bad("flare-slash-hem-mismatch", side);
      // 기준점 = 출력 외곽 위의 점, 규칙은 앞 = 다트 입구 · 뒤 = 진동 극점
      if (m.rule !== (side === "front" ? "dart-mouth" : "armhole-innermost")) return bad("flare-slash-mismatch", side);
      var onOutline = false;
      (pc.outline || []).forEach(function (sg) { if (sg && sg.edge === "armhole") endpointsOf(sg).forEach(function (q) { if (Math.hypot(q.x - m.pivot.x, q.y - m.pivot.y) < 1e-3) onOutline = true; }); });
      if (!onOutline) return bad("flare-slash-pivot-off-armhole", side);
      var angle = 2 * Math.asin(m.chordCm / (2 * m.cutLenCm)) * 180 / Math.PI;
      row.angleDeg = round4(Math.abs(m.angleDeg));
      if (Math.abs(Math.abs(m.angleDeg) - angle) > 1e-6) return bad("flare-slash-mismatch", side);
      var r = yokeOrderRing(ringSegs(pc.outline || []));
      if (!r) return bad("flare-slash-open", side);
      var met = yokeRingMetrics(r);
      if (met.selfIntersects || !(met.areaCm2 > 0)) return bad("flare-slash-self-intersection", side);
      row.areaCm2 = round4(met.areaCm2); row.cutLenCm = round4(m.cutLenCm); row.rule = m.rule;
    }
    out.ok = true;
    return out;
  }

  // ── 목둘레 턱 Ⓘ(P.22 · 처리 방법 P.161): 다트를 닫고 목둘레 절개 2곳을 균등하게 벌린다 ──
  //   파라미터(body.neckTuck·waistDartScales 0)가 규칙이고, geometry.*.neckTuck 메타는 **신뢰하지 않는다** — 출력 외곽을 **그린 순서 그대로** 읽어
  //   (apex 에 선이 넷 모이므로 순서 재구성을 하지 않는다) 절개 틈 두 쌍(dart.id neck-tuck-1·2 의 열린 V)의 현·각을 직접 재고, 두 각이 같고(균등)
  //   그 합이 메타의 닫는 다트각과 같은지, 외곽이 닫혀 있고 자기교차가 없는지, 목둘레 호 길이가 메타와 같은지(절개는 길이를 안 바꾼다) 대조한다.
  //   미적용(다른 라인)이면 null.
  var NECK_TUCK_EPS = 1e-6;
  function neckTuckState(proj) {
    var g = proj && proj.working && proj.working.geometry;
    if (!g || !g.front || !g.back) return null;
    var pb = proj.working.parameters && proj.working.parameters.body;
    var wants = !!(pb && pb.neckTuck != null);
    var has = !!(g.front.neckTuck || g.back.neckTuck);
    if (!wants && !has) return null;
    var out = { front: { reason: null }, back: { reason: null }, ok: false, reason: null };
    var bad = function (reason, side) { out.ok = false; out.reason = reason; if (side && out[side]) out[side].reason = reason; return out; };
    var isJ = !!(pb && pb.neckTuck === "J");   // Ⓙ(P.23) = Ⓘ + 앞·뒤 중심 평행 띠
    if (!pb || (pb.neckTuck !== true && !isJ) || pb.flare || pb.waistSeam || pb.yokeSeam || pb.yokeGather || pb.princess || pb.peplumFlare || pb.peplumCut) return bad("neck-tuck-mismatch");   // false 는 «없음»(다른 프리셋 검사가 명시 false 를 얹기도 한다)
    var sc = pb.waistDartScales;
    if (!sc || ["a", "b", "d", "e"].some(function (k) { return sc[k] !== 0; })) return bad("neck-tuck-waist-darts");   // Ⓘ 는 허리 다트 없는 몸판(사용자 확정)
    if (g.frontPeplum || g.backPeplum || g.frontYoke || g.backYoke || g.shoulderYoke || g.frontCenter || g.backCenter) return bad("neck-tuck-mismatch");
    var sides = ["front", "back"], frontBandW = null;
    for (var i = 0; i < sides.length; i++) {
      var side = sides[i], pc = g[side], m = pc.neckTuck, row = out[side];
      if (!m || !Array.isArray(m.cuts) || m.cuts.length !== 2) return bad("neck-tuck-missing", side);
      if (isJ !== !!m.centerBand) return bad("neck-tuck-mismatch", side);   // 파라미터는 Ⓙ 인데 띠 메타가 없거나 그 반대
      if ([m.dartAngleRad, m.perCutAngleRad, m.neckLenCm, m.areaBeforeCm2, m.areaAfterCm2].some(function (v) { return typeof v !== "number" || !isFinite(v); })) return bad("neck-tuck-mismatch", side);
      var segs = [];   // ringSegs 는 edge·dart 를 버리므로 태그를 다시 붙인다(순서 그대로).
      (pc.outline || []).forEach(function (o) { ringSegs([o]).forEach(function (r) { r.edge = o.edge; r.dart = o.dart; segs.push(r); }); });
      var n = segs.length, closed = n > 2;
      for (var k = 0; k < n && closed; k++) if (Math.hypot(segs[k].to.x - segs[(k + 1) % n].from.x, segs[k].to.y - segs[(k + 1) % n].from.y) > 1e-4) closed = false;
      if (!closed) return bad("neck-tuck-open", side);
      var met = yokeRingMetrics(segs);
      if (met.selfIntersects || !(met.areaCm2 > 0)) return bad("neck-tuck-self-intersection", side);
      // 절개 틈 = 연속한 tuck-slit 두 선(목둘레 → apex → 목둘레). 정확히 두 쌍이어야 한다.
      var slitIdx = [];
      segs.forEach(function (sg, ix) { if (sg.dart && /^neck-tuck-[12]$/.test(sg.dart.id) && sg.dart.boundary === "neckline") slitIdx.push(ix); });
      if (slitIdx.length !== 4) return bad("neck-tuck-slit-count", side);
      var gaps = [];
      for (var q = 0; q < 4; q += 2) {
        var a = segs[slitIdx[q]], b = segs[slitIdx[q + 1]];
        if (slitIdx[q + 1] !== (slitIdx[q] + 1) % n || Math.hypot(a.to.x - b.from.x, a.to.y - b.from.y) > 1e-6) return bad("neck-tuck-slit-pair", side);
        var la = Math.hypot(a.from.x - a.to.x, a.from.y - a.to.y), lb = Math.hypot(b.from.x - b.to.x, b.from.y - b.to.y);
        if (Math.abs(la - lb) > 1e-6) return bad("neck-tuck-slit-unequal", side);   // 강체 회전이라 두 다리는 같은 길이
        var chord = Math.hypot(a.from.x - b.to.x, a.from.y - b.to.y);
        gaps.push({ chordCm: chord, lenCm: la, angleRad: 2 * Math.asin(chord / (2 * la)) });
      }
      if (Math.abs(gaps[0].angleRad - gaps[1].angleRad) > NECK_TUCK_EPS) return bad("neck-tuck-unequal-split", side);                       // 균등
      if (Math.abs(gaps[0].angleRad + gaps[1].angleRad - Math.abs(m.dartAngleRad)) > NECK_TUCK_EPS) return bad("neck-tuck-angle-mismatch", side);   // 합 = 닫는 다트각
      if (Math.abs(m.perCutAngleRad * 2 - m.dartAngleRad) > NECK_TUCK_EPS) return bad("neck-tuck-mismatch", side);
      for (var c = 0; c < 2; c++) if (Math.abs(m.cuts[c].gapChordCm - gaps[c].chordCm) > NECK_TUCK_EPS || Math.abs(m.cuts[c].lenCm - gaps[c].lenCm) > NECK_TUCK_EPS) return bad("neck-tuck-gap-mismatch", side);
      // 목둘레 호 길이 — 세 조각의 neckline 모서리 합 = 메타(절개가 길이를 바꾸지 않는다).
      var neckLen = 0;
      segs.forEach(function (sg) { if (sg.edge === "neckline") yokeFlatSeg(sg).forEach(function (ab) { neckLen += Math.hypot(ab[1].x - ab[0].x, ab[1].y - ab[0].y); }); });
      if (Math.abs(neckLen - m.neckLenCm) > 1e-3) return bad("neck-tuck-neckline-length", side);
      if (Math.abs(m.areaAfterCm2 - m.areaBeforeCm2) > 1) return bad("neck-tuck-area", side);
      if (side === "front") frontBandW = gaps[0].chordCm + gaps[1].chordCm;   // 띠 폭 T = 앞 목둘레 틈 합(앞·뒤 공통) — 메타가 아니라 출력 외곽에서 잰 값
      if (isJ) {
        // 중심 평행 띠 — 중심선(edge:"center")은 한 직선이고, 그 앞뒤의 edge 없는 수평 연결선 둘이 길이 T · 중심선에 직각 · 같은 쪽(바깥)이어야 한다.
        var cIdx = [];
        segs.forEach(function (sg, ix) { if (sg.edge === "center") cIdx.push(ix); });
        if (!cIdx.length) return bad("neck-tuck-band-center", side);
        for (var cj = 1; cj < cIdx.length; cj++) if (cIdx[cj] !== cIdx[0] + cj) return bad("neck-tuck-band-center", side);
        if (cIdx[0] === 0 || cIdx[cIdx.length - 1] === n - 1) return bad("neck-tuck-band-center", side);
        var cA = segs[cIdx[0]].from, cB = segs[cIdx[cIdx.length - 1]].to, cLen = Math.hypot(cB.x - cA.x, cB.y - cA.y);
        if (!(cLen > 1e-6)) return bad("neck-tuck-band-center", side);
        var du = { x: (cB.x - cA.x) / cLen, y: (cB.y - cA.y) / cLen };
        for (var cq = 0; cq < cIdx.length; cq++) {
          var cs = segs[cIdx[cq]], cl = Math.hypot(cs.to.x - cs.from.x, cs.to.y - cs.from.y);
          if (!(cl > 1e-9) || Math.abs((cs.to.x - cs.from.x) * du.y - (cs.to.y - cs.from.y) * du.x) / cl > 1e-6 || ((cs.to.x - cs.from.x) * du.x + (cs.to.y - cs.from.y) * du.y) < 0) return bad("neck-tuck-band-center", side);
        }
        var tp = segs[cIdx[0] - 1], bt = segs[cIdx[cIdx.length - 1] + 1];
        if (!tp || !bt || tp.edge || tp.dart || bt.edge || bt.dart || tp.kind !== "line" || bt.kind !== "line") return bad("neck-tuck-band-connector", side);
        var tv = { x: tp.to.x - tp.from.x, y: tp.to.y - tp.from.y }, bv = { x: bt.from.x - bt.to.x, y: bt.from.y - bt.to.y };   // 둘 다 «원래 중심 → 새 중심» 방향
        var tw = Math.hypot(tv.x, tv.y);
        if (Math.abs(tv.x * du.x + tv.y * du.y) > 1e-6 || Math.abs(bv.x * du.x + bv.y * du.y) > 1e-6 || Math.hypot(tv.x - bv.x, tv.y - bv.y) > 1e-6) return bad("neck-tuck-band-connector", side);   // 직각 · 위·아래 같은 이동
        if (Math.abs(tw - frontBandW) > 1e-6 || typeof m.centerBand.widthCm !== "number" || Math.abs(m.centerBand.widthCm - frontBandW) > 1e-6) return bad("neck-tuck-band-width", side);   // T = 앞 틈 합
        var cx = 0, cy = 0; segs.forEach(function (sg) { cx += sg.from.x; cy += sg.from.y; }); cx /= n; cy /= n;
        if (tv.x * (cx - tp.from.x) + tv.y * (cy - tp.from.y) >= 0) return bad("neck-tuck-band-direction", side);   // 바깥쪽이어야 한다(몸판 안쪽으로 밀면 겹친다)
        if (Math.abs(m.centerBand.centerLenCm - cLen) > 1e-6 || Math.abs(m.centerBand.areaAfterCm2 - m.areaAfterCm2 - tw * cLen) > 1e-6 * Math.max(1, m.areaAfterCm2)) return bad("neck-tuck-band-area", side);
        if (Math.abs(met.areaCm2 - (m.areaAfterCm2 + tw * cLen)) > 0.05) return bad("neck-tuck-band-area", side);   // 출력 외곽 면적 = Ⓘ 면적 + T × 중심선 길이 (곡선 평탄화 해상도 차이 0.02cm² 허용 — 폭·길이는 위에서 1e-6 으로 따로 잰다)
        row.bandWidthCm = round4(tw); row.bandLenCm = round4(cLen); row.bandAreaCm2 = round4(tw * cLen);
      }
      row.dartAngleDeg = round4(Math.abs(m.dartAngleRad) * 180 / Math.PI);
      row.gapChordsCm = gaps.map(function (x) { return round4(x.chordCm); });
      row.perCutAngleDeg = round4(gaps[0].angleRad * 180 / Math.PI);
      row.neckLenCm = round4(neckLen); row.areaCm2 = round4(met.areaCm2); row.depthCm = round4(m.depthCm);
    }
    out.ok = true;
    return out;
  }

  function check(proj) {
    proj = proj || project();
    if (!proj) return { ok: false, fails: ["no-project"] };
    var g = proj.working.geometry;
    var conF = connectivityOk(proj, "front"), conB = connectivityOk(proj, "back");
    // 옆선: 앞·뒤 각각 유효 외곽의 명시 side-seam. 한쪽이라도 측정 불가면 unmeasured(0cm 정합 금지)·완료 차단.
    var msF = measureSideSeam(effectiveOutline(proj, "front")), msB = measureSideSeam(effectiveOutline(proj, "back"));
    var ssMeasured = msF.status === "measured" && msB.status === "measured";
    var ssF = msF.length, ssB = msB.length, ssDiff = ssMeasured ? Math.abs(ssF - ssB) : null;
    var ssStatus = !ssMeasured ? "unmeasured" : ssDiff <= MATCH ? "match" : (ssDiff <= CHECK ? "check" : "mismatch");
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
    if (ssStatus === "unmeasured") fails.push("side-seam-unmeasured");
    if (ssStatus === "mismatch") fails.push("side-seam-mismatch");
    if (!ahF.ok) fails.push("front-armhole-unmeasured");
    if (!ahB.ok) fails.push("back-armhole-unmeasured");
    if (!(nkHalf > 0)) fails.push("neckline-unmeasured");
    if (manualBad) fails.push("neckline-preview-invalid");
    // v8(현재 의미) 원형 출처: 옆허리 다트 c 는 구조화 다트로 반드시 보존돼야 한다 — 손상 시 완료 차단.
    var svSrc = proj.sourceBlock && proj.sourceBlock.schemaVersion;
    var sideWaistDart = sideWaistDartOf({ front: dartRecords(proj, "front"), back: dartRecords(proj, "back"), shared: dartRecords(proj, "shared") });
    if (svSrc === 8 && !sideWaistDart.ok) fails.push(sideWaistDart.reason);
    // 허리 이음선 Ⓜ(있을 때만): 페플럼이 닫힌 한 장이고 상·하 허리 이음 길이가 맞아야 완료할 수 있다.
    var waistSeam = waistSeamState(proj);
    if (waistSeam && !waistSeam.ok) fails.push(waistSeam.reason);
    // 요크 이음선 Ⓠ(있을 때만): 네 조각을 출력 geometry 에서 재계산해 위반 시 완료를 막는다.
    var yokeSeam = yokeSeamState(proj);
    if (yokeSeam && !yokeSeam.ok) fails.push(yokeSeam.reason);
    // 프린세스 Ⓔ(있을 때만): 네 조각을 출력 geometry 에서 재계산해 위반 시 완료를 막는다.
    var princess = princessState(proj);
    if (princess && !princess.ok) fails.push(princess.reason);
    // 플레어 Ⓗ(있을 때만): ∅ 산식·상한·밑단 이음 현·폐곡선을 출력 geometry 에서 다시 계산한다.
    var flareSlash = flareSlashState(proj);
    if (flareSlash && !flareSlash.ok) fails.push(flareSlash.reason);
    // 목둘레 턱 Ⓘ(있을 때만): 절개 틈 두 쌍의 현·각·균등·합을 출력 geometry 에서 다시 잰다.
    var neckTuck = neckTuckState(proj);
    if (neckTuck && !neckTuck.ok) fails.push(neckTuck.reason);

    var out = {
      ok: fails.length === 0,
      fails: fails,
      connectivity: { front: conF, back: conB, ok: conF && conB },
      sideSeam: { front: ssF, back: ssB, diff: ssDiff, status: ssStatus },
      armhole: { front: ahF.len, back: ahB.len, ok: ahF.ok && ahB.ok },
      neckline: { front: nkF, back: nkB, half: nkHalf, finished: 2 * nkHalf, ok: nkHalf > 0 },
      previews: { neckline: !manualBad, placket: !placketBad, ok: previewOk },
      semantics: evaluateSemantics(proj),         // 완료 차단 아님 — 증거만
      sideWaistDart: sideWaistDart,   // v8 에서는 ok=false 면 fails 에 reason(완료 차단)
      waistSeam: waistSeam            // null = 허리 이음선 미적용(기존 몸판)
    };
    if (yokeSeam) out.yokeSeam = yokeSeam;   // 요크 이음선 적용 시에만 — 미적용이면 키 자체가 없다(기존 출력 바이트 동일)
    if (princess) out.princess = princess;   // 프린세스 적용 시에만 — 미적용이면 키 자체가 없다(기존 출력 바이트 동일)
    if (neckTuck) out.neckTuck = neckTuck;   // 목둘레 턱 Ⓘ 적용 시에만 — 미적용이면 키 자체가 없다(기존 출력 바이트 동일)
    if (flareSlash) out.flareSlash = flareSlash;   // 플레어 Ⓗ 적용 시에만 — 미적용이면 키 자체가 없다(기존 출력 바이트 동일)
    return out;
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
    var necklineProfile = proj.working.parameters && proj.working.parameters.neckline;
    var ahF = armholeLen(g, "front"), ahB = armholeLen(g, "back");
    // 소매가 참조할 형상 hash(형상 전용: 유효 외곽·진동·목둘레·여밈. 배치·선택·guide 제외).
    var placketParams = proj.working.frontPlacket ? proj.working.frontPlacket.parameters : null;
    var sig = signature(canonOutline(effF), canonOutline(effB), c.armhole, c.neckline, placketParams, peplumCanon(proj), yokeCanon(proj));
    var result = {
      sourceVersion: proj.sourceBlock ? proj.sourceBlock.version : null,
      hash: hashStr(sig),                                     // 소매 결과의 sourceBodiceHash 앵커
      front: { outline: clone(effF), construction: clone(g.front.construction || []) },
      back: { outline: clone(effB), construction: clone(g.back.construction || []) },
      // ★ 진동선 primitive 자체(소매는 길이값이 아니라 이 곡선을 참조). 앞은 다트로 2조각.
      armhole: { front: clone(ahF.segs), back: clone(ahB.segs) },
      armholeLengths: { front: round4(c.armhole.front), back: round4(c.armhole.back) },
      necklineLengths: { front: round4(c.neckline.front), back: round4(c.neckline.back), half: round4(c.neckline.half), finished: round4(c.neckline.finished) },
      // 칼라 F 같은 몸판-종속 제도가 형상 수치와 함께 확인할 명시적 목선 출처(형상 hash 미포함).
      necklineProfile: necklineProfile ? clone(necklineProfile) : null,
      placket: proj.working.frontPlacket ? clone(proj.working.frontPlacket) : null,
      // 허리 이음선 Ⓜ: 별개 조각으로 보존(없으면 null). front/back 은 upper 의미 그대로다.
      frontPeplum: g.frontPeplum ? { outline: clone(g.frontPeplum.outline), construction: clone(g.frontPeplum.construction || []) } : null,
      backPeplum: g.backPeplum ? { outline: clone(g.backPeplum.outline), construction: clone(g.backPeplum.construction || []) } : null,
      waistSeam: g.waistSeam ? clone(g.waistSeam) : null,
      // 편집 후 봉제 의미 readiness(복수 원인 보존). **hash signature 에 미포함** — 형상 identity 불변.
      semantics: evaluateSemantics(proj),
      completedAt: Date.now()
    };
    // 요크 이음선 Ⓠ: 네 조각·메타를 동결 복제 보존(없으면 키 자체를 두지 않는다 — 기존 완료본 바이트 동일).
    if (g.frontYoke && g.frontBody && g.backYoke && g.backBody) {
      ["frontYoke", "frontBody", "backYoke", "backBody"].forEach(function (k) {
        result[k] = { outline: clone(g[k].outline), construction: clone(g[k].construction || []) };
      });
      result.yokeSeam = g.yokeSeam ? clone(g.yokeSeam) : null;
    }
    else if (g.shoulderYoke && g.frontBody && g.backBody) {   // Ⓤ: 어깨 요크 한 장 + 앞·뒤 몸판(frontYoke/backYoke 키 없음)
      ["shoulderYoke", "frontBody", "backBody"].forEach(function (k) {
        result[k] = { outline: clone(g[k].outline), construction: clone(g[k].construction || []) };
      });
      result.yokeSeam = g.yokeSeam ? clone(g.yokeSeam) : null;
    }
    if (princessMode(g)) {   // 프린세스 Ⓔ: 중심·옆 네 조각·메타를 동결 복제 보존(없으면 키 자체를 두지 않는다 — 기존 완료본 바이트 동일)
      ["frontCenter", "frontSide", "backCenter", "backSide"].forEach(function (k) {
        result[k] = { outline: clone(g[k].outline), construction: clone(g[k].construction || []) };
      });
      result.princess = g.princess ? clone(g.princess) : null;
    }
    deepFreeze(result);
    proj.working.bodiceResult = result;   // 세션 전용(reload 시 소멸). reference·원본 불변.
    return { ok: true, result: result, check: c };
  }

  // 현재 몸판 상태 signature(스테일 판정용): 유효 외곽 + 진동/목둘레 + 여밈 파라미터.
  function signature(front, back, armhole, neckline, placketParams, pep, yk) {
    var o = {
      f: front, b: back,
      ah: { f: round4(armhole.front), b: round4(armhole.back) },
      nk: { h: round4(neckline.half) },
      pk: placketParams
    };
    if (pep) o.pp = pep;   // 페플럼이 있을 때만 — 없으면 기존 hash 와 바이트 단위로 같다
    if (yk) o.yk = yk;     // 요크 이음선 조각이 있을 때만 — 없으면 기존 hash 와 바이트 단위로 같다
    return JSON.stringify(o);
  }
  function currentSignature(proj) {
    var c = check(proj);
    var placketParams = proj.working.frontPlacket ? proj.working.frontPlacket.parameters : null;
    return signature(canonOutline(effectiveOutline(proj, "front")), canonOutline(effectiveOutline(proj, "back")), c.armhole, c.neckline, placketParams, peplumCanon(proj), yokeCanon(proj));
  }
  function snapshotSignature(res) {
    return signature(canonOutline(res.front.outline), canonOutline(res.back.outline),
      { front: res.armholeLengths.front, back: res.armholeLengths.back },
      { half: res.necklineLengths.half }, res.placket ? res.placket.parameters : null,
      (res.frontPeplum && res.backPeplum) ? { f: canonOutline(res.frontPeplum.outline), b: canonOutline(res.backPeplum.outline) } : null,
      (res.frontCenter && res.frontSide && res.backCenter && res.backSide) ? (function () {
        var o = {}; ["frontCenter", "frontSide", "backCenter", "backSide"].forEach(function (k) { o[k] = canonOutline(res[k].outline); o[k + "c"] = canonOutline(res[k].construction || []); });
        return { pr: o };
      })()
      : (res.shoulderYoke && res.frontBody && res.backBody) ? { sy: canonOutline(res.shoulderYoke.outline), syc: canonOutline(res.shoulderYoke.construction || []), fb: canonOutline(res.frontBody.outline), fbc: canonOutline(res.frontBody.construction || []), bb: canonOutline(res.backBody.outline), bbc: canonOutline(res.backBody.construction || []) }
      : (res.frontYoke && res.frontBody && res.backYoke && res.backBody) ? (function () {
        var o = { fy: canonOutline(res.frontYoke.outline), fb: canonOutline(res.frontBody.outline), by: canonOutline(res.backYoke.outline), bb: canonOutline(res.backBody.outline) };
        if (res.backYoke.construction && res.backYoke.construction.length) o.byc = canonOutline(res.backYoke.construction);
        return o;
      })() : null);
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

  window.bodiceCheckpoint = Object.freeze({ girthMeasure: girthMeasure, waistSeamState: waistSeamState, yokeSeamState: yokeSeamState, princessState: princessState, flareSlashState: flareSlashState, neckTuckState: neckTuckState, measureSideSeam: measureSideSeam, closedOutlineWithDeclaredDartJunctions: closedOutlineWithDeclaredDartJunctions, evaluateSemantics: evaluateSemantics, makeBoundaryChain: makeBoundaryChain, check: check, complete: complete, latest: latest, isCurrentBodiceChanged: isCurrentBodiceChanged });
})();
