// ══════════════════════════════════════════════
// lineQuickBarCheck.js — 패턴선 «선 가까이» 빠른 도구막대(js/designLineQuickBar.js · UI 전용)의 순수 판정과 연결 계약.
//   실제 클릭·배치·팬/줌 동선은 격리 127.0.0.1 브라우저에서 확인한다(여기는 헤드리스로 확인 가능한 부분만).
//   §1 describe: 단계별 표시 — 그리기(점 ≥1 · 완료 가능 = canFinishDraw 그대로) / 선택(역할 강조 · 관리선 잠금 문구) / 그 외 없음
//   §2 하단 고정: 자리 계산 함수 없음 · 가림 수만 순수 · JS 좌표 미기록 · 드래그 중 고정 (§9 CSS 계약) — 옛 «선 가까이» 배치 대체(2026-11-11) (같은 위치)
//   §3 연결 계약: 막대는 #cv 의 형제(캔버스 밖) · 기존 명령(finishDraw·cancel·setRole)만 호출 · 선 생성/역할 대입/저장 없음 ·
//       기존 오른쪽 버튼 id·onclick 보존 · render.js 가 그린 뒤 sync · 캐시 버전
//   §4 절개선 → «파트 분리» 다음 단계 행: 표시 = getSplitState 판정 그대로 · 불가 이유 보임 · 다른 역할·관리선·판정 없음 = 행 없음 · 별도 행 · 배선
//   node test/harness/lineQuickBarCheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");

