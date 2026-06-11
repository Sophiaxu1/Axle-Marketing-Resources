/**
 * useRole — exposes the user's Authifi Access Role, sourced from `/api/me`
 * (see useMe). The backend resolves the role from the `resource_roles` claim /
 * Authifi /me endpoint, so this is authoritative rather than inferred from the
 * token client-side.
 *
 * NB: still UX only — the backend re-checks the role on every protected route.
 */

import { useMe, type Role } from "./me";

export type { Role };

const ROLE_RANK: Record<Role, number> = { user: 0, editor: 1, owner: 2 };

export function useRole() {
  const { data, isLoading, isFetching } = useMe();

  const role: Role = data?.role ?? "user";

  return {
    /** Highest-privilege role the user holds (from /api/me). */
    role,
    /** Every app role resolved from the Access Roles. */
    roles: data?.roles ?? [],
    /** Raw Authifi user groups. */
    groups: data?.groups ?? [],
    isOwner: role === "owner",
    isEditor: ROLE_RANK[role] >= ROLE_RANK.editor,
    isUser: true,
    /** True while /api/me is still resolving (avoid premature redirects). */
    isLoading: isLoading || isFetching,
  };
}
