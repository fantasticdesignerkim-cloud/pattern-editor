# sandbox — 계약 밖에서 자유롭게 시험하는 곳

> **왜 있나**: 본체는 완료본 hash·shape 골든·frozen 계약이 겹겹이라, 작은 시도 하나도
> 무겁다. 여기는 그 전부가 **없는** 곳이다. 되는지 먼저 보고, 쓸 만하면 그때 승격한다.

## 여는 법

```bash
python3 -m http.server 8420
```

→ **`http://127.0.0.1:8420/sandbox.html`**

★ **반드시 `127.0.0.1:8420`** — `localhost:8420` 과 **다른 origin** 이라 사용자 저장 데이터가
격리된다(CLAUDE.md 안전 계약). 열자마자 `SB.storageKeys()` 가 **0** 인지 확인한다.

## 구조

| 파일 | 역할 |
|---|---|
| `sandbox.html`(루트) | 실험 페이지. 본체와 **같은 `js/` 를 같은 캐시 버전으로** 로드 + 하단 실험 바 |
| `sandbox/boot.js` | `SB.*` — «원형 생성 → 완료 → 디자인 → 몸판·소매·카라 완료» 체인을 한 줄로 |
| `sandbox/scratch.js` | **여기만 고친다.** `SBX.add("이름", async () => {...})` 로 버튼 등록 |

`index.html` 은 이 셋을 **모른다** — sandbox 를 아무리 부숴도 본체는 그대로다.

★ **`sandbox.html` 은 루트에 둔다.** `js/testSeed.js` 의 `./armhole_data_….json` 처럼
**문서 기준 상대경로**를 쓰는 코드가 있어서, 하위 폴더에 두면 그것만 404 로 갈라진다
(실제로 한 번 그렇게 만들었다가 옮겼다). 루트에 두면 픽스처·저장 경로가 본체와 완전히 같아
**"sandbox 에선 되는데 본체에선 안 되는"** 함정이 생기지 않는다.

## 규칙 (넷뿐)

1. **`js/` 를 읽기만 한다.** sandbox 에서 `js/` 의 함수를 덮어쓰거나 patch 하지 않는다.
   그러면 "sandbox 에선 되는데 본체에선 안 되는" 거짓 성공이 생긴다.
2. **저장을 부르지 않는다.** `saveCurveData`/`autoSaveCurveData`/`import*` 금지.
   격리 origin 에서만 열고, 끝나고 `SB.storageKeys()` 가 0 인지 본다.
3. **골든·하네스·체크포인트를 요구하지 않는다.** 여기 있는 코드는 검증 대상이 아니다.
4. **sandbox 코드를 본체가 참조하지 않는다.** 의존은 항상 `sandbox/ → js/` 한 방향.

## `SB` 로 할 수 있는 것

```js
await SB.toDesign()                              // 디자인 시작까지
await SB.toBodice({ bustEaseCm: 8 })             // 몸판 적용 + 완료까지
await SB.toCollar()                              // 카라 완료까지
await SB.all()                                   // Design 형상 완료까지
await SB.applyBody({ waistSideOffsetCm: -3 })    // 몸판 파라미터만
await SB.line("shaped-line", "bunka-bodice-D")   // 몸판 라인 프리셋(P.14–35)
SB.girth()   // 가슴·허리 완성 둘레와 여유
SB.darts()   // 허리 다트별 폭
SB.p         // 현재 designProject
```

`SB` 는 **새 계산을 하지 않는다** — 기존 공개 함수·버튼을 순서대로 부를 뿐이다. 그래서
sandbox 에서 본 수치는 본체에서 손으로 클릭한 결과와 같다.

## 승격 (sandbox → 본체)

실사용으로 쓸 만하다고 **확인된 뒤에만** 올린다. 순서는 본체와 같다:

1. **계획 보고 → 승인** (CLAUDE.md 워크플로)
2. 순수 로직을 `js/` 모듈로 옮긴다(실패 계약·입력 불변 명시)
3. `test/harness/` 회귀 스위트를 붙이고 `runAll` 통과 · **shape/perf 골든 diff 0**
4. UI 연결은 **별도 커밋**(엔진·UI 안 섞는다)
5. 격리 origin 실브라우저 검증 · `index.html` 캐시 버전 갱신
6. 결과를 `docs/history/` 에 기록하고 `docs/STATUS.md` 를 갱신한다

**승격하지 않은 실험은 sandbox 에 남겨 둬도 된다** — 본체 위험이 0 이므로 지울 이유가 없다.
다만 왜 승격 안 했는지 한 줄은 `scratch.js` 주석에 남긴다.
