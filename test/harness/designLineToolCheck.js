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
  // makePatternLine(anchors) → { id, piece, role, segments } 혼합
  const pl = T.makePatternLine("line-1", "front", [corner(0, 0), curved(10, 0, 2, 3), corner(20, 0)]);
  ok(pl.id === "line-1" && pl.piece === "front" && pl.segments.length === 2 && pl.segments[0].kind === "cubic" && pl.segments[1].kind === "line", "4: patternLine 하나 = line·cubic 혼합");
  // role: 기본 guide, 명시 role 반영
  ok(pl.role === "guide", "4: 새 선 기본 role = guide(참고)");
  ok(T.makePatternLine("l", "back", [corner(0, 0), corner(1, 1)], "cut").role === "cut", "4: 명시 role 반영");
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

// 14. validateCut: 절개선 유효성(현재 outline 기준, geometry 무변경)
{
  // 사각 outline (0,0)-(10,0)-(10,10)-(0,10) 평탄 선분
  const sq = [[{ x: 0, y: 0 }, { x: 10, y: 0 }], [{ x: 10, y: 0 }, { x: 10, y: 10 }], [{ x: 10, y: 10 }, { x: 0, y: 10 }], [{ x: 0, y: 10 }, { x: 0, y: 0 }]];
  const cut = (segs) => ({ id: "c", piece: "front", role: "cut", segments: segs });
  const lineSeg = (a, b) => ({ kind: "line", from: a, to: b });
  // 유효: 바닥(5,0) → 천장(5,10) 수직 분할
  ok(T.validateCut(cut([lineSeg({ x: 5, y: 0 }, { x: 5, y: 10 })]), sq, []).ok === true, "14: 유효 절개선 → 분리 가능");
  // role 아님
  ok(T.validateCut({ id: "c", piece: "front", role: "guide", segments: [lineSeg({ x: 5, y: 0 }, { x: 5, y: 10 })] }, sq, []).reason === "절개선이 아님", "14: role!=cut");
  // 시작점 외곽선 밖
  ok(T.validateCut(cut([lineSeg({ x: 5, y: 0.5 }, { x: 5, y: 10 })]), sq, []).reason === "시작점이 외곽선에 연결되지 않음", "14: 시작점 미연결");
  // 끝점 외곽선 밖
  ok(T.validateCut(cut([lineSeg({ x: 5, y: 0 }, { x: 5, y: 9.4 })]), sq, []).reason === "끝점이 외곽선에 연결되지 않음", "14: 끝점 미연결");
  // 시작=끝
  ok(T.validateCut(cut([lineSeg({ x: 5, y: 0 }, { x: 5, y: 0.04 })]), sq, []).reason === "시작점과 끝점이 같음", "14: 끝점 동일");
  // 자기 교차(bowtie): (2,0)-(8,8)-(2,8)-(8,0)
  ok(T.validateCut(cut([lineSeg({ x: 2, y: 0 }, { x: 8, y: 8 }), lineSeg({ x: 8, y: 8 }, { x: 2, y: 8 }), lineSeg({ x: 2, y: 8 }, { x: 8, y: 0 })]), sq, []).reason === "절개선이 자기 자신과 교차", "14: 자기 교차");
  // 중간이 외곽선에 닿음: (5,0)-(0,5)-(5,10), 중간 (0,5)가 좌변 위
  ok(T.validateCut(cut([lineSeg({ x: 5, y: 0 }, { x: 0, y: 5 }), lineSeg({ x: 0, y: 5 }, { x: 5, y: 10 })]), sq, []).reason === "절개선 중간이 외곽선에 닿음", "14: 중간 외곽선 접촉");
  // 외곽선 따라가는 중복: (0,0)-(10,0) = 바닥변
  ok(T.validateCut(cut([lineSeg({ x: 0, y: 0 }, { x: 10, y: 0 })]), sq, []).reason === "외곽선을 따라가는 중복 선", "14: outline 중복");
  // 기존 절개선과 교차: cut2(0,5)-(10,5) × cut1(5,0)-(5,10)
  const cut1flat = T.flattenLine([lineSeg({ x: 5, y: 0 }, { x: 5, y: 10 })]);
  ok(T.validateCut(cut([lineSeg({ x: 0, y: 5 }, { x: 10, y: 5 })]), sq, [cut1flat]).reason === "다른 절개선과 교차", "14: 기존 절개선 교차");
  // cubic 절개선(내부 곡선, adaptive flatten) → 유효
  ok(T.validateCut(cut([{ kind: "cubic", from: { x: 5, y: 0 }, c1: { x: 3, y: 3 }, c2: { x: 3, y: 7 }, to: { x: 5, y: 10 } }]), sq, []).ok === true, "14: cubic 절개선 유효(adaptive flatten)");
}

