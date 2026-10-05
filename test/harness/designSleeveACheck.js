// ══════════════════════════════════════════════
// designSleeveACheck.js — js/designSleeveA.js(소매 Ⓐ 엔진 코어, [패턴학교] P.137–139 타입 4) 전용 회귀.
//
//   (1) 진동 읽기: 실제 bodiceCheckpoint.complete 가 만든 bodiceResult 에서 어깨점·아랫점·AH 를 읽는다.
//       진동선은 앞·뒤 모두 다트를 닫은 봉제 상태(김님 확정): 앞 AH 다트 닫음 → 앞 어깨 높이 16.38(이미 닫힌 Ⓘ 와 독립 일치),
//       뒤 어깨 다트 닫음(CB 고정·진동 쪽 회전) → 뒤 어깨 높이 17.74(이미 닫힌 Ⓖ 의 뒤 진동과 독립 일치). 지원 밖 몸판은 사유와 함께 거절.
//   (2) 제도: 소매산 높이 = ((뒤+앞)/2)×4/5 · 뒤AH+0.4 / 앞AH−0.6 · 앞AH/4 위치 직각 1.8 볼록 · SP 수평 1cm.
//   (3) 이세: 목표 = 5%(3:2) · 책 P.138/P.139 산술 케이스 · ⑧ 아랫점 수평 이동(Δ 부호·높이 불변·연장/절단).
//   (4) 불변·안전: bodiceResult/hash 불변(동결 객체) · 폐곡선·연결·자기교차 없음 · 기존 designSleeve/sleeveMeasure 와 호환.
//   ★ 책에서 미확정인 반올림·잔차·1cm 경고는 합격 게이트가 아니다 — 관찰값만 확인한다(책 표시값과의 반올림 일치는 참고 검산).
//   node test/harness/designSleeveACheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");

let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
const J = JSON.stringify;
const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

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
  "designLayout.js", "designRenderer.js", "bodiceCheckpoint.js", "peplumAnnotation.js", "designSleeve.js", "sleeveMeasure.js", "designSleeveA.js"].forEach(load);
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, BC = W.bodiceCheckpoint, SA = W.designSleeveA, DS = W.designSleeve, SM = W.sleeveMeasure;
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));

const MK = (body) => ({ sourceBlock: { version: 2, schemaVersion: 8 }, referenceGeometry: REF,
  working: { geometry: DB.computeGeometry(REF, { body }), parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body },
    patternLines: [], designOutline: null, frontPlacket: null } });
const presetOf = (sym) => { for (const f of BP.families()) for (const v of f.variants) if (v.symbol === sym) return v.presetId; return null; };
function bodiceResultOf(sym) { PROJECT = MK(BP.bodyParams(presetOf(sym))); const r = BC.complete(PROJECT); return r.ok ? r.result : null; }
function deepFreeze(o) { if (o && typeof o === "object") { Object.keys(o).forEach(k => deepFreeze(o[k])); Object.freeze(o); } return o; }

// 독립 측정(모듈과 다른 조밀 샘플)
const cubicPt = (q, t) => { const u = 1 - t; return { x: u*u*u*q[0].x + 3*u*u*t*q[1].x + 3*u*t*t*q[2].x + t*t*t*q[3].x, y: u*u*u*q[0].y + 3*u*u*t*q[1].y + 3*u*t*t*q[2].y + t*t*t*q[3].y }; };
function capCubics(geom) {   // 소매산 path → [[p0,c1,c2,p3],…]
  const cap = geom.outline[0], out = []; let cur = cap.commands[0].points[0];
  cap.commands.slice(1).forEach(c => { out.push([cur, c.points[0], c.points[1], c.points[2]]); cur = c.points[2]; });
  return out;
}
const denseLen = (cubs) => { let t = 0, pr = cubs[0][0]; cubs.forEach(q => { for (let i = 1; i <= 3000; i++) { const p = cubicPt(q, i / 3000); t += D(pr, p); pr = p; } }); return t; };
const spIdx = (cubs) => { let best = 0; for (let i = 0; i < cubs.length; i++) if (cubs[i][3].y < cubs[best][3].y) best = i; return best; };
const byRole = (g, r) => g.construction.find(s => s.role === r);

