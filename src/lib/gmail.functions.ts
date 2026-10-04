// Per-student Gmail connection and inbox scanning for the Tracker.
// Each signed-in student connects their own Gmail (App User Connector flow);
// the connection key is stored encrypted server-side, never in the browser.
// Scanning only ever PROPOSES updates as email_suggestions — the student
// accepts or dismisses each one; nothing changes automatically.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  appUserReconnectRequired,
  authorizeAppUserOAuth,
  callAsAppUser,
  disconnectAppUser,
  exchangeAppUserOAuthCode,
} from "@/integrations/lovable/appUserConnector";
import {
  deleteConnectionKeyForUser,
  getConnectionKeyForUser,
  saveConnectionKeyForUser,
} from "@/server/appUserConnections.server";

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
const CONNECTOR_ID = "google_mail";
export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/gmail.readonly",
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

function clientKey(): string {
  const key = process.env["GOOGLE_MAIL_APP_USER_CONNECTOR_CLIENT_API_KEY"];
  if (!key) throw new Error("Gmail connection is not configured for this project yet.");
  return key;
}

/** The connection-key table arrives with a staged migration; until it is
 *  applied, treat every lookup as "not connected" instead of erroring. */
async function safeGetKey(userId: string): Promise<string | null> {
  try {
    return await getConnectionKeyForUser(userId, CONNECTOR_ID);
  } catch {
    return null;
  }
}

export const startGmailConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ authorizationUrl: string }> => {
    const request = getRequest();
    if (!request) throw new Error("Gmail connect must start from an app request.");
    const url = new URL(request.url);
    const sandboxHost =
      url.hostname === "localhost" ? request.headers.get("x-forwarded-host") : null;
    const returnUrl = new URL(
      "/oauth/google_mail/return",
      sandboxHost ? `https://${sandboxHost}` : url.origin,
    ).toString();

    const connectionAPIKey = await safeGetKey(context.userId);
    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectorId: CONNECTOR_ID,
      appUserId: context.userId,
      clientAPIKey: clientKey(),
      returnUrl,
      connectionAPIKey: connectionAPIKey ?? undefined,
      credentialsConfiguration: { scopes: GMAIL_SCOPES },
    });
    return { authorizationUrl };
  });

export const completeGmailConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ code: z.string().min(1) }).parse(data))
  .handler(async ({ context, data }) => {
    const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(
      GATEWAY_BASE_URL,
      data.code,
    );
    if (connectorId !== CONNECTOR_ID) {
      throw new Error("OAuth completion returned the wrong connector");
    }
    await saveConnectionKeyForUser(context.userId, connectorId, connectionAPIKey);
    return { ok: true };
  });

export interface GmailStatus {
  connected: boolean;
  reconnectRequired?: boolean | undefined;
  /** Email address of the connected inbox, when connected. */
  inboxEmail?: string | undefined;
}

export const gmailStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GmailStatus> => {
    const connectionAPIKey = await safeGetKey(context.userId);
    if (!connectionAPIKey) return { connected: false };
    const res = await callAsAppUser({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectionAPIKey,
      connectorId: CONNECTOR_ID,
      path: "/gmail/v1/users/me/profile",
      requiredScopes: GMAIL_SCOPES,
    });
    if (await appUserReconnectRequired(res)) {
      return { connected: false, reconnectRequired: true };
    }
    if (!res.ok) return { connected: false };
    const profile = (await res.json()) as { emailAddress?: string };
    return { connected: true, inboxEmail: profile.emailAddress ?? undefined };
  });

export const disconnectGmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const connectionAPIKey = await safeGetKey(context.userId);
    if (connectionAPIKey) {
      await disconnectAppUser({
        gatewayBaseUrl: GATEWAY_BASE_URL,
        connectionAPIKey,
        connectorId: CONNECTOR_ID,
      });
    }
    await deleteConnectionKeyForUser(context.userId, CONNECTOR_ID);
    return { ok: true };
  });

// --- Scanning ---

interface GmailMessageMeta {
  id: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
}

