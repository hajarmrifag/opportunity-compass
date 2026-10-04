import { createFileRoute } from "@tanstack/react-router";
import { PlanSelfCheckPage } from "@/features/plan/PlanPages";

export const Route = createFileRoute("/plan-tests")({
  head: () => ({
    meta: [
      { title: "Plan self-check · Sourced" },
      {
        name: "description",
        content: "Internal self-check results for the application plan and CV studio.",
      },
      { property: "og:title", content: "Plan self-check · Sourced" },
      {
        property: "og:description",
        content: "Internal self-check results for the application plan and CV studio.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlanSelfCheckPage,
});
