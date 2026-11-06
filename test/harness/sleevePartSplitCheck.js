// sleevePartSplitCheck.js — 소매 파트 분리(2026-11-05 김님 승인 «소매에서도 선 그리기 → 그리기 완료 → 절개선 → 파트 분리»).
//   node test/harness/sleevePartSplitCheck.js
//
//   §0 배선: index.html 스크립트 순서 · render 미리보기 = visibleParts · doSplit 소매 분기
//   §1 기본 + Ⓐ~Ⓩ 각 기본값(몸판 Ⓐ): 실제 핸들러로 그리기 → Enter 완료 → «절개선» → 판정·막대 상태 → doSplit → 두 파트
//      (Ⓨ·Ⓩ = 별도 소매 조각 없음 → 구체적 거부) · 파트는 **엔진과 독립 계측**: 면적 합 · 공유 절개 길이 · 연속·폐합 · 자기교차 ·
//      외곽 위 구간 정확 분할(곡선 보존) · 원본 불변(sleeveResult·geometry·bodiceResult·referenceGeometry)
//   §2 곡선 절개(기본·Ⓒ·Ⓥ·Ⓧ): cubic 절개선이 두 파트에 같은 제어점(한쪽 반대 방향)으로 남는다
//   §3 Ⓒ 열린 다트 V: V 다리에서 끝나는 선 = 분리(V 꼭짓점·다리 그대로) · V 를 가로지르는 선 = 구체적 거부
//   §4 물리 거부: Ⓥ 두 조각을 잇는 선 · 소매 바깥을 지나는 선 · 끝점 외곽 밖 — 유효 절개선과 분리 가능을 구분
//   §5 현재성: 완료 전(현재 형상 기준 · 2026-11-06) · 차단 · 다른 소매 · 입력 변경 · 몸판 변경 · 선 수정 · 역할 전환 → 이전 형상으로 자르지 않음 / 낡은 파트 무효화
//   §6 관리형 소매산 선: 역할 잠금 그대로
//   §7 기존 몸판 파트 분리 보존 · 소매 분리는 마지막 한 쌍으로 교체 · 파생 몸판 맥락의 몸판 파트 숨김(종전)
//   §8 Design 완료/hash: 소매 절개선·파트는 structuralLines·hash 에 들어가지 않는다(새 저장·출력 체계 없음)
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
// 파트 독립 검산
function verifyParts(tag, parts, g, pieceName, cutPts) {
  const L0 = loopOf(primsOfPiece(g, pieceName), 400), A0 = Math.abs(area(L0));
  const pl = parts.map(pt => { let L = []; pt.outline.forEach((s, i) => { L = L.concat(poly(s, 200).slice(i ? 1 : 0)); }); return L; });
  const A = pl.map(L => Math.abs(area(L)));
  ok(Math.abs(A[0] + A[1] - A0) < 0.02 && A[0] > 0.5 && A[1] > 0.5, tag + ": 면적 합 = 소매 조각 면적 (" + A[0].toFixed(3) + " + " + A[1].toFixed(3) + " = " + (A[0] + A[1]).toFixed(3) + " vs " + A0.toFixed(3) + ")");
  ok(parts.every(pt => pt.outline.every((s, i) => D(s.to, pt.outline[(i + 1) % pt.outline.length].from) < 1e-9)), tag + ": 두 파트 모두 이음·폐합 연속(< 1e-9)");
  ok(pl.every(L => !selfX(L)), tag + ": 두 파트 자기교차 없음");
  // 공유 절개: 각 파트에서 외곽 위가 아닌 구간 길이 = 절개선 길이(독립)
  const cutLen = plen(cutPts);
  const offLen = pt => pt.outline.filter(s => { const m = bez(cubsOf(s)[0], 0.5); return dPoly(m, L0) > 1e-3; }).reduce((a, s) => a + plen(poly(s, 400)), 0);
  const c0 = offLen(parts[0]), c1 = offLen(parts[1]);
  ok(Math.abs(c0 - cutLen) < 2e-3 && Math.abs(c1 - cutLen) < 2e-3, tag + ": 공유 절개 길이 같음 (" + c0.toFixed(4) + " / " + c1.toFixed(4) + " vs " + cutLen.toFixed(4) + ")");
  // 외곽 위 구간 = 원래 외곽 정확 분할(곡선 보존): 샘플이 외곽 위(1e-4) · cubic 은 cubic 으로 남음
  const onSegs = [].concat.apply([], parts.map(pt => pt.outline.filter(s => dPoly(bez(cubsOf(s)[0], 0.5), L0) <= 1e-3)));
  ok(onSegs.every(s => poly(s, 20).every(p => dPoly(p, L0) < 2e-4)), tag + ": 외곽 위 구간 샘플이 원래 외곽 위(정확 분할)");
  const origCubics = primsOfPiece(g, pieceName).reduce((a, p) => a + cubsOf(p).filter(q => p.kind !== "line" && !(D(q[0], q[1]) < 1e-12 && D(q[2], q[3]) < 1e-12)).length, 0);
  ok(origCubics === 0 || onSegs.some(s => s.kind === "cubic"), tag + ": 곡선 외곽이 cubic 으로 보존(평탄화 아님)");
}

