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

## 기술 교훈 — 강체 변환 왕복 뒤 «곡선 정의역 비교»는 끝점에서 1ulp 넘칠 수 있다 (2026-10-28, 소매 Ⓞ)

- 증상: Ⓐ 입력 AH 를 1e-7~1e-6cm 만 바꿔도 Ⓞ 가 «fold-mismatch(detail NaN)» 로 실패(박시 값에서도 재현).
- 원인: 바깥 조각 끝 표본 p 를 평행 이동 +DX 후 역이동 −DX 하면 `(x + DX) − DX ≠ x` 가 1ulp 생긴다. 접은 점이 Ⓐ 소매산 x 정의역 끝을 1.8e-15cm 넘자
  `yAtX` 가 «어느 cubic 에도 없음» → NaN 을 돌렸고, `Math.max(dev, NaN) = NaN` 이 검사 전체를 실패로 만들었다. 강체·접기 불변식은 지켜지고 있었다.
- 수정 원칙: 허용오차를 키우거나 입력을 반올림해 피하지 않는다. **정의역 밖 거리 자체를 편차로 계산**한다(넘침 x 와 끝점 y 차 중 큰 값).
  넘침이 실제로 크면(종이 밖) 그대로 실패하고, 정의역 안에서 NaN 이 나오면 무한대로 실패시킨다(조용한 통과 없음).
- 진단 방법: 엔진 소스를 **메모리에서만** 계측 코드로 바꿔(저장소 파일 무변경) 최악·NaN 표본의 owner·t·좌표·정의역 끝과의 차를 찍으면 바로 보인다.
- 일반화: «변환 → 역변환 → 원 곡선에서 y(x) 조회» 류 검사는 모두 끝점 정의역 처리가 필요하다. 같은 패턴의 Ⓕ·Ⓝ 은 섭동 36건에서 문제가 없었다(무변경).


---

> 아래는 2026-11-26에 이전한 옛 STATUS 기록이다. 당시 진행 표기와 원문 링크를 보존했다. 상대 링크의 기준은 원래 위치인 `docs/STATUS.md`다.

