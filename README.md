# html2pdf-service

Node.js + [Playwright](https://github.com/microsoft/playwright) service that turns HTML or a public URL into a PDF, with optional billing, usage caps, and Stripe integration.

## Overview

- **HTML mode**: supply raw HTML in the request. The service loads it in a headless Chromium page (with bundled reset/default CSS for fragments), then captures output.
- **URL mode**: supply an `http` or `https` URL. The page is loaded in the browser, then captured the same way.

You must send **exactly one** of `html` or `url`. Sending both or neither is rejected with `400` and `{"error":"Invalid input: html_or_url"}`.

### Capture modes (`captureMode`)

| Value | Behavior |
|--------|----------|
| `pdf` (default) | Native Playwright/Chromium **print PDF**. Best for structured documents, selectable text, and smaller files. Honors Playwright PDF options such as `scale`, `preferCSSPageSize`, and header/footer templates. |
| `screenshot_pdf` | Full-page **PNG screenshot** of the rendered page, then embedded into a PDF (via `pdf-lib`). Long pages are split across multiple PDF pages when the image is taller than the printable area. Best for **visual fidelity** (complex CSS, canvas, “looks like the browser”) at the cost of a rasterized page (generally not selectable text). **`headerTemplate` / `footerTemplate` are not applied** in this mode (they only affect native PDF printing). **`scale`** is not passed through to screenshot capture (it applies to native `pdf` mode only). |

### When to use viewport options

`viewportWidth` and `viewportHeight` set the browser viewport **before** navigation or `setContent`. They are optional but especially useful for **responsive layouts** and for **`screenshot_pdf`**, where the visible layout drives the rasterized result. If you set one, you must set both (validated range: **320–3840** px, integers only).

## API

### `GET` or `POST` `/api/convert`

Both methods accept the same logical parameters.

- **`GET`**: parameters come from the **query string** (fine for small payloads; long HTML hits URL length limits).
- **`POST`**: send **`Content-Type: application/json`** (or URL-encoded form) with a JSON body (recommended for non-trivial HTML). Request bodies are limited to **2 MB** by the JSON/urlencoded parsers.

Successful responses are a **direct PDF file download** (`Content-Disposition: attachment`), not a JSON object with a public URL.

### Authentication

All `/api/convert` requests must include:

```http
X-API-KEY: <your-key>
```

**Env-approved keys** (comma-separated in `VALID_API_KEYS`): match any listed key → request proceeds; account/subscription checks and usage caps are **skipped** for that key (intended for operators and local dev).

Otherwise:

- Missing header → **`401`** JSON `{"error":"Missing API key"}`.
- Unknown key → **`403`** JSON `{"error":"Invalid API key"}` (before DB-backed billing).

If the key is not env-approved, middleware then requires a row in **`accounts`** and an active subscription (see **Billing / quotas** below).

**Optional demo key**: if `ALLOW_DEMO_KEY=true`, the literal key `demo-unlimited-key-2024` is accepted like an env-approved key (billing bypass). Do not enable in production unless you intend to.

### Billing / quotas

For keys that are **not** env-approved (and not the demo key path above):

- **`billingGuard`**: key must exist in `accounts`. If the subscription is paused, **`402`** with a payment message.
- Invalid / unknown key at this stage → **`401`** JSON `{"error":"invalid_api_key"}`.
- **`usageCap`**: free tier limits (per key, from `page_events`): **5 PDFs per day**, **50 per calendar month** → **`429`** JSON `{"error":"Daily free limit reached"}` or `{"error":"Monthly free limit reached"}`.

Create a DB-backed key with **`POST /api/signup`** (optional `email`); response includes `apiKey` and `pages_per_month: 50`.

### Supported request options

Unless noted, options can be sent as JSON fields (`POST`) or query parameters (`GET`). Booleans accept JSON booleans or, where implemented, strings like `"true"` / `"false"` (see below).

| Field | Type | Description |
|--------|------|-------------|
| **`html`** | string | Raw HTML document or fragment. **Mutually exclusive with `url`.** |
| **`url`** | string | `http:` or `https:` URL to open. Hostname is resolved and **private/reserved IPs are blocked** (SSRF mitigation: loopback, RFC1918, link-local, etc.). |
| **`format`** | string | Paper format name when `width`+`height` are not both set (e.g. `A4`, `Letter`). Case-insensitive; unknown values fall back to **A4**. Default in the renderer when omitted: **A4**. |
| **`width`** | string \| number | Paper width (e.g. `8.5in`, `210mm`, or a number treated as inches in the PDF pipeline). Used with `height` when both are set. |
| **`height`** | string \| number | Paper height (same unit rules as `width`). |
| **`landscape`** | boolean | If true, landscape orientation. Default **false**. |
| **`marginTop`**, **`marginLeft`**, **`marginRight`**, **`marginBottom`** | string \| number | Content margins; numbers are treated as **px** in the Playwright path; strings may include units (`px`, `in`, `cm`, `mm`, etc.). Defaults in the renderer: **20** (px) per side when omitted. |
| **`headerTemplate`** | string | Playwright PDF header HTML (native **`pdf`** mode only). |
| **`footerTemplate`** | string | Playwright PDF footer HTML (native **`pdf`** mode only). |
| **`style`** | string | Extra CSS injected via `addStyleTag`. |
| **`delayMs`** | number | Extra wait after load / `waitForSelector`, before selector mutations and capture. Clamped to **0–10000** ms. |
| **`timeout`** | integer | If set, whole conversion is wrapped in a wall-clock timeout (**1–30000** ms). On expiry → **`504`** JSON `{"error":"PDF generation timed out"}`. Also passed to `waitForSelector` when that option is used. **`page.goto` uses this timeout**; **`setContent`** for HTML mode does not receive the same Playwright timeout argument (the outer job timeout still applies to the full job). |
| **`scale`** | number | Playwright PDF scale (**0.1–2**). Native **`pdf`** mode only (ignored for **`screenshot_pdf`** raster capture). Default **1**. |
| **`printBackground`** | boolean | Print background graphics. Default **true**. Invalid values → `400` `Invalid input: printBackground`. |
| **`preferCSSPageSize`** | boolean | Prefer `@page` size from CSS. Default **false**. |
| **`hideSelectors`** | string \| string[] | CSS selectors to hide before capture (injected rule: `display: none !important`). Useful for cookie banners or chrome. Empty strings rejected. |
| **`removeSelectors`** | string \| string[] | CSS selectors to remove from the DOM before capture. Useful when hidden elements still affect layout/flow. Empty strings rejected. |
| **`waitForSelector`** | string | Wait for this selector before `delayMs`, selector mutations, and capture. Non-string or blank → `400`. |
| **`waitUntil`** | `"load"` \| `"domcontentloaded"` \| `"networkidle"` | URL mode only: passed to `page.goto` navigation readiness. Default is **`networkidle`** when omitted. Ignored for HTML input mode (`setContent` path). Invalid values → `400`. |
| **`mediaType`** | `"print"` \| `"screen"` | Playwright media emulation before capture. Omit for **print**. Invalid values → `400`. |
| **`viewportWidth`**, **`viewportHeight`** | integer | Browser viewport. Must appear together or neither. Range **320–3840**. |
| **`captureMode`** | `"pdf"` \| `"screenshot_pdf"` | See **Capture modes** above. Invalid values → `400`. |
| **`filename`** | string | Base name for the generated file (sanitized); extension `.pdf` added. Default: timestamp-based unique name. |

**Invalid inputs** generally return **`400`** with JSON `{"error":"Invalid input: <field>"}` (e.g. `html_or_url`, `url`, `scale`, `viewport`, `timeout`, `captureMode`, `mediaType`, `printBackground`, `hideSelectors`, `removeSelectors`, `waitForSelector`, `waitUntil`).

**URL safety**: only `http`/`https`, non-empty host, and resolved addresses that are not blocked (see `app/lib/safeUrl.ts`). Violations → **`403`** JSON `{"error":"URL not allowed"}`.

### Other endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | JSON status, port, timestamp (no API key). |
| `GET` | `/` | Minimal service metadata. |
| `POST` | `/api/signup` | Create account + API key (JSON body, optional `email`). |

Stripe routes (`/api/subscribe`, billing portal, `/webhook/stripe`) require `STRIPE_KEY` (and related secrets); without them those flows return **503** as implemented in the billing controllers.

## Local development (Docker)

Full stack: app + Postgres on **http://localhost:3000**, without using production `docker-compose.yml` or injecting root `.env` into the web container.

```bash
docker compose -f docker-compose.local.yml up --build
```

- **Postgres**: user/password/db `fileslap` / `fileslap` / `fileslap`; data in volume **`html2pdf_local_pgdata`**. `DATABASE_URL` inside the web service is **forced** to the local Postgres URL by compose (a root `.env` pointing at Render is ignored for DB).
- **Optional env file**: copy **`.env.local.example`** to **`.env.local`** in the project root. Compose loads `.env.local` when present (still not the root `.env`). Add at least **`VALID_API_KEYS=my-dev-key`** (or similar) so `/api/convert` accepts your key without DB seeding, or use **`ALLOW_DEMO_KEY=true`** and the demo key (see Authentication).
- **Health**: `GET http://localhost:3000/health`
- **Stop**: `Ctrl+C` or `docker compose -f docker-compose.local.yml down`
- **Reset DB volume**: `docker compose -f docker-compose.local.yml down -v`

Ensure **`app/config/config.ts`** exists (copy from **`app/config/config.ts.default`** if needed).

### Non-Docker Node run

```bash
cd app
npm install
npx tsc && node app.js
```

Set `DATABASE_URL`, `PORT`, `VALID_API_KEYS`, etc. in the environment as required.

## Production / deployment notes

- **Docker**: production-oriented **`docker-compose.yml`** expects an external Docker network named **`main`** and bind-mounts source paths; set **`WEB_IMAGE`**, **`WEB_CONTAINER_NAME`**, and a root **`.env`** as used by your environment.
- **App image**: see **`app/Dockerfile`** (Node 18, Chromium via Playwright).
- **Environment**: at minimum **`DATABASE_URL`**, **`VALID_API_KEYS`** (or demo flag for non-prod only), and secrets for Stripe if you use billing. Optional **`CONVERT_CONCURRENCY`** (default **5**) limits parallel conversions.

### `/api/convert` operational logs

The service now emits structured server logs for convert requests:
- `request_start` when a convert request enters `/api/convert`
- `request_failure` when an error path is handled
- `request_finish` on response completion (includes `status`, `outcome`, `durationMs`, and `bytes` when available)

Logs include conservative request context only (for example: `inputMode`, `targetHost`, `captureMode`, `timeout`, `waitUntil`, `viewport`, and selector-usage booleans). Raw HTML, full request bodies, API keys, and selector values are not logged.

## Concurrency validation (local)

Use the helper script to send overlapping requests and confirm that the conversion cap is enforced.

```bash
cd app
BASE_URL=http://localhost:3000 \
API_KEY=my-dev-key \
TOTAL_REQUESTS=6 \
DELAY_MS=7000 \
bash scripts/validate-concurrency.sh
```

Recommended test setup:

1. Start service with a low cap, for example `CONVERT_CONCURRENCY=2`.
2. Run the script above.
3. In service logs, confirm each `[concurrencyGuard] start ...` has a matching `[concurrencyGuard] finish ...`, and the final active count returns to `active=0/2`.

## Convert error validation (local)

Run a quick manual check for representative `/api/convert` error responses:

```bash
cd app
BASE_URL=http://localhost:3000 \
API_KEY=my-dev-key \
bash scripts/validate-convert-errors.sh
```

The script prints one line per case with status code and JSON body for:
- missing API key
- invalid input (`html` + `url` together)
- invalid API key
- blocked URL (`127.0.0.1`)
- timeout (`timeout=1`)

## PDF retention

A cron job can clean **`public/pdf`** of files older than one hour (see `app/middleware/cron.ts` and `model/pdf.ts` `cleaner`). `ENABLE_CRON` in config controls whether cron is wired on startup.

## Examples (`curl`)

Replace `YOUR_KEY` with a value from `VALID_API_KEYS`, a signup key, or the demo key where enabled.

### HTML → PDF (POST JSON)

```bash
curl -sS -o out.pdf -X POST 'http://localhost:3000/api/convert' \
  -H 'X-API-KEY: YOUR_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"html":"<h1>Hello</h1><p>From HTML mode.</p>"}'
```

### URL → PDF

```bash
curl -sS -o out.pdf -X POST 'http://localhost:3000/api/convert' \
  -H 'X-API-KEY: YOUR_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com"}'
```

### `screenshot_pdf` (visual fidelity)

```bash
curl -sS -o out-screenshot.pdf -X POST 'http://localhost:3000/api/convert' \
  -H 'X-API-KEY: YOUR_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com","captureMode":"screenshot_pdf","viewportWidth":1280,"viewportHeight":720}'
```

### `hideSelectors` (banner / overlay)

```bash
curl -sS -o out.pdf -X POST 'http://localhost:3000/api/convert' \
  -H 'X-API-KEY: YOUR_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com","hideSelectors":["#cookie-banner",".modal-overlay"]}'
```

### `removeSelectors` (remove nodes before capture)

```bash
curl -sS -o out.pdf -X POST 'http://localhost:3000/api/convert' \
  -H 'X-API-KEY: YOUR_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com","removeSelectors":["#cookie-banner",".modal-overlay"]}'
```

### `waitForSelector`

```bash
curl -sS -o out.pdf -X POST 'http://localhost:3000/api/convert' \
  -H 'X-API-KEY: YOUR_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com","waitForSelector":"main","timeout":20000}'
```

### `timeout` (job fails fast)

```bash
curl -sS -o out.pdf -X POST 'http://localhost:3000/api/convert' \
  -H 'X-API-KEY: YOUR_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com","timeout":5000}'
```

## License

See repository license if present; otherwise treat as project-private.
