// ══════════════════════════════════════════════
// neckGatherPresetCheck.js — 몸판 프리셋 Ⓚ(목둘레 개더, P.24 · 처리 방법 P.161) 회귀.
//
// 책(P.24)이 준 것: Ⓑ 몸판 · 앞 AH·뒤 어깨 다트를 닫아 목둘레 **절개 1곳**(SNP 에서 호를 따라 앞 «4»·뒤 «3»cm) 벌림 ·
//   개더 분량 앞 ●×1 · 뒤 ∅×0.5(캡션). 사용자 확정(2026-10-04): 개더 구간 = 절개 지점부터 중심까지(SNP 쪽 4/3cm 제외).
//   (1) 카탈로그·계약 (2) 절개 위치·다트각 전부 (3) 개더 분량·봉제 목둘레 (4) 물리 (5) 턱과 의미 분리 (6) 원자적 거부
//   (7) Ⓐ~Ⓥ 바이트 불변(HEAD 4cb2417 에서 측정) (8) 표시 정보 (9) 체크포인트·변조 거부 (10) 소비자 불변
//   node test/harness/neckGatherPresetCheck.js
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
const K_BODY = BP.bodyParams("bunka-bodice-K"), I_BODY = BP.bodyParams("bunka-bodice-I"), B_BODY = BP.bodyParams("bunka-bodice-B");
// 비교 기준 «Ⓑ 몸판» = Ⓚ 에서 개더만 뺀 것(허리 다트 없음 · 밑단 +1 — 도해에 허리 다트가 없다)
const BASE_BODY = Object.assign({}, K_BODY); delete BASE_BODY.neckGather;
const GK = DB.computeGeometry(REF, { body: K_BODY }), GI = DB.computeGeometry(REF, { body: I_BODY }), GB = DB.computeGeometry(REF, { body: BASE_BODY });
const A = W.peplumAnnotation;
const ths = { front: 18.25, back: 11.38 }, RATIO = { front: 1, back: 0.5 }, ARC = { front: 4, back: 3 };
const isSlit = (p) => !!(p.dart && p.dart.id === "neck-gather-1");
const neckSum = (pc) => lenOf(segsOf(pc.outline.filter(p => p.edge === "neckline")));

// ── 1. 카탈로그 · 계약 ──
{
  const fam = BP.family("neck-gather");
  ok(fam && fam.availability === "available", "1: 목둘레 개더 라인 활성");
  const vK = fam.variants.find(v => v.symbol === "K"), vL = fam.variants.find(v => v.symbol === "L");
  ok(vK && vK.availability === "available" && vK.presetId === "bunka-bodice-K", "1: Ⓚ 실행 가능");
  ok(vL && vL.availability === "available" && vL.presetId === "bunka-bodice-L", "1: Ⓛ 는 별도 프리셋으로 실행 가능(neckGatherBand 키 — Ⓚ 와 분리)");
  ok(BP.resolve("neck-gather", "bunka-bodice-K").presetId === "bunka-bodice-K", "1: resolve Ⓚ");
  ok(J(K_BODY) === J({ hemExtensionBelowWaistCm: 20, hemSideOffsetCm: 1, waistDartScales: { a: 0, b: 0, d: 0, e: 0 }, neckGather: true }), "1: Ⓚ = Ⓑ 몸판 + neckGather(턱 키 없음)");
  ok(!("neckTuck" in K_BODY), "1: 턱 키를 섞지 않는다");
  ok(J(BP.get("bunka-bodice-K").body) === J(K_BODY), "1: 프리셋 레코드 일치");
}

