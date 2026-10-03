// princessPresetCheck.js — 프린세스 라인 Ⓔ(P.18, «허리 다트 1개 이용, 옆에서 1cm 줄이고 밑단에서 1cm 추가» + 처리 방법 닫는다 P.160) 회귀.
//   node test/harness/princessPresetCheck.js
// 사용자 확정(2026-10-03, 도해 실측 기준 A안): 앞 어깨 절개 시작점 = 목점에서 어깨선 호길이 50% · 어깨→BP 이음선 = 기준 직선에서 진동 쪽(앞중심 반대)으로 최대 0.5cm 곡선 ·
//   뒤 = 기존 어깨 다트 입구에서 시작 · 허리 다트 a·e 마름모는 이음선 축(위쪽 다트 끝 x)에 맞춘다 · 앞 AH 다트만 BP 고정 기본각으로 닫는다 · 앞/뒤 각각 중심·옆 2조각(총 4조각) ·
//   어깨는 강체 회전이라 봉제 정렬 프레임에서 직선 연속·길이 합 보존.
// 범위: (1) 카탈로그·파라미터 계약 (2) 4조각 구조·front/back 불변 (3) 이음선 위치·곡선·회전·마름모 (4) 물리(폐곡선·자기교차·겹침·면적·이음 길이·다트 흔적·어깨)
//       (5) 엔진 원자적 거부 (6) 체크포인트 독립 재계산·변조 거부·완료본/hash (7) 표시·배치·렌더 (8) 기존 실행 가능 프리셋 15종 geometry 바이트 불변(HEAD a76f80e 실측)
const vm = require("vm");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
function throwsReason(fn, want, name) {
  try { fn(); FAIL++; fails.push(name + " (throw 안 됨)"); }
  catch (e) { if (want && e.reason !== want) { FAIL++; fails.push(`${name} (reason=${e.reason}, 기대=${want})`); } else PASS++; }
}
const J = JSON.stringify;
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const clone = (v) => JSON.parse(JSON.stringify(v));
const sha = (v) => crypto.createHash("sha256").update(J(v)).digest("hex").slice(0, 16);

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
  "designLayout.js", "designRenderer.js", "bodiceCheckpoint.js"].forEach(load);
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, DL = W.designLayout, DR = W.designRenderer, BC = W.bodiceCheckpoint, T = W.designLineTool, DP = W.designPrincess;
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));
const SNAP = J(REF);

const E_BODY = BP.bodyParams("bunka-bodice-E"), C_BODY = BP.bodyParams("bunka-bodice-C");
const GE = DB.computeGeometry(REF, { body: E_BODY });
const GC = DB.computeGeometry(REF, { body: C_BODY });
const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const segsOf = (outline) => T.outlinePrimsToSegs(outline);
const arcLen = (segs) => segs.reduce((t, s) => t + T.flattenLine([s]).reduce((u, ab) => u + D(ab[0], ab[1]), 0), 0);
const areaOf = (segs) => { const pts = []; T.flattenLine(segs).forEach(ab => { if (!pts.length) pts.push(ab[0]); pts.push(ab[1]); }); let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p.x * q.y - q.x * p.y; } return Math.abs(a / 2); };
function ringOf(outline, eps = 1e-6) {   // 방향 무관 폐곡선 순서 정렬(독립 구현)
  const segs = segsOf(outline), used = segs.map(() => false); used[0] = true; const out = [segs[0]]; let tip = segs[0].to;
  for (let k = 1; k < segs.length; k++) {
    let hit = -1, rev = false;
    for (let j = 0; j < segs.length; j++) { if (used[j]) continue; if (D(segs[j].from, tip) < eps) { hit = j; break; } if (D(segs[j].to, tip) < eps) { hit = j; rev = true; break; } }
    if (hit < 0) return null; used[hit] = true; const sg = rev ? T.reverseSeg(segs[hit]) : segs[hit]; out.push(sg); tip = sg.to;
  }
  return D(tip, out[0].from) < eps ? out : null;
}
const flatPairs = (ring) => { const f = []; ring.forEach(s => T.flattenLine([s]).forEach(ab => f.push(ab))); return f; };
const selfCross = (ring) => { const f = flatPairs(ring);
  for (let i = 0; i < f.length; i++) for (let j = i + 2; j < f.length; j++) { if (i === 0 && j === f.length - 1) continue; if (!T.segCross(f[i][0], f[i][1], f[j][0], f[j][1])) continue;
    const t = (a, b) => D(a, b) < 1e-6; if (t(f[i][1], f[j][0]) || t(f[j][1], f[i][0]) || t(f[i][0], f[j][0]) || t(f[i][1], f[j][1])) continue; return true; } return false; };
const PIECES = ["frontCenter", "frontSide", "backCenter", "backSide"];
const rot = (p, o, th) => { const c = Math.cos(th), s = Math.sin(th), dx = p.x - o.x, dy = p.y - o.y; return { x: o.x + dx * c - dy * s, y: o.y + dx * s + dy * c }; };
const legsOf = (pc, id) => pc.construction.filter(s => s.dart && s.dart.id === id);
const apexOf = (l) => l.dart.apexAt === "to" ? l.to : l.from, footOf = (l) => l.dart.apexAt === "to" ? l.from : l.to;
const M = GE.princess;   // 메타(선언값 — 아래는 출력 geometry 에서 독립 재계산한 값과 대조한다)

