import { createServerFn } from "@tanstack/react-start";
import { liveSearchInput } from "./liveSearchMapping";

export const liveSearch = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => liveSearchInput.parse(data))
  .handler(async ({ data, signal }) => {
    const { runLiveSearch } = await import("./liveSearch.server");
    return runLiveSearch(data, signal);
  });

export const liveSearchStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { isConfigured } = await import("./liveSearch.server");
  return { configured: isConfigured() };
});
