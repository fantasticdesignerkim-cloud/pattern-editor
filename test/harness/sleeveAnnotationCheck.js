// ══════════════════════════════════════════════
// sleeveAnnotationCheck.js — 소매 Ⓐ/Ⓑ/Ⓒ 제작 정보 표시(js/sleeveAnnotation.js · render.js 오버레이 · CSS · 토글 배선) 회귀. 표시 전용 — 형상·완료본·hash 는 건드리지 않는다.
//   (1) 모델 유무(기본 소매·차단 → 없음)  (2) Ⓐ  (3) Ⓑ  (4) Ⓒ — 라벨·치수가 실제 geometry/meta 와 일치(독립 실측)
//   (5) 동기화: EL 변경·라인 전환·소매길이·몸판 변경 · 순수성  (6) 글자 겹침 방지(추정 상자)  (7) 렌더·CSS·토글 배선(정적)
//   node test/harness/sleeveAnnotationCheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");

let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
const J = JSON.stringify;
const ROOT = path.join(__dirname, "..", "..");

let PROJECT = null;
const sandbox = {
  window: {}, console: { log() {}, warn() {} }, Math, JSON, Object, Array, isFinite, structuredClone, Error, Date,
  c2p: (x, y) => [x * 10, y * 10],
  document: { createElementNS: () => ({ setAttribute() {}, appendChild() {} }) }
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
const load = (f) => vm.runInContext(fs.readFileSync(path.join(ROOT, "js", f), "utf8"), sandbox, { filename: f });
sandbox.window.designWorkflow = { current: () => PROJECT };
["designLineTool.js", "designFlare.js", "designJoin.js", "designWaistSeam.js", "designYokeSeam.js", "designPrincess.js", "designBodice.js", "bodicePresets.js",
  "designLayout.js", "designRenderer.js", "bodiceCheckpoint.js", "peplumAnnotation.js", "designSleeve.js", "sleeveMeasure.js", "sleeveCheckpoint.js",
  "designSleeveA.js", "designSleeveB.js", "sleevePresets.js", "sleeveAApply.js", "sleeveBApply.js", "designSleeveC.js", "sleeveCApply.js", "sleeveAnnotation.js"].forEach(load);
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, BC = W.bodiceCheckpoint, SA = W.designSleeveA, SB = W.designSleeveB,
  SP = W.sleevePresets, SAA = W.sleeveAApply, SBA = W.sleeveBApply, DS = W.designSleeve;
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));

const MK = (body) => ({ sourceBlock: { id: "blk", version: 2, schemaVersion: 8, canonicalHash: "abc" }, referenceGeometry: JSON.parse(J(REF)),
  working: { geometry: DB.computeGeometry(REF, { body }), parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body },
    patternLines: [], designOutline: null, frontPlacket: null } });
const presetOf = (sym) => { for (const f of BP.families()) for (const v of f.variants) if (v.symbol === sym) return v.presetId; return null; };
function projectWithBodice(sym) { PROJECT = MK(BP.bodyParams(presetOf(sym))); const r = BC.complete(PROJECT); return r.ok ? PROJECT : null; }
const deepHas = (o, key) => !!o && typeof o === "object" && (Object.prototype.hasOwnProperty.call(o, key) || Object.keys(o).some(k => deepHas(o[k], key)));
const segRoles = (g) => g.outline.map(s => s.role || s.edge || s.kind);

const SC = W.designSleeveC, SCA = W.sleeveCApply, SAN = W.sleeveAnnotation, SCK = W.sleeveCheckpoint;
const f2 = v => (Math.round(v * 100) / 100).toFixed(2), sg = v => (v >= 0 ? "+" : "") + f2(v);
// 독립 측정(모듈과 다른 구현)
const cubicPt = (q, t) => { const u = 1 - t; return { x: u*u*u*q[0].x + 3*u*u*t*q[1].x + 3*u*t*t*q[2].x + t*t*t*q[3].x, y: u*u*u*q[0].y + 3*u*u*t*q[1].y + 3*u*t*t*q[2].y + t*t*t*q[3].y }; };
const pathCubics = (p) => { const out = []; let cur = p.commands[0].points[0]; p.commands.slice(1).forEach(c => { out.push([cur, c.points[0], c.points[1], c.points[2]]); cur = c.points[2]; }); return out; };
const arcQ = (q, N = 2000) => { const f = (t) => { const u = 1 - t, dx = 3 * (u * u * (q[1].x - q[0].x) + 2 * u * t * (q[2].x - q[1].x) + t * t * (q[3].x - q[2].x)), dy = 3 * (u * u * (q[1].y - q[0].y) + 2 * u * t * (q[2].y - q[1].y) + t * t * (q[3].y - q[2].y)); return Math.hypot(dx, dy); }; let s = f(0) + f(1); for (let i = 1; i < N; i++) s += f(i / N) * (i % 2 ? 4 : 2); return s / (3 * N); };
const segArc = (s) => s.kind === "path" ? pathCubics(s).reduce((a, q) => a + arcQ(q), 0) : Math.hypot(s.to.x - s.from.x, s.to.y - s.from.y);
const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const roleSeg = (g, r) => g.outline.filter(s => s.role === r);
const T = (m, id) => { const l = m.lines.find(x => x.id === id) || m.dims.find(x => x.id === id); return l ? l.text : null; };
const allTexts = (m) => m.lines.map(l => ({ id: l.id, text: l.text }) ).concat(m.dims.map(d => ({ id: d.id, text: d.text })));
// 글자 상자(화면 px) — 한글 1.0em, 그 외 0.55em. 앵커·px 오프셋 반영. 겹침 검사용 추정.
function boxes(m, scale) {
  const fs = (cls) => cls === "title" ? 12 : cls === "side" ? 13 : cls === "note" ? 8.5 : 9;
  const wid = (t, f) => Array.from(t).reduce((a, c) => a + (c.charCodeAt(0) > 255 ? 1.0 : 0.55) * f, 0);
  const mk = (id, x, y, anchor, text, f) => { const w = wid(text, f), x0 = anchor === "end" ? x - w : anchor === "middle" ? x - w / 2 : x; return { id, x0, x1: x0 + w, y0: y - f * 0.85, y1: y + f * 0.2 }; };
  const out = [];
  m.lines.forEach(l => out.push(mk(l.id, l.at.x * scale + l.px.dx, l.at.y * scale + l.px.dy, l.anchor, l.text, fs(l.cls))));
  m.dims.forEach(d => { const a = d.axis === "h" ? { x: (d.from.x + d.to.x) / 2, y: d.at } : { x: d.at, y: (d.from.y + d.to.y) / 2 }; out.push(mk(d.id, a.x * scale + d.px.dx, a.y * scale + d.px.dy, d.anchor, d.text, fs("dim"))); });
  return out;
}
const overlaps = (m, scale) => { const b = boxes(m, scale), bad = []; for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) { const p = b[i], q = b[j]; if (p.x0 < q.x1 - 0.5 && q.x0 < p.x1 - 0.5 && p.y0 < q.y1 - 0.5 && q.y0 < p.y1 - 0.5) bad.push(p.id + "×" + q.id); } return bad; };

