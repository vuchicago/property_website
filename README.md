# Cook County Tax Compare - Static Website

Static website deployment for Cloudflare Pages with embedded Hugging Face calculators.

## Quick Start

```bash
# Deploy to Cloudflare Pages
npx wrangler pages deploy . --project-name=cook-county-tax-compare
```

## What Gets Deployed

**Static Files Only:**
- HTML pages (index, property-tax, roi-calculator, loan-tool)
- CSS stylesheets (styles.css, dark-mode.css)
- JavaScript files (app.js, components.js, tool-specific JS)

**Excluded (via .gitignore):**
- Python backend code (`backend/`, `property_tax_appeal_vn/`)
- Large data files (65MB parquet file)
- Docker files, Python dependencies
- Virtual environments

## Calculator Integration

All calculators use Hugging Face Spaces via iframes:
- **Property Tax**: `vuchicago/property_tax`
- **ROI Calculator**: `vuchicago/real-estate-roi`  
- **Loan Tool**: `vuchicago/loan-details`

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete instructions.
