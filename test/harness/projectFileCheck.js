// ══════════════════════════════════════════════
// projectFileCheck.js — 프로젝트 저장·열기(js/projectFile.js · 2026-11-09 김님 승인)
//   node test/harness/projectFileCheck.js
//   세션 = 독립 vm context 하나(실제 blockWorkflow·designWorkflow·checkpoint·designLineTool 모듈) — 저장 세션과 여는 세션은 객체를 공유하지 않는다.
//   §0 그래프 인코딩 — 공유 참조·순환·undefined·-0·deep/shallow freeze 충실 복원 · NaN/Infinity/Map/함수/금지 키 거부
//   §1 박시 Ⓐ + 곡선 밑단(뒤 중심-밑단 → 옆선) + 수정 소매(Ⓐ 뒤 옆선 외곽 반영) + 카라 + Design 완료 → 저장 → 빈 세션 열기:
//        그래프 바이트 동일(geometry·선·완료본·hash·배치·단계·freeze·alias) · 완료/변경됨 재계산 동일 · 이어서 같은 편집 → 두 세션 같은 결과
//   §2 «변경됨» 상태(완료 뒤 소매 입력 변경) · §3 «미완료» 상태(소매 적용만 · 카라 없음) 저장 → 열기 동일
//   §4 거부 — 깨짐·잘림·빈·타 형식·곡선 JSON·미지원 version·무결성 변조·hash 재계산 변조(완료본·원형)·__proto__·1e999 → 현재 세션 0 변경
//   §5 저장 전 마무리 — 그리는 중 선 = 저장 거부(조용한 유실 없음) · 교체 실패 시 원형 완료본 되돌림
// ══════════════════════════════════════════════
"use strict";
const vm = require("vm");
const fs = require("fs");
const path = require("path");

let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
process.on("uncaughtException", e => { console.log("projectFileCheck: 예외 — " + (e && e.stack || e).toString().split("\n").slice(0, 3).join(" | ")); fails.slice(0, 20).forEach(f => console.log("  ✗ " + f)); process.exit(1); });
const J = JSON.stringify;
const ROOT = path.join(__dirname, "..", "..");
const SYMS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));
const REFSLEEVE = () => {
  const cap = { kind: "path", commands: [{ type: "M", points: [{ x: 5.53, y: 66.42 }] }, { type: "C", points: [{ x: 12, y: 56 }, { x: 18, y: 53 }, { x: 23.75, y: 53 }] }, { type: "C", points: [{ x: 29, y: 53 }, { x: 35, y: 56 }, { x: 39.29, y: 66.42 }] }] };
  const line = (a, b) => ({ kind: "line", from: { x: a[0], y: a[1] }, to: { x: b[0], y: b[1] } });
  return { outline: [cap, line([5.53, 66.42], [7.56, 105]), line([39.29, 66.42], [37.56, 105]), line([7.56, 105], [37.56, 105])], construction: [] };
};
const SNAPSHOT = () => ({ schemaVersion: 8,
  source: { measurements: { B: 83, W: 64, BL: 38, SL: 52, Hem: 30, capAdj: 0, capFormula: "bunka", dartTotal: 12 }, handles: { armH: null, fArmH: null, bNeckH: null, fNeckH: null, sleeveH: null }, appliedDarts: { front: null, back: null } },
  geometry: Object.assign(JSON.parse(J(REF)), { sleeve: REFSLEEVE() }) });

const FILES = ["blockWorkflow.js", "designProject.js", "sideSeamMagnet.js", "designLineTool.js", "sleeveSplit.js", "sleeveOutlineEdit.js", "designFlare.js", "designJoin.js", "designWaistSeam.js", "designYokeSeam.js", "designPrincess.js",
  "designBodice.js", "bodicePresets.js", "designLayout.js", "designRenderer.js", "bodiceCheckpoint.js", "peplumAnnotation.js", "designSleeve.js", "sleeveMeasure.js", "sleeveCheckpoint.js", "sleevePresets.js"];
SYMS.forEach(k => { if (fs.existsSync(path.join(ROOT, "js", "designSleeve" + k + ".js"))) FILES.push("designSleeve" + k + ".js"); FILES.push("sleeve" + k + "Apply.js"); });
FILES.push("sleeveAnnotation.js", "designCollar.js", "collarCheckpoint.js", "designResult.js", "projectFile.js");
const SRC = {}; FILES.forEach(f => { SRC[f] = fs.readFileSync(path.join(ROOT, "js", f), "utf8"); });