// 15. 파트 분리(buildPieceRing / splitRingByCut / 곡선 보존 / 다트 거부 / 폐곡선 오차)
{
  ok(["buildPieceRing", "splitRingByCut", "subSegment", "reverseSeg", "projectOntoRing", "walkConstruction"].every(k => typeof T[k] === "function"), "15: 파트 분리 API");
  const L = (a, b) => ({ kind: "line", from: a, to: b });
  const evalC = (s, t) => { const l = (a, b) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }); const a = l(s.from, s.c1), b = l(s.c1, s.c2), c = l(s.c2, s.to), d = l(a, b), e = l(b, c); return l(d, e); };
  // 10×10 사각형 outline + 위쪽 열린 다트(입구 (6,10)·(4,10), apex (5,6)).
  const outline = [
    L({ x: 0, y: 0 }, { x: 10, y: 0 }),      // 바닥
    L({ x: 10, y: 0 }, { x: 10, y: 10 }),    // 우변
    L({ x: 10, y: 10 }, { x: 6, y: 10 }),    // 위-우(다트 입구 right)
    L({ x: 4, y: 10 }, { x: 0, y: 10 }),     // 위-좌(다트 입구 left)
    L({ x: 0, y: 10 }, { x: 0, y: 0 })       // 좌변
  ];
  const constr = [{ from: { x: 4, y: 10 }, to: { x: 5, y: 6 } }, { from: { x: 5, y: 6 }, to: { x: 6, y: 10 } }];
  const rb = T.buildPieceRing(outline, constr);
  ok(rb.ok, "15: 링 구성 성공(다트로 닫음)");
  ok(rb.ok && rb.ring.length === 7, "15: 링 = outline 5 + 다트다리 2");
  ok(rb.ok && rb.ring.filter(r => r.source === "dartleg").length === 2, "15: 다트다리 2개 표식");
  if (rb.ok) { const last = rb.ring[rb.ring.length - 1].seg, first = rb.ring[0].seg; ok(near(last.to.x, first.from.x, 1e-9) && near(last.to.y, first.from.y, 1e-9), "15: 폐곡선 정확 닫힘"); }
  // 다트 안 건드리는 세로 절개선 (2,0)→(2,10)
  const cut = [L({ x: 2, y: 0 }, { x: 2, y: 10 })];
  const rs = T.splitRingByCut(rb.ring, cut);
  ok(rs.ok, "15: 유효 절개선 분할 성공");
  ok(rs.ok && rs.parts.length === 2, "15: 두 파트 생성");
  if (rs.ok) {
    // 각 파트 폐곡선 오차 ≤1e-4
    let cmax = 0;
    rs.parts.forEach(part => { const c = Math.hypot(part[part.length - 1].to.x - part[0].from.x, part[part.length - 1].to.y - part[0].from.y); if (c > cmax) cmax = c; });
    ok(cmax <= 1e-4, "15: 두 파트 폐곡선 연결오차 ≤1e-4");
    // 면적: 사각형 100 − 다트노치(½·4·4=8) = 92. 세로 절개 x=2 → 좌 strip 20 / 우 72.
    const area = (part) => { let a = 0, pts = []; part.forEach(s => { pts.push(s.from); }); for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p.x * q.y - q.x * p.y; } return Math.abs(a / 2); };
    const a0 = area(rs.parts[0]), a1 = area(rs.parts[1]);
    ok(near(a0 + a1, 96, 1e-6), "15: 면적 합 = 96(사각형 100 − 다트노치 삼각형 4)");
    ok(near(Math.min(a0, a1), 20, 1e-6) && near(Math.max(a0, a1), 76, 1e-6), "15: 좌 strip 20 / 우 76");
  }
  // 끝점이 같은 지점 → 거부
  ok(!T.splitRingByCut(rb.ring, [L({ x: 2, y: 0 }, { x: 2, y: 0.0001 })]).ok, "15: 양끝 같은 지점 거부");
  // 다트 다리를 가로지르는 절개선 → 후속 거부: (5,0)→(5,8) 은 apex(5,6) 부근 다리와 교차
  const across = T.splitRingByCut(rb.ring, [L({ x: 5, y: 0 }, { x: 5, y: 8 })]);
  ok(!across.ok, "15: 다트 가로지르는 절개선 거부");
  // 곡선 보존: 바닥을 cubic 으로 바꿔 절개선이 그 위를 지나게 → 파트에 cubic 유지(폴리라인 아님)
  const outlineC = outline.slice();
  outlineC[0] = { kind: "cubic", from: { x: 0, y: 0 }, c1: { x: 3, y: -2 }, c2: { x: 7, y: -2 }, to: { x: 10, y: 0 } };
  const rbC = T.buildPieceRing(outlineC, constr);
  const cStart = evalC(outlineC[0], 0.35);   // 절개선 시작을 cubic 위 정확한 점으로
  const rsC = rbC.ok ? T.splitRingByCut(rbC.ring, [L({ x: cStart.x, y: cStart.y }, { x: 2, y: 10 })]) : { ok: false };
  ok(rsC.ok, "15: cubic outline 분할 성공");
  if (rsC.ok) {
    const hasCubic = rsC.parts.some(part => part.some(s => s.kind === "cubic"));
    ok(hasCubic, "15: 파트에 cubic 유지(곡선 보존, 폴리라인 아님)");
  }
  // subSegment/_cubicBetween 정확도: cubic 을 [0.3,0.7] 로 잘라 끝점이 원 곡선 eval 과 일치
  const cub = { kind: "cubic", from: { x: 0, y: 0 }, c1: { x: 0, y: 10 }, c2: { x: 10, y: 10 }, to: { x: 10, y: 0 } };
  const sub = T.subSegment(cub, 0.3, 0.7);
  const e03 = evalC(cub, 0.3), e07 = evalC(cub, 0.7);
  ok(sub.kind === "cubic" && near(sub.from.x, e03.x, 1e-9) && near(sub.from.y, e03.y, 1e-9) && near(sub.to.x, e07.x, 1e-9) && near(sub.to.y, e07.y, 1e-9), "15: subSegment de Casteljau 정확(끝점 일치)");
  // 중간점도 원 곡선 위: sub 의 t=0.5 = 원 곡선 t=0.5 지점
  const subMid = evalC(sub, 0.5), origMid = evalC(cub, 0.5);
  ok(near(subMid.x, origMid.x, 1e-9) && near(subMid.y, origMid.y, 1e-9), "15: subSegment 중간점도 원 곡선 위");
  // reverseSeg: cubic 뒤집기
  const rev = T.reverseSeg(cub);
  ok(rev.from.x === cub.to.x && rev.c1.x === cub.c2.x && rev.c2.x === cub.c1.x && rev.to.x === cub.from.x, "15: reverseSeg cubic 제어점 반전");
}

