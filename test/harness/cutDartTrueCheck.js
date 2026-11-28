// ══════════════════════════════════════════════
// cutDartTrueCheck.js — 다트 입구 «접어 정리» 완성 외곽(2026-11-16 master 확정 · 지원: 앞판 진동 다트 = 위로 접고 아래 겹 진동선 연장 / 뒤판 어깨 다트 = 중심 쪽 윗겹 · 목옆점~어깨끝 직선)
//   §1 순수 기하(seamAllowance.trueDart): 다트량·시접 폭·방향 스윕 — 독립 재접기 검산 · 연결 · 자기교차 · 시접 폭 · 지원 밖 거부 · method 없으면 예전 결과 그대로
//   §2 Optitex 수정 전후 표본(fixtures/optitexDartSample.json — 회전·이동 정렬한 master 결과)과의 잔차 · 소스에 관측값 상수 없음
//   §3 재단 모델: 두 역할(다트 봉제선 긴 V = 원래 완성선 / 정리 외곽) 보존 · 재단선 = 정리 외곽의 바깥 · 원본·hash·저장 불변
//   §4 설정: 새 프로젝트 기본 · 이전 프로젝트(cutDart 없음) = 예전 방식 그대로 · 고치기/고정/저장·열기 · 틀린 저장값 거부 · 다른 설정 보존
//   §5 출력: 인쇄(SVG) · DXF 일반 · AAMA 구조가 같은 모델을 읽는다
//   §6 너치: 정리로 바뀐 자리의 너치 = 보류(출력 제외 · 사전 점검 알림 · 위치·저장값 그대로) · 영향 없는 너치는 그대로 · 방향 전환·시접 폭 · 긴 V 연장 안 함
//   node test/harness/cutDartTrueCheck.js   (CDT_SHOW="^2:" 를 주면 그 항목의 실측 문장을 찍는다)
// ══════════════════════════════════════════════
"use strict";
const vm = require("vm"), fs = require("fs"), path = require("path");
let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } if (process.env.CDT_SHOW && new RegExp(process.env.CDT_SHOW).test(n)) console.log((c ? "  ✓ " : "  ✗ ") + n); }
process.on("uncaughtException", e => { console.log("cutDartTrueCheck: 예외 — " + (e && e.stack || e).toString().split("\n").slice(0, 3).join(" | ")); fails.slice(0, 20).forEach(f => console.log("  ✗ " + f)); process.exit(1); });
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


const SA = (() => { const sb = { module: { exports: {} }, Math, Object, Array, isFinite }; vm.runInNewContext(SRC["seamAllowance.js"], sb); return sb.module.exports; })();
const FX = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "optitexDartSample.json"), "utf8"));
const V2 = (x, y) => ({ x, y }), sub2 = (a, b) => V2(a.x - b.x, a.y - b.y), rot2 = (v, a) => V2(v.x * Math.cos(a) - v.y * Math.sin(a), v.x * Math.sin(a) + v.y * Math.cos(a)), add2 = (a, b) => V2(a.x + b.x, a.y + b.y), d2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const line = (a, b) => ({ kind: "line", from: a, to: b });
const dLine = (p, a, b) => Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / d2(a, b);
const ringClosed = R => R.every((s, i) => d2(s.to, R[(i + 1) % R.length].from) < 1e-9);
const polyOf = R => { const o = []; R.forEach(s => { if (s.kind !== "cubic") { o.push(s.from); return; } for (let k = 0; k < 60; k++) o.push(cubP(s, k / 60)); }); return o; };
const dRing = (p, pts) => { let m = Infinity; for (let i = 0; i < pts.length; i++) m = Math.min(m, dSeg(p, pts[i], pts[(i + 1) % pts.length])); return m; };

