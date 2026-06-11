/**
 * AppHeader — top navigation bar shown on all authenticated pages.
 *
 * Renders the brand link plus role/permission-gated navigation:
 *   - "Editor" appears only if the user holds any EDITOR_PERMS
 *   - "Admin"  appears only if the user holds any ADMIN_PERMS
 * so links "only appear if you have access". The backend independently
 * enforces the same permissions on every protected route.
 */

import { Link, useLocation } from "wouter";
import { useAuth } from "react-oidc-context";
import { usePermissions, EDITOR_PERMS, ADMIN_PERMS } from "@/auth/usePermissions";
import { useRole, type Role } from "@/auth/useRole";
import { Button } from "@/components/ui/button";
import { Home, PencilRuler, ShieldCheck, LogOut } from "lucide-react";

const HEADER_GRADIENT =
  "linear-gradient(135deg, #17052E 0%, #4A2654 50%, #2d1240 100%)";

const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  editor: "Editor",
  user: "User",
};

interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
  testId: string;
  /** Whether this item is visible to the current user. */
  visible: boolean;
}

export function AppHeader() {
  const auth = useAuth();
  const [location] = useLocation();
  const { hasAny } = usePermissions();
  const { role, isEditor, isOwner } = useRole();

  const profile = auth.user?.profile;
  const displayName =
    (profile?.name as string) || (profile?.email as string) || "Signed in";

  // A link shows if the user holds the role OR any matching permission, so
  // editors/owners see their pages even if the token only carries the role.
  const navItems: NavItem[] = [
    { href: "/", label: "Home", icon: Home, testId: "nav-home", visible: true },
    {
      href: "/editor",
      label: "Editor",
      icon: PencilRuler,
      testId: "nav-editor",
      visible: isEditor || hasAny(EDITOR_PERMS),
    },
    {
      href: "/admin",
      label: "Admin",
      icon: ShieldCheck,
      testId: "nav-admin",
      visible: isOwner || hasAny(ADMIN_PERMS),
    },
  ];

  const visibleItems = navItems.filter((item) => item.visible);

  return (
    <header
      className="sticky top-0 z-40 border-b border-white/10"
      style={{ background: HEADER_GRADIENT }}
      data-testid="app-header"
    >
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
        {/* Brand + nav */}
        <div className="flex items-center gap-6 min-w-0">
          <Link
            href="/"
            className="text-white font-bold tracking-tight whitespace-nowrap"
            data-testid="nav-brand"
          >
            Marketing Resources
          </Link>
          <nav className="hidden sm:flex items-center gap-1">
            {visibleItems.map((item) => {
              const active =
                item.href === "/"
                  ? location === "/"
                  : location.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-testid={item.testId}
                  className={[
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                    active
                      ? "bg-white/15 text-white"
                      : "text-white/70 hover:text-white hover:bg-white/10",
                  ].join(" ")}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User + role + sign out */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="hidden md:flex flex-col items-end leading-tight min-w-0">
            <span
              className="text-sm text-white truncate max-w-[12rem]"
              data-testid="header-user-name"
            >
              {displayName}
            </span>
          </div>
          <span
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/15 text-white border border-white/20"
            data-testid="header-role-badge"
          >
            {ROLE_LABEL[role]}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => auth.signoutRedirect()}
            className="text-white/80 hover:text-white hover:bg-white/10"
            data-testid="btn-sign-out"
          >
            <LogOut className="w-4 h-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
