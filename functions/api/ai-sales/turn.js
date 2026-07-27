import { jsonResponse } from '../_auth.js';
import { requireAiSalesAdmin } from './_access.js';

const DEFAULT_CLOUDFLARE_ACCOUNT_ID = '215a936bbe84f807d69a113fbbd125fe';
const DEFAULT_CLOUDFLARE_DEEPSEEK_MODEL = 'deepseek/deepseek-v4-pro';
const DEFAULT_DEEPSEEK_MODEL = 'deepseek-v4-flash';
const DEFAULT_DONE_PROBABILITY_THRESHOLD = 0.45;
const MAX_SCENARIO_CHARS = 1600;
const MAX_CONVERSATION_TURNS = 8;
const ALLOWED_CLOUDFLARE_DEEPSEEK_MODELS = new Set([
        'deepseek/deepseek-v4-flash',
        'deepseek/deepseek-v4-pro'
]);

function stripReasoning(value) {
        return String(value || '')
                .replace(/<think>[\s\S]*?<\/think>/gi, '')
                .trim();
}

function clampProbability(value, fallback = DEFAULT_DONE_PROBABILITY_THRESHOLD) {
        const number = Number(value);
        return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : fallback;
}

function deepSeekApiKey(env) {
        return env.DEEPSEEK_API_KEY ||
                env.DEEPSEEK_API_TOKEN ||
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

function cloudflareDeepSeekModel(env, requestedModel) {
        const requested = String(requestedModel || '').trim();
        return ALLOWED_CLOUDFLARE_DEEPSEEK_MODELS.has(requested)
                ? requested
                : env.CLOUDFLARE_DEEPSEEK_TURN_MODEL || env.CLOUDFLARE_DEEPSEEK_MODEL || DEFAULT_CLOUDFLARE_DEEPSEEK_MODEL;
}

function cleanConversation(value) {
        if (!Array.isArray(value)) return [];

        return value.slice(-MAX_CONVERSATION_TURNS)
                .map(turn => ({
                        role: String(turn?.role || '').trim().slice(0, 24),
                        text: String(turn?.text || '').trim().slice(0, 400)
                }))
                .filter(turn => turn.role && turn.text);
}

function parseTurnResponse(rawText, doneProbabilityThreshold) {
        const cleaned = stripReasoning(rawText);
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
                try {
                        const parsed = JSON.parse(jsonMatch[0]);
                        const doneProbability = clampProbability(parsed.doneProbability ?? parsed.done_probability, 0);
                        const rawShouldRespond = parsed.shouldRespond ?? parsed.should_respond ?? doneProbability > doneProbabilityThreshold;
                        const shouldRespond = typeof rawShouldRespond === 'string'
                                ? rawShouldRespond.toLowerCase() === 'true'
                                : Boolean(rawShouldRespond);
                        return {
                                doneProbability,
                                shouldRespond: Boolean(shouldRespond && doneProbability > doneProbabilityThreshold)
                        };
                } catch {
                        // Fall through to conservative default.
                }
        }

        return {
                doneProbability: 0,
                shouldRespond: false
        };
}

function hasCompleteTurnCue(value) {
        const text = String(value || '').trim();
        if (text.length < 12) return false;
        if (/\b(and|but|or|so|because|if|when|while|with|for|to)$/i.test(text)) return false;
        return /[?.!]$/.test(text);
}

function turnMessages({ scenario, conversation, doneProbabilityThreshold, language }) {
        const messages = [
                {
                        role: 'system',
                        content: [
                                'You are a fast real-time turn detector for an English-only sales roleplay.',
                                'Decide whether the salesperson has finished their current speaking turn.',
                                'Return only compact JSON with keys "doneProbability" and "shouldRespond".',
                                'Your entire response must start with "{" and end with "}".',
                                'No markdown, no analysis, no text other than JSON.',
                                'doneProbability is a number from 0 to 1.',
                                `Set shouldRespond to true only when doneProbability is greater than ${doneProbabilityThreshold}.`,
                                `Expected language/locale: ${language}. If the transcript is not English, set shouldRespond false and doneProbability 0.`
                        ].join('\n')
                }
        ];

        cleanConversation(conversation).forEach(turn => {
                messages.push({
                        role: turn.role === 'customer' ? 'assistant' : 'user',
                        content: `${turn.role}: ${turn.text}`
                });
        });

        messages.push({
                role: 'user',
                content: `Latest salesperson transcript:\n${scenario}`
        });

        return messages;
}

