# AI Sales Trainer

Static avatar app integrated into vu-web at `/ai-sales/`.

## Runtime

- Static files are served from `ai-sales/`.
- Cloudflare Pages Functions live under `/api/ai-sales/`.
- `Generate Reply` uses direct DeepSeek when `DEEPSEEK_API_TOKEN` is a DeepSeek key. When the token starts with `cfut_`, it uses Cloudflare's OpenAI-compatible Workers AI endpoint with a hosted DeepSeek model. If no token is present, it falls back to the existing Cloudflare Workers AI binding.
- `Listen` uses browser SpeechRecognition when available. If unavailable, it records microphone audio and transcribes it with Cloudflare Workers AI Whisper.
- `Speak` uses the browser's built-in `SpeechSynthesis` voices.

## Secrets

`ai-sales/.env` is ignored by git and stripped from `dist/ai-sales/` during build.

Prefer underscore names for env vars:

```bash
DEEPSEEK_API_TOKEN=your_token_here
```

This can be either a DeepSeek API key or a Cloudflare `cfut_...` API token.
Cloudflare tokens call `/ai/v1/chat/completions` and use `CLOUDFLARE_DEEPSEEK_MODEL`.

For deployed Pages, set the token as a Cloudflare secret:

```bash
wrangler pages secret put DEEPSEEK_API_TOKEN --project-name cookcountytaxcomparev2
```

Use `DEEPSEEK_MODEL` in `wrangler.jsonc` to switch the direct DeepSeek API model.
Use `CLOUDFLARE_DEEPSEEK_MODEL` to switch the Cloudflare-hosted DeepSeek model.
Use `AI_SALES_TRANSCRIBE_MODEL` to switch the Cloudflare transcription model.
Use `AI_SALES_WORKERS_MODEL` to switch the Cloudflare Workers AI model.

## Build

Run the normal vu-web build:

```bash
bash build.sh
```

The build copies this directory into `dist/ai-sales/` and copies functions into `dist/functions/`.

## Local Test Server

If `wrangler pages dev` fails while starting Cloudflare's remote edge preview session, use the lightweight local test server:

```bash
bash build.sh
node scripts/dev_ai_sales_server.mjs 8788
```

Then open:

```text
http://127.0.0.1:8788/ai-sales/
```

This serves `dist/` and runs the local `/api/ai-sales/coach` route with `ai-sales/.env`.
