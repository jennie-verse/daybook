# Daybook production verification

## 2026-09-01 Markdown session export

- Properties `date/time/status` 전용, AM/PM range, Focus 축약, Today 완료/취소선, reading/usage session 출력을 자동 fixture로 검증했습니다.
- 안전한 Preview에서 checkbox, 취소선, code, emphasis를 DOM API로만 렌더링하며 Source/Preview 전환 시 하나의 고정 export snapshot을 사용합니다.
- 로컬 브라우저에서 데스크톱 및 390×844 모바일 화면, Source/Preview 전환, 콘솔 error/warning 없음과 가로 잘림 없음을 확인했습니다.

검증일: 2026-08-17 (America/Chicago)

## 자동 검증

- Node tests: 9/9 통과
- JavaScript syntax: app, source registry, merge, day model, Markdown, IndexedDB store, sync, Service Worker 통과
- 주요 fixture: 한글, emoji, Markdown 특수 문자, backtick, HTML 문자 원문, 부분 실패, 캐시 상태

## 브라우저 검증

- iPhone 세로 390×844: 하단 By app / Timeline / Markdown, 가로 overflow 없음
- iPhone 가로 844×390: 하단 navigation 유지, 오른쪽 rail 숨김, 가로 overflow 없음
- iPad 세로 1024×768 및 가로 1366×1024: 문서 + sticky tool rail, 가로 overflow 없음
- Empty day, repository-not-connected, Daily note, Settings/source status 표시 확인
- Markdown Preview/Source 전환, Copy 성공 toast, Download 버튼 실행 확인
- 서버 중단 후 Service Worker shell과 Daily note 화면 재로딩 성공
- console warning/error: 0

내장 브라우저는 Blob 다운로드를 download event로 노출하지 않아 실제 수신 이벤트 감지는 제한되었습니다. 파일명과 다운로드에 사용하는 내용이 Copy와 동일한 serializer라는 점은 자동 테스트와 코드 경로로 검증했습니다.

## 디자인 비교

승인 시안과 비교한 기준점:

1. 단일 세로 문서와 얇은 divider
2. Soft Rose 색상 token과 Lexend
3. 날짜 이동, freshness, Today 구조
4. iPhone 하단 navigation과 iPad 고정 tool rail
5. Timeline disclosure와 Markdown Preview/Source
6. Empty/offline/partial banner 및 항상 사용 가능한 Daily note

iPhone 가로에서 rail이 노출되던 차이는 최종 CSS에서 수정했습니다.

---

# 2차 검토 — 배포 후 (2026-08-19, 캐시 `2026.08.19-1`)

배포본 `6344bdc` 를 실제 브라우저로 다시 검사했습니다. **결함 9건**을 찾아 고쳤습니다.

- 자동 테스트 **17개 전부 통과** (9 → +8)
- 브라우저 검사 4개 화면 크기 · **console warning/error 0건**

## 1. 고친 것

| # | 심각도 | 문제 |
|---|---|---|
| 1 | **사용 불가** | **iPhone에서 Settings에 들어갈 방법이 없음.** `.tool-rail` 이 800px 미만에서 `display:none` 인데 `#open-settings` 가 그 안에만 있었습니다. 토큰을 넣을 수 없으니 iPhone에서는 어떤 기록도 불러오지 못하고 "Connect your private repository in Settings" 안내만 영원히 표시됩니다 |
| 2 | 동기화 누락 | **화면에 없는 날짜의 메모는 영영 업로드되지 않음.** `flushNote()` 가 `state.date` 로만 호출되고 outbox를 훑는 코드가 없었습니다. 메모를 쓰고 4초 안에 날짜를 옮기거나 앱을 닫으면 그 메모는 기기에만 남고, 상태 표시는 계속 "waiting to sync" 입니다 |
| 3 | iOS 확대 | **`.field select{font-size:12px}`** — 12px 입력에 포커스가 가면 iOS가 화면 전체를 확대합니다. 자체 디자인 기준("Inputs and textareas remain at least 16px on iOS")과 공통 기준을 함께 어겼습니다. 숨겨진 파일 입력도 10px이었습니다 |
| 4 | 성능 | **글자 하나 칠 때마다 IndexedDB를 두 번 열고 닫음** (10자에 `open()` 20회). 메모와 outbox를 매 입력마다 쓰는데 연결을 재사용하지 않았습니다 |
| 5 | 접근성 | 44px 미만 터치 영역 — Refresh 38×32, rail today 34×34, rail 탭 39px, 소스 상태 40px, 가로 화면 하단 탭 42px, skip link 35px |
| 6 | 콘솔 경고 | CSP `frame-ancestors` 는 `<meta>` 로 전달되면 브라우저가 무시하고 **매 로드마다 경고**합니다. GitHub Pages는 응답 헤더를 넣을 수 없으므로 제거했습니다 |
| 7 | 기준 미준수 | Lexend를 내장하면서 **라이선스 파일을 동봉하지 않음** (`WebApp_House_Style.md` 3장) |
| 8 | 사소 | `localStorage` 의 `daybook.date` 를 검증 없이 신뢰 — 값이 깨지면 달력이 빈 채로 그려집니다 |
| 9 | 사소 | `.gitignore` 가 없어 `.DS_Store` 가 추적되지 않은 채 남음 |

