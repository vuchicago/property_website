# Cloudflare Pages Deployment

This guide walks through deploying Cook County Tax Compare to Cloudflare Pages.

## Quick Deploy

### Deploy via Cloudflare Dashboard

1. Commit and push your changes:

   ```bash
   git add .
   git commit -m "Prepare Cloudflare Pages deployment"
   git push origin main
   ```

2. Create or open your Cloudflare Pages project:

   - Go to the Cloudflare Dashboard.
   - Navigate to **Workers & Pages**.
   - Create a Pages application or open the existing Pages project.
   - Connect the Git repository.

3. Configure build settings:

   - **Project name**: `cook-county-tax-compare`
   - **Production branch**: `main` or your production branch
   - **Build command**: `./build.sh`
   - **Build output directory**: `dist`
   - **Root directory**: leave empty

4. Deploy from Cloudflare Pages.

## Deploy via Wrangler CLI

```bash
npm install -g wrangler
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
```

For local Wrangler testing:

```bash
wrangler d1 execute appeal_db --local --file=migrations/0001_create_user_addresses.sql
wrangler d1 execute appeal_db --local --file=migrations/0002_add_customer_name_to_appeals.sql
```

Do not run the full `schema.sql` against production unless you intend to reset data, because it drops and recreates the `appeals` table.

## Email Notifications

Payment notification emails and contact form messages use Resend from Cloudflare Pages Functions. Set these environment variables in Cloudflare Pages:

```bash
RESEND_API_KEY=your_resend_api_key
ADMIN_NOTIFICATION_EMAIL=vu@cookcountytaxcompare.com
NOTIFICATION_FROM_EMAIL="Cook County Tax Compare <alerts@yourdomain.com>"
```

`ADMIN_NOTIFICATION_EMAIL` defaults to `vu@cookcountytaxcompare.com` if it is not set. `NOTIFICATION_FROM_EMAIL` should be a sender address verified in Resend for production delivery.

## What's Deployed

- `index.html`: homepage
- `property-tax.html`: property tax comparison tool
- `roi-calculator.html`: ROI calculator
- `loan-tool.html`: loan maturity tool
- `styles.css`, `dark-mode.css`: site styles
- `app.js`, `components.js`, and tool-specific JavaScript
- `functions/api/*`: Cloudflare Pages Functions
- `robots.txt`, `sitemap.xml`, `llms.txt`: crawl and indexing metadata

## Troubleshooting

### Build fails

- Make sure `wrangler.jsonc` exists in the root directory.
- Verify HTML files reference relative asset paths.
- Run `./build.sh` locally and confirm `dist` is created.

### Hugging Face iframes not loading

- Check that the Hugging Face Spaces are public and running.
- Verify the Space URLs are correct.
- Test in another browser if an extension blocks iframes.

### D1 errors

- Confirm the `DB` binding points to the `appeal_db` database.
- Run the migrations listed above.
- Check Cloudflare Pages production environment bindings, not only preview bindings.

### Email not sending

- Confirm `RESEND_API_KEY` is set in Cloudflare Pages.
- Confirm `NOTIFICATION_FROM_EMAIL` uses a verified Resend sender domain for production.

## Custom Domain

1. Go to your Pages project in Cloudflare Dashboard.
2. Click **Custom domains**.
3. Enter the domain and follow DNS instructions.
4. Cloudflare will provision SSL automatically.

## Continuous Deployment

Every push to the configured production branch triggers a new Cloudflare Pages deployment.
