// ══════════════════════════════════════════════
// js/designBodice.js — DB1a: 몸판 grain-기준 길이 연장 순수 변환 (계산만).
//
// referenceGeometry(원형 완료본의 snapshot geometry, SV2 edge 포함)를 입력받아
// "허리 아래 길이(L)" 만큼 연장한 **새 geometry** 를 반환한다. project·render·
// uiState·storage·DOM 에 접근하지 않는다(순수 함수). working.geometry 대입과 UI
// 연결은 DB1b 로 보류.
//
// 공개:
//   window.designBodice = Object.freeze({ computeGeometry })
//   computeGeometry(referenceGeometry, { body: { hemExtensionBelowWaistCm: L } })
//
// 계약(local-frame, 조사 확정):
//   C=centerWaistEndpoint, S=sideWaistEndpoint
//   g = center edge 에서 파생한 아래쪽 grain 단위벡터(다트 상태와 무관하게 안정)
//   p = g 에 수직, center→side 방향(dot(S-C,p)>0)
//   longitudinalOffset = dot(S-C, g),  width = dot(S-C, p)
//   centerHem = C + L*g,  sideHem = C + L*g + width*p  (= S + (L-offset)*g)
//   ⇒ center 연장=정확히 L / hem ⟂ grain / 두 연장 평행 / side 연장 = L-offset.
//   L 의 의미 = "center waist 에서 hem 까지 grain 방향 길이". side 길이는 L 과
//   같을 필요 없다.
//
//   L===0 (정확히 0) 만 no-op: referenceGeometry 의 deep clone 반환(topology·role
//   이동 없음). 음수·NaN·Infinity·비수치는 invalid-body-length. **epsilon 으로 0 을
//   뭉개지 않는다** — UI 소수점 정규화는 DB1b 책임.
//
// 불변:
//   - 계산 기준은 항상 referenceGeometry(누적 변형 없음, 반복 호출 비누적).
//   - 입력 geometry·params 변형 0. 반환 geometry 는 참조가 전부 분리된 새 객체.
//   - sleeve/shared 와 비대상 primitive 는 값·순서 유지.
//   - 실패 시 부분 geometry 반환 없이 throw(.reason).
// ══════════════════════════════════════════════
(function () {
  "use strict";

  var EPS = 1e-9;
  var PIECES = ["front", "back", "shared", "sleeve"];
  var ROLES = ["outline", "construction"];

  function fail(reason, detail) {
    var e = new Error("designBodice: " + reason);
    e.reason = reason;
    if (detail !== undefined) e.detail = detail;
    throw e;
  }

  function deepClone(v) {
    if (v === null || typeof v !== "object") return v;
    if (typeof structuredClone === "function") return structuredClone(v);
    return JSON.parse(JSON.stringify(v));
  }

  function validGeometry(g) {
    if (!g || typeof g !== "object") return false;
    for (var i = 0; i < PIECES.length; i++) {
      var b = g[PIECES[i]];
      if (!b || typeof b !== "object") return false;
      for (var j = 0; j < ROLES.length; j++) if (!Array.isArray(b[ROLES[j]])) return false;
    }
    return true;
  }

  // ── 기하 헬퍼 ──
  function endpts(p) {
    if (p.kind === "line") return [p.from, p.to];
    var c = p.commands, f = c[0].points[0], lp = c[c.length - 1].points;
    return [f, lp[lp.length - 1]];
  }
  function key(q) { var r = function (v) { return Math.round(v * 1e4) / 1e4; }; return r(q.x) + "," + r(q.y); }
  function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
  function add(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }
  function mul(v, s) { return { x: v.x * s, y: v.y * s }; }
  function len(v) { return Math.hypot(v.x, v.y); }
  function dot(a, b) { return a.x * b.x + a.y * b.y; }
  function norm(v) { var l = len(v); return l < EPS ? { x: 0, y: 0 } : { x: v.x / l, y: v.y / l }; }

  function hasEdge(outline, e) { for (var i = 0; i < outline.length; i++) if (outline[i].edge === e) return true; return false; }

  // 두 edge 집합의 공유 끝점(junction). count>1 이면 ambiguous.
  function junction(outline, ea, eb) {
    var A = {}, B = {};
    outline.forEach(function (p) {
      if (!("edge" in p)) return;
      if (p.edge === ea) endpts(p).forEach(function (q) { A[key(q)] = q; });
      if (p.edge === eb) endpts(p).forEach(function (q) { B[key(q)] = q; });
    });
    var ks = Object.keys(A).filter(function (k) { return B[k]; });
    return { count: ks.length, pt: ks.length ? A[ks[0]] : null };
  }

  // C 에 끝점이 닿는 center 세그먼트들(유일해야 함). other=junction 반대편 끝.
  function centerSegsAt(outline, C) {
    var out = [];
    outline.forEach(function (p) {
      if (p.edge !== "center") return;
      var e = endpts(p);
      if (key(e[0]) === key(C)) out.push({ other: e[1] });
      else if (key(e[1]) === key(C)) out.push({ other: e[0] });
    });
    return out;
  }

  // primitive → line 세그먼트 배열(교차검사용). cubic 은 **adaptive de Casteljau
  // flattening**(flatness tolerance FLAT_TOL, 최대 depth FLAT_MAX_DEPTH)으로 평탄화한다.
  // 고정 분할은 크로싱이 샘플 사이/꼭짓점에 걸리면 놓칠 수 있어 쓰지 않는다.
  var FLAT_TOL = 1e-4, FLAT_MAX_DEPTH = 16;
  function mid(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
  function cubicFlatEnough(p0, p1, p2, p3, tol) {
    var ux = 3 * p1.x - 2 * p0.x - p3.x, uy = 3 * p1.y - 2 * p0.y - p3.y;
    var vx = 3 * p2.x - p0.x - 2 * p3.x, vy = 3 * p2.y - p0.y - 2 * p3.y;
    ux *= ux; uy *= uy; vx *= vx; vy *= vy;
    if (ux < vx) ux = vx;
    if (uy < vy) uy = vy;
    return (ux + uy) <= 16 * tol * tol;
  }
  function flattenCubic(p0, p1, p2, p3, tol, depth, out) {
    if (depth >= FLAT_MAX_DEPTH || cubicFlatEnough(p0, p1, p2, p3, tol)) { out.push([p0, p3]); return; }
    var p01 = mid(p0, p1), p12 = mid(p1, p2), p23 = mid(p2, p3);
    var p012 = mid(p01, p12), p123 = mid(p12, p23), p0123 = mid(p012, p123);
    flattenCubic(p0, p01, p012, p0123, tol, depth + 1, out);   // 좌 → 우 결정론적 순서
    flattenCubic(p0123, p123, p23, p3, tol, depth + 1, out);
  }
  function flattenPrim(p) {
    if (p.kind === "line") return [[p.from, p.to]];
    var out = [], cmds = p.commands, cur = cmds[0].points[0];
    for (var i = 1; i < cmds.length; i++) {
      var c = cmds[i];
      if (c.type === "M") { cur = c.points[0]; continue; }
      flattenCubic(cur, c.points[0], c.points[1], c.points[2], FLAT_TOL, 0, out);
      cur = c.points[2];
    }
    return out;
  }

  // 두 선분의 교차 판정 — 없음 / 한 점(횡단·끝점접촉) / 공선 겹침(범위) 을 구분한다.
  // 끝점 접촉·얕은 접선·공선 겹침을 모두 잡는다(강제 무시 없음).
  function intersectSegs(p1, p2, p3, p4) {
    var r = { x: p2.x - p1.x, y: p2.y - p1.y }, s = { x: p4.x - p3.x, y: p4.y - p3.y };
    var rxs = r.x * s.y - r.y * s.x;
    var qp = { x: p3.x - p1.x, y: p3.y - p1.y };
    var qpxr = qp.x * r.y - qp.y * r.x;
    var Z = 1e-12, e = 1e-9;
    if (Math.abs(rxs) < Z) {
      if (Math.abs(qpxr) >= Z) return { type: "none" };          // 평행·비공선
      var rr = r.x * r.x + r.y * r.y; if (rr < Z) return { type: "none" };
      var t0 = ((p3.x - p1.x) * r.x + (p3.y - p1.y) * r.y) / rr;
      var t1 = ((p4.x - p1.x) * r.x + (p4.y - p1.y) * r.y) / rr;
      var a = Math.max(0, Math.min(t0, t1)), b = Math.min(1, Math.max(t0, t1));
      if (a > b + e) return { type: "none" };
      var pa = { x: p1.x + a * r.x, y: p1.y + a * r.y }, pb = { x: p1.x + b * r.x, y: p1.y + b * r.y };
      if (Math.hypot(pb.x - pa.x, pb.y - pa.y) < 1e-9) return { type: "point", pt: pa };
      return { type: "overlap", a: pa, b: pb };
    }
    var t = (qp.x * s.y - qp.y * s.x) / rxs;
    var u = (qp.x * r.y - qp.y * r.x) / rxs;
    if (t >= -e && t <= 1 + e && u >= -e && u <= 1 + e) return { type: "point", pt: { x: p1.x + t * r.x, y: p1.y + t * r.y } };
    return { type: "none" };
  }

  // 한 조각(front/back) 을 L>0 로 변환한다. 입력 piece(=clone) 를 읽고 새 버킷을 반환.
  // 조각 좌표계(공용): C=center∩waist, S=side∩waist, g=아래쪽 grain(center 접선),
  // p=cross-grain(center→side). transformPiece(hem)·applyEase(여유량) 공유.
  function pieceFrame(outline) {
    ["center", "waist", "side-seam"].forEach(function (e) { if (!hasEdge(outline, e)) fail("missing-required-edge", e); });
    var jcw = junction(outline, "center", "waist");
    var jsw = junction(outline, "side-seam", "waist");
    if (jcw.count === 0) fail("missing-topology-junction", "center∩waist");
    if (jcw.count > 1) fail("ambiguous-topology-junction", "center∩waist");
    if (jsw.count === 0) fail("missing-topology-junction", "side∩waist");
    if (jsw.count > 1) fail("ambiguous-topology-junction", "side∩waist");
    var C = jcw.pt, S = jsw.pt;
    var cs = centerSegsAt(outline, C);
    if (cs.length !== 1) fail("ambiguous-center-tangent", cs.length);
    var up = sub(cs[0].other, C);
    if (len(up) < EPS) fail("zero-center-tangent");
    var g = norm(mul(up, -1));
    var p = { x: -g.y, y: g.x };
    if (dot(sub(S, C), p) < 0) p = mul(p, -1);
    return { C: C, S: S, g: g, p: p };
  }

  // side-seam edge 의 비-waist 끝점(underarm) 찾기. 정확히 1개여야 함.
  function underarmPoint(outline, S) {
    var ep = {};
    outline.forEach(function (pr) { if (pr.edge === "side-seam") endpts(pr).forEach(function (q) { ep[key(q)] = q; }); });
    var us = Object.keys(ep).filter(function (k) { return k !== key(S); }).map(function (k) { return ep[k]; });
    if (us.length !== 1) fail("ambiguous-side-underarm", us.length);
    return us[0];
  }

  // 프리미티브의 on-curve 끝점(line from/to · path M/각 C end)이 어느 move.pt 와 **거리 tol 이내**면
  // 그 move.d 만큼 이동(per-target delta). exact key 매칭은 source 기하의 ~0.0004cm 드리프트
  // (옆선·진동 접점)를 놓친다. cubic 은 인접 제어점(들어오는 c2·나가는 c1)도 함께 이동해 접선 보존.
  var JOIN_TOL = 0.02;   // 드리프트(0.0004) 는 잇고, 별개 설계점(≥0.08cm) 은 안 합침
  function movePrimPoints(prim, moves) {
    var matchD = function (q) { for (var t = 0; t < moves.length; t++) if (Math.hypot(q.x - moves[t].pt.x, q.y - moves[t].pt.y) < JOIN_TOL) return moves[t].d; return null; };
    if (prim.kind === "line") {
      var df = matchD(prim.from), dt = matchD(prim.to);
      var ln = { kind: "line", from: df ? add(prim.from, df) : { x: prim.from.x, y: prim.from.y },
        to: dt ? add(prim.to, dt) : { x: prim.to.x, y: prim.to.y } };
      if ("edge" in prim) ln.edge = prim.edge;   // edge 없는 세그먼트에 own-property 추가 금지(SV2)
      return ln;
    }
    // path: 명령 복제 후 on-curve 이동 + 인접 제어점 보정
    var cmds = prim.commands.map(function (c) { return { type: c.type, points: c.points.map(function (q) { return { x: q.x, y: q.y }; }) }; });
    for (var i = 0; i < cmds.length; i++) {
      var c = cmds[i];
      if (c.type === "M") {
        var dm = matchD(c.points[0]);
        if (dm) { c.points[0] = add(c.points[0], dm); var nx = cmds[i + 1]; if (nx && nx.type === "C") nx.points[0] = add(nx.points[0], dm); }  // M + 나가는 c1
      } else if (c.type === "C") {
        var de = matchD(c.points[2]);
        if (de) { c.points[2] = add(c.points[2], de); c.points[1] = add(c.points[1], de);  // end + 들어오는 c2
          var nx2 = cmds[i + 1]; if (nx2 && nx2.type === "C") nx2.points[0] = add(nx2.points[0], de); }  // 나가는 c1
      }
    }
    var out = { kind: "path", commands: cmds };
    if ("edge" in prim) out.edge = prim.edge;
    return out;
  }

  // 몸판 형상: 여유량(옆선 바깥 이동) → 길이(hem) → 옆선 실루엣(허리·밑단 옆선 이동).
  //   underarm(U) 은 여유량 결과로 **고정**(실루엣이 안 건드림). 허리·밑단은 ease 폭 기준 독립 이동.
  //   프레임(C·S·g·p·widthOrig)을 **변환 전 한 번** 계산 → hem 후에도 목표점(Se·sideHemE)을 거리
  //   매칭으로 이동. outline 만 이동(construction=다트·waist 참고선 불변, 여유·실루엣은 옆선에만).
  function shapePiece(piece, delta, waistOff, L, hemOff) {
    var fr = pieceFrame(piece.outline);
    var C = fr.C, S = fr.S, g = fr.g, p = fr.p;
    var U = underarmPoint(piece.outline, S);
    var widthOrig = dot(sub(S, C), p);
    var outline = piece.outline.map(deepClone), construction = piece.construction.map(deepClone);
    // 1. 여유량(ease): U·S 를 delta·p (박스형 평행). 다트 불변.
    if (delta !== 0) { var dE = mul(p, delta); outline = outline.map(function (pr) { return movePrimPoints(pr, [{ pt: U, d: dE }, { pt: S, d: dE }]); }); }
    var Se = add(S, mul(p, delta));                              // 여유량 반영 waist-side
    var piece1 = { outline: outline, construction: construction };
    var sideHemE = null;
    // 2. 길이(hem): ease 폭 옆선에서 hem 내려감(transformPiece 가 Se 기준 side-ext·hem 생성)
    if (L > 0) { piece1 = transformPiece(piece1, L); sideHemE = add(add(C, mul(g, L)), mul(p, widthOrig + delta)); }  // ease 폭 hem-side
    var out2 = piece1.outline, con2 = piece1.construction;
    // 3. 허리 옆선 이동(허리 들어간 형=음수·안쪽). Se(=side-ext 위·side-seam 아래) 만 이동 → 허리 꺾임.
    //    construction 도 함께(hem 후 construction 으로 옮겨진 waist 참고선이 옆선을 따라오도록;
    //    다트는 Se 에서 멀어 불변).
    if (waistOff !== 0) { var mw = [{ pt: Se, d: mul(p, waistOff) }]; out2 = out2.map(function (pr) { return movePrimPoints(pr, mw); }); con2 = con2.map(function (pr) { return movePrimPoints(pr, mw); }); }
    // 4. 밑단 옆선 이동(A라인=양수·바깥). hem 이 있을 때만. ease 폭 기준이라 허리 이동과 독립.
    if (hemOff !== 0 && sideHemE) { var mh = [{ pt: sideHemE, d: mul(p, hemOff) }]; out2 = out2.map(function (pr) { return movePrimPoints(pr, mh); }); con2 = con2.map(function (pr) { return movePrimPoints(pr, mh); }); }
    return { outline: out2, construction: con2 };
  }

  function transformPiece(piece, L) {
    var outline = piece.outline, construction = piece.construction;
    var fr = pieceFrame(outline);
    var C = fr.C, S = fr.S, g = fr.g, p = fr.p;
    var SC = sub(S, C);
    // 5. offset / width
    var longitudinalOffset = dot(SC, g);
    var width = dot(SC, p);
    if (width <= EPS) fail("invalid-cross-grain-width", width);
    var sideExtLen = L - longitudinalOffset;
    if (sideExtLen <= EPS) fail("invalid-side-extension", sideExtLen);
    // 6. hem 점
    var centerHem = add(C, mul(g, L));
    var sideHem = add(centerHem, mul(p, width));
    // 9(우선). 교차: 신규 3선 vs 기존 outline **전체**(cubic·waist 포함). endpoint 예외는
    // 실제 topology 접점만 —
    //   center 연장 ↔ (기존 center | waist) : C 에서만 허용
    //   side  연장 ↔ (기존 side-seam | waist) : S 에서만 허용
    //   hem   ↔ waist(및 그 외) : 허용 접점 없음
    //   그 외 접촉·겹침·횡단 : extension-intersection
    // waist 를 통째로 빼지 않는다 — 굽은/분할된 waist 내부를 연장선·hem 이 재횡단하는
    // 경우를 놓칠 수 있다. cubic subdivision 꼭짓점은 실제 endpoint 가 아니므로 예외 금지.
    var TOUCH = 1e-4;
    var newSegs = [
      { a: C, b: centerHem, edge: "center" },      // center extension
      { a: S, b: sideHem, edge: "side-seam" },     // side extension
      { a: centerHem, b: sideHem, edge: "hem" }    // hem (예외 없음)
    ];
    function nearPt(q, w) { return w && Math.hypot(q.x - w.x, q.y - w.y) < TOUCH; }
    for (var oi = 0; oi < outline.length; oi++) {
      var EP = outline[oi];
      var eSegs = flattenPrim(EP);
      for (var k = 0; k < newSegs.length; k++) {
        var NS = newSegs[k];
        var allow = (NS.edge === "center" && (EP.edge === "center" || EP.edge === "waist")) ? C
          : (NS.edge === "side-seam" && (EP.edge === "side-seam" || EP.edge === "waist")) ? S : null;
        for (var m = 0; m < eSegs.length; m++) {
          var res = intersectSegs(NS.a, NS.b, eSegs[m][0], eSegs[m][1]);
          if (res.type === "none") continue;
          if (res.type === "point") {
            if (allow && nearPt(res.pt, allow)) continue;
            fail("extension-intersection", { edge: EP.edge || null, kind: EP.kind });
          } else { // overlap 범위 — 허용점으로 완전히 수축한 경우만 OK
            if (allow && nearPt(res.a, allow) && nearPt(res.b, allow)) continue;
            fail("extension-intersection", { edge: EP.edge || null, kind: EP.kind, overlap: true });
          }
        }
      }
    }
    // 7. 기존 waist outline → construction(원래 순서), 비-waist outline 은 순서 유지
    var waistPrims = [], keepOutline = [];
    outline.forEach(function (pr) { if (pr.edge === "waist") waistPrims.push(pr); else keepOutline.push(pr); });
    // 8. 신규 outline primitive (center-extension → hem → side-extension)
    var centerExt = { kind: "line", from: { x: C.x, y: C.y }, to: { x: centerHem.x, y: centerHem.y }, edge: "center" };
    var hem = { kind: "line", from: { x: centerHem.x, y: centerHem.y }, to: { x: sideHem.x, y: sideHem.y }, edge: "hem" };
    var sideExt = { kind: "line", from: { x: S.x, y: S.y }, to: { x: sideHem.x, y: sideHem.y }, edge: "side-seam" };
    return {
      outline: keepOutline.concat([centerExt, hem, sideExt]),
      construction: construction.concat(waistPrims)
    };
  }

  function computeGeometry(referenceGeometry, opts) {
    if (!validGeometry(referenceGeometry)) fail("invalid-geometry");
    var body = (opts && opts.body) || {};
    var L = body.hemExtensionBelowWaistCm; if (L == null) L = 0;       // 미지정 = 0(하위호환)
    var E = body.bustEaseCm; if (E == null) E = 0;
    var wOff = body.waistSideOffsetCm; if (wOff == null) wOff = 0;     // 허리 옆선 이동(음수=안쪽)
    var hOff = body.hemSideOffsetCm; if (hOff == null) hOff = 0;       // 밑단 옆선 이동(양수=바깥)
    // 입력 정규화 경계: 정확한 0(넷 다) 만 no-op. 길이·여유량 음수 실패. 옆선 오프셋은 부호 허용(안/밖).
    if (typeof L !== "number" || !isFinite(L) || L < 0) fail("invalid-body-length", L);
    if (typeof E !== "number" || !isFinite(E) || E < 0) fail("invalid-body-ease", E);
    if (typeof wOff !== "number" || !isFinite(wOff)) fail("invalid-body-side-offset", wOff);
    if (typeof hOff !== "number" || !isFinite(hOff)) fail("invalid-body-side-offset", hOff);
    if (L === 0 && E === 0 && wOff === 0 && hOff === 0) return deepClone(referenceGeometry);
    // referenceGeometry 를 clone 한 작업본에서만 변환(입력 불변·비누적).
    var delta = E / 4;   // 전체 가슴둘레 여유량 → 각 옆선 E/4 (앞반쪽 + 뒤반쪽, ×2측 = E)
    var src = deepClone(referenceGeometry);
    return {
      front: shapePiece(src.front, delta, wOff, L, hOff),
      back: shapePiece(src.back, delta, wOff, L, hOff),
      shared: src.shared,   // 값·순서 유지(비대상)
      sleeve: src.sleeve
    };
  }

  window.designBodice = Object.freeze({ computeGeometry: computeGeometry });
})();