// ══ §1 순수 기하 스윕 ══
{
  // 사각 몸판 위쪽 변에 다트 하나: 왼쪽 변 조각(P) — 다트 V — 오른쪽 변 조각(Q). curved = 양옆을 곡선으로.
  function piece(mouth, depth, tilt, curved) { const mA = V2(10 - mouth / 2, 0), mB = V2(10 + mouth / 2, 0), apex = V2(10 + tilt, depth), a0 = V2(0, curved ? 1.2 : 0), b1 = V2(20, curved ? 0.6 : 0);
    const P = curved ? { kind: "cubic", from: a0, c1: V2(3, 0.2), c2: V2(7, -0.4), to: mA } : line(a0, mA), Q = curved ? { kind: "cubic", from: mB, c1: V2(13, 0.5), c2: V2(17, 0.9), to: b1 } : line(mB, b1);
    return { ring: [P, line(mA, apex), line(apex, mB), Q, line(b1, V2(20, 30)), line(V2(20, 30), V2(0, 30)), line(V2(0, 30), a0)], mA, mB, apex }; }
  const edgesOf = (w, dart) => [{ id: "top", segs: [0, 1, 2, 3], widthCm: w, darts: [dart] }, { id: "rest", segs: [4, 5, 6], widthCm: 1 }];
  let nEx = 0, nCh = 0, badEx = [], badCh = [], maxRe = 0, maxW = 0, minW = Infinity, nBuilt = 0;
  [1.5, 2.5, 3.5, 5].forEach(mouth => [7, 10, 14].forEach(depth => [-0.8, 0, 0.6].forEach(tilt => [true, false].forEach(top => {
    // extend-lower (곡선 변)
    { const pc = piece(mouth, depth, tilt, true), t = SA.trueDart(pc.ring[0], pc.ring[3], pc.mA, pc.apex, pc.mB, top, "extend-lower"); nEx++;
      if (t.code) badEx.push([mouth, depth, tilt, top, t.reason].join("|")); else { const I = t.info, mT = top ? pc.mA : pc.mB, mU = top ? pc.mB : pc.mA, lT = d2(mT, pc.apex), aT = Math.atan2(mT.y - pc.apex.y, mT.x - pc.apex.x), aU = Math.atan2(mU.y - pc.apex.y, mU.x - pc.apex.x);
        let th = aT - aU; while (th > Math.PI) th -= 2 * Math.PI; while (th < -Math.PI) th += 2 * Math.PI;
        // 독립 검산: 산 꼭짓점을 위 겹 다리선에 대해 되접으면(반사) 접힌 아래 겹 변의 접선(입구를 지나는 직선) 위에 있어야 한다
        const uT = V2(Math.cos(aT), Math.sin(aT)), v = sub2(I.peak, pc.apex), k = v.x * uT.x + v.y * uT.y, folded = add2(pc.apex, V2(2 * k * uT.x - v.x, 2 * k * uT.y - v.y));
        const segU = top ? pc.ring[3] : pc.ring[0], tu = top ? sub2(segU.c1, segU.from) : sub2(segU.c2, segU.to),   // 3차 곡선 끝 접선 = 끝 조절점 방향(정확)
         tuF = rot2(tu, th), onLine = dLine(folded, mT, add2(mT, tuF));
        const aP = Math.atan2(I.peak.y - pc.apex.y, I.peak.x - pc.apex.x); let dA = aP - aT, dB = aU - aP; [dA, dB] = [dA, dB].map(v => { while (v > Math.PI) v -= 2 * Math.PI; while (v < -Math.PI) v += 2 * Math.PI; return v; }); const onCentre = Math.abs(dA - dB);   // 산 꼭짓점은 다트 각의 이등분선(= 접힌 중심선) 위
        maxRe = Math.max(maxRe, onLine, onCentre, tilt === 0 ? Math.abs(d2(I.peak, pc.mA) - d2(I.peak, pc.mB)) : 0);
        if (!(onLine < 1e-9 && onCentre < 1e-9 && d2(I.newMouthA, pc.mA) < 1e-12 && d2(I.newMouthB, pc.mB) < 1e-12 && t.segP === pc.ring[0] && t.segQ === pc.ring[3])) badEx.push("geom " + [mouth, depth, tilt, top, onLine].join("|")); } }
    // chord (직선 변)
    { const pc = piece(mouth, depth, tilt, false), t = SA.trueDart(pc.ring[0], pc.ring[3], pc.mA, pc.apex, pc.mB, top, "chord"); nCh++;
      if (t.code) badCh.push([mouth, depth, tilt, top, t.reason].join("|")); else { const I = t.info, mT = top ? pc.mA : pc.mB, mU = top ? pc.mB : pc.mA, eT = top ? pc.ring[0].from : pc.ring[3].to, eU = top ? pc.ring[3].to : pc.ring[0].from, nT = top ? I.newMouthA : I.newMouthB, nU = top ? I.newMouthB : I.newMouthA;
        const aT = Math.atan2(mT.y - pc.apex.y, mT.x - pc.apex.x), aU = Math.atan2(mU.y - pc.apex.y, mU.x - pc.apex.x); let th = aT - aU; while (th > Math.PI) th -= 2 * Math.PI; while (th < -Math.PI) th += 2 * Math.PI;
        const F = q => add2(pc.apex, rot2(sub2(q, pc.apex), th)), eUf = F(eU), uT = V2(Math.cos(aT), Math.sin(aT)), v = sub2(I.peak, pc.apex), k = v.x * uT.x + v.y * uT.y, pkF = add2(pc.apex, V2(2 * k * uT.x - v.x, 2 * k * uT.y - v.y));
        // 독립 검산: 접은 상태에서 새 입구점(위 겹) · 되접은 산 꼭짓점 · 돌린 새 입구점(아래 겹)이 모두 «먼 끝점을 이은 직선» 위 · 새 입구점은 다리선 위 · 두 새 입구점은 꼭짓점에서 같은 거리
        const e = Math.max(dLine(nT, eT, eUf), dLine(pkF, eT, eUf), d2(F(nU), nT), dLine(nT, pc.apex, mT), dLine(nU, pc.apex, mU), Math.abs(d2(nT, pc.apex) - d2(nU, pc.apex)));
        maxRe = Math.max(maxRe, e); if (!(e < 1e-9)) badCh.push("geom " + [mouth, depth, tilt, top, e].join("|")); } }
    // 시접 붙이기: 폭 스윕 — 닫힘 · 정리 외곽 연결 · 재단선은 정리 외곽에서 폭만큼(모서리는 더 멀다) · 자기교차 0
    [0.5, 1, 1.5, 2].forEach(w => [["extend-lower", true], ["chord", false]].forEach(mc => { const pc = piece(mouth, depth, tilt, mc[1]), r = SA.build({ ring: pc.ring, edges: edgesOf(w, { legs: [1, 2], topFirst: top, method: mc[0] }) });
      if (!r.ok) { if (!r.refusals.every(x => /sharp|interference|concave|self-cross|radius|dart-true/.test(x.code))) badEx.push("build " + J(r.refusals)); return; }
      nBuilt++; const T = polyOf(r.trued.ring); let lo = Infinity; r.points.forEach(q => { lo = Math.min(lo, dRing(q, T)); }); minW = Math.min(minW, lo - Math.min(w, 1)); maxW = Math.max(maxW, 0);
      if (!(ringClosed(r.trued.ring) && r.trued.ring.length === pc.ring.length && crossCount(r.points) === 0 && lo > Math.min(w, 1) - 0.011 && J(pc.ring) === J(piece(mouth, depth, tilt, mc[1]).ring))) badEx.push("seam " + [mouth, depth, tilt, top, w, mc[0], lo].join("|")); }));
  }))));
  ok(nEx === 72 && badEx.length === 0, "1: «아래 겹 변 연장»(곡선 변) 다트량 4 × 깊이 3 × 기울기 3 × 방향 2 = " + nEx + "가지 — 되접은 산 꼭짓점이 접힌 아래 겹 변의 접선 위 · 산은 다트 중심선 위 · 입구 두 점 그대로 · 양옆 변 그대로 " + J(badEx.slice(0, 2)));
  ok(nCh === 72 && badCh.length === 0, "1: «끝점 직선»(직선 변) " + nCh + "가지 — 접은 상태에서 새 입구점·산이 끝점 직선 위 · 새 입구점은 다리선 위 · 꼭짓점에서 같은 거리 " + J(badCh.slice(0, 2)));
  ok(maxRe < 1e-8 && nBuilt > 300 && minW > -0.011, "1: 독립 검산 최대 오차 " + maxRe.toExponential(1) + "cm · 시접 폭 0.5/1/1.5/2cm 스윕 " + nBuilt + "건 — 정리 외곽 닫힘 · 선 수 그대로 · 재단선 자기교차 0 · 재단선은 정리 외곽에서 폭 이상(부족 " + Math.min(0, minW).toFixed(4) + "cm) · 입력 무변경");
  const pcC = piece(3, 10, 0, true), rC = SA.trueDart(pcC.ring[0], pcC.ring[3], pcC.mA, pcC.apex, pcC.mB, true, "chord"), rX = SA.trueDart(pcC.ring[0], pcC.ring[3], pcC.mA, pcC.apex, pcC.mB, true, "other"), rN = SA.build({ ring: pcC.ring, edges: edgesOf(1, { legs: [1, 2], topFirst: null, method: "extend-lower" }) });
  ok(rC.code === "dart-true" && /직선이 아니어서/.test(rC.reason) && rX.code === "dart-true" && !rN.ok && rN.refusals.some(x => x.code === "dart-direction"), "1: 곡선 변에 «끝점 직선» = 거부(오적용 없음) · 모르는 방식 거부 · 접는 방향 없으면 거부");
  const pcL = piece(3, 10, 0, true), a0 = SA.build({ ring: pcL.ring, edges: edgesOf(1, { legs: [1, 2], topFirst: true }) }), a1 = SA.build({ ring: pcL.ring, edges: edgesOf(1, { legs: [1, 2], topFirst: true, method: undefined }) });
  ok(a0.ok && !a0.trued && a0.darts.length === 1 && J(a0.points) === J(a1.points), "1: method 없는 다트 = 예전 계산 그대로(정리 외곽 없음 · 접어 그대로 본뜬 산)");
}

