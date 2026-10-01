// yokeSeamCheck.js — 요크 이음선 ① Ⓠ(P.30)의 순수 geometry 연산(js/designYokeSeam.js) 회귀.
//   node test/harness/yokeSeamCheck.js
// 범위: 엔진만(프리셋·UI·renderer·checkpoint 미연결). 이음선 = 다트 apex 를 지나는 수평선,
//       앞 AH 다트·뒤 어깨 다트 전량 흡수, 요크·몸판은 별개 폐곡선, 밑단 옆 +1.
const vm = require("vm");
const fs = require("fs");
const path = require("path");

let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
function throwsReason(fn, want, name) {
  try { fn(); FAIL++; fails.push(name + " (throw 안 됨)"); }
  catch (e) {
    if (want && e.reason !== want) { FAIL++; fails.push(`${name} (reason=${e.reason}, 기대=${want})`); }
    else PASS++;
  }
}
const J = JSON.stringify;
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const clone = (v) => JSON.parse(JSON.stringify(v));

const sandbox = {
  window: {}, console: { log() {}, warn() {} }, Math, JSON, Object, Array, isFinite, structuredClone, Error, Date,
  c2p: (x, y) => [x * 10, y * 10],
  document: { createElementNS: () => ({ setAttribute() {}, appendChild() {} }) }
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
const load = (f) => vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "..", "js", f), "utf8"), sandbox, { filename: f });
["designLineTool.js", "designFlare.js", "designJoin.js", "designWaistSeam.js", "designBodice.js", "bodicePresets.js", "designYokeSeam.js"].forEach(load);
const W = sandbox.window, DB = W.designBodice, DY = W.designYokeSeam, T = W.designLineTool;
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));
const SNAP = J(REF);

// Ⓠ 의 입력 = 박시 + 밑단 옆 +1(Ⓑ 몸판). 다른 프리셋 파라미터는 건드리지 않는다.
const G = DB.computeGeometry(REF, { body: { hemExtensionBelowWaistCm: 20, hemSideOffsetCm: 1 } });
const GA = DB.computeGeometry(REF, { body: { hemExtensionBelowWaistCm: 20 } });   // 밑단 +0(Ⓐ)
const GSNAP = J(G);

const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
// outline 프리미티브는 무순서 집합이다(원본 path 복원으로 방향도 섞인다) — 끝점으로 체이닝해 ordered ring 을 만든다.
const rawSegs = (outline) => T.outlinePrimsToSegs(outline);
function orderRing(outline) {
  const segs = rawSegs(outline).map(s => Object.assign({}, s)); if (!segs.length) return null;
  const used = new Array(segs.length).fill(false), out = [];
  let cur = segs[0]; used[0] = true; out.push(cur); let tip = cur.to;
  for (let k = 1; k < segs.length; k++) {
    let f = -1, rev = false;
    for (let j = 0; j < segs.length; j++) {
      if (used[j]) continue;
      if (D(segs[j].from, tip) < 1e-4) { f = j; break; }
      if (D(segs[j].to, tip) < 1e-4) { f = j; rev = true; break; }
    }
    if (f < 0) return null;
    used[f] = true; const s0 = segs[f];
    const o = rev ? T.reverseSeg(s0) : s0; out.push(o); tip = o.to;
  }
  return D(tip, out[0].from) < 1e-4 ? out : null;
}
const flat = (outline) => { const o = []; (orderRing(outline) || []).forEach(s => T.flattenLine([s]).forEach(ab => o.push(ab))); return o; };
function area(outline) {
  const pts = []; flat(outline).forEach(ab => { if (!pts.length) pts.push(ab[0]); pts.push(ab[1]); });
  let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p.x * q.y - q.x * p.y; }
  return Math.abs(a / 2);
}
function selfIntersects(outline) {
  const e = flat(outline);
  const o = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  for (let i = 0; i < e.length; i++) for (let j = i + 1; j < e.length; j++) {
    const [a, b] = e[i], [c, d] = e[j];
    if ([a, b].some(p => [c, d].some(q => D(p, q) < 1e-6))) continue;
    if (o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0) return true;
  }
  return false;
}
const closedRing = (outline) => !!orderRing(outline);   // 모든 세그먼트가 하나의 연속 폐곡선 체인
// 이음선 프리미티브(태그 `yokeSeam` 은 outline 프리미티브에만 실린다)
const seamSegs = (outline, which) => outline.filter(s => s.edge === "yoke-seam" && s.yokeSeam === which);
const len = (segs) => segs.reduce((L, s) => L + D(s.from, s.to), 0);   // 이음선은 직선
const apexOf = (piece, id) => { const l = piece.construction.filter(s => s.dart && s.dart.id === id)[0]; return l.dart.apexAt === "to" ? l.to : l.from; };
const ID = { front: "front-bust", back: "back-shoulder" };

