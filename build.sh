#!/bin/bash
# Create the dist directory
mkdir -p dist

# Copy all static frontend files to dist
# Note: we specifically ignore the python backend files and node_modules
cp *.html *.css *.js dist/
cp styles.css dist/site.css
node - <<'NODE'
const fs = require('fs');
const css = fs.readFileSync('styles.css', 'utf8');
const max = 30000;
let start = 0;
let index = 1;

while (start < css.length) {
        let end = Math.min(start + max, css.length);
        if (end < css.length) {
                const nextBrace = css.indexOf('}', end);
                if (nextBrace !== -1 && nextBrace - start < max + 5000) {
                        end = nextBrace + 1;
                } else {
                        const previousBrace = css.lastIndexOf('}', end);
                        if (previousBrace > start) end = previousBrace + 1;
                }
        }
        fs.writeFileSync(`dist/site-${index}.css`, css.slice(start, end));
        start = end;
        index += 1;
}
NODE
rm -rf dist/property-tax
mkdir -p dist/property-tax
cp property-tax.html dist/property-tax/index.html
rm -rf dist/how-property-taxes-work
mkdir -p dist/how-property-taxes-work
cp how-property-taxes-work.html dist/how-property-taxes-work/index.html
rm -rf dist/partners
mkdir -p dist/partners
cp partners.html dist/partners/index.html
perl -0pi -e 's{<head>}{<head>\n    <base href="/">}i' dist/property-tax/index.html dist/how-property-taxes-work/index.html dist/partners/index.html

# Copy crawl/indexing metadata and Pages routing rules when present
cp robots.txt sitemap.xml llms.txt _redirects dist/ 2>/dev/null || true

# Copy public assets used by social previews, favicons, and page images
cp -r assets/ dist/assets/ 2>/dev/null || true
cp -r functions/ dist/functions/

echo "Build complete. Output directory ready for Pages deploy."
