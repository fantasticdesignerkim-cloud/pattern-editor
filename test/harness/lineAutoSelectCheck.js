// ══════════════════════════════════════════════
// lineAutoSelectCheck.js — 패턴선 완료 직후 자동 선택(2026-11-05 김님 실사용 피드백 «선택·편집 → 같은 선 재클릭» 두 단계 제거).
//   새 동선: 선·곡선 그리기 → Enter 또는 더블클릭으로 정상 완료 → 방금 그린 선이 선택·편집 상태(역할 버튼 활성 · 핸들 표시) →
//   절개선/외곽/보조선 바로 선택. 다시 그리기 = «선·곡선 그리기» 버튼. 기본 역할 guide · 자동 역할 지정 없음.
//   **designLineTool 이 실제로 등록한 svg/document 핸들러**(pointerdown·move·up·keydown)를 피스 offset 을 거친 도안 cm 이벤트로 호출한다.
//   역할·모드 버튼은 index.html 의 onclick 이 부르는 함수 그대로(setRole · toggle · toggleSelect)를 부른다.
//   §1 Enter 완료(직선) · §2 더블클릭 완료(중복점 미추가) · §3 곡선(드래그 핸들) · §4 미완성 한 점·Esc 취소 = 자동 완료·선택 없음
//   §5 연속 2개 그리기(버튼 한 번) · §6 자동 선택 뒤 역할 변경·앵커 드래그·Delete · §7 관리형 선 잠금 불변 · §8 최종 몸판(Ⓩ·Ⓥ) snap·판정 정책 불변
//   «그리기 완료» 버튼(2026-11-05 김님 실사용 피드백 «더블클릭하면 불편한데» — 주 완료 경로 = 버튼 한 번 · Enter·더블클릭 호환):
//   §10 버튼 활성 = 그리기 · 서로 다른 점 ≥2 에서만(초안 없음·한 점·같은 자리 두 점·Backspace·Esc·취소·모드 전환 = 비활성)
//   §11 버튼 완료(직선) → 선 1개 · 자동 선택 · 바로 절개선 · Delete · §12 곡선 · §13 연속 2개 · §14 그리기 밖 호출 무동작 · 버튼 요소 없음 안전
//   §8 은 Enter·버튼 두 경로 모두
//   Codex 검토 후속(2026-11-05):
//   §15 hit 영역 = 화면 파생 몸판 — **render.js 의 실제 hit layer 함수**(_appendDesignHitLayer · 소스에서 그 부분만 실행)로 rect 를 만들고,
//       클릭 좌표 → 그 rect 들의 실제 범위(transform 포함)로 DOM 타깃을 고른 뒤 실제 pointerdown 에 넘긴다(피스를 이벤트에 직접 붙이지 않음).
//       Ⓩ 연장부(원래 외곽 밖) 시작 클릭 → 선 → 완료 버튼 → 절개선 · 종전 rect 로는 «피스 위를 클릭하세요» · Ⓥ·Ⓧ·Ⓨ 대표 · 차단 = 원래 범위 ·
//       배치 오프셋·zoom · 인접 피스 오선택 없음 · 원래 몸판 rect 무변경 · 원형/bodiceResult/sleeveResult/geometry 불변
//   §16 완료 판정 = 실제 퇴화(길이 0) geometry 만 거부 — 같은 자리 두 앵커라도 핸들이 있는 곡선은 버튼·Enter·더블클릭 모두 완료(종전 Enter 와 같음) ·
//       완전 퇴화(같은 자리 두 점 · 핸들 없음)는 버튼·Enter·더블클릭 모두 거부 · 순수 판정 대조
//   버튼 문구: 그리기 중 «선·곡선 그리기» 자리 = «그리기 취소»(종전 «그리기 종료» — 작성 중 선을 버리고 나가므로 «그리기 완료»와 구분) — §1·§5 기대값 갱신
//   §17 «선 가까이» 막대 «파트 분리» = 오른쪽 «파트 분리»와 같은 판정(getSplitState)·같은 명령(doSplit) — 원래 몸판 유효 → 2파트(오른쪽 결과와 동일 · 면적 합) ·
//       무효·Ⓥ 완료 전·Ⓥ→Ⓩ 변경·Ⓥ/Ⓩ 파생 = 비활성 + 같은 이유 · 누름 무변경 · 역할 변경 = 행 숨김 · 막대 표시가 최종 몸판 재판정을 반복하지 않음
//   node test/harness/lineAutoSelectCheck.js
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
const ELS = {};
function el(id) { if (!ELS[id]) ELS[id] = { id, textContent: "", disabled: false, attrs: {}, setAttribute(k, v) { this.attrs[k] = String(v); }, removeAttribute(k) { delete this.attrs[k]; }, getAttribute(k) { return this.attrs[k]; } }; return ELS[id]; }
let LOADING = null; const SVG_H = {}, DOC_H = {};
let RENDERS = 0;
const sb = { window: {}, console: { log() {}, warn() {} }, Math, JSON, Object, Array, isFinite, structuredClone, Error, Date, Promise,
  c2p: (x, y) => [x * 10, y * 10], SC: 10, viewZ: 1,
  eventToPatternPoint: e => [e.px, e.py],
  render: () => { RENDERS++; },
  svg: { addEventListener(t, f) { (SVG_H[LOADING + ":" + t] = SVG_H[LOADING + ":" + t] || []).push(f); }, setPointerCapture() {}, releasePointerCapture() {} },
  document: { createElementNS: () => ({ setAttribute() {}, appendChild() {} }), getElementById: el,
    addEventListener(t, f) { (DOC_H[LOADING + ":" + t] = DOC_H[LOADING + ":" + t] || []).push(f); } } };
// render.js hit layer 용 최소 DOM(E) — 속성·자식만. ZM = 화면 배율(zoom) 흉내(c2p·scale 동승).
let ZM = 1;
sb.c2p = (x, y) => [x * 10 * ZM, y * 10 * ZM];
sb.E = (tag, a) => { const n = { tagName: tag, attrs: {}, children: [], setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
  appendChild(c) { this.children.push(c); return c; }, closest(sel) { return sel === ".design-layout-hit" && /(^| )design-layout-hit( |$)/.test(this.attrs["class"] || "") ? this : null; } };
  Object.entries(a || {}).forEach(([k, v]) => n.setAttribute(k, v)); return n; };
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
// render.js 에서 hit layer 부분(_appendCollarHitRect · _appendDesignHitRect · _appendDesignHitLayer)만 잘라 실행 — render() 자체는 싣지 않는다(스텁 render 유지).
{
  const RSRC = fs.readFileSync(path.join(ROOT, "js", "render.js"), "utf8");
  const i0 = RSRC.indexOf("function _appendCollarHitRect("), i1 = RSRC.indexOf("\nfunction render(){");
  if (i0 < 0 || i1 < i0) throw new Error("render.js hit layer 구간을 찾지 못함");
  vm.runInContext(RSRC.slice(i0, i1), sb, { filename: "render.js(hit layer)" });
}
const W = sb.window, DB = W.designBodice, BP = W.bodicePresets, BC = W.bodiceCheckpoint, SC = W.sleeveCheckpoint, SP = W.sleevePresets,
  DC = W.designCollar, CC = W.collarCheckpoint, DR = W.designResult, DLT = W.designLineTool, DLy = W.designLayout;
const API = s => W["sleeve" + s + "Apply"];
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));
const REF_J = J(REF);
const bodicePreset = sym => { for (const f of BP.families()) for (const v of f.variants) if (v.symbol === sym && v.presetId) return v.presetId; return null; };
function projectOn(bodiceSym) {
  const body = BP.bodyParams(bodicePreset(bodiceSym));
  PROJECT = { sourceBlock: { id: "blk", version: 2, schemaVersion: 8, canonicalHash: "abc" }, referenceGeometry: JSON.parse(REF_J),
    working: { geometry: DB.computeGeometry(REF, { body }), parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body }, patternLines: [], designOutline: null, frontPlacket: null } };
  BC.complete(PROJECT);
  PROJECT.working.layout = { front: { dx: 40, dy: 5 }, back: { dx: 0, dy: 5 }, sleeve: { dx: 80, dy: 5 }, collar: { dx: 0, dy: 70 } };
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
const doneAll = P => { const s = SC.complete(P); setCollar(P); return s.ok && CC.complete(P).ok; };