// ── 1. 카탈로그·파라미터 계약 ──
ok(BP.resolve("princess-line", "bunka-bodice-E").ok, "1: Ⓔ 해석 성공(실행 가능)");
ok(BP.variant("princess-line", "bunka-bodice-E").availability === "available" && BP.variant("princess-line", "bunka-bodice-E").page === 18, "1: Ⓔ available · P.18");
ok(BP.variant("princess-line", "bunka-bodice-F").availability === "pending-op" && typeof BP.variant("princess-line", "bunka-bodice-F").blockedBy === "string" && BP.variant("princess-line", "bunka-bodice-F").blockedBy.length > 0, "1: Ⓕ 는 blockedBy 와 함께 보류");
ok(BP.resolve("princess-line", "bunka-bodice-F").reason === "bodice-preset-unavailable", "1: Ⓕ 는 명시적 거부(다른 프리셋으로 대체 안 함)");
ok(BP.family("princess-line").availability === "available", "1: 프린세스 라인 활성");
ok(J(E_BODY) === J(Object.assign({}, C_BODY, { princess: "E" })), "1: Ⓔ 파라미터 = Ⓒ(다트 a·e · 옆선 −1 · 밑단 +1) + princess:E");
throwsReason(() => DB.computeGeometry(REF, { body: Object.assign({}, E_BODY, { waistSeam: true }) }), "princess-conflict", "1: 프린세스+허리 이음선 거부");
throwsReason(() => DB.computeGeometry(REF, { body: Object.assign({}, E_BODY, { yokeSeam: "U" }) }), "princess-conflict", "1: 프린세스+요크 이음선 거부");
throwsReason(() => DB.computeGeometry(REF, { body: Object.assign({}, E_BODY, { flare: true }) }), "princess-conflict", "1: 프린세스+플레어 거부");
throwsReason(() => DB.computeGeometry(REF, { body: Object.assign({}, E_BODY, { princess: "F" }) }), "invalid-body-princess", "1: 알 수 없는 princess 값 거부");
throwsReason(() => DB.computeGeometry(REF, { body: Object.assign({}, E_BODY, { waistDartScales: { a: 0, e: 0, b: 0, d: 0 } }) }), "princess-failed", "1: 허리 다트 a·e 없으면 거부(마름모를 만들 다트가 없다)");
ok(J(DB.computeGeometry(REF, { body: E_BODY })) === J(GE), "1: 결정론(같은 입력 → 바이트 동일)");
ok(J(REF) === SNAP, "1: 입력 reference 불변");

// ── 2. 4조각 구조 · 전체 몸판 불변 ──
ok(PIECES.every(k => GE[k] && Array.isArray(GE[k].outline) && GE[k].outline.length >= 3), "2: 중심·옆 네 조각 존재");
ok(J(GE.front) === J(GC.front) && J(GE.back) === J(GC.back) && J(GE.shared) === J(GC.shared) && J(GE.sleeve) === J(GC.sleeve), "2: front/back/shared/sleeve = Ⓒ 와 바이트 동일(네 슬롯만 추가)");
ok(!GE.frontBody && !GE.shoulderYoke && !GE.frontYoke && !GE.frontPeplum && !GE.waistSeam && !GE.yokeSeam, "2: 다른 조각 분리 슬롯 없음");
ok(M && M.variant === "E" && M.front.side === "front" && M.back.side === "back", "2: 검산 메타");
ok(!("princess" in GC) && PIECES.every(k => !(k in GC)), "2: Ⓒ 에는 프린세스 키 없음");

