// ══════════════════════════════════════════════
// cutPlacketIntegrationCheck.js — 재단 준비: 앞 여밈·컷온 안단을 앞판과 한 장으로 합친 재단 외곽(2026-11-14 · **실제 엔진** · stub 없음).
//   근거 = designPlacket 확정 규칙(앞중심 ─ +여밈분 → 완성 앞단·접는선 ─ +안단 → 안단 끝 · 윗변/아랫변 수평 연장). cutPrep 은 완료본의
//   placket.outline 을 그대로 써서 앞판 ring 의 앞중심 변만 바꾼다(읽기 전용 파생 · 완료본·hash 무변경).
//   §1 여밈 없음 = 종전 조각 바이트 동일(HEAD 33669e6 기준 지문) · §2 직선 밑단 1.2/1.2 = 한 장 · 폭/둘레/넓이 독립 검산 · 접힘 검산 ·
//   §3 곡선 밑단 보존 · §4 0/양수 조합·안단 > 여밈분(접은 상태에서 목선·밑단에 맞춰 자른 모양 = 접는선 기준 반사 복사 · line/cubic 정확 분할) · §5 여밈 수정 → 변경됨 → 재완료 → 새 값 ·
//   §6 저장 → 빈 세션 열기 동일 · §7 미지원 경로(소매 파생 몸판 = 엔진이 여밈 몸판을 거부 · 나뉜 앞판) = 이유만 · §8 순수 함수 거부 사유
//   node test/harness/cutPlacketIntegrationCheck.js
// ══════════════════════════════════════════════
"use strict";
const vm = require("vm"), fs = require("fs"), path = require("path");
let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
process.on("uncaughtException", e => { console.log("cutPlacketIntegrationCheck: 예외 — " + (e && e.stack || e).toString().split("\n").slice(0, 3).join(" | ")); fails.slice(0, 20).forEach(f => console.log("  ✗ " + f)); process.exit(1); });
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
  const S = { W, BW: W.blockWorkflow, DW: W.designWorkflow, DB: W.designBodice, BP: W.bodicePresets, BC: W.bodiceCheckpoint, SC: W.sleeveCheckpoint, SP: W.sleevePresets, DPL: W.designPlacket,
    DC: W.designCollar, CP: W.collarPresets, CC: W.collarCheckpoint, DR: W.designResult, DLT: W.designLineTool, DLy: W.designLayout, PF: W.projectFile, SM: W.seamMatch, CUT: W.cutPrep, SA: W.designSleeveA, DCF: W.designCuff };
  S.P = () => S.DW.current();
  W.projectSessionUI = { snapshot: () => ({ stage: "design", subtab: "collar" }), unfinished: () => [], afterRestore() {} };
  // 실제 포인터 경로로 선을 그린다(projectFileCheck 와 같은 방식 — designLineTool 의 실제 핸들러)
  const H = t => (SVG_H["designLineTool.js:" + t] || []), KD = () => (DOC_H["designLineTool.js:keydown"] || []);
  let CLX = 0;
  function evAt(pc, geo, extra) {
    const Ly = S.DLy.ensureLayout(S.P()), off = Ly[pc] || { dx: 0, dy: 0 }; CLX += 100;
    return Object.assign({ button: 0, pointerId: 1, clientX: CLX, clientY: 0, altKey: false, shiftKey: false, px: geo.x + off.dx, py: geo.y + off.dy,
      target: { closest: () => ({ getAttribute: () => pc }) }, stopPropagation() {}, preventDefault() {} }, extra || {});
  }
  const down = e => H("pointerdown").forEach(f => f(e)), up = e => H("pointerup").forEach(f => f(e)), move = e => H("pointermove").forEach(f => f(e));
  S.click = (pc, g, extra) => { const e = evAt(pc, g, extra); down(e); up(e); };
  S.drag = (pc, g, h) => { const e0 = evAt(pc, g); down(e0); const e1 = evAt(pc, { x: g.x + h.x, y: g.y + h.y }, { clientX: e0.clientX + 50 }); move(e1); up(e1); };
  S.draw = (pc, pts, handles) => {
    if (S.DLT.getMode() !== "off") S.DLT.setMode("off");
    S.DLT.toggle();
    pts.forEach((q, i) => { if (handles && handles[i]) S.drag(pc, q, handles[i]); else S.click(pc, q, { altKey: true }); });
    KD().forEach(f => f({ key: "Enter", target: {}, preventDefault() {} }));
  };
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

