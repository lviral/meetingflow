import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { AuthCtaButton } from "@/components/AuthCtaButton";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (session?.user?.email) {
    redirect("/dashboard");
  }

  return (
    <section className="rounded-2xl border border-border bg-surface/60 p-10 shadow-sm">
      <p className="text-sm uppercase tracking-[0.3em] text-muted">Meetingflow</p>
      <h1 className="mt-4 text-3xl font-semibold">
        Understand where meeting time turns into cost.
      </h1>
      <p className="mt-3 max-w-xl text-muted">
        A focused workspace to monitor spend, people-hours, and large meetings. This
        is a placeholder landing page.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <AuthCtaButton />
      </div>
      <p className="mt-3 text-sm text-muted">
        Connect your Google Calendar to calculate meeting cost.
      </p>
    </section>
  );
}
