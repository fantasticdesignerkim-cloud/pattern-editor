// ══════════════════════════════════════════════
// sleeveWCheck.js — 소매 Ⓦ 래글런(P.53 · 제도 방법 P.142–143 · 맞댄다 P.157 · 닫는다 P.160, 2026-11-03 시안) 전용 회귀:
//   카탈로그 · 승인 시안과 제품 기하 독립 비교(외곽 점열 · 제어점 · 주요 점 — 픽스처) · 소매 달림선 전체/맞춤 구간 · 어깨 다트 다리(차 보존 — 보정 금지) ·
//   맞댄 선 일치 · 밑선 · 소맷부리 독립 길이 · 폐곡선 · 자기교차 · 겹침 없음 · 열린 다트 = 외곽 · 닫힌 흔적 없음 · 곡선 흐름 · 봉제 상태 연결 · 스윕 ·
//   원본 불변 · Ⓥ 보존 · Ⓐ 게이트 · 입력/몸판 무효화 · 거부 시 상태 보존 · 완료본 · 카라 목둘레 계약 · 표시(겹침 없음) · 배선.
//   node test/harness/sleeveWCheck.js
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
  "designSleeveT.js", "sleeveTApply.js", "sleeveUApply.js", "designSleeveV.js", "sleeveVApply.js", "designSleeveW.js", "sleeveWApply.js", "sleeveAnnotation.js"].forEach(load);
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, BC = W.bodiceCheckpoint, SP = W.sleevePresets, SC = W.sleeveCheckpoint, SAN = W.sleeveAnnotation,
  SV = W.designSleeveV, SVA = W.sleeveVApply, SW = W.designSleeveW, SWA = W.sleeveWApply, ST = W.designSleeveT, STA = W.sleeveTApply, SUA = W.sleeveUApply, SRA = W.sleeveRApply;
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));
const APPROVED = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "sleeveWApproved.json"), "utf8"));
const APPROVED_V = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "sleeveVApproved.json"), "utf8"));
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
const segX = (a, b, c, d) => { const o = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x); const e1 = o(c, d, a), e2 = o(c, d, b), e3 = o(a, b, c), e4 = o(a, b, d); const k = 1e-9; return ((e1 > k && e2 < -k) || (e1 < -k && e2 > k)) && ((e3 > k && e4 < -k) || (e3 < -k && e4 > k)); };   // 공선 토막 잡음 제외(진짜 교차만)
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

const mul2 = (a, k) => ({ x: a.x * k, y: a.y * k });
const seg1 = (g, role, pc) => g.outline.filter(s => s.role === role && (pc === undefined || s.piece === pc));
const one = (g, role, pc) => { const a = seg1(g, role, pc); return a.length === 1 ? a[0] : null; };
const toP = a => ({ x: a[0], y: a[1] });

// ── 1. 카탈로그 ──
{
  const f = SP.family("raglan-sleeve"), r = SP.get("bunka-sleeve-W");
  ok(f && f.availability === "available" && SP.resolve("raglan-sleeve", "bunka-sleeve-W").ok && SP.resolve("raglan-sleeve", "bunka-sleeve-V").ok && f.variants.map(v => v.symbol).join() === "V,W", "1: 래글런 family = Ⓥ · Ⓦ 둘 다 실행 가능");
  ok(r && r.methodPage === 53 && J(r.inputs.map(i => i.key)) === J(SW.KEYS) && J(SWA.keys()) === J(SW.KEYS) && r.inputs.every(i => i.key === "sleeveLengthCm" ? i.defaultValue === undefined : i.defaultValue === SW.RULES.defaults[i.key]), "1: Ⓦ 레코드 입력 21개 = 엔진 KEYS · 기본값 일치 · 소매길이 기본값 없음");
  ok(SW.KEYS.indexOf("spFairCm") < 0 && SW.RULES.book.capHeightRatio === 0.5 && SW.RULES.book.backSlopeDropCm === 1.3 && SW.RULES.book.frontSlopeDropCm === 2 && SW.RULES.book.slopeRunCm === 8 && SW.RULES.book.frontBulgeCm === 0.6 && SW.RULES.book.cuffRatio === 0.75, "1: 책 수치(P.53 1/2 · 8 ⟂ 1.3 / 2 · 0.6 · 3/4) · SP 다듬기 입력 없음");
  ok(SW.RULES.draft.backUnderarmWidthCm === 19.5 && SW.RULES.draft.frontUnderarmWidthCm === 19.1 && J(SW.RULES.newForW) === J(["backUnderarmWidthCm", "frontUnderarmWidthCm"])
    && Object.keys(SW.RULES.draft).filter(k => SW.RULES.newForW.indexOf(k) < 0).every(k => SW.RULES.draft[k] === SV.RULES.draft[k]), "1: 시안 설정값 — 폭 19.5 / 19.1 만 Ⓦ 새 값 · 나머지 = Ⓥ 확정값");
  ok(SP.resolve("kimono-sleeve", "bunka-sleeve-Z").ok, "1: 기모노 Ⓩ 실행 가능(2026-11-04 추가)");
}

