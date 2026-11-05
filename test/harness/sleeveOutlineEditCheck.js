// sleeveOutlineEditCheck.js — 소매 외곽 반영(2026-11-06 김님 승인 «미리보기에서 확인한 소매 외곽 → «외곽 반영» → 실제 형상 재계측 → 소매 재완료»).
//   node test/harness/sleeveOutlineEditCheck.js
//
//   §0 배선(같은 명령·기본 숨김 · 로드 순서 · 프리셋 검사 함수 그대로)
//   §1 Ⓐ 뒤 옆선: 역할·미리보기만으로 반영 없음 · 명시 클릭 · 원본(frozen sleeveResult·원형·bodiceResult) 불변 · 출처 · 독립 재계측 ·
//      «변경됨» · Design/카라 의존 · 재반영 거부 · 절개선 재검증(남김·이유) · 재완료 hash·결정론 · Design 같은 형상 · 새 외곽 분리 · 되돌리기
//   §2 Ⓐ 소매산(SP 한쪽): 독립 SP 분할 길이 · 이세 실측 · SP 지남/새 꼭대기 = 거부(필요한 선택 보고) · 원자성
//   §3 의미 모호(소매산→옆선) · 실패 원자성 · 미완료 · 낡은 미리보기 · 재완료 전 두 번째 반영 · 몸판 변경/프리셋 재적용 = 편집 해제(승계 없음)
//   §4 기본 소매 소맷부리 · §5 Ⓒ 열린 V 보존 · §6 Ⓥ 두 장(같은 조각 · 두 번 연속 · 재적용 검증) · §7 미지원 사유(Ⓕ·Ⓡ·Ⓧ·래글런·Ⓨ·Ⓩ) · §8 미편집 회귀
//   셋업은 boundaryPreviewCheck.js 와 같은 구성(+ sleeveOutlineEdit.js).
"use strict";
const vm = require("vm");
const fs = require("fs");
const path = require("path");

let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
const J = JSON.stringify;
const ROOT = path.join(__dirname, "..", "..");
const SYMS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const SYM = s => s === "base" ? "기본" : String.fromCharCode(0x24B6 + s.charCodeAt(0) - 65);

let PROJECT = null;
const ELS = {};
function el(id) { if (!ELS[id]) ELS[id] = { id, textContent: "", disabled: false, title: "", attrs: {}, setAttribute(k, v) { this.attrs[k] = String(v); }, removeAttribute(k) { delete this.attrs[k]; if (k === "title") this.title = ""; }, getAttribute(k) { return this.attrs[k]; } }; return ELS[id]; }
let LOADING = null; const SVG_H = {}, DOC_H = {};
const sb = { window: {}, console: { log() {}, warn() {} }, Math, JSON, Object, Array, isFinite, structuredClone, Error, Date, Promise,
  c2p: (x, y) => [x * 10, y * 10], SC: 10, viewZ: 1,
  eventToPatternPoint: e => [e.px, e.py],
  render: () => {},
  svg: { addEventListener(t, f) { (SVG_H[LOADING + ":" + t] = SVG_H[LOADING + ":" + t] || []).push(f); }, setPointerCapture() {}, releasePointerCapture() {} },
  document: { createElementNS: () => ({ setAttribute() {}, appendChild() {} }), getElementById: el,
    addEventListener(t, f) { (DOC_H[LOADING + ":" + t] = DOC_H[LOADING + ":" + t] || []).push(f); } } };
sb.globalThis = sb; vm.createContext(sb);
sb.window.designWorkflow = { current: () => PROJECT };
sb.window.isDesignStageActive = () => true;
sb.window.addEventListener = () => {};
sb.window.refreshDesignResultUI = () => {};
const files = ["designLineTool.js", "sleeveSplit.js", "sleeveOutlineEdit.js", "designFlare.js", "designJoin.js", "designWaistSeam.js", "designYokeSeam.js", "designPrincess.js", "designBodice.js", "bodicePresets.js",
  "designLayout.js", "designRenderer.js", "bodiceCheckpoint.js", "peplumAnnotation.js", "designSleeve.js", "sleeveMeasure.js", "sleeveCheckpoint.js", "sleevePresets.js"];
SYMS.forEach(k => { if (fs.existsSync(path.join(ROOT, "js", "designSleeve" + k + ".js"))) files.push("designSleeve" + k + ".js"); files.push("sleeve" + k + "Apply.js"); });
files.push("sleeveAnnotation.js", "designCollar.js", "collarCheckpoint.js", "designResult.js");
files.forEach(f => { LOADING = f; vm.runInContext(fs.readFileSync(path.join(ROOT, "js", f), "utf8"), sb, { filename: f }); });
LOADING = null;
const W = sb.window, DB = W.designBodice, BP = W.bodicePresets, BC = W.bodiceCheckpoint, SC = W.sleeveCheckpoint, SP = W.sleevePresets, DS = W.designSleeve,
  DC = W.designCollar, CC = W.collarCheckpoint, DR = W.designResult, DLT = W.designLineTool, DLy = W.designLayout, SS = W.sleeveSplit;