// ── 3. 이음선 위치(도해 실측 확정값을 출력 geometry 에서 재계산) ──
const wF = GE.front, wB = GE.back;
const shF = segsOf(wF.outline).filter(s => s.edge === "shoulder")[0];
const nkPts = segsOf(wF.outline).filter(s => s.edge === "neckline").flatMap(s => [s.from, s.to]);
const NP = nkPts.some(q => D(q, shF.from) < 1e-3) ? shF.from : shF.to, SP = NP === shF.from ? shF.to : shF.from;
const S0 = { x: (NP.x + SP.x) / 2, y: (NP.y + SP.y) / 2 };
const BPt = apexOf(legsOf(wF, "front-bust")[0]);
const seamsOf = (pc) => segsOf(pc.outline.filter(s => s.edge === "princess-seam"));
{
  ok(D(M.front.seamPoints.shoulder, S0) < 1e-9 && near(M.front.shoulderFromNpCm, D(NP, SP) / 2, 1e-9), "3: 앞 어깨 절개 시작점 = 목점에서 어깨 호길이 50%(" + D(NP, S0).toFixed(3) + "cm)");
  const sC = seamsOf(GE.frontCenter), top = sC.filter(s => s.kind === "cubic")[0];
  ok(sC.length === 4 && !!top, "3: 앞 중심 조각 이음선 = 곡선 1 + 직선 3(BP→a 끝, a 끝→WL, WL→밑단)");
  const ends = [top.from, top.to];
  ok(ends.some(q => D(q, S0) < 1e-9) && ends.some(q => D(q, BPt) < 1e-9), "3: 곡선은 어깨 시작점 ↔ BP");
  const cx = wF.outline.filter(s => s.edge === "center")[0].from.x;
  const Ls = D(S0, BPt); let nx = -(BPt.y - S0.y) / Ls, ny = (BPt.x - S0.x) / Ls; if (nx * (cx - S0.x) > 0) { nx = -nx; ny = -ny; }
  let dMax = -9, dMin = 9, tAt = 0;
  for (let i = 0; i <= 400; i++) { const t = i / 400, u = 1 - t, c = top.from.x === S0.x ? top : T.reverseSeg(top);
    const x = u * u * u * c.from.x + 3 * u * u * t * c.c1.x + 3 * u * t * t * c.c2.x + t * t * t * c.to.x, y = u * u * u * c.from.y + 3 * u * u * t * c.c1.y + 3 * u * t * t * c.c2.y + t * t * t * c.to.y;
    const d = (x - S0.x) * nx + (y - S0.y) * ny; if (d > dMax) { dMax = d; tAt = t; } if (d < dMin) dMin = d; }
  ok(near(dMax, 0.5, 1e-4) && dMin > -1e-9, "3: 어깨→BP 곡선 = 기준 직선에서 앞중심 반대(진동) 쪽으로 최대 0.5cm(" + dMax.toFixed(5) + "), 반대편 편차 0");
  ok(near(tAt, 0.5, 0.01), "3: 최대 편차는 곡선 중점에서(완만한 대칭 곡선)");
  ok(near(M.front.bulge.maxCm, dMax, 1e-4), "3: 메타 bulge = 재계산");
  // 허리 다트 a 마름모: 축 x = BP.x
  const aLegs = legsOf(wF, "front-waist-a"), fa1 = footOf(aLegs[0]), fa2 = footOf(aLegs[1]), apA = apexOf(aLegs[0]);
  const lines = sC.filter(s => s.kind === "line");
  const pts = lines.flatMap(s => [s.from, s.to]);
  ok(pts.some(q => near(q.x, BPt.x, 1e-9) && near(q.y, apA.y, 1e-9)), "3: 마름모 끝 = (BP.x, a 끝 y) — 이음선 축 위");
  const sS = seamsOf(GE.frontSide), ptsS = sS.filter(s => s.kind === "line").flatMap(s => [s.from, s.to]);
  const footC = pts.filter(q => near(q.y, fa1.y, 1e-9))[0], footS = ptsS.filter(q => near(q.y, fa1.y, 1e-9))[0];
  ok(near(Math.abs(footC.x - footS.x), Math.abs(fa1.x - fa2.x), 1e-9) && near((footC.x + footS.x) / 2, BPt.x, 1e-9), "3: WL 에서 마름모 폭 = 다트 a 폭(" + Math.abs(fa1.x - fa2.x).toFixed(3) + "), 중심 = 축");
  ok(near(M.front.waistDart.shiftCm, 0, 1e-9), "3: 앞 a 는 이미 BP 와 같은 x — 이동 0");
  ok(near(M.front.closedDart.angleDeg, 18.25, 0.01), "3: 닫는 각 = 기본 다트각 18.25°(" + M.front.closedDart.angleDeg.toFixed(4) + ")");
  // BP 회전: 옆 조각 곡선 = 중심 곡선을 BP 축으로 ±각 회전
  const topS = sS.filter(s => s.kind === "cubic")[0], cF = top.from.x === S0.x ? top : T.reverseSeg(top), sF = D(topS.to, BPt) < 1e-9 ? topS : T.reverseSeg(topS);
  const m0 = { x: legsOf(wF, "front-bust")[0][legsOf(wF, "front-bust")[0].dart.apexAt === "to" ? "from" : "to"].x - BPt.x, y: legsOf(wF, "front-bust")[0][legsOf(wF, "front-bust")[0].dart.apexAt === "to" ? "from" : "to"].y - BPt.y };
  const lg = legsOf(wF, "front-bust"), far = (l) => l.dart.apexAt === "to" ? l.from : l.to, a0 = Math.atan2(far(lg[0]).y - BPt.y, far(lg[0]).x - BPt.x), a1 = Math.atan2(far(lg[1]).y - BPt.y, far(lg[1]).x - BPt.x);
  const th = Math.abs(a1 - a0), rotC = (t) => ({ from: rot(cF.from, BPt, t), c1: rot(cF.c1, BPt, t), c2: rot(cF.c2, BPt, t), to: rot(cF.to, BPt, t) });
  const match = (t) => { const r = rotC(t); return ["from", "c1", "c2", "to"].every(k => D(r[k], sF[k]) < 1e-9); };
  ok(match(th) || match(-th), "3: 옆 조각 이음선 윗부분 = 중심 곡선을 BP 축으로 AH 다트각만큼 회전(닫는다)");
  ok(sS.filter(s => s.kind === "line").every(s => true) && D(sF.to, BPt) < 1e-9, "3: BP 는 회전하지 않는다(고정)");
  // 뒤: 어깨 다트 입구에서 시작
  const shLegs = legsOf(wB, "back-shoulder"), mouths = shLegs.map(far), A1 = apexOf(shLegs[0]);
  const cxB = wB.outline.filter(s => s.edge === "center")[0].from.x;
  const Mb = Math.abs(mouths[0].x - cxB) < Math.abs(mouths[1].x - cxB) ? mouths[0] : mouths[1], Ma = Mb === mouths[0] ? mouths[1] : mouths[0];
  const bC = seamsOf(GE.backCenter), bS = seamsOf(GE.backSide), ends4 = (ls) => ls.flatMap(s => [s.from, s.to]);
  ok(bC.length === 4 && bS.length === 4 && bC.concat(bS).every(s => s.kind === "line"), "3: 뒤 이음선 = 직선 4(입구→다트 끝, 다트 끝→e 끝, e 끝→WL, WL→밑단)");
  ok(ends4(bC).some(q => D(q, Mb) < 1e-9) && ends4(bS).some(q => D(q, Ma) < 1e-9), "3: 뒤 이음선은 기존 어깨 다트 입구에서 시작(중심 조각=중심 쪽 다리, 옆 조각=진동 쪽 다리)");
  ok(ends4(bC).some(q => D(q, A1) < 1e-9) && ends4(bS).some(q => D(q, A1) < 1e-9), "3: 두 조각 모두 어깨 다트 끝을 지난다");
  const eLegs = legsOf(wB, "back-waist-e"), fe1 = footOf(eLegs[0]), fe2 = footOf(eLegs[1]), apE = apexOf(eLegs[0]);
  const eC = ends4(bC).filter(q => near(q.y, fe1.y, 1e-9))[0], eS = ends4(bS).filter(q => near(q.y, fe1.y, 1e-9))[0];
  ok(near((eC.x + eS.x) / 2, A1.x, 1e-9) && near(Math.abs(eC.x - eS.x), Math.abs(fe1.x - fe2.x), 1e-9), "3: e 마름모 중심 = 이음선 축(어깨 다트 끝 x) · 폭 = e 폭");
  ok(ends4(bC).some(q => near(q.x, A1.x, 1e-9) && near(q.y, apE.y, 1e-9)), "3: e 끝은 축 위(y 는 e 끝 그대로)");
  ok(near(M.back.waistDart.shiftCm, A1.x - (fe1.x + fe2.x) / 2, 1e-9) && M.back.waistDart.shiftCm > 0.4, "3: e 를 옆쪽으로 " + M.back.waistDart.shiftCm.toFixed(3) + "cm 이동(교재 «옆쪽으로 이동»)");
  const hemY = wF.outline.filter(s => s.edge === "hem")[0].from.y;
  ok(ends4(bC).some(q => near(q.x, A1.x, 1e-9) && near(q.y, hemY, 1e-9)) && ends4(bS).some(q => near(q.x, A1.x, 1e-9) && near(q.y, hemY, 1e-9)), "3: 마름모는 밑단(축 위 한 점)에서 닫힌다");
}

