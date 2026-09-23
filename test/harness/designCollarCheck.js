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
  const h = C.computeOnePiece(bodice(7.6926, 11.129, 1.75), { riseCm: 8, backCollarWidthCm: 3.5, collarStandCm: 1, frontCollarWidthCm: 6.5, tipProjectionCm: 4.5, attachCurveCm: 0.3 });
  ok(h.ok && C.validateClosedOutline(h.geometry.outline).ok && h.measure.riseCm === 8 && h.measure.collarStandCm === 1 && Math.abs(h.measure.tipProjectionCm - 4.5) < 1e-9, "9: H 수치로 한 장 폐곡선 생성(올림8·허리1·앞끝4.5)");
  ok(JSON.stringify(h.geometry) !== JSON.stringify(g.geometry) && h.measure.outerLenCm !== g.measure.outerLenCm, "9: H 는 G fallback 이 아닌 별도 실루엣");
  const i = C.computeOnePiece(bodice(7.6926, 11.129, 1.75), { riseCm: 4.5, backCollarWidthCm: 3.5, collarStandCm: 2, frontCollarWidthCm: 6.5, tipProjectionCm: 3.5, attachCurveCm: 0.3 });
  ok(i.ok && C.validateClosedOutline(i.geometry.outline).ok && i.measure.riseCm === 4.5 && i.measure.collarStandCm === 2 && Math.abs(i.measure.tipProjectionCm - 3.5) < 1e-9, "9: I 수치로 한 장 폐곡선 생성(올림4.5·허리2·앞끝3.5)");
  ok(JSON.stringify(i.geometry) !== JSON.stringify(g.geometry) && JSON.stringify(i.geometry) !== JSON.stringify(h.geometry), "9: I 는 G/H fallback 이 아닌 별도 실루엣");
  const j = C.computeOnePiece(bodice(7.6926, 11.129, 1.75), { riseCm: 1, backCollarWidthCm: 3.5, collarStandCm: 4, frontCollarWidthCm: 6.5, tipProjectionCm: 2.5, attachCurveCm: 0 });
  ok(j.ok && C.validateClosedOutline(j.geometry.outline).ok && j.measure.riseCm === 1 && j.measure.collarStandCm === 4 && Math.abs(j.measure.tipProjectionCm - 2.5) < 1e-9, "9: J 수치로 한 장 폐곡선 생성(올림1·허리4·앞끝2.5·별도 곡률 무표기)");
  ok(Math.abs(j.anchors.cbFold.y - (j.anchors.cbAttach.y - 4)) < 1e-9
    && Math.abs(j.anchors.cbOuter.y - (j.anchors.cbFold.y - 3.5)) < 1e-9
    && Math.abs(j.anchors.cbOuter.y - (j.anchors.cbAttach.y - 7.5)) < 1e-9, "9: J CB = 허리4 + 뒤 폭3.5(허리가 뒤 폭보다 커도 독립 구간)");
  ok(JSON.stringify(j.geometry) !== JSON.stringify(g.geometry) && JSON.stringify(j.geometry) !== JSON.stringify(h.geometry)
    && JSON.stringify(j.geometry) !== JSON.stringify(i.geometry), "9: J 는 G/H/I fallback 이 아닌 별도 실루엣");
  const k = C.computeOnePiece(bodice(7.6926, 11.129, 1.75), { riseCm: 4.5, backCollarWidthCm: 3.5, collarStandCm: 2, frontCollarWidthCm: 6.5, tipProjectionCm: 3.5, attachCurveCm: 0.6, attachCurveDirection: "reversed" });
  ok(k.ok && C.validateClosedOutline(k.geometry.outline).ok && k.measure.attachCurveDirection === "reversed" && k.measure.attachCurveCm === 0.6, "9: K 수치로 한 장 폐곡선 생성(I 치수·곡률0.6 반대 방향)");
  const iAttach = i.geometry.outline.filter(s => s.part === "attach"), kAttach = k.geometry.outline.filter(s => s.part === "attach");
  const midY = (k.anchors.a.y + k.anchors.b.y) / 2;
  ok(iAttach.length === 3 && kAttach.length === 3 && iAttach[1].to.y < midY && kAttach[1].to.y > midY, "9: I는 칼라 쪽·K는 반대쪽으로 앞 달림선 곡률");
  ok(k.anchors.a.x === i.anchors.a.x && k.anchors.a.y === i.anchors.a.y && k.anchors.b.x === i.anchors.b.x && k.anchors.b.y === i.anchors.b.y
    && JSON.stringify(k.geometry) !== JSON.stringify(i.geometry), "9: K는 I 기준점·치수 유지 + 달림선 형상만 변경");
  ok(C.computeOnePiece(bodice(7.6926, 11.129), { riseCm: 4.5, backCollarWidthCm: 3.5, collarStandCm: 2, frontCollarWidthCm: 6.5, tipProjectionCm: 3.5, attachCurveCm: 0.6, attachCurveDirection: "sideways" }).reason === "invalid-attach-curve-direction", "9: 알 수 없는 곡률 방향 거부");
  ok(C.computeOnePiece(bodice(10, 8), BAND.M).ok === false, "9: 밴드 파라미터로는 한 장 칼라를 만들 수 없다");
}

