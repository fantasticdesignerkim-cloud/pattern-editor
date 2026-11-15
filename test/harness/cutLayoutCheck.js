// ══════════════════════════════════════════════
// cutLayoutCheck.js — 재단 화면: 배치 순서 · 가슴선(BL) 정렬 · 골 펼침 표시 · 재단 수량(실제 엔진 · 2026-11-15 master 승인)
//   §1 순서 = 뒤판 → 앞판 → 소매 · 작은 부속은 아래 줄 · 앞·뒤판 BL 높이 같음(위 끝 맞춤 아님) · 시접 포함 테두리끼리 겹침 없음
//   §2 골 펼침(뒤판 · 밴드 · 위 칼라): 면적 = 반쪽 × 2 · 골선 대칭 · 폐곡선 · 골선 위 외곽/시접 선 없음(중복 중심 없음) · 원본·완료 hash 불변
//   §3 골 ↔ 봉제선: 반쪽 표시로 돌아감 · 폭 보존 · 다시 골 = 펼침 · 반사 쪽 변/너치 = 원래 변 id(같은 설정)
//   §4 재단 수량(working.cutQty 판 1): master 기본값 · 골/봉제선에 따른 기본 · 수정·거부 · 엄격 검증 · 저장 → 열기 · 구파일 기본값 · 시접/너치 설정 무변경
//   node test/harness/cutLayoutCheck.js
// ══════════════════════════════════════════════
"use strict";
const vm = require("vm"), fs = require("fs"), path = require("path");
let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
process.on("uncaughtException", e => { console.log("cutLayoutCheck: 예외 — " + (e && e.stack || e).toString().split("\n").slice(0, 3).join(" | ")); fails.slice(0, 20).forEach(f => console.log("  ✗ " + f)); process.exit(1); });
const J = JSON.stringify, ROOT = path.join(__dirname, "..", "..");
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));
const REFSLEEVE = () => {
  const cap = { kind: "path", commands: [{ type: "M", points: [{ x: 5.53, y: 66.42 }] }, { type: "C", points: [{ x: 12, y: 56 }, { x: 18, y: 53 }, { x: 23.75, y: 53 }] }, { type: "C", points: [{ x: 29, y: 53 }, { x: 35, y: 56 }, { x: 39.29, y: 66.42 }] }] };
  const line = (a, b) => ({ kind: "line", from: { x: a[0], y: a[1] }, to: { x: b[0], y: b[1] } });
  return { outline: [cap, line([5.53, 66.42], [7.56, 105]), line([39.29, 66.42], [37.56, 105]), line([7.56, 105], [37.56, 105])], construction: [] };
};
const SNAPSHOT = () => ({ schemaVersion: 8,
  source: { measurements: { B: 83, W: 64, BL: 38, SL: 52, Hem: 30, capAdj: 0, capFormula: "bunka", dartTotal: 12 }, handles: { armH: null, fArmH: null, bNeckH: null, fNeckH: null, sleeveH: null }, appliedDarts: { front: null, back: null } },
  geometry: Object.assign(JSON.parse(J(REF)), { sleeve: REFSLEEVE() }) });
const SLEEVE_EXTRA = (() => { const fs0 = require("fs"), p0 = require("path"), out = [];
  "BCDEFGHIJKLMNOPQRSTUVWXYZ".split("").forEach(k => { const R0 = p0.join(__dirname, "..", "..", "js"); if (fs0.existsSync(p0.join(R0, "designSleeve" + k + ".js"))) out.push("designSleeve" + k + ".js"); out.push("sleeve" + k + "Apply.js"); });
  return out; })();
const FILES = ["blockWorkflow.js", "designProject.js", "sideSeamMagnet.js", "designLineTool.js", "sleeveSplit.js", "sleeveOutlineEdit.js", "designFlare.js", "designJoin.js", "designWaistSeam.js", "designYokeSeam.js", "designPrincess.js",
  "designPlacket.js", "designBodice.js", "bodicePresets.js", "designLayout.js", "designRenderer.js", "bodiceCheckpoint.js", "peplumAnnotation.js", "designSleeve.js", "sleeveMeasure.js", "sleeveCheckpoint.js", "sleevePresets.js",
  "designSleeveA.js", "designCuff.js", "sleeveAApply.js", "sleeveAnnotation.js", "designCollar.js", "collarPresets.js", "collarCheckpoint.js", "designResult.js", "projectFile.js", "seamMatch.js", "seamAllowance.js", "cutPrep.js"].concat(SLEEVE_EXTRA);