// ── 1. API ──
ok(typeof SA.draftSleeveA === "function" && typeof SA.draftFromMeasures === "function" && typeof SA.readBodiceArmhole === "function" && typeof SA.easeAdjustment === "function" && Object.isFrozen(SA), "1: API·frozen");
ok(SA.RULES.backPlusCm === 0.4 && SA.RULES.frontMinusCm === 0.6 && SA.RULES.bulgeCm === 1.8 && SA.RULES.flatCm === 1 && SA.RULES.easeRate === 0.05, "1: 잠긴 사양 상수");

// ── 2. 진동 읽기 (실제 bodiceResult) ──
const BA = bodiceResultOf("A"), BI = bodiceResultOf("I");
ok(BA && BI, "2: 실제 bodiceCheckpoint.complete 로 A·I bodiceResult 생성");
const RA = SA.readBodiceArmhole(BA), RI = SA.readBodiceArmhole(BI);
ok(RA.ok && RI.ok, "2: A·I 진동 읽기 성공");
ok(D(RA.back.shoulderStored, { x: 20.44, y: 2.00 }) < 0.01 && D(RA.back.underarmStored, { x: 23.05, y: 20.62 }) < 0.01, "2: 뒤 보관 형상 어깨점 (20.44, 2.00)·아랫점 (23.05, 20.62)");
ok(near(RA.back.heightStoredCm, 18.62, 0.01) && near(RA.front.heightStoredCm, 20.30, 0.01), "2: 보관(열린 다트) 형상 높이 — 뒤 18.62 · 앞 20.30");
// 뒤 어깨 다트 닫음: CB 고정·진동 쪽을 다트 정점 축으로 회전 → 어깨점·아랫점이 함께 돈다
ok(RA.back.closedShoulderDart && RA.back.closedDart === null && near(RA.back.closedShoulderDart.angleRad * 180 / Math.PI, -11.38, 0.02) && RA.back.closedShoulderDart.mouthResidualCm < 0.15, "2: 뒤 어깨 다트 닫힘 변환 적용(−11.38°·입구 잔차 <0.15 — 두 다리 ~0.1 비대칭)");
ok(D(RA.back.shoulder, { x: 19.05, y: 0.03 }) < 0.01 && D(RA.back.underarm, { x: 25.28, y: 17.77 }) < 0.01 && near(RA.back.heightCm, 17.74, 0.01), "2: 뒤 닫은 어깨점 (19.05, 0.03)·아랫점 (25.28, 17.77) → 뒤 어깨 높이 17.74");
// 독립 근거: 뒤 어깨 다트를 닫아 두는 Ⓖ 의 진동 체인 끝점과 일치(Ⓖ 는 지원 밖이라 원자료 끝점만 비교)
{
  const gb = bodiceResultOf("G").armhole.back, ends = []; gb.forEach(sg => { const e = sg.kind === "path" ? [sg.commands[0].points[0], sg.commands[sg.commands.length - 1].points.slice(-1)[0]] : [sg.from, sg.to]; ends.push(e[0], e[1]); });
  const top = ends.reduce((a, b) => (b.y < a.y ? b : a)), bot = ends.reduce((a, b) => (b.y > a.y ? b : a));
  ok(D(top, RA.back.shoulder) < 0.01 && D(bot, RA.back.underarm) < 0.01, "2: 닫은 뒤 어깨점·아랫점 = Ⓖ 가 닫아 둔 뒤 진동 체인 끝점(독립 일치)");
}
// 닫은 진동 곡선은 회전 변환이라 길이 불변(= bodiceResult.armholeLengths) · 곡선 끝점이 닫은 어깨점/아랫점
ok(near(RA.back.armholeClosedLengthCm, BA.armholeLengths.back, 0.01) && near(RA.front.armholeClosedLengthCm, BA.armholeLengths.front, 0.01), "2: 닫은 진동 곡선 길이 = AH(앞·뒤 회전 불변)");
{ const pts = [].concat.apply([], RA.back.armholeClosed), md = (P) => Math.min.apply(null, pts.map(q => D(q, P)));
  ok(md(RA.back.shoulder) < 0.01 && md(RA.back.underarm) < 0.01, "2: 닫은 뒤 진동 곡선이 닫은 어깨점·아랫점에서 끝난다");
  const pf = [].concat.apply([], RA.front.armholeClosed), mf = (P) => Math.min.apply(null, pf.map(q => D(q, P)));
  ok(mf(RA.front.shoulder) < 0.01 && mf(RA.front.underarm) < 0.01, "2: 닫은 앞 진동 곡선이 닫은 어깨점·아랫점에서 끝난다"); }
