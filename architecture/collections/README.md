# Collections에 올릴 이론 파일

Agent승이 이론 선택 때만 검색한다. Writer에게 주지 않는다.

| 파일 | Collection 용도 | 시크릿 |
| --- | --- | --- |
| `viral-theories.md` | 시드에 이미 있는 힘 알아보기 | `XAI_VIRAL_THEORY_COLLECTION_ID` |
| `writing-theories.md` | 설계 결론을 뽑을 때 | `XAI_WRITING_THEORY_COLLECTION_ID` |

같은 Collection에 두 파일을 넣어도 된다. 그때는 두 시크릿에 같은 ID.

업로드: xAI Console Collections, 또는 Management API. 검색은 `POST https://api.x.ai/v1/documents/search` (hybrid, limit 3). Grok `collections_search` 도구는 쓰지 않는다.

상의가 끝난 이론만 파일에 붙인다. 작성 이론은 아직 학습 전이다. 바이럴·작성 카드를 모두 모은 뒤에 최종 조합한다. 카드 하나 넣을 때마다 작성 형식과 섞지 마라.
