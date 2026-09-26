# Design 소매 이력

> 소매 모양 단계 계약과 S1~S5 구현(2026-08).

> 이 파일은 **완료된 작업의 이력**이다. 매 세션 로드되지 않고 필요할 때만 읽는다.
> 살아있는 계약은 [../../CLAUDE.md](../../CLAUDE.md), 색인은 [../INDEX.md](../INDEX.md).

## 소매 모양 단계 계약 (2026-08, 사용자 확정) — 아직 착수 전

읽기 전용 소매산 정합까지 완료. 다음은 **소매 모양 단계**이며, 착수는 **첫 블라우스의 기본 소매
형태·길이 확정 후**(아직 미정). 지금은 코드·shape/perf 골든·엔진 무변경.

**지배 계약(위반 금지)**:
- **`bodiceResult` 는 절대 수정하지 않는다**(소매는 읽기만).
- 소매 결과(`sleeveResult`)는 **`sourceBodiceHash` 에 고정**(`bodiceResult.hash` 앵커).
- **몸판이 stale(`isCurrentBodiceChanged`)이면 소매 편집·완료 차단** → 사용자가 몸판 재완료 후 진행.
- 이세 수치는 **현재처럼 판정 없이 사실 그대로 표시**(적정 이세량 합격/불합격 금지, 음수도 그대로).
- **실제 소매산 수정 시에만** 목표 총이세·앞/뒤 배분 기준을 별도 결정(읽기 전용 단계에선 안 함).
- `edge:"armhole"` 도입은 **현재 휴리스틱이 깨지는 기능이 등장할 때만** 진행(현재 유효).
- **아직 시접·너치·재단 조각은 포함하지 않는다**(패턴 확정 단계 몫).

**흐름(네크라인과 같은 결)**:
1. 기본 소매 형태 선택
2. 소매길이·위팔품·소매부리·소매산 높이/이세 수치 조정
3. 곡선 직접 편집
4. 몸판 진동과 정합 확인(위 sleeveMeasure 읽기 전용 관계 확장)
5. `sleeveResult` 완료 스냅샷(bodiceCheckpoint 와 같은 결)

**착수 전 결정 필요(사용자)**: 첫 블라우스의 **기본 소매 형태**와 **소매 길이**. 확정 후 1번부터
착수한다.

### 첫 소매 확정안(2026-08, 사용자) + S1 구현 완료

**확정**: 셋인 1피스 · 긴팔 · 약간 테이퍼드 · 단순 마감(커프스·트임·단추 후속) · 기본형 카드 `기본
셋인` 하나 · **기준값 = 완료 원형 소매 초기값**. **착용 보완**: 입력명은 **`소매부리 완성둘레`**(폭
아님) — 손둘레 측정 있으면 `손둘레+여유` 미만 차단, 없으면 원형 소매부리보다 좁을 때 **경고**(v1 은
트임 필요한 좁은 손목형 미생성). UI 는 **몸판/소매 서브탭 분리**(소매 탭은 몸판 완료·비스테일 후 활성).

**✅ S1 — 기본 긴팔 하부 실루엣 구현 완료**

**순수 모듈 `js/designSleeve.js`** (`window.designSleeve`):
- `computeSilhouette(refSleeve, {sleeveLengthCm, cuffCircumferenceCm, sideShape})` → **cap(곡선) +
  진동밑점 고정**, 아래쪽(옆선·밑단)만 재생성. SP=cap apex(min y), 뒤=낮은 x·앞=높은 x. 밑단 y=
  SP.y+길이, 폭=완성둘레(원형 밑단 중심 기준 좌우 분배), 옆선=진동밑(고정)→밑단(`straight` line /
  `gentle` cubic). **소매산·앞뒤 이세 관계 불변**(몸판 진동 정합 안 깨짐). 입력 불변.
