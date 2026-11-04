// ══════════════════════════════════════════════
// sleeveVCheck.js — 소매 Ⓥ 래글런(P.52 · 제도 방법 P.142–143 · 닫는다 P.160, 김님 확정 시안 2026-11-01) 전용 회귀:
//   카탈로그 · 승인 시안과 기본형상 독립 비교(픽스처) · 소매 달림선 전체/구간 봉제길이 독립 검산(몸판 = 소매) · 중심 솔기 앞뒤 차 보존(0.016 — 보정 금지) ·
//   폐곡선 · 자기교차 · 곡선 연결(G1) · 봉제 상태 연결각 · 스윕 · 원본 불변 · Ⓐ 게이트 · 입력/몸판 무효화 · 거부 시 상태 보존 · 완료본 구조 ·
//   카라 목둘레 계약(길이 보존 · 한계) · 표시(겹침 없음) · 배선.
//   node test/harness/sleeveVCheck.js
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
  "designSleeveT.js", "sleeveTApply.js", "sleeveUApply.js", "designSleeveV.js", "sleeveVApply.js", "sleeveAnnotation.js"].forEach(load);
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, BC = W.bodiceCheckpoint, SP = W.sleevePresets, SC = W.sleeveCheckpoint, SAN = W.sleeveAnnotation,
  SV = W.designSleeveV, SVA = W.sleeveVApply, ST = W.designSleeveT, STA = W.sleeveTApply, SUA = W.sleeveUApply, SRA = W.sleeveRApply;
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));
const APPROVED = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "sleeveVApproved.json"), "utf8"));
const MK = (body) => ({ sourceBlock: { id: "blk", version: 2, schemaVersion: 8, canonicalHash: "abc" }, referenceGeometry: JSON.parse(J(REF)),
  working: { geometry: DB.computeGeometry(REF, { body }), parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body },
    patternLines: [], designOutline: null, frontPlacket: null } });
const presetOf = (sym) => { for (const f of BP.families()) for (const v of f.variants) if (v.symbol === sym && v.presetId) return v.presetId; return null; };
function projectWithBodice(id) { PROJECT = MK(BP.bodyParams(id)); const r = BC.complete(PROJECT); return r.ok ? PROJECT : null; }
const A_ID = presetOf("A");
const SL = 54;

// ── 독립 계측 도구(엔진 코드 미사용) ──
const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y }), dot = (a, b) => a.x * b.x + a.y * b.y, cr = (a, b) => a.x * b.y - a.y * b.x;
const unitv = (a) => { const l = Math.hypot(a.x, a.y); return { x: a.x / l, y: a.y / l }; };
const cub = (q, t) => { const u = 1 - t; return { x: u * u * u * q[0].x + 3 * u * u * t * q[1].x + 3 * u * t * t * q[2].x + t * t * t * q[3].x, y: u * u * u * q[0].y + 3 * u * u * t * q[1].y + 3 * u * t * t * q[2].y + t * t * t * q[3].y }; };
const cubsOf = (s) => { if (s.kind === "line") return [[s.from, s.from, s.to, s.to]]; const o = []; let cur = null; s.commands.forEach(c => { if (c.type === "M") cur = c.points[0]; else { o.push([cur, c.points[0], c.points[1], c.points[2]]); cur = c.points[2]; } }); return o; };
const polyQ = (q, n = 2000) => { const a = []; for (let k = 0; k <= n; k++) a.push(cub(q, k / n)); return a; };
const polySeg = (s, n = 2000) => { let L = []; cubsOf(s).forEach((q, i) => { L = L.concat(polyQ(q, n).slice(i ? 1 : 0)); }); return L; };
const plen = (p) => { let s = 0; for (let i = 1; i < p.length; i++) s += D(p[i - 1], p[i]); return s; };
const segLen = (s) => plen(polySeg(s));
const near = (a, b, t) => Math.abs(a - b) <= t;
const nearSeg = (pts, p) => { let m = Infinity; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], dx = pts[i].x - a.x, dy = pts[i].y - a.y, dd = dx * dx + dy * dy, t = dd ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / dd)) : 0; m = Math.min(m, D(p, { x: a.x + dx * t, y: a.y + dy * t })); } return m; };
const haus = (A, B) => { let m = 0; A.forEach(p => m = Math.max(m, nearSeg(B, p))); B.forEach(p => m = Math.max(m, nearSeg(A, p))); return m; };
const arcTo = (pts, p) => {   // 점열 위 최근접 사영 → 시작부터 호 길이 · 사영 거리
  let best = { off: Infinity, s: 0 }, acc = 0;
  for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], dx = pts[i].x - a.x, dy = pts[i].y - a.y, dd = dx * dx + dy * dy, t = dd ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / dd)) : 0, q = { x: a.x + dx * t, y: a.y + dy * t }, d = D(p, q);
    if (d < best.off) best = { off: d, s: acc + Math.sqrt(dd) * t }; acc += Math.sqrt(dd); }
  return best;
};
const segX = (a, b, c, d) => { const o = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x); const e1 = o(c, d, a), e2 = o(c, d, b), e3 = o(a, b, c), e4 = o(a, b, d); return ((e1 > 0 && e2 < 0) || (e1 < 0 && e2 > 0)) && ((e3 > 0 && e4 < 0) || (e3 < 0 && e4 > 0)); };
function selfX(L) { const n = L.length - 1; for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) { if (i === 0 && j === n - 1) continue; if (segX(L[i], L[i + 1], L[j], L[j + 1])) return true; } return false; }
function chainLoop(segs) {   // 조각들을 끝점으로 이어 닫힌 점열(독립 구현)
  const left = segs.map(s => polySeg(s, 40)); let pts = left.shift(), gap = 0;
  while (left.length) { const e = pts[pts.length - 1]; let bi = 0, bd = Infinity, rv = false; left.forEach((p, i) => { const d0 = D(p[0], e), d1 = D(p[p.length - 1], e); if (d0 < bd) { bd = d0; bi = i; rv = false; } if (d1 < bd) { bd = d1; bi = i; rv = true; } });
    gap = Math.max(gap, bd); let p = left.splice(bi, 1)[0]; if (rv) p = p.slice().reverse(); pts = pts.concat(p.slice(1)); }
  return { loop: pts, gap: Math.max(gap, D(pts[0], pts[pts.length - 1])) };
}
const tanStart = q => unitv(D(q[1], q[0]) > 1e-12 ? sub(q[1], q[0]) : sub(q[2], q[0])), tanEnd = q => unitv(D(q[3], q[2]) > 1e-12 ? sub(q[3], q[2]) : sub(q[3], q[1]));
const deg = r => r * 180 / Math.PI;
const innerDeg = (u, v) => deg(Math.acos(Math.max(-1, Math.min(1, dot(u, v)))));