// §0 배선
{
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8"), R = fs.readFileSync(path.join(ROOT, "js", "render.js"), "utf8"), T = fs.readFileSync(path.join(ROOT, "js", "designLineTool.js"), "utf8");
  const iT = html.indexOf('<script src="js/designLineTool.js'), iS = html.indexOf('<script src="js/sleeveSplit.js'), iQ = html.indexOf('<script src="js/designLineQuickBar.js');
  ok(iT > 0 && iS > iT && iQ > iS, "0: index.html 스크립트 순서 designLineTool → sleeveSplit → designLineQuickBar");
  ok(/_dlt\.visibleParts\(dp\)/.test(R) && /_appendParts\(partsRoot, _parts, L, scale\)/.test(R), "0: render 파트 미리보기 = visibleParts(출처 결속) 결과만");
  ok(/if \(line\.piece === "sleeve"\) \{ doSplitSleeve\(p, line\); return; \}/.test(T), "0: doSplit 소매 분기(같은 명령 — 오른쪽 버튼·막대 공용)");
  ok(typeof SS.splitSleeve === "function" && typeof DLT.visibleParts === "function", "0: sleeveSplit · visibleParts 공개");
}

// §1 기본 + Ⓐ~Ⓩ 기본값 스윕
const SWEPT = {};
["base"].concat(SYMS).forEach(sym => {
  const tag = "1 " + SYM(sym);
  const P = sleeveOn(sym); if (!P) { ok(false, tag + ": 적용"); return; }
  const c = SC.complete(P); ok(c.ok, tag + ": 소매 완료 (" + (c.reason || "") + ")"); if (!c.ok) return;
  const g = P.working.geometry.sleeve;
  const snap = { res: J(P.working.sleeveResult), geo: J(g), bod: J(P.working.bodiceResult), ref: J(P.referenceGeometry) };
  const ref = SS.sleeveRef(P);
  if (sym === "Y" || sym === "Z") {
    ok(ref.source === "none" && /별도 소매 조각이 없음/.test(ref.reason), tag + ": 별도 소매 조각 없음 = «none» (" + ref.reason + ")");
    // 이전 소매에서 그린 선이 남아 있는 경우: 구체적 거부 · 파트 없음
    P.working.patternLines.push({ id: "line-1", piece: "sleeve", role: "cut", segments: [{ kind: "line", from: { x: 0, y: 10 }, to: { x: 10, y: 10 } }] });
    DLT.setMode("off"); DLT.toggleSelect(); click("sleeve", { x: 5, y: 10 });
    ok(DLT.getSelectedId() === "line-1" && /^소매 조각 없음: /.test(status()) && !splitBtnOn(), tag + ": 상태 «소매 조각 없음» · 분리 비활성 (" + status() + ")");
    const st = DLT.getSplitState(); ok(st && st.allowed === false && st.kind === "none", tag + ": 막대 판정 = 불가(none)");
    DLT.doSplit(); ok(!(P.working.parts || []).length && /별도 소매 조각이 없음/.test(splitNote()), tag + ": doSplit 거부(파트 없음) (" + splitNote() + ")");
    DLT.setMode("off"); SWEPT[sym] = "none"; return;
  }
  ok(ref.source === "current" && ref.sym === SYM(sym), tag + ": 분리 기준 = 현재 소매 완료본 (" + ref.source + (ref.reason ? " " + ref.reason : "") + ")");
  const name = (Array.isArray(g.pieces) && g.pieces.length > 1) ? g.pieces[0] : null;
  const hc = hcut(g, name, 0.55); ok(!!hc, tag + ": 시험 절개 높이 찾음"); if (!hc) return;
  const line = drawCut([hc.a, hc.b]);
  ok(line && line.piece === "sleeve" && line.role === "cut" && DLT.getSelectedId() === line.id, tag + ": 그리기 → 완료 → «절개선» (소매 선)");
  ok(/^분리 가능 — 소매 /.test(status()) && splitBtnOn(), tag + ": 상태 «분리 가능» · 오른쪽 버튼 활성 (" + status() + ")");
  const st = DLT.getSplitState(); ok(st && st.allowed === true && st.kind === "ok" && st.parts === 0, tag + ": 막대 판정 = 같은 허용(파트 0)");
  DLT.doSplit();
  const parts = P.working.parts || [];
  ok(parts.length === 2 && parts.every(q => q.sourcePiece === "sleeve" && q.sourceCutId === line.id && q.sourceSleeveSym === SYM(sym) && q.sourceSleeveHash === P.working.sleeveResult.hash && q.sourceBodiceHash === P.working.bodiceResult.hash),
    tag + ": 두 파트 · 출처 결속(소매·절개선·소매/몸판 hash) (" + splitNote() + ")");
  ok(DLT.visibleParts(P).length === 2 && DLT.getSplitState().parts === 2, tag + ": 현재 결과로 표시(visibleParts 2 · 막대 «분리됨»)");
  const pname = parts[0] && parts[0].sourceSleevePiece;
  if (parts.length === 2) verifyParts(tag, parts, g, name || pname, [line.segments[0].from, line.segments[0].to]);
  ok(J(P.working.sleeveResult) === snap.res && J(P.working.geometry.sleeve) === snap.geo && J(P.working.bodiceResult) === snap.bod && J(P.referenceGeometry) === snap.ref, tag + ": 원본 불변(sleeveResult·geometry·bodiceResult·referenceGeometry)");
  ok(!SC.isCurrentSleeveChanged(P) && !BC.isCurrentBodiceChanged(P), tag + ": 분리 뒤에도 소매·몸판 «변경됨» 아님");
  DLT.setMode("off");
  SWEPT[sym] = "ok";
});
ok(Object.keys(SWEPT).length === 27 && Object.keys(SWEPT).filter(k => SWEPT[k] === "ok").length === 25, "1: 27종(기본+26) 판정 — 25 분리 · Ⓨ·Ⓩ 구체적 거부 (" + J(SWEPT) + ")");