- `referenceSilhouette(refSleeve)` → 원형 기준값(초기 UI): `{sleeveLengthCm, cuffCircumferenceCm,
  hemCenterX, spY, bicepCm, backUnderarm, frontUnderarm}`. **초기값이 원형 소매를 정확 재현**(실측:
  SP y53·cuff 30·length 52·bicep 33.76).
- **착용 경고**: `cuffCircumferenceCm < 원형 소매부리`면 `warnings:["narrow-cuff"]`(차단 아님).
  손둘레 입력은 현재 없음 → 경고만.

**데이터 모델·UI (ui.js, index.html)**:
- **`working.sleeveDraft = { sourceBodiceHash, parameters, geometry }`**(사용자 확정, S2 전 보강) +
  **파생 geometry 를 `working.geometry.sleeve` 로도 미러링**(render·designLayout 그대로 사용,
  render.js/designLayout **무변경**). `sourceBodiceHash` = `bodiceResult.hash`(어떤 몸판 완료본에서
  나왔는지 기록). **body apply 가 sleeve 를 블록으로 덮으면 `refreshSleeve` 가 referenceGeometry.sleeve
  (불변) 기준 재파생** → 파생 소매 유지. **몸판 재완료로 hash 가 달라지면 S1 하부 설정(길이·둘레·옆선)
  은 재사용하고 `sourceBodiceHash` 만 최신 완료본으로 갱신**(실측: cuff 22 재사용·hash 갱신). S2
  소매산 파라미터가 붙으면 hash 불일치 시 그 파라미터·결과를 stale 처리(아래 S2 계약).
- **몸판/소매 서브탭**(`#designSubtabs`, `.subtab`): 소매 탭 **게이트 = bodiceResult 존재 + 비스테일**
  (`syncDesignSubtabGate`). 게이트 실패 시 소매 탭 disabled·소매 탭이었으면 몸판으로 되돌림. S1 편집도
  `sleeveGateOk` 로 차단(몸판 stale 이면 편집 금지 — 사용자 계약).
- 소매 입력(소매길이·소매부리 완성둘레·옆선 직선/완만) + `소매 적용`/`원형 소매로`. 초기값=committed
  또는 원형 기준값. 실패 시 이전 소매 유지. 소매산 이세 정합(sleeveMeasure)은 소매 탭으로 이동
  (S1 은 cap 불변이라 그대로 유효).
- **bodiceResult·referenceGeometry·몸판 geometry 불변. sleeve.js 무변경.**

**검증(격리 origin, storage/console 0)**: 몸판 미완료 시 소매 탭 disabled → 완료 시 활성 → 소매 탭
전환(초기값 52/30) → 적용(길이 58·cuff 24: hemY 111·폭 24·**cap 불변**·narrow-cuff 경고) → body apply
(여유량 4) 후 **소매 유지(재파생)** → 몸판 stale 시 **소매 탭 disabled·몸판으로 전환** → 재완료 시
재활성 → 원형 소매로(원형 재현·params null). 스크린샷(파생 소매=긴·좁은 navy, 원형=gray, cap 공유).
하네스 `designSleeveCheck` **20**(ref 기준값·초기값 재현·cap 불변·진동밑 고정·narrow-cuff·직선/완만·
실패/불변). runAll 전체 통과, shape/perf 골든 diff 0. **DOM id 72→79**(designSubtabs·inpSleeveLength·
inpSleeveCuff·selSleeveSide·btnApplySleeve·btnResetSleeve·designSleeveNote). 캐시 `?v=2026082010`
(designSleeve)·`?v=2026082020`(ui·css).

**착용 경고 문구(사용자 확정)**: `narrow-cuff` 는 **"착용 불가"가 아니라 "원형보다 좁음 ·
트임/커프스 필요 가능"**. 손둘레 측정이 없으므로 경고 이상의 판정 금지. (module warning 은
`narrow-cuff` 하나, UI 문구만 이 표현.)

### ✅ S2 구현 완료 (2026-08) — 위팔·소매산 결합 조정

