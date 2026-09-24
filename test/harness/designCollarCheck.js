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

// 13. 교재 R(P.68 하단) 밴드+위 칼라 **한 장** — 밴드 윗선을 경계로 위 칼라가 이어진다.
//     M·N·O·P·Q 는 이 생성기와 무관하게 동일해야 한다.
{
  const B = bodice(8.6087, 12.3874, 1.75), BACK = 8.6087, NECK = 8.6087 + 12.3874;
  const R_STAND = { bandWidthCm: 3, frontRiseCm: 1, frontEndCm: 0.5 };
  const R_UPPER = { upperWidthCm: 3.5, frontWidthCm: 6.5, outerBowCm: 0.5 };

  ok(typeof C.computeBandOnePiece === "function" && J(C.BAND_ONE_PIECE_METHOD) === J({ page: 68, bandMethodPage: 148, joined: true,
    outerBackFrom: "back-neck", smoothing: "tangent-continuous-cubic", handleFraction: 1 / 3 }), "13: R API·제도법 메타(한 장·외곽 뒤 = 뒤 목둘레)");

  const r = C.computeBandOnePiece(B, R_STAND, R_UPPER);
  ok(r.ok && C.validateClosedOutline(r.geometry.outline).ok, "13: R 폐곡선 한 조각");
  const st = C.computeStand(B, R_STAND);
  // ① 밴드 골격은 M 과 같은 P.148 제도 — 달림선·앞 끝선이 그대로 온다
  const attachR = r.geometry.outline.filter(s => s.part === "neck-seam");
  const attachDenseR = attachR.reduce((t, s) => t + denseLen(s), 0);
  ok(Math.abs(r.measure.lowerNeckSeamLenCm - NECK) < 1e-6 && Math.abs(attachDenseR - NECK) < 1e-3, "13: 달림선 실측 = ×+⊘(독립 측정 재검산)");
  ok(J(attachR.map(s => [s.kind, s.from, s.to])) === J(st.standGeometry.outline.filter(s => s.part === "neck-seam").map(s => [s.kind, s.from, s.to])),
    "13: 달림선은 P.148 밴드(M 골격)와 동일 — 한 장이라고 다시 긋지 않는다");
  // ② 이음선 자리(밴드 윗선)는 **구성선**으로만 남는다(외곽선이 아니다)
  ok(r.geometry.outline.every(s => s.part !== "top" && s.part !== "band-top"), "13: 밴드 윗선은 outline 에 없다(한 장이므로 잘리지 않음)");
  ok(r.geometry.construction.length > 0 && r.geometry.construction.every(s => s.part === "band-top")
    && Math.abs(r.measure.bandTopLenCm - st.upperNeckSegmentLenCm) < 1e-12, "13: 이음선 자리 = 밴드 윗선 구성선·길이 보고");
  // ③ 위 칼라: CB 수직 3.5 / 외곽 뒤 수평 = 뒤 목둘레 × / 앞 칼라 폭 = Ⓒ 에서 수직 6.5
  const A = r.anchors;
  ok(Math.abs(A.outerCb.x - A.bandTopCb.x) < 1e-12 && Math.abs((A.bandTopCb.y - A.outerCb.y) - R_UPPER.upperWidthCm) < 1e-12, "13: 위 칼라 CB 는 수직 3.5");
  ok(Math.abs(A.shoulder.y - A.outerCb.y) < 1e-12 && Math.abs((A.shoulder.x - A.outerCb.x) - BACK) < 1e-12
    && Math.abs(r.measure.outerBackLenCm - BACK) < 1e-6, "13: 외곽 뒤 구간은 수평이고 길이 = 뒤 목둘레 ×");
  ok(Math.abs(A.frontTop.x - A.bandTopCf.x) < 1e-12 && Math.abs((A.bandTopCf.y - A.frontTop.y) - R_UPPER.frontWidthCm) < 1e-12
    && Math.abs(r.measure.frontEdgeLenCm - R_UPPER.frontWidthCm) < 1e-9, "13: 앞 칼라 폭은 Ⓒ 에서 수직 6.5");
  // CB 전체 높이는 ⑭ 로 보정된 밴드 CB 점에서 재므로 보정 허용오차(1e-4)까지 일치한다.
  ok(Math.abs(r.measure.cbHeightCm - (R_STAND.bandWidthCm + R_UPPER.upperWidthCm)) < 1e-4, "13: CB 전체 = 밴드 3 + 위 칼라 3.5");
  // ④ 외곽 앞 구간: 현에서 0.5 처진 완만한 곡선(시작 접선 = 뒤 수평 구간과 나란함)
  const outer = r.geometry.outline.filter(s => s.part === "outer");
  ok(outer.length === 2 && outer.every(s => s.kind === "cubic"), "13: 외곽 앞 구간 = 접선 연속 cubic 2개");
  const outerDense = outer.reduce((t, s) => t + denseLen(s), 0);
  ok(Math.abs(outerDense - r.measure.outerFrontLenCm) < 1e-3 && outerDense > Math.hypot(A.frontTop.x - A.shoulder.x, A.frontTop.y - A.shoulder.y),
    "13: 외곽 앞 실측 = 보고값이고 현보다 길다");
  ok(Math.abs(r.measure.outerLenCm - (r.measure.outerBackLenCm + r.measure.outerFrontLenCm)) < 1e-9, "13: 칼라 외곽 전체 = 뒤 + 앞");
  // 현 중점에서 밴드 쪽 법선으로 0.5 처진 점을 실제로 지난다
  {
    const S = A.shoulder, F = A.frontTop;
    const vx = F.x - S.x, vy = F.y - S.y, vl = Math.hypot(vx, vy);
    let dn = { x: -vy / vl, y: vx / vl }; if (!(dn.y > 0)) dn = { x: vy / vl, y: -vx / vl };
    const M = { x: (S.x + F.x) / 2 + dn.x * R_UPPER.outerBowCm, y: (S.y + F.y) / 2 + dn.y * R_UPPER.outerBowCm };
    const join = outer[0].to;   // outline 은 앞 위 끝 → 어깨 방향이라 이음점이 첫 cubic 의 끝이다
    ok(Math.abs(join.x - M.x) < 1e-9 && Math.abs(join.y - M.y) < 1e-9, "13: 두 cubic 의 이음점 = 현에서 0.5 처진 통과점");
    ok(Math.abs(outer[1].to.x - S.x) < 1e-12 && Math.abs(outer[1].to.y - S.y) < 1e-12
      && Math.abs(outer[1].c2.y - outer[1].to.y) < 1e-12, "13: 어깨 쪽 끝 접선은 뒤 수평 구간과 나란함(구현 관례)");
  }
  // ★ 처짐 0 이어도 직선이 되지 않는다 — 어깨에서 수평 접선으로 출발하는 구현 관례 때문(M 의 안내선과 동일).
  //   처짐은 그 곡선을 더 처지게 하는 값이므로 길이는 단조 증가한다.
  {
    const chord = Math.hypot(A.frontTop.x - A.shoulder.x, A.frontTop.y - A.shoulder.y);
    const lenAt = (bow) => C.computeBandOnePiece(B, R_STAND, Object.assign({}, R_UPPER, { outerBowCm: bow })).measure.outerFrontLenCm;
    const l0 = lenAt(0), l5 = lenAt(0.5), l10 = lenAt(1);
    ok(l0 > chord && l5 > l0 && l10 > l5, "13: 처짐 0 도 접선 연속 곡선(현보다 김)·처짐 증가 시 단조 증가");
    const flatJoin = C.computeBandOnePiece(B, R_STAND, Object.assign({}, R_UPPER, { outerBowCm: 0 })).geometry.outline.filter(s => s.part === "outer")[0].to;
    ok(Math.abs(flatJoin.x - (A.shoulder.x + A.frontTop.x) / 2) < 1e-9 && Math.abs(flatJoin.y - (A.shoulder.y + A.frontTop.y) / 2) < 1e-9,
      "13: 처짐 0 → 통과점이 정확히 현의 중점");
  }
  // 실패 계약(원자적 — geometry 없음)
  ok(C.computeBandOnePiece(B, R_STAND, Object.assign({}, R_UPPER, { upperWidthCm: 0 })).reason === "invalid-upper-width"
    && C.computeBandOnePiece(B, R_STAND, Object.assign({}, R_UPPER, { frontWidthCm: -1 })).reason === "invalid-front-width"
    && C.computeBandOnePiece(B, R_STAND, Object.assign({}, R_UPPER, { outerBowCm: -0.1 })).reason === "invalid-outer-bow"
    && !("geometry" in C.computeBandOnePiece(B, R_STAND, Object.assign({}, R_UPPER, { upperWidthCm: 0 }))), "13: 위 칼라 값 범위 밖 거부(형상 없음)");
  ok(C.computeBandOnePiece(B, { bandWidthCm: 3, frontRiseCm: 99, frontEndCm: 0.5 }, R_UPPER).ok === false, "13: 밴드 실패는 그대로 전파");
  // 결정론·입력 불변
  const snapR = J(B), snapU = J(R_UPPER);
  ok(J(C.computeBandOnePiece(B, R_STAND, R_UPPER)) === J(r) && J(B) === snapR && J(R_UPPER) === snapU, "13: 결정론·입력 비변형");
  // M·N·P·Q 불변(같은 밴드 제도를 공유하지만 결과를 바꾸지 않는다)
  ["M", "N", "P"].forEach(k => ok(J(C.computeStand(B, BAND[k])) === J(C.computeStand(B, BAND[k], {})), "13: " + k + " 밴드 불변"));
  ok(C.computeStand(B, { bandWidthCm: 3, frontRiseCm: 1, frontEndCm: 0.5 }, { horizontalTopLine: true }).horizontalTopLine === true, "13: Q 수평 꺾임선 경로 불변");
}