// 11. 교재 O(P.67) — P.148 골격 + D(P.61) 방식 기초선 옵션. M·N·P 는 옵션 없이 완전히 동일해야 한다.
{
  const B = bodice(8.6087, 12.3874, 1.75), NECK = 8.6087 + 12.3874;
  const O_STAND = { bandWidthCm: 3, frontRiseCm: 8.5, frontEndCm: 0.5 };
  const O_BODY = { gapCm: 14, cbWidthCm: 4, frontProjectionCm: 4, pointDiagonalCm: 6, outerBowCm: 0 };
  const O_CONS = { baselineReductionCm: 2.5, guideRiseCm: 2 };

  // ① 옵션 없음 = 기존 제도(인자 생략·빈 객체·0 값이 전부 동일)
  const plain = C.computeStand(B, BAND.M);
  ok(J(C.computeStand(B, BAND.M, {})) === J(plain)
    && J(C.computeStand(B, BAND.M, { baselineReductionCm: 0, guideRiseCm: 0 })) === J(plain), "11: 옵션 없음/0 은 기존 M 제도와 byte-identical");
  ok(plain.baseLineLenCm === plain.neckTargetCm && plain.baselineReductionCm === 0 && plain.guideRiseCm === 0, "11: 옵션 없으면 기초선 = ×+⊘");

  const o = C.computeStand(B, O_STAND, O_CONS);
  ok(o.ok && C.validateClosedOutline(o.standGeometry.outline).ok, "11: O 밴드 폐곡선 생성");
  // ★ 기초선만 줄인다 — ⑭ 목표 실측은 감산 전 ×+⊘ 그대로
  ok(Math.abs(o.baseLineLenCm - (NECK - 2.5)) < 1e-9 && Math.abs(o.neckTargetCm - NECK) < 1e-9
    && Math.abs(o.lowerNeckSeamLenCm - NECK) < 1e-6, "11: 기초선 = ×+⊘−2.5 · 달림선 실측 = ×+⊘");
  ok(Math.abs(o.anchors.cfSeam.x - (NECK - 2.5)) < 1e-9 && Math.abs(o.anchors.cfSeam.y + 8.5) < 1e-9, "11: Ⓑ = 감산된 기초선 끝에서 올림 8.5");
  // ⑥ 앞쪽 2/3 안내점 Ⓐ 를 기초선 위로 2 올린다(P.146 ⑥·P.148 ⑥ 의 유일한 명명 안내점)
  ok(Math.abs(o.anchors.guideA.x - (NECK - 2.5) * 2 / 3) < 1e-9 && Math.abs(o.anchors.guideA.y + 2) < 1e-9, "11: Ⓐ = 감산 기초선의 앞쪽 2/3 · 2cm 올림");
  ok(Math.abs(o.baselineReductionCm - 2.5) < 1e-12 && Math.abs(o.guideRiseCm - 2) < 1e-12, "11: 구성 옵션 실측 보고");

  // ★ 교재 목적: "올림이 크면 달림선 오차가 커지므로 미리 뺀다" — 감산·Ⓐ 올림이 둘 다 ⑭ 보정량을 줄인다
  const noOpt = C.computeStand(B, O_STAND);
  const onlyRed = C.computeStand(B, O_STAND, { baselineReductionCm: 2.5, guideRiseCm: 0 });
  ok(noOpt.ok && onlyRed.ok && noOpt.cbTrimCm > onlyRed.cbTrimCm && onlyRed.cbTrimCm > o.cbTrimCm && o.cbTrimCm > 0,
    "11: 감산·Ⓐ 올림이 뒤 중심 보정량을 단조 감소(그린 길이 ≥ 목둘레 유지)");
  // 방향 판정 근거: Ⓐ 를 **올릴수록** 그린 달림선이 짧아진다(= 교재가 말한 "오차를 줄인다").
  //   내리는 경우는 엔진이 음수 올림을 거부하므로 위 실패 계약으로 대신 잠근다.
  const raise1 = C.computeStand(B, O_STAND, { baselineReductionCm: 2.5, guideRiseCm: 1 });
  ok(onlyRed.drawnAttachLenCm > raise1.drawnAttachLenCm && raise1.drawnAttachLenCm > o.drawnAttachLenCm,
    "11: Ⓐ 올림이 커질수록 그린 달림선이 단조 감소");

  // 위 칼라(간격 14·CB 폭 4·수평 4·사선 6)까지 연결
  const body = C.computeBody(o, O_BODY);
  ok(body.ok && C.validateClosedOutline(body.bodyGeometry.outline).ok
    && Math.abs(body.attachLenCm - o.upperNeckSegmentLenCm) < 1e-6, "11: O 위 칼라 이음선 = 밴드 윗선 ⒸⒹ");
  ok(Math.abs(body.measure.gapCm - 14) < 1e-9 && Math.abs(body.measure.cbWidthCm - 4) < 1e-9
    && Math.abs(body.measure.frontProjectionCm - 4) < 1e-9 && Math.abs(body.measure.pointDiagonalLenCm - 6) < 1e-6, "11: O 위 칼라 교재 수치(14·4·4·6)");

  // 실패 계약
  ok(C.computeStand(B, O_STAND, { baselineReductionCm: -1, guideRiseCm: 2 }).reason === "invalid-construction-guide"
    && C.computeStand(B, O_STAND, { baselineReductionCm: 2.5, guideRiseCm: -1 }).reason === "invalid-construction-guide"
    && C.computeStand(B, O_STAND, { baselineReductionCm: NECK, guideRiseCm: 0 }).reason === "invalid-construction-guide", "11: 감산·올림 범위 밖 거부");
  // 감산이 과하면 그린 달림선이 목둘레보다 짧아져 ⑭ 보정이 불가능 → 정직하게 거부
  ok(C.computeStand(B, O_STAND, { baselineReductionCm: 8, guideRiseCm: 2 }).reason === "invalid-front-rise", "11: 보정으로 줄일 수 없으면 거부");
  // M·N·P 는 옵션을 주지 않으므로 형상·실측 불변
  ["M", "N", "P"].forEach(k => {
    const a = C.computeStand(B, BAND[k]), b2 = C.computeStand(B, BAND[k], null);
    ok(J(a.standGeometry) === J(b2.standGeometry) && a.lowerNeckSeamLenCm === b2.lowerNeckSeamLenCm, "11: " + k + " 은 옵션 도입과 무관하게 동일");
  });
}

