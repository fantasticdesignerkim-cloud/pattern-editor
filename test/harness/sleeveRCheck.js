// ══════════════════════════════════════════════
// sleeveRCheck.js — 소매 Ⓡ(P.49 돌먼 · 몸판 Ⓐ 에 직접 제도, 화면 검토용 시안) 전용 회귀:
//   카탈로그 · 몸판 Ⓐ 형상 게이트(다른 몸판·변형 거부) · 책 구성 기하 · **독립 길이 검산**(엔진 Gauss 와 별개의 조밀 점열) ·
//   원본 불변(bodiceResult·원형·작업 몸판) · 완료본 소유(파생 몸판) · 입력/몸판 변경 무효화 · 입력 거부 · 스윕 · 표시 모델 · 배선.
//   node test/harness/sleeveRCheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");

let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
const J = JSON.stringify;
const ROOT = path.join(__dirname, "..", "..");

let PROJECT = null;
const sandbox = {
  window: {}, console: { log() {}, warn() {} }, Math, JSON, Object, Array, isFinite, structuredClone, Error, Date,
  c2p: (x, y) => [x * 10, y * 10],
  document: { createElementNS: () => ({ setAttribute() {}, appendChild() {} }) }
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
const load = (f) => vm.runInContext(fs.readFileSync(path.join(ROOT, "js", f), "utf8"), sandbox, { filename: f });
sandbox.window.designWorkflow = { current: () => PROJECT };
["designLineTool.js", "designFlare.js", "designJoin.js", "designWaistSeam.js", "designYokeSeam.js", "designPrincess.js", "designBodice.js", "bodicePresets.js",
  "designLayout.js", "designRenderer.js", "bodiceCheckpoint.js", "peplumAnnotation.js", "designSleeve.js", "sleeveMeasure.js", "sleeveCheckpoint.js",
  "designSleeveA.js", "sleevePresets.js", "sleeveAApply.js", "designSleeveQ.js", "sleeveQApply.js", "designSleeveR.js", "sleeveRApply.js", "sleeveAnnotation.js"].forEach(load);
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, BC = W.bodiceCheckpoint, SP = W.sleevePresets, DS = W.designSleeve,
  SR = W.designSleeveR, SRA = W.sleeveRApply, SC = W.sleeveCheckpoint, SAN = W.sleeveAnnotation;
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));
const MK = (body) => ({ sourceBlock: { id: "blk", version: 2, schemaVersion: 8, canonicalHash: "abc" }, referenceGeometry: JSON.parse(J(REF)),
  working: { geometry: DB.computeGeometry(REF, { body }), parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body },
    patternLines: [], designOutline: null, frontPlacket: null } });
const presetOf = (sym) => { for (const f of BP.families()) for (const v of f.variants) if (v.symbol === sym && v.presetId) return v.presetId; return null; };
function projectWithBodice(id) { PROJECT = MK(BP.bodyParams(id)); const r = BC.complete(PROJECT); return r.ok ? PROJECT : null; }
const A_ID = presetOf("A");

// ── 독립 계측 도구(엔진 코드 미사용): 조밀 점열 길이 ──
const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const cub = (q, t) => { const u = 1 - t; return { x: u * u * u * q[0].x + 3 * u * u * t * q[1].x + 3 * u * t * t * q[2].x + t * t * t * q[3].x, y: u * u * u * q[0].y + 3 * u * u * t * q[1].y + 3 * u * t * t * q[2].y + t * t * t * q[3].y }; };
const cubsOf = (s) => { const o = []; let cur = null; s.commands.forEach(c => { if (c.type === "M") cur = c.points[0]; else { o.push([cur, c.points[0], c.points[1], c.points[2]]); cur = c.points[2]; } }); return o; };
const polyOf = (s, n = 4000) => s.kind === "line" ? [s.from, s.to] : cubsOf(s).reduce((a, q, i) => { for (let k = i ? 1 : 0; k <= n; k++) a.push(cub(q, k / n)); return a; }, []);
const plen = (p) => { let s = 0; for (let i = 1; i < p.length; i++) s += D(p[i - 1], p[i]); return s; };
const lenFromNear = (p, X) => { let bi = 0; for (let i = 1; i < p.length; i++) if (D(p[i], X) < D(p[bi], X)) bi = i; return D(X, p[bi]) * 0 + plen(p.slice(bi)); };   // X 에 가장 가까운 점부터 끝까지
const near = (a, b, t) => Math.abs(a - b) <= t;

// ── 1. 카탈로그 ──
{
  const f = SP.family("dolman-sleeve"), rec = SP.get("bunka-sleeve-R");
  ok(f && f.availability === "available" && f.variants.map(v => v.symbol).join("") === "RS" && f.variants[0].presetId === "bunka-sleeve-R" && f.variants[0].page === 49, "1: 돌먼 = Ⓡ 실행 · Ⓢ 보류");
  ok(f.variants[1].availability === "available" && f.variants[1].presetId === "bunka-sleeve-S" && !f.variants[1].blockedBy, "1: Ⓢ 실행 가능(2026-10-28 김님 확정 — 전용 회귀 sleeveSCheck)");
  ok(rec && rec.methodPage === 49 && rec.inputs.map(i => i.key + "=" + (Math.round(i.defaultValue * 1e6) / 1e6)).join() === "shoulderExtCm=5,backSideEaseCm=3,frontSideEaseCm=1.5,capHeightCm=5,sleeveLengthCm=26,elbowGirthCm=22,cuffAddCm=4,hemDropCm=1.5,armholeHandle=0.4,capHandle=0.333333", "1: Ⓡ 레코드 기본값 = 책 수치 + 팔꿈치 22 + 핸들(구현 관례)");
  ok(J(rec.inputs.map(i => i.key)) === J(SRA.KEYS) && J(Object.keys(SR.RULES.defaults)) === J(SRA.KEYS), "1: 입력 키 = 엔진 기본값 키 = Apply 키");
  ok(SP.resolve("dolman-sleeve", "bunka-sleeve-R").ok && SP.resolve("dolman-sleeve", "bunka-sleeve-S").ok && SP.family("shirt-sleeve").availability === "available" && SP.resolve("shirt-sleeve", "bunka-sleeve-T").ok, "1: resolve Ⓡ · Ⓢ · 셔츠 Ⓣ 실행 가능");
}