// ── 실제 핸들러(designLineTool 이 등록한 것만) ──
const H = t => (SVG_H["designLineTool.js:" + t] || []);
const KD = () => (DOC_H["designLineTool.js:keydown"] || []);
let CLX = 0;
// 형상 cm → 도안 cm 이벤트. clientX 를 주면 그 화면 좌표(더블클릭 판정용), 아니면 매번 멀리(수동 더블클릭으로 오인 방지).
function evAt(pc, geo, extra) {
  const L = DLy.ensureLayout(PROJECT), off = L[pc] || { dx: 0, dy: 0 };
  CLX += 100;
  return Object.assign({ button: 0, pointerId: 1, clientX: CLX, clientY: 0, altKey: false, shiftKey: false, px: geo.x + off.dx, py: geo.y + off.dy,
    target: { closest: () => ({ getAttribute: () => pc }) }, stopPropagation() {}, preventDefault() {} }, extra || {});
}
const down = e => H("pointerdown").forEach(f => f(e)), move = e => H("pointermove").forEach(f => f(e)), up = e => H("pointerup").forEach(f => f(e));
let PREVENTED = 0;
const key = k => KD().forEach(f => f({ key: k, target: {}, preventDefault() { PREVENTED++; } }));
const click = (pc, g, extra) => { const e = evAt(pc, g, extra); down(e); up(e); };
const btnRole = r => el({ cut: "btnRoleCut", boundary: "btnRoleBoundary", guide: "btnRoleGuide" }[r]);
const roleBtnsEnabled = () => ["btnRoleCut", "btnRoleBoundary", "btnRoleGuide"].every(id => el(id).disabled === false);
const roleBtnsDisabled = () => ["btnRoleCut", "btnRoleBoundary", "btnRoleGuide"].every(id => el(id).disabled === true);
const note = () => el("designLineNote").textContent;
const finishOn = () => el("btnDesignFinish").disabled === false && el("btnDesignFinish").attrs["aria-disabled"] === "false";
const lines = () => PROJECT.working.patternLines;
const last = () => lines()[lines().length - 1];
// 「선택 상태로 보인다」 = 선택 id · 선택 overlay(앵커/핸들) · 역할 버튼 활성 · guide 강조 · 버튼 문구 · 안내.
function autoSelected(line, tag) {
  ok(DLT.getMode() === "select", tag + ": 완료 직후 선택·편집 모드 (" + DLT.getMode() + ")");
  ok(DLT.getSelectedId() === line.id, tag + ": 방금 그린 선이 선택됨");
  const ov = DLT.getSelectionOverlay();
  ok(!!ov && ov.piece === line.piece && ov.anchors.length === DLT.anchorsFromSegments(line.segments).length, tag + ": 선택 overlay(앵커) 표시");
  ok(roleBtnsEnabled() && btnRole("guide").attrs["aria-pressed"] === "true" && btnRole("cut").attrs["aria-pressed"] === "false", tag + ": 역할 버튼 활성 · 기본 역할 guide 강조");
  ok(line.role === "guide", tag + ": 기본 역할 guide 그대로(자동 지정 없음)");
  ok(el("btnDesignLine").textContent === "선·곡선 그리기" && el("btnDesignLine").attrs["aria-pressed"] === "false" &&
     el("btnDesignSelect").textContent === "편집 종료" && el("btnDesignSelect").attrs["aria-pressed"] === "true", tag + ": 버튼 문구·눌림 = 실제 모드(그리기 해제 · 편집 중)");
  ok(/방금 그린 선 선택됨/.test(note()) && /역할/.test(note()) && /선·곡선 그리기/.test(note()), tag + ": 짧은 안내(선택됨 · 역할 고르기 · 다시 그리기) (" + note() + ")");
  ok(!DLT.getDraft(), tag + ": 그리기 draft 비움");
}

// 원래 몸판 앞판에서 다트를 가로지르지 않고 두 끝이 외곽에 닿는 수평선(분리 가능 판정이 나오는 선)
const flat = outline => DLT.flattenLine(DLT.outlinePrimsToSegs(outline));
function hcross(fl, y) { const xs = []; fl.forEach(([a, b]) => { if ((a.y - y) * (b.y - y) < 0) xs.push(a.x + (b.x - a.x) * (y - a.y) / (b.y - a.y)); }); return xs.sort((p, q) => p - q); }
function splittableFront(g) {
  const fo1 = flat(g.front.outline), legs = (g.front.construction || []).filter(c => c.kind === "line").map(c => ({ from: c.from, to: c.to }));
  const ring = DLT.buildPieceRing(DLT.outlinePrimsToSegs(g.front.outline), legs).ring;
  for (let y = 8; y < 40; y += 0.5) { const xs = hcross(fo1, y); if (xs.length !== 2) continue; const sg = [{ kind: "line", from: { x: xs[0], y }, to: { x: xs[1], y } }];
    if (DLT.validateCut({ role: "cut", segments: sg }, fo1, []).ok && DLT.splitRingByCut(ring, sg).ok) return [sg[0].from, sg[0].to]; }
  return [null, null];
}

// §1 Enter 완료(직선) — 원래 몸판(몸판만)
{
  const P = projectOn("A"), [m, h] = splittableFront(P.working.geometry);
  ok(!!m, "1: 시험 선 찾음");
  DLT.toggle();   // index.html «선·곡선 그리기» onclick
  ok(DLT.getMode() === "draw" && el("btnDesignLine").textContent === "그리기 취소", "1: 그리기 시작(버튼 문구 «그리기 취소» — 2026-11-05 완료 버튼과 구분)");
  const n0 = lines().length, N0 = NOTIFY;
  click("front", m); click("front", h);
  ok(DLT.getMode() === "draw" && lines().length === n0 && roleBtnsDisabled(), "1: 완료 전 = 그리기 중 · 선 없음 · 역할 버튼 비활성");
  const pv = PREVENTED; key("Enter");
  ok(lines().length === n0 + 1 && PREVENTED === pv + 1, "1: Enter = 완료(선 1개 추가 · 기본 동작 막음 — 포커스된 버튼 재클릭 방지)");
  const line = last();
  ok(line.segments.length === 1 && line.segments[0].kind === "line", "1: 직선 1구간");
  autoSelected(line, "1 Enter");
  ok(NOTIFY > N0, "1: Design 통합 UI 갱신 신호");
  // 같은 선을 다시 클릭하지 않고 바로 역할 버튼
  DLT.setRole("cut");
  ok(line.role === "cut" && btnRole("cut").attrs["aria-pressed"] === "true" && el("designCutStatus").textContent === "분리 가능" && el("btnDesignSplit").disabled === false,
    "1: 바로 «절개선» → 역할 cut · 문구 «분리 가능» · 분리 버튼 활성 (" + el("designCutStatus").textContent + ")");
  ok(DLT.getSelectedId() === line.id && DLT.getMode() === "select", "1: 역할 지정 뒤에도 선택 유지");
  DLT.toggleSelect();   // «편집 종료»
  ok(DLT.getMode() === "off" && DLT.getSelectedId() === null && roleBtnsDisabled() && el("btnDesignSelect").textContent === "선택·편집", "1: «편집 종료» → 해제(역할 버튼 비활성)");
}

// §2 더블클릭 완료 — 두 번째 눌림은 중복점이므로 추가하지 않음(종전 계약)
{
  const P = projectOn("A"), [m, h] = splittableFront(P.working.geometry);
  DLT.toggle();
  click("front", m);
  const e1 = evAt("front", h, { clientX: 5000, clientY: 40 }); down(e1); up(e1);
  const e2 = evAt("front", { x: h.x + 0.01, y: h.y }, { clientX: 5002, clientY: 41 }); down(e2); up(e2);   // 같은 자리 · 400ms 안
  const line = last();
  ok(lines().length === 1 && DLT.anchorsFromSegments(line.segments).length === 2, "2: 더블클릭 완료 · 두 번째 눌림 점 미추가(앵커 2)");
  autoSelected(line, "2 더블클릭");
  ok(DLT.getSelectedId() === line.id, "2: 뒤따른 pointerup 이 선택을 지우지 않음");
  DLT.setRole("boundary");
  ok(line.role === "boundary" && btnRole("boundary").attrs["aria-pressed"] === "true", "2: 바로 «외곽» 역할");
  DLT.setRole("guide");
  ok(line.role === "guide" && btnRole("guide").attrs["aria-pressed"] === "true", "2: 바로 «보조선» 역할로 되돌림");
  DLT.setMode("off");
}