const crypto = require("crypto");
const SX = 23.053125, HEM_Y = 58, CF = 47.5;
// 독립 실측(cutPrep 함수 미사용): 선분화 ring 의 닫힘·둘레·넓이·bbox
function flat(segs) { const o = []; segs.forEach(s => { if (s.kind === "line") { o.push(s.from); return; } for (let k = 0; k < 400; k++) { const t = k / 400, u = 1 - t; o.push({ x: u * u * u * s.from.x + 3 * u * u * t * s.c1.x + 3 * u * t * t * s.c2.x + t * t * t * s.to.x, y: u * u * u * s.from.y + 3 * u * u * t * s.c1.y + 3 * u * t * t * s.c2.y + t * t * t * s.to.y }); } }); return o; }
function stat(segs) { const p = flat(segs); let per = 0, ar = 0, x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; p.forEach((a, i) => { const b = p[(i + 1) % p.length]; per += Math.hypot(b.x - a.x, b.y - a.y); ar += a.x * b.y - b.x * a.y; x0 = Math.min(x0, a.x); x1 = Math.max(x1, a.x); y0 = Math.min(y0, a.y); y1 = Math.max(y1, a.y); }); return { per, area: Math.abs(ar) / 2, w: x1 - x0, h: y1 - y0, x1 }; }
const dense = segs => { const o = []; segs.forEach(s => { for (let k = 0; k <= 300; k++) { const t = k / 300, u = 1 - t; o.push(s.kind === "line" ? { x: s.from.x + (s.to.x - s.from.x) * t, y: s.from.y + (s.to.y - s.from.y) * t } : { x: u * u * u * s.from.x + 3 * u * u * t * s.c1.x + 3 * u * t * t * s.c2.x + t * t * t * s.to.x, y: u * u * u * s.from.y + 3 * u * u * t * s.c1.y + 3 * u * t * t * s.c2.y + t * t * t * s.to.y }); } }); return o; };
const ringOK = segs => segs.every((s, i) => { const n = segs[(i + 1) % segs.length]; return Math.hypot(s.to.x - n.from.x, s.to.y - n.from.y) <= 1e-4; });
const segKey = s => J([s.kind, s.from, s.c1 || 0, s.c2 || 0, s.to]), revKey = s => J([s.kind, s.to, s.c2 || 0, s.c1 || 0, s.from]);
const isCF = s => s.kind === "line" && Math.abs(s.from.x - CF) < 1e-6 && Math.abs(s.to.x - CF) < 1e-6;
function build(curve, ov, fc) {
  const S = makeSession(), P = start(S);
  if (curve) {
    S.draw("back", [{ x: 0, y: HEM_Y }, { x: 12, y: 57.2 }, { x: SX, y: 50 }], [null, { x: 4, y: -0.6 }, null]); const rb = S.DLT.doReflectToBodice();
    S.draw("front", [{ x: CF, y: HEM_Y }, { x: 35, y: 57.2 }, { x: SX, y: 50 }], [null, { x: -4, y: -0.6 }, null]); const rf = S.DLT.doReflectToBodice();
    if (!(rb === true && rf === true)) throw new Error("곡선 밑단 반영 실패");
  }
  const pl = (ov || fc) ? setPlacket(S, ov, fc) : null;
  const okc = S.BC.complete(P).ok && S.W.sleeveAApply.apply(P, { sleeveLengthCm: 52, cuff: S.DCF.defaults() }).ok && completeChain(S, P);
  const h0 = hashes(P), g0 = graph(S), d = okc ? S.CUT.derive(P) : null;
  return { S, P, pl, ok: okc, d, front: d && d.pieces.find(p => p.id === "front"), unchanged: okc && h0 === hashes(P) && g0 === graph(S) };
}

