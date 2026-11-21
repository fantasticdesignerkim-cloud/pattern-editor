// ══════════════════════════════════════════════
// designPocketCheck.js — 디자인 «디테일» 셔츠 앞 주머니(오각 패치 1장, 2026-11-19 승인 ⑥) 회귀.
//   근거: [패턴학교] P.100 ③ «패치(오각)» — 폭 15 · 높이 16 · 밑각 3. 위치 자유·접어박기 숫자 없음(앱 초깃값과 구별).
//   독립 검증: 모듈 코드가 아니라 이 파일 안의 다각형·거리·DXF 파서로 대조한다. 실제 엔진(stub 없음).
//   §1 P.100 치수·오각형 기하(옆 수직선 13 · 밑각 3 · 면적) · 앱 초깃값 표시 · 엄격 설정 검증
//   §2 주머니 없는 기존 흐름 = 완료본 hash 공식 무변경 · 재단 조각에 주머니 없음 · 저장본 그대로
//   §3 적용 → 변경 추적(완료 전 변경됨) → 재완료(pocket frozen · hash 에 pk) · 해제 → 원래 hash 복귀
//   §4 재단: 독립 조각(group detail · 수량 1 · 식서 90°) · 완성선 15×16 · 시접(입구 3 · 나머지 1) · 입구 접는선 · 앞판 달림선 한쪽만(비재단)
//   §5 DXF 일반·AAMA 경로: 주머니 조각 수량 1 · 재단선(CUT)과 내부 표시(INTERNAL/8) 분리
//   §6 저장/열기: 주머니 유지 · 바이트 동일 재단 · 주머니 없는 옛 저장본 그대로 · 열기 뒤 변경 추적
//   §7 걸림/무효: 몸판 밖 → 이유 안내 + 위치 불변 · 설정이 무효해지면 Design 완료 거부 + 재단 변경됨
//   §8 index.html: 디테일 탭·패널·스크립트 순서
//   node test/harness/designPocketCheck.js   (이 파일은 Bash 없이 작성돼 아직 실행하지 못했다 — 실행 결과로만 신뢰할 것)
// ══════════════════════════════════════════════
"use strict";
const vm = require("vm"), fs = require("fs"), path = require("path");
let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
process.on("uncaughtException", e => { console.log("designPocketCheck: 예외 — " + (e && e.stack || e).toString().split("\n").slice(0, 4).join(" | ")); fails.slice(0, 20).forEach(f => console.log("  ✗ " + f)); process.exit(1); });
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
  "designPlacket.js", "designBodice.js", "bodicePresets.js", "designLayout.js", "designRenderer.js", "bodiceCheckpoint.js", "peplumAnnotation.js", "designSleeve.js", "sleeveMeasure.js", "sleeveCheckpoint.js", "sleevePresets.js",
  "designSleeveA.js", "designCuff.js", "sleeveAApply.js", "sleeveAnnotation.js", "designCollar.js", "collarPresets.js", "collarCheckpoint.js", "designPocket.js", "designResult.js", "projectFile.js", "seamMatch.js", "seamAllowance.js", "cutPrep.js", "cutPrint.js", "cutDxf.js"].concat(SLEEVE_EXTRA);
const SRC = {}; FILES.forEach(f => { SRC[f] = fs.readFileSync(path.join(ROOT, "js", f), "utf8"); });

