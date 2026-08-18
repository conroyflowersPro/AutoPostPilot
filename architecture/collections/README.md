# Collections에 올릴 이론 파일

두 파일을 **다른 Collection**에 올린다. 한 덩어리로 합치면 “힘이 있는가”와 “어떻게 닫는가”가 한 검색에 섞인다. Writer에게 주지 않는다. Grok `collections_search` 도구는 쓰지 않는다.

| 파일 | Collection | 부를 때 | 시크릿 |
| --- | --- | --- | --- |
| `viral-theories.md` (V1–V8) | 힘 알아보기 | 작업 순서 3 | `XAI_VIRAL_THEORY_COLLECTION_ID` |
| `writing-theories.md` (W1–W8) | 닫기 형식 | 작업 순서 4 | `XAI_WRITING_THEORY_COLLECTION_ID` |

**올리지 않음:** 단순 노출(배정). Agent승 오더 6번에 고정한다. 매 포스트 검색 대상이 아니다.

검색: `POST https://api.x.ai/v1/documents/search` (hybrid, limit 3). 칸마다 각각 짧게, 또는 배치에 한 번 후 칸마다 적용. 전 이론을 한 프롬프트에 넣지 마라.

업로드: xAI Console Collections, 또는 Management API. 시크릿이 비면 그 Collection 검색은 건너뛴다.

최종 조합(이 시드에서 힘 A + 형식 B)은 업로드·오더 고정 뒤, 시드 하나 실험에서 한다. 카드 파일끼리 미리 섞지 마라.