const SRC = {}; FILES.forEach(f => { SRC[f] = fs.readFileSync(path.join(ROOT, "js", f), "utf8"); });

function makeSession() {
  const ELS = {};
  const el = id => { if (!ELS[id]) ELS[id] = { id, textContent: "", value: "", disabled: false, hidden: false, title: "", attrs: {}, setAttribute(k, v) { this.attrs[k] = String(v); }, removeAttribute(k) { delete this.attrs[k]; }, getAttribute(k) { return this.attrs[k]; } }; return ELS[id]; };
  const sb = { window: {}, console: { log() {}, warn() {} }, Math, JSON, Object, Array, isFinite, structuredClone, Error, Date, Promise, Number, String, Map, Set, WeakMap,
    setTimeout: () => 0, clearTimeout: () => {},
    c2p: (x, y) => [x * 10, y * 10], SC: 10, viewZ: 1, eventToPatternPoint: e => [e.px, e.py], render: () => {},
    svg: { addEventListener() {}, setPointerCapture() {}, releasePointerCapture() {} },
    document: { createElementNS: () => ({ setAttribute() {}, appendChild() {} }), getElementById: el, addEventListener() {} } };
  sb.globalThis = sb; vm.createContext(sb);
  sb.window.isDesignStageActive = () => true; sb.window.addEventListener = () => {}; sb.window.refreshDesignResultUI = () => {};
  sb.captureBlockSnapshot = () => SNAPSHOT();
  FILES.forEach(f => vm.runInContext(SRC[f], sb, { filename: f }));
  const W = sb.window; W.designLineQuickBar = { sync() {} };
  const S = { W, BW: W.blockWorkflow, DW: W.designWorkflow, DB: W.designBodice, BP: W.bodicePresets, BC: W.bodiceCheckpoint, SC: W.sleeveCheckpoint, SP: W.sleevePresets, DPL: W.designPlacket,
    DC: W.designCollar, CP: W.collarPresets, CC: W.collarCheckpoint, DR: W.designResult, DLT: W.designLineTool, DLy: W.designLayout, PF: W.projectFile, SM: W.seamMatch, CUT: W.cutPrep, SA: W.designSleeveA, DCF: W.designCuff };
  S.P = () => S.DW.current();
  W.projectSessionUI = { snapshot: () => ({ stage: "design", subtab: "collar" }), unfinished: () => [], afterRestore() {} };
  return S;
}
const presetOf = (S, sym) => { for (const f of S.BP.families()) for (const v of f.variants) if (v.symbol === sym && v.presetId) return v.presetId; return null; };
// ui.js computeFrontPlacket 과 같은 상태 변화(유효 앞 외곽 → designPlacket.compute → working.frontPlacket)
function setPlacket(S, overlap, facing) {
  const P = S.P(), params = { overlapCm: overlap, facingWidthCm: facing, lengthMode: "full" }, r = S.DPL.compute(S.BC.effectiveOutline(P, "front"), params);
  if (!r.ok) return r;
  P.working.frontPlacket = { parameters: { overlapCm: overlap, facingWidthCm: facing, lengthMode: "full" }, outline: r.outline, construction: r.construction };
  return { ok: true };
}
function start(S) {
  const P = S.DW.startFromBlock(S.BW.complete()), body = S.BP.bodyParams(presetOf(S, "A"));
  P.working.parameters.neckline = { mode: "parametric", type: "original", parameters: {} };
  P.working.parameters.body = body;
  P.working.geometry = Object.assign({}, S.DB.computeGeometry(P.referenceGeometry, { body }), { sleeve: P.working.geometry.sleeve });
  P.working.designOutline = null; P.working.frontPlacket = null;
  S.DLy.ensureLayout(P);
  return P;
}
function setCollarM(S) { const P = S.P(), plan = S.CP.composeDraft("bunka-shirt-collar-M", S.BC.latest(P), S.DC); if (plan.ok) { P.working.collarDraft = plan.draft; P.working.collarResult = null; } return plan; }