ok(near(RA.front.heightCm, 16.38, 0.01) && RA.front.closedDart && RA.front.closedDart.mouthResidualCm < 0.05, "2: 앞 어깨 높이 = AH 다트 닫은 값 16.38(입구 일치)");
ok(D(RA.front.shoulder, RI.front.shoulder) < 0.01 && near(RA.front.heightCm, RI.front.heightCm, 0.01), "2: 다트 회전으로 닫은 A 앞 어깨점 = 이미 닫힌 Ⓘ 보관 어깨점(독립 일치)");
ok(RI.front.closedDart === null && near(RI.front.heightStoredCm, RI.front.heightCm), "2: 이미 닫힌 앞(Ⓘ)은 보관 형상 그대로");
ok(RI.back.closedShoulderDart && Math.abs(RI.back.closedShoulderDart.angleRad) < 1e-3 && near(RI.back.heightCm, 18.62, 0.01), "2: Ⓘ 뒤는 목둘레 턱이 이미 어깨 다트를 닫아 둠(회전 ≈0) — 보관 형상 그대로(진동 쪽 고정이라 18.62)");
ok(near(RA.front.armholeLengthCm, BA.armholeLengths.front) && near(RA.back.armholeLengthCm, BA.armholeLengths.back), "2: AH 는 bodiceResult.armholeLengths");
// 지원 밖 몸판: 진동이 회전·이동돼 가슴둘레선이 앞뒤 다른 몸판은 사유와 함께 거절(조용히 틀린 높이를 쓰지 않는다)
["G", "H", "M", "N"].forEach(s => { const r = SA.readBodiceArmhole(bodiceResultOf(s)); ok(!r.ok && r.reason === "armhole-underarm-mismatch", `2: ${s} 지원 밖 → armhole-underarm-mismatch`); });
ok(["B", "C", "D", "E", "F", "J", "K", "L", "O", "P", "Q", "R", "S", "T", "U", "V"].every(s => { const r = SA.readBodiceArmhole(bodiceResultOf(s)); return r.ok && near(r.front.heightCm, 16.38, 0.01) && near(r.back.heightCm, ["J", "K", "L"].indexOf(s) >= 0 ? 18.62 : 17.74, 0.01); }), "2: 나머지 16변형 모두 읽기 성공(앞 16.38 · 뒤 17.74, 이미 닫힌 목둘레 턱 J·K·L 은 18.62)");
// 읽기 실패 계약
ok(SA.readBodiceArmhole(null).reason === "no-bodice" && SA.readBodiceArmhole({}).reason === "no-bodice", "2: no-bodice");
{ const b = JSON.parse(J(BA)); b.armholeLengths.front = 0; ok(SA.readBodiceArmhole(b).reason === "invalid-armhole-length", "2: invalid-armhole-length");
  const c = JSON.parse(J(BA)); c.front.construction = c.front.construction.filter(s => !(s.dart && s.dart.boundary === "armhole"));
  ok(SA.readBodiceArmhole(c).reason === "armhole-dart-missing", "2: 열린 AH 다트인데 다리가 없으면 armhole-dart-missing");
  const f = JSON.parse(J(BA)); f.back.construction = f.back.construction.filter(s => !(s.dart && s.dart.boundary === "shoulder"));
  ok(SA.readBodiceArmhole(f).reason === "shoulder-dart-missing", "2: 어깨선이 끊겼는데 다리가 없으면 shoulder-dart-missing(조용히 안 닫지 않는다)");
  const e = JSON.parse(J(BA)); e.back.outline = e.back.outline.filter(s => s.edge !== "side-seam");
  ok(SA.readBodiceArmhole(e).reason === "ambiguous-underarm", "2: 옆선 없음 → ambiguous-underarm"); }

