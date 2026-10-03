import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { render } from "@testing-library/react";
import { it } from "vitest";
import { routeTree } from "@/routeTree.gen";
it("dbg", async () => {
  const errs: string[] = []; const oe = console.error; console.error = (...a) => { errs.push(a.map(String).join(" ").slice(0, 400)); };
  const router = createRouter({ routeTree, context: { queryClient: new QueryClient() }, history: createMemoryHistory({ initialEntries: ["/"] }) });
  render(<RouterProvider router={router} />, { container: document as unknown as HTMLElement, baseElement: document.documentElement });
  await new Promise((r) => setTimeout(r, 1500));
  console.error = oe;
  console.log("DOC:", document.documentElement.outerHTML.slice(0, 600));
  console.log("ERRS:", JSON.stringify(errs.filter(e=>!e.includes("act(")).slice(0, 4)));
});