// §3 곡선(끝점에서 드래그 = 그 구간의 들어오는 핸들 · segmentsFromAnchors 계약) → Enter → 자동 선택 · 핸들 overlay
{
  const P = projectOn("A"), [m, h] = splittableFront(P.working.geometry);
  DLT.toggle();
  click("front", m);
  const d0 = evAt("front", h, { clientX: 9000, clientY: 0 }); down(d0);
  const hp = { x: h.x + 3, y: h.y + 2 };
  move(evAt("front", hp, { clientX: 9030, clientY: 20 })); up(evAt("front", hp, { clientX: 9030, clientY: 20 }));
  ok(DLT.getMode() === "draw" && lines().length === 0, "3: 드래그(핸들) 자체는 완료가 아님 — 그리기 유지");
  key("Enter");
  const line = last();
  ok(line.segments.length === 1 && line.segments[0].kind === "cubic", "3: 곡선 구간(cubic)");
  autoSelected(line, "3 곡선");
  const ov = DLT.getSelectionOverlay();
  ok(!!ov && ov.handles.length >= 1, "3: 선택 overlay 에 곡선 핸들 표시 (" + (ov ? ov.handles.length : "없음") + ")");
  DLT.setMode("off");
}

// §4 미완성 한 점 · Esc 취소 = 자동 완료·선택 없음
{
  const P = projectOn("A"), [m] = splittableFront(P.working.geometry);
  DLT.toggle();
  click("front", m); key("Enter");
  ok(lines().length === 0 && DLT.getMode() === "draw" && DLT.getSelectedId() === null && roleBtnsDisabled() && note() === "점 2개 이상 필요" && !!DLT.getDraft(),
    "4: 한 점 + Enter → 선 없음 · 그리기 유지 · 선택 없음 · draft 유지 (" + note() + ")");
  const e2 = evAt("front", m, { clientX: 7000 }); down(e2); up(e2);   // 한 점 더(같은 자리) → 앵커 2 가 되지 않게 Esc 로 확인
  key("Escape");
  ok(lines().length === 0 && DLT.getMode() === "draw" && !DLT.getDraft() && DLT.getSelectedId() === null && roleBtnsDisabled(), "4: Esc 취소 → 선 없음 · 그리기 유지 · 선택 없음");
  // 한 점에서 더블클릭(같은 자리 두 번) → 점 1개 → 완료 안 됨
  const a = evAt("front", m, { clientX: 8000, clientY: 0 }); down(a); up(a);
  const b = evAt("front", m, { clientX: 8001, clientY: 0 }); down(b); up(b);
  ok(lines().length === 0 && DLT.getMode() === "draw" && DLT.getSelectedId() === null, "4: 한 점 더블클릭 → 완료·선택 없음(그리기 유지)");
  key("Escape"); DLT.setMode("off");
}

// §5 연속 2개 그리기 — «선·곡선 그리기» 버튼 한 번으로 다음 선
{
  const P = projectOn("A"), [m, h] = splittableFront(P.working.geometry);
  DLT.toggle(); click("front", m); click("front", h); key("Enter");
  const l1 = last(); autoSelected(l1, "5 첫 선");
  DLT.setRole("cut");
  DLT.toggle();   // 선택·편집 중 «선·곡선 그리기» → 바로 그리기(한 번)
  ok(DLT.getMode() === "draw" && DLT.getSelectedId() === null && roleBtnsDisabled() && el("btnDesignLine").textContent === "그리기 취소" && el("btnDesignSelect").textContent === "선택·편집",
    "5: 버튼 한 번 → 그리기(선택 해제 · 역할 버튼 비활성)");
  const y2 = { x: m.x, y: m.y + 4 }, y3 = { x: h.x, y: h.y + 4 };
  click("front", y2); click("front", y3); key("Enter");
  const l2 = last();
  ok(lines().length === 2 && l2.id !== l1.id, "5: 두 번째 선 추가");
  autoSelected(l2, "5 둘째 선");
  ok(l1.role === "cut" && l2.role === "guide", "5: 첫 선 역할 cut 유지 · 둘째 선 기본 guide");
  DLT.setMode("off");
}

// §6 자동 선택 뒤 앵커 드래그 · Delete
{
  const P = projectOn("A"), [m, h] = splittableFront(P.working.geometry);
  DLT.toggle(); click("front", m); click("front", h); key("Enter");
  const line = last(); DLT.setRole("cut");
  const as = DLT.anchorsFromSegments(line.segments), to = { x: as[0].x + (as[1].x - as[0].x) * 0.3, y: as[0].y + 0.2 };
  const N0 = NOTIFY;
  down(evAt("front", as[0])); move(evAt("front", to, { altKey: true })); up(evAt("front", to, { altKey: true }));   // 다시 클릭해 선택하지 않고 바로 앵커 드래그(Alt = snap 해제)
  const a2 = DLT.anchorsFromSegments(line.segments)[0];
  ok(Math.hypot(a2.x - to.x, a2.y - to.y) < 1e-9 && DLT.getSelectedId() === line.id, "6: 자동 선택 상태에서 바로 앵커 드래그");
  ok(el("designCutStatus").textContent === "시작점이 외곽선에 연결되지 않음" && el("btnDesignSplit").disabled === true && NOTIFY > N0, "6: 드래그 끝 재판정 · Design 변경 신호 (" + el("designCutStatus").textContent + ")");
  key("Delete");
  ok(lines().length === 0 && DLT.getSelectedId() === null && roleBtnsDisabled() && /삭제/.test(note()), "6: Delete → 선 삭제 · 선택 해제");
  DLT.setMode("off");
}

// §7 관리형 선 잠금 불변 — 자동 선택은 새로 그린 선에만. 관리선은 선택해도 역할·삭제·끝점 잠금 그대로.
//   관리형 소매산·칼라 본체 선은 ui.js 가 만드는 모양({managedBy}) 그대로 픽스처로 넣는다(그 생성 경로는 이 검사 범위 밖).
{
  const P = projectOn("A");
  const cap = { id: "line-90", piece: "sleeve", role: "boundary", managedBy: "sleeve-cap", splitAnchorIndex: 1,
    segments: [{ kind: "line", from: { x: 0, y: 10 }, to: { x: 10, y: 0 } }, { kind: "line", from: { x: 10, y: 0 }, to: { x: 20, y: 10 } }] };
  const col = { id: "line-91", piece: "collar", role: "boundary", managedBy: "collar-body", segments: [{ kind: "line", from: { x: 0, y: 0 }, to: { x: 10, y: 3 } }] };
  P.working.patternLines.push(JSON.parse(J(cap)), JSON.parse(J(col)));
  const capJ = J(lines()[0]), colJ = J(lines()[1]);
  const [m, h] = splittableFront(P.working.geometry);
  DLT.toggle(); click("front", m); click("front", h); key("Enter");
  const nl = last();
  ok(nl.id === "line-92" && !nl.managedBy, "7: 새 선 id 는 관리선과 겹치지 않음 · 관리 표시 없음");
  autoSelected(nl, "7 새 선");
  // 관리형 소매산 선을 클릭 선택 → 역할 버튼 잠금 · 역할·Delete 거부
  click("sleeve", { x: 5, y: 5 });
  ok(DLT.getSelectedId() === "line-90" && roleBtnsDisabled() && /소매산 관리선/.test(note()), "7: 소매산 관리선 선택 → 역할 버튼 잠금 (" + note() + ")");
  DLT.setRole("cut"); key("Delete");
  ok(J(lines().find(l => l.id === "line-90")) === capJ, "7: 소매산 관리선 역할·삭제 거부(바이트 동일)");
  click("collar", { x: 5, y: 1.5 });
  ok(DLT.getSelectedId() === "line-91" && roleBtnsDisabled(), "7: 칼라 본체 관리선 선택 → 역할 버튼 잠금");
  DLT.setRole("guide"); key("Delete");
  ok(J(lines().find(l => l.id === "line-91")) === colJ, "7: 칼라 본체 관리선 역할·삭제 거부(바이트 동일)");
  DLT.setMode("off");
}

