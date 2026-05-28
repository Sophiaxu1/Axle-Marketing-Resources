/**
 * Token Store
 *
 * A simple module-level store for the current Authifi access token.
 * Updated by the TokenSync component (inside AuthProvider) whenever the
 * OIDC user state changes. Consumed by queryClient.ts and useImageLibrary.ts
 * to attach Bearer tokens to API requests outside of React component context.
 */

let _accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  _accessToken = token;
}

export function getAccessToken(): string | null {
  return _accessToken;
}