const API = s => W["sleeve" + s + "Apply"];
let BARSYNC = 0; W.designLineQuickBar = { sync() { BARSYNC++; } };   // «선 가까이» 막대 동기화 호출만 센다
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));
const REF_J = J(REF);
// 기본 소매: 공유 block fixture 의 sleeve 는 비어 있으므로 sleeveAResultCheck 와 같은 실제 소매 구조 fixture + ui.js deriveSleeve 와 같은 파생.
const REFSLEEVE = () => {
  const cap = { kind: "path", commands: [{ type: "M", points: [{ x: 5.53, y: 66.42 }] }, { type: "C", points: [{ x: 12, y: 56 }, { x: 18, y: 53 }, { x: 23.75, y: 53 }] }, { type: "C", points: [{ x: 29, y: 53 }, { x: 35, y: 56 }, { x: 39.29, y: 66.42 }] }] };
  const line = (a, b) => ({ kind: "line", from: { x: a[0], y: a[1] }, to: { x: b[0], y: b[1] } });
  return { outline: [cap, line([5.53, 66.42], [7.56, 105]), line([39.29, 66.42], [37.56, 105]), line([7.56, 105], [37.56, 105])], construction: [] };
};
const bodicePreset = sym => { for (const f of BP.families()) for (const v of f.variants) if (v.symbol === sym && v.presetId) return v.presetId; return null; };
function projectOn(bodiceSym) {
  const body = BP.bodyParams(bodicePreset(bodiceSym));
  PROJECT = { sourceBlock: { id: "blk", version: 2, schemaVersion: 8, canonicalHash: "abc" }, referenceGeometry: Object.assign(JSON.parse(REF_J), { sleeve: REFSLEEVE() }),
    working: { geometry: DB.computeGeometry(REF, { body }), parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body }, patternLines: [], designOutline: null, frontPlacket: null } };
  BC.complete(PROJECT);
  PROJECT.working.layout = { front: { dx: 40, dy: 5 }, back: { dx: 0, dy: 5 }, sleeve: { dx: 80, dy: 5 }, collar: { dx: 0, dy: 70 } };
  DLy.ensureLayout(PROJECT);
  return PROJECT;
}
function setBodice(P, bodiceSym) {
  const body = BP.bodyParams(bodicePreset(bodiceSym));
  P.working.parameters.body = body; P.working.geometry = Object.assign({}, DB.computeGeometry(REF, { body }), { sleeve: P.working.geometry.sleeve });
  return BC.complete(P);
}
function deriveDefault(P, len) {   // ui.js deriveSleeve 와 같은 모양
  const lower = { sleeveLengthCm: len, cuffCircumferenceCm: 30, sideShape: "straight" };
  const r = DS.computeSilhouette(P.referenceGeometry.sleeve, { lower, cap: null });
  P.working.sleeveDraft = { sourceBodiceHash: P.working.bodiceResult.hash, mode: "parametric", capLineId: null, capInvalid: false, parameters: { lower, cap: null }, geometry: r.geometry, capLengths: r.capLengths };
  P.working.geometry.sleeve = r.geometry;
  return r.ok;
}
const UI_DEFAULT_LEN = 52;
function defaultsOf(sym) { const rec = SP.get("bunka-sleeve-" + sym), o = {}; rec.inputs.forEach(i => { if (typeof i.defaultValue === "number") o[i.key] = i.defaultValue; else if (i.key === "sleeveLengthCm") o[i.key] = UI_DEFAULT_LEN; }); return o; }
function changedOf(sym) { const p = defaultsOf(sym); if (p.sleeveLengthCm !== undefined) p.sleeveLengthCm += (p.sleeveLengthCm < 15 ? 1 : 2); else if (p.heightRatio !== undefined) p.heightRatio = 0.3; else if (p.spreadCm !== undefined) p.spreadCm = 10; return p; }
function sleeveOn(sym) {   // 몸판 Ⓐ 완료 → 소매(기본/sym) 적용(완료 전)
  const P = projectOn("A");
  if (sym === "base") return deriveDefault(P, 52) ? P : null;
  const r = API(sym).apply(P, defaultsOf(sym)); return r && r.ok ? P : null;
}
const STAND_P = { bandWidthCm: 3, frontRiseCm: 1.5, frontEndCm: 0.5 }, BODY_P = { gapCm: 3, cbWidthCm: 4, frontProjectionCm: 1.5, pointDiagonalCm: 6, outerBowCm: 0 };
function setCollar(P) {
  const b = P.working.bodiceResult, stand = DC.computeStand(b, STAND_P), body = DC.computeBody(stand, BODY_P);
  P.working.collarDraft = { sourceBodiceHash: b.hash, type: "shirt-two-piece", parameters: { stand: Object.assign({}, STAND_P) },
    standGeometry: stand.standGeometry, body: { parameters: Object.assign({}, BODY_P), geometry: body.bodyGeometry, attachLenCm: body.attachLenCm, measure: body.measure } };
  P.working.collarResult = null;
}

// ── 실제 핸들러(designLineTool 이 등록한 것) ──
const H = t => (SVG_H["designLineTool.js:" + t] || []);
const KD = () => (DOC_H["designLineTool.js:keydown"] || []);
let CLX = 0;
function evAt(pc, geo, extra) {
  const L = DLy.ensureLayout(PROJECT), off = L[pc] || { dx: 0, dy: 0 };
  CLX += 100;
  return Object.assign({ button: 0, pointerId: 1, clientX: CLX, clientY: 0, altKey: false, shiftKey: false, px: geo.x + off.dx, py: geo.y + off.dy,
    target: { closest: () => ({ getAttribute: () => pc }) }, stopPropagation() {}, preventDefault() {} }, extra || {});
}
const down = e => H("pointerdown").forEach(f => f(e)), up = e => H("pointerup").forEach(f => f(e)), move = e => H("pointermove").forEach(f => f(e));
const key = k => KD().forEach(f => f({ key: k, target: {}, preventDefault() {} }));
const click = (pc, g, extra) => { const e = evAt(pc, g, extra); down(e); up(e); };
// 곡선 점: 클릭-드래그(핸들) — 드래그 벡터 = 핸들
const drag = (pc, g, h) => { const e0 = evAt(pc, g); down(e0); const e1 = evAt(pc, { x: g.x + h.x, y: g.y + h.y }, { clientX: e0.clientX + 50 }); move(e1); up(e1); };
const lines = () => PROJECT.working.patternLines;
const last = () => lines()[lines().length - 1];
// 그리기(실제 경로): «선·곡선 그리기» → 점 → Enter(완료 = 자동 선택) → «절개선»
function drawCut(pts, opts) {
  opts = opts || {};
  if (DLT.getMode() !== "off") DLT.setMode("off");
  DLT.toggle();
  pts.forEach((q, i) => { if (opts.handles && opts.handles[i]) drag("sleeve", q, opts.handles[i]); else click("sleeve", q, { altKey: !!opts.alt }); });
  key("Enter");
  const line = last();
  DLT.setRole("cut");
  return line;
}
const status = () => el("designCutStatus").textContent;
const splitBtnOn = () => el("btnDesignSplit").disabled === false;
const splitNote = () => el("designSplitNote").textContent;

// ── 독립 계측(엔진 코드 미사용) ──
const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const bez = (q, t) => { const u = 1 - t; return { x: u * u * u * q[0].x + 3 * u * u * t * q[1].x + 3 * u * t * t * q[2].x + t * t * t * q[3].x, y: u * u * u * q[0].y + 3 * u * u * t * q[1].y + 3 * u * t * t * q[2].y + t * t * t * q[3].y }; };
function cubsOf(s) {
  if (s.kind === "line") return [[s.from, s.from, s.to, s.to]];
  if (s.kind === "cubic") return [[s.from, s.c1, s.c2, s.to]];
  const o = []; let cur = null;
  (s.commands || []).forEach(c => { if (c.type === "M") cur = c.points[0]; else if (c.type === "L") { o.push([cur, cur, c.points[0], c.points[0]]); cur = c.points[0]; } else { o.push([cur, c.points[0], c.points[1], c.points[2]]); cur = c.points[2]; } });
  return o;
}
const poly = (s, n) => { let L = []; cubsOf(s).forEach((q, i) => { const a = []; for (let k = 0; k <= n; k++) a.push(bez(q, k / n)); L = L.concat(a.slice(i ? 1 : 0)); }); return L; };
const plen = p => { let s = 0; for (let i = 1; i < p.length; i++) s += D(p[i - 1], p[i]); return s; };
function loopOf(prims, n) {   // 끝점으로 이어 닫은 점열
  const rest = prims.map(s => poly(s, n)); let out = rest.shift();
  while (rest.length) { const e = out[out.length - 1]; let bi = 0, bd = Infinity, br = false;
    rest.forEach((p, i) => { const a = D(e, p[0]), b = D(e, p[p.length - 1]); if (a < bd) { bd = a; bi = i; br = false; } if (b < bd) { bd = b; bi = i; br = true; } });
    const p = rest.splice(bi, 1)[0]; out = out.concat((br ? p.slice().reverse() : p).slice(1)); }
  return out;
}
const area = L => { let a = 0; for (let i = 0; i < L.length; i++) { const p = L[i], q = L[(i + 1) % L.length]; a += p.x * q.y - q.x * p.y; } return a / 2; };
const segX = (a, b, c, d) => { const o = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x); const e1 = o(c, d, a), e2 = o(c, d, b), e3 = o(a, b, c), e4 = o(a, b, d), k = 1e-9;
  return ((e1 > k && e2 < -k) || (e1 < -k && e2 > k)) && ((e3 > k && e4 < -k) || (e3 < -k && e4 > k)); };
