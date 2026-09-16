// ══════════════════════════════════════════════
// dartAttachmentCheck.js — P0.3b 다트 다리 경계 attachment 회귀.
//
// 계약: 각 다트 다리의 apex 반대 끝은 생산자가 선언한 { root, t } 로 최종 경계에 붙는다.
// gen-0 은 다트를 만든 지점, 새 다트는 cut 시점 cut 구간의 root·t, source 잔여 다트는 원래 선언.
// 좌표·배열 순서로 복원하지 않고, 최종 effective 경계 구간이 t 를 덮지 않거나 그 t 의 실제 점이 다리 끝과
// 계산 허용치 안에서 일치하지 않으면 misaligned 로 남는다.
//
//   node test/harness/dartAttachmentCheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");
const { createEngine } = require("./loadEngine");
const { applyRecipe, attemptDartMove } = require("./dartDriver");
const { mulberry32 } = require("./rng");

let PASS = 0, FAIL = 0; const fails = [];
function ok(cond, name) { if (cond) PASS++; else { FAIL++; fails.push(name); } }
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const dims = { B: 83, W: 64, BL: 38 };
const EPS = 1e-6;

// 엔진 결과: 모든 다트 다리가 attachment 를 갖고, 같은 형상의 그 root lineage 구간이 t 를 덮는다.
function engineAttachProblems(segs) {
  const probs = [];
  segs.forEach(l => {
    if (!l.dartId) return;
    if (typeof l.dartAttachRoot !== "string" || typeof l.dartAttachT !== "number") { probs.push(l.dartId + ":missing"); return; }
    const covered = segs.some(s => s.boundaryRoot === l.dartAttachRoot && typeof s.boundaryFromT === "number" &&
      l.dartAttachT >= Math.min(s.boundaryFromT, s.boundaryToT) - EPS && l.dartAttachT <= Math.max(s.boundaryFromT, s.boundaryToT) + EPS);
    if (!covered) probs.push(l.dartId + ":uncovered " + l.dartAttachRoot + "@" + l.dartAttachT);
  });
  return probs;
}

// 1. gen-0 생산자 선언: 앞가슴·뒤어깨 다리는 서로 다른 root 끝점
{
  const { engine } = createEngine();
  const d = engine.createDraft(83, 64, 38);
  const f = engine.buildFrontOutline(d.pts, d.formula, 83), b = engine.buildBackOutline(d.pts, d.formula, 83);
  const fl = f.filter(s => s.dartId === "front-bust").map(s => s.dartAttachRoot + "@" + s.dartAttachT).sort();
  const bl = b.filter(s => s.dartId === "back-shoulder").map(s => s.dartAttachRoot + "@" + s.dartAttachT).sort();
  ok(JSON.stringify(fl) === JSON.stringify(["front/armhole-lower@1", "front/armhole-upper@0"]), "1: 앞가슴다트 = 진동하부 끝 · 진동상부 시작");
  ok(JSON.stringify(bl) === JSON.stringify(["back/shoulder-armhole@0", "back/shoulder-neck@1"]), "1: 뒤어깨다트 = 목쪽 어깨 끝 · 어깨끝쪽 시작");
  ok(engineAttachProblems(f).length === 0 && engineAttachProblems(b).length === 0, "1: gen-0 선언이 같은 외곽 root 구간에 포함");
}

