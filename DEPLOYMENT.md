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