// ══ §1 여밈 없음 = 종전과 바이트 동일 ══
const N0 = build(false, 0, 0), NC = build(true, 0, 0);
{
  ok(N0.ok && N0.d.state === "ready" && N0.front.label === "앞판" && !N0.front.placket && !N0.front.marks.length && !N0.d.missing.some(m => m.id === "placket"), "1: 여밈 없음 = 앞판 그대로(합성·표시·누락 없음)");
  const sha = crypto.createHash("sha256").update(J(N0.d.pieces)).digest("hex").slice(0, 16);
  ok(sha === "f25330fbe974e137", "1: 여밈 없는 6조각 = 합성 도입 전(HEAD 33669e6) 지문과 바이트 동일 (" + sha + ")");
  ok(N0.front.segs.filter(isCF).length === 2, "1: 여밈 없는 앞판 외곽에는 앞중심 변이 그대로 있다");
}

// ══ §2 직선 밑단 + 여밈 1.2 / 안단 1.2 ══
{
  const r = build(false, 1.2, 1.2), f = r.front, R = r.P.working.designResult, b = R.bodice, q = f.placket;
  ok(r.ok && r.d.state === "ready" && r.unchanged, "2: ready · 파생 뒤 프로젝트 그래프·완료본 hash 4개 바이트 동일");
  ok(ids(r.d) === "front,back,sleeve-sleeve,cuff,collar-stand,collar-body" && new Set(r.d.pieces.map(p => p.hash)).size === 6 && !r.d.pieces.some(p => /placket/.test(p.id)), "2: 조각 6장 · 중복 0 · 여밈 전용 조각(사각형) 없음 (" + ids(r.d) + ")");
  ok(!r.d.missing.some(m => m.id === "placket") && r.d.failedPieces === 0, "2: 여밈은 더 이상 누락 아님 · 검사 실패 0");
  ok(f.label === "앞판(여밈·안단 포함)" && f.check.ok && ringOK(f.segs) && f.segs.every(s => ["from", "to", "c1", "c2"].every(k => !s[k] || (isFinite(s[k].x) && isFinite(s[k].y)))), "2: 앞판 = 닫힌 단일 외곽(연속·유한·자기교차 없음)");
  const a = stat(N0.front.segs), z = stat(f.segs), H = q.botY - q.topY;
  ok(near(q.cfX, CF, 1e-9) && near(q.foldX, CF + 1.2, 1e-9) && near(q.cutX, CF + 2.4, 1e-9) && near(q.topY, 3.075, 1e-3) && near(q.botY, 58, 1e-9), "2: 앞중심 47.5 · 접는선 48.7 · 안단 끝 49.9 · 목-CF~밑단-CF");
  ok(near(z.w, a.w + 2.4, 1e-6) && near(z.h, a.h, 1e-6) && near(z.x1, CF + 2.4, 1e-6) && near(f.widthCm, 26.8469, 1e-3) && near(q.widthBeforeCm, 24.4469, 1e-3), "2: 폭 24.45 → 26.85(+여밈+안단) · 높이 그대로 (" + a.w.toFixed(3) + "→" + z.w.toFixed(3) + ")");
  ok(near(z.area, a.area + 2.4 * H, 1e-3) && near(z.per, a.per + 4.8, 1e-3), "2: 넓이 = 앞판 + 2.4×앞중심 길이 · 둘레 = 앞판 + 4.8(독립 선분화 실측 " + (z.area - a.area).toFixed(3) + " / " + (2.4 * H).toFixed(3) + ")");
  const keep = N0.front.segs.filter(s => !isCF(s)), have = new Set(f.segs.map(segKey).concat(f.segs.map(revKey)));
  ok(keep.length === N0.front.segs.length - 2 && keep.every(s => have.has(segKey(s))) && !f.segs.some(isCF) && f.segs.length === keep.length + 3, "2: 앞중심 변만 빠지고 나머지 외곽(목선·어깨·진동·옆선·밑단·다트 다리)은 좌표 그대로 · 새 변 3개");
  ok(J(b.placket.outline.slice(0, 3).map(s => [s.from, s.to])) === J(f.segs.slice(-3).map(s => [s.from, s.to])) || J(b.placket.outline.slice(0, 3).map(s => [s.to, s.from]).reverse()) === J(f.segs.slice(-3).map(s => [s.from, s.to])), "2: 새 변 3개 = 완료본 placket.outline 의 세 변 그대로(새로 만든 좌표 없음)");
  ok(f.marks.map(m => m.kind).join() === "zone-overlap,zone-facing,cf,fold" && f.marks[2].segs[0].from.x === q.cfX && f.marks[3].segs[0].from.x === q.foldX && f.marks[2].label && f.marks[3].label, "2: 표시 = 여밈분·안단 영역 + 앞중심선 + 접는선(이름 있음)");
  // 접힘 검산(독립): 접는선 x=48.7 기준으로 안단 끝 모서리 두 점을 뒤집으면 목-CF 점·밑단-CF 점
  const neckCF = { x: CF, y: 3.075 }, mir = p => ({ x: 2 * q.foldX - p.x, y: p.y });
  const top = f.segs.find(s => s.kind === "line" && Math.abs(s.from.y - s.to.y) < 1e-9 && Math.abs(s.from.y - q.topY) < 1e-9), tc = top.from.x > top.to.x ? top.from : top.to;
  ok(near(mir(tc).x, neckCF.x, 1e-9) && near(mir(tc).y, neckCF.y, 1e-3) && near(mir({ x: q.cutX, y: q.botY }).x, CF, 1e-9) && q.fold.applies && q.fold.ok && !q.fold.trimmed && q.fold.insideCm === 0, "2: 접힘 검산 — 접으면 안단 윗끝·아랫끝 = 목-CF·밑단-CF 모서리(어긋남 0)");
  ok(R.bodice.necklineLengths && J(R.bodice.necklineLengths) === J(build(false, 1.2, 1.2).P.working.designResult.bodice.necklineLengths) && J(r.S.SM.compute(r.P)) === J(r.S.SM.compute(r.P)), "2: 목둘레 길이·맞춤 길이 계산은 재단 파생과 무관(완료본 값 그대로)");
  ok(deepFrozen(r.d), "2: 파생 결과 깊은 동결");
}

