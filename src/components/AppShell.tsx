import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowUpRight,
  Compass,
  FilePlus2,
  FolderSearch2,
  Orbit,
  Route as RouteIcon,
  Search,
  UserRound,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { CompareTray } from "./CompareTray";
import { CommandCenter } from "./CommandCenter";
import { AmbientField } from "./motion/AmbientField";
import { VibeCursor } from "./motion/VibeCursor";
import { spring } from "@/lib/motion";

const NAV = [
  { to: "/", label: "Home", mobileLabel: "Home", icon: Orbit },
  { to: "/search", label: "Search", mobileLabel: "Search", icon: Search },
  { to: "/discover", label: "Browse", mobileLabel: "Browse", icon: Compass },
  { to: "/journey", label: "Journey", mobileLabel: "Journey", icon: RouteIcon },
  { to: "/tracker", label: "Tracker", mobileLabel: "Tracker", icon: FolderSearch2 },
  { to: "/passport", label: "Passport", mobileLabel: "Passport", icon: UserRound },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { error, dismissError, applications } = useStore();
  const location = useRouterState({ select: (state) => state.location });
  const pathname = location.pathname;
  const cinema = isCinema(pathname, location.search);
  const reduced = useReducedMotion();
  const bleed = pathname === "/" || cinema;
  const atmosphere = pathname === "/" || cinema ? "campaign" : "paper";

  return (
    <div
      className="atlas-shell min-h-screen md:flex"
      data-route={pathname}
      data-atmosphere={atmosphere}
      {...(cinema ? { "data-cinema": "true" } : {})}
    >
      <AmbientField />
      {atmosphere === "campaign" && (
        <>
          <div className="atlas-grain" aria-hidden />
          <VibeCursor />
        </>
      )}
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <aside className="atlas-rail hidden shrink-0 flex-col md:flex md:sticky md:top-0 md:h-screen">
        <Link to="/" className="atlas-mark" aria-label="Sourced home">
          <b aria-hidden>S</b>
          <span>
            Sourc<em>ed</em>
          </span>
        </Link>
        <nav aria-label="Main" className="flex w-full flex-col gap-0.5">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="nav-link group"
              activeProps={{ className: "nav-link-active" }}
              activeOptions={{ exact: n.to === "/" }}
            >
              <n.icon aria-hidden className="size-4" />
              <span>{n.label}</span>
              {n.to === "/journey" && applications.length > 0 && (
                <span className="atlas-count">{applications.length}</span>
              )}
            </Link>
          ))}
        </nav>
        <Link to="/add" className="nav-link group mt-4" aria-label="Add opportunity">
          <FilePlus2 aria-hidden className="size-4" />
          <span>Add new</span>
        </Link>
        <Link
          to="/tracker-io"
          className="nav-link group"
          activeProps={{ className: "nav-link-active" }}
          aria-label="Import or export CSV"
        >
          <FolderSearch2 aria-hidden className="size-4" />
          <span>Import / export</span>
        </Link>
        <p className="atlas-local-note mt-auto" title="Data stays in this browser">
          Local only
        </p>
      </aside>

      <CommandCenter />

      <div
        className={`atlas-atmosphere atlas-atmosphere-${atmosphere} relative z-1 flex min-w-0 flex-1 flex-col pb-20 md:pb-0`}
      >
        <header className="atlas-mobile-header sticky top-0 z-30 flex items-center justify-between border-b border-border px-4 py-3 md:hidden">
          <Link to="/" className="font-display text-lg">
            Sourc<em className="text-acid">ed</em>
          </Link>
          <Link to="/add" className="btn btn-outline btn-sm">
            Add <ArrowUpRight aria-hidden className="size-3" />
          </Link>
        </header>

        {error && (
          <div
            role="alert"
            className="m-4 flex items-start justify-between gap-3 border border-destructive/50 bg-destructive/10 p-3 text-sm"
          >
            <span>{error}</span>
            <button className="btn btn-ghost btn-sm" onClick={dismissError}>
              Dismiss
            </button>
          </div>
        )}

        <main
          id="main"
          className={
            bleed
              ? "w-full flex-1"
              : "mx-auto w-full max-w-[1480px] flex-1 px-4 py-8 md:px-8 md:py-10 xl:px-12"
          }
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pathname}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 14, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: -10, filter: "blur(6px)" }}
              transition={reduced ? { duration: 0.15 } : spring.settle}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <nav
        aria-label="Main mobile"
        className="atlas-mobile-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-border md:hidden"
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

function isCinema(pathname: string, search: unknown) {
  if (pathname !== "/search") return false;
  if (search && typeof search === "object" && "demo" in search) {
    return Boolean((search as { demo?: boolean }).demo);
  }
  return false;
}
