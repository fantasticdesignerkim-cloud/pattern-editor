// ══════════════════════════════════════════════
// sleeveZCheck.js — 소매 Ⓩ 프렌치 슬리브 소매길이 12(P.55 아래, 2026-11-04 김님 승인 시안) 전용 회귀:
//   카탈로그 · 승인 scratch 재현(픽스처) · 책 규칙(12 연장 · 경사 없음 · E 직각 · 가이드 E–C 부풀림 0.7/0.3 · C 둥글림 2.5/2 · H 옆선 접선)을
//   최종 외곽 + bodiceResult 에서 독립 계측 · 앞뒤 어깨 / 옆 다트 닫은 옆선 봉제 길이 · 소맷부리 둘레 · 끝 연결각(E 180° · H 360°) ·
//   폐곡선 · 자기교차 · 유한값 · 원래 종이 침범·깎임 없음 · 원본 불변 · 소매 조각 없음(빈 버킷 · 소매산/이세 null) · 입력 스윕 ·
//   불가능 입력 거부 사유 · Ⓐ 외 거부 · 완료/무효화(입력·몸판·파생형상) · X/Y/Z 전환(Ⓨ 결과 무변경) · 배치/표시 겹침 · 배선.
//   ⚠ 독립 계측: 이 파일의 점열·회전 코드로 최종 조립 외곽(derivedBodice)과 bodiceResult 를 다시 잰다 — 엔진 meta 값을 그대로 비교하지 않는다.
//   3D 착용은 검증하지 않는다(평면 변 길이·형상만).
//   node test/harness/sleeveZCheck.js
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
  "designSleeveX.js", "sleeveXApply.js", "designSleeveY.js", "sleeveYApply.js", "designSleeveZ.js", "sleeveZApply.js", "sleeveAnnotation.js"].forEach(load);
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, BC = W.bodiceCheckpoint, SP = W.sleevePresets, SC = W.sleeveCheckpoint, SAN = W.sleeveAnnotation,
  SZ = W.designSleeveZ, SZA = W.sleeveZApply, SYA = W.sleeveYApply, SXA = W.sleeveXApply;
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));
const APPROVED = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "sleeveZApproved.json"), "utf8"));
const Y_APPROVED = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "sleeveYApproved.json"), "utf8"));
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
const polySeg = (s, n = 3001) => { let L = []; cubsOf(s).forEach((q, i) => { L = L.concat(polyQ(q, n).slice(i ? 1 : 0)); }); return L; };   // 엔진(2000·400·80 분할)과 다른 분할
const plen = (p) => { let s = 0; for (let i = 1; i < p.length; i++) s += D(p[i - 1], p[i]); return s; };
const segLen = (s) => plen(polySeg(s));
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
const lineOff = (p, a, b) => Math.abs(cr(sub(b, a), sub(p, a))) / D(a, b);
const deg = r => r * 180 / Math.PI;
const angDeg = (u, v) => deg(Math.acos(Math.max(-1, Math.min(1, dot(unitv(u), unitv(v))))));
const rotp = (p, c, t) => { const d = sub(p, c), ca = Math.cos(t), sa = Math.sin(t); return { x: c.x + d.x * ca - d.y * sa, y: c.y + d.x * sa + d.y * ca }; };
const byRole = (segs, role) => segs.filter(s => s.role === role);
const one = (segs, role) => { const a = byRole(segs, role); return a.length === 1 ? a[0] : null; };
const lenRoles = (segs, roles) => segs.filter(s => roles.indexOf(s.role) >= 0).reduce((a, s) => a + segLen(s), 0);
const finiteDeep = (o) => { let okk = true; JSON.stringify(o, (k, v) => { if (typeof v === "number" && !isFinite(v)) okk = false; return v; }); return okk && !/null/.test(JSON.stringify(o.outline || [])); };
const ends = s => s.kind === "line" ? [s.from, s.to] : [s.commands[0].points[0], s.commands[s.commands.length - 1].points[2]];

// bodiceResult 에서 직접 읽는 원래 형상(독립) — 앞 AH 다트는 이 파일의 회전으로 닫는다
function originalOf(bodice) {
  const B = bodice.back, F = bodice.front;
  const bArm = B.outline.find(s => s.edge === "armhole"), bShA = B.outline.find(s => s.boundary && s.boundary.root === "back/shoulder-armhole");
  const bLegs = B.construction.filter(s => s.kind === "line" && s.dart && s.dart.boundary === "shoulder");
  const bSP = bArm.commands[0].points[0], bShFrom = D(bShA.from, bSP) < 1e-9 ? bShA.to : bShA.from;
  const bSideSeg = B.outline.find(s => s.boundary && s.boundary.root === "back/side-seam"), bse = ends(bSideSeg).slice().sort((u, v) => u.y - v.y);
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
  const sideLen = pc => pc.outline.filter(s => s.boundary && /side-seam/.test(s.boundary.root)).reduce((a, s) => a + segLen(s), 0);
  return { back: { SP: bSP, shFrom: bShFrom, arm: polySeg(bArm), U: polySeg(bArm).slice(-1)[0], sideTop: bse[0], WP: bse[1], loop: chainLoop(B.outline.concat(bLegs), 3001).loop,
      shoulderSewn: B.outline.filter(s => s.edge === "shoulder").reduce((a, s) => a + segLen(s), 0), sideSewn: sideLen(B) },
    front: { SP: fSP, shFrom: fShFrom, arm: fClosedArm, BP: BPt, theta: th, shoulderSewn: segLen(fSh), U: loPts[loPts.length - 1], sideSewn: sideLen(F) } };
}

