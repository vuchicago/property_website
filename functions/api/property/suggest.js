import { jsonResponse } from '../_auth.js';
import { getAddressSuggestions } from '../_property_addresses.js';

function normalizePinQuery(query) {
        const pin = String(query || '').replace(/\D/g, '');
        return pin.length === 10 || pin.length === 14 ? pin : '';
}

async function getPinSuggestions(db, pin, limit) {
        const column = pin.length === 10 ? 'pin10' : 'pin';
        const { results } = await db.prepare(
                `SELECT id, pin, pin AS property_key, mailing_name, pin_proration_rate, address
                 FROM property_addresses
                 WHERE ${column} = ?
                 ORDER BY pin_proration_rate DESC, id
                 LIMIT ?`
        ).bind(pin, limit).all();

        return (results || []).map(row => ({
                ...row,
                score: 10000
        }));
}

export const onRequestGet = async (context) => {
        if (!context.env.DB) {
                return jsonResponse({ error: 'Database not configured' }, 500);
        }

        try {
                const url = new URL(context.request.url);
                const query = url.searchParams.get('q') || '';
                const limit = Math.min(Number(url.searchParams.get('limit') || 5), 5);
                const pin = normalizePinQuery(query);
                const suggestions = pin
                        ? await getPinSuggestions(context.env.DB, pin, limit)
                        : await getAddressSuggestions(context.env.DB, query, limit);

                return jsonResponse({
                        suggestions: suggestions.map(item => ({
                                id: item.id,
                                pin: item.pin,
                                propertyKey: item.property_key,
                                mailingName: item.mailing_name,
                                pinProrationRate: item.pin_proration_rate,
                                address: item.address,
                                score: item.score
                        }))
                });
        } catch (err) {
                return jsonResponse({ error: err.message }, 500);
        }
};