**파라미터 분리(사용자 확정)**: `sleeveDraft.parameters = { lower:{sleeveLengthCm,cuffCircumferenceCm,
sideShape}, cap:{bicepCircumferenceCm,capHeightCm}|null }`. cap=null 이면 원형 소매산(S1), 값이 있으면
변환(S2).

**cap 변환 (`designSleeve.transformCap`, 사용자 권고 알고리즘)**: **SP(cap apex)·grain 중심축 고정**.
`capHeightCm`=SP→진동밑선 수직거리, `bicepCircumferenceCm`=양 진동밑점 총거리. **앞·뒤 폭은 대칭
분할 아니라 원형 소매 비율 유지**(refBack 18.22 : refFront 15.54). 원형 cap anchor·control 을 **SP-local
frame** 으로 옮겨 **앞/뒤 x 독립 스케일 + y(높이) 스케일** → 원형 cap 의 앞·뒤 비대칭·곡선 성격 보존.
변환 cap 끝점이 곧 새 진동밑점. 그 뒤 S1 하부(옆선·밑단) 재생성.

**형상 안전성(S2 완료 조건, 사용자 확정)**: `measureCapSeam` 로 앞·뒤 봉제 측정 가능 + 닫힌 순서 loop
(cap→앞옆선→밑단→뒤옆선)의 `loopSelfIntersects`(비인접 선분 교차) 0. 실패(`cap-unmeasured`·
`self-intersection`·`invalid-bicep/cap-height`·`degenerate-cap`)면 **원자적 이전 유지**. 이세는 아직
차단 기준 아님(사실값만).

**조건부 hash 규칙(사용자 확정, 필수)**: `refreshSleeve` 가 body apply/재완료 후 재파생하되 —
**`lower` 는 재사용, `cap` 은 `sleeveDraft.sourceBodiceHash !== 현재 완료본 hash` 면 폐기(null)** →
reference cap + lower 로 복원, 사용자가 소매산 재적용해야 새 hash cap 생성. 실측: body 변경→cap 유지·
소매 탭 disabled → 재완료(hash 변경)→**cap 드롭·lower 재사용·sourceHash 갱신·cap 입력 원형값(33.8)
복원·"소매산 원형" 안내**.

**이세(S2 출력)**: `sleeveEaseRelation` 이 sleeveDraft 있으면 **파생 cap 의 `capLengths`**(S1 원형 /
S2 변환)로, 없으면 원형 소매 측정으로 계산. 앞/뒤/총 이세 = capLength − 완료 몸판 진동. 수치만.
source-mismatch = `sleeveDraft.sourceBodiceHash ≠ bodiceResult.hash`.

**UI(소매 서브탭)**: S1(소매길이·소매부리·옆선 + 소매 적용) + **S2(위팔 완성둘레·소매산 높이 +
소매산 적용)** + 이세 note. 초기값 = committed 또는 원형 기준값(bicep 33.76·capH 13.42).

**검증(격리 origin, storage/console 0)**: S1 후 params{lower, cap:null}·block cap 이세 → S2(bicep 30·
capH 15) 후 params{lower,cap}·capLengths front 21.77≠back 23.18(비대칭 보존)·이세 파생 cap 기준 →
재완료(hash 변경) **조건부 stale**(cap 드롭·lower 재사용) → 원자적 실패(이전 유지) → 스크린샷(높은
cap·좁은 bicep navy, 원형 gray). 하네스 `designSleeveCheck` **25**(S1 8 + S2 cap 변환·비율 보존·
진동밑 이동·측정·자기교차·실패/불변). runAll 전체 통과, shape/perf 골든 diff 0. **DOM id 79→82**
(inpSleeveBicep·inpSleeveCapHeight·btnApplyCap). 캐시 `?v=2026082020`(designSleeve)·`?v=2026082030`(ui).

