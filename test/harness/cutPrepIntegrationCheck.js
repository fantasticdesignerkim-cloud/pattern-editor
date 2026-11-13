// ══════════════════════════════════════════════
// cutPrepIntegrationCheck.js — 재단 준비 1단계(js/cutPrep.js) **실제 엔진** 통합(2026-11-13 · stub 없음 · 읽기 전용 파생).
//   §1 박시 Ⓐ + 여밈 1.2/1.2 → 소매 Ⓐ + 커프스 → 카라 M → Design 완료: 조각 6장(앞·뒤·소매·커프스·밴드·위 칼라) · 시접 전 완성선 ·
//      종이 위 검사(폐곡선·자기교차·유한) · 실물 치수 = 독립 점열 실측 · 누락(여밈 합성·트임 덧단)은 이유로만 · 원본 별칭 없음 · 동결
//   §2 파생이 아무것도 바꾸지 않음(프로젝트 그래프·완료본 hash 4개 바이트 동일 · 반복 결정론)
//   §3 완료 전/변경됨 = 조각 없음 + 이유 + 돌아갈 서브탭 · 기존 완료본 보존 · 재완료 → 새 hash 로 갱신
//   §4 저장 → 빈 세션 열기 → 같은 조각(파일 stage = design · 새 저장 키 없음)
//   §5 소매 파생 경로: Ⓡ(파생 몸판 = 최종 몸판 · 원래 몸판 중복 없음) · Ⓥ(소매 2장 · 선 누락/중복 0) · Ⓧ(덧천) · Ⓨ(소매 조각 없음) ·
//      닫히지 않는 외곽은 메우지 않고 «표시 보류 + 실측 틈»
//   §6 분리 몸판·중복 방지(합성 완료본): 요크/프린세스 = 나뉘기 전 앞·뒤 제외 · 같은 외곽 참조/같은 형상 = 한 번만 · 미지원 카라 = 이유 ·
//      파트 분리 미리보기(working.parts) = 조각 아님
//   node test/harness/cutPrepIntegrationCheck.js
// ══════════════════════════════════════════════
"use strict";
const vm = require("vm"), fs = require("fs"), path = require("path");
let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
process.on("uncaughtException", e => { console.log("cutPrepIntegrationCheck: 예외 — " + (e && e.stack || e).toString().split("\n").slice(0, 3).join(" | ")); fails.slice(0, 20).forEach(f => console.log("  ✗ " + f)); process.exit(1); });
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
  "designSleeveA.js", "designCuff.js", "sleeveAApply.js", "sleeveAnnotation.js", "designCollar.js", "collarPresets.js", "collarCheckpoint.js", "designResult.js", "projectFile.js", "seamMatch.js", "cutPrep.js"].concat(SLEEVE_EXTRA);
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

// ══ §0 배선 ══
const S = makeSession(), P = start(S);
ok(Object.isFrozen(S.CUT) && typeof S.CUT.derive === "function", "0: 실제 cutPrep 모듈 로드(동결 API)");
ok(typeof S.DLT.buildPieceRing === "function", "0: designLineTool.buildPieceRing 공개(재단 준비가 같은 폐곡선 구성을 쓴다)");
ok(S.CUT.open() === false && S.CUT.isOpen() === false, "0: DOM 없는 세션에서는 화면을 열지 않는다(모델만)");

