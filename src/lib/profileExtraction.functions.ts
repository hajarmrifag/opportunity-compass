import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

const inputSchema = z.object({
  name: z.string().trim().min(1).max(180),
  label: z.enum(["cv", "transcript", "other"]),
  mimeType: z.enum(["application/pdf", "text/plain"]),
  content: z.string().min(1),
});

export const extractProfile = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const request = getRequest();
    const { extractProfileDocument } = await import("./profileExtraction.server");
    return extractProfileDocument(
      data,
      request?.signal,
      request?.headers.get("X-Lovable-AIG-Run-ID") ?? undefined,
    );
  });
