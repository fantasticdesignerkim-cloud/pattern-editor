// ══════════════════════════════════════════════
// sleeveYCheck.js — 소매 Ⓨ 프렌치 슬리브(P.55 위, 2026-11-04 김님 승인 시안) 전용 회귀:
//   카탈로그 · 승인 scratch 재현(픽스처) · 책 규칙(5 연장 · 연장선 직각 0.5 · E 직각 · J 접선 · 원래 진동 위 합류)을 최종 외곽 + bodiceResult 에서 독립 계측 ·
//   앞뒤 어깨 / 옆 다트 닫은 옆선 봉제 길이 · 새 팔구멍 둘레 · 폐곡선 · 자기교차 · 유한값 · 원래 종이 침범 없음 · 원본 불변 · 소매 조각 없음(빈 버킷 · 소매산/이세 null) ·
//   입력 스윕 · 불가능 입력 거부 사유 · Ⓐ 외 거부 · 완료/무효화(입력·몸판·파생형상) · X/Y 전환 · 배치/표시 겹침 · 배선.
//   ⚠ 독립 계측: 이 파일의 점열·회전 코드로 최종 조립 외곽(derivedBodice)과 bodiceResult 를 다시 잰다 — 엔진 meta 값을 그대로 비교하지 않는다.
//   3D 착용은 검증하지 않는다(평면 변 길이·형상만).
//   node test/harness/sleeveYCheck.js
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
  "designSleeveA.js", "sleevePresets.js", "sleeveAApply.js", "designSleeveR.js", "sleeveRApply.js",
  "designSleeveT.js", "sleeveTApply.js", "sleeveUApply.js", "designSleeveV.js", "sleeveVApply.js", "designSleeveW.js", "sleeveWApply.js",
  "designSleeveX.js", "sleeveXApply.js", "designSleeveY.js", "sleeveYApply.js", "sleeveAnnotation.js"].forEach(load);
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, BC = W.bodiceCheckpoint, SP = W.sleevePresets, SC = W.sleeveCheckpoint, SAN = W.sleeveAnnotation,
  SY = W.designSleeveY, SYA = W.sleeveYApply, SXA = W.sleeveXApply;
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));
const APPROVED = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "sleeveYApproved.json"), "utf8"));
const MK = (body) => ({ sourceBlock: { id: "blk", version: 2, schemaVersion: 8, canonicalHash: "abc" }, referenceGeometry: JSON.parse(J(REF)),
  working: { geometry: DB.computeGeometry(REF, { body }), parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body },
    patternLines: [], designOutline: null, frontPlacket: null } });
const presetOf = (sym) => { for (const f of BP.families()) for (const v of f.variants) if (v.symbol === sym && v.presetId) return v.presetId; return null; };
function projectWithBodice(id) { PROJECT = MK(BP.bodyParams(id)); const r = BC.complete(PROJECT); return r.ok ? PROJECT : null; }
const A_ID = presetOf("A");

// ── 독립 계측 도구(엔진 코드 미사용) ──
const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y }), dot = (a, b) => a.x * b.x + a.y * b.y, cr = (a, b) => a.x * b.y - a.y * b.x;
const unitv = (a) => { const l = Math.hypot(a.x, a.y); return { x: a.x / l, y: a.y / l }; };
const cub = (q, t) => { const u = 1 - t; return { x: u * u * u * q[0].x + 3 * u * u * t * q[1].x + 3 * u * t * t * q[2].x + t * t * t * q[3].x, y: u * u * u * q[0].y + 3 * u * u * t * q[1].y + 3 * u * t * t * q[2].y + t * t * t * q[3].y }; };
const cubsOf = (s) => { if (s.kind === "line") return [[s.from, s.from, s.to, s.to]]; const o = []; let cur = null; s.commands.forEach(c => { if (c.type === "M") cur = c.points[0]; else { o.push([cur, c.points[0], c.points[1], c.points[2]]); cur = c.points[2]; } }); return o; };
const polyQ = (q, n) => { const a = []; for (let k = 0; k <= n; k++) a.push(cub(q, k / n)); return a; };
const polySeg = (s, n = 3001) => { let L = []; cubsOf(s).forEach((q, i) => { L = L.concat(polyQ(q, n).slice(i ? 1 : 0)); }); return L; };   // 엔진(2000 분할)과 다른 분할
const plen = (p) => { let s = 0; for (let i = 1; i < p.length; i++) s += D(p[i - 1], p[i]); return s; };
const segLen = (s) => plen(polySeg(s));
const ends = (s) => s.kind === "line" ? [s.from, s.to] : [s.commands[0].points[0], s.commands[s.commands.length - 1].points[2]];
const segX = (a, b, c, d) => { const o = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x); const e1 = o(c, d, a), e2 = o(c, d, b), e3 = o(a, b, c), e4 = o(a, b, d); const k = 1e-9; return ((e1 > k && e2 < -k) || (e1 < -k && e2 > k)) && ((e3 > k && e4 < -k) || (e3 < -k && e4 > k)); };
function selfX(L) { const n = L.length - 1; for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) { if (i === 0 && j === n - 1) continue; if (segX(L[i], L[i + 1], L[j], L[j + 1])) return true; } return false; }
function loopPts(polys) {   // 점열 조각들을 끝점으로 이어 닫힌 점열(독립 구현) + 최대 틈
  const rest = polys.map(p => p.slice()); let out = rest.shift(), gap = 0;
  while (rest.length) { const e = out[out.length - 1]; let bi = 0, bd = Infinity, br = false; rest.forEach((p, i) => { const a = D(e, p[0]), b = D(e, p[p.length - 1]); if (a < bd) { bd = a; bi = i; br = false; } if (b < bd) { bd = b; bi = i; br = true; } }); let p = rest.splice(bi, 1)[0]; if (br) p = p.reverse(); gap = Math.max(gap, bd); out = out.concat(p.slice(1)); }
  return { loop: out, gap: Math.max(gap, D(out[0], out[out.length - 1])) };
}
const chainLoop = (segs, n) => loopPts(segs.map(s => polySeg(s, n || 40)));
const inLoop = (p, L) => { let c = false; for (let i = 0, j = L.length - 1; i < L.length; j = i++) { const a = L[i], b = L[j]; if (((a.y > p.y) !== (b.y > p.y)) && (p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x)) c = !c; } return c; };
const dseg = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, dd = dx * dx + dy * dy, t = dd ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / dd)) : 0; return D(p, { x: a.x + dx * t, y: a.y + dy * t }); };
const dPoly = (p, L) => { let m = Infinity; for (let i = 1; i < L.length; i++) m = Math.min(m, dseg(p, L[i - 1], L[i])); return m; };
const deg = r => r * 180 / Math.PI;
const angDeg = (u, v) => deg(Math.acos(Math.max(-1, Math.min(1, dot(unitv(u), unitv(v))))));
const rotp = (p, c, t) => { const d = sub(p, c), ca = Math.cos(t), sa = Math.sin(t); return { x: c.x + d.x * ca - d.y * sa, y: c.y + d.x * sa + d.y * ca }; };
const byRole = (segs, role) => segs.filter(s => s.role === role);
const one = (segs, role) => { const a = byRole(segs, role); return a.length === 1 ? a[0] : null; };
const lenRoles = (segs, roles) => segs.filter(s => roles.indexOf(s.role) >= 0).reduce((a, s) => a + segLen(s), 0);
const finiteDeep = (o) => { let okk = true; JSON.stringify(o, (k, v) => { if (typeof v === "number" && !isFinite(v)) okk = false; return v; }); return okk && !/null/.test(JSON.stringify(o.outline || [])); };