const P = projectWithBodice("A");
const AHs = P.working.bodiceResult.armholeLengths;
const prev = (proj) => DS.capPrimitives(proj.working.geometry.sleeve);
const capText = (proj, m) => { const pr = prev(proj), ah = proj.working.bodiceResult.armholeLengths; return { b1: "뒤 소매산 " + f2(pr.lengths.back), b2: "AH " + f2(ah.back) + " · 이세 " + sg(pr.lengths.back - ah.back), f1: "앞 소매산 " + f2(pr.lengths.front), f2: "AH " + f2(ah.front) + " · 이세 " + sg(pr.lengths.front - ah.front), tot: "소매산 총 " + f2(pr.lengths.total) + " · AH 총 " + f2(ah.front + ah.back) + " · 이세(실측) 총 " + sg(pr.lengths.total - ah.front - ah.back) }; };

// ── 1. 모델 유무: 기본 소매·차단·몸판 없음 → null (기존 표시 회귀 보존) ──
{
  ok(SAN.buildModel(P) === null, "1: 소매 라인이 없으면(기본 소매) 모델 없음 → 기존 표시 그대로");
  ok(SAN.buildModel(null) === null && SAN.buildModel({ working: {} }) === null, "1: 프로젝트/상태 없음 → null");
  const Q = MK(BP.bodyParams(presetOf("A"))); Q.working.sleeveC = { meta: {}, blocked: null }; ok(SAN.buildModel(Q) === null, "1: 몸판 미완료 → null");
  SCA.apply(P, { sleeveLengthCm: 52, elbowLengthCm: 31.4 }); SCA.reject(P, { reason: "elbow-too-close-to-hem", text: "x" });
  ok(SAN.buildModel(P) === null, "1: 차단 중에는 낡은 형상에 설명을 붙이지 않는다(null)");
  SCA.apply(P, { sleeveLengthCm: 52, elbowLengthCm: 31.4 });
  ok(SAN.buildModel(P) && SAN.buildModel(P).line === "C", "1: Ⓒ 적용 → 모델(line C)");
  SCA.clear(P);
}

