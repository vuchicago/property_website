import { jsonResponse } from '../_auth.js';

const DEFAULT_WHISPER_MODEL = '@cf/openai/whisper';
const DEFAULT_CLOUDFLARE_ACCOUNT_ID = '215a936bbe84f807d69a113fbbd125fe';
const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

function apiToken(env) {
        return env.CLOUDFLARE_API_TOKEN ||
                env.DEEPSEEK_API_TOKEN ||
                env.DEEPSEEK_API_KEY ||
                env['DEEPSEEK-API-TOKEN'] ||
                null;
}

function isCloudflareApiToken(value) {
        return String(value || '').startsWith('cfut_');
}

function cloudflareAccountId(env) {
        return env.CLOUDFLARE_ACCOUNT_ID ||
                env.CF_ACCOUNT_ID ||
                env.ACCOUNT_ID ||
                DEFAULT_CLOUDFLARE_ACCOUNT_ID;
}

async function transcribeWithRest(env, audioBytes) {
        const token = apiToken(env);
        if (!isCloudflareApiToken(token)) {
                throw new Error('Cloudflare API token is required for local audio transcription.');
        }

        const model = env.AI_SALES_TRANSCRIBE_MODEL || DEFAULT_WHISPER_MODEL;
        const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId(env)}/ai/run/${model}`, {
                method: 'POST',
                headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                        audio: Array.from(audioBytes)
                })
        });
        const result = await response.json().catch(async () => ({
                errors: [{ message: await response.text() }]
        }));

        if (!response.ok || result?.success === false) {
                const message = result?.errors?.[0]?.message || response.statusText || 'Transcription request failed.';
                throw new Error(`Cloudflare transcription failed (${response.status}): ${message}`);
        }

        return result?.result?.text || result?.text || '';
}

async function transcribeWithBinding(env, audioBytes) {
        if (!env.AI) {
                return transcribeWithRest(env, audioBytes);
        }

        const result = await env.AI.run(env.AI_SALES_TRANSCRIBE_MODEL || DEFAULT_WHISPER_MODEL, {
                audio: Array.from(audioBytes)
        });
        return result?.text || '';
}

export const onRequestPost = async (context) => {
        try {
                const audioBuffer = await context.request.arrayBuffer();

                if (!audioBuffer.byteLength) {
                        return jsonResponse({ error: 'Audio is required.' }, 400);
                }

                if (audioBuffer.byteLength > MAX_AUDIO_BYTES) {
                        return jsonResponse({ error: 'Audio is too large.' }, 413);
                }

                const text = String(await transcribeWithBinding(context.env, new Uint8Array(audioBuffer))).trim();

                return jsonResponse({
                        text,
                        model: context.env.AI_SALES_TRANSCRIBE_MODEL || DEFAULT_WHISPER_MODEL
                });
        } catch (error) {
                return jsonResponse({ error: error.message || 'Transcription failed.' }, 502);
        }
};
