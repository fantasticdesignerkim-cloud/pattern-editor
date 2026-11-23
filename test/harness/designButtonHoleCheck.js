// ══════════════════════════════════════════════
// designButtonHoleCheck.js — 단추 지름 11.5mm · 단춧구멍 13mm (2026-11-23 사용자 확정) 통합 회귀
//   §1 기본 치수(지름 1.15 · 구멍 1.3 · 옛 1.3) · 구멍 좌표(앞중심 가운데 · 수평 · 단추 높이)
//   §2 완료본·hash: 구멍은 designResult.buttonholes 에만(몸판·소매·카라 hash 불변) · 구멍 없는 옛 단추·단추 없음 = Design hash 동일 · 구멍만 바뀌면 Design 만 낡음 · 앞단에 닿거나 넘으면 buttons-invalid
//   §6 저장/열기: 새 구멍 · 옛 단추(구멍 키 없음)
//   §3 재단: 구멍은 착용자 오른앞판 한 조각에만(왼앞판 반사 복제 없음) · 좌표가 앞중심 가운데 수평
//   §4 DXF 일반(INTERNAL)·AAMA(8): 실제 길이 13mm · 오른앞판 범위에만 · 왼앞판 0 · 6개
//   §5 쌍이 아니면(수량 3) 어느 쪽에도 내보내지 않고 사유를 남김 · 구멍 없는 출력은 구멍 표시 0
//   독립 검증: 이 파일 안의 DXF 파서·거리 계산으로 대조한다.
//   node test/harness/designButtonHoleCheck.js   (Bash 없이 작성돼 아직 실행하지 못했다 — 실행 결과로만 신뢰할 것)
// ══════════════════════════════════════════════
"use strict";
const vm = require("vm"), fs = require("fs"), path = require("path");
let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
process.on("uncaughtException", e => { console.log("designButtonHoleCheck: 예외 — " + (e && e.stack || e).toString().split("\n").slice(0, 4).join(" | ")); fails.slice(0, 20).forEach(f => console.log("  ✗ " + f)); process.exit(1); });
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
const SLEEVE_EXTRA = (() => { const out = [];
  "BCDEFGHIJKLMNOPQRSTUVWXYZ".split("").forEach(k => { const R0 = path.join(ROOT, "js"); if (fs.existsSync(path.join(R0, "designSleeve" + k + ".js"))) out.push("designSleeve" + k + ".js"); out.push("sleeve" + k + "Apply.js"); });
  return out; })();
const FILES = ["blockWorkflow.js", "designProject.js", "sideSeamMagnet.js", "designLineTool.js", "sleeveSplit.js", "sleeveOutlineEdit.js", "designFlare.js", "designJoin.js", "designWaistSeam.js", "designYokeSeam.js", "designPrincess.js",
  "designPlacket.js", "designButtons.js", "designBodice.js", "bodicePresets.js", "designLayout.js", "designRenderer.js", "bodiceCheckpoint.js", "peplumAnnotation.js", "designSleeve.js", "sleeveMeasure.js", "sleeveCheckpoint.js", "sleevePresets.js",
  "designSleeveA.js", "designCuff.js", "sleeveAApply.js", "sleeveAnnotation.js", "designCollar.js", "collarPresets.js", "collarCheckpoint.js", "designResult.js", "projectFile.js", "seamMatch.js", "seamAllowance.js", "cutPrep.js", "cutPrint.js", "cutDxf.js"].concat(SLEEVE_EXTRA);
const SRC = {}; FILES.forEach(f => { SRC[f] = fs.readFileSync(path.join(ROOT, "js", f), "utf8"); });

