import { App, ExpressAdapter } from "@microsoft/teams.apps";
import { Client as ApiClient } from "@microsoft/teams.api";
import { ConsoleLogger } from "@microsoft/teams.common/logging";
import express from "express";

const apiBaseUrl = process.env.API_BASE_URL;
const internalApiKey = process.env.INTERNAL_API_KEY;

const adapter = new ExpressAdapter();
const app = new App({
  logger: new ConsoleLogger("bot", { level: "debug" }),
  httpServerAdapter: adapter,
  // Only skip Teams' own activity signature validation for local dev, where there is no real
  // Azure Bot registration (and therefore no CLIENT_ID/CLIENT_SECRET) to validate against.
  dangerouslyAllowUnauthenticatedRequests: process.env.SKIP_AUTH === "true",
});

// Fired once when the bot is added to a team. The app is single-tenant, so capturing this once
// is enough to later message any channel in that tenant (see POST /internal/messages below).
app.on("install.add", async (ctx) => {
  if (ctx.activity.conversation.conversationType !== "channel") {
    return; // only team-scope installs matter for channel reminders
  }

  const tenantId = ctx.activity.conversation.tenantId ?? ctx.activity.channelData?.tenant?.id;
  const serviceUrl = ctx.activity.serviceUrl;
  if (!tenantId || !serviceUrl || !apiBaseUrl || !internalApiKey) {
    app.log.warn("install.add: missing tenantId/serviceUrl/API config, not saved", { tenantId, serviceUrl });
    return;
  }

  const response = await fetch(`${apiBaseUrl}/internal/bot-installation`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Internal-Api-Key": internalApiKey },
    body: JSON.stringify({ tenantId, serviceUrl }),
  });
  if (!response.ok) {
    app.log.error(`install.add: failed to save bot installation (${response.status})`);
  }
});

// Called by the API when an admin sends a reminder. Not a Teams activity – a plain internal
// route on the same HTTP server, guarded by the shared secret instead of a Teams SSO token.
adapter.post("/internal/messages", express.json(), async (req, res) => {
  if (req.headers["x-internal-api-key"] !== internalApiKey) {
    res.sendStatus(401);
    return;
  }

  const { serviceUrl, tenantId, channelId, text } = req.body as {
    serviceUrl: string;
    tenantId: string;
    channelId: string;
    text: string;
  };

  try {
    const client = new ApiClient(
      serviceUrl,
      app.client.clone({ token: async () => (await app.tokenProvider.getAppToken())?.toString() }),
    );
    await client.conversations.create({
      tenantId,
      channelData: { channel: { id: channelId } },
      activity: { type: "message", text },
    });
    res.sendStatus(200);
  } catch (err) {
    app.log.error("Failed to send channel message", err);
    res.sendStatus(502);
  }
});

// 3979 is taken by the tab's own (deprecated) DevtoolsPlugin, which defaults to the tab's
// port + 1 (3978 + 1) – pick a different port here to avoid colliding with it in local dev.
app.start(process.env.PORT ? Number(process.env.PORT) : 3981);
