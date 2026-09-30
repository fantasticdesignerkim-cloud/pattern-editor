// shapedAnnotationCheck.js — 셰이프트 Ⓒ·Ⓓ 제작 정보 표시 모델(peplumAnnotation.buildModel) 회귀. 표시 전용.
//   node test/harness/shapedAnnotationCheck.js
const vm = require("vm"), fs = require("fs"), path = require("path"), cp = require("child_process");
let PASS = 0, FAIL = 0; const fails = [];
const ok = (c, n) => { if (c) PASS++; else { FAIL++; fails.push(n); } };
const J = JSON.stringify;
const ROOT = path.join(__dirname, "..", "..");
const mkCtx = (src) => {
  const sb = { window: {}, console: { log() {}, warn() {} }, Math, JSON, Object, Array, isFinite, structuredClone, Error, Date };
  sb.globalThis = sb; vm.createContext(sb);
  ["designLineTool.js", "designFlare.js", "designJoin.js", "designWaistSeam.js", "designBodice.js", "bodicePresets.js", "designLayout.js", "bodiceCheckpoint.js"]
    .forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, "js", f), "utf8"), sb, { filename: f }));
  vm.runInContext(src, sb, { filename: "peplumAnnotation.js" });
  return sb.window;
};
const W = mkCtx(fs.readFileSync(path.join(ROOT, "js", "peplumAnnotation.js"), "utf8"));
const OLD = mkCtx(cp.execSync("git show HEAD:js/peplumAnnotation.js", { cwd: ROOT, maxBuffer: 1 << 24 }).toString());
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));
const DB = W.designBodice, BP = W.bodicePresets, PA = W.peplumAnnotation, BC = W.bodiceCheckpoint;
const body = (id) => BP.bodyParams("bunka-bodice-" + id);
const geo = (id) => DB.computeGeometry(REF, { body: body(id) });
const txt = (m) => m.lines.map(l => l.text);
const near = (a, b, e = 0.03) => Math.abs(a - b) < e;
const names = (m) => m.darts.map(d => d.name).join();
const amt = (m, n) => (m.darts.find(d => d.name === n) || {}).amountCm;

for (const id of ["C", "D"]) {
  const g = geo(id), before = J(g), m = PA.buildModel(g, body(id));
  ok(m.front && m.back, id + ": 앞·뒤 모델");
  ok(J(g) === before, id + ": geometry 불변");
  const F = txt(m.front), B = txt(m.back);
  ok(F.includes("앞몸판") && B.includes("뒤몸판"), id + ": 조각명");
  ok(F.includes("앞중심(CF)") && B.includes("뒤중심(CB)"), id + ": CF·CB");
  [F, B].forEach(t => ["옆선", "허리선(WL)", "밑단선"].forEach(k => ok(t.includes(k), id + ": " + k)));
  [m.front, m.back].forEach(mm => {
    ok(!txt(mm).some(t => /°|각도/.test(t)), id + ": 각도 없음");
    mm.lines.forEach(l => ok(isFinite(l.at.x) && isFinite(l.at.y), id + ": 좌표 유한 " + l.id));
    mm.darts.forEach(d => ok(txt(mm).some(t => t.indexOf(d.name + " " + (id === "D" && d.name === "d" ? (Math.round(d.amountCm * 100) / 100).toFixed(2) : (Math.round(d.amountCm * 10) / 10).toFixed(1)) + "cm") === 0), id + ": 다트 라벨 " + d.name));
  });
  ok(near(amt(m.front, "a"), 1.75) && near(amt(m.back, "e"), 2.25) && near(amt(m.front, "c"), 0.69) && near(amt(m.back, "c"), 0.69), id + ": a·e·c 분량");
}
// 가슴선(BL): A·B·C·D 앞·뒤 — 수평, y = draft.js yBL(B/12+13.7), 옆선 상단점~중심선, «가슴선(BL)» 라벨, geometry 불변
for (const id of ["A", "B", "C", "D"]) {
  const g = geo(id), before = J(g), m = PA.buildModel(g, body(id)), yBL = 83 / 12 + 13.7;
  ok(J(g) === before, id + ": BL geometry 불변");
  for (const k of ["front", "back"]) {
    const mm = m[k], piece = g[k], bl = mm.legs.filter(l => l.id === "bl");
    ok(bl.length === 1 && mm.legs.length === 1, id + " " + k + ": BL 선 하나");
    if (bl.length !== 1) continue;
    const L = bl[0];
    ok(near(L.from.y, yBL, 1e-6) && near(L.to.y, yBL, 1e-6), id + " " + k + ": BL 수평 y=" + yBL.toFixed(3));
    const side = piece.outline.filter(o => J(o).includes('"side-seam"')).map(o => [o.from, o.to]).reduce((a, b) => a.concat(b), []);
    ok(side.some(q => near(q.x, L.to.x, 1e-9) && near(q.y, L.to.y, 1e-9)), id + " " + k + ": BL 끝 = 옆선 상단점");
    const cen = piece.outline.filter(o => J(o).includes('"center"') && o.kind === "line");
    ok(cen.some(o => Math.abs(o.from.x - L.from.x) < 1e-6 && Math.abs(o.to.x - L.from.x) < 1e-6), id + " " + k + ": BL 시작 = 중심선 위");
    ok(txt(mm).includes("가슴선(BL)") && mm.lines.filter(l => l.id === "bl").length === 1, id + " " + k + ": 가슴선(BL) 라벨");
  }
}
// C: b·d 제거 → 캔버스에 없음
{ const m = PA.buildModel(geo("C"), body("C"));
  ok(names(m.front) === "가슴,a,c" && names(m.back) === "뒤어깨,e,f,c", "C: 남은 다트만 " + names(m.front) + " / " + names(m.back));
  ok(txt(m.front).includes("C · 옆선 WL −1cm · 밑단 +1cm"), "C: 변형 문구");
  ok(!txt(m.front).concat(txt(m.back)).some(t => /제거|^b |^d /.test(t)), "C: 제거된 다트 캔버스 미표시"); }