// 16. 외곽 대체선(replaceArcOnRing): 짧은 arc 대체 / 모호·다트 거부 / 파생 outline 다트 열림 / 곡선 보존
{
  ok(["replaceArcOnRing", "extractArcTagged", "validateSelectedBoundary", "doBoundaryPreview"].every(k => typeof T[k] === "function"), "16: 외곽 대체 API");
  const L = (a, b) => ({ kind: "line", from: a, to: b });
  const evalC = (s, t) => { const l = (a, b) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }); const a = l(s.from, s.c1), b = l(s.c1, s.c2), c = l(s.c2, s.to), d = l(a, b), e = l(b, c); return l(d, e); };
  const outline = [
    L({ x: 0, y: 0 }, { x: 10, y: 0 }), L({ x: 10, y: 0 }, { x: 10, y: 10 }),
    L({ x: 10, y: 10 }, { x: 6, y: 10 }), L({ x: 4, y: 10 }, { x: 0, y: 10 }), L({ x: 0, y: 10 }, { x: 0, y: 0 })
  ];
  const constr = [{ from: { x: 4, y: 10 }, to: { x: 5, y: 6 } }, { from: { x: 5, y: 6 }, to: { x: 6, y: 10 } }];
  const rb = T.buildPieceRing(outline, constr);
  ok(rb.ok, "16: 링 구성");
  // 바닥-좌 모서리(짧은 arc: (0,3)→(0,0)→(3,0)) 를 대각선 대체선으로 교체
  const rr = T.replaceArcOnRing(rb.ring, [L({ x: 0, y: 3 }, { x: 3, y: 0 })]);
  ok(rr.ok, "16: 짧은 arc(모서리) 대체 성공");
  if (rr.ok) {
    // 파생 outline 에 다트 apex(5,6)가 없어야(다트 다리 제거 → 입구 열림 유지)
    const hasApex = rr.outline.some(s => (Math.abs(s.from.x - 5) < 1e-6 && Math.abs(s.from.y - 6) < 1e-6) || (Math.abs(s.to.x - 5) < 1e-6 && Math.abs(s.to.y - 6) < 1e-6));
    ok(!hasApex, "16: 파생 outline 에 다트 다리 제거(입구 열림 유지)");
    // 대체선(대각선)이 파생 outline 에 포함
    const hasDiag = rr.outline.some(s => s.kind === "line" && ((Math.abs(s.from.x - 0) < 1e-6 && Math.abs(s.from.y - 3) < 1e-6) || (Math.abs(s.to.x - 0) < 1e-6 && Math.abs(s.to.y - 3) < 1e-6)));
    ok(hasDiag, "16: 대체선이 파생 outline 에 포함");
  }
  // 끝점이 외곽선에서 벗어남 → 거부
  ok(T.replaceArcOnRing(rb.ring, [L({ x: 3, y: 3 }, { x: 3, y: 0 })]).reason === "대체선 시작점이 경계에서 벗어남", "16: 끝점 미연결 거부");
  // 다트를 포함한 짧은 arc(위쪽 (8,10)→(2,10)) → 거부
  ok(T.replaceArcOnRing(rb.ring, [L({ x: 8, y: 10 }, { x: 2, y: 10 })]).reason === "대체 arc 가 다트를 포함 — 후속 지원", "16: 다트 포함 arc 거부");
  // 모호(두 arc 길이 유사): 다트 없는 정사각형 ring 에서 (0,5)→(10,5) = 20 vs 20
  const sqRing = [
    { seg: L({ x: 0, y: 0 }, { x: 10, y: 0 }), source: "outline" }, { seg: L({ x: 10, y: 0 }, { x: 10, y: 10 }), source: "outline" },
    { seg: L({ x: 10, y: 10 }, { x: 0, y: 10 }), source: "outline" }, { seg: L({ x: 0, y: 10 }, { x: 0, y: 0 }), source: "outline" }
  ];
  ok(T.replaceArcOnRing(sqRing, [L({ x: 0, y: 5 }, { x: 10, y: 5 })]).reason === "대체할 arc 가 모호함(양쪽 길이 유사)", "16: 모호한 arc 거부");
  // 곡선 보존: 바닥을 cubic 으로. 대체선이 짧은 우-하 모서리를 교체, 유지 arc 의 cubic 바닥 보존
  const outlineC = outline.slice();
  outlineC[0] = { kind: "cubic", from: { x: 0, y: 0 }, c1: { x: 3, y: -2 }, c2: { x: 7, y: -2 }, to: { x: 10, y: 0 } };
  const rbC = T.buildPieceRing(outlineC, constr);
  const rrC = rbC.ok ? T.replaceArcOnRing(rbC.ring, [L({ x: 10, y: 4 }, { x: 8, y: 10 })]) : { ok: false };
  ok(rrC.ok, "16: cubic 포함 대체 성공");
  if (rrC.ok) ok(rrC.outline.some(s => s.kind === "cubic"), "16: 파생 outline 에 cubic 바닥 보존(곡선 보존)");
}