// §8 최종 몸판 맥락(Ⓩ·Ⓥ 완료) — 그리기 snap = 화면 파생 몸판 · 자동 선택 뒤 «절개선» = 최종 몸판 판정 · 분리 비활성(정책 불변) · 완료본 불변
//   파생 외곽에만 닿는 선은 cutEditFinalBodiceCheck 와 같은 방법(파생 유효 · 원래 무효 · 한 끝이 원래 외곽에서 1cm 이상)으로 고른다.
function derivedOnlyLine(dPiece, oPiece) {
  const fd = flat(dPiece.outline), fo = flat(oPiece.outline);
  let bb = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity }; fd.forEach(([a]) => { bb.x0 = Math.min(bb.x0, a.x); bb.x1 = Math.max(bb.x1, a.x); bb.y0 = Math.min(bb.y0, a.y); bb.y1 = Math.max(bb.y1, a.y); });
  for (let t = 0.1; t < 0.9; t += 0.02) {
    const y = bb.y0 + (bb.y1 - bb.y0) * t, xs = hcross(fd, y); if (xs.length !== 2 || xs[1] - xs[0] < 5) continue;
    const p0 = { x: xs[0], y }, p1 = { x: xs[1], y }, ln = { role: "cut", segments: [{ kind: "line", from: p0, to: p1 }] };
    if (!DLT.validateCut(ln, fd, []).ok || DLT.validateCut(ln, fo, []).ok) continue;
    if (Math.max(DLT.distPtToSegs(p0, fo), DLT.distPtToSegs(p1, fo)) < 1.0) continue;
    return [p0, p1];
  }
  return [null, null];
}
[["Z", "enter"], ["V", "enter"], ["Z", "button"], ["V", "button"]].forEach(([sym, how]) => {
  const P = projectOn("A");
  ok(API(sym).apply(P, defaultsOf(sym)).ok && doneAll(P), "8 " + sym + "/" + how + ": 소매·카라 완료");
  const sres = SC.latest(P), b = P.working.bodiceResult, bJ = J(b), sJ = J(sres), rJ = J(P.referenceGeometry);
  const fd = flat(sres.derivedBodice.front.outline);
  const [p0, p1] = derivedOnlyLine(sres.derivedBodice.front, b.front);
  ok(!!p0, "8 " + sym + "/" + how + ": 파생 외곽 전용 시험 선 찾음");
  DLT.toggle();
  const n0 = (v, d) => ({ x: v.x + d, y: v.y });
  click("front", n0(p0, 0.15)); click("front", n0(p1, -0.15));   // 0.15cm 떨어져 클릭 → snap 으로 파생 외곽에 붙는다
  if (how === "enter") key("Enter"); else { ok(finishOn(), "8 " + sym + " 버튼: 완료 버튼 활성"); DLT.finishDraw(); }
  const line = last();
  ok(DLT.distPtToSegs(line.segments[0].from, fd) < 1e-6 && DLT.distPtToSegs(line.segments[0].to, fd) < 1e-6, "8 " + sym + "/" + how + ": 그리기 snap = 화면 파생 외곽(거리 0)");
  autoSelected(line, "8 " + sym);
  DLT.setRole("cut");
  const st = el("designCutStatus").textContent;
  ok(new RegExp("^유효 절개선 — 소매 " + (sym === "Z" ? "Ⓩ" : "Ⓥ")).test(st) && el("btnDesignSplit").disabled === true, "8 " + sym + "/" + how + ": 바로 «절개선» → 최종 몸판 판정 «유효» · 분리 비활성(종전 정책) (" + st + ")");
  DLT.doSplit();
  ok(!(P.working.parts || []).length && /원래 몸판 전용/.test(el("designSplitNote").textContent), "8 " + sym + "/" + how + ": 분리 실행 거부(종전 정책)");
  const c = DR.check(P);
  ok(c.ok && (c._cuts || []).some(x => x.piece === "front" && J(x.segments) === J(line.segments)), "8 " + sym + "/" + how + ": Design 완료 판정에 같은 선 포함");
  ok(J(P.working.bodiceResult) === bJ && J(SC.latest(P)) === sJ && J(P.referenceGeometry) === rJ, "8 " + sym + "/" + how + ": 원형·bodiceResult·sleeveResult 불변");
  DLT.setMode("off");
});

// ── «그리기 완료» 버튼 ──
// §10 활성 상태 — 그리기 모드 · 서로 다른 점 ≥2 에서만
{
  const P = projectOn("A"), [m, h] = splittableFront(P.working.geometry);
  DLT.setMode("off");
  ok(!finishOn(), "10: 꺼짐 모드 = 비활성(aria-disabled · 안내 tooltip)");
  DLT.toggle();
  ok(!finishOn() && !DLT.canFinishDraw(), "10: 그리기 시작 · 초안 없음 = 비활성");
  click("front", m);
  ok(!finishOn(), "10: 한 점 = 비활성");
  const n0 = lines().length; DLT.finishDraw();
  ok(lines().length === n0 && DLT.getMode() === "draw" && !!DLT.getDraft() && DLT.getSelectedId() === null, "10: 한 점에서 완료 호출 → 선 없음 · 그리기·초안 유지");
  click("front", h);
  ok(finishOn() && DLT.canFinishDraw() && /그리기 완료/.test(note()), "10: 서로 다른 점 2개 = 활성 · 안내가 완료 버튼을 가리킴 (" + note() + ")");
  key("Backspace");
  ok(!finishOn() && DLT.getDraft().anchors.length === 1, "10: Backspace → 한 점 → 비활성");
  click("front", h);
  ok(finishOn(), "10: 다시 2점 → 활성");
  key("Escape");
  ok(!finishOn() && !DLT.getDraft() && DLT.getMode() === "draw" && lines().length === n0, "10: Esc 취소 → 비활성 · 선 없음 · 그리기 유지");
  click("front", m); click("front", h);
  ok(finishOn(), "10: (취소 버튼 전) 2점 활성");
  DLT.toggle();   // 그리기 중 «그리기 취소»
  ok(!finishOn() && DLT.getMode() === "off" && lines().length === n0 && el("btnDesignLine").textContent === "선·곡선 그리기", "10: «그리기 취소» → 작성 중 선 버림 · 비활성");
  DLT.toggle(); click("front", m); click("front", h);
  DLT.toggleSelect();   // 그리기 중 선택·편집으로 전환
  ok(!finishOn() && DLT.getMode() === "select" && lines().length === n0, "10: 선택·편집으로 전환 → 비활성 · 선 생성 없음");
  DLT.setMode("off"); DLT.toggle();
  // 같은 자리 두 점(천천히 = 더블클릭 아님) = 길이 0 → 완료 불가(버튼·Enter 모두)
  const a = evAt("front", m, { clientX: 20000 }); down(a); up(a);
  const b = evAt("front", m, { clientX: 30000 }); down(b); up(b);
  ok(DLT.getDraft().anchors.length === 2 && !finishOn(), "10: 같은 자리 두 점 = 비활성");
  DLT.finishDraw(); key("Enter");
  ok(lines().length === n0 && DLT.getMode() === "draw" && note() === "길이 0 인 선은 만들 수 없음 · 서로 다른 점 2개 이상 필요", "10: 같은 자리 두 점 완료(버튼·Enter) 거부 (" + note() + ")");
  key("Escape"); DLT.setMode("off");
}
// §11 버튼 완료(직선) — Enter 와 같은 commitDraft 경로 · 자동 선택 · 바로 절개선 · Delete
{
  const P = projectOn("A"), [m, h] = splittableFront(P.working.geometry);
  DLT.toggle(); click("front", m); click("front", h);
  const N0 = NOTIFY, n0 = lines().length;
  ok(DLT.finishDraw() === true && lines().length === n0 + 1, "11: 버튼 한 번 → 선 1개");
  const line = last();
  ok(line.segments.length === 1 && line.segments[0].kind === "line" && DLT.anchorsFromSegments(line.segments).length === 2, "11: 직선 1구간 · 앵커 2");
  autoSelected(line, "11 버튼");
  ok(!finishOn() && NOTIFY > N0, "11: 완료 뒤 버튼 비활성 · Design 통합 UI 갱신 신호");
  ok(DLT.finishDraw() === false && lines().length === n0 + 1 && DLT.getSelectedId() === line.id, "11: 완료 뒤 다시 눌러도(선택 모드) 무동작 · 선택 유지");
  DLT.setRole("cut");
  ok(line.role === "cut" && el("designCutStatus").textContent === "분리 가능" && el("btnDesignSplit").disabled === false, "11: 바로 «절개선» → «분리 가능» (" + el("designCutStatus").textContent + ")");
  key("Delete");
  ok(lines().length === n0 && DLT.getSelectedId() === null && roleBtnsDisabled(), "11: Delete → 삭제 · 선택 해제");
  DLT.setMode("off");
}
// §12 곡선(드래그 핸들) → 버튼 완료
{
  const P = projectOn("A"), [m, h] = splittableFront(P.working.geometry);
  DLT.toggle(); click("front", m);
  const d0 = evAt("front", h, { clientX: 40000, clientY: 0 }); down(d0);
  const hp = { x: h.x + 3, y: h.y + 2 };
  move(evAt("front", hp, { clientX: 40030, clientY: 20 })); up(evAt("front", hp, { clientX: 40030, clientY: 20 }));
  ok(finishOn() && lines().length === 0, "12: 곡선 드래그 뒤 활성 · 아직 선 없음");
  DLT.finishDraw();
  const line = last();
  ok(lines().length === 1 && line.segments[0].kind === "cubic", "12: 버튼 완료 → 곡선(cubic)");
  autoSelected(line, "12 곡선 버튼");
  DLT.setMode("off");
}
// §13 연속 2개 — 버튼 완료 → «선·곡선 그리기» → 버튼 완료
{
  const P = projectOn("A"), [m, h] = splittableFront(P.working.geometry);
  DLT.toggle(); click("front", m); click("front", h); DLT.finishDraw();
  const l1 = last(); DLT.setRole("cut");
  DLT.toggle();
  ok(DLT.getMode() === "draw" && !finishOn(), "13: 다음 선 그리기 시작 = 비활성");
  click("front", { x: m.x, y: m.y + 4 }); click("front", { x: h.x, y: h.y + 4 }); DLT.finishDraw();
  const l2 = last();
  ok(lines().length === 2 && l2.id !== l1.id && l1.role === "cut" && l2.role === "guide", "13: 둘째 선 추가 · 첫 선 cut 유지 · 둘째 guide");
  autoSelected(l2, "13 둘째 선");
  DLT.setMode("off");
}
// §14 그리기 밖 호출 무동작 · 버튼 요소 없음 안전
{
  projectOn("A");
  DLT.setMode("off");
  ok(DLT.finishDraw() === false && lines().length === 0 && DLT.getMode() === "off", "14: 꺼짐 모드에서 완료 호출 무동작");
  const saved = ELS.btnDesignFinish, getEl = sb.document.getElementById;
  sb.document.getElementById = id => id === "btnDesignFinish" ? null : el(id);
  let threw = false;
  try { const [m, h] = splittableFront(PROJECT.working.geometry); DLT.toggle(); click("front", m); click("front", h); DLT.finishDraw(); } catch (e) { threw = true; }
  sb.document.getElementById = getEl; ELS.btnDesignFinish = saved;
  ok(!threw && lines().length === 1, "14: 버튼 요소가 없어도 예외 없음 · 완료 동작");
  DLT.setMode("off");
}

