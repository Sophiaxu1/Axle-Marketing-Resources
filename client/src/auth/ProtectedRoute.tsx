/**
 * ProtectedRoute — Route guard for Authifi role/permission-based access.
 *
 * Wraps child components and grants access if the user satisfies ANY of the
 * provided criteria — a required role (from groups/roles) OR a required
 * permission (from the access-token `scope` claim). If the user is not
 * authenticated they are redirected to /login; if authenticated but lacking
 * access they are sent to /unauthorized. With no criteria, any valid session
 * is allowed.
 *
 * Usage:
 *   <ProtectedRoute requiredRoles={["editor", "owner"]} requiredPermissions={EDITOR_PERMS}>
 *     <Editor />
 *   </ProtectedRoute>
 */

import { useAuth } from "react-oidc-context";
import { Redirect } from "wouter";
import { useRole, type Role } from "./useRole";
import { usePermissions } from "./usePermissions";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Single permission that must be present in the scope. */
  requiredPermission?: string;
  /** Multiple permissions. Combined with `requireAll`. */
  requiredPermissions?: string[];
  /** If true every permission in `requiredPermissions` must be present (AND).
   *  If false (default) at least one must be present (OR). */
  requireAll?: boolean;
  /** Roles that may access. Satisfied if the user's role is in this list. */
  requiredRoles?: Role[];
}

export function ProtectedRoute({
  children,
  requiredPermission,
  requiredPermissions,
  requireAll = false,
  requiredRoles,
}: ProtectedRouteProps) {
  const auth = useAuth();
  const { role, isLoading } = useRole();
  const { scopes } = usePermissions();

  // Still loading OIDC state or the /api/me role lookup.
  if (auth.isLoading || (auth.isAuthenticated && isLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-sm animate-pulse">
          Loading…
        </p>
      </div>
    );
  }

  // Not logged in → redirect to login.
  if (!auth.isAuthenticated) {
    return <Redirect to="/login" replace />;
  }

  // Collect each provided criterion's result; access is granted if ANY passes.
  const checks: boolean[] = [];
  if (requiredRoles && requiredRoles.length > 0) {
    checks.push(requiredRoles.includes(role));
  }
  if (requiredPermission) {
    checks.push(scopes.includes(requiredPermission));
  }
  if (requiredPermissions && requiredPermissions.length > 0) {
    checks.push(
      requireAll
        ? requiredPermissions.every((p) => scopes.includes(p))
        : requiredPermissions.some((p) => scopes.includes(p)),
    );
  }

  // No criteria specified → any authenticated user is allowed.
  if (checks.length === 0) return <>{children}</>;

  if (!checks.some(Boolean)) {
    return <Redirect to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
