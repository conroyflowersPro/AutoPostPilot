# Reply Context Scope v6.2.1

## Change
Default Manual Reply X fetch is **TARGET ONLY**.

- TARGET_POST_ONLY / TARGET_REPLY_ONLY
- other_reply_fetch_count === 0
- conversation_pagination_count === 0
- No automatic parent/root body fetch
- No reply tree / top replies / popular replies

## Explicit optional actions
- 원문 읽기 → READ_ROOT_POST
- 부모 댓글 읽기 → READ_PARENT_POST
- 다른 반응도 분석 (10/20/50, no pagination) → READ_OTHER_REACTIONS

## Endpoint
Default: `GET https://api.x.com/2/tweets?ids={id}&expansions=author_id`
No `referenced_tweets` expansion on basic path (avoids pulling parent objects).

Other reactions: `GET https://api.x.com/2/tweets/search/recent?query=conversation_id:{id}&max_results={n}` once — no next_token loop.
