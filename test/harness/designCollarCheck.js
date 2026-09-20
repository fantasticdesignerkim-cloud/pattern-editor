// ══════════════════════════════════════════════
// designCollarCheck.js — js/designCollar.js 순수 파생 회귀.
//   · 칼라 밴드 달린 셔츠 칼라(family 3): 교재 P.148 제도 방법 — 직선 기준선 ×+⊘ → 3등분 Ⓐ →
//     Ⓐ–Ⓑ 안내선 → Ⓑ 직각 밴드 폭 → 앞 끝선 → 달림선 실측 = ×+⊘ 되도록 뒤 중심 수정,
//     위 칼라는 간격·뒤 폭·앞 수평/사선 + 이음선 = 밴드 윗선 ⒸⒹ(뒤 중심 수평 보정).
//     M·N·P 는 같은 골격, preset 치수만 다르다.
//   · 한 장 셔츠 칼라(family 2, P.147)는 collarPresetsCheck 가 상세 검증한다(여기선 API 존재만).
//   ★ "완만하게/자연스럽게" 구간의 곡선 정리(접선 연속 cubic·핸들 1/3)는 구현 관례이며 교재 수치가 아니다.
//   node test/harness/designCollarCheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");
const SRC = fs.readFileSync(path.join(__dirname, "..", "..", "js", "designCollar.js"), "utf8");
let PASS = 0, FAIL = 0; const fails = [];
function ok(cond, name) { if (cond) PASS++; else { FAIL++; fails.push(name); } }
const near = (a, b, e = 1e-4) => Math.abs(a - b) < e;
const J = (v) => JSON.stringify(v);

const sandbox = { window: {}, Math, Object, JSON, Array, isFinite, Infinity };
vm.createContext(sandbox);
vm.runInContext(SRC, sandbox, { filename: "designCollar.js" });
const C = sandbox.window.designCollar;

// 독립 측정(모듈과 다른 조밀 샘플)
function cubicPt(s, t) { const u = 1 - t; return {
  x: u*u*u*s.from.x + 3*u*u*t*s.c1.x + 3*u*t*t*s.c2.x + t*t*t*s.to.x,
  y: u*u*u*s.from.y + 3*u*u*t*s.c1.y + 3*u*t*t*s.c2.y + t*t*t*s.to.y }; }
function denseLen(s) { if (s.kind === "line") return Math.hypot(s.to.x - s.from.x, s.to.y - s.from.y);
  let t = 0, pr = s.from; for (let i = 1; i <= 4000; i++) { const p = cubicPt(s, i / 4000); t += Math.hypot(p.x - pr.x, p.y - pr.y); pr = p; } return t; }
const partLen = (g, p) => g.outline.filter(s => s.part === p).reduce((t, s) => t + denseLen(s), 0);
const parts = (g, p) => g.outline.filter(s => s.part === p);
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const dot = (a, b) => a.x * b.x + a.y * b.y;
const norm = (v) => Math.hypot(v.x, v.y);

function bodice(back, front, overlap) {
  const half = back + front;
  const b = { hash: "BH", necklineLengths: { back, front, half, finished: 2 * half } };
  if (overlap !== undefined) b.placket = { parameters: { overlapCm: overlap, facingWidthCm: 4, lengthMode: "full" } };
  return b;
}
// 교재 preset 치수(collarPresets 레코드와 같은 값 — 여기선 검산 입력)
const BAND = { M: { bandWidthCm: 3, frontRiseCm: 1, frontEndCm: 0.5 }, N: { bandWidthCm: 3, frontRiseCm: 3, frontEndCm: 0.5 }, P: { bandWidthCm: 5, frontRiseCm: 3, frontEndCm: 0.5 } };
const UPPER = { M: { gapCm: 3, cbWidthCm: 4, frontProjectionCm: 1.5, pointDiagonalCm: 6, outerBowCm: 0 },
                N: { gapCm: 7, cbWidthCm: 4, frontProjectionCm: 2, pointDiagonalCm: 6, outerBowCm: 0 },
                P: { gapCm: 7, cbWidthCm: 4, frontProjectionCm: 2, pointDiagonalCm: 6, outerBowCm: 0 } };

