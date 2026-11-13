// ══════════════════════════════════════════════
// seamMatchIntegrationCheck.js — «맞춤 길이» 카드 **실제 엔진** 통합(2026-11-13 Codex 리뷰 보완 · stub 없음).
//   세션 = 독립 vm context(실제 blockWorkflow·designWorkflow·designBodice·designPlacket·checkpoint·소매 Ⓐ·designCuff·collarPresets·designResult·projectFile + js/seamMatch.js).
//   §1 박시 Ⓐ + 여밈 1.2/안단 1.2 → 몸판 완료 → 소매 Ⓐ → 카라 M → Design 완료: 카드 수치 = 각 측정 권위(완료본·check·독립 점열 실측)
//   §2 계산이 아무것도 바꾸지 않음(프로젝트 그래프·완료본 hash 바이트 동일 · 반복 계산 결정론)
//   §3 입력/완료 변경 → 숫자 숨김(변경됨) · 다시 완료 → 현재 값 · 카라 옛 몸판 기준
//   §4 커프스 셔링 = designCuff 기록 · 저장 → 빈 세션 열기 → 같은 모델
//   새 판정 원리 없음(기준 없는 행은 차이만).   node test/harness/seamMatchIntegrationCheck.js
// ══════════════════════════════════════════════
"use strict";
const vm = require("vm"), fs = require("fs"), path = require("path");
let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
process.on("uncaughtException", e => { console.log("seamMatchIntegrationCheck: 예외 — " + (e && e.stack || e).toString().split("\n").slice(0, 3).join(" | ")); fails.slice(0, 20).forEach(f => console.log("  ✗ " + f)); process.exit(1); });
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
const FILES = ["blockWorkflow.js", "designProject.js", "sideSeamMagnet.js", "designLineTool.js", "sleeveSplit.js", "sleeveOutlineEdit.js", "designFlare.js", "designJoin.js", "designWaistSeam.js", "designYokeSeam.js", "designPrincess.js",
  "designPlacket.js", "designBodice.js", "bodicePresets.js", "designLayout.js", "designRenderer.js", "bodiceCheckpoint.js", "peplumAnnotation.js", "designSleeve.js", "sleeveMeasure.js", "sleeveCheckpoint.js", "sleevePresets.js",
  "designSleeveA.js", "designCuff.js", "sleeveAApply.js", "sleeveAnnotation.js", "designCollar.js", "collarPresets.js", "collarCheckpoint.js", "designResult.js", "projectFile.js", "seamMatch.js"];
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
    DC: W.designCollar, CP: W.collarPresets, CC: W.collarCheckpoint, DR: W.designResult, DLT: W.designLineTool, DLy: W.designLayout, PF: W.projectFile, SM: W.seamMatch, SA: W.designSleeveA, DCF: W.designCuff };
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
// ── 독립 계측(엔진·카드 코드 미사용 · 200 샘플) ──
const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function segLenInd(s) {
  const cubs = [];
  if (s.kind === "line") return D(s.from, s.to);
  if (s.kind === "cubic") cubs.push([s.from, s.c1, s.c2, s.to]);
  else { let cur = null; (s.commands || []).forEach(c => { if (c.type === "M") cur = c.points[0]; else if (c.type === "L") { cubs.push([cur, cur, c.points[0], c.points[0]]); cur = c.points[0]; } else { cubs.push([cur, c.points[0], c.points[1], c.points[2]]); cur = c.points[2]; } }); }
  let tot = 0;
  cubs.forEach(q => { let prev = q[0]; for (let k = 1; k <= 200; k++) { const t = k / 200, u = 1 - t, pt = { x: u * u * u * q[0].x + 3 * u * u * t * q[1].x + 3 * u * t * t * q[2].x + t * t * t * q[3].x, y: u * u * u * q[0].y + 3 * u * u * t * q[1].y + 3 * u * t * t * q[2].y + t * t * t * q[3].y }; tot += D(prev, pt); prev = pt; } });
  return tot;
}
const sumBy = (outline, pred) => outline.filter(pred).reduce((t, s) => t + segLenInd(s), 0);
const row = (m, id) => m.rows.find(r => r.id === id);
const near = (a, b, e) => typeof a === "number" && typeof b === "number" && Math.abs(a - b) <= (e || 1e-6);
const noNum = r => r && r.a === undefined && r.b === undefined && r.diff === undefined && typeof r.reason === "string" && r.reason.length > 0;
const graph = S => J(S.PF.encodeGraph({ block: S.BW.latest(), project: S.P() }));
const hashes = P => [P.working.bodiceResult, P.working.sleeveResult, P.working.collarResult, P.working.designResult].map(r => r && r.hash).join(",");

