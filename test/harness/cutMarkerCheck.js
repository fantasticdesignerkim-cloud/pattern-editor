// cutMarkerCheck.js — 수동 마카 1단계 순수 계층(js/cutMarker.js · 2026-11-20): 저장 검증 · 정밀 겹침 · 자동 기본 배치 · 요척.
//   node test/harness/cutMarkerCheck.js
"use strict";
const M = require("../../js/cutMarker.js");
let PASS = 0, FAIL = 0; const fails = [];
const ok = (c, n) => { if (c) PASS++; else { FAIL++; fails.push(n); } };
const rect = (x, y, w, h) => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
const tri = (x, y, s) => [{ x, y }, { x: x + s, y }, { x, y: y + s }];

// 저장(엄격)
ok(M.read({ working: {} }).state === "none" && Math.abs(M.read({ working: {} }).widthCm - 152.4) < 1e-9, "1: 기본 천 폭 60in = 152.4cm");
ok(M.read({ working: { cutMarker: { schema: 1, widthCm: 110, moves: { "front#1": { cx: 10, cy: 20, rot: 0 } } } } }).state === "ready", "2: 정상 읽기");
[{ schema: 2, widthCm: 110, moves: {} }, { schema: 1, widthCm: 5, moves: {} }, { schema: 1, widthCm: 110, moves: { "front#1": { cx: 1, cy: 1, rot: 45 } } },
 { schema: 1, widthCm: 110, moves: { "bad": { cx: 1, cy: 1, rot: 0 } } }, { schema: 1, widthCm: 110, moves: {}, x: 1 }].forEach((s, i) =>
  ok(M.read({ working: { cutMarker: s } }).state === "invalid", "3." + i + ": 잘못된 저장은 읽지 않음"));
const pj = { working: {} }; ok(M.write(pj, 110, { "front#1": { cx: 1, cy: 2, rot: 90 } }).ok && pj.working.cutMarker.widthCm === 110, "4: 쓰기");
const pj2 = { working: {} }; ok(!M.write(pj2, 110, { "front#1": { cx: 1, cy: 2, rot: 7 } }).ok && pj2.working.cutMarker === undefined, "5: 잘못된 값은 쓰지 않음(원자성)");

// 겹침(정밀)
ok(!M.overlap(rect(0, 0, 10, 10), rect(10, 0, 10, 10)), "6: 변이 닿기만 하면 겹침 아님");
ok(M.overlap(rect(0, 0, 10, 10), rect(9, 0, 10, 10)), "7: 가로지르면 겹침");
ok(M.overlap(rect(0, 0, 10, 10), rect(2, 2, 3, 3)), "8: 완전히 안에 있으면 겹침");
ok(M.overlap(rect(0, 0, 10, 10), rect(0, 0, 10, 10)), "9: 정확히 포갠 것도 겹침");
ok(!M.overlap(tri(0, 0, 10), [{ x: 10, y: 10 }, { x: 4, y: 10 }, { x: 10, y: 4 }]), "10: 정밀 판정 — 상자는 겹쳐도 삼각형이 안 겹치면 겹침 아님");

// 인스턴스·자동 배치·평가
const items = [{ id: "back", label: "뒤판", ring: rect(0, 0, 50, 70), qty: 1 }, { id: "sleeve-a", label: "소매", ring: rect(0, 0, 40, 60), qty: 2 }, { id: "cuff", label: "커프스", ring: rect(0, 0, 25, 10), qty: null }];
const insts = M.instancesOf(items);
ok(insts.length === 4 && insts.map(i => i.id).join() === "back#1,sleeve-a#1,sleeve-a#2,cuff#1", "11: 수량만큼 인스턴스(미정은 1)");
const spec = M.read({ working: {} }), pl = M.resolve(insts, spec), ev = M.evaluate(insts, pl, spec.widthCm);
ok(ev.ok && !ev.overlaps.length && !ev.outside.length, "12: 자동 기본 배치는 겹침·이탈 없음");
ok(ev.lengthCm > 0 && Math.abs(ev.yards - ev.lengthCm / 91.44) < 1e-3, "13: 소요 길이·야드");
const bad = Object.assign({}, pl, { "sleeve-a#2": { cx: pl["sleeve-a#1"].cx, cy: pl["sleeve-a#1"].cy, rot: 0 } });
ok(M.evaluate(insts, bad, spec.widthCm).overlaps.length >= 1, "14: 사용자가 포개면 겹침 보고");
const out = Object.assign({}, pl, { "back#1": { cx: 400, cy: 40, rot: 0 } });
ok(M.evaluate(insts, out, spec.widthCm).outside.indexOf("back#1") >= 0, "15: 천 폭 밖 이탈 보고");
const rot = Object.assign({}, pl, { "back#1": Object.assign({}, pl["back#1"], { rot: 90 }) });
ok(M.evaluate(insts, rot, spec.widthCm).grainTurned.indexOf("back#1") >= 0, "16: 90° 회전은 식서 방향 경고");
ok(M.cmToInch(152.4) === 60 && M.inchToCm(60) === 152.4 && M.cmToYard(91.44) === 1, "17: 인치·야드 환산");
const narrow = M.resolve(insts, { widthCm: 60, moves: {} }), en = M.evaluate(insts, narrow, 60);
ok(en.outside.length === 0 && en.lengthCm > ev.lengthCm, "18: 폭이 좁으면 자동 배치가 줄을 바꿔 길이가 늘어남");
console.log("cutMarkerCheck: " + PASS + " passed, " + FAIL + " failed"); fails.forEach(f => console.log("  FAIL " + f)); process.exit(FAIL ? 1 : 0);