// ── 독립 계측(cutPrep 코드 미사용) ── 원래 primitive(line·cubic·path) → 200 샘플 점열 bbox
function ptsInd(outline) {
  const out = [], cub = (a, b, c, d) => { for (let k = 0; k <= 200; k++) { const t = k / 200, u = 1 - t; out.push({ x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x, y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y }); } };
  outline.forEach(s => {
    if (s.kind === "line") { out.push(s.from, s.to); return; }
    if (s.kind === "cubic") { cub(s.from, s.c1, s.c2, s.to); return; }
    let cur = null; (s.commands || []).forEach(c => { if (c.type === "M") cur = c.points[0]; else if (c.type === "L") { out.push(cur, c.points[0]); cur = c.points[0]; } else if (c.type === "C") { cub(cur, c.points[0], c.points[1], c.points[2]); cur = c.points[2]; } });
  });
  return out;
}
function bboxInd(outlines) { const p = [].concat(...outlines.map(ptsInd)); const xs = p.map(q => q.x), ys = p.map(q => q.y); return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }; }
const near = (a, b, e) => typeof a === "number" && typeof b === "number" && Math.abs(a - b) <= (e || 1e-6);
const graph = S => J(S.PF.encodeGraph({ block: S.BW.latest(), project: S.P() }));
const hashes = P => [P.working.bodiceResult, P.working.sleeveResult, P.working.collarResult, P.working.designResult].map(r => r && r.hash).join(",");
const ids = d => (d.pieces || []).map(p => p.id).join(",");
function deepFrozen(o) { if (!o || typeof o !== "object") return true; if (!Object.isFrozen(o)) return false; return Object.keys(o).every(k => deepFrozen(o[k])); }
function allObjs(o, acc) { acc = acc || new Set(); if (o && typeof o === "object" && !acc.has(o)) { acc.add(o); Object.keys(o).forEach(k => allObjs(o[k], acc)); } return acc; }
const defs = (S, sym) => { const rec = S.SP.get("bunka-sleeve-" + sym), o = {}; rec.inputs.forEach(i => { if (typeof i.defaultValue === "number") o[i.key] = i.defaultValue; else if (i.key === "sleeveLengthCm") o[i.key] = 52; }); return o; };
function completeChain(S, P) { const a = S.SC.complete(P).ok; const pl = setCollarM(S); const b = S.CC.complete(P).ok, c = S.DR.complete(P).ok; return a && pl.ok && b && c; }

const cuffOf = (S, vent) => { const c = JSON.parse(J(S.DCF.defaults())); if (vent) Object.assign(c.vent, vent); return c; };
function build(vent, noCuff) {
  const S = makeSession(), P = start(S);
  const a = S.BC.complete(P).ok, ra = S.W.sleeveAApply.apply(P, noCuff ? { sleeveLengthCm: 52 } : { sleeveLengthCm: 52, cuff: cuffOf(S, vent) });
  const okAll = a && ra && ra.ok && completeChain(S, P), g0 = graph(S), h0 = hashes(P), d = S.CUT.derive(P);
  return { S, P, ok: okAll, d, unchanged: graph(S) === g0 && hashes(P) === h0, pl: d.pieces && d.pieces.find(p => p.id === "vent-placket"), bi: d.pieces && d.pieces.find(p => p.id === "vent-bias"), sl: d.pieces && d.pieces.find(p => p.id === "sleeve-sleeve") };
}

// ── 독립 계측(모듈 코드 미사용) ──
const cubP = (s, t) => { const u = 1 - t; return { x: u * u * u * s.from.x + 3 * u * u * t * s.c1.x + 3 * u * t * t * s.c2.x + t * t * t * s.to.x, y: u * u * u * s.from.y + 3 * u * u * t * s.c1.y + 3 * u * t * t * s.c2.y + t * t * t * s.to.y }; };
const denseOf = segs => { const o = []; segs.forEach(s => { const n = s.kind === "cubic" ? 400 : 40; for (let k = 0; k <= n; k++) { const t = k / n; o.push(s.kind === "cubic" ? cubP(s, t) : { x: s.from.x + (s.to.x - s.from.x) * t, y: s.from.y + (s.to.y - s.from.y) * t }); } }); return o; };
const dSeg = (p, a, b) => { const vx = b.x - a.x, vy = b.y - a.y, l2 = vx * vx + vy * vy, t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / l2)) : 0; return Math.hypot(p.x - a.x - vx * t, p.y - a.y - vy * t); };
const dPts = (p, pts) => { let m = Infinity; for (let i = 0; i + 1 < pts.length; i++) m = Math.min(m, dSeg(p, pts[i], pts[i + 1])); return m; };
const crossCount = pts => { const m = pts.length, X = (a, b, c, d) => { const r = { x: b.x - a.x, y: b.y - a.y }, q = { x: d.x - c.x, y: d.y - c.y }, den = r.x * q.y - r.y * q.x; if (Math.abs(den) < 1e-12) return false; const s = ((c.x - a.x) * q.y - (c.y - a.y) * q.x) / den, u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / den; return s >= 0 && s <= 1 && u >= 0 && u <= 1; };
  let n = 0; for (let a = 0; a < m; a++) for (let b = a + 2; b < m; b++) { if (a === 0 && b === m - 1) continue; if (X(pts[a], pts[(a + 1) % m], pts[b], pts[(b + 1) % m])) n++; } return n; };
