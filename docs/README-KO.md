# Daybook

Daybook은 Tide, Focus, Loom, Petal, Folio, Quill, Slate, Grove가 private `webapp-data` 저장소의 `journal/` 아래에 기록한 날짜별 투영본을 읽는 오프라인 우선 PWA입니다.

- 라이브 URL: <https://jennie-verse.github.io/daybook/>
- source 앱의 IndexedDB를 직접 읽지 않습니다.
- Vault, Trace, Atlas, Shared 및 기존 `events/` 데이터는 활동 원본으로 사용하지 않습니다.
- Daily note는 기기에 즉시 저장되고, 연결되어 있으면 4초 뒤 private 저장소에 동기화됩니다.

## 시작

1. 각 source 앱 Settings에서 **Include in journal**을 켭니다. 기본값은 꺼짐입니다.
2. 필요할 때 각 source 앱에서 **Add existing history**를 직접 실행합니다.
3. Daybook Settings에서 GitHub token 연결 상태와 source status를 확인합니다.
4. 날짜를 선택하고 By app, Timeline, Markdown을 사용합니다.

Token은 `sync.token.v1` 로컬 키에만 보관되며 Markdown, 백업, 캐시, 로그에 포함되지 않습니다.
