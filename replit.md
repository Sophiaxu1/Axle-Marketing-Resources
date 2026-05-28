# Marketing Resources App

Internal marketing resources / brand kit web app, being rebuilt by pasting source files exactly as provided by the user. Do not invent or modify file contents — wait for the user to paste each file.

## Stack

- **Frontend**: React 18 + Vite 7, Wouter for routing, TanStack Query, Tailwind 3, Radix UI, Framer Motion, lucide-react
- **Backend**: Express 5 + tsx (dev), Drizzle ORM (schema + `drizzle.config.ts` pointing at `DATABASE_URL`)
- **Path aliases**: `@/` → `client/src`, `@shared/` → `shared`, `@assets/` → `attached_assets`
- **Dev script**: `NODE_ENV=development tsx server/index.ts` (Express serves API + Vite middleware on port 5000)
- **Brand assets**: stored in a **private** Supabase Storage bucket `Marketing Assets`. The server proxies all asset access via short-lived signed URLs:
  - `GET /api/asset?path=<relative>` → 302 redirects to a 1hr signed URL (used by `<img>` tags via `getAssetUrl()`)
  - `GET /api/download?path=<relative>` → 302 redirects to a signed URL with `&download=true` (used by all download buttons via `getDownloadUrl()`)
  - `GET /api/images?brand=<axle|axlerator|art>` → server lists the Image Library folder via the service role and returns `[{name, url}]` where each `url` is a `/api/asset?path=...` link
- Brand data stores only relative paths; the client never holds Supabase credentials and never talks to Supabase directly.
- **Environment variables** (server-side only): `VITE_SUPABASE_URL` (project URL) and `SUPABASE_SERVICE_ROLE_KEY` (used by the server to sign URLs and list the bucket). External deployments only need these two on the server — nothing is baked into the client bundle.

## Layout

```
client/
  index.html
  src/
    App.tsx, main.tsx, index.css
    components/ui/    (button, card, toast, toaster, tooltip)
    hooks/            (use-toast, useImageLibrary)
    lib/              (utils, queryClient, brand-data, supabase, config)
    pages/            (home, brand-kit, not-found)
server/               (index, routes, storage, static, vite)
shared/               (schema)
scripts/              (install-git-hooks.mjs — postinstall)
```

## Notes

- `toast.tsx` was reconstructed with default shadcn strings for two cva/className segments because the user's paste was truncated. Re-paste if the originals differ.
- The user's workflow is strictly file-by-file: acknowledge, save verbatim, ask for the next file. Do NOT scaffold or stub missing files.