// ── 2. 절개 위치 · 다트각 전부 닫음 ──
["front", "back"].forEach(k => {
  const pc = GK[k], m = pc.neckGather;
  const sl = pc.outline.filter(isSlit);
  ok(sl.length === 2 && !!m, `2: ${k} 틈 다리 둘(절개 1곳) + 메타`);
  ok(sl.every(p => p.dart.boundary === "neckline" && p.edge === undefined), `2: ${k} 다리는 edge 이름 없음·boundary neckline`);
  const a = segsOf([sl[0]])[0], b = segsOf([sl[1]])[0];
  const chord = D(a.from, b.to), len = D(a.from, a.to), ang = 2 * Math.asin(chord / (2 * len));
  ok(near(ang * 180 / Math.PI, ths[k], 0.01), `2: ${k} 틈 각 = 닫는 다트각 전부 ${ths[k]}° (측정 ${(ang * 180 / Math.PI).toFixed(3)})`);
  ok(near(m.cut.gapChordCm, chord, 1e-9) && near(m.cut.lenCm, len, 1e-9), `2: ${k} 메타 현·길이 = 외곽 실측`);
  ok(near(m.cut.arcFromShoulderCm, ARC[k], 1e-12), `2: ${k} 절개 위치 = SNP 에서 호 ${ARC[k]}cm`);
  ok(near(neckSum(pc), neckSum(GB[k]), 1e-3) && near(m.neckLenCm, neckSum(GB[k]), 1e-3), `2: ${k} 목둘레 호 합 = Ⓑ 와 같다(틈은 길이를 안 바꾼다)`);
  // SNP 쪽 호 = 틈 바로 앞/뒤 연속 neckline 중 어깨와 닿는 쪽
  const n = pc.outline.length, i0 = pc.outline.findIndex(isSlit);
  const run = (start, dir) => { let s = 0, p = start; const idx = []; while (pc.outline[(p + n) % n].edge === "neckline") { idx.push((p + n) % n); p += dir; } idx.forEach(ix => { s += lenOf(segsOf([pc.outline[ix]])); }); return { s, far: pc.outline[(p + n) % n].edge }; };
  const before = run(i0 - 1, -1), after = run(i0 + 2, 1);
  const sh = before.far === "shoulder" ? before : after;
  ok(sh.far === "shoulder" && near(sh.s, ARC[k], 1e-3), `2: ${k} 어깨 쪽 목둘레 호 실측 ${sh.s.toFixed(4)} = ${ARC[k]}`);
  ok(Math.abs(Math.abs(areaOf(ringOf(pc.outline))) - GI[k].neckTuck.areaBeforeCm2) < (k === "front" ? 1e-3 : 0.3), `2: ${k} 면적 = Ⓑ 링 면적(Ⓘ 메타 areaBefore, 강체 회전)`);
  ok(near(m.areaBeforeCm2, m.areaAfterCm2, 1), `2: ${k} 메타 면적 보존`);
});
ok(near(GK.front.neckGather.cut.gapChordCm, 6.7519, 1e-3), "2: 앞 ● = 6.752cm 실측");
ok(near(GK.back.neckGather.cut.gapChordCm, 2.0091, 1e-3), "2: 뒤 ∅ = 2.009cm 실측");

// ── 3. 개더 분량 · 봉제 목둘레 ──
["front", "back"].forEach(k => {
  const m = GK[k].neckGather, g = m.gather, chord = m.cut.gapChordCm, L = neckSum(GB[k]);
  ok(near(g.ratio, RATIO[k], 1e-12), `3: ${k} 분량 비 ${RATIO[k]}`);
  ok(near(g.reduceCm, RATIO[k] * chord, 1e-9), `3: ${k} 줄이는 분량 = ${RATIO[k]}×틈 현 (${g.reduceCm.toFixed(4)})`);
  ok(near(g.zoneNeckArcCm, L - ARC[k], 1e-3) && near(g.excludedShoulderArcCm, ARC[k], 1e-12), `3: ${k} 개더 구간 = 절개 지점~중심 (SNP 쪽 ${ARC[k]}cm 제외)`);
  ok(near(g.zoneLenCm, chord + g.zoneNeckArcCm, 1e-9) && near(g.zoneSewnCm, g.zoneLenCm - g.reduceCm, 1e-9), `3: ${k} 구간 길이 = 틈 현 + 중심 쪽 호`);
  ok(near(g.sewnNeckLenCm, L + chord - g.reduceCm, 1e-3) && near(GK[k].necklineLenCm, g.sewnNeckLenCm, 1e-9), `3: ${k} 봉제 목둘레 = 호 합 + 틈 − 줄임 = necklineLenCm`);
});
ok(near(GK.front.necklineLenCm, neckSum(GB.front), 1e-3), "3: 앞은 ●×1 이라 봉제 목둘레 = 원래 목둘레");
ok(near(GK.back.necklineLenCm, neckSum(GB.back) + 0.5 * GK.back.neckGather.cut.gapChordCm, 1e-3), "3: 뒤는 ∅×0.5 만 줄여 원래 + ∅/2");

