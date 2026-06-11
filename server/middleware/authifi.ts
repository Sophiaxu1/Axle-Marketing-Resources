/**
 * Authifi JWT Validation Middleware
 *
 * Validates access tokens issued by Authifi (LS-Auth) using the JWKS endpoint.
 * Provides helper middlewares for per-route permission checks based on the
 * `scope` claim in the JWT, which contains RS Permissions assigned via
 * Authifi Access Roles.
 *
 * Environment variables:
 *   AUTHIFI_AUTHORITY — OIDC issuer URL, e.g. https://a-ci.ncats.io/_api/auth/<tenantName>
 *   AUTHIFI_AUDIENCE  — Resource Server identifier registered in Authifi
 */

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { Request, Response, NextFunction } from "express";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const AUTHORITY = process.env.AUTHIFI_AUTHORITY || "";
const AUDIENCE = process.env.AUTHIFI_AUDIENCE || "";

// Lazily create the JWKS fetcher so the middleware file can be imported even
// when env vars are not yet set (e.g. during build).
let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS() {
  if (!_jwks) {
    if (!AUTHORITY) {
      throw new Error(
        "AUTHIFI_AUTHORITY environment variable is not set. " +
          "JWT validation cannot proceed.",
      );
    }
    _jwks = createRemoteJWKSet(
      new URL(`${AUTHORITY}/.well-known/jwks.json`),
    );
  }
  return _jwks;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthifiClaims extends JWTPayload {
  sub: string;
  email?: string;
  name?: string;
  scope?: string;
  groups?: string[];
  amr?: string[];
  /** Authifi Access Roles, when projected into the token. May be a flat list
   *  of role IDs or an object keyed by Resource Server identifier. */
  resource_roles?: string[] | Record<string, string[]>;
  roles?: string[];
}

// Augment the Express Request type so `req.auth` is available downstream.
declare global {
  namespace Express {
    interface Request {
      auth?: AuthifiClaims;
    }
  }
}

// ---------------------------------------------------------------------------
// Access Role resolution — from Authifi Access Roles (`resource_roles`) AND
// User Groups, per the provisioning spec. Whichever grants the higher role
// wins, so e.g. membership in the owners group resolves to owner even if the
// token only surfaces an editor Access Role.
// ---------------------------------------------------------------------------

export type AppRole = "owner" | "editor" | "user";

const ME_URL = AUTHORITY ? `${AUTHORITY}/me` : "";

const ROLE_ID_TO_APP_ROLE: Record<string, AppRole> = {
  "AxleMarketingResources-Role-Owner": "owner",
  "AxleMarketingResources-Role-Editor": "editor",
  "AxleMarketingResources-Role-User": "user",
  owner: "owner",
  editor: "editor",
  user: "user",
};

// User Group → app role (PDF long forms + short-form aliases).
const GROUP_TO_APP_ROLE: Record<string, AppRole> = {
  "AxleMarketingResources-marketing-owners": "owner",
  "AxleMarketingResources-marketing-team": "editor",
  "AxleMarketingResources-axle-employees": "user",
  "axle-marketing-owners": "owner",
  "axle-marketing-team": "editor",
  "axle-employees": "user",
};

const ROLE_RANK: Record<AppRole, number> = { user: 0, editor: 1, owner: 2 };

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((x): x is string => typeof x === "string");
  if (typeof value === "string") return value.split(/[\s,]+/).filter(Boolean);
  return [];
}

/** Normalize a `resource_roles` claim (array, RS-keyed object, or string). */
function normalizeResourceRoles(rr: unknown): string[] {
  if (rr && typeof rr === "object" && !Array.isArray(rr)) {
    const obj = rr as Record<string, unknown>;
    const forAudience = AUDIENCE && Array.isArray(obj[AUDIENCE]) ? (obj[AUDIENCE] as unknown[]) : null;
    const values = forAudience ?? Object.values(obj).flat();
    return values.filter((x): x is string => typeof x === "string");
  }
  return toStringArray(rr);
}

// Short-lived cache of /me lookups, keyed by access token, to avoid calling
// Authifi /me on every protected request.
const meCache = new Map<string, { data: Record<string, unknown>; ts: number }>();
const ME_CACHE_TTL_MS = 60_000;