// ══ §1·§2 대표 동선 ══
const S = makeSession(), P = start(S);
let TEXT = null, M_DONE = null;
{
  ok(typeof S.SM.compute === "function" && Object.isFrozen(S.SM), "0: 실제 seamMatch 모듈 로드");
  const m0 = S.SM.compute();
  ok(m0.ok && row(m0, "side").a && row(m0, "shoulder").a && ["ah-front", "ah-back", "ah-total", "neck-band", "band-collar"].every(id => noNum(row(m0, id))), "1: 몸판 완료 전 = 몸판 행만 측정 · 소매/카라 미측정(숫자 없음)");
  ok(setPlacket(S, 1.2, 1.2).ok, "1: 여밈 1.2 / 안단 1.2");
  const rb = S.BC.complete(P); ok(rb.ok, "1: 몸판 완료 (" + (rb.reason || "") + ")");
  const ra = S.W.sleeveAApply.apply(P, { sleeveLengthCm: 52 }); ok(ra && ra.ok, "1: 소매 Ⓐ 적용");
  ok(S.SC.complete(P).ok, "1: 소매 완료");
  const pl = setCollarM(S); ok(pl.ok && P.working.collarDraft.type === "shirt-two-piece" && !!P.working.collarDraft.body, "1: 카라 M(밴드 + 위 칼라) 적용");
  ok(S.CC.complete(P).ok, "1: 카라 완료"); ok(S.DR.complete(P).ok, "1: Design 완료");

  const g0 = graph(S), h0 = hashes(P);
  const m = S.SM.compute(), m2 = S.SM.compute(), m3 = S.SM.compute();
  ok(graph(S) === g0 && hashes(P) === h0, "2: 계산 3회 뒤 프로젝트 그래프·완료본 hash 4개 바이트 동일");
  ok(J(m) === J(m2) && J(m) === J(m3), "2: 반복 계산 결정론");
  M_DONE = J(m);
  ok(m.rows.map(r => r.id).join() === "side,shoulder,ah-front,ah-back,ah-total,neck-band,band-collar" && m.rows.every(r => r.a && r.b), "1: 7행 전부 측정");

  // 옆선 = bodiceCheckpoint.measureSideSeam(effectiveOutline) = 완료본 sideSeam = 독립 실측
  const B = P.working.bodiceResult, oF = S.BC.effectiveOutline(P, "front"), oB = S.BC.effectiveOutline(P, "back"), sd = row(m, "side");
  ok(near(sd.a.cm, S.BC.measureSideSeam(oF).length) && near(sd.b.cm, S.BC.measureSideSeam(oB).length), "1: 옆선 = measureSideSeam(현재 유효 외곽)");
  const bcS = S.BC.check(P).sideSeam;
  ok(near(sd.a.cm, bcS.front, 1e-9) && near(sd.b.cm, bcS.back, 1e-9), "1: 옆선 = 몸판 완료 판정(check.sideSeam)과 같은 값");
  ok(near(sd.a.cm, sumBy(B.front.outline, s => s.edge === "side-seam"), 1e-3) && near(sd.b.cm, sumBy(B.back.outline, s => s.edge === "side-seam"), 1e-3), "1: 옆선 = 몸판 완료본 외곽 독립 실측");
  ok(near(sd.a.cm, sumBy(oF, s => s.edge === "side-seam"), 1e-3) && near(sd.b.cm, sumBy(oB, s => s.edge === "side-seam"), 1e-3), "1: 옆선 = 독립 점열 실측");
  ok(sd.status === (bcS.status === "match" ? "match" : "diff"), "1: 옆선 상태 = 몸판 완료 판정과 같은 status(" + bcS.status + ")");
  // 어깨 = shoulder edge 합(독립 실측). 원형 뒤 어깨에는 다트가 열려 있다 → 다트 다리는 shoulder 가 아니고 두 구간이 다트 입구에서 끊긴다.
  const sh = row(m, "shoulder"), shB = oB.filter(s => s.edge === "shoulder"), shF = oF.filter(s => s.edge === "shoulder");
  ok(near(sh.a.cm, sumBy(oF, s => s.edge === "shoulder"), 1e-6) && near(sh.b.cm, sumBy(oB, s => s.edge === "shoulder"), 1e-6), "1: 어깨 = 독립 실측");
  ok(shF.length === 1 && shB.length === 2 && shB.every(s => s.kind === "line"), "1: 앞 1구간 · 뒤 2구간(다트 양쪽)");
  {
    // 다트를 닫았을 때 실제로 한 봉제선인지: 외곽은 다트 입구에서 끊기고(다리는 construction), 두 구간의 안쪽 끝이 각각 다트 다리로 같은 꼭짓점에 이어진다.
    //   → 닫으면 두 입구 점이 만나 한 봉제선 = 구간 합. 다리 길이 차(원형의 알려진 잔여 단차)는 어깨 길이에 넣지 않는다(패턴 확정 단계 보정 대상).
    const mouthA = shB[0].to, mouthB = shB[1].from, cons = P.working.geometry.back.construction || [];
    const legA = cons.find(s => s.kind === "line" && D(s.from, mouthA) < 1e-6), legB = cons.find(s => s.kind === "line" && D(s.to, mouthB) < 1e-6);
    ok(D(mouthA, mouthB) > 0.5 && !!legA && !!legB && D(legA.to, legB.from) < 1e-6, "1: 뒤 어깨 두 구간 = 열린 다트 입구 양쪽(다리 2개가 같은 꼭짓점으로)");
    const dLeg = legA && legB ? Math.abs(segLenInd(legA) - segLenInd(legB)) : NaN;
    ok(dLeg < 0.2, "1: 다트 다리 길이 차 " + (dLeg || 0).toFixed(3) + "cm(작은 단차 — 어깨 길이에 미포함)");
    ok(sh.basis.some(t => /2구간 합/.test(t)) && sh.basis.some(t => /단차/.test(t)), "1: 카드가 다트 닫힘·단차 미포함을 밝힘");
  }
  // 진동 ↔ 소매산 = 소매 완료본 cap(실측) · 몸판 완료본 봉제 진동
  const R = P.working.sleeveResult, AH = S.SA.sewnArmholeLengths(B);
  ["front", "back"].forEach(k => {
    const r = row(m, "ah-" + k);
    ok(near(r.b.cm, R.cap.lengths[k], 1e-4) && near(r.a.cm, AH[k], 1e-4) && near(r.diff, R.cap.ease[k], 1e-4), "1: " + k + " 진동/소매산/차이 = 완료본 cap.lengths · sewnArmholeLengths · cap.ease");
  });
  const rt = row(m, "ah-total");
  ok(near(rt.b.cm, R.cap.lengths.total, 1e-4) && near(rt.a.cm, AH.front + AH.back, 1e-4) && near(rt.diff, R.cap.ease.total, 1e-4) && rt.status === "ease", "1: 합계 = 완료본 · 양의 이세 = 이즈(오류 아님)");
  ok(near(R.cap.lengths.front, sumBy(R.cap.frontPrimitives || [], () => true), 5e-3) && near(R.cap.lengths.back, sumBy(R.cap.backPrimitives || [], () => true), 5e-3), "1: 소매산 = 완료본 cap primitives 독립 실측");
  // 목둘레 ↔ 밴드 · 밴드 윗선 ↔ 위 칼라
  const cd = P.working.collarDraft, nb = row(m, "neck-band"), bc = row(m, "band-collar");
  ok(near(nb.a.cm, B.necklineLengths.half, 1e-4) && near(nb.a.cm, sumBy(oF, s => s.edge === "neckline") + sumBy(oB, s => s.edge === "neckline"), 5e-3), "1: 목둘레(반쪽) = 완료본 necklineLengths.half = 독립 실측(여밈분 미포함)");
  ok(near(nb.b.cm, cd.measure.lowerNeckSeamLenCm, 1e-3) && near(nb.b.cm, sumBy(cd.standGeometry.outline, s => s.part === "neck-seam"), 1e-3), "1: 밴드 달림선 = 밴드 형상 neck-seam 실측 = 카라 기록");
  ok(cd.measure.lowerExtensionLenCm > 0 && near(sumBy(cd.standGeometry.outline, s => s.part === "extension"), cd.measure.lowerExtensionLenCm, 1e-6) && nb.b.cm < sumBy(cd.standGeometry.outline, s => s.part === "neck-seam" || s.part === "extension") - 0.1, "1: 밴드 앞 끝 연장(여밈분)은 달림선 길이에 넣지 않음");
  ok(near(bc.a.cm, cd.measure.upperNeckSegmentLenCm, 1e-3) && near(bc.b.cm, cd.body.attachLenCm, 1e-3) && near(bc.b.cm, sumBy(cd.body.geometry.outline, s => s.part === "attach"), 1e-3) && bc.status === "match", "1: 밴드 윗선 = top 실측 = 카라 기록 · 위 칼라 = 위 칼라 형상 attach 실측 = 카라 기록");
  const built = S.PF.buildFileText({ savedAt: "2026-11-13T00:00:00.000Z" }); TEXT = built.text;
  ok(graph(S) === g0, "2: 저장이 세션을 바꾸지 않음");
}

