// ══════════════════════════════════════════════
// lineOutsideHitCheck.js — 조각 hit rect 밖으로 휜 사용자 선·핸들의 재선택/드래그(2026-11-07 «다음정리①»).
//   실제 designLineTool 핸들러에 «rect 밖» 타깃(closest → null)으로 pointerdown 을 넣는다. 전역 rect 없이 선·핸들 실제 위치(화면 px 허용폭)로만 판정.
//   §1 바깥 곡선 재선택 · 외부 핸들/중간 anchor 드래그 §2 빈 공간·먼 클릭 = 해제(선 불변) §3 줌별 px 허용폭 §4 rect 피스 우선(가로채지 않음)
//   §5 off 모드/다른 stage 무동작 §6 geometry·원형 불변 §7 외곽 반영된 선(boundary)도 같은 경로 · 관리선 잠금 그대로
//   §8 숨긴 선 제외(Codex 검토): 요크·프린세스 모드(render 가 패턴선을 안 그림)·소매 geometry 없음·관리선 = 보정 대상 아님 · 선택선 외부 핸들도 표시 상태일 때만
//      판정 = render.js `_designLinePickable`(render 의 `_designPatternLinesShown` 공유) — 소스에서 그 구간만 실행
//   node test/harness/lineOutsideHitCheck.js
// ══════════════════════════════════════════════
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "lineAutoSelectCheck.js"), "utf8");
const cut = src.indexOf("// 원래 몸판 앞판에서 다트를 가로지르지 않고");
if (cut < 0) throw new Error("lineAutoSelectCheck 머리부를 찾지 못함");
const body = `
// render.js 의 «선택 가능한 표시 선» 판정(요크/프린세스 모드 · 공유 함수)만 잘라 실행 — 실제 render 와 같은 함수.
{
  const RS = fs.readFileSync(path.join(ROOT, "js", "render.js"), "utf8");
  const j0 = RS.indexOf("function _yokeModeOf("), j1 = RS.indexOf("window.designLinePickable = _designLinePickable;");
  if (j0 < 0 || j1 < j0) throw new Error("render.js designLinePickable 구간을 찾지 못함");
  vm.runInContext(RS.slice(j0, j1) + "window.designLinePickable = _designLinePickable;", sb, { filename: "render.js(pickable)" });
}
projectOn("A");
const front0 = J(PROJECT.working.geometry);
const bb = DLy.bboxOf(PROJECT.working.geometry, "front");
const cx = (bb.minX + bb.maxX) / 2, y0 = bb.minY + 5;
// 조각 위쪽(빈 공간)으로 크게 볼록한 곡선: 중간점이 rect 밖 약 20cm.
const P0 = { x: cx - 5, y: y0 }, P1 = { x: cx + 5, y: y0 };
const C1 = { x: cx - 5, y: bb.minY - 30 }, C2 = { x: cx + 5, y: bb.minY - 30 };
const line = { id: "line-1", piece: "front", role: "guide", segments: [{ kind: "cubic", from: P0, c1: C1, c2: C2, to: P1 }] };
PROJECT.working.patternLines = [line];
const mid = { x: cx, y: 0.125 * P0.y + 0.375 * C1.y + 0.375 * C2.y + 0.125 * P1.y };
ok(mid.y < bb.minY - 15, "전제: 곡선 중간이 front 조각 밖 (" + mid.y.toFixed(1) + " < " + bb.minY + ")");
const OUT = { closest: () => null };                 // hit rect 밖 타깃
const outClick = (pc, g, extra) => { const e = evAt(pc, g, Object.assign({ target: OUT }, extra || {})); down(e); return e; };
sb.viewZ = 1;
DLT.toggleSelect();
ok(DLT.getMode() === "select", "선택 모드");
// §1
let e = outClick("front", mid); up(e);
ok(DLT.getSelectedId() === "line-1", "§1 rect 밖 곡선 중간 클릭 → 재선택");
// 선택 상태에서 외부 핸들 드래그 (핸들 c1 은 rect 밖)
const before = J(line.segments);
e = outClick("front", C1);
move(evAt("front", { x: C1.x - 3, y: C1.y - 2 }, { target: OUT })); up(evAt("front", { x: C1.x - 3, y: C1.y - 2 }, { target: OUT }));
ok(DLT.getSelectedId() === "line-1", "§1 핸들 드래그 후에도 선택 유지");
ok(Math.abs(line.segments[0].c1.x - (C1.x - 3)) < 1e-6 && Math.abs(line.segments[0].c1.y - (C1.y - 2)) < 1e-6, "§1 외부 핸들 c1 이 커서 위치로 이동");
ok(J(line.segments[0].c2) === J(C2) && J(line.segments[0].from) === J(P0), "§1 다른 점은 불변");
ok(lines().length === 1, "§1 새 점/선 추가 없음");
// 핸들 c2 도
const C2n = line.segments[0].c2;
e = outClick("front", C2n); move(evAt("front", { x: C2n.x + 4, y: C2n.y }, { target: OUT })); up(evAt("front", { x: C2n.x + 4, y: C2n.y }, { target: OUT }));
ok(Math.abs(line.segments[0].c2.x - (C2.x + 4)) < 1e-6, "§1 c2 핸들 드래그");
// 해제 후 재선택
key("Escape"); ok(DLT.getSelectedId() === null, "Esc 해제");
e = outClick("front", { x: line.segments[0].c1.x, y: line.segments[0].c1.y }); up(e);
ok(DLT.getSelectedId() === null, "§2 선택 해제 상태에서 핸들 위치 클릭 = 선 위가 아니면 선택 안 됨(핸들은 선택된 선만)");
const fm = (() => { const fl = DLT.flattenLine(line.segments); return fl[Math.floor(fl.length / 2)][0]; })();
e = outClick("front", fm); up(e);
ok(DLT.getSelectedId() === "line-1", "§1 해제 후 선 위(rect 밖) 재선택");
// §2 빈 공간
key("Escape");
e = outClick("front", { x: cx + 40, y: bb.minY - 20 }); up(e);
ok(DLT.getSelectedId() === null, "§2 빈 공간 클릭 = 선택 안 됨");
e = outClick("front", { x: fm.x + 3, y: fm.y }); up(e);
ok(DLT.getSelectedId() === null, "§2 선에서 먼 클릭(3cm) = 선택 안 됨");
ok(lines().length === 1, "§2 클릭이 점/선을 추가하지 않음");
// §3 줌별 px 허용폭 (1.0cm 떨어진 클릭: 줌 0.5 → 허용 1.4cm 선택, 줌 2 → 0.35cm 거부)
const near = { x: fm.x, y: fm.y };
// fm 은 flatten 점 → 가까운 선분 위의 점이므로 수직 오프셋은 선분 법선 방향이 아니라 근사. 법선 계산:
const fl = DLT.flattenLine(line.segments); let seg = fl[Math.floor(fl.length / 2)]; const dx = seg[1].x - seg[0].x, dy = seg[1].y - seg[0].y, L = Math.hypot(dx, dy);
const off1 = { x: seg[0].x - dy / L * 1.0, y: seg[0].y + dx / L * 1.0 };
sb.viewZ = 0.5; key("Escape"); e = outClick("front", off1); up(e);
ok(DLT.getSelectedId() === "line-1", "§3 줌 0.5: 1.0cm(=5px) 허용");
sb.viewZ = 2; key("Escape"); e = outClick("front", off1); up(e);
ok(DLT.getSelectedId() === null, "§3 줌 2: 1.0cm(=20px) 거부");
sb.viewZ = 1;
const mid2 = (() => { const f = DLT.flattenLine(line.segments); const m = f[Math.floor(f.length / 2)][0]; return { x: m.x, y: m.y }; })();
// §4 rect 피스 우선: back 에 선이 있고 클릭이 back rect 안(타깃 = back) — front 의 바깥 곡선과 겹쳐도 back 선이 우선
const bbb = DLy.bboxOf(PROJECT.working.geometry, "back");
const bl = { id: "line-2", piece: "back", role: "guide", segments: [{ kind: "line", from: { x: bbb.minX + 5, y: bbb.minY + 20 }, to: { x: bbb.minX + 15, y: bbb.minY + 20 } }] };
lines().push(bl);
key("Escape"); e = evAt("back", { x: bbb.minX + 10, y: bbb.minY + 20 }, { target: { closest: () => ({ getAttribute: () => "back" }) } }); down(e); up(e);
ok(DLT.getSelectedId() === "line-2", "§4 rect 안에서 잡히는 선(back)을 선택");
// rect 피스(back) 클릭이 back 에서 아무것도 못 잡고 front 곡선이 화면상 그 지점에 있으면 front 선택 (겹침: 표시 위치 우선)
//  → 재현: 배치를 겹치게
PROJECT.working.layout.back = { dx: PROJECT.working.layout.front.dx, dy: PROJECT.working.layout.front.dy };
key("Escape");
const onBackRect = { closest: () => ({ getAttribute: () => "back" }) };
e = evAt("front", mid2, { target: onBackRect }); down(e); up(e);
ok(DLT.getSelectedId() === "line-1", "§4 다른 조각 rect 위로 나온 front 곡선 = 표시 위치에서 선택(back 에 가까운 선 없음)");
// back 에도 같은 지점 가까운 선이 있으면 rect 피스(back) 우선
const bl2 = { id: "line-3", piece: "back", role: "guide", segments: [{ kind: "line", from: { x: mid2.x - 3, y: mid2.y }, to: { x: mid2.x + 3, y: mid2.y } }] };
lines().push(bl2); key("Escape");
e = evAt("front", mid2, { target: onBackRect }); down(e); up(e);
ok(DLT.getSelectedId() === "line-3", "§4 rect 피스에 가까운 선이 있으면 가로채지 않음");
lines().pop(); lines().pop(); PROJECT.working.layout.back = { dx: 0, dy: 5 };
// §5 모드 off / 다른 stage
DLT.setMode("off"); key("Escape");
const nBefore = lines().length;
e = outClick("front", mid2); up(e);
ok(DLT.getSelectedId() === null && lines().length === nBefore, "§5 off 모드: 무동작");
DLT.toggleSelect();
sb.window.isDesignStageActive = () => false;
key("Escape"); e = outClick("front", mid2); up(e);
ok(DLT.getSelectedId() === null, "§5 Design 이 아닌 stage: 선택 대상 아님");
sb.window.isDesignStageActive = () => true;
// §6 geometry 불변 · 선택만으로 선 데이터 불변
key("Escape"); const snap = J(line.segments); e = outClick("front", mid2); up(e);
ok(DLT.getSelectedId() === "line-1" && J(line.segments) === snap, "§6 선택만으로 선 데이터 불변");
ok(J(PROJECT.working.geometry) === front0, "§6 working geometry 불변");
ok(J(PROJECT.referenceGeometry) === REF_J, "§6 원형 reference 불변");
// §7 boundary 역할 선도 같은 경로 + 역할 잠금(managed) 그대로
line.role = "boundary"; key("Escape"); e = outClick("front", mid2); up(e);
ok(DLT.getSelectedId() === "line-1", "§7 boundary 역할 선도 rect 밖에서 재선택");
// §8 숨긴 선은 보정 대상 아님(Codex 검토 2026-11-07) — render 와 같은 판정(designLinePickable)
line.role = "guide";
let G0 = PROJECT.working.geometry;
const withMode = extra => { PROJECT.working.geometry = Object.assign({}, G0, extra); };
key("Escape");
withMode({ frontBody: {}, backBody: {}, frontYoke: {}, backYoke: {} });
e = outClick("front", mid2); up(e);
ok(DLT.getSelectedId() === null, "§8 요크 모드(패턴선 미표시): 좌표가 맞아도 rect 밖 선택 안 됨");
withMode({ frontCenter: {}, frontSide: {}, backCenter: {}, backSide: {} });
e = outClick("front", mid2); up(e);
ok(DLT.getSelectedId() === null, "§8 프린세스 모드: rect 밖 선택 안 됨");
PROJECT.working.geometry = G0;
e = outClick("front", mid2); up(e);
ok(DLT.getSelectedId() === "line-1", "§8 대조: 일반 모드로 돌아오면 다시 선택");
// 선택된 선의 외부 핸들도 표시 상태일 때만
const c1Before = J(line.segments[0].c1);
withMode({ frontBody: {}, backBody: {}, shoulderYoke: {} });
e = outClick("front", line.segments[0].c1); move(evAt("front", { x: line.segments[0].c1.x + 5, y: line.segments[0].c1.y }, { target: OUT })); up(evAt("front", { x: line.segments[0].c1.x + 5, y: line.segments[0].c1.y }, { target: OUT }));
ok(J(line.segments[0].c1) === c1Before, "§8 요크(Ⓤ) 모드: 선택선 외부 핸들도 잡히지 않음");
PROJECT.working.geometry = G0;
ok(J(PROJECT.working.geometry) === front0, "§8 모드 흉내 뒤 geometry 원복");
// 소매: 소매 rect 밖 사용자 선 — 소매 있음 = 선택 · 소매 없음(사라진 소매) = 선택 안 됨 · 관리선(sleeve-cap) = 보정 대상 아님
ok(API("A").apply(PROJECT, defaultsOf("A")).ok, "전제: 소매 Ⓐ 적용"); G0 = PROJECT.working.geometry; const G1J = J(G0), NL1 = lines().length;
const sbb = DLy.bboxOf(G0, "sleeve");
ok(!!sbb, "전제: 소매 geometry 있음");
const sp = { x: (sbb.minX + sbb.maxX) / 2, y: sbb.maxY + 12 };
const sl = { id: "line-9", piece: "sleeve", role: "guide", segments: [{ kind: "line", from: { x: sp.x - 4, y: sp.y }, to: { x: sp.x + 4, y: sp.y } }] };
lines().push(sl); key("Escape");
e = outClick("sleeve", sp); up(e);
ok(DLT.getSelectedId() === "line-9", "§8 소매 rect 밖 사용자 선 = 선택(소매 있음)");
key("Escape");
withMode({ sleeve: null });
e = outClick("sleeve", sp); up(e);
ok(DLT.getSelectedId() === null, "§8 소매 geometry 없음(사라진 소매): 옛 소매 선 선택 안 됨");
PROJECT.working.geometry = G0;
sl.managedBy = "sleeve-cap"; key("Escape");
e = outClick("sleeve", sp); up(e);
ok(DLT.getSelectedId() === null, "§8 관리선(소매산)은 rect 밖 보정 대상 아님(종전 rect 규칙)");
// 관리선이 더 가까워도 보정 피스에서는 비관리 사용자 선만 고른다
delete sl.managedBy; const sm = { id: "line-10", piece: "sleeve", role: "guide", managedBy: "sleeve-cap", segments: [{ kind: "line", from: { x: sp.x - 4, y: sp.y + 0.2 }, to: { x: sp.x + 4, y: sp.y + 0.2 } }] };
lines().push(sm); key("Escape");
e = outClick("sleeve", { x: sp.x, y: sp.y + 0.25 }); up(e);
ok(DLT.getSelectedId() === "line-9", "§8 보정 피스에서 관리선 대신 표시 사용자 선 선택");
lines().pop(); lines().pop(); key("Escape");
// render 가 같은 판정 함수를 쓰는지(표시 ⇔ 선택 가능 일치)
const RSRC2 = fs.readFileSync(path.join(ROOT, "js", "render.js"), "utf8");
ok(RSRC2.includes("if (_designPatternLinesShown(dp.working.geometry)) _appendPatternLines(grp"), "§8 render 패턴선 그리기 = 같은 _designPatternLinesShown");
ok(J(PROJECT.working.geometry) === G1J && lines().length === NL1, "§8 끝: geometry 불변 · 선 수 원복");
console.log("lineOutsideHitCheck: " + PASS + " pass, " + FAIL + " fail");
if (FAIL) { console.log(fails.join("\\n")); process.exit(1); }
`;
const prefix = src.slice(0, cut);
new Function("require", "__dirname", "process", prefix + body)(require, __dirname, process);
