#!/bin/bash
# Create the dist directory
mkdir -p dist

# Copy all static frontend files to dist
# Note: we specifically ignore the python backend files and node_modules
cp *.html *.css *.js dist/

# Copy crawl/indexing metadata when present
cp robots.txt sitemap.xml llms.txt dist/ 2>/dev/null || true

# If there are any subdirectories that need to be public, add them here
# cp -r assets/ dist/assets/
cp -r functions/ dist/functions/

echo "Build complete. Output directory ready for Pages deploy."
