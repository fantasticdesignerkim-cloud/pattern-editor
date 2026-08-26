// ══════════════════════════════════════════════
// designCollarCheck.js — js/designCollar.js C1c 순수 파생 회귀.
//   직선+원호 복합 스탠드(어깨 경계): 뒤목 직선 + 앞목 원호(frontRise 상승) + 여밈 접선 연장 + 윗선 오프셋.
//   frontRise=0 → C1 직선 스캐폴드 정확 재현. 봉제/연장 5분리 길이. 원자적 실패·불변.
//   node test/harness/designCollarCheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");
const SRC = fs.readFileSync(path.join(__dirname, "..", "..", "js", "designCollar.js"), "utf8");
let PASS = 0, FAIL = 0; const fails = [];
function ok(cond, name) { if (cond) PASS++; else { FAIL++; fails.push(name); } }
const near = (a, b, e = 1e-4) => Math.abs(a - b) < e;
const segLen = (s) => Math.hypot(s.to.x - s.from.x, s.to.y - s.from.y);
const partSeg = (g, part) => g.outline.find(s => s.part === part);
// cubic 조밀 점열(독립 ground-truth, 모듈과 다른 조밀 샘플).
function cubicPts(s, N) { const out = [s.from]; for (let i = 1; i <= N; i++) { const u = 1 - i / N, v = i / N;
  out.push({ x: u * u * u * s.from.x + 3 * u * u * v * s.c1.x + 3 * u * v * v * s.c2.x + v * v * v * s.to.x,
             y: u * u * u * s.from.y + 3 * u * u * v * s.c1.y + 3 * u * v * v * s.c2.y + v * v * v * s.to.y }); } return out; }
function cubicLen(s) { const p = cubicPts(s, 200); let t = 0; for (let i = 1; i < p.length; i++) t += Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y); return t; }
// 실제 출력 primitive 측정(line/cubic, 독립 조밀 2000샘플).
function denseSegLen(s) { if (s.kind === "line") return Math.hypot(s.to.x - s.from.x, s.to.y - s.from.y);
  const p = cubicPts(s, 2000); let t = 0; for (let i = 1; i < p.length; i++) t += Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y); return t; }
function partActual(g, part) { return g.outline.filter(s => s.part === part).reduce((t, s) => t + denseSegLen(s), 0); }
function partPts(g, part) { let pts = []; g.outline.filter(s => s.part === part).forEach((s, i) => { const p = s.kind === "line" ? [s.from, s.to] : cubicPts(s, 400); pts = pts.concat(i === 0 ? p : p.slice(1)); }); return pts; }
function ptToPolyDist(p, poly) { let best = Infinity; for (let i = 1; i < poly.length; i++) { const a = poly[i - 1], b = poly[i], dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy;
  let t = L2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t)); const d = Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)); if (d < best) best = d; } return best; }
// 테스트용 θ 해(모듈과 동일 계약, 독립 재구현).
function solveTheta(Llen, h) { let lo = 1e-9, hi = Math.PI; if (h >= Llen * (1 - Math.cos(hi)) / hi) return null;
  for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (Llen * (1 - Math.cos(m)) / m < h) lo = m; else hi = m; } return (lo + hi) / 2; }

const sandbox = { window: {}, Math, Object, JSON, Array, isFinite, Infinity };
vm.createContext(sandbox);
vm.runInContext(SRC, sandbox, { filename: "designCollar.js" });
const C = sandbox.window.designCollar;

// bodiceResult fixture: 뒤목 10, 앞목 8(half 18), 여밈 overlap 1.75.
function bodice(back, front, overlap) {
  const half = back + front;
  const b = { necklineLengths: { back, front, half, finished: 2 * half } };
  if (overlap !== undefined) b.placket = { parameters: { overlapCm: overlap, facingWidthCm: 4, lengthMode: "full" } };
  return b;
}

ok(typeof C.computeStand === "function" && typeof C.readBodice === "function" && Object.isFrozen(C), "0: API·frozen");
ok(C.referenceParams().standHeightCm === 3 && C.referenceParams().frontRiseCm === 1.5, "1: referenceParams standHeight 3·frontRise 1.5");

// 2. readBodice
{
  const r = C.readBodice(bodice(10, 8, 1.75));
  ok(r.ok && near(r.backCm, 10) && near(r.frontCm, 8) && near(r.overlapCm, 1.75), "2: readBodice 뒤10·앞8·overlap1.75");
  ok(C.readBodice(null).reason === "no-bodice", "2: no-bodice");
  ok(C.readBodice({ necklineLengths: { back: 10 } }).reason === "no-neckline", "2: front 누락→no-neckline");
  ok(C.readBodice(bodice(10, 0)).reason === "no-neckline", "2: front 0→no-neckline");
  ok(C.readBodice(bodice(10, 8, -1)).reason === "invalid-overlap", "2: invalid-overlap");
  ok(C.readBodice(bodice(10, 8)).ok && C.readBodice(bodice(10, 8)).overlapCm === 0, "2: placket 없음→overlap 0");
}