// ── 2. 소매 Ⓐ: 공통 설명이 실제 geometry/meta 와 일치 ──
{
  SAA.apply(P, { sleeveLengthCm: 52 });
  const m = SAN.buildModel(P), g = P.working.geometry.sleeve, A = P.working.sleeveA.meta, ct = capText(P, m);
  ok(m && m.line === "A" && m.key === "sleeve" && /^소매 Ⓐ · 기본 패턴/.test(m.title), "2: Ⓐ 패턴명 · 기본 패턴 P.137");
  ok(T(m, "back") === "뒤" && T(m, "front") === "앞" && m.lines.find(l => l.id === "back").cls === "side", "2: 앞/뒤 구분(큰 글자 뒤·앞)");
  ok(m.lines.find(l => l.id === "back").at.x < 0 && m.lines.find(l => l.id === "front").at.x > 0, "2: 뒤 = 소매 중심 왼쪽 · 앞 = 오른쪽(geometry 좌표와 일치)");
  ok(T(m, "sp") === "SP · 소매 중심(결)" && m.marks.find(x => x.id === "sp").at.x === 0 && m.marks.find(x => x.id === "sp").at.y === 0 && D(m.marks.find(x => x.id === "sp").at, DS.capPrimitives(g).splitPoint) < 1e-9, "2: SP 표식 = 소매산 분할점(실측 SP)");
  ok(T(m, "cap-back-1") === ct.b1 && T(m, "cap-back-2") === ct.b2 && T(m, "cap-front-1") === ct.f1 && T(m, "cap-front-2") === ct.f2, "2: 앞뒤 소매산 길이·AH·실제 이세 = geometry 실측: " + ct.b1 + " / " + ct.b2);
  ok(m.lines.find(l => l.id === "block-1").text === ct.tot, "2: 소매산 총·AH 총·이세 총 줄");
  const ua = A.underarm.after, W0 = ua.front.x - ua.back.x;
  ok(T(m, "bicep") === "위팔 기준선(소매폭) " + f2(W0) + " · 소매산 높이 " + f2(ua.back.y) && Math.abs(W0 - A.bicepCm) < 1e-9 && Math.abs(ua.back.y - A.capHeightCm) < 1e-9, "2: 위팔 기준선(소매폭)·소매산 높이 = Ⓐ meta 실제 데이터: " + T(m, "bicep"));
  ok(T(m, "len") === "소매길이 52.00" && m.dims.find(d => d.id === "len").axis === "v" && m.dims.find(d => d.id === "len").at === 0 && m.dims.find(d => d.id === "len").to.y === 52, "2: 소매길이 치수선(SP→소맷부리)");
  const hem = g.outline[3], hemLen = Math.hypot(hem.to.x - hem.from.x, hem.to.y - hem.from.y);
  ok(T(m, "hem") === "소맷부리 " + f2(hemLen) + " (= 소매폭)" && Math.abs(hemLen - W0) < 0.5, "2: 완성 소맷부리 치수 = 실제 소맷부리선 길이: " + T(m, "hem"));
  const bl = g.construction.find(s => s.role === "back-line"), fl = g.construction.find(s => s.role === "front-line");
  ok(T(m, "back-line") === "뒤 기준선 " + f2(D(bl.from, bl.to)) && T(m, "front-line") === "앞 기준선 " + f2(D(fl.from, fl.to)) && Math.abs(D(bl.from, bl.to) - A.lineCm.back) < 1e-3, "2: 뒤/앞 소매산 기준선 길이 = construction 실제 선");
  ok(!m.zones.length && !m.refs.length && m.lines.every(l => !/EL|다트|겹침/.test(l.text)), "2: Ⓐ 에는 EL·다트·겹침 설명이 없다");
  ok(m.lines.find(l => l.id === "block-2").text === "점선·가는 선 = 설명용(재단선 아님) · 남색 실선 = 재단 외곽", "2: 설명용/재단 외곽 구분 문구");
}

// ── 3. 소매 Ⓑ ──
{
  SBA.apply(P, { sleeveLengthCm: 52 });
  const m = SAN.buildModel(P), g = P.working.geometry.sleeve, B = P.working.sleeveB.meta, ct = capText(P, m);
  ok(m && m.line === "B" && /^소매 Ⓑ · 타이트\(소맷부리 W×3\/4 맞댐, P\.41\)$/.test(m.title), "3: Ⓑ 패턴명");
  ok(T(m, "cap-back-1") === ct.b1 && T(m, "cap-front-2") === ct.f2 && m.lines.find(l => l.id === "block-2").text === ct.tot, "3: 앞뒤 소매산·이세 = geometry 실측");
  const hemA = segArc(g.outline[2]);   // 소맷부리 곡선 호 길이(독립 Simpson)
  ok(Math.abs(hemA - B.hemCm) < 2e-3 && T(m, "hem") === "소맷부리 실측 " + f2(B.hemCm), "3: 소맷부리 실측 치수 = 실제 소맷부리 곡선 호 길이(" + hemA.toFixed(4) + ")");
  const tl = m.lines.find(l => l.id === "block-1").text;
  ok(tl === "소맷부리 목표 W×3/4 " + f2(B.hemTargetCm) + " · 실측 " + f2(B.hemCm) + " · 맞댐 ● " + f2(B.closeTotalCm) + " = " + f2(B.closePerCutCm) + " × 2곳" && Math.abs(B.hemTargetCm - 0.75 * B.widthCm) < 1e-9, "3: 목표 W×3/4·실측·맞댐 ● 줄: " + tl);
  const axB = g.construction.find(s => s.role === "cut-axis-back"), axF = g.construction.find(s => s.role === "cut-axis-front");
  ok(Math.abs(m.lines.find(l => l.id === "axis-back").at.x - axB.from.x) < 1e-9 && Math.abs(m.lines.find(l => l.id === "axis-front").at.x - axF.from.x) < 1e-9 && T(m, "axis-back") === "뒤 절개축" && T(m, "axis2-front") === "(반폭 중점)", "3: 뒤/앞 절개축 라벨 위치 = geometry 의 절개축 x");
  ok(T(m, "close-back") === "맞댐 " + f2(B.cuts.back.closeAtHemCm) && T(m, "close-front") === "맞댐 " + f2(B.cuts.front.closeAtHemCm), "3: 절개별 맞댐량 = meta");
  const rf = m.refs.find(r => r.id === "bicep-ref"), ub = B.underarm.before;
  ok(rf && rf.cls === "past" && D(rf.from, ub.back) < 1e-12 && D(rf.to, ub.front) < 1e-12 && /^출발 Ⓐ 위팔선\(참고\) /.test(T(m, "bicep")), "3: Ⓑ 위팔 기준은 «출발 Ⓐ 위팔선(참고, past)» — 현재 아랫점(맞댐 후)과 혼동하지 않는다");
  ok(!m.refs.some(r => /leg|cut/.test(r.id)) && g.construction.some(s => s.role === "cut-leg-back") && m.lines.find(l => l.id === "block-3").text === "점선 = 설명용(맞댐 전 절개축·절개선, 재단선 아님) · 남색 실선 = 재단 외곽", "3: 맞댐 전 절개선(cut-leg)을 모델이 현재 선처럼 다시 그리지 않고 «설명용 점선» 으로 구별 표기");
}

