// ══════════════════════════════════════════════
// cutEditFinalBodiceCheck.js — 몸판 탭 절개선 편집 ↔ Design 완료 판정의 **같은 현재 몸판** 정합(2026-11-04 김님 승인 «최종 몸판 기준 절개선 편집 정합성»).
//   designResult 는 이미 «최종 몸판»(완료 소매 derivedBodice ∥ bodiceResult)으로 절개선을 재검증한다(sleeveIntegrationCheck §7).
//   이 검사는 그 앞단 — 입력 좌표 → 표시 외곽 → snap → 상태 문구(#designCutStatus) → 분리 버튼/실제 분리 — 가 같은 형상을 보는지를
//   **designLineTool 의 실제 포인터·키 핸들러**(svg/document 리스너를 그대로 등록해 호출)로 본다. 합성 좌표는 피스 offset·배율을 거친 도안 cm 이다.
//   §1 원래 몸판 맥락(몸판만 · 소매 Ⓐ): 종전 판정·문구·snap·파트 분리 그대로
//   §2 파생 몸판 맥락(Ⓡ~Ⓩ 9종 · 대표 T/U/V/X/Y/Z 포함): 파생 외곽에만 닿는 선을 snap 으로 새로 그림 → 유효 · designResult 포함 · 분리 버튼 비활성/실행 거부 ·
//        원래에서만 맞는 선 → «최종 몸판 불일치» = designResult 거부 · 작성 중 → 제외 · 앵커 이동 snap → 파생 외곽 · hash 무효화 · 레이아웃 이동·줌 좌표 일치
//   §3 판정 보류: 소매 입력 변경(미완료) · 차단 · 다른 소매로 전환(미완료) → «판정 보류» + 재완료 이유 · snap = 화면 형상 · 재완료 뒤 복귀
//   §4 파트 미리보기: 원래 몸판에서 자른 파트는 파생 몸판 맥락에서 그리지 않음(데이터 보존 · 원래로 돌아오면 다시) — render.js 배선
//   §5 불변: 원형·bodiceResult·sleeveResult(완료본) 편집 중 무변경
//   node test/harness/cutEditFinalBodiceCheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");

let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
const J = JSON.stringify;
const ROOT = path.join(__dirname, "..", "..");
const SYMS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

let PROJECT = null;
// DOM 최소 stub: getElementById 는 같은 id 에 같은 객체(문구·disabled·속성 확인용). svg/document 리스너는 등록 파일별로 모은다.
const ELS = {};
function el(id) { if (!ELS[id]) ELS[id] = { id, textContent: "", disabled: false, attrs: {}, setAttribute(k, v) { this.attrs[k] = String(v); }, removeAttribute(k) { delete this.attrs[k]; }, getAttribute(k) { return this.attrs[k]; } }; return ELS[id]; }
let LOADING = null; const SVG_H = {}, DOC_H = {};
const sb = { window: {}, console: { log() {}, warn() {} }, Math, JSON, Object, Array, isFinite, structuredClone, Error, Date, Promise,
  c2p: (x, y) => [x * 10, y * 10], SC: 10, viewZ: 1,
  eventToPatternPoint: e => [e.px, e.py],
  svg: { addEventListener(t, f) { (SVG_H[LOADING + ":" + t] = SVG_H[LOADING + ":" + t] || []).push(f); }, setPointerCapture() {}, releasePointerCapture() {} },
  document: { createElementNS: () => ({ setAttribute() {}, appendChild() {} }), getElementById: el,
    addEventListener(t, f) { (DOC_H[LOADING + ":" + t] = DOC_H[LOADING + ":" + t] || []).push(f); } } };
sb.globalThis = sb; vm.createContext(sb);
sb.window.designWorkflow = { current: () => PROJECT };
sb.window.isDesignStageActive = () => true;
sb.window.addEventListener = () => {};
let NOTIFY = 0; sb.window.refreshDesignResultUI = () => { NOTIFY++; };
const files = ["designLineTool.js", "designFlare.js", "designJoin.js", "designWaistSeam.js", "designYokeSeam.js", "designPrincess.js", "designBodice.js", "bodicePresets.js",
  "designLayout.js", "designRenderer.js", "bodiceCheckpoint.js", "peplumAnnotation.js", "designSleeve.js", "sleeveMeasure.js", "sleeveCheckpoint.js", "sleevePresets.js"];
