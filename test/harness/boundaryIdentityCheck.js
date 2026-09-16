// ══════════════════════════════════════════════
// boundaryIdentityCheck.js — P0.3a 봉제 경계 안정 identity/lineage 회귀.
//
// 계약: 의미를 아는 생산자가 root 경계 ID 를 선언하고, 절단·반전·복제·디자인 변환·manual
// 합성은 root 를 유지한 채 root 위 구간(from→to)만 값으로 옮긴다. 좌표·배열 index 로 identity 를
// 만들지 않는다. 형상 hash·좌표·개수·순서는 불변, 의미만 바뀌면 별도 fingerprint 가 바뀐다.
//
//   node test/harness/boundaryIdentityCheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");
const { createEngine } = require("./loadEngine");
const { applyRecipe, attemptDartMove } = require("./dartDriver");
const { mulberry32 } = require("./rng");

let PASS = 0, FAIL = 0; const fails = [];
function ok(cond, name) { if (cond) PASS++; else { FAIL++; fails.push(name); } }
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const JS = (f) => fs.readFileSync(path.join(__dirname, "..", "..", "js", f), "utf8");
function loadInto(files, extra) {
  const sandbox = Object.assign({ window: {}, document: {}, console: { log() {}, warn() {}, error() {} },
    structuredClone, Math, JSON, Object, Array, Number, isFinite, Error, Infinity, NaN, Date }, extra || {});
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  files.forEach(f => vm.runInContext(JS(f), sandbox, { filename: f }));
  return sandbox;
}

// ── 엔진 불변식: 한 형상 안에서 root 별 구간이 [0,1] 을 정확히 한 번 덮고, 좌표로 이어진 같은
//    root 이웃은 파라미터도 끊김 없이 이어진다(= 절단·반전 lineage 가 맞다). ──
const OUTLINE_TYPES = new Set(["front-center", "front-waist", "side-seam", "front-armhole-lower", "front-armhole-upper",
  "front-shoulder", "front-neckline", "back-shoulder", "back-neckline", "back-center", "back-waist", "back-armhole"]);
function engineLineage(segs) {
  const out = { missing: 0, coverageErr: 0, chainBreaks: 0, roots: {} };
  segs.forEach(s => {
    if (!OUTLINE_TYPES.has(s.type)) return;
    if (typeof s.boundaryRoot !== "string" || !isFinite(s.boundaryFromT) || !isFinite(s.boundaryToT)) { out.missing++; return; }
    out.roots[s.boundaryRoot] = (out.roots[s.boundaryRoot] || 0) + Math.abs(s.boundaryToT - s.boundaryFromT);
  });
  Object.keys(out.roots).forEach(r => { out.coverageErr = Math.max(out.coverageErr, Math.abs(out.roots[r] - 1)); });
  for (let i = 0; i < segs.length; i++) {
    const a = segs[i], b = segs[(i + 1) % segs.length];
    if (!a.boundaryRoot || a.boundaryRoot !== b.boundaryRoot) continue;
    if (Math.hypot(a.to.x - b.from.x, a.to.y - b.from.y) > 1e-6) continue;
    if (!near(a.boundaryToT, b.boundaryFromT, 1e-9)) out.chainBreaks++;
  }
  return out;
}