// ══ §1·§2·§3 대표 동선 ══
let TEXT = null, D_DONE = null;
{
  const d0 = S.CUT.derive(P);
  ok(d0.state === "incomplete" && d0.returnTab === "body" && !d0.pieces && /몸판/.test(d0.reason), "3: 몸판 완료 전 = 조각 없음 · 이유 · 돌아갈 곳 몸판");
  ok(setPlacket(S, 1.2, 1.2).ok && S.BC.complete(P).ok, "1: 박시 Ⓐ + 여밈 1.2/1.2 → 몸판 완료");
  const ra = S.W.sleeveAApply.apply(P, { sleeveLengthCm: 52, cuff: S.DCF.defaults() }); ok(ra && ra.ok && !!P.working.sleeveA.cuff, "1: 소매 Ⓐ + 커프스");
  const dS = S.CUT.derive(P); ok(dS.state === "incomplete" && dS.returnTab === "sleeve", "3: 소매 완료 전 = 돌아갈 곳 소매 (" + dS.returnTab + ")");
  ok(S.SC.complete(P).ok, "1: 소매 완료"); ok(setCollarM(S).ok && P.working.collarDraft.type === "shirt-two-piece", "1: 카라 M"); ok(S.CC.complete(P).ok, "1: 카라 완료");
  const dC = S.CUT.derive(P); ok(dC.state === "incomplete" && dC.returnTab === "collar" && /Design 형상 완료/.test(dC.reason), "3: Design 완료 전 = 카라 탭 «Design 형상 완료» 안내");
  ok(S.DR.complete(P).ok, "1: Design 완료");

  const g0 = graph(S), h0 = hashes(P);
  const d = S.CUT.derive(P), d2 = S.CUT.derive(P), d3 = S.CUT.derive(P);
  ok(graph(S) === g0 && hashes(P) === h0, "2: 파생 3회 뒤 프로젝트 그래프·완료본 hash 4개 바이트 동일");
  ok(J(d) === J(d2) && J(d) === J(d3), "2: 반복 파생 결정론");
  ok(d !== d2 && d.pieces[0].segs !== d2.pieces[0].segs, "2: 매번 새로 파생(캐시된 옛 조각을 돌려주지 않음)");
  D_DONE = J(d);
  ok(d.state === "ready" && d.resultHash === P.working.designResult.hash, "1: ready · 출처 = 현재 designResult.hash");
  ok(ids(d) === "front,back,sleeve-sleeve,cuff,collar-stand,collar-body", "1: 조각 6장 = 앞판·뒤판·소매·커프스·밴드·위 칼라 (" + ids(d) + ")");
  ok(d.pieces.every(p => p.check.ok) && d.failedPieces === 0, "1: 6장 전부 종이 위 검사 통과(폐곡선·자기교차 없음·유한·면적)");
  ok(d.pieces.every(p => { const a = p.segs[0].from, z = p.segs[p.segs.length - 1].to; return Math.hypot(a.x - z.x, a.y - z.y) <= 1e-4 && p.segs.every((s, i) => i === 0 || Math.hypot(s.from.x - p.segs[i - 1].to.x, s.from.y - p.segs[i - 1].to.y) <= 1e-4); }),
    "1: 조각 외곽 = 한 바퀴 연속 ring(독립 확인)");
  ok(d.pieces.every(p => p.segs.every(s => ["from", "to", "c1", "c2"].every(k => !s[k] || (isFinite(s[k].x) && isFinite(s[k].y))))), "1: 좌표 전부 유한");
  const pf = d.pieces.find(p => p.id === "front"), pb = d.pieces.find(p => p.id === "back");
  ok(pf.dartLegs === 2 && pb.dartLegs === 2, "1: 앞·뒤 = 열린 다트 입구를 construction 다트 다리 2개로 닫음(디자인 파트 분리와 같은 buildPieceRing)");
  // 실물 치수 = 독립 점열 bbox(다트 다리는 외곽 안쪽이라 bbox 불변)
  const R = P.working.designResult, srcOf = { front: [R.bodice.front.outline], back: [R.bodice.back.outline], "sleeve-sleeve": [R.sleeve.geometry.outline], cuff: [R.sleeve.cuff.piece.outline], "collar-stand": [R.collar.stand.geometry.outline], "collar-body": [R.collar.body.geometry.outline] };
  ok(d.pieces.every(p => { const b = bboxInd(srcOf[p.id]); return near(p.widthCm, b.w, 0.01) && near(p.heightCm, b.h, 0.01); }),
    "1: 조각 W×H = 완료본 원래 primitive 독립 실측(±0.01cm · 축척 변경 없음) — " + d.pieces.map(p => p.id + " " + p.widthCm.toFixed(2) + "×" + p.heightCm.toFixed(2)).join(" "));
  ok(near(d.pieces.find(p => p.id === "cuff").widthCm, R.sleeve.cuff.piece.size.lengthCm, 1e-6), "1: 커프스 길이 = designCuff 기록(" + R.sleeve.cuff.piece.size.lengthCm + ")");
  ok(d.pieces.every(p => p.source && /^designResult\./.test(p.source)), "1: 조각 출처 = 완료 패키지 경로");
  // 누락 = 이유만(대체 직사각형 없음)
  ok(d.missing.map(m => m.id).join() === "placket,sleeve-vent" && d.missing.every(m => m.reason.length > 10), "1: 누락 2건(여밈 합성 외곽 · 트임 덧단) = 이유만");
  ok(!d.pieces.some(p => /placket|vent/.test(p.id)), "1: 누락 항목을 조각으로 만들지 않음(대체 직사각형 없음)");
  ok(pf.marks.length === 1 && pf.marks[0].kind === "placket" && d.pieces.filter(p => p.marks && p.marks.length).length === 1, "1: 여밈 영역 = 앞판 위 점선 표시 1개만");
  ok(d.pieces.find(p => p.id === "collar-stand").note === "뒤중심 접힘 반쪽(펼치기 전)", "1: 카라 반쪽 = 완료본 symmetry 사실만 적음");
  // 원본 별칭 없음 · 동결
  const srcObjs = allObjs(R); ok(![...allObjs(d.pieces)].some(o => srcObjs.has(o)), "2: 조각 객체가 완료본 객체를 하나도 가리키지 않음(새 복사본)");
  ok(deepFrozen(d), "2: 파생 결과 깊은 동결(소비자가 바꿀 수 없음)");

  // §4 저장(이 상태)
  const built = S.PF.buildFileText({ savedAt: "2026-11-13T00:00:00.000Z" }); TEXT = built.text;
  const file = JSON.parse(TEXT);
  ok(file.payload.ui.stage === "design" && !/cutPrep|cutView/.test(TEXT), "4: 파일 = stage design · 재단 화면 상태 저장 없음(형식 무변경)");

  // §3 완료 뒤 변경 → 조각 없음(변경됨) · 기존 완료본 보존 → 재완료 → 갱신
  const oldHash = R.hash;
  P.working.frontPlacket = null;
  const dX = S.CUT.derive(P);
  ok(dX.state === "changed" && !dX.pieces && dX.returnTab === "body" && /바뀌었/.test(dX.reason), "3: 여밈 제거 → «변경됨» · 조각 없음 · 돌아갈 곳 몸판 (" + dX.returnTab + ")");
  ok(P.working.designResult.hash === oldHash, "3: 기존 designResult 는 지우지 않는다(권위 그대로)");
  ok(S.BC.complete(P).ok && S.W.sleeveAApply.apply(P, { sleeveLengthCm: 52, cuff: S.DCF.defaults() }).ok && completeChain(S, P), "3: 몸판·소매·카라·Design 재완료");
  const dY = S.CUT.derive(P);
  ok(dY.state === "ready" && dY.resultHash !== oldHash && dY.resultHash === P.working.designResult.hash, "3: 재완료 → 새 hash 로 갱신");
  ok(dY.missing.map(m => m.id).join() === "sleeve-vent" && !dY.pieces[0].marks.length, "3: 여밈이 없으니 여밈 누락·점선도 없음");
}