// ── 2. 몸판 Ⓐ 형상 게이트 ──
const P = projectWithBodice(A_ID);
const bodice = P.working.bodiceResult;
const snap = { bodice: J(bodice), ref: J(P.referenceGeometry), front: J(P.working.geometry.front), back: J(P.working.geometry.back) };
{
  const aG = SRA.bodiceAGeometry(P);
  ok(SR.gateBodiceA(bodice, aG).ok, "2: 몸판 Ⓐ 통과");
  const others = []; BP.families().forEach(f => f.variants.forEach(v => { if (v.presetId && v.presetId !== A_ID) others.push(v.presetId); }));
  let rejected = 0, threw = 0, tried = 0;
  others.forEach(id => {
    let pj; try { pj = projectWithBodice(id); } catch (e) { pj = null; }
    if (!pj) return; tried++;
    try { const r = SRA.apply(pj, {}); if (!r.ok && r.reason === "bodice-not-a" && !pj.working.sleeveR) rejected++; } catch (e) { threw++; }
  });
  ok(tried >= 10 && rejected === tried && threw === 0, "2: Ⓐ 외 몸판 전부 거부(bodice-not-a, 상태 무변경) " + rejected + "/" + tried);
  const tamper = JSON.parse(snap.bodice); tamper.front.outline[1].to.x += 0.01;
  const t1 = SR.draftSleeveR(tamper, aG, {});
  ok(!t1.ok && t1.reason === "bodice-not-a" && t1.detail.parts.indexOf("front.outline") >= 0, "2: Ⓐ 형상에서 0.01cm 만 달라도 거부");
  const withPl = JSON.parse(snap.bodice); withPl.placket = { any: 1 };
  ok(SR.draftSleeveR(withPl, aG, {}).reason === "bodice-not-a", "2: 여밈 기록이 있는 Ⓐ 도 거부");
  ok(SR.draftSleeveR(bodice, null, {}).reason === "bodice-a-reference-missing", "2: 비교 형상 없음 → 거부(이름으로 통과시키지 않음)");
  PROJECT = P;
}

// ── 3. 적용 + 책 구성 기하 ──
const r = SRA.apply(P, {}), S = P.working.sleeveR, g = P.working.geometry.sleeve, m = S.meta;
{
  ok(r.ok && S.presetId === "bunka-sleeve-R" && S.bodicePresetId === "bunka-bodice-A" && S.sourceBodiceHash === bodice.hash && S.derivedBodice.front && S.derivedBodice.back, "3: 적용 — Ⓡ 상태 · 출처 hash · 파생 몸판 소유");
  const p = m.settings.inputs;
  ["back", "front"].forEach(pc => {
    const h = m[pc], dl = m.draftLayer[pc], u = { x: (h.E.x - h.spNew.x) / 26, y: (h.E.y - h.spNew.y) / 26 }, n = { x: (h.P.x - h.E.x) / 26, y: (h.P.y - h.E.y) / 26 };
    ok(near(D(h.sp, h.spNew), 5, 1e-9) && near(D(h.spNew, h.E), 26, 1e-9) && near(D(h.spNew, h.W0), 5, 1e-9), "3: " + pc + " 어깨 연장 5 · 소매 길이 26 · 소매 폭선 위치 5");
    ok(near(D(h.E, h.P), 26, 1e-9) && near(u.x * n.x + u.y * n.y, 0, 1e-9), "3: " + pc + " 소맷부리 직선 기준 E→P = ● 26 · 중심선 직각");
    const uw = { x: h.U.x - h.W0.x, y: h.U.y - h.W0.y };
    ok(near((uw.x * u.x + uw.y * u.y), 0, 1e-9) && near(D(h.W0, h.U), h.widthLineCm, 1e-9), "3: " + pc + " 소매 밑점 U = 소매 폭선(직각선) 위");
    const ua = { x: (h.P.x - h.U.x) / D(h.U, h.P), y: (h.P.y - h.U.y) / D(h.U, h.P) };
    ok(near(D(h.P, h.C), 1.5, 1e-9) && near(h.C.x, h.P.x + 1.5 * ua.x, 1e-9) && near(h.C.y, h.P.y + 1.5 * ua.y, 1e-9), "3: " + pc + " C = P 에서 밑선 따라 바깥으로 1.5");
    const sideSeg = bodice[pc].outline.find(s => s.boundary && s.boundary.root === pc + "/side-seam"), sideX = sideSeg.from.x, wl = Math.max(sideSeg.from.y, sideSeg.to.y);
    ok(near(h.S.y, wl, 1e-12) && near(h.S.x, pc === "back" ? sideX + 3 : sideX - 1.5, 1e-12), "3: " + pc + " 진동 아랫점 = WL · 옆 여유 " + (pc === "back" ? "+3" : "−1.5"));
    ok(h.U.y > wl && h.U.y < wl + 1.5 && (pc === "back" ? h.U.x < sideX : h.U.x > sideX), "3: " + pc + " 소매 밑점 = WL 약간 아래 · 옆선 안쪽(도해와 같은 쪽)");
    ok(dl && dl.cap && dl.armhole && dl.crossing, "3: " + pc + " 제도 레이어(표시용) 보유");
  });
  ok(m.backShoulder.closure && m.backShoulder.closure.angleRad < 0 && m.frontDart.sewn === false, "3: 뒤 어깨 다트 닫음 · 앞 AH 다트 박지 않음");
  ok(J(m.unconfirmed).length > 10 && m.unconfirmed.length === 3, "3: 미확인 원리 3건 기록(meta.unconfirmed)");
}