// ── 2. 승인 시안과 제품 기하 독립 비교(외곽 점열 · 제어점 · 주요 점) ──
const P0 = projectWithBodice(A_ID);
const bodice0 = BC.latest(P0), bodiceJ0 = J(bodice0), geoFB0 = J({ f: P0.working.geometry.front, b: P0.working.geometry.back });
const d0 = SW.draftSleeveW(bodice0, SRA.bodiceAGeometry(P0), { sleeveLengthCm: SL });
ok(d0.ok, "2: B83 · 소매길이 54 제도 성공 " + (d0.reason || ""));
const g0 = d0.geometry, m0 = d0.meta, sp0 = m0.sleevePoints;
{
  const A = APPROVED.pieces.sleeve, ap = k => A[k].map(toP);
  const hs = {};
  ["back", "front"].forEach(pc => ["raglan", "neck", "underarm"].forEach(r => { hs[r + ":" + pc] = haus(polySeg(one(g0, r, pc), 300), ap(r + ":" + pc)); }));
  hs.hem = haus(polySeg(one(g0, "hem"), 300), ap("hem:back").concat(ap("hem:front")));
  const legs = polySeg(one(g0, "shoulder-dart", "back"), 300).concat(polySeg(one(g0, "shoulder-dart", "front"), 300));
  const butt = []; for (let k = 0; k <= 540; k++) butt.push({ x: 0, y: k / 10 });
  const cen = ap("center-seam:back").concat(ap("center-seam:front"));
  hs.legs = Math.max(...legs.map(p => nearSeg(cen, p)));   // 제품 다트 다리는 시안 중심선 위
  hs.center = Math.max(...cen.map(p => Math.min(nearSeg(legs, p), nearSeg(butt, p))));   // 시안 중심선 = 제품 다트 다리 ∪ 맞댄 선
  hs.bodiceBack = haus([].concat(...d0.derivedBodice.back.outline.map(s => polySeg(s, 200))), APPROVED.pieces.bodiceBack.map(toP));
  hs.bodiceFront = haus([].concat(...d0.derivedBodice.front.outline.map(s => polySeg(s, 200))), APPROVED.pieces.bodiceFront.map(toP));
  ok(Object.values(hs).every(v => v < 0.02), "2: 승인 시안과 외곽 최대 거리 < 0.02cm — " + Object.entries(hs).map(([k, v]) => k + " " + v.toFixed(4)).join(" · "));
  let cmax = 0;
  ["back", "front"].forEach(pc => ["raglan", "neck", "underarm"].forEach(r => { const a = APPROVED.control[r + ":" + pc], b = cubsOf(one(g0, r, pc)); if (a.length !== b.length) cmax = Infinity; else a.forEach((q, i) => q.forEach((p, j) => { cmax = Math.max(cmax, D(toP(p), b[i][j])); })); }));
  const hemA = APPROVED.control["hem:back"].slice().reverse().map(q => q.slice().reverse()).concat(APPROVED.control["hem:front"]), hemB = cubsOf(one(g0, "hem"));
  if (hemA.length !== hemB.length) cmax = Infinity; else hemA.forEach((q, i) => q.forEach((p, j) => { cmax = Math.max(cmax, D(toP(p), hemB[i][j])); }));
  ok(cmax < 1e-3, "2: 달림선 · 목 · 밑선 · 소맷부리 제어점 = 시안(최대 " + cmax.toExponential(1) + ")");
  let kmax = 0; Object.keys(APPROVED.keyPoints).forEach(k => { const [n, pc] = k.split(":"); kmax = Math.max(kmax, D(toP(APPROVED.keyPoints[k]), sp0[pc][n])); });
  ok(kmax < 1e-3, "2: 주요 점(SP · E · C · 아랫점 · ★ · ① · 목 · 목옆점 · W0 · Dm) = 시안(최대 " + kmax.toExponential(1) + ")");
}

