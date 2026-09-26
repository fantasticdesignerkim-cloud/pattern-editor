// ══════════════════════════════════════════════
// bodicePresetsCheck.js — js/bodicePresets.js 카탈로그 계약 + designBodice 다트 배분 연동.
//   node test/harness/bodicePresetsCheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");

let PASS = 0, FAIL = 0; const fails = [];
function ok(cond, name) { if (cond) PASS++; else { FAIL++; fails.push(name); } }
function throwsReason(fn, want, name) {
  try { fn(); FAIL++; fails.push(name + " (throw 안 됨)"); }
  catch (e) { if (want && e.reason !== want) { FAIL++; fails.push(name + ` (reason=${e.reason}, 기대=${want})`); } else PASS++; }
}
const J = JSON.stringify;
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

const sandbox = { window: {}, Math, JSON, Object, Array, isFinite, structuredClone, console };
sandbox.window = sandbox;
vm.createContext(sandbox);
const load = (f) => vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "..", "js", f), "utf8"), sandbox, { filename: f });
load("designBodice.js");
load("bodicePresets.js");
const BP = sandbox.window.bodicePresets, DB = sandbox.window.designBodice;

// ── 1. 카탈로그 구조: 교재 순서·표식·쪽번호 ──
{
  const F = BP.families();
  ok(F.length === 10 && Object.isFrozen(F), "1: 라인 10개·frozen");
  const want = [["boxy-line", 1, "박시 라인", "A", 14], ["shaped-line", 2, "셰이프트 라인", "C", 16],
    ["princess-line", 3, "프린세스 라인", "E", 18], ["flare-line", 4, "플레어 라인", "G", 20],
    ["neck-tuck", 5, "목둘레에 턱을 넣는다", "I", 22], ["neck-gather", 6, "목둘레에 개더를 넣는다", "K", 24],
    ["waist-seam", 7, "허리 이음선", "M", 26], ["yoke-seam-1", 8, "요크 이음선 ①", "Q", 30],
    ["yoke-seam-2", 9, "요크 이음선 ②", "S", 32], ["yoke-seam-3", 10, "요크 이음선 ③", "U", 34]];
  ok(J(F.map(f => [f.id, f.order, f.label, f.symbol, f.page])) === J(want), "1: 교시 순서·id·표시명·표식·쪽");
  const syms = F.flatMap(f => f.variants.map(v => v.symbol));
  ok(J(syms) === J(["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V"]),
    "1: 변형 22개 A~V(교재 표식 순서)");
  ok(F.flatMap(f => f.variants).every(v => v.page >= 14 && v.page <= 35), "1: 전부 P.14–35");
}

// ── 2. 실행/보류 구분 ──
{
  const F = BP.families();
  const avail = F.flatMap(f => f.variants).filter(v => v.availability === "available");
  ok(J(avail.map(v => v.symbol)) === J(["A", "B", "C", "D", "G"]), "2: 실행 가능 = 박시 A·B + 셰이프트 C·D + 플레어 G");
  ok(avail.every(v => v.presetId === v.id && BP.get(v.presetId)), "2: 실행 슬롯은 레코드를 가리킨다");
  const pend = F.flatMap(f => f.variants).filter(v => v.availability !== "available");
  ok(pend.length === 17 && pend.every(v => v.presetId === null), "2: 보류 17개는 레코드 없음");
  // ★ 보류는 **왜 못 그리는지**를 반드시 들고 있다 — 없으면 "그냥 아직 안 함"과 구별이 안 된다
  ok(pend.every(v => typeof v.blockedBy === "string" && v.blockedBy.length > 0), "2: 보류 전부 blockedBy 기록");
  ok(BP.familyOptions().filter(o => !o.available).length === 7, "2: 비활성 라인 7개(플레어 해제)");
  ok(BP.resolve("princess-line", "bunka-bodice-E").reason === "bodice-preset-unavailable", "2: 보류는 명시적 거부");
  ok(BP.resolve("nope", "x").reason === "unknown-bodice-family" && BP.get("nope") === null, "2: 알 수 없는 선택 거부");
  // 절대 다른 프리셋으로 대체하지 않는다
  ok(BP.resolve("princess-line", "bunka-bodice-E").presetId === undefined, "2: 거부 시 presetId 없음");
}

