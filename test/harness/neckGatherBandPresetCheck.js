// ══════════════════════════════════════════════
// neckGatherBandPresetCheck.js — 몸판 프리셋 Ⓛ(목둘레 개더 + 중심 평행 띠, P.25 · 처리 방법 P.161) 회귀.
//
// 책(P.25): «Ⓚ 와 같은 방법으로 다트를 닫아 목둘레를 벌리고, 다시 앞뒤 중심에 개더 분량을 평행으로 추가» · 개더 분량 뒤 ∅×1.5 · 앞 ●×2 ·
//   앞 중심 추가량 ☒ = ●×2 − ■. 사용자 확정(2026-10-04 A안): ■ = 그 쐐기의 틈 → ☒ = 총 개더 분량 − 쐐기 틈(앞 ● · 뒤 0.5∅).
//   도해 «7 정도»(앞)는 산식·실측과 맞고 «5 정도»(뒤)는 양립하지 않아 확정 수치로 쓰지 않는다.
//   (1) 카탈로그·계약·키 분리 (2) 절개·다트각 (3) 띠 폭 ☒ = 총 분량 − 틈 (4) 총 개더 분량 보존·봉제 목둘레 (5) 물리 (6) 원자적 거부
//   (7) Ⓐ~Ⓥ 바이트 불변(HEAD 1d2f1df 에서 측정) (8) 표시 정보 (9) 체크포인트·변조 거부 (10) 소비자 불변
//   node test/harness/neckGatherBandPresetCheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
function throwsReason(fn, want, name) {
  try { fn(); FAIL++; fails.push(name + " (throw 안 됨)"); }
  catch (e) {
    const got = (e.reason || "") + " " + (e.detail !== undefined ? JSON.stringify(e.detail) : "");
    if (want && got.indexOf(want) < 0) { FAIL++; fails.push(`${name} (reason=${got}, 기대=${want})`); }
    else PASS++;
  }
}
const J = JSON.stringify;
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const clone = (v) => JSON.parse(JSON.stringify(v));
const sha = (v) => crypto.createHash("sha256").update(J(v)).digest("hex").slice(0, 12);

let PROJECT = null;
const sandbox = {
  window: {}, console: { log() {}, warn() {} }, Math, JSON, Object, Array, isFinite, structuredClone, Error, Date,
  c2p: (x, y) => [x * 10, y * 10],
  document: { createElementNS: (ns, tag) => ({ tag, attrs: {}, kids: [], setAttribute(k, v) { this.attrs[k] = v; }, appendChild(c) { this.kids.push(c); } }) }
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
const load = (f) => vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "..", "js", f), "utf8"), sandbox, { filename: f });
sandbox.window.designWorkflow = { current: () => PROJECT };
["designLineTool.js", "designFlare.js", "designJoin.js", "designWaistSeam.js", "designYokeSeam.js", "designPrincess.js", "designBodice.js", "bodicePresets.js",
  "designLayout.js", "designRenderer.js", "bodiceCheckpoint.js", "peplumAnnotation.js"].forEach(load);
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, DF = W.designFlare, BC = W.bodiceCheckpoint, T = W.designLineTool, DR = W.designRenderer;
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));
const SNAP = J(REF);

