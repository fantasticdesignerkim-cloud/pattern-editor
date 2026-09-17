// ══════════════════════════════════════════════
// designCollarCheck.js — js/designCollar.js 순수 파생 회귀(밴드 C1c + 교재 M 위 칼라 제도).
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
ok(C.referenceParams().standHeightCm === 3 && C.referenceParams().frontRiseCm === 1, "1: 교재 M referenceParams standHeight 3·frontRise 1");

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
  // params 생략 시 기본 frontRise 1(교재 M, 곡선) — 직선 아님
  const rd = C.computeStand(bodice(10, 8, 1.75), { standHeightCm: 3 });
  ok(rd.ok && rd.frontRiseCm === 1 && !!partSeg(rd.standGeometry, "neck-seam-arc"), "3: 기본 frontRise 1(교재 M)→곡선(neck-seam-arc)");
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

// 8~12. 위 칼라 — 교재 M형 제도(reference recipe).
//   밴드 CF 기준점(CFu) → 밴드 위선을 따라 CB 방향 호길이 0.5 = setbackPoint → CB gap 3 → 독립 이음선(수평 출발·현 도착)
//   → CB 수평 보정으로 이음선 길이 = 밴드 기준 길이 → CB 폭 4(수직) → 수직 기준선에서 수평 1.5·실제 사선 6 → 외곽선.
const M = () => C.referenceBodyParams();
function arcLenAlong(path, pt) {   // path(연속 seg) 시작부터 pt 까지 호길이(pt 는 path 위, 독립 조밀 샘플)
  let acc = 0, best = { d: Infinity, s: 0 };
  path.forEach(s => { const p = s.kind === "line" ? [s.from, s.to] : cubicPts(s, 4000);
    for (let i = 1; i < p.length; i++) { const a = p[i - 1], b = p[i], dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy;
      let t = L2 ? ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(pt.x - (a.x + t * dx), pt.y - (a.y + t * dy)); if (d < best.d) best = { d, s: acc + Math.sqrt(L2) * t }; acc += Math.sqrt(L2); } });
  return { dist: best.d, arc: best.s, total: acc };
}
// 8. 기본형 계약: API·기본값·gap·setback·독립 이음선·CB 폭·돌출·사선·길이 정합
{
  const rb = M();
  ok(typeof C.computeBody === "function", "8: computeBody API");
  ok(rb.gapCm === 3 && rb.cbWidthCm === 4 && rb.frontInsetCm === 0.5 && rb.frontProjectionCm === 1.5 && rb.pointDiagonalCm === 6 && rb.outerBowCm === 0 && !("frontWidthCm" in rb),
    "8: M 도메인 치수 gap3·cb4·setback0.5·돌출1.5·사선6·휨0 (√33.75 는 입력 아님)");
  const back = 7.6926, front = 11.129, ov = 1.75;
  const stand = C.computeStand(bodice(back, front, ov), C.referenceParams());
  const r = C.computeBody(stand, rb), A = r.anchors, m = r.measure;
  ok(r.ok, "8: M 위 칼라 계산 성공");
  // ① 밴드 CF 기준점 = CF 1cm 올림점에서 아래선에 90° 윗방향 3cm (연장 끝 아님)
  ok(near(A.bandTopCf.x, stand.anchors.cfTop.x, 1e-9) && near(A.bandTopCf.y, stand.anchors.cfTop.y, 1e-9), "8: bandTopCf = 밴드 CF 기준점(CFu)");
  const cfLow = stand.anchors.cfSeam, cfDir = { x: A.bandTopCf.x - cfLow.x, y: A.bandTopCf.y - cfLow.y };
  const lowTan = (() => { const arc = stand.standGeometry.outline.filter(s => s.part === "neck-seam-arc"); const l = arc[arc.length - 1]; return { x: l.to.x - l.c2.x, y: l.to.y - l.c2.y }; })();
  ok(near(Math.hypot(cfDir.x, cfDir.y), 3, 1e-9) && near((cfDir.x * lowTan.x + cfDir.y * lowTan.y) / Math.hypot(lowTan.x, lowTan.y), 0, 1e-6) && cfDir.y < 0, "8: CF 기준점 = 아래선 90° 위 3cm");
  ok(stand.upperExtensionLenCm > 0 && Math.hypot(A.bandTopCf.x - stand.anchors.cfExtSeam.x, A.bandTopCf.y - stand.anchors.cfExtSeam.y) > 1, "8: 기준점은 플래킷 연장 끝이 아님");
  // ② setback: 밴드 위선 위, CF 기준점에서 CB 방향 호길이 0.5
  const al = arcLenAlong(stand.upperNeckPath, A.setbackPoint);
  ok(al.dist < 1e-6 && near(al.total - al.arc, 0.5, 1e-4) && al.arc < al.total, "8: setbackPoint = 밴드 위선 CF 기준점에서 CB 방향 호길이 0.5");
  ok(near(m.bandAttachLenCm, stand.upperNeckSegmentLenCm - 0.5, 1e-6) && near(m.bandTopNeckLenCm, stand.upperNeckSegmentLenCm, 1e-9), "8: 밴드 기준 봉제 길이 = 밴드 위선 CB→setback(연장 미포함)");
  // ③ gap: 밴드 위선 CB 에서 수직 3
  ok(near(A.upperCbSeam.y, A.bandTopCb.y - 3, 1e-12) && m.gapCm === 3, "8: CB gap = 밴드 위선 CB 에서 위로 3cm");
  // ④ 독립 이음선: 밴드 위선 subpath 가 아니다(곡선 점이 밴드 위선에서 떨어져 있음), CB 수평 출발
  const seam = r.bodyGeometry.outline.filter(s => s.part === "attach");
  ok(seam.length === 1 && seam[0].kind === "cubic" && near(seam[0].c1.y, seam[0].from.y, 1e-12) && seam[0].c1.x > seam[0].from.x, "8: 이음선 = 단일 cubic·CB 에서 수평(앞쪽) 출발");
  const band = partPts({ outline: stand.upperNeckPath.map(x => Object.assign({}, x, { part: "u" })) }, "u");
  const seamMidDist = ptToPolyDist(cubicPts(seam[0], 2)[1], band);
  ok(seamMidDist > 1 && near(seam[0].to.x, A.setbackPoint.x, 1e-12) && near(seam[0].to.y, A.setbackPoint.y, 1e-12), "8: 이음선은 밴드 위선 복사가 아니며 setback 점에서 끝남 (중간 거리 " + seamMidDist.toFixed(2) + ")");
  ok(cubicPts(seam[0], 50).every((q, i, arr) => i === 0 || q.y >= arr[i - 1].y - 1e-9), "8: 이음선은 CB 에서 앞 attach 점으로 단조롭게 내려옴");
  // ⑤ 길이 정합 + CB 수평 보정
  ok(near(denseSegLen(seam[0]), m.bandAttachLenCm, 1e-4) && near(r.attachLenCm, m.bandAttachLenCm, 1e-6) && Math.abs(m.seamLengthDiffCm) < 1e-6, "8: 위칼라 이음선 길이(실측) = 밴드 기준 봉제 길이");
  ok(near(m.cbCorrectionCm, A.upperCbSeam.x - A.bandTopCb.x, 1e-12) && m.cbCorrectionCm !== 0, "8: CB 보정 = gap 점 수평 이동량 (" + m.cbCorrectionCm.toFixed(4) + ")");
  // ⑥ CB 폭 4: 새 이음선 CB 점에서 CB 선(수직) 위로
  ok(near(A.cbOuter.x, A.upperCbSeam.x, 1e-12) && near(A.upperCbSeam.y - A.cbOuter.y, 4, 1e-12), "8: CB 폭 4 = 이음선 CB 점에서 수직");
  // ⑦ 칼라 끝: 수직 기준선에서 수평 1.5 앞, 실제 사선 6
  ok(near(A.tip.x - A.setbackPoint.x, 1.5, 1e-12) && near(Math.hypot(A.tip.x - A.setbackPoint.x, A.tip.y - A.setbackPoint.y), 6, 1e-12) && A.tip.y < A.setbackPoint.y, "8: tip = 수직 기준선에서 수평 1.5 · 실제 사선 6");
  ok(near(m.frontWidthCm, Math.sqrt(33.75), 1e-12) && near(m.pointDiagonalLenCm, 6, 1e-12), "8: √33.75 는 파생 수직 성분(measure)");
  // ⑧ 외곽선 = cbOuter→tip 직선(bow 0), 폐곡선
  const outer = r.bodyGeometry.outline.filter(s => s.part === "outer");
  ok(outer.length === 1 && outer[0].kind === "line" && near(outer[0].from.x, A.tip.x, 1e-12) && near(outer[0].to.x, A.cbOuter.x, 1e-12), "8: bow 0 외곽선 = tip→cbOuter 직선(이음선과 무관)");
  ok(C.validateClosedOutline(r.bodyGeometry.outline).ok && r.bodyGeometry.outline.map(s => s.part).join(",") === "attach,point-front,outer,cb-fold", "8: 폐곡선 parts 이음선·앞끝 사선·외곽·CB 접힘");
  // 실패 계약
  const bad = (o) => C.computeBody(stand, Object.assign(M(), o)).reason;
  ok(bad({ gapCm: 0 }) === "invalid-gap" && bad({ gapCm: -1 }) === "invalid-gap", "8: gap ≤0 거부");
  ok(bad({ cbWidthCm: 0 }) === "invalid-cb-width", "8: cbWidth 0 거부");
  ok(bad({ frontInsetCm: -1 }) === "invalid-front-inset" && bad({ frontInsetCm: 999 }) === "invalid-front-inset", "8: setback 음수·과대 거부");
  ok(bad({ frontProjectionCm: NaN }) === "invalid-front-projection", "8: 돌출 NaN 거부");
  ok(bad({ pointDiagonalCm: 1.5 }) === "invalid-point-diagonal" && bad({ pointDiagonalCm: undefined }) === "invalid-point-diagonal", "8: 사선 ≤ 돌출·누락 거부");
  ok(C.computeBody({ ok: false }, M()).reason === "invalid-stand", "8: 무효 스탠드 거부");
  // 입력 불변 · 결정론
  const sStr = JSON.stringify(stand), pStr = JSON.stringify(rb);
  const r2 = C.computeBody(stand, rb);
  ok(JSON.stringify(stand) === sStr && JSON.stringify(rb) === pStr && JSON.stringify(r2) === JSON.stringify(r), "8: 입력 불변·결정론");
}