const inPoly = (p, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) c = !c; } return c; };
const areaOf = pts => Math.abs(pts.reduce((a, p, i) => { const q = pts[(i + 1) % pts.length]; return a + p.x * q.y - q.x * p.y; }, 0)) / 2;
const edgeSegs = (p, e) => e.segs.map(i => p.segs[i]);
const eids = p => p.edges.map(e => e.id).join(",");
const strip = d => J(d.pieces.map(p => { const o = Object.assign({}, p); delete o.edges; return o; }));
const PIECE = (d, id) => d.pieces.find(p => p.id === id);
const E = (m, pid, eid) => m.pieces[pid].edges.find(e => e.id === eid);

// 대표 동선(여밈 1.2/1.2 포함) — cutPrepIntegrationCheck §1 과 같은 조합
function buildP() {
  const S = makeSession(), P = start(S);
  const a = setPlacket(S, 1.2, 1.2).ok && S.BC.complete(P).ok, ra = S.W.sleeveAApply.apply(P, { sleeveLengthCm: 52, cuff: cuffOf(S, null) });
  return { S, P, ok: a && ra && ra.ok && completeChain(S, P) };
}


const dense = segs => { const o = []; segs.forEach(s => { const n = s.kind === "cubic" ? 2000 : 1; for (let k = 0; k <= n; k++) { const t = k / n; o.push(s.kind === "cubic" ? cubP(s, t) : { x: s.from.x + (s.to.x - s.from.x) * t, y: s.from.y + (s.to.y - s.from.y) * t }); } }); return o; };
const dPoly = (p, pts, closed) => { let m = Infinity; for (let i = 0; i + 1 < pts.length; i++) m = Math.min(m, dSeg(p, pts[i], pts[i + 1])); if (closed) m = Math.min(m, dSeg(p, pts[pts.length - 1], pts[0])); return m; };
const view = (S, P) => { const d = S.CUT.derive(P, true), m = S.CUT.seam(d, P), N = {}; Object.keys(m.pieces).forEach(k => m.pieces[k].notches.forEach(n => { N[n.id] = n; })); return { d, m, N }; };
const nids = N => Object.keys(N).sort().join(",");


const area = pts => Math.abs(pts.reduce((a, p, i) => { const q = pts[(i + 1) % pts.length]; return a + p.x * q.y - q.x * p.y; }, 0)) / 2;
const dense2 = segs => { const o = []; segs.forEach(g => { const n = g.kind === "cubic" ? 400 : 1; for (let k = 0; k < n; k++) { const t = k / n, u = 1 - t; o.push(g.kind === "cubic" ? { x: u*u*u*g.from.x + 3*u*u*t*g.c1.x + 3*u*t*t*g.c2.x + t*t*t*g.to.x, y: u*u*u*g.from.y + 3*u*u*t*g.c1.y + 3*u*t*t*g.c2.y + t*t*t*g.to.y } : g.from); } }); return o; };
const mir = (A, B) => q => { const dx = B.x - A.x, dy = B.y - A.y, t = ((q.x - A.x) * dx + (q.y - A.y) * dy) / (dx * dx + dy * dy); return { x: 2 * (A.x + dx * t) - q.x, y: 2 * (A.y + dy * t) - q.y }; };
const onLine = (A, B) => q => Math.abs((q.x - A.x) * (B.y - A.y) - (q.y - A.y) * (B.x - A.x)) / Math.hypot(B.x - A.x, B.y - A.y) < 1e-6;
const dPolyC = (p, pts) => { let m = Infinity; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], vx = b.x - a.x, vy = b.y - a.y, l2 = vx * vx + vy * vy, t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / l2)) : 0; m = Math.min(m, Math.hypot(p.x - a.x - vx * t, p.y - a.y - vy * t)); } return m; };
function buildP() { const S = makeSession(), P = start(S); const a = setPlacket(S, 1.2, 1.2).ok && S.BC.complete(P).ok, ra = S.W.sleeveAApply.apply(P, { sleeveLengthCm: 52, cuff: cuffOf(S, null) }); return { S, P, ok: a && ra && ra.ok && completeChain(S, P) }; }
const model = (S, P) => { const d = S.CUT.derive(P, true), m = S.CUT.seam(d, P), D = S.CUT.displayOf(d, m), L = S.CUT.layoutOf(d.pieces, D); return { d, m, D, L, Q: S.CUT.qtyOf(d, D, P) }; };

