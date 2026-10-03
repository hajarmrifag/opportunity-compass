import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { markApplied } from "@/lib/tracker.functions";
import { safeHttpUrl } from "@/lib/validation";
import type { Opportunity } from "@/domain/types";

/**
 * Opens the listing's own page and, when signed in, records the application
 * as Submitted in the Tracker so its count updates straight away.
 */
export function ApplyButton({ opp }: { opp: Opportunity }) {
  const url = safeHttpUrl(opp.applyUrl) ?? safeHttpUrl(opp.sourceUrl);
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  if (!url) return null;

  const onClick = async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      setNote("Sign in to have this counted in your Tracker.");
      return;
    }
    try {
      await markApplied({
        data: { listingId: opp.id, company: opp.organization || "Unknown", role: opp.title },
      });
      queryClient.invalidateQueries({ queryKey: ["tracker-applications"] });
      setNote("Counted as Submitted in your Tracker.");
    } catch (err) {
      setNote(err instanceof Error ? `Not counted: ${err.message}` : "Not counted in Tracker.");
    }
  };

  return (
    <span className="inline-flex flex-col">
      <a
        className="btn btn-sm"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
      >
        Apply ↗
      </a>
      {note && (
        <span role="status" className="mt-1 text-xs text-muted-foreground">
          {note}
        </span>
      )}
    </span>
  );
}