// ── 3. 제도 (A 몸판) ──
const DA = SA.draftSleeveA(BA, { sleeveLengthCm: 52, elbowLengthCm: 31 });
ok(DA.ok, "3: draftSleeveA 성공");
const M = DA.meta, G = DA.geometry;
const Hexp = ((RA.back.heightCm + RA.front.heightCm) / 2) * 4 / 5;
ok(near(M.capHeightCm, Hexp, 1e-9) && near(M.capHeightCm, 13.648, 0.005), "3: 소매산 높이 = ((뒤 17.74 + 앞 16.38)/2)×4/5 = 13.648(닫기 전 14.000)");
ok(near(M.shoulderHeightsCm.back, 17.74, 0.01) && near(M.shoulderHeightsCm.front, 16.38, 0.01) && M.source.back.shoulderDartClosed && M.source.front.dartClosed && near(M.source.back.heightStoredCm, 18.62, 0.01), "3: meta — 닫은 높이 뒤 17.74/앞 16.38 · 보관 18.62/20.30 · 앞뒤 닫힘 적용 기록");
ok(near(M.bicepCm, 32.07, 0.01), "3: 소매폭(조정 후 아랫점 간격) 32.07");
const ahB = BA.armholeLengths.back, ahF = BA.armholeLengths.front;
const bl = byRole(G, "back-line"), fl = byRole(G, "front-line"), ul = byRole(G, "underarm-level");
ok(near(D(bl.from, bl.to), ahB + 0.4, 1e-9) && near(D(fl.from, fl.to), ahF - 0.6, 1e-9), "3: SP→아랫점 직선 = 뒤 AH+0.4 · 앞 AH−0.6");
ok(near(bl.to.y, M.capHeightCm) && near(fl.to.y, M.capHeightCm) && near(ul.from.y, M.capHeightCm) && bl.to.x < 0 && fl.to.x > 0, "3: 아랫점은 SP 아래 H 의 수평선 위 · 뒤 −x / 앞 +x");
// 볼록점: 직선 위 앞AH/4 에서 직각 바깥 1.8
[["back", bl], ["front", fl]].forEach(([k, ln]) => {
  const P = M.bulgePoints[k], dx = ln.to.x - ln.from.x, dy = ln.to.y - ln.from.y, len = Math.hypot(dx, dy);
  const along = (P.x * dx + P.y * dy) / len, perp = (P.x * dy - P.y * dx) / len;   // 직선 기준 좌표
  ok(near(along, ahF / 4, 1e-9) && near(Math.abs(perp), 1.8, 1e-9), `3: ${k} 볼록점 = 직선 위 앞AH/4(${(ahF / 4).toFixed(3)}) 지점에서 직각 1.8`);
  ok(P.y < (ln.to.y / len) * along, `3: ${k} 볼록점은 직선 바깥(위쪽)`);
});
// SP 좌우 수평 1cm: SP 를 지나는 cubic 의 핸들
{
  const cubs = capCubics(G), k = spIdx(cubs);   // cubs[k] 가 SP 에서 끝나는 뒤쪽 마지막 / cubs[k+1] 이 SP 에서 시작
  const sp = cubs[k][3];
  ok(D(sp, { x: 0, y: 0 }) < 1e-9 && D(cubs[k + 1][0], sp) < 1e-9, "3: SP = (0,0) — 소매산 최고점(유일 apex)");
  ok(near(Math.abs(cubs[k][2].x), 1.0) && near(Math.abs(cubs[k + 1][1].x), 1.0) && cubs[k][2].y === 0 && cubs[k + 1][1].y === 0, "3: SP 접선 수평 · 핸들 길이 1.0");
  ok(k + 1 === M.capSplit.anchorIndex, "3: capSplit.anchorIndex = SP 앵커 번호");
}
// 곡선이 볼록점·아랫점을 지난다(조정 전/후 해당 변)
{
  const cubs = capCubics(G); const pts = []; cubs.forEach(q => { for (let i = 0; i <= 400; i++) pts.push(cubicPt(q, i / 400)); });
  const near2 = (P) => Math.min.apply(null, pts.map(p => D(p, P)));
  ok(near2(M.bulgePoints.back) < 1e-3 && near2(M.bulgePoints.front) < 1e-3, "3: 소매산 곡선이 양쪽 볼록점을 지난다");
  ok(pts.every(p => p.y >= -1e-9 && p.y <= M.capHeightCm + 1e-9), "3: 소매산 곡선은 SP 와 아랫점 수평선 사이");
}