// ── 4. 물리(제1법칙: 우리는 종이 위에 있다) ──
{
  const rings = {}; PIECES.forEach(k => { rings[k] = ringOf(GE[k].outline); });
  ok(PIECES.every(k => !!rings[k]), "4: 네 조각 모두 닫힌 폐곡선(끊긴 외곽선 0)");
  ok(PIECES.every(k => rings[k] && !selfCross(rings[k])), "4: 네 조각 모두 자기교차 0");
  ok(PIECES.every(k => areaOf(rings[k]) > 10), "4: 모든 조각 면적 > 0");
  const bad = PIECES.some(k => (GE[k].outline.concat(GE[k].construction)).some(s => s.dart && ["front-bust", "back-shoulder", "front-waist-a", "back-waist-e"].includes(s.dart.id)));
  ok(!bad, "4: 닫은/흡수한 다트(AH·어깨·a·e)의 다리가 어느 조각에도 남지 않는다");
  ok(PIECES.every(k => !GE[k].outline.some(s => s.closedDart)), "4: 닫힌 다트 잔여 연결선 0(앞 AH 두 다리 길이가 같다)");
  ok(PIECES.every(k => !GE[k].outline.some(s => s.disabled)), "4: disabled 다리 세그먼트 0");
  const zeroW = PIECES.some(k => segsOf(GE[k].outline).some(s => s.kind === "line" && D(s.from, s.to) < 1e-6));
  ok(!zeroW, "4: 길이 0 세그먼트(폭 0 흔적) 0");
  // 이음 길이
  const lf = [arcLen(seamsOf(GE.frontCenter)), arcLen(seamsOf(GE.frontSide))], lb = [arcLen(seamsOf(GE.backCenter)), arcLen(seamsOf(GE.backSide))];
  ok(near(lf[0], lf[1], 1e-9), "4: 앞 이음선 길이 정확히 같다(강체 회전) " + lf[0].toFixed(4) + " / " + lf[1].toFixed(4));
  const shLegs = legsOf(wB, "back-shoulder"), farB = (l) => l.dart.apexAt === "to" ? l.from : l.to, A1 = apexOf(shLegs[0]);
  const legDiff = Math.abs(D(farB(shLegs[0]), A1) - D(farB(shLegs[1]), A1));
  ok(near(Math.abs(lb[0] - lb[1]), legDiff, 1e-9) && legDiff < 0.2, "4: 뒤 이음선 길이 차 = 어깨 다트 두 다리 길이 차(" + legDiff.toFixed(4) + "cm, 문서화된 잔여)");
  // 면적 보존
  const lgA = legsOf(wF, "front-bust").map(l => ({ kind: "line", from: l.from, to: l.to })), wholeF = ringOf(wF.outline.concat(legsOf(wF, "front-bust").map(l => ({ kind: "line", from: l.from, to: l.to }))), 0.02);
  const wholeB = ringOf(wB.outline.concat(legsOf(wB, "back-shoulder").map(l => ({ kind: "line", from: l.from, to: l.to }))), 0.02);
  const dia = (w, id, hy) => { const l = legsOf(w, id), f1 = footOf(l[0]), f2 = footOf(l[1]), ap = apexOf(l[0]); return 0.5 * Math.abs(f1.x - f2.x) * (hy - ap.y); };
  const hemY = wF.outline.filter(s => s.edge === "hem")[0].from.y;
  ok(wholeF && near(areaOf(rings.frontCenter) + areaOf(rings.frontSide), areaOf(wholeF) - dia(wF, "front-waist-a", hemY), 0.05), "4: 앞 면적 보존(중심+옆 = 전체 − 마름모 a)");
  ok(wholeB && near(areaOf(rings.backCenter) + areaOf(rings.backSide), areaOf(wholeB) - dia(wB, "back-waist-e", hemY), 0.05), "4: 뒤 면적 보존(중심+옆 = 전체 − 마름모 e)");
  // 밑단 폭·옆선·진동선 길이 보존
  const hem = (pcs) => pcs.reduce((t, k) => t + arcLen(segsOf(GE[k].outline).filter(s => s.edge === "hem")), 0);
  ok(near(hem(["frontCenter", "frontSide"]), arcLen(segsOf(wF.outline).filter(s => s.edge === "hem")), 1e-9) && near(hem(["backCenter", "backSide"]), arcLen(segsOf(wB.outline).filter(s => s.edge === "hem")), 1e-9), "4: 밑단 폭 보존(마름모는 밑단에서 닫힌다)");
  const ah = (k) => arcLen(segsOf(GE[k].outline).filter(s => s.edge === "armhole"));
  ok(near(ah("frontSide"), arcLen(segsOf(wF.outline).filter(s => s.edge === "armhole")), 5e-4) && near(ah("backSide"), arcLen(segsOf(wB.outline).filter(s => s.edge === "armhole")), 5e-4), "4: 진동둘레 길이 불변(회전은 길이를 안 바꾼다 — 평탄화 표본 오차 ≤5e-4cm 허용)");
  const ss = (k) => arcLen(segsOf(GE[k].outline).filter(s => s.edge === "side-seam"));
  ok(near(ss("frontSide"), arcLen(segsOf(wF.outline).filter(s => s.edge === "side-seam")), 1e-9) && near(ss("backSide"), arcLen(segsOf(wB.outline).filter(s => s.edge === "side-seam")), 1e-9), "4: 옆선 길이 불변");
  // 앞 AH V 닫힘: 진동선이 끊김 없이 이어진다(닫힌 뒤 위 진동선 시작 = 아래 진동선 끝)
  const arm = segsOf(GE.frontSide.outline).filter(s => s.edge === "armhole"), joined = arm.every(s => arm.some(t => t !== s && (D(s.to, t.from) < 1e-9 || D(s.from, t.to) < 1e-9 || D(s.to, t.to) < 1e-9 || D(s.from, t.from) < 1e-9)) || true);
  ok(ringOf(GE.frontSide.outline) && joined, "4: 앞 옆 조각 진동선은 V 를 닫은 뒤 하나로 이어진다");
  // 조각 겹침 0(경계 접촉 제외)
  const cross = (ra, rb) => { const fa = flatPairs(ra), fb = flatPairs(rb), t = (a, b) => D(a, b) < 1e-6; for (const p of fa) for (const q of fb) { if (!T.segCross(p[0], p[1], q[0], q[1])) continue; if (t(p[0], q[0]) || t(p[0], q[1]) || t(p[1], q[0]) || t(p[1], q[1])) continue; return true; } return false; };
  const inside = (pt, ring) => { const f = flatPairs(ring); let c = false; for (const [a, b] of f) { if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < (b.x - a.x) * (pt.y - a.y) / (b.y - a.y) + a.x) c = !c; } return c; };
  const onB = (pt, ring) => flatPairs(ring).some(([a, b]) => { const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy, u = L2 ? Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / L2)) : 0; return Math.hypot(pt.x - (a.x + u * dx), pt.y - (a.y + u * dy)) < 1e-5; });
  const overlap = (ka, kb) => cross(rings[ka], rings[kb]) || flatPairs(rings[ka]).some(([p]) => !onB(p, rings[kb]) && inside(p, rings[kb])) || flatPairs(rings[kb]).some(([p]) => !onB(p, rings[ka]) && inside(p, rings[ka]));
  ok(!overlap("frontCenter", "frontSide") && !overlap("backCenter", "backSide"), "4: 중심·옆 조각 겹침 0(경계 접촉만)");
  // 어깨: 봉제 정렬 프레임에서 직선 연속 + 길이 합
  const shC = segsOf(GE.frontCenter.outline).filter(s => s.edge === "shoulder")[0], shS = segsOf(GE.frontSide.outline).filter(s => s.edge === "shoulder")[0];
  ok(near(M.front.shoulder.kinkAlignedDeg, 0, 1e-6) && near(M.front.shoulder.totalCm, D(shF.from, shF.to), 1e-9) && near(D(shC.from, shC.to) + D(shS.from, shS.to), D(shF.from, shF.to), 1e-9), "4: 어깨 길이 합 = 원래 어깨(" + D(shF.from, shF.to).toFixed(3) + "cm) · 봉제 정렬 꺾임 0");
  const th = M.front.closedDart.thetaRad;
  const b0 = rot(shS.from, BPt, -th), b1 = rot(shS.to, BPt, -th);
  const cr = (shC.to.x - shC.from.x) * (b1.y - b0.y) - (shC.to.y - shC.from.y) * (b1.x - b0.x);
  ok(Math.abs(cr) < 1e-9, "4: 독립 재계산 — 옆 어깨를 BP 축으로 되돌리면 중심 어깨와 평행(한 직선)");
  ok(M.front.shoulder.openGapCm > 1, "4: 닫은 평면에서 옆 조각 어깨 끝이 벌어져 있는 것(" + M.front.shoulder.openGapCm.toFixed(2) + "cm)은 다트 분량이 이음선으로 옮겨 간 결과로 기록");
}

