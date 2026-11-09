// sideHemTaperCheck.js — 옆선 → 밑단 안쪽 테이퍼 = 대체선 전 구간 새 옆선 · 끝 = 새 밑단 모서리(2026-11-09 김님 확정 «응 맞아»)
//   node test/harness/sideHemTaperCheck.js
//   §1 앞·뒤 직선 테이퍼 · 남은 밑단 보존 · 라벨 = 완료 판정 · 차 > 0.3 차단 + 반영 안내에 실제 이유 · 맞추면 완료 · 재편집·삭제 재합성 · 원본/완료본 불변
//   §2 곡선(독립 호 길이) · 역방향 · 허리 아래 연장 · 정확한 위 모서리
//   §3 승인 밖(밑단 통째·중심선 침범·밑단-밑단·진동 섞임·진동에서 끝) = 종전대로 승계 안 함
//   §4 그려지지 않은 소매 파생 상태 키 = 원래 몸판 라벨 값(편집 게이트 불변)
"use strict";
const vm = require("vm");
const fs = require("fs");
const path = require("path");

let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
const J = JSON.stringify;
const ROOT = path.join(__dirname, "..", "..");

let PROJECT = null;
const ELS = {};
function el(id) { if (!ELS[id]) ELS[id] = { id, textContent: "", disabled: false, title: "", attrs: {}, setAttribute(k, v) { this.attrs[k] = String(v); }, removeAttribute(k) { delete this.attrs[k]; } }; return ELS[id]; }
let LOADING = null; const SVG_H = {}, DOC_H = {};
const sb = { window: {}, console: { log() {}, warn() {} }, Math, JSON, Object, Array, isFinite, structuredClone, Error, Date, Promise, Number, String,
  c2p: (x, y) => [x * 10, y * 10], SC: 10, viewZ: 1,
  eventToPatternPoint: e => [e.px, e.py],
  render: () => {},
  svg: { addEventListener(t, f) { (SVG_H[LOADING + ":" + t] = SVG_H[LOADING + ":" + t] || []).push(f); }, setPointerCapture() {}, releasePointerCapture() {} },
  document: { createElementNS: () => ({ setAttribute() {}, appendChild() {} }), getElementById: el,
    addEventListener(t, f) { (DOC_H[LOADING + ":" + t] = DOC_H[LOADING + ":" + t] || []).push(f); } } };
sb.globalThis = sb; vm.createContext(sb);
sb.window.designWorkflow = { current: () => PROJECT };
sb.window.isDesignStageActive = () => true;
sb.window.addEventListener = () => {};
sb.window.refreshDesignResultUI = () => {};
const files = ["sideSeamMagnet.js", "designLineTool.js", "sleeveSplit.js", "designFlare.js", "designJoin.js", "designWaistSeam.js", "designYokeSeam.js", "designPrincess.js", "designBodice.js", "bodicePresets.js",
  "designLayout.js", "designRenderer.js", "bodiceCheckpoint.js", "designSleeve.js", "sleeveMeasure.js", "sleeveCheckpoint.js", "sleevePresets.js", "designSleeveA.js", "sleeveAApply.js"];