// ── 4. 이세 목표 · 조정 ⑧ ──
const tot = 0.05 * (ahB + ahF);
ok(near(M.easeTarget.total, tot, 1e-12) && near(M.easeTarget.back, tot * 3 / 5, 1e-12) && near(M.easeTarget.front, tot * 2 / 5, 1e-12), "4: 목표 이세 = (앞AH+뒤AH)×5% · 뒤:앞 = 3:2");
{
  const cubs = capCubics(G), k = spIdx(cubs);
  const capBack = denseLen(cubs.slice(0, k + 1)), capFront = denseLen(cubs.slice(k + 1));
  ok(near(capBack, M.capLengths.back, 1e-3) && near(capFront, M.capLengths.front, 1e-3), "4: meta 소매산선 길이 = 독립 조밀 측정");
  ok(near(M.delta.back, M.easeTarget.back - M.easeBefore.back) && near(M.delta.front, M.easeTarget.front - M.easeBefore.front), "4: Δ = 목표 이세 − 현재 이세");
  // 아랫점 수평 이동: 뒤 Δ<0(중심 쪽 +x) / 앞 Δ>0(바깥 +x)  (A 몸판 실측 부호)
  ok(M.delta.back < 0 && M.delta.front > 0, "4: A 실측 Δ — 뒤 <0 · 앞 >0");
  ok(near(M.underarm.after.back.x - M.underarm.before.back.x, -M.delta.back, 1e-9), "4: 뒤 Δ<0 → 아랫점 중심 쪽(+x)으로 |Δ| 수평 이동");
  ok(near(M.underarm.after.front.x - M.underarm.before.front.x, M.delta.front, 1e-9), "4: 앞 Δ>0 → 아랫점 바깥(+x)으로 Δ 수평 이동");
  ok(M.underarm.after.back.y === M.capHeightCm && M.underarm.after.front.y === M.capHeightCm && M.underarm.before.back.y === M.underarm.after.back.y, "4: 소매산 높이 불변(아랫점 y = H 그대로)");
  ok(M.adjusted === true && Math.abs(M.residualCm.back) < 0.01 && Math.abs(M.residualCm.front) < 1e-9, "4: 잔차 관찰(절단 <0.01 · 연장 정확)");
  // 연장은 끝 접선(수평)을 유지: 마지막 cubic 의 두 핸들과 끝점이 같은 수평선
  const last = cubs[cubs.length - 1];
  ok(last[1].y === M.capHeightCm && last[2].y === M.capHeightCm && last[3].y === M.capHeightCm, "4: 앞 연장 = 끝 흐름(수평) 유지");
  // 밑선 수직
  const sideB = G.outline[1], sideF = G.outline[2];
  ok(sideB.from.x === sideB.to.x && sideF.from.x === sideF.to.x && D(sideB.from, M.underarm.after.back) === 0 && D(sideF.from, M.underarm.after.front) === 0, "4: 새 아랫점에서 밑선 수직");
  ok(near(sideB.to.y, 52) && near(G.outline[3].from.y, 52) && near(M.bicepCm, M.underarm.after.front.x - M.underarm.after.back.x), "4: 소매길이(SP→소매부리) 52 · 소매폭 = 아랫점 간격");
}
// adjust:false → 조정 없음(관찰만)
{
  const r = SA.draftSleeveA(BA, { sleeveLengthCm: 52, adjust: false });
  ok(r.ok && r.meta.adjusted === false && r.meta.shiftCm.back === 0 && near(r.meta.residualCm.back, -r.meta.delta.back, 1e-9) && r.meta.underarm.after.back.x === r.meta.underarm.before.back.x, "4: adjust:false → 이동 0 · 잔차 = −Δ");
}

