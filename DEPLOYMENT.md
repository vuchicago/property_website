# Cloudflare Pages Deployment

## Quick Deploy

Your site is now configured for Cloudflare Pages deployment with all three calculator tools using Hugging Face Spaces iframes.

### Deploy via Cloudflare Dashboard (Recommended)

1. **Commit and push your changes:**
   ```bash
   git add .
   git commit -m "Configure for Cloudflare Pages deployment"
   git push origin feature/huggingface
   ```

2. **Create Cloudflare Pages project:**
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
   - Navigate to **Workers & Pages** → **Create application** → **Pages**
   - Click **Connect to Git**
   - Select your repository and the `feature/huggingface` branch

3. **Configure build settings:**
   - **Project name**: `cookcountytaxcomparev2` (or your choice)
   - **Production branch**: `Production`
   - **Build command**: Leave empty
   - **Build output directory**: `/`
   - **Root directory**: Leave empty

4. **Deploy:**
   - Click **Save and Deploy**
   - Your site will be live at: `https://cookcountytaxcomparev2.pages.dev`

### Deploy via Wrangler CLI

```bash
# Install Wrangler (if not already installed)
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy
npx wrangler pages deploy . --project-name=cookcountytaxcomparev2
```

## Database Setup

Cloudflare D1 must have the account tables before users can save properties or view appeal history.

Apply the non-destructive migration to production:

```bash
wrangler d1 execute appeal_db --remote --file=migrations/0001_create_user_addresses.sql
wrangler d1 execute appeal_db --remote --file=migrations/0002_add_customer_name_to_appeals.sql
wrangler d1 execute appeal_db --remote --file=migrations/0003_create_property_addresses.sql
wrangler d1 execute appeal_db --remote --file=migrations/0008_create_property_images.sql
```

For local Wrangler testing:

```bash
wrangler d1 execute appeal_db --local --file=migrations/0001_create_user_addresses.sql
wrangler d1 execute appeal_db --local --file=migrations/0002_add_customer_name_to_appeals.sql
wrangler d1 execute appeal_db --local --file=migrations/0003_create_property_addresses.sql
wrangler d1 execute appeal_db --local --file=migrations/0008_create_property_images.sql
```

Do not run the full `schema.sql` against production unless you intend to reset data, because it drops and recreates the `appeals` table.

## Cook County Tax RAG

The Cook County document Q&A system uses Workers AI plus Vectorize. It does not write document chunks to D1.

Create the Vectorize index before deploying the binding:

```bash
npx wrangler vectorize create cook-county-tax-docs --dimensions=768 --metric=cosine
```

Generate capped document embeddings from `data_sources/cook_county_tax_docs/manifest.json`:

```bash
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id \
CLOUDFLARE_API_TOKEN=your_workers_ai_token \
python3 scripts/build_cook_county_tax_vectors.py --max-chunks 750
```

PDF sources require either `pdftotext` from Poppler or the Python `pypdf` package to be installed locally.

Upload the generated vectors:

```bash
npx wrangler vectorize insert cook-county-tax-docs --file=import/cook_county_tax_doc_vectors.ndjson
```

The cap is intentional. Increase `--max-chunks` only after checking the monthly Vectorize and Workers AI usage. Your Workers/D1 billing period appears to renew on the 6th of each month.

If you previously ran an older draft of `0003_create_property_addresses.sql` and see an error like `no such column: neighborhood_code`, rebuild the generated property lookup table before importing the Parquet data:

```bash
wrangler d1 execute appeal_db --remote --file=migrations/0006_rebuild_property_addresses_full.sql
```

This does not delete user accounts, saved user properties, or appeal/payment history. It only resets `property_addresses`, which is regenerated from the Parquet import.

Older repair migrations are kept for history, but use `0006_rebuild_property_addresses_full.sql` for the current full Parquet table.

The `property_addresses` table is the import target for the Cook County address dataset. It stores `pin`, the display address from `Nearby Address`, a generated `normalized_address` used for matching, and the remaining assessment/appeal columns from `output_all_2025.parquet`, including `Year Built`, `Repair Condition`, `pin10`, municipality fields, walkability/flood scores, Chicago community area, and condo characteristics.