// 2. 부분 이동: 새 다트 두 다리 = cut root·cut t(같은 값), source 잔여 다리 = 원래 선언 보존
[["front", "front-waist", "front/waist", ["front/armhole-lower@1", "front/armhole-upper@0"]],
 ["back", "back-armhole", "back/armhole", ["back/shoulder-armhole@0", "back/shoulder-neck@1"]]].forEach(([side, type, cutRoot, srcAttach]) => {
  const { engine } = createEngine();
  const res = applyRecipe(engine, side, dims, { type, arcFraction: 0.4, piece: "A", moveFraction: 0.5 });
  ok(res.status === "applied", "2: " + side + " 부분 이동 적용");
  if (res.status !== "applied") return;
  const news = res.bakedSegments.filter(s => s.type === "dart-leg-new");
  ok(news.length === 2 && news.every(s => s.dartAttachRoot === cutRoot) && near(news[0].dartAttachT, news[1].dartAttachT) &&
     news[0].dartAttachT > 0 && news[0].dartAttachT < 1, "2: " + side + " 새 다트 = cut root·같은 cut t");
  // cut t 는 cut 구간 lineage 의 경계값이어야 한다(좌표 재계산이 아니라 그 세그먼트의 선언 구간).
  ok(res.bakedSegments.some(s => s.boundaryRoot === cutRoot && (near(s.boundaryFromT, news[0].dartAttachT) || near(s.boundaryToT, news[0].dartAttachT))),
    "2: " + side + " cut t = 절단된 root 구간의 끝값");
  const olds = res.bakedSegments.filter(s => s.type === "dart-leg-old").map(s => s.dartAttachRoot + "@" + s.dartAttachT).sort();
  ok(JSON.stringify(olds) === JSON.stringify(srcAttach), "2: " + side + " source 잔여 다리 attachment 보존");
  ok(engineAttachProblems(res.bakedSegments).length === 0, "2: " + side + " 모든 다리 attachment 포함");
});

// 3. 완전 이동 + 다세대 체인
{
  const { engine } = createEngine();
  const full = applyRecipe(engine, "front", dims, { type: "front-armhole-upper", arcFraction: 0.5, piece: "A", moveFraction: 1.0 });
  ok(full.status === "applied" && full.bakedSegments.filter(s => s.dartId).length === 2 && engineAttachProblems(full.bakedSegments).length === 0,
    "3: 완전 이동 → 새 다트만, attachment 포함");
}
{
  const { engine } = createEngine();
  const bad = [];
  [{ type: "front-waist", arcFraction: 0.35, piece: "A", moveFraction: 0.5 },
   { type: "side-seam", arcFraction: 0.45, piece: "B", moveFraction: 0.4 },
   { type: "front-armhole-upper", arcFraction: 0.6, piece: "A", moveFraction: 1.0 }].forEach((r, i) => {
    const res = applyRecipe(engine, "front", dims, r);
    if (res.status !== "applied") { bad.push("gen" + i + ":" + res.status); return; }
    engineAttachProblems(res.bakedSegments).forEach(p => bad.push("gen" + i + ":" + p));
  });
  ok(bad.length === 0, "3: 앞판 3세대 체인 attachment 유지 " + bad.join(","));
}

// 4. 무작위 스트레스(앞·뒤 부분·완전 혼합)
{
  let applied = 0, bad = 0;
  ["front", "back"].forEach(side => {
    for (let run = 0; run < 20; run++) {
      const { engine } = createEngine();
      const rng = mulberry32(run * 31337 + (side === "back" ? 11 : 2));
      for (let gen = 0; gen < 6; gen++) {
        const res = attemptDartMove(engine, side, dims, 0.2 + rng() * 0.8, undefined, rng);
        if (res.status !== "applied") continue;
        applied++;
        if (engineAttachProblems(res.bakedSegments).length) bad++;
      }
    }
  });
  ok(applied > 100 && bad === 0, "4: 무작위 적용 " + applied + "건 attachment 위반 " + bad);
}

// ── 디자인 경로 · 완료 evidence ──
const JS = (f) => fs.readFileSync(path.join(__dirname, "..", "..", "js", f), "utf8");
let PROJECT = null;
const sb = { window: { designLineTool: { buildPieceRing: () => ({ ok: true }) }, designWorkflow: { current: () => PROJECT } },
  console: { log() {}, warn() {}, error() {} }, structuredClone, Math, JSON, Object, Array, Number, isFinite, Error, Infinity, NaN, Date };
sb.globalThis = sb; vm.createContext(sb);
["designBodice.js", "bodiceCheckpoint.js"].forEach(f => vm.runInContext(JS(f), sb, { filename: f }));
const DB = sb.window.designBodice, BC = sb.window.bodiceCheckpoint;
const LT = (() => { const s = { window: {}, document: {}, console: { log() {}, warn() {} }, structuredClone, Math, JSON, Object, Array }; s.globalThis = s; vm.createContext(s); vm.runInContext(JS("designLineTool.js"), s); return s.window.designLineTool; })();