SYMS.forEach(k => { if (fs.existsSync(path.join(ROOT, "js", "designSleeve" + k + ".js"))) files.push("designSleeve" + k + ".js"); files.push("sleeve" + k + "Apply.js"); });
files.push("sleeveAnnotation.js", "designCollar.js", "collarCheckpoint.js", "designResult.js");
files.forEach(f => { LOADING = f; vm.runInContext(fs.readFileSync(path.join(ROOT, "js", f), "utf8"), sb, { filename: f }); });
LOADING = null;
const UI_SRC = fs.readFileSync(path.join(ROOT, "js", "ui.js"), "utf8");
const CLEAR_SRC = (() => { const i = UI_SRC.indexOf("function clearOtherSleeveLines(project, keep) {"); if (i < 0) return null; const j = UI_SRC.indexOf("\n  }\n", i); return j < 0 ? null : UI_SRC.slice(i, j + 4); })();
if (CLEAR_SRC) vm.runInContext("var window = this.window;\n" + CLEAR_SRC + "\nthis.__clearOtherSleeveLines = clearOtherSleeveLines;", sb, { filename: "ui.js#clearOtherSleeveLines" });
const W = sb.window, DB = W.designBodice, BP = W.bodicePresets, BC = W.bodiceCheckpoint, SC = W.sleeveCheckpoint, SP = W.sleevePresets,
  DC = W.designCollar, CC = W.collarCheckpoint, DR = W.designResult, DLT = W.designLineTool, DLy = W.designLayout, SA = W.sleeveAnnotation;
const clearOthers = sb.__clearOtherSleeveLines;
const T0 = Date.now(), TT = {}; const lap = k => { TT[k] = Date.now(); };
const API = s => W["sleeve" + s + "Apply"];
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));
const REF_J = J(REF);
const bodicePreset = sym => { for (const f of BP.families()) for (const v of f.variants) if (v.symbol === sym && v.presetId) return v.presetId; return null; };
function projectOn(bodiceSym) {
  const body = BP.bodyParams(bodicePreset(bodiceSym));
  PROJECT = { sourceBlock: { id: "blk", version: 2, schemaVersion: 8, canonicalHash: "abc" }, referenceGeometry: JSON.parse(REF_J),
    working: { geometry: DB.computeGeometry(REF, { body }), parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body }, patternLines: [], designOutline: null, frontPlacket: null } };
  BC.complete(PROJECT);
  PROJECT.working.layout = { front: { dx: 40, dy: 5 }, back: { dx: 0, dy: 5 }, sleeve: { dx: 80, dy: 5 }, collar: { dx: 0, dy: 70 } };   // 피스마다 다른 offset — 좌표 역변환을 실제로 거친다
  DLy.ensureLayout(PROJECT);
  return PROJECT;
}
const STAND_P = { bandWidthCm: 3, frontRiseCm: 1.5, frontEndCm: 0.5 }, BODY_P = { gapCm: 3, cbWidthCm: 4, frontProjectionCm: 1.5, pointDiagonalCm: 6, outerBowCm: 0 };
function setCollar(P) {
  const b = P.working.bodiceResult, stand = DC.computeStand(b, STAND_P), body = DC.computeBody(stand, BODY_P);
  P.working.collarDraft = { sourceBodiceHash: b.hash, type: "shirt-two-piece", parameters: { stand: Object.assign({}, STAND_P) },
    standGeometry: stand.standGeometry, body: { parameters: Object.assign({}, BODY_P), geometry: body.bodyGeometry, attachLenCm: body.attachLenCm, measure: body.measure } };
  P.working.collarResult = null;
}
const UI_DEFAULT_LEN = 52;
function defaultsOf(sym) { const rec = SP.get("bunka-sleeve-" + sym), o = {}; rec.inputs.forEach(i => { if (typeof i.defaultValue === "number") o[i.key] = i.defaultValue; else if (i.key === "sleeveLengthCm") o[i.key] = UI_DEFAULT_LEN; }); return o; }
function changedOf(sym) { const p = defaultsOf(sym); if (p.sleeveLengthCm !== undefined) p.sleeveLengthCm += (p.sleeveLengthCm < 15 ? 1 : 2); else { const k = Object.keys(p)[0]; p[k] = p[k] * 1.05; } return p; }
const doneAll = P => { const s = SC.complete(P); setCollar(P); return s.ok && CC.complete(P).ok; };

// ── 실제 핸들러 호출(designLineTool 이 등록한 것만) ──
const H = t => (SVG_H["designLineTool.js:" + t] || []);
const KD = () => (DOC_H["designLineTool.js:keydown"] || []);
let CLX = 0;
function evAt(pc, geo, extra) {   // 형상 cm → 도안 cm(피스 offset) 이벤트. target.closest 는 그 피스 hit layer.
  const L = DLy.ensureLayout(PROJECT), off = L[pc] || { dx: 0, dy: 0 };
  CLX += 100;   // 매번 멀리 → 수동 더블클릭으로 오인되지 않게
  return Object.assign({ button: 0, pointerId: 1, clientX: CLX, clientY: 0, altKey: false, shiftKey: false, px: geo.x + off.dx, py: geo.y + off.dy,
    target: { closest: () => ({ getAttribute: () => pc }) }, stopPropagation() {}, preventDefault() {} }, extra || {});
}
const down = e => H("pointerdown").forEach(f => f(e)), move = e => H("pointermove").forEach(f => f(e)), up = e => H("pointerup").forEach(f => f(e));
const key = k => KD().forEach(f => f({ key: k, target: {}, preventDefault() {} }));
function drawLine(pc, geos) {   // 그리기 모드: 클릭 n번 + Enter. 반환 = 새 선
  DLT.setMode("draw");
  const n0 = PROJECT.working.patternLines.length;
  geos.forEach(g => { const e = evAt(pc, g); down(e); up(e); });
  key("Enter");
  DLT.setMode("off");
  const ls = PROJECT.working.patternLines; return ls.length === n0 + 1 ? ls[ls.length - 1] : null;
}
function selectLine(line) {   // 선택 모드: 선 중간 클릭
  DLT.setMode("select");
  const a = line.segments[0].from, b = line.segments[line.segments.length - 1].to;
  down(evAt(line.piece, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })); up(evAt(line.piece, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }));
  return DLT.getSelectedId() === line.id;
}
function dragAnchor(line, k, toGeo, alt) {   // 선택된 선의 anchor k 를 끈다(실제 down→move→up)
  const as = DLT.anchorsFromSegments(line.segments), a = as[k];
  down(evAt(line.piece, a)); move(evAt(line.piece, toGeo, { altKey: !!alt })); up(evAt(line.piece, toGeo, { altKey: !!alt }));
}
const statusEl = () => el("designCutStatus"), splitBtn = () => el("btnDesignSplit"), splitNote = () => el("designSplitNote");