const segsOf = (outline) => T.outlinePrimsToSegs(outline);
const areaOf = (segs) => { const pts = []; T.flattenLine(segs).forEach(ab => { if (!pts.length) pts.push(ab[0]); pts.push(ab[1]); }); let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p.x * q.y - q.x * p.y; } return Math.abs(a / 2); };
const lenOf = (segs) => T.flattenLine(segs).reduce((s, ab) => s + D(ab[0], ab[1]), 0);
function ringOf(outline, eps = 1e-6) {
  const segs = segsOf(outline), used = segs.map(() => false); used[0] = true; const out = [segs[0]]; let tip = segs[0].to;
  for (let k = 1; k < segs.length; k++) {
    let hit = -1, rev = false;
    for (let j = 0; j < segs.length; j++) { if (used[j]) continue; if (D(segs[j].from, tip) < eps) { hit = j; break; } if (D(segs[j].to, tip) < eps) { hit = j; rev = true; break; } }
    if (hit < 0) return null; used[hit] = true; const sg = rev ? T.reverseSeg(segs[hit]) : segs[hit]; out.push(sg); tip = sg.to;
  }
  return D(tip, out[0].from) < eps ? out : null;
}
const selfCross = (ring) => {
  const f = []; ring.forEach(s => T.flattenLine([s]).forEach(ab => f.push(ab)));
  for (let i = 0; i < f.length; i++) for (let j = i + 2; j < f.length; j++) {
    if (i === 0 && j === f.length - 1) continue;
    if (!T.segCross(f[i][0], f[i][1], f[j][0], f[j][1])) continue;
    const t = (a, b) => D(a, b) < 1e-6;
    if (t(f[i][1], f[j][0]) || t(f[j][1], f[i][0]) || t(f[i][0], f[j][0]) || t(f[i][1], f[j][1])) continue;
    return true;
  }
  return false;
};
const cubicHems = (pc) => pc.outline.filter(p => p.edge === "hem" && p.kind === "path");
const endsOfPrim = (p) => { const pts = []; p.commands.forEach(c => c.points.forEach(q => pts.push(q))); return [pts[0], pts[pts.length - 1]]; };
const edgeLen = (pc, edge) => lenOf(segsOf(pc.outline.filter(p => p.edge === edge)));
const MK = (body, g) => ({ sourceBlock: { version: 2, schemaVersion: 8 }, referenceGeometry: REF,
  working: { geometry: g || DB.computeGeometry(REF, { body }), parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body },
    patternLines: [], designOutline: null, frontPlacket: null } });

const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const L_BODY = BP.bodyParams("bunka-bodice-L"), K_BODY = BP.bodyParams("bunka-bodice-K"), I_BODY = BP.bodyParams("bunka-bodice-I");
const BASE_BODY = Object.assign({}, L_BODY); delete BASE_BODY.neckGatherBand;   // Ⓑ 몸판
const GL = DB.computeGeometry(REF, { body: L_BODY }), GK = DB.computeGeometry(REF, { body: K_BODY }), GB = DB.computeGeometry(REF, { body: BASE_BODY });
const A = W.peplumAnnotation;
const ths = { front: 18.25, back: 11.38 }, RATIO = { front: 2, back: 1.5 }, ARC = { front: 4, back: 3 };
const isSlit = (p) => !!(p.dart && p.dart.id === "neck-gather-1");
const neckSum = (pc) => lenOf(segsOf(pc.outline.filter(p => p.edge === "neckline")));
const centerRun = (pc) => {   // 중심선의 두 끝 — 외곽을 도는 방향과 무관하게 y 가 작은 쪽(목둘레 쪽)부터 [위, 아래]
  const pts = []; segsOf(pc.outline.filter(p => p.edge === "center")).forEach(s => { pts.push(s.from, s.to); });
  const top = pts.reduce((a, b) => (b.y < a.y ? b : a)), bot = pts.reduce((a, b) => (b.y > a.y ? b : a));
  return [{ from: top, to: bot }];
};

// ── 1. 카탈로그 · 계약 · 키 분리 ──
{
  const fam = BP.family("neck-gather"), vL = fam.variants.find(v => v.symbol === "L");
  ok(vL && vL.availability === "available" && vL.presetId === "bunka-bodice-L", "1: Ⓛ 실행 가능");
  ok(BP.resolve("neck-gather", "bunka-bodice-L").presetId === "bunka-bodice-L", "1: resolve Ⓛ");
  ok(J(L_BODY) === J({ hemExtensionBelowWaistCm: 20, hemSideOffsetCm: 1, waistDartScales: { a: 0, b: 0, d: 0, e: 0 }, neckGatherBand: true }), "1: Ⓛ = Ⓑ 몸판 + neckGatherBand(Ⓚ·턱 키 없음)");
  ok(!("neckGather" in L_BODY) && !("neckTuck" in L_BODY) && !("neckGatherBand" in K_BODY), "1: Ⓚ·Ⓛ·턱 키 분리");
  ok(J(BP.get("bunka-bodice-L").body) === J(L_BODY), "1: 프리셋 레코드 일치");
  ok(BP.families().flatMap(f => f.variants).every(v => v.availability === "available"), "1: 22 변형 전부 실행 가능(보류 0)");
  ok(DF.NECK_GATHER_BAND.front.ratio === 2 && DF.NECK_GATHER_BAND.back.ratio === 1.5 && DF.NECK_GATHER.front.ratio === 1 && DF.NECK_GATHER.back.ratio === 0.5, "1: 규칙 상수 — Ⓛ 앞 2·뒤 1.5 / Ⓚ 앞 1·뒤 0.5(Ⓚ 불변)");
  ok(!GL.front.neckGather && !GL.back.neckGather && !GK.front.neckGatherBand && !GK.back.neckGatherBand, "1: 메타 키 분리(Ⓛ 는 neckGatherBand 만 / Ⓚ 는 neckGather 만)");
}