// ── 3. 봉제 길이 독립 검산 ──
{
  const N = APPROVED.numbers;
  ["back", "front"].forEach(pc => {
    const body = d0.derivedBodice[pc].outline.find(s => s.edge === "raglan"), bodyPts = polySeg(body), slvPts = polySeg(one(g0, "raglan", pc));
    const bl = plen(bodyPts), sl = plen(slvPts);
    ok(near(bl, sl, 2e-4) && near(sl, N.raglan[pc], 2e-3), "3: " + pc + " 소매 달림선 몸판 " + bl.toFixed(4) + " = 소매(한 장 소매 좌표) " + sl.toFixed(4) + " (시안 " + N.raglan[pc] + ")");
    const nb = m0.draftLayer.notches[pc], stB = m0.draftLayer[pc].star;
    const b1 = arcTo(bodyPts, nb.body), b2 = arcTo(bodyPts, stB), s1 = arcTo(slvPts, sp0[pc].notch), s2 = arcTo(slvPts, sp0[pc].star);
    const segB = [b1.s, b2.s - b1.s, bl - b2.s], segS = [s1.s, s2.s - s1.s, sl - s2.s];
    ok(b1.off < 1e-3 && b2.off < 1e-3 && s1.off < 1e-3 && s2.off < 1e-3 && segB.every((v, i) => near(v, segS[i], 3e-3)), "3: " + pc + " 맞춤 구간 목→①→★→아랫점 몸판 " + segB.map(v => v.toFixed(3)).join("/") + " = 소매 " + segS.map(v => v.toFixed(3)).join("/"));
  });
  const lB = segLen(one(g0, "shoulder-dart", "back")), lF = segLen(one(g0, "shoulder-dart", "front"));
  ok(near(lB, N.dartLeg.back, 2e-3) && near(lF, N.dartLeg.front, 2e-3) && near(lB - lF, N.dartLeg.diff, 1e-3) && Math.abs(lB - lF) > 0.01, "3: 어깨 다트 다리 뒤 " + lB.toFixed(4) + " · 앞 " + lF.toFixed(4) + " — 차 " + (lB - lF).toFixed(4) + " 보존(보정 없음 · 0 으로 만들지 않음)");
  ok(near(m0.seams.dart.back, lB, 1e-3) && near(m0.seams.dart.front, lF, 1e-3) && near(m0.seams.dart.diffCm, lB - lF, 1e-3), "3: meta 다트 다리 = 독립 실측");
  // 맞댄 선: 두 다리 끝 = SP(0,0) · 소맷부리가 E(0, 54) 를 지난다 · 기준선 butt-line 길이 = 소매길이
  const legEnd = pc => { const c = cubsOf(one(g0, "shoulder-dart", pc)); return c[c.length - 1][3]; };
  const hemPts = polySeg(one(g0, "hem"), 400), atE = nearSeg(hemPts, { x: 0, y: SL });
  const bl = g0.construction.find(s => s.role === "butt-line");
  ok(D(legEnd("back"), { x: 0, y: 0 }) < 1e-9 && D(legEnd("front"), { x: 0, y: 0 }) < 1e-9 && atE < 1e-9 && bl && near(D(bl.from, bl.to), SL, 1e-9) && near(m0.seams.butt.back, SL, 1e-6) && near(m0.seams.butt.front, SL, 1e-6), "3: 맞댄 선 SP(0,0) → E(0," + SL + ") — 다리 끝 = SP · 소맷부리 E 통과 · 뒤 = 앞 = 소매길이");
  const ua = pc => segLen(one(g0, "underarm", pc));
  ok(near(ua("back"), ua("front"), 1e-6) && near(ua("back"), N.underarm.back, 2e-3), "3: 소매 밑선 뒤 " + ua("back").toFixed(4) + " = 앞 " + ua("front").toFixed(4));
  const hl = hemPts, iE = hl.reduce((b, p, i) => Math.abs(p.x) < Math.abs(hl[b].x) ? i : b, 0), cuB = plen(hl.slice(0, iE + 1)), cuF = plen(hl.slice(iE));
  const left = hl[0].x < 0 ? cuB : cuF, right = hl[0].x < 0 ? cuF : cuB;
  ok(near(left, N.cuff.back, 3e-3) && near(right, N.cuff.front, 3e-3) && near(left - right, m0.cuff.back - m0.cuff.front, 3e-3), "3: 소맷부리 뒤 " + left.toFixed(3) + " · 앞 " + right.toFixed(3) + " (앞은 같은 분량 ● 자름)");
  ok(near(m0.capHeight.cm, N.capHeight, 1e-3) && near(m0.widthCm.back, 19.5, 1e-12) && near(m0.widthCm.front, 19.1, 1e-12), "3: ◉ 8.53 · 폭 19.5 / 19.1");
  ok(near(m0.widthBasis.back.referenceCm, N.widthRef.back, 2e-3) && near(m0.widthBasis.front.referenceCm, N.widthRef.front, 2e-3) && /반전/.test(m0.widthBasis.rule) && /17 ~ 20/.test(m0.widthBasis.support), "3: 폭 근거 기록 — 반전 기준 뒤 " + m0.widthBasis.back.referenceCm.toFixed(3) + " / 앞 " + m0.widthBasis.front.referenceCm.toFixed(3) + " · 지원 범위");
}

// ── 4. 폐곡선 · 자기교차 · 한 장(겹침 없음) · 열린 다트 = 외곽 · 닫힌 흔적 없음 ──
{
  const L = chainLoop(g0.outline);
  ok(L.gap < 1e-6 && !selfX(L.loop), "4: 한 장 소매 폐곡선(틈 " + L.gap.toExponential(1) + ") · 자기교차 없음");
  ["back", "front"].forEach(pc => { const B = chainLoop(d0.derivedBodice[pc].outline); ok(B.gap < 1e-6 && !selfX(B.loop), "4: " + pc + " 파생 몸판 폐곡선 · 자기교차 없음"); });
  const xs = pc => [].concat(...g0.outline.filter(s => s.piece === pc).map(s => polySeg(s, 200))).map(p => p.x);
  ok(Math.max(...xs("back")) <= 1e-9 && Math.min(...xs("front")) >= -1e-9, "4: 뒤 조각 x ≤ 0 · 앞 조각 x ≥ 0 — 맞댄 선 양쪽(종이 겹침 없음)");
  ok(g0.pieces.length === 1 && g0.butted === true && g0.centerSeam === false && !seg1(g0, "center-seam").length && seg1(g0, "shoulder-dart").length === 2 && seg1(g0, "hem").length === 1, "4: 중심 솔기 없음 · 어깨 다트 다리 2 · 소맷부리 한 변");
  const onAxis = [].concat(...g0.outline.map(s => polySeg(s, 200))).filter(p => Math.abs(p.x) < 1e-6 && p.y > 0.05 && p.y < SL - 0.05);
  ok(onAxis.length === 0 && !g0.outline.some(s => /old|bridge/.test(String(s.role))), "4: 닫힌 흔적 없음 — 맞댄 선 SP→E 는 외곽에 없음(기준선만) · old 다리 없음");
  ok(m0.seams.dart.neckOpenCm > 3 && m0.seams.dart.angleDeg > 20 && near(m0.seams.dart.angleDeg, APPROVED.numbers.dartAngleDeg, 0.05), "4: 어깨 다트는 열려 있다(목 " + m0.seams.dart.neckOpenCm.toFixed(3) + " · " + m0.seams.dart.angleDeg.toFixed(2) + "°) — 지금 외곽선");
}

