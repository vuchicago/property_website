#!/bin/bash
# Create the dist directory
mkdir -p dist

# Copy all static frontend files to dist
# Note: we specifically ignore the python backend files and node_modules
cp *.html *.css *.js dist/

# If there are any subdirectories that need to be public, add them here
# cp -r assets/ dist/assets/

echo "Build complete. Output directory ready for Pages deploy."