async function runCloudflareAiRest(env, apiKey, messages, requestedModel) {
        const model = cloudflareDeepSeekModel(env, requestedModel);
        const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId(env)}/ai/v1/chat/completions`, {
                method: 'POST',
                headers: {
                        Authorization: `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                        model,
                        messages,
                        response_format: { type: 'json_object' },
                        temperature: 0,
                        max_tokens: 80
                })
        });

        const result = await response.json().catch(async () => ({
                errors: [{ message: await response.text() }]
        }));

        if (!response.ok || result?.success === false) {
                const message = result?.errors?.[0]?.message || response.statusText || 'Cloudflare turn request failed.';
                throw new Error(`Cloudflare turn request failed (${response.status}): ${message}`);
        }

        return {
                rawText: result?.choices?.[0]?.message?.content ||
                        result?.result?.response ||
                        result?.result?.text ||
                        result?.response ||
                        '',
                model,
                provider: 'cloudflare-ai-rest'
        };
}

async function runDeepSeekApi(env, messages, requestedModel) {
        const apiKey = deepSeekApiKey(env);

        if (isCloudflareApiToken(apiKey)) {
                return runCloudflareAiRest(env, apiKey, messages, requestedModel);
        }

        const model = String(requestedModel || '').trim() || env.DEEPSEEK_TURN_MODEL || env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL;
        const response = await fetch('https://api.deepseek.com/chat/completions', {
                method: 'POST',
                headers: {
                        Authorization: `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                        model,
                        messages,
                        response_format: { type: 'json_object' },
                        temperature: 0,
                        max_tokens: 80,
                        stream: false
                })
        });

        if (!response.ok) {
                const detail = await response.text().catch(() => response.statusText);
                throw new Error(`DeepSeek turn request failed (${response.status}): ${detail.slice(0, 240)}`);
        }

        const result = await response.json();
        return {
                rawText: result?.choices?.[0]?.message?.content || '',
                model,
                provider: 'deepseek-api'
        };
}

async function runWorkersAi(env, messages) {
        if (!env.AI) {
                throw new Error('Cloudflare Workers AI binding is not configured.');
        }

        const model = env.AI_SALES_TURN_MODEL || env.AI_SALES_WORKERS_MODEL || '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b';
        const result = await env.AI.run(model, {
                messages,
                temperature: 0,
                max_tokens: 80
        });

        return {
                rawText: result?.response || result?.result?.response || result?.text || '',
                model,
                provider: 'workers-ai'
        };
}

export const onRequestPost = async (context) => {
        const access = await requireAiSalesAdmin(context);
        if (access.response) return access.response;

        try {
                const payload = await context.request.json();
                const scenario = String(payload.scenario || payload.message || '').trim().slice(0, MAX_SCENARIO_CHARS);
                const doneProbabilityThreshold = clampProbability(
                        payload.doneProbabilityThreshold ?? payload.settings?.doneProbability,
                        DEFAULT_DONE_PROBABILITY_THRESHOLD
                );
                const language = String(payload.language || payload.settings?.language || 'en-US').slice(0, 16);
                const requestedModel = String(payload.model || payload.settings?.deepseekTurnModel || payload.settings?.deepseekModel || '').trim();
                if (hasCompleteTurnCue(scenario)) {
                        return jsonResponse({
                                doneProbability: 0.85,
                                doneProbabilityThreshold,
                                shouldRespond: true,
                                model: 'local-complete-turn-cue',
                                provider: 'local-heuristic'
                        });
                }

                const messages = turnMessages({
                        scenario,
                        conversation: payload.conversation,
                        doneProbabilityThreshold,
                        language
                });
                const completion = deepSeekApiKey(context.env)
                        ? await runDeepSeekApi(context.env, messages, requestedModel)
                        : await runWorkersAi(context.env, messages);
                const parsed = parseTurnResponse(completion.rawText, doneProbabilityThreshold);
                const doneProbability = parsed.doneProbability;
                const shouldRespond = Boolean(parsed.shouldRespond || doneProbability > doneProbabilityThreshold);

                return jsonResponse({
                        doneProbability,
                        doneProbabilityThreshold,
                        shouldRespond,
                        model: completion.model,
                        provider: completion.provider
                });
        } catch (error) {
                return jsonResponse({ error: error.message || 'Turn detection failed.' }, 502);
        }
};
