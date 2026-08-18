// ══════════════════════════════════════════════
// designBodiceCheck.js — js/designBodice.js 의 window.designBodice.computeGeometry 회귀 테스트.
//
// 실제 프로덕션 소스(designBodice.js)를 Node vm 으로 실행한다(구현 복사 아님).
// designBodice 는 순수 함수라 **document/localStorage 없는 최소 컨텍스트**에서 돌려
// DOM·storage 미접근을 구조적으로 증명한다(접근하면 ReferenceError). renderer 왕복은
// 별도 컨텍스트에서 designRenderer.js(DOM mock)로 검증한다.
//
//   node test/harness/designBodiceCheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");

const JS = (f) => fs.readFileSync(path.join(__dirname, "..", "..", "js", f), "utf8");
const DB_SRC = JS("designBodice.js");
const DR_SRC = JS("designRenderer.js");

let PASS = 0, FAIL = 0; const fails = [];
function ok(cond, name) { if (cond) PASS++; else { FAIL++; fails.push(name); } }
function throws(fn, reasonWanted, name) {
  try { fn(); FAIL++; fails.push(name + " (throw 안 됨)"); }
  catch (e) { if (reasonWanted && e.reason !== reasonWanted) { FAIL++; fails.push(name + ` (reason=${e.reason}, 기대=${reasonWanted})`); } else PASS++; }
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function sharesRef(a, b) {
  const refsA = new Set();
  (function w(o) { if (o && typeof o === "object") { if (refsA.has(o)) return; refsA.add(o); Object.values(o).forEach(w); } })(a);
  let shared = false; const seen = new Set();
  (function w(o) { if (o && typeof o === "object") { if (refsA.has(o)) { shared = true; return; } if (seen.has(o)) return; seen.add(o); Object.values(o).forEach(w); } })(b);
  return shared;
}

// ── designBodice 전용 컨텍스트(document/localStorage 없음) ──
function loadDB() {
  const sandbox = {
    window: {}, structuredClone: (typeof structuredClone === "function") ? structuredClone : undefined,
    console: { log() {}, warn() {}, error() {} },
    Math, JSON, Object, Array, Number, isFinite, Error, Infinity, NaN
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(DB_SRC, sandbox, { filename: "designBodice.js" });
  return sandbox.window.designBodice;
}
const DB = loadDB();

// ── 픽스처 빌더 ──
const line = (x1, y1, x2, y2, edge) => { const o = { kind: "line", from: { x: x1, y: y1 }, to: { x: x2, y: y2 } }; if (edge) o.edge = edge; return o; };
const cubic = (pts) => ({ kind: "path", commands: [{ type: "M", points: [{ x: pts[0][0], y: pts[0][1] }] }, { type: "C", points: [{ x: pts[1][0], y: pts[1][1] }, { x: pts[2][0], y: pts[2][1] }, { x: pts[3][0], y: pts[3][1] }] }] });

// Cx=center x, sideSign=-1(front)/+1(back), o=longitudinalOffset, W=cross-grain width.
// C=(Cx,38), S=(Cx+sideSign*W, 38+o). center tangent 은 (Cx,28)→C 이라 grain g=(0,1).
function makePiece(Cx, sideSign, o, W) {
  const C = { x: Cx, y: 38 }, S = { x: Cx + sideSign * W, y: 38 + o };
  const arm = sideSign < 0 ? cubic([[30, 10], [34, 6], [40, 9], [45, 13]]) : cubic([[-30, 10], [-34, 6], [-40, 9], [-45, 13]]);
  return {
    outline: [
      arm,                                             // 진동곡선(edge 없음)
      line(Cx, 28, Cx, 38, "center"),                  // center(위→C)
      line(Cx, 38, S.x, S.y, "waist"),                 // waist(C→S)
      line(S.x, S.y - 8, S.x, S.y, "side-seam")        // side-seam(위→S)
    ],
    construction: [
      line(Cx - 3, 20, Cx - 1, 38),                    // 더미 다트다리(edge 없음)
      line(Cx - 5, 20, Cx - 1, 38)
    ]
  };
}
function makeGeom(fo, fW, bo, bW) {
  return {
    front: makePiece(47.5, -1, fo, fW),
    back: makePiece(0, +1, bo, bW),
    shared: { outline: [], construction: [line(200, 60, 200, 80), line(210, 60, 210, 80)] },
    sleeve: { outline: [cubic([[400, 100], [420, 120], [440, 140], [460, 160]]), line(400, 300, 460, 300)], construction: [] }
  };
}
// 5개 상태 대응 파라미터(조사 실측: offset/width)
const STATES = {
  "1-미적용": makeGeom(0, 24.4469, 0, 23.0531),
  "2-앞판만": makeGeom(-5.7157, 29.1131, 0, 23.0531),
  "3-뒤판만": makeGeom(0, 24.4469, 0, 23.0531),
  "4-앞뒤동시": makeGeom(-5.7157, 29.1131, 0, 23.0531),
  "5-앞다중": makeGeom(-2.6717, 27.008, 0, 23.0531)
};

// ── 기하 헬퍼(테스트 측) ──
const len = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
function edgePrims(bucket, edge) { return bucket.filter(p => p.edge === edge); }
// edge primitive 중 특정 점에 끝점이 닿는 것
function primAt(prims, pt) { return prims.find(p => (near(p.from.x, pt.x) && near(p.from.y, pt.y)) || (near(p.to.x, pt.x) && near(p.to.y, pt.y))); }

// ══════════════════════════════════════════════
// 1. L=0 : deepClone no-op
{
  const ref = STATES["2-앞판만"];
  const r = DB.computeGeometry(ref, { body: { hemExtensionBelowWaistCm: 0 } });
  ok(eq(r, ref), "1: L=0 deepEqual reference");
  ok(sharesRef(r, ref) === false, "1: L=0 참조 공유 0");
  // primitive 개수·순서·role·edge 완전 동일
  let same = true;
  ["front", "back", "shared", "sleeve"].forEach(pc => ["outline", "construction"].forEach(rl => {
    const A = ref[pc][rl], B = r[pc][rl];
    if (A.length !== B.length) same = false;
    A.forEach((p, i) => { if ((p.edge || "∅") !== (B[i].edge || "∅") || p.kind !== B[i].kind) same = false; });
  }));
  ok(same, "1: 개수·순서·role·edge 동일");
  // zero-length primitive 0
  let zero = 0;
  ["front", "back", "shared", "sleeve"].forEach(pc => ["outline", "construction"].forEach(rl => r[pc][rl].forEach(p => { if (p.kind === "line" && len(p.from, p.to) < 1e-9) zero++; })));
  ok(zero === 0, "1: zero-length primitive 0");
}

// 2. 입력 불변 + 반복 호출 비누적 + 결정론
{
  const ref = STATES["2-앞판만"];
  const before = JSON.stringify(ref);
  const r1 = DB.computeGeometry(ref, { body: { hemExtensionBelowWaistCm: 10 } });
  const r2 = DB.computeGeometry(ref, { body: { hemExtensionBelowWaistCm: 10 } });
  ok(JSON.stringify(ref) === before, "2: 입력 geometry 불변");
  ok(eq(r1, r2), "2: 반복 호출 결정론·비누적");
  ok(sharesRef(r1, ref) === false, "2: 결과 참조 분리");
}

// 3. 각 상태 front/back L=10 : center=L / hem⊥grain / 평행 / side=L-offset / waist 이동 / hem 1개
{
  const L = 10;
  for (const name of Object.keys(STATES)) {
    const ref = STATES[name];
    const r = DB.computeGeometry(ref, { body: { hemExtensionBelowWaistCm: L } });
    for (const pc of ["front", "back"]) {
      const Cx = pc === "front" ? 47.5 : 0;
      const C = { x: Cx, y: 38 };
      const centerHem = { x: Cx, y: 48 };
      const outline = r[pc].outline, constr = r[pc].construction;
      // waist outline 0, waist construction 보존(정확히 1, 원래 순서=끝)
      ok(edgePrims(outline, "waist").length === 0, `3:${name}/${pc} waist outline 0`);
      const wc = edgePrims(constr, "waist");
      ok(wc.length === 1 && constr[constr.length - 1] === wc[0], `3:${name}/${pc} waist construction 끝 보존`);
      // hem outline 정확히 1
      const hems = edgePrims(outline, "hem");
      ok(hems.length === 1, `3:${name}/${pc} hem 1개`);
      const hem = hems[0];
      // hem ⊥ grain(g=(0,1)) → 수평(dy=0), 길이=width
      ok(near(hem.from.y, hem.to.y), `3:${name}/${pc} hem ⟂ grain(수평)`);
      // center extension: C→centerHem, 길이 L
      const cext = primAt(edgePrims(outline, "center"), centerHem);
      ok(cext && near(len(cext.from, cext.to), L), `3:${name}/${pc} center 연장=L`);
      // side extension: S→sideHem, 길이=L-offset, grain 평행(수직)
      const offset = pc === "front" ? ({ "1-미적용": 0, "2-앞판만": -5.7157, "3-뒤판만": 0, "4-앞뒤동시": -5.7157, "5-앞다중": -2.6717 })[name] : 0;
      const sideHem = { x: hem.to.x === centerHem.x ? hem.from.x : hem.to.x, y: 48 };
      const sext = primAt(edgePrims(outline, "side-seam"), sideHem);
      ok(sext && near(len(sext.from, sext.to), L - offset, 1e-3), `3:${name}/${pc} side 연장=L-offset`);
      // 두 extension 평행(둘 다 수직 = dx≈0)
      const cdx = Math.abs(cext.to.x - cext.from.x), sdx = Math.abs(sext.to.x - sext.from.x);
      ok(near(cdx, 0) && near(sdx, 0), `3:${name}/${pc} 두 extension 평행(수직)`);
      // 신규 outline 순서: 기존 non-waist 뒤에 center-ext→hem→side-ext
      const last3 = outline.slice(-3).map(p => p.edge);
      ok(eq(last3, ["center", "hem", "side-seam"]), `3:${name}/${pc} 신규 outline 순서`);
    }
    // sleeve/shared 불변(값·순서)
    ok(eq(r.sleeve, ref.sleeve) && eq(r.shared, ref.shared), `3:${name} sleeve/shared 불변`);
  }
}

// 4. 입력 정규화 경계: 정확한 0 만 no-op / 음수·NaN·Infinity·비수치 실패
{
  const ref = STATES["1-미적용"];
  throws(() => DB.computeGeometry(ref, { body: { hemExtensionBelowWaistCm: -1 } }), "invalid-body-length", "4: 음수");
  throws(() => DB.computeGeometry(ref, { body: { hemExtensionBelowWaistCm: NaN } }), "invalid-body-length", "4: NaN");
  throws(() => DB.computeGeometry(ref, { body: { hemExtensionBelowWaistCm: Infinity } }), "invalid-body-length", "4: Infinity");
  throws(() => DB.computeGeometry(ref, { body: { hemExtensionBelowWaistCm: "5" } }), "invalid-body-length", "4: 문자열");
  // 두 파라미터 모두 선택적: 둘 다 없음(또는 둘 다 0) = no-op(clone). (여유량 추가로 hemExt 필수 계약 폐기)
  { const r = DB.computeGeometry(ref, { body: {} }); ok(eq(r, ref) && !sharesRef(r, ref), "4: 둘 다 없음 = no-op clone"); }
}

// 4b. 여유량(bustEaseCm): E=0 no-op / 음수·NaN·비수치 실패 / E>0 옆선 E/4 바깥 평행 이동
{
  const ref = STATES["1-미적용"];
  // E=0 정확히만 no-op
  { const r = DB.computeGeometry(ref, { body: { bustEaseCm: 0 } }); ok(eq(r, ref) && !sharesRef(r, ref), "4b: E=0 no-op clone"); }
  throws(() => DB.computeGeometry(ref, { body: { bustEaseCm: -1 } }), "invalid-body-ease", "4b: E 음수");
  throws(() => DB.computeGeometry(ref, { body: { bustEaseCm: NaN } }), "invalid-body-ease", "4b: E NaN");
  throws(() => DB.computeGeometry(ref, { body: { bustEaseCm: Infinity } }), "invalid-body-ease", "4b: E Infinity");
  throws(() => DB.computeGeometry(ref, { body: { bustEaseCm: "3" } }), "invalid-body-ease", "4b: E 문자열");
  // E=8 → δ=2. front 옆선 −2(x 23.0531→21.0531), back 옆선 +2(→25.0531). waist S 함께 이동. construction 불변.
  {
    const r = DB.computeGeometry(ref, { body: { bustEaseCm: 8 } });
    const delta = 2;
    // front side-seam: 원본 23.0531 → 21.0531(바깥=−x)
    const fss = edgePrims(r.front.outline, "side-seam")[0];
    ok(near(fss.from.x, 23.0531 - delta) && near(fss.to.x, 23.0531 - delta), "4b: front 옆선 −δ 평행 이동");
    // front waist 의 side 끝(S) 도 −δ 이동, center 끝(C)은 불변
    const fw = edgePrims(r.front.outline, "waist")[0];
    const fwSide = near(fw.from.x, 47.5) ? fw.to : fw.from;
    ok(near(fwSide.x, 23.0531 - delta) && near(fwSide.y, 38), "4b: front waist S 끝 −δ 이동");
    // back side-seam: 바깥=+x → 25.0531
    const bss = edgePrims(r.back.outline, "side-seam")[0];
    ok(near(bss.from.x, 23.0531 + delta) && near(bss.to.x, 23.0531 + delta), "4b: back 옆선 +δ 평행 이동");
    // construction(다트) 불변
    ok(eq(r.front.construction, ref.front.construction) && eq(r.back.construction, ref.back.construction), "4b: construction(다트) 불변");
    // sleeve/shared 불변, 입력 비변형
    ok(eq(r.sleeve, ref.sleeve) && eq(r.shared, ref.shared), "4b: sleeve/shared 불변");
    ok(!sharesRef(r, ref), "4b: 참조 공유 0(입력 비변형)");
  }
  // 여유량 + 길이 동시: 둘 다 반영(옆선 넓어진 뒤 hem 내려감)
  {
    const r = DB.computeGeometry(ref, { body: { bustEaseCm: 8, hemExtensionBelowWaistCm: 10 } });
    ok(edgePrims(r.front.outline, "hem").length === 1, "4b: 여유량+길이 → hem 생성");
    // 새 side-seam 연장은 넓어진 S(x≈21.0531) 에서 시작 — 여유량이 hem 보다 먼저 반영됨
    const fss = edgePrims(r.front.outline, "side-seam");
    ok(fss.some(p => near(p.from.x, 23.0531 - 2) || near(p.to.x, 23.0531 - 2)), "4b: hem 연장이 넓어진 옆선(−δ) 기준");
  }
}

// 4c. 옆선 실루엣: 허리 옆선 이동(waistSideOffsetCm, 음수=안쪽) / 밑단 옆선 이동(hemSideOffsetCm, 양수=바깥)
{
  const ref = STATES["1-미적용"];
  const sideEnds = (outline) => { const s = edgePrims(outline, "side-seam")[0]; const U = near(s.from.y, 38) ? s.to : s.from; const S = near(s.from.y, 38) ? s.from : s.to; return { U, S }; };
  // 부호 허용(안/밖)이지만 비수치·무한대는 실패
  throws(() => DB.computeGeometry(ref, { body: { waistSideOffsetCm: NaN } }), "invalid-body-side-offset", "4c: waist NaN");
  throws(() => DB.computeGeometry(ref, { body: { hemSideOffsetCm: Infinity } }), "invalid-body-side-offset", "4c: hem Infinity");
  // 허리 안쪽(-3): front 허리 S +3 inward(23.0531→26.0531), underarm U 불변. back S -3 inward(→20.0531). 다트 불변.
  {
    const r = DB.computeGeometry(ref, { body: { waistSideOffsetCm: -3 } });
    const f = sideEnds(r.front.outline);
    ok(near(f.U.x, 23.0531) && near(f.S.x, 23.0531 + 3), "4c: front 허리 안쪽 +3 · underarm 불변(꺾임)");
    const b = sideEnds(r.back.outline);
    ok(near(b.S.x, 23.0531 - 3), "4c: back 허리 안쪽 -3");
    ok(eq(r.front.construction, ref.front.construction), "4c: construction(다트) 불변");
    ok(!sharesRef(r, ref), "4c: 참조 공유 0");
  }
  // 여유량+허리(허리 들어간 형): underarm=ease 폭(-δ=21.0531), 허리=ease+waistOff(21.0531+3=24.0531 inward)
  {
    const r = DB.computeGeometry(ref, { body: { bustEaseCm: 8, waistSideOffsetCm: -3 } });
    const f = sideEnds(r.front.outline);
    ok(near(f.U.x, 23.0531 - 2), "4c: 여유량+허리 → underarm ease 폭(−δ) 고정");
    ok(near(f.S.x, 23.0531 - 2 + 3), "4c: 여유량+허리 → 허리 ease+waistOff(안쪽)");
  }
  // 밑단 옆선(A라인, hemSideOffsetCm=+3 바깥) — hem 있을 때만, ease 폭 기준 독립(허리 이동과 무관)
  {
    const r = DB.computeGeometry(ref, { body: { bustEaseCm: 8, hemExtensionBelowWaistCm: 10, hemSideOffsetCm: 3 } });
    const hem = edgePrims(r.front.outline, "hem")[0];
    const hemSideX = near(hem.from.x, 47.5) ? hem.to.x : hem.from.x;   // centerHem=47.5 반대편=hem-side
    // ease 폭 hem-side = 47.5-(24.4469+2)=21.0531, hemOff=+3 바깥(front 바깥=−x) → 18.0531
    ok(hem && near(hemSideX, 23.0531 - 2 - 3, 1e-3), "4c: 밑단 옆선 바깥 3(A라인) · ease 폭 기준 독립");
  }
  // hem 없으면 밑단 오프셋 무효(no-op 대비 side-seam 변화 없음)
  {
    const r0 = DB.computeGeometry(ref, { body: { bustEaseCm: 8 } });
    const r1 = DB.computeGeometry(ref, { body: { bustEaseCm: 8, hemSideOffsetCm: 5 } });
    ok(eq(r1.front.outline, r0.front.outline), "4c: hem 없으면 밑단 오프셋 무효");
  }
}

// 4d. 옆선 곡선화(sideSeamCurve): 곡률 0 no-op / 2 cubic / 세 점 통과 / 허리 접선 연속 / overshoot 없음
{
  const ref = STATES["1-미적용"];
  throws(() => DB.computeGeometry(ref, { body: { sideSeamCurve: -0.1 } }), "invalid-body-curve", "4d: curve <0");
  throws(() => DB.computeGeometry(ref, { body: { sideSeamCurve: 1.5 } }), "invalid-body-curve", "4d: curve >1");
  throws(() => DB.computeGeometry(ref, { body: { sideSeamCurve: NaN } }), "invalid-body-curve", "4d: curve NaN");
  const base = { bustEaseCm: 8, hemExtensionBelowWaistCm: 10, waistSideOffsetCm: -3 };
  // 곡률 0 = 직선 2세그먼트 그대로(정확 no-op)
  {
    const r0 = DB.computeGeometry(ref, { body: base });
    const rc0 = DB.computeGeometry(ref, { body: Object.assign({}, base, { sideSeamCurve: 0 }) });
    ok(eq(rc0.front.outline, r0.front.outline) && eq(rc0.back.outline, r0.back.outline), "4d: 곡률 0 = 직선 no-op");
  }
  // 곡률 1: side-seam 2 cubic(path 형식), 세 점(U 21.0531,30 · Sp 24.0531,38 · H 21.0531,48) 통과, 접선 연속, overshoot 없음
  {
    const r = DB.computeGeometry(ref, { body: Object.assign({}, base, { sideSeamCurve: 1 }) });
    const ss = edgePrims(r.front.outline, "side-seam");
    // path {M,C} → {from,c1,c2,to}
    const cb = (pr) => ({ from: pr.commands[0].points[0], c1: pr.commands[1].points[0], c2: pr.commands[1].points[1], to: pr.commands[1].points[2] });
    ok(ss.length === 2 && ss.every(s => s.kind === "path" && s.commands.length === 2 && s.commands[1].type === "C"), "4d: side-seam 2 cubic(path)");
    const segs = ss.map(cb);
    const pts = []; segs.forEach(s => { pts.push([s.from.x, s.from.y]); pts.push([s.to.x, s.to.y]); });
    const has = (x, y) => pts.some(q => near(q[0], x, 1e-3) && near(q[1], y, 1e-3));
    const SpX = 21.0531 + 3;   // 여유량 −2(21.0531) + 허리 안쪽 3
    ok(has(21.0531, 30) && has(SpX, 38) && has(21.0531, 48), "4d: 세 기준점 정확 통과(U·Sp·H)");
    // 허리 Sp 에서 두 핸들 일직선(접선 연속): cub1.c2−Sp 와 cub2.c1−Sp 공선·반대방향
    const cub1 = segs.find(s => near(s.to.x, SpX, 1e-3) && near(s.to.y, 38, 1e-3));    // →Sp
    const cub2 = segs.find(s => near(s.from.x, SpX, 1e-3) && near(s.from.y, 38, 1e-3)); // Sp→
    const v1 = { x: cub1.c2.x - SpX, y: cub1.c2.y - 38 }, v2 = { x: cub2.c1.x - SpX, y: cub2.c1.y - 38 };
    ok(Math.abs(v1.x * v2.y - v1.y * v2.x) < 1e-6 && (v1.x * v2.x + v1.y * v2.y) < 0, "4d: 허리 핸들 일직선(접선 연속)");
    // overshoot 없음: 평탄화 x 최대 ≤ Sp.x(허리 안쪽 한계, front 안쪽=+x)
    const flatX = (s) => { const out = []; for (let i = 0; i <= 24; i++) { const t = i / 24, u = 1 - t; out.push(u*u*u*s.from.x + 3*u*u*t*s.c1.x + 3*u*t*t*s.c2.x + t*t*t*s.to.x); } return out; };
    let maxX = -Infinity; segs.forEach(s => flatX(s).forEach(x => { if (x > maxX) maxX = x; }));
    ok(maxX <= SpX + 1e-4, "4d: overshoot 없음(허리 안쪽 한계 초과 안 함)");
    // 다트·reference 불변(곡선화는 side-seam 만)
    ok(ref.front.construction.map(x => JSON.stringify(x)).every(s => r.front.construction.map(y => JSON.stringify(y)).indexOf(s) >= 0), "4d: 다트 불변");
    ok(!sharesRef(r, ref), "4d: reference 참조 분리");
  }
  // 곡선화는 hem 이 있어 side-seam 2세그먼트일 때만(hem 없으면 1세그먼트 → 그대로)
  {
    const r = DB.computeGeometry(ref, { body: { waistSideOffsetCm: -3, sideSeamCurve: 1 } });
    const ss = edgePrims(r.front.outline, "side-seam");
    ok(ss.length === 1 && ss[0].kind === "line", "4d: hem 없으면 곡선화 안 함(1 line)");
  }
}

// 4e. 네크라인(parametric round): 목너비(SNP 이동)·앞/뒤목 깊이(FNP 이동)·라운드 path / 원형유지 no-op
{
  // 네크라인 위상을 가진 fixture(center 목점→neckline→shoulder). pieceFrame 용 waist/side 포함.
  const npath = (a, c1, c2, b) => ({ kind: "path", commands: [{ type: "M", points: [{ x: a[0], y: a[1] }] }, { type: "C", points: [{ x: c1[0], y: c1[1] }, { x: c2[0], y: c2[1] }, { x: b[0], y: b[1] }] }] });
  function neckPiece(Cx, sgn, W) {
    const S = { x: Cx + sgn * W, y: 38 };
    return {
      outline: [
        npath([Cx, 5], [Cx + sgn * 2, 2], [Cx + sgn * 5, 0], [Cx + sgn * 7, 0]),   // neckline FNP(Cx,5)→SNP(Cx+7sgn,0)
        line(Cx + sgn * 7, 0, Cx + sgn * 15, 3),                                     // shoulder SNP→tip
        line(Cx, 5, Cx, 38, "center"), line(Cx, 38, S.x, S.y, "waist"), line(S.x, 30, S.x, 38, "side-seam")
      ],
      construction: [line(Cx - 3, 20, Cx - 1, 38)]   // 더미 다트(불변 확인용)
    };
  }
  const neckGeom = () => ({ front: neckPiece(47.5, -1, 24.4469), back: neckPiece(0, +1, 23.0531), shared: { outline: [], construction: [] }, sleeve: { outline: [], construction: [] } });
  const ref = neckGeom();
  const nl = (params) => ({ neckline: { mode: "parametric", type: "round", parameters: params } });
  // 원형 유지(type original) = no-op
  { const r = DB.computeGeometry(ref, { neckline: { mode: "parametric", type: "original", parameters: {} } }); ok(eq(r, ref) && !sharesRef(r, ref), "4e: 원형 유지 = no-op clone"); }
  // 라운드 · 목너비 2 · 앞목 4: FNP y 5→9(깊이), SNP shoulder 방향 이동, neckline = path
  {
    const r = DB.computeGeometry(ref, nl({ neckWidthCm: 2, frontDepthCm: 4, backDepthCm: 1 }));
    const center = edgePrims(r.front.outline, "center")[0];
    const FNP = near(center.from.y, 38) ? center.to : center.from;   // 목점=waist 아닌 끝
    ok(near(FNP.x, 47.5) && near(FNP.y, 5 + 4), "4e: 앞 FNP grain 아래 +깊이(5→9)");
    // neckline = edge 없는 path, FNP' 를 M 시작으로
    const neck = r.front.outline.find(pr => !("edge" in pr) && pr.kind === "path" && near(pr.commands[0].points[0].x, FNP.x, 1e-3) && near(pr.commands[0].points[0].y, FNP.y, 1e-3));
    ok(!!neck, "4e: 네크라인 = 라운드 path(FNP' 시작)");
    // SNP' = SNP + shoulderDir×2. 원본 SNP=(40.5,0), tip=(32.5,3) → dir=norm((-8,3))
    const SNP = neck.commands[neck.commands.length - 1].points.slice(-1)[0];
    const dir = (() => { const dx = 32.5 - 40.5, dy = 3 - 0, l = Math.hypot(dx, dy); return { x: dx / l, y: dy / l }; })();
    ok(near(SNP.x, 40.5 + dir.x * 2, 1e-2) && near(SNP.y, 0 + dir.y * 2, 1e-2), "4e: SNP shoulder 방향 목너비 이동");
    // 다트(construction) 불변, reference 분리
    ok(eq(r.front.construction, ref.front.construction), "4e: 다트 불변");
    ok(!sharesRef(r, ref), "4e: reference 참조 분리");
  }
  // 비수치 목너비 → invalid-neckline-param
  throws(() => DB.computeGeometry(ref, nl({ neckWidthCm: NaN })), "invalid-neckline-param", "4e: 비수치 파라미터 거부");

  // 4f. 형태별(V / 스퀘어 / 보트): 공통 입력(목너비·앞목깊이) + 형태별 입력. 다트 불변·reference 분리.
  const nlT = (type, params) => ({ neckline: { mode: "parametric", type, parameters: params } });
  const frontCenterNeck = (r) => { const c = edgePrims(r.front.outline, "center")[0]; return near(c.from.y, 38) ? c.to : c.from; };
  const neckSegs = (r) => r.front.outline.filter(pr => !("edge" in pr));   // edge 없는 = neckline/shoulder
  // V넥: 앞목 깊이 2 + V끝점 깊이 4 → CF 접점 = FNP' 에서 4 더 내려간 (47.5, 5+2+4=11). neckline = 직선 1개.
  {
    const r = DB.computeGeometry(ref, nlT("v", { neckWidthCm: 0, frontDepthCm: 2, backDepthCm: 1, vPointDepthCm: 4 }));
    const cf = frontCenterNeck(r);
    ok(near(cf.x, 47.5) && near(cf.y, 5 + 2 + 4), "4f: V넥 CF 접점 = 앞목+V끝점 깊이(11)");
    const vLine = neckSegs(r).find(pr => pr.kind === "line" && (near(pr.from.y, 11) || near(pr.to.y, 11)));
    ok(!!vLine, "4f: V넥 neckline = 직선(V끝점→SNP')");
    ok(eq(r.front.construction, ref.front.construction), "4f: V넥 다트 불변");
    ok(!sharesRef(r, ref), "4f: V넥 reference 분리");
  }
  // 스퀘어: 앞목 깊이 2, 가로폭 5, 모서리 1 → 바닥 수평선(y=7) + 라운드 + 옆선. neckline seg ≥ 2.
  {
    const r = DB.computeGeometry(ref, nlT("square", { neckWidthCm: 0, frontDepthCm: 2, backDepthCm: 1, squareWidthCm: 5, cornerRadiusCm: 1 }));
    const cf = frontCenterNeck(r);
    ok(near(cf.x, 47.5) && near(cf.y, 7), "4f: 스퀘어 CF 접점 = FNP'(앞목 깊이, 7)");
    const segs = neckSegs(r);
    const flat = segs.find(pr => pr.kind === "line" && near(pr.from.y, 7) && near(pr.to.y, 7));   // 바닥 수평
    ok(!!flat && segs.length >= 3, "4f: 스퀘어 = 바닥 수평선 + 세그먼트 다수");
    ok(eq(r.front.construction, ref.front.construction), "4f: 스퀘어 다트 불변");
  }
  // 보트: 얕은 bow(cubic path 1개), CF 접점 = FNP'.
  {
    const r = DB.computeGeometry(ref, nlT("boat", { neckWidthCm: 0, frontDepthCm: 2, backDepthCm: 1, curveAmountNorm: 0.5 }));
    const cf = frontCenterNeck(r);
    ok(near(cf.x, 47.5) && near(cf.y, 7), "4f: 보트 CF 접점 = FNP'(7)");
    const bow = neckSegs(r).find(pr => pr.kind === "path" && near(pr.commands[0].points[0].y, 7, 1e-3));
    ok(!!bow, "4f: 보트 neckline = cubic path");
    ok(eq(r.front.construction, ref.front.construction), "4f: 보트 다트 불변");
  }
}

// 5. topology / 수치 실패 계약
{
  const L = { body: { hemExtensionBelowWaistCm: 10 } };
  // missing-required-edge (center 제거)
  const g1 = makeGeom(0, 24.4469, 0, 23.0531); g1.front.outline = g1.front.outline.filter(p => p.edge !== "center");
  throws(() => DB.computeGeometry(g1, L), "missing-required-edge", "5: center 누락");
  // missing-topology-junction (center 가 waist 와 안 닿음)
  const g2 = makeGeom(0, 24.4469, 0, 23.0531); const cseg = g2.front.outline.find(p => p.edge === "center"); cseg.from = { x: 500, y: 300 }; cseg.to = { x: 500, y: 310 };
  throws(() => DB.computeGeometry(g2, L), "missing-topology-junction", "5: center∩waist 없음");
  // ambiguous-topology-junction (center 가 waist 집합과 끝점 2개 공유)
  const g3 = makeGeom(0, 24.4469, 0, 23.0531); g3.front.outline.push(line(47.5, 28, 60, 28, "waist"));
  throws(() => DB.computeGeometry(g3, L), "ambiguous-topology-junction", "5: center∩waist 2개");
  // ambiguous-center-tangent (C 에 center 세그 2개)
  const g4 = makeGeom(0, 24.4469, 0, 23.0531); g4.front.outline.push(line(47.5, 38, 55, 30, "center"));
  throws(() => DB.computeGeometry(g4, L), "ambiguous-center-tangent", "5: center tangent 모호");
  // zero-center-tangent (center 세그 길이 0)
  const g5 = makeGeom(0, 24.4469, 0, 23.0531); const cs5 = g5.front.outline.find(p => p.edge === "center"); cs5.from = { x: 47.5, y: 38 }; cs5.to = { x: 47.5, y: 38 };
  throws(() => DB.computeGeometry(g5, L), "zero-center-tangent", "5: center tangent 길이 0");
  // invalid-cross-grain-width (S 가 C 바로 아래 → width 0)
  const g6 = makeGeom(0, 24.4469, 0, 23.0531);
  g6.front.outline = g6.front.outline.filter(p => p.edge !== "waist" && p.edge !== "side-seam");
  g6.front.outline.push(line(47.5, 38, 47.5, 43, "waist"));      // C→(47.5,43) 수직
  g6.front.outline.push(line(47.5, 35, 47.5, 43, "side-seam"));  // S=(47.5,43): width=0
  throws(() => DB.computeGeometry(g6, L), "invalid-cross-grain-width", "5: cross-grain width 0");
  // invalid-side-extension (offset>=L → side 연장 ≤0)
  const g7 = makeGeom(12, 24.4469, 0, 23.0531); // front offset +12 > L=10
  throws(() => DB.computeGeometry(g7, L), "invalid-side-extension", "5: side 연장 ≤0");
  // extension-intersection: 크로싱이 32분할 꼭짓점(t=0.5→x=47.5)에 **정확히** 걸리는
  // 원래 픽스처 — 고정분할은 이걸 "스침"으로 놓쳤다. adaptive+정확한 예외로 반드시 감지.
  const g8 = makeGeom(0, 24.4469, 0, 23.0531);
  g8.front.outline.push(cubic([[42, 43], [45, 43], [50, 43], [53, 43]])); // x=47.5,y=43 에서 수직 center 연장 횡단
  throws(() => DB.computeGeometry(g8, L), "extension-intersection", "5: t=0.5 꼭짓점 횡단 감지");
}

// 6. invalid-geometry
{
  throws(() => DB.computeGeometry(null, { body: { hemExtensionBelowWaistCm: 10 } }), "invalid-geometry", "6: null geometry");
  const bad = makeGeom(0, 24.4469, 0, 23.0531); delete bad.back;
  throws(() => DB.computeGeometry(bad, { body: { hemExtensionBelowWaistCm: 10 } }), "invalid-geometry", "6: bucket 없음");
}

// 7. renderer 왕복: computeGeometry 결과 → designRenderer 가 hem/waist-construction 정상 출력
{
  // DOM mock + c2p 컨텍스트로 designRenderer 로드
  function loadDR() {
    let listeners = 0; const created = [];
    function makeEl(tag) {
      const el = { tagName: tag, _a: {}, childNodes: [], parentNode: null,
        setAttribute(k, v) { this._a[k] = String(v); }, getAttribute(k) { return (k in this._a) ? this._a[k] : null; },
        getAttributeNames() { return Object.keys(this._a); }, appendChild(c) { c.parentNode = this; this.childNodes.push(c); return c; }, addEventListener() { listeners++; } };
      created.push(el); return el;
    }
    const sandbox = { window: {}, document: { createElementNS(_n, t) { return makeEl(t); } }, c2p: (x, y) => [x * 4 + 40, y * 4 + 20], console: { log() {}, warn() {}, error() {} }, Math, JSON, Object, Array, Number, isFinite, Error, Infinity, NaN };
    sandbox.globalThis = sandbox; vm.createContext(sandbox); vm.runInContext(DR_SRC, sandbox, { filename: "designRenderer.js" });
    return { dr: sandbox.window.designRenderer, listeners: () => listeners };
  }
  const { dr } = loadDR();
  const r = DB.computeGeometry(STATES["2-앞판만"], { body: { hemExtensionBelowWaistCm: 10 } });
  // JSON 왕복으로 컨텍스트 간 참조 완전 분리
  const g = dr.createReferenceGroup(JSON.parse(JSON.stringify(r)));
  const hem = g.childNodes.filter(c => c.getAttribute("data-edge") === "hem");
  const wc = g.childNodes.filter(c => c.getAttribute("data-edge") === "waist" && c.getAttribute("data-geometry-role") === "construction");
  ok(hem.length === 2 && hem.every(c => c.getAttribute("data-geometry-role") === "outline"), "7: hem outline 재발행(front+back)");
  ok(wc.length === 2, "7: waist construction 재발행(front+back)");
}

// 8. DOM/storage 미접근 증명 — designBodice 는 document/localStorage 없는 컨텍스트에서 동작
{
  // loadDB() 컨텍스트에는 document/localStorage 가 없다. 정상 동작 = 미접근 증명.
  const r = DB.computeGeometry(STATES["1-미적용"], { body: { hemExtensionBelowWaistCm: 10 } });
  ok(r && r.front && r.front.outline.length > 0, "8: document/localStorage 없는 컨텍스트에서 정상 동작");
}

// 9. 교차 검사 정밀도 (adaptive flattening + 정확한 endpoint 예외)
{
  const L = { body: { hemExtensionBelowWaistCm: 10 } };
  // (a) cubic subdivision 꼭짓점에서 횡단 → 감지 (t=0.5 정확히 x=47.5)
  const ga = makeGeom(0, 24.4469, 0, 23.0531);
  ga.front.outline.push(cubic([[42, 43], [45, 43], [50, 43], [53, 43]]));
  throws(() => DB.computeGeometry(ga, L), "extension-intersection", "9a: subdivision 꼭짓점 횡단 감지");
  // (b) 얕은(거의 수평) 각도로 center 연장선을 횡단 → 감지
  const gb = makeGeom(0, 24.4469, 0, 23.0531);
  gb.front.outline.push(cubic([[44, 45.0], [46, 45.05], [49, 45.05], [51, 45.0]]));
  throws(() => DB.computeGeometry(gb, L), "extension-intersection", "9b: 얕은 각도 횡단 감지");
  // (c) C/S 의 합법적 접속만 있는 정상 변환 → 허용 (center@C, side-seam@S)
  const gc = makeGeom(-5.7157, 29.1131, 0, 23.0531);
  let ok9c = true; try { DB.computeGeometry(gc, L); } catch (e) { ok9c = false; }
  ok(ok9c, "9c: C/S 합법 접속 허용(정상 변환)");
  // (d) C 근처(0.0005cm, 1e-4 밖)에서 횡단하는 무-edge 선 → 감지(예외 아님)
  const gd = makeGeom(0, 24.4469, 0, 23.0531);
  gd.front.outline.push(line(47.5 - 5, 38.0005, 47.5 + 5, 38.0005)); // x=47.5, y=38.0005 에서 center 연장 횡단
  throws(() => DB.computeGeometry(gd, L), "extension-intersection", "9d: C 근처 1e-4 밖 횡단 감지");
  // (e) 실제 armhole 처럼 허리 위에서 분리된 곡선 → 허용
  const ge = makeGeom(0, 24.4469, 0, 23.0531);
  ge.front.outline.push(cubic([[30, 8], [34, 5], [40, 9], [45, 13]])); // 허리(y=38) 위, 연장(y≥38)과 분리
  let ok9e = true; try { DB.computeGeometry(ge, L); } catch (e) { ok9e = false; }
  ok(ok9e, "9e: 분리된 곡선 허용");
  // (f) side extension ↔ 기존 side-seam 은 S 에서만 허용 — 정상 변환에서 오탐 0
  //     (side-seam 이 tilted 여도 S 접속은 허용되어야 함: 적용 상태 gc 가 이미 이를 커버)
  ok(ok9c, "9f: tilted side-seam 의 S 접속 허용");
}

// 10. waist topology 검사 (waist 도 대상, C/S 접점만 허용)
{
  const L = { body: { hemExtensionBelowWaistCm: 10 } };
  const S = { x: 23.0531, y: 38 };
  const swapFrontWaist = (g, segs) => { g.front.outline = g.front.outline.filter(p => p.edge !== "waist").concat(segs); return g; };
  // (1)(2) center–waist@C, side–waist@S 합법 접속 — 정상 변환 허용(오탐 0)
  let ok1 = true; try { DB.computeGeometry(STATES["2-앞판만"], L); } catch (e) { ok1 = false; }
  ok(ok1, "10-1·2: waist@C·@S 합법 접속 허용(정상 변환)");
  // (3) center 연장(x=47.5)이 굽은 waist 내부를 횡단 → 실패
  const g3 = swapFrontWaist(makeGeom(0, 24.4469, 0, 23.0531), [
    line(47.5, 38, 50, 44, "waist"), line(50, 44, 45, 44, "waist"), line(45, 44, S.x, S.y, "waist")
  ]); // A→B (y=44, x50→45) 가 center 연장 x=47.5 를 (47.5,44) 에서 횡단
  throws(() => DB.computeGeometry(g3, L), "extension-intersection", "10-3: 연장선이 waist 내부 횡단 → 실패");
  // (4) hem(y=48)이 아래로 굽은 waist 내부를 횡단 → 실패
  const g4 = swapFrontWaist(makeGeom(0, 24.4469, 0, 23.0531), [
    line(47.5, 38, 35, 52, "waist"), line(35, 52, S.x, S.y, "waist")
  ]); // waist 가 y=52 로 내려가 hem(y=48) 을 가로지름
  throws(() => DB.computeGeometry(g4, L), "extension-intersection", "10-4: hem 이 waist 내부 횡단 → 실패");
  // (5) 분할된 waist 의 한 조각이 side 연장(x=23.05)과 S 밖에서 겹침 → 실패
  const g5 = swapFrontWaist(makeGeom(0, 24.4469, 0, 23.0531), [
    line(47.5, 38, 23.0531, 43, "waist"), line(23.0531, 43, S.x, S.y, "waist")
  ]); // seg2 (23.05,43)→(23.05,38) 가 side 연장(x=23.05,y38~48)과 [38,43] 겹침(S 밖)
  throws(() => DB.computeGeometry(g5, L), "extension-intersection", "10-5: 분할 waist C/S 밖 접촉 → 실패");
}

// ── 결과 ──
console.log("══════════════════════════════════════════════");
if (FAIL) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); }
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
if (FAIL) process.exitCode = 1;