// ── 4. 물리 ──
["front", "back"].forEach(k => {
  const pc = GK[k], segs = segsOf(pc.outline);
  let closed = true; for (let i = 0; i < segs.length; i++) if (D(segs[i].to, segs[(i + 1) % segs.length].from) > 1e-4) closed = false;
  ok(closed, `4: ${k} 폐곡선`);
  const edgeLen = (e, p) => lenOf(segsOf(p.outline.filter(s => s.edge === e)));
  ["side-seam", "hem", "center"].forEach(e => ok(near(edgeLen(e, pc), edgeLen(e, GB[k]), 1e-6), `4: ${k} ${e} 길이 = Ⓑ`));
  ok(near(edgeLen("center", pc), edgeLen("center", GB[k]), 1e-6), `4: ${k} 중심 조각은 고정(중심선 불변)`);
  const csig = (p) => J(segsOf(p.outline.filter(s => s.edge === "center")).map(s => [s.from, s.to].map(q => [Math.round(q.x * 1e9) / 1e9, Math.round(q.y * 1e9) / 1e9]).sort()).sort());
  ok(csig(pc) === csig(GB[k]), `4: ${k} 중심선 좌표 Ⓑ 와 동일(방향 무시)`);
});
ok(near(GK.back.neckGather.residualSliverCm, GI.back.neckTuck.residualSliverCm, 1e-9), "4: 뒤 어깨 잔여 sliver 는 Ⓘ 와 같은 값");

// ── 5. 턱과 의미 분리 ──
{
  ok(!GK.front.neckTuck && !GK.back.neckTuck, "5: Ⓚ 는 neckTuck 메타 없음");
  ok(!GI.front.neckGather && !GI.back.neckGather, "5: Ⓘ 는 neckGather 메타 없음");
  const ck = BC.check(MK(K_BODY)), ci = BC.check(MK(I_BODY));
  ok(ck.neckGather && !ck.neckTuck && ci.neckTuck && !ci.neckGather, "5: 체크포인트 키도 분리");
  ok(GK.front.neckGather.cut.gapChordCm > GI.front.neckTuck.cuts[0].gapChordCm && GK.front.neckGather.cut.gapChordCm < 7, "5: 절개 한 곳이 θ 전부를 벌린다(Ⓘ 한 틈보다 크다)");
}

// ── 6. 원자적 거부 ──
{
  const b = (o) => Object.assign({}, K_BODY, o);
  throwsReason(() => DB.computeGeometry(REF, { body: b({ neckGather: "J" }) }), "invalid-body-neck-gather", "6: 잘못된 값");
  throwsReason(() => DB.computeGeometry(REF, { body: b({ neckTuck: true }) }), "neck-gather-conflict", "6: 턱과 함께 쓰면 거부");
  throwsReason(() => DB.computeGeometry(REF, { body: b({ flare: true }) }), "neck-gather-conflict", "6: 플레어와 함께 쓰면 거부");
  throwsReason(() => DB.computeGeometry(REF, { body: b({ waistSeam: true }) }), "neck-gather-conflict", "6: 허리 이음선과 함께 쓰면 거부");
  const bad = (opts) => { const pc = clone({ outline: GB.front.outline, construction: GB.front.construction }); return () => DF.neckGather(pc, opts); };
  throwsReason(bad({ cutArcCm: 0, ratio: 1 }), "invalid-gather-cut", "6: 절개 호 0 거부");
  throwsReason(bad({ cutArcCm: 4, ratio: 0 }), "invalid-gather-ratio", "6: 분량 비 0 거부");
  throwsReason(bad({ cutArcCm: 50, ratio: 1 }), "gather-cut-beyond-neckline", "6: 목둘레보다 긴 호 거부");
  throwsReason(() => DF.neckGather({ outline: GK.front.outline, construction: GK.front.construction }, { cutArcCm: 4, ratio: 1 }), "ring-failed", "6: 이미 닫은 몸판에 다시 적용하면 거부");
  ok(!("neckGather" in BP.bodyParams("bunka-bodice-L")) && !("neckGatherBand" in K_BODY), "6: Ⓚ·Ⓛ 키 분리(Ⓛ 는 neckGather 키 없음)");
  const before = J(REF); DB.computeGeometry(REF, { body: K_BODY }); ok(J(REF) === before, "6: 입력 참조 불변");
}

