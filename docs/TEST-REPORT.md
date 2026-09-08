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
