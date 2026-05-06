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
   - **Project name**: `cook-county-tax-compare` (or your choice)
   - **Production branch**: `feature/huggingface` (or `main` after merging)
   - **Build command**: Leave empty
   - **Build output directory**: `/`
   - **Root directory**: Leave empty

4. **Deploy:**
   - Click **Save and Deploy**
   - Your site will be live at: `https://cook-county-tax-compare.pages.dev`

### Deploy via Wrangler CLI

```bash
# Install Wrangler (if not already installed)
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy
npx wrangler pages deploy . --project-name=cook-county-tax-compare
```

## Database Setup

Cloudflare D1 must have the account tables before users can save properties or view appeal history.

Apply the non-destructive migration to production:

```bash
wrangler d1 execute appeal_db --remote --file=migrations/0001_create_user_addresses.sql
wrangler d1 execute appeal_db --remote --file=migrations/0002_add_customer_name_to_appeals.sql
wrangler d1 execute appeal_db --remote --file=migrations/0003_create_property_addresses.sql
```

For local Wrangler testing:

```bash
wrangler d1 execute appeal_db --local --file=migrations/0001_create_user_addresses.sql
wrangler d1 execute appeal_db --local --file=migrations/0002_add_customer_name_to_appeals.sql
wrangler d1 execute appeal_db --local --file=migrations/0003_create_property_addresses.sql
```

Do not run the full `schema.sql` against production unless you intend to reset data, because it drops and recreates the `appeals` table.

The `property_addresses` table is the import target for the Cook County address dataset. Convert `outfile_all_2025.parquet` to rows with at least `address` and `normalized_address`; include `pin`, `zip`, `latitude`, and `longitude` when available for faster exact and nearest-address matching.

The current local dataset path is:

```bash
../property_tax_data_big/output_all_2025.parquet
```

Generate the D1 import SQL from that Parquet file:

```bash
python3 scripts/export_property_addresses_sql.py
```

Then import the generated SQL after the `property_addresses` table migration has been applied:

```bash
wrangler d1 execute appeal_db --remote --file=import/property_addresses_2025.sql
```

## Email Notifications

Payment notification emails and contact form messages use Resend from Cloudflare Pages Functions. Set these environment variables in Cloudflare Pages:

```bash
RESEND_API_KEY=your_resend_api_key
ADMIN_NOTIFICATION_EMAIL=vu@cookcountytaxcompare.com
NOTIFICATION_FROM_EMAIL="Cook County Tax Compare <alerts@yourdomain.com>"
APPEAL_HELP_AMOUNT_CENTS=9900
```

`ADMIN_NOTIFICATION_EMAIL` defaults to `vu@cookcountytaxcompare.com` if it is not set. `NOTIFICATION_FROM_EMAIL` should be a sender address verified in Resend for production delivery.
`APPEAL_HELP_AMOUNT_CENTS` controls the Stripe Checkout amount for appeal help. Use cents, so `9900` is $99.00.

## What's Deployed

- **Homepage**: `index.html` - Main landing page
- **Property Tax Tool**: `property-tax.html` → HF Space: `vuchicago/property_tax`
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