// ── 1. 카탈로그 ──
{
  const f = SP.family("kimono-sleeve"), r = SP.get("bunka-sleeve-Z");
  ok(f && f.availability === "available" && f.variants.map(v => v.symbol).join() === "X,Y,Z" && SP.resolve("kimono-sleeve", "bunka-sleeve-Z").ok, "1: 기모노 family = Ⓧ·Ⓨ·Ⓩ 실행 가능");
  ok(r && r.methodPage === 55 && J(r.inputs.map(i => i.key)) === J(SZ.KEYS) && J(SZA.keys()) === J(SZ.KEYS) && r.inputs.every(i => i.defaultValue === SZ.RULES.defaults[i.key]), "1: 레코드 입력 = 엔진 키 · 기본값 = 엔진 기본값(소매길이 12 포함)");
  ok(J(SZ.RULES.book) === J({ sleeveLengthCm: 12, bulgeBackCm: 0.7, bulgeFrontCm: 0.3, chordLegCm: 2.5, sideLegCm: 2 }) && J(SZ.RULES.convention) === J({ sideDartDropCm: 3 }), "1: 책 수치(12 · 0.7 · 0.3 · 2.5 · 2)와 구현 관례(옆 다트 3) 구분");
  ok(SP.get("bunka-sleeve-Y").inputs.map(i => i.key).join() === "sleeveLengthCm,dropCm,sideDartDropCm,joinFromBottomCm" && SP.get("bunka-sleeve-Y").inputs[0].defaultValue === 5, "1: Ⓨ 레코드 무변경(소매길이 5 · 내림 0.5 · 합류점)");
}

const P0 = projectWithBodice(A_ID); PROJECT = P0;
const bodice0 = BC.latest(P0), bodiceJ0 = J(bodice0), workJ0 = J({ f: P0.working.geometry.front, b: P0.working.geometry.back }), refJ0 = J(P0.referenceGeometry);
const r0 = SZA.draft(P0, {});
ok(r0.ok, "0: 몸판 Ⓐ · 기본 입력으로 제도(" + (r0.reason || "") + ")");
const bOut = r0.derivedBodice.back.outline, fOut = r0.derivedBodice.front.outline, O = originalOf(bodice0);
// 원형 데이터 잔차(뒤 진동 끝점 ↔ 옆선 위 끝 — 이 파일이 bodiceResult 에서 직접 잰 값 · 원형은 고치지 않는다). 뒤 H 의 옆선 위치·접선 허용은 이 잔차에서만 나온다.
const RES = D(O.back.U, O.back.sideTop);
ok(RES > 0 && RES < 1e-3, "0: 뒤 진동 끝점 ↔ 옆선 위 끝 잔차 " + RES.toExponential(2) + " cm(원형 데이터 · Ⓧ·Ⓨ 와 같은 값)");

// ── 2. 승인 scratch 재현(픽스처 = scratch 산출물) ──
{
  let worst = 0;
  [["back", bOut], ["front", fOut]].forEach(([pc, segs]) => {
    const op = one(segs, "sleeve-opening"), A = APPROVED[pc], q = cubsOf(op);
    [[q[0][0], A.E], [q[0][1], A.P1], [q[0][2], A.P2], [q[0][3], A.T], [q[1][1], A.R1], [q[1][2], A.R2], [q[1][3], A.H]].forEach(([a, b]) => { worst = Math.max(worst, D(a, b)); });
    const ext = one(segs, "shoulder-ext"); worst = Math.max(worst, D(ext.from, A.SP), D(ext.to, A.E));
  });
  ok(worst < 1e-9, "2: SP · E · 곡선 손잡이 · T · 둥글림 손잡이 · H = 승인 시안과 같다(최대 " + worst.toExponential(1) + " cm)");
  const L = APPROVED.lengths, sh = s => lenRoles(s, ["shoulder", "shoulder-ext"]), sd = s => lenRoles(s, ["side-seam"]), opn = s => lenRoles(s, ["sleeve-opening"]);
  const dl = [Math.abs(sh(bOut) - L.shoulderBack), Math.abs(sh(fOut) - L.shoulderFront), Math.abs(sd(bOut) - L.sideBack), Math.abs(sd(fOut) - L.sideFront),
    Math.abs(opn(bOut) - L.openingBack), Math.abs(opn(fOut) - L.openingFront), Math.abs(opn(bOut) + opn(fOut) - L.openingTotal)];
  ok(Math.max.apply(null, dl) < 1.5e-3, "2: 승인 시안 길이(어깨 24.280 · 옆선 35.383 · 소맷부리 합 33.448 — 3자리) 재현 · 최대 차 " + Math.max.apply(null, dl).toFixed(4));
  ok(L.shoulderBack === 24.28 && L.shoulderFront === 24.28 && L.sideBack === 35.383 && L.sideFront === 35.383 && L.openingTotal === 33.448, "2: 픽스처 = 승인 보고 기준값(어깨 양쪽 24.280 · 옆선 양쪽 35.383 · 팔구멍 합 33.448)");
}