const L = (a, b, edge, root, r) => { const o = { kind: "line", from: { x: a[0], y: a[1] }, to: { x: b[0], y: b[1] } }; if (edge) o.edge = edge; if (root) o.boundary = { root, ranges: [r || [0, 1]] }; return o; };
const P = (pts, edge, root) => { const o = { kind: "path", commands: [{ type: "M", points: [{ x: pts[0][0], y: pts[0][1] }] }, { type: "C", points: pts.slice(1).map(q => ({ x: q[0], y: q[1] })) }] }; if (edge) o.edge = edge; if (root) o.boundary = { root, ranges: [[0, 1]] }; return o; };
const dleg = (a, b, id, boundary, apexAt, attach) => { const o = L(a, b); o.dart = { id, boundary, apexAt }; if (attach) o.dart.attach = attach; return o; };
// 앞판: CF x=40, 옆 x=16. 허리 root 는 중심(0)→옆(1).
function geom(ids, withAttach) {
  const fx = ids ? (r) => "front/" + r : () => null, bx = ids ? (r) => "back/" + r : () => null;
  const front = { outline: [
    L([40, 3], [40, 38], "center", fx("center")), L([40, 38], [16, 38], "waist", fx("waist")), L([16, 38], [16, 20], "side-seam", fx("side-seam"), [1, 0]),
    P([[16, 20], [18, 12], [20, 5], [22, 0]], "armhole", fx("armhole")), L([22, 0], [33, -4], "shoulder", fx("shoulder"), [1, 0]),
    P([[33, -4], [35, 0], [38, 3], [40, 3]], "neckline", fx("neckline"))],
    construction: [dleg([31, 38], [30, 25], "front-waist-a", "waist", "to", withAttach && { root: "front/waist", t: 9 / 24 }),
      dleg([29, 38], [30, 25], "front-waist-a", "waist", "to", withAttach && { root: "front/waist", t: 11 / 24 }),
      // 진동 cubic (16,20)(18,12)(20,5)(22,0): t=0.5 → (19,8.875), t=0.25 → (17.5,14.203125)
      dleg([19, 8.875], [28, 18], "front-bust", "armhole", "to", withAttach && { root: "front/armhole", t: 0.5 }),
      dleg([28, 18], [17.5, 14.203125], "front-bust", "armhole", "from", withAttach && { root: "front/armhole", t: 0.25 })] };
  const back = JSON.parse(JSON.stringify(front));
  const mirror = (q) => { q.x = 56 - q.x; };
  back.outline.concat(back.construction).forEach(pr => { if (pr.kind === "line") { mirror(pr.from); mirror(pr.to); } else pr.commands.forEach(c => c.points.forEach(mirror)); if (pr.boundary) pr.boundary.root = pr.boundary.root.replace("front/", "back/"); });
  back.construction = [];
  return { front, back, shared: { outline: [], construction: [] }, sleeve: { outline: [], construction: [] } };
}
const proj = (sv, g, over) => Object.assign({ sourceBlock: { version: 1, schemaVersion: sv }, working: {
  geometry: g, parameters: { neckline: { mode: "parametric", type: "round", parameters: {} } }, designOutline: null, frontPlacket: null, patternLines: [] } }, over || {});
const sem = (p) => { PROJECT = p; return BC.evaluateSemantics(p); };
const att = (r, id) => r.darts.front.find(d => d.id === id);

// 5. v6 원본: attachment complete · ready
{
  const r = sem(proj(6, geom(true, true)));
  ok(r.ready === true && att(r, "front-waist-a").attachment === "complete" && att(r, "front-bust").attachment === "complete", "5: v6 선언·포함 → complete·ready");
  ok(att(r, "front-waist-a").attachments.map(a => a.root + "@" + a.t).join(",") === "front/waist@0.375,front/waist@0.4583", "5: evidence 는 다리별 root·t");
}