## 2. 고치는 방법

- **1번**: `.freshness-row` 에 `#open-settings-compact` 를 추가하고, rail을 숨기는 **두 media query 모두**에서 노출합니다. 승인 시안의 iPhone 화면에도 Settings 진입점이 없었으므로, 이는 **의도적인 플랫폼 보완**으로 기록합니다
- **2번**: `flushOutbox()` 가 `listItems('outbox')` 전체를 돌도록 하고, 시작 시점과 온라인 복귀 시점에 호출합니다
- **4번**: `store.js` 가 연결 하나를 재사용하고 `onversionchange` 로 양보합니다 (10자에 `open()` **0회**)

## 3. 기록해 두는 차이

- **미니 캘린더 칸이 34×36px** 입니다. rail 폭이 약 250px이라 7열 격자에서 44px 폭은 기하학적으로 불가능합니다. 높이만 28 → 36px로 올렸습니다. 날짜 이동은 헤더의 ‹ › 와 날짜 버튼으로도 모두 가능합니다
- 승인 시안의 iPhone 화면에는 워드마크가 없고 날짜가 한 줄(`Sun, Aug 17 ⌄`)이며 섹션마다 `›` 펼침 표시가 있습니다. 구현은 워드마크 + 두 줄 날짜 + `Open` 링크입니다. **시각적 차이가 남아 있으며 이번 수정 범위 밖입니다**

## 4. 회귀 테스트 8개

phone에서의 Settings 도달 가능성 · 16px 미만 포커스 대상 없음 · 44px 터치 영역 · outbox 전체 flush · DB 연결 재사용 · 저장된 날짜 검증 · 폰트 라이선스 동봉 · 캐시 버전 갱신.

## 2026-08-26 Journal 8 완료 검증

- **Pass — 자동:** 8-source 새 activity, Full/Compact field matrix, stale/context status, visible 복귀 refresh, source별 cache fallback, Markdown 안전성 및 기존 note 회귀 검사.
- **Pass — 브라우저:** desktop·390×844에서 Settings 8-source, Compact 안내, 가로 overflow 0, console warning/error 0.
- **Pending — private E2E:** 실제 token으로 8개 source write → Daybook read → offline flush → redaction 확인은 사용자 credential 없이 실행하지 않음.
- **Pending — 실기기:** iPhone/iPad Home Screen별 token/context 저장소와 Service Worker update는 실제 Safari에서 최종 확인 필요.

## 2026-08-26 today 소스 등록 (A-1 선행 배포)

계획서: `Plan/webapp-benchmark/Productivity_App_Benchmark_Plan_2026-08-26.md` A-1. `shared → daybook → today` 순서 중 2단계. today 앱 자체는 이후 커밋에서 배포되며, 이 커밋은 daybook이 today의 Journal 기록을 읽고 표시할 준비만 갖춥니다.

### 바꾼 것

