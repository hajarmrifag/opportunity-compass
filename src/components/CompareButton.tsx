import { useState } from "react";
import { Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import type { Opportunity } from "@/domain/types";

export function CompareButton({
  opportunityId,
  opportunity,
}: {
  opportunityId: string;
  opportunity?: Opportunity;
}) {
  const { compareIds, toggleCompare, getOpportunity, addManualOpportunity } = useStore();
  const [message, setMessage] = useState("");
  const selected = compareIds.includes(opportunityId);
  return (
    <div>
      <Button
        type="button"
        size="sm"
        variant={selected ? "secondary" : "outline"}
        aria-pressed={selected}
        onClick={() => {
          if (!selected && opportunity && !getOpportunity(opportunityId))
            addManualOpportunity(opportunity);
          const result = toggleCompare(opportunityId);
          setMessage(result.message ?? "");
        }}
      >
        <Scale /> {selected ? "Comparing" : "Compare"}
      </Button>
      {message && (
        <p role="status" className="mt-1 max-w-64 text-xs text-destructive">
          {message}
        </p>
      )}
    </div>
  );
}
