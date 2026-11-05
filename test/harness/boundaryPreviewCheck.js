// boundaryPreviewCheck.js — 외곽 대체 미리보기(2026-11-06 김님 «외곽 선택하면 외곽 대체 미리보기가 있어야지»).
//   node test/harness/boundaryPreviewCheck.js
//
//   §0 배선: 막대 «외곽 대체 미리보기» 행 · 오른쪽 버튼 보존 · render = visibleBoundaryPreview · 막대 = 같은 판정·같은 명령
//   §1 원래 몸판(앞판): 그리기 → 완료 → «외곽» → 막대 → 미리보기 = 종전 replaceArcOnRing 결과와 바이트 동일 · 원본 불변 · 무효화(선·외곽 서명) · 역할 전환 행
//   §2 파생 몸판 맥락(Ⓡ·Ⓧ): 원래 몸판 외곽 대체를 현재 결과처럼 보이지 않게 거부 · 낡은 몸판 미리보기 숨김
//   §3 기본 + Ⓐ~Ⓩ: 소매 곡선 대체선 → 미리보기(Ⓨ·Ⓩ = 별도 소매 조각 없음 거부) · 결과 **엔진과 독립 검산**(연속·폐합·자기교차·면적·대체선 제어점·
//      유지 구간 = 원래 조각 외곽 위·곡선 보존) · 원본 불변 · 소매·몸판 «변경됨» 아님
//   §4 Ⓒ 열린 V 보존(소매산 대체 → V 그대로 · V 다리 끝점·V 를 품는 대체 거부) · Ⓥ 같은 조각만(다른 조각 불변 · 두 조각 잇는 선 거부) · Ⓦ 어깨 다트 출처
//   §5 현재성: 미완료 · 입력 변경 · 재완료 · 몸판 변경 · 선 수정 · 편집 드래그 · 역할 전환 · 차단
//   §6 관리형 선(소매산·네크라인 전용선) 잠금 = 행 없음 · 보조선 = 다음 단계 없음
//   §7 Design 완료/hash 무관 · 소매 파트 분리 회귀 · 표시 판정 비용
//   §8 순수 엔진: 대조 사각 · 끝점 밖 · 모호(종전 계약) · 유지 외곽 교차 · 끊긴 외곽 · 몸판 기본 = 다트 입구 열림(종전)
//   셋업(몸판·소매 적용·실제 핸들러·독립 계측 도우미)은 sleevePartSplitCheck.js 와 같은 구성이다.
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
const files = ["designLineTool.js", "sleeveSplit.js", "designFlare.js", "designJoin.js", "designWaistSeam.js", "designYokeSeam.js", "designPrincess.js", "designBodice.js", "bodicePresets.js",
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

// §0 배선
{
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8"), R = fs.readFileSync(path.join(ROOT, "js", "render.js"), "utf8"), Q = fs.readFileSync(path.join(ROOT, "js", "designLineQuickBar.js"), "utf8");
  ok(/data-lqb="boundary"/.test(html) && /id="lineQuickBoundary"[^>]*disabled/.test(html) && /id="lineQuickBoundaryReason"/.test(html), "0: 막대 «외곽 대체 미리보기» 행 정적 마크업(기본 비활성)");
  ok(/id="btnDesignBoundary" onclick="designLineTool\.doBoundaryPreview\(\)"/.test(html), "0: 오른쪽 «외곽 대체 미리보기» id·onclick 보존");
  ok(/_dlt\.visibleBoundaryPreview\(dp\)/.test(R) && /_appendBoundaryPreview\(bRoot, _bp, L, scale\)/.test(R), "0: render = visibleBoundaryPreview(출처 결속) 결과만");
  ok(/T\.doBoundaryPreview\(\)/.test(Q) && /T\.getBoundaryState\(\)/.test(Q) && !/validateSelectedBoundary|boundaryStatusOf|sleeveRef/.test(Q), "0: 막대 = 같은 명령(doBoundaryPreview) · 같은 판정(getBoundaryState) · 재판정 없음");
  ok(/\["pointerdown", "mousedown", "touchstart", "wheel", "dblclick"\]\.forEach\(t => bar\.addEventListener/.test(Q), "0: 막대 누름은 캔버스로 전파되지 않음(종전 stopPropagation)");
  ok(typeof SS.boundarySleeve === "function" && typeof DLT.getBoundaryState === "function" && typeof QB.actBoundary === "function", "0: 엔진·조회·막대 동작 공개");
}

// §1 원래 몸판(앞판) — 종전 replaceArcOnRing 동작 보존 · 막대 연결
let FRONT_SEG = null;
{
  const P = sleeveOn("A"); SC.complete(P);
  const geo0 = J(P.working.geometry), bod0 = J(P.working.bodiceResult), res0 = J(P.working.sleeveResult);
  const fsegs = DLT.outlinePrimsToSegs(P.working.geometry.front.outline), fo = DLT.flattenLine(fsegs);
  const legs = (P.working.geometry.front.construction || []).filter(c => c.kind === "line").map(c => ({ from: c.from, to: c.to }));
  const ring = DLT.buildPieceRing(fsegs, legs).ring;
  let fc = null, dartRej = null;
  for (let y = 6; y < 60; y += 0.5) { const xs = []; fo.forEach(([a, b]) => { if ((a.y - y) * (b.y - y) < 0) xs.push(a.x + (b.x - a.x) * (y - a.y) / (b.y - a.y)); }); xs.sort((p, q) => p - q);
    if (xs.length !== 2) continue; const sg = [{ kind: "line", from: { x: xs[0], y }, to: { x: xs[1], y } }];
    const r = DLT.replaceArcOnRing(ring, sg); if (r.ok && !fc) fc = sg[0]; }
  ok(!!fc, "1: 앞판 시험 대체선(종전 판정으로 대체 가능)");
  if (fc) {
    FRONT_SEG = fc;
    DLT.setMode("off"); DLT.toggle(); click("front", fc.from, { altKey: true }); click("front", fc.to, { altKey: true }); key("Enter");
    const line = last(); DLT.setRole("boundary");
    ok(line.piece === "front" && line.role === "boundary" && DLT.getSelectedId() === line.id, "1: 그리기 → 완료 → «외곽»(앞판)");
    ok(bstatus() === "대체 가능" && bBtnOn(), "1: 오른쪽 상태 «대체 가능»(종전 문구) · 버튼 활성 (" + bstatus() + ")");
    const st = DLT.getBoundaryState(), v = barVM();
    ok(st && st.allowed && st.kind === "ok" && !st.shown, "1: 막대 판정 = 같은 허용(미리보기 전)");
    ok(v && v.boundary && v.boundary.allowed && !v.split && v.role === "boundary", "1: 막대 = «외곽 대체 미리보기» 다음 단계 행(분리 행 없음) (" + (v && v.boundary && v.boundary.text) + ")");
    ok(DLT.doBoundaryPreview() === true, "1: doBoundaryPreview 성공 (" + bNote() + ")");
    const bp = P.working.boundaryPreview, direct = DLT.replaceArcOnRing(ring, DLT.boundarySegsOf(line));
    ok(bp && bp.sourcePiece === "front" && bp.sourceLineId === line.id && J(bp.outline) === J(direct.outline), "1: 미리보기 outline = 종전 replaceArcOnRing(원본 ring) 결과와 바이트 동일");
    ok(DLT.visibleBoundaryPreview(P) === bp && DLT.getBoundaryState().shown && barVM().boundary.shown, "1: 현재 결과로 표시 · 막대 «미리보기 표시 중»");
    ok(QB.resultKey(barVM()) === "sel:" + line.id + ":bnd" && QB.chooseMode(barVM(), 1, null) === "compact" && QB.chooseMode(barVM(), 0, null) === "full", "1: 빈자리 없을 때만 소형 상태줄(접기/펼침 = 종전 개념)");
    ok(J(P.working.geometry) === geo0 && J(P.working.bodiceResult) === bod0 && J(P.working.sleeveResult) === res0, "1: 원본 불변(working.geometry·bodiceResult·sleeveResult)");
    ok(!BC.isCurrentBodiceChanged(P) && !SC.isCurrentSleeveChanged(P), "1: 미리보기 뒤 몸판·소매 «변경됨» 아님");
    // 무효화: 선 수정(서명) · 몸판 형상 변경(외곽 서명)
    DLT.moveAnchor(line, 1, 0, 0.3);
    ok(DLT.visibleBoundaryPreview(P) === null, "1: 선 좌표가 바뀌면 숨김(서명)");
    DLT.moveAnchor(line, 1, 0, -0.3);
    ok(DLT.visibleBoundaryPreview(P) === bp, "1: 되돌리면 다시 현재");
    const g0 = P.working.geometry; P.working.geometry = Object.assign({}, g0, { front: Object.assign({}, g0.front, { outline: g0.front.outline.slice(0, -1).concat([g0.front.outline[g0.front.outline.length - 1]]).map(x => JSON.parse(J(x))) }) });
    ok(DLT.visibleBoundaryPreview(P) === bp, "1: 같은 외곽(복사본)이면 현재 유지");
    const li = g0.front.outline.findIndex(x => x.kind === "line");
    P.working.geometry = Object.assign({}, g0, { front: Object.assign({}, g0.front, { outline: JSON.parse(J(g0.front.outline)).map((x, i) => i === li ? Object.assign(x, { to: { x: x.to.x + 0.01, y: x.to.y } }) : x) }) });
    ok(li >= 0 && J(P.working.geometry.front.outline) !== J(g0.front.outline), "1: 시험용 작업 외곽 변경(직선 끝점 0.01cm)");
    ok(DLT.visibleBoundaryPreview(P) === null, "1: 작업 외곽이 바뀌면 숨김(외곽 서명)");
    DLT.syncCutStatus(); ok(P.working.boundaryPreview === null, "1: 동기화 때 낡은 몸판 미리보기 제거");
    P.working.geometry = g0;
    // 역할 전환: 보조선 = 다음 단계 없음 · 절개선 = 분리 행
    DLT.doBoundaryPreview(); ok(!!DLT.visibleBoundaryPreview(P), "1: 다시 미리보기");
    DLT.setRole("guide");
    ok(P.working.boundaryPreview === null && DLT.getBoundaryState() === null && barVM().boundary === null && barVM().split === null, "1: 보조선 → 미리보기 제거 · 다음 단계 없음");
    DLT.setRole("cut");
    ok(barVM().boundary === null && !!barVM().split, "1: 절개선 → 파트 분리 행(외곽 행 없음)");
    DLT.setRole("boundary");
    ok(barVM().boundary && barVM().boundary.allowed, "1: 외곽으로 되돌리면 외곽 행");
    DLT.setMode("off");
  }
  // 카라 선: 미지원 이유
  const vc = DLT.boundaryStatusOf(P, { id: "x", piece: "collar", role: "boundary", segments: [{ kind: "line", from: { x: 0, y: 0 }, to: { x: 1, y: 1 } }] });
  ok(vc && !vc.ok && vc.kind === "piece" && /카라 미지원/.test(vc.reason), "1: 카라 선 = «카라 미지원» (" + vc.reason + ")");
}

// §2 파생 몸판 맥락(Ⓡ~Ⓩ): 원래 몸판 외곽을 대체해 현재 결과처럼 보이지 않게 거부
{
  ["R", "X"].forEach(sym => {
    const P = sleeveOn(sym); SC.complete(P);
    if (!FRONT_SEG) { ok(false, "2 " + SYM(sym) + ": 앞판 시험 선 없음"); return; }
    DLT.setMode("off"); DLT.toggle(); click("front", FRONT_SEG.from, { altKey: true }); click("front", FRONT_SEG.to, { altKey: true }); key("Enter"); DLT.setRole("boundary");
    const st = DLT.getBoundaryState();
    ok(st && !st.allowed && st.kind === "derived" && new RegExp("소매 " + SYM(sym) + " 파생 몸판은 외곽 대체 미리보기 미지원").test(st.reason) && !bBtnOn(), "2 " + SYM(sym) + ": 파생 몸판 = 미지원 이유 · 버튼 비활성 (" + bstatus() + ")");
    ok(barVM().boundary && !barVM().boundary.allowed && /^대체 불가 · /.test(barVM().boundary.text), "2 " + SYM(sym) + ": 막대도 같은 이유(비활성)");
    ok(DLT.doBoundaryPreview() === false && !P.working.boundaryPreview, "2 " + SYM(sym) + ": doBoundaryPreview 거부(미리보기 없음)");
    // 원래 맥락에서 만든 낡은 미리보기가 남아 있어도 숨김
    const line = last();
    P.working.boundaryPreview = { sourcePiece: "front", sourceLineId: line.id, outline: [], sourceLineSig: J(line.segments), sourceOutlineSig: "x" };
    ok(DLT.visibleBoundaryPreview(P) === null, "2 " + SYM(sym) + ": 몸판 미리보기는 파생 몸판 맥락에서 표시 안 함");
    P.working.boundaryPreview = null;
    DLT.setMode("off");
  });
}

// §3 소매 기본 + Ⓐ~Ⓩ: 그리기 → 완료 → «외곽» → 막대 → 미리보기 (Ⓨ·Ⓩ = 별도 소매 조각 없음)
const SWEPT = {};
["base"].concat(SYMS).forEach(sym => {
  const tag = "3 " + SYM(sym);
  const P = sleeveOn(sym); if (!P) { ok(false, tag + ": 적용"); return; }
  const c = SC.complete(P); ok(c.ok, tag + ": 소매 완료 (" + (c.reason || "") + ")"); if (!c.ok) return;
  const g = P.working.geometry.sleeve;
  const snap = { res: J(P.working.sleeveResult), geo: J(P.working.geometry), bod: J(P.working.bodiceResult), ref: J(P.referenceGeometry) };
  if (sym === "Y" || sym === "Z") {
    P.working.patternLines.push({ id: "line-1", piece: "sleeve", role: "boundary", segments: [{ kind: "line", from: { x: 0, y: 10 }, to: { x: 10, y: 10 } }] });
    DLT.setMode("off"); DLT.toggleSelect(); click("sleeve", { x: 5, y: 10 });
    const st = DLT.getBoundaryState();
    ok(DLT.getSelectedId() === "line-1" && st && !st.allowed && st.kind === "none" && /^별도 소매 조각 없음/.test(bstatus()) && !bBtnOn(), tag + ": «별도 소매 조각 없음» · 버튼 비활성 (" + bstatus() + ")");
    ok(barVM().boundary && !barVM().boundary.allowed, tag + ": 막대도 비활성 + 같은 이유");
    ok(DLT.doBoundaryPreview() === false && !P.working.boundaryPreview, tag + ": 거부(미리보기 없음) (" + bNote() + ")");
    DLT.setMode("off"); SWEPT[sym] = "none"; return;
  }
  const name = (Array.isArray(g.pieces) && g.pieces.length > 1) ? g.pieces[0] : null;
  // 시험 위치 = 소매산 위쪽(0.15) · Ⓦ 는 위쪽이 어깨 다트 V(실제 외곽)라 밑단 쪽(0.85) — V 쪽 거부는 §4 에서 따로 본다
  const hc = hcut(g, name, sym === "W" ? 0.85 : 0.15); ok(!!hc, tag + ": 시험 대체 높이"); if (!hc) return;
  // 소매산 꼭대기를 낮추는 곡선 대체선(두 번째 점 드래그 = cubic)
  const w = hc.b.x - hc.a.x, line = drawBnd("sleeve", [hc.a, hc.b], { handles: [null, { x: w * 0.25, y: -Math.min(0.6, w * 0.05) }] });
  ok(line && line.piece === "sleeve" && line.role === "boundary" && DLT.getSelectedId() === line.id && line.segments[0].kind === "cubic", tag + ": 그리기 → 완료 → «외곽»(소매 곡선 선)");
  const st = DLT.getBoundaryState(), v = barVM();
  ok(st && st.allowed && st.kind === "ok" && bBtnOn() && new RegExp("^대체 가능 — 소매 " + SYM(sym) + " 완료본 기준").test(bstatus()), tag + ": 오른쪽·막대 같은 허용 (" + (st ? st.reason : bstatus()) + ")");
  ok(v && v.boundary && v.boundary.allowed && v.boundary.text === st.reason, tag + ": 막대 이유 = 오른쪽 상태와 같은 문구");
  const acted = DLT.doBoundaryPreview();
  const bp = P.working.boundaryPreview;
  ok(acted && bp && bp.sourcePiece === "sleeve" && bp.sourceLineId === line.id && bp.sourceSleeveSym === SYM(sym) && bp.sourceSleeveHash === P.working.sleeveResult.hash && bp.sourceBodiceHash === P.working.bodiceResult.hash,
    tag + ": 미리보기 · 출처 결속(소매/몸판 hash·기호·선) (" + bNote() + ")");
  ok(DLT.visibleBoundaryPreview(P) === bp && DLT.getBoundaryState().shown && barVM().boundary.shown, tag + ": 현재 결과로 표시 · 막대 «미리보기 표시 중»");
  ok(/보라/.test(bNote()) && /미리보기일 뿐/.test(bNote()), tag + ": 안내 = 미리보기일 뿐(완성 외곽인 척 없음)");
  if (bp) verifySleevePreview(tag, bp, g, name || bp.sourceSleevePiece, line);
  ok(J(P.working.sleeveResult) === snap.res && J(P.working.geometry) === snap.geo && J(P.working.bodiceResult) === snap.bod && J(P.referenceGeometry) === snap.ref, tag + ": 원본 불변(sleeveResult·working.geometry·bodiceResult·referenceGeometry)");
  ok(!SC.isCurrentSleeveChanged(P) && !BC.isCurrentBodiceChanged(P), tag + ": 미리보기 뒤 소매·몸판 «변경됨» 아님");
  DLT.setMode("off");
  SWEPT[sym] = bp ? "ok" : "fail";
});
ok(Object.keys(SWEPT).length === 27 && Object.keys(SWEPT).filter(k => SWEPT[k] === "ok").length === 25, "3: 27종(기본+26) — 25 미리보기 · Ⓨ·Ⓩ 구체적 거부 (" + J(SWEPT) + ")");

// §4 Ⓒ 열린 다트 V(실제 외곽) · Ⓥ 두 장 · Ⓦ 어깨 다트
{
  const P = sleeveOn("C"); SC.complete(P);
  const g = P.working.geometry.sleeve;
  const ls = g.outline.filter(p => p.kind === "line"); let V = null;
  ls.forEach(a => ls.forEach(b => { if (a === b || V) return; if (D(a.to, b.from) < 1e-9) { const u = { x: a.from.x - a.to.x, y: a.from.y - a.to.y }, v = { x: b.to.x - b.from.x, y: b.to.y - b.from.y };
    const ang = Math.acos((u.x * v.x + u.y * v.y) / Math.hypot(u.x, u.y) / Math.hypot(v.x, v.y)); if (ang < 0.6) V = { apex: a.to, l1: a, l2: b }; } }));
  ok(!!V, "4: Ⓒ 외곽에 열린 V 실측(독립 탐색)");
  if (V) {
    // (a) 소매산 대체 → V 는 결과에 그대로(꼭짓점 + 다리 두 직선)
    const hc = hcut(g, null, 0.15), line = drawBnd("sleeve", [hc.a, hc.b]);
    ok(DLT.doBoundaryPreview(), "4a: Ⓒ 소매산 대체 미리보기 (" + bNote() + ")");
    const bp = P.working.boundaryPreview, out = bp ? bp.outline : [];
    const legs = out.filter(s => s.kind === "line" && (D(s.to, V.apex) < 1e-9 || D(s.from, V.apex) < 1e-9));
    ok(legs.length === 2 && legs.some(s => D(s.from, V.l1.from) < 1e-9 || D(s.to, V.l1.from) < 1e-9) && legs.some(s => D(s.from, V.l2.to) < 1e-9 || D(s.to, V.l2.to) < 1e-9), "4a: 열린 V 꼭짓점·다리 두 직선이 결과에 그대로(봉합·제거 없음)");
    ok(!out.some(s => (g.construction || []).some(cn => cn.kind === "line" && D(s.from, cn.from) < 1e-9 && D(s.to, cn.to) < 1e-9)), "4a: 제도선(construction)으로 메운 구간 없음");
    if (bp) verifySleevePreview("4a", bp, g, "sleeve", line);
    DLT.deleteSelected();
    // (b) 옆선 → V 다리에서 끝나는 대체선 = 다리 위 끝점 거부
    const L0 = loopOf(g.outline, 400), y = V.apex.y + 8, xs = hcrossings(L0, y);
    ok(xs.length === 4, "4b: 꼭짓점 아래 수평 = 외곽 교차 4 (" + xs.length + ")");
    drawBnd("sleeve", [{ x: xs[0], y }, { x: xs[1], y }], { alt: true });
    const sb = DLT.getBoundaryState();
    ok(sb && !sb.allowed && /열린 다트 V 다리 위/.test(sb.reason) && !bBtnOn(), "4b: V 다리 끝점 = 구체적 거부 (" + (sb && sb.reason) + ")");
    ok(DLT.doBoundaryPreview() === false && !P.working.boundaryPreview, "4b: 미리보기 없음");
    DLT.deleteSelected();
    // (c) V 양쪽 밑단을 잇는 대체선(짧은 구간이 V 를 품음) → 거부
    const hemF = g.outline.filter(p => p.role === "hem-center")[0], hemB = g.outline.filter(p => p.role === "hem-back")[0];
    const mid = pr => { const q = cubsOf(pr); return bez(q[Math.floor(q.length / 2)], 0.5); };
    if (hemF && hemB) {
      const a = mid(hemF), b = mid(hemB);
      drawBnd("sleeve", [a, b], { alt: true });
      const sc = DLT.getBoundaryState();
      ok(sc && !sc.allowed && /V/.test(sc.reason), "4c: V 를 품는 대체 = 거부(V 는 실제 외곽) (" + (sc && sc.reason) + ")");
      DLT.deleteSelected();
    } else ok(false, "4c: Ⓒ 밑단 역할 찾기");
  }
  DLT.setMode("off");
}
{
  const P = sleeveOn("V"); SC.complete(P);
  const g = P.working.geometry.sleeve, geo0 = J(g);
  const hb = hcut(g, "back", 0.2), hf = hcut(g, "front", 0.2);
  // (a) 뒤 조각 안의 대체선 → 뒤 조각만 결과(앞 조각 불변)
  const line = drawBnd("sleeve", [hb.a, hb.b]);
  ok(DLT.doBoundaryPreview(), "4d: Ⓥ 뒤 조각 대체 미리보기 (" + bNote() + ")");
  const bp = P.working.boundaryPreview;
  ok(bp && bp.sourceSleevePiece === "back" && /Ⓥ\(back\)/.test(bNote()), "4d: 결과 = 선이 놓인 조각(back)만");
  if (bp) { verifySleevePreview("4d", bp, g, "back", line);
    const Lf = loopOf(primsOfPiece(g, "front"), 400);
    ok(!bp.outline.some(s => poly(s, 10).every(p => dPoly(p, Lf) < 1e-4)), "4d: 앞 조각 외곽 구간은 결과에 없음(다른 조각과 섞지 않음)"); }
  ok(J(P.working.geometry.sleeve) === geo0, "4d: 두 조각 원본 불변");
  DLT.deleteSelected();
  // (b) 뒤 → 앞 조각을 잇는 선 = 거부
  drawBnd("sleeve", [hb.b, hf.a], { alt: true });
  const sx = DLT.getBoundaryState();
  ok(sx && !sx.allowed && /서로 다른 소매 조각/.test(sx.reason), "4e: 두 조각을 잇는 선 = 거부 (" + (sx && sx.reason) + ")");
  DLT.setMode("off");
}
{
  const P = sleeveOn("W"); SC.complete(P);
  const g = P.working.geometry.sleeve, darts = g.outline.filter(p => /dart/.test(p.role || ""));
  ok(darts.length === 2, "4f: Ⓦ 어깨 다트 V 다리 둘(role)");
  const grp = SS.pieceGroups(g)[0];
  ok(grp.darts.filter(Boolean).length >= 2, "4f: 외곽 대체 고리에서 다트 다리 출처로 표시");
  const hw = hcut(g, null, 0.15); drawBnd("sleeve", [hw.a, hw.b]);
  const sw = DLT.getBoundaryState();
  ok(sw && !sw.allowed && /열린 다트 V/.test(sw.reason) && DLT.doBoundaryPreview() === false && !P.working.boundaryPreview, "4f: Ⓦ 어깨 다트 V 를 품는 소매산 대체 = 거부(V 보존) (" + (sw && sw.reason) + ")");
  DLT.setMode("off");
}

// §5 현재성 · 무효화(소매)
{
  const P = sleeveOn("C");
  const g = P.working.geometry.sleeve, hc = hcut(g, null, 0.15);
  // (a) 미완료 → 재완료 이유 · 거부
  const line = drawBnd("sleeve", [hc.a, hc.b]);
  const s0 = DLT.getBoundaryState();
  ok(s0 && !s0.allowed && s0.kind === "pending" && /^소매 재완료 필요 — 소매 Ⓒ 모양 완료 전/.test(s0.reason) && !bBtnOn(), "5a: 미완료 = «소매 재완료 필요» (" + (s0 && s0.reason) + ")");
  ok(DLT.doBoundaryPreview() === false && !P.working.boundaryPreview && /모양 완료 전/.test(bNote()), "5a: 이전 형상으로 미리보기 안 함 (" + bNote() + ")");
  // (b) 완료 → 미리보기
  SC.complete(P); DLT.syncCutStatus();
  ok(DLT.getBoundaryState().allowed && DLT.doBoundaryPreview() && !!DLT.visibleBoundaryPreview(P), "5b: 완료 뒤 미리보기");
  // (c) 입력 변경 → 숨김 · 동기화 때 제거 · 막대 즉시 동기화
  API("C").apply(P, changedOf("C"));
  ok(DLT.visibleBoundaryPreview(P) === null, "5c: 소매 입력 변경 → 표시 안 함(빠른 판정)");
  const bs0 = BARSYNC; DLT.syncCutStatus();
  ok(P.working.boundaryPreview === null && BARSYNC > bs0 && DLT.getBoundaryState().allowed === false && /^소매 재완료 필요/.test(DLT.getBoundaryState().reason), "5c: 동기화 때 낡은 미리보기 제거 · 막대 판정 갱신 (" + DLT.getBoundaryState().reason + ")");
  // (d) 재완료 → 다시 미리보기 · 몸판 변경 → 숨김
  SC.complete(P); DLT.syncCutStatus();
  ok(DLT.doBoundaryPreview() && !!DLT.visibleBoundaryPreview(P), "5d: 재완료 뒤 다시 미리보기");
  setBodice(P, "B");
  ok(DLT.visibleBoundaryPreview(P) === null, "5d: 몸판 변경 → 숨김");
  DLT.syncCutStatus(); ok(P.working.boundaryPreview === null && !bBtnOn(), "5d: 몸판 변경 = 제거 · 버튼 비활성 (" + bstatus() + ")");
  DLT.setMode("off");
}
{
  const P = sleeveOn("A"); SC.complete(P);
  const hc = hcut(P.working.geometry.sleeve, null, 0.15), line = drawBnd("sleeve", [hc.a, hc.b]);
  ok(DLT.doBoundaryPreview(), "5e: 미리보기");
  // (e) 선 수정(서명)
  DLT.moveAnchor(line, 1, 0, 0.3);
  ok(DLT.visibleBoundaryPreview(P) === null && DLT.getBoundaryState().shown === false, "5e: 선 좌표가 바뀌면 숨김(서명)");
  DLT.moveAnchor(line, 1, 0, -0.3);
  // (f) 실제 편집 드래그(앵커) → 그 미리보기 데이터 제거 · 몸판 합성 외곽은 건드리지 않음
  DLT.doBoundaryPreview(); const dO = { front: { outline: [] } }; P.working.designOutline = dO;
  const a1 = line.segments[line.segments.length - 1].to;
  const e0 = evAt("sleeve", a1); down(e0); const e1 = evAt("sleeve", { x: a1.x, y: a1.y + 0.4 }, { clientX: e0.clientX + 40 }); move(e1); up(e1);
  ok(P.working.boundaryPreview === null && P.working.designOutline === dO, "5f: 소매 대체선 편집 드래그 → 그 미리보기만 제거(몸판 합성 외곽 유지)");
  P.working.designOutline = null;
  DLT.moveAnchor(line, line.segments.length, D(a1, a1), 0); // no-op 안전
  // (g) 역할 전환
  DLT.syncCutStatus();
  const cur = DLT.getBoundaryState();
  if (cur && cur.allowed) DLT.doBoundaryPreview();
  DLT.setRole("guide");
  ok(P.working.boundaryPreview === null && DLT.getBoundaryState() === null && barVM().boundary === null, "5g: 보조선 → 미리보기 제거 · 다음 단계 없음");
  DLT.setRole("cut"); ok(barVM().boundary === null && !!barVM().split, "5g: 절개선 → 분리 행");
  DLT.setRole("boundary");
  // (h) 차단 → 숨김 · 이유
  DLT.syncCutStatus(); if (DLT.getBoundaryState().allowed) DLT.doBoundaryPreview();
  P.working.sleeveA.blocked = { reason: "invalid-input", text: "소매길이 범위 밖" };
  ok(DLT.visibleBoundaryPreview(P) === null, "5h: 차단 → 숨김");
  DLT.syncCutStatus();
  ok(/^소매 재완료 필요 — 소매 Ⓐ 적용이 차단됨\(소매길이 범위 밖\)/.test(DLT.getBoundaryState().reason) && !bBtnOn(), "5h: 차단 이유 (" + DLT.getBoundaryState().reason + ")");
  P.working.sleeveA.blocked = null;
  DLT.setMode("off");
}

// §6 관리형 선 — 잠금 유지(다음 단계 행 없음)
{
  const P = sleeveOn("A"); SC.complete(P);
  const hc = hcut(P.working.geometry.sleeve, null, 0.5);
  P.working.patternLines.push({ id: "line-90", piece: "sleeve", role: "boundary", managedBy: "sleeve-cap", splitAnchorIndex: 1, segments: [{ kind: "line", from: hc.a, to: hc.b }] });
  DLT.setMode("off"); DLT.toggleSelect(); click("sleeve", { x: (hc.a.x + hc.b.x) / 2, y: hc.a.y });
  const v = barVM();
  ok(DLT.getSelectedId() === "line-90" && v && v.locked && v.boundary === null, "6: 소매산 관리선 = 역할 잠금 · «외곽 대체» 행 없음");
  const vn = QB.describe({ design: true, mode: "select", sel: { id: "n", piece: "front", role: "boundary", lock: "neck", boundary: { allowed: true, kind: "ok", reason: "대체 가능", shown: false } } });
  ok(vn.locked && vn.boundary === null, "6: 네크라인 전용선(잠금) = 행 없음");
  const vg = QB.describe({ design: true, mode: "select", sel: { id: "g", piece: "sleeve", role: "guide", lock: null, boundary: null } });
  ok(vg.boundary === null && vg.split === null, "6: 보조선 = 다음 단계 없음");
  DLT.setMode("off");
}

// §7 기존 소매 분리 · Design hash · 성능
{
  const P = sleeveOn("C"); SC.complete(P); setCollar(P); CC.complete(P);
  const d0 = DR.complete(P); ok(d0.ok, "7: designResult 완료");
  const h0 = d0.ok ? d0.result.hash : null;
  const hc = hcut(P.working.geometry.sleeve, null, 0.15); drawBnd("sleeve", [hc.a, hc.b]);
  ok(DLT.doBoundaryPreview(), "7: 소매 미리보기");
  ok(DR.isCurrentDesignChanged(P) === false, "7: 소매 대체선·미리보기는 Design «변경됨»을 만들지 않음");
  const d1 = DR.complete(P); ok(d1.ok && d1.result.hash === h0, "7: 재완료 hash 동일(미리보기 비포함)");
  DLT.setMode("off");
  // 분리 회귀: 같은 소매에서 절개선 → 파트 분리 그대로
  const hs = hcut(P.working.geometry.sleeve, null, 0.55); drawCut([hs.a, hs.b]); DLT.doSplit();
  ok(DLT.visibleParts(P).length === 2, "7: 소매 파트 분리 회귀 없음 (" + splitNote() + ")");
  DLT.setMode("off");
  const R = sleeveOn("R"); SC.complete(R);
  const hr = hcut(R.working.geometry.sleeve, null, 0.15); drawBnd("sleeve", [hr.a, hr.b]);
  ok(DLT.doBoundaryPreview(), "7: Ⓡ 소매 미리보기 (" + bNote() + ")");
  const t0 = Date.now(); for (let k = 0; k < 20; k++) DLT.visibleBoundaryPreview(R); const ms = (Date.now() - t0) / 20;
  ok(ms < 20, "7: 표시 판정(visibleBoundaryPreview)은 render 마다 불러도 가볍다 — Ⓡ " + ms.toFixed(1) + "ms/회");
  DLT.setMode("off");
}

// §8 순수 엔진: 고리·잘못된 선
{
  const L = (a, b) => ({ kind: "line", from: { x: a[0], y: a[1] }, to: { x: b[0], y: b[1] } });
  const sq = { outline: [L([0, 0], [10, 0]), L([10, 0], [10, 10]), L([10, 10], [0, 10]), L([0, 10], [0, 0])] };
  const r = SS.boundarySleeve(sq, [{ kind: "line", from: { x: 0, y: 2 }, to: { x: 2, y: 0 } }]);
  ok(r.ok && r.outline.length === 5 && r.outline.every((q, i) => D(q.to, r.outline[(i + 1) % 5].from) < 1e-12), "8: 사각 모서리 대체 = 대체선 1 + 유지 4 · 닫힌 한 고리(대조)");
  const off = SS.boundarySleeve(sq, [{ kind: "line", from: { x: 3, y: 3 }, to: { x: 2, y: 0 } }]);
  ok(!off.ok && off.code === "off-outline", "8: 끝점 외곽 밖 = 거부 (" + off.reason + ")");
  const amb = SS.boundarySleeve(sq, [{ kind: "line", from: { x: 5, y: 0 }, to: { x: 5, y: 10 } }]);
  ok(!amb.ok && /모호/.test(amb.reason), "8: 양쪽 길이 같은 대체 = 모호 거부(종전 계약) (" + amb.reason + ")");
  const sx = SS.boundarySleeve(sq, [{ kind: "line", from: { x: 0, y: 2 }, to: { x: 6, y: 6 } }, { kind: "line", from: { x: 6, y: 6 }, to: { x: 6, y: -3 } }, { kind: "line", from: { x: 6, y: -3 }, to: { x: 2, y: 0 } }]);
  ok(!sx.ok, "8: 유지 외곽을 가로지르는 대체선 = 거부 (" + sx.reason + ")");
  const gap = SS.boundarySleeve({ outline: [L([0, 0], [10, 0]), L([10, 0], [10, 10]), L([10, 10], [0, 10]), L([0, 10], [0, 0.5])] }, [{ kind: "line", from: { x: 0, y: 5 }, to: { x: 2, y: 10 } }]);
  ok(!gap.ok && gap.code === "ring", "8: 끊긴 외곽 = 형태 미지원 사유 (" + gap.reason + ")");
  const body = DLT.replaceArcOnRing([{ seg: L([0, 0], [10, 0]), source: "outline" }, { seg: L([10, 0], [10, 10]), source: "outline" }, { seg: L([10, 10], [5, 6]), source: "dartleg" }, { seg: L([5, 6], [0, 10]), source: "dartleg" }, { seg: L([0, 10], [0, 0]), source: "outline" }],
    [{ kind: "line", from: { x: 0, y: 2 }, to: { x: 2, y: 0 } }]);
  ok(body.ok && body.outline.every(s => !(D(s.from, { x: 5, y: 6 }) < 1e-9 || D(s.to, { x: 5, y: 6 }) < 1e-9)), "8: 몸판 기본(keepDartlegs 없음) = 다트 다리 빼고 입구 열림(종전)");
}

console.log("══════════════════════════════════════════════");
fails.forEach(f => console.log("  ✗ " + f));
console.log("결과: " + PASS + " PASS / " + FAIL + " FAIL");
process.exitCode = FAIL ? 1 : 0;
