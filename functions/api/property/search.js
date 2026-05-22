import { jsonResponse } from '../_auth.js';
import { buildAnalysis, findComparableProperties, findTargetProperty } from './_compare.js';

function deviceFromUserAgent(userAgent) {
        const value = String(userAgent || '').toLowerCase();

        if (value.includes('android')) {
                return 'Android';
        }

        if (value.includes('iphone') || value.includes('ipad')) {
                return 'iOS';
        }

        if (value) {
                return 'Desktop';
        }

        return 'Unknown';
}

async function savePropertySearch(db, request, payload, analysis) {
        const target = analysis.target;
        const userAgent = request.headers.get('user-agent') || '';

        await db.prepare(
                `INSERT INTO property_searches (
                        query_address,
                        matched_address,
                        pin,
                        result,
                        reason,
                        radius,
                        comp_count,
                        lower_value_count,
                        last_appeal,
                        property_type,
                        home_size,
                        bedroom_count,
                        bathroom_count,
                        my_value,
                        avg_comp_value,
                        class_code,
                        neighborhood_code,
                        device,
                        user_agent,
                        country,
                        cf_ray
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
                payload.address || '',
                target.address,
                target.pin || '',
                analysis.appeal.decision || '',
                analysis.appeal.reason || '',
                analysis.radius,
                analysis.summary.comparableCount,
                analysis.summary.lowerValueCount,
                target.lastAppealYear || '',
                target.propertyClass || '',
                target.homeSize,
                target.bedroomCount,
                target.bathroomCount,
                target.taxableValue,
                analysis.summary.averageComparableValue,
                target.classCode || '',
                target.neighborhoodCode || '',
                deviceFromUserAgent(userAgent),
                userAgent,
                request.cf?.country || '',
                request.headers.get('cf-ray') || ''
        ).run();
}

export const onRequestPost = async (context) => {
        if (!context.env.DB) {
                return jsonResponse({ error: 'Database not configured' }, 500);
        }

        try {
                const payload = await context.request.json();
                const radius = Math.max(0.1, Math.min(5, Number(payload.radius || 0.5)));
                const target = await findTargetProperty(context.env.DB, payload);

                if (!target) {
                        return jsonResponse({
                                error: 'Please enter a valid Cook County property address from the database.'
                        }, 404);
                }

                const comparables = await findComparableProperties(context.env.DB, target, radius);
                const analysis = buildAnalysis(target, comparables, radius, context.env);
                const savePromise = savePropertySearch(context.env.DB, context.request, payload, analysis)
                        .catch(error => console.warn('Could not save property search:', error.message));

                if (context.waitUntil) {
                        context.waitUntil(savePromise);
                } else {
                        await savePromise;
                }

                return jsonResponse(analysis);
        } catch (err) {
                return jsonResponse({ error: err.message }, 500);
        }
};