// ══ §3 수정 곡선 밑단 + 1.2/1.2 ══
{
  const r = build(true, 1.2, 1.2), f = r.front, fo = r.P.working.designResult.bodice.front.outline;
  ok(r.ok && r.unchanged && f.check.ok && ringOK(f.segs) && f.placket.fold.ok, "3: 곡선 밑단 = 한 장 · 검사 통과 · 접힘 일치 · 완료본 무변경");
  const hemCub = fo.filter(s => s.edge === "hem" && s.kind === "cubic");
  ok(hemCub.length >= 1 && hemCub.every(h => f.segs.some(s => s.kind === "cubic" && (segKey(s) === segKey(h) || revKey(s) === segKey(h)))), "3: 곡선 밑단 선이 합친 앞판에 좌표 그대로(옛 직선 밑단으로 돌아가지 않음 · " + hemCub.length + "개)");
  const a = stat(NC.front.segs), z = stat(f.segs);
  ok(near(z.w, a.w + 2.4, 1e-6) && near(z.h, a.h, 1e-6) && near(z.area, a.area + 2.4 * (f.placket.botY - f.placket.topY), 1e-3) && Math.abs(a.h - stat(N0.front.segs).h) > 0.1, "3: 폭 +2.4 · 높이 = 곡선 밑단 앞판 그대로(직선과 다름 " + a.h.toFixed(2) + ")");
}