// 3. frontRise=0 → C1 직선 스캐폴드 정확 재현(단일 목둘레 봉제선, 5/4 세그, 길이).
{
  const r = C.computeStand(bodice(10, 8, 1.75), { standHeightCm: 3, frontRiseCm: 0 });
  ok(r.ok && r.standGeometry.outline.length === 5, "3: 직선 5세그(여밈)");
  const ns = partSeg(r.standGeometry, "neck-seam");
  ok(ns && ns.kind === "line" && near(segLen(ns), 18), "3: 단일 목둘레 봉제선 길이=half 18");
  ok(near(r.lowerNeckSeamLenCm, 18) && near(r.upperNeckSegmentLenCm, 18) && near(r.lowerExtensionLenCm, 1.75), "3: 직선 lower=upper=18·ext 1.75");
  ok(near(r.upperTotalLenCm, 19.75) && r.frontRiseCm === 0, "3: upperTotal 19.75·frontRise 0");
  const r2 = C.computeStand(bodice(10, 8), { standHeightCm: 3, frontRiseCm: 0 });
  ok(r2.standGeometry.outline.length === 4 && !partSeg(r2.standGeometry, "extension"), "3: 여밈 없음→4세그");
  // params 생략 시 기본 frontRise 1.5(곡선) — 직선 아님
  const rd = C.computeStand(bodice(10, 8, 1.75), { standHeightCm: 3 });
  ok(rd.ok && rd.frontRiseCm === 1.5 && !!partSeg(rd.standGeometry, "neck-seam-arc"), "3: 기본 frontRise 1.5→곡선(neck-seam-arc)");
}

// 4. 곡선 복합(back10 front8 rise1.5 H3 overlap1.75): 직선=뒤목·원호=앞목·어깨경계·접선·오프셋.
{
  const back = 10, front = 8, rise = 1.5, H = 3, ov = 1.75;
  const r = C.computeStand(bodice(back, front, ov), { standHeightCm: H, frontRiseCm: rise });
  ok(r.ok, "4: 곡선 파생 성공");
  const straight = partSeg(r.standGeometry, "neck-seam-straight"), arc = partSeg(r.standGeometry, "neck-seam-arc");
  ok(straight && near(segLen(straight), back), "4: lower 직선 길이=뒤목 10");
  ok(arc && near(partActual(r.standGeometry, "neck-seam-arc"), front, 2e-3), "4: lower 원호 실측≈앞목 8");
  ok(near(r.lowerNeckSeamLenCm, 18), "4: lower 전체 봉제=half 18");
  // 어깨 경계 위치 + 접선 연속(직선 방향 == 원호 시작 접선)
  ok(near(r.anchors.shoulderSeam.x, back) && near(r.anchors.shoulderSeam.y, 0), "4: 어깨 경계 (10,0)");
  const arcStartTan = { x: arc.c1.x - arc.from.x, y: arc.c1.y - arc.from.y };
  ok(arcStartTan.x > 0 && near(arcStartTan.y, 0, 1e-6), "4: 원호 시작 접선 = 수평(직선과 연속)");
  // CF 높이 = frontRise
  ok(near(r.anchors.cfSeam.y, -rise), "4: CF 높이 = -frontRise");
  // 여밈 연장이 CF 접선 방향
  const theta = solveTheta(front, rise), tEnd = { x: Math.cos(theta), y: -Math.sin(theta) };
  const extDir = { x: r.anchors.cfExtSeam.x - r.anchors.cfSeam.x, y: r.anchors.cfExtSeam.y - r.anchors.cfSeam.y };
  const extLen = Math.hypot(extDir.x, extDir.y);
  ok(near(extLen, ov) && near(extDir.x / extLen, tEnd.x, 1e-4) && near(extDir.y / extLen, tEnd.y, 1e-4), "4: 여밈 연장=1.75·CF 접선 방향");
  // 윗선 법선거리 = standHeight (어깨·CF 양쪽)
  ok(near(Math.hypot(r.anchors.shoulderTop.x - r.anchors.shoulderSeam.x, r.anchors.shoulderTop.y - r.anchors.shoulderSeam.y), H), "4: 어깨 윗선 법선거리=H");
  ok(near(Math.hypot(r.anchors.cfTop.x - r.anchors.cfSeam.x, r.anchors.cfTop.y - r.anchors.cfSeam.y), H, 1e-6), "4: CF 윗선 법선거리=H");
  // upperNeckSegmentLen ≈ back + (R-H)θ (실측이라 해석식과 근사), 그리고 < lowerNeckSeamLen. 엄밀 실측은 test 7.
  const R = front / theta, expUpper = back + (R - H) * theta;
  ok(near(r.upperNeckSegmentLenCm, expUpper, 5e-3) && r.upperNeckSegmentLenCm < r.lowerNeckSeamLenCm, "4: upperNeck≈back+(R-H)θ < lower");
  ok(near(r.upperExtensionLenCm, ov, 1e-6) && near(r.upperTotalLenCm, r.upperNeckSegmentLenCm + ov, 1e-9), "4: upperExt=1.75·upperTotal=upperNeck+ext");
  // 폐곡선 연속(각 to == 다음 from)
  let closed = true, o = r.standGeometry.outline;
  for (let i = 0; i < o.length; i++) { const nx = o[(i + 1) % o.length]; if (!near(o[i].to.x, nx.from.x, 1e-9) || !near(o[i].to.y, nx.from.y, 1e-9)) closed = false; }
  ok(closed, "4: 폐곡선 연속(오차 0)");
  // 곡선(overlap 없음) 세그 수 = 6
  const rn = C.computeStand(bodice(back, front), { standHeightCm: H, frontRiseCm: rise });
  ok(rn.ok && rn.standGeometry.outline.length === 6 && !partSeg(rn.standGeometry, "extension"), "4: 여밈 없는 곡선 6세그");
}

