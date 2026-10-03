import { createServerFn } from "@tanstack/react-start";
import { liveSearchInput } from "./liveSearchMapping";

export const liveSearch = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => liveSearchInput.parse(data))
  .handler(async ({ data }) => {
    const { runLiveSearch } = await import("./liveSearch.server");
    const { getRequest } = await import("@tanstack/react-start/server");
    // Client Cancel aborts the HTTP request; forward that to the provider call.
    return runLiveSearch(data, getRequest()?.signal);
  });

export const liveSearchStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { isConfigured } = await import("./liveSearch.server");
  return { configured: isConfigured() };
});