// bodiceResult 에서 직접 읽는 원래 형상(독립)
function originalOf(bodice) {
  const B = bodice.back, F = bodice.front;
  const bArm = B.outline.find(s => s.edge === "armhole"), bShA = B.outline.find(s => s.boundary && s.boundary.root === "back/shoulder-armhole");
  const bLegs = B.construction.filter(s => s.kind === "line" && s.dart && s.dart.boundary === "shoulder");
  const bSP = bArm.commands[0].points[0], bShFrom = D(bShA.from, bSP) < 1e-9 ? bShA.to : bShA.from;
  // 앞: AH 다트 닫기 — 아래 진동 조각을 BP 축으로 돌려 아래 입구를 위 입구에 맞춘다(이 파일의 회전)
  const legs = F.construction.filter(s => s.kind === "line" && s.dart && s.dart.boundary === "armhole");
  const apex = l => l.dart.apexAt === "from" ? l.from : l.to, mouth = l => l.dart.apexAt === "from" ? l.to : l.from;
  const isUp = l => /armhole-upper$/.test(l.dart.attach.root);
  const up = legs.find(isUp), lo = legs.find(l => !isUp(l)), BPt = apex(up);
  const th = Math.atan2(mouth(up).y - BPt.y, mouth(up).x - BPt.x) - Math.atan2(mouth(lo).y - BPt.y, mouth(lo).x - BPt.x);
  const fUp = F.outline.find(s => s.boundary && s.boundary.root === "front/armhole-upper"), fLo = F.outline.find(s => s.boundary && s.boundary.root === "front/armhole-lower");
  const fSh = F.outline.find(s => s.edge === "shoulder");
  let upPts = polySeg(fUp); const fSP = D(upPts[0], mouth(up)) < D(upPts[upPts.length - 1], mouth(up)) ? upPts[upPts.length - 1] : upPts[0];
  if (D(upPts[0], fSP) > 1e-9) upPts = upPts.reverse();
  let loPts = polySeg(fLo).map(p => rotp(p, BPt, th)); if (D(loPts[0], rotp(mouth(lo), BPt, th)) > D(loPts[loPts.length - 1], rotp(mouth(lo), BPt, th))) loPts = loPts.reverse();
  const fClosedArm = upPts.concat(loPts.slice(1));
  const fShFrom = D(fSh.from, fSP) < 1e-9 ? fSh.to : fSh.from;
  return { back: { SP: bSP, shFrom: bShFrom, arm: polySeg(bArm), loop: chainLoop(B.outline.concat(bLegs), 3001).loop, shoulderSewn: B.outline.filter(s => s.edge === "shoulder").reduce((a, s) => a + segLen(s), 0) },
    front: { SP: fSP, shFrom: fShFrom, arm: fClosedArm, BP: BPt, theta: th, shoulderSewn: segLen(fSh), U: loPts[loPts.length - 1] } };
}

// ── 1. 카탈로그 ──
{
  const f = SP.family("kimono-sleeve"), r = SP.get("bunka-sleeve-Y");
  ok(f && f.availability === "available" && f.variants.map(v => v.symbol).join() === "X,Y" && SP.resolve("kimono-sleeve", "bunka-sleeve-Y").ok, "1: 기모노 family = Ⓧ·Ⓨ 실행 가능");
  ok(!SP.get("bunka-sleeve-Z"), "1: Ⓩ(P.55 아래)는 레코드 없음 — 이번 범위 밖");
  ok(r && r.methodPage === 55 && J(r.inputs.map(i => i.key)) === J(SY.KEYS) && J(SYA.keys()) === J(SY.KEYS) && r.inputs.every(i => i.defaultValue === SY.RULES.defaults[i.key]), "1: 레코드 입력 = 엔진 키 · 기본값 = 엔진 기본값(소매길이 5 포함)");
  ok(J(SY.RULES.book) === J({ sleeveLengthCm: 5, dropCm: 0.5 }) && J(SY.RULES.convention) === J({ sideDartDropCm: 3, joinFromBottomCm: 3 }), "1: 책 수치(5 · 0.5)와 구현 관례(옆 다트 3 · 합류점 3) 구분");
}