// 5. 원자적 실패
{
  ok(C.computeStand(bodice(10, 2, 1.75), { standHeightCm: 3, frontRiseCm: 1.0 }).reason === "invalid-stand-offset", "5: R−H≤0→invalid-stand-offset");
  ok(C.computeStand(bodice(10, 8, 1.75), { standHeightCm: 3, frontRiseCm: 6 }).reason === "invalid-front-rise", "5: rise 과대→invalid-front-rise");
  ok(C.computeStand(bodice(10, 8, 1.75), { standHeightCm: 3, frontRiseCm: -1 }).reason === "invalid-front-rise", "5: rise 음수→invalid-front-rise");
  ok(C.computeStand(bodice(10, 8, 1.75), { standHeightCm: 0, frontRiseCm: 1.5 }).reason === "invalid-stand-height", "5: height 0");
  ok(C.computeStand(bodice(10, 8, 1.75), { standHeightCm: 3, frontRiseCm: NaN }).reason === "invalid-front-rise", "5: rise NaN");
  ok(C.computeStand(null, { standHeightCm: 3, frontRiseCm: 1.5 }).reason === "no-bodice", "5: bodice null");
}

// 6. 입력·bodiceResult 불변
{
  const bod = bodice(10, 8, 1.75), before = JSON.stringify(bod);
  const p = { standHeightCm: 3, frontRiseCm: 1.5 }, pb = JSON.stringify(p);
  C.computeStand(bod, p);
  ok(JSON.stringify(bod) === before && JSON.stringify(p) === pb, "6: bodiceResult·params 입력 불변");
}

// 7. cubic primitive 실측 잠금 — 반환 길이 = 실제 출력 primitive(해석식 R·θ 아님), 법선거리=standHeight.
{
  const back = 10, front = 8, rise = 1.5, H = 3, ov = 1.75, half = back + front;
  const r = C.computeStand(bodice(back, front, ov), { standHeightCm: H, frontRiseCm: rise });
  ok(r.ok, "7: 파생 성공");
  // 실제 출력 primitive 독립 재측정(조밀 2000샘플)
  const lowerActual = partActual(r.standGeometry, "neck-seam-straight") + partActual(r.standGeometry, "neck-seam-arc");
  const upperActual = partActual(r.standGeometry, "top-straight") + partActual(r.standGeometry, "top-arc");
  const extActual = partActual(r.standGeometry, "extension"), upExtActual = partActual(r.standGeometry, "top-extension");
  // 반환값 == 실제 측정값(모듈 adaptive 측정 vs 독립 조밀 측정)
  ok(near(r.lowerNeckSeamLenCm, lowerActual, 1e-5), "7: 반환 lowerNeckSeam == 실제 primitive");
  ok(near(r.upperNeckSegmentLenCm, upperActual, 1e-5), "7: 반환 upperNeckSegment == 실제 primitive(메타값 아님)");
  ok(near(r.lowerExtensionLenCm, extActual, 1e-6) && near(r.upperExtensionLenCm, upExtActual, 1e-6), "7: 반환 여밈 == 실제 primitive");
  // 뒤 직선 실제 + 앞 cubic 실제 vs half ≤ 0.001
  ok(Math.abs(lowerActual - half) <= 1e-3, "7: (뒤직선+앞cubic) 실제 vs half ≤ 0.001cm (실측 " + Math.abs(lowerActual - half).toExponential(1) + ")");
  ok(r.upperNeckSegmentLenCm < r.lowerNeckSeamLenCm, "7: 윗선 목 < 아랫선 목(곡선)");
  // 여밈 연장 실제 == extensionLenCm(overlap)
  ok(near(extActual, ov, 1e-6) && near(upExtActual, ov, 1e-6), "7: 여밈 연장 실제 = 1.75(아랫·윗선)");
  // 앞 원호 여러 지점에서 아랫선↔윗선 법선거리 vs standHeight ≤ 0.01
  const lowerArcPts = partPts(r.standGeometry, "neck-seam-arc"), upperArcPoly = partPts(r.standGeometry, "top-arc");
  let maxNormalErr = 0;
  lowerArcPts.forEach(p => { const d = ptToPolyDist(p, upperArcPoly); if (Math.abs(d - H) > maxNormalErr) maxNormalErr = Math.abs(d - H); });
  ok(maxNormalErr <= 1e-2, "7: 원호 전 지점 법선거리 vs standHeight ≤ 0.01cm (실측 " + maxNormalErr.toExponential(1) + ")");
  // frontRise=0 직선도 primitive 실측이 목표와 일치
  const r0 = C.computeStand(bodice(back, front, ov), { standHeightCm: H, frontRiseCm: 0 });
  ok(near(r0.lowerNeckSeamLenCm, partActual(r0.standGeometry, "neck-seam"), 1e-9) && near(r0.lowerNeckSeamLenCm, half), "7: 직선 primitive 실측=half");
}