// ── 4. 소매 Ⓒ ──
let MC, GC;
{
  SCA.apply(P, { sleeveLengthCm: 52, elbowLengthCm: 31.4 });
  const m = SAN.buildModel(P), g = P.working.geometry.sleeve, C = P.working.sleeveC.meta; MC = m; GC = g;
  const ct = capText(P, m);
  ok(m && m.line === "C" && m.title === "소매 Ⓒ · 타이트 + 뒤 소맷부리 다트(P.41)", "4: Ⓒ 패턴명");
  ok(T(m, "cap-back-1") === ct.b1 && T(m, "cap-back-2") === ct.b2 && T(m, "cap-front-1") === ct.f1 && T(m, "cap-front-2") === ct.f2, "4: 앞뒤 소매산·AH·이세 = geometry 실측");
  // 소맷부리 구간 = 실제 외곽 직선 구간 길이(독립 실측) — 최종 곡선 호 길이 1:2:1 강제가 아니다(2026-10-08 재해석)
  const O = g.outline, u = C.widthCm * 3 / 16;
  const pcub = (s) => { const o = []; let cur = s.commands[0].points[0]; s.commands.slice(1).forEach(c => { o.push([cur, c.points[0], c.points[1], c.points[2]]); cur = c.points[2]; }); return o; };
  const cbz = (q, t) => { const v = 1 - t; return { x: v*v*v*q[0].x + 3*v*v*t*q[1].x + 3*v*t*t*q[2].x + t*t*t*q[3].x, y: v*v*v*q[0].y + 3*v*v*t*q[1].y + 3*v*t*t*q[2].y + t*t*t*q[3].y }; };
  const len = (s) => { if (s.kind !== "path") return D(s.from, s.to); let t = 0; pcub(s).forEach(q => { let pr = q[0]; for (let i = 1; i <= 4000; i++) { const p = cbz(q, i / 4000); t += D(pr, p); pr = p; } }); return t; };
  const sFrom = (s) => s.kind === "path" ? s.commands[0].points[0] : s.from, sTo = (s) => s.kind === "path" ? s.commands[s.commands.length - 1].points[2] : s.to;
  ok(O.map(s => s.role).join() === "cap,side-seam-front,side-seam-front-lower,hem-front,hem-center,dart-leg-center,dart-leg-outer,hem-back,side-seam-back-lower,side-seam-back", "4: Ⓒ outline 역할 순서");
  ok(T(m, "hem-back") === "뒤 ● " + f2(len(O[7])) && T(m, "hem-center") === "중앙 2● " + f2(len(O[4])) && T(m, "hem-front") === "앞 " + f2(len(O[3])), "4: 소맷부리 구간 라벨 = 실제 외곽 곡선 길이(독립 실측): " + T(m, "hem-back") + " / " + T(m, "hem-center") + " / " + T(m, "hem-front"));
  ok(Math.abs(D(sFrom(O[7]), sTo(O[7])) - u) < 1e-9 && Math.abs(D(sFrom(O[4]), sTo(O[4])) - 2 * u) < 1e-9 && O[7].kind === "path", "4: 뒤 ● · 중앙 2● = 소맷부리÷4 (완성 가정선 두 점 거리 — 곡선은 그 두 점을 잇는다)");
  const dB = m.dims.find(d => d.id === "hem-back"), dC = m.dims.find(d => d.id === "hem-center"), dF = m.dims.find(d => d.id === "hem-front");
  ok(D(dB.from, sTo(O[7])) < 1e-12 && D(dB.to, sFrom(O[7])) < 1e-12 && D(dC.from, sTo(O[4])) < 1e-12 && D(dC.to, sFrom(O[4])) < 1e-12 && D(dF.from, sTo(O[3])) < 1e-12 && D(dF.to, sFrom(O[3])) < 1e-12 && dB.axis === "h", "4: 구간 치수선 끝점 = 실제 외곽 점");
  ok(Math.abs(dC.from.x - dB.to.x) > 4 && Math.abs(dC.from.x - dB.to.x) < 5.2, "4: 뒤 구간과 중앙 구간 사이는 열린 다트(약 4.5cm) — 치수선이 다트 위로 이어지지 않는다");
  const hemSum = len(O[3]) + len(O[4]) + len(O[7]);
  ok(m.lines.find(l => l.id === "block-1").text === "소맷부리 목표 W×3/4 " + f2(C.hemTargetCm) + " · 실측(마무리 곡선) " + f2(hemSum) + " · ● = 소맷부리÷4 = " + f2(u) && Math.abs(hemSum - C.hemCm) < 1e-5, "4: 소맷부리 목표·실측(독립 합)·● 줄");
  ok(/^완성 가정선 구간 뒤 ● 6\.01 · 중앙 2● 12\.02 · 앞 ● 6\.01 \(앞 최종 \d+\.\d\d\)$/.test(m.lines.find(l => l.id === "block-2").text), "4: 완성 가정선 구간 줄: " + m.lines.find(l => l.id === "block-2").text);
  // EL
  ok(T(m, "el") === "EL 31.40" && T(m, "el-2") === "(기본 31.4)" && m.lines.find(l => l.id === "el").at.y === 31.4 && g.construction.find(s => s.role === "elbow-line").from.y === 31.4, "4: EL 현재값 31.40 · 기본 31.4 — EL 선(construction) 위치와 같다");
  // 뒤 열린 다트
  const lc = roleSeg(g, "dart-leg-center")[0], lo = roleSeg(g, "dart-leg-outer")[0], apex = lc.to;
  ok(D(m.marks.find(x => x.id === "apex").at, apex) === 0 && T(m, "apex") === "뒤 다트 꼭짓점(EL)" && apex.y === 31.4, "4: 뒤 다트 꼭짓점 표식 = 실제 두 다리 꼭짓점(EL 위)");
  ok(T(m, "leg-center") === "다리 " + f2(D(lc.from, lc.to)) && T(m, "leg-outer") === "다리 " + f2(D(lo.from, lo.to)) && T(m, "leg-center") === T(m, "leg-outer"), "4: 두 다리 길이 라벨 = 실제 다리 선분 길이(같다)");
  ok(T(m, "dart-width") === "벌어짐 " + f2(D(lc.from, lo.to)) && T(m, "dart-drop") === "다리끝 소맷부리선 아래 1" && Math.abs(D(lc.from, lo.to) - C.back.dartOpenCm) < 1e-12, "4: 다트 벌어짐 라벨 = 두 다리 끝 간격 · 다리끝 1cm 내림 표기");
  ok(m.lines.find(l => l.id === "leg-outer").at.x < apex.x && m.lines.find(l => l.id === "leg-center").at.x > apex.x - 1e-9 === true, "4: 다리 라벨은 각 다리 중점에 붙는다");
  // 앞 EL 절개 겹침 · 소매구 연장
  ok(T(m, "lap") === "앞 EL 절개 겹침 " + f2(C.front.overlapCm) && T(m, "lap-2") === "→ 소매구 연장 " + f2(C.front.extensionCm) && Math.abs(C.front.overlapCm - C.front.extensionCm) < 2e-3, "4: 앞 EL 절개 겹침·소매구 연장 라벨: " + T(m, "lap") + " " + T(m, "lap-2"));
  const z = m.zones.find(x => x.id === "lap");
  ok(z && z.cls === "zone" && z.pts.length === 3 && D(z.pts[0], C.front.elCut.from) === 0 && D(z.pts[1], C.front.elCut.to) === 0 && D(z.pts[2], C.front.elCut.lowerOuter) === 0, "4: 겹침은 음영(zone) — EL 절개선 쐐기(처리 과정)");
  ok(!O.some(s => /lap|zone|cut-edge/.test(s.role || "")) && g.construction.map(s => s.role).sort().join() === "center-line,cut-axis-back,cut-axis-front,elbow-line,front-axis-lower", "4: 겹침·EL 절개 내부선은 geometry 에 없다(음영 설명) · 앞 EL→소매구 맞댐선은 표시");
  ok(T(m, "axis-lower") === "앞 맞댐선(EL→소매구)" && T(m, "ext") === "소매구 연장 " + f2(C.front.extensionCm) && T(m, "ext-2") === "(점선 = 연장 전)", "4: 앞 맞댐선 이름 · 소매구 연장 라벨");
  const ez = m.zones.find(x => x.id === "ext"), er = m.refs.find(x => x.id === "ext-before");
  ok(ez && ez.cls === "zone" && ez.pts.length === C.front.extension.zone.length && er && er.cls === "past" && D(er.from, C.front.outerCornerBeforeExtension) === 0 && m.leaders.some(x => x.id === "ext"), "4: 소매구 연장 영역 음영 · 연장 전 기준선(점선) · 리더선");
  ok(m.lines.find(l => l.id === "block-4").text.indexOf("옆선 앞 " + f2(C.seams.frontCm) + " · 뒤 " + f2(C.seams.backCm)) === 0 && /2\.00cm 재제도\(임시 시작 설정\)$/.test(m.lines.find(l => l.id === "block-4").text) && m.lines.find(l => l.id === "block-5").text === "점선·음영 = 설명용(재단선 아님, 겹침은 처리 과정) · 남색 실선 = 재단 외곽", "4: 옆선·재제도 줄 · 설명용/재단 외곽 구분 문구");
  ok(T(m, "axis-back") === "뒤 맞댐(EL 까지)" && T(m, "axis-back-2") === "쐐기 EL 폭 " + f2(C.derivation.backWedge.D) && T(m, "axis-front-2") === "(EL 간격 1)" && m.lines.find(l => l.id === "axis-back").at.x === C.axes.back.x, "4: 뒤/앞 맞댐 라벨 위치 = meta 축 · 쐐기 폭");
  ok(!JSON.stringify(m).includes("⊠") && !/드래프|rigid|raw|fairing|compensation/.test(JSON.stringify(m)), "4: 해석 미확정 ⊠ 수치·내부 디버그(raw·정리 보정)를 표시하지 않는다");
  ok(m.dims.every(d => /^(h|v)$/.test(d.axis)) && m.lines.every(l => typeof l.text === "string" && l.text.length > 0), "4: 모델 형식(치수선 축·글자)");
}