const R = DY.split(G);
ok(J(G) === GSNAP, "0: 입력 geometry 불변");
ok(J(REF) === SNAP, "0: 원형 참조 불변");
ok(J(DY.split(G)) === J(R), "0: 결정론(같은 입력 → 같은 출력)");
ok(["frontYoke", "frontBody", "backYoke", "backBody", "meta"].every(k => k in R), "0: 출력 슬롯 4조각 + meta");
ok(Object.isFrozen(DY) && DY.ABSORB.front === "front-bust" && DY.ABSORB.back === "back-shoulder", "0: 공개 API 동결·흡수 다트 id");

["front", "back"].forEach((side) => {
  const Y = R[side + "Yoke"], B = R[side + "Body"], M = R.meta[side], inP = G[side];
  const apex = apexOf(inP, ID[side]);
  const tag = side + ": ";
  // §1 이음선 = apex 를 지나는 수평선 (잠긴 결정 1)
  ok(M.side === side, tag + "meta.side");
  ok(near(M.seamY, apex.y) && near(M.seamPoints.apex.x, apex.x) && near(M.seamPoints.apex.y, apex.y), tag + "이음선 y = 다트 apex y(«11» 미사용)");
  ["upper", "lower"].forEach(w => {
    const s = seamSegs(w === "upper" ? Y.outline : B.outline, w);
    ok(s.length === 2, tag + w + " 이음선 2선분(→apex→)");
  });
  ok(seamSegs(B.outline, "lower").every(s => near(s.from.y, M.seamY, 1e-3) && near(s.to.y, M.seamY, 1e-3)), tag + "몸판 이음선은 수평");
  ok(near(M.seamPoints.center.y, M.seamY, 1e-3) && near(M.seamPoints.side.y, M.seamY, 1e-3) && M.seamMaxDyCm < 1e-3, tag + "교차점 y 오차 < 1e-3");
  // §2 조각 = 별개 폐곡선, 자기교차 0
  ok(closedRing(Y.outline) && closedRing(B.outline), tag + "요크·몸판 폐곡선/연속");
  ok(!selfIntersects(Y.outline) && !selfIntersects(B.outline), tag + "자기교차 0");
  ok(area(Y.outline) > 1 && area(B.outline) > 1, tag + "면적 > 0");
  // §3 다트 전량 흡수: 어디에도 dart 다리·dart 메타가 남지 않는다(닫힌 다트 = 과거 흔적 제거)
  const anyDart = (piece) => piece.outline.some(p => p.dart) || piece.construction.some(p => p.dart && p.dart.id === ID[side]);
  ok(!anyDart(Y) && !anyDart(B), tag + "흡수한 다트 다리가 어디에도 없다");
  ok(M.absorbedDarts.length === 1 && M.absorbedDarts[0].id === ID[side], tag + "meta.absorbedDarts id=" + ID[side]);
  const ab = M.absorbedDarts[0];
  const legs = inP.construction.filter(s => s.dart && s.dart.id === ID[side]);
  const mouth = (l) => l.dart.apexAt === "to" ? l.from : l.to;
  const wantW = D(mouth(legs[0]), mouth(legs[1]));
  ok(near(ab.mouthWidthCm, wantW, 1e-9), tag + "다트 입 너비 = 입력 두 입점 거리");
  ok(ab.angleDeg > 5 && ab.angleDeg < 25, tag + "다트각 합리 범위 " + ab.angleDeg.toFixed(3));
  ok(ab.residualStepCm < 0.2, tag + "잔여 step < 0.2cm (" + ab.residualStepCm.toFixed(4) + ")");
  // §4 요크 이음선은 apex 에서 다트각만큼 꺾인다(회전), 중심 쪽 구간은 수평
  const up = seamSegs(Y.outline, "upper");
  const seamAt = (s, p) => D(s.from, p) < 1e-6 || D(s.to, p) < 1e-6;
  ok(up.some(s => seamAt(s, M.seamPoints.center)) && up.some(s => seamAt(s, M.seamPoints.sideAfterClose)), tag + "요크 이음선 끝점 = center / 회전한 side");
  ok(D(M.seamPoints.sideAfterClose, apex) > 1 && near(D(M.seamPoints.sideAfterClose, apex), D(M.seamPoints.side, apex), 1e-9), tag + "회전은 apex 축 강체(거리 보존)");
  ok(M.seamPoints.sideAfterClose.y < M.seamY, tag + "옆 끝이 위로 올라간다(다트를 닫는 방향)");
  const chk = M.seamPoints.center.x !== M.seamPoints.side.x;
  ok(chk && D(M.seamPoints.side, M.seamPoints.sideAfterClose) > 0.5, tag + "옆 끝은 다트각만큼 이동");
  // §5 상·하 이음 길이 정합(강체 회전 = 길이 보존)
  ok(near(len(seamSegs(Y.outline, "upper")), len(seamSegs(B.outline, "lower")), 1e-9), tag + "요크/몸판 이음 길이 일치");
  ok(near(M.seamLenUpperCm, M.seamLenLowerCm, 1e-9) && Math.abs(M.seamDeltaCm) < 1e-9, tag + "meta 이음 길이·delta");
  ok(near(M.seamLenLowerCm, D(M.seamPoints.center, M.seamPoints.apex) + D(M.seamPoints.apex, M.seamPoints.side), 1e-9), tag + "이음 길이 = center→apex→side");
  // §6 면적 보존(요크 + 몸판 = 입력 링, 다트 wedge 는 접혀 사라져도 링 면적에 이미 빠져 있다)
  ok(near(M.areaYokeCm2 + M.areaBodyCm2, M.areaInputCm2, 0.05), tag + "면적 합 보존");
  ok(near(M.areaYokeCm2, area(Y.outline), 1e-6) && near(M.areaBodyCm2, area(B.outline), 1e-6), tag + "meta 면적 = 출력 면적");
  // §7 위·아래 분리: 요크는 이음선 위, 몸판은 이음선 아래
  ok(flat(Y.outline).every(ab2 => ab2.every(p => p.y <= M.seamY + 1e-6)), tag + "요크는 이음선 위");
  ok(flat(B.outline).every(ab2 => ab2.every(p => p.y >= M.seamY - 1e-6)), tag + "몸판은 이음선 아래");
  // §8 밑단 옆선 +1 (잠긴 결정 6) — 입력이 가진 값을 검증
  ok(near(M.hemSideExtraCm, 1, 1e-9), tag + "밑단 옆선 +1cm");
  // §9 목선 보존: 원래 목선 프리미티브 수와 같다(2 커브 path 가 쪼개지지 않는다)
  const neckIn = inP.outline.filter(p => p.edge === "neckline"), neckOut = Y.outline.filter(p => p.edge === "neckline");
  ok(neckOut.length === neckIn.length && J(neckOut) === J(neckIn), tag + "목선 프리미티브 바이트 동일(요크 유지)");
  // §10 몸판은 하부 형상을 그대로: 하부 외곽(hem·side-seam·center 하단)은 입력과 동일 좌표
  const hemIn = inP.outline.filter(p => p.edge === "hem")[0], hemOut = B.outline.filter(p => p.edge === "hem")[0];
  ok(J(hemIn) === J(hemOut), tag + "hem 선분 동일");
  const sideIn = inP.outline.filter(p => p.edge === "side-seam" && Math.max(p.from.y, p.to.y) > 38 + 1e-9 && Math.min(p.from.y, p.to.y) >= 38 - 1e-9);
  ok(sideIn.length === 1 && B.outline.some(p => p.kind === 'line' && ((D(p.from, sideIn[0].from) < 1e-9 && D(p.to, sideIn[0].to) < 1e-9) || (D(p.from, sideIn[0].to) < 1e-9 && D(p.to, sideIn[0].from) < 1e-9))), tag + "밑단 옆선 조각 동일");
  // §11 구성선: 이음선 아래에 완전히 있는 것만, 요크는 없음
  ok(Y.construction.length === 0, tag + "요크 구성선 없음(다트 흡수)");
  ok(B.construction.every(s => s.from.y >= M.seamY - 5e-3 && s.to.y >= M.seamY - 5e-3), tag + "몸판 구성선은 전부 이음선 아래");
});