The full rebuild intentionally creates the table without secondary indexes to reduce D1 rows-written during bulk import. Add the PIN index only after the import succeeds.

The current local dataset path is:

```bash
../property_tax_data_big/output_all_2025.parquet
```

Generate the D1 import SQL from that Parquet file:

```bash
python3 scripts/export_property_addresses_sql.py
```

This export includes all mapped Parquet columns.

Then import the generated SQL after the `property_addresses` table migration has been applied:

```bash
wrangler d1 execute appeal_db --remote --file=import/property_addresses_2025.sql
```

For large imports, split the generated SQL into smaller files:

```bash
python3 scripts/export_property_addresses_sql.py --rows-per-file 10000
```

Then import each generated part in order:

```bash
bash scripts/import_property_addresses_parts.sh
```

To generate and push the updated 2025 table using a separate import filename stem:

```bash
python3 scripts/export_property_addresses_sql.py --output import/property_addresses_2025_updated.sql --rows-per-file 10000
bash scripts/push_property_addresses_2025_updated.sh
```

The import script passes `--yes` to Wrangler so you do not have to approve each split file manually.

If an import fails partway through, rerun from the failed part number:

```bash
START_PART=42 bash scripts/import_property_addresses_parts.sh
```

After all parts import and the count looks right, add the PIN index:

```bash
wrangler d1 execute appeal_db --remote --file=migrations/0007_add_property_addresses_pin_index.sql
```

Then add the lookup indexes used by the native property tax comparison app:

```bash
wrangler d1 execute appeal_db --remote --file=migrations/0009_add_property_compare_indexes.sql
```

Create the search logging table so property tax searches can be inspected later:

```bash
wrangler d1 execute appeal_db --remote --file=migrations/0010_create_property_searches.sql
```

Create the contact backup table so contact and insurance form submissions are captured even if outbound email has a provider issue:

```bash
wrangler d1 execute appeal_db --remote --file=migrations/0011_create_contact_messages.sql
```

## Email Notifications

Payment notification emails and contact form messages can use either Cloudflare Email Sending or Resend from Cloudflare Pages Functions.

Cloudflare Email Routing forwards inbound mail only. The contact form is outbound mail, so Pages uses the Cloudflare Email Service REST API. Make sure Email Sending is enabled for the outbound domain `inquiry.cookcountytaxcompare.com` before deploying.

For Cloudflare Email Sending, set:

```bash
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
CLOUDFLARE_EMAIL_API_TOKEN=your_email_sending_api_token
ADMIN_NOTIFICATION_EMAIL=vu@cookcountytaxcompare.com
NOTIFICATION_FROM_EMAIL="Cook County Tax Compare <notifications@inquiry.cookcountytaxcompare.com>"

DEPLOYMENT_READY=0
STRIPE_CHECKOUT_DOMAIN=https://your-preview-or-production-domain.example
STRIPE_MODE=auto
STRIPE_TEST_SECRET_KEY=sk_test_...
STRIPE_TEST_PUBLISHABLE_KEY=pk_test_...
STRIPE_TEST_WEBHOOK_SECRET=whsec_...
STRIPE_LIVE_SECRET_KEY=sk_live_...
STRIPE_LIVE_PUBLISHABLE_KEY=pk_live_...
STRIPE_LIVE_WEBHOOK_SECRET=whsec_...
```

All contact, waitlist, partnership, and insurance form notifications go to `vu@cookcountytaxcompare.com`, with every submitted form field and the visitor's email as Reply-To. Contact form recipients are not overridden by `ADMIN_NOTIFICATION_EMAIL`, `PARTNERSHIP_NOTIFICATION_EMAIL`, or `INSURANCE_NOTIFICATION_EMAIL`. Configure Cloudflare Email Routing to forward this inbox to the verified destination `vuchicago@gmail.com`. Outbound Email Sending must also be configured; inbound forwarding alone cannot send form notifications. Submissions are backed up in `contact_messages`, including email delivery errors.

For Resend instead, set:

```bash
RESEND_API_KEY=your_resend_api_key
ADMIN_NOTIFICATION_EMAIL=vu@cookcountytaxcompare.com
NOTIFICATION_FROM_EMAIL="Cook County Tax Compare <alerts@yourdomain.com>"

DEPLOYMENT_READY=0
STRIPE_CHECKOUT_DOMAIN=https://your-preview-or-production-domain.example
```

