import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";

const destinations = [
  { label: "Source", to: "/" },
  { label: "Live search", to: "/search" },
  { label: "Demo listings", to: "/discover" },
  { label: "My Journey", to: "/journey" },
  { label: "Tracker", to: "/tracker" },
  { label: "Opportunity Passport", to: "/passport" },
  { label: "Compare", to: "/compare" },
  { label: "Add opportunity", to: "/add" },
] as const;

export function CommandCenter() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((previous) => !previous);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  const go = (to: (typeof destinations)[number]["to"]) => {
    setOpen(false);
    setQuery("");
    void navigate({ to });
  };
  const runSearch = () => {
    const q = query.trim();
    if (q.length < 2) return;
    setOpen(false);
    setQuery("");
    void navigate({ to: "/search", search: { q } });
  };
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        className="atlas-command-trigger"
        onClick={() => setOpen(true)}
        aria-label="Open command center"
        aria-keyshortcuts="Meta+K Control+K"
      >
        <Search aria-hidden className="size-4" />
        <span>Quick search</span>
        <kbd>⌘ K</kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
      >
        <DialogTitle className="sr-only">Source command center</DialogTitle>
        <DialogDescription className="sr-only">
          Find a page or search for an opportunity.
        </DialogDescription>
        <CommandInput
          autoFocus
          value={query}
          onValueChange={setQuery}
          placeholder="Find a page or describe an opportunity…"
          aria-label="Search commands and opportunities"
        />
        <CommandList className="atlas-command-list">
          <CommandEmpty>No page found. Try searching the web.</CommandEmpty>
          {query.trim().length >= 2 && (
            <CommandGroup heading="Research">
              <CommandItem value={`search web ${query}`} onSelect={runSearch}>
                <Search aria-hidden />
                <span className="truncate">Search web for “{query.trim()}”</span>
                <CommandShortcut>↵</CommandShortcut>
              </CommandItem>
            </CommandGroup>
          )}
          <CommandGroup heading="Go to">
            {destinations.map((destination) => (
              <CommandItem
                key={destination.to}
                value={destination.label}
                onSelect={() => go(destination.to)}
              >
                <ArrowUpRight aria-hidden />
                {destination.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
