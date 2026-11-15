// ══════════════════════════════════════════════
// cutSeamIntegrationCheck.js — 재단 준비: 변별 시접(실제 엔진 · 2026-11-14)
//   김님 확정: 기본 1cm · 선을 눌러 폭 수정(0 허용) · 외곽 골선 0 · 뒤중심은 골선/봉제선 선택(기본 골선) · 설정은 외곽 구간에 붙어 저장 ·
//             다트는 «중심 쪽 조각이 위 겹». 모서리 = 연장 교점, 곡선 오차 0.01cm 는 엔지니어 검증 기준(교재 공식 아님).
//   §1 실제 8조각: 변 이름·고정 ID · 기본값(골선 0 · 그 밖 1) · 독립 거리/닫힘/포함 검사 · 뒤 어깨 다트 접기 복원 ·
//      앞 진동 가슴 다트 = 아래(허리) 쪽으로 눕힘 · 독립 재접기 · 덧단·바이어스 = 조각 전체 한 값 · 완료본·hash·기존 derive 출력 불변
//   §2 설정 쓰기: working.cutSpec 에만 · 0 허용 · 잘못된 값 거부(쓰지 않음) · 골선↔봉제선(전에 적은 폭 보존) · 꼬이는 폭 = 저장하되 «미완 + 사유»
//   §3 저장 → 열기: 값 복원 · 재저장 바이트 동일 · 시접 항목 없는 파일 = 기본값 · 구조가 틀린 항목 = 읽지 않고 잠금(고쳐 쓰지 않음) · 금지 키 = 기존 정책대로 저장 거부
//   §4 소유권: 디자인을 고쳐 다시 완료하면 이름 있는 변은 따라가고 · 사라진 변은 «연결 끊김»으로 보류(삭제·다른 변 승계 없음) ·
//      순서로만 구분되는 변은 형상 서명이 같을 때만 · 변경됨 상태에서는 쓰기 거부
//   node test/harness/cutSeamIntegrationCheck.js
// ══════════════════════════════════════════════
"use strict";
const vm = require("vm"), fs = require("fs"), path = require("path");
let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
process.on("uncaughtException", e => { console.log("cutSeamIntegrationCheck: 예외 — " + (e && e.stack || e).toString().split("\n").slice(0, 3).join(" | ")); fails.slice(0, 20).forEach(f => console.log("  ✗ " + f)); process.exit(1); });
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