files.forEach(f => { LOADING = f; vm.runInContext(fs.readFileSync(path.join(ROOT, "js", f), "utf8"), sb, { filename: f }); });
LOADING = null;
const W = sb.window, DB = W.designBodice, BP = W.bodicePresets, BC = W.bodiceCheckpoint, SC = W.sleeveCheckpoint, DLT = W.designLineTool, DLy = W.designLayout, M = W.sideSeamMagnet;
let BARSYNC = 0; W.designLineQuickBar = { sync() { BARSYNC++; } };
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));
const REF_J = J(REF);
const REFSLEEVE = () => {
  const cap = { kind: "path", commands: [{ type: "M", points: [{ x: 5.53, y: 66.42 }] }, { type: "C", points: [{ x: 12, y: 56 }, { x: 18, y: 53 }, { x: 23.75, y: 53 }] }, { type: "C", points: [{ x: 29.5, y: 53 }, { x: 35, y: 56 }, { x: 39.29, y: 66.42 }] }] };
  const line = (a, b) => ({ kind: "line", from: { x: a[0], y: a[1] }, to: { x: b[0], y: b[1] } });
  return { outline: [cap, line([5.53, 66.42], [7.56, 105]), line([39.29, 66.42], [37.56, 105]), line([7.56, 105], [37.56, 105])], construction: [] };
};
const bodicePreset = sym => { for (const f of BP.families()) for (const v of f.variants) if (v.symbol === sym && v.presetId) return v.presetId; return null; };
function projectOn(sym) {
  const body = BP.bodyParams(bodicePreset(sym || "A"));
  PROJECT = { sourceBlock: { id: "blk", version: 2, schemaVersion: 8, canonicalHash: "abc" }, referenceGeometry: Object.assign(JSON.parse(REF_J), { sleeve: REFSLEEVE() }),
    working: { geometry: DB.computeGeometry(REF, { body }), parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body }, patternLines: [], designOutline: null, frontPlacket: null } };
  PROJECT.working.layout = { front: { dx: 40, dy: 5 }, back: { dx: 0, dy: 5 }, sleeve: { dx: 80, dy: 5 }, collar: { dx: 0, dy: 70 } };
  DLy.ensureLayout(PROJECT);
  return PROJECT;
}

// ── 실제 핸들러 ──
const H = t => (SVG_H["designLineTool.js:" + t] || []);
const KD = () => (DOC_H["designLineTool.js:keydown"] || []);
let CLX = 0;
function evAt(pc, geo, extra) {
  const L = DLy.ensureLayout(PROJECT), off = L[pc] || { dx: 0, dy: 0 };
  CLX += 100;
  return Object.assign({ button: 0, pointerId: 1, clientX: CLX, clientY: 0, altKey: false, shiftKey: false, px: geo.x + off.dx, py: geo.y + off.dy,
    target: { closest: () => ({ getAttribute: () => pc }) }, stopPropagation() {}, preventDefault() {} }, extra || {});
}
const down = e => H("pointerdown").forEach(f => f(e)), up = e => H("pointerup").forEach(f => f(e)), move = e => H("pointermove").forEach(f => f(e));
const key = k => KD().forEach(f => f({ key: k, target: {}, preventDefault() {} }));
const click = (pc, g, extra) => { const e = evAt(pc, g, extra); down(e); up(e); };
const drag = (pc, g, h) => { const e0 = evAt(pc, g); down(e0); const e1 = evAt(pc, { x: g.x + h.x, y: g.y + h.y }, { clientX: e0.clientX + 50 }); move(e1); up(e1); };
const lines = () => PROJECT.working.patternLines;
const last = () => lines()[lines().length - 1];
// 실제 경로: «선·곡선 그리기» → 점(Alt = 격자 흡착 없이 정확한 좌표) → Enter(완료 = 자동 선택) → «외곽» → «외곽 합성»
function drawBoundary(pc, pts, handles) {
  if (DLT.getMode() !== "off") DLT.setMode("off");
  DLT.toggle();
  pts.forEach((q, i) => { if (handles && handles[i]) drag(pc, q, handles[i]); else click(pc, q, { altKey: true }); });
  key("Enter");
  const line = last();
  DLT.setRole("boundary");
  DLT.doComposeDesignOutline();
  return line;
}

