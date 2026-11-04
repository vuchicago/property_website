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

Contact navigation opens the dedicated Contact page from the homepage, other tools and mobile menus, for signed-in and anonymous users. Insurance is the final standalone navigation link. Contact/Insurance forms require Full Name, Email, Phone # and Address; insurance uses keyboard-accessible toggle buttons ordered Home, Auto, Life, Business. Tests cover selection highlighting, payload order, validation, success reset and retained answers after failure. API tests verify both `vu@cookcountytaxcompare.com` and `vnguyen1@amfam.com` receive the complete Contact/Insurance payload, including Reply-To, and preserve saved leads on a partial provider bounce. All email sends are mocked; these checks do not verify live inbox delivery.

Session checks include delayed Firebase restoration, navigation from a saved property to its appeal, refreshing stale email-verification state without signing out, retaining an unverified session while denying protected actions, service failures without a false sign-in prompt, and returning to the selected property after sign-in. External return URLs are rejected. The landing-page check verifies that Appeal Waitlist is below How Appeals Work with matching button dimensions.

Property-loading regressions execute the actual SQL against 100,000 unrelated property records and check its query plan for index use. Browser tests verify that starting a selected property skips the property list, existing packets open independently of property/history failures, pending history does not block the picker, and retry preserves the property and year without creating another workspace.

Account tests hold administrator-role and appeal-access responses open while loading properties and typing an address. They cover live suggestions without Enter, Enter selecting before submission, adding during an older pending list request, persistence after reload, retry after a failed list request, and loading details for only the selected property. The Worker integration also searches an address, saves it, reloads it, rejects another account's detail request, and starts an appeal using the saved account ID.

Packet-entry tests click the landing page's Start or manage my packet link while the advisory access endpoint returns 503, hold that endpoint open, and open existing packets while property loading is pending. They verify that cached-token rejection triggers exactly one refresh and preserves the POST body without duplicating the workspace. Persistent 401 responses stop after one retry. The real Worker tests separately confirm that paused and uninvited accounts cannot start or read free packets, and authenticated access responses cannot be cached. Frontend scripts use a shared deployment version and `_headers` requests JavaScript revalidation. The custom domain's Browser Cache TTL can override that header, so bump every changed browser module's URL, including its imports, and compare deployed bytes after publishing.

Deletion tests cover properties with existing packets, preserving packet state and history, ownership checks, confirmation cancellation, retry after a failed DELETE, and persistence after reload. Legacy self-appeal foreign-key references remain protected. Owner forms save and PDFs build without an entered deadline. Mailing tests cover the Chicago opening/closing boundaries, upcoming and unpublished windows, wrong assessment years, stale snapshot dates, and client attempts to override deadlines. Browser checks expose dispatch controls only during the open window; the service independently enforces the same rule.

These browser fixtures do not test real Firebase login, provider credentials, live email delivery, the external ROI/loan iframe calculators, or an actual Stripe/DocuSign transaction. Complete the manual account and test-provider steps in [APPEAL_LOCAL_TESTING.md](APPEAL_LOCAL_TESTING.md) before releasing those integrations.

## Cloudflare Functions compilation

Free-download regressions export a preparation-copy PDF while official templates and evidence are missing, inspect its rendered warning/data, and confirm that ownership, packet version and approval remain unchanged. Browser tests save the download, retry a temporary failure, and verify that payment is never requested. Payment tests simulate the existing live Stripe account with DocuSign unconfigured, restrict the override to administrators, and check that draft payment tests stay separate from fulfillment, send no order notification and cannot unlock DocuSign. No real cards are charged by these tests. Return-page checks accept Cloudflare Pages' clean URL redirect.

Single-family tests reject out-of-scope records and checkout attempts. Official-form tests inspect/map synthetic fillable PDFs, preserve blank signatures, verify rendered owner/property values, reject missing fields and overlong text, and include photo-date attestations conditionally. The actual local Worker test imports a reusable template as administrator, rejects owner access to setup, saves intake, uploads personal correction evidence and generates/downloads the complete packet without an owner application upload. Browser tests cover one-time administrator setup, suggested comparisons, missing mailing fields, scope confirmation and retained downloads for older out-of-scope cases. Test templates are never published to Production.

Guided-card checks cover saved-property auto-opening, mobile dialog bounds, keyboard closing and focus restoration, prefilled comparisons and contact details, conditional rental/purchase evidence, upload progression, save failures and retries, and resuming after reload. The final Download PDF button is exercised with both pending forms (preparation copy) and ready forms/evidence (complete assembled packet), without payment or signature-provider calls. Workflow and real Worker tests enforce owner-only draft updates, field whitelisting, stale-revision rejection, and unchanged packet approval/version while saving answers.

Early-photo checks place a required photo/date card immediately after occupancy, reject a missing capture date without losing the selected file, persist the photo before completed intake, resume after reload, avoid a second photo request, and return directly to review when adding a previously skipped photo. The actual Worker confirms the private upload and date-attestation requirement without changing the intake stage or packet version.

Submission-action checks cover the minimal draft card, adjacent Download Submission/Edit buttons on mobile and desktop, editing and rebuilding with retained answers/files and reset approval, retry after a failed Edit, and downloading the signed PDF while editing is locked. Drafts and revisions do not expose a stale packet as the current completed submission.

Packet-header checks verify the site logo, separate account identity/link layout, signed-out controls, and long-email wrapping from 320px through desktop. Progress tests verify real D1 saves still resume, identical saves preserve revision/timestamp, questionnaire writes add no activity rows, and older questionnaire entries cannot crowd substantive events out of the history limit. Browser fixtures also hide legacy questionnaire activity.

Comparison regressions exclude equal, higher, missing and invalid assessed values from suggestions, saved selections, evidence completion and both PDF outputs. They cover older drafts and no qualifying matches. A real D1 snapshot test puts 21 higher-valued candidates ahead of lower-valued candidates to verify filtering precedes the snapshot limit.

Report checks verify the 10% implied-market-value calculation, missing-value handling, consistent official-form fields, a subject-plus-five landscape grid, output filtering before the five-comp cap, signature reminders, actual attachment page references and preserved uploaded page dimensions. The browser prevents a sixth selection until an existing choice is removed. Generate the fictional, non-filing preview with `node scripts/preview-assessor-packet.mjs`; see [ASSESSOR_SUBMISSION_FORMAT.md](ASSESSOR_SUBMISSION_FORMAT.md).

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