// ── 1. 카탈로그 ──
{
  const f = SP.family("raglan-sleeve"), r = SP.get("bunka-sleeve-V");
  ok(f && f.availability === "available" && SP.resolve("raglan-sleeve", "bunka-sleeve-V").ok, "1: 래글런 family 실행 가능 · resolve Ⓥ");
  ok(r && r.methodPage === 52 && J(r.inputs.map(i => i.key)) === J(SV.KEYS) && r.inputs[0].defaultValue === undefined, "1: 레코드 입력 키 = 엔진 KEYS · 소매길이 기본값 없음");
  ok(r.inputs.slice(1).every(i => SV.RULES.defaults[i.key] === i.defaultValue), "1: 레코드 기본값 = 엔진 기본값(책 7 + 시안 14)");
  ok(!SP.get("bunka-sleeve-Z"), "1: 다음 라인(기모노 Ⓩ — 레코드 없음)은 보류 유지");
  ok(J(Object.keys(SV.RULES.book)) === J(["slopeRunCm", "backSlopeDropCm", "frontSlopeDropCm", "capHeightRatio", "sideDartDropCm", "frontBulgeCm", "cuffRatio"])
    && SV.RULES.book.backSlopeDropCm === 3.4 && SV.RULES.book.frontSlopeDropCm === 4 && SV.RULES.book.capHeightRatio === 0.75 && SV.RULES.book.frontBulgeCm === 0.6, "1: 책 수치(P.52 뒤 3.4 / 앞 4 · 3/4 · 0.6)");
}

// ── 2. 기본형상 = 승인 시안(픽스처 — 김님 확정 그림의 원 데이터) ──
const P0 = projectWithBodice(A_ID);
const bodice0 = BC.latest(P0), bodiceJ0 = J(bodice0), geoFB0 = J({ f: P0.working.geometry.front, b: P0.working.geometry.back });
const d0 = SV.draftSleeveV(bodice0, SRA.bodiceAGeometry(P0), { sleeveLengthCm: SL });
ok(d0.ok, "2: B83 · 소매길이 54 제도 성공 " + (d0.reason || ""));
const m0 = d0.meta, dl0 = d0.meta.draftLayer;
{
  const slv = pc => [].concat(...["sleeveRaglan", "sleeveNeck", "sleeveTop", "sleeveCuff", "sleeveUnderarm"].map(k => polySeg(dl0[pc][k], 200)));
  const bod = pc => [].concat(...d0.derivedBodice[pc].outline.map(s => polySeg(s, 200)));
  const hs = { sleeveBack: haus(slv("back"), APPROVED.pieces.sleeveBack), sleeveFront: haus(slv("front"), APPROVED.pieces.sleeveFront),
    bodiceBack: haus(bod("back"), APPROVED.pieces.bodiceBack), bodiceFront: haus(bod("front"), APPROVED.pieces.bodiceFront) };
  ok(Object.values(hs).every(v => v < 0.02), "2: 승인 시안과 형상 최대 거리 < 0.02cm(0.2mm) — " + Object.entries(hs).map(([k, v]) => k + " " + v.toFixed(4)).join(" · "));
}