~~~~markdown
- **소매 Ⓓ·Ⓔ 플레어(P.42) — 구현·연결 완료, 커밋 `316ce4b`(Ⓓ)·`0abfeb4`(Ⓔ, push 완료 · Codex 재검증 관련 828 통과).** Ⓔ 앞/뒤 분할 = 소매산 × 소매 중심선(최고점 대비 B83 ≈0.26cm 차는 이 사례에 한해 허용). [book/P042.md](book/P042.md).
- **소매 Ⓕ 턱 소매(P.43) — 완료, 커밋 `ff90e24`**(소맷부리 자연 곡선 포함). 미확정: 박기 끝(책에 없음 — 만들지 않음). [book/P043.md](book/P043.md)
- **소매 Ⓖ 턱 소매(P.43 하단) — 완료, 커밋 `c829244`(push) · 김님 화면 확인 «나쁘지 않다 오키»(2026-10-11).** 현행 규칙: 고정 중심 O = 소매 중심선 × 위팔선, ★3 위로(가운데 조각·SP 상승), ☆·몸통·소맷부리 고정, 길이 보정 안 함(입력 52 / 펼친 중심 55 구분 표시), 진동밑 바깥 연장(안 1) 반영. 이력: «SP 고정 / 몸통 아래로»는 폐기된 오해(P043 이력 절). [book/P043.md](book/P043.md)
- **소매 Ⓗ 퍼프 슬리브(P.44, 카탈로그 순서 5) — 완료, 커밋 `c862d56`(김님 화면 승인 · 소맷부리 truing·원래 종이 표시 포함).** 커프스 = 치수 정보만. B83: 곡선 48.04 · 커프스 ● 24 · 개더 24.04 · S 굽이 최대 0.21(sweep 최대 1.19 — SL40). 의도 정정: 책 «절개 그림»처럼 **원래 종이 조각(녹색, meta.rigid) + 틈(덧댄 종이) + 최종 재단선**을 완성 Ⓗ 안에 표시(토글 기본 켜짐) — 앞서 오해로 추가한 «벌리기 전 도안»은 비교 토글(기본 꺼짐)로만. 소맷부리 truing(2026-10-12 김님 «조금 파먹어도 … 예쁜 곡선» — 8점·S 시안 조건 대체): 오목 B-spline · B83 파임 0.15 · 덧댐 0.25 · 소맷부리 47.99 · 개더 23.99(SL40 의 1cm 초과 포함 — 김님 2026-10-12 «개더 여유 부분이라 실루엣에 안 나타남» Ⓗ 검토 범위 승인, 일반 규칙 아님). 회귀 `designSleeveHCheck` 41 · `sleeveHUICheck` 56. 같은 쪽 Ⓘ 미착수. [book/P044.md](book/P044.md)
- **소매 Ⓘ 퍼프(P.44 하단) — 완료, 커밋 `c89fb45`(김님 승인).** Ⓔ 이동(가운데 SP 대칭 → 바깥 이동 기준점, O 는 갈라짐 — 기준 SP·이등분선) + Ⓗ 커프스 산식(∅ = ● − ■, 손바닥 21) + 소매산 꺾임 3곳 재제도(ℓ 2 시작·하한 0.5 잠정) + 소맷부리 truing. B83: 소매산 앞 21.46 · 뒤 22.84(Ⓐ −0.01) · 이세 +2.09 · 소맷부리 48.01 · 개더 24.01 · 파임/덧댐 0. 회귀 `designSleeveICheck` 26 · `sleeveIUICheck` 30. [book/P044.md § Ⓘ](book/P044.md)
- **소매 Ⓙ 퍼프(P.45, 중심선 평행 벌림) — 완료, 커밋 `65a3db8`(김님 화면 승인).** Ⓐ 중심선 절개 → 좌우 ∅/2 평행 이동(회전 없음 · 기준 = 틈 가운데) · ∅ = 0.7● − ■ = 1.7● − W(개더 계수 0.7 = 책) · 소매산 꼭대기 +상승(기본 0.7 — 별개 설정값) · 틈 위 최소 국소 재제도(ℓ 0 → 0.5 → 0.25 씩, 잠정) · 소맷부리 직선 1.7●. B83: ∅ 8.73 · 소맷부리 40.80 · 개더 16.80 · 소매산 뒤 27.29 / 앞 25.91 · Ⓐ 이세 +2.11 + 추가 개더 +8.88 = 최종 − AH +10.99 · ℓ 1.75. 남은 질문: ℓ 가 5cm 넘는 경우(손바닥 18 · 상승 1.5)를 국소로 볼지. [노트](book/P045.md)
- **소매 Ⓚ 퍼프(P.45 하단, Ⓙ 방법 + 소매산 기준점 절개) — 완료, 커밋 `65a3db8`(김님 화면 승인 · 상승 0 계측 수정 포함).** 출발 Ⓐ · 절개 3개 · ∅ = 1.5● − ■ = 2.5● − W(개더 계수 1.5 = 책 — Ⓙ 의 0.7 과 다름) · 틈마다 ∅/3: 가운데 좌우 ∅/6 평행 → 바깥 조각만 이동한 기준점에서 회전 · 꼭대기 +상승(기본 0.7, 설정값) · 소매산 가운데·꺾임 2곳 국소 재제도(잠정) · 소맷부리 전체 truing. B83: ∅ 27.93 · 틈 9.31 · 소맷부리 실측 60.01(산식 60) · 개더 36.01 · 소매산 뒤 27.56 / 앞 26.19 · Ⓐ 이세 +2.11 + 추가 개더 +9.43 = 최종 − AH +11.54. 상승 0 의 앞/뒤 계측 분할 버그(Ⓙ 공통)는 2026-10-13 수정 — geometry `capSplit`(중심선 x) 명시 + 공용 측정이 그 교점에서 분할, 기준 없는 소매는 옛 규칙 그대로 — [노트](book/P045.md) § Ⓚ.
- **소매 Ⓛ 반소매 퍼프(P.46, 6교시 «반소매의 변형» 대표 — 카탈로그 순서 6) — 완료, 커밋 `8b17562`(김님 화면 승인 · ■ < 0 허용 보완 포함).** 출발 = 소매길이 기본 20(SP → 출발 밑단)의 Ⓐ · ● = 위팔 둘레(이 책 26) + 4 · ∅ = 0.5● − ■ = 1.5● − W · ⊠ = ∅/4 · 틈(현) 가운데 2⊠ · 양옆 ⊠ · Ⓘ 와 같은 이동(가운데 SP 대칭 → 바깥 이동 기준점) · 소매산 꺾임 3곳 국소 재제도 · 소맷부리 전체 truing · 앞/뒤 분할 = `capSplit`. B83: ⊠ 3.23 · 소맷부리 실측 45.03(산식 45) · 개더 15.03 · 소매산 뒤 22.84 / 앞 21.46 · 이세 +2.08 · 벌린 뒤 중심 길이 19.96. **■ < 0(위팔 둘레 + 4 > Ⓐ 소매폭)은 2026-10-19 김님 승인 — 같은 산식으로 허용**하고 실제 기하(꼭대기 오목 `cap-top-concave` · 조각 겹침 · 자기교차 · 연속성)만 막는다. 회전 45° 는 수치 가드(책 규칙 아님)로 구분 표시. B83 · 소매길이 20: 위팔 28.5~32 성립 · 33/34 꼭대기 오목 · 35/36 수치 가드(표는 노트). [노트](book/P046.md)
- **소매 Ⓩ 프렌치 슬리브(P.55 아래 · 소매길이 12) — 김님 구현 승인(«좋아좋아 진행시켜» · 겨드랑이 끝 뾰족 형상 승인), 제품 적용 미커밋¹(2026-11-04 · Codex 검토 대기).** 완료 몸판 Ⓐ 만(형상 게이트) → **몸판 일체형 뒤·앞만**(`working.sleeveZ.derivedBodice` · 완료본 소유 · `bodiceResult` 무변경) · **별도 소매 조각·덧천 없음**(빈 버킷 `sleevePiece:false` · 소매산·AH 이세 «적용 안 됨» · cap lengths/ease null). 앞 AH 다트 → 옆(Ⓣ/Ⓥ/Ⓨ 연산 재사용 · 18.25° · 폭 4.99) · 뒤 어깨 다트 열린 채 · SP 에서 어깨선 연장 12(끝 내림 없음) = E → E 직각 → 가이드 E–C(원래 진동 아랫점)에서 뒤 0.7 / 앞 0.3 부풀림 → C 둥글림(가이드 위 2.5 = T · 옆선 아래 2 = H 소맷부리 끝) → 옆선 접선. 원래 진동 전체 + 옆선 위 C→H 는 새 외곽 안(덧붙이기만 · 깎는 부분 없음). B83: 어깨 봉제 24.280 = 24.280 · 옆선 35.383 = 35.383 · 소맷부리 19.30 + 14.15 = 33.45(원래 진동 42.21) · E 연결 90°+90° · H 180°+180°(뾰족). **책 수치(수정 가능)**: 12 · 0.7 · 0.3 · 2.5 · 2 / **관례**: 옆 다트 3(H 에서 1) · C 둥글림 2차 곡선 · E→T 곡선 T 손잡이 = 최대 곡률 최소(원래 종이 침범 금지). **한계**: B83 기본값에서 소매길이 11.5 미만은 책 공정 불성립 → 사유와 함께 거부(10.5 이하 직각이 가이드 안쪽 · 11 앞 부풀림 불가). 공용 소매길이 칸 = 어깨 연장(기본 12 · Ⓨ 와 함께 10–90 잠금 제외 — 범위는 엔진 사유). 3D 미검증 · B83 밖 기본값 미검토. 회귀 `sleeveZCheck`(픽스처 `sleeveZApproved.json` = 승인 scratch). [노트](book/P055.md)
- **소매 Ⓨ 프렌치 슬리브(P.55 위 · 소매길이 5) — 김님 구현 승인(«맞아 진행시켜» · 0.5 = 연장선 직각 확정), 제품 적용 커밋 `5621e49`(엔진)·`6d0a01f`(연결)(2026-11-04 · 김님 화면 «오키오키 좋아»).** 완료 몸판 Ⓐ 만(형상 게이트) → **몸판 일체형 뒤·앞만**(`working.sleeveY.derivedBodice` · 완료본 소유 · `bodiceResult` 무변경) · **별도 소매 조각·덧천 없음**(`geometry.sleeve` = 빈 버킷 `sleevePiece:false` · 소매산·AH 이세 «적용 안 됨» · cap lengths/ease null). 앞 AH 다트 → 옆(Ⓣ/Ⓥ 연산 재사용 · 18.25° · 폭 4.99) · 뒤 어깨 다트 열린 채 · SP 에서 어깨선 연장 5 → 연장선 직각 0.5 = E(SP 방향 변화 5.71° 그대로) → E 직각 → 원래 진동에 접선 합류 J. B83: 어깨 봉제 17.305 = 17.305 · 옆선 37.383 = 37.383 · 새 팔구멍 20.68 + 18.28 = 38.96(원래 진동 42.21). **관례(수정 가능)**: 합류점 = 진동 아랫점에서 호 3 · 옆 다트 3 · 곡선 = 최대 곡률 최소(원래 종이 침범 금지). 공용 소매길이 칸 = 어깨 연장(기본 5 · Ⓨ 만 10–90 잠금 제외). 3D 미검증 · B83 밖 기본값 미검토. Ⓩ(P.55 아래)는 별도 행 — Ⓨ 엔진·결과 무변경. 회귀 `sleeveYCheck`(픽스처 `sleeveYApproved.json` = 승인 scratch). [노트](book/P055.md)
- **소매 Ⓧ 기모노(P.54 · 제도 방법 P.144–145 · 닫는다·벌린다 P.161) — 김님 구현 승인 · Q1/Q2 확정, 제품 적용 커밋 `a264d71`·`0718cf1`(2026-11-04 · 김님 화면 «괜찮은데»).** 완료 몸판 Ⓐ 만(형상 게이트) → **몸판 일체형 뒤·앞**(소매 붙임선 없음 · `working.sleeveX.derivedBodice`) + **별도 덧천**(`geometry.sleeve` · `integratedBodice`) · 완료본이 소유(`bodiceResult` 무변경). 앞 AH 다트 → 목둘레(옆 불가 · 18.25° · 목 다트 6.50) · 뒤 어깨 다트 열린 채 · 경사 8 ⟂ 뒤 1.6 / 앞 0.7 · Ⓑ = ★선–옆선 중점(ø 2.62) · 앞 Ⓕ = 뒤 ø(Q2) · 외곽 소매 밑선 → Ⓒ → Ⓑ → Ⓓ(초승달 종이 남김 — Q1). B83 · 소매길이 54: 폭 16.24 / 13.17 · 밑선 27.304 = 27.304 · 덧천 = 노치 ① ▣ 9.078 · ② ▲ 17.893 · ③ ※ 16.992 · ④ ▣ 9.078. **소매산·AH 이세 적용 안 됨**(cap `none-integrated` · lengths/ease null). 관례(수정 가능): 목 다트 위치 45% · SP 다듬기 2cm. 소맷부리 둘레 ≈ 42.6 · 팔꿈치 ≈ 58.8 = 관찰값(보편 치수 아님). 3D 미검증 · B83 밖 기본값 미검토. 회귀 `sleeveXCheck`(픽스처 `sleeveXApproved.json` = 승인 scratch). [노트](book/P054.md)
- **소매 Ⓦ 래글런(P.53 · P.137 · 제도 방법 P.142–143 · 맞댄다 P.157 · 닫는다 P.160) — 시안 제품 적용, 미커밋¹(2026-11-03 · 김님 그림 «괜찮은데» · 제품 완성 승인은 검증 후 별도).** «Ⓥ 와 같이» → 파생 몸판은 Ⓥ 와 같은 형상. 소매만: ◉ × 1/2 = 8.530 · 경사 8 ⟂ 뒤 1.3 / 앞 2 · SP 다듬기 없음(SP = 다트 끝) · 뒤·앞 중심선 SP→소맷부리를 맞대 **한 장 소매**(맞댄 선 54 = 54 · 솔기 아님 · 외곽에서 빠지고 기준선 `butt-line`) · 목 ~ SP = **열린 어깨 다트**(외곽 role `shoulder-dart` · 22.89° · 목 3.78). **다트 다리 뒤 12.263 / 앞 12.280 — 차 0.016 기록만(보정 없음).** 달림선 뒤 28.608 / 앞 25.507(몸판 = 소매) · 밑선 45.731 = 45.731. 폭 19.5 / 19.1 = **시안**(몸판 ★→진동 아랫점 곡선 반전 → 같은 현 길이로 폭선, B83 19.49 / 19.09 · 도해 폭/◉ ≈ 2.2) · 지원 범위 B83 17~20(21 거부) · 나머지 시안 값 = Ⓥ 확정값. 엔진 재사용 = `draftSleeveV(…, { spCorner: "keep", pieceGapCm: 0 })`(Ⓥ 기본 경로 무변경) · Ⓥ·Ⓦ 자기교차 판정 공선 잡음 오판 수정. 카라 목둘레 한계는 Ⓥ 와 같음(넓히지 않음). 회귀 `sleeveWCheck`. [노트](book/P053.md)
- **소매 Ⓥ 래글런(P.52 · 제도 방법 P.142–143 · 닫는다 P.160) — 김님 확정 시안(«오키 확정» 2026-11-01) 제품 구현, 커밋 `3b7d68d`.** 완료 몸판 Ⓐ 만(Ⓡ·Ⓣ 게이트) → 파생 몸판(래글런선으로 자름) + **두 장 소매**(중심 = 솔기 · 맞댐 아님)를 `working.sleeveV`·`sleeveResult.derivedBodice` 가 소유(`bodiceResult` 무변경). 앞 AH 다트 이동만 `designSleeveT.parts.moveFrontDart` 재사용. 완료본 cap = 소매 달림선(kind `raglan-seam` · 분할점 없음 · 이세 0). B83·소매길이 54: 달림선 뒤 28.608 / 앞 25.507(몸판 = 소매) · **중심 솔기 뒤 66.175 / 앞 66.159 — 차 0.016 기록만(보정 없음)** · 밑선 41.417 = 41.417 · 승인 시안과 형상 차 < 0.02cm. ★ 위치·아랫점 폭·핸들·해제 곡선·진동 합류·다듬기 폭 = **이번 시안 설정값**(일반 공식 아님 — 다른 치수 기본값 미검토 · 소매산 높이 비율을 크게 바꾸면 아랫점 폭 조정 필요 → 거부). 카라 단계는 bodiceResult 목둘레 그대로(길이 같음 · 래글런 목 모양 미반영 — 범위 밖). 회귀 `sleeveVCheck`. [노트](book/P052.md)
- **소매 Ⓣ 셔츠 슬리브(P.50 · 제도 방법 P.140–141) — 화면 검토용 시안, 미커밋¹(2026-10-28 · 2026-10-30 소매산 재보완).** 완료 몸판 Ⓐ 만(Ⓡ 게이트 재사용) · 소매 Ⓐ 공식·Ⓡ 파생 몸판 미사용. 앞 AH 다트 → 옆(진동 아래 3 · 18.25°) · 경사 8 ⟂ 뒤 4 / 앞 3.4 · ◉ = 평균 어깨 길이(P.137 봉제 상태) × 3/4 = 12.80 · 소매산 = 진동(이세 0) · 소맷부리 뒤 폭 × 3/4, 앞 = 폭 − ● · 한 장 소매. **2026-10-30 P.140–141 재검증**: 경사 축·◉ 시작점·폭선·소매 아랫점·다트 이동·맞대기는 책과 같고, 원인은 소매산 곡선 관례(뒤 아래 직선 · 앞 아래 갈고리 · 조각 사이 곡률 끊김) → 맞댄 한 장 전체를 곡률 연속 곡선 하나로(진동 + 매끈한 차이 · 실측 최대 0.7 / 0.5 · 앞뒤 소매 아랫점 동시 해) · ★ 0.72 / 0.44 · 0.72(도해 참고값). 김님 그림 비교 «많이 좋아졌다» — 제품 확정 전. B83·소매길이 54: 폭 31.18 · 소맷부리 22.92 · 밑선 41.41/41.41 · 완료본 hash `49a4d2d0`. 파생 몸판은 `working.sleeveT` 소유. 옆 다트 끝 = BP(확정 제도점). **미확정**: 소매산 곡선 구성(관례) · ★ 위치(도해 참고 시안값). 수렴 실패(`cap-offset-not-converged`) 거부 · 몸판 위 제도·한 장 소매 설명 글자가 이웃 피스·이웃 설명에 겹치던 것(5b00d15 부터) 피스별 가로 띠로 표시 전용 보완(남은 관찰: 라인 공통 몸판 가장자리 이름이 작은 배율에서 소매 끝에 닿음). 회귀 `sleeveTCheck` 92. [노트](book/P050.md)
- **소매 Ⓤ 셔츠 슬리브(P.51 «Ⓣ 와 같이 제도») — 화면 검토용 시안, 미커밋¹(2026-10-29 · 2026-10-30 소매산 재보완).** Ⓣ 순수 기하 엔진 재사용(`designSleeveT.draftSleeveU` — 기본값·규칙 이름만 다름) · 상태 `working.sleeveU` · 몸판 Ⓐ 만. 책(F): ◉ = 평균 어깨 길이(P.137 봉제) × 1/2 · 경사 8 ⟂ 뒤 1.3 / 앞 0.5(도해 ★ = 경사) · 소매산 차이 0.5 / 0.5 / 0.5 · 이세 0 · 앞 AH 다트 → 옆 · 뒤 어깨 다트 유지. Ⓣ 승계: 소맷부리 뒤 폭 × 3/4 · 앞 = 폭 − ●(김님 지시) · 옆 다트 3. Ⓣ 재보완 관례 승계(곡률 연속 한 곡선 · 접점 0.72 / 0.44 · 0.72). B83·소매길이 54: ◉ 8.53 · 폭 36.96 · 소맷부리 27.41 · 밑선 45.72/45.72. **관찰**: 소매산 꼭대기가 SP 보다 약 0.13 높고 SP 부근 평평(기록만). 소매 아랫점 해 0개/여러 개는 거부(높은 소매산 + 완만한 경사 — 기본값 주변 108/108 성립). **미확정**: 소매산 곡선·접점 위치·소맷부리(Ⓣ 승계). 실제 입력에서 복수해는 못 찾음(순수 경계로 거부 동작 시험). 회귀 `sleeveUCheck` 85. [노트](book/P051.md)
- **소매 Ⓢ 돌먼 + 중심 개더 띠(P.49 하단) — 화면 검토용 시안, 미커밋¹(2026-10-28).** 같은 몸판 Ⓐ 의 Ⓡ 를 읽기 전용 재제도 → 중심선에서 나눠 뒤·앞 각 G/2 평행 이동 + 가운데 띠 G(기본 12). 띠 바깥 소매산 개더 범위 각 6(별도 입력, 총 24). 소매산 87.07 · 결과 차 +11.90 = Ⓡ −0.10 + 추가 12 · 소맷부리 64 / 62.79 · 실제 개더 36.79. 파생 몸판은 `working.sleeveS` 소유. 회귀 `sleeveSCheck`. [노트](book/P049.md)
- **소매 Ⓡ 돌먼(P.49 «몸판에 직접 제도») — 커밋 완료(엔진 `ed2ffeb` · UI·문서 `b1ed4d0`, 2026-10-28).** 출발 = 완료 몸판 Ⓐ 만(형상 게이트 — 같은 원형의 Ⓐ 계산값과 외곽·제도선 일치 · 여밈·페플럼·이음선 기록 없음, 다른 22종은 `bodice-not-a` 거부). 결과 = **파생 몸판(앞·뒤) + 한 장 소매**를 `working.sleeveR`·`sleeveResult.derivedBodice` 가 소유(`bodiceResult` 무변경 · signature 에 파생 몸판 포함). 책 수치 전부 설정값(어깨 연장 5 · 옆 여유 3/1.5 · 소매 폭선 5 · 소매 길이 26 · 소맷부리 아래 1.5 · 커프스 = 팔꿈치 22(P.8) + 4). 소매 밑점 = 소매 폭선 위 «교차점 아래 같은 길이»(김님 (가)) · 이세 강제 없음. B83: 폭 74.27 · 이세 합 −0.10 · 소맷부리 식 52 / 실측 51.32(현이 ● 보다 짧음 — [노트](book/P049.md)) · 밑선 차 −0.05 · 어깨 차 −0.05. **표시 보완(2026-10-28)**: 재단선 상시 · 제도선·어깨 비교만 토글 · Ⓡ 표시 범위로 가로 배치 간격(A–Q 배치 무변경) · 뒤 어깨 다트 닫힘 전후·최종 직선·목 쪽 입구 이탈 0.53 비교(보정 없음) · 소맷부리 S 굽이 보완(두 끝 직각선 교점 곡선 — 실측 50.79 · 개더 24.79) · 몸판 공정 ①~⑧·한 장 소매 제작 정보 · 한 장 소매는 몸판 아래 줄. **미확정**: 몸판 진동 옆선 쪽 끝 방향 · 핸들 0.4·교차점 방식 = 현재 시안 설정(책 확정 규칙 아님, 1/3 이면 앞 교차 없음 → 거부) · 팔꿈치 ≥ 32.5 / 소맷부리 아래 0 의 소맷부리 충돌(거부 중). 회귀 `sleeveRCheck` 109. Ⓢ 는 위 항목(2026-10-28 시안). [노트](book/P049.md)
- **소매 Ⓜ 반소매 퍼프(P.46 하단 «소매산과 소맷부리를 잘라서 벌린다») — 완료, 커밋 `05e4dd2`(김님 화면 승인 · 상승 기본 0.5 · 높은 상승 범위 확장은 보류).** 출발 = 소매길이 기본 20 의 Ⓐ · 위팔 기본 26 · 상승 기본 0.5(개더 계수 0.7 과 별개) · ∅ = 0.7● − ■ = 1.7● − W · ⊠ = ∅/10 · 절개 5개 · 틈(현) 1:2:4:2:1 · 가운데 평행(좌우 2⊠) → 중간 조각(안쪽 기준점) → 바깥 조각(함께 운반된 바깥 기준점) · 소매산 가운데 + 꺾임 4곳 국소 재제도(잠정) · 소맷부리 12점 truing · 앞/뒤 분할 = `capSplit`. B83: ⊠ 1.89 · 소맷부리 실측 51.01(산식 51) · 개더 21.01 · 소매산 뒤 26.66 / 앞 25.28 · Ⓐ 이세 +2.11 + 추가 개더 +7.62 = 최종 − AH +9.73 · 벌린 뒤 중심 20.53. ■ < 0 도 같은 산식. 멈춤: 회전 수치 가드 45° · 가운데 재제도 잠정 구간 상한(상승 0.9 이상 — 상한 확대 여부 김님 판단). Ⓝ~Ⓠ(P.47–48)는 제목만 판독·보류. [노트](book/P046.md) § Ⓜ
- **소매 Ⓝ 반소매 퍼프·소맷부리 턱(P.47) — 화면 검토용 시안(2026-10-20 · 김님 기본 화면 확인 2026-10-21 · 미커밋¹ 보존 — 커밋 지시 대기).** 출발 = 소매길이 기본 20 의 Ⓐ · 절개 중심선 + 좌우 각 2.5 · 벌림(현) 가운데 4 · 양옆 2 · 박기 끝 1.5 — 전부 책 기본 설정값(수정 가능, 산식 아님) · 커프스·개더 없음 · Ⓛ 이동(SP 대칭 → 운반된 기준점) · 소매산 꺾임 3곳 재제도(잠정) · 턱 중심 쪽(양옆 = 바깥 조각 변을 얹음, 가운데 = 두 반쪽 중심선 맞닿음) · 접은 상태(Ⓐ 직선) → 역변환으로 펼친 재단선(접힘 중간선에서만 꺾임, 파임·덧댐 0). B83: 소맷부리 재단 40.08 / 봉제 32.07(= W) · 참고 산식 40.07 · 소매산 뒤 22.85 / 앞 21.47(Ⓐ 그대로) · 중심 20.02. 열린 질문: 접힌 겹이 조각 폭을 넘는 경우(절개 위치 < 턱 반) — 지금은 «모델 범위 밖»으로 막음(김님 2026-10-21: 미승인 보류 · 범위 차단 유지). 회귀 `designSleeveNCheck` 46 · `sleeveNUICheck` 48. [노트](book/P047.md)
- **소매 Ⓞ 턱트 슬리브(P.47 하단) — 화면 검토용 시안 구현·연결(2026-10-21, 미커밋¹ · 김님 답변·정정 반영).** 출발 = 소매길이 기본 20 의 Ⓐ · 평행 절개 4개(안쪽 = 중심 ±1.25 — 도해 «2.5» 는 가운데 띠 폭, 바깥 = ±3.75 — 지시선 판독) · 틈마다 2 평행 벌림(가운데 띠 고정 · 회전 없음) · 턱은 소매산·소맷부리 모두 바깥쪽(Ⓝ 과 반대 — 겹은 중심 쪽 조각 아래) · 소맷부리 박기 끝 1.5 · 소매산 박음 길이 미지정 · 접은 상태(Ⓐ) → 거울/평행 역변환(소맷부리 직선 · 소매산 턱 입구 = 접기로 정해진 낮은 산, 책 V 모양 흉내 안 냄). B83: 소매산 재단 52.79 / 봉제 44.32(= Ⓐ) · 이세 +2.11 · 소맷부리 40.07 / 32.07. 회귀 `designSleeveOCheck` 33 · `sleeveOUICheck` 37. [노트](book/P047.md)
- **변형 몸판에서 소매 Ⓐ(→ B–O) 연결 보완 — 2026-10-21, 미커밋¹(김님 새 목표 승인).** 사용자 실패: Safari 에서 몸판 Ⓖ(플레어, `bunka-bodice-G`) → 소매 Ⓞ «armhole-underarm-mismatch» (저장 진동 아랫점 앞 15.78 / 뒤 17.77 — 프리셋 스윕으로 Ⓖ 와 정확히 일치 확인). 원인: Ⓖ 는 앞 AH 다트를 «위쪽 고정·옆 조각 회전»으로 닫아(Ⓐ 판독 규약은 «아랫점 고정·위쪽 회전») **같은 봉제 진동이 다트 각 18.25° 만큼 돌아 놓였을 뿐**(현 16.383 · AH 동일 — 순수 배치)이고, 뒤 어깨 다트는 이미 Ⓐ 와 같은 규약으로 닫혀 있는데 남은 다리 자료 때문에 판독이 한 번 더 닫으려 했다(가드에 가려진 잠재 버그). 수정(`designSleeveA.readPiece` · 측정 복사본만, 몸판 geometry·공식 무변경): ① 앞 — 체인은 닫혔고 다리 입구가 떨어져 있으며 이음점이 아래 다리 입구면 다리 자료의 다트 각만큼 같은 BP 축으로 되돌림 + 검증(되돌린 아랫점 = BP 높이, 아니면 `armhole-placement-unverified`로 멈춤) ② 뒤 — 어깨 두 구간이 이미 이어졌고 다리 입구가 떨어져 있으면 다시 닫지 않음 ③ 가드 = 원형 등가 위치에서 앞뒤 아랫점 높이 비교(가드 삭제·평균·강제 정렬 없음). 결과: 기존 지원 18 몸판 Ⓐ 결과 **바이트 동일**(sha256 fixture) · Ⓖ 지원(어깨 높이 16.380/17.739 = 박시 16.380/17.740 · 소매 A–O 15개 적용·완료) · **Ⓗ = 원리 판단 필요로 멈춤**(진동 위 기준점 절개 — 되돌린 아랫점 19.31 ≠ BP 20.62) · Ⓜ·Ⓝ = 기존 미지원(허리 이음선이 진동 자체를 바꿈). 회귀 `sleeveBodiceVariantCheck` 17 + 기존 테스트의 «지원 밖 예시»를 Ⓖ→Ⓜ 로 이동.
  - **2026-10-27 Ⓗ·Ⓜ·Ⓝ 조사(코드 무변경 · 근거만)**: 각 진동 구간을 박시 Ⓐ 의 같은 루트 곡선에 호 길이 대응 강체 정합(잔차 ≤ 3e-4 — 전부 원형 조각의 강체 복사본).
    Ⓗ — 앞 아래 진동 31.00°(= Ⓖ 닫힘 18.25° + 추가 12.75°) · 뒤 위 0–11.43 은 −11.38°(Ⓖ 와 같음), 아래 11.42–21.59 는 −24.1°(추가 ≈ −12.7°, 절개점 = 뒤 진동 0.689) · AH 무변경 → 기록된 회전을 되돌리면 원형 축이 유일 복원(아랫점 = BP), 현행 봉제 진동 그대로면 아랫점 19.31 / BP 20.62.
    Ⓜ·Ⓝ — 앞 아래 진동(원형 0–8.75) −4.63° 회전(축 29.83, 14.81) · 뒤 아래(원형 13.18–21.59) +10.78°(축 16.77, 14.81) · 위쪽 무변경 · 회전으로 벌어진 진동 틈을 직선 0.121 / 0.219 가 메움 → AH 증가분(+0.121/+0.220)이 정확히 이 직선. 현행 아랫점 앞 21.145 / 뒤 21.688.
    **→ 2026-10-27 김님 확정·구현(미커밋¹)**: ① Ⓗ 는 «되돌린 원형 기준»으로 소매산 높이를 잰다(현행 변형 진동 높이 불채택) ② Ⓜ·Ⓝ 틈 메움 직선은 다트 입구로 보아 **봉제(소매 제도)용 AH 에서 제외**(저장 AH 는 표시 형상 길이로 그대로).
  - **원형 등가 측정 복사본**(`designSleeveA.blockEquivalentBodice` · 측정 복사본만, 몸판 geometry·armholeLengths·다트량·공식 무변경): Ⓗ = 완료본 `flareSlash[pc].slash`(pivot·angleDeg)로 아랫점~pivot 진동 조각(+옆선)만 pivot 축 역회전 → Ⓖ 상태 → 기존 판독(배치 정규화·가드)이 검증 · Ⓜ·Ⓝ = `waistSeam[pc].closedDart` 로 `-splice` 조각만 apex 축 역회전 · 틈 직선 = 끝점이 기록 T′·T 이고 길이가 기록 `armholeEaseCm` 인 진동 line 1개(정확 식별 — 짧은 직선 일반 차감 없음). 기록-형상 불일치면 `armhole-restore-unverified` 로 멈춤.
  - **완료본 기록 추가**(`bodiceCheckpoint.complete`): 절개가 있을 때만 `flareSlash`(geometry `flareCm` 복제) — 기존 관례(waistSeam·princess 메타)와 같음 · 다른 몸판은 키 없음(바이트 동일) · 형상 hash 미포함.
  - **봉제 AH 단일 권위** `designSleeveA.sewnArmholeLengths`(= 저장 AH − 틈 직선, 저장 AH 와 같은 소수 4자리): Ⓐ 제도·소매산 계측·이세·체크포인트(18곳)·주석·적용 15개·UI 이세 비교가 모두 이 값을 쓴다. Ⓐ meta.source 에 저장/봉제 AH 를 따로 기록 · Ⓐ 표시 줄 «원형 기준 측정 … 저장 AH → 봉제 AH».
  - 결과(B83): Ⓗ·Ⓜ·Ⓝ 어깨 높이 앞 16.380 / 뒤 17.739 = 박시 · 봉제 AH 앞 20.6269 / 뒤 21.5865(Ⓜ·Ⓝ 저장 20.7481 / 21.8057 − 틈 0.1212 / 0.2192) · 지원 22종 전부. Ⓠ 달림 끝 = 측정 복사본에서 호 길이로 재고 그 조각의 정변환으로 몸판 위치에 되돌림(22종 × 7비율 전부 표시).
  - 회귀: `sleeveBodiceVariantCheck` 47(§7 Ⓗ·Ⓜ·Ⓝ — 독립 복원·합동·높이·AH 독립 적분·틈 합·불변·hash·Ⓠ 독립 보행·A–Q 17개 완료·Ⓞ 물리·무효화·기록 불일치 멈춤) · `designSleeveQCheck` 38 · `sleeveQUICheck` 37(22 × 7 완료+표시). «지원 밖» 예시 테스트는 복원 기록을 뺀 완료본(합성)으로 교체.
  - **Ⓞ 접기 검증 수치 안정화(2026-10-28 김님 승인 · 미커밋¹)**: 원인 = 바깥 앞 조각 끝 표본이 평행 이동(+2g)·역이동(−2g) 부동소수 왕복으로 Ⓐ 소매산 끝 Uf.x 를 **1ulp(1.8e-15cm) 넘어** `yAtX` 가 NaN → `foldDev` NaN → «fold-mismatch(detail NaN)». 강체 불변식 위반이 아니라 **비교 정의역** 문제(박시 값 + AH 1e-7 에서도 재현 · 섭동 sweep 1944건 중 480건). 수정(`designSleeveO` 접기 검사만): 접은 점 편차 = max(정의역 밖 넘침 x, |끝점 y 차|) · 정의역 안 NaN 은 무한대로 실패. FOLD_TOL·검사·형상 무변경. 결과: 1944건 전부 성립 · 이전에 통과하던 1464건 결과 바이트 동일 · 박시 기본 Ⓞ sha256 동일 · 오류 주입(소매산 1e-5 들뜸·끝 1e-6 종이 밖·조각 곡선 1e-4·턱 겹 1e-4) 전부 차단. 회귀 `sleeveOFoldStabilityCheck` 12(재현값 · ±1e-8~1e-5 섭동 × 대칭/비대칭 × 기장 × 절개 위치·간격·벌림 864건 · 독립 물리 검산 · 22몸판). Ⓕ·Ⓝ 은 같은 섭동 36건에서 문제 없음(무변경).
  - **봉제 AH 소수 4자리 규약**은 «저장 AH 와 같은 측정 정밀도» 규약으로만 유지한다 — Ⓞ 실패 회피 수단이 아니다(Ⓞ 는 비반올림 Ⓜ 값 21.586459…/20.626926… 에서도 독립적으로 성립 — 위 회귀 §1).