// §2 곡선 절개(cubic) — 제어점 보존
["base", "C", "V", "X"].forEach(sym => {
  const tag = "2 " + SYM(sym);
  const P = sleeveOn(sym); SC.complete(P);
  const g = P.working.geometry.sleeve, name = (Array.isArray(g.pieces) && g.pieces.length > 1) ? g.pieces[0] : null;
  const hc = hcut(g, name, 0.5); if (!hc) { ok(false, tag + ": 시험 높이"); return; }
  const w = hc.b.x - hc.a.x, hy = Math.min(1.5, w * 0.15);
  // 두 번째 점을 드래그(핸들) → 곡선 구간 1개
  const line = drawCut([hc.a, hc.b], { handles: [null, { x: w * 0.3, y: hy }] });
  ok(line.segments.length === 1 && line.segments[0].kind === "cubic", tag + ": 곡선 절개선(cubic 1구간)");
  ok(splitBtnOn(), tag + ": 곡선 절개 «분리 가능» (" + status() + ")");
  DLT.doSplit();
  const parts = P.working.parts || [];
  ok(parts.length === 2, tag + ": 곡선 절개 두 파트 (" + splitNote() + ")");
  if (parts.length === 2) {
    const s = line.segments[0], key = q => [q.from, q.c1, q.c2, q.to].map(p => p.x.toFixed(9) + "," + p.y.toFixed(9)).join(" ");
    const fwd = key(s), rev = key({ from: s.to, c1: s.c2, c2: s.c1, to: s.from });
    const hit = pt => pt.outline.filter(q => q.kind === "cubic" && (key(q) === fwd || key(q) === rev)).map(q => key(q) === fwd ? "f" : "r");
    const h0 = hit(parts[0]), h1 = hit(parts[1]);
    ok(h0.length === 1 && h1.length === 1 && h0[0] !== h1[0], tag + ": 절개 곡선이 두 파트에 같은 제어점(한쪽 반대 방향)으로 보존 (" + J([h0, h1]) + ")");
    verifyParts(tag, parts, g, name || parts[0].sourceSleevePiece, poly(s, 400));
  }
  DLT.setMode("off");
});

