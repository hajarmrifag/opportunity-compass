import { Link } from "@tanstack/react-router";
import { Scale, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";

export function CompareTray() {
  const { compareIds, getOpportunity, removeCompare, clearCompare } = useStore();
  if (compareIds.length === 0) return null;
  return (
    <aside
      aria-label="Comparison shortlist"
      className="atlas-compare-tray fixed inset-x-3 bottom-20 z-30 mx-auto max-w-3xl border border-foreground bg-acid p-3 md:bottom-5"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Scale className="size-4 shrink-0" /> Compare {compareIds.length}/3
          </p>
          <div className="mt-1 flex min-w-0 gap-2 overflow-x-auto">
            {compareIds.map((id) => (
              <span key={id} className="chip chip-muted max-w-48">
                <span className="truncate">{getOpportunity(id)?.title ?? "Unavailable item"}</span>
                <button
                  aria-label={`Remove ${getOpportunity(id)?.title ?? "item"} from comparison`}
                  onClick={() => removeCompare(id)}
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
        <div className="atlas-compare-actions flex shrink-0 gap-2">
          <Button variant="ghost" size="sm" onClick={clearCompare}>
            Clear
          </Button>
          <Button asChild size="sm">
            <Link to="/compare">Compare</Link>
          </Button>
        </div>
      </div>
    </aside>
  );
}