// 1. gen-0 생산자: 결정론적 root, [0,1] 정확 커버, 방향 선언
{
  const { engine } = createEngine();
  const d = engine.createDraft(83, 64, 38);
  const f1 = engine.buildFrontOutline(d.pts, d.formula, 83), f2 = engine.buildFrontOutline(d.pts, d.formula, 83);
  const b1 = engine.buildBackOutline(d.pts, d.formula, 83);
  const ids = (segs) => JSON.stringify(segs.map(s => [s.boundaryRoot, s.boundaryFromT, s.boundaryToT]));
  ok(ids(f1) === ids(f2), "1: 같은 입력 → 같은 identity(결정론)");
  const lf = engineLineage(f1), lb = engineLineage(b1);
  ok(lf.missing === 0 && lb.missing === 0, "1: 모든 경계 세그먼트가 root 선언");
  ok(Object.keys(lf.roots).length === 7 && Object.keys(lb.roots).length === 7, "1: 앞·뒤 root 7종씩(뒤어깨 2 root)");
  ok(lf.coverageErr < 1e-9 && lb.coverageErr < 1e-9, "1: root 별 구간 합 = 1");
  ok(lf.chainBreaks === 0 && lb.chainBreaks === 0, "1: 이웃 파라미터 연속");
  const neck = f1.filter(s => s.boundaryRoot === "front/neckline");
  ok(neck[0].boundaryFromT === 1 && neck[neck.length - 1].boundaryToT === 0, "1: 목선은 SNP→중심 순서로 그려져 1→0 방향");
  ok(f1.filter(s => s.boundaryRoot).every(s => !/\d/.test(s.boundaryRoot)), "1: root 에 index·좌표 숫자 없음");
}

// 2. gen-0 절단: 반쪽은 root 유지, 절단점에서 구간 분할, B 조각은 방향 반전
{
  const { engine } = createEngine();
  const d = engine.createDraft(83, 64, 38);
  const segs = engine.buildFrontOutline(d.pts, d.formula, 83);
  const idx = segs.findIndex(s => s.type === "side-seam");
  const s0 = segs[idx];
  const cut = { x: s0.from.x + (s0.to.x - s0.from.x) * 0.25, y: s0.from.y + (s0.to.y - s0.from.y) * 0.25 };
  const sp = engine.splitFrontOutline(segs, cut, idx, d.pts, 83);
  const a0 = sp.pieceA.segs[0], b0 = sp.pieceB.segs[0];
  ok(a0.boundaryRoot === "front/side-seam" && b0.boundaryRoot === "front/side-seam", "2: 절단 반쪽 root 유지");
  ok(near(a0.boundaryFromT, 0.75) && near(a0.boundaryToT, 0), "2: A 반쪽 = 절단점(0.75)→진동밑(0)");
  ok(near(b0.boundaryFromT, 0.75) && near(b0.boundaryToT, 1), "2: B 반쪽(반전) = 절단점(0.75)→허리(1)");
  ok(near(Math.abs(a0.boundaryToT - a0.boundaryFromT) + Math.abs(b0.boundaryToT - b0.boundaryFromT), 1), "2: 두 반쪽 합 = 원 구간");
  ok(!("boundaryRoot" in s0) || s0.boundaryFromT === 1, "2: 입력 세그먼트 불변");
}

// 3. 실제 다중 다트 이동(분산 체인) 후 bake·normalize 결과에서도 lineage 불변식 유지
{
  const { engine } = createEngine();
  const dims = { B: 83, W: 64, BL: 38 };
  const recipes = [
    { type: "front-waist", arcFraction: 0.35, piece: "A", moveFraction: 0.5 },
    { type: "side-seam", arcFraction: 0.45, piece: "B", moveFraction: 0.4 },
    { type: "front-armhole-upper", arcFraction: 0.6, piece: "A", moveFraction: 1.0 },
  ];
  let allOk = true, applied = 0, detail = "";
  recipes.forEach((r, i) => {
    const res = applyRecipe(engine, "front", dims, r);
    if (res.status !== "applied") { allOk = false; detail += " gen" + i + ":" + res.status; return; }
    applied++;
    const L = engineLineage(res.bakedSegments);
    if (L.missing || L.coverageErr > 1e-9 || L.chainBreaks) { allOk = false; detail += " gen" + i + ":" + JSON.stringify(L); }
  });
  ok(applied === 3 && allOk, "3: 앞판 3세대 분산 체인 lineage 커버·연속·누락 0" + detail);
}