// 실측 앵커(B83 참조 geometry): 앞 다트각 18.25°·뒤 11.38°·뒤 잔여 step 0.1029 는 designFlare·원형에 기록된 값
ok(near(R.meta.front.absorbedDarts[0].angleDeg, 18.25, 1e-3), "앵커: 앞 AH 다트각 18.25°");
ok(near(R.meta.back.absorbedDarts[0].angleDeg, 11.38, 1e-2), "앵커: 뒤 어깨 다트각 ≈11.38°");
ok(near(R.meta.back.absorbedDarts[0].residualStepCm, 0.1029, 1e-3), "앵커: 뒤 잔여 step ≈0.1029cm(문서화된 어깨다트 비대칭)");
ok(R.meta.front.absorbedDarts[0].residualStepCm < 1e-9, "앵커: 앞 잔여 step 0");
ok(near(R.meta.front.seamLenLowerCm, 24.446875, 1e-6) && near(R.meta.back.seamLenLowerCm, 18.58013, 1e-4), "앵커: 이음 길이 앞 24.447 · 뒤 18.580");
ok(R.meta.front.droppedConstruction.indexOf("front-waist-b") >= 0, "앵커: 앞 허리 다트 b(apex 가 이음선 위)는 몸판 구성선에서 제외");
ok(R.frontBody.construction.some(s => s.edge === "waist") && R.backBody.construction.some(s => s.edge === "waist"), "앵커: 허리선 구성선은 몸판이 유지");

