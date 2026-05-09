import { requireFirebaseUser, jsonResponse } from './_auth.js';
import { getAddressSuggestions } from './_property_addresses.js';

export const onRequestGet = async (context) => {
        const { response } = await requireFirebaseUser(context.request);

        if (response) {
                return response;
        }

        if (!context.env.DB) {
                return jsonResponse({ error: 'Database not configured' }, 500);
        }

        try {
                const url = new URL(context.request.url);
                const query = url.searchParams.get('q') || '';
                const limit = Math.min(Number(url.searchParams.get('limit') || 8), 12);
                const suggestions = await getAddressSuggestions(context.env.DB, query, limit);

                return jsonResponse({
                        suggestions: suggestions.map(item => ({
                                id: item.id,
                                pin: item.pin,
                                address: item.address,
                                score: item.score
                        }))
                });
        } catch (err) {
                return jsonResponse({ error: err.message }, 500);
        }
};