const r = buildP(), S = r.S, P = r.P, H0 = hashes(P), PIECES0 = J(S.CUT.derive(P, true).pieces);
let M = model(S, P);
// ══ §1 ══
{
  ok(r.ok && M.L.order.join(",") === "back,front,sleeve-sleeve,cuff,vent-placket,vent-bias,collar-stand,collar-body", "1: 순서 = 뒤판 → 앞판 → 소매 → 부속 (" + M.L.order.join(",") + ")");
  const top = id => M.D[id].bbox.minY + M.L.pos[id].dy, bot = id => M.D[id].bbox.maxY + M.L.pos[id].dy, left = id => M.D[id].bbox.minX + M.L.pos[id].dx, right = id => M.D[id].bbox.maxX + M.L.pos[id].dx;
  const blB = M.D.back.blY + M.L.pos.back.dy, blF = M.D.front.blY + M.L.pos.front.dy;
  // 독립 BL: 옆선 변 끝점 중 가장 위(bodiceCheckpoint.bustLineY 규칙)
  const bl = id => { const p = M.d.pieces.find(x => x.id === id), e = p.edges.find(x => x.label === "side-seam"); return Math.min(...e.segs.flatMap(i => [p.segs[i].from.y, p.segs[i].to.y])); };
  ok(M.L.blAligned && near(blB, blF, 1e-9) && near(M.D.back.blY, bl("back"), 1e-12) && near(M.D.front.blY, bl("front"), 1e-12) && near(blB, M.L.blY, 1e-9), "1: 앞·뒤판 가슴선(BL = 옆선 위 끝) 높이 같음 (" + blB.toFixed(4) + ")");
  ok(Math.abs(top("back") - top("front")) > 0.5, "1: 위 끝 맞춤이 아님(뒤판 위 " + top("back").toFixed(2) + " · 앞판 위 " + top("front").toFixed(2) + ")");
  ok(right("back") < left("front") && right("front") < left("sleeve-sleeve") && ["cuff", "vent-placket", "vent-bias", "collar-stand", "collar-body"].every(id => top(id) > Math.max(bot("back"), bot("front"), bot("sleeve-sleeve"))), "1: 뒤판 · 앞판 · 소매가 한 줄 좌→우 · 부속은 그 아래 줄");
  const ids = M.L.order; let overlap = 0;
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) { const a = ids[i], b = ids[j]; if (left(a) < right(b) && left(b) < right(a) && top(a) < bot(b) && top(b) < bot(a)) overlap++; }
  ok(overlap === 0 && ids.every(id => M.D[id].seam && dense2(M.D[id].outline).every(q => q.x >= M.D[id].bbox.minX - 1e-9)), "1: 시접 포함 테두리끼리 겹침 0 · 테두리 = 시접까지");
  ok(ids.every(id => top(id) >= -1e-9 && left(id) >= -1e-9 && right(id) <= M.L.width + 1e-9 && bot(id) <= M.L.height + 1e-9), "1: 전체 보기 영역(0~폭·높이) 안에 전부");
}
// ══ §2 골 펼침 ══
{
  ["back", "collar-stand", "collar-body"].forEach(id => {
    const x = M.D[id], p = M.d.pieces.find(q => q.id === id), A = x.mirror.A, B = x.mirror.B, Mf = mir(A, B), OL = onLine(A, B);
    const full = dense2(x.outline), half = dense2(p.segs);
    ok(x.unfolded && near(area(full), 2 * area(half), 1e-6), "2: " + id + " 펼침 면적 = 반쪽 × 2 (" + area(full).toFixed(3) + " = 2 × " + area(half).toFixed(3) + ")");
    ok(Math.hypot(x.outline[0].from.x - x.outline[x.outline.length - 1].to.x, x.outline[0].from.y - x.outline[x.outline.length - 1].to.y) < 1e-9 && x.outline.every((g, i) => i === 0 || Math.hypot(g.from.x - x.outline[i - 1].to.x, g.from.y - x.outline[i - 1].to.y) < 1e-9), "2: " + id + " 펼친 외곽 = 끊김 없는 폐곡선");
    ok(full.every(q => dPolyC(Mf(q), full) < 2e-3), "2: " + id + " 골선 대칭(반사한 점이 모두 외곽 위)");
    ok(!x.outline.some(g => g.kind === "line" && OL(g.from) && OL(g.to) && Math.hypot(g.to.x - g.from.x, g.to.y - g.from.y) > 1e-9), "2: " + id + " 골선 위에 외곽 선 없음(중복 중심 없음)");
    const sp = x.seam, sh = M.m.pieces[id].points;
    ok(sp && near(area(sp), 2 * area(sh), 1e-6) && !sp.some((q, i) => { const n = sp[(i + 1) % sp.length]; return OL(q) && OL(n) && Math.hypot(n.x - q.x, n.y - q.y) > 1e-9; }) && sp.every(q => dPolyC(Mf(q), sp) < 1e-6), "2: " + id + " 펼친 시접 = 반쪽 × 2 · 대칭 · 골선 위 시접 선 없음");
    const mirEdges = x.edges.filter(e => !e.fold && e.parts.length === 2).length, nonFold = p.edges.length - 1;
    ok(mirEdges === nonFold && x.edges.find(e => e.fold).id === x.foldEdge, "2: " + id + " 반사 쪽 변 " + mirEdges + "개 = 원래 변 id 그대로(골선은 안쪽 표시 1개)");
  });
  ok(M.D.back.notches.filter(n => n.mirrored).length === M.m.pieces.back.notches.filter(n => n.edgeId !== "center" && n.from).length && M.D.back.notches.filter(n => n.mirrored).every(n => M.m.pieces.back.notches.some(o => o.id === n.id)), "2: 뒤판 너치 반사 = 원래 너치 id(골선 위 WL 은 반사 없음)");
  ok(["front", "sleeve-sleeve", "cuff", "vent-placket", "vent-bias"].every(id => !M.D[id].unfolded), "2: 골선 없는 조각은 펼치지 않음");
  ok(J(S.CUT.derive(P, true).pieces) === PIECES0 && hashes(P) === H0 && !("cutQty" in P.working), "2: 표시 모델은 원본 조각·완료 hash·저장 항목 무변경");
}
// ══ §2b 반사 쪽 클릭 → 원래 변 위치(실제 렌더 경로 좌표 · 25%·50%·75%) ══
{
  const atFrac = (segs, f) => { const pts = []; segs.forEach((g, gi) => dense2([g]).concat([g.to]).forEach((q, i) => { if (i === 0 && gi > 0) return; pts.push(q); }));
    let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    let acc = 0, want = L * f; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); if (acc + d >= want) { const t = (want - acc) / d; return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t }; } acc += d; } return pts[pts.length - 1]; };
  let worst = 0, worstExp = 0, wrongIfIgnored = 0, cases = 0;
  ["back", "collar-stand", "collar-body"].forEach(id => {
    const x = M.D[id], p = M.d.pieces.find(q => q.id === id);
    x.edges.filter(e => !e.fold && e.parts.length === 2).forEach(e => {
      const ed = p.edges.find(q => q.id === e.id), sewnL = S.CUT.sewnChain(p, ed).reduce((t, g) => { const q = dense2([g]).concat([g.to]); let a = 0; for (let i = 1; i < q.length; i++) a += Math.hypot(q[i].x - q[i - 1].x, q[i].y - q[i - 1].y); return t + a; }, 0);
      [0.25, 0.5, 0.75].forEach(f => {
        const qO = atFrac(e.parts[0], f), qM = atFrac(e.parts[1], f);   // 원래 쪽 · 반사 쪽(화면에 그린 경로 그대로)의 같은 비율 점
        const aO = S.CUT.clickArc(p, x, e.id, qO, false), aM = S.CUT.clickArc(p, x, e.id, qM, true), aWrong = S.CUT.clickArc(p, x, e.id, qM, false);
        worst = Math.max(worst, Math.abs(aO - aM)); if (!ed.darts.length) worstExp = Math.max(worstExp, Math.abs(aO - sewnL * f)); if (Math.abs(aWrong - aO) > 0.05) wrongIfIgnored++; cases++;
      });
    });
  });
  ok(cases >= 27 && worst < 1e-6, "2b: 뒤판·밴드·위 칼라 모든 변 × 25·50·75% — 반사 쪽을 눌러도 원래 쪽과 같은 위치(최대 차 " + worst.toExponential(1) + " · " + cases + "경우)");
  ok(worstExp <= 0.01, "2b: 그 위치 = 변 봉제 경로 길이 × 비율(다트 없는 변 · 독립 실측 · 최대 오차 " + worstExp.toExponential(1) + ")");
  ok(wrongIfIgnored >= cases * 0.5, "2b: 반사 표시를 무시하면 다른 위치가 나옴(" + wrongIfIgnored + "/" + cases + ") — 판별이 실제로 필요함을 확인");
  // 실제 저장 경로: 반사 쪽 점으로 사용자 너치 추가 = 원래 쪽 점으로 추가한 것과 같은 atCm
  const e0 = M.D.back.edges.find(e => e.id === "side-seam"), pb = M.d.pieces.find(q => q.id === "back");
  [0.25, 0.75].forEach(f => {
    const a1 = S.CUT.clickArc(pb, M.D.back, "side-seam", atFrac(e0.parts[0], f), false), a2 = S.CUT.clickArc(pb, M.D.back, "side-seam", atFrac(e0.parts[1], f), true);
    const u1 = S.CUT.addNotch("back", "side-seam", a1, P), u2 = S.CUT.addNotch("back", "side-seam", a2, P);
    ok(u1.ok && u2.ok && P.working.cutNotches.notches[u1.id].atCm === P.working.cutNotches.notches[u2.id].atCm, "2b: 뒤판 옆선 " + (f * 100) + "% — 원래 쪽·반사 쪽에서 추가한 너치 저장 위치 같음(" + P.working.cutNotches.notches[u1.id].atCm + ")");
    S.CUT.removeNotch(u1.id, P); S.CUT.removeNotch(u2.id, P);
  });
}