// ══ §1 실제 8조각 기본값 ══
{
  const r = buildP(), S = r.S, P = r.P, g0 = graph(S), h0 = hashes(P), plain = S.CUT.derive(P);
  const d = S.CUT.derive(P, true), m = S.CUT.seam(d, P);
  ok(r.ok && typeof S.W.seamAllowance.build === "function" && plain.pieces.every(p => !("edges" in p)) && J(plain.pieces) === strip(d), "1: 기존 derive 출력은 그대로(변 정보는 요청할 때만 · 완성선 바이트 동일)");
  ok(m.state === "ready" && m.spec.state === "none" && m.total === 8 && m.done === 8 && m.orphans.length === 0 && P.working.cutSpec === undefined, "1: 시접 모델 = 8조각 전부 완료 · 저장 항목 없음(읽기만) (" + m.done + "/" + m.total + ")");
  ok(eids(PIECE(d, "front")) === "side-seam,armhole,shoulder,neckline,placket-top,facing-edge,hem", "1: 앞판 변 = 옆선·진동·어깨·목둘레·여밈 윗변·안단 끝·밑단 (" + eids(PIECE(d, "front")) + ")");
  ok(eids(PIECE(d, "back")) === "neckline,center,hem,side-seam,armhole,shoulder", "1: 뒤판 변 (" + eids(PIECE(d, "back")) + ")");
  ok(eids(PIECE(d, "sleeve-sleeve")) === "cap,front-seam,hem,back-seam" && eids(PIECE(d, "cuff")) === "attach-edge,end-overlap,outer-edge,end-plain", "1: 소매 Ⓐ = 소매산·앞 옆선·소맷부리·뒤 옆선 · 커프스 4변");
  ok(eids(PIECE(d, "collar-stand")) === "neck-seam,extension,cf,top-extension,top,cb-fold" && eids(PIECE(d, "collar-body")) === "attach,point-front,outer,cb-fold", "1: 밴드 6변 · 위 칼라 4변");
  ok(["vent-placket", "vent-bias"].every(id => { const p = PIECE(d, id); return p.edges.length === 1 && p.edges[0].id === "all" && p.edges[0].whole && /구간별/.test(p.edges[0].wholeReason); }), "1: 트임 덧단·바이어스 = 변 이름 없음 → 조각 전체 한 값 + 사유");
  ok(d.pieces.every(p => { const seen = new Array(p.segs.length).fill(0); p.edges.forEach(e => e.segs.forEach(i => seen[i]++)); return seen.every(c => c === 1); }), "1: 모든 완성선이 정확히 한 변에 속함(빠짐·중복 0)");
  const folds = []; d.pieces.forEach(p => p.edges.forEach(e => { if (e.foldCapable) folds.push(p.id + "|" + e.id); }));
  ok(folds.join() === "back|center,collar-stand|cb-fold,collar-body|cb-fold", "1: 골선 가능 = 뒤판 뒤중심 · 밴드/위 칼라 뒤중심뿐(부착선·내부 접는선 아님) (" + folds.join() + ")");
  const kinds = []; d.pieces.forEach(p => m.pieces[p.id].edges.forEach(e => { if (e.kind === "fold") kinds.push(p.id + "|" + e.id + "=" + e.widthCm); else if (e.widthCm !== 1 || e.explicit) kinds.push("BAD " + p.id + "|" + e.id); }));
  ok(kinds.join() === "back|center=0,collar-stand|cb-fold=0,collar-body|cb-fold=0", "1: 기본값 = 골선 0 · 그 밖 전부 1cm · 전부 자동값(직접 지정 0) (" + kinds.join() + ")");
  // 앞판: 진동 가슴 다트 = 아래(허리) 쪽으로 눕힘(김님 확정 2026-11-15) → 아래쪽 조각이 위 겹
  const fr = m.pieces.front, fa = PIECE(d, "front").edges.find(e => e.id === "armhole").darts[0], fsg = PIECE(d, "front").segs;
  ok(fr.ok && fr.refusals.length === 0 && fr.darts.length === 1 && fr.darts[0].topFirst === fa.topFirst && fa.topFirst === (fsg[fa.legs[0]].from.y > fsg[fa.legs[1]].to.y), "1: 앞판 = 시접 완료 · 진동 다트는 입구가 아래에 있는 쪽 조각이 위 겹(아래로 눕힘)");
  ok(PIECE(d, "back").edges.find(e => e.id === "shoulder").darts[0].topFirst === false, "1: 뒤 어깨 다트 = 중심 쪽 조각이 위 겹(그대로)");
  // 앞 진동 다트 독립 재접기: 펼친 산의 점을 아래쪽 다리선 너머로 다시 접으면(위쪽 반 = 다트 각 회전 · 아래쪽 반 = 다리선 반사) 접힌 진동선에서 1cm
  { const p = PIECE(d, "front"), e = p.edges.find(x => x.id === "armhole"), dt = e.darts[0], D = fr.darts[0], A = p.segs[dt.legs[0]].to, m1 = p.segs[dt.legs[0]].from, m2 = p.segs[dt.legs[1]].to;
    const mT = dt.topFirst ? m1 : m2, mU = dt.topFirst ? m2 : m1, k0 = e.segs.indexOf(dt.legs[0]), run1 = e.segs.slice(0, k0).map(i => p.segs[i]), run2 = e.segs.slice(k0 + 2).map(i => p.segs[i]), runT = dt.topFirst ? run1 : run2, runU = dt.topFirst ? run2 : run1;
    const uv = v => { const l = Math.hypot(v.x, v.y); return { x: v.x / l, y: v.y / l }; }, vT = uv({ x: mT.x - A.x, y: mT.y - A.y }), vU = uv({ x: mU.x - A.x, y: mU.y - A.y });
    const th = Math.atan2(vU.x * vT.y - vU.y * vT.x, vU.x * vT.x + vU.y * vT.y), sgn = th > 0 ? -1 : 1, half = Math.abs(th) / 2, legLen = Math.hypot(mT.x - A.x, mT.y - A.y);
    const angOf = q => Math.atan2(vT.x * (q.y - A.y) - vT.y * (q.x - A.x), vT.x * (q.x - A.x) + vT.y * (q.y - A.y)) * sgn;
    const refl = q => { const v = { x: q.x - A.x, y: q.y - A.y }, k = v.x * vT.x + v.y * vT.y; return { x: A.x + 2 * k * vT.x - v.x, y: A.y + 2 * k * vT.y - v.y }; };
    const rotq = q => ({ x: A.x + (q.x - A.x) * Math.cos(th) - (q.y - A.y) * Math.sin(th), y: A.y + (q.x - A.x) * Math.sin(th) + (q.y - A.y) * Math.cos(th) });
    const dT = denseOf(runT), dU = denseOf(runU).map(rotq);   // 접힌 진동선 = 아래쪽 진동 + 돌려 붙인 위쪽 진동
    const cap = fr.edgePaths.armhole.filter(q => { const a = angOf(q); return a >= -1e-9 && a <= Math.abs(th) + 1e-9 && Math.hypot(q.x - A.x, q.y - A.y) > legLen * 0.9; });
    const folded = cap.map(q => angOf(q) <= half + 1e-9 ? refl(q) : rotq(q)), err = Math.max(...folded.map(q => Math.abs(Math.min(dPts(q, dT), dPts(q, dU)) - 1)));
    ok(mT.y > mU.y && cap.length >= 3 && err <= 0.01 && folded.every(q => angOf(q) <= 1e-6), "1: 앞 진동 다트 — 펼친 산(" + cap.length + "점)을 아래쪽으로 다시 접으면 전부 접힌 진동선에서 1cm(오차 " + err.toExponential(1) + " ≤ 0.01) · 다트 분량은 아래쪽 다리선 너머에 눕는다");
    ok(Math.abs(angOf(D.peak) - half) < 1e-9 && near(D.angleDeg, 18.25, 0.01) && near(Math.hypot(D.onLegT.x - A.x, D.onLegT.y - A.y), Math.hypot(D.onLegU.x - A.x, D.onLegU.y - A.y), 1e-9), "1: 산 꼭대기 = 다트 중심선 위 · 다트 각 18.25° · 두 다리 연장선 위 끝점은 접으면 한 점"); }
  // 독립 기하 검사(8조각)
  let worstLow = Infinity, worstHigh = 0, crossAll = 0, outside = 0, areaBad = 0;
  d.pieces.forEach(p => { const sm = m.pieces[p.id]; if (!sm.ok) return;
    const fin = denseOf(p.segs), pts = sm.points; crossAll += crossCount(pts);
    for (let i = 0; i < fin.length; i += 7) if (!inPoly(fin[i], pts) && dPts(fin[i], pts.concat([pts[0]])) > 1e-6) outside++;
    if (areaOf(pts) < areaOf(fin) - 1e-6) areaBad++;
    p.edges.forEach((e, k) => { const se = sm.edges[k], own = denseOf(edgeSegs(p, e).filter((s, i) => !(e.darts.length && (e.segs[i] === e.darts[0].legs[0] || e.segs[i] === e.darts[0].legs[1]))));
      if (e.darts.length) return;   // 다트 변은 아래에서 따로
      const s0 = edgeSegs(p, e)[0], dx = s0.to.x - s0.from.x, dy = s0.to.y - s0.from.y, ll = Math.hypot(dx, dy);
      sm.edgePaths[e.id].forEach(q => { if (se.widthCm > 0) worstLow = Math.min(worstLow, dPts(q, own) - se.widthCm); else worstHigh = Math.max(worstHigh, Math.abs((q.x - s0.from.x) * dy - (q.y - s0.from.y) * dx) / ll); }); }); });
  ok(crossAll === 0 && outside === 0 && areaBad === 0, "1: 시접 외곽 = 자기교차 0 · 완성선 전체를 포함 · 면적 ≥ 완성 (독립)");
  ok(worstLow >= -0.01 && worstHigh < 1e-9, "1: 각 변 시접선의 모든 점이 자기 완성선에서 폭 이상(오차 ≤ 0.01) · 골선 변은 완성선(과 그 연장) 위 그대로 (" + worstLow.toExponential(1) + " / " + worstHigh.toExponential(1) + ")");
  // 곡선 정확도: 소매산 시접선 ↔ 정확한 법선 이동 점(독립)
  { const p = PIECE(d, "sleeve-sleeve"), e = p.edges.find(x => x.id === "cap"), path = m.pieces[p.id].edgePaths.cap; let worst = 0;
    edgeSegs(p, e).forEach(s => { if (s.kind !== "cubic") return; for (let k = 1; k < 400; k++) { const t = k / 400, a = cubP(s, t - 1e-5), b = cubP(s, t + 1e-5), c = cubP(s, t), l = Math.hypot(b.x - a.x, b.y - a.y), n = { x: (b.y - a.y) / l, y: -(b.x - a.x) / l };
      const dd = Math.min(dPts({ x: c.x + n.x, y: c.y + n.y }, path), dPts({ x: c.x - n.x, y: c.y - n.y }, path)); if (dd > worst) worst = dd; } });
    ok(worst <= 0.01, "1: 소매산 시접 점열 ↔ 정확한 시접 곡선 최대 오차 ≤ 0.01cm (" + worst.toFixed(5) + ")"); }
  // 골선: 뒤판 시접 외곽은 뒤중심 밖으로 나가지 않는다
  ok(m.pieces.back.points.every(q => q.x >= -1e-9) && m.pieces.back.points.some(q => Math.abs(q.x) < 1e-9 && q.y > 58.5), "1: 뒤중심 골선 = 시접 외곽이 중심선(x 0) 밖으로 나가지 않고, 밑단 시접은 중심선 연장 위에서 끝남");
  // 뒤 어깨 다트: 펼친 산을 다시 접으면 중심 쪽 어깨 시접선 위(독립 접기)
  { const p = PIECE(d, "back"), e = p.edges.find(x => x.id === "shoulder"), dt = e.darts[0], D = m.pieces.back.darts[0], A = p.segs[dt.legs[0]].to, mU = p.segs[dt.legs[0]].from, mT = p.segs[dt.legs[1]].to;
    const run = p.segs[e.segs[e.segs.length - 1]], uv = v => { const l = Math.hypot(v.x, v.y); return { x: v.x / l, y: v.y / l }; }, vT = uv({ x: mT.x - A.x, y: mT.y - A.y }), vU = uv({ x: mU.x - A.x, y: mU.y - A.y });
    const th = Math.atan2(vU.x * vT.y - vU.y * vT.x, vU.x * vT.x + vU.y * vT.y), sgn = th > 0 ? -1 : 1, half = Math.abs(th) / 2;
    const angOf = q => Math.atan2(vT.x * (q.y - A.y) - vT.y * (q.x - A.x), vT.x * (q.x - A.x) + vT.y * (q.y - A.y)) * sgn;
    const refl = q => { const v = { x: q.x - A.x, y: q.y - A.y }, k = v.x * vT.x + v.y * vT.y; return { x: A.x + 2 * k * vT.x - v.x, y: A.y + 2 * k * vT.y - v.y }; };
    const rotq = q => ({ x: A.x + (q.x - A.x) * Math.cos(th) - (q.y - A.y) * Math.sin(th), y: A.y + (q.x - A.x) * Math.sin(th) + (q.y - A.y) * Math.cos(th) });
    const path = m.pieces.back.edgePaths.shoulder, cap = path.filter(q => { const a = angOf(q); return a >= -1e-9 && a <= Math.abs(th) + 1e-9 && Math.hypot(q.x - A.x, q.y - A.y) > 8; });
    const dir = uv({ x: run.to.x - run.from.x, y: run.to.y - run.from.y }), lineDist = q => Math.abs((q.x - run.from.x) * dir.y - (q.y - run.from.y) * dir.x);
    const folded = cap.map(q => angOf(q) <= half + 1e-9 ? refl(q) : rotq(q)), err = Math.max(...folded.map(q => Math.abs(lineDist(q) - 1)));
    ok(run.kind === "line" && Math.abs(mT.x) < Math.abs(mU.x) && cap.length >= 3 && err < 1e-6, "1: 뒤 어깨 다트 — 펼친 산(" + cap.length + "점)을 중심 쪽 겹 아래로 다시 접으면 전부 중심 쪽 어깨선에서 1cm 선 위(오차 " + err.toExponential(1) + ")");
    ok(Math.abs(angOf(D.peak) - half) < 1e-9 && D.legMismatchCm > 0.05 && D.legMismatchCm < 0.2 && near(D.angleDeg, 11.38, 0.01), "1: 산 꼭대기 = 다트 중심선 위 · 다트 각 11.38° · 두 다리 길이 차 " + D.legMismatchCm.toFixed(3) + "cm 는 고치지 않고 보고"); }
  ok(m.pieces["vent-placket"].ok && m.pieces["vent-placket"].points.length === 7 && near(areaOf(m.pieces["vent-placket"].points), 61 + 6 * Math.SQRT2, 1e-9) && crossCount(m.pieces["vent-placket"].points) === 0,
    "1: 트임 덧단 = 1cm 시접 완료(7꼭짓점 · 면적 61+6√2 = 손계산 · 두 뾰족 끝 사이 골은 깊이 1 그대로 남음 · 교차 0)");
  ok(graph(S) === g0 && hashes(P) === h0 && J(S.CUT.seam(S.CUT.derive(P, true), P)) === J(m) && S.DR.isCurrentDesignChanged(P) === false, "1: 시접 파생 전후 그래프·완료본 hash 4개 불변 · 결정론 · «변경됨» 아님");
}