// ── 3. 책 규칙 — 최종 외곽 + bodiceResult 에서 독립 계측 ──
const geo = {};
{
  const p = APPROVED.params;
  [["back", bOut], ["front", fOut]].forEach(([pc, segs]) => {
    const o = O[pc], us = unitv(sub(o.SP, o.shFrom)), ext = one(segs, "shoulder-ext"), op = one(segs, "sleeve-opening");
    const E = D(ext.from, o.SP) < 1e-9 ? ext.to : ext.from, ve = sub(E, o.SP);
    ok(D(D(ext.from, o.SP) < 1e-9 ? ext.from : ext.to, o.SP) < 1e-9, "3 " + pc + ": 새 어깨선은 원래 SP 에서 시작");
    ok(Math.abs(dot(ve, us) - p.sleeveLengthCm) < 1e-9 && Math.abs(cr(us, ve)) < 1e-9, "3 " + pc + ": E = SP 에서 어깨선 연장 12 · 끝 내림 없음(경사 없음 — Ⓨ 의 0.5 승계 안 함)");
    const q = cubsOf(op); ok(q.length === 2, "3 " + pc + ": 소맷부리 = E→T 곡선 + T→H 둥글림(2 구간)");
    const C = o.U, T = q[0][3], H = q[1][3];
    ok(D(q[0][0], E) < 1e-12 && Math.abs(angDeg(sub(q[0][1], q[0][0]), ve) - 90) < 1e-7, "3 " + pc + ": E 에서 연장선 직각 출발(" + angDeg(sub(q[0][1], q[0][0]), ve).toFixed(6) + "°)");
    const devs = polyQ(q[0], 3001).map(x => lineOff(x, E, C)), dmax = Math.max.apply(null, devs), want = pc === "back" ? p.bulgeBackCm : p.bulgeFrontCm;
    ok(Math.abs(dmax - want) < 1e-4, "3 " + pc + ": 가이드 E–C(C = 이 파일이 읽은 원래 진동 아랫점)에서 최대 부풀림 " + dmax.toFixed(5) + " = 책 " + want);
    const outward = polyQ(q[0], 50).slice(5, -5).every(x => !inLoop(x, pc === "back" ? o.loop : origFrontLoop()));
    ok(outward, "3 " + pc + ": 부풀림은 바깥(원래 종이 밖)");
    ok(lineOff(T, E, C) < 1e-9 && Math.abs(D(C, T) - p.chordLegCm) < 1e-9, "3 " + pc + ": T = 가이드 위 C 에서 2.5");
    ok(angDeg(sub(q[0][3], q[0][2]), sub(C, E)) < 1e-6 && angDeg(sub(q[1][1], q[1][0]), sub(C, E)) < 1e-6, "3 " + pc + ": T 에서 가이드 접선 · 곡선 접선 연속");
    const side = segs.filter(s => s.role === "side-seam" && ends(s).some(e => D(e, H) < 1e-9));
    ok(side.length === 1, "3 " + pc + ": H 에서 옆선이 이어짐");
    const sd = side[0], far = D(ends(sd)[0], H) < 1e-9 ? ends(sd)[1] : ends(sd)[0];
    const res = pc === "back" ? RES : 0, tanTol = deg(Math.atan(res / D(H, far))) + 1e-6;   // 앞은 잔차 없음(정확) · 뒤는 원형 잔차만큼
    ok(Math.abs(D(C, H) - p.sideLegCm) < 1e-9 && lineOff(H, C, far) < res + 1e-9 && dot(sub(H, C), sub(far, C)) > 0, "3 " + pc + ": H = 옆선 위 C 에서 아래로 2(소맷부리 끝 · 옆선에서 벗어남 " + lineOff(H, C, far).toExponential(1) + " ≤ 원형 잔차)");
    ok(angDeg(sub(q[1][3], q[1][2]), sub(far, H)) < tanTol, "3 " + pc + ": H 에서 옆선 접선(" + angDeg(sub(q[1][3], q[1][2]), sub(far, H)).toExponential(1) + "° ≤ " + tanTol.toExponential(1) + "° — 원형 잔차 몫)");
    ok(angDeg(sub(q[1][3], q[1][2]), sub(H, C)) < 1e-6, "3 " + pc + ": H 접선 = C→H 방향(둥글림 다리 방향 그대로 · acos 정밀도 1e-6°)");
    if (pc === "back") ok(D(C, o.sideTop) < 1e-3 && Math.abs(far.x - o.WP.x) < 1e-9 && D(far, o.WP) < 1e-9, "3 back: C = 원래 겨드랑이점(옆선 위 끝) · H 아래 옆선은 원래 옆선 위");
    geo[pc] = { E, C, T, H, q, ve, far };
  });
  const fdLegs = byRole(fOut, "side-dart"), legLen = fdLegs.map(segLen);
  ok(fdLegs.length === 2 && Math.abs(legLen[0] - legLen[1]) < 1e-9 && Math.abs(deg(Math.abs(O.front.theta)) - APPROVED.frontDart.angleDeg) < 1e-3, "3: 앞 옆 다트 — 두 다리 같은 길이 · 각도 = AH 다트 각(이 파일의 계산 " + deg(Math.abs(O.front.theta)).toFixed(3) + "°)");
  const apexN = fdLegs.map(s => s.from).concat(fdLegs.map(s => s.to)).filter(q => D(q, O.front.BP) < 1e-9).length;
  ok(apexN === 2, "3: 옆 다트 꼭짓점 = BP");
  const legTop = geo.front.far;   // H 아래 옆선이 닿는 점 = 옆 다트 위 다리 입구
  ok(fdLegs.some(s => ends(s).some(e => D(e, legTop) < 1e-9)) && Math.abs(D(geo.front.C, legTop) - 3) < 1e-9 && Math.abs(D(geo.front.H, legTop) - 1) < 1e-9, "3: 앞 옆 다트 위 다리 = 진동 아랫점에서 3(관례) · H 에서 1");
  // 끝 연결각: E 는 앞뒤 직각 합 180°(어깨 봉제선에서 매끈) · H 는 옆선 접선 합 360°(봉제하면 겨드랑이 끝이 뾰족 — 승인 형상)
  const aE = pc => angDeg(sub(O[pc].SP, geo[pc].E), sub(geo[pc].q[0][1], geo[pc].q[0][0])), aH = pc => 180 - angDeg(sub(geo[pc].q[1][3], geo[pc].q[1][2]), sub(geo[pc].far, geo[pc].H));
  ok(Math.abs(aE("back") + aE("front") - 180) < 1e-6, "3: E 연결각 뒤 + 앞 = " + (aE("back") + aE("front")).toFixed(6) + "°(소맷부리가 어깨 봉제선을 꺾임 없이 지남)");
  ok(Math.abs(aH("back") + aH("front") - 360) < deg(Math.atan(RES / D(geo.back.H, geo.back.far))) + 1e-5, "3: H 종이 각 뒤 + 앞 = " + (aH("back") + aH("front")).toFixed(5) + "°(옆선 접선 — 겨드랑이 끝 뾰족 · 승인)");
}
function origFrontLoop() {   // 앞 원래 종이(AH 다트 → 옆 이동 후): 최종 외곽 중 새로 그린 변 제외 + 이 파일이 닫은 원래 진동 + 옆선 위 C → 다트 입구
  if (origFrontLoop.c) return origFrontLoop.c;
  const rest = fOut.filter(s => ["shoulder-ext", "sleeve-opening"].indexOf(s.role) < 0 && !(s.role === "side-seam" && s.kind === "line" && D(s.from, cubsOf(one(fOut, "sleeve-opening"))[1][3]) < 1e-9)).map(s => polySeg(s, 3001));
  const fd = byRole(fOut, "side-dart"), top = fd.map(s => ends(s)).flat().filter(e => D(e, O.front.BP) > 1e-6).sort((a, b) => a.y - b.y)[0];
  return (origFrontLoop.c = loopPts(rest.concat([O.front.arm, [O.front.U, top]])).loop);
}