// ── 3. 레코드 = body 파라미터 묶음(형상 데이터 없음) ──
{
  ok(J(BP.bodyParams("bunka-bodice-A")) === J({ hemExtensionBelowWaistCm: 20 }), "3: A = 밑단(엉덩이 길이 20)만");
  ok(J(BP.bodyParams("bunka-bodice-B")) === J({ hemExtensionBelowWaistCm: 20, hemSideOffsetCm: 1 }), "3: B = 밑단 +1(밑단이 있어야 유효)");
  ok(J(BP.bodyParams("bunka-bodice-C")) === J({ hemExtensionBelowWaistCm: 20, waistSideOffsetCm: -1, hemSideOffsetCm: 1, waistDartScales: { a: 1, b: 0, d: 0, e: 1 } }), "3: C = 다트 a·e · 옆선 −1 · 밑단 +1");
  ok(J(BP.bodyParams("bunka-bodice-D")) === J({ hemExtensionBelowWaistCm: 20, waistSideOffsetCm: -1.5, hemSideOffsetCm: 1, waistDartScales: { a: 1, b: 1, d: 0.5, e: 1 } }), "3: D = d 만 ½ · 옆선 −1.5 · 밑단 +1");
  ok(BP.bodyParams("bunka-bodice-A") !== BP.bodyParams("bunka-bodice-A"), "3: 매번 새 복사본");
  // ★ 미지정 키는 넣지 않는다 — 호출부의 "미지정 = 기본값" 계약을 깨지 않기 위해
  ok(!("waistDartTotalCm" in BP.bodyParams("bunka-bodice-C")) && !("targetFinishedWaistCm" in BP.bodyParams("bunka-bodice-C")),
    "3: 라인은 다트 **배분**만 정하고 총량·목표는 정하지 않는다");
  ok(!("bustEaseCm" in BP.bodyParams("bunka-bodice-B")), "3: 안 쓰는 키는 아예 없다");
  // 레코드 검증
  const bad = (patch) => { const r = JSON.parse(J(BP.get("bunka-bodice-C"))); Object.assign(r, patch); return r; };
  throwsReason(() => BP.validateRecord(bad({ id: "x", body: { nope: 1 } })), "unknown-body-key", "3: 모르는 body 키 거부");
  throwsReason(() => BP.validateRecord(bad({ id: "x", body: { waistDartScales: { c: 1 } } })), "unknown-dart-symbol", "3: c·f 는 배분 대상이 아니다");
  throwsReason(() => BP.validateRecord(bad({ id: "x", body: { waistDartScales: { a: -1 } } })), "invalid-body", "3: 음수 배율 거부");
  throwsReason(() => BP.validateRecord(bad({ id: "x", geometry: {} })), "record-shape-data", "3: 형상 데이터 거부");
  // 플레어 Ⓖ — 다트 배분 0 이 **함께** 들어 있어야 한다(designFlare 가 봉제 허리다트를 거부한다)
  {
    const G = BP.bodyParams("bunka-bodice-G");
    ok(G.flare === true, "3: G = flare");
    ok(J(G.waistDartScales) === J({ a: 0, b: 0, d: 0, e: 0 }), "3: G 는 허리 다트를 0 으로 함께 지정");
    ok(G.hemExtensionBelowWaistCm === 20 && G.hemSideOffsetCm === 3, "3: G = 밑단 20 · 밑단 폭 +3");
    throwsReason(() => BP.validateRecord(bad({ id: "x", body: { flare: 1 } })), "invalid-body", "3: flare 는 true 만");
  }
}