let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
const ROOT = path.join(__dirname, "..", "..");
const SRC = fs.readFileSync(path.join(ROOT, "js/designLineQuickBar.js"), "utf8");
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map(l => l.replace(/(^|[^:"])\/\/.*$/, "$1")).join("\n");   // 주석 제외(계약은 코드만 본다)
const ctx = { window: {}, Math: Math, JSON: JSON };
vm.createContext(ctx);
vm.runInContext(SRC, ctx);
const Q = ctx.window.designLineQuickBar;
ok(Q && typeof Q.describe === "function" && typeof Q.coverCount === "function" && typeof Q.sync === "function", "0: 모듈 공개 API(describe·coverCount·sync)");

// §1 describe
const D = Q.describe;
const _rf = (r, lock) => D({ design: true, mode: "select", sel: { id: "x", piece: "front", role: "guide", lock: lock || null, reflect: r } });
ok(_rf({ allowed: true, reason: "ok" }).reflect && _rf({ allowed: true, reason: "ok" }).reflect.allowed === true, "1r: 일반 앞·뒤판 선 → 몸판 외곽으로 반영 행");
ok(_rf({ allowed: false, done: true, reason: "x" }).reflect === null && _rf(null).reflect === null && _rf({ allowed: true, reason: "ok" }, "neck").reflect === null, "1r: 반영됨·대상 아님·관리선 = 반영 행 없음");
ok(_rf({ allowed: false, reason: "다조각" }).reflect.allowed === false && /다조각/.test(_rf({ allowed: false, reason: "다조각" }).reflect.text), "1r: 지원 밖 = 비활성 + 이유");
ok(D(null) === null && D({ design: false, mode: "draw", draft: { piece: "front", n: 2 } }) === null, "1a: design 밖 = 막대 없음");
ok(D({ design: true, mode: "off" }) === null, "1b: 도구 꺼짐 = 막대 없음");
ok(D({ design: true, mode: "draw", draft: null }) === null && D({ design: true, mode: "draw", draft: { piece: "front", n: 0 } }) === null, "1c: 그리기 모드라도 점이 없으면 막대 없음");
const d1 = D({ design: true, mode: "draw", draft: { piece: "front", n: 1 }, canFinish: false });
ok(d1 && d1.kind === "draw" && d1.canFinish === false && /앞판/.test(d1.title) && /점 1개/.test(d1.title), "1d: 한 점 = 그리기 막대 · 완료 비활성 · 대상(앞판·점 수) 표시");
const d2 = D({ design: true, mode: "draw", draft: { piece: "back", n: 2 }, canFinish: true });
ok(d2 && d2.canFinish === true && /뒤판/.test(d2.title), "1e: 완료 가능은 canFinishDraw 값 그대로");
ok(D({ design: true, mode: "draw", draft: { piece: "front", n: 2 }, canFinish: false }).canFinish === false, "1f: 같은 자리 두 점(canFinishDraw=false) = 완료 비활성");
ok(D({ design: true, mode: "select", sel: null }) === null, "1g: 선택 모드 · 선택 없음 = 막대 없음");
const s1 = D({ design: true, mode: "select", sel: { id: "line-3", piece: "front", role: "cut", lock: null } });
ok(s1 && s1.kind === "select" && s1.role === "cut" && s1.locked === false && s1.key === "sel:line-3" && /선택한 선 · 앞판/.test(s1.title), "1h: 선택 = 역할 막대 · 현재 역할 · 대상 표시");
ok(D({ design: true, mode: "select", sel: { id: "x", piece: "sleeve" } }).role === "guide", "1i: 역할 없음 = guide(기본 그대로 · 자동 지정 없음)");
const locks = { neck: /네크라인/, cap: /소매산/, collar: /칼라/ };
ok(Object.keys(locks).every(k => { const v = D({ design: true, mode: "select", sel: { id: "m", piece: "front", role: "boundary", lock: k } }); return v.locked === true && locks[k].test(v.title) && (k === "collar" ? /모양 수정 가능/.test(v.title) : /역할 고정/.test(v.title)); }), "1j: 관리선(네크라인·소매산·칼라 본체) = 역할 잠금 · 잠금 문구");

// §2 하단 고정(2026-11-11 김님 «애플같이 아래에 고정») — 자리 계산 함수 없음 · 가림 수(coverCount)만 순수
{
  const C = Q.coverCount, R0 = { l: 100, t: 400, r: 400, b: 480 };
  ok(C(R0, [{ x: 200, y: 450 }, { x: 50, y: 50 }, { x: 411, y: 470 }, { x: 413, y: 470 }]) === 2, "2a: 고정 패널 사각형(+PAD 12) 안 점만 센다");
  ok(C(null, [{ x: 1, y: 1 }]) === 0 && C(R0, null) === 0, "2b: 사각형·점 없음 = 0");
  ok(["place", "keepPlace", "holdPlace", "dock"].every(k => !(k in Q)), "2c: 선 근처·붙박이·가장자리 dock 배치 함수 제거(반쪽 변경 아님)");
  ok(!/function (place|keepPlace|holdPlace|dock)\(|DOCKS|selKeep|dockIdx|lastPos/.test(CODE), "2d: 옛 배치 상태·후보 계산 잔재 없음");
  ok(!/\.style\.(left|top|right|bottom|transform)\s*=/.test(CODE), "2e: JS 는 패널 좌표를 쓰지 않는다(자리 = CSS)");
  ok(!/clientX|clientY/.test(CODE.slice(CODE.indexOf("function sync("), CODE.indexOf("function setCompact("))), "2f: sync 는 커서 좌표를 읽지 않음(커서 추종 없음)");
  ok(/if \(dragging && vm && !bar\.hidden\) \{ liveText\(vm\); return; \}/.test(CODE) && !/dragging = true; hide\(\)/.test(CODE), "2g: 드래그·팬 중 숨기지 않고 행 구성 그대로 · 글자만 현재값(손 떼면 한 번 갱신)");
}

{ // 2h(2026-11-11 Codex 후속): Space+드래그 팬(init.js)은 같은 svg pointerdown — 선 도구가 선택 해제·점 추가를 하지 않는다(하단 패널 가림 회복용 팬)
  const LT = fs.readFileSync(path.join(ROOT, "js", "designLineTool.js"), "utf8"), at = LT.indexOf('svg.addEventListener("pointerdown"');
  const head = LT.slice(at, LT.indexOf("const piece = pieceAt(e.target);", at));
  ok(at > 0 && /if \(typeof spaceDown !== "undefined" && spaceDown\) return;/.test(head), "2h: 선 도구 pointerdown 은 Space 팬 중 무시(선택·작성 중 선 유지)");
}

// §3 연결 계약(소스)
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const cvAt = html.indexOf('<svg id="cv"'), barAt = html.indexOf('id="lineQuickBar"'), mainEnd = html.indexOf("</main>", cvAt);
ok(cvAt > 0 && barAt > cvAt && barAt < mainEnd, "3a: 막대는 #cv 뒤 형제(canvas-wrap 안 · SVG 밖) → 막대 클릭이 캔버스 점 추가로 가지 않음");
ok(["lineQuickTitle", "lineQuickDismiss", "lineQuickCancel", "lineQuickFinish", "lineQuickRoleCut", "lineQuickRoleBoundary", "lineQuickRoleGuide"].every(id => html.indexOf('id="' + id + '"') > 0), "3b: 막대 요소 정적 마크업(재생성 없음)");
ok(/id="btnDesignLine"[^>]*onclick="designLineTool\.toggle\(\)"/.test(html) && /id="btnDesignFinish"[^>]*onclick="designLineTool\.finishDraw\(\)"/.test(html) && /id="btnRoleCut"[^>]*onclick="designLineTool\.setRole\('cut'\)"/.test(html) && /id="btnDesignSelect"[^>]*onclick="designLineTool\.toggleSelect\(\)"/.test(html), "3c: 기존 오른쪽 버튼 id·onclick 보존");
const calls = (CODE.match(/T\.(\w+)\(/g) || []).map(s => s.slice(2, -1)).filter((v, i, arr) => arr.indexOf(v) === i).sort();
const READ = ["getReflectState", "getSeamState", "canFinishDraw", "findLine", "getBoundaryState", "getDraft", "getMode", "getSelectedId", "getSplitState", "isCollarBodyLine", "isNeckAutoLine", "isSleeveCapLine", "getDrawHint", "getSeamLive", "isEditDragging", "getCurveState"], CMD = ["cancel", "doReflectToBodice", "doBoundaryApply", "doBoundaryPreview", "doSleeveEditUndo", "doSplit", "finishDraw", "setRole", "doToCurve"];   // 2026-11-06 소매 «외곽 반영»·«반영 되돌리기»(오른쪽 버튼과 같은 명령)
ok(calls.every(f => READ.concat(CMD).indexOf(f) >= 0) && CMD.every(f => calls.indexOf(f) >= 0), "3d: 도구 호출 = 읽기 + 기존 명령(finishDraw·cancel·setRole·doSplit·doBoundaryPreview·doBoundaryApply·doSleeveEditUndo)뿐 [" + calls.join(",") + "]");
ok(!/patternLines|\.role\s*=[^=]|localStorage|innerHTML|makePatternLine|setMode\(/.test(CODE), "3e: 선 생성·역할 대입·저장·innerHTML·모드 직접 전환 없음");
const R = fs.readFileSync(path.join(ROOT, "js/render.js"), "utf8");
const ret = R.indexOf("return; // 라이브 원형 draw"), syncAt = R.lastIndexOf("designLineQuickBar.sync()", ret), hitAt = R.lastIndexOf("_appendDesignHitLayer(hitRoot", ret);
ok(syncAt > hitAt && hitAt > 0, "3f: design render 는 선·overlay·hit 을 그린 뒤 막대 sync(그려진 SVG 기준)");
ok(/afterDraftRender\(\);\s*\n\s*if\(window\.designLineQuickBar\) window\.designLineQuickBar\.sync\(\);/.test(R), "3g: design 밖 render 도 sync(→ 숨김)");
const ver = f => { const m = new RegExp(f.replace(/\./g, "\\.") + "\\?v=(\\d+)").exec(html); return m ? m[1] : null; };
ok(ver("designLineQuickBar.js") === "2026111203" && ver("designLineTool.js") === "2026111202" && ver("render.js") === "2026111202" && /css\/style\.css\?v=2026111203/.test(html), "3h: 캐시 버전(막대·render 2026110602 · 도구 2026110603 — 새 소맷부리 문구 · css 2026110507 — 소형 상태줄)");
ok(html.indexOf('<script src="js/designLineQuickBar.js') > html.indexOf('<script src="js/designLineTool.js'), "3i: 막대 스크립트는 designLineTool 뒤");
// 2026-11-08 김님 방향 전환: 자동 길이 보정 UI(길이 맞춤·후보·맞춤 반영·옆선 자석·여유/셔링·기준판) 사용자 노출 없음 — 마크업·막대 호출·설정 패널 모두
ok(!/lineQuickSeamFit|lineQuickSeamToggle|lineQuickEase|selSeamIntent|inpSeamEase|btnApplySeamIntent|selSeamBasis|chkSeamMagnet|길이 맞춤|맞춤 반영|옆선 자석|셔링/.test(html.replace(/<!--[\s\S]*?-->/g, "")), "3j: 자동 길이 보정 UI 마크업 없음(주석 제외)");
ok(!/setSeamMagnet|setSeamBasis|SeamFit|openEase|actEase|길이 맞춤|여유 적용/.test(CODE), "3k: 막대 코드에 자석·길이 맞춤·여유 호출/문구 없음");
ok(["lineQuickSeamText", "lineQuickBodiceFails", "lineQuickCompleteBodice"].every(id => html.indexOf('id="' + id + '"') > 0), "3l: 옆선 행 = 권위 숫자·완료 차단 사유·완료 버튼은 유지");

// §4 절개선 → «파트 분리» 다음 단계 행(2026-11-05 김님 요청) — 표시 모델은 getSplitState(오른쪽 버튼 판정) 그대로
const sel = (role, split, lock) => D({ design: true, mode: "select", sel: { id: "line-7", piece: "front", role: role, lock: lock || null, split: split } });
const OK0 = { lineId: "line-7", allowed: true, kind: "ok", reason: "분리 가능", parts: 0 };
ok(sel("cut", OK0).split.allowed === true && sel("cut", OK0).split.text === "분리 가능", "4a: 유효 절개선 = 분리 활성 «분리 가능»");
ok(/^분리됨 · 파트 2개/.test(sel("cut", Object.assign({}, OK0, { parts: 2 })).split.text), "4b: 분리 뒤 «분리됨 · 파트 2개»");
const NO = { lineId: "line-7", allowed: false, kind: "derived", reason: "소매 Ⓥ 파생 몸판은 파트 분리 미지원(원래 몸판 전용)", parts: 0 };
ok(sel("cut", NO).split.allowed === false && sel("cut", NO).split.text === "분리 불가 · " + NO.reason, "4c: 불가 = 비활성 + 보이는 이유(판정 문구 그대로)");
ok(sel("guide", OK0).split === null && sel("boundary", OK0).split === null, "4d: 절개선이 아니면 분리 행 없음");
ok(sel("cut", OK0, "neck").split === null, "4e: 관리선이면 분리 행 없음(역할 잠금과 함께)");
ok(sel("cut", null).split === null, "4f: 판정이 없으면(다른 선 것 · 미계산) 추측하지 않고 행 없음");
const iRole = html.indexOf('data-lqb="role"'), iSplit = html.indexOf('data-lqb="split"'), roleEnd = html.indexOf("</div>", iRole);
ok(iSplit > roleEnd && /data-lqb="split"[^>]*hidden/.test(html) && /id="lineQuickSplit"[^>]*disabled/.test(html) && /id="lineQuickSplitReason"/.test(html), "4g: 분리는 역할 행 밖 별도 행(다음 단계) · 처음 숨김·비활성 · 이유 글 요소");
ok(/id="btnDesignSplit"[^>]*onclick="designLineTool\.doSplit\(\)"/.test(html), "4h: 오른쪽 «파트 분리» 배선 보존");
ok(/splitBtn\.addEventListener\("click", \(\) => \{ actSplit\(\); \}\)/.test(CODE) && /!vm\.split\.allowed\) return false;\s*T\.doSplit\(\);/.test(CODE), "4i: 막대 버튼 = actSplit = 허용일 때만 doSplit");

// §5 소형 상태줄(2026-11-05 Codex 후속 — 320×640 에서 막대가 분리 파트를 덮음): 분리 성공 + 빈자리 없음일 때만 · «도구»로 복귀
{
  const CM = Q.chooseMode, RK = Q.resultKey;
  const done = sel("cut", Object.assign({}, OK0, { parts: 2 })), ready = sel("cut", OK0), no = sel("cut", NO);
  ok(typeof CM === "function" && typeof RK === "function", "5a: chooseMode·resultKey 공개(순수)");
  ok(CM(done, 5, null) === "compact" && CM(done, 0, null) === "full", "5b: 분리 성공 + 빈자리 없음(가림>0) = 소형 · 빈자리 있으면(넓은 화면) 전체 그대로");
  ok(CM(ready, 9, null) === "full" && CM(no, 9, null) === "full", "5c: 미분리·불가·보류는 가려도 전체(이유·분리 버튼이 보여야 함)");
  ok(CM(D({ design: true, mode: "draw", draft: { piece: "sleeve", n: 2 }, canFinish: true }), 9, null) === "full" && CM(sel("cut", Object.assign({}, OK0, { parts: 2 }), "cap"), 9, null) === "full",
    "5d: 그리기 중·관리선은 소형 없음(그리기 완료/취소·잠금 표시 보존)");
  ok(RK(done) === "sel:line-7:parts2" && CM(done, 5, RK(done)) === "full", "5e: «도구»로 펼친 결과 키 = 전체 막대");
  ok(CM(done, 5, "sel:line-8:parts2") === "compact", "5f: 다른 선·다른 결과의 펼침 키는 무시(다시 소형)");
  ok(/coverCount\(\{ l: r\.left - wr\.left[^\n]*tg\.obstacles\(\)\)/.test(CODE) && /modeMemo\.key !== vm\.key \|\| modeMemo\.sig !== sig/.test(CODE), "5g: 소형 판정 = 고정 패널 자리에서 분리 결과를 덮는지 · 같은 선·결과 동안 한 번만");
  ok(/data-lqb="compact"[^>]*hidden/.test(html) && /id="lineQuickExpand"[^>]*>도구</.test(html) && /class="lqb-btn" id="lineQuickExpand"/.test(html), "5h: 소형 상태줄 마크업 · 처음 숨김 · «도구» = lqb-btn(44px · 구기지 않음)");
  const css = fs.readFileSync(path.join(__dirname, "..", "..", "css", "style.css"), "utf8");
  ok(/@media \(pointer:coarse\)\{\.lqb-dismiss\{min-width:44px;min-height:44px\}\}/.test(css) && /\.lqb-btn\{min-height:44px;min-width:44px/.test(css), "5i: 손가락 환경 접기 «×» 44×44 · 막대 버튼 44");
  ok(/expandedKey = null; \}, true\)/.test(CODE) && /if \(expandedKey && expandedKey !== rk\) expandedKey = null;/.test(CODE), "5j: 펼침은 캔버스 누름·선택/결과 변화에 풀림(소형이 기본)");
}


// §9 하단 고정 CSS 계약(2026-11-11) — 데스크톱 = 캔버스 하단 가운데 폭 제한 카드 · 좁은 화면 = 하단 시트 + safe-area · «더보기» 위로 + 내부 스크롤
{
  const css = fs.readFileSync(path.join(ROOT, "css", "style.css"), "utf8");
  const base = (css.match(/\.line-quickbar\{--lqb-bg[\s\S]*?\}/) || [""])[0];
  ok(/position:absolute;left:50%;top:auto;bottom:calc\(12px \+ env\(safe-area-inset-bottom,0px\)\);transform:translateX\(-50%\)/.test(base), "9a: 기본 = canvas-wrap 하단 가운데(사이드바 제외 캔버스 기준)");
  ok(/width:min\(420px,calc\(100% - 24px\)\);max-height:min\(calc\(100% - 24px\),max\(168px,55%\)\);overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain/.test(base), "9b: 폭 제한 카드 · 기본 높이 상한(캔버스 55% · 최소 168) + 내부 스크롤");
  ok(/\.line-quickbar\[data-more="open"\]\{max-height:min\(max\(200px,62%\),calc\(100% - 24px\)\)\}/.test(css), "9c: «더보기» = 같은 아래 기준점에서 위로 · 캔버스 위쪽은 남김");
  ok(/\.lqb-head\{position:sticky;top:0;/.test(css), "9d: 패널 안 스크롤 중에도 머리줄(더보기·닫기) 고정");
  ok(/@media \(max-width:615px\)\{\s*\.line-quickbar\{left:0;right:0;bottom:0;transform:none;width:auto;[\s\S]{0,200}padding:0 12px calc\(8px \+ env\(safe-area-inset-bottom,0px\)\)/.test(css), "9e: 좁은 화면 = 하단 시트(좌우 꽉 · safe-area 여백)");
  ok(!/\.line-quickbar[^{]*\{[^}]*transition:[^}]*(left|top|transform)/.test(css), "9f: 위치 애니메이션 없음");
}

// §10 접힌 패널 높이 맞춤·드래그 중 글자·빈 사유(2026-11-11 김님 리뷰 보완)
{
  const css = fs.readFileSync(path.join(ROOT, "css", "style.css"), "utf8");
  ok(/const FIT_RATIO = 0\.25;/.test(CODE) && /bar\.scrollHeight <= budget/.test(CODE), "10a: 접힌 패널 예산 = 캔버스 높이 25%(실제 내용 높이로 판정)");
  ok(/data-fit", "lean"/.test(CODE) && /data-fit", "dense"/.test(CODE) && /moreBtn\.setAttribute\("data-extra", "1"\); moreBtn\.hidden = false;/.test(CODE), "10b: full → lean(역할·상세를 «더보기»로 · 더보기 보장) → dense 단계");
  ok(/data-mode"\) === "compact" \|\| bar\.getAttribute\("data-more"\) === "open"\) return;/.test(CODE), "10c: «더보기» 펼침·소형 상태줄은 맞춤 대상 아님(펼침 = 종전 위로 열림 + 내부 스크롤)");
  ok(/" · 역할 " \+ \(ROLE_LABEL\[vm\.role\]/.test(CODE) && /main = primary \|\| \(seamRow && !seamRow\.hidden \? seamRow : roleRow\)/.test(CODE), "10d: 역할을 접어도 머리줄에 현재 역할 · 다음 단계가 없으면 역할 선택이 주 작업");
  ok(/\.line-quickbar\[data-fit="dense"\]:not\(\[data-more="open"\]\)\{display:grid/.test(css) && !/data-fit[^{]*\{[^}]*max-height/.test(css) && /data-fit="dense"\][^{]*\.lqb-btn\{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis\}/.test(css), "10e: dense = 그리드 한 줄(버튼 44px 유지 · 글자만 말줄임) · max-height 로 버튼을 감추지 않음");
  ok(/data-fit", "row"\);\s*if \(fits\(\) && titleEl\.clientWidth >= 96 && bar\.scrollWidth <= bar\.clientWidth \+ 1\) return;\s*bar\.setAttribute\("data-fit", "dense"\);/.test(CODE) && /\.line-quickbar\[data-fit="row"\]:not\(\[data-more="open"\]\)\{display:grid;grid-template-columns:minmax\(0,1fr\) auto auto/.test(css), "10e2: 낮은 가로 화면 = 한 줄(row) · 안내 칸 96px 미만·가로 넘침이면 dense 유지");
  ok(/function liveText\(vm\)/.test(CODE) && !/liveText[\s\S]{0,1600}\.hidden = /.test(CODE.slice(CODE.indexOf("function liveText"), CODE.indexOf("function applyFit"))), "10f: 드래그 중 = 글자만 갱신(행 숨김·형태 불변 → 포커스·자리 유지)");
  ok(/if \(!editing\) return;/.test(CODE) && /el\.textContent = EDIT_NOTE; row\.setAttribute\("data-state", "editing"\)/.test(CODE) && /failsEl\.textContent = EDIT_NOTE;/.test(CODE), "10g: 편집 드래그 중 놓아야 확정되는 판정 = «편집 중» 표시(팬·핀치 중엔 글자 그대로)");
  ok(/fl\.length \? "몸판 완료 막힘 " \+ fl\.length \+ "건" : "몸판 완료 막힘 · 검사가 사유를 돌려주지 않음/.test(CODE) && /completeBtn\.hidden = !\(ok && pend\)/.test(CODE), "10h: 사유 없는 막힘 = «0건»·빈 목록 대신 검사 결과 문구 · 완료 버튼은 그대로 숨김(게이트 완화 없음)");
}

console.log("══════════════════════════════════════════════");
fails.forEach(f => console.log("  ✗ " + f));
console.log("결과: " + PASS + " PASS / " + FAIL + " FAIL");
process.exitCode = FAIL ? 1 : 0;