// ── 독립 계측(엔진 코드 미사용 · 조밀 샘플) ──
const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const bez = (q, t) => { const u = 1 - t; return { x: u * u * u * q[0].x + 3 * u * u * t * q[1].x + 3 * u * t * t * q[2].x + t * t * t * q[3].x, y: u * u * u * q[0].y + 3 * u * u * t * q[1].y + 3 * u * t * t * q[2].y + t * t * t * q[3].y }; };
function indLen(s) {
  if (s.kind === "line") return D(s.from, s.to);
  const q = [s.from, s.c1, s.c2, s.to]; let L = 0, pv = q[0];
  for (let i = 1; i <= 4000; i++) { const p = bez(q, i / 4000); L += D(pv, p); pv = p; }
  return L;
}
const indSide = outl => outl.filter(s => s.edge === "side-seam").reduce((a, s) => a + indLen(s), 0);
const effO = pc => (PROJECT.working.designOutline && PROJECT.working.designOutline[pc]) ? PROJECT.working.designOutline[pc].outline : PROJECT.working.geometry[pc].outline;
const SX = 23.053125;   // 몸판 Ⓐ 앞·뒤 옆선 x(형상 cm) · y 20.617 → 38(기본) → 58(허리 아래 연장)

const HEM_Y = 58;
const effSide = pc => effO(pc).filter(s => s.edge === "side-seam");
const mine = (pc, id) => effO(pc).filter(s => s.edgeSourceLineId === id);
const keptHem = pc => effO(pc).filter(s => s.edge === "hem");
// 실제 경로: 그리기(Alt = 정확 좌표) → Enter(자동 선택) → «몸판 외곽으로 반영»
function taper(pc, pts, handles) {
  if (DLT.getMode() !== "off") DLT.setMode("off");
  DLT.toggle();
  pts.forEach((q, i) => { if (handles && handles[i]) drag(pc, q, handles[i]); else click(pc, q, { altKey: true }); });
  key("Enter");
  const ok_ = DLT.doReflectToBodice();
  return { line: last(), ok: ok_ };
}
const note = () => el("designComposeNote").textContent || "";
const lab = () => DLT.sideSeamLabels(PROJECT);
const independentSide = pc => effSide(pc).reduce((a, s) => a + indLen(s), 0);