// ── §15 hit 영역 = 화면 파생 몸판 ──
// 실제 hit layer 를 만들고(render 와 같은 인자), 도안 cm 클릭 좌표 → 맨 위 rect 부터 범위 검사(실제 x·y·width·height·translate) → DOM 타깃.
function hitLayer(P, scaleZ, legacy) {
  const root = sb.E("g"); ZM = scaleZ || 1;
  const L = DLy.ensureLayout(P);
  if (legacy) ["front", "back", "sleeve"].forEach(pc => sb._appendDesignHitRect(root, P.working.geometry, pc, L[pc], 10 * ZM));   // 종전(파생 범위 없음) 비교용
  else sb._appendDesignHitLayer(root, P, ["front", "back", "sleeve"], L, 10 * ZM);
  return root;
}
function rectOf(n) { const m = /translate\(([-\d.e]+),([-\d.e]+)\)/.exec(n.attrs.transform || "") || [0, 0, 0]; const x = +n.attrs.x + +m[1], y = +n.attrs.y + +m[2]; return { x0: x, y0: y, x1: x + +n.attrs.width, y1: y + +n.attrs.height }; }
function hitAt(root, drawCm) {   // 도안 cm → 화면 px(c2p) → 맨 위(나중에 붙은) rect 부터
  const px = sb.c2p(drawCm.x, drawCm.y);
  for (let i = root.children.length - 1; i >= 0; i--) { const r = rectOf(root.children[i]); if (px[0] >= r.x0 && px[0] <= r.x1 && px[1] >= r.y0 && px[1] <= r.y1) return root.children[i]; }
  return null;
}
const toDraw = (P, pc, g) => { const o = DLy.ensureLayout(P)[pc]; return { x: g.x + o.dx, y: g.y + o.dy }; };
// 피스 좌표 g 를 그 피스 자리에서 클릭 — 타깃은 hit layer 가 고른다(없으면 svg 바탕 = closest null).
function evHit(root, P, pc, g, extra) {
  const d = toDraw(P, pc, g), t = hitAt(root, d);
  CLX += 100;
  return Object.assign({ button: 0, pointerId: 1, clientX: CLX, clientY: 0, altKey: false, shiftKey: false, px: d.x, py: d.y,
    target: t || { closest: () => null }, stopPropagation() {}, preventDefault() {} }, extra || {});
}
const clickHit = (root, P, pc, g) => { const e = evHit(root, P, pc, g); down(e); up(e); return e.target; };
function inPoly(fl, q) { let c = false; fl.forEach(([a, b]) => { if ((a.y > q.y) !== (b.y > q.y) && q.x < a.x + (b.x - a.x) * (q.y - a.y) / (b.y - a.y)) c = !c; }); return c; }
const PAD_CM = 0.35;   // hit rect 패딩 3px(=0.3cm @ 10px/cm) 바깥
// 파생 앞판 내부 중 원래 몸판 hit 범위(bboxOf ± 패딩) 밖인 표본점
function extensionSamples(P, pc) {
  const dpc = DLT.displayedDerivedPiece(P, pc); if (!dpc) return [];
  const fd = flat(dpc.outline), ob = DLy.bboxOf(P.working.geometry, pc), db = DLy.bboxOfStand({ outline: dpc.outline }), out = [];
  for (let i = 1; i < 60; i++) for (let j = 1; j < 60; j++) {
    const q = { x: db.minX + (db.maxX - db.minX) * i / 60, y: db.minY + (db.maxY - db.minY) * j / 60 };
    if (!inPoly(fd, q)) continue;
    if (q.x < ob.minX - PAD_CM || q.x > ob.maxX + PAD_CM || q.y < ob.minY - PAD_CM || q.y > ob.maxY + PAD_CM) out.push(q);
  }
  return out;
}
const EXT_SEEN = {};
// 실제 화면 배치: refreshAutoLayout 과 같은 autoLayout(geometry, 표시 범위 dolmanExtents) — 파생 몸판 범위만큼 피스 간격을 띄운다.
//   (다른 절의 고정 배치 앞 40·소매 80 은 파생 몸판이 소매 자리까지 닿아 인접 rect 가 겹친다 — 실제 화면 배치가 아님)
function autoPlace(P) { const a = DLy.autoLayout(P.working.geometry, W.sleeveAnnotation.dolmanExtents(P)); ["front", "back", "sleeve"].forEach(k => { P.working.layout[k] = { dx: a[k].dx, dy: a[k].dy }; }); }
[["Z", true], ["V", false], ["X", false], ["Y", false]].forEach(([sym, full]) => {
  const P = projectOn("A");
  ok(API(sym).apply(P, defaultsOf(sym)).ok && doneAll(P), "15 " + sym + ": 소매·카라 완료");
  autoPlace(P);
  const bJ = J(P.working.bodiceResult), sJ = J(SC.latest(P)), rJ = J(P.referenceGeometry), gJ = J(P.working.geometry);
  const root = hitLayer(P), old = hitLayer(P, 1, true);
  const rect = pc => root.children.find(n => n.attrs["data-layout-piece"] === pc);
  ["front", "back"].forEach(pc => {
    const dpc = DLT.displayedDerivedPiece(P, pc), r = rectOf(rect(pc)), db = DLy.bboxOfStand({ outline: dpc.outline }), o = DLy.ensureLayout(P)[pc];
    const [ax, ay] = sb.c2p(db.minX + o.dx, db.minY + o.dy), [bx, by] = sb.c2p(db.maxX + o.dx, db.maxY + o.dy);
    ok(rect(pc).attrs["data-hit-extent"] === "derived" && r.x0 <= ax && r.y0 <= ay && r.x1 >= bx && r.y1 >= by, "15 " + sym + " " + pc + ": hit rect ⊇ 화면 파생 외곽 범위(DOM rect 실측)");
  });
  ok(rect("sleeve") ? rect("sleeve").attrs["data-hit-extent"] === "original" : true, "15 " + sym + ": 소매 피스 rect 는 종전 범위");
  // 인접 피스 오선택 없음: 각 피스의 화면 외곽(앞·뒤 = 파생 · 소매 = 원래) 꼭짓점을 그 피스 자리에서 hit → 자기 피스
  let wrong = [];
  ["front", "back"].forEach(pc => flat(DLT.displayedDerivedPiece(P, pc).outline).forEach(([a]) => { const t = hitAt(root, toDraw(P, pc, a)); if (!t || t.attrs["data-layout-piece"] !== pc) wrong.push(pc + "@" + a.x.toFixed(1) + "," + a.y.toFixed(1) + "→" + (t ? t.attrs["data-layout-piece"] : "없음")); }));
  if (P.working.geometry.sleeve && P.working.geometry.sleeve.outline) flat(P.working.geometry.sleeve.outline).forEach(([a]) => { const t = hitAt(root, toDraw(P, "sleeve", a)); if (!t || t.attrs["data-layout-piece"] !== "sleeve") wrong.push("sleeve@" + a.x.toFixed(1) + "→" + (t ? t.attrs["data-layout-piece"] : "없음")); });
  ok(wrong.length === 0, "15 " + sym + ": 화면 외곽 꼭짓점이 모두 자기 피스로 잡힘(인접 피스 오선택 0) " + wrong.slice(0, 3).join(" "));
  const ext = extensionSamples(P, "front").concat(extensionSamples(P, "back").map(q => Object.assign({ back: true }, q)));
  EXT_SEEN[sym] = ext.length;
  const lost = ext.filter(q => { const t = hitAt(root, toDraw(P, q.back ? "back" : "front", q)); return !t || t.attrs["data-layout-piece"] !== (q.back ? "back" : "front"); });
  ok(lost.length === 0, "15 " + sym + ": 원래 외곽 밖 파생 표본 " + ext.length + "점 전부 자기 피스로 잡힘 (놓침 " + lost.length + ")");
  if (full) {
    ok(ext.filter(q => !q.back).length >= 4, "15 " + sym + ": 앞판 원래 외곽 밖 파생 연장부 존재 (" + ext.filter(q => !q.back).length + "점)");
    const oldLost = ext.filter(q => !q.back && !hitAt(old, toDraw(P, "front", q)));
    ok(oldLost.length > 0, "15 " + sym + ": 종전 rect(원래 범위)로는 연장부 클릭을 놓침 (" + oldLost.length + "점 — 고친 버그 재현)");
    // 대표·경계: 연장부 표본 중 가장 바깥(minX) 과 가운데 — 둘 다 앞판 rect
    const fx = ext.filter(q => !q.back).sort((a, b) => a.x - b.x), edge = fx[0], mid = fx[Math.floor(fx.length / 2)];
    [edge, mid].forEach((q, k) => { const t = hitAt(root, toDraw(P, "front", q)); ok(t && t.attrs["data-layout-piece"] === "front" && t.attrs["data-hit-extent"] === "derived", "15 " + sym + ": " + (k ? "대표" : "경계") + " 연장부 점 → 앞판 hit(DOM 타깃) (" + q.x.toFixed(2) + "," + q.y.toFixed(2) + ")"); });
    // 연장부에서 시작하는 실제 선: 그 높이의 파생 외곽 교차 두 점(바깥 끝은 원래 범위 밖) → 클릭(hit 타깃) → 완료 버튼 → 절개선
    const fd = flat(DLT.displayedDerivedPiece(P, "front").outline), ob = DLy.bboxOf(P.working.geometry, "front");
    let ln = null;
    for (const q of fx) { const xs = hcross(fd, q.y); if (xs.length !== 2 || xs[0] > ob.minX - PAD_CM - 0.2) continue; const s0 = { x: xs[0] + 0.15, y: q.y }, s1 = { x: xs[1] - 0.15, y: q.y };
      if (DLT.validateCut({ role: "cut", segments: [{ kind: "line", from: { x: xs[0], y: q.y }, to: { x: xs[1], y: q.y } }] }, fd, []).ok) { ln = [s0, s1]; break; } }
    ok(!!ln, "15 " + sym + ": 연장부에서 시작하는 유효 절개선 후보 찾음");
    if (ln) {
      DLT.setMode("off"); DLT.toggle();
      const tOld = clickHit(old, P, "front", ln[0]);
      ok(tOld && !tOld.attrs && !DLT.getDraft() && note() === "피스 위를 클릭하세요", "15 " + sym + ": 종전 rect → 시작 클릭이 피스 밖(«" + note() + "»)");
      const t0 = clickHit(root, P, "front", ln[0]);
      ok(t0.attrs && t0.attrs["data-layout-piece"] === "front" && !!DLT.getDraft() && DLT.getDraft().piece === "front", "15 " + sym + ": 새 rect → 연장부 시작 클릭이 앞판(DOM 타깃 data-layout-piece=front)");
      const a0 = DLT.getDraft().anchors[0].p;
      ok(a0.x < ob.minX && DLT.distPtToSegs(a0, fd) < 1e-6, "15 " + sym + ": 시작점 = 원래 외곽 밖 · 파생 외곽에 snap (x " + a0.x.toFixed(2) + " < " + ob.minX.toFixed(2) + ")");
      ok(!finishOn(), "15 " + sym + ": 한 점 = 완료 비활성");
      clickHit(root, P, "front", ln[1]);
      ok(finishOn(), "15 " + sym + ": 두 점 = 완료 활성");
      const n0 = lines().length; DLT.finishDraw();
      const line = last();
      ok(lines().length === n0 + 1, "15 " + sym + ": 완료 버튼 → 선 1개");
      autoSelected(line, "15 " + sym);
      DLT.setRole("cut");
      ok(line.role === "cut" && /^유효 절개선 — 소매 Ⓩ/.test(el("designCutStatus").textContent) && el("btnDesignSplit").disabled === true, "15 " + sym + ": 바로 «절개선» → 최종 몸판 «유효» · 분리 비활성 (" + el("designCutStatus").textContent + ")");
      DLT.setMode("off");
    }
    // 배치 오프셋·zoom: 앞판을 옮기고 배율을 바꿔도 같은 연장부 점이 앞판으로 잡힌다(rect 가 피스 transform 을 따라감)
    const L0 = J(P.working.layout);
    P.working.layout.front = { dx: P.working.layout.front.dx + 7, dy: P.working.layout.front.dy + 3 };
    [0.5, 2].forEach(z => { const r2 = hitLayer(P, z), t = hitAt(r2, toDraw(P, "front", edge)); ok(t && t.attrs["data-layout-piece"] === "front", "15 " + sym + ": 앞판 이동(+7,+3) · zoom ×" + z + " → 경계 연장부 점 앞판 hit"); });
    P.working.layout = JSON.parse(L0); ZM = 1;
    // 차단 상태 = 파생 몸판이 그려지지 않음 → hit 도 원래 범위(표시 조건 공유)
    const st = P.working["sleeve" + sym], bk = st.blocked; st.blocked = { reason: "test", text: "검사용 차단" };
    const rb = hitLayer(P);
    ok(rb.children.every(n => n.attrs["data-hit-extent"] === "original") && !hitAt(rb, toDraw(P, "front", edge)), "15 " + sym + ": 차단 상태 → 원래 범위 hit(연장부 클릭 안 잡힘 — 그려지지 않으므로)");
    if (bk === undefined) delete st.blocked; else st.blocked = bk;
  }
  ok(J(P.working.bodiceResult) === bJ && J(SC.latest(P)) === sJ && J(P.referenceGeometry) === rJ && J(P.working.geometry) === gJ, "15 " + sym + ": 원형·bodiceResult·sleeveResult·working.geometry 불변");
});
// 원래 몸판(파생 없음) — rect 범위·속성이 종전과 같다
{
  const P = projectOn("A"); autoPlace(P); const nw = hitLayer(P), old = hitLayer(P, 1, true);
  ok(nw.children.length === old.children.length && nw.children.every((n, i) => J(rectOf(n)) === J(rectOf(old.children[i])) && n.attrs["data-layout-piece"] === old.children[i].attrs["data-layout-piece"] && n.attrs["data-hit-extent"] === "original"),
    "15 원래 몸판: hit rect 범위·피스 = 종전(파생 범위 미사용)");
  const [m, h] = splittableFront(P.working.geometry);
  DLT.toggle(); const t = clickHit(nw, P, "front", m); clickHit(nw, P, "front", h); DLT.finishDraw();
  ok(t.attrs["data-layout-piece"] === "front" && lines().length === 1, "15 원래 몸판: hit 타깃 클릭 2 → 완료 버튼 → 선 1개");
  DLT.setRole("cut");
  ok(el("designCutStatus").textContent === "분리 가능" && el("btnDesignSplit").disabled === false, "15 원래 몸판: «절개선» → «분리 가능» · 분리 활성(종전 정책)");
  DLT.setMode("off");
}

// ── §16 완료 판정 = 실제 퇴화 geometry ──
{
  // 순수 판정 대조(segmentsFromAnchors 결과 그대로)
  const A = { x: 30, y: 20 }, an = (p, h) => ({ p: p, h: h || null });
  ok(DLT.lineDegenerate(DLT.segmentsFromAnchors([an(A), an(A)])) === true, "16: 같은 자리 두 점(핸들 없음) = 퇴화");
  ok(DLT.lineDegenerate(DLT.segmentsFromAnchors([an(A), an(A, { x: 0, y: 0 })])) === true, "16: 같은 자리 · 핸들 0 = 퇴화(모든 제어점 한 점)");
  ok(DLT.lineDegenerate(DLT.segmentsFromAnchors([an(A), an(A, { x: 3, y: 2 })])) === false, "16: 같은 자리 두 앵커 · 핸들 있음 = 비퇴화(닫힌 곡선)");
  ok(DLT.lineDegenerate(DLT.segmentsFromAnchors([an(A, { x: 1, y: 0 }), an(A)])) === true, "16: 첫 앵커 핸들은 다음 앵커가 직선이면 쓰이지 않음 → 퇴화(실제 생성 결과 기준)");
  ok(DLT.lineDegenerate(DLT.segmentsFromAnchors([an(A), an(A), an({ x: 31, y: 20 })])) === false, "16: 일부 구간만 0 이고 전체 길이 있음 = 비퇴화(종전과 같음)");
  ok(DLT.lineDegenerate([]) === true, "16: 구간 없음 = 퇴화");
}
{
  const P = projectOn("A"), [m] = splittableFront(P.working.geometry);
  // (a) 같은 자리 두 앵커 + 핸들 곡선 → 버튼
  const curveDraft = (cx) => { DLT.setMode("off"); DLT.toggle(); const a = evAt("front", m, { clientX: cx }); down(a); up(a);
    const d0 = evAt("front", m, { clientX: cx + 10000, clientY: 0 }); down(d0); const hp = { x: m.x + 3, y: m.y + 2 };
    move(evAt("front", hp, { clientX: cx + 10030, clientY: 20 })); up(evAt("front", hp, { clientX: cx + 10030, clientY: 20 })); };
  curveDraft(100000);
  const dr = DLT.getDraft(), aa = dr.anchors;
  ok(aa.length === 2 && Math.hypot(aa[0].p.x - aa[1].p.x, aa[0].p.y - aa[1].p.y) < 1e-9 && !!aa[1].h, "16a: 초안 = 같은 자리 두 앵커 + 핸들");
  ok(finishOn() && DLT.canFinishDraw(), "16a: 완료 버튼 활성(실제 길이 있는 곡선)");
  DLT.finishDraw();
  let l = last();
  const len = DLT.flattenLine(l.segments).reduce((s2, ab) => s2 + Math.hypot(ab[1].x - ab[0].x, ab[1].y - ab[0].y), 0);
  ok(lines().length === 1 && l.segments[0].kind === "cubic" && J(l.segments[0].from) === J(l.segments[0].to) && len > 1, "16a: 버튼 → 닫힌 곡선 생성(양끝 같음 · 길이 " + len.toFixed(2) + "cm)");
  autoSelected(l, "16a 버튼");
  // (b) 같은 곡선 → Enter
  curveDraft(200000); key("Enter");
  ok(lines().length === 2 && last().segments[0].kind === "cubic", "16b: Enter → 같은 곡선 완료(종전 Enter 와 같음)");
  // (c) 같은 곡선 → 더블클릭(드래그 뒤 같은 자리 빠른 재클릭)
  curveDraft(300000);
  const q = evAt("front", m, { clientX: 300000 + 10001, clientY: 0 }); down(q); up(q);
  ok(lines().length === 3 && last().segments[0].kind === "cubic" && DLT.anchorsFromSegments(last().segments).length === 2, "16c: 더블클릭 → 같은 곡선 완료(중복점 미추가)");
  // (d) 완전 퇴화(같은 자리 두 점 · 핸들 없음) → 버튼·Enter·더블클릭 모두 거부
  DLT.setMode("off"); DLT.toggle();
  const p1 = evAt("front", m, { clientX: 400000 }); down(p1); up(p1);
  const p2 = evAt("front", m, { clientX: 500000 }); down(p2); up(p2);
  ok(DLT.getDraft().anchors.length === 2 && !finishOn() && !DLT.canFinishDraw(), "16d: 같은 자리 두 점 = 비활성");
  DLT.finishDraw(); key("Enter");
  const p3 = evAt("front", m, { clientX: 500001 }); down(p3); up(p3);   // 직전 눌림과 같은 자리 · 400ms 안 = 더블클릭
  ok(lines().length === 3 && DLT.getMode() === "draw" && /길이 0/.test(note()), "16d: 버튼·Enter·더블클릭 모두 거부(선 없음 · 그리기 유지) (" + note() + ")");
  key("Escape"); DLT.setMode("off");
}