// ══ §2 Optitex 표본 ══
{
  const mmOf = p => ({ x: p.x * 10, y: -p.y * 10 }), cm = a => ({ x: a[0] / 10, y: -a[1] / 10 }), pt = a => ({ x: a[0], y: a[1] });
  // 원본 DXF 점열 → 모델 ring. curve = 다트 옆 곡선을 고른 간격 표본 4점에서 되살린다(유한 차분 — 3차식에 정확). 없으면 전부 직선 조각.
  function ringOf(pts, starts, curve) { const P = pts.map(cm), n = P.length, at = k => P[((k % n) + n) % n], rep = {};
    if (curve) starts.forEach(i => [[i, -1], [i + 2, 1]].forEach(x => { const a = [0, 1, 2, 3].map(k => at(x[0] + x[1] * k)), d1 = sub2(a[1], a[0]), dd = V2(a[2].x - 2 * a[1].x + a[0].x, a[2].y - 2 * a[1].y + a[0].y), d3 = V2(a[3].x - 3 * a[2].x + 3 * a[1].x - a[0].x, a[3].y - 3 * a[2].y + 3 * a[1].y - a[0].y);
      const dB = t => V2(d1.x + (2 * t - 1) / 2 * dd.x + (3 * t * t - 6 * t + 2) / 6 * d3.x, d1.y + (2 * t - 1) / 2 * dd.y + (3 * t * t - 6 * t + 2) / 6 * d3.y), t0 = dB(0), t3 = dB(3), c = { kind: "cubic", from: a[0], c1: add2(a[0], t0), c2: sub2(a[3], t3), to: a[3] };
      if (x[1] < 0) rep[((x[0] - 3) % n + n) % n] = { kind: "cubic", from: c.to, c1: c.c2, c2: c.c1, to: c.from }; else rep[(x[0] % n + n) % n] = c; }));
    const segs = [], map = {}; for (let i = 0; i < n;) { map[i] = segs.length; if (rep[i]) { segs.push(rep[i]); i += 3; } else { segs.push(line(P[i], P[(i + 1) % n])); i++; } }
    return { ring: segs, map }; }
  const run = (pts, darts, curve) => { const R = ringOf(pts, darts.map(d => d.i), curve); return SA.build({ ring: R.ring, edges: [{ id: "all", segs: R.ring.map((_, i) => i), widthCm: 1, darts: darts.map(d => ({ legs: [R.map[d.i], R.map[d.i + 1]], topFirst: d.top, method: d.method })) }] }); };
  const far = (A, B) => { let m = 0; A.forEach(p => { m = Math.max(m, dRing(p, B)); }); return m; };
  // 앞판: 진동 다트. 원래 규칙(아래 = 입구가 아래에 있는 쪽이 위 겹)의 반대 = 위로 접음
  const f = FX.front, i0 = f.dartLegStart, mA = cm(f.before[i0]), mB = cm(f.before[i0 + 2]), downTop = mA.y > mB.y;
  const up = run(f.before, [{ i: i0, top: !downTop, method: "extend-lower" }], true), dn = run(f.before, [{ i: i0, top: downTop, method: "extend-lower" }], true), upLine = run(f.before, [{ i: i0, top: !downTop, method: "extend-lower" }], false);
  const pk = mmOf(up.trued.darts[0].peak), ePk = d2(pk, pt(f.masterPeak)), mc = f.masterCut.map(pt), oc = up.points.map(mmOf), eCut = Math.max(far(mc, oc), far(oc, mc));
  ok(up.ok && ePk < 0.05 && eCut < 0.1, "2: 앞판 표본(위로 접음 · 원본 곡선에서 접선 계산) — 산 꼭짓점이 master 와 " + ePk.toFixed(4) + "mm(기준 0.05) · 재단선 전체가 master 재단선과 " + eCut.toFixed(4) + "mm 이내(기준 0.1) · 산 높이 " + (up.trued.darts[0].peakOutCm * 10).toFixed(3) + "mm(계산값)");
  ok(d2(mmOf(dn.trued.darts[0].peak), pt(f.masterPeak)) > 20 && d2(mmOf(upLine.trued.darts[0].peak), pt(f.masterPeak)) < 0.6 && d2(mmOf(upLine.trued.darts[0].peak), pt(f.masterPeak)) > ePk, "2: 대조 — 아래로 접으면 master 와 " + d2(mmOf(dn.trued.darts[0].peak), pt(f.masterPeak)).toFixed(1) + "mm 어긋남(방향이 결과를 정함) · 곡선을 되살리지 않고 점열 현으로만 하면 " + d2(mmOf(upLine.trued.darts[0].peak), pt(f.masterPeak)).toFixed(3) + "mm(접선 근사 오차)");
  // 뒤판: 어깨 다트 2개 · 중심 쪽 다리가 위 겹
  const b = FX.back, xs = b.before.map(a => a[0]), cx = (Math.min(...xs) + Math.max(...xs)) / 2, tops = b.dartLegStarts.map(i => Math.abs(b.before[i][0] - cx) < Math.abs(b.before[i + 2][0] - cx));
  const bk = run(b.before, b.dartLegStarts.map((i, k) => ({ i, top: tops[k], method: "chord" })), false), bo = run(b.before, b.dartLegStarts.map((i, k) => ({ i, top: !tops[k], method: "chord" })), false);
  let eB = 0; bk.trued.darts.forEach((d, k) => [d.newMouthA, d.peak, d.newMouthB].forEach((q, j) => { eB = Math.max(eB, d2(mmOf(q), pt(b.masterTrued[k][j]))); }));
  const bc = b.masterCut.map(pt), boc = bk.points.map(mmOf), eBc = Math.max(far(bc, boc), far(boc, bc));
  ok(bk.ok && eB < 0.001 && eBc < 0.02, "2: 뒤판 표본(중심 쪽 윗겹 · 목옆점~어깨끝 직선) — 새 입구점 2 + 산 꼭짓점 × 다트 2 = 6점이 master 와 최대 " + eB.toFixed(5) + "mm(기준 0.001) · 재단선 " + eBc.toFixed(4) + "mm 이내(기준 0.02) · 입구 이동 " + (bk.trued.darts[0].mouthShiftCm * 10).toFixed(3) + "mm(계산값)");
  let eBo = 0; bo.trued.darts.forEach((d, k) => { eBo = Math.max(eBo, d2(mmOf(d.peak), pt(b.masterTrued[k][1]))); });
  ok(eBo > 0.5, "2: 대조 — 바깥 쪽 윗겹이면 산 꼭짓점이 " + eBo.toFixed(3) + "mm 어긋남(중심 쪽 윗겹 유지가 표본과 맞음)");
  const code = ["seamAllowance.js", "cutPrep.js", "cutPrint.js", "cutDxf.js"].map(n => SRC[n] || fs.readFileSync(path.join(ROOT, "js", n), "utf8")).join("\n").replace(/^\s*\/\/.*$/gm, "");
  ok(!/14\.9[0-9]|27\.8[0-9]?|21\.9[0-9]?|5\.7[5-6]|7\.08|6\.297|130\.72|23\.88/.test(code), "2: 제품 소스에 표본 관측값(산 높이·재단 끝·거리·입구 이동) 상수 없음 — 접기·반사·교점으로만 계산");
}

