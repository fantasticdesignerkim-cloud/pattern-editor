// ══════════════════════════════════════════════
// lineQuickBarCheck.js — 패턴선 «선 가까이» 빠른 도구막대(js/designLineQuickBar.js · UI 전용)의 순수 판정과 연결 계약.
//   실제 클릭·배치·팬/줌 동선은 격리 127.0.0.1 브라우저에서 확인한다(여기는 헤드리스로 확인 가능한 부분만).
//   §1 describe: 단계별 표시 — 그리기(점 ≥1 · 완료 가능 = canFinishDraw 그대로) / 선택(역할 강조 · 관리선 잠금 문구) / 그 외 없음
//   §2 place: 기준점 위 우선 · 위가 선을 가리면 아래로 반전 · 캔버스 경계 클램프 · 선·핸들 점을 가리지 않는 후보 · 결정적(같은 입력 = 같은 위치)
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
ok(Q && typeof Q.describe === "function" && typeof Q.place === "function" && typeof Q.sync === "function", "0: 모듈 공개 API(describe·place·sync)");

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
ok(Object.keys(locks).every(k => { const v = D({ design: true, mode: "select", sel: { id: "m", piece: "front", role: "boundary", lock: k } }); return v.locked === true && locks[k].test(v.title) && /역할 고정/.test(v.title); }), "1j: 관리선(네크라인·소매산·칼라 본체) = 역할 잠금 · 잠금 문구");