// 5b. 무결성: coverage 는 되지만 선언 점이 다리 끝과 다르면 complete 가 아니다
{
  const legMoved = geom(true, true); legMoved.front.construction[0].from = { x: 31.2, y: 38 };
  ok(att(sem(proj(6, legMoved)), "front-waist-a").attachment === "misaligned", "5b: 다리만 이동 → misaligned");
  const wrongT = geom(true, true); wrongT.front.construction[0].dart.attach.t = 0.3;
  const rw = sem(proj(6, wrongT));
  ok(att(rw, "front-waist-a").attachment === "misaligned" && !rw.ready && rw.issues.indexOf("dart-attachment-misaligned") >= 0, "5b: 잘못된 t(coverage 됨) → misaligned·not ready");
  const boundaryMoved = geom(true, true); boundaryMoved.front.outline[1].from = { x: 41, y: 38 };
  ok(att(sem(proj(6, boundaryMoved)), "front-waist-a").attachment === "misaligned", "5b: 경계만 이동 → misaligned");
  // 열린 다트형: 같은 root+t(0.5) 가 서로 떨어진 두 구간에 있고 각 다리가 자기 좌표 후보와 일치
  const open = geom(true, true);
  const wA = { kind: "line", from: { x: 40, y: 38 }, to: { x: 28, y: 38 }, edge: "waist", boundary: { root: "front/waist", ranges: [[0, 0.5]] } };
  const wB = { kind: "line", from: { x: 28.4, y: 36 }, to: { x: 16.4, y: 36 }, edge: "waist", boundary: { root: "front/waist", ranges: [[0.5, 1]] } };
  open.front.outline.splice(1, 1, wA, wB);
  open.front.construction = [dleg([28, 38], [28.2, 25], "moved", "waist", "to", { root: "front/waist", t: 0.5 }),
    dleg([28.4, 36], [28.2, 25], "moved", "waist", "to", { root: "front/waist", t: 0.5 })];
  const ro = sem(proj(6, open));
  ok(att(ro, "moved").attachment === "complete" && ro.darts.front.find(d => d.id === "moved").attachments.every(a => a.status === "complete"),
    "5b: 같은 root+t 두 좌표(열린 다트) → 각 다리 자기 후보와 일치·complete");
}

// 6. 디자인 변환: 길이 연장(허리 좌표 불변, 기준선으로 이동) → complete 유지 / 여유량(경계 점 이동, 다리 제자리) → misaligned
{
  const g = geom(true, true);
  const out = DB.computeGeometry(g, { body: { hemExtensionBelowWaistCm: 10 } });
  const r = sem(proj(6, out));
  ok(att(r, "front-waist-a").attachment === "complete" && att(r, "front-bust").attachment === "complete", "6: 길이 연장 후 attachment 정합 유지(허리는 construction lineage)");
  const eased = DB.computeGeometry(geom(true, true), { body: { bustEaseCm: 4, hemExtensionBelowWaistCm: 10 } });
  const re = sem(proj(6, eased));
  ok(att(re, "front-waist-a").attachment === "complete", "6: 여유량 — 허리다트는 생산자가 t 를 재매개변수화해 정합 유지");
  ok(att(re, "front-bust").attachment === "misaligned" && !re.ready,
    "6: 여유량이 진동 중간 t 의 경계만 옮기고 다리는 제자리 → misaligned·not ready(범위 밖 다트)");
  const legs = out.front.construction.filter(p => p.dart);
  ok(legs.every(p => p.dart.attach) && legs[0].dart.attach !== g.front.construction[0].dart.attach, "6: 변환 결과 attachment 값 복제(참조 공유 없음)");
  const outNo = DB.computeGeometry(geom(true, false), { body: { hemExtensionBelowWaistCm: 10 } });
  const strip = (x) => JSON.stringify(x, (k, v) => (k === "attach" ? undefined : v));
  ok(strip(out) === strip(outNo), "6: attachment 가 형상·개수·순서를 바꾸지 않음");
  PROJECT = proj(6, out); const c1 = BC.complete();
  PROJECT = proj(6, outNo); const c2 = BC.complete();
  ok(c1.ok && c2.ok && c1.result.hash === c2.result.hash && JSON.stringify(c1.result.armholeLengths) === JSON.stringify(c2.result.armholeLengths) &&
     JSON.stringify(c1.result.necklineLengths) === JSON.stringify(c2.result.necklineLengths), "6: bodiceResult.hash·reported 측정 불변");
  ok(Object.isFrozen(c1.result.semantics.darts.front[0].attachments[0]), "6: 완료 evidence deepFrozen");
}