function selfX(L) { const n = L.length - 1; for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) { if (i === 0 && j === n - 1) continue; if (segX(L[i], L[i + 1], L[j], L[j + 1])) return true; } return false; }
function dPoly(p, L) { let m = Infinity; for (let i = 1; i < L.length; i++) { const a = L[i - 1], b = L[i], vx = b.x - a.x, vy = b.y - a.y, l2 = vx * vx + vy * vy; let t = l2 ? ((p.x - a.x) * vx + (p.y - a.y) * vy) / l2 : 0; t = Math.max(0, Math.min(1, t)); m = Math.min(m, Math.hypot(p.x - a.x - t * vx, p.y - a.y - t * vy)); } return m; }
function hcrossings(L, y) { const xs = []; for (let i = 1; i < L.length; i++) { const a = L[i - 1], b = L[i]; if ((a.y - y) * (b.y - y) < 0) xs.push(a.x + (b.x - a.x) * (y - a.y) / (b.y - a.y)); } return xs.sort((p, q) => p - q); }
const primsOfPiece = (g, name) => (Array.isArray(g.pieces) && g.pieces.length > 1) ? g.outline.filter(p => p.piece === name) : g.outline;
// 조각의 수평 절개(높이 frac): 독립 점열과의 교차 두 점(교차가 정확히 둘인 높이를 찾는다)
function hcut(g, name, frac) {
  const L = loopOf(primsOfPiece(g, name), 400), ys = L.map(p => p.y), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
  // 끝점이 snap 반경(0.8cm) 안에 형상 끝점(외곽·제도선)을 두지 않는 높이 — 실제 UI snap 이 끝점을 옮기지 않게(옮겨지는 경우는 §4 처럼 따로 본다)
  const vtx = []; (g.outline || []).concat(g.construction || []).forEach(pr => cubsOf(pr).forEach(q => { vtx.push(q[0]); vtx.push(q[3]); }));
  const clear = p => vtx.every(v => D(v, p) > 1.0);
  for (let k = 0; k < 60; k++) { const f = frac + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.01, y = y0 + (y1 - y0) * f, xs = hcrossings(L, y);
    if (xs.length === 2 && clear({ x: xs[0], y }) && clear({ x: xs[1], y })) return { a: { x: xs[0], y }, b: { x: xs[1], y }, loop: L }; }
  return null;
}

// ── 외곽 대체 전용 도우미 ──
const bstatus = () => el("designBoundaryStatus").textContent;
const bBtnOn = () => el("btnDesignBoundary").disabled === false;
const bNote = () => el("designBoundaryNote").textContent;
function drawBnd(pc, pts, opts) {   // 실제 경로: «선·곡선 그리기» → 점 → Enter(완료 = 자동 선택) → «외곽»
  opts = opts || {};
  if (DLT.getMode() !== "off") DLT.setMode("off");
  DLT.toggle();
  pts.forEach((q, i) => { if (opts.handles && opts.handles[i]) drag(pc, q, opts.handles[i]); else click(pc, q, { altKey: !!opts.alt }); });
  key("Enter");
  const line = last();
  DLT.setRole("boundary");
  return line;
}
// «선 가까이» 막대의 순수 표시 모델(실제 모듈을 DOM 없는 별도 context 에 올려 describe 만 쓴다)
const sbQ = { window: {}, document: { readyState: "complete", getElementById: () => null }, Math, JSON, Object, Array };
sbQ.globalThis = sbQ; vm.createContext(sbQ);
vm.runInContext(fs.readFileSync(path.join(ROOT, "js", "designLineQuickBar.js"), "utf8"), sbQ, { filename: "designLineQuickBar.js" });
const QB = sbQ.window.designLineQuickBar;
function barVM() {   // 막대 snapshot 과 같은 읽기(getSplitState·getBoundaryState·잠금 판정)
  const id = DLT.getSelectedId(), l = id ? DLT.findLine(id) : null; if (!l) return null;
  const lock = DLT.isNeckAutoLine(id) ? "neck" : DLT.isSleeveCapLine(l) ? "cap" : DLT.isCollarBodyLine(l) ? "collar" : null;
  return QB.describe({ design: true, mode: DLT.getMode(), sel: { id: id, piece: l.piece, role: l.role || "guide", lock: lock, split: DLT.getSplitState(), boundary: DLT.getBoundaryState() } });
}
// 미리보기 독립 검산(소매 = 닫힌 한 고리)
function closedLoopPts(out) { let L = []; out.forEach((s, i) => { L = L.concat(poly(s, 200).slice(i ? 1 : 0)); }); return L; }
function verifySleevePreview(tag, bp, g, pieceName, line) {
  const out = bp.outline, n = out.length;
  ok(n > 1 && out.every((s, i) => D(s.to, out[(i + 1) % n].from) < 1e-9), tag + ": 대체 결과 이음·폐합 연속(< 1e-9 · 닫힌 한 고리)");
  const L = closedLoopPts(out), L0 = loopOf(primsOfPiece(g, pieceName), 400);
  ok(!selfX(L), tag + ": 대체 결과 자기교차 없음");
  const A = Math.abs(area(L)), A0 = Math.abs(area(L0));
  ok(A > 0.5 && Math.abs(A - A0) > 0.05, tag + ": 결과 면적 > 0 · 원래와 다름(대체됨) (" + A.toFixed(3) + " vs " + A0.toFixed(3) + ")");
  // 대체선 구간: 선의 세그먼트가 같은 제어점(정방향 또는 역방향)으로 들어 있다 — 끝점만 외곽 투영(≤ 0.05)으로 맞춤
  const ls = line.segments, E = 0.05;
  const match = (s, o) => s.kind === o.kind && (s.kind === "line"
    ? ((D(o.from, s.from) <= E && D(o.to, s.to) <= E) || (D(o.from, s.to) <= E && D(o.to, s.from) <= E))
    : ((D(o.from, s.from) <= E && D(o.c1, s.c1) < 1e-9 && D(o.c2, s.c2) < 1e-9 && D(o.to, s.to) <= E) || (D(o.from, s.to) <= E && D(o.c1, s.c2) < 1e-9 && D(o.c2, s.c1) < 1e-9 && D(o.to, s.from) <= E)));
  ok(ls.every(s => out.some(o => match(s, o))), tag + ": 대체선이 결과 외곽에 그대로(곡선 제어점 보존)");
  const bndPts = [].concat.apply([], ls.map(s => poly(s, 100)));
  const keptSegs = out.filter(s => { const m = bez(cubsOf(s)[0], 0.5); return dPoly(m, bndPts) > 1e-3; });
  ok(keptSegs.length > 0 && keptSegs.every(s => poly(s, 20).every(p => dPoly(p, L0) < 2e-4)), tag + ": 대체선 밖 구간은 모두 원래 조각 외곽 위(다른 조각·제도선 연결 없음)");
  const origCubics = primsOfPiece(g, pieceName).some(p => p.kind !== "line");
  ok(!origCubics || keptSegs.some(s => s.kind === "cubic"), tag + ": 유지 곡선 외곽이 cubic 으로 보존(평탄화 아님)");
}


