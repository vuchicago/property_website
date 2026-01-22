# Run from the project root
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
docker run -p 7860:7860 -v /app/.venv -v "$PROJECT_ROOT":/app -w /app property_tax:latest