// ══ §1 앞 직선 테이퍼(옆선 중간 → 밑단 안쪽 5cm) = 대체선 전 구간 옆선 · 남은 밑단 보존 · 라벨=완료 판정 ══
{
  projectOn("A");
  const geom0 = J(PROJECT.working.geometry), hem0 = PROJECT.working.geometry.front.outline.filter(s => s.edge === "hem");
  const t = taper("front", [{ x: SX, y: 30 }, { x: SX + 0.8, y: 45 }, { x: SX + 5, y: HEM_Y }]);
  const ms = mine("front", t.line.id);
  ok(t.ok && ms.length === 2 && ms.every(s => s.edge === "side-seam" && s.edgeInherited === true && !s.edgeStatus && !s.replacedEdges), "1: 테이퍼 대체선 전 구간 = side-seam 승계");
  const kh = keptHem("front");
  ok(kh.length === 1 && Math.abs(Math.min(kh[0].from.x, kh[0].to.x) - (SX + 5)) < 1e-9 && Math.abs(indLen(kh[0]) - (indLen(hem0[0]) - 5)) < 1e-9, "1: 남은 밑단 = 밑단 그대로(새 모서리부터 · 5cm 짧아짐)");
  const c = BC.check(PROJECT), exp = (30 - 20.616666666666667) + Math.hypot(0.8, 15) + Math.hypot(5 - 0.8, 13);
  ok(Math.abs(c.sideSeam.front - exp) < 1e-9 && Math.abs(independentSide("front") - exp) < 1e-9, "1: 앞 옆선 = 남은 옆선 + 새 선(" + c.sideSeam.front.toFixed(4) + " = 독립 " + exp.toFixed(4) + ")");
  ok(lab().front.length === c.sideSeam.front && lab().front.text === "앞 옆선 " + c.sideSeam.front.toFixed(2) + "cm", "1: 라벨 = 완료 판정 같은 값 (" + lab().front.text + ")");
  ok(c.sideSeam.status === "mismatch" && c.fails.indexOf("side-seam-mismatch") >= 0 && c.fails.indexOf("side-seam-unmeasured") < 0, "1: 앞뒤 차 " + (c.sideSeam.front - c.sideSeam.back).toFixed(2) + " > 0.3 = 차단(측정 불가 아님)");
  ok(/^몸판 외곽으로 반영됨 · 아직 몸판 완료 안 됨: /.test(note()) && note().indexOf("앞 옆선 " + c.sideSeam.front.toFixed(2)) > 0 && note().indexOf("뒤 옆선 " + c.sideSeam.back.toFixed(2)) > 0, "1: 반영 안내 = 성공만이 아니라 실제 미완료 이유·치수 (" + note().slice(0, 60) + "…)");
  ok(J(PROJECT.working.geometry) === geom0, "1: 원본 working geometry 불변");
  // 뒤판에도 같은 테이퍼 → 차이 해소 → 마지막 완료 정상
  const tb = taper("back", [{ x: SX, y: 30 }, { x: SX - 0.8, y: 45 }, { x: SX - 5, y: HEM_Y }]);
  const c2 = BC.check(PROJECT);
  ok(tb.ok && Math.abs(c2.sideSeam.back - exp) < 1e-9 && c2.sideSeam.status === "match" && c2.ok, "1: 뒤판 같은 테이퍼 → 정합 · 완료 가능");
  ok(/^몸판 외곽으로 반영됨 · 선을 고치면/.test(note()), "1: 막힘 없으면 종전 성공 안내");
  ok(BC.complete(PROJECT).ok && PROJECT.working.bodiceResult, "1: 마지막 «몸판 모양 완료» 정상");
  // 완료 뒤 재편집: 중간 점 드래그 → 자동 재합성 · 승계 유지 · 길이 갱신 · 완료본 불변
  const done0 = J(PROJECT.working.bodiceResult);
  DLT.setMode("off"); DLT.toggleSelect(); click("back", { x: SX - 0.8, y: 45 });
  const e0 = evAt("back", { x: SX - 0.8, y: 45 }); down(e0); move(evAt("back", { x: SX - 1.6, y: 45 }, { altKey: true, clientX: e0.clientX + 40 })); up(evAt("back", { x: SX - 1.6, y: 45 }, { altKey: true, clientX: e0.clientX + 40 }));
  const c3 = BC.check(PROJECT), m3 = mine("back", tb.line.id);
  const exp3 = (30 - 20.616666666666667) + Math.hypot(1.6, 15) + Math.hypot(5 - 1.6, 13);
  ok(m3.length === 2 && m3.every(s => s.edge === "side-seam" && s.edgeInherited) && Math.abs(c3.sideSeam.back - exp3) < 1e-9 && lab().back.length === c3.sideSeam.back, "1: 재편집 = 자동 재합성 · 승계 유지 · 뒤 " + c3.sideSeam.back.toFixed(4));
  ok(J(PROJECT.working.bodiceResult) === done0 && BC.isCurrentBodiceChanged(PROJECT), "1: 기존 완료본 불변 · «변경됨»(다시 완료 필요)");
  // 삭제 → 재합성 → 뒤 옆선 원래 길이
  key("Delete");
  const c4 = BC.check(PROJECT);
  ok(!lines().some(l => l.id === tb.line.id) && Math.abs(c4.sideSeam.back - 37.38333333333334) < 1e-9 && keptHem("back").every(s => Math.abs(indLen(s) - SX) < 1e-9), "1: 선 삭제 → 뒤 옆선·밑단 원래대로 (" + c4.sideSeam.back.toFixed(4) + ")");
  DLT.setMode("off");
}

