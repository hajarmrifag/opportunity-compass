import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/oauth/google_mail/return")({
  head: () => ({
    meta: [{ title: "Connecting Gmail — OpportunityOS" }],
  }),
  component: OAuthReturn,
});

function OAuthReturn() {
  const [message, setMessage] = useState("Finishing connection…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const notifyOpenerAndClose = (
      type: "appUserConnectorOAuthComplete" | "appUserConnectorOAuthFailed",
      code?: string,
    ) => {
      const payload = { type, connectorId: "google_mail", code: code ?? null };
      try {
        window.opener?.postMessage(payload, window.location.origin);
      } catch {
        /* opener unreachable */
      }
      const channel =
        typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("gmail-oauth") : null;
      let acked = false;
      if (channel) {
        channel.onmessage = (e) => {
          if (e.data?.type === "ack") {
            acked = true;
            window.close();
          }
        };
        channel.postMessage(payload);
      }
      if (window.opener) window.close();
      // If nothing picked it up, finish here on the Tracker instead of hanging.
      window.setTimeout(() => {
        if (acked) return;
        if (type === "appUserConnectorOAuthComplete" && code) {
          window.location.replace(`/tracker?gmail_code=${encodeURIComponent(code)}`);
        } else if (type === "appUserConnectorOAuthComplete") {
          window.location.replace("/tracker");
        }
      }, 2000);
    };
    if (params.get("success") !== "true") {
      setMessage(params.get("error") ?? "The Gmail connection did not complete.");
      notifyOpenerAndClose("appUserConnectorOAuthFailed");
      return;
    }
    const code = params.get("code");
    if (!code) {
      if (params.get("offline_access_allowed") === "false") {
        notifyOpenerAndClose("appUserConnectorOAuthComplete");
        return;
      }
      setMessage("Gmail connected, but no exchange code came back.");
      notifyOpenerAndClose("appUserConnectorOAuthFailed");
      return;
    }
    notifyOpenerAndClose("appUserConnectorOAuthComplete", code);
  }, []);

  return <p className="p-6 text-sm">{message}</p>;
}
