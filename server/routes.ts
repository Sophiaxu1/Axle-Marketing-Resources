import type { Express } from "express";
import { createServer, type Server } from "http";
import {
  authenticate,
  requirePermission,
  requireAnyPermission,
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
  // PUBLIC — no authentication required
  // -----------------------------------------------------------------------

  /** Runtime config (Supabase URL). Called during app initialisation. */
  app.get("/api/config", (_req, res) => {
    res.json({ supabaseUrl: SUPABASE_URL });
  });

  /**
   * Asset proxy — returns a temporary Supabase signed URL via redirect.
   * Used as `<img src>` in the frontend; browsers cannot attach Bearer
   * tokens to <img> requests, so this endpoint is public. Security is
   * provided by Supabase signed URL expiry (1 h) and path validation.
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