// 8. C2 칼라 본체 — 부착선 = 스탠드 윗선 목 primitive − frontInset(연장 미포함), 실측 attachLenCm.
{
  ok(typeof C.computeBody === "function", "8: computeBody API");
  ok(C.referenceBodyParams().cbWidthCm === 6 && C.referenceBodyParams().frontWidthCm === 6 && C.referenceBodyParams().frontInsetCm === 0.3 && C.referenceBodyParams().frontProjectionCm === 4, "8: referenceBodyParams 6/6/0.3/4");
  const back = 10, front = 8, rise = 1.5, H = 3, ov = 1.75;
  const stand = C.computeStand(bodice(back, front, ov), { standHeightCm: H, frontRiseCm: rise });
  const standStr = JSON.stringify(stand);
  const bp = { cbWidthCm: 6, frontInsetCm: 0.3, frontProjectionCm: 4 };
  const bpStr = JSON.stringify(bp);
  const r = C.computeBody(stand, bp);
  ok(r.ok, "8: 본체 파생 성공");
  // attach 실제 primitive(독립 측정) == attachLenCm
  const attachActual = partActual(r.bodyGeometry, "attach");
  ok(near(r.attachLenCm, attachActual, 1e-5), "8: attachLenCm == 실제 attach primitive");
  // attachLen = upperNeckSegment − inset (upperExtension 절대 미포함)
  ok(Math.abs(r.attachLenCm - (stand.upperNeckSegmentLenCm - 0.3)) <= 1e-3, "8: attachLen = upperNeckSegment − 0.3 (실측 " + Math.abs(r.attachLenCm - (stand.upperNeckSegmentLenCm - 0.3)).toExponential(1) + ")");
  ok(stand.upperExtensionLenCm > 0 && Math.abs(r.attachLenCm - (stand.upperTotalLenCm - 0.3)) > 1, "8: upperExtension 미포함(upperTotal 기준과 명확히 다름)");
  // CF 물림 = upperNeckSegment − attachLen ≈ 0.3 (호길이 기준)
  ok(Math.abs((stand.upperNeckSegmentLenCm - r.attachLenCm) - 0.3) <= 1e-3, "8: CF 물림 0.3cm(호길이 기준)");
  // CB 완성 칼라 폭 = 6
  ok(near(Math.hypot(r.anchors.cbOuter.x - r.anchors.cbAttach.x, r.anchors.cbOuter.y - r.anchors.cbAttach.y), 6), "8: CB 칼라 폭 6cm");
  // 앞끝 돌출 = 접선 방향 투영량(사선 길이 아님): dot(tip−frontOuter, frontTangent)=4, dot(·, frontNormal)=0
  const dv = { x: r.anchors.tip.x - r.anchors.frontOuter.x, y: r.anchors.tip.y - r.anchors.frontOuter.y };
  const ft = r.anchors.frontTangent, fn = r.anchors.frontNormal;
  ok(near(dv.x * ft.x + dv.y * ft.y, 4) && near(dv.x * fn.x + dv.y * fn.y, 0), "8: 앞끝 돌출 4cm = 접선 투영량(법선성분 0)");
  ok(near(Math.hypot(ft.x, ft.y), 1) && near(Math.hypot(fn.x, fn.y), 1) && near(ft.x * fn.x + ft.y * fn.y, 0), "8: frontTangent·frontNormal 단위·직교");
  ok(near(Math.hypot(r.anchors.frontOuter.x - r.anchors.target.x, r.anchors.frontOuter.y - r.anchors.target.y), 6), "8: 앞쪽 칼라 폭 6cm");
  // 폐곡선 연속(각 to==다음 from)
  let closed = true, o = r.bodyGeometry.outline;
  for (let i = 0; i < o.length; i++) { const nx = o[(i + 1) % o.length]; if (!near(o[i].to.x, nx.from.x, 1e-6) || !near(o[i].to.y, nx.from.y, 1e-6)) closed = false; }
  ok(closed, "8: 본체 폐곡선 연속");
  ok(r.bodyGeometry.outline.some(s => s.part === "attach") && r.bodyGeometry.outline.filter(s => s.part === "cb-fold" || s.part === "outer" || s.part === "point-front" || s.part === "point-top").length === 4, "8: 부착·외곽·칼라끝·접힘 parts");
  // 입력·스탠드 불변
  ok(JSON.stringify(stand) === standStr && JSON.stringify(bp) === bpStr, "8: 스탠드·params 입력 불변");
  // cubic 중간 분할(inset 이 arc 중간에 걸리는 큰 값)
  const r2 = C.computeBody(stand, { cbWidthCm: 6, frontInsetCm: 3, frontProjectionCm: 4 });
  ok(r2.ok && Math.abs((stand.upperNeckSegmentLenCm - r2.attachLenCm) - 3) <= 1e-3 && r2.bodyGeometry.outline.some(s => s.part === "attach" && s.kind === "cubic"), "8: 큰 inset arc 중간 de Casteljau 분할");
  // 직선 스탠드에서도 동작(attach = neck − inset)
  const stand0 = C.computeStand(bodice(back, front, ov), { standHeightCm: H, frontRiseCm: 0 });
  const r0 = C.computeBody(stand0, bp);
  ok(r0.ok && Math.abs(r0.attachLenCm - (stand0.upperNeckSegmentLenCm - 0.3)) <= 1e-3, "8: 직선 스탠드 본체 attach=neck−0.3");
  // 실패 계약
  ok(C.computeBody(stand, { cbWidthCm: 0, frontInsetCm: 0.3, frontProjectionCm: 4 }).reason === "invalid-cb-width", "8: cbWidth 0");
  ok(C.computeBody(stand, { cbWidthCm: 6, frontInsetCm: -1, frontProjectionCm: 4 }).reason === "invalid-front-inset", "8: inset 음수");
  ok(C.computeBody(stand, { cbWidthCm: 6, frontInsetCm: 999, frontProjectionCm: 4 }).reason === "invalid-front-inset", "8: inset ≥ upperLen");
  ok(C.computeBody(stand, { cbWidthCm: 6, frontInsetCm: 0.3, frontProjectionCm: NaN }).reason === "invalid-front-projection", "8: point NaN");
  ok(C.computeBody({ ok: false }, bp).reason === "invalid-stand", "8: 무효 스탠드");
}