// ── 7. 기존 실행 가능 프리셋 geometry 바이트 불변 ──
{
  const WANT = { A: "f87b86b25abc", B: "3fade9d306cf", C: "d9ccd8ad2748", D: "dea05147006a", E: "c8445d93bfad", F: "21a011a86875", G: "d9a46f8358da", H: "c7c54c484627", I: "d0ecd75a37e3", J: "74dcad40aa8d",
    M: "66936c94c7ce", N: "6b02cf3e2596", O: "d1fae91f00e5", P: "160d3aaee53e", Q: "76a325d296cd", R: "63193d5a879a", S: "8f5a2535f192", T: "04de67175bdb", U: "dc8c572d7432", V: "5237c10f1106" };
  Object.keys(WANT).forEach(sym => ok(sha(DB.computeGeometry(REF, { body: BP.bodyParams("bunka-bodice-" + sym) })) === WANT[sym], "7: Ⓐ~Ⓥ(Ⓘ·Ⓙ 포함) 바이트 불변 — " + sym + " (HEAD 4cb2417 에서 측정)"));
  ok(!("waistSeam" in GK) && !("frontPeplum" in GK) && !("princess" in GK), "7: Ⓚ 는 몸판 한 장(조각 분리 슬롯 없음)");
  ok(sha(DB.computeGeometry(REF, { body: K_BODY })) === sha(GK), "7: 결정론");
}

// ── 8. 표시 정보 ──
{
  const before = sha(GK), mm = A.buildModel(GK, K_BODY);
  ["front", "back"].forEach(k => {
    const x = mm[k], sym = k === "front" ? "●" : "∅";
    ok(x && x.wedges.length === 1 && x.cuts.length === 1, `8: ${k} 틈 하나·절개 하나`);
    ok(x.lines.some(l => l.id === "title" && l.text.indexOf("목둘레 개더 Ⓚ") > 0 && l.text.indexOf("턱") < 0), `8: ${k} 제목 Ⓚ(턱 문구 없음)`);
    ok(x.lines.some(l => l.id === "amount" && l.text.indexOf(sym) > 0 && l.text.indexOf("줄임") > 0), `8: ${k} 틈 ${sym} · 줄임 표기`);
    ok(x.lines.some(l => l.id === "basis" && l.text.indexOf("개더 구간") >= 0 && l.text.indexOf("제외") > 0), `8: ${k} 개더 구간 문구(SNP 쪽 제외)`);
    ok(!x.lines.some(l => l.text === "박기 끝") && !x.lines.some(l => /턱|꺾/.test(l.text)), `8: ${k} 박기 끝·꺾는 방향 없음(턱 의미 분리)`);
    const mt = GK[k].neckGather;
    ok(x.legs.length > 3 && near(x.legs[0].from.x, mt.cut.shoulderEnd.x, 1e-12) && near(x.legs[0].to.x, mt.cut.centerEnd.x, 1e-12), `8: ${k} 개더 구간 표시선은 틈 입구에서 시작`);
    const last = x.legs[x.legs.length - 1].to, ct = GK[k].outline.filter(s => s.edge === "center");
    const cEnds = segsOf(ct).flatMap(s => [s.from, s.to]);
    ok(cEnds.some(p => D(p, last) < 1e-6), `8: ${k} 개더 구간 표시선은 중심(${k === "front" ? "CF" : "CB"}) 목둘레 끝에서 끝난다`);
  });
  ok(sha(GK) === before, "8: 표시 모델 생성은 geometry 를 바꾸지 않는다");
  const bad = clone(GK); delete bad.front.neckGather.gather;
  ok(A.buildModel(bad, K_BODY).front === null, "8: 메타가 모자라면 안내선을 지어내지 않는다");
  ok(A.buildModel(GI, I_BODY).front.lines.some(l => l.text.indexOf("턱") >= 0) && !A.buildModel(GI, I_BODY).front.lines.some(l => l.text.indexOf("개더") >= 0), "8: Ⓘ 표시는 그대로(개더 문구 없음)");
}

