// ══════════════════════════════════════════════
// cutPrintCheck.js — 재단 결과 실물 크기(1:1) A4 이어 붙이기 인쇄(js/cutPrint.js · 2026-11-16 master 승인 · 실제 엔진)
//   §1 여백·겹침 값 · §2 사전 점검(기본/직접 지정/보류/미정 구별) · §3 1:1 치수·타일·누락 없음·복제 없음
//   §4 막는 경우(미완성·검사 실패·읽을 수 없는 저장값) · §5 원본·hash·저장 불변 · §6 경계 케이스 · §7 화면·문구·전송 없음
//   CUTPRINT_OUT=<폴더> 를 주면 실제 인쇄용 HTML 과 기대값(JSON)을 그 폴더에 쓴다(실제 PDF 검사용 · 저장소 밖).
//   node test/harness/cutPrintCheck.js
// ══════════════════════════════════════════════
"use strict";
const vm = require("vm"), fs = require("fs"), path = require("path");
let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
process.on("uncaughtException", e => { console.log("cutPrintCheck: 예외 — " + (e && e.stack || e).toString().split("\n").slice(0, 3).join(" | ")); fails.slice(0, 20).forEach(f => console.log("  ✗ " + f)); process.exit(1); });
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
  "designSleeveA.js", "designCuff.js", "sleeveAApply.js", "sleeveAnnotation.js", "designCollar.js", "collarPresets.js", "collarCheckpoint.js", "designResult.js", "projectFile.js", "seamMatch.js", "seamAllowance.js", "cutPrep.js", "cutPrint.js"].concat(SLEEVE_EXTRA);
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

const PR = S0 => S0.W.cutPrint, META = { version: "vTEST", createdAt: "2026-11-16 00:00" };
const r = buildP(), S = r.S, P = r.P, H0 = hashes(P), PIECES0 = J(S.CUT.derive(P, true).pieces);
const num = s => parseFloat(s);
const tilesOf = body => [...body.matchAll(/<svg class="cp-page"[^>]*width="([\d.]+)mm" height="([\d.]+)mm" viewBox="0 0 ([\d.]+) ([\d.]+)"><g class="cp-bandg">([\s\S]*?)<\/g><svg class="cp-tile" x="0" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" viewBox="(-?[\d.]+) (-?[\d.]+) ([\d.]+) ([\d.]+)" data-row="(\d+)" data-col="(\d+)">([\s\S]*?)<\/svg><\/svg>/g)].map(m => ({ pwmm: num(m[1]), phmm: num(m[2]), pw: num(m[3]), ph: num(m[4]), band: m[5], by: num(m[6]), nw: num(m[7]), nh: num(m[8]),
  wmm: num(m[7]) * num(m[1]) / num(m[3]), hmm: num(m[8]) * num(m[2]) / num(m[4]), x: num(m[9]), y: num(m[10]), w: num(m[11]), h: num(m[12]), row: +m[13], col: +m[14], inner: m[15] }));
// 독립 계측: 화면용 모델(D·L)에서 재단선·완성선·너치·식서 점을 «전체 한 장» 좌표로 직접 만든다(cutPrint 코드 미사용)
function sheetPts(S1, P1) {
  const m = model(S1, P1), G = S1.CUT.grainOf(m.d, m.D, P1), out = [];
  m.L.order.forEach(pid => { const rr = m.D[pid], pos = m.L.pos[pid], T = q => ({ x: q.x + pos.dx, y: q.y + pos.dy, pid });
    for (let i = 0; i < rr.seam.length; i++) { const a = rr.seam[i], b = rr.seam[(i + 1) % rr.seam.length]; for (let k = 0; k < 20; k++) out.push(T({ x: a.x + (b.x - a.x) * k / 20, y: a.y + (b.y - a.y) * k / 20 })); }
    denseOf(rr.outline).forEach(q => out.push(T(q)));
    rr.notches.forEach(n => { if (n.from) out.push(T(n.from)); if (n.to) out.push(T(n.to)); });
    rr.marks.forEach(mk => denseOf(mk.segs).forEach(q => out.push(T(q))));
    const g = G.pieces[pid]; if (g && g.ok) for (let k = 0; k <= 20; k++) out.push(T({ x: g.from.x + (g.to.x - g.from.x) * k / 20, y: g.from.y + (g.to.y - g.from.y) * k / 20 })); });
  return { pts: out, m, G };
}
const inWin = (q, t) => q.x >= t.x - 1e-9 && q.x <= t.x + t.w + 1e-9 && q.y >= t.y - 1e-9 && q.y <= t.y + t.h + 1e-9;
function coverage(b, S1, P1) { const T = tilesOf(b.body), sp = sheetPts(S1, P1); let lost = 0; sp.pts.forEach(q => { if (!T.some(t => inWin(q, t))) lost++; }); // 선이 없는 타일은 «조각 안쪽 한가운데»일 때만 정상(이어 붙이려면 그 종이도 필요) — 조각 밖 빈 종이는 0 이어야 한다
  const polys = sp.m.L.order.map(pid => sp.m.D[pid].seam.map(q => ({ x: q.x + sp.m.L.pos[pid].dx, y: q.y + sp.m.L.pos[pid].dy })));
  const empty = T.filter(t => !sp.pts.some(q => inWin(q, t)) && !polys.some(pl => inPoly({ x: t.x + t.w / 2, y: t.y + t.h / 2 }, pl))).length; return { lost, empty, n: sp.pts.length, T }; }

