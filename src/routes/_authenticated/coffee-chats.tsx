import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listCoffeeChats } from "@/lib/tracker.functions";
import { CoffeeChatRow } from "@/features/tracker/CoffeeChatRow";
import { Loading, PageHeader } from "@/components/ui-bits";

export const Route = createFileRoute("/_authenticated/coffee-chats")({
  head: () => ({
    meta: [
      { title: "Coffee chat history — OpportunityOS" },
      {
        name: "description",
        content: "Every coffee chat you've logged, with outcomes, follow-ups and referrals.",
      },
      { property: "og:title", content: "Coffee chat history — OpportunityOS" },
      {
        property: "og:description",
        content: "Every coffee chat you've logged, with outcomes, follow-ups and referrals.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CoffeeChatsPage,
});

function CoffeeChatsPage() {
  const queryClient = useQueryClient();
  const chatsQuery = useQuery({
    queryKey: ["coffee-chats"],
    queryFn: () => listCoffeeChats(),
    refetchInterval: 15_000,
  });
  const chats = chatsQuery.data ?? [];
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["coffee-chats"] });

  if (chatsQuery.isLoading) return <Loading />;
  return (
    <>
      <PageHeader
        title="Coffee chat history"
        sub="Update outcomes, follow-up dates, referrals and comments. Changes save to your account."
        right={
          <Link to="/tracker" className="btn btn-ghost">
            ← Back to Tracker
          </Link>
        }
      />
      {chatsQuery.error && (
        <p role="alert" className="field-error mb-4">
          Could not load coffee chats: {(chatsQuery.error as Error).message}
        </p>
      )}
      {chats.length === 0 ? (
        <p className="text-muted-foreground">
          No coffee chats yet.{" "}
          <Link to="/tracker" className="underline">
            Add one on the Tracker
          </Link>
          .
        </p>
      ) : (
        <ul className="space-y-3">
          {chats.map((c) => (
            <CoffeeChatRow key={c.id} chat={c} onChanged={refresh} />
          ))}
        </ul>
      )}
    </>
  );
}
