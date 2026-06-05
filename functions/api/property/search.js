import { jsonResponse } from '../_auth.js';
import { buildAnalysis, findComparableProperties, findCondoBuildingSales, findRecentPropertySales, findTargetProperty } from './_compare.js';

const PROPERTY_SEARCH_LOG_EXCLUSIONS = new Set([
        '8141 TRIPP AVE SKOKIE IL 60076',
        '8501 CHRISTIANA AVE SKOKIE IL 60076',
        '5705 W OHIO CHICAGO IL 60644',
        '5705 W OHIO ST CHICAGO IL 60644',
        '1049 N LARAMIE CHICAGO IL 60651',
        '1049 N LARAMIE AVE CHICAGO IL 60651',
        '7759 S CONSTANCE AVE CHICAGO IL 60649',
        '3332 W NORTH AVE CHICAGO IL 60647'
]);

const NUMERIC_SIMULATION_FIELDS = new Set([
        'yearBuilt',
        'bedroomCount',
        'bathroomCount'
]);
const TEXT_SIMULATION_FIELDS = new Set([
        'masonryType',
        'repairCondition',
        'singleVsMultiFamily'
]);
const TARGET_COMPARABLE_COUNT = 5;
const AUTO_RADIUS_STEPS = [0.5, 1, 2, 5];

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

function numberOrNull(value) {
        if (value === null || value === undefined || value === '') {
                return null;
        }

        const number = Number(value);
        return Number.isFinite(number) ? number : null;
}

function normalizeAddressForExclusion(value) {
        return String(value || '')
                .toUpperCase()
                .replace(/[^A-Z0-9]+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
}

function isExcludedPropertySearch(payload, target) {
        return [payload?.address, target?.address].some(value =>
                PROPERTY_SEARCH_LOG_EXCLUSIONS.has(normalizeAddressForExclusion(value))
        );
}

function radiusExpansionPlan(startRadius) {
        const normalizedStart = Math.max(0.1, Math.min(5, Number(startRadius || 0.5)));
        return Array.from(new Set([
                normalizedStart,
                ...AUTO_RADIUS_STEPS.filter(radius => radius > normalizedStart)
        ])).sort((a, b) => a - b);
}

async function findComparablesWithAutoRadius(db, target, requestedRadius) {
        const plan = radiusExpansionPlan(requestedRadius);
        let comparables = [];
        let radius = plan[0] || requestedRadius;
        const attempts = [];

        for (const candidateRadius of plan) {
                radius = candidateRadius;
                comparables = await findComparableProperties(db, target, candidateRadius);
                attempts.push({
                        radius: candidateRadius,
                        comparableCount: comparables.length
                });

                if (comparables.length >= TARGET_COMPARABLE_COUNT) {
                        break;
                }
        }

        return {
                comparables,
                radius,
                requestedRadius,
                attempts,
                autoExpanded: radius > requestedRadius
        };
}

function applySimulationOverrides(target, simulation) {
        if (!simulation || typeof simulation !== 'object') {
                return target;
        }

        const simulatedTarget = { ...target };
        const applied = {};

        NUMERIC_SIMULATION_FIELDS.forEach(field => {
                if (!Object.prototype.hasOwnProperty.call(simulation, field)) {
                        return;
                }

                const value = numberOrNull(simulation[field]);
                simulatedTarget[field] = value;
                applied[field] = value;
        });

        TEXT_SIMULATION_FIELDS.forEach(field => {
                if (!Object.prototype.hasOwnProperty.call(simulation, field)) {
                        return;
                }

                const value = String(simulation[field] ?? '').trim();
                simulatedTarget[field] = value || null;
                applied[field] = simulatedTarget[field];
        });

        return {
                ...simulatedTarget,
                isSimulated: Object.keys(applied).length > 0,
                simulationOverrides: applied
        };
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
                const originalTarget = await findTargetProperty(context.env.DB, payload);

                if (!originalTarget) {
                        return jsonResponse({
                                error: 'Please enter a valid Cook County property address from the database.'
                        }, 404);
                }

                const target = applySimulationOverrides(originalTarget, payload.simulation);
                const targetWithSales = target.classCode === '299'
                        ? {
                                ...target,
                                condoBuildingSales: await findCondoBuildingSales(context.env.DB, target)
                        }
                        : {
                                ...target,
                                recentPropertySales: await findRecentPropertySales(context.env.DB, target)
                        };
                const comparableSearch = await findComparablesWithAutoRadius(context.env.DB, targetWithSales, radius);
                const analysis = buildAnalysis(
                        targetWithSales,
                        comparableSearch.comparables,
                        comparableSearch.radius,
                        context.env,
                        {
                                requestedRadius: comparableSearch.requestedRadius,
                                radiusAutoExpanded: comparableSearch.autoExpanded,
                                radiusExpansionAttempts: comparableSearch.attempts
                        }
                );
                const savePromise = targetWithSales.isSimulated || isExcludedPropertySearch(payload, targetWithSales)
                        ? Promise.resolve()
                        : savePropertySearch(context.env.DB, context.request, payload, analysis)
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