async function listCandidateMessages(connectionAPIKey: string): Promise<GmailMessageMeta[]> {
  const query =
    "newer_than:60d (subject:(application OR applied OR interview OR assessment OR offer OR rejection OR unfortunately) OR from:(careers OR jobs OR recruiting OR talent OR no-reply))";
  const listRes = await callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectionAPIKey,
    connectorId: CONNECTOR_ID,
    path: `/gmail/v1/users/me/messages?maxResults=20&q=${encodeURIComponent(query)}`,
    requiredScopes: GMAIL_SCOPES,
  });
  if (!listRes.ok) {
    const body = await listRes.text();
    throw new Error(`Gmail search failed [${listRes.status}]: ${body}`);
  }
  const list = (await listRes.json()) as { messages?: { id: string }[] };
  const ids = (list.messages ?? []).slice(0, 20).map((m) => m.id);
  const metas: GmailMessageMeta[] = [];
  for (const id of ids) {
    const res = await callAsAppUser({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectionAPIKey,
      connectorId: CONNECTOR_ID,
      path: `/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
      requiredScopes: GMAIL_SCOPES,
    });
    if (!res.ok) continue;
    const msg = (await res.json()) as {
      id: string;
      snippet?: string;
      payload?: { headers?: { name: string; value: string }[] };
    };
    const header = (name: string) =>
      msg.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
    metas.push({
      id: msg.id,
      from: header("From"),
      subject: header("Subject"),
      date: header("Date"),
      snippet: (msg.snippet ?? "").slice(0, 300),
    });
  }
  return metas;
}

export interface ScanResult {
  connected: boolean;
  reconnectRequired?: boolean;
  message: string;
  found: number;
}

/**
 * Reads recent application-related emails and proposes status updates as
 * email_suggestions rows (state "pending"). Suggestions already stored for a
 * message are never duplicated. Nothing is applied automatically.
 */
export const scanGmailInbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ScanResult> => {
    const connectionAPIKey = await safeGetKey(context.userId);
    if (!connectionAPIKey) {
      return {
        connected: false,
        message: "Connect your Gmail first, then scanning can suggest updates here.",
        found: 0,
      };
    }

    let messages: GmailMessageMeta[];
    try {
      messages = await listCandidateMessages(connectionAPIKey);
    } catch (err) {
      if (err instanceof Error && err.message.includes("[401]")) {
        return {
          connected: false,
          reconnectRequired: true,
          message: "Your Gmail access needs to be renewed. Reconnect and try again.",
          found: 0,
        };
      }
      throw err;
    }
    if (messages.length === 0) {
      return {
        connected: true,
        message: "No application-related emails found in the last 60 days.",
        found: 0,
      };
    }

    const supabase = context.supabase as AnyClient;
    const { data: existing } = await supabase
      .from("email_suggestions")
      .select("gmail_message_id");
    const seen = new Set((existing ?? []).map((r: { gmail_message_id: string }) => r.gmail_message_id));
    const fresh = messages.filter((m) => !seen.has(m.id));
    if (fresh.length === 0) {
      return {
        connected: true,
        message: "No new application emails since the last scan.",
        found: 0,
      };
    }

    const { data: apps } = await supabase.from("applications").select("company, role");
    const appList = (apps ?? []) as { company: string; role: string }[];

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) {
      return {
        connected: true,
        message: "AI reading is not configured in this workspace, so emails can't be interpreted yet.",
        found: 0,
      };
    }

    const { createOpenAI } = await import("@ai-sdk/openai");
    const { generateText } = await import("ai");
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });

    const emailList = fresh
      .map(
        (m, i) =>
          `#${i} id:${m.id}\nFrom: ${m.from}\nSubject: ${m.subject}\nDate: ${m.date}\nSnippet: ${m.snippet}`,
      )
      .join("\n\n");
    const prompt = `You read a student's inbox metadata to spot job/application updates. Their tracked applications: ${JSON.stringify(appList)}. For EACH email below decide if it is about a job, internship, programme or application update (interview invite, assessment, offer, rejection, application confirmation). Ignore newsletters, ads and unrelated mail. Return ONLY JSON: {"items":[{"id":"<email id>","company":"...or null","role":"...or null","type":"confirmation|interview|assessment|offer|rejection|other","confidence":0.0-1.0,"evidence":"short quote from subject/snippet"}]}. Only include emails that are genuine application updates; use null for anything not stated. Emails:\n\n${emailList}`;

    let items: {
      id: string;
      company: string | null;
      role: string | null;
      type: string;
      confidence: number;
      evidence: string;
    }[] = [];
    try {
      const result = await generateText({ model: provider.responses("openai/gpt-6-astra"), prompt });
      const parsed = JSON.parse(result.text.replace(/```json|```/g, "").trim()) as {
        items?: typeof items;
      };
      items = (parsed.items ?? []).filter((item) => fresh.some((m) => m.id === item.id));
    } catch {
      return {
        connected: true,
        message: "The AI couldn't read the emails right now. Try again in a moment.",
        found: 0,
      };
    }

    // Auto-apply: a confident email about exactly one tracked application moves
    // that application forward (never backwards; rejected/withdrawn/offer are
    // final). Anything uncertain stays a pending suggestion for the student.
    const { data: fullApps } = await supabase
      .from("applications")
      .select("id, company, role, status");
    const tracked = (fullApps ?? []) as { id: string; company: string; role: string; status: string }[];

    let inserted = 0;
    let applied = 0;
    for (const item of items) {
      const target = emailTypeToStatus(item.type);
      const match = target && item.confidence >= 0.6 ? matchApplication(tracked, item) : null;
      const canMove = match && target ? isForwardMove(match.status, target) : false;

      const { error } = await supabase.from("email_suggestions").insert({
        kind: "application",
        gmail_message_id: item.id,
        company: item.company,
        role: item.role,
        email_type: item.type,
        confidence: item.confidence,
        evidence: item.evidence?.slice(0, 300) ?? null,
        state: canMove ? "accepted" : "pending",
      });
      if (error) continue;
      inserted += 1;

      if (canMove && match && target) {
        const { error: updErr } = await supabase
          .from("applications")
          .update({ status: target, updated_at: new Date().toISOString() })
          .eq("id", match.id);
        if (!updErr) {
          await supabase
            .from("application_events")
            .insert({ application_id: match.id, status: target, source: "gmail" });
          match.status = target;
          applied += 1;
        }
      }
    }

    const pending = inserted - applied;
    return {
      connected: true,
      message:
        inserted === 0
          ? "Checked your inbox. No new application updates."
          : `From your email: ${applied} application${applied === 1 ? "" : "s"} updated automatically${
              pending > 0 ? `, ${pending} possible update${pending === 1 ? "" : "s"} need your review below` : ""
            }.`,
      found: inserted,
    };
  });

