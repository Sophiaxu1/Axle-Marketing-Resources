/**
 * useMe — fetches the authoritative identity + authorization from our backend
 * `GET /api/me`, which resolves the user's Authifi Access Roles (from the
 * token `resource_roles` claim or the Authifi /me endpoint) and the scopes
 * granted to that role.
 *
 * This is the single source of truth for role/permission gating on the client.
 * Using our own backend (rather than calling Authifi /me directly) avoids
 * browser CORS against the Authifi tenant.
 */

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "react-oidc-context";

export type Role = "owner" | "editor" | "user";

export interface Me {
  sub?: string;
  email?: string;
  name?: string;
  /** Raw Authifi Access Role IDs (e.g. "AxleMarketingResources-Role-Owner"). */
  resource_roles: string[];
  /** App roles resolved from the Access Role IDs. */
  roles: Role[];
  /** Highest-privilege app role. */
  role: Role;
  groups: string[];
  /** Scopes granted to the resolved role (canonical axlemarketingresources.*). */
  scopes: string[];
}

export function useMe() {
  const auth = useAuth();
  const token = auth.user?.access_token;

  return useQuery<Me>({
    queryKey: ["/api/me"],
    // Only fetch once we actually have a token to send, to avoid a 401 race
    // with TokenSync populating the module-level token store.
    enabled: auth.isAuthenticated && !!token,
    staleTime: Infinity,
    queryFn: async () => {
      const res = await fetch("/api/me", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`${res.status}: failed to load /api/me`);
      return (await res.json()) as Me;
    },
  });
}