// ── 기하 도우미(독립) ──
const flat = outline => DLT.flattenLine(DLT.outlinePrimsToSegs(outline));
const dist = (p, fl) => DLT.distPtToSegs(p, fl);
function hcross(fl, y) { const xs = []; fl.forEach(([a, b]) => { if ((a.y - y) * (b.y - y) < 0) xs.push(a.x + (b.x - a.x) * (y - a.y) / (b.y - a.y)); }); return xs.sort((p, q) => p - q); }
function vcross(fl, x) { const ys = []; fl.forEach(([a, b]) => { if ((a.x - x) * (b.x - x) < 0) ys.push(a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x)); }); return ys.sort((p, q) => p - q); }
// 파생 외곽에만 닿는 수평/수직 직선(파생에서 유효 · 원래에서 무효 · 한 끝이 원래 외곽에서 떨어짐)을 찾는다.
function derivedOnlyLine(dPiece, oPiece) {
  const fd = flat(dPiece.outline), fo = flat(oPiece.outline);
  let bb = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity }; fd.forEach(([a]) => { bb.x0 = Math.min(bb.x0, a.x); bb.x1 = Math.max(bb.x1, a.x); bb.y0 = Math.min(bb.y0, a.y); bb.y1 = Math.max(bb.y1, a.y); });
  const tries = [];
  for (let t = 0.04; t < 0.97; t += 0.015) { tries.push(["h", bb.y0 + (bb.y1 - bb.y0) * t, t]); tries.push(["v", bb.x0 + (bb.x1 - bb.x0) * t, t]); }
  tries.sort((a, b) => Math.abs(a[2] - 0.5) - Math.abs(b[2] - 0.5));   // 조각 가운데쪽부터(외곽을 스치는 선을 피한다)
  for (const [dir, c] of tries) {
    const xs = dir === "h" ? hcross(fd, c) : vcross(fd, c); if (xs.length !== 2 || xs[1] - xs[0] < 5) continue;
    const p0 = dir === "h" ? { x: xs[0], y: c } : { x: c, y: xs[0] }, p1 = dir === "h" ? { x: xs[1], y: c } : { x: c, y: xs[1] };
    const ln = { role: "cut", segments: [{ kind: "line", from: p0, to: p1 }] };
    if (!DLT.validateCut(ln, fd, []).ok || DLT.validateCut(ln, fo, []).ok) continue;
    const far = [p0, p1].map(p => dist(p, fo));
    if (Math.max(far[0], far[1]) < 1.0) continue;   // 적어도 한 끝은 원래 외곽에서 1cm 이상 — 원래 외곽 snap 으로는 닿지 않는 자리
    const q = t => ({ x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t });
    if ([0.3, 0.5, 0.7].some(t => dist(q(t), fd) < 1.5)) continue;   // 선 안쪽이 외곽에서 충분히 떨어짐(드래그 snap 이 외곽으로 끌려가지 않게)
    return { p0, p1, far };
  }
  return null;
}
// 원래 몸판에서만 맞는 선: 어깨 중점 → 같은 x 의 밑단(보고 사례 · sleeveIntegrationCheck §7 과 같은 선)
const ends = s => s.kind === "line" ? [s.from, s.to] : [s.commands[0].points[0], s.commands[s.commands.length - 1].points[s.commands[s.commands.length - 1].points.length - 1]];
function origOnlyPts(b, pc) {
  const sh = b[pc].outline.find(s => s.edge === "shoulder"), hem = b[pc].outline.find(s => s.edge === "hem");
  const [s0, s1] = ends(sh), mid = { x: (s0.x + s1.x) / 2, y: (s0.y + s1.y) / 2 }, [h0, h1] = ends(hem), hy = h0.y + (h1.y - h0.y) * ((mid.x - h0.x) / (h1.x - h0.x));
  return [mid, { x: mid.x, y: hy }];
}
// 종전 snap 공식(working geometry 의 outline·construction 끝점 + 외곽 · 배율 SC·viewZ) — 독립 재구성
function origSnap(g, pc, cur, anchors) {
  const keys = pc === "front" ? ["front", "shared"] : [pc], pts = [], segs = [];
  keys.forEach(k => { const bk = g[k]; if (!bk) return; ["outline", "construction"].forEach(rl => (bk[rl] || []).forEach(pr => { if (pr.kind === "line") { pts.push(pr.from); pts.push(pr.to); } else if (pr.kind === "path") pr.commands.forEach(c => { if (c.type === "M") pts.push(c.points[0]); else if (c.type === "C") pts.push(c.points[c.points.length - 1]); }); })); DLT.outlinePrimsToSegs(bk.outline).forEach(x => segs.push(x)); });
  return DLT.chooseSnap(cur, { anchors: anchors, endpoints: pts, outlineSegs: segs }, 8 / (sb.SC * sb.viewZ), 0.5);
}
function splittableFront(g) {   // 다트를 가로지르지 않는 앞판 수평선(순수 ring 분할로 고른다)
  const fo1 = flat(g.front.outline), legs = (g.front.construction || []).filter(c => c.kind === "line").map(c => ({ from: c.from, to: c.to }));
  const ring = DLT.buildPieceRing(DLT.outlinePrimsToSegs(g.front.outline), legs).ring;
  for (let y = 8; y < 40; y += 0.5) { const xs = hcross(fo1, y); if (xs.length !== 2) continue; const sg = [{ kind: "line", from: { x: xs[0], y }, to: { x: xs[1], y } }];
    if (DLT.validateCut({ role: "cut", segments: sg }, fo1, []).ok && DLT.splitRingByCut(ring, sg).ok) return [sg[0].from, sg[0].to]; }
  return [null, null];
}
const keyOfSegs = (pc, segs) => pc + ":" + J(segs);
const inCuts = (c, line) => (c._cuts || []).some(x => keyOfSegs(x.piece, x.segments) === keyOfSegs(line.piece, line.segments));
const inRejects = (c, line) => (c.cutRejects || []).some(r => r.lineId === line.id);
const nudge = (p, d) => ({ x: p.x + d, y: p.y - d * 0.7 });
const same = (a, b) => !!a && !!b && Math.hypot(a.x - b.x, a.y - b.y) < 1e-9;   // 도안 cm ↔ 형상 cm 왕복(피스 offset 더하고 빼기) ulp 허용