// ── 4. 봉제 길이 — 서로 다른 경로에서 잰다 ──
{
  const shB = lenRoles(bOut, ["shoulder", "shoulder-ext"]), shF = lenRoles(fOut, ["shoulder", "shoulder-ext"]);
  ok(Math.abs(shB - (O.back.shoulderSewn + 12)) < 1e-6 && Math.abs(shF - (O.front.shoulderSewn + 12)) < 1e-6, "4: 어깨 봉제 = 원래 어깨(bodiceResult · 다트 제외) + 12 — 두 경로 일치");
  ok(Math.abs(shB - shF) < 1e-3, "4: 앞뒤 어깨 봉제 길이 같음(뒤 " + shB.toFixed(3) + " / 앞 " + shF.toFixed(3) + ")");
  const sideB = lenRoles(bOut, ["side-seam"]), sideF = lenRoles(fOut, ["side-seam"]);
  ok(Math.abs(sideB - (O.back.sideSewn - 2)) < 1e-3 && Math.abs(sideF - (O.front.sideSewn - 2)) < 1e-3, "4: 옆선 봉제 = 원래 옆선(bodiceResult) − 2 — 뒤 · 앞(다트 닫은 길이는 회전해도 같음) 두 경로 일치");
  ok(Math.abs(sideB - sideF) < 1e-3, "4: 옆선 봉제(H 아래 · 앞 = 옆 다트 닫은 길이) 뒤 " + sideB.toFixed(3) + " = 앞 " + sideF.toFixed(3));
  const opB = segLen(one(bOut, "sleeve-opening")), opF = segLen(one(fOut, "sleeve-opening")), arm0 = plen(O.back.arm) + plen(O.front.arm);
  ok(Math.abs(opB + opF - r0.meta.seams.opening.total) < 1e-3 && opB + opF < arm0, "4: 소맷부리(새 팔구멍) 둘레 " + (opB + opF).toFixed(3) + " (원래 진동 " + arm0.toFixed(3) + " 보다 짧음)");
}

// ── 5. 폐곡선 · 자기교차 · 유한값 · 원래 종이 침범·깎임 없음 ──
{
  const lb = chainLoop(bOut), lf = chainLoop(fOut);
  ok(lb.gap < 1e-3 && lf.gap < 1e-9, "5: 뒤·앞 외곽 닫힘(최대 틈 뒤 " + lb.gap.toExponential(1) + " / 앞 " + lf.gap.toExponential(1) + ")");
  ok(!selfX(lb.loop) && !selfX(lf.loop), "5: 자기교차 없음");
  ok(finiteDeep({ outline: bOut }) && finiteDeep({ outline: fOut }) && finiteDeep(r0.meta), "5: 모든 좌표·수치 유한");
  const into = (segs, L, tol) => polySeg(one(segs, "sleeve-opening"), 600).filter(x => inLoop(x, L) && dPoly(x, L) > tol).length;
  ok(into(bOut, O.back.loop, RES) === 0 && into(fOut, origFrontLoop(), 1e-6) === 0, "5: 새 곡선은 원래 종이 안으로 들어가지 않음(뒤는 원형 잔차 " + RES.toExponential(1) + " 이내 · 앞 1e-6)");
  const nb = chainLoop(bOut, 300).loop, nf = chainLoop(fOut, 300).loop;
  const cut = (L0, L1) => L0.filter((x, i) => i % 7 === 0).filter(x => !inLoop(x, L1) && dPoly(x, L1) > 1e-3).length;
  ok(cut(O.back.loop, nb) === 0 && cut(origFrontLoop(), nf) === 0, "5: 원래 종이는 전부 새 외곽 안(깎는 부분 없음 — 덧붙이기만)");
  const armIn = (arm, L) => arm.filter((x, i) => i % 9 === 0).every(x => inLoop(x, L) || dPoly(x, L) < 1e-3);
  ok(armIn(O.back.arm, nb) && armIn(O.front.arm, nf), "5: 원래 진동은 전부 새 외곽 안(참고선)");
  ok(byRole(bOut, "shoulder-dart").length === 2 && byRole(fOut, "dart").length === 0, "5: 뒤 어깨 다트는 열린 채 · 앞 AH 다트는 진동에 없음(옆으로 이동)");
}

// ── 6. 원본 불변 · 소매 조각 없음 ──
{
  ok(J(BC.latest(P0)) === bodiceJ0 && J({ f: P0.working.geometry.front, b: P0.working.geometry.back }) === workJ0 && J(P0.referenceGeometry) === refJ0, "6: 제도만으로 bodiceResult · working 앞뒤 · 원형 무변경");
  const g = r0.geometry;
  ok(g && Array.isArray(g.outline) && g.outline.length === 0 && g.construction.length === 0 && g.sleevePiece === false && g.integratedBodice === true, "6: 소매 geometry = 빈 버킷(sleevePiece:false) — 가짜 소매 형상 없음");
  ok(!/capHeight|capLength|easeCm|bicep/i.test(J(r0.meta)) && r0.meta.armhole.easeApplicable === false, "6: 소매산·위팔·이세 수치를 만들지 않음");
  const ry = SYA.draft(P0, {}), qy = cubsOf(one(ry.derivedBodice.back.outline, "sleeve-opening"))[0];
  ok(ry.ok && D(qy[0], Y_APPROVED.back.E) < 1e-12 && D(qy[3], Y_APPROVED.back.J) < 1e-12 && D(qy[1], Y_APPROVED.back.P1) < 1e-12, "6: Ⓩ 를 실어도 Ⓨ 제도 결과 무변경(승인 Ⓨ 픽스처 E · J · 손잡이)");
}