// ── 4. 독립 길이 검산(조밀 점열 4000/cubic — 엔진 Gauss-Legendre 와 별개) ──
{
  const TOL = 2e-3;
  ["back", "front"].forEach(pc => {
    const h = m[pc], dl = m.draftLayer[pc], aP = polyOf(dl.armhole), cP = polyOf(dl.cap);
    ok(near(plen(aP), h.armholeCm, TOL) && near(plen(cP), h.capCm, TOL), "4: " + pc + " 몸판 진동·소매산 전체 길이 독립 일치");
    const la = lenFromNear(aP, h.lower.crossing), lc = lenFromNear(cP, h.lower.crossing);
    ok(near(la, lc, 0.02) && near(la, h.lower.armholeLowerCm, 0.02), "4: " + pc + " 교차점 아래 몸판 진동 = 소매산 (독립 " + la.toFixed(3) + " / " + lc.toFixed(3) + ")");
    ok(Math.abs(h.lower.residualCm) < 1e-6 && Math.abs(h.easeCm) > 1e-4, "4: " + pc + " 아래 구간 잔차 0 · 전체 이세는 강제 0 아님(" + h.easeCm.toFixed(3) + ")");
  });
  // 한 장 소매 실측: 공용 capPrimitives(중심선 x=0 분할) = 엔진 앞·뒤 소매산
  const prim = DS.capPrimitives(g);
  ok(prim && near(prim.lengths.back, m.cap.back, 5e-3) && near(prim.lengths.front, m.cap.front, 5e-3) && near(prim.splitPoint.x, 0, 1e-9) && near(prim.splitPoint.y, 0, 1e-9), "4: 한 장 소매 소매산(공용 실측) = 엔진 · SP 분할");
  const hem = g.outline.find(s => s.role === "hem"), hemLen = plen(polyOf(hem));
  ok(near(hemLen, m.cuff.measuredHemCm, TOL) && near(m.cuff.formulaHemCm, 52, 1e-9) && near(m.cuff.attachCm, 26, 1e-9) && near(m.cuff.gatherActualCm, hemLen - 26, TOL), "4: 소맷부리 실측 " + hemLen.toFixed(3) + " · 식 52 · 커프스 26 · 실제 개더 = 실측 − 26");
  ok(hemLen < 52, "4: 기본값 소맷부리 곡선 < 직선 기준 52(밑선이 중심 쪽으로 좁아져 C 가 P 보다 중심 쪽 — 현 E→C < ●)");
  ["back", "front"].forEach(pc => { const h = m[pc]; ok(D(h.E, h.C) < 26 && near(h.cuffCurveCm, D(h.E, h.C) + (h.cuffCurveCm - D(h.E, h.C)), 1e-12), "4: " + pc + " 현 E→C " + D(h.E, h.C).toFixed(3) + " < ● 26"); });
  const ua = g.outline.filter(s => s.role === "underarm-front" || s.role === "underarm-back").map(s => D(s.from, s.to));
  ok(near(ua[0], m.seams.underarm.front, 1e-9) && near(ua[1], m.seams.underarm.back, 1e-9) && near(m.seams.underarm.diffCm, m.seams.underarm.back - m.seams.underarm.front, 1e-12), "4: 소매 밑선 실측(앞·뒤 차 " + m.seams.underarm.diffCm.toFixed(3) + " — 맞춤 강제 없음)");
  ok(near(m.seams.shoulder.back, D(S.derivedBodice.back.outline[1].from, S.derivedBodice.back.outline[1].to), 1e-9) && near(m.seams.shoulder.front, D(S.derivedBodice.front.outline[1].from, S.derivedBodice.front.outline[1].to), 1e-9), "4: 몸판 어깨 실측 = 파생 몸판 어깨선");
  ok(m.joints.capAtSP < 1e-6 && m.joints.hemAtCenter < 1e-6 && near(m.joints.cuffAtCornerBackDeg, 90, 1e-6) && near(m.joints.cuffAtCornerFrontDeg, 90, 1e-6), "4: 접속 — 소매산·소맷부리 중심 G1 · 소맷부리 끝 밑선 직각");
  const cl = g.construction.find(s => s.role === "center-line");
  ok(cl && near(cl.from.x, 0, 1e-12) && near(cl.to.x, 0, 1e-9) && near(cl.to.y, 26, 1e-9), "4: 앞뒤 중심선 맞댐(x=0, 길이 26)");
}

// ── 5. 자기교차·연결(독립 점열) ──
{
  const segX = (a, b, c, d) => { const o = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x); return (o(c, d, a) > 0) !== (o(c, d, b) > 0) && (o(a, b, c) > 0) !== (o(a, b, d) > 0); };
  const simple = (L) => { for (let i = 0; i < L.length - 1; i++) for (let j = i + 2; j < L.length - 1; j++) { if (i === 0 && j === L.length - 2) continue; if (segX(L[i], L[i + 1], L[j], L[j + 1])) return false; } return true; };
  const chain = (segs) => { const ps = segs.map(s => polyOf(s, 40)); let out = ps[0].slice(), used = [true]; for (let k = 1; k < ps.length; k++) { const end = out[out.length - 1]; let hit = -1, rev = false; ps.forEach((p, i) => { if (used[i] || hit >= 0) return; if (D(p[0], end) < 1e-9) hit = i; else if (D(p[p.length - 1], end) < 1e-9) { hit = i; rev = true; } }); if (hit < 0) return null; used[hit] = true; out = out.concat((rev ? ps[hit].slice().reverse() : ps[hit]).slice(1)); } return out; };
  const sl = chain(g.outline), bb = chain(S.derivedBodice.back.outline), bf = chain(S.derivedBodice.front.outline);
  ok(sl && D(sl[0], sl[sl.length - 1]) < 1e-9 && simple(sl), "5: 한 장 소매 = 끊김 없는 단순 폐곡선");
  ok(bb && bf && D(bb[0], bb[bb.length - 1]) < 1e-9 && D(bf[0], bf[bf.length - 1]) < 1e-9 && simple(bb) && simple(bf), "5: 파생 앞·뒤 몸판 = 끊김 없는 단순 폐곡선");
}

// ── 6. 원본 불변 ──
{
  ok(J(bodice) === snap.bodice && Object.isFrozen(bodice), "6: bodiceResult 무변경(동결)");
  ok(J(P.referenceGeometry) === snap.ref && J(P.working.geometry.front) === snap.front && J(P.working.geometry.back) === snap.back, "6: 원형·작업 몸판 geometry 무변경(파생 몸판은 sleeveR 만 소유)");
  ok(J(S.derivedBodice.back.outline) !== J(bodice.back.outline) && J(S.derivedBodice.front.outline) !== J(bodice.front.outline), "6: 파생 몸판 ≠ 원본(별도 결과)");
  ok(!BC.isCurrentBodiceChanged(P), "6: 몸판 완료본 stale 아님");
}

