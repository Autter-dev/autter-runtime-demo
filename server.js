/**
 * Plain Express demo app. No telemetry is wired in yet.
 *
 * See README.md for how to add Autter Runtime to this app.
 */
import { fileURLToPath } from "node:url";
import express from "express";

const app = express();
app.use(express.json());
app.use(express.static(fileURLToPath(new URL("./public", import.meta.url))));

app.get("/healthz", (_req, res) => res.send("ok"));
app.get("/api/ok", (_req, res) => res.json({ ok: true }));

app.get("/api/users/:id", (req, res) => {
  res.json({ id: req.params.id });
});

app.get("/api/slow", async (_req, res) => {
  await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 1200));
  res.json({ ok: true, slow: true });
});

app.get("/api/flaky", (_req, res, next) => {
  if (Math.random() < 0.5) return next(new Error("flaky upstream timeout"));
  res.json({ ok: true });
});

app.get("/api/boom", () => {
  throw new TypeError("cannot read properties of undefined (reading 'total')");
});

app.post("/api/checkout", (req, res) => {
  if (req.query.declined !== undefined) {
    return res.status(402).json({ error: { message: "Payment declined" } });
  }
  if (req.query.sku) {
    return res.status(409).json({ error: { message: `Item ${req.query.sku} is out of stock` } });
  }
  res.json({ ok: true, items: req.body?.items ?? 0 });
});

// Last: turn any error into a JSON response instead of an HTML stack trace.
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: { message: "Internal server error" } });
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`demo app on http://localhost:${port}`);
});
