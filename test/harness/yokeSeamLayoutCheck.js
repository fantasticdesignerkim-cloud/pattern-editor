// yokeSeamLayoutCheck.js — 요크 이음선 Ⓠ 렌더 검증·표시 배치(designRenderer/designLayout) 회귀 (커밋 3).
//   node test/harness/yokeSeamLayoutCheck.js
// 범위: 렌더러 검증(yoke-seam edge·네 슬롯), 배치(요크 위·몸판 아래 3cm·bbox 겹침 0·좌표 불변·hit bbox),
//       제작 정보(조각명·이음선), 프리셋 Ⓠ 식별, hash 불변. render.js/UI 는 브라우저에서 실측한다.
const vm = require("vm");
const fs = require("fs");
const path = require("path");

let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
function throwsReason(fn, want, name) {
  try { fn(); FAIL++; fails.push(name + " (throw 안 됨)"); }
  catch (e) { if (want && e.reason !== want) { FAIL++; fails.push(`${name} (reason=${e.reason}, 기대=${want})`); } else PASS++; }
}
const J = JSON.stringify;
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

let PROJECT = null;
const els = [];
const sandbox = {
  window: {}, console: { log() {}, warn() {} }, Math, JSON, Object, Array, isFinite, structuredClone, Error, Date,
  c2p: (x, y) => [x * 10, y * 10],
  document: { createElementNS: (ns, tag) => { const e = { tag, attrs: {}, kids: [], setAttribute(k, v) { this.attrs[k] = v; }, appendChild(c) { this.kids.push(c); } }; els.push(e); return e; } }
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
const load = (f) => vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "..", "js", f), "utf8"), sandbox, { filename: f });
sandbox.window.designWorkflow = { current: () => PROJECT };
["designLineTool.js", "designFlare.js", "designJoin.js", "designWaistSeam.js", "designYokeSeam.js", "designBodice.js", "bodicePresets.js",
  "designLayout.js", "designRenderer.js", "bodiceCheckpoint.js", "peplumAnnotation.js"].forEach(load);
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, DL = W.designLayout, DR = W.designRenderer, BC = W.bodiceCheckpoint, PA = W.peplumAnnotation;
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));

const Q_BODY = BP.bodyParams("bunka-bodice-Q");
const G = DB.computeGeometry(REF, { body: Q_BODY });
const GA = DB.computeGeometry(REF, { body: BP.bodyParams("bunka-bodice-A") });
const GSNAP = J(G);
const EMPTY = { outline: [], construction: [] };
const ptsOf = (p, out) => { if (p.kind === "line") out.push(p.from, p.to); else if (p.kind === "cubic") out.push(p.from, p.c1, p.c2, p.to); else p.commands.forEach(c => c.points.forEach(q => out.push(q))); };
const bbox = (piece) => { const pts = []; piece.outline.forEach(p => ptsOf(p, pts)); return { minX: Math.min(...pts.map(q => q.x)), maxX: Math.max(...pts.map(q => q.x)), minY: Math.min(...pts.map(q => q.y)), maxY: Math.max(...pts.map(q => q.y)) }; };
const shiftBB = (b, o) => ({ minX: b.minX + o.dx, maxX: b.maxX + o.dx, minY: b.minY + o.dy, maxY: b.maxY + o.dy });
const overlap = (a, b) => a.minX < b.maxX - 1e-9 && b.minX < a.maxX - 1e-9 && a.minY < b.maxY - 1e-9 && b.minY < a.maxY - 1e-9;
const union = (a, b) => ({ minX: Math.min(a.minX, b.minX), maxX: Math.max(a.maxX, b.maxX), minY: Math.min(a.minY, b.minY), maxY: Math.max(a.maxY, b.maxY) });
const eqBB = (a, b) => a && b && ["minX", "maxX", "minY", "maxY"].every(k => near(a[k], b[k]));

// ── 1. 프리셋 Ⓠ ──
ok(BP.resolve("yoke-seam-1", "bunka-bodice-Q").ok && BP.get("bunka-bodice-Q").body.yokeSeam === true, "1: Ⓠ 해석 성공·yokeSeam");
ok(J(BP.bodyParams("bunka-bodice-Q")) === J({ hemExtensionBelowWaistCm: 20, hemSideOffsetCm: 1, yokeSeam: true }), "1: Ⓠ = 박시 A(엉덩이 20) + 밑단 옆 +1 + yokeSeam");
ok(BP.family("yoke-seam-1").availability === "available" && BP.variant("yoke-seam-1", "bunka-bodice-R").availability === "available" && BP.variant("yoke-seam-2", "bunka-bodice-S").availability === "available" && BP.variant("yoke-seam-2", "bunka-bodice-T").availability === "available", "1: 요크 ① 라인 available · Ⓡ 실행 · Ⓢ 실행 · Ⓣ 실행");
ok(BP.familyOptions().find(o => o.value === "yoke-seam-1").available === true, "1: 라인 목록에서 활성");