// ══ §2 곡선·역방향·허리 아래 연장·정확한 위 모서리 ══
{
  // 뒤 곡선 테이퍼(옆선 → 밑단 안쪽 2cm)
  projectOn("A");
  const t = taper("back", [{ x: SX, y: 32 }, { x: SX - 2, y: HEM_Y }], [{ x: -0.3, y: 3 }, { x: -0.2, y: 2 }]);
  const ms = mine("back", t.line.id), c = BC.check(PROJECT);
  ok(t.ok && ms.some(s => s.kind === "cubic") && ms.every(s => s.edge === "side-seam" && s.edgeInherited), "2: 뒤 곡선 테이퍼 = side-seam 승계");
  ok(Math.abs(c.sideSeam.back - independentSide("back")) < 2e-3 && lab().back.length === c.sideSeam.back, "2: 곡선 호 길이 = 독립 검산(" + c.sideSeam.back.toFixed(4) + " / " + independentSide("back").toFixed(4) + ") · 라벨 같은 값");
  // 역방향(밑단 안쪽에서 옆선으로)
  projectOn("A");
  const r = taper("front", [{ x: SX + 3, y: HEM_Y }, { x: SX + 0.6, y: 44 }, { x: SX, y: 33 }]);
  const cr = BC.check(PROJECT), er = (33 - 20.616666666666667) + Math.hypot(0.6, 11) + Math.hypot(2.4, 14);
  ok(r.ok && mine("front", r.line.id).every(s => s.edge === "side-seam" && s.edgeInherited) && Math.abs(cr.sideSeam.front - er) < 1e-9, "2: 역방향(밑단→옆선) 같은 판정 · " + cr.sideSeam.front.toFixed(4));
  // 허리 아래 연장 구간에서만 시작(y 45 > 38)
  projectOn("A");
  const x = taper("front", [{ x: SX, y: 45 }, { x: SX + 2, y: HEM_Y }]);
  const cx = BC.check(PROJECT), ex = 45 - 20.616666666666667 + Math.hypot(2, 13);
  ok(x.ok && Math.abs(cx.sideSeam.front - ex) < 1e-9 && cx.sideSeam.status !== "unmeasured", "2: 허리 아래 연장에서 시작 = 기본 옆선 + 연장 남은 + 새 선 (" + cx.sideSeam.front.toFixed(4) + ")");
  // 정확한 위 모서리(진동-옆선)에서 시작 → 옆선 전체 + 밑단 일부 대체
  projectOn("A");
  const k = taper("front", [{ x: SX, y: 20.616666666666667 }, { x: SX + 0.5, y: 40 }, { x: SX + 2, y: HEM_Y }]);
  const ck = BC.check(PROJECT), ek = Math.hypot(0.5, 40 - 20.616666666666667) + Math.hypot(1.5, 18);
  ok(k.ok && Math.abs(ck.sideSeam.front - ek) < 1e-9 && effSide("front").every(s => s.edgeSourceLineId === k.line.id), "2: 위 모서리 → 밑단 안쪽 = 새 선이 옆선 전체 (" + ck.sideSeam.front.toFixed(4) + ")");
}

