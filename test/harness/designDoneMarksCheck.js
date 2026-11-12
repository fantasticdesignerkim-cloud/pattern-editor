// ══════════════════════════════════════════════
// designDoneMarksCheck.js — 디자인 «완료» 표시(js/designDoneMarks.js · UI 전용 · 2026-11-10 김님 «소매 완료하고 카라로 넘어가면
//   외곽선이 몸판이랑 같이 테두리 선이 변경 · 카라도 끝났다는 걸 보여달라»)의 순수 판정과 연결 계약.
//   실제 화면(완료 직후·서브탭 이동·수정 → 변경됨·저장 → 복원)은 격리 127.0.0.1 브라우저에서 확인한다.
//   §1 stateOf: 완료본 없음 = 표시 없음 · 권위 fail 코드 → done / changed · 소매가 완료가 아니면 카라도 완료로 보이지 않음
//   §2 카라 종류 → 조각 group: collarCheckpoint 의 모든 완료본 종류 · render.js 가 실제로 그리는 group 이름만
//   §3 연결 계약: 판정은 updateDesignResultUI 의 같은 check 결과를 캐시 · render 는 apply 만(재검사 없음) · 접는선 제외 ·
//       완료본 객체가 바뀌면 캐시 무효 · 반영 뒤 움직인 선은 녹색 아님 · 녹색 = 몸판 수정 외곽과 같은 색·굵기 · 캐시 버전
//   §4 탭 이동: 다른 탭 조각의 선 선택은 해제(청록 덧그림이 남아 미완료처럼 보이지 않게)
//   node test/harness/designDoneMarksCheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");

let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
const ROOT = path.join(__dirname, "..", "..");
const rd = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const SRC = rd("js/designDoneMarks.js"), RENDER = rd("js/render.js"), UI = rd("js/ui.js"), CSS = rd("css/style.css"), HTML = rd("index.html"), CC = rd("js/collarCheckpoint.js");
const ctx = { window: {}, document: {}, Math: Math, JSON: JSON };
vm.createContext(ctx);
vm.runInContext(SRC, ctx);
const M = ctx.window.designDoneMarks;
ok(M && typeof M.update === "function" && typeof M.apply === "function" && typeof M.stateOf === "function", "0: 모듈 공개 API(update·apply·stateOf)");

// §1 stateOf
const S = M.stateOf, A = { x: 1 };
let s = S({ fails: ["no-sleeve", "no-collar"] });
ok(s.sleeve === null && s.collar === null, "1a: 완료본 없음 = 표시 없음(탭에 들어갔다는 이유로 완료 아님)");
s = S({ fails: ["no-collar"], _sleeve: A });
ok(s.sleeve === "done" && s.collar === null, "1b: 소매 완료본 = 현재와 일치 → 소매 완료 · 카라 없음");
s = S({ fails: [], _sleeve: A, _collar: A });
ok(s.sleeve === "done" && s.collar === "done", "1c: 둘 다 현재와 일치 → 둘 다 완료");
["sleeve-changed", "sleeve-bodice-mismatch", "sleeve-source-mismatch", "bodice-changed", "no-bodice"].forEach(f => {
  const r = S({ fails: [f], _sleeve: A, _collar: A });
  ok(r.sleeve === "changed" && r.collar === "changed", "1d: " + f + " → 소매 변경됨 · 카라도 완료로 보이지 않음");
});
["collar-changed", "collar-bodice-mismatch", "collar-source-mismatch", "collar-sleeve-order"].forEach(f => {
  const r = S({ fails: [f], _sleeve: A, _collar: A });
  ok(r.sleeve === "done" && r.collar === "changed", "1e: " + f + " → 카라 변경됨(소매는 그대로 완료)");
});
s = S({ fails: ["cut-invalid-on-final-bodice"], _sleeve: A, _collar: A });
ok(s.sleeve === "done" && s.collar === "done", "1f: Design 통합 전용 실패(절개선)는 소매·카라 완료 표시와 무관");
ok(S(null).sleeve === null && S({}).collar === null, "1g: 검사 결과 없음 = 표시 없음");

