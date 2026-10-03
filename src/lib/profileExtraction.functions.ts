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

const webSchema = z.object({
  url: z
    .string()
    .trim()
    .url()
    .max(500)
    .refine((value) => /^https?:\/\//i.test(value), "Only http(s) links"),
  label: z.enum(["linkedin", "github", "website", "web"]),
  // The student must confirm the link is their own and agree to it being read.
  consent: z.literal(true),
});

export const extractWebProfile = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => webSchema.parse(input))
  .handler(async ({ data }) => {
    const request = getRequest();
    const { extractWebSource } = await import("./webProfileSource.server");
    return extractWebSource(
      { url: data.url, label: data.label },
      request?.signal,
      request?.headers.get("X-Lovable-AIG-Run-ID") ?? undefined,
    );
  });