// ── 2. 절개 · 다트각 ──
["front", "back"].forEach(k => {
  const pc = GL[k], m = pc.neckGatherBand, sl = pc.outline.filter(isSlit);
  ok(sl.length === 2 && !!m, `2: ${k} 틈 다리 둘(절개 1곳) + 메타`);
  const a = segsOf([sl[0]])[0], b = segsOf([sl[1]])[0];
  const chord = D(a.from, b.to), len = D(a.from, a.to), ang = 2 * Math.asin(chord / (2 * len));
  ok(near(ang * 180 / Math.PI, ths[k], 0.01), `2: ${k} 틈 각 = 닫는 다트각 전부 ${ths[k]}°`);
  ok(near(m.cut.gapChordCm, chord, 1e-9) && near(m.cut.arcFromShoulderCm, ARC[k], 1e-12), `2: ${k} 틈 현 실측 · 절개 = SNP 에서 호 ${ARC[k]}cm`);
  // 절개·틈은 Ⓚ 와 같다(같은 절개 1곳)
  ok(near(m.cut.gapChordCm, GK[k].neckGather.cut.gapChordCm, 1e-12) && near(m.cut.lenCm, GK[k].neckGather.cut.lenCm, 1e-12), `2: ${k} 절개·틈 = Ⓚ 와 같다`);
  ok(near(neckSum(pc), neckSum(GB[k]), 1e-3), `2: ${k} 목둘레 호 합 = Ⓑ`);
});
ok(near(GL.front.neckGatherBand.cut.gapChordCm, 6.7519, 1e-3) && near(GL.back.neckGatherBand.cut.gapChordCm, 2.0091, 1e-3), "2: ● 6.752 · ∅ 2.009 실측");

// ── 3. 띠 폭 ☒ = 총 개더 분량 − 쐐기 틈 ──
["front", "back"].forEach(k => {
  const pc = GL[k], m = pc.neckGatherBand, chord = m.cut.gapChordCm, w = RATIO[k] * chord - chord;
  ok(near(m.band.widthCm, w, 1e-9) && near(m.gather.bandWidthCm, w, 1e-9), `3: ${k} ☒ = ${RATIO[k]}×틈 − 틈 = ${w.toFixed(4)}cm`);
  // 출력 외곽에서 다시 잰다: 옮긴 중심선은 원래 중심선과 평행·직각 거리 w
  const oc = centerRun(GB[k]), nc = centerRun(pc);
  const o0 = oc[0].from, o1 = oc[oc.length - 1].to, n0 = nc[0].from, n1 = nc[nc.length - 1].to;
  const du = { x: (o1.x - o0.x) / D(o0, o1), y: (o1.y - o0.y) / D(o0, o1) };
  const nrm = { x: -du.y, y: du.x };
  const perp = (p) => Math.abs((p.x - o0.x) * nrm.x + (p.y - o0.y) * nrm.y);
  ok(near(perp(n0), w, 1e-6) && near(perp(n1), w, 1e-6), `3: ${k} 새 중심선은 원래 중심선에서 직각 ${w.toFixed(3)}cm`);
  ok(near(D(n0, n1), D(o0, o1), 1e-6) && near(Math.abs((n1.x - n0.x) * du.x + (n1.y - n0.y) * du.y), D(o0, o1), 1e-6), `3: ${k} 평행 이동(길이·방향 불변)`);
  ok(near(m.band.centerLenCm, D(o0, o1), 1e-9), `3: ${k} 띠 길이 = 중심선 길이`);
  // 띠 윗·아랫변 = edge 없는 선, 길이 w
  const ix = GL[k].outline.findIndex(p => p.edge === "center"), n = pc.outline.length;
  const cn = pc.outline.filter(p => p.edge === "center").length;
  const top = segsOf([pc.outline[(ix + n - 1) % n]])[0], bot = segsOf([pc.outline[(ix + cn) % n]])[0];
  ok(!pc.outline[(ix + n - 1) % n].edge && !pc.outline[(ix + cn) % n].edge && near(D(top.from, top.to), w, 1e-6) && near(D(bot.from, bot.to), w, 1e-6), `3: ${k} 띠 윗·아랫변 길이 ☒`);
  ok(near(Math.abs(areaOf(ringOf(pc.outline))) - Math.abs(areaOf(ringOf(GK[k].outline))), w * D(o0, o1), k === "front" ? 1e-2 : 0.3), `3: ${k} 면적 증가 = ☒ × 중심선 길이(Ⓚ 대비)`);
});
ok(near(GL.front.neckGatherBand.band.widthCm, 6.7519, 1e-3), "3: 앞 ☒ = 6.752cm(= ●, 도해 «7 정도» 와 일치)");
ok(near(GL.back.neckGatherBand.band.widthCm, 1.0046, 1e-3), "3: 뒤 ☒ = 1.005cm(= 0.5∅) — 도해 «5 정도» 는 확정 수치로 쓰지 않는다");
ok(Math.abs(GL.back.neckGatherBand.band.widthCm - 5) > 3, "3: 뒤 «5 정도» 로 폭을 정하지 않았다(산식·총 분량과 양립 불가)");

