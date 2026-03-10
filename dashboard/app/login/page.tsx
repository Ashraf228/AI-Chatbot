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
    <div style={{ maxWidth: 420, margin: "60px auto", fontFamily: "system-ui" }}>
      <h1>Admin Login</h1>

      <form onSubmit={onLogin}>
        <input
          type="password"
          placeholder="Passwort"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", padding: 12, marginTop: 12 }}
        />

        <button
          type="submit"
          style={{ marginTop: 12, padding: 12, width: "100%" }}
        >
          Login
        </button>
      </form>

      {err && <p style={{ color: "crimson" }}>{err}</p>}
    </div>
  );
}