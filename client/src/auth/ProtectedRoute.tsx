/**
 * ProtectedRoute — Route guard for Authifi permission-based access control.
 *
 * Wraps child components and checks that the current user has the required
 * permission(s) in the JWT `scope` claim. If the user is not authenticated
 * they are redirected to /login. If authenticated but lacking the required
 * permission they are sent to /unauthorized.
 *
 * Usage:
 *   <ProtectedRoute requiredPermission="marketingresources.brands.view">
 *     <BrandKit />
 *   </ProtectedRoute>
 */

import { useAuth } from "react-oidc-context";
import { Redirect } from "wouter";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Single permission that must be present in the scope. */
  requiredPermission?: string;
  /** Multiple permissions. Combined with `requireAll`. */
  requiredPermissions?: string[];
  /** If true every permission in `requiredPermissions` must be present (AND).
   *  If false (default) at least one must be present (OR). */
  requireAll?: boolean;
}

export function ProtectedRoute({
  children,
  requiredPermission,
  requiredPermissions,
  requireAll = false,
}: ProtectedRouteProps) {
  const auth = useAuth();

  // Still loading OIDC state (e.g. silent renew or initial load).
  if (auth.isLoading) {
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

  // Parse permissions from the access token scope claim.
  const scopes: string[] =
    (auth.user?.profile?.scope as string)?.split(" ") ?? [];

  // Check single permission.
  if (requiredPermission && !scopes.includes(requiredPermission)) {
    return <Redirect to="/unauthorized" replace />;
  }

  // Check multiple permissions.
  if (requiredPermissions && requiredPermissions.length > 0) {
    const hasAccess = requireAll
      ? requiredPermissions.every((p) => scopes.includes(p))
      : requiredPermissions.some((p) => scopes.includes(p));
    if (!hasAccess) {
      return <Redirect to="/unauthorized" replace />;
    }
  }

  return <>{children}</>;
}