// 4. 무작위 스트레스(앞·뒤) — 적용마다 lineage 불변식
{
  const dims = { B: 83, W: 64, BL: 38 };
  let applied = 0, bad = 0;
  ["front", "back"].forEach(side => {
    for (let run = 0; run < 10; run++) {
      const { engine } = createEngine();
      const rng = mulberry32(run * 7919 + (side === "back" ? 13 : 3));
      for (let gen = 0; gen < 5; gen++) {
        const res = attemptDartMove(engine, side, dims, 0.3 + rng() * 0.7, undefined, rng);
        if (res.status !== "applied") continue;
        applied++;
        const L = engineLineage(res.bakedSegments);
        if (L.missing || L.coverageErr > 1e-9 || L.chainBreaks) bad++;
      }
    }
  });
  ok(applied > 20 && bad === 0, "4: 무작위 앞·뒤 적용 " + applied + "건 lineage 위반 " + bad);
}

// ── designLineTool: 절단·반전·명령 분해·깊은 복사 ──
const T = loadInto(["designLineTool.js"]).window.designLineTool;
{
  const ln = { kind: "line", from: { x: 0, y: 0 }, to: { x: 10, y: 0 }, edge: "waist", boundary: { root: "front/waist", ranges: [[0.2, 1]] } };
  const sub = T.subSegment(ln, 0.25, 0.75);
  ok(sub.boundary.root === "front/waist" && near(sub.boundary.ranges[0][0], 0.4) && near(sub.boundary.ranges[0][1], 0.8), "5: subSegment 구간 affine 분할");
  const rev = T.reverseSeg(ln);
  ok(rev.boundary.ranges[0][0] === 1 && rev.boundary.ranges[0][1] === 0.2, "5: reverseSeg 방향 반전");
  sub.boundary.ranges[0][0] = 99; rev.boundary.root = "x";
  ok(ln.boundary.ranges[0][0] === 0.2 && ln.boundary.root === "front/waist", "5: 결과 변형이 원본에 새지 않음(값 복제)");
  const cl = T.subSegment(ln, 0, 1);
  ok(cl.boundary !== ln.boundary && cl.boundary.ranges !== ln.boundary.ranges, "5: 복제본은 참조 공유 없음");
  // 명령 2개 path → 명령별 구간
  const path2 = { kind: "path", edge: "neckline", boundary: { root: "front/neckline", ranges: [[0, 0.5], [0.5, 1]] },
    commands: [{ type: "M", points: [{ x: 0, y: 0 }] }, { type: "C", points: [{ x: 1, y: 0 }, { x: 2, y: 1 }, { x: 3, y: 1 }] },
      { type: "C", points: [{ x: 4, y: 1 }, { x: 5, y: 2 }, { x: 6, y: 3 }] }] };
  const segs = T.outlinePrimsToSegs([path2]);
  ok(segs.length === 2 && segs[1].boundary.ranges[0][0] === 0.5 && segs[1].boundary.ranges[0][1] === 1, "5: path 명령별 구간 분해");
  const bad = JSON.parse(JSON.stringify(path2)); bad.boundary.ranges = [[0, 1]];
  ok(T.outlinePrimsToSegs([bad]).every(s => !("boundary" in s) && s.edge === "neckline"), "5: 구간 수 불일치면 identity 를 싣지 않음(edge 는 유지)");
  const gp = T.geomToPatternSegments([path2]);
  ok(gp.length === 2 && gp[0].boundary.ranges[0][1] === 0.5 && !("edge" in gp[0]), "5: geomToPatternSegments 는 identity 만 명령 단위로");
  // replacement: identity 없는 대체 구간은 기존대로 unresolved + provenance, identity 를 만들지 않음
  const rep = T.boundarySegsOf({ id: "line-7", segments: [{ kind: "line", from: { x: 0, y: 0 }, to: { x: 1, y: 1 } }] });
  ok(rep[0].edgeStatus === "unresolved" && rep[0].edgeSourceLineId === "line-7" && !("boundary" in rep[0]), "5: 의미 없는 replacement 는 unresolved 유지");
}

