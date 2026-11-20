// ══════════════════════════════════════════════
// cutNotchCheck.js — 재단: 맞춤 표시(너치) 1차 (실제 엔진 · 2026-11-15)
//   근거가 확실한 기본 맞춤 표시만: 옆선 WL(앞↔뒤 짝) · 뒤중심 WL · 소매산점(↔ 몸판 SP) · 밴드 SNP(↔ 몸판 SNP). 저장 없음(읽기 전용 파생).
//   §1 위치 = 독립 검산(허리선 y · 소매 중심선 끝 · 밴드 달림선을 뒤중심에서 뒤 목둘레만큼 직접 잼)
//   §2 표시 선 = 완성선에 직각 · 길이 = 그 변 시접 폭 · 끝이 재단선 위 · 골선(0) = 선 없음 + 사유
//   §3 시접 폭을 바꿔도 위치(완성선 위 점)는 그대로 · 선 길이만 바뀜
//   §4 형상·완료 hash·그래프·저장 파일 무변경(맞춤 표시는 저장하지 않음) · 저장 → 열기 = 같은 맞춤 표시
//   §5 디자인 변경 = 표시 없음(«변경됨») → 재완료 = 새 형상 기준으로 다시 · 아직 만들지 않은 것 = 이유 목록
//   node test/harness/cutNotchCheck.js
// ══════════════════════════════════════════════
"use strict";
const vm = require("vm"), fs = require("fs"), path = require("path");
let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
process.on("uncaughtException", e => { console.log("cutNotchCheck: 예외 — " + (e && e.stack || e).toString().split("\n").slice(0, 3).join(" | ")); fails.slice(0, 20).forEach(f => console.log("  ✗ " + f)); process.exit(1); });
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

// ══ §1 위치 ══
const r = buildP(), S = r.S, P = r.P, R = S.DR.latest(P), H0 = hashes(P), G0 = graph(S);
let V = view(S, P);
{
  ok(r.ok && nids(V.N) === "back-ah-low,back-ah-up,back-center-wl,back-side-seam-wl,collar-stand-snp,front-ah-low,front-ah-up,front-side-seam-wl,sleeve-back-low,sleeve-back-up,sleeve-cap-top,sleeve-front-low,sleeve-front-up", "1: 기본 맞춤 표시 13개(WL 3 · 소매산점 · 밴드 SNP · 진동 4 · 소매산 4) (" + nids(V.N) + ")");
  const fw = V.N["front-side-seam-wl"], bw = V.N["back-side-seam-wl"], cw = V.N["back-center-wl"];
  ok(near(fw.sewnAt.x, 23.053125, 1e-9) && near(fw.sewnAt.y, 38, 1e-9) && near(bw.sewnAt.x, 23.053125, 1e-9) && near(bw.sewnAt.y, 38, 1e-9) && near(cw.sewnAt.x, 0, 1e-9) && near(cw.sewnAt.y, 38, 1e-9), "1: WL = 허리선(y 38) 위 · 앞·뒤 옆선(x 23.05) · 뒤중심(x 0)");
  ok(fw.pairId === "wl-side" && bw.pairId === "wl-side" && near(fw.pair.diffCm, 0, 1e-9) && /17\.38/.test(fw.pair.a) && cw.pairId === null && !cw.pair, "1: 옆선 WL = 앞↔뒤 짝(겨드랑이~WL 17.38 / 17.38 · 차 0) · 뒤중심 WL = 짝 없음");
  const sl = V.d.pieces.find(p => p.id === "sleeve-sleeve"), cl = R.sleeve.geometry.construction.find(c => c.role === "center-line"), top = cl.from.y < cl.to.y ? cl.from : cl.to, ct = V.N["sleeve-cap-top"];
  ok(near(ct.sewnAt.x, top.x, 1e-9) && near(ct.sewnAt.y, top.y, 1e-9) && sl.edges.find(e => e.id === "cap").segs.length === 5, "1: 소매산점 = 소매 중심선 위끝(독립: 완료본 center-line) (" + J([ct.sewnAt.x, ct.sewnAt.y]) + ")");
  ok(ct.pairId === "cap-sp" && near(ct.pair.diffCm, R.sleeve.cap ? ct.pair.diffCm : ct.pair.diffCm, 0) && /SP/.test(ct.pair.a) && near(ct.pair.diffCm, S.W.designSleeve.capPrimitives(R.sleeve.geometry).lengths.total - R.bodice.armholeLengths.front - R.bodice.armholeLengths.back, 1e-3), "1: 소매산점 짝 = 몸판 SP(모서리) · 이세 합계 " + ct.pair.diffCm);
  // 밴드 SNP: 달림선을 뒤중심 끝에서 직접 따라가 뒤 목둘레 길이가 되는 점
  const st = V.d.pieces.find(p => p.id === "collar-stand"), ns = st.edges.find(e => e.id === "neck-seam"), cb = st.edges.find(e => e.id === "cb-fold");
  const ch = ns.segs.map(i => st.segs[i]), cbx = cb.segs.map(i => st.segs[i]), cbPts = [cbx[0].from, cbx[cbx.length - 1].to];
  const fromCB = cbPts.some(q => Math.hypot(q.x - ch[0].from.x, q.y - ch[0].from.y) < 1e-9) ? ch : ch.slice().reverse().map(g => g.kind === "cubic" ? { kind: "cubic", from: g.to, c1: g.c2, c2: g.c1, to: g.from } : { kind: "line", from: g.to, to: g.from });
  const pts = dense(fromCB), want = R.bodice.necklineLengths.back; let acc = 0, hit = null;
  for (let i = 1; i < pts.length && !hit; i++) { const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); if (acc + d >= want) { const t = (want - acc) / d; hit = { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t }; } acc += d; }
  const sn = V.N["collar-stand-snp"];
  ok(hit && Math.hypot(hit.x - sn.sewnAt.x, hit.y - sn.sewnAt.y) <= 0.01 && near(sn.atCm, want, 1e-4), "1: 밴드 SNP = 뒤중심에서 달림선을 따라 뒤 목둘레 " + want + "cm(독립 2000점 실측 · 오차 " + (hit && Math.hypot(hit.x - sn.sewnAt.x, hit.y - sn.sewnAt.y).toExponential(1)) + ")");
  ok(sn.pairId === "neck-snp" && near(sn.pair.diffCm, 0, 1e-3) && /SNP/.test(sn.pair.a), "1: 밴드 SNP 짝 = 몸판 SNP(모서리) · 달림선 − 목둘레 " + sn.pair.diffCm);
  ok(Object.values(V.N).every(n => /P\.16[45]/.test(n.basis) && typeof n.atCm === "number" && n.atCm > 0 && n.atCm < n.edgeLenCm && typeof n.sig === "string"), "1: 모든 표시 = 근거 문구(P.164·165) · 변 위 위치(0 < 위치 < 변 길이) · 변 서명");
}