// 1. API·제도법 메타
ok(typeof C.computeStand === "function" && typeof C.computeBody === "function" && typeof C.computeOnePiece === "function" && Object.isFrozen(C), "1: API·frozen");
ok(J(C.BAND_METHOD) === J({ page: 148, smoothing: "tangent-continuous-cubic", handleFraction: 1 / 3, guidePoint: "front-third" }), "1: 밴드 제도법 메타(P.148·곡선 정리는 구현 관례)");
ok(J(C.referenceParams()) === J(BAND.M) && J(C.referenceBodyParams()) === J(UPPER.M), "1: 엔진 기준값 = 교재 M");

// 2. readBodice
{
  ok(C.readBodice(null).reason === "no-bodice" && C.readBodice({}).reason === "no-neckline", "2: 몸판·목둘레 없음");
  ok(C.readBodice({ necklineLengths: { back: 10, front: 8 } }).backCm === 10, "2: 반패턴 뒤목·앞목");
  ok(C.readBodice({ necklineLengths: { back: 10, front: 8 }, placket: { parameters: { overlapCm: -1 } } }).reason === "invalid-overlap", "2: 여밈 음수 거부");
}

// 3. P.148 밴드 골격(M·N·P 공통) — 좌표·직각·평행·실측 길이
["M", "N", "P"].forEach(key => {
  const back = 7.6926, front = 11.129, N = back + front;
  const st = C.computeStand(bodice(back, front, 1.75), BAND[key]);
  ok(st.ok, "3-" + key + ": computeStand ok (" + (st.reason || "") + ")");
  if (!st.ok) return;
  const a = st.anchors, W = BAND[key].bandWidthCm, rise = BAND[key].frontRiseCm;
  ok(near(a.guideA.x, N * 2 / 3) && near(a.guideA.y, 0), "3-" + key + ": ⑥ Ⓐ = 기준선 3분의 2 지점");
  ok(near(a.cfSeam.x, N) && near(a.cfSeam.y, -rise), "3-" + key + ": ⑤ Ⓑ = 기준선 끝에서 올림 치수");
  const u = sub(a.cfSeam, a.guideA), nrm = norm(u);
  const toTop = sub(a.cfTop, a.cfSeam);
  ok(near(dot(u, toTop) / nrm, 0, 1e-9) && near(norm(toTop), W, 1e-9), "3-" + key + ": ⑧ Ⓑ에서 ⑦에 직각으로 밴드 폭");
  ok(near(st.lowerNeckSeamLenCm, N, 1e-6) && st.cbTrimCm > 0, "3-" + key + ": ⑭ 달림선 실측 = ×+⊘ (뒤 중심 보정 " + st.cbTrimCm.toFixed(3) + ")");
  ok(near(partLen(st.standGeometry, "neck-seam"), N, 1e-3), "3-" + key + ": 달림선 독립 측정도 ×+⊘");
  ok(near(a.cbSeam.x, a.cbTop.x, 1e-9) && a.cbSeam.x > 0, "3-" + key + ": 보정된 뒤 중심선은 수직·앞으로 이동");
  const ext = sub(a.cfExtSeam, a.cfSeam), extTop = sub(a.cfExtTop, a.cfTop);
  ok(near(norm(ext), BAND[key].frontEndCm, 1e-9) && near(norm(extTop), BAND[key].frontEndCm, 1e-9)
    && near(dot(ext, u) / (norm(ext) * nrm), 1, 1e-9), "3-" + key + ": ⑪ 앞 끝선 = 앞 중심선과 평행·" + BAND[key].frontEndCm);
  ok(near(partLen(st.standGeometry, "extension"), BAND[key].frontEndCm, 1e-9) && near(st.lowerExtensionLenCm, BAND[key].frontEndCm), "3-" + key + ": 앞 끝선 연장 측정");
  ok(near(st.upperNeckSegmentLenCm, partLen(st.standGeometry, "top"), 1e-3) && st.upperNeckSegmentLenCm < N, "3-" + key + ": 밴드 윗선 ⒸⒹ 실측(달림선보다 짧다)");
  ok(C.validateClosedOutline(st.standGeometry.outline).ok, "3-" + key + ": 밴드 폐곡선·자기교차 없음");
  ok(J(st.standGeometry.outline.map(s => s.part)) === J(["neck-seam", "neck-seam", "extension", "cf", "top-extension", "top", "top", "cb-fold"]), "3-" + key + ": 밴드 구성(달림선·앞끝·윗선·CB)");
  ok(near(st.backNeckLenCm, back) && near(st.frontNeckLenCm, front) && near(st.neckTargetCm, N), "3-" + key + ": 몸판 목둘레 기록");
  // 위 칼라(step 2·3)
  const bd = C.computeBody(st, UPPER[key]);
  ok(bd.ok, "3-" + key + ": computeBody ok (" + (bd.reason || "") + ")");
  if (!bd.ok) return;
  const ba = bd.anchors, m = bd.measure;
  ok(near(ba.upperCbSeam.y, a.cbTop.y - UPPER[key].gapCm, 1e-9), "3-" + key + ": ①②③ 간격(밴드 윗선 CB 기준)");
  ok(near(ba.cbOuter.y, ba.upperCbSeam.y - UPPER[key].cbWidthCm, 1e-9) && near(ba.cbOuter.x, ba.upperCbSeam.x, 1e-9), "3-" + key + ": 뒤 위 칼라 폭");
  ok(near(ba.attachFront.x, a.cfTop.x, 1e-12) && near(ba.attachFront.y, a.cfTop.y, 1e-12), "3-" + key + ": 이음선 앞끝 = Ⓒ(밴드 윗선 앞 끝, 물림 없음)");
  ok(near(ba.tip.x - ba.attachFront.x, UPPER[key].frontProjectionCm, 1e-9) && near(norm(sub(ba.tip, ba.attachFront)), UPPER[key].pointDiagonalCm, 1e-9), "3-" + key + ": ⑦ 앞 수평·앞 사선");
  ok(near(bd.attachLenCm, st.upperNeckSegmentLenCm, 0.01), "3-" + key + ": step 3 이음선 = 밴드 윗선 ⒸⒹ");
  ok(near(denseLen(parts(bd.bodyGeometry, "attach")[0]), st.upperNeckSegmentLenCm, 0.01), "3-" + key + ": 이음선 독립 측정");
  ok(near(m.cbCorrectionCm, ba.upperCbSeam.x - a.cbTop.x, 1e-9), "3-" + key + ": 뒤 중심 보정량 기록");
  ok(C.validateClosedOutline(bd.bodyGeometry.outline).ok && J(bd.bodyGeometry.outline.map(s => s.part)) === J(["attach", "point-front", "outer", "cb-fold"]), "3-" + key + ": 위 칼라 폐곡선·구성");
  // 결정론·입력 불변
  const p1 = J(BAND[key]), p2 = J(UPPER[key]);
  ok(J(C.computeStand(bodice(back, front, 1.75), BAND[key]).standGeometry) === J(st.standGeometry)
    && J(C.computeBody(st, UPPER[key]).bodyGeometry) === J(bd.bodyGeometry)
    && J(BAND[key]) === p1 && J(UPPER[key]) === p2, "3-" + key + ": 결정론·입력 불변");
});