// ── 7. 상태 · 완료 · 무효화 ──
const Q = projectWithBodice(A_ID); PROJECT = Q;
const bodiceJQ = J(BC.latest(Q));
{
  const r = SZA.apply(Q, {});
  ok(r.ok && Q.working.sleeveZ && J(Q.working.geometry.sleeve) === J(r0.geometry), "7: 적용 → working.sleeveZ + 빈 소매 버킷");
  ok(J(Q.working.sleeveZ.parameters) === J(SZ.RULES.defaults) && Q.working.sleeveZ.derivedBodice.back.outline.length === bOut.length, "7: 파생 몸판·매개변수(엔진이 쓴 값) 소유");
  const c = SC.check(Q);
  ok(c.ok && c.capLengths === null && c.ease === null && c._prim.sleevePiece === false, "7: 완료 가능 · 소매산/이세 null(" + c.fails.join(",") + ")");
  const cc = SC.complete(Q), res = Q.working.sleeveResult;
  ok(cc.ok && res.origin.presetId === "bunka-sleeve-Z" && res.origin.methodPage === 55 && res.cap.applicable === false && res.cap.lengths === null && res.cap.ease === null && res.geometry.outline.length === 0, "7: 완료본 origin = Ⓩ(P.55) · cap 적용 안 됨 · 소매 조각 없음");
  ok(Object.isFrozen(res) && res.derivedBodice.front.outline.length === fOut.length && res.sourceBodiceHash === BC.latest(Q).hash && typeof res.hash === "string", "7: 완료본이 파생 몸판 소유 · 불변");
  ok(J(BC.latest(Q)) === bodiceJQ, "7: 적용·완료해도 bodiceResult 무변경");
  ok(SC.isCurrentSleeveChanged(Q) === false && SC.invalidatedByBodice(Q) === false, "7: 완료 직후 변경 없음");
  const S0 = Q.working.sleeveZ.parameters; let inv = 0; const miss = [];
  const bump = { sleeveLengthCm: 1, bulgeBackCm: 0.1, bulgeFrontCm: 0.1, chordLegCm: 0.3, sideLegCm: 0.3, sideDartDropCm: 0.5 };
  SZA.keys().forEach(k => { const p = Object.assign({}, S0); p[k] = +(p[k] + bump[k]).toFixed(4); const rr = SZA.apply(Q, p); if (rr.ok && SC.isCurrentSleeveChanged(Q)) inv++; else miss.push(k + (rr.ok ? "" : ":" + rr.reason)); });
  ok(inv === SZA.keys().length, "7: 입력 6개 각각 바꾸면 «변경됨»(" + inv + " " + miss.join(",") + ")");
  SZA.apply(Q, S0);
  ok(SC.isCurrentSleeveChanged(Q) === false, "7: 같은 입력으로 되돌리면 같은 서명(재적용)");
  const before = J({ g: Q.working.geometry.sleeve, s: Q.working.sleeveZ, r: Q.working.sleeveResult });
  const bad = SZA.apply(Q, { sleeveLengthCm: -1 });
  ok(!bad.ok && bad.reason === "input-out-of-range" && J({ g: Q.working.geometry.sleeve, s: Q.working.sleeveZ, r: Q.working.sleeveResult }) === before, "7: 거부된 적용은 상태·geometry·완료본을 바꾸지 않음");
  SZA.reject(Q, { reason: bad.reason, text: bad.text });
  const cb = SC.check(Q);
  ok(SZA.isBlocked(Q) && !cb.ok && cb.fails.indexOf("sleeve-z-blocked") >= 0 && !SC.complete(Q).ok && Q.working.sleeveResult === res, "7: 차단 → 완료 불가 · 이전 완료본 유지");
  SZA.apply(Q, S0); ok(!SZA.isBlocked(Q) && SC.check(Q).ok, "7: 유효 입력 재적용으로 차단 해제");
  const dj = J(Q.working.sleeveZ.derivedBodice); one(Q.working.sleeveZ.derivedBodice.back.outline, "sleeve-opening").commands[1].points[0].x += 0.01;
  ok(SC.check(Q).fails.indexOf("sleeve-z-geometry-mismatch") >= 0, "7: 파생 몸판 위조 → geometry-mismatch");
  Q.working.sleeveZ.derivedBodice = JSON.parse(dj);
  const mj = J(Q.working.sleeveZ.meta); Q.working.sleeveZ.meta.seams.opening.total += 1;
  ok(SC.check(Q).fails.indexOf("sleeve-z-geometry-mismatch") >= 0, "7: 표시 수치(meta) 위조 → geometry-mismatch");
  Q.working.sleeveZ.meta = JSON.parse(mj);
  Q.working.geometry.sleeve = { outline: [{ kind: "line", from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }], construction: [], integratedBodice: true, sleevePiece: false };
  ok(SC.check(Q).fails.indexOf("sleeve-piece-unexpected") >= 0, "7: 소매 조각이 끼어들면 거부(sleeve-piece-unexpected)");
  Q.working.geometry.sleeve = JSON.parse(J(r0.geometry));
  Q.working.sleeveY = { presetId: "bunka-sleeve-Y" };
  ok(SC.check(Q).fails[0] === "sleeve-line-conflict", "7: Ⓨ · Ⓩ 동시 → 라인 충돌");
  delete Q.working.sleeveY;
  ok(SC.check(Q).ok && SC.isCurrentSleeveChanged(Q) === false, "7: 원상 복구 후 다시 유효 · 서명 같음");
  const P3 = Q; P3.working.parameters.body = BP.bodyParams(presetOf("B")); P3.working.geometry = Object.assign(DB.computeGeometry(REF, { body: P3.working.parameters.body }), { sleeve: P3.working.geometry.sleeve });
  BC.complete(P3);
  ok(SC.invalidatedByBodice(P3) === true && !SC.check(P3).ok, "7: 몸판 다시 완료 → 소매 완료본 무효");
  const rd = SZA.rederive(P3);
  ok(!rd.ok && SZA.isBlocked(P3) && rd.reason === "bodice-not-a", "7: 몸판 변경 후 재제도 → Ⓐ 게이트 차단");
}