// ══════════ 소매 외곽 반영 전용 ══════════
const E = W.sleeveOutlineEdit;
const DSlv = W.designSleeve;
const snapW = P => J({ ref: P.referenceGeometry, b: P.working.bodiceResult, s: P.working.sleeveResult, e: P.working.sleeveEdit || null, g: P.working.geometry.sleeve, bp: P.working.boundaryPreview || null, parts: P.working.parts || null });
// 조각 primitive 위 점(호 길이 비율 f · 독립 점열)
function ptOn(pr, f) { const L = poly(pr, 400), tot = plen(L); let acc = 0; for (let i = 1; i < L.length; i++) { const d = D(L[i - 1], L[i]); if (acc + d >= f * tot) { const t = (f * tot - acc) / d; return { x: L[i - 1].x + (L[i].x - L[i - 1].x) * t, y: L[i - 1].y + (L[i].y - L[i - 1].y) * t }; } acc += d; } return L[L.length - 1]; }
// a→b 사이를 중심(c)에서 멀어지는(out=+1) / 가까워지는(out=-1) 쪽으로 h 만큼 부풀린 3점 선
function bulge(a, b, c, h, out) { const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; let nx = -(b.y - a.y), ny = b.x - a.x; const l = Math.hypot(nx, ny); nx /= l; ny /= l; if ((m.x - c.x) * nx + (m.y - c.y) * ny < 0) { nx = -nx; ny = -ny; } return [a, { x: m.x + out * h * nx, y: m.y + out * h * ny }, b]; }
function centroid(prims) { const L = loopOf(prims, 100); let x = 0, y = 0; L.forEach(p => { x += p.x; y += p.y; }); return { x: x / L.length, y: y / L.length }; }
const roleIdx = (g, role, piece) => g.outline.findIndex(p => p.role === role && (!piece || p.piece === piece));
// 그리기 → «외곽» → (미리보기) — 반환 선
function bndLine(pts) { const l = drawBnd("sleeve", pts, { alt: true }); DLT.syncCutStatus(); return l; }
function previewNow() { const r = DLT.doBoundaryPreview(); DLT.syncCutStatus(); return r; }
// 독립 측정: 같은 의미(역할)의 primitive 길이 합 · 소매산 앞/뒤(SP 기준 점열 분할)
const lenOf = prims => prims.reduce((a, p) => a + plen(poly(p, 400)), 0);
function capSplitLens(capPrims, sp) {   // 소매산 체인(점열)을 SP 에서 나눈 두 길이(낮은 x 끝 = 뒤)
  const L = loopOf(capPrims, 400); const ch = L[0].x < L[L.length - 1].x ? L : L.slice().reverse();
  let k = 0, bd = Infinity; ch.forEach((p, i) => { const d = D(p, sp); if (d < bd) { bd = d; k = i; } });
  return { back: plen(ch.slice(0, k + 1)), front: plen(ch.slice(k)), snap: bd };
}
function independentLoopOk(tag, g, pieceName) {
  ok(g.outline.every(p => p.kind === "line" || (p.kind === "path" && p.commands[0].type === "M" && p.commands.slice(1).every(c => c.type === "C" && c.points.length === 3))), tag + ": 외곽 primitive = line | path(M/C)(렌더러 계약)");
  const L = loopOf(primsOfPiece(g, pieceName), 300);
  ok(D(L[0], L[L.length - 1]) < 1e-6, tag + ": 수정 소매 조각 폐합(독립 점열)");
  ok(!selfX(L), tag + ": 수정 소매 조각 자기교차 없음(독립)");
  ok(Math.abs(area(L)) > 1, tag + ": 면적 > 0");
}
// 실제 designRenderer 로 수정 소매를 그려 본다(브라우저 실측에서 맨 cubic primitive 가 «invalid-primitive» 로 render 를 멈춘 회귀 방지).
function renderOk(P) {
  const R = W.designRenderer; if (!R || !R.createWorkingGroup) return "no-renderer";
  try { R.createWorkingGroup(P.working.geometry); return true; } catch (e) { return "throw:" + (e && e.message); }
}
function completeAll(P) { setCollar(P); const c = CC.complete(P); const d = DR.complete(P); return { c, d }; }

// §0 배선
{
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8"), R = fs.readFileSync(path.join(ROOT, "js", "render.js"), "utf8"), CK = fs.readFileSync(path.join(ROOT, "js", "sleeveCheckpoint.js"), "utf8");
  ok(/id="btnDesignBoundaryApply" onclick="designLineTool\.doBoundaryApply\(\)" hidden disabled/.test(html) && /id="btnSleeveEditUndo" onclick="designLineTool\.doSleeveEditUndo\(\)" hidden disabled/.test(html), "0: 오른쪽 «외곽 반영»·«반영 되돌리기» = 같은 명령 · 기본 숨김·비활성");
  ok(/id="lineQuickBoundaryApply" hidden disabled/.test(html) && /id="lineQuickBoundaryUndo" hidden/.test(html), "0: 막대 «외곽 반영»·«반영 되돌리기» 정적 마크업(기본 숨김)");
  ok(/id="btnDesignBoundary" onclick="designLineTool\.doBoundaryPreview\(\)" disabled/.test(html), "0: 기존 «외곽 대체 미리보기» 보존");
  const at = f => html.indexOf('src="js/' + f + '?v=');
  ok(at("sleeveOutlineEdit.js") > at("sleeveSplit.js") && at("sleeveOutlineEdit.js") < at("ui.js") && /sleeveOutlineEdit\.js\?v=2026110601/.test(html), "0: sleeveOutlineEdit 로드 순서·캐시 버전");
  ok(/sleeveOutlineEdit\.isActive\(dp\)/.test(R), "0: render — 수정 소매에는 프리셋 제도 표시 안 그림");
  ok(/if \(SOE && proj\.working\.sleeveEdit && SOE\.isActive\(proj\)\) return checkEdit\(proj\);/.test(CK) && /function checkA\(proj\)/.test(CK), "0: 완료 검사 = 수정 전용 분기 + 프리셋 검사 함수 그대로");
}

