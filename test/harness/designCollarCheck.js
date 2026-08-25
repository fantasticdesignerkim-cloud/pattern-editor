// ══════════════════════════════════════════════
// designCollarCheck.js — js/designCollar.js C1 순수 파생 회귀.
//   스탠드 직선 스캐폴드: 목둘레 봉제 길이(반패턴 합계)·여밈 연장 분리·직선 밴드 형상·실패/불변.
//   node test/harness/designCollarCheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");
const SRC = fs.readFileSync(path.join(__dirname, "..", "..", "js", "designCollar.js"), "utf8");
let PASS = 0, FAIL = 0; const fails = [];
function ok(cond, name) { if (cond) PASS++; else { FAIL++; fails.push(name); } }
const near = (a, b, e = 1e-4) => Math.abs(a - b) < e;
const segLen = (s) => Math.hypot(s.to.x - s.from.x, s.to.y - s.from.y);
const partSeg = (g, part) => g.outline.find(s => s.part === part);

const sandbox = { window: {}, Math, Object, JSON, Array, isFinite, Infinity };
vm.createContext(sandbox);
vm.runInContext(SRC, sandbox, { filename: "designCollar.js" });
const C = sandbox.window.designCollar;

// bodiceResult fixture: 반패턴 합계 20cm, 여밈 overlap 1.75cm.
function bodice(neckHalf, overlap) {
  const b = { necklineLengths: { half: neckHalf, front: neckHalf / 2, back: neckHalf / 2, finished: 2 * neckHalf } };
  if (overlap !== undefined) b.placket = { parameters: { overlapCm: overlap, facingWidthCm: 4, lengthMode: "full" } };
  return b;
}

ok(typeof C.computeStand === "function" && typeof C.readBodice === "function" && Object.isFrozen(C), "0: API·frozen");

// 1. referenceParams 기본 3cm
ok(C.referenceParams().standHeightCm === 3, "1: referenceParams standHeight 3");

// 2. readBodice — 유효/실패
{
  const r = C.readBodice(bodice(20, 1.75));
  ok(r.ok && near(r.neckHalfCm, 20) && near(r.overlapCm, 1.75), "2: readBodice 유효 half 20·overlap 1.75");
  ok(C.readBodice(null).reason === "no-bodice", "2: no-bodice");
  ok(C.readBodice({ necklineLengths: { half: 0 } }).reason === "no-neckline", "2: no-neckline(0)");
  ok(C.readBodice({}).reason === "no-neckline", "2: no-neckline(누락)");
  ok(C.readBodice(bodice(20, -1)).reason === "invalid-overlap", "2: invalid-overlap(음수)");
  ok(C.readBodice(bodice(20)).ok && C.readBodice(bodice(20)).overlapCm === 0, "2: placket 없음 → overlap 0");
}

// 3. computeStand — 여밈 있는 기본 스탠드
{
  const r = C.computeStand(bodice(20, 1.75), { standHeightCm: 3 });
  ok(r.ok, "3: 파생 성공");
  ok(near(r.seamLenCm, 20), "3: seamLenCm = 반패턴 합계 20(연장 미포함)");
  ok(near(r.extensionLenCm, 1.75), "3: extensionLenCm = overlap 1.75");
  ok(near(r.standTopLenCm, 21.75), "3: standTopLenCm = 20 + 1.75");
  ok(near(r.standHeightCm, 3), "3: standHeightCm 3");
  // 세그먼트: neck-seam · extension · cf · top · cb-fold = 5
  ok(r.standGeometry.outline.length === 5, "3: outline 5세그(여밈)");
  ok(near(segLen(partSeg(r.standGeometry, "neck-seam")), 20), "3: neck-seam 길이 정확히 20");
  ok(near(segLen(partSeg(r.standGeometry, "extension")), 1.75), "3: extension 길이 1.75");
  ok(near(segLen(partSeg(r.standGeometry, "top")), 21.75), "3: 스탠드 윗선(top) 길이 21.75");
  ok(near(segLen(partSeg(r.standGeometry, "cf")), 3) && near(segLen(partSeg(r.standGeometry, "cb-fold")), 3), "3: CF·CB 높이 3");
  // 앵커 좌표
  const a = r.anchors;
  ok(near(a.cbSeam.x, 0) && near(a.cbSeam.y, 0) && near(a.cfSeam.x, 20), "3: CB(0,0)·CF봉제 x20");
  ok(near(a.cfExtSeam.x, 21.75) && near(a.cfTop.x, 21.75) && near(a.cfTop.y, -3) && near(a.cbTop.y, -3), "3: 완성앞단 x21.75·top y−3");
  // 닫힌 폐곡선: 각 세그 to == 다음 세그 from, 마지막 to == 첫 from
  let closed = true, o = r.standGeometry.outline;
  for (let i = 0; i < o.length; i++) { const nx = o[(i + 1) % o.length]; if (!near(o[i].to.x, nx.from.x) || !near(o[i].to.y, nx.from.y)) closed = false; }
  ok(closed, "3: outline 폐곡선 연속(오차 0)");
}

// 4. 여밈 없음(placket null) → 연장 세그 없음, extensionLen 0, CF봉제==완성앞단
{
  const r = C.computeStand(bodice(18), { standHeightCm: 3 });
  ok(r.ok && r.standGeometry.outline.length === 4, "4: 여밈 없음 → 4세그");
  ok(!partSeg(r.standGeometry, "extension"), "4: extension 세그 없음");
  ok(near(r.extensionLenCm, 0) && near(r.seamLenCm, 18) && near(r.standTopLenCm, 18), "4: extension 0·seam=top=18");
  ok(near(r.anchors.cfSeam.x, r.anchors.cfExtSeam.x), "4: CF봉제 == 완성앞단(연장 0)");
}

// 5. 기본 standHeight(params 생략) = 3
{
  const r = C.computeStand(bodice(20, 1.75));
  ok(r.ok && near(r.standHeightCm, 3), "5: params 생략 시 standHeight 3");
}

// 6. 커스텀 standHeight
{
  const r = C.computeStand(bodice(20, 1.75), { standHeightCm: 4 });
  ok(r.ok && near(r.standHeightCm, 4) && near(segLen(partSeg(r.standGeometry, "cf")), 4), "6: standHeight 4 반영");
}

// 7. 실패 — 잘못된 높이
{
  ok(C.computeStand(bodice(20, 1.75), { standHeightCm: 0 }).reason === "invalid-stand-height", "7: height 0 거부");
  ok(C.computeStand(bodice(20, 1.75), { standHeightCm: -2 }).reason === "invalid-stand-height", "7: height 음수 거부");
  ok(C.computeStand(bodice(20, 1.75), { standHeightCm: NaN }).reason === "invalid-stand-height", "7: height NaN 거부");
  ok(C.computeStand(null, { standHeightCm: 3 }).reason === "no-bodice", "7: bodice null 거부");
}

// 8. 입력 불변(bodiceResult 비변형)
{
  const b = bodice(20, 1.75);
  const before = JSON.stringify(b);
  C.computeStand(b, { standHeightCm: 3 });
  ok(JSON.stringify(b) === before, "8: bodiceResult 입력 불변");
}

console.log(`designCollarCheck: ${PASS} PASS, ${FAIL} FAIL`);
if (FAIL) { console.log("FAILURES:\n  " + fails.join("\n  ")); process.exit(1); }