// 9. 앞쪽 폭 변화(frontWidthCm) — CB 폭과 독립. 기본 6/6 = 현재 형상 동일. 읽기전용 measure.
{
  const back = 10, front = 8, rise = 1.5, H = 3, ov = 1.75;
  const stand = C.computeStand(bodice(back, front, ov), { standHeightCm: H, frontRiseCm: rise });
  // 기본 6/6/0.3/4 == frontWidth 생략(=cbW) 과 동일 geometry
  const rA = C.computeBody(stand, { cbWidthCm: 6, frontWidthCm: 6, frontInsetCm: 0.3, frontProjectionCm: 4 });
  const rB = C.computeBody(stand, { cbWidthCm: 6, frontInsetCm: 0.3, frontProjectionCm: 4 });
  ok(rA.ok && JSON.stringify(rA.bodyGeometry) === JSON.stringify(rB.bodyGeometry), "9: frontWidth 6 == 생략(=cbW) 동일 형상");
  ok(near(rA.measure.cbWidthCm, 6) && near(rA.measure.frontWidthCm, 6) && near(rA.measure.frontProjectionCm, 4), "9: measure 파라미터 반영");
  // 포인트 사선 길이 = sqrt(frontWidth² + projection²) = sqrt(36+16)=√52
  ok(near(rA.measure.pointDiagonalLenCm, Math.sqrt(52), 1e-6), "9: 포인트 사선 = √(frontW²+proj²) ≈ 7.211");
  ok(near(Math.hypot(rA.anchors.tip.x - rA.anchors.target.x, rA.anchors.tip.y - rA.anchors.target.y), rA.measure.pointDiagonalLenCm, 1e-9), "9: pointDiagonal = dist(tip, attachFront)");
  // ★ 앞끝 기울기 = 부착선 로컬 접선 기준(캔버스 축·spread 아님): 대각(target→tip)의 접선/법선 성분.
  const dg = { x: rA.anchors.tip.x - rA.anchors.target.x, y: rA.anchors.tip.y - rA.anchors.target.y };
  const localTan = dg.x * rA.anchors.frontTangent.x + dg.y * rA.anchors.frontTangent.y;
  const localNor = dg.x * rA.anchors.frontNormal.x + dg.y * rA.anchors.frontNormal.y;
  ok(near(localTan, 4) && near(localNor, 6), "9: localTangentComponent=projection 4·localNormalComponent=frontWidth 6");
  ok(near(rA.measure.localTiltDeg, Math.atan2(6, 4) * 180 / Math.PI) && near(rA.measure.localTiltDeg, 56.31, 1e-2), "9: localTiltDeg = atan2(frontWidth, projection) = 56.31°");
  // frontRise 가 달라도 같은 본체 비율이면 localTiltDeg 동일(캔버스 기준이 아님을 증명)
  const stand25 = C.computeStand(bodice(back, front, ov), { standHeightCm: H, frontRiseCm: 2.5 });
  const r25 = C.computeBody(stand25, { cbWidthCm: 6, frontWidthCm: 6, frontInsetCm: 0.3, frontProjectionCm: 4 });
  ok(near(r25.measure.localTiltDeg, rA.measure.localTiltDeg), "9: localTiltDeg frontRise 무관(1.5 vs 2.5 동일)");
  // 앞폭을 줄이면 front outer 가 부착점에 가까워진다(법선거리 = frontWidth)
  const rN = C.computeBody(stand, { cbWidthCm: 6, frontWidthCm: 3, frontInsetCm: 0.3, frontProjectionCm: 4 });
  ok(rN.ok && near(Math.hypot(rN.anchors.frontOuter.x - rN.anchors.target.x, rN.anchors.frontOuter.y - rN.anchors.target.y), 3), "9: frontWidth 3 → 앞 법선거리 3");
  ok(near(Math.hypot(rN.anchors.cbOuter.x - rN.anchors.cbAttach.x, rN.anchors.cbOuter.y - rN.anchors.cbAttach.y), 6), "9: CB 폭은 여전히 6(독립)");
  ok(near(rN.measure.pointDiagonalLenCm, Math.sqrt(3 * 3 + 16), 1e-6), "9: 앞폭 3 → 포인트 사선 √25=5");
  // 앞끝 투영은 여전히 접선 방향(법선성분 0)
  const dv = { x: rN.anchors.tip.x - rN.anchors.frontOuter.x, y: rN.anchors.tip.y - rN.anchors.frontOuter.y };
  ok(near(dv.x * rN.anchors.frontTangent.x + dv.y * rN.anchors.frontTangent.y, 4) && near(dv.x * rN.anchors.frontNormal.x + dv.y * rN.anchors.frontNormal.y, 0), "9: 앞폭 변경에도 투영=접선 4·법선 0");
  // 실패: frontWidth 0/음수
  ok(C.computeBody(stand, { cbWidthCm: 6, frontWidthCm: 0, frontInsetCm: 0.3, frontProjectionCm: 4 }).reason === "invalid-front-width", "9: frontWidth 0");
  ok(C.computeBody(stand, { cbWidthCm: 6, frontWidthCm: -2, frontInsetCm: 0.3, frontProjectionCm: 4 }).reason === "invalid-front-width", "9: frontWidth 음수");
  // 폐곡선·자기교차 없음(앞폭 변경 케이스)
  let closed = true, o = rN.bodyGeometry.outline;
  for (let i = 0; i < o.length; i++) { const nx = o[(i + 1) % o.length]; if (!near(o[i].to.x, nx.from.x, 1e-6) || !near(o[i].to.y, nx.from.y, 1e-6)) closed = false; }
  ok(closed, "9: 앞폭 변경 폐곡선 연속");
}

