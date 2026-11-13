// ══════════════════════════════════════════════
// seamMatchCheck.js — «맞춤 길이» 카드(js/seamMatch.js · 읽기 전용 파생 표시 · 2026-11-13) 불변식.
//   node test/harness/seamMatchCheck.js
//   §1 정적: 로드 순서·마크업·버전 · 저장/형상 쓰기 없음 · ui.js·style.css 무변경 방식
//   §2 모델(권위 stub): 실측 행 · 방향 있는 차이 · 다트 닫은 어깨 · 이즈/셔링은 오류 아님
//   §3 못 재는 것: 0·원본 대체 금지(미측정 + 사유) · 완료 뒤 변경 = «변경됨»(옛 숫자 없음) · 파생 소매 · 1차 범위 밖 카라
//   §4 입력 불변(deep freeze 한 프로젝트로 계산)
//   화면 실측(갱신 흐름·저장 복원·모바일 폭)은 docs/STATUS.md 기록이 맡는다.
// ══════════════════════════════════════════════
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
const root = path.join(__dirname, "..", "..");
const read = f => fs.readFileSync(path.join(root, f), "utf8");
const src = read("js/seamMatch.js"), html = read("index.html"), css = read("css/apple.css"), ui = read("js/ui.js"), style = read("css/style.css");

