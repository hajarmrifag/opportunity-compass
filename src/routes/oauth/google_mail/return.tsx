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
      window.opener?.postMessage(
        { type, connectorId: "google_mail", code: code ?? null },
        window.location.origin,
      );
      window.close();
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