const P0 = projectWithBodice(A_ID); PROJECT = P0;
const bodice0 = BC.latest(P0), bodiceJ0 = J(bodice0), workJ0 = J({ f: P0.working.geometry.front, b: P0.working.geometry.back }), refJ0 = J(P0.referenceGeometry);
const r0 = SYA.draft(P0, {});
ok(r0.ok, "0: 몸판 Ⓐ · 기본 입력으로 제도(" + (r0.reason || "") + ")");
const bOut = r0.derivedBodice.back.outline, fOut = r0.derivedBodice.front.outline, O = originalOf(bodice0);

// ── 2. 승인 scratch 재현(픽스처 = scratch 산출물) ──
{
  const worst = { pt: 0 };
  [["back", bOut], ["front", fOut]].forEach(([pc, segs]) => {
    const op = one(segs, "sleeve-opening"), A = APPROVED[pc]; const q = cubsOf(op)[0];
    [[q[0], A.E], [q[1], A.P1], [q[2], A.P2], [q[3], A.J]].forEach(([a, b]) => { worst.pt = Math.max(worst.pt, D(a, b)); });
    const ext = one(segs, "shoulder-ext"); worst.pt = Math.max(worst.pt, D(ext.from, A.SP), D(ext.to, A.E));
  });
  ok(worst.pt < 1e-9, "2: 새 어깨 끝 E · 곡선 손잡이 · 합류점 J · SP = 승인 시안과 같다(최대 " + worst.pt.toExponential(1) + " cm)");
  const L = APPROVED.lengths, sh = s => lenRoles(s, ["shoulder", "shoulder-ext"]), sd = s => lenRoles(s, ["side-seam"]), opn = s => lenRoles(s, ["sleeve-opening", "armhole-kept"]);
  const dl = [Math.abs(sh(bOut) - L.shoulder), Math.abs(sh(fOut) - L.shoulderFront), Math.abs(sd(bOut) - L.sideBack), Math.abs(sd(fOut) - L.sideFront),
    Math.abs(opn(bOut) - L.openingBack), Math.abs(opn(fOut) - L.openingFront), Math.abs(opn(bOut) + opn(fOut) - L.openingTotal)];
  ok(Math.max.apply(null, dl) < 1.5e-3, "2: 승인 시안 길이(어깨 · 옆선 · 팔구멍 — 3자리) 재현 · 최대 차 " + Math.max.apply(null, dl).toFixed(4));
}

// ── 3. 책 규칙 — 최종 외곽 + bodiceResult 에서 독립 계측 ──
{
  const p = APPROVED.params;
  [["back", bOut], ["front", fOut]].forEach(([pc, segs]) => {
    const o = O[pc], us = unitv(sub(o.SP, o.shFrom)), ext = one(segs, "shoulder-ext"), op = one(segs, "sleeve-opening"), kept = one(segs, "armhole-kept");
    const E = D(ext.from, o.SP) < 1e-9 ? ext.to : ext.from, ve = sub(E, o.SP);
    ok(D(D(ext.from, o.SP) < 1e-9 ? ext.from : ext.to, o.SP) < 1e-9, "3 " + pc + ": 새 어깨선은 원래 SP 에서 시작(어깨 전체를 다시 그리지 않음)");
    ok(Math.abs(dot(ve, us) - p.sleeveLengthCm) < 1e-9 && Math.abs(Math.abs(cr(us, ve)) - p.dropCm) < 1e-9, "3 " + pc + ": E = SP 에서 어깨선 연장 5 · 연장선 직각 0.5");
    const nb = { x: -us.y, y: us.x }, down = nb.y > 0 ? nb : { x: us.y, y: -us.x };
    ok(dot(ve, down) > 0.49, "3 " + pc + ": 0.5 는 아래(몸 쪽)로 내림");
    ok(Math.abs(angDeg(sub(o.SP, o.shFrom), ve) - deg(Math.atan(p.dropCm / p.sleeveLengthCm))) < 1e-9, "3 " + pc + ": SP 방향 변화 = atan(0.5/5) ≈ 5.71°(보고한 상태 유지)");
    const q = cubsOf(op)[0], qk = cubsOf(kept)[0];
    ok(D(q[0], E) < 1e-12 && Math.abs(angDeg(sub(q[1], q[0]), ve) - 90) < 1e-7, "3 " + pc + ": E 에서 새 어깨선 직각 출발(" + angDeg(sub(q[1], q[0]), ve).toFixed(6) + "°)");
    ok(D(q[3], qk[0]) < 1e-12 && angDeg(sub(q[3], q[2]), sub(qk[1], qk[0])) < 1e-6, "3 " + pc + ": J 에서 남긴 진동과 접선 연속");
    const kp = polySeg(kept), dk = kp.reduce((m, x) => Math.max(m, dPoly(x, o.arm)), 0);
    ok(dk < 2e-4, "3 " + pc + ": J 아래 남긴 진동 = 원래 진동(" + (pc === "front" ? "AH 다트 닫은 · 이 파일의 회전 · " : "") + "최대 이탈 " + dk.toExponential(1) + ")");
    ok(Math.abs(plen(kp) - p.joinFromBottomCm) < 5e-3, "3 " + pc + ": J = 진동 아랫점에서 호 3(" + plen(kp).toFixed(4) + ")");
    const U = kp[kp.length - 1], Uo = pc === "back" ? o.arm[o.arm.length - 1] : o.U;
    ok(D(U, Uo) < 1e-6, "3 " + pc + ": 진동 아랫점(겨드랑이)은 원래 자리");
  });
  const fdLegs = byRole(fOut, "side-dart").map(segLen);
  ok(fdLegs.length === 2 && Math.abs(fdLegs[0] - fdLegs[1]) < 1e-9 && Math.abs(deg(Math.abs(O.front.theta)) - APPROVED.frontDart.angleDeg) < 1e-3, "3: 앞 옆 다트 — 두 다리 같은 길이(닫으면 맞음) · 각도 = AH 다트 각(이 파일의 계산 " + deg(Math.abs(O.front.theta)).toFixed(3) + "°)");
  const apex = byRole(fOut, "side-dart").map(s => s.from).concat(byRole(fOut, "side-dart").map(s => s.to)).filter(q => D(q, O.front.BP) < 1e-9).length;
  ok(apex === 2, "3: 옆 다트 꼭짓점 = BP");
}

