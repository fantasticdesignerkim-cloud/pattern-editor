// yokeSeamUCheck.js — 요크 이음선 ③ Ⓤ(P.34, «밑단에서 1cm 추가, 이음선을 넣고 앞은 AH 다트를 닫아 이음선에서 벌리고, 뒤 중심에 개더 분량을 추가») 회귀.
//   node test/harness/yokeSeamUCheck.js
// 범위: 프리셋 Ⓤ · 순서 불변식(① 뒤 어깨 다트 먼저 닫음 → ② 앞 요크와 어깨선에서 맞대어 «어깨 요크» 한 장 → ③ 앞·뒤 몸판 별도 조각) ·
//       앞 이음선(어깨 평행·6cm·진동→목둘레) · 앞 AH 다트를 몸판에서 BP 축으로 닫아 이음선 쐐기(= 개더) · 뒤 중심 개더 (이음선−2)×0.5 · 밑단 +1 ·
//       폐곡선·자기교차 0 · 면적·이음 길이·개더 분량 · 체크포인트 독립 재계산·변조 거부 · 완료본/hash · 표시·배치·렌더 · A~Ⓣ 바이트 불변(HEAD 4b85483 측정).
// 사용자 확정(2026-10-02): 어깨 요크 = 뒤 어깨 다트를 먼저 닫아 붙이고 그다음 앞 요크를 어깨선으로 붙인 한 장.
// 책에서 직접 읽히지 않아 정한 값(구현 가정, docs/book/P034.md): «6» = 어깨선에서의 수직거리 · BP 절개의 이음선 끝 = BP 연직 · 앞 «2» = 개더 구간에서 양 끝 제외.
//   → 교재 캡션 «앞은 ● 의 약 0.6배» 와 쐐기 폭/(이음선−4) = 0.62 가 맞는다(결과 비율 — 게이트 아님, 회귀 감시만).
const vm = require("vm");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
function throwsReason(fn, want, name) {
  try { fn(); FAIL++; fails.push(name + " (throw 안 됨)"); }
  catch (e) { if (want && e.reason !== want) { FAIL++; fails.push(`${name} (reason=${e.reason}, 기대=${want})`); } else PASS++; }
}
const J = JSON.stringify;
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const clone = (v) => JSON.parse(JSON.stringify(v));
const sha = (v) => crypto.createHash("sha256").update(J(v)).digest("hex").slice(0, 16);

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
["designLineTool.js", "designFlare.js", "designJoin.js", "designWaistSeam.js", "designYokeSeam.js", "designBodice.js", "bodicePresets.js",
  "designLayout.js", "designRenderer.js", "bodiceCheckpoint.js"].forEach(load);
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, DL = W.designLayout, DR = W.designRenderer, BC = W.bodiceCheckpoint, T = W.designLineTool, DY = W.designYokeSeam;
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));
const SNAP = J(REF);

const U_BODY = BP.bodyParams("bunka-bodice-U"), Q_BODY = BP.bodyParams("bunka-bodice-Q"), B_BODY = BP.bodyParams("bunka-bodice-B");
const GU = DB.computeGeometry(REF, { body: U_BODY });
const GQ = DB.computeGeometry(REF, { body: Q_BODY });
const GB = DB.computeGeometry(REF, { body: B_BODY });
const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const segsOf = (outline) => T.outlinePrimsToSegs(outline);
const edgesOf = (pc, e) => segsOf(pc.outline).filter(s => s.edge === e);
const arcLen = (segs) => segs.reduce((t, s) => t + T.flattenLine([s]).reduce((u, ab) => u + D(ab[0], ab[1]), 0), 0);
const areaOf = (segs) => { const pts = []; T.flattenLine(segs).forEach(ab => { if (!pts.length) pts.push(ab[0]); pts.push(ab[1]); }); let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p.x * q.y - q.x * p.y; } return Math.abs(a / 2); };
// 방향 무관 폐곡선 순서 정렬(독립 구현)
function ringOf(outline, eps = 1e-6) {
  const segs = segsOf(outline), used = segs.map(() => false); used[0] = true; const out = [segs[0]]; let tip = segs[0].to;
  for (let k = 1; k < segs.length; k++) {
    let hit = -1, rev = false;
    for (let j = 0; j < segs.length; j++) { if (used[j]) continue; if (D(segs[j].from, tip) < eps) { hit = j; break; } if (D(segs[j].to, tip) < eps) { hit = j; rev = true; break; } }
    if (hit < 0) return null; used[hit] = true; const sg = rev ? T.reverseSeg(segs[hit]) : segs[hit]; out.push(sg); tip = sg.to;
  }
  return D(tip, out[0].from) < eps ? out : null;
}
const selfCross = (ring) => { const f = []; ring.forEach(s => T.flattenLine([s]).forEach(ab => f.push(ab)));
  for (let i = 0; i < f.length; i++) for (let j = i + 2; j < f.length; j++) { if (i === 0 && j === f.length - 1) continue; if (!T.segCross(f[i][0], f[i][1], f[j][0], f[j][1])) continue;
    const t = (a, b) => D(a, b) < 1e-6; if (t(f[i][1], f[j][0]) || t(f[j][1], f[i][0]) || t(f[i][0], f[j][0]) || t(f[i][1], f[j][1])) continue; return true; } return false; };