// 10. 외곽 휨량(outerBowCm) — cm 단위 signed bow. 0=직선 byte-identical, 고정점 불변, 접선 연속, 실측 길이.
{
  const back = 10, front = 8, rise = 1.5, H = 3, ov = 1.75;
  const stand = C.computeStand(bodice(back, front, ov), { standHeightCm: H, frontRiseCm: rise });
  const base = { cbWidthCm: 6, frontWidthCm: 6, frontInsetCm: 0.3, frontProjectionCm: 4 };
  ok(C.referenceBodyParams().outerBowCm === 0, "10: referenceBodyParams outerBowCm 0");
  // bow 0 → outerBow 생략과 byte-identical, 그리고 outer 는 단일 line
  const r0 = C.computeBody(stand, Object.assign({ outerBowCm: 0 }, base));
  const rOmit = C.computeBody(stand, base);
  ok(r0.ok && JSON.stringify(r0.bodyGeometry) === JSON.stringify(rOmit.bodyGeometry), "10: bow 0 == 생략 byte-identical");
  ok(r0.bodyGeometry.outline.filter(s => s.part === "outer").length === 1 && r0.bodyGeometry.outline.find(s => s.part === "outer").kind === "line", "10: bow 0 → 단일 line outer");
  ok(near(r0.measure.outerBowCm, 0) && near(r0.measure.outerEdgeLenCm, Math.hypot(r0.anchors.frontOuter.x - r0.anchors.cbOuter.x, r0.anchors.frontOuter.y - r0.anchors.cbOuter.y)), "10: bow 0 outerEdgeLen = 직선 길이");

  const seKind = (s) => s.kind === "cubic";
  const segStartTan = (s) => { const v = seKind(s) ? { x: s.c1.x - s.from.x, y: s.c1.y - s.from.y } : { x: s.to.x - s.from.x, y: s.to.y - s.from.y }; const d = Math.hypot(v.x, v.y) || 1; return { x: v.x / d, y: v.y / d }; };
  const segEndTan = (s) => { const v = seKind(s) ? { x: s.to.x - s.c2.x, y: s.to.y - s.c2.y } : { x: s.to.x - s.from.x, y: s.to.y - s.from.y }; const d = Math.hypot(v.x, v.y) || 1; return { x: v.x / d, y: v.y / d }; };
  const cross = (a, b) => a.x * b.y - a.y * b.x;

  function checkBow(bow) {
    const r = C.computeBody(stand, Object.assign({ outerBowCm: bow }, base));
    ok(r.ok, "10: bow " + bow + " 성공");
    // 고정점 불변(bow 0 결과와 동일 anchors)
    ok(JSON.stringify(r.anchors) === JSON.stringify(r0.anchors), "10: bow " + bow + " 고정점(cbOuter·frontOuter·tip·접선) 불변");
    // 부착선 불변
    ok(JSON.stringify(r.bodyGeometry.outline.filter(s => s.part === "attach")) === JSON.stringify(r0.bodyGeometry.outline.filter(s => s.part === "attach")), "10: bow " + bow + " 부착선 불변");
    // 측정 불변: CB 폭·앞폭·투영·포인트 사선
    ok(near(r.measure.cbWidthCm, 6) && near(r.measure.frontWidthCm, 6) && near(r.measure.frontProjectionCm, 4) && near(r.measure.pointDiagonalLenCm, r0.measure.pointDiagonalLenCm), "10: bow " + bow + " 폭·투영·포인트사선 불변");
    // 외곽 = 두 cubic
    const outer = r.bodyGeometry.outline.filter(s => s.part === "outer");
    ok(outer.length === 2 && outer.every(seKind), "10: bow " + bow + " 외곽 두 cubic");
    // 중점 signed offset = outerBowCm
    const cbO = r.anchors.cbOuter, fO = r.anchors.frontOuter;
    const chord = (() => { const v = { x: fO.x - cbO.x, y: fO.y - cbO.y }, d = Math.hypot(v.x, v.y); return { x: v.x / d, y: v.y / d }; })();
    let perp = { x: -chord.y, y: chord.x };
    const nCBv = segEndTan(r.bodyGeometry.outline.find(s => s.part === "cb-fold"));  // not used for sign; recompute nCB below
    // nCB = attach CB 법선(위) — attach 첫 세그 접선의 normalUp
    const aTan = segStartTan(r.bodyGeometry.outline.find(s => s.part === "attach"));
    let nCB = { x: -aTan.y, y: aTan.x }; if (nCB.y > 0) nCB = { x: aTan.y, y: -aTan.x };
    if (perp.x * nCB.x + perp.y * nCB.y < 0) perp = { x: chord.y, y: -chord.x };
    const M = { x: (cbO.x + fO.x) / 2, y: (cbO.y + fO.y) / 2 };
    const bowMid = outer[0].to;   // 두 cubic 접점
    const signedOff = (bowMid.x - M.x) * perp.x + (bowMid.y - M.y) * perp.y;
    ok(near(signedOff, bow, 1e-6), "10: bow " + bow + " 중점 signed offset = outerBowCm");
    // 접선 연속: 중간 접점(outer[0] 끝 == outer[1] 시작), front(=tTgt), CB(=부착 CB 접선)
    ok(Math.abs(cross(segEndTan(outer[0]), segStartTan(outer[1]))) < 1e-6, "10: bow " + bow + " 중간 접선 연속");
    ok(Math.abs(cross(segStartTan(outer[0]), r.anchors.frontTangent)) < 1e-6, "10: bow " + bow + " front 도착 접선 = 앞끝 돌출 방향");
    ok(Math.abs(cross(segEndTan(outer[1]), aTan)) < 1e-6, "10: bow " + bow + " CB 시작 접선 = 부착 CB 접선");
    // 실측 outer length == 반환값
    ok(near(r.measure.outerEdgeLenCm, partActual(r.bodyGeometry, "outer"), 1e-5), "10: bow " + bow + " outerEdgeLen == 실제 primitive");
    // 폐곡선 연속 + 교차 0(ok 로 보장)
    let closed = true, o = r.bodyGeometry.outline;
    for (let i = 0; i < o.length; i++) { const nx = o[(i + 1) % o.length]; if (!near(o[i].to.x, nx.from.x, 1e-6) || !near(o[i].to.y, nx.from.y, 1e-6)) closed = false; }
    ok(closed, "10: bow " + bow + " 폐곡선 연속");
    return r;
  }
  const rPos = checkBow(1.5), rNeg = checkBow(-1.5);
  // 볼록(+)은 안쪽(−)보다 외곽이 부착선에서 멀다 → outer 길이 둘 다 직선보다 김
  ok(rPos.measure.outerEdgeLenCm > r0.measure.outerEdgeLenCm && rNeg.measure.outerEdgeLenCm > r0.measure.outerEdgeLenCm, "10: ± 휨 outer 길이 > 직선");
  // 원자적 실패
  ok(C.computeBody(stand, Object.assign({ outerBowCm: NaN }, base)).reason === "invalid-outer-bow", "10: bow NaN → invalid-outer-bow");
  ok(C.computeBody(stand, Object.assign({ outerBowCm: Infinity }, base)).reason === "invalid-outer-bow", "10: bow Infinity");
  ok(C.computeBody(stand, Object.assign({ outerBowCm: -20 }, base)).reason === "self-intersection", "10: 과도한 안쪽 휨 → self-intersection");
}