// ── 4. 총 개더 분량 보존 · 봉제 목둘레 ──
["front", "back"].forEach(k => {
  const m = GL[k].neckGatherBand, g = m.gather, chord = m.cut.gapChordCm, L = neckSum(GB[k]);
  ok(near(g.ratio, RATIO[k], 1e-12) && near(g.reduceCm, RATIO[k] * chord, 1e-9) && near(g.totalAmountCm, g.reduceCm, 1e-12), `4: ${k} 총 개더 분량 = ${RATIO[k]}×틈`);
  ok(near(g.reduceCm, chord + g.bandWidthCm, 1e-9), `4: ${k} 총 분량 보존 — 줄이는 분량 = 쐐기 틈 + 띠 폭`);
  ok(near(g.zoneNeckArcCm, L - ARC[k], 1e-3) && near(g.zoneLenCm, chord + g.zoneNeckArcCm + g.bandWidthCm, 1e-9), `4: ${k} 개더 구간 = 절개 지점 → 새 중심(틈 + 중심 쪽 호 + 띠 윗변)`);
  ok(near(g.zoneSewnCm, g.zoneLenCm - g.reduceCm, 1e-9) && near(g.zoneSewnCm, g.zoneNeckArcCm, 1e-9), `4: ${k} 개더 후 구간 = 원래 중심 쪽 호`);
  ok(near(g.sewnNeckLenCm, L, 1e-3) && near(GL[k].necklineLenCm, g.sewnNeckLenCm, 1e-9), `4: ${k} 봉제 목둘레 = 원래 목둘레 호 합 = necklineLenCm`);
});
ok(near(GL.front.necklineLenCm, 11.1297, 1e-3) && near(GL.back.necklineLenCm, 7.6930, 1e-3), "4: 봉제 목둘레 앞 11.130 · 뒤 7.693(Ⓚ 뒤 8.698 과 다르다)");