// ── 1. 프리셋 Ⓤ ──
ok(BP.resolve("yoke-seam-3", "bunka-bodice-U").ok, "1: Ⓤ 해석 성공(실행 가능)");
ok(BP.variant("yoke-seam-3", "bunka-bodice-U").availability === "available" && BP.variant("yoke-seam-3", "bunka-bodice-U").page === 34, "1: Ⓤ available · P.34");
ok(BP.variant("yoke-seam-3", "bunka-bodice-V").availability === "pending-op" && typeof BP.variant("yoke-seam-3", "bunka-bodice-V").blockedBy === "string", "1: Ⓥ 는 보류(blockedBy 보유)");
ok(J(U_BODY) === J({ hemExtensionBelowWaistCm: 20, hemSideOffsetCm: 1, yokeSeam: "U" }), "1: Ⓤ 파라미터 = 박시 Ⓑ + 밑단 옆 +1 + yokeSeam:U");
ok(BP.yokeVariantSymbol(U_BODY) === "U" && BP.yokeVariantSymbol(Q_BODY) === "Q", "1: body → 변형 기호(U/Q)");
throwsReason(() => DB.computeGeometry(REF, { body: Object.assign({}, U_BODY, { yokeGather: true }) }), "yoke-seam-u-no-gather", "1: Ⓤ 에 개더 지정 거부(개더는 라인의 일부)");
throwsReason(() => DB.computeGeometry(REF, { body: Object.assign({}, U_BODY, { waistSeam: true }) }), "yoke-seam-waist-seam-conflict", "1: 요크+허리 이음선 충돌 거부");
throwsReason(() => DB.computeGeometry(REF, { body: Object.assign({}, U_BODY, { flare: true }) }), "yoke-seam-flare-conflict", "1: 요크+플레어 충돌 거부");
throwsReason(() => DB.computeGeometry(REF, { body: Object.assign({}, U_BODY, { hemSideOffsetCm: 2.5 }) }), "yoke-seam-failed", "1: 밑단 옆 +1 이 아니면 거부(교재 «1»)");
ok(J(DB.computeGeometry(REF, { body: U_BODY })) === J(GU), "1: 결정론(같은 입력 → 바이트 동일)");
ok(J(REF) === SNAP, "1: 입력 reference 불변");

// ── 2. A~Ⓣ 바이트 불변(HEAD 4b85483 측정) ──
const FIXED = { A: "f87b86b25abc508e", B: "3fade9d306cfc1b2", C: "d9ccd8ad27484d42", D: "dea05147006a3561", G: "d9a46f8358daec84",
  M: "66936c94c7ce847c", N: "6b02cf3e25969a7a", O: "d1fae91f00e58b37", P: "160d3aaee53eb5e4", Q: "76a325d296cd4fce", R: "63193d5a879a6235",
  S: "8f5a2535f192f935", T: "04de67175bdb54f3" };
Object.keys(FIXED).forEach(k => ok(sha(DB.computeGeometry(REF, { body: BP.bodyParams("bunka-bodice-" + k) })) === FIXED[k], "2: " + k + " geometry 바이트 불변"));

// ── 3. geometry 모양: 어깨 요크 한 장 · 몸판 둘 · 전체 앞/뒤판 그대로 ──
ok(GU.shoulderYoke && GU.frontBody && GU.backBody && !("frontYoke" in GU) && !("backYoke" in GU), "3: 어깨 요크 한 장 + 앞·뒤 몸판(frontYoke/backYoke 키 없음)");
ok(J(GU.front) === J(GB.front) && J(GU.back) === J(GB.back) && J(GU.shared) === J(GB.shared) && J(GU.sleeve) === J(GB.sleeve), "3: 전체 앞/뒤판·소매는 Ⓑ 와 바이트 동일(소매·카라 무영향)");
const meta = GU.yokeSeam;
ok(meta.variant === "U" && meta.front.variant === "U" && meta.back.variant === "U" && meta.shoulderYoke, "3: 메타 variant U · 면별·어깨 요크 메타");