// ── 5. 동기화: EL 변경·라인 전환·소매길이·몸판 변경 후 라벨이 같은 geometry 를 따른다 ──
{
  const snapJ = J(P.working.geometry.sleeve);
  SCA.apply(P, { sleeveLengthCm: 52, elbowLengthCm: 29 });
  const m = SAN.buildModel(P), g = P.working.geometry.sleeve, lc = roleSeg(g, "dart-leg-center")[0];
  ok(T(m, "el") === "EL 29.00" && T(m, "el-2") === "(기본 31.4)" && m.lines.find(l => l.id === "el").at.y === 29 && D(m.marks.find(x => x.id === "apex").at, lc.to) === 0 && lc.to.y === 29, "5: EL 29 → EL 라벨·EL 선·다트 꼭짓점 표식 이동(기본 31.4 병기)");
  ok(T(m, "leg-center") === "다리 " + f2(D(lc.from, lc.to)) && T(m, "leg-center") !== T(MC, "leg-center"), "5: EL 변경 → 다리 길이 라벨이 새 geometry 를 따른다");
  ok(J(g) !== snapJ, "5: geometry 자체도 바뀌었다(라벨만 바뀐 것이 아님)");
  SCA.apply(P, { sleeveLengthCm: 58, elbowLengthCm: 31.4 });
  const m2 = SAN.buildModel(P);
  ok(T(m2, "len") === "소매길이 58.00" && m2.dims.find(d => d.id === "len").to.y === 58 && T(m2, "hem-front") === "앞 " + f2(P.working.sleeveC.meta.sections.final.frontOuter), "5: 소매길이 58 → 소매길이 치수선·구간 라벨 갱신");
  // 라인 전환
  SCA.clear(P); SBA.apply(P, { sleeveLengthCm: 52 }); ok(SAN.buildModel(P).line === "B" && /Ⓑ/.test(SAN.buildModel(P).title), "5: Ⓒ→Ⓑ 전환 → Ⓑ 모델");
  SBA.clear(P); SAA.apply(P, { sleeveLengthCm: 52 }); ok(SAN.buildModel(P).line === "A", "5: Ⓑ→Ⓐ 전환 → Ⓐ 모델");
  SAA.clear(P); ok(SAN.buildModel(P) === null, "5: 기본 소매로 → 모델 없음(기존 표시)");
  SCA.apply(P, { sleeveLengthCm: 52, elbowLengthCm: 31.4 });
  ok(J(SAN.buildModel(P)) === J(MC), "5: Ⓒ 로 되돌아오면 처음과 같은 모델(결정론)");
  // 몸판 변경 → 재제도 → 새 geometry 기준
  const old = J(MC);
  P.working.parameters = { neckline: P.working.parameters.neckline, body: BP.bodyParams(presetOf("I")) };
  P.working.geometry = DB.computeGeometry(P.referenceGeometry, { body: BP.bodyParams(presetOf("I")) });
  BC.complete(P); SCA.rederive(P);
  const m3 = SAN.buildModel(P), ct3 = capText(P, m3);
  ok(m3 && T(m3, "cap-back-1") === ct3.b1 && T(m3, "cap-front-2") === ct3.f2 && J(m3) !== old, "5: 몸판 변경·재제도 후 라벨이 새 geometry/AH 실측을 따른다");
  // 순수성
  const before = { sc: J(P.working.sleeveC), geo: J(P.working.geometry.sleeve), b: J(P.working.bodiceResult) }; const h0 = SCK.complete(P).result.hash;
  SAN.buildModel(P); SAN.buildModel(P);
  ok(J(P.working.sleeveC) === before.sc && J(P.working.geometry.sleeve) === before.geo && J(P.working.bodiceResult) === before.b && SCK.complete(P).result.hash === h0, "5: buildModel 은 상태·geometry·몸판·완료본 hash 를 바꾸지 않는다(표시 전용)");
  ok(!("outline" in m3) && !("construction" in m3) && !deepHas(m3, "hash"), "5: 모델에 outline/construction/hash 가 없다(형상 아님)");
}

