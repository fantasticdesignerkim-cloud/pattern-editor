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

// 10. snap 순수 로직: 우선순위 캐스케이드(anchor→endpoint→outline→격자), 임계, 격자 폴백
{
  const outSeg = { kind: "line", from: { x: 0, y: 0 }, to: { x: 20, y: 0 } };
  const sources = { anchors: [{ x: 5, y: 5 }], endpoints: [{ x: 8, y: 5 }], outlineSegs: [outSeg] };
  // anchor(5,5) 근처(임계 2) → anchor 우선(더 먼 endpoint·outline 무시)
  let s = T.chooseSnap({ x: 5.5, y: 5 }, sources, 2, 0.5);
  ok(s && s.type === "anchor" && near(s.point.x, 5) && near(s.point.y, 5), "10: anchor 우선");
  // anchor 없는 곳, endpoint(8,5) 근처 → endpoint
  s = T.chooseSnap({ x: 8.3, y: 5 }, { anchors: [], endpoints: [{ x: 8, y: 5 }], outlineSegs: [outSeg] }, 1, 0.5);
  ok(s && s.type === "endpoint", "10: endpoint 우선(anchor 없을 때)");
  // outline 위(투영), anchor·endpoint 임계 밖 → outline 최근접점
  s = T.chooseSnap({ x: 10, y: 0.3 }, { anchors: [{ x: 50, y: 50 }], endpoints: [{ x: 50, y: 50 }], outlineSegs: [outSeg] }, 1, 0.5);
  ok(s && s.type === "outline" && near(s.point.y, 0) && near(s.point.x, 10), "10: outline 최근접점");
  // 아무 후보도 임계 밖 → 격자(0.5) 폴백
  s = T.chooseSnap({ x: 3.1, y: 4.9 }, { anchors: [], endpoints: [], outlineSegs: [] }, 1, 0.5);
  ok(s && s.type === "grid" && near(s.point.x, 3) && near(s.point.y, 5), "10: 격자 0.5 폴백");
  // 임계 밖이면 null(격자도 8px 밖이면 안 잡힘) — 임계 0.1, 커서가 격자에서 먼 경우
  s = T.chooseSnap({ x: 3.25, y: 3.25 }, { anchors: [], endpoints: [], outlineSegs: [] }, 0.1, 0.5);
  ok(s === null, "10: 임계 밖 → null(격자도 안 잡힘)");
}
// 11. closestOnSeg / nearestOnSegs
{
  ok(near(T.closestOnSeg({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 }).x, 5) && near(T.closestOnSeg({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 }).y, 0), "11: 선분 위 최근접점");
  // 끝점 넘어가면 clamp
  ok(near(T.closestOnSeg({ x: -5, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }).x, 0), "11: clamp 시작점");
  const r = T.nearestOnSegs({ x: 5, y: 0.2 }, [{ kind: "line", from: { x: 0, y: 0 }, to: { x: 10, y: 0 } }], 1);
  ok(r && near(r.pt.x, 5) && near(r.pt.y, 0), "11: nearestOnSegs line");
}
// 12. cubic 최근접점 정밀도 — adaptive de Casteljau flattening(1e-4)이 고정 16분할보다 정확
{
  const trueCubicAt = (s, t) => { const m = 1 - t; return { x: m*m*m*s.from.x + 3*m*m*t*s.c1.x + 3*m*t*t*s.c2.x + t*t*t*s.to.x, y: m*m*m*s.from.y + 3*m*m*t*s.c1.y + 3*m*t*t*s.c2.y + t*t*t*s.to.y }; };
  // 밀집 샘플로 실제 곡선 최근접점
  const trueNearest = (s, p) => { let best=null, bd=Infinity; for (let i=0;i<=4000;i++){ const q=trueCubicAt(s,i/4000); const d=Math.hypot(p.x-q.x,p.y-q.y); if(d<bd){bd=d;best=q;} } return { pt: best, d: bd }; };
  // 곡선 위 점이 실제 cubic 과 얼마나 떨어졌나(허용오차 확인)
  const distToCurve = (s, pt) => { let m=Infinity; for(let i=0;i<=4000;i++){ const q=trueCubicAt(s,i/4000); const d=Math.hypot(pt.x-q.x,pt.y-q.y); if(d<m)m=d; } return m; };
  // 고곡률 cubic(꺾이는 아치). 커서를 16분할 꼭짓점 사이(t≈0.53)에 두어 샘플 선분 위가 아니라
  // 실제 곡선 위 점이 최근접이 되게 한다.
  const seg = { kind: "cubic", from: { x: 0, y: 0 }, c1: { x: 24, y: 0 }, c2: { x: 24, y: 12 }, to: { x: 0, y: 12 } };
  const t0 = 0.53, on = trueCubicAt(seg, t0);
  // 곡선 바깥 법선 근처의 커서(곡선에서 약간 떨어진 점)
  const cursor = { x: on.x + 0.8, y: on.y };
  const tn = trueNearest(seg, cursor);
  const adaptive = T.nearestOnSegs(cursor, [seg], 100).pt;
  // 16분할(옛 방식) 재현: 샘플 선분에 투영
  let fixed=null, fd=Infinity, prev=trueCubicAt(seg,0);
  for(let i=1;i<=16;i++){ const cur=trueCubicAt(seg,i/16); const c=T.closestOnSeg(cursor,prev,cur); const d=Math.hypot(cursor.x-c.x,cursor.y-c.y); if(d<fd){fd=d;fixed=c;} prev=cur; }
  ok(distToCurve(seg, adaptive) < 1e-3, "12: adaptive 최근접점이 실제 cubic 위(오차<1e-3)");
  ok(Math.hypot(adaptive.x - tn.pt.x, adaptive.y - tn.pt.y) < 1e-3, "12: adaptive 결과 = 실제 최근접(오차<1e-3)");
  ok(distToCurve(seg, fixed) > distToCurve(seg, adaptive) * 5, "12: 고정 16분할은 곡선에서 더 벗어남(정밀도 개선 실증)");
  // flattenSegment 계약: cubic 은 line 여러 개, line 은 자기 자신
  ok(T.flattenSegment(seg).length > 16 && T.flattenSegment({ kind: "line", from: { x: 0, y: 0 }, to: { x: 1, y: 1 } }).length === 1, "12: flattenSegment(cubic 세분·line 단일)");
  // distToSegment(선 선택 hit-test)도 같은 flatten 경계 사용 → 곡선 위 최근접 거리
  const near0 = T.distToSegment(on, seg);
  ok(near0 < 1e-3, "12: distToSegment(hit-test)도 정밀 — 곡선 위 점 거리 ~0");
}
// 13. Shift 각도 고정: 45° 배수로 각도만 고정, 길이 보존, 경계각, offset 독립
{
  const ang = v => Math.atan2(v.y, v.x) * 180 / Math.PI;
  const len = v => Math.hypot(v.x, v.y);
  // 수평(≈0°): (5, 0.4) → 0°, 길이 보존
  let v = T.constrainAngle45(5, 0.4);
  ok(near(ang(v), 0, 1e-6) && near(len(v), Math.hypot(5, 0.4)), "13: 수평 0° · 길이 보존");
  // 수직(90°): (0.3, 6) → 90°
  v = T.constrainAngle45(0.3, 6);
  ok(near(Math.abs(ang(v)), 90, 1e-6) && near(len(v), Math.hypot(0.3, 6)), "13: 수직 90°");
  // +45°: (5, 4) → 45°
  v = T.constrainAngle45(5, 4);
  ok(near(ang(v), 45, 1e-6) && near(len(v), Math.hypot(5, 4)), "13: +45°");
  // -45°: (5, -4.5) → -45°
  v = T.constrainAngle45(5, -4.5);
  ok(near(ang(v), -45, 1e-6), "13: -45°");
  // 135°: (-5, 4) → 135°
  v = T.constrainAngle45(-5, 4);
  ok(near(ang(v), 135, 1e-6), "13: 135°");
  // 경계각(30° → 45 로 반올림, 20° → 0 으로): 결과 각도가 45 배수
  const b30 = T.constrainAngle45(Math.cos(30 * Math.PI / 180), Math.sin(30 * Math.PI / 180));
  ok(near(ang(b30), 45, 1e-6), "13: 경계각 30°→45");
  const b20 = T.constrainAngle45(Math.cos(20 * Math.PI / 180), Math.sin(20 * Math.PI / 180));
  ok(near(ang(b20), 0, 1e-6), "13: 경계각 20°→0");
  // 결과 각도는 항상 45 배수
  [[3, 1], [1, 3], [-2, 5], [-4, -1], [2, -7]].forEach(([dx, dy]) => { const r = T.constrainAngle45(dx, dy); const a = ((Math.round(ang(r)) % 45) + 45) % 45; ok(a === 0 && near(len(r), Math.hypot(dx, dy)), "13: 45 배수 + 길이 보존 (" + dx + "," + dy + ")"); });
  // 길이 0 → 0 벡터(안전)
  ok(near(T.constrainAngle45(0, 0).x, 0) && near(T.constrainAngle45(0, 0).y, 0), "13: 길이 0 안전");
  // offset/zoom 독립: 벡터(형상 cm 델타)만 다루므로 어떤 offset 을 더해도 벡터 자체는 불변
  const v1 = T.constrainAngle45(5, 4);
  ok(near(v1.x, T.constrainAngle45(5, 4).x) && near(v1.y, T.constrainAngle45(5, 4).y), "13: 결정론(offset·zoom 무관 — 벡터만)");
}

console.log("══════════════════════════════════════════════");
if (FAIL) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); }
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
if (FAIL) process.exitCode = 1;