// ══ §3 골 ↔ 봉제선 ══
{
  ok(S.CUT.setEdge("back", "center", { kind: "seam", widthCm: 1.5 }, P).ok, "3: 뒤중심 → 봉제선 1.5");
  let N = model(S, P), p = N.d.pieces.find(q => q.id === "back");
  ok(!N.D.back.unfolded && J(N.D.back.outline) === J(p.segs) && near(Math.min(...N.D.back.seam.map(q => q.x)), -1.5, 1e-9) && N.Q.pieces.back.qty === 2 && N.Q.pieces.back.def === 2, "3: 봉제선 = 반쪽 표시 · 중심 시접 1.5 · 수량 기본 2(좌우)");
  ok(S.CUT.setEdge("back", "center", { kind: "fold" }, P).ok, "3: 다시 골");
  N = model(S, P);
  ok(N.D.back.unfolded && P.working.cutSpec.edges["back|center"].widthCm === 1.5 && N.Q.pieces.back.qty === 1, "3: 다시 펼침 · 전에 적은 폭 1.5 보존 · 수량 1");
  ok(S.CUT.setEdge("back", "side-seam", { widthCm: 2 }, P).ok && (N = model(S, P)) && near(Math.max(...N.D.back.seam.map(q => q.x)), 23.053125 + 2, 1e-9) && near(Math.min(...N.D.back.seam.map(q => q.x)), -(23.053125 + 2), 1e-9), "3: 옆선 시접 2 = 원래 쪽·반사 쪽 둘 다 2(같은 설정 · 복제 아님)");
  S.CUT.setEdge("back", "side-seam", { widthCm: 1 }, P);
  ok(S.CUT.setEdge("collar-stand", "cb-fold", { kind: "seam", widthCm: 1 }, P).ok && (N = model(S, P)) && !N.D["collar-stand"].unfolded && N.Q.pieces["collar-stand"].qty === 4, "3: 밴드 뒤중심 봉제선 = 반쪽 · 수량 기본 4(좌우 × 겉·안)");
  S.CUT.setEdge("collar-stand", "cb-fold", { kind: "fold" }, P);
}
// ══ §4 재단 수량 ══
{
  M = model(S, P);
  const want = { back: 1, front: 2, "sleeve-sleeve": 2, cuff: 2, "collar-body": 2, "collar-stand": 2, "vent-placket": 2, "vent-bias": 2 };
  ok(Object.keys(want).every(k => M.Q.pieces[k].qty === want[k] && !M.Q.pieces[k].explicit) && M.Q.state === "none", "4: master 기본 수량(뒤판 골 1 · 앞판 2 · 소매 2 · 커프스 2 · 위 칼라 골 2 · 밴드 골 2 · 덧단 2 · 바이어스 2)");
  ok(/골/.test(M.Q.pieces.back.how) && /겉·안/.test(M.Q.pieces["collar-body"].how) && /좌우/.test(M.Q.pieces.front.how), "4: 표시 = 골 · 펼친 한 장 / 겉·안 / 좌우 대칭");
  const spec0 = J(P.working.cutSpec), nt0 = J(P.working.cutNotches || null);
  ok(S.CUT.setQty("front", 4, P).ok && J(P.working.cutQty) === J({ schema: 1, pieces: { front: 4 } }) && model(S, P).Q.pieces.front.explicit, "4: 앞판 4 로 수정 → working.cutQty 에 그 값만");
  const bad = [0, 100, 1.5, -1, NaN, "2", null === 0];
  ok([0, 100, 1.5, -1, NaN, "2"].every(v => !S.CUT.setQty("front", v, P).ok) && !S.CUT.setQty("nope", 2, P).ok && J(P.working.cutQty) === J({ schema: 1, pieces: { front: 4 } }), "4: 0 · 100 · 1.5 · 음수 · NaN · 문자열 · 없는 조각 = 거부(아무것도 안 씀)");
  ok(J(P.working.cutSpec) === spec0 && J(P.working.cutNotches || null) === nt0 && hashes(P) === H0 && S.DR.isCurrentDesignChanged(P) === false, "4: 시접·너치 설정·완료 hash 무변경 · «변경됨» 아님");
  const AT = { savedAt: "2026-11-15T00:00:00.000Z" }, text = S.PF.buildFileText(AT).text;
  const S2 = makeSession(), v2 = S2.PF.verifyText(text); S2.PF.commitCandidate(v2.candidate);
  ok(v2.ok && J(S2.P().working.cutQty) === J(P.working.cutQty) && model(S2, S2.P()).Q.pieces.front.qty === 4 && S2.PF.buildFileText(AT).text === text && JSON.parse(text).schemaVersion === 1, "4: 저장 → 빈 세션 열기 = 수량 복원 · 다시 저장 바이트 동일 · schemaVersion 1");
  ok(S.CUT.setQty("front", null, P).ok && J(P.working.cutQty.pieces) === "{}" && model(S, P).Q.pieces.front.qty === 2, "4: «기본값» = 저장값 삭제 → 기본 2");
  const old = buildP(), oldText = old.S.PF.buildFileText(AT).text, S3 = makeSession(), v3 = S3.PF.verifyText(oldText); S3.PF.commitCandidate(v3.candidate);
  ok(!/cutQty/.test(oldText) && S3.P().working.cutQty === undefined && model(S3, S3.P()).Q.pieces.back.qty === 1, "4: 수량 항목 없는 파일 = 기본값으로 열림(항목을 만들지 않음)");
  const wrong = [{ schema: 2, pieces: {} }, { schema: 1 }, { schema: 1, pieces: {}, x: 1 }, { schema: 1, pieces: { front: 0 } }, { schema: 1, pieces: { front: 2.5 } }, { schema: 1, pieces: { "Front!": 2 } }, { schema: 1, pieces: [] }];
  ok(wrong.every(w => { const S4 = makeSession(), v4 = S4.PF.verifyText(oldText); S4.PF.commitCandidate(v4.candidate); const P4 = S4.P(); P4.working.cutQty = JSON.parse(J(w)); const q = S4.CUT.readQty(P4), x = S4.CUT.setQty("front", 3, P4);
    return q.state === "invalid" && model(S4, P4).Q.pieces.back.qty === 1 && !x.ok && J(P4.working.cutQty) === J(w); }), "4: 구조가 틀린 수량 항목 7종 = 읽지 않음(기본값 표시) · 수정 잠금 · 값 그대로");
  { const S5 = makeSession(), v5 = S5.PF.verifyText(oldText); S5.PF.commitCandidate(v5.candidate); const P5 = S5.P(); P5.working.cutQty = { schema: 1, pieces: JSON.parse('{"__proto__":2}') };
    let res = null; try { res = S5.PF.buildFileText(AT); } catch (e) { res = { thrown: e && e.reason }; } ok(!(res && res.text) && /forbidden-key/.test(J(res)), "4: 금지 키가 든 수량 = 기존 저장 정책이 거부"); }
}

console.log("cutLayoutCheck: " + PASS + " passed, " + FAIL + " failed");
fails.forEach(f => console.log("  FAIL " + f));
process.exit(FAIL ? 1 : 0);