// §1 Ⓐ 뒤 옆선 수정 — 명시 클릭만 · 원본 불변 · 실측 · 재완료 · Design · 절개선 재검증 · 되돌리기
{
  const P = sleeveOn("A"); SC.complete(P);
  const pre = completeAll(P);
  ok(pre.c.ok && pre.d.ok, "1: 사전 — 카라·Design 완료(편집 전)");
  const base = P.working.sleeveResult, baseJ = J(base), refJ = J(P.referenceGeometry), bodJ = J(P.working.bodiceResult), dr0 = P.working.designResult;
  const g0 = P.working.geometry.sleeve, sideB = g0.outline[1], sideF = g0.outline[2];
  ok(sideB.kind === "line" && sideB.from.x < 0 && sideB.to.x < 0, "1: Ⓐ 뒤 옆선(outline[1]) 확인");
  // 절개선 둘(편집 전): y=35(뒤 끝점이 바뀔 구간) · y=48(그대로)
  const c35 = drawCut([{ x: -17.07, y: 35 }, { x: 15, y: 35 }], { alt: true }), c48 = drawCut([{ x: -17.07, y: 48 }, { x: 15, y: 48 }], { alt: true });
  DLT.syncCutStatus(); DLT.doSplit();
  ok((P.working.parts || []).filter(q => q.sourcePiece === "sleeve").length === 2, "1: 편집 전 소매 파트 분리(c48)");
  const a = { x: -17.07, y: 25 }, b = { x: -17.07, y: 45 };
  const line = bndLine([a, { x: -15.8, y: 35 }, b]);
  ok(line.role === "boundary" && !P.working.sleeveEdit, "1: 역할 «외곽» 선택만으로는 반영 없음");
  let st = DLT.getBoundaryState();
  ok(st && st.allowed && st.apply && !st.apply.allowed && /미리보기/.test(st.apply.reason), "1: 미리보기 전 «외곽 반영» 불가(먼저 미리보기) (" + (st && st.apply && st.apply.reason) + ")");
  const s0 = snapW(P);
  ok(DLT.doBoundaryApply() === false && snapW(P) === s0, "1: 미리보기 없이 반영 명령 = 거부 · 상태 그대로");
  ok(previewNow() === true && !P.working.sleeveEdit && J(P.working.geometry.sleeve) === J(g0), "1: 미리보기만으로는 반영 없음");
  st = DLT.getBoundaryState();
  ok(st.shown && st.apply && st.apply.allowed && /뒤 옆선/.test(st.apply.reason), "1: 미리보기 확인 → 반영 허용(뒤 옆선) (" + st.apply.reason + ")");
  const vmq = barVM();
  ok(vmq.boundary.stage === "confirm" && vmq.boundary.apply.allowed && /외곽 반영/.test(vmq.boundary.text), "1: 막대 = 확인 단계 «외곽 반영» (" + vmq.boundary.text + ")");
  ok(el("btnDesignBoundaryApply").disabled === false && el("btnDesignBoundaryApply").hidden === false, "1: 오른쪽 «외곽 반영» 활성(같은 판정)");
  const bpOutline = J(P.working.boundaryPreview.outline);
  ok(DLT.doBoundaryApply() === true, "1: «외곽 반영» 성공 (" + bNote() + ")");
  const ed = P.working.sleeveEdit;
  ok(ed && Object.isFrozen(ed) && ed.base === base && J(base) === baseJ && P.working.sleeveResult === base, "1: 원본 완료본 그대로(같은 frozen 객체 · 바이트 동일) · sleeveResult 도 아직 원본");
  ok(J(P.referenceGeometry) === refJ && J(P.working.bodiceResult) === bodJ, "1: 원형·bodiceResult 불변");
  ok(ed.ops.length === 1 && ed.ops[0].lineId === line.id && ed.ops[0].cls === "side-back" && ed.ops[0].fromHash === base.hash && ed.baseHash === base.hash && ed.key === "A", "1: 출처 = 원본 hash · 반영 대체선 · 바뀐 구간(뒤 옆선)");
  ok(J(P.working.geometry.sleeve) === J(ed.geometry) && J(ed.geometry) !== J(base.geometry), "1: 화면 소매 = 수정 형상(한 권위)");
  ok(!P.working.boundaryPreview && !(P.working.parts || []).some(q => q.sourcePiece === "sleeve"), "1: 미리보기·예전 소매 파트 정리(출처 변경)");
  // 수정 형상: 미리보기 결과와 같은 고리
  const ng = ed.geometry;
  independentLoopOk("1", ng, "sleeve");
  { const ro = renderOk(P); ok(ro === true, "1: 실제 designRenderer 로 그림(invalid-primitive 없음) (" + ro + ")"); }
  const keptCap = ng.outline.filter(p => p.role === "cap");
  ok(keptCap.length === 1 && J(keptCap[0].commands) === J(g0.outline[0].commands), "1: 소매산 곡선 그대로(같은 path 명령)");
  ok(ng.outline.some(p => p.kind === "line" && D(p.to, { x: -15.8, y: 35 }) < 1e-9 || p.kind === "line" && D(p.from, { x: -15.8, y: 35 }) < 1e-9), "1: 대체선 꼭짓점이 외곽에(제어점 보존)");
  // 독립 재계측
  const c = SC.check(P), m = c._measure;
  const backPrims = ng.outline.filter(p => /side-seam-back/.test(p.role || "")), frontPrims = ng.outline.filter(p => /side-seam-front/.test(p.role || ""));
  const indBack = lenOf(backPrims), indFront = lenOf(frontPrims);
  const onB = q => { const vx = sideB.to.x - sideB.from.x, vy = sideB.to.y - sideB.from.y, t = ((q.x - sideB.from.x) * vx + (q.y - sideB.from.y) * vy) / (vx * vx + vy * vy); return { x: sideB.from.x + t * vx, y: sideB.from.y + t * vy }; };
  const a1 = onB(a), b1 = onB(b), mid = { x: -15.8, y: 35 };
  const exactBack = D(sideB.from, a1) + D(a1, mid) + D(mid, b1) + D(b1, sideB.to);   // 끝점 = 원래 옆선 위 투영(엔진 boundary 계약)
  ok(Math.abs(indBack - exactBack) < 1e-6 && Math.abs(m.sideBack - exactBack) < 1e-4, "1: 뒤 옆선 실측 = 독립 계산 " + exactBack.toFixed(4) + " (엔진 " + (m.sideBack || 0).toFixed(4) + ")");
  ok(Math.abs(m.sideFront - lenOf([sideF])) < 1e-4 && Math.abs(indFront - lenOf([sideF])) < 1e-9, "1: 앞 옆선 그대로");
  ok(c.ok && Math.abs(c.capLengths.front - base.cap.lengths.front) < 1e-4 && Math.abs(c.capLengths.back - base.cap.lengths.back) < 1e-4, "1: 소매산 앞·뒤 = 원본(소매산 안 바뀜)");
  ok(Math.abs(m.cuff - D(g0.outline[3].from, g0.outline[3].to)) < 1e-6 && Math.abs(m.sleeveLength - 52) < 1e-6, "1: 소맷부리·소매길이 실측(SP 수직 → 소맷부리 · 52)");
  ok(c.mode === "manual-edit" && !!c._edit, "1: 완료 검사 = 수정 전용 분기");
  ok(SC.isCurrentSleeveChanged(P) === true && SS.sleeveRef(P).source === "pending", "1: 적용 즉시 «소매 변경됨 · 다시 완료 필요»");
  ok(DR.check(P).fails.indexOf("sleeve-changed") >= 0 && CC.sleeveStepChanged(P) === true, "1: Design·카라 = 기존 의존관계대로 낡음");
  // 반영된 선 = 다시 반영 안 함
  DLT.syncCutStatus(); st = DLT.getBoundaryState();
  ok(st && st.kind === "applied" && !st.allowed && st.applied && barVM().boundary.stage === "applied" && /다시 완료/.test(barVM().boundary.text), "1: 반영된 선 = «반영됨 · 다시 완료» (" + barVM().boundary.text + ")");
  ok(DLT.doBoundaryApply() === false && P.working.sleeveEdit === ed, "1: 같은 선 재반영 거부");
  // 절개선 재검증(새 외곽) — 남김·이유
  const v35 = SS.cutStatus(P, c35, [DLT.flattenLine(c48.segments)]), v48 = SS.cutStatus(P, c48, [DLT.flattenLine(c35.segments)]);
  ok(lines().indexOf(c35) >= 0 && lines().indexOf(c48) >= 0 && J(c35.segments[0].from) === J({ x: -17.07, y: 35 }), "1: 절개선 자동 삭제·이동 없음");
  ok(v35.kind === "invalid" && /외곽|경계|벗어/.test(v35.reason), "1: 바뀐 구간에 끝점이 있던 절개선 = 무효 + 이유 (" + v35.reason + ")");
  ok(v48.ok && v48.kind === "pending", "1: 그대로 유효한 절개선 = 유효 · 재완료 전 분리 보류");
  // 재완료
  const r1 = SC.complete(P);
  ok(r1.ok && r1.result.manualEdit && r1.result.manualEdit.baseSleeveHash === base.hash && r1.result.hash !== base.hash && J(r1.result.geometry) === J(ed.geometry), "1: 재완료 = 수정 형상·출처로 새 hash (" + (r1.reason || r1.result.hash) + ")");
  ok(r1.result.origin.presetId === base.origin.presetId && J(r1.result.inputs) === J(base.inputs) && J(r1.result.meta) === J(base.meta), "1: 출처·입력·제도 기록(meta)은 원본 그대로(예측값 = 기록)");
  ok(Math.abs(r1.result.manualEdit.measure.sideBack - exactBack) < 1e-4 && J(r1.result.cap.lengths) === J({ front: Math.round(c.capLengths.front * 1e4) / 1e4, back: Math.round(c.capLengths.back * 1e4) / 1e4, total: Math.round(c.capLengths.total * 1e4) / 1e4 }), "1: 완료본 cap·실측 = 수정 형상 실측");
  ok(SC.isCurrentSleeveChanged(P) === false && SS.sleeveRef(P).source === "current", "1: 재완료 뒤 현재");
  const h1 = r1.result.hash, r1b = SC.complete(P);
  ok(r1b.ok && r1b.result.hash === h1, "1: 변경 없는 재완료 = 같은 hash(결정론)");
  ok(CC.sleeveStepChanged(P) === false && DR.check(P).ok, "1: 카라·Design 다시 완료 가능");
  const d1 = DR.complete(P);
  ok(d1.ok && d1.result.hash !== dr0.hash && J(d1.result.sleeve.geometry) === J(ed.geometry), "1: Design = 같은 수정 형상(새 hash)");
  // 재완료 뒤 분리 = 새 외곽
  DLT.setMode("select");
  { const v = SS.cutStatus(P, c48, []); ok(v.ok && v.ready, "1: 재완료 뒤 유지 절개선 분리 가능"); const res = SS.splitSleeve(SS.sleeveRef(P).geometry, c48.segments);
    ok(res.ok && res.parts.some(pt => pt.some(s => D(s.from, { x: -15.8, y: 35 }) < 1e-9 || D(s.to, { x: -15.8, y: 35 }) < 1e-9)), "1: 분리 파트가 새 외곽(수정 꼭짓점 포함)"); }
  // 되돌리기 → 원본 형상 · 재완료 = 원본 hash
  ok(DLT.doSleeveEditUndo() === true && !P.working.sleeveEdit && J(P.working.geometry.sleeve) === J(base.geometry), "1: 되돌리기 = 원본 형상 · 편집 해제");
  ok(SC.isCurrentSleeveChanged(P) === true, "1: 되돌린 뒤 = 다시 완료 필요(수정 완료본과 다름)");
  const r0 = SC.complete(P);
  ok(r0.ok && r0.result.hash === base.hash && !r0.result.manualEdit, "1: 되돌린 뒤 재완료 = 원본 hash 그대로");
}