// ── 5. 곡선 흐름(G1) · 봉제 상태 연결 ──
{
  const g1 = (s) => { const c = cubsOf(s); let m = 0; for (let i = 1; i < c.length; i++) m = Math.max(m, innerDeg(tanEnd(c[i - 1]), tanStart(c[i]))); return m; };
  ["back", "front"].forEach(pc => {
    ok(g1(one(g0, "raglan", pc)) < 1e-6 && g1(one(g0, "shoulder-dart", pc)) < 1e-6, "5: " + pc + " 소매 달림선 · 다트 다리(뒤 닫은 자리 다듬기) 마디 G1");
    const hem = cubsOf(one(g0, "hem")), ua = one(g0, "underarm", pc), C = pc === "back" ? hem[0][0] : hem[hem.length - 1][3], inT = pc === "back" ? mul2(tanStart(hem[0]), -1) : tanEnd(hem[hem.length - 1]);
    const cu = unitv(sub(D(ua.from, C) < 1e-9 ? ua.to : ua.from, C));
    ok(near(innerDeg(mul2(inT, -1), cu), 90, 1e-6), "5: " + pc + " 소맷부리가 소매 밑선과 직각");
  });
  ok(g1(one(g0, "hem")) < 1e-6, "5: 소맷부리 E 에서 한 직선(뒤 + 앞 연결 G1)");
  // 겨드랑이(봉제 상태 · 몸판 좌표 · 독립): 몸판 진동 아랫점 내부각 + 소매 아랫점 내부각 = 180
  ["back", "front"].forEach(pc => {
    const body = cubsOf(d0.derivedBodice[pc].outline.find(s => s.edge === "raglan")), Ub = body[body.length - 1][3];
    const side = d0.derivedBodice[pc].outline.find(s => s.edge === "side-seam" && (D(s.from, Ub) < 1e-9 || D(s.to, Ub) < 1e-9));
    const sideOut = unitv(sub(D(side.from, Ub) < 1e-9 ? side.to : side.from, Ub)), bodyIn = unitv(sub(body[body.length - 1][2], Ub));
    const sr = cubsOf(m0.draftLayer[pc].sleeveRaglan), Us = sr[sr.length - 1][3], ua = m0.draftLayer[pc].sleeveUnderarm, uaOut = unitv(sub(D(ua.from, Us) < 1e-9 ? ua.to : ua.from, Us)), slvIn = unitv(sub(sr[sr.length - 1][2], Us));
    const sum = innerDeg(bodyIn, sideOut) + innerDeg(slvIn, uaOut);
    ok(near(sum, 180, 0.01), "5: " + pc + " 겨드랑이 봉제 연결 " + sum.toFixed(3) + "° = 180");
  });
  // 목(어깨 다트를 닫은 봉제 상태): 뒤 목 끝 내부각 + 앞 목 끝 내부각(각 조각 다리 기준) ≈ 180 — 기록(독립 · 0.05cm 현)
  const snpAng = pc => { const leg = polySeg(one(g0, "shoulder-dart", pc), 2000), s = leg[0]; let nk = polySeg(one(g0, "neck", pc), 2000); if (D(nk[0], s) > D(nk[nk.length - 1], s)) nk = nk.slice().reverse();
    const at = (P, L) => { let a = 0; for (let i = 1; i < P.length; i++) { a += D(P[i - 1], P[i]); if (a >= L) return P[i]; } return P[P.length - 1]; };
    return innerDeg(unitv(sub(at(nk, 0.05), s)), unitv(sub(at(leg, 0.05), s))); };
  const snp = snpAng("back") + snpAng("front");
  ok(near(snp, APPROVED.numbers.neckSNPDeg, 0.1) && Math.abs(snp - 180) < 2, "5: 목옆점 봉제 상태 " + snp.toFixed(2) + "°(시안 " + APPROVED.numbers.neckSNPDeg + " · 꺾임 < 2° 기록)");
  ok(Math.abs(m0.joints.neck.back.kinkDeg) < 0.05 && Math.abs(m0.joints.neck.front.kinkDeg) < 0.05, "5: 몸판 목 ↔ 소매 목(N) 꺾임 0(엔진 기록)");
}