// ══ §2 표시 선 ══
{
  let worstPerp = 0, worstLen = 0, worstOn = 0;
  Object.values(V.N).forEach(n => { if (!n.to) return;
    const p = V.d.pieces.find(x => x.id === n.pieceId), e = p.edges.find(x => x.id === n.edgeId), fin = dense(e.segs.map(i => p.segs[i])), sm = V.m.pieces[n.pieceId];
    // ⑧(2026-11-19): 선은 재단선에서 안으로 최대 7mm — 맞춤 위치(완성선 위 점)는 선을 재단선 → 안쪽으로 seamCm 만큼 이어 낸 점
    const l0x = n.to.x - n.from.x, l0y = n.to.y - n.from.y, L0 = Math.hypot(l0x, l0y), p0 = { x: n.to.x - l0x / L0 * n.seamCm, y: n.to.y - l0y / L0 * n.seamCm };
    let k = 0, b = Infinity; fin.forEach((q, i) => { const d = Math.hypot(q.x - p0.x, q.y - p0.y); if (d < b) { b = d; k = i; } });
    const a = fin[Math.max(0, k - 1)], c = fin[Math.min(fin.length - 1, k + 1)], tx = c.x - a.x, ty = c.y - a.y, lx = n.to.x - n.from.x, ly = n.to.y - n.from.y;
    worstPerp = Math.max(worstPerp, Math.abs(tx * lx + ty * ly) / Math.hypot(tx, ty) / Math.hypot(lx, ly));
    const w = sm.edges.find(x => x.id === n.edgeId).widthCm; worstLen = Math.max(worstLen, Math.abs(Math.hypot(lx, ly) - Math.min(w, 0.7)), Math.abs(n.seamCm - w));
    worstOn = Math.max(worstOn, dPoly(n.to, sm.points, true)); });
  ok(worstPerp < 1e-3, "2: 표시 선 = 완성선에 직각(최대 cos " + worstPerp.toExponential(1) + ")");
  ok(worstLen <= 0.01 && worstOn < 1e-6, "2: 표시 선 길이 = min(시접 폭, 7mm) · 재단선에서 안으로(오차 ≤ 0.01 · 실제 " + worstLen.toExponential(1) + ") · 끝 = 재단선 위");
  const cw = V.N["back-center-wl"];
  ok(cw.to === null && /골선/.test(cw.why), "2: 골선 뒤중심 WL = 재단선 표시 없음 + 사유");
  ok(near(V.N["front-side-seam-wl"].to.x, 22.053125, 1e-9) && near(V.N["back-side-seam-wl"].to.x, 24.053125, 1e-9) && V.N["sleeve-cap-top"].to.y < V.N["sleeve-cap-top"].from.y, "2: 바깥쪽으로(앞 옆선 −x · 뒤 옆선 +x · 소매산 위쪽)");
}

