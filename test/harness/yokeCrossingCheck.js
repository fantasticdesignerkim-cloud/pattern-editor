// yokeCrossingCheck — designYokeSeam 의 interiorCrossings/lineCrossings(비공개) 격자점 교차·접촉 회귀.
// 비공개 함수라 소스에서 해당 함수만 잘라 평가한다(공개 API 불변).
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "..", "js", "designYokeSeam.js"), "utf8");
const cut = (name) => { const a = src.indexOf("  function " + name); let d = 0, i = src.indexOf("{", a); for (let j = i; ; j++) { if (src[j] === "{") d++; if (src[j] === "}" && --d === 0) return src.slice(a, j + 1); } };
const body = ["yAt", "ptAt", "signChangeRoots", "interiorCrossings", "lineCrossings"].map(cut).join("\n");
const Y_TOL = 1e-3; const fail = (m) => { throw new Error(m); };
const { interiorCrossings, lineCrossings } = new Function("Y_TOL", "fail", body + "\nreturn {interiorCrossings, lineCrossings};")(Y_TOL, fail);
let pass = 0, bad = 0; const ok = (c, m) => { if (c) pass++; else { bad++; console.log("  ✗ " + m); } };
const P = (x, y) => ({ x, y }), near = (a, b) => Math.abs(a - b) < 1e-9;
const line = (a, b) => ({ kind: "line", from: a, to: b });
const cub = (a, b, c, d) => ({ kind: "cubic", from: a, c1: b, c2: c, to: d });
// 직선 0→40 : y=20 (t=0.5, 격자점) / 20.01 (비격자)
let r = interiorCrossings(line(P(0, 0), P(0, 40)), 20); ok(r.length === 1 && near(r[0], 0.5), "직선 y=20 격자점 교차 1개");
r = interiorCrossings(line(P(0, 0), P(0, 40)), 20.01); ok(r.length === 1 && near(r[0], 20.01 / 40), "직선 y=20.01 교차 1개");
// 곡선: y(t)=40t 에 해당하는 3차(제어점 등간격) — t=k/64 격자점 정확 교차
const lin = cub(P(0, 0), P(0, 40 / 3), P(0, 80 / 3), P(0, 40));
r = interiorCrossings(lin, 40 * 16 / 64); ok(r.length === 1 && near(r[0], 0.25), "곡선 격자점 교차 1개");
// 접촉: y 가 t=0.5 에서 극값 10 에 닿고 되돌아감(2차를 3차로 승격)
const tou = cub(P(0, 0), P(0, 20 / 3 * 2 - 0), P(0, 20 / 3 * 2), P(0, 0)); // 대칭 포물선형
const yMax = tou.from.y + 0; let yM = 0; for (let t = 0; t <= 1; t += 1 / 64) yM = Math.max(yM, 0 + (3 * (1 - t) * (1 - t) * t * tou.c1.y + 3 * (1 - t) * t * t * tou.c2.y));
r = interiorCrossings(tou, yM); ok(r.length === 0, "곡선 극값 접촉은 절개 아님");
// 접촉 직전·직후 한 칸 격자점 접촉(꺾인 3차: V 자형 정점이 격자점 t=0.5 에서 Ys 에 닿음)
const vee = cub(P(0, 10), P(0, 0), P(0, 0), P(0, 10)); // t=0.5 에서 y=2.5 최저 — 격자점
r = interiorCrossings(vee, 2.5); ok(r.length === 0, "격자점 접촉(최저점) 절개 아님");
r = interiorCrossings(vee, 5); ok(r.length === 2, "V 형 두 번 관통 2개");
// 끝점 접촉·공선
r = interiorCrossings(line(P(0, 0), P(0, 40)), 0); ok(r.length === 0, "끝점 접촉은 내부 교차 아님");
let threw = false; try { interiorCrossings(line(P(0, 5), P(10, 5)), 5); } catch (e) { threw = true; } ok(threw, "공선은 seam-collinear");
// lineCrossings: n=(0,1), S0=원점, c=20 / 곡선 격자점
r = lineCrossings(line(P(0, 0), P(0, 40)), P(0, 0), P(0, 1).x === 0 ? { x: 0, y: 1 } : null, 20); ok(r.length === 1 && near(r[0], 0.5), "lineCrossings 직선 격자점");
r = lineCrossings(lin, P(0, 0), { x: 0, y: 1 }, 40 * 16 / 64); ok(r.length === 1 && near(r[0], 0.25), "lineCrossings 곡선 격자점");
r = lineCrossings(vee, P(0, 0), { x: 0, y: 1 }, 2.5); ok(r.length === 0, "lineCrossings 접촉 제외");
console.log("yokeCrossingCheck: " + pass + " PASS / " + bad + " FAIL"); process.exit(bad ? 1 : 0);