// ══ §3 재단 모델(실제 엔진 · 새 프로젝트) ══
const r = buildP(), S = r.S, P = r.P, H0 = hashes(P), G0 = graph(S), W0 = J(P.working);
const dv = S.CUT.derive(P, true), sm = S.CUT.seam(dv, P), D = S.CUT.displayOf(dv, sm), plans = S.CUT.dartsOf(dv, P).list;
{
  const fp = plans.filter(x => x.pieceId === "front")[0], bp = plans.filter(x => x.pieceId === "back");
  ok(r.ok && J(P.working.cutDart) === J({ schema: 1, darts: {} }) && fp && fp.kind === "ah" && fp.mode === "up-extend" && fp.method === "extend-lower" && !fp.explicit && !fp.legacyProject && bp.length === 1 && bp.every(x => x.kind === "sh" && x.mode === "center-chord" && x.method === "chord" && !x.explicit),
    "3: 새 프로젝트 = cutDart 판 1(고친 값 없음) · 앞 진동 다트 기본 «위로 접어 정리» · 뒤 어깨 다트(반쪽 조각에 1개 · 펼치면 2개) 기본 «중심 쪽 윗겹 · 직선 정리»");
  const fr = PIECE(dv, "front"), fs2 = sm.pieces.front, ft = fs2.trued, legs = ft.darts[0].legs, down = fr.edges.find(e => e.darts.length).darts[0].topFirst;
  ok(fs2.ok && ft && ft.darts.length === 1 && ft.darts[0].topFirst === !down && ft.ring.length === fr.segs.length && ft.ring.every((g, i) => legs.indexOf(i) >= 0 ? J(g) !== J(fr.segs[i]) : g === fr.segs[i]) && ringClosed(ft.ring) && ft.darts[0].peakOutCm > 0.3 && ft.darts[0].mouthShiftCm < 1e-12,
    "3: 앞판 — 정리 외곽 = 원래 완성선에서 다트 두 다리 자리만 산 두 변으로(나머지 선은 같은 객체) · 입구점 그대로 · 산이 바깥(" + (ft.darts[0].peakOutCm * 10).toFixed(2) + "mm) · 원래 규칙(아래)의 반대 방향");
  ok(D.front.outline === fr.segs && D.front.outline.some(g => g.kind === "line" && d2(g.to, ft.darts[0].apex) < 1e-9) && D.front.trued === ft.ring && D.front.truedDarts.length === 1, "3: 두 역할 보존 — 다트 봉제선(긴 V)은 원래 완성선 그대로 · 정리 외곽은 따로(r.trued)");
  const cutF = D.front.seam, TF = polyOf(ft.ring), dmin = Math.min(...cutF.map(q => dRing(q, TF))), pkCut = Math.max(...cutF.map(q => d2(q, ft.darts[0].apex))), wF = fs2.edges.find(e => e.id === "armhole").widthCm;
  ok(dmin > wF - 0.011 && crossCount(cutF) === 0 && fs2.darts.length === 0 && pkCut > d2(ft.darts[0].peak, ft.darts[0].apex) + wF - 1e-6, "3: 앞판 재단선 = 정리 외곽의 바깥(가장 가까운 곳 " + dmin.toFixed(3) + "cm ≥ 폭 " + wF + ") · 자기교차 0 · 다트 산 재단 꼭짓점은 산에서 폭 이상 바깥");
  const bkp = PIECE(dv, "back"), bs = sm.pieces.back, bt = bs.trued, n = bkp.segs.length;
  ok(bs.ok && bt && bt.darts.length === 1 && ringClosed(bt.ring) && bt.darts.every(q => q.method === "chord" && q.mouthShiftCm > 0.05 && q.peakOutCm > q.mouthShiftCm * 0.5 && Math.abs(d2(q.newMouthA, q.apex) - d2(q.newMouthB, q.apex)) < 1e-9 && dLine(q.newMouthA, q.apex, q.mouthA) < 1e-9 && dLine(q.newMouthB, q.apex, q.mouthB) < 1e-9) && D.back.unfolded && D.back.finalTrued && !D.back.trued && ringClosed(D.back.outline) && D.back.truedDarts.length === 2,
    "3: 뒤판 — 어깨 다트 정리(입구점이 다리 연장선 위로 " + bt.darts.map(q => (q.mouthShiftCm * 10).toFixed(2)).join("/") + "mm 이동 · 산) · 골 펼친 한 장으로 닫힌 정리 외곽 = 최종 완성선(2026-11-27) · 재단선 닫힘");
  // 2026-11-27 master 확정(수정 후 Optitex 사진): 뒤 어깨 = 정리 외곽이 최종 완성선 · 수정 전 어깨선 제외 · 두 다리 = 꼭짓점 → 새 입구점 · 다리 연장선 × 재단선에서 안으로 I자 3mm 너치 하나씩
  { const B = D.back, q = bt.darts[0], M = pq => pq, ends = []; B.outline.forEach(g => { ends.push(g.from, g.to); });
    const touchOld = ends.some(e => d2(e, q.apex) < 1e-6 || d2(e, q.mouthA) < 1e-6 || d2(e, q.mouthB) < 1e-6);
    const legsOk = B.dartLegs.length === 4 && B.dartLegs.filter(l => !l.mirrored).every(l => d2(l.a, q.apex) < 1e-12 && (d2(l.b, q.newMouthA) < 1e-12 || d2(l.b, q.newMouthB) < 1e-12)) && B.dartLegs.filter(l => !l.mirrored).map(l => l.b).some(b => d2(b, q.newMouthA) < 1e-12) && B.dartLegs.filter(l => !l.mirrored).map(l => l.b).some(b => d2(b, q.newMouthB) < 1e-12);
    const dn = B.notches.filter(n => n.dart), dnO = dn.filter(n => !n.mirrored);
    const notchOk = dn.length === 4 && dnO.every(n => { const m = [q.newMouthA, q.newMouthB].find(mm => dLine(n.to, q.apex, mm) < 1e-9 && d2(n.to, q.apex) > d2(mm, q.apex)); return m && dLine(n.from, q.apex, m) < 1e-9 && Math.abs(d2(n.from, n.to) - 0.3) < 1e-9 && d2(n.from, q.apex) > d2(m, q.apex) - 1e-9 && dRing(n.to, B.seam) < 1e-6 && dRing(n.from, B.seam) > 0.29; }) && dnO.length === 2 && d2(dnO[0].to, dnO[1].to) > 0.1;
    // 독립 검산: 새 입구점 → 너치 바깥점 사이에 재단선과 다른 교차가 없다(처음 만나는 점) · 거울 쪽은 원본의 반사
    const firstHit = dnO.every(n => { const m = [q.newMouthA, q.newMouthB].find(mm => dLine(n.to, q.apex, mm) < 1e-9); for (let k = 1; k < 200; k++) { const t = k / 200, pq = { x: m.x + (n.to.x - m.x) * t * 0.999, y: m.y + (n.to.y - m.y) * t * 0.999 }; if (dRing(pq, B.seam) < 1e-7) return false; } return true; });
    ok(!touchOld && legsOk && B.draftOutline && B.draftOutline.length === B.outline.length && crossCount(B.seam) === 0, "3: 뒤판 최종 — 완성선에 수정 전 어깨선(원래 입구·긴 V 꼭짓점) 없음 · 두 다리 = 꼭짓점 → 새 입구점 A/B(골 펼친 반대쪽 포함 4) · 재단선 자기교차 0");
    ok(notchOk && firstHit, "3: 뒤판 다트 너치 — 다리마다 하나(반쪽 2 · 펼친 한 장 4) · 연장선 위 · 재단선 위 바깥점에서 다리 방향으로 안으로 3mm · 처음 만나는 재단선 · 두 너치 서로 다른 자리(시접 " + dnO.map(n => (n.seamCm * 10).toFixed(2)).join("/") + "mm)");
    ok(J(B.notches.filter(n => !n.dart).map(n => n.id)) === J((sm.pieces.back.notches || []).filter(n => !n.held).reduce((a, n) => a.concat(n.edgeId !== B.foldEdge ? [n.id, n.id] : [n.id]), [])), "3: 뒤판 다른 너치(기본·사용자) 목록은 그대로 — 다트 너치는 따로 덧붙임"); }
  S.CUT.derive(P, true); S.CUT.seam(dv, P); S.CUT.dartsOf(dv, P);
  ok(hashes(P) === H0 && graph(S) === G0 && J(P.working) === W0, "3: 읽기만 — 완료 hash · 저장 그래프 · working 그대로");
  // 실제 조각에서 시접 폭 스윕
  let sw = [], g0 = J(P.working.cutSpec || null); [0.5, 0.7, 1.5, 2].forEach(w => { const a = S.CUT.setEdge("front", "armhole", { widthCm: w }, P), b = S.CUT.setEdge("back", "shoulder", { widthCm: w }, P), m2 = S.CUT.seam(S.CUT.derive(P, true), P);
    sw.push(w + ":" + (m2.pieces.front.ok && crossCount(m2.pieces.front.points) === 0 ? "앞✓" : "앞✗ " + (m2.pieces.front.refusals[0] || {}).code) + (m2.pieces.back.ok && crossCount(m2.pieces.back.points) === 0 ? " 뒤✓" : " 뒤✗ " + (m2.pieces.back.refusals[0] || {}).code)); });
  ok(sw.every(x => /앞✓ 뒤✓/.test(x)), "3: 실제 조각 시접 폭 스윕(진동·어깨 0.5/0.7/1.5/2cm) — 재단선 닫힘·자기교차 0 " + J(sw));
}

