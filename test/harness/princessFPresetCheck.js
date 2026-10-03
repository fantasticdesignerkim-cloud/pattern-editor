// princessFPresetCheck.js — 프린세스 라인 Ⓕ(P.19, «허리 다트 1개, 옆에서 1.5cm 줄이고 밑단에서 1cm 추가») 회귀.
//   node test/harness/princessFPresetCheck.js
// 책(P.19): «Ⓔ 와 같은 방법으로 더 줄인 디자인. 앞은 다트 a + 1cm, 뒤는 다트 e + 1.5cm, 옆선에서 각각 1.5cm 줄인다. 1개의 이음선에서 줄일 수 있는 분량은 이것이 최대.»
//   → Ⓔ 의 designPrincess 경로를 그대로 쓰고, 몸판 파라미터만 다르다(옆선 −1.5 · 다트 폭 절대 +1 / +1.5). 조각 수·절개 규칙·AH 닫기는 Ⓔ 와 같다.
// 범위: (1) 카탈로그·파라미터 계약 (2) Ⓔ 와 같은 것/다른 것 (3) 다트 폭·마름모·옆선·밑단 수치 (4) 물리 (5) 엔진 원자적 거부
//       (6) 체크포인트 독립 재계산·변조 거부·완료본/hash (7) 표시 (8) 기존 실행 가능 프리셋(Ⓔ 포함 16종) geometry 바이트 불변(HEAD 9d9a9d7 실측)
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

