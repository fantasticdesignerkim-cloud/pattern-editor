// ══════════════════════════════════════════════
// cutVentIntegrationCheck.js — 재단 준비: 소매 트임 ④ 덧단(P.91) 재단 조각 (실제 엔진 · 2026-11-14)
//   근거: 완성 덧단 윤곽 = designCuff vent.placket(권위). 김님 확정 3가지 —
//     가위집 = 길이 − 끝 − 박음 칸 1.5 · 앞쪽 덧단 = 한 장 접기 양쪽 뾰족(펼친 폭 = 완성 폭×2) · 뒤쪽 바이어스 = 접어 감싸기(완성 1 → 펼친 2 × 가위집 길이)
//   §1 기본값: 8조각 · 누락 0 · 치수/면적/둘레 독립 계산 · 접힘 검산 · 소매 위 가위집·완성 윤곽 표시 · 원본 불변
//   §2 입력이 바뀌면 따라 바뀜(상수 아님) · 끝 0   §3 가위집 정의 불가 = 사유 + 조각 없음   §4 순수 함수 거부
//   §5 커프스 없음   §6 수정 → 변경됨 → 재완료 · 저장 → 열기 바이트 동일
//   node test/harness/cutVentIntegrationCheck.js
// ══════════════════════════════════════════════
"use strict";
const vm = require("vm"), fs = require("fs"), path = require("path");
let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
process.on("uncaughtException", e => { console.log("cutVentIntegrationCheck: 예외 — " + (e && e.stack || e).toString().split("\n").slice(0, 3).join(" | ")); fails.slice(0, 20).forEach(f => console.log("  ✗ " + f)); process.exit(1); });
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

const cuffOf = (S, vent) => { const c = JSON.parse(J(S.DCF.defaults())); if (vent) Object.assign(c.vent, vent); return c; };
function build(vent, noCuff) {
  const S = makeSession(), P = start(S);
  const a = S.BC.complete(P).ok, ra = S.W.sleeveAApply.apply(P, noCuff ? { sleeveLengthCm: 52 } : { sleeveLengthCm: 52, cuff: cuffOf(S, vent) });
  const okAll = a && ra && ra.ok && completeChain(S, P), g0 = graph(S), h0 = hashes(P), d = S.CUT.derive(P);
  return { S, P, ok: okAll, d, unchanged: graph(S) === g0 && hashes(P) === h0, pl: d.pieces && d.pieces.find(p => p.id === "vent-placket"), bi: d.pieces && d.pieces.find(p => p.id === "vent-bias"), sl: d.pieces && d.pieces.find(p => p.id === "sleeve-sleeve") };
}
const vertsOf = p => p.segs.map(s => s.from);
const shoelace = v => Math.abs(v.reduce((a, p, i) => { const q = v[(i + 1) % v.length]; return a + p.x * q.y - q.x * p.y; }, 0)) / 2;
const perim = v => v.reduce((a, p, i) => { const q = v[(i + 1) % v.length]; return a + Math.hypot(q.x - p.x, q.y - p.y); }, 0);
const closedRing = p => p.segs.every((s, i) => { const n = p.segs[(i + 1) % p.segs.length]; return s.kind === "line" && Math.hypot(n.from.x - s.to.x, n.from.y - s.to.y) < 1e-9; });
// 접힘 검산(독립): 접는선 x 기준으로 한쪽 꼭짓점을 뒤집으면 다른 쪽 꼭짓점 집합과 일치
function foldsOnto(p, fx) {
  const v = vertsOf(p), a = v.filter(q => q.x < fx - 1e-9), b = v.filter(q => q.x > fx + 1e-9);
  return a.length > 0 && a.length === b.length && a.every(q => b.some(z => Math.hypot(2 * fx - q.x - z.x, q.y - z.y) < 1e-9));
}

