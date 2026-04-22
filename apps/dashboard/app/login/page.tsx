"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../components/shared/Button";
import { Input } from "../../components/shared/Input";
import { ErrorState } from "../../components/shared/ErrorState";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function onLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);

    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      if (!r.ok) {
        setErr("Login fehlgeschlagen");
        return;
      }

      router.push("/sites");
    } catch {
      setErr("Serverfehler beim Login");
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
          Melde dich an, um Kunden-Sites, Leads, Reports und Widget-Einstellungen zu verwalten.
        </p>

        <form onSubmit={onLogin} className="dashboard-stack">
          <Input
            type="password"
            placeholder="Passwort"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <Button type="submit" fullWidth>
            Login
          </Button>
        </form>

        {err && <ErrorState message={err} />}
      </div>
    </div>
  );
}
