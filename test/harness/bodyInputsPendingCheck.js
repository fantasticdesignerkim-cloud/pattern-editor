// ══════════════════════════════════════════════
// bodyInputsPendingCheck.js — 몸판·네크라인·여밈 «적용하지 않은 값» 판정(2026-11-15 사용자 신고: 재단 진입 차단)
//   원인: ui.js 가 입력칸 문자열을 fmtL(적용값)(0.1 반올림 문자열)과 비교 → «1.20»·«1.0»(= 1.2·1) · 1.25 적용(→ «1.3» 과 비교)이
//         같은 값인데 «적용 안 한 값»으로 막혔다(재단 열기·프로젝트 열기 공통 권위 projectSessionUI.unfinished).
//   ui.js 실제 함수 본문을 소스에서 추출해 실행한다(fmtL · committedBody · committedNeckline · committedPlacket · BODY_INPUT_FIELDS ·
//   inputMatchesCommitted · bodyInputsUnappliedList). DOM 은 입력칸 값만 흉내 낸다.
//   §1 표현 차이 = 같음(1.20 · 1.0 · 1.00 · 01.2 · 1.2e0 · 앞뒤 공백) · 0.1 넘는 정밀도 적용값(1.25) = 같음 · 화면이 채우는 반올림 값 = 같음
//   §2 실제 미적용 = 그대로 막음 + 칸 이름·칸 값·적용값·버튼(1.3 vs 1.2 · 빈칸 vs 숫자 · 숫자 vs 미지정 · NaN · 무한 · 글자)
//   §3 빈칸 = 미지정(다트량·목표 허리 null) 일 때만 같음 · 네크라인 형태 차이 · 숨김 칸도 같은 규칙 · 이 project 로 채우지 않은 칸은 판정 안 함
//   node test/harness/bodyInputsPendingCheck.js
// ══════════════════════════════════════════════
"use strict";
const vm = require("vm"), fs = require("fs"), path = require("path");
let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
const J = JSON.stringify, ROOT = path.join(__dirname, "..", "..");
const UI_SRC = fs.readFileSync(path.join(ROOT, "js", "ui.js"), "utf8");
const cut = (from, to) => { const a = UI_SRC.indexOf(from), b = UI_SRC.indexOf(to, a); return (a >= 0 && b > a) ? UI_SRC.slice(a, b) : ""; };
const SRC = [cut("  function fmtL(", "  function designProjectNow("), cut("  function committedBody(", "\n  }\n") + "\n  }\n", cut("  function committedNeckline(", "  // ── 네크라인 카드"),
  cut("  function committedPlacket(", "  // 현재 유효 앞판 외곽"), cut("  const BODY_INPUT_FIELDS", "  function projectUnfinished(")];
ok(SRC.every(s => s.length > 20) && /Number\.isFinite/.test(SRC[4]), "0: ui.js 에서 판정 함수 본문 추출(제품 코드 그대로)");

const ELS = {}; let NECK = "original";
const sb = { Math, Number, String, JSON, Object, Array, document: { getElementById: id => ELS[id] || null } };
sb.globalThis = sb; vm.createContext(sb);
vm.runInContext("var bodyPanelProject = null; function currentNeckType() { return this.__neck(); }\n" + SRC.join("\n") +
  "\nthis.__list = bodyInputsUnappliedList; this.__setPanel = function (p) { bodyPanelProject = p; }; this.__fields = BODY_INPUT_FIELDS;", sb, { filename: "ui.js#pending" });
sb.__neck = () => NECK;
const LIST = sb.__list, FIELDS = sb.__fields;
// 실제 대표 프로젝트 값(박시 A + 여밈 1.2/1.2 — 2026-11-15 재현 동선과 같은 적용값)
const P = { working: { parameters: { body: { bustEaseCm: 0, hemExtensionBelowWaistCm: 20, waistSideOffsetCm: 0, hemSideOffsetCm: 0, sideSeamCurve: 0 },
  neckline: { mode: "parametric", type: "original", parameters: { neckWidthCm: 0, frontDepthCm: 0, backDepthCm: 0, curveAmountNorm: 1, vPointDepthCm: 0, squareWidthCm: 0, cornerRadiusCm: 0 } } },
  frontPlacket: { parameters: { overlapCm: 1.2, facingWidthCm: 1.2, lengthMode: "full" } } } };
// 화면이 이 project 로 칸을 채운 상태(ui.js 가 fmtL 로 채우는 값 · 다트량·목표 허리 = 빈칸)
function fill() {
  const v = { inpBodyBustEase: "0", inpBodyHemExtension: "20", inpBodyWaistOffset: "0", inpBodyHemOffset: "0", inpBodySideCurve: "0", inpBodyWaistDartTotal: "", inpBodyWaistTarget: "",
    inpNeckWidth: "0", inpNeckFrontDepth: "0", inpNeckBackDepth: "0", inpNeckCurveAmount: "1", inpNeckVDepth: "0", inpNeckSquareWidth: "0", inpNeckCornerRadius: "0", inpPlacketOverlap: "1.2", inpPlacketFacing: "1.2" };
  Object.keys(v).forEach(id => { ELS[id] = { id, value: v[id] }; }); NECK = "original"; sb.__setPanel(P);
}
const ids = l => l.map(x => x.id).join(",");

