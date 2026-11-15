// ══════════════════════════════════════════════
// projectOpenRaceCheck.js — 프로젝트 «열기» 연속 요청 순서(2026-11-15 야간 리뷰 #2 ③ · 실제 엔진 · 실제 handler)
//   파일 읽기(file.text())는 비동기라 먼저 고른 파일이 나중에 끝날 수 있다. 요청 번호로 **마지막 요청만** 반영한다.
//   실제 projectFile.onOpenFile / onConfirmOpen / onCancelOpen 을 호출하고, 읽기 완료 시점을 검사가 직접 뒤집는다(deferred).
//   §1 빈 세션(확인 없이 바로 열림): 나중 요청이 먼저 끝나 열린 뒤, 먼저 요청이 늦게 끝나도 덮어쓰지 않음
//   §2 작업 있는 세션(확인 대기): 늦게 끝난 옛 요청이 확인 대기·안내를 바꾸지 않음 · 확인 = 마지막 요청 파일
//   §3 취소 뒤 늦게 끝난 읽기 = 무시   §4 옛 요청의 읽기 실패 = 무시   §5 새 요청이 시작되면 옛 확인 대기는 사라지고 «확인»이 옛 파일을 열지 않음
//   §6 마지막 요청이 검증 실패 = 현재 작업 그대로(되돌림 보존)   §7 단일 열기 정상 · 입력칸 비움
//   node test/harness/projectOpenRaceCheck.js
// ══════════════════════════════════════════════
"use strict";
const vm = require("vm"), fs = require("fs"), path = require("path");
let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
process.on("uncaughtException", e => { console.log("projectOpenRaceCheck: 예외 — " + (e && e.stack || e).toString().split("\n").slice(0, 3).join(" | ")); fails.slice(0, 20).forEach(f => console.log("  ✗ " + f)); process.exit(1); });
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
  S.P = () => S.DW.current(); S.sandboxDoc = sb.document; S.sb = sb;
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


const AT = { savedAt: "2026-11-15T00:00:00.000Z" };
function fileText(hemCm) {   // 완료된 프로젝트 + 구분용 시접 값(밑단 폭)
  const S = makeSession(), P = start(S);
  const a = setPlacket(S, 1.2, 1.2).ok && S.BC.complete(P).ok, ra = S.W.sleeveAApply.apply(P, { sleeveLengthCm: 52, cuff: cuffOf(S, null) });
  if (!(a && ra && ra.ok && completeChain(S, P))) throw new Error("fixture");
  S.CUT.setEdge("back", "hem", { widthCm: hemCm }, P);
  return S.PF.buildFileText(AT).text;
}
const mark = S => { const P = S.P(); return P && P.working.cutSpec ? P.working.cutSpec.edges["back|hem"].widthCm : null; };
function deferred(text, size) { let res, rej; const p = new Promise((a, b) => { res = a; rej = b; }); const input = { value: "picked", files: [{ size: size == null ? text.length : size, text: () => p }] }; return { input, ok: () => res(text), fail: () => rej(new Error("read")) }; }
const flush = () => new Promise(r => setImmediate(r));
const el = (S, id) => S.W.document ? S.W.document.getElementById(id) : null;

