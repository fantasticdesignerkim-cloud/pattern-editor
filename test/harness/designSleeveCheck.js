// ══════════════════════════════════════════════
// designSleeveCheck.js — js/designSleeve.js S1/S2 순수 파생 회귀.
// S1: cap 고정·하부 실루엣·초기값 재현·착용 경고. S2: cap SP-local 변환(앞/뒤 비율 보존)·
// 앞뒤 봉제 측정·형상 안전성(자기교차)·실패/불변.
//   node test/harness/designSleeveCheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");
const SRC = fs.readFileSync(path.join(__dirname, "..", "..", "js", "designSleeve.js"), "utf8");
let PASS = 0, FAIL = 0; const fails = [];
function ok(cond, name) { if (cond) PASS++; else { FAIL++; fails.push(name); } }
const near = (a, b, e = 0.05) => Math.abs(a - b) < e;

const sandbox = { window: {}, Math, Object, JSON, Array, isFinite, Infinity };
vm.createContext(sandbox);
vm.runInContext(SRC, sandbox, { filename: "designSleeve.js" });
const S = sandbox.window.designSleeve;
ok(typeof S.computeSilhouette === "function" && typeof S.referenceSilhouette === "function" && Object.isFrozen(S), "0: API·frozen");

// 실제 소매 구조 fixture: cap path(뒤 5.53 → apex 23.75,53 → 앞 39.29), 옆선·밑단(폭 30, y105).
const cap = { kind: "path", commands: [
  { type: "M", points: [{ x: 5.53, y: 66.42 }] },
  { type: "C", points: [{ x: 12, y: 56 }, { x: 18, y: 53 }, { x: 23.75, y: 53 }] },
  { type: "C", points: [{ x: 29, y: 53 }, { x: 35, y: 56 }, { x: 39.29, y: 66.42 }] }
] };
const line = (a, b) => ({ kind: "line", from: { x: a[0], y: a[1] }, to: { x: b[0], y: b[1] } });
const sleeve = () => ({ outline: [cap, line([5.53, 66.42], [7.56, 105]), line([39.29, 66.42], [37.56, 105]), line([7.56, 105], [37.56, 105])], construction: [] });
const hemOf = (r) => r.geometry.outline.filter(s => s.kind === "line").find(s => Math.abs(s.from.y - s.to.y) < 0.1 && s.from.y > 60);
const lower = (len, cuff, side) => ({ lower: { sleeveLengthCm: len, cuffCircumferenceCm: cuff, sideShape: side || "straight" } });