function makeSession(subtab) {
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
  const S = { W, BW: W.blockWorkflow, DW: W.designWorkflow, DB: W.designBodice, BP: W.bodicePresets, BC: W.bodiceCheckpoint, SC: W.sleeveCheckpoint, DR: W.designResult, DLy: W.designLayout,
    CP: W.collarPresets, CC: W.collarCheckpoint, DC: W.designCollar, DCF: W.designCuff, PF: W.projectFile, DP: W.designPocket, CUT: W.cutPrep, PRINT: W.cutPrint, DXF: W.cutDxf };
  S.P = () => S.DW.current();
  W.projectSessionUI = { snapshot: () => ({ stage: "design", subtab: subtab || "detail" }), unfinished: () => [], afterRestore() {} };
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
// 박시 Ⓐ(엉덩이 길이 20) + 여밈 1.2/1.2 → 몸판·소매 Ⓐ·카라 M 까지 완료(Design 완료는 호출자가). 주머니는 몸판 완료 뒤에 단다.
function buildShirt() {
  const S = makeSession(), P = start(S);
  const pp = { overlapCm: 1.2, facingWidthCm: 1.2, lengthMode: "full" }, pr0 = S.W.designPlacket.compute(S.BC.effectiveOutline(P, "front"), pp);
  if (pr0.ok) P.working.frontPlacket = { parameters: pp, outline: pr0.outline, construction: pr0.construction };
  const a = pr0.ok && S.BC.complete(P).ok, ra = a && S.W.sleeveAApply.apply(P, { sleeveLengthCm: 52 });
  const b = !!(ra && ra.ok && S.SC.complete(P).ok), pl = b && setCollarM(S), c = !!(pl && pl.ok && S.CC.complete(P).ok);
  return { S, P, ok: a && b && c };
}
function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return (h >>> 0).toString(16); }
const near = (a, b, e) => typeof a === "number" && typeof b === "number" && Math.abs(a - b) <= (e == null ? 1e-6 : e);
const view = (S, P) => { const d = S.CUT.derive(P, true), m = S.CUT.seam(d, P), D = S.CUT.displayOf(d, m), L = S.CUT.layoutOf(d.pieces, D), Q = S.CUT.qtyOf(d, D, P), G = S.CUT.grainOf(d, D, P); return { d, m, D, L, Q, G }; };
const ptsOf = s => s.kind === "cubic" ? [s.from, s.c1, s.c2, s.to] : [s.from, s.to];
const cubP = (s, t) => { const u = 1 - t; return { x: u * u * u * s.from.x + 3 * u * u * t * s.c1.x + 3 * u * t * t * s.c2.x + t * t * t * s.to.x, y: u * u * u * s.from.y + 3 * u * u * t * s.c1.y + 3 * u * t * t * s.c2.y + t * t * t * s.to.y }; };
const denseOf = segs => { const o = []; segs.forEach(s => { const n = s.kind === "cubic" ? 200 : 1; for (let k = 0; k < n; k++) o.push(s.kind === "cubic" ? cubP(s, k / n) : s.from); }); return o; };
const inPoly = (q, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a.y > q.y) !== (b.y > q.y) && q.x < (b.x - a.x) * (q.y - a.y) / (b.y - a.y) + a.x) c = !c; } return c; };
const area = pts => { let a = 0; pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length]; a += p.x * q.y - q.x * p.y; }); return Math.abs(a) / 2; };
function parseDxf(txt) {
  const L = txt.split(/\r?\n/), R = []; for (let i = 0; i + 1 < L.length; i += 2) R.push([L[i].trim(), L[i + 1]]);
  const out = []; let sec = null, cur = null, lastPoly = null;
  for (let i = 0; i < R.length; i++) {
    const [c, v] = R[i];
    if (c === "0") {
      cur = null;
      if (v === "SECTION") sec = R[i + 1] ? R[i + 1][1].trim() : null;
      else if (v === "ENDSEC") sec = null;
      else if (v === "VERTEX") { cur = { type: "VERTEX", f: {} }; if (lastPoly) lastPoly.verts.push(cur); }
      else if (v === "SEQEND" || v === "BLOCK" || v === "ENDBLK") { /* 건너뜀 */ }
      else { cur = { type: v, f: {}, verts: [], sec }; out.push(cur); if (v === "POLYLINE") lastPoly = cur; }
    } else if (cur) (cur.f[c] = cur.f[c] || []).push(v);
  }
  return out.filter(e => e.sec === "ENTITIES" || e.sec === "BLOCKS");
}
const layerOf = e => (e.f["8"] || [])[0];

