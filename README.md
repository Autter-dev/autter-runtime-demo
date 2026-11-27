# Autter Runtime demo app

A small Express app that shows how to add [Autter Runtime](https://github.com/Autter-dev/autter-runtime)
to an existing Node.js project. The app starts with no telemetry. Add it with
your coding agent or by hand; both paths are below.

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

## Add Autter Runtime with your coding agent

Your coding agent can do the whole setup. Fork this repository first, so the
[Autter GitHub App](https://autter.dev/docs/guides/github-setup) can read your copy.

1. Install the Autter skills in your fork:

   ```bash
   npx @autter/skills
   ```

   The installer also offers to add the Autter MCP server to the project. It
   never writes a key or token.

2. Open your agent. When it shows **Authenticate** for the `autter` server,
   click it, then authorize in the browser and choose your organization.

3. Ask your agent:

   > Use the Autter skills to set up Runtime for this project.

The agent checks what is missing, asks you once before it creates the Runtime
key, instruments the app and verifies it locally. You review, merge and deploy.
See [AI agent skills](https://autter.dev/docs/runtime/skills) for what the agent
does and what stays with you.

## Add Autter Runtime by hand

These steps send to Autter's hosted ingester, so you need no Docker and no
database.

### 1. Create a server key

In Autter, open **Settings → Keys and tokens** and click **Set up a key**.
Choose **Send errors from my backend service** and pick your fork. Copy the
key (`autter_rt_...`); you see it once. Keep it in an environment variable,
never in source.

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
  endpoint: process.env.AUTTER_ENDPOINT ?? "https://otlp.autter.dev",
  service: "autter-runtime-demo",
});
```

Leave `release` out. From `@autter/runtime-node` 1.16.0 the SDK reports the
running commit from the hosting environment and uses it as the release. It
reads the first commit variable it finds, such as `AUTTER_COMMIT`,
`GITHUB_SHA`, `GIT_SHA` or `RENDER_GIT_COMMIT`. If your host sets none of
these, set `AUTTER_COMMIT` to the deployed commit where the app runs.

Then load it first, before `server.js`. Change the `start` script in
`package.json` to:

```json
"start": "node --import ./instrument.js server.js"
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

### 5. Run it and check it

Set the key in your shell, without committing it:

```bash
export AUTTER_RUNTIME_KEY=<your server key>
export AUTTER_COMMIT=$(git rev-parse HEAD)
npm start
```

In a second terminal with the same variables set:

```bash
AUTTER_ENDPOINT=https://otlp.autter.dev npx @autter/runtime-node verify --service autter-runtime-demo
```

`verify` sends one tagged test event and reads it back. Then open
`http://localhost:3000`, click **Server bug (500)**, and open your fork in Autter under
**Runtime** to see the error.

## Deploy on Render

The repo includes a [`render.yaml`](render.yaml) Blueprint. In Render, choose
**New → Blueprint**, connect your fork and deploy, or create a **Web Service**
by hand with build command `npm install`, start command `npm start` and health
check path `/healthz`.

Add `AUTTER_RUNTIME_KEY` to the service's environment variables in Render.

Render sets `RENDER_GIT_COMMIT` on every git-backed deploy, and Autter Runtime
reads it automatically, so the deployed commit is reported with no extra
configuration. On other hosts, set `AUTTER_COMMIT` to the deployed commit
where the service runs.

## Try it without an Autter account

You can run the ingester on your own machine instead:

```bash
git clone https://github.com/Autter-dev/autter-runtime
cd autter-runtime
docker compose up   # ingester on http://localhost:4318
```

The local ingester accepts a built-in dev key. It is not a secret and works
only with the local ingester:

```bash
AUTTER_ENDPOINT=http://localhost:4318 AUTTER_RUNTIME_KEY=autter_rt_local_dev_only npm start
```

Check it:

```bash
npx @autter/runtime-node doctor --endpoint http://localhost:4318 --key autter_rt_local_dev_only
npx @autter/runtime-node verify --endpoint http://localhost:4318 --key autter_rt_local_dev_only
```

## More

- [Link errors to code](https://autter.dev/docs/runtime/link-errors-to-code): how an error links to its release, commit and pull request
- [Getting started](https://github.com/Autter-dev/autter-runtime/blob/main/docs/GETTING-STARTED.md): frontend setup, keys, production checklist
- [Requests, coded errors and background work](https://github.com/Autter-dev/autter-runtime/blob/main/docs/REQUESTS-AND-ERRORS.md)
- [Example Express app in the repo](https://github.com/Autter-dev/autter-runtime/tree/main/examples/express-app): a fuller instrumented version
