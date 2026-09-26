# 원형(draft)·완료본 이력

> 원형 완료본(blockMaster·blockWorkflow)·SV2 semantic edge·draft 화면 배치(2026-07~08).

> 이 파일은 **완료된 작업의 이력**이다. 매 세션 로드되지 않고 필요할 때만 읽는다.
> 살아있는 계약은 [../../CLAUDE.md](../../CLAUDE.md), 색인은 [../INDEX.md](../INDEX.md).

## ✅ 원형 완료 기반 S1~S3 구현 완료 (2026-07) — `원형 완료 → 디자인 복사` 1단계

로컬 5커밋(`bb05836`→`aff2baf`→`82ece4a`→`884c4ca`→`634acab`)으로 "현재 원형을 세션
완료본(blockMaster)으로 기록"하는 기반이 구현됐다. ~~**designProject·reference renderer·
디자인 시작·design stage 활성화는 아직 없다**(범위 밖)~~ → **폐기(D1~D3b, 2026-07)**:
designProject·detached reference/working renderer·디자인 시작/계속 버튼·design stage
활성화(hasProject 게이트)가 **전부 구현됐다.** 아래 "✅ 원형 완료 → 디자인 복사 (D1~D3b)
구현 완료" 섹션이 최종 계약이다. 과정 일지가 아니라 확정된
결정·불변식·경계다. 캐시 버전: render/sleeve `?v=2026072701`, blockMaster `?v=2026072801`,
blockWorkflow `?v=2026072804`, ui `?v=2026072905`, css `?v=2026072906`, designProject
`?v=2026072902`, designRenderer `?v=2026072903`.

### 1. 현재 단계 책임 (S1, `82ece4a`)
- **치수·패턴 생성·다트이동·진동선·네크라인·소매산 편집은 전부 `draft(원형)` stage 책임.**
- `STAGE_TOOLS = { draft: ["dart","curves"] }`, `DEFAULT_TOOL = { draft: null }` (js/ui.js).
- **measurements inspector(`[data-panel="measurements"]`)는 draft 에서 상시 표시** — stage
  로만 파생하고 tool 과 독립. `activePanel()`(measurements·tool 상호배타) 폐기 →
  **`contextTool()`(busy > uiState.tool)** 신설. `updateContextInspector`가 measurements 는
  stage 로, dart/curves 는 contextTool 로 **각각** hidden 판정(둘이 동시에 보인다).
- ~~**design stage 는 disabled**(`STAGE_TOOLS` 에 design 키 없음 → …항상 disabled).
  …완료본이 있어도 design 은 활성화되지 않는다(designProject/reference 구현 전까지)~~
  → **정정(D3a~D3b)**: 이제 `STAGE_TOOLS.design=[]`(도구 없음)이고 design 탭 활성 조건은
  **`designWorkflow.hasProject()`**다(아래 완료 섹션). project 는 `디자인 시작` 클릭으로만
  생성된다. (S1 시점 기록은 역사로 보존.)
- 재단·출력 stage 기존 disabled 유지. **완료 성공 후 자동 stage 전환 없음.**
- `uiState = { stage, tool }` 두 값 유지 — blockMaster/version/completion 상태를 넣지 않는다.
- > 기존 "다트·곡선=design stage" 기록(위 "플로팅…" 섹션들)은 역사로 보존하되 해당 줄에
  >  취소선 정정을 달았다(design 초기 tool=null 두 곳).

### 2. SVG geometry 의미 표식 (`bb05836`, render.js/sleeve.js)
- 봉제 형상 SVG 요소에 **`data-piece="front|back|shared|sleeve"` +
  `data-geometry-role="outline|construction"`** 부여(`_tagGeom`/`_tagDart` 헬퍼, 생성 지점에서만).
- **소유권은 생성 지점이 아는 의미로만**: `_DC_F`/`_DC_B` 인자, 함수 경계, `app.side`.
  좌표·DOM 순서 휴리스틱 금지. draft.js `drawDart` 무변경(render.js 호출부에서 태깅).
- 분류(확정): 앞옆선=front/outline, **뒤옆선=back/outline(좌표가 같아도 별개 봉제선)**,
  허리다트 a·b=front/construction, **c의 두 다리=shared/construction**, d·e·f=back/construction.
  가슴다트=front/construction, 뒤어깨다트=back/construction. **shared/outline 은 현재 0**
  (실제 공통 외곽선이 생기기 전까지 빈 상태 — 옛 "공통 옆선=shared/outline" 가정 폐기).