// ══ §1 같은 값 = 미적용 아님 ══
fill();
ok(FIELDS.length === 16 && LIST(P).length === 0, "1: 채운 그대로 = 미적용 없음(16칸)");
["1.20", "1.200", "01.2", "1.2e0", " 1.2 ", "1.2"].forEach(s => { fill(); ELS.inpPlacketOverlap.value = s; ok(LIST(P).length === 0, "1: 여밈분 칸 «" + s + "» ↔ 적용 1.2 = 같은 값(예전엔 문자열이 달라 차단)"); });
fill(); P.working.frontPlacket.parameters.overlapCm = 1; ["1", "1.0", "1.00"].forEach(s => { ELS.inpPlacketOverlap.value = s; ok(LIST(P).length === 0, "1: 칸 «" + s + "» ↔ 적용 1 = 같음"); });
P.working.frontPlacket.parameters.overlapCm = 1.25; ELS.inpPlacketOverlap.value = "1.25";
ok(LIST(P).length === 0, "1: 1.25 를 적용(0.1 넘는 정밀도) → 칸 «1.25» = 같음(예전엔 «1.3» 과 비교해 차단)");
ELS.inpPlacketOverlap.value = "1.3";
ok(LIST(P).length === 0, "1: 화면이 적용값 1.25 를 0.1 반올림해 채운 «1.3» = 같음(열기·탭 전환 뒤 거짓 미적용 방지 · 기존 동작 유지)");
P.working.frontPlacket.parameters.overlapCm = 1.2;
fill(); P.working.parameters.body.waistDartTotalCm = 8.5; ELS.inpBodyWaistDartTotal.value = "8.50";
ok(LIST(P).length === 0, "1: 허리 다트량 적용 8.5 ↔ 칸 «8.50» = 같음"); delete P.working.parameters.body.waistDartTotalCm;

// ══ §2 실제 미적용 = 막음 + 구체 안내 ══
fill(); ELS.inpPlacketOverlap.value = "1.3";
let L = LIST(P);
ok(ids(L) === "inpPlacketOverlap" && L[0].label === "여밈분" && L[0].shown === "1.3" && L[0].applied === 1.2 && L[0].button === "«여밈 적용»", "2: 칸 1.3 ↔ 적용 1.2 = 미적용(여밈분 · 칸 값 · 적용값 · «여밈 적용») " + J(L));
fill(); ELS.inpBodyHemExtension.value = "22";
L = LIST(P); ok(ids(L) === "inpBodyHemExtension" && L[0].label === "엉덩이 길이" && /몸판 탭 «적용»/.test(L[0].button), "2: 엉덩이 길이 22 ↔ 20 = 미적용 · 몸판 탭 «적용»");
fill(); ELS.inpBodyHemExtension.value = "";
ok(ids(LIST(P)) === "inpBodyHemExtension", "2: 숫자가 적용된 칸을 비움 = 미적용(빈칸을 0 으로 보지 않음)");
fill(); ELS.inpBodyWaistDartTotal.value = "8";
ok(ids(LIST(P)) === "inpBodyWaistDartTotal" && LIST(P)[0].applied === null, "2: 미지정(원형 그대로) 다트량 칸에 8 = 미적용(적용값 없음)");
["abc", "NaN", "Infinity", "-Infinity", "1e999"].forEach(s => { fill(); ELS.inpPlacketFacing.value = s; ok(ids(LIST(P)) === "inpPlacketFacing", "2: 칸 «" + s + "»(유한 숫자 아님) = 미적용으로 막음"); });
fill(); ELS.inpPlacketFacing.value = "1.2000001";
ok(ids(LIST(P)) === "inpPlacketFacing", "2: 1.2000001 ↔ 1.2 = 다른 값(1e-9 넘는 차이는 같은 값으로 보지 않음)");

// ══ §3 빈칸·네크라인·숨김·판정 범위 ══
fill(); ok(LIST(P).length === 0 && ELS.inpBodyWaistTarget.value === "", "3: 목표 허리 빈칸 ↔ 미지정 = 같음");
fill(); NECK = "round";
L = LIST(P); ok(ids(L) === "necklineCards" && L[0].shown === "round" && L[0].applied === "original", "3: 네크라인 형태 카드만 바꿈 = 미적용(형태 · 몸판 탭 «적용»)");
fill(); ELS.inpNeckVDepth.value = "0.0";
ok(LIST(P).length === 0, "3: 숨김 칸(V끝점 깊이) «0.0» ↔ 0 = 같음(숨김 칸도 같은 숫자 규칙)");
fill(); ELS.inpNeckVDepth.value = "3";
ok(ids(LIST(P)) === "inpNeckVDepth", "3: 숨김 칸이라도 실제로 다른 숫자 = 미적용(판정 일관 · 숨김이라 무시하지 않음)");
fill(); sb.__setPanel(null); ELS.inpPlacketOverlap.value = "9";
ok(LIST(P).length === 0, "3: 이 project 로 채운 적 없는 칸 = 판정 안 함(기존 규칙)");
fill(); const before = J(P); LIST(P);
ok(J(P) === before && ELS.inpPlacketOverlap.value === "1.2", "3: 판정은 읽기만(프로젝트·입력칸 무변경 · 자동 적용/지움 없음)");

// 안내 문구(projectUnfinished 본문) — 칸 이름·값·적용값·버튼이 들어간다
const PU = cut("  function projectUnfinished(", "\n  }\n");
ok(/bodyInputsUnappliedList\(p\)/.test(PU) && /u\.label/.test(PU) && /u\.button/.test(PU) && /적용»하지 않은 값이 있습니다/.test(PU), "3: projectUnfinished = 같은 목록으로 막고, 안내에 칸 이름·칸 값·적용값·버튼을 적는다");

console.log("bodyInputsPendingCheck: " + PASS + " passed, " + FAIL + " failed");
fails.forEach(f => console.log("  FAIL " + f));
process.exit(FAIL ? 1 : 0);