// 앞 요크는 뒤 요크와 합쳐지지 않는다(어깨에서 별개 조각): 서로 다른 조각, 좌표계도 각자
ok(R.frontYoke !== R.backYoke && J(R.frontYoke) !== J(R.backYoke), "별도 조각: 앞·뒤 요크는 합치지 않는다");

// ── 원자 실패(부분 결과 없음) ──
throwsReason(() => DY.split(null), "invalid-geometry", "F1: null 입력");
throwsReason(() => DY.split({ front: G.front }), "invalid-geometry", "F2: 뒤판 없음");
{
  const g = clone(G); g.back.construction = g.back.construction.filter(s => !(s.dart && s.dart.id === "back-shoulder"));
  throwsReason(() => DY.split(g), "dart-missing", "F3: 뒤 어깨 다트 없음 → 앞은 정상이어도 전체 거부(원자)");
  const g2 = clone(G); g2.front.construction = g2.front.construction.filter(s => !(s.dart && s.dart.id === "front-bust"));
  throwsReason(() => DY.split(g2), "dart-missing", "F4: 앞 AH 다트 없음");
}
throwsReason(() => DY.split(GA), "hem-side-mismatch", "F5: 밑단 +0 입력(Ⓐ)은 +1 검증에서 거부");
{ let r0 = null; try { r0 = DY.split(GA, { hemSideCm: null }); } catch (e) { r0 = e; }
  ok(r0 && r0.meta && near(r0.meta.front.hemSideExtraCm, 0, 1e-9), "F5b: hemSideCm:null 이면 밑단 검증 생략(Ⓐ 통과)"); }
throwsReason(() => DY.split(G, { hemSideCm: "1" }), "invalid-option", "F6: hemSideCm 형식 오류");
throwsReason(() => DY.split(G, { hemSideCm: 2 }), "hem-side-mismatch", "F7: hemSideCm 불일치");
{
  const g = clone(G);   // apex 만 옆으로 3cm(두 다리 길이가 어긋난다) — 링은 그대로 닫힌다
  g.front.construction.forEach(s => { if (s.dart && s.dart.id === "front-bust") { if (s.dart.apexAt === "to") s.to.x -= 6; else s.from.x -= 6; } });
  throwsReason(() => DY.split(g), "dart-leg-length-mismatch", "F8: 두 다리 길이 차 > 0.2cm");
}
{
  const g = clone(G);   // 다트 끝을 옮겨 링이 안 닫히게(다리 하나만 이동)
  const l = g.back.construction.filter(s => s.dart && s.dart.id === "back-shoulder")[0];
  if (l.dart.apexAt === "to") l.to.x += 2; else l.from.x += 2;
  throwsReason(() => DY.split(g), "dart-apex-mismatch", "F9: 두 다리 apex 불일치");
}
ok(J(G) === GSNAP, "F: 실패·성공 호출 후에도 입력 불변");