// §1 원래 몸판 맥락 — 종전 동작 보존(몸판만 · 소매 Ⓐ 완료)
{
  ["none", "A"].forEach(sl => {
    const P = projectOn("A"); if (sl === "A") { API("A").apply(P, defaultsOf("A")); doneAll(P); }
    const b = P.working.bodiceResult;
    ok(DLT.editBodiceRef(P).source === "original" && DLT.isOriginalBodiceContext(P) === true, "1 " + sl + ": 편집 기준 = 원래 몸판");
    // snap = 종전 공식(working geometry 의 끝점·외곽)
    const g = P.working.geometry, cur = { x: 10.3, y: 20.2 };
    ok(J(DLT.snapForCursor(cur, "front", false, null)) === J(origSnap(g, "front", cur, [])), "1 " + sl + ": snap = 종전 working geometry 기준");
    // 선 그리기(snap) → 절개선 → 문구 «분리 가능» · 분리 버튼 활성 · 실제 분리 → 파트 2. 다트를 가로지르지 않는 수평선(순수 ring 분할로 미리 고른다).
    const [m, h] = splittableFront(g);
    ok(!!m, "1 " + sl + ": 분리 가능한 시험 선 찾음");
    const line = drawLine("front", [nudge(m, 0.1), nudge(h, 0.1)]);
    ok(!!line && dist(line.segments[0].from, flat(b.front.outline)) < 1e-6 && dist(line.segments[0].to, flat(b.front.outline)) < 1e-6, "1 " + sl + ": 새 선 두 끝이 원래 외곽에 흡착");
    ok(selectLine(line), "1 " + sl + ": 선 클릭 선택");
    DLT.setRole("cut");
    ok(statusEl().textContent === "분리 가능" && statusEl().attrs["data-ok"] === "1" && !("data-basis" in statusEl().attrs) && splitBtn().disabled === false, "1 " + sl + ": 문구 «분리 가능» · 분리 버튼 활성 (" + statusEl().textContent + ")");
    DLT.doSplit();
    ok((P.working.parts || []).length === 2 && /분할 완료/.test(splitNote().textContent), "1 " + sl + ": 실제 분리 2 파트 (" + splitNote().textContent + ")");
    if (sl === "A") { const c = DR.check(P); ok(c.ok && inCuts(c, line), "1 A: designResult 에 같은 선 포함"); }
    // 앵커를 외곽에서 떼면 문구가 즉시 바뀐다(드래그 끝 재판정)
    dragAnchor(line, 0, { x: m.x + (h.x - m.x) * 0.3, y: m.y + 0.2 }, true);   // 외곽에서 뗀 안쪽(Alt = snap 해제)
    ok(statusEl().textContent === "시작점이 외곽선에 연결되지 않음" && splitBtn().disabled === true && (P.working.parts || []).length === 0, "1 " + sl + ": 앵커 이동 뒤 문구·버튼·파트 즉시 갱신 (" + statusEl().textContent + ")");
    DLT.setMode("off");
  });
}