// ── 6. 화면 배치(layout): 겹침 방지·정보 보존·번호 설명·fit 여백 — 실제 화면 배율(px/cm) 3~30 ──
{
  const Q = projectWithBodice("A"); const rows = [];
  SAA.apply(Q, { sleeveLengthCm: 52 }); rows.push(["A", SAN.buildModel(Q)]); SAA.clear(Q);
  SBA.apply(Q, { sleeveLengthCm: 52 }); rows.push(["B", SAN.buildModel(Q)]); SBA.clear(Q);
  SCA.apply(Q, { sleeveLengthCm: 52, elbowLengthCm: 31.4 }); rows.push(["C", SAN.buildModel(Q)]);
  SCA.apply(Q, { sleeveLengthCm: 52, elbowLengthCm: 29 }); rows.push(["C29", SAN.buildModel(Q)]);
  SCA.apply(Q, { sleeveLengthCm: 58, elbowLengthCm: 33 }); rows.push(["C58", SAN.buildModel(Q)]);
  const fsOf = (c) => c === "title" ? 12 : c === "side" ? 13 : c === "note" ? 8.5 : 9, wid = (t, f) => Array.from(t).reduce((a, c) => a + (c.charCodeAt(0) > 255 ? 1.0 : 0.55) * f, 0);   // 독립 추정(모듈보다 좁게 — 모듈은 0.58)
  const boxOf = (x, y, an, t, f) => { const w = wid(t, f), x0 = an === "end" ? x - w : an === "middle" ? x - w / 2 : x; return { x0, x1: x0 + w, y0: y - f * 0.85, y1: y + f * 0.2 }; };
  const SCALES = [3, 4, 5, 6, 8, 10, 12, 20, 30];
  rows.forEach(([k, m]) => SCALES.forEach(sc => {
    const L = SAN.layout(m, sc), bx = [];
    L.items.forEach(t => bx.push({ id: t.id, ...boxOf(t.at.x * sc + t.dx, t.at.y * sc + t.dy, t.anchor, t.text, fsOf(t.dim ? "dim" : t.cls)) }));
    L.tags.forEach(t => bx.push({ id: "tag" + t.n, x0: t.at.x * sc + t.dx - 6.5, x1: t.at.x * sc + t.dx + 6.5, y0: t.at.y * sc + t.dy - 6.5, y1: t.at.y * sc + t.dy + 6.5 }));
    const bad = []; for (let i = 0; i < bx.length; i++) for (let j = i + 1; j < bx.length; j++) { const p = bx[i], q = bx[j]; if (p.x0 < q.x1 - 0.5 && q.x0 < p.x1 - 0.5 && p.y0 < q.y1 - 0.5 && q.y0 < p.y1 - 0.5) bad.push(p.id + "×" + q.id); }
    ok(bad.length === 0, "6: " + k + " 글자·번호 표식 겹침 없음 @" + sc + "px/cm " + bad.slice(0, 4).join());
    // 정보 보존: 모델의 모든 글자가 제자리 글자이거나 번호 설명 안에 있다(조용한 생략 없음)
    const orig = m.lines.map(l => l.text).concat(m.dims.map(d => d.text)), have = L.items.map(t => t.text), leg = L.legend.map(e => e.text).join(" ");
    const lost = orig.filter(t => !have.includes(t) && leg.indexOf(t) < 0);
    ok(lost.length === 0, "6: " + k + " 모든 설명이 제자리 또는 번호 설명에 있다 @" + sc + " " + lost.slice(0, 2).join("|"));
    ok(L.legend.length === 0 || (L.compact && L.items.some(t => /번호\(/.test(t.text)) && L.tags.length === L.legend.length), "6: " + k + " 번호 설명이 있으면 안내 문구·표식 수가 일치 @" + sc);
    if (sc >= 8) ok(L.legend.length === 0 && !L.compact, "6: " + k + " 일반 배율(≥8px/cm)에서는 번호 설명 없이 제자리 표시 @" + sc);
    const e = L.extent; ok(e.top >= 0 && e.bottom > 40 && e.left >= 0 && e.right >= 0, "6: " + k + " 설명 여백(extent) 계산 @" + sc + " " + JSON.stringify(e).slice(0, 60));
  }));
  // 번호 설명 경로 자체를 검증: 작은 상자 공간을 강제하는 합성 모델(모든 후보가 막힌 경우)
  const dense = { key: "sleeve", line: "C", title: "t", bbox: { minX: 0, maxX: 2, minY: 0, maxY: 2 }, dims: [], leaders: [], zones: [], refs: [], marks: [],
    lines: Array.from({ length: 40 }, (_, i) => ({ id: "x" + i, at: { x: (i % 2) * 0.1, y: 0.05 }, px: { dx: 0, dy: 0 }, anchor: "middle", text: "필수 설명 " + i + " 아주 긴 글자", cls: "label", group: "x" + i }))
      .concat([{ id: "block-0", at: { x: 0, y: 2 }, px: { dx: 0, dy: 56 }, anchor: "middle", text: "제목", cls: "title", group: "block", block: 0 }, { id: "block-1", at: { x: 0, y: 2 }, px: { dx: 0, dy: 68 }, anchor: "middle", text: "구분 문구", cls: "note", group: "block", block: 1 }]) };
  const LD = SAN.layout(dense, 3);
  ok(LD.legend.length > 0 && LD.compact && LD.items.some(t => /번호\(/.test(t.text)) && dense.lines.filter(l => l.block === undefined).every(l => LD.items.some(t => t.text === l.text) || LD.legend.some(e => e.text.indexOf(l.text) >= 0)), "6: 공간이 물리적으로 모자라면 번호 표식 + 아래 번호 설명으로 모은다(" + LD.legend.length + "개) — 생략 없음");
  ok(LD.items.some(t => t.text === "구분 문구") && LD.items.filter(t => /^legend-\d+$/.test(t.id)).length === LD.legend.length, "6: 번호 설명 줄 수 = 표식 수 · 설명용 구분 문구 유지");
  // fit 여백 훅: overhang(project, scale) = layout extent(≥0), 소매 라인 없으면 0
  const Z = SAN.overhang(Q, 8), Z0 = SAN.overhang(MK(BP.bodyParams(presetOf("A"))), 8);
  ok(Z.bottom > 60 && Z.top > 30 && J(Z0) === J({ top: 0, bottom: 0, left: 0, right: 0 }), "6: fit 여백(overhang) — 소매 제목/치수 블록·소매산 글자 포함, 소매 라인 없으면 0");
  const A0 = SAN.overhang(Q, 3), A1 = SAN.overhang(Q, 12);
  ok(A0.left > A1.left, "6: 작은 배율일수록 설명이 소매 폭보다 넓어져 좌우 여백이 커진다(fit 이 그만큼 더 줄인다)");
}

// ── 7. 렌더·CSS·배선(정적) ──
{
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8"), ui = fs.readFileSync(path.join(ROOT, "js", "ui.js"), "utf8"), rn = fs.readFileSync(path.join(ROOT, "js", "render.js"), "utf8"), css = fs.readFileSync(path.join(ROOT, "css", "style.css"), "utf8");
  const pos = f => html.indexOf('src="js/' + f);
  ok(pos("peplumAnnotation.js") > 0 && pos("sleeveAnnotation.js") > pos("peplumAnnotation.js") && pos("sleeveAnnotation.js") < pos("ui.js"), "7: index.html 스크립트 등록(sleeveAnnotation — peplumAnnotation 다음, ui.js 앞)");
  const ver = f => (html.match(new RegExp('src="js/' + f.replace(".", "\\.") + '\\?v=(\\d+)"')) || [])[1];
  ok(ver("sleeveAnnotation.js") === "2026100901" && ver("render.js") === "2026100902" && ver("designLayout.js") === "2026100701" && /css\/style\.css\?v=2026100702/.test(html) && ver("ui.js") === "2026100902", "7: 캐시 버전 갱신(sleeveAnnotation 2026100901 · render/css 2026100702 · ui 2026100703)");
  ok(/<input type="checkbox" id="chkSleeveRef">\s*원형 소매 비교</.test(html) && !/id="chkSleeveRef"[^>]*checked/.test(html), "7: 원형 소매 비교 토글(chkSleeveRef) 기본 꺼짐");
  { const rj = fs.readFileSync(path.join(ROOT, "js", "render.js"), "utf8"), uj = fs.readFileSync(path.join(ROOT, "js", "ui.js"), "utf8");
    ok(/getElementById\("chkSleeveRef"\)/.test(rj) && /pc === "sleeve" && !\(_slvRefChk && _slvRefChk\.checked\)\) \{ grp\.setAttribute\("display", "none"\)/.test(rj), "7: render — 원형 소매 참고 레이어만 꺼짐일 때 숨김(앞/뒤 참고선 무관)");
    ok(/chkSleeveRef\.addEventListener\("change", \(\) => \{ if \(typeof render === "function"\) render\(\); \}\)/.test(uj), "7: 토글 변경 → 다시 그리기"); }
  ok(/id="rowSleeveInfo"[^>]*hidden/.test(html) && /type="checkbox" id="chkSleeveInfo" checked/.test(html) && />\s*제작 정보 표시</.test(html), "7: 설명 표시 토글(chkSleeveInfo) 기본 켜짐·소매 라인 있을 때만 보임");
  const dl = fs.readFileSync(path.join(ROOT, "js", "designLayout.js"), "utf8");
  ok(/function withSleeveOverhang\(u, geometry, L\)/.test(dl) && /u = withSleeveOverhang\(u, p\.working\.geometry, L\)/.test(dl) && /typeof hook !== "function" \|\| !u\) return u/.test(dl) && /if \(!oh\) return u/.test(dl), "7: designLayout.fitUnion 이 소매 설명 여백을 포함(훅 없음/토글 OFF/모델 없음이면 기존 fit 그대로)");
  ok(/window\.sleeveAnnotationOverhang = function \(scale\)/.test(ui) && /\(chk && !chk\.checked\)/.test(ui) && /!sleeveLineOn\(project\)\) return null/.test(ui), "7: ui.js fit 훅 — 토글 OFF·소매 라인 없음이면 null");
  ok(/chkSleeveInfo/.test(ui) && /infoRow\.hidden = !\(project && sleeveLineOn\(project\)\)/.test(ui), "7: ui.js 토글 변경 → 재렌더 · 행 표시는 소매 라인(Ⓐ/Ⓑ/Ⓒ)일 때만");
  ok(/window\.sleeveAnnotation\.layout\(model, sc\)/.test(rn) && /data-anno-compact/.test(rn) && /function _appendSleeveAnnotation\(grp, model\)/.test(rn) && /pc === "sleeve" && window\.sleeveAnnotation/.test(rn) && /const _sm = window\.sleeveAnnotation\.buildModel\(dp\);\s*if \(_sm\)/.test(rn), "7: render.js — 소매 피스에서만 모델이 있을 때만 오버레이(기본 소매는 기존 경로)");
  ok(/_slvInfoChk\.checked\) _appendSleeveAnnotation/.test(rn) && /setAttribute\("data-sleeve-line", _sm\.line\)/.test(rn), "7: 토글 OFF 면 설명 오버레이만 생략(재단 외곽 불변) · data-sleeve-line 은 모델이 있을 때만");
  ok(/\.sleeve-anno\{pointer-events:none\}/.test(css) && /sleeve-anno-dim\{stroke:#0E7490/.test(css) && /sleeve-anno-zone\{fill:rgba\(14,116,144,\.10\)/.test(css) && /\.design-working\[data-sleeve-line\] \[data-geometry-role="construction"\]\{stroke:#0E7490/.test(css), "7: CSS — 설명용 = 청록 점선/치수선/음영, 소매 라인 construction 도 청록(재단 외곽 남색 실선과 구분), pointer-events 없음");
  ok(/\.design-working line,\.design-working path\{stroke:var\(--navy\);fill:none\}/.test(css) && !/\.design-working \[data-geometry-role="outline"\]\{[^}]*0E7490/.test(css), "7: 재단 외곽 스타일(남색)은 건드리지 않았다");
  const tx = fs.readFileSync(path.join(ROOT, "js", "sleeveAnnotation.js"), "utf8");
  ok(!/document\.|localStorage|sessionStorage/.test(tx.replace(/\/\/.*$/gm, "")) && !/\.(sleeveA|sleeveB|sleeveC|geometry)\s*=[^=]/.test(tx.replace(/\/\/.*$/gm, "")), "7: sleeveAnnotation 은 DOM·storage 미접근 · 상태/geometry 를 쓰지 않는다");
  const dr = fs.readFileSync(path.join(ROOT, "js", "designRenderer.js"), "utf8");
  ok(!/sleeveAnnotation|sleeve-anno/.test(dr), "7: designRenderer(재단 외곽 렌더)는 주석을 모른다");
}

console.log("══════════════════════════════════════════════");
if (FAIL) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); }
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