// 17. 디자인 외곽 합성(composeDesignOutline): 다중 합성 / 겹침 거부 / 순서 무관 / 곡선 보존 / 다트 열림
{
  ok(typeof T.composeDesignOutline === "function", "17: composeDesignOutline API");
  const L = (a, b) => ({ kind: "line", from: a, to: b });
  const outline = [
    L({ x: 0, y: 0 }, { x: 10, y: 0 }), L({ x: 10, y: 0 }, { x: 10, y: 10 }),
    L({ x: 10, y: 10 }, { x: 6, y: 10 }), L({ x: 4, y: 10 }, { x: 0, y: 10 }), L({ x: 0, y: 10 }, { x: 0, y: 0 })
  ];
  const constr = [{ from: { x: 4, y: 10 }, to: { x: 5, y: 6 } }, { from: { x: 5, y: 6 }, to: { x: 6, y: 10 } }];
  const rb = T.buildPieceRing(outline, constr);
  const bl = { x: 0, y: 3 }, blb = { x: 3, y: 0 };   // 좌하 모서리 대체
  const br = { x: 10, y: 3 }, brb = { x: 7, y: 0 };   // 우하 모서리 대체
  const b1 = [L(bl, blb)], b2 = [L(br, brb)];
  const comp = T.composeDesignOutline(rb.ring, [b1, b2]);
  ok(comp.ok, "17: 두 대체선 합성 성공");
  if (comp.ok) {
    // 두 대체선(대각선)이 모두 포함
    const hasB1 = comp.outline.some(s => (Math.abs(s.from.x - 0) < 1e-6 && Math.abs(s.from.y - 3) < 1e-6) || (Math.abs(s.to.x - 0) < 1e-6 && Math.abs(s.to.y - 3) < 1e-6));
    const hasB2 = comp.outline.some(s => (Math.abs(s.from.x - 10) < 1e-6 && Math.abs(s.from.y - 3) < 1e-6) || (Math.abs(s.to.x - 10) < 1e-6 && Math.abs(s.to.y - 3) < 1e-6));
    ok(hasB1 && hasB2, "17: 합성 결과에 두 대체선 모두 포함");
    // 다트 apex(5,6) 없음(입구 열림 유지)
    ok(!comp.outline.some(s => (Math.abs(s.from.x - 5) < 1e-6 && Math.abs(s.from.y - 6) < 1e-6) || (Math.abs(s.to.x - 5) < 1e-6 && Math.abs(s.to.y - 6) < 1e-6)), "17: 합성 결과 다트 입구 열림(다리 제거)");
  }
  // 순서 무관: [b1,b2] === [b2,b1] (정준 정렬)
  const c12 = T.composeDesignOutline(rb.ring, [b1, b2]), c21 = T.composeDesignOutline(rb.ring, [b2, b1]);
  ok(c12.ok && c21.ok && JSON.stringify(c12.outline) === JSON.stringify(c21.outline), "17: 순서 무관(적용 순서와 무관하게 같은 결과)");
  // 겹치는 대체 구간 거부: b1(0,3)-(3,0) 와 b3(0,5)-(5,0) 둘 다 좌하 모서리
  const b3 = [L({ x: 0, y: 5 }, { x: 5, y: 0 })];
  ok(T.composeDesignOutline(rb.ring, [b1, b3]).reason === "대체 구간이 겹침", "17: 겹치는 대체 구간 거부");
  // 개별 무효(다트 포함 arc) 포함 시 거부
  ok(!T.composeDesignOutline(rb.ring, [b1, [L({ x: 8, y: 10 }, { x: 2, y: 10 })]]).ok, "17: 개별 무효 대체선 포함 시 거부");
  // 곡선 보존: cubic 바닥. 좌하 모서리 대체 → 유지 arc 의 cubic 바닥 일부 보존
  const outlineC = outline.slice();
  outlineC[0] = { kind: "cubic", from: { x: 0, y: 0 }, c1: { x: 3, y: -2 }, c2: { x: 7, y: -2 }, to: { x: 10, y: 0 } };
  const rbC = T.buildPieceRing(outlineC, constr);
  const evalC = (s, t) => { const l = (a, b) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }); const a = l(s.from, s.c1), b = l(s.c1, s.c2), c = l(s.c2, s.to), d = l(a, b), e = l(b, c); return l(d, e); };
  const cutPt = evalC(outlineC[0], 0.2);
  const compC = rbC.ok ? T.composeDesignOutline(rbC.ring, [[L({ x: 0, y: 3 }, { x: cutPt.x, y: cutPt.y })]]) : { ok: false };
  ok(compC.ok, "17: cubic 포함 합성 성공");
  if (compC.ok) ok(compC.outline.some(s => s.kind === "cubic"), "17: 합성 결과 cubic 보존(곡선 보존)");
}