// ── 5. 물리 ──
["front", "back"].forEach(k => {
  const pc = GL[k], segs = segsOf(pc.outline), ring = ringOf(pc.outline);
  let closed = true; for (let i = 0; i < segs.length; i++) if (D(segs[i].to, segs[(i + 1) % segs.length].from) > 1e-4) closed = false;
  ok(closed && !!ring && !selfCross(ring), `5: ${k} 폐곡선 · 자기교차 0`);
  ["side-seam", "hem", "armhole", "shoulder"].forEach(e => ok(near(edgeLen(pc, e), edgeLen(GB[k], e), 1e-6) || e === "shoulder" || e === "armhole", `5: ${k} ${e} 길이 = Ⓑ`));
  ok(near(edgeLen(pc, "armhole"), edgeLen(GB[k], "armhole"), 1e-3) && near(edgeLen(pc, "side-seam"), edgeLen(GB[k], "side-seam"), 1e-6) && near(edgeLen(pc, "hem"), edgeLen(GB[k], "hem"), 1e-6), `5: ${k} 진동·옆선·밑단 불변`);
  ok(near(edgeLen(pc, "center"), edgeLen(GB[k], "center"), 1e-6), `5: ${k} 중심선 길이 불변(평행 이동)`);
  ok(pc.outline.filter(p => p.dart).length === 2, `5: ${k} 열린 V 하나(닫힌 흔적 0)`);
});
ok(near(GL.back.neckGatherBand.residualSliverCm, GK.back.neckGather.residualSliverCm, 1e-12), "5: 뒤 어깨 잔여 sliver 는 Ⓚ 와 같은 값");

// ── 6. 원자적 거부 ──
{
  const b = (o) => Object.assign({}, L_BODY, o);
  throwsReason(() => DB.computeGeometry(REF, { body: b({ neckGatherBand: "J" }) }), "invalid-body-neck-gather-band", "6: 잘못된 값");
  throwsReason(() => DB.computeGeometry(REF, { body: b({ neckGather: true }) }), "neck-gather-band-conflict", "6: Ⓚ 키와 함께 쓰면 거부");
  throwsReason(() => DB.computeGeometry(REF, { body: b({ neckTuck: true }) }), "neck-gather-band-conflict", "6: 턱과 함께 쓰면 거부");
  throwsReason(() => DB.computeGeometry(REF, { body: b({ flare: true }) }), "neck-gather-band-conflict", "6: 플레어와 함께 쓰면 거부");
  throwsReason(() => DB.computeGeometry(REF, { body: b({ waistSeam: true }) }), "neck-gather-band-conflict", "6: 허리 이음선과 함께 쓰면 거부");
  const bad = (opts) => { const pc = clone({ outline: GB.front.outline, construction: GB.front.construction }); return () => DF.neckGatherBand(pc, opts); };
  throwsReason(bad({ cutArcCm: 4, ratio: 1 }), "invalid-gather-band-ratio", "6: 분량 비 1(띠 폭 0) 거부");
  throwsReason(bad({ cutArcCm: 4, ratio: 0.5 }), "invalid-gather-band-ratio", "6: 분량 비 1 미만 거부");
  throwsReason(bad({ cutArcCm: 0, ratio: 2 }), "invalid-gather-cut", "6: 절개 호 0 거부");
  throwsReason(bad({ cutArcCm: 50, ratio: 2 }), "gather-cut-beyond-neckline", "6: 목둘레보다 긴 호 거부");
  const before = J(REF); DB.computeGeometry(REF, { body: L_BODY }); ok(J(REF) === before, "6: 입력 참조 불변");
}

// ── 7. 기존 geometry 바이트 불변(Ⓐ~Ⓥ 20종 + Ⓚ) ──
{
  const WANT = { A: "f87b86b25abc", B: "3fade9d306cf", C: "d9ccd8ad2748", D: "dea05147006a", E: "c8445d93bfad", F: "21a011a86875", G: "d9a46f8358da", H: "c7c54c484627", I: "d0ecd75a37e3", J: "74dcad40aa8d",
    K: "71ab9665eb76", M: "66936c94c7ce", N: "6b02cf3e2596", O: "d1fae91f00e5", P: "160d3aaee53e", Q: "76a325d296cd", R: "63193d5a879a", S: "8f5a2535f192", T: "04de67175bdb", U: "dc8c572d7432", V: "5237c10f1106" };
  Object.keys(WANT).forEach(sym => ok(sha(DB.computeGeometry(REF, { body: BP.bodyParams("bunka-bodice-" + sym) })) === WANT[sym], "7: 기존 geometry 바이트 불변 — " + sym + " (HEAD 1d2f1df 에서 측정)"));
  ok(!("waistSeam" in GL) && !("frontPeplum" in GL) && !("princess" in GL), "7: Ⓛ 는 몸판 한 장");
  ok(sha(DB.computeGeometry(REF, { body: L_BODY })) === sha(GL), "7: 결정론");
}