// ── 7. 완료본 소유 · 무효화 ──
{
  const c = SC.check(P);
  ok(c.ok && c.preset === "bunka-sleeve-R" && c.ease && near(c.ease.back, m.cap.back - m.armhole.back, 5e-3), "7: 완료 게이트 통과 · 이세 = 실측 소매산 − 새 몸판 진동");
  const done = SC.complete(P), res = P.working.sleeveResult || {};
  ok(done.ok && res.origin.presetId === "bunka-sleeve-R" && res.origin.bodicePresetId === "bunka-bodice-A" && J(res.derivedBodice) === J(S.derivedBodice) && Object.isFrozen(res.derivedBodice), "7: 완료본이 파생 몸판 소유(동결)");
  ok(!SC.isCurrentSleeveChanged(P) && !SC.invalidatedByBodice(P), "7: 완료 직후 변경 없음");
  const h0 = res.hash;
  // 입력 변경(팔꿈치 24) → 변경
  ok(SRA.apply(P, { elbowGirthCm: 24 }).ok && SC.isCurrentSleeveChanged(P), "7: 팔꿈치 둘레 변경 → 다시 완료 필요");
  ok(SRA.apply(P, {}).ok && !SC.isCurrentSleeveChanged(P), "7: 원래 입력으로 되돌리면 같은 signature");
  // 파생 몸판만 바꿔치기 → 다시 제도와 불일치
  const saved = J(P.working.sleeveR.derivedBodice); P.working.sleeveR.derivedBodice.back.outline[1].to.x += 0.5;
  ok(SC.check(P).fails.indexOf("sleeve-r-geometry-mismatch") >= 0, "7: 파생 몸판이 다시 제도 결과와 다르면 완료 거부");
  P.working.sleeveR.derivedBodice = JSON.parse(saved);
  // 몸판 변경 → 무효 · 재제도는 Ⓐ 게이트로 차단(다른 몸판을 Ⓐ 로 바꾸지 않음)
  P.working.parameters.body = BP.bodyParams(presetOf("B")); P.working.geometry = DB.computeGeometry(REF, { body: P.working.parameters.body });
  const bc = BC.complete(P);
  ok(bc.ok && P.working.bodiceResult.hash !== h0 && SC.invalidatedByBodice(P), "7: 몸판 변경 → 소매 완료본 무효");
  const rd = SRA.rederive(P);
  ok(!rd.ok && rd.reason === "bodice-not-a" && P.working.sleeveR.blocked && P.working.sleeveR.blocked.reason === "bodice-not-a", "7: 새 몸판(B)으로 재제도 → Ⓐ 게이트 차단");
  ok(!SC.check(P).ok && SC.check(P).fails.indexOf("sleeve-r-blocked") >= 0, "7: 차단 상태는 완료 불가");
}

// ── 8. 입력 거부(clamp·대체 없음) ──
{
  const Q = projectWithBodice(A_ID);
  const e1 = SRA.apply(Q, { armholeHandle: 0.7 });
  ok(!e1.ok && e1.reason === "handle-out-of-range" && !Q.working.sleeveR, "8: 핸들 0.7 → 거부(상태 무변경)");
  const e2 = SRA.apply(Q, { elbowGirthCm: NaN }); ok(!e2.ok && e2.reason === "invalid-input", "8: NaN → 거부");
  const e3 = SRA.apply(Q, { sleeveLengthCm: 4 }); ok(!e3.ok && e3.reason === "input-out-of-range", "8: 소매 길이 ≤ 소매 폭선 위치 → 거부");
  const e4 = SRA.apply(Q, { armholeHandle: 1 / 3 });
  ok(!e4.ok && e4.reason === "underarm-point-not-found" && /교차하지 않습니다/.test(e4.text), "8: 몸판 진동 핸들 1/3 → 앞판 교차점 없음 · 사유와 함께 거부(이세 0 으로 몰래 대체하지 않음)");
}

// ── 9. 스윕(팔꿈치·옆 여유·핸들) ──
{
  let n = 0, good = 0, mono = true, prevHem = -Infinity;
  for (let eg = 18; eg <= 30; eg += 2) {
    const Q = projectWithBodice(A_ID), rr = SRA.apply(Q, { elbowGirthCm: eg }); n++;
    if (rr.ok && rr.state.meta.checks.selfIntersection === false && Math.abs(rr.state.meta.back.lower.residualCm) < 1e-6 && Math.abs(rr.state.meta.front.lower.residualCm) < 1e-6) good++;
    if (rr.ok) { if (!(rr.state.meta.cuff.measuredHemCm > prevHem)) mono = false; prevHem = rr.state.meta.cuff.measuredHemCm; }
  }
  ok(good === n && mono, "9: 팔꿈치 18–30 전부 유효 · 소맷부리 실측 단조 증가");
  let n2 = 0, g2 = 0;
  [[2, 1], [3, 1.5], [4, 2]].forEach(([b, f]) => [0.4, 0.45, 0.5].forEach(ah => [0.3, 1 / 3, 0.4].forEach(ch => {
    const Q = projectWithBodice(A_ID), rr = SRA.apply(Q, { backSideEaseCm: b, frontSideEaseCm: f, armholeHandle: ah, capHandle: ch }); n2++;
    if (rr.ok ? (rr.state.meta.checks.bodiceSelfIntersection === false && Math.abs(rr.state.meta.front.lower.residualCm) < 1e-6) : /underarm-point/.test(rr.reason)) g2++;
  })));
  ok(g2 === n2, "9: 옆 여유 × 핸들 " + n2 + "조합 — 유효하거나 사유 있는 거부(예외·무사유 0)");
}

