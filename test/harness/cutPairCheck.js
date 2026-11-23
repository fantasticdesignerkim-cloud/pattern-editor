// ══════════════════════════════════════════════
// cutPairCheck.js — 재단 ⑦ 앞판 좌우 한 쌍(투영 계층) · ⑧ 맞춤 표시 7mm I자 · ⑤ 시접 폭 보기 마크업 (2026-11-19)
//   독립 검증: 모듈 코드가 아니라 이 파일 안의 반사 식·DXF 파서·거리 계산으로 대조한다.
//   §1 좌우 외곽·시접선·다트(정리 외곽)·여밈 표시·너치·변 경로 좌표가 세로 축(x→−x)으로 실제 반사 · §2 배치(나란히 · 겹침 없음 · 착용자 기준 이름)
//   §3 수량: 저장 수량 의미 보존(2 → 쌍 · 그 밖 값/나뉜 앞판 → 쌍 아님) · 골 펼친 뒤판·다른 조각 수량 불변 · 같은 시접 편집이 두 조각에 반영
//   §4 DXF(일반·AAMA) 조각별 수량 1 · 같은 형상(반사) · 노치 길이 ≤ 7mm · §5 ⑧ 노치: 재단선에서 안으로 최대 7mm · 좁은 시접은 봉제선에서 멈춤 · 시접 0 = 점
//   §6 ⑤ 마크업(기본값 표시 · 시접 폭 보기 단추 · 카드 가운데 CSS) · 캐시 핀
//   node test/harness/cutPairCheck.js   (이 파일은 Bash 없이 작성돼 아직 실행하지 못했다 — 실행 결과로만 신뢰할 것)
// ══════════════════════════════════════════════
"use strict";
const vm = require("vm"), fs = require("fs"), path = require("path");
let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
process.on("uncaughtException", e => { console.log("cutPairCheck: 예외 — " + (e && e.stack || e).toString().split("\n").slice(0, 4).join(" | ")); fails.slice(0, 20).forEach(f => console.log("  ✗ " + f)); process.exit(1); });
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
    CP: W.collarPresets, CC: W.collarCheckpoint, DC: W.designCollar, DCF: W.designCuff, CUT: W.cutPrep, PRINT: W.cutPrint, DXF: W.cutDxf };
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
function buildShirt() {
  const S = makeSession(), P = start(S);
  // 여밈·안단 1.2/1.2 를 먼저 적용(cutDxfCheck.setPlacket 과 같은 상태 변화: 유효 앞 외곽 → designPlacket.compute → working.frontPlacket)
  const pp = { overlapCm: 1.2, facingWidthCm: 1.2, lengthMode: "full" }, pr0 = S.W.designPlacket.compute(S.BC.effectiveOutline(P, "front"), pp);
  if (pr0.ok) P.working.frontPlacket = { parameters: pp, outline: pr0.outline, construction: pr0.construction };
  const a = pr0.ok && S.BC.complete(P).ok, ra = S.W.sleeveAApply.apply(P, { sleeveLengthCm: 52 });
  const okAll = a && ra && ra.ok && (() => { const x = S.SC.complete(P).ok, pl = setCollarM(S), y = S.CC.complete(P).ok, z = S.DR.complete(P).ok; return x && pl.ok && y && z; })();
  return { S, P, ok: !!okAll };
}
const near = (a, b, e) => typeof a === "number" && typeof b === "number" && Math.abs(a - b) <= (e == null ? 1e-6 : e);
const view = (S, P) => { const d = S.CUT.derive(P, true), m = S.CUT.seam(d, P), D = S.CUT.displayOf(d, m), L = S.CUT.layoutOf(d.pieces, D), Q = S.CUT.qtyOf(d, D, P), G = S.CUT.grainOf(d, D, P); return { d, m, D, L, Q, G }; };
// 독립 반사: x → −x (세로 축 x=0)
const mx = q => ({ x: -q.x, y: q.y });
const ptsOf = s => s.kind === "cubic" ? [s.from, s.c1, s.c2, s.to] : [s.from, s.to];
function segsMirror(a, b) { // a 의 각 선을 반사한 것이 b 와 같은 순서·같은 점인가
  if (!a || !b || a.length !== b.length) return false;
  return a.every((s, i) => s.kind === b[i].kind && ptsOf(s).every((p, k) => { const q = ptsOf(b[i])[k], m = mx(p); return Math.abs(m.x - q.x) < 1e-9 && Math.abs(m.y - q.y) < 1e-9; }));
}
function ptsMirror(a, b) { return !!a && !!b && a.length === b.length && a.every((p, i) => Math.abs(-p.x - b[i].x) < 1e-9 && Math.abs(p.y - b[i].y) < 1e-9); }
const dSeg = (p, a, b) => { const vx = b.x - a.x, vy = b.y - a.y, l2 = vx * vx + vy * vy, t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / l2)) : 0; return Math.hypot(p.x - a.x - vx * t, p.y - a.y - vy * t); };
const dPoly = (p, pts, closed) => { let m = Infinity; const n = pts.length; for (let i = 0; i < (closed ? n : n - 1); i++) m = Math.min(m, dSeg(p, pts[i], pts[(i + 1) % n])); return m; };
const cubP = (s, t) => { const u = 1 - t; return { x: u * u * u * s.from.x + 3 * u * u * t * s.c1.x + 3 * u * t * t * s.c2.x + t * t * t * s.to.x, y: u * u * u * s.from.y + 3 * u * u * t * s.c1.y + 3 * u * t * t * s.c2.y + t * t * t * s.to.y }; };
const denseOf = segs => { const o = []; segs.forEach(s => { const n = s.kind === "cubic" ? 400 : 2; for (let k = 0; k <= n; k++) o.push(s.kind === "cubic" ? cubP(s, k / n) : { x: s.from.x + (s.to.x - s.from.x) * k / n, y: s.from.y + (s.to.y - s.from.y) * k / n }); }); return o; };

