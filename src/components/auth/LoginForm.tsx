"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { FormButton } from "@/components/ui/FormButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function LoginForm({
  hasMicrosoftProvider,
  hasCredentialsProvider,
}: {
  hasMicrosoftProvider: boolean;
  hasCredentialsProvider: boolean;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const handleCredentialLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      callbackUrl,
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid email or password");
      setLoading(false);
    } else if (result?.url) {
      window.location.href = result.url;
    }
  };

  return (
    <div className="space-y-5">
      {/* Microsoft SSO */}
      {hasMicrosoftProvider && (
        <>
          <Button
            type="button"
            onClick={() => signIn("microsoft-entra-id", { callbackUrl })}
            className="w-full"
          >
            <svg
              className="h-4 w-4 shrink-0"
              viewBox="0 0 23 23"
              fill="none"
              aria-hidden="true"
            >
              <path d="M0 0h11v11H0z" fill="#f25022" />
              <path d="M12 0h11v11H12z" fill="#7fba00" />
              <path d="M0 12h11v11H0z" fill="#00a4ef" />
              <path d="M12 12h11v11H12z" fill="#ffb900" />
            </svg>
            Sign in with Microsoft
          </Button>

          {hasCredentialsProvider && (
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-card px-3 text-foreground-subtle">
                  or sign in with email
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {/* Credentials form — only when ALLOW_PASSWORD_LOGIN=true */}
      {hasCredentialsProvider && (
        <form onSubmit={handleCredentialLogin} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@teamssquared.com"
              autoComplete="email"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
              autoComplete="current-password"
            />
          </div>

          <FormButton
            type="submit"
            variant="secondary"
            loading={loading}
            pendingLabel="Signing in…"
            className="w-full"
          >
            Sign In
          </FormButton>
        </form>
      )}
    </div>
  );
}