// ── 5. 책 산술 (P.138 / P.139) ──
{
  // P.138: 소매산선 22.9/21.3, AH 21.6/20.5 → 이상 이세 5% = 2.105 → 뒤 1.263 · 앞 0.842 (책 표 1.3/0.8, 현재 1.3/0.8 → 조정 불필요 «9로»)
  const a = SA.easeAdjustment({ capBackCm: 22.9, capFrontCm: 21.3, ahBackCm: 21.6, ahFrontCm: 20.5 });
  ok(near(a.target.total, 2.105, 1e-9) && near(a.target.back, 1.263, 1e-9) && near(a.target.front, 0.842, 1e-9), "5: P.138 이상 이세 2.105 → 뒤 1.263 · 앞 0.842");
  ok(near(a.current.back, 1.3, 1e-9) && near(a.current.front, 0.8, 1e-9) && near(a.current.total, 2.1, 1e-9), "5: P.138 현재 이세 1.3/0.8/2.1");
  ok(Math.round(a.target.back * 10) / 10 === 1.3 && Math.round(a.target.front * 10) / 10 === 0.8 && Math.abs(a.delta.back) < 0.05 && Math.abs(a.delta.front) < 0.05, "5: P.138 책 표시(0.1 반올림) 1.3/0.8 와 일치 · Δ≈0");
  // P.139: 소매산선 23.0/21.5, AH 21.5/20.5 → 이상 2.1 → 뒤 1.26 · 앞 0.84, 현재 1.5/1.0 → Δ −0.24/−0.16 (책 «−0.2씩»)
  const b = SA.easeAdjustment({ capBackCm: 23.0, capFrontCm: 21.5, ahBackCm: 21.5, ahFrontCm: 20.5 });
  ok(near(b.target.total, 2.1, 1e-9) && near(b.target.back, 1.26, 1e-9) && near(b.target.front, 0.84, 1e-9), "5: P.139 이상 이세 2.1 → 뒤 1.26 · 앞 0.84");
  ok(near(b.current.back, 1.5, 1e-9) && near(b.current.front, 1.0, 1e-9) && near(b.current.total, 2.5, 1e-9), "5: P.139 현재 이세 1.5/1.0/2.5");
  ok(near(b.delta.back, -0.24, 1e-9) && near(b.delta.front, -0.16, 1e-9), "5: P.139 Δ = −0.24 / −0.16");
  ok(Math.round(b.delta.back * 10) / 10 === -0.2 && Math.round(b.delta.front * 10) / 10 === -0.2, "5: P.139 책 표시(0.1 반올림) «−0.2씩» 와 일치(참고 검산 — 엔진은 원값 Δ 를 쓴다)");
}

