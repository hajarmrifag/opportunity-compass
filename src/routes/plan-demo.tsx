import { createFileRoute } from "@tanstack/react-router";
import { PlanDemoPage } from "@/features/plan/PlanPages";

export const Route = createFileRoute("/plan-demo")({
  head: () => ({
    meta: [
      { title: "Application plan demo — Source" },
      {
        name: "description",
        content: "A worked example of the application plan for one opportunity.",
      },
      { property: "og:title", content: "Application plan demo — Source" },
      {
        property: "og:description",
        content: "A worked example of the application plan for one opportunity.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlanDemoPage,
});
