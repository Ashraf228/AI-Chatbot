"use client";

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
        background: "#f5f7fb",
      }}
    >
      <div
        style={{
          width: 380,
          background: "#fff",
          border: "1px solid #ddd",
          borderRadius: 14,
          padding: 24,
          boxShadow: "0 4px 18px rgba(0,0,0,0.05)",
        }}
      >
        <h1 style={{ marginTop: 0 }}>Admin Login</h1>

        <form onSubmit={onLogin}>
          <input
            type="password"
            placeholder="Passwort"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: "100%",
              padding: 12,
              marginTop: 12,
              borderRadius: 8,
              border: "1px solid #ccc",
            }}
          />

          <button
            type="submit"
            style={{
              marginTop: 12,
              padding: 12,
              width: "100%",
              borderRadius: 8,
              border: "1px solid #ccc",
              background: "#111",
              color: "#fff",
              cursor: "pointer",
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