// ── 6. 스윕 ──
{
  let okN = 0, bad = []; const rej = {};
  [40, 45, 50, 54, 58, 62, 66, 70].forEach(L => { const r = SW.draftSleeveW(bodice0, SRA.bodiceAGeometry(P0), { sleeveLengthCm: L }); if (r.ok) { okN++; const LL = chainLoop(r.geometry.outline); if (LL.gap > 1e-6 || selfX(LL.loop) || !near(r.meta.raglan.back.diffCm, 0, 2e-4) || !near(r.meta.raglan.front.diffCm, 0, 2e-4) || !near(r.meta.seams.butt.back, L, 1e-6)) bad.push("len " + L); } else rej[r.reason] = (rej[r.reason] || 0) + 1; });
  ok(okN === 8 && !bad.length, "6: 소매길이 40–70 전부 성립 · 한 장 폐곡선 · 달림선 같음 · 맞댄 선 = 소매길이(" + J(rej) + " " + bad.join(",") + ")");
  let wn = 0, wok = 0;
  [17, 18, 19, 20].forEach(b => [17, 18, 19, 20].forEach(f => { wn++; const r = SW.draftSleeveW(bodice0, SRA.bodiceAGeometry(P0), { sleeveLengthCm: SL, backUnderarmWidthCm: b, frontUnderarmWidthCm: f }); if (r.ok && r.meta.checks.overlap === false) wok++; }));
  const w21 = SW.draftSleeveW(bodice0, SRA.bodiceAGeometry(P0), { sleeveLengthCm: SL, backUnderarmWidthCm: 21 });
  ok(wok === wn && !w21.ok && w21.reason === "under-curve-unreachable", "6: 폭 지원 범위 — 뒤·앞 17~20 전부 성립(" + wok + "/" + wn + ") · 21 거부(" + w21.reason + ")");
  const pert = { backStarAboveMCm: [1.5, 2.5], frontStarAboveMCm: [3, 4], backUnderHandleRatio: [1.2, 1.6], frontUnderHandleRatio: [0.3, 0.5], releaseBeyondApCm: [3, 5], releaseHandleRatio: [0.4, 0.6],
    backLowerJoinCm: [0.5, 1.5], frontLowerJoinCm: [1.5, 2.5], shoulderFairCm: [1.5, 2.5], cuffFairCm: [2.5, 3.5], frontBulgeCm: [0.4, 0.8], backSlopeDropCm: [1, 1.6], frontSlopeDropCm: [1.7, 2.3], capHeightRatio: [0.45, 0.55] };
  let n = 0, good = 0; const why = {}; const bad2 = [];
  Object.keys(pert).forEach(k => pert[k].forEach(v => { n++; const p = { sleeveLengthCm: SL }; p[k] = v; const r = SW.draftSleeveW(bodice0, SRA.bodiceAGeometry(P0), p);
    if (r.ok) { good++; const LL = chainLoop(r.geometry.outline); if (LL.gap > 1e-6 || selfX(LL.loop) || r.meta.checks.overlap !== false || !near(r.meta.raglan.back.diffCm, 0, 2e-4) || !near(r.meta.raglan.front.diffCm, 0, 2e-4)) bad2.push(k + "=" + v); }
    else why[r.reason] = (why[r.reason] || 0) + 1; }));
  ok(!bad2.length && good >= n - 2, "6: 설정값 ±스윕 — " + good + "/" + n + " 성립 · 폐곡선·겹침 없음·달림선 같음(거부 " + J(why) + " · 문제 " + bad2.slice(0, 3).join(",") + ")");
  ok(!SW.draftSleeveW(bodice0, SRA.bodiceAGeometry(P0), { sleeveLengthCm: 8 }).ok && SW.draftSleeveW(bodice0, SRA.bodiceAGeometry(P0), {}).reason === "invalid-input", "6: 소매길이 ≤ ◉ · 빈 값 거부");
}

// ── 7. 원본 불변 · 게이트 · Ⓥ 보존(재사용 경계) ──
{
  ok(J(bodice0) === bodiceJ0 && J({ f: P0.working.geometry.front, b: P0.working.geometry.back }) === geoFB0, "7: 제도 후 bodiceResult · 작업 몸판 형상 무변경");
  const PB = projectWithBodice(presetOf("B")), rb = SWA.apply(PB, { sleeveLengthCm: SL });
  ok(!rb.ok && rb.reason === "bodice-not-a" && !PB.working.sleeveW, "7: 몸판 Ⓑ 거부(Ⓐ 형상 게이트)");
  const v = SV.draftSleeveV(bodice0, SRA.bodiceAGeometry(P0), { sleeveLengthCm: SL });
  ok(v.ok && J(v.derivedBodice) === J(d0.derivedBodice), "7: 파생 몸판 = Ⓥ 와 같은 형상(몸판 공정 동일)");
  const slvV = pc => [].concat(...["sleeveRaglan", "sleeveNeck", "sleeveTop", "sleeveCuff", "sleeveUnderarm"].map(k => polySeg(v.meta.draftLayer[pc][k], 200)));
  ok(v.geometry.centerSeam === true && v.geometry.layoutGapCm === 4 && v.meta.fairing.spCm === 3 && haus(slvV("back"), APPROVED_V.pieces.sleeveBack) < 0.02 && near(v.meta.seams.center.diffCm, 0.016, 1e-3), "7: Ⓥ 기본 경로 보존(두 장 · 간격 4 · SP 다듬기 3 · 승인 시안 < 0.02 · 중심 솔기 차 0.016)");
}

