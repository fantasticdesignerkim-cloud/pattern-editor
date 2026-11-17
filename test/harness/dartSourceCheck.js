// ══════════════════════════════════════════════
// dartSourceCheck.js — 다트 이동 적용 결과의 출처 추적(2026-11-17 · 야간 리뷰 «치수를 바꿔도 옛 다트 결과가 남음» 재현 확인 뒤 최소 수정)
//   적용 결과에 «그때 1세대 외곽 서명 + 치수»(src)를 남기고, 지금 몸판과 다르면(stale) 또는 서명이 없으면(unsigned) 쓰지 않는다:
//   그리지 않음(liveApplied* = null) · 다음 절개 바탕으로 안 씀(getXTargetOutline = 새 1세대) · 이어 자르기 막음 · 값은 지우지 않음(«리셋»만).
//   §1 앞·뒤 적용 → live · §2 B/W/BL 각각 바꾸면 stale(pivot 혼용 차단) · 되돌리면 live · §3 몸판 곡선 핸들 변경 = stale · 소매 치수 = live
//   §7 다트 총량(inpDart · 원형 공식이 직접 읽음) = 서명·캐시 키에 포함 · 몸판 무관 값 오탐 없음
//   §4 서명 없는 옛 값 = unsigned(같다고 추정 안 함 · 값 보존) · §5 리셋 · §6 완료 게이트·안내 문구·렌더 읽기 지점(소스)
//   node test/harness/dartSourceCheck.js
// ══════════════════════════════════════════════
"use strict";
const fs = require("fs"), path = require("path");
const { createEngine } = require("./loadEngine");
const { applyRecipe } = require("./dartDriver");
let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
const J = JSON.stringify, ROOT = path.join(__dirname, "..", "..");

function fresh() {
  const h = createEngine(), E = h.engine, ctx = h.context, dims = { B: 83, W: 64, BL: 38 };
  const set = (id, v) => { ctx.document.getElementById(id).value = String(v); };
  const run = src => require("vm").runInContext(src, ctx);
  return { h, E, ctx, dims, set, run };
}
const applyFront = (T) => applyRecipe(T.E, "front", T.dims, { type: "front-waist", arcFraction: 0.35, piece: "A", moveFraction: 0.3 });
const applyBack = (T) => applyRecipe(T.E, "back", T.dims, { type: "back-waist", arcFraction: 0.5, piece: "A", moveFraction: 0.4 });
const status = (T, side) => T.run("dartAppliedStatus(" + J(side) + ").state");

// ══ §1 적용 = live ══
const T = fresh();
const rf = applyFront(T), rb = (() => { try { return applyBack(T); } catch (e) { return { status: "err " + e.message }; } })();
ok(rf.status === "applied" && status(T, "front") === "live" && T.E.dartMoveState.appliedFront.src && typeof T.E.dartMoveState.appliedFront.src.sig === "string" && T.E.dartMoveState.appliedFront.src.B === 83,
  "1: 앞판 적용 → 출처(src = 그때 1세대 외곽 서명 + B·W·BL 83/64/38) 기록 · 지금 몸판과 같음(live)");
ok(rb.status === "applied" && status(T, "back") === "live", "1: 뒤판 적용 → live " + J(rb.status));
const bakedF = T.E.dartMoveState.appliedFront.bakedSegments;
ok(T.run("getFrontTargetOutline(createDraft(83,64,38).pts, createDraft(83,64,38).formula, 83)") === bakedF, "1: live 이면 다음 절개 바탕 = 적용 결과(예전 그대로)");
// 2세대: 이어 적용해도 출처는 첫 적용의 것을 잇는다
const src1 = J(T.E.dartMoveState.appliedFront.src), rf2 = applyRecipe(T.E, "front", T.dims, { type: "side-seam", arcFraction: 0.5, piece: "A", moveFraction: 0.2 });
ok((rf2.status !== "applied" || J(T.E.dartMoveState.appliedFront.src) === src1) && status(T, "front") === "live", "1: 2세대 적용(" + rf2.status + ") = 출처 서명 그대로 이어감");