lap("s1");
// §2 파생 몸판 맥락(Ⓡ~Ⓩ)
const SUMMARY = [];
let anySnapOrig = false;
const FULL = "TUVXYZ";   // 대표(뒤 다트 construction T/U · 절단된 래글런 V · 일체형 X·Y·Z) = 전 과정 · R·S·W = 기준·표시·snap·상태까지
"RSTUVWXYZ".split("").forEach(sym => {
  const P = projectOn("A");
  const r = API(sym).apply(P, defaultsOf(sym)); ok(r.ok, "2 " + sym + ": 적용");
  ok(doneAll(P), "2 " + sym + ": 소매·카라 완료");
  const sres = SC.latest(P), b = P.working.bodiceResult, bJ = J(b), sJ = J(sres), rJ = J(P.referenceGeometry);
  const ref = DLT.editBodiceRef(P);
  ok(ref.source === "sleeve-derived" && ref.fin.front === sres.derivedBodice.front && ref.fin.back === sres.derivedBodice.back, "2 " + sym + ": 편집 기준 = 완료 소매 파생 몸판(frozen 조각 그대로)");
  ok(["front", "back"].every(pc => J(DLT.displayedDerivedPiece(P, pc)) === J(sres.derivedBodice[pc])), "2 " + sym + ": 화면 파생 몸판 = 판정 형상(바이트 동일)");
  ok(DLT.isOriginalBodiceContext(P) === false, "2 " + sym + ": 원래 몸판 전용 동작(파트 분리) 꺼짐");
  // (a) 파생 외곽에만 닿는 새 선 — snap 으로 그림
  let pc = "front", dl = derivedOnlyLine(sres.derivedBodice.front, b.front);
  if (!dl) { pc = "back"; dl = derivedOnlyLine(sres.derivedBodice.back, b.back); }
  ok(!!dl, "2 " + sym + ": 파생 외곽에만 닿는 시험 선 찾음");
  if (!dl) return;
  const fd = flat(sres.derivedBodice[pc].outline), fo = flat(b[pc].outline);
  const s0 = DLT.snapForCursor(nudge(dl.p0, 0.12), pc, false, null), s1 = DLT.snapForCursor(nudge(dl.p1, 0.12), pc, false, null);
  ok(s0 && s1 && dist(s0.point, fd) < 1e-6 && dist(s1.point, fd) < 1e-6, "2 " + sym + ": snap 점이 파생 외곽 위");
  if (s0 && s1 && Math.max(dist(s0.point, fo), dist(s1.point, fo)) > 0.5) anySnapOrig = anySnapOrig || false; else anySnapOrig = true;
  const line = drawLine(pc, [nudge(dl.p0, 0.12), nudge(dl.p1, 0.12)]);
  ok(!!line && same(line.segments[0].from, s0.point) && same(line.segments[0].to, s1.point), "2 " + sym + ": 그린 선 anchor = snap 점(피스 offset 역변환 일치)");
  ok(selectLine(line), "2 " + sym + ": 선택"); DLT.setRole("cut");
  const t1 = statusEl().textContent, v1 = DLT.validateSelectedCut();
  ok(v1 && v1.ok && v1.state === "valid" && /^유효 절개선 — 소매 . 까지 반영한 최종 몸판 기준/.test(t1) && statusEl().attrs["data-ok"] === "1" && statusEl().attrs["data-basis"] === "sleeve-derived", "2 " + sym + ": 문구 «유효 · 최종 몸판 기준» (" + t1 + ")");
  ok(splitBtn().disabled === true, "2 " + sym + ": 분리 버튼 비활성(원래 몸판 전용)");
  if (FULL.indexOf(sym) < 0) { ok(J(P.working.bodiceResult) === bJ && J(SC.latest(P)) === sJ, "2 " + sym + ": 원본 불변"); SUMMARY.push(sym + "(" + pc + ")"); DLT.setMode("off"); return; }
  const partsBefore = J(P.working.parts || []); DLT.doSplit();
  ok(J(P.working.parts || []) === partsBefore && /원래 몸판 전용/.test(splitNote().textContent), "2 " + sym + ": 분리 실행 거부 · 파트 무변경 (" + splitNote().textContent + ")");
  let c = DR.check(P);
  ok(c.ok && inCuts(c, line) && !inRejects(c, line), "2 " + sym + ": designResult 판정 = 유효(포함) — 편집 문구와 같음");
  const d1 = DR.complete(P); ok(d1.ok && d1.result.structuralLines.cut.length === 1, "2 " + sym + ": Design 완료(절개선 1)");
  // (b) 원래 몸판에서만 맞는 선 — 편집 문구 «최종 몸판 불일치» = designResult 거부
  const [om, oh] = origOnlyPts(b, pc);
  const lo = { id: "orig-only", piece: pc, role: "cut", segments: [{ kind: "line", from: om, to: oh }] };
  const vo = (() => { const k = P.working.patternLines; P.working.patternLines = [lo]; const v = DLT.cutStatusOf(P, lo); P.working.patternLines = k; return v; })(), vfo = DLT.validateCut(lo, fd, []);
  const keepLines = P.working.patternLines; P.working.patternLines = [];   // 원래 전용 선만 둔다(다른 시험 선과 교차하지 않게 — 교차는 별도 사유)
  if (!vfo.ok) {
    P.working.patternLines.push(lo);
    ok(selectLine(lo) || DLT.getSelectedId() === "orig-only", "2 " + sym + ": 원래 전용 선 선택");
    const t2 = statusEl().textContent;
    c = DR.check(P);
    ok(/^최종 몸판 불일치: /.test(t2) && /원래 몸판에서는 맞던 선/.test(t2) && inRejects(c, lo) && c.fails.indexOf("cut-invalid-on-final-bodice") >= 0, "2 " + sym + ": 원래에서만 맞는 선 → 편집 «최종 몸판 불일치» = designResult 거부 (" + t2 + ")");
    ok(DR.isCurrentDesignChanged(P) === true && !DR.complete(P).ok && P.working.designResult === d1.result, "2 " + sym + ": 거부 · 기존 완료본 그대로");
  } else ok(vo.ok, "2 " + sym + ": 어깨 중점 선이 파생에서도 유효(이 소매는 그 자리가 같음)");
  P.working.patternLines = keepLines;
  // (c) 작성 중 선(둘 다에서 무효) — 문구 «작성 중» · designResult 제외(차단 아님)
  { const a = line.segments[0].from, z = line.segments[0].to, mid = { x: (a.x + z.x) / 2, y: (a.y + z.y) / 2 };
    const ld = { id: "draft-x", piece: pc, role: "cut", segments: [{ kind: "line", from: { x: mid.x + 0.4, y: mid.y + 1.0 }, to: { x: mid.x + 0.4, y: mid.y + 3.0 } }] };
    P.working.patternLines.push(ld); DLT.setMode("select"); down(evAt(pc, { x: mid.x + 0.4, y: mid.y + 2.0 })); up(evAt(pc, { x: mid.x + 0.4, y: mid.y + 2.0 }));
    const t3 = statusEl().textContent; c = DR.check(P);
    ok(DLT.getSelectedId() === "draft-x" && /^작성 중: /.test(t3) && !inCuts(c, ld) && !inRejects(c, ld) && c.ok, "2 " + sym + ": 작성 중 선 → «작성 중» · designResult 제외·차단 아님 (" + t3 + ")");
    P.working.patternLines = P.working.patternLines.filter(l => l.id !== "draft-x"); }
  ok(DR.isCurrentDesignChanged(P) === false, "2 " + sym + ": 시험 선 정리 뒤 완료본과 같음");
  // (d) 앵커 이동: 한 끝을 외곽 밖으로 → «작성 중» + hash 무효화 → 다시 파생 외곽으로 끌어 snap → 유효 · 같은 hash 로 복귀
  ok(selectLine(line), "2 " + sym + ": 다시 선택");
  const a0 = { x: line.segments[0].from.x, y: line.segments[0].from.y }, a1 = line.segments[0].to;
  const inner = { x: a0.x + (a1.x - a0.x) * 0.4, y: a0.y + (a1.y - a0.y) * 0.4 };
  dragAnchor(line, 0, inner, true);   // Alt = snap 해제(외곽에서 뗀 자리 그대로)
  ok(/^작성 중: 시작점이 외곽선에 연결되지 않음/.test(statusEl().textContent) && DR.isCurrentDesignChanged(P) === true, "2 " + sym + ": 앵커를 떼면 즉시 «작성 중» · Design 변경됨 (" + statusEl().textContent + ")");
  dragAnchor(line, 0, nudge(dl.p0, 0.12));
  ok(same(line.segments[0].from, s0.point) && /^유효 절개선/.test(statusEl().textContent), "2 " + sym + ": 앵커를 파생 외곽으로 다시 끌면 같은 snap 점 · 유효");
  { const d2 = DR.complete(P); ok(d2.ok && d2.result.structuralLines.cut.length === 1 && dist(d2.result.structuralLines.cut[0].segments[0].from, fd) < 1e-6, "2 " + sym + ": 고친 선으로 재완료(파생 외곽 위 앵커) · " + (d2.idempotent ? "같은 hash" : "새 hash")); }
  // (e) 레이아웃 이동·줌: 피스를 옮기고 배율을 바꿔도 같은 형상 점에 흡착(도안 cm ↔ 형상 cm)
  const L = DLy.ensureLayout(P); L[pc] = { dx: L[pc].dx + 17.5, dy: L[pc].dy - 6.25 }; sb.viewZ = 2.5;
  const s0b = DLT.snapForCursor(nudge(dl.p0, 0.05), pc, false, null);
  const ln2 = drawLine(pc, [nudge(dl.p0, 0.05), nudge(dl.p1, 0.05)]);
  ok(s0b && dist(s0b.point, fd) < 1e-6 && Math.hypot(s0b.point.x - s0.point.x, s0b.point.y - s0.point.y) < 0.2 && ln2 && same(ln2.segments[0].from, s0b.point) && dist(ln2.segments[0].to, fd) < 1e-6, "2 " + sym + ": 피스 이동 + 줌 2.5 → 같은 파생 외곽에 흡착 · anchor = snap 점");
  P.working.patternLines = P.working.patternLines.filter(l => l !== ln2); sb.viewZ = 1;
  ok(J(P.working.bodiceResult) === bJ && J(SC.latest(P)) === sJ && J(P.referenceGeometry) === rJ && REF_J === J(REF), "2 " + sym + ": 원형·bodiceResult·sleeveResult 불변");
  SUMMARY.push(sym + "(" + pc + ")");
  DLT.setMode("off");
});
ok(!anySnapOrig, "2: 9종 모두 snap 점 중 하나는 원래 외곽에서 0.5cm 이상 떨어진 파생 외곽 위(원래 외곽 snap 이 아님)");

