# Daybook 테스트 리포트 — 2026-09-05 첫 릴리즈

버전 `2026.09.05-initial`, 첫 릴리즈 배포 시점의 검증 결과입니다.

## 자동 테스트

- `npm test` — **47개 전부 통과**, 실패/취소/skip 없음
- 주요 커버리지: Cove 연동(하이라이트/노트 분리), 타임라인 정렬, PWA 셸/아이콘 구성, 승인된 9개 소스 registry, 중앙 reader의 journal projection 격리, Service Worker precache(shared v1 미접촉 확인 포함), 토큰이 Markdown/backup/note envelope에 노출되지 않는지, Settings 모바일 접근성(tool rail 숨김 시), 포커스 요소 16px 이상·터치 타깃 44px 이상, 노트 flush가 화면 밖 날짜도 포함하는지, IndexedDB 연결 재사용, 저장된 날짜 값 검증, 폰트 라이선스 동봉, 캐시 버전-파일 동기화, 계정 이동 시 커스텀 도메인 동기화 실패 보고, Preview의 `[-]` 취소 checkbox 인식

## Fresh-start 데이터 리셋

- 이번 릴리즈부터 daybook 자체 키(Preview 캐시, 로컬 UI 상태 등)만 초기화되는 fresh-start 리셋이 추가되었습니다.
- `sync.token.v1`과 `shared/v1`은 건드리지 않습니다 — 기존에 연결된 개인 저장소 토큰과 공유 저널 데이터는 그대로 유지됩니다.
- 리셋은 daybook 전용 로컬 상태에만 적용되며, 다른 앱(Cove 등)이나 공유 스토리지에는 영향이 없습니다.

## 확인된 것

- 자동 테스트 스위트 47/47 통과
- 코드 경로상 토큰 비노출, shared/v1 미접촉, fresh-start가 daybook 키로 한정됨을 테스트로 확인

## Pending — 실기기에서 직접 확인 필요

- [ ] iPhone 실기기: 세로/가로 레이아웃, 하단 navigation, Settings 진입, 터치 타깃
- [ ] iPad 실기기: 세로/가로 레이아웃, sticky tool rail
- [ ] 실제 private GitHub Journal 저장소에 실제 토큰으로 읽기/쓰기 (Settings에서 토큰 입력 → 노트 작성 → 동기화 → 다른 기기에서 반영 확인)
- [ ] 이미 홈 화면에 설치된 아이콘에서 Service Worker 업데이트가 정상적으로 반영되는지 (캐시 버전이 올라간 뒤 재실행 시 새 셸로 교체되는지)

검증일: 2026-09-05


## 2026-09-08 안정성 개선 검증

- 수정: 날짜 전환·새로고침 중 메모 보존, 로컬 메모 우선 로딩, 새 편집의 동기화 대기열 보존, 원자적 백업 복원.
- 로컬 회귀 검사 및 JavaScript 문법 검사: 통과.
- Chromium 1280×900 / 390×844: 주요 조작, 재시작 후 기존 데이터 보존, 화면·페이지 오류 검사 통과.
- Service Worker를 통한 오프라인 앱 재실행: 통과.
- 실제 iPhone/iPad Safari, iCloud 공유, 실제 비공개 GitHub 데이터 동기화: 실기기 확인 필요.


## 2026-09-08 추가 안정성 검토 (review2)

- 변경: 느린 업로드 도중 들어온 다음 동기화 요청을 기억하고, 업로드가 끝난 직후 대기 노트를 다시 전송.
- 검증: 전체 기존 테스트 및 추가 회귀 테스트, JavaScript 구문 검사. 격리된 Chromium에서 데스크톱 1280×900/모바일 390×844 저장·새로고침·실패 복구 검증. Browser plugin not available; bundled Playwright 사용.
- 주입 검증: 지연 Promise로 느린 업로드와 후속 요청 재현.
- 한계: 실제 iPhone Safari/Home Screen 및 개인 계정의 실서버 동기화는 직접 시험하지 않음.


## 2026-09-08 통합 시간순 Markdown

빌드 `2026.09.08-chronology1`. Browser plugin not available; macOS bundled Playwright Chromium, 로컬 정적 서버와 격리 프로필.

- Node 테스트 65개 및 전체 JS 문법 검사 통과.
- Timeline/Markdown 동일 시간 모델: 앱 간 정렬, 양쪽 AM/PM, 빈 제목, 실제 사용 시작과 업로드 시각 구별, Task projection 중복 방지, 일별 조작 요약, 시각 불명, Focus 휴식, 자정 횡단·DST GMT 오프셋 검사.
- 실제 Today 모델과 가상 원격 API: SHA 재다운로드 생략, 동시 수정 보존/해결, 깨진 파일 캐시 보존, 시작 날짜 이동, 삭제 후 오프라인에서 되살아나지 않음.
- 새 브라우저에서 Daybook만 열었을 때 today-db를 생성하지 않음 확인.
- Today에서 시작만 입력→Daybook Chronological Source 표시→Today 종료 추가→Daybook 자동 반영→실제 .md 다운로드 내용 확인→By app 전환.
- 390×844 / 844×390 / 820×1180 / 1180×820, 글자 크기 6·8·10·12·14·17 검사에서 페이지 가로 넘침 없음. 모바일/태블릿 스크린샷 확인.
- Service Worker 활성화 후 오프라인 재실행에서 통합 Markdown과 Daily note 보존. 검사한 흐름의 페이지 오류 없음.