// ══ §1 기본값(길이 10 · 폭 2 · 끝 1) ══
{
  const r = build(null), d = r.d, R = r.P.working.designResult, V = R.sleeve.cuff.vent, pl = r.pl, bi = r.bi, sl = r.sl;
  ok(r.ok && d.state === "ready" && ids(d) === "front,back,sleeve-sleeve,cuff,vent-placket,vent-bias,collar-stand,collar-body", "1: 8조각(트임 덧단·바이어스가 커프스 뒤에) (" + ids(d) + ")");
  ok(d.missing.length === 0 && d.failedPieces === 0 && new Set(d.pieces.map(p => p.hash)).size === 8 && !d.excluded.length, "1: 누락 0 · 검사 실패 0 · 중복 0");
  ok(pl.check.ok && pl.segs.length === 7 && closedRing(pl) && near(pl.widthCm, 4, 1e-9) && near(pl.heightCm, 10, 1e-9), "1: 앞쪽 덧단 = 단일 폐곡선 7변 · 4 × 10 (" + pl.widthCm + "×" + pl.heightCm + ")");
  ok(near(shoelace(vertsOf(pl)), 38, 1e-9) && near(perim(vertsOf(pl)), 22 + 4 * Math.SQRT2, 1e-9), "1: 덧단 면적 38 = 2×(2×9 + 삼각 1) · 둘레 22+4√2 (독립 계산)");
  const fold = pl.marks.find(m => m.kind === "fold"), fx = fold.segs[0].from.x;
  ok(pl.marks.length === 1 && fold.label === "접는선" && near(fx, pl.vent.foldX, 1e-12) && near(Math.abs(fold.segs[0].to.y - fold.segs[0].from.y), 9, 1e-9), "1: 덧단 접는선 = 가운데 세로 9(뾰족 어깨 → 소맷부리)");
  ok(foldsOnto(pl, fx), "1: 종이 접기 — 접는선에서 접으면 안쪽 꼭짓점이 겉쪽과 일치(양쪽 뾰족)");
  // 겉쪽 반 = 완료본의 완성 덧단 윤곽 그대로(권위)
  const fin = [V.placket[0].from].concat(V.placket.map(s => s.to)), face = vertsOf(pl).slice(0, 4).concat([{ x: fx, y: pl.segs[0].from.y }]);
  ok(fin.length === 5 && fin.every((q, i) => Math.hypot(q.x - face[i].x, q.y - face[i].y) < 1e-9), "1: 덧단 겉쪽 반 = designCuff 완성 덧단 윤곽과 점 단위 일치");
  ok(pl.vent.kind === "placket" && pl.vent.finishedWidthCm === 2 && pl.vent.openWidthCm === 4 && pl.vent.lengthCm === 10 && pl.vent.tipCm === 1 && near(pl.vent.slitCm, 7.5, 1e-12) && pl.vent.boxCm === 1.5, "1: 덧단 기록 = 완성 2 · 펼침 4 · 길이 10 · 끝 1 · 가위집 7.5 = 10−1−1.5");
  ok(bi.check.ok && bi.segs.length === 4 && closedRing(bi) && near(bi.widthCm, 2, 1e-9) && near(bi.heightCm, 7.5, 1e-9) && near(shoelace(vertsOf(bi)), 15, 1e-9), "1: 뒤쪽 바이어스 = 직사각형 2 × 7.5(완성 1 접어 감싸기 × 가위집 길이)");
  const bf = bi.marks.find(m => m.kind === "fold");
  ok(bi.marks.length === 1 && near(bf.segs[0].from.x, 1, 1e-12) && foldsOnto(bi, 1) && bi.vent.kind === "bias" && bi.vent.finishedWidthCm === 1 && near(bi.vent.lengthCm, pl.vent.slitCm, 1e-12), "1: 바이어스 접는선 = 가운데 · 접으면 일치 · 길이 = 가위집 길이");
  // 소매 위 표시: 가위집(실제로 자르는 선) + 완성 덧단 윤곽. 소매 외곽은 그대로.
  const slit = sl.marks.find(m => m.kind === "vent-slit"), finM = sl.marks.find(m => m.kind === "vent-placket");
  const hem = R.sleeve.geometry.outline[3], backX = hem.from.x;
  ok(sl.marks.map(m => m.kind).join() === "vent-placket,vent-slit" && slit.segs.length === 1 && near(slit.segs[0].from.x, backX / 2, 1e-9) && near(slit.segs[0].from.y, hem.from.y, 1e-9) && near(slit.segs[0].to.x, backX / 2, 1e-9) && near(slit.segs[0].from.y - slit.segs[0].to.y, 7.5, 1e-9),
    "1: 가위집 = 소맷부리 위 «소매 중심 → 뒤 옆선 1/2» 에서 위로 7.5(커프스 달림선에서 시작)");
  ok(finM.segs.length === 5 && near(slit.segs[0].to.y, V.placket[0].to.y + 1.5, 1e-9) && /7\.5/.test(slit.label), "1: 완성 덧단 윤곽 표시(닫힌 5변) · 가위집 끝 = 뾰족 어깨 아래 1.5");
  ok(sl.segs.length === 8 && near(sl.widthCm, R.sleeve.cuff.lengths.sleeveHemCm, 1e-4) && near(sl.heightCm, 49, 1e-6) && !sl.vent, "1: 소매 몸통 외곽 치수 그대로(표시만 추가 · 바이트 비교는 cutPlacketIntegrationCheck §1 지문)");
  ok(r.unchanged && deepFrozen(d) && J(r.S.CUT.derive(r.P).pieces) === J(d.pieces), "1: 파생 전후 완료본 hash·그래프 불변 · 결과 동결 · 결정론");
  ok(/^designResult\.sleeve\.cuff\.vent/.test(pl.source) && /^designResult\.sleeve\.cuff\.vent/.test(bi.source) && near(R.sleeve.cuff.lengths.attachLengthCm, 20, 1e-9) && near(d.pieces.find(p => p.id === "cuff").widthCm, 20, 1e-9), "1: 출처 = 완료본 트임 기록 · 커프스 조각·달림 길이 무변경(20)");
}