// §3 Ⓒ 열린 다트 V
{
  const P = sleeveOn("C"); SC.complete(P);
  const g = P.working.geometry.sleeve;
  // V = 공통 꼭짓점을 갖는 두 직선 중 사이각이 작은 것(독립 탐색)
  const ls = g.outline.filter(p => p.kind === "line"); let V = null;
  ls.forEach(a => ls.forEach(b => { if (a === b || V) return; if (D(a.to, b.from) < 1e-9) { const u = { x: a.from.x - a.to.x, y: a.from.y - a.to.y }, v = { x: b.to.x - b.from.x, y: b.to.y - b.from.y };
    const ang = Math.acos((u.x * v.x + u.y * v.y) / Math.hypot(u.x, u.y) / Math.hypot(v.x, v.y)); if (ang < 0.6) V = { apex: a.to, l1: a, l2: b, ang }; } }));
  ok(!!V, "3: Ⓒ 외곽에 열린 V(다리 둘·꼭짓점) 실측");
  if (V) {
    const L0 = loopOf(g.outline, 400), y = V.apex.y + 8, xs = hcrossings(L0, y);   // 꼭짓점 아래 8cm: 외곽·V 다리 네 교차
    ok(xs.length === 4, "3: 꼭짓점 아래 수평선 = 외곽 교차 4(옆선·V 두 다리·옆선) (" + xs.length + ")");
    // (a) V 를 가로지르는 선 → 구체적 거부
    const bad = drawCut([{ x: xs[0], y }, { x: xs[3], y }], { alt: true });
    ok(/외곽선에 닿음/.test(status()) && !splitBtnOn(), "3a: V 를 가로지르는 선 = «절개선 중간이 외곽선에 닿음» · 분리 비활성 (" + status() + ")");
    DLT.doSplit(); ok(!(P.working.parts || []).length, "3a: doSplit 거부(파트 없음)");
    DLT.deleteSelected();
    // (b) 옆선 → V 다리(가까운 쪽)에서 끝나는 선 → 분리 · V 는 실제 외곽 그대로
    const good = drawCut([{ x: xs[0], y }, { x: xs[1], y }], { alt: true });
    ok(/^분리 가능/.test(status()) && splitBtnOn(), "3b: V 다리에서 끝나는 선 = 분리 가능 (" + status() + ")");
    DLT.doSplit(); const parts = P.working.parts || [];
    ok(parts.length === 2, "3b: 두 파트 (" + splitNote() + ")");
    if (parts.length === 2) {
      const hasApex = pt => pt.outline.some(s => D(s.to, V.apex) < 1e-9 || D(s.from, V.apex) < 1e-9);
      ok(parts.filter(hasApex).length === 1, "3b: V 꼭짓점은 한 파트에만 그대로(봉합·제거 없음)");
      const vp = parts.filter(hasApex)[0], legs = vp.outline.filter(s => s.kind === "line" && (D(s.to, V.apex) < 1e-9 || D(s.from, V.apex) < 1e-9));
      ok(legs.length === 2, "3b: V 꼭짓점에 다리 두 직선이 남음(열린 V = 실제 외곽)");
      ok(parts.every(pt => !pt.outline.some(s => (g.construction || []).some(c => c.kind === "line" && D(s.from, c.from) < 1e-9 && D(s.to, c.to) < 1e-9))), "3b: 제도선(construction)으로 봉합한 구간 없음");
      verifyParts("3b", parts, g, "sleeve", [good.segments[0].from, good.segments[0].to]);
    }
  }
  DLT.setMode("off");
}

