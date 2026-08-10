// ══════════════════════════════════════════════
// designLineToolCheck.js — js/designLineTool.js 의 순수 로직 회귀 테스트.
// 핵심 계약: (1) 클릭 도안 cm → 피스 offset 역변환해 형상 cm 로 저장, (2) 왕복 정합
// (형상 cm + offset = 원래 도안 cm → 렌더가 클릭 위치에 정확히 그림), (3) piece 소유권
// 기록. 클릭 이벤트·DOM 흐름은 브라우저 검증 몫. 실제 소스를 vm 으로 실행한다.
//
//   node test/harness/designLineToolCheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "..", "js", "designLineTool.js"), "utf8");

let PASS = 0, FAIL = 0; const fails = [];
function ok(cond, name) { if (cond) PASS++; else { FAIL++; fails.push(name); } }
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

// svg 미정의(pointerdown/keydown 리스너 skip) — window 만 최소 제공.
function load() {
  const sandbox = { window: {}, document: {}, console: { log() {}, warn() {} }, Math, JSON, Object, Array };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox, { filename: "designLineTool.js" });
  return sandbox.window.designLineTool;
}
const T = load();

// 0. API
ok(["pointToGeometryCm", "geometryToDrawCm", "makePatternLine", "segmentsFromAnchors", "nextId", "anchorsFromSegments", "moveAnchor", "distToLine", "distToSegment", "handlesOf", "toggle", "toggleSelect", "getSelectionOverlay", "deleteSelected"].every(k => typeof T[k] === "function") && Object.isFrozen(T), "0: API·frozen");

// ── 선택·편집 순수 로직 ──
const corner = (x, y) => ({ p: { x, y }, h: null });
const curved = (x, y, hx, hy) => ({ p: { x, y }, h: { x: hx, y: hy } });
// 7. anchorsFromSegments: 세그먼트 공유 끝점 → anchor 목록(seg수+1)
{
  const line = T.makePatternLine("l", "front", [corner(0, 0), curved(10, 0, 2, 3), corner(20, 0)]);
  const as = T.anchorsFromSegments(line.segments);
  ok(as.length === 3 && near(as[0].x, 0) && near(as[1].x, 10) && near(as[2].x, 20), "7: anchorsFromSegments = seg수+1, 공유 끝점");
}
// 8. moveAnchor: 공유 anchor 이동 시 이웃 세그먼트 to/from + 인접 cubic 핸들 함께 갱신
{
  const line = T.makePatternLine("l", "front", [corner(0, 0), curved(10, 0, 2, 3), corner(20, 0)]);
  // anchor 1(= seg0.to == seg1.from)을 (+5,+4) 이동
  const c2before = { x: line.segments[0].c2.x, y: line.segments[0].c2.y };
  T.moveAnchor(line, 1, 5, 4);
  ok(near(line.segments[0].to.x, 15) && near(line.segments[0].to.y, 4), "8: seg0.to 이동");
  ok(near(line.segments[1].from.x, 15) && near(line.segments[1].from.y, 4), "8: seg1.from 함께 이동(공유 끝점)");
  ok(near(line.segments[0].c2.x, c2before.x + 5) && near(line.segments[0].c2.y, c2before.y + 4), "8: 인접 cubic 핸들 c2 함께 이동");
  // 끝 anchor(2) 이동은 seg1.to 만
  T.moveAnchor(line, 2, -3, 0);
  ok(near(line.segments[1].to.x, 17), "8: 끝 anchor 는 마지막 seg.to 만");
}
// 9. distToSegment: line 정확·cubic 근사, distToLine 최소
{
  const lineSeg = { kind: "line", from: { x: 0, y: 0 }, to: { x: 10, y: 0 } };
  ok(near(T.distToSegment({ x: 5, y: 3 }, lineSeg), 3), "9: 점-직선 거리");
  const cub = { kind: "cubic", from: { x: 0, y: 0 }, c1: { x: 0, y: 10 }, c2: { x: 10, y: 10 }, to: { x: 10, y: 0 } };
  ok(T.distToSegment({ x: 5, y: 7.5 }, cub) < 0.2, "9: 점-cubic 근사(정점 근처)");
  const line = { segments: [lineSeg, cub] };
  ok(near(T.distToLine({ x: 5, y: 3 }, line), 3), "9: distToLine 최소거리");
}