// 1. referenceSilhouette: 원형 기준값(+ spX·capHeight)
{
  const ref = S.referenceSilhouette(sleeve());
  ok(ref && near(ref.spX, 23.75) && near(ref.spY, 53) && near(ref.cuffCircumferenceCm, 30), "1: ref spX 23.75·spY 53·cuff 30");
  ok(near(ref.sleeveLengthCm, 52) && near(ref.bicepCm, 33.76, 0.1) && near(ref.capHeightCm, 13.42, 0.1), "1: 소매길이 52·bicep 33.76·capH 13.42");
}
// 2. S1(cap 없음): 초기값 → 원형 밑단 재현 + cap 불변
{
  const ref = S.referenceSilhouette(sleeve());
  const r = S.computeSilhouette(sleeve(), lower(ref.sleeveLengthCm, ref.cuffCircumferenceCm));
  ok(r.ok, "2: S1 파생 성공");
  const hem = hemOf(r);
  ok(hem && near(Math.min(hem.from.x, hem.to.x), 7.56) && near(hem.from.y, 105), "2: 초기값 밑단 원형 재현");
  ok(JSON.stringify(r.geometry.outline.find(s => s.kind === "path")) === JSON.stringify(cap), "2: cap 불변");
  ok(r.warnings.length === 0 && r.capLengths && r.capLengths.total > 0, "2: 경고 없음·capLengths 측정");
}
// 3. S1 짧게+좁게: narrow-cuff, cap 불변
{
  const r = S.computeSilhouette(sleeve(), lower(40, 24));
  ok(near(hemOf(r).from.y, 93) && r.warnings.indexOf("narrow-cuff") >= 0, "3: 길이40 y93·narrow-cuff");
  ok(JSON.stringify(r.geometry.outline.find(s => s.kind === "path")) === JSON.stringify(cap), "3: cap 불변");
}
// 4. S2 cap 변환: bicep 30(원형 33.76보다 좁게)·capHeight 15 → 진동밑점 이동·앞뒤 비율 보존·SP 고정
{
  const ref = S.referenceSilhouette(sleeve());
  const r = S.computeSilhouette(sleeve(), Object.assign(lower(52, 30), { cap: { bicepCircumferenceCm: 30, capHeightCm: 15 } }));
  ok(r.ok, "4: S2 파생 성공");
  ok(near(r.bicepCircumferenceCm, 30) && near(r.capHeightCm, 15), "4: bicep 30·capH 15 반영");
  // cap 끝점(진동밑) — 앞/뒤 폭 비율 보존: refBack 18.22 refFront 15.54 → new 총 30
  const capPath = r.geometry.outline.find(s => s.kind === "path");
  const backU = capPath.commands[0].points[0];
  const lastC = capPath.commands[capPath.commands.length - 1].points;
  const frontU = lastC[lastC.length - 1];
  const newBackW = 23.75 - backU.x, newFrontW = frontU.x - 23.75;
  ok(near(newBackW / (newBackW + newFrontW), 18.22 / 33.76, 0.01), "4: 앞/뒤 폭 비율 원형 보존");
  ok(near(newBackW + newFrontW, 30, 0.1), "4: 총 bicep 30");
  ok(near(backU.y, 68) && near(frontU.y, 68), "4: 진동밑 y = SP 53 + capH 15 = 68");
  // SP(apex) x 고정
  const apex = S.measureCapSeam([capPath]); ok(apex && apex.front > 0 && apex.back > 0, "4: 변환 cap 앞/뒤 측정 가능");
}
// 5. S2 앞/뒤 봉제 길이: 원형 대비 변화, front≠back(비대칭 보존)
{
  const r0 = S.computeSilhouette(sleeve(), lower(52, 30));   // S1(원형 cap)
  const r2 = S.computeSilhouette(sleeve(), Object.assign(lower(52, 30), { cap: { bicepCircumferenceCm: 30, capHeightCm: 15 } }));
  ok(r0.capLengths.front !== r0.capLengths.back, "5: 원형 cap 앞≠뒤(비대칭)");
  ok(r2.capLengths.total !== r0.capLengths.total, "5: S2 변환으로 봉제 길이 변화");
}
// 6. S2 실패 계약 + 형상 안전성
{
  ok(S.computeSilhouette(sleeve(), Object.assign(lower(52, 30), { cap: { bicepCircumferenceCm: 0, capHeightCm: 15 } })).reason === "invalid-bicep", "6: invalid-bicep");
  ok(S.computeSilhouette(sleeve(), Object.assign(lower(52, 30), { cap: { bicepCircumferenceCm: 30, capHeightCm: -2 } })).reason === "invalid-cap-height", "6: invalid-cap-height");
  // 극단(bicep 2·capH 0.3): cap 이 붕괴하면 self-intersection 또는 측정 불가로 원자적 실패(또는 정상)
  const ext = S.computeSilhouette(sleeve(), Object.assign(lower(52, 30), { cap: { bicepCircumferenceCm: 2, capHeightCm: 0.5 } }));
  ok(ext.ok === true || ext.reason === "self-intersection" || ext.reason === "cap-unmeasured", "6: 극단 입력 = 정상 또는 원자적 실패");
}
// 7. S1 실패 계약(하위)
{
  ok(S.computeSilhouette(null, lower(50, 30)).reason === "no-sleeve", "7: no-sleeve");
  ok(S.computeSilhouette(sleeve(), lower(0, 30)).reason === "invalid-length", "7: invalid-length");
  ok(S.computeSilhouette(sleeve(), lower(50, -5)).reason === "invalid-cuff", "7: invalid-cuff");
  ok(S.computeSilhouette(sleeve(), {}).reason === "invalid-length", "7: lower 누락 → invalid-length");
}
// 8. 입력 불변(S2 포함)
{
  const g = sleeve(); const snap = JSON.stringify(g);
  S.computeSilhouette(g, Object.assign(lower(45, 28, "gentle"), { cap: { bicepCircumferenceCm: 31, capHeightCm: 14 } }));
  ok(JSON.stringify(g) === snap, "8: 입력 sleeve 불변");
}

