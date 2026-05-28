/**
 * Unauthorized Page
 *
 * Displayed when an authenticated user tries to access a page or feature
 * they lack the necessary Authifi permission for.
 */

import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert, ArrowLeft } from "lucide-react";

export default function Unauthorized() {
  return (
    <div
      className="min-h-screen w-full flex items-center justify-center bg-gray-50"
      data-testid="page-unauthorized"
    >
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6 text-center space-y-4">
          <div className="flex justify-center">
            <ShieldAlert className="h-12 w-12 text-amber-500" />
          </div>

          <h1
            className="text-2xl font-bold text-gray-900"
            data-testid="text-unauthorized-title"
          >
            Access Denied
          </h1>

          <p className="text-sm text-gray-600">
            You don't have permission to view this page. If you believe this is
            an error, contact your administrator.
          </p>

          <Link href="/">
            <Button variant="outline" className="mt-2">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