// 6. manual 합성: 유지 구간은 root 유지·잘린 구간, 대체 구간은 unresolved(identity 없음)
{
  const L = (x1, y1, x2, y2, edge, root) => ({ kind: "line", from: { x: x1, y: y1 }, to: { x: x2, y: y2 }, edge, boundary: { root, ranges: [[0, 1]] } });
  // 사각형(다트 입구 2개 자유단 없이 닫히지 않으므로 construction 다리로 닫는다)
  const outline = [L(0, 0, 10, 0, "neckline", "front/neckline"), L(10, 0, 10, 10, "side-seam", "front/side-seam"),
    L(10, 10, 0, 10, "waist", "front/waist"), L(0, 10, 0, 6, "center", "front/center")];
  const constr = [{ from: { x: 0, y: 6 }, to: { x: 3, y: 3 } }, { from: { x: 3, y: 3 }, to: { x: 0, y: 0 } }];
  const rb = T.buildPieceRing(outline, constr);
  ok(rb.ok, "6: ring 구성");
  const bnd = T.boundarySegsOf({ id: "line-3", segments: [{ kind: "line", from: { x: 10, y: 2 }, to: { x: 8, y: 5 } }, { kind: "line", from: { x: 8, y: 5 }, to: { x: 10, y: 8 } }] });
  const res = T.composeDesignOutline(rb.ring, [bnd]);
  ok(res.ok, "6: 합성 성공 " + (res.reason || ""));
  if (res.ok) {
    const side = res.outline.filter(s => s.boundary && s.boundary.root === "front/side-seam");
    const span = side.map(s => s.boundary.ranges[0]);
    const covered = span.reduce((t, r) => t + Math.abs(r[1] - r[0]), 0);
    ok(side.length === 2 && near(covered, 0.4, 1e-9), "6: 유지 옆선 두 조각 root 유지 · 구간 합 0.4");
    ok(span.some(r => near(Math.min(r[0], r[1]), 0) && near(Math.max(r[0], r[1]), 0.2)) &&
       span.some(r => near(Math.min(r[0], r[1]), 0.8) && near(Math.max(r[0], r[1]), 1)), "6: 유지 구간 = [0,0.2]·[0.8,1]");
    ok(res.outline.filter(s => s.edgeStatus === "unresolved").every(s => !("boundary" in s) && s.edgeSourceLineId === "line-3"), "6: 대체 구간 identity 미부여");
    ok(res.outline.filter(s => s.boundary).every(s => s.edge && s.boundary.root === "front/" + s.edge), "6: root 의미 = edge");
  }
}

