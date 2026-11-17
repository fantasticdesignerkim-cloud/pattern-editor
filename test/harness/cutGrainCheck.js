// ══════════════════════════════════════════════
// cutGrainCheck.js — 재단 화면: 식서(올 방향) 표시(실제 엔진 · 2026-11-16 master 승인 · working.cutGrain 판 1)
//   §1 기본 방향 = [패턴학교] P.169 완성 예(뒤·앞·소매 세로 · 위 칼라·밴드·커프스 길이 방향 · 덧단 길이 · 바이어스 45°) · 조각마다 하나(펼친 조각도 하나) · 근거 없는 조각 = 기본 없음
//   §2 화살표는 조각 안(외곽에서 여백) — 모든 조각 · 뒤판 각도 훑기 · 오목한 모양에서 밖을 지나지 않음 · 가운데가 밖이면 그리지 않음
//   §3 수정: 각도·자리 저장(고친 값만) · 거부(범위 밖·조각 밖·숫자 아님) · 기본값 복귀 · 골 → 봉제선에서 반사 쪽 자리 = 기본 자리 표시(저장값 보존)
//   §4 저장 → 열기 · 구파일 기본값 · 엄격 검증(틀린 구조 = 읽지 않음·잠금·값 보존) · 원본·hash·시접·너치·수량 무변경
//   node test/harness/cutGrainCheck.js
// ══════════════════════════════════════════════
"use strict";
const vm = require("vm"), fs = require("fs"), path = require("path");
let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
process.on("uncaughtException", e => { console.log("cutGrainCheck: 예외 — " + (e && e.stack || e).toString().split("\n").slice(0, 3).join(" | ")); fails.slice(0, 20).forEach(f => console.log("  ✗ " + f)); process.exit(1); });
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

const gm = (S, P) => { const m = model(S, P); m.G = S.CUT.grainOf(m.d, m.D, P); return m; };
const r = buildP(), S = r.S, P = r.P, H0 = hashes(P), PIECES0 = J(S.CUT.derive(P, true).pieces);
const keep = () => J([P.working.cutSpec || null, P.working.cutNotches || null, P.working.cutQty || null]), K0 = keep();
let M = gm(S, P);
const polyD = segs => denseOf(segs);
const SIG = id => S.CUT.grainSig(S.CUT.derive(P, true).pieces.filter(p => p.id === id)[0]), SG = "n1-a-b";
const lineOK = (g, poly, minClear) => { let okk = true, mc = Infinity; for (let k = 0; k <= 40; k++) { const q = { x: g.from.x + (g.to.x - g.from.x) * k / 40, y: g.from.y + (g.to.y - g.from.y) * k / 40 }; if (!inPoly(q, poly)) okk = false; mc = Math.min(mc, dPts(q, poly.concat([poly[0]]))); } return okk && mc >= minClear; };

// ══ §1 기본 방향 ══
{
  const G = M.G, a = id => G.pieces[id] && G.pieces[id].angleDeg;
  ok(r.ok && G.state === "none" && P.working.cutGrain === undefined, "1: 처음 = 저장 항목 없음(기본값은 계산만 · 항목을 만들지 않음)");
  ok(a("back") === 90 && a("front") === 90 && a("sleeve-sleeve") === 90, "1: 뒤·앞·소매 = 세로 90°(중심선과 평행)");
  ok(a("collar-body") === 0 && a("collar-stand") === 0 && a("cuff") === 0, "1: 위 칼라·밴드·커프스 = 길이 방향 0° " + J([a("collar-body"), a("collar-stand"), a("cuff")]));
  ok(a("vent-placket") === 90 && (a("vent-bias") === 45 || a("vent-bias") === 135), "1: 덧단 = 길이 방향 · 트임 바이어스 = 45° " + J([a("vent-placket"), a("vent-bias")]));
  ok(Object.keys(G.pieces).every(k => /P\.169|P\.91/.test(G.pieces[k].basis || "")), "1: 기본값마다 교재 근거 문구(P.169 · 바이어스 P.91)");
  ok(Object.keys(G.pieces).join(",") === M.d.pieces.map(p => p.id).join(",") && Object.keys(G.pieces).every(k => G.pieces[k].ok && G.pieces[k].from && G.pieces[k].to && !Array.isArray(G.pieces[k].from)), "1: 조각마다 화살표 하나(8조각 전부 표시)");
  ok(M.D.back.unfolded && M.D["collar-body"].unfolded && G.pieces.back.unfolded && G.pieces.back.at.x > 0 && G.pieces["collar-body"].at.x > 0.2, "1: 골 펼친 조각 = 하나만 · 원래 쪽에 둠(반사 쪽에 복제 없음)");
  const fake = id => S.CUT.defaultGrain({ id, edges: [], marks: [], segs: [] });
  ok(fake("yoke-back").angleDeg === null && /직접 지정/.test(fake("yoke-back").why) && fake("sleeve-upper").angleDeg === null, "1: 근거를 확인하지 못한 조각 = 기본 없음(추정하지 않음)");
  ok(G.pieces.back.lenCm <= 10 + 1e-9 && G.pieces["vent-bias"].lenCm >= 1.2, "1: 길이는 저장값이 아니라 자리에서 계산(최대 10 · 최소 1.2)");
}