// ══ §4 0·양수 조합 / 안단 > 여밈분 ══
{
  const c = build(true, 1.5, 0), q = c.front.placket;
  ok(c.ok && c.front.check.ok && near(c.front.widthCm, q.widthBeforeCm + 1.5, 1e-4) && !q.fold.applies && c.front.marks.map(m => m.kind).join() === "zone-overlap,cf", "4: 여밈 1.5 / 안단 0 = 여밈분만 붙음 · 접는선 없음(접힘 검산 해당 없음)");
  const e = build(true, 2, 1);
  ok(e.ok && e.front.check.ok && near(e.front.widthCm, e.front.placket.widthBeforeCm + 3, 1e-4) && e.front.placket.fold.ok, "4: 여밈 2 / 안단 1(안단 < 여밈분) = 접으면 여밈 사각형 안 → 일치");
  // 안단 > 여밈분(김님 확정 2026-11-14): 접은 상태에서 목선/밑단에 맞춰 자르고 펼친 모양 = 접는선 기준 반사 복사
  const wide = (r, body, ov, fc, tag) => {
    const f = r.front, q = f.placket, d = fc - ov, mirX = CF + 2 * ov, bd = dense(body.segs);
    ok(r.ok && f.check.ok && ringOK(f.segs) && r.unchanged && near(f.widthCm, q.widthBeforeCm + ov + fc, 1e-4) && q.fold.trimmed && q.fold.ok && near(q.fold.insideCm, d, 1e-9), tag + ": 한 장 · 닫힘·자기교차 없음 · 폭 +" + (ov + fc) + " · 완료본 무변경");
    // 독립 접힘 검산: 합친 외곽 중 접는선 대칭점(mirX) 바깥 부분을 접는선에 대해 뒤집으면 여밈 없는 몸판 외곽 위에 놓인다
    const fp = dense(f.segs).filter(p => p.x > mirX + 1e-6), far = fp.filter(p => p.x < CF + ov + fc - 1e-6).map(p => ({ x: 2 * q.foldX - p.x, y: p.y }));
    let worst = 0; far.forEach(m => { let b = 1e9; for (let i = 0; i + 1 < bd.length; i++) { const A = bd[i], B = bd[i + 1], ux = B.x - A.x, uy = B.y - A.y, L2 = ux * ux + uy * uy; if (L2 > 1) continue; const t = L2 ? Math.max(0, Math.min(1, ((m.x - A.x) * ux + (m.y - A.y) * uy) / L2)) : 0, v = Math.hypot(A.x + ux * t - m.x, A.y + uy * t - m.y); if (v < b) b = v; } if (b > worst) worst = b; });
    ok(far.length > 20 && worst < 1e-3 && far.every(m => m.x <= CF + 1e-6 && m.x >= CF - d - 1e-6), tag + ": 접으면 안단 윗변·아랫변이 몸판 목선·밑단 구간과 일치(독립 점열 최대 어긋남 " + worst.toFixed(4) + "cm · " + far.length + "점)");
    const cutE = f.segs.filter(s => s.kind === "line" && Math.abs(s.from.x - q.cutX) < 1e-6 && Math.abs(s.to.x - q.cutX) < 1e-6);
    ok(cutE.length === 1 && near(Math.min(cutE[0].from.y, cutE[0].to.y), q.fold.neckEndY, 1e-3) && near(Math.max(cutE[0].from.y, cutE[0].to.y), q.fold.hemEndY, 1e-3) && q.fold.neckEndY < q.topY - 0.05, tag + ": 안단 끝선 = 세로 한 변(목 쪽 끝 " + q.fold.neckEndY + " · 밑단 쪽 끝 " + q.fold.hemEndY + ")");
    const keep = body.segs.filter(s => !isCF(s)), have = new Set(f.segs.map(segKey).concat(f.segs.map(revKey)));
    ok(keep.every(s => have.has(segKey(s))) && !f.segs.some(isCF), tag + ": 몸판 쪽 외곽은 좌표 그대로(앞중심 변만 빠짐)");
    return q;
  };
  const g = build(false, 1.5, 3), w = wide(g, N0.front, 1.5, 3, "4 직선 1.5/3");
  const nk = g.P.working.designResult.bodice.front.outline.filter(s => s.edge === "neckline");
  let best = null; nk.forEach(s => ptsInd([s]).forEach(p => { if (!best || Math.abs(p.x - (CF - 1.5)) < Math.abs(best.x - (CF - 1.5))) best = p; }));
  ok(best && Math.abs(best.x - (CF - 1.5)) < 0.2 && Math.abs(best.y - w.fold.neckEndY) < 0.08 && near(w.fold.hemEndY, 58, 1e-6), "4: 목 쪽 끝 높이 = 앞중심 안쪽 1.5cm 지점 목선 높이(독립 " + (best ? best.y.toFixed(3) : "-") + ") · 직선 밑단 쪽은 58 그대로");
  const gc = build(true, 1.5, 3), wc = wide(gc, NC.front, 1.5, 3, "4 곡선 1.5/3");
  ok(gc.front.segs.filter(s => s.kind === "cubic" && s.from.x > CF + 3 - 1e-6 && s.to.x > CF + 3 - 1e-6).length >= 2 && Math.abs(wc.fold.hemEndY - 58) > 0.05, "4: 곡선 밑단 = 안단 아랫변도 곡선(cubic 분할 반사 · 밑단 쪽 끝 " + wc.fold.hemEndY + ")");
  const z = build(true, 0, 2), u = wide(z, NC.front, 0, 2, "4 곡선 0/2");
  ok(near(u.foldX, CF, 1e-9) && z.front.marks.map(m => m.kind).join() === "zone-facing,cf" && !z.front.segs.some(s => s.kind === "line" && Math.abs(s.from.y - s.to.y) < 1e-9 && Math.abs(s.from.y - u.topY) < 1e-6 && s.from.x >= CF - 1e-6 && s.to.x >= CF - 1e-6), "4: 여밈 0 / 안단 2 = 앞중심이 곧 접는선 · 수평 윗변 없이 바로 반사 곡선");
  const z0 = build(false, 0, 2); wide(z0, N0.front, 0, 2, "4 직선 0/2");
  { // 저장 → 열기(넓은 안단)
    const text = gc.S.PF.buildFileText({ savedAt: "2026-11-14T00:00:00.000Z" }).text, S2 = makeSession(), v = S2.PF.verifyText(text); S2.PF.commitCandidate(v.candidate);
    const d2 = S2.CUT.derive(S2.P());
    ok(v.ok && J(d2.pieces) === J(gc.d.pieces) && !/facingZone|insideCm/.test(text), "4: 넓은 안단 — 저장 → 빈 세션 열기 뒤 조각 바이트 동일 · 파일에 재단 파생 값 없음");
  }
  ok([c, e, g, gc, z, z0].every(x => x.unchanged && ids(x.d) === "front,back,sleeve-sleeve,cuff,collar-stand,collar-body" && !x.d.missing.some(m => m.id === "placket")), "4: 여섯 조합 모두 6장 · 완료본 무변경");
  const S0 = makeSession(); start(S0);
  ok(setPlacket(S0, 0, 0).reason === "no-placket" && setPlacket(S0, -1, 1).reason === "invalid-overlap", "4: 0/0 = 여밈 없음 · 음수 거부(디자인 쪽 기존 허용 범위 그대로)");
}