// ── 4. 봉제 길이 — 서로 다른 경로에서 잰다 ──
{
  const shB = lenRoles(bOut, ["shoulder", "shoulder-ext"]), shF = lenRoles(fOut, ["shoulder", "shoulder-ext"]);
  const extB = segLen(one(bOut, "shoulder-ext")), extF = segLen(one(fOut, "shoulder-ext"));
  ok(Math.abs(shB - (O.back.shoulderSewn + extB)) < 1e-6 && Math.abs(shF - (O.front.shoulderSewn + extF)) < 1e-6, "4: 어깨 봉제 = 원래 어깨(bodiceResult · 다트 제외) + 연장 — 두 경로 일치");
  ok(Math.abs(shB - shF) < 1e-3, "4: 앞뒤 어깨 봉제 길이 같음(뒤 " + shB.toFixed(3) + " / 앞 " + shF.toFixed(3) + ")");
  const sideB = lenRoles(bOut, ["side-seam"]), sideF = lenRoles(fOut, ["side-seam"]);
  const sideOrigB = bodice0.back.outline.filter(s => s.boundary && /side-seam/.test(s.boundary.root)).reduce((a, s) => a + segLen(s), 0);
  ok(Math.abs(sideB - sideOrigB) < 1e-6, "4: 뒤 옆선 = 원래 뒤 옆선(bodiceResult)");
  ok(Math.abs(sideB - sideF) < 1e-3, "4: 옆선 봉제(앞 = 옆 다트 닫은 길이) 뒤 " + sideB.toFixed(3) + " = 앞 " + sideF.toFixed(3));
  const opB = lenRoles(bOut, ["sleeve-opening", "armhole-kept"]), opF = lenRoles(fOut, ["sleeve-opening", "armhole-kept"]), arm0 = plen(O.back.arm) + plen(O.front.arm);
  ok(Math.abs(opB + opF - r0.meta.seams.opening.total) < 1e-3 && opB + opF < arm0, "4: 새 팔구멍 둘레 " + (opB + opF).toFixed(3) + " (원래 진동 " + arm0.toFixed(3) + " 보다 짧음 — 소매가 진동 오목부를 가로지름)");
}

// ── 5. 폐곡선 · 자기교차 · 유한값 · 원래 종이 침범 없음 ──
{
  const lb = chainLoop(bOut), lf = chainLoop(fOut);
  ok(lb.gap < 1e-3 && lf.gap < 1e-9, "5: 뒤·앞 외곽 닫힘(최대 틈 뒤 " + lb.gap.toExponential(1) + " — 원형 데이터 잔차 / 앞 " + lf.gap.toExponential(1) + ")");
  ok(!selfX(lb.loop) && !selfX(lf.loop), "5: 자기교차 없음");
  ok(finiteDeep({ outline: bOut }) && finiteDeep({ outline: fOut }) && finiteDeep(r0.meta), "5: 모든 좌표·수치 유한");
  // 원래 종이: 뒤 = bodiceResult 외곽 + 어깨 다트 다리 · 앞 = 최종 외곽 중 진동 외 변 + 이 파일이 닫은 원래 진동
  const fRest = fOut.filter(s => ["shoulder-ext", "sleeve-opening", "armhole-kept"].indexOf(s.role) < 0).map(s => polySeg(s, 3001));
  const fOrigLoop = loopPts(fRest.concat([O.front.arm])).loop;
  const into = (segs, L) => { const op = cubsOf(one(segs, "sleeve-opening"))[0], Jp = op[3]; return polyQ(op, 600).slice(1, -1).filter(x => inLoop(x, L) && dPoly(x, L) > 1e-6 && D(x, Jp) > 1e-3).length; };
  ok(into(bOut, O.back.loop) === 0 && into(fOut, fOrigLoop) === 0, "5: 새 곡선은 원래 종이 안으로 들어가지 않음(종이를 덧붙이기만)");
  ok(byRole(bOut, "shoulder-dart").length === 2 && byRole(fOut, "dart").length === 0, "5: 뒤 어깨 다트는 열린 채 · 앞 AH 다트는 진동에 없음(옆으로 이동)");
}