// ── 세션(독립 context) ──
function makeSession() {
  const ELS = {};
  const el = id => { if (!ELS[id]) ELS[id] = { id, textContent: "", value: "", disabled: false, hidden: false, title: "", attrs: {}, setAttribute(k, v) { this.attrs[k] = String(v); }, removeAttribute(k) { delete this.attrs[k]; }, getAttribute(k) { return this.attrs[k]; } }; return ELS[id]; };
  let LOADING = null; const SVG_H = {}, DOC_H = {};
  const sb = { window: {}, console: { log() {}, warn() {} }, Math, JSON, Object, Array, isFinite, structuredClone, Error, Date, Promise, Number, String, Map, Set, WeakMap,
    c2p: (x, y) => [x * 10, y * 10], SC: 10, viewZ: 1, eventToPatternPoint: e => [e.px, e.py], render: () => {},
    svg: { addEventListener(t, f) { (SVG_H[LOADING + ":" + t] = SVG_H[LOADING + ":" + t] || []).push(f); }, setPointerCapture() {}, releasePointerCapture() {} },
    document: { createElementNS: () => ({ setAttribute() {}, appendChild() {} }), getElementById: el, addEventListener(t, f) { (DOC_H[LOADING + ":" + t] = DOC_H[LOADING + ":" + t] || []).push(f); } } };
  sb.globalThis = sb; vm.createContext(sb);
  sb.window.isDesignStageActive = () => true; sb.window.addEventListener = () => {}; sb.window.refreshDesignResultUI = () => {};
  let snapCount = 0;
  sb.captureBlockSnapshot = () => { snapCount++; return SNAPSHOT(); };
  FILES.forEach(f => { LOADING = f; vm.runInContext(SRC[f], sb, { filename: f }); });
  LOADING = null;
  const W = sb.window;
  W.designLineQuickBar = { sync() {} };
  const S = { sb, W, el, BW: W.blockWorkflow, DW: W.designWorkflow, DB: W.designBodice, BP: W.bodicePresets, BC: W.bodiceCheckpoint, SC: W.sleeveCheckpoint, SP: W.sleevePresets,
    DC: W.designCollar, CC: W.collarCheckpoint, DR: W.designResult, DLT: W.designLineTool, DLy: W.designLayout, PF: W.projectFile };
  S.P = () => S.DW.current();
  S.UI = { stage: "design", subtab: "body" };
  W.projectSessionUI = { snapshot: () => ({ stage: S.UI.stage, subtab: S.UI.subtab }), unfinished: () => (S.DLT.getDraft() ? ["drawing"] : []), afterRestore(u) { S.DLT.setMode("off"); S.UI = { stage: u.stage, subtab: u.subtab }; } };
  const H = t => (SVG_H["designLineTool.js:" + t] || []);
  const KD = () => (DOC_H["designLineTool.js:keydown"] || []);
  let CLX = 0;
  function evAt(pc, geo, extra) {
    const L = S.DLy.ensureLayout(S.P()), off = L[pc] || { dx: 0, dy: 0 }; CLX += 100;
    return Object.assign({ button: 0, pointerId: 1, clientX: CLX, clientY: 0, altKey: false, shiftKey: false, px: geo.x + off.dx, py: geo.y + off.dy,
      target: { closest: () => ({ getAttribute: () => pc }) }, stopPropagation() {}, preventDefault() {} }, extra || {});
  }
  const down = e => H("pointerdown").forEach(f => f(e)), up = e => H("pointerup").forEach(f => f(e)), move = e => H("pointermove").forEach(f => f(e));
  S.key = k => KD().forEach(f => f({ key: k, target: {}, preventDefault() {} }));
  S.click = (pc, g, extra) => { const e = evAt(pc, g, extra); down(e); up(e); };
  S.drag = (pc, g, h) => { const e0 = evAt(pc, g); down(e0); const e1 = evAt(pc, { x: g.x + h.x, y: g.y + h.y }, { clientX: e0.clientX + 50 }); move(e1); up(e1); };
  S.draw = (pc, pts, handles, role) => {
    if (S.DLT.getMode() !== "off") S.DLT.setMode("off");
    S.DLT.toggle();
    pts.forEach((q, i) => { if (handles && handles[i]) S.drag(pc, q, handles[i]); else S.click(pc, q, { altKey: true }); });
    S.key("Enter");
    const lines = S.P().working.patternLines, line = lines[lines.length - 1];
    if (role) S.DLT.setRole(role);
    return line;
  };
  // 실제 경로: 원형 완료 → 디자인 시작 → 몸판 라인 Ⓐ 적용(referenceGeometry 기준 재계산)
  S.start = () => {
    const blk = S.BW.complete();
    const P = S.DW.startFromBlock(blk);
    const body = S.BP.bodyParams(presetOf(S, "A"));
    P.working.parameters.neckline = { mode: "parametric", type: "original", parameters: {} };
    P.working.parameters.body = body;
    P.working.geometry = Object.assign({}, S.DB.computeGeometry(P.referenceGeometry, { body }), { sleeve: P.working.geometry.sleeve });
    P.working.designOutline = null; P.working.frontPlacket = null;
    P.working.layout = { front: { dx: 40, dy: 5 }, back: { dx: 0, dy: 5 }, sleeve: { dx: 80, dy: 5 }, collar: { dx: 0, dy: 70 }, placement: { front: "auto", back: "auto", sleeve: "manual" } };
    S.DLy.ensureLayout(P);
    return P;
  };
  S.defaultsOf = sym => { const rec = S.SP.get("bunka-sleeve-" + sym), o = {}; rec.inputs.forEach(i => { if (typeof i.defaultValue === "number") o[i.key] = i.defaultValue; else if (i.key === "sleeveLengthCm") o[i.key] = 52; }); return o; };
  S.setCollar = () => {
    const P = S.P(), b = P.working.bodiceResult, STAND_P = { bandWidthCm: 3, frontRiseCm: 1.5, frontEndCm: 0.5 }, BODY_P = { gapCm: 3, cbWidthCm: 4, frontProjectionCm: 1.5, pointDiagonalCm: 6, outerBowCm: 0 };
    const stand = S.DC.computeStand(b, STAND_P), body = S.DC.computeBody(stand, BODY_P);
    P.working.collarDraft = { sourceBodiceHash: b.hash, type: "shirt-two-piece", parameters: { stand: Object.assign({}, STAND_P) },
      standGeometry: stand.standGeometry, body: { parameters: Object.assign({}, BODY_P), geometry: body.bodyGeometry, attachLenCm: body.attachLenCm, measure: body.measure } };
    P.working.collarResult = null;
  };
  S.snapCount = () => snapCount;
  return S;
}
function presetOf(S, sym) { for (const f of S.BP.families()) for (const v of f.variants) if (v.symbol === sym && v.presetId) return v.presetId; return null; }
const SX = 23.053125, HEM_Y = 58;
// 세션 전체 지문(원형 완료본 + project 그래프 — 그래프 인코딩은 freeze·alias·undefined 까지 담는다)
const fp = S => { const p = S.P(); return J({ blocks: S.BW.versions().map(b => J(b)), proj: p ? J(S.PF.encodeGraph(p)) : null }); };