// ── 3. 봉제 길이 독립 검산(몸판 = 소매 · 구간 · 중심 솔기 차 보존) ──
{
  const N = APPROVED.numbers;
  ["back", "front"].forEach(pc => {
    const body = d0.derivedBodice[pc].outline.find(s => s.edge === "raglan"), bodyPts = polySeg(body), slvPts = polySeg(dl0[pc].sleeveRaglan);
    const bl = plen(bodyPts), sl = plen(slvPts);
    ok(near(bl, sl, 2e-4) && near(bl, N.raglan[pc], 3e-3), "3: " + pc + " 소매 달림선 몸판 " + bl.toFixed(4) + " = 소매 " + sl.toFixed(4) + " (승인 " + N.raglan[pc] + ")");
    const nb = m0.draftLayer.notches[pc], st = dl0[pc].star;
    const b1 = arcTo(bodyPts, nb.body), b2 = arcTo(bodyPts, st), s1 = arcTo(slvPts, nb.sleeve), s2 = arcTo(slvPts, st);
    const segB = [b1.s, b2.s - b1.s, bl - b2.s], segS = [s1.s, s2.s - s1.s, sl - s2.s];
    ok(b1.off < 1e-3 && b2.off < 1e-3 && s1.off < 1e-3 && s2.off < 1e-3, "3: " + pc + " 맞춤 ① · ★ 이 달림선 위(몸판·소매)");
    ok(segB.every((v, i) => near(v, segS[i], 3e-3)) && segB.every((v, i) => near(v, N.segments[pc][i], 4e-3)), "3: " + pc + " 구간 목→①→★→아랫점 몸판 " + segB.map(v => v.toFixed(3)).join("/") + " = 소매 " + segS.map(v => v.toFixed(3)).join("/") + " (승인 " + N.segments[pc].join("/") + ")");
    const slvGeo = d0.geometry.outline.find(s => s.role === "raglan" && s.piece === pc);
    ok(near(segLen(slvGeo), sl, 1e-6), "3: " + pc + " 소매 좌표로 옮겨도 길이 같음(회전)");
  });
  const cB = segLen(d0.geometry.outline.find(s => s.role === "center-seam" && s.piece === "back")), cF = segLen(d0.geometry.outline.find(s => s.role === "center-seam" && s.piece === "front"));
  ok(near(cB, N.center.back, 1.5e-3) && near(cF, N.center.front, 1.5e-3) && near(cB - cF, N.center.diff, 1e-3) && cB - cF > 0.01, "3: 중심 솔기 뒤 " + cB.toFixed(4) + " · 앞 " + cF.toFixed(4) + " — 차 " + (cB - cF).toFixed(4) + " 보존(보정 없음 · 0 으로 만들지 않음)");
  ok(near(m0.seams.center.diffCm, cB - cF, 1e-5), "3: meta 중심 솔기 차 = 독립 실측");
  const ua = pc => segLen(d0.geometry.outline.find(s => s.role === "underarm" && s.piece === pc)), cu = pc => segLen(d0.geometry.outline.find(s => s.role === "hem" && s.piece === pc));
  ok(near(ua("back"), N.underarm.back, 2e-3) && near(ua("front"), N.underarm.front, 2e-3) && near(ua("back"), ua("front"), 1e-3), "3: 소매 밑선 뒤 " + ua("back").toFixed(4) + " = 앞 " + ua("front").toFixed(4));
  ok(near(cu("back"), N.cuff.back, 2e-3) && near(cu("front"), N.cuff.front, 2e-3), "3: 소맷부리 뒤 " + cu("back").toFixed(3) + " · 앞 " + cu("front").toFixed(3));
  ok(near(m0.backDart.legGapCm, N.legGap, 1e-3) && near(m0.backDart.angleDeg, N.backDartDeg, 0.01) && near(m0.capHeight.cm, N.capHeight, 1e-3), "3: 다리 끝 차 0.103 · 닫는 각 13.82° · ◉ 12.795");
  ok(near(m0.lower.back.armholeDigBelowMCm, N.armholeDigReported.back, 0.01) && near(m0.lower.front.armholeDigFromStarCm, N.armholeDigReported.front, 0.015)
    && m0.lower.back.armholeDigFromStarCm > 1.3 && m0.lower.front.armholeDigBelowMCm < 0.6, "3: 진동 파임 — 시안 보고 뒤 0.64(= M 아래) · 앞 2.10(= ★ 부터) · 정의별 기록(뒤 ★부터 " + m0.lower.back.armholeDigFromStarCm.toFixed(2) + " · 앞 M 아래 " + m0.lower.front.armholeDigBelowMCm.toFixed(2) + ")");
}

// ── 4. 폐곡선 · 자기교차 · 두 장(겹침 없음) ──
{
  ["back", "front"].forEach(pc => {
    const L = chainLoop(d0.geometry.outline.filter(s => s.piece === pc));
    ok(L.gap < 1e-6 && !selfX(L.loop), "4: " + pc + " 소매 폐곡선(틈 " + L.gap.toExponential(1) + ") · 자기교차 없음");
    const B = chainLoop(d0.derivedBodice[pc].outline);
    ok(B.gap < 1e-6 && !selfX(B.loop), "4: " + pc + " 파생 몸판 폐곡선(틈 " + B.gap.toExponential(1) + ") · 자기교차 없음");
  });
  const xb = d0.geometry.outline.filter(s => s.piece === "back").map(s => polySeg(s, 200)).flat().map(p => p.x), xf = d0.geometry.outline.filter(s => s.piece === "front").map(s => polySeg(s, 200)).flat().map(p => p.x);
  ok(Math.max(...xb) < Math.min(...xf) - 1, "4: 두 장 소매가 따로 놓임(중심 솔기 — 맞댄 한 장 아님)");
  ok(d0.geometry.outline.filter(s => s.role === "center-seam").length === 2 && d0.geometry.centerSeam === true && !d0.geometry.outline.some(s => s.role === "cap"), "4: 중심 솔기 두 변 · 소매산(cap) 역할 없음");
}