// ══ §2 치수 B·W·BL 각각 ══
[["inpB", 86], ["inpW", 66], ["inpBL", 39]].forEach(([id, v]) => {
  const U = fresh(); applyFront(U); try { applyBack(U); } catch (e) { /* 뒤판 레시피 실패는 아래에서 front 만 본다 */ }
  const before = J(U.E.dartMoveState.appliedFront), orig = { inpB: 83, inpW: 64, inpBL: 38 }[id];
  U.set(id, v);
  const d = U.run("createDraft(n('inpB'),n('inpW'),n('inpBL'))"), tgt = U.run("getFrontTargetOutline(createDraft(n('inpB'),n('inpW'),n('inpBL')).pts, createDraft(n('inpB'),n('inpW'),n('inpBL')).formula, n('inpB'))");
  const freshO = U.run("buildFrontOutline(createDraft(n('inpB'),n('inpW'),n('inpBL')).pts, createDraft(n('inpB'),n('inpW'),n('inpBL')).formula, n('inpB'))");
  const pivMove = Math.hypot(d.pts.BP.x - U.E.dartMoveState.appliedFront.pivot.x, d.pts.BP.y - U.E.dartMoveState.appliedFront.pivot.y);
  ok(status(U, "front") === "stale" && U.run("liveAppliedFront()") === null && J(tgt) === J(freshO) && J(U.E.dartMoveState.appliedFront) === before,
    "2: " + id + " " + orig + "→" + v + " = stale · 그리지 않음(liveAppliedFront null) · 다음 절개 바탕 = 새 1세대 외곽 · 적용 값은 그대로 보존 (pivot 이동 " + pivMove.toFixed(3) + "cm)");
  U.run("startDartMove(); selectDartSide('front');");
  ok(U.E.dartMoveState.mode !== "selectCut" && U.E.dartMoveState.side === null, "2: " + id + " — 바뀐 몸판 위에 옛 결과를 이어 자르지 않음(앞판 선택 막힘)");
  ok(/만든 것인데 치수가 바뀌었습니다/.test(U.run("dartStaleReason('front')")) && /«리셋»/.test(U.run("dartStaleReason('front')")), "2: " + id + " — 이유 안내(그때 치수 · 지금 치수 · 되돌리기/리셋)");
  U.set(id, orig);
  ok(status(U, "front") === "live" && U.run("liveAppliedFront()") === U.E.dartMoveState.appliedFront, "2: " + id + " 되돌림 = 다시 live(같은 몸판이면 다시 씀)");
});

// ══ §3 몸판 곡선 · 소매 치수 ══
{
  const U = fresh(); applyFront(U);
  ok(status(U, "front") === "live", "3: 기준 live");
  const arm = U.run("JSON.stringify(state.fArmH)");
  U.run("state.fArmH = state.fArmH ? JSON.parse(JSON.stringify(state.fArmH)) : state.fArmH; (function(){ const h = state.fArmH; if (h && typeof h === 'object') { const k = Object.keys(h).find(x => h[x] && typeof h[x].x === 'number'); if (k) h[k].x += 0.3; } })();");
  const changed = U.run("JSON.stringify(state.fArmH)") !== arm;
  ok(!changed || status(U, "front") === "stale", "3: 앞 진동 곡선 핸들을 움직이면(" + (changed ? "움직임" : "핸들 없음 — 건너뜀") + ") stale(치수 그대로여도 몸판이 바뀜)");
  if (changed) U.run("state.fArmH = JSON.parse(" + J(arm) + ")");
  ok(status(U, "front") === "live", "3: 곡선 되돌림 = live");
  U.ctx.document.getElementById("inpSL") ; // 소매 치수는 1세대 외곽 서명에 없다(입력칸도 엔진에 없음)
  ok(!/inpSL|inpHem/.test(fs.readFileSync(path.join(ROOT, "js", "dartMove.js"), "utf8").match(/function dartSourceNow[\s\S]*?\n}\n/)[0]), "3: 출처 서명 = B·W·BL + 몸판 곡선(진동·목) 핸들 · 1세대 외곽 좌표 — 소매 길이·소매단둘레는 들어가지 않음(바꿔도 live)");
}