명령: `npm test`, `npm run test:syntax`; 별도 Playwright 스크립트 `/tmp/daybook-chronology.cjs`, `/tmp/daybook-reader.cjs`. 테스트 원격은 가상 API이며 사용자 토큰·데이터를 사용하지 않았다. 실제 iPhone/iPad Safari 및 실계정 비공개 Sync는 미검증. 배포 결과와 변경 파일 전체 목록은 작업 공간 Plan/daybook_chronology-plan/Release_Report.md에 기록한다.

## 2026-09-08 일관성·사용성 재검토

빌드 `2026.09.08-consistency1`.

- 6단계 글자 크기가 기록·Timeline·Markdown에도 적용되며 입력창·선택창·파일 선택창은 iOS 확대를 막기 위해 16px을 유지한다. 달력·앱 링크·상세보기 등 조작 대상은 44px 기준을 만족하도록 정리했다.
- Chronological / By app과 Preview / Source의 선택 상태를 접근성 속성으로 표시한다. 클립보드 접근이 막히면 Markdown을 선택할 수 있는 대체 창을 연다.
- Node 테스트 65개와 JavaScript 문법 검사 통과. 격리 Chromium에서 Today 종료 시각 수정의 즉시 반영, Markdown 다운로드, 6단계 글자 크기·4개 화면 크기, 복사 대체 창, Service Worker 오프라인 재실행을 확인했다. 페이지 오류는 없었다.
- Browser plugin not available; bundled Playwright Chromium을 사용했다. 실제 iPhone/iPad Safari 및 실계정 비공개 Sync는 미검증이다.

## 2026-09-08 검토 반영 (reviewfix)

빌드 `2026.09.08-reviewfix1`. 다중 에이전트 코드 검토에서 확인된 항목을 수정했다.

- **BroadcastChannel**: 같은 브라우저의 Today Timeline 편집 알림을 받았을 때 토큰 없는 Journal 재조회를 돌리지 않고, 새 `refreshTimeline()`으로 Today Timeline만 다시 읽어 Journal 하루와 상태를 유지한다. 토큰이 있는 사용자에게 "모든 소스 실패" 배너가 잘못 뜨거나 캐시가 오염되던 문제를 해결했다. 진행 중인 원격 새로고침을 취소하지 않도록 타이머를 분리했다.
- **배너**: 동시에 발생한 부분 실패(소스 실패·파일 읽기 실패·Timeline 실패)를 함께 표시한다. Timeline 오류를 `day.diagnostics`에 중복 복사하지 않는다.
- **시간대 오프셋**: `Intl` `timeZoneName: 'shortOffset'` 지원을 감지하고, 미지원 환경(iOS 16.4 미만)에서는 오프셋을 산술로 계산해 Timeline과 기본 Chronological Markdown이 계속 동작한다(GMT±H[:MM] 형식 일치 확인).
- **Markdown**: Timeline 읽기가 부분 실패면 front matter `status`를 `partial`로 표기한다. By app 레이아웃의 Today 활동 소절 제목을 고아 `### ` 대신 `## Today activities`(H2)로 낸다.
- **로컬 읽기**: `readLocalTimeline`의 `onsuccess` 본문을 try/catch로 감싸 향후 Today 스키마에서 store가 사라져도 promise가 멈추지 않는다. `collectTimeline`은 캐시 읽기 실패도 견딘다.
- **CSS**: 말미에 덧붙은 규칙이 모바일 `.markdown-output` 축소를 덮어쓰던 것을 제거했다. 800–1039px 태블릿에서 본문 폭을 760px로 제한한다.
- Node 테스트 65개와 JavaScript 문법 검사 통과. 격리 Chromium에서 Timeline/Markdown 두 레이아웃, `shortOffset` 미지원 폴백, `refreshTimeline`이 `failures`/`diagnostics`를 보존함을 확인했다. 공개 배포 후 두 화면과 오프라인 동작에 페이지 오류 없음. 실제 iPhone/iPad Safari와 실계정 비공개 Sync는 미검증.

## 2026-09-08 컨트롤 크기 정리 (reviewfix2)

빌드 `2026.09.08-reviewfix2`. 같은 피드백에 따라 `consistency1`의 전역 `button{min-height:44px}`와 개별 44px 강제를 걷어내고, 작은 시각 상자 + 투명 `::after` 44px 탭 영역으로 통일했다.

- 전역 `button` 최소 높이 30px + `::after` 탭 영역. bottom-nav·rail-tabs·source-status는 전체 상자 유지.
- Preview/Source·Chronological/By app 세그먼트 26px, Markdown/기본 액션 32px, 아이콘 버튼 36px, Today pill 34px, 달력 칸 34px, 소스 링크·상세보기 요약은 글자 크기까지 축소.
- 헤더 화살표 그리드 폭 36px. 입력·선택창은 16px 유지(iOS 확대 방지).
- `elementFromPoint`로 세그먼트·레이아웃 토글·아이콘 버튼 44px 탭 영역 확인. 6단계 글자 크기(6·8·17px)×By app/Timeline/Markdown에서 가로 넘침 없음. 자동 테스트 65개 통과. 공개 배포본 CSS 해시 로컬 일치, Timeline·Markdown 화면 콘솔 오류 0.