// §17 «선 가까이» 막대의 «파트 분리»(2026-11-05 김님 요청) — 오른쪽 «파트 분리»와 같은 판정·같은 명령.
//   막대 모듈(js/designLineQuickBar.js)을 이 designLineTool 에 붙여, 막대 버튼이 부르는 actSplit·막대 표시 모델(viewModel)을 그대로 쓴다.
{
  const qb = { window: { designLineTool: DLT, isDesignStageActive: () => true }, Math, JSON };
  vm.createContext(qb); vm.runInContext(fs.readFileSync(path.join(ROOT, "js/designLineQuickBar.js"), "utf8"), qb, { filename: "designLineQuickBar.js" });
  const Q = qb.window.designLineQuickBar, pv = () => Q.viewModel(), sp = () => (pv() || {}).split || null;
  const same = tag => { const v = sp(), b = el("btnDesignSplit"); ok(!!v && v.allowed === (b.disabled === false), tag + ": 막대 활성 = 오른쪽 «파트 분리» 활성 (" + (v && v.allowed) + " / " + !b.disabled + ")"); return v; };
  const area = segs => { const pts = []; DLT.flattenLine(segs).forEach(([a, b], i) => { if (!i) pts.push(a); pts.push(b); }); let A = 0; for (let i = 0; i < pts.length; i++) { const u = pts[i], w = pts[(i + 1) % pts.length]; A += u.x * w.y - w.x * u.y; } return Math.abs(A / 2); };
  const drawCut = (P, a, b) => { DLT.toggle(); click("front", a); click("front", b); DLT.finishDraw(); DLT.setRole("cut"); return last(); };

  // (a) 원래 몸판 유효 절개선 → 막대 «분리 가능» → 막대 «파트 분리» → 두 파트 = 오른쪽 버튼(doSplit) 결과와 바이트 동일
  const P1 = projectOn("A"), [m, h] = splittableFront(P1.working.geometry);
  const L1 = drawCut(P1, m, h), bJ1 = J(P1.working.bodiceResult), rJ1 = J(P1.referenceGeometry), gJ1 = J(P1.working.geometry);
  let v = same("17a 원래 몸판 유효");
  ok(v && v.allowed && v.text === "분리 가능" && el("designCutStatus").textContent === "분리 가능", "17a: 막대 문구 «분리 가능» = 오른쪽 상태 (" + (v && v.text) + ")");
  ok(Q.actSplit() === true && (P1.working.parts || []).length === 2 && P1.working.parts.every(q => q.sourceCutId === L1.id && q.sourcePiece === "front"), "17a: 막대 «파트 분리» → 파트 2개(이 절개선 · 앞판)");
  const partsJ = J(P1.working.parts);
  const legs = (P1.working.geometry.front.construction || []).filter(c => c.kind === "line").map(c => ({ from: c.from, to: c.to }));
  const ring = DLT.buildPieceRing(DLT.outlinePrimsToSegs(P1.working.geometry.front.outline), legs).ring;
  const a1 = area(P1.working.parts[0].outline), a2 = area(P1.working.parts[1].outline), aR = area(ring.map(r => r.seg));
  ok(a1 > 1 && a2 > 1 && Math.abs(a1 + a2 - aR) < 1e-6 * aR, "17a: 두 파트 면적 합 = 앞판 면적(" + (a1 + a2).toFixed(4) + " / " + aR.toFixed(4) + ")");
  v = sp();
  ok(v && v.allowed && v.parts === 2 && /^분리됨 · 파트 2개/.test(v.text) && el("btnDesignSplit").disabled === false, "17a: 분리 뒤 막대 «분리됨 · 파트 2개» · 오른쪽 버튼 그대로 (" + (v && v.text) + ")");
  ok(J(P1.working.bodiceResult) === bJ1 && J(P1.referenceGeometry) === rJ1 && J(P1.working.geometry) === gJ1, "17a: 원형·bodiceResult·geometry 불변(파트만)");
  // 같은 선을 오른쪽 버튼 경로(index.html onclick = designLineTool.doSplit)로 → 같은 파트
  P1.working.parts = []; DLT.doSplit();
  ok(J(P1.working.parts) === partsJ, "17a: 막대 결과 = 오른쪽 «파트 분리»(doSplit) 결과(바이트 동일)");
  // 역할을 바꾸면 분리 행 없음(파트도 기존 계약대로 무효화)
  DLT.setRole("guide");
  ok(pv() && pv().kind === "select" && !sp() && !(P1.working.parts || []).length, "17a: 보조선으로 바꾸면 분리 행 숨김 · 파트 무효화(종전 계약)");
  DLT.setRole("boundary");
  ok(!sp(), "17a: 외곽 역할도 분리 행 숨김");
  DLT.setRole("cut");
  ok(!!sp() && sp().allowed, "17a: 다시 절개선 → 분리 행 · 분리 가능");
  DLT.setMode("off");
  ok(!pv(), "17a: 도구 끄면 막대 없음");

  // (b) 무효 절개선(외곽에 안 닿는 안쪽 선) → 막대 비활성 + 같은 이유 · 눌러도 무변경
  const P2 = projectOn("A"), [m2, h2] = splittableFront(P2.working.geometry);
  const mid = (u, w, t) => ({ x: u.x + (w.x - u.x) * t, y: u.y + (w.y - u.y) * t });
  drawCut(P2, mid(m2, h2, 0.3), mid(m2, h2, 0.7));
  v = same("17b 무효 절개선");
  const rs = el("designCutStatus").textContent, nt0 = el("designSplitNote").textContent;
  ok(v && !v.allowed && v.text === "분리 불가 · " + rs && rs.length > 0 && rs !== "분리 가능", "17b: 막대 «분리 불가 · " + rs + "» = 오른쪽 상태 문구");
  ok(Q.actSplit() === false && !(P2.working.parts || []).length && el("designSplitNote").textContent === nt0, "17b: 비활성 막대 누름 = 파트·안내 무변경");
  DLT.setMode("off");

  // (c) 최종 몸판 미확정(소매 Ⓥ 적용 · 완료 전) / (d) 소매 변경(Ⓥ 완료 → Ⓩ 적용) / (e) Ⓥ·Ⓩ 완료(파생 몸판 · 분리 미지원)
  const cases = [
    ["c Ⓥ 완료 전", P => { ok(API("V").apply(P, defaultsOf("V")).ok, "17c: Ⓥ 적용"); }, "pending", /^분리 불가 · 최종 몸판 미확정 — 소매 Ⓥ 모양 완료 전$/],
    ["d Ⓥ→Ⓩ 변경", P => { ok(API("V").apply(P, defaultsOf("V")).ok && doneAll(P) && API("Z").apply(P, defaultsOf("Z")).ok, "17d: Ⓥ 완료 → Ⓩ 적용"); }, "pending", /^분리 불가 · 최종 몸판 미확정 — 완료된 소매는 Ⓥ, 현재 소매는 Ⓩ$/],
    ["e Ⓥ 완료", P => { ok(API("V").apply(P, defaultsOf("V")).ok && doneAll(P), "17e: Ⓥ 완료"); }, "derived", /^분리 불가 · 소매 Ⓥ 파생 몸판은 파트 분리 미지원\(원래 몸판 전용\)$/],
    ["e Ⓩ 완료", P => { ok(API("Z").apply(P, defaultsOf("Z")).ok && doneAll(P), "17e: Ⓩ 완료"); }, "derived", /^분리 불가 · 소매 Ⓩ 파생 몸판은 파트 분리 미지원\(원래 몸판 전용\)$/]
  ];
  cases.forEach(([tag, setup, kind, re]) => {
    const P = projectOn("A"); setup(P);
    const sres = SC.latest(P), b = P.working.bodiceResult, bJ = J(b), sJ = J(sres), rJ = J(P.referenceGeometry);
    const dPiece = DLT.displayedDerivedPiece(P, "front"), [p0, p1] = dPiece ? derivedOnlyLine(dPiece, b.front) : [null, null];
    const [q0, q1] = p0 ? [{ x: p0.x + 0.15, y: p0.y }, { x: p1.x - 0.15, y: p1.y }] : splittableFront(P.working.geometry);
    drawCut(P, q0, q1);
    v = same("17" + tag);
    const st = DLT.getSplitState();
    ok(v && !v.allowed && st && st.kind === kind && re.test(v.text), "17" + tag + ": 막대 «" + (v && v.text) + "» (" + (st && st.kind) + ")");
    ok(kind !== "derived" || /원래 몸판 전용/.test(el("btnDesignSplit").title || ""), "17" + tag + ": 오른쪽 버튼 설명도 같은 이유(원래 몸판 전용)");
    ok(Q.actSplit() === false && !(P.working.parts || []).length, "17" + tag + ": 막대 누름 = 분리 없음");
    ok(J(P.working.bodiceResult) === bJ && J(SC.latest(P)) === sJ && J(P.referenceGeometry) === rJ, "17" + tag + ": 원형·bodiceResult·sleeveResult 불변");
    DLT.setMode("off");
  });
  // 판정 재사용: 막대 표시 모델을 여러 번 만들어도 최종 몸판 판정(editBodiceRef)을 다시 하지 않는다
  {
    const P = projectOn("A"); API("V").apply(P, defaultsOf("V")); doneAll(P);
    const dPiece = DLT.displayedDerivedPiece(P, "front"), [p0, p1] = derivedOnlyLine(dPiece, P.working.bodiceResult.front);
    drawCut(P, { x: p0.x + 0.15, y: p0.y }, { x: p1.x - 0.15, y: p1.y });
    const SCk = W.sleeveCheckpoint, orig = SCk.latest; let calls = 0; SCk.latest = function () { calls++; return orig.apply(this, arguments); };
    for (let i = 0; i < 20; i++) pv();
    SCk.latest = orig;
    ok(calls === 0, "17f: 막대 표시 20회 = 최종 몸판 재판정 0회(오른쪽 버튼이 쓴 판정 재사용) (" + calls + ")");
    DLT.setMode("off");
  }
}