const STATUS_RANK: Record<string, number> = {
  saved: 0,
  preparing: 1,
  submitted: 2,
  assessment: 3,
  interview: 4,
  offer: 5,
};

export function emailTypeToStatus(type: string): string | null {
  switch (type) {
    case "confirmation":
      return "submitted";
    case "assessment":
      return "assessment";
    case "interview":
      return "interview";
    case "offer":
      return "offer";
    case "rejection":
      return "rejected";
    default:
      return null;
  }
}

/** Forward-only: final states (offer, rejected, withdrawn) never change. */
export function isForwardMove(current: string, target: string): boolean {
  if (current === "rejected" || current === "withdrawn" || current === "offer") return false;
  if (target === "rejected") return true;
  const c = STATUS_RANK[current];
  const t = STATUS_RANK[target];
  return c !== undefined && t !== undefined && t > c;
}

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Exactly one tracked application must match the company (and role if several). */
export function matchApplication<T extends { company: string; role: string }>(
  apps: T[],
  item: { company: string | null; role: string | null },
): T | null {
  const company = norm(item.company);
  if (company.length < 2) return null;
  const byCompany = apps.filter((a) => {
    const c = norm(a.company);
    return c.length >= 2 && (c.includes(company) || company.includes(c));
  });
  if (byCompany.length === 1) return byCompany[0] ?? null;
  const role = norm(item.role);
  if (!role) return null;
  const byRole = byCompany.filter((a) => {
    const r = norm(a.role);
    return r && (r.includes(role) || role.includes(r));
  });
  return byRole.length === 1 ? (byRole[0] ?? null) : null;
}
