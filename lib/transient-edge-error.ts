/**
 * iPhone Safari is the primary client.
 * When fetch to Edge weekly-plan drops, Safari throws TypeError "Load failed"
 * (Chrome: "Failed to fetch"). That is not a product error — the server job
 * may still be running. Treat it like a tick timeout and resume via job_status.
 */

export function isTransientEdgeError(err: unknown): boolean {
  const name = err && typeof err === "object" && "name" in err ? String((err as { name?: unknown }).name) : "";
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (name === "AbortError" || name === "TimeoutError") return true;
  if (/초 안에 끝나지 않았습니다/.test(msg)) return true;
  if (/Load failed/i.test(msg)) return true;
  if (/Failed to fetch/i.test(msg)) return true;
  if (/NetworkError/i.test(msg)) return true;
  if (/The network connection was lost/i.test(msg)) return true;
  if (/네트워크 연결이 끊/.test(msg)) return true;
  if (/사파리에서 연결이 잠깐 끊/.test(msg)) return true;
  return false;
}

/** Never show Safari's English "Load failed" in the red box. */
export function koreanEdgeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (/초 안에 끝나지 않았습니다/.test(msg)) return msg;
  if (/작업이 너무 깁니다/.test(msg)) return msg;
  if (isTransientEdgeError(err) || /Load failed|Failed to fetch|NetworkError/i.test(msg)) {
    return "아이폰 사파리에서 연결이 잠깐 끊겼습니다. 서버 작업은 이어집니다. 화면을 새로고침하면 이어서 볼 수 있습니다.";
  }
  return msg || "요청에 실패했습니다.";
}