- **중복 identity = `piece + role + normalized primitive`** (좌표만 아님). 같은 좌표의
  front/back 옆선은 허용되는 별개 primitive.
- **data 속성은 의미 분류용** — geometry/element count/class/event/style 불변(HEAD 대비
  geometry hash·개수·class multiset 동일, data-* 2개만 추가 실측).
- **(SV2, `a278865`) 세 번째 의미 속성 `data-edge`** 를 front/back **outline** 의
  center/waist/side-seam 에만 추가했다(gen-0 은 `_tagGeom` 4번째 인자, 적용 다트는
  `drawAppliedSegments` 의 `SEG_EDGE` 화이트리스트). geometry 좌표·개수·piece/role 분포는
  여전히 불변(5개 다트 상태에서 pre-SV2 fingerprint 와 완전 동일 실측). 아래 "SV2 semantic
  edge" 섹션 참고.
- **적용된 다트 형상**(drawAppliedSegments)은 side/outline. `dart-leg*` 는 DOM class 가
  아니라 baked segment **type**(현재 열린 다트=현재 외곽선, 지배 모델).
- **기본 gen-0 분포**(workMode=all): front **7/6**, back **7/7**, shared **0/2**,
  sleeve **4/0** (outline/construction). body 모드=몸판만, sleeve 모드=소매만 — 캡처는
  항상 all 강제.

### 3. block snapshot 캡처 (`aff2baf`, js/blockMaster.js) — 순수 캡처 API
공개: **`window.captureBlockSnapshot()`**. 저장·렌더·UI 없음. 실패 시 부분 snapshot
반환 없이 `Error`(with `.reason`) throw.
```js
{ schemaVersion: 2,   // ← SV2(2026-08, `a278865`). v1 은 edge 필드 없음(구형).
  source: {
    measurements: { B, W, BL, SL, Hem, capAdj, capFormula, dartTotal },   // n()/selCapFormula
    handles: { armH, fArmH, bNeckH, fNeckH, sleeveH },                    // deep clone
    appliedDarts: { front, back } },                                      // deep clone(적용 bakedSegments)
  geometry: { front:{outline,construction}, back:{…}, shared:{…}, sleeve:{…} } }
```
- **id/version/completedAt/hash 는 snapshot 에 없다**(래퍼 몫). 좌표는 화면px→도안좌표
  (`p2c_`) 원본 정밀도. **primitive**: line `{kind:"line", from, to}` / path
  `{kind:"path", commands:[{type:"M"|"C", points:[{x,y}…]}]}`. className/style/data-* 미저장.
  **(SV2) front/back outline 의 center/waist/side-seam 프리미티브에는 `edge` 필드가
  조건부로 붙는다**(없으면 own-property 자체가 없음). 아래 "SV2 semantic edge" 섹션 참고.
- **precondition(throw reason)**: `dart-busy` / `edit-busy`(arm·neck·sleeve) /
  `missing-measurements` / `missing-handles` / `no-svg` / `bad-piece` / `bad-role` /
  **`non-mc-path-command`(M/C 외)** / **`empty-required-outline`(front·back·sleeve 필수,
  shared.outline 은 비어도 됨)** / `duplicate-primitive`.
- **workMode 트랜잭션**: 이전 mode 저장 → all 강제 render → 수집 → **finally 에서 복원**.
  전 과정 **동기**라 중간 all 화면 플래시 없음. state/dartMoveState/inputs 전후 canonical
  hash 동일, localStorage 불변.
- **알려진 위험**: drawAppliedSegments 는 곡선 run 이 정확히 2점이면 `L` path 를 만들 수
  있어(실제 파이프라인 ~0.5cm 샘플링에선 곡선당 ≥3점이라 실측 L=0), 그 퇴화 케이스는
  `non-mc-path-command` 로 **정직하게 실패**한다.

### 4. 완료 수명주기 (S2, `884c4ca`+dirty 게이트, js/blockWorkflow.js) — 세션 메모리 전용
공개 namespace 하나: **`window.blockWorkflow = Object.freeze({ complete, latest, versions,
hasCompleted, isCurrentDraftChanged })`**. localStorage/IndexedDB/파일/autoSave 미연결.
- **CompletedBlock 래퍼** `{ id:"block-1", version, completedAt, canonicalHash, snapshot }`.
  `id`=세션 block 계열(현재 `block-1` 하나), `version`=완료 이력, `completedAt`=표시
  metadata(identity 아님). 내부 `_records`(append-only)에 `{block, canonicalString}` 보관.
