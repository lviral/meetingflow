export default function LoginPage() {
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center justify-center gap-6 rounded-2xl border border-border bg-surface/70 px-8 py-12 text-center shadow-sm">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-muted">Login</p>
        <h1 className="mt-3 text-2xl font-semibold">Welcome back</h1>
        <p className="mt-2 text-sm text-muted">
          Authentication isn’t wired yet. This is a placeholder screen.
        </p>
      </div>
      <button
        type="button"
        className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium text-foreground transition hover:border-foreground"
      >
        Sign in with Google
      </button>
    </section>
  );
}