(async () => {
  const TA = fileText(2), TB = fileText(3);
  ok(TA !== TB && /cutSpec/.test(TA), "0: 구분되는 프로젝트 파일 2개(밑단 시접 2 / 3)");
  const doc = S => ({ note: () => S.doc("projectFileNote").textContent, confirm: () => S.doc("projectOpenConfirm").hidden === false, ctext: () => S.doc("projectOpenConfirmText").textContent });
  const fresh = withWork => { const S = makeSession(); S.doc = id => S.sandboxDoc.getElementById(id); if (withWork) { const v = S.PF.verifyText(fileText(9)); S.PF.commitCandidate(v.candidate); } return S; };

  // §1 빈 세션: A(먼저 요청) 늦게, B(나중 요청) 먼저
  { const S = fresh(false), d = doc(S), A = deferred(TA), B = deferred(TB);
    S.PF.onOpenFile(A.input); S.PF.onOpenFile(B.input);
    B.ok(); await flush();
    ok(mark(S) === 3 && /열기 완료/.test(d.note()), "1: 나중 요청(B)이 먼저 끝나 열림 (" + mark(S) + ")");
    const noteB = d.note(), g = J(S.PF.encodeGraph({ block: S.BW.latest(), project: S.P() }));
    A.ok(); await flush();
    ok(mark(S) === 3 && d.note() === noteB && J(S.PF.encodeGraph({ block: S.BW.latest(), project: S.P() })) === g && A.input.value === "picked", "1: 먼저 요청(A)이 늦게 끝나도 무시 — 프로젝트·안내 그대로(예전엔 A 가 덮어씀)"); }

  // §2 작업 있는 세션: 확인 대기
  { const S = fresh(true), d = doc(S), A = deferred(TA), B = deferred(TB), g0 = J(S.PF.encodeGraph({ block: S.BW.latest(), project: S.P() }));
    S.PF.onOpenFile(A.input); S.PF.onOpenFile(B.input);
    B.ok(); await flush();
    const ct = d.ctext(), nt = d.note();
    ok(d.confirm() && /확인 대기/.test(nt) && mark(S) === 9, "2: B 검증 통과 → 확인 대기 · 아직 아무것도 안 바뀜");
    A.ok(); await flush();
    ok(d.confirm() && d.ctext() === ct && d.note() === nt && mark(S) === 9 && J(S.PF.encodeGraph({ block: S.BW.latest(), project: S.P() })) === g0, "2: 늦게 끝난 A 는 확인 대기·안내·작업을 바꾸지 않음");
    S.PF.onConfirmOpen();
    ok(mark(S) === 3 && !d.confirm() && /열기 완료/.test(d.note()), "2: «확인» = 마지막 요청(B) 파일이 열림 (" + mark(S) + ")"); }

  // §3 취소 뒤 늦은 완료
  { const S = fresh(true), d = doc(S), A = deferred(TA);
    S.PF.onOpenFile(A.input); S.PF.onCancelOpen(); const nt = d.note();
    A.ok(); await flush();
    ok(/열기 취소/.test(nt) && d.note() === nt && !d.confirm() && mark(S) === 9, "3: 취소 뒤 늦게 끝난 읽기 = 확인창도 열림도 없음");
    S.PF.onConfirmOpen(); ok(mark(S) === 9, "3: 그 뒤 «확인»을 눌러도 아무것도 열리지 않음"); }

  // §4 옛 요청의 읽기 실패
  { const S = fresh(true), d = doc(S), A = deferred(TA), B = deferred(TB);
    S.PF.onOpenFile(A.input); S.PF.onOpenFile(B.input); B.ok(); await flush(); const ct = d.ctext(), nt = d.note();
    A.fail(); await flush();
    ok(d.confirm() && d.ctext() === ct && d.note() === nt, "4: 옛 요청의 읽기 실패가 최신 요청의 확인 대기·안내를 덮어쓰지 않음");
    S.PF.onConfirmOpen(); ok(mark(S) === 3, "4: 확인 = B"); }

  // §5 확인 대기 중 새 요청
  { const S = fresh(true), d = doc(S), A = deferred(TA), B = deferred(TB);
    S.PF.onOpenFile(A.input); A.ok(); await flush();
    ok(d.confirm() && mark(S) === 9, "5: A 확인 대기");
    S.PF.onOpenFile(B.input);
    ok(!d.confirm(), "5: 새 요청(B) 시작 → 옛 확인 대기 사라짐");
    S.PF.onConfirmOpen(); ok(mark(S) === 9, "5: 이때 «확인»은 옛 파일(A)을 열지 않음");
    B.ok(); await flush(); S.PF.onConfirmOpen();
    ok(mark(S) === 3, "5: B 확인 대기 → 확인 = B"); }

  // §6 마지막 요청이 검증 실패 / 너무 큼
  { const S = fresh(true), d = doc(S), A = deferred(TA), Bad = deferred("{not json"), g0 = J(S.PF.encodeGraph({ block: S.BW.latest(), project: S.P() }));
    S.PF.onOpenFile(A.input); S.PF.onOpenFile(Bad.input); Bad.ok(); await flush();
    ok(/열지 않음/.test(d.note()) && !d.confirm() && mark(S) === 9, "6: 마지막 요청이 검증 실패 = 현재 작업 그대로");
    const nt = d.note(); A.ok(); await flush();
    ok(d.note() === nt && !d.confirm() && J(S.PF.encodeGraph({ block: S.BW.latest(), project: S.P() })) === g0, "6: 그 뒤 늦게 끝난 옛 요청(정상 파일)도 열리지 않음 · 그래프 바이트 동일");
    const A2 = deferred(TA), Big = deferred("x", 1e12);
    S.PF.onOpenFile(A2.input); S.PF.onOpenFile(Big.input); const n2 = d.note(); A2.ok(); await flush();
    ok(/열지 않음/.test(n2) && d.note() === n2 && !d.confirm() && mark(S) === 9, "6: 마지막 요청이 크기 초과로 거부된 뒤 옛 요청 완료 = 무시"); }

  // §7 단일 열기 정상
  { const S = fresh(false), d = doc(S), A = deferred(TA);
    S.PF.onOpenFile(A.input); ok(/확인 중/.test(d.note()), "7: 읽는 중 안내"); A.ok(); await flush();
    ok(mark(S) === 2 && /열기 완료/.test(d.note()) && A.input.value === "", "7: 단일 열기 = 열림 · 입력칸 비움");
    S.PF.onOpenFile({ files: [] }); ok(mark(S) === 2 && /열기 완료/.test(d.note()), "7: 파일을 고르지 않은 열기 = 아무 일 없음"); }

  // §8 모르는 원형 버전: 열지 않고 «지원하지 않는 원형 버전»을 버전 번호와 함께 알림 · 현재 작업 그대로(마이그레이션 없음)
  { const So = makeSession(); So.sb.captureBlockSnapshot = () => Object.assign(SNAPSHOT(), { schemaVersion: 6 });
    let old = null, why = ""; try { So.DW.startFromBlock(So.BW.complete()); old = So.PF.buildFileText(AT).text; } catch (e) { why = String(e && (e.reason || e.message)); }
    if (old) { const S = fresh(true), d = doc(S), g0 = J(S.PF.encodeGraph({ block: S.BW.latest(), project: S.P() })), F = deferred(old);
      S.PF.onOpenFile(F.input); F.ok(); await flush();
      ok(/지원하지 않는 원형 버전/.test(d.note()) && /v6/.test(d.note()) && /v8/.test(d.note()) && !d.confirm() && J(S.PF.encodeGraph({ block: S.BW.latest(), project: S.P() })) === g0, "8: 원형 v6 파일 = 열지 않음 + 버전 명시 안내 · 현재 작업 바이트 동일 (" + d.note().slice(0, 60) + ")"); }
    else ok(/self-verify-failed/.test(why), "8: 원형 v6 은 이 앱이 저장 단계에서 이미 거부(" + why + ") — 그런 파일은 이 판으로 만들 수 없어 열기 안내 문구는 여기서 재현 불가"); }

  console.log("projectOpenRaceCheck: " + PASS + " passed, " + FAIL + " failed");
  fails.forEach(f => console.log("  FAIL " + f));
  process.exit(FAIL ? 1 : 0);
})();