// 9. 대표 목둘레 여러 개: 유한값·길이 정합·gap·사선·결정론, 보정 방향은 기하에 따라 다를 수 있음
{
  [[7.6926, 11.129, 1.75], [8.5, 12.4, 1.5], [6.8, 10.1, 0], [9.2, 13.6, 2]].forEach(([back, front, ov]) => {
    const tag = "back" + back + " front" + front;
    const stand = C.computeStand(bodice(back, front, ov), C.referenceParams());
    const r = C.computeBody(stand, M());
    const vals = r.ok ? [r.attachLenCm, r.measure.cbCorrectionCm, r.anchors.tip.x, r.anchors.tip.y, r.anchors.upperCbSeam.x] : [NaN];
    ok(r.ok && vals.every(Number.isFinite), "9: " + tag + " 유한값");
    ok(r.ok && Math.abs(r.attachLenCm - (stand.upperNeckSegmentLenCm - 0.5)) < 1e-6 && near(denseSegLen(r.bodyGeometry.outline[0]), r.attachLenCm, 1e-4), "9: " + tag + " 이음선 = 밴드 기준 길이");
    ok(r.ok && near(r.anchors.bandTopCb.y - r.anchors.upperCbSeam.y, 3, 1e-12) && near(r.measure.pointDiagonalLenCm, 6, 1e-12) && near(r.measure.frontProjectionCm, 1.5, 1e-12), "9: " + tag + " gap3·사선6·돌출1.5");
    ok(r.ok && JSON.stringify(C.computeBody(C.computeStand(bodice(back, front, ov), C.referenceParams()), M())) === JSON.stringify(r), "9: " + tag + " 결정론");
    ok(r.ok && C.validateClosedOutline(r.bodyGeometry.outline).ok, "9: " + tag + " 폐곡선·자기교차 없음");
  });
  // gap 변경은 이음선만 바꾸고 밴드 기준 길이는 불변, CB 보정량은 다시 풀린다
  const stand = C.computeStand(bodice(7.6926, 11.129, 1.75), C.referenceParams());
  const g3 = C.computeBody(stand, M()), g4 = C.computeBody(stand, Object.assign(M(), { gapCm: 4 }));
  ok(g4.ok && near(g4.measure.bandAttachLenCm, g3.measure.bandAttachLenCm, 1e-12) && near(g4.attachLenCm, g3.attachLenCm, 1e-6) && g4.measure.cbCorrectionCm !== g3.measure.cbCorrectionCm, "9: gap 4 → 같은 밴드 기준 길이·다른 CB 보정");
}

