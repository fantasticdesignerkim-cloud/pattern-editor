// ══════════════════════════════════════════════
// canvasPanCheck — 화면 이동(팬)·두 손가락 핀치 (2026-11-11 김님 리뷰 보완 · 하단 패널 실사용 회귀)
//   §1 빈 누름: 임계값(마우스 4px · 터치 8px) 미만 = 클릭(onTap 1회 · 뷰 불변) · 이상 = 팬(뷰만 이동 · onTap 없음)
//   §2 Space = 즉시 팬 · 래퍼: 전파가 막히지 않은 캔버스 누름만(디자인 stage = 빈 곳 팬 후보 · 원형 stage = Space 만)
//   §3 두 손가락: 두 번째 손가락 = 한 손가락 팬/클릭 후보 취소 · 도구 되돌리기 훅 호출 · 도구로 전파 차단 ·
//      벌림 = 확대(중점 기준) · 중점 이동 = 팬 · 손 떼기는 클릭 아님 · 뷰 변환만(형상 미접촉)
//   §4 init.js Space: 입력칸·키보드 포커스 컨트롤은 가로채지 않음 · blur/visibilitychange 해제(복귀 후 먹통 방지)
//   node test/harness/canvasPanCheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..", "..");
let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

function mkTarget() {
  const H = { cap: {}, bub: {} };
  return { H, addEventListener(t, f, o) { const k = (o === true || (o && o.capture)) ? "cap" : "bub"; (H[k][t] = H[k][t] || []).push(f); } };
}
function load(design) {
  const wrap = mkTarget(), svgEl = mkTarget();
  svgEl.parentElement = wrap; svgEl.style = {}; svgEl.captured = [];
  svgEl.setPointerCapture = id => svgEl.captured.push(id);
  svgEl.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });
  svgEl.contains = t => t === svgEl || (t && t.inSvg);
  const st = { renders: 0, design: design };
  const sb = { window: {}, Math, Map, Array, Object, view: { x: 0, y: 0, z: 1, MX: 80, MY: 100, SC: 11 }, svg: svgEl,
    render: () => { st.renders++; }, syncViewVars: () => {}, spaceDown: false };
  sb.window.isDesignStageActive = () => st.design;
  vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "js", "canvasPan.js"), "utf8"), sb, { filename: "canvasPan.js" });
  const CP = sb.window.canvasPan;
  // 이벤트 디스패치: svg 캡처 → svg 버블(도구 대역) → 래퍼 버블(전파가 막히지 않았을 때)
  function fire(type, e, toolBubble) {
    e.type = type; e.stopped = false; e.immediate = false;
    e.stopPropagation = () => { e.stopped = true; }; e.stopImmediatePropagation = () => { e.immediate = true; e.stopped = true; };
    e.target = e.target || Object.assign({ inSvg: true }, {});
    for (const f of (svgEl.H.cap[type] || [])) { f(e); if (e.immediate) return e; }
    for (const f of (svgEl.H.bub[type] || [])) { f(e); if (e.immediate) return e; }
    if (toolBubble) toolBubble(e);
    if (!e.stopped) for (const f of (wrap.H.bub[type] || [])) f(e);
    return e;
  }
  return { CP, sb, st, fire, svgEl };
}
const M = (id, x, y, extra) => Object.assign({ pointerId: id, pointerType: "mouse", button: 0, clientX: x, clientY: y }, extra || {});
const T = (id, x, y) => ({ pointerId: id, pointerType: "touch", button: 0, clientX: x, clientY: y });