// ── 5. 곡선 연결(G1) · 봉제 상태 연결각 ──
{
  const g1 = (s) => { const c = cubsOf(s); let m = 0; for (let i = 1; i < c.length; i++) m = Math.max(m, innerDeg(tanEnd(c[i - 1]), tanStart(c[i]))); return m; };
  ["back", "front"].forEach(pc => {
    const seg = r => d0.geometry.outline.find(s => s.role === r && s.piece === pc);
    ok(g1(seg("raglan")) < 1e-6, "5: " + pc + " 소매 달림선 마디 G1(해제 곡선 · 안내선 · ★ · 아래 곡선) — 최대 " + g1(seg("raglan")).toExponential(1) + "°");
    ok(g1(seg("center-seam")) < 1e-6 && g1(seg("hem")) < 1e-6, "5: " + pc + " 중심 솔기 다듬기 · 소맷부리 다듬기 G1");
    const body = d0.derivedBodice[pc].outline.find(s => s.edge === "raglan");
    ok(g1(body) < 1e-6, "5: " + pc + " 몸판 달림선 마디 G1(안내선 → 아래 곡선 → 진동 합류)");
    const hem = cubsOf(seg("hem")), ua = seg("underarm"), cu = unitv(sub(ua.to, ua.from));
    ok(near(innerDeg(tanEnd(hem[hem.length - 1]), cu), 90, 1e-6), "5: " + pc + " 소맷부리가 소매 밑선과 직각");
  });
  // 겨드랑이(봉제 상태): 몸판 진동 아랫점 내부각 + 소매 아랫점 내부각 = 180 (몸판 좌표 · 독립)
  ["back", "front"].forEach(pc => {
    const body = cubsOf(d0.derivedBodice[pc].outline.find(s => s.edge === "raglan")), Ub = body[body.length - 1][3];
    const side = pc === "back" ? d0.derivedBodice.back.outline.find(s => s.edge === "side-seam" && D(s.from, Ub) < 1e-9) : d0.derivedBodice.front.outline.find(s => s.edge === "side-seam" && (D(s.from, Ub) < 1e-9 || D(s.to, Ub) < 1e-9));
    const sideOut = unitv(sub(D(side.from, Ub) < 1e-9 ? side.to : side.from, Ub)), bodyIn = unitv(sub(body[body.length - 1][2], Ub));
    const sr = cubsOf(dl0[pc].sleeveRaglan), Us = sr[sr.length - 1][3], ua = dl0[pc].sleeveUnderarm, uaOut = unitv(sub(D(ua.from, Us) < 1e-9 ? ua.to : ua.from, Us)), slvIn = unitv(sub(sr[sr.length - 1][2], Us));
    const sum = innerDeg(bodyIn, sideOut) + innerDeg(slvIn, uaOut);
    ok(near(sum, 180, 0.01), "5: " + pc + " 겨드랑이 봉제 연결 " + sum.toFixed(3) + "° = 180");
  });
  ok(Math.abs(m0.joints.neck.back.kinkDeg) < 0.05 && Math.abs(m0.joints.neck.front.kinkDeg) < 0.05 && near(m0.joints.cuffJoinDeg, 180, 0.01), "5: 목 꺾임 0 · 소맷부리 연결 180(엔진 기록)");
}

// ── 6. 스윕(소매길이 · 시안 설정값 주변) ──
{
  let okN = 0, rej = {}, bad = [];
  [40, 45, 50, 54, 58, 62, 66, 70].forEach(L => { const r = SV.draftSleeveV(bodice0, SRA.bodiceAGeometry(P0), { sleeveLengthCm: L }); if (r.ok) { okN++; if (!near(r.meta.raglan.back.diffCm, 0, 2e-4) || !near(r.meta.raglan.front.diffCm, 0, 2e-4)) bad.push("len " + L); } else rej[r.reason] = (rej[r.reason] || 0) + 1; });
  ok(okN === 8 && !bad.length, "6: 소매길이 40–70 전부 성립 · 달림선 몸판 = 소매(" + J(rej) + ")");
  const pert = { backStarAboveMCm: [1.5, 2.5], frontStarAboveMCm: [3, 4], backUnderarmWidthCm: [16.25, 17.25], frontUnderarmWidthCm: [15.75, 16.75], backUnderHandleRatio: [1.2, 1.6], frontUnderHandleRatio: [0.3, 0.5],
    releaseBeyondApCm: [3, 5], releaseHandleRatio: [0.4, 0.6], backLowerJoinCm: [0.5, 1.5], frontLowerJoinCm: [1.5, 2.5], shoulderFairCm: [1.5, 2.5], spFairCm: [2.5, 3.5], cuffFairCm: [2.5, 3.5], frontBulgeCm: [0.4, 0.8] };
  let n = 0, good = 0; const why = {};
  Object.keys(pert).forEach(k => pert[k].forEach(v => { n++; const p = { sleeveLengthCm: SL }; p[k] = v; const r = SV.draftSleeveV(bodice0, SRA.bodiceAGeometry(P0), p);
    if (r.ok) { good++; ["back", "front"].forEach(pc => { const L = chainLoop(r.geometry.outline.filter(s => s.piece === pc)); if (L.gap > 1e-6 || selfX(L.loop) || !near(r.meta.raglan[pc].diffCm, 0, 2e-4)) bad.push(k + "=" + v + " " + pc); }); }
    else why[r.reason] = (why[r.reason] || 0) + 1; }));
  ok(!bad.length, "6: 설정값 ±스윕 — 성립한 것은 폐곡선·자기교차 없음·달림선 같음(" + good + "/" + n + " 성립 · 거부 " + J(why) + " · 문제 " + bad.slice(0, 3).join(",") + ")");
  ok(good >= n - 2, "6: 시안 설정값 주변 대부분 성립(" + good + "/" + n + ")");
  const far = SV.draftSleeveV(bodice0, SRA.bodiceAGeometry(P0), { sleeveLengthCm: SL, backUnderarmWidthCm: 3 });
  ok(!far.ok && far.reason === "under-curve-unreachable", "6: 같은 치수로 폭선에 닿을 수 없는 아랫점 → 거부(" + far.reason + ")");
  const out = SV.draftSleeveV(bodice0, SRA.bodiceAGeometry(P0), { sleeveLengthCm: SL, frontLowerJoinCm: 0, lowerHandleRatio: 0.1 });
  ok(!out.ok && out.reason === "raglan-leaves-bodice", "6: 몸판 달림선이 종이 밖으로 → 거부(제1법칙 · " + out.reason + ")");
  const ch = SV.draftSleeveV(bodice0, SRA.bodiceAGeometry(P0), { sleeveLengthCm: SL, capHeightRatio: 0.85 });
  ok(!ch.ok && ch.reason === "under-curve-unreachable", "6: 소매산 높이 비율만 크게 바꾸면 시안 아랫점 폭으로는 같은 치수 불가 → 거부(아랫점 위치 조정 필요 — 한계 기록)");
  ok(!SV.draftSleeveV(bodice0, SRA.bodiceAGeometry(P0), { sleeveLengthCm: 10 }).ok && SV.draftSleeveV(bodice0, SRA.bodiceAGeometry(P0), {}).reason === "invalid-input", "6: 소매길이 ≤ ◉ · 빈 값 거부");
}