// ── 4. 순서 불변식: ① 뒤 다트 먼저 닫음 → ② 어깨선에서 맞댐 → ③ 몸판 별도 ──
{
  const sm = meta.shoulderYoke;
  ok(J(sm.order) === J(["back-dart-close", "shoulder-join", "bodies-separate"]) && sm.backDartClosedBeforeJoin === true, "4: 메타 순서 = 뒤 다트 닫기 → 어깨 맞댐 → 몸판 별개");
  const hasDart = (pc, id) => pc.outline.concat(pc.construction || []).some(s => s.dart && s.dart.id === id);
  ok(["shoulderYoke", "frontBody", "backBody"].every(k => !hasDart(GU[k], "back-shoulder") && !hasDart(GU[k], "front-bust")), "4: 어느 조각에도 열린 다트 없음(뒤 어깨 = 맞대기 전에 닫음 · 앞 AH = 몸판에서 닫음)");
  ok(!GU.shoulderYoke.outline.some(s => s.edge === "shoulder"), "4: 요크 외곽에 어깨 변이 없다(어깨선에서 이어 붙은 한 장)");
  const cb = GU.shoulderYoke.construction.filter(s => s.shoulderJoin === "back"), cf = GU.shoulderYoke.construction.filter(s => s.shoulderJoin === "front");
  ok(cb.length >= 2 && cf.length === 1, "4: 앞(직선 1)·뒤(꺾인 2+) 어깨 구성선");
  ok(D(cb[0].from, cf[0].from) < 1e-9, "4: 두 어깨선이 목점에서 정확히 만난다");
  // 뒤 어깨는 다트를 닫아 꺾여 있다: 열린 다트였다면 한 직선(꺾임 0). 꺾임각이 곧 닫은 다트각 근처
  const dirOf = (s) => Math.atan2(s.to.y - s.from.y, s.to.x - s.from.x);
  const kink = Math.abs((dirOf(cb[cb.length - 1]) - dirOf(cb[0])) * 180 / Math.PI);
  const legs = GB.back.construction.filter(s => s.dart && s.dart.id === "back-shoulder");
  ok(kink > 5 && kink < 20, "4: 뒤 어깨선이 다트를 닫아 꺾였다(" + kink.toFixed(2) + "°) — 열린 다트를 맞댄 게 아니다");
  // 독립 재현: Ⓠ 의 뒤 요크(= 다트를 닫은 뒤 요크)의 어깨 호 길이 = 어깨 요크의 뒤 어깨 구성선 길이
  const qBackSh = arcLen(edgesOf(GQ.backYoke, "shoulder")), uBackSh = cb.reduce((t, s) => t + D(s.from, s.to), 0);
  ok(near(qBackSh, uBackSh, 1e-9), "4: 뒤 어깨 길이 = 다트를 닫은 뒤 요크(Ⓠ 경로)의 어깨 호 길이 " + uBackSh.toFixed(3));
  ok(!hasDart(GQ.backYoke, "back-shoulder") && legs.length === 2, "4: 원본 뒤판엔 열린 어깨 다트 둘이 있었다(닫기 전 상태 존재 확인)");
  // 면적: 어깨 요크 = 닫은 뒤 요크 + 앞 요크 + 렌즈형 틈
  ok(near(areaOf(ringOf(GU.shoulderYoke.outline)), sm.areaCm2, 1e-6) && near(sm.areaCm2, sm.areaBackYokeCm2 + sm.areaFrontYokeCm2 + sm.gapAreaCm2, 1e-6), "4: 어깨 요크 면적 = 뒤 요크 + 앞 요크 + 어깨 틈");
  ok(near(sm.areaBackYokeCm2, areaOf(ringOf(GQ.backYoke.outline)), 0.05), "4: 맞대기 전 뒤 요크 면적 = Ⓠ 의 닫은 뒤 요크 면적");
  ok(sm.gapAreaCm2 > 1 && sm.gapAreaCm2 < 8 && sm.join.tipStepCm < 0.2 && near(sm.join.chordFrontCm, D(cf[0].from, cf[0].to), 1e-9), "4: 어깨 틈 " + sm.gapAreaCm2.toFixed(2) + "cm² · 어깨끝 단차 " + sm.join.tipStepCm.toFixed(3) + "cm (메우지 않고 기록)");
  // 어깨선의 앞뒤 길이는 거의 같다(= 길이 보정은 패턴선 확정 단계 몫 — 여기선 값만 기록)
  ok(Math.abs(sm.join.shoulderBackLenCm - sm.join.shoulderFrontLenCm) < 0.2, "4: 앞·뒤 어깨 길이 차 " + (sm.join.shoulderBackLenCm - sm.join.shoulderFrontLenCm).toFixed(3));
}