lap("s2");
// §3 판정 보류 — 화면 미리보기와 옛 frozen 을 섞지 않음
{
  ["T", "V", "Z"].forEach(sym => {
    const P = projectOn("A"); API(sym).apply(P, defaultsOf(sym)); doneAll(P);
    const sres = SC.latest(P), b = P.working.bodiceResult;
    let pc = "front", dl = derivedOnlyLine(sres.derivedBodice.front, b.front); if (!dl) { pc = "back"; dl = derivedOnlyLine(sres.derivedBodice.back, b.back); }
    const line = drawLine(pc, [nudge(dl.p0, 0.12), nudge(dl.p1, 0.12)]); selectLine(line); DLT.setRole("cut");
    ok(/^유효 절개선/.test(statusEl().textContent), "3 " + sym + ": 출발 = 유효");
    // (a) 소매 입력 변경(미완료) → 보류 · 이유 · 분리 비활성 · snap = 새 화면 형상(작업 중 파생 몸판)
    const r2 = API(sym).apply(P, changedOf(sym));
    W.refreshDesignResultUI = () => { NOTIFY++; DLT.syncCutStatus(); };   // ui.js updateDesignResultUI 끝의 동기화와 같은 호출
    W.refreshDesignResultUI();
    const ref = DLT.editBodiceRef(P), t = statusEl().textContent;
    ok(r2.ok && ref.source === "pending" && /완료 후 바뀜/.test(ref.reason) && /^판정 보류\(최종 몸판 미확정\): /.test(t) && statusEl().attrs["data-basis"] === "pending" && splitBtn().disabled === true, "3 " + sym + ": 입력 변경 → 판정 보류 (" + t + ")");
    const live = DLT.displayedDerivedPiece(P, pc), sN = DLT.snapForCursor(nudge(dl.p0, 0.12), pc, false, null);
    ok(live && J(live) === J(P.working["sleeve" + sym].derivedBodice[pc]) && sN && dist(sN.point, flat(live.outline)) < 1e-6, "3 " + sym + ": snap = 화면의 작업 중 파생 외곽(" + (J(live) !== J(sres.derivedBodice[pc]) ? "완료본과 다름" : "형상은 완료본과 같지만 입력이 바뀌어 보류") + ")");
    ok(DR.check(P).fails.indexOf("sleeve-changed") >= 0, "3 " + sym + ": 완료 판정도 «소매 변경됨»(같은 이유 계열)");
    // (b) 차단 → 화면은 원래 몸판만 · snap = 원래 · 보류(차단 사유)
    API(sym).reject(P, { reason: "invalid-input", text: "시험 차단" }); W.refreshDesignResultUI();
    const rb = DLT.editBodiceRef(P);
    ok(rb.source === "pending" && /차단/.test(rb.reason) && DLT.displayedDerivedPiece(P, pc) === null && SA.dolmanBodice(P) === null, "3 " + sym + ": 차단 → 보류 · 화면 파생 몸판 없음 (" + rb.reason + ")");
    { const kl = P.working.patternLines; P.working.patternLines = [];   // 기존 선 anchor 흡착을 빼고 외곽 흡착만 본다
      const pFar = dl.far[0] >= dl.far[1] ? dl.p0 : dl.p1, cur = nudge(pFar, 0.12), sX = DLT.snapForCursor(cur, pc, false, null), sD = DLT.chooseSnap(cur, { anchors: [], endpoints: [], outlineSegs: DLT.outlinePrimsToSegs(sres.derivedBodice[pc].outline) }, 0.8, 0.5);
      ok(J(sX) === J(origSnap(P.working.geometry, pc, cur, [])) && J(sX) !== J(sD), "3 " + sym + ": 차단 중 snap = 화면 형상(원래 몸판) 공식 · 옛 파생 외곽 흡착과 다름 (" + (sX ? sX.type : "없음") + ")");
      P.working.patternLines = kl; }
    // (c) 같은 입력으로 다시 적용·완료 → 유효로 복귀
    API(sym).apply(P, defaultsOf(sym)); SC.complete(P); W.refreshDesignResultUI();
    ok(DLT.editBodiceRef(P).source === "sleeve-derived" && /^유효 절개선/.test(statusEl().textContent), "3 " + sym + ": 재적용·재완료 → 유효 복귀 (" + statusEl().textContent + ")");
    // (d) Ⓐ 로 전환(미완료) → 보류(완료본 ≠ 현재) · Ⓐ 완료 → 원래 몸판 맥락(종전 문구)
    clearOthers(P, "A"); API("A").apply(P, defaultsOf("A")); W.refreshDesignResultUI();
    const ra = DLT.editBodiceRef(P);
    ok(ra.source === "pending" && /현재 소매가 다름/.test(ra.reason) && /^판정 보류/.test(statusEl().textContent), "3 " + sym + ": Ⓐ 전환(미완료) → 보류 (" + ra.reason + ")");
    SC.complete(P); W.refreshDesignResultUI();
    const vA = DLT.validateSelectedCut();
    ok(DLT.editBodiceRef(P).source === "original" && vA && !vA.basis && statusEl().textContent === vA.reason.replace(/^분리 가능$/, "분리 가능") && splitBtn().disabled === !vA.ok, "3 " + sym + ": Ⓐ 완료 → 원래 몸판 맥락 · 종전 문구 (" + statusEl().textContent + ")");
    // (e) 다시 파생 소매로(미완료) → 보류(완료본 Ⓐ ≠ 현재)
    API(sym).apply(P, defaultsOf(sym)); clearOthers(P, sym); W.refreshDesignResultUI();
    ok(DLT.editBodiceRef(P).source === "pending" && /완료된 소매는 Ⓐ/.test(DLT.editBodiceRef(P).reason), "3 " + sym + ": Ⓐ→" + sym + " 적용(미완료) → 보류(완료본 Ⓐ)");
    W.refreshDesignResultUI = () => { NOTIFY++; };
    DLT.setMode("off");
  });
}