// 14. 교재 S(P.69) 플랫 칼라 — 몸판 목둘레선에 직접 제도하고 어깨선에서 맞댄다.
//     몸판 형상은 입력일 뿐 바꾸지 않는다(의미 모서리 center/neckline/shoulder 만 읽는다).
{
  const cub = (a, b, c, d) => ({ kind: "cubic", from: { x: a[0], y: a[1] }, c1: { x: b[0], y: b[1] }, c2: { x: c[0], y: c[1] }, to: { x: d[0], y: d[1] } });
  const ln = (a, b, edge) => { const s = { kind: "line", from: { x: a[0], y: a[1] }, to: { x: b[0], y: b[1] } }; if (edge) s.edge = edge; return s; };
  const withEdge = (s, e) => Object.assign({}, s, { edge: e });
  // 뒤: CB(0,0)→(0,20) · 목둘레 (0,0)→SNP(8,-2) · 어깨 SNP→(18,2)
  const backNeck = withEdge(cub([0, 0], [3, 0], [6, -1], [8, -2]), "neckline");
  // 앞: CF(40,4)→(40,20) · 목둘레 FNP(40,4)→SNP(32,-4) · 어깨 SNP→(22,0)  ← 뒤와 좌우 대칭 제도
  const frontNeck = withEdge(cub([40, 4], [37, 2], [34, -2], [32, -4]), "neckline");
  const BACK_LEN = denseLen(backNeck), FRONT_LEN = denseLen(frontNeck);
  const bodyS = () => ({
    hash: "BS", necklineLengths: { back: BACK_LEN, front: FRONT_LEN, half: BACK_LEN + FRONT_LEN, finished: 2 * (BACK_LEN + FRONT_LEN) },
    back: { outline: [ln([0, 0], [0, 20], "center"), backNeck, ln([8, -2], [18, 2], "shoulder")], construction: [] },
    front: { outline: [ln([40, 4], [40, 20], "center"), frontNeck, ln([32, -4], [22, 0], "shoulder")], construction: [] }
  });
  const FS = { collarWidthCm: 5.5, frontEndFromFnpCm: 6, frontEndOffsetCm: 4 };

  ok(typeof C.computeFlatCollarS === "function" && J(C.FLAT_COLLAR_S_METHOD) === J({ page: 69, methodPage: 149, variant: "S",
    bodyLinked: true, attachFrom: "bodice-neckline", join: "shoulder-butt", shoulderOverlapCm: 0, cbRiseCm: 0,
    smoothing: "tangent-continuous-cubic", handleFraction: 1 / 3 }), "14: S API·제도법 메타(달림선 = 몸판 목둘레선 · 어깨 맞댐 · 겹침 0 · CB 올림 0)");

  const B = bodyS(), r = C.computeFlatCollarS(B, FS);
  ok(r.ok && C.validateClosedOutline(r.geometry.outline).ok, "14: S 폐곡선 한 조각(" + (r.reason || "") + ")");
  ok(J(r.geometry.outline.map(s => s.part)) === J(["neck-seam", "neck-seam", "front-edge", "outer", "outer", "cb-fold"]),
    "14: 구성 = 달림선(뒤·앞) + 앞 끝선 + 외곽 2 + 뒤 중심");
  // ① 달림선 = 몸판 목둘레선 그대로(길이 책임: 실측 = ×+⊘)
  ok(near(r.measure.backAttachLenCm, BACK_LEN, 1e-4) && near(r.measure.frontAttachLenCm, FRONT_LEN, 1e-4)
    && near(r.measure.attachLenCm, BACK_LEN + FRONT_LEN, 1e-4) && near(r.measure.attachLenCm, r.measure.neckTargetCm, 1e-4),
    "14: 달림선 실측 = 뒤 목둘레 + 앞 목둘레(재작도 없음)");
  ok(near(partLen(r.geometry, "neck-seam"), BACK_LEN + FRONT_LEN, 1e-3), "14: 달림선 독립 측정 재검산");
  // ② 칼라 폭: 뒤 중심·어깨 둘 다 5.5(맞댐 가능 조건)
  const A = r.anchors;
  ok(A.cbNeck.x === 0 && A.cbNeck.y === 0 && near(A.cbOuter.x, 0, 1e-9) && near(A.cbOuter.y, FS.collarWidthCm, 1e-9),
    "14: 프레임 — CB 목점 = 원점, 뒤 중심 폭선은 수직 5.5");
  ok(near(r.measure.cbWidthLenCm, FS.collarWidthCm, 1e-9) && near(r.measure.shoulderWidthLenCm, FS.collarWidthCm, 1e-9),
    "14: 뒤 중심 폭 = 어깨 폭 = 5.5 실측");
  ok(near(Math.hypot(A.shoulder.x - A.snp.x, A.shoulder.y - A.snp.y), FS.collarWidthCm, 1e-9), "14: 어깨 맞댐선 길이 = 칼라 폭");
  // ③ 칼라 끝: 앞 중심선에 평행한 안내선(4) 위, FNP 에서 6
  ok(near(r.measure.frontEndLenCm, FS.frontEndFromFnpCm, 1e-9) && near(r.measure.frontEndOffsetLenCm, FS.frontEndOffsetCm, 1e-9),
    "14: 앞 끝선 6 · 안내선 4 실측");
  ok(near(Math.hypot(A.tip.x - A.fnp.x, A.tip.y - A.fnp.y), FS.frontEndFromFnpCm, 1e-9), "14: 칼라 끝 anchor 도 FNP 에서 6");
  // ④ 외곽선: 뒤 중심 폭선에 직각으로 출발 → 어깨 폭 지점 경유 → 칼라 끝(접선 연속)
  const outer = r.geometry.outline.filter(s => s.part === "outer");
  ok(outer.length === 2 && outer.every(s => s.kind === "cubic"), "14: 외곽선 = 접선 연속 cubic 2개");
  // outline 은 칼라 끝 → 뒤 중심 방향이라 뒤 중심 쪽 끝이 outer[1].to 다.
  ok(near(outer[1].to.x, A.cbOuter.x, 1e-9) && near(outer[1].to.y, A.cbOuter.y, 1e-9)
    && near(outer[1].c2.y, outer[1].to.y, 1e-9), "14: 뒤 중심에서 폭선(CB)에 직각으로 출발");
  ok(near(outer[0].to.x, A.shoulder.x, 1e-9) && near(outer[0].to.y, A.shoulder.y, 1e-9), "14: 외곽선이 어깨 폭 지점을 지난다");
  {   // 이음점 접선 연속(들어오는 c2→to 방향 = 나가는 to→c1 방향)
    const t1 = { x: outer[0].to.x - outer[0].c2.x, y: outer[0].to.y - outer[0].c2.y };
    const t2 = { x: outer[1].c1.x - outer[1].from.x, y: outer[1].c1.y - outer[1].from.y };
    const cross = t1.x * t2.y - t1.y * t2.x;
    ok(Math.abs(cross) < 1e-9 && dot(t1, t2) > 0, "14: 어깨 폭 지점에서 접선 연속");
  }
  ok(near(r.measure.outerLenCm, partLen(r.geometry, "outer"), 1e-3) && r.measure.outerLenCm > r.measure.attachLenCm,
    "14: 외곽선 실측 보고 · 달림선보다 길다(플랫 칼라)");
  // ⑤ 어깨 맞댐: 앞·뒤가 어깨선을 사이에 두고 반대쪽(겹치지 않는다)
  {
    const butt = r.geometry.construction.filter(s => s.part === "shoulder-butt");
    ok(butt.length === 1 && butt[0].kind === "line", "14: 어깨 맞댐선이 구성선으로 남는다");
    const d = { x: A.shoulder.x - A.snp.x, y: A.shoulder.y - A.snp.y };
    const sideBack = d.x * (A.cbNeck.y - A.snp.y) - d.y * (A.cbNeck.x - A.snp.x);
    const sideFront = d.x * (A.fnp.y - A.snp.y) - d.y * (A.fnp.x - A.snp.x);
    ok(sideBack * sideFront < 0, "14: 맞댄 앞·뒤가 어깨선 반대쪽(겹침 없음)");
  }
  // ⑥ 실패 계약(원자적 — geometry 없음)
  ok(C.computeFlatCollarS(B, Object.assign({}, FS, { collarWidthCm: 0 })).reason === "invalid-collar-width"
    && C.computeFlatCollarS(B, Object.assign({}, FS, { frontEndFromFnpCm: 0 })).reason === "invalid-front-end"
    && C.computeFlatCollarS(B, Object.assign({}, FS, { frontEndOffsetCm: -1 })).reason === "invalid-front-end-offset"
    && C.computeFlatCollarS(B, Object.assign({}, FS, { frontEndOffsetCm: 6 })).reason === "front-end-unreachable"
    && !("geometry" in C.computeFlatCollarS(B, Object.assign({}, FS, { collarWidthCm: 0 }))), "14: 파라미터 범위 밖 거부(형상 없음)");
  {
    const noNeck = bodyS(); noNeck.back.outline = noNeck.back.outline.filter(s => s.edge !== "neckline");
    const noCenter = bodyS(); noCenter.front.outline = noCenter.front.outline.filter(s => s.edge !== "center");
    const noSh = bodyS(); noSh.back.outline = noSh.back.outline.filter(s => s.edge !== "shoulder");
    ok(C.computeFlatCollarS(noNeck, FS).reason === "no-body-neckline"
      && C.computeFlatCollarS(noCenter, FS).reason === "no-body-center"
      && C.computeFlatCollarS(noSh, FS).reason === "no-body-shoulder"
      && C.computeFlatCollarS({ hash: "x" }, FS).reason === "no-neckline", "14: 몸판 의미 모서리 누락 거부");
    const dup = bodyS();
    dup.back.outline.push(withEdge(cub([0, 0], [-3, 0], [-6, -1], [-8, -2]), "neckline"));   // 목점에 닿는 목둘레가 둘
    ok(C.computeFlatCollarS(dup, FS).reason === "ambiguous-neck-point", "14: 목점이 유일하지 않으면 거부");
  }
  {   // 앞판이 뒤판과 같은 방향으로 제도돼 있으면 맞댔을 때 겹친다 → 임의로 뒤집지 않고 실패
    const same = bodyS();
    same.front = { outline: [ln([-40, 4], [-40, 20], "center"),
      withEdge(cub([-40, 4], [-37, 2], [-34, -2], [-32, -4]), "neckline"),
      ln([-32, -4], [-22, 0], "shoulder")], construction: [] };
    ok(C.computeFlatCollarS(same, FS).reason === "shoulder-butt-overlap", "14: 맞댐이 겹치면 실패(반사 금지)");
  }
  // ⑦ 결정론·입력 비변형
  {
    const snap = J(B), snapP = J(FS);
    ok(J(C.computeFlatCollarS(B, FS)) === J(r) && J(B) === snap && J(FS) === snapP, "14: 결정론·입력 비변형");
  }
  // ⑧ 다른 family 경로 불변(같은 모듈이지만 서로 건드리지 않는다)
  {
    const b2 = bodice(8.6087, 12.3874, 1.75);
    ok(C.computeStand(b2, BAND.M).ok && C.computeBandOnePiece(b2, BAND.M, { upperWidthCm: 3.5, frontWidthCm: 6.5, outerBowCm: 0.5 }).ok,
      "14: 밴드(M)·밴드+위 칼라(R) 경로 정상 유지");
  }
}