// ══ §0 그래프 인코딩 ══
{
  const S = makeSession(), PF = S.PF;
  const shared = Object.freeze({ a: Object.freeze([1, 2]) });
  const root = { x: shared, y: shared, u: undefined, z: -0, arr: [undefined, 3], sh: Object.freeze({ inner: { m: 1 } }) };
  root.self = root;
  const g = PF.encodeGraph(root), back = PF.decodeGraph(JSON.parse(J(g)));
  ok(back.x === back.y && back.self === back, "0: 공유 참조·순환 = 같은 객체로 복원");
  ok(Object.prototype.hasOwnProperty.call(back, "u") && back.u === undefined && back.arr.length === 2 && back.arr[0] === undefined && Object.is(back.z, -0), "0: undefined 속성·배열 원소·-0 그대로");
  ok(Object.isFrozen(back.x) && Object.isFrozen(back.x.a) && Object.isFrozen(back.sh) && !Object.isFrozen(back.sh.inner) && !Object.isFrozen(back), "0: deep/shallow freeze 그대로");
  ok(J(PF.encodeGraph(back)) === J(g), "0: 재인코딩 동일");
  const rej = (v, r) => { try { PF.encodeGraph(v); return false; } catch (e) { return e.reason === r; } };
  ok(rej({ a: { b: NaN } }, "non-finite-number") && rej({ a: [Infinity] }, "non-finite-number") && rej({ m: new Map() }, "unsupported-object") && rej({ f() {} }, "unsupported-type"), "0: NaN·Infinity·Map·함수 = 저장 거부(조용히 null 로 바꾸지 않음)");
  let e0 = null; try { PF.encodeGraph({ a: { b: [0, NaN] } }); } catch (e) { e0 = e; }
  ok(e0 && e0.detail === "a.b.1", "0: 거부 사유에 경로 (" + (e0 && e0.detail) + ")");
  const nodeSha = s => require("crypto").createHash("sha256").update(s, "utf8").digest("hex");
  ok(["abc", "", "가나다 ✂ 𝄞", "x".repeat(1000)].every(s => PF.sha256(s) === nodeSha(s)), "0: sha256 = node crypto(UTF-8 · 서로게이트 · 다중 블록)");
}