// ── designBodice: 점 이동은 lineage 유지, 새 경계는 생산자 선언, legacy 무조작 ──
const DB = loadInto(["designBodice.js"]).window.designBodice;
{
  const line = (a, b, edge, root, r) => { const o = { kind: "line", from: { x: a[0], y: a[1] }, to: { x: b[0], y: b[1] } }; if (edge) o.edge = edge; if (root) o.boundary = { root, ranges: [r || [0, 1]] }; return o; };
  const cpath = (p, edge, root) => { const o = { kind: "path", commands: [{ type: "M", points: [{ x: p[0][0], y: p[0][1] }] }, { type: "C", points: p.slice(1).map(q => ({ x: q[0], y: q[1] })) }] }; if (edge) o.edge = edge; if (root) o.boundary = { root, ranges: [[0, 1]] }; return o; };
  // front: CF 오른쪽(x=40), 옆선 왼쪽(x=16). 목점(40,3)·SNP(33,-4)·어깨끝(22,0)·진동밑(16,20)·허리(16,38)/(40,38)
  const piece = (ids, pfx) => ({
    outline: [
      line([40, 3], [40, 38], "center", ids && pfx + "/center"),
      line([40, 38], [16, 38], "waist", ids && pfx + "/waist"),
      line([16, 38], [16, 20], "side-seam", ids && pfx + "/side-seam", [1, 0]),
      cpath([[16, 20], [18, 12], [20, 5], [22, 0]], "armhole", ids && pfx + "/armhole"),
      line([22, 0], [33, -4], "shoulder", ids && pfx + "/shoulder", [1, 0]),
      cpath([[33, -4], [35, 0], [38, 3], [40, 3]], "neckline", ids && pfx + "/neckline"),
    ],
    construction: []
  });
  const back = (ids) => { const p = piece(ids, "back"); p.outline.forEach(pr => { const fx = (q) => { q.x = 56 - q.x; }; if (pr.kind === "line") { fx(pr.from); fx(pr.to); } else pr.commands.forEach(c => c.points.forEach(fx)); }); return p; };
  const geom = (ids) => ({ front: piece(ids, "front"), back: back(ids), shared: { outline: [], construction: [] }, sleeve: { outline: [], construction: [] } });
  const g5 = geom(true);
  const before = JSON.stringify(g5);
  const out = DB.computeGeometry(g5, { body: { hemExtensionBelowWaistCm: 10, bustEaseCm: 4, waistSideOffsetCm: -1, sideSeamCurve: 1 } });
  ok(JSON.stringify(g5) === before, "7: 입력 불변");
  const fo = out.front.outline;
  const roots = fo.filter(p => p.boundary).map(p => p.boundary.root).sort();
  ok(JSON.stringify(roots) === JSON.stringify(["front/armhole", "front/center", "front/center-extension", "front/hem", "front/neckline", "front/shoulder", "front/side-seam", "front/side-seam-extension"]),
    "7: 변환 후 root = 기존 lineage + 생산자 선언(hem·연장)");
  ok(fo.every(p => !p.edge || p.boundary), "7: outline 의미 모서리 전부 identity 보유");
  const waistC = out.front.construction.find(p => p.edge === "waist");
  ok(waistC && waistC.boundary.root === "front/waist", "7: construction 으로 옮긴 허리도 lineage 유지");
  // 곡선화된 옆선: 새 cubic 방향(진동밑→허리)에 맞춰 원 구간이 방향 정렬
  const upper = fo.find(p => p.boundary && p.boundary.root === "front/side-seam");
  ok(upper.kind === "path" && upper.commands[0].points[0].y < upper.commands[1].points[2].y && upper.boundary.ranges[0][0] === 0 && upper.boundary.ranges[0][1] === 1,
    "7: 곡선화 옆선 = 진동밑(0)→허리(1)로 방향 정렬");
  // 형상은 identity 유무와 무관(좌표·kind·개수·순서 동일)
  const outLegacy = DB.computeGeometry(geom(false), { body: { hemExtensionBelowWaistCm: 10, bustEaseCm: 4, waistSideOffsetCm: -1, sideSeamCurve: 1 } });
  const strip = (g) => JSON.stringify(g, (k, v) => (k === "boundary" ? undefined : v));
  ok(strip(out) === strip(outLegacy), "7: identity 가 형상·개수·순서를 바꾸지 않음");
  ok(!JSON.stringify(outLegacy).includes("boundary"), "7: legacy(무 identity) 입력엔 identity 를 만들지 않음");
  // parametric 목선: 새 root 선언(중심→SNP 명령 순서), 스퀘어는 세그먼트 수만큼 분할
  const nk = DB.computeGeometry(geom(true), { neckline: { mode: "parametric", type: "square", parameters: { frontDepthCm: 2, backDepthCm: 1, squareWidthCm: 3, cornerRadiusCm: 1 } } });
  const ns = nk.front.outline.filter(p => p.edge === "neckline");
  ok(ns.length === 3 && ns.every(p => p.boundary.root === "front/neckline") && near(ns[0].boundary.ranges[0][0], 0) && near(ns[2].boundary.ranges[0][1], 1),
    "7: 스퀘어 목선 3구간 root 선언(0→1)");
  const nkL = DB.computeGeometry(geom(false), { neckline: { mode: "parametric", type: "square", parameters: { frontDepthCm: 2, backDepthCm: 1, squareWidthCm: 3, cornerRadiusCm: 1 } } });
  ok(!JSON.stringify(nkL).includes("boundary"), "7: legacy 목선 변환도 identity 무조작");
  ok(strip(nk) === strip(nkL), "7: 목선 identity 가 형상을 바꾸지 않음");
}