function makeSession() {
  const ELS = {}; let LOADING = null; const SVG_H = {}, DOC_H = {};
  const el = id => { if (!ELS[id]) ELS[id] = { id, textContent: "", value: "", disabled: false, hidden: false, title: "", attrs: {}, setAttribute(k, v) { this.attrs[k] = String(v); }, removeAttribute(k) { delete this.attrs[k]; }, getAttribute(k) { return this.attrs[k]; } }; return ELS[id]; };
  const sb = { window: {}, console: { log() {}, warn() {} }, Math, JSON, Object, Array, isFinite, structuredClone, Error, Date, Promise, Number, String, Map, Set, WeakMap,
    setTimeout: () => 0, clearTimeout: () => {},
    c2p: (x, y) => [x * 10, y * 10], SC: 10, viewZ: 1, eventToPatternPoint: e => [e.px, e.py], render: () => {},
    svg: { addEventListener(t, f) { (SVG_H[LOADING + ":" + t] = SVG_H[LOADING + ":" + t] || []).push(f); }, setPointerCapture() {}, releasePointerCapture() {} },
    document: { createElementNS: () => ({ setAttribute() {}, appendChild() {} }), getElementById: el, addEventListener(t, f) { (DOC_H[LOADING + ":" + t] = DOC_H[LOADING + ":" + t] || []).push(f); } } };
  sb.globalThis = sb; vm.createContext(sb);
  sb.window.isDesignStageActive = () => true; sb.window.addEventListener = () => {}; sb.window.refreshDesignResultUI = () => {};
  sb.captureBlockSnapshot = () => SNAPSHOT();
  FILES.forEach(f => { LOADING = f; vm.runInContext(SRC[f], sb, { filename: f }); }); LOADING = null;
  const W = sb.window; W.designLineQuickBar = { sync() {} };
  const S = { W, BW: W.blockWorkflow, DW: W.designWorkflow, DB: W.designBodice, BP: W.bodicePresets, BC: W.bodiceCheckpoint, SC: W.sleeveCheckpoint, DR: W.designResult, DLy: W.designLayout,
    CP: W.collarPresets, CC: W.collarCheckpoint, DC: W.designCollar, CUT: W.cutPrep, PRINT: W.cutPrint, DXF: W.cutDxf, BT: W.designButtons, PF: W.projectFile };
  S.P = () => S.DW.current();
  W.projectSessionUI = { snapshot: () => ({ stage: "design", subtab: "collar" }), unfinished: () => [], afterRestore() {} };
  return S;
}
const presetOf = (S, sym) => { for (const f of S.BP.families()) for (const v of f.variants) if (v.symbol === sym && v.presetId) return v.presetId; return null; };
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
// mode: "none"(단추 없음) · "legacy"(구멍 없는 옛 단추 · 지름 키 없음) · "hole"(지름 1.15 · 구멍 1.3 · 6개)
function buildShirt(mode) {
  const S = makeSession(), P = start(S);
  const pp = { overlapCm: 1.2, facingWidthCm: 1.2, lengthMode: "full" }, pr0 = S.W.designPlacket.compute(S.BC.effectiveOutline(P, "front"), pp);
  if (pr0.ok) P.working.frontPlacket = { parameters: pp, outline: pr0.outline, construction: pr0.construction };
  let btn = null;
  if (pr0.ok && mode !== "none") {
    const fr = S.BT.frameFromPlacket(P.working.frontPlacket);
    const q = { startCm: 4, endCm: 20, count: 6 };
    if (mode === "hole") { q.diameterCm = S.BT.DEFAULT_DIAMETER; q.holeLengthCm = S.BT.DEFAULT_HOLE; }
    else q.diameterCm = S.BT.LEGACY_DIAMETER;
    const r = S.BT.compute(q, fr);
    if (r.ok) {
      btn = { parameters: r.parameters, marks: r.marks }; if (r.holes) btn.holes = r.holes;
      if (mode === "legacy") delete btn.parameters.diameterCm;   // 지름 키 없는 옛 저장본
      P.working.frontButtons = btn;
    }
  }
  const a = pr0.ok && S.BC.complete(P).ok, ra = S.W.sleeveAApply.apply(P, { sleeveLengthCm: 52 });
  const okAll = a && ra && ra.ok && (() => { const x = S.SC.complete(P).ok, pl = setCollarM(S), y = S.CC.complete(P).ok, z = S.DR.complete(P).ok; return x && pl.ok && y && z; })();
  return { S, P, ok: !!okAll, btn };
}
const view = (S, P) => { const d = S.CUT.derive(P, true), m = S.CUT.seam(d, P), D = S.CUT.displayOf(d, m); return { d, m, D }; };
const holesOf = r => (r && r.marks || []).filter(mk => mk.kind === "buttonhole");
function parseDxf(txt) {
  const L = txt.split(/\r?\n/), R = []; for (let i = 0; i + 1 < L.length; i += 2) R.push([L[i].trim(), L[i + 1]]);
  const out = []; let sec = null, blk = null, cur = null, lastPoly = null;
  for (let i = 0; i < R.length; i++) {
    const [c, v] = R[i];
    if (c === "0") {
      cur = null;
      if (v === "SECTION") sec = R[i + 1] ? R[i + 1][1].trim() : null;
      else if (v === "ENDSEC") sec = null;
      else if (v === "BLOCK") { cur = { type: "BLOCK", f: {} }; }
      else if (v === "ENDBLK") blk = null;
      else if (v === "VERTEX") { cur = { type: "VERTEX", f: {} }; if (lastPoly) lastPoly.verts.push(cur); }
      else if (v === "SEQEND") { /* 끝 */ }
      else { cur = { type: v, f: {}, verts: [], sec, blk }; out.push(cur); if (v === "POLYLINE") lastPoly = cur; }
    } else if (cur) { if (cur.type === "BLOCK" && c === "2") { blk = v; } else (cur.f[c] = cur.f[c] || []).push(v); }
  }
  return out.filter(e => e.sec === "ENTITIES" || e.sec === "BLOCKS");
}
const layerOf = e => (e.f["8"] || [])[0];
const lineMm = e => { const g = c => Number((e.f[c] || [])[0]); return { len: Math.hypot(g("11") - g("10"), g("21") - g("20")), dy: Math.abs(g("21") - g("20")) }; };
const isHole13 = e => { if (e.type !== "LINE") return false; const m = lineMm(e); return Math.abs(m.len - 13) < 0.01 && m.dy < 0.001; };