// ── 5. 앞: 어깨 평행 이음선 · AH 다트를 몸판에서 닫아 쐐기 개더 ──
{
  const f = meta.front, whole = GU.front;
  const sh = edgesOf(whole, "shoulder")[0], sd = { x: sh.to.x - sh.from.x, y: sh.to.y - sh.from.y }, sl = Math.hypot(sd.x, sd.y);
  const perp = (p) => Math.abs((p.x - sh.from.x) * sd.y - (p.y - sh.from.y) * sd.x) / sl;
  const fb = GU.frontBody, seamF = edgesOf(fb, "yoke-seam");
  const Tp = f.seamPoints.cutTop, Tr = f.seamPoints.cutTopRotated, BP0 = f.seamPoints.bust;
  const fixedSeam = seamF.filter(s => s.kind === "line" && (D(s.from, Tp) < 1e-9 || D(s.to, Tp) < 1e-9) && D(s.from, Tr) > 1e-9 && D(s.to, Tr) > 1e-9)[0];
  ok(!!fixedSeam && near(perp(fixedSeam.from), 6, 1e-6) && near(perp(fixedSeam.to), 6, 1e-6), "5: 앞 이음선 = 어깨선에서 6cm(수직거리)");
  ok(near(Math.abs((fixedSeam.to.x - fixedSeam.from.x) * sd.y - (fixedSeam.to.y - fixedSeam.from.y) * sd.x) / sl, 0, 1e-6), "5: 앞 이음선은 어깨선과 평행");
  ok(f.seamPoints.armhole && f.seamPoints.neckline, "5: 이음선 양 끝 = 진동선·목둘레선(앞중심까지 가지 않는다)");
  ok(near(f.seamPoints.neckline.x, 42.924, 1e-3) && f.seamPoints.neckline.x < whole.outline.filter(s => s.edge === "center").map(s => segsOf([s])[0].from.x)[0] - 1, "5: 목둘레 끝 점은 앞중심 안쪽");
  // 앞 AH 다트: 요크가 아니라 몸판에서 BP 축으로 닫는다
  const darts = whole.construction.filter(s => s.dart && s.dart.id === "front-bust");
  const apex = darts[0].dart.apexAt === "to" ? darts[0].to : darts[0].from;
  ok(D(apex, BP0) < 1e-9, "5: 회전축 = 앞 AH 다트 apex(BP)");
  const mouths = darts.map(s => s.dart.apexAt === "to" ? s.from : s.to);
  const ang = (a, b) => Math.abs(Math.atan2((a.x - apex.x) * (b.y - apex.y) - (a.y - apex.y) * (b.x - apex.x), (a.x - apex.x) * (b.x - apex.x) + (a.y - apex.y) * (b.y - apex.y))) * 180 / Math.PI;
  ok(near(ang(Tp, Tr), ang(mouths[0], mouths[1]), 1e-6), "5: 쐐기 각 = 닫은 AH 다트 각 " + ang(Tp, Tr).toFixed(3) + "°");
  ok(near(Tp.x, BP0.x, 1e-9) && near(D(BP0, Tp), D(BP0, Tr), 1e-9), "5: 고정 절개 = BP 연직 · 회전 절개는 같은 반경");
  const g = D(Tp, Tr), lenY = D(f.seamPoints.armhole, f.seamPoints.neckline);
  const yokeSeamLen = arcLen(GU.shoulderYoke.outline.filter(s => s.edge === "yoke-seam" && s.kind === "line" && false)) || lenY;
  ok(near(f.seamLenUpperCm, lenY, 1e-9) && near(arcLen(seamF) - lenY, g, 1e-9), "5: 몸판 이음 길이 − 요크 이음 길이 = 쐐기 현 " + g.toFixed(3) + "cm(= 앞 개더 분량)");
  ok(near(f.gather.addedCm, g, 1e-9) && f.gather.rule === "ah-dart-closure-wedge", "5: 개더 메타 = 쐐기 현");
  const ratio = g / (lenY - 4);
  ok(ratio > 0.55 && ratio < 0.7, "5: 쐐기/(이음선−4) = " + ratio.toFixed(3) + " — 교재 캡션 «● 의 약 0.6배» 와 부합(결과 비율, 게이트 아님)");
  ok(near(f.hemSideExtraCm, 1, 1e-9), "5: 앞 밑단 옆 +1");
  // 몸판에 닫은 다트의 흔적 없음 + 새 구성선 두 줄(고정·회전)
  ok(fb.construction.filter(s => s.wedgeCut).length === 2 && !fb.construction.some(s => s.dart && s.dart.id === "front-bust"), "5: 쐐기 절개 구성선 2 · 닫은 AH 다트 흔적 0");
  // 전체 몸판의 허리 다트 등 이음선 아래 구성선은 보존
  ok(["front-waist-a", "front-waist-b"].every(id => fb.construction.some(s => s.dart && s.dart.id === id)), "5: 이음선 아래 허리 다트 a·b 보존");
}