- **canonical identity = snapshot 전체**(schemaVersion+source.measurements+source.handles+
  source.appliedDarts+geometry) 를 `canonicalize`(재귀 key 정렬 + 숫자 **1e-4** 정규화,
  NaN/Infinity→`non-finite-number` throw)한 **canonicalString 완전 일치**로 판정.
  **32bit `canonicalHash`(8hex)는 표시·빠른 비교용일 뿐 판정 기준 아님. canonicalString 은
  외부 미노출**(`_records` 내부에만).
- **`complete()` 순서(불변)**: ①`measure-dirty` 게이트(`isMeasureDirty` bare 접근,
  **capture·busy·missing-handles 보다 최우선**) → ②`captureBlockSnapshot()` →
  ③`canonicalize` → ④최신 canonicalString 비교 → ⑤`deepFreeze`(재귀) → ⑥`_records.push`
  (**유일한 커밋 지점**). 어느 단계 실패든 records/latest 무변화.
- **버전 규칙**: 첫 완료 v1 / 최신과 다르면 v+1 / **과거 형상으로 되돌아와도 최신과
  다르면 새 version**(이력 되감기·재사용 없음, 최신하고만 비교). 최신과 같으면 **기존
  최신본 그대로 반환(idempotent, 새 version 없음)**.
- **`isCurrentDraftChanged()`**: 완료본 없음→true / **dirty→capture 호출 없이 true** /
  dirty=false→현재 snapshot canonical 비교 / busy·edit capture 오류는 throw.
- 완료본은 재귀 `deepFreeze` 로 불변. `versions()`는 매번 새 배열(원소 frozen).

### 5. 원형 완료 최소 UI (S3, `634acab`, ui.js/index.html/css)
- draft measurements inspector 의 `패턴 생성` **아래에만** 2요소: **`#blockStatusNote`
  (`aria-live="polite"`)** + **`#btnCompleteDraft`**. 상단 bar·canvas toolbar 무변경.
- **버튼**: label `원형 완료`(미완료)/`다시 완료`(완료본 있음). `dirty||busy`면
  disabled+aria-disabled. title: dirty `패턴을 다시 생성한 뒤 완료할 수 있습니다` /
  busy `현재 작업을 종료한 뒤 완료할 수 있습니다` / 정상 `현재 원형을 세션 완료본으로
  기록합니다`. **orange primary 아님 — 중립 `.btn` + navy 아웃라인**(`#btnCompleteDraft:
  not(:disabled) border navy`). 확인 modal 없음.
- **문구(5)**: `원형 미완료 · 세션 전용` / `패턴을 다시 생성한 뒤 완료하세요` /
  `현재 작업을 종료한 뒤 완료하세요` / `완료본 v{n} 보관 중 · 세션 전용`.
  **정직 원칙: 완료 후 곡선·다트를 수정해도 자동 hash 비교 전에는 "완료본 v_ 보관 중"**
  이라고만 쓴다("현재 원형 완료 v_" 금지 — working draft 와 완료본이 다를 수 있음).
- **`updateCompletionUI()`는 refresh()에서 읽기 전용** — `blockWorkflow.latest()`·
  `hasCompleted()` + dirty(`isMeasureDirty`)·busy(`busyTool()`)만 사용.
  **`isCurrentDraftChanged()` 를 refresh 에서 호출하지 않는다**(자동 hash 비교·canvas
  observer·엔진 dirty hook 금지). **새 uiState 필드 0.**
- **`onCompleteDraft()`**(addEventListener, inline onclick 아님): dirty/busy 재검사 →
  `complete()` → 성공 refresh / **실패 시 reason 별 문구만**(refresh 안 함→성공 상태 오염
  0, 콘솔로 안 흘림). **stage 활성화·자동 전환 없음.**
- **refresh 트리거**(전부 `queueMicrotask(refresh)`, 새 Observer 0): 치수 input `input/
  change`, `btnGenerate` click, **기존** 곡선버튼 click·**기존** btnDartMove MutationObserver
  재사용.
- **DOM 계약**: id **42 → 44**(`btnCompleteDraft`, `blockStatusNote` 두 개만), inline
  handler **37 유지**, MutationObserver **2 유지**. **완료본 localStorage 저장 0** —
  reload 시 메모리 초기화(미완료 복귀).

