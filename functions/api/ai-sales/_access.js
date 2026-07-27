import { jsonResponse, requireFirebaseUser } from '../_auth.js';

export const AI_SALES_ADMIN_EMAIL = 'vuchicago@gmail.com';

export async function requireAiSalesAdmin(context, options = {}) {
        let websocketToken = null;
        if (options.allowWebSocketToken) {
                websocketToken = new URL(context.request.url).searchParams.get('access_token');
        }

        const authResult = await requireFirebaseUser(context.request, websocketToken);
        if (authResult.response) {
                return {
                        response: jsonResponse({ error: 'Please sign in to access AI Sales.' }, 401)
                };
        }

        const email = String(authResult.user?.email || '').trim().toLowerCase();
        if (email !== AI_SALES_ADMIN_EMAIL) {
                return {
                        response: jsonResponse({ error: 'AI Sales is restricted to the authorized administrator.' }, 403)
                };
        }

        return { user: authResult.user };
}
