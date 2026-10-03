import { useEffect, useState } from "react";
import {
  COFFEE_CHAT_OUTCOMES,
  deleteCoffeeChat,
  saveCoffeeChat,
  type CoffeeChat,
} from "@/lib/tracker.functions";

export const OUTCOME_LABEL: Record<string, string> = {
  planned: "Planned",
  responded: "Responded",
  ghosted: "Ghosted",
  follow_up_ghosted: "Followed up, then ghosted",
  successful_referral: "Successful referral",
};

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** A full yyyy-mm-dd date (date inputs emit partial/odd years while typing). */
function isCompleteDate(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && Number(v.slice(0, 4)) >= 1900;
}

export function CoffeeChatRow({ chat, onChanged }: { chat: CoffeeChat; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const today = todayIso();

  // Local copies so typing / saving never wipes what the user just entered.
  const [followUp, setFollowUp] = useState(chat.follow_up_date ?? "");
  const [outcome, setOutcome] = useState<string>(chat.outcome);
  const [referral, setReferral] = useState<boolean | null>(chat.referral ?? null);
  const [comment, setComment] = useState(chat.notes);
  const [aiNote, setAiNote] = useState(false);

  useEffect(() => setFollowUp(chat.follow_up_date ?? ""), [chat.follow_up_date]);
  useEffect(() => setOutcome(chat.outcome), [chat.outcome]);
  useEffect(() => setReferral(chat.referral ?? null), [chat.referral]);

  const overdue = followUp && isCompleteDate(followUp) && followUp < today;

  const save = async (changes: Partial<CoffeeChat>) => {
    setBusy(true);
    setError("");
    try {
      await saveCoffeeChat({
        data: {
          id: chat.id,
          contact_name: chat.contact_name,
          company: chat.company,
          date: chat.date,
          follow_up_date: isCompleteDate(followUp) ? followUp : null,
          notes: comment,
          outcome,
          referral,
          ...changes,
        } as never,
      });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const commitFollowUp = (v: string) => {
    if (v === "") {
      if (chat.follow_up_date) save({ follow_up_date: null });
      return;
    }
    if (isCompleteDate(v) && v !== chat.follow_up_date) save({ follow_up_date: v });
  };

  return (
    <li className={`card p-4 ${overdue ? "border-destructive/50" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{chat.contact_name}</p>
          <p className="text-sm text-muted-foreground">
            {chat.company || "No company"}
            {chat.date ? ` · Chatted ${chat.date}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor={`cc-out-${chat.id}`}>Outcome</label>
            <select
              id={`cc-out-${chat.id}`}
              value={outcome}
              onChange={(e) => {
                setOutcome(e.target.value);
                save({ outcome: e.target.value as never });
              }}
            >
              <option value="">—</option>
              {COFFEE_CHAT_OUTCOMES.map((o) => (
                <option key={o} value={o}>
                  {OUTCOME_LABEL[o]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`cc-fu-${chat.id}`}>Follow-up date</label>
            <input
              id={`cc-fu-${chat.id}`}
              type="date"
              value={followUp}
              onChange={(e) => {
                setFollowUp(e.target.value);
                // Picking from the calendar gives a full date — save straight away.
                if (isCompleteDate(e.target.value) || e.target.value === "")
                  commitFollowUp(e.target.value);
              }}
              onBlur={(e) => commitFollowUp(e.target.value)}
            />
          </div>
        </div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[10rem_1fr]">
        <div>
          <label htmlFor={`cc-ref-${chat.id}`}>Referral?</label>
          <select
            id={`cc-ref-${chat.id}`}
            value={referral === true ? "yes" : referral === false ? "no" : ""}
            onChange={(e) => {
              const v = e.target.value === "" ? null : e.target.value === "yes";
              setReferral(v);
              save({ referral: v });
            }}
          >
            <option value="">Not yet</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>
        <div>
          <label htmlFor={`cc-note-${chat.id}`}>Comment</label>
          <textarea
            id={`cc-note-${chat.id}`}
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onBlur={() => comment !== chat.notes && save({ notes: comment })}
            placeholder="How did it go? AI can analyse this later."
          />
          <button
            type="button"
            className="mt-1 text-xs underline"
            onClick={() => setAiNote((v) => !v)}
          >
            Analyse with AI
          </button>
          {aiNote && (
            <p role="status" className="mt-1 text-xs text-muted-foreground">
              AI comment analysis isn't connected yet — your comment is saved and will be analysed
              once it is.
            </p>
          )}
        </div>
      </div>
      {overdue && (
        <p className="mt-2 text-xs text-destructive">Follow-up overdue since {followUp}</p>
      )}
      <div className="mt-2 flex items-center justify-between">
        {busy && <span className="text-xs text-muted-foreground">Saving…</span>}
        {error && (
          <span role="alert" className="field-error">
            {error}
          </span>
        )}
        <button
          className="ml-auto text-xs underline hover:text-destructive"
          disabled={busy}
          onClick={async () => {
            if (!confirm("Remove this coffee chat?")) return;
            setBusy(true);
            try {
              await deleteCoffeeChat({ data: { id: chat.id } });
              onChanged();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not remove.");
            } finally {
              setBusy(false);
            }
          }}
        >
          Remove
        </button>
      </div>
    </li>
  );
}