// ══ §5 여밈 수정 → 변경됨 → 재완료 → 새 값 · §6 저장 → 열기 ══
{
  const r = build(true, 1.2, 1.2), S = r.S, P = r.P, old = P.working.designResult.hash;
  ok(setPlacket(S, 1.5, 2).ok, "5: 완료 뒤 여밈 1.5 / 안단 2 로 수정");
  const dX = S.CUT.derive(P);
  ok(dX.state === "changed" && !dX.pieces && dX.returnTab === "body" && P.working.designResult.hash === old, "5: 수정 직후 = «변경됨» · 옛 합성 조각을 보여 주지 않음 · 기존 완료본 보존");
  ok(S.BC.complete(P).ok && S.W.sleeveAApply.apply(P, { sleeveLengthCm: 52, cuff: S.DCF.defaults() }).ok && completeChain(S, P), "5: 재완료");
  const d = S.CUT.derive(P), f = d.pieces.find(p => p.id === "front");
  ok(d.state === "ready" && d.resultHash !== old && near(f.placket.cutX, CF + 3.5, 1e-9) && near(f.widthCm, f.placket.widthBeforeCm + 3.5, 1e-4) && f.placket.overlapCm === 1.5 && f.placket.facingWidthCm === 2, "5: 재단 = 새 값(안단 끝 51.0 · 폭 +3.5)");
  const text = S.PF.buildFileText({ savedAt: "2026-11-14T00:00:00.000Z" }).text;
  ok(!/cutPrep|zone-overlap|widthBeforeCm/.test(text), "6: 파일에 재단 파생 값 없음(저장 형식 무변경)");
  const S2 = makeSession(), v = S2.PF.verifyText(text); ok(v.ok, "6: 빈 세션에서 파일 검증"); S2.PF.commitCandidate(v.candidate);
  const d2 = S2.CUT.derive(S2.P());
  ok(d2.state === "ready" && J(d2.pieces) === J(d.pieces) && J(d2.missing) === J(d.missing) && d2.resultHash === d.resultHash, "6: 열기 뒤 재단 조각 = 저장 전과 바이트 동일");
}

