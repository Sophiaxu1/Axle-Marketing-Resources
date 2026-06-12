# Authifi Integration — Marketing Resources App

## Overview

This application uses **Authifi (LS-Auth)** for authentication and authorization.
Users sign in via the OIDC Authorization Code flow with PKCE. The backend validates
JWTs issued by Authifi and checks the `scope` claim for RS Permissions.

## Architecture

```
┌─────────────┐    OIDC     ┌─────────────┐
│  React SPA  │ ──────────> │   Authifi   │
│  (Vite)     │ <────────── │  (LS-Auth)  │
└──────┬──────┘  id_token   └─────────────┘
       │         access_token
       │ Bearer
       ▼
┌──────────────┐
│   Express    │  JWT validation via JWKS
│   Backend    │  Permission checks via `scope` claim
└──────────────┘
```

### Frontend (React + Vite)

- **Library:** `react-oidc-context` + `oidc-client-ts`
- **AuthProvider** wraps the entire app in `main.tsx`
- **TokenSync** component keeps a module-level token store in sync
- **AuthGate** in `App.tsx` shows Login page if unauthenticated
- **ProtectedRoute** component for per-page permission guards
- **usePermissions** hook for conditional UI rendering

### Backend (Express 5 + TypeScript)

- **Library:** `jose` (JWT verification against Authifi JWKS endpoint)
- **Middleware:** `server/middleware/authifi.ts`
  - `authenticate` — validates Bearer token, attaches `req.auth`
  - `requirePermission(perm)` — returns `[authenticate, permCheck]` array
  - `requireAnyPermission(...perms)` — OR-based permission check
  - `requireMfa()` — requires MFA step-up (`amr` includes `"mfa"`)

## Roles & Permissions

| Role   | Description                                    |
|--------|------------------------------------------------|
| owner  | Full access — manage everything, delete app    |
| editor | Content management — create/edit, no delete    |
| user   | Read-only — view, download, copy, request      |

### Permission Matrix (abbreviated)

| Permission Area   | owner | editor | user |
|-------------------|-------|--------|------|
| assets (CRUD)     | ✅    | CRU    | R    |
| brands (CRUD)     | ✅    | CRU    | R    |
| colors (CRUD+copy)| ✅    | CRU+copy | R+copy |
| images (CRUD)     | ✅    | CU     | R    |
| templates (CRUD)  | ✅    | CRU    | R    |
| requests          | ✅    | view+create | view+create |
| settings          | ✅    | ❌     | ❌   |
| users             | ✅    | ❌     | ❌   |
| app.delete        | ✅    | ❌     | ❌   |

See `authifi-provisioning-plan.json` for the full permission list.

## User Groups

| Group               | Role Assigned |
|----------------------|---------------|
| axle-marketing-owners | owner        |
| axle-marketing-team   | editor       |
| axle-employees        | user         |

## Setup Instructions

### 1. Provision the Authifi Tenant

Run the provisioning plan via the Authifi admin API or the Authifi Agent.
This creates:
- OAuth Client (PKCE, public)
- Resource Server (`https://api.axle-marketing-resources.com`)
- 30 RS Permissions
- 3 Access Roles (owner, editor, user)
- 3 User Groups
- Owner admin assignment

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in:

```bash
cp .env.example .env
```

Required values from provisioning:
- `VITE_AUTHIFI_CLIENT_ID` — the OAuth client ID created by provisioning
- `<TENANT_NAME>` — replace in the AUTHIFI_AUTHORITY URLs with your tenant name

### 3. Install Dependencies

```bash
npm install
```

### 4. Run the App

```bash
npm run dev
```

The app runs on `http://localhost:3000` (set `PORT=3000` in `.env`).

### 5. Test the Login Flow

1. Open `http://localhost:3000`
2. You should see the Login page
3. Click "Sign In" → redirected to Authifi
4. Authenticate with your identity provider
5. Redirected back to the app → Home page renders

## Token Lifecycle

| Event              | Handling                                        |
|--------------------|-------------------------------------------------|
| Initial login      | `auth.signinRedirect()` → Authifi authorize     |
| Callback           | `onSigninCallback` → navigate to `/`            |
| Token storage      | `sessionStorage` (cleared on tab close)         |
| Token refresh      | `automaticSilentRenew: true` (oidc-client-ts)   |
| Logout             | `auth.signoutRedirect()` → Authifi end_session  |
| Expired token (API)| Backend returns 401 → frontend can re-login     |

## Key Files

| File | Purpose |
|------|---------|
| `client/src/auth/authConfig.ts` | OIDC configuration |
| `client/src/auth/tokenStore.ts` | Module-level token store |
| `client/src/auth/ProtectedRoute.tsx` | Route guard component |
| `client/src/auth/usePermissions.ts` | Permission hook + constants |
| `client/src/pages/login.tsx` | Login page |
| `client/src/pages/unauthorized.tsx` | Access denied page |
| `client/src/App.tsx` | AuthGate + TokenSync |
| `client/src/main.tsx` | AuthProvider wrapper |
| `client/src/lib/queryClient.ts` | Bearer token on API calls |
| `server/middleware/authifi.ts` | JWT validation middleware |
| `server/routes.ts` | Protected routes |
| `shared/schema.ts` | Authifi-compatible user schema |
| `.env.example` | Environment variables template |

