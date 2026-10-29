// ══════════════════════════════════════════════
// sleeveSCheck.js — 소매 Ⓢ(P.49 하단 «Ⓡ 방법 + 소매 중심에 개더 분량 추가», 화면 검토용 시안) 전용 회귀:
//   카탈로그 · Ⓡ 출처(읽기 전용 재제도 · working.sleeveR 미사용) · 원래 반쪽 강체 평행 이동(합동) · **독립 호 길이**(소매산·소맷부리 = Ⓡ + G) ·
//   띠 바깥 개더 범위(호 길이) · 접속·폐곡선·자기교차 · G = 0 ⇒ Ⓡ 와 같음 · 원본 불변 · 완료본 소유·무효화 · 입력 거부(Ⓡ 거부 계승) · 스윕 · 표시 · 배선.
//   node test/harness/sleeveSCheck.js
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
  "designSleeveA.js", "sleevePresets.js", "sleeveAApply.js", "designSleeveQ.js", "sleeveQApply.js", "designSleeveR.js", "sleeveRApply.js", "designSleeveS.js", "sleeveSApply.js", "sleeveAnnotation.js"].forEach(load);
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, BC = W.bodiceCheckpoint, SP = W.sleevePresets, DS = W.designSleeve,
  SR = W.designSleeveR, SRA = W.sleeveRApply, SC = W.sleeveCheckpoint, SAN = W.sleeveAnnotation, SS = W.designSleeveS, SSA = W.sleeveSApply;
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));
const MK = (body) => ({ sourceBlock: { id: "blk", version: 2, schemaVersion: 8, canonicalHash: "abc" }, referenceGeometry: JSON.parse(J(REF)),
  working: { geometry: DB.computeGeometry(REF, { body }), parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body },
    patternLines: [], designOutline: null, frontPlacket: null } });
const presetOf = (sym) => { for (const f of BP.families()) for (const v of f.variants) if (v.symbol === sym && v.presetId) return v.presetId; return null; };
function projectWithBodice(id) { PROJECT = MK(BP.bodyParams(id)); const r = BC.complete(PROJECT); return r.ok ? PROJECT : null; }
const A_ID = presetOf("A");


// ── 독립 계측 도구(엔진 코드 미사용) ──
const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const cub = (q, t) => { const u = 1 - t; return { x: u * u * u * q[0].x + 3 * u * u * t * q[1].x + 3 * u * t * t * q[2].x + t * t * t * q[3].x, y: u * u * u * q[0].y + 3 * u * u * t * q[1].y + 3 * u * t * t * q[2].y + t * t * t * q[3].y }; };
const d1 = (q, t) => { const u = 1 - t; return { x: 3*u*u*(q[1].x-q[0].x)+6*u*t*(q[2].x-q[1].x)+3*t*t*(q[3].x-q[2].x), y: 3*u*u*(q[1].y-q[0].y)+6*u*t*(q[2].y-q[1].y)+3*t*t*(q[3].y-q[2].y) }; };
const cubsOf = (s) => { const o = []; let cur = null; s.commands.forEach(c => { if (c.type === "M") cur = c.points[0]; else { o.push([cur, c.points[0], c.points[1], c.points[2]]); cur = c.points[2]; } }); return o; };
const polyQ = (q, n = 4000) => { const a = []; for (let k = 0; k <= n; k++) a.push(cub(q, k / n)); return a; };
const plen = (p) => { let s = 0; for (let i = 1; i < p.length; i++) s += D(p[i - 1], p[i]); return s; };
const near = (a, b, t) => Math.abs(a - b) <= t;
const shQ = (q, dx) => q.map(p => ({ x: p.x + dx, y: p.y }));
const sameQ = (a, b, tol) => a.every((p, i) => D(p, b[i]) <= tol);
const role = (g, r) => g.outline.find(s => s.role === r);
const segX = (a, b, c, d) => { const o = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x); const e1 = o(c, d, a), e2 = o(c, d, b), e3 = o(a, b, c), e4 = o(a, b, d); return ((e1 > 0 && e2 < 0) || (e1 < 0 && e2 > 0)) && ((e3 > 0 && e4 < 0) || (e3 < 0 && e4 > 0)); };
function loopOf(g) { let L = []; cubsOf(role(g, "cap")).forEach((q, i) => { L = L.concat(polyQ(q, 60).slice(i ? 1 : 0)); }); L.push(role(g, "underarm-front").to); cubsOf(role(g, "hem")).forEach(q => { L = L.concat(polyQ(q, 60).slice(1)); }); L.push(role(g, "underarm-back").to); return L; }
function selfX(L) { const n = L.length - 1; for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) { if (i === 0 && j === n - 1) continue; if (segX(L[i], L[i + 1], L[j], L[j + 1])) return true; } return false; }