// 7. manual outline: 유지(포함) · 절단(구간 밖) · 대체(root 소실)
{
  const base = geom(true, true);
  const withOutline = (o) => proj(6, geom(true, true), { working: { geometry: geom(true, true), parameters: {}, designOutline: { front: { outline: o } }, frontPlacket: null, patternLines: [] } });
  // 유지: 경계 세그먼트를 designLineTool 경로로 복제만(lineage 그대로)
  const kept = LT.outlinePrimsToSegs(base.front.outline);
  ok(att(sem(withOutline(kept)), "front-bust").attachment === "complete", "7: manual 유지 구간 → attachment 포함");
  // 절단: 진동 구간을 [0,0.4] 만 남김 → t=0.5 는 덮이지 않음
  const armSeg = kept.find(s => s.edge === "armhole");
  const trimmed = kept.filter(s => s !== armSeg).concat([LT.subSegment(armSeg, 0, 0.4)]);
  const rt = sem(withOutline(trimmed));
  ok(att(rt, "front-bust").attachment === "misaligned" && rt.ready === false && rt.issues.indexOf("dart-attachment-misaligned") >= 0, "7: 절단으로 t 미포함 → misaligned·not ready");
  ok(att(rt, "front-waist-a").attachment === "complete", "7: 영향 없는 다트는 그대로 complete");
  // 대체: 진동 구간이 의미 없는 대체선으로 교체(root 소실)
  const replaced = kept.filter(s => s !== armSeg).concat(LT.boundarySegsOf({ id: "line-2", segments: [{ kind: "line", from: { x: 16, y: 20 }, to: { x: 22, y: 0 } }] }));
  const rr = sem(withOutline(replaced));
  ok(att(rr, "front-bust").attachment === "misaligned" && rr.ready === false, "7: 대체로 root 소실 → misaligned");
  ok(att(rr, "front-bust").attachments.every(a => a.root === "front/armhole") && att(rr, "front-bust").attachments.map(a => a.t).join(",") === "0.5,0.25", "7: 사라져도 선언값을 지어내거나 바꾸지 않음");
}

// 8. 잘못된 선언 차단 · 누락 · legacy 무조작
{
  const withAttach = (at) => { const g = geom(true, true); g.front.construction[2].dart.attach = at; return sem(proj(6, g)); };
  ok(att(withAttach({ root: "front/armhole", t: 1.2 }), "front-bust").attachment === "misaligned", "8: t 범위 밖 → misaligned");
  ok(att(withAttach({ root: "back/armhole", t: 0.5 }), "front-bust").attachment === "misaligned", "8: 다른 piece root → misaligned");
  ok(att(withAttach({ root: "front/center", t: 0.5 }), "front-bust").attachment === "misaligned", "8: root 의미 ≠ 다트 boundary → misaligned");
  ok(att(withAttach({ root: "front/armhole-upper", t: 0 }), "front-bust").attachment === "misaligned", "8: 경계에 없는 root → misaligned");
  const gm = geom(true, true); delete gm.front.construction[0].dart.attach;
  const rm = sem(proj(6, gm));
  ok(att(rm, "front-waist-a").attachment === "missing" && rm.issues.indexOf("dart-attachment-missing") >= 0 && !rm.ready, "8: v6 누락 → missing·not ready");
  const rl = sem(proj(5, geom(true, false)));
  ok(rl.issues.indexOf("legacy-source") >= 0 && rl.issues.indexOf("dart-attachment-missing") < 0 && rl.issues.indexOf("dart-attachment-misaligned") < 0,
    "8: legacy v5 → legacy-source 만(누락을 오류로 조작하지 않음)");
  ok(rl.darts.front.every(d => d.attachments.every(a => a.root === null && a.t === null)), "8: legacy attachment 를 만들어 넣지 않음");
  // shared 다트: 앞/뒤 서로 다른 root 허용
  const gs = geom(true, true);
  // 뒤 허리(거울) x = 16+24t · 앞 허리 x = 40-24t
  gs.shared.construction = [dleg([38.8, 38], [27, 25], "shared-waist-c", "waist", "to", { root: "back/waist", t: 0.95 }), dleg([16.48, 38], [27, 25], "shared-waist-c", "waist", "to", { root: "front/waist", t: 0.98 })];
  const rs = sem(proj(6, gs));
  ok(rs.darts.shared[0].attachment === "complete", "8: shared 다트 앞·뒤 서로 다른 root → complete");
}

