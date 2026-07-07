import { jsonResponse } from '../_auth.js';

const DEFAULT_TTS_MODEL = '@cf/deepgram/aura-2-en';
const DEFAULT_TTS_SPEAKER = 'apollo';
const DEFAULT_CLOUDFLARE_ACCOUNT_ID = '215a936bbe84f807d69a113fbbd125fe';
const MAX_TEXT_CHARS = 1000;

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

function audioResponse(body, init = {}) {
        return new Response(body, {
                ...init,
                headers: {
                        'Content-Type': init.contentType || 'audio/mpeg',
                        'Cache-Control': 'no-store',
                        ...(init.headers || {})
                }
        });
}

function bytesFromArray(value) {
        if (!Array.isArray(value)) return null;
        return Uint8Array.from(value.map(item => Number(item) || 0));
}

function bytesFromBase64(value) {
        const text = String(value || '');
        if (!text) return null;

        const binary = atob(text);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
                bytes[index] = binary.charCodeAt(index);
        }
        return bytes;
}

async function normalizeAudioResult(result) {
        if (result instanceof Response) {
                const contentType = result.headers.get('content-type') || 'audio/mpeg';
                return audioResponse(result.body, { status: result.status, contentType });
        }

        if (result instanceof ReadableStream) {
                return audioResponse(result);
        }

        if (result instanceof ArrayBuffer) {
                return audioResponse(result);
        }

        if (ArrayBuffer.isView(result)) {
                return audioResponse(result);
        }

        const bytes = bytesFromArray(result?.audio) ||
                bytesFromArray(result?.result?.audio) ||
                bytesFromBase64(result?.audio) ||
                bytesFromBase64(result?.result?.audio) ||
                bytesFromBase64(result?.base64) ||
                bytesFromBase64(result?.result?.base64);

        if (bytes) {
                return audioResponse(bytes);
        }

        throw new Error('Cloudflare TTS returned an unsupported audio format.');
}

async function synthesizeWithRest(env, payload) {
        const token = apiToken(env);
        if (!isCloudflareApiToken(token)) {
                throw new Error('Cloudflare API token is required for local TTS.');
        }

        const model = env.AI_SALES_TTS_MODEL || DEFAULT_TTS_MODEL;
        const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId(env)}/ai/run/${model}`, {
                method: 'POST',
                headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        Accept: 'audio/mpeg'
                },
                body: JSON.stringify(payload)
        });

        const contentType = response.headers.get('content-type') || '';
        if (!response.ok) {
                const detail = contentType.includes('json')
                        ? JSON.stringify(await response.json().catch(() => ({})))
                        : await response.text().catch(() => response.statusText);
                throw new Error(`Cloudflare TTS failed (${response.status}): ${detail.slice(0, 240)}`);
        }

        if (contentType.startsWith('audio/') || contentType === 'application/octet-stream') {
                return audioResponse(response.body, { contentType: contentType || 'audio/mpeg' });
        }

        const result = await response.json();
        if (result?.success === false) {
                const message = result?.errors?.[0]?.message || 'Cloudflare TTS request failed.';
                throw new Error(message);
        }

        return normalizeAudioResult(result?.result || result);
}

async function synthesizeWithBinding(env, payload) {
        if (!env.AI) {
                return synthesizeWithRest(env, payload);
        }

        const result = await env.AI.run(env.AI_SALES_TTS_MODEL || DEFAULT_TTS_MODEL, payload);
        return normalizeAudioResult(result);
}

export const onRequestPost = async (context) => {
        try {
                const payload = await context.request.json();
                const text = String(payload.text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT_CHARS);

                if (!text) {
                        return jsonResponse({ error: 'Text is required.' }, 400);
                }

                return await synthesizeWithBinding(context.env, {
                        text,
                        speaker: String(payload.speaker || context.env.AI_SALES_TTS_SPEAKER || DEFAULT_TTS_SPEAKER),
                        encoding: String(payload.encoding || 'mp3')
                });
        } catch (error) {
                return jsonResponse({ error: error.message || 'TTS failed.' }, 502);
        }
};