(function main() {
  const H = buildShirt("hole"), N = buildShirt("none"), Lg = buildShirt("legacy");
  ok(H.ok && N.ok && Lg.ok, "0: 세 가지 셔츠 완료 사슬이 끝남(이 뒤 검사의 전제)" + (H.ok ? "" : " [hole 실패]") + (N.ok ? "" : " [none 실패]") + (Lg.ok ? "" : " [legacy 실패]"));
  if (!(H.ok && N.ok && Lg.ok)) return;
  const { S, P } = H;

  // ── §1 기본 치수·좌표 ──
  ok(S.BT.DEFAULT_DIAMETER === 1.15 && S.BT.DEFAULT_HOLE === 1.3 && S.BT.LEGACY_DIAMETER === 1.3, "1: 지름 1.15(11.5mm) · 구멍 1.3(13mm) · 옛 지름 1.3");
  const cfX = P.working.frontPlacket.construction[1].from.x;
  ok(H.btn && H.btn.holes && H.btn.holes.length === 6 && H.btn.holes.every((q, i) => Math.abs((q.a.x + q.b.x) / 2 - cfX) < 1e-3 && Math.abs(q.b.x - q.a.x - 1.3) < 1e-3 && q.a.y === q.b.y && q.a.y === H.btn.marks[i].y), "1: 구멍 6개 · 앞중심 가운데 · 길이 1.3 · 수평 · 단추 높이");

  // ── §2 완료본·hash ──
  const rH = P.working.bodiceResult, rN = N.P.working.bodiceResult, rL = Lg.P.working.bodiceResult;
  //   구멍은 몸판 완료본(bodiceResult)이 아니라 최종 Design 완료(designResult)에만 묶인다.
  const dH = P.working.designResult, dN = N.P.working.designResult, dL = Lg.P.working.designResult;
  ok(!("buttons" in rH) && !("buttonholes" in rH) && !("buttons" in rN) && !("buttons" in rL), "2: 몸판 완료본에는 단추·구멍 키 없음(몸판 완료본 무변경)");
  ok(rH.hash === rN.hash && rL.hash === rN.hash && P.working.sleeveResult.hash === N.P.working.sleeveResult.hash && P.working.collarResult.hash === N.P.working.collarResult.hash, "2: 구멍 유무와 무관하게 몸판·소매·카라 hash 동일(상류 hash 안정)");
  ok(dH.buttonholes && dH.buttonholes.holes.length === 6 && dH.buttonholes.holeLengthCm === 1.3 && dH.buttonholes.diameterCm === 1.15 && Object.isFrozen(dH.buttonholes) && Object.isFrozen(dH.buttonholes.holes[0].a), "2: Design 완료본에 구멍 기하 보존(동결)");
  ok(!("buttonholes" in dN) && !("buttonholes" in dL) && dL.hash === dN.hash && dH.hash !== dN.hash, "2: 구멍 없음·옛 단추(구멍 키 없음) = buttonholes 키 없음 · Design hash 동일 / 구멍 적용 = hash 다름");
  ok(S.DR.check(P).ok && !S.DR.isCurrentDesignChanged(P), "2: 완료 직후 Design 최신(변경 없음)");
  {   // 구멍만 바뀌거나 지워지면 Design 완료만 낡는다 — 몸판·소매·카라 완료는 그대로 유효
    const saved = P.working.frontButtons, hashes = [rH.hash, P.working.sleeveResult.hash, P.working.collarResult.hash];
    const upstreamOk = () => !S.BC.isCurrentBodiceChanged(P) && !S.SC.isCurrentSleeveChanged(P) && !S.CC.isCurrentCollarChanged(P);
    const broken = JSON.parse(J(saved)); delete broken.holes; P.working.frontButtons = broken;   // 일부러 깨진 저장(구멍 길이는 있는데 좌표 없음) = 차단
    ok(!S.DR.check(P).ok && S.DR.check(P).fails.includes("buttons-invalid") && S.DR.isCurrentDesignChanged(P) && upstreamOk(), "2: 구멍 좌표 손상 → Design 완료 차단·낡음 · 상류 완료는 유효");
    P.working.frontButtons = null;
    ok(S.DR.check(P).ok && S.DR.isCurrentDesignChanged(P) && upstreamOk() && J([P.working.bodiceResult.hash, P.working.sleeveResult.hash, P.working.collarResult.hash]) === J(hashes), "2: 구멍 제거 → Design 만 낡음(변경됨) · 몸판·소매·카라 hash·유효 그대로");
    ok(S.DR.complete(P).ok && !("buttonholes" in P.working.designResult) && !S.DR.isCurrentDesignChanged(P), "2: 다시 Design 완료 → 구멍 없는 새 완료본");
    const fr = S.BT.frameFromPlacket(P.working.frontPlacket), rr = S.BT.compute({ startCm: 4, endCm: 20, count: 6, diameterCm: 1.15, holeLengthCm: 1.3 }, fr);
    P.working.frontButtons = { parameters: rr.parameters, marks: rr.marks, holes: rr.holes };
    ok(S.DR.isCurrentDesignChanged(P) && S.DR.complete(P).ok && P.working.designResult.buttonholes && P.working.designResult.hash === dH.hash && !S.DR.isCurrentDesignChanged(P) && upstreamOk(), "2: 구멍 되살림 → 낡음 → 재완료 = 처음과 같은 hash");
    // 구멍 크기만 바뀜(길이 1.3 → 1.0, 지름보다 짧아 거부) / 1.25(허용) → hash 변경
    const r2 = S.BT.compute({ startCm: 4, endCm: 20, count: 6, diameterCm: 1.15, holeLengthCm: 1.25 }, fr);
    P.working.frontButtons = { parameters: r2.parameters, marks: r2.marks, holes: r2.holes };
    ok(S.DR.isCurrentDesignChanged(P) && upstreamOk() && S.DR.complete(P).ok && P.working.designResult.hash !== dH.hash, "2: 구멍 길이만 바뀜 → Design 만 낡음 · 재완료 hash 다름");
    // 동결된 몸판 여밈(여밈분 1.2)에 닿거나 넘는 구멍 = 완료 차단
    const frBig = { cfX: fr.cfX, topY: fr.topY, botY: fr.botY, overlapCm: 5 };
    for (const L of [2.4, 3]) {   // 2.4 = 끝이 정확히 앞단(cfX+1.2)에 닿음 · 3 = 넘음
      const big = S.BT.compute({ startCm: 4, endCm: 20, count: 6, diameterCm: 1.15, holeLengthCm: L }, frBig);
      P.working.frontButtons = { parameters: big.parameters, marks: big.marks, holes: big.holes };
      const cB = S.DR.check(P);
      ok(big.ok && !cB.ok && cB.fails.includes("buttons-invalid") && !S.DR.complete(P).ok && S.DR.isCurrentDesignChanged(P), "2: 구멍 " + L + "cm — 완성 앞단에 닿거나 넘으면 Design 완료 차단");
    }
    const frEdge = S.BT.compute({ startCm: 0, endCm: 20, count: 6, diameterCm: 1.15, holeLengthCm: 1.3 }, { cfX: fr.cfX, topY: fr.topY, botY: fr.botY, overlapCm: 1.2 });
    ok(!frEdge.ok && frEdge.reason === "hole-on-edge", "2: 목 가장자리에 닿는 첫 구멍은 계산 단계에서 거부");
    P.working.frontButtons = { parameters: rr.parameters, marks: rr.marks, holes: rr.holes };
    ok(S.DR.complete(P).ok && P.working.designResult.hash === dH.hash, "2: 원래 구멍으로 되돌려 재완료 → 처음 hash");
  }

  // ── §3 재단 표시 — 오른앞판 한 조각에만 ──
  const v = view(S, P), F = v.D.front, Mi = v.D["front~m"];
  ok(F && Mi && v.m.pairing && v.m.pairing.active, "3: 앞판 좌우 한 쌍 투영(전제)");
  if (!(F && Mi)) return;
  const R = F.side === "R" ? F : Mi, Lf = R === F ? Mi : F, sgn = R === F ? 1 : -1;
  ok(holesOf(R).length === 6 && holesOf(Lf).length === 0, "3: 구멍 6개는 착용자 오른앞판에만 · 왼앞판 0(반사 복제 없음)");
  ok(holesOf(R).every(mk => mk.segs.length === 1 && Math.abs(mk.segs[0].from.y - mk.segs[0].to.y) < 1e-9 && Math.abs(Math.abs(mk.segs[0].to.x - mk.segs[0].from.x) - 1.3) < 1e-6 && Math.abs((mk.segs[0].from.x + mk.segs[0].to.x) / 2 - sgn * cfX) < 1e-6 && !mk.label), "3: 구멍 = 수평 1.3 선 · 앞중심 가운데(좌표계 반영)");
  const hy = holesOf(R).map(mk => mk.segs[0].from.y).sort((a, b) => a - b), by = H.btn.marks.map(m => m.y);
  ok(J(hy) === J(by), "3: 구멍 높이 = 단추 높이");
  const vN = view(N.S, N.P);
  ok(holesOf(vN.D.front).length === 0 && holesOf(vN.D["front~m"]).length === 0 && vN.D.front.marks.length === Lf.marks.length, "3: 단추 없는 셔츠 = 구멍 표시 0 · 다른 표시 수는 왼앞판과 같음(구멍만 추가된 것)");
  const vL = view(Lg.S, Lg.P);
  ok(holesOf(vL.D.front).length === 0 && holesOf(vL.D["front~m"]).length === 0, "3: 구멍 키 없는 옛 단추 = 자동 생성 없음");

  // ── §4 DXF ──
  const meta = { version: "t", createdAt: "2026-11-23T00:00:00" };
  const gx = S.DXF.build(P, meta), ax = S.DXF.build(P, meta, { format: "aama" });
  ok(gx.ok && ax.ok, "4: 일반·AAMA DXF 만들어짐" + (gx.ok ? "" : " — " + gx.reason) + (ax.ok ? "" : " — " + ax.reason));
  if (gx.ok && ax.ok) {
    const E = parseDxf(gx.dxf), ps = gx.stats.pieces;
    const cutIdx = []; E.forEach((e, i) => { if (e.type === "POLYLINE" && layerOf(e) === "CUT") cutIdx.push(i); });
    const iR = ps.findIndex(p => p.id === "front-right"), iL = ps.findIndex(p => p.id === "front-left");
    const rangeOf = k => [cutIdx[k], k + 1 < cutIdx.length ? cutIdx[k + 1] : E.length];
    const inRange = (k) => { const [a, b] = rangeOf(k); return E.slice(a, b).filter(e => layerOf(e) === "INTERNAL" && isHole13(e)); };
    ok(iR >= 0 && iL >= 0, "4: 일반 DXF front-right · front-left 조각");
    ok(inRange(iR).length === 6 && inRange(iL).length === 0, "4: 일반 DXF = INTERNAL 레이어 실제 길이 13mm 수평선 6개가 front-right 에만, front-left 0");
    ok(E.filter(e => layerOf(e) === "INTERNAL" && isHole13(e)).length === 6, "4: 일반 DXF 전체에서도 13mm 구멍선은 6개뿐(다른 조각에 없음)");
    const A = parseDxf(ax.dxf), a8 = A.filter(e => layerOf(e) === "8" && isHole13(e));
    ok(a8.length === 6 && new Set(a8.map(e => e.blk)).size === 1 && !/left/i.test(String(a8[0].blk)), "4: AAMA = 레이어 8 실제 길이 13mm 6개 · 한 블록(왼앞판 블록 아님)");
    const gN = N.S.DXF.build(N.P, meta);
    ok(gN.ok && parseDxf(gN.dxf).filter(e => layerOf(e) === "INTERNAL" && isHole13(e)).length === 0, "4: 단추 없는 셔츠 DXF = 13mm 구멍선 0(기존 출력 그대로)");
  }

  // ── §5 쌍이 아니면 내보내지 않는다 ──
  S.CUT.setQty("front", 3, P);
  const v5 = view(S, P), F5 = v5.D.front;
  ok(F5 && !v5.D["front~m"] && holesOf(F5).length === 0 && typeof F5.buttonholeWhy === "string" && F5.buttonholeWhy.length > 0, "5: 앞판 수량 3 = 좌우 쌍 아님 → 구멍을 어느 쪽에도 내보내지 않고 사유(buttonholeWhy)를 남김");
  const g5 = S.DXF.build(P, meta);
  ok(g5.ok && parseDxf(g5.dxf).filter(e => layerOf(e) === "INTERNAL" && isHole13(e)).length === 0, "5: 그때 DXF 에도 구멍선 0");
  const pf5 = S.PRINT.preflight(P);
  ok(pf5.warnings.some(t => /단춧구멍/.test(t)) && !pf5.blockers.some(t => /단춧구멍/.test(t)), "5: 인쇄·DXF 사전 점검 = 단춧구멍 알림(막는 문제 아님 · 오른앞판 확인 불가 사유)");

  // ── §6 저장/열기(새 구멍 + 옛 구멍 없는 저장) ──
  const roundTrip = (B0, tag) => {
    const built = B0.S.PF.buildFileText({ savedAt: "2026-11-23T00:00:00.000Z" }), S3 = makeSession(), vv = S3.PF.verifyText(built.text);
    ok(vv.ok, "6: " + tag + " 열기 검증 통과 (" + (vv.reason || "") + " " + (vv.detail || "") + ")");
    if (!vv.ok) return null;
    S3.PF.commitCandidate(vv.candidate);
    return { S3, Q: S3.P(), P0: B0.P };
  };
  const H2 = buildShirt("hole"), rtH = H2.ok ? roundTrip(H2, "새 구멍") : null;
  if (rtH) {
    const a0 = rtH.P0.working.designResult, a1 = rtH.Q.working.designResult;
    ok(a1.hash === a0.hash && J(a1.buttonholes) === J(a0.buttonholes) && Object.isFrozen(a1.buttonholes) && !rtH.S3.DR.isCurrentDesignChanged(rtH.Q), "6: 새 구멍 저장→열기 = 같은 hash·구멍 기하·동결 · 최신 상태");
    ok(J(rtH.Q.working.frontButtons) === J(rtH.P0.working.frontButtons), "6: 세션 단추(구멍 포함)도 그대로 복원");
  }
  const rtL = Lg.ok ? roundTrip(Lg, "옛 단추(구멍 없음)") : null;
  if (rtL) {
    const b0 = rtL.P0.working.designResult, b1 = rtL.Q.working.designResult;
    ok(b1.hash === b0.hash && !("buttonholes" in b1) && J(rtL.Q.working.frontButtons) === J(rtL.P0.working.frontButtons) && !("diameterCm" in rtL.Q.working.frontButtons.parameters) && !("holes" in rtL.Q.working.frontButtons), "6: 옛 단추 저장→열기 = 구멍·지름 키 생성 없음 · hash 동일");
  }

})();
process.on("exit", code => {
  console.log(`designButtonHoleCheck: ${PASS} pass, ${FAIL} fail`);
  if (FAIL) { console.log(fails.join("\n")); if (!code) process.exitCode = 1; }
});