// §4 물리 거부 — 유효 절개선 ≠ 분리 가능
{
  // Ⓥ: 뒤 조각 → 앞 조각을 잇는 선(외곽 사이 빈 곳만 지남 → validateCut 유효 · 분할 거부)
  const P = sleeveOn("V"); SC.complete(P);
  const g = P.working.geometry.sleeve, Lb = loopOf(primsOfPiece(g, "back"), 400), Lf = loopOf(primsOfPiece(g, "front"), 400);
  const cb = Lb.reduce((a, p) => ({ x: a.x + p.x / Lb.length, y: a.y + p.y / Lb.length }), { x: 0, y: 0 }), cf = Lf.reduce((a, p) => ({ x: a.x + p.x / Lf.length, y: a.y + p.y / Lf.length }), { x: 0, y: 0 });
  // 두 중심을 잇는 선이 각 조각 외곽을 나가는 점(가장 가까운 쪽) — 독립 계산
  const exitOn = (L, from, to) => { let best = null; for (let i = 1; i < L.length; i++) { const a = L[i - 1], b = L[i], r = { x: to.x - from.x, y: to.y - from.y }, s = { x: b.x - a.x, y: b.y - a.y }, den = r.x * s.y - r.y * s.x; if (Math.abs(den) < 1e-12) continue;
    const t = ((a.x - from.x) * s.y - (a.y - from.y) * s.x) / den, u = ((a.x - from.x) * r.y - (a.y - from.y) * r.x) / den; if (t >= 0 && t <= 1 && u >= 0 && u <= 1 && (!best || t < best.t)) best = { t, p: { x: from.x + t * r.x, y: from.y + t * r.y } }; } return best && best.p; };
  const pb = exitOn(Lb, cb, cf), pf = exitOn(Lf, cf, cb);
  ok(!!pb && !!pf, "4: Ⓥ 두 조각 경계 점 계산");
  if (pb && pf) {
    drawCut([pb, pf], { alt: true });
    const st = DLT.getSplitState();
    ok(/^유효 절개선 · 분리 불가: 절개선 양끝이 서로 다른 소매 조각/.test(status()) && !splitBtnOn() && st && st.allowed === false && st.kind === "physical",
      "4a: Ⓥ 두 조각을 잇는 선 = 유효 절개선이지만 분리 불가(서로 다른 조각) · 버튼·막대 비활성 (" + status() + ")");
    DLT.doSplit(); ok(!(P.working.parts || []).length && /서로 다른 소매 조각/.test(splitNote()), "4a: doSplit 거부 이유 표시 (" + splitNote() + ")");
  }
  DLT.setMode("off");
  // Ⓐ: 소매산 위 두 점을 잇되 소매 바깥으로 부푼 곡선 → 분리 거부(바깥)
  const Q = sleeveOn("A"); SC.complete(Q);
  const ga = Q.working.geometry.sleeve, La = loopOf(ga.outline, 400), ys = La.map(p => p.y), yTop = Math.min.apply(null, ys), yBot = Math.max.apply(null, ys);
  const y = yTop + (yBot - yTop) * 0.12, xs = hcrossings(La, y);
  ok(xs.length === 2, "4b: 소매산 높이 교차 2 (" + xs.length + ")");
  if (xs.length === 2) {
    const w = xs[1] - xs[0];
    const k = (y - yTop) + 10;   // 소매산 쪽(위)으로 두 끝에서 곧게 올라갔다 돌아오는 곡선: c1 = 시작 + h0 · c2 = 끝 − h1 → 둘 다 소매산 꼭대기 위(바깥)
    drawCut([{ x: xs[0], y }, { x: xs[1], y }], { handles: [{ x: 0, y: -k }, { x: 0, y: k }], alt: true });
    const v = DLT.validateSelectedCut();
    ok(v && v.ok === true && v.ready === false && v.kind === "physical" && v.code === "outside" && !splitBtnOn(), "4b: 바깥을 지나는 곡선 = 유효 선이지만 분리 불가(바깥) (" + status() + ")");
    DLT.doSplit(); ok(!(Q.working.parts || []).length, "4b: doSplit 거부(파트 없음)");
  }
  DLT.setMode("off");
  // 끝점이 외곽 밖
  const hc = hcut(ga, null, 0.6);
  drawCut([hc.a, { x: (hc.a.x + hc.b.x) / 2, y: hc.a.y }], { alt: true });
  ok(/끝점이 외곽선에 연결되지 않음/.test(status()) && !splitBtnOn() && DLT.getSplitState().kind === "invalid", "4c: 끝점이 소매 안쪽 = 무효(이유) · 분리 비활성 (" + status() + ")");
  DLT.setMode("off");
  // 순수 엔진: 끊긴 외곽 · 갈래 · 여러 고리 → 숨기지 않고 사유
  const L = (a, b) => ({ kind: "line", from: { x: a[0], y: a[1] }, to: { x: b[0], y: b[1] } });
  const sq = [L([0, 0], [10, 0]), L([10, 0], [10, 10]), L([10, 10], [0, 10]), L([0, 10], [0, 0])];
  const cutSq = [{ kind: "line", from: { x: 0, y: 5 }, to: { x: 10, y: 5 } }];
  ok(SS.splitSleeve({ outline: sq }, cutSq).ok === true, "4d: 닫힌 사각 소매 = 분리(대조)");
  const gap = SS.splitSleeve({ outline: [L([0, 0], [10, 0]), L([10, 0], [10, 10]), L([10, 10], [0, 10]), L([0, 10], [0, 0.5])] }, cutSq);
  ok(!gap.ok && gap.code === "ring" && /끊김 1곳/.test(gap.reason), "4d: 외곽 끊김 = «소매 외곽 형태 미지원: 외곽선 끊김» (" + gap.reason + ")");
  const fork = SS.splitSleeve({ outline: sq.concat([L([10, 10], [15, 15])]) }, cutSq);
  ok(!fork.ok && fork.code === "ring", "4d: 외곽 갈래/끊김 = 형태 미지원 사유 (" + fork.reason + ")");
  const two = SS.splitSleeve({ outline: sq.concat([L([20, 0], [30, 0]), L([30, 0], [30, 10]), L([30, 10], [20, 10]), L([20, 10], [20, 0])]) }, cutSq);
  ok(!two.ok && two.code === "ring" && /여러 고리/.test(two.reason), "4d: 태그 없는 두 고리 = «여러 고리» 사유 (" + two.reason + ")");
  const outside = SS.splitSleeve({ outline: sq }, [{ kind: "cubic", from: { x: 0, y: 5 }, c1: { x: -6, y: 5 }, c2: { x: -6, y: 8 }, to: { x: 0, y: 8 } }]);
  ok(!outside.ok && (outside.code === "outside" || outside.code === "invalid"), "4d: 바깥으로 도는 선 거부 (" + outside.reason + ")");
}

