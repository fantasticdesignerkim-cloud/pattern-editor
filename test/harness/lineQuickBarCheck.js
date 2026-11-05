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

// §3 연결 계약(소스)
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const cvAt = html.indexOf('<svg id="cv"'), barAt = html.indexOf('id="lineQuickBar"'), mainEnd = html.indexOf("</main>", cvAt);
ok(cvAt > 0 && barAt > cvAt && barAt < mainEnd, "3a: 막대는 #cv 뒤 형제(canvas-wrap 안 · SVG 밖) → 막대 클릭이 캔버스 점 추가로 가지 않음");
ok(["lineQuickTitle", "lineQuickDismiss", "lineQuickCancel", "lineQuickFinish", "lineQuickRoleCut", "lineQuickRoleBoundary", "lineQuickRoleGuide"].every(id => html.indexOf('id="' + id + '"') > 0), "3b: 막대 요소 정적 마크업(재생성 없음)");
ok(/id="btnDesignLine"[^>]*onclick="designLineTool\.toggle\(\)"/.test(html) && /id="btnDesignFinish"[^>]*onclick="designLineTool\.finishDraw\(\)"/.test(html) && /id="btnRoleCut"[^>]*onclick="designLineTool\.setRole\('cut'\)"/.test(html) && /id="btnDesignSelect"[^>]*onclick="designLineTool\.toggleSelect\(\)"/.test(html), "3c: 기존 오른쪽 버튼 id·onclick 보존");
const calls = (CODE.match(/T\.(\w+)\(/g) || []).map(s => s.slice(2, -1)).filter((v, i, arr) => arr.indexOf(v) === i).sort();
const READ = ["canFinishDraw", "findLine", "getDraft", "getMode", "getSelectedId", "getSplitState", "isCollarBodyLine", "isNeckAutoLine", "isSleeveCapLine"], CMD = ["cancel", "doSplit", "finishDraw", "setRole"];
ok(calls.every(f => READ.concat(CMD).indexOf(f) >= 0) && CMD.every(f => calls.indexOf(f) >= 0), "3d: 도구 호출 = 읽기 + 기존 명령(finishDraw·cancel·setRole·doSplit)뿐 [" + calls.join(",") + "]");
ok(!/patternLines|\.role\s*=[^=]|localStorage|innerHTML|makePatternLine|setMode\(/.test(CODE), "3e: 선 생성·역할 대입·저장·innerHTML·모드 직접 전환 없음");
const R = fs.readFileSync(path.join(ROOT, "js/render.js"), "utf8");
const ret = R.indexOf("return; // 라이브 원형 draw"), syncAt = R.lastIndexOf("designLineQuickBar.sync()", ret), hitAt = R.lastIndexOf("_appendDesignHitLayer(hitRoot", ret);
ok(syncAt > hitAt && hitAt > 0, "3f: design render 는 선·overlay·hit 을 그린 뒤 막대 sync(그려진 SVG 기준)");
ok(/afterDraftRender\(\);\s*\n\s*if\(window\.designLineQuickBar\) window\.designLineQuickBar\.sync\(\);/.test(R), "3g: design 밖 render 도 sync(→ 숨김)");
const ver = f => { const m = new RegExp(f.replace(/\./g, "\\.") + "\\?v=(\\d+)").exec(html); return m ? m[1] : null; };
ok(ver("designLineQuickBar.js") === "2026110503" && ver("designLineTool.js") === "2026110504" && ver("render.js") === "2026110502" && /css\/style\.css\?v=2026110502/.test(html), "3h: 캐시 버전(막대 2026110503 · 도구 2026110504 · render 2026110502 · css 2026110502)");
ok(html.indexOf('<script src="js/designLineQuickBar.js') > html.indexOf('<script src="js/designLineTool.js'), "3i: 막대 스크립트는 designLineTool 뒤");

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

console.log("══════════════════════════════════════════════");
fails.forEach(f => console.log("  ✗ " + f));
console.log("결과: " + PASS + " PASS / " + FAIL + " FAIL");
process.exitCode = FAIL ? 1 : 0;
