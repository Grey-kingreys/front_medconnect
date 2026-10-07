import { notFound } from "next/navigation";

// Outil interne de diagnostic : introuvable (404) en production.
export default function DebugLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return children;
}