// 여밈 없는 앞판: 앞중심이 외곽 변으로 남는다(골선 선택 대상은 아님)
{
  const r = build(null), d = r.S.CUT.derive(r.P, true), f = PIECE(d, "front"), c = f.edges.find(e => e.id === "center");
  ok(r.ok && eids(f) === "shoulder,neckline,center,hem,side-seam,armhole" && c.name === "앞중심" && c.foldCapable === false && c.defaultKind === "seam", "1: 여밈 없는 앞판 = 앞중심이 외곽 변(기본 1cm · 골선 선택 대상 아님) (" + eids(f) + ")");
}

// ══ §2 설정 쓰기 ══
{
  const r = buildP(), S = r.S, P = r.P, h0 = hashes(P), plain0 = J(S.CUT.derive(P).pieces);
  const seam = () => S.CUT.seam(S.CUT.derive(P, true), P);
  const w1 = S.CUT.setEdge("back", "side-seam", { widthCm: 1.5 }, P);
  ok(w1.ok && J(P.working.cutSpec) === J({ schema: 1, defaultCm: 1, edges: { "back|side-seam": { widthCm: 1.5, sig: P.working.cutSpec.edges["back|side-seam"].sig, label: "뒤판 · 옆선" } } }), "2: 옆선 1.5 적용 → working.cutSpec 한 곳에만 기록(판 1 · 기본 1 · 조각|변 · 폭 · 형상 서명 · 이름) " + J(P.working.cutSpec).slice(0, 120));
  ok(hashes(P) === h0 && S.DR.isCurrentDesignChanged(P) === false && S.DR.check(P).ok && J(S.CUT.derive(P).pieces) === plain0, "2: 완료본 hash 4개·완성선·Design 판정 불변(시접 설정은 디자인 변경이 아님)");
  let m = seam(), e = E(m, "back", "side-seam");
  ok(e.widthCm === 1.5 && e.explicit === true && E(m, "back", "hem").explicit === false && m.pieces.back.ok, "2: 옆선만 «직접 지정 1.5» · 나머지는 자동값 그대로");
  { const d = S.CUT.derive(P, true), p = PIECE(d, "back"), own = denseOf(edgeSegs(p, p.edges.find(x => x.id === "side-seam"))), dd = m.pieces.back.edgePaths["side-seam"].map(q => dPts(q, own));
    ok(Math.min(...dd) >= 1.5 - 1e-9 && m.pieces.back.points.some(q => near(q.x, 23.053125 + 1.5, 1e-6)), "2: 옆선 시접선이 실제로 1.5 밖으로(독립 거리 " + Math.min(...dd).toFixed(4) + ")"); }
  ok(S.CUT.setEdge("back", "hem", { widthCm: 0 }, P).ok && E(seam(), "back", "hem").widthCm === 0 && seam().pieces.back.ok, "2: 0 허용(밑단 0 = 완성선에서 자름)");
  const snap = J(P.working.cutSpec), bad = [[{ widthCm: NaN }, /숫자/], [{ widthCm: -1 }, /숫자/], [{ widthCm: 10.5 }, /숫자/], [{ widthCm: "1" }, /숫자/], [{}, /숫자/], [{ kind: "fold" }, /골선으로 둘 수 없/], [{ kind: "x", widthCm: 1 }, /정해/]];
  ok(bad.every(b => { const x = S.CUT.setEdge("back", "armhole", b[0], P); return !x.ok && b[1].test(x.reason); }) && J(P.working.cutSpec) === snap, "2: NaN·음수·한도 초과·문자열·빈 값·골선 불가 변 = 거부 + 사유 · 아무것도 쓰지 않음");
  ok(!S.CUT.setEdge("nope", "hem", { widthCm: 1 }, P).ok && !S.CUT.setEdge("back", "nope", { widthCm: 1 }, P).ok && J(P.working.cutSpec) === snap, "2: 없는 조각·없는 변 = 거부");
  // 골선 ↔ 봉제선
  ok(!S.CUT.setEdge("back", "center", { widthCm: 1 }, P).ok, "2: 골선 가능 변은 종류(골선/봉제선)를 정해야 함");
  ok(S.CUT.setEdge("back", "center", { kind: "seam", widthCm: 1.2 }, P).ok, "2: 뒤중심 → 봉제선 1.2");
  m = seam(); e = E(m, "back", "center");
  ok(e.kind === "seam" && e.widthCm === 1.2 && e.explicit && m.pieces.back.ok && near(Math.min(...m.pieces.back.points.map(q => q.x)), -1.2, 1e-9), "2: 뒤중심 봉제선 = 시접 1.2 가 중심선 밖으로(최소 x −1.2)");
  ok(S.CUT.setEdge("back", "center", { kind: "fold" }, P).ok && J(P.working.cutSpec.edges["back|center"]) === J({ kind: "fold", widthCm: 1.2, sig: P.working.cutSpec.edges["back|center"].sig, label: "뒤판 · 뒤중심" }), "2: 다시 골선 → 종류만 바뀌고 전에 적은 폭 1.2 는 보존");
  m = seam(); e = E(m, "back", "center");
  ok(e.kind === "fold" && e.widthCm === 0 && e.keptWidthCm === 1.2 && e.explicit && m.pieces.back.points.every(q => q.x >= -1e-9), "2: 골선 = 폭 0(보존 폭은 화면이 다시 봉제선으로 바꿀 때 쓰도록 전달)");
  ok(S.CUT.setEdge("collar-stand", "cb-fold", { kind: "seam", widthCm: 1 }, P).ok && E(seam(), "collar-stand", "cb-fold").kind === "seam" && seam().pieces["collar-stand"].ok, "2: 카라 뒤중심도 같은 방식(골선 ↔ 봉제선)");
  ok(S.CUT.setEdge("vent-bias", "all", { widthCm: 0.7 }, P).ok && E(seam(), "vent-bias", "all").widthCm === 0.7 && near(areaOf(seam().pieces["vent-bias"].points), 3.4 * 8.9, 1e-9), "2: 조각 전체 한 값(바이어스 0.7 → 3.4 × 8.9)");
  // 꼬이는 폭: 설정은 사용자 것이라 저장하되, 조각은 «미완 + 사유»(잘라내지 않음)
  const done0 = seam().done;
  ok(S.CUT.setEdge("sleeve-sleeve", "cap", { widthCm: 6 }, P).ok, "2: 소매산 6cm(오목 반경 4.05 초과) 적용");
  m = seam();
  ok(!m.pieces["sleeve-sleeve"].ok && m.pieces["sleeve-sleeve"].points === null && m.pieces["sleeve-sleeve"].refusals.some(x => x.code === "radius" && /반경/.test(x.reason)) && m.done === done0 - 1, "2: 소매 = 시접 미완 + «곡선 반경 < 폭» 사유 · 외곽 없음 · 완료 수 감소");
  ok(S.CUT.setEdge("sleeve-sleeve", "cap", { widthCm: 1 }, P).ok && seam().pieces["sleeve-sleeve"].ok && seam().done === done0, "2: 다시 1cm → 완료 복귀");
  ok(hashes(P) === h0 && J(S.CUT.derive(P).pieces) === plain0, "2: 여러 번 고친 뒤에도 완료본·완성선 불변");
}