// ── 8. 상태 연결 · 완료본 · 무효화 · 거부 시 상태 보존 ──
const Q = projectWithBodice(A_ID), bodiceJQ = J(BC.latest(Q));
{
  const r = SWA.apply(Q, { sleeveLengthCm: SL });
  ok(r.ok && Q.working.sleeveW && J(Q.working.geometry.sleeve) === J(g0) && J(Q.working.sleeveW.derivedBodice) === J(d0.derivedBodice), "8: 적용 — 상태 = 엔진 결과(geometry.sleeve 한 장 미러링)");
  const c = SC.check(Q);
  ok(c.ok && near(c.capLengths.back, m0.raglan.back.body.totalCm, 1e-4) && near(c.capLengths.front, m0.raglan.front.body.totalCm, 1e-4) && Math.abs(c.ease.total) < 2e-4, "8: 완료 전 검사 통과 · 소매 달림선 실측 = 몸판");
  const cp = SC.complete(Q), res = cp.result;
  ok(cp.ok && res.origin.presetId === "bunka-sleeve-W" && res.origin.methodPage === 53 && res.cap.kind === "raglan-seam" && res.cap.splitPoint === null && res.derivedBodice && Object.isFrozen(res) && res.geometry.butted === true && res.geometry.centerSeam === false, "8: 완료본 — 출처 Ⓦ · cap = 소매 달림선 · 한 장(맞댐) · 파생 몸판 소유 · 동결");
  ok(J(BC.latest(Q)) === bodiceJQ, "8: 적용·완료해도 bodiceResult 무변경");
  ok(SC.isCurrentSleeveChanged(Q) === false && SC.invalidatedByBodice(Q) === false, "8: 완료 직후 변경 없음");
  const S = Q.working.sleeveW, keys = SWA.keys(); let inv = 0; const miss = [];
  keys.forEach(k => { const p = Object.assign({}, S.parameters); p[k] = +(p[k] + (k === "cuffRatio" ? -0.05 : k === "lowerHandleRatio" ? 0.02 : k === "capHeightRatio" ? 0.01 : 0.1)).toFixed(4); const rr = SWA.apply(Q, p); if (rr.ok && SC.isCurrentSleeveChanged(Q) === true) inv++; else miss.push(k + (rr.ok ? "" : ":" + rr.reason)); });
  ok(inv === keys.length, "8: 입력 21개 각각 바꾸면 «변경됨»(" + inv + "/" + keys.length + " " + miss.join(",") + ")");
  SWA.apply(Q, { sleeveLengthCm: SL });
  ok(SC.isCurrentSleeveChanged(Q) === false, "8: 같은 입력으로 되돌리면 같은 서명");
  const before = J({ g: Q.working.geometry.sleeve, s: Q.working.sleeveW, r: Q.working.sleeveResult });
  const bad = SWA.apply(Q, { sleeveLengthCm: SL, backUnderarmWidthCm: 21 });
  ok(!bad.ok && J({ g: Q.working.geometry.sleeve, s: Q.working.sleeveW, r: Q.working.sleeveResult }) === before, "8: 거부된 적용은 상태·geometry·완료본을 바꾸지 않음");
  SWA.reject(Q, { reason: bad.reason, text: bad.text });
  const cb = SC.check(Q), cc = SC.complete(Q);
  ok(SWA.isBlocked(Q) && !cb.ok && cb.fails.indexOf("sleeve-w-blocked") >= 0 && !cc.ok && Q.working.sleeveResult === res && J(Q.working.geometry.sleeve) === J(g0), "8: 차단 표시 → 완료 불가 · 이전 완료본·형상 유지");
  SWA.apply(Q, { sleeveLengthCm: SL });
  ok(!SWA.isBlocked(Q) && SC.check(Q).ok, "8: 유효 입력 재적용으로 차단 해제");
  const gj = J(Q.working.geometry.sleeve); Q.working.geometry.sleeve.outline[0].commands[1].points[0].x += 0.01;
  ok(SC.check(Q).fails.indexOf("sleeve-w-geometry-mismatch") >= 0, "8: 형상 위조 → geometry-mismatch");
  Q.working.geometry.sleeve = JSON.parse(gj);
  Q.working.sleeveV = { presetId: "bunka-sleeve-V" };
  ok(SC.check(Q).fails[0] === "sleeve-line-conflict", "8: Ⓥ · Ⓦ 동시 → 라인 충돌");
  delete Q.working.sleeveV;
  const P3 = Q; P3.working.parameters.body = BP.bodyParams(presetOf("B")); P3.working.geometry = Object.assign(DB.computeGeometry(REF, { body: P3.working.parameters.body }), { sleeve: P3.working.geometry.sleeve });
  BC.complete(P3);
  ok(SC.invalidatedByBodice(P3) === true && !SC.check(P3).ok, "8: 몸판 다시 완료 → 소매 완료본 무효(몸판 변경)");
  const rd = SWA.rederive(P3);
  ok(!rd.ok && SWA.isBlocked(P3) && rd.reason === "bodice-not-a", "8: 몸판 변경 후 재제도 → Ⓐ 게이트 차단");
}

// ── 9. 카라 단계 목둘레 계약(범위 밖 — 길이 보존만 확인 · 한계 기록) ──
{
  ["back", "front"].forEach(pc => {
    const neckBody = segLen(d0.derivedBodice[pc].outline.find(s => s.edge === "neckline")), neckSlv = segLen(one(g0, "neck", pc));
    const orig = segLen(bodice0[pc].outline.find(s => s.edge === "neckline"));
    ok(near(neckBody + neckSlv, orig, 2e-4), "9: " + pc + " 목둘레 몸판 " + neckBody.toFixed(3) + " + 소매 " + neckSlv.toFixed(3) + " = 원래 " + orig.toFixed(3));
  });
  ok(m0.unconfirmed.some(t => /카라/.test(t) && /어깨 다트/.test(t)), "9: 카라 단계 한계(래글런 목 분할·뒤 소매 목 회전·어깨 다트 미반영) 기록");
}