// ══ §3 시접 폭을 바꿔도 위치는 그대로 ══
{
  const before = J(Object.values(V.N).map(n => [n.id, n.sewnAt, n.atCm]));
  ok(S.CUT.setEdge("back", "side-seam", { widthCm: 2 }, P).ok && S.CUT.setEdge("back", "center", { kind: "seam", widthCm: 1.3 }, P).ok && S.CUT.setEdge("collar-stand", "neck-seam", { widthCm: 0.6 }, P).ok, "3: 뒤 옆선 2 · 뒤중심 봉제선 1.3 · 밴드 달림선 0.6 적용");
  const W2 = view(S, P);
  ok(J(Object.values(W2.N).map(n => [n.id, n.sewnAt, n.atCm])) === before, "3: 맞춤 표시 위치(완성선 위 점·호 길이) 전부 그대로");
  ok(near(Math.hypot(W2.N["back-side-seam-wl"].to.x - W2.N["back-side-seam-wl"].from.x, W2.N["back-side-seam-wl"].to.y - W2.N["back-side-seam-wl"].from.y), 0.7, 1e-9) && near(W2.N["back-side-seam-wl"].seamCm, 2, 1e-9) && near(W2.N["back-center-wl"].lenCm, 0.7, 1e-9) && near(W2.N["back-center-wl"].seamCm, 1.3, 1e-9) && W2.N["back-center-wl"].to.x < 0 && W2.N["collar-stand-snp"].to === null && /시접 미완/.test(W2.N["collar-stand-snp"].why) && W2.m.pieces["collar-stand"].refusals.some(x => x.code === "step"), "3: 선 길이만 새 폭으로(2 · 1.3) · 뒤중심은 봉제선이 되자 표시 생김 · 밴드 달림선만 0.6 = 옆 변과 일직선 단차로 시접 거부 → SNP 표시 선 없음 + 사유 " + J([W2.N["back-side-seam-wl"].lenCm, W2.N["back-center-wl"].lenCm, W2.N["back-center-wl"].to, W2.N["collar-stand-snp"].lenCm]));
  ok(S.CUT.setEdge("collar-stand", "extension", { widthCm: 0.6 }, P).ok && Math.abs(view(S, P).N["collar-stand-snp"].seamCm - 0.6) <= 0.01 && Math.abs(view(S, P).N["collar-stand-snp"].lenCm - 0.6) <= 0.01, "3: 옆 변도 0.6 으로 맞추면 밴드 시접 완료 → SNP 시접 0.6 · 표시 선은 시접 폭(7mm보다 좁아 봉제선에서 멈춤)");
  ok(S.CUT.setEdge("back", "side-seam", { widthCm: 0 }, P).ok && view(S, P).N["back-side-seam-wl"].to === null && /시접 0/.test(view(S, P).N["back-side-seam-wl"].why), "3: 폭 0 = 선 없음 + «시접 0» 사유(위치는 남음)");
  ok(S.CUT.setEdge("sleeve-sleeve", "cap", { widthCm: 6 }, P).ok && view(S, P).N["sleeve-cap-top"].to === null && /시접 미완/.test(view(S, P).N["sleeve-cap-top"].why), "3: 조각 시접 미완(소매산 6cm) = 표시 선 없음 + 사유(완료인 척 안 함)");
  S.CUT.setEdge("sleeve-sleeve", "cap", { widthCm: 1 }, P); S.CUT.setEdge("back", "side-seam", { widthCm: 1 }, P);
}