- `src/sources.js` — `SOURCE_APPS`에 아홉 번째 항목 `{ id: 'today', label: 'Today', icon: '◉', href: '../today/' }` 추가. By app/Timeline/Settings 소스 상태는 전부 `SOURCE_APPS`를 순회하는 기존 코드를 그대로 쓰므로 별도 화면 코드 변경 없음.
- `src/day-model.js` — `sourceSummary`·`recordMeta`·`recordBody`에 `today` 분기 추가 (task 개수·done 개수만 표시, 밀린 개수·연속기록은 표시하지 않음). `actionLabel`에 `promoted`/`deferred` 추가(additive).
- `src/markdown.js` — `today()` 섹션 함수 추가(`## Today` → `### Tasks` 체크박스 목록 + 하위 단계는 full 모드에서만, `### Changes made this day`), `serializeMarkdown`에서 loom 다음에 호출. `actionLabel`에 동일하게 `promoted`/`deferred` 추가.
- `tests/day-model.test.mjs` — 신규 파일. today summary/meta/body 3건.
- `tests/markdown.test.mjs` — today 섹션 fixture 1건(체크박스, 하위 단계 full/compact 차이).
- `tests/static.test.mjs` — "여덟 개" → "아홉 개" 소스 목록 갱신, 캐시 버전 정규식 갱신.
- `sw.js` — 캐시 버전 `2026.08.26-journal8-activity1` → `2026.08.26-today-source` (캐시하는 파일 이름은 그대로지만 `sources.js`/`day-model.js`/`markdown.js` 내용이 바뀌었으므로 버전을 올림).

### 통과

- [x] `npm test` — **26/26 통과** (기존 23건 + 신규 3건)
- [x] `npm run test:syntax` — 전체 통과
- [x] today에 아직 아무 기록이 없어도(`day.apps.today`가 없거나 빈 배열) By app/Timeline/Markdown 전부 오류 없이 렌더링 (옵셔널 체이닝으로 가드됨)
- [x] Journal은 `today` 앱이 `today`의 `task`/`task-activity` kind만 사용한다고 가정 — 이 커밋은 화면 표시만 하고 today 저장소를 직접 열지 않음(`central reader uses journal projections and no foreign app storage` 테스트로 고정)
- [x] 기존 8개 앱의 by-app/Timeline/Markdown 출력에 회귀 없음 (기존 23개 테스트 그대로 통과)
- [x] 콘솔 오류 0건, 절대경로·외부 URL 없음(기존 정적 검사 통과)

### Pending — 실기기 및 today 배포 이후

- [ ] today 앱 배포 완료 후, 실제 today 기기에서 Journal 기록을 올린 뒤 daybook의 By app/Timeline/Markdown 세 화면에서 실제로 보이는지 확인
- [ ] iPhone/iPad Home Screen에서 새 daybook Service Worker 캐시로 갱신되는지

## 2026-09-01 — Revision 4 후속 수정 (Review 2026-09-01 대응)

Revision 3 리뷰(`Plan/daybook_markdown-export-plan/Daybook_Markdown_Export_Review_2026-09-01.md`)에서
지적된 P1 실제 버그 1건(Today 완료 오판정)과 P2/P3 출력·품질 문제 다수를 고쳤습니다.

### 고친 문제

- **[P1 버그] Today 완료 오판정.** `data.done`/`data.finalStatus`가 있으면 그 값을 신뢰하도록 `today()`를 수정. 완료 후 재오픈한 할 일이 `actions`에 남은 `completed` 때문에 다시 `[x]`로 나오던 문제 해결.
- **[P2] Cove 근사 독서시간 추가.** `historyAccuracy: "approximate"` 세션은 `(~22m)`처럼 물결표를 붙이고, duration이 없는 external 기록은 `- 8:10 PM · 제목`으로 시각만 표시.
- **[P2] Focus의 Break 세션 제외.** `data.mode === 'break'`인 세션은 출력하지 않음. `mode`가 없는 구형 기록은 그대로 유지.
- **[P2] Petal 0%→0% 제거 및 간격 통일.** 진행률 두 값이 모두 유효할 때만 `· NN% → NN%`를 붙이고, 항목 간 빈 줄을 없애 Focus/Folio와 같은 간격으로 통일.
- **[P2] Tide 인용문 들여쓰기 + Compact 유지.** `  > 내용` 형태로 목록 항목에 묶고, Compact 모드에서도 본문을 유지(Full/Compact 차이는 Folio/Petal 긴 주석에만 적용).
- **[P2] front matter time의 특수 공백 제거.** `toLocaleTimeString` 대신 `clockParts()` 기반 `formatClockFromDate()`를 사용해 U+202F가 섞이지 않도록 수정.
- **[P2] 섹션 내부 정렬.** 각 섹션을 표시되는 시·분 오름차순으로 정렬(`sortedRecords()`), 동률은 원본 instant·record ID로 tie-break.
- **[P2] Loom 출력 복원 + 섹션 순서.** `block-activity`(Changes made this day)와 Subtitle/Note/Detail을 되살리고, 섹션 순서를 Focus → Today → Folio → Petal → Cove → Tide → Slate → Grove → Loom → Quill → Daily note로 정리.
- **[P3] Markdown escape 축소.** `mdText`의 escape 대상을 실제 Markdown 구문 문자(`\ \` * _ [ ] { } < > ~`)로 좁히고, Preview 렌더러가 남은 escape도 화면에서 원래 글자로 되돌리도록 `unescapeMd()` 추가.
- **[P3] `markdown.js` 가독성.** `today()`/`petal()`/`folio()` 등 한 줄에 여러 문장이 몰려 있던 부분을 동작 변경 없이 줄 단위로 재작성.