// 9. fingerprint: attachment root 또는 t 만 바뀌어도 변화 · 형상 hash 불변 · 결정론
{
  const g1 = geom(true, true), g2 = geom(true, true), g3 = geom(true, true);
  g2.front.construction[0].dart.attach.t = 0.3;
  g3.front.construction[2].dart.attach.root = "front/armhole"; g3.front.construction[3].dart.attach = { root: "front/armhole", t: 0.6 };
  const f1 = sem(proj(6, g1)).fingerprint, f2 = sem(proj(6, g2)).fingerprint, f3 = sem(proj(6, g3)).fingerprint;
  ok(f1 !== f2 && f1 !== f3 && f2 !== f3, "9: t 변경·다른 다리 t 변경 각각 fingerprint 변화");
  const g4 = geom(true, true); g4.front.construction[2].dart.attach = { root: "front/center", t: 0.5 };
  ok(sem(proj(6, g4)).fingerprint !== f1, "9: root 만 변경 → fingerprint 변화");
  ok(sem(proj(6, geom(true, true))).fingerprint === f1, "9: 결정론");
  PROJECT = proj(6, g1); const h1 = BC.complete().result.hash; PROJECT = proj(6, g2); const h2 = BC.complete().result.hash;
  ok(h1 === h2, "9: attachment 변경이 bodiceResult.hash 를 바꾸지 않음");
}

// 10. deep-copy: 경계 세그먼트 헬퍼가 중첩 attachment 를 값으로 옮김
{
  const src = dleg([0, 0], [1, 1], "dx", "waist", "to", { root: "front/waist", t: 0.4 });
  const cl = LT.subSegment(src, 0, 1), rv = LT.reverseSeg(src);
  cl.dart.attach.t = 9; rv.dart.attach.root = "x";
  ok(src.dart.attach.t === 0.4 && src.dart.attach.root === "front/waist", "10: 복제·반전 결과 변형이 원본에 새지 않음");
}