// ══ §4 설정 · 이전 프로젝트 · 저장 ══
{
  const L = buildP(), SL = L.S, PL = L.P; delete PL.working.cutDart;
  const dl = SL.CUT.derive(PL, true), ml = SL.CUT.seam(dl, PL), Dl = SL.CUT.displayOf(dl, ml), pl = SL.CUT.dartsOf(dl, PL).list;
  ok(pl.every(x => x.legacyProject && !x.method) && pl.find(x => x.pieceId === "front").mode === "down-legacy" && !ml.pieces.front.trued && !ml.pieces.back.trued && ml.pieces.front.darts.length === 1 && ml.pieces.back.darts.length === 1 && Dl.front.trued === null && ml.pieces.front.ok,
    "4: cutDart 없는 프로젝트(이전에 만든·저장한 것) = 예전 방식 그대로(앞 아래로 · 그대로 본뜸 · 정리 외곽 없음) — 조용히 바꾸지 않는다");
  const fr = PIECE(dl, "front"), direct = SA.build({ ring: fr.segs, edges: fr.edges.map((e, k) => ({ id: e.id, segs: e.segs, widthCm: ml.pieces.front.edges[k].widthCm, darts: e.darts.map(x => ({ legs: x.legs, topFirst: x.topFirst })) })) });
  ok(J(direct.points) === J(ml.pieces.front.points), "4: 이전 프로젝트의 앞판 재단선 = 예전 계산과 좌표 그대로");
  const before = J([PL.working.cutSpec || null, PL.working.cutNotches || null, PL.working.cutQty || null, PL.working.cutGrain || null]), hL = hashes(PL), fd = pl.find(x => x.pieceId === "front"), bd = pl.filter(x => x.pieceId === "back");
  const s1 = SL.CUT.setDartMode("front", fd.id, "up-extend", PL), m2 = SL.CUT.seam(SL.CUT.derive(PL, true), PL);
  ok(s1.ok && s1.wasLegacyProject && s1.pinned === 1 && PL.working.cutDart.schema === 1 && PL.working.cutDart.darts[fd.key].mode === "up-extend" && bd.every(x => PL.working.cutDart.darts[x.key].mode === "center-legacy") && m2.pieces.front.trued && !m2.pieces.back.trued && J(m2.pieces.back.points) === J(ml.pieces.back.points),
    "4: 이전 프로젝트에서 앞 다트만 «위로 접어 정리»로 고침 → 뒤 어깨 다트는 예전 방식으로 명시 고정(뒤판 재단선 좌표 그대로)");
  ok(J([PL.working.cutSpec || null, PL.working.cutNotches || null, PL.working.cutQty || null, PL.working.cutGrain || null]) === before && hashes(PL) === hL, "4: 다트 방식 고치기 = 시접·너치·수량·식서 설정과 완료 hash 를 건드리지 않음");
  // 저장 → 열기
  const txt = J(SL.PF.encodeGraph({ block: SL.BW.latest(), project: PL })), txt2 = J(JSON.parse(txt));
  ok(txt.indexOf('"cutDart":' + J(PL.working.cutDart)) >= 0 && txt2 === txt, "4: 프로젝트 저장 내용에 다트 방식이 그대로 들어가고 다시 읽으면 같은 값");
  // 새 프로젝트에서 방식 바꾸기
  const fd0 = plans.find(x => x.pieceId === "front"), bd0 = plans.filter(x => x.pieceId === "back");
  const a = S.CUT.setDartMode("front", fd0.id, "down-legacy", P), m3 = S.CUT.seam(S.CUT.derive(P, true), P);
  ok(a.ok && !a.wasLegacyProject && a.pinned === 0 && !m3.pieces.front.trued && m3.pieces.front.darts.length === 1 && m3.pieces.back.trued && J(Object.keys(P.working.cutDart.darts)) === J([fd0.key]), "4: 새 프로젝트에서 앞 다트를 «아래로(예전 방식)»로 → 앞판만 예전 모양 · 뒤판은 그대로 · 고친 다트만 저장");
  const b2 = S.CUT.setDartMode("back", bd0[0].id, "center-legacy", P), m4 = S.CUT.seam(S.CUT.derive(P, true), P);
  ok(b2.ok && !m4.pieces.back.trued && m4.pieces.back.darts.length === 1 && m4.pieces.back.ok && Object.keys(P.working.cutDart.darts).length === 2, "4: 뒤 어깨 다트를 예전 방식으로 → 그대로 본뜸(다트별 설정 · 앞과 독립)");
  S.CUT.setDartMode("front", fd0.id, "up-extend", P); S.CUT.setDartMode("back", bd0[0].id, "center-chord", P);
  const rej = [S.CUT.setDartMode("front", fd0.id, "center-chord", P), S.CUT.setDartMode("front", "no-such", "up-extend", P), S.CUT.setDartMode("sleeve-sleeve", fd0.id, "up-extend", P), S.CUT.setDartMode("back", bd0[0].id, "up-extend", P), S.CUT.setDartMode("front", fd0.id, "x", P)];
  ok(rej.every(x => !x.ok && x.reason), "4: 그 다트에 맞지 않는 방식 · 없는 다트 · 다른 조각 = 거부 + 사유 " + rej.length + "건");
  const keep = J(P.working.cutDart), bads = [[], "x", { schema: 2, darts: {} }, { schema: 1 }, { schema: 1, darts: [] }, { schema: 1, darts: {}, extra: 1 }, { schema: 1, darts: { "front|": { mode: "up-extend" } } }, { schema: 1, darts: { [fd0.key]: { mode: "nope" } } }, { schema: 1, darts: { [fd0.key]: { mode: "up-extend", x: 1 } } }, { schema: 1, darts: { [fd0.key]: "up-extend" } }];
  ok(bads.every(v => { P.working.cutDart = v; const rd = S.CUT.readDart(P), sx = S.CUT.setDartMode("front", fd0.id, "down-legacy", P), mm = S.CUT.seam(S.CUT.derive(P, true), P), pre = S.W.cutPrint.preflight(P), dx = S.W.cutDxf.build(P, META);
    return rd.state === "invalid" && !sx.ok && J(P.working.cutDart) === J(v) && mm.dartSpec.state === "invalid" && !mm.pieces.front.trued && !pre.ok && pre.blockers.some(x => /다트 정리 설정을 읽을 수 없습니다/.test(x)) && !dx.ok; }), "4: 틀린 저장값 " + bads.length + "종 = 읽지 않음 · 고치지 않음(값 보존) · 예전 방식으로 계산 · 인쇄·DXF 는 이유를 대고 막음");
  P.working.cutDart = JSON.parse(keep);
  // 지원 밖 다트: 표시는 하되 방식 선택 없음
  const all = S.CUT.dartsOf(dv, P).list; ok(all.every(x => x.kind ? x.supported : !x.method), "4: 지원 밖 다트는 method 가 붙지 않는다(오적용 없음) — 지금 셔츠의 다트 " + all.length + "개는 모두 지원 대상");
  const src = SRC["cutPrep.js"]; ok(/p\.id === "front" && d\.boundary === "armhole"/.test(src) && /p\.id === "back" && d\.boundary === "shoulder"/.test(src) && /a\.kind !== "line" \|\| b\.kind !== "line"/.test(src), "4: 지원 대상 = 앞판 진동 다트 · 뒤판 어깨 다트(양옆 직선일 때만 직선 정리)로 한정 — 소스 확인");
}