// ══ §4 무변경 · 저장 ══
{
  ok(hashes(P) === H0 && !("notches" in S.CUT.derive(P)) && Object.keys(P.working.cutSpec.edges).every(k => !/notch/i.test(k)), "4: 완료 hash 4개 불변 · 기본 derive 에는 맞춤 표시 없음(요청할 때만) · 시접 설정에 맞춤 표시 항목 없음");
  const AT = { savedAt: "2026-11-15T00:00:00.000Z" }, text = S.PF.buildFileText(AT).text;
  ok(!/notch|너치|맞춤 표시/.test(text) && JSON.parse(text).schemaVersion === 1, "4: 저장 파일에 맞춤 표시 데이터 없음(파생) · schemaVersion 1");
  const S2 = makeSession(), v = S2.PF.verifyText(text); S2.PF.commitCandidate(v.candidate);
  const V2 = view(S2, S2.P()), V1 = view(S, P);
  ok(v.ok && J(V2.d.notches) === J(V1.d.notches) && J(Object.values(V2.N)) === J(Object.values(V1.N)), "4: 저장 → 빈 세션 열기 = 같은 맞춤 표시(위치·선·짝·근거)");
  const S3 = makeSession(), v3 = S3.PF.verifyText(G0 ? (() => { const s0 = buildP(); return s0.S.PF.buildFileText(AT).text; })() : ""); S3.PF.commitCandidate(v3.candidate);
  ok(v3.ok && S3.P().working.cutSpec === undefined && nids(view(S3, S3.P()).N) === nids(V.N), "4: 시접 설정이 없는 파일도 기본 맞춤 표시 그대로");
}

// ══ §5 디자인 변경 · 아직 만들지 않은 것 ══
{
  ok(S.W.sleeveAApply.apply(P, { sleeveLengthCm: 48, cuff: cuffOf(S, null) }).ok, "5: 완료 뒤 소매 길이 48 로 수정");
  const dX = S.CUT.derive(P, true);
  ok(dX.state === "changed" && !dX.notches && S.CUT.seam(dX, P).state === "blocked", "5: «변경됨» = 맞춤 표시 없음(옛 위치를 보여 주지 않음)");
  ok(completeChain(S, P), "5: 재완료");
  const V3 = view(S, P);
  ok(nids(V3.N) === nids(V.N) && near(V3.N["sleeve-cap-top"].sewnAt.y, V.N["sleeve-cap-top"].sewnAt.y, 1e-9) && near(V3.N["collar-stand-snp"].atCm, V.N["collar-stand-snp"].atCm, 1e-9), "5: 재완료 = 새 형상 기준으로 다시(소매산점·밴드 SNP 그대로)");
  const td = V3.d.notches.todo.map(t => t.what).join(" | ");
  ok(/앞 중심 WL/.test(td) && /위 칼라 SNP/.test(td) && !/진동 둘레·소매산 너치/.test(td) && /다트 위치/.test(td) && V3.d.notches.todo.every(t => t.why.length > 10), "5: 아직 만들지 않은 것 = 이유와 함께 목록 (" + V3.d.notches.todo.length + "개)");
  // 여밈 없는 앞판: 앞중심 WL 이 생기고 «앞 중심 WL» 미지원 사유는 사라짐
  const S6 = makeSession(), P6 = start(S6); S6.BC.complete(P6); S6.W.sleeveAApply.apply(P6, { sleeveLengthCm: 52, cuff: cuffOf(S6, null) }); completeChain(S6, P6);
  const V6 = view(S6, P6);
  ok(V6.N["front-center-wl"] && near(V6.N["front-center-wl"].sewnAt.y, 38, 1e-9) && V6.N["front-center-wl"].to && !V6.d.notches.todo.some(t => /앞 중심 WL/.test(t.what)), "5: 여밈 없는 앞판 = 앞중심 WL 표시(1cm 시접 선) · 미지원 사유 없음");
}

