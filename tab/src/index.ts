import fs from "fs";
import https from "https";
import path from "path";

import { App, ExpressAdapter, IPlugin } from "@microsoft/teams.apps";
import { ConsoleLogger } from "@microsoft/teams.common/logging";
import { DevtoolsPlugin } from "@microsoft/teams.dev";

const sslOptions = {
  key: process.env.SSL_KEY_FILE ? fs.readFileSync(process.env.SSL_KEY_FILE) : undefined,
  cert: process.env.SSL_CRT_FILE ? fs.readFileSync(process.env.SSL_CRT_FILE) : undefined,
};

// Workaround for SDK bug in v2.0.6+: ExpressAdapter uses `instanceof http.Server`
// which fails for https.Server (extends tls.Server, not http.Server).
// Fix: create the adapter, then replace its internal http.Server with our https.Server.
const adapter = new ExpressAdapter();
if (sslOptions.cert && sslOptions.key) {
  const httpsServer = https.createServer(sslOptions, (adapter as any).express);
  (adapter as any).server = httpsServer;
}

// Only use DevtoolsPlugin locally — it crashes on Azure App Service
// because it calls parseInt() on the named pipe PORT value.
const plugins: IPlugin[] = [];
if (process.env.SSL_KEY_FILE) {
  plugins.push(new DevtoolsPlugin());
}
const app = new App({
  logger: new ConsoleLogger("tab", { level: "debug" }),
  plugins: plugins,
  httpServerAdapter: adapter,
  skipAuth: true,
});

const clientDir = path.join(__dirname, "./client");
app.tab("home", clientDir);

// The config page is a client-side route of the same SPA – serve its entry point for that path too.
(adapter as any).express.get("/tabs/home/config", (_req: any, res: any) =>
  res.sendFile(path.join(clientDir, "index.html")),
);

(async () => {
  await app.start(process.env.PORT || 3978);
})();
