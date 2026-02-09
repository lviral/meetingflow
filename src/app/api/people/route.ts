import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { supabaseServer } from "@/lib/supabaseServer";

const ALLOWED_ROLES = new Set([
  "engineer",
  "manager",
  "executive",
  "sales",
  "support",
  "default",
]);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type PersonRoleRow = {
  person_email: string;
  role: string;
  updated_at: string;
};

type SessionLike = {
  user?: {
    email?: string | null;
  };
} | null;

function getOwnerEmail(session: SessionLike) {
  const ownerEmail = session?.user?.email;
  return typeof ownerEmail === "string" && ownerEmail.length > 0 ? ownerEmail : null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const ownerEmail = getOwnerEmail(session);

  if (!ownerEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("people_roles")
    .select("person_email, role, updated_at")
    .eq("owner_email", ownerEmail)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch people roles" }, { status: 500 });
  }

  const roles: PersonRoleRow[] = (data ?? []).map((row) => ({
    person_email: row.person_email as string,
    role: row.role as string,
    updated_at: row.updated_at as string,
  }));

  return NextResponse.json({ roles });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const ownerEmail = getOwnerEmail(session);

  if (!ownerEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const personEmail =
    typeof body === "object" && body !== null && "person_email" in body
      ? (body.person_email as string)
      : "";
  const role =
    typeof body === "object" && body !== null && "role" in body ? (body.role as string) : "";

  if (typeof personEmail !== "string" || !EMAIL_REGEX.test(personEmail)) {
    return NextResponse.json({ error: "Invalid person_email" }, { status: 400 });
  }

  if (typeof role !== "string" || !ALLOWED_ROLES.has(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { error } = await supabase.from("people_roles").upsert(
    {
      owner_email: ownerEmail,
      person_email: personEmail,
      role,
    },
    {
      onConflict: "owner_email,person_email",
    }
  );

  if (error) {
    return NextResponse.json({ error: "Failed to save person role" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
