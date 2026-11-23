// designButtonsCheck.js — js/designButtons.js 순수 계산 회귀.   node test/harness/designButtonsCheck.js
const vm = require("vm"), fs = require("fs"), path = require("path");
let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
const sb = { window: {}, Math, JSON, Object, Array, isFinite, Number };
vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "..", "js", "designButtons.js"), "utf8"), sb);
const B = sb.window.designButtons;
const F = { cfX: 47.5, topY: 5, botY: 45 };   // 길이 40
ok(Object.isFrozen(B), "0: frozen");

let r = B.compute({ startCm: 4, endCm: 36, count: 5 }, F);
ok(r.ok && r.marks.length === 5, "1: 5개");
ok(r.marks.every(m => m.x === 47.5), "2: x = cfX");
ok(near(r.marks[0].y, 9) && near(r.marks[4].y, 41), "3: 양끝 = topY+거리");
const gaps = r.marks.slice(1).map((m, i) => m.y - r.marks[i].y);
ok(gaps.every(g => near(g, 8)), "4: 균등 간격 8");

r = B.compute({ startCm: 10, endCm: 30, count: 2 }, F);
ok(r.ok && r.marks.length === 2 && near(r.marks[0].y, 15) && near(r.marks[1].y, 35), "5: 개수 2 = 시작·끝");
r = B.compute({ startCm: 10, endCm: 999, count: 1 }, F);
ok(r.ok && r.marks.length === 1 && near(r.marks[0].y, 15) && r.parameters.endCm === 10, "6: 개수 1 = 시작 한 곳(끝 무시)");
r = B.compute({ startCm: 0, endCm: 40, count: 3 }, F);
ok(r.ok && near(r.marks[0].y, 5) && near(r.marks[2].y, 45), "7: 경계 0·길이 허용");

const rej = (p, why, name) => { const x = B.compute(p, F); ok(!x.ok && x.reason === why, name + " → " + (x.reason || "ok")); };
rej({ startCm: 10, endCm: 10, count: 3 }, "start-equals-end", "8: 시작=끝");
rej({ startCm: 30, endCm: 10, count: 3 }, "reversed", "9: 역순");
rej({ startCm: -1, endCm: 10, count: 3 }, "out-of-range", "10: 시작 음수");
rej({ startCm: 5, endCm: 41, count: 3 }, "out-of-range", "11: 끝이 길이 초과");
rej({ startCm: 41, endCm: 50, count: 1 }, "out-of-range", "12: 개수1 시작 초과");
rej({ startCm: 1, endCm: 5, count: 0 }, "invalid-count", "13: 개수 0");
rej({ startCm: 1, endCm: 5, count: 2.5 }, "invalid-count", "14: 개수 소수");
rej({ startCm: 1, endCm: 5, count: 41 }, "invalid-count", "15: 개수 상한 초과");
rej({ startCm: NaN, endCm: 5, count: 2 }, "invalid-position", "16: NaN");
rej(null, "invalid-position", "17: params null");
ok(B.compute({ startCm: 1, endCm: 5, count: 2 }, null).reason === "no-frame", "18: frame 없음");
ok(B.compute({ startCm: 1, endCm: 5, count: 2 }, { cfX: 1, topY: 5, botY: 5 }).reason === "no-frame", "19: 길이 0 frame");

// 입력 불변·결정성
const p0 = { startCm: 4, endCm: 36, count: 5 }, f0 = JSON.stringify(F);
const a = B.compute(p0, F), b = B.compute(p0, F);
ok(JSON.stringify(p0) === '{"startCm":4,"endCm":36,"count":5}' && JSON.stringify(F) === f0, "20: 입력 불변");
ok(JSON.stringify(a) === JSON.stringify(b), "21: 결정적");

// 저장본 검증·왕복
const saved = JSON.parse(JSON.stringify({ parameters: a.parameters, marks: a.marks }));
ok(B.validateStored(saved).ok && B.validateStored(null).ok && B.validateStored(undefined).ok, "22: 저장본·없음 허용");
const bad = (m, n) => ok(!B.validateStored(m).ok, n);
bad({ parameters: a.parameters, marks: a.marks.slice(1) }, "23: 개수 불일치");
bad({ parameters: { startCm: 5, endCm: 5, count: 2 }, marks: [{ x: 1, y: 1 }, { x: 1, y: 2 }] }, "24: 시작=끝 저장본");
bad({ parameters: a.parameters, marks: a.marks.slice().reverse() }, "25: 순서 역전");
bad({ parameters: a.parameters, marks: a.marks.map(m => ({ x: NaN, y: m.y })) }, "26: NaN 좌표");
bad([], "27: 배열");
bad("x", "28: 문자열");

