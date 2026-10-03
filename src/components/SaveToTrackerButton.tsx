import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { saveToTracker } from "@/lib/tracker.functions";
import type { Opportunity } from "@/domain/types";

/**
 * Saves a listing to the account-backed Tracker (status "Saved").
 * Idempotent: pressing again never creates a duplicate. Signed-out users get
 * a sign-in prompt; the browser-local My Journey save stays separate.
 */
export function SaveToTrackerButton({ opp }: { opp: Opportunity }) {
  const [state, setState] = useState<"loading" | "signedOut" | "ready" | "saved">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }: { data: { session: unknown } }) => {
      if (alive) setState(data.session ? "ready" : "signedOut");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === "SIGNED_IN") setState("ready");
      if (event === "SIGNED_OUT") setState("signedOut");
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (state === "loading") return null;
  if (state === "signedOut") {
    return (
      <Link
        to="/auth"
        className="btn btn-outline btn-sm"
        title="Sign in to save to your account Tracker"
      >
        Save to Tracker
      </Link>
    );
  }

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await saveToTracker({
        data: { listingId: opp.id, company: opp.organization, role: opp.title },
      });
      setState("saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex flex-col">
      <button
        className="btn btn-outline btn-sm"
        disabled={busy || state === "saved"}
        onClick={save}
      >
        {state === "saved" ? "✓ In Tracker" : busy ? "Saving…" : "Save to Tracker"}
      </button>
      {error && (
        <span role="alert" className="field-error mt-1 text-xs">
          {error}
        </span>
      )}
    </span>
  );
}
