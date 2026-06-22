import { redirect } from "next/navigation";
import { getDashboardSession } from "@/lib/auth";

function formatDate(value?: string) {
  if (!value) return "Kein Ablaufdatum hinterlegt";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Kein Ablaufdatum hinterlegt";
  return date.toLocaleString("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function EvaluationPage() {
  const session = await getDashboardSession();
  if (!session) {
    redirect("/login");
  }
  if (session.role !== "viewer") {
    redirect("/sites");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center px-6 py-16">
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
          Evaluation
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-950">
          Der Evaluationsbereich wird vorbereitet.
        </h1>
        <dl className="mt-8 space-y-4 text-sm text-slate-700">
          <div>
            <dt className="font-semibold text-slate-950">Rolle</dt>
            <dd>{session.role}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-950">Ablaufdatum</dt>
            <dd>{formatDate(session.accountExpiresAt || session.sessionExpiresAt)}</dd>
          </div>
        </dl>
        <form action="/api/auth/logout" method="post" className="mt-8">
          <button
            type="submit"
            className="rounded-full bg-slate-950 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Abmelden
          </button>
        </form>
      </section>
    </main>
  );
}