// ── 7. 원본 불변 · 게이트 ──
{
  ok(J(bodice0) === bodiceJ0 && J({ f: P0.working.geometry.front, b: P0.working.geometry.back }) === geoFB0, "7: 제도 후 bodiceResult · 작업 몸판 형상 무변경");
  const PB = projectWithBodice(presetOf("B"));
  const rb = SVA.apply(PB, { sleeveLengthCm: SL });
  ok(!rb.ok && rb.reason === "bodice-not-a" && !PB.working.sleeveV, "7: 몸판 Ⓑ 거부(Ⓐ 형상 게이트)");
  const tf = ST.draftSleeveT(bodice0, SRA.bodiceAGeometry(P0), { sleeveLengthCm: SL }), mv = ST.parts.moveFrontDart(bodice0.front, { sideDartDropCm: 3 });
  ok(tf.ok && J(tf.derivedBodice.front.outline) === J(mv.outline) && near(m0.frontDart.angleDeg, mv.sideDart.angleDeg, 1e-12), "7: 앞 AH 다트 이동 = Ⓣ 와 같은 연산(재사용 경계 · Ⓣ 결과 무변경)");
}

// ── 8. 상태 연결 · 완료본 · 무효화 · 거부 시 상태 보존 ──
const Q = projectWithBodice(A_ID), bodiceJQ = J(BC.latest(Q));
{
  const r = SVA.apply(Q, { sleeveLengthCm: SL });
  ok(r.ok && Q.working.sleeveV && J(Q.working.geometry.sleeve) === J(d0.geometry) && J(Q.working.sleeveV.derivedBodice) === J(d0.derivedBodice), "8: 적용 — 상태 = 엔진 결과(geometry.sleeve 두 장 미러링)");
  const c = SC.check(Q);
  ok(c.ok && near(c.capLengths.back, m0.raglan.back.body.totalCm, 1e-4) && near(c.capLengths.front, m0.raglan.front.body.totalCm, 1e-4) && Math.abs(c.ease.total) < 2e-4, "8: 완료 전 검사 통과 · 소매 달림선 실측 = 몸판(이세 " + (c.ease ? c.ease.total.toExponential(1) : "?") + ")");
  const cp = SC.complete(Q), res = cp.result;
  ok(cp.ok && res.origin.presetId === "bunka-sleeve-V" && res.cap.kind === "raglan-seam" && res.cap.splitPoint === null && res.derivedBodice && Object.isFrozen(res) && res.geometry.centerSeam === true, "8: 완료본 — 출처 Ⓥ · cap = 소매 달림선(분할점 없음) · 파생 몸판 소유 · 동결");
  ok(J(BC.latest(Q)) === bodiceJQ, "8: 적용·완료해도 bodiceResult 무변경");
  ok(SC.isCurrentSleeveChanged(Q) === false && SC.invalidatedByBodice(Q) === false, "8: 완료 직후 변경 없음");
  const S = Q.working.sleeveV, keys = SVA.keys(); let inv = 0; const miss = [];
  keys.forEach(k => { const p = Object.assign({}, S.parameters); p[k] = +(p[k] + (k === "cuffRatio" ? -0.05 : k === "lowerHandleRatio" ? 0.02 : k === "capHeightRatio" ? 0.01 : 0.1)).toFixed(4); const rr = SVA.apply(Q, p); if (rr.ok && SC.isCurrentSleeveChanged(Q) === true) inv++; else miss.push(k + ":" + (rr.ok ? "same" : rr.reason)); });
  ok(inv === keys.length, "8: 입력 22개 각각 바꾸면 «변경됨»(" + inv + "/" + keys.length + " " + miss.join(",") + ")");
  SVA.apply(Q, { sleeveLengthCm: SL });
  ok(SC.isCurrentSleeveChanged(Q) === false, "8: 같은 입력으로 되돌리면 같은 서명");
  // 거부: 이전 형상·완료본 유지 · 차단 표시 · 완료 불가
  const before = J({ g: Q.working.geometry.sleeve, s: Q.working.sleeveV, r: Q.working.sleeveResult });
  const bad = SVA.apply(Q, { sleeveLengthCm: SL, backUnderarmWidthCm: 3 });
  ok(!bad.ok && J({ g: Q.working.geometry.sleeve, s: Q.working.sleeveV, r: Q.working.sleeveResult }) === before, "8: 거부된 적용은 상태·geometry·완료본을 바꾸지 않음");
  SVA.reject(Q, { reason: bad.reason, text: bad.text });
  const cb = SC.check(Q), cc = SC.complete(Q);
  ok(SVA.isBlocked(Q) && !cb.ok && cb.fails.indexOf("sleeve-v-blocked") >= 0 && !cc.ok && Q.working.sleeveResult === res && J(Q.working.geometry.sleeve) === J(d0.geometry), "8: 차단 표시 → 완료 불가 · 이전 완료본·형상 유지");
  SVA.apply(Q, { sleeveLengthCm: SL });
  ok(!SVA.isBlocked(Q) && SC.check(Q).ok, "8: 유효 입력 재적용으로 차단 해제");
  // 위조: geometry 를 바꾸면 재제도 대조에서 걸린다
  const g0 = J(Q.working.geometry.sleeve); Q.working.geometry.sleeve.outline[0].commands[1].points[0].x += 0.01;
  ok(SC.check(Q).fails.indexOf("sleeve-v-geometry-mismatch") >= 0, "8: 형상 위조 → geometry-mismatch");
  Q.working.geometry.sleeve = JSON.parse(g0);
  // 몸판 변경 → 무효 · 재제도는 Ⓐ 게이트로 차단
  const P3 = Q; P3.working.parameters.body = BP.bodyParams(presetOf("B")); P3.working.geometry = Object.assign(DB.computeGeometry(REF, { body: P3.working.parameters.body }), { sleeve: P3.working.geometry.sleeve });
  BC.complete(P3);
  ok(SC.invalidatedByBodice(P3) === true && !SC.check(P3).ok, "8: 몸판 다시 완료 → 소매 완료본 무효(몸판 변경)");
  const rd = SVA.rederive(P3);
  ok(!rd.ok && SVA.isBlocked(P3) && rd.reason === "bodice-not-a", "8: 몸판 변경 후 재제도 → Ⓐ 게이트 차단");
}