// ══ §3 저장 → 열기 ══
{
  const r = buildP(), S = r.S, P = r.P, AT = { savedAt: "2026-11-14T00:00:00.000Z" };
  const legacy = S.PF.buildFileText(AT).text;
  ok(!/cutSpec/.test(legacy), "3: 시접을 건드리지 않은 프로젝트 파일에는 시접 항목이 없음(기존 파일과 같은 모양)");
  S.CUT.setEdge("back", "side-seam", { widthCm: 1.5 }, P); S.CUT.setEdge("back", "center", { kind: "seam", widthCm: 1.2 }, P); S.CUT.setEdge("cuff", "outer-edge", { widthCm: 0 }, P);
  const m0 = J(S.CUT.seam(S.CUT.derive(P, true), P)), text = S.PF.buildFileText(AT).text, head = JSON.parse(text);
  ok(/cutSpec/.test(text) && head.schemaVersion === 1, "3: 저장 파일에 시접 설정 포함 · 파일 판(schemaVersion) 1 그대로");
  const S2 = makeSession(), v = S2.PF.verifyText(text); ok(v.ok, "3: 빈 세션에서 파일 검증 통과"); S2.PF.commitCandidate(v.candidate);
  const P2 = S2.P(), d2 = S2.CUT.derive(P2, true);
  ok(S2.CUT.readSpec(P2).state === "ok" && J(P2.working.cutSpec) === J(P.working.cutSpec) && J(S2.CUT.seam(d2, P2)) === m0 && hashes(P2) === hashes(P), "3: 열기 = 시접 설정·시접 외곽·완료본 hash 전부 복원");
  ok(S2.PF.buildFileText(AT).text === text, "3: 다시 저장 = 바이트 동일");
  ok(S2.CUT.setEdge("back", "hem", { widthCm: 2 }, P2).ok && S2.CUT.seam(S2.CUT.derive(P2, true), P2).pieces.back.edges.find(e => e.id === "hem").widthCm === 2, "3: 연 뒤에도 계속 수정 가능");
  // 시접 항목이 없는 기존 파일
  const S3 = makeSession(), v3 = S3.PF.verifyText(legacy); S3.PF.commitCandidate(v3.candidate);
  const m3 = S3.CUT.seam(S3.CUT.derive(S3.P(), true), S3.P());
  ok(v3.ok && S3.P().working.cutSpec === undefined && m3.spec.state === "none" && m3.done === 8 && m3.orphans.length === 0, "3: 시접 항목 없는 기존 파일 = 기본값으로 열림(항목을 만들어 넣지 않음)");
  // 구조가 틀린 항목: 파일 정책은 그대로(열림) · 시접은 읽지 않고 잠금
  const wrong = [[{ schema: 2, defaultCm: 1, edges: {} }, /모르는 판/], [{ schema: 1, defaultCm: 1, edges: {}, extra: 1 }, /모르는 항목/], [{ schema: 1, defaultCm: 3, edges: {} }, /기본 폭/],
    [{ schema: 1, defaultCm: 1, edges: { "back|hem": { widthCm: "2", sig: "a", label: "x" } } }, /숫자/], [{ schema: 1, defaultCm: 1, edges: { "back|hem": { widthCm: 1, sig: "a", label: "x", hack: 1 } } }, /모르는 키/],
    [{ schema: 1, defaultCm: 1, edges: { "back|hem": { kind: "bias", sig: "a", label: "x" } } }, /모르는 변 종류/], [{ schema: 1, defaultCm: 1, edges: { "backhem": { widthCm: 1, sig: "a", label: "x" } } }, /형식 오류/],
    [{ schema: 1, defaultCm: 1, edges: { "back|hem": { widthCm: 99, sig: "a", label: "x" } } }, /숫자/], [[1], /객체/], [{ schema: 1, defaultCm: 1, edges: { "back|hem": { sig: "a", label: "x" } } }, /값이 없는/]];
  ok(wrong.every(wv => { const S4 = makeSession(), v4 = S4.PF.verifyText(legacy); S4.PF.commitCandidate(v4.candidate); const P4 = S4.P(); P4.working.cutSpec = JSON.parse(J(wv[0]));
    const sp = S4.CUT.readSpec(P4), m4 = S4.CUT.seam(S4.CUT.derive(P4, true), P4), w = S4.CUT.setEdge("back", "hem", { widthCm: 1.5 }, P4);
    return sp.state === "invalid" && wv[1].test(sp.reason) && m4.spec.state === "invalid" && m4.done === 8 && m4.pieces.back.edges.every(e => !e.explicit) && !w.ok && /읽을 수 없/.test(w.reason) && J(P4.working.cutSpec) === J(wv[0]); }),
    "3: 구조가 틀린 시접 항목 10종 = 읽지 않음(기본값 표시) · 수정 잠금 · 저장된 값을 고쳐 쓰지 않음");
  { const S5 = makeSession(), v5 = S5.PF.verifyText(legacy); S5.PF.commitCandidate(v5.candidate); const P5 = S5.P();
    P5.working.cutSpec = { schema: 1, defaultCm: 1, edges: JSON.parse('{"__proto__":{"widthCm":1,"sig":"a","label":"x"}}') };
    let res = null; try { res = S5.PF.buildFileText(AT); } catch (e) { res = { thrown: e && e.reason }; }
    ok(!(res && res.text) && /forbidden-key/.test(J(res)), "3: 금지 키(__proto__)가 든 시접 항목 = 기존 저장 정책이 그대로 거부 (" + J(res).slice(0, 80) + ")"); }
}