// ── 6. 스윕: 안전성(폐곡선·연결·자기교차 없음·높이 불변·Δ 부호) ──
{
  let n = 0, refused = 0, bad = 0, negB = 0, posB = 0, negF = 0, posF = 0, maxRes = 0, firstBad = null;
  for (const ahb of [19.5, 20.5, 21.5, 22.5, 23.5]) for (const ahf of [18.5, 19.5, 20.5, 21.5, 22.5]) for (const hb of [16, 18.6, 20.5]) for (const hf of [14.5, 16.4, 19]) {
    n++;
    const r = SA.draftFromMeasures({ backAHCm: ahb, frontAHCm: ahf, backShoulderHeightCm: hb, frontShoulderHeightCm: hf }, { sleeveLengthCm: 55, elbowLengthCm: 33 });
    if (!r.ok) {   // 극단 치수(앞뒤 AH 가 4.5cm 이상 차이 등)에서만 SP 위로 곡선이 솟아 거절 — 그 사유만 허용
      if (r.reason === "cap-apex-not-sp") { refused++; if (ahb >= 20.5 && ahb <= 22.5 && ahf >= 19.5 && ahf <= 21.5 && hb >= 18 && hf >= 16) bad++; }
      else { bad++; if (!firstBad) firstBad = [ahb, ahf, hb, hf, r.reason]; }
      continue;
    }
    const m = r.meta, cubs = capCubics(r.geometry);
    const H = ((hb + hf) / 2) * 4 / 5;
    let good = m.checks.closed && m.checks.connected && !m.checks.selfIntersection && m.checks.apexIsSP && near(m.capHeightCm, H, 1e-9)
      && m.underarm.after.back.y === H && m.underarm.after.front.y === H
      && near(m.underarm.after.back.x - m.underarm.before.back.x, -m.delta.back, 1e-9) && near(m.underarm.after.front.x - m.underarm.before.front.x, m.delta.front, 1e-9)
      && cubs.every(q => q.every(pt => isFinite(pt.x) && isFinite(pt.y))) && D(cubs[0][0], m.underarm.after.back) < 1e-9 && D(cubs[cubs.length - 1][3], m.underarm.after.front) < 1e-9;
    // 연결: cubic 연쇄
    for (let i = 1; i < cubs.length; i++) if (D(cubs[i - 1][3], cubs[i][0]) > 1e-9) good = false;
    // 독립 자기교차 검사(소매산 + 옆선 + 소매부리)
    const ring = []; cubs.forEach((q, qi) => { for (let i = qi ? 1 : 0; i <= 80; i++) ring.push(cubicPt(q, i / 80)); });
    ring.push(r.geometry.outline[2].to, r.geometry.outline[1].to);
    const cr = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const x = (a, b, c, d) => ((cr(c, d, a) > 0) !== (cr(c, d, b) > 0)) && ((cr(a, b, c) > 0) !== (cr(a, b, d) > 0));
    outer: for (let i = 0; i < ring.length - 1; i++) for (let j = i + 2; j < ring.length - 1; j++) { if (i === 0 && j === ring.length - 2) continue; if (x(ring[i], ring[i + 1], ring[j], ring[j + 1])) { good = false; break outer; } }
    if (!good) { bad++; if (!firstBad) firstBad = [ahb, ahf, hb, hf, "invariant"]; }
    if (m.delta.back < 0) negB++; else posB++; if (m.delta.front < 0) negF++; else posF++;
    maxRes = Math.max(maxRes, Math.abs(m.residualCm.back), Math.abs(m.residualCm.front));
  }
  ok(bad === 0, `6: 스윕 ${n}건 전부 폐곡선·연결·자기교차 없음·높이 불변·Δ 이동 일치 (실패 ${bad} ${firstBad ? J(firstBad) : ""})`);
  ok(negB > 0 && posB > 0 && negF > 0 && posF > 0, `6: 스윕이 Δ<0·Δ>0 양쪽(뒤 ${negB}/${posB} · 앞 ${negF}/${posF})을 모두 덮는다`);
  ok(refused <= n * 0.05, `6: 극단 치수 거절(cap-apex-not-sp) ${refused}/${n} ≤ 5% · 현실 범위는 전부 성공`);
  ok(maxRes < 0.05, `6: 스윕 최대 잔차 ${maxRes.toExponential(2)} (관찰 — 절단 시 끝 접선 기울기 오차뿐, 책 게이트 아님)`);
}
// 1cm 경고는 관찰 배열일 뿐 게이트가 아니다(이 제도 모델은 Δ 가 1cm 에 거의 안 닿는다 — 경고 경로 자체는 meta 로만 노출)
{
  const r = SA.draftFromMeasures({ backAHCm: 21.5, frontAHCm: 20.5, backShoulderHeightCm: 18.6, frontShoulderHeightCm: 16.4 }, { sleeveLengthCm: 52 });
  ok(r.ok && Array.isArray(r.warnings) && r.warnings.length === 0 && Math.abs(r.meta.delta.back) < 1 && Math.abs(r.meta.delta.front) < 1, "6: 보통 치수 — 경고 배열 비어 있음");
}

// ── 7. bodiceResult 불변 · 입력 불변 · 결정성 ──
{
  const frozen = deepFreeze(JSON.parse(J(BA)));
  const snap = J(frozen), hash = frozen.hash;
  const params = { sleeveLengthCm: 52, elbowLengthCm: 31 }, pSnap = J(params);
  let threw = false, r1, r2;
  try { r1 = SA.draftSleeveA(frozen, params); r2 = SA.draftSleeveA(frozen, params); } catch (e) { threw = true; }
  ok(!threw && r1.ok, "7: 동결 bodiceResult 에서도 예외 없이 제도(쓰기 시도 없음)");
  ok(J(frozen) === snap && frozen.hash === hash && Object.isFrozen(frozen) && Object.isFrozen(frozen.front.outline), "7: bodiceResult·hash 불변");
  ok(r1.sourceBodiceHash === hash, "7: sourceBodiceHash = bodiceResult.hash(복사만)");
  ok(J(params) === pSnap, "7: params 불변");
  ok(J(r1) === J(r2), "7: 결정적(같은 입력 → 같은 출력)");
  // 반환 geometry 는 입력과 참조 분리
  ok(r1.geometry.outline !== frozen.front.outline && r1.geometry.construction !== frozen.front.construction, "7: 반환 geometry 는 새 객체");
  // 실제 bodiceCheckpoint 완료 스냅샷도 그대로(공유 프로젝트의 bodiceResult 를 건드리지 않음)
  PROJECT = MK(BP.bodyParams(presetOf("A"))); const c = BC.complete(PROJECT); const before = J(c.result);
  SA.draftSleeveA(PROJECT.working.bodiceResult, params);
  ok(J(PROJECT.working.bodiceResult) === before && PROJECT.working.bodiceResult.hash === c.result.hash, "7: 프로젝트 working.bodiceResult 동일");
}

