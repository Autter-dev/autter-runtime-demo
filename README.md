# Autter Runtime demo server

A small Express app instrumented with `@autter/runtime-node` (server) and
`@autter/runtime-browser` (page), for trying out Autter Runtime end to end.

## 1. Start the local ingester

From a checkout of the `autter-runtime` repo:

```bash
docker compose up   # ClickHouse + ingester on http://localhost:4318, dashboard on :4319
```

## 2. Run the demo

```bash
npm install
npm start           # http://localhost:3000
```

With no environment variables it sends to `http://localhost:4318` using the
built-in local dev key `autter_rt_local_dev_only`, which only works with that
local ingester.

To send to another ingester, set both:

```bash
AUTTER_ENDPOINT=https://otlp.autter.dev AUTTER_RUNTIME_KEY=autter_rt_... npm start
```

## 3. Check the connection

```bash
npx @autter/runtime-node doctor --endpoint http://localhost:4318 --key autter_rt_local_dev_only
npx @autter/runtime-node verify --endpoint http://localhost:4318 --key autter_rt_local_dev_only
```

## Routes

| Route | What it produces |
| --- | --- |
| `GET /api/ok` | normal request summary |
| `GET /api/users/:id` | param route, recorded as a template |
| `GET /api/slow` | slow request (0.8–2 s) |
| `GET /api/flaky` | 50% failures |
| `GET /api/boom` | unhandled 500 with stack |
| `POST /api/checkout?declined=1` | coded error 402 |
| `POST /api/checkout?sku=ABC` | coded error 409 |
| `POST /api/autter-runtime` | browser relay (used by the page) |
| `GET /api/telemetry-status` | last export error, if any |

The page at `/` has buttons for each route, plus browser-side error,
`captureException` and `trackEvent` checks.