// ── 6. 원본 불변 · 소매 조각 없음 ──
{
  ok(J(BC.latest(P0)) === bodiceJ0 && J({ f: P0.working.geometry.front, b: P0.working.geometry.back }) === workJ0 && J(P0.referenceGeometry) === refJ0, "6: 제도만으로 bodiceResult · working 앞뒤 · 원형 무변경");
  const g = r0.geometry;
  ok(g && Array.isArray(g.outline) && g.outline.length === 0 && g.construction.length === 0 && g.sleevePiece === false && g.integratedBodice === true, "6: 소매 geometry = 빈 버킷(sleevePiece:false) — 가짜 소매 형상 없음");
  const mj = J(r0.meta);
  ok(!/capHeight|capLength|easeCm|bicep/i.test(mj) && r0.meta.armhole.easeApplicable === false, "6: 소매산·위팔·이세 수치를 만들지 않음");
}

// ── 7. 상태 · 완료 · 무효화 ──
const Q = projectWithBodice(A_ID); PROJECT = Q;
const bodiceJQ = J(BC.latest(Q));
{
  const r = SYA.apply(Q, {});
  ok(r.ok && Q.working.sleeveY && J(Q.working.geometry.sleeve) === J(r0.geometry), "7: 적용 → working.sleeveY + 빈 소매 버킷");
  ok(J(Q.working.sleeveY.parameters) === J(SY.RULES.defaults) && Q.working.sleeveY.derivedBodice.back.outline.length === bOut.length, "7: 파생 몸판·매개변수(엔진이 쓴 값) 소유");
  const c = SC.check(Q);
  ok(c.ok && c.capLengths === null && c.ease === null && c._prim.sleevePiece === false, "7: 완료 가능 · 소매산/이세 null(" + c.fails.join(",") + ")");
  const cc = SC.complete(Q), res = Q.working.sleeveResult;
  ok(cc.ok && res.origin.presetId === "bunka-sleeve-Y" && res.origin.methodPage === 55 && res.cap.applicable === false && res.cap.lengths === null && res.cap.ease === null && res.geometry.outline.length === 0, "7: 완료본 origin = Ⓨ(P.55) · cap 적용 안 됨 · 소매 조각 없음");
  ok(Object.isFrozen(res) && res.derivedBodice.front.outline.length === fOut.length && res.sourceBodiceHash === BC.latest(Q).hash && typeof res.hash === "string", "7: 완료본이 파생 몸판 소유 · 불변");
  ok(J(BC.latest(Q)) === bodiceJQ, "7: 적용·완료해도 bodiceResult 무변경");
  ok(SC.isCurrentSleeveChanged(Q) === false && SC.invalidatedByBodice(Q) === false, "7: 완료 직후 변경 없음");
  const S0 = Q.working.sleeveY.parameters; let inv = 0; const miss = [];
  SYA.keys().forEach(k => { const p = Object.assign({}, S0); p[k] = +(p[k] + (k === "dropCm" ? 0.1 : 0.4)).toFixed(4); const rr = SYA.apply(Q, p); if (rr.ok && SC.isCurrentSleeveChanged(Q)) inv++; else miss.push(k + (rr.ok ? "" : ":" + rr.reason)); });
  ok(inv === SYA.keys().length, "7: 입력 4개 각각 바꾸면 «변경됨»(" + inv + " " + miss.join(",") + ")");
  SYA.apply(Q, S0);
  ok(SC.isCurrentSleeveChanged(Q) === false, "7: 같은 입력으로 되돌리면 같은 서명(재적용)");
  const before = J({ g: Q.working.geometry.sleeve, s: Q.working.sleeveY, r: Q.working.sleeveResult });
  const bad = SYA.apply(Q, { sleeveLengthCm: -1 });
  ok(!bad.ok && bad.reason === "input-out-of-range" && J({ g: Q.working.geometry.sleeve, s: Q.working.sleeveY, r: Q.working.sleeveResult }) === before, "7: 거부된 적용은 상태·geometry·완료본을 바꾸지 않음");
  SYA.reject(Q, { reason: bad.reason, text: bad.text });
  const cb = SC.check(Q);
  ok(SYA.isBlocked(Q) && !cb.ok && cb.fails.indexOf("sleeve-y-blocked") >= 0 && !SC.complete(Q).ok && Q.working.sleeveResult === res, "7: 차단 → 완료 불가 · 이전 완료본 유지");
  SYA.apply(Q, S0); ok(!SYA.isBlocked(Q) && SC.check(Q).ok, "7: 유효 입력 재적용으로 차단 해제");
  const dj = J(Q.working.sleeveY.derivedBodice); one(Q.working.sleeveY.derivedBodice.back.outline, "sleeve-opening").commands[1].points[0].x += 0.01;
  ok(SC.check(Q).fails.indexOf("sleeve-y-geometry-mismatch") >= 0, "7: 파생 몸판 위조 → geometry-mismatch");
  Q.working.sleeveY.derivedBodice = JSON.parse(dj);
  Q.working.geometry.sleeve = { outline: [{ kind: "line", from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }], construction: [], integratedBodice: true, sleevePiece: false };
  ok(SC.check(Q).fails.indexOf("sleeve-piece-unexpected") >= 0, "7: 소매 조각이 끼어들면 거부(sleeve-piece-unexpected)");
  Q.working.geometry.sleeve = JSON.parse(J(r0.geometry));
  Q.working.sleeveX = { presetId: "bunka-sleeve-X" };
  ok(SC.check(Q).fails[0] === "sleeve-line-conflict", "7: Ⓧ · Ⓨ 동시 → 라인 충돌");
  delete Q.working.sleeveX;
  ok(SC.check(Q).ok, "7: 원상 복구 후 다시 유효");
  const P3 = Q; P3.working.parameters.body = BP.bodyParams(presetOf("B")); P3.working.geometry = Object.assign(DB.computeGeometry(REF, { body: P3.working.parameters.body }), { sleeve: P3.working.geometry.sleeve });
  BC.complete(P3);
  ok(SC.invalidatedByBodice(P3) === true && !SC.check(P3).ok, "7: 몸판 다시 완료 → 소매 완료본 무효");
  const rd = SYA.rederive(P3);
  ok(!rd.ok && SYA.isBlocked(P3) && rd.reason === "bodice-not-a", "7: 몸판 변경 후 재제도 → Ⓐ 게이트 차단");
}