// ── 1. 카탈로그 ──
{
  const rec = SP.get("bunka-sleeve-S"), fam = SP.families().find(f => f.id === "dolman-sleeve"), v = fam && fam.variants.find(x => x.id === "bunka-sleeve-S");
  ok(rec && rec.methodPage === 49 && rec.inputs.map(i => i.key + "=" + i.defaultValue).join() === "spreadCm=12,capGatherSideCm=6" && J(SS.RULES.defaults) === J({ spreadCm: 12, capGatherSideCm: 6 }), "1: Ⓢ 레코드 = 총 벌림 12 · 띠 바깥 개더 범위 6(책 설정값 · 서로 다른 입력)");
  ok(v && v.availability === "available" && v.presetId === "bunka-sleeve-S" && !v.blockedBy, "1: 돌먼 계열 Ⓢ 실행 가능");
}

// ── 2. 적용 · Ⓡ 출처(읽기 전용) · 강체 평행 이동 ──
const Q = projectWithBodice(A_ID); PROJECT = Q;
const bodice0 = J(BC.latest(Q)), ref0 = J(Q.referenceGeometry), front0 = J(Q.working.geometry.front), back0 = J(Q.working.geometry.back);
const rr = SRA.draft(Q, {});   // 같은 몸판의 Ⓡ(독립 비교용 — 상태 변경 없음)
const ap = SSA.apply(Q, {});
const S = Q.working.sleeveS, m = S && S.meta, g = Q.working.geometry.sleeve;
ok(ap.ok && S && !Q.working.sleeveR && S.presetId === "bunka-sleeve-S" && S.bodicePresetId === "bunka-bodice-A", "2: 적용 · working.sleeveR 은 만들지 않음(Ⓢ 가 Ⓡ 인 척하지 않음)");
ok(J(S.derivedBodice) === J(rr.derivedBodice) && J(S.rMeta) === J(rr.meta) && m.source.presetId === "bunka-sleeve-R", "2: 파생 몸판 = 같은 몸판의 Ⓡ 파생 몸판 그대로 · Ⓡ meta 출처 보관");
{
  const rc = cubsOf(role(rr.geometry, "cap")), rh = cubsOf(role(rr.geometry, "hem")), sc = cubsOf(role(g, "cap")), sh = cubsOf(role(g, "hem"));
  ok(sc.length === 4 && sh.length === 4 && sameQ(sc[0], shQ(rc[0], -6), 1e-12) && sameQ(sc[3], shQ(rc[1], 6), 1e-12) && sameQ(sh[0], shQ(rh[0], 6), 1e-12) && sameQ(sh[3], shQ(rh[1], -6), 1e-12), "2: 원래 소매산·소맷부리 반쪽 = Ⓡ 를 뒤 −6 · 앞 +6 강체 평행 이동(합동)");
  const ub = role(g, "underarm-back"), uf = role(g, "underarm-front"), rub = role(rr.geometry, "underarm-back"), ruf = role(rr.geometry, "underarm-front");
  ok(near(D(ub.from, ub.to), D(rub.from, rub.to), 1e-12) && near(ub.from.x - rub.from.x, -6, 1e-12) && near(uf.to.x - ruf.to.x, 6, 1e-12) && near(ub.from.y, rub.from.y, 1e-12), "2: 소매 밑선 = 평행 이동(길이·방향 그대로)");
  ok(near(sc[1][0].x, -6, 1e-12) && near(sc[1][3].x, 0, 1e-12) && near(sc[2][3].x, 6, 1e-12) && [sc[1], sc[2], sh[1], sh[2]].every(q => q.every(p => near(p.y, q[0].y, 1e-12))) && near(sh[1][0].y, 26, 1e-12), "2: 띠 위·아래 변 = 수평 직선(평평 · 회전·상승 없음) · SP′ 마디 x=0");
  const hz = (v) => Math.abs(v.y) / Math.hypot(v.x, v.y) < 1e-9;
  ok(hz(d1(sc[0], 1)) && hz(d1(sc[3], 0)) && hz(d1(sh[0], 1)) && hz(d1(sh[3], 0)) && m.joints.capAtBandBackDeg < 1e-6 && m.joints.hemAtBandFrontDeg < 1e-6, "2: 띠 경계 접속 — 원래 반쪽 끝 접선 수평(독립) = 띠 변과 접선 연속");
  const L = loopOf(g);
  ok(D(L[0], L[L.length - 1]) < 1e-9 && !selfX(L), "2: 폐곡선 · 자기교차 없음(독립 점열)");
  const oc = g.construction.filter(c => /^old-center/.test(c.role)), cl = g.construction.find(c => c.role === "center-line");
  ok(oc.length === 2 && near(oc[0].from.x, -6, 1e-12) && near(oc[1].from.x, 6, 1e-12) && cl && near(cl.from.x, 0, 1e-12) && J(g.capSplit) === J({ x: 0 }), "2: 옛 중심선 ◎ 두 개(x = ±6) · 새 결 x=0 · capSplit 중심");
}