### 6. 회귀 테스트 (헤드리스, `test/harness/`)
- **`blockMasterCheck.js`(64 PASS)**: 실제 `blockMaster.js` 를 vm 으로 실행 — schema/분포,
  line·M/C 정규화, JSON 왕복, 참조 분리, 불변성, workMode 복원, 실패 계약(busy/bad
  piece·role/L·Q/필수 outline/중복), DOM·id·hash 미노출, storage 0. **(SV2 추가)** edge
  보존·edge-less own-property 없음·bad-edge·edge-placement·missing-required-edge·
  junction(missing/ambiguous)·edge 제외 중복·v1형 거부.
- **`blockWorkflowCheck.js`(52 PASS)**: 실제 `blockMaster.js`+`blockWorkflow.js` 를 같은
  vm(window===global 브릿지)로 실행 — v1/idempotent/v2·형상복귀 v3, deepFreeze, 실패
  무변화, canonicalString 미노출, NaN, key 순서 무관, 1e-4, **measure-dirty 게이트
  (capture 호출 0·missing-handles·busy 보다 우선)**, namespace frozen, storage 0.
- 둘 다 `runAll.js` 에 연결(golden 없음). **shape/perf 골든 무변경.**

### 7. 유지된 안전 계약
- **엔진 무변경**: dartMove 계산·split·bake·normalize·검증, render/sleeve 좌표·이벤트,
  SVG 좌표 변환(`c2p`/`p2c_` 왕복 오차 0). UI·workflow 변경과 엔진 변경을 같은 커밋에
  안 섞음.
- **shape/perf 골든 diff 0** 전 커밋. 저장 검증은 격리 origin(`127.0.0.1:8420`) 또는
  Node VM 만, storage 0키. 미추적 `AGENTS.md`·`armhole_data_2026-07-16.json` 보존.
- 9 viewport overflow·겹침 0, 320×568 draft SVG 192px, 콘솔 오류 0.

### 8. 다음 단계 (미착수)
- ~~**designProject 데이터 모델 + reference renderer + 디자인 시작 동작** → 이게 있어야
  design stage 를 정직하게 활성화한다(현재 disabled 유지)~~ → **완료(D1~D3b, 2026-07)**:
  아래 "✅ 원형 완료 → 디자인 복사 (D1~D3b) 구현 완료" 섹션 참고. design 은 이제
  hasProject 게이트로 활성화된다.
- "완료본 이후 변경됨" **실시간 표시**(현재는 명시적 `isCurrentDraftChanged()` 호출로만
  판정 — refresh 자동 호출·canvas observer 금지 유지) — **여전히 미착수**.
- 다중 block 계열/project 관리(현재 `block-1`·`design-1` 하나씩) — **여전히 미착수**.
## ✅ SV2 semantic edge — block snapshot 에 의미 모서리 topology 보존 (2026-08, `a278865`)

**배경**: 향후 디자인 몸판 편집(허리 아래 길이 연장 등)이 조각의 **의미 모서리**
(center/waist/side-seam)를 좌표·DOM 순서 추측 없이 안정적으로 찾으려면, geometry
primitive 에 의미 라벨이 실려야 한다. schemaVersion 을 2 로 올리고 `data-edge` →
`snapshot.edge` 경로를 추가했다. **DB1(`y+hemExt` 변환)·working.parameters·UI·piece-local
연장축은 이 단계에 없다**(별도 승인 후).

**계약 (잠금)**
- **의미 모서리 = `center | waist | side-seam`**, **front/back outline 에만** 허용.
  화이트리스트 밖 값·다른 piece/role 에 붙으면 실패. dart-leg-new/old·old-dart·곡선
  (armhole/neckline)·shoulder 계열은 edge **없음**.
- **조건부 필드**: `if (edge) primitive.edge = edge` — 없으면 `Object.hasOwn(p,"edge")===false`
  (JSON 왕복 후에도 동일). `edge: undefined` 를 만들지 않는다.
- **중복 판정은 edge 제외**(`piece+role+kind+정규화 좌표`), **canonicalString/hash 는 edge
  포함**. 같은 좌표·다른 edge 는 `duplicate-primitive`.
- **hybrid topology junction**: 각 조각에서 center∩waist, side-seam∩waist 공유 끝점
  (1e-4 정규화)이 **정확히 1개**여야 한다(0=`missing-topology-junction`,
  >1=`ambiguous-topology-junction`).
- **SV2 가 잠그는 실패 계약 5개**: `bad-edge` / `edge-placement` / `missing-required-edge`
  (front·back 각각 center·waist·side-seam ≥1) / `missing-topology-junction` /
  `ambiguous-topology-junction`. **`disconnected-semantic-edge` 는 보류** — 적용 후
  center 가 2~3조각으로 나뉘었을 때 edge graph 연결성 정의를 별도 조사한 뒤 추가한다
  (증명 안 된 검증으로 유효한 적용 다트를 막지 않는다).