// 1. offset 역변환: 형상 cm = 도안 cm − offset
{
  const off = { dx: 57.5, dy: -0.965 };
  const geo = T.pointToGeometryCm(60, 12, off);
  ok(near(geo.x, 60 - 57.5) && near(geo.y, 12 - (-0.965)), "1: pointToGeometryCm = draw − offset");
}
// 2. 왕복 정합: geometryToDrawCm(pointToGeometryCm(draw, off), off) === draw
{
  const off = { dx: 85.02, dy: -62.14 };
  const draw = { x: 90.5, y: 3.2 };
  const geo = T.pointToGeometryCm(draw.x, draw.y, off);
  const back = T.geometryToDrawCm(geo, off);
  ok(near(back.x, draw.x) && near(back.y, draw.y), "2: 왕복 정합(형상+offset=도안)");
}
// 3. 피스별 offset 이 다르면 같은 클릭도 다른 형상 cm 로 저장(피스 상대 저장)
{
  const clickDraw = { x: 40, y: 20 };
  const front = T.pointToGeometryCm(clickDraw.x, clickDraw.y, { dx: 0, dy: 0 });
  const back = T.pointToGeometryCm(clickDraw.x, clickDraw.y, { dx: 57.5, dy: 0 });
  ok(near(front.x, 40) && near(back.x, 40 - 57.5), "3: 같은 클릭도 피스 offset 따라 다른 형상 cm");
  // 그러나 화면 표시 위치는 동일(각자 offset 더하면 같은 도안 cm)
  ok(near(T.geometryToDrawCm(front, { dx: 0, dy: 0 }).x, T.geometryToDrawCm(back, { dx: 57.5, dy: 0 }).x), "3: 표시 위치는 동일(클릭 지점)");
}
// 4. segmentsFromAnchors: 클릭(h=null)→line, 드래그(h)→cubic. 하나의 선에 혼합.
{
  const corner = (x, y) => ({ p: { x, y }, h: null });
  const curved = (x, y, hx, hy) => ({ p: { x, y }, h: { x: hx, y: hy } });
  // 모두 클릭 → 전부 line (기존 연속선과 동일)
  const allLine = T.segmentsFromAnchors([corner(0, 0), corner(1, 1), corner(2, 0)]);
  ok(allLine.length === 2 && allLine.every(s => s.kind === "line"), "4: 클릭만 → 전부 line");
  // 도착점이 드래그 → cubic. c2 = 도착.p − 도착.h(들어오는 접선), 출발 모서리면 c1 = 출발.p
  const mix = T.segmentsFromAnchors([corner(0, 0), curved(10, 0, 2, 3), corner(20, 0)]);
  ok(mix.length === 2, "4: 3 anchor → 2 segment");
  ok(mix[0].kind === "cubic" && near(mix[0].c1.x, 0) && near(mix[0].c1.y, 0) && near(mix[0].c2.x, 10 - 2) && near(mix[0].c2.y, 0 - 3) && near(mix[0].from.x, 0) && near(mix[0].to.x, 10), "4: 드래그 도착 → cubic(c1=출발.p, c2=도착−h)");
  ok(mix[1].kind === "line" && near(mix[1].from.x, 10) && near(mix[1].to.x, 20), "4: 클릭 도착 → line (곡선점 뒤 모서리)");
  // 곡선점 → 곡선점: 출발 핸들이 c1 에 반영(부드럽게 이어짐)
  const smooth = T.segmentsFromAnchors([curved(0, 0, 1, 1), curved(10, 0, 2, -1)]);
  ok(smooth[0].kind === "cubic" && near(smooth[0].c1.x, 0 + 1) && near(smooth[0].c1.y, 0 + 1) && near(smooth[0].c2.x, 10 - 2) && near(smooth[0].c2.y, 0 + 1), "4: 곡선→곡선 c1=출발+h");
  // makePatternLine(anchors) → { id, piece, segments } 혼합
  const pl = T.makePatternLine("line-1", "front", [corner(0, 0), curved(10, 0, 2, 3), corner(20, 0)]);
  ok(pl.id === "line-1" && pl.piece === "front" && pl.segments.length === 2 && pl.segments[0].kind === "cubic" && pl.segments[1].kind === "line", "4: patternLine 하나 = line·cubic 혼합");
}
// 5. nextId: 기존 최대 id + 1 (삭제가 생겨도 충돌 없음)
{
  ok(T.nextId([]) === "line-1", "5: 빈 목록 → line-1");
  ok(T.nextId([{ id: "line-1" }, { id: "line-2" }]) === "line-3", "5: 최대+1");
  ok(T.nextId([{ id: "line-1" }, { id: "line-5" }]) === "line-6", "5: 구멍 있어도 최대+1(충돌 없음)");
}
// 6. 순수 함수 입력 비변형
{
  const off = { dx: 5, dy: 6 }, os = JSON.stringify(off);
  T.pointToGeometryCm(1, 2, off);
  const g = { x: 1, y: 2 }, gs = JSON.stringify(g);
  T.geometryToDrawCm(g, off);
  ok(JSON.stringify(off) === os && JSON.stringify(g) === gs, "6: 입력 비변형");
}

console.log("══════════════════════════════════════════════");
if (FAIL) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); }
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
if (FAIL) process.exitCode = 1;