// ══ §3 변경 → 숫자 숨김 → 다시 완료 ══
{
  const keep = { side: J(row(JSON.parse(M_DONE), "side")), band: J(row(JSON.parse(M_DONE), "band-collar")) };
  P.working.frontPlacket = null;   // 여밈 제거 = 몸판 완료 뒤 변경
  ok(S.BC.isCurrentBodiceChanged(P), "3: 여밈 제거 → 몸판 변경됨");
  let m = S.SM.compute();
  ok(["ah-front", "ah-back", "ah-total", "neck-band"].every(id => row(m, id).status === "changed" && noNum(row(m, id))), "3: 소매·목둘레 행 = 변경됨 · 옛 숫자 없음");
  ok(J(row(m, "side")) === keep.side && row(m, "shoulder").a && J(row(m, "band-collar")) === keep.band, "3: 현재 형상으로 잴 수 있는 행(옆선·어깨·밴드 윗선)은 그대로 측정");
  ok(!/21\.47|22\.85|44\.32/.test(J(m.rows.filter(r => /^ah-/.test(r.id)))), "3: 변경됨 행 어디에도 옛 소매산 숫자가 남지 않음");
  ok(S.BC.complete(P).ok, "3: 몸판 다시 완료(여밈 없음)");
  m = S.SM.compute();
  ok(row(m, "neck-band").status === "changed" && noNum(row(m, "neck-band")), "3: 카라가 옛 몸판 완료본 기준 = 변경됨");
  const c = S.SC.check(P), stale = (c.fails || []).some(f => f === "bodice-stale" || f === "source-mismatch");
  ok(stale ? ["ah-front", "ah-back", "ah-total"].every(id => row(m, id).status === "changed" && noNum(row(m, id))) : true, "3: 소매가 옛 몸판 기준이면 변경됨(숫자 없음)");
  ok(S.W.sleeveAApply.apply(P, { sleeveLengthCm: 54 }).ok, "3: 소매 입력 변경(소매길이 54) 재적용");
  m = S.SM.compute(); const c2 = S.SC.check(P);
  ok(row(m, "ah-total").a && near(row(m, "ah-total").b.cm, c2.capLengths.total, 1e-9) && near(row(m, "ah-total").diff, c2.ease.total, 1e-9), "3: 재적용한 현재 소매 = 현재 check 실측(완료 전이어도 현재 값)");
  ok(S.SC.isCurrentSleeveChanged(P), "3: 소매 완료본은 변경됨 상태(카드는 완료본 숫자를 쓰지 않음)");
  ok(setCollarM(S).ok, "3: 카라 M 재적용"); m = S.SM.compute();
  ok(row(m, "neck-band").a && near(row(m, "neck-band").a.cm, P.working.bodiceResult.necklineLengths.half, 1e-4), "3: 카라 재적용 뒤 목둘레 행 다시 측정");
}