**남은 것**: **S3 곡선 직접 편집 / S4 정합 확인(읽기 전용 이미 존재) / S5 `sleeveResult` 완료 스냅샷**
(sourceBodiceHash 고정, 시접·너치·커프스·트임 제외) / **별도 증분: 목표 총이세 → 소매산 높이·곡률
자동 탐색**. sleeve.js·bodiceResult·referenceGeometry·몸판 geometry 무변경 유지.

### ✅ S3a 구현 완료 (2026-08) — 소매산 직접 편집 핵심 수명주기

parametric cap 을 **관리형 patternLine(source of truth)** 으로 변환해 직접 편집, 편집마다 소매 재합성.
네크라인 manual(증분 3)과 같은 결이되 **소매산 앞·뒤 SP 분할 보존**. **S3b(편집 UX·무효 시각화)와
S5 완료 게이트는 별도.** 사용자 확정 5개 계약 전부 잠금.

**엔진 `designSleeve`**:
- `capLineFromGeometry(sleeveGeometry)` → 현재 cap(path/cubic)을 관리형 선 세그먼트(line/cubic, 뒤→앞
  방향 정렬) + `splitAnchorIndex`(apex 최근접 anchor)로 변환.
- `computeFromCapLine(refSleeve, capLineSegs, splitAnchorIndex, lower)` → cap=편집 선, 하부 재생성.
  **위상 재검증(뒤 endpoint x < SP.x < 앞 endpoint x, SP.y < 진동밑 y)** + 자기교차(닫힌 loop) 검사.
  **SP 분할 앞/뒤 봉제 측정**(segs[0..split-1]=뒤, segs[split..]=앞). 실패 `cap-order`/`cap-split`/
  `no-cap-line`/`self-intersection`/`cap-unmeasured`.

**데이터 모델**: `sleeveDraft.{mode:"parametric"|"manual", capLineId, capInvalid, parameters:{lower,cap},
geometry, capLengths}`. 관리형 선 = `working.patternLines` 에 `{piece:"sleeve", role:"boundary",
managedBy:"sleeve-cap", splitAnchorIndex, segments}`.

**① 관리형 선 보호(designLineTool)**: `isSleeveCapLine`(managedBy) → **역할 변경·개별 Delete 금지**·
역할 버튼 disabled·선택 안내. **제거는 `기본 소매산으로 돌아가기`로만**. 다른 사용자 sleeve 선 보존.
**② 위상 고정**: **양 endpoint anchor 이동 금지**(anchor drag 시작 차단), SP·중간 anchor·핸들만 편집.
select-edit 은 anchor 추가·삭제를 안 하므로 splitAnchorIndex 불변. 편집 후 순서 재검증(computeFromCapLine).
**③ 무효 원자성**: 편집 pointerup(designLineTool)→`window.recomposeSleeveCap`. 유효면 재합성, **무효면
`capInvalid=true`·마지막 유효 `working.geometry.sleeve` 유지**·편집선은 화면에 남음·이세 "유효하지 않음"·
**S1 적용 차단**(어떤 cap 인지 모호)·S5 완료 차단(예정). **④ 중복 렌더 금지**: render._appendPatternLines
가 managedBy sleeve-cap 은 **path 미렌더**(navy 봉제선=working.geometry.sleeve 하나만), 선택 시 anchor·
핸들 overlay 만. **⑤ 복귀·hash stale**: manual 진입 시 `parameters.cap` 보존 → 같은 hash 복귀는 그 cap
재파생 / hash 변경 시 관리선 제거·capLineId·capInvalid clear·cap 폐기·reference cap+lower 복원.

**잠금**: manual 이면 위팔·소매산 입력 disabled(직접 수정 우선). S1 길이·소매부리는 endpoint 안 건드리므로
계속(단 capInvalid 중엔 차단). manual 중 S1 적용은 `parameters.lower` 갱신 후 관리선 재합성(parametric 회귀 방지).