// 10. 오픈 칼라(교재 L, P.65 — 몸판 연동 전용 계약). G~K(한 장, P.147)와 섞이지 않는다.
{
  // 앞판 외곽(SV3 의미 모서리): center(수직) + neckline(곡선) + shoulder. FNP = center∩neckline.
  const frontOutline = (nk) => [
    { kind: "line", from: { x: 40, y: 2 }, to: { x: 40, y: 38 }, edge: "center" },
    nk || { kind: "path", commands: [{ type: "M", points: [{ x: 40, y: 2 }] },
      { type: "C", points: [{ x: 35.6, y: 2 }, { x: 31.4, y: 0.2 }, { x: 29.2, y: -2.4 }] }], edge: "neckline" },
    { kind: "line", from: { x: 29.2, y: -2.4 }, to: { x: 21, y: 1.2 }, edge: "shoulder" }
  ];
  const openBodice = (overlap, nk) => { const b = bodice(7.6926, 11.129, overlap); b.front = { outline: frontOutline(nk) }; return b; };
  const L_PARAMS = { backCollarWidthCm: 3.5, collarStandCm: 3, frontEndRiseCm: 1, frontStraightCm: 4, breakPointDistanceCm: 8 };
  const B = openBodice(1.75), NECK = 7.6926 + 11.129;
  const r = C.computeOpenCollar(B, L_PARAMS);

  ok(typeof C.computeOpenCollar === "function" && J(C.OPEN_COLLAR_METHOD) === J({ page: 65, methodPage: 147,
    smoothing: "tangent-continuous-cubic", handleFraction: 1 / 3, lengthResponsibility: "attach-equals-neck", bodyLinked: true }),
    "10: 오픈 칼라 API·제도법 메타(곡선 정리는 구현 관례·길이 책임은 달림선)");
  ok(r.ok && C.validateClosedOutline(r.geometry.outline).ok, "10: L 기본 수치로 폐곡선 생성");

  // ★ 길이 책임(사용자 확정 A안): 달림선 실측 = ×+⊘. 독립 dense 측정으로 재검산한다.
  const attachSegs = r.geometry.outline.filter(s => s.part === "attach" || s.part === "attach-front");
  const attachDense = attachSegs.reduce((t, s) => t + denseLen(s), 0);
  ok(Math.abs(attachDense - NECK) < 1e-3 && Math.abs(r.measure.attachLenCm - NECK) < 1e-6,
    "10: 달림선 실측 = 목둘레 ×+⊘(독립 측정 재검산)");
  // 앞 끝 직선 구간은 교재 4cm 그대로(그려진 직선의 길이)
  const straight = r.geometry.outline.filter(s => s.part === "attach-front");
  ok(straight.length === 1 && straight[0].kind === "line" && Math.abs(denseLen(straight[0]) - 4) < 1e-6, "10: 앞 끝 직선 구간 = 4cm(직선 1개)");
  // 기초선은 파생값(달림선이 올라가므로 ×+⊘ 보다 짧다) — 독립 목표 수치가 아니다
  ok(r.measure.baseLineLenCm < NECK && NECK - r.measure.baseLineLenCm < 0.2 && Math.abs(r.anchors.baseEnd.x - r.measure.baseLineLenCm) < 1e-9,
    "10: 기초선 길이 = 파생(×+⊘ 보다 약간 짧음)");
  // 꺾임점 들림도 파생: 0 < lift < 앞 끝 올림
  ok(r.measure.foldJunctionLiftCm > 0 && r.measure.foldJunctionLiftCm < L_PARAMS.frontEndRiseCm
    && Math.abs(-r.anchors.foldJunction.y - r.measure.foldJunctionLiftCm) < 1e-12, "10: 꺾임점 들림 = 파생값(0 < 들림 < 앞 끝 올림)");
  ok(Math.abs(Math.hypot(r.anchors.frontEnd.x - r.anchors.foldJunction.x, r.anchors.frontEnd.y - r.anchors.foldJunction.y) - 4) < 1e-9,
    "10: 꺾임점은 앞 끝에서 직선 4cm");

  // CB: 허리 3 → 이어서 뒤 폭 3.5(포개 재지 않음), 앞 끝은 기초선에서 수직 1 위
  ok(Math.abs(r.anchors.cbFold.y + 3) < 1e-12 && Math.abs(r.anchors.cbOuter.y + 6.5) < 1e-12
    && Math.abs(r.anchors.cbAttach.x) < 1e-12 && Math.abs(r.anchors.cbAttach.y) < 1e-12, "10: CB = 허리 3 + 뒤 폭 3.5(합 6.5)");
  ok(Math.abs(r.anchors.frontEnd.y + 1) < 1e-12 && Math.abs(r.anchors.frontEnd.x - r.anchors.baseEnd.x) < 1e-12, "10: 앞 끝 = 기초선 오른쪽 끝에서 수직 1cm 위");
  const outer = r.geometry.outline.filter(s => s.part === "outer")[0], frontEdge = r.geometry.outline.filter(s => s.part === "front-end")[0];
  ok(outer && outer.kind === "line" && Math.abs(outer.from.y - outer.to.y) < 1e-12 && Math.abs(r.measure.outerLenCm - r.measure.baseLineLenCm) < 1e-9,
    "10: 외곽선은 기초선과 나란한 수평 직선(골선 재단 가능)");
  ok(frontEdge && Math.abs(frontEdge.from.x - frontEdge.to.x) < 1e-12 && Math.abs(r.measure.frontEdgeLenCm - 5.5) < 1e-9, "10: 앞 끝선은 수직 5.5cm(6.5 − 1)");
  // 꺾임선(구성선)은 CB 허리점 → 꺾임점
  const fold = r.geometry.construction.filter(s => s.part === "fold");
  ok(r.geometry.construction.some(s => s.part === "baseline") && fold.length === 1
    && Math.abs(fold[0].from.y + 3) < 1e-12 && Math.abs(fold[0].to.x - r.anchors.foldJunction.x) < 1e-12, "10: 구성선 = 기초선 + CB 허리점→꺾임점 꺾임선");

  // ── 몸판 연동: 실제 목둘레선·여밈 끝선에서 꺾임선을 읽는다 ──
  const bl = r.bodyLink, nk = C.frontNecklineFromBodice(B);
  ok(bl && Math.abs(bl.frontNeckPoint.x - 40) < 1e-9 && Math.abs(bl.frontNeckPoint.y - 2) < 1e-9, "10: 앞 중심 목점 = center∩neckline 공유 끝점");
  // breakTop 은 목둘레 곡선 위 호길이 4 지점(독립 dense 샘플로 재검산)
  const chain = nk.chain, sample = [];
  chain.forEach(s => { let pr = s.from; for (let i = 1; i <= 4000; i++) { const p = s.kind === "line"
    ? { x: s.from.x + (s.to.x - s.from.x) * i / 4000, y: s.from.y + (s.to.y - s.from.y) * i / 4000 } : cubicPt(s, i / 4000);
    sample.push({ p, d: Math.hypot(p.x - pr.x, p.y - pr.y) }); pr = p; } });
  let acc = 0, arcAtTop = null;
  sample.forEach(({ p, d }) => { acc += d; if (arcAtTop === null && Math.hypot(p.x - bl.breakTop.x, p.y - bl.breakTop.y) < 5e-3) arcAtTop = acc; });
  ok(arcAtTop !== null && Math.abs(arcAtTop - 4) < 1e-2, "10: 꺾임선 윗 끝 = 앞목점에서 목둘레 호길이 4cm");
  ok(Math.abs(Math.hypot(bl.breakEnd.x - bl.frontNeckPoint.x, bl.breakEnd.y - bl.frontNeckPoint.y) - 8) < 1e-9, "10: 꺾임 끝 = 앞목점에서 두 점 사이 직선 8cm");
  ok(Math.abs(bl.breakEnd.x - (bl.frontNeckPoint.x + 1.75)) < 1e-9 && bl.breakEnd.y > bl.frontNeckPoint.y, "10: 꺾임 끝은 여밈 끝선(앞중심+1.75) 위·아래쪽");
  ok(bl.breakLine.length === 1 && bl.breakLine[0].kind === "line" && Math.abs(r.measure.breakLineLenCm - denseLen(bl.breakLine[0])) < 1e-9, "10: 꺾임선 = 직선 1개·길이 실측");
  // 여밈 0 → 꺾임 끝은 앞 중심선 위(교재 수치 그대로 적용)
  const r0 = C.computeOpenCollar(openBodice(0), L_PARAMS);
  ok(r0.ok && Math.abs(r0.bodyLink.breakEnd.x - 40) < 1e-12 && Math.abs(r0.measure.breakDropCm - 8) < 1e-12, "10: 여밈 0 이면 꺾임 끝이 앞 중심선 위(내림 8)");
  // 몸판 목둘레 **곡선**이 달라지면(같은 길이 입력이어도) 꺾임선이 달라진다 = 실제 몸판 연동
  const other = { kind: "path", commands: [{ type: "M", points: [{ x: 40, y: 2 }] },
    { type: "C", points: [{ x: 37.5, y: 2 }, { x: 31.8, y: -1.6 }, { x: 29.2, y: -2.4 }] }], edge: "neckline" };
  const r2 = C.computeOpenCollar(openBodice(1.75, other), L_PARAMS);
  ok(r2.ok && J(r2.bodyLink.breakTop) !== J(bl.breakTop) && J(r2.geometry) === J(r.geometry),
    "10: 목둘레 곡선이 달라지면 꺾임선만 달라진다(칼라 형상은 목둘레 길이 기반)");

  // ── 실패 계약(원자적) ──
  const noNeck = openBodice(1.75); noNeck.front = { outline: [{ kind: "line", from: { x: 40, y: 2 }, to: { x: 40, y: 38 }, edge: "center" }] };
  ok(C.computeOpenCollar(noNeck, L_PARAMS).reason === "no-body-neckline", "10: 몸판 목둘레선 없음 거부");
  const noCenter = openBodice(1.75); noCenter.front = { outline: frontOutline().filter(s => s.edge !== "center") };
  ok(C.computeOpenCollar(noCenter, L_PARAMS).reason === "no-body-center", "10: 몸판 앞 중심선 없음 거부");
  const twoJoin = openBodice(1.75);
  twoJoin.front = { outline: frontOutline().concat([{ kind: "line", from: { x: 40, y: 38 }, to: { x: 33, y: 38 }, edge: "neckline" }]) };
  ok(C.computeOpenCollar(twoJoin, L_PARAMS).reason === "ambiguous-front-neck-point", "10: 목점 후보 복수 거부(추측 금지)");
  ok(C.computeOpenCollar(B, { ...L_PARAMS, frontStraightCm: 13 }).reason === "break-start-out-of-neckline", "10: 앞 직선 구간 > 앞 목둘레선 거부");
  ok(C.computeOpenCollar(B, { ...L_PARAMS, breakPointDistanceCm: 1.5 }).reason === "invalid-break-point", "10: 꺾임 끝 거리 ≤ 여밈분 거부");
  ok(C.computeOpenCollar(B, { ...L_PARAMS, frontEndRiseCm: 6.5 }).reason === "invalid-front-end-rise", "10: 앞 끝 올림 ≥ 칼라 높이 거부");
  ok(C.computeOpenCollar(B, { ...L_PARAMS, backCollarWidthCm: 0 }).reason === "invalid-back-collar-width"
    && C.computeOpenCollar(B, { ...L_PARAMS, collarStandCm: -1 }).reason === "invalid-collar-stand"
    && C.computeOpenCollar(B, { ...L_PARAMS, frontStraightCm: 0 }).reason === "invalid-front-straight", "10: 비유한·범위 밖 파라미터 거부");
  ok(C.computeOpenCollar(null, L_PARAMS).reason === "no-bodice" && C.computeOpenCollar({}, L_PARAMS).reason === "no-neckline", "10: 몸판·목둘레 없음 거부");
  // 한 장(G~K) 파라미터로는 오픈 칼라를 만들 수 없다(의미 혼용 금지)
  ok(C.computeOpenCollar(B, { riseCm: 2.5, backCollarWidthCm: 3.5, collarStandCm: 3, frontCollarWidthCm: 6.5, tipProjectionCm: 3, attachCurveCm: 0.2 }).ok === false,
    "10: G~K 파라미터로는 오픈 칼라 생성 불가");
  // 입력 불변(몸판 결과를 변형하지 않는다)
  const snap = J(B);
  C.computeOpenCollar(B, L_PARAMS);
  ok(J(B) === snap, "10: 입력 bodiceResult 비변형(몸판 원본 geometry 무변경)");
  // 결정론
  ok(J(C.computeOpenCollar(B, L_PARAMS)) === J(r), "10: 같은 입력 → 같은 결과(결정론)");
}