// 일반 DXF 에서 뒤판 다리(조각 좌표 길이와 같은 INTERNAL LINE) 개수 — 배치 이동과 무관하게 길이로 센다
const legsInDxf = (gx, B) => { const Ls = B.dartLegs.map(l => d2(l.a, l.b) * 10); return gx.dxf.split("\r\n0\r\nLINE\r\n8\r\nINTERNAL\r\n").slice(1).map(x => { const m = /10\r\n(-?[\d.]+)\r\n20\r\n(-?[\d.]+)\r\n30\r\n[\d.]+\r\n11\r\n(-?[\d.]+)\r\n21\r\n(-?[\d.]+)/.exec(x); return m ? Math.hypot(m[3] - m[1], m[4] - m[2]) : -1; }).filter(L => Ls.some(q => Math.abs(q - L) < 1e-3)).length; };
// ══ §5 출력 ══
{
  const pr = S.W.cutPrint.build(P, null, META), nTr = (pr.sheetSvg.match(/class="cp-fin cp-trued"/g) || []).length, trD = /class="cp-fin cp-trued"[^>]* d="([^"]+)"/.exec(pr.sheetSvg);
  ok(pr.ok && nTr === 2 && /fill="none" stroke="#000" stroke-width="\.025"/.test(pr.sheetSvg.match(/class="cp-fin cp-trued"[^>]*/)[0]) && (pr.sheetSvg.match(/class="cp-fin"/g) || []).length === 13 && (pr.sheetSvg.match(/class="cp-fin cp-dart-leg"/g) || []).length === 4, "5: 인쇄 — 완성선 13(앞 긴 V · 뒤 = 정리 외곽이 최종 완성선) + 앞 정리 외곽 2(좌·우) + 뒤 어깨 다트 다리 4(펼친 한 장) · 같은 선 굵기 · 채움 없음");
  { const F = S.W.cutPrep; ok(F.facedCollar("collar-stand").total === 2 && F.facedCollar("collar-body").total === 2 && F.facedCollar("collar-flat") === null && F.facedCollar("back") === null && /facedCollar\(it\.id\)/.test(SRC["cutDxf.js"] || ""), "5: 칼라 겉·안 표 한 곳(cutPrep.facedCollar) — DXF 분리 판정이 같은 표를 읽는다 · 확정 밖 조각은 null"); }
  const gx = S.W.cutDxf.build(P, META), ax = S.W.cutDxf.build(P, META, { format: "aama" });
  const cnt = (t, re) => (t.match(re) || []).length;
  ok(gx.ok && gx.stats.layers.FINISHED === 15 && gx.stats.layers.FINISHED_TRUED === 2 && legsInDxf(gx, D.back) === 4 && gx.stats.pieces.find(q => q.base === "back").notches === D.back.notches.length && gx.stats.layers.CUT === 15 && gx.stats.pieces.filter(q => /^collar-(stand|body)-inner$/.test(q.id)).length === 2, "5: 일반 DXF — FINISHED 15 · FINISHED_TRUED 2(앞 좌·우) · 뒤 다트 다리 4 = INTERNAL(AAMA 레이어 8 과 같은 수) · 뒤판 NOTCH = 화면 모델(다트 너치 포함) · CUT 15 (앞판·소매·커프스 좌우 각 1장 + 밴드·위 칼라 겉/안 분리 2026-11-24: 안 조각 -inner 2개 추가)");
  // AAMA: 블록별 레이어 14 닫힌 선 개수와 차이
  const blk = name => { const a = ax.dxf.indexOf("BLOCK\r\n8\r\n1\r\n2\r\n" + name), b = ax.dxf.indexOf("ENDBLK", a); return ax.dxf.slice(a, b); };
  const polys = (txt, layer) => txt.split("\r\n0\r\nPOLYLINE\r\n").slice(1).filter(x => x.startsWith("8\r\n" + layer + "\r\n")).map(x => ({ closed: /\r\n70\r\n1\r\n/.test(x.split("VERTEX")[0] + "\r\n"), pts: x.split("\r\n0\r\nVERTEX\r\n").slice(1).map(v => { const m = /10\r\n(-?[\d.]+)\r\n20\r\n(-?[\d.]+)/.exec(v); return { x: +m[1], y: +m[2] }; }) }));
  // ⑦ 앞판은 좌우 두 블록(FRONT_RIGHT_BASE · FRONT_LEFT_BASE) — 둘 다 같은 기하 검증(거울 쪽을 건너뛰지 않는다)
  const FB = ["FRONT_RIGHT_BASE", "FRONT_LEFT_BASE"].map(n => ({ n, f14: polys(blk(n), "14"), f1: polys(blk(n), "1")[0] }));
  const b14 = polys(blk("BACK_BASE"), "14"), s14 = polys(blk("SLEEVE_SLEEVE_RIGHT_BASE"), "14"), s14L = polys(blk("SLEEVE_SLEEVE_LEFT_BASE"), "14");
  const diffOf = f14 => f14.length === 2 && f14[0].pts.length === f14[1].pts.length ? f14[0].pts.filter((q, i) => d2(q, f14[1].pts[i]) > 1e-3).length : -1;
  ok(ax.ok && !/BLOCK\r\n8\r\n1\r\n2\r\nFRONT_BASE\r\n/.test(ax.dxf) && FB.every(b => b.f14.length === 2 && b.f14.every(x => x.closed) && diffOf(b.f14) === 1) && b14.length === 1 && b14.every(x => x.closed) && ax.stats.pieces.find(q => q.base === "back").notches === D.back.notches.filter(n => n.to).length && s14.length === 1 && s14L.length === 1, "5: AAMA 구조 — 앞판 좌·우 블록 각각 레이어 14 에 닫힌 선 2개(긴 V · 정리 외곽 — 다른 점은 다트 꼭짓점 하나) · 뒤판 1개(정리 외곽 = 최종 완성선 · 수정 전 어깨선 없음) · 뒤판 레이어 4 너치 = 화면 모델 · 다트 없는 소매는 1개(중복으로 지우지 않음)");
  const cutMins = FB.map(b => Math.min(...b.f1.pts.map(q => dRing(q, b.f14[1].pts))));
  ok(cutMins.every(c => c > 9.89) && FB.every(b => Math.min(...b.f1.pts.map(q => dRing(q, b.f14[0].pts))) > 9.89), "5: AAMA 앞판 좌·우 재단선(레이어 1) = 정리 외곽에서 " + cutMins.map(c => c.toFixed(2)).join("/") + "mm 이상(시접 1cm)");
  const L5 = buildP(), P5 = L5.P; delete P5.working.cutDart; const g5 = L5.S.W.cutDxf.build(P5, META), p5 = L5.S.W.cutPrint.build(P5, null, META);
  ok(g5.ok && !g5.stats.layers.FINISHED_TRUED && !/cp-trued/.test(p5.sheetSvg) && !/FINISHED_TRUED\r\n66/.test(g5.dxf), "5: 이전 프로젝트 = 인쇄·DXF 에 정리 외곽 없음(예전 출력 그대로)");
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8"), css = fs.readFileSync(path.join(ROOT, "css", "apple.css"), "utf8");
  ok(/select data-dart-mode/.test(SRC["cutPrep.js"]) && /\.cut-trued\{/.test(css) && /이전에 만든 프로젝트 — 예전 방식 유지/.test(SRC["cutPrep.js"]), "5: 재단 화면 = 다트별 방식 선택 · 정리 외곽 선 · 이전 프로젝트 표시");
}