// D: d 절반 표기
{ const m = PA.buildModel(geo("D"), body("D"));
  ok(names(m.front) === "가슴,a,b,c" && names(m.back) === "뒤어깨,d,e,f,c", "D: 남은 다트 " + names(m.back));
  ok(near(amt(m.front, "b"), 1.88) && near(amt(m.back, "d"), 2.19), "D: b·d 분량");
  ok(txt(m.back).includes("d 2.19cm(½)"), "D: d ½ 표기 " + txt(m.back).filter(t => /^d /.test(t)));
  ok(!txt(m.front).some(t => /½/.test(t)), "D: 앞판 ½ 없음");
  ok(txt(m.front).includes("D · 옆선 WL −1.5cm · 밑단 +1cm"), "D: 변형 문구"); }
// 식별 엄격: 편집이 섞이면 없음
{ const b = Object.assign({}, body("C"), { waistSideOffsetCm: -2 }); const m = PA.buildModel(DB.computeGeometry(REF, { body: b }), b); ok(!m.front && !m.back, "C 변형 편집: 없음");
  const b2 = Object.assign({}, body("D"), { bustEaseCm: 1 }); const m2 = PA.buildModel(DB.computeGeometry(REF, { body: b2 }), b2); ok(!m2.front && !m2.back, "D 추가 키: 없음"); }
// 화면의 정규화된 body(bustEaseCm·sideSeamCurve 0 동반)도 식별
for (const id of ["C", "D"]) { const b = Object.assign({ bustEaseCm: 0, sideSeamCurve: 0 }, body(id)); const m = PA.buildModel(DB.computeGeometry(REF, { body: b }), b); ok(m.front && m.back, id + ": 정규화 body 식별"); }
// A·B·M·N·O·P: HEAD 와 바이트 동일
// A·B: 가슴선(BL) 선·라벨만 뺀 나머지는 HEAD 와 바이트 동일
for (const id of ["A", "B"]) {
  const g = geo(id), o = JSON.parse(J(OLD.peplumAnnotation.buildModel(JSON.parse(J(g)), body(id)))), n = JSON.parse(J(PA.buildModel(g, body(id))));
  for (const k of ["front", "back"]) { n[k].legs = n[k].legs.filter(l => l.id !== "bl"); n[k].lines = n[k].lines.filter(l => l.id !== "bl"); }
  ok(J(o) === J(n), id + ": BL 제외하면 HEAD 와 바이트 동일");
}
for (const id of ["M", "N", "O", "P", "G"]) {
  const g = geo(id);
  ok(J(OLD.peplumAnnotation.buildModel(JSON.parse(J(g)), body(id))) === J(PA.buildModel(g, body(id))), id + ": HEAD 와 바이트 동일");
}
// project·hash 불변
for (const id of ["C", "D"]) {
  const mk = () => ({ sourceBlock: { version: 2, schemaVersion: 8 }, referenceGeometry: REF,
    working: { geometry: DB.computeGeometry(REF, { body: body(id) }), parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body: body(id) },
      patternLines: [], designOutline: null, frontPlacket: null } });
  const p1 = mk(), p2 = mk(), snap = J(p2);
  PA.buildModel(p2.working.geometry, p2.working.parameters.body);
  ok(J(p2) === snap, id + ": project 불변");
  ok(BC.check(p1).ok === BC.check(p2).ok, id + ": 검사 동일");
  BC.complete(p1); BC.complete(p2);
  ok(BC.latest(p1).hash === BC.latest(p2).hash, id + ": hash 동일");
}
console.log(`shapedAnnotationCheck: ${PASS} PASS / ${FAIL} FAIL`);
if (FAIL) { fails.forEach(f => console.log("  FAIL", f)); process.exit(1); }