// ══ §2 입력을 바꾸면 따라 바뀐다(상수 아님) · 끝 0 ══
{
  const r = build({ lengthCm: 12, placketWidthCm: 2.5, tipCm: 1.5 });
  ok(r.ok && r.d.missing.length === 0 && r.pl.check.ok && near(r.pl.widthCm, 5, 1e-9) && near(r.pl.heightCm, 12, 1e-9) && near(r.pl.vent.slitCm, 9, 1e-12) && near(shoelace(vertsOf(r.pl)), 2 * (2.5 * 10.5 + 0.5 * 2.5 * 1.5), 1e-9) && foldsOnto(r.pl, r.pl.vent.foldX),
    "2: 길이 12 · 폭 2.5 · 끝 1.5 → 덧단 5 × 12 · 가위집 9 · 접힘 일치");
  ok(r.bi.check.ok && near(r.bi.widthCm, 2, 1e-9) && near(r.bi.heightCm, 9, 1e-9) && r.unchanged, "2: 바이어스 2 × 9(가위집 길이를 따라감) · 완료본 불변");
  const z = build({ tipCm: 0 });
  ok(z.ok && z.pl && z.pl.check.ok && near(z.pl.widthCm, 4, 1e-9) && near(z.pl.heightCm, 10, 1e-9) && near(shoelace(vertsOf(z.pl)), 40, 1e-9) && near(z.pl.vent.slitCm, 8.5, 1e-12) && near(z.bi.heightCm, 8.5, 1e-9), "2: 끝 0 → 덧단 직사각형 4 × 10 · 가위집 8.5" + (z.pl ? " (" + (z.pl.check.ok ? "ok" : z.pl.check.reason) + ")" : " (조각 없음: " + J(z.d.missing) + ")"));
}

// ══ §3 가위집을 정할 수 없으면 만들지 않는다 ══
{
  const r = build({ lengthCm: 2.4, tipCm: 1 }), m = r.d.missing.find(x => x.id === "sleeve-vent");
  ok(r.ok && !r.pl && !r.bi && m && /가위집 길이를 정할 수 없습니다/.test(m.reason) && ids(r.d) === "front,back,sleeve-sleeve,cuff,collar-stand,collar-body", "3: 길이 2.4 · 끝 1 → 조각 없음 · 사유 안내 (" + (m && m.reason) + ")");
  ok(r.sl.marks.length === 0 && r.unchanged, "3: 소매 위 가위집 표시도 없음(추측 없음) · 완료본 불변");
}

// ══ §4 순수 함수 거부 ══
{
  const S0 = makeSession(), VP = S0.CUT.ventPieces, base = build(null), V = JSON.parse(J(base.P.working.designResult.sleeve.cuff.vent));
  const g = VP(V); ok(g.ok && near(g.slitCm, 7.5, 1e-12) && J(VP(V)) === J(g), "4: 완료본 트임 기록 → ok · 결정론");
  ok(VP(null).ok === false && VP({}).ok === false && VP({ placket: [] }).ok === false, "4: 빈 입력 거부");
  const a = JSON.parse(J(V)); a.placket[1].to.x += 0.3; a.placket[2].from.x += 0.3; ok(VP(a).ok === false && /모양이 아닙니다/.test(VP(a).reason), "4: 뾰족 끝이 가운데가 아닌 윤곽 거부");
  const b = JSON.parse(J(V)); b.placketWidthCm = 3; ok(VP(b).ok === false && /입력 치수/.test(VP(b).reason), "4: 윤곽 ≠ 입력 치수 거부");
  const c = JSON.parse(J(V)); c.placket[2].from.y -= 0.5; ok(VP(c).ok === false && /이어져/.test(VP(c).reason), "4: 끊긴 윤곽 거부");
  const e = JSON.parse(J(V)); e.placket[0].to.x = NaN; ok(VP(e).ok === false, "4: 유한하지 않은 좌표 거부");
}