// ── 8. 표시 정보 ──
{
  const before = sha(GL), mm = A.buildModel(GL, L_BODY);
  ["front", "back"].forEach(k => {
    const x = mm[k], sym = k === "front" ? "●" : "∅", m = GL[k].neckGatherBand;
    ok(x && x.cuts.length === 1 && x.wedges.length === 2, `8: ${k} 틈 하나 + 띠 하나`);
    ok(x.lines.some(l => l.id === "title" && l.text.indexOf("목둘레 개더 Ⓛ") > 0), `8: ${k} 제목 Ⓛ`);
    ok(x.lines.some(l => l.id === "amount" && l.text.indexOf(sym) > 0 && l.text.indexOf("☒") > 0 && l.text.indexOf("총 개더 분량") > 0 && l.text.indexOf("줄임") > 0), `8: ${k} 틈 ${sym} + ☒ = 총 개더 분량 표기`);
    ok(x.lines.some(l => l.id === "basis" && l.text.indexOf("개더 구간") >= 0 && l.text.indexOf("제외") > 0), `8: ${k} 개더 구간 문구`);
    ok(!x.lines.some(l => l.text === "박기 끝") && !x.lines.some(l => /턱|꺾/.test(l.text)), `8: ${k} 박기 끝·꺾는 방향 없음(턱 의미 분리)`);
    ok(near(x.legs[0].from.x, m.cut.shoulderEnd.x, 1e-12), `8: ${k} 개더 구간 표시선은 틈 입구에서 시작`);
    const last = x.legs[x.legs.length - 1].to, nc = centerRun(GL[k]);
    ok([nc[0].from, nc[nc.length - 1].to].some(p => D(p, last) < 1e-6), `8: ${k} 개더 구간 표시선은 새 중심 목둘레 끝에서 끝난다`);
  });
  ok(sha(GL) === before, "8: 표시 모델 생성은 geometry 를 바꾸지 않는다");
  const bad = clone(GL); delete bad.front.neckGatherBand.band;
  ok(A.buildModel(bad, L_BODY).front === null, "8: 띠 메타가 없으면 안내선을 지어내지 않는다");
  const mk = A.buildModel(GK, K_BODY);
  ok(mk.front.lines.some(l => l.text.indexOf("목둘레 개더 Ⓚ") > 0) && !mk.front.lines.some(l => l.text.indexOf("☒") >= 0) && mk.front.wedges.length === 1, "8: Ⓚ 표시는 그대로(띠·☒ 없음)");
}

