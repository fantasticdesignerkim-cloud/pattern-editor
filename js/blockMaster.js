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
    if (tag === "line") {
      return {
        kind: "line",
        from: toDraft(+el.getAttribute("x1"), +el.getAttribute("y1")),
        to: toDraft(+el.getAttribute("x2"), +el.getAttribute("y2"))
      };
    }
    if (tag === "path") {
      return { kind: "path", commands: parsePathCommands(el.getAttribute("d") || "") };
    }
    fail("unsupported-primitive-tag", tag);
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
      var prim = primitiveOf(el);
      var id = piece + "|" + role + "|" + canonical(prim);
      if (seen[id]) fail("duplicate-primitive", id);
      seen[id] = 1;
      geometry[piece][role].push(prim);
    }
    for (var j = 0; j < REQUIRED_OUTLINE.length; j++) {
      var p = REQUIRED_OUTLINE[j];
      if (geometry[p].outline.length === 0) fail("empty-required-outline", p);
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

    return { schemaVersion: 1, source: source, geometry: geometry };
  }

  window.captureBlockSnapshot = captureBlockSnapshot;
})();
