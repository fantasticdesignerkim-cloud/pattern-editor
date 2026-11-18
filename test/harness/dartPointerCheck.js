// ══════════════════════════════════════════════
// dartPointerCheck.js — 다트 회전 손잡이 입력 수명(2026-11-18 야간 리뷰 · Pointer Events + pointer capture)
//   재현(실제 브라우저 · 터치 에뮬레이션): 예전 mousedown/window mousemove/mouseup 은 터치에서 오지 않아 회전 0 · 손을 떼면 따라오는 클릭이 새 절개로 들어감.
//   여기서는 소스 계약을 본다(화면 처리기는 실제 브라우저 검사로 확인 — docs/STATUS.md). 회전 기하·골든은 다른 검사가 본다.
//   node test/harness/dartPointerCheck.js
// ══════════════════════════════════════════════
"use strict";
const fs = require("fs"), path = require("path");
let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
const src = fs.readFileSync(path.join(__dirname, "..", "..", "js", "dartMove.js"), "utf8");
const init = (src.match(/function initDartMoveClickHandler\(\) \{[\s\S]*?\n\}\n/) || [""])[0];

ok(!/addEventListener\("mousedown"/.test(src) && !/window\.addEventListener\("mousemove"/.test(src) && !/window\.addEventListener\("mouseup"/.test(src), "1: 손잡이 끌기에 마우스 전용 이벤트(mousedown · window mousemove/mouseup)를 쓰지 않음 — 터치·펜도 같은 경로");
ok(/svg\.addEventListener\("pointerdown", e => \{\s*if \(!dartMoveState\.active \|\| dartMoveState\.dragging\) return;\s*if \(!e\.target\.closest\("\.dart-rotate-handle"\)\) return;\s*if \(!e\.isPrimary \|\| \(e\.pointerType === "mouse" && e\.button !== 0\)\) return;/.test(init),
  "1: 손잡이 누름 = 주 포인터 하나만(isPrimary · 마우스는 왼쪽 단추) · 이미 끄는 중이면 무시");
ok(/svg\.setPointerCapture\(e\.pointerId\)/.test(init) && /e\.pointerId !== _dartDrag\.id/.test(init), "2: 받는 곳 = 캔버스 svg 에 pointer capture(render 가 손잡이를 다시 그려도 끊기지 않음) · 잡은 포인터 id 의 이벤트만");
ok(["pointerup", "pointercancel", "lostpointercapture"].every(t => new RegExp('svg\\.addEventListener\\("' + t + '"').test(init)) && /window\.addEventListener\("blur", \(\) => \{ if \(_dartDrag\) dartEndDrag\(null, "blur"\); \}\)/.test(init),
  "2: 끝 = pointerup · pointercancel · lostpointercapture · 창 blur 모두 정리");
ok(/canvasPan\.onMultiTouch\(\(\) => \{[\s\S]*?dartMoveState\.userAngle = _dartDrag\.angle0; dartMoveState\.evaluation = _dartDrag\.eval0;[\s\S]*?dartEndDrag\(null, "multi"\);/.test(init), "3: 두 번째 손가락(핀치) = 회전을 시작 각도로 되돌리고 끝냄(회전에 섞지 않음)");
const end = (src.match(/function dartEndDrag\(e, why\) \{[\s\S]*?\n\}\n/) || [""])[0];
ok(/releasePointerCapture\(d\.id\)/.test(end) && /if \(e && \(why === "up"\)\) _dartGestureClick = \{ x: e\.clientX, y: e\.clientY, until: Date\.now\(\) \+ 600 \};/.test(end), "4: 손을 뗄 때만 «그 동작의 클릭» 표시(600ms) · capture 해제");
const cons = (src.match(/function dartConsumeGestureClick\(e\) \{[\s\S]*?\n\}\n/) || [""])[0];
ok(/_dartGestureClick = null;   \/\/ 한 번만/.test(cons) && /Date\.now\(\) > g\.until \|\| Math\.hypot\(e\.clientX - g\.x, e\.clientY - g\.y\) > 30\) return false;/.test(cons), "4: 따라오는 클릭은 한 번만 · 시간·거리 밖이면 삼키지 않음(다음 정상 탭·단추는 그대로)");
ok(/svg\.addEventListener\("click", e => \{\s*if \(dartConsumeGestureClick\(e\)\) return;/.test(init), "4: 외곽 누름(새 절개) 처리 전에 그 한 번을 거름");
ok(/const handle = e\.target\.closest\("\.dart-rotate-handle"\) \|\| dartHandleAt\(e\.clientX, e\.clientY\);/.test(init) && /resolveRequestedAngle\(\s*dartMoveState\.evalCtx, dartMoveState\.baseAngle, dartMoveState\.baseAngle\)/.test(init), "5: 더블클릭 = 끝까지(예전 그대로) · capture 로 대상이 캔버스여도 손잡이 자리면 인정");
ok(/class: "dart-rotate-hit", cx: cx2, cy: cy2, r: 22, fill: "transparent", stroke: "none", "pointer-events": "all"/.test(src) && /cx: cx2, cy: cy2, r: 10,/.test(src), "6: 누름 영역 지름 44px(투명) · 보이는 손잡이 지름 20px 그대로");
const rot = (src.match(/function dartRotateTo\(e\) \{[\s\S]*?\n\}\n/) || [""])[0];
ok(/const resolved = resolveRequestedAngle\(dartMoveState\.evalCtx, userAngle, base\);/.test(rot) && /dartMoveState\.userAngle = resolved\.resolvedAngleRad;/.test(rot) && /dartMoveState\.evaluation = resolved\.evaluation;/.test(rot), "7: 회전 계산은 예전 그대로(④ resolveRequestedAngle → userAngle · evaluation) — 입력 수명만 바뀜");
const css = fs.readFileSync(path.join(__dirname, "..", "..", "css", "style.css"), "utf8");
ok(/svg#cv\{[^}]*touch-action:none/.test(css), "8: 캔버스는 원래 touch-action:none(이번에 화면 전체 터치 막기를 새로 넣지 않음)");

console.log("dartPointerCheck: " + PASS + " passed, " + FAIL + " failed");
fails.forEach(f => console.log("  FAIL " + f));
process.exit(FAIL ? 1 : 0);