// 15. 교재 T(P.69 하단) 플랫 칼라 — 어깨선 3.5 겹침 + 뒤 중심 0.5 올린 달림선 재작도.
//     S(맞댐)와 같은 몸판 입력을 쓰되 결과는 서로 완전히 분리된다.
{
  const cub = (a, b, c, d) => ({ kind: "cubic", from: { x: a[0], y: a[1] }, c1: { x: b[0], y: b[1] }, c2: { x: c[0], y: c[1] }, to: { x: d[0], y: d[1] } });
  const ln = (a, b, edge) => { const s = { kind: "line", from: { x: a[0], y: a[1] }, to: { x: b[0], y: b[1] } }; if (edge) s.edge = edge; return s; };
  const we = (s, e) => Object.assign({}, s, { edge: e });
  const backNeck = we(cub([0, 0], [3, 0], [6, -1], [8, -2]), "neckline");
  const frontNeck = we(cub([40, 4], [37, 2], [34, -2], [32, -4]), "neckline");
  const BACK_LEN = denseLen(backNeck), FRONT_LEN = denseLen(frontNeck);
  const bodyT = () => ({
    hash: "BT", necklineLengths: { back: BACK_LEN, front: FRONT_LEN, half: BACK_LEN + FRONT_LEN, finished: 2 * (BACK_LEN + FRONT_LEN) },
    back: { outline: [ln([0, 0], [0, 20], "center"), backNeck, ln([8, -2], [18, 2], "shoulder")], construction: [] },
    front: { outline: [ln([40, 4], [40, 20], "center"), frontNeck, ln([32, -4], [22, 0], "shoulder")], construction: [] }
  });
  const TP = { collarWidthCm: 5.5, cbRiseCm: 0.5, shoulderOverlapCm: 3.5, frontEndFromFnpCm: 6, frontEndOffsetCm: 4 };
  const SP2 = { collarWidthCm: 5.5, frontEndFromFnpCm: 6, frontEndOffsetCm: 4 };

  ok(typeof C.computeFlatCollarT === "function" && J(C.FLAT_COLLAR_T_METHOD) === J({ page: 69, methodPage: 149, variant: "T",
    bodyLinked: true, attachFrom: "redrawn-neckline", join: "shoulder-overlap", attachOffsetTaper: "cb-to-front-linear",
    smoothing: "tangent-continuous-cubic", handleFraction: 1 / 3 }), "15: T API·제도법 메타(재작도 달림선·어깨 겹침)");

  const B = bodyT(), r = C.computeFlatCollarT(B, TP);
  ok(r.ok && C.validateClosedOutline(r.geometry.outline).ok, "15: T 폐곡선 한 조각(" + (r.reason || "") + ")");
  ok(J(r.geometry.outline.map(s => s.part)) === J(["neck-seam", "neck-seam", "front-edge", "outer", "outer", "cb-fold"]),
    "15: 구성 = 달림선 2 + 앞 끝선 + 외곽 2 + 뒤 중심");
  const A = r.anchors;
  // ① 겹침: 두 어깨 끝점 사이 거리 = 3.5 (SNP 는 맞춰져 있다)
  ok(near(r.measure.shoulderTipGapCm, TP.shoulderOverlapCm, 1e-6), "15: 어깨 끝점 간격 실측 = 겹침 3.5");
  ok(r.measure.overlapAngleDeg > 0 && r.measure.overlapAngleDeg < 90, "15: 겹침 회전각 보고");
  // ② 뒤 중심: 몸판 목점 → 0.5 올린 달림선 시작 → 칼라 폭 5.5 (전부 CB 선 위, 수직)
  ok(near(A.cbNeck.x, 0, 1e-9) && near(A.cbNeck.y, 0, 1e-9) && near(A.cbAttach.x, 0, 1e-9)
    && near(A.cbAttach.y, -TP.cbRiseCm, 1e-9) && near(A.cbOuter.x, 0, 1e-9)
    && near(A.cbOuter.y, TP.collarWidthCm - TP.cbRiseCm, 1e-9), "15: 목점(0,0) → 0.5 올림 → 폭 5.5 가 모두 CB 선 위");
  ok(near(r.measure.cbWidthLenCm, TP.collarWidthCm, 1e-9) && near(r.measure.shoulderWidthLenCm, TP.collarWidthCm, 1e-9),
    "15: 뒤 중심·어깨 칼라 폭 5.5 실측");
  // ③ 달림선: 시작점에서 CB 에 직각 · 몸판 목둘레보다 짧다(교재: 약 0.5)
  const attach = r.geometry.outline.filter(s => s.part === "neck-seam");
  ok(near(attach[0].from.x, A.cbAttach.x, 1e-9) && near(attach[0].from.y, A.cbAttach.y, 1e-9)
    && near(attach[0].c1.y, attach[0].from.y, 1e-9), "15: 달림선은 0.5 올린 점에서 CB 에 직각으로 출발");
  ok(near(attach[attach.length - 1].to.x, A.fnp.x, 1e-9) && near(attach[attach.length - 1].to.y, A.fnp.y, 1e-9),
    "15: 달림선은 FNP 에서 끝난다(앞 중심에서 몸판 목둘레선과 만난다)");
  ok(r.measure.attachLenCm < r.measure.neckTargetCm && near(r.measure.attachShortfallCm, r.measure.neckTargetCm - r.measure.attachLenCm, 1e-9),
    "15: 달림선 < 몸판 목둘레(부족분 보고)");
  ok(r.measure.attachShortfallCm > 0.15 && r.measure.attachShortfallCm < 1.2, "15: 부족분이 교재 '약 0.5cm' 범위(" + r.measure.attachShortfallCm.toFixed(3) + ")");
  ok(near(partLen(r.geometry, "neck-seam"), r.measure.attachLenCm, 1e-3), "15: 달림선 독립 측정 재검산");
  // ④ 칼라 끝 6·4 (S 와 같은 ①② 절차)
  ok(near(r.measure.frontEndLenCm, TP.frontEndFromFnpCm, 1e-9) && near(r.measure.frontEndOffsetLenCm, TP.frontEndOffsetCm, 1e-9),
    "15: 앞 끝선 6 · 안내선 4 실측");
  // ⑤ 외곽선: 뒤 중심 폭선에 직각 출발 · 어깨 폭 지점 통과 · 접선 연속
  const outer = r.geometry.outline.filter(s => s.part === "outer");
  ok(outer.length === 2 && near(outer[1].to.x, A.cbOuter.x, 1e-9) && near(outer[1].to.y, A.cbOuter.y, 1e-9)
    && near(outer[1].c2.y, outer[1].to.y, 1e-9), "15: 외곽선이 뒤 중심에서 CB 에 직각");
  ok(near(outer[0].to.x, A.shoulder.x, 1e-9) && near(outer[0].to.y, A.shoulder.y, 1e-9), "15: 외곽선이 어깨 폭 지점을 지난다");
  ok(r.geometry.construction.length === 1 && r.geometry.construction[0].part === "shoulder-mark", "15: 어깨선 표시가 구성선으로 남는다");
  // ⑥ 겹침 0 이면 S 의 맞댐과 같은 배치가 된다(달림선은 여전히 재작도)
  {
    const noOv = C.computeFlatCollarT(B, Object.assign({}, TP, { shoulderOverlapCm: 0, cbRiseCm: 0 }));
    const s2 = C.computeFlatCollarS(B, SP2);
    ok(noOv.ok && near(noOv.measure.shoulderTipGapCm, 0, 1e-6), "15: 겹침 0 → 어깨 끝점이 맞닿는다");
    ok(noOv.ok && s2.ok && near(noOv.anchors.fnp.x, s2.anchors.fnp.x, 1e-6) && near(noOv.anchors.fnp.y, s2.anchors.fnp.y, 1e-6),
      "15: 겹침 0·올림 0 이면 앞 조각 배치가 S 의 맞댐과 같다");
    ok(noOv.ok && near(noOv.measure.attachLenCm, noOv.measure.neckTargetCm, 1e-3),
      "15: 겹침 0·올림 0 이면 달림선 = 몸판 목둘레(재작도 offset 이 0)");
  }
  // ⑦ 실패 계약(원자적)
  ok(C.computeFlatCollarT(B, Object.assign({}, TP, { collarWidthCm: 0 })).reason === "invalid-collar-width"
    && C.computeFlatCollarT(B, Object.assign({}, TP, { cbRiseCm: -1 })).reason === "invalid-cb-rise"
    && C.computeFlatCollarT(B, Object.assign({}, TP, { shoulderOverlapCm: -1 })).reason === "invalid-shoulder-overlap"
    && C.computeFlatCollarT(B, Object.assign({}, TP, { shoulderOverlapCm: 99 })).reason === "shoulder-overlap-unreachable"
    && C.computeFlatCollarT(B, Object.assign({}, TP, { frontEndOffsetCm: 6 })).reason === "front-end-unreachable"
    && !("geometry" in C.computeFlatCollarT(B, Object.assign({}, TP, { collarWidthCm: 0 }))), "15: 파라미터 범위 밖 거부(형상 없음)");
  {
    const noSh = bodyT(); noSh.back.outline = noSh.back.outline.filter(s => s.edge !== "shoulder");
    ok(C.computeFlatCollarT(noSh, TP).reason === "no-body-shoulder" && C.computeFlatCollarT({ hash: "x" }, TP).reason === "no-neckline",
      "15: 몸판 의미 모서리 누락 거부");
  }
  // ⑧ 결정론·입력 비변형 · S 경로 불변
  {
    const snap = J(B), snapP = J(TP);
    ok(J(C.computeFlatCollarT(B, TP)) === J(r) && J(B) === snap && J(TP) === snapP, "15: 결정론·입력 비변형");
    const sNow = C.computeFlatCollarS(bodyT(), SP2);
    ok(sNow.ok && near(sNow.measure.attachLenCm, BACK_LEN + FRONT_LEN, 1e-4) && near(sNow.measure.cbWidthLenCm, 5.5, 1e-9),
      "15: 같은 몸판에서 S 결과는 그대로(달림선 = 몸판 목둘레)");
  }
}