**변경 파일 (9)**: `js/blockMaster.js`(schemaVersion 2·조건부 edge·검증·junction) /
`js/render.js`(`_tagGeom` 4번째 인자·gen-0 outline 6곳·`drawAppliedSegments` `SEG_EDGE`
화이트리스트) / `js/designProject.js`(**`unsupported-schema-version` 게이트** — 디자인은
v2 완료본만 소비, edge 없는 v1 유입 차단) / `js/designRenderer.js`(edge 값·위치 검증 +
`data-edge` 재발행, hem/construction edge 불허) / 하네스 4개 / `index.html`(캐시
`?v=2026080301`, render·blockMaster·designProject·designRenderer). **엔진(dartMove)·
shape/perf 골든·CLAUDE.md 외 문서 무변경.**

**테스트**: blockMaster 64 / blockWorkflow 52 / designProject 37 / designRenderer 44 /
designRenderBranch 15. runAll 전체 통과, 골든 diff 0.

**5개 다트 상태 전수 검증(실브라우저, 하네스 드라이버 이식)**: 미적용/앞판만/뒤판만/
앞뒤동시/앞판다중 각각 — capture 성공·schemaVersion 2·front·back coverage(center·waist·
side-seam)·junction 각 1개·dart-leg/old-dart/곡선 edge 0·snapshot→designRenderer edge
분포 동일·storage 0·콘솔 0. **좌표·개수·piece/role 분포 불변 증명**: `git stash` 로
render·blockMaster 를 pre-SV2 로 되돌려(dartMove 무변경이라 동일 형상 재현) 같은 5개
상태의 edge-무관 fingerprint 를 비교 → **5개 전부 완전 일치**(SV2 는 edge 라벨 외 아무것도
바꾸지 않음). canonicalHash 는 v1 대비 달라지고, 같은 v2 재캡처는 동일.

**남은 것(보류)**: `disconnected-semantic-edge` 실패 계약 / `working.parameters` 나머지
(여유량·완성길이·옆선 실루엣·네크라인·앞여밈) / 옆선 실루엣 디자인(hem kink 연결) —
전부 별도 사양·승인 후. (DB1 hem 길이 연장 변환·디자인 입력 UI 는 아래 "DB1a·DB1b"
섹션에서 구현 완료 — piece-local 연장축은 grain 기준 C-frame 으로 확정됐다.)
## ✅ 원형(draft) 화면 소매 오른쪽 배치 + union 중앙 fit (2026-08) — `js/draftLayout.js`

**배경(사용자 지시)**: design 화면에만 있던 "소매를 몸판 오른쪽 10cm 로 두고 몸판+소매를
한 묶음으로 중앙 fit" 을 **홈페이지 최초 화면(draft)** 부터 적용한다. 형상·저장은 불변,
표시(카메라·소매 offset)만 바꾼다.

**핵심 결정 (잠금)**
- **소매만 이동**: 몸판·다트·몸판곡선은 offset 0(제자리)이라 그쪽 좌표계·hit-test 는 전혀
  영향 없다. draft 는 단일 좌표계(`c2p`/`p2c_`)이므로 소매만 **표시 전용 SVG transform**
  으로 오른쪽으로 민다(geometry 좌표 불변).
- **오프셋은 실측 봉제선 outline 기준**(★ 사용자 완료 조건): `sx_B`(구성 사각형 좌단)로
  잡으면 실제 봉제선 간격이 **14.4cm 로 어긋난다**(실측). `data-geometry-role="outline"`
  요소만 측정해 `dx = bodyOutlineMaxX + 10 − sleeveOutlineMinX` → **봉제선 간격 정확히
  10cm**. `js/draftLayout.js` 가 계산해 `window.draftSleeveLayout={dx,dy}` 에 넣고,
  `sleeve.js` 는 그 값을 transform 으로만 적용 + 핸들 드래그(`evtToSleeve`)가 드래그
  시점에 live 로 되돌린다(캡처 아님). offset 계산은 `render.js` 의 draft 렌더 끝
  `afterDraftRender()`→`syncSleeveOffset()` 가 **재렌더 없이 소매 그룹 transform 만
  in-place 보정**한다(몸판·소매 outline 중 하나라도 없으면 캐시 유지 → 몸판/소매 모드에서
  안전).
