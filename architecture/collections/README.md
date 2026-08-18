# Collections에 올릴 이론 파일

두 파일을 **다른 Collection**에 올린다. 한 덩어리로 합치면 “힘이 있는가”와 “어떻게 닫는가”가 한 검색에 섞인다. Writer에게 주지 않는다. Grok `collections_search` 도구는 쓰지 않는다.

| 파일 | Collection | 부를 때 | 시크릿 |
| --- | --- | --- | --- |
| `viral-theories.md` (V1–V8) | 힘 알아보기 | 작업 순서 3 (같은 1회 검색) | `XAI_VIRAL_THEORY_COLLECTION_ID` |
| `writing-theories.md` (W1–W8) | 닫기 형식 | 작업 순서 3 (같은 1회 검색) | `XAI_WRITING_THEORY_COLLECTION_ID` |

**올리지 않음:** 단순 노출(배정). Agent승 오더 5번에 고정한다.

검색: `POST https://api.x.ai/v1/documents/search` (hybrid). **기본 1회**, `collection_ids`에 둘 다. 쿼리는 시드 장면·사실만. 카드 이름·V/W 번호 금지. 모델에 넣기 전 제목·영문 이론명 제거. 칸당 힘 ≤2, 형식 ≤2. 시크릿 비면 스킵하고 힘 창조 금지.

업로드: xAI Console. **청크 경계는 `## Vn` / `## Wn`**. 콘솔이 헤딩 단위로 안 자르면 카드마다 나눠 올린다. 전 이론을 한 프롬프트에 넣지 마라.

최종 조합은 시드 하나 실험에서 한다. 카드 파일끼리 미리 섞지 마라.