**검증(격리 origin, storage/console 0)**: 변환(mode manual·관리선·splitIdx·cap 보존·입력 잠금) → SP
anchor 상승 편집→재합성·이세 재측정 → 무효 편집(cap-order)→capInvalid·geometry 유지·S1 차단·이세
"유효하지 않음" → 복구 → **실 pointer 선택으로 Delete·역할 변경 차단**·역할버튼 disabled → 기본 복귀
(관리선 제거·parametric·cap 복원·입력 잠금 해제) → hash stale(재완료)→manual 드롭·cap 폐기·lower 재사용 →
관리 cap 중복 미렌더. 하네스 `designSleeveCheck` **35**(S3 10: capLineFromGeometry·computeFromCapLine·SP
편집·위상/안전 실패). runAll 전체 통과, shape/perf 골든 diff 0. **DOM id 82→84**(btnSleeveCapManual·
btnSleeveCapRevert). 캐시 `?v=2026082030`(designSleeve·designLineTool·render)·`?v=2026082033`(ui).

### ✅ S3b 구현 완료 (2026-08) — 소매산 편집 snap 제한 + 무효 표시

**Snap 제한(designLineTool editMove, isSleeveCapLine 분기)**: 관리형 소매산은 일반 디자인선 snap
(다른 patternLine·outline·격자 캐스케이드)을 **적용하지 않는다**.
- **양 진동밑 endpoint**: 이동·snap 금지(S3a anchor drag 시작 차단 그대로).
- **SP(splitAnchorIndex)**: **grain 중심축 x 고정**(`t.x = oa.x`) · **y 만 0.5cm 격자**(Alt 해제).
  실측: SP 드래그 시 x 23.75 불변·y 53→59(격자). x 고정으로 소매 중심·앞뒤 분할 의미 보존.
- **중간 anchor**: x·y **0.5cm 격자만**(다른 선 snap 없음, Alt 해제).
- **핸들**: 위치 snap 없음(기존), Shift 45°만 유지.

**무효 표시**: `sleeveDraft.capInvalidReason` 에 오류 코드 저장(recomposeSleeveCap). **무효 관리형
cap 만 빨강 점선**(`.sleeve-cap-invalid`, #cc3333, render._appendPatternLines 가 capInvalid 일 때만
그림 — **선택 무관·해제 후에도 표시**). **마지막 유효 navy `working.geometry.sleeve` 유지.** 상태
문구에 구체 사유(`capInvalidReasonStr`): `소매산 순서가 잘못됨`(cap-order) / `소매산이 자기 교차함`
(self-intersection) / `진동밑 연결이 끊김`(no-cap-line) / `SP 분할을 측정할 수 없음`(cap-split·
cap-unmeasured). 다시 유효 → 빨강 제거·navy 갱신·이세 복원.
- ★ CSS 특이성: `.sleeve-cap-invalid`(0,1,0)는 `.design-working path`(0,1,1)에 짐 → **`.design-working
  .sleeve-cap-invalid`(0,2,0)로 스코프**해야 빨강 적용(실측 rgb(204,51,51)).

**검증(격리 origin, storage/console 0)**: SP 드래그 x 고정·y 격자 / 무효 편집(cap-order·self-intersection)
→ 빨강 점선·구체 사유 note·이세 "유효하지 않음"·선택 해제 후 빨강 유지·navy 유지 → 복구 시 빨강 제거·
이세 복원. 하네스 무변경(35, editMove 는 `typeof svg` 가드로 미실행), runAll 전체 통과, shape/perf 골든
diff 0. **DOM id 84 유지**(신규 요소 없음). 캐시 `?v=2026082031`(designLineTool·render)·`?v=2026082035`
(ui)·`?v=2026082032`(css).

### ✅ S5 구현 완료 (2026-08) — 소매 모양 완료 체크포인트(sleeveResult)

S3b 위에, Design 소매 결과를 **세션 스냅샷 `working.sleeveResult` 로 잠근다**(bodiceCheckpoint 와
같은 결). **아직 시접·너치·커프스·트임·재단선 아님.** 완료본은 특정 몸판 완료본(sourceBodiceHash)에
종속 — 몸판/소매 변경 시 조용히 갱신하지 않고 stale/무효 처리 → 명시적 재완료로만 교체.