// ── 10. 표시 모델 ──
{
  const Q = projectWithBodice(A_ID); SRA.apply(Q, {});
  const md = SAN.dolmanBodice(Q);
  ok(md && md.back.cut.length === 7 && md.front.cut.length === 7 && md.back.draft.length === 8 && md.back.marks.map(x => x.id).join() === "X,U,S,SPn,E,C", "10: 몸판 위 표시 모델(재단 외곽 · 제도선 · 점)");
  SRA.reject(Q, { reason: "invalid-input", text: "x" });
  ok(SAN.dolmanBodice(Q) === null && SRA.infoLines(Q).some(t => /차단/.test(t)), "10: 차단이면 표시 모델 없음 · 정보 줄 차단 안내");
  const Z = projectWithBodice(A_ID); ok(SAN.dolmanBodice(Z) === null, "10: Ⓡ 없으면 null(다른 라인 표시 회귀 없음)");
}

// ── 11. 배선 ──
{
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8"), ui = fs.readFileSync(path.join(ROOT, "js", "ui.js"), "utf8"), rd = fs.readFileSync(path.join(ROOT, "js", "render.js"), "utf8");
  const ver = (f) => { const mm = html.match(new RegExp("js/" + f.replace(".", "\\.") + "\\?v=(\\d+)")); return mm ? mm[1] : null; };
  const idx = (f) => html.indexOf("js/" + f + "?v=");
  ok(idx("sleeveQApply.js") < idx("designSleeveR.js") && idx("designSleeveR.js") < idx("sleeveRApply.js") && idx("sleeveRApply.js") < idx("ui.js") && idx("designSleeveA.js") < idx("designSleeveR.js"), "11: 스크립트 순서");
  ok((["ui.js", "sleeveCheckpoint.js"].every(f => ver(f) === "2026102911") && ["sleevePresets.js"].every(f => ver(f) === "2026103001")) && ["designSleeveR.js", "designLayout.js", "sleeveRApply.js"].every(f => ver(f) === "2026102904") && ver("sleeveAnnotation.js") === "2026103001" && ver("render.js") === "2026102906" && /css\/style\.css\?v=2026102907/.test(html), "11: 변경 파일 캐시 버전(Ⓡ 2026102904 · 공용 Ⓢ 연결 2026102907)");
  ok(SRA.KEYS.every(k => { const mm = html.match(new RegExp('id="inpSleeveR_' + k + '"[^>]*value="([^"]+)"')); return mm && Math.abs(Number(mm[1]) - SR.RULES.defaults[k]) < 1e-12; }) && /id="rowSleeveR" hidden/.test(html), "11: 입력칸 10개 · 기본값 = 엔진 기본값 · 기본 숨김");
  ok(/function applySleeveR\(/.test(ui) && /sleeveQOn\(project\) \|\| sleeveROn\(project\)( \|\| sleeveSOn\(project\))?( \|\| sleeveTOn\(project\))?( \|\| sleeveUOn\(project\))?; \}/.test(ui) && /keep !== "R" && window\.sleeveRApply/.test(ui) && /sleeveROn\(project\)\) \{ window\.sleeveRApply\.rederive/.test(ui), "11: ui 연결(적용·배타·재제도)");
  ok(/function _appendDolmanBodice\(/.test(rd) && /dolmanBodice\(dp\)/.test(rd), "11: render 몸판 표시 연결");
}

// ── 12. 표시 보완(2026-10-28): 재단선 상시 · 제도선 토글 · 표시 배치 · 뒤 어깨 비교(형상 보정 없음) ──
{
  const DL = W.designLayout, GAP = 10;
  const bbOf = (segs) => { let b = null; const a = (q) => { if (!b) b = { minX: q.x, minY: q.y, maxX: q.x, maxY: q.y }; else { b.minX = Math.min(b.minX, q.x); b.minY = Math.min(b.minY, q.y); b.maxX = Math.max(b.maxX, q.x); b.maxY = Math.max(b.maxY, q.y); } };
    segs.forEach(sg => { if (sg.kind === "line") { a(sg.from); a(sg.to); } else sg.commands.forEach(c => c.points.forEach(a)); }); return b; };
  const off = (b, o) => ({ minX: b.minX + o.dx, minY: b.minY + o.dy, maxX: b.maxX + o.dx, maxY: b.maxY + o.dy });
  const apart = (a, b) => a.maxX <= b.minX || b.maxX <= a.minX || a.maxY <= b.minY || b.maxY <= a.minY;
  // 12a. A–Q 배치 보존: Ⓡ 없으면 표시 범위 null → autoLayout(geometry) 와 autoLayout(geometry, null) 이 같다
  const Z = projectWithBodice(A_ID); PROJECT = Z;
  ok(SAN.dolmanExtents(Z) === null && J(DL.autoLayout(Z.working.geometry)) === J(DL.autoLayout(Z.working.geometry, SAN.dolmanExtents(Z))), "12: Ⓡ 없으면 표시 범위 없음 · 배치 기존과 같음");
  const Qa = projectWithBodice(A_ID); PROJECT = Qa; const ra = W.sleeveAApply.apply(Qa, { sleeveLengthCm: 52 });
  ok(ra && ra.ok && W.sleeveAApply.isActive(Qa) && SAN.dolmanExtents(Qa) === null && J(DL.autoLayout(Qa.working.geometry)) === J(DL.autoLayout(Qa.working.geometry, SAN.dolmanExtents(Qa))), "12: 다른 소매 라인(Ⓐ) 배치 그대로");
  // 12b. Ⓡ: geometry·hash 는 표시 계산 전후 불변
  const Q = projectWithBodice(A_ID); PROJECT = Q; SRA.apply(Q, {});
  const g0 = J(Q.working.geometry), h0 = Q.working.sleeveR.derivedHash, db0 = J(Q.working.sleeveR.derivedBodice), sig0 = SC.signature ? J(SC.check(Q)) : null;
  const ext = SAN.dolmanExtents(Q), lay = DL.autoLayout(Q.working.geometry, ext), lay0 = DL.autoLayout(Q.working.geometry);
  ok(J(Q.working.geometry) === g0 && Q.working.sleeveR.derivedHash === h0 && J(Q.working.sleeveR.derivedBodice) === db0 && (sig0 === null || J(SC.check(Q)) === sig0), "12: 표시 범위·배치 계산은 geometry·파생 몸판·hash 불변");
  ok(lay.back.dx === lay0.back.dx && lay.back.dy === lay0.back.dy && lay.front.dy === lay0.front.dy && lay.front.dx > lay0.front.dx, "12: Ⓡ 배치는 가로 간격만 넓힘(세로 가슴선 정렬 그대로)");
  // 12c. 겹침 없음: 뒤(재단선∪제도선∪비교 상자) ↔ 앞(재단선∪제도선) ↔ 소매 outline 이 GAP 이상 떨어짐
  const md = SAN.dolmanBodice(Q), sb = DL.outlineBBoxOf(Q.working.geometry, "sleeve");
  const eb = off(ext.back, lay.back), ef = off(ext.front, lay.front), es = off(sb, lay.sleeve);
  ok(ef.minX - eb.maxX >= GAP - 1e-9 && es.minY - Math.max(eb.maxY, ef.maxY) >= 2 * GAP - 1e-9 && Math.abs((es.minX + es.maxX) / 2 - (eb.minX + ef.maxX) / 2) < 1e-9,
    "12: 뒤 ↔ 앞 간격 ≥ " + GAP + " (" + (ef.minX - eb.maxX).toFixed(2) + ") · 한 장 소매는 몸판 아래 줄 가운데(간격 " + (es.minY - Math.max(eb.maxY, ef.maxY)).toFixed(2) + ")");
  ok(apart(off(bbOf(md.back.draft), lay.back), off(DL.outlineBBoxOf(Q.working.geometry, "front"), lay.front)) && apart(off(bbOf(md.front.draft), lay.front), off(DL.outlineBBoxOf(Q.working.geometry, "back"), lay.back)), "12: 소매 반쪽 제도선이 이웃 몸판과 겹치지 않음");
  // 12d. 뒤 어깨 비교: 관찰값만(형상 보정 없음) · 독립 재계산과 일치
  const fig = Q.working.sleeveR.meta.backShoulder.figure, sh = md.back.shoulder, cl = Q.working.sleeveR.meta.backShoulder.closure;
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y }), len = (v) => Math.hypot(v.x, v.y), rotP = (p, c, a) => { const d = sub(p, c); return { x: c.x + d.x * Math.cos(a) - d.y * Math.sin(a), y: c.y + d.x * Math.sin(a) + d.y * Math.cos(a) }; };
  const uu = (v) => ({ x: v.x / len(v), y: v.y / len(v) }), u = uu(sub(fig.spNew, fig.SNP)), crs = (a, b) => a.x * b.y - a.y * b.x;
  const devInd = Math.abs(crs(u, sub(fig.neckMouth, fig.SNP)));
  ok(fig && Math.abs(devInd - fig.neckMouthOffLineCm) < 1e-9 && Math.abs(devInd - 0.53) < 0.01, "12: 목 쪽 입구 직선 이탈 독립 재계산 " + devInd.toFixed(4) + " = meta (≈0.53)");
  ok(len(sub(rotP(fig.spStored, cl.apex, cl.angleRad), fig.spClosed)) < 1e-9 && len(sub(rotP(fig.armMouth, cl.apex, cl.angleRad), fig.armMouthClosed)) < 1e-9 && Math.abs(len(sub(fig.armMouthClosed, fig.neckMouth)) - cl.mouthResidualCm) < 1e-6, "12: 닫은 뒤 = 닫기 전 진동 쪽 구간의 회전(입구 잔여 = closure 잔여)");
  ok(Math.abs(crs(u, sub(fig.spClosed, fig.SNP))) < 1e-9 && Math.abs(len(sub(fig.foot, fig.neckMouth)) - devInd) < 1e-9, "12: 최종 직선은 목옆점 → 닫은 SP → 새 SP 한 직선 · 수선 발 = 이탈 거리");
  const shSeg = Q.working.sleeveR.derivedBodice.back.outline.filter(sg => sg.edge === "shoulder");
  ok(shSeg.length === 1 && shSeg[0].kind === "line" && [shSeg[0].from, shSeg[0].to].some(p => len(sub(p, fig.SNP)) < 1e-9) && [shSeg[0].from, shSeg[0].to].some(p => len(sub(p, fig.spNew)) < 1e-9), "12: 파생 뒤 어깨 재단선 = 목옆점 → 새 SP 직선 그대로(목 쪽 입구로 보정하지 않음)");
  ok(sh && sh.inset.zoom === 10 && sh.inset.lines.length === 5 && sh.lines.map(l => l.cls).join() === "before,before,after,final,dev" && /0\.53 cm/.test(sh.inset.dev.text), "12: 비교 그림 모델(닫기 전 2 · 닫은 뒤 · 최종 직선 · 이탈 수선 · ×10 확대)");
  const cutBB = bbOf(md.back.cut);
  ok(sh.inset.box.maxY < cutBB.minY && apart(sh.inset.box, bbOf(md.back.cut.concat(md.back.draft))) && ext.back.minY <= sh.inset.box.minY, "12: 확대 상자는 파생 몸판 위쪽 빈 자리 · 표시 범위에 포함");
  // 12e. 토글: 재단선은 info 와 무관, 제도선·점·비교는 info 일 때만(render 구조)
  const rd = fs.readFileSync(path.join(ROOT, "js", "render.js"), "utf8");
  const fn = rd.slice(rd.indexOf("function _appendDolmanBodice("), rd.indexOf("// 소매 제작 정보 오버레이(표시 전용)"));
  const iCut = fn.indexOf('"data-dolman-layer":"cut"'), iDraft = fn.indexOf('"data-dolman-layer":"draft"'), iMarks = fn.indexOf('"data-dolman-layer":"marks"'), iSh = fn.indexOf('"data-dolman-layer":"shoulder"');
  const before = (i) => fn.slice(0, i), depth = (i) => (before(i).match(/if\(info\)\{/g) || []).length - (before(i).match(/\n  \}/g) || []).length;
  ok(iCut > 0 && iDraft > 0 && iMarks > 0 && iSh > 0 && depth(iCut) === 0 && depth(iDraft) === 1 && depth(iMarks) === 1, "12: render — 재단선 그룹은 info 밖, 제도선·점·비교는 info 안");
  ok(/_appendDolmanBodice\(grp, _db\[pc\], pc, !_slvInfoChk \|\| _slvInfoChk\.checked\)/.test(rd) && !/dolmanBodice && \(!_slvInfoChk/.test(rd), "12: render 호출은 토글과 무관하게 재단선을 넘기고 info 만 토글");
}