// ── 8. 입력 스윕 · 불가능 입력 거부 ──
{
  const P = projectWithBodice(A_ID); PROJECT = P; const reasons = new Set(); let okN = 0, bad = 0, thrown = 0; const badWhy = [];
  const trial = (o) => { let r; try { r = SZA.draft(P, o); } catch (e) { thrown++; return; }
    if (!r.ok) { reasons.add(r.reason); return; }
    okN++; const b = r.derivedBodice.back.outline, f = r.derivedBodice.front.outline, lb = chainLoop(b), lf = chainLoop(f), pp = r.meta.settings.inputs;
    const shape = [b, f].every(s => { const q = cubsOf(one(s, "sleeve-opening")), e = one(s, "shoulder-ext"), sd = s.filter(x => x.role === "side-seam" && ends(x).some(z => D(z, q[1][3]) < 1e-9))[0];
      if (!sd) return false; const far = D(ends(sd)[0], q[1][3]) < 1e-9 ? ends(sd)[1] : ends(sd)[0];
      return Math.abs(angDeg(sub(q[0][1], q[0][0]), sub(e.to, e.from)) - 90) < 1e-6 && angDeg(sub(q[0][3], q[0][2]), sub(q[1][1], q[1][0])) < 1e-5 && angDeg(sub(q[1][3], q[1][2]), sub(far, q[1][3])) < deg(Math.atan(RES / D(q[1][3], far))) + 1e-5
        && Math.abs(segLen(e) - pp.sleeveLengthCm) < 1e-6; });
    const seam = Math.abs(lenRoles(b, ["side-seam"]) - lenRoles(f, ["side-seam"])) < 1e-3 && Math.abs(lenRoles(b, ["shoulder", "shoulder-ext"]) - lenRoles(f, ["shoulder", "shoulder-ext"])) < 1e-3;
    if (lb.gap > 1e-3 || lf.gap > 1e-3 || selfX(lb.loop) || selfX(lf.loop) || !shape || !seam) { bad++; badWhy.push(J(o)); } };
  [11.5, 12, 13, 14, 16].forEach(v => trial({ sleeveLengthCm: v }));
  [0.4, 0.7, 1.0].forEach(v => trial({ bulgeBackCm: v }));
  [0.15, 0.3, 0.5].forEach(v => trial({ bulgeFrontCm: v }));
  [1.5, 2.5, 3.5].forEach(v => trial({ chordLegCm: v }));
  [1, 2, 2.5].forEach(v => trial({ sideLegCm: v }));
  [3, 4, 6].forEach(v => trial({ sideDartDropCm: v }));
  ok(thrown === 0 && bad === 0 && okN >= 18, "8: 입력 스윕 " + okN + "건 유효(폐곡선 · 교차 없음 · E 직각 · T/H 접선 · 12 연장 · 앞뒤 어깨/옆선 같음) · 예외 " + thrown + " · 불량 " + bad + " " + badWhy.slice(0, 3).join(" ") + " · 거부 " + [...reasons].join(","));
  const cases = [[{ sleeveLengthCm: 0 }, "input-out-of-range"], [{ sleeveLengthCm: -5 }, "input-out-of-range"], [{ sleeveLengthCm: NaN }, "invalid-input"], [{ bulgeBackCm: "x" }, "invalid-input"],
    [{ bulgeBackCm: 0 }, "input-out-of-range"], [{ bulgeFrontCm: -0.3 }, "input-out-of-range"], [{ chordLegCm: 0 }, "input-out-of-range"], [{ sideLegCm: 0 }, "input-out-of-range"],
    [{ sideDartDropCm: 0 }, "input-out-of-range"], [{ sideLegCm: 3 }, "side-leg-beyond-dart"], [{ sideDartDropCm: 40, sideLegCm: 2 }, "side-dart-out-of-range"],
    [{ chordLegCm: 30 }, "chord-leg-out-of-range"], [{ bulgeBackCm: 20 }, "bulge-infeasible"],
    [{ sleeveLengthCm: 8 }, "right-angle-inward"], [{ sleeveLengthCm: 10 }, "right-angle-inward"], [{ sleeveLengthCm: 11 }, "bulge-infeasible"]];   // 짧은 소매는 직각 출발이 가이드 안쪽 — 책 공정 불가(B83 · 기본 부풀림)
  const got = cases.map(([o]) => { const r = SZA.draft(P, o); return r.ok ? "OK" : r.reason; });
  ok(cases.every(([o, want], i) => got[i] === want), "8: 불가능 입력은 사유와 함께 거부(" + got.join(",") + ")");
  ok(got.concat([...reasons]).filter(r => r !== "OK").every(r => !SZA.failText({ reason: r }).startsWith("소매 Ⓩ 를 만들 수 없음(")), "8: 모든 거부 사유에 한국어 문구");
  const w = SZA.draft(P, { sleeveLengthCm: 14 }); ok(w.ok && w.warnings.length === 1 && SZA.draft(P, {}).warnings.length === 0, "8: 책 수치 밖 값은 경고(검토되지 않은 값) · 책 값은 경고 없음");
  const PB = projectWithBodice(presetOf("B")); PROJECT = PB; const rb = SZA.draft(PB, {}); PROJECT = P;
  ok(!rb.ok && rb.reason === "bodice-not-a" && /몸판 Ⓐ/.test(rb.text), "8: 몸판 Ⓑ 는 Ⓐ 게이트에서 거부(bodice-not-a)");
  const un = { working: { geometry: {} }, referenceGeometry: REF }; ok(!SZA.draft(un, {}).ok, "8: 완료 몸판 없으면 거부");
}