// ══ §1 여백·겹침 ══
{
  const o = PR(S).optsOf();
  ok(o.ok && o.marginMm === 10 && o.overlapMm === 10 && o.pageWmm === 190 && o.pageHmm === 276 && o.bandMm === 12 && o.winWmm === 190 && o.winHmm === 264 && near(o.winW, 19) && near(o.winH, 26.4) && near(o.stepX, 18) && near(o.stepY, 25.4), "1: 기본 = A4 세로 · 여백 10 · 겹침 10 → 한 쪽 190 × 276mm(세로 1mm 안전 여유) = 안내 띠 12 + 패턴 영역 190 × 264mm · 걸음 180 × 254 " + J([o.winWmm, o.winHmm]));
  const bad = [{ marginMm: 2 }, { marginMm: 31 }, { marginMm: NaN }, { marginMm: "10" }, { overlapMm: -1 }, { overlapMm: 41 }, { overlapMm: Infinity }, { marginMm: 30, overlapMm: 40 + 0 }, { overlapMm: null }];
  ok(bad.slice(0, 7).concat(bad.slice(8)).every(x => { const q = PR(S).optsOf(x); return !q.ok && q.reason; }) && PR(S).optsOf({ marginMm: 30, overlapMm: 40 }).ok, "1: 범위 밖·숫자 아님 = 거부(이유) · 가장 큰 여백 30 + 겹침 40 도 한 장에 자리 있음");
  const c = PR(S).optsOf({ marginMm: 7.04, overlapMm: 15 }); ok(c.ok && c.marginMm === 7 && c.winWmm === 196 && near(c.stepX, 18.1), "1: 값은 0.1mm 로 정리 · 여백 7 → 폭 196mm");
}

// ══ §2 사전 점검 ══
let B;
{
  const pre = PR(S).preflight(P);
  ok(r.ok && pre.ok && pre.blockers.length === 0 && pre.rows.length === 13 && pre.rows.filter(x => x.base === "front").length === 2 && pre.rows.every(x => x.qty.kind === "default" && x.grain.kind === "default" && x.grain.shown) && pre.attention.length === 0, "2: 대표 셔츠 = 막는 문제 없음 · 8조각(앞판·소매·커프스는 좌우 두 줄 = 보이는 13조각) · 수량·식서 전부 «기본» · 확인할 것 0 " + J(pre.blockers.concat(pre.attention)));
  S.CUT.setGrain("front", { angleDeg: 80 }, P); S.CUT.setQty("cuff", 4, P);
  const p2 = PR(S).preflight(P), f = p2.rows.find(x => x.id === "front"), cf = p2.rows.find(x => x.id === "cuff");
  ok(f.grain.kind === "user" && f.grain.angleDeg === 80 && cf.qty.kind === "user" && cf.qty.n === 4 && p2.rows.find(x => x.id === "back").grain.kind === "default", "2: 직접 고친 식서·수량 = «직접 지정»으로 구별(다른 조각은 기본)");
  const sigOld = P.working.cutGrain.pieces.front.sig; P.working.cutGrain.pieces.front.sig = "n1-a-b";
  const p3 = PR(S).preflight(P), f3 = p3.rows.find(x => x.id === "front"), b3 = PR(S).build(P, null, META);
  ok(p3.ok && f3.grain.kind === "held" && f3.grain.shown && f3.grain.angleDeg === 90 && p3.attention.some(s => /앞.*식서 보류.*임시 기본/.test(s)) && b3.ok && /cp-grain cp-grain-held/.test(b3.sheetSvg) && /식서 보류 — 점선은 임시 기본/.test(b3.sheetSvg) && /보류/.test(b3.body.split("cp-guide")[1]),
    "2: 식서 보류 = 사전 점검 알림 · 종이에 점선 + «식서 보류 — 점선은 임시 기본» · 안내 쪽 표에도 보류");
  P.working.cutGrain.pieces.front.sig = sigOld; S.CUT.setGrain("front", { angleDeg: null, at: null }, P); S.CUT.setQty("cuff", null, P);
  // 수량 미정 · 식서 미정(지금 셔츠에는 그런 조각이 없어 모델 결과만 바꿔 넣어 확인)
  const real = S.W.cutPrep, clone = o => JSON.parse(J(o));
  S.W.cutPrep = Object.assign({}, real, { qtyOf: (...a) => { const q = clone(real.qtyOf(...a)); q.pieces["vent-bias"].qty = null; q.pieces["vent-bias"].explicit = false; return q; }, grainOf: (...a) => { const g = clone(real.grainOf(...a)); g.pieces["collar-body"] = Object.assign(g.pieces["collar-body"], { ok: false, angleDeg: null, why: "직접 지정" }); return g; } });
  const b4 = PR(S).build(P, null, META), p4 = b4.pre; S.W.cutPrep = real;
  ok(b4.ok && p4.rows.find(x => x.id === "vent-bias").qty.kind === "none" && p4.rows.find(x => x.id === "collar-body").grain.kind === "none" && p4.attention.length === 2 && /수량 미정/.test(b4.sheetSvg) && /식서 미정/.test(b4.sheetSvg) && (b4.sheetSvg.match(/class="cp-grain"/g) || []).length === 12,
    "2: 수량 미정 · 식서 미정 = 알림 2건 · 종이에 «수량 미정»·«식서 미정» · 미정 조각은 화살표 없음(기본처럼 그리지 않음)");
  B = PR(S).buildHtml(P, null, META);
}