// ── 3. 독립 호 길이 · 이세/개더 구분 · 소맷부리 ──
{
  const sc = cubsOf(role(g, "cap")), sh = cubsOf(role(g, "hem")), rc = cubsOf(role(rr.geometry, "cap")), rh = cubsOf(role(rr.geometry, "hem"));
  const capB = plen(polyQ(sc[0])) + plen(polyQ(sc[1])), capF = plen(polyQ(sc[2])) + plen(polyQ(sc[3])), rcapB = plen(polyQ(rc[0])), rcapF = plen(polyQ(rc[1]));
  ok(near(capB - rcapB, 6, 1e-9) && near(capF - rcapF, 6, 1e-9) && near(capB, m.cap.back, 2e-3) && near(capF, m.cap.front, 2e-3), "3: 소매산 뒤·앞 = Ⓡ + G/2 (독립 " + capB.toFixed(3) + " / " + capF.toFixed(3) + ")");
  const prim = DS.capPrimitives(g);
  ok(prim && near(prim.lengths.back, m.cap.back, 5e-3) && near(prim.lengths.front, m.cap.front, 5e-3) && near(prim.splitPoint.x, 0, 1e-9), "3: 공용 소매산 계측(capSplit 중심 · 평평한 띠 포함) = 엔진");
  const hemS = sh.reduce((a, q) => a + plen(polyQ(q)), 0), hemR = rh.reduce((a, q) => a + plen(polyQ(q)), 0);
  ok(near(hemS - hemR, 12, 1e-9) && near(hemS, m.cuff.measuredHemCm, 2e-3) && near(m.cuff.formulaHemCm, 64, 1e-12) && near(m.cuff.attachCm, 26, 1e-12) && near(m.cuff.gatherActualCm, m.cuff.measuredHemCm - 26, 1e-12), "3: 소맷부리 실측 " + hemS.toFixed(3) + " = Ⓡ + 12 · 산식 2● + G = 64 · 커프스 26 · 실제 개더 = 실측 − 26");
  ok(near(m.ease.total, rr.meta.ease.total + 12, 1e-9) && near(m.ease.baseRCm, rr.meta.ease.total, 1e-12) && m.ease.addedGatherCm === 12 && near(m.ease.total, 11.90, 0.01), "3: 결과 차 " + m.ease.total.toFixed(3) + " = Ⓡ 기본 이세 " + rr.meta.ease.total.toFixed(3) + " + 추가 개더 12");
  ok(J(m.seams) === J(rr.meta.seams) && J(m.armhole) === J(rr.meta.armhole) && near(m.widthCm, rr.meta.widthCm + 12, 1e-12), "3: 밑선·몸판 진동 Ⓡ 그대로 · 폭 = Ⓡ + 12");
  // 띠 바깥 개더 범위: 띠 경계(−6,0)에서 원래 뒤 소매산을 따라 호 길이 6 인 점(독립)
  const pb = polyQ(sc[0], 8000).reverse(); let acc = 0, at = null; for (let i = 1; i < pb.length; i++) { acc += D(pb[i - 1], pb[i]); if (acc >= 6) { at = pb[i]; break; } }
  const pf = polyQ(sc[3], 8000); let acc2 = 0, at2 = null; for (let i = 1; i < pf.length; i++) { acc2 += D(pf[i - 1], pf[i]); if (acc2 >= 6) { at2 = pf[i]; break; } }
  ok(at && at2 && D(at, m.gather.cap.back) < 5e-3 && D(at2, m.gather.cap.front) < 5e-3 && m.gather.cap.zoneCm === 24 && m.gather.cap.sideCm === 6 && m.gather.cap.addedCm === 12 && m.gather.cuff.whole === true, "3: 소매산 개더 구간 24 = 띠 바깥 호 6 + G 12 + 6 (독립 끝점) · 소맷부리 전체");
}