// ── 9. 카라 단계 목둘레 계약(구현 범위 밖 — 길이 보존만 확인 · 한계 기록) ──
{
  ["back", "front"].forEach(pc => {
    const neckBody = segLen(d0.derivedBodice[pc].outline.find(s => s.edge === "neckline")), neckSlv = segLen(dl0[pc].sleeveNeck);
    const orig = segLen(bodice0[pc].outline.find(s => s.edge === "neckline"));
    ok(near(neckBody + neckSlv, orig, 2e-4), "9: " + pc + " 목둘레 몸판 " + neckBody.toFixed(3) + " + 소매 " + neckSlv.toFixed(3) + " = 원래 " + orig.toFixed(3) + "(카라가 쓰는 bodiceResult 목둘레 길이와 같음)");
  });
  ok(m0.unconfirmed.some(t => /카라/.test(t)), "9: 카라 단계 한계(래글런 목 분할·뒤 소매 목 회전 미반영) 기록");
}

// ── 10. 표시 ──
const P = projectWithBodice(A_ID); SVA.apply(P, { sleeveLengthCm: SL });
{
  const g = J(P.working.geometry.sleeve), md = SAN.buildModel(P);
  ok(md && md.line === "V" && md.title.indexOf("Ⓥ") >= 0 && md.lines.some(l => /솔기/.test(l.text)), "10: 두 장 소매 표시(Ⓥ 제목 · 중심 솔기)");
  ok(["back", "front", "center-back", "center-front", "rg1-back", "rg2-back", "rg3-back", "rg1-front", "rg3-front", "ua-back", "cuff-front", "n-back", "star-front", "dm", "len-back", "cap-h-front"].every(id => md.lines.some(l => l.id === id) || md.dims.some(d => d.id === id)), "10: 앞뒤 · 중심 솔기 · 구간 · 밑선 · 소맷부리 · 맞춤 · ★ · 다듬기 · 길이 · ◉");
  ok(md.lines.some(l => l.block !== undefined && /차 \+0\.016/.test(l.text)) && md.lines.some(l => l.block !== undefined && /28\.608 = 28\.608/.test(l.text)), "10: 설명 블록 — 중심 솔기 차 0.016 기록 · 달림선 몸판 = 소매");
  const db = SAN.dolmanBodice(P);
  ok(db && db.back.cut === P.working.sleeveV.derivedBodice.back.outline && db.front.draft.length === 13 && db.back.draft.length === 17 && db.back.shoulder && db.back.shoulder.inset, "10: 몸판 위 재단선(파생) · 제도선 · 뒤 어깨 닫은 자리 확대");
  const ids = pc => db[pc].anno.lines.map(l => l.id);
  ok(["v1", "v2", "v3", "v4", "v5", "v6r", "v6d", "v7", "v8", "v9", "v10", "v10c", "v11", "v12"].every(id => ids("back").indexOf(id) >= 0) && ids("front").indexOf("v0") >= 0 && ids("back").indexOf("v0") < 0 && ids("front").indexOf("v12") < 0, "10: 제도 순서 뒤 ①~⑫ · 앞 ⓪~⑪");
  ok(SAN.dolmanExtents(P).sleeveBelow === false, "10: 소매 배치 = 기존 자리(오른쪽)");
  const info = SVA.infoLines(P);
  ok(info.length >= 8 && info[0].indexOf("Ⓥ") >= 0 && info.some(l => /0\.016/.test(l)) && info.some(l => /출처 구분/.test(l)), "10: 정보 줄(Ⓥ · 중심 솔기 차 · 출처 구분)");
  ok(J(P.working.geometry.sleeve) === g, "10: 표시가 geometry 를 바꾸지 않음");
}
// ── 11. 설명 글자·리더선이 다른 피스에 놓이지 않음 · 피스끼리 설명 겹침 없음(Ⓣ/Ⓤ 겹침을 반복하지 않는다) ──
{
  const DLY = W.designLayout, g0 = P.working.geometry, ex0 = SAN.dolmanExtents(P), LA = DLY.autoLayout(g0, ex0);
  P.working.layout = { back: LA.back, front: LA.front, sleeve: LA.sleeve, collar: { dx: 0, dy: 0 }, placement: { back: "auto", front: "auto", sleeve: "auto", collar: "auto" } };
  const FSZ = { title: 12, side: 13, note: 8.5 }, fz = c => FSZ[c] || 9;
  const box = (x, y, an, t, c) => { const f = fz(c); let w = 0; for (let i = 0; i < t.length; i++) w += (t.charCodeAt(i) > 255 ? 1 : 0.58) * f; const x0 = an === "end" ? x - w : an === "middle" ? x - w / 2 : x; return { x0, x1: x0 + w, y0: y - f * 0.85 - 1, y1: y + f * 0.2 + 1 }; };
  const ov = (a, b) => a.x0 < b.x1 - 0.5 && b.x0 < a.x1 - 0.5 && a.y0 < b.y1 - 0.5 && b.y0 < a.y1 - 0.5;
  const ub = (a, b) => b ? { minX: Math.min(a.minX, b.minX), minY: Math.min(a.minY, b.minY), maxX: Math.max(a.maxX, b.maxX), maxY: Math.max(a.maxY, b.maxY) } : a;
  const ex = SAN.dolmanExtents(P), area = k => k === "sleeve" ? DLY.outlineBBoxOf(g0, k) : ub(DLY.outlineBBoxOf(g0, k), ex[k]);
  const db2 = SAN.dolmanBodice(P), sm = SAN.buildModel(P, { pieces: true }), bad = [];
  [1.5, 2.2, 3, 4.5, 6, 9].forEach(s => [["back", db2.back.anno], ["front", db2.front.anno], ["sleeve", sm]].forEach(([pc, model]) => {
    const others = ["back", "front", "sleeve"].filter(k => k !== pc).map(k => { const b = area(k), dx = LA[k].dx - LA[pc].dx, dy = LA[k].dy - LA[pc].dy; return { k, x0: (b.minX + dx) * s, x1: (b.maxX + dx) * s, y0: (b.minY + dy) * s, y1: (b.maxY + dy) * s }; });
    const LY = SAN.layout(model, s);
    LY.items.forEach(it => { const b = box(it.at.x * s + it.dx, it.at.y * s + it.dy, it.anchor, it.text, it.cls); others.forEach(o => { if (ov(b, o)) bad.push(s + " " + pc + "→" + o.k + " «" + it.text.slice(0, 12) + "»"); }); });
    LY.leaders.forEach(ld => { const ax = ld.at.x * s, ay = ld.at.y * s; for (let q = 0; q <= 24; q++) { const x = ax + ld.toPx.dx * q / 24, y = ay + ld.toPx.dy * q / 24; others.forEach(o => { if (x > o.x0 && x < o.x1 && y > o.y0 && y < o.y1) bad.push(s + " " + pc + " 리더→" + o.k); }); } });
  }));
  ok(bad.length === 0 && db2.front.anno.keepOutCm && sm.keepOutCm, "11: Ⓥ 설명 글자·리더선이 다른 피스(외곽 ∪ 몸판 제도 범위) 위에 없음 — 배율 6단계(" + [...new Set(bad)].slice(0, 3).join(" · ") + ")");
  const cross = [];
  [1.25, 1.56, 3, 6].forEach(s => {
    const Bx = {}; [["back", db2.back.anno], ["front", db2.front.anno], ["sleeve", sm]].forEach(([k, m]) => { const LY = SAN.layout(m, s); Bx[k] = LY.items.map(it => { const b = box(it.at.x * s + it.dx, it.at.y * s + it.dy, it.anchor, it.text, it.cls); return { t: it.text, b: { x0: b.x0 + LA[k].dx * s, x1: b.x1 + LA[k].dx * s, y0: b.y0 + LA[k].dy * s, y1: b.y1 + LA[k].dy * s } }; }); });
    const ks = ["back", "front", "sleeve"]; for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) Bx[ks[i]].forEach(a => Bx[ks[j]].forEach(b => { if (ov(a.b, b.b)) cross.push(s + " " + ks[i] + "«" + a.t.slice(0, 8) + "»×" + ks[j] + "«" + b.t.slice(0, 8) + "»"); }));
  });
  ok(cross.length === 0, "11: Ⓥ 피스끼리 설명 글자·설명 줄이 겹치지 않음 — 배율 4단계(" + cross.slice(0, 3).join(" · ") + ")");
  // 맨 왼쪽 뒤 몸판: 글자가 표시 범위 왼쪽 밖(화면 맞춤 밖)으로 나가지 않는다 — Ⓣ/Ⓤ 에서 남은 «작은 배율 잘림»을 Ⓥ 에서 반복하지 않음
  const clip = [];
  [1.5, 2.2, 3, 4.5, 6, 9].forEach(s => { const LY = SAN.layout(db2.back.anno, s); LY.items.forEach(it => { const b = box(it.at.x * s + it.dx, it.at.y * s + it.dy, it.anchor, it.text, it.cls); if (b.x0 < ex.back.minX * s - 1) clip.push(s + " «" + it.text.slice(0, 10) + "»"); }); });
  ok(clip.length === 0, "11: 뒤 몸판 설명이 표시 범위 왼쪽 밖으로 나가지 않음 — 배율 6단계(" + clip.slice(0, 3).join(" · ") + ")");
  ok(db2.back.shoulder.inset.legend.length === 0 && db2.back.shoulder.inset.title === "" && db2.back.anno.lines.some(l => l.id === "v-sh-title") && db2.back.anno.lines.some(l => l.id === "v-sh-dev" && /0\.103/.test(l.text)), "11: 확대 상자 글자 = 배치되는 설명 줄(고정 위치 범례 없음)");
  // 두 장 소매: 뒤 소매 글자는 간격 가운데(x 0) 왼쪽 · 앞 소매 글자는 오른쪽(이웃 조각 위에 놓이지 않음)
  const side = [];
  [1.5, 2.2, 3, 4.5, 6, 9].forEach(s => { const LY = SAN.layout(sm, s); LY.items.forEach(it => { if (/^block|^legend/.test(it.id)) return; const b = box(it.at.x * s + it.dx, it.at.y * s + it.dy, it.anchor, it.text, it.cls);
    if ((/-back$/.test(it.id) || it.id === "dm") && b.x1 > 0.5) side.push(s + " «" + it.text.slice(0, 8) + "»"); if (/-front$/.test(it.id) && b.x0 < -0.5) side.push(s + " «" + it.text.slice(0, 8) + "»"); }); });
  ok(side.length === 0, "11: 두 장 소매 글자가 자기 조각 쪽에(간격 너머 이웃 조각 위 아님) — 배율 6단계(" + side.join(" · ") + ")");
  // 뒤 어깨 확대 상자는 다른 피스 자리와 겹치지 않는다
  const ib = db2.back.shoulder.inset.box, fa = area("front"), sa = area("sleeve"), shift = (b, k) => ({ minX: b.minX + LA[k].dx - LA.back.dx, maxX: b.maxX + LA[k].dx - LA.back.dx, minY: b.minY + LA[k].dy - LA.back.dy, maxY: b.maxY + LA[k].dy - LA.back.dy });
  const hitB = (a, b) => a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY;
  ok(!hitB(ib, shift(fa, "front")) && !hitB(ib, shift(sa, "sleeve")), "11: 뒤 어깨 확대 상자가 앞판·소매 자리와 겹치지 않음");
}

