"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";

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
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background:
          "radial-gradient(circle at top, rgba(28,25,23,0.14), transparent 38%), linear-gradient(180deg, #f7f5f2 0%, #efebe6 100%)",
      }}
    >
      <div
        style={{
          width: 420,
          background: "rgba(255,255,255,0.88)",
          border: "1px solid rgba(28,25,23,0.08)",
          borderRadius: 24,
          padding: 32,
          boxShadow: "0 24px 70px rgba(28,25,23,0.12)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div style={{ display: "grid", justifyItems: "center", marginBottom: 18 }}>
          <Image
            src="/soule-logo.png"
            alt="SSB Soule"
            width={132}
            height={132}
            style={{ width: 132, height: 132, objectFit: "contain" }}
            priority
          />
        </div>

        <p
          style={{
            margin: 0,
            color: "#78716c",
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            fontSize: 12,
          }}
        >
          Soulé Admin
        </p>
        <h1 style={{ marginTop: 12, marginBottom: 6, fontSize: 34, color: "#1c1917" }}>
          Willkommen zurück
        </h1>
        <p style={{ marginTop: 0, color: "#57534e", lineHeight: 1.5 }}>
          Melde dich an, um Kunden-Sites, Leads, Reports und Widget-Einstellungen zu verwalten.
        </p>

        <form onSubmit={onLogin}>
          <input
            type="password"
            placeholder="Passwort"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: "100%",
              padding: 14,
              marginTop: 12,
              borderRadius: 14,
              border: "1px solid #d6d3d1",
              background: "#fcfcfb",
            }}
          />

          <button
            type="submit"
            style={{
              marginTop: 14,
              padding: 14,
              width: "100%",
              borderRadius: 14,
              border: "1px solid #111",
              background: "#111",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Login
          </button>
        </form>

        {err && <p style={{ color: "crimson", marginTop: 12 }}>{err}</p>}
      </div>
    </div>
  );
}
