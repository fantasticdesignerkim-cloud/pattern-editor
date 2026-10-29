// ══════════════════════════════════════════════
// sleeveNUICheck.js — 소매 Ⓝ(P.47 반소매 퍼프·소맷부리 턱, 화면 검토용 시안) 연결 회귀: 카탈로그 · sleeveNApply · 표시 줄 · 완료본 · 제작 정보(원래 종이 4조각·틈·턱 띠·사선·최종선) · 비교 도안 · 배선.
//   node test/harness/sleeveNUICheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");

let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
const J = JSON.stringify;
const ROOT = path.join(__dirname, "..", "..");

let PROJECT = null;
const sandbox = {
  window: {}, console: { log() {}, warn() {} }, Math, JSON, Object, Array, isFinite, structuredClone, Error, Date,
  c2p: (x, y) => [x * 10, y * 10],
  document: { createElementNS: () => ({ setAttribute() {}, appendChild() {} }) }
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
const load = (f) => vm.runInContext(fs.readFileSync(path.join(ROOT, "js", f), "utf8"), sandbox, { filename: f });
sandbox.window.designWorkflow = { current: () => PROJECT };
["designLineTool.js", "designFlare.js", "designJoin.js", "designWaistSeam.js", "designYokeSeam.js", "designPrincess.js", "designBodice.js", "bodicePresets.js",
  "designLayout.js", "designRenderer.js", "bodiceCheckpoint.js", "peplumAnnotation.js", "designSleeve.js", "sleeveMeasure.js", "sleeveCheckpoint.js",
  "designSleeveA.js", "designSleeveB.js", "sleevePresets.js", "sleeveAApply.js", "sleeveBApply.js", "designSleeveC.js", "sleeveCApply.js", "designSleeveD.js", "sleeveDApply.js",
  "designSleeveE.js", "sleeveEApply.js", "designSleeveF.js", "sleeveFApply.js", "designSleeveG.js", "sleeveGApply.js", "designSleeveH.js", "sleeveHApply.js",
  "designSleeveI.js", "sleeveIApply.js", "designSleeveJ.js", "sleeveJApply.js", "designSleeveK.js", "sleeveKApply.js", "designSleeveL.js", "sleeveLApply.js",
  "designSleeveM.js", "sleeveMApply.js", "designSleeveN.js", "sleeveNApply.js", "sleeveAnnotation.js", "designCollar.js", "collarCheckpoint.js", "designResult.js"].forEach(load);
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, BC = W.bodiceCheckpoint, SA = W.designSleeveA, SP = W.sleevePresets, DS = W.designSleeve,
  SNA = W.sleeveNApply, SN = W.designSleeveN, SMA = W.sleeveMApply, SC = W.sleeveCheckpoint, SAN = W.sleeveAnnotation;
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));
const MK = (body) => ({ sourceBlock: { id: "blk", version: 2, schemaVersion: 8, canonicalHash: "abc" }, referenceGeometry: JSON.parse(J(REF)),
  working: { geometry: DB.computeGeometry(REF, { body }), parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body },
    patternLines: [], designOutline: null, frontPlacket: null } });
const presetOf = (sym) => { for (const f of BP.families()) for (const v of f.variants) if (v.symbol === sym) return v.presetId; return null; };
function projectWithBodice(sym) { PROJECT = MK(BP.bodyParams(presetOf(sym))); const r = BC.complete(PROJECT); return r.ok ? PROJECT : null; }
const f2 = v => (Math.round(v * 100) / 100).toFixed(2), sg = v => (v >= 0 ? "+" : "") + f2(v);
const T = (m, id) => { const l = m.lines.find(x => x.id === id) || m.dims.find(x => x.id === id); return l ? l.text : null; };