lap("s3");
// §4 파트 미리보기 — 원래 몸판에서 자른 파트는 파생 몸판 맥락에서 그리지 않는다(데이터 보존)
{
  const P = projectOn("A"); API("A").apply(P, defaultsOf("A")); doneAll(P);
  const [m, h] = splittableFront(P.working.geometry);
  const line = drawLine("front", [m, h]); selectLine(line); DLT.setRole("cut"); DLT.doSplit();
  const parts = J(P.working.parts || null);
  ok((P.working.parts || []).length === 2 && DLT.isOriginalBodiceContext(P) === true, "4: Ⓐ 에서 분리 → 파트 2 · 원래 몸판 맥락");
  clearOthers(P, "X"); API("X").apply(P, defaultsOf("X"));
  ok(DLT.isOriginalBodiceContext(P) === false && J(P.working.parts) === parts, "4: Ⓧ 적용 → 파트 미리보기 숨김 대상(데이터는 그대로)");
  clearOthers(P, "A"); API("A").apply(P, defaultsOf("A")); SC.complete(P);
  ok(DLT.isOriginalBodiceContext(P) === true, "4: Ⓐ 로 돌아와 완료 → 다시 원래 몸판 맥락");
  const RSRC = fs.readFileSync(path.join(ROOT, "js", "render.js"), "utf8");
  ok(/dp\.working\.parts\.length && !\(_dlt && _dlt\.isOriginalBodiceContext && !_dlt\.isOriginalBodiceContext\(dp\)\)\)/.test(RSRC), "4: render.js 파트 미리보기 = 원래 몸판 맥락에서만");
  ok(/window\.designLineTool && window\.designLineTool\.syncCutStatus\) window\.designLineTool\.syncCutStatus\(\);\n  \}\n  function onCompleteDesign/.test(UI_SRC), "4: ui.js updateDesignResultUI 끝에서 절개선 상태 동기화");
}

lap("s4");
if (process.env.CEF_TIME) console.log("  시간(ms): " + ["s1", "s2", "s3", "s4"].map((k, i, a) => k + "=" + (TT[k] - (i ? TT[a[i - 1]] : T0))).join(" "));
console.log("cutEditFinalBodiceCheck: " + PASS + " passed, " + FAIL + " failed");
console.log("  파생 외곽 전용 선(소매·피스): " + SUMMARY.join(" "));
if (FAIL) { fails.slice(0, 40).forEach(f => console.log("  FAIL " + f)); process.exit(1); }
