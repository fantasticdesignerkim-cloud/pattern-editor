# Design 몸판 이력

> 디자인 복사(D1~D3b)부터 몸판 모양 완료 체크포인트까지(2026-07~08).

> 이 파일은 **완료된 작업의 이력**이다. 매 세션 로드되지 않고 필요할 때만 읽는다.
> 살아있는 계약은 [../../CLAUDE.md](../../CLAUDE.md), 색인은 [../INDEX.md](../INDEX.md).

## ✅ 원형 완료 → 디자인 복사 (D1~D3b) 구현 완료 (2026-07) — 독립 design 레이어

위 "원형 완료 기반 S1~S3"(blockMaster 캡처·완료본·원형 완료 UI) 위에, **완료본을 명시적으로
복사해 designProject 를 만들고, 원형을 잠금 reference 로 깔고, 그 위 working geometry 를
독립 렌더러로 그리는 design 화면**을 구현했다. 로컬 5커밋. 과정 일지가 아니라 확정된
결정·불변식·경계다. 캐시: designProject `?v=2026072902`, designRenderer `?v=2026072903`,
render `?v=2026072904`, ui `?v=2026072906`, css `?v=2026072906`.

| 커밋 | 내용 |
|---|---|
| `ee417f5` | 독립 세션 **designProject**(`js/designProject.js`, `window.designWorkflow`) |
| `854b3b5` | detached **reference/working builders**(`js/designRenderer.js`, `window.designRenderer`) |
| `b6d0a2e` | **render pipeline 의 design 분기**(`render.js`) + `isDesignStageActive()`(`ui.js`) |
| `7c7f027` | **완료본 기반 디자인 시작/계속**(`#btnStartDesign` + `onStartDesign`, `ui.js`) |
| `ae5c255` | **design chrome 숨김**(`data-workspace-stage` + CSS, `.edit-history`) |

### 잠근 최종 계약 (위반 금지)
- **designProject 는 원형 완료본의 복사본**이다 — 전역 원형 state/dartMoveState/inputs 를
  **교체하지 않는다**(draft swap 없음). `startFromBlock(completedBlock)` 이 deep clone 한다.
- **`baseSource`·`referenceGeometry` 는 deepFrozen(불변)**, **`working.geometry`·
  `working.parameters` 만 향후 편집 대상**(mutable). 최상위 project 와 `sourceBlock` frozen.
- **sourceBlock version pinning**: `{id,version,canonicalHash}` 값 고정. **최신 원형으로
  자동 교체 금지** — 같은 완료본 재시작은 idempotent(같은 참조), 다른 version 시작은
  `design-project-exists`. 현재 `design-1` 하나(`_project` 싱글턴).
- **Design 탭 활성 = `designWorkflow.hasProject()`**(hasCompleted 아님). project 생성 권한은
  **`디자인 시작` 명시적 클릭만**(`ui.js` `onStartDesign`): `hasProject()?current():
  startFromBlock(blockWorkflow.latest())` → 성공한 뒤에만 `setWorkspaceStage("design")`.
- **`디자인 시작` 활성 = `hasCompleted() && !busyTool()`.** dirty draft 여도 **기존 완료본
  (latest())으로 시작 가능**(재캡처·자동 complete 없음), **busy(다트·arm/neck/sleeve 편집)
  중 진입 금지**(UI disabled + 핸들러 재검사, 엔진 강제 종료·Cancel 호출 없음). label
  `디자인 시작`/`디자인 계속`, title 에 고정 source version.
- **design 렌더는 `grid → reference → working`**(z-order), `createDraft` 등 **live 원형
  재계산 없음**. `render()` 는 grid 직후 `isDesignStageActive()`(ui.js getter, **초기 render
  는 getter 부재라 안전 검사**) 에서 갈라져 designProject 의 reference/working 만 append 후
  early-return(gRef/pattern/sleeve/overlay/applyLayerVisibility/updateStatusBar skip).
- **reference/working 은 view-only·`pointer-events:none`**(둘 다). 디자인 도구·hit-test 없음
  → svg-level 다트 클릭이 working 을 잘못 잡지 않는다.
- **design 에서 원형용 chrome 숨김**: `.canvas-toolbar`(전체/몸판/소매·다트·곡선)·
  `[data-menu=view]`·`[data-menu=file]`·undo/redo(`.edit-history`)·치수 inspector·원형 완료 UI.
  **`화면 초기화` 유지**(줌·팬 복구). `data-workspace-stage`(html 속성, ui.js refresh)는
  **표시 전용** — 기존 `inspector.hidden` 로직과 책임 분리(이중 책임 없음).
- **세션 전용 구조**: `blockWorkflow._records`·`designProject._project` 는 세션 메모리 →
  **reload 시 완료본·project 모두 소멸**, `디자인 시작`·design 탭 disabled 로 복귀. localStorage
  /autoSave/testSeed 미연결.
- **`design-project-missing` 명시적 실패**: design 신호인데 project 가 없으면 render 가
  조용히 draft 로 fallback 하지 않고 throw(빈 design 캔버스 금지). builder 실패도 전파.

### D3c 결과 불변식 (실측 확정)
1. **design 왕복이 dirty draft 를 변경하지 않는다** — dirty·inpB·handles·shape 전부 보존
   (design 은 draft state 를 안 건드림; render 는 state 의 순수 함수). *주의: `markDirty` 는
   재렌더하지 않으므로 "진짜 dirty 형상" 비교엔 render() 강제 후 측정해야 한다(stale 캡처
   회피). dirty 상태에서 소매는 `!isMeasureDirty` 게이트로 미표시(기존 동작).*
2. **design 화면 초기화가 project 를 변경하지 않는다** — reference/working 만 새 그룹으로
   재생성(live 원형 0), `referenceGeometry`·`working.geometry`·`sourceBlock` 객체 무변형,
   frozen 유지, 같은 project 참조.
3. **latest v2 가 생겨도 status·title·project 가 고정 v1 로 일관** — design status
   `디자인 · 원형 block-1 v1 참조`, 버튼 title `원형 v1 디자인 계속`, `sourceBlock.version=1`.

### 테스트·계약 수치
- 신규 헤드리스: **designProjectCheck 37 / designRendererCheck 44 / designRenderBranchCheck 15**.
  **blockWorkflowCheck 52 / blockMasterCheck 64**. **runAll 전체 통과 · 골든 diff 0.**
  (테스트 수는 SV2, `a278865` 기준 — designProject/designRenderer 에 edge 검증 추가.)
- **id 45**(`btnStartDesign` 추가) / **inline handler 37** / **MutationObserver 2** 유지.
- 엔진(dartMove/split/bake/normalize)·render 라이브 원형 경로·shape/perf 골든 **무변경**.
  9 viewport(draft·design) overflow·겹침 0, 320×568 design SVG 회복(192→469), storage 0, 콘솔 0.

### 미구현 경계 (기능이 없는 것이지 버그 아님)
- ~~**디자인 몸판 편집 도구 없음**(design 은 현재 view-only).~~ → **정정(DB1a·DB1b)**:
  "허리 아래 길이(hem 연장)" 편집 도구가 생겼다(아래 "DB1a·DB1b" 섹션). 그 외 편집은 여전히 없음.
- **working hit-test·핸들 없음**(pointer-events:none 유지 — DB1b 는 캔버스 조작이 아니라
  inspector 수치 입력이다).
- ~~**`working.parameters` 컨테이너는 존재하지만 현재 빈 객체(`{}`)이며 …미구현.**~~ →
  **정정(DB1b)**: `working.parameters.body.hemExtensionBelowWaistCm` 는 이제 DB1b 적용이
  기록한다. 나머지 파라미터(여유량·완성길이·옆선 실루엣·네크라인·앞여밈)는 여전히 미구현.
- **허리다트 a–f 재배분 없음.**
- **저장·복원 없음**(세션 메모리 전용, reload 소멸).
- **다중 designProject 없음**(`design-1` 하나).
- 이 항목들은 자동 착수 금지 — 별도 사양 확정 + 승인 후 진행.
## ✅ DB1a·DB1b — 몸판 grain-기준 hem 길이 연장 (2026-08)

원형 완료본을 복사한 designProject 의 working geometry 에, **"허리 아래 길이(cm)"** 만큼
grain(중심선) 방향으로 몸판을 직선 연장한다. 순수 변환(DB1a)과 design UI 연결(DB1b)을
분리해 구현했다. 커밋: DB1a `6152107`(모듈)+`7ffe1b8`(waist topology), DB1b `be0b397`.
캐시: designRenderer `?v=2026080401`, designBodice `?v=2026080403`, ui `?v=2026080403`.