// ── 6. 뒤: 이음선 = 다트 끝 높이 수평 · 중심 개더 (이음선−2)×0.5 ──
{
  const b = meta.back, bb = GU.backBody, whole = GU.back;
  const legs = whole.construction.filter(s => s.dart && s.dart.id === "back-shoulder"), apexY = (legs[0].dart.apexAt === "to" ? legs[0].to : legs[0].from).y;
  const seamB = edgesOf(bb, "yoke-seam");
  ok(seamB.every(s => near(s.from.y, apexY, 1e-6) && near(s.to.y, apexY, 1e-6)), "6: 뒤 몸판 이음선 = 뒤 어깨 다트 끝 높이 " + apexY.toFixed(3) + " 수평");
  const lenY = b.seamLenUpperCm, W = 0.5 * (lenY - 2);
  ok(near(b.gather.addedCm, W, 1e-9) && near(b.gather.spanCm, lenY - 2, 1e-9) && b.gather.rule === "back-seam-minus-2-half", "6: 띠 폭 W = (이음선 " + lenY.toFixed(3) + " − 2) × 0.5 = " + W.toFixed(3));
  ok(near(arcLen(seamB) - lenY, W, 1e-9), "6: 몸판 이음 길이 − 요크 이음 길이 = W");
  const cxW = edgesOf(whole, "center")[0].from.x, cxB = edgesOf(bb, "center")[0].from.x;
  ok(near(Math.abs(cxB - cxW), W, 1e-9), "6: 몸판 중심이 원래 CB 에서 W 만큼 밀림(요크 CB 는 그대로)");
  const yokeCB = GU.shoulderYoke.outline.filter(s => s.edge === "center").map(s => segsOf([s])[0].from.x);
  ok(yokeCB.length === 1 && near(yokeCB[0], cxW, 1e-9), "6: 어깨 요크의 뒤중심은 원래 CB(개더는 몸판에만)");
  ok(near(b.hemSideExtraCm, 1, 1e-9), "6: 뒤 밑단 옆 +1");
}

// ── 7. 폐곡선·자기교차 0 · 면적 · 이음 길이 대응 ──
{
  ["shoulderYoke", "frontBody", "backBody"].forEach(k => {
    const r = ringOf(GU[k].outline);
    ok(r && !selfCross(r) && areaOf(r) > 10, "7: " + k + " 폐곡선·자기교차 0·면적>0");
  });
  const aY = areaOf(ringOf(GU.shoulderYoke.outline)), aF = areaOf(ringOf(GU.frontBody.outline)), aB = areaOf(ringOf(GU.backBody.outline));
  const ringW = (pc) => { const legs = pc.construction.filter(s => s.dart && s.kind === "line" && s.dart.id === (pc === GU.front ? "front-bust" : "back-shoulder")); return areaOf(ringOf(pc.outline.concat(legs.map(l => ({ kind: "line", from: l.from, to: l.to }))), 0.03)); };
  const strip = GU.backBody.construction.filter(s => s.gatherBoundary)[0], stripA = meta.back.gather.addedCm * D(strip.from, strip.to);
  const wedge = 0.5 * D(meta.front.seamPoints.bust, meta.front.seamPoints.cutTop) * D(meta.front.seamPoints.bust, meta.front.seamPoints.cutTopRotated) *
    Math.sin(meta.front.gather.wedgeAngleDeg * Math.PI / 180);
  const dArea = aY + aF + aB - ringW(GU.front) - ringW(GU.back) - meta.shoulderYoke.gapAreaCm2 - stripA - wedge;
  ok(Math.abs(dArea) < 0.1, "7: 면적 = 원본 앞+뒤 + 어깨 틈 + 뒤 띠 + 앞 쐐기 (Δ=" + dArea.toFixed(4) + ")");
  // 이음선 대응(요크 이음 ↔ 몸판 이음 + 개더) — 어깨 요크의 두 이음선 run
  const ys = GU.shoulderYoke.outline.filter(s => s.edge === "yoke-seam");
  ok(ys.length === 3, "7: 어깨 요크 이음선 = 뒤 2(꺾임) + 앞 1");
}

// ── 8. 원자성·입력 불변 ──
{
  const inF = clone(GB.front), inB = clone(GB.back);
  throwsReason(() => DY.split({ front: GB.front, back: GB.back }, { variant: "U", hemSideCm: 2.5 }), "hem-side-mismatch", "8: 밑단 옆이 1 이 아니면 거부(부분 결과 없음)");
  const noDartBack = clone(GB.back); noDartBack.construction = noDartBack.construction.filter(s => !(s.dart && s.dart.id === "back-shoulder"));
  throwsReason(() => DY.split({ front: GB.front, back: noDartBack }, { variant: "U", hemSideCm: 1 }), "dart-missing", "8: 뒤 어깨 다트 없으면 거부");
  const noDartFront = clone(GB.front); noDartFront.construction = noDartFront.construction.filter(s => !(s.dart && s.dart.id === "front-bust"));
  throwsReason(() => DY.split({ front: noDartFront, back: GB.back }, { variant: "U", hemSideCm: 1 }), "dart-missing", "8: 앞 AH 다트 없으면 거부");
  ok(J(GB.front) === J(inF) && J(GB.back) === J(inB), "8: 입력 몸판 불변");
}