// ── 8. 입력 스윕 · 불가능 입력 거부 ──
{
  const P = projectWithBodice(A_ID); PROJECT = P; const reasons = new Set(); let okN = 0, bad = 0, thrown = 0; const badWhy = [];
  const trial = (o) => { let r; try { r = SYA.draft(P, o); } catch (e) { thrown++; return; }
    if (!r.ok) { reasons.add(r.reason); return; }
    okN++; const b = r.derivedBodice.back.outline, f = r.derivedBodice.front.outline, lb = chainLoop(b), lf = chainLoop(f);
    const rightE = [b, f].every(s => { const q = cubsOf(one(s, "sleeve-opening"))[0], e = one(s, "shoulder-ext"); return Math.abs(angDeg(sub(q[1], q[0]), sub(e.to, e.from)) - 90) < 1e-6; });
    const tanJ = [b, f].every(s => { const q = cubsOf(one(s, "sleeve-opening"))[0], k = cubsOf(one(s, "armhole-kept"))[0]; return angDeg(sub(q[3], q[2]), sub(k[1], k[0])) < 1e-5; });
    const seam = Math.abs(lenRoles(b, ["side-seam"]) - lenRoles(f, ["side-seam"])) < 1e-3 && Math.abs(lenRoles(b, ["shoulder", "shoulder-ext"]) - lenRoles(f, ["shoulder", "shoulder-ext"])) < 1e-3;
    if (lb.gap > 1e-3 || lf.gap > 1e-3 || selfX(lb.loop) || selfX(lf.loop) || !rightE || !tanJ || !seam) { bad++; badWhy.push(J(o)); } };
  [2, 3, 4, 5, 6, 8, 10].forEach(v => trial({ sleeveLengthCm: v }));
  [0, 0.3, 0.5, 0.8, 1.2].forEach(v => trial({ dropCm: v }));
  [2, 3, 4, 6].forEach(v => trial({ sideDartDropCm: v }));
  [1, 1.5, 2, 2.5, 3, 3.5, 3.8].forEach(v => trial({ joinFromBottomCm: v }));
  ok(thrown === 0 && bad === 0 && okN >= 18, "8: 입력 스윕 " + okN + "건 유효(폐곡선 · 교차 없음 · E 직각 · J 접선 · 앞뒤 어깨/옆선 같음) · 예외 " + thrown + " · 불량 " + bad + " " + badWhy.slice(0, 3).join(" ") + " · 거부 " + [...reasons].join(","));
  const cases = [[{ sleeveLengthCm: 0 }, "input-out-of-range"], [{ sleeveLengthCm: -5 }, "input-out-of-range"], [{ sleeveLengthCm: NaN }, "invalid-input"], [{ dropCm: "x" }, "invalid-input"],
    [{ dropCm: -0.5 }, "input-out-of-range"], [{ sideDartDropCm: 0 }, "input-out-of-range"], [{ sideDartDropCm: 40 }, "side-dart-out-of-range"], [{ joinFromBottomCm: 0 }, "input-out-of-range"],
    [{ joinFromBottomCm: 30 }, "join-out-of-range"], [{ dropCm: 40 }, null]];
  const got = cases.map(([o]) => { const r = SYA.draft(P, o); return r.ok ? "OK" : r.reason; });
  ok(cases.every(([o, want], i) => want ? got[i] === want : got[i] !== "OK"), "8: 불가능 입력은 사유와 함께 거부(" + got.join(",") + ")");
  ok(got.filter(r => r !== "OK").every(r => !SYA.failText({ reason: r }).startsWith("소매 Ⓨ 를 만들 수 없음(")), "8: 모든 거부 사유에 한국어 문구");
  const w5 = SYA.draft(P, { sleeveLengthCm: 8 }); ok(w5.ok && w5.warnings.length === 1 && SYA.draft(P, {}).warnings.length === 0, "8: 책 수치 밖 값은 경고(검토되지 않은 값) · 책 값은 경고 없음");
  const PB = projectWithBodice(presetOf("B")); PROJECT = PB; const rb = SYA.draft(PB, {}); PROJECT = P;
  ok(!rb.ok && rb.reason === "bodice-not-a" && /몸판 Ⓐ/.test(rb.text), "8: 몸판 Ⓑ 는 Ⓐ 게이트에서 거부(bodice-not-a)");
  const un = { working: { geometry: {} }, referenceGeometry: REF }; ok(!SYA.draft(un, {}).ok, "8: 완료 몸판 없으면 거부");
}