// §2 place
const P = Q.place, B = { l: 8, t: 8, r: 792, b: 592 }, S = { w: 180, h: 80 };
const a = P({ bounds: B, size: S, refs: [{ x: 400, y: 300 }], obstacles: [{ x: 400, y: 300 }] });
ok(a.index === 0 && a.y + S.h <= 300 - 10 && Math.abs(a.x + S.w / 2 - 400) < 1, "2a: 빈 곳이면 기준점 위 · 가운데 정렬");
const vert = []; for (let y = 120; y <= 300; y += 5) vert.push({ x: 400, y: y });   // 기준점 위로 뻗은 선
const b = P({ bounds: B, size: S, refs: [{ x: 400, y: 300 }], obstacles: vert });
ok(b.index === 1 && b.y >= 300 + 10 && b.hits === 0, "2b: 위가 선을 가리면 아래로 반전 · 가림 0");
const c = P({ bounds: B, size: S, refs: [{ x: 20, y: 20 }], obstacles: [{ x: 20, y: 20 }] });
ok(c.x >= B.l && c.y >= B.t && c.x + S.w <= B.r && c.y + S.h <= B.b && c.hits === 0, "2c: 화면 왼쪽 위 끝 = 경계 안 클램프 · 기준점 안 가림");
const d = P({ bounds: B, size: S, refs: [{ x: 780, y: 585 }], obstacles: [{ x: 780, y: 585 }] });
ok(d.x + S.w <= B.r && d.y + S.h <= B.b && d.hits === 0, "2d: 오른쪽 아래 끝 = 경계 안 · 기준점 안 가림");
const cross = []; for (let t = 0; t <= 100; t += 5) cross.push({ x: 400, y: 200 + t }); for (let t = 0; t <= 200; t += 5) cross.push({ x: 400 + t, y: 300 });   // 위로 뻗은 선 + 오른쪽 핸들선
const e = P({ bounds: B, size: S, refs: [{ x: 400, y: 300 }], obstacles: cross });
ok(e.hits === 0 && e.index === 1, "2e: 위(선)·오른쪽(핸들)이 막히면 가리지 않는 아래 후보");
const e2 = P({ bounds: B, size: S, refs: [{ x: 400, y: 300 }], obstacles: cross });
ok(e.x === e2.x && e.y === e2.y && e.index === e2.index, "2f: 결정적 — 같은 선·같은 뷰 = 같은 위치(커서 무관 · 흔들림 없음)");
const tiny = P({ bounds: { l: 8, t: 8, r: 150, b: 60 }, size: S, refs: [{ x: 70, y: 30 }], obstacles: [] });
ok(tiny.x === 8 && tiny.y === 8, "2g: 캔버스보다 큰 막대 = 왼쪽 위 고정(넘침 방향 일관)");
// 2h(2026-11-05 소매 파트 분리 · 좁은 화면 실측 390px): 선 주변 네 후보가 모두 분리 파트를 덮으면 파트 묶음 바깥 후보 — 가림 0
{
  const NB = { l: 8, t: 8, r: 382, b: 476 }, NS = { w: 186, h: 171 }, ring = [];
  for (let x = 186; x <= 255; x += 3) { ring.push({ x: x, y: 177 }); ring.push({ x: x, y: 288 }); }
  for (let y = 177; y <= 288; y += 3) { ring.push({ x: 186, y: y }); ring.push({ x: 255, y: y }); }
  for (let x = 186; x <= 255; x += 3) ring.push({ x: x, y: 226 });   // 절개선(파트 사이)
  const h = P({ bounds: NB, size: NS, refs: [{ x: 220, y: 226 }, { x: 186, y: 226 }, { x: 255, y: 226 }], obstacles: ring });
  ok(h.hits === 0 && h.around === true && h.y >= 288, "2h: 선 주변 후보가 모두 파트를 덮으면 파트 묶음 아래(가림 0) (" + h.x + "," + h.y + " hits " + h.hits + ")");
  ok(a.around === false && b.around === false && e.around === false, "2i: 선 주변에 빈자리가 있으면 종전 후보 그대로(묶음 바깥 후보는 동점에 밀림)");
}
// §2j dock(그리기 전용 고정 자리 · 2026-11-07 «다음 점 찍을 곳을 팝업이 가림»): 마지막 점·진행 방향 비움 · 작성 선 안 가림 · 붙박이 · 경계 안
{
  const K = Q.dock, DB = { l: 8, t: 8, r: 792, b: 592 }, DS = { w: 210, h: 84 };
  const inB = r => r.x >= DB.l && r.y >= DB.t && r.x + DS.w <= DB.r && r.y + DS.h <= DB.b;
  const dist = (r, p) => Math.hypot(Math.max(r.x - p.x, 0, p.x - (r.x + DS.w)), Math.max(r.y - p.y, 0, p.y - (r.y + DS.h)));
  const line = (p0, p1) => { const o = []; for (let i = 0; i <= 20; i++) o.push({ x: p0.x + (p1.x - p0.x) * i / 20, y: p0.y + (p1.y - p0.y) * i / 20 }); return o; };
  // dockClear(DB) = min(160, 584*0.28=163.5) = 160 → 아래 검사는 160 기준
  const dirs = [["오른쪽", { x: 300, y: 300 }, { x: 600, y: 300 }], ["왼쪽", { x: 500, y: 300 }, { x: 200, y: 300 }], ["아래", { x: 400, y: 150 }, { x: 400, y: 520 }], ["위", { x: 400, y: 450 }, { x: 400, y: 80 }],
    ["오른쪽 아래 모서리로", { x: 400, y: 300 }, { x: 760, y: 560 }], ["왼쪽 위 모서리로", { x: 400, y: 300 }, { x: 40, y: 40 }]];
  dirs.forEach(([nm, p0, p1]) => {
    const r = K({ bounds: DB, size: DS, last: p1, prev: p0, draft: line(p0, p1), pieces: [], keep: null });
    ok(r && inB(r) && r.hits === 0 && r.near === 0 && dist(r, p1) >= 160 - 0.5, "2j-" + nm + ": 경계 안 · 작성 선 안 가림 · 마지막 점 둘레 비움 (" + r.name + " " + Math.round(dist(r, p1)) + "px)");
  });
  // 붙박이: 지금 자리가 여전히 조건을 지키면 그대로(점이 늘어도 · 다른 자리가 조각을 덜 덮어도)
  const p0 = { x: 300, y: 300 }, p1 = { x: 420, y: 280 };
  const r1 = K({ bounds: DB, size: DS, last: p1, prev: p0, draft: line(p0, p1), pieces: [], keep: null });
  const r2 = K({ bounds: DB, size: DS, last: { x: 430, y: 330 }, prev: p1, draft: line(p0, p1).concat(line(p1, { x: 430, y: 330 })), pieces: [{ l: r1.x, t: r1.y, r: r1.x + DS.w, b: r1.y + DS.h }], keep: r1.index });
  ok(r2.index === r1.index && r2.x === r1.x && r2.y === r1.y, "2j-붙박이: 조건을 지키는 동안 자리 고정(깜빡임·도망 없음)");
  // 새 점이 고정 자리에 다가오면 그때만 옮긴다
  const corner = { x: r1.x + DS.w / 2, y: r1.y + DS.h / 2 };
  const r3 = K({ bounds: DB, size: DS, last: corner, prev: p1, draft: line(p0, p1).concat(line(p1, corner)), pieces: [], keep: r1.index });
  ok(r3.index !== r1.index && r3.hits === 0 && r3.near === 0, "2j-이동: 새 점이 고정 자리에 찍히면 다른 자리로(" + r1.name + "→" + r3.name + ")");
  // 조각 영역: 필수 조건이 같으면 덜 덮는 자리
  const pc = [{ l: 8, t: 300, r: 792, b: 592 }];   // 아래 절반 = 조각
  const r4 = K({ bounds: DB, size: DS, last: { x: 400, y: 300 }, prev: null, draft: [{ x: 400, y: 300 }], pieces: pc, keep: null });
  ok(r4.overlap === 0 && r4.near === 0 && r4.y < 300, "2j-조각: 조각을 덜 덮는 위쪽 자리(" + r4.name + ")");
  const r5 = K({ bounds: DB, size: DS, last: { x: 400, y: 300 }, prev: null, draft: [{ x: 400, y: 300 }], pieces: pc, keep: null });
  ok(r5.index === r4.index && r5.x === r4.x, "2j-결정적: 같은 입력 = 같은 자리(커서 무관)");
  // 좁은 화면(320 실측 캔버스 근사): 경계 안
  const NB = { l: 8, t: 8, r: 312, b: 440 }, NS = { w: 220, h: 84 };
  const r6 = K({ bounds: NB, size: NS, last: { x: 160, y: 380 }, prev: { x: 100, y: 300 }, draft: line({ x: 100, y: 300 }, { x: 160, y: 380 }), pieces: [], keep: null });
  ok(r6.x >= NB.l && r6.x + NS.w <= NB.r && r6.y >= NB.t && r6.y + NS.h <= NB.b && r6.hits === 0 && r6.y + NS.h < 300, "2j-좁은 화면: 경계 안 · 아래로 진행 중이면 위쪽 자리(" + r6.name + ")");
}
ok(/kind === "draw"\) \{[^\n]*고정 자리/.test(CODE) || /vm\.kind === "draw"\) \{/.test(CODE), "2k: sync 의 그리기 분기 = dock(커서 좌표 미사용)");
ok(!/clientX|clientY/.test(CODE.slice(CODE.indexOf("function dock("), CODE.indexOf("let dockIdx"))), "2l: dock 은 커서 좌표를 읽지 않음");

