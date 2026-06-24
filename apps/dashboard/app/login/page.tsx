"use client";

import Image from "next/image";
import { useState } from "react";
import { Button } from "../../components/shared/Button";
import { Input } from "../../components/shared/Input";
import { ErrorState } from "../../components/shared/ErrorState";

export default function LoginPage() {
  const [mode, setMode] = useState<"admin" | "operator" | "customer">("admin");
  const [tenantId, setTenantId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isSubmitting) {
      return;
    }

    setErr(null);
    setIsSubmitting(true);

    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 15000);
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          mode,
          tenantId,
          email,
          password,
        }),
        signal: controller.signal,
      });
      window.clearTimeout(timeout);

      const data = (await r.json().catch(() => null)) as { message?: string } | null;

      if (!r.ok) {
        setErr(data?.message ?? "Login fehlgeschlagen");
        setIsSubmitting(false);
        return;
      }

      window.location.assign("/sites");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setErr("Login-Zeitüberschreitung. Bitte erneut versuchen.");
      } else {
        setErr("Serverfehler beim Login");
      }

      setIsSubmitting(false);
    }
  }

  return (
    <div className="dashboard-auth">
      <div className="dashboard-auth-card">
        <div className="dashboard-auth-logo">
          <Image
            src="/soule-logo.png"
            alt="SSB Soule"
            width={132}
            height={132}
            style={{ width: 132, height: 132, objectFit: "contain" }}
            priority
          />
        </div>

        <p className="dashboard-eyebrow">Soulé Admin</p>
        <h1 className="dashboard-auth-title">Willkommen zurück</h1>
        <p className="dashboard-copy" style={{ marginTop: 0 }}>
          Melden Sie sich als Admin, Mitarbeiter oder Kunde an.
        </p>

        <form onSubmit={onLogin} className="dashboard-stack" aria-describedby={err ? "login-error" : undefined}>
          <fieldset className="dashboard-auth-mode-fieldset">
            <legend className="dashboard-label">Login-Typ</legend>
            <div className="dashboard-auth-mode-grid">
            <Button
              type="button"
              variant={mode === "admin" ? "primary" : "secondary"}
              aria-pressed={mode === "admin"}
              onClick={() => setMode("admin")}
              fullWidth
            >
              Admin
            </Button>
            <Button
              type="button"
              variant={mode === "operator" ? "primary" : "secondary"}
              aria-pressed={mode === "operator"}
              onClick={() => setMode("operator")}
              fullWidth
            >
              Mitarbeiter
            </Button>
            <Button
              type="button"
              variant={mode === "customer" ? "primary" : "secondary"}
              aria-pressed={mode === "customer"}
              onClick={() => setMode("customer")}
              fullWidth
            >
              Kunde
            </Button>
            </div>
          </fieldset>

          {mode === "customer" ? (
            <>
              <label className="dashboard-label" htmlFor="tenant-id">
                Mandant / Tenant ID
              </label>
              <Input
                id="tenant-id"
                type="text"
                placeholder="Mandant / Tenant ID"
                value={tenantId}
                autoComplete="organization"
                onChange={(e) => setTenantId(e.target.value)}
              />
              <label className="dashboard-label" htmlFor="login-email">
                E-Mail
              </label>
              <Input
                id="login-email"
                type="email"
                placeholder="E-Mail"
                value={email}
                autoComplete="email"
                onChange={(e) => setEmail(e.target.value)}
              />
            </>
          ) : null}

          <label className="dashboard-label" htmlFor="login-password">
            Passwort
          </label>
          <Input
            id="login-password"
            type="password"
            placeholder="Passwort"
            value={password}
            autoComplete="current-password"
            aria-invalid={Boolean(err)}
            aria-describedby={err ? "login-error" : undefined}
            onChange={(e) => setPassword(e.target.value)}
          />

          <Button type="submit" fullWidth disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting
              ? "Einloggen..."
              : mode === "admin"
                ? "Admin-Login"
                : mode === "operator"
                  ? "Mitarbeiter-Login"
                  : "Kunden-Login"}
          </Button>
        </form>

        {err && <div id="login-error"><ErrorState message={err} /></div>}
      </div>
    </div>
  );
}
