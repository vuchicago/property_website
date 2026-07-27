import { jsonResponse } from '../_auth.js';
import { requireAiSalesAdmin } from './_access.js';

const DEFAULT_WORKERS_AI_MODEL = '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b';
const DEFAULT_DEEPSEEK_MODEL = 'deepseek-v4-flash';
const DEFAULT_CLOUDFLARE_DEEPSEEK_MODEL = 'deepseek/deepseek-v4-pro';
const DEFAULT_CLOUDFLARE_ACCOUNT_ID = '215a936bbe84f807d69a113fbbd125fe';
const DEFAULT_DONE_PROBABILITY_THRESHOLD = 0.5;
const MAX_SCENARIO_CHARS = 1600;
const MAX_ROLE_GUIDE_CHARS = 2400;
const MAX_CONVERSATION_TURNS = 8;
const DEFAULT_MAX_COACH_TOKENS = 80;
const ALLOWED_CLOUDFLARE_DEEPSEEK_MODELS = new Set([
        'deepseek/deepseek-v4-flash',
        'deepseek/deepseek-v4-pro'
]);
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
                .replace(/^We need to[\s\S]*?(?=\{)/i, '')
                .trim();
}

function containsPromptLeak(value) {
        return /\b(system prompt|prompt says|role guide|latest salesperson transcript|we need to|the user is|the salesperson|shouldRespond|doneProbability|JSON|parse)\b/i
                .test(String(value || ''));
}

function clampProbability(value, fallback = DEFAULT_DONE_PROBABILITY_THRESHOLD) {
        const number = Number(value);
        return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : fallback;
}