// 10. 외곽 휨(outerBowCm): 외곽선만 휜다 — 이음선·setback·gap·CB 폭·tip 불변
{
  const stand = C.computeStand(bodice(7.6926, 11.129, 1.75), C.referenceParams());
  const r0 = C.computeBody(stand, M());
  [1, -1].forEach(bow => {
    const r = C.computeBody(stand, Object.assign(M(), { outerBowCm: bow }));
    ok(r.ok && JSON.stringify(r.anchors) === JSON.stringify(r0.anchors), "10: bow " + bow + " 고정점 불변");
    ok(JSON.stringify(r.bodyGeometry.outline.filter(s => s.part === "attach")) === JSON.stringify(r0.bodyGeometry.outline.filter(s => s.part === "attach")), "10: bow " + bow + " 이음선 불변");
    const outer = r.bodyGeometry.outline.filter(s => s.part === "outer");
    ok(outer.length === 2 && outer.every(s => s.kind === "cubic") && near(r.measure.outerBowCm, bow), "10: bow " + bow + " 외곽선 두 cubic");
    ok(near(r.measure.outerEdgeLenCm, outer.reduce((t, s) => t + denseSegLen(s), 0), 1e-4) && r.measure.outerEdgeLenCm > r0.measure.outerEdgeLenCm, "10: bow " + bow + " 외곽 실측 길이");
    ok(C.validateClosedOutline(r.bodyGeometry.outline).ok, "10: bow " + bow + " 폐곡선");
  });
  ok(C.computeBody(stand, Object.assign(M(), { outerBowCm: NaN })).reason === "invalid-outer-bow", "10: bow NaN 거부");
  ok(C.computeBody(stand, Object.assign(M(), { outerBowCm: -30 })).reason === "self-intersection", "10: 과도한 안쪽 휨 → self-intersection");
}

