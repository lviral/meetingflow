import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function TopBar() {
  const session = await getServerSession(authOptions);
  const isLoggedIn = Boolean(session?.user?.email);

  return (
    <header className="border-b border-border bg-surface/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Meetingflow
        </Link>
        {!isLoggedIn ? (
          <nav className="flex items-center gap-4 text-sm text-muted">
            <Link className="transition hover:text-foreground" href="/login">
              Login
            </Link>
          </nav>
        ) : null}
      </div>
    </header>
  );
}
