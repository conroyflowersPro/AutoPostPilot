import { createHash, randomBytes } from "crypto";

const AUTH_URL = "https://x.com/i/oauth2/authorize";
const TOKEN_URL = "https://api.x.com/2/oauth2/token";

/**
 * OAuth 2.0 scopes.
 * tweet.write required for Manual Reply one-click publish (not Fedica).
 * User must re-connect X after this change for write to take effect.
 */
export const X_OAUTH_SCOPES = [
  "tweet.read",
  "tweet.write",
  "users.read",
  "offline.access",
].join(" ");

export function getOAuthConfig() {
  const clientId = process.env.X_CLIENT_ID;
  const clientSecret = process.env.X_CLIENT_SECRET;
  const redirectUri =
    process.env.X_OAUTH_REDIRECT_URI ||
    "https://autopostpilot.netlify.app/api/x/oauth/callback";

  if (!clientId) {
    throw new Error("X_CLIENT_ID is not configured");
  }
  if (!clientSecret) {
    throw new Error("X_CLIENT_SECRET is not configured");
  }

  return { clientId, clientSecret, redirectUri };
}

export function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

export function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function generateState(): string {
  return randomBytes(16).toString("base64url");
}

export function buildAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scope?: string;
}): string {
  const q = new URLSearchParams({
    response_type: "code",
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    scope: params.scope || X_OAUTH_SCOPES,
    state: params.state,
    code_challenge: params.codeChallenge,
    code_challenge_method: "S256",
  });
  return `${AUTH_URL}?${q.toString()}`;
}

export type TokenResponse = {
  token_type: string;
  expires_in: number;
  access_token: string;
  scope?: string;
  refresh_token?: string;
};

export async function exchangeCodeForTokens(params: {
  code: string;
  codeVerifier: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
    code_verifier: params.codeVerifier,
    client_id: params.clientId,
  });

  const basic = Buffer.from(
    `${params.clientId}:${params.clientSecret}`
  ).toString("base64");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      data.error_description || data.error || `Token exchange failed (${res.status})`
    );
  }
  return data as TokenResponse;
}

export async function refreshAccessToken(params: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: params.refreshToken,
    client_id: params.clientId,
  });

  const basic = Buffer.from(
    `${params.clientId}:${params.clientSecret}`
  ).toString("base64");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      data.error_description || data.error || `Token refresh failed (${res.status})`
    );
  }
  return data as TokenResponse;
}

export async function fetchXUserMe(accessToken: string) {
  const res = await fetch(
    "https://api.x.com/2/users/me?user.fields=public_metrics,profile_image_url,name,username",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || data.title || `users/me failed (${res.status})`);
  }
  return data.data as {
    id: string;
    name: string;
    username: string;
    profile_image_url?: string;
    public_metrics?: {
      followers_count?: number;
      following_count?: number;
      tweet_count?: number;
    };
  };
}
