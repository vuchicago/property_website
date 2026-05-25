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
APPEAL_HELP_AMOUNT_CENTS=9900
DEPLOYMENT_READY=0
STRIPE_CHECKOUT_DOMAIN=https://your-preview-or-production-domain.example
```

If Cloudflare requires the destination to be a verified destination address, set `ADMIN_NOTIFICATION_EMAIL` to your verified personal email instead. You can still use `NOTIFICATION_FROM_EMAIL="Cook County Tax Compare <notifications@inquiry.cookcountytaxcompare.com>"`.

For Resend instead, set:

```bash
RESEND_API_KEY=your_resend_api_key
ADMIN_NOTIFICATION_EMAIL=vu@cookcountytaxcompare.com
NOTIFICATION_FROM_EMAIL="Cook County Tax Compare <alerts@yourdomain.com>"
APPEAL_HELP_AMOUNT_CENTS=9900
DEPLOYMENT_READY=0
STRIPE_CHECKOUT_DOMAIN=https://your-preview-or-production-domain.example
```

`CLOUDFLARE_EMAIL_API_TOKEN` must be a Cloudflare API token with permission to send emails. `ADMIN_NOTIFICATION_EMAIL` defaults to `vu@cookcountytaxcompare.com` if it is not set. With Resend, `NOTIFICATION_FROM_EMAIL` should be a sender address verified in Resend for production delivery. With Cloudflare Email Sending, it must be an address on the outbound email domain. The default Cloudflare sender is `notifications@inquiry.cookcountytaxcompare.com`.
`APPEAL_HELP_AMOUNT_CENTS` controls the Stripe Checkout amount for appeal help. Use cents, so `99` is $0.99 and `9900` is $99.00. Decimal dollar values such as `0.99` are also accepted and converted to cents.
`DEPLOYMENT_READY` controls whether appeal submissions use Stripe Checkout or the waitlist. Use `0` while appeals are not ready. Set `DEPLOYMENT_READY=1` only when Stripe payment, webhook secrets, and appeal operations are ready. The code also accepts `true`, `yes`, and `on`.
`STRIPE_CHECKOUT_DOMAIN` is optional. If it is not set, Stripe returns to the same Production, Stage, or preview origin that created the checkout session. Only set it when you intentionally want to force a specific return domain. Do not set Stage to the Production domain.

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