// ══ §2 조각 안 ══
{
  const G = M.G;
  const cl = M.d.pieces.map(p => { let mc = Infinity; const g = G.pieces[p.id], poly = polyD(M.D[p.id].outline); for (let k = 0; k <= 40; k++) mc = Math.min(mc, dPts({ x: g.from.x + (g.to.x - g.from.x) * k / 40, y: g.from.y + (g.to.y - g.from.y) * k / 40 }, poly.concat([poly[0]]))); return p.id + " " + mc.toFixed(2); });
  ok(M.d.pieces.every(p => lineOK(G.pieces[p.id], polyD(M.D[p.id].outline), 0.3)), "2: 모든 조각 — 화살표 41점 전부 조각 안 · 외곽에서 0.3cm 이상 " + cl.join(" / "));
  const pb = polyD(M.D.back.outline), at = G.pieces.back.at; let bad = 0, n = 0;
  for (let ang = 0; ang < 180; ang += 7) { const g = S.CUT.grainLine(pb, at, ang); n++; if (!g.ok || !lineOK(g, pb, 0.45)) bad++; }
  ok(bad === 0 && n === 26, "2: 뒤판 같은 자리에서 각도 0~175° 26가지 — 전부 조각 안");
  // 오목(ㄷ자): 왼쪽 팔에서 가로로 그으면 홈 앞에서 멈춘다(홈을 건너 오른쪽 팔까지 가지 않는다)
  const U = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 12 }, { x: 16, y: 12 }, { x: 16, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }, { x: 0, y: 20 }];
  const g1 = S.CUT.grainLine(U, { x: 2, y: 5 }, 0);
  ok(g1.ok && near(g1.from.x, 0.5, 1e-9) && near(g1.to.x, 3.5, 1e-9) && lineOK(g1, U, 0.45), "2: 오목 조각 — 팔 안에서만(0.5 → 3.5) · 홈을 건너지 않음 " + J([g1.from.x, g1.to.x]));
  const g2 = S.CUT.grainLine(U, { x: 10, y: 16 }, 0); ok(g2.ok && near(g2.lenCm, 10, 1e-9) && lineOK(g2, U, 0.45), "2: 넓은 자리 = 최대 길이 10");
  ok(!S.CUT.grainLine(U, { x: 10, y: 5 }, 0).ok && !S.CUT.grainLine(U, { x: 30, y: 5 }, 90).ok, "2: 가운데가 홈·조각 밖 = 그리지 않음");
  ok(!S.CUT.grainLine(U, { x: 0.3, y: 5 }, 0).ok, "2: 외곽에 너무 붙어 들어가지 않는 자리 = 그리지 않음");
  ok(!S.CUT.grainLine(U, { x: 0.2, y: 6 }, 90).ok && S.CUT.grainLine(U, { x: 0.35, y: 6 }, 90).ok, "2: 외곽과 나란히 0.3cm 안쪽으로 붙은 자리 = 그리지 않음(화살촉이 밖으로 나가지 않게)");
  const g3 = S.CUT.grainLine(U, { x: 2, y: 5 }, 90); ok(g3.ok && lineOK(g3, U, 0.45), "2: 같은 자리 세로 = 팔 안");
}