// ── 8. 실패 계약 ──
{
  const m = { backAHCm: 21.6, frontAHCm: 20.5, backShoulderHeightCm: 18.6, frontShoulderHeightCm: 16.4 };
  const re = (mm, pp) => SA.draftFromMeasures(mm, pp).reason;
  ok(re(null, { sleeveLengthCm: 52 }) === "invalid-armhole-length", "8: 측정값 없음");
  ok(re(Object.assign({}, m, { backAHCm: 0 }), { sleeveLengthCm: 52 }) === "invalid-armhole-length", "8: AH 0");
  ok(re(Object.assign({}, m, { frontShoulderHeightCm: -1 }), { sleeveLengthCm: 52 }) === "invalid-shoulder-height", "8: 어깨 높이 ≤0");
  ok(re(m, {}) === "invalid-sleeve-length" && re(m, { sleeveLengthCm: 0 }) === "invalid-sleeve-length" && re(m, { sleeveLengthCm: 15 }) === "invalid-sleeve-length", "8: 소매길이 누락/0/소매산보다 짧음");
  ok(re(m, { sleeveLengthCm: 52, elbowLengthCm: 60 }) === "invalid-elbow-length" && re(m, { sleeveLengthCm: 52, elbowLengthCm: 5 }) === "invalid-elbow-length", "8: 팔꿈치 길이 범위 밖");
  ok(re({ backAHCm: 10, frontAHCm: 9, backShoulderHeightCm: 18.6, frontShoulderHeightCm: 16.4 }, { sleeveLengthCm: 52 }) === "cap-height-exceeds-line", "8: 직선이 소매산 높이보다 짧음 → cap-height-exceeds-line");
  ok(SA.draftSleeveA(null, { sleeveLengthCm: 52 }).reason === "no-bodice", "8: bodiceResult 없음");
  ok(SA.draftSleeveA(bodiceResultOf("G"), { sleeveLengthCm: 52 }).reason === "armhole-underarm-mismatch", "8: 지원 밖 몸판은 소매 생성 거절");
}

// ── 9. 기존 소매 모듈과 호환(읽기만 — 기존 코드는 무변경) ──
{
  const r = SA.draftSleeveA(BA, { sleeveLengthCm: 52 }), g = r.geometry;
  const ms = SM.measureSleeveCap(g);
  ok(ms && near(ms.backLength, r.meta.capLengths.back, 0.01) && near(ms.frontLength, r.meta.capLengths.total - r.meta.capLengths.back, 0.01), "9: sleeveMeasure.measureSleeveCap 앞/뒤 = meta 소매산선 길이");
  const lc = DS.capLineFromGeometry(g);
  ok(lc && lc.splitAnchorIndex === r.meta.capSplit.anchorIndex, "9: designSleeve.capLineFromGeometry 의 SP 앵커 = capSplit");
  const cp = DS.capPrimitives(g);
  ok(cp && near(cp.lengths.back, r.meta.capLengths.back, 0.01) && near(cp.lengths.front, r.meta.capLengths.front, 0.01) && D(cp.splitPoint, { x: 0, y: 0 }) < 1e-6, "9: capPrimitives 앞/뒤 길이·SP");
  ok(DS.sleeveOutlineSelfIntersects(g) === false, "9: sleeveOutlineSelfIntersects = false");
  ok(Object.isFrozen(DS) && typeof DS.computeSilhouette === "function" && !("draftSleeveA" in DS), "9: designSleeve API 불변(Ⓐ 는 별개 모듈)");
}

console.log("══════════════════════════════════════════════");
if (FAIL) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); }
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
