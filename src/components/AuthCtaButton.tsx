"use client";

import { signIn } from "next-auth/react";

export function AuthCtaButton() {
  return (
    <button
      type="button"
      onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
      className="rounded-md bg-black px-4 py-2 text-white"
    >
      Sign in with Google
    </button>
  );
}
