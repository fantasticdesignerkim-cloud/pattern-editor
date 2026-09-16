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
//   - data-edge 는 의미 모서리로, front/back outline 에만 허용하며 primitive.edge 로
//     snapshot 에 저장한다. 중복 판정에서는 제외하고 canonical hash/identity 에는 포함된다.
//     · SV2(schemaVersion 2) = 구조 모서리 center/waist/side-seam
//     · SV3(schemaVersion 3) = 위 + 봉제 경계 의미 neckline/shoulder/armhole
//       shoulder/armhole/neckline 은 **여러 연속 span 으로 나뉠 수 있다**(다트 intake 등).
//       span 수를 고정하지 않고, 배열 위치·primitive 종류를 identity 로 쓰지 않는다.
//   - v3 정상 캡처는 **필수 semantic coverage 를 강제**한다(신규 semantic 없이 통과하는
//     optional schema 가 아니다). 구형 v2 완료본의 수용·legacy 표시는 designProject 의 몫.
//   - SV5(schemaVersion 5, P0.3a) = 위 + 봉제 경계 안정 identity. 의미를 아는 생산자가 선언한
//     data-boundary-root / data-boundary-ranges 를 primitive.boundary = { root, ranges } 로 싣는다.
//     ranges 는 **그리기 명령마다 하나**(line 1 · path 의 C 수)이며 root 위 [from,to] 구간이다.
//     좌표·배열 index 로 root 를 만들거나 없는 identity 를 채우지 않는다. v5 정상 캡처는 front/back
//     outline 의 모든 의미 모서리 primitive 가 root 와 일치하는 boundary 를 가져야 한다.
//   - SV6(schemaVersion 6, P0.3b) = 위 + 다트 다리 경계 attachment. 다리마다 생산자가 선언한
//     data-dart-attach-root / -t 를 dart.attach = { root, t } 로 싣고, root 의미가 다트 boundary 와
//     같으며 t 가 [0,1] 이고 **같은 캡처의 그 root 경계 구간이 t 를 덮는지** 검증한다(좌표 복원 없음).
//   - SV7(schemaVersion 7) = 위 + 옆선 허리 조임 승격. 앞판 옆선·허리는 SIDE_TOP→FRONT_SIDE_WL,
//     뒤판은 SIDE_TOP→BACK_SIDE_WL 로 끝나고(draft 단일 원천), 옆선 조임 c 는 구조화 다트가 아니다.
//     v6 이하 완료본은 중앙 옆선 + c 다트 형상이라 designProject 가 legacy 로만 받는다.
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
  // 의미 모서리(semantic edge). front/back outline 에만 허용한다.
  var ALLOWED_EDGE = {
    center: 1, waist: 1, "side-seam": 1,           // SV2 구조 모서리
    neckline: 1, shoulder: 1, armhole: 1           // SV3 봉제 경계 의미
  };
  // 앞·뒤 각 조각 outline 이 반드시 가져야 하는 의미 모서리(topology junction 근거).
  var REQUIRED_EDGE_PIECES = ["front", "back"];
  var REQUIRED_EDGES = ["center", "waist", "side-seam"];
  // SV3 정상 coverage: 위에 더해 봉제 경계 의미가 앞·뒤 각각 최소 1 span 씩 있어야 한다.
  var REQUIRED_SEAM_EDGES = ["neckline", "shoulder", "armhole"];
  // SV4: 구조화 다트 의미(P0.2). 다리 primitive 가 **생산 지점에서 선언한** 값만 싣는다 —
  //   좌표·배열 순서로 apex/leg/intake/target boundary 를 추론하지 않는다.
  var ALLOWED_DART_BOUNDARY = { neckline: 1, shoulder: 1, armhole: 1, waist: 1, "side-seam": 1, center: 1, hem: 1 };
  var ALLOWED_APEX_AT = { from: 1, to: 1 };
  // SV5: root 경계 ID → 그 root 가 속하는 의미 모서리. piece 접두어는 primitive 의 piece 와 같아야 한다.
  var BOUNDARY_ROOT_EDGE = {
    center: "center", waist: "waist", "side-seam": "side-seam",
    neckline: "neckline", shoulder: "shoulder",
    "shoulder-neck": "shoulder", "shoulder-armhole": "shoulder",
    armhole: "armhole", "armhole-upper": "armhole", "armhole-lower": "armhole"
  };
  var BOUNDARY_RANGE_EPS = 1e-6;   // root 구간 [0,1] 계약의 수치 허용치
  var SCHEMA_VERSION = 7;

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
    // SV5: 경계 identity 선언이 있을 때만 담는다. 명령 수와 구간 수가 다르면 명시적 실패.
    var bRoot = el.getAttribute("data-boundary-root");
    var bRanges = el.getAttribute("data-boundary-ranges");
    if (bRoot !== null || bRanges !== null) {
      if (!bRoot || !bRanges) fail("bad-boundary", String(bRoot) + "/" + String(bRanges));
      var ranges = bRanges.split(";").map(function (pair) {
        var ab = pair.split(",").map(Number);
        if (ab.length !== 2 || !isFinite(ab[0]) || !isFinite(ab[1]) || ab[0] === ab[1]) fail("bad-boundary-range", pair);
        // root 파라미터 계약 [0,1] — 부동소수 오차(BOUNDARY_RANGE_EPS)만 허용한다.
        if (ab.some(function (v) { return v < -BOUNDARY_RANGE_EPS || v > 1 + BOUNDARY_RANGE_EPS; })) fail("boundary-range-out-of-bounds", pair);
        return [ab[0], ab[1]];
      });
      var cmdCount = (prim.kind === "line") ? 1 : prim.commands.filter(function (c) { return c.type === "C"; }).length;
      if (ranges.length !== cmdCount) fail("boundary-range-count", bRoot + " ranges=" + ranges.length + " commands=" + cmdCount);
      prim.boundary = { root: bRoot, ranges: ranges };
    }
    // SV2: data-edge 가 있을 때만 조건부로 담는다(없으면 own-property 자체가 없다).
    var edge = el.getAttribute("data-edge");
    if (edge) prim.edge = edge;
    // SV4: 다트 의미도 선언돼 있을 때만 담는다(없으면 만들어 넣지 않는다).
    var dartId = el.getAttribute("data-dart-id");
    if (dartId) {
      var dart = { id: dartId };
      var bnd = el.getAttribute("data-dart-boundary"); if (bnd) dart.boundary = bnd;
      var ax = el.getAttribute("data-dart-apex-at"); if (ax) dart.apexAt = ax;
      if (el.getAttribute("data-dart-on-fold") === "true") dart.onFold = true;
      var atRoot = el.getAttribute("data-dart-attach-root"), atT = el.getAttribute("data-dart-attach-t");
      if (atRoot !== null || atT !== null) {
        var tv = Number(atT);
        if (!atRoot || atT === null || !isFinite(tv) || tv < -BOUNDARY_RANGE_EPS || tv > 1 + BOUNDARY_RANGE_EPS) fail("bad-dart-attachment", String(atRoot) + "@" + String(atT));
        dart.attach = { root: atRoot, t: tv };
      }
      prim.dart = dart;
    }
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

  // primitive 의 선언된 apex / boundary leg endpoint 를 돌려준다(선언 기반, 추론 아님).
  function dartEnds(prim) {
    var ks = edgeEndpointKeys(prim);
    return (prim.dart.apexAt === "from") ? { apex: ks[0], leg: ks[1] } : { apex: ks[1], leg: ks[0] };
  }
  // SV6: 다트 다리 attachment — 선언 존재 · root 의미 = 다트 boundary · root piece 가 다리 piece 와 정합
  //   (shared 다트는 앞/뒤 어느 쪽 root 든 가능) · 같은 캡처에서 그 root 의 경계 구간이 t 를 덮는다.
  function rootCoversT(geometry, root, t) {
    var pc = root.slice(0, root.indexOf("/"));
    if (!geometry[pc]) return false;
    return geometry[pc].outline.some(function (prm) {
      if (!prm.boundary || prm.boundary.root !== root) return false;
      return prm.boundary.ranges.some(function (r) {
        return t >= Math.min(r[0], r[1]) - BOUNDARY_RANGE_EPS && t <= Math.max(r[0], r[1]) + BOUNDARY_RANGE_EPS;
      });
    });
  }
  function validateDartAttachments(geometry) {
    ["front", "back", "shared"].forEach(function (pc) {
      ["outline", "construction"].forEach(function (rl) {
        geometry[pc][rl].forEach(function (prm) {
          if (!prm.dart) return;
          var at = prm.dart.attach;
          if (!at) fail("missing-dart-attachment", pc + "/" + prm.dart.id);
          var slash = at.root.indexOf("/"), rp = at.root.slice(0, slash), rn = at.root.slice(slash + 1);
          if (slash < 0 || !(rp === "front" || rp === "back") || !BOUNDARY_ROOT_EDGE[rn]) fail("bad-dart-attachment", at.root);
          if (pc !== "shared" && rp !== pc) fail("dart-attachment-mismatch", pc + "/" + prm.dart.id + " root=" + at.root);
          if (prm.dart.boundary && BOUNDARY_ROOT_EDGE[rn] !== prm.dart.boundary) fail("dart-attachment-mismatch", prm.dart.id + " boundary=" + String(prm.dart.boundary) + " root=" + at.root);
          if (!rootCoversT(geometry, at.root, at.t)) fail("dart-attachment-uncovered", prm.dart.id + " " + at.root + "@" + at.t);
        });
      });
    });
  }
  // SV4: piece × dartId 그룹의 다리 수와 apex 일치를 검증한다.
  function validateDarts(geometry) {
    ["front", "back", "shared", "sleeve"].forEach(function (pc) {
      var groups = {};
      ["outline", "construction"].forEach(function (rl) {
        geometry[pc][rl].forEach(function (prm) {
          if (!prm.dart) return;
          (groups[prm.dart.id] = groups[prm.dart.id] || []).push(prm);
        });
      });
      Object.keys(groups).forEach(function (id) {
        var legs = groups[id], onFold = legs.some(function (l) { return l.dart.onFold; });
        var want = onFold ? 1 : 2;
        if (legs.length !== want) fail("dart-legs-invalid", pc + "/" + id + " legs=" + legs.length + " want=" + want);
        var apexKeys = {};
        legs.forEach(function (l) { apexKeys[dartEnds(l).apex] = 1; });
        if (Object.keys(apexKeys).length !== 1) fail("dart-apex-mismatch", pc + "/" + id);
      });
    });
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
      // SV4: 다트 의미 값 검증(위치는 outline=적용 다트 다리 / construction=gen-0 다트 둘 다 허용).
      var dIdAttr = el.getAttribute("data-dart-id");
      if (dIdAttr !== null) {
        if (piece === "sleeve") fail("dart-placement", piece);
        var bAttr = el.getAttribute("data-dart-boundary");
        if (bAttr !== null && !ALLOWED_DART_BOUNDARY[bAttr]) fail("bad-dart-boundary", bAttr);
        var aAttr = el.getAttribute("data-dart-apex-at");
        if (aAttr === null || !ALLOWED_APEX_AT[aAttr]) fail("bad-dart-apex-at", String(aAttr));
      }
      // SV5: boundary identity 는 front/back outline 에만 둔다.
      if (el.getAttribute("data-boundary-root") !== null && !((piece === "front" || piece === "back") && role === "outline")) {
        fail("boundary-placement", piece + "/" + role);
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
    // SV3: 더해서 neckline/shoulder/armhole 이 각각 최소 1 span 있는지(span 수는 고정 안 함).
    for (var pi = 0; pi < REQUIRED_EDGE_PIECES.length; pi++) {
      var pc = REQUIRED_EDGE_PIECES[pi];
      var have = {};
      geometry[pc].outline.forEach(function (prm) { if (prm.edge) have[prm.edge] = 1; });
      for (var ei = 0; ei < REQUIRED_EDGES.length; ei++) {
        if (!have[REQUIRED_EDGES[ei]]) fail("missing-required-edge", pc + "/" + REQUIRED_EDGES[ei]);
      }
      for (var si = 0; si < REQUIRED_SEAM_EDGES.length; si++) {
        if (!have[REQUIRED_SEAM_EDGES[si]]) fail("missing-seam-edge", pc + "/" + REQUIRED_SEAM_EDGES[si]);
      }
    }
    // SV5: 의미 모서리 primitive 마다 root identity 가 있고, root 의 piece·edge 가 primitive 와 일치해야 한다.
    for (var pb = 0; pb < REQUIRED_EDGE_PIECES.length; pb++) {
      var pcb = REQUIRED_EDGE_PIECES[pb];
      geometry[pcb].outline.forEach(function (prm) {
        if (!prm.boundary) {
          if (prm.edge) fail("missing-boundary-identity", pcb + "/" + prm.edge);
          return;
        }
        var slash = prm.boundary.root.indexOf("/");
        var rp = prm.boundary.root.slice(0, slash), rn = prm.boundary.root.slice(slash + 1);
        if (slash < 0 || rp !== pcb || !BOUNDARY_ROOT_EDGE[rn]) fail("bad-boundary-root", prm.boundary.root);
        if (BOUNDARY_ROOT_EDGE[rn] !== prm.edge) fail("boundary-edge-mismatch", prm.boundary.root + " edge=" + String(prm.edge));
      });
    }
    // SV4: 다트 그룹 일관성 — 같은 id 의 다리들이 **선언한 apex 끝점이 실제로 일치**하는지 확인한다
    //   (일치 여부 검증이지, 좌표로 apex 를 찾아내는 추론이 아니다). onFold 면 다리 1개, 아니면 2개.
    validateDarts(geometry);
    validateDartAttachments(geometry);
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

    return { schemaVersion: SCHEMA_VERSION, source: source, geometry: geometry };
  }

  window.captureBlockSnapshot = captureBlockSnapshot;
})();
