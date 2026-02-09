"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SALARY_BY_ROLE } from "@/lib/salaryTable";

type DetectedPeopleResponse = {
  emails: string[];
};

type RolesResponse = {
  roles: Array<{
    person_email: string;
    role: string;
  }>;
};

type PersonRow = {
  email: string;
  role: string;
  saving: boolean;
  error: string | null;
};

const DAYS = 30;
const ROLE_OPTIONS = Object.keys(SALARY_BY_ROLE);

export default function PeopleRolesPage() {
  const [rows, setRows] = useState<PersonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadPeople() {
      try {
        const [detectedRes, rolesRes] = await Promise.all([
          fetch(`/api/people/detected?days=${DAYS}`, { cache: "no-store" }),
          fetch("/api/people", { cache: "no-store" }),
        ]);

        if (!detectedRes.ok || !rolesRes.ok) {
          setError("Failed to load detected people or saved roles");
          return;
        }

        const detectedJson = (await detectedRes.json()) as DetectedPeopleResponse;
        const rolesJson = (await rolesRes.json()) as RolesResponse;

        const roleByEmail = new Map<string, string>();
        for (const item of rolesJson.roles ?? []) {
          if (item?.person_email && item?.role) {
            roleByEmail.set(item.person_email, item.role);
          }
        }

        const mergedRows = Array.from(new Set(detectedJson.emails ?? []))
          .filter((email) => typeof email === "string" && email.trim().length > 0)
          .map((email) => email.trim())
          .sort((a, b) => a.localeCompare(b))
          .map((email) => ({
            email,
            role: roleByEmail.get(email) ?? "",
            saving: false,
            error: null,
          }));

        if (isMounted) {
          setRows(mergedRows);
        }
      } catch (loadError) {
        if (isMounted) {
          const message = loadError instanceof Error ? loadError.message : "Unknown error";
          setError(message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadPeople();

    return () => {
      isMounted = false;
    };
  }, []);

  const unassignedCount = useMemo(
    () => rows.filter((row) => row.role === "").length,
    [rows]
  );

  async function onRoleChange(email: string, nextRole: string) {
    const previous = rows.find((row) => row.email === email)?.role ?? "";

    setRows((current) =>
      current.map((row) =>
        row.email === email ? { ...row, role: nextRole, saving: true, error: null } : row
      )
    );

    try {
      const res = await fetch("/api/people", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          person_email: email,
          role: nextRole,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Failed to save role");
      }

      setRows((current) =>
        current.map((row) => (row.email === email ? { ...row, saving: false, error: null } : row))
      );
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Failed to save role";
      setRows((current) =>
        current.map((row) =>
          row.email === email
            ? { ...row, role: previous, saving: false, error: message }
            : row
        )
      );
    }
  }

  return (
    <section className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-muted">Dashboard</p>
          <h1 className="mt-3 text-3xl font-semibold">People & Roles</h1>
          <p className="mt-2 text-muted">
            Assign hourly roles to detected attendee emails from the last {DAYS} days.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-md border border-border bg-background/40 px-3 py-2 text-sm text-foreground hover:bg-background/60"
        >
          Back to dashboard
        </Link>
      </header>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl border border-border bg-card/80 p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Detected attendees</h2>
          <span className="text-sm text-muted">Unassigned: {unassignedCount}</span>
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-muted">Loading people…</p>
        ) : rows.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No attendee emails detected in the selected window.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Role</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.email} className="border-b border-border/70">
                    <td className="px-3 py-3 text-foreground">{row.email}</td>
                    <td className="px-3 py-3">
                      <select
                        className="w-full max-w-[220px] rounded-md border border-border bg-background px-2 py-1.5 text-foreground"
                        value={row.role}
                        disabled={row.saving}
                        onChange={(event) => {
                          void onRoleChange(row.email, event.target.value);
                        }}
                      >
                        <option value="">Unassigned</option>
                        {ROLE_OPTIONS.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-3">
                      {row.saving ? (
                        <span className="text-muted">Saving…</span>
                      ) : row.error ? (
                        <span className="text-destructive">{row.error}</span>
                      ) : row.role ? (
                        <span className="text-emerald-400">Saved</span>
                      ) : (
                        <span className="text-muted">Unassigned</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