`CLOUDFLARE_EMAIL_API_TOKEN` must be a Cloudflare API token with permission to send emails. `ADMIN_NOTIFICATION_EMAIL` defaults to `vu@cookcountytaxcompare.com` if it is not set. With Resend, `NOTIFICATION_FROM_EMAIL` should be a sender address verified in Resend for production delivery. With Cloudflare Email Sending, it must be an address on the outbound email domain. The default Cloudflare sender is `notifications@inquiry.cookcountytaxcompare.com`.
Optional DocuSign, print-and-mail fulfillment is fixed at $49 (4900 cents) in `functions/api/_packet_pricing.js`, including postage. Preparation and unsigned downloads are free. Legacy `APPEAL_HELP_AMOUNT_CENTS` values do not override this price.
`DEPLOYMENT_READY` controls whether appeal submissions use Stripe Checkout or the waitlist. Use `0` while appeals are not ready. Set `DEPLOYMENT_READY=1` only when Stripe payment, webhook secrets, and appeal operations are ready. The code also accepts `true`, `yes`, and `on`.
`STRIPE_CHECKOUT_DOMAIN` is optional. If it is not set, Stripe returns to the same Production, Stage, or preview origin that created the checkout session. Only set it when you intentionally want to force a specific return domain. Do not set Stage to the Production domain.
`STRIPE_MODE` can be `auto`, `test`, or `live`. In `auto`, Cloudflare Pages preview branches use Stripe test keys and the production branch uses live keys. The production branch defaults to `Production`; set `PRODUCTION_BRANCH` if your production branch has a different name.

For Preview environment variables in Cloudflare Pages, set `DEPLOYMENT_READY=1`, `STRIPE_MODE=auto`, and the `STRIPE_TEST_*` values. Preview/test mode does not fall back to generic production Stripe variables, so a missing test key will fail closed instead of creating a live checkout. Use Stripe test card `4242 4242 4242 4242` with any future expiration date, any CVC, and any ZIP.

For Production environment variables, set `DEPLOYMENT_READY=1`, `STRIPE_MODE=auto`, and either the `STRIPE_LIVE_*` values or the existing generic live values (`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`).

## Email Verification

Email/password account creation uses Firebase email verification. New password users must verify their email address before signing in or using authenticated account features. No reCAPTCHA Enterprise keys are required.

In Firebase Authentication, confirm that the Email/Password provider is enabled and that the email verification template is configured for the production domain.

## What's Deployed

- **Homepage**: `index.html` - Main landing page
- **Property Tax Tool**: `property-tax.html` → native Cloudflare Pages app backed by D1
- **ROI Calculator**: `roi-calculator.html` → HF Space: `vuchicago/real-estate-roi`
- **Loan Tool**: `loan-tool.html` → HF Space: `vuchicago/loan-details`
- **Styles**: `styles.css`, `dark-mode.css`
- **Scripts**: `app.js`, `components.js`

## Files Excluded from Deployment

The `.gitignore` file excludes:
- Python backend code (`backend/`, `*.py`)
- Virtual environments (`.venv/`)
- Build artifacts
- Docker files
- Python package files

## Troubleshooting

### Build fails
- Make sure `wrangler.jsonc` exists in the root directory
- Verify all HTML files reference correct asset paths (they should be relative)

### Hugging Face iframes not loading
- Check that the Hugging Face Spaces are public and running
- Verify the Space URLs are correct
- Some browsers may block iframes - test in different browsers

### Custom Domain
1. Go to your Pages project in Cloudflare Dashboard
2. Click **Custom domains** → **Set up a custom domain**
3. Enter your domain and follow DNS instructions
4. SSL certificate will be auto-provisioned

## Continuous Deployment

Every push to your configured branch will automatically trigger a new deployment on Cloudflare Pages.


## Free Assessor preparation and optional $49 fulfillment

Customer entry: `/appeal-packet.html`; admin entry: **Prepare packet** on each fulfillment order, resolved to its free workspace. Existing attorney-partner waitlist marketing remains separate. Checkout sells optional $49 DocuSign, print-and-mail fulfillment; preparation and unsigned downloads are free.

Provision before enabling payments:

