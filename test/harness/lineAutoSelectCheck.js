// ══════════════════════════════════════════════
// lineAutoSelectCheck.js — 패턴선 완료 직후 자동 선택(2026-11-05 김님 실사용 피드백 «선택·편집 → 같은 선 재클릭» 두 단계 제거).
//   새 동선: 선·곡선 그리기 → Enter 또는 더블클릭으로 정상 완료 → 방금 그린 선이 선택·편집 상태(역할 버튼 활성 · 핸들 표시) →
//   절개선/외곽/보조선 바로 선택. 다시 그리기 = «선·곡선 그리기» 버튼. 기본 역할 guide · 자동 역할 지정 없음.
//   **designLineTool 이 실제로 등록한 svg/document 핸들러**(pointerdown·move·up·keydown)를 피스 offset 을 거친 도안 cm 이벤트로 호출한다.
//   역할·모드 버튼은 index.html 의 onclick 이 부르는 함수 그대로(setRole · toggle · toggleSelect)를 부른다.
//   §1 Enter 완료(직선) · §2 더블클릭 완료(중복점 미추가) · §3 곡선(드래그 핸들) · §4 미완성 한 점·Esc 취소 = 자동 완료·선택 없음
//   §5 연속 2개 그리기(버튼 한 번) · §6 자동 선택 뒤 역할 변경·앵커 드래그·Delete · §7 관리형 선 잠금 불변 · §8 최종 몸판(Ⓩ·Ⓥ) snap·판정 정책 불변
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
  ok(DLT.getMode() === "draw" && el("btnDesignLine").textContent === "그리기 종료", "1: 그리기 시작");
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
  ok(DLT.getMode() === "draw" && DLT.getSelectedId() === null && roleBtnsDisabled() && el("btnDesignLine").textContent === "그리기 종료" && el("btnDesignSelect").textContent === "선택·편집",
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
["Z", "V"].forEach(sym => {
  const P = projectOn("A");
  ok(API(sym).apply(P, defaultsOf(sym)).ok && doneAll(P), "8 " + sym + ": 소매·카라 완료");
  const sres = SC.latest(P), b = P.working.bodiceResult, bJ = J(b), sJ = J(sres), rJ = J(P.referenceGeometry);
  const fd = flat(sres.derivedBodice.front.outline);
  const [p0, p1] = derivedOnlyLine(sres.derivedBodice.front, b.front);
  ok(!!p0, "8 " + sym + ": 파생 외곽 전용 시험 선 찾음");
  DLT.toggle();
  const n0 = (v, d) => ({ x: v.x + d, y: v.y });
  click("front", n0(p0, 0.15)); click("front", n0(p1, -0.15)); key("Enter");   // 0.15cm 떨어져 클릭 → snap 으로 파생 외곽에 붙는다
  const line = last();
  ok(DLT.distPtToSegs(line.segments[0].from, fd) < 1e-6 && DLT.distPtToSegs(line.segments[0].to, fd) < 1e-6, "8 " + sym + ": 그리기 snap = 화면 파생 외곽(거리 0)");
  autoSelected(line, "8 " + sym);
  DLT.setRole("cut");
  const st = el("designCutStatus").textContent;
  ok(new RegExp("^유효 절개선 — 소매 " + (sym === "Z" ? "Ⓩ" : "Ⓥ")).test(st) && el("btnDesignSplit").disabled === true, "8 " + sym + ": 바로 «절개선» → 최종 몸판 판정 «유효» · 분리 비활성(종전 정책) (" + st + ")");
  DLT.doSplit();
  ok(!(P.working.parts || []).length && /원래 몸판 전용/.test(el("designSplitNote").textContent), "8 " + sym + ": 분리 실행 거부(종전 정책)");
  const c = DR.check(P);
  ok(c.ok && (c._cuts || []).some(x => x.piece === "front" && J(x.segments) === J(line.segments)), "8 " + sym + ": Design 완료 판정에 같은 선 포함");
  ok(J(P.working.bodiceResult) === bJ && J(SC.latest(P)) === sJ && J(P.referenceGeometry) === rJ, "8 " + sym + ": 원형·bodiceResult·sleeveResult 불변");
  DLT.setMode("off");
});

// 배선: index.html 버튼 onclick 이 이 검사가 부르는 함수 그대로인지(가짜 경로 방지)
{
  const HTML = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  ok(/id="btnDesignLine"[^>]*onclick="designLineTool\.toggle\(\)"/.test(HTML) && /id="btnDesignSelect"[^>]*onclick="designLineTool\.toggleSelect\(\)"/.test(HTML) &&
     /id="btnRoleCut"[^>]*onclick="designLineTool\.setRole\('cut'\)"/.test(HTML), "9: index.html 버튼 onclick 배선");
}

console.log("lineAutoSelectCheck: " + PASS + " passed, " + FAIL + " failed");
if (FAIL) { fails.slice(0, 40).forEach(f => console.log("  FAIL " + f)); process.exit(1); }