// ══ §4 저장 → 빈 세션 열기 ══
{
  const S2 = makeSession(), v = S2.PF.verifyText(TEXT);
  ok(v.ok, "4: 열기 검증 (" + (v.reason || "") + ")");
  ok(S2.CUT.derive().state === "no-project", "4: 빈 세션 = 프로젝트 없음");
  S2.PF.commitCandidate(v.candidate);
  const g = graph(S2), d = S2.CUT.derive();
  ok(J(d) === D_DONE, "4: 복원 세션의 재단 조각 = 저장 전과 바이트 동일");
  ok(graph(S2) === g, "4: 복원 세션에서도 파생이 아무것도 바꾸지 않음");
}

// ══ §5 소매 파생 경로 ══
function sleevePath(sym) {
  const s = makeSession(), p = start(s); s.BC.complete(p);
  const r = s.W["sleeve" + sym + "Apply"].apply(p, defs(s, sym));
  const okc = r && r.ok && completeChain(s, p);
  return { s, p, ok: okc, d: okc ? s.CUT.derive(p) : null };
}
{
  const r = sleevePath("R");
  ok(r.ok && r.d.state === "ready", "5 Ⓡ: 완료 → ready");
  const f = r.d.pieces.find(x => x.id === "front"), b = r.d.pieces.find(x => x.id === "back");
  ok(f.source === "designResult.sleeve.derivedBodice.front" && b.source === "designResult.sleeve.derivedBodice.back", "5 Ⓡ: 몸판 조각 = 소매 파생 몸판(최종 몸판)");
  ok(r.d.pieces.filter(x => x.group === "bodice").length === 2 && !r.d.pieces.some(x => /designResult\.bodice\./.test(x.source)), "5 Ⓡ: 원래 몸판(bodiceResult) 앞·뒤 중복 노출 없음");
  ok(r.d.info.some(t => /중복/.test(t)) && f.check.ok && b.check.ok, "5 Ⓡ: 제외 사실을 참고로 적음 · 파생 앞·뒤 폐곡선");
}
{
  const r = sleevePath("V"), g = r.ok && r.p.working.designResult.sleeve.geometry;
  const sl = r.d.pieces.filter(x => x.group === "sleeve");
  ok(r.ok && sl.map(x => x.id).join() === "sleeve-back,sleeve-front", "5 Ⓥ: 래글런 소매 2장(뒤·앞)");
  const segCount = g.outline.reduce((t, s) => t + (s.kind === "path" ? s.commands.filter(c => c.type !== "M").length : 1), 0);
  ok(sl.every(x => x.check.ok) && sl.reduce((t, x) => t + x.segs.length, 0) === segCount, "5 Ⓥ: 두 장의 선 합 = 원래 소매 외곽 선 수(" + segCount + ") — 누락·중복 0");
  ok(!r.d.missing.some(m => m.id === "sleeve-stray"), "5 Ⓥ: 어느 장에도 속하지 않은 선 없음");
}
{
  const r = sleevePath("X");
  ok(r.ok && r.d.pieces.some(x => x.id === "sleeve-gusset" && x.check.ok), "5 Ⓧ: 덧천 한 장");
}
{
  const r = sleevePath("Y");
  ok(r.ok && !r.d.pieces.some(x => x.group === "sleeve") && r.d.info.some(t => /소매 조각 없음/.test(t)) && !r.d.missing.some(m => /^sleeve/.test(m.id)), "5 Ⓨ: 일체형 = 소매 조각 없음(누락 아님 · 사실만)");
  const b = r.d.pieces.find(x => x.id === "back"), ob = r.p.working.designResult.sleeve.derivedBodice.back;
  ok(b && b.check.ok && /진동 아랫점 3\.6µm 정합/.test(b.note) && r.d.failedPieces === 0,
    "5 Ⓨ: 파생 뒤판 = 같은 설계점(진동 아랫점 · 원래 몸판의 3자리 반올림 표기) 한 점만 정합해 폐곡선 (" + (b && b.note) + ")");
  const arm = ob.outline.filter(s => s.edge === "armhole"), lastPt = s => { const c = s.commands, lp = c[c.length - 1].points; return lp[lp.length - 1]; };
  ok(arm.some(s => near(lastPt(s).x, 23.053, 1e-9) && near(lastPt(s).y, 20.617, 1e-9)), "5 Ⓨ: 완료본 파생 뒤판 자체는 그대로(어댑터는 읽기 전용 · 완료본 무변경)");
}

