// boxyAnnotationCheck.js — 박시 Ⓐ·Ⓑ 제작 정보 표시 모델(peplumAnnotation.buildModel 의 body 확장) 회귀.
//   node test/harness/boxyAnnotationCheck.js
const vm = require("vm"), fs = require("fs"), path = require("path");
let PASS = 0, FAIL = 0; const fails = [];
const ok = (c, n) => { if (c) PASS++; else { FAIL++; fails.push(n); } };
const J = JSON.stringify;
const ROOT = path.join(__dirname, "..", "..");
const mkCtx = (annotationSrc) => {
  const sb = { window: {}, console: { log() {}, warn() {} }, Math, JSON, Object, Array, isFinite, structuredClone, Error, Date };
  sb.globalThis = sb; vm.createContext(sb);
  ["designLineTool.js", "designFlare.js", "designJoin.js", "designWaistSeam.js", "designBodice.js", "bodicePresets.js", "designLayout.js", "bodiceCheckpoint.js"]
    .forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, "js", f), "utf8"), sb, { filename: f }));
  vm.runInContext(annotationSrc, sb, { filename: "peplumAnnotation.js" });
  return sb.window;
};
const W = mkCtx(fs.readFileSync(path.join(ROOT, "js", "peplumAnnotation.js"), "utf8"));
const OLD = mkCtx(require("child_process").execSync("git show HEAD:js/peplumAnnotation.js", { cwd: ROOT, maxBuffer: 1 << 24 }).toString());
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));
const DB = W.designBodice, BP = W.bodicePresets, PA = W.peplumAnnotation, BC = W.bodiceCheckpoint;
const body = (id) => BP.bodyParams("bunka-bodice-" + id);
const geo = (id) => DB.computeGeometry(REF, { body: body(id) });
const txt = (m) => m.lines.map(l => l.text);
const near = (a, b, e = 0.06) => Math.abs(a - b) < e;

// 1. A·B 모델: 조각명·라벨·다트 분량(cm)·변형 문구
const exp = { A: "기본 박시", B: "밑단 +1cm" };
for (const id of ["A", "B"]) {
  const g = geo(id), before = J(g), m = PA.buildModel(g, body(id));
  ok(m.front && m.back, id + ": 앞·뒤 모델");
  ok(J(g) === before, id + ": geometry 불변(buildModel 순수)");
  const F = txt(m.front), B = txt(m.back);
  ok(F.includes("앞몸판") && B.includes("뒤몸판"), id + ": 조각명");
  ok(F.includes(exp[id]) && B.includes(exp[id]), id + ": 변형 문구");
  ok(F.includes("앞중심(CF)") && B.includes("뒤중심(CB)"), id + ": CF·CB");
  [F, B].forEach((t, i) => ["옆선", "허리선(WL)", "밑단선"].forEach(k => ok(t.includes(k), id + ": " + k + (i ? " 뒤" : " 앞"))));
  const other = id === "A" ? "밑단 +1cm" : "기본 박시";
  ok(!F.includes(other) && !B.includes(other), id + ": 다른 변형 문구 없음");
  const names = (mm) => mm.darts.map(d => d.name).join();
  ok(names(m.front) === "가슴,a,b,c", id + ": 앞 다트 " + names(m.front));
  ok(names(m.back) === "뒤어깨,d,e,f,c", id + ": 뒤 다트 " + names(m.back));
  // 분량 = 다리 입구 거리(독립 재계산) · cm 텍스트만(°·각도 없음)
  [m.front, m.back].forEach(mm => {
    mm.darts.forEach(d => ok(d.amountCm > 0 && txt(mm).some(t => t.indexOf(d.name + " " + (Math.round(d.amountCm * 10) / 10).toFixed(1) + "cm") === 0), id + ": 다트 " + d.name + " cm 라벨"));
    ok(!txt(mm).some(t => /°|각도/.test(t)), id + ": 각도 표시 없음");
    ok(mm.wedges.length === 0 && mm.legs.length === 1 && mm.legs[0].id === "bl" && mm.notches.length === 0, id + ": 안내선은 가슴선 하나뿐");
  });
  const c = (mm, n) => mm.darts.filter(d => d.name === n).map(d => d.amountCm);
  ok(near(c(m.front, "c")[0], 0.69) && near(c(m.back, "c")[0], 0.69), id + ": 옆허리 c 반쪽 0.69(그룹 1.37 의 절반)");
  ok(near(c(m.front, "a")[0], 1.75, 0.02) && near(c(m.front, "가슴")[0], 3.7, 0.1), id + ": a·가슴 분량");
  ok(near(c(m.back, "f")[0], 0.43, 0.02) && m.back.darts.find(d => d.name === "f").half, id + ": f 접힘 반쪽");
  // 라벨 좌표는 geometry 범위 안의 유한값
  [m.front, m.back].forEach(mm => mm.lines.forEach(l => ok(isFinite(l.at.x) && isFinite(l.at.y), id + ": 좌표 유한 " + l.id)));
}
ok(txt(PA.buildModel(geo("A"), body("A")).front).join() !== txt(PA.buildModel(geo("B"), body("B")).front).join(), "A·B 문구 구분됨");