// 배선: index.html 버튼 onclick 이 이 검사가 부르는 함수 그대로인지(가짜 경로 방지)
{
  const HTML = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  ok(/id="btnDesignLine"[^>]*onclick="designLineTool\.toggle\(\)"/.test(HTML) && /id="btnDesignSelect"[^>]*onclick="designLineTool\.toggleSelect\(\)"/.test(HTML) &&
     /id="btnRoleCut"[^>]*onclick="designLineTool\.setRole\('cut'\)"/.test(HTML), "9: index.html 버튼 onclick 배선");
  ok(/id="btnDesignFinish"[^>]*onclick="designLineTool\.finishDraw\(\)"[^>]*disabled[^>]*aria-disabled="true"[^>]*>그리기 완료</.test(HTML), "9: «그리기 완료» 버튼 배선 · 처음 비활성(aria-disabled)");
  const iL = HTML.indexOf('id="btnDesignLine"'), iF = HTML.indexOf('id="btnDesignFinish"'), iS = HTML.indexOf('id="btnDesignSelect"');
  ok(iL > 0 && iL < iF && iF < iS, "9: 기존 도구 줄(그리기 · 완료 · 선택·편집) 안에 배치");
}

// 2026-11-11 김님 «카라 M 기본형 적용했는데 선 수정이 안 된다»: «본체 직접 수정»은 관리선을 만든 뒤 바로 선택·편집 모드로 들어간다
//   (작성 중 그리기는 버리지 않음). 이전엔 아래 «선택·편집»을 따로 켜기 전까지 칼라를 눌러도 아무 일이 없었다.
{
  const U = fs.readFileSync(path.join(ROOT, "js", "ui.js"), "utf8"), at = U.indexOf("function onCollarBodyManual()"), end = U.indexOf("function onCollarBodyRevert()", at);
  const body = U.slice(at, end);
  ok(at > 0 && /if \(T\.getMode\(\) !== "select" && !\(T\.getMode\(\) === "draw" && T\.getDraft\(\)\)\) T\.setMode\("select"\);/.test(body)
    && body.indexOf('T.setMode("select")') > body.indexOf('managedBy: "collar-body"'), "collar-manual: 본체 직접 수정 → 관리선 생성 뒤 선택·편집 모드 진입(그리기 중 draft 보존)");
}

console.log("  원래 외곽 밖 파생 표본점(앞+뒤): " + Object.entries(EXT_SEEN).map(([k, v]) => k + " " + v).join(" · "));
console.log("lineAutoSelectCheck: " + PASS + " passed, " + FAIL + " failed");
if (FAIL) { fails.slice(0, 40).forEach(f => console.log("  FAIL " + f)); process.exit(1); }