// ══ §4 서명 없는 옛 값 ══
{
  const U = fresh(); applyFront(U);
  const keep = J(U.E.dartMoveState.appliedFront); delete U.E.dartMoveState.appliedFront.src;
  const d0 = U.run("createDraft(83,64,38)");
  ok(status(U, "front") === "unsigned" && U.run("liveAppliedFront()") === null && J(U.run("getFrontTargetOutline(createDraft(83,64,38).pts, createDraft(83,64,38).formula, 83)")) === J(U.run("buildFrontOutline(createDraft(83,64,38).pts, createDraft(83,64,38).formula, 83)")) && /알 수 없습니다/.test(U.run("dartStaleReason('front')")),
    "4: 출처 서명 없는 값 = unsigned — 치수가 같아도 같다고 추정하지 않음(쓰지 않음 · 안내)");
  ok(U.E.dartMoveState.appliedFront && J(Object.assign({}, U.E.dartMoveState.appliedFront)) === J(Object.assign(JSON.parse(keep), { src: undefined })), "4: 값은 그대로 남김(삭제 없음)");
}

// ══ §5 리셋 ══
{
  const U = fresh(); applyFront(U); U.set("inpB", 86);
  ok(status(U, "front") === "stale", "5: 기준 stale");
  U.run("resetDartMove()");
  ok(status(U, "front") === "none" && status(U, "back") === "none" && U.E.dartMoveState.appliedFront === null, "5: «리셋» = 적용 결과 지움(사용자가 누를 때만) → 새 치수에서 다시 적용 가능");
  const r = applyRecipe(U.E, "front", { B: 86, W: 64, BL: 38 }, { type: "front-waist", arcFraction: 0.35, piece: "A", moveFraction: 0.3 });
  ok(r.status === "applied" && status(U, "front") === "live" && U.E.dartMoveState.appliedFront.src.B === 86, "5: 리셋 뒤 새 치수(B 86)에서 적용 = live · 출처 B 86");
}

