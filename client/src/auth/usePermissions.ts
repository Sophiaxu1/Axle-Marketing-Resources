/**
 * usePermissions — React hook for checking Authifi permissions in components.
 *
 * Reads the `scope` claim from the current Authifi access token and exposes
 * helpers to conditionally render UI based on the user's permissions.
 *
 * Usage:
 *   const { hasPermission } = usePermissions();
 *   {hasPermission("marketingresources.assets.delete") && <DeleteButton />}
 */

import { useAuth } from "react-oidc-context";
import { useMe } from "./me";

export function usePermissions() {
  const auth = useAuth();

  // Scopes come from /api/me, derived server-side from the user's Access Role.
  // This keeps per-control UI gating consistent with role-based API enforcement.
  const { data } = useMe();
  const scopes: string[] = data?.scopes ?? [];

  return {
    /** True if the user has the exact permission. */
    hasPermission: (perm: string) => scopes.includes(perm),

    /** True if the user has at least one of the listed permissions. */
    hasAny: (perms: string[]) => perms.some((p) => scopes.includes(p)),

    /** True if the user has ALL of the listed permissions. */
    hasAll: (perms: string[]) => perms.every((p) => scopes.includes(p)),

    /** The raw list of scope strings from the access token. */
    scopes,

    /** The OIDC user profile (sub, email, name, etc.). */
    user: auth.user?.profile,

    /** Whether the user is currently authenticated. */
    isAuthenticated: auth.isAuthenticated,
  };
}

// ---------------------------------------------------------------------------
// Permission constants — keep in sync with the Authifi provisioning plan.
// ---------------------------------------------------------------------------

export const P = {
  APP_DELETE: "marketingresources.app.delete",
  STORE_VIEW: "marketingresources.store.view",
  USERS_VIEW: "marketingresources.users.view",
  USERS_MANAGE: "marketingresources.users.manage",
  ASSETS_VIEW: "marketingresources.assets.view",
  ASSETS_EDIT: "marketingresources.assets.edit",
  ASSETS_DELETE: "marketingresources.assets.delete",
  ASSETS_UPLOAD: "marketingresources.assets.upload",
  ASSETS_DOWNLOAD: "marketingresources.assets.download",
  BRANDS_VIEW: "marketingresources.brands.view",
  BRANDS_EDIT: "marketingresources.brands.edit",
  BRANDS_CREATE: "marketingresources.brands.create",
  BRANDS_DELETE: "marketingresources.brands.delete",
  COLORS_VIEW: "marketingresources.colors.view",
  COLORS_EDIT: "marketingresources.colors.edit",
  COLORS_CREATE: "marketingresources.colors.create",
  COLORS_DELETE: "marketingresources.colors.delete",
  COLORS_COPY: "marketingresources.colors.copy",
  IMAGES_VIEW: "marketingresources.images.view",
  IMAGES_UPLOAD: "marketingresources.images.upload",
  IMAGES_DELETE: "marketingresources.images.delete",
  REQUESTS_VIEW: "marketingresources.requests.view",
  REQUESTS_CREATE: "marketingresources.requests.create",
  SETTINGS_VIEW: "marketingresources.settings.view",
  SETTINGS_MANAGE: "marketingresources.settings.manage",
  TEMPLATES_VIEW: "marketingresources.templates.view",
  TEMPLATES_EDIT: "marketingresources.templates.edit",
  TEMPLATES_CREATE: "marketingresources.templates.create",
  TEMPLATES_DELETE: "marketingresources.templates.delete",
  TEMPLATES_DOWNLOAD: "marketingresources.templates.download",
} as const;

// ---------------------------------------------------------------------------
// Authifi RS permission scopes (marketingresources.* — the canonical namespace
// per the MarketingResources IAM mapping). Used by the example Editor/Admin
// pages; same namespace as the `P` constants above.
// ---------------------------------------------------------------------------

export const SCOPE = {
  ASSETS_VIEW: "marketingresources.assets.view",
  ASSETS_DOWNLOAD: "marketingresources.assets.download",
  ASSETS_UPLOAD: "marketingresources.assets.upload",
  ASSETS_DELETE: "marketingresources.assets.delete",
  BRANDS_VIEW: "marketingresources.brands.view",
  BRANDS_EDIT: "marketingresources.brands.edit",
  BRANDS_CREATE: "marketingresources.brands.create",
  BRANDS_DELETE: "marketingresources.brands.delete",
  IMAGES_VIEW: "marketingresources.images.view",
  IMAGES_UPLOAD: "marketingresources.images.upload",
  IMAGES_DELETE: "marketingresources.images.delete",
  REQUESTS_VIEW: "marketingresources.requests.view",
  REQUESTS_CREATE: "marketingresources.requests.create",
  SETTINGS_VIEW: "marketingresources.settings.view",
  SETTINGS_MANAGE: "marketingresources.settings.manage",
  USERS_MANAGE: "marketingresources.users.manage",
} as const;

// ---------------------------------------------------------------------------
// Grouped permission sets — used to gate the example Editor and Admin pages
// (and their nav links). A user needs at least ONE permission in a set to
// see the corresponding page.
// ---------------------------------------------------------------------------

/** Permissions that grant access to the Editor page (editor or owner role). */
export const EDITOR_PERMS: string[] = [
  SCOPE.BRANDS_EDIT,
  SCOPE.BRANDS_CREATE,
  SCOPE.ASSETS_UPLOAD,
  SCOPE.IMAGES_UPLOAD,
];

/** Permissions that grant access to the Admin page (owner role). */
export const ADMIN_PERMS: string[] = [
  SCOPE.SETTINGS_VIEW,
  SCOPE.SETTINGS_MANAGE,
  SCOPE.USERS_MANAGE,
];
