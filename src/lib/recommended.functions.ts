import { createServerFn } from "@tanstack/react-start";
import { recommendedInput } from "./recommended";

export const getRecommended = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => recommendedInput.parse(data))
  .handler(async ({ data }) => {
    const { runRecommended } = await import("./recommended.server");
    const { getRequest } = await import("@tanstack/react-start/server");
    // Client Cancel aborts the HTTP request; forward that to the provider calls.
    return runRecommended(data, getRequest()?.signal);
  });
