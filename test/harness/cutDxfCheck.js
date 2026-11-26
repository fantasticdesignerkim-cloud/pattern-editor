// ══════════════════════════════════════════════
// cutDxfCheck.js — 재단 결과 DXF 내보내기(js/cutDxf.js · 2026-11-16 master 승인 · 실제 엔진 + 독립 DXF 파서)
//   §1 형식(R12 · mm · 레이어 표 · ASCII · CRLF) · §2 독립 파서로 다시 읽어 치수·폐곡선·곡선 오차·너치·식서·골·수량 대조
//   §3 막는 경우 = cutPrint 사전 점검과 같은 목록 · 식서 보류 · §4 원본·hash·저장 불변 · 같은 입력 = 같은 파일 · §5 화면·옛 원형 DXF 동선 보존
//   §7 골 ↔ 봉제선 전환 · 펼친 가운데 선 = INTERNAL(인쇄·AAMA 와 같은 뜻) · FOLD = 실제 반쪽 골 재단만
//   §6 AAMA/ASTM 구조(조각마다 블록 · 숫자 레이어 · 조각/스타일 글자 · 너치 점) — 구조 검사일 뿐 규격 인증·CAD 호환 검증이 아니다
//   CUTDXF_OUT=<폴더> 를 주면 실제 DXF 파일을 그 폴더에 쓴다(저장소 밖).
//   node test/harness/cutDxfCheck.js
// ══════════════════════════════════════════════
"use strict";
const vm = require("vm"), fs = require("fs"), path = require("path");
const V = require("./versionHelper");
let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
process.on("uncaughtException", e => { console.log("cutDxfCheck: 예외 — " + (e && e.stack || e).toString().split("\n").slice(0, 3).join(" | ")); fails.slice(0, 20).forEach(f => console.log("  ✗ " + f)); process.exit(1); });
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
  "designSleeveA.js", "designCuff.js", "sleeveAApply.js", "sleeveAnnotation.js", "designCollar.js", "collarPresets.js", "collarCheckpoint.js", "designResult.js", "projectFile.js", "seamMatch.js", "seamAllowance.js", "cutPrep.js", "cutPrint.js", "cutDxf.js"].concat(SLEEVE_EXTRA);
const SRC = {}; FILES.forEach(f => { SRC[f] = fs.readFileSync(path.join(ROOT, "js", f), "utf8"); });