// 2. 식별: 다른 body 는 모델 없음(C 이후 확대 금지)
const nul = (b, n) => { const g = DB.computeGeometry(REF, { body: b }); const m = PA.buildModel(g, b); ok(!m.front && !m.back, n); };
["G"].forEach(id => nul(body(id), id + ": 모델 없음"));
nul({ hemExtensionBelowWaistCm: 20, waistSideOffsetCm: -1, hemSideOffsetCm: 1, waistDartScales: { a: 1, b: 1, d: 0, e: 1 } }, "C 변형 편집: 없음");
nul({ hemExtensionBelowWaistCm: 20, hemSideOffsetCm: 2 }, "hem 2: 없음");
nul({ hemExtensionBelowWaistCm: 20, waistDartScales: { a: 0, b: 0, d: 0, e: 0 } }, "다트 배분 변경: 없음");
nul({ hemExtensionBelowWaistCm: 10 }, "hem 확장 10: 없음");
{ const g = geo("A"); const m = PA.buildModel(g); ok(!m.front && !m.back, "body 인자 없으면 없음(기존 호출 호환)"); }

// 3. 페플럼 N/O/P(+M): 기존 모델과 바이트 동일
for (const id of ["M", "N", "O", "P"]) {
  const g = geo(id);
  const a = J(OLD.peplumAnnotation.buildModel(JSON.parse(J(g)))), b = J(PA.buildModel(g)), c2 = J(PA.buildModel(g, body(id)));
  ok(a === b && a === c2, id + ": 기존(HEAD)과 바이트 동일");
}
ok(PA.buildModel(geo("P"), body("P")).front != null, "P: 모델 존재");

// 4. hash·체크포인트 불변(표시는 project 를 만지지 않는다)
for (const id of ["A", "B"]) {
  const mk = () => ({ sourceBlock: { version: 2, schemaVersion: 8 }, referenceGeometry: REF,
    working: { geometry: DB.computeGeometry(REF, { body: body(id) }), parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body: body(id) },
      patternLines: [], designOutline: null, frontPlacket: null } });
  const p1 = mk(), p2 = mk();
  const snap = J(p2);
  PA.buildModel(p2.working.geometry, p2.working.parameters.body);
  ok(J(p2) === snap, id + ": project 불변");
  ok(BC.check(p1).ok === BC.check(p2).ok, id + ": 검사 결과 동일");
  BC.complete(p1); BC.complete(p2);
  ok(BC.latest(p1).hash === BC.latest(p2).hash, id + ": hash 동일");
}
console.log(`boxyAnnotationCheck: ${PASS} PASS / ${FAIL} FAIL`);
if (FAIL) { fails.forEach(f => console.log("  FAIL", f)); process.exit(1); }