**엔진 (`js/designSleeve.js` 신규 export 2개)**:
- **`capPrimitives(sleeveGeometry)`** → `{frontPrimitives, backPrimitives, splitPoint, lengths:{front,
  back,total}}`. **cap 을 관리형 선이 아니라 최종 유효 geometry 에서** `capLineFromGeometry`(splitAnchorIndex)
  로 다시 추출 → SP 기준 뒤(segs[0..sp-1])/앞(segs[sp..]) 분리, `arcLenSegs` 로 앞·뒤 호길이. 측정
  불가면 null.
- **`sleeveOutlineSelfIntersects(sleeveGeometry)`** → bool. 닫힌 순서 loop(backU→cap→frontU→앞옆선→
  밑단→뒤옆선)의 `loopSelfIntersects`(비인접 선분 교차). 비정상·교차면 true.
- ★ **`capSegsOf` 를 hem 기반 강건 식별로 수정**(회귀): 이전 `filter(kind==="path"||"cubic")` 는
  **완만(gentle) 옆선 cubic 을 cap 으로 오인**했다. 이제 outline 최대 y(밑단)에 닿는 세그먼트(밑단
  직선 + 밑단 접점)를 제외한 나머지가 cap. designSleeveCheck 35 PASS 유지로 무변경 확인.

**모듈 (`js/sleeveCheckpoint.js` 신규, `window.sleeveCheckpoint`)**: `check`/`complete`/`latest`/
`isCurrentSleeveChanged`/`invalidatedByBodice`.
- **완료 게이트(7)**: `no-bodice`·`bodice-stale`(bodiceCheckpoint) / `source-mismatch`
  (sleeveDraft.sourceBodiceHash ≠ bodiceResult.hash) / `cap-invalid`(capInvalid) / `manual-line-missing`
  (manual 인데 capLineId 선 없음) / `cap-unmeasured`(capPrimitives null) / `self-intersection`
  (sleeveOutlineSelfIntersects) / `ease-unmeasured`(앞·뒤 이세 비유한). **narrow-cuff·이세량은 차단
  기준 아님**(사실값).
- **`complete()`** → 게이트 통과 시에만 deep-frozen `working.sleeveResult` 생성(실패 시 변경 0):
  ```
  { schemaVersion:1, sourceBodiceHash, sourceBlock:{id,version,canonicalHash},
    geometry(clone), parameters:{lower,cap},
    cap:{ mode, frontPrimitives, backPrimitives, splitPoint, lengths:{front,back,total},
          ease:{front,back,total}, manualSource: null | {lineId,splitAnchorIndex,segments} },
    hash, completedAt }
  ```
  cap primitives 는 **최종 geometry 에서 재추출**(관리선 아님). manual 이면 `manualSource`(재현·감사용).
- **`hash` = 형상 전용 signature**(canonGeom + parameters + cap.mode + cap.lengths + sourceBodiceHash).
  **completedAt·layout·선택·snap 제외** → 같은 형상 = 같은 hash.
- **`isCurrentSleeveChanged`**: 완료본 없음→true / 현재 무효→true / 형상 signature 비교(layout·선택
  변경엔 불변). **`invalidatedByBodice`**: `sleeveResult.sourceBodiceHash ≠ bodiceResult.hash`(몸판
  hash 변경 = "몸판 변경으로 소매 무효").

