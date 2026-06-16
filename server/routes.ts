import type { Express } from "express";
import { createServer, type Server } from "http";
import {
  authenticate,
  requirePermission,
  requireAnyPermission,
  requireRole,
  getAuthzContext,
  highestAppRole,
} from "./middleware/authifi";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BUCKET = "Marketing Assets";
const SIGN_TTL_SECONDS = 3600;

const folderMap: Record<string, string> = {
  axlerator: "Axlerator/Image Library",
  axle: "Axle/Image Library",
  art: "Axle Research and Technologies/Image Library",
};

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

// Scopes granted to each Access Role, per the MarketingResources IAM mapping
// (marketingresources.* namespace). Returned by /api/me so the frontend can
// gate per-control UI from the authoritative role rather than the token.
const ROLE_SCOPES: Record<string, string[]> = {
  owner: [
    "marketingresources.app.delete",
    "marketingresources.assets.delete",
    "marketingresources.assets.download",
    "marketingresources.assets.edit",
    "marketingresources.assets.upload",
    "marketingresources.assets.view",
    "marketingresources.brands.create",
    "marketingresources.brands.delete",
    "marketingresources.brands.edit",
    "marketingresources.brands.view",
    "marketingresources.colors.copy",
    "marketingresources.colors.create",
    "marketingresources.colors.delete",
    "marketingresources.colors.edit",
    "marketingresources.colors.view",
    "marketingresources.images.delete",
    "marketingresources.images.upload",
    "marketingresources.images.view",
    "marketingresources.requests.create",
    "marketingresources.requests.view",
    "marketingresources.settings.manage",
    "marketingresources.settings.view",
    "marketingresources.store.view",
    "marketingresources.templates.create",
    "marketingresources.templates.delete",
    "marketingresources.templates.download",
    "marketingresources.templates.edit",
    "marketingresources.templates.view",
    "marketingresources.users.manage",
    "marketingresources.users.view",
  ],
  editor: [
    "marketingresources.assets.download",
    "marketingresources.assets.edit",
    "marketingresources.assets.upload",
    "marketingresources.assets.view",
    "marketingresources.brands.create",
    "marketingresources.brands.edit",
    "marketingresources.brands.view",
    "marketingresources.colors.copy",
    "marketingresources.colors.create",
    "marketingresources.colors.edit",
    "marketingresources.colors.view",
    "marketingresources.images.upload",
    "marketingresources.images.view",
    "marketingresources.requests.create",
    "marketingresources.requests.view",
    "marketingresources.store.view",
    "marketingresources.templates.create",
    "marketingresources.templates.download",
    "marketingresources.templates.edit",
    "marketingresources.templates.view",
  ],
  user: [
    "marketingresources.assets.download",
    "marketingresources.assets.view",
    "marketingresources.brands.view",
    "marketingresources.colors.copy",
    "marketingresources.colors.view",
    "marketingresources.images.view",
    "marketingresources.requests.create",
    "marketingresources.requests.view",
    "marketingresources.store.view",
    "marketingresources.templates.download",
    "marketingresources.templates.view",
  ],
};

function scopesForRole(role: string): string[] {
  return ROLE_SCOPES[role] ?? [];
}