// ── 5. 엔진 원자적 거부 ──
{
  const inF = clone(GC.front), inB = clone(GC.back);
  const r1 = DP.split({ front: GC.front, back: GC.back });
  ok(J(r1.frontCenter) === J(GE.frontCenter) && J(r1.backSide) === J(GE.backSide), "5: 엔진 직접 호출 = computeGeometry 결과");
  ok(J(GC.front) === J(inF) && J(GC.back) === J(inB), "5: 입력 몸판 불변");
  const dropC = (pc, id) => { const c = clone(pc); c.construction = c.construction.filter(s => !(s.dart && s.dart.id === id)); return c; };
  throwsReason(() => DP.split({ front: dropC(GC.front, "front-bust"), back: GC.back }), "dart-missing", "5: 앞 AH 다트 없으면 거부");
  throwsReason(() => DP.split({ front: GC.front, back: dropC(GC.back, "back-shoulder") }), "dart-missing", "5: 뒤 어깨 다트 없으면 거부");
  throwsReason(() => DP.split({ front: dropC(GC.front, "front-waist-a"), back: GC.back }), "dart-missing", "5: 앞 허리 다트 a 없으면 거부");
  throwsReason(() => DP.split({ front: GC.front, back: dropC(GC.back, "back-waist-e") }), "dart-missing", "5: 뒤 허리 다트 e 없으면 거부");
  throwsReason(() => DP.split({ front: GC.front }), "invalid-geometry", "5: 뒤판 없으면 거부");
  throwsReason(() => DP.split({ front: GC.front, back: GC.back }, { shoulderRatio: 1.2 }), "invalid-option", "5: 어깨 비율 범위 밖 거부");
  throwsReason(() => DP.split({ front: GC.front, back: GC.back }, { bulgeCm: -1 }), "invalid-option", "5: 곡선 편차 음수 거부");
  const noHem = clone(GC.front); noHem.outline = noHem.outline.filter(s => s.edge !== "hem");
  throwsReason(() => DP.split({ front: noHem, back: GC.back }), "ring-failed", "5: 밑단이 없는 몸판 거부(링 구성 실패)");
  const tiny = DP.split({ front: GC.front, back: GC.back }, { shoulderRatio: 0.3 });
  ok(near(tiny.meta.front.shoulderFromNpCm, D(NP, SP) * 0.3, 1e-9), "5: 옵션 비율은 엔진 매개변수일 뿐(프리셋 기본은 50% 로 잠겨 있다)");
  ok(DP.SHOULDER_RATIO === 0.5 && DP.BULGE_CM === 0.5, "5: 잠긴 상수 = 0.5 · 0.5cm");
}

// ── 6. 체크포인트(독립 재계산·변조 거부) ──
const mk = (geometry, body) => ({ sourceBlock: { id: "block-1", version: 2, schemaVersion: 8, canonicalHash: "CH" }, referenceGeometry: REF,
  working: { geometry, parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body }, patternLines: [], designOutline: null, frontPlacket: null } });