// ── 4. G = 0 ⇒ Ⓡ 와 같은 형상 · 스윕 ──
{
  const z = SSA.draft(Q, { spreadCm: 0 });
  ok(z.ok && J(z.geometry) === J(rr.geometry) && z.meta.band === null && near(z.meta.cuff.measuredHemCm, rr.meta.cuff.measuredHemCm, 1e-12), "4: G = 0 → Ⓡ 한 장 소매와 같은 형상(0 폭 띠 조각 없음)");
  let n = 0, bad = 0, rej = 0;
  [0, 0.5, 3, 12, 20, 40].forEach(G => [0, 2, 6, 10, 20].forEach(sd => {
    const d = SSA.draft(Q, { spreadCm: G, capGatherSideCm: sd });
    if (!d.ok) { if (d.reason === "gather-zone-too-long") rej++; else bad++; return; }
    n++;
    const L = loopOf(d.geometry), hem = cubsOf(role(d.geometry, "hem")).reduce((a, q) => a + plen(polyQ(q, 800)), 0);
    if (D(L[0], L[L.length - 1]) > 1e-9 || selfX(L) || !near(hem, rr.meta.cuff.measuredHemCm + G, 5e-3) || !near(d.meta.gather.cap.zoneCm, G + 2 * sd, 1e-12)) bad++;
  }));
  ok(bad === 0 && n >= 24, "4: 스윕 G × 범위 " + (n + rej) + "조합 — 유효 " + n + " 모두 폐곡선·자기교차 없음·소맷부리 = Ⓡ + G · 범위 초과 거부 " + rej);
}

// ── 5. 입력 거부(clamp 없음) · Ⓡ 거부 계승 · 상태 불변 ──
{
  const g0 = J(Q.working.geometry), s0 = J(Q.working.sleeveS);
  const e1 = SSA.apply(Q, { spreadCm: -1 }), e2 = SSA.apply(Q, { capGatherSideCm: 50 }), e3 = SSA.apply(Q, { spreadCm: NaN }), e4 = SSA.apply(Q, { elbowGirthCm: 36 }), e5 = SSA.apply(Q, { hemDropCm: 0 }), e6 = SSA.apply(Q, { armholeHandle: 1 / 3 });
  ok(!e1.ok && e1.reason === "input-out-of-range" && !e2.ok && e2.reason === "gather-zone-too-long" && !e3.ok && e3.reason === "invalid-input", "5: 음수 벌림 · 반쪽 소매산보다 긴 개더 범위 · 숫자 아님 → 사유와 함께 거부");
  ok(!e4.ok && e4.reason === "cuff-corner-conflict" && /^Ⓡ 단계/.test(e4.text) && !e5.ok && e5.reason === "cuff-corner-conflict" && !e6.ok && e6.reason === "underarm-point-not-found", "5: Ⓡ 경계 거부 계승(큰 팔꿈치 · 소맷부리 아래 0 · 핸들 1/3) — 범위 확장 없음");
  ok(J(Q.working.geometry) === g0 && J(Q.working.sleeveS) === s0, "5: 거부 시 상태 불변");
}

// ── 6. 원본 불변 · 다른 몸판 거부 ──
{
  ok(J(BC.latest(Q)) === bodice0 && J(Q.referenceGeometry) === ref0 && J(Q.working.geometry.front) === front0 && J(Q.working.geometry.back) === back0, "6: bodiceResult · 원형 · 작업 몸판 무변경");
  const ids = []; BP.families().forEach(f => f.variants.forEach(v => { if (v.presetId && v.presetId !== A_ID) ids.push(v.presetId); }));
  let allRej = true; ids.forEach(id => { const P2 = projectWithBodice(id); if (!P2) return; PROJECT = P2; const r = SSA.apply(P2, {}); if (r.ok || r.reason !== "bodice-not-a" || P2.working.sleeveS) allRej = false; });
  PROJECT = Q;
  ok(ids.length >= 20 && allRej, "6: 몸판 Ⓐ 외 " + ids.length + "종 모두 bodice-not-a 거부(Ⓡ 게이트 계승)");
}