// §2 카라 종류 → group
const types = Array.from(new Set((CC.match(/type: "[a-z-]+"/g) || []).map(t => t.slice(7, -1))));
const groupsRendered = new Set((RENDER.match(/"data-design-collar":"[a-z-]+"/g) || []).map(t => t.split(":")[1].replace(/"/g, "")));
ok(types.length >= 14 && types.every(t => Array.isArray(M.COLLAR_GROUPS[t]) && M.COLLAR_GROUPS[t].length > 0), "2a: collarCheckpoint 의 모든 완료본 종류에 조각 group 지정 (" + types.length + "종)");
ok(Object.keys(M.COLLAR_GROUPS).every(t => M.COLLAR_GROUPS[t].every(g => groupsRendered.has(g))), "2b: 지정 group 은 render.js 가 실제로 그리는 이름만");
ok(M.COLLAR_GROUPS["shirt-two-piece"].join() === "stand,body" && M.COLLAR_GROUPS["shirt-wing-collar"].join() === "stand,wing-tip" && M.COLLAR_GROUPS["stand-collar"].join() === "standalone", "2c: 2피스 = 밴드·위 칼라 · 윙 = 밴드·끝 · 단독 스탠드 = standalone");
ok(Object.keys(M.COLLAR_GROUPS).every(t => M.COLLAR_GROUPS[t].indexOf("annotation") < 0), "2d: 제작 정보(annotation) group 은 녹색 대상 아님");

// §3 연결 계약
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map(l => l.replace(/(^|[^:"])\/\/.*$/, "$1")).join("\n");
ok(/const c = window\.designResult\.check\(project\);\n\s*if \(window\.designDoneMarks\) window\.designDoneMarks\.update\(project, c\);/.test(UI), "3a: updateDesignResultUI 의 같은 권위 check 결과를 캐시(추가 검사 없음)");
ok(/window\.designDoneMarks\.apply\(\);[^\n]*\n\s*if \(window\.designLineQuickBar\) window\.designLineQuickBar\.sync\(\);/.test(RENDER), "3b: render 는 그린 뒤 apply 만 부른다");
ok(!/\.check\(|isCurrent[A-Za-z]*Changed|invalidatedByBodice|complete\(/.test(CODE), "3c: 표시 모듈은 재검사·완료를 하지 않는다(render 매 프레임 비용 0)");
ok(/st\.bodiceRes !== \(w\.bodiceResult \|\| null\) \|\| st\.sleeveRes !== \(w\.sleeveResult \|\| null\) \|\| st\.collarRes !== \(w\.collarResult \|\| null\)/.test(CODE), "3d: 완료본 객체가 바뀌었으면 캐시를 쓰지 않음(거짓 완료 금지)");
ok(/path\.design-collar-stand, path\.design-collar-body, path\.design-collar-onepiece/.test(CODE) && !/design-collar-fold/.test(CODE) && /\.sleeve-cuff \.sleeve-cuff-cut/.test(CODE) && !/sleeve-cuff-(fold|overlap|placket)/.test(CODE), "3e: 재단 외곽만(접는선·꺾임선·여밈·덧단 완성선 제외)");
ok(/\[data-piece="sleeve"\]\[data-geometry-role="outline"\]/.test(CODE) && !/data-piece="(front|back)"/.test(CODE), "3f: 소매 표시는 소매 working 외곽만(몸판 조각을 소매 선택자로 잡지 않음 · 몸판은 §5) · 종전 문구: 몸판에는 표시하지 않음");
ok(/SS\.cutSig\(line\.segments\) !== o\.lineSig/.test(CODE) && /classList\.contains\("selected"\)/.test(CODE), "3g: 반영 뒤 움직인 선은 녹색 아님 · 선택 중인 선은 청록 우선");
ok(/s\.sleeve === "done"\) \{/.test(CODE) && /s\.collar === "done"\) els\.forEach/.test(CODE), "3h: 녹색은 done 일 때만(변경됨은 글자만)");
ok(/\.design-outline-composed\{[^}]*stroke:#0E9F6E;stroke-width:2\.8/.test(CSS) && /#cv \.stage-done\{stroke:#0E9F6E;stroke-width:2\.8\}/.test(CSS), "3i: 녹색 = 몸판 수정 외곽(.design-outline-composed)과 같은 색·굵기");
ok(/#cv \.done-badge\{pointer-events:none\}/.test(CSS) && /aria-hidden/.test(CODE), "3j: 글자는 클릭을 막지 않음 · 보조기기에 중복 낭독 없음(상태는 패널 문구가 소유)");
ok(!/geometry\s*=|\.hash\s*=|Result\s*=|patternLines\s*=|localStorage|sessionStorage/.test(CODE), "3k: geometry·완료본·hash·저장 무변경(읽기 전용)");
ok(/js\/designDoneMarks\.js\?v=2026111201/.test(HTML), "3l: 캐시 버전(designDoneMarks 2026111201)");

// §4 탭 이동 선택 해제
// §5 몸판 완료 표시(2026-11-12 김님 «박시 A → 여밈 → 몸판 완료 하면 외곽선 색이 안 바뀐다») — 녹색 = 유효 완료본과 현재 형상 일치(합성 외곽 유무와 분리)
s = S({ fails: ["no-bodice", "no-sleeve", "no-collar"] });
ok(s.bodice === null, "5a: 몸판 완료본 없음 = 몸판 표시 없음");
s = S({ fails: ["no-sleeve", "no-collar"], _bodice: A });
ok(s.bodice === "done" && s.sleeve === null, "5b: 몸판 완료본 = 현재와 일치 → 몸판 완료(소매·카라·합성 외곽 없이도)");
s = S({ fails: ["bodice-changed", "no-sleeve"], _bodice: A });
ok(s.bodice === "changed", "5c: 완료 뒤 몸판이 바뀜(bodice-changed) → 변경됨(녹색 없음)");
s = S({ fails: ["sleeve-changed", "cut-invalid-on-final-bodice"], _bodice: A, _sleeve: A });
ok(s.bodice === "done" && s.sleeve === "changed", "5d: 소매 변경·절개선 거부는 몸판 완료 표시를 바꾸지 않는다");
ok(/has\(\["bodice-changed"\]\)/.test(CODE) && /function originalCtx\(proj\)[\s\S]*?T\.isOriginalBodiceContext\(proj\)[\s\S]*?catch \(_\) \{ return false; \}/.test(CODE)
  && /original: originalCtx\(proj\)/.test(CODE) && /if \(s\.original\) \{/.test(CODE), "5e: 원래 몸판 맥락(designLineTool 판정 · update 때 한 번)에서만 — 소매 파생 몸판에는 표시 없음 · 판정 불가 = 표시 없음");
ok(/\[data-design-outline="' \+ pc \+ '"\] path\.design-outline-composed/.test(CODE) && /\[data-layout-piece="' \+ pc \+ '"\] \[data-design-layer="working"\]\[data-geometry-role="outline"\]/.test(CODE)
  && !/data-design-root="(parts|boundary|placket)"/.test(CODE), "5f: 조각별 지금 외곽 = 합성 외곽(있으면) 또는 working 재단 외곽 · 분리 조각·외곽 미리보기·여밈 제외");
ok(/if \(s\.bodice !== "done"\) el\.classList\.add\("stage-undone"\)/.test(CODE) && /#cv \.design-outline-composed\.stage-undone\{stroke:#1D4ED8\}/.test(CSS)
  && /querySelectorAll\("\.stage-undone"\)\.forEach\(el => el\.classList\.remove\("stage-undone"\)\)/.test(CODE), "5g: 합성 외곽은 완료가 아니면 녹색이 아니다(남색) · 매 apply 초기화");
ok(/"몸판 완료" : "몸판 변경됨 · 다시 완료"/.test(CODE), "5h: 글자 «몸판 완료» / «몸판 변경됨 · 다시 완료»");
ok(/TAB_OF = \{ front: "body", back: "body", sleeve: "sleeve", collar: "collar" \}/.test(UI) && /TAB_OF\[l\.piece\] !== tab\) T\.setMode\("select"\)/.test(UI), "4a: 다른 탭 조각의 선택은 탭 이동 때 해제(선·역할·형상 무변경)");

console.log("══════════════════════════════════════════════");
fails.forEach(f => console.log("  ✗ " + f));
console.log("결과: " + PASS + " PASS / " + FAIL + " FAIL");
process.exit(FAIL ? 1 : 0);