// §5 현재성 · 무효화
{
  const P = sleeveOn("C");
  const g = P.working.geometry.sleeve, hc = hcut(g, null, 0.3);
  // (a) 소매 완료 전(2026-11-06 김님 «완료는 마지막 한 번») = 현재 형상 기준 분리 가능 · 사용자 완료본은 만들지 않음
  const line = drawCut([hc.a, hc.b]);
  ok(/^분리 가능 — 소매 Ⓒ 현재 형상 기준/.test(status()) && splitBtnOn() && !P.working.sleeveResult, "5a: 완료 전 = 현재 형상 기준 분리 가능 · sleeveResult 없음 (" + status() + ")");
  const st = DLT.getSplitState(); ok(st && st.allowed && st.kind === "ok", "5a: 막대 = 같은 판정(분리 가능) (" + (st && st.reason) + ")");
  DLT.doSplit(); ok((P.working.parts || []).length === 2 && DLT.visibleParts(P).length === 2 && !P.working.sleeveResult, "5a: 완료 없이 분리 2파트 · sleeveResult 그대로 없음 (" + splitNote() + ")");
  // (b) 완료 → 같은 형상 = 같은 hash → 파트 결속 유지(완료가 세션 미리보기를 끊지 않음)
  const pH = P.working.parts[0].sourceSleeveHash;
  SC.complete(P); DLT.syncCutStatus();
  ok(splitBtnOn() && P.working.sleeveResult.hash === pH && DLT.visibleParts(P).length === 2, "5b: 완료 뒤 같은 hash · 파트 유지 (" + status() + ")");
  DLT.doSplit(); ok((P.working.parts || []).length === 2 && DLT.visibleParts(P).length === 2, "5b: 분리 2파트");
  // (c) 입력 변경(소매길이) → 낡은 파트 숨김·제거 · 재완료 이유
  API("C").apply(P, changedOf("C"));
  ok(DLT.visibleParts(P).length === 0, "5c: 소매 입력 변경 → 파트가 현재 결과로 보이지 않음");
  const bs0 = BARSYNC; DLT.syncCutStatus();
  ok(!(P.working.parts || []).some(q => q.sourcePiece === "sleeve"), "5c: 동기화 때 낡은 소매 파트 제거(prune)");
  ok(BARSYNC > bs0 && DLT.getSplitState() && DLT.getSplitState().parts === 0, "5c: 판정이 바뀌면 막대도 즉시 동기화(이전 파트 «분리됨» 안 남김)");
  ok(SC.isCurrentSleeveChanged(P) === true && (splitBtnOn() ? /현재 형상 기준/.test(status()) : /외곽선|분리 불가/.test(status())), "5c: 새 형상 기준으로 재판정 · 이전 완료본 = 변경됨 (" + status() + ")");
  // (d) 새 형상으로 다시 분리(완료 불필요 · 선이 여전히 유효하면) — 파트 출처 = 새 형상(이전 완료본 hash 아님)
  const okAgain = splitBtnOn(); ok(okAgain || /외곽선/.test(status()), "5d: 새 형상 기준 판정 (" + status() + ")");
  if (okAgain) { DLT.doSplit(); ok(DLT.visibleParts(P).length === 2 && P.working.parts[0].sourceSleeveHash !== P.working.sleeveResult.hash, "5d: 재분리 2파트 · 출처 = 새 형상"); }
  // (e) 몸판 변경(다른 몸판 프리셋으로 재완료) → 출처 불일치 → 숨김
  setBodice(P, "B");
  ok(DLT.visibleParts(P).length === 0, "5e: 몸판 변경 → 소매 파트 숨김");
  DLT.syncCutStatus(); ok(!splitBtnOn() && /보류/.test(status()), "5e: 몸판 변경 = 분리 보류 + 재완료 이유 (" + status() + ")");
}
{
  // (f) 선 수정(앵커 이동) — invalidateParts 경로 없이 직접 바꿔도 서명 불일치로 숨김
  const P = sleeveOn("A"); SC.complete(P);
  const hc = hcut(P.working.geometry.sleeve, null, 0.5), line = drawCut([hc.a, hc.b]);
  DLT.doSplit(); ok(DLT.visibleParts(P).length === 2, "5f: 분리");
  DLT.moveAnchor(line, 1, 0, 0.3);
  ok(DLT.visibleParts(P).length === 0 && DLT.getSplitState().parts === 0, "5f: 선 좌표가 바뀌면 파트는 현재 결과 아님(서명)");
  DLT.moveAnchor(line, 1, 0, -0.3);
  // (g) 역할 전환(절개선 → 보조선) → 파트 제거(종전 invalidateParts) · 분리 행 없음
  DLT.doSplit(); ok(DLT.visibleParts(P).length === 2, "5g: 다시 분리");
  DLT.setRole("guide");
  ok(!(P.working.parts || []).length && DLT.getSplitState() === null, "5g: 보조선으로 바꾸면 파트 제거 · 분리 판정 없음");
  DLT.setRole("cut");
  // (h) 차단: 적용 차단 상태 → 판정 보류(이전 형상으로 판정·분리하지 않음)
  DLT.doSplit(); ok(DLT.visibleParts(P).length === 2, "5h: 다시 분리");
  P.working.sleeveA.blocked = { reason: "invalid-input", text: "소매길이 범위 밖" };
  ok(DLT.visibleParts(P).length === 0, "5h: 차단 → 파트 숨김");
  DLT.syncCutStatus();
  ok(/^판정 보류: 소매 Ⓐ 적용이 차단됨\(소매길이 범위 밖\)/.test(status()) && !splitBtnOn(), "5h: 차단 = «판정 보류» + 차단 이유 (" + status() + ")");
  P.working.sleeveA.blocked = null;
  // (i) 다른 소매로 전환(완료 안 함) → «완료된 소매는 Ⓐ, 현재 소매는 Ⓑ»
  P.working.sleeveA = null; API("B").apply(P, defaultsOf("B")); DLT.syncCutStatus();
  ok(DLT.visibleParts(P).length === 0 && SC.isCurrentSleeveChanged(P) === true && (splitBtnOn() ? /^분리 가능 — 소매 Ⓑ 현재 형상 기준/.test(status()) : /외곽선|분리 불가/.test(status())), "5i: 소매 전환 = 이전 Ⓐ 파트 숨김 · Ⓑ 현재 형상 기준 판정 (" + status() + ")");
  DLT.setMode("off");
}

