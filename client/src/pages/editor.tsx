/**
 * Editor (example) — demonstrates permission-gated content editing.
 *
 * Every interactive control is gated on a specific Authifi permission from the
 * token `scope` claim. Controls the user lacks are not rendered. The "Save"
 * action calls PUT /api/editor/content, which the backend independently guards
 * with `requirePermission("marketingresources.assets.edit")`.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePermissions, SCOPE, EDITOR_PERMS } from "@/auth/usePermissions";
import { useRole } from "@/auth/useRole";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { brandList } from "@/lib/brand-data";
import {
  PencilRuler,
  Save,
  Plus,
  Upload,
  Trash2,
  Check,
  X,
  Lock,
} from "lucide-react";

const HERO_GRADIENT =
  "linear-gradient(135deg, #17052E 0%, #4A2654 50%, #2d1240 100%)";

interface AssetRow {
  id: number;
  name: string;
}

let nextId = 1000;

export default function Editor() {
  const { hasPermission, scopes } = usePermissions();
  const { role, groups } = useRole();
  const { toast } = useToast();

  // Demo content seeded from the real brand catalogue.
  const [tagline, setTagline] = useState(
    "Your one-stop shop for brand assets, support requests, and creative resources.",
  );
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(tagline);
  const [assets, setAssets] = useState<AssetRow[]>(
    brandList.map((b, i) => ({ id: i, name: `${b.shortName} — Brand Kit` })),
  );
  const [saving, setSaving] = useState(false);

  const canEdit = hasPermission(SCOPE.BRANDS_EDIT);
  const canCreate = hasPermission(SCOPE.BRANDS_CREATE);
  const canUpload = hasPermission(SCOPE.IMAGES_UPLOAD) || hasPermission(SCOPE.ASSETS_UPLOAD);
  const canDelete =
    hasPermission(SCOPE.ASSETS_DELETE) ||
    hasPermission(SCOPE.BRANDS_DELETE) ||
    hasPermission(SCOPE.IMAGES_DELETE);

  async function handleSave() {
    setSaving(true);
    try {
      await apiRequest("PUT", "/api/editor/content", { tagline: draft, assets });
      setTagline(draft);
      setEditing(false);
      toast({ title: "Saved", description: "Content updated successfully." });
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

  function addAsset() {
    setAssets((prev) => [...prev, { id: nextId++, name: "New asset" }]);
  }

  function removeAsset(id: number) {
    setAssets((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <div className="min-h-screen bg-background" data-testid="page-editor">
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
              <PencilRuler className="w-5 h-5 text-white" />
            </span>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight" data-testid="text-editor-title">
                Content Editor
              </h1>
              <p className="text-sm text-white/70 mt-0.5">
                Edit brand content and assets. Controls reflect your permissions.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        {/* Access panel */}
        <Card data-testid="card-access">
          <CardHeader>
            <CardTitle className="text-lg">Your access</CardTitle>
            <CardDescription>
              Role <span className="font-semibold text-foreground" data-testid="text-role">{role}</span>
              {groups.length > 0 && (
                <> · groups: {groups.join(", ")}</>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
              {EDITOR_PERMS.map((perm) => {
                const granted = scopes.includes(perm);
                return (
                  <div key={perm} className="flex items-center gap-2 text-sm" data-testid={`perm-${perm}`}>
                    {granted ? (
                      <Check className="w-4 h-4 text-[hsl(76_100%_35%)]" />
                    ) : (
                      <X className="w-4 h-4 text-muted-foreground/50" />
                    )}
                    <span className={granted ? "text-foreground" : "text-muted-foreground/60"}>
                      {perm.replace("axlemarketingresources.", "")}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Editable tagline */}
        <Card data-testid="card-tagline">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-lg">Homepage tagline</CardTitle>
              <CardDescription>The subtitle shown on the landing hero.</CardDescription>
            </div>
            {canEdit && !editing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDraft(tagline);
                  setEditing(true);
                }}
                data-testid="btn-edit-tagline"
              >
                <PencilRuler className="w-4 h-4 mr-1.5" /> Edit
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {editing ? (
              <div className="space-y-3">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  data-testid="input-tagline"
                />
                <div className="flex items-center gap-2">
                  <Button onClick={handleSave} disabled={saving} data-testid="btn-save-tagline">
                    <Save className="w-4 h-4 mr-1.5" /> {saving ? "Saving…" : "Save"}
                  </Button>
                  <Button variant="ghost" onClick={() => setEditing(false)} disabled={saving} data-testid="btn-cancel-tagline">
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-foreground" data-testid="text-tagline">{tagline}</p>
            )}
            {!canEdit && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="text-readonly-tagline">
                <Lock className="w-3.5 h-3.5" /> Read-only — requires an edit permission.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Asset list */}
        <Card data-testid="card-assets">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-lg">Brand assets</CardTitle>
              <CardDescription>Featured items on the resources hub.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {canUpload && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toast({ title: "Upload", description: "Demo upload dialog would open here." })}
                  data-testid="btn-upload-asset"
                >
                  <Upload className="w-4 h-4 mr-1.5" /> Upload
                </Button>
              )}
              {canCreate && (
                <Button size="sm" onClick={addAsset} data-testid="btn-add-asset">
                  <Plus className="w-4 h-4 mr-1.5" /> Add
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border" data-testid="list-assets">
              {assets.map((asset) => (
                <li key={asset.id} className="flex items-center justify-between py-2.5" data-testid={`asset-row-${asset.id}`}>
                  {canEdit ? (
                    <input
                      value={asset.name}
                      onChange={(e) =>
                        setAssets((prev) =>
                          prev.map((a) => (a.id === asset.id ? { ...a, name: e.target.value } : a)),
                        )
                      }
                      className="flex-1 mr-3 bg-transparent text-sm focus-visible:outline-none border-b border-transparent focus:border-input"
                      data-testid={`input-asset-${asset.id}`}
                    />
                  ) : (
                    <span className="flex-1 text-sm">{asset.name}</span>
                  )}
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => removeAsset(asset.id)}
                      data-testid={`btn-delete-asset-${asset.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            {canEdit && (
              <div className="mt-4">
                <Button onClick={handleSave} disabled={saving} data-testid="btn-save-assets">
                  <Save className="w-4 h-4 mr-1.5" /> {saving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