// apex 가 다른 높이여도(두 다리 길이를 유지하며 이등분선 방향으로 이동 → 이음선 y 변경) 같은 계약으로 성립
{
  const g = clone(G);
  const legs = g.front.construction.filter(s => s.dart && s.dart.id === "front-bust");
  const ap = legs[0].dart.apexAt === "to" ? legs[0].to : legs[0].from;
  const m0 = legs[0].dart.apexAt === "to" ? legs[0].from : legs[0].to, m1 = legs[1].dart.apexAt === "to" ? legs[1].from : legs[1].to;
  const mid = { x: (m0.x + m1.x) / 2, y: (m0.y + m1.y) / 2 };
  const dx = ap.x - mid.x, dy = ap.y - mid.y, L = Math.hypot(dx, dy), step = -1.5;
  const np = { x: ap.x + dx / L * step, y: ap.y + dy / L * step };
  legs.forEach(s => { const p = s.dart.apexAt === "to" ? s.to : s.from; p.x = np.x; p.y = np.y; });
  let r2 = null, err = null; try { r2 = DY.split(g); } catch (e) { err = e; }
  ok(!err, "E1: apex 이동(다리 길이 유지)도 처리" + (err ? " — " + err.reason : ""));
  if (r2) {
    const m = r2.meta.front;
    ok(near(m.seamY, np.y, 1e-9) && Math.abs(m.seamY - apexOf(G.front, "front-bust").y) > 0.5, "E1: 이음선 y = 이동한 apex y");
    ok(closedRing(r2.frontYoke.outline) && closedRing(r2.frontBody.outline) && !selfIntersects(r2.frontYoke.outline) && !selfIntersects(r2.frontBody.outline), "E1: 폐곡선·자기교차 0");
    ok(near(m.seamLenUpperCm, m.seamLenLowerCm, 1e-9) && near(m.areaYokeCm2 + m.areaBodyCm2, m.areaInputCm2, 0.05), "E1: 이음 길이·면적 정합");
    ok(m.seamMaxDyCm < 1e-6, "E1: 진동 곡선 내부 교차점도 수평(dy<1e-6)");
  }
}