const F_BODY = BP.bodyParams("bunka-bodice-F"), E_BODY = BP.bodyParams("bunka-bodice-E"), C_BODY = BP.bodyParams("bunka-bodice-C");
const GF = DB.computeGeometry(REF, { body: F_BODY });
const GE = DB.computeGeometry(REF, { body: E_BODY });
const GC = DB.computeGeometry(REF, { body: C_BODY });
const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const segsOf = (outline) => T.outlinePrimsToSegs(outline);
const areaOf = (segs) => { const pts = []; T.flattenLine(segs).forEach(ab => { if (!pts.length) pts.push(ab[0]); pts.push(ab[1]); }); let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p.x * q.y - q.x * p.y; } return Math.abs(a / 2); };
function ringOf(outline, eps = 1e-6) {
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
const legsOf = (pc, id) => pc.construction.filter(s => s.dart && s.dart.id === id);
const apexOf = (l) => l.dart.apexAt === "to" ? l.to : l.from, footOf = (l) => l.dart.apexAt === "to" ? l.from : l.to;
const M = GF.princess;
const ptsOfPrim = (p, out) => { if (p.kind === "line") out.push(p.from, p.to); else if (p.kind === "cubic") out.push(p.from, p.c1, p.c2, p.to); else p.commands.forEach(c => c.points.forEach(q => out.push(q))); };
const bbox = (g, keys) => { const pts = []; keys.forEach(k => g[k].outline.forEach(p => ptsOfPrim(p, pts))); return { minX: Math.min(...pts.map(q => q.x)), maxX: Math.max(...pts.map(q => q.x)), minY: Math.min(...pts.map(q => q.y)), maxY: Math.max(...pts.map(q => q.y)) }; };

// ── 1. 카탈로그·파라미터 계약 ──
ok(BP.resolve("princess-line", "bunka-bodice-F").ok && BP.resolve("princess-line", "bunka-bodice-F").presetId === "bunka-bodice-F", "1: Ⓕ 해석 성공(실행 가능)");
ok(BP.variant("princess-line", "bunka-bodice-F").availability === "available" && BP.variant("princess-line", "bunka-bodice-F").page === 19 && BP.variant("princess-line", "bunka-bodice-F").symbol === "F", "1: Ⓕ available · P.19");
ok(J(F_BODY) === J({ hemExtensionBelowWaistCm: 20, waistSideOffsetCm: -1.5, hemSideOffsetCm: 1, waistDartScales: { a: 1, b: 0, d: 0, e: 1 }, waistDartExtraCm: { a: 1, e: 1.5 }, princess: "F" }), "1: Ⓕ 파라미터 = 옆선 −1.5 · 밑단 +1 · 다트 a·e · 폭 +1/+1.5 · princess:F");
ok(J(E_BODY) === J(Object.assign({}, C_BODY, { princess: "E" })) && !("waistDartExtraCm" in E_BODY), "1: Ⓔ 레코드 불변(다트 폭 추가 없음)");
ok(BP.family("princess-line").variants.every(v => v.availability === "available"), "1: 프린세스 라인 두 변형 모두 실행 가능");
throwsReason(() => DB.computeGeometry(REF, { body: Object.assign({}, F_BODY, { waistSeam: true }) }), "princess-conflict", "1: Ⓕ+허리 이음선 거부");
throwsReason(() => DB.computeGeometry(REF, { body: Object.assign({}, F_BODY, { yokeSeam: "U" }) }), "princess-conflict", "1: Ⓕ+요크 이음선 거부");
throwsReason(() => DB.computeGeometry(REF, { body: Object.assign({}, F_BODY, { flare: true }) }), "princess-conflict", "1: Ⓕ+플레어 거부");
throwsReason(() => DB.computeGeometry(REF, { body: Object.assign({}, F_BODY, { waistDartExtraCm: { a: -1, e: 1.5 } }) }), "invalid-waist-dart-extra", "1: 음수 폭 추가 거부");
throwsReason(() => DB.computeGeometry(REF, { body: Object.assign({}, F_BODY, { waistDartExtraCm: { a: "1", e: 1.5 } }) }), "invalid-waist-dart-extra", "1: 숫자 아닌 폭 추가 거부");
throwsReason(() => DB.computeGeometry(REF, { body: Object.assign({}, F_BODY, { waistDartExtraCm: { A: 1 } }) }), "invalid-waist-dart-extra", "1: 기호가 아닌 키 거부");
throwsReason(() => DB.computeGeometry(REF, { body: Object.assign({}, F_BODY, { waistDartExtraCm: [1] }) }), "invalid-waist-dart-extra", "1: 배열 거부");
ok(J(DB.computeGeometry(REF, { body: F_BODY })) === J(GF), "1: 결정론");
ok(J(REF) === SNAP, "1: 입력 reference 불변");

// ── 2. Ⓔ 와 같은 것 / 다른 것 ──
ok(PIECES.every(k => GF[k] && Array.isArray(GF[k].outline) && GF[k].outline.length >= 3), "2: 중심·옆 네 조각(총 4조각)");
ok(!GF.frontBody && !GF.shoulderYoke && !GF.frontYoke && !GF.frontPeplum && !GF.waistSeam && !GF.yokeSeam, "2: 다른 조각 분리 슬롯 없음");
ok(M.variant === "F" && M.waistDartExtra && M.waistDartExtra.front.a.extraCm === 1 && M.waistDartExtra.back.e.extraCm === 1.5, "2: 메타 variant F · 다트 폭 추가 기록");
ok(GE.princess.variant === "E" && !("waistDartExtra" in GE.princess), "2: Ⓔ 메타에는 다트 폭 추가가 없다");
ok(J(M.front.seamPoints.shoulder) === J(GE.princess.front.seamPoints.shoulder) && near(M.front.shoulderFromNpCm, GE.princess.front.shoulderFromNpCm, 1e-9) && near(M.front.closedDart.angleDeg, GE.princess.front.closedDart.angleDeg, 1e-9), "2: 어깨 절개 시작점(50%)·AH 닫는 각은 Ⓔ 와 같다");
ok(near(M.front.closedDart.angleDeg, 18.25, 0.01) && near(M.front.bulge.maxCm, 0.5, 2e-3), "2: AH 18.25° 닫음 · 곡선 0.5cm 그대로");
ok(J(M.back.seamPoints.shoulderApex) === J(GE.princess.back.seamPoints.shoulderApex), "2: 뒤 이음선은 같은 어깨 다트 입구에서 시작");
ok(J(GF.shared) === J(GE.shared) && J(GF.sleeve) === J(GE.sleeve), "2: shared/sleeve 는 Ⓔ 와 같다");
ok(J(GF.front) !== J(GE.front) && J(GF.back) !== J(GE.back), "2: 전체 앞/뒤판은 Ⓔ 와 다르다(옆선·다트 폭)");

// ── 3. 수치: 다트 폭·마름모·옆선·밑단(출력 geometry 에서 독립 재계산) ──
const wF = GF.front, wB = GF.back, eF = GE.front, eB = GE.back;
const wid = (pc, id) => { const l = legsOf(pc, id); return D(footOf(l[0]), footOf(l[1])); };
{
  ok(near(wid(eF, "front-waist-a"), 1.75, 1e-6) && near(wid(eB, "back-waist-e"), 2.25, 1e-6), "3: Ⓔ 기준 폭 a 1.75 · e 2.25");
  ok(near(wid(wF, "front-waist-a"), 2.75, 1e-6) && near(wid(wB, "back-waist-e"), 3.75, 1e-6), "3: Ⓕ 앞 다트 a = 1.75 + 1 = 2.75 · 뒤 다트 e = 2.25 + 1.5 = 3.75");
  ok(near(wid(wF, "front-waist-a") - wid(eF, "front-waist-a"), 1, 1e-9) && near(wid(wB, "back-waist-e") - wid(eB, "back-waist-e"), 1.5, 1e-9), "3: 증가량 정확히 1 / 1.5");
  const apexA = apexOf(legsOf(wF, "front-waist-a")[0]), apexAe = apexOf(legsOf(eF, "front-waist-a")[0]);
  ok(D(apexA, apexAe) < 1e-9 && D(apexOf(legsOf(wB, "back-waist-e")[0]), apexOf(legsOf(eB, "back-waist-e")[0])) < 1e-9, "3: 다트 끝(apex)은 Ⓔ 와 같다(입 중점 고정·폭만 커진다)");
  const mid = (pc, id) => { const l = legsOf(pc, id); return { x: (footOf(l[0]).x + footOf(l[1]).x) / 2, y: footOf(l[0]).y }; };
  ok(D(mid(wF, "front-waist-a"), mid(eF, "front-waist-a")) < 1e-9 && D(mid(wB, "back-waist-e"), mid(eB, "back-waist-e")) < 1e-9, "3: 입 중점 불변(대칭 확대)");
  // 조각 마름모: 중심·옆 이음선의 WL 발 사이 거리 = 폭, 중점 = 축
  const footPts = (pc, y) => { const o = []; pc.outline.filter(s => s.edge === "princess-seam" && s.kind === "line").forEach(s => [s.from, s.to].forEach(q => { if (Math.abs(q.y - y) < 1e-4) o.push(q); })); return o[0]; };
  const yA = footOf(legsOf(wF, "front-waist-a")[0]).y, yE = footOf(legsOf(wB, "back-waist-e")[0]).y;
  const fC = footPts(GF.frontCenter, yA), fS = footPts(GF.frontSide, yA), bC = footPts(GF.backCenter, yE), bS = footPts(GF.backSide, yE);
  ok(fC && fS && near(Math.abs(fC.x - fS.x), 2.75, 1e-4) && near(Math.abs(bC.x - bS.x), 3.75, 1e-4), "3: 이음선 마름모 폭 앞 2.75 · 뒤 3.75 (WL)");
  const bpx = apexOf(legsOf(wF, "front-bust")[0]).x;
  ok(near((fC.x + fS.x) / 2, bpx, 1e-4), "3: 앞 마름모는 BP 축 둘레 대칭");
  ok(near(M.front.waistDart.widthCm, 2.75, 1e-6) && near(M.back.waistDart.widthCm, 3.75, 1e-6), "3: 메타 마름모 폭 = 재계산");
  // 옆선 −1.5 · 밑단 +1: 허리 옆점은 Ⓔ(−1)보다 0.5 안쪽, 밑단 옆점은 같다
  const wx = (g, side) => { const sg = segsOf(g[side].outline).filter(x => x.edge === "side-seam"); const ys = []; sg.forEach(s => [s.from, s.to].forEach(q => ys.push(q))); return ys; };
  const sideX = (g, side, y) => { const q = wx(g, side).filter(p => Math.abs(p.y - y) < 1e-4)[0]; return q ? q.x : null; };
  const wlY = (g) => { const l = legsOf(g.front, "front-waist-a")[0]; return footOf(l).y; };
  const yw = wlY(GF);
  const sF = sideX(GF, "front", yw), sE = sideX(GE, "front", yw);
  ok(sF != null && sE != null && near(Math.abs(sF - sE), 0.5, 1e-6), "3: 앞 허리 옆선점 = Ⓔ 보다 0.5cm 더 줄임(−1.5 vs −1) " + (sF != null ? Math.abs(sF - sE).toFixed(4) : "null"));
  const yb = yE, sBF = sideX(GF, "back", yb), sBE = sideX(GE, "back", yb);
  ok(sBF != null && sBE != null && near(Math.abs(sBF - sBE), 0.5, 1e-6), "3: 뒤 허리 옆선점도 0.5cm 더 줄임");
  const hemY = (g, side) => Math.max(...segsOf(g[side].outline).filter(x => x.edge === "hem").flatMap(s => [s.from.y, s.to.y]));
  const sH = sideX(GF, "front", hemY(GF, "front")), sHE = sideX(GE, "front", hemY(GE, "front"));
  ok(sH != null && near(sH, sHE, 1e-9), "3: 밑단 옆선점(+1)은 Ⓔ 와 같다");
  // 허리 둘레: Ⓔ 대비 감소 = 2×(앞 2.5 + 양 옆선 0.5×2)… 독립 계산: (1+1.5 다트) + (0.5+0.5 옆선) = 3.5 반폭 → 둘레 7.0
  const gmF = BC.girthMeasure(mkQuick(GF, F_BODY)), gmE = BC.girthMeasure(mkQuick(GE, E_BODY));
  ok(gmF && gmE && near(gmE.waist.finishedCm - gmF.waist.finishedCm, 7.0, 0.01), "3: 완성 허리둘레 Ⓔ 대비 −7.0cm (다트 2.5 + 옆선 1.0, 반폭×2) " + (gmF ? (gmE.waist.finishedCm - gmF.waist.finishedCm).toFixed(4) : ""));
  ok(gmF.waist.finishedCm < gmE.waist.finishedCm, "3: 더 줄인 디자인(Ⓕ 허리 < Ⓔ 허리)");
}

// ── 4. 물리(제1법칙: 우리는 종이 위에 있다) ──
{
  const rings = {}, areas = {};
  PIECES.forEach(k => { const r = ringOf(GF[k].outline); rings[k] = r; ok(!!r, "4: " + k + " 폐곡선"); if (r) { ok(!selfCross(r), "4: " + k + " 자기교차 0"); areas[k] = areaOf(r); ok(areas[k] > 1, "4: " + k + " 면적 > 0"); } });
  PIECES.forEach(k => ok(GF[k].outline.concat(GF[k].construction).every(s => !(s.dart && /front-bust|back-shoulder|front-waist-a|back-waist-e/.test(s.dart.id))), "4: " + k + " 에 열린/닫힌 다트 흔적 없음(마름모는 이음선이 대신)"));
  // 면적: Ⓕ 마름모가 Ⓔ 보다 커진 만큼 조각 합이 줄어든다(전체 몸판의 옆선 이동분 제외하고 체크포인트가 독립 재계산)
  const sumF = areas.frontCenter + areas.frontSide, sumE = areaOf(ringOf(GE.frontCenter.outline)) + areaOf(ringOf(GE.frontSide.outline));
  ok(sumF < sumE, "4: 앞 조각 면적 합 Ⓕ < Ⓔ (더 줄임) " + sumF.toFixed(2) + " < " + sumE.toFixed(2));
  const bsumF = areas.backCenter + areas.backSide, bsumE = areaOf(ringOf(GE.backCenter.outline)) + areaOf(ringOf(GE.backSide.outline));
  ok(bsumF < bsumE, "4: 뒤 조각 면적 합 Ⓕ < Ⓔ");
  // 마름모 면적 = ½·폭·길이: 전체 몸판 면적 − 조각 합(앞·뒤 각각)이 이를 따른다 → 체크포인트 areaDeltaCm2 = 0 로 확인(아래 6)
}

// ── 5. 엔진 원자적 거부 ──
{
  throwsReason(() => DB.computeGeometry(REF, { body: Object.assign({}, F_BODY, { waistDartScales: { a: 0, e: 0, b: 0, d: 0 } }) }), "princess-failed", "5: 다트 a·e 없으면(폭 추가 대상 없음) 거부");
  throwsReason(() => DP.split({ front: GC.front, back: GC.back }, { variant: "G" }), "invalid-variant", "5: variant G 거부");
  ok(DP.split({ front: GC.front, back: GC.back }).meta.variant === "E" && DP.split({ front: GC.front, back: GC.back }, { variant: "F" }).meta.variant === "F", "5: variant 기본 E · F 표식");
  const before = J(REF); DB.computeGeometry(REF, { body: F_BODY }); ok(J(REF) === before, "5: 입력 불변");
  // 엔진 옵션 자체는 Ⓕ 와 독립 — Ⓔ 몸판에 폭 추가를 주면 Ⓔ 가 아닌 Ⓕ 규칙이 아니므로 체크포인트가 거부한다(아래 6)
}

// ── 6. 체크포인트(독립 재계산·변조 거부) ──
function mkQuick(geometry, body) { return { sourceBlock: { id: "block-1", version: 2, schemaVersion: 8, canonicalHash: "CH" }, referenceGeometry: REF, baseSource: { measurements: { B: 83, W: 64, BL: 38 } },
  working: { geometry, parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body }, patternLines: [], designOutline: null, frontPlacket: null } }; }
