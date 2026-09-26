// ══════════════════════════════════════════════════════════════════════════════
// sandbox/scratch.js — 자유 실험 영역. **여기만 고치면 된다.**
//
// 골든 없음 · 체크포인트 없음 · 계약 없음. 부서져도 sandbox 만 부서진다.
// index.html 은 이 파일을 로드하지 않는다 — 본체는 영향받지 않는다.
//
// 쓸 만하다고 확인되면 그때 정식 모듈(js/) + 하네스 + 계약을 붙여 승격한다.
// 승격 절차는 docs/SANDBOX.md.
// ══════════════════════════════════════════════════════════════════════════════
(function () {
  "use strict";

  // 실험 버튼을 등록한다 — sandbox.html 패널에 자동으로 뜬다.
  //   SBX.add("이름", async () => { ... return 화면에_찍을_값; });

  SBX.add("① 디자인까지", async () => {
    await SB.toDesign();
    return { 단계: "디자인 시작", 다트: SB.darts(), storage: SB.storageKeys() };
  });

  SBX.add("② 블라우스 몸판", async () => {
    await SB.toDesign();
    await SB.applyBody({ bustEaseCm: 8, hemExtensionBelowWaistCm: 10,
                         waistSideOffsetCm: -3, sideSeamCurve: 1 });
    return SB.girth();
  });

  SBX.add("③ 셰이프트 D 라인", async () => {
    await SB.line("shaped-line", "bunka-bodice-D");
    return { 배분: SB.darts(), ...SB.girth() };
  });

  SBX.add("④ 전 단계 완주", async () => {
    const r = await SB.all();
    const p = SB.p;
    return { 결과: r,
             몸판: !!p.working.bodiceResult, 소매: !!p.working.sleeveResult,
             카라: !!p.working.collarResult, 통합: !!p.working.designResult,
             storage: SB.storageKeys() };
  });

  // ── 여기부터 자유롭게 ───────────────────────────────────────────────────────
  // SBX.add("내 실험", async () => {
  //   await SB.toDesign();
  //   // …
  // });
})();