// ── 9. 체크포인트 · 변조 거부 ──
{
  PROJECT = MK(K_BODY);
  const c = BC.check(PROJECT);
  ok(c.ok, "9: Ⓚ 몸판 검사 통과: " + c.fails.join());
  const f = c.neckGather.front, b = c.neckGather.back;
  ok(c.neckGather.ok && near(f.dartAngleDeg, 18.25, 1e-3) && near(b.dartAngleDeg, 11.38, 1e-3), "9: 다트각을 출력 외곽에서 재 검산");
  ok(near(f.cutArcCm, 4, 1e-3) && near(b.cutArcCm, 3, 1e-3) && near(f.ratio, 1, 1e-12) && near(b.ratio, 0.5, 1e-12), "9: 절개 호 4/3 · 분량 비 1/0.5 재검산");
  ok(near(f.reduceCm, f.gapChordCm, 1e-3) && near(b.reduceCm, b.gapChordCm / 2, 1e-3), "9: 줄이는 분량 앞 ●×1 · 뒤 ∅×0.5");
  ok(near(f.sewnNeckLenCm, 11.1297, 1e-3) && near(b.sewnNeckLenCm, 8.6975, 1e-3), "9: 봉제 목둘레 앞 11.130 · 뒤 8.698");
  const done = BC.complete(PROJECT); ok(done.ok, "9: Ⓚ 몸판 완료: " + (done.reason || ""));
  const hK = BC.latest(PROJECT).hash;
  PROJECT = MK(I_BODY); BC.complete(PROJECT); const hI = BC.latest(PROJECT).hash;
  PROJECT = MK(K_BODY); BC.complete(PROJECT);
  ok(hK !== hI && BC.latest(PROJECT).hash === hK, "9: Ⓚ hash ≠ Ⓘ hash · 같은 Ⓚ 는 같은 hash");
  const reasonOf = (p) => { PROJECT = p; const cc = BC.check(p); return cc.ok ? null : cc.fails[0]; };
  const mod = (fn) => { const p = MK(K_BODY); fn(p.working.geometry); return p; };
  ok(reasonOf(mod(g => { g.front.neckGather.gather.reduceCm += 0.2; })) === "neck-gather-amount", "9: 줄이는 분량 메타 변조 → 거부");
  ok(reasonOf(mod(g => { g.back.neckGather.gather.ratio = 1; })) === "neck-gather-amount", "9: 뒤 분량 비를 ×1 로 바꾸면 거부");
  ok(reasonOf(mod(g => { g.front.necklineLenCm += 0.3; })) === "neck-gather-sewn-length", "9: 봉제 목둘레 변조 → 거부");
  ok(reasonOf(mod(g => { g.front.neckGather.cut.arcFromShoulderCm = 5; })) === "neck-gather-cut-position", "9: 절개 위치 메타 변조 → 거부");
  ok(reasonOf(mod(g => { g.front.neckGather.dartAngleRad *= 0.9; })) === "neck-gather-angle-mismatch", "9: 닫는 다트각 메타 변조 → 거부");
  ok(reasonOf(mod(g => { g.back.outline.filter(isSlit).forEach(p => { p.to.x += 0.2; }); })) !== null, "9: 틈 다리 한쪽을 밀면 거부");
  ok(reasonOf(mod(g => { const s = g.front.outline.filter(isSlit); s.forEach(p => { p.dart.id = "neck-tuck-1"; }); })) !== null, "9: 틈 다리 id 를 턱으로 바꾸면 거부");
  ok(reasonOf(mod(g => { delete g.front.neckGather; })) === "neck-gather-missing", "9: 메타 삭제 → 거부");
  { PROJECT = MK(Object.assign({}, K_BODY, { neckTuck: true }), GK); ok(BC.check(PROJECT).fails.indexOf("neck-gather-mismatch") >= 0, "9: 파라미터에 턱이 섞이면 거부"); }
  ["A", "G", "H", "I", "J", "N", "V"].forEach(s => { PROJECT = MK(BP.bodyParams("bunka-bodice-" + s)); const cc = BC.check(PROJECT); ok(cc.ok && !("neckGather" in cc), `9: Ⓐ~Ⓥ(${s}) 검사에 neckGather 키 없음`); });
}

// ── 10. 소비자 불변 ──
{
  const ck = BC.check(MK(K_BODY)), cb = BC.check(MK(BASE_BODY));
  ["front", "back"].forEach(k => {
    ok(near(ck.armhole[k], cb.armhole[k], 1e-3), `10: ${k} 진동 길이(소매가 소비) = Ⓑ ${ck.armhole[k].toFixed(3)}`);
  });
  ok(near(ck.neckline.front, 11.1297, 1e-3) && near(ck.neckline.back, 8.6975, 1e-3), "10: 목선 길이(카라가 소비) = 봉제 목둘레(개더 후)");
  ok(near(ck.sideSeam.front, cb.sideSeam.front, 1e-9) && ck.sideSeam.status === "match", "10: 옆선 길이 불변·앞뒤 일치");
  ok(J(REF) === SNAP, "10: 원형 참조 불변");
}

console.log("══════════════════════════════════════════════");
console.log(`neckGatherPresetCheck: ${PASS} PASS / ${FAIL} FAIL`);
if (FAIL) { fails.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
console.log("전부 통과 ✓");
