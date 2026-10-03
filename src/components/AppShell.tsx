import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useStore } from "@/lib/store";

const NAV = [
  { to: "/", label: "Dashboard" },
  { to: "/search", label: "Live search" },
  { to: "/discover", label: "Demo listings" },
  { to: "/journey", label: "My Journey" },
  { to: "/passport", label: "Passport" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { error, dismissError, applications } = useStore();
  return (
    <div className="min-h-screen md:flex">
      <a href="#main" className="skip-link">Skip to content</a>
      <aside className="hidden w-60 shrink-0 flex-col gap-1 border-r border-border bg-sidebar p-5 md:flex md:sticky md:top-0 md:h-screen">
        <Link to="/" className="mb-6 font-display text-2xl">Opportunity<span className="text-primary">OS</span></Link>
        <nav aria-label="Main" className="flex flex-col gap-1">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className="nav-link" activeProps={{ className: "nav-link-active" }} activeOptions={{ exact: n.to === "/" }}>
              {n.label}
              {n.to === "/journey" && applications.length > 0 && <span className="ml-auto text-xs">{applications.length}</span>}
            </Link>
          ))}
        </nav>
        <Link to="/add" className="btn btn-outline mt-4">+ Add opportunity</Link>
        <Link to="/tracker-io" className="nav-link mt-1" activeProps={{ className: "nav-link-active" }}>Import / export CSV</Link>
        <p className="mt-auto text-xs text-muted-foreground">Data stays in this browser. Demo opportunities are fictional.</p>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
        <header className="flex items-center justify-between border-b border-border bg-sidebar px-4 py-3 md:hidden">
          <Link to="/" className="font-display text-xl">Opportunity<span className="text-primary">OS</span></Link>
          <Link to="/add" className="btn btn-outline btn-sm">+ Add</Link>
        </header>
        {error && (
          <div role="alert" className="m-4 flex items-start justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <span>{error}</span>
            <button className="btn btn-ghost btn-sm" onClick={dismissError}>Dismiss</button>
          </div>
        )}
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-10">{children}</main>
      </div>
      <nav aria-label="Main mobile" className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-border bg-sidebar md:hidden">
        {NAV.map((n) => (
          <Link key={n.to} to={n.to} className="mobile-nav-link" activeProps={{ className: "mobile-nav-active" }} activeOptions={{ exact: n.to === "/" }}>
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