for (const sym of ["T", "U"]) {
  const r = sleevePath(sym), b = r.ok && r.d.pieces.find(x => x.id === "back");
  ok(r.ok && b && b.check.ok && b.dartLegs === 2 && /다트 다리 = 원래 몸판 그대로/.test(b.note) && near(b.heightCm, 60.35, 0.01),
    "5 " + sym + ": 파생 뒤판(원래 몸판 복제) = 원래 몸판의 열린 어깨 다트 다리 2개로 닫힘 · 닫힌 허리 다트 흔적 없음");
  ok(!r.p.working.designResult.sleeve.derivedBodice.back.construction, "5 " + sym + ": 완료본 파생 뒤판 무변경(construction 추가 안 함 — hash 보존)");
}
{   // 정합 규칙은 «같은 설계점 표기»일 때만 — 같은 크기의 임의 틈은 그대로 보류(근접 병합 아님)
  const r = sleevePath("Y"), R0 = JSON.parse(J(r.p.working.designResult));
  const arm = R0.sleeve.derivedBodice.back.outline.filter(s => s.edge === "armhole").pop(), c = arm.commands, lp = c[c.length - 1].points;
  lp[lp.length - 1] = { x: lp[lp.length - 1].x + 3e-4, y: lp[lp.length - 1].y };
  const b = r.s.CUT.buildPieces(R0).pieces.find(x => x.id === "back");
  ok(b && !b.check.ok && /틈/.test(b.check.reason), "5 Ⓨ: 설계점 표기와 다른 3µm 틈은 메우지 않음 (" + (b && b.check.reason) + ")");
}

