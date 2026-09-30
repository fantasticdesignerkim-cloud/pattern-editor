// ══════════════════════════════════════════════
// peplumAnnotationCheck.js — 페플럼 제작 정보 표시 모델(js/peplumAnnotation.js) 회귀.
//
// 표시 전용이다: geometry·계측·체크포인트·hash·hit(bbox) 어디에도 영향이 없고, Ⓝ 에만 모델이 있다(Ⓜ·A 등 null).
// 표시 값(벌림량·총 플레어·절개 위치)은 designWaistSeam 메타·geometry edge 태그에서만 읽는다.
//
//   node test/harness/peplumAnnotationCheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");

let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
const J = JSON.stringify;
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

let PROJECT = null;
const sandbox = { window: {}, console: { log() {}, warn() {} }, Math, JSON, Object, Array, isFinite, structuredClone, Error, Date,
  c2p: (x, y) => [x * 10, y * 10], document: { createElementNS: () => ({ setAttribute() {}, appendChild() {} }) } };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
const load = (f) => vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "..", "js", f), "utf8"), sandbox, { filename: f });
["designLineTool.js", "designFlare.js", "designJoin.js", "designWaistSeam.js", "designYokeSeam.js", "designBodice.js", "bodicePresets.js",
  "designLayout.js", "designRenderer.js", "bodiceCheckpoint.js", "peplumAnnotation.js"].forEach(load);
sandbox.window.designWorkflow = { current: () => PROJECT };
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, PA = W.peplumAnnotation, BC = W.bodiceCheckpoint, DL = W.designLayout;
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));
const GN = DB.computeGeometry(REF, { body: BP.bodyParams("bunka-bodice-N") });
const GM = DB.computeGeometry(REF, { body: BP.bodyParams("bunka-bodice-M") });
const snap = J(GN);

ok(Object.isFrozen(PA) && typeof PA.buildModel === "function", "0: API·frozen");

// ── 1. 대상: Ⓝ 에만 모델이 있다 ──
{
  const m = PA.buildModel(GN);
  ok(m.front && m.back, "1: Ⓝ 은 앞·뒤 모델");
  const nm = PA.buildModel(GM);
  ok(nm.front === null && nm.back === null, "1: Ⓜ 은 모델 없음(화면 불변)");
  ["A", "B", "C", "D", "G"].forEach(s => {
    const g = DB.computeGeometry(REF, { body: BP.bodyParams("bunka-bodice-" + s) });
    const r = PA.buildModel(g);
    ok(r.front === null && r.back === null, "1: " + s + " 모델 없음");
  });
  const e = PA.buildModel(null), e2 = PA.buildModel({});
  ok(e.front === null && e2.back === null, "1: geometry 없음·이음선 없음 → null");
}

