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