// 4. preset 치수만 다르다 — 골격 규칙은 공유, 결과는 서로 다름
{
  const b = bodice(7.6926, 11.129, 1.75);
  const sM = C.computeStand(b, BAND.M), sN = C.computeStand(b, BAND.N), sP = C.computeStand(b, BAND.P);
  ok(near(sM.lowerNeckSeamLenCm, sN.lowerNeckSeamLenCm, 1e-6) && near(sN.lowerNeckSeamLenCm, sP.lowerNeckSeamLenCm, 1e-6), "4: 세 variant 모두 달림선 = ×+⊘");
  ok(sM.upperNeckSegmentLenCm > sN.upperNeckSegmentLenCm && sN.upperNeckSegmentLenCm > sP.upperNeckSegmentLenCm, "4: 올림·밴드 폭이 커질수록 밴드 윗선이 짧아진다");
  ok(sM.cbTrimCm < sN.cbTrimCm && near(sN.cbTrimCm, sP.cbTrimCm, 1e-9), "4: 올림이 클수록 뒤 중심 보정이 커진다(N·P 는 같은 올림)");
  ok(J(sM.standGeometry) !== J(sN.standGeometry) && J(sN.standGeometry) !== J(sP.standGeometry), "4: 치수가 다르면 형상도 다르다");
}