// §2 Ⓐ 소매산(뒤, SP 한쪽) — 의미 명확한 소매산 수정 · SP 지남/SP 이동 거부
{
  const P = sleeveOn("A"); SC.complete(P);
  const base = P.working.sleeveResult, g0 = P.working.geometry.sleeve, cap = g0.outline[0], cen = centroid(g0.outline);
  const pa = ptOn(cap, 0.18), pb = ptOn(cap, 0.36);
  const line = bndLine(bulge(pa, pb, cen, 0.4, +1));
  ok(previewNow() === true, "2: 소매산 대체 미리보기");
  ok(DLT.doBoundaryApply() === true, "2: 소매산(뒤) 반영 (" + bNote() + ")");
  const ed = P.working.sleeveEdit, c = SC.check(P);
  ok(ed.ops[0].cls === "cap" && c.ok, "2: 구간 = 소매산 · 검사 통과");
  const capPrims = ed.geometry.outline.filter(p => p.role === "cap");
  const ind = capSplitLens(capPrims, base.cap.splitPoint);
  ok(ind.snap < 1e-3 && Math.abs(c.capLengths.back - ind.back) < 2e-3 && Math.abs(c.capLengths.front - ind.front) < 2e-3, "2: 소매산 앞·뒤 = 독립 점열 분할(SP 기준) (뒤 " + c.capLengths.back.toFixed(4) + " / 독립 " + ind.back.toFixed(4) + ")");
  ok(c.capLengths.back > base.cap.lengths.back + 0.01 && Math.abs(c.capLengths.front - base.cap.lengths.front) < 1e-4, "2: 뒤 소매산만 길어짐 · 앞 그대로");
  ok(D(c._prim.splitPoint, base.cap.splitPoint) < 1e-9, "2: SP 그대로(승계)");
  const ah = P.working.bodiceResult.armholeLengths;
  ok(Math.abs(c.ease.back - (c.capLengths.back - ah.back)) < 1e-6 && c.ease.back > base.cap.ease.back, "2: 뒤 이세 = 실측 소매산 − 봉제 AH (커짐)");
  const r = SC.complete(P);
  ok(r.ok && Math.abs(r.result.cap.lengths.back - Math.round(c.capLengths.back * 1e4) / 1e4) < 1e-9 && r.result.cap.ease.back !== base.cap.ease.back, "2: 재완료 cap = 실측(예측값 아님)");
  // SP 지남 → 거부(필요한 선택 보고)
  const P2 = sleeveOn("A"); SC.complete(P2);
  const cap2 = P2.working.geometry.sleeve.outline[0], cen2 = centroid(P2.working.geometry.sleeve.outline);
  bndLine(bulge(ptOn(cap2, 0.4), ptOn(cap2, 0.62), cen2, 0.3, +1));
  ok(previewNow() === true, "2: SP 를 지나는 소매산 대체 — 미리보기는 됨");
  let st = DLT.getBoundaryState(); const sn = snapW(P2);
  ok(st.apply && !st.apply.allowed && /분할점\(SP\)/.test(st.apply.reason) && /필요한 선택/.test(st.apply.reason), "2: SP 지남 = 반영 불가 + 필요한 선택 (" + st.apply.reason + ")");
  ok(DLT.doBoundaryApply() === false && snapW(P2) === sn, "2: 거부 = 부분 변경 없음");
  // 새 꼭대기 → SP 이동 → 거부
  const P3 = sleeveOn("A"); SC.complete(P3);
  const cap3 = P3.working.geometry.sleeve.outline[0], q1 = ptOn(cap3, 0.42), q2 = ptOn(cap3, 0.5);
  bndLine([q1, { x: (q1.x + q2.x) / 2, y: -1.5 }, q2]);
  previewNow(); st = DLT.getBoundaryState(); const sn3 = snapW(P3);
  ok(st.apply && !st.apply.allowed && /SP/.test(st.apply.reason), "2: 새 꼭대기(SP 위) = 반영 불가 (" + (st.apply && st.apply.reason) + ")");
  ok(DLT.doBoundaryApply() === false && snapW(P3) === sn3, "2: 거부 원자성");
}

