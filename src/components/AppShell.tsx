import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  ArrowUpRight,
  Compass,
  FilePlus2,
  FolderSearch2,
  Map,
  Orbit,
  Route as RouteIcon,
  Search,
  UserRound,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { CompareTray } from "./CompareTray";

const NAV = [
  { to: "/", label: "Home", mobileLabel: "Home", icon: Orbit },
  { to: "/search", label: "Live search", mobileLabel: "Live", icon: Search },
  { to: "/discover", label: "Demo listings", mobileLabel: "Demo", icon: Compass },
  { to: "/journey", label: "My Journey", mobileLabel: "Journey", icon: RouteIcon },
  { to: "/tracker", label: "Tracker", mobileLabel: "Tracker", icon: FolderSearch2 },
  { to: "/passport", label: "Passport", mobileLabel: "Passport", icon: UserRound },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { error, dismissError, applications } = useStore();
  return (
    <div className="atlas-shell min-h-screen md:flex">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <aside className="atlas-rail hidden shrink-0 flex-col border-r border-border bg-sidebar md:flex md:sticky md:top-0 md:h-screen">
        <Link to="/" className="atlas-mark" aria-label="OpportunityOS home">
          O<span>OS</span>
        </Link>
        <nav aria-label="Main" className="flex w-full flex-col gap-1">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="nav-link group"
              activeProps={{ className: "nav-link-active" }}
              activeOptions={{ exact: n.to === "/" }}
            >
              <n.icon aria-hidden className="size-4 shrink-0" />
              <span>{n.label}</span>
              {n.to === "/journey" && applications.length > 0 && (
                <span className="atlas-count">{applications.length}</span>
              )}
            </Link>
          ))}
        </nav>
        <Link to="/add" className="nav-link group mt-3" aria-label="Add opportunity">
          <FilePlus2 aria-hidden className="size-4 shrink-0" />
          <span>Add new</span>
        </Link>
        <Link
          to="/tracker-io"
          className="nav-link group"
          activeProps={{ className: "nav-link-active" }}
          aria-label="Import or export CSV"
        >
          <FolderSearch2 aria-hidden className="size-4 shrink-0" />
          <span>Import / export</span>
        </Link>
        <p className="atlas-local-note mt-auto" title="Data stays in this browser">
          LOCAL
        </p>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
        <header className="atlas-mobile-header flex items-center justify-between border-b border-border bg-sidebar px-4 py-3 md:hidden">
          <Link to="/" className="font-display text-xl font-black">
            Opportunity<span className="text-primary">OS</span>
          </Link>
          <Link to="/add" className="btn btn-outline btn-sm">
            Add <ArrowUpRight aria-hidden className="size-3" />
          </Link>
        </header>
        {error && (
          <div
            role="alert"
            className="m-4 flex items-start justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm"
          >
            <span>{error}</span>
            <button className="btn btn-ghost btn-sm" onClick={dismissError}>
              Dismiss
            </button>
          </div>
        )}
        <main
          id="main"
          className="mx-auto w-full max-w-[1500px] flex-1 overflow-hidden px-4 py-7 md:px-8 md:py-8 xl:px-12"
        >
          {children}
        </main>
      </div>
      <nav
        aria-label="Main mobile"
        className="atlas-mobile-nav fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-border bg-sidebar md:hidden"
      >
        {NAV.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            className="mobile-nav-link"
            activeProps={{ className: "mobile-nav-active" }}
            activeOptions={{ exact: n.to === "/" }}
          >
            <n.icon aria-hidden className="mx-auto mb-1 size-4" />
            <span>{n.mobileLabel}</span>
          </Link>
        ))}
      </nav>
      <CompareTray />
    </div>
  );
}
