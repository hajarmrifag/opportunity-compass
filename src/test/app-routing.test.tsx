import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { routeTree } from "@/routeTree.gen";

async function renderAt(path: string) {
  const queryClient = new QueryClient();
  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  // Resolve matches first, as SSR does before the shell is streamed; otherwise the
  // document-level shell mounts before any route match exists and paints an empty body.
  await router.load();
  // The root route's shellComponent renders <html>/<head>/<body>, as in production SSR.
  // Mount into the document itself (React 19 supports document as a root) instead of
  // nesting <html> inside a <div>, which React refuses to render.
  return render(<RouterProvider router={router} />, {
    container: document as unknown as HTMLElement,
    baseElement: document.documentElement,
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// Assert only that the router mounts and paints, never page content:
// routes are rewritten as the app is built and this must keep passing.
describe("App routing", () => {
  it("renders the index route", async () => {
    const { container } = await renderAt("/");

    await waitFor(() => expect(container.firstChild).not.toBeNull());
    await waitFor(() => expect(document.body.querySelector("main")).not.toBeNull());
  });

  it("renders the not-found route", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const { container } = await renderAt("/this-route-does-not-exist");

    await waitFor(() => expect(container.firstChild).not.toBeNull());
    await waitFor(() => expect(document.body.textContent).toContain("Page not found"));
  });
});
