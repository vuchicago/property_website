import { jsonResponse } from '../_auth.js';

function deepSeekApiKey(env) {
        return env.DEEPSEEK_API_KEY ||
                env.DEEPSEEK_API_TOKEN ||
                env['DEEPSEEK-API-TOKEN'] ||
                null;
}

function isCloudflareApiToken(value) {
        return String(value || '').startsWith('cfut_');
}

export const onRequestGet = async (context) => {
        const apiKey = deepSeekApiKey(context.env);
        const hasDeepSeekApiKey = Boolean(apiKey && !isCloudflareApiToken(apiKey));
        const hasCloudflareApiKey = Boolean(apiKey && isCloudflareApiToken(apiKey));

        return jsonResponse({
                renderer: {
                        engine: 'Three.js WebGL realistic GLB avatar',
                        available: true,
                        gpuRequired: 'browser_webgl',
                        model: 'John AvatarSDK male facial rig'
                },
                speech: {
                        engine: context.env.AI_SALES_TTS_MODEL || '@cf/deepgram/aura-2-en',
                        available: true,
                        provider: context.env.AI || hasCloudflareApiKey ? 'Cloudflare Workers AI' : 'Browser SpeechSynthesis fallback',
                        fallback: 'Browser SpeechSynthesis'
                },
                coach: {
                        engine: hasDeepSeekApiKey
                                ? 'DeepSeek API'
                                : hasCloudflareApiKey
                                        ? 'Cloudflare Workers AI REST'
                                        : 'Cloudflare Workers AI',
                        available: hasDeepSeekApiKey || hasCloudflareApiKey || Boolean(context.env.AI),
                        model: hasDeepSeekApiKey
                                ? context.env.DEEPSEEK_MODEL || 'deepseek-v4-flash'
                                : hasCloudflareApiKey
                                        ? context.env.CLOUDFLARE_DEEPSEEK_MODEL || 'deepseek/deepseek-v4-pro'
                                        : context.env.AI_SALES_WORKERS_MODEL || '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b'
                },
                lipSync: {
                        engine: 'Real-time text-to-viseme scheduler',
                        available: true,
                        latencyMs: 0
                }
        });
};