// ── 7. 완료본 소유 · 무효화 ──
{
  PROJECT = Q; SSA.apply(Q, {});
  const c = SC.check(Q); ok(c.ok && c.preset === "bunka-sleeve-S", "7: 완료 게이트 통과(" + c.fails.join(",") + ")");
  const cm = SC.complete(Q), res = cm.result;
  ok(cm.ok && res.origin.presetId === "bunka-sleeve-S" && res.origin.sourcePresetId === "bunka-sleeve-R" && J(res.derivedBodice) === J(S.derivedBodice) && res.inputs.spreadCm === 12 && res.inputs.capGatherSideCm === 6 && res.inputs.elbowGirthCm === 22, "7: 완료본 = Ⓢ 출처 · 파생 몸판 소유 · 입력 12개");
  ok(!SC.isCurrentSleeveChanged(Q), "7: 완료 직후 변경 없음");
  const R2 = projectWithBodice(A_ID); PROJECT = R2; SRA.apply(R2, {}); const rres = SC.complete(R2).result; PROJECT = Q;
  ok(rres && rres.hash !== res.hash && rres.origin.presetId === "bunka-sleeve-R", "7: 같은 몸판 Ⓡ 완료본과 hash 다름(섞이지 않음)");
  SSA.apply(Q, { spreadCm: 10 }); ok(SC.isCurrentSleeveChanged(Q), "7: 총 벌림 변경 → 다시 완료 필요");
  SSA.apply(Q, {}); ok(!SC.isCurrentSleeveChanged(Q), "7: 되돌리면 같음");
  SSA.apply(Q, { capGatherSideCm: 5 }); ok(SC.isCurrentSleeveChanged(Q), "7: 개더 범위 변경 → 다시 완료 필요");
  SSA.apply(Q, { elbowGirthCm: 24 }); ok(SC.isCurrentSleeveChanged(Q), "7: Ⓡ 입력 변경 → 다시 완료 필요");
  SSA.apply(Q, {}); Q.working.sleeveS.derivedBodice.back.outline[1].to.x += 0.01;
  const ct = SC.check(Q); ok(!ct.ok && ct.fails.indexOf("sleeve-s-geometry-mismatch") >= 0, "7: 파생 몸판 변조 → 완료 거부");
  SSA.apply(Q, {});
  const QB = projectWithBodice(A_ID); PROJECT = QB; SSA.apply(QB, {});
  const idB = presetOf("B"); QB.working.geometry = DB.computeGeometry(REF, { body: BP.bodyParams(idB) }); QB.working.parameters.body = BP.bodyParams(idB); BC.complete(QB);
  const rd = SSA.rederive(QB);
  ok(!rd.ok && rd.reason === "bodice-not-a" && QB.working.sleeveS.blocked && !SC.check(QB).ok, "7: 몸판을 B 로 바꾸면 재제도 차단(bodice-not-a) · 완료 불가");
  PROJECT = Q;
}

