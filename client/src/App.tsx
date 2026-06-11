import { useEffect } from "react";
import { Switch, Route } from "wouter";
import { useAuth } from "react-oidc-context";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setAccessToken } from "@/auth/tokenStore";
import { ProtectedRoute } from "@/auth/ProtectedRoute";
import { EDITOR_PERMS, ADMIN_PERMS } from "@/auth/usePermissions";
import { AppHeader } from "@/components/AppHeader";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import BrandKit from "@/pages/brand-kit";
import Editor from "@/pages/editor";
import Admin from "@/pages/admin";
import Login from "@/pages/login";
import Unauthorized from "@/pages/unauthorized";

// ---------------------------------------------------------------------------
// TokenSync — keeps the module-level token store in sync with OIDC state
// so that queryClient.ts and useImageLibrary.ts can attach Bearer tokens
// to API requests outside of React component context.
// ---------------------------------------------------------------------------
function TokenSync() {
  const auth = useAuth();

  useEffect(() => {
    setAccessToken(auth.user?.access_token ?? null);
  }, [auth.user?.access_token]);

  return null;
}

// ---------------------------------------------------------------------------
// AuthGate — shows a loading spinner while OIDC initialises, the Login page
// if the user is not authenticated, or the authenticated app routes.
// ---------------------------------------------------------------------------
function AuthGate() {
  const auth = useAuth();

  if (auth.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-sm animate-pulse">
          Initializing…
        </p>
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return <Login />;
  }

  return (
    <>
      <AppHeader />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/brand-kit/:brandId" component={BrandKit} />
        <Route path="/editor">
          <ProtectedRoute requiredRoles={["editor", "owner"]} requiredPermissions={EDITOR_PERMS}>
            <Editor />
          </ProtectedRoute>
        </Route>
        <Route path="/admin">
          <ProtectedRoute requiredRoles={["owner"]} requiredPermissions={ADMIN_PERMS}>
            <Admin />
          </ProtectedRoute>
        </Route>
        <Route path="/unauthorized" component={Unauthorized} />
        {/* The OIDC callback URL is handled by react-oidc-context's
            onSigninCallback before this route tree renders. */}
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

// ---------------------------------------------------------------------------
// App — root component, wrapped by AuthProvider in main.tsx
// ---------------------------------------------------------------------------
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TokenSync />
      <TooltipProvider>
        <Toaster />
        <AuthGate />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