// ══ §4 커프스 셔링 · 저장 복원 ══
{
  const cuff = S.DCF.defaults(), r = S.W.sleeveAApply.apply(P, { sleeveLengthCm: 52, cuff });
  ok(r && r.ok && !!P.working.sleeveA.cuff, "4: 소매 Ⓐ + 커프스 적용");
  const m = S.SM.compute(), cf = row(m, "cuff"), L = P.working.sleeveA.cuff.lengths;
  ok(cf && cf.status === "gather" && near(cf.a.cm, L.attachLengthCm, 1e-9) && near(cf.b.cm, L.sleeveHemCm, 1e-9) && near(cf.diff, L.shirringCm, 1e-9), "4: 소매구 ↔ 커프스 = designCuff 기록 · 셔링분 별도");
  const hem = P.working.geometry.sleeve.outline[3];
  ok(near(cf.b.cm, D(hem.from, hem.to), 1e-9), "4: 소매구 = 현재 소매 소맷부리 독립 실측");
  // 저장(§1 완료 상태) → 빈 세션 열기 → 같은 모델
  const S2 = makeSession(), v = S2.PF.verifyText(TEXT);
  ok(v.ok, "4: 열기 검증 (" + (v.reason || "") + ")");
  ok(S2.SM.compute().ok === false, "4: 빈 세션 = 모델 없음");
  S2.PF.commitCandidate(v.candidate);
  const g = graph(S2), m2 = S2.SM.compute();
  ok(J(m2) === M_DONE, "4: 복원한 세션의 카드 모델 = 저장 전과 바이트 동일");
  ok(graph(S2) === g, "4: 복원 세션에서도 계산이 아무것도 바꾸지 않음");
}

console.log("seamMatchIntegrationCheck: " + PASS + " passed, " + FAIL + " failed");
if (FAIL) { fails.forEach(f => console.log("  FAIL " + f)); process.exit(1); }
