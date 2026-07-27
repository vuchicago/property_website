import { jsonResponse } from '../_auth.js';
import { requireAiSalesAdmin } from './_access.js';

const FLUX_MODEL = '@cf/deepgram/flux';

function numberParam(url, name, fallback, min, max) {
        const rawValue = url.searchParams.get(name);
        if (rawValue === null || rawValue === '') return String(fallback);
        const value = Number(rawValue);
        if (!Number.isFinite(value)) return String(fallback);
        return String(Math.max(min, Math.min(max, value)));
}

export const onRequestGet = async (context) => {
        const access = await requireAiSalesAdmin(context, { allowWebSocketToken: true });
        if (access.response) return access.response;

        if (context.request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
                return jsonResponse({ error: 'A WebSocket upgrade is required.' }, 426);
        }

        if (!context.env.AI) {
                return jsonResponse({ error: 'Workers AI binding is unavailable.' }, 503);
        }

        try {
                const url = new URL(context.request.url);
                return await context.env.AI.run(
                        context.env.AI_SALES_FLUX_MODEL || FLUX_MODEL,
                        {
                                encoding: 'linear16',
                                sample_rate: '16000',
                                eot_threshold: numberParam(url, 'eot_threshold', 0.7, 0.5, 0.9),
                                eager_eot_threshold: numberParam(url, 'eager_eot_threshold', 0.55, 0.3, 0.9),
                                eot_timeout_ms: numberParam(url, 'eot_timeout_ms', 4000, 500, 60000)
                        },
                        { websocket: true }
                );
        } catch (error) {
                return jsonResponse({ error: error.message || 'Flux connection failed.' }, 502);
        }
};