// ── 4. designBodice 연동: 배분이 실제 형상에 반영되는가 ──
{
  const line = (a, b, edge) => { const s = { kind: "line", from: { x: a[0], y: a[1] }, to: { x: b[0], y: b[1] } }; if (edge) s.edge = edge; return s; };
  const dleg = (mx, my, ax, ay, id, extra) => Object.assign(line([mx, my], [ax, ay]),
    { dart: Object.assign({ id: id, boundary: "waist", apexAt: "to" }, extra || {}) });
  const piece = (Cx, sign, W, darts) => ({
    outline: [line([Cx, 28], [Cx, 38], "center"), line([Cx, 38], [Cx + sign * W, 38], "waist"),
      line([Cx + sign * W, 30], [Cx + sign * W, 38], "side-seam")],
    construction: darts
  });
  const ref = () => ({
    front: piece(47.5, -1, 24.45, [
      dleg(37.5, 38, 38.5, 22, "front-waist-a"), dleg(39.5, 38, 38.5, 22, "front-waist-a"),
      dleg(29, 38, 30, 15, "front-waist-b"), dleg(31, 38, 30, 15, "front-waist-b"),
      dleg(23.05, 38, 23.05, 20.6, "front-side-waist-c", { locked: true, group: "side-waist-c" }), dleg(23.75, 38, 23.05, 20.6, "front-side-waist-c", { locked: true, group: "side-waist-c" })
    ]),
    back: piece(0, +1, 23.05, [
      dleg(14.5, 38, 16.75, 14.8, "back-waist-d"), dleg(19, 38, 16.75, 14.8, "back-waist-d"),
      dleg(8.2, 38, 9.3, 18.6, "back-waist-e"), dleg(10.4, 38, 9.3, 18.6, "back-waist-e"),
      dleg(0.5, 38, 0, 12.2, "back-waist-f", { onFold: true })
    ]),
    shared: { outline: [], construction: [] }, sleeve: { outline: [], construction: [] }
  });
  const ids = (g, p) => (g[p].construction || []).map(s => s.dart && s.dart.id).filter((v, i, a) => v && a.indexOf(v) === i);
  const width = (g, p, id) => {
    const segs = (g[p].construction || []).filter(s => s.dart && s.dart.id === id);
    if (segs.length !== 2) return null;
    const m = s => (s.dart.apexAt === "to" ? s.from : s.to);
    return Math.abs(m(segs[0]).x - m(segs[1]).x);
  };
  const R = ref(), SNAP = J(R);

  // C: b·d 를 0 으로 → **세그먼트가 사라져야 한다**(폭 0 잔선을 남기지 않는다)
  {
    const r = DB.computeGeometry(R, { body: BP.bodyParams("bunka-bodice-C") });
    ok(ids(r, "front").indexOf("front-waist-b") < 0 && ids(r, "back").indexOf("back-waist-d") < 0, "4: C — b·d 다트가 제거된다(폭 0 아님)");
    ok(near(width(r, "front", "front-waist-a"), 2) && near(width(r, "back", "back-waist-e"), 2.2), "4: C — a·e 는 원형 그대로");
    ok(width(r, "front", "front-side-waist-c") !== null, "4: C — 옆선 조임 c 는 남는다(배분 대상 아님)");
    ok(ids(r, "back").indexOf("back-waist-f") >= 0, "4: C — 뒤중심 f 도 남는다");
  }
  // D: d 만 ½
  {
    const r = DB.computeGeometry(R, { body: BP.bodyParams("bunka-bodice-D") });
    ok(near(width(r, "back", "back-waist-d"), 4.5 * 0.5), "4: D — d 만 ½");
    ok(near(width(r, "front", "front-waist-a"), 2) && near(width(r, "front", "front-waist-b"), 2) && near(width(r, "back", "back-waist-e"), 2.2), "4: D — a·b·e 는 원형");
  }
  // A: 변형 없음 = no-op
  // Ⓐ 는 밑단(엉덩이 길이 20)을 만든다 — 픽스처는 hem edge 가 없어 이 검사는 프리셋 내용으로만 한다.
  ok(BP.bodyParams("bunka-bodice-A").hemExtensionBelowWaistCm === 20
     && Object.keys(BP.bodyParams("bunka-bodice-A")).length === 1, "4: A — 밑단 생성뿐, 다른 변형 없음");
  // ★ 밑단 오프셋은 밑단이 있어야 효과가 있다 — 밑단 없는 Ⓑ 는 Ⓐ 와 구별되지 않는다(회귀로 못 박는다)
  ok(J(DB.computeGeometry(R, { body: { hemSideOffsetCm: 1 } })) === J(DB.computeGeometry(R, { body: {} })),
    "4: 밑단 없이 준 밑단 오프셋은 무시된다(프리셋이 반드시 밑단을 함께 준다)");
  // ★ 배분과 총량은 다른 축이라 함께 써도 과결정이 아니다(배분 유지 + 크기만 맞춤)
  {
    const r = DB.computeGeometry(R, { body: Object.assign(BP.bodyParams("bunka-bodice-D"), { waistDartTotalCm: 4 }) });
    const tot = DB.sewnWaistDartTotal(r.front) + DB.sewnWaistDartTotal(r.back);
    ok(near(tot, 4), "4: 배분 + 총량 결합 — 합이 총량과 일치");
    const wa = width(r, "front", "front-waist-a"), wd = width(r, "back", "back-waist-d");
    ok(near(wd / wa, (4.5 * 0.5) / 2), "4: 배분 비율(d ½)이 총량 조정 후에도 유지");
  }
  // 잘못된 배분은 거부
  throwsReason(() => DB.computeGeometry(R, { body: { waistDartScales: { a: -1 } } }), "invalid-waist-dart-scales", "4: 음수 배율 거부");
  throwsReason(() => DB.computeGeometry(R, { body: { waistDartScales: { ab: 1 } } }), "invalid-waist-dart-scales", "4: 기호 아닌 키 거부");
  ok(J(R) === SNAP, "4: 입력 geometry 불변");
}

console.log("══════════════════════════════════════════════");
if (FAIL) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); }
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