// ══ §3 1:1 치수 · 타일 · 누락 없음 · 복제 없음 ══
{
  const T = tilesOf(B.body), o = B.opts;
  ok(B.ok && T.length === B.tiles.length && T.length > 4 && T.every(t => t.pwmm === 190 && t.phmm === 276 && near(t.pw, 19, 1e-9) && near(t.ph, 27.6, 1e-9) && near(t.wmm, 190, 1e-9) && near(t.hmm, 264, 1e-9) && t.nw === t.w && t.nh === t.h && near(t.w * 10, t.wmm, 1e-9) && near(t.h * 10, t.hmm, 1e-9)), "3: 모든 쪽 = 190 × 276mm(19 × 27.6cm) · 패턴 영역 190 × 264mm 에 19 × 26.4cm 창(1cm = 10mm · 1:1) " + T.length + "장");
  ok(T.every(t => near((t.x - B.sheet.x0) / o.stepX, t.col - 1, 1e-9) && near((t.y - B.sheet.y0) / o.stepY, t.row - 1, 1e-9)) && B.tiles.every((t, i) => t.page === i + 1) && B.cols * B.rows === B.tiles.length + B.blank, "3: 창 위치 = (열−1)·180mm , (행−1)·254mm · 쪽 번호 = 행 순서 연속 · 빈 칸 = 전체 − 인쇄");
  const cv = coverage(B, S, P);
  ok(cv.n > 5000 && cv.lost === 0 && cv.empty === 0, "3: 재단선·완성선·너치·기준선·식서 점 " + cv.n + "개 전부 어느 타일 창 안(누락 0) · 조각 밖 빈 종이 0");
  const sp = sheetPts(S, P), skipped = []; for (let rr = 0; rr < B.rows; rr++) for (let c = 0; c < B.cols; c++) if (!B.need[rr + "," + c]) skipped.push({ x0: B.sheet.x0 + c * o.stepX, y0: B.sheet.y0 + rr * o.stepY });
  ok(skipped.every(k => !sp.pts.some(q => q.x >= k.x0 && q.x < k.x0 + o.stepX && q.y >= k.y0 && q.y < k.y0 + o.stepY)), "3: 인쇄하지 않는 빈 칸 " + skipped.length + "곳 = 자기 몫 안에 선이 하나도 없음");
  const xs = sp.pts.map(q => q.x), ys = sp.pts.map(q => q.y);
  ok(near(B.sheet.wCm, Math.max(...xs) - Math.min(...xs) + 1, 0.5) && B.sheet.wCm >= Math.max(...xs) - Math.min(...xs) + 1 - 1e-6 && B.sheet.hCm >= Math.max(...ys) - Math.min(...ys) + 1 - 1e-6, "3: 전체 크기 = 조각 범위 + 둘레 0.5cm " + J([+B.sheet.wCm.toFixed(1), +B.sheet.hCm.toFixed(1)]));
  const cnt = re => (B.sheetSvg.match(re) || []).length, m = sp.m;
  ok(cnt(/class="cp-piece"/g) === 13 && cnt(/class="cp-cut"/g) === 13 && cnt(/class="cp-fin"/g) === 13 && cnt(/class="cp-grain"/g) === 13 && m.d.pieces.every(p => cnt(new RegExp('data-piece="' + p.id + '"', "g")) === 1) && cnt(/data-piece="front~m"/g) === 1, "3: 보이는 조각마다 한 번만(재단선 13 · 완성선 13 · 식서 13 = 저장 8조각 + 앞판·소매·커프스·트임 거울 쪽 5) — 수량만큼 복제 없음");
  ok((B.body.match(/id="cpSheet"/g) || []).length === 1 && (B.body.match(/<use href="#cpSheet"\/>/g) || []).length === T.length + 1, "3: 도형은 한 벌 · 타일은 같은 한 벌을 창만 달리해 봄(타일마다 다시 그리지 않음 → 경계에서 어긋날 수 없음)");
  const bk = m.D.back, half = PIECE(m.d, "back"), cutW = Math.max(...bk.seam.map(q => q.x)) - Math.min(...bk.seam.map(q => q.x));
  ok(bk.unfolded && m.Q.pieces.back.qty === 1 && cutW > half.widthCm * 2 - 0.01 && /뒤[^<]*<\/text><text[^>]*>재단 1장[^<]*골 · 펼친 한 장/.test(B.sheetSvg) && /골\(펼친 중심 — 자르지 않음\)/.test(B.sheetSvg), "3: 골 펼친 뒤판 = 한 장(폭 " + cutW.toFixed(1) + " ≥ 반쪽 " + half.widthCm.toFixed(1) + " × 2) · «재단 1장» · 가운데 골 표시(이중 반사 없음)");
  const nN = m.L.order.reduce((a, pid) => a + m.D[pid].notches.length, 0);
  ok(nN > 10 && cnt(/class="cp-notch"/g) + cnt(/class="cp-notch-dot"/g) === nN, "3: 너치 " + nN + "개 = 화면 모델과 같은 수");
  ok(/재단 1장[^<]*\(기본\)/.test(B.sheetSvg) && /식서 90° · 교재 기본/.test(B.sheetSvg) && T.every(t => /DOROBO vTEST · 완료본 #/.test(t.band) && /100% 인쇄/.test(t.band) && new RegExp(">R" + t.row + "C" + t.col + " · " + t.row + "행 " + t.col + "열 · \\d+/" + T.length + "쪽<").test(t.band) && /조각: \S/.test(t.band)), "3: 조각 이름·수량·식서 상태 글자 · 모든 타일에 행열 번호·쪽·조각 이름·판·완료본·100% 안내");
  ok(T.every(t => { const g = /class="cp-gauge"[^>]* d="M(-?[\d.]+) (-?[\d.]+) L(-?[\d.]+) (-?[\d.]+) /.exec(t.band); return g && near(num(g[3]) - num(g[1]), 10, 1e-9) && num(g[2]) === num(g[4]) && num(g[1]) >= 0.1 && num(g[3]) <= t.pw - 0.1 && num(g[2]) + 0.1 < t.by && /세로 확인 = 아래 틀 높이 264mm/.test(t.band) && /큰 검척선은 안내 쪽/.test(t.band) && !/cp-gauge/.test(t.inner); }), "3: 모든 타일 안내 띠에 가로 10cm 검척선(띠 안 · 패턴 영역 밖) + 세로 확인 방법(틀 높이 264mm · 안내 쪽 큰 검척선)");
  // 안내 띠 ↔ 패턴 영역 분리: 띠 = 쪽 위 12mm · 패턴 영역 = 그 아래 안쪽 <svg>(잘라 그림). 띠 항목 상자는 띠 안·쪽 안·서로 안 겹침. 패턴 영역 안에는 글자·덮는 상자 없음.
  const hit = (a, b2) => a.x < b2.x + b2.w - 1e-9 && b2.x < a.x + a.w - 1e-9 && a.y < b2.y + b2.h - 1e-9 && b2.y < a.y + a.h - 1e-9;
  const sepOk = b => { const o2 = b.opts, T2 = tilesOf(b.body); return T2.length === b.tiles.length && T2.every(t => near(t.by, o2.band, 1e-9) && near(t.by + t.nh, t.ph, 1e-9) && t.nw === t.pw && !/<use|cp-cut|cp-fin/.test(t.band) && !/<text|fill="#fff"|fill="white"|cp-gauge/.test(t.inner)) &&
    b.tiles.every(t => t.bandBoxes.length === 6 && t.bandBoxes.every(k => k.x >= 0 && k.y >= 0 && k.x + k.w <= o2.pageW + 1e-9 && k.y + k.h <= o2.band + 1e-9 && !hit(k, { x: 0, y: o2.band, w: o2.pageW, h: o2.winH })) && t.bandBoxes.every((k, i) => t.bandBoxes.every((q, j) => i >= j || !hit(k, q)))); };
  ok(sepOk(B), "3: 안내 띠(위 12mm)와 패턴 영역이 분리 — 띠 항목 6개 상자가 띠 안·쪽 안(잘림 없음)·서로 겹치지 않음 · 패턴 영역 안에 글자/흰 상자/검척선 없음 · 띠 안에 패턴 없음");
  const BL = PR(S).build(P, { marginMm: 30, overlapMm: 40 }, { version: "v" + "9".repeat(90), createdAt: "" });
  ok(sepOk(BL) && /…/.test(tilesOf(BL.body)[0].band), "3: 가장 좁은 쪽(여백 30 → 폭 150mm) + 아주 긴 판 이름 = 글자를 줄여(…) 띠 안에 넣음(잘림·겹침 없음)");
  ok(!/<text/.test(B.body.split('id="cpSheet"')[1].split("</defs>")[1].replace(/<g class="cp-bandg">[\s\S]*?<\/g>/g, "").split("cp-pg").slice(1).join("")), "3: 타일 쪽에서 패턴 한 벌 밖의 글자는 안내 띠에만 있다(붙임선·자름선·맞춤 표시에 글자 없음 — 설명은 안내 쪽)");
  ok(/stroke="#b3005e"[^>]*stroke-dasharray/.test(B.body.match(/class="cp-glue"[^>]*/)[0]) && /stroke="#b3005e"[^>]*stroke-dasharray/.test(B.body.match(/class="cp-trim"[^>]*/)[0]) && /stroke="#b3005e"/.test(B.body.match(/class="cp-reg"[^>]*/)[0]) && !/#b3005e/.test(B.sheetSvg), "3: 붙임선·자름선·맞춤 표시 = 전용 색 + 점선(패턴 선은 그 색을 쓰지 않음)");
  // 이웃 타일: 붙임선·자름선·맞춤 표시(같은 종이 좌표에 양쪽 장 모두)
  const regs = t => [...t.inner.matchAll(/<circle class="cp-reg"[^>]* cx="(-?[\d.]+)" cy="(-?[\d.]+)"/g)].map(mm => mm[1] + "," + mm[2]);
  let pairs = 0, okPairs = 0, glue = 0; T.forEach(a => T.forEach(b2 => { const h = b2.row === a.row && b2.col === a.col + 1, v = b2.col === a.col && b2.row === a.row + 1; if (!h && !v) return; pairs++;
    const ra = regs(a), common = regs(b2).filter(k => ra.indexOf(k) >= 0); const inBoth = common.every(k => { const q = { x: num(k.split(",")[0]), y: num(k.split(",")[1]) }; return inWin(q, a) && inWin(q, b2); });
    if (common.length === 2 && inBoth) okPairs++; if (/class="cp-glue"/.test(a.inner) && /class="cp-trim"/.test(b2.inner)) glue++; }));
  ok(pairs > 3 && okPairs === pairs && glue === pairs, "3: 이웃한 타일 " + pairs + "쌍 — 겹침 띠 안 같은 자리에 맞춤 표시 2개씩(양쪽 장 모두 창 안) · 앞 장 붙임선 + 뒷 장 자름선");
  const A = cls => { const mm = new RegExp('class="' + cls + '" ([^>]*?)(?: d=| x=| cx=)').exec(B.body); return mm ? mm[1] : ""; };
  ok(/fill="none" stroke="#000" stroke-width="\.05"/.test(A("cp-cut")) && /fill="none" stroke="#000" stroke-width="\.025"/.test(A("cp-fin")) && /fill="none"/.test(A("cp-fold")) && /fill="none"/.test(A("cp-grain")) && /fill="none"/.test(A("cp-notch")) && /fill="none"/.test(A("cp-frame")) && /fill="none"/.test(A("cp-gauge")) &&
    [...B.body.matchAll(/<(path|rect|circle) class="(cp-[a-z-]+)[^"]*"([^>]*)>/g)].every(mm => mm[2] === "cp-notch-dot" ? /fill="#000"/.test(mm[3]) : /fill="none"/.test(mm[3])) && !/\.cp-cut\{/.test(B.css),
    "3: 모든 선 도형이 요소 속성으로 fill=none·굵기를 가짐(<use> 로 비춘 도형에는 스타일시트가 닿지 않아 검게 채워지던 실측 결함의 회귀)");
  ok(/@page\{size:210mm 297mm;margin:10mm\}/.test(B.css) && /\.cp-pg\{width:190mm;height:276mm/.test(B.css) && !/px/.test(B.css + B.sheetSvg) && [...B.sheetSvg.matchAll(/font-size="([\d.]+)"/g)].every(mm => num(mm[1]) >= 0.26 && num(mm[1]) <= 0.7),
    "3: 선 굵기·글자 = 실물 기준(재단선 0.5mm · 완성선 0.25mm · 글자 2.6~7mm) · @page A4 여백 10mm · 화면 px 없음");
  const B2 = PR(S).buildHtml(P, null, META); ok(B2.html === B.html && B.html.length > 20000, "3: 같은 입력 = 같은 출력(화면 상태·카메라와 무관 — 입력에 없음)");
  const g = B.body.split("cp-pg")[0];
  ok(/실물 크기 재단 패턴/.test(g) && /배율 <b>100%\(실제 크기\)<\/b>/.test(g) && /머리글·바닥글\(머리말 및 꼬리말\)은 끕니다/.test(g) && /자름선/.test(g) && /붙임선/.test(g) && /맞춤 표시/.test(g) && /cp-gauge-big/.test(g) && /페이지에 맞춤/.test(g) && /가로 100mm/.test(g) && /세로 100mm/.test(g) && /축소 안내도 — 치수 아님/.test(g) && (g.match(/class="cp-grid"/g) || []).length === T.length && /<table>/.test(g) && /보류·미정 없음/.test(g) && /width="114mm" height="110mm" viewBox="0 0 11.4 11"/.test(g),
    "3: 안내 쪽 = 100%·맞춤 금지·머리글 끔 안내 · 이어 붙이기 설명 · 큰 100mm 검척선(가로·세로 · 1:1) · 전체 배치 안내도(쪽 번호 " + T.length + "칸) · 사전 점검 표");
  if (process.env.CUTPRINT_OUT) { const dir = process.env.CUTPRINT_OUT; fs.writeFileSync(path.join(dir, "pattern-default.html"), B.html);
    const alt = PR(S).buildHtml(P, { marginMm: 7, overlapMm: 20 }, META); fs.writeFileSync(path.join(dir, "pattern-m7-o20.html"), alt.html);
    fs.writeFileSync(path.join(dir, "expect.json"), J({ default: { tiles: B.tiles.length, winWmm: o.winWmm, winHmm: o.winHmm, marginMm: o.marginMm }, alt: { tiles: alt.tiles.length, winWmm: alt.opts.winWmm, winHmm: alt.opts.winHmm, marginMm: alt.opts.marginMm } })); }
}

// ══ §4 막는 경우 ══
{
  const none = makeSession(), bn = PR(none).build(null, null, META);
  ok(!bn.ok && bn.blockers.length === 1 && bn.reason && !bn.body && !PR(none).buildHtml(null, null, META).html, "4: 프로젝트 없음 = 인쇄 내용을 만들지 않음 + 이유");
  { const x = buildP(); x.P.working.parameters.body = Object.assign({}, x.P.working.parameters.body, { hemExtensionBelowWaistCm: x.P.working.parameters.body.hemExtensionBelowWaistCm + 3 });
    x.P.working.geometry = Object.assign({}, x.S.DB.computeGeometry(x.P.referenceGeometry, { body: x.P.working.parameters.body }), { sleeve: x.P.working.geometry.sleeve });
    const bx = PR(x.S).build(x.P, null, META); ok(!bx.ok && /바뀌었습니다|완료/.test(bx.reason) && !bx.body, "4: 완료 뒤 Design 이 바뀜 = 막음(예전 완료본을 지금 것처럼 인쇄하지 않음) — " + String(bx.reason).slice(0, 40)); }
  const stores = [["cutGrain", { schema: 9, pieces: {} }, /식서 설정을 읽을 수 없/], ["cutQty", { schema: 9 }, /수량 설정을 읽을 수 없/], ["cutSpec", { schema: 99 }, /시접 설정을 읽을 수 없/], ["cutNotches", { schema: 99 }, /맞춤 표시 설정을 읽을 수 없/]];
  stores.forEach(st => { const x = buildP(); x.P.working[st[0]] = st[1]; const bx = PR(x.S).build(x.P, null, META); ok(!bx.ok && bx.blockers.some(s => st[2].test(s)) && !bx.body && J(x.P.working[st[0]]) === J(st[1]), "4: 읽을 수 없는 " + st[0] + " = 막음 + 이유 · 값은 그대로"); });
  const real = S.W.cutPrep, clone = o => JSON.parse(J(o));
  const withStub = (patch, fn) => { S.W.cutPrep = Object.assign({}, real, patch); try { return fn(); } finally { S.W.cutPrep = real; } };
  const b1 = withStub({ seam: (...a) => { const m = clone(real.seam(...a)); m.pieces.front.ok = false; return m; } }, () => PR(S).build(P, null, META));
  ok(!b1.ok && b1.blockers.some(s => /앞.*시접선 미완/.test(s)) && !b1.body, "4: 한 조각이라도 시접선 미완 = 전체 막음(그 조각 이름 명시)");
  const b2 = withStub({ derive: (...a) => { const d = clone(real.derive(...a)); d.pieces[0].check = { ok: false, reason: "외곽이 닫히지 않음" }; return d; } }, () => PR(S).build(P, null, META));
  ok(!b2.ok && b2.blockers.some(s => /외곽 검사 실패 — 외곽이 닫히지 않음/.test(s)), "4: 외곽 검사 실패 조각 = 막음 + 그 이유");
  const b3 = withStub({ derive: (...a) => { const d = clone(real.derive(...a)); d.missing = [{ id: "placket", label: "앞 여밈·컷온 안단", reason: "합치지 못했습니다" }]; return d; } }, () => PR(S).build(P, null, META));
  ok(!b3.ok && b3.blockers.some(s => /미완성 — 앞 여밈·컷온 안단: 합치지 못했습니다/.test(s)), "4: 재단 준비가 «미완성»으로 알린 항목 = 막음(완성된 것처럼 내보내지 않음)");
  ok(!PR(S).build(P, { marginMm: 99 }, META).ok && !PR(S).build(P, { overlapMm: "x" }, META).ok, "4: 틀린 여백·겹침 = 만들지 않음");
}

// ══ §5 원본 · hash · 저장 불변 ══
{
  const g5 = graph(S), w5 = J(P.working); PR(S).buildHtml(P, { marginMm: 5, overlapMm: 0 }, META); PR(S).buildHtml(P, null, META); PR(S).preflight(P);
  ok(hashes(P) === H0 && graph(S) === g5 && J(P.working) === w5 && J(S.CUT.derive(P, true).pieces) === PIECES0, "5: 인쇄 내용 만들기·사전 점검 뒤 = 완료 hash · 재단 조각 · 저장 그래프 · working 전체가 그대로(쓰기 없음)");
  const SRC0 = fs.readFileSync(path.join(ROOT, "js", "cutPrint.js"), "utf8");
  ok(!/fetch\(|XMLHttpRequest|sendBeacon|WebSocket|localStorage|sessionStorage|\.working\.[A-Za-z]+\s*=[^=]|setEdge\(|setGrain\(|setQty\(/.test(SRC0), "5: 소스 = 전송 없음 · 저장소 접근 없음 · 재단 설정 쓰기 호출 없음");
}

// ══ §6 경계 케이스 ══
{
  [[30, 40], [3, 0], [10, 0], [7, 20], [12.5, 5]].forEach(mo => { const b = PR(S).build(P, { marginMm: mo[0], overlapMm: mo[1] }, META), cv = coverage(b, S, P);
    ok(b.ok && cv.lost === 0 && cv.empty === 0 && cv.T.every(t => near(t.w * 10, t.wmm, 1e-9) && near(t.h * 10, t.hmm, 1e-9) && near(t.wmm, 210 - 2 * mo[0], 1e-9)), "6: 여백 " + mo[0] + " · 겹침 " + mo[1] + " → " + b.tiles.length + "장 · 누락 0 · 1:1"); });
  // 곡선이 타일 경계를 가로지르는 자리: 경계 양쪽 장 모두에 그 점이 들어 있다(겹침 띠)
  const o = B.opts, T = tilesOf(B.body), sp = sheetPts(S, P); let cross = 0, both = 0;
  sp.pts.forEach(q => { const fx = ((q.x - B.sheet.x0) % o.stepX), fy = ((q.y - B.sheet.y0) % o.stepY); if (fx < o.ov && q.x - B.sheet.x0 > o.stepX && q.x - B.sheet.x0 < B.cols * o.stepX) { cross++; if (T.filter(t => inWin(q, t)).length >= 2) both++; } else if (fy < o.ov && q.y - B.sheet.y0 > o.stepY && q.y - B.sheet.y0 < B.rows * o.stepY) { cross++; if (T.filter(t => inWin(q, t)).length >= 2) both++; } });
  ok(cross > 200 && both === cross, "6: 겹침 띠에 걸린 선 위의 점 " + cross + "개 = 전부 두 장 모두에 인쇄(이어 붙일 때 선이 끊기지 않음)");
  // 너치·식서가 타일 경계에 걸려도: 양 끝이 모두 어느 창 안 + 너치 한 개가 통째로 들어간 장이 적어도 하나(겹침 ≥ 너치 길이일 때) → 반쪽만 인쇄된 너치 없음
  [[10, 10], [7, 20], [12.5, 5]].forEach(mo => { const b = PR(S).build(P, { marginMm: mo[0], overlapMm: mo[1] }, META), T2 = tilesOf(b.body), m2 = sp.m; let nAll = 0, nLost = 0, nSplit = 0, nEdge = 0, maxLen = 0;
    m2.L.order.forEach(pid => { const pos = m2.L.pos[pid]; m2.D[pid].notches.forEach(n => { if (!n.from || !n.to) return; const a = { x: n.from.x + pos.dx, y: n.from.y + pos.dy }, c = { x: n.to.x + pos.dx, y: n.to.y + pos.dy }; nAll++; maxLen = Math.max(maxLen, Math.hypot(a.x - c.x, a.y - c.y));
      const ta = T2.filter(t => inWin(a, t)), tc = T2.filter(t => inWin(c, t)); if (!ta.length || !tc.length) nLost++; if (!ta.some(t => inWin(c, t))) nSplit++; if (ta.length > 1 || tc.length > 1) nEdge++; }); });
    ok(nAll > 10 && nLost === 0 && (maxLen > b.opts.ov || nSplit === 0), "6: 여백 " + mo[0] + " · 겹침 " + mo[1] + " — 너치 " + nAll + "개 끝점 누락 0 · 통째로 실린 장 없는 너치 " + nSplit + "개(가장 긴 너치 " + maxLen.toFixed(2) + "cm) · 겹침 띠에 걸린 너치 " + nEdge + "개"); });
  const m = sp.m, sizes = m.L.order.map(pid => { const bb = m.D[pid].bbox; return [pid, bb.maxX - bb.minX, bb.maxY - bb.minY]; }), small = sizes.filter(s => Math.min(s[1], s[2]) < 9), big = sizes.filter(s => s[1] > 19 || s[2] > 27.6);
  ok(small.length >= 2 && big.length >= 3 && small.every(s => B.tiles.some(t => t.pieces.length && B.shapes.some(sh => sh.pid === s[0]))), "6: 작은 조각 " + small.length + "개(짧은 쪽 9cm 미만 · 가장 작은 것 4 × 9.5) · 한 장보다 큰 조각 " + big.length + "개가 함께 있는 실제 셔츠로 확인");
  const tall = /data-piece="vent-placket"[\s\S]*?class="cp-name"[^>]*transform="rotate\(-90/.test(B.sheetSvg);
  ok(tall, "6: 좁고 긴 조각(트임 덧단)의 이름 글자 = 세로로 돌려 조각 방향에 맞춤");
}

// ══ §7 화면 · 문구 ══
{
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8"), SRC0 = fs.readFileSync(path.join(ROOT, "js", "cutPrint.js"), "utf8"), css = fs.readFileSync(path.join(ROOT, "css", "apple.css"), "utf8");
  ok(/id="btnCutPrint"[^>]*>인쇄·DXF</.test(html) && /js\/cutPrint\.js\?v=2026112002/.test(html) && html.indexOf("js/cutPrint.js") > html.indexOf("js/cutPrep.js"), "7: 재단 화면에 «실물 인쇄» 단추 · cutPrint.js 는 cutPrep.js 다음에 불러옴");
  ok(!/PDF ?다운로드|PDF ?내려받기|PDF 저장 단추/.test(SRC0 + html) && /인쇄 창 열기/.test(SRC0) && /파일을 바로 내려받는 것이 아닙니다/.test(SRC0) && /PDF로 저장/.test(SRC0) && /100%\(실제 크기\)/.test(SRC0), "7: «PDF 다운로드»라고 쓰지 않음 · «인쇄 창 열기» + 시스템 인쇄 창에서 «PDF로 저장» 동선 안내");
  ok(/disabled aria-disabled=\\"true\\" title=/.test(SRC0) && /지금은 인쇄·DXF 저장을 할 수 없습니다/.test(SRC0) && /@media screen\{#cutPrintRoot\{display:none!important\}\}/.test(SRC0) && /body>\*:not\(#cutPrintRoot\)\{display:none!important\}/.test(SRC0), "7: 막힌 상태 = 단추 disabled + 이유 · 인쇄 내용은 화면에는 숨기고 인쇄할 때만 보임");
  ok(/\.cut-print-card\{/.test(css) && /@media \(max-width:640px\)\{[^@]*\.cut-print \.btn\{min-height:44px\}/.test(css), "7: 사전 점검 창 스타일 · 폰에서 단추 44px");
}

// ══ §8 야간 리뷰 2건(2026-11-17): 안내 쪽 폭 · 인쇄 수명 ══
{
  const src = fs.readFileSync(path.join(ROOT, "js", "cutPrint.js"), "utf8"), B8 = PR(S).build(P, { marginMm: 30, overlapMm: 10 }, META);
  ok(/\.cp-guide \.cp-row\{display:flex;flex-wrap:wrap;gap:5mm;align-items:flex-start\}/.test(B8.css) && /\.cp-guide \.cp-row>div\{break-inside:avoid;page-break-inside:avoid;max-width:100%\}/.test(B8.css) && /\.cp-guide svg\.cp-overview\{max-width:100%;height:auto\}/.test(B8.css) && /\.cp-guide tr\{break-inside:avoid/.test(B8.css),
    "8: 안내 쪽 = 검척선·배치도 줄이 쪽 폭을 넘으면 배치도가 아래로(줄바꿈) · 덩어리·표 줄은 쪽 사이에서 쪼개지지 않음 · 배치도만 줄일 수 있음");
  const g8 = B8.body.split("cp-pg")[0];
  ok(/<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="114mm" height="110mm" viewBox="0 0 11\.4 11">/.test(g8) && !/<svg class="cp-overview"[^>]*width="114mm"/.test(g8) && !/max-width[^}]*cp-gauge/.test(B8.css) && /<svg class="cp-overview"/.test(g8), "8: 큰 검척선 = 114mm 고정(줄이지 않음 · max-width 없음) · 배치도만 cp-overview(줄일 수 있음)");
  [3, 10, 12, 20, 30].forEach(m => { const o = PR(S).optsOf({ marginMm: m, overlapMm: 10 }); ok(o.ok && o.pageWmm >= 114 + 1e-9, "8: 여백 " + m + "mm — 쪽 폭 " + o.pageWmm + "mm ≥ 검척선 114mm(검척선은 늘 한 줄에 실물 그대로 들어간다)"); });
  ok(/function endPrint\(\) \{ if \(!ui\.printing\) return; ui\.printing = false; ui\.sawPrintMedia = false; unmount\(\); \}/.test(src) && /addEventListener\("afterprint", function \(\) \{ endPrint\(\); \}\)/.test(src), "8: 인쇄가 끝나면(afterprint — 인쇄·PDF 저장·취소·닫기) 인쇄용 내용을 걷음");
  ok(/addEventListener\("beforeprint", function \(\) \{ var p = \$\("cutPrintPanel"\), cv = \$\("cutView"\); if \(!ui\.printing \|\| !p \|\| p\.hidden \|\| !cv \|\| cv\.hidden\) \{ ui\.printing = false; unmount\(\); \} \}\)/.test(src), "8: 실물 인쇄 진행 중이 아니면(앱 Cmd/Ctrl+P) beforeprint 에서 남은 내용을 걷음 — 앱 화면이 인쇄됨");
  const dp = (src.match(/function doPrint\(\) \{[\s\S]*?\n  \}\n/) || [""])[0];
  ok(/var b = build\(null, ui\.opts/.test(dp) && /mount\(b\); ui\.printing = true;/.test(dp) && /catch \(e\) \{ endPrint\(\);/.test(dp) && !/W\(\)\.print\(\);[^\n]*unmount/.test(dp) && !/W\(\)\.print\(\);\s*\n\s*unmount/.test(dp), "8: 인쇄마다 지금 사전 점검으로 새로 만듦 · print() 가 바로 돌아와도 걷지 않음(Safari) · 던지면 걷음");
  ok(/matchMedia\("print"\)/.test(src) && /if \(ev\.matches\) ui\.sawPrintMedia = true; else if \(ui\.sawPrintMedia\) endPrint\(\);/.test(src), "8: afterprint 가 없는 브라우저 대비 = 인쇄 미디어가 켜졌다 꺼질 때만 걷음(켜진 적 없으면 걷지 않음)");
  ok(/function closePanel\(\) \{[^}]*ui\.printing = false;[^}]*unmount\(\); \}/.test(src), "8: 창 닫기 = 걷음");
}

console.log("cutPrintCheck: " + PASS + " passed, " + FAIL + " failed");
fails.forEach(f => console.log("  FAIL " + f));
process.exit(FAIL ? 1 : 0);