// ══ §3 수정 ══
{
  let x = S.CUT.setGrain("front", { angleDeg: 30 }, P); M = gm(S, P);
  ok(x.ok && J(P.working.cutGrain) === J({ schema: 1, pieces: { front: { sig: SIG("front"), angleDeg: 30 } } }) && M.G.pieces.front.angleDeg === 30 && M.G.pieces.front.explicitAngle && M.G.pieces.front.ok && lineOK(M.G.pieces.front, polyD(M.D.front.outline), 0.45), "3: 각도 30° = 고친 값만 저장 · 표시 · 조각 안");
  const at = { x: M.G.pieces.front.at.x - 3, y: M.G.pieces.front.at.y + 4 }; x = S.CUT.setGrain("front", { at }, P); M = gm(S, P);
  ok(x.ok && near(M.G.pieces.front.at.x, at.x, 1e-3) && M.G.pieces.front.explicitAt && near((M.G.pieces.front.from.x + M.G.pieces.front.to.x) / 2, at.x, 1e-3) && P.working.cutGrain.pieces.front.angleDeg === 30, "3: 자리 옮김 = 저장 · 화살표 가운데 = 그 자리 · 각도 유지");
  const before = J(P.working.cutGrain);
  const rej = [["front", { at: { x: 999, y: 0 } }], ["front", { at: { x: 23.2, y: 30 } }], ["front", { angleDeg: -1 }], ["front", { angleDeg: 181 }], ["front", { angleDeg: NaN }], ["front", { angleDeg: "90" }], ["front", { at: { x: "1", y: 2 } }], ["nope", { angleDeg: 10 }], ["front", null]];
  ok(rej.every(a => { const q = S.CUT.setGrain(a[0], a[1], P); return !q.ok && q.reason && J(P.working.cutGrain) === before; }), "3: 조각 밖 자리 · 외곽에 붙은 자리 · 범위 밖 각도 · 숫자 아님 · 없는 조각 = 거부(저장값 그대로) 9종");
  x = S.CUT.setGrain("cuff", { angleDeg: 180 }, P); ok(x.ok && P.working.cutGrain.pieces.cuff.angleDeg === 0, "3: 180° = 0° 으로 저장(같은 방향 · 0 ≤ 각도 < 180)");
  x = S.CUT.setGrain("cuff", { angleDeg: null, at: null }, P); const y = S.CUT.setGrain("front", { angleDeg: null, at: null }, P); M = gm(S, P);
  ok(x.ok && y.ok && J(P.working.cutGrain) === J({ schema: 1, pieces: {} }) && M.G.pieces.front.angleDeg === 90 && !M.G.pieces.front.explicitAngle, "3: 기본값으로 = 항목 삭제 · 기본 방향 표시");
  { const rb = buildP(), S = rb.S, P = rb.P; let M = gm(S, P), x;
  // 골 펼친 뒤판: 반사 쪽에 둠 → 봉제선으로 바꾸면 그 자리는 반쪽 밖 → 기본 자리에 표시(저장값은 보존) → 다시 골 = 옮긴 자리
  const mat = { x: -M.G.pieces.back.at.x, y: M.G.pieces.back.at.y }; x = S.CUT.setGrain("back", { at: mat }, P); M = gm(S, P);
  ok(x.ok && M.G.pieces.back.at.x < 0 && lineOK(M.G.pieces.back, polyD(M.D.back.outline), 0.45), "3: 펼친 뒤판 = 반사 쪽에도 둘 수 있음(여전히 하나)");
  const sv = J(P.working.cutGrain), se = S.CUT.setEdge("back", "center", { kind: "seam", widthCm: 1 }, P); M = gm(S, P);
  ok(se.ok && !M.D.back.unfolded && M.G.pieces.back.ok && M.G.pieces.back.atStale && M.G.pieces.back.at.x > 0 && lineOK(M.G.pieces.back, polyD(M.D.back.outline), 0.45) && J(P.working.cutGrain) === sv, "3: 골 → 봉제선 = 반쪽 밖이 된 자리 대신 기본 자리에 표시 · 조각 안 · 저장값 보존");
  S.CUT.setEdge("back", "center", { kind: "fold", widthCm: 0 }, P); M = gm(S, P);
  ok(M.D.back.unfolded && !M.G.pieces.back.atStale && near(M.G.pieces.back.at.x, mat.x, 1e-3), "3: 다시 골 = 옮겨 둔 자리로");
  }
}