// ── 9. X / Y / Z 전환 · 소매 조각 없는 배치 · 표시 ──
const P = projectWithBodice(A_ID); PROJECT = P;
{
  const rx = SXA.apply(P, { sleeveLengthCm: 54 }); const gussetN = P.working.geometry.sleeve.outline.length;
  const rz = SZA.apply(P, {}); SXA.clear(P);   // ui.js clearOtherSleeveLines 와 같은 순서(적용 성공 → 다른 라인 해제)
  ok(rx.ok && gussetN === 4 && rz.ok && P.working.geometry.sleeve.outline.length === 0 && !P.working.sleeveX && SC.check(P).ok, "9: Ⓧ → Ⓩ 전환 — 이전 덧천이 남지 않음 · Ⓩ 완료 가능");
  ok(SAN.buildModel(P, { pieces: true }) === null, "9: Ⓩ 는 소매 피스 설명 없음(별도 소매 조각 없음)");
  const ry = SYA.apply(P, {}); SZA.clear(P);
  ok(ry.ok && !P.working.sleeveZ && SC.check(P).ok && cubsOf(one(P.working.sleeveY.derivedBodice.back.outline, "sleeve-opening")).length === 1 && D(P.working.sleeveY.meta.points.back.E, Y_APPROVED.back.E) < 1e-12, "9: Ⓩ → Ⓨ 전환 — Ⓨ 형상 그대로(승인 Ⓨ) · 완료 가능");
  const SAy = SAN.dolmanBodice(P); ok(SAy && SAy.back.anno.line === "Y", "9: Ⓨ 표시로 돌아감(잔상 없음)");
  const rz2 = SZA.apply(P, {}); SYA.clear(P);
  ok(rz2.ok && !P.working.sleeveY && SC.check(P).ok, "9: Ⓨ → Ⓩ 전환 — Ⓩ 완료 가능");
  const DLY = W.designLayout, gg = P.working.geometry, ex = SAN.dolmanExtents(P), LA = DLY.autoLayout(gg, ex);
  ok(ex && ex.sleeveBelow === false && LA && [LA.back, LA.front, LA.sleeve].every(v => isFinite(v.dx) && isFinite(v.dy)) && DLY.outlineBBoxOf(gg, "sleeve") === null, "9: 소매 조각 없는 배치 — 유한값 · 소매 bbox 없음");
  P.working.layout = { back: LA.back, front: LA.front, sleeve: LA.sleeve, collar: { dx: 0, dy: 0 }, placement: { back: "auto", front: "auto", sleeve: "auto", collar: "auto" } };
  const db = SAN.dolmanBodice(P);
  ok(db && db.back && db.front && db.back.cut === P.working.sleeveZ.derivedBodice.back.outline && db.front.draft.length >= 6 && db.back.anno.line === "Z", "9: 몸판 위 표시 = 재단선(파생 외곽) + 참고 공정(점선) 분리");
  const draftRoles = db.front.draft.map(s => s.role).join(",");
  ok(/guide-chord/.test(draftRoles) && /side-original/.test(draftRoles) && /bulge-offset/.test(draftRoles) && /right-angle/.test(draftRoles) && /armhole-original/.test(draftRoles) && /ah-dart-original/.test(draftRoles)
    && ["back", "front"].every(k => db[k].cut.every(s => !/^guide|right-angle|armhole-original|side-original|bulge-offset/.test(s.role))), "9: 참고 공정(가이드·원래 옆선 C→H·부풀림·직각·원래 진동·원래 AH 다트)은 재단선에 섞이지 않음");
  const texts = ["back", "front"].map(k => db[k].anno.lines.map(l => l.text).join(" | ")).join(" || ");
  ok(/소매길이\(어깨 연장\) 12\.00 · 책 · 끝 내림 없음/.test(texts) && /E 직각 90\.00°/.test(texts) && /부풀림 0\.70 \(가이드 E–C 에서 · 책\)/.test(texts) && /부풀림 0\.30 \(가이드 E–C 에서 · 책\)/.test(texts)
    && /T = 가이드 위 C 에서 2\.50 · 책/.test(texts) && /H 소맷부리 끝 = 옆선 아래 C 에서 2\.00 · 책/.test(texts) && /\(관례\)/.test(texts) && /옆 다트/.test(texts)
    && /어깨 봉제 24\.280/.test(texts) && /옆선 봉제 35\.383/.test(texts) && /소맷부리 E → H/.test(texts) && /둘레 합 33\.45/.test(texts) && /원래 진동/.test(texts) && /뒤 어깨 다트는 열린 채/.test(texts), "9: 설명 — 12 · 직각 · 0.7/0.3 · 2.5 · 2 · 관례 · 옆 다트 · 봉제 길이 · 소맷부리 둘레 · 원래 진동(참고)");
  const marks = ["back", "front"].map(k => db[k].anno.marks.map(m => m.id).join(",")).join(";");
  ok(["SP", "E", "C", "T", "H", "bp"].every(id => marks.indexOf(id) >= 0), "9: 점 표시 SP · E · C · T · H · BP");
  // 설명 글자가 다른 피스 위에 놓이지 않음 · 피스끼리 설명이 겹치지 않음 · 한 피스 안 글자끼리 겹치지 않음
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
  ok(onOther.length === 0, "9: Ⓩ 설명 글자가 다른 피스 위에 없음 — 배율 6단계(" + [...new Set(onOther)].slice(0, 3).join(" · ") + ")");
  [1.25, 1.56, 3, 6].forEach(s => {
    const Bx = {}; pcs.forEach(k => { const LY = SAN.layout(db[k].anno, s), dx = LA[k].dx, dy = LA[k].dy; Bx[k] = LY.items.map(it => ({ b: box((it.at.x + dx) * s + it.dx, (it.at.y + dy) * s + it.dy, it.anchor, it.text, it.cls), t: it.text.slice(0, 8) })); });
    Bx.back.forEach(a => Bx.front.forEach(b => { if (ov(a.b, b.b)) cross.push(s + " «" + a.t + "»×«" + b.t + "»"); }));
  });
  ok(cross.length === 0, "9: 뒤·앞 설명 글자끼리 겹치지 않음 — 배율 4단계(" + cross.slice(0, 3).join(" · ") + ")");
  const self = [];
  [1.5, 3, 6].forEach(s => pcs.forEach(pc => { const it = SAN.layout(db[pc].anno, s).items, bx = it.map(t => box(t.at.x * s + t.dx, t.at.y * s + t.dy, t.anchor, t.text, t.cls)); for (let i = 0; i < bx.length; i++) for (let j = i + 1; j < bx.length; j++) if (ov(bx[i], bx[j])) self.push(s + " " + pc + " «" + it[i].text.slice(0, 8) + "»×«" + it[j].text.slice(0, 8) + "»"); }));
  ok(self.length === 0, "9: 한 피스 안 설명 글자끼리 겹치지 않음 — 배율 3단계(" + self.slice(0, 3).join(" · ") + ")");
}