// §3 의미 모호(소매산→옆선) · 실패 원자성 · 미완료 · 낡은 미리보기 · 몸판/프리셋 재적용
{
  const P = sleeveOn("A"); SC.complete(P);
  const g0 = P.working.geometry.sleeve;
  const pa = ptOn(g0.outline[0], 0.06), pb = { x: -17.07, y: 22 };
  bndLine([pa, pb]);
  ok(previewNow() === true, "3: 소매산→뒤 옆선 모서리 대체 미리보기");
  const st = DLT.getBoundaryState(), sn = snapW(P);
  ok(st.apply && !st.apply.allowed && /소매산·뒤 옆선/.test(st.apply.reason) && /필요한 선택/.test(st.apply.reason), "3: 두 구간에 걸침 = 반영 불가 + 필요한 최소 선택 (" + st.apply.reason + ")");
  ok(DLT.doBoundaryApply() === false && snapW(P) === sn && /반영 안 함/.test(bNote()), "3: 반영 실패 = 아무것도 안 바뀜 (" + bNote() + ")");
  // 미완료: 소매 적용만(완료 전)
  const Pu = sleeveOn("A");
  bndLine([{ x: -17.07, y: 25 }, { x: -15.8, y: 35 }, { x: -17.07, y: 45 }]);
  const snu = snapW(Pu);
  ok(previewNow() === false && DLT.doBoundaryApply() === false && snapW(Pu) === snu, "3: 소매 미완료 = 미리보기·반영 없음");
  // 낡은 미리보기: 미리보기 뒤 소매 입력 변경 재적용
  const Ps = sleeveOn("A"); SC.complete(Ps);
  const ls = bndLine([{ x: -17.07, y: 25 }, { x: -15.8, y: 35 }, { x: -17.07, y: 45 }]);
  previewNow();
  const lo = bndLine([{ x: 15, y: 25 }, { x: 13.8, y: 35 }, { x: 15, y: 45 }]);   // 다른 선(미리보기 없음)
  const so = snapW(Ps), ro = E.apply(Ps, lo);
  ok(!ro.ok && ro.code === "preview" && snapW(Ps) === so, "3: 다른 선의 미리보기로 반영 = 거부(확인한 미리보기 아님) (" + ro.reason + ")");
  API("A").apply(Ps, changedOf("A"));
  const sns = snapW(Ps), rs = E.apply(Ps, ls);
  ok(!rs.ok && snapW(Ps) === sns && !Ps.working.sleeveEdit, "3: 낡은 미리보기(입력 변경 뒤) = 반영 거부 · 상태 그대로 (" + rs.reason + ")");
  ok(DLT.doBoundaryApply() === false && !Ps.working.sleeveEdit && !Ps.working.boundaryPreview, "3: 같은 명령도 거부 · 낡은 미리보기는 종전대로 정리");
  // 반영 뒤 재완료 전 두 번째 반영 = 거부(현재 완료본 기준 미리보기만)
  const Pk = sleeveOn("A"); SC.complete(Pk);
  bndLine([{ x: -17.07, y: 25 }, { x: -15.8, y: 35 }, { x: -17.07, y: 45 }]); previewNow(); DLT.doBoundaryApply();
  const l2 = bndLine([{ x: 15, y: 25 }, { x: 13.8, y: 35 }, { x: 15, y: 45 }]);
  const snk = snapW(Pk);
  ok(previewNow() === false && DLT.doBoundaryApply() === false && snapW(Pk) === snk && Pk.working.sleeveEdit.ops.length === 1, "3: 반영 후 재완료 전 = 다음 미리보기·반영 없음");
  // 몸판 변경 → 재제도(refreshSleeve 와 같은 경로) → 낡은 편집 해제(승계 없음)
  const edG = J(Pk.working.sleeveEdit.geometry);
  setBodice(Pk, "B"); API("A").rederive(Pk);
  ok(E.state(Pk).kind === "stale" && SC.check(Pk).mode !== "manual-edit", "3: 몸판 변경 → 편집 낡음 · 검사는 새 소매(프리셋) 기준");
  DLT.syncCutStatus();
  ok(!Pk.working.sleeveEdit && Pk.working.sleeveEditDropped && Pk.working.sleeveEditDropped.count === 1 && J(Pk.working.geometry.sleeve) !== edG, "3: 낡은 편집 해제 + 안내 · 새 소매에 옮기지 않음");
  // 프리셋 같은 입력으로 다시 적용 → 해제(원본 형상)
  const Pr = sleeveOn("A"); SC.complete(Pr);
  bndLine([{ x: -17.07, y: 25 }, { x: -15.8, y: 35 }, { x: -17.07, y: 45 }]); previewNow(); DLT.doBoundaryApply(); SC.complete(Pr);
  const bh = Pr.working.sleeveEdit.base.hash;
  API("A").apply(Pr, defaultsOf("A")); DLT.syncCutStatus();
  ok(!Pr.working.sleeveEdit && SC.isCurrentSleeveChanged(Pr) === true, "3: 프리셋 재적용 → 편집 해제 · 수정 완료본은 낡음");
  ok(SC.complete(Pr).result.hash === bh, "3: 재완료 = 원본 hash(수정 없이)");
}

// §4 기본 소매 소맷부리 수정 — 소맷부리·소매길이 재계측
{
  const P = sleeveOn("base"); SC.complete(P);
  const base = P.working.sleeveResult, sp = base.cap.splitPoint;
  bndLine([{ x: 12, y: 105 }, { x: sp.x, y: 106 }, { x: 30, y: 105 }]);
  ok(previewNow() === true, "4: 기본 소매 소맷부리 대체 미리보기");
  ok(DLT.doBoundaryApply() === true, "4: 소맷부리 반영 (" + bNote() + ")");
  const ed = P.working.sleeveEdit, c = SC.check(P), m = c._measure;
  ok(ed.ops[0].cls === "hem" && ed.key === "base" && c.ok, "4: 구간 = 소맷부리 · 기본 소매 · 검사 통과 (" + J(c.fails) + ")");
  const exactCuff = (12 - 7.56) + Math.hypot(sp.x - 12, 1) + Math.hypot(30 - sp.x, 1) + (37.56 - 30);
  ok(Math.abs(m.cuff - exactCuff) < 1e-4 && Math.abs(m.sleeveLength - (106 - sp.y)) < 1e-6, "4: 소맷부리 " + m.cuff.toFixed(4) + " = 독립 " + exactCuff.toFixed(4) + " · 소매길이 = 106 − SP.y");
  ok(Math.abs(c.capLengths.total - base.cap.lengths.total) < 1e-4 && ed.geometry.outline.filter(p => p.role === "cap").length === 1, "4: 소매산 그대로(역할 표시만 명시)");
  independentLoopOk("4", ed.geometry, "sleeve");
  { const ro = renderOk(P); ok(ro === true, "4: 실제 designRenderer 로 그림(invalid-primitive 없음) (" + ro + ")"); }
  const r = SC.complete(P);
  ok(r.ok && r.result.manualEdit && J(r.result.parameters) === J(base.parameters) && SC.isCurrentSleeveChanged(P) === false, "4: 기본 소매 재완료(입력 parameters 는 원본 기록)");
}

// §5 Ⓒ 열린 V 보존(앞 옆선 수정) · Ⓒ 소매산은 role cap
{
  const P = sleeveOn("C"); SC.complete(P);
  const g0 = P.working.geometry.sleeve, i = roleIdx(g0, "side-seam-front"), sf = g0.outline[i], cen = centroid(g0.outline);
  bndLine(bulge(ptOn(sf, 0.25), ptOn(sf, 0.7), cen, 0.5, -1));
  ok(previewNow() === true && DLT.doBoundaryApply() === true, "5: Ⓒ 앞 옆선 반영 (" + bNote() + ")");
  const ng = P.working.sleeveEdit.geometry, legs0 = g0.outline.filter(p => /dart/.test(p.role || "")), legs1 = ng.outline.filter(p => /dart/.test(p.role || ""));
  ok(legs0.length === 2 && J(legs1) === J(legs0), "5: 열린 V 다리 그대로(바이트 동일)");
  ok(J(ng.outline.filter(p => p.role === "cap")) === J(g0.outline.filter(p => p.role === "cap")), "5: 소매산 그대로");
  independentLoopOk("5", ng, "sleeve");
  { const ro = renderOk(P); ok(ro === true, "5: 실제 designRenderer 로 그림(invalid-primitive 없음) (" + ro + ")"); }
  const r = SC.complete(P);
  ok(r.ok && SC.isCurrentSleeveChanged(P) === false, "5: Ⓒ 재완료 (" + (r.reason || "") + ")");
}

