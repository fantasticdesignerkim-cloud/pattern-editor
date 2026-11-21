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

console.log(`designButtonsCheck: ${PASS} pass, ${FAIL} fail`);
if (FAIL) { console.log(fails.join("\n")); process.exit(1); }