// ══ §4 소유권 ══
{
  const r = buildP(), S = r.S, P = r.P;
  const seam = () => S.CUT.seam(S.CUT.derive(P, true), P);
  ["sleeve-sleeve|hem|1.5", "cuff|outer-edge|0.7", "vent-bias|all|0.5", "back|side-seam|2"].forEach(x => { const a = x.split("|"); S.CUT.setEdge(a[0], a[1], { widthCm: +a[2] }, P); });
  const sig0 = P.working.cutSpec.edges["sleeve-sleeve|hem"].sig, spec0 = J(P.working.cutSpec);
  // 디자인 수정 직후(변경됨): 읽기·쓰기 모두 막힘
  ok(S.W.sleeveAApply.apply(P, { sleeveLengthCm: 48, cuff: cuffOf(S, null) }).ok, "4: 완료 뒤 소매 길이 48 로 수정");
  const blocked = S.CUT.setEdge("back", "hem", { widthCm: 3 }, P);
  ok(S.CUT.seam(S.CUT.derive(P, true), P).state === "blocked" && !blocked.ok && J(P.working.cutSpec) === spec0, "4: «변경됨» 상태 = 시접 표시·쓰기 없음 · 저장된 설정은 그대로 보존");
  ok(completeChain(S, P), "4: 재완료");
  let m = seam();
  const sigNow = S.CUT.derive(P, true).pieces.find(p => p.id === "sleeve-sleeve").edges.find(e => e.id === "hem").sig;
  ok(sigNow !== sig0 && E(m, "sleeve-sleeve", "hem").widthCm === 1.5 && E(m, "sleeve-sleeve", "hem").explicit && E(m, "cuff", "outer-edge").widthCm === 0.7 && E(m, "back", "side-seam").widthCm === 2 && m.orphans.length === 0 && J(P.working.cutSpec) === spec0,
    "4: 소맷부리 모양이 바뀌어도(서명 다름) 이름 있는 변의 설정은 외곽에 붙어 따라감 · 끊긴 것 0 · 저장값 무변경");
  // 커프스를 없애면: 커프스·바이어스 설정은 «연결 끊김»으로 보류
  ok(S.W.sleeveAApply.apply(P, { sleeveLengthCm: 52 }).ok && completeChain(S, P), "4: 커프스 없는 소매로 바꿔 재완료");
  m = seam();
  ok(m.orphans.map(o => o.key).sort().join() === "cuff|outer-edge,vent-bias|all" && m.orphans.every(o => /조각이 지금/.test(o.why)) && m.orphans.find(o => o.key === "cuff|outer-edge").widthCm === 0.7 && m.orphans.find(o => o.key === "cuff|outer-edge").label === "커프스 · 바깥 변",
    "4: 사라진 조각의 설정 2개 = «연결 끊김»(이름·값·이유 표시) (" + m.orphans.map(o => o.key).join() + ")");
  ok(J(P.working.cutSpec) === spec0 && Object.keys(m.pieces).every(pid => m.pieces[pid].edges.every(e => !e.explicit || ["sleeve-sleeve|hem", "back|side-seam"].indexOf(pid + "|" + e.id) >= 0)) && E(m, "sleeve-sleeve", "hem").widthCm === 1.5,
    "4: 끊긴 설정은 지우지 않고, 다른 변에 자동으로 넘기지도 않음(직접 지정은 여전히 소맷부리·옆선뿐)");
  const cl = S.CUT.clearOrphans(P);
  ok(cl.ok && cl.removed === 2 && Object.keys(P.working.cutSpec.edges).sort().join() === "back|side-seam,sleeve-sleeve|hem" && seam().orphans.length === 0, "4: «끊긴 설정 지우기» = 끊긴 2개만 삭제(사용자 동작일 때만)");
  // 순서로만 구분되는 변(이름이 겹쳐 #n 이 붙은 변): 형상 서명이 같을 때만 잇는다 — 합성 조각으로 규칙만 검사
  const L = (a, b) => ({ kind: "line", from: { x: a[0], y: a[1] }, to: { x: b[0], y: b[1] } }), sq = [L([0, 0], [10, 0]), L([10, 0], [10, 6]), L([10, 6], [0, 6]), L([0, 6], [0, 0])];
  const edge = (id, i, pos, sig) => ({ id, label: "x", name: id, segs: [i], darts: [], positional: pos, foldCapable: false, defaultKind: "seam", sig });
  const fake = { state: "ready", pieces: [{ id: "pc", label: "조각", check: { ok: true }, segs: sq, edges: [edge("x#1", 0, true, "AAA"), edge("x#2", 1, true, "BBB"), edge("y", 2, false, "CCC"), edge("z", 3, false, "DDD")] }] };
  const fp = spec => ({ working: { cutSpec: { schema: 1, defaultCm: 1, edges: spec } } });
  const ma = S.CUT.seam(fake, fp({ "pc|x#1": { widthCm: 2, sig: "AAA", label: "조각 · x#1" }, "pc|y": { widthCm: 3, sig: "OLD", label: "조각 · y" } }));
  ok(E(ma, "pc", "x#1").widthCm === 2 && E(ma, "pc", "y").widthCm === 3 && ma.orphans.length === 0, "4: 순서 변 = 서명이 같으면 잇고, 이름 있는 변은 서명이 달라도 이음");
  const mb = S.CUT.seam(fake, fp({ "pc|x#1": { widthCm: 2, sig: "ZZZ", label: "조각 · x#1" }, "pc|gone": { widthCm: 4, sig: "Q", label: "조각 · gone" }, "pc|z": { kind: "fold", sig: "DDD", label: "조각 · z" } }));
  ok(E(mb, "pc", "x#1").widthCm === 1 && !E(mb, "pc", "x#1").explicit && E(mb, "pc", "x#2").widthCm === 1 && E(mb, "pc", "z").widthCm === 1 && mb.orphans.map(o => o.key).sort().join() === "pc|gone,pc|x#1,pc|z" && /같은 변인지/.test(mb.orphans.find(o => o.key === "pc|x#1").why) && /골선이 될 수 없/.test(mb.orphans.find(o => o.key === "pc|z").why),
    "4: 서명이 다른 순서 변 · 없는 변 · 골선이 될 수 없는 변의 골선 설정 = 적용 안 함(기본값) + 연결 끊김 3개(엉뚱한 변 승계 없음)");
}

console.log("cutSeamIntegrationCheck: " + PASS + " passed, " + FAIL + " failed");
fails.forEach(f => console.log("  FAIL " + f));
process.exit(FAIL ? 1 : 0);