// ── 9. X ↔ Y 전환 · 소매 조각 없는 배치 · 표시 ──
const P = projectWithBodice(A_ID); PROJECT = P;
{
  const rx = SXA.apply(P, { sleeveLengthCm: 54 }); const gussetN = P.working.geometry.sleeve.outline.length;
  const ry = SYA.apply(P, {}); SXA.clear(P);   // ui.js clearOtherSleeveLines 와 같은 순서(적용 성공 → 다른 라인 해제)
  ok(rx.ok && gussetN === 4 && ry.ok && P.working.geometry.sleeve.outline.length === 0 && !P.working.sleeveX && SC.check(P).ok, "9: Ⓧ → Ⓨ 전환 — 이전 덧천이 남지 않음 · Ⓨ 완료 가능");
  ok(SAN.buildModel(P, { pieces: true }) === null, "9: Ⓨ 는 소매 피스 설명 없음(별도 소매 조각 없음)");
  const rx2 = SXA.apply(P, { sleeveLengthCm: 54 }); W.sleeveYApply.clear(P);
  ok(rx2.ok && P.working.geometry.sleeve.outline.length === 4 && SC.check(P).ok, "9: Ⓨ → Ⓧ 전환 — 덧천 다시 생김 · Ⓧ 완료 가능");
  W.sleeveXApply.clear(P); SYA.apply(P, {});
  const DLY = W.designLayout, gg = P.working.geometry, ex = SAN.dolmanExtents(P), LA = DLY.autoLayout(gg, ex);
  ok(ex && ex.sleeveBelow === false && LA && [LA.back, LA.front, LA.sleeve].every(v => isFinite(v.dx) && isFinite(v.dy)) && DLY.outlineBBoxOf(gg, "sleeve") === null, "9: 소매 조각 없는 배치 — 유한값 · 소매 bbox 없음");
  P.working.layout = { back: LA.back, front: LA.front, sleeve: LA.sleeve, collar: { dx: 0, dy: 0 }, placement: { back: "auto", front: "auto", sleeve: "auto", collar: "auto" } };
  const db = SAN.dolmanBodice(P);
  ok(db && db.back && db.front && db.back.cut === P.working.sleeveY.derivedBodice.back.outline && db.front.draft.length >= 5 && db.back.anno.line === "Y", "9: 몸판 위 표시 = 재단선(파생 외곽) + 참고 공정(점선) 분리");
  const draftRoles = db.front.draft.map(s => s.role).join(",");
  ok(/guide-extension/.test(draftRoles) && /guide-drop/.test(draftRoles) && /right-angle/.test(draftRoles) && /armhole-original/.test(draftRoles) && /ah-dart-original/.test(draftRoles) && db.front.cut.every(s => !/^guide|right-angle|armhole-original/.test(s.role)), "9: 참고 공정(연장·내림·직각·원래 진동·원래 AH 다트)은 재단선에 섞이지 않음");
  const texts = ["back", "front"].map(k => db[k].anno.lines.map(l => l.text).join(" | ")).join(" || ");
  ok(/소매길이\(어깨 연장\) 5\.00 · 책/.test(texts) && /0\.50 ⟂ 연장선 · 책/.test(texts) && /직각 90\.00°/.test(texts) && /J 합류/.test(texts) && /\(관례\)/.test(texts) && /옆 다트/.test(texts) && /어깨 봉제/.test(texts) && /옆선 봉제/.test(texts) && /새 팔구멍/.test(texts) && /팔구멍 둘레 합/.test(texts) && /원래 진동/.test(texts), "9: 표시 — SP/5 연장/0.5 직각/E 직각/J/옆 다트/봉제 길이/팔구멍 둘레 · 책/관례 구분");
  const marks = ["back", "front"].map(k => db[k].anno.marks.map(m => m.id).join(",")).join(";");
  ok(/SP/.test(marks) && /K/.test(marks) && /E/.test(marks) && /J/.test(marks) && /bp/.test(marks), "9: 점 표시 SP · K · E · J · BP");
  // 설명 글자가 다른 피스 위에 놓이지 않음 · 피스끼리 설명이 겹치지 않음
  const FSZ = { title: 12, side: 13, note: 8.5 }, fz = c => FSZ[c] || 9;
  const box = (x, y, an, t, c) => { const f = fz(c); let w = 0; for (let i = 0; i < t.length; i++) w += (t.charCodeAt(i) > 255 ? 1 : 0.58) * f; const x0 = an === "end" ? x - w : an === "middle" ? x - w / 2 : x; return { x0, x1: x0 + w, y0: y - f * 0.85 - 1, y1: y + f * 0.2 + 1 }; };
  const ov = (a, b) => a.x0 < b.x1 - 0.5 && b.x0 < a.x1 - 0.5 && a.y0 < b.y1 - 0.5 && b.y0 < a.y1 - 0.5;
  const ub = (a, b) => b ? { minX: Math.min(a.minX, b.minX), minY: Math.min(a.minY, b.minY), maxX: Math.max(a.maxX, b.maxX), maxY: Math.max(a.maxY, b.maxY) } : a;
  const pcs = ["back", "front"], ar = k => ub(DLY.outlineBBoxOf(gg, k), ex[k]);
  const b2 = {}; pcs.forEach(k => { const b = ar(k); b2[k] = { minX: b.minX + LA[k].dx, maxX: b.maxX + LA[k].dx }; });
  ok(b2.back.maxX < b2.front.minX, "9: 배치 — 뒤 | 앞 가로로 나뉘어 겹치지 않음(연장 소매 포함)");
  const onOther = [], cross = [];
  [1.5, 2.2, 3, 4.5, 6, 9].forEach(s => pcs.forEach(pc => {
    const other = pcs.filter(k => k !== pc).map(k => { const b = ar(k), dx = LA[k].dx - LA[pc].dx, dy = LA[k].dy - LA[pc].dy; return { k, x0: (b.minX + dx) * s, x1: (b.maxX + dx) * s, y0: (b.minY + dy) * s, y1: (b.maxY + dy) * s }; });
    SAN.layout(db[pc].anno, s).items.forEach(it => { const bx = box(it.at.x * s + it.dx, it.at.y * s + it.dy, it.anchor, it.text, it.cls); other.forEach(o => { if (ov(bx, o)) onOther.push(s + " " + pc + "→" + o.k + " «" + it.text.slice(0, 12) + "»"); }); });
  }));
  ok(onOther.length === 0, "9: Ⓨ 설명 글자가 다른 피스 위에 없음 — 배율 6단계(" + [...new Set(onOther)].slice(0, 3).join(" · ") + ")");
  [1.25, 1.56, 3, 6].forEach(s => {
    const Bx = {}; pcs.forEach(k => { const LY = SAN.layout(db[k].anno, s), dx = LA[k].dx, dy = LA[k].dy; Bx[k] = LY.items.map(it => ({ b: box((it.at.x + dx) * s + it.dx, (it.at.y + dy) * s + it.dy, it.anchor, it.text, it.cls), t: it.text.slice(0, 8) })); });
    Bx.back.forEach(a => Bx.front.forEach(b => { if (ov(a.b, b.b)) cross.push(s + " «" + a.t + "»×«" + b.t + "»"); }));
  });
  ok(cross.length === 0, "9: 뒤·앞 설명 글자끼리 겹치지 않음 — 배율 4단계(" + cross.slice(0, 3).join(" · ") + ")");
  const self = [];
  [1.5, 3, 6].forEach(s => pcs.forEach(pc => { const it = SAN.layout(db[pc].anno, s).items.map(t => box(t.at.x * s + t.dx, t.at.y * s + t.dy, t.anchor, t.text, t.cls)); for (let i = 0; i < it.length; i++) for (let j = i + 1; j < it.length; j++) if (ov(it[i], it[j])) self.push(s + " " + pc + " " + i + "×" + j); }));
  ok(self.length === 0, "9: 한 피스 안 설명 글자끼리 겹치지 않음 — 배율 3단계(" + self.slice(0, 3).join(" · ") + ")");
}

