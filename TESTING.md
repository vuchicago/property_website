# Local unit and regression tests

Run the automated checks before publishing a change:

```bash
bash scripts/test.sh
```

This runs the JavaScript unit/API tests, real SQLite migration and constraint tests, JavaScript syntax checks, the static build, and Git whitespace validation. It needs Node.js 22.13 or newer, Python 3, Bash, and ripgrep. The saved-property SQL tests use Node's built-in SQLite module. It uses generated identities, synthetic documents, and in-memory databases. Expected rejection tests log messages such as “Payment required” or “Test delivery failure”; the final pass/fail result determines success.

The suite covers free packet preparation and PDF assembly, property ownership and document access, administrator and tester permissions, invitation pause/restore, the fixed $49 checkout, payment before DocuSign, signature completion, refunds, webhook signatures, mailing consent, and public waitlist validation and capture when email delivery fails.

## Browser regression checks

Use the isolated local server described in [APPEAL_LOCAL_TESTING.md](APPEAL_LOCAL_TESTING.md). Start it in the first terminal:

```bash
./scripts/appeal-local.sh
```

The browser suite needs Google Chrome or Chromium and the Playwright Core package. Install the test dependency locally if it is not already available:

```bash
npm install --no-save --package-lock=false playwright-core
```

In a second terminal, run all checks including the browser suite:

```bash
bash scripts/test.sh --browser
```

To run just the browser checks:

```bash
node --test tests/browser-regression.cjs
```

The runner detects Chrome on macOS and common Linux/Windows locations. Set `BROWSER_EXECUTABLE` for another browser path. Set `PLAYWRIGHT_MODULE` to the absolute path of an existing `playwright-core` installation if you keep test dependencies elsewhere. `APPEAL_TEST_BASE_URL` overrides the default `http://127.0.0.1:8788`; only loopback addresses are accepted.

Browser tests exercise the actual built HTML, CSS, navigation, authentication UI, and account scripts. They replace Firebase identity and every API response with fixtures and block other external requests. They check all shared headers at desktop, tablet, and mobile widths; the homepage down to 320px; hover and keyboard dropdown behavior; clean URL highlights; account and Partner Inbox menus; logout; public waitlist submission and retry; administrator tester management; restricted free workspace access; and a free packet download before optional fulfillment.

Session checks include delayed Firebase restoration, navigation from a saved property to its appeal, refreshing stale email-verification state without signing out, retaining an unverified session while denying protected actions, service failures without a false sign-in prompt, and returning to the selected property after sign-in. External return URLs are rejected. The landing-page check verifies that Appeal Waitlist is below How Appeals Work with matching button dimensions.

Property-loading regressions execute the actual SQL against 100,000 unrelated property records and check its query plan for index use. Browser tests verify that starting a selected property skips the property list, existing packets open independently of property/history failures, pending history does not block the picker, and retry preserves the property and year without creating another workspace.

Account tests hold administrator-role and appeal-access responses open while loading properties and typing an address. They cover live suggestions without Enter, Enter selecting before submission, adding during an older pending list request, persistence after reload, retry after a failed list request, and loading details for only the selected property. The Worker integration also searches an address, saves it, reloads it, rejects another account's detail request, and starts an appeal using the saved account ID.

These browser fixtures do not test real Firebase login, provider credentials, live email delivery, the external ROI/loan iframe calculators, or an actual Stripe/DocuSign transaction. Complete the manual account and test-provider steps in [APPEAL_LOCAL_TESTING.md](APPEAL_LOCAL_TESTING.md) before releasing those integrations.

## Cloudflare Functions compilation

With Wrangler installed, compile the API bundle locally:

```bash
npx --no-install wrangler pages functions build functions --outdir /tmp/cookcounty-regression-worker
```

Compilation creates a local bundle. It does not publish the site or apply remote migrations.

## Local Worker and D1 integration

Install Miniflare alongside the optional browser dependency, or set `MINIFLARE_MODULE` to an existing installation:

```bash
npm install --no-save --package-lock=false miniflare playwright-core
bash scripts/test.sh --worker
```

This compiles the Functions and runs them inside the actual local Workers runtime with isolated D1 and R2 bindings. It applies the repository's schema and packet migrations to a temporary database, inserts 100,000 fictional unrelated properties, and checks property listing, starting, opening, resuming, ownership, and anonymous access. Only Firebase's public-key response is replaced with a generated test key; SQL and API responses are real. It never reads Production credentials or connects to remote D1.

With the local website running, run every layer with:

```bash
bash scripts/test.sh --worker --browser
```