// ── 2. 배치: 요크 위·몸판 아래 3cm, 좌표 불변 ──
{
  ["front", "back"].forEach(side => {
    const Y = G[side + "Yoke"], B = DL.peplumDisplayPiece(G, side + "Body"), by = bbox(Y), bb = bbox(B), bo = bbox(G[side + "Body"]);
    const dy = DL.peplumDrop(G, side + "Body");
    ok(near(dy, 3), side + ": 몸판 표시 내림 = 3cm(PEPLUM_GAP), dy=" + dy);
    ok(near(bb.minY - by.maxY, 3), side + ": 요크 아래 끝과 몸판 위 끝 간격 3cm");
    ok(near(by.maxY, G.yokeSeam[side].seamY, 1e-9), side + ": 요크는 이음선 위(원 좌표 그대로)");
    ok(near(bb.minX, bo.minX) && near(bb.maxX, bo.maxX) && near(bb.maxY - bo.maxY, 3), side + ": 몸판은 y 로만 이동");
    ok(!overlap(by, bb), side + ": 요크·몸판 bbox 겹침 0");
  });
  ok(J(G) === GSNAP, "2: 배치 계산은 geometry 를 바꾸지 않는다");
  // hit bbox: 전체 앞/뒤판은 빼고 요크 ∪ 내려 그린 몸판
  ["front", "back"].forEach(side => {
    const u = union(bbox(G[side + "Yoke"]), bbox(DL.peplumDisplayPiece(G, side + "Body")));
    ok(eqBB(DL.outlineBBoxOf(G, side), u), side + ": outline bbox = 요크 ∪ 표시 몸판");
    const whole = bbox(G[side]);
    ok(near(DL.outlineBBoxOf(G, side).maxY - whole.maxY, 3), side + ": 전체 몸판 대비 아래로 3cm(표시 내림만큼)");
    ok(DL.bboxOf(G, side).minY <= u.minY + 1e-9 && DL.bboxOf(G, side).maxY >= u.maxY - 1e-9, side + ": hit bbox 는 표시 조각을 모두 덮는다");
  });
  // 자동 배치 후 네 조각 + 앞·뒤 사이 겹침 0
  const off = DL.autoLayout(G);
  const pcs = [["frontYoke", "front"], ["frontBody", "front"], ["backYoke", "back"], ["backBody", "back"]].map(([k, o]) =>
    shiftBB(k.endsWith("Body") ? bbox(DL.peplumDisplayPiece(G, k)) : bbox(G[k]), off[o]));
  let anyOverlap = false; for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) if (overlap(pcs[i], pcs[j])) anyOverlap = true;
  ok(!anyOverlap, "2: 자동 배치 후 네 조각 bbox 겹침 0");
  ok(J(G) === GSNAP, "2: autoLayout 도 geometry 불변");
  // 비요크 기하는 종전 그대로(전체 앞/뒤판 bbox)
  ["front", "back"].forEach(side => ok(eqBB(DL.outlineBBoxOf(GA, side), bbox(GA[side])), "2: Ⓐ " + side + " outline bbox 는 전체 몸판 그대로"));
}

// ── 3. 제작 정보: 조각명·이음선만(수치 없음) ──
{
  const m = DL.yokeLabels(G);
  ok(m && J(m.labels.map(l => l.text)) === J(["앞요크", "앞몸판", "뒤요크", "뒤몸판"]), "3: 조각명 4개(앞요크/앞몸판/뒤요크/뒤몸판)");
  ok(m.seams.length === 2 && m.seams.every(s => s.text === "이음선"), "3: 이음선 글자 앞·뒤 각 1");
  ok(m.labels.every(l => typeof l.text === "string" && !/\d/.test(l.text)) && m.seams.every(s => !/\d/.test(s.text)), "3: 수치 없음(지어낸 정보 금지)");
  ok(m.labels.every(l => { const b = l.key.endsWith("Body") ? bbox(DL.peplumDisplayPiece(G, l.key)) : bbox(G[l.key]); return l.at.x >= b.minX && l.at.x <= b.maxX && l.at.y >= b.minY && l.at.y <= b.maxY; }), "3: 라벨 위치가 각 조각 bbox 안");
  ok(DL.yokeLabels(GA) === null && DL.yokeLabels(null) === null, "3: 요크 없으면 null");
  { const pm = PA.buildModel(G, Q_BODY); ok(pm && pm.front === null && pm.back === null, "3: 페플럼·박시 제작 정보 모델은 Ⓠ 에 붙지 않는다"); }
}