// 지름(2026-11-23 사용자 확정 11.5mm) — 표시용, 위치 계산 불변. 책 P.120 의 1.3 은 기본값이 아니다.
ok(a.parameters.diameterCm === 1.15 && B.DEFAULT_DIAMETER === 1.15 && B.LEGACY_DIAMETER === 1.3 && B.DEFAULT_HOLE === 1.3, "29: 지름 생략 = 1.15 · 옛 값 1.3 · 구멍 기본 1.3");
ok(!("holeLengthCm" in a.parameters) && a.holes === undefined, "29b: 구멍 길이를 안 주면 구멍 없음(키 자체가 없다)");
const d2 = B.compute({ startCm: 4, endCm: 36, count: 5, diameterCm: 2 }, F);
ok(d2.ok && d2.parameters.diameterCm === 2 && JSON.stringify(d2.marks) === JSON.stringify(a.marks), "30: 지름 지정 · 위치 무변화");
ok(B.compute({ startCm: 4, endCm: 36, count: 5, diameterCm: 0.5 }, F).ok && B.compute({ startCm: 4, endCm: 36, count: 5, diameterCm: 5 }, F).ok, "31: 지름 경계 0.5·5 허용");
rej({ startCm: 4, endCm: 36, count: 5, diameterCm: 0.4 }, "invalid-diameter", "32: 지름 하한 미만");
rej({ startCm: 4, endCm: 36, count: 5, diameterCm: 5.1 }, "invalid-diameter", "33: 지름 상한 초과");
rej({ startCm: 4, endCm: 36, count: 5, diameterCm: NaN }, "invalid-diameter", "34: 지름 NaN");
const legacy = { parameters: { startCm: 4, endCm: 36, count: 5 }, marks: a.marks };
ok(B.validateStored(legacy).ok, "35: 지름 없는 이전 저장본 허용");
bad({ parameters: Object.assign({}, a.parameters, { diameterCm: 9 }), marks: a.marks }, "36: 저장본 지름 범위 밖");

// ── 단춧구멍(2026-11-23 사용자 확정 13mm · 앞중심 가운데 수평) ──
const FH = { cfX: 47.5, topY: 5, botY: 45, overlapCm: 1.5 };
const h1 = B.compute({ startCm: 4, endCm: 36, count: 5, diameterCm: 1.15, holeLengthCm: 1.3 }, FH);
ok(h1.ok && h1.holes.length === 5 && h1.parameters.holeLengthCm === 1.3 && h1.parameters.diameterCm === 1.15, "37: 구멍 5개");
ok(h1.holes.every((q, i) => near(q.a.x, 46.85) && near(q.b.x, 48.15) && q.a.y === q.b.y && q.a.y === h1.marks[i].y), "38: 앞중심 가운데 · 길이 1.3 · 단추 높이 · 수평");
ok(JSON.stringify(h1.marks) === JSON.stringify(B.compute({ startCm: 4, endCm: 36, count: 5, diameterCm: 1.15 }, FH).marks), "39: 구멍이 단추 위치를 바꾸지 않음");
const h1b = JSON.parse(JSON.stringify({ parameters: h1.parameters, marks: h1.marks, holes: h1.holes }));
ok(B.validateStored(h1b).ok, "40: 구멍 저장본 통과");
const rejH = (p, f, why, name) => { const x = B.compute(p, f); ok(!x.ok && x.reason === why, name + " → " + (x.reason || "ok")); };
rejH({ startCm: 4, endCm: 36, count: 2, diameterCm: 1.15, holeLengthCm: 1.0 }, FH, "hole-shorter-than-diameter", "41: 길이 < 지름");
ok(B.compute({ startCm: 4, endCm: 36, count: 2, diameterCm: 1.3, holeLengthCm: 1.3 }, FH).ok, "42: 길이 = 지름 허용");
rejH({ startCm: 4, endCm: 36, count: 2, holeLengthCm: 3.2 }, FH, "hole-exceeds-placket", "43: 끝이 완성 앞단(여밈분 1.5) 넘음");
rejH({ startCm: 4, endCm: 36, count: 2, holeLengthCm: 3.0 }, FH, "hole-exceeds-placket", "44: 끝이 완성 앞단에 닿으면 거부(안쪽에 남아야 함)");
ok(B.compute({ startCm: 4, endCm: 36, count: 2, holeLengthCm: 2.9 }, FH).ok, "44b: 끝이 완성 앞단 안쪽이면 허용");
rejH({ startCm: 0, endCm: 36, count: 2, holeLengthCm: 1.3 }, FH, "hole-on-edge", "44c: 첫 구멍이 목 가장자리에 닿음");
rejH({ startCm: 4, endCm: 40, count: 2, holeLengthCm: 1.3 }, FH, "hole-on-edge", "44d: 끝 구멍이 밑단 가장자리에 닿음");
{ const sp = { diameterCm: 1.15, holeLengthCm: 1.3, marks: h1.marks, holes: h1.holes };
  ok(B.validateSpec(sp, PK0()).ok, "44e: validateSpec 정상");
  ok(!B.validateSpec(Object.assign({}, sp, { extra: 1 }), PK0()).ok, "44f: 모르는 키 거부");
  ok(!B.validateSpec(Object.assign({}, sp, { holeLengthCm: 3 }), PK0()).ok, "44g: 길이가 앞단에 닿으면 거부");
  const edgeHoles = sp.holes.map((q, i) => i === 0 ? { a: { x: q.a.x, y: 5 }, b: { x: q.b.x, y: 5 } } : q), edgeMarks = sp.marks.map((q, i) => i === 0 ? { x: q.x, y: 5 } : q);
  ok(!B.validateSpec(Object.assign({}, sp, { marks: edgeMarks, holes: edgeHoles }), PK0()).ok, "44h: 가장자리 위 구멍 거부");
  ok(!B.validateSpec(sp, null).ok, "44i: 여밈 없으면 거부");
  ok(B.holeSpecOf(h1b, PK0()).ok && B.holeSpecOf(h1b, PK0()).spec && B.holeSpecOf(legacy, null).none && B.holeSpecOf(null, null).none && !B.holeSpecOf(h1b, null).ok, "44j: holeSpecOf — 구멍 있음/옛 단추 none/여밈 없음 거부"); }
