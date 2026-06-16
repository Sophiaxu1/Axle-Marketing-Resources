/**
 * Admin (example) — owner-oriented dashboard, gated by Authifi permissions.
 *
 * The page route is guarded by ProtectedRoute (any ADMIN_PERMS). Within the
 * page, each section is independently gated on a specific permission, and the
 * backend re-checks the same permission on every endpoint:
 *   - Users      → GET /api/admin/users      (users.view)
 *   - Settings   → PUT /api/admin/settings   (settings.manage)
 *   - Danger zone→ DELETE /api/admin/app     (app.delete)
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePermissions, SCOPE } from "@/auth/usePermissions";
import { useRole } from "@/auth/useRole";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldCheck,
  Users,
  Settings as SettingsIcon,
  Save,
  Trash2,
  Check,
  AlertTriangle,
  Loader2,
} from "lucide-react";

const HERO_GRADIENT =
  "linear-gradient(135deg, #17052E 0%, #4A2654 50%, #2d1240 100%)";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  group: string;
}

// Permission matrix mirrored from the provisioning spec
// (Marketing-Resources-Final-Phase.pdf), used to visualise role grants.
const MATRIX: { area: string; owner: boolean; editor: boolean; user: boolean }[] = [
  { area: "View brands / assets / images", owner: true, editor: true, user: true },
  { area: "Download assets", owner: true, editor: true, user: true },
  { area: "Edit brand content", owner: true, editor: true, user: false },
  { area: "Upload assets / images", owner: true, editor: true, user: false },
  { area: "Create brand kits", owner: true, editor: false, user: false },
  { area: "Delete content", owner: true, editor: false, user: false },
  { area: "Submit requests", owner: true, editor: false, user: true },
  { area: "Manage settings", owner: true, editor: false, user: false },
  { area: "Manage users", owner: true, editor: false, user: false },
];

export default function Admin() {
  const { hasPermission } = usePermissions();
  const { role } = useRole();
  const { toast } = useToast();

  // Canonical model has no users.view — users.manage gates both viewing and
  // managing. There is also no app.delete scope; the danger zone is an
  // unguarded demo (owner reaches it only because the page itself is
  // ADMIN_PERMS-gated).
  const canViewUsers = hasPermission(SCOPE.USERS_MANAGE);
  const canManageUsers = hasPermission(SCOPE.USERS_MANAGE);
  const canViewSettings = hasPermission(SCOPE.SETTINGS_VIEW);
  const canManageSettings = hasPermission(SCOPE.SETTINGS_MANAGE);

  return (
    <div className="min-h-screen bg-background" data-testid="page-admin">
      {/* Hero */}
      <section className="relative overflow-hidden" style={{ background: HERO_GRADIENT }}>
        <div className="relative max-w-6xl mx-auto px-6 py-12">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-3"
          >
            <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/10 border border-white/15">
              <ShieldCheck className="w-5 h-5 text-white" />
            </span>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight" data-testid="text-admin-title">
                Admin
              </h1>
              <p className="text-sm text-white/70 mt-0.5">
                Manage users and settings. Signed in as <span className="font-semibold">{role}</span>.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        {canViewUsers && <UsersSection canManage={canManageUsers} />}
        {canViewSettings && <SettingsSection canManage={canManageSettings} />}

        {/* Permission matrix */}
        <Card data-testid="card-matrix">
          <CardHeader>
            <CardTitle className="text-lg">Role &amp; permission matrix</CardTitle>
            <CardDescription>Your role (<span className="font-semibold text-foreground">{role}</span>) column is highlighted.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-matrix">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2 pr-4 font-medium">Capability</th>
                  {(["owner", "editor", "user"] as const).map((r) => (
                    <th
                      key={r}
                      className={`py-2 px-3 font-medium capitalize ${role === r ? "text-primary" : ""}`}
                    >
                      {r}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MATRIX.map((row) => (
                  <tr key={row.area} className="border-b border-border/60">
                    <td className="py-2 pr-4">{row.area}</td>
                    {(["owner", "editor", "user"] as const).map((r) => (
                      <td key={r} className={`py-2 px-3 ${role === r ? "bg-primary/5" : ""}`}>
                        {row[r] ? <Check className="w-4 h-4 text-[hsl(76_100%_35%)]" /> : <span className="text-muted-foreground/40">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Danger zone — not tied to any Authifi scope (demo). */}
        <DangerZone />
      </div>
    </div>
  );
}

function UsersSection({ canManage }: { canManage: boolean }) {
  const { toast } = useToast();
  const { data, isLoading, isError } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
  });

  return (
    <Card data-testid="card-users">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="w-5 h-5 text-primary" /> Users
        </CardTitle>
        <CardDescription>Members and their Authifi groups.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="users-loading">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading users…
          </p>
        )}
        {isError && (
          <p className="text-sm text-destructive" data-testid="users-error">Failed to load users.</p>
        )}
        {data && data.length === 0 && (
          <div
            className="rounded border border-dashed border-border p-8 text-center"
            data-testid="users-empty"
          >
            <p className="text-sm text-muted-foreground">No users to display.</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Identity is managed in Authifi — connect the Authifi admin API to list group members.
            </p>
          </div>
        )}
        {data && data.length > 0 && (
          <table className="w-full text-sm" data-testid="table-users">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Email</th>
                <th className="py-2 pr-4 font-medium">Group</th>
                <th className="py-2 pr-4 font-medium">Role</th>
                {canManage && <th className="py-2 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {data.map((u) => (
                <tr key={u.id} className="border-b border-border/60" data-testid={`user-row-${u.id}`}>
                  <td className="py-2 pr-4">{u.name}</td>
                  <td className="py-2 pr-4 text-muted-foreground">{u.email}</td>
                  <td className="py-2 pr-4">{u.group}</td>
                  <td className="py-2 pr-4 capitalize">{u.role}</td>
                  {canManage && (
                    <td className="py-2 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toast({ title: "Manage", description: `Demo: edit ${u.name}'s role.` })}
                        data-testid={`btn-manage-${u.id}`}
                      >
                        Manage
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

function SettingsSection({ canManage }: { canManage: boolean }) {
  const { toast } = useToast();
  const [appName, setAppName] = useState("Axle Marketing Resources");
  const [supportEmail, setSupportEmail] = useState("marketing@axleinfo.com");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await apiRequest("PUT", "/api/admin/settings", { appName, supportEmail });
      toast({ title: "Settings saved", description: "Your changes have been applied." });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      toast({
        title: msg.startsWith("403") ? "Permission denied" : "Save failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card data-testid="card-settings">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <SettingsIcon className="w-5 h-5 text-primary" /> Settings
        </CardTitle>
        <CardDescription>Application configuration.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-w-md">
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="appName">App name</label>
          <input
            id="appName"
            value={appName}
            onChange={(e) => setAppName(e.target.value)}
            disabled={!canManage}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60"
            data-testid="input-app-name"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="supportEmail">Support email</label>
          <input
            id="supportEmail"
            value={supportEmail}
            onChange={(e) => setSupportEmail(e.target.value)}
            disabled={!canManage}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60"
            data-testid="input-support-email"
          />
        </div>
        {canManage ? (
          <Button onClick={save} disabled={saving} data-testid="btn-save-settings">
            <Save className="w-4 h-4 mr-1.5" /> {saving ? "Saving…" : "Save settings"}
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground" data-testid="settings-readonly">
            Read-only — requires settings.manage to edit.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function DangerZone() {
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);

  async function deleteApp() {
    setWorking(true);
    try {
      const res = await apiRequest("DELETE", "/api/admin/app");
      const body = (await res.json()) as { message?: string };
      toast({ title: "Delete app", description: body.message || "Request acknowledged (demo)." });
      setConfirming(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Request failed";
      toast({
        title: msg.startsWith("403") ? "Permission denied" : "Request failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setWorking(false);
    }
  }

  return (
    <Card className="border-destructive/40" data-testid="card-danger">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg text-destructive">
          <AlertTriangle className="w-5 h-5" /> Danger zone
        </CardTitle>
        <CardDescription>Irreversible, owner-only actions.</CardDescription>
      </CardHeader>
      <CardContent>
        {confirming ? (
          <div className="flex items-center gap-2">
            <Button variant="destructive" onClick={deleteApp} disabled={working} data-testid="btn-confirm-delete-app">
              <Trash2 className="w-4 h-4 mr-1.5" /> {working ? "Working…" : "Confirm delete"}
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={working} data-testid="btn-cancel-delete-app">
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="destructive" onClick={() => setConfirming(true)} data-testid="btn-delete-app">
            <Trash2 className="w-4 h-4 mr-1.5" /> Delete application
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