**연장축 조사 결론(읽기 전용, 5상태 실측)**: center 접선(=중심선 grain)은 다트 적용
상태와 무관하게 **항상 +Y 로 안정**(cAngY=0°)인 반면, **side 국소 접선은 다트각만큼
0~18.25° 변해 상태-독립 길이축으로 쓸 수 없다**(회전이 "레이아웃 오염"인지 실제
외곽 변형인지는 단정하지 않음 — bakedSegments 는 최종 outline이므로 실제 변화일 수도
있다. 확정 결론은 "side 접선은 상태-독립 축 부적격"까지). → 공통 연장축은 center
접선에서 파생.

### DB1a — `js/designBodice.js` 순수 변환 (`window.designBodice.computeGeometry`)
`computeGeometry(referenceGeometry, { body: { hemExtensionBelowWaistCm: L } })` → 새 geometry.
- **local-frame(조각별)**: `C`=centerWaistEndpoint, `S`=sideWaistEndpoint, `g`=center edge
  파생 아래쪽 grain, `p`=g⊥·center→side. `longitudinalOffset=dot(S-C,g)`,
  `width=dot(S-C,p)`. `centerHem=C+L·g`, `sideHem=C+L·g+width·p (=S+(L-offset)·g)`.
  ⇒ **center 연장=정확히 L / hem⟂grain / 두 연장 평행 / side 연장=L-offset**(같을 필요
  없음). **L 의미 = center waist→hem grain 길이.** (동일벡터 가산은 hem 을 기울여
  직사각형이 안 됨 — cross-grain width 로 보정한 것이 핵심.)
- **원자성·불변**: 항상 referenceGeometry 에서 재계산(현재 working 재입력 금지, 반복
  비누적). 입력·params 변형 0, 반환은 참조 전부 분리. sleeve/shared 값·순서 유지.
- **L===0 정확히만 no-op**(deep clone). 음수·NaN·Infinity·비수치=`invalid-body-length`
  (epsilon 으로 0 을 뭉개지 않음 — UI 소수 정규화는 DB1b 책임). ★ **적용 상태(offset≠0)
  에서는 L=0 이 공식상 side 를 옮기므로**(sideHem(0)=C+width·p≠S) DB1b 가 아니라 DB1a
  가 exact-0 no-op 로 잠근다.
- **outline 재구성 순서(고정)**: 기존 non-waist(원순서) + [center-extension, hem,
  side-extension]. waist outline → construction 끝(원순서). waist role: outline 0 /
  construction 로 이동.
- **교차 검사 = adaptive de Casteljau flattening**(flatness `1e-4`, max depth 16) + 정확한
  endpoint 예외. 고정 N분할 금지(크로싱이 샘플/꼭짓점에 걸리면 놓침 — 원래 t=0.5
  픽스처가 이를 증명, 회귀 테스트로 고정). **예외는 실제 topology 접점만**: center 연장↔
  (center|**waist**)=C 에서만, side 연장↔(side-seam|**waist**)=S 에서만. hem↔waist=예외
  없음. 그 외 접촉·겹침·횡단(및 cubic subdivision 꼭짓점 접촉)=`extension-intersection`.
  **waist 를 통째로 빼지 않는다**(굽은/분할 waist 내부 재횡단을 놓치므로).
- **실패 계약(throw, 부분 반환·입력 변형 0)**: `invalid-geometry` / `invalid-body-length` /
  `missing-required-edge` / `missing-topology-junction` / `ambiguous-topology-junction` /
  `ambiguous-center-tangent` / `zero-center-tangent` / `invalid-cross-grain-width` /
  `invalid-side-extension` / `extension-intersection`.
- **designRenderer 계약 확장**(`EDGE_PLACEMENT`): waist=front/back **outline·construction**,
  hem=front/back **outline**. center/side-seam 은 계속 construction 금지.

### DB1b — design UI 연결 (`js/ui.js` + `index.html`)
- 우측 `aside.inspector` 재사용, `data-panel="design-body"` 추가. **draft=measurements 만 /
  design=design-body 만**(동시 노출 금지, stage 파생). inspector 는 draft·design 둘 다 표시
  (기존 "design=inspector 숨김"을 이 조건만 조정). 모바일(≤615)은 기존 하단 배치 재사용.
- 요소: `#inpBodyHemExtension`(number 0–100 step .1) / `#btnApplyBodyLength` /
  `#btnResetBodyLength`(=L 0 적용) / `#designBodyNote`(aria-live). 버튼은 inline handler
  없이 bind() 연결(inline handler 37 유지). Enter=적용.
- **적용 원자성**(`onApplyBodyLength`): 입력 검증(0–100) → `structuredClone(working.parameters)`
  에 body.hemExtensionBelowWaistCm 세팅 → `computeGeometry(referenceGeometry, next)` →
  **성공 후에만** `working.parameters`·`working.geometry` 동시 커밋 → `render()`. 실패 시
  parameters·geometry·화면 변화 0, note 에만 사유. sourceBlock/baseSource/referenceGeometry
  불변.
- **표시 규칙**: 적용 가능 = design·유효 0–100 일 때만 버튼 활성. **refresh 중 input 포커스
  시 사용자 입력값 덮어쓰지 않음.** stage 재진입 시 committed L 표시. 성공 문구 L=0
  `원형 길이로 복원됨 · 세션 전용` / L>0 `허리 아래 Lcm 적용 중 · 세션 전용`. ui.js 는
  이 한 기능만 예외적으로 computeGeometry·render 를 호출한다(헤더 주석에 명시).
- render.js 무변경 — design 분기가 매 렌더 `working.geometry` 를 읽으므로 커밋 후 render()
  로 working 레이어만 갱신된다(reference 고정).

### 검증
- 하네스(엔진·순수 변환, ui/index 미로드): **designBodiceCheck 120 / designRendererCheck 51**,
  runAll 전체 통과, shape/perf 골든 diff 0. DB1b 는 UI 라 하네스 추가 없음.
- 실브라우저 기능 15항목: 시작 시 입력 0·reference/working 겹침, L=10 시 reference 고정·
  working 연장·front/back hem 각 1·waist=working construction, 같은 10 비누적, 10→20→10=첫
  10, 10→0=reference deepEqual, invalid(150)·intersection 시 커밋·화면 불변, draft 복귀 시
  원형 shape·dirty 불변(draft SVG hem 0), design 재진입 committed L 복원, reload 시
  project·parameter 소멸(design 탭 비활성 복귀), reference/working/sourceBlock 참조 불변,
  storage 0·console 0. **9 viewport(1440·1280·616·615·430·390·360·320·844×390)** 가로
  overflow·버튼/inspector 겹침·입력 접근성 전부 정상, 320×568 design SVG 287px.
- DOM: **id 45→49**(inpBodyHemExtension·btnApplyBodyLength·btnResetBodyLength·designBodyNote),
  inline handler 37 유지, MutationObserver 2 유지.

### 미구현(경계 준수)
side kink 보정(옆선 실루엣 디자인 단계 책임) / ~~여유량~~(✅ 아래 "품·여유량" 구현)·완성길이·
옆선·네크라인·앞여밈 / 허리다트 재배분 / working hit-test·핸들 / 저장·복원 / 다중 designProject —
전부 별도 사양·승인 후.
(참고: 이 항목의 "working hit-test·핸들 없음"은 아래 Design piece layout 에서 **배치
드래그 한정으로** 도입됐다 — 형상 편집 핸들은 여전히 없음.)
## ✅ Design 품·여유량(ease) (2026-08) — 옆선 바깥 평행 이동

몸판 모양 단계 첫 구현. DB1(hem 길이)과 같은 파라메트릭 패턴으로 `designBodice.computeGeometry`
에 **`body.bustEaseCm`** 추가. 원본 블록(referenceGeometry) 불변, 결과는 파생 working.geometry.

**결정(사용자 확정)**: **전체 가슴둘레 여유량 E → 각 옆선 E/4 바깥**(앞반쪽+뒤반쪽 ×2측 = E) /
**옆선 전체 평행 이동(박스형, 1차)**. front 바깥=−x(center 반대), back 바깥=+x.