// ── 10. 배선 ──
{
  const ui = fs.readFileSync(path.join(ROOT, "js/ui.js"), "utf8"), html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8"), apply = fs.readFileSync(path.join(ROOT, "js/sleeveZApply.js"), "utf8");
  const ver = f => { const m = new RegExp("js/" + f.replace(".", "\\.") + "\\?v=(\\d+)").exec(html); return m ? m[1] : null; };
  ok(/function sleeveZOn\(project\)/.test(ui) && /sleeveZOn\(project\) \? "Ⓩ"/.test(ui) && /id === "bunka-sleeve-Z" \? "Ⓩ"/.test(ui) && /getElementById\("rowSleeveZ"\)/.test(ui) && /"inpSleeveZ_"/.test(ui) && /isZ \? "Ⓩ"/.test(ui) && /readSleeveTInputs\("Z"\)/.test(ui), "10: 기호 · 칸 표시 · 입력칸 동기화");
  ok(/keep !== "Z" && window\.sleeveZApply\) window\.sleeveZApply\.clear\(project\)/.test(ui) && /clearOtherSleeveLines\(project, "Z"\)/.test(ui) && /sleeveZOn\(project\)\) \{ window\.sleeveZApply\.rederive\(project\)/.test(ui), "10: 라인 배타 해제 · 몸판 변경 시 재제도");
  ok(/const inputsOk = \(sleeveYOn\(project\) \|\| sleeveZOn\(project\)\) \? readNum\("inpSleeveLength", -Infinity, Infinity\)\.valid :/.test(ui), "10: Ⓩ 는 공용 소매길이 10–90 으로 적용 버튼을 잠그지 않음(숫자만 · 범위는 엔진 사유)");
  ok(/"sleeve-z-blocked"/.test(ui) && /"sleeve-z-geometry-mismatch"/.test(ui) && /"sleeve-z-redraft-failed"/.test(ui), "10: 완료 전 검사 사유 문구(Ⓩ)");
  ok(SZ.KEYS.filter(k => k !== "sleeveLengthCm").every(k => html.indexOf('id="inpSleeveZ_' + k + '"') >= 0) && html.indexOf('id="rowSleeveZ" hidden') >= 0 && /책 수치 \(P\.55 아래/.test(html), "10: index.html 입력칸 5개 + 행(rowSleeveZ) · 책/관례 구역 구분");
  const iZ = html.indexOf('src="js/designSleeveZ.js?v='), iZA = html.indexOf('src="js/sleeveZApply.js?v='), iUI = html.indexOf('src="js/ui.js?v='), iT = html.indexOf('src="js/designSleeveT.js?v='), iR = html.indexOf('src="js/sleeveRApply.js?v=');
  ok(iZ > iT && iZ > iR && iZA > iZ && iZA < iUI, "10: 스크립트 순서(Ⓡ·Ⓣ 뒤 · ui 앞)");
  ok(["designSleeveZ.js", "sleeveZApply.js", "ui.js", "sleeveCheckpoint.js", "sleevePresets.js", "sleeveAnnotation.js"].every(f => ver(f) === (f === "ui.js" ? "2026110802" : f === "sleeveCheckpoint.js" ? "2026110604" : f === "sleeveAnnotation.js" ? "2026110404" : "2026110403")) && ["designSleeveY.js", "sleeveYApply.js"].every(f => ver(f) === "2026110402") && ["designSleeveX.js", "sleeveXApply.js"].every(f => ver(f) === "2026110401"), "10: 변경 파일 캐시 버전 2026110403(Ⓨ·Ⓧ 파일은 그대로)");
  ok(!/bodiceResult\s*=/.test(apply) && !/sleeveResult\s*=/.test(apply) && !/localStorage|document\./.test(apply) && !/window\.sleeve[A-Y]Apply\.(apply|clear)/.test(apply), "10: sleeveZApply 는 bodiceResult·sleeveResult 를 쓰지 않고 DOM·storage 미접근 · 다른 라인을 건드리지 않음");
  const eng = fs.readFileSync(path.join(ROOT, "js/designSleeveZ.js"), "utf8");
  ok(!/localStorage|document\.|bodiceResult\s*=/.test(eng) && /ST\.parts\.moveFrontDart/.test(eng) && /SR\.gateBodiceA/.test(eng) && !/designSleeveY/.test(eng.replace(/^\/\/.*$/gm, "")), "10: 엔진은 순수 · Ⓐ 게이트·앞 다트 이동만 재사용(Ⓨ 엔진 미사용)");
}

console.log("══════════════════════════════════════════════");
if (fails.length) { console.log("실패:"); fails.forEach(f => console.log("  ✗ " + f)); }
console.log("결과: " + PASS + " PASS / " + FAIL + " FAIL");
process.exit(FAIL ? 1 : 0);