// ── 8. 표시(설명 전용 · geometry/hash 불변) ──
{
  PROJECT = Q; SSA.apply(Q, {});
  const g0 = J(Q.working.geometry), h0 = Q.working.sleeveS.derivedHash, c0 = J(SC.check(Q));
  const md = SAN.buildModel(Q), ids = md.lines.map(l => l.id), tx = md.lines.map(l => l.text).join("\n");
  ok(md && md.line === "S" && ["band", "old-back", "old-front", "grain", "g-back", "g-front", "g-zone", "back", "front", "cap-back", "cap-front", "ua-back", "ua-front", "x-back", "x-front", "hem", "guide-back", "guide-front"].every(k => ids.indexOf(k) >= 0) && md.dims.map(d => d.id).join() === "spread,len,width", "8: 한 장 Ⓢ 설명(띠 · ◎ 두 개 · 결 · 개더 범위 · 앞뒤 · 소매산/밑선/소맷부리 · X · G/중심/폭 치수)");
  ok(md.zones.map(z => z.id + ":" + z.cls).join() === "paper-back:paper,paper-front:paper,band:band", "8: 원래 Ⓡ 종이(초록) 두 장 · 새 띠(노랑) 구분");
  ok(tx.indexOf("커프스 달림 ● 26.00") >= 0 && tx.indexOf("2● + G = 64.00") >= 0 && tx.indexOf("곡선 실측 " + m.cuff.measuredHemCm.toFixed(2)) >= 0 && tx.indexOf("실제 개더 " + m.cuff.gatherActualCm.toFixed(2)) >= 0 && /Ⓡ 기본 이세 -0\.10 \+ 추가 개더 12\.00/.test(tx) && /개더 구간 24\.00 = 6\.00 \+ G 12\.00 \+ 6\.00/.test(tx), "8: 커프스·산식·실측·개더 · 기본 이세/추가 개더 · 개더 구간 구분");
  const dS = SAN.dolmanBodice(Q), R3 = projectWithBodice(A_ID); PROJECT = R3; SRA.apply(R3, {}); const dR = SAN.dolmanBodice(R3); PROJECT = Q;
  ok(dS && dR && J(dS.back.anno.lines) === J(dR.back.anno.lines) && J(dS.front.cut) === J(dR.front.cut) && SAN.dolmanExtents(Q).sleeveBelow === true, "8: 몸판 위 제도 설명 = Ⓡ 와 같은 의미(같은 공정 ①~⑧) · 한 장 소매는 몸판 아래 줄");
  ok(J(Q.working.geometry) === g0 && Q.working.sleeveS.derivedHash === h0 && J(SC.check(Q)) === c0, "8: 설명 계산은 geometry·hash·완료 게이트 불변");
  ok(SAN.layout(md, 11 * 0.6).items.length > 20 && SAN.overhang(Q, 11 * 0.4, { info: true, ref: false }) !== null, "8: 글자 배치 · fit 여백 계산");
  const R4 = projectWithBodice(A_ID); PROJECT = R4; SRA.apply(R4, {}); ok(SAN.buildModel(R4).line === "R", "8: Ⓡ 설명 모델은 그대로 R"); PROJECT = Q;
  SSA.reject(Q, { reason: "invalid-input", text: "x" }); ok(SAN.buildModel(Q) === null && SAN.dolmanBodice(Q) === null && SSA.infoLines(Q).some(t => /차단/.test(t)), "8: 차단이면 설명 없음 · 정보 줄 차단 안내");
}

// ── 9. 배선 ──
{
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8"), ui = fs.readFileSync(path.join(ROOT, "js", "ui.js"), "utf8");
  const ver = (f) => { const mm = html.match(new RegExp("js/" + f.replace(".", "\\.") + "\\?v=(\\d+)")); return mm ? mm[1] : null; };
  const idx = (f) => html.indexOf("js/" + f + "?v=");
  ok(idx("sleeveRApply.js") < idx("designSleeveS.js") && idx("designSleeveS.js") < idx("sleeveSApply.js") && idx("sleeveSApply.js") < idx("ui.js"), "9: 스크립트 순서(Ⓡ → Ⓢ 엔진 → Ⓢ 연결 → ui)");
  ok(["designSleeveS.js", "sleeveSApply.js"].every(f => ver(f) === "2026102907") && ["sleevePresets.js", "ui.js", "sleeveCheckpoint.js", "sleeveAnnotation.js"].every(f => ver(f) === "2026102911") && /css\/style\.css\?v=2026102907/.test(html), "9: 변경 파일 캐시 버전 2026102907");
  ok(SSA.S_KEYS.every(k => { const mm = html.match(new RegExp('id="inpSleeveS_' + k + '"[^>]*value="([^"]+)"')); return mm && Number(mm[1]) === SS.RULES.defaults[k]; }) && /id="rowSleeveS" hidden/.test(html), "9: Ⓢ 입력칸 2개 · 기본값 = 엔진 · 기본 숨김");
  ok(/function applySleeveS\(/.test(ui) && /keep !== "S" && window\.sleeveSApply/.test(ui) && /sleeveSOn\(project\)\) \{ window\.sleeveSApply\.rederive/.test(ui) && /sleeveROn\(project\) \|\| sleeveSOn\(project\)( \|\| sleeveTOn\(project\))?( \|\| sleeveUOn\(project\))?; \}/.test(ui), "9: ui 연결(적용 · 배타 · 재제도 · 라인 켜짐)");
}

console.log("══════════════════════════════════════════════");
if (fails.length) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); }
console.log("결과: " + PASS + " PASS / " + FAIL + " FAIL");
if (FAIL) { console.log("[FAILED]"); process.exit(1); }