**구현 (`js/designBodice.js`)**
- `pieceFrame(outline)` 추출(C=center∩waist, S=side∩waist, g=grain, p=center→side) — hem·ease 공용.
- `applyEase(piece, delta)`: 옆선을 `p×delta` 만큼 이동. **U(underarm)·S(waist-side)** 와 그 공유
  끝점(armhole·waist)만 이동, **construction(다트)은 불변** — 여유분은 옆선에만 붙고 다트는
  fit 유지(옆선 ease 의 정의). cubic 은 인접 제어점(들어오는 c2·나가는 c1)도 함께 이동해 접선 보존.
- ★ **거리 기반 매칭(`JOIN_TOL=0.02cm`)**: source 기하가 옆선·진동 접점에 **~0.0004cm 드리프트**
  가 있어(원본부터 존재) exact key 매칭은 armhole underarm 을 놓쳐 outline 이 δ 만큼 끊긴다(실측).
  거리 tol 로 드리프트는 잇고 별개 설계점(≥0.08cm)은 안 합친다.
- `computeGeometry`: **두 파라미터 모두 선택적**(bustEaseCm·hemExtensionBelowWaistCm, 미지정=0).
  **둘 다 0 이 정확히 no-op**(clone). 순서 **ease → hem**(넓힌 옆선에서 hem 이 내려감). E<0·NaN·
  Infinity·비수치=`invalid-body-ease`. (기존 "hemExt 필수" 계약 폐기 — designBodiceCheck test 4 갱신.)

**UI (`js/ui.js`·`index.html`)**: design body 패널에 `#inpBodyBustEase`(품·여유량) 입력 추가,
**기존 적용/초기화 버튼이 여유량+길이 둘 다** 적용(`onApplyBodyLength` 이 body={bustEaseCm,
hemExtensionBelowWaistCm} 재계산). 원자적 커밋·referenceGeometry 기준·실패 시 화면 변화 0 유지.
committedBody 가 둘 다 읽어 표시, note 는 "여유량 Ecm · 엉덩이 길이 Lcm 적용 중". DOM id **49→50**.

**검증(격리 origin, storage 0, console 0)**: 하네스 `designBodiceCheck`(4b 신설: E=0 no-op·
invalid-body-ease·front −δ/back +δ 평행 이동·construction 불변·여유량+길이 결합), runAll 전체
통과, shape/perf 골든 diff 0. 실브라우저(여유량 8)—front 옆선 23.05→21.05·back →25.05(각 δ=2),
**referenceGeometry 불변·construction(다트) 불변·파생(parts 등) 무효화**, armhole underarm·waist
가 옆선과 함께 이동해 **outline 연결(gap 0.0004=기존 드리프트)**, 여유량+길이 결합·초기화 복원,
스크린샷(넓어진 앞·뒤 몸판, 깨끗한 외곽·다트 불변). 캐시 `?v=2026081402`(designBodice)·
`?v=2026081401`(ui).

**미구현(경계)**: ~~옆선 실루엣~~(✅ 아래 "옆선 실루엣" 구현) / dart 재truing(여유분은 옆선에만,
다트 불변) / 앞뒤 다른 분배 — 별도 사양·승인 후.
## ✅ Design 옆선 실루엣 (2026-08) — 허리·밑단 옆선 이동(underarm 고정)

몸판 모양 단계 2번째. 박스형으로 넓어진 옆선을 실제 블라우스 모양으로 다듬는다.
`designBodice.computeGeometry` 에 **`body.waistSideOffsetCm`(허리)·`body.hemSideOffsetCm`(밑단)**
추가. **첫 블라우스 = 허리 들어간 형**(사용자 확정: 허리<0 안쪽, 밑단≈0).

**결정(사용자 확정)**: 진동밑점(underarm)은 **여유량 결과로 고정**(실루엣이 안 건드림). **허리 옆선·
밑단 옆선만 별도 이동**. 부호: **음수=안쪽(center 방향, 허리 들어감), 양수=바깥(+p, A라인)**.
네 실루엣 = 일자(0/0) · 허리들어감(<0/0) · A라인(0/>0) · 혼합(<0/>0).

**구현 (`js/designBodice.js` — `shapePiece` 로 통합)**
- 프레임(C·S·g·p·widthOrig)을 **변환 전 한 번** 계산. 순서 **여유량 → 길이(hem) → 허리 이동 →
  밑단 이동**. hem 후에도 목표점(Se=ease 허리, sideHemE=ease 밑단)을 **거리 매칭**으로 이동.
- **허리·밑단은 ease 폭 기준 독립**: sideHemE 는 `centerHem + p·(widthOrig+delta)`(ease 폭)라
  허리를 안쪽으로 당겨도 밑단은 안 따라온다(별도 조절). 허리 이동 → 허리에서 꺾인 옆선.
- underarm 은 여유량(delta)만 이동, 실루엣 오프셋은 U 를 안 건드림 → 진동밑 고정.
- **outline + construction 함께 이동**(허리/밑단 오프셋만): hem 이 construction 으로 옮긴 **waist
  참고선이 옆선을 따라오도록**. 다트는 Se/sideHemE 에서 멀어 **불변**(실측: 원본 다트 6개 보존).
- `movePrimPoints` 를 **per-target delta**(`moves=[{pt,d}]`)로 일반화(U·S 를 다른 양으로 이동 가능).
- 네 파라미터 모두 선택적, **정확한 0(넷 다)만 no-op**. 옆선 오프셋은 부호 허용(안/밖), 비수치·
  무한대=`invalid-body-side-offset`. 밑단 오프셋은 **hem 있을 때만** 유효(없으면 무효).

**UI (`js/ui.js`·`index.html`)**: design body 패널에 `#inpBodyWaistOffset`·`#inpBodyHemOffset`
(−30–30, 부호 허용) 추가. **기존 적용/초기화가 네 값 모두** 재계산(`onApplyBodyLength` body=
{bustEaseCm,hemExtensionBelowWaistCm,waistSideOffsetCm,hemSideOffsetCm}). note 에 "허리 안쪽 Ncm"
등 부호 표시. DOM id **50→52**.

**검증(격리 origin, storage 0, console 0)**: 하네스 `designBodiceCheck` 4c 신설(허리 안쪽 −3
→ front S +3·underarm 불변·다트 불변 / 여유량+허리 결합 / 밑단 A라인 ease 폭 독립 / hem 없으면
밑단 무효 / invalid-body-side-offset), runAll 전체 통과, shape/perf 골든 diff 0. 실브라우저(허리
들어간 형: 여유량 8·길이 10·허리 −3): 앞판 옆선 **underarm 21.05(ease) → 허리 24.05(안쪽 −3) →
밑단 21.05(ease)**, 뒤판 대칭, **referenceGeometry 불변·원본 다트 6개 보존·waist 참고선이 옆선과
일치(24.05)**, 스크린샷(허리에서 들어가 밑단으로 벌어진 깨끗한 실루엣). 캐시 `?v=2026081702`
(designBodice)·`?v=2026081701`(ui).

**미구현(경계)**: 옆선 taper(가슴~허리 구간별 곡선) / 진동 깊이 조정 / dart 재truing / 앞뒤 다른
분배 / ~~옆선 곡선화~~(✅ 아래 "옆선 곡선화" 구현) — 전부 별도 사양·승인 후.
## ✅ Design 옆선 곡선화 (2026-08) — 허리 꺾임을 두 cubic 으로 매끄럽게

몸판 모양 단계 3번째. 실루엣(진동밑→허리→밑단)의 **허리 직선 꺾임**을 실제 봉제선으로 쓰기 전
부드럽게 연결한다. `designBodice.computeGeometry` 에 **`body.sideSeamCurve`(0=직선, 0–1)** 추가.
사용자 확정 계약: **첫 구현은 자동 곡률 하나**(앞·뒤 별도 곡률은 착용 검증 후).