// ══ §6 진동 둘레 · 소매산 너치(P.165 · 몸판 먼저 → 소매 파생 · 구간별 이즈 배분) ══
{
  const r6 = buildP(), S6 = r6.S, P6 = r6.P, R6 = S6.DR.latest(P6), V6 = view(S6, P6), AH = R6.bodice.armholeLengths, pr = S6.W.designSleeve.capPrimitives(R6.sleeve.geometry);
  // 독립: 몸판 진동 봉제 경로(다트 다리 제외)를 SP 쪽 끝에서 직접 따라가 6cm · 아랫점 쪽에서 6.5 / 5
  const walk = (segs, want) => { const pts = []; segs.forEach(g => dense([g]).forEach((q, i) => { if (i === 0 && pts.length) return; pts.push(q); })); let acc = 0; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); if (acc + d >= want) { const t = (want - acc) / d; return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t }; } acc += d; } return null; };
  const revSeg = g => g.kind === "cubic" ? { kind: "cubic", from: g.to, c1: g.c2, c2: g.c1, to: g.from } : { kind: "line", from: g.to, to: g.from };
  let worstB = 0, lenErr = 0;
  ["front", "back"].forEach(pid => {
    const p = V6.d.pieces.find(x => x.id === pid), e = p.edges.find(x => x.id === "armhole"), legs = new Set(); e.darts.forEach(d => d.legs.forEach(i => legs.add(i)));
    const runs = e.segs.filter(i => !legs.has(i)).map(i => p.segs[i]), L = runs.reduce((t, g) => { const q = dense([g]); let a = 0; for (let i = 1; i < q.length; i++) a += Math.hypot(q[i].x - q[i - 1].x, q[i].y - q[i - 1].y); return t + a; }, 0);
    lenErr = Math.max(lenErr, Math.abs(L - AH[pid]));
    const fromUnder = runs, fromSP = runs.slice().reverse().map(revSeg);   // 진동 변은 옆선 끝(아랫점)에서 시작해 SP 에서 끝난다(실측)
    const up = walk(fromSP, 6), low = walk(fromUnder, pid === "back" ? 6.5 : 5), nu = V6.N[pid + "-ah-up"], nl = V6.N[pid + "-ah-low"];
    worstB = Math.max(worstB, Math.hypot(up.x - nu.sewnAt.x, up.y - nu.sewnAt.y), Math.hypot(low.x - nl.sewnAt.x, low.y - nl.sewnAt.y));
  });
  ok(lenErr < 0.002, "6: 몸판 봉제 진동(다트 다리 제외 · 독립 실측) = 완료 몸판 기록 armholeLengths (최대 차 " + lenErr.toExponential(1) + ")");
  ok(worstB <= 0.01, "6: 몸판 진동 너치 = SP 에서 봉제 진동 6 · 진동 아랫점에서 뒤 6.5 / 앞 5 (독립 2000점 실측 · 오차 " + worstB.toExponential(1) + ")");
  const tot = pr.lengths.total - AH.front - AH.back, r1 = v => Math.round(v * 10) / 10, A = V6.m.armhole;
  const want = { back: { up: 6 + r1(tot * 0.35), low: 6.5 + r1(tot * 0.06) }, front: { up: 6 + r1(tot * 0.32), low: 5 + r1(tot * 0) } };
  ok(A.ok && A.book && near(A.totalEaseCm, tot, 1e-4) && near(A.sides.back.ease.up, 0.7, 1e-12) && near(A.sides.back.ease.low, 0.1, 1e-12) && near(A.sides.front.ease.up, 0.7, 1e-12) && A.sides.front.ease.low === 0, "6: 전체 이즈 " + tot.toFixed(4) + " × 구간 비율(뒤 위 35 · 뒤 아래 6 · 앞 위 32 · 앞 아래 0) → 0.1 반올림 = 0.7 · 0.1 · 0.7 · 0");
  // 독립: 소매산 선을 소매산점에서 뒤/앞으로 (6 + 이즈), 소매 아랫점에서 (6.5|5 + 이즈)
  const sl = V6.d.pieces.find(x => x.id === "sleeve-sleeve"), cap = sl.edges.find(x => x.id === "cap"), capSegs = cap.segs.map(i => sl.segs[i]);
  const cpts = dense(capSegs), top = pr.splitPoint; let k0 = 0, b0 = Infinity; cpts.forEach((q, i) => { const d = Math.hypot(q.x - top.x, q.y - top.y); if (d < b0) { b0 = d; k0 = i; } });
  const walkPts = (pts, want2) => { let acc = 0; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); if (acc + d >= want2) { const t = (want2 - acc) / d; return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t }; } acc += d; } return null; };
  const backPts = cpts.slice(0, k0 + 1), frontPts = cpts.slice(k0);   // 소매산 선은 뒤 아랫점에서 시작(실측: 앞 길이 쪽이 뒤)
  const sBU = walkPts(backPts.slice().reverse(), want.back.up), sBL = walkPts(backPts, want.back.low), sFU = walkPts(frontPts, want.front.up), sFL = walkPts(frontPts.slice().reverse(), want.front.low);
  const dS = [[sBU, "sleeve-back-up"], [sBL, "sleeve-back-low"], [sFU, "sleeve-front-up"], [sFL, "sleeve-front-low"]].map(x => Math.hypot(x[0].x - V6.N[x[1]].sewnAt.x, x[0].y - V6.N[x[1]].sewnAt.y));
  ok(Math.max(...dS) <= 0.01 && near(b0, 0, 1e-6), "6: 소매 너치 = 소매산점에서 6 + 이즈 · 소매 아랫점에서 6.5|5 + 이즈 (독립 실측 · 최대 오차 " + Math.max(...dS).toExponential(1) + ")");
  ok(["back", "front"].every(k => V6.N[k + "-ah-up"].pairId === V6.N["sleeve-" + k + "-up"].pairId && V6.N[k + "-ah-low"].pairId === V6.N["sleeve-" + k + "-low"].pairId), "6: 짝 = 같은 자리의 몸판 ↔ 소매 너치(위·아래 · 앞·뒤 4쌍)");
  // 총 이즈 보존: (몸판 구간 + 이즈) 의 합 = 소매산 길이 — 가운데 구간이 나머지를 흡수
  const sideOK = ["back", "front"].every(k => { const sd = A.sides[k]; return near(sd.ease.up + sd.ease.low + sd.midEaseCm, sd.sideEaseCm, 1e-4) && near(sd.midBodyCm + sd.ease.up + sd.ease.low + sd.midEaseCm + (k === "back" ? 12.5 : 11), sd.capCm, 1e-3); });
  ok(sideOK && near(A.sides.back.sideEaseCm + A.sides.front.sideEaseCm, tot, 1e-4), "6: 총 이즈 보존 — 위 + 아래 + 가운데(나머지) = 그쪽 실제 이즈 · 앞뒤 합 = 전체 이즈 (가운데 뒤 " + A.sides.back.midEaseCm + " · 앞 " + A.sides.front.midEaseCm + ")");
  const g0 = J(R6.sleeve.geometry), h0 = hashes(P6), seamPts0 = J(V6.m.pieces["sleeve-sleeve"].points);
  // 배분 수정 → 소매 너치만 움직임
  ok(S6.CUT.setEaseSplit({ back: [10, 20, 30], front: [30, 10, 0] }, P6).ok, "6: 배분 수정(뒤 10·20·30 · 앞 30·10·0)");
  const V7 = view(S6, P6);
  ok(!V7.m.armhole.book && near(V7.m.armhole.sides.back.ease.up, r1(tot * 0.3), 1e-12) && near(V7.m.armhole.sides.back.ease.low, r1(tot * 0.1), 1e-12) && ["back-ah-up", "back-ah-low", "front-ah-up", "front-ah-low"].every(id => J(V7.N[id].sewnAt) === J(V6.N[id].sewnAt)) && J(V7.N["sleeve-back-low"].sewnAt) !== J(V6.N["sleeve-back-low"].sewnAt),
    "6: 배분을 바꾸면 소매 너치만 이동(몸판 너치 그대로) · 뒤 위 이즈 " + V7.m.armhole.sides.back.ease.up + " · 뒤 아래 " + V7.m.armhole.sides.back.ease.low);
  ok(J(S6.DR.latest(P6).sleeve.geometry) === g0 && hashes(P6) === h0 && J(V7.m.pieces["sleeve-sleeve"].points) === seamPts0, "6: 소매 형상·완료 hash·시접선 무변경(너치 좌표만)");
  const badSplits = [[{ back: [6, 18, 35], front: [32, 9, 1] }, /합이 100/], [{ back: [6, 18, -1], front: [32, 9, 36] }, /0~100/], [{ back: [6, 18], front: [32, 9, 0, 35] }, /3개/], [{ back: [6, 18, NaN], front: [32, 9, 0] }, /0~100/], [{ back: [6, 18, 35] }, /두 항목/]];
  const snap = J(P6.working.cutNotches);
  ok(badSplits.every(b => { const x = S6.CUT.setEaseSplit(b[0], P6); return !x.ok && b[1].test(x.reason); }) && J(P6.working.cutNotches) === snap, "6: 합 ≠ 100 · 음수 · 칸 수 · NaN · 한쪽 누락 = 거부 + 사유 · 아무것도 안 씀");
  ok(S6.CUT.setEaseSplit(null, P6).ok && view(S6, P6).m.armhole.book && J(view(S6, P6).N["sleeve-back-low"].sewnAt) === J(V6.N["sleeve-back-low"].sewnAt), "6: «책 기본값» = 배분 항목 삭제 → 처음 위치로");
}