// 11. C3 관리형 직접 편집 순수: 고정 anchor topology·source-of-truth 재조립·endpoint 잠금·교차·불변.
{
  const back = 10, front = 8, rise = 1.5, H = 3, ov = 1.75;
  const stand = C.computeStand(bodice(back, front, ov), { standHeightCm: H, frontRiseCm: rise });
  const base = { cbWidthCm: 6, frontWidthCm: 6, frontInsetCm: 0.3, frontProjectionCm: 4 };
  // 변환: bow 0(직선) — 관리 체인 항상 [cbOuter,bowMid,frontOuter,tip,attachFront]
  const body0 = C.computeBody(stand, Object.assign({ outerBowCm: 0 }, base));
  const lc = C.collarBodyLineFromGeometry(body0.bodyGeometry);
  ok(lc && lc.segments.length === 4 && lc.anchors.length === 5, "11: 관리 체인 4세그·5 anchor");
  ok(near(lc.anchors[0].x, body0.anchors.cbOuter.x) && near(lc.anchors[0].y, body0.anchors.cbOuter.y), "11: anchor0 = cbOuter");
  ok(near(lc.anchors[4].x, body0.anchors.target.x) && near(lc.anchors[4].y, body0.anchors.target.y), "11: anchor4 = attachFront");
  ok(near(lc.anchors[2].x, body0.anchors.frontOuter.x) && near(lc.anchors[3].x, body0.anchors.tip.x), "11: anchor2 frontOuter·anchor3 tip");
  ok(near(lc.anchors[1].x, (body0.anchors.cbOuter.x + body0.anchors.frontOuter.x) / 2), "11: bow0 bowMid = 직선 중점(명시 생성)");
  ok(lc.locked && lc.locked.attachSegs.length && near(lc.locked.cbOuter.x, body0.anchors.cbOuter.x), "11: locked attachSegs·cbOuter");
  // bow≠0 도 같은 anchor index 구조(외곽 두 세그가 cubic)
  const body15 = C.computeBody(stand, Object.assign({ outerBowCm: 1.5 }, base));
  const lc15 = C.collarBodyLineFromGeometry(body15.bodyGeometry);
  ok(lc15.segments.length === 4 && lc15.segments[0].kind === "cubic" && lc15.segments[1].kind === "cubic", "11: bow≠0 도 4세그(외곽 cubic)·index 동일");
  // round-trip: 관리 체인 → computeFromBodyLine → 유효 폐곡선, attachLen·포인트 사선 보존
  const rt = C.computeFromBodyLine(lc.segments, lc.locked);
  ok(rt.ok && near(rt.attachLenCm, body0.attachLenCm, 1e-5) && near(rt.measure.pointDiagonalLenCm, body0.measure.pointDiagonalLenCm, 1e-6), "11: round-trip attachLen·포인트 사선 보존");
  // endpoint 잠금
  const cl = s => ({ kind: "line", from: { x: s.from.x, y: s.from.y }, to: { x: s.to.x, y: s.to.y } });
  const moveA = (segs, idx, np) => { const s = segs.map(cl); if (idx > 0) s[idx - 1].to = { x: np.x, y: np.y }; if (idx < s.length) s[idx].from = { x: np.x, y: np.y }; return s; };
  ok(C.computeFromBodyLine(moveA(lc.segments, 0, { x: 99, y: 99 }), lc.locked).reason === "endpoint-cbouter", "11: cbOuter 이동 → endpoint-cbouter");
  ok(C.computeFromBodyLine(moveA(lc.segments, 4, { x: 99, y: 99 }), lc.locked).reason === "endpoint-attachfront", "11: attachFront 이동 → endpoint-attachfront");
  // 편집 유효(SP 근처 소폭 이동) → ok
  const okEdit = C.computeFromBodyLine(moveA(lc.segments, 1, { x: lc.anchors[1].x, y: lc.anchors[1].y - 1 }), lc.locked);
  ok(okEdit.ok, "11: 유효 편집(bowMid 위로) → ok");
  // 교차: tip 을 부착선 아래로 끌어 침범 → self-intersection
  const bad = C.computeFromBodyLine(moveA(lc.segments, 3, { x: lc.locked.attachCB.x, y: lc.locked.attachCB.y + 3 }), lc.locked);
  ok(bad.reason === "self-intersection" || bad.reason === "degenerate-area", "11: tip 침범 → self-intersection/degenerate (" + bad.reason + ")");
  // 실패 계약
  ok(C.computeFromBodyLine([], lc.locked).reason === "no-line", "11: 빈 체인 → no-line");
  ok(C.computeFromBodyLine(lc.segments, { attachSegs: [] }).reason === "no-attach", "11: locked 없음 → no-attach");
  // 입력 불변
  const segStr = JSON.stringify(lc.segments), lockStr = JSON.stringify(lc.locked);
  C.computeFromBodyLine(lc.segments, lc.locked);
  ok(JSON.stringify(lc.segments) === segStr && JSON.stringify(lc.locked) === lockStr, "11: computeFromBodyLine 입력 불변");
  // collarBodyLineFromGeometry 입력 불변
  const gStr = JSON.stringify(body0.bodyGeometry);
  C.collarBodyLineFromGeometry(body0.bodyGeometry);
  ok(JSON.stringify(body0.bodyGeometry) === gStr, "11: collarBodyLineFromGeometry 입력 불변");
}

console.log(`designCollarCheck: ${PASS} PASS, ${FAIL} FAIL`);
if (FAIL) { console.log("FAILURES:\n  " + fails.join("\n  ")); process.exit(1); }