// ── 2. 표시 항목(교재 P.27/P.158 에서 확인 가능한 수준) ──
{
  const m = PA.buildModel(GN);
  [["front", "앞 페플럼", "앞중심(CF)"], ["back", "뒤 페플럼", "뒤중심(CB)"]].forEach(([k, name, cf]) => {
    const M = m[k], meta = GN.waistSeam[k], fl = meta.peplumFlare;
    const byId = (id) => M.lines.find(l => l.id === id);
    ok(byId("title") && byId("title").text === name, "2: " + k + " ① 조각명 '" + name + "'");
    ok(byId("center").text === cf && byId("side").text === "옆선", "2: " + k + " ② 중심·옆선 방향 표지");
    ok(Math.sign(byId("center").px.dx) === -Math.sign(byId("side").px.dx) && byId("center").anchor !== byId("side").anchor, "2: " + k + " ② 중심·옆선 표지는 서로 반대 바깥쪽");
    ok(byId("waist").text.indexOf("허리선") === 0 && byId("hem").text === "밑단선", "2: " + k + " ③ 허리선·밑단선 명칭");
    ok(M.cuts.length === 2 && M.cuts.every(c => c.matched) && M.legs.length === 4 && M.wedges.length === 2 && M.notches.length === 2, "2: " + k + " ④ 절개 2곳 — 안내선 4·쐐기 2·노치 2");
    // 안내선: 고정점(허리선의 입)에서 나가고 길이가 같다(이등변)
    ok(M.cuts.every((c, i) => { const a = M.legs[2 * i], b = M.legs[2 * i + 1]; return D(a.from, c.pivot) < 1e-9 && D(b.from, c.pivot) < 1e-9 && near(D(a.from, a.to), D(b.from, b.to), 1e-4); }), "2: " + k + " ④ 안내선 = 고정점에서 나가는 같은 길이 두 다리");
    // 다리 끝 두 점 사이 = 벌림량(∅/2), 표시 라벨과 같다
    ok(M.wedges.every((w, i) => near(D(w.pts[1], w.pts[2]), meta.joins[i].spread.chordCm, 1e-6)), "2: " + k + " ④ 쐐기 밑변 = 벌림량");
    ok(M.cuts.every((c, i) => byId("cut-" + i + "-amt").text === "벌림 " + (Math.round(meta.joins[i].spread.chordCm * 10) / 10).toFixed(1)), "2: " + k + " ⑤ 절개별 벌림량 라벨");
    ok(byId("flare").text.indexOf("∅ " + (Math.round(fl.totalCm * 10) / 10).toFixed(1) + "cm") >= 0 && byId("flare").text.indexOf("× 0.9 − 1") > 0, "2: " + k + " ⑤ 총 플레어·산식");
    ok(M.totalCm === fl.totalCm && M.finishedWaistCm === fl.finishedWaistCm, "2: " + k + " 값이 메타 그대로(표시가 계산하지 않는다)");
    ok(["strip-0", "strip-1", "strip-2"].map(id => byId(id) && byId(id).text).join("") === "ⒶⒷⒸ", "2: " + k + " ⑥ A·B·C 조각 표시(중심 → 옆 순서)");
    const sx = ["strip-0", "strip-1", "strip-2"].map(id => byId(id).at.x);
    ok(Math.abs(sx[0] - sx[1]) > 1 && Math.abs(sx[1] - sx[2]) > 1, "2: " + k + " ⑥ 세 조각 표시가 서로 떨어져 있다");
    ok(/^①[a-z]$/.test(byId("cut-0-name").text) && /^②[a-z]$/.test(byId("cut-1-name").text), "2: " + k + " ④ 절개 이름(번호 + 원래 다트 기호)");
    // 표시 위치는 조각 안에 있다(밑단 이음 사이) — 쐐기 세 점이 조각 bbox 안
    const xs = GN[k + "Peplum"].outline.flatMap(s => (s.commands ? s.commands.flatMap(c => c.points) : [s.from, s.to])).map(p => p.x);
    ok(M.wedges.every(w => w.pts.every(p => p.x >= Math.min(...xs) - 1e-6 && p.x <= Math.max(...xs) + 1e-6)), "2: " + k + " 쐐기가 조각 안");
  });
  // 앞과 뒤는 다른 값(각자 계산)
  ok(m.front.totalCm !== m.back.totalCm, "2: 앞·뒤 값이 각자 다르다");
}

// ── 3. 표시 전용 — 어디에도 영향 없음 ──
{
  PA.buildModel(GN);
  ok(J(GN) === snap, "3: geometry 불변(모델 생성이 입력을 바꾸지 않는다)");
  ok(J(PA.buildModel(GN)) === J(PA.buildModel(GN)), "3: 결정론");
  ok(!("annotation" in GN) && !("annotation" in GN.frontPeplum) && !("annotation" in GN.waistSeam), "3: 모델을 geometry 에 싣지 않는다");
  // hit·배치용 bbox 는 geometry 만 본다
  const bb1 = J(DL.bboxOf(GN, "front")), bb2 = (PA.buildModel(GN), J(DL.bboxOf(GN, "front")));
  ok(bb1 === bb2, "3: 배치 bbox(hit) 불변");
  // hash·완료·계측
  const mk = () => ({ sourceBlock: { version: 2, schemaVersion: 8 }, referenceGeometry: REF,
    working: { geometry: DB.computeGeometry(REF, { body: BP.bodyParams("bunka-bodice-N") }),
      parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body: BP.bodyParams("bunka-bodice-N") },
      patternLines: [], designOutline: null, frontPlacket: null } });
  PROJECT = mk(); const c1 = J(BC.check(PROJECT)); BC.complete(PROJECT); const h1 = BC.latest(PROJECT).hash;
  PROJECT = mk(); PA.buildModel(PROJECT.working.geometry); const c2 = J(BC.check(PROJECT)); BC.complete(PROJECT);
  ok(c1 === c2 && h1 === BC.latest(PROJECT).hash, "3: 모델을 만들어도 체크포인트 검사·hash 동일");
  const src = fs.readFileSync(path.join(__dirname, "..", "..", "js", "peplumAnnotation.js"), "utf8");
  ok(!/document\.|localStorage|state\.|designWorkflow/.test(src), "3: DOM·저장·상태 미접근(순수)");
}