function makeSession() {
  const ELS = {}; let LOADING = null; const SVG_H = {}, DOC_H = {};
  const el = id => { if (!ELS[id]) ELS[id] = { id, textContent: "", value: "", disabled: false, hidden: false, title: "", attrs: {}, setAttribute(k, v) { this.attrs[k] = String(v); }, removeAttribute(k) { delete this.attrs[k]; }, getAttribute(k) { return this.attrs[k]; } }; return ELS[id]; };
  const sb = { window: {}, console: { log() {}, warn() {} }, Math, JSON, Object, Array, isFinite, structuredClone, Error, Date, Promise, Number, String, Map, Set, WeakMap,
    setTimeout: () => 0, clearTimeout: () => {},
    c2p: (x, y) => [x * 10, y * 10], SC: 10, viewZ: 1, eventToPatternPoint: e => [e.px, e.py], render: () => {},
    svg: { addEventListener(t, f) { (SVG_H[LOADING + ":" + t] = SVG_H[LOADING + ":" + t] || []).push(f); }, setPointerCapture() {}, releasePointerCapture() {} },
    document: { createElementNS: () => ({ setAttribute() {}, appendChild() {} }), getElementById: el, addEventListener(t, f) { (DOC_H[LOADING + ":" + t] = DOC_H[LOADING + ":" + t] || []).push(f); } } };
  sb.globalThis = sb; vm.createContext(sb);
  sb.window.isDesignStageActive = () => true; sb.window.addEventListener = () => {}; sb.window.refreshDesignResultUI = () => {};
  sb.captureBlockSnapshot = () => SNAPSHOT();
  FILES.forEach(f => { LOADING = f; vm.runInContext(SRC[f], sb, { filename: f }); }); LOADING = null;
  const W = sb.window; W.designLineQuickBar = { sync() {} };
  const S = { W, BW: W.blockWorkflow, DW: W.designWorkflow, DB: W.designBodice, BP: W.bodicePresets, BC: W.bodiceCheckpoint, SC: W.sleeveCheckpoint, SP: W.sleevePresets, DPL: W.designPlacket,
    DC: W.designCollar, CP: W.collarPresets, CC: W.collarCheckpoint, DR: W.designResult, DLT: W.designLineTool, DLy: W.designLayout, PF: W.projectFile, SM: W.seamMatch, CUT: W.cutPrep, SA: W.designSleeveA, DCF: W.designCuff };
  S.P = () => S.DW.current();
  W.projectSessionUI = { snapshot: () => ({ stage: "design", subtab: "collar" }), unfinished: () => [], afterRestore() {} };
  // 실제 포인터 경로로 선을 그린다(projectFileCheck 와 같은 방식 — designLineTool 의 실제 핸들러)
  const H = t => (SVG_H["designLineTool.js:" + t] || []), KD = () => (DOC_H["designLineTool.js:keydown"] || []);
  let CLX = 0;
  function evAt(pc, geo, extra) {
    const Ly = S.DLy.ensureLayout(S.P()), off = Ly[pc] || { dx: 0, dy: 0 }; CLX += 100;
    return Object.assign({ button: 0, pointerId: 1, clientX: CLX, clientY: 0, altKey: false, shiftKey: false, px: geo.x + off.dx, py: geo.y + off.dy,
      target: { closest: () => ({ getAttribute: () => pc }) }, stopPropagation() {}, preventDefault() {} }, extra || {});
  }
  const down = e => H("pointerdown").forEach(f => f(e)), up = e => H("pointerup").forEach(f => f(e)), move = e => H("pointermove").forEach(f => f(e));
  S.click = (pc, g, extra) => { const e = evAt(pc, g, extra); down(e); up(e); };
  S.drag = (pc, g, h) => { const e0 = evAt(pc, g); down(e0); const e1 = evAt(pc, { x: g.x + h.x, y: g.y + h.y }, { clientX: e0.clientX + 50 }); move(e1); up(e1); };
  S.draw = (pc, pts, handles) => {
    if (S.DLT.getMode() !== "off") S.DLT.setMode("off");
    S.DLT.toggle();
    pts.forEach((q, i) => { if (handles && handles[i]) S.drag(pc, q, handles[i]); else S.click(pc, q, { altKey: true }); });
    KD().forEach(f => f({ key: "Enter", target: {}, preventDefault() {} }));
  };
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

// 기존 검사는 «보이는 조각 = DXF 조각 1:1» 모델이다. 밴드·위 칼라 겉/안 분리(2026-11-23)는 designButtonHoleCheck §7 에서 따로 검증하고,
//   여기서는 분리를 끈 채(collarFaces:false) 형상·너치·식서·블록 충실도를 그대로 본다.
const DX = S0 => { const c = S0.W.cutDxf; return { build: (p, m, o) => c.build(p, m, Object.assign({ collarFaces: false }, o || {})), download: c.download, LAYERS: c.LAYERS, AAMA_LAYERS: c.AAMA_LAYERS, TOL_MM: c.TOL_MM, TURN_DEG: c.TURN_DEG }; };
// ── 독립 DXF 파서(cutDxf 코드 미사용): 코드/값 쌍 → 머리 변수 · 레이어 표 · 도형 ──
function parseDxf(text) {
  const raw = text.split("\r\n"); if (raw[raw.length - 1] === "") raw.pop();
  const out = { pairs: raw.length / 2, evenPairs: raw.length % 2 === 0, header: {}, layers: {}, ltypes: [], ents: [], eof: false, sections: [] };
  const pr = []; for (let i = 0; i + 1 < raw.length; i += 2) pr.push([parseInt(raw[i].trim(), 10), raw[i + 1]]);
  let sec = null, i = 0, cur = null, hv = null, poly = null, inTable = null;
  const flush = () => { if (cur) { if (cur.type === "VERTEX" && poly) poly.pts.push({ x: cur.x, y: cur.y }); else if (cur.type === "SEQEND") poly = null; else { out.ents.push(cur); if (cur.type === "POLYLINE") { cur.pts = []; poly = cur; } } cur = null; } };
  for (; i < pr.length; i++) { const c = pr[i][0], v = pr[i][1];
    if (c === 999) continue;
    if (c === 0 && v === "SECTION") { sec = pr[++i][1]; out.sections.push(sec); continue; }
    if (c === 0 && v === "ENDSEC") { flush(); sec = null; continue; }
    if (c === 0 && v === "EOF") { out.eof = true; continue; }
    if (sec === "HEADER") { if (c === 9) { hv = v; out.header[hv] = {}; } else if (hv) out.header[hv][c] = v; continue; }
    if (sec === "TABLES") { if (c === 0 && v === "TABLE") { inTable = pr[++i][1]; continue; } if (c === 0 && v === "ENDTAB") { inTable = null; cur = null; continue; }
      if (c === 0) { cur = { t: v }; continue; } if (cur && c === 2) { if (inTable === "LAYER") out.layers[v] = cur; if (inTable === "LTYPE") out.ltypes.push(v); } if (cur) cur[c] = v; continue; }
    if (sec === "ENTITIES") { if (c === 0) { flush(); cur = { type: v }; continue; }
      if (c === 8) cur.layer = v; else if (c === 10) cur.x = parseFloat(v); else if (c === 20) cur.y = parseFloat(v); else if (c === 11) cur.x2 = parseFloat(v); else if (c === 21) cur.y2 = parseFloat(v);
      else if (c === 40) cur.h = parseFloat(v); else if (c === 1) cur.text = v; else if (c === 50) cur.rot = parseFloat(v); else if (c === 70) cur.flag = parseInt(v, 10); else if (c === 66) cur.follow = v; continue; }
  }
  return out;
}
const unesc = s => s.replace(/\\U\+([0-9A-F]{4})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
const lenOf = (pts, closed) => { let L = 0; for (let k = 0; k + 1 < pts.length; k++) L += Math.hypot(pts[k + 1].x - pts[k].x, pts[k + 1].y - pts[k].y); if (closed) L += Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y); return L; };
const dClosed = (p, pts) => { let m = Infinity; for (let k = 0; k < pts.length; k++) m = Math.min(m, dSeg(p, pts[k], pts[(k + 1) % pts.length])); return m; };
const bb = pts => ({ x0: Math.min(...pts.map(q => q.x)), x1: Math.max(...pts.map(q => q.x)), y0: Math.min(...pts.map(q => q.y)), y1: Math.max(...pts.map(q => q.y)) });
const inBB = (q, b, e) => q.x >= b.x0 - e && q.x <= b.x1 + e && q.y >= b.y0 - e && q.y <= b.y1 + e;
// 독립 기대값: 화면용 모델(D·L)에서 직접 mm 좌표를 만든다(왼쪽 아래 원점 · Y 뒤집기)
function expect(S1, P1) {
  const m = model(S1, P1), G = S1.CUT.grainOf(m.d, m.D, P1); let minX = Infinity, maxY = -Infinity, maxX = -Infinity, minY = Infinity;
  m.L.order.forEach(pid => m.D[pid].seam.forEach(q => { const x = q.x + m.L.pos[pid].dx, y = q.y + m.L.pos[pid].dy; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }));
  const T = pid => q => ({ x: (q.x + m.L.pos[pid].dx - minX) * 10, y: (maxY - (q.y + m.L.pos[pid].dy)) * 10 });
  return { m, G, T, wMm: (maxX - minX) * 10, hMm: (maxY - minY) * 10 };
}

const r = buildP(), S = r.S, P = r.P, H0 = hashes(P), G0 = graph(S), W0 = J(P.working), PIECES0 = J(S.CUT.derive(P, true).pieces);
const B = DX(S).build(P, META), X = B.ok ? parseDxf(B.dxf) : null, EX = expect(S, P);
ok(r.ok && B.ok && typeof B.dxf === "string" && B.dxf.length > 5000, "0: 대표 셔츠(앞 여밈 · 긴 소매 + 커프스 + 트임 · 밴드 · 위 칼라) 완료 → DXF 생성 " + (B.ok ? B.dxf.length + "자" : J(B.blockers)));
const by = (type, layer) => X.ents.filter(e => e.type === type && e.layer === layer);
const order = EX.m.L.order;
// ⑦ 보이는 조각 id → DXF 조각 이름 · AAMA 블록 이름 (앞판 = 착용자 기준 front-right/front-left · FRONT_RIGHT_BASE/FRONT_LEFT_BASE)
const PN0 = (m0, pid) => { const r1 = m0.D[pid]; return (r1.pair || r1.instMirrored) ? r1.base + "-" + (r1.side === "R" ? "right" : "left") : pid; };
const BN = pid => PN0(EX.m, pid).replace(/[^A-Za-z0-9]+/g, "_").toUpperCase() + "_BASE";

// ══ §1 형식 ══
{
  ok(X.evenPairs && X.eof && J(X.sections) === J(["HEADER", "TABLES", "BLOCKS", "ENTITIES"]) && /^[\x20-\x7e\r\n]*$/.test(B.dxf) && !/[^\r]\n/.test(B.dxf) && /\r\n0\r\nEOF\r\n$/.test(B.dxf), "1: 코드/값 쌍 짝수 · HEADER→TABLES→BLOCKS→ENTITIES→EOF · 전부 ASCII · 줄 끝 CRLF");
  ok(X.header.$ACADVER[1] === "AC1009" && X.header.$INSUNITS[70] === "4" && X.header.$MEASUREMENT[70] === "1" && X.header.$LUNITS[70] === "2", "1: 판 R12(AC1009) · 단위 표시 $INSUNITS=4(mm) · $MEASUREMENT=1(미터법)");
  const names = ["CUT", "FINISHED", "FINISHED_TRUED", "FOLD", "NOTCH", "GRAIN", "GRAIN_HELD", "INTERNAL", "TEXT"];
  ok(names.every(n => X.layers[n] && X.layers[n][62] && X.ltypes.indexOf(X.layers[n][6]) >= 0) && X.layers["0"] && X.ents.every(e => names.indexOf(e.layer) >= 0) && J(DX(S).LAYERS.map(l => l.name)) === J(names), "1: 이름 있는 레이어 9개가 표에 있고(색·선 종류 정의됨) 모든 도형이 그 레이어 중 하나");
  const cut = by("POLYLINE", "CUT"), all = [].concat(...cut.map(e => e.pts)), e = bb(all);
  ok(near(e.x0, 0, 1e-4) && near(e.y0, 0, 1e-4) && near(e.x1, parseFloat(X.header.$EXTMAX[10]), 1e-4) && near(e.y1, parseFloat(X.header.$EXTMAX[20]), 1e-4) && near(e.x1, EX.wMm, 1e-3) && near(e.y1, EX.hMm, 1e-3) && near(B.stats.widthMm, EX.wMm, 1e-9),
    "1: 왼쪽 아래 = (0,0) · $EXTMAX = 실제 재단선 범위 = 화면 모델 범위 × 10 (" + e.x1.toFixed(2) + " × " + e.y1.toFixed(2) + " mm)");
  ok(X.ents.every(en => ["POLYLINE", "LINE", "CIRCLE", "TEXT"].indexOf(en.type) >= 0) && !/SPLINE|LWPOLYLINE|INSERT|HATCH/.test(B.dxf), "1: R12 기본 도형만(POLYLINE·LINE·CIRCLE·TEXT) — R12 에 없는 SPLINE·LWPOLYLINE 없음");
}

// ══ §2 독립 파서로 다시 읽어 대조 ══
{
  const cut = by("POLYLINE", "CUT"), fin = by("POLYLINE", "FINISHED");
  ok(cut.length === order.length && fin.length === order.length && cut.every(e => e.flag === 1 && e.pts.length >= 3) && fin.every(e => e.flag === 1 && e.pts.length >= 3), "2: 조각 " + order.length + "개 = 닫힌 재단선 " + cut.length + " · 닫힌 완성선 " + fin.length + "(조각마다 한 번 · 수량만큼 복제 없음)");
  let maxV = 0, maxA = 0, maxCh = 0, maxOff = 0, maxLen = 0, maxLenRel = 0, nV = 0, curved = 0; const perPiece = [];
  order.forEach((pid, k) => { const rr = EX.m.D[pid], T = EX.T(pid), seam = rr.seam.map(T), c = cut[k].pts;
    const s2 = seam.slice(); if (Math.hypot(s2[0].x - s2[s2.length - 1].x, s2[0].y - s2[s2.length - 1].y) < 1e-5) s2.pop();
    if (c.length !== s2.length) { maxV = 99; return; }
    c.forEach((q, i2) => { maxV = Math.max(maxV, Math.hypot(q.x - s2[i2].x, q.y - s2[i2].y)); }); nV += c.length;
    maxA = Math.max(maxA, Math.abs(area(c) - area(s2)) / area(s2));
    // 완성선: 참 곡선(촘촘한 표본) ↔ DXF 폴리라인 거리 · 길이
    const truth = dense(rr.outline).map(T), f = fin[k].pts, fb = bb(f);
    for (let i2 = 0; i2 < truth.length; i2 += 7) maxCh = Math.max(maxCh, dClosed(truth[i2], f));
    f.forEach(q => { let m = Infinity; for (let i2 = 0; i2 + 1 < truth.length; i2++) { const a = truth[i2], b2 = truth[i2 + 1]; if (Math.abs(a.x - q.x) > 3 && Math.abs(b2.x - q.x) > 3) continue; m = Math.min(m, dSeg(q, a, b2)); } maxOff = Math.max(maxOff, m); });
    const Lt = lenOf(truth, false), Ld = lenOf(f, true); maxLen = Math.max(maxLen, Math.abs(Lt - Ld)); maxLenRel = Math.max(maxLenRel, Math.abs(Lt - Ld) / Lt);
    if (rr.outline.some(s => s.kind === "cubic")) curved++;
    perPiece.push(pid + " " + (fb.x1 - fb.x0).toFixed(1) + "×" + (fb.y1 - fb.y0).toFixed(1) + "mm · 완성 둘레 " + Ld.toFixed(2) + "mm(참값 차 " + (Lt - Ld).toFixed(4) + ") · 완성선 점 " + f.length + " · 재단선 점 " + c.length); });
  ok(maxV < 1e-4 && maxA < 1e-6, "2: 재단선(최종 시접 포함) 꼭짓점 " + nV + "개 = 화면 모델 × 10mm 와 같은 좌표(최대 차 " + maxV.toExponential(1) + "mm · 반올림 0.0001mm 이내) · 넓이 상대 차 " + maxA.toExponential(1));
  ok(maxCh <= 0.0105 && maxOff <= 0.002, "2: 완성선 곡선 = 직선 조각 근사 — 참 곡선에서 가장 먼 거리 " + maxCh.toFixed(4) + "mm ≤ 기준 0.01mm · DXF 꼭짓점은 참 곡선 위(" + maxOff.toFixed(5) + "mm)");
  ok(maxLen <= 0.02 && curved >= 3, "2: 완성선 둘레 길이 = 참값과 최대 " + maxLen.toFixed(4) + "mm 차(상대 " + (maxLenRel * 100).toFixed(5) + "%) ≤ 기준 0.02mm · 곡선 있는 조각 " + curved + "개");
  if (process.env.CUTDXF_OUT) console.log(perPiece.join("\n"));
  // 닫힘·자기 교차 없음(재단선)
  ok(cut.every(e => crossCount(e.pts) === 0), "2: 재단선 " + cut.length + "개(앞판 좌우 포함) 모두 자기 교차 0(닫힌 단순 다각형)");
  // 너치
  const nl = by("LINE", "NOTCH"), nc = by("CIRCLE", "NOTCH"), foldPts = X.ents.filter(e => e.layer === "FOLD" || e.layer === "INTERNAL").map(e => e.type === "LINE" ? [{ x: e.x, y: e.y }, { x: e.x2, y: e.y2 }] : e.pts), dFold = q => Math.min(...foldPts.map(fp => dPts(q, fp))); let nExp = 0, nBad = 0, nFar = 0, nOnFold = 0;
  order.forEach((pid, k) => { const T = EX.T(pid); EX.m.D[pid].notches.forEach(n => { nExp++; const a = T(n.from);
    if (n.to) { const b2 = T(n.to); if (!nl.some(e => Math.hypot(e.x - a.x, e.y - a.y) < 2e-4 && Math.hypot(e.x2 - b2.x, e.y2 - b2.y) < 2e-4)) nBad++; }
    else if (!nc.some(e => Math.hypot(e.x - a.x, e.y - a.y) < 2e-4)) nBad++;
    const dF = dClosed(a, fin[k].pts), dC = dClosed(n.to ? T(n.to) : a, cut[k].pts); if (Math.min(dF, dC) > 0.05 && Math.min(dClosed(n.to ? T(n.to) : a, fin[k].pts), dClosed(a, cut[k].pts)) > 0.05) { if (dFold(a) <= 0.05) nOnFold++; else nFar++; } }); });
  ok(nExp > 10 && nl.length + nc.length === nExp && nBad === 0, "2: 너치 " + nExp + "개 = 화면 모델과 같은 수 · 양 끝 좌표 일치(0.0002mm 이내)");
  ok(nFar === 0, "2: 모든 너치의 한 끝이 그 조각의 완성선·재단선 위(0.05mm 이내), 아니면 펼친 골선 위(" + nOnFold + "개) — 떠 있는 너치 0");
  // 식서
  const gl = by("LINE", "GRAIN"); let gExp = 0, gBad = 0;
  order.forEach(pid => { const g = EX.G.pieces[pid]; if (!g || !g.ok) return; gExp++; const T = EX.T(pid), a = T(g.from), b2 = T(g.to);
    const hit = gl.filter(e => Math.hypot(e.x - a.x, e.y - a.y) < 2e-4 && Math.hypot(e.x2 - b2.x, e.y2 - b2.y) < 2e-4); if (hit.length !== 1) { gBad++; return; }
    const ang = ((Math.atan2(hit[0].y2 - hit[0].y, hit[0].x2 - hit[0].x) * 180 / Math.PI) % 180 + 180) % 180, want = ((g.angleDeg % 180) + 180) % 180, dA = Math.min(Math.abs(ang - want), 180 - Math.abs(ang - want)), dB = Math.min(Math.abs(180 - ang - want), 180 - Math.abs(180 - ang - want));
    if (Math.min(dA, dB) > 0.01) gBad++; });
  ok(gExp === order.length && gl.length === gExp * 5 && gBad === 0 && by("LINE", "GRAIN_HELD").length === 0, "2: 식서 " + gExp + "개(조각마다 하나 · 가운데 선 + 화살촉 4선) · 끝점·각도 일치 · 보류 없음");
  // 골: 펼친 조각 한 장 + 가운데 골선
  const fo = by("LINE", "FOLD").concat(by("POLYLINE", "FOLD")), unf = order.filter(pid => EX.m.D[pid].unfolded), bk = order.indexOf("back"), half = PIECE(EX.m.d, "back"), cb = bb(cut[bk].pts), fbk = bb(fin[bk].pts);
  // 펼친 한 장의 가운데 선 = INTERNAL(자르지 않음) — 화면 모델의 골 변(r.fold)과 좌표가 같은 선이 INTERNAL 에 하나씩
  const centre = unf.map(pid => { const T = EX.T(pid), f = EX.m.D[pid].fold.segs, a = T(f[0].from), z = T(f[f.length - 1].to); return X.ents.filter(e => e.layer === "INTERNAL" && (e.type === "LINE" ? (Math.hypot(e.x - a.x, e.y - a.y) < 2e-4 && Math.hypot(e.x2 - z.x, e.y2 - z.y) < 2e-4) : (e.pts && Math.hypot(e.pts[0].x - a.x, e.pts[0].y - a.y) < 2e-4 && Math.hypot(e.pts[e.pts.length - 1].x - z.x, e.pts[e.pts.length - 1].y - z.y) < 2e-4))).length; });
  ok(unf.length >= 3 && fo.length === 0 && centre.every(c => c === 1) && fbk.x1 - fbk.x0 > half.widthCm * 20 - 0.1 && foldPts.some(fp => fp.every(q => Math.abs(q.x - (fbk.x0 + fbk.x1) / 2) < 0.01 && inBB(q, cb, 0.01))),
    "2: 골 펼친 조각 " + unf.length + "개(" + unf.join("·") + ") = 한 장씩 · 가운데 선은 INTERNAL(자르지 않음 · 인쇄·AAMA 와 같은 뜻) 하나씩 · FOLD 0 · 뒤판 완성 폭 " + (fbk.x1 - fbk.x0).toFixed(1) + "mm = 반쪽 " + (half.widthCm * 10).toFixed(1) + " × 2 · 가운데 선이 한가운데");
  // 글자: 조각마다 ASCII id · 한글 이름 · 수량 · 식서 상태
  const tx = by("TEXT", "TEXT"), txt = tx.map(e => e.text);
  // ⑦ 보이는 조각 id(order)와 저장 조각 id 가 다르다: 앞판 거울 쪽 «front~m» = 표시 이름 front-left/right · 한글 이름(왼앞판/오른앞판) · 수량 1(Q.inst)
  const PN = pid => { const r1 = EX.m.D[pid]; return (r1.pair || r1.instMirrored) ? r1.base + "-" + (r1.side === "R" ? "right" : "left") : pid; };
  ok(order.every((pid, k) => { const p = PIECE(EX.m.d, pid.replace(/~m$/, "")), q = (EX.m.Q.inst && EX.m.Q.inst[pid]) || EX.m.Q.pieces[pid], lab = EX.m.D[pid].label || p.label, inside = tx.filter(e => inBB(e, bb(cut[k].pts), 0.01)).map(e => e.text);
    return inside.indexOf("PIECE " + PN(pid)) >= 0 && inside.map(unesc).indexOf(lab) >= 0 && inside.indexOf("QTY " + q.qty + " (DEFAULT)") >= 0 && inside.some(s => /^GRAIN \d+(\.\d+)? DEG \(BOOK DEFAULT\)$/.test(s)) && (!EX.m.D[pid].unfolded || inside.indexOf("FOLD OPENED - ONE FULL PIECE") >= 0); }) && txt.filter(s => /^PIECE /.test(s)).length === order.length && tx.every(e => e.h >= 2 && e.h <= 9.0001),
    "2: 조각마다 재단선 범위 안에 «PIECE id» · 한글 이름(\\U+ 표기 → 복원 일치) · «QTY n (DEFAULT)» · 식서 상태 · 펼친 조각 표시 · 글자 높이 2~9mm(C.F·C.B 9mm)");
  // 대표 조각: 긴 소매 · 골 펼친 카라 · 트임 작은 조각
  const dim = pid => { const e = bb(cut[order.indexOf(pid)].pts); return [+(e.x1 - e.x0).toFixed(1), +(e.y1 - e.y0).toFixed(1)]; };
  const sl = order.filter(id => /sleeve/.test(id))[0], small = order.filter(id => /vent/.test(id)), col = order.filter(id => /collar/.test(id) && EX.m.D[id].unfolded);
  ok(sl && dim(sl)[1] > 450 && small.length >= 2 && small.every(id => Math.min(...dim(id)) < 90) && col.length >= 1, "2: 대표 — 긴 소매 " + sl + " " + J(dim(sl)) + "mm · 작은 트임 조각 " + small.map(id => id + J(dim(id))).join(" ") + " · 골 펼친 카라 " + col.map(id => id + J(dim(id))).join(" "));
  if (process.env.CUTDXF_OUT) { fs.writeFileSync(path.join(process.env.CUTDXF_OUT, B.fileName), B.dxf); console.log("wrote " + B.fileName + " " + B.dxf.length); }
}

// ══ §2b 곡선 밑단(실제 선 도구로 그려 몸판에 반영) + 여밈 — 대표 조각 ══
{
  const S4 = makeSession(), P4 = start(S4), SX = 23.053125, HEM_Y = 58, CF = 47.5;
  S4.draw("back", [{ x: 0, y: HEM_Y }, { x: 10, y: HEM_Y }, { x: SX, y: 53 }], [null, { x: 5, y: 0 }, null]); const rb = S4.DLT.doReflectToBodice();
  S4.draw("front", [{ x: CF, y: HEM_Y }, { x: 37, y: HEM_Y }, { x: SX, y: 53 }], [null, { x: -5, y: 0 }, null]); const rf = S4.DLT.doReflectToBodice();
  const okc = rb === true && rf === true && setPlacket(S4, 1.2, 1.2).ok && S4.BC.complete(P4).ok && S4.W.sleeveAApply.apply(P4, { sleeveLengthCm: 52, cuff: cuffOf(S4, null) }).ok && completeChain(S4, P4);
  const h4 = hashes(P4), b4 = okc ? DX(S4).build(P4, META) : { ok: false }, x4 = b4.ok ? parseDxf(b4.dxf) : null, E4 = b4.ok ? expect(S4, P4) : null;
  ok(okc && b4.ok && hashes(P4) === h4, "2b: 곡선 밑단 셔츠 완료 → DXF 생성 · 완료 hash 그대로");
  if (b4.ok) {
    const cut = x4.ents.filter(e => e.type === "POLYLINE" && e.layer === "CUT"), fin = x4.ents.filter(e => e.type === "POLYLINE" && e.layer === "FINISHED"), ord = E4.m.L.order; let maxCh = 0, maxLen = 0, hemCub = 0, maxV = 0; const info = [];
    ["front", "back"].forEach(pid => { const k = ord.indexOf(pid), p = PIECE(E4.m.d, pid), rr = E4.m.D[pid], T = E4.T(pid), truth = dense(rr.outline).map(T), f = fin[k].pts;
      const hem = p.edges.filter(e => /hem/.test(e.id))[0]; if (hem && edgeSegs(p, hem).some(sg => sg.kind === "cubic")) hemCub++;
      for (let i2 = 0; i2 < truth.length; i2 += 5) maxCh = Math.max(maxCh, dClosed(truth[i2], f));
      maxLen = Math.max(maxLen, Math.abs(lenOf(truth, false) - lenOf(f, true)));
      const s2 = rr.seam.map(T); if (Math.hypot(s2[0].x - s2[s2.length - 1].x, s2[0].y - s2[s2.length - 1].y) < 1e-5) s2.pop(); cut[k].pts.forEach((q2, i2) => { maxV = Math.max(maxV, s2[i2] ? Math.hypot(q2.x - s2[i2].x, q2.y - s2[i2].y) : 9); });
      const e = bb(cut[k].pts); info.push(pid + " " + (e.x1 - e.x0).toFixed(1) + "×" + (e.y1 - e.y0).toFixed(1) + "mm"); });
    ok(hemCub === 2 && cut.length === ord.length && cut.every(e => e.flag === 1 && crossCount(e.pts) === 0) && fin.every(e => e.flag === 1), "2b: 앞·뒤 밑단 변이 곡선 · 재단선·완성선 모두 닫힘 · 자기 교차 0 (" + info.join(" · ") + ")");
    ok(maxCh <= 0.0105 && maxLen <= 0.02 && maxV < 1e-4, "2b: 곡선 밑단 완성선 — 참 곡선과 최대 " + maxCh.toFixed(4) + "mm(기준 0.01) · 둘레 차 " + maxLen.toFixed(4) + "mm(기준 0.02) · 재단선 꼭짓점 = 모델(" + maxV.toExponential(1) + "mm)");
    if (process.env.CUTDXF_OUT) fs.writeFileSync(path.join(process.env.CUTDXF_OUT, "curved-hem_" + b4.fileName), b4.dxf);
  }
  // 시접 엔진이 거부하는 곡선 밑단(꺾인 곡선 — 오목 반경 < 시접 폭) = DXF 도 만들지 않는다(같은 사전 점검)
  { const S5 = makeSession(), P5 = start(S5);
    S5.draw("back", [{ x: 0, y: HEM_Y }, { x: 12, y: 57.2 }, { x: SX, y: 50 }], [null, { x: 4, y: -0.6 }, null]); const r1 = S5.DLT.doReflectToBodice();
    S5.draw("front", [{ x: CF, y: HEM_Y }, { x: 35, y: 57.2 }, { x: SX, y: 50 }], [null, { x: -4, y: -0.6 }, null]); const r2 = S5.DLT.doReflectToBodice();
    const c5 = r1 === true && r2 === true && S5.BC.complete(P5).ok && S5.W.sleeveAApply.apply(P5, { sleeveLengthCm: 52, cuff: cuffOf(S5, null) }).ok && completeChain(S5, P5), b5 = DX(S5).build(P5, META);
    ok(c5 && !b5.ok && !b5.dxf && b5.blockers.some(x => /시접선 미완/.test(x)), "2b: 시접선을 닫지 못하는 곡선 밑단(꺾인 곡선 · 반경 < 시접 폭) = 완성된 듯 내보내지 않고 이유를 댄다 " + J(b5.blockers && b5.blockers[0])); }
}

// ══ §3 막는 경우 · 수량·식서 상태 ══
{
  const S2 = makeSession(), P2 = start(S2), pre2 = S2.W.cutPrint.preflight(P2), b2 = DX(S2).build(P2, META);
  ok(!pre2.ok && !b2.ok && !b2.dxf && J(b2.blockers) === J(pre2.blockers) && b2.reason === pre2.blockers[0], "3: 완료 전 = DXF 없음 · 막는 이유 = 인쇄 사전 점검과 같은 목록(" + J(pre2.blockers[0]) + ")");
  const SRC0 = fs.readFileSync(path.join(ROOT, "js", "cutDxf.js"), "utf8").replace(/^\s*\/\/.*$/gm, "");
  ok(/CP\.preflight\(proj\)/.test(SRC0) && !/\.derive\(|\.seam\(|\.displayOf\(|\.qtyOf\(|\.grainOf\(|check\.ok|\.missing/.test(SRC0), "3: 사전 점검 규칙을 복사하지 않음 — cutPrint.preflight 한 벌만 부르고 그 결과(d·D·L·Q·G)를 읽는다");
  ok(!/querySelector|getElementById|getBBox|getAttribute|innerHTML|viewZ|viewX|\bsvg\b|fetch\(|XMLHttpRequest|sendBeacon|WebSocket|localStorage|sessionStorage|\.working\b|setEdge\(|setGrain\(|setQty\(/.test(SRC0), "3: 소스 = 화면(SVG DOM·카메라) 읽기 없음 · 전송 없음 · 저장소 접근 없음 · 재단 설정 쓰기 없음");
  // 직접 지정 · 보류 · 미정
  const r3 = buildP(), S3 = r3.S, P3 = r3.P;
  S3.CUT.setGrain("front", { angleDeg: 80 }, P3); S3.CUT.setQty("collar-body", 4, P3);
  let b3 = DX(S3).build(P3, META), x3 = parseDxf(b3.dxf), t3 = x3.ents.filter(e => e.type === "TEXT").map(e => e.text);
  ok(b3.ok && t3.indexOf("GRAIN 80 DEG (USER)") >= 0 && t3.indexOf("QTY 4 (USER)") >= 0 && x3.ents.filter(e => e.type === "POLYLINE" && e.layer === "CUT").length === order.length, "3: 직접 지정한 식서·수량 = «(USER)» 로 구별 · 수량 4 여도 재단선은 조각마다 하나");
  P3.working.cutGrain.pieces.front.sig = "n1-a-b";
  const pre3 = S3.W.cutPrint.preflight(P3); b3 = DX(S3).build(P3, META); x3 = b3.ok ? parseDxf(b3.dxf) : null;
  // ⑦ 앞판 = 좌우 두 조각 — 저장된 식서 하나가 두 조각에 같이 읽히므로 둘 다 보류(같은 설정의 반사)
  const heldRows = pre3.rows.filter(q => q.base === "front"), held = heldRows[0];
  ok(heldRows.length === 2 && heldRows.every(q => q.grain.kind === "held") && b3.ok && x3.ents.filter(e => e.type === "LINE" && e.layer === "GRAIN_HELD").length === heldRows.filter(q => q.grain.shown).length * 5 && x3.ents.filter(e => e.type === "LINE" && e.layer === "GRAIN").length === (order.length - heldRows.length) * 5 && x3.ents.some(e => e.type === "TEXT" && /^GRAIN HELD/.test(e.text)) && pre3.attention.some(s => /식서 보류/.test(s)),
    "3: 식서 보류 조각 = GRAIN 레이어에 없음 · 임시 기본은 GRAIN_HELD 레이어 · 글자 «GRAIN HELD» · 사전 점검 알림(저장값은 적용 안 함)");
}

// ══ §4 원본 · hash · 저장 불변 · 결정적 ══
{
  const B2 = DX(S).build(P, META);
  ok(B2.dxf === B.dxf && hashes(P) === H0 && graph(S) === G0 && J(P.working) === W0 && J(S.CUT.derive(P, true).pieces) === PIECES0, "4: 같은 입력 = 같은 파일(화면 상태가 입력에 없음) · 만들고 난 뒤 완료 hash · 저장 그래프 · working · 재단 조각 그대로");
  ok(B.fileName === "DOROBO_cut_" + B.resultHash + "_2026-11-16.dxf" && near(DX(S).TOL_MM, 0.01, 1e-12) && B.stats.pieces.length === order.length, "4: 파일 이름 = 완료본 번호 + 날짜 · 곡선 허용 오차 0.01mm 공개");
}

// ══ §5 화면 · 옛 원형 DXF 동선 보존 ══
{
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8"), st = fs.readFileSync(path.join(ROOT, "js", "storage.js"), "utf8"), pr = fs.readFileSync(path.join(ROOT, "js", "cutPrint.js"), "utf8");
  ok(V.isToken(V.assetToken(html, "js/cutDxf.js")) && html.indexOf("js/cutDxf.js") > html.indexOf("js/cutPrint.js") && /id="btnCutPrint"[^>]*>인쇄·DXF</.test(html), "5: cutDxf.js 는 cutPrint.js 뒤에 로드 · 재단 화면 단추 «인쇄·DXF»");
  ok(/onclick="exportDXF\(\)">DXF 다운로드</.test(html) && /function exportDXF\(\)\{/.test(st) && !/cutDxf/.test(st), "5: 원형 단계의 «DXF 다운로드»(exportDXF) 동선은 그대로 — 재단 DXF 와 별개");
  ok(/data-cp=\\"dxf\\"/.test(pr) && /DXF 파일 저장/.test(pr) && /AAMA\/ASTM 규격 파일이 아니며/.test(pr) && /아직 확인하지 않았습니다/.test(pr) && /disabled aria-disabled/.test(pr), "5: 사전 점검 창에 «DXF 파일 저장» · 규격·호환을 과장하지 않는 문구 · 막히면 disabled");
}

// ══ §6 AAMA/ASTM 구조(조각마다 블록 · 숫자 레이어) — 독립 파서 ══
{
  // 블록까지 읽는 독립 파서: { blocks: {이름: [도형]}, ents: [도형], layers: [이름] } · 도형 = { type, layer, c: {코드: 값}, pts }
  const parseB = text => { const raw = text.split("\r\n"); if (raw[raw.length - 1] === "") raw.pop(); const pr = []; for (let i = 0; i + 1 < raw.length; i += 2) pr.push([parseInt(raw[i].trim(), 10), raw[i + 1]]);
    const out = { blocks: {}, ents: [], layers: [], sections: [], ver: null, even: raw.length % 2 === 0 }; let sec = null, bucket = null, cur = null, poly = null, tab = null;
    const flush = () => { if (!cur) return; if (cur.type === "VERTEX" && poly) poly.pts.push({ x: parseFloat(cur.c[10]), y: parseFloat(cur.c[20]) }); else if (cur.type === "SEQEND") poly = null; else if (bucket) { bucket.push(cur); if (cur.type === "POLYLINE") { cur.pts = []; poly = cur; } } cur = null; };
    for (let i = 0; i < pr.length; i++) { const c = pr[i][0], v = pr[i][1]; if (c === 999) continue;
      if (c === 0 && v === "SECTION") { sec = pr[++i][1]; out.sections.push(sec); bucket = sec === "ENTITIES" ? out.ents : null; continue; }
      if (c === 0 && v === "ENDSEC") { flush(); sec = null; continue; }
      if (sec === "HEADER") { if (c === 9 && v === "$ACADVER") out.ver = pr[i + 1][1]; continue; }
      if (sec === "TABLES") { if (c === 0 && v === "TABLE") { tab = pr[++i][1]; continue; } if (c === 0 && v === "LAYER" && tab === "LAYER") out.layers.push(pr[i + 1][1]); continue; }
      if (sec === "BLOCKS") { if (c === 0 && v === "BLOCK") { flush(); let name = null; while (pr[i + 1][0] !== 0) { i++; if (pr[i][0] === 2) name = pr[i][1]; } bucket = out.blocks[name] = []; continue; } if (c === 0 && v === "ENDBLK") { flush(); while (i + 1 < pr.length && pr[i + 1][0] !== 0) i++; bucket = null; continue; } }
      if (sec === "BLOCKS" || sec === "ENTITIES") { if (c === 0) { flush(); cur = { type: v, c: {} }; continue; } if (cur) { cur.c[c] = v; if (c === 8) cur.layer = v; } } }
    return out; };
  const A = DX(S).build(P, META, { format: "aama" }), Z = A.ok ? parseB(A.dxf) : null, pt = e => ({ x: parseFloat(e.c[10]), y: parseFloat(e.c[20]) }), NUM = ["1", "2", "3", "4", "6", "7", "8", "14", "15"];
  ok(A.ok && A.format === "aama" && Z.even && Z.ver === "AC1009" && J(Z.sections) === J(["HEADER", "TABLES", "BLOCKS", "ENTITIES"]) && /^[\x20-\x7e\r\n]*$/.test(A.dxf) && /\r\n0\r\nEOF\r\n$/.test(A.dxf) && A.fileName === "DOROBO_cut_" + A.resultHash + "_2026-11-16_AAMA.dxf",
    "6: AAMA 구조 파일 — R12 · HEADER→TABLES→BLOCKS→ENTITIES→EOF · ASCII · CRLF · 파일 이름에 _AAMA");
  const names = Object.keys(Z.blocks), allE = [].concat(...names.map(n => Z.blocks[n]), Z.ents);
  ok(J(Z.layers) === J(NUM) && allE.every(e => NUM.indexOf(e.layer) >= 0) && Z.layers.every(l => /^\d+$/.test(l)), "6: 레이어 = 숫자 이름만(1·2·3·4·6·7·8·14·15) · 모든 도형이 그 안(레이어 0 · 글자 이름 없음)");
  const ins = Z.ents.filter(e => e.type === "INSERT"), st = Z.ents.filter(e => e.type === "TEXT").map(e => e.c[1]);
  ok(names.length === order.length && new Set(names).size === order.length && order.every(pid => Z.blocks[BN(pid)]) && !Z.blocks.FRONT_BASE && Z.blocks.FRONT_RIGHT_BASE && Z.blocks.FRONT_LEFT_BASE && ins.length === order.length && ins.every(e => Z.blocks[e.c[2]] && parseFloat(e.c[10]) === 0 && parseFloat(e.c[20]) === 0) && Z.ents.every(e => e.type === "INSERT" || e.type === "TEXT"),
    "6: 조각마다 블록 하나(" + names.length + "개 · 이름 = 조각id_BASE) · ENTITIES 에는 블록 넣기(INSERT) " + ins.length + "개와 스타일 글자만(수량만큼 복제 없음)");
  ok(["Style Name: DOROBO_" + A.resultHash, "Creation Date: 16-11-2026", "Creation Time: 00:00:00", "Author: DOROBO vTEST", "Sample Size: BASE", "Units: METRIC"].every(x => st.indexOf(x) >= 0), "6: 스타일 글자 = Style Name · Creation Date(DD-MM-YYYY) · Creation Time · Author · Sample Size · Units: METRIC");
  let bad = [], maxV = 0, maxCh = 0, nPts = 0, nNotch = 0, maxNd = 0, turnAll = 0, curveAll = 0;
  order.forEach(pid => { const bl = Z.blocks[BN(pid)], rr = EX.m.D[pid], T = EX.T(pid), L = n => bl.filter(e => e.layer === n), q = (EX.m.Q.inst && EX.m.Q.inst[pid]) || EX.m.Q.pieces[pid], g = EX.G.pieces[pid];
    const c1 = L("1").filter(e => e.type === "POLYLINE"), s2 = rr.seam.map(T); if (Math.hypot(s2[0].x - s2[s2.length - 1].x, s2[0].y - s2[s2.length - 1].y) < 1e-5) s2.pop();
    if (c1.length !== 1 || c1[0].c[70] !== "1" || c1[0].pts.length !== s2.length) { bad.push(pid + ":cut"); return; }
    c1[0].pts.forEach((p2, i2) => { maxV = Math.max(maxV, Math.hypot(p2.x - s2[i2].x, p2.y - s2[i2].y)); });
    const p23 = L("2").concat(L("3")); nPts += p23.length; turnAll += L("2").length; curveAll += L("3").length;
    if (p23.length !== s2.length || !p23.every(e => e.type === "POINT" && s2.some(v => Math.hypot(v.x - pt(e).x, v.y - pt(e).y) < 2e-4)) || L("2").length < 3) bad.push(pid + ":points");
    const sew = L("14").filter(e => e.type === "POLYLINE"), truth = dense(rr.outline).map(T); if (sew.length !== (rr.trued ? 2 : 1) || !sew.every(e => e.c[70] === "1")) bad.push(pid + ":sew");   // 정리 외곽이 있는 조각 = 닫힌 선 2개(긴 V · 정리 외곽) else for (let i2 = 0; i2 < truth.length; i2 += 9) maxCh = Math.max(maxCh, dClosed(truth[i2], sew[0].pts));
    const gl = L("7"); if (!(gl.length === 1 && gl[0].type === "LINE" && Math.hypot(pt(gl[0]).x - T(g.from).x, pt(gl[0]).y - T(g.from).y) < 2e-4 && Math.hypot(parseFloat(gl[0].c[11]) - T(g.to).x, parseFloat(gl[0].c[21]) - T(g.to).y) < 2e-4)) bad.push(pid + ":grain");
    const nl = rr.notches.filter(n => n.to), n4 = L("4"); nNotch += n4.length;   // 2026-11-20: 레이어 4 = I자 선(LINE · 재단선 끝 → 안쪽 끝) · 점·길이/각도 메타 없음
    if (n4.length !== nl.length || !n4.every(e => e.type === "LINE" && nl.some(n => { const a = T(n.from), b2 = T(n.to), p0 = { x: parseFloat(e.c[10]), y: parseFloat(e.c[20]) }, p1 = { x: parseFloat(e.c[11]), y: parseFloat(e.c[21]) }, d = (u, v) => Math.hypot(u.x - v.x, u.y - v.y); return (d(p0, a) < 2e-4 && d(p1, b2) < 2e-4) || (d(p0, b2) < 2e-4 && d(p1, a) < 2e-4); }))) bad.push(pid + ":notch");
    n4.forEach(e => { maxNd = Math.max(maxNd, Math.min(dClosed({ x: parseFloat(e.c[10]), y: parseFloat(e.c[20]) }, c1[0].pts), dClosed({ x: parseFloat(e.c[11]), y: parseFloat(e.c[21]) }, c1[0].pts))); });
    const tx = bl.filter(e => e.type === "TEXT" && e.layer !== "15").map(e => e.c[1]); if (!(bl.filter(e => e.type === "TEXT" && e.layer !== "15").every(e => e.layer === "1") && tx.indexOf("Piece Name: " + PN0(EX.m, pid)) >= 0 && tx.indexOf("Size: BASE") >= 0 && tx.indexOf("Quantity: " + q.qty) >= 0 && tx.some(x => /^Annotation: /.test(x)))) bad.push(pid + ":text");
    if (rr.unfolded ? !(L("6").length === 0 && L("8").length >= 1 && /FULL PIECE \(FOLD OPENED\)/.test(tx.join("|"))) : L("6").length !== 0) bad.push(pid + ":fold"); });
  ok(bad.length === 0, "6: 블록마다 — 레이어 1 닫힌 재단선 하나 · 2/3 점 = 재단선 꼭짓점 전부 · 14 닫힌 봉제선 · 7 식서선 하나 · 4 너치 점(길이 39 · 방향 50 이 실제 너치 끝을 가리킴) · 조각 글자(Piece Name·Size·Quantity·Annotation) · 펼친 조각은 대칭선(6) 없음 " + J(bad));
  ok(maxV < 1e-4 && maxCh <= 0.0105 && nPts > 300 && turnAll >= order.length * 3 && curveAll > 100, "6: 재단선 꼭짓점 = 모델 × 10mm(차 " + maxV.toExponential(1) + "mm) · 봉제선 곡선 오차 " + maxCh.toFixed(4) + "mm ≤ 0.01 · 꺾임점 " + turnAll + " · 곡선점 " + curveAll);
  ok(nNotch >= 10 && maxNd <= 0.06, "6: 너치 점 " + nNotch + "개 = 모두 재단선 위(가장 먼 것 " + maxNd.toFixed(3) + "mm ≤ 0.06)");
  // 식서 보류 · 수량 미정 · 막힘 · 일반 형식 무변경 · 불변
  const r6 = buildP(), S6 = r6.S, P6 = r6.P; S6.CUT.setGrain("front", { angleDeg: 80 }, P6); P6.working.cutGrain.pieces.front.sig = "n1-a-b";
  const a6 = DX(S6).build(P6, META, { format: "aama" }), z6 = parseB(a6.dxf), fbs = ["FRONT_RIGHT_BASE", "FRONT_LEFT_BASE"].map(n => z6.blocks[n]);   // 같은 저장 식서가 좌우 두 조각에 읽히므로 두 블록 모두 보류
  ok(a6.ok && fbs.every(fb => fb && fb.filter(e => e.layer === "7").length === 0 && fb.some(e => e.type === "TEXT" && /GRAIN HELD - NOT EXPORTED/.test(e.c[1]))) && a6.notes.some(x => /식서 보류/.test(x)) && z6.blocks.BACK_BASE.filter(e => e.layer === "7").length === 1,
    "6: 식서 보류 조각 = 식서선(7)을 넣지 않음(임시 기본을 확정처럼 내보내지 않음) + 글자·알림 · 다른 조각은 그대로");
  const S7 = makeSession(), P7 = start(S7), a7 = DX(S7).build(P7, META, { format: "aama" });
  ok(!a7.ok && !a7.dxf && J(a7.blockers) === J(S7.W.cutPrint.preflight(P7).blockers), "6: 완료 전 = AAMA 구조 파일도 없음 · 같은 사전 점검 목록");
  ok(DX(S).build(P, META, { format: "generic" }).dxf === B.dxf && DX(S).build(P, META).dxf === B.dxf && DX(S).build(P, META, { format: "aama" }).dxf === A.dxf && hashes(P) === H0 && graph(S) === G0 && J(P.working) === W0, "6: 일반 DXF 는 그대로(형식을 주지 않으면 일반) · AAMA 구조도 같은 입력 = 같은 파일 · 원본·hash·저장 불변");
  const pr6 = fs.readFileSync(path.join(ROOT, "js", "cutPrint.js"), "utf8");
  ok(/data-cp=\\"dxf-aama\\"/.test(pr6) && /DXF 저장\(AAMA 구조\)/.test(pr6) && /규격 인증을 받은 것이 아니고/.test(pr6) && /아직 확인하지 못했습니다/.test(pr6), "6: 화면 = «DXF 저장(AAMA 구조)» 단추 · 인증·호환을 주장하지 않는 문구");
  if (process.env.CUTDXF_OUT) fs.writeFileSync(path.join(process.env.CUTDXF_OUT, A.fileName), A.dxf);
}

// ══ §7 골 ↔ 봉제선 전환 · 가운데 선 분류(2026-11-17 야간 리뷰: 펼친 한 장의 가운데 선이 일반 DXF 에서만 FOLD 로 나가 «접어 재단»으로 읽힐 수 있었다) ══
{
  const r7 = buildP(), S7 = r7.S, P7 = r7.P, h7 = hashes(P7);
  const ents = (dxf, layer) => parseDxf(dxf).ents.filter(e => e.layer === layer);
  const g0 = DX(S7).build(P7, META), a0 = DX(S7).build(P7, META, { format: "aama" }), E0 = expect(S7, P7);
  const centreOf = (E, pid) => { const T = E.T(pid), f = E.m.D[pid].fold.segs; return [T(f[0].from), T(f[f.length - 1].to)]; };
  const hasLine = (list, a, z) => list.some(e => e.type === "LINE" ? (Math.hypot(e.x - a.x, e.y - a.y) < 2e-4 && Math.hypot(e.x2 - z.x, e.y2 - z.y) < 2e-4) : (e.pts && Math.hypot(e.pts[0].x - a.x, e.pts[0].y - a.y) < 2e-4 && Math.hypot(e.pts[e.pts.length - 1].x - z.x, e.pts[e.pts.length - 1].y - z.y) < 2e-4));
  const unf0 = ["back", "collar-stand", "collar-body"].filter(pid => E0.m.D[pid].unfolded);
  ok(unf0.length === 3 && ents(g0.dxf, "FOLD").length === 0 && unf0.every(pid => { const c = centreOf(E0, pid); return hasLine(ents(g0.dxf, "INTERNAL"), c[0], c[1]); }), "7: 펼친 뒤판·밴드·위 칼라 — 일반 DXF 가운데 선 = INTERNAL(자르지 않음) · FOLD 0");
  // AAMA 와 같은 뜻: 같은 좌표의 선이 AAMA 블록의 레이어 8 에 있다(블록 좌표 = 일반과 같은 시트 좌표)
  const ab = a0.dxf, l8 = []; ab.split("\r\n0\r\nLINE\r\n").slice(1).forEach(x => { const m = /^8\r\n(\d+)\r\n10\r\n(-?[\d.]+)\r\n20\r\n(-?[\d.]+)\r\n30\r\n[^\r]*\r\n11\r\n(-?[\d.]+)\r\n21\r\n(-?[\d.]+)/.exec(x); if (m && m[1] === "8") l8.push({ type: "LINE", x: +m[2], y: +m[3], x2: +m[4], y2: +m[5] }); });
  ab.split("\r\n0\r\nPOLYLINE\r\n").slice(1).forEach(x => { if (!/^8\r\n8\r\n/.test(x)) return; const body = x.split("\r\n0\r\nSEQEND")[0]; const pts = body.split("\r\n0\r\nVERTEX\r\n").slice(1).map(v => { const m = /10\r\n(-?[\d.]+)\r\n20\r\n(-?[\d.]+)/.exec(v); return { x: +m[1], y: +m[2] }; }); if (pts.length) l8.push({ type: "POLYLINE", pts }); });
  ok(unf0.every(pid => { const c = centreOf(E0, pid); return hasLine(l8, c[0], c[1]); }) && !/\r\n8\r\n6\r\n10\r\n/.test(ab), "7: AAMA 도 같은 선을 레이어 8(안쪽 선) · 대칭선(6) 없음 — 두 형식 뜻 일치");
  const pr = S7.W.cutPrint.build(P7, null, META);
  ok((pr.sheetSvg.match(/골\(펼친 중심 — 자르지 않음\)/g) || []).length === 3, "7: 인쇄도 같은 세 선을 «골(펼친 중심 — 자르지 않음)»");
  const nonInternal = dxf => parseDxf(dxf).ents.filter(e => e.layer !== "INTERNAL" && e.layer !== "FOLD").map(e => J([e.type, e.layer, e.x, e.y, e.x2, e.y2, e.text, (e.pts || []).length]));
  // 뒤중심을 봉제선으로 → 뒤판은 반쪽(펼침 없음) · 가운데 선 없음 · FOLD 없음(골이 아니다)
  ok(S7.CUT.setEdge("back", "center", { kind: "seam", widthCm: 1 }, P7).ok, "7: 뒤중심 → 봉제선");
  const g1 = DX(S7).build(P7, META), E1 = expect(S7, P7), t1 = parseDxf(g1.dxf).ents.filter(e => e.type === "TEXT").map(e => e.text);
  ok(!E1.m.D.back.unfolded && ents(g1.dxf, "FOLD").length === 0 && !hasLine(ents(g1.dxf, "INTERNAL"), ...centreOf(E0, "back")) && t1.filter(x => /FOLD OPENED/.test(x)).length === 2 && !t1.some(x => /CUT ON FOLD/.test(x)),
    "7: 뒤판 봉제선 = 반쪽 · 가운데 선·FOLD 없음 · «FOLD OPENED» 는 밴드·위 칼라만");
  ok(S7.CUT.setEdge("back", "center", { kind: "fold" }, P7).ok, "7: 다시 골");
  const g2 = DX(S7).build(P7, META);
  ok(g2.dxf === g0.dxf && hashes(P7) === h7, "7: 다시 골 = 처음과 같은 파일(바이트 동일) · 완료 hash 그대로");
  // 커프스·트임의 접는 선은 원래대로 INTERNAL(조각 표시선) — 가운데 선과 별개로 남는다
  const inner = ["cuff", "vent-placket", "vent-bias"].map(pid => { const T = E0.T(pid); return (E0.m.D[pid].marks || []).filter(mk => !mk.mirrored).length; });
  ok(ents(g0.dxf, "INTERNAL").length >= unf0.length + inner.reduce((a, b) => a + b, 0), "7: 커프스·트임 안쪽 표시선(" + inner.join("·") + ")도 INTERNAL 에 그대로");
  const src = fs.readFileSync(path.join(ROOT, "js", "cutDxf.js"), "utf8");
  ok(/var fl = r\.unfolded \? "INTERNAL" : "FOLD";/.test(src), "7: FOLD 는 펼치지 못한 반쪽 조각의 실제 골선에만(소스)");
  ok(J(nonInternal(g0.dxf).length) === J(nonInternal(g2.dxf).length), "7: 가운데 선 말고는 도형·글자 수 그대로");
}

console.log("cutDxfCheck: " + PASS + " passed, " + FAIL + " failed");
fails.forEach(f => console.log("  FAIL " + f));
process.exit(FAIL ? 1 : 0);