// 9. S3 capLineFromGeometry: 원형 cap → 관리형 선(뒤→SP→앞) + splitAnchorIndex(apex)
{
  const lc = S.capLineFromGeometry(sleeve());
  ok(lc && Array.isArray(lc.segments) && lc.segments.length >= 2, "9: cap 선 세그먼트");
  const anchors = lc.segments.map(s => s.from).concat([lc.segments[lc.segments.length - 1].to]);
  ok(near(anchors[0].x, 5.53) && near(anchors[anchors.length - 1].x, 39.29), "9: 뒤(5.53)→앞(39.29) 방향");
  ok(lc.splitAnchorIndex >= 1 && lc.splitAnchorIndex <= anchors.length - 2 && near(anchors[lc.splitAnchorIndex].y, 53, 0.5), "9: SP = apex 최근접 anchor(y≈53)");
}
// 10. S3 computeFromCapLine: 관리형 선 + lower → 소매 재합성 + SP 분할 측정
{
  const lc = S.capLineFromGeometry(sleeve());
  const r = S.computeFromCapLine(sleeve(), lc.segments, lc.splitAnchorIndex, { sleeveLengthCm: 52, cuffCircumferenceCm: 30, sideShape: "straight" });
  ok(r.ok && r.capLengths.front > 0 && r.capLengths.back > 0, "10: 재합성·앞/뒤 분리 측정");
  ok(r.capLengths.front !== r.capLengths.back, "10: 앞≠뒤(비대칭 보존)");
  const hem = hemOf(r); ok(hem && near(hem.from.y, 105), "10: 하부(밑단) 재생성");
}
// 11. S3 편집: SP anchor 를 위로 이동 → cap 길이 변화(길어짐)
{
  const lc = S.capLineFromGeometry(sleeve());
  const r0 = S.computeFromCapLine(sleeve(), lc.segments, lc.splitAnchorIndex, { sleeveLengthCm: 52, cuffCircumferenceCm: 30 });
  const segs = JSON.parse(JSON.stringify(lc.segments));
  const sp = lc.splitAnchorIndex;
  segs[sp - 1].to.y -= 4; segs[sp].from.y -= 4;   // SP 공유 anchor 위로(같은 점)
  const r1 = S.computeFromCapLine(sleeve(), segs, sp, { sleeveLengthCm: 52, cuffCircumferenceCm: 30 });
  ok(r1.ok && r1.capLengths.total > r0.capLengths.total, "11: SP 상승 → cap 봉제 길어짐");
}
// 12. S3 위상/안전 실패
{
  const lc = S.capLineFromGeometry(sleeve());
  const segs = JSON.parse(JSON.stringify(lc.segments));
  const sp = lc.splitAnchorIndex;
  // SP 를 진동밑 아래로 → cap-order
  const bad = JSON.parse(JSON.stringify(segs)); bad[sp - 1].to.y = 80; bad[sp].from.y = 80;
  ok(S.computeFromCapLine(sleeve(), bad, sp, { sleeveLengthCm: 52, cuffCircumferenceCm: 30 }).reason === "cap-order", "12: SP 진동밑 아래 → cap-order");
  // split 인덱스 범위 밖
  ok(S.computeFromCapLine(sleeve(), segs, 0, { sleeveLengthCm: 52, cuffCircumferenceCm: 30 }).reason === "cap-split", "12: split=0 → cap-split");
  ok(S.computeFromCapLine(sleeve(), [], sp, { sleeveLengthCm: 52, cuffCircumferenceCm: 30 }).reason === "no-cap-line", "12: 빈 cap 선 → no-cap-line");
}

console.log("══════════════════════════════════════════════");
if (FAIL) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); }
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