### 의도적으로 반영하지 않은 리뷰 제안

- 리뷰 항목 4(과거 날짜의 Folio/Cove/Slate/Grove 기록에 legacy `file-activity`/`board-activity`/`map-activity`/`link-activity` fallback 줄 추가)는 이번 작업 지시서 "E. 하지 말 것"에서 명시적으로 금지되어 반영하지 않았습니다. 새 세션 기록이 있는 날짜만 시간 줄이 나오며, 과거 기록 자체는 삭제하지 않고 화면·Markdown에만 보이지 않습니다.

### 새로 추가한 테스트

`tests/markdown.test.mjs`에 18건 추가: Today 완료 판정 2건(재오픈, finalStatus만 있는 경우), Cove exact/approximate/무기간 3종 1건, Focus break 제외 1건, Petal 0%→0% 생략 및 간격 2건, Tide 들여쓰기+Compact 유지 1건, front matter U+202F 부재 1건, 섹션 정렬 1건, Loom 복원+섹션 순서 1건, mdText escape 축소 1건. `tests/static.test.mjs`의 캐시 버전 정규식도 함께 갱신.

### 통과 — 자동

`npm test` **39/39 통과**(기존 21건 + 신규 18건), `npm run test:syntax` 통과.

### 통과 — 실제 브라우저 (2026-09-01, 이 세션에서 정적 서버 + Browser 도구)

`Published/`를 정적 서버로 띄우고 `/daybook/`을 열어 확인:

- [x] Markdown 탭 Preview/Source 전환 정상, front matter가 `date`/`time`/`status` 세 줄만 표시(`timezone`/`apps` 없음)
- [x] `time` 값에 일반 공백만 사용됨을 화면에서 확인
- [x] 데이터가 없는 날짜에서 오류 없이 "No records this day" 표시
- [ ] Pending — Service Worker 등록 시 이 세션의 로컬 프록시 환경에서 "An unknown error occurred when fetching the script" 콘솔 오류 1건 관찰됨. `navigator.serviceWorker.register()` 경로로, 코드 변경과 무관하게 이 브라우저 자동화 도구의 프록시 제약으로 보입니다. 실제 GitHub Pages(HTTPS) 환경에서 재확인 필요.

### 버전

- `sw.js` `VERSION`: `2026.09.01-markdown-session1` → `2026.09.01-export-fixes1`

### Pending — 실기기에서 확인 필요

- [ ] iPhone/iPad 세로·가로에서 Preview/Source 전환 시 겹침·잘림 없는지, 글자 크기 6단계 각각에서 레이아웃 유지되는지
- [ ] 실제 GitHub Pages(HTTPS)에서 Service Worker가 정상 등록되고 업데이트가 강제 새로고침 없이 적용되는지
- [ ] Cove의 근사 독서시간(`~`)이 실제 `Open in Safari` 사용 후 정상적으로 Daybook에 나타나는지

## 2026-09-02 — 전체 웹앱 하우스 스타일 점검 대응 (글자 크기 6단계, 삭제 확인, 보존된 충돌 UI)

전체 웹앱 일관성 점검에서 나온 daybook 항목들을 고쳤습니다. 새 기능 추가가 아니라 하우스 스타일 위반과
"만들어졌지만 연결되지 않은 UI"를 고친 작업입니다.

### 고친 문제