function PK0() { return { parameters: { overlapCm: 1.5, facingWidthCm: 3 }, construction: [{ from: { x: 40, y: 5 }, to: { x: 40, y: 45 } }, { from: { x: 47.5, y: 5 }, to: { x: 47.5, y: 45 } }] }; }
rejH({ startCm: 4, endCm: 36, count: 2, holeLengthCm: 1.3 }, { cfX: 47.5, topY: 5, botY: 45, overlapCm: 0.5 }, "hole-exceeds-placket", "45: 여밈분 0.5 에 구멍 1.3");
rejH({ startCm: 4, endCm: 36, count: 2, holeLengthCm: 0 }, FH, "invalid-hole", "46: 길이 0");
rejH({ startCm: 4, endCm: 36, count: 2, holeLengthCm: 7 }, FH, "invalid-hole", "47: 길이 상한 초과");
rejH({ startCm: 4, endCm: 36, count: 2, holeLengthCm: 1.3 }, F, "no-frame", "48: 여밈분을 모르면 구멍 불가");
ok(B.validateStored({ parameters: Object.assign({}, h1.parameters, { holeLengthCm: 1.0 }), marks: h1.marks, holes: h1.holes }).ok === false, "49: 저장본 구멍 < 지름 거부");
ok(B.validateStored({ parameters: h1.parameters, marks: h1.marks }).ok === false, "50: 구멍 길이 있는데 좌표 없음 거부");
ok(B.validateStored({ parameters: a.parameters, marks: a.marks, holes: h1.holes }).ok === false, "51: 구멍 길이 없는데 좌표만 있으면 거부");
const holeSh = h1.holes.map(q => ({ a: { x: q.a.x + 0.2, y: q.a.y }, b: { x: q.b.x + 0.2, y: q.b.y } }));
ok(B.validateStored({ parameters: h1.parameters, marks: h1.marks, holes: holeSh }).ok === false, "52: 앞중심에서 어긋난 구멍 거부");
ok(B.validateStored(legacy).ok && !("holeLengthCm" in legacy.parameters), "53: 구멍 없는 옛 저장본은 그대로 유효");
// 여밈에서 다시 계산
const PK = { parameters: { overlapCm: 1.5, facingWidthCm: 3 }, construction: [{ from: { x: 40, y: 5 }, to: { x: 40, y: 45 } }, { from: { x: 47.5, y: 5 }, to: { x: 47.5, y: 45 } }] };
ok(JSON.stringify(B.frameFromPlacket(PK)) === JSON.stringify({ cfX: 47.5, topY: 5, botY: 45, overlapCm: 1.5 }) && B.frameFromPlacket(null) === null, "54: frameFromPlacket");
ok(B.verifyAgainstPlacket(h1b, PK).ok && B.verifyAgainstPlacket(legacy, null).ok, "55: 일치 · 구멍 없는 단추는 검사 안 함");
const PK2 = JSON.parse(JSON.stringify(PK)); PK2.parameters.overlapCm = 0.5;
ok(!B.verifyAgainstPlacket(h1b, PK2).ok && !B.verifyAgainstPlacket(h1b, null).ok, "56: 여밈분이 줄면 불일치 · 여밈 없음 불일치");

console.log(`designButtonsCheck: ${PASS} pass, ${FAIL} fail`);
if (FAIL) { console.log(fails.join("\n")); process.exit(1); }