const IN = { sleeveLengthCm: 20, cutOffsetCm: 2.5, centerTuckCm: 4, sideTuckCm: 2, stitchEndCm: 1.5 };
const VER = "2026102101";
// ── 1. 카탈로그 ──
{
  const f = SP.family("short-sleeve"), rec = SP.get("bunka-sleeve-N");
  ok(f.variants.map(v => v.symbol).join("") === "LMNOPQ" && f.variants[2].availability === "available" && f.variants[2].presetId === "bunka-sleeve-N" && f.variants[2].page === 47
    && f.variants.every(v => v.availability === "available"), "1: 반소매 = Ⓛ~Ⓠ 모두 실행");
  ok(rec && rec.methodPage === 47 && rec.inputs.map(i => i.key + "=" + i.defaultValue).join() === "sleeveLengthCm=20,cutOffsetCm=2.5,centerTuckCm=4,sideTuckCm=2,stitchEndCm=1.5" && Object.isFrozen(rec), "1: Ⓝ 레코드 · 책 기본 설정값 5개 — 커프스·위팔·손바닥·상승 없음");
  ok(SP.resolve("short-sleeve", "bunka-sleeve-N").ok && SP.resolve("short-sleeve", "bunka-sleeve-Q").ok, "1: resolve Ⓝ · Ⓠ 가능");
}
const P = projectWithBodice("A");
const bodice = P.working.bodiceResult, AH = bodice.armholeLengths, snap = { bodice: J(bodice), ref: J(P.referenceGeometry) };
// ── 2. 적용 ──
{
  const r = SNA.apply(P, IN), S = P.working.sleeveN, g = P.working.geometry.sleeve;
  const a = SA.draftSleeveA(bodice, { sleeveLengthCm: 20 }), e = SN.draftSleeveN(a, IN);
  ok(r.ok && S.presetId === "bunka-sleeve-N" && J(S.parameters) === J(IN) && J(S.meta) === J(e.meta) && J(g.outline) === J(e.geometry.outline) && J(g.capSplit) === J(e.geometry.capSplit) && g.capSplit.x === a.meta.sp.x,
    "2: 적용 — 상태·geometry(분할 기준 포함) = 엔진 · 출발 = 소매길이 20 의 Ⓐ");
  ok(S.sourceSleeveAHash === e.sourceSleeveAHash && S.sourceBodiceHash === bodice.hash, "2: 출처 hash(몸판 · 출발 Ⓐ)");
  const roles = g.construction.map(c => c.role);
  ok(roles.slice(0, 7).join() === "center-line,cut-center-back,cut-center-front,cut-axis-back,cut-edge-back,cut-axis-front,cut-edge-front" && ["tuck-crease", "tuck-place", "tuck-mid", "tuck-stitch-end"].every(k => roles.filter(x => x === k).length === 4), "2: 표시 construction = 절개 7 + 턱 표시 16");
  ok(J(bodice) === snap.bodice && J(P.referenceGeometry) === snap.ref && P.working.sleeveM === undefined && P.working.sleeveResult === undefined, "2: 몸판·원형 불변");
  const bad = SNA.apply(projectWithBodice("A"), { sleeveLengthCm: 20, cutOffsetCm: 1, centerTuckCm: 4, sideTuckCm: 2, stitchEndCm: 1.5 });
  ok(!bad.ok && bad.reason === "tuck-layer-exceeds-piece" && /이 시안의 접힘 모델 범위 밖/.test(bad.text) && /물리 불가 판정은 아닙니다/.test(bad.text), "2: 접힘 모델 범위 밖 — 책 규칙·물리 불가 아님을 문구로 구분");
  const se = SNA.apply(projectWithBodice("A"), { sleeveLengthCm: 20, cutOffsetCm: 2.5, centerTuckCm: 4, sideTuckCm: 2, stitchEndCm: 30 });
  ok(!se.ok && se.reason === "stitch-end-beyond-pivot" && /다리 길이/.test(se.text), "2: 박기 끝 > 다리 → 사유");
  PROJECT = P;
}
// ── 3. 표시 줄 ──
{
  const L = SNA.infoLines(P), m = P.working.sleeveN.meta, prim = DS.capPrimitives(P.working.geometry.sleeve);
  ok(L.length === 10 && /^반소매 퍼프·소맷부리 턱 Ⓝ \(화면 검토용 시안\) · 소매길이 20\.00 의 소매 Ⓐ 에 절개 3개\(중심선 \+ 좌우 각 2\.50\)/.test(L[0]), "3: 표시 줄 10줄 · 시안");
  ok(L[1] === "설정(책 기본값 — 수정 가능, 산식 아님): 절개 중심선 좌우 각 2.50 · 벌림(소맷부리 현) 가운데 4.00 · 양옆 각 2.00 · 박기 끝 1.50 cm · 커프스·개더 없음", "3: 설정값(산식 아님)");
  ok(/^이동: 가운데 두 조각 SP 대칭 ±/.test(L[2]) && /함께 운반된 기준점 중심/.test(L[2]) && /가운데 4\.00/.test(L[2]), "3: 이동 순서·실제 벌림");
  ok(/^턱: 중심 쪽으로 접음/.test(L[3]) && /겹은 바깥 조각 아래/.test(L[3]) && /중심선에서 맞닿음/.test(L[3]), "3: 턱 접힘 방향·겹");
  ok(/^박기 끝 1\.50: /.test(L[4]) && /재단선 모양은 박기 끝 길이와 무관/.test(L[4]) && /책에 없어 만들지 않음/.test(L[4]), "3: 박기 끝 영향·박음 모양 추측 없음");
  ok(L[5] === "소맷부리(최종 geometry 실측) 재단(펼침) " + f2(m.hem.cutCm) + " · 봉제(턱 접음) " + f2(m.hem.sewnCm) + " cm (턱에 숨는 길이 " + f2(m.hem.hiddenCm) + ") · 참고 산식 W + 가운데 + 양옆 = " + f2(m.hem.formulaCutCm) + " · W " + f2(m.widthCm), "3: 재단·봉제 실측 · 참고 산식 구분");
  ok(/파임 0\.00 · 덧댐 0\.00/.test(L[6]) && /좌표 역변환/.test(L[6]) && /잠정 — 책 규칙 아님/.test(L[7]) && /소매산 개더 없음/.test(L[7]), "3: 접은 상태 정리 0 · 재제도 잠정");
  ok(L[8] === "길이: 입력 소매길이(SP → 출발 밑단) 20.00 · 벌린 뒤 중심 길이(새 꼭대기 → 소맷부리, 실측) " + f2(m.centerLength.spreadCm) + " cm", "3: 길이 구분");
  const tf = prim.lengths.front - AH.front, tb = prim.lengths.back - AH.back;
  ok(L[9] === "소매산(최종 실측) 앞 " + f2(prim.lengths.front) + " · 뒤 " + f2(prim.lengths.back) + " · 총 " + f2(prim.lengths.total) + " cm · AH 앞 " + f2(AH.front) + " · 뒤 " + f2(AH.back) + " · 이세 앞 " + sg(tf) + " · 뒤 " + sg(tb) + " · 총 " + sg(tf + tb) + " cm", "3: 소매산 앞뒤·AH·이세");
}
// ── 4. 차단·배타 ──
{
  const Q = projectWithBodice("A"); SNA.apply(Q, IN);
  const raw = { sleeveLength: "20", cutOffsetCm: "1", centerTuckCm: "4", sideTuckCm: "2", stitchEndCm: "1.5" };
  ok(SNA.reject(Q, { reason: "tuck-layer-exceeds-piece", text: "x", attemptedInputs: raw }) && SC.check(Q).fails.indexOf("sleeve-n-blocked") >= 0
    && J(Q.working.sleeveN.blocked.attemptedInputs) === J(raw) && J(Q.working.sleeveN.parameters) === J(IN), "4: 차단 — 거부된 입력 원문 보관 · 적용값 그대로");
  ok(SNA.infoLines(Q).length === 2 && /^⚠ 차단: x/.test(SNA.infoLines(Q)[1]) && SAN.buildModel(Q) === null, "4: 차단 중 표시 = 사유만 · 설명 모델 없음");
  ok(SNA.rederive(Q).ok && !SNA.isBlocked(Q), "4: 재제도로 차단 해제");
  SMA.apply(Q, { sleeveLengthCm: 20, upperArmCm: 26, riseCm: 0.5 });
  ok(SC.check(Q).fails[0] === "sleeve-line-conflict", "4: Ⓜ·Ⓝ 동시 → 충돌(ui 배타)"); PROJECT = P;
}
// ── 5. 완료본 ──
{
  const c = SC.check(P);
  ok(c.ok && c.preset === "bunka-sleeve-N" && c.hemLengths && Math.abs(c.hemLengths.sewn.total - P.working.sleeveN.meta.widthCm) < 1e-9, "5: 게이트 통과 · 소맷부리 봉제 길이 재실측 = W " + J(c.fails));
  const R = SC.complete(P).result, prim = DS.capPrimitives(P.working.geometry.sleeve);
  ok(R && R.origin.presetId === "bunka-sleeve-N" && R.origin.methodPage === 47 && J(R.inputs) === J(IN) && Object.isFrozen(R) && Object.isFrozen(R.cap) && J(R.geometry) === J(P.working.geometry.sleeve),
    "5: 완료본 origin·inputs·geometry 동결 복사");
  ok(Math.abs(R.cap.lengths.back - prim.lengths.back) < 1e-3 && Math.abs(R.cap.splitPoint.x - R.geometry.capSplit.x) < 1e-9 && R.sourceSleeveAHash === P.working.sleeveN.sourceSleeveAHash, "5: 완료본 계측 = 중심선 기준 · 출처 hash");
  const h0 = R.hash;
  ok(SC.isCurrentSleeveChanged(P) === false, "5: 완료 직후 변경 없음");
  SNA.apply(P, Object.assign({}, IN, { stitchEndCm: 2 })); ok(SC.isCurrentSleeveChanged(P) === true && P.working.sleeveResult.hash === h0, "5: 박기 끝 변경 → 변경됨(완료본 그대로)");
  SNA.apply(P, Object.assign({}, IN, { centerTuckCm: 3 })); ok(SC.isCurrentSleeveChanged(P) === true, "5: 벌림 변경 → 변경됨");
  SNA.apply(P, IN); ok(SC.isCurrentSleeveChanged(P) === false && P.working.sleeveResult.hash === h0, "5: 같은 입력 재적용 → 변경 없음 · hash 불변"); SC.complete(P);
  const hemSeg = P.working.geometry.sleeve.outline.find(s => s.role === "hem"), keep = J(hemSeg.commands);
  hemSeg.commands[1].points[2].y += 0.01; ok(SC.check(P).fails.indexOf("hem-length-mismatch") >= 0 || SC.check(P).fails.indexOf("hem-unmeasured") >= 0, "5: 소맷부리가 바뀐 geometry 는 게이트에서 거부"); hemSeg.commands = JSON.parse(keep);
  delete P.working.geometry.sleeve.capSplit; ok(SC.check(P).fails.indexOf("sleeve-n-geometry-mismatch") >= 0, "5: 분할 기준이 사라진 geometry 는 게이트에서 거부"); SNA.apply(P, IN);
  PROJECT = P;
}
// ── 6. 제작 정보 ──
{
  const mOn = SAN.buildModel(P), mOff = SAN.buildModel(P, { pieces: false }), M = P.working.sleeveN.meta;
  ok(mOn && mOn.line === "N" && /화면 검토용 시안/.test(mOn.title) && /턱은 중심 쪽/.test(mOn.title), "6: Ⓝ 모델");
  const pz = mOn.zones.filter(z => z.cls === "paper"), keys = ["backOuter", "backCenter", "frontCenter", "frontOuter"];
  ok(pz.map(z => z.id).join() === keys.map(k => "paper-" + k).join() && keys.every(k => J(pz.find(z => z.id === "paper-" + k).pts) === J(M.rigid.pieces[k])), "6: 원래 종이 4조각(녹색) = 엔진 강체 자료 그대로");
  ok(mOn.zones.filter(z => z.cls === "zone").map(z => z.id).join() === "wedge-center,wedge-back,wedge-front,tuck-back-side,tuck-center-back,tuck-center-front,tuck-front-side" && mOn.zones.map(z => z.cls).lastIndexOf("paper") < mOn.zones.findIndex(z => z.cls === "zone"), "6: 틈 3곳 + 턱 접힘 띠 4 음영(종이 위)");
  ok(mOn.refs.filter(r => /^tuck-mark-/.test(r.id)).length === 8, "6: 턱 사선 표시 8");
  const o = M.spread.openedCm;
  ok(T(mOn, "open-center") === "가운데 " + f2(o.center) && T(mOn, "open-back") === "양옆 " + f2(o.back) && T(mOn, "tuck-back-side") === "턱 2.00 → 중심" && T(mOn, "tuck-front-side") === "중심 ← 턱 2.00" && T(mOn, "tuck-center") === "→ 턱 4.00 ←" && /두 반쪽이 중심선에서 맞닿음/.test(J(mOn.lines)) && T(mOn, "stitch-end") === "박기 끝 1.50 (소맷부리에서)", "6: 벌림·턱 방향·박기 끝 표기");
  const all = J(mOn.lines);
  ok(/녹색 = 원래 종이 4조각/.test(all) && /남색 실선 = 최종 재단선/.test(all) && /재단\(펼침\) /.test(all) && /봉제\(턱 접음\) /.test(all) && /참고 산식 W \+ 가운데 \+ 양옆/.test(all) && /소매산 개더 없음/.test(all) && /"뒤"/.test(all) && /"앞"/.test(all), "6: 범례·재단/봉제·참고 산식·앞뒤");
  ok(/꼭대기→소맷부리\(중심\) /.test(T(mOn, "len")) && / · 이세 /.test(T(mOn, "cap-back-2")), "6: 중심 길이·이세(개더 아님) 표기");
  ok(!mOff.zones.some(z => z.cls === "paper") && mOff.zones.filter(z => z.cls === "zone").length === 7, "6: 녹색 토글 끔(틈·턱 띠는 유지)");
  const before = J({ g: P.working.geometry, s: P.working.sleeveN, r: P.working.sleeveResult }), hb = P.working.sleeveResult.hash;
  SAN.buildModel(P); SAN.buildModel(P, { pieces: false }); const rm = SAN.refModel(P, 10); SNA.infoLines(P);
  ok(J({ g: P.working.geometry, s: P.working.sleeveN, r: P.working.sleeveResult }) === before && P.working.sleeveResult.hash === hb && SC.isCurrentSleeveChanged(P) === false, "6: 표시 on/off = 표시 전용(geometry·상태·완료본·hash 불변)");
  ok(rm && rm.line === "N-ref" && rm.refs.filter(r => /^ref-cut-/.test(r.id)).length === 3 && /박기 끝 1\.50/.test(J(rm.lines)) && /커프스 없음/.test(J(rm.lines)), "6: 비교 도안(Ⓝ — 절개 3개)");
}
// ── 7. 배선 ──
{
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8"), ui = fs.readFileSync(path.join(ROOT, "js", "ui.js"), "utf8"), rn = fs.readFileSync(path.join(ROOT, "js", "render.js"), "utf8");
  const pos = f => html.indexOf('src="js/' + f), ver = f => (html.match(new RegExp('src="js/' + f.replace(".", "\\.") + '\\?v=(\\d+)"')) || [])[1];
  ok(pos("designSleeveN.js") > pos("sleeveMApply.js") && pos("sleeveNApply.js") > pos("designSleeveN.js") && pos("ui.js") > pos("sleeveNApply.js"), "7: 스크립트 순서");
  ok((["designSleeveN.js"].every(f => ver(f) === VER) && ver("sleeveNApply.js") === "2026102802") && (ver("sleevePresets.js") === "2026102911" && ver("render.js") === "2026102906" && ver("sleeveCheckpoint.js") === "2026102911" && ver("ui.js") === "2026102911") && ver("sleeveAnnotation.js") === "2026102911" && (["designSleeveM.js", "designSleeveL.js"].every(f => ver(f) === "2026102001") && ver("sleeveMApply.js") === "2026102802"), "7: 캐시 버전 " + VER + " · 바뀌지 않은 Ⓛ·Ⓜ 파일은 그대로");
  ok(["inpSleeveNCut\" type=\"number\" min=\"0.1\" step=\"0.1\" value=\"2.5\"", "inpSleeveNCenter\" type=\"number\" min=\"0.1\" step=\"0.1\" value=\"4\"", "inpSleeveNSide\" type=\"number\" min=\"0.1\" step=\"0.1\" value=\"2\"", "inpSleeveNStitch\" type=\"number\" min=\"0.1\" step=\"0.1\" value=\"1.5\""].every(s => html.indexOf('id="' + s) > 0)
    && ["rowSleeveNCut", "rowSleeveNCenter", "rowSleeveNSide", "rowSleeveNStitch"].every(id => new RegExp('id="' + id + '" hidden').test(html)), "7: 입력칸 4 · 기본값 · 숨김 시작");
  ok(/function sleeveNOn\(project\)/.test(ui) && /function applySleeveN\(project\)/.test(ui) && /keep !== "N" && window\.sleeveNApply/.test(ui) && /if \(isN\) \{/.test(ui) && /window\.sleeveNApply\.rederive\(project\)/.test(ui) && /_sm\.line === "N"/.test(rn), "7: ui·render 배선");
  ok(/sleeveMOn\(project\) \|\| sleeveNOn\(project\) \|\| sleeveOOn\(project\) \|\| sleevePOn\(project\) \|\| sleeveQOn\(project\)\)\);\n    const hPcRow/.test(ui) && /hPcRow\.hidden = !\(project && \([^;]*sleeveNOn\(project\) \|\| sleeveOOn\(project\) \|\| sleevePOn\(project\) \|\| sleeveQOn\(project\)\)\)/.test(ui) && /sleeveNOn\(project \|\| null\) \|\| sleeveOOn\(project \|\| null\) \|\| sleevePOn\(project \|\| null\) \|\| sleeveQOn\(project \|\| null\)\) && \(!refChk/.test(ui), "7: 녹색·비교 도안 토글 행 Ⓝ 에서 보임");
  const fn = ui.slice(ui.indexOf("function applySleeveN(project)"), ui.indexOf("function applySleeveM(project)"));
  ok(/attemptedInputs: raw/.test(fn) && fn.indexOf("inpSleeveUpperArm") < 0 && fn.indexOf("inpSleeveRise") < 0 && fn.indexOf("Math.min") < 0 && fn.indexOf("Math.max") < 0 && /readPos\(f\[1\]\)/.test(fn), "7: Ⓝ 적용은 위팔·상승을 읽지 않고 값을 깎지 않는다 · 거부 입력 원문 보관");
  ok(/if \(at\) SLEEVE_N_FIELDS\.forEach\(f => setRaw\(f\[1\], at\[f\[0\]\]\)\)/.test(ui), "7: 차단 중 Ⓝ 입력칸도 원문 유지");
}

console.log("\n══════════════════════════════════════════════");
if (fails.length) console.log("실패:\n  " + fails.join("\n  "));
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
