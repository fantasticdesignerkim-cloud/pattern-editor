// handleTouchBridgeCheck.js — 목선·진동·소매 손잡이 터치·펜 연결(2026-11-19) 소스 계약.
//   화면 동작(마우스 대비 좌표·핀치·Undo·저장)은 실제 브라우저 검사로 확인한다 — docs/STATUS.md. 보호 파일·공식은 안 건드린 것을 본다.
//   node test/harness/handleTouchBridgeCheck.js
"use strict";
const fs = require("fs"), path = require("path");
let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
const root = path.join(__dirname, "..", "..");
const src = fs.readFileSync(path.join(root, "js", "render.js"), "utf8");
const b = (src.match(/\/\/ ── 곡선 손잡이 터치·펜 연결[\s\S]*$/) || [""])[0];
ok(b.length > 500, "0: 연결 블록 존재");
ok(/e\.pointerType === "mouse" \|\| !e\.isPrimary \|\| drag \|\| !editOn\(\) \|\| dartOn\(\)\) return;/.test(b), "1: 마우스 제외(종전 경로) · 주 포인터 하나 · 편집 모드일 때만 · 다트 회전 중 제외");
ok(/cp\.touchCount\(\) > 1 \|\| cp\.pinching\(\)/.test(b) && /cp\.onMultiTouch\(\(\) => end\("multi"\)\)/.test(b), "2: 두 번째 손가락·핀치 = 조작 취소");
ok(/svg\.setPointerCapture\(e\.pointerId\)/.test(b) && /svg\.addEventListener\("lostpointercapture"/.test(b), "3: svg pointer capture");
ok(["pointerup", "pointercancel"].every(t => new RegExp('window\\.addEventListener\\("' + t + '"').test(b)) && /window\.addEventListener\("blur", \(\) => end\("blur"\)\)/.test(b), "4: 끝 = up · cancel · blur 정리");
ok(/fire\(h, "mousedown"/.test(b) && /fire\(window, "mousemove"/.test(b) && /fire\(window, "mouseup"/.test(b), "5: 기존 손잡이 핸들러가 받는 마우스 이벤트로 전달(공식 재사용)");
ok(/e\.preventDefault\(\); e\.stopPropagation\(\)/.test(b), "6: 호환 마우스 이벤트 중복(Undo·저장 2번) 차단");
ok(/clearTimeout\(state\.autoSaveTimer\)/.test(b) && /applyEditSnapshot\(d\.snap\)/.test(b) && /state\.undoStack = d\.undo\.slice\(\)/ && /state\.redoStack = d\.redo\.slice\(\)/.test(b), "7: 취소·탭 = 저장 예약 취소 · Undo 제거 · 시작 상태 복원");
ok(/savePending/.test(b) && !/pushUndoSnapshot/.test(b), "8: Undo 는 기존 훅이 담당 · 예약 저장 추적(직전 편집 저장 보존)");
ok(/\n  trackSave\(\);\s*[^\n]*\n\s*if \(!wrapped\) document\.addEventListener\("DOMContentLoaded", trackSave\);/.test(b), "9: 저장 추적은 로드 시(필요하면 DOMContentLoaded) 설치 — 첫 마우스 편집의 예약 저장도 추적");
console.log("handleTouchBridgeCheck: " + PASS + " passed, " + FAIL + " failed");
fails.forEach(f => console.log("  FAIL " + f));
process.exit(FAIL ? 1 : 0);