// 독립 DXF 파서
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
const layerOf = e => (e.f["8"] || [])[0], num = (e, c, k) => Number((e.f[c] || [])[k || 0]);
const verts = e => e.verts.map(v => ({ x: Number(v.f["10"][0]), y: Number(v.f["20"][0]) }));

(function main() {
  const B = buildShirt(); const { S, P } = B;
  ok(B.ok, "0: 셔츠 완료 사슬이 끝남(이 뒤 검사의 전제)");
  if (!B.ok) return;
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

  // ── §1 반사 ──
  const v0 = view(S, P), D = v0.D, F = D.front, Mi = D["front~m"], pr = v0.m.pairing;
  ok(pr && pr.active && F && Mi, "1: 기본 셔츠 앞판(수량 2)은 좌우 한 쌍으로 투영된다");
  if (!(pr && pr.active && F && Mi)) return;
  ok(segsMirror(F.outline, Mi.outline), "1: 완성선 외곽 = 세로 축 반사(곡선 조절점 포함)");
  ok(ptsMirror(F.seam, Mi.seam), "1: 재단선(시접) 점열 = 반사");
  ok(F.edges.length === Mi.edges.length && F.edges.every((e, i) => e.id === Mi.edges[i].id && e.parts.every((ps, k) => segsMirror(ps, Mi.edges[i].parts[k]))), "1: 변 경로 = 같은 변 id 로 반사(저장 키 그대로)");
  const pF0 = v0.d.pieces.find(p => p.id === "front");
  ok(pF0.placket && near(pF0.placket.overlapCm, 1.2, 1e-9) && near(pF0.placket.facingWidthCm, 1.2, 1e-9) && F.marks.some(mk => mk.kind === "cf") && F.marks.some(mk => /^zone-/.test(mk.kind)), "1: 전제 — 앞판에 여밈·안단 1.2/1.2 가 합성됨(앞중심선·영역 표시 있음)");
  ok(F.marks.length === Mi.marks.length && F.marks.length > 0 && F.marks.every((mk, i) => mk.kind === Mi.marks[i].kind && segsMirror(mk.segs, Mi.marks[i].segs)), "1: 여밈·안단 표시(앞중심·접는선·영역) = 반사");
  ok(F.notches.length === Mi.notches.length && F.notches.every((n, i) => n.id === Mi.notches[i].id && Math.abs(-n.from.x - Mi.notches[i].from.x) < 1e-9 && Math.abs(n.from.y - Mi.notches[i].from.y) < 1e-9 && (!!n.to === !!Mi.notches[i].to) && (!n.to || (Math.abs(-n.to.x - Mi.notches[i].to.x) < 1e-9 && Math.abs(n.to.y - Mi.notches[i].to.y) < 1e-9))), "1: 맞춤 표시 좌표 = 반사 · 같은 너치 id");
  ok((F.trued == null) === (Mi.trued == null) && (!F.trued || segsMirror(F.trued, Mi.trued)) && F.truedDarts.length === Mi.truedDarts.length && F.truedDarts.every((q, i) => ptsMirror(q.cap, Mi.truedDarts[i].cap) && Math.abs(-q.apex.x - Mi.truedDarts[i].apex.x) < 1e-9), "1: 다트(정리 외곽·입구 산·꼭짓점) = 반사");
  const gf = v0.G.pieces.front, gm = v0.G.pieces["front~m"];
  ok(gf && gm && gf.ok === gm.ok && (!gf.ok || (Math.abs(-gf.from.x - gm.from.x) < 1e-9 && Math.abs(-gf.to.x - gm.to.x) < 1e-9 && Math.abs(gf.from.y - gm.from.y) < 1e-9 && near(gm.angleDeg, (180 - gf.angleDeg) % 180, 1e-9))), "1: 식서 위치 반사 · 각도 θ → 180−θ");
  ok(F.mirror === null && Mi.mirror && Mi.mirror.A.x === 0 && Mi.mirror.B.x === 0, "1: 거울 쪽만 클릭 역변환 축을 가진다(원본 쪽은 없음)");
  // 클릭 역변환: 거울 쪽에서 누른 점 → 원본 쪽 호 길이와 같다
  const pFront = v0.d.pieces.find(p => p.id === "front"), eid = pFront.edges.find(e => e.id === "hem" || e.label === "hem") ? "hem" : pFront.edges[0].id;
  const e0 = F.edges.find(e => e.id === eid), mid = e0.parts[0][Math.floor(e0.parts[0].length / 2)].from, midM = mx(mid);
  const a1 = S.CUT.clickArc(pFront, F, eid, mid, false), a2 = S.CUT.clickArc(pFront, Mi, eid, midM, true);
  ok(a1 != null && a2 != null && near(a1, a2, 1e-6), "1: 거울 쪽에서 누른 점의 변 위 위치 = 원본 쪽과 같음(같은 변 편집)");

  // ── §2 배치·이름 ──
  const ord = v0.L.order, iF = ord.indexOf("front"), iM = ord.indexOf("front~m");
  ok(iF >= 0 && iM >= 0 && Math.abs(iF - iM) === 1, "2: 보이는 순서에서 두 앞판이 이웃(나란히)");
  const bx = id => { const r = D[id], p = v0.L.pos[id]; return { x0: r.bbox.minX + p.dx, x1: r.bbox.maxX + p.dx, y0: r.bbox.minY + p.dy, y1: r.bbox.maxY + p.dy }; };
  const bF = bx("front"), bM = bx("front~m");
  ok(bF.x1 <= bM.x0 || bM.x1 <= bF.x0, "2: 두 앞판 상자가 겹치지 않음");
  ok(near(bF.x1 - bF.x0, bM.x1 - bM.x0, 1e-9) && near(bF.y1 - bF.y0, bM.y1 - bM.y0, 1e-9) && near(bF.y0, bM.y0, 1e-6), "2: 같은 크기 · 같은 높이(BL 맞춤)");
  // 착용자 기준 이름: 앞중심(조각 한쪽 끝)이 오른쪽 → 화면 왼쪽 → 착용자 오른쪽
  const xs = []; pFront.segs.forEach(s => ptsOf(s).forEach(q => xs.push(q.x))); const midX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cfX = pr.cfX;   // 앞중심 x (모듈이 고른 값 — 아래에서 조각의 한쪽 끝인지 독립 확인)
  ok(Math.abs(cfX - Math.max(...xs)) <= 2.4 + 1e-6 || Math.abs(cfX - Math.min(...xs)) <= 2.4 + 1e-6, "2: 앞중심은 조각의 한쪽 바깥 끝(여밈·안단 연장 2.4cm 안쪽)");
  const origSide = cfX > midX ? "R" : "L";
  ok(F.side === origSide && Mi.side === (origSide === "R" ? "L" : "R"), "2: 좌우 이름 = 착용자 기준(앞중심이 조각 오른쪽이면 오른앞판) · 원본 쪽 " + origSide);
  ok(/오른앞판/.test(F.side === "R" ? F.label : Mi.label) && /왼앞판/.test(F.side === "L" ? F.label : Mi.label), "2: 조각 이름에 왼앞판 · 오른앞판");
  const leftmost = bF.x0 < bM.x0 ? "front" : "front~m";
  ok(D[leftmost].side === "R", "2: 화면 왼쪽 조각 = 착용자 오른쪽(겉에서 정면)");

  // ── §3 수량·같은 편집 ──
  ok(v0.Q.pieces.front.qty === 1 && v0.Q.inst.front.qty === 1 && v0.Q.inst["front~m"].qty === 1, "3: 앞판 수량 기본 1(= 한 쌍) · 보이는 조각은 각 1장");
  ok(D.back && D.back.unfolded && !D["back~m"] && v0.Q.pieces.back.qty === 1 && Object.keys(D).every(k => !/~m$/.test(k) || /^(front|cuff|sleeve-[A-Za-z0-9-]+)~m$/.test(k)), "3: 골 펼친 뒤판은 그대로 한 장(거울 쌍 아님) · 쌍은 앞판·소매·커프스뿐");
  const sleeveQ = Object.keys(v0.Q.pieces).filter(k => /^sleeve-/.test(k)).map(k => v0.Q.pieces[k].qty);
  ok(sleeveQ.length > 0 && sleeveQ.every(n => n === 1) && Object.keys(D).some(k => /^sleeve-.*~m$/.test(k)) && v0.Q.inst["sleeve-sleeve"] && v0.Q.inst["sleeve-sleeve~m"] && v0.Q.inst["sleeve-sleeve~m"].qty === 1 && D["sleeve-sleeve~m"].side !== D["sleeve-sleeve"].side, "3: 소매 수량 기본 1 · 좌우 한 쌍(각 1장)");
  const w0 = F.bbox.maxX - F.bbox.minX;
  ok(S.CUT.setEdge("front", "side-seam", { kind: "seam", widthCm: 2 }, P).ok, "3: 앞 옆선 시접 2cm 지정");
  const v1 = view(S, P), wF = v1.D.front.bbox.maxX - v1.D.front.bbox.minX, wM = v1.D["front~m"].bbox.maxX - v1.D["front~m"].bbox.minX;
  ok(wF > w0 + 0.5 && near(wF, wM, 1e-9) && ptsMirror(v1.D.front.seam, v1.D["front~m"].seam), "3: 같은 시접 편집이 보이는 두 조각에 함께 반영(반사 유지)");
  // 수량을 사용자가 바꾼 경우: 의미 추정 없이 기존 한 조각
  ok(S.CUT.setQty("front", 3, P).ok, "3: 앞판 수량 3 으로 직접 지정");
  const v2 = view(S, P);
  ok(!v2.m.pairing.active && /3장/.test(v2.m.pairing.reason) && !v2.D["front~m"] && v2.Q.pieces.front.qty === 3 && v2.L.order.indexOf("front~m") < 0 && v2.Q.pieces.front.explicit, "3: 수량 3 = 쌍 아님 · 사유 표시 · 저장 수량 3 그대로 · 거울 조각 없음");
  ok(S.CUT.setQty("front", 2, P).ok && !view(S, P).m.pairing.active && /2장/.test(view(S, P).m.pairing.reason), "3: 수량 2(직접 지정)는 쌍 아님 — 의미 추정 없이 한 조각 2장");
  ok(S.CUT.setQty("front", 1, P).ok && view(S, P).m.pairing.active && view(S, P).Q.pieces.front.explicit, "3: 직접 지정한 1 은 기본과 같은 의미 → 쌍");
  ok(S.CUT.setQty("front", null, P).ok, "3: 수량 기본값으로 되돌림");
  // 이미 나뉜 앞판(요크 등) · 중심 확인 불가 — 순수 함수
  const mk = (id, extra) => Object.assign({ id, label: "앞판", check: { ok: true }, edges: [], segs: [] }, extra || {});
  const pj = { working: {} };
  const split = S.CUT.pairingOf({ pieces: [mk("front"), mk("frontYoke", { label: "앞 요크" })] }, pj);
  ok(!split.active && /나뉘어/.test(split.reason), "3: 앞판이 이미 따로 나뉨 → 쌍 아님");
  const nocf = S.CUT.pairingOf({ pieces: [mk("front")] }, pj);
  ok(!nocf.active && /앞중심/.test(nocf.reason), "3: 앞중심을 확인하지 못하면 쌍 아님");
  const badQty = S.CUT.pairingOf({ pieces: [mk("front")] }, { working: { cutQty: { schema: 1, pieces: { front: 0 } } } });
  ok(!badQty.active && /수량/.test(badQty.reason), "3: 저장 수량을 읽을 수 없으면(잠김) 쌍 아님");
  // 구형 저장 파일: cutQty 없음 · cutSpec 에 앞판 변 키가 이미 있음 → 같은 키가 두 조각에 적용
  ok(v1.m.pieces.front.edges.find(e => e.id === "side-seam").widthCm === 2, "3: 구형 저장(cutSpec 키 front|side-seam)이 새 모델에서도 같은 키로 읽힘");

  // ── §5 ⑧ 노치 7mm ──
  const nt = v1.m.pieces.front.notches.filter(n => n.to && !n.held);
  ok(nt.length > 0, "5: 앞판에 선으로 그려지는 맞춤 표시가 있음");
  const fin = denseOf(v1.D.front.outline), cutPts = v1.D.front.seam;
  nt.forEach(n => {
    const len = Math.hypot(n.to.x - n.from.x, n.to.y - n.from.y);
    ok(len <= 0.3 + 1e-9, "5: 노치 " + n.id + " 길이 ≤ 3mm (" + len.toFixed(4) + ")");
    ok(dPoly(n.to, cutPts, true) < 2e-3, "5: 노치 " + n.id + " 한 끝은 재단선 위");
    ok(dPoly(n.from, fin, false) < dPoly(n.to, fin, false) - 1e-9, "5: 노치 " + n.id + " 는 재단선에서 안(봉제선) 쪽으로");
    ok(near(len, n.lenCm, 1e-9), "5: lenCm = 실제 선 길이");
  });
  const big = nt.find(n => n.seamCm != null && n.seamCm > 0.3 + 1e-9);
  ok(!!big && near(big.lenCm, 0.3, 1e-9) && !big.narrow, "5: 시접이 3mm 보다 넓으면 정확히 7mm (옆선 2cm)");
  // 좁은 시접 0.2cm: 봉제선을 넘지 않는다
  const nId = big.id, nEdge = big.edgeId;
  ok(S.CUT.setEdge("front", nEdge, { kind: "seam", widthCm: 0.2 }, P).ok, "5: 그 변 시접 0.2cm");
  const v3 = view(S, P), n3 = v3.m.pieces.front.notches.find(n => n.id === nId);
  ok(n3 && n3.to && n3.narrow && n3.lenCm <= 0.2 + 0.02 && n3.lenCm > 0.1, "5: 좁은 시접 → 노치가 시접 폭만큼만(" + (n3 && n3.lenCm) + ")");
  ok(n3 && dPoly(n3.from, denseOf(v3.D.front.outline), false) < 2e-3, "5: 좁은 시접 노치의 안쪽 끝 = 봉제선 위(넘지 않음)");
  // 위치 보존: 원래 맞춤 위치(완성선 위 점) 직각선 위에 있음 — 노치 선의 안쪽 끝 방향이 같은 법선
  const dirOf = n => { const L = Math.hypot(n.to.x - n.from.x, n.to.y - n.from.y); return { x: (n.to.x - n.from.x) / L, y: (n.to.y - n.from.y) / L }; };
  const d1 = dirOf(big), d3 = dirOf(n3);
  ok(Math.abs(d1.x * d3.x + d1.y * d3.y) > 0.999, "5: 시접 폭이 달라도 같은 위치·같은 방향(맞춤 위치 보존)");
  // 시접 0 = 점(기존 의미)
  ok(S.CUT.setEdge("front", nEdge, { kind: "seam", widthCm: 0 }, P).ok, "5: 그 변 시접 0");
  const n0 = view(S, P).m.pieces.front.notches.find(n => n.id === nId);
  ok(n0 && !n0.to && /시접 0|골선/.test(n0.why || ""), "5: 시접 0 은 선이 아니라 점(기존 의미 유지)");
  ok(S.CUT.setEdge("front", nEdge, { kind: "seam", widthCm: 1 }, P).ok, "5: 시접 1cm 로 복구");
  ok(S.CUT.NOTCH_MAX_CM === 0.3, "5: 최대 길이 상수 3mm");

  // ── §4 DXF ──
  const meta = { version: "t", createdAt: "2026-11-19T00:00:00" };
  const gx = S.DXF.build(P, meta), ax = S.DXF.build(P, meta, { format: "aama" });
  ok(gx.ok && ax.ok, "4: 일반·AAMA DXF 모두 만들어짐" + (gx.ok ? "" : " — " + gx.reason) + (ax.ok ? "" : " — " + ax.reason));
  if (gx.ok && ax.ok) {
    const ps = gx.stats.pieces, pa = ax.stats.pieces;
    const sideIds = ps.filter(p => p.base === "front").map(p => p.id).sort();
    ok(J(sideIds) === J(["front-left", "front-right"]) && ps.every(p => p.id !== "front"), "4: 일반 DXF = front-right · front-left 각각 한 조각");
    ok(ps.filter(p => p.base === "front").every(p => p.qty === 1), "4: 일반 DXF 앞판 조각별 수량 1");
    ok(J(pa.filter(p => p.base === "front").map(p => p.id).sort()) === J(sideIds) && pa.filter(p => p.base === "front").every(p => p.qty === 1), "4: AAMA 도 같은 두 조각 · 수량 1 (같은 항목 모델)");
    const E = parseDxf(gx.dxf), cutPoly = E.filter(e => e.type === "POLYLINE" && layerOf(e) === "CUT");
    ok(cutPoly.length === ps.length, "4: 일반 DXF 재단선 폴리라인 수 = 조각 수");
    const iR = ps.findIndex(p => p.id === "front-right"), iL = ps.findIndex(p => p.id === "front-left");
    const A = verts(cutPoly[iR]), Bv = verts(cutPoly[iL]), ax0 = Math.min(...A.map(q => q.x)), ax1 = Math.max(...A.map(q => q.x)), bx0 = Math.min(...Bv.map(q => q.x));
    const mA = A.map(q => ({ x: ax1 - q.x, y: q.y }));   // A 를 반사해 왼쪽 끝을 0 에 맞춤
    let same = A.length === Bv.length; Bv.forEach(q => { const r = { x: q.x - bx0, y: q.y }; if (!mA.some(p => Math.abs(p.x - r.x) < 0.01 && Math.abs(p.y - r.y) < 0.01)) same = false; });
    ok(same, "4: 일반 DXF 두 앞판 재단선 = 서로 거울상(같은 형상)");
    const texts = E.filter(e => e.type === "TEXT").map(e => (e.f["1"] || [])[0]);
    ok(texts.filter(t => t === "PIECE front-right").length === 1 && texts.filter(t => t === "PIECE front-left").length === 1 && texts.filter(t => /^QTY 1/.test(t)).length >= 2, "4: 일반 DXF 글자 PIECE front-right/left 각 1 · QTY 1");
    const nl = E.filter(e => e.type === "LINE" && layerOf(e) === "NOTCH").map(e => Math.hypot(num(e, 11) - num(e, 10), num(e, 21) - num(e, 20)));
    ok(nl.length > 0 && nl.every(l => l <= 3 + 1e-3), "4: 일반 DXF 노치 선 길이 모두 ≤ 3mm");
    const Ea = parseDxf(ax.dxf), pts4 = Ea.filter(e => e.type === "POINT" && layerOf(e) === "4"), ln4 = Ea.filter(e => e.type === "LINE" && layerOf(e) === "4");
    ok(pts4.length === 0 && ln4.length > 0 && ln4.every(e => { const l = Math.hypot(num(e, 11) - num(e, 10), num(e, 21) - num(e, 20)); return l > 0 && l <= 3 + 1e-3; }), "4: AAMA 노치 = 레이어 4 I자 선(V자 점 엔티티 없음) · 길이 ≤ 3mm")
    const blocks = Ea.filter(e => e.type === "INSERT").map(e => (e.f["2"] || [])[0]);
    ok(blocks.filter(b => b === "FRONT_RIGHT_BASE").length === 1 && blocks.filter(b => b === "FRONT_LEFT_BASE").length === 1 && blocks.indexOf("FRONT_BASE") < 0, "4: AAMA INSERT = 앞판 오른·왼 각 1 (예전 FRONT_BASE 없음)");
    const aq = Ea.filter(e => e.type === "TEXT").map(e => (e.f["1"] || [])[0]);
    ok(aq.filter(t => /^Piece Name: front-(left|right)$/.test(t)).length === 2 && aq.filter(t => /MIRROR PAIR/.test(t)).length >= 2, "4: AAMA 글자 Piece Name 두 개 · Annotation MIRROR PAIR");
    // 쌍이 아닐 때(수량 3): 예전 한 조각 그대로
    S.CUT.setQty("front", 3, P); const gq = S.DXF.build(P, meta);
    ok(gq.ok && gq.stats.pieces.filter(p => p.base === "front").length === 1 && gq.stats.pieces.find(p => p.base === "front").id === "front" && gq.stats.pieces.find(p => p.base === "front").qty === 3, "4: 수량 3 이면 DXF 도 예전 한 조각 · 수량 3 그대로");
    S.CUT.setQty("front", null, P);
  }
  // 인쇄: 같은 항목 모델
  const pb = S.PRINT.build(P, {}, meta);
  ok(pb.ok && pb.pre.rows.filter(r => r.base === "front").length === 2 && pb.pre.rows.filter(r => r.base === "front").every(r => r.qty.n === 1) && /data-piece="front~m"/.test(pb.sheetSvg) && /data-piece="front"/.test(pb.sheetSvg), "4: 인쇄도 같은 두 항목(각 1장) · 시트에 두 조각");

  // ── §6 ⑤ 마크업·CSS·캐시 ──
  const css = fs.readFileSync(path.join(ROOT, "css", "apple.css"), "utf8");
  ok(/id="cutDefaults"[^>]*>[^<]*1cm[^<]*0cm/.test(html), "6: 선택 없이 보이는 기본값 표시(시접 1cm · 골선 0cm)");
  ok(/id="btnCutWidths"[^>]*aria-pressed="false"/.test(html), "6: 시접 폭 보기 전환 단추");
  ok(/\.cut-seam-card\{[^}]*margin:0 auto[^}]*max-width:560px/.test(css) && /\.cut-seam-card\{left:8px;right:8px;bottom:8px;margin:0/.test(css), "6: 카드 = 하단 가운데(auto 여백) · 좁은 화면은 전체 폭 하단");
  ok(/js\/cutPrep\.js\?v=2026112302/.test(html) && /js\/cutPrint\.js\?v=2026112302/.test(html) && /js\/cutDxf\.js\?v=2026112002/.test(html) && /css\/apple\.css\?v=2026112002/.test(html), "6: 캐시 버전 핀");
  // ── §7 2026-11-20 소매·커프스 좌우 쌍 · C.F / C.B · 가슴선 · 허리선 ──
  {
    const v7 = view(S, P), D7 = v7.D, Q7 = v7.Q, pairs = ["front", "sleeve-sleeve"].concat(D7.cuff ? ["cuff"] : []);   // 이 시험 셔츠에는 커프스가 없다(커프스 쌍은 cutLayoutCheck 가 확인)
    ok(pairs.every(b => D7[b] && D7[b + "~m"] && D7[b].side !== D7[b + "~m"].side && Q7.inst[b].qty === 1 && Q7.inst[b + "~m"].qty === 1 && ptsMirror(D7[b].seam, D7[b + "~m"].seam) && segsMirror(D7[b].outline, D7[b + "~m"].outline)), "7: 앞판·소매·커프스 = 반사 쌍(각 1장 · 재단선·완성선이 x→−x)");
    ok(!D7["back~m"] && !D7["collar-stand~m"] && !D7["collar-body~m"] && Q7.pieces.back.qty === 1 && Q7.pieces["collar-body"].qty === 1 && Q7.pieces["collar-stand"].qty === 1, "7: 골 조각(뒤판·칼라·밴드)은 쌍 아님 · 골 1장");
    ok(Object.keys(Q7.pieces).every(k => Q7.pieces[k].qty === 1), "7: 모든 기본 수량 1");
    const gF = D7.front.guides, gB = D7.back.guides, gM = D7["front~m"].guides, kinds = g => g.map(x => x.kind).sort().join(",");
    ok(kinds(gF) === "bust,cf,waist" && kinds(gB) === "bust,cb,waist" && kinds(gM) === "bust,cf,waist" && !D7["sleeve-sleeve"].guides.length, "7: 앞판 C.F·가슴·허리 · 뒤판 C.B·가슴·허리 · 거울 쪽도 같이 · 소매는 없음");
    const cf = gF.find(g => g.kind === "cf"), cfm = gM.find(g => g.kind === "cf"), bu = gF.find(g => g.kind === "bust"), wa = gF.find(g => g.kind === "waist"), wm = gM.find(g => g.kind === "waist");
    ok(cf.text === "C.F" && near(cf.a.x, cf.b.x, 1e-9) && near(cfm.a.x, -cf.a.x, 1e-9) && near(cfm.tx, -cf.tx, 1e-9) && cfm.text === "C.F", "7: 앞중심 C.F = 세로 직선 · 거울 쪽은 자기 앞중심(x→−x)");
    ok(near(wa.a.y, v7.d.refY.front, 1e-9) && near(wa.a.y, 38, 1e-9) && near(wa.a.y, wa.b.y, 1e-9) && near(bu.a.y, bu.b.y, 1e-9) && bu.a.y > 15 && bu.a.y < 25 && near(wm.a.x, -wa.a.x, 1e-9), "7: 허리선 = 원형 기준 형상 waist 변 높이(38) · 가슴선 = 옆선 위끝 높이 · 둘 다 수평");
    ok(D7.back.guides.find(g => g.kind === "cb").text === "C.B" && D7.back.guides.find(g => g.kind === "cb").line === false, "7: 뒤중심 C.B · 골 펼친 뒤판은 이미 가운데 선이 있어 글자만");
    // DXF · AAMA · 인쇄에 같은 글자·위치
    const g7 = S.DXF.build(P, meta), a7 = S.DXF.build(P, meta, { format: "aama" }), E7 = parseDxf(g7.dxf), A7 = parseDxf(a7.dxf);
    const tx7 = E7.filter(e => e.type === "TEXT" && layerOf(e) === "TEXT").map(e => (e.f["1"] || [])[0]), ax7 = A7.filter(e => e.type === "TEXT" && layerOf(e) === "15").map(e => (e.f["1"] || [])[0]);
    const cnt7 = (arr, t) => arr.filter(x => x === t).length;
    ok(cnt7(tx7, "C.F") === 2 && cnt7(tx7, "C.B") === 1 && cnt7(tx7, "BUST LINE") === 3 && cnt7(tx7, "WAIST LINE") === 3, "7: 일반 DXF TEXT 레이어 = C.F 2(좌우 앞판) · C.B 1 · BUST LINE 3 · WAIST LINE 3");
    ok(cnt7(ax7, "C.F") === 2 && cnt7(ax7, "C.B") === 1 && cnt7(ax7, "BUST LINE") === 3 && cnt7(ax7, "WAIST LINE") === 3, "7: AAMA 레이어 15 글자도 같은 수");
    const pc7 = g7.stats.pieces.map(q => q.id).sort().join(",");
    ok(/sleeve-sleeve-left/.test(pc7) && /sleeve-sleeve-right/.test(pc7) && g7.stats.pieces.every(q => q.qty === 1), "7: DXF 조각 = 소매 좌우 각 1 · 전부 수량 1");
    const intl = E7.filter(e => e.type === "LINE" && layerOf(e) === "INTERNAL").length;
    ok(intl >= 3 * 2 && g7.stats.layers.INTERNAL >= 1, "7: 일반 DXF INTERNAL 레이어에 표시선(가슴·허리) 선 포함");
    const p7 = S.PRINT.build(P, {}, meta);
    ok(p7.ok && (p7.sheetSvg.match(/>C\.F</g) || []).length === 2 && (p7.sheetSvg.match(/>C\.B</g) || []).length === 1 && (p7.sheetSvg.match(/>가슴선</g) || []).length === 3 && (p7.sheetSvg.match(/>허리선</g) || []).length === 3, "7: 인쇄에도 C.F 2 · C.B 1 · 가슴선 3 · 허리선 3");
  }
})();
console.log("cutPairCheck: " + PASS + " 통과 / " + FAIL + " 실패");
fails.forEach(f => console.log("  ✗ " + f));
process.exit(FAIL ? 1 : 0);