// ══ §6 완료 게이트 · 안내 · 읽기 지점 ══
{
  const wf = fs.readFileSync(path.join(ROOT, "js", "blockWorkflow.js"), "utf8"), ui = fs.readFileSync(path.join(ROOT, "js", "ui.js"), "utf8"), rd = fs.readFileSync(path.join(ROOT, "js", "render.js"), "utf8"), dm = fs.readFileSync(path.join(ROOT, "js", "dartMove.js"), "utf8");
  ok(/if \(measurementsDirty\(\)\) fail\("measure-dirty"\);[^\n]*\n[^\n]*\n\s*if \(typeof dartAppliedStatus === "function" && \["front", "back"\]\.some\([^)]*\) \{ var st = dartAppliedStatus\(sd\)\.state; return st === "stale" \|\| st === "unsigned"; \}\)\) fail\("dart-stale"\);/.test(wf),
    "6: 원형 완료 = stale/unsigned 다트 결과가 있으면 막음(dart-stale · 캡처 전)");
  ok(/reason === "dart-stale" \? "다트 이동 결과가 지금 몸판과 맞지 않습니다/.test(ui), "6: 완료 실패 안내 문구");
  ok(!/dartMoveState\??\.applied(Front|Back)/.test(rd) && (rd.match(/liveApplied(Front|Back)\(\)/g) || []).length >= 10 && /syncDartStaleNotice\(\)/.test(rd), "6: render.js 는 적용 결과를 liveAppliedFront/Back 으로만 읽는다(옛 결과를 그리지 않음) · 안내 갱신");
  ok(/const baked = liveAppliedFront\(\)\?\.bakedSegments;/.test(dm) && /const baked = liveAppliedBack\(\)\?\.bakedSegments;/.test(dm) && /if \(_prevApplied && dartAppliedStatus\(side\)\.state !== "live"\)/.test(dm), "6: 다음 절개 바탕·적용도 live 결과만");
  const bm = fs.readFileSync(path.join(ROOT, "js", "blockMaster.js"), "utf8");
  ok(/appliedDarts: \{\s*front: deepClone\(typeof dartMoveState !== "undefined" \? dartMoveState\.appliedFront : null\)/.test(bm), "6: 완료본 캡처 형식은 그대로(게이트가 앞에서 막으므로 stale 값이 들어가지 않음 · src 는 함께 기록됨)");
}

// ══ §7 다트 총량(inpDart) — 원형 공식이 직접 읽는 현재 입력(Codex 리뷰 2026-11-17) ══
{
  const U = fresh(); applyFront(U); try { applyBack(U); } catch (e) { /* 뒤판 레시피 실패는 front 만 본다 */ }
  ok(status(U, "front") === "live" && U.E.dartMoveState.appliedFront.src.Dart === 12.5, "7: 적용 출처에 다트 총량 12.5 기록");
  const before = J(U.E.dartMoveState.appliedFront), sw0 = J(U.run("createDraft(83,64,38).pts.FRONT_SIDE_WL")), dk0 = J(U.run("createDraft(83,64,38).darts"));
  U.set("inpDart", 14);
  const sw1 = J(U.run("createDraft(83,64,38).pts.FRONT_SIDE_WL")), dk1 = J(U.run("createDraft(83,64,38).darts"));
  ok(sw0 !== sw1 && dk0 !== dk1, "7: (독립 확인) 다트 총량 12.5→14 = 원형 허리 다트 a~f 와 옆선 허리점이 실제로 바뀜");
  ok(status(U, "front") === "stale" && status(U, "back") === "stale" && U.run("liveAppliedFront()") === null && J(U.E.dartMoveState.appliedFront) === before && /다트 총량이 바뀌었습니다\(지금 14\)/.test(U.run("dartStaleReason('front')")),
    "7: 다트 총량만 바꿔도 stale(캐시가 옛 출처를 돌려주지 않음) · 그리지 않음 · 값 보존 · 이유 «다트 총량이 바뀌었습니다»");
  U.run("startDartMove(); selectDartSide('front');");
  ok(U.E.dartMoveState.mode !== "selectCut", "7: 다트 총량이 바뀐 몸판 위에 이어 자르지 않음");
  U.set("inpDart", 12.5);
  ok(status(U, "front") === "live", "7: 다트 총량 되돌림 = live");
  // 몸판과 무관한 값 = 오탐 없음(엔진 입력칸에 없는 값은 문서 입력으로 흉내 내 바꿔 본다)
  ["inpSL", "inpHem", "inpCapAdj"].forEach(id => { const el = U.ctx.document.getElementById(id); if (el) el.value = "99"; });
  ok(status(U, "front") === "live" && !/inpSL|inpHem|inpCap/.test(fs.readFileSync(path.join(ROOT, "js", "dartMove.js"), "utf8").match(/function dartSourceNow[\s\S]*?\n}\n/)[0]), "7: 소매 길이·소매단둘레·소매산 보정 = 서명에 없음(오탐 없음)");
  ok(/const key = \[B, W, BL, Dart, /.test(fs.readFileSync(path.join(ROOT, "js", "dartMove.js"), "utf8")) && /JSON\.stringify\(\[B, W, BL, Dart, side/.test(fs.readFileSync(path.join(ROOT, "js", "dartMove.js"), "utf8")), "7: 캐시 키와 서명 둘 다 다트 총량 포함");
}

console.log("dartSourceCheck: " + PASS + " passed, " + FAIL + " failed");
fails.forEach(f => console.log("  FAIL " + f));
process.exit(FAIL ? 1 : 0);