// 11. 관리형 직접 편집: 고정 topology [cbOuter,bowMid,tip,attachFront]·locked 이음선·endpoint 잠금·교차·불변
{
  const stand = C.computeStand(bodice(7.6926, 11.129, 1.75), C.referenceParams());
  const body0 = C.computeBody(stand, M());
  const lc = C.collarBodyLineFromGeometry(body0.bodyGeometry);
  ok(lc && lc.segments.length === 3 && lc.anchors.length === 4, "11: 관리 체인 3세그·4 anchor");
  ok(near(lc.anchors[0].x, body0.anchors.cbOuter.x) && near(lc.anchors[0].y, body0.anchors.cbOuter.y), "11: anchor0 = cbOuter");
  ok(near(lc.anchors[2].x, body0.anchors.tip.x) && near(lc.anchors[2].y, body0.anchors.tip.y), "11: anchor2 = tip");
  ok(near(lc.anchors[3].x, body0.anchors.setbackPoint.x) && near(lc.anchors[3].y, body0.anchors.setbackPoint.y), "11: anchor3 = attachFront(setback 점)");
  ok(near(lc.anchors[1].x, (body0.anchors.cbOuter.x + body0.anchors.tip.x) / 2), "11: bow0 bowMid = 직선 중점(명시 생성)");
  ok(JSON.stringify(lc.locked.attachSegs.map(s => [s.kind, s.from, s.c1, s.c2, s.to])) === JSON.stringify(body0.bodyGeometry.outline.filter(s => s.part === "attach").map(s => [s.kind, s.from, s.c1, s.c2, s.to])), "11: locked = 독립 위칼라 이음선 그대로");
  const lc15 = C.collarBodyLineFromGeometry(C.computeBody(stand, Object.assign(M(), { outerBowCm: 1 })).bodyGeometry);
  ok(lc15.segments.length === 3 && lc15.segments[0].kind === "cubic" && lc15.segments[1].kind === "cubic", "11: bow≠0 도 같은 index 구조");
  const rt = C.computeFromBodyLine(lc.segments, lc.locked);
  ok(rt.ok && near(rt.attachLenCm, body0.attachLenCm, 1e-9) && near(rt.measure.pointDiagonalLenCm, 6, 1e-9), "11: round-trip 이음선 길이·사선 보존");
  const cl = s => ({ kind: "line", from: { x: s.from.x, y: s.from.y }, to: { x: s.to.x, y: s.to.y } });
  const moveA = (segs, idx, np) => { const s = segs.map(cl); if (idx > 0) s[idx - 1].to = { x: np.x, y: np.y }; if (idx < s.length) s[idx].from = { x: np.x, y: np.y }; return s; };
  ok(C.computeFromBodyLine(moveA(lc.segments, 0, { x: 99, y: 99 }), lc.locked).reason === "endpoint-cbouter", "11: cbOuter 이동 → endpoint-cbouter");
  ok(C.computeFromBodyLine(moveA(lc.segments, 3, { x: 99, y: 99 }), lc.locked).reason === "endpoint-attachfront", "11: attachFront 이동 → endpoint-attachfront");
  ok(C.computeFromBodyLine(moveA(lc.segments, 1, { x: lc.anchors[1].x, y: lc.anchors[1].y - 1 }), lc.locked).ok, "11: 유효 편집(bowMid 위로) → ok");
  const bad = C.computeFromBodyLine(moveA(lc.segments, 2, { x: lc.locked.attachCB.x + 2, y: lc.locked.attachCB.y + 3 }), lc.locked);
  ok(bad.reason === "self-intersection" || bad.reason === "degenerate-area", "11: tip 을 이음선 아래로 → 거부 (" + bad.reason + ")");
  ok(C.computeFromBodyLine([], lc.locked).reason === "no-line" && C.computeFromBodyLine(lc.segments, { attachSegs: [] }).reason === "no-attach", "11: 실패 계약");
  const segStr = JSON.stringify(lc.segments), lockStr = JSON.stringify(lc.locked), gStr = JSON.stringify(body0.bodyGeometry);
  C.computeFromBodyLine(lc.segments, lc.locked); C.collarBodyLineFromGeometry(body0.bodyGeometry);
  ok(JSON.stringify(lc.segments) === segStr && JSON.stringify(lc.locked) === lockStr && JSON.stringify(body0.bodyGeometry) === gStr, "11: 입력 불변");
}