const mk = mkQuick;
const chk = (p) => { PROJECT = p; return BC.check(p); };
{
  const c0 = chk(mk(clone(GF), F_BODY));
  ok(c0.ok && c0.princess && c0.princess.ok && c0.princess.variant === "F", "6: 정상 Ⓕ 체크포인트 통과(" + J(c0.fails) + ")");
  ok(near(c0.princess.front.closedAngleDeg, 18.25, 0.01) && near(c0.princess.front.bulgeMaxCm, 0.5, 2e-3) && near(c0.princess.front.deltaCm, 0, 1e-9), "6: 닫는 각 18.25° · 곡선 0.5cm · 앞 이음 차 0");
  ok(near(c0.princess.front.waistDartCm, 2.75, 1e-3) && near(c0.princess.back.waistDartCm, 3.75, 1e-3) && near(c0.princess.front.waistDartExtraCm, 1, 1e-3) && near(c0.princess.back.waistDartExtraCm, 1.5, 1e-3), "6: 체크포인트가 다트 폭 2.75/3.75 와 증가 1/1.5 를 다시 계산했다");
  ok(near(c0.princess.front.areaDeltaCm2, 0, 0.05) && near(c0.princess.back.areaDeltaCm2, 0, 0.05), "6: 면적 보존(전체 − 마름모 = 조각 합) 재계산");
  ok(chk(mk(clone(GE), E_BODY)).ok && chk(mk(clone(GE), E_BODY)).princess.variant === "E" && chk(mk(clone(GE), E_BODY)).princess.front.waistDartExtraCm === undefined, "6: Ⓔ 체크포인트는 그대로(폭 추가 키 없음)");
  const tamper = (fn, body = F_BODY) => { const g = clone(GF); fn(g); const c = chk(mk(g, body)); return c.ok ? null : c.fails[0]; };
  ok(chk(mk(clone(GF), E_BODY)).fails.includes("princess-variant-mismatch"), "6: Ⓕ geometry + Ⓔ 파라미터 거부");
  ok(chk(mk(clone(GE), F_BODY)).fails.includes("princess-variant-mismatch"), "6: Ⓔ geometry + Ⓕ 파라미터 거부");
  ok(tamper(() => {}, Object.assign({}, F_BODY, { waistDartExtraCm: { a: 2, e: 1.5 } })) === "princess-dart-extra-mismatch", "6: 파라미터 증가량이 책 값(a+1)과 다르면 거부");
  ok(tamper(() => {}, Object.assign({}, F_BODY, { waistDartExtraCm: { a: 1, e: 1 } })) === "princess-dart-extra-mismatch", "6: 파라미터 e +1 (책은 +1.5) 거부");
  { const b2 = clone(F_BODY); delete b2.waistDartExtraCm; ok(tamper(() => {}, b2) === "princess-dart-extra-mismatch", "6: Ⓕ 인데 다트 폭 추가 파라미터가 없으면 거부"); }
  ok(tamper(g => { g.princess.waistDartExtra.front.a.afterCm += 0.3; }) === "princess-dart-extra-mismatch", "6: 메타 전·후 폭이 출력 geometry 와 어긋나면 거부");
  ok(tamper(g => { g.princess.waistDartExtra.back.e.beforeCm -= 0.2; }) === "princess-dart-extra-mismatch", "6: 메타 증가량이 책 값과 어긋나면 거부");
  ok(tamper(g => { delete g.princess.waistDartExtra; }) === "princess-dart-extra-mismatch", "6: 메타에서 다트 폭 추가가 사라지면 거부");
  ok(tamper(g => { const r = DP.split({ front: DB.computeGeometry(REF, { body: Object.assign({}, F_BODY, { waistDartExtraCm: { a: 1, e: 1 } }) }).front, back: DB.computeGeometry(REF, { body: Object.assign({}, F_BODY, { waistDartExtraCm: { a: 1, e: 1 } }) }).back }, { variant: "F" });
    const g2 = DB.computeGeometry(REF, { body: Object.assign({}, F_BODY, { waistDartExtraCm: { a: 1, e: 1 } }) }); Object.keys(g2).forEach(k => { g[k] = g2[k]; }); }) === "princess-dart-extra-mismatch", "6: e +1 로 일관되게 만든 geometry(메타 포함)도 파라미터가 +1.5 를 요구하므로 거부");
  { const g = clone(GE); g.princess.variant = "F"; g.princess.waistDartExtra = clone(GF.princess.waistDartExtra); const c = chk(mk(g, F_BODY)); ok(!c.ok && c.fails[0] === "princess-dart-extra-mismatch", "6: Ⓔ 폭에 Ⓕ 메타만 붙여도 거부(메타 불신)"); }
  ok(tamper(g => { delete g.frontSide; }) === "princess-missing", "6: 조각 하나 없으면 거부");
  ok(tamper(g => { g.frontCenter.outline.splice(3, 1); }) === "princess-open", "6: 외곽 한 변 사라지면 거부");
  ok(tamper(g => { g.frontSide.construction.push({ kind: "line", from: { x: 30, y: 12 }, to: { x: 38.5, y: 20.6 }, dart: { id: "front-bust", apexAt: "to" } }); }) === "princess-dart-open", "6: 닫은 AH 다트 다리가 되살아나면 거부");
  // 완료본·hash
  const pr = mk(clone(GF), F_BODY); PROJECT = pr;
  const done = BC.complete(pr), res = BC.latest(pr);
  ok(done.ok && Object.isFrozen(res) && Object.isFrozen(res.frontCenter) && res.princess.variant === "F" && res.princess.waistDartExtra.front.a.extraCm === 1, "6: 완료본에 Ⓕ 메타(다트 폭 추가 포함) 보존·동결");
  PIECES.forEach(k => ok(J(res[k].outline) === J(GF[k].outline) && res[k] !== pr.working.geometry[k], "6: result." + k + " = geometry 동결 복제"));
  const hash = (g, b) => { const p = mk(clone(g), b); PROJECT = p; const c2 = BC.complete(p); return c2.ok ? BC.latest(p).hash : "FAIL:" + c2.reason; };
  const hF = hash(GF, F_BODY), hE = hash(GE, E_BODY);
  ok(/^[0-9a-f]+$/.test(hF) && hF !== hE, "6: Ⓕ hash 는 Ⓔ 와 다르다");
  ok(hash(GF, F_BODY) === hF && hash(GE, E_BODY) === hE, "6: 같은 입력 hash 동일");
}

