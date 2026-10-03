import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { render } from "@testing-library/react";
import { it } from "vitest";
import { routeTree } from "@/routeTree.gen";
it("dbg", async () => {
  const errs: unknown[] = []; const oe = console.error; console.error = (...a) => { errs.push(a.map(String).join(" ").slice(0, 300)); };
  const router = createRouter({ routeTree, context: { queryClient: new QueryClient() }, history: createMemoryHistory({ initialEntries: ["/"] }) });
  const { container } = render(<RouterProvider router={router} />);
  await new Promise((r) => setTimeout(r, 1500));
  console.error = oe;
  console.log("HTML:", container.innerHTML.slice(0, 300), "| DOC:", document.documentElement.outerHTML.slice(0, 400));
  console.log("ERRS:", errs.slice(0, 5));
});