// 12. 교재 M 밴드(스탠드) 종합 — 밴드 폭 3·CF 1 올림·달림선 ×+⊘·어깨 경계
{
  const back = 10, front = 8, ov = 1.75;
  const stand = C.computeStand(bodice(back, front, ov), C.referenceParams());
  ok(stand.ok && stand.frontRiseCm === 1 && stand.standHeightCm === 3, "12: M 밴드 폭 3·CF 올림 1");
  const straight = partSeg(stand.standGeometry, "neck-seam-straight");
  ok(straight && near(straight.from.y, straight.to.y), "12: CB 시작 접선 수평(뒤목 직선)");
  ok(near(stand.anchors.shoulderSeam.x, back) && near(stand.anchors.shoulderSeam.y, 0) && near(stand.anchors.cfSeam.y, -1), "12: 어깨 경계 = 뒤목둘레 지점·CF 올림 1cm");
  ok(near(stand.lowerNeckSeamLenCm, back + front) && near(stand.backNeckLenCm, back) && near(stand.frontNeckLenCm, front), "12: 밴드 달림선 = ×+⊘ (연장 별도)");
  const body = C.computeBody(stand, C.referenceBodyParams());
  ok(body.ok && C.validateClosedOutline(stand.standGeometry.outline).ok && C.validateClosedOutline(body.bodyGeometry.outline).ok, "12: 밴드·위 칼라 폐곡선");
  const stand2 = C.computeStand(bodice(back, front, ov), C.referenceParams()), body2 = C.computeBody(stand2, C.referenceBodyParams());
  ok(JSON.stringify(stand.standGeometry) === JSON.stringify(stand2.standGeometry) && JSON.stringify(body.bodyGeometry) === JSON.stringify(body2.bodyGeometry), "12: M 기본형 복원 결정성");
}

console.log(`designCollarCheck: ${PASS} PASS, ${FAIL} FAIL`);
if (FAIL) { console.log("FAILURES:\n  " + fails.join("\n  ")); process.exit(1); }