// ══ 커밋 1 배선: designBodice.computeGeometry body.yokeSeam ══
{
  const BP = W.bodicePresets;
  const YB = { hemExtensionBelowWaistCm: 20, hemSideOffsetCm: 1 };
  const base = DB.computeGeometry(REF, { body: YB });
  const on = DB.computeGeometry(REF, { body: Object.assign({ yokeSeam: true }, YB) });
  const off = DB.computeGeometry(REF, { body: Object.assign({ yokeSeam: false }, YB) });
  ok(J(off) === J(base), "W1: yokeSeam:false = 플래그 없음(바이트 동일)");
  ok(J(on.front) === J(base.front) && J(on.back) === J(base.back), "W2: true 여도 front/back 은 플래그 없는 결과와 바이트 동일");
  ok(J(on.shared) === J(base.shared) && J(on.sleeve) === J(base.sleeve), "W2: shared/sleeve 도 동일");
  ok(["frontYoke", "frontBody", "backYoke", "backBody", "yokeSeam"].every(k => k in on), "W3: 네 슬롯 + geometry.yokeSeam 존재");
  ok(!["frontYoke", "frontBody", "backYoke", "backBody", "yokeSeam"].some(k => k in base), "W3: 플래그 없으면 슬롯 없음");
  const direct = DY.split({ front: base.front, back: base.back });
  ok(J(on.frontYoke) === J(direct.frontYoke) && J(on.frontBody) === J(direct.frontBody) && J(on.backYoke) === J(direct.backYoke) && J(on.backBody) === J(direct.backBody) && J(on.yokeSeam) === J(direct.meta), "W4: 슬롯·메타 = designYokeSeam.split 결과(계약 그대로)");
  ok(closedRing(on.frontYoke.outline) && closedRing(on.frontBody.outline) && closedRing(on.backYoke.outline) && closedRing(on.backBody.outline), "W5: 네 조각 폐곡선");
  ok(on.yokeSeam.front.side === "front" && on.yokeSeam.back.side === "back" && on.yokeSeam.front.absorbedDarts[0].id === "front-bust", "W5: 메타 side·흡수 다트 id");
  // 기존 A~Ⓟ 프리셋: 플래그 없음/false 가 바이트 동일, 새 키가 생기지 않는다
  BP.families().forEach(f => f.variants.forEach(v => {
    if (v.availability !== "available" || BP.bodyParams(v.id).yokeSeam != null) return;   // Ⓠ·Ⓡ·Ⓢ 는 아래 W10·별도 하네스에서 검증
    const bp = BP.bodyParams(v.id);
    const g0 = DB.computeGeometry(REF, { body: bp }), g1 = DB.computeGeometry(REF, { body: Object.assign({}, bp, { yokeSeam: false }) });
    ok(J(g0) === J(g1) && !("yokeSeam" in g0) && !("frontYoke" in g0), "W6: 프리셋 " + v.id + " yokeSeam:false 바이트 동일");
  }));
  // 원자 거부
  [["true", "invalid-body-yoke-seam"], [1, "invalid-body-yoke-seam"], [{}, "invalid-body-yoke-seam"], [[], "invalid-body-yoke-seam"]].forEach(([v, r]) =>
    throwsReason(() => DB.computeGeometry(REF, { body: Object.assign({ yokeSeam: v }, YB) }), r, "W7: yokeSeam=" + J(v) + " 거부"));
  throwsReason(() => DB.computeGeometry(REF, { body: Object.assign({ yokeSeam: true, waistSeam: true }, YB) }), "yoke-seam-waist-seam-conflict", "W7: waistSeam 과 동시 거부");
  throwsReason(() => DB.computeGeometry(REF, { body: Object.assign({ yokeSeam: true, flare: true }, YB) }), "yoke-seam-flare-conflict", "W7: flare 와 동시 거부");
  throwsReason(() => DB.computeGeometry(REF, { body: { hemExtensionBelowWaistCm: 20, yokeSeam: true } }), "yoke-seam-failed", "W7: 밑단 +1 이 아니면 엔진 실패를 그대로 올린다(부분 결과 없음)");
  ok(J(REF) === SNAP, "W7: 실패 뒤 원형 참조 불변");
  // 프리셋 레코드 검증: yokeSeam boolean(true)만, 충돌 거부. Ⓠ 프리셋은 아직 등록하지 않는다.
  const rec = (body) => ({ id: "x", label: "x", familyId: "boxy-line", symbol: "X", baseMethod: "m", page: 30, body });
  ok(BP.validateRecord(rec({ hemExtensionBelowWaistCm: 20, hemSideOffsetCm: 1, yokeSeam: true })) === true, "W8: yokeSeam:true 레코드 허용");
  throwsReason(() => BP.validateRecord(rec({ yokeSeam: false })), "invalid-body", "W8: yokeSeam:false 레코드 거부(true 만)");
  throwsReason(() => BP.validateRecord(rec({ yokeSeam: "true" })), "invalid-body", "W8: yokeSeam 문자열 거부");
  throwsReason(() => BP.validateRecord(rec({ yokeSeam: true, waistSeam: true })), "yoke-seam-waist-seam-conflict", "W8: waistSeam 충돌");
  ok(BP.fields().some(f => f.key === "yokeSeam"), "W8: fields 에 yokeSeam");
  ok(BP.variant("yoke-seam-1", "bunka-bodice-Q").availability === "available" && J(BP.bodyParams("bunka-bodice-Q")) === J({ hemExtensionBelowWaistCm: 20, hemSideOffsetCm: 1, yokeSeam: true }), "W9: Ⓠ 프리셋 등록(박시 A 기반 · 밑단 +1 · yokeSeam)");
  ok(BP.variant("yoke-seam-2", "bunka-bodice-T").availability === "available", "W9: Ⓣ 도 실행 가능(Ⓡ·Ⓢ·Ⓣ)");
}

console.log("yokeSeamCheck: " + PASS + " PASS / " + FAIL + " FAIL");
if (FAIL) { fails.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