// §6 Ⓥ 두 장 — 같은 조각만 · 두 번 연속 수정(재완료 사이) · 달림선 실측 그대로
{
  const P = sleeveOn("V"); SC.complete(P);
  const base = P.working.sleeveResult, g0 = base.geometry;
  const ua = g0.outline[roleIdx(g0, "underarm", "back")], cenB = centroid(primsOfPiece(g0, "back"));
  bndLine(bulge(ptOn(ua, 0.3), ptOn(ua, 0.65), cenB, 0.6, -1));
  ok(previewNow() === true && DLT.doBoundaryApply() === true, "6: Ⓥ 뒤 조각 소매 밑선 반영 (" + bNote() + ")");
  let ed = P.working.sleeveEdit;
  ok(J(primsOfPiece(ed.geometry, "front")) === J(primsOfPiece(g0, "front")), "6: 다른 조각(앞) 그대로");
  let c = SC.check(P);
  ok(c.ok && ed.ops[0].cls === "side-back" && Math.abs(c.capLengths.back - base.cap.lengths.back) < 1e-4 && Math.abs(c.capLengths.front - base.cap.lengths.front) < 1e-4, "6: 달림선 앞·뒤 실측 = 원본 · 구간 뒤 밑선");
  ok(SC.complete(P).ok, "6: 첫 수정 재완료");
  const hm = P.working.geometry.sleeve.outline[roleIdx(P.working.geometry.sleeve, "hem", "back")];
  bndLine(bulge(ptOn(hm, 0.2), ptOn(hm, 0.8), cenB, 0.7, +1));
  ok(previewNow() === true && DLT.doBoundaryApply() === true, "6: 두 번째 수정(뒤 조각 소맷부리) (" + bNote() + ")");
  ed = P.working.sleeveEdit;
  ok(ed.ops.length === 2 && ed.base === base && ed.ops[1].cls === "hem" && ed.ops[1].fromHash === P.working.sleeveResult.hash, "6: 두 번 연속 · 같은 원본 · 두 번째 출처 = 첫 수정 완료본");
  const rp = E.replay(base.geometry, ed.ops, E.ctxFor(P, base));
  ok(rp.ok && J(rp.geometry) === J(ed.geometry), "6: 원본 + 기록 재적용 = 현재 형상");
  independentLoopOk("6", ed.geometry, "back");
  { const ro = renderOk(P); ok(ro === true, "6: 실제 designRenderer 로 그림(invalid-primitive 없음) (" + ro + ")"); }
  const r = SC.complete(P);
  ok(r.ok && r.result.manualEdit.ops.length === 2 && SC.isCurrentSleeveChanged(P) === false, "6: 두 번째 재완료");
  // 두 조각을 잇는 선 = 미리보기 단계에서 거부(종전)
  // 되돌리기 한 단계 = 첫 수정 형상 → 첫 수정 완료본과 다름(완료본은 두 번째) → 다시 완료 필요
  ok(DLT.doSleeveEditUndo() === true && P.working.sleeveEdit.ops.length === 1 && SC.isCurrentSleeveChanged(P) === true, "6: 마지막 반영만 되돌림");
}

// §7 반영 미지원(사유 있는 거부): Ⓕ 턱 소매 소매산 · Ⓡ 파생 몸판 소매산 · Ⓧ 덧천 · Ⓥ 래글런 달림선 · Ⓨ·Ⓩ 별도 소매 없음
{
  const tryApply = (sym, pick, tag, re) => {
    const P = sleeveOn(sym); SC.complete(P);
    const g0 = P.working.geometry.sleeve, pr = pick(g0), cen = centroid(primsOfPiece(g0, pr.piece && g0.pieces && g0.pieces.length > 1 ? pr.piece : "sleeve"));
    bndLine(bulge(ptOn(pr, 0.3), ptOn(pr, 0.45), cen, 0.3, +1));
    const pv = previewNow(), st = DLT.getBoundaryState(), sn = snapW(P);
    ok(pv && st.apply && !st.apply.allowed && re.test(st.apply.reason) && DLT.doBoundaryApply() === false && snapW(P) === sn, tag + " (" + (st && st.apply ? st.apply.reason : st && st.reason) + ")");
  };
  tryApply("F", g => g.outline[roleIdx(g, "cap")], "7: Ⓕ 소매산 = 턱 소매 거부", /턱/);
  tryApply("R", g => g.outline[roleIdx(g, "cap")], "7: Ⓡ 소매산 = 파생 몸판 거부", /파생 몸판/);
  tryApply("X", g => g.outline[0], "7: Ⓧ 덧천 거부", /덧천/);
  tryApply("V", g => g.outline[roleIdx(g, "raglan", "back")], "7: Ⓥ 래글런 달림선 거부", /래글런/);
  ["Y", "Z"].forEach(sym => { const P = sleeveOn(sym); SC.complete(P);
    ok(E.planEdit(P.working.geometry.sleeve, [{ kind: "line", from: { x: 0, y: 0 }, to: { x: 1, y: 1 } }], E.ctxFor(P, P.working.sleeveResult)).code === "no-piece", "7: " + SYM(sym) + " = 별도 소매 없음 그대로"); });
  // Ⓕ 옆선은 허용(소매산 안 바뀜 — 턱 접은 소매산 실측 그대로)
  const P = sleeveOn("F"); SC.complete(P);
  const g0 = P.working.geometry.sleeve, sf = g0.outline[roleIdx(g0, "side-seam-front")], cen = centroid(g0.outline), base = P.working.sleeveResult;
  bndLine(bulge(ptOn(sf, 0.3), ptOn(sf, 0.7), cen, 0.5, -1));
  ok(previewNow() && DLT.doBoundaryApply() === true, "7: Ⓕ 앞 옆선 = 반영 허용 (" + bNote() + ")");
  const c = SC.check(P);
  ok(c.ok && Math.abs(c.capLengths.front - base.cap.lengths.front) < 1e-4 && Math.abs(c.capLengths.back - base.cap.lengths.back) < 1e-4, "7: Ⓕ 턱 접은 소매산 실측 그대로");
}

// §8 미편집 회귀: 기본 + Ⓐ~Ⓩ 완료 = 수정 분기 안 탐 · manualEdit 없음 · 변경 없는 재완료 같은 hash
{
  let okAll = true, bad = [];
  ["base"].concat(SYMS).forEach(sym => { const P = sleeveOn(sym); if (!P) { okAll = false; bad.push(sym + ":apply"); return; }
    const r = SC.complete(P), r2 = SC.complete(P);
    if (!r.ok || r.result.manualEdit || r.check.mode === "manual-edit" || r2.result.hash !== r.result.hash || P.working.sleeveEdit) { okAll = false; bad.push(sym); } });
  ok(okAll, "8: 미편집 기본+Ⓐ~Ⓩ 완료 경로 그대로 [" + bad.join(",") + "]");
}

console.log("══════════════════════════════════════════════");
fails.forEach(f => console.log("  ✗ " + f));
console.log("결과: " + PASS + " PASS / " + FAIL + " FAIL");
process.exitCode = FAIL ? 1 : 0;
