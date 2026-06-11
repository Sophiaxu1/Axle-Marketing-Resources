/**
 * Authifi OIDC Configuration
 *
 * Configures oidc-client-ts / react-oidc-context for the PKCE Authorization
 * Code flow against the Authifi tenant.
 *
 * Required env vars (VITE_ prefix exposes them to the browser via Vite):
 *   VITE_AUTHIFI_AUTHORITY  — OIDC issuer, e.g. https://a-ci.ncats.io/_api/auth/<tenantName>
 *   VITE_AUTHIFI_CLIENT_ID  — OAuth client ID (created during provisioning)
 *   VITE_AUTHIFI_AUDIENCE   — Resource Server identifier for the API
 *   VITE_AUTHIFI_AUTH_URL   — (Optional) Override the authorize endpoint
 */

import { WebStorageStateStore } from "oidc-client-ts";
import type { AuthProviderProps } from "react-oidc-context";

const authority = import.meta.env.VITE_AUTHIFI_AUTHORITY as string;
const clientId = import.meta.env.VITE_AUTHIFI_CLIENT_ID as string;
const audience = import.meta.env.VITE_AUTHIFI_AUDIENCE as string;
const authUrl = import.meta.env.VITE_AUTHIFI_AUTH_URL as string | undefined;

export const oidcConfig: AuthProviderProps = {
  authority,
  client_id: clientId,
  redirect_uri: `${window.location.origin}/api/auth/callback/authifi`,
  post_logout_redirect_uri: window.location.origin,
  response_type: "code",
  scope: "openid profile email",

  ...(authUrl
    ? {
        metadata: {
          issuer: authority,
          authorization_endpoint: authUrl,
          token_endpoint: `${authority}/oidc/token`,
          jwks_uri: `${authority}/.well-known/jwks.json`,
          end_session_endpoint: `${authority}/session/end`,
          userinfo_endpoint: `${authority}/me`,
          revocation_endpoint: `${authority}/oidc/token/revocation`,
        },
      }
    : {}),

  extraQueryParams: {
    ...(audience ? { resource: audience } : {}),
    acr_values: "idp:2498",
  },

  userStore: new WebStorageStateStore({ store: window.sessionStorage }),

  automaticSilentRenew: true,

  onSigninCallback: () => {
    window.location.replace("/");
  },
};
