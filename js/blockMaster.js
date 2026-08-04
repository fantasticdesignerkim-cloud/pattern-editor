// ══════════════════════════════════════════════
// js/blockMaster.js — 블록마스터(원형) 데이터 캡처 1단계
//
// 공개 함수: captureBlockSnapshot()
//   현재 원형 상태를 순수 데이터 스냅샷으로 반환한다. 저장(localStorage/파일)·
//   렌더·UI·stage 이동·reference 렌더는 하지 않는다. 실패 시 부분 스냅샷을
//   반환하지 않고 Error 를 throw 한다(명시적 실패).
//
// 이번 단계에서 넣지 않는 것: id / version / completedAt / designProject
//   (이 값들은 실제 "원형 완료" 동작에서 정한다.)
//
// 불변식:
//   - snapshot 은 deep clone + 참조 분리(반환 객체를 변형해도 state/DOM 불변).
//   - 반환 객체에 DOM 요소·함수·CSS class·style·카메라(view) 상태를 넣지 않는다.
//   - data-piece / data-geometry-role 은 분류에만 쓰고 snapshot 에 저장하지 않는다.
//   - (SV2, schemaVersion 2) data-edge 는 의미 모서리(center/waist/side-seam)로,
//     front/back outline 에만 허용하며 primitive.edge 로 snapshot 에 저장한다.
//     중복 판정에서는 제외하고 canonical hash/identity 에는 포함된다.
//   - 좌표는 원본 정밀도를 보존하고, 정규화는 hash/중복 판정(canonical)에서만 한다.
//   - workMode 만 제한된 transaction 으로 all 로 바꿔 수집하고 finally 에서 원복한다.
//     전역 state 에 snapshot source 를 임시 주입하지 않는다.
// ══════════════════════════════════════════════
(function () {
  "use strict";

  var ALLOWED_PIECE = { front: 1, back: 1, shared: 1, sleeve: 1 };
  var ALLOWED_ROLE = { outline: 1, construction: 1 };
  // shared.outline 은 A안대로 비어 있을 수 있으므로 필수에서 제외한다.
  var REQUIRED_OUTLINE = ["front", "back", "sleeve"];
  // SV2 의미 모서리(semantic edge). front/back outline 에만 허용한다.
  var ALLOWED_EDGE = { center: 1, waist: 1, "side-seam": 1 };
  // 앞·뒤 각 조각 outline 이 반드시 가져야 하는 의미 모서리(topology junction 근거).
  var REQUIRED_EDGE_PIECES = ["front", "back"];
  var REQUIRED_EDGES = ["center", "waist", "side-seam"];

  function fail(reason, detail) {
    var e = new Error("captureBlockSnapshot 실패: " + reason);
    e.reason = reason;
    if (detail !== undefined) e.detail = detail;
    throw e;
  }

  function deepClone(v) {
    if (v === null || v === undefined) return v;
    if (typeof structuredClone === "function") return structuredClone(v);
    return JSON.parse(JSON.stringify(v));
  }

  // 화면 px → 도안 좌표(p2c_). 원본 정밀도 보존(반올림 없음).
  function toDraft(x, y) {
    if (!isFinite(x) || !isFinite(y)) fail("coord-not-finite", [x, y]);
    var c = p2c_(x, y);
    return { x: c[0], y: c[1] };
  }

  // path d 파싱 → commands. M/C 만 허용, 그 외 명령이면 실패한다.
  function parsePathCommands(d) {
    var tokens = String(d).match(/[A-Za-z]|-?\d*\.?\d+(?:[eE][-+]?\d+)?/g) || [];
    var cmds = [];
    var i = 0;
    while (i < tokens.length) {
      var tok = tokens[i];
      if (/[A-Za-z]/.test(tok)) {
        if (tok !== "M" && tok !== "C") fail("non-mc-path-command", tok);
        i++;
        var count = (tok === "M") ? 1 : 3;
        var points = [];
        for (var k = 0; k < count; k++) {
          var x = Number(tokens[i++]);
          var y = Number(tokens[i++]);
          points.push(toDraft(x, y));
        }
        cmds.push({ type: tok, points: points });
      } else {
        // 명령 문자 없이 숫자가 선행하면 형식 위반(우리 렌더는 항상 명령 문자를 붙인다).
        fail("path-parse-unexpected-number", tok);
      }
    }
    if (cmds.length === 0) fail("empty-path", d);
    return cmds;
  }

  function primitiveOf(el) {
    var tag = el.tagName.toLowerCase();
    var prim;
    if (tag === "line") {
      prim = {
        kind: "line",
        from: toDraft(+el.getAttribute("x1"), +el.getAttribute("y1")),
        to: toDraft(+el.getAttribute("x2"), +el.getAttribute("y2"))
      };
    } else if (tag === "path") {
      prim = { kind: "path", commands: parsePathCommands(el.getAttribute("d") || "") };
    } else {
      fail("unsupported-primitive-tag", tag);
    }
    // SV2: data-edge 가 있을 때만 조건부로 담는다(없으면 own-property 자체가 없다).
    var edge = el.getAttribute("data-edge");
    if (edge) prim.edge = edge;
    return prim;
  }

  // hash / 중복 판정용 canonicalization. 저장 primitive 는 원본 정밀도를 유지한다.
  function canonical(prim) {
    var r = function (v) { return Math.round(v * 1e4) / 1e4; };
    if (prim.kind === "line") {
      return "L|" + [r(prim.from.x), r(prim.from.y), r(prim.to.x), r(prim.to.y)].join(",");
    }
    return "P|" + prim.commands.map(function (c) {
      return c.type + ":" + c.points.map(function (p) { return r(p.x) + "," + r(p.y); }).join(" ");
    }).join(";");
  }

  function emptyGeometry() {
    var bucket = function () { return { outline: [], construction: [] }; };
    return { front: bucket(), back: bucket(), shared: bucket(), sleeve: bucket() };
  }

  // primitive 끝점 두 개를 1e-4 정규화 키로 반환한다(line: from/to, path: 첫 M·마지막 점).
  function edgeEndpointKeys(prim) {
    var r = function (v) { return Math.round(v * 1e4) / 1e4; };
    var k = function (p) { return r(p.x) + "," + r(p.y); };
    if (prim.kind === "line") return [k(prim.from), k(prim.to)];
    var cmds = prim.commands;
    var first = cmds[0].points[0];
    var lastPts = cmds[cmds.length - 1].points;
    var last = lastPts[lastPts.length - 1];
    return [k(first), k(last)];
  }

  // 두 의미 모서리 집합의 공유 끝점(공통점) 개수를 센다. 정확히 1개여야 junction 이 유일하다.
  function commonEndpoints(outline, edgeA, edgeB) {
    var setA = {}, setB = {};
    for (var i = 0; i < outline.length; i++) {
      var p = outline[i];
      if (p.edge === edgeA) edgeEndpointKeys(p).forEach(function (key) { setA[key] = 1; });
      if (p.edge === edgeB) edgeEndpointKeys(p).forEach(function (key) { setB[key] = 1; });
    }
    var common = [];
    Object.keys(setA).forEach(function (key) { if (setB[key]) common.push(key); });
    return common;
  }

  // 앞·뒤 각 조각에서 center∩waist, side-seam∩waist junction 이 유일한지 검증한다.
  function validateJunctions(outline, piece) {
    var pairs = [["center", "waist"], ["side-seam", "waist"]];
    for (var i = 0; i < pairs.length; i++) {
      var a = pairs[i][0], b = pairs[i][1];
      var common = commonEndpoints(outline, a, b);
      var label = piece + " " + a + "∩" + b;
      if (common.length === 0) fail("missing-topology-junction", label);
      if (common.length > 1) fail("ambiguous-topology-junction", label);
    }
  }

  // all 상태 DOM 에서 봉제 형상 표식 요소를 수집·검증한다. 실패 시 throw(부분 반환 없음).
  function collectGeometry() {
    var svg = document.getElementById("cv");
    var geometry = emptyGeometry();
    var seen = {};
    var els = svg.querySelectorAll("[data-piece][data-geometry-role]");
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var piece = el.getAttribute("data-piece");
      var role = el.getAttribute("data-geometry-role");
      if (!ALLOWED_PIECE[piece]) fail("bad-piece", piece);
      if (!ALLOWED_ROLE[role]) fail("bad-role", role);
      // SV2: data-edge 검증 — 값은 화이트리스트, 위치는 front/back outline 에만.
      var edgeAttr = el.getAttribute("data-edge");
      if (edgeAttr !== null) {
        if (!ALLOWED_EDGE[edgeAttr]) fail("bad-edge", edgeAttr);
        var frontOrBack = (piece === "front" || piece === "back");
        if (!(frontOrBack && role === "outline")) fail("edge-placement", piece + "/" + role);
      }
      var prim = primitiveOf(el);
      // 중복 판정 키는 edge 를 제외한다(같은 형상·다른 edge 는 중복으로 잡는다).
      var id = piece + "|" + role + "|" + canonical(prim);
      if (seen[id]) fail("duplicate-primitive", id);
      seen[id] = 1;
      geometry[piece][role].push(prim);
    }
    for (var j = 0; j < REQUIRED_OUTLINE.length; j++) {
      var p = REQUIRED_OUTLINE[j];
      if (geometry[p].outline.length === 0) fail("empty-required-outline", p);
    }
    // SV2: 앞·뒤 각 조각 outline 이 center/waist/side-seam 을 모두 가지는지(coverage).
    for (var pi = 0; pi < REQUIRED_EDGE_PIECES.length; pi++) {
      var pc = REQUIRED_EDGE_PIECES[pi];
      var have = {};
      geometry[pc].outline.forEach(function (prm) { if (prm.edge) have[prm.edge] = 1; });
      for (var ei = 0; ei < REQUIRED_EDGES.length; ei++) {
        if (!have[REQUIRED_EDGES[ei]]) fail("missing-required-edge", pc + "/" + REQUIRED_EDGES[ei]);
      }
    }
    // SV2: 앞·뒤 각 조각의 center∩waist / side-seam∩waist junction 유일성.
    for (var pj = 0; pj < REQUIRED_EDGE_PIECES.length; pj++) {
      validateJunctions(geometry[REQUIRED_EDGE_PIECES[pj]].outline, REQUIRED_EDGE_PIECES[pj]);
    }
    return geometry;
  }

  function collectSource() {
    var sel = document.getElementById("selCapFormula");
    return {
      measurements: {
        B: n("inpB"), W: n("inpW"), BL: n("inpBL"),
        SL: n("inpSL"), Hem: n("inpHem"),
        capAdj: n("inpCapAdj"),
        capFormula: sel ? sel.value : null,
        dartTotal: n("inpDart")
      },
      handles: {
        armH: deepClone(state.armH),
        fArmH: deepClone(state.fArmH),
        bNeckH: deepClone(state.bNeckH),
        fNeckH: deepClone(state.fNeckH),
        sleeveH: deepClone(state.sleeveH)
      },
      appliedDarts: {
        front: deepClone(typeof dartMoveState !== "undefined" ? dartMoveState.appliedFront : null),
        back: deepClone(typeof dartMoveState !== "undefined" ? dartMoveState.appliedBack : null)
      }
    };
  }

  function captureBlockSnapshot() {
    // ── precondition (transaction 전) ──
    // 1. dart busy 면 명시적 실패
    if (typeof dartMoveState !== "undefined" && dartMoveState.active) fail("dart-busy");
    if (typeof state === "undefined") fail("no-state");
    // 2. arm/neck/sleeve edit busy 면 명시적 실패
    if (state.armEditMode || state.neckEditMode || state.sleeveEditMode) fail("edit-busy");
    // 3. 필수 입력·핸들·SVG 준비 확인
    if (!n("inpB") || !n("inpW") || !n("inpBL")) fail("missing-measurements");
    if (!state.armH || !state.fArmH || !state.bNeckH || !state.fNeckH || !state.sleeveH) {
      fail("missing-handles");
    }
    if (!document.getElementById("cv")) fail("no-svg");

    // source 는 렌더 무관 데이터라 transaction 밖에서 현재 상태로 수집한다(deep clone).
    var source = collectSource();

    // ── workMode transaction: all 로 수집 후 원복 ──
    // 동기 실행이라 브라우저는 중간 all 화면을 페인트하지 않는다(플래시 없음).
    var prevMode = state.workMode;
    var geometry;
    try {
      // setWorkMode 는 내부에서 render() 를 호출한다(all-parts DOM 보장).
      if (state.workMode !== "all") setWorkMode("all");
      else render();
      geometry = collectGeometry(); // 실패 시 throw → 부분 snapshot 반환 안 됨
    } finally {
      // 4. finally 에서 previous mode 와 화면 복원
      if (state.workMode !== prevMode) setWorkMode(prevMode);
      else render();
    }

    return { schemaVersion: 2, source: source, geometry: geometry };
  }

  window.captureBlockSnapshot = captureBlockSnapshot;
})();