// ── 10. 표시 ──
const P = projectWithBodice(A_ID); SWA.apply(P, { sleeveLengthCm: SL });
{
  const g = J(P.working.geometry.sleeve), md = SAN.buildModel(P);
  ok(md && md.line === "W" && md.title.indexOf("Ⓦ") >= 0 && /맞댐/.test(md.title) && /어깨 다트/.test(md.title), "10: 한 장 소매 표시(Ⓦ 제목 · 맞댐 · 어깨 다트)");
  ok(["back", "front", "sp", "butt", "dart", "leg-back", "leg-front", "rg1-back", "rg3-front", "ua-back", "cuff-front", "n-back", "star-front", "width-back", "dm", "len", "cap-h"].every(id => md.lines.some(l => l.id === id) || md.dims.some(d => d.id === id)), "10: 앞뒤 · SP = 다트 끝 · 맞댄 선 · 다트 다리 · 달림선 구간 · 맞춤 · 폭 · 소매길이 · ◉");
  ok(md.lines.some(l => l.block !== undefined && /차 -0\.016/.test(l.text)) && md.lines.some(l => l.block !== undefined && /28\.608 = 28\.608/.test(l.text)) && md.lines.some(l => l.block !== undefined && /반전 기준 19\.49 \/ 19\.09/.test(l.text)), "10: 설명 블록 — 다트 다리 차 기록 · 달림선 몸판 = 소매 · 폭 근거");
  const db = SAN.dolmanBodice(P);
  ok(db && db.back.cut === P.working.sleeveW.derivedBodice.back.outline && db.front.draft.length === 13 && db.back.draft.length === 17 && db.back.shoulder && db.back.shoulder.inset, "10: 몸판 위 재단선(파생) · 제도선 · 뒤 어깨 닫은 자리 확대");
  const ids = pc => db[pc].anno.lines.map(l => l.id);
  ok(["v1", "v2", "v3", "v4", "v5", "v6r", "v6d", "v7", "v8", "v9", "v10", "v10c", "v11", "v12", "w13"].every(id => ids("back").indexOf(id) >= 0) && ids("front").indexOf("v0") >= 0 && ids("front").indexOf("w13") >= 0 && db.back.anno.line === "W"
    && db.back.anno.lines.some(l => l.id === "pt-SP" && /다트 끝/.test(l.text)) && db.back.anno.lines.some(l => l.id === "v6d" && l.text === "1.30"), "10: 몸판 위 제도 순서 ①~⑫ + ⑬ 맞댐 · SP = 다트 끝 · 경사 1.30");
  const info = SWA.infoLines(P);
  ok(info.length >= 8 && info[0].indexOf("Ⓦ") >= 0 && info.some(l => /-0\.016/.test(l)) && info.some(l => /반전/.test(l)) && info.some(l => /출처 구분/.test(l)), "10: 정보 줄(Ⓦ · 다트 다리 차 · 폭 근거 · 출처 구분)");
  ok(J(P.working.geometry.sleeve) === g, "10: 표시가 geometry 를 바꾸지 않음");
}
// ── 11. 설명 글자·리더선이 다른 피스에 놓이지 않음 · 피스끼리 겹침 없음 · 뒤/앞 글자는 자기 쪽 ──
{
  const DLY = W.designLayout, gg = P.working.geometry, LA = DLY.autoLayout(gg, SAN.dolmanExtents(P));
  P.working.layout = { back: LA.back, front: LA.front, sleeve: LA.sleeve, collar: { dx: 0, dy: 0 }, placement: { back: "auto", front: "auto", sleeve: "auto", collar: "auto" } };
  const FSZ = { title: 12, side: 13, note: 8.5 }, fz = c => FSZ[c] || 9;
  const box = (x, y, an, t, c) => { const f = fz(c); let w = 0; for (let i = 0; i < t.length; i++) w += (t.charCodeAt(i) > 255 ? 1 : 0.58) * f; const x0 = an === "end" ? x - w : an === "middle" ? x - w / 2 : x; return { x0, x1: x0 + w, y0: y - f * 0.85 - 1, y1: y + f * 0.2 + 1 }; };
  const ov = (a, b) => a.x0 < b.x1 - 0.5 && b.x0 < a.x1 - 0.5 && a.y0 < b.y1 - 0.5 && b.y0 < a.y1 - 0.5;
  const ub = (a, b) => b ? { minX: Math.min(a.minX, b.minX), minY: Math.min(a.minY, b.minY), maxX: Math.max(a.maxX, b.maxX), maxY: Math.max(a.maxY, b.maxY) } : a;
  const ex = SAN.dolmanExtents(P), area = k => k === "sleeve" ? DLY.outlineBBoxOf(gg, k) : ub(DLY.outlineBBoxOf(gg, k), ex[k]);
  const db2 = SAN.dolmanBodice(P), sm = SAN.buildModel(P, { pieces: true }), bad = [];
  [1.5, 2.2, 3, 4.5, 6, 9].forEach(s => [["back", db2.back.anno], ["front", db2.front.anno], ["sleeve", sm]].forEach(([pc, model]) => {
    const others = ["back", "front", "sleeve"].filter(k => k !== pc).map(k => { const b = area(k), dx = LA[k].dx - LA[pc].dx, dy = LA[k].dy - LA[pc].dy; return { k, x0: (b.minX + dx) * s, x1: (b.maxX + dx) * s, y0: (b.minY + dy) * s, y1: (b.maxY + dy) * s }; });
    const LY = SAN.layout(model, s);
    LY.items.forEach(it => { const b = box(it.at.x * s + it.dx, it.at.y * s + it.dy, it.anchor, it.text, it.cls); others.forEach(o => { if (ov(b, o)) bad.push(s + " " + pc + "→" + o.k + " «" + it.text.slice(0, 12) + "»"); }); });
    LY.leaders.forEach(ld => { const ax = ld.at.x * s, ay = ld.at.y * s; for (let q = 0; q <= 24; q++) { const x = ax + ld.toPx.dx * q / 24, y = ay + ld.toPx.dy * q / 24; others.forEach(o => { if (x > o.x0 && x < o.x1 && y > o.y0 && y < o.y1) bad.push(s + " " + pc + " 리더→" + o.k); }); } });
  }));
  ok(bad.length === 0 && db2.front.anno.keepOutCm && sm.keepOutCm, "11: Ⓦ 설명 글자·리더선이 다른 피스 위에 없음 — 배율 6단계(" + [...new Set(bad)].slice(0, 3).join(" · ") + ")");
  const cross = [];
  [1.25, 1.56, 3, 6].forEach(s => {
    const Bx = {}; [["back", db2.back.anno], ["front", db2.front.anno], ["sleeve", sm]].forEach(([k, m]) => { const LY = SAN.layout(m, s); Bx[k] = LY.items.map(it => { const b = box(it.at.x * s + it.dx, it.at.y * s + it.dy, it.anchor, it.text, it.cls); return { t: it.text, b: { x0: b.x0 + LA[k].dx * s, x1: b.x1 + LA[k].dx * s, y0: b.y0 + LA[k].dy * s, y1: b.y1 + LA[k].dy * s } }; }); });
    const ks = ["back", "front", "sleeve"]; for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) Bx[ks[i]].forEach(a => Bx[ks[j]].forEach(b => { if (ov(a.b, b.b)) cross.push(s + " " + ks[i] + "«" + a.t.slice(0, 8) + "»×" + ks[j] + "«" + b.t.slice(0, 8) + "»"); }));
  });
  ok(cross.length === 0, "11: Ⓦ 피스끼리 설명 글자가 겹치지 않음 — 배율 4단계(" + cross.slice(0, 3).join(" · ") + ")");
  const side = [];
  [1.5, 2.2, 3, 4.5, 6, 9].forEach(s => { const LY = SAN.layout(sm, s); LY.items.forEach(it => { if (/^block|^legend/.test(it.id)) return; const b = box(it.at.x * s + it.dx, it.at.y * s + it.dy, it.anchor, it.text, it.cls);
    if ((/-back$/.test(it.id) || it.id === "dm") && b.x1 > 0.5) side.push(s + " «" + it.text.slice(0, 8) + "»"); if (/-front$/.test(it.id) && b.x0 < -0.5) side.push(s + " «" + it.text.slice(0, 8) + "»"); }); });
  ok(side.length === 0, "11: 뒤 글자는 맞댄 선 왼쪽 · 앞 글자는 오른쪽 — 배율 6단계(" + side.slice(0, 3).join(" · ") + ")");
}