// ── 12. 배선 ──
{
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8"), ui = fs.readFileSync(path.join(ROOT, "js", "ui.js"), "utf8");
  const ver = (f) => { const mm = html.match(new RegExp("js/" + f.replace(".", "\\.") + "\\?v=(\\d+)")); return mm ? mm[1] : null; };
  ok(["sleeveVApply.js", "designSleeveT.js"].every(f => ver(f) === "2026110101") && ver("designSleeveV.js") === "2026110301" && ["ui.js", "sleeveCheckpoint.js", "sleevePresets.js", "sleeveAnnotation.js"].every(f => ver(f) === "2026110402") && /css\/style\.css\?v=2026110101/.test(html), "12: 변경 파일 캐시 버전 2026110101 · Ⓦ 연결로 Ⓥ 엔진(옵션 추가)·공용 파일 2026110301");
  ok(html.indexOf("js/designSleeveT.js") < html.indexOf("js/designSleeveV.js") && html.indexOf("js/designSleeveV.js") < html.indexOf("js/sleeveVApply.js") && html.indexOf("js/sleeveVApply.js") < html.indexOf("js/ui.js"), "12: 스크립트 순서(Ⓣ 엔진 → Ⓥ 엔진 → 상태 → ui)");
  const rec = SP.get("bunka-sleeve-V");
  ok(/id="rowSleeveV" hidden/.test(html) && rec.inputs.slice(1).every(i => new RegExp('id="inpSleeveV_' + i.key + '" type="number" step="[0-9.]+" value="' + String(i.defaultValue).replace(".", "\\.") + '"').test(html)), "12: Ⓥ 입력 칸 21개 = 레코드 기본값");
  ok(/function applySleeveV\(/.test(ui) && /keep !== "V" && window\.sleeveVApply/.test(ui) && /sleeveVOn\(project\)\) \{ window\.sleeveVApply\.rederive/.test(ui) && /sleeveLineOn\(project\) \{ return sleeveVOn\(project\)/.test(ui)
    && /readSleeveTInputs\("V"\)/.test(ui) && /id === "bunka-sleeve-V" \? "Ⓥ"/.test(ui) && /getElementById\("rowSleeveV"\)/.test(ui), "12: ui 연결(적용 · 배타 · 재제도 · 라인 판정 · 입력 · 기호 · 칸 표시)");
  ["designSleeveV.js", "sleeveVApply.js"].forEach(f => { const t = fs.readFileSync(path.join(ROOT, "js", f), "utf8"); ok(!/localStorage|document\.|window\.addEventListener|scratchpad|\/tmp\//.test(t), "12: " + f + " DOM·storage·scratch 경로 미접근"); });
}

console.log("══════════════════════════════════════════════");
if (fails.length) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); }
console.log("결과: " + PASS + " PASS / " + FAIL + " FAIL");
process.exitCode = FAIL ? 1 : 0;