// ══ §1 완료 상태 저장 → 빈 세션 열기 → 이어서 작업 ══
let T1 = null, S2 = null;
{
  const S = makeSession(), P = S.start();
  // 박시 Ⓐ 곡선 밑단: 뒤 중심-밑단 모서리 → 옆선 50(셔츠형 둥근 밑단 = 새 밑단)
  S.draw("back", [{ x: 0, y: HEM_Y }, { x: 12, y: 57.2 }, { x: SX, y: 50 }], [null, { x: 4, y: -0.6 }, null]);
  ok(S.DLT.doReflectToBodice() === true, "1: 곡선 밑단(뒤) 몸판 외곽 반영");
  S.draw("front", [{ x: 47.5, y: HEM_Y }, { x: 35, y: 57.2 }, { x: SX, y: 50 }], [null, { x: -4, y: -0.6 }, null]);
  ok(S.DLT.doReflectToBodice() === true, "1: 곡선 밑단(앞) 몸판 외곽 반영");
  const rb = S.BC.complete(P); ok(rb.ok, "1: 몸판 완료 (" + (rb.reason || "") + ")");
  ok(!S.BC.isCurrentBodiceChanged(P), "1: 완료 직후 몸판 변경 없음");
  const ra = S.W.sleeveAApply.apply(P, S.defaultsOf("A")); ok(ra && ra.ok, "1: 소매 Ⓐ 적용");
  ok(S.SC.complete(P).ok, "1: 소매 완료(편집 전)");
  S.draw("sleeve", [{ x: -17.07, y: 25 }, { x: -15.8, y: 35 }, { x: -17.07, y: 45 }], null, "boundary");
  // (기존 동작) 새 선 완료 = 합성 외곽 무효화 → 몸판 «변경됨» → 제품 경로대로 «디자인 외곽 합성»으로 같은 외곽 복원
  ok(S.BC.isCurrentBodiceChanged(P) === true, "1: (기존 동작) 새 선 완료가 합성 외곽을 무효화");
  S.DLT.doComposeDesignOutline();
  ok(!S.BC.isCurrentBodiceChanged(P), "1: «디자인 외곽 합성» → 몸판 완료본과 다시 일치");
  S.DLT.syncCutStatus();
  const bpv = S.DLT.doBoundaryPreview(), bap = bpv && S.DLT.doBoundaryApply();
  ok(bpv === true && bap === true, "1: 수정 소매(뒤 옆선 외곽 반영) " + bpv + "/" + bap + " " + S.el("designBoundaryNote").textContent + " | " + J(S.P().working.patternLines.slice(-1)[0]).slice(0, 300));
  const rs = S.SC.complete(P); ok(rs.ok && rs.result.manualEdit, "1: 수정 소매 완료");
  S.setCollar(); ok(S.CC.complete(P).ok, "1: 카라 완료");
  const rd = S.DR.complete(P); ok(rd.ok, "1: Design 완료");
  S.UI = { stage: "design", subtab: "collar" };
  const st0 = S.PF.computeStatus(P);
  ok(["bodice", "sleeve", "collar", "design"].every(k => st0[k].completed && st0[k].changed === false), "1: 저장 전 = 전부 완료·변경 없음");
  const before = fp(S), snaps = S.snapCount();
  const built = S.PF.buildFileText({ savedAt: "2026-11-09T00:00:00.000Z" });
  T1 = built.text;
  ok(fp(S) === before && S.snapCount() === snaps, "1: 저장이 세션을 바꾸지 않음(원형 재캡처 없음)");
  ok(/^\{"format":"bunka-pattern-editor\.project","schemaVersion":1,/.test(T1), "1: format 식별자 + schemaVersion");

  // 빈 세션에서 열기
  S2 = makeSession();
  ok(!S2.DW.hasProject() && !S2.BW.hasCompleted(), "1: 여는 세션 = 빈 세션");
  const v = S2.PF.verifyText(T1);
  ok(v.ok, "1: 열기 검증 통과 (" + (v.reason || "") + " " + (v.detail || "") + ")");
  ok(!S2.DW.hasProject() && !S2.BW.hasCompleted(), "1: 검증만으로는 세션 무변경");
  S2.PF.commitCandidate(v.candidate);
  const Q = S2.P();
  ok(Q && Q !== P && S2.BW.latest().canonicalHash === S.BW.latest().canonicalHash && S2.BW.latest().version === 1, "1: 원자 교체 — project·원형 완료본 복원");
  ok(J(S2.PF.encodeGraph({ block: S2.BW.latest(), project: Q })) === J(S.PF.encodeGraph({ block: S.BW.latest(), project: P })), "1: 그래프 바이트 동일(geometry·선·완료본·배치·freeze·alias·undefined)");
  ok(J(Q.working.patternLines) === J(P.working.patternLines) && J(Q.working.designOutline) === J(P.working.designOutline) && J(Q.working.layout) === J(P.working.layout), "1: 그린 선·반영 외곽·배치 동일");
  ok(Q.working.designResult.hash === P.working.designResult.hash && Q.working.sleeveResult.hash === P.working.sleeveResult.hash && Q.working.bodiceResult.hash === P.working.bodiceResult.hash && Q.working.collarResult.hash === P.working.collarResult.hash, "1: 완료 hash 동일");
  ok(Object.isFrozen(Q) && Object.isFrozen(Q.referenceGeometry.front) && Object.isFrozen(Q.working.bodiceResult.front.outline) && Object.isFrozen(Q.working.sleeveEdit) && !Object.isFrozen(Q.working) && !Object.isFrozen(Q.working.geometry), "1: 불변 출처·완료본 freeze · working 은 편집 가능");
  ok((P.working.designResult.bodice === P.working.bodiceResult) === (Q.working.designResult.bodice === Q.working.bodiceResult) && Q.working.sleeveEdit.base === (P.working.sleeveEdit.base === P.working.sleeveResult ? Q.working.sleeveResult : Q.working.sleeveEdit.base), "1: 공유 참조 관계 동일");
  const st1 = S2.PF.computeStatus(Q);
  ok(J(st1) === J(st0), "1: 열린 세션 완료/변경됨 재계산 = 저장 시점");
  ok(S2.UI.stage === "design" && S2.UI.subtab === "collar", "1: 화면 단계 복원");
  // 이어서 같은 작업 — 두 세션 결과 동일(후속 편집 정상)
  const cont = X => {
    const p = X.P();
    X.draw("front", [{ x: 30, y: 25 }, { x: 40, y: 40 }], null, "cut");
    const b = X.BC.complete(p), s = X.W.sleeveAApply.apply(p, Object.assign(X.defaultsOf("A"), { sleeveLengthCm: 50 })), sc = X.SC.complete(p);
    X.setCollar(); const c = X.CC.complete(p), d = X.DR.complete(p);
    return { ok: b.ok && s.ok && sc.ok && c.ok && d.ok, bh: p.working.bodiceResult.hash, sh: p.working.sleeveResult.hash, dh: p.working.designResult.hash, g: J(p.working.geometry), st: J(X.PF.computeStatus(p)) };
  };
  const cA = cont(S), cB = cont(S2);
  ok(cA.ok && cB.ok, "1: 열린 프로젝트에서 그리기·재완료(몸판·소매·카라·Design) 계속");
  ok(cA.bh === cB.bh && cA.sh === cB.sh && cA.dh === cB.dh && cA.g === cB.g && cA.st === cB.st, "1: 같은 후속 편집 → 두 세션 같은 hash·geometry");
}

// ══ §2 «변경됨» 상태 ══
{
  const S = makeSession(), P = S.start();
  ok(S.BC.complete(P).ok && S.W.sleeveAApply.apply(P, S.defaultsOf("A")).ok && S.SC.complete(P).ok, "2: 몸판·소매 완료");
  S.setCollar(); ok(S.CC.complete(P).ok && S.DR.complete(P).ok, "2: 카라·Design 완료");
  ok(S.W.sleeveAApply.apply(P, Object.assign(S.defaultsOf("A"), { sleeveLengthCm: 55 })).ok, "2: 완료 뒤 소매 입력 변경");
  const st = S.PF.computeStatus(P);
  ok(st.sleeve.changed === true && st.design.changed === true && st.bodice.changed === false, "2: 소매·Design = 변경됨");
  const T = S.PF.buildFileText().text, R = makeSession(), v = R.PF.verifyText(T);
  ok(v.ok, "2: 열기 검증 통과 (" + (v.reason || "") + ")");
  if (v.ok) {
    R.PF.commitCandidate(v.candidate);
    ok(J(R.PF.computeStatus(R.P())) === J(st) && J(R.PF.encodeGraph(R.P())) === J(S.PF.encodeGraph(P)), "2: 변경됨 상태·그래프 그대로(몰래 완료·몰래 해제 없음)");
    ok(R.P().working.sleeveResult.hash === P.working.sleeveResult.hash && R.SC.complete(R.P()).ok && R.SC.complete(R.P()).result.hash === S.SC.complete(P).result.hash, "2: 이전 완료본 보존 · 재완료 결과 두 세션 동일");
  }
}

// ══ §3 «미완료» 상태 ══
{
  const S = makeSession(), P = S.start();
  ok(S.BC.complete(P).ok && S.W.sleeveAApply.apply(P, S.defaultsOf("A")).ok, "3: 몸판 완료 · 소매 적용(미완료)");
  S.draw("front", [{ x: 30, y: 25 }, { x: 40, y: 40 }], null, "guide");
  S.UI = { stage: "design", subtab: "sleeve" };
  const st = S.PF.computeStatus(P);
  ok(st.sleeve.completed === false && st.collar.completed === false && st.design.completed === false && st.bodice.completed === true, "3: 소매·카라·Design 미완료");
  const T = S.PF.buildFileText().text, R = makeSession(), v = R.PF.verifyText(T);
  ok(v.ok, "3: 열기 검증 통과");
  if (v.ok) {
    R.PF.commitCandidate(v.candidate);
    ok(!R.P().working.sleeveResult && !R.P().working.collarResult && !R.P().working.designResult && J(R.PF.computeStatus(R.P())) === J(st), "3: 완료본을 지어내지 않음");
    ok(J(R.P().working.patternLines) === J(P.working.patternLines) && R.UI.subtab === "sleeve", "3: 선·서브탭 그대로");
    ok(R.SC.complete(R.P()).ok && R.SC.complete(R.P()).result.hash === S.SC.complete(P).result.hash, "3: 열린 뒤 소매 완료 = 원래 세션과 같은 hash");
  }
}

// ══ §4 거부 — 현재 세션 0 변경 ══
{
  const S = S2, f0 = fp(S), p0 = S.P(), b0 = S.BW.latest();
  const resign = file => { file.integrity.payload = S.PF.sha256(J(file.payload)); return J(file); };
  const parse = () => JSON.parse(T1);
  const bumpX = o => { const st = [o]; while (st.length) { const v = st.pop(); if (v && typeof v === "object") { if (typeof v.x === "number") { v.x += 0.5; return true; } Object.keys(v).forEach(k => st.push(v[k])); } } return false; };
  const cases = [
    ["깨진 파일", "}{", "broken-json"],
    ["잘린 파일", T1.slice(0, Math.floor(T1.length * 0.6)), "broken-json"],
    ["빈 파일", "", "empty-file"],
    ["다른 JSON", '{"hello":1}', "not-project-file"],
    ["원형 곡선 JSON", '[{"B":83,"W":64,"BL":38,"armH":[]}]', "curve-data-file"],
    ["미지원 version", T1.replace('"schemaVersion":1,', '"schemaVersion":2,'), "unsupported-version"],
    ["무결성 변조(hash 그대로)", (() => { const f = parse(); f.payload.graph.data.project.working.bodiceResult.hash = "deadbeef"; return J(f); })(), "integrity-mismatch"],
    ["완료본 변조(hash 재계산)", (() => { const f = parse(); bumpX(f.payload.graph.data.project.working.bodiceResult.front.outline); return resign(f); })(), "status-mismatch"],
    ["원형 완료본 변조(hash 재계산)", (() => { const f = parse(); f.payload.graph.data.block.snapshot.source.measurements.B = 90; return resign(f); })(), "block-invalid"],
    ["출처 불일치(hash 재계산)", (() => { const f = parse(); bumpX(f.payload.graph.data.project.referenceGeometry.front); return resign(f); })(), "reference-geometry-mismatch"],
    ["상태 위조(hash 재계산)", (() => { const f = parse(); f.payload.status.design.changed = true; return resign(f); })(), "status-mismatch"],
    ["freeze 제거 — 원형 reference(hash 재계산)", (() => { const f = parse(); f.payload.graph.meta.frozenDeep = f.payload.graph.meta.frozenDeep.filter(p => p.join(".") !== "project.referenceGeometry"); return resign(f); })(), "frozen-invariant"],
    ["freeze 제거 — 완료본(hash 재계산 · 다른 동결 경로로 다시 얼어도 재인코딩에서 걸림)", (() => { const f = parse(); f.payload.graph.meta.frozenDeep = f.payload.graph.meta.frozenDeep.filter(p => p.join(".") !== "project.working.bodiceResult"); return resign(f); })(), "graph-roundtrip"],
    ["__proto__ 키(hash 재계산)", (() => { const t = T1.replace('"working":{', '"working":{"__proto__":{"polluted":1},'); const f = JSON.parse(t); return resign(f); })(), "forbidden-key"],
    ["1e999(Infinity)", T1.replace(/"x":(\d+\.\d+)/, '"x":1e999'), "non-finite-number"]
  ];
  cases.forEach(([tag, text, reason]) => {
    const v = S.PF.verifyText(text);
    ok(!v.ok && v.reason === reason, "4: " + tag + " = 거부(" + reason + ") ← " + v.reason + " " + (v.detail || ""));
    ok(fp(S) === f0 && S.P() === p0 && S.BW.latest() === b0, "4: " + tag + " → 현재 세션 0 변경");
  });
  ok(({}).polluted === undefined && Object.prototype.polluted === undefined, "4: 프로토타입 오염 없음");
  // 취소 = 검증만 하고 교체하지 않음
  const v = S.PF.verifyText(T1);
  ok(v.ok && fp(S) === f0 && S.P() === p0, "4: 정상 파일 검증 후 취소 → 세션 그대로");
  ok(v.ok && v.candidate.project !== p0 && v.candidate.project.working !== p0.working, "4: 후보와 현재 세션 공유 참조 0");
}

// ══ §5 저장 전 마무리 · 교체 실패 원자성 ══
{
  const S = makeSession(), P = S.start();
  S.DLT.toggle(); S.click("front", { x: 30, y: 25 }, { altKey: true });
  let e1 = null; try { S.PF.buildFileText(); } catch (e) { e1 = e; }
  ok(e1 && e1.reason === "unfinished", "5: 그리는 중 선 = 저장 거부(마무리 안내)");
  S.DLT.setMode("off");
  ok(S.PF.buildFileText().text.length > 0, "5: 그리기 취소 뒤 저장 가능");
  const b0 = S.BW.latest(), p0 = S.P(), good = S2.PF.verifyText(T1).candidate;
  let e2 = null; try { S.PF.commitCandidate({ block: good.block, project: {}, ui: { stage: "design", subtab: "body" } }); } catch (e) { e2 = e; }
  ok(e2 && S.BW.latest() === b0 && S.P() === p0, "5: project 교체 실패 → 원형 완료본 되돌림(부분 교체 없음)");
  const E = makeSession();
  let e3 = null; try { E.PF.buildFileText(); } catch (e) { e3 = e; }
  ok(e3 && e3.reason === "no-project", "5: 디자인 프로젝트 없으면 저장 거부(원형만 저장은 지원 범위 밖)");
}

// ══ §7 교체 트랜잭션 — 데이터 교체 성공 뒤 화면 갱신(afterRestore) 실패 = 이전 데이터·단계·탭·도구·입력 그대로(Codex 필수 보완) ══
{
  const good = () => S2.PF.verifyText(T1).candidate;   // 매번 새 후보(격리)
  // 화면 상태를 흉내 내는 세션 UI: capture/rollback 은 값 복사 · afterRestore 는 상태를 바꾼 뒤(후보 project 에 쓰기 포함) 던진다
  function faultyUI(S, mutateCandidate) {
    S.UI = { stage: "design", subtab: "sleeve", input: "61(미적용)", tool: "select:line-9" };
    S.W.projectSessionUI = {
      snapshot: () => ({ stage: S.UI.stage, subtab: S.UI.subtab }), unfinished: () => [],
      capture: () => JSON.parse(J(S.UI)),
      rollback(c) { S.UI = c; },
      afterRestore(u) {
        S.UI = { stage: u.stage, subtab: u.subtab, input: "", tool: "off" };
        if (mutateCandidate) { const p = S.DW.current(); p.working.layout.front.dx = 999; p.working.patternLines.push({ id: "junk" }); }
        throw new Error("render exploded");
      }
    };
  }
  // (a) 기존 project 가 있는 세션
  {
    const S = makeSession(), P0 = S.start(); S.BC.complete(P0);
    const b0 = S.BW.latest(), f0 = fp(S), cand = good();
    faultyUI(S, true);
    const ui0 = J(S.UI);
    let e = null; try { S.PF.commitCandidate(cand); } catch (x) { e = x; }
    ok(e && e.reason === "ui-restore-failed" && e.uiRolledBack === true, "7a: 교체 뒤 화면 갱신 실패 → ui-restore-failed (" + (e && e.reason) + ")");
    ok(S.DW.current() === P0 && S.BW.latest() === b0 && S.BW.versions().length === 1, "7a: project·원형 레코드 = 이전 객체 그대로");
    ok(fp(S) === f0, "7a: 이전 project 그래프 바이트 동일(후보에 쓴 값이 원본에 남지 않음)");
    ok(J(S.UI) === ui0, "7a: 단계·탭·도구·미적용 입력 = 이전 그대로");
    ok(cand.project.working.layout.front.dx === 999, "7a: (확인) 실패한 갱신은 후보에만 썼다");
    // 이어서 정상 열기는 그대로 된다
    S.W.projectSessionUI = { snapshot: () => ({ stage: "design", subtab: "body" }), unfinished: () => [], capture: () => null, rollback() {}, afterRestore() {} };
    S.PF.commitCandidate(good());
    ok(S.DW.current() !== P0 && J(S.PF.encodeGraph(S.DW.current())) === J(S2.PF.verifyText(T1).candidate && S2.PF.encodeGraph(S2.PF.verifyText(T1).candidate.project)), "7a: 실패 뒤 다시 열기 = 정상 교체");
  }
  // (b) 빈 세션(이전 project null · 원형 레코드 없음)
  {
    const S = makeSession(), cand = good();
    faultyUI(S, true);
    let e = null; try { S.PF.commitCandidate(cand); } catch (x) { e = x; }
    ok(e && e.reason === "ui-restore-failed", "7b: 빈 세션에서도 실패 보고");
    ok(S.DW.current() === null && !S.DW.hasProject() && !S.BW.hasCompleted() && S.BW.latest() === null, "7b: project null · 원형 레코드 없음으로 되돌림");
    ok(S.UI.subtab === "sleeve" && S.UI.input === "61(미적용)", "7b: 화면 상태 되돌림");
  }
  // (c) rollback 자체가 실패해도 데이터는 되돌리고 그 사실을 알린다
  {
    const S = makeSession(), P0 = S.start(), b0 = S.BW.latest();
    faultyUI(S, false); S.W.projectSessionUI.rollback = () => { throw new Error("rollback ui"); };
    let e = null; try { S.PF.commitCandidate(good()); } catch (x) { e = x; }
    ok(e && e.reason === "ui-restore-failed" && e.uiRolledBack === false && S.DW.current() === P0 && S.BW.latest() === b0, "7c: 화면 복원 실패여도 데이터는 이전으로 · uiRolledBack=false 로 알림");
  }
}

// §6 배선
{
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const at = f => html.indexOf('src="js/' + f + '?v=');
  ok(at("projectFile.js") > at("designResult.js") && at("projectFile.js") < at("ui.js") && /projectFile\.js\?v=2026110901/.test(html), "6: projectFile 로드 순서·캐시 버전");
  ok(/id="btnSaveProject" onclick="projectFile\.onSave\(\)"/.test(html) && /id="inpOpenProject"[^>]*onchange="projectFile\.onOpenFile\(this\)"/.test(html), "6: 파일 메뉴 «프로젝트 저장»·«프로젝트 열기»");
  ok(/onclick="exportData\(\)"/.test(html) && /onchange="importDataFromFile\(this\)"/.test(html), "6: 기존 곡선 JSON 내보내기/가져오기 보존");
}

console.log("projectFileCheck: " + PASS + " pass, " + FAIL + " fail");
if (FAIL) { fails.slice(0, 20).forEach(f => console.log("  ✗ " + f)); process.exit(1); }