// 16. 교재 U(P.70 · 제도 방법 P.150) 세일러 칼라 — V 목둘레 내부 파생 + 어깨 겹침 + 네모난 뒤판
{
  const cub = (a, b, c, d) => ({ kind: "cubic", from: { x: a[0], y: a[1] }, c1: { x: b[0], y: b[1] }, c2: { x: c[0], y: c[1] }, to: { x: d[0], y: d[1] } });
  const ln = (a, b, edge) => { const s = { kind: "line", from: { x: a[0], y: a[1] }, to: { x: b[0], y: b[1] } }; if (edge) s.edge = edge; return s; };
  const we = (s, e) => Object.assign({}, s, { edge: e });
  const backNeck = we(cub([0, 0], [3, 0], [6, -1], [8, -2]), "neckline");
  const frontNeck = we(cub([40, 4], [37, 2], [34, -2], [32, -4]), "neckline");
  const BACK_LEN = denseLen(backNeck), FRONT_LEN = denseLen(frontNeck);
  const bodyU = () => ({
    hash: "BU", necklineLengths: { back: BACK_LEN, front: FRONT_LEN, half: BACK_LEN + FRONT_LEN, finished: 2 * (BACK_LEN + FRONT_LEN) },
    back: { outline: [ln([0, 0], [0, 40], "center"), backNeck, ln([8, -2], [18, 2], "shoulder")], construction: [] },
    front: { outline: [ln([40, 4], [40, 40], "center"), frontNeck, ln([32, -4], [22, 0], "shoulder")], construction: [] }
  });
  const UP = { vDropCm: 12, vHollowCm: 0.8, shoulderOverlapCm: 1.5, cbRiseCm: 0.5,
    cbWidthCm: 11, backOuterCm: 15.5, shoulderWidthCm: 10, frontOuterBowCm: 1.5 };

  ok(typeof C.computeSailorCollarU === "function" && J(C.SAILOR_COLLAR_U_METHOD) === J({ page: 70, methodPage: 150, variant: "U",
    bodyLinked: true, vNeck: "derived-internal", join: "shoulder-overlap", attachOffsetTaper: "cb-to-front-linear",
    backOuterSquare: true, smoothing: "tangent-continuous-cubic", handleFraction: 1 / 3 }), "16: U API·제도법 메타(V 내부 파생·어깨 겹침·네모 뒤판)");

  const B = bodyU(), r = C.computeSailorCollarU(B, UP);
  ok(r.ok && C.validateClosedOutline(r.geometry.outline).ok, "16: U 폐곡선 한 조각(" + (r.reason || "") + ")");
  ok(J(r.geometry.outline.map(s => s.part)) === J(["neck-seam", "neck-seam", "neck-seam", "outer", "outer", "outer-back", "outer-cb", "cb-fold"]),
    "16: 구성 = 달림선 3 + 앞 외곽 2 + 뒤 외곽선 + 뒤 중심 직각변 + 뒤 중심");
  const A = r.anchors;
  // ① V 목둘레는 칼라 안에서만 파생한다 — 몸판 입력은 그대로
  {
    const snap = J(B);
    C.computeSailorCollarU(B, UP);
    ok(J(B) === snap, "16: 몸판 geometry 입력 비변형(V 는 칼라 내부 파생)");
    // FNP_V = 앞 목점에서 앞 중심선(=+y)으로 12 내린 점 → 프레임 밖 원좌표로 검산
    const drop = Math.hypot(0, UP.vDropCm);
    ok(near(r.measure.vDropCm, 12, 1e-9) && r.measure.vNeckLenCm > drop, "16: V 목선은 12 내림보다 길다(SNP→깊은 점)");
    ok(near(r.measure.neckTargetCm, r.measure.backNeckLenCm + r.measure.vNeckLenCm, 1e-9),
      "16: 칼라가 붙는 목둘레 = 뒤목 + 파생 V선(원래 앞목 아님)");
    ok(!near(r.measure.neckTargetCm, B.necklineLengths.half, 1e-3), "16: 원래 몸판 목둘레(라운드)와 다르다");
  }
  // ② 겹침: 짧은 쪽 어깨 길이에서 1.5 겹치는 각
  {
    const Lmin = Math.min(r.measure.backShoulderLenCm, r.measure.frontShoulderLenCm);
    const want = 2 * Math.asin(UP.shoulderOverlapCm / (2 * Lmin)) * 180 / Math.PI;
    ok(near(r.measure.overlapAngleDeg, want, 1e-6) && r.measure.overlapAngleDeg > 0, "16: 겹침 각 = 2·asin(1.5/2L) (짧은 어깨 기준)");
    ok(C.computeSailorCollarU(B, Object.assign({}, UP, { shoulderOverlapCm: 999 })).reason === "shoulder-overlap-unreachable",
      "16: 어깨 길이로 만들 수 없는 겹침은 거부");
  }
  // ③ 뒤 중심: 목점 → 0.5 올림 → 폭 11 이 모두 CB 선 위(수직), 외곽 15.5 는 CB 에 직각
  ok(near(A.cbNeck.x, 0, 1e-9) && near(A.cbNeck.y, 0, 1e-9) && near(A.cbAttach.x, 0, 1e-9)
    && near(A.cbAttach.y, -UP.cbRiseCm, 1e-9) && near(A.cbOuter.x, 0, 1e-9)
    && near(A.cbOuter.y, UP.cbWidthCm - UP.cbRiseCm, 1e-9), "16: 0.5 올림 → 뒤 중심 폭 11 이 CB 선 위");
  ok(near(r.measure.cbWidthLenCm, UP.cbWidthCm, 1e-9) && near(r.measure.backOuterLenCm, UP.backOuterCm, 1e-9)
    && near(r.measure.backCornerAngleDeg, 90, 1e-6), "16: 뒤 중심 11 · 외곽 15.5 · 사잇각 90°");
  ok(near(A.backOuter.y, A.cbOuter.y, 1e-9) && Math.abs(A.backOuter.x - A.cbOuter.x) > 1, "16: 외곽 15.5 는 CB 에 직각(프레임 x축)");
  // ④ 어깨 칼라 폭 10 · 뒤 외곽선은 직선 · 어깨선 표시
  ok(near(r.measure.shoulderWidthLenCm, UP.shoulderWidthCm, 1e-9), "16: 어깨 칼라 폭 10 실측");
  {
    const back = r.geometry.outline.filter(s => s.part === "outer-back");
    ok(back.length === 1 && back[0].kind === "line"
      && near(back[0].from.x, A.shoulder.x, 1e-9) && near(back[0].to.x, A.backOuter.x, 1e-9), "16: 뒤 칼라 외곽선은 어깨↔외곽 모서리 직선");
    ok(r.geometry.construction.length === 1 && r.geometry.construction[0].part === "shoulder-mark", "16: 어깨선 표시가 구성선");
  }
  // ⑤ 달림선: 0.5 올린 점에서 CB 직각 출발 · FNP(V 깊은 점)에서 끝 · 목둘레보다 짧다
  {
    const attach = r.geometry.outline.filter(s => s.part === "neck-seam");
    ok(near(attach[0].from.x, A.cbAttach.x, 1e-9) && near(attach[0].from.y, A.cbAttach.y, 1e-9)
      && near(attach[0].c1.y, attach[0].from.y, 1e-9), "16: 달림선은 0.5 올린 점에서 CB 에 직각 출발");
    ok(near(attach[attach.length - 1].to.x, A.fnpV.x, 1e-9) && near(attach[attach.length - 1].to.y, A.fnpV.y, 1e-9),
      "16: 달림선은 V 깊은 점(FNP)에서 끝난다");
    ok(r.measure.attachLenCm < r.measure.neckTargetCm && r.measure.attachShortfallCm > 0, "16: 달림선 < 목둘레(늘려 박는 분)");
    ok(near(partLen(r.geometry, "neck-seam"), r.measure.attachLenCm, 1e-3), "16: 달림선 독립 측정 재검산");
  }
  // ⑥ 앞 외곽선: 어깨 폭 지점 ↔ FNP 를 잇는 완만한 곡선(현보다 길다), 휨 0 이면 현과 같아진다
  {
    const fo = r.geometry.outline.filter(s => s.part === "outer");
    const chord = Math.hypot(A.fnpV.x - A.shoulder.x, A.fnpV.y - A.shoulder.y);
    ok(fo.length === 2 && fo.every(s => s.kind === "cubic") && r.measure.frontOuterLenCm > chord, "16: 앞 외곽선 = cubic 2개·현보다 길다");
    const flat0 = C.computeSailorCollarU(B, Object.assign({}, UP, { frontOuterBowCm: 0 }));
    ok(flat0.ok && near(flat0.measure.frontOuterLenCm, Math.hypot(flat0.anchors.fnpV.x - flat0.anchors.shoulder.x, flat0.anchors.fnpV.y - flat0.anchors.shoulder.y), 1e-6),
      "16: 휨 0 → 앞 외곽선 = 현 길이");
  }
  // ⑦ 실패 계약(원자적)
  ok(C.computeSailorCollarU(B, Object.assign({}, UP, { vDropCm: 0 })).reason === "invalid-v-drop"
    && C.computeSailorCollarU(B, Object.assign({}, UP, { vHollowCm: -1 })).reason === "invalid-v-hollow"
    && C.computeSailorCollarU(B, Object.assign({}, UP, { cbWidthCm: 0 })).reason === "invalid-collar-width"
    && C.computeSailorCollarU(B, Object.assign({}, UP, { backOuterCm: 0 })).reason === "invalid-back-outer"
    && C.computeSailorCollarU(B, Object.assign({}, UP, { shoulderWidthCm: 0 })).reason === "invalid-shoulder-width"
    && C.computeSailorCollarU(B, Object.assign({}, UP, { frontOuterBowCm: -1 })).reason === "invalid-front-bow"
    && !("geometry" in C.computeSailorCollarU(B, Object.assign({}, UP, { vDropCm: 0 }))), "16: 파라미터 범위 밖 거부(형상 없음)");
  {
    const noSh = bodyU(); noSh.front.outline = noSh.front.outline.filter(s => s.edge !== "shoulder");
    ok(C.computeSailorCollarU(noSh, UP).reason === "no-body-shoulder" && C.computeSailorCollarU({ hash: "x" }, UP).reason === "no-neckline",
      "16: 몸판 의미 모서리 누락 거부");
  }
  // ⑧ 결정론 · S/T 경로 불변
  {
    const snapP = J(UP);
    ok(J(C.computeSailorCollarU(B, UP)) === J(r) && J(UP) === snapP, "16: 결정론·파라미터 비변형");
    const s2 = C.computeFlatCollarS(bodyU(), { collarWidthCm: 5.5, frontEndFromFnpCm: 6, frontEndOffsetCm: 4 });
    const t2 = C.computeFlatCollarT(bodyU(), { collarWidthCm: 5.5, cbRiseCm: 0.5, shoulderOverlapCm: 3.5, frontEndFromFnpCm: 6, frontEndOffsetCm: 4 });
    ok(s2.ok && near(s2.measure.attachLenCm, BACK_LEN + FRONT_LEN, 1e-4) && t2.ok && t2.measure.attachShortfallCm > 0,
      "16: 같은 몸판에서 S·T 경로 정상 유지");
  }
}