## Security Notes

- **Backend validates, frontend decorates.** Frontend permission checks
  (ProtectedRoute, usePermissions) are for UX only. The backend independently
  validates JWTs and checks scopes.

- **Fail closed on config.** Token validation requires both `AUTHIFI_AUTHORITY`
  and `AUTHIFI_AUDIENCE`; if either is unset the middleware throws rather than
  skipping `aud`/`iss` validation (`assertAuthConfig`).

- **No config endpoint.** The Supabase URL is not exposed via any runtime
  endpoint (the former public `GET /api/config` was removed); the server holds
  it as a server-only env var.

- **Asset proxy endpoints** (`/api/asset`, `/api/download`) remain
  unauthenticated because they serve `<img>` and `<a>` tags that cannot carry
  Bearer tokens; they are restricted by a strict path allowlist and short-lived
  Supabase signed URLs. KNOWN GAP (IAM review): an unauthenticated caller can
  still obtain signed URLs for allowed-prefix paths. Hardening (authenticated
  fetch → blob, or capability tokens) is a tracked follow-up.

- **All other API endpoints** require a valid JWT with the appropriate role/permission.

- **PKCE** is used (public client, `tokenEndpointAuthMethod: "none"`). No
  client secret is stored in the frontend.

## Adding New Protected Routes

### Backend

```typescript
// In server/routes.ts
app.post("/api/brands", ...requirePermission("marketingresources.brands.create"), async (req, res) => {
  // req.auth contains the decoded JWT claims
  const userId = req.auth!.sub;
  // ... handler logic
});
```

### Frontend

```tsx
// Per-page guard
<ProtectedRoute requiredPermission="marketingresources.settings.view">
  <SettingsPage />
</ProtectedRoute>

// Conditional UI
const { hasPermission } = usePermissions();
{hasPermission("marketingresources.brands.delete") && <DeleteButton />}
```

## Example Pages: Editor & Admin

Two example pages demonstrate end-to-end role + permission gating. They use the
**canonical `axlemarketingresources.*` scopes** from the provisioning spec
(`Marketing-Resources-Final-Phase.pdf`), exposed via the `SCOPE` constant in
`usePermissions.ts`. (The legacy `P` constants / `marketingresources.*`
namespace remain in use by the rest of the app.)

### Roles & groups (per the provisioning spec)

| Group | Role |
|-------|------|
| `axle-marketing-owners` | Owner |
| `axle-marketing-team` | Editor |
| `axle-employees` | User |

Authorization is **role-based, sourced from `GET /api/me`** (the single source
of truth). The server resolves the role from **both** the Authifi **Access
Roles** (`resource_roles`) **and** the user's **groups** — whichever grants the
higher role wins, so membership in `axle-marketing-owners` resolves to `owner`
even if `resource_roles` only carries an editor role. Token claims are read
first, falling back to a server-side call to the Authifi `/me` endpoint
(`server/middleware/authifi.ts` → `getAuthzContext` / `requireRole`).
`/api/me` returns `{ role, roles, resource_roles, groups, scopes }`, where
`scopes` are the canonical scopes granted to the resolved role.

On the client, `useMe()` (`client/src/auth/me.ts`) fetches `/api/me`; `useRole()`
and `usePermissions()` both read from it. Calling our backend (not Authifi `/me`
directly) avoids browser CORS against the tenant.

### Navigation

`AppHeader` (`client/src/components/AppHeader.tsx`) renders on every
authenticated page. The **Editor** and **Admin** links appear when the user has
the matching **role** (from `/api/me`) OR any permission in `EDITOR_PERMS` /
`ADMIN_PERMS`.

### Pages

| Page | Route | Frontend guard (role OR permission) | Per-control gating |
|------|-------|----------------|--------------------|
| Editor | `/editor` | `requiredRoles={["editor","owner"]}` or any `EDITOR_PERMS` | edit → `brands.edit`; create → `brands.create`; upload → `assets.upload`/`images.upload`; delete → `assets.delete`/`brands.delete`/`images.delete` |
| Admin  | `/admin`  | `requiredRoles={["owner"]}` or any `ADMIN_PERMS` | users → `users.manage`; settings view/manage → `settings.view`/`settings.manage`; danger zone → ungated demo |

### Example endpoints (`server/routes.ts`) — role-enforced

| Endpoint | Required role |
|----------|------|
| `GET /api/me` | any valid token |
| `PUT /api/editor/content` | editor or owner |
| `GET /api/admin/users` | owner |
| `PUT /api/admin/settings` | owner |
| `DELETE /api/admin/app` | any valid token (no `app.delete` role/scope — demo, deletes nothing) |