// ── 7. 표시·배치·렌더 ──
{
  const lab = DL.princessLabels(GF), labE = DL.princessLabels(GE);
  ok(lab && lab.labels.length === 4 && lab.seams.length === 2 && lab.notes.length === 5, "7: 제작 정보 = 조각명 4 + 이음선 2 + 수치 5");
  ok(lab.notes.some(n => /다트 a 2\.75cm\(\+1\)/.test(n.text)) && lab.notes.some(n => /다트 e 3\.75cm\(\+1\.5\)/.test(n.text)) && lab.notes.some(n => /AH 다트 18\.25° 닫음/.test(n.text)) && lab.notes.some(n => /어깨 50%\(6\.1cm\)/.test(n.text)), "7: 수치 문구에 폭 추가 표기(+1 · +1.5)");
  ok(labE.notes.some(n => /다트 a 1\.75cm → 이음선/.test(n.text)) && !labE.notes.some(n => /\(\+/.test(n.text)), "7: Ⓔ 문구는 그대로");
  const bf = DL.bboxOf(GF, "front"), ef = bbox(GF, ["frontCenter", "frontSide"]);
  ok(near(bf.minX, ef.minX, 1e-9) && near(bf.maxX, ef.maxX, 1e-9) && near(bf.minY, ef.minY, 1e-9) && near(bf.maxY, ef.maxY, 1e-9), "7: 앞 hit rect = 앞 중심∪옆 조각");
  let layout; try { layout = DL.autoLayout(GF); } catch (e) { layout = null; }
  ok(!!layout, "7: autoLayout 성공");
  const EMPTY = { outline: [], construction: [] };
  let grp = null, err = null;
  try { grp = DR.createWorkingGroup({ front: EMPTY, back: EMPTY, shared: EMPTY, sleeve: EMPTY, frontCenter: GF.frontCenter, frontSide: GF.frontSide }); } catch (e) { err = e.reason || e.message; }
  ok(!err && grp && grp.kids.length > 0, "7: 렌더러 검증 통과 " + (err || ""));
  const usrc = fs.readFileSync(path.join(__dirname, "..", "..", "js", "ui.js"), "utf8");
  ok(/pendingDartExtra/.test(usrc) && /body\.waistDartExtraCm/.test(usrc) && /body\.princess === "E" \|\| body\.princess === "F"/.test(usrc) && /bunka-bodice-F"\) parts\.push/.test(usrc), "7: ui.js 가 princess E/F 와 다트 폭 추가를 라인 적용에 싣는다(다른 프리셋은 해제)");
  ok(/delete nextParameters\.body\.waistDartExtraCm/.test(usrc) && /pendingDartExtra = null;\s+\/\/ 다트 폭 추가 해제/.test(usrc), "7: 라인 초기화·다른 프리셋 적용 시 다트 폭 추가가 해제된다");
}

// ── 8. 기존 실행 가능 프리셋(Ⓔ 포함 16종) geometry 바이트 불변(HEAD 9d9a9d7 에서 같은 입력으로 실측한 sha256[:16]) ──
{
  const HEAD = { A: "f87b86b25abc508e", B: "3fade9d306cfc1b2", C: "d9ccd8ad27484d42", D: "dea05147006a3561", E: "c8445d93bfad289c", G: "d9a46f8358daec84", M: "66936c94c7ce847c", N: "6b02cf3e25969a7a", O: "d1fae91f00e58b37",
    P: "160d3aaee53eb5e4", Q: "76a325d296cd4fce", R: "63193d5a879a6235", S: "8f5a2535f192f935", T: "04de67175bdb54f3", U: "dc8c572d74324b3b", V: "5237c10f1106c610" };
  Object.keys(HEAD).forEach(id => ok(sha(DB.computeGeometry(REF, { body: BP.bodyParams("bunka-bodice-" + id) })) === HEAD[id], "8: Ⓐ~Ⓥ(Ⓕ 제외) 바이트 불변 — " + id));
  ok(J(REF) === SNAP, "8: reference 불변");
}

console.log(`princessFPresetCheck: ${PASS} PASS, ${FAIL} FAIL`);
if (FAIL) { fails.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