// ── 10. 배선 ──
{
  const ui = fs.readFileSync(path.join(ROOT, "js/ui.js"), "utf8"), html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8"), apply = fs.readFileSync(path.join(ROOT, "js/sleeveYApply.js"), "utf8");
  const ver = f => { const m = new RegExp("js/" + f.replace(".", "\\.") + "\\?v=(\\d+)").exec(html); return m ? m[1] : null; };
  ok(/function sleeveYOn\(project\)/.test(ui) && /sleeveYOn\(project\) \? "Ⓨ"/.test(ui) && /id === "bunka-sleeve-Y" \? "Ⓨ"/.test(ui) && /getElementById\("rowSleeveY"\)/.test(ui) && /"inpSleeveY_"/.test(ui) && /isY \? "Ⓨ"/.test(ui), "10: 기호 · 칸 표시 · 입력칸 동기화");
  ok(/keep !== "Y" && window\.sleeveYApply\) window\.sleeveYApply\.clear\(project\)/.test(ui) && /clearOtherSleeveLines\(project, "Y"\)/.test(ui) && /sleeveYOn\(project\)\) \{ window\.sleeveYApply\.rederive\(project\)/.test(ui), "10: 라인 배타 해제 · 몸판 변경 시 재제도");
  ok(/const inputsOk = sleeveYOn\(project\) \? readNum\("inpSleeveLength", -Infinity, Infinity\)\.valid :/.test(ui), "10: Ⓨ 는 공용 소매길이 10–90 으로 적용 버튼을 잠그지 않음(소매길이 5 · 범위는 엔진 사유)");
  ok(SY.KEYS.filter(k => k !== "sleeveLengthCm").every(k => html.indexOf('id="inpSleeveY_' + k + '"') >= 0) && html.indexOf('id="rowSleeveY" hidden') >= 0 && /책 수치 \(P\.55/.test(html) && /구현 관례 \(책에 수치 없음/.test(html), "10: index.html 입력칸 3개 + 행(rowSleeveY) · 책/관례 구역 구분");
  const iY = html.indexOf('src="js/designSleeveY.js?v='), iYA = html.indexOf('src="js/sleeveYApply.js?v='), iUI = html.indexOf('src="js/ui.js?v='), iT = html.indexOf('src="js/designSleeveT.js?v='), iR = html.indexOf('src="js/sleeveRApply.js?v=');
  ok(iY > iT && iY > iR && iYA > iY && iYA < iUI, "10: 스크립트 순서(Ⓡ·Ⓣ 뒤 · ui 앞)");
  ok(["designSleeveY.js", "sleeveYApply.js", "ui.js", "sleeveCheckpoint.js", "sleevePresets.js", "sleeveAnnotation.js"].every(f => ver(f) === "2026110402") && ["designSleeveX.js", "sleeveXApply.js"].every(f => ver(f) === "2026110401"), "10: 변경 파일 캐시 버전 2026110402(Ⓧ 파일은 그대로)");
  ok(!/bodiceResult\s*=/.test(apply) && !/sleeveResult\s*=/.test(apply) && !/localStorage|document\./.test(apply) && !/window\.sleeve[A-XZ]Apply\.(apply|clear)/.test(apply), "10: sleeveYApply 는 bodiceResult·sleeveResult 를 쓰지 않고 DOM·storage 미접근 · 다른 라인을 건드리지 않음");
  const eng = fs.readFileSync(path.join(ROOT, "js/designSleeveY.js"), "utf8");
  ok(!/localStorage|document\.|bodiceResult\s*=/.test(eng) && /designSleeveT|ST\.parts\.moveFrontDart/.test(eng) && /SR\.gateBodiceA/.test(eng), "10: 엔진은 순수 · Ⓐ 게이트·앞 다트 이동만 재사용");
}

console.log("══════════════════════════════════════════════");
if (fails.length) { console.log("실패:"); fails.forEach(f => console.log("  ✗ " + f)); }
console.log("결과: " + PASS + " PASS / " + FAIL + " FAIL");
process.exit(FAIL ? 1 : 0);