// ══ §3 승인 밖 = 종전대로 측정 불가(일반화 금지) ══
{
  const rej = (tag, pc, pts) => {
    projectOn("A");
    const t = taper(pc, pts), c = BC.check(PROJECT), mm = t.ok ? mine(pc, t.line.id) : [];
    return { t: t, c: c, mm: mm, tag: tag };
  };
  // 밑단 전체를 덮음(중심 모서리까지)
  let r = rej("밑단 전체", "front", [{ x: SX, y: 30 }, { x: 35, y: 50 }, { x: 47.5, y: HEM_Y }]);
  ok(r.t.ok && r.mm.every(s => s.edge !== "side-seam") && r.c.sideSeam.status === "unmeasured", "3: 밑단을 통째로 덮음(남은 밑단 없음) = 승계 안 함 · 측정 불가 (" + (r.t.ok ? r.c.fails.join(",") : note()) + ")");
  // 중심선 침범(옆선 → 중심선)
  r = rej("중심선", "front", [{ x: SX, y: 30 }, { x: 40, y: 50 }, { x: 47.5, y: 52 }]);
  ok(r.t.ok && r.mm.every(s => s.edge !== "side-seam") && r.c.sideSeam.status === "unmeasured", "3: 중심선까지 침범 = 승계 안 함 (" + (r.t.ok ? r.c.fails.join(",") : note()) + ")");
  // 밑단 → 밑단(옆선 무관) = 옆선 그대로
  r = rej("밑단-밑단", "front", [{ x: 30, y: HEM_Y }, { x: 33, y: 55 }, { x: 36, y: HEM_Y }]);
  ok(r.t.ok && r.mm.every(s => s.edge !== "side-seam") && Math.abs(r.c.sideSeam.front - 37.38333333333334) < 1e-9, "3: 밑단-밑단 절단 = 옆선 의미 없음 · 옆선 길이 그대로");
  ok(r.mm.every(s => s.edgeStatus === "unresolved" && !s.replacedEdges), "3: 밑단-밑단 = 종전 그대로(의미 미지정 · 옆선 기록 없음)");
  // 진동 곡선 위 점 → 옆선 → 밑단 안쪽(세 의미 섞임)
  projectOn("A");
  const ahp = PROJECT.working.geometry.front.outline.filter(s => s.edge === "armhole");
  const ap = ahp[ahp.length - 1], apEnd = ap.kind === "path" ? (() => { const cs = ap.commands.filter(c => c.type === "C"); const cc = cs[cs.length - 1]; let st = null; ap.commands.forEach(c => { if (c.type === "M") st = c.points[0]; }); return { q: [cs.length > 1 ? cs[cs.length - 2].points[2] : st, cc.points[0], cc.points[1], cc.points[2]] }; })() : null;
  const onAh = apEnd ? bez(apEnd.q, 0.6) : null;
  if (onAh) {
    const t = taper("front", [onAh, { x: SX + 0.5, y: 40 }, { x: SX + 2, y: HEM_Y }]), c = BC.check(PROJECT), mm = t.ok ? mine("front", t.line.id) : [];
    ok(t.ok && mm.every(s => s.edge !== "side-seam") && c.sideSeam.status === "unmeasured" && c.fails.indexOf("side-seam-unmeasured") >= 0, "3: 진동→옆선→밑단(세 의미) = 승계 안 함 · 측정 불가 · 완료 차단 (" + (t.ok ? lab().front.text : note()) + ")");
    if (t.ok) ok(/아직 몸판 완료 안 됨: /.test(note()), "3: 측정 불가로 막히면 반영 안내에 실제 이유");
  } else ok(false, "3: 진동 곡선 점을 못 찾음");
  // 옆선 안 → 진동에서 끝(이번 확정 밖)
  projectOn("A");
  if (onAh) { const t = taper("front", [{ x: SX, y: 32 }, { x: SX + 0.5, y: 26 }, onAh]), mm = t.ok ? mine("front", t.line.id) : [];
    ok(t.ok && mm.length > 0 && mm.every(s => s.edge !== "side-seam"), "3: 옆선 → 진동에서 끝 = 승계 안 함(이번 확정 밖)"); }
}

// ══ §4 숨겨진/차단 소매 파생 상태 키 = 그려진 원래 몸판 값 표시(편집 게이트 불변) ══
{
  projectOn("A");
  PROJECT.working.sleeveR = { presetId: "bunka-sleeve-R", blocked: true };
  const lb = lab(), c = BC.check(PROJECT);
  ok(DLT.displayedDerivedPiece(PROJECT, "front") === null && lb.front.length === c.sideSeam.front && lb.back.length === c.sideSeam.back, "4: 파생 몸판이 그려지지 않으면 원래 몸판 값 (" + lb.front.text + ")");
  ok(DLT.isOriginalBodiceContext(PROJECT) === false, "4: 편집 지원 게이트(원래 몸판 맥락 판정)는 그대로");
}

console.log("══════════════════════════════════════════════");
fails.forEach(f => console.log("  ✗ " + f));
console.log("결과: " + PASS + " PASS / " + FAIL + " FAIL");
process.exitCode = FAIL ? 1 : 0;