// 18. geomToPatternSegments: geometry({kind:"line"|"path"}) → patternLine({kind:"line"|"cubic"})
{
  ok(typeof T.geomToPatternSegments === "function", "18: geomToPatternSegments export");
  const geomPrims = [
    { kind: "line", from: { x: 1, y: 2 }, to: { x: 3, y: 4 } },
    { kind: "path", commands: [{ type: "M", points: [{ x: 3, y: 4 }] }, { type: "C", points: [{ x: 5, y: 6 }, { x: 7, y: 8 }, { x: 9, y: 10 }] }] }
  ];
  const segs = T.geomToPatternSegments(geomPrims);
  ok(segs.length === 2 && segs[0].kind === "line" && segs[1].kind === "cubic", "18: line→line, path C→cubic");
  ok(near(segs[0].from.x, 1) && near(segs[0].to.y, 4), "18: line 좌표 보존");
  ok(near(segs[1].from.x, 3) && near(segs[1].c1.x, 5) && near(segs[1].c2.x, 7) && near(segs[1].to.x, 9), "18: cubic from/c1/c2/to = M/C 점");
  // 다중 C(멀티세그먼트 스퀘어형) path → cubic 여러 개
  const multi = [{ kind: "path", commands: [{ type: "M", points: [{ x: 0, y: 0 }] }, { type: "C", points: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }] }, { type: "C", points: [{ x: 4, y: 0 }, { x: 5, y: 0 }, { x: 6, y: 0 }] }] }];
  const ms = T.geomToPatternSegments(multi);
  ok(ms.length === 2 && ms[0].kind === "cubic" && near(ms[1].from.x, 3), "18: 다중 C → cubic 여러 개(연속 cur)");
}

console.log("══════════════════════════════════════════════");
if (FAIL) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); }
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
if (FAIL) process.exitCode = 1;