1. Apply `migrations/0029_create_appeal_packets.sql` to the existing D1 database (after the earlier migrations). This creates new tables without changing existing appeals.
2. Use the R2 bucket `cookcountystorage`, bound as `APPEAL_PACKETS` in Pages, matching `wrangler.jsonc`. The bucket was verified to exist on November 3, 2026. Keep public access disabled. No folders need to be created: the app writes object keys under `packets/` and `self-appeals/` on upload. Use a separate bucket for staging; never copy production evidence into test fixtures.
3. Configure Stripe test credentials and `STRIPE_TEST_WEBHOOK_SECRET` for preview. The webhook now requires a valid signature and a timestamp within five minutes in every environment. Configure live keys and a live webhook secret separately before production activation.
4. Set `DEPLOYMENT_READY=1` only after storage, migration, outbound notifications, and a complete Stripe test purchase have been verified. The checkout also requires the R2 binding and packet table. The R2 bucket must actually exist; a binding alone is insufficient operational verification.
5. Test owner and admin accounts end to end before accepting live purchases. No real charge, email, DocuSign envelope, mailing or application deployment was performed while building this framework. The workflow migrations were subsequently applied as recorded below.

Current workflow: free saved-property workspace → owner intake and evidence → owner/admin uploads assembled official PDF → owner approves → optional $49 fulfillment checkout → confirmed payment → integrated DocuSign draft/preview/send → server retrieves completed signed PDF and certificate → owner mailing consent → actual dispatch proof → separate carrier-delivery record → official county filing confirmation.

The new service is Assessor-only. Fulfillment includes signing, printing, assembly, postage and tracking. Existing paid packet records retain their legacy manual controls; new `free_` cases cannot use manual API actions to forge DocuSign completion. Preparation and downloads remain free even without a purchase. New packet versions require a new version-linked fulfillment purchase in this framework; resolve/refund an unfulfilled purchase before asking customers to repurchase after corrections. Do not advertise unlimited revisions under one purchase until version-transfer support is implemented.

**Migration applied:** the user authorized schema review and migration on November 3, 2026. Migrations 0029–0031 were validated and applied to remote `appeal_db`; see [APPEAL_WORKFLOW_SCHEMA.md](APPEAL_WORKFLOW_SCHEMA.md) for constraints, checks and recovery bookmark. No application deployment was performed. Migration 0031 links Stripe orders to approved packet versions and stores DocuSign envelopes/operation state. See [DOCUSIGN_INTEGRATION.md](DOCUSIGN_INTEGRATION.md) for the demo setup, JWT consent, secrets and recovery instructions.

DocuSign acceptance is assumed for the design at the user's direction; it is not established by the integration. No automatic notarization is provided. Actual dispatch still requires review of mailing address, copies and filing deadline rules. Demo envelopes cannot be dispatched through this workflow. No provider credentials, real envelopes, charges or county submissions were used in automated tests.

References checked November 3, 2026:
- https://rpie.cookcountyassessor.com/official-appeal-rules-cook-county-assessor (Rules 2, 5, 6, 10)
- https://www.cookcountyassessoril.gov/faq/how-can-i-file-appeal
- https://www.cookcountyboardofreview.com/board-review-official-rules (Rules 1, 5–8, 16)
- https://www.docusign.com/blog/developers/dsdev-common-api-tasks-downloading-documents

Validation: `node --test tests/packet-*.test.mjs`. This uses local fixtures and never sends real messages or charges a card. Complete provider integration and production smoke tests after configuration. Legacy supporting documents remain on the property dashboard; customers should upload the documents for this particular appeal into the packet workspace.


## Personal self-appeal pilot

See [SELF_APPEAL_PROCESS.md](SELF_APPEAL_PROCESS.md) for the user process and document checklist. Apply `migrations/0030_create_self_appeal_cases.sql` before using the new saved-property action. It is restricted on the server to the verified `vuchicago@gmail.com` pilot and that user's own saved address IDs; no payment is required. Checklist progress is independent of the optional fulfillment workflow. Configure `APPEAL_PACKETS` for uploads; progress and notes do not require storage. Existing self-appeal cases prevent deleting their saved property. The site's checklist does not execute signatures, notarize documents, or submit anything to the county.