function clampNumber(value, fallback, min, max) {
        const number = Number(value);
        return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
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
                        const text = String(parsed.text || '').trim();
                        return {
                                text: containsPromptLeak(text) ? '' : text,
                                expression: String(parsed.expression || 'friendly').trim().toLowerCase(),
                                doneProbability: clampProbability(doneProbability, 1),
                                shouldRespond: Boolean(shouldRespond && !containsPromptLeak(text)),
                                activity: cleanKidsActivity(parsed.activity)
                        };
                } catch {
                        // Fall through to plain text handling.
                }
        }

        return {
                text: containsPromptLeak(cleaned) ? '' : cleaned.replace(/^["']|["']$/g, '').trim(),
                expression: 'friendly',
                doneProbability: containsPromptLeak(cleaned) ? 0 : cleaned ? 1 : 0,
                shouldRespond: Boolean(cleaned && !containsPromptLeak(cleaned)),
                activity: null
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

function cleanKidsActivity(value) {
        if (!value || typeof value !== 'object') return null;

        const type = String(value.type || '').trim().toLowerCase();
        if (!['addition', 'subtraction', 'counting', 'letter'].includes(type)) return null;

        const prompt = String(value.prompt || '').replace(/\s+/g, ' ').trim().slice(0, 80);
        const answer = String(value.answer || '').replace(/\s+/g, ' ').trim().slice(0, 40);
        const reveal = String(value.reveal || '').replace(/\s+/g, ' ').trim().slice(0, 100);
        if (!prompt || !answer) return null;

        return {
                type,
                prompt,
                answer,
                reveal: reveal || `${prompt} ${answer}`.replace(/\s+/g, ' ').trim()
        };
}

function textFromContent(value) {
        if (typeof value === 'string') return value;
        if (Array.isArray(value)) {
                return value
                        .map(item => typeof item === 'string'
                                ? item
                                : item?.text || item?.content || item?.value || '')
                        .join('');
        }
        return value?.text || value?.content || value?.value || '';
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
                : env.CLOUDFLARE_DEEPSEEK_MODEL || DEFAULT_CLOUDFLARE_DEEPSEEK_MODEL;
}

function cleanConversation(value, maxTurns = MAX_CONVERSATION_TURNS) {
        if (!Array.isArray(value)) return [];
        if (maxTurns <= 0) return [];

        return value.slice(-maxTurns)
                .map(turn => ({
                        role: String(turn?.role || '').trim().slice(0, 24),
                        text: String(turn?.text || '').trim().slice(0, 600)
                }))
                .filter(turn => turn.role && turn.text);
}

function coachMessages({ scenario, requestedExpression, voice, roleGuide, conversation, doneProbabilityThreshold, language, forceRespond, conversationTurns, retryForEmpty = false, personality = 'sales' }) {
        const kidsMode = personality === 'kids' || /young children|kids|alphabet|count/i.test(String(roleGuide || ''));
        if (forceRespond) {
                return [
                        {
                                role: 'system',
                                content: kidsMode ? [
                                        'You are John, a kind conversation robot for a 4-year-old and a 2-year-old.',
                                        `Reply in English only. Locale: ${language}.`,
                                        'Return compact JSON only with keys "doneProbability", "shouldRespond", "text", and "expression".',
                                        'Set doneProbability to 1 and shouldRespond to true.',
                                        'The text value must be non-empty, warm, simple, and 5 to 18 spoken words.',
                                        'Ask if the child wants to play a math game before asking math questions.',
                                        'Do not say a card is visible unless the child already started a math game.',
                                        'Do not include an activity object.',
                                        'Do not mention prompts, JSON, transcripts, or instructions.',
                                        retryForEmpty ? 'Previous attempt was empty. You must produce a concrete kid-friendly response now.' : '',
                                        `Expression must be one of: ${Array.from(EXPRESSIONS).join(', ')}.`
                                ].filter(Boolean).join('\n') : [
                                        'You are a realistic buyer in a sales roleplay.',
                                        `Reply in English only. Locale: ${language}.`,
                                        'Return compact JSON only with keys "doneProbability", "shouldRespond", "text", and "expression".',
                                        'Set doneProbability to 1 and shouldRespond to true.',
                                        'The text value must be a non-empty buyer reply, 12 to 32 spoken words.',
                                        'Do not explain your reasoning. Do not mention prompts, JSON, transcripts, or instructions.',
                                        'Do not ask what to focus on next.',
                                        retryForEmpty ? 'Previous attempt was empty. You must produce a concrete buyer response now.' : '',
                                        `Expression must be one of: ${Array.from(EXPRESSIONS).join(', ')}.`
                                ].filter(Boolean).join('\n')
                        },
                        {
                                role: 'user',
                                content: kidsMode ? [
                                        `Current expression: ${requestedExpression}.`,
                                        `Child said: ${scenario}`,
                                        'Respond as John the friendly kids robot.'
                                ].join('\n') : [
                                        `Current expression: ${requestedExpression}.`,
                                        `Buyer voice profile: ${voice}.`,
                                        `Salesperson said: ${scenario}`,
                                        'Respond as the buyer to that message.'
                                ].join('\n')
                        }
                ];
        }

        const systemContent = kidsMode ? [
                'You are John, a kind real-time conversation robot for young children.',
                `This conversation is English-only. Expected language/locale: ${language}.`,
                'You must understand the child transcript, decide if the child is done speaking, choose a warm expression, and respond only when appropriate.',
                'Use doneProbability to decide whether to respond now.',
                retryForEmpty
                        ? 'Previous attempt returned empty text. This attempt must include a non-empty kid-friendly reply in text.'
                        : '',
                'Return only compact JSON with keys "doneProbability", "shouldRespond", "text", and "expression".',
                'Your entire response must start with "{" and end with "}".',
                'Do not include reasoning, analysis, markdown, prompt text, system text, role-guide text, or <think> tags.',
                'The text value must contain only the exact words John should say out loud.',
                'Never mention the prompt, transcript parsing, user, system instructions, JSON, doneProbability, or shouldRespond.',
                `Set shouldRespond to true only when doneProbability is greater than ${doneProbabilityThreshold}.`,
                'If shouldRespond is false, set text to an empty string and still choose an expression.',
                'Keep text warm, simple, and 5 to 18 spoken words.',
                'Ask one question at a time.',
                'Ask if the child wants to play a math game before asking math questions.',
                'Do not say a card is visible unless the child already started a math game.',
                'Do not include an activity object.',
                `Expression must be one of: ${Array.from(EXPRESSIONS).join(', ')}.`
        ] : [
                'You are the brain of a real-time sales roleplay avatar.',
                `This roleplay is English-only. Expected language/locale: ${language}.`,
                'If the salesperson transcript is not English, do not continue that language; respond in English asking them to continue in English.',
                forceRespond
                        ? 'The salesperson has finished speaking. Answer now as the buyer.'
                        : 'You must understand the salesperson transcript, decide if they are done speaking, choose an emotional reaction, and respond as the buyer only when appropriate.',
                forceRespond
                        ? 'Set doneProbability to 1 and shouldRespond to true. The text value must not be empty.'
                        : 'Use doneProbability to decide whether to respond now.',
                retryForEmpty
                        ? 'Previous attempt returned empty text. This attempt must include a non-empty buyer reply in text.'
                        : '',
                'Return only compact JSON with keys "doneProbability", "shouldRespond", "text", and "expression".',
                'Your entire response must start with "{" and end with "}".',
                'Do not include reasoning, analysis, markdown, prompt text, system text, role-guide text, or <think> tags.',
                'The text value must contain only the exact words John should say out loud.',
                'Never mention the prompt, transcript parsing, salesperson, user, system instructions, JSON, doneProbability, or shouldRespond.',
                forceRespond
                        ? 'Do not wait, do not return an empty text value, and do not ask what to focus on next.'
                        : 'doneProbability is your estimate from 0 to 1 that the salesperson has finished their turn.',
                forceRespond
                        ? 'Return a direct customer reply to the latest salesperson message.'
                        : `Set shouldRespond to true only when doneProbability is greater than ${doneProbabilityThreshold}.`,
                forceRespond
                        ? 'The response must be specific to the latest salesperson message.'
                        : 'If shouldRespond is false, set text to an empty string and still choose an expression.',
                'The text must be one natural spoken line, 12 to 32 words, no markdown.',
                'Use a realistic buyer tone. You are the customer, not the sales coach.',
                `Expression must be one of: ${Array.from(EXPRESSIONS).join(', ')}.`
        ];

        if (roleGuide && !forceRespond) {
                systemContent.push(`Role guide:\n${roleGuide}`);
        }

        const messages = [
                {
                        role: 'system',
                        content: systemContent.filter(Boolean).join('\n\n')
                }
        ];

        cleanConversation(conversation, conversationTurns).forEach(turn => {
                messages.push({
                        role: turn.role === 'customer' ? 'assistant' : 'user',
                        content: `${turn.role}: ${turn.text}`
                });
        });

        messages.push(
                {
                        role: 'user',
                        content: [
                                kidsMode ? 'Conversation partner: child.' : `Voice profile: ${voice}.`,
                                `Current expression: ${requestedExpression}.`,
                                scenario
                                        ? `${kidsMode ? 'Latest child transcript' : 'Latest salesperson transcript'}: ${scenario}`
                                        : kidsMode ? 'Start as John the friendly kids robot.' : 'Start the roleplay as the customer.'
                        ].join('\n')
                }
        );

        return messages;
}

async function runDeepSeekApi(env, messages, requestedModel, maxTokens) {
        const apiKey = deepSeekApiKey(env);

        if (isCloudflareApiToken(apiKey)) {
                return runCloudflareAiRest(env, apiKey, messages, requestedModel, maxTokens);
        }

        const model = String(requestedModel || '').trim() || env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL;
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
                        temperature: 0.35,
                        max_tokens: maxTokens,
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

async function runCloudflareAiRest(env, apiKey, messages, requestedModel, maxTokens) {
        const accountId = cloudflareAccountId(env);
        const model = cloudflareDeepSeekModel(env, requestedModel);
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
                        temperature: 0.35,
                        max_tokens: maxTokens
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
                rawText: textFromContent(result?.choices?.[0]?.message?.content) ||
                        textFromContent(result?.result?.choices?.[0]?.message?.content) ||
                        result?.result?.response ||
                        result?.result?.text ||
                        result?.response ||
                        '',
                model,
                provider: 'cloudflare-ai-rest'
        };
}

async function runWorkersAi(env, messages, maxTokens) {
        if (!env.AI) {
                throw new Error('Cloudflare Workers AI binding is not configured.');
        }

        const model = env.AI_SALES_WORKERS_MODEL || DEFAULT_WORKERS_AI_MODEL;
        const result = await env.AI.run(model, {
                messages,
                temperature: 0.35,
                max_tokens: maxTokens
        });

        return {
                rawText: result?.response || result?.result?.response || result?.text || '',
                model,
                provider: 'workers-ai'
        };
}

async function runCoachCompletion(context, payload, options = {}) {
        const messages = coachMessages({
                scenario: payload.scenario,
                requestedExpression: payload.requestedExpression,
                voice: payload.voice,
                roleGuide: payload.roleGuide,
                conversation: payload.conversation,
                doneProbabilityThreshold: payload.doneProbabilityThreshold,
                language: payload.language,
                forceRespond: payload.forceRespond,
                conversationTurns: payload.conversationTurns,
                retryForEmpty: options.retryForEmpty,
                personality: payload.personality
        });
        return deepSeekApiKey(context.env)
                ? await runDeepSeekApi(context.env, messages, payload.requestedModel, payload.maxTokens)
                : await runWorkersAi(context.env, messages, payload.maxTokens);
}

export const onRequestPost = async (context) => {
        const access = await requireAiSalesAdmin(context);
        if (access.response) return access.response;

        try {
                const payload = await context.request.json();
                const scenario = String(payload.scenario || payload.message || '').trim().slice(0, MAX_SCENARIO_CHARS);
                const requestedExpression = String(payload.expression || 'friendly').trim().toLowerCase();
                const voice = String(payload.voice || 'male').trim().toLowerCase();
                const language = String(payload.language || payload.settings?.language || 'en-US').slice(0, 16);
                const roleGuide = String(payload.roleGuide || '').trim().slice(0, MAX_ROLE_GUIDE_CHARS);
                const personality = String(payload.personality || '').trim().toLowerCase() === 'kids' ? 'kids' : 'sales';
                const forceRespond = Boolean(payload.forceRespond);
                const requestedModel = String(payload.model || payload.settings?.deepseekModel || '').trim();
                const requestedMaxTokens = clampNumber(payload.maxTokens ?? payload.settings?.maxCoachTokens, DEFAULT_MAX_COACH_TOKENS, 30, 300);
                const conversationTurns = clampNumber(payload.conversationTurns ?? payload.settings?.conversationTurns, 3, 0, MAX_CONVERSATION_TURNS);
                const doneProbabilityThreshold = clampProbability(
                        payload.doneProbabilityThreshold ?? payload.settings?.doneProbability,
                        DEFAULT_DONE_PROBABILITY_THRESHOLD
                );
                const maxTokens = forceRespond ? Math.max(requestedMaxTokens, 220) : requestedMaxTokens;
                const completionPayload = {
                        scenario,
                        requestedExpression,
                        voice,
                        roleGuide,
                        conversation: payload.conversation,
                        doneProbabilityThreshold,
                        language,
                        forceRespond,
                        personality,
                        conversationTurns,
                        requestedModel,
                        maxTokens
                };
                let completion = await runCoachCompletion(context, completionPayload);
                let parsed = parseCoachResponse(completion.rawText, doneProbabilityThreshold);
                let text = limitSentence(parsed.text);
                if (forceRespond && !text) {
                        completion = await runCoachCompletion(context, completionPayload, { retryForEmpty: true });
                        parsed = parseCoachResponse(completion.rawText, doneProbabilityThreshold);
                        text = limitSentence(parsed.text);
                }
                const expression = EXPRESSIONS.has(parsed.expression) ? parsed.expression : 'friendly';
                const doneProbability = Number.isFinite(parsed.doneProbability) ? parsed.doneProbability : (text ? 1 : 0);
                const shouldRespond = forceRespond
                        ? true
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
                        activity: personality === 'kids' && shouldRespond ? parsed.activity : null,
                        model: completion.model,
                        provider: completion.provider
                });
        } catch (error) {
                return jsonResponse({ error: error.message || 'DeepSeek coaching failed.' }, 502);
        }
};