// ── 9. 체크포인트 · 변조 거부 ──
{
  PROJECT = MK(L_BODY);
  const c = BC.check(PROJECT);
  ok(c.ok, "9: Ⓛ 몸판 검사 통과: " + c.fails.join());
  const f = c.neckGatherBand.front, b = c.neckGatherBand.back;
  ok(c.neckGatherBand.ok && !("neckGather" in c) && !("neckTuck" in c), "9: 체크포인트 키 분리(neckGatherBand 만)");
  ok(near(f.dartAngleDeg, 18.25, 1e-3) && near(b.dartAngleDeg, 11.38, 1e-3), "9: 다트각을 출력 외곽에서 재검산");
  ok(near(f.bandWidthCm, 6.7519, 1e-3) && near(b.bandWidthCm, 1.0046, 1e-3), "9: 띠 폭 ☒ 를 출력 외곽에서 재검산");
  ok(near(f.totalAmountCm, 13.5038, 1e-3) && near(b.totalAmountCm, 3.0137, 1e-3) && near(f.ratio, 2, 1e-12) && near(b.ratio, 1.5, 1e-12), "9: 총 개더 분량 앞 ●×2 · 뒤 ∅×1.5");
  ok(near(f.sewnNeckLenCm, 11.1297, 1e-3) && near(b.sewnNeckLenCm, 7.6930, 1e-3), "9: 봉제 목둘레 앞 11.130 · 뒤 7.693");
  ok(BC.complete(PROJECT).ok, "9: Ⓛ 몸판 완료");
  const hL = BC.latest(PROJECT).hash;
  PROJECT = MK(K_BODY); BC.complete(PROJECT); const hK = BC.latest(PROJECT).hash;
  PROJECT = MK(L_BODY); BC.complete(PROJECT);
  ok(hL !== hK && BC.latest(PROJECT).hash === hL, "9: Ⓛ hash ≠ Ⓚ hash · 같은 Ⓛ 는 같은 hash");
  const reasonOf = (p) => { PROJECT = p; const cc = BC.check(p); return cc.ok ? null : cc.fails[0]; };
  const mod = (fn) => { const p = MK(L_BODY); fn(p.working.geometry); return p; };
  ok(reasonOf(mod(g => { g.front.neckGatherBand.gather.reduceCm += 0.2; })) === "neck-gather-band-amount", "9: 줄이는 분량 메타 변조 → 거부");
  ok(reasonOf(mod(g => { g.back.neckGatherBand.gather.ratio = 0.5; })) === "neck-gather-band-amount", "9: 뒤 분량 비를 Ⓚ 값으로 바꾸면 거부");
  ok(reasonOf(mod(g => { g.front.neckGatherBand.band.widthCm += 0.2; })) === "neck-gather-band-width", "9: 띠 폭 메타 변조 → 거부");
  ok(reasonOf(mod(g => { g.back.neckGatherBand.gather.bandWidthCm = 5; })) === "neck-gather-band-width", "9: 뒤 띠 폭을 도해 «5 정도» 로 바꾸면 거부");
  ok(reasonOf(mod(g => { const ix = g.front.outline.findIndex(p => p.edge === "center"); g.front.outline.filter(p => p.edge === "center").forEach(p => { p.from.x += 0.2; p.to.x += 0.2; }); })) !== null, "9: 옮긴 중심선을 밀면 거부");
  ok(reasonOf(mod(g => { g.front.necklineLenCm += 0.3; })) === "neck-gather-band-sewn-length", "9: 봉제 목둘레 변조 → 거부");
  ok(reasonOf(mod(g => { g.front.neckGatherBand.cut.arcFromShoulderCm = 5; })) === "neck-gather-band-cut-position", "9: 절개 위치 메타 변조 → 거부");
  ok(reasonOf(mod(g => { delete g.front.neckGatherBand; })) === "neck-gather-band-missing", "9: 메타 삭제 → 거부");
  ok(reasonOf(mod(g => { delete g.back.neckGatherBand.band; })) === "neck-gather-band-missing", "9: 띠 메타 삭제 → 거부");
  { PROJECT = MK(Object.assign({}, L_BODY, { neckGather: true }), GL); ok(BC.check(PROJECT).fails.indexOf("neck-gather-band-mismatch") >= 0, "9: 파라미터에 Ⓚ 키가 섞이면 거부"); }
  { PROJECT = MK(K_BODY, GL); ok(BC.check(PROJECT).fails.length > 0, "9: Ⓚ 파라미터에 Ⓛ 메타가 실리면 거부"); }
  ["A", "G", "H", "I", "J", "K", "N", "V"].forEach(s => { PROJECT = MK(BP.bodyParams("bunka-bodice-" + s)); const cc = BC.check(PROJECT); ok(cc.ok && !("neckGatherBand" in cc), `9: 기존 라인(${s}) 검사에 neckGatherBand 키 없음`); });
}

// ── 10. 소비자 불변 ──
{
  const ck = BC.check(MK(L_BODY)), cb = BC.check(MK(BASE_BODY));
  ["front", "back"].forEach(k => ok(near(ck.armhole[k], cb.armhole[k], 1e-3), `10: ${k} 진동 길이(소매가 소비) = Ⓑ ${ck.armhole[k].toFixed(3)}`));
  ok(near(ck.neckline.front, 11.1297, 1e-3) && near(ck.neckline.back, 7.6930, 1e-3), "10: 목선 길이(카라가 소비) = 봉제 목둘레(개더 후 = 원래 목둘레)");
  ok(near(ck.sideSeam.front, cb.sideSeam.front, 1e-9) && ck.sideSeam.status === "match", "10: 옆선 길이 불변·앞뒤 일치");
  ok(J(REF) === SNAP, "10: 원형 참조 불변");
}

console.log("══════════════════════════════════════════════");
console.log(`neckGatherBandPresetCheck: ${PASS} PASS / ${FAIL} FAIL`);
if (FAIL) { fails.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
console.log("전부 통과 ✓");