// ── 12. 배선 ──
{
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8"), ui = fs.readFileSync(path.join(ROOT, "js", "ui.js"), "utf8");
  const ver = (f) => { const mm = html.match(new RegExp("js/" + f.replace(".", "\\.") + "\\?v=(\\d+)")); return mm ? mm[1] : null; };
  ok(["designSleeveW.js", "sleeveWApply.js", "designSleeveV.js"].every(f => ver(f) === "2026110301") && ["ui.js", "sleeveCheckpoint.js", "sleevePresets.js", "sleeveAnnotation.js"].every(f => ver(f) === (f === "ui.js" ? "2026111003" : f === "sleeveCheckpoint.js" ? "2026111001" : f === "sleeveAnnotation.js" ? "2026110404" : "2026110403")), "12: 변경 파일 캐시 버전 2026110301");
  ok(html.indexOf("js/designSleeveV.js") < html.indexOf("js/designSleeveW.js") && html.indexOf("js/designSleeveW.js") < html.indexOf("js/sleeveWApply.js") && html.indexOf("js/sleeveWApply.js") < html.indexOf("js/ui.js"), "12: 스크립트 순서(Ⓥ 엔진 → Ⓦ 엔진 → 상태 → ui)");
  const rec = SP.get("bunka-sleeve-W");
  ok(/id="rowSleeveW" hidden/.test(html) && rec.inputs.slice(1).every(i => new RegExp('id="inpSleeveW_' + i.key + '" type="number" step="[0-9.]+" value="' + String(i.defaultValue).replace(".", "\\.") + '"').test(html)) && !/inpSleeveW_spFairCm/.test(html), "12: Ⓦ 입력 칸 20개 = 레코드 기본값 · SP 다듬기 칸 없음");
  ok(/function applySleeveW\(/.test(ui) && /keep !== "W" && window\.sleeveWApply/.test(ui) && /sleeveWOn\(project\)\) \{ window\.sleeveWApply\.rederive/.test(ui) && /readSleeveTInputs\("W"\)/.test(ui) && /id === "bunka-sleeve-W" \? "Ⓦ"/.test(ui) && /getElementById\("rowSleeveW"\)/.test(ui) && /"inpSleeveW_" \+ k/.test(ui), "12: ui 연결(적용 · 배타 · 재제도 · 입력 · 기호 · 칸 표시 · 입력 동기화)");
  ["designSleeveW.js", "sleeveWApply.js"].forEach(f => { const t = fs.readFileSync(path.join(ROOT, "js", f), "utf8"); ok(!/localStorage|document\.|window\.addEventListener|scratchpad|\/tmp\//.test(t), "12: " + f + " DOM·storage·scratch 경로 미접근"); });
}

console.log("══════════════════════════════════════════════");
if (fails.length) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); }
console.log("결과: " + PASS + " PASS / " + FAIL + " FAIL");
process.exitCode = FAIL ? 1 : 0;