**계약(잠금)**
- **진동밑 U·허리 Sp·밑단 H 는 shapePiece 계산값 그대로 고정**, 곡선이 세 점을 **정확히 통과**.
- `진동밑→허리`, `허리→밑단` **두 cubic**. 허리 Sp 에서 두 핸들을 chord(U→H') 접선 방향 ±T 로
  두어 **일직선(접선 연속 G1)**. 끝 접선은 각 구간 방향. **handle ≤ len×(1/3)** 로 **overshoot 방지**
  (fitted 에서 허리 안쪽 한계 Sp.x 초과 안 함 — 실측 maxX=Sp.x).
- **곡률 0 = 직선 두 구간과 정확히 동일한 no-op**(curveSideSeam 미호출). side-seam edge line 이
  정확히 2개(hem 있을 때)일 때만 곡선화 — hem 없으면 1세그먼트라 그대로.
- **cubic 은 geometry outline 계약 형식 `{kind:"path", commands:[M,C]}`** 으로 출력(★ `{kind:"cubic",
  from/c1/c2/to}` 로 내면 renderer·designLayout.pointsOfPrim·outlineSegsOf 가 `commands` 를 못 읽어
  깨진다 — 실측으로 확인하고 path 형식으로 교정).
- **reference·다트·진동선·허리 참고선 불변**(곡선화는 side-seam edge 만 교체).

**UI (`js/ui.js`·`index.html`)**: `#inpBodySideCurve`(0–1) 추가, 적용/초기화가 다섯 값 모두 재계산.
**앞·뒤 옆선 봉제 길이 + 차이 표시**(`#designSideLenNote`, `sideSeamLen` 가 side-seam edge 평탄화
합) — 차이 ≤1cm=녹색/초과=주황(봉제 정합 검증). DOM id **52→53**.

**검증(격리 origin, storage 0, console 0)**: 하네스 `designBodiceCheck` 4d 신설(곡률 0 no-op·2 cubic
path·세 점 통과·**허리 핸들 일직선(접선 연속)**·overshoot 없음·hem 없으면 곡선화 안 함·범위 밖
`invalid-body-curve`), runAll 전체 통과, shape/perf 골든 diff 0. 실브라우저(허리 들어간 형+곡선 1):
side-seam **2 path cubic**·접선 연속·overshoot 없음(maxX=Sp.x)·**앞옆선 28.2cm=뒤옆선 28.2cm 차이
0**·reference side-seam 여전히 line·다트 불변, 스크린샷(허리 꺾임 사라진 매끄러운 S곡선). 캐시
`?v=2026081704`(designBodice·ui)·`?v=2026081703`(css).
> ⚠️ 디버깅 기록: broken(cubic 형식) 실행 후 탭 콘솔에 남은 `designLayout.pointsOfPrim` 에러는
>   **탭 콘솔 버퍼 잔여**였다(fresh 탭에선 0). path 형식 교정 후 재현 안 됨. 캐시·콘솔 잔여를
>   현재 에러로 오판하지 말 것 — fresh 탭/재현으로 구분.

**미구현(경계)**: 앞·뒤 별도 곡률 / 옆선 taper(가슴~허리 구간별) / 진동 깊이 / dart 재truing —
별도 사양·승인 후.
## Design 네크라인 3단계 (2026-08, 사용자 확정) — 기본형 선택 → 수치 조정 → 직접 편집

**지배 결정**: 네크라인 디자인을 **① 기본 형태 선택(원형유지·라운드·V·스퀘어·보트) → ② 형태별
수치 조정 → ③ 세부 수정(boundary 패턴선 변환)** 3단계로 둔다. 상태 계약:
```
neckline: { mode: "parametric" | "manual", type: "original"|"round"|"v"|"square"|"boat", parameters: {...} }
```
- **parametric**: `designBodice.computeGeometry` 가 형태를 working.geometry 에 반영(원본 reference
  불변, 비누적). 미리보기·목둘레 길이 여기서.
- **manual**(증분 3): `세부 수정` 시 현재 네크라인을 **boundary 패턴선으로 변환**(front/back piece
  소유권) → computeGeometry 는 원본 목선 유지, boundary 가 designOutline 합성으로 교체. anchor·
  핸들·snap·선택 기존 시스템 재사용. **모드 잠금**: manual 후 파라미터 입력 잠금(슬라이더가
  수정선 안 덮음), **`기본형으로 돌아가기`** 명시적 클릭에서만 boundary 제거+parametric 복귀.
- 카라 단계는 **최종 합성 목둘레 길이** 사용.

**증분**: ① 라운드넥+공통입력(✅ 아래) → ② 나머지 형태+형태별 입력+카드 UI → ③ 세부 수정+모드 잠금.
## ✅ Design 네크라인 증분 1 (2026-08) — 라운드넥 + 공통 입력

**결정(사용자 확정)**: 첫 증분 = 라운드넥 하나 + 공통 입력(목너비·앞목·뒤목 깊이) + 비누적
미리보기 + 앞·뒤 목둘레 길이·합계. parametric 모드만(카드 UI·직접편집은 증분 2·3).

**구현 (`js/designBodice.js`)**
- `computeGeometry` opts 에 **`neckline`** 추가. `mode==="parametric" && type==="round"` 일 때만
  적용, 그 외(original·manual·없음)는 **원본 목선 유지**. body 전부 0 + 네크라인 미적용이면 no-op.
- **순서: 네크라인(위, 원본에서) → 몸판 shapePiece(아래)**. 서로 disjoint 지만 네크라인을 먼저 해
  pieceFrame(center/waist/side)이 hem 전 단일 center edge 에서 동작하게 한다.
- `necklineInfo(outline)`: center edge 목점(top=FNP/BNP) → 그에 닿는 edge 없는 outline seg=neckline
  → 반대끝 SNP → SNP 에 닿는(neckline 아닌) shoulder → 방향. (topology 로 식별, edge 라벨 안 씀)
- `applyNeckline(piece, side, params)`: **목너비**=SNP 를 shoulder 방향(+=넓힘), **앞/뒤목 깊이**
  =FNP 를 grain 아래(+=깊게). 라운드=**사분타원 scoop**(FNP' 수평 접선·SNP' 수직 접선, K=0.5523).
  네크라인 seg 를 라운드 path `{kind:"path",commands:[M,C]}` 로 교체 + center·shoulder 의 FNP/SNP
  끝점 함께 이동(movePrimPoints). **construction(다트) 불변.**

**UI (`js/ui.js`·`index.html`)**: design body 패널에 `#selNecklineType`(원형유지/라운드넥)·
`#inpNeckWidth`·`#inpNeckFrontDepth`·`#inpNeckBackDepth` 추가. **기존 적용/초기화가 몸판+네크라인
모두** 재계산(`onApplyBodyLength` 이 nextParameters.neckline 도 세팅). note 에 "라운드넥" 표시. DOM id **52→56**.

**★ 목둘레 표기 계약(사용자 확정, 카라 전 필수)**: 앞·뒤판은 **반쪽 패턴**이다. `#designNeckLenNote`
는 네 값을 **구분 표기**한다 — **앞목선(반쪽)** / **뒤목선(반쪽)** / **반패턴 합계**(앞반+뒤반) /
**완성 목둘레 = 2×반패턴 합계**. 카라 설계: **전체 카라=완성 목둘레**, **중심 접어재단 반쪽 카라=
반패턴 합계**. 24.5 를 단순 "합계/전체"로 소비하면 카라가 절반이 되므로 금지. (`necklineLen` 이
목선 호 평탄화, `neckLenNote` 가 half=앞반+뒤반·full=2×half.)

**검증(격리 origin, storage 0, console 0)**: 하네스 `designBodiceCheck` 4e 신설(네크라인 fixture:
원형유지 no-op·목너비 SNP 이동·앞/뒤목 깊이 FNP 이동·라운드 path·다트 불변·invalid-neckline-param),
runAll 전체 통과, shape/perf 골든 diff 0. 실브라우저: 라운드넥(목너비2·앞목5·뒤목2) → 앞 FNP
3.075→8.075·목선 라운드 scoop·**referenceGeometry 불변·비누적(재적용 동일)**·원형유지 재적용 시
원본 목선 복귀, 몸판(허리 들어간 형)+라운드넥 **통합 적용**·목둘레 앞15·뒤9.5·합계24.5 실시간,
스크린샷(깊어진 라운드 네크라인). 캐시 `?v=2026081801`(designBodice)·`?v=2026081802`(ui·css).

**미구현(다음 증분)**: 형태(원형유지 카드/V/스퀘어/보트) + 형태별 입력(곡선정도·V끝점·모서리) +
선택 카드 UI(증분 2) / 세부 수정(boundary 변환)·모드 잠금·기본형 복귀(증분 3).
## ✅ Design 네크라인 증분 2 (2026-08) — V넥·스퀘어·보트 + 기본형 카드 UI

증분 1(라운드넥) 위에, **기본형 5종(원형유지/라운드/V넥/스퀘어/보트) 카드 선택 + 형태별
입력**. parametric 모드만(직접편집은 증분 3). 저장 모델·reference 불변 계약은 증분 1 그대로.

**결정(사용자 확정)**: 형태별 입력 결합 = **"공통 적용 + 형태별 추가"** — 공통(목너비·앞목·
뒤목 깊이)은 모든 형태에 적용해 SNP'·CF 깊이를 정의하고, 형태별 입력은 그 위에 성격을 더한다.

**형상 계산 (`js/designBodice.js`, `buildNecklineShape(type, FNPn, SNPn, g, p, params)`)** — g=아래
grain, p=cross(center→side). 공통(FNPn=CF 깊이, SNPn=목너비)은 `applyNeckline` 이 이미 반영,
형태별 seg 만 형태 함수가 만든다. `cfPt`(center 끝점이 이동할 CF 접점) + `segs` 반환:
- **round**(기존): 사분타원 scoop. `curveAmountNorm`(0–1, 미지정=1)이 K=0.5523 스케일. **증분 1과
  동일 결과**(curveAmountNorm 미지정 시 K 그대로).
- **v**: `cfPt = FNPn + g·vPointDepthCm`(앞목 깊이에서 추가 하강한 V 꼭지), neckline = **직선 1개**
  (SNP'→V끝점).
- **square**: `corner = FNPn + p·squareWidthCm`(바닥-바깥 모서리), `cornerRadiusCm` 라운드
  (`r = min(radius, width, lenUp/2)` overshoot 방지). neckline = **바닥 수평 line + 라운드 corner
  path + 옆 수직 line**(최대 3 세그먼트, r=0 이면 2).
- **boat**: 얕은 하강 bow. `curveAmountNorm`(미지정=0.5)이 dip 스케일, `Q = mid + g·(ca·|W|·0.3)`
  를 지나는 **cubic path 1개**(quadratic→cubic 승격).
- **★ cubic 은 항상 `{kind:"path",commands:[M,C]}`**(NOT `{kind:"cubic"}` — renderer/designLayout
  `pointsOfPrim` 이 `.commands` 를 읽어 깨진다, 증분 이전 교훈).

**네크라인 길이 합산 — piece 스칼라(`measureNeckline`, 2026-08 정리)**: 스퀘어는 네크라인이
**다세그먼트**라 `necklineLen`(center 목점 단일 seg 추적)이 undercount 한다. FNP·SNP 둘 다 일반
체인 점처럼 보여 위상만으로 경계를 못 나눈다. **★ 초기 구현은 primitive 에 `_neck=true` 표식을
달았으나 폐기** — boundary/designOutline 복제 시 내부 표식이 파생 geometry 로 누출될 수 있다
(사용자 지적). 대신 **`buildNecklineShape` 가 만든 세그먼트를 `applyNeckline` 이 순수 헬퍼
`designBodice.measureNeckline(segs)`(공용 `flattenPrim` adaptive de Casteljau 로 line·cubic 측정)
으로 바로 재고, 그 길이를 최종 piece 의 스칼라 필드 `piece.necklineLenCm` 로 싣는다** — primitive
가 아니라 piece 레벨이라 boundary/designOutline 은 `piece.outline` 배열만 복제하므로 안 샌다.
몸판 shapePiece 는 네크라인을 안 건드리므로 측정은 shapePiece 전에 확보해 후 attach.
`necklineLen`(UI)은 `typeof piece.necklineLenCm === "number"` 면 그 값, 없으면(원본/미적용) 원본
단일 seg 추적 fallback. **최종 working.geometry primitive 에 `_neck` 없음(하네스 4g 로 고정).**

**목둘레 표시(반쪽 패턴 계약)**: `#designNeckLenNote` 는 4값을 구분 표기 —
**앞목선(반쪽)** / **뒤목선(반쪽)** / **반패턴 합계**(=앞반+뒤반) / **완성 목둘레**(=반패턴 합계×2).
parametric·원본 fallback 모두 같은 표기. 카라: 전체 카라=완성 목둘레 / 중심 접어재단 반쪽 카라
=반패턴 합계.

**UI (`js/ui.js`·`index.html`·`css`)**:
- **기본형 카드**(`#necklineCards` role=radiogroup, `.neck-card[data-neck]` 5개) — `<select>` 대체.
  선택 = `aria-pressed="true"`(cyan 강조), 값 진실은 DOM(카드 + 입력). `currentNeckType()`(pressed
  카드 읽기)·`setNeckType(type)`(pressed 설정 + 행 표시).
- **형태별 입력 행 표시/숨김**(`syncNecklineRows`): `data-neck-for`(common / "round boat" / v / square)로
  현재 형태에 맞는 행만 표시, original 이면 전부 숨김. **곡선정도 행 최초 표시 시 빈 값이면 형태
  기본값(round 1 / boat 0.5) 채움** — 빈 값=0=평평 방지(`readNumD` 도 같은 기본값으로 읽음).
- `readBodyInputs` 가 형태별 입력(curveAmountNorm·vPointDepthCm·squareWidthCm·cornerRadiusCm)까지
  읽어 `onApplyBodyLength` 이 `neckline.parameters` 에 전부 담는다. `committedNeckline`·
  `updateDesignBodyPanel` 이 카드 pressed + 모든 형태별 입력 복원. `bodyStatusNote` 가 4형태 라벨.
- DOM: `selNecklineType` 제거, `necklineCards`(1) + 형태별 입력 4개(inpNeckCurveAmount·inpNeckVDepth·
  inpNeckSquareWidth·inpNeckCornerRadius) 추가. **id 56→60**.

**검증(격리 origin 127.0.0.1:8420, storage 0, saves 0, console 0)** — 실브라우저 완주(원형 생성→
완료→디자인 시작):
- **V넥**: neckline 직선 1개, CF 접점=앞목+V끝점 깊이, reference·다트 불변, v 행만 표시. 스크린샷
  (남색 working 이 회색 reference 위에 깊은 V).
- **스퀘어**: neckline 3세그(line/path/line), `_neck` 합산으로 목선 길이 정확(14.9cm), **비누적
  (재적용 동일)**, reference·다트 불변. 스크린샷(수평 바닥+라운드 모서리 스퀘어 네크라인).
- **보트**: cubic path 1개 / **라운드**: path 1개(curveAmountNorm) / **원형 유지 초기화**: `_neck`
  표식 0·형태별 행 전부 숨김·카드 original 복귀·"원형으로 복원됨". 전 형태 reference 불변.
- 반응형(375px): 카드 5개 1행(351px)·가로 overflow 0·패널 밀도(입력 28px)와 일치(카드 27px).
- 하네스 `designBodiceCheck` **176**(4f 10: V/스퀘어/보트 형태별 입력·CF 접점·세그먼트 종류·다트
  불변 / 4g 5: `_neck` 미누출·piece 스칼라 길이·measureNeckline export·미적용 fallback). runAll 전체
  통과, shape/perf 골든 diff 0. 캐시 `?v=2026081810`(css)·`?v=2026081910`(designBodice·ui).

**미구현(증분 3)**: 세부 수정(현재 parametric 네크라인을 boundary 패턴선으로 변환→designOutline
재합성) + 모드 잠금(manual 후 파라미터 입력 잠금) + `기본형으로 돌아가기`(boundary 제거·parametric
복귀). 스퀘어 top(SNP 근처) 모서리 라운드 / 보트·V 앞·뒤 별도 곡률은 실사용 검증 후 별도.
→ **✅ 증분 3 완료(2026-08, 아래 섹션).**
## ✅ Design 네크라인 증분 3 (2026-08) — parametric → manual 원자적 전환(세부 수정)

증분 2 위에, **현재 parametric 네크라인을 편집 가능한 boundary patternLine 으로 변환(manual)**
하고, 카드·수치 입력을 잠그며, `기본형으로 돌아가기`로 복귀한다. render.js·엔진 무변경(사용자
확정: **기존 designOutline 오버레이 모델 유지** — working.geometry 는 원본 목선, designOutline 이
변환된 목선을 에메랄드로 오버레이, 사용자 boundary 와 동일 방식).

**변환 (`세부 수정`, `designLineTool.convertNecklineToBoundary(neckline)`)**
- `designBodice.necklineSegments(ref, neckline)`(신설 순수 export) → 앞·뒤 네크라인 세그먼트(geometry
  포맷). `geomToPatternSegments`(신설, export)로 geometry `{kind:"path"}` → patternLine
  `{kind:"cubic"}` (★ 포맷 다름 — 증분 이전 교훈), `{kind:"line"}` 유지.
- **manual candidate geometry**: `neckline.mode="manual"` 로 재계산 → **원본 목선 복귀**(boundary 가
  원본 arc 를 대체하게). parametric 목선을 그대로 두면 boundary 끝점이 목선 위라 퇴화한다.
- **원자적 dry-run**: 앞·뒤 각각 candidate 원본 ring 에 `replaceArcOnRing` 검증 → **둘 다 유효할
  때만** 진행(하나라도 실패 시 `{ok:false, reason}`, **patternLines·geometry·mode·designOutline 전부
  불변** — 실측: `frontDepth=-9` 극단값 → `"대체선 시작점이 경계에서 벗어남"`, 상태 완전 불변).
- **커밋(로컬 조립 → 일괄 대입, 진짜 원자적)**: patternLines += 자동 boundary 2개(role:"boundary") ·
  geometry=candidate(manual) · parameters.neckline={mode:"manual", type, parameters,
  **boundaryLineIds:{front,back}**} · designOutline=`composeWith(candGeom, newLines)`(기존 사용자
  boundary 와 겹치면 여기서도 실패→중단).

**복귀 (`기본형으로 돌아가기`, `revertNecklineToParametric`)**: `boundaryLineIds` 의 두 선만 제거
(**다른 사용자 선 보존** — 실측: user guide line-99 유지) → mode="parametric"(type/params 복원) →
geometry 재계산 → 남은 사용자 boundary 재합성(없으면 designOutline=null). 원자적.

**잠금·상태 (ui.js `syncNecklineModeUI`)**: manual 이면 `.neck-card` 5개 + 네크라인 수치 입력 7개
`disabled`, `기본형으로 돌아가기` 노출·`세부 수정` 숨김, **몸판 리셋 버튼 disabled**(먼저 복귀 후
리셋). parametric 이면 역(세부 수정은 **적용된 형태**=`committed.type!=="original"` 일 때만 활성).

**manual 목둘레 (`necklineBoundaryLen`)**: 파라미터가 아니라 **자동 네크라인 boundary 선 세그먼트**
(=designOutline 에 스플라이스된 목선)를 `flattenLine` 으로 측정 → **anchor·핸들 편집이 반영**
(실측: V끝점 +3cm → 16.07→18.71cm). `neckLenNote` 가 mode 로 분기. 표기는 증분 2의 4값 계약 유지.

**몸판 형상 적용(manual 유지)**: `onApplyBodyLength` 이 committed mode==="manual" 이면 neckline 을
입력에서 재구성하지 않고 **기존 manual 네크라인 보존** + 적용 후 `recomposeDesignOutline`(무효화
대신 재합성). 실측: 엉덩이 길이 10 적용 → 여전히 manual·boundaryLineIds 유지·designOutline 재합성.

**anchor·핸들·snap**: boundary 는 일반 patternLine 이라 **기존 선택·편집 도구(증분 4·5·6)를 그대로
재사용**(별도 편집 UI 없음).

**검증(격리 origin, storage 0, saves 0, console 0)**: 위 9개 계약 실측 — 변환(mode·2 boundary·
designOutline·잠금·length 보존 28/56cm) / 원자적 실패(상태 불변) / manual body-apply(유지+재합성) /
boundary 편집→length 반영 / 복귀(자동만 제거·user line 보존·parametric 복원). 스크린샷(원본 round
목선 위 에메랄드 V designOutline 오버레이). reference frozen 전 구간 불변. 하네스
`designLineToolCheck` **103**(18 신설 5: geomToPatternSegments line→line·path C→cubic·다중 C).
runAll 전체 통과, shape/perf 골든 diff 0. **DOM id 60→63**(btnNeckManual·btnNeckRevert·
designNeckModeNote). 캐시 `?v=2026081920`(designBodice·designLineTool·ui).

**미구현/경계 (단계 책임 정정, 2026-08 사용자 확정)**: `working.designOutline` 은 여전히 파생
미리보기(원본 geometry 미대체). 아래 항목은 **각각 다른 단계의 책임**이며 지금(몸판 모양) 착수하지
않는다:
- **스퀘어 top 모서리 라운드 / 보트·V 앞뒤 별도 곡률** = 몸판 네크라인의 **선택적 개선**(몸판 모양
  단계 안, 실사용 필요 확인 시).
- ~~소매 네크라인~~ = **오기**. 소매에는 네크라인이 없다. 소매산·진동둘레(armhole) 정합은 다음
  **소매 모양 단계**의 일이다.
- **manual 결과를 실제 재단 outline 으로 확정** = Design 이 아니라 이후 **패턴 확정 단계**(디자인→재단
  경계, 위 "패턴 제작 7단계 책임 경계" ⑥). designOutline 을 파생 미리보기로 두는 현 설계가 맞다.
- **카라** = **몸판 네크라인이 최종 확정된 뒤** 진행(위 "Design 네크라인 3단계" 계약).

### 증분 3 수명주기 보강 (2026-08) — 편집 재합성·전용선 보호·사용자 boundary 보존

parametric→manual→parametric 왕복을 안전하게 닫는 3건(사용자 지시).

**1. 직접 편집 후 designOutline 재합성**: boundary(anchor·핸들) 편집 pointerup 시 designOutline 을
재합성해 **에메랄드가 편집 위치로 즉시 이동**(목둘레 숫자만 바뀌던 것 → 형상도 반영). select
editDrag endDrag 에서 편집 선의 role 이 "boundary" 면 `recomposeAfterBoundaryEdit`(= 공용
`recomposeDesignOutline` + note + `window.refreshDesignBodyPanel`), 그 외(cut/guide)는 기존
`invalidateParts`. **유효하지 않으면 designOutline=null(이전 stale 유지 금지) + 구체 사유**
(`recomposeDesignOutline` 을 실패 시에도 `designOutline=null` 로 통일 — body-apply 경로와 공용).
ui.js 가 `window.refreshDesignBodyPanel = updateDesignBodyPanel` 노출(designLineTool→ui 목둘레·
상태 갱신 훅). 실측: 편집 → 앞목선 16.1→18.3cm·완성 56→60.4cm·designOutline 변화, 끝점 off-ring
→ `"대체선 시작점이 경계에서 벗어남"`·designOutline 제거.

**2. 자동 생성 네크라인 전용선 보호(`isNeckAutoLine`)**: `boundaryLineIds.front/back` 의 두 선은
**역할 변경 금지**(`setRole` 가드) · **개별 Delete/Backspace 금지**(`deleteSelected` 가드) · 역할
버튼 disabled(`syncRoleButtons`) · 선택 시 안내 `"네크라인 전용선 · 역할 변경·삭제 금지(기본형으로
돌아가기로만) · anchor/핸들만 편집"`. **제거는 `기본형으로 돌아가기`로만**, **anchor·핸들 형상
편집은 허용**. 실측(실 pointer 선택): 삭제 차단·역할 cut 변경 차단·역할버튼 disabled·guide 선은
비보호(over-block 없음).

**3. 사용자 boundary 보존·재합성**: `기본형으로 돌아가기`를 **별도 사용자 boundary 가 있는 상태**
에서도 검증. `revertNecklineToParametric` 이 `boundaryLineIds` 두 선만 제거 → 남은 사용자 boundary
로 `composeWith` 재합성(남은 boundary 없을 때만 designOutline=null). 실측: convert(user line-50 +
auto 51/52) → revert → **line-50 보존·auto 제거·designOutline front 재합성**(guide 였을 때는 null,
boundary 면 재합성 — 둘 다 확인).

**검증**: runAll 전체 통과(designLineToolCheck 103), shape/perf 골든 diff 0, 격리 origin storage/
saves/console 0. 캐시 `?v=2026081931`(designLineTool)·`?v=2026081930`(ui). export 추가:
`isNeckAutoLine`. **DOM id 63 유지**(신규 요소 없음, 로직만).
## 몸판 모양 단계 현황·다음 분기 (2026-08, 사용자 확정)

**결정**: 네크라인 증분 3 + 수명주기 보강까지로 **몸판 모양 단계의 도구가 갖춰졌다**. 현재 몸판 모양이
제공하는 것:
- 품·여유량 / 길이 / 허리·밑단 옆선 / 옆선 곡선 / 네크라인(기본형·수치·직접 편집) / 다트·절개·외곽
  대체 / `designOutline` 합성.

**다음 단계 = 앞여밈 유무 분기(사용자 확정 대기)**:
- **앞이 열리는 블라우스**면 → **앞중심 여밈(placket)** 처리 후 **몸판 확정**.
- **앞여밈이 없는 블라우스**면 → **몸판 모양을 완료로 잠그고 소매 모양 단계로** 진행(소매산·진동둘레
  정합). "소매 네크라인"은 없다(위 단계 책임 정정).
- **카라·재단 outline 확정**은 몸판 네크라인/몸판 최종 확정 뒤. 스퀘어 top 모서리·V/보트 앞뒤 별도
  곡률은 몸판 네크라인 선택적 개선(실사용 필요 시).

**첫 블라우스가 앞여밈 디자인인지 확정된 뒤** 다음 구현에 착수한다. 그 전까지 코드·shape 골든·엔진
무변경.
> **✅ 사용자 확정: 앞이 열리는 블라우스** → 앞중심 여밈(placket) 먼저(아래 섹션), 이후 몸판 확정.
## ✅ Design 앞중심 여밈(front placket) v1 (2026-08) — computeGeometry 밖의 별도 파생

앞이 열리는 블라우스 확정 → 앞판 CF 에 컷온 안단 여밈을 붙인다. **핵심 아키텍처(사용자 확정)**:
여밈을 `computeGeometry` **안에서 만들지 않는다** — manual 네크라인은 `working.geometry` 가 아니라
`designOutline` 에 있으므로, 여밈 위쪽 시작점은 **현재 유효 앞판 외곽**을 기준으로 해야 한다:
```
effectiveFrontOutline = working.designOutline?.front?.outline ?? working.geometry.front.outline
```
따라서 여밈은 **몸판 계산 뒤 별도 파생 단계**이고 결과는 `working.frontPlacket` 에 저장 —
원본 geometry·designOutline 불변.

**확정 사양**: 여밈분 기본 `1.75cm`(각 앞판이 CF 바깥으로), 컷온 안단, 안단 폭 기본 `4cm`,
목~밑단 전체 길이, **단추·단춧구멍 배치는 후속**. 앞중심 기준선:
```
기존 CF  ─ +overlap →  완성 앞단선·접힘선  ─ +facing →  안단 바깥 재단선
(단추 중심)          (foldX, construction)          (cutX, outline 끝 — 최종 외곽은 안단까지 확장)
```

**순수 모듈 `js/designPlacket.js`** (`window.designPlacket.compute(effectiveFrontOutline, params)`):
- CF 앞단 = **앞판 max x 의 수직 모서리**(품·여유량이 옆선을 −x 로 넓히므로 CF 가 항상 max x).
  그 x 의 점들 중 T=neck-CF(min y)·B=hem-CF(max y). `endpointsOf` 가 line/cubic(designOutline)/
  path(working.geometry) **세 포맷 모두** on-curve 끝점 추출(유효 외곽 두 포맷 공용).
- 폐곡선 스트립 outline(상단 수평 T→cutX / 안단 바깥 세로 / 밑단 수평 / CF 복귀) +
  construction(접힘선 foldX·CF cfX). 입력 불변. `no-outline/invalid-overlap/invalid-facing/
  no-placket(0/0)/no-cf-edge/degenerate-cf-edge/unsupported-length-mode` 실패 계약.

**파생 파이프라인 (ui.js)**: `computeFrontPlacket(project, params)` 이 effectiveFrontOutline →
`designPlacket.compute` → 성공 시 `working.frontPlacket={parameters,outline,construction}`,
**실패 시 null(stale 유지 금지)**. `refreshFrontPlacket` 이 저장 파라미터로 **유효 외곽 변경 때마다
재파생**: `onApplyBodyLength`(몸판)·`onNeckManual`/`onNeckRevert`(네크라인 mode)·designLineTool
`recomposeAfterBoundaryEdit`(경계 편집, `window.refreshFrontPlacket` 훅) 후. `여밈 적용`·`여밈 제거`
버튼. 잘못된 입력(범위 밖)은 compute 전 차단(이전 여밈 유지), compute 실패는 clear.

**★ 목둘레 길이 계약**: 여밈 상단 수평·안단은 **목둘레에 미포함**. `neckLenNote` 는 여전히 의복
네크라인(parametric=`necklineLenCm` / manual=boundary)만 재고, 여밈은 `working.frontPlacket`(별도)
이라 자동 제외. 카라에서 카라 끝점을 앞단까지 연장할지는 별도 결정(오염 없음).

**렌더 (render.js `_appendPlacket`)**: design 분기에서 designOutline 다음에, 앞판 offset transform
동승. outline=앰버 실선(`.design-placket-outline` #B45309), construction=앰버 점선. 라이브 원형
경로·shape/perf 골든 무변경.

**검증(격리 origin, storage/saves/console 0)**: 파생 성공(cutX=CF+1.75+4=53.25·outline 4·
construction 2)·**목둘레 미포함**·geometry·reference 불변·스크린샷(CF 앰버 스트립). 재파생: 엉덩이
길이 12 → 밑단 따라 botY 38→50 / 네크라인 manual 변환 → **designOutline 기준 재파생**(cutX 53.25) /
revert → geometry 기준 재파생 / **경계 편집(CF 점 +3) → 여밈 topY 6.07→9.07**(refreshFrontPlacket
훅). clear·범위 밖 입력 차단(이전 유지). 하네스 `designPlacketCheck` **19**(두 포맷·실패 계약·입력
불변·여밈만/안단만). runAll 전체 통과, shape/perf 골든 diff 0. **DOM id 63→68**(inpPlacketOverlap·
inpPlacketFacing·btnApplyPlacket·btnClearPlacket·designPlacketNote). 캐시 `?v=2026082001`
(designPlacket·render·ui·css).

**미구현/경계**: 단추·단춧구멍 배치(개수·간격·위치) / 별도 단추단 / 부분 여밈(플래킷 오프닝) /
`working.frontPlacket` 을 실제 재단 조각으로 확정 — 전부 별도 사양·승인 후. 카라는 몸판 네크라인
최종 확정 뒤. `working.frontPlacket` 은 파생 미리보기(원본 geometry 미대체).
## ✅ Design 몸판 모양 완료 체크포인트 (2026-08) — bodiceCheckpoint

앞중심 여밈까지로 **몸판 모양 도구가 갖춰졌다**(품·여유량/길이/옆선/곡선/네크라인/다트·절개·외곽
대체/designOutline/여밈). 이제 **재단 패턴 확정이 아니라 '몸판 모양 완료' 체크포인트** — 소매 단계가
안정적으로 몸판 결과를 참조하도록 잠근다(원형 완료 `blockWorkflow` 와 같은 결의 세션 스냅샷).

**단계 계약(사용자 확정, 위반 금지)**:
- 이것은 **Design 몸판 결과**이며 **아직 시접·너치·재단선이 아니다**.
- 소매 단계는 `working.bodiceResult` 의 **확정 진동선만** 참조한다.
- 몸판을 다시 수정하면 소매 결과를 **조용히 갱신하지 말고 "몸판 변경됨"으로 무효화** → 사용자가
  다시 완료한 뒤 소매를 **명시적으로 재생성**. (소매 단계는 아직 없어 스테일 판정·문서 계약만 준비.)
- reference·원본 block 불변.

**완료 게이트(사용자 확정)**: 옆선 봉제 길이 차 **>0.3cm(불일치)면 완료 차단**. **0.1~0.3(확인)·
≤0.1(정합)은 허용**. 외곽 미연결 / 진동·목둘레 미측정 / 무효 preview(manual 인데 designOutline
null)도 차단. (옆선 truing 자체는 이후 패턴 확정 단계 — 여기선 게이트만.)

**모듈 `js/bodiceCheckpoint.js`** (`window.bodiceCheckpoint`):
- `check(project)` → `{ok, fails[], connectivity{front,back}, sideSeam{front,back,diff,status}, armhole
  {front,back,ok}, neckline{front,back,half,finished,ok}, previews}`.
- **진동둘레 측정(신규)**: **edge 없는 곡선(path/cubic) 중 center-top(목점)에 닿지 않는** 세그먼트 합.
  어깨는 항상 직선·네크라인은 목점 접 → 남는 곡선이 진동(앞은 가슴다트로 2조각, 뒤는 1조각).
  **네크라인/여밈 무관하게 `working.geometry` 로 측정**(designOutline 아님 — 진동은 목선/여밈 미영향).
- 옆선=geometry `side-seam` edge 합, 목둘레=manual(boundary)/parametric(`necklineLenCm`)/원본(topological),
  연결성=designLineTool `buildPieceRing`(유효 외곽 designOutline 우선).
- `complete(project)` → 검사 통과 시 **`working.bodiceResult`**(deepFrozen) 생성, 실패 시 변경 0:
  `{sourceVersion, front:{outline,construction}, back:{…}, armholeLengths, necklineLengths, placket,
  completedAt}`. 유효 외곽(designOutline 우선) deep clone. **세션 전용(reload 소멸).**
- `isCurrentBodiceChanged(project)` → 완료본 없으면 true, 있으면 현재 signature(유효 외곽+진동+목둘레
  +여밈 파라미터) vs 스냅샷 signature 비교. **몸판 변경 시 bodiceResult 를 조용히 갱신하지 않는다.**

**UI(ui.js, design body 패널 맨 아래)**: `몸판 모양 완료` 버튼(검사 통과 시에만 활성) + 검사 요약
(`옆선 차 …(정합/확인/불일치) · 진동 앞·뒤 · 반패턴 목둘레`) + 상태(`완료 가능`/`몸판 완료됨(원형 v_)`/
`몸판 변경됨 · 다시 완료 필요`). `updateBodiceCheckpointUI` 는 refresh·몸판/여밈 적용 후 읽기 전용 갱신.

**검증(격리 origin, storage/saves/console 0)**: 진동둘레 실측(앞 20.6·뒤 21.6cm)·옆선 정합·목둘레
반패턴 18.8/완성 37.6 · 완료 → deepFrozen bodiceResult(sourceVersion·armhole·neckline·completedAt) ·
**여유량 6 적용 → "몸판 변경됨" + 이전 스냅샷 조용히 미갱신** · 재완료 → 새 스냅샷 · reference 불변 ·
스크린샷(완료 UI). 하네스 `bodiceCheckpointCheck` **18**(정합/확인/불일치 차단·외곽 미연결·manual
preview 무효·deepFrozen spec·스테일·placket 스냅샷). runAll 전체 통과, shape/perf 골든 diff 0.
**DOM id 68→71**(btnCompleteBodice·designBodiceCheckNote·designBodiceStatusNote). 캐시
`?v=2026082010`(bodiceCheckpoint·ui).

**★ 몸판 모양 단계 종료. 다음 = 소매 모양 단계**(소매산·진동둘레 정합 — bodiceResult 의 확정 진동선
참조). 별도 사양·승인 후 착수.

### bodiceResult 하드닝 (2026-08, 소매 단계 전 잠금) — 항목 1·2·3

소매 단계 전 사용자 지시 3건을 bodiceResult 에 잠갔다(항목 4 edge:"armhole" SV2 는 별도):
- **① 진동선 primitive 자체 저장**: `bodiceResult.armhole = {front:[segs], back:[segs]}` — 소매가
  길이값이 아니라 **고정된 진동 곡선 primitive** 를 참조한다(앞은 가슴다트로 2조각, 뒤 1조각).
  `armholeLen` 이 `{ok,len,segs}` 반환하도록 확장, complete 가 deep clone 저장.
- **② `bodiceResult.hash`**: 형상 signature 의 32bit 해시. 소매 결과가 **`sourceBodiceHash`** 로
  어떤 몸판 완료본에서 생성됐는지 고정하는 앵커(소매 결과는 아직 없음 — 앵커만 준비).
- **③ 스테일 판정 형상 전용**: signature = 유효 외곽(designOutline 우선)+진동+목둘레+여밈 파라미터
  **만**. **배치 offset(working.layout)·선택 상태(selectedId)·guide 선(role guide, 외곽 미포함)은
  제외** — 실측: layout offset 변경·guide 추가·선택 변경 모두 `isCurrentBodiceChanged=false`.
  boundary(role boundary)는 designOutline 에 합성되므로 형상으로 포함(정상).

검증: 실브라우저 — armhole front 2 segs(path)·back 1·hash `435afbcb`·layout offset 변경 시 stale
아님·deepFrozen. 하네스 `bodiceCheckpointCheck` **25**(6: armhole primitive·hash / 7b: 형상 전용
스테일). runAll 통과, 골든 diff 0. 캐시 `?v=2026082011`.

**남은 항목 4 (별도)**: 진동선 semantic 표식 `edge:"armhole"` 도입(현 "edge 없는 곡선=진동" 휴리스틱
대체) — SV2 스키마 확장(render.js gen-0 tagging + blockMaster 검증 + designBodice edge 보존)이라
별도 사이클. 현 휴리스틱은 유효(사용자 확인)하나 향후 진동 디자인 안전성을 위해 권고됨.

**미구현/경계**: 진동둘레 측정은 "edge 없는 곡선=진동" 가정(현 도안 기하 정확 — 미래에 다른 곡선이
edge 없이 추가되면 재검토). 자기교차("단순") 별도 검사는 buildPieceRing 연결성으로 대체(v1). 소매
스테일 무효화의 실제 소비자(소매 단계)는 아직 없음 — 판정·문서 계약만 준비.

### 소매산 봉제선 정합 확인 (2026-08, 읽기 전용) — sleeveMeasure

소매 단계 진입 **전** 봉제선 정합만 읽기 전용으로 잠근다(사용자 확정). **시접 작업 아님, 소매
형상 미변경, sleeve.js 무변경.** 완료 몸판 진동 ↔ 소매산 봉제선 ↔ 이세를 **수치만** 표시.

**순수 모듈 `js/sleeveMeasure.js`** (`window.sleeveMeasure.measureSleeveCap(sleeveGeometry)`):
- `=> Object.freeze({ frontLength, backLength, totalLength }) | null`. render·state·storage 미접근,
  자동 재계산 없음, 입력 불변.
- **입력은 live draft 가 아니라 완료본에 고정된 소매 geometry**(`referenceGeometry.sleeve`,
  frozen, `sourceBlock.version` 고정).
- 소매산 봉제선 = outline 의 **곡선(path/cubic) 세그먼트**(옆선·밑단 직선·construction·라벨 제외).
  **SP = cap 곡선 apex(min y)**, 앞/뒤 규약은 sleeve.js 와 동일(뒤=낮은 x `sx_B`, 앞=높은 x `sx_F`) —
  cap 을 조밀 샘플(60/cubic)해 apex 에서 뒤(낮은 x 끝→apex)/앞(apex→높은 x 끝) 호길이로 분할.
  apex 가 끝점(단조)이면 퇴화 → null. 방향 무관(끝점 x 로 앞/뒤 배정).

**UI 오케스트레이션 (ui.js `sleeveEaseRelation`/`updateSleeveEaseUI`, `#designSleeveEaseNote`)**:
- **차단 계약**: 완료본 없음(`no-bodice`) / 스테일(`bodice-stale`, `isCurrentBodiceChanged`) /
  **소매 출처 version ≠ 몸판 완료본**(`source-mismatch`, `sourceBlock.version !== bodiceResult.sourceVersion`)
  이면 측정 차단·사유 표시.
- 통과 시: `앞 이세 = 소매산 앞 − 몸판 앞 진동` / `뒤 이세 = 소매산 뒤 − 몸판 뒤 진동` /
  `총 = 앞+뒤`. **수치만**(적정 이세량 합격/불합격 판정 없음), **음수 이세도 부호 그대로 노출**
  (data-warn 등 색 판정 제거 — "수치만 표시" 계약). `updateBodiceCheckpointUI` 끝에서 갱신.

**검증(격리 origin, storage/console 0)**: 완료 전 "몸판 완료 후 …" 차단 → 완료 시
`소매산 앞 21.8·뒤 23.6cm · 이세 앞 +1.2·뒤 +2·총 +3.2cm`(measureSleeveCap 직접 대조 일치) →
여유량 변경 시 "몸판 변경됨" 차단 → **재완료(진동 커짐) 시 이세 재계산·음수 그대로**
(`이세 앞 -0.6·총 -0.5cm`). frozen·reference 불변. 하네스 `sleeveMeasureCheck` **13**(대칭/비대칭/
역순/single path/실패 계약/입력 불변). runAll 전체 통과, shape/perf 골든 diff 0. **DOM id 71→72**
(designSleeveEaseNote). 캐시 `?v=2026082011`(sleeveMeasure)·`?v=2026082013`(ui).

**★ 다음(소매 모양 단계)**: 실제 이세 배분·소매산 수정. 이 읽기 전용 관계 위에서 별도 사양·승인 후.
`edge:"armhole"` SV2 도입도 그 전 하드닝 후보(현 휴리스틱 유효).