// ══ §7 미지원 경로 = 이유만 ══
{
  const s = makeSession(), p = start(s); setPlacket(s, 1.2, 1.2); s.BC.complete(p);
  const rr = "RSTUVWXYZ".split("").map(k => { const x = s.W["sleeve" + k + "Apply"].apply(p, defs(s, k)); return x && x.ok ? "ok" : (x && x.reason); });
  ok(rr.every(x => x === "bodice-not-a"), "7: 소매 Ⓡ~Ⓩ 엔진은 여밈 붙은 몸판을 받지 않는다 → 파생 몸판 + 여밈은 실제로 생기지 않는 조합 (" + Array.from(new Set(rr)).join() + ")");
  // 합성 완료본으로만 만들 수 있는 조합: 파생 몸판/나뉜 앞판에 placket 이 들어 있어도 합치지 않고 이유만
  const base = build(false, 1.2, 1.2), R = JSON.parse(J(base.P.working.designResult));
  const Rp = JSON.parse(J(R)); Rp.bodice.frontPeplum = { outline: [{ kind: "line", from: { x: 30, y: 60 }, to: { x: 40, y: 60 } }, { kind: "line", from: { x: 40, y: 60 }, to: { x: 40, y: 70 } }, { kind: "line", from: { x: 40, y: 70 }, to: { x: 30, y: 60 } }] };
  const bp = base.S.CUT.buildPieces(Rp), fp = bp.pieces.find(x => x.id === "front");
  ok(!fp.placket && fp.label === "앞판(허리 위)" && fp.marks.length === 1 && fp.marks[0].kind === "placket" && bp.missing.some(m => m.id === "placket" && /나뉜 앞판/.test(m.reason)), "7: 페플럼으로 나뉜 앞판 = 합치지 않음 · 이유 + 점선만");
  const Ry = JSON.parse(J(R)); ["frontYoke", "frontBody", "backYoke", "backBody"].forEach(k => { Ry.bodice[k] = { outline: Rp.bodice.frontPeplum.outline.map(s => ({ kind: "line", from: { x: s.from.x + k.length, y: s.from.y }, to: { x: s.to.x + k.length, y: s.to.y } })) }; });
  const by = base.S.CUT.buildPieces(Ry);
  ok(!by.pieces.some(x => x.placket) && by.missing.some(m => m.id === "placket" && /나뉜 앞판/.test(m.reason)), "7: 요크로 나뉜 앞판 = 합치지 않음 · 이유");
}

