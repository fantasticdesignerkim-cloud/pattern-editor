// ══════════════════════════════════════════════
// appleUiCheck.js — 라이트 테마 UI 레이어(css/apple.css · js/appleChrome.js · js/inspectorInsights.js) 통합 불변식.
//   2026-11-13: 핸드오프(apple-light-ui, 기준 49ae2e5)를 현재 HEAD 에 **수동 통합**했다. 이 검사는 «표시 레이어가 기존 기능을 덮지 않는다»를
//   원문(정규식) 수준에서 잠근다. 화면 실측(겹침·터치·색 계산값)은 docs/STATUS.md 의 실측 기록이 맡는다.
//   node test/harness/appleUiCheck.js
// ══════════════════════════════════════════════
const fs = require("fs");
const path = require("path");
const vm = require("vm");
let PASS = 0, FAIL = 0; const fails = [];
function ok(cond, name) { if (cond) PASS++; else { FAIL++; fails.push(name); } }
const root = path.join(__dirname, "..", "..");
const read = f => fs.readFileSync(path.join(root, f), "utf8");
const html = read("index.html"), css = read("css/apple.css"), chrome = read("js/appleChrome.js"), ins = read("js/inspectorInsights.js");
const ui = read("js/ui.js");

// 1. 로드 순서: style.css → apple.css(덮어쓰기 전용) · ui.js → appleChrome.js → inspectorInsights.js
{
  const iStyle = html.indexOf('href="css/style.css?v='), iApple = html.indexOf('href="css/apple.css?v=');
  ok(iStyle > 0 && iApple > iStyle, "1: apple.css 는 style.css 뒤에 로드");
  const iUi = html.indexOf('src="js/ui.js?v='), iChrome = html.indexOf('src="js/appleChrome.js?v='), iIns = html.indexOf('src="js/inspectorInsights.js?v=');
  ok(iUi > 0 && iChrome > iUi && iIns > iChrome, "1: UI 스크립트 2개는 ui.js 뒤");
  ok(html.indexOf('src="js/canvasPan.js?v=') > 0 && html.indexOf('src="js/canvasPan.js?v=') < iUi, "1: canvasPan.js 유지(화면 이동)");
}

// 2. 현재 기능 보존: 버전 표시 · 카라 초기화 버튼 없음 · «곡선으로» · 빠른 도구 막대 원형 그대로
{
  ok(/id="appVersion"[^>]*aria-label="앱 버전 \d{4}\.\d{2}\.\d{2}\.\d+">v\d{4}\.\d{2}\.\d{2}\.\d+</.test(html), "2: 앱 버전 표시(#appVersion)");
  ok(!/btnCollarBaseM/.test(html) && !/btnCollarBaseM/.test(ui), "2: 카라 «기본형으로 초기화» 버튼 없음");
  ok(/id="lineQuickToCurve"/.test(html) && /id="lineQuickMore"/.test(html) && /id="lineQuickBar"/.test(html), "2: 빠른 도구 «곡선으로»·«더보기» 유지");
  ok(!/id="lineQuickCollapse"/.test(html) && !/lqb-grabber/.test(css) && !/data-collapsed/.test(css) && !/\.line-quickbar\{[^}]*max-height/.test(css),
    "2: 빠른 도구 접기 그래버·높이 덮어쓰기는 통합하지 않음(현재 압축 배치와 충돌)");
  ["zoomOut", "zoomPct", "zoomIn", "zoomFit", "inspectorGrabber", "axEaseChip", "axInsightsDraft", "axSleeveCompare", "axTheme"].forEach(id =>
    ok(new RegExp('id="' + id + '"').test(html), "2: UI 요소 #" + id));
  ok((html.match(/id="axTheme"/g) || []).length === 1 && (html.match(/class="zoom-pill"/g) || []).length === 1, "2: 중복 id 없음(화면 모드·확대 알약 1개씩)");
}

