import { createServerFn } from "@tanstack/react-start";
import { liveSearchInput } from "./liveSearchMapping";

export const agentSearch = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => liveSearchInput.parse(data))
  .handler(async ({ data }) => {
    const { runAgentSearch } = await import("./agentSearch.server");
    const { getRequest } = await import("@tanstack/react-start/server");
    return runAgentSearch(data, getRequest()?.signal);
  });
