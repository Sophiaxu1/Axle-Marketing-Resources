/**
 * Login Page
 *
 * Displayed when the user is not authenticated. Provides a branded login
 * screen with a "Sign In" button that triggers the Authifi OIDC flow.
 */

import { useAuth } from "react-oidc-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LogIn } from "lucide-react";

export default function Login() {
  const auth = useAuth();

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{
        background:
          "linear-gradient(135deg, #17052E 0%, #4A2654 50%, #2d1240 100%)",
      }}
      data-testid="page-login"
    >
      <Card className="w-full max-w-sm">
        <CardContent className="pt-8 pb-8 px-8 text-center space-y-6">
          <div>
            <h1
              className="text-2xl font-bold tracking-tight"
              data-testid="text-login-title"
            >
              Marketing Resources
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              Sign in to access brand assets, templates, and creative resources.
            </p>
          </div>

          <Button
            onClick={() => auth.signinRedirect()}
            className="w-full"
            size="lg"
            data-testid="btn-sign-in"
          >
            <LogIn className="w-4 h-4 mr-2" />
            Sign In
          </Button>

          {auth.error && (
            <pre
              className="text-sm text-red-500 text-left whitespace-pre-wrap break-words max-h-48 overflow-auto"
              data-testid="text-login-error"
            >
              {JSON.stringify(
                {
                  message: auth.error.message,
                  name: auth.error.name,
                  stack: auth.error.stack,
                  ...auth.error,
                },
                null,
                2,
              )}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