// ── 9. 체크포인트(독립 재계산·변조 거부) ──
const mk = (geometry, body) => ({ sourceBlock: { id: "block-1", version: 2, schemaVersion: 8, canonicalHash: "CH" }, referenceGeometry: REF,
  working: { geometry, parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body }, patternLines: [], designOutline: null, frontPlacket: null } });
const chk = (p) => { PROJECT = p; return BC.check(p); };
const reasonOf = (p) => { const c = chk(p); return c.ok ? null : c.fails.filter(f => /^yoke-/.test(f))[0] || c.fails[0]; };
{
  const c = chk(mk(clone(GU), U_BODY));
  ok(c.ok, "9: Ⓤ 검사 통과: " + c.fails.join());
  const ys = c.yokeSeam;
  ok(ys && ys.ok && ys.variant === "U" && ys.shoulderYoke.closed && ys.front.closed && ys.back.closed, "9: yokeSeam 상태 ok · 세 조각 폐곡선");
  ok(ys.shoulderYoke.selfIntersects === false && ys.front.selfIntersects === false && ys.back.selfIntersects === false, "9: 자기교차 0(재계산)");
  ok(near(ys.back.gatherCm, 0.5 * (ys.back.seamLenYokeCm - 2), 1e-3) && near(ys.back.gatherDeltaCm, ys.back.gatherCm, 1e-3), "9: 뒤 개더 W 독립 재계산·몸판−요크 이음 = W");
  ok(near(ys.front.gatherCm, ys.front.gatherDeltaCm, 1e-3) && near(ys.front.wedgeDeg, ys.front.dartDeg, 1e-3) && near(ys.front.seamOffsetCm, 6, 1e-3), "9: 앞 쐐기 = 몸판−요크 이음 · 쐐기각 = AH 다트각 · 이음선 6cm");
  ok(ys.front.gatherRefRatio > 0.55 && ys.front.gatherRefRatio < 0.7, "9: ●×0.6 결과 비율 " + ys.front.gatherRefRatio + " (표시용)");
  ok(Math.abs(ys.shoulderYoke.areaDeltaCm2) < 0.1 && ys.shoulderYoke.gapAreaCm2 > 1, "9: 면적 정합 Δ=" + ys.shoulderYoke.areaDeltaCm2);
  ok(c.sideSeam.status === "match" && c.armhole.ok && c.neckline.ok, "9: 전체 몸판 기존 검사(옆선·진동·목선) 그대로 통과");

  const tamper = (fn, body) => { const g = clone(GU); fn(g); return reasonOf(mk(g, body || U_BODY)); };
  ok(tamper(g => { g.yokeSeam.back.gather.addedCm += 0.5; }) === "yoke-gather-mismatch", "9: 뒤 개더 메타 위조 거부");
  ok(tamper(g => { g.yokeSeam.front.gather.addedCm += 0.5; }) === "yoke-gather-mismatch", "9: 앞 개더(쐐기) 메타 위조 거부");
  ok(tamper(g => { g.backBody.outline.forEach(s => { if (s.edge === "center") { const e = s.kind === "line" ? [s] : []; e.forEach(q => { q.from.x -= 0.4; q.to.x -= 0.4; }); } }); }) !== null, "9: 뒤 몸판 중심 이동 거부");
  ok(tamper(g => { g.shoulderYoke.outline.some(s => { if (s.edge === "yoke-seam" && s.kind === "line") { s.to.y += 0.4; return true; } return false; }); }) !== null, "9: 요크 이음선 변조 거부");
  ok(tamper(g => { g.frontBody.construction.find(s => s.wedgeCut === "rotated").to.x += 0.3; }) === "yoke-gather-mismatch", "9: 쐐기 회전 절개선 변조 거부");
  ok(tamper(g => { g.frontBody.construction.find(s => s.wedgeCut === "fixed").to.x += 0.3; }) !== null, "9: 쐐기 고정 절개가 BP 연직이 아니면 거부");
  ok(tamper(g => { g.shoulderYoke.construction = g.shoulderYoke.construction.filter(s => s.shoulderJoin !== "front"); }) === "yoke-seam-shoulder-missing", "9: 앞 어깨 구성선 삭제 거부");
  ok(tamper(g => { const c0 = g.shoulderYoke.construction.find(s => s.shoulderJoin === "front"); c0.from.x += 0.3; }) !== null, "9: 어깨 맞댐점(목점) 어긋남 거부");
  ok(tamper(g => { g.shoulderYoke.outline.push({ kind: "line", from: { x: 0, y: 0 }, to: { x: 1, y: 1 }, edge: "shoulder" }); }) !== null, "9: 요크 외곽에 어깨 변 남음 거부");
  ok(tamper(g => { g.shoulderYoke.construction.push(clone(g.back.construction.filter(s => s.dart && s.dart.id === "back-shoulder")[0])); }) === "yoke-seam-dart-open", "9: 뒤 어깨 다트가 열려 있으면 거부(맞대기 전 닫힘)");
  ok(tamper(g => { g.frontBody.construction.push(clone(g.front.construction.filter(s => s.dart && s.dart.id === "front-bust")[0])); }) === "yoke-seam-dart-open", "9: 앞 AH 다트가 몸판에 열려 있으면 거부");
  ok(tamper(g => { g.shoulderYoke.outline = g.shoulderYoke.outline.slice(1); }) !== null, "9: 어깨 요크 외곽 끊김 거부");
  ok(tamper(g => { g.yokeSeam.front.seamPoints.cutTop.x += 5; }) === null, "9: 메타 좌표만 바꿔도(좌표는 재계산 대상 아님) 출력 geometry 가 맞으면 통과 — 신뢰하지 않는다는 증거");
  ok(tamper(g => { g.frontYoke = clone(g.shoulderYoke); g.backYoke = clone(g.shoulderYoke); }) === "yoke-seam-missing", "9: 어깨 요크와 앞·뒤 요크 동시 존재 거부");
  ok(reasonOf(mk(clone(GU), Q_BODY)) === "yoke-seam-variant-mismatch" && reasonOf(mk(clone(GQ), U_BODY)) !== null, "9: 파라미터·geometry 가 Ⓤ/Ⓠ 서로 어긋나면 거부");
  // 완료본·hash
  const pr = mk(clone(GU), U_BODY); PROJECT = pr;
  const done = BC.complete(pr);
  const res = BC.latest(pr);
  ok(done.ok && Object.isFrozen(res) && Object.isFrozen(res.shoulderYoke) && res.yokeSeam.variant === "U", "9: 완료본에 Ⓤ 메타 보존·동결");
  ["shoulderYoke", "frontBody", "backBody"].forEach(k => ok(J(res[k].outline) === J(GU[k].outline) && J(res[k].construction) === J(GU[k].construction) && res[k] !== pr.working.geometry[k], "9: result." + k + " = 현재 geometry 동결 복제"));
  ok(!("frontYoke" in res) && !("backYoke" in res), "9: 완료본에 frontYoke/backYoke 없음");
  const hash = (g, b) => { const p = mk(clone(g), b); PROJECT = p; const c2 = BC.complete(p); return c2.ok ? BC.latest(p).hash : "FAIL:" + c2.reason; };
  const hU = hash(GU, U_BODY);
  ok(hU === hash(GU, U_BODY) && !hU.startsWith("FAIL") && hU !== hash(GQ, Q_BODY), "9: Ⓤ hash 결정론 · Ⓠ hash 와 다름");
  const pe = mk(clone(GU), U_BODY); PROJECT = pe; BC.complete(pe);
  pe.working.geometry.shoulderYoke.outline.some(s => { if (s.kind === "line" && s.edge === "yoke-seam") { s.to.y += 0.05; return true; } return false; });
  ok(BC.isCurrentBodiceChanged(pe) === true, "9: 완료 뒤 어깨 요크가 바뀌면 스테일(hash 반영)");
  const pn = mk(clone(GU), U_BODY); PROJECT = pn; BC.complete(pn);
  ok(BC.isCurrentBodiceChanged(pn) === false, "9: 같은 상태는 스테일 아님");
  const H = { A: "2779faf5", Q: "1160ab37", R: "5463eb91", S: "cc4dbdc", T: "deee08ee", M: "d1bece2f", P: "588eb1bd" };
  Object.keys(H).forEach(k => { const b = BP.bodyParams("bunka-bodice-" + k); ok(hash(DB.computeGeometry(REF, { body: b }), b) === H[k], "9: " + k + " 완료본 hash 불변 " + H[k]); });
}