(function main() {
  const B = buildShirt(); const { S, P } = B; const DP = S.DP;
  ok(B.ok, "0: 셔츠 준비(몸판·소매 Ⓐ·카라 M 완료)");
  ok(!!DP, "0: designPocket 모듈 로드");

  // ══ §1 P.100 치수·기하·엄격 검증 ══
  {
    ok(DP.BOOK.widthCm === 15 && DP.BOOK.heightCm === 16 && DP.BOOK.tipDepthCm === 3 && /P\.100/.test(DP.BOOK.source), "1: 교재 도해 치수 = 15·16·3 (P.100 ③)");
    const d = DP.defaultSpec();
    ok(d.widthCm === 15 && d.heightCm === 16 && d.tipDepthCm === 3 && d.side === "left", "1: 앱 초깃값 폭·높이·밑각 = 도해 값 · 착용자 왼쪽 기본");
    ok(/앱 초깃값/.test(DP.APP_NOTE) && /교재 수치 아님/.test(DP.APP_NOTE) && d.cxFromCfCm === DP.APP.cxFromCfCm && d.mouthFoldCm === DP.APP.mouthFoldCm, "1: 위치·접어박기는 «앱 초깃값, 교재 수치 아님»으로 구별해 적음");
    const o = DP.localOutline(d), v = o.map(s => s.from);
    ok(o.length === 5 && v[0].x === 0 && v[0].y === 0 && v[1].x === 15 && v[1].y === 0, "1: 입구 윗변 15");
    ok(near(v[2].y, 13) && near(v[2].x, 15) && near(v[4].y, 13) && near(v[4].x, 0), "1: 양옆 수직선 끝 = 높이 16 − 밑각 3 = 13");
    ok(near(v[3].x, 7.5) && near(v[3].y, 16) && near(v[3].y - v[2].y, 3), "1: 맨 아래 중심 (7.5, 16) · 밑각(수직선 끝~맨아래 중심 높이차) 3");
    ok(near(area(v), 15 * 13 + 0.5 * 15 * 3), "1: 오각형 면적 = 195 + 22.5");
    ok(o.every((s, i) => near(s.to.x, o[(i + 1) % 5].from.x) && near(s.to.y, o[(i + 1) % 5].from.y)), "1: 닫힌 오각형");
    ok(J(o.map(s => s.edge)) === J(["mouth", "pocket-side-r", "pocket-bottom-r", "pocket-bottom-l", "pocket-side-l"]), "1: 변 이름(시접 변)");
    const bad = (m) => { const x = Object.assign(DP.defaultSpec(), m); return DP.normalizeSpec(x); };
    ok(DP.normalizeSpec(d).ok, "1: 기본 설정 통과");
    ok(!bad({ widthCm: 4 }).ok && !bad({ widthCm: "15" }).ok && !bad({ heightCm: NaN }).ok && !bad({ mouthFoldCm: 0 }).ok && !bad({ side: "both" }).ok && !bad({ tipDepthCm: 15.5 }).ok, "1: 범위 밖·문자·NaN·모르는 좌우·밑각≥높이−1 거부");
    ok(!DP.normalizeSpec(Object.assign(DP.defaultSpec(), { extra: 1 })).ok && !DP.normalizeSpec(null).ok && !DP.normalizeSpec([]).ok, "1: 모르는 키·null·배열 거부");
    ok(DP.validateStored(undefined).ok && DP.validateStored(undefined).none && !DP.validateStored({}).ok, "1: 저장본 검증 — 키 없음 = 주머니 없음 · 빈 객체 거부");
  }

  // ══ §2 주머니 없는 기존 흐름 ══
  let H0 = null, D0 = null, TEXT0 = null;
  {
    ok(!("pocket" in P.working), "2: 주머니 없음 = working.pocket 키 없음");
    const r = S.DR.complete(P); ok(r.ok && !("pocket" in r.result), "2: Design 완료(pocket 키 없음)");
    const R = P.working.designResult; H0 = R.hash;
    ok(R.hash === hashStr(J({ bh: R.bodiceHash, sh: R.sleeveHash, ch: R.collarHash, cuts: [] })), "2: 주머니 없는 완료본 hash 공식 무변경(pk 키 없음)");
    const d = S.CUT.derive(P, true); D0 = J(d);
    ok(d.state === "ready" && !d.pieces.some(p => p.id === "pocket") && !d.missing.some(m => m.id === "pocket"), "2: 재단 ready · 주머니 조각·누락 없음");
    ok(!d.pieces.some(p => (p.marks || []).some(m => /^pocket/.test(m.kind))), "2: 앞판에 주머니 표시 없음");
    const built = S.PF.buildFileText({ savedAt: "2026-11-19T00:00:00.000Z" }); TEXT0 = built.text;
    ok(built.status.design.completed === true && built.status.design.changed === false, "2: 저장 status = Design 완료");
  }

  // ══ §3 적용 → 변경 추적 → 재완료 → 해제 ══
  let PK_HASH = null, TEXT1 = null, D1 = null, SPEC1 = null;
  {
    const ap = DP.apply(P, DP.defaultSpec());
    ok(ap.ok, "3: 기본 주머니 적용" + (ap.ok ? "" : " — " + ap.reason));
    if (!ap.ok) { console.log("designPocketCheck: 기본 위치가 박시 Ⓐ 앞판에 맞지 않음 — " + ap.reason); }
    else {
      ok(S.DR.isCurrentDesignChanged(P) === true, "3: 주머니 적용 직후 = Design 변경됨(다시 완료 필요)");
      ok(S.CUT.derive(P).state === "changed", "3: 재단 = 변경됨(다시 완료 전)");
      const c = S.DR.check(P); ok(c.ok && !!c._pocket && c._pocket.widthCm === 15, "3: 검사 통과 · _pocket 설정");
      const r = S.DR.complete(P); ok(r.ok, "3: Design 재완료");
      const R = P.working.designResult; SPEC1 = J(R.pocket);
      ok(!!R.pocket && Object.isFrozen(R.pocket) && R.pocket.side === "left" && R.pocket.widthCm === 15 && R.pocket.heightCm === 16 && R.pocket.tipDepthCm === 3, "3: designResult.pocket = frozen 설정 사본");
      ok(R.hash !== H0 && R.hash === hashStr(J({ bh: R.bodiceHash, sh: R.sleeveHash, ch: R.collarHash, cuts: [], pk: "1|shirt-patch-pentagon|left|15|16|3|" + R.pocket.cxFromCfCm + "|" + R.pocket.topBelowBustCm + "|" + R.pocket.mouthFoldCm })), "3: hash = 기존 공식 + pk (주머니 있을 때만)");
      PK_HASH = R.hash;
      ok(S.DR.isCurrentDesignChanged(P) === false, "3: 재완료 직후 변경됨 아님");
      // 완료 뒤 값만 바꿔도 변경 추적
      const w0 = P.working.pocket.widthCm; P.working.pocket.widthCm = 14;
      ok(S.DR.isCurrentDesignChanged(P) === true && S.CUT.derive(P).state === "changed", "3: 완료 뒤 폭만 바꿔도 Design 변경됨 · 재단 변경됨");
      P.working.pocket.widthCm = w0;
      ok(S.DR.isCurrentDesignChanged(P) === false, "3: 되돌리면 변경됨 아님");
      const d = S.CUT.derive(P, true); D1 = J(d); TEXT1 = S.PF.buildFileText({ savedAt: "2026-11-19T00:00:00.000Z" }).text;
      ok(d.state === "ready", "3: 재단 ready");
    }
  }

  // ══ §4 재단 조각·시접·표시 ══
  if (PK_HASH) {
    const V = view(S, P), pk = V.d.pieces.find(p => p.id === "pocket");
    ok(!!pk && pk.group === "detail" && pk.check.ok, "4: 독립 조각 pocket(group detail) · 외곽 검사 통과");
    if (pk) {
      ok(near(pk.widthCm, 15) && near(pk.heightCm, 16) && near(pk.areaCm2, 217.5, 1e-3), "4: 완성선 15 × 16 · 면적 217.5");
      ok(pk.pocket && pk.pocket.mouthFoldCm === P.working.pocket.mouthFoldCm && /교재 수치 아님/.test(pk.note) && /앱 초깃값/.test(pk.note), "4: 입구 접어박기 = 설정값 · 노트에 «앱 초깃값, 교재 수치 아님»");
      const folds = (pk.marks || []).filter(m => m.kind === "pocket-fold");
      ok(folds.length === 1 && folds[0].label === "입구 접는선" && near(folds[0].segs[0].from.y, 0) && near(folds[0].segs[0].to.y, 0) && near(Math.abs(folds[0].segs[0].to.x - folds[0].segs[0].from.x), 15), "4: 입구 접는선 = 윗변(y=0, 길이 15)");
      const sm = V.m.pieces.pocket; ok(sm && sm.ok, "4: 주머니 시접 계산 완료");
      if (sm) {
        const eMouth = sm.edges.find(e => e.id === "mouth"), others = sm.edges.filter(e => e.id !== "mouth");
        ok(eMouth && near(eMouth.widthCm, P.working.pocket.mouthFoldCm) && eMouth.explicit === false, "4: 입구 시접 = 접어박기 분량(" + P.working.pocket.mouthFoldCm + ") · 직접 지정 아님");
        ok(others.length === 4 && others.every(e => near(e.widthCm, 1)), "4: 나머지 네 변 = 기존 시접 규칙 1cm");
        const ys = sm.points.map(q => q.y), xs = sm.points.map(q => q.x);
        ok(near(Math.min(...ys), -P.working.pocket.mouthFoldCm, 1e-6) && near(Math.min(...xs), -1, 1e-6) && near(Math.max(...xs), 16, 1e-6), "4: 재단선 윗변 y = −접어박기 · 좌우 −1 / 16");
        const sp0 = S.CUT.setEdge("pocket", "mouth", { kind: "seam", widthCm: 4 }, P); const V2 = view(S, P);
        ok(sp0.ok && near(V2.m.pieces.pocket.edges.find(e => e.id === "mouth").widthCm, 4) && V2.m.pieces.pocket.edges.find(e => e.id === "mouth").explicit === true, "4: 입구 시접은 직접 지정으로도 조정 가능(지정값 우선)");
        S.CUT.clearOrphans(P); delete P.working.cutSpec;
      }
      const V1 = view(S, P);
      ok(V1.Q.pieces.pocket && V1.Q.pieces.pocket.qty === 1, "4: 재단 수량 1");
      ok(V1.G.pieces.pocket && V1.G.pieces.pocket.ok && V1.G.pieces.pocket.angleDeg === 90, "4: 식서 = 세로 90°(앱 기본값 근거 표기: " + (V1.G.pieces.pocket && V1.G.pieces.pocket.basis) + ")");
    }
    // 앞판 달림선: 착용자 왼쪽 한쪽만, 비재단 표시
    const pr = V.m.pairing;
    ok(pr && pr.active, "4: 앞판 좌우 한 쌍 활성(수량 2 · 앞중심 직선)");
    const attachOn = id => V.D[id] ? V.D[id].marks.filter(m => m.kind === "pocket-attach") : null;
    if (pr && pr.active) {
      const leftId = pr.origSide === "L" ? "front" : "front~m", rightId = leftId === "front" ? "front~m" : "front";
      ok(attachOn(leftId).length === 1 && attachOn(rightId).length === 0, "4: 달림선은 착용자 왼쪽 앞판(" + leftId + ")에만 · 오른쪽 앞판에는 없음");
      const mk = attachOn(leftId)[0];
      ok(mk && mk.segs.length === 5 && /재단 아님/.test(mk.label || ""), "4: 달림선 = 오각형 5변 · «재단 아님» 표시");
      // 독립: 달림선의 모든 꼭짓점이 그 앞판 완성선 안
      const fr = V.d.pieces.find(p => p.id === "front"), poly = denseOf(V.D[leftId].outline);
      ok(mk && mk.segs.every(s => inPoly(s.from, poly)), "4: 달림선 꼭짓점이 모두 해당 앞판 안(종이 위)");
      ok(fr && !V.d.pieces.some(p => p.id === "front" && (p.marks || []).some(m => m.kind === "pocket-attach" && m.side !== "left")), "4: 원본 표시의 side = left");
      // 표시 폭 15 · 옆 길이 13 (독립 치수)
      const sg = mk.segs.map(s => Math.hypot(s.to.x - s.from.x, s.to.y - s.from.y)).sort((a, b) => a - b);
      ok(near(sg[sg.length - 1], 15, 1e-3) && sg.filter(l => near(l, 13, 1e-3)).length === 2, "4: 달림선 치수 = 입구 15 · 옆 13 두 변");
    }
    // 쌍이 아닌 수량(3) → 한 조각 그대로: 표시는 원본 조각에 한 번
    S.CUT.setQty("front", 3, P); { const V3 = view(S, P); ok(!V3.m.pairing.active && V3.D.front.marks.filter(m => m.kind === "pocket-attach").length === 1 && !V3.D["front~m"], "4: 쌍 아님(수량 3) → 한 앞판 조각에 한 번만"); }
    S.CUT.setQty("front", null, P);
    // 오른쪽으로 바꾸면 반대쪽 앞판
    //   좌우 변경 = Design 변경 → 변경 직후 재단은 stale(정상) · 다시 완료한 뒤 표시를 검증 · 원래(왼쪽)로 되돌려 다시 완료.
    { const was = J(P.working.pocket); P.working.pocket.side = "right";
      ok(S.DR.isCurrentDesignChanged(P) === true && S.CUT.derive(P).state === "changed", "4: 좌우 변경 직후 = Design 변경됨 · 재단 stale");
      ok(S.DR.complete(P).ok, "4: side=right 재완료");
      const Vr = view(S, P), rightHost = Vr.m.pairing.origSide === "R" ? "front" : "front~m", leftHost = rightHost === "front" ? "front~m" : "front";
      ok(Vr.D[rightHost].marks.filter(m => m.kind === "pocket-attach").length === 1 && Vr.D[leftHost].marks.filter(m => m.kind === "pocket-attach").length === 0, "4: side=right → 착용자 오른쪽 앞판에만");
      P.working.pocket = JSON.parse(was);
      ok(S.DR.isCurrentDesignChanged(P) === true, "4: 왼쪽으로 되돌린 직후 다시 변경됨");
      ok(S.DR.complete(P).ok && S.DR.isCurrentDesignChanged(P) === false, "4: side=left 재완료");
      const Vl = view(S, P), lh = Vl.m.pairing.origSide === "L" ? "front" : "front~m", rh = lh === "front" ? "front~m" : "front";
      ok(Vl.D[lh].marks.filter(m => m.kind === "pocket-attach").length === 1 && Vl.D[rh].marks.filter(m => m.kind === "pocket-attach").length === 0, "4: side=left 재완료 → 왼쪽 앞판에만"); }
    // 디자인 화면 미리보기 모델
    const pv = DP.previewFor(P); ok(pv && pv.ok && pv.attach.length === 5 && pv.side === "left", "4: 디자인 화면 부착 위치 모델(오각형 5변 · 왼쪽)");
    // 독립 경계: 재단 쪽 검증된 폐곡선 조각(normOutline·ringOf 거친 front 완성선, 다트 다리 포함)을 쓴다 — 원본 outline 을 순서대로 이어 붙이지 않는다.
    const frontPiece = view(S, P).d.pieces.find(p => p.id === "front");
    ok(!!frontPiece && frontPiece.check.ok && pv && pv.attach.every(s => inPoly(s.from, denseOf(frontPiece.segs))), "4: 디자인 화면 부착 꼭짓점 = 재단 앞판 폐곡선 안(독립 판정)");
  }

  // ══ §5 DXF ══
  if (PK_HASH) {
    const meta = { version: "t", createdAt: "2026-11-19T00:00:00" };
    const gx = S.DXF.build(P, meta), ax = S.DXF.build(P, meta, { format: "aama" });
    ok(gx.ok && ax.ok, "5: 일반·AAMA DXF 모두 만들어짐" + (gx.ok ? "" : " — " + gx.reason) + (ax.ok ? "" : " — " + ax.reason));
    if (gx.ok && ax.ok) {
      const ps = gx.stats.pieces, pocket = ps.find(p => p.id === "pocket");
      ok(!!pocket && pocket.qty === 1, "5: 일반 DXF 주머니 조각 수량 1");
      ok(!!ax.stats.pieces.find(p => p.id === "pocket" && p.qty === 1), "5: AAMA DXF 주머니 조각 수량 1");
      const E = parseDxf(gx.dxf), cut = E.filter(e => e.type === "POLYLINE" && layerOf(e) === "CUT");
      ok(cut.length === ps.length, "5: 일반 DXF 재단선 폴리라인 수 = 조각 수(내부 표시가 재단선으로 새지 않음)");
      const internal = E.filter(e => layerOf(e) === "INTERNAL");
      ok(internal.length >= 6, "5: 일반 DXF 내부 표시(INTERNAL) 존재 — 접는선·달림선·식서 (" + internal.length + ")");
      const texts = E.filter(e => e.type === "TEXT").map(e => (e.f["1"] || [])[0]);
      ok(texts.some(t => t === "PIECE pocket"), "5: 일반 DXF 글자 PIECE pocket");
      const Ea = parseDxf(ax.dxf), inner8 = Ea.filter(e => layerOf(e) === "8");
      ok(inner8.length >= 6, "5: AAMA 안쪽 선(8 · 자르지 않음) 존재 (" + inner8.length + ")");
      ok(Ea.filter(e => e.type === "POLYLINE" && layerOf(e) === "1").length >= ps.length, "5: AAMA 재단선(1) 폴리라인 존재");
    }
    // 주머니 기본 식서 90° = 앱 선택 → 출력에서 «앱 기본»/APP DEFAULT (기존 조각은 교재 기본/BOOK DEFAULT 유지)
    if (gx.ok && ax.ok) {
      const tg = parseDxf(gx.dxf).filter(e => e.type === "TEXT").map(e => (e.f["1"] || [])[0] || ""), tb = parseDxf(ax.dxf).filter(e => e.type === "TEXT").map(e => (e.f["1"] || [])[0] || "");
      ok(tg.some(t => /APP DEFAULT/.test(t)) && tg.some(t => /BOOK DEFAULT/.test(t)), "5: 일반 DXF 식서 글자 — 주머니 APP DEFAULT · 기존 조각 BOOK DEFAULT 유지");
      ok(tb.some(t => /APP DEFAULT/.test(t)) && tb.some(t => /BOOK DEFAULT/.test(t)), "5: AAMA 식서 글자 — 주머니 APP DEFAULT · 기존 조각 BOOK DEFAULT 유지");
    }
    const pb = S.PRINT.build(P, {}, meta);
    ok(pb.ok && pb.pre.rows.find(r => r.base === "pocket").grain.kind === "default" && /앱 기본값/.test(pb.pre.rows.find(r => r.base === "pocket").grain.basis || "") && pb.pre.rows.filter(r => r.base !== "pocket" && r.grain.kind === "default").every(r => !/앱 기본값/.test(r.grain.basis || "")), "5: 인쇄 사전 점검 grain.basis — 주머니만 앱 기본값");
    ok(pb.ok && pb.pre.rows.some(r => r.base === "pocket" && r.qty.n === 1), "5: 인쇄도 같은 항목 모델(주머니 1장)");
  }

  // ══ §6 저장/열기 ══
  if (PK_HASH) {
    const S2 = makeSession(), v = S2.PF.verifyText(TEXT1);
    ok(v.ok, "6: 주머니 포함 파일 열기 검증 (" + (v.reason || "") + " " + (v.detail || "") + ")");
    if (v.ok) {
      S2.PF.commitCandidate(v.candidate);
      const P2 = S2.P();
      ok(J(P2.working.pocket) === J(P.working.pocket) && v.candidate.ui.subtab === "detail", "6: 열기 후 주머니 설정 동일 · 디테일 탭 복원");
      ok(S2.DR.isCurrentDesignChanged(P2) === false && J(P2.working.designResult.pocket) === SPEC1, "6: 열기 후 Design 완료 유지 · 완료본 pocket 동일");
      ok(J(S2.CUT.derive(P2, true)) === D1, "6: 복원 세션 재단 조각 = 저장 전과 바이트 동일");
      P2.working.pocket.cxFromCfCm = r2(P2.working.pocket.cxFromCfCm - 1);
      ok(S2.DR.isCurrentDesignChanged(P2) === true && S2.PF.buildFileText({ savedAt: "x" }).status.design.changed === true, "6: 열기 뒤 위치를 바꾸면 변경됨(저장 status 도)");
    }
    const old = makeSession("body"), vo = old.PF.verifyText(TEXT0);
    ok(vo.ok, "6: 주머니 없이 쓰던 저장본 그대로 열림 (" + (vo.reason || "") + ")");
    if (vo.ok) { old.PF.commitCandidate(vo.candidate); const Po = old.P();
      ok(!("pocket" in Po.working) && old.DR.isCurrentDesignChanged(Po) === false && Po.working.designResult.hash === H0, "6: 옛 저장본 = pocket 키 없음 · Design 완료·hash 그대로");
      ok(J(old.CUT.derive(Po, true)) === D0, "6: 옛 저장본 재단 조각 = 주머니 전과 바이트 동일"); }
    ok(!S.DP.validateStored({ schema: 1, kind: "other" }).ok && !S.DP.validateStored(Object.assign(S.DP.defaultSpec(), { widthCm: 99 })).ok, "6: 변조·범위 밖 저장 설정 거부(열기 단계 검증과 같은 함수)");
  }

  // ══ §7 해제 · 걸림 · 무효 ══
  if (PK_HASH) {
    const cl = DP.clear(P); ok(cl.ok && cl.removed && !("pocket" in P.working), "7: 주머니 해제 = 키 삭제");
    ok(S.DR.isCurrentDesignChanged(P) === true, "7: 해제 직후 변경됨(완료본에 주머니가 있었음)");
    ok(S.DR.complete(P).ok && P.working.designResult.hash === H0 && !("pocket" in P.working.designResult), "7: 해제 후 재완료 = 처음 hash 로 복귀");
    ok(J(S.CUT.derive(P, true)).replace(/"completedAt":\d+/, "") === D0.replace(/"completedAt":\d+/, ""), "7: 해제 후 재단 조각 = 주머니 전과 같음");
    // 걸림: 몸판 밖
    const before = J(P.working.pocket || null);
    const tests = [["앞중심에 걸침", { cxFromCfCm: 0 }], ["옆선 밖", { cxFromCfCm: 38 }], ["밑단 밖", { topBelowBustCm: 40 }]];
    tests.forEach(([nm, patch]) => {
      const r = DP.apply(P, Object.assign(DP.defaultSpec(), patch));
      ok(!r.ok && typeof r.reason === "string" && r.reason.length > 5 && /직접 바꿔|걸립니다|밖|닿습니다|교차|범위|들어옵니다/.test(r.reason), "7: " + nm + " → 적용 거부 + 이유 (" + (r.reason || "").slice(0, 60) + ")");
    });
    ok(J(P.working.pocket || null) === before && !("pocket" in P.working), "7: 거부 뒤 설정 불변 · 위치를 임의로 옮기지 않음");
    // 정상 적용 후 설정이 무효해지는 경우(저장 설정이 현재 몸판에 안 맞음)
    const ok2 = DP.apply(P, DP.defaultSpec()); ok(ok2.ok, "7: 다시 정상 적용");
    if (ok2.ok) {
      ok(S.DR.complete(P).ok, "7: 재완료");
      P.working.pocket = Object.assign({}, P.working.pocket, { cxFromCfCm: 0 });
      const c = S.DR.check(P);
      ok(!c.ok && c.fails.indexOf("pocket-invalid") >= 0 && typeof c.pocketReject === "string" && c.pocketReject.length > 5, "7: 설정이 무효해지면 Design 완료 검사 거부(pocket-invalid + 이유)");
      const rr = S.DR.complete(P); ok(!rr.ok && rr.reason === "pocket-invalid", "7: Design 재완료 거부");
      const dd = S.CUT.derive(P); ok(dd.state === "changed" && dd.returnTab === "detail" && /주머니/.test(dd.reason), "7: 재단 = 변경됨 · 돌아갈 곳 = 디테일 탭 (" + dd.reason + ")");
      P.working.pocket = Object.assign({}, P.working.pocket, { cxFromCfCm: 11 });
    }
    // 소매 파생 몸판 등 출발 범위 밖은 이유와 함께 거부(순수 평가)
    const ev = DP.evaluate(DP.defaultSpec(), { bodice: null, sleeve: null }); ok(!ev.ok && /몸판/.test(ev.reason), "7: 몸판 완료 전 = 이유 안내");
  }

  // ══ §8 index.html ══
  {
    const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
    ok(/data-subtab-btn="detail"[^>]*>디테일</.test(html) && /data-subtab="detail"/.test(html) && /<!-- \/subtab detail -->/.test(html), "8: 디테일 탭 버튼 · 패널");
    ["selPocketSide", "inpPocketW", "inpPocketH", "inpPocketTip", "inpPocketCx", "inpPocketTop", "inpPocketFold", "btnApplyPocket", "btnClearPocket", "btnPocketBook", "pocketNote", "pocketStatusNote"].forEach(id => ok(html.split('id="' + id + '"').length === 2, "8: id " + id + " 1개"));
    const iP = html.indexOf('src="js/designPocket.js?v='), iR = html.indexOf('src="js/designResult.js?v='), iU = html.indexOf('src="js/ui.js?v='), iPF = html.indexOf('src="js/projectFile.js?v=');
    ok(iP > 0 && iP < iR && iR < iPF && iPF < iU, "8: 스크립트 순서 designPocket → designResult → projectFile → ui");
    ok(/js\/cutPrep\.js\?v=2026112002/.test(html) && /js\/render\.js\?v=2026112101/.test(html) && /css\/style\.css\?v=2026112101/.test(html) && /js\/projectFile\.js\?v=2026112101/.test(html) && /js\/ui\.js\?v=2026112101/.test(html), "8: 캐시 버전 핀(cutPrep · render · style · projectFile · ui = index 실제 값)");
    ok(/js\/cutPrint\.js\?v=2026112002/.test(html) && /js\/cutDxf\.js\?v=2026112002/.test(html), "8: 인쇄·DXF 캐시는 2026112001 (2026-11-20 갱신)");
    ok(!/onclick=/.test(html.slice(html.indexOf('data-subtab="detail"'), html.indexOf("<!-- /subtab detail -->"))), "8: 디테일 패널 inline handler 없음");
  }

  console.log("designPocketCheck: " + PASS + " pass, " + FAIL + " fail");
  fails.slice(0, 40).forEach(f => console.log("  ✗ " + f));
  process.exit(FAIL ? 1 : 0);
})();
function r2(v) { return Math.round(v * 100) / 100; }
