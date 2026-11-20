// ══════════════════════════════════════════════
// cutMarker.js — 수동 마카 1단계: 순수 계층(2026-11-20 master 승인)
//   재단 조각(시접 포함 재단선)을 천 폭 안에 올려 겹침·천 밖 이탈·소요량(요척)을 계산한다.
//   읽기 전용: 조각 좌표·완료 hash·재단 설정(시접·수량·식서)을 바꾸지 않는다. 위치는 working.cutMarker 한 곳에만 저장한다.
//   단위 cm. 천 폭 기본 60인치(152.4cm) · 길이는 야드(1yd = 91.44cm) · 1in = 2.54cm.
//   조각마다 재단 수량만큼 인스턴스(id#k)를 만든다. 위치 = 조각 외곽 상자 중심 (cx, cy) + 회전 rot(0/90/180/270).
//   겹침 = 재단선 다각형끼리 정밀 판정(닿기만 하면 겹침 아님). 천 밖 = 천 폭 [0, widthCm] 이탈.
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var IN = 2.54, YD = 91.44, DEFAULT_IN = 60, GAP = 1, EPS = 1e-6;
  function W() { return (typeof window !== "undefined") ? window : {}; }
  function r4(v) { return Math.round(v * 1e4) / 1e4; }

  // ── 저장(working.cutMarker · 엄격 검증) ──
  //   { schema:1, widthCm, moves:{ "<인스턴스 id>": { cx, cy, rot } } } — 모르는 키·판·값 범위 = 읽지 않음.
  var ID = /^[a-z][A-Za-z0-9~-]{0,40}#[1-9][0-9]?$/;
  function read(proj) {
    var s = proj && proj.working ? proj.working.cutMarker : null;
    if (s == null) return { state: "none", widthCm: DEFAULT_IN * IN, moves: {} };
    var bad = function (r) { return { state: "invalid", reason: r, widthCm: DEFAULT_IN * IN, moves: {} }; };
    if (typeof s !== "object" || Array.isArray(s) || Object.keys(s).sort().join(",") !== "moves,schema,widthCm") return bad("형식 오류(schema·widthCm·moves 만 허용)");
    if (s.schema !== 1) return bad("모르는 판(schema " + s.schema + ")");
    if (typeof s.widthCm !== "number" || !isFinite(s.widthCm) || s.widthCm < 20 || s.widthCm > 400) return bad("천 폭은 20~400cm");
    if (!s.moves || typeof s.moves !== "object" || Array.isArray(s.moves)) return bad("moves 형식 오류");
    var out = {};
    for (var k in s.moves) {
      var m = s.moves[k];
      if (!ID.test(k) || !m || typeof m !== "object" || Object.keys(m).sort().join(",") !== "cx,cy,rot") return bad("위치 항목 형식 오류(" + k + ")");
      if (!isFinite(m.cx) || !isFinite(m.cy) || Math.abs(m.cx) > 5000 || Math.abs(m.cy) > 5000 || [0, 90, 180, 270].indexOf(m.rot) < 0) return bad("위치 값 범위 오류(" + k + ")");
      out[k] = { cx: m.cx, cy: m.cy, rot: m.rot };
    }
    return { state: "ready", widthCm: s.widthCm, moves: out };
  }
  function write(proj, widthCm, moves) {
    if (!proj || !proj.working) return { ok: false, reason: "프로젝트 없음" };
    var t = { schema: 1, widthCm: widthCm, moves: moves || {} }, tmp = { working: { cutMarker: t } }, chk = read(tmp);
    if (chk.state !== "ready") return { ok: false, reason: chk.reason };
    proj.working.cutMarker = t; return { ok: true };
  }

  // ── 기하 ──
  function bboxOf(ring) { var a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; ring.forEach(function (q) { if (q.x < a) a = q.x; if (q.x > c) c = q.x; if (q.y < b) b = q.y; if (q.y > d) d = q.y; }); return { minX: a, minY: b, maxX: c, maxY: d, w: c - a, h: d - b, cx: (a + c) / 2, cy: (b + d) / 2 }; }
  function rotPt(x, y, rot) { var c = Math.round(Math.cos(rot * Math.PI / 180)), s = Math.round(Math.sin(rot * Math.PI / 180)); return { x: x * c - y * s, y: x * s + y * c }; }
  // 인스턴스의 놓인 외곽: (링 − 외곽 상자 중심)을 rot 만큼 돌려 (cx, cy) 로 옮긴다.
  function placed(inst, p) {
    var b = inst.box;
    return inst.ring.map(function (q) { var r = rotPt(q.x - b.cx, q.y - b.cy, p.rot); return { x: r.x + p.cx, y: r.y + p.cy }; });
  }
  function seg(a, b, c, d) {   // 선분 교차(끝점 닿기는 교차로 안 침 — 시접이 딱 붙은 배치를 겹침으로 오판하지 않게)
    function o(p, q, r) { return (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x); }
    var d1 = o(a, b, c), d2 = o(a, b, d), d3 = o(c, d, a), d4 = o(c, d, b);
    return ((d1 > EPS && d2 < -EPS) || (d1 < -EPS && d2 > EPS)) && ((d3 > EPS && d4 < -EPS) || (d3 < -EPS && d4 > EPS));
  }
  function inside(pt, poly) {
    var c = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var a = poly[i], b = poly[j];
      if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < (b.x - a.x) * (pt.y - a.y) / (b.y - a.y) + a.x) c = !c;
    }
    return c;
  }
  function onBoundary(pt, poly) {
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var a = poly[i], b = poly[j], cr = (b.x - a.x) * (pt.y - a.y) - (b.y - a.y) * (pt.x - a.x);
      if (Math.abs(cr) < 1e-7 && pt.x >= Math.min(a.x, b.x) - 1e-7 && pt.x <= Math.max(a.x, b.x) + 1e-7 && pt.y >= Math.min(a.y, b.y) - 1e-7 && pt.y <= Math.max(a.y, b.y) + 1e-7) return true;
    }
    return false;
  }
  // 두 다각형(닫힌 링)이 겹치는가 — 변이 가로지르거나 한쪽이 다른 쪽 안에 있으면 겹침. 닿기만 하면 아님.
  function overlap(A, B) {
    var ba = bboxOf(A), bb = bboxOf(B);
    if (ba.maxX <= bb.minX + EPS || bb.maxX <= ba.minX + EPS || ba.maxY <= bb.minY + EPS || bb.maxY <= ba.minY + EPS) return false;
    for (var i = 0; i < A.length; i++) { var a1 = A[i], a2 = A[(i + 1) % A.length];
      for (var j = 0; j < B.length; j++) if (seg(a1, a2, B[j], B[(j + 1) % B.length])) return true; }
    // 변이 안 가로지르면: 한쪽 점이 다른 쪽 한가운데 안(경계 위가 아닌)에 있으면 포함
    for (var k = 0; k < A.length; k++) if (!onBoundary(A[k], B) && inside(A[k], B)) return true;
    for (var m = 0; m < B.length; m++) if (!onBoundary(B[m], A) && inside(B[m], A)) return true;
    // 변이 끝점에서만 닿는 겹침(축 정렬 사각형 등): 변의 중점·사분점도 본다
    var probe = function (P, Q) { for (var i2 = 0; i2 < P.length; i2++) { var a2 = P[i2], b2 = P[(i2 + 1) % P.length];
      for (var t = 1; t <= 3; t++) { var pt = { x: a2.x + (b2.x - a2.x) * t / 4, y: a2.y + (b2.y - a2.y) * t / 4 }; if (!onBoundary(pt, Q) && inside(pt, Q)) return true; } } return false; };
    if (probe(A, B) || probe(B, A)) return true;
    // 같은 모양이 정확히 포갠 경우(모든 점이 경계 위)
    var same = A.every(function (p) { return onBoundary(p, B); }) && B.every(function (p) { return onBoundary(p, A); });
    return same;
  }

  // ── 인스턴스: items = [{ id, label, ring:[{x,y}], qty }] → 수량만큼 id#k ──
  function instancesOf(items) {
    var out = [];
    items.forEach(function (it) {
      var n = it.qty == null ? 1 : it.qty;
      for (var k = 1; k <= n; k++) out.push({ id: it.id + "#" + k, baseId: it.id, label: it.label + (n > 1 ? " (" + k + "/" + n + ")" : ""), ring: it.ring, box: bboxOf(it.ring), grainOk: it.grainOk !== false });
    });
    return out;
  }
  // 자동 기본 배치: 천 폭 안 선반(shelf) 채우기 — 회전 없음, 큰 조각 먼저. 사용자가 옮긴 위치(moves)가 있으면 그것이 우선.
  function autoPlace(insts, widthCm) {
    var order = insts.slice().sort(function (a, b) { return b.box.h - a.box.h; }), pl = {}, x = 0, y = 0, rowH = 0;
    order.forEach(function (it) {
      var w = it.box.w, h = it.box.h;
      if (x > 0 && x + w > widthCm) { x = 0; y += rowH + GAP; rowH = 0; }
      pl[it.id] = { cx: r4(x + w / 2), cy: r4(y + h / 2), rot: 0 }; x += w + GAP; rowH = Math.max(rowH, h);
    });
    return pl;
  }
  function resolve(insts, spec) {
    var auto = autoPlace(insts, spec.widthCm), out = {};
    insts.forEach(function (it) { out[it.id] = spec.moves[it.id] || auto[it.id]; });
    return out;
  }

  // ── 평가: 겹침 쌍 · 천 밖 · 식서 경고 · 소요 길이 ──
  function evaluate(insts, pl, widthCm) {
    var polys = {}, over = [], out = [], grain = [], maxY = 0, minY = Infinity;
    insts.forEach(function (it) {
      var P = placed(it, pl[it.id]); polys[it.id] = P; var b = bboxOf(P);
      if (b.minX < -EPS || b.maxX > widthCm + EPS || b.minY < -EPS) out.push(it.id);
      if (pl[it.id].rot % 180 !== 0 && it.grainOk) grain.push(it.id);
      if (b.maxY > maxY) maxY = b.maxY; if (b.minY < minY) minY = b.minY;
    });
    for (var i = 0; i < insts.length; i++) for (var j = i + 1; j < insts.length; j++) if (overlap(polys[insts[i].id], polys[insts[j].id])) over.push([insts[i].id, insts[j].id]);
    var len = insts.length ? Math.max(0, maxY) : 0;
    return { overlaps: over, outside: out, grainTurned: grain, lengthCm: r4(len), yards: r4(len / YD), widthCm: widthCm, ok: !over.length && !out.length };
  }

  var API = { IN: IN, YD: YD, DEFAULT_IN: DEFAULT_IN, read: read, write: write, bboxOf: bboxOf, placed: placed, overlap: overlap, instancesOf: instancesOf, autoPlace: autoPlace, resolve: resolve, evaluate: evaluate,
    inchToCm: function (v) { return r4(v * IN); }, cmToInch: function (v) { return r4(v / IN); }, cmToYard: function (v) { return r4(v / YD); } };
  W().cutMarker = Object.freeze(API);
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})();
