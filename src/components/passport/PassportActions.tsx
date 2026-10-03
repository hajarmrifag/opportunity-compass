import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** Final-page choices: navigate to Recommended, reopen the existing editor, or delete the Passport. */
export function PassportActions({
  canRecommend,
  onEdit,
  onDelete,
}: {
  canRecommend: boolean;
  onEdit: () => void;
  /** Returns an error message on failure; null on success. */
  onDelete: () => string | null;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  return (
    <section aria-label="What next" className="mt-6 grid gap-4 sm:grid-cols-3">
      <div className="border border-border bg-card p-4">
        <h3 className="text-base font-semibold">See recommendations</h3>
        <p className="mt-1 text-sm text-muted-foreground">Opens the Recommended page.</p>
        {canRecommend ? (
          <Button asChild className="mt-3 w-full">
            <Link to="/recommended">
              See recommendations <ArrowRight />
            </Link>
          </Button>
        ) : (
          <>
            <Button className="mt-3 w-full" disabled aria-describedby="rec-hint">
              See recommendations <ArrowRight />
            </Button>
            <p id="rec-hint" className="mt-2 text-xs text-muted-foreground">
              Confirm your Passport first
            </p>
          </>
        )}
      </div>

      <div className="border border-border bg-card p-4">
        <h3 className="text-base font-semibold">Edit profile</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Your answers are kept. Any change must be confirmed again before it is used for matching.
        </p>
        <Button variant="outline" className="mt-3 w-full" onClick={onEdit}>
          <Pencil /> Edit profile
        </Button>
      </div>

      <div className="border border-destructive/40 bg-card p-4">
        <h3 className="text-base font-semibold text-destructive">Delete profile</h3>
        <p className="mt-1 text-sm text-muted-foreground">Removes your Passport from this browser.</p>
        <Button
          variant="destructive"
          className="mt-3 w-full"
          onClick={() => {
            setError("");
            setOpen(true);
          }}
        >
          <Trash2 /> Delete profile
        </Button>
        {error && (
          <p role="alert" className="field-error mt-2">
            {error}
          </p>
        )}
      </div>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent onOpenAutoFocus={(e) => {
          e.preventDefault();
          (document.getElementById("passport-delete-cancel") as HTMLButtonElement | null)?.focus();
        }}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your Passport?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes your confirmed Passport and any unconfirmed draft (name, education,
              skills, languages, preferences, experience, goals), so recommendations are no longer
              made from it. Your saved opportunities, applications, statuses, notes, checklists and
              Compare selections are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel id="passport-delete-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                let failure: string | null;
                try {
                  failure = onDelete();
                } catch (err) {
                  failure = err instanceof Error ? err.message : "Could not delete.";
                }
                if (failure) setError(`Your profile was not deleted: ${failure}`);
              }}
            >
              Delete my profile
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