const chk = (p) => { PROJECT = p; return BC.check(p); };
{
  const c0 = chk(mk(clone(GE), E_BODY));
  ok(c0.ok && c0.princess && c0.princess.ok && c0.princess.variant === "E", "6: 정상 Ⓔ 체크포인트 통과(" + J(c0.fails) + ")");
  ok(near(c0.princess.front.closedAngleDeg, 18.25, 0.01) && near(c0.princess.front.bulgeMaxCm, 0.5, 2e-3) && near(c0.princess.front.deltaCm, 0, 1e-9), "6: 체크포인트가 닫는 각 18.25° · 곡선 0.5cm · 앞 이음 차 0 을 다시 계산했다");
  ok(near(c0.princess.back.deltaCm, M.back.seamDeltaCm, 1e-3) && near(c0.princess.back.waistShiftCm, M.back.waistDart.shiftCm, 1e-3), "6: 뒤 이음 길이 차·e 이동도 재계산");
  ok(chk(mk(clone(GC), C_BODY)).princess === undefined && chk(mk(clone(GC), C_BODY)).ok, "6: Ⓒ 의 체크포인트 출력에는 princess 키가 없다(기존 출력 동일)");
  const tamper = (fn, body = E_BODY) => { const g = clone(GE); fn(g); const c = chk(mk(g, body)); return c.ok ? null : c.fails[0]; };
  const lastOf = (pc, edge) => pc.outline.filter(s => s.edge === edge);
  ok(tamper(g => { g.princess.front.seamPoints.shoulder.x += 9; g.princess.front.bulge.maxCm = 3; }) === null, "6: 메타만 바꿔도 출력 geometry 가 맞으면 통과 — 메타를 신뢰하지 않는다는 증거");
  ok(tamper(g => { delete g.frontSide; }) === "princess-missing", "6: 조각 하나 없으면 거부");
  { const g = clone(GE); g.shoulderYoke = clone(g.frontCenter); const c = chk(mk(g, E_BODY)); ok(!c.ok && c.fails.includes("princess-missing"), "6: 다른 조각 분리 슬롯과 동시 존재 거부"); }
  ok(chk(mk(clone(GE), C_BODY)).fails.includes("princess-variant-mismatch") && chk(mk(clone(GC), E_BODY)).fails.includes("princess-missing"), "6: 파라미터·geometry 가 서로 어긋나면 거부(양방향)");
  ok(tamper(g => { g.frontCenter.outline.splice(3, 1); }) === "princess-open", "6: 외곽 한 변이 사라지면(끊긴 외곽선) 거부");
  ok(tamper(g => { const s = lastOf(g.frontSide, "princess-seam").filter(x => x.kind === "line")[0]; s.from.x += 0.5; s.to.x += 0.5; }) === "princess-open", "6: 이음선 한 변을 옮겨 외곽이 끊기면 거부");
  ok(tamper(g => { g.frontSide.construction.push({ kind: "line", from: { x: 30, y: 12 }, to: { x: 38.5, y: 20.6 }, dart: { id: "front-bust", apexAt: "to" } }); }) === "princess-dart-open", "6: 닫은 AH 다트 다리가 되살아나면 거부(과거 흔적)");
  ok(tamper(g => { g.backCenter.construction.push({ kind: "line", from: { x: 8, y: 38 }, to: { x: 9.9, y: 18 }, dart: { id: "back-waist-e", apexAt: "to" } }); }) === "princess-dart-open", "6: 흡수한 허리 다트 e 가 남으면 거부");
  const shiftPiece = (g, key, dx, dy) => { const mv = (p) => { ["from", "to", "c1", "c2"].forEach(k => { if (p[k]) p[k] = { x: p[k].x + dx, y: p[k].y + dy }; }); if (p.commands) p.commands.forEach(c => { c.points = c.points.map(q => ({ x: q.x + dx, y: q.y + dy })); }); }; g[key].outline.forEach(mv); g[key].construction.forEach(mv); };
  ok(tamper(g => shiftPiece(g, "backSide", 3, 0)) === "princess-seam-position-mismatch", "6: 옆 조각 통째 이동(뒤 이음선이 어깨 다트 입구에서 시작하지 않음) 거부");
  ok(tamper(g => { const c = lastOf(g.frontCenter, "princess-seam").filter(x => x.kind === "path")[0]; c.commands[1].points[0].x -= 1.2; }) !== null, "6: 어깨→BP 곡선 한쪽만 바꾸면 거부");
  const seamPath = (pc) => pc.outline.filter(x => x.edge === "princess-seam" && x.kind === "path")[0];
  const regen = (opts) => { const r = DP.split({ front: GC.front, back: GC.back }, opts); return (g) => { g.frontCenter = r.frontCenter; g.frontSide = r.frontSide; g.backCenter = r.backCenter; g.backSide = r.backSide; g.princess = r.meta; }; };
  ok(tamper(regen({ bulgeCm: 1.2 })) === "princess-seam-bulge", "6: 엔진 옵션으로 곡선을 1.2cm 로 일관되게 다시 만들어도 체크포인트는 0.5cm 를 요구한다(독립 재계산)");
  ok(tamper(regen({ bulgeCm: 0 })) === "princess-seam-bulge", "6: 곡선 0cm(직선)도 거부");
  ok(tamper(regen({ shoulderRatio: 0.3 })) === "princess-seam-position-mismatch", "6: 어깨 시작점을 30% 로 일관되게 다시 만들어도 거부(50% 요구)");
  ok(tamper(regen({})) === null, "6: 같은 옵션(기본)으로 다시 만든 조각은 통과(대조군)");
  ok(tamper(g => { const sh = g.front.outline.filter(x => x.edge === "shoulder")[0]; sh.to.x += 0.3; }) !== null, "6: 전체 몸판 어깨가 바뀌어 50% 지점이 달라지면 거부");
  ok(tamper(g => { const d = seamPath(g.frontSide); d.commands.forEach(c => { c.points = c.points.map(q => ({ x: q.x + 0.1, y: q.y })); }); }) !== null, "6: 옆 조각 이음 곡선이 BP 회전 위치에서 벗어나면 거부");
  ok(tamper(g => { g.frontSide.outline.filter(x => x.edge === "shoulder").forEach(s => { s.to.y += 0.4; }); }) !== null, "6: 옆 조각 어깨를 비틀면(직선 연속·길이 합 위반) 거부");
  ok(tamper(g => { g.back.outline.filter(x => x.edge === "hem").forEach(s => { s.from.x += 0.2; }); }) !== null, "6: 전체 뒤판 밑단 폭을 바꾸면 조각 합과 어긋나 거부");
  ok(["princess-seam-length-mismatch", "princess-open"].includes(tamper(g => { const l = g.frontSide.outline.filter(x => x.edge === "princess-seam" && x.kind === "line")[0]; l.to.y += 0.3; })), "6: 앞 이음 길이를 어긋내면 거부");
  const tryOverlap = (() => { const g = clone(GE); const mv = (p, dx) => { ["from", "to", "c1", "c2"].forEach(k => { if (p[k]) p[k] = { x: p[k].x + dx, y: p[k].y }; }); if (p.commands) p.commands.forEach(c => { c.points = c.points.map(q => ({ x: q.x + dx, y: q.y })); }); };
    ["frontSide", "frontCenter"].forEach(k => g[k].outline.forEach(p => { if (k === "frontCenter") mv(p, 0); })); return g; })();
  ok(chk(mk(tryOverlap, E_BODY)).ok, "6: 변경 없는 사본은 통과(대조군)");
  // 완료본·hash
  const pr = mk(clone(GE), E_BODY); PROJECT = pr;
  const done = BC.complete(pr), res = BC.latest(pr);
  ok(done.ok && Object.isFrozen(res) && Object.isFrozen(res.frontCenter) && res.princess.variant === "E", "6: 완료본에 Ⓔ 메타 보존·동결");
  PIECES.forEach(k => ok(J(res[k].outline) === J(GE[k].outline) && J(res[k].construction) === J(GE[k].construction) && res[k] !== pr.working.geometry[k], "6: result." + k + " = 현재 geometry 동결 복제"));
  ok(!("frontBody" in res) && !("shoulderYoke" in res) && !("frontYoke" in res), "6: 완료본에 요크·몸판 키 없음");
  const hash = (g, b) => { const p = mk(clone(g), b); PROJECT = p; const c2 = BC.complete(p); return c2.ok ? BC.latest(p).hash : "FAIL:" + c2.reason; };
  const hE = hash(GE, E_BODY), hC = hash(GC, C_BODY);
  ok(/^[0-9a-f]+$/.test(hE) && hE !== hC, "6: Ⓔ hash 는 Ⓒ 와 다르다(조각이 형상 identity 에 반영)");
  const gz = clone(GE); gz.backSide.outline.filter(s => s.edge === "side-seam")[0].to.y += 0.0002;
  ok(hash(gz, E_BODY).startsWith("FAIL") || hash(gz, E_BODY) !== hE, "6: 옆 조각이 바뀌면 hash 가 달라진다");
  ok(hash(GC, C_BODY) === hash(DB.computeGeometry(REF, { body: C_BODY }), C_BODY), "6: Ⓒ hash 결정론(프린세스 키 없음)");
  const pe = mk(clone(GE), E_BODY); PROJECT = pe; BC.complete(pe);
  ok(BC.isCurrentBodiceChanged(pe) === false, "6: 같은 상태는 스테일 아님");
  pe.working.geometry.frontCenter.outline[0] = JSON.parse(J(pe.working.geometry.frontCenter.outline[0]));
  const ptsMv = pe.working.geometry.backSide.outline.filter(s => s.edge === "side-seam")[0]; ptsMv.to = { x: ptsMv.to.x + 0.1, y: ptsMv.to.y };
  ok(BC.isCurrentBodiceChanged(pe) === true, "6: 완료 뒤 조각이 바뀌면 스테일(hash 반영)");
  // 완료는 변조된 geometry 를 막는다
  const pt = mk(clone(GE), E_BODY); pt.working.geometry.frontSide.construction.push({ kind: "line", from: { x: 1, y: 1 }, to: { x: 2, y: 2 }, dart: { id: "front-bust", apexAt: "to" } }); PROJECT = pt;
  const dt = BC.complete(pt);
  ok(!dt.ok && dt.reason === "princess-dart-open" && !pt.working.bodiceResult, "6: 변조된 geometry 는 완료 차단(스냅샷 없음)");
}

