// ══════════════════════════════════════════════
// 전체 회귀 하네스 러너 — 리팩터 전후 동일 결과 비교용.
//   node test/harness/runAll.js            # 전 스위트 실행(골든 대조 포함)
//   node test/harness/runAll.js --update "reason"   # 모든 골든 재생성
//
// 골든 시나리오(front*/multidart/oldest)는 --update를 그대로 전달받는다.
// backDeterministic/backRandomStress는 골든이 없으므로 --update를 무시한다.
// ══════════════════════════════════════════════
const { execFileSync } = require("child_process");
const path = require("path");

const passThrough = process.argv.slice(2); // 예: --update "reason"

const suites = [
  { file: "purityCheck.js",           golden: false },
  { file: "unrelatedNotchInvariant.js", golden: false },
  { file: "backDeterministic.js",     golden: false },
  { file: "backRandomStress.js",      golden: false, args: ["40", "8"] },
  { file: "frontDeterministic.js",    golden: true },
  { file: "multiDartScenarios.js",    golden: true },
  { file: "frontOldestDartAudit.js",  golden: true },
  // 순서 ③(evaluateMove 4계층) 안전망
  { file: "endpointEquivalence.js",   golden: false },
  { file: "nonMonotonicIntervals.js", golden: true },
  // C5: 프로덕션 ④ resolveRequestedAngle — 비단조·스냅·0/MIN·계약을 oracle과 대조.
  // (C5d에서 삭제된 applicableIntervals.js의 비단조 커버리지를 이어받는다. 자체 골든 없음)
  { file: "resolveRequestedAngle.js", golden: false },
  // C4: 부호 선택 — 분기별 계약(실기하 + 스텁)을 독립 oracle과 대조.
  { file: "rotationSignSelection.js", golden: false },
  // 잠긴 sign-selection.json 골든을 현재 C4 API로 재현·검증(legacy 삭제 후 최소 검증기).
  { file: "signSelectionFixture.js",  golden: true },
  { file: "perfBaseline.js",          golden: true },
  // 블록마스터(원형) 데이터 캡처: 실제 js/blockMaster.js 를 vm 으로 실행해 검증(골든 없음).
  { file: "blockMasterCheck.js",      golden: false },
  // 원형 완료 수명주기: 실제 blockMaster.js + blockWorkflow.js 를 vm 으로 실행해 검증.
  { file: "blockWorkflowCheck.js",    golden: false },
  // 디자인 프로젝트(D1 세션 데이터): 실제 blockMaster+blockWorkflow+designProject vm 실행.
  { file: "designProjectCheck.js",    golden: false },
  // 디자인 geometry renderer(D2 builder): 실제 designRenderer.js 를 vm 으로 실행.
  { file: "designRendererCheck.js",   golden: false },
  // design stage 렌더 분기(D3a): 실제 render.js 를 vm 으로 실행해 분기 계약을 고정.
  { file: "designRenderBranchCheck.js", golden: false },
  // DB1a: 몸판 grain-기준 길이 연장 순수 변환. 실제 designBodice.js(+designRenderer 왕복) vm 실행.
  { file: "designBodiceCheck.js",       golden: false },
  // 몸판 라인 카탈로그([패턴학교] P.14–35): 22 변형 슬롯·보류 사유·레코드 → designBodice 배분 연동.
  { file: "bodicePresetsCheck.js",      golden: false },
  // 앞중심 여밈 파생(designPlacket): 현재 유효 앞판 외곽 → 여밈 스트립 순수 변환.
  { file: "designPlacketCheck.js",      golden: false },
  // 몸판 모양 완료 체크포인트: 검사·완료 게이트·불변 스냅샷·스테일 판정(스텁 project).
  { file: "bodiceCheckpointCheck.js",   golden: false },
  // P0.3a 봉제 경계 안정 identity/lineage: 엔진 절단·반전·bake, 디자인 변환·manual 합성, fingerprint.
  { file: "boundaryIdentityCheck.js",   golden: false },
  // P0.2 보완: 다트이동 결과(부분 회전 잔여 다리·뒤집힌 조각)의 구조화 다트 선언 불변식.
  { file: "dartMoveSemanticsCheck.js",  golden: false },
  // P0.3b 다트 다리 경계 attachment: gen-0·새 다트·source 잔여·디자인 변환·manual 유지/절단/대체·fingerprint.
  { file: "dartAttachmentCheck.js",     golden: false },
  // P0.3b: draft 다트이동의 gen-0 허리다트 강체 carry(조각 소유권·누적·미해결 고정·공용 c 제외).
  { file: "waistDartCarryCheck.js",     golden: false },
  // seam-ready 연결성 gate: dart-moved 닫힌 외곽의 선언 기반 fallback(기존 ring 경로 우선·malformed 차단).
  { file: "connectivityFallbackCheck.js", golden: false },
  // 옆선 허리 조임 c 승격: draft 단일 원천·앞/뒤 옆선 끝점·c 다트 제거·a/b/d/e/f 불변·design·v7.
  { file: "sideWaistDartCheck.js",       golden: false },
  // 소매산 봉제선 순수 측정(읽기 전용): cap 곡선 apex 분할·앞/뒤 호길이·실패 계약.
  { file: "sleeveMeasureCheck.js",      golden: false },
  // 소매 모양 S1 파생: cap 고정·하부 실루엣·초기값 재현·착용 경고·실패/불변.
  { file: "designSleeveCheck.js",       golden: false },
  // 소매 모양 완료 체크포인트(S5): 완료 게이트·불변 스냅샷·형상전용 스테일·몸판 무효화(스텁 project).
  { file: "sleeveCheckpointCheck.js",   golden: false },
  // 카라 모양 C1(designCollar): bodiceResult → 칼라 스탠드 직선 스캐폴드 순수 파생·봉제/연장 분리.
  { file: "designCollarCheck.js",       golden: false },
  // 카라 모양 완료 체크포인트: 완료 게이트·불변 스냅샷·형상전용 스테일·몸판 무효화 vs 소매 순서 게이트·idempotent.
  { file: "collarCheckpointCheck.js",   golden: false },
  { file: "collarAnnotationCheck.js",   golden: false },
  // 카라 프리셋 registry(collarPresets): M 레코드·불변·검증·composeDraft=기존 M draft·hash 동일.
  { file: "collarPresetsCheck.js",      golden: false },
  // Design 형상 통합(designResult): 세 하위 result + structuralLines(cut) 묶음·hash·게이트·idempotent.
  { file: "designResultCheck.js",       golden: false },
  // Design 배치(piece layout): designLayout.js 의 순수 기하(bbox/auto 배치) 검증.
  { file: "designLayoutCheck.js",       golden: false },
  { file: "draftLayoutCheck.js",        golden: false },
  { file: "designLineToolCheck.js",     golden: false },
];

let anyFail = false;
for (const s of suites) {
  const args = [path.join(__dirname, s.file), ...(s.args || []), ...(s.golden ? passThrough : [])];
  process.stdout.write(`\n### ${s.file} ###\n`);
  try {
    const out = execFileSync("node", args, { encoding: "utf8" });
    const tail = out.trim().split("\n").slice(-2).join("\n");
    process.stdout.write(tail + "\n");
  } catch (e) {
    anyFail = true;
    const out = (e.stdout || "").toString().trim().split("\n").slice(-8).join("\n");
    process.stdout.write(out + "\n[FAILED]\n");
  }
}

console.log(`\n══════════════════════════════════════════════`);
console.log(anyFail ? "전체 결과: 실패 있음 ✗" : "전체 결과: 모두 통과 ✓");
if (anyFail) process.exitCode = 1;