// ══ §5 커프스 없음 ══
{
  const r = build(null, true);
  ok(r.ok && !r.pl && !r.bi && !r.d.pieces.some(p => p.id === "cuff") && !r.d.missing.some(m => m.id === "sleeve-vent") && r.sl.marks.length === 0, "5: 커프스 없는 소매 = 트임 조각·표시·누락 안내 없음 (" + ids(r.d) + ")");
}

// ══ §6 수정 → 변경됨 → 재완료 · 저장 → 열기 ══
{
  const r = build(null), S = r.S, P = r.P, old = P.working.designResult.hash;
  ok(S.W.sleeveAApply.apply(P, { sleeveLengthCm: 52, cuff: cuffOf(S, { lengthCm: 11 }) }).ok, "6: 완료 뒤 트임 길이 11 로 수정");
  const dX = S.CUT.derive(P);
  ok(dX.state === "changed" && !dX.pieces && P.working.designResult.hash === old, "6: 수정 직후 = «변경됨» · 옛 조각을 보여 주지 않음 · 기존 완료본 보존 (" + dX.state + ")");
  ok(completeChain(S, P), "6: 재완료");
  const d = S.CUT.derive(P), pl = d.pieces.find(p => p.id === "vent-placket"), bi = d.pieces.find(p => p.id === "vent-bias");
  ok(d.state === "ready" && d.resultHash !== old && near(pl.heightCm, 11, 1e-9) && near(bi.heightCm, 8.5, 1e-9), "6: 재단 = 새 값(덧단 11 · 바이어스 8.5)");
  const text = S.PF.buildFileText({ savedAt: "2026-11-14T00:00:00.000Z" }).text;
  ok(!/vent-bias|vent-slit|slitCm|boxCm/.test(text), "6: 파일에 재단 파생 값 없음(저장 형식 무변경)");
  const S2 = makeSession(), v = S2.PF.verifyText(text); ok(v.ok, "6: 빈 세션에서 파일 검증"); S2.PF.commitCandidate(v.candidate);
  const d2 = S2.CUT.derive(S2.P());
  ok(d2.state === "ready" && J(d2.pieces) === J(d.pieces) && J(d2.missing) === J(d.missing) && d2.resultHash === d.resultHash, "6: 열기 뒤 재단 조각 = 저장 전과 바이트 동일");
}

// §7 트임 덧단·바이어스도 소매처럼 좌우 한 쌍(2026-11-21): 수량 1 = 왼 1 + 오른 1 거울 쌍 · 저장 키는 원본 id 하나
{
  const r = build(null), S = r.S, P = r.P, d = S.CUT.derive(P, true), m = S.CUT.seam(d, P), D = S.CUT.displayOf(d, m), Q = S.CUT.qtyOf(d, D, P);
  ["vent-placket", "vent-bias"].forEach(id => {
    const pr = m.pairing.all[id], a = D[id], b = D[id + "~m"];
    ok(pr && pr.active && !!b, "7: " + id + " 좌우 쌍 활성 · 거울 조각 있음");
    if (!(pr && pr.active && a && b)) return;
    ok(/^오른/.test(a.label) && /^왼/.test(b.label) && /트임/.test(a.label) && /트임/.test(b.label), "7: " + id + " 이름 오른/왼 + 트임 (" + a.label + " | " + b.label + ")");
    const mirrored = a.outline.length === b.outline.length && a.outline.every((g, i) => Math.abs(-g.from.x - b.outline[i].from.x) < 1e-9 && Math.abs(g.from.y - b.outline[i].from.y) < 1e-9);
    ok(mirrored, "7: " + id + " 거울 조각 = 원본 x 반사");
    ok(Q.pieces[id] && Q.pieces[id].qty === 1, "7: " + id + " 수량 1(쌍 한 벌)");
  });
  ok(S.CUT.setQty("vent-placket", 2, P).ok && !S.CUT.seam(S.CUT.derive(P, true), P).pairing.all["vent-placket"].active, "7: 수량 2(직접 지정) = 쌍 아님 · 기존 한 조각");
}

console.log("cutVentIntegrationCheck: " + PASS + " passed, " + FAIL + " failed");
fails.forEach(f => console.log("  FAIL " + f));
process.exit(FAIL ? 1 : 0);