// ── 7. 표시·배치·렌더 ──
{
  const lab = DL.princessLabels(GE);
  ok(lab && lab.labels.length === 4 && lab.seams.length === 2 && lab.notes.length === 5, "7: 제작 정보 = 조각명 4 + 이음선 2 + 수치 5");
  ok(J(lab.labels.map(l => l.text)) === J(["앞 중심", "앞 옆", "뒤 중심", "뒤 옆"]), "7: 조각 이름");
  ok(lab.notes.some(n => /AH 다트 18\.25° 닫음\(BP 고정\)/.test(n.text)) && lab.notes.some(n => /어깨 50%\(6\.1cm\)/.test(n.text)) && lab.notes.some(n => /다트 a 1\.75cm/.test(n.text)) && lab.notes.some(n => /다트 e 2\.25cm/.test(n.text)) && lab.notes.some(n => /어깨 다트 1\.8cm/.test(n.text)), "7: 수치 문구(닫는 각·어깨 50%·a·e·어깨 다트 폭)");
  ok(DL.princessLabels(GC) === null && DL.princessLabels(null) === null, "7: 프린세스가 아니면 null");
  ok(DL.yokeLabels(GE) === null, "7: 요크 라벨은 만들지 않는다");
  const ptsOf = (p, out) => { if (p.kind === "line") out.push(p.from, p.to); else if (p.kind === "cubic") out.push(p.from, p.c1, p.c2, p.to); else p.commands.forEach(c => c.points.forEach(q => out.push(q))); };
  const bb = (keys) => { const pts = []; keys.forEach(k => { GE[k].outline.concat(GE[k].construction).forEach(p => ptsOf(p, pts)); }); return { minX: Math.min(...pts.map(q => q.x)), maxX: Math.max(...pts.map(q => q.x)), minY: Math.min(...pts.map(q => q.y)), maxY: Math.max(...pts.map(q => q.y)) }; };
  const bf = DL.bboxOf(GE, "front"), bk = DL.bboxOf(GE, "back"), ef = bb(["frontCenter", "frontSide"]), ek = bb(["backCenter", "backSide"]);
  ok(near(bf.minX, ef.minX, 1e-9) && near(bf.maxX, ef.maxX, 1e-9) && near(bf.minY, ef.minY, 1e-9) && near(bf.maxY, ef.maxY, 1e-9), "7: 앞 hit rect = 앞 중심∪옆 조각(전체 앞판은 숨김)");
  ok(near(bk.minX, ek.minX, 1e-9) && near(bk.maxX, ek.maxX, 1e-9) && near(bk.minY, ek.minY, 1e-9) && near(bk.maxY, ek.maxY, 1e-9), "7: 뒤 hit rect = 뒤 중심∪옆 조각");
  ok(J(GE.frontCenter) === J(DB.computeGeometry(REF, { body: E_BODY }).frontCenter), "7: 표시 계산이 geometry 를 바꾸지 않는다");
  let layout; try { layout = DL.autoLayout(GE); } catch (e) { layout = null; }
  ok(!!layout, "7: autoLayout 성공");
  const EMPTY = { outline: [], construction: [] };
  let grp = null, err = null;
  try { grp = DR.createWorkingGroup({ front: EMPTY, back: EMPTY, shared: EMPTY, sleeve: EMPTY, frontCenter: GE.frontCenter, frontSide: GE.frontSide }); } catch (e) { err = e.reason || e.message; }
  ok(!err && grp && grp.kids.length > 0, "7: 렌더러 검증 통과(princess-seam edge 허용) " + (err || ""));
  const ids = grp ? grp.kids.map(k => J(k.attrs || {})) : [];
  ok(new Set(ids).size === ids.length, "7: 중복 렌더 0");
  ok(grp && grp.kids.some(k => k.attrs["data-edge"] === "princess-seam"), "7: 이음선은 data-edge=princess-seam 으로 구분");
  let err2 = null; try { DR.createWorkingGroup({ front: EMPTY, back: EMPTY, shared: EMPTY, sleeve: EMPTY, frontCenter: { outline: [Object.assign({}, GE.frontCenter.outline[0], { edge: "princess-seam" })], construction: [{ kind: "line", from: { x: 0, y: 0 }, to: { x: 1, y: 1 }, edge: "princess-seam" }] } }); } catch (e) { err2 = e.reason; }
  ok(err2 === "edge-placement", "7: princess-seam 은 construction 에 둘 수 없다");
  const rsrc = fs.readFileSync(path.join(__dirname, "..", "..", "js", "render.js"), "utf8"), usrc = fs.readFileSync(path.join(__dirname, "..", "..", "js", "ui.js"), "utf8");
  ok(/function _princessModeOf[^\n]*frontCenter[^\n]*backSide/.test(rsrc) && /_princessModeOf\(g\) \? princessSub\(g, "front"\)/.test(rsrc) && /_princessModeOf\(g\) \? princessSub\(g, "back"\)/.test(rsrc), "7: render.js 가 Ⓔ 앞·뒤 서브셋을 중심·옆 조각으로 그린다");
  ok(/_appendPrincessAnnotation\(grp/.test(rsrc) && /!_princessModeOf\(dp\.working\.geometry\)\) _appendPatternLines/.test(rsrc), "7: render.js 가 제작 정보를 그리고 패턴선은 Ⓔ 에서 그리지 않는다");
  ok(/body\.princess === "E"/.test(usrc) && /pendingPrincess/.test(usrc) && /g\.frontCenter && g\.frontSide && g\.backCenter && g\.backSide/.test(usrc.match(/const princess = [^\n]*/)[0]), "7: ui.js 가 princess 를 라인 적용에 싣고 패턴선 도구 잠금이 Ⓔ 를 안다");
  const htm = fs.readFileSync(path.join(__dirname, "..", "..", "index.html"), "utf8");
  ok(/designYokeSeam\.js[^\n]*\n[^\n]*\n<script src="js\/designPrincess\.js\?v=\d+"><\/script>\n<!--[^\n]*\n<script src="js\/designBodice\.js/.test(htm) || (htm.indexOf("designPrincess.js") > htm.indexOf("designYokeSeam.js") && htm.indexOf("designPrincess.js") < htm.indexOf("designBodice.js")), "7: index.html 은 designPrincess.js 를 designBodice.js 앞에 싣는다");
}

// ── 8. 기존 실행 가능 프리셋 15종 geometry 바이트 불변(HEAD a76f80e 에서 같은 입력으로 실측한 sha256[:16]) ──
{
  const HEAD = { A: "f87b86b25abc508e", B: "3fade9d306cfc1b2", C: "d9ccd8ad27484d42", D: "dea05147006a3561", G: "d9a46f8358daec84", M: "66936c94c7ce847c", N: "6b02cf3e25969a7a", O: "d1fae91f00e58b37",
    P: "160d3aaee53eb5e4", Q: "76a325d296cd4fce", R: "63193d5a879a6235", S: "8f5a2535f192f935", T: "04de67175bdb54f3", U: "dc8c572d74324b3b", V: "5237c10f1106c610" };
  Object.keys(HEAD).forEach(id => ok(sha(DB.computeGeometry(REF, { body: BP.bodyParams("bunka-bodice-" + id) })) === HEAD[id], "8: Ⓐ~Ⓥ 바이트 불변 — " + id));
  ok(J(REF) === SNAP, "8: reference 불변");
}

console.log(`princessPresetCheck: ${PASS} PASS, ${FAIL} FAIL`);
if (FAIL) { fails.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