**UI (`js/ui.js` + index.html sleeve 서브탭)**: `소매 완료` 버튼(`#btnCompleteSleeve`, 게이트 통과
시에만 활성) + 검사 요약(`#designSleeveCheckNote`: 소매산 앞·뒤·총 · 이세 앞·뒤·총) + 상태
(`#designSleeveStatusNote`: 완료 가능 / 소매 완료됨(원형 v_) / **소매 변경됨 · 다시 완료 필요** /
**몸판 변경으로 소매 무효 · 다시 완료 필요**). `updateSleeveCheckpointUI(project)` 를 **updateSleevePanel
끝 + onApplySleeve·onApplyCap·onResetSleeve 끝**에서 호출(적용 직후 버튼/문구 즉시 갱신 — 이 세 곳에
빠져 있어 apply 후 버튼이 stale 하던 것을 수정). `onCompleteSleeve` 은 designProjectNow 재확인 →
complete → 성공/실패 문구.

**검증(격리 origin 127.0.0.1:8420, storage/console 0)** — 실 UI 완주(원형 생성→완료→디자인 시작→
몸판 완료→소매탭→소매 적용):
- 게이트 통과 → 완료 → **deep-frozen 스냅샷**(schemaVersion 1·sourceBodiceHash 435afbcb·capMode
  parametric·front/back primitives·lengths total 45.46·ease total +3.24·manualSource null·자체 hash
  f5be198c). 상태 "소매 완료됨(원형 v1)".
- **소매 변경**(길이 58 재적용) → "소매 변경됨 · 다시 완료 필요" + isChanged true → 재완료 복귀.
- **몸판 변경**(여유량 6 적용+재완료, hash 435afbcb→a57abdae) → invalidatedByBodice true, 상태
  "몸판 변경으로 소매 무효".
- **manual 완료**(소매산 직접 수정 변환 후): mode manual·**manualSource**(lineId·splitAnchorIndex 4·
  segments 8) 기록.
- 하네스 `sleeveCheckpointCheck` **32**(게이트 7 실패 모드·불변 스냅샷 spec·deepFrozen·hash
  completedAt 제외·형상전용 스테일·invalidatedByBodice·manualSource, 스텁 project). runAll 전체 통과,
  shape/perf 골든 diff 0. **DOM id 84→87**(designSleeveCheckNote·btnCompleteSleeve·
  designSleeveStatusNote). 캐시 `?v=2026082041`(designSleeve·sleeveCheckpoint·ui).

**★ 소매 모양 단계 종료. 다음 = 카라 모양 단계**(몸판 목둘레 최종 확정 뒤). `sleeveResult` 는 시접·
너치·커프스·트임·재단선 미포함 — 별도 사양·승인 후.

### S2 계약 (2026-08, 사용자 확정)

**과결정 금지**: `위팔 완성둘레`·`소매산 높이`·`목표 이세량` 셋을 모두 독립 입력으로 두면 충돌한다.
**S2 1차 계약**:
- **입력: 위팔 완성둘레 + 소매산 높이**(둘만).
- **출력: 앞·뒤·총 이세량**(사실값 표시, 자동 합격·보정 없음).
- **앞뒤 이세 배분은 기존 소매산 비율을 우선 유지**.
- 위팔품 변경은 소매산과 **독립 입력이 아니다** — 진동밑점·소매산 길이가 함께 바뀌므로 위팔 여유·
  소매산 높이·총이세·앞뒤 배분·앞뒤 소매산 봉제 길이를 **한 번에 원자적 재계산**. 실패(cap 곡선이
  단순하지 않거나 교차)하면 **이전 소매 형상 유지**.
- **hash 종속**: S2 소매산은 특정 `bodiceResult` 에 종속 → `sleeveDraft.sourceBodiceHash` 불일치 시
  소매산 파라미터·결과 stale(S1 하부 설정은 재사용).
- 그다음 **별도 증분**: `목표 총이세 → 소매산 높이/곡률 자동 탐색`.

**남은 것**: **S2(위 계약)** → **S3 곡선 직접 편집 / S4 정합 확인(이미 읽기 전용 존재) / S5
`sleeveResult` 완료 스냅샷**(sourceBodiceHash 고정, 시접·너치·커프스·트임 제외). 완만 곡선 옆선은
S1 에 포함(straight 기본).
