import { jsonResponse } from '../_auth.js';

const DEFAULT_WORKERS_AI_MODEL = '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b';
const DEFAULT_DEEPSEEK_MODEL = 'deepseek-v4-flash';
const DEFAULT_CLOUDFLARE_DEEPSEEK_MODEL = 'deepseek/deepseek-v4-pro';
const DEFAULT_CLOUDFLARE_ACCOUNT_ID = '215a936bbe84f807d69a113fbbd125fe';
const DEFAULT_DONE_PROBABILITY_THRESHOLD = 0.5;
const MAX_SCENARIO_CHARS = 1600;
const MAX_ROLE_GUIDE_CHARS = 6000;
const MAX_CONVERSATION_TURNS = 8;
const EXPRESSIONS = new Set([
        'happy',
        'friendly',
        'curious',
        'confident',
        'doubtful',
        'concerned',
        'disappointed',
        'angry',
        'scornful',
        'neutral'
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

function parseCoachResponse(rawText, doneProbabilityThreshold = DEFAULT_DONE_PROBABILITY_THRESHOLD) {
        const cleaned = stripReasoning(rawText);
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
                try {
                        const parsed = JSON.parse(jsonMatch[0]);
                        const doneProbability = Number(parsed.doneProbability ?? parsed.done_probability ?? 1);
                        const rawShouldRespond = parsed.shouldRespond ?? parsed.should_respond ?? doneProbability > doneProbabilityThreshold;
                        const shouldRespond = typeof rawShouldRespond === 'string'
                                ? rawShouldRespond.toLowerCase() === 'true'
                                : Boolean(rawShouldRespond);
                        return {
                                text: String(parsed.text || '').trim(),
                                expression: String(parsed.expression || 'friendly').trim().toLowerCase(),
                                doneProbability: clampProbability(doneProbability, 1),
                                shouldRespond: Boolean(shouldRespond)
                        };
                } catch {
                        // Fall through to plain text handling.
                }
        }

        return {
                text: cleaned.replace(/^["']|["']$/g, '').trim(),
                expression: 'friendly',
                doneProbability: cleaned ? 1 : 0,
                shouldRespond: Boolean(cleaned)
        };
}

function limitSentence(value) {
        const text = String(value || '')
                .replace(/\s+/g, ' ')
                .trim();
        if (text.length <= 280) {
                return text;
        }
        return `${text.slice(0, 277).trim()}...`;
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

function cleanConversation(value) {
        if (!Array.isArray(value)) return [];

        return value.slice(-MAX_CONVERSATION_TURNS)
                .map(turn => ({
                        role: String(turn?.role || '').trim().slice(0, 24),
                        text: String(turn?.text || '').trim().slice(0, 600)
                }))
                .filter(turn => turn.role && turn.text);
}

function coachMessages({ scenario, requestedExpression, voice, roleGuide, conversation, doneProbabilityThreshold, language, forceRespond }) {
        const systemContent = [
                'You are the brain of a real-time sales roleplay avatar.',
                `This roleplay is English-only. Expected language/locale: ${language}.`,
                'If the salesperson transcript is not English, do not continue that language; respond in English asking them to continue in English.',
                'You must understand the salesperson transcript, decide if they are done speaking, choose an emotional reaction, and respond as the buyer only when appropriate.',
                forceRespond
                        ? 'A turn detector has already decided the salesperson finished. Generate the buyer response now; set shouldRespond true.'
                        : 'Use doneProbability to decide whether to respond now.',
                'Return only compact JSON with keys "doneProbability", "shouldRespond", "text", and "expression".',
                'Your entire response must start with "{" and end with "}".',
                'Do not include reasoning, analysis, markdown, or <think> tags.',
                'doneProbability is your estimate from 0 to 1 that the salesperson has finished their turn.',
                `Set shouldRespond to true only when doneProbability is greater than ${doneProbabilityThreshold}.`,
                'If shouldRespond is false, set text to an empty string and still choose an expression.',
                'The text must be one natural spoken line, 12 to 32 words, no markdown.',
                'Use a realistic buyer tone. You are the customer, not the sales coach.',
                `Expression must be one of: ${Array.from(EXPRESSIONS).join(', ')}.`
        ];

        if (roleGuide) {
                systemContent.push(`Role guide:\n${roleGuide}`);
        }

        const messages = [
                {
                        role: 'system',
                        content: systemContent.join('\n\n')
                }
        ];

        cleanConversation(conversation).forEach(turn => {
                messages.push({
                        role: turn.role === 'customer' ? 'assistant' : 'user',
                        content: `${turn.role}: ${turn.text}`
                });
        });

        messages.push(
                {
                        role: 'user',
                        content: [
                                `Voice profile: ${voice}.`,
                                `Current expression: ${requestedExpression}.`,
                                scenario
                                        ? `Latest salesperson transcript: ${scenario}`
                                        : 'Start the roleplay as the customer.'
                        ].join('\n')
                }
        );

        return messages;
}

async function runDeepSeekApi(env, messages) {
        const apiKey = deepSeekApiKey(env);

        if (isCloudflareApiToken(apiKey)) {
                return runCloudflareAiRest(env, apiKey, messages);
        }

        const model = env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL;
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
                        temperature: 0.6,
                        max_tokens: 700,
                        stream: false
                })
        });

        if (!response.ok) {
                let detail = '';
                try {
                        detail = await response.text();
                } catch {
                        detail = response.statusText;
                }
                throw new Error(`DeepSeek API request failed (${response.status}): ${detail.slice(0, 240)}`);
        }

        const result = await response.json();
        return {
                rawText: result?.choices?.[0]?.message?.content || '',
                model,
                provider: 'deepseek-api'
        };
}