// §3 연결 계약(소스)
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const cvAt = html.indexOf('<svg id="cv"'), barAt = html.indexOf('id="lineQuickBar"'), mainEnd = html.indexOf("</main>", cvAt);
ok(cvAt > 0 && barAt > cvAt && barAt < mainEnd, "3a: 막대는 #cv 뒤 형제(canvas-wrap 안 · SVG 밖) → 막대 클릭이 캔버스 점 추가로 가지 않음");
ok(["lineQuickTitle", "lineQuickDismiss", "lineQuickCancel", "lineQuickFinish", "lineQuickRoleCut", "lineQuickRoleBoundary", "lineQuickRoleGuide"].every(id => html.indexOf('id="' + id + '"') > 0), "3b: 막대 요소 정적 마크업(재생성 없음)");
ok(/id="btnDesignLine"[^>]*onclick="designLineTool\.toggle\(\)"/.test(html) && /id="btnDesignFinish"[^>]*onclick="designLineTool\.finishDraw\(\)"/.test(html) && /id="btnRoleCut"[^>]*onclick="designLineTool\.setRole\('cut'\)"/.test(html) && /id="btnDesignSelect"[^>]*onclick="designLineTool\.toggleSelect\(\)"/.test(html), "3c: 기존 오른쪽 버튼 id·onclick 보존");
const calls = (CODE.match(/T\.(\w+)\(/g) || []).map(s => s.slice(2, -1)).filter((v, i, arr) => arr.indexOf(v) === i).sort();
const READ = ["getReflectState", "getSeamState", "canFinishDraw", "findLine", "getBoundaryState", "getDraft", "getMode", "getSelectedId", "getSplitState", "isCollarBodyLine", "isNeckAutoLine", "isSleeveCapLine", "getDrawHint"], CMD = ["cancel", "doReflectToBodice", "doBoundaryApply", "doBoundaryPreview", "doSleeveEditUndo", "doSplit", "finishDraw", "setRole"];   // 2026-11-06 소매 «외곽 반영»·«반영 되돌리기»(오른쪽 버튼과 같은 명령)
ok(calls.every(f => READ.concat(CMD).indexOf(f) >= 0) && CMD.every(f => calls.indexOf(f) >= 0), "3d: 도구 호출 = 읽기 + 기존 명령(finishDraw·cancel·setRole·doSplit·doBoundaryPreview·doBoundaryApply·doSleeveEditUndo)뿐 [" + calls.join(",") + "]");
ok(!/patternLines|\.role\s*=[^=]|localStorage|innerHTML|makePatternLine|setMode\(/.test(CODE), "3e: 선 생성·역할 대입·저장·innerHTML·모드 직접 전환 없음");
const R = fs.readFileSync(path.join(ROOT, "js/render.js"), "utf8");
const ret = R.indexOf("return; // 라이브 원형 draw"), syncAt = R.lastIndexOf("designLineQuickBar.sync()", ret), hitAt = R.lastIndexOf("_appendDesignHitLayer(hitRoot", ret);
ok(syncAt > hitAt && hitAt > 0, "3f: design render 는 선·overlay·hit 을 그린 뒤 막대 sync(그려진 SVG 기준)");
ok(/afterDraftRender\(\);\s*\n\s*if\(window\.designLineQuickBar\) window\.designLineQuickBar\.sync\(\);/.test(R), "3g: design 밖 render 도 sync(→ 숨김)");
const ver = f => { const m = new RegExp(f.replace(/\./g, "\\.") + "\\?v=(\\d+)").exec(html); return m ? m[1] : null; };
ok(ver("designLineQuickBar.js") === "2026110807" && ver("designLineTool.js") === "2026110901" && ver("render.js") === "2026110806" && /css\/style\.css\?v=2026110801/.test(html), "3h: 캐시 버전(막대·render 2026110602 · 도구 2026110603 — 새 소맷부리 문구 · css 2026110507 — 소형 상태줄)");
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
  const NB = { l: 8, t: 8, r: 312, b: 327 }, cs = { w: 160, h: 54 }, obs = []; for (let x = 120; x <= 220; x += 4) for (let y = 120; y <= 300; y += 30) obs.push({ x: x, y: y });
  const pc = P({ bounds: NB, size: cs, refs: [{ x: 170, y: 200 }], obstacles: obs, extra: [{ x: NB.l, y: NB.t }, { x: NB.r - cs.w, y: NB.t }, { x: NB.l, y: NB.b - cs.h }, { x: NB.r - cs.w, y: NB.b - cs.h }] });
  ok(pc.hits === 0 && pc.x >= NB.l && pc.y >= NB.t && pc.x + cs.w <= NB.r && pc.y + cs.h <= NB.b, "5g: 소형 상태줄 배치 = 가림 0 자리(모서리 후보 포함) · 캔버스 안 (" + pc.x + "," + pc.y + ")");
  ok(/data-lqb="compact"[^>]*hidden/.test(html) && /id="lineQuickExpand"[^>]*>도구</.test(html) && /class="lqb-btn" id="lineQuickExpand"/.test(html), "5h: 소형 상태줄 마크업 · 처음 숨김 · «도구» = lqb-btn(44px · 구기지 않음)");
  const css = fs.readFileSync(path.join(__dirname, "..", "..", "css", "style.css"), "utf8");
  ok(/@media \(pointer:coarse\)\{\.lqb-dismiss\{min-width:44px;min-height:44px\}\}/.test(css) && /\.lqb-btn\{min-height:44px;min-width:44px/.test(css), "5i: 손가락 환경 접기 «×» 44×44 · 막대 버튼 44");
  ok(/expandedKey = null; \}, true\)/.test(CODE) && /if \(expandedKey && expandedKey !== rk\) expandedKey = null;/.test(CODE), "5j: 펼침은 캔버스 누름·선택/결과 변화에 풀림(소형이 기본)");
}

console.log("══════════════════════════════════════════════");
fails.forEach(f => console.log("  ✗ " + f));
console.log("결과: " + PASS + " PASS / " + FAIL + " FAIL");
process.exitCode = FAIL ? 1 : 0;
