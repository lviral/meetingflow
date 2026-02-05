import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { TopBar } from "@/components/TopBar";

export const metadata: Metadata = {
  title: "Meetingflow",
  description: "Meeting analytics dashboard"
};

export default function RootLayout({
  children
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground">
        <TopBar />
        <main className="mx-auto w-full max-w-5xl px-6 py-10">
          {children}
        </main>
      </body>
    </html>
  );
}