// ══ §7 사용자 맞춤 표시(working.cutNotches) ══
{
  const r7 = buildP(), S7 = r7.S, P7 = r7.P, H7 = hashes(P7), spec0 = J(P7.working.cutSpec);
  const a = S7.CUT.addNotch("front", "side-seam", 10, P7), b = S7.CUT.addNotch("back", "side-seam", 10.5, P7);
  ok(a.ok && b.ok && a.id === "u1" && b.id === "u2" && J(Object.keys(P7.working.cutNotches)) === J(["schema", "notches"]) && P7.working.cutNotches.notches.u1.atCm === 10, "7: 앞·뒤 옆선에 사용자 맞춤 표시 추가 → working.cutNotches(판 1)에만");
  ok(S7.CUT.pairNotches("u1", "u2", P7).ok && P7.working.cutNotches.notches.u1.pair === "u2" && P7.working.cutNotches.notches.u2.pair === "u1", "7: 짝 연결 = 양쪽이 서로 가리킴(위치는 각각 사용자 지정)");
  let V = view(S7, P7);
  const u1 = V.N.u1, f = V.d.pieces.find(x => x.id === "front"), fe = f.edges.find(x => x.id === "side-seam"), ch = fe.segs.map(i => f.segs[i]);
  const pts = dense(ch); let acc = 0, hit = null; for (let i = 1; i < pts.length && !hit; i++) { const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); if (acc + d >= 10) { const t = (10 - acc) / d; hit = { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t }; } acc += d; }
  const u1L = Math.hypot(u1.to.x - u1.from.x, u1.to.y - u1.from.y), u1Sew = { x: u1.to.x - (u1.to.x - u1.from.x) / u1L * u1.seamCm, y: u1.to.y - (u1.to.y - u1.from.y) / u1L * u1.seamCm };   // ⑧ 완성선 위 점 = 재단선 끝에서 시접 폭만큼 안쪽
  ok(u1.user && Math.hypot(hit.x - u1.sewnAt.x, hit.y - u1.sewnAt.y) < 1e-9 && Math.hypot(hit.x - u1Sew.x, hit.y - u1Sew.y) < 1e-6 && near(u1.seamCm, 1, 1e-9) && near(u1.lenCm, 0.7, 1e-9) && /시작에서 10/.test(u1.pair.a) && /10\.5/.test(u1.pair.b), "7: 위치 = 변 시작 끝에서 봉제 경로 10cm(독립 실측) · 재단선까지 1cm · 짝 설명에 양쪽 거리");
  ok(!S7.CUT.addNotch("front", "side-seam", 999, P7).ok && !S7.CUT.addNotch("front", "nope", 1, P7).ok && !S7.CUT.moveNotch("u1", -1, P7).ok && !S7.CUT.pairNotches("u1", "u1", P7).ok, "7: 변 길이 밖 · 없는 변 · 음수 · 자기 자신 짝 = 거부");
  ok(S7.CUT.addNotch("front", "side-seam", 3, P7).ok && !S7.CUT.pairNotches("u1", "u3", P7).ok, "7: 같은 변끼리 짝 = 거부(봉제로 붙는 다른 변만)");
  ok(S7.CUT.moveNotch("u1", 12, P7).ok && near(view(S7, P7).N.u1.atCm, 12, 1e-12) && S7.CUT.setEdge("front", "side-seam", { widthCm: 2.5 }, P7).ok && near(view(S7, P7).N.u1.atCm, 12, 1e-12) && near(view(S7, P7).N.u1.seamCm, 2.5, 1e-9) && near(view(S7, P7).N.u1.lenCm, 0.7, 1e-9), "7: 거리 수정 12 · 시접 2.5 로 바꿔도 위치 그대로(표시 선은 계속 재단선에서 안으로 7mm)");
  ok(S7.CUT.removeNotch("u3", P7).ok && !P7.working.cutNotches.notches.u3, "7: 삭제");
  ok(hashes(P7) === H7 && S7.DR.isCurrentDesignChanged(P7) === false && J(Object.keys(P7.working.cutSpec.edges)) === J(["front|side-seam"]), "7: 완료 hash 4개 불변 · «변경됨» 아님 · 시접 설정은 시접 값만");
  // 저장 → 열기
  const AT = { savedAt: "2026-11-15T00:00:00.000Z" }, text = S7.PF.buildFileText(AT).text;
  ok(/cutNotches/.test(text) && JSON.parse(text).schemaVersion === 1, "7: 저장 파일에 cutNotches 포함 · schemaVersion 1");
  const S8 = makeSession(), v8 = S8.PF.verifyText(text); S8.PF.commitCandidate(v8.candidate); const P8 = S8.P();
  ok(v8.ok && J(P8.working.cutNotches) === J(P7.working.cutNotches) && J(view(S8, P8).N) === J(view(S7, P7).N) && S8.PF.buildFileText(AT).text === text, "7: 빈 세션 열기 = 사용자 맞춤 표시·짝·기본 표시 동일 · 다시 저장 바이트 동일");
  // 엄격 검증(구조가 틀린 항목은 읽지 않고 잠금 · 고쳐 쓰지 않음)
  const wrong = [{ schema: 2, notches: {} }, { schema: 1 }, { schema: 1, notches: {}, x: 1 }, { schema: 1, notches: { x1: { piece: "front", edge: "hem", atCm: 1, sig: "a", label: "l" } } },
    { schema: 1, notches: { u1: { piece: "front", edge: "hem", atCm: -1, sig: "a", label: "l" } } }, { schema: 1, notches: { u1: { piece: "front", edge: "hem", atCm: 1, sig: "a", label: "l", hack: 1 } } },
    { schema: 1, notches: { u1: { piece: "front", edge: "hem", atCm: 1, sig: "a", label: "l", pair: "u2" } } }, { schema: 1, easeSplit: { back: [50, 50, 50], front: [0, 0, 0] }, notches: {} }];
  ok(wrong.every(w => { const S9 = makeSession(), v9 = S9.PF.verifyText(text); S9.PF.commitCandidate(v9.candidate); const P9 = S9.P(); P9.working.cutNotches = JSON.parse(J(w));
    const sp = S9.CUT.readNotchSpec(P9), m9 = view(S9, P9), x = S9.CUT.addNotch("back", "hem", 1, P9);
    return sp.state === "invalid" && m9.m.notchSpec.state === "invalid" && !Object.values(m9.N).some(n => n.user) && m9.m.armhole.book && !x.ok && /읽을 수 없/.test(x.reason) && J(P9.working.cutNotches) === J(w); }), "7: 구조가 틀린 맞춤 표시 항목 8종 = 읽지 않음(기본 표시만 · 책 배분) · 수정 잠금 · 값 그대로");
  { const S5 = makeSession(), P5 = S5.PF.verifyText(text); S5.PF.commitCandidate(P5.candidate); const PP = S5.P(); PP.working.cutNotches = { schema: 1, notches: JSON.parse('{"__proto__":{"piece":"a","edge":"b","atCm":1,"sig":"s","label":"l"}}') };
    let res = null; try { res = S5.PF.buildFileText(AT); } catch (e) { res = { thrown: e && e.reason }; } ok(!(res && res.text) && /forbidden-key/.test(J(res)), "7: 금지 키가 든 맞춤 표시 = 기존 저장 정책이 거부"); }
  // 현재 형상 변경 → 연결 끊김(삭제·자동 이동 없음) → 다시 연결 / 지우기
  ok(S7.CUT.addNotch("cuff", "outer-edge", 5, P7).ok && S7.CUT.addNotch("sleeve-sleeve", "hem", 4, P7).ok, "7: 커프스 바깥 변(u3) · 소맷부리(u4)에 추가");
  ok(S7.W.sleeveAApply.apply(P7, { sleeveLengthCm: 48 }).ok && completeChain(S7, P7), "7: 커프스 없는 소매 48 로 바꿔 재완료");
  V = view(S7, P7); const orph = V.m.notchOrphans.map(o => o.id).join(",");
  ok(orph === "u3,u4" && /조각이 지금/.test(V.m.notchOrphans[0].why) && /모양이 바뀌/.test(V.m.notchOrphans[1].why) && V.m.notchOrphans[1].canReconnect && !V.N.u3 && !V.N.u4 && V.N.u1 && V.N.u2 && P7.working.cutNotches.notches.u3, "7: 사라진 조각(커프스)·모양 바뀐 소맷부리 = 연결 끊김 보류(이유 · 표시 안 함 · 저장값 그대로) · 옆선 짝은 유지 (" + orph + ")");
  ok(S7.CUT.reconnectNotch("u4", P7).ok && view(S7, P7).N.u4 && !S7.CUT.reconnectNotch("u3", P7).ok && S7.CUT.removeNotch("u3", P7).ok && view(S7, P7).m.notchOrphans.length === 0, "7: 소맷부리 = «다시 연결» · 커프스 = 다시 연결 불가 → 지우기");
}

console.log("cutNotchCheck: " + PASS + " passed, " + FAIL + " failed");
fails.forEach(f => console.log("  FAIL " + f));
process.exit(FAIL ? 1 : 0);