// ══ §8 순수 함수 거부 사유(추측해 잇지 않는다) ══
{
  const base = build(false, 1.2, 1.2), CP = base.S.CUT.composePlacket, pl = JSON.parse(J(base.P.working.designResult.bodice.placket)), ring = JSON.parse(J(N0.front.segs));
  const okr = CP(ring, pl);
  ok(okr.ok && J(okr.segs) === J(base.front.segs) && J(ring) === J(N0.front.segs), "8: 순수 함수 = 조각과 같은 결과 · 입력 ring 불변");
  const sh = JSON.parse(J(pl)); sh.outline.forEach(s => { s.from.y += 0.5; s.to.y += 0.5; });
  ok(CP(ring, sh).ok === false && /앞판이 바뀜/.test(CP(ring, sh).reason), "8: 여밈 구간이 앞중심 변과 다르면 거부(완료본끼리 안 맞는 경우)");
  const mv = JSON.parse(J(pl)); mv.outline.forEach(s => { s.from.x += 3; s.to.x += 3; });
  ok(CP(ring, mv).ok === false && /앞중심 변이 없습니다/.test(CP(ring, mv).reason), "8: 앞중심 위치가 다르면 거부");
  const bad = JSON.parse(J(pl)); bad.parameters.facingWidthCm = 5;
  ok(CP(ring, bad).ok === false && /값과 맞지 않습니다/.test(CP(ring, bad).reason), "8: 영역과 값이 다르면 거부");
  const out = JSON.parse(J(ring)); const hi = out.findIndex(s => !isCF(s) && s.kind === "line" && Math.abs(s.from.y - s.to.y) < 1e-9 && Math.abs(s.from.y - 58) < 1e-9);
  const hs = out[hi], A = hs.from, B = hs.to, M = { x: CF + 1, y: 59 }; out.splice(hi, 1, { kind: "line", from: A, to: M }, { kind: "line", from: M, to: B });
  ok(hi >= 0 && CP(out, pl).ok === false && /바깥으로 나간/.test(CP(out, pl).reason), "8: 앞중심보다 바깥으로 나간 외곽이 있으면 거부(종이가 겹침)");
  // 넓은 안단: 정의할 수 없으면 거부(선을 늘이거나 추측하지 않는다)
  const mk = (ov, fc) => { const q = JSON.parse(J(pl)), cx = CF + ov + fc; q.parameters.overlapCm = ov; q.parameters.facingWidthCm = fc; q.outline[0].to.x = cx; q.outline[1].from.x = cx; q.outline[1].to.x = cx; q.outline[2].from.x = cx; return q; };
  const tw = CP(ring, mk(1.2, 30));
  ok(tw.ok === false && /맞춰 자를 수 없습니다/.test(tw.reason), "8: 안단이 너무 넓어 접힌 안단이 몸판을 벗어나면 거부 (" + (tw.reason || "").slice(0, 60) + ")");
  const zig = JSON.parse(J(ring)), zi = zig.findIndex(s => !isCF(s) && s.kind === "line" && Math.abs(s.from.y - s.to.y) < 1e-9 && Math.abs(s.from.y - 58) < 1e-9), zs = zig[zi], fromCF = Math.abs(zs.from.x - CF) < 1e-6;
  const q1 = { x: CF - 1, y: 58.5 }, q2 = { x: CF - 0.5, y: 59 }, chain = fromCF ? [zs.from, q1, q2, zs.to] : [zs.from, q2, q1, zs.to];
  zig.splice(zi, 1, { kind: "line", from: chain[0], to: chain[1] }, { kind: "line", from: chain[1], to: chain[2] }, { kind: "line", from: chain[2], to: chain[3] });
  const zr = CP(zig, mk(1.2, 3));
  ok(zr.ok === false && /여러 번 만남/.test(zr.reason) && CP(zig, mk(1.2, 1.2)).ok === true, "8: 접힌 안단이 밑단과 여러 번 만나는 모양이면 거부 · 같은 밑단도 안단 ≤ 여밈분이면 합침");
  const exact = CP(ring, mk(1.5, 3)), again = CP(ring, mk(1.5, 3));
  ok(exact.ok && J(exact) === J(again) && J(ring) === J(N0.front.segs), "8: 넓은 안단 합성 = 결정론 · 입력 불변");
  ok(CP(ring, { parameters: { overlapCm: 0, facingWidthCm: 0 }, outline: pl.outline }).ok === false && CP(ring, null).ok === false, "8: 0/0 · 빈 여밈 = 거부");
}

console.log("cutPlacketIntegrationCheck: " + PASS + " passed, " + FAIL + " failed");
fails.forEach(f => console.log("  FAIL " + f));
process.exit(FAIL ? 1 : 0);
