/** Fedica publishing helpers — media + post scheduling */

export type FedicaAccount = {
  Platform?: string;
  AccountId?: string;
  [key: string]: unknown;
};

const BASE = "https://fedica.com/api/publish";

function token(): string {
  const t = process.env.FEDICA_API_TOKEN || process.env.FEDICA_TOKEN || "";
  if (!t) throw new Error("FEDICA_API_TOKEN not configured");
  return t;
}

export async function fedicaFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${token()}`);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text.slice(0, 500) };
  }
  if (!res.ok) {
    const msg = data?.message || data?.error || text.slice(0, 200) || res.statusText;
    throw new Error(`Fedica ${res.status}: ${msg}`);
  }
  return data;
}

export async function listAccounts() {
  return fedicaFetch("/accounts");
}

export async function listPipelines() {
  return fedicaFetch("/pipelines");
}

export async function schedulePost(body: {
  PipelineId?: number | string;
  DateTime?: string;
  Posts: Array<{
    Accounts?: unknown[];
    Messages?: string[];
    MediaId?: string | number;
  }>;
  Id?: string | number;
}) {
  return fedicaFetch("/post", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