// 3. 우선순위 명시: 완료색 · 선 편집 점 · 이세 카드(숨김이지 삭제 아님)
{
  ok(/#cv \.stage-done\{stroke:#0E9F6E!important;stroke-width:2\.8\}/.test(css), "3: 완료 녹색이 도면 색 덮어쓰기보다 우선");
  ok(/#cv \.design-outline-composed\.stage-undone\{stroke:#1D4ED8!important\}/.test(css), "3: 미완료 합성 외곽 남색 유지");
  ok(/#cv \.design-line-anchor\{fill:#fff;stroke:#16BCE4;stroke-width:1\.6\}/.test(css)
    && /#cv \.design-line-anchor-locked\{fill:#E5E7EB;stroke:#4B5563;stroke-width:1\.4\}/.test(css)
    && /#cv \.design-line-handledot\{fill:#16BCE4;stroke:#fff;stroke-width:\.8\}/.test(css), "3: 이동 점(흰 원)·고정 점(회색 네모)·휨 핸들 색 고정");
  // 위 규칙들은 도면 색 블록보다 뒤에 있어야 한다(같은 특이도면 뒤가 이긴다)
  ok(css.indexOf("#cv .stage-done{") > css.indexOf("#cv .pattern,#cv .sleeve-cap"), "3: 우선순위 규칙이 도면 색 블록 뒤");
  ok(/#cv \.ease-card\{display:none\}/.test(css) && /querySelector\("#cv \.ease-card"\)/.test(ins), "3: 이세 카드는 숨김만(DOM 은 inspectorInsights 가 읽는다)");
  ok(!/style\.css/.test(chrome) && !/draft\.js|sleeve\.js/.test(css), "3: 표시 레이어만(엔진 파일 참조 없음)");
}

// 4. 도면 색 정리: 한 선택자에 규칙 하나(서로 덮던 중복 제거)
{
  const count = sel => (css.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\{", "g")) || []).length;
  ok(count("#cv .dart-waist") === 1 && count("#cv .dart-guide") === 1 && count("#cv .dim,#cv .sleeve-sch-reco") === 1 && count('#cv text[fill="#e07800"]') === 1,
    "4: 도면 색 규칙 중복 없음(dart-waist · dart-guide · dim · 치수 숫자)");
  ok(/\.pattern\[style\*="#cc2222"\]\{stroke:var\(--ax-outline-front\)!important\}/.test(css) && /\.pattern\[style\*="#0066cc"\]\{stroke:var\(--ax-outline-back\)!important\}/.test(css),
    "4: 앞/뒤 외곽색은 CSS 로만(DEBUG_COLORS 플래그 무변경)");
}

// 5. 저장소: UI 키 2개만 · 화면을 여는 것만으로는 쓰지 않는다 · 곡선 저장 키를 건드리지 않는다
{
  const keys = new Set((chrome + ins + html).match(/dorobo\.ui\.[A-Za-z]+/g) || []);
  ok(keys.size === 2 && keys.has("dorobo.ui.theme") && keys.has("dorobo.ui.inspectorSheet"), "5: UI 저장 키 = theme · inspectorSheet 2개");
  ok(!/armhole_data/.test(chrome) && !/armhole_data/.test(ins) && !/localStorage/.test(ins), "5: 곡선 저장 키 미접근 · insights 는 저장소 미사용");
  ok(/function apply\(s, persist\)/.test(chrome) && /if \(persist\) save\(s\);/.test(chrome) && /\n  apply\(state\);\n/.test(chrome), "5: 시트 상태는 사용자 조작 때만 저장(초기 적용은 저장 안 함)");
  ok((chrome.match(/localStorage\.setItem/g) || []).length === 2, "5: setItem 2곳(시트 · 화면 모드)뿐");
}

// 6. 안내·배치: 이동 안내 = 현재 팬 방식 · 폰 버전 표시 · 디자인 단계 화면 모드
{
  ok(/class="zp-hint-draft"><kbd>Space<\/kbd>\+ 드래그 · 두 손가락으로 이동</.test(html) && /class="zp-hint-design">빈 곳 드래그 · 두 손가락으로 이동</.test(html), "6: 확대 알약 이동 안내(원형/디자인/터치)");
  ok(/@media \(max-width:615px\)\{[^@]*\.brand-ver\{display:block/.test(css) && !/\.brand-ver\{display:none/.test(css), "6: 폰 머리줄에서 버전 숨기지 않음");
  ok(/@media \(max-width:360px\)\{[^@]*\.stage-bar\{order:3;flex:1 0 100%\}/.test(css), "6: 360px 이하 = 단계 줄을 둘째 줄로");
  ok(/\[data-workspace-stage="design"\] \[data-menu="view"\]\{display:block\}/.test(css), "6: 디자인 단계에서도 화면 모드 접근(보기 메뉴)");
  ok(/\.canvas-wrap:has\(#lineQuickBar:not\(\[hidden\]\)\) \.zoom-pill\{top:10px;bottom:auto;left:auto;right:14px;transform:none\}/.test(css), "6: 빠른 도구가 뜨면 확대 알약은 오른쪽 위로");
}

// 7. 이세 배지 = 참고 표시(출처 명시) · 완료 게이트가 아니다
{
  ok(/참고/.test(ins) && /designSleeveA\.js/.test(ins) && /원형 규칙 아님/.test(ins), "7: 판정 기준의 출처·참고 표기");
  ok(!/btnCompleteDraft|btnCompleteSleeve|\.disabled\s*=/.test(ins) && !/checkpoint/i.test(ins), "7: 완료 버튼·체크포인트를 건드리지 않음(게이트 아님)");
}

// 8. 문법
["js/appleChrome.js", "js/inspectorInsights.js"].forEach(f => { let good = true; try { new vm.Script(read(f), { filename: f }); } catch (e) { good = false; } ok(good, "8: " + f + " 문법"); });

console.log("══════════════════════════════════════════════");
if (FAIL) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); }
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
if (FAIL) process.exitCode = 1;