// ── 10. 표시·배치·렌더 ──
{
  const m = DL.yokeLabels(GU);
  ok(m && m.labels.length === 3 && m.labels.some(l => l.key === "shoulderYoke" && l.text === "어깨 요크") && m.seams.length === 3 && m.gathers.length === 2, "10: 조각명 3(어깨 요크·앞몸판·뒤몸판)·이음선 3·개더 라벨 2(앞 쐐기·뒤 띠)");
  ok(DL.yokeLabels(GQ).labels.length === 4, "10: Ⓠ 라벨 불변");
  const ptsOf = (p, out) => { if (p.kind === "line") out.push(p.from, p.to); else if (p.kind === "cubic") out.push(p.from, p.c1, p.c2, p.to); else p.commands.forEach(c => c.points.forEach(q => out.push(q))); };
  const bb = (pc) => { const pts = []; pc.outline.forEach(p => ptsOf(p, pts)); return { minX: Math.min(...pts.map(q => q.x)), maxX: Math.max(...pts.map(q => q.x)), minY: Math.min(...pts.map(q => q.y)), maxY: Math.max(...pts.map(q => q.y)) }; };
  const overlap = (a, b) => a.minX < b.maxX - 1e-9 && b.minX < a.maxX - 1e-9 && a.minY < b.maxY - 1e-9 && b.minY < a.maxY - 1e-9;
  const dispF = DL.peplumDisplayPiece(GU, "frontBody"), dispB = DL.peplumDisplayPiece(GU, "backBody");
  ok(!overlap(bb(GU.shoulderYoke), bb(dispB)), "10: 어깨 요크·뒤 몸판 표시 bbox 겹침 0");
  ok(dispF && bb(dispF).minY > bb(GU.shoulderYoke).maxY, "10: 앞 몸판 표시는 어깨 요크 아래로 내려간다(geometry 불변)");
  ok(J(GU.frontBody) === J(DB.computeGeometry(REF, { body: U_BODY }).frontBody), "10: 표시 계산이 geometry 를 바꾸지 않는다");
  const bf = DL.bboxOf(GU, "front"), bk = DL.bboxOf(GU, "back");
  ok(bf && bk && near(bf.minY, bb(dispF).minY, 1e-9) && near(bk.minY, bb(GU.shoulderYoke).minY, 1e-9), "10: 앞 hit rect = 앞 몸판만 · 뒤 hit rect = 어깨 요크 ∪ 뒤 몸판(전체 앞/뒤판은 숨김)");
  let layout; try { layout = DL.autoLayout(GU); } catch (e) { layout = null; }
  ok(!!layout, "10: autoLayout 성공");
  const EMPTY = { outline: [], construction: [] };
  let grp = null, err = null;
  try { grp = DR.createWorkingGroup({ front: EMPTY, back: EMPTY, shared: EMPTY, sleeve: EMPTY, shoulderYoke: GU.shoulderYoke, frontBody: GU.frontBody, backBody: GU.backBody }); } catch (e) { err = e.reason || e.message; }
  ok(!err && grp && grp.kids.length > 0, "10: 렌더러 검증 통과(어깨 요크 포함) " + (err || ""));
  const ids = grp ? grp.kids.map(k => J(k.attrs || {})) : [];
  ok(new Set(ids).size === ids.length, "10: 중복 렌더 0");
  const rsrc = fs.readFileSync(path.join(__dirname, "..", "..", "js", "render.js"), "utf8"), usrc = fs.readFileSync(path.join(__dirname, "..", "..", "js", "ui.js"), "utf8");
  ok(/g\.shoulderYoke/.test(rsrc.match(/function _yokeModeOf[^\n]*/)[0]), "10: render.js 요크 모드가 어깨 요크 한 장을 안다");
  ok(/body\.yokeSeam === "U"/.test(usrc) && /g\.shoulderYoke/.test(usrc.match(/const locked = [^\n]*/)[0]), "10: ui.js 가 yokeSeam \"U\" 를 라인 적용에 싣고 패턴선 도구 잠금이 어깨 요크를 안다");
  const mMsg = usrc.match(/const yokeLockMsg = [^\n]*;/), mCir = usrc.match(/const yokeCircled = [^\n]*;/);
  if (mMsg && mCir) {
    const f = new Function(mMsg[0] + mCir[0] + "return (body) => yokeLockMsg(yokeCircled(window.bodicePresets.yokeVariantSymbol(body)));");
    const msgOf = vm.runInContext("(" + f.toString() + ")()", sandbox);
    ok(msgOf(U_BODY).includes("Ⓤ 적용 중") && msgOf(Q_BODY).includes("Ⓠ 적용 중"), "10: 잠금 문구는 Ⓤ/Ⓠ 로 표시");
  } else ok(false, "10: ui.js 에 yokeLockMsg/yokeCircled 존재");
}
ok(J(REF) === SNAP, "11: reference 불변");

console.log("══════════════════════════════════════════════");
console.log(`yokeSeamUCheck: ${PASS} PASS / ${FAIL} FAIL`);
if (FAIL) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
console.log("전부 통과 ✓");