- **소매 Ⓟ 반소매 플레어(P.48) — 화면 검토용 시안 구현·연결(2026-10-26, 미커밋¹ · 김님 기준 승인).** 출발 = 기장 기본 20 의 짧은 Ⓐ · ● = Ⓐ 소매 폭 W · ∅ = W × 플레어 계수(기본 0.7 — 수정 가능) · ⊠ = ∅/10 · 틈 1:2:4:2:1 자동 · 절개 5개(반폭 3등분 + 중심선) · 가운데 SP 대칭 쐐기 → 중간 → 바깥(운반된 기준점) · 소매산 꺾임 5곳 국소 재제도 · 소맷부리 전체 truing. B83: 소맷부리 54.56(산식 1.7W 54.51 · 편차 +0.05, 보정 없음) · 소매산 뒤 22.82 / 앞 21.44 · 이세 +2.05 · 바깥 누적 회전 40°. **뒤 안쪽 기준점(Pb1) 오목 꺾임 → 국소 S = 김님 검토 범위 승인(2026-10-26, 몸판 A · B83 · 기장 20 · 계수 0.7 의 화면 형상에 한정 — 다른 입력·소매의 오목/S 일반 허용 아님, 형상 무변경 · `concaveDents` 기록·가드 유지)**. 김님 기본 화면 확인 «이정도면 괜찮은거 같다». 멈춤: 45° 수치 가드(계수 ≥1 @ 기장 20 · 기장 15 @ 0.7). 회귀 `designSleevePCheck` 28 · `sleevePUICheck` 36. [노트](book/P048.md)
- **표시 마무리(2026-10-26, 표시 전용 · 미커밋¹)**: Ⓟ 화면 문구를 «국소 오목/S 굽이 실측 — 승인 범위는 P048 참조»로 중립화(진동 곡선이 브라우저 저장값에 따라 달라 검토 형상을 표시 계층에서 확실히 식별할 수 없으므로 승인·대기 단정 안 함). Ⓝ 가운데 턱 라벨을 «→ 턱 4.00 ←»로 줄이고(설명은 설명 블록), Ⓞ 의 턱 방향·소매산 박음 미지정 문장을 도안 위에서 설명 블록으로 옮김. 공용 충돌 상자 세로 ±1px(실제 글자 상자와 맞춤). 브라우저 13단계 줌 전체에서 Ⓛ·Ⓜ·Ⓝ·Ⓞ·Ⓟ 글자 겹침 0. geometry·계측·hash 불변.
~~~~