- **union 중심 오차 ≤1px (실측 0px)**: fit 도 **outline-only**(라벨·보조선·핸들·격자 제외)로
  측정한다. `computeFitCamera` 는 `c2p(중심)=viewport중심` 이 대수적으로 성립(부동소수
  한계 내). 표시 박스 크기는 `getBoundingClientRect` 우선(이 SVG 는 viewBox 없어
  `clientWidth` 가 0 일 수 있음).
- **자동 fit 은 최초 진입 + 실제 캔버스 resize 에서만**: `ResizeObserver(#cv)` 가 소유한다
  (rAF 비의존 → hidden→visible/레이아웃 확정 시 반드시 전달·보정). ~~init.js 의 rAF fit~~
  은 제거. **`afterDraftRender()`/`syncSleeveOffset()` 는 카메라(view.x/y/z)를 절대 안
  건드린다** — 일반 render·휠 줌·Space 팬·곡선 편집·모드 전환 중 카메라 강제 초기화 없음
  (fit 은 `#cv` 크기 변화에만 발화, 줌·팬·편집·모드전환은 크기 불변).

**hit-test 전수 (offset 반영 누락 0, grep 증명)**: `eventToPatternPoint`/`svgPt` 전
사용처 — 소매 **3곳**(control handle·anchor start·anchor move, 전부 `evtToSleeve`) /
다트(dartMove 4)·몸판곡선(render 7)·팬줌(init 1) = 전부 **offset 0** 대상. 소매 상호작용
바인딩(sleeve.js 899·900·914)도 그 3함수로 귀속.

**변경 파일**: `js/sleeve.js`(offset 을 전역에서 read, `evtToSleeve` live, `data-sleeve-root`
표식) / `js/draftLayout.js`(신규 재작성: 순수 헬퍼 + outline-only 측정 + `syncSleeveOffset`
+ `ResizeObserver(#cv)` + 정확 중앙 카메라) / `js/render.js`(draft 렌더 끝 `afterDraftRender()`
훅) / `js/init.js`(rAF fit 제거). **엔진(dartMove/split/bake/normalize)·design 경로·
shape/perf 골든 무변경.** 캐시 `?v=2026080610`.

**회귀 테스트**: `test/harness/draftLayoutCheck.js`(17 PASS, runAll 연결) — 순수 헬퍼
계약 + mock DOM 으로 `fitDraftView`/`syncSleeveOffset`/ResizeObserver 경로까지 고정:
gap 정확히 10cm / union 중심 ≤1px(실측 0) / geometry 입력 비변형 / **ResizeObserver
콜백 후 재중앙**(두 크기) / 핸들 offset 왕복 / **격자·라벨·핸들·보조선 bbox 미개입**.
runAll 14스위트 전부 통과, 골든 diff 0.

**검증(격리 origin `127.0.0.1:8420`, localStorage 0키, 저장함수 호출 0)**:
- 첫 진입: 봉제선 gap **10.0000cm**, union 중심 오차 **dx 0 / dy 0 px**.
- 휠 줌(0.556→0.622) 후 일반 render → **zoom 보존**(fit 복귀 없음). Space+팬(x +60) 후
  render → **pan 보존**.
- `resize_window`(820→960) → 직접 fit 호출 없이 paint 시점 RO 발화 → **중심 오차 0px
  자동 복원**(hidden→visible 보정 확인).
- 모드 전환 전체/몸판/소매 — **콘솔 오류 0**, 부분 outline(body14/0·0/4·14/4) 정상,
  카메라 보존.
- 치수 변경(B 83→90, SL 52→58) + `generatePattern()` → 새 봉제선 gap **여전히 10cm**.

**소매 세로 정렬(dy)**: 소매를 가로로만 밀면 대각선 아래로 보여(자연 y 가 낮음),
`computeSleeveDy` 로 **몸판과 세로 중심을 맞춰 옆으로 나란히** 둔다(표시 후 소매 outline
세로중심 === 몸판 outline 세로중심). geometry 불변·표시 전용, `evtToSleeve` 가 dy 도 함께
되돌려 hit-test 정확. (2026-08: design 화면도 `autoSleeveOffset` 에 같은 세로중심 정렬을
적용해 원형·디자인 배치 기준을 통일 — 위 "Design piece layout" 섹션 참고.)

**미구현/경계**: draft `화면 초기화`
(resetView)는 기존 고정 리셋 유지(union-fit 아님, 문서화된 draft 계약 존중). Pages 실사용
확인은 push 이후.