// ══ §6 분리 몸판·중복 방지(합성 완료본 — 형상은 실제 완료본 조각을 빌림) ══
{
  const R = JSON.parse(J(S.P().working.designResult)), F = R.bodice.front, B = R.bodice.back;
  const yoke = Object.assign({}, R, { bodice: Object.assign({}, R.bodice, { frontYoke: F, frontBody: B, backYoke: F, backBody: B }) });
  ok(S.CUT.candidates(yoke).pieces.filter(c => c.group === "bodice").map(c => c.id).join() === "frontYoke,frontBody,backYoke,backBody", "6: 요크 = 요크·몸판 4장 · 나뉘기 전 앞·뒤 제외");
  const pr = Object.assign({}, R, { bodice: Object.assign({}, R.bodice, { frontCenter: F, frontSide: B, backCenter: F, backSide: B }) });
  ok(S.CUT.candidates(pr).pieces.filter(c => c.group === "bodice").map(c => c.id).join() === "frontCenter,frontSide,backCenter,backSide", "6: 프린세스 = 4장 · 앞·뒤 전체 제외");
  const mixed = Object.assign({}, R, { bodice: Object.assign({}, yoke.bodice, { frontPeplum: F }) });
  const cm = S.CUT.candidates(mixed);
  ok(!cm.pieces.some(c => c.group === "bodice") && cm.missing.some(m => m.id === "bodice-mixed"), "6: 분리 종류 겹침 = 몸판 미지원 이유(추측 조합 없음)");
  const sameRef = Object.assign({}, R, { bodice: Object.assign({}, R.bodice, { frontPeplum: { outline: F.outline } }) });
  const bs = S.CUT.buildPieces(sameRef);
  ok(bs.pieces.filter(p => p.group === "bodice").length === 2 && bs.excluded.some(x => x.id === "frontPeplum" && /중복/.test(x.reason)), "6: 같은 외곽 참조 = 한 번만(중복 제외 기록)");
  const sameShape = Object.assign({}, R, { bodice: Object.assign({}, R.bodice, { backPeplum: JSON.parse(J(F)) }) });
  const bh = S.CUT.buildPieces(sameShape);
  ok(bh.excluded.some(x => x.id === "backPeplum" && /같은 형상/.test(x.reason)), "6: 같은 형상(복제본) = 한 번만");
  const odd = Object.assign({}, R, { collar: { type: "no-such-collar" } });
  const co = S.CUT.candidates(odd);
  ok(!co.pieces.some(c => c.group === "collar") && co.missing.some(m => m.id === "collar" && /no-such-collar/.test(m.reason)), "6: 모르는 카라 종류 = 조각 없이 이유");
  const P0 = S.P(), before = S.CUT.derive(P0);
  P0.working.parts = [{ id: "part-1", sourcePiece: "front", sourceCutId: "x", outline: F.outline }];
  const after = S.CUT.derive(P0);
  ok(after.previewPartsIgnored === true && ids(after) === ids(before), "6: 파트 분리 미리보기(working.parts) = 재단 조각 아님(목록 그대로 · 참고에 사실 기록)");
  P0.working.parts = [];
}

console.log("cutPrepIntegrationCheck: " + PASS + " passed, " + FAIL + " failed");
if (FAIL) { fails.forEach(f => console.log("  FAIL " + f)); process.exit(1); }