// ── 4. Ⓞ·Ⓟ 상부 몸판 가슴선(BL): 옆선 상단점 y 의 수평선, 중심 직선변 x 까지. 라벨 1개. Ⓝ·A~D·나머지는 BL 없음 ──
{
  const ENDS = (s) => { const p = s.points || (s.commands ? s.commands.flatMap(c => c.points) : [s.from, s.to]); return [p[0], p[p.length - 1]]; };
  const blCount = (m) => (m.legs || []).filter(l => l.id === "bl").length + (m.lines || []).filter(l => l.id === "bl").length;
  const sig = (m) => J({ lines: m.lines.filter(l => l.id !== "bl"), legs: m.legs.filter(l => l.id !== "bl"), w: m.wedges, n: m.notches, c: m.cuts });
  ["O", "P"].forEach(id => {
    const body = BP.bodyParams("bunka-bodice-" + id);
    const g = DB.computeGeometry(REF, { body });
    const withB = PA.buildModel(g, body), noBody = PA.buildModel(g);
    ["front", "back"].forEach(k => {
      const piece = g[k], key = k + "Peplum", drop = DL.peplumDrop(g, key), m = withB[k];
      const sideYs = piece.outline.filter(s => s.edge === "side-seam").flatMap(s => ENDS(s).map(q => q.y));
      const yBL = Math.min(...sideYs);
      const sTop = piece.outline.filter(s => s.edge === "side-seam").flatMap(s => ENDS(s)).find(q => q.y === yBL);
      const cx = ENDS(piece.outline.filter(s => s.edge === "center")[0])[0].x;
      const legs = m.legs.filter(l => l.id === "bl"), lbl = m.lines.filter(l => l.id === "bl");
      ok(legs.length === 1 && lbl.length === 1, id + " " + k + ": BL leg·라벨 각 1개");
      const l = legs[0];
      ok(near(l.from.y, l.to.y), id + " " + k + ": BL 수평");
      ok(near(l.from.y + drop, yBL) && near(l.to.y + drop, yBL), id + " " + k + ": BL y(표시 내림 보정 후 = 옆선 상단 y)");
      ok(near(l.to.x, sTop.x) && near(l.from.x, cx), id + " " + k + ": BL 끝점 = 옆선 상단점 · 중심변");
      ok(lbl[0].text === "가슴선(BL)", id + " " + k + ": 라벨 문구");
      // 기존 페플럼 정보는 BL 제외하고 body 미전달(BL 없음) 모델과 동일
      ok(blCount(noBody[k]) === 0 && sig(m) === sig(noBody[k]), id + " " + k + ": 기존 페플럼 정보 개수·문구 유지");
      ok(m.lines.length === noBody[k].lines.length + 1 && m.legs.length === noBody[k].legs.length + 1, id + " " + k + ": 정확히 BL 1쌍만 추가");
    });
    ok(J(g) === J(DB.computeGeometry(REF, { body })), id + ": geometry 불변");
  });
  // Ⓝ·A~D·Ⓜ·Ⓖ·Ⓠ 는 BL 없음 / Ⓝ 은 body 를 넘겨도 불변
  const GNb = PA.buildModel(GN, BP.bodyParams("bunka-bodice-N"));
  ok(J(GNb) === J(PA.buildModel(GN)) && blCount(GNb.front) + blCount(GNb.back) === 0, "4: Ⓝ BL 없음·불변");
  ["M", "G", "Q"].forEach(s => {
    const b = BP.bodyParams("bunka-bodice-" + s), g = DB.computeGeometry(REF, { body: b }), m = PA.buildModel(g, b);
    ok(!m.front && !m.back || (blCount(m.front || { legs: [], lines: [] }) + blCount(m.back || { legs: [], lines: [] })) === 0, "4: " + s + " BL 없음");
  });
}

console.log("══════════════════════════════════════════════");
console.log(`peplumAnnotationCheck: ${PASS} PASS / ${FAIL} FAIL`);
if (FAIL) { fails.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
console.log("전부 통과 ✓");
