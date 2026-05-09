#!/bin/bash
# Create the dist directory
mkdir -p dist

# Copy all static frontend files to dist
# Note: we specifically ignore the python backend files and node_modules
cp *.html *.css *.js dist/

# Copy crawl/indexing metadata and Pages routing rules when present
cp robots.txt sitemap.xml llms.txt _redirects dist/ 2>/dev/null || true

# Copy public assets used by social previews, favicons, and page images
cp -r assets/ dist/assets/ 2>/dev/null || true
cp -r functions/ dist/functions/

echo "Build complete. Output directory ready for Pages deploy."