// 11. (P0.3b 증분 1) 허리 root 연장·축소 시 허리다트 attach.t 재매개변수화
{
  // 앞: C=(40,38)→S=(16,38) · 뒤(거울): C=(16,38)→S=(40,38). 다리 좌표 x 에서 t = |x−Cx|/24.
  const legW = (x, apexX, id, root, t, onFold) => { const o = dleg([x, 38], [apexX, 25], id, "waist", "to", { root, t }); if (onFold) o.dart.onFold = true; return o; };
  function geomW() {
    const g = geom(true, false);
    g.front.construction = [legW(31, 30, "front-waist-a", "front/waist", 9 / 24), legW(29, 30, "front-waist-a", "front/waist", 11 / 24),
      legW(22, 21, "front-waist-b", "front/waist", 18 / 24), legW(20, 21, "front-waist-b", "front/waist", 20 / 24),
      legW(35, 34, "dart-1700000000000-moved", "front/waist", 5 / 24), legW(33, 34, "dart-1700000000000-moved", "front/waist", 7 / 24)];
    g.back.construction = [legW(29, 30, "back-waist-d", "back/waist", 13 / 24), legW(31, 30, "back-waist-d", "back/waist", 15 / 24),
      legW(22, 23, "back-waist-e", "back/waist", 6 / 24), legW(24, 23, "back-waist-e", "back/waist", 8 / 24),
      legW(17, 16, "back-waist-f", "back/waist", 1 / 24, true)];
    g.shared.construction = [legW(38.8, 40, "shared-waist-c", "back/waist", 0.95), legW(16.48, 40, "shared-waist-c", "front/waist", 0.98)];
    return g;
  }
  const dartsOf = (r) => r.darts.front.concat(r.darts.back);
  const ALLOWED = ["front-waist-a", "front-waist-b", "back-waist-d", "back-waist-e", "back-waist-f"];
  const tOf = (g, pc, id) => g[pc].construction.filter(p => p.dart && p.dart.id === id).map(p => p.dart.attach.t);
  const run = (body) => { const g = geomW(); const before = JSON.stringify(g); const out = DB.computeGeometry(g, { body }); return { g, before, out, r: sem(proj(6, out)) }; };

  // outward ease: 허용 다트 전부 complete, 좌표 불변, t 만 변경(같은 물리점)
  const e = run({ bustEaseCm: 4 });
  ok(JSON.stringify(e.g) === e.before, "11: 입력 불변");
  ok(ALLOWED.every(id => dartsOf(e.r).find(d => d.id === id).attachment === "complete"), "11: outward ease → a,b,d,e,f(fold) complete");
  ok(near(tOf(e.out, "front", "front-waist-a")[0], 9 / 25) && near(tOf(e.out, "back", "back-waist-f")[0], 1 / 25), "11: t' = 원래 점 유지(앞 a 9/25 · 뒤 fold f 1/25)");
  ok(e.out.front.construction[0].dart.attach !== e.g.front.construction[0].dart.attach, "11: attach 값 복제(참조 공유 없음)");
  // 범위 밖: 공유 c·dartMove 새 다트는 조작하지 않는다
  ok(JSON.stringify(e.out.shared.construction) === JSON.stringify(e.g.shared.construction), "11: 공유 옆 다트 c 무조작");
  ok(JSON.stringify(tOf(e.out, "front", "dart-1700000000000-moved")) === JSON.stringify([5 / 24, 7 / 24]) &&
     dartsOf(e.r).find(d => d.id === "dart-1700000000000-moved").attachment === "misaligned", "11: 새 moved 다트 무조작(misaligned 로 남음)");

  // moderate inward waist offset(−3): S'=(19,38) · b 다리 x=20 → 20/21 여전히 안
  const w = run({ waistSideOffsetCm: -3 });
  ok(["front-waist-a", "front-waist-b"].every(id => dartsOf(w.r).find(d => d.id === id).attachment === "complete") &&
     ["back-waist-d", "back-waist-e", "back-waist-f"].every(id => dartsOf(w.r).find(d => d.id === id).attachment === "complete"), "11: moderate inward waist offset → complete");
  // inward past-leg(−5): 앞 S'=(21,38) → b 다리 x=20 은 새 옆 점을 넘음 → 그 다리 선언 유지 → misaligned
  const past = run({ waistSideOffsetCm: -5 });
  const pb = dartsOf(past.r).find(d => d.id === "front-waist-b");
  ok(pb.attachment === "misaligned" && !past.r.ready, "11: inward past-leg → misaligned·not ready");
  ok(near(tOf(past.out, "front", "front-waist-b")[1], 20 / 24), "11: 넘어간 다리는 선언 t 유지(조작 없음)");
  ok(dartsOf(past.r).find(d => d.id === "front-waist-a").attachment === "complete", "11: 넘지 않은 다트는 갱신·complete");

  // hem-only 불변
  const h = run({ hemExtensionBelowWaistCm: 10 });
  ok(JSON.stringify(h.out.front.construction.filter(p => p.dart).map(p => p.dart.attach)) === JSON.stringify(h.g.front.construction.map(p => p.dart.attach)), "11: hem-only → attach 불변");

  // 결정론 · 형상/hash/측정 불변 · fingerprint 변화는 의도
  ok(JSON.stringify(run({ bustEaseCm: 4 }).out) === JSON.stringify(e.out), "11: 같은 입력 반복 → 동일 결과");
  const strip = (x) => JSON.stringify(x, (k, v) => (k === "attach" ? undefined : v));
  const noAtt = geomW(); ["front", "back", "shared"].forEach(pc => noAtt[pc].construction.forEach(p => { delete p.dart.attach; }));
  const eNo = DB.computeGeometry(noAtt, { body: { bustEaseCm: 4 } });
  ok(strip(e.out) === strip(eNo), "11: 좌표·kind·개수·순서 불변(attach 외 차이 없음)");
  ok(!JSON.stringify(eNo).includes("\"attach\""), "11: attach 없는 데이터는 만들지 않음");
  PROJECT = proj(6, e.out); const c1 = BC.complete();
  const stale = JSON.parse(JSON.stringify(e.out)); stale.front.construction.forEach((p, i) => { p.dart.attach = e.g.front.construction[i].dart.attach; });
  PROJECT = proj(6, stale); const c2 = BC.complete();
  ok(c1.ok && c2.ok && c1.result.hash === c2.result.hash && JSON.stringify(c1.result.armholeLengths) === JSON.stringify(c2.result.armholeLengths),
    "11: bodiceResult.hash·reported 측정 불변");
  ok(c1.result.semantics.fingerprint !== c2.result.semantics.fingerprint, "11: t 갱신으로 dart fingerprint 변화(의도)");
  // legacy v5(attach 없음·boundary 있음)·boundary 없는 입력: 조작 없음
  const leg5 = DB.computeGeometry(geom(true, false), { body: { bustEaseCm: 4, waistSideOffsetCm: -1 } });
  const legNoIds = DB.computeGeometry(geom(false, false), { body: { bustEaseCm: 4 } });
  ok(!JSON.stringify(leg5).includes("\"attach\"") && !JSON.stringify(legNoIds).includes("\"attach\"") && ["front", "back"].every(pc => legNoIds[pc].outline.concat(legNoIds[pc].construction).every(pr => !("boundary" in pr))), "11: legacy·무 identity 입력 무조작");
  // 단일 직선 아님 / 축 불일치 → 갱신 금지
  const split = geomW(); const wl = split.front.outline[1];
  split.front.outline.splice(1, 1, L([40, 38], [28, 38], "waist", "front/waist", [0, 0.5]), L([28, 38], [16, 38], "waist", "front/waist", [0.5, 1]));
  const so = DB.computeGeometry(split, { body: { bustEaseCm: 4 } });
  ok(near(tOf(so, "front", "front-waist-a")[0], 9 / 24) && wl.kind === "line", "11: waist root 가 단일 직선 아님 → 갱신 안 함");
  // ID ↔ root 교차 태깅: back-waist-d 가 front/waist 에, front-waist-a 가 back/waist 에 선언 → 갱신 안 함
  const cross = geomW();
  cross.front.construction.push(legW(26, 27, "back-waist-d", "front/waist", 14 / 24), legW(24, 27, "back-waist-d", "front/waist", 16 / 24));
  cross.back.construction.push(legW(26, 27, "front-waist-a", "back/waist", 10 / 24), legW(28, 27, "front-waist-a", "back/waist", 12 / 24));
  const co = DB.computeGeometry(cross, { body: { bustEaseCm: 4 } });
  ok(JSON.stringify(tOf(co, "front", "back-waist-d")) === JSON.stringify([14 / 24, 16 / 24]) &&
     JSON.stringify(tOf(co, "back", "front-waist-a")) === JSON.stringify([10 / 24, 12 / 24]), "11: ID·root 교차 태깅 → 선언 t 유지");
  ok(near(tOf(co, "front", "front-waist-a")[0], 9 / 25) && near(tOf(co, "back", "back-waist-d")[0], 13 / 25), "11: 올바른 ID·root 다리는 같은 입력에서 갱신");
  // 방향 반전: 허리 폭 24 를 넘는 안쪽 이동(−30)으로 S' 가 C 를 지나 반대편 → 갱신 안 함
  const flip = DB.computeGeometry(geomW(), { body: { waistSideOffsetCm: -30 } });
  ok(near(tOf(flip, "front", "front-waist-a")[0], 9 / 24) && near(tOf(flip, "back", "back-waist-f")[0], 1 / 24), "11: S' 가 C 를 지나 뒤집힘 → 선언 t 유지");
  // 비파괴: attach 의 다른 선언 키는 보존, t 만 교체
  const extra = geomW(); extra.front.construction[0].dart.attach.note = { keep: [1, 2] };
  const xo = DB.computeGeometry(extra, { body: { bustEaseCm: 4 } });
  const xa = xo.front.construction[0].dart.attach;
  ok(near(xa.t, 9 / 25) && xa.root === "front/waist" && JSON.stringify(xa.note) === JSON.stringify({ keep: [1, 2] }) && xa.note !== extra.front.construction[0].dart.attach.note,
    "11: 갱신은 t 만 교체 — 다른 키 값 복사 보존");
  const slant = geomW(); slant.front.outline[1] = L([40, 38], [16, 39], "waist", "front/waist");
  slant.front.outline[2] = L([16, 39], [16, 20], "side-seam", "front/side-seam", [1, 0]);
  const sl = DB.computeGeometry(slant, { body: { bustEaseCm: 4 } });
  ok(near(tOf(sl, "front", "front-waist-a")[0], 9 / 24), "11: 옆 이동 축 ≠ 허리 직선 → 갱신 안 함");
}

console.log("══════════════════════════════════════════════");
if (FAIL) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); }
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