// 5. 원자적 실패 계약(밴드·위 칼라) — 실패 시 geometry 없음
{
  const b = bodice(10, 8, 1.75);
  const bad = (p, reason) => { const r = C.computeStand(b, Object.assign({}, BAND.M, p)); return r.ok === false && r.reason === reason && !("standGeometry" in r); };
  ok(bad({ bandWidthCm: 0 }, "invalid-band-width") && bad({ bandWidthCm: NaN }, "invalid-band-width"), "5: 밴드 폭");
  ok(bad({ frontRiseCm: -1 }, "invalid-front-rise"), "5: 올림 음수");
  ok(bad({ frontEndCm: -0.1 }, "invalid-front-end"), "5: 앞 끝선 음수");
  const st = C.computeStand(b, BAND.M);
  const badB = (p, reason) => { const r = C.computeBody(st, Object.assign({}, UPPER.M, p)); return r.ok === false && r.reason === reason && !("bodyGeometry" in r); };
  ok(badB({ gapCm: 0 }, "invalid-gap") && badB({ cbWidthCm: 0 }, "invalid-cb-width"), "5: 간격·뒤 폭");
  ok(badB({ frontProjectionCm: -1 }, "invalid-front-projection") && badB({ pointDiagonalCm: 1 }, "invalid-point-diagonal"), "5: 앞 수평·사선(사선 > 수평)");
  ok(badB({ outerBowCm: NaN }, "invalid-outer-bow") && badB({ outerBowCm: -30 }, "self-intersection"), "5: 외곽 휨");
  ok(C.computeBody({ ok: false }, UPPER.M).reason === "invalid-stand", "5: 밴드 결과 없음");
  const snap = J(b);
  C.computeStand(b, BAND.M); ok(J(b) === snap, "5: bodiceResult 불변");
}

// 6. 외곽 휨(구현 관례 옵션): 외곽선만 바꾸고 이음선·간격·폭·tip 은 불변
{
  const st = C.computeStand(bodice(7.6926, 11.129, 1.75), BAND.M);
  const b0 = C.computeBody(st, UPPER.M), b1 = C.computeBody(st, Object.assign({}, UPPER.M, { outerBowCm: 1 }));
  ok(b1.ok && J(parts(b0.bodyGeometry, "attach")) === J(parts(b1.bodyGeometry, "attach")), "6: 이음선 불변");
  ok(near(b0.anchors.tip.x, b1.anchors.tip.x) && near(b0.anchors.tip.y, b1.anchors.tip.y) && near(b0.measure.cbWidthCm, b1.measure.cbWidthCm), "6: tip·CB 폭 불변");
  ok(b1.measure.outerEdgeLenCm > b0.measure.outerEdgeLenCm && parts(b0.bodyGeometry, "outer")[0].kind === "line" && parts(b1.bodyGeometry, "outer")[0].kind === "cubic", "6: 휨 0 = 직선 / ≠0 = 곡선·더 길다");
}