// 12. 교재 Q(P.68) 윙 칼라 — 수평 꺾임선 밴드 + 앞 위 끝 칼라 끝. M·N·O·P 는 옵션 없이 동일.
{
  const B = bodice(8.6087, 12.3874, 1.75), NECK = 8.6087 + 12.3874;
  const Q_STAND = { bandWidthCm: 3, frontRiseCm: 1, frontEndCm: 0.5 };
  const Q_TIP = { tipBaseCm: 7, tipSetbackCm: 1.5, tipEdgeCm: 4.5 };

  ok(typeof C.computeWingTip === "function" && J(C.WING_METHOD) === J({ page: 68, bandMethodPage: 148, foldLine: "horizontal",
    smoothing: "tangent-continuous-cubic", handleFraction: 1 / 3, derivedTipHeight: true }), "12: 윙 칼라 API·제도법 메타(꺾임선 수평·세로 성분 파생)");

  // ① 밴드: 꺾임선이 **수평 직선**, 옵션 없으면 기존 M 제도와 byte-identical
  const plain = C.computeStand(B, BAND.M);
  ok(J(C.computeStand(B, BAND.M, { horizontalTopLine: false })) === J(plain), "12: horizontalTopLine:false 는 기존 제도와 동일");
  const st = C.computeStand(B, Q_STAND, { horizontalTopLine: true });
  ok(st.ok && st.horizontalTopLine === true && C.validateClosedOutline(st.standGeometry.outline).ok, "12: Q 밴드 폐곡선");
  const top = st.standGeometry.outline.filter(s => s.part === "top");
  ok(top.length === 1 && top[0].kind === "line" && Math.abs(top[0].from.y - top[0].to.y) < 1e-12
    && Math.abs(top[0].from.y + Q_STAND.bandWidthCm) < 1e-12, "12: 꺾임선 = y = −밴드 폭 수평 직선 1개");
  // ★ 밴드 달림선 실측 = 목둘레(P.148 ⑭)
  const attachDense = st.standGeometry.outline.filter(s => s.part === "neck-seam").reduce((t, s) => t + denseLen(s), 0);
  ok(Math.abs(st.lowerNeckSeamLenCm - NECK) < 1e-6 && Math.abs(attachDense - NECK) < 1e-3, "12: 달림선 실측 = ×+⊘(독립 측정 재검산)");
  ok(Math.abs(st.anchors.cfTop.y + Q_STAND.bandWidthCm) < 1e-12, "12: 앞 위 끝 Ⓒ = 앞 중심선 ∩ 수평 꺾임선");
  ok(C.computeStand(B, { bandWidthCm: 1, frontRiseCm: 1, frontEndCm: 0.5 }, { horizontalTopLine: true }).reason === "invalid-band-width",
    "12: 밴드 폭 ≤ 앞 중심 올림이면 수평 꺾임선 불가");

  // ② 칼라 끝: 세 수치가 전부 꺾임선·Ⓒ 기준, 세로 성분은 파생
  const tip = C.computeWingTip(st, Q_TIP);
  ok(tip.ok && C.validateClosedOutline(tip.geometry.outline).ok, "12: 칼라 끝 폐곡선");
  const C0 = st.anchors.cfTop;
  ok(Math.abs(tip.anchors.foldFront.x - C0.x) < 1e-12 && Math.abs(tip.anchors.foldFront.y - C0.y) < 1e-12, "12: 앞변 발점 = 앞 위 끝 Ⓒ");
  ok(Math.abs(tip.anchors.foldBack.x - (C0.x - 7)) < 1e-12 && Math.abs(tip.anchors.foldBack.y - C0.y) < 1e-12, "12: 뒤 제도점 = 꺾임선 위 Ⓒ에서 뒤로 7");
  ok(Math.abs(C0.x - tip.anchors.tip.x - 1.5) < 1e-12, "12: 꼭짓점 수평 후퇴 1.5");
  ok(Math.abs(Math.hypot(tip.anchors.tip.x - C0.x, tip.anchors.tip.y - C0.y) - 4.5) < 1e-9, "12: 앞변 직선 = 4.5");
  ok(Math.abs(tip.measure.tipHeightCm - Math.sqrt(4.5 * 4.5 - 1.5 * 1.5)) < 1e-12
    && Math.abs((C0.y - tip.anchors.tip.y) - tip.measure.tipHeightCm) < 1e-12, "12: 세로 성분은 √(앞변²−후퇴²) 파생값");
  // 실측 재검산(독립 dense)
  const parts3 = (p) => tip.geometry.outline.filter(s => s.part === p).reduce((t, s) => t + denseLen(s), 0);
  ok(Math.abs(parts3("fold") - 7) < 1e-6 && Math.abs(parts3("tip-front") - 4.5) < 1e-6, "12: 밑변 7·앞변 4.5 실측 일치");
  ok(parts3("outer") > 7 && Math.abs(parts3("outer") - tip.measure.outerEdgeLenCm) < 1e-3, "12: 외곽선은 완만한 곡선(밑변보다 김)·실측 보고");
  const outerSeg = tip.geometry.outline.filter(s => s.part === "outer")[0];
  ok(outerSeg.kind === "cubic" && Math.abs(outerSeg.c1.y - outerSeg.from.y) < 1e-12, "12: 외곽선 시작 접선은 꺾임선과 나란함(구현 관례)");

  // 실패 계약(원자적)
  ok(C.computeWingTip(st, { tipBaseCm: 0, tipSetbackCm: 1.5, tipEdgeCm: 4.5 }).reason === "invalid-tip-base"
    && C.computeWingTip(st, { tipBaseCm: 7, tipSetbackCm: 0, tipEdgeCm: 4.5 }).reason === "invalid-tip-setback"
    && C.computeWingTip(st, { tipBaseCm: 7, tipSetbackCm: 1.5, tipEdgeCm: 1.5 }).reason === "invalid-tip-edge"
    && C.computeWingTip(st, { tipBaseCm: 1, tipSetbackCm: 1.5, tipEdgeCm: 4.5 }).reason === "invalid-tip-base"
    && C.computeWingTip(st, { tipBaseCm: 99, tipSetbackCm: 1.5, tipEdgeCm: 4.5 }).reason === "tip-base-too-long", "12: 칼라 끝 범위 밖 거부");
  ok(C.computeWingTip(C.computeStand(B, Q_STAND), Q_TIP).reason === "invalid-stand"
    && C.computeWingTip(null, Q_TIP).reason === "invalid-stand", "12: 수평 꺾임선 밴드가 아니면 거부");
  // 결정론·입력 불변
  const snapQ = J(B);
  ok(J(C.computeWingTip(st, Q_TIP)) === J(tip) && J(B) === snapQ, "12: 결정론·입력 비변형");
  // M·N·P 는 옵션 도입과 무관
  ["M", "N", "P"].forEach(k => {
    ok(J(C.computeStand(B, BAND[k])) === J(C.computeStand(B, BAND[k], {})), "12: " + k + " 은 수평 꺾임선 옵션과 무관하게 동일");
  });
}

console.log(`designCollarCheck: ${PASS} PASS, ${FAIL} FAIL`);
if (FAIL) { console.log("FAILURES:\n  " + fails.join("\n  ")); process.exit(1); }
