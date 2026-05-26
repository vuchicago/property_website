import { requireAdminAccount, jsonResponse } from './_admin.js';

export const onRequestGet = async (context) => {
        const { response } = await requireAdminAccount(context);
        if (response) return response;

        try {
                const { results } = await context.env.DB.prepare(
                        "SELECT email FROM admins WHERE role = 'partner' ORDER BY email ASC"
                ).all();

                return jsonResponse({ partners: results || [] });
        } catch (err) {
                return jsonResponse({ error: err.message }, 500);
        }
};
