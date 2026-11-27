/**
 * Demo Express server instrumented with Autter Runtime.
 *
 * Local run (ingester from the autter-runtime repo: `docker compose up`):
 *   npm install
 *   npm start                      # sends to http://localhost:4318 with the built-in local key
 *
 * Against another ingester:
 *   AUTTER_ENDPOINT=https://otlp.autter.dev AUTTER_RUNTIME_KEY=autter_rt_... npm start
 *
 * Open http://localhost:3000 and click the buttons to generate telemetry.
 */
import { fileURLToPath } from "node:url";
import {
  initAutterServer,
  createBrowserRelayHandler,
  autterRequests,
  autterErrorHandler,
  autterErrorResponse,
  defineRuntimeErrors,
  runtimeContext,
} from "@autter/runtime-node";
import express from "express";

// ---- Configuration ---------------------------------------------------------

// Built into the local docker compose ingester; not a secret, works nowhere else.
const LOCAL_ENDPOINT = "http://localhost:4318";
const LOCAL_DEV_KEY = "autter_rt_local_dev_only";

const endpoint = (process.env.AUTTER_ENDPOINT || LOCAL_ENDPOINT).replace(/\/+$/, "");
const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(endpoint);
const apiKey = process.env.AUTTER_RUNTIME_KEY || (isLocal ? LOCAL_DEV_KEY : "");

if (!apiKey) {
  console.error(
    `AUTTER_ENDPOINT is ${endpoint} but AUTTER_RUNTIME_KEY is not set. Set it to a server key (autter_rt_...).`,
  );
  process.exit(1);
}
if (apiKey === LOCAL_DEV_KEY && !isLocal) {
  console.error(`${LOCAL_DEV_KEY} only works with the local ingester, not ${endpoint}.`);
  process.exit(1);
}

console.log(`Sending telemetry to ${endpoint}`);

// Last-resort guard so a stray rejection is logged instead of killing the demo.
process.on("unhandledRejection", (reason) => {
  console.error("[demo] unhandled promise rejection:", reason);
});

// ---- Autter Runtime (must run before other app imports open connections) ---

let lastExportError = null;

const runtime = initAutterServer({
  apiKey,
  endpoint,
  service: "autter-runtime-demo",
  environment: "development",
  release: process.env.GIT_SHA ?? "dev",
  traceSampleRate: 1,
  onExportError: (error) => {
    lastExportError = {
      kind: error.kind,
      status: error.status,
      message: error.message,
      at: new Date().toISOString(),
    };
  },
});

// Coded errors: one code = one issue.
const checkoutErrors = defineRuntimeErrors("checkout", {
  card_declined: {
    status: 402,
    message: "Payment declined",
    expected: true,
    why: "The card issuer rejected the charge",
    fix: "Ask the customer for another card",
  },
  out_of_stock: ({ sku }) => ({
    status: 409,
    message: `Item ${sku} is out of stock`,
    fix: "Remove the item or wait for restock",
  }),
});

// ---- App -------------------------------------------------------------------

const app = express();
app.use(express.json());

// One request summary per request; health checks are skipped.
app.use(autterRequests({ ignore: ["/healthz"] }));

app.use(express.static(fileURLToPath(new URL("./public", import.meta.url))));

// Browser SDK bundle, served from the installed package.
app.use(
  "/vendor",
  express.static(fileURLToPath(new URL("./node_modules/@autter/runtime-browser/dist", import.meta.url))),
);

// Same-origin relay: the browser posts here, the server key stays server-side.
app.post("/api/autter-runtime", createBrowserRelayHandler({ apiKey, endpoint }));

app.get("/healthz", (_req, res) => res.send("ok"));
app.get("/api/ok", (_req, res) => res.json({ ok: true }));
app.get("/api/telemetry-status", (_req, res) => res.json({ lastExportError }));

// Param route: recorded as one template, not one row per id.
app.get("/api/users/:id", (req, res) => {
  runtimeContext.set({ user: { id: req.params.id } });
  res.json({ id: req.params.id, requestId: runtimeContext.requestId });
});

// Coded errors: 402 / 409 responses with code, why, fix and requestId.
app.post("/api/checkout", (req, res, next) => {
  runtimeContext.set({ cart: { items: req.body?.items ?? 0 } });
  runtimeContext.info("Validating cart");
  if (req.query.declined !== undefined) return next(checkoutErrors.card_declined());
  if (req.query.sku) return next(checkoutErrors.out_of_stock({ sku: String(req.query.sku) }));
  runtimeContext.outcome("succeeded");
  res.json({ ok: true, requestId: runtimeContext.requestId });
});

// A plain unhandled bug: recorded with its stack.
app.get("/api/boom", () => {
  throw new TypeError("cannot read properties of undefined (reading 'total')");
});

// Slow route: useful for latency charts.
app.get("/api/slow", async (_req, res) => {
  await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 1200));
  res.json({ ok: true, slow: true });
});

// Random failures, to see error rates move.
app.get("/api/flaky", (_req, res, next) => {
  if (Math.random() < 0.5) return next(new Error("flaky upstream timeout"));
  res.json({ ok: true });
});

// After the routes: report coded and 4xx errors too, then pass through.
app.use(autterErrorHandler());
// Last: client-safe JSON responses (never leaks internal details).
app.use(autterErrorResponse());

// ---- Start -----------------------------------------------------------------

const port = Number(process.env.PORT) || 3000;
const server = app.listen(port, () => {
  console.log(`demo app on http://localhost:${port}`);
});

// Graceful shutdown: stop accepting requests, flush buffered telemetry, exit.
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (stopping) process.exit(1);
    stopping = true;
    server.close();
    const force = setTimeout(() => process.exit(1), 10_000);
    force.unref();
    runtime.shutdown().finally(() => process.exit(0));
  });
}