// ══ §6 너치 — 정리로 바뀐 자리의 너치는 보류(출력 제외 · 위치·저장값 그대로) · 영향 없는 너치는 그대로 ══
{
  const r6 = buildP(), S6 = r6.S, P6 = r6.P, h6 = hashes(P6);
  const d0 = S6.CUT.derive(P6, true), bk = PIECE(d0, "back"), fr = PIECE(d0, "front"), eSh = bk.edges.find(e => e.id === "shoulder"), fSh = fr.edges.find(e => e.id === "shoulder"), fAh = fr.edges.find(e => e.id === "armhole");
  const segLen = g => { if (g.kind !== "cubic") return d2(g.from, g.to); let L = 0, q = g.from; for (let k = 1; k <= 200; k++) { const c = cubP(g, k / 200); L += d2(q, c); q = c; } return L; };
  // 앞 진동 다트 입구(아래 겹 쪽 끝)까지의 호 길이 — 다트 다리 바로 앞 = 정리해도 바뀌지 않는 진동선의 끝점
  const leg0 = fAh.darts[0].legs[0], arcMouth = fAh.segs.filter(i => i < leg0 || fAh.segs.indexOf(i) < fAh.segs.indexOf(leg0)).filter(i => fAh.darts[0].legs.indexOf(i) < 0).slice(0, fAh.segs.indexOf(leg0)).reduce((a, i) => a + segLen(fr.segs[i]), 0);
  const adds = [S6.CUT.addNotch("back", "shoulder", 2.5, P6), S6.CUT.addNotch("front", "shoulder", 3, P6), S6.CUT.addNotch("front", "armhole", arcMouth, P6), S6.CUT.addNotch("back", "shoulder", 0, P6)];
  const nsSaved = J(P6.working.cutNotches);
  const view6 = () => { const d = S6.CUT.derive(P6, true), m = S6.CUT.seam(d, P6), D6 = S6.CUT.displayOf(d, m); return { d, m, D6 }; };
  // 독립 계측: 너치의 원래 점(정리 전 선)과 정리 외곽(촘촘한 점열)의 거리 · 가장 가까운 직선 조각과의 방향 차
  const indep = (m, pid) => { const sm = m.pieces[pid], tr = sm.trued; if (!tr) return {}; const out = {}; const dense = []; tr.ring.forEach(g => { if (g.kind !== "cubic") { dense.push([g.from, g.to, "line"]); return; } for (let k = 0; k < 400; k++) dense.push([cubP(g, k / 400), cubP(g, (k + 1) / 400), "cubic"]); });
    sm.notches.forEach(n => { const p0 = PIECE(S6.CUT.derive(P6, true), pid), e = p0.edges.find(x => x.id === n.edgeId); let ch = [], legs = {}; (e.darts || []).forEach(dd => { legs[dd.legs[0]] = legs[dd.legs[1]] = 1; }); e.segs.forEach(i => { if (!legs[i]) ch.push(p0.segs[i]); });
      let acc = 0, at = null; for (const g of ch) { const L = segLen(g); if (n.atCm <= acc + L + 1e-9 || g === ch[ch.length - 1]) { const t = Math.max(0, Math.min(1, L ? (n.atCm - acc) / L : 0)); at = g.kind === "cubic" ? { p: cubP(g, t), t: sub2(cubP(g, Math.min(1, t + 1e-6)), cubP(g, Math.max(0, t - 1e-6))) } : { p: V2(g.from.x + (g.to.x - g.from.x) * t, g.from.y + (g.to.y - g.from.y) * t), t: sub2(g.to, g.from) }; break; } acc += L; }
      const ang = v => Math.asin(Math.min(1, Math.abs(at.t.x * v.y - at.t.y * v.x) / (Math.hypot(at.t.x, at.t.y) * Math.hypot(v.x, v.y)))) * 180 / Math.PI;
      let bd = Infinity, best = null; dense.forEach(sg => { const dd = dSeg(at.p, sg[0], sg[1]), a = ang(sub2(sg[1], sg[0])), lim = sg[2] === "line" ? 0.05 : 0.5;   // 촘촘한 곡선 조각은 현 방향이라 허용을 넓게
        if (dd < bd - 1e-9 || (Math.abs(dd - bd) <= 1e-9 && a / lim < best.a / best.lim)) { bd = Math.min(bd, dd); best = { a, lim }; } });
      out[n.id] = { dev: bd, deg: best.a, held: bd > 1e-4 || best.a > best.lim }; }); return out; };
  let V6 = view6(); const allN = ["front", "back"].map(pid => V6.m.pieces[pid].notches).flat(), heldN = allN.filter(n => n.held);
  const ib = indep(V6.m, "back"), iF = indep(V6.m, "front");
  ok(adds.every(a => a.ok) && heldN.length === 2 && heldN.every(n => n.pieceId === "back" && n.edgeId === "shoulder" && n.user && n.to === null && /다트 입구를 접어 정리/.test(n.heldWhy)) && allN.filter(n => !n.held).every(n => n.to || n.why),
    "6: 새 프로젝트 — 뒤 어깨 사용자 너치 2개(어깨 시작 2.5cm · 0cm)만 보류 · 앞 어깨 · 앞 진동 다트 입구 바로 앞 · 기본 너치 " + allN.filter(n => !n.held).length + "개는 보류 안 함(재단선까지 선)");
  ok(Object.keys(ib).concat(Object.keys(iF)).length === allN.length && V6.m.pieces.back.notches.every(n => !!n.held === ib[n.id].held) && V6.m.pieces.front.notches.every(n => !!n.held === iF[n.id].held),
    "6: 보류 판정 = 독립 계측과 같음(원래 점 ↔ 정리 외곽 거리 · 직선 방향 차) — 뒤 어깨 2.5cm: " + ib[heldN.find(n => n.atCm === 2.5).id].dev.toFixed(4) + "cm · " + ib[heldN.find(n => n.atCm === 2.5).id].deg.toFixed(2) + "° / 0cm(목옆점 — 자리는 같고 방향만): " + ib[heldN.find(n => n.atCm === 0).id].dev.toFixed(5) + "cm · " + ib[heldN.find(n => n.atCm === 0).id].deg.toFixed(2) + "°");
  const hb = V6.D6.back.heldNotches, nb = V6.D6.back.notches;
  ok(hb.length === 4 && hb.filter(n => n.mirrored).length === 2 && !nb.some(n => heldN.some(h => h.id === n.id)) && V6.D6.front.heldNotches.length === 0, "6: 표시 모델 — 보류 너치는 notches 에 없고 heldNotches 에(골 펼친 뒤판 = 원래·반사 2 × 2) · 앞판 보류 0");
  const pre = S6.W.cutPrint.preflight(P6), pr = S6.W.cutPrint.build(P6, null, META), gx = S6.W.cutDxf.build(P6, META), ax = S6.W.cutDxf.build(P6, META, { format: "aama" });
  const nShow = ["front", "back"].reduce((a, pid) => a + V6.D6[pid].notches.length, 0) + Object.keys(V6.D6).filter(k => k !== "front" && k !== "back").reduce((a, k) => a + V6.D6[k].notches.length, 0);
  const nPrint = (pr.sheetSvg.match(/class="cp-notch"/g) || []).length + (pr.sheetSvg.match(/class="cp-notch-dot"/g) || []).length, nDxf = (gx.dxf.match(/\r\nNOTCH\r\n(10|39|40)/g) || []).length, nDxfAll = gx.stats.layers.NOTCH;
  const lineN = Object.keys(V6.D6).reduce((a, k) => a + V6.D6[k].notches.filter(n => n.to).length, 0), nAama = Object.values(ax.stats.layers ? { a: ax.stats.layers["4"] } : {}).reduce((a, b) => a + (b || 0), 0);
  const innerP = ["collar-stand", "collar-body"].map(k => V6.D6[k]).filter(Boolean), innerN = innerP.reduce((a, d) => a + d.notches.length, 0), innerLineN = innerP.reduce((a, d) => a + d.notches.filter(n => n.to).length, 0);   // DXF 는 밴드·위 칼라 안(-inner) 복제 조각의 너치도 낸다(인쇄·표시 모델은 한 조각)
  ok(pre.ok && pre.attention.filter(x => /맞춤 «맞춤 \d+» 보류/.test(x)).length === 2 && nPrint === nShow && nDxfAll === nShow + innerN && nAama === lineN + innerLineN && /맞춤 «맞춤 \d+» 보류/.test(pr.body.split("cp-pg")[0]),
    "6: 사전 점검 = 막지 않고 알림 2건(안내 쪽에도) · 인쇄 너치 " + nPrint + " = DXF 너치 " + nDxfAll + " = 표시 모델(보류 제외) + 안 조각 " + innerN + " · AAMA 너치 점 " + nAama + " = 선 있는 너치 + 안 조각 " + innerLineN);
  const heldPts = hb.map(n => n.at), pos = V6.d.pieces ? null : null;
  ok(!heldPts.some(q => [...pr.sheetSvg.matchAll(/class="cp-notch"[^>]* d="M(-?[\d.]+) (-?[\d.]+) /g)].some(m => Math.hypot(+m[1] - q.x, +m[2] - q.y) < 1e-3)), "6: 보류 너치의 옛 자리는 인쇄 너치에 없음");
  // 방향 전환 · 시접 폭 · 되돌리기
  const bdart = S6.CUT.dartsOf(V6.d, P6).list.find(x => x.pieceId === "back");
  S6.CUT.setDartMode("back", bdart.id, "center-legacy", P6); let V7 = view6();
  ok(V7.m.pieces.back.notches.every(n => !n.held && (n.to || n.why)) && V7.m.pieces.back.notches.filter(n => n.user && n.atCm === 2.5)[0].to && V7.D6.back.heldNotches.length === 0 && S6.W.cutPrint.preflight(P6).attention.every(x => !/보류 — 다트 입구/.test(x)), "6: 뒤 어깨를 예전 방식으로 바꾸면(정리 없음) 같은 너치가 보류 없이 정상 출력");
  S6.CUT.setDartMode("back", bdart.id, "center-chord", P6); const w1 = S6.CUT.setEdge("back", "shoulder", { widthCm: 1.5 }, P6); V7 = view6();
  ok(w1.ok && V7.m.pieces.back.ok && V7.m.pieces.back.notches.filter(n => n.held).length === 2 && V7.m.pieces.back.notches.filter(n => !n.held).every(n => n.to || n.why), "6: 다시 직선 정리 + 어깨 시접 1.5cm = 같은 2개 보류(폭과 무관 · 위치로만 판정) · 나머지는 새 재단선까지");
  const fdart = S6.CUT.dartsOf(V7.d, P6).list.find(x => x.pieceId === "front"); S6.CUT.setDartMode("front", fdart.id, "down-legacy", P6); V7 = view6(); const fNow = V7.m.pieces.front.notches; S6.CUT.setDartMode("front", fdart.id, "up-extend", P6); const fUp = view6().m.pieces.front.notches;
  ok(fNow.every(n => !n.held) && fUp.every(n => !n.held) && J(fNow.map(n => [n.id, n.sewnAt])) === J(fUp.map(n => [n.id, n.sewnAt])), "6: 앞 진동 다트 위↔아래 = 앞판 너치 보류 0 · 너치 자리 같음(연장 방식은 진동선을 바꾸지 않음)");
  ok(J(P6.working.cutNotches) === nsSaved && hashes(P6) === h6, "6: 저장된 너치(위치·서명) 그대로 · 삭제·재배치 없음 · 완료 hash 그대로");
  // 뒤 어깨 입구 연장(2026-11-27 master 확정으로 대체) — 다리 봉제선은 새 입구점까지 · 디자인 원본(조각 segs)의 원래 다리는 그대로
  const bd = V7.D6.back, bt = V7.m.pieces.back.trued.darts[0];
  const legSeg = PIECE(V7.d, "back").segs[bt.legs[0]];
  ok(bt.mouthShiftCm > 0.05 && legSeg.kind === "line" && d2(legSeg.from, bt.mouthA) < 1e-9 && bd.finalTrued && !bd.outline.some(g => J(g) === J(legSeg)) && bd.dartLegs.some(l => d2(l.b, bt.newMouthA) < 1e-12) && bd.dartLegs.some(l => d2(l.b, bt.newMouthB) < 1e-12), "6: 뒤 어깨 입구가 " + (bt.mouthShiftCm * 10).toFixed(2) + "mm 늘어난 새 입구점까지 다리 봉제선 · 원래 다리(디자인 원본)는 조각 데이터에 그대로");
  ok(/다트 봉제선 = 꼭짓점에서 새 입구점 두 곳까지/.test(SRC["cutPrep.js"]) && !/긴 V 는 원래 입구까지만 그립니다/.test(SRC["cutPrep.js"]), "6: 재단 목록 안내 = 최종 모델(예전 «연장 미확정» 문구 제거)");
  { const held = bd.heldNotches.filter(n => !n.mirrored); ok(held.length >= 1 && bd.notches.every(n => !held.some(h => h.id === n.id)), "6: 뒤 어깨 사용자 너치 = 계속 보류(출력에 안 나감 · " + held.length + "개) — 다트 너치와 별개"); }
  const cp = SRC["cutPrep.js"];
  ok(/e\.pointerType && e\.pointerType !== "mouse"\) ghostGuard = \{ x: e\.clientX, y: e\.clientY, until: Date\.now\(\) \+ 700 \}/.test(cp) && /tg\.closest\("#cutSeamCard"\)/.test(cp) && /> 24\) return;/.test(cp), "6: 손가락으로 변을 고르면 바로 뜬 카드에 떨어지는 뒤따르는 클릭 한 번만 삼킨다(실측 390: 그 클릭이 «적용»을 눌러 시접 폭을 «직접 지정»으로 저장하던 문제) — 마우스·나중의 일부러 누름은 그대로");
}

// ══ §7 시접 3mm 이하 너치 규칙(2026-11-28 master 확정) — 경계 0 / 0.1 / 0.3(포함) / 0.31 / 1cm ══
//   ≤3mm: 사용자 너치 추가·위치 지정 금지 · 저장 너치 삭제 없이 보류·미출력 · 뒤 어깨 자동 다트 너치 미생성 · >3mm: 기존 규칙(복원). 기본 맞춤점은 범위 밖.
{
  const L = buildP(), S7 = L.S, P7 = L.P, C = S7.CUT; ok(L.ok, "7: 셔츠 한 벌 완료");
  const side = C.derive(P7, true).pieces.find(p => p.id === "back").edges.find(e => e.label === "side" || /옆/.test(e.name));
  const uS = C.addNotch("back", side.id, 5, P7), uH = C.addNotch("back", "shoulder", 2.5, P7);
  ok(uS.ok && uH.ok, "7: 시접 1cm(기본)에서 뒤 옆선·뒤 어깨에 사용자 너치 추가 가능");
  const defIds = () => { const m = model(S7, P7); return m.m.pieces.back.notches.filter(n => !n.user).map(n => n.id + (n.held ? "!" : "")).join(","); }, def0 = defIds();
  const dxfBack = () => { const g = S7.W.cutDxf.build(P7, META), a = S7.W.cutDxf.build(P7, META, { format: "aama" }); return { g: g.ok ? g.stats.pieces.find(q => q.base === "back").notches : -1, a: a.ok ? a.stats.pieces.find(q => q.base === "back").notches : -1, gx: g }; };
  const rows = [];
  [0, 0.1, 0.3, 0.31, 1].forEach(w => {
    const a = C.setEdge("back", side.id, { widthCm: w }, P7), b = C.setEdge("back", "shoulder", { widthCm: w }, P7);
    const store0 = J(P7.working.cutNotches), m = model(S7, P7), B = m.D.back, sb = m.m.pieces.back;
    const nS = sb.notches.find(n => n.id === uS.id), nH = sb.notches.find(n => n.id === uH.id), dn = B.notches.filter(n => n.dart);
    const add = C.addNotch("back", side.id, 7, P7), store1 = J(P7.working.cutNotches); if (add.ok) C.removeNotch(add.id, P7);
    const mv = C.moveNotch(uS.id, 6, P7), store2 = J(P7.working.cutNotches); if (mv.ok) C.moveNotch(uS.id, 5, P7);
    const X = dxfBack(), narrow = w <= 0.3;
    rows.push({ w, a: a.ok && b.ok, narrow, nS, nH, dn, add, mv, X, B, sameStoreAdd: store1 === store0, sameStoreMove: store2 === store0, def: defIds() });
  });
  rows.forEach(r => {
    const tag = "7: 시접 " + (r.w * 10) + "mm — ";
    if (r.narrow) {
      ok(r.a && !r.add.ok && r.add.code === "seam-narrow" && /3mm 이하/.test(r.add.reason) && r.sameStoreAdd && !r.mv.ok && r.mv.code === "seam-narrow" && r.sameStoreMove, tag + "사용자 너치 추가·위치 지정 막힘(이유 «3mm 이하») · 저장값 그대로");
      ok(r.nS && r.nS.held && r.nS.heldNarrow && !r.nS.to && r.nH && r.nH.held && r.nH.heldNarrow && !r.B.notches.some(n => n.id === r.nS.id || n.id === r.nH.id) && r.B.heldNotches.some(h => h.id === r.nS.id), tag + "저장 너치(옆선·어깨) = 삭제 없이 보류 · 출력 모델에 없음 · 화면 보류 표시");
      ok(r.dn.length === 0 && (r.B.dartWhy || []).some(x => /다트 너치 — .*3mm 이하/.test(x)) && !(r.B.dartWhy || []).some(x => /시접 미완/.test(x)) && r.B.dartLegs.length === 4, tag + "뒤 어깨 다트 너치 미생성 + 이유 · 다리 봉제선은 그대로 4");
    } else {
      const sh = r.dn.filter(n => !n.mirrored);
      ok(r.a && r.add.ok && r.mv.ok && r.nS && !r.nS.held && r.nS.to && r.B.notches.some(n => n.id === r.nS.id), tag + "기존 규칙 복원 — 추가·이동 가능 · 옆선 저장 너치 다시 출력");
      ok(r.nH && r.nH.held && !r.nH.heldNarrow && /접어 정리/.test(r.nH.heldWhy), tag + "어깨 사용자 너치 = 기존 다트 정리 보류 사유로 돌아감(3mm 사유 아님)");
      ok(r.dn.length === 4 && sh.length === 2 && sh.every(n => Math.abs(d2(n.from, n.to) - 0.3) < 1e-9 && n.seamCm > 0.3) && !(r.B.dartWhy || []).length, tag + "뒤 어깨 다트 너치 2(펼친 한 장 4) · I자 3mm");
    }
    ok(r.X.g === r.B.notches.length && r.X.a === r.B.notches.filter(n => n.to).length, tag + "DXF 일반·AAMA 뒤판 너치 수 = 출력 모델(" + r.X.g + "/" + r.X.a + ")");
  });
  ok(rows.every(r => r.def === rows[4].def), "7: 기본 맞춤점(WL·진동)은 범위 밖 — 시접 폭과 무관하게 같은 목록·보류 없음(시접 0 의 점 표시는 기존 규칙)");
  ok(J(Object.keys(P7.working.cutNotches.notches).sort()) === J([uS.id, uH.id].sort()) && P7.working.cutNotches.notches[uS.id].atCm === 5 && P7.working.cutNotches.notches[uH.id].atCm === 2.5, "7: 경계 왕복 뒤 저장 너치 2개·위치 그대로(삭제·이동 없음)");
  // 저장→열기 바이트 동일(보류 상태에서) — 보류는 계산 결과일 뿐 저장값이 아니다
  C.setEdge("back", side.id, { widthCm: 0.2 }, P7); const sv = J(P7.working.cutNotches), rt = JSON.parse(J(P7.working));
  ok(J(rt.cutNotches) === sv && !/held/.test(sv), "7: 보류 상태 저장값에 보류 표시가 들어가지 않음(저장 형식 그대로)");
  ok(/narrow0 \? esc\(narrowWhy/.test(SRC["cutPrep.js"]) && /aria-disabled/.test(SRC["cutPrep.js"]) && /출력 너치 /.test(SRC["cutPrep.js"]), "7: 재단 카드 = 추가 버튼 disabled+aria-disabled+이유 tooltip · 목록에 실제 출력 너치 수·길이");
}

console.log("cutDartTrueCheck: " + PASS + " passed, " + FAIL + " failed");
fails.forEach(f => console.log("  FAIL " + f));
process.exit(FAIL ? 1 : 0);