// §1 임계값 · 클릭/팬 구분
{
  const { CP, sb, st, fire } = load(true);
  let taps = 0;
  const e0 = M(1, 100, 100); fire("pointerdown", e0); CP.press(e0, () => taps++);
  fire("pointermove", M(1, 103, 101));
  ok(sb.view.x === 0 && sb.view.y === 0 && st.renders === 0 && !CP.panning(), "1a: 마우스 3.2px 이동 = 아직 클릭(뷰 불변)");
  fire("pointerup", M(1, 103, 101));
  ok(taps === 1 && !CP.pending(), "1b: 임계값 미만에서 놓음 = 클릭 1회(onTap — 선택 해제 등 종전 클릭 동작)");
  const e1 = M(2, 100, 100); CP.press(e1, () => taps++);
  fire("pointermove", M(2, 140, 70));
  ok(CP.panning() && sb.view.x === 40 && sb.view.y === -30 && st.renders > 0, "1c: 임계값 이상 = 팬(뷰 x·y 만 이동량 그대로)");
  fire("pointerup", M(2, 140, 70));
  ok(taps === 1 && !CP.pending(), "1d: 팬으로 끝나면 클릭 아님(onTap 없음 → 선택 보존)");
  const e2 = T(3, 0, 0); CP.press(e2, () => taps++); fire("pointermove", T(3, 6, 0));
  ok(!CP.panning() && sb.view.x === 40, "1e: 터치 임계값 8px(손가락 떨림 6px = 클릭)");
  fire("pointermove", T(3, 12, 0));
  ok(CP.panning() && sb.view.x === 52, "1f: 터치 12px = 팬");
  fire("pointercancel", T(3, 12, 0));
  ok(taps === 1 && !CP.pending(), "1g: pointercancel = 클릭으로 치지 않음");
}
// §2 Space 즉시 팬 · 래퍼 후보
{
  const { CP, sb, fire } = load(false);
  const e = M(1, 10, 10); CP.press(e, null, { immediate: true }); fire("pointermove", M(1, 11, 10));
  ok(CP.panning() && sb.view.x === 1, "2a: Space 팬 = 임계값 없이 바로");
  fire("pointerup", M(1, 11, 10));
  fire("pointerdown", M(2, 0, 0));
  ok(!CP.pending(), "2b: 원형 stage 빈 누름(Space 없음) = 팬 후보 아님(원형 핸들 조작 종전 그대로)");
  sb.spaceDown = true; fire("pointerdown", M(3, 0, 0));
  ok(CP.panning(), "2c: 원형 stage 도 Space+누름 = 즉시 팬(종전 명시적 팬 수단)");
  fire("pointerup", M(3, 0, 0)); sb.spaceDown = false;
  const D = load(true);
  D.fire("pointerdown", M(1, 0, 0), e2 => e2.stopPropagation());
  ok(!D.CP.pending(), "2d: 도구가 잡은 누름(전파 차단 — 선·핸들·조각 드래그·그리기 점) = 팬 후보 아님");
  D.fire("pointerdown", M(2, 0, 0));
  ok(D.CP.pending() && !D.CP.panning(), "2e: 아무 도구도 잡지 않은 디자인 빈 곳(일반 보기) = 팬 후보");
  D.fire("pointerup", M(2, 0, 0));
  D.fire("pointerdown", Object.assign(M(3, 0, 0), { target: { inSvg: false } }));
  ok(!D.CP.pending(), "2f: 캔버스 밖(패널 등) 누름 = 팬 후보 아님");
}
// §3 두 손가락
{
  const { CP, sb, st, fire } = load(true);
  let hooks = 0, taps = 0, toolDowns = 0; CP.onMultiTouch(() => hooks++);
  const tool = e => { toolDowns++; };
  const a = fire("pointerdown", T(1, 300, 300), tool); CP.press(a, () => taps++);
  ok(toolDowns === 1, "3a: 첫 손가락은 도구로(선·핸들·빈 곳 판정 종전대로)");
  const b = fire("pointerdown", T(2, 500, 300), tool);
  ok(toolDowns === 1 && b.immediate && hooks === 1 && !CP.pending() && CP.pinching(), "3b: 두 번째 손가락 = 도구로 안 감 · 되돌리기 훅 · 한 손가락 후보 취소 · 핀치 시작");
  const z0 = sb.view.z, v0 = { x: sb.view.x, y: sb.view.y };
  fire("pointermove", T(2, 600, 300));          // 벌림(200 → 300) · 중점 400 → 450
  const z1 = sb.view.z;
  ok(near(z1, z0 * 1.5), "3c: 손가락 벌림 = 확대(거리 비) (" + z1 + ")");
  // 중점 (400,300) 기준 확대 + 중점 이동 50px
  const ex = 400 - 80 - (400 - 80 - v0.x) * 1.5 + 50, ey = 300 - 100 - (300 - 100 - v0.y) * 1.5 + 0;
  ok(near(sb.view.x, ex) && near(sb.view.y, ey), "3d: 이전 중점 기준 확대 + 중점 이동만큼 팬(휠·종전 핀치와 같은 식)");
  const vx = sb.view.x;
  fire("pointermove", T(1, 350, 360)); fire("pointermove", T(2, 650, 360));   // 거리 그대로 · 중점 +50,+60 이동 = 두 손가락 팬
  ok(near(sb.view.z, z1) && near(sb.view.x, vx + 50) && near(sb.view.y, ey + 60), "3e: 거리 유지 + 함께 이동 = 두 손가락 팬(배율 불변)");
  const u = fire("pointerup", T(2, 650, 360), tool);
  ok(u.immediate && !CP.pinching() && taps === 0, "3f: 핀치 손가락 떼기 = 클릭 아님(도구로 안 감) · 핀치 종료");
  fire("pointermove", T(1, 400, 400));
  ok(near(sb.view.x, vx + 50) && !CP.pending(), "3g: 남은 한 손가락 = 팬·편집 재개 없음(새로 누를 때까지)");
  fire("pointerup", T(1, 400, 400), tool);
  ok(st.renders > 0 && Object.keys(sb.view).sort().join() === "MX,MY,SC,x,y,z" && sb.view.SC === 11 && sb.view.MX === 80, "3h: 바뀌는 것은 뷰 x·y·z 뿐(배치·형상 객체 미접촉)");
  const mz = load(true); mz.sb.view.z = 9;
  mz.fire("pointerdown", T(1, 0, 0)); mz.fire("pointerdown", T(2, 100, 0)); mz.fire("pointermove", T(2, 1000, 0));
  ok(mz.sb.view.z === 10, "3i: 확대 상한 10(휠과 같은 범위)");
}
// §4 init.js Space
{
  const SRC = fs.readFileSync(path.join(ROOT, "js", "init.js"), "utf8");
  ok(!/touchstart|touchmove|panStart/.test(SRC), "4a: 핀치·팬 계산 중복 없음(init.js 터치 핀치 제거 → canvasPan 한 곳)");
  ok(/window\.addEventListener\("blur",[^\n]*releaseSpace\(\)/.test(SRC) && /visibilitychange[^\n]*document\.hidden[^\n]*releaseSpace\(\)/.test(SRC), "4b: 창 전환·탭 숨김 = Space 해제");
  const DL = fs.readFileSync(path.join(ROOT, "js", "designLayout.js"), "utf8");
  ok(/addEventListener\("blur", \(\) => \{ spaceHeld = false; \}\)/.test(DL) && /visibilitychange[^\n]*spaceHeld = false/.test(DL), "4c: 조각 배치 드래그의 Space 상태도 같은 해제");
  const i0 = SRC.indexOf("function _spaceForControl"), i1 = SRC.indexOf("function releaseSpace");
  const box = {}; vm.createContext(box);
  vm.runInContext("const document={body:{},documentElement:{}};" + SRC.slice(i0, i1) + ";this.f=_spaceForControl;", box);
  const f = box.f;
  const inp = ty => ({ tagName: "INPUT", type: ty, getAttribute: () => null, matches: () => false });
  const btn = fv => ({ tagName: "BUTTON", getAttribute: () => null, matches: q => q === ":focus-visible" && fv });
  ok(f(inp("text")) && f(inp("number")) && f({ tagName: "TEXTAREA" }) && f({ tagName: "SELECT" }) && f({ isContentEditable: true, tagName: "DIV" }), "4d: 입력칸 Space = 글자 입력(가로채지 않음)");
  ok(f(btn(true)) && !f(btn(false)), "4e: 키보드로 포커스한 버튼 Space = 누르기 · 마우스로 누른 뒤 남은 포커스 = 종전처럼 팬");
  ok(!f({ tagName: "DIV", getAttribute: () => null }) && !f(null), "4f: 캔버스·일반 영역 = 팬 Space");
  ok(/e\.isComposing/.test(SRC.slice(SRC.indexOf('document.addEventListener("keydown",e=>{\n  if(e.code!=="Space"'))), "4g: 한글 조합 중 Space 는 가로채지 않음");
}

console.log("결과: " + PASS + " PASS / " + FAIL + " FAIL");
if (FAIL) { fails.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