// ── §1 정적 ──
{
  const iUi = html.indexOf('src="js/ui.js?v='), iSm = html.indexOf('src="js/seamMatch.js?v=');
  ok(iUi > 0 && iSm > iUi, "1: seamMatch.js 는 ui.js 뒤에 로드");
  ok((html.match(/id="seamMatchCard"/g) || []).length === 1 && /<details class="ax-seam" id="seamMatchCard" hidden>/.test(html), "1: 카드 1개 · 기본 접힘(open 없음) · 프로젝트 없으면 숨김");
  const iTabs = html.indexOf('id="designSubtabs"'), iCard = html.indexOf('id="seamMatchCard"'), iBody = html.indexOf('data-subtab="body"');
  ok(iTabs > 0 && iCard > iTabs && iCard < iBody, "1: 카드는 서브탭 줄과 탭 패널 사이(몸판·소매·카라 공통 위치)");
  ok(/id="seamMatchSummary"/.test(html) && /id="seamMatchBody"/.test(html), "1: 요약·본문 자리");
  ok(/aria-label="앱 버전 2026\.11\.13\.3">v2026\.11\.13\.3</.test(html), "1: 화면 버전 v2026.11.13.3");
  ok(!/localStorage|sessionStorage|indexedDB/.test(src), "1: 저장소 미접근");
  ok(!/\.complete\(|setSideSeamIntent|doReflect|doBoundaryApply|commitCandidate|\.working\.[A-Za-z.]+\s*=[^=]/.test(src), "1: 완료·반영·프로젝트 쓰기 호출 없음");
  ok(!/textContent\s*[^=]*\.match\(|parseFloat\(|querySelector\([^)]*\)\.textContent(?!\s*=)/.test(src.replace(/sum\.textContent = [^;]+;/g, "")), "1: DOM 글자 재파싱 없음");
  ok(!/seamMatch/.test(ui), "1: ui.js 무변경(관찰자 연결)");
  ok(/MutationObserver\(schedule\)\.observe\(sig/.test(src) && /designResultCheckNote/.test(src), "1: 갱신 = updateDesignResultUI 가 다시 쓰는 note 관찰");
  ok(/isEditDragging\(\)/.test(src) && /setTimeout/.test(src) && !/requestAnimationFrame/.test(src), "1: 끌기 중 계산 안 함 · trailing 한 번(매 프레임 계산 없음)");
  ok(/\.ax-seam\{/.test(css) && /\.ax-badge-info\{/.test(css) && /\.ax-badge-mute\{/.test(css) && /\.ax-badge-chg\{/.test(css), "1: 카드·상태 배지 스타일은 apple.css");
  ok(!/ax-seam|sm-row/.test(style), "1: css/style.css 무변경");
  ok(!/disabled\s*=|btnComplete/.test(src), "1: 완료 버튼·차단 미접근");
}

// ── §2~4 모델: 권위 모듈을 stub 으로 주입 ──
function load(win) {
  const sb = { window: win, setTimeout: () => 0, clearTimeout: () => {}, Math, JSON, Object, Array, isFinite, String, Number };
  vm.createContext(sb); vm.runInContext(src, sb); return win.seamMatch;
}
const L = (x0, y0, x1, y1, edge, extra) => Object.assign({ kind: "line", from: { x: x0, y: y0 }, to: { x: x1, y: y1 }, edge: edge }, extra || {});
const segLen = s => Math.hypot(s.to.x - s.from.x, s.to.y - s.from.y);
function deepFreeze(o) { if (o && typeof o === "object" && !Object.isFrozen(o)) { Object.keys(o).forEach(k => deepFreeze(o[k])); Object.freeze(o); } return o; }

// 기본 프로젝트: 앞 어깨 12 한 줄 · 뒤 어깨 = 5 + (다트 다리 2줄) + 7.3(다트 닫으면 12.3)
function baseProject() {
  return { working: {
    geometry: {
      front: { outline: [L(0, 0, 12, 0, "shoulder"), L(12, 0, 12, 30, "side-seam")] },
      back: { outline: [L(0, 0, 5, 0, "shoulder"), L(5, 0, 5.9, 8, "dart"), L(5.9, 8, 6.8, 0, "dart"), L(6.8, 0, 14.1, 0, "shoulder"), L(14, 0, 14, 30.2, "side-seam")] },
      sleeve: { outline: [] }
    },
    bodiceResult: { hash: "B1" }, sleeveA: { sourceBodiceHash: "B1" },
    collarDraft: { type: "shirt-two-piece", sourceBodiceHash: "B1",
      standGeometry: { outline: [Object.assign(L(0, 0, 18.5, 0), { part: "neck-seam" }), Object.assign(L(18.5, 0, 19, 0), { part: "extension" }), Object.assign(L(18, -3, 0, -3), { part: "top" }), Object.assign(L(18.5, -3, 18, -3), { part: "top-extension" })] },
      body: { attachLenCm: 18.004 } }
  } };
}
function makeWin(p, o) {
  o = o || {};
  const side = { front: { length: 30, reason: null }, back: { length: 30.2, reason: null } };
  return {
    designWorkflow: { current: () => p },
    bodiceCheckpoint: {
      effectiveOutline: (pr, pc) => pr.working.geometry[pc].outline, sideSeamSegLen: segLen,
      check: () => ({ sideSeam: o.sideSeam || { front: 30, back: 30.2, diff: 0.2, status: "check" }, neckline: o.neckline || { half: 18.8, ok: true } }),
      latest: pr => pr.working.bodiceResult || null, isCurrentBodiceChanged: () => !!o.bodiceChanged
    },
    sleeveCheckpoint: { check: () => o.sleeveCheck || { ok: true, fails: [], capLengths: { front: 21.5, back: 22.9, total: 44.4 }, ease: { front: 0.9, back: 1.3, total: 2.2 } } },
    designLineTool: { sideSeamLabels: () => o.side || side, displayedDerivedPiece: () => !!o.derived, isEditDragging: () => false }
  };
}
const byId = (m, id) => m.rows.find(r => r.id === id);

// §2 실측 행
{
  const p = deepFreeze(baseProject()), before = JSON.stringify(p), m = load(makeWin(p)).compute();
  ok(m.ok && m.rows.length === 7, "2: 기본 7행(옆선·어깨·진동 3·카라 2)");
  const s = byId(m, "side");
  ok(s.a.cm === 30 && s.b.cm === 30.2 && Math.abs(s.diff - 0.2) < 1e-9 && s.status === "diff" && /뒤 쪽이 0\.20 김/.test(s.diffText), "2: 옆선 A/B·방향 있는 차이");
  ok(s.basis.some(t => /0\.1cm 이내/.test(t) && /bodiceCheckpoint/.test(t)), "2: 옆선 기준 출처 표기");
  const sh = byId(m, "shoulder");
  ok(Math.abs(sh.a.cm - 12) < 1e-9 && Math.abs(sh.b.cm - 12.3) < 1e-9, "2: 뒤 어깨 = 다트 다리를 뺀 두 구간 합(다트 닫은 길이)");
  ok(sh.status === "diff" && sh.basis.some(t => /판정 기준 없음/.test(t)) && sh.basis.some(t => /2구간 합/.test(t)), "2: 어깨 = 기준 없음 · 차이만");
  const af = byId(m, "ah-front"), at = byId(m, "ah-total");
  ok(Math.abs(af.a.cm - 20.6) < 1e-9 && af.b.cm === 21.5 && af.status === "ease" && /소매산이 0\.90 김/.test(af.diffText), "2: 진동 = 소매산 − 이세(권위 check) · 양의 이세 = 이즈(오류 아님)");
  ok(Math.abs(at.a.cm - 42.2) < 1e-9 && at.b.cm === 44.4 && at.status === "ease", "2: 합계 행");
  const nb = byId(m, "neck-band"), bc = byId(m, "band-collar");
  ok(nb.a.cm === 18.8 && nb.b.cm === 18.5 && nb.status === "diff" && /목둘레 쪽이 0\.30 김/.test(nb.diffText), "2: 밴드 달림선 = neck-seam 만(앞 끝 연장 제외)");
  ok(bc.a.cm === 18 && bc.b.cm === 18.004 && bc.status === "match" && bc.basis.some(t => /0\.01cm/.test(t)), "2: 밴드 윗선(top 만) ↔ 위 칼라 · 0.01 기준 출처");
  ok(!m.rows.some(r => r.status === "bad" || /오류/.test(r.statusText || "")), "2: 빨강 오류 상태 없음");
  ok(bc.basis.some(t => /기록값/.test(t)), "2: 위 칼라 형상에 표시가 없으면 기록값을 썼다고 밝힘");
  { // 위 칼라 형상에 attach 구간이 있으면 기록이 아니라 지금 형상을 잰다
    const pg = baseProject(); pg.working.collarDraft.body = { attachLenCm: 99, geometry: { outline: [Object.assign(L(0, 0, 18.2, 0), { part: "attach" }), Object.assign(L(18.2, 0, 18.2, 6), { part: "point-front" })] } };
    const r = byId(load(makeWin(pg)).compute(), "band-collar");
    ok(Math.abs(r.b.cm - 18.2) < 1e-9 && r.status === "diff" && !r.basis.some(t => /기록값/.test(t)), "2: 위 칼라 이음선 = 현재 형상 attach 실측(기록값 아님)");
  }
  ok(byId(m, "shoulder").basis.some(t => /단차/.test(t)), "2: 어깨 다트 다리 길이 차는 어깨 길이에 넣지 않는다고 밝힘");
  ok(JSON.stringify(p) === before, "4: 입력 프로젝트 불변(frozen 으로 계산 성공)");
  // 옆선 의도된 여유 · 일치
  const mi = load(makeWin(p, { sideSeam: { front: 30, back: 30.2, status: "match", intent: { mode: "back-ease", easeCm: 0.2 } } })).compute();
  ok(byId(mi, "side").status === "ease" && byId(mi, "side").statusText === "의도된 이즈", "2: 옆선 의도 여유 = 의도된 이즈");
  const neg = load(makeWin(p, { sleeveCheck: { fails: [], capLengths: { front: 20, back: 21, total: 41 }, ease: { front: -0.5, back: 0, total: -0.5 } } })).compute();
  ok(byId(neg, "ah-front").status === "diff" && /짧음/.test(byId(neg, "ah-front").diffText) && byId(neg, "ah-back").status === "match", "2: 음의 이세 = 차이 있음 · 0 = 일치");
  // 커프스 셔링
  const pc = baseProject(); pc.working.sleeveA.cuff = { lengths: { sleeveHemCm: 32, attachLengthCm: 20, shirringCm: 12 } };
  const mc = load(makeWin(pc)).compute(), cf = byId(mc, "cuff");
  ok(cf && cf.status === "gather" && cf.a.cm === 20 && cf.b.cm === 32 && /셔링분 12\.00/.test(cf.diffText), "2: 소매구 ↔ 커프스 셔링분 별도 표시");
  ok(!byId(m, "cuff"), "2: 커프스 없으면 행 없음");
}

// §3 못 재는 것
{
  const noNum = r => r.a === undefined && r.b === undefined && r.diff === undefined && typeof r.reason === "string" && r.reason.length > 0;
  // 옆선 측정 불가 사유 전달
  let m = load(makeWin(baseProject(), { side: { front: { length: null, reason: "명시된 옆선 구간 없음" }, back: { length: 30.2, reason: null } } })).compute();
  ok(byId(m, "side").status === "unmeasured" && noNum(byId(m, "side")) && /앞: 명시된 옆선 구간 없음/.test(byId(m, "side").reason), "3: 옆선 미측정 = 0 아님 + 사유");
  // 어깨 unresolved · 구간 없음
  let p = baseProject(); p.working.geometry.front.outline = [L(0, 0, 12, 3, undefined, { edgeStatus: "unresolved", replacedEdges: ["shoulder", "armhole"] })];
  m = load(makeWin(p)).compute(); ok(byId(m, "shoulder").status === "unmeasured" && noNum(byId(m, "shoulder")), "3: 어깨가 미지정 대체선에 덮임 = 미측정");
  // 다조각 몸판
  p = baseProject(); p.working.geometry.frontCenter = { outline: [] };
  m = load(makeWin(p)).compute(); ok(byId(m, "shoulder").status === "unmeasured" && /프린세스/.test(byId(m, "shoulder").reason), "3: 분리 몸판 어깨 = 미측정 + 사유");
  // 파생 몸판(표시 기준)
  m = load(makeWin(baseProject(), { derived: true })).compute(); ok(byId(m, "shoulder").status === "unmeasured" && /파생 몸판/.test(byId(m, "shoulder").reason), "3: 파생 몸판 어깨 = 원래 값 대체 금지");
  // Ⓡ~Ⓩ 소매: check 가 숫자를 줘도 싣지 않는다
  p = baseProject(); delete p.working.sleeveA; p.working.sleeveR = {};
  m = load(makeWin(p)).compute(); ok(["ah-front", "ah-back", "ah-total"].every(id => byId(m, id).status === "unmeasured" && noNum(byId(m, id))), "3: Ⓡ~Ⓩ 소매 진동↔소매산 = 미측정");
  // 몸판 완료 뒤 변경
  m = load(makeWin(baseProject(), { bodiceChanged: true })).compute();
  ok(["ah-front", "ah-back", "ah-total", "neck-band"].every(id => byId(m, id).status === "changed" && noNum(byId(m, id))), "3: 몸판 변경 = «변경됨» · 옛 숫자 없음");
  ok(byId(m, "side").a && byId(m, "shoulder").a && byId(m, "band-collar").a, "3: 현재 형상으로 잴 수 있는 행은 그대로 측정");
  // 카라가 옛 몸판 기준
  p = baseProject(); p.working.collarDraft.sourceBodiceHash = "OLD";
  m = load(makeWin(p)).compute(); ok(byId(m, "neck-band").status === "changed" && noNum(byId(m, "neck-band")) && byId(m, "band-collar").status === "match", "3: 카라 옛 몸판 기준 = 목둘레 행만 변경됨");
  p = baseProject(); p.working.collarDraft.sourceBodiceHash = "OLD"; p.working.collarDraft.standGeometry = null; p.working.collarDraft.body = null;
  m = load(makeWin(p)).compute(); ok(byId(m, "neck-band").status === "changed" && byId(m, "band-collar").status === "changed", "3: 무효화된 카라 = 변경됨");
  // 카라 종류 범위 밖 · 본체 없음 · 카라 없음
  p = baseProject(); p.working.collarDraft = { type: "flat-collar", sourceBodiceHash: "B1", flat: { measure: { attachLenCm: 18, neckTargetCm: 18 } } };
  m = load(makeWin(p)).compute(); ok(byId(m, "neck-band").status === "unmeasured" && noNum(byId(m, "neck-band")) && /1차 지원/.test(byId(m, "neck-band").reason), "3: 범위 밖 카라 = 메타 목표값을 실측처럼 싣지 않음");
  p = baseProject(); p.working.collarDraft.body = null;
  m = load(makeWin(p)).compute(); ok(byId(m, "neck-band").a && byId(m, "band-collar").status === "unmeasured", "3: 위 칼라 없음 = 그 행만 미측정");
  p = baseProject(); p.working.collarDraft = null; p.working.bodiceResult = null;
  m = load(makeWin(p)).compute(); ok(byId(m, "ah-total").status === "unmeasured" && byId(m, "neck-band").status === "unmeasured" && byId(m, "side").a, "3: 몸판 완료 전 = 소매·카라 미측정 · 몸판 행은 측정");
  // 소매 check 가 길이를 못 줌
  m = load(makeWin(baseProject(), { sleeveCheck: { fails: ["no-bodice", "no-sleeve"], capLengths: null, ease: null } })).compute();
  ok(byId(m, "ah-total").status === "unmeasured" && /소매 없음/.test(byId(m, "ah-total").reason) && !/no-sleeve/.test(byId(m, "ah-total").reason), "3: 소매 없음 = 내부 코드가 아닌 글로 사유");
  m = load(makeWin(baseProject(), { sleeveCheck: { fails: ["cap-unmeasured"], capLengths: null, ease: null } })).compute();
  ok(byId(m, "ah-front").status === "unmeasured" && /cap-unmeasured/.test(byId(m, "ah-front").reason), "3: 소매산 미측정 사유 전달");
  // 프로젝트 없음
  ok(load(makeWin(null)).compute().ok === false, "3: 프로젝트 없음 = 모델 없음(카드 숨김)");
}

console.log("seamMatchCheck: " + PASS + " passed, " + FAIL + " failed");
if (FAIL) { fails.forEach(f => console.log("  FAIL " + f)); process.exit(1); }
