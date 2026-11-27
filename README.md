# Autter Runtime demo app

A small Express app that shows how to add [Autter Runtime](https://github.com/Autter-dev/autter-runtime)
to an existing Node.js project. The app starts with no telemetry. Follow the
steps below to add it.

## Run the app

```bash
npm install
npm start           # http://localhost:3000
```

Open `http://localhost:3000` and click the buttons, or call the routes directly.

| Route | Behavior |
| --- | --- |
| `GET /api/ok` | 200 |
| `GET /api/users/:id` | 200, param route |
| `GET /api/slow` | 0.8–2 s response |
| `GET /api/flaky` | 50% 500s |
| `GET /api/boom` | unhandled error, 500 |
| `POST /api/checkout?declined=1` | 402 |
| `POST /api/checkout?sku=ABC` | 409 |

## Deploy on Render

The repo includes a [`render.yaml`](render.yaml) Blueprint. In Render, choose
**New → Blueprint**, connect this repository and deploy, or create a **Web Service**
by hand with build command `npm install`, start command `npm start` and health
check path `/healthz`.

Render sets `RENDER_GIT_COMMIT` on every git-backed deploy, and Autter Runtime
reads it automatically, so the deployed commit is reported with no extra
configuration. On other hosts, set `GIT_SHA` or `AUTTER_COMMIT` to the deployed
commit where the service runs.

## Add Autter Runtime

### 1. Start an ingester

For a local try-out, run the ingester from the autter-runtime repo:

```bash
git clone https://github.com/Autter-dev/autter-runtime
cd autter-runtime
docker compose up   # ingester on http://localhost:4318
```

### 2. Install the server SDK

```bash
npm install @autter/runtime-node
```

### 3. Initialize it before the app loads

Create `instrument.js` next to `server.js`:

```js
import { initAutterServer } from "@autter/runtime-node";

initAutterServer({
  apiKey: process.env.AUTTER_RUNTIME_KEY,
  endpoint: process.env.AUTTER_ENDPOINT,
  service: "autter-runtime-demo",
  environment: "development",
  release: process.env.GIT_SHA ?? "dev",
  traceSampleRate: 1,
});
```

Then load it first, before `server.js`:

```bash
node --import ./instrument.js server.js
```

### 4. Add request summaries and error handling

In `server.js`, import the helpers and register them. The request summary
middleware goes before your routes, and the error handlers go after them:

```js
import { autterRequests, autterErrorHandler, autterErrorResponse } from "@autter/runtime-node";

app.use(autterRequests({ ignore: ["/healthz"] }));   // before routes
// ... routes ...
app.use(autterErrorHandler());                       // after routes
app.use(autterErrorResponse());                      // last
```

### 5. Run with the local key

The local ingester accepts a built-in dev key. It is not a secret and works
only with the local ingester:

```bash
AUTTER_ENDPOINT=http://localhost:4318 AUTTER_RUNTIME_KEY=autter_rt_local_dev_only \
  node --import ./instrument.js server.js
```

To send to a hosted ingester, use `AUTTER_ENDPOINT=https://otlp.autter.dev`
with a real `autter_rt_...` server key.

### 6. Check it

```bash
npx @autter/runtime-node doctor --endpoint http://localhost:4318 --key autter_rt_local_dev_only
npx @autter/runtime-node verify --endpoint http://localhost:4318 --key autter_rt_local_dev_only
```

## More

- [Getting started](https://github.com/Autter-dev/autter-runtime/blob/main/docs/GETTING-STARTED.md): frontend setup, keys, production checklist
- [Requests, coded errors and background work](https://github.com/Autter-dev/autter-runtime/blob/main/docs/REQUESTS-AND-ERRORS.md)
- [Example Express app in the repo](https://github.com/Autter-dev/autter-runtime/tree/main/examples/express-app): a fuller instrumented version