// ── bodiceCheckpoint: 증거·ordered chain·fingerprint(형상 hash 분리) ──
{
  let PROJECT = null;
  const sb = loadInto(["bodiceCheckpoint.js"], { window: { designLineTool: { buildPieceRing: () => ({ ok: true }) }, designWorkflow: { current: () => PROJECT } } });
  const BC = sb.window.bodiceCheckpoint;
  const cpath = (a, b, c, d) => ({ kind: "path", commands: [{ type: "M", points: [{ x: a[0], y: a[1] }] }, { type: "C", points: [{ x: b[0], y: b[1] }, { x: c[0], y: c[1] }, { x: d[0], y: d[1] }] }] });
  const line = (a, b, edge) => { const s = { kind: "line", from: { x: a[0], y: a[1] }, to: { x: b[0], y: b[1] } }; if (edge) s.edge = edge; return s; };
  const piece = (cx, topY, sideTopY, sideBotY, pfx, withIds) => {
    const o = [line([cx, topY], [cx, sideBotY], "center"), line([cx - 24, sideTopY], [cx - 24, sideBotY], "side-seam"),
      cpath([cx, topY], [cx - 3, topY - 2], [cx - 6, topY - 6], [cx - 7, topY - 7]), line([cx - 7, topY - 7], [cx - 18, topY - 3]),
      cpath([cx - 18, topY - 3], [cx - 22, sideTopY - 8], [cx - 24, sideTopY - 3], [cx - 24, sideTopY])];
    o[2].edge = "neckline"; o[3].edge = "shoulder"; o[4].edge = "armhole";
    if (withIds) o.forEach(pr => { pr.boundary = { root: pfx + "/" + pr.edge, ranges: [[0, 1]] }; });
    return { outline: o, construction: [] };
  };
  const mk = (sv, ids) => ({ sourceBlock: { version: 1, schemaVersion: sv }, working: {
    geometry: { front: piece(47.5, 3, 20, 38, "front", ids), back: piece(24, 0, 20, 38, "back", ids), shared: { outline: [], construction: [] }, sleeve: { outline: [], construction: [] } },
    parameters: { neckline: { mode: "parametric", type: "round", parameters: {} } }, designOutline: null, frontPlacket: null, patternLines: [] } });
  const sem = (p) => { PROJECT = p; return BC.check().semantics; };

  const r5 = sem(mk(6, true));
  ok(r5.ready === true && r5.boundaries.missing.length === 0 && r5.boundaries.misaligned.length === 0, "8: v6 + 전부 선언 → ready");
  ok(r5.boundaries.front.length === 5 && r5.boundaries.front[0].root === "front/center", "8: effective outline 순서의 span reference 증거");
  ok(typeof r5.boundaryFingerprint === "string" && r5.boundaryFingerprint === sem(mk(6, true)).boundaryFingerprint, "8: fingerprint 결정론");

  // 의미만 변경 → boundaryFingerprint 변화, 형상 hash·측정·dart fingerprint 불변
  const base = mk(6, true); PROJECT = base; const c1 = BC.complete();
  const dirP = mk(6, true); dirP.working.geometry.front.outline[3].boundary.ranges = [[1, 0]];
  PROJECT = dirP; const c2 = BC.complete();
  const rootP = mk(6, true); rootP.working.geometry.back.outline[4].boundary.root = "back/armhole-upper";
  PROJECT = rootP; const c3 = BC.complete();
  const rangeP = mk(6, true); rangeP.working.geometry.front.outline[1].boundary.ranges = [[0, 0.5]];
  PROJECT = rangeP; const c4 = BC.complete();
  ok(c1.ok && c2.ok && c3.ok && c4.ok, "8: 완료 자체는 막지 않음(증거만)");
  ok(c1.result.hash === c2.result.hash && c1.result.hash === c3.result.hash && c1.result.hash === c4.result.hash, "8: bodiceResult.hash 불변(형상 전용)");
  const fps = [c1, c2, c3, c4].map(c => c.result.semantics.boundaryFingerprint);
  ok(new Set(fps).size === 4, "8: 방향·root·lineage 구간 변경 각각 fingerprint 변화");
  ok(c1.result.semantics.fingerprint === c2.result.semantics.fingerprint, "8: dart fingerprint 와 분리");
  ok(JSON.stringify(c1.result.armholeLengths) === JSON.stringify(c2.result.armholeLengths) &&
     JSON.stringify(c1.result.necklineLengths) === JSON.stringify(c2.result.necklineLengths), "8: reported 측정 불변");
  // 배치·UI 상태 제외
  const lay = mk(6, true); lay.working.layout = { front: { dx: 9, dy: 9 } }; lay.working.selectedId = "line-1";
  ok(sem(lay).boundaryFingerprint === r5.boundaryFingerprint, "8: 배치·선택 상태는 fingerprint 미포함");
  ok(Object.isFrozen(c1.result.semantics.boundaries.front[0]), "8: 스냅샷 증거 deepFrozen");

  // 정렬되지 않은 선언 → ready 위장 금지
  const mis = mk(6, true); mis.working.geometry.front.outline[4].boundary.root = "front/shoulder";   // armhole prim 에 shoulder root
  const rm = sem(mis);
  ok(!rm.ready && rm.issues.indexOf("boundary-identity-misaligned") >= 0 && rm.boundaries.misaligned[0].role === "armhole", "8: root 의미 불일치 → misaligned");
  const cnt = mk(6, true); cnt.working.geometry.front.outline[2].boundary.ranges = [[0, 0.5], [0.5, 1]];
  ok(sem(cnt).issues.indexOf("boundary-identity-misaligned") >= 0, "8: 구간 수 ≠ 명령 수 → misaligned");
  const miss = mk(6, true); delete miss.working.geometry.back.outline[0].boundary;
  const rmi = sem(miss);
  ok(!rmi.ready && rmi.issues.indexOf("boundary-identity-missing") >= 0 && rmi.boundaries.missing.some(m => m.piece === "back" && m.role === "center"), "8: v6 필수 role identity 누락 → missing");
  // unresolved replacement 는 identity 누락으로 세지 않는다(의미 없는 구간)
  const un = mk(6, true);
  un.working.designOutline = { front: { outline: un.working.geometry.front.outline.concat([{ kind: "line", from: { x: 1, y: 1 }, to: { x: 2, y: 2 }, edgeStatus: "unresolved", edgeSourceLineId: "line-4" }]) } };
  const ru = sem(un);
  ok(ru.boundaries.missing.length === 0 && ru.issues.indexOf("unresolved-replacement") >= 0, "8: unresolved 는 기존 원인만");

  // ordered: 같은 span 집합의 순서만 바뀌어도 fingerprint 변화(형상 hash 는 형상 전용이라 별개)
  const ro = mk(6, true); const fo = ro.working.geometry.front.outline; [fo[0], fo[1]] = [fo[1], fo[0]];
  const rro = sem(ro);
  ok(JSON.stringify(rro.boundaries.front.map(b => b.root).sort()) === JSON.stringify(r5.boundaries.front.map(b => b.root).sort()) &&
     rro.boundaryFingerprint !== r5.boundaryFingerprint, "8: 순서만 바뀐 동일 span 집합 → fingerprint 변화");
  const rb2 = mk(6, true); rb2.working.geometry.back.outline.reverse();
  ok(sem(rb2).boundaryFingerprint !== r5.boundaryFingerprint && sem(rb2).boundaryFingerprint !== rro.boundaryFingerprint, "8: 뒤판 내부 순서 변경도 구분(piece 별 순서 보존)");
  // [0,1] 계약: 허용치 밖 선언은 ready 위장 없이 misaligned
  const oob = mk(6, true); oob.working.geometry.back.outline[1].boundary.ranges = [[0, 1.01]];
  const rob = sem(oob);
  ok(!rob.ready && rob.issues.indexOf("boundary-identity-misaligned") >= 0 && rob.boundaries.misaligned.some(m => m.piece === "back" && m.role === "side-seam"), "8: 범위 밖(1.01) → misaligned");
  const neg = mk(6, true); neg.working.geometry.front.outline[0].boundary.ranges = [[-0.001, 1]];
  ok(sem(neg).issues.indexOf("boundary-identity-misaligned") >= 0, "8: 범위 밖(-0.001) → misaligned");
  const epsOk = mk(6, true); epsOk.working.geometry.front.outline[0].boundary.ranges = [[0, 1 + 5e-7]];
  ok(sem(epsOk).ready === true, "8: 허용치(1e-6) 이내 → 정렬 유지");

  // legacy v4: identity 를 지어내지 않고 legacy 로만 표시
  const l4 = sem(mk(4, false));
  ok(l4.boundaries.misaligned.length === 0 && l4.issues.indexOf("boundary-identity-misaligned") < 0, "8: legacy 에 범위 위반 identity 를 만들지 않음");
  ok(!l4.ready && l4.issues.indexOf("legacy-source") >= 0 && l4.issues.indexOf("boundary-identity-missing") < 0, "8: v4 → legacy-source(누락을 오류로 조작하지 않음)");
  ok(l4.boundaries.front.length === 0 && l4.boundaries.missing.length === 10, "8: v4 증거 = span 0 · 누락 목록 그대로");

  // ordered chain 기반
  const ch = BC.makeBoundaryChain([{ root: "front/armhole-lower", from: 0, to: 1 }, { root: "front/armhole-upper", from: 1, to: 0.25 }]);
  ok(ch.ok && ch.chain.spans.length === 2 && ch.chain.spans[1].direction === "reverse" && Object.isFrozen(ch.chain.spans[0]), "9: chain 순서·방향·불변");
  ok(!BC.makeBoundaryChain([{ root: "front/waist", from: 0.5, to: 0.5 }]).ok && !BC.makeBoundaryChain([{ from: 0, to: 1 }]).ok && !BC.makeBoundaryChain([]).ok,
    "9: 무효 참조가 있으면 chain 을 만들지 않음");
  // [0,1]±1e-6 계약: 범위 밖 span 은 거부, 허용치 이내 부동소수 오차는 수용
  const oobC = BC.makeBoundaryChain([{ root: "front/waist", from: 0, to: 1.01 }]);
  ok(!oobC.ok && oobC.reason === "span-out-of-range" && oobC.index === 0, "9: chain span 범위 밖(1.01) 거부");
  ok(!BC.makeBoundaryChain([{ root: "front/waist", from: 0, to: 0.5 }, { root: "front/waist", from: -0.001, to: 0.5 }]).ok, "9: chain span 범위 밖(-0.001) 거부");
  ok(BC.makeBoundaryChain([{ root: "front/waist", from: -5e-7, to: 1 + 5e-7 }]).ok, "9: chain 허용치 이내 수용");
}

console.log("══════════════════════════════════════════════");
if (FAIL) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); }
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