// 16-VW. 교재 V·W(P.70) — U 와 **같은 생성기·같은 기준점**, 수치만 다르다(V: 폭 축소 / W: V넥 심화)
{
  const cub = (a, b, c, d) => ({ kind: "cubic", from: { x: a[0], y: a[1] }, c1: { x: b[0], y: b[1] }, c2: { x: c[0], y: c[1] }, to: { x: d[0], y: d[1] } });
  const ln = (a, b, edge) => { const s = { kind: "line", from: { x: a[0], y: a[1] }, to: { x: b[0], y: b[1] } }; if (edge) s.edge = edge; return s; };
  const we = (s, e) => Object.assign({}, s, { edge: e });
  const backNeck = we(cub([0, 0], [3, 0], [6, -1], [8, -2]), "neckline");
  const frontNeck = we(cub([40, 4], [37, 2], [34, -2], [32, -4]), "neckline");
  const BACK_LEN = denseLen(backNeck), FRONT_LEN = denseLen(frontNeck);
  const body = () => ({
    hash: "BVW", necklineLengths: { back: BACK_LEN, front: FRONT_LEN, half: BACK_LEN + FRONT_LEN, finished: 2 * (BACK_LEN + FRONT_LEN) },
    back: { outline: [ln([0, 0], [0, 40], "center"), backNeck, ln([8, -2], [18, 2], "shoulder")], construction: [] },
    front: { outline: [ln([40, 4], [40, 40], "center"), frontNeck, ln([32, -4], [22, 0], "shoulder")], construction: [] }
  });
  const UP = { vDropCm: 12, vHollowCm: 0.8, shoulderOverlapCm: 1.5, cbRiseCm: 0.5,
    cbWidthCm: 11, backOuterCm: 15.5, shoulderWidthCm: 10, frontOuterBowCm: 1.5 };
  const VP = { vDropCm: 12, vHollowCm: 0.8, shoulderOverlapCm: 1.5, cbRiseCm: 0.5,
    cbWidthCm: 9, backOuterCm: 13.5, shoulderWidthCm: 7, frontOuterBowCm: 1 };
  const WP = { vDropCm: 22, vHollowCm: 0.3, shoulderOverlapCm: 1.5, cbRiseCm: 0.5,
    cbWidthCm: 11, backOuterCm: 15.5, shoulderWidthCm: 10, frontOuterBowCm: 0.7 };
  const B = body(), u = C.computeSailorCollarU(B, UP), v = C.computeSailorCollarU(B, VP), w = C.computeSailorCollarU(B, WP);

  ok(v.ok && w.ok && C.validateClosedOutline(v.geometry.outline).ok && C.validateClosedOutline(w.geometry.outline).ok,
    "16-VW: V·W 폐곡선 한 조각(" + [v.reason, w.reason].filter(Boolean).join() + ")");
  ok(J(v.geometry.outline.map(s => s.part)) === J(u.geometry.outline.map(s => s.part))
    && J(w.geometry.outline.map(s => s.part)) === J(u.geometry.outline.map(s => s.part)),
    "16-VW: 구성·primitive 순서는 U 와 동일(같은 제도 절차)");
  ok(v.geometry.construction.length === 1 && v.geometry.construction[0].part === "shoulder-mark"
    && w.geometry.construction[0].part === "shoulder-mark", "16-VW: 어깨선 표시 유지");

  // ① 각 치수의 시작점·끝점·방향이 U 와 같다 — 값만 바뀐다(뒤 중심 수직 · 외곽 직각 · 어깨 폭)
  [[v, VP, "V"], [w, WP, "W"]].forEach(([r, P, tag]) => {
    const A = r.anchors;
    ok(near(A.cbNeck.x, 0, 1e-9) && near(A.cbAttach.x, 0, 1e-9) && near(A.cbAttach.y, -P.cbRiseCm, 1e-9)
      && near(A.cbOuter.x, 0, 1e-9) && near(A.cbOuter.y, P.cbWidthCm - P.cbRiseCm, 1e-9), "16-VW: " + tag + " 뒤 중심 올림→폭이 CB 선 위");
    ok(near(r.measure.cbWidthLenCm, P.cbWidthCm, 1e-9) && near(r.measure.backOuterLenCm, P.backOuterCm, 1e-9)
      && near(r.measure.backCornerAngleDeg, 90, 1e-6) && near(A.backOuter.y, A.cbOuter.y, 1e-9),
      "16-VW: " + tag + " 뒤 외곽은 CB 에 직각·실측 = 입력");
    ok(near(r.measure.shoulderWidthLenCm, P.shoulderWidthCm, 1e-9), "16-VW: " + tag + " 어깨 칼라 폭 실측 = 입력");
    const attach = r.geometry.outline.filter(s => s.part === "neck-seam");
    ok(near(attach[0].from.y, A.cbAttach.y, 1e-9) && near(attach[0].c1.y, attach[0].from.y, 1e-9)
      && near(attach[attach.length - 1].to.x, A.fnpV.x, 1e-9) && near(attach[attach.length - 1].to.y, A.fnpV.y, 1e-9),
      "16-VW: " + tag + " 달림선은 올린 점에서 CB 직각 출발 → V 깊은 점에서 끝");
    ok(r.measure.attachLenCm < r.measure.neckTargetCm && r.measure.attachShortfallCm > 0, "16-VW: " + tag + " 달림선 < 목둘레(늘려 박는 분)");
    ok(near(r.measure.overlapAngleDeg, u.measure.overlapAngleDeg, 1e-9) && near(r.measure.shoulderTipGapCm, u.measure.shoulderTipGapCm, 1e-9),
      "16-VW: " + tag + " 겹침 1.5 는 U 와 동일");
  });

  // ② V: 목둘레·겹침은 U 와 같고 폭만 좁다 → 달림선은 U 와 완전히 같은 선
  ok(near(v.measure.vNeckLenCm, u.measure.vNeckLenCm, 1e-12) && near(v.measure.neckTargetCm, u.measure.neckTargetCm, 1e-12)
    && J(v.geometry.outline.filter(s => s.part === "neck-seam")) === J(u.geometry.outline.filter(s => s.part === "neck-seam")),
    "16-VW: V 달림선·V 목선은 U 와 동일(칼라 허리와 목둘레는 U와 같다)");
  ok(v.measure.outerLenCm < u.measure.outerLenCm && v.measure.backOuterEdgeLenCm < u.measure.backOuterEdgeLenCm,
    "16-VW: V 는 폭이 좁아 외곽·뒤 외곽선이 짧다");

  // ③ W: 폭 계열은 U 와 같고 목둘레만 깊다 → 뒤 칼라(CB·외곽·어깨)는 U 와 같은 자리, 앞만 길어진다
  ok(near(w.measure.cbWidthLenCm, u.measure.cbWidthLenCm, 1e-12) && near(w.measure.backOuterLenCm, u.measure.backOuterLenCm, 1e-12)
    && near(w.anchors.cbOuter.y, u.anchors.cbOuter.y, 1e-12) && near(w.anchors.shoulder.x, u.anchors.shoulder.x, 1e-9)
    && near(w.anchors.shoulder.y, u.anchors.shoulder.y, 1e-9), "16-VW: W 뒤 칼라 기준점은 U 와 같다");
  ok(w.measure.vNeckLenCm > u.measure.vNeckLenCm && w.measure.neckTargetCm > u.measure.neckTargetCm
    && w.measure.attachLenCm > u.measure.attachLenCm, "16-VW: W 는 V넥 22 로 목선·달림선이 길다");
  ok(near(w.measure.vDropCm, 22, 1e-12) && near(w.measure.vHollowCm, 0.3, 1e-12)
    && Math.hypot(w.anchors.fnpV.x - w.anchors.snp.x, w.anchors.fnpV.y - w.anchors.snp.y)
      > Math.hypot(u.anchors.fnpV.x - u.anchors.snp.x, u.anchors.fnpV.y - u.anchors.snp.y), "16-VW: W FNP 가 더 깊다(SNP 에서 먼 점)");
  // 앞 외곽 휨은 U(1.5) > V(1) > W(0.7) — 현 대비 여분으로 비교(현 길이가 서로 다르므로 절대 길이로 비교하지 않는다)
  {
    const slack = (r) => r.measure.frontOuterLenCm - Math.hypot(r.anchors.fnpV.x - r.anchors.shoulder.x, r.anchors.fnpV.y - r.anchors.shoulder.y);
    ok(slack(u) > slack(v) && slack(v) > slack(w) && slack(w) > 0, "16-VW: 앞 외곽 휨 U 1.5 > V 1 > W 0.7(현 대비 여분)");
  }

  // ④ 결정론·입력 비변형·U 경로 불변
  {
    const snapB = J(B), snapV = J(VP), snapW = J(WP);
    ok(J(C.computeSailorCollarU(B, VP)) === J(v) && J(C.computeSailorCollarU(B, WP)) === J(w)
      && J(B) === snapB && J(VP) === snapV && J(WP) === snapW, "16-VW: 결정론·몸판/파라미터 비변형");
    ok(J(C.computeSailorCollarU(body(), UP)) === J(u), "16-VW: U 결과 불변(같은 몸판·같은 수치)");
  }
  // ⑤ 실패 계약은 값과 무관하게 같다
  ok(C.computeSailorCollarU(B, Object.assign({}, WP, { cbWidthCm: 0 })).reason === "invalid-collar-width"
    && C.computeSailorCollarU(B, Object.assign({}, VP, { vDropCm: -1 })).reason === "invalid-v-drop"
    && !("geometry" in C.computeSailorCollarU(B, Object.assign({}, VP, { vDropCm: -1 }))), "16-VW: 범위 밖 거부(형상 없음)");
}

console.log(`designCollarCheck: ${PASS} PASS, ${FAIL} FAIL`);
if (FAIL) { console.log("FAILURES:\n  " + fails.join("\n  ")); process.exit(1); }