// 7. 관리형 직접 편집(C3): 고정 topology·locked 이음선·endpoint 잠금·교차·입력 불변
{
  const st = C.computeStand(bodice(7.6926, 11.129, 1.75), BAND.M);
  const body0 = C.computeBody(st, UPPER.M);
  const lc = C.collarBodyLineFromGeometry(body0.bodyGeometry);
  ok(lc && lc.segments.length === 3 && lc.anchors.length === 4, "7: 관리 체인 3세그·4 anchor");
  ok(near(lc.anchors[0].x, body0.anchors.cbOuter.x) && near(lc.anchors[2].x, body0.anchors.tip.x)
    && near(lc.anchors[3].x, body0.anchors.attachFront.x) && near(lc.anchors[3].y, body0.anchors.attachFront.y), "7: anchor = cbOuter·bowMid·tip·Ⓒ");
  ok(J(lc.locked.attachSegs.map(s => [s.kind, s.from, s.to])) === J(parts(body0.bodyGeometry, "attach").map(s => [s.kind, s.from, s.to])), "7: locked = 위칼라 이음선 그대로");
  const rt = C.computeFromBodyLine(lc.segments, lc.locked);
  ok(rt.ok && near(rt.attachLenCm, body0.attachLenCm, 1e-9) && near(rt.measure.pointDiagonalLenCm, 6, 1e-9), "7: round-trip 길이·사선 보존");
  const cl = s => ({ kind: "line", from: { x: s.from.x, y: s.from.y }, to: { x: s.to.x, y: s.to.y } });
  const moveA = (segs, idx, np) => { const s = segs.map(cl); if (idx > 0) s[idx - 1].to = { x: np.x, y: np.y }; if (idx < s.length) s[idx].from = { x: np.x, y: np.y }; return s; };
  ok(C.computeFromBodyLine(moveA(lc.segments, 0, { x: 99, y: 99 }), lc.locked).reason === "endpoint-cbouter", "7: cbOuter 이동 거부");
  ok(C.computeFromBodyLine(moveA(lc.segments, 3, { x: 99, y: 99 }), lc.locked).reason === "endpoint-attachfront", "7: Ⓒ 이동 거부");
  ok(C.computeFromBodyLine(moveA(lc.segments, 1, { x: lc.anchors[1].x, y: lc.anchors[1].y - 1 }), lc.locked).ok, "7: 유효 편집 ok");
  ok(C.computeFromBodyLine([], lc.locked).reason === "no-line" && C.computeFromBodyLine(lc.segments, { attachSegs: [] }).reason === "no-attach", "7: 실패 계약");
  const segStr = J(lc.segments), lockStr = J(lc.locked), gStr = J(body0.bodyGeometry);
  C.computeFromBodyLine(lc.segments, lc.locked); C.collarBodyLineFromGeometry(body0.bodyGeometry);
  ok(J(lc.segments) === segStr && J(lc.locked) === lockStr && J(body0.bodyGeometry) === gStr, "7: 입력 불변");
}

// 8. 여러 목둘레에서 계약 유지
{
  [[8, 9, 0], [10, 8, 1.75], [7.2, 12.4, 1.5], [9.5, 10.5, 2]].forEach(([back, front, ov], i) => {
    ["M", "N", "P"].forEach(key => {
      const st = C.computeStand(bodice(back, front, ov), BAND[key]);
      if (!st.ok) { ok(false, "8-" + i + key + ": stand " + st.reason); return; }
      const bd = C.computeBody(st, UPPER[key]);
      ok(bd.ok && near(st.lowerNeckSeamLenCm, back + front, 1e-6) && near(bd.attachLenCm, st.upperNeckSegmentLenCm, 0.01)
        && C.validateClosedOutline(st.standGeometry.outline).ok && C.validateClosedOutline(bd.bodyGeometry.outline).ok,
        "8-" + i + key + ": 달림선=목둘레·이음선=밴드 윗선·폐곡선");
    });
  });
}

// 9. 한 장 셔츠 칼라(family 2)는 별도 생성기 — 밴드 파라미터와 섞이지 않는다
{
  const g = C.computeOnePiece(bodice(7.6926, 11.129, 1.75), { riseCm: 2.5, backCollarWidthCm: 3.5, collarStandCm: 3, frontCollarWidthCm: 6.5, tipProjectionCm: 3, attachCurveCm: 0.2 });
  ok(g.ok && g.geometry.outline.some(s => s.part === "front-end") && !g.geometry.outline.some(s => s.part === "top"), "9: 한 장 칼라는 자체 구성(밴드 윗선 없음)");
  ok(C.computeOnePiece(bodice(10, 8), BAND.M).ok === false, "9: 밴드 파라미터로는 한 장 칼라를 만들 수 없다");
}

console.log(`designCollarCheck: ${PASS} PASS, ${FAIL} FAIL`);
if (FAIL) { console.log("FAILURES:\n  " + fails.join("\n  ")); process.exit(1); }