async function fetchMe(token: string): Promise<Record<string, unknown> | null> {
  if (!ME_URL) return null;
  const cached = meCache.get(token);
  if (cached && Date.now() - cached.ts < ME_CACHE_TTL_MS) return cached.data;
  try {
    const res = await fetch(ME_URL, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    meCache.set(token, { data, ts: Date.now() });
    return data;
  } catch {
    return null;
  }
}

export interface AuthzContext {
  /** Raw Access Role IDs (resource_roles). */
  roleIds: string[];
  /** Raw user groups. */
  groups: string[];
  /** Distinct app roles resolved from both roles and groups. */
  appRoles: AppRole[];
}

/**
 * Resolve roles + groups for a request. Reads the token claims first; if the
 * token carries neither resource_roles nor groups, falls back to Authifi /me.
 */
export async function getAuthzContext(req: Request): Promise<AuthzContext> {
  let roleIds = normalizeResourceRoles(req.auth?.resource_roles ?? req.auth?.roles);
  let groups = toStringArray(req.auth?.groups);

  if (roleIds.length === 0 && groups.length === 0) {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const me = token ? await fetchMe(token) : null;
    if (me) {
      roleIds = normalizeResourceRoles(me.resource_roles ?? me.roles);
      groups = toStringArray(me.groups);
    }
  }

  const fromRoles = roleIds.map((r) => ROLE_ID_TO_APP_ROLE[r]);
  const fromGroups = groups.map((g) => GROUP_TO_APP_ROLE[g]);
  const appRoles = Array.from(
    new Set([...fromRoles, ...fromGroups].filter((r): r is AppRole => Boolean(r))),
  );

  return { roleIds, groups, appRoles };
}

/** Highest-privilege app role from a list (defaults to "user"). */
export function highestAppRole(roles: AppRole[]): AppRole {
  return roles.reduce<AppRole>((h, r) => (ROLE_RANK[r] > ROLE_RANK[h] ? r : h), "user");
}

// ---------------------------------------------------------------------------
// Core authenticate middleware
// ---------------------------------------------------------------------------

/**
 * Validates the Bearer token from the `Authorization` header.
 * On success, attaches the decoded claims to `req.auth`.
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid authorization header" });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const { payload } = await jwtVerify(token, getJWKS(), {
      audience: AUDIENCE || undefined,
      issuer: AUTHORITY || undefined,
      algorithms: ["RS256"],
    });

    req.auth = payload as AuthifiClaims;
    next();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Invalid or expired token";
    res.status(401).json({ error: "Unauthorized", message });
    return;
  }
}

// ---------------------------------------------------------------------------
// Permission check helpers
// ---------------------------------------------------------------------------

/**
 * Returns an array of [authenticate, permissionCheck] middlewares.
 * Usage: `app.get("/api/foo", ...requirePermission("app.resource.action"), handler)`
 */
export function requirePermission(permission: string) {
  return [
    authenticate,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const scopes = (req.auth?.scope || "").split(" ");
      if (!scopes.includes(permission)) {
        res.status(403).json({
          error: "Forbidden",
          message: `Permission '${permission}' required`,
        });
        return;
      }
      next();
    },
  ];
}

/**
 * Requires the user to have at least ONE of the listed permissions.
 */
export function requireAnyPermission(...permissions: string[]) {
  return [
    authenticate,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const scopes = (req.auth?.scope || "").split(" ");
      if (!permissions.some((p) => scopes.includes(p))) {
        res.status(403).json({
          error: "Forbidden",
          message: `One of [${permissions.join(", ")}] required`,
        });
        return;
      }
      next();
    },
  ];
}

/**
 * Requires the user to hold one of the listed Access Roles. Roles are resolved
 * from the token `resource_roles` claim, falling back to the Authifi `/me`
 * endpoint. Usage: `app.put("/api/x", ...requireRole("editor", "owner"), handler)`
 */
export function requireRole(...allowed: AppRole[]) {
  return [
    authenticate,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const { appRoles } = await getAuthzContext(req);
      if (!appRoles.some((r) => allowed.includes(r))) {
        res.status(403).json({
          error: "Forbidden",
          message: `One of roles [${allowed.join(", ")}] required`,
        });
        return;
      }
      next();
    },
  ];
}

/**
 * Requires MFA step-up (checks for "mfa" in the `amr` claim).
 */
export function requireMfa() {
  return [
    authenticate,
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const amr = req.auth?.amr || [];
      if (!amr.includes("mfa")) {
        res.status(403).json({
          error: "Forbidden",
          message: "Multi-factor authentication required for this action",
        });
        return;
      }
      next();
    },
  ];
}