- **[하우스 스타일 위반] Text size가 6단계가 아니었음.** `<select id="text-size">`가 10/11/12/13/14/16px 6개 값을 썼는데, `WebApp_House_Style.md` 3장이 정하는 값은 6/8/10/12/14/17px입니다. 값을 교체하고, 옆에 `Reset` 버튼을 추가해 12px로 즉시 되돌릴 수 있게 했습니다. 버튼(`min-height:44px`, 고정 px)은 `--base-size`에 묶여 있지 않아 극단값(6px·17px)에서도 터치 영역이 줄지 않음을 확인했습니다.
- **[하우스 스타일 위반] 삭제·되돌리기에 확인이 없었음.** `Clear activity cache`와 `Restore backup`이 확인 없이 즉시 실행되던 문제. `confirm()`으로 확인 단계를 추가했습니다(다른 기기 목적으로 사용 중인 dialog 인프라가 daybook에는 아직 없어, 최소 변경으로 native confirm을 선택). Restore는 파일을 JSON으로 파싱한 뒤(형식이 틀리면 기존과 동일하게 실패 toast), 실제 병합(`restoreData`) 직전에 확인합니다.
- **[죽은 UI] `#conflict-dialog`가 한 번도 열리지 않음.** `src/sync.js`의 세 지점이 `preserveConflict()`로 밀린 메모 버전을 `noteConflicts`에 저장하고 있었지만, 그 값을 보여줄 방법이 없어 사용자가 영영 확인할 수 없는 상태였습니다. Settings → Local data에 `Preserved conflicts` 버튼을 추가해 날짜 역순으로 목록을 보여주고, 각 항목에서 `Copy`(클립보드) 또는 `Discard`(그 항목만 삭제)를 할 수 있게 했습니다. `store.js`는 이미 있던 `listItems`/`deleteItem` 범용 함수를 그대로 재사용했고 스키마 변경은 없습니다.

### 통과 — 자동

`npm test` **39/39 통과**(회귀 없음), `npm run test:syntax` 통과. `tests/static.test.mjs`의 캐시 버전 리터럴도 함께 갱신.

### 통과 — 실제 브라우저 (로컬 정적 서버)

- Settings에서 `text-size` 옵션이 정확히 `6/8/10/12/14/17`임을 확인.
- `Reset` 클릭 → `12`로 즉시 복귀 확인.
- `Save & refresh`로 6px·17px 각각 적용 → `--base-size`가 정확히 반영되고, 카드·버튼 레이아웃이 깨지지 않으며 버튼 높이가 두 극단 모두 `44px`로 고정됨을 확인(스크린샷).
- `Clear activity cache` 클릭 → `confirm()`이 정확한 문구로 뜨고, 취소하면(테스트에서 `false` 반환) 실제로 캐시가 지워지지 않음을 확인.
- IndexedDB에 가짜 `noteConflicts` 레코드를 넣고 `Preserved conflicts` 클릭 → 날짜·보존 시각·본문·Copy·Discard가 정상 표시. `Discard` 클릭 → 해당 레코드가 지워지고 "No preserved conflicts." 빈 상태로 정상 전환.
- 전 과정 콘솔 오류 **0건**.

### 버전

- `sw.js` `VERSION`: `2026.09.01-housestyle1` → `2026.09.02-a11y1`

### Pending — 실기기에서 확인 필요

- [ ] iPhone/iPad에서 6px·17px 극단값의 실제 가독성과 레이아웃
- [ ] 실제 sync 충돌 상황을 만들어(두 기기에서 같은 날짜를 동시에 편집) `Preserved conflicts`에 정상적으로 쌓이는지
- [ ] Loom 실기기 기록으로 block-activity/Subtitle/Note/Detail이 정상 표시되는지

## 2026-09-03 — tide → clip 소스 교체, today 종류별 표시

계획서: `Plan/today_brain-dump-plan/Today_Brain_Dump_Plan_2026-09-03.md` §7.

### 변경