async function runCloudflareAiRest(env, apiKey, messages) {
        const accountId = cloudflareAccountId(env);
        const model = env.CLOUDFLARE_DEEPSEEK_MODEL || DEFAULT_CLOUDFLARE_DEEPSEEK_MODEL;
        const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`, {
                method: 'POST',
                headers: {
                        Authorization: `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                        model,
                        messages,
                        response_format: { type: 'json_object' },
                        temperature: 0.6,
                        max_tokens: 700
                })
        });

        const result = await response.json().catch(async () => ({
                errors: [{ message: await response.text() }]
        }));

        if (!response.ok || result?.success === false) {
                const message = result?.errors?.[0]?.message || response.statusText || 'Cloudflare Workers AI request failed.';
                throw new Error(`Cloudflare Workers AI request failed (${response.status}): ${message}`);
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

async function runWorkersAi(env, messages) {
        if (!env.AI) {
                throw new Error('Cloudflare Workers AI binding is not configured.');
        }

        const model = env.AI_SALES_WORKERS_MODEL || DEFAULT_WORKERS_AI_MODEL;
        const result = await env.AI.run(model, {
                messages,
                temperature: 0.6,
                max_tokens: 700
        });

        return {
                rawText: result?.response || result?.result?.response || result?.text || '',
                model,
                provider: 'workers-ai'
        };
}

export const onRequestPost = async (context) => {
        try {
                const payload = await context.request.json();
                const scenario = String(payload.scenario || payload.message || '').trim().slice(0, MAX_SCENARIO_CHARS);
                const requestedExpression = String(payload.expression || 'friendly').trim().toLowerCase();
                const voice = String(payload.voice || 'male').trim().toLowerCase();
                const language = String(payload.language || payload.settings?.language || 'en-US').slice(0, 16);
                const roleGuide = String(payload.roleGuide || '').trim().slice(0, MAX_ROLE_GUIDE_CHARS);
                const forceRespond = Boolean(payload.forceRespond);
                const doneProbabilityThreshold = clampProbability(
                        payload.doneProbabilityThreshold ?? payload.settings?.doneProbability,
                        DEFAULT_DONE_PROBABILITY_THRESHOLD
                );
                const messages = coachMessages({
                        scenario,
                        requestedExpression,
                        voice,
                        roleGuide,
                        conversation: payload.conversation,
                        doneProbabilityThreshold,
                        language,
                        forceRespond
                });
                const completion = deepSeekApiKey(context.env)
                        ? await runDeepSeekApi(context.env, messages)
                        : await runWorkersAi(context.env, messages);
                const rawText = completion.rawText;
                const parsed = parseCoachResponse(rawText, doneProbabilityThreshold);
                const text = limitSentence(parsed.text);
                const expression = EXPRESSIONS.has(parsed.expression) ? parsed.expression : 'friendly';
                const doneProbability = Number.isFinite(parsed.doneProbability) ? parsed.doneProbability : (text ? 1 : 0);
                const shouldRespond = forceRespond
                        ? Boolean(text)
                        : Boolean(parsed.shouldRespond && doneProbability > doneProbabilityThreshold);
                const responseText = shouldRespond ? text : '';

                if (shouldRespond && !responseText) {
                        return jsonResponse({ error: 'DeepSeek returned an empty coaching line.' }, 502);
                }

                return jsonResponse({
                        text: responseText,
                        expression,
                        doneProbability,
                        doneProbabilityThreshold,
                        shouldRespond,
                        model: completion.model,
                        provider: completion.provider
                });
        } catch (error) {
                return jsonResponse({ error: error.message || 'DeepSeek coaching failed.' }, 502);
        }
};
