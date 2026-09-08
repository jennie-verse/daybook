# Daybook

Daybook은 Clip, Focus, Petal, Folio, Quill, Slate, Grove, Today, Cove가 private `webapp-data` 저장소의 `journal/` 아래에 기록한 날짜별 투영본을 읽는 오프라인 우선 PWA입니다.

- 라이브 URL: <https://jennie-verse.github.io/daybook/>
- 일반 앱 기록은 Journal을 읽습니다. Today Timeline은 예외로 같은 브라우저의 IndexedDB를 읽기 전용으로 참조하고, 다른 기기 기록은 Today Sync 파일을 읽습니다.
- Vault, Trace, Atlas, Shared 및 기존 `events/` 데이터는 활동 원본으로 사용하지 않습니다.
- Daily note는 기기에 즉시 저장되고, 연결되어 있으면 4초 뒤 private 저장소에 동기화됩니다.

## 시작

1. 각 source 앱 Settings에서 **Include in journal**을 켭니다. 기본값은 꺼짐입니다.
2. 필요할 때 각 source 앱에서 **Add existing history**를 직접 실행합니다.
3. Daybook Settings에서 GitHub token 연결 상태와 source status를 확인합니다.
4. 날짜를 선택하고 By app, Timeline, Markdown을 사용합니다.

Token은 `sync.token.v1` 로컬 키에만 보관되며 Markdown, 백업, 캐시, 로그에 포함되지 않습니다.


## 시간순 통합 (2026.09.08-chronology1)

Markdown 기본 출력은 **Chronological**입니다. Today 직접 활동과 Journal의 앱 사용 기록을 같은 시각 기준으로 정렬합니다. **By app**을 고르면 기존 앱별 출력으로 전환합니다. Timeline 화면도 같은 `src/chronology.js` 모델을 사용합니다.

`src/today-timeline.js`는 Today 원본을 수정하지 않는 어댑터입니다. 전체 생성 월의 파일을 발견하고 SHA로 캐시하며 Today `timeline-model.js` / `timeline-time.js` 계약으로 검증·병합합니다. 이 두 모듈은 같은 계정의 Today 배포에 있어야 하며 선택적으로 오프라인 캐시합니다. Today 또는 Shared의 재배포는 이번 변경에 필요하지 않습니다.

Daybook의 `sourceFiles`에 저장한 Timeline 캐시에는 삭제 표식과 충돌 버전이 포함됩니다. 캐시 지우기는 날짜 캐시와 이 파일 캐시를 함께 지우며 Today 원본이나 Daily note에는 영향을 주지 않습니다. Daybook JSON 백업은 기존대로 Daily note와 표시 설정을 담습니다. Timeline 원본 백업은 Today의 Export JSON을 사용합니다.