// ── 4. 렌더러: yoke-seam edge·네 슬롯 ──
{
  const sub = (g) => ({ front: EMPTY, back: EMPTY, shared: EMPTY, sleeve: EMPTY, frontYoke: g.frontYoke, frontBody: DL.peplumDisplayPiece(g, "frontBody"),
    backYoke: g.backYoke, backBody: DL.peplumDisplayPiece(g, "backBody") });
  els.length = 0;
  const grp = DR.createWorkingGroup(sub(G));
  const kids = grp.kids;
  const cnt = (piece) => kids.filter(k => k.attrs["data-piece"] === piece).length;
  ok(["frontYoke", "frontBody", "backYoke", "backBody"].every(p => cnt(p) > 0), "4: 네 조각 프리미티브 렌더");
  ok(cnt("front") === 0 && cnt("back") === 0 && cnt("shared") === 0, "4: 전체 앞/뒤판·shared 는 그리지 않는다(중복 렌더 0)");
  ok(kids.filter(k => k.attrs["data-edge"] === "yoke-seam").length === 8, "4: yoke-seam 프리미티브 8개(조각마다 2)");
  ok(kids.every(k => k.attrs["data-design-layer"] === "working"), "4: 모두 working 레이어");
  const total = ["frontYoke", "frontBody", "backYoke", "backBody"].reduce((t, p) => t + G[p].outline.length + G[p].construction.length, 0);
  ok(kids.length === total, "4: 프리미티브 수 = 네 조각 outline+construction 합(" + kids.length + "/" + total + ")");
  // 검증
  const bad = (mut) => { const g = JSON.parse(JSON.stringify(sub(G))); mut(g); return g; };
  throwsReason(() => DR.createWorkingGroup(bad(g => { g.frontYoke.outline[0].edge = "nope"; })), "bad-edge", "4: 모르는 edge 거부");
  throwsReason(() => DR.createWorkingGroup(bad(g => { g.backBody.construction.push({ kind: "line", from: { x: 0, y: 0 }, to: { x: 1, y: 1 }, edge: "yoke-seam" }); })), "edge-placement", "4: yoke-seam 은 construction 금지");
  throwsReason(() => DR.createWorkingGroup(bad(g => { g.backYoke.outline = 1; })), "invalid-geometry", "4: 조각 형식 검증");
  // 기존 A 렌더는 그대로(요크 슬롯 없음)
  ok(DR.createWorkingGroup({ front: GA.front, back: GA.back, shared: GA.shared, sleeve: EMPTY }).kids.length > 0, "4: 요크 슬롯 없는 기존 렌더 그대로");
  ok(J(G) === GSNAP, "4: 렌더는 geometry 불변");
}

// ── 5. hash: 표시 이동·배치와 무관 ──
{
  const mk = () => ({ sourceBlock: { version: 2, schemaVersion: 8 }, referenceGeometry: REF,
    working: { geometry: DB.computeGeometry(REF, { body: Q_BODY }), parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body: Q_BODY }, patternLines: [], designOutline: null, frontPlacket: null } });
  const p = mk(); PROJECT = p;
  BC.complete(p); const h1 = BC.latest(p).hash;
  DL.autoLayout(p.working.geometry); DL.outlineBBoxOf(p.working.geometry, "front"); DL.yokeLabels(p.working.geometry); DL.peplumDisplayPiece(p.working.geometry, "frontBody");
  ok(BC.isCurrentBodiceChanged(p) === false && BC.latest(p).hash === h1, "5: 표시 이동·배치 계산 뒤에도 몸판 hash·스테일 불변");
  const p2 = mk(); PROJECT = p2; BC.complete(p2);
  ok(BC.latest(p2).hash === h1, "5: 같은 Ⓠ → 같은 hash(결정론)");
}

console.log("yokeSeamLayoutCheck: " + PASS + " PASS / " + FAIL + " FAIL");
if (FAIL) { fails.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