// §6 관리형 소매산 선 — 역할 잠금 그대로
{
  const P = sleeveOn("A"); SC.complete(P);
  const g = P.working.geometry.sleeve, hc = hcut(g, null, 0.5);
  P.working.patternLines.push({ id: "line-90", piece: "sleeve", role: "boundary", managedBy: "sleeve-cap", splitAnchorIndex: 1, segments: [{ kind: "line", from: hc.a, to: hc.b }] });
  DLT.setMode("off"); DLT.toggleSelect(); click("sleeve", { x: (hc.a.x + hc.b.x) / 2, y: hc.a.y });
  ok(DLT.getSelectedId() === "line-90", "6: 관리선 선택");
  DLT.setRole("cut");
  ok(DLT.findLine("line-90").role === "boundary" && /소매산 관리선은 역할을 바꿀 수 없습니다/.test(el("designLineNote").textContent) && el("btnRoleCut").disabled === true, "6: 관리선 «절개선» 거부 · 역할 버튼 잠금");
  DLT.doSplit(); ok(!(P.working.parts || []).length, "6: 관리선으로 분리 안 됨");
  DLT.setMode("off");
}

// §7 몸판 파트 분리 보존 · 한 쌍 교체
{
  const P = sleeveOn("A"); SC.complete(P);
  const fo = DLT.flattenLine(DLT.outlinePrimsToSegs(P.working.geometry.front.outline)), legs = (P.working.geometry.front.construction || []).filter(c => c.kind === "line").map(c => ({ from: c.from, to: c.to }));
  const ring = DLT.buildPieceRing(DLT.outlinePrimsToSegs(P.working.geometry.front.outline), legs).ring;
  let fc = null; for (let y = 8; y < 40 && !fc; y += 0.5) { const xs = []; fo.forEach(([a, b]) => { if ((a.y - y) * (b.y - y) < 0) xs.push(a.x + (b.x - a.x) * (y - a.y) / (b.y - a.y)); }); xs.sort((p, q) => p - q);
    if (xs.length !== 2) continue; const sg = [{ kind: "line", from: { x: xs[0], y }, to: { x: xs[1], y } }]; if (DLT.validateCut({ role: "cut", segments: sg }, fo, []).ok && DLT.splitRingByCut(ring, sg).ok) fc = sg[0]; }
  ok(!!fc, "7: 앞판 시험 선");
  DLT.setMode("off"); DLT.toggle(); click("front", fc.from, { altKey: true }); click("front", fc.to, { altKey: true }); key("Enter"); DLT.setRole("cut");
  ok(status() === "분리 가능" && splitBtnOn(), "7: 앞판 절개선 «분리 가능»(종전 문구) (" + status() + ")");
  DLT.doSplit();
  ok((P.working.parts || []).length === 2 && P.working.parts.every(q => q.sourcePiece === "front") && DLT.visibleParts(P).length === 2, "7: 앞판 2파트(종전) · 표시");
  DLT.setMode("off");
  const hc = hcut(P.working.geometry.sleeve, null, 0.5); drawCut([hc.a, hc.b]); DLT.doSplit();
  ok(P.working.parts.length === 2 && P.working.parts.every(q => q.sourcePiece === "sleeve"), "7: 소매 분리 = 마지막 한 쌍으로 교체(종전 계약)");
  DLT.setMode("off");
  // 파생 몸판 맥락: 몸판 파트는 숨김(종전) · 소매 파트는 출처 결속으로 표시
  const R = sleeveOn("R"); SC.complete(R);
  R.working.parts = [{ id: "part-1", sourcePiece: "front", sourceCutId: "x", outline: [] }, { id: "part-2", sourcePiece: "front", sourceCutId: "x", outline: [] }];
  ok(DLT.visibleParts(R).length === 0, "7: Ⓡ 파생 몸판 맥락 = 몸판 파트 숨김(종전)");
  const hr = hcut(R.working.geometry.sleeve, null, 0.5); drawCut([hr.a, hr.b]); DLT.doSplit();
  ok(DLT.visibleParts(R).length === 2 && R.working.parts.every(q => q.sourcePiece === "sleeve"), "7: Ⓡ 소매 조각은 분리·표시 (" + splitNote() + ")");
  { const t0 = Date.now(); for (let k = 0; k < 20; k++) DLT.visibleParts(R); const ms = (Date.now() - t0) / 20;
    ok(ms < 20, "7: 표시 판정(visibleParts = 빠른 판정)은 render 마다 불러도 가볍다 — Ⓡ " + ms.toFixed(1) + "ms/회(전체 판정은 수백 ms)"); }
  DLT.setMode("off");
}

// §8 Design 완료/hash — 소매 절개선·파트 비포함(기존 계약)
{
  const P = sleeveOn("C"); SC.complete(P); setCollar(P); CC.complete(P);
  const d0 = DR.complete(P); ok(d0.ok, "8: designResult 완료");
  const h0 = d0.ok ? d0.result.hash : null;
  const hc = hcut(P.working.geometry.sleeve, null, 0.5); drawCut([hc.a, hc.b]); DLT.doSplit();
  ok((P.working.parts || []).length === 2, "8: 소매 분리");
  ok(DR.isCurrentDesignChanged(P) === false, "8: 소매 절개선·파트는 Design «변경됨»을 만들지 않음(structuralLines = 앞·뒤판 절개선만)");
  const d1 = DR.complete(P); ok(d1.ok && d1.result.hash === h0 && d1.result.structuralLines.cut.every(c => c.piece === "front" || c.piece === "back"), "8: 재완료 hash 동일 · 소매 절개선 비포함");
  DLT.setMode("off");
}

console.log("══════════════════════════════════════════════");
fails.forEach(f => console.log("  ✗ " + f));
console.log("결과: " + PASS + " PASS / " + FAIL + " FAIL");
process.exitCode = FAIL ? 1 : 0;
