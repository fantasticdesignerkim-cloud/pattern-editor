// ══════════════════════════════════════════════
// bodiceCheckpointCheck.js — js/bodiceCheckpoint.js 검사·스냅샷·스테일 판정 회귀.
// 실제 모듈을 vm 으로 실행하고, designWorkflow/designLineTool 은 스텁으로 최소 제공한다
// (진동/옆선/목둘레 측정과 완료 게이트·불변 스냅샷·스테일 비교가 대상).
//   node test/harness/bodiceCheckpointCheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const { addSideWaistC } = require("./sideWaistFixture");
const path = require("path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "..", "js", "bodiceCheckpoint.js"), "utf8");
let PASS = 0, FAIL = 0; const fails = [];
function ok(cond, name) { if (cond) PASS++; else { FAIL++; fails.push(name); } }
const near = (a, b, e = 1e-3) => Math.abs(a - b) < e;

// 스텁 상태
let RING_OK = true;
const sandbox = { window: {}, Math, JSON, Object, Array, isFinite, Date };
sandbox.window.designLineTool = { buildPieceRing: () => ({ ok: RING_OK }) };
let PROJECT = null;
sandbox.window.designWorkflow = { current: () => PROJECT };
vm.createContext(sandbox);
vm.runInContext(SRC, sandbox, { filename: "bodiceCheckpoint.js" });
const BC = sandbox.window.bodiceCheckpoint;

const cpath = (a, b, c, d) => ({ kind: "path", commands: [{ type: "M", points: [{ x: a[0], y: a[1] }] }, { type: "C", points: [{ x: b[0], y: b[1] }, { x: c[0], y: c[1] }, { x: d[0], y: d[1] }] }] });
const line = (a, b, edge) => { const s = { kind: "line", from: { x: a[0], y: a[1] }, to: { x: b[0], y: b[1] } }; if (edge) s.edge = edge; return s; };
// piece: center(top y=3/0) + side-seam(길이 지정) + neckline(목점 접 곡선) + shoulder(직선) + armhole(곡선, 목점 미접)
function piece(cx, topY, sideTopY, sideBotY) {
  return {
    outline: [
      line([cx, topY], [cx, sideBotY], "center"),
      line([cx - 24, sideTopY], [cx - 24, sideBotY], "side-seam"),
      cpath([cx, topY], [cx - 3, topY - 2], [cx - 6, topY - 6], [cx - 7, topY - 7]),      // neckline(목점 접)
      line([cx - 7, topY - 7], [cx - 18, topY - 3]),                                       // shoulder(직선)
      cpath([cx - 18, topY - 3], [cx - 22, sideTopY - 8], [cx - 24, sideTopY - 3], [cx - 24, sideTopY]) // armhole(곡선, 목점 미접)
    ],
    construction: [line([cx - 4, 20], [cx - 2, sideBotY])]
  };
}
// P0.3a: v5 fixture — 의미 모서리 primitive 마다 생산자 선언 root 경계 identity 를 붙인다.
function withIds(p, prefix) {
  p.outline.forEach(pr => {
    if (!pr.edge) return;
    const n = pr.kind === "path" ? pr.commands.filter(c => c.type === "C").length : 1;
    pr.boundary = { root: prefix + "/" + pr.edge, ranges: Array.from({ length: n }, (_, k) => [k / n, (k + 1) / n]) };
  });
  return p;
}
function fakeProject(backSideTopY, opts) {
  opts = opts || {};
  return {
    sourceBlock: { version: 2 },
    working: {
      geometry: { front: piece(47.5, 3, 20, 38), back: piece(0 + 24, 0, backSideTopY, 38), shared: { construction: [] }, sleeve: { outline: [], construction: [] } },
      parameters: { neckline: opts.neckline || { mode: "parametric", type: "round", parameters: {} } },
      designOutline: opts.designOutline || null,
      frontPlacket: opts.frontPlacket || null,
      patternLines: opts.patternLines || []
    }
  };
}

// 1. 정합(옆선 차 ≤0.1) → 완료 가능, 진동·목둘레 측정
{
  RING_OK = true; PROJECT = fakeProject(20);   // 앞 side 18(20→38) · 뒤 side 18 → diff 0
  const c = BC.check();
  ok(c.ok && c.sideSeam.status === "match" && near(c.sideSeam.diff, 0), "1: 옆선 정합(diff 0)");
  ok(c.armhole.ok && c.armhole.front > 0 && c.armhole.back > 0, "1: 진동둘레 앞·뒤 측정");
  ok(c.neckline.ok && c.neckline.half > 0 && near(c.neckline.finished, 2 * c.neckline.half), "1: 목둘레 반패턴·완성(×2)");
}
// 2. 확인(0.1<diff≤0.3) → 완료 가능
{
  PROJECT = fakeProject(20.2);   // 뒤 side 17.8 → diff 0.2
  const c = BC.check();
  ok(c.sideSeam.status === "check" && c.ok, "2: 옆선 확인(0.2) → 완료 가능");
}
// 3. 불일치(diff>0.3) → 완료 차단
{
  PROJECT = fakeProject(20.5);   // 뒤 side 17.5 → diff 0.5
  const c = BC.check();
  ok(c.sideSeam.status === "mismatch" && !c.ok && c.fails.indexOf("side-seam-mismatch") >= 0, "3: 옆선 불일치(0.5) → 차단");
  const r = BC.complete();
  ok(!r.ok && r.reason === "side-seam-mismatch" && !PROJECT.working.bodiceResult, "3: complete 거부 · bodiceResult 없음");
}
// 4. 외곽 미연결 → 차단
{
  RING_OK = false; PROJECT = fakeProject(20);
  const c = BC.check();
  ok(!c.ok && c.fails.indexOf("front-outline-not-connected") >= 0, "4: 외곽 미연결 → 차단");
  RING_OK = true;
}
// 5. manual 인데 designOutline 없음 → preview 무효 차단
{
  PROJECT = fakeProject(20, { neckline: { mode: "manual", type: "v", parameters: {}, boundaryLineIds: { front: "l1", back: "l2" } }, designOutline: null });
  const c = BC.check();
  ok(!c.ok && c.fails.indexOf("neckline-preview-invalid") >= 0, "5: manual+designOutline null → 차단");
}
// 6. 완료 → 불변 스냅샷(spec 필드 + 진동 primitive + hash) + reference 무관
{
  RING_OK = true; PROJECT = fakeProject(20);
  const r = BC.complete();
  ok(r.ok, "6: 완료 성공");
  const res = PROJECT.working.bodiceResult;
  ok(res && res.sourceVersion === 2 && res.front && res.back && res.armholeLengths && res.necklineLengths && typeof res.completedAt === "number", "6: bodiceResult spec 필드");
  ok(Object.isFrozen(res) && Object.isFrozen(res.front) && Object.isFrozen(res.armholeLengths) && Object.isFrozen(res.armhole), "6: deepFrozen");
  ok(res.placket === null, "6: placket 없으면 null");
  ok(res.necklineProfile && res.necklineProfile.type === "round" && res.necklineProfile.mode === "parametric",
    "6: 완료 형상과 정렬된 목선 profile 보존");
  ok(BC.latest() === res, "6: latest = bodiceResult");
  // 항목 1: 진동선 primitive 자체 저장(길이값 아님). 앞 곡선 ≥1개.
  ok(res.armhole && Array.isArray(res.armhole.front) && res.armhole.front.length >= 1 && res.armhole.back.length >= 1, "6: armhole primitive 저장(front/back segs)");
  ok(res.armhole.front[0].kind === "cubic" || res.armhole.front[0].kind === "path", "6: armhole = 곡선 primitive");
  // 항목 2: 소매가 참조할 hash 기록
  ok(typeof res.hash === "string" && res.hash.length > 0, "6: sourceBodiceHash 앵커(hash)");
}
// 7. 스테일: 완료 직후 unchanged, 몸판 형상 변경 시 changed
{
  PROJECT = fakeProject(20);
  BC.complete();
  ok(BC.isCurrentBodiceChanged() === false, "7: 완료 직후 unchanged");
  PROJECT.working.geometry.front.outline[1].to.y = 40;   // 옆선 이동(외곽 변경)
  ok(BC.isCurrentBodiceChanged() === true, "7: 외곽 변경 → changed");
}
// 7b. 항목 3: 스테일은 형상 전용 — 배치 offset·선택 상태·guide 선은 제외
{
  PROJECT = fakeProject(20);
  BC.complete();
  ok(BC.isCurrentBodiceChanged() === false, "7b: 기준 unchanged");
  PROJECT.working.layout = { front: { dx: 99, dy: -40 }, back: { dx: 12, dy: 5 } };   // 배치 offset
  ok(BC.isCurrentBodiceChanged() === false, "7b: 배치 offset 변경 → 여전히 unchanged(형상 무관)");
  PROJECT.working.patternLines.push({ id: "g1", piece: "front", role: "guide", segments: [{ kind: "line", from: { x: 5, y: 5 }, to: { x: 8, y: 9 } }] });
  ok(BC.isCurrentBodiceChanged() === false, "7b: guide 선 추가 → 여전히 unchanged(외곽 무관)");
  PROJECT.working.selectedId = "g1";   // 선택 상태(세션 UI)
  ok(BC.isCurrentBodiceChanged() === false, "7b: 선택 상태 변경 → 여전히 unchanged");
}
// 8. 완료본 없으면 isCurrentBodiceChanged=true
{
  PROJECT = fakeProject(20);
  ok(BC.isCurrentBodiceChanged() === true, "8: 완료본 없음 → changed(true)");
}
// 9. placket 포함 완료 → 스냅샷에 placket 복사(파라미터)
{
  PROJECT = fakeProject(20, { frontPlacket: { parameters: { overlapCm: 1.75, facingWidthCm: 4, lengthMode: "full" }, outline: [], construction: [] } });
  const r = BC.complete();
  ok(r.ok && r.result.placket && r.result.placket.parameters.overlapCm === 1.75, "9: placket 스냅샷 복사");
  // 여밈 파라미터 변경 → changed
  PROJECT.working.frontPlacket.parameters.overlapCm = 2.5;
  ok(BC.isCurrentBodiceChanged() === true, "9: 여밈 파라미터 변경 → changed");
}

// ══════════════════════════════════════════════
// 10(SV3). 봉제 경계 의미(neckline/shoulder/armhole)를 실어도 **기존 측정 경로가 고르는
//   구간·값·hash 가 그대로**여야 한다. semantic 으로 측정을 교체하지 않았음을 회귀로 고정한다
//   (실제 교체는 Phase 1 canonical 측정 승인 이후).
// ══════════════════════════════════════════════
{
  // 같은 fixture 에 v3 role 만 부여한 쌍을 만든다(좌표·개수·순서 동일, 메타만 추가).
  const tagSeamRoles = (proj) => {
    ["front", "back"].forEach(pc => {
      const o = proj.working.geometry[pc].outline;
      o.forEach(s => {
        if ("edge" in s) return;                       // center/side-seam 은 그대로
        if (s.kind === "line") s.edge = "shoulder";    // 직선 = 어깨
        else s.edge = (s === o[2]) ? "neckline" : "armhole";   // [2]=목선 곡선, 나머지 곡선=진동
      });
    });
    return proj;
  };

  RING_OK = true;
  PROJECT = fakeProject(20);
  const plain = BC.check();
  const plainRes = BC.complete();

  PROJECT = tagSeamRoles(fakeProject(20));
  const tagged = BC.check();
  const taggedRes = BC.complete();

  // (a) role 부여가 실제로 됐는지(대조군이 유효한 테스트인지) 확인
  const roles = PROJECT.working.geometry.front.outline.map(s => s.edge).sort();
  ok(JSON.stringify(roles) === JSON.stringify(["armhole", "center", "neckline", "shoulder", "side-seam"]),
    "10: 대조군에 v3 role 부여됨");

  // (b) 진동 휴리스틱이 **같은 세그먼트를 고르고 같은 길이**를 낸다
  ok(near(plain.armhole.front, tagged.armhole.front, 1e-12) &&
     near(plain.armhole.back, tagged.armhole.back, 1e-12), "10: 진동둘레 reported 값 불변");
  ok(plain.armhole.ok === tagged.armhole.ok, "10: 진동 측정 가능 여부 불변");
  // 선택 구간 자체(저장된 armhole primitive)가 동일해야 한다 = semantic span ↔ 휴리스틱 선택 일치
  const stripEdge = (v) => JSON.stringify(v, (k, x) => k === "edge" ? undefined : x);
  ok(stripEdge(plainRes.result.armhole) === stripEdge(taggedRes.result.armhole),
    "10: 휴리스틱이 고른 진동 구간 == semantic armhole span");
  ok(taggedRes.result.armhole.front.every(s => s.edge === "armhole") &&
     taggedRes.result.armhole.back.every(s => s.edge === "armhole"),
    "10: 선택된 구간이 실제로 armhole role 을 갖는다(동일성 확인)");

  // (c) 목둘레·옆선 reported 값 불변
  ok(near(plain.neckline.front, tagged.neckline.front, 1e-12) &&
     near(plain.neckline.back, tagged.neckline.back, 1e-12) &&
     near(plain.neckline.half, tagged.neckline.half, 1e-12), "10: 목둘레 reported 값 불변");
  ok(near(plain.sideSeam.front, tagged.sideSeam.front, 1e-12) &&
     near(plain.sideSeam.back, tagged.sideSeam.back, 1e-12), "10: 옆선 reported 값 불변");

  // (d) 완료본 hash 불변 — hash signature 에 metadata 가 들어가지 않는다
  ok(plainRes.ok && taggedRes.ok, "10: 양쪽 완료 성공");
  ok(plainRes.result.hash === taggedRes.result.hash, "10: bodiceResult.hash 불변(metadata 미포함)");
  ok(JSON.stringify(plainRes.result.armholeLengths) === JSON.stringify(taggedRes.result.armholeLengths) &&
     JSON.stringify(plainRes.result.necklineLengths) === JSON.stringify(taggedRes.result.necklineLengths),
    "10: 저장된 reported 길이 불변");

  // (e) 스테일 판정도 metadata 에 반응하지 않는다(형상 동일 → 변경 아님)
  ok(BC.isCurrentBodiceChanged() === false, "10: role 부여 상태에서 스테일 아님");

  // (f) 원본 fixture 에 role 이 없어도(legacy) 측정은 그대로 동작한다
  PROJECT = fakeProject(20);
  ok(BC.check().armhole.ok, "10: legacy(무-role) 입력도 기존대로 측정");
}

// ══════════════════════════════════════════════
// 11(P0.1 보완). 편집 후 semantic readiness — **복수 원인 보존**.
//   상호 배타적 단일 status 를 쓰지 않는다: legacy / unresolved / missing 은 동시에 성립할 수 있다.
//   ready=true 는 issues 가 비었을 때만이며, summary 가 issues 를 덮거나 하나만 고르지 않는다.
// ══════════════════════════════════════════════
{
  // v3 형태 piece: 필수 role 5종(neckline/shoulder/armhole/center/side-seam) 부여.
  //   waist/hem 은 필수가 아니므로 픽스처에도 넣지 않는다(무조건 요구하지 않음을 함께 고정).
  const taggedPiece = (cx, topY, sideTopY, sideBotY) => {
    const p = piece(cx, topY, sideTopY, sideBotY);
    p.outline[2].edge = "neckline"; p.outline[3].edge = "shoulder"; p.outline[4].edge = "armhole";
    return p;
  };
  const mkProject = (opts) => {
    opts = opts || {};
    const proj = fakeProject(20);
    proj.sourceBlock = { version: 1, schemaVersion: opts.schemaVersion };
    if (opts.tagged !== false) {
      proj.working.geometry.front = taggedPiece(47.5, 3, 20, 38);
      proj.working.geometry.back = taggedPiece(24, 0, 20, 38);
      if (opts.schemaVersion >= 5) { withIds(proj.working.geometry.front, "front"); withIds(proj.working.geometry.back, "back"); }
      if (opts.schemaVersion === 8) addSideWaistC(proj.working.geometry);   // v8 계약: c 반쪽(옳은 fixture)
    }
    if (opts.designOutline) proj.working.designOutline = opts.designOutline;
    return proj;
  };
  // 유효 외곽을 designOutline 으로 대체(= manual 경로). replacement 구간의 표식을 직접 지정.
  const withOutline = (proj, frontOutline) => {
    proj.working.designOutline = { front: { outline: frontOutline }, back: { outline: proj.working.geometry.back.outline } };
    return proj;
  };
  const sem = (proj) => { PROJECT = proj; return BC.check().semantics; };
  const has = (r, code) => r.issues.indexOf(code) >= 0;

  RING_OK = true;

  // (a) 손대지 않은 v3 → ready=true, issues 없음
  {
    const r = sem(mkProject({ schemaVersion: 8 }));
    ok(r.ready === true && r.issues.length === 0, "11a: untouched v8 → ready, issues 없음");
    ok(r.sourceSchemaVersion === 8 && r.unresolved.length === 0 && r.missing.length === 0, "11a: 목록 비어있음");
  }

  // (b) v2 source → legacy-source issue, ready=false (role 은 그대로 있어도)
  {
    const r = sem(mkProject({ schemaVersion: 2 }));
    ok(r.ready === false && has(r, "legacy-source"), "11b: v2 → legacy-source");
    ok(!has(r, "missing-required-role"), "11b: v2 의 role 부재를 metadata 오류로 오인하지 않음");
  }

  // (c) v3 + 일반 replacement → 명시 unresolved + provenance, ready=false
  {
    const base = mkProject({ schemaVersion: 8 });
    const fo = base.working.geometry.front.outline.map(x => JSON.parse(JSON.stringify(x)));
    fo.push({ kind: "line", from: { x: 1, y: 1 }, to: { x: 2, y: 2 }, edgeStatus: "unresolved", edgeSourceLineId: "line-8" });
    const r = sem(withOutline(base, fo));
    ok(r.ready === false && has(r, "unresolved-replacement"), "11c: generic replacement → unresolved-replacement");
    ok(r.unresolved.length === 1 && r.unresolved[0].piece === "front" && r.unresolved[0].lineId === "line-8",
      "11c: lineId provenance 보존");
    ok(!has(r, "legacy-source") && !has(r, "missing-required-role"), "11c: 다른 원인으로 번지지 않음");
    // 유지 구간의 role 은 그대로 → missing 없음
    ok(r.missing.length === 0, "11c: 유지 구간 role 보존(missing 없음)");
  }

  // (d) v2 + unresolved replacement → **두 issue 동시 보존**
  {
    const base = mkProject({ schemaVersion: 2 });
    const fo = base.working.geometry.front.outline.map(x => JSON.parse(JSON.stringify(x)));
    fo.push({ kind: "line", from: { x: 1, y: 1 }, to: { x: 2, y: 2 }, edgeStatus: "unresolved", edgeSourceLineId: "line-9" });
    const r = sem(withOutline(base, fo));
    ok(has(r, "legacy-source") && has(r, "unresolved-replacement"), "11d: legacy 와 unresolved 가 동시에 보존");
    ok(r.unresolved[0].lineId === "line-9", "11d: 동시 상황에서도 provenance 유지");
    ok(r.issues.length === 2 && r.ready === false, "11d: summary 가 issues 를 하나로 덮지 않음");
  }

  // (e) v3 metadata 전달 오류(표식 없이 필수 role 소실) → missing-required-role
  {
    const base = mkProject({ schemaVersion: 8 });
    const fo = base.working.geometry.front.outline
      .map(x => JSON.parse(JSON.stringify(x)))
      .filter(x => x.edge !== "shoulder");            // 표식 없이 사라짐 = 전달 버그
    const r = sem(withOutline(base, fo));
    ok(has(r, "missing-required-role"), "11e: 무표식 role 소실 → missing-required-role");
    ok(!has(r, "unresolved-replacement"), "11e: 의도된 unresolved 와 구분됨");
    ok(r.missing.some(m => m.piece === "front" && m.role === "shoulder"), "11e: 어떤 role 이 빠졌는지 보존");
  }

  // (f) v3 + unresolved replacement 가 필수 role 을 삼킨 경우
  //     → provenance·missing 증거를 잃지 않고, 무표식 유실(missing-required-role)로 오분류하지 않는다
  {
    const base = mkProject({ schemaVersion: 8 });
    const fo = base.working.geometry.front.outline
      .map(x => JSON.parse(JSON.stringify(x)))
      .filter(x => x.edge !== "shoulder");
    fo.push({ kind: "line", from: { x: 1, y: 1 }, to: { x: 2, y: 2 }, edgeStatus: "unresolved", edgeSourceLineId: "line-10" });
    const r = sem(withOutline(base, fo));
    ok(has(r, "unresolved-replacement"), "11f: unresolved issue 유지");
    ok(r.unresolved[0].lineId === "line-10", "11f: provenance 유실 없음");
    ok(r.missing.some(m => m.role === "shoulder"), "11f: 사라진 필수 role 증거 유지");
    ok(!has(r, "missing-required-role"), "11f: unresolved 로 설명되는 유실은 전달 버그로 오분류하지 않음");
  }

  // (g) 평가 대상이 아닌 primitive(다트 다리·구성선)를 unresolved 로 오인하지 않는다
  {
    const base = mkProject({ schemaVersion: 8 });
    ok(base.working.geometry.front.construction.length > 0, "11g: construction 더미 다트 존재");
    const r = sem(base);
    ok(r.unresolved.length === 0 && r.ready === true, "11g: role 없는 construction 을 unresolved 로 세지 않음");
  }

  // (h) 완료 스냅샷에 보존 + deepFreeze + 공유 참조 없음 + 결정론
  {
    const base = mkProject({ schemaVersion: 8 });
    const fo = base.working.geometry.front.outline.map(x => JSON.parse(JSON.stringify(x)));
    fo.push({ kind: "line", from: { x: 1, y: 1 }, to: { x: 2, y: 2 }, edgeStatus: "unresolved", edgeSourceLineId: "line-11" });
    PROJECT = withOutline(base, fo);
    const res = BC.complete();
    ok(res.ok, "11h: readiness 는 완료를 막지 않는다(증거만)");
    const sm = res.result.semantics;
    ok(sm && sm.ready === false && sm.issues.indexOf("unresolved-replacement") >= 0, "11h: 스냅샷에 readiness 보존");
    ok(Object.isFrozen(sm) && Object.isFrozen(sm.issues) && Object.isFrozen(sm.unresolved[0]), "11h: 중첩까지 deepFrozen");
    // 공유 참조 없음: 두 번 평가한 결과가 서로 다른 객체
    const a = BC.evaluateSemantics(PROJECT), b = BC.evaluateSemantics(PROJECT);
    ok(a !== b && a.issues !== b.issues && a.unresolved !== b.unresolved, "11h: 매 호출 새 객체(공유 참조 없음)");
    ok(JSON.stringify(a) === JSON.stringify(b), "11h: 결정론");
    ok(a.unresolved[0] !== sm.unresolved[0], "11h: 스냅샷과 새 평가가 참조를 공유하지 않음");
  }

  // (i) readiness 는 hash·reported 값에 영향을 주지 않는다
  {
    const clean = mkProject({ schemaVersion: 8 });
    PROJECT = clean; const r1 = BC.complete();
    const withFlag = mkProject({ schemaVersion: 8 });
    const fo = withFlag.working.geometry.front.outline.map(x => JSON.parse(JSON.stringify(x)));
    PROJECT = withOutline(withFlag, fo); const r2 = BC.complete();
    ok(r1.result.hash === r2.result.hash, "11i: readiness 필드가 hash 에 영향 없음");
    ok(JSON.stringify(r1.result.armholeLengths) === JSON.stringify(r2.result.armholeLengths) &&
       JSON.stringify(r1.result.necklineLengths) === JSON.stringify(r2.result.necklineLengths), "11i: reported 값 불변");
  }
}

// ══════════════════════════════════════════════
// 12(P0.2). 구조화 다트 의미 — 선언 기반 레코드 · 다중 다트 · fingerprint · replacement 차단.
// ══════════════════════════════════════════════
{
  const dleg = (a, b2, id, boundary, apexAt, onFold) => {
    const o = line(a, b2); o.dart = { id, boundary, apexAt }; if (onFold) o.dart.onFold = true; return o;
  };
  // 필수 role 을 갖춘 v4 piece + 다트 다리(construction).
  const v4piece = (cx, topY, sideTopY, sideBotY) => {
    const p = piece(cx, topY, sideTopY, sideBotY);
    p.outline[2].edge = "neckline"; p.outline[3].edge = "shoulder"; p.outline[4].edge = "armhole";
    return p;
  };
  const mk = (sv, darts, opts) => {
    const proj = fakeProject(20);
    proj.sourceBlock = { version: 1, schemaVersion: sv };
    proj.working.geometry.front = v4piece(47.5, 3, 20, 38);
    proj.working.geometry.back = v4piece(24, 0, 20, 38);
    if (sv >= 5) { withIds(proj.working.geometry.front, "front"); withIds(proj.working.geometry.back, "back"); }
    proj.working.geometry.shared = { outline: [], construction: [] };
    proj.working.geometry.front.construction = JSON.parse(JSON.stringify(darts || []));   // 호출자 입력 비변형(ref·attach·c 반쪽이 새지 않게)
    // P0.3b(v6): 이 절은 P0.2 다트 레코드 검사다. fixture 생산자가 각 다리의 경계 끝에서 시작하는 짧은
    //   기준 경계 구간(construction, root=front/<boundary>, t 0→1)을 함께 두고, 다리를 그 t=0 에 붙인다 —
    //   선언 {root,t} 가 실제 점과 일치하는 정합 fixture(attachment 세부 검사는 dartAttachmentCheck).
    if (sv >= 6 && !(opts && opts.refs === false)) proj.working.geometry.front.construction.slice().forEach(l => {
      if (!l.dart || l.dart.attach || !l.dart.boundary) return;
      const e = l.dart.apexAt === "from" ? l.to : l.from;
      const ref = line([e.x, e.y], [e.x + 1, e.y], l.dart.boundary);
      ref.boundary = { root: "front/" + l.dart.boundary, ranges: [[0, 1]] };
      proj.working.geometry.front.construction.push(ref);
      l.dart.attach = { root: "front/" + l.dart.boundary, t: 0 };
    });
    if (sv === 8) addSideWaistC(proj.working.geometry);   // v8 계약: c 반쪽(옳은 fixture)
    return proj;
  };
  // 이 절은 일반 다트 레코드 검사다 — v8 fixture 의 c 반쪽 record 는 별도(sideWaistDart)로 검증하므로 목록에서 뺀다.
  const semOf = (proj) => { PROJECT = proj; const r = BC.check().semantics;
    const nc = (a) => a.filter(d => d.group !== "side-waist-c");
    return Object.assign({}, r, { darts: Object.assign({}, r.darts, { front: nc(r.darts.front), back: nc(r.darts.back) }) }); };
  RING_OK = true;

  // (a) apex 공유 2다리 → 완전한 레코드(apex·legs·intake·boundary 모두 선언 기반)
  {
    const darts = [dleg([40, 20], [44, 38], "front-waist-a", "armhole", "from"),
                   dleg([48, 20], [44, 38], "front-waist-a", "armhole", "from")];
    // apexAt "from" → 첫 끝점이 apex. 두 다리의 apex 가 달라 불완전해야 한다(대조).
    const bad = semOf(mk(8, darts));
    ok(bad.issues.indexOf("dart-semantics-incomplete") >= 0, "12a: apex 불일치 → 불완전 선언 감지");
  }
  {
    // 올바른 선언: apex=(44,38) 공유, leg=(40,20)·(48,20)
    const darts = [dleg([40, 20], [44, 38], "front-waist-a", "armhole", "to"),
                   dleg([48, 20], [44, 38], "front-waist-a", "armhole", "to")];
    const r = semOf(mk(8, darts));
    const d = r.darts.front[0];
    ok(r.darts.front.length === 1 && d.id === "front-waist-a", "12b: 다트 레코드 생성");
    ok(d.apex.x === 44 && d.apex.y === 38, "12b: apex 는 선언된 끝점");
    ok(d.legs.length === 2 && d.intakeCm === 8, "12b: 두 leg endpoint + intake(=8)");
    ok(d.boundary === "armhole" && d.complete === true, "12b: target boundary 선언 + complete");
    ok(r.ready === true && r.issues.length === 0, "12b: v8 + 완전 다트 → ready");
  }

  // (c) 한 파트 다중 다트 — ID 충돌 없음
  {
    const darts = [dleg([40, 20], [44, 38], "front-waist-a", "armhole", "to"),
                   dleg([48, 20], [44, 38], "front-waist-a", "armhole", "to"),
                   dleg([30, 22], [33, 38], "front-waist-b", "shoulder", "to"),
                   dleg([36, 22], [33, 38], "front-waist-b", "shoulder", "to")];
    const r = semOf(mk(8, darts));
    ok(r.darts.front.length === 2, "12c: 한 파트 다중 다트 지원");
    ok(r.darts.front.map(d => d.id).join(",") === "front-waist-a,front-waist-b", "12c: ID 비충돌·결정론 정렬");
    ok(r.ready === true, "12c: 다중 다트 모두 완전 → ready");
  }

  // (d) 접어재단 반쪽 다트 — 다리 1개, intake 는 **지어내지 않고 null**
  {
    const darts = [dleg([48, 20], [44, 38], "back-waist-f", "armhole", "to", true)];
    const r = semOf(mk(8, darts));
    const d = r.darts.front[0];
    ok(d.onFold === true && d.legCount === 1 && d.intakeCm === null, "12d: onFold 반쪽 다트 intake=null");
    ok(d.complete === true && r.ready === true, "12d: 반쪽 다트도 완전으로 인정");
  }

  // (e) manual replacement 가 다트 target boundary 를 끊으면 complete 로 두지 않는다
  {
    const darts = [dleg([40, 20], [44, 38], "front-bust", "armhole", "to"),
                   dleg([48, 20], [44, 38], "front-bust", "armhole", "to")];
    const base = mk(8, darts, { refs: false });   // 기준 경계 fixture 없이 — 경계 끊김만 본다
    // armhole role 을 유효 외곽에서 제거(대체선이 진동 구간을 삼킨 상황)
    const fo = base.working.geometry.front.outline.filter(x => x.edge !== "armhole")
      .concat([{ kind: "line", from: { x: 1, y: 1 }, to: { x: 2, y: 2 }, edgeStatus: "unresolved", edgeSourceLineId: "line-5" }]);
    base.working.designOutline = { front: { outline: fo }, back: { outline: base.working.geometry.back.outline } };
    const r = semOf(base);
    ok(r.issues.indexOf("dart-boundary-missing") >= 0, "12e: 다트 경계 끊김 → dart-boundary-missing");
    ok(r.ready === false, "12e: complete 로 남지 않음");
    ok(r.unresolved[0].lineId === "line-5", "12e: replacement provenance 동시 보존");
  }

  // (f) legacy(v2/v3) 는 다트 의미를 만들어 넣지 않는다
  {
    [2, 3].forEach(sv => {
      const r = semOf(mk(sv, []));
      ok(r.issues.indexOf("legacy-source") >= 0 && r.ready === false, "12f: v" + sv + " legacy-source");
      ok(r.darts.front.length === 0, "12f: v" + sv + " 다트 의미 조작 없음");
    });
  }

  // (g) semantic fingerprint — 의미만 바뀌어도 바뀌고, 기존 형상 hash 는 불변
  {
    const d1 = [dleg([40, 20], [44, 38], "front-waist-a", "armhole", "to"),
                dleg([48, 20], [44, 38], "front-waist-a", "armhole", "to")];
    const p1 = mk(8, d1); PROJECT = p1; const r1 = BC.complete();
    // 좌표·개수·순서 동일, **boundary 선언만** 변경
    const d2 = [dleg([40, 20], [44, 38], "front-waist-a", "shoulder", "to"),
                dleg([48, 20], [44, 38], "front-waist-a", "shoulder", "to")];
    const p2 = mk(8, d2); PROJECT = p2; const r2 = BC.complete();
    ok(r1.result.hash === r2.result.hash, "12g: 의미 변경이 기존 형상 hash 를 바꾸지 않음");
    ok(r1.result.semantics.fingerprint !== r2.result.semantics.fingerprint, "12g: 의미만 바뀌면 fingerprint 변경");
    ok(JSON.stringify(r1.result.armholeLengths) === JSON.stringify(r2.result.armholeLengths), "12g: reported 불변");
    // 결정론
    ok(BC.evaluateSemantics(p2).fingerprint === BC.evaluateSemantics(p2).fingerprint, "12g: fingerprint 결정론");
    // 같은 의미·같은 좌표면 동일
    const p3 = mk(8, d1); ok(BC.evaluateSemantics(p3).fingerprint === r1.result.semantics.fingerprint, "12g: 동일 의미 → 동일 fingerprint");
  }

  // (h) 다트 의미가 좌표·kind·개수·순서를 바꾸지 않는다
  {
    const bare = mk(8, [line([40, 20], [44, 38]), line([48, 20], [44, 38])], { refs: false });
    const tagged = mk(8, [dleg([40, 20], [44, 38], "front-waist-a", "armhole", "to"),
                          dleg([48, 20], [44, 38], "front-waist-a", "armhole", "to")], { refs: false });
    const strip = (p) => JSON.stringify(p.working.geometry, (k, v) => (k === "dart" ? undefined : v));
    ok(strip(bare) === strip(tagged), "12h: 의미 추가가 형상·개수·순서를 바꾸지 않음");
  }
}

// 13. 완성 둘레 계측(girthMeasure) — 읽기 전용.
//   ★ 핵심: 접어재단 반쪽 다트(onFold·다리 1개)는 intakeCm 이 null 이라 **단순 intake 합산에서 빠진다.**
//   계측이 그걸 포함하는지, 그리고 다트 폭을 "그 높이에서" 재는지를 손으로 검산 가능한 픽스처로 고정한다.
{
  const L = (a, b, edge) => { const s = { kind: "line", from: { x: a[0], y: a[1] }, to: { x: b[0], y: b[1] } }; if (edge) s.edge = edge; return s; };
  const leg = (a, b, id, apexAt, extra) => Object.assign(L(a, b), { dart: Object.assign({ id, apexAt, boundary: "waist" }, extra || {}) });
  // 단순 직사각 조각: 중심 cx, 옆선 cx∓20, 허리 y=30, BL(=side-seam 위끝) y=10
  const rect = (cx, dir) => ({
    outline: [
      L([cx, 0], [cx, 30], "center"),
      L([cx + dir * 20, 10], [cx + dir * 20, 30], "side-seam"),
      L([cx, 30], [cx + dir * 20, 30], "waist"),
      L([cx, 0], [cx + dir * 20, 10])
    ],
    construction: []
  });
  const mk = (opts) => {
    opts = opts || {};
    const front = rect(40, -1), back = rect(0, 1);
    // 앞 허리다트: apex (30,10) · 다리 (29,30)(31,30) → 허리 폭 2, BL(=apex) 폭 0, y=20 에서 폭 1
    front.construction.push(leg([29, 30], [30, 10], "f-waist", "to"), leg([31, 30], [30, 10], "f-waist", "to"));
    // 뒤 접어재단 반쪽 다트: apex (0,5) · 다리 (0.5,30) → intakeCm 은 null 이지만 반패턴 몫 0.5 가 존재
    back.construction.push(leg([0.5, 30], [0, 5], "b-fold", "to", { onFold: true }));
    if (opts.hemLike) {   // hem 연장처럼 waist 가 construction 으로 옮겨간 경우
      [front, back].forEach(p => {
        const w = p.outline.filter(s => s.edge === "waist");
        p.outline = p.outline.filter(s => s.edge !== "waist");
        w.forEach(s => p.construction.push(s));
      });
    }
    return {
      sourceBlock: { version: 1 },
      baseSource: opts.noMeasure ? {} : { measurements: { B: 70, W: 64 } },
      working: { geometry: { front, back, shared: { construction: [] }, sleeve: { outline: [], construction: [] } },
        parameters: {}, designOutline: opts.designOutline || null, frontPlacket: null, patternLines: [], bodiceResult: null }
    };
  };

  const P = mk();
  const m = BC.girthMeasure(P);
  ok(m && m.waistLineY === 30 && m.bustLineY === 10, "13: WL/BL 높이 자동 검출(허리 edge · 옆선 위끝)");
  // 허리: 외곽 (20+20)×2=80 · 다트 (2 + 0.5)×2=5 · 완성 75
  ok(near(m.waist.outlineCm, 80) && near(m.waist.suppressionCm, 5) && near(m.waist.finishedCm, 75), "13: 허리 외곽 80 · 다트 5 · 완성 75");
  // ★ 접어재단 반쪽 다트(0.5)가 빠지지 않았다 — intakeCm 합산이었다면 4 가 나왔을 것
  ok(!near(m.waist.suppressionCm, 4), "13: onFold 반쪽 다트를 누락하지 않는다");
  // 가슴(BL=y10): 앞 다트는 apex 라 0, 뒤 접어재단은 0.1 → 외곽 80 · 다트 0.2 · 완성 79.8
  ok(near(m.bust.outlineCm, 80) && near(m.bust.suppressionCm, 0.2) && near(m.bust.finishedCm, 79.8), "13: 다트 폭을 **그 높이에서** 잰다(apex 에선 0)");
  ok(near(m.bustEaseCm, 9.8) && near(m.waistEaseCm, 11), "13: 실측(baseSource) 대비 여유");
  ok(m.bodyBustCm === 70 && m.bodyWaistCm === 64, "13: 실측은 DOM 이 아니라 baseSource.measurements");

  // hem 연장처럼 waist 가 construction 으로 이동해도 같은 값
  const mh = BC.girthMeasure(mk({ hemLike: true }));
  ok(mh && mh.waistLineY === 30 && near(mh.waist.finishedCm, 75), "13: waist 가 construction 으로 옮겨가도 계측된다");

  // designOutline(외곽 대체) 우선 — 앞 옆선을 5 안쪽으로 줄인 대체 외곽
  const alt = { front: { outline: [L([40, 0], [40, 30], "center"), L([25, 10], [25, 30], "side-seam"),
    L([40, 30], [25, 30], "waist"), L([40, 0], [25, 10])] } };
  const md = BC.girthMeasure(mk({ designOutline: alt }));
  ok(near(md.waist.outlineCm, 70), "13: designOutline 이 있으면 그쪽으로 잰다(앞 15 + 뒤 20)×2");

  // 실측이 없으면 여유는 지어내지 않고 null
  const mn = BC.girthMeasure(mk({ noMeasure: true }));
  ok(mn.bustEaseCm === null && mn.waistEaseCm === null && mn.bodyWaistCm === null && mn.waist !== null,
    "13: 실측 없으면 여유 null(둘레는 그대로 측정)");

  // 순수성: 계측이 입력을 변형하지 않는다 · 결정론
  const Pp = mk(), snap = JSON.stringify(Pp.working.geometry);
  const a1 = JSON.stringify(BC.girthMeasure(Pp)), a2 = JSON.stringify(BC.girthMeasure(Pp));
  ok(snap === JSON.stringify(Pp.working.geometry), "13: 입력 geometry 비변형");
  ok(a1 === a2, "13: 결정론");

  // 허리 edge 가 아예 없으면 허리는 null(0cm 으로 보이지 않는다)
  const Pw = mk();
  ["front", "back"].forEach(k => { Pw.working.geometry[k].outline = Pw.working.geometry[k].outline.filter(s => s.edge !== "waist"); });
  const mw = BC.girthMeasure(Pw);
  ok(mw.waist === null && mw.waistLineY === null && mw.bust !== null, "13: 허리 측정 불가는 null(가슴은 계속 측정)");
  // 인자 없이 부르면 현재 project 로 떨어진다(다른 getter 와 같은 관례) — 현재도 없으면 null
  { const keep = PROJECT; PROJECT = null;
    ok(BC.girthMeasure(null) === null && BC.girthMeasure() === null, "13: project 가 아예 없으면 null");
    PROJECT = keep; }
}

console.log("══════════════════════════════════════════════");
if (FAIL) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); }
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