// ══ §4 저장 · 열기 · 엄격 검증 · 보존 ══
{
  S.CUT.setGrain("sleeve-sleeve", { angleDeg: 45 }, P); const g0 = gm(S, P).G.pieces["sleeve-sleeve"]; S.CUT.setGrain("sleeve-sleeve", { at: { x: g0.at.x + 1, y: g0.at.y + 2 } }, P);
  const AT = { savedAt: "2026-11-16T00:00:00.000Z" }, text = S.PF.buildFileText(AT).text;
  const S2 = makeSession(), v2 = S2.PF.verifyText(text); if (v2.ok) S2.PF.commitCandidate(v2.candidate);
  const G2 = v2.ok ? gm(S2, S2.P()).G : null, G1 = gm(S, P).G;
  ok(v2.ok && J(S2.P().working.cutGrain) === J(P.working.cutGrain) && J(G2.pieces) === J(G1.pieces) && S2.PF.buildFileText(AT).text === text && JSON.parse(text).schemaVersion === 1, "4: 저장 → 열기 = 식서 그대로 · 다시 저장 = 같은 글자 · 파일 판 1 그대로");
  const old = buildP(), oldText = old.S.PF.buildFileText(AT).text, S3 = makeSession(), v3 = S3.PF.verifyText(oldText); S3.PF.commitCandidate(v3.candidate);
  ok(!/cutGrain/.test(oldText) && S3.P().working.cutGrain === undefined && gm(S3, S3.P()).G.pieces.back.angleDeg === 90 && S3.P().working.cutGrain === undefined, "4: 식서 항목 없는 파일 = 기본값으로 열림(항목을 만들지 않음)");
  const wrong = [{ schema: 2, pieces: {} }, { schema: 1 }, { schema: 1, pieces: {}, x: 1 }, { schema: 1, pieces: [] }, { schema: 1, pieces: { front: {} } }, { schema: 1, pieces: { front: { sig: SG, angleDeg: 180 } } }, { schema: 1, pieces: { front: { sig: SG, angleDeg: -0.1 } } },
    { schema: 1, pieces: { front: { sig: SG, angleDeg: "90" } } }, { schema: 1, pieces: { front: { sig: SG, angleDeg: 90, len: 5 } } }, { schema: 1, pieces: { front: { sig: SG, at: { x: 1 } } } }, { schema: 1, pieces: { front: { sig: SG, at: { x: 1, y: 2, z: 3 } } } }, { schema: 1, pieces: { front: { sig: SG, at: { x: 1, y: null } } } },
    { schema: 1, pieces: { "Front!": { sig: SG, angleDeg: 1 } } }, { schema: 1, pieces: { front: 90 } }, { schema: 1, pieces: { front: { sig: SG, at: { x: 1e9, y: 0 } } } },
    { schema: 1, pieces: { front: { angleDeg: 30 } } }, { schema: 1, pieces: { front: { sig: SG } } }, { schema: 1, pieces: { front: { sig: "x", angleDeg: 30 } } }, { schema: 1, pieces: { front: { sig: 5, angleDeg: 30 } } }];
  ok(wrong.length === 19 && wrong.every(w => { const S4 = makeSession(), v4 = S4.PF.verifyText(oldText); S4.PF.commitCandidate(v4.candidate); const P4 = S4.P(); P4.working.cutGrain = JSON.parse(J(w)); const q = S4.CUT.readGrain(P4), x = S4.CUT.setGrain("front", { angleDeg: 10 }, P4), G4 = gm(S4, P4).G;
    return q.state === "invalid" && G4.state === "invalid" && G4.pieces.front.angleDeg === 90 && G4.pieces.front.ok && !x.ok && J(P4.working.cutGrain) === J(w); }), "4: 구조가 틀린 식서 항목 19종(서명 없음·서명뿐·서명 형식 포함) = 읽지 않음(기본값 표시) · 수정 잠금 · 값은 지우지 않음");
  { const S5 = makeSession(), v5 = S5.PF.verifyText(oldText); S5.PF.commitCandidate(v5.candidate); const P5 = S5.P(); P5.working.cutGrain = { schema: 1, pieces: JSON.parse('{"__proto__":{"angleDeg":1}}') };
    let res = null; try { res = S5.PF.buildFileText(AT); } catch (e) { res = { thrown: e && e.reason }; } ok(!(res && res.text) && /forbidden-key/.test(J(res)), "4: 금지 키가 든 식서 = 기존 저장 검증이 거부"); }
  { const P6 = S3.P(); P6.working.cutGrain = { schema: 1, pieces: { gone: { sig: SG, angleDeg: 10 } } }; const G6 = gm(S3, P6).G; ok(G6.state === "ok" && G6.stale.join() === "gone" && G6.pieces.back.ok, "4: 지금 없는 조각의 식서 = 남겨 두고 알림 목록에만(다른 조각 정상)"); }
  S.CUT.setGrain("sleeve-sleeve", { angleDeg: null, at: null }, P);
  ok(hashes(P) === H0 && J(S.CUT.derive(P, true).pieces) === PIECES0 && keep() === K0, "4: 원본 조각 · 완료 hash · 시접/너치/수량 설정 = 처음과 같음");
  const SRCC = fs.readFileSync(path.join(ROOT, "js", "cutPrep.js"), "utf8");
  ok((SRCC.match(/"class": "cut-grain-line"/g) || []).length === 1 && /if \(gl\.ok\) \{ gdrag\.at = nat;/.test(SRCC) && /setGrain\(gd0\.pid, \{ at: gd0\.at \}/.test(SRCC), "4: 화면 = 조각당 화살표 한 번만 그림 · 끌기는 들어가는 자리로만 따라옴 · 놓을 때 검증 저장");
}

// ══ §5 조각 외곽이 바뀌면 = 보류(자동 삭제·조용한 적용 없음) ══
{
  const rb = buildP(), S = rb.S, P = rb.P, SIGp = id => S.CUT.grainSig(S.CUT.derive(P, true).pieces.filter(p => p.id === id)[0]);
  let M = gm(S, P); const H = hashes(P), at0 = M.G.pieces.front.at, sig0 = SIGp("front");
  S.CUT.setGrain("front", { angleDeg: 30 }, P); M = gm(S, P); const at1 = { x: M.G.pieces.front.at.x - 2, y: M.G.pieces.front.at.y + 3 }; S.CUT.setGrain("front", { at: at1 }, P);
  S.CUT.setGrain("cuff", { angleDeg: 45 }, P);
  // 오탐 금지: 시접 폭 · 수량 · 골↔봉제선(표시 펼침)만 바뀜
  const e0 = M.d.pieces.filter(p => p.id === "front")[0].edges[0].id, w = S.CUT.setEdge("front", e0, { kind: "seam", widthCm: 2.5 }, P), qy = S.CUT.setQty ? S.CUT.setQty("front", 4, P) : { ok: true };
  const fe = S.CUT.setEdge("back", "center", { kind: "seam", widthCm: 1 }, P); S.CUT.setGrain("back", { angleDeg: 80 }, P); S.CUT.setEdge("back", "center", { kind: "fold", widthCm: 0 }, P); M = gm(S, P);
  ok(w.ok && qy.ok && fe.ok && SIGp("front") === sig0 && M.G.held.length === 0 && !M.G.pieces.front.held && M.G.pieces.front.angleDeg === 30 && M.G.pieces.front.explicitAt && M.G.pieces.back.angleDeg === 80 && !M.G.pieces.back.held, "5: 시접 폭 · 수량 · 골 펼침만 바뀜 = 서명 그대로 · 보류 없음(오탐 없음)");
  ok(hashes(P) === H, "5: 식서 서명 저장 = 완료 hash 무변경");
  // 같은 id · 같은 bbox 안에서 외곽만 바뀜: 저장 서명을 «다른 외곽» 것으로 바꿔 넣어 재현 + 실제 조각으로 서명 민감도 확인
  const pf = M.d.pieces.filter(p => p.id === "front")[0], bbOf = sg => { const q = denseOf(sg); return J([Math.min(...q.map(a => a.x)), Math.max(...q.map(a => a.x)), Math.min(...q.map(a => a.y)), Math.max(...q.map(a => a.y))].map(v => +v.toFixed(3))); };
  const ci = pf.segs.findIndex(g => g.kind === "cubic"), alt = JSON.parse(J(pf.segs)); alt[ci].c1 = { x: alt[ci].c1.x * 0.5 + alt[ci].c2.x * 0.5, y: alt[ci].c1.y * 0.5 + alt[ci].c2.y * 0.5 };
  const sigAlt = S.CUT.grainSig({ segs: alt }), tiny = JSON.parse(J(pf.segs)); tiny[ci].c1.x += 0.004;
  const noise = JSON.parse(J(pf.segs)); noise[0].from.x += 1e-7;
  ok(ci >= 0 && bbOf(alt) === bbOf(pf.segs) && sigAlt !== sig0 && S.CUT.grainSig({ segs: tiny }) !== sig0 && S.CUT.grainSig({ segs: noise }) === sig0 && S.CUT.grainSig(pf) === sig0, "5: 같은 bbox · 곡선 조절점만 다른 외곽 = 다른 서명 / 0.004cm 차이도 구분 / 1e-7 잡음 = 같은 서명 " + J([sig0, sigAlt]));
  P.working.cutGrain.pieces.front.sig = sigAlt; const kept = J(P.working.cutGrain); M = gm(S, P); const gf = M.G.pieces.front;
  ok(M.G.state === "ok" && J(M.G.held) === J(["front"]) && gf.held && gf.heldAngleDeg === 30 && near(gf.heldAt.x, at1.x, 1e-3) && /외곽/.test(gf.heldWhy) && gf.angleDeg === 90 && gf.tempDefault && !gf.explicitAngle && !gf.explicitAt && near(gf.at.x, at0.x, 1e-6) && gf.ok && J(P.working.cutGrain) === kept,
    "5: 외곽이 바뀐 조각 = 예전 각도·자리 적용 안 함 · 임시 기본 방향 표시(표지 있음) · 이유 · 저장값 그대로(자동 삭제 없음)");
  ok(!M.G.pieces.cuff.held && M.G.pieces.cuff.angleDeg === 45, "5: 다른 조각의 설정은 그대로 적용");
  const text = S.PF.buildFileText({ savedAt: "2026-11-16T00:00:00.000Z" }).text, S2 = makeSession(), v2 = S2.PF.verifyText(text); if (v2.ok) S2.PF.commitCandidate(v2.candidate);
  ok(v2.ok && J(S2.P().working.cutGrain) === kept && gm(S2, S2.P()).G.pieces.front.held, "5: 보류 상태로 저장 → 열기 = 보류 값 보존 · 여전히 보류");
  // 다시 연결: 지금 외곽에 들어가면 연결 / 안 들어가면 거부(값 그대로)
  const none = S.CUT.relinkGrain("cuff", P), rl = S.CUT.relinkGrain("front", P); M = gm(S, P);
  ok(!none.ok && rl.ok && P.working.cutGrain.pieces.front.sig === sig0 && !M.G.pieces.front.held && M.G.pieces.front.angleDeg === 30 && near(M.G.pieces.front.at.x, at1.x, 1e-3), "5: «이전 설정 다시 쓰기» = 눌렀을 때만 연결 · 예전 각도·자리 복귀 / 보류 없는 조각은 거부");
  P.working.cutGrain.pieces.front = { sig: sigAlt, angleDeg: 30, at: { x: 999, y: 0 } }; const k2 = J(P.working.cutGrain), rl2 = S.CUT.relinkGrain("front", P);
  ok(!rl2.ok && /들어가지 않/.test(rl2.reason) && J(P.working.cutGrain) === k2, "5: 예전 자리가 지금 외곽에 안 들어감 = 연결 거부 + 이유 · 저장값 그대로");
  // 보류 중 직접 고침 = 지금 외곽에 대한 새 설정(예전 자리를 조용히 이어 쓰지 않음)
  const sg = S.CUT.setGrain("front", { angleDeg: 60 }, P);
  ok(sg.ok && sg.replacedHeld && J(P.working.cutGrain.pieces.front) === J({ sig: sig0, angleDeg: 60 }), "5: 보류 중 각도를 직접 적음 = 새 설정(지금 서명) · 예전 자리는 따라오지 않음 · 바뀜을 알림");
  P.working.cutGrain.pieces.front = { sig: sigAlt, angleDeg: 30 }; const rs = S.CUT.setGrain("front", { angleDeg: null, at: null }, P); M = gm(S, P);
  ok(rs.ok && !("front" in P.working.cutGrain.pieces) && !M.G.pieces.front.held && M.G.pieces.front.angleDeg === 90, "5: 보류 중 «기본값» = 사용자가 눌러 항목 삭제 · 기본 방향");
  // 기본 방향이 없는 조각의 보류: 자리만 저장돼 있으면 다시 쓰기 거부 문구
  ok(M.G.pieces.back.angleDeg === 80 && !M.G.pieces["collar-body"].held && M.G.pieces["collar-body"].angleDeg === 0 && !M.G.pieces["collar-body"].tempDefault, "5: 설정이 없는 조각 = 기본 방향 그대로(임시 표지 없음)");
  const SRC5 = fs.readFileSync(path.join(ROOT, "js", "cutPrep.js"), "utf8"), CSS5 = fs.readFileSync(path.join(ROOT, "css", "apple.css"), "utf8");
  ok(/data-grain-relink/.test(SRC5) && /임시 기본 방향/.test(SRC5) && /is-held/.test(SRC5) && /\.cut-grain\.is-held/.test(CSS5), "5: 화면 = 보류 이유 · 임시 기본 표지 · «이전 설정 다시 쓰기»·«기본값» 버튼 · 보류 화살표 구분 표시");
}

// ══ §6 각도 칸 빈칸·잘못된 값 = 설정 그대로(2026-11-17 야간 리뷰 · 재현: 빈칸 Tab/Enter 가 직접 지정 30° 와 보류 설정을 지웠다) ══
{
  const src = fs.readFileSync(path.join(ROOT, "js", "cutPrep.js"), "utf8"), h = (src.match(/if \(t\.matches && t\.matches\("input\[data-grain-angle\]"\)\) \{[\s\S]*?grainAngle\(gpid, gv, t\); return; \}/) || [""])[0];
  ok(h && /t\.validity && t\.validity\.badInput\) \{ grainInputError\(t, gpid, "숫자로 읽을 수 없습니다"\); return; \}/.test(h) && /graw === ""\) \{ grainInputError\(t, gpid, "각도 칸이 비어 있습니다"\); return; \}/.test(h) && /!Number\.isFinite\(gv\)\) \{ grainInputError/.test(h) && !/null/.test(h),
    "6: 각도 칸 처리 = 빈칸·숫자 아님은 setGrain 을 부르지 않고 이유만(빈칸을 null(기본 복귀)로 넘기지 않음)");
  const ge = (src.match(/function grainInputError\([\s\S]*?\n  \}\n/) || [""])[0];
  ok(ge && !/setGrain|reseam|cutGrain|delete /.test(ge) && /aria-invalid/.test(ge) && /«기본값»을 누르세요/.test(ge) && /보류해 둔 저장 설정은 그대로 남습니다/.test(ge) && /일반 DXF 는 GRAIN_HELD 레이어/.test(ge) && /AAMA DXF 는 식서선을 넣지 않습니다/.test(ge), "6: 이유 표시 함수 = 저장값·다시 그리기를 건드리지 않음(칸 글자 그대로 · 고쳐 쓸 수 있음) · 지금 쓰는 값 안내(보류 = 일반 DXF 임시 점선 GRAIN_HELD / AAMA 식서선 없음 구별) · 기본 복귀는 «기본값» 단추만");
  ok(/if \(!r\.ok && input\) return grainInputError\(input, pid, r\.reason\);/.test(src), "6: 범위 밖·안 들어가는 각도도 칸을 지우지 않고 이유만(저장값 그대로)");
  // 모델: 0° 는 유효 · 빈칸에 해당하는 값으로는 아무것도 바꾸지 않는다(칸 처리에서 막힘) · «기본값»(null)만 지움
  const r0 = buildP(), S0 = r0.S, P0 = r0.P, h0 = J([P0.working.bodiceResult, P0.working.designResult].map(x => x && x.hash));
  ok(S0.CUT.setGrain("front", { angleDeg: 0 }, P0).ok && P0.working.cutGrain.pieces.front.angleDeg === 0, "6: 0° = 유효한 각도(가로) — 저장됨(빈칸과 구별)");
  const keep = J(P0.working.cutGrain);
  ["", "abc", NaN, Infinity, 200, -1].forEach(v => { const n = typeof v === "string" ? (v.trim() === "" ? undefined : Number(v)) : v; if (n === undefined || !Number.isFinite(n)) return; S0.CUT.setGrain("front", { angleDeg: n }, P0); });
  ok(J(P0.working.cutGrain) === keep, "6: 범위 밖 숫자(200 · −1)는 setGrain 이 거부 — 저장값 그대로");
  ok(S0.CUT.setGrain("front", { angleDeg: null, at: null }, P0).ok && !P0.working.cutGrain.pieces.front && J([P0.working.bodiceResult, P0.working.designResult].map(x => x && x.hash)) === h0, "6: «기본값»(명시적 null)만 항목을 지움 · 완료 hash 그대로");
}

console.log("cutGrainCheck: " + PASS + " passed, " + FAIL + " failed");
fails.forEach(f => console.log("  FAIL " + f));
process.exit(FAIL ? 1 : 0);