async function signObject(path: string, download = false): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  const url = `${SUPABASE_URL}/storage/v1/object/sign/${encodeURIComponent(BUCKET)}/${encodePath(path)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ expiresIn: SIGN_TTL_SECONDS }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { signedURL?: string };
  if (!data.signedURL) return null;
  const fullUrl = `${SUPABASE_URL}/storage/v1${data.signedURL}`;
  return download ? `${fullUrl}&download=true` : fullUrl;
}

const ALLOWED_PREFIXES = [
  "Axle/",
  "Axlerator/",
  "Axle Research and Technologies/",
  "UI Images/",
];

function validPath(path: unknown): path is string {
  if (typeof path !== "string" || path.length === 0) return false;
  if (path.includes("..") || path.startsWith("/")) return false;
  return ALLOWED_PREFIXES.some((p) => path.startsWith(p));
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // -----------------------------------------------------------------------
  // ASSET PROXIES
  //
  // These serve `<img src>` / `<a href>` targets, which browsers cannot
  // attach a Bearer token to. They redirect to short-lived Supabase signed
  // URLs and are restricted by a strict path allowlist (validPath). NOTE:
  // these remain unauthenticated by necessity of the <img>/<a> mechanism;
  // hardening them further (authenticated fetch → blob, or capability tokens)
  // is tracked separately. The Supabase URL is NOT exposed via any endpoint.
  // -----------------------------------------------------------------------

  /**
   * Asset proxy — returns a temporary Supabase signed URL via redirect.
   */
  app.get("/api/asset", async (req, res) => {
    const path = req.query.path;
    if (!validPath(path)) {
      return res.status(400).json({ error: "Invalid path" });
    }
    const signed = await signObject(path, false);
    if (!signed) return res.status(404).json({ error: "Asset not found" });
    res.setHeader("Cache-Control", "private, max-age=300");
    res.redirect(signed);
  });

  /**
   * Download proxy — same as /api/asset but sets the download disposition.
   * Used in <a href> tags in home.tsx, so also kept public.
   */
  app.get("/api/download", async (req, res) => {
    const path = req.query.path;
    if (!validPath(path)) {
      return res.status(400).json({ error: "Invalid path" });
    }
    const signed = await signObject(path, true);
    if (!signed) return res.status(404).json({ error: "Asset not found" });
    res.redirect(signed);
  });

  // -----------------------------------------------------------------------
  // PROTECTED — Authifi JWT + permission checks
  // -----------------------------------------------------------------------

  /**
   * List images for a brand's image library.
   * Permission: marketingresources.images.view
   */
  app.get(
    "/api/images",
    ...requirePermission("marketingresources.images.view"),
    async (req, res) => {
      const brand = typeof req.query.brand === "string" ? req.query.brand : "";
      const folder = folderMap[brand];
      if (!folder) return res.status(400).json({ error: "Invalid brand" });
      if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        return res.status(500).json({ error: "Server misconfigured" });
      }
      try {
        const listRes = await fetch(
          `${SUPABASE_URL}/storage/v1/object/list/${encodeURIComponent(BUCKET)}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": SUPABASE_SERVICE_ROLE_KEY,
              "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({ prefix: folder + "/", limit: 200, offset: 0 }),
          }
        );
        if (!listRes.ok) {
          return res.status(502).json({ error: "Failed to list images" });
        }
        const data = (await listRes.json()) as Array<{ name: string }>;
        const items = data
          .filter((f) => f.name && f.name !== ".emptyFolderPlaceholder")
          .map((f) => {
            const fullPath = `${folder}/${f.name}`;
            return {
              name: f.name,
              url: `/api/asset?path=${encodeURIComponent(fullPath)}`,
              downloadUrl: `/api/download?path=${encodeURIComponent(fullPath)}`,
            };
          });
        res.json(items);
      } catch {
        res.status(500).json({ error: "Failed to list images" });
      }
    }
  );

  // -----------------------------------------------------------------------
  // Example endpoints backing the Editor and Admin pages.
  // Each is independently guarded — the frontend gating is UX only.
  // -----------------------------------------------------------------------

  /**
   * Returns the caller's identity + authorization as seen by the server.
   * Roles come from the Authifi Access Roles (`resource_roles` claim, falling
   * back to the /me endpoint); scopes are derived from the resolved role.
   * The frontend uses this as the single source of truth for gating.
   */
  app.get("/api/me", authenticate, async (req, res) => {
    const { roleIds, groups, appRoles } = await getAuthzContext(req);
    const role = highestAppRole(appRoles);
    res.json({
      sub: req.auth?.sub,
      email: req.auth?.email,
      name: req.auth?.name,
      resource_roles: roleIds,
      roles: appRoles,
      role,
      groups,
      scopes: scopesForRole(role),
    });
  });

  /**
   * Save editable content (demo). Echoes the payload back.
   * Role: editor or owner.
   */
  app.put(
    "/api/editor/content",
    ...requireRole("editor", "owner"),
    (req, res) => {
      res.json({ ok: true, saved: req.body });
    },
  );

  /**
   * List users for the admin dashboard. Returns an empty list — this app has
   * no local users table (Authifi owns identity). Wire this to the Authifi
   * admin API to list real group members.
   * Role: owner.
   */
  app.get(
    "/api/admin/users",
    ...requireRole("owner"),
    (_req, res) => {
      res.json([]);
    },
  );

  /**
   * Update application settings (demo). Echoes the payload back.
   * Role: owner.
   */
  app.put(
    "/api/admin/settings",
    ...requireRole("owner"),
    (req, res) => {
      res.json({ ok: true, settings: req.body });
    },
  );

  /**
   * Delete the application (demo — performs no destructive action).
   * Permission: marketingresources.app.delete (owner-only in Authifi).
   */
  app.delete(
    "/api/admin/app",
    ...requirePermission("marketingresources.app.delete"),
    (_req, res) => {
      res.json({ ok: true, message: "App deletion acknowledged (demo — nothing was deleted)." });
    },
  );

  // -----------------------------------------------------------------------
  // FUTURE ENDPOINTS — add with the correct permission guards
  // -----------------------------------------------------------------------
  //
  // Brands CRUD
  //   POST   /api/brands          ...requirePermission("marketingresources.brands.create")
  //   PUT    /api/brands/:id      ...requirePermission("marketingresources.brands.edit")
  //   DELETE /api/brands/:id      ...requirePermission("marketingresources.brands.delete")
  //
  // Assets CRUD
  //   POST   /api/assets          ...requirePermission("marketingresources.assets.upload")
  //   PUT    /api/assets/:id      ...requirePermission("marketingresources.assets.edit")
  //   DELETE /api/assets/:id      ...requirePermission("marketingresources.assets.delete")
  //
  // Templates CRUD
  //   POST   /api/templates       ...requirePermission("marketingresources.templates.create")
  //   PUT    /api/templates/:id   ...requirePermission("marketingresources.templates.edit")
  //   DELETE /api/templates/:id   ...requirePermission("marketingresources.templates.delete")
  //
  // Colors CRUD
  //   POST   /api/colors          ...requirePermission("marketingresources.colors.create")
  //   PUT    /api/colors/:id      ...requirePermission("marketingresources.colors.edit")
  //   DELETE /api/colors/:id      ...requirePermission("marketingresources.colors.delete")
  //
  // Images CRUD
  //   POST   /api/images/upload   ...requirePermission("marketingresources.images.upload")
  //   DELETE /api/images/:id      ...requirePermission("marketingresources.images.delete")
  //
  // Settings
  //   GET    /api/settings        ...requirePermission("marketingresources.settings.view")
  //   PUT    /api/settings        ...requirePermission("marketingresources.settings.manage")
  //
  // Users
  //   GET    /api/users           ...requirePermission("marketingresources.users.view")
  //   PUT    /api/users/:id       ...requirePermission("marketingresources.users.manage")
  //
  // App (destructive)
  //   DELETE /api/app             ...requirePermission("marketingresources.app.delete")
  //

  return httpServer;
}