- `src/sources.js`: `SOURCE_APPS`의 `{ id:'tide', label:'Tide', icon:'≈', href:'../tide/' }`를 `{ id:'clip', label:'Clip', icon:'⧉', href:'../clip/' }`로 교체. 다른 앱 글리프와 겹치지 않음을 육안 확인.
- `src/day-model.js`: `sourceSummary`/`recordMeta`/`recordBody`의 `app === 'tide'` 분기에 `app === 'clip'`을 함께 매칭하도록 추가(레코드가 어떤 이름으로 오든 동일하게 표시). webapp-data의 `journal/activity/tide/`·`journal/status/tide/`는 이번 today §6 이전 단계에서 이미 삭제됐고, `SOURCE_APPS`가 `clip`만 가져오므로 실제로는 `clip` 경로만 쓰입니다.
- `src/markdown.js`: `tide()` 함수를 `clip()`으로 이름 변경, 제목을 `## Tide` → `## Clip`으로, `day.apps?.clip`을 읽도록 변경. `dump` kind 렌더러는 지난 캐시 기록(있다면)을 위해 그대로 남겨뒀지만 journal에 더 이상 dump 레코드가 없어 사실상 죽은 분기입니다.
- `src/markdown.js`의 `today()`: 각 항목의 `data.type`(task/note/event)을 읽어 Note는 `— 내용`, Event는 예정 시각(`HH:MM 내용`), Task 또는 `type` 없는 옛 기록은 기존 체크박스(`[x]`/`[ ] ~~내용~~`)로 표시.
- docs 3종(README-KO, USER-GUIDE-KO, 이 파일) 갱신 — Tide 언급을 Clip으로 교체, Today 종류별 표시 규칙 추가.
- 테스트 파일(`tests/markdown.test.mjs`, `tests/merge.test.mjs`, `tests/static.test.mjs`)의 픽스처를 `tide` → `clip`으로 갱신하고, Today 종류별 표시를 검증하는 신규 테스트 1건 추가.
- `sw.js`/`src/version.js`를 `2026.09.03-clip1`로 동기화.

### 통과

- [x] `npm test` — **44/44 통과** (기존 43건 + 신규 1건)
- [x] `npm run test:syntax` 통과
- [x] 콘솔 오류 0건 (정적 검사 기준 — 실기기 라이브 확인은 Pending)

### Pending — 사용자 확인 필요

- [ ] 실제 clip 항목이 Daybook By app/Markdown 화면에 정상 표시되는지 (Clip 앱에서 Include in journal을 켠 뒤 새 항목을 만들어 확인)
- [ ] today의 Note/Event가 실제로 Daybook Markdown에서 `—`/시각으로 구분되어 보이는지

## 2026-09-03 — loom 소스 제거 (loom deprecate)

사용자가 `loom`을 `Deprecated/`로 옮기고 GitHub 저장소를 archive하기로 결정. Daybook이 `loom`을 활성 소스로
계속 폴링·연결 안내(Open Journal settings 링크)하면 이미 정지된 앱을 계속 가리키게 되므로, tide→clip 때와
같은 패턴(활성 소스 목록에서만 제거, 과거 기록 렌더링은 유지)으로 정리.

### 변경

- `src/sources.js`: `SOURCE_APPS`에서 `{ id:'loom', label:'Loom', icon:'▦', href:'../loom/' }` 항목을 삭제(9개로 축소). 이 배열은 `sync.js`가 실제로 폴링하는 앱 목록이기도 해서, 제거하는 순간 loom에 대한 새 요청 자체가 나가지 않습니다.
- `src/day-model.js`/`src/markdown.js`의 `app === 'loom'` 렌더링 분기는 **그대로 유지**(tide 전례와 동일) — 이미 Daybook에 저장된 과거 Loom 기록은 계속 정상 표시됩니다. 새 Loom 기록만 더 이상 들어오지 않습니다.
- `index.html`의 `#source-summary` 기본 텍스트를 `10 sources` → `9 sources`로 수정.
- `tests/static.test.mjs`: "only the ten approved sources" 테스트를 아홉 개 목록(loom 제외)으로 갱신하고, `loom`을 제외 목록(`vault`/`trace`/`atlas`/`shared`)에 추가. `9 sources` 텍스트 검증도 갱신.
- `sw.js`/`src/version.js`를 `2026.09.03-loomoff1`로 동기화.

### 통과

- [x] `npm test` — **44/44 통과** (테스트 개수는 그대로 — 기존 테스트 내용만 9개 목록에 맞게 갱신)
- [x] `npm run test:syntax` 통과
- [x] `curl`로 배포 정적 서버에서 `src/sources.js`를 직접 받아 `loom` 문자열이 전혀 없고 9개 항목만 있는지 확인

### 참고 — loom 자체의 상태

`loom` 앱은 `Published/loom` → `Deprecated/loom`으로 이동(git 히스토리 보존), `jennie-verse/loom` GitHub 저장소는
삭제가 아니라 **archive**(읽은 전용, GitHub Pages 사이트는 그대로 유지, 필요하면 나중에 unarchive 가능)로
전환했습니다. `Backup/loom`도 이동 전 `Published/loom`의 최종 상태로 다시 동기화해 그대로 남겨뒀습니다.
- [ ] 아이콘 글리프(⧉)가 다른 소스 아이콘과 실기기 화면에서 시각적으로 헷갈리지 않는지