const f2 = (v) => (Math.round(v * 100) / 100).toFixed(2);
// ── 13. 소맷부리 보완(2026-10-28) · 제작 정보(몸판 공정 ①~⑧ · 한 장 소매) ──
{
  const Q = projectWithBodice(A_ID); PROJECT = Q; SRA.apply(Q, {});
  const m = Q.working.sleeveR.meta, g = Q.working.geometry.sleeve, hem = g.outline.find(sg => sg.role === "hem");
  const cubs = []; let cur = hem.commands[0].points[0]; hem.commands.slice(1).forEach(c => { cubs.push([cur].concat(c.points)); cur = c.points[2]; });
  const d1 = (q, t) => { const u = 1 - t; return { x: 3*u*u*(q[1].x-q[0].x)+6*u*t*(q[2].x-q[1].x)+3*t*t*(q[3].x-q[2].x), y: 3*u*u*(q[1].y-q[0].y)+6*u*t*(q[2].y-q[1].y)+3*t*t*(q[3].y-q[2].y) }; };
  const d2 = (q, t) => { const u = 1 - t; return { x: 6*u*(q[2].x-2*q[1].x+q[0].x)+6*t*(q[3].x-2*q[2].x+q[1].x), y: 6*u*(q[2].y-2*q[1].y+q[0].y)+6*t*(q[3].y-2*q[2].y+q[1].y) }; };
  const crs = (a, b) => a.x * b.y - a.y * b.x, un = v => { const l = Math.hypot(v.x, v.y); return { x: v.x / l, y: v.y / l }; };
  // 13a. 독립 곡률: 소맷부리 전체(C_f → E → C_b) 곡률 부호가 한 번도 바뀌지 않음(반쪽 안 · 중심 접속 모두)
  const ks = []; cubs.forEach(q => { for (let k = 0; k <= 2000; k++) ks.push(crs(d1(q, k / 2000), d2(q, k / 2000))); });
  ok(cubs.length === 2 && (ks.every(v => v > 0) || ks.every(v => v < 0)), "13: 소맷부리 곡률 부호 일정(S 굽이 없음 · 독립 2×2001점)");
  ok(Math.abs(un(d1(cubs[0], 1)).y) < 1e-12 && Math.abs(un(d1(cubs[1], 0)).y) < 1e-12, "13: E(중심)에서 접선 = 중심선 직각(G1 · 수평)");
  // 13b. 기준점은 그대로: P = E + ●(중심선 직각) · C = P + 소맷부리 아래 × 밑선 방향 · I 는 기준선 E→P 위
  ["back", "front"].forEach(pc => {
    const sp = m[pc].sleevePoints, sgn = pc === "back" ? -1 : 1, ua = un({ x: sp.P.x - sp.U.x, y: sp.P.y - sp.U.y });
    const Cx = { x: sp.P.x + ua.x * 1.5, y: sp.P.y + ua.y * 1.5 };
    ok(near(sp.E.x, 0, 1e-9) && near(sp.E.y, 26, 1e-9) && near(sp.P.x, sgn * 26, 1e-9) && near(sp.P.y, 26, 1e-9) && D(Cx, sp.C) < 1e-9, "13: " + pc + " E·P(● 26 ⟂)·C(P + 1.5 밑선 연장) 기준점 무변경");
    ok(near(sp.corner.y, 26, 1e-9) && Math.abs(sp.corner.x) > 0 && Math.abs(sp.corner.x) < 26 && near(Math.abs(sp.corner.x), m.cuff.curve[pc].cornerOnGuideCm, 1e-9), "13: " + pc + " 교점 I 는 기준선 E→P 위(" + Math.abs(sp.corner.x).toFixed(3) + ")");
    const q = pc === "back" ? cubs[1] : cubs[0], tEnd = un(pc === "back" ? d1(q, 1) : d1(q, 0));
    ok(Math.abs(tEnd.x * ua.x + tEnd.y * ua.y) < 1e-9, "13: " + pc + " C 에서 밑선 직각");
    ok(m.cuff.curve[pc].sagCm > 0 && m.cuff.curve[pc].sagCm < 1, "13: " + pc + " 현에서 파임 " + m.cuff.curve[pc].sagCm.toFixed(3) + "(변경 전 1.68)");
  });
  ok(near(m.cuff.measuredHemCm, plen(polyOf(hem)), 2e-3) && near(m.cuff.gatherActualCm, m.cuff.measuredHemCm - 26, 1e-9) && near(m.cuff.formulaHemCm, 52, 1e-12), "13: 소맷부리 재계측 " + m.cuff.measuredHemCm.toFixed(3) + " · 실제 개더 " + m.cuff.gatherActualCm.toFixed(3) + " · 식 52");
  ok(near(m.cap.back, 37.48, 0.01) && near(m.cap.front, 37.59, 0.01) && near(m.seams.underarm.back, 25.24, 0.01) && near(m.seams.underarm.front, 25.30, 0.01) && near(m.widthCm, 74.27, 0.01), "13: 소매산·밑선·폭 무변경(소맷부리만 바뀜)");
  // 13c. 충돌 입력: 두 끝 직각선이 앞쪽에서 만나지 않으면 사유와 함께 거부(대칭 핸들로 몰래 대체하지 않음) · 상태 불변
  const g0 = J(Q.working.geometry), s0 = J(Q.working.sleeveR);
  const rj = SRA.apply(Q, { hemDropCm: 0 });
  ok(!rj.ok && rj.reason === "cuff-corner-conflict" && /굽이 하나/.test(rj.text) && J(Q.working.geometry) === g0 && J(Q.working.sleeveR) === s0, "13: 소맷부리 아래 0 → 충돌 거부 · 사유 · 상태 불변");
  let nOk = 0, nRej = 0, bad = 0;
  [0.25, 0.5, 1, 1.5, 2, 3, 5].forEach(hd => [16, 20, 22, 26, 30, 34].forEach(el => [16, 26, 40].forEach(sl => {
    const r = SR.draftSleeveR(BC.latest(Q), SRA.bodiceAGeometry(Q), { hemDropCm: hd, elbowGirthCm: el, sleeveLengthCm: sl });
    if (!r.ok) { if (r.reason) nRej++; else bad++; return; }
    nOk++;
    const hq = r.geometry.outline.find(sg => sg.role === "hem"); let c0 = hq.commands[0].points[0]; const qs = []; hq.commands.slice(1).forEach(c => { qs.push([c0].concat(c.points)); c0 = c.points[2]; });
    const kk = []; qs.forEach(q => { for (let k = 0; k <= 400; k++) kk.push(crs(d1(q, k / 400), d2(q, k / 400))); });
    if (!(kk.every(v => v > 0) || kk.every(v => v < 0))) bad++;
  })));
  ok(bad === 0 && nOk > 100, "13: 스윕 " + (nOk + nRej) + "조합(소맷부리 아래 × 팔꿈치 × 길이) — 유효 " + nOk + "개 모두 S 없음 · 거부 " + nRej + "개 모두 사유");
  // 13d. 제작 정보 — 한 장 소매(buildModel R) · 몸판 공정(anno) : 표시 전용 · geometry/hash 불변
  const h0 = Q.working.sleeveR.derivedHash, sig0 = J(SC.check(Q));
  const md = SAN.buildModel(Q), ids = md ? md.lines.map(l => l.id) : [];
  ok(md && md.line === "R" && ["back", "front", "center", "sp", "cap-back", "cap-front", "ua-back", "ua-front", "x-back", "x-front", "xm-back", "xm-front", "hem", "guide-back", "guide-front"].every(k => ids.indexOf(k) >= 0) && md.dims.map(d => d.id).join() === "len,width", "13: 한 장 소매 제작 정보(뒤/앞 · ◎ 중심 맞댐 · 소매산/밑선/소맷부리 · X 맞춤 · 폭/중심 치수)");
  const tx = md.lines.map(l => l.text).join("\n");
  ok(/솔기 아님/.test(tx) && tx.indexOf("커프스 달림 ● 26.00") >= 0 && tx.indexOf("직선 산식 2● 52.00") >= 0 && tx.indexOf("곡선 실측 " + f2(m.cuff.measuredHemCm)) >= 0 && tx.indexOf("실제 개더 " + f2(m.cuff.gatherActualCm)) >= 0 && tx.indexOf("아래 " + f2(m.back.lower.capLowerCm) + " = 몸판 " + f2(m.back.lower.armholeLowerCm)) >= 0, "13: 커프스 달림 / 직선 산식 / 곡선 실측 / 실제 개더 구분 · X 맞춤 실측 근거");
  ok(near(md.marks.find(k => k.id === "x-back").at.x, m.back.sleevePoints.X.x, 1e-12) && near(md.marks.find(k => k.id === "x-front").at.y, m.front.sleevePoints.X.y, 1e-12), "13: X 맞춤 표시는 엔진 교차점 실측 좌표");
  const dB = SAN.dolmanBodice(Q), aIds = dB.back.anno.lines.map(l => l.id), aTx = dB.back.anno.lines.map(l => l.text).join("\n"), fTx = dB.front.anno.lines.map(l => l.text).join("\n");
  ok(["r1", "r2w", "r2", "r2u", "r3", "r4", "r5", "r5a", "r5c", "r6", "r7", "r8"].every(k => aIds.indexOf(k) >= 0) && /① 어깨 \+5\.00/.test(aTx) && /② 폭선 5\.00/.test(aTx) && /② 소매 중심 26\.00/.test(aTx) && /③ 옆 뒤 \+3\.00/.test(aTx) && /③ 옆 앞 \+1\.50/.test(fTx) && /④ 진동 아랫점\(WL\)/.test(aTx) && /⑥ 어깨 다트 닫음/.test(aTx) && /⑥ AH 다트 박지 않음/.test(fTx) && /⑦ ● 26\.00 ⟂/.test(aTx) && /⑧ \+1\.50/.test(aTx), "13: 몸판 공정 ①~⑧(어깨 +5 · 폭선 5/중심 26 · 옆 3/1.5 · WL · X · 다트 · ● ⟂ · +1.5)");
  ok(aTx.indexOf("⑤ X 아래 " + f2(m.back.lower.armholeLowerCm) + " = " + f2(m.back.lower.capLowerCm) + " ‖") >= 0 && fTx.indexOf("⑤ X 아래 " + f2(m.front.lower.armholeLowerCm) + " = " + f2(m.front.lower.capLowerCm) + " |") >= 0, "13: ⑤ X 아래 길이 · 뒤 ‖ / 앞 | 구분");
  const r1 = dB.back.anno.refs.find(r => r.id === "r1-dim"), ext = D(r1.from, r1.to);
  ok(near(ext, m.settings.inputs.shoulderExtCm, 1e-9) && near(D(dB.back.anno.refs.find(r => r.id === "r7-dim").from, dB.back.anno.refs.find(r => r.id === "r7-dim").to), 26, 1e-9) && near(D(dB.back.anno.refs.find(r => r.id === "r8-dim").from, dB.back.anno.refs.find(r => r.id === "r8-dim").to), 1.5, 1e-9), "13: 치수선 길이 = 실제 좌표 거리(어깨 5 · ● 26 · 1.5)");
  const lay = SAN.layout(dB.back.anno, 11 * 0.6);
  ok(lay && lay.items.length > 10, "13: 몸판 공정 글자 배치 계산");
  ok(Q.working.sleeveR.derivedHash === h0 && J(SC.check(Q)) === sig0 && J(Q.working.geometry) === g0, "13: 제작 정보 계산은 geometry·hash·signature 불변");
  ok(SAN.overhang(Q, 11 * 0.4, { info: true, ref: false }) !== null, "13: fit 용 설명 여백(overhang) 계산 — R 포함");
  SRA.reject(Q, { reason: "invalid-input", text: "x" }); ok(SAN.buildModel(Q) === null, "13: 차단이면 한 장 소매 설명 없음");
}

console.log("══════════════════════════════════════════════");
if (fails.length) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); }
console.log("결과: " + PASS + " PASS / " + FAIL + " FAIL");
if (FAIL) { console.log("[FAILED]"); process.exit(1); }
