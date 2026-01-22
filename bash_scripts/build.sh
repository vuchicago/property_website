# Build from the project root (one level up from this script)
cd "$(dirname "$0")/.."
docker build --no-cache -t property_tax